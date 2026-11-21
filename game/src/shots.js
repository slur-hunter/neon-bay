// The four screenshot scenes. Each one stages a real late-game state (job 4 of 4,
// $5,200, rank B) from the live rules, places traffic and pedestrians where the
// camera can see them, steps the simulation a fixed 120 frames so the clock, the
// timer, the cruisers and the light bars are all live, then puts the camera where
// the frame shows three layers: the player in front, life in the middle, and a
// landmark or horizon behind. The same seed always gives the same frame.
import { WORLD } from './config.js';
import { JOB_MARKERS } from './jobs.js';

const STEPS = 120;

/** Put every traffic car and pedestrian where this shot's camera can see them, so
    no random actor stands next to the player or the camera by chance. */
function stageStreetLife(game, centreZ, count) {
  const { actors } = game;
  for (let i = 0; i < actors.traffic.length; i += 1) {
    const car = actors.traffic[i];
    const lane = i % 2 === 0 ? WORLD.strandX - 3.4 : WORLD.strandX + 3.4;
    car.x = lane;
    car.z = centreZ - 18 - ((i * 9) % 80);
    car.heading = lane < WORLD.strandX ? Math.PI : 0;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
  for (let i = 0; i < actors.peds.length; i += 1) {
    const ped = actors.peds[i];
    const side = i % 2 === 0 ? WORLD.strandX - 8.6 : WORLD.strandX + 8.6;
    ped.x = side;
    ped.z = centreZ - 8 - ((i * 7) % 70);
    ped.heading = i % 2 === 0 ? 0 : Math.PI;
    ped.down = false;
    ped.mesh.rotation.x = 0;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
}

function baseStage(game, clockTarget, timerTarget) {
  const { jobs, police, actors } = game;
  jobs.stageLateGame();
  jobs.state.timer = timerTarget + 2;
  game.clockMinutes = clockTarget - 1;
  game.damage = 0;
  game.titleCard = false;
  police.setWanted(0);
  for (const cruiser of actors.cruisers) cruiser.active = false;
  jobs.clearDialogue();
  const marker = JOB_MARKERS[3];
  game.world.setMarker(marker.x, marker.z);
  jobs.state.district = 'THE STRAND';
}

function stepAll(game, input) {
  for (let i = 0; i < STEPS; i += 1) game.step(1 / 60, input, true);
}

export function stageShot(name, game) {
  const { actors, jobs, police } = game;
  const player = actors.player;

  if (name === 'drive') {
    baseStage(game, 18 * 60 + 14, 115);
    const car = actors.parked[0];
    car.speed = 12;
    actors.enterCar(car);
    player.x = WORLD.strandX;
    player.z = 40;
    player.heading = Math.PI;
    car.x = player.x;
    car.z = player.z;
    car.heading = Math.PI;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    game.damage = 4;
    stageStreetLife(game, player.z - 10, 3);
    stepAll(game, { throttle: 0.21, steer: 0, brake: 0 });
    game.placeShotCamera({ dx: 0, dy: 7, dz: 16 }, { dx: 0, dy: 2, dz: -22 });
    return { screen: 'play' };
  }

  if (name === 'chase') {
    baseStage(game, 18 * 60 + 15, 118);
    const car = actors.parked[0];
    car.speed = 12;
    actors.enterCar(car);
    player.x = WORLD.strandX;
    player.z = 0;
    player.heading = Math.PI;
    car.x = player.x;
    car.z = player.z;
    car.heading = Math.PI;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    game.damage = 4;
    jobs.state.district = 'HARBOUR';
    police.stageChase();
    stageStreetLife(game, player.z - 10, 3);
    stepAll(game, { throttle: 0.21, steer: 0, brake: 0 });
    game.placeShotCamera({ dx: -3, dy: 12, dz: 30 }, { dx: 1, dy: 2, dz: -24 });
    return { screen: 'play' };
  }

  if (name === 'mission') {
    baseStage(game, 18 * 60 + 14, 115);
    jobs.state.stage = 3;
    jobs.state.banner = { title: 'MISSION COMPLETE', line: 'The Ledger +$1200', time: 12 };
    jobs.state.bannerTime = 12;
    jobs.setDialogue('VINNIE', 'That settles it. You are square, Rico. Welcome to the Strand.');
    game.titleCard = true;
    player.x = WORLD.strandX;
    player.z = 22;
    player.heading = Math.PI;
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.heading;
    stageStreetLife(game, player.z - 10, 3);
    stepAll(game, {});
    game.placeShotCamera({ dx: 6, dy: 6, dz: 14 }, { dx: -1, dy: 2, dz: -22 });
    return { screen: 'play' };
  }

  // Default: the cover shot, on foot on the Strand.
  baseStage(game, 18 * 60 + 14, 115);
  jobs.setDialogue('VINNIE', 'The Ledger is almost settled, Rico. One more collection on the Strand.');
  game.titleCard = true;
  player.x = WORLD.strandX - 3;
  player.z = 28;
  player.heading = Math.PI;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  stageStreetLife(game, player.z - 10, 3);
  stepAll(game, {});
  game.placeShotCamera({ dx: 6, dy: 5, dz: 14 }, { dx: -1, dy: 2, dz: -30 });
  return { screen: 'play' };
}
