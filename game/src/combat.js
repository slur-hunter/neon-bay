// combat.js — punching on foot, police ram damage, health, and game over.
export class Combat {
  constructor(game) {
    this.game = game;
    this.punchCooldown = 0;
    this.punchAnim = 0;
    this.crimeCooldown = 0;
    this.lastHurtAt = -10;
  }

  update(dt) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.punchAnim = Math.max(0, this.punchAnim - dt);
    this.crimeCooldown = Math.max(0, this.crimeCooldown - dt);
    const game = this.game;
    // Police rams hurt: the rate comes from the police system, already dt-scaled.
    const dmg = game.police.ramDamage;
    if (dmg > 0) {
      game.health -= dmg;
      this.lastHurtAt = game.time;
      game.effects.shake(0.35);
      game.effects.burst(game.player.pos, 0xff6a3d, 6);
      if (game.police.rammed) game.audio.thud();
      if (game.health <= 0) {
        game.health = 0;
        game.gameOver();
        return;
      }
    }
    // Slow health recovery once the heat is off and nobody has hit you lately.
    if (game.wanted === 0 && game.time - this.lastHurtAt > 5 && game.health > 0 && game.health < 100) {
      game.health = Math.min(100, game.health + 2 * dt);
    }
  }

  // A click on foot throws a punch at whatever is in front of the player.
  tryPunch() {
    const game = this.game;
    if (game.state !== 'playing' || game.player.inCar) return;
    if (this.punchCooldown > 0) return;
    this.punchCooldown = 0.4;
    this.punchAnim = 0.25;
    game.audio.thud();
    const p = game.player.pos;
    const heading = game.player.heading;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const ped = game.pedestrians.nearest(p, 2.6);
    if (ped) {
      const dx = ped.mesh.position.x - p.x, dz = ped.mesh.position.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      // only counts when the pedestrian is roughly in front of the player
      if ((dx * fx + dz * fz) / d > 0.2) {
        game.pedestrians.knockback(ped, dx / d, dz / d);
        game.effects.burst(ped.mesh.position, 0xffe9a8, 12);
        game.effects.shake(0.15);
        if (this.crimeCooldown <= 0) {
          this.crimeCooldown = 5;
          game.setWanted(Math.min(4, game.wanted + 1));
          game.hud.showToast('Someone saw that. The cops are coming.');
        }
      }
    }
  }
}
