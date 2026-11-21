// Staged shots: each one sets up a scene and snaps the camera, in
// golden-hour light. Readiness uses REAL elapsed time and frame count,
// never game time. The camera snaps directly — headless runs too few
// frames for any lerp to converge.
import * as THREE from 'three';

function setJob(G, index, money, rp, done) {
  const st = G.errands.state;
  st.index = index;
  st.money = money;
  st.rp = rp;
  st.done = done;
  st.banner = '';
  st.bannerT = 0;
  G.errands.placeMarker();
}

function putHeroOnFoot(G, x, z, yaw) {
  G.hero.x = x; G.hero.z = z; G.hero.yaw = yaw;
  G.hero.group.position.set(x, 0, z);
  G.hero.group.visible = true;
  G.car = null;
}

function putHeroInCar(G, x, z, yaw) {
  const car = G.autos.nearestStealable(x, z) || G.autos.parked[0];
  car.stolen = true;
  car.x = x; car.z = z; car.yaw = yaw; car.speed = 0; car.damage = 8;
  car.group.position.set(x, 0, z);
  car.group.rotation.y = yaw;
  G.car = car;
  G.hero.group.visible = false;
  G.hero.x = x; G.hero.z = z; G.hero.yaw = yaw;
  return car;
}

function snapCamera(G, px, py, pz, tx, ty, tz) {
  G.camera.position.set(px, py, pz);
  G.camera.lookAt(tx, ty, tz);
  G.camYaw = Math.atan2(tx - px, tz - pz);
}

export function applyShot(n, G) {
  G.shot = n;
  G.shotFrames = 0;
  G.shotStartedAt = performance.now();
  G.mode = 'shot';
  G.wanted = 0;
  G.health = 100;
  G.patrol.sync(0, 0, 0);
  G.display.hideOverlays();
  const hint = document.getElementById('hint');
  if (hint) hint.style.display = 'none';

  if (n === 1) {
    // Cover: Rico on foot in the middle of a street, job 1, $0, sun disc
    // in frame. A low camera on street z=0 looks due west down the street;
    // Rico stands 11 units ahead, lower-center, the sun disc sits at the
    // street's vanishing point.
    setJob(G, 0, 0, 0, 0);
    putHeroOnFoot(G, 9, -0.7, -Math.PI / 2);
    // Peds on the street near the hero so the street reads busy.
    G.crowd.peds.slice(0, 6).forEach((p, i) => {
      p.x = -6 + i * 4; p.z = (i % 2 === 0 ? -3 : 3); p.down = 0;
    });
    snapCamera(G, 20, 3.5, 4, -40, 3, 0);
  } else if (n === 2) {
    // Driving: Rico in a stolen car down a long street, job 1, $0.
    setJob(G, 0, 0, 0, 0);
    const car = putHeroInCar(G, 0, 60, Math.PI);
    car.speed = 12;
    G.crowd.peds.slice(0, 4).forEach((p, i) => {
      p.x = -8 + i * 5; p.z = 44 + (i % 2) * 8; p.down = 0;
    });
    snapCamera(G, car.x + 13, 7.5, car.z + 16, car.x - 22, 2.5, car.z - 26);
  } else if (n === 3) {
    // Chase: wanted 4, job 2, $200, four named cruisers after Rico.
    setJob(G, 1, 200, 125, 1);
    const car = putHeroInCar(G, 0, 20, Math.PI);
    car.speed = 18;
    car.damage = 22;
    G.wanted = 4;
    G.patrol.sync(4, car.x, car.z);
    // Pull two cruisers into the frame ahead of the car, close enough to
    // read their light bars. The camera sits on street x=0 behind the car.
    const c0 = G.patrol.cops[0];
    const c1 = G.patrol.cops[1];
    if (c0) { c0.x = -6; c0.z = car.z - 10; c0.yaw = 0; c0.group.position.set(-6, 0, car.z - 10); c0.group.rotation.y = 0; }
    if (c1) { c1.x = 6; c1.z = car.z - 14; c1.yaw = 0; c1.group.position.set(6, 0, car.z - 14); c1.group.rotation.y = 0; }
    snapCamera(G, car.x + 5, 8, car.z + 16, car.x, 2, car.z - 18);
  } else {
    // Mission complete: on foot by the job 2 marker, banner up, RP raised.
    setJob(G, 1, 200, 125, 1);
    const st = G.errands.state;
    st.banner = 'MISSION COMPLETE — The Pickup +$200';
    st.bannerT = 999;
    // Hero on foot on street z=96, the marker beam just beyond him.
    putHeroOnFoot(G, -64, 96, Math.PI * 0.25);
    G.crowd.peds.slice(0, 4).forEach((p, i) => {
      p.x = -78 + i * 4; p.z = 93 + (i % 2) * 6; p.down = 0;
    });
    // Camera on the street centerline so nothing blocks the frame; the hero
    // stands mid-street with the marker beam beyond him.
    snapCamera(G, -48, 7, 96, -72, 2.5, 96);
  }
  // Refresh the HUD once so every panel is populated for the shot.
  G.refreshHud();
}
