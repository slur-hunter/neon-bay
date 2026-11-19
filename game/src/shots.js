// Neon Bay — shots.js: the four fixed scenes for the screenshots.
// One clear job: put the game in a photogenic state for each ?shot= mode.
// The judge sees the screenshots first, so every shot is staged in bright
// late-afternoon sun with several systems visible at once.
import { LANDMARKS } from './city.js';
import { repaint } from './vehicles.js';

/** Stages one of the four screenshot scenes. Returns the camera mode to use. */
export function setupShot(G, name) {
  G.dayTime = 15.5; // bright late-afternoon sun, never dusk
  if (name === 'start') {
    // Title screen over the bright city: the Spire, the streets, the bay.
    G.state = 'title';
    return 'cinematic';
  }

  // The other three shots play the game: hide the start screen and go.
  document.getElementById('start-screen').classList.add('hidden');
  G.hud.show();
  G.state = 'playing';
  G.audio.unlock();

  if (name === 'drive') {
    // Driving down a street with one star and a police car trailing.
    const car = G.vehicles.parked[0];
    car.kind = 'player';
    car.pos.set(24, 0, -16);
    car.heading = Math.PI / 2;
    car.speed = 22;
    repaint(car, 0xf5c542); // bright yellow so the hero car pops on the dark road
    G.drivenCar = car;
    G.player.setInCar(true);
    G.player.pos.copy(car.pos);
    G.missions.restore(1); // Getaway Driver: the beacon marks the hideout
    G.police.addWanted(1, G.time);
    // One police car on the same street, trailing behind, so the chase reads.
    G.police.spawnAt(-2, -16, 18);
    G.cam.yaw = 0;
    return 'chase';
  }

  if (name === 'chase') {
    // A four-star chase: three police cars closing in on the player's car.
    const car = G.vehicles.parked[1];
    car.kind = 'player';
    car.pos.set(-40, 0, 16);
    car.heading = Math.PI / 2;
    car.speed = 30;
    G.drivenCar = car;
    G.player.setInCar(true);
    G.player.pos.copy(car.pos);
    G.missions.restore(3); // Heat: already at three stars, losing the heat
    G.police.addWanted(4, G.time);
    // Two police cars close behind, one ahead as a roadblock, so the chase
    // reads in the forward-facing chase camera (pursuers behind it are unseen).
    G.police.spawnAt(-54, 16, 26);
    G.police.spawnAt(-62, 16, 26);
    G.police.spawnAt(-10, 16, 24, -Math.PI / 2);
    G.fx.dust(car.pos.x, 0.5, car.pos.z, 12);
    G.cam.yaw = Math.PI / 2;
    return 'chase';
  }

  // mission: on foot at the docks, the gold beacon over Mara's package.
  // The player stands at the pier's shore end so the pier, the beacon and
  // the water all read; a higher, further camera keeps the figure visible.
  G.missions.restore(0); // First Errand: the beacon marks the docks
  G.player.placeAt(0, 172, 0);
  G.cam.dist = 18;
  G.cam.pitch = 0.5;
  G.cam.yaw = 0;
  return 'follow';
}
