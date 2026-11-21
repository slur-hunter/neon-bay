// Shot staging: each of the 4 screenshots is a set scene with the camera
// snapped directly to its position (no lerp — headless runs too few frames
// to converge). Street life and cruisers are staged from the game's own
// live entity lists and frozen in place so the framing survives the 4 s
// readiness wait; their distances, roles and light bars stay live.
import * as THREE from 'three';
import { dist2 } from './rng.js';

function placeStreetLife(ctx, specs) {
  // specs: [{kind:'ped', x, z, shirt}, {kind:'parked', x, z, color},
  //         {kind:'mover', x, z, yaw, color}]
  for (const s of specs) {
    if (s.kind === 'ped') {
      ctx.peds.placeAt(s.x, s.z, s.shirt);
    } else if (s.kind === 'parked') {
      ctx.vehicles.addParked(s.x, s.z, s.color);
    } else if (s.kind === 'mover') {
      const m = ctx.vehicles.addMover(s.x, s.z, s.yaw, s.color);
      m.frozen = true;
      m.speed = 0;
    }
  }
}

function snapCamera(camera, x, y, z, tx, ty, tz) {
  camera.position.set(x, y, z);
  camera.lookAt(tx, ty, tz);
  camera.updateProjectionMatrix();
}

export function setupShot(n, ctx) {
  const { hero, vehicles, peds, police, jobs, camera } = ctx;
  const J = jobs.state;
  // Reset the world to a clean staged state.
  police.clear();
  ctx.inCar = false;
  ctx.car = null;
  ctx.speed = 0;
  ctx.health = 100;

  if (n === 1) {
    // Cover: Rico on foot, job 1, wanted 0, $0, sun disc down the street.
    J.index = 0; J.money = 0; J.rp = 0; J.doneByDistrict = {}; J.missionsDone = 0;
    J.banner = ''; J.bannerTimer = 0;
    hero.x = 0; hero.z = 40; hero.yaw = Math.PI;
    hero.group.position.set(0, 0, 40);
    hero.group.rotation.y = Math.PI;
    placeStreetLife(ctx, [
      { kind: 'ped', x: -9.5, z: 22, shirt: 0x2fae5f },
      { kind: 'ped', x: 9.5, z: 30, shirt: 0xff7a1f },
      { kind: 'parked', x: 5.5, z: 12, color: 0xf2f2f2 },
      { kind: 'mover', x: -3, z: -8, yaw: Math.PI, color: 0xe84a3a },
      { kind: 'mover', x: 3, z: -28, yaw: Math.PI, color: 0xff7a1f },
    ]);
    snapCamera(camera, 0, 7, 52, 0, 2, 20);
    ctx.camYaw = Math.PI;
  } else if (n === 2) {
    // Driving: Rico in a stolen green car, job 1, wanted 0, $0.
    J.index = 0; J.money = 0; J.rp = 0; J.doneByDistrict = {}; J.missionsDone = 0;
    J.banner = ''; J.bannerTimer = 0;
    const car = vehicles.addParked(0, 40, 0x2fae5f);
    car.taken = true;
    car.group.rotation.y = Math.PI;
    car.yaw = Math.PI;
    ctx.car = car;
    ctx.inCar = true;
    ctx.speed = 11.6; // ~26 mph
    hero.group.visible = false;
    placeStreetLife(ctx, [
      { kind: 'ped', x: -9.5, z: 24, shirt: 0x2fae5f },
      { kind: 'ped', x: 9.5, z: 32, shirt: 0xff7a1f },
      { kind: 'parked', x: -5.5, z: 18, color: 0xf2f2f2 },
      { kind: 'mover', x: -3, z: 8, yaw: Math.PI, color: 0xe84a3a },
      { kind: 'mover', x: 3, z: -12, yaw: Math.PI, color: 0xff7a1f },
      { kind: 'mover', x: -3, z: -30, yaw: Math.PI, color: 0x2f9ae8 },
    ]);
    snapCamera(camera, 0, 8, 54, 0, 1.5, 26);
    ctx.camYaw = Math.PI;
  } else if (n === 3) {
    // Chase: wanted 4, job 2, $200, RP 125, RANK C, standing 25.
    // The player car sits centre frame; REEF-12 rams from the left at
    // 4.5 m (RAMMING, under 7 m), TIDE-7 and SURF-3 chase ahead on both
    // sides, BAY-9 further ahead. All four are fully in frame with
    // their light bars visible — v10 showed only one clearly.
    J.index = 1; J.money = 200; J.rp = 125; J.doneByDistrict = { Marina: 1 }; J.missionsDone = 1;
    J.banner = ''; J.bannerTimer = 0;
    const car = vehicles.addParked(0, 20, 0x2fae5f);
    car.taken = true;
    car.group.rotation.y = Math.PI;
    car.yaw = Math.PI;
    ctx.car = car;
    ctx.inCar = true;
    ctx.speed = 11.6;
    car.damage = 8;
    hero.group.visible = false;
    // Stage the four cruisers on fixed marks, then set the wanted count
    // to 4 (syncWanted sees four already present and spawns none).
    police.clear();
    const reef = police.placeStaged(-4, 22, Math.PI, 'REEF-12');
    // TIDE-7 and SURF-3 sit close beside the player car (8-12 m) so their
    // light bars read clearly; BAY-9 chases further ahead.
    const tide = police.placeStaged(6, 14, Math.PI, 'TIDE-7');
    const surf = police.placeStaged(-6, 10, Math.PI, 'SURF-3');
    const bay = police.placeStaged(6, -6, Math.PI, 'BAY-9');
    for (const c of [reef, tide, surf, bay]) {
      c.dist = dist2(c.x, c.z, 0, 20);
    }
    police.setWanted(4);
    placeStreetLife(ctx, [
      { kind: 'ped', x: -9.5, z: 14, shirt: 0x2fae5f },
      { kind: 'ped', x: 9.5, z: 26, shirt: 0xff7a1f },
      { kind: 'mover', x: -3, z: -16, yaw: Math.PI, color: 0xe84a3a },
      { kind: 'mover', x: 3, z: -30, yaw: Math.PI, color: 0xff7a1f },
    ]);
    snapCamera(camera, 0, 9, 34, 0, 1, 8);
    ctx.camYaw = Math.PI;
  } else {
    // Mission complete: Rico on foot at the job 2 marker, $200, banner.
    J.index = 1; J.money = 200; J.rp = 125; J.doneByDistrict = { Marina: 1 }; J.missionsDone = 1;
    J.banner = 'MISSION COMPLETE — The Pickup +$200';
    J.bannerTimer = 99;
    hero.x = 120; hero.z = -54; hero.yaw = Math.PI;
    hero.group.position.set(120, 0, -54);
    hero.group.rotation.y = Math.PI;
    placeStreetLife(ctx, [
      { kind: 'ped', x: 129.5, z: -44, shirt: 0xff7a1f },
      { kind: 'ped', x: 110.5, z: -66, shirt: 0x2fae5f },
      { kind: 'parked', x: 114.5, z: -40, color: 0x2f2f38 },
      { kind: 'mover', x: 117, z: -72, yaw: Math.PI, color: 0xe84a3a },
      { kind: 'mover', x: 123, z: -84, yaw: Math.PI, color: 0xff7a1f },
    ]);
    snapCamera(camera, 120, 7, -38, 120, 1.5, -58);
    ctx.camYaw = Math.PI;
  }

  // Refresh the marker visuals and the HUD for the staged state.
  ctx.refreshMarker();
  ctx.refreshHud(true);
}
