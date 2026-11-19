// shots.js — staged scenes for ?shot=1..4. The camera SNAPS to its staged
// position (no lerp from the high menu camera: headless runs too few frames to
// converge). Readiness uses real time: at least 4 seconds after load, and at
// least 5 frames rendered.
import * as THREE from 'three';

export function createShots(game) {
  let staged = null;
  let stagedAt = 0;

  // The staged framing is stored as an OFFSET from the focus (the player/car),
  // so the camera tracks a moving car while keeping the staged shot. The
  // position is set directly every frame: no lerp from the menu camera.
  function snapCamera(pos, lookAt) {
    const focus = game.focusPos();
    game.shotCam = {
      offset: new THREE.Vector3(pos[0] - focus.x, pos[1] - focus.y, pos[2] - focus.z),
      lookOffset: new THREE.Vector3(lookAt[0] - focus.x, lookAt[1] - focus.y, lookAt[2] - focus.z),
    };
    game.cameraMode = 'shot';
  }

  function stage(n) {
    const g = game;
    g.hud.hideStart();
    g.hud.hidePause();
    g.hud.hideGameOver();
    g.mode = 'playing';
    g.audio.init();

    if (n === 1) {
      // Cover: Rico on foot in a busy street, traffic and pedestrians around him.
      g.exitCar(true);
      g.player.reset(30, 30, Math.PI);
      g.police.setWanted(0);
      g.missions.reset(0);
      g.money = 0;
      g.hud.setMission('<b>Job 1 — The Pickup</b><br>Pick up the package at 2nd &amp; Palm. $200.');
      snapCamera([30, 7, 46], [30, 1.5, 0]);
    } else if (n === 2) {
      // Driving: Rico in a stolen sedan, street ahead, speed on the HUD.
      const car = g.vehicles.parked[0];
      g.enterCar(car);
      car.pos.set(30, 0, 60);
      car.yaw = Math.PI;
      car.speed = 15;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.yaw;
      g.police.setWanted(0);
      g.missions.reset(0);
      g.money = 0;
      g.hud.setMission('<b>Job 1 — The Pickup</b><br>Pick up the package at 2nd &amp; Palm. $200.');
      snapCamera([30, 6.5, 78], [30, 1, 30]);
    } else if (n === 3) {
      // The chase: 4 stars, three cruisers on Rico, light bars flashing.
      const car = g.vehicles.parked[1];
      g.enterCar(car);
      car.pos.set(30, 0, 10);
      car.yaw = Math.PI;
      car.speed = 18;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.yaw;
      g.police.setWanted(4);
      // A cruiser starts ahead of Rico, bearing down head-on, so its light bar
      // reads in the frame; the update loop adds the rest of the pursuit.
      g.police.spawnAt(30, -8);
      g.missions.reset(0);
      g.money = 200;
      g.hud.setMission('<b>Job 2 — The Drop</b><br>Deliver the package to the docks. $300.');
      snapCamera([18, 7, 34], [30, 1, -6]);
    } else {
      // Mission complete: Job 1 paid, banner up, Rico at the next marker.
      g.exitCar(true);
      g.player.reset(-90, 84, Math.PI * 0.75);
      g.police.setWanted(0);
      g.missions.reset(1);
      g.money = 200;
      g.hud.setMission('<b>Job 2 — The Drop</b><br>Deliver the package to the docks. $300.');
      g.hud.message('MISSION COMPLETE', '+$200 — Job 1 done. The Ledger is pleased.', 60000);
      snapCamera([-83, 5, 72], [-98, 2, 98]);
    }

    staged = n;
    stagedAt = performance.now();
    g.shotNumber = n;
    window.__shot = n;
  }

  function isReady() {
    if (staged === null) return false;
    const realElapsed = performance.now() - game.startTime;
    return realElapsed >= 4000 && game.frames >= 5;
  }

  return { stage, isReady, get staged() { return staged; } };
}
