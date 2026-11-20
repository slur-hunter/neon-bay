// The four staged shots: each sets up a scene, snaps the camera directly to
// its position (no lerp — headless runs too few frames to converge) and
// populates the HUD. Readiness uses REAL elapsed time and frame count,
// never game time.

export function createStage(game) {
  let staged = null;
  let stagedAt = 0;
  let frames = 0;

  function snapCamera(pos, lookAt) {
    // Store offsets from the focus so the camera tracks a moving car while
    // keeping the staged framing.
    const focus = game.focusPos();
    game.shotCam = {
      offset: { x: pos[0] - focus.x, y: pos[1], z: pos[2] - focus.z },
      lookOffset: { x: lookAt[0] - focus.x, y: lookAt[1], z: lookAt[2] - focus.z },
    };
    game.cameraMode = 'shot';
  }

  function begin(n) {
    staged = n;
    stagedAt = performance.now();
    frames = 0;
    game.shotNumber = n;
    window.__shot = n;
    game.hideOverlays();
    game.mode = 'playing';
    game.sound.init();
  }

  function stage(n) {
    if (n === 1) {
      // Cover: Rico on foot in a busy street, job 1, wanted 0, $0.
      game.exitCar(true);
      game.hero.reset(28, 10, Math.PI);
      game.patrol.setWanted(0);
      game.errands.reset(0);
      game.money = 0;
      game.updateMissionHud();
      begin(1);
      snapCamera([28, 7, 26], [28, 1.5, -10]);
    } else if (n === 2) {
      // Driving: Rico in a stolen car heading down the street, job 1.
      game.enterCar(game.autos.parked[0]);
      game.currentCar.pos.set(28, 0, 0);
      game.currentCar.yaw = Math.PI;
      game.currentCar.speed = 15;
      game.currentCar.mesh.position.copy(game.currentCar.pos);
      game.currentCar.mesh.rotation.y = Math.PI;
      game.patrol.setWanted(0);
      game.errands.reset(0);
      game.money = 0;
      game.updateMissionHud();
      begin(2);
      snapCamera([28, 6.5, 18], [28, 1, -20]);
    } else if (n === 3) {
      // Chase: wanted 4, job 2, $200 — cruisers ahead, on the cross street
      // and behind, so at least two read clearly in frame with light bars.
      game.enterCar(game.autos.parked[1]);
      game.currentCar.pos.set(28, 0, 0);
      game.currentCar.yaw = Math.PI;
      game.currentCar.speed = 18;
      game.currentCar.mesh.position.copy(game.currentCar.pos);
      game.currentCar.mesh.rotation.y = Math.PI;
      game.patrol.setWanted(4);
      game.patrol.spawnAt(28, -24);
      game.patrol.spawnAt(28, -40);
      game.patrol.spawnAt(-28, -28);
      game.patrol.spawnAt(28, 34);
      game.errands.reset(1);
      game.money = 200;
      game.updateMissionHud();
      begin(3);
      snapCamera([28, 7, 16], [28, 1, -20]);
    } else if (n === 4) {
      // Mission complete: Rico on foot by the job 2 marker, banner up.
      game.exitCar(true);
      game.hero.reset(-78, 78, -Math.PI / 4);
      game.patrol.setWanted(0);
      game.errands.reset(1);
      game.money = 200;
      game.updateMissionHud();
      game.display.message('MISSION COMPLETE', '+$200 — Job 1 done. The Ledger is pleased.', 60000);
      begin(4);
      snapCamera([-56, 6, 84], [-84, 1.5, 84]);
    }
  }

  function tick() {
    frames += 1;
  }

  function isReady() {
    return staged !== null && performance.now() - stagedAt >= 4000 && frames >= 5;
  }

  return { stage, tick, isReady, get staged() { return staged; } };
}
