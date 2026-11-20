// Neon Bay v7 — the director. Four staged shots for the screenshots. Each shot
// sets up a scene (player, car, wanted level, money, mission) and snaps the camera
// to a fixed offset from the focus. Readiness uses REAL elapsed time and a frame
// count, never game time.
import * as THREE from 'three';

export function createDirector(game) {
  let staged = null;
  let stagedAt = 0;
  let stagedFrames = 0;

  function snapCamera(offset, lookOffset) {
    game.shotCam = {
      offset: new THREE.Vector3(offset[0], offset[1], offset[2]),
      lookOffset: new THREE.Vector3(lookOffset[0], lookOffset[1], lookOffset[2]),
    };
    game.cameraMode = 'shot';
  }

  function hideOverlays() {
    game.panel.hideStart();
    game.panel.hidePause();
    game.panel.hideGameOver();
    game.panel.hideLoading();
  }

  function stage(n) {
    hideOverlays();
    game.mode = 'playing';
    game.tunes.init();
    staged = n;
    stagedAt = performance.now();
    stagedFrames = 0;
    game.shotNumber = n;

    if (n === 1) {
      // Cover: Rico on foot in a busy street, job 1, no heat, no money.
      game.exitCar(true);
      game.rico.reset(23, 44, Math.PI);
      game.pd.setWanted(0);
      game.jobs.reset(0);
      game.money = 0;
      game.updateMissionHud();
      snapCamera([8, 5, 11], [0, 1.2, -12]);
    } else if (n === 2) {
      // Driving: Rico in a stolen car down the street, job 1.
      const car = game.traffic.parked[0];
      game.enterCar(car, true);
      car.pos.set(30, 0, -23);
      car.yaw = Math.PI / 2;
      car.speed = 15;
      game.pd.setWanted(0);
      game.jobs.reset(0);
      game.money = 0;
      game.updateMissionHud();
      snapCamera([-13, 5.5, 2], [14, 1, 0]);
    } else if (n === 3) {
      // Chase: wanted 4, job 2, $200, all four cruisers placed by hand so the
      // panel lists the whole roster at screenshot time.
      const car = game.traffic.parked[1];
      game.enterCar(car, true);
      car.pos.set(0, 0, -23);
      car.yaw = Math.PI / 2;
      car.speed = 16;
      game.pd.setWanted(4);
      game.pd.spawnAt(55, -23); // head-on, ahead of the player
      game.pd.spawnAt(25, 0); // crossing on the cross street, right of frame
      game.pd.spawnAt(-35, -23); // chasing from behind
      game.pd.spawnAt(45, 23); // parallel street, left edge of frame
      game.jobs.reset(1);
      game.money = 200;
      game.updateMissionHud();
      snapCamera([-16, 8, 0], [16, 0.5, 0]);
    } else if (n === 4) {
      // Mission complete: Rico on foot by the job 2 marker, banner up.
      game.exitCar(true);
      game.rico.reset(-69, 78, Math.PI);
      game.pd.setWanted(0);
      game.jobs.reset(1);
      game.money = 200;
      game.updateMissionHud();
      game.panel.message('MISSION COMPLETE', '+$200 — Job 1 done. The Ledger is pleased.', 60000);
      snapCamera([-6, 5, 12], [0, 1.5, -9]);
    }
  }

  function isReady() {
    if (staged === null) return false;
    stagedFrames += 1;
    return performance.now() - stagedAt >= 4000 && stagedFrames >= 5;
  }

  return {
    stage,
    isReady,
    get staged() { return staged; },
  };
}
