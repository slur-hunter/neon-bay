// shots.js — stages the four ?shot= scenes for the screenshots and tells the page
// when a shot is ready. Readiness uses REAL time (performance.now), never game time,
// and waits at least 4 seconds after the scene loads.
export class Shots {
  constructor(game) {
    this.game = game;
    this.mode = 0;
    this.bootTime = performance.now();
    this.frames = 0;
    this.staged = false;
  }

  parse() {
    const params = new URLSearchParams(window.location.search);
    const shot = parseInt(params.get('shot') || '0', 10);
    this.mode = Number.isFinite(shot) ? shot : 0;
    const seed = parseInt(params.get('seed') || '7', 10);
    return { shot: this.mode, seed: Number.isFinite(seed) ? seed : 7 };
  }

  // Put the world into the staged state for the requested shot.
  stage() {
    if (this.staged || this.mode === 0) return;
    this.staged = true;
    const game = this.game;
    if (this.mode === 1) {
      // Start screen over a wide city view. The menu overlay stays up.
      game.setCinematicCamera();
      return;
    }
    game.startGame();
    if (this.mode === 2) {
      // Driving down a street with traffic around.
      const car = game.debug.enterSpawnCar();
      if (car) {
        car.speed = 14;
        car.heading = Math.PI / 2; // east along the z=26 road
        car.mesh.rotation.y = car.heading;
        car.mesh.position.set(0, 0, 26);
        game.player.camYaw = car.heading + Math.PI;
      }
      game.hud.showToast('Neon Bay — drive anywhere. Steal any car. Watch the stars.');
      this.snapChaseCamera();
    } else if (this.mode === 3) {
      // Police chase: 4 stars, cop cars ahead and behind the player, light bars on.
      // The two ahead face the player so their light bars show in the chase camera.
      const car = game.debug.enterSpawnCar();
      if (car) {
        car.speed = 20;
        car.heading = Math.PI / 2;
        car.mesh.rotation.y = car.heading;
        car.mesh.position.set(-30, 0, 26);
        game.player.camYaw = car.heading + Math.PI;
      }
      game.setWanted(4);
      game.police.update(0.5, game.player.pos, 0, 0, 4);
      const p = game.player.pos;
      const f = { x: Math.sin(game.player.car.heading), z: Math.cos(game.player.car.heading) };
      const spots = [
        { ahead: 16, side: 5, face: Math.PI },
        { ahead: 22, side: -4, face: Math.PI },
        { ahead: -12, side: 0, face: 0 },
      ];
      game.police.cops.forEach((cop, i) => {
        const s = spots[i % spots.length];
        cop.mesh.position.set(
          p.x + f.x * s.ahead - f.z * s.side,
          0,
          p.z + f.z * s.ahead + f.x * s.side,
        );
        cop.heading = game.player.car.heading + s.face;
        cop.mesh.rotation.y = cop.heading;
        cop.speed = 22;
      });
      game.hud.showToast('4 stars — the whole Neon Bay force is on you. Lose them!');
      this.snapChaseCamera();
    } else if (this.mode === 4) {
      // Mission complete: Rex on foot at the pier, the payout banner up.
      game.money = 200;
      game.missions.index = 1;
      game.missions.placeBeacon();
      game.player.mesh.position.set(0, 0, -128);
      game.player.heading = Math.PI;
      game.player.mesh.rotation.y = Math.PI;
      game.player.camYaw = 0;
      game.effects.burst(game.player.pos, 0xffd23e, 40);
      game.hud.showBanner('MISSION COMPLETE', 'Job 1 — Dock Pickup  ·  +$200');
      game.hud.showToast('Sal Vane: “Good. 1 of 4 jobs done.”');
      this.snapFootCamera();
    }
  }

  // The headless renderer runs at a few frames a second, so a lerped camera never
  // reaches its place before the shot is taken. Snap it to the staged position now.
  snapChaseCamera() {
    const game = this.game;
    const car = game.player.car;
    if (!car) return;
    const f = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
    const cam = game.camera;
    cam.position.set(
      car.mesh.position.x - f.x * 11, 4.6,
      car.mesh.position.z - f.z * 11,
    );
    cam.lookAt(
      car.mesh.position.x + f.x * 7, 1.4,
      car.mesh.position.z + f.z * 7,
    );
  }

  snapFootCamera() {
    const game = this.game;
    const p = game.player;
    const cam = game.camera;
    cam.position.set(
      p.pos.x + Math.sin(p.camYaw) * 7.5,
      3.2 + p.camPitch * 4,
      p.pos.z + Math.cos(p.camYaw) * 7.5,
    );
    cam.lookAt(p.pos.x, 1.6, p.pos.z);
  }

  // Called every frame; flips window.__shotReady once the scene is staged,
  // rendered a few times, and 4 real seconds have passed since load.
  tick() {
    this.frames += 1;
    if (this.mode === 0) {
      window.__shotReady = true;
      return;
    }
    const elapsed = performance.now() - this.bootTime;
    if (this.staged && this.frames >= 3 && elapsed >= 4000) {
      window.__shotReady = true;
    }
  }
}
