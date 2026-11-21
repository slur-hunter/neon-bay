// Staged shots: each sets up a scene and SNAPS the camera directly (no lerp —
// headless runs too few frames to converge). Shot readiness uses REAL elapsed
// time (at least 4 seconds) and at least 5 frames — never game time.
// v9 staging: every camera sits ON a street (never inside a block, never
// against a building wall) and CLOSE to Rico / the car, so the player reads
// within 2 seconds at contact-sheet size and the chase cruisers are large.
import * as THREE from 'three';

export function buildStage(ctx) {
  const { camera, hero, autos, patrol, errands, crowd, display, sound } = ctx;
  let shotNum = null;
  let shotStartedAt = 0;
  let shotFrames = 0;

  function snapCam(px, py, pz, lx, ly, lz) {
    camera.position.set(px, py, pz);
    camera.lookAt(lx, ly, lz);
    camera.updateProjectionMatrix();
  }

  function placeRico(x, z, yaw) {
    hero.place(x, z, yaw);
  }

  // Put Rico in a bright parked car and return it, ready to drive.
  function placeInCar(x, z, yaw) {
    const near = autos.nearestStealable(x, z);
    let car = near.car;
    if (!car || near.dist > 60) {
      car = autos.parked[0];
    }
    car.x = x;
    car.z = z;
    car.yaw = yaw;
    car.v = 0;
    car.damage = 8;
    car.mesh.group.position.set(x, 0, z);
    car.mesh.group.rotation.y = yaw;
    return autos.makeDriven(car);
  }

  function applyShot(n) {
    shotNum = n;
    shotStartedAt = performance.now();
    shotFrames = 0;
    if (n === 1) {
      // Cover: Rico on foot on east-west street z=-35, facing west toward the
      // sun disc. Camera 10m behind him on the same street: Rico is large,
      // centred, sun disc low on the horizon straight ahead.
      errands.setForShot(0, 0, 0, {});
      patrol.hideAll();
      patrol.setWanted(0);
      placeRico(-60, -35, -Math.PI / 2);
      snapCam(-50, 3.2, -35, -90, 1.6, -35);
      ctx.setInCar(null);
    } else if (n === 2) {
      // Driving: Rico in a stolen bright car on street z=-35, facing west.
      // Close chase cam behind the car: the car fills the lower centre.
      errands.setForShot(0, 0, 0, {});
      patrol.hideAll();
      patrol.setWanted(0);
      const car = placeInCar(-60, -35, -Math.PI / 2);
      car.v = 12;
      ctx.setInCar(car);
      sound.radioStart();
      snapCam(-48, 4.2, -35, -90, 1.2, -35);
    } else if (n === 3) {
      // Chase: wanted 4, job 2, $200. Car faces north on street x=-35.
      // Camera on the street's east edge, south-east of the car, looking
      // north-west: the car is large, and the two near cruisers sit at a
      // similar distance so they read as police cars, not small dark blobs.
      errands.setForShot(1, 200, 125, { Marina: 1 });
      const car = placeInCar(-35, -80, Math.PI);
      car.v = 12;
      ctx.setInCar(car);
      sound.radioStart();
      patrol.stageChase(car.x, car.z, car.yaw);
      snapCam(-28, 4.5, -62, -36, 1.2, -80);
    } else if (n === 4) {
      // Mission complete: Rico on foot on north-south street x=-105, at the
      // job 2 marker, facing north toward it. Camera 14m behind him on the
      // same street: Rico centred, marker beam and ring ahead, buildings
      // framing both sides, no flat empty expanse.
      errands.setForShot(1, 200, 125, { Marina: 1 });
      errands.showBanner('MISSION COMPLETE — The Pickup +$200', 30);
      patrol.hideAll();
      patrol.setWanted(0);
      placeRico(-105, -132, Math.PI);
      snapCam(-105, 3.6, -118, -105, 1.6, -140);
      ctx.setInCar(null);
    }
    ctx.refreshHud();
    ctx.setMode('shot');
  }

  function tick() {
    shotFrames++;
  }

  function ready() {
    if (shotNum === null) return false;
    return performance.now() - shotStartedAt >= 4000 && shotFrames >= 5;
  }

  function current() {
    return shotNum;
  }

  return { applyShot, tick, ready, current };
}
