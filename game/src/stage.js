// The four staged shots. Each one sets up a real scene (live entities, live
// HUD data), snaps the camera directly to its position, and records when the
// shot started so readiness can use REAL elapsed time + frames.
// v10: every shot has a pedestrian AND a traffic car visible, the compass
// shows a live distance, and the chase panel label matches the live rule
// (REEF-12 is staged within 7 m so RAMMING is true).
import * as THREE from 'three';

function snap(G, cx, cy, cz, tx, ty, tz) {
  G.camera.position.set(cx, cy, cz);
  G.camera.lookAt(new THREE.Vector3(tx, ty, tz));
  G.camYaw = Math.atan2(tx - cx, tz - cz);
}

function resetState(G) {
  G.health = 100;
  G.bannerTimer = 0;
  G.bannerText = '';
  G.jobs.index = 0;
  G.jobs.money = 0;
  G.jobs.rp = 0;
  G.jobs.doneByDistrict = {};
  G.jobs.missionsDone = 0;
  G.inCar = false;
  G.hero.group.visible = true;
  G.carMesh.group.visible = false;
  G.car.speed = 0;
  G.car.damage = 0;
  G.police.setWanted(0);
  G.police.decayTimer = 0;
  // unfreeze any staged entities from a previous shot
  for (const p of G.peds.list) p.state = 'walk';
}

export function stageShot(G, n) {
  resetState(G);
  G.mode = 'shot';
  G.shot = n;
  window.__shot = n;
  G.shotFrame0 = G.frames;
  G.shotStartedAt = performance.now();
  window.__shotReady = false;
  const hide = (id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  };
  hide('start-overlay');
  hide('pause-overlay');
  hide('over-overlay');
  hide('loading');

  if (n === 1) {
    // Cover: Rico on foot on a busy street, sun disc down the street.
    G.jobs.index = 0;
    G.hero.place(0, 40, Math.PI);
    snap(G, 0, 4.2, 52, 0, 1.6, 34);
    G.peds.placeAt(0, 9, 28, Math.PI);
    G.peds.placeAt(1, -9.5, 22, 0);
    G.traffic.placeParked(0, -5.5, 18, 0.15);
    G.traffic.placeMover(0, 3, 8, Math.PI);
    G.traffic.placeMover(1, -2.5, -14, 0);
  } else if (n === 2) {
    // Driving: Rico in a stolen car, traffic ahead, pedestrian on the sidewalk.
    G.jobs.index = 0;
    G.inCar = true;
    G.hero.group.visible = false;
    G.carMesh.group.visible = true;
    G.car.place(0, 40, Math.PI);
    G.car.speed = 11.6; // 26 mph
    snap(G, 0, 5, 54, 0, 1.2, 36);
    G.peds.placeAt(0, 9, 30, Math.PI);
    G.peds.placeAt(1, -9.5, 14, 0);
    G.traffic.placeParked(0, -6, 24, 0.1);
    G.traffic.placeMover(0, 2.5, 12, Math.PI);
    G.traffic.placeMover(1, -3, -8, 0);
  } else if (n === 3) {
    // Chase: wanted 4, four cruisers, REEF-12 inside 7 m so RAMMING is true.
    G.jobs.index = 1;
    G.jobs.money = 200;
    G.jobs.rp = 125;
    G.jobs.doneByDistrict = { Marina: 1 };
    G.jobs.missionsDone = 1;
    G.police.setWanted(4);
    G.inCar = true;
    G.hero.group.visible = false;
    G.carMesh.group.visible = true;
    G.car.place(0, 20, Math.PI);
    G.car.speed = 11.6;
    G.car.damage = 8;
    snap(G, 9, 6.5, 44, 0, 1.2, 18);
    G.police.placeAt(0, 0.5, 25.5, Math.PI); // 5.5 m behind the player: RAMMING
    G.police.placeAt(1, -4.5, 38, Math.PI); // ~18.5 m: PURSUIT
    G.police.placeAt(2, 5, 40, Math.PI); // ~20.6 m: PURSUIT
    G.police.placeAt(3, -6, 46, Math.PI); // ~26.7 m: PURSUIT
    G.peds.placeAt(0, 9, 12, Math.PI);
    G.peds.placeAt(1, -9.5, 32, 0);
    G.traffic.placeMover(0, 2.5, -6, Math.PI);
    G.traffic.placeMover(1, -5, 30, 0);
    G.traffic.placeParked(0, -5.5, 48, 0.1);
  } else {
    // Mission complete: Rico on foot at the job-2 marker, banner up.
    G.jobs.index = 1;
    G.jobs.money = 200;
    G.jobs.rp = 125;
    G.jobs.doneByDistrict = { Marina: 1 };
    G.jobs.missionsDone = 1;
    G.hero.place(104, -98, Math.PI);
    snap(G, 104, 4.5, -84, 104, 1.6, -100);
    G.bannerText = 'MISSION COMPLETE — The Pickup +$200';
    G.bannerTimer = 999;
    G.peds.placeAt(0, 113, -108, Math.PI / 2);
    G.peds.placeAt(1, 95, -88, -Math.PI / 2);
    G.traffic.placeMover(0, 99, -120, Math.PI);
    G.traffic.placeMover(1, 109, -76, 0);
    G.traffic.placeParked(0, 98.5, -90, -0.1);
  }
  // populate the HUD immediately so the first rendered frame already shows it
  G.hud.update(G, 0.12);
}
