// hud.js — the DOM HUD (money, health, wanted stars, objective, prompts) and the
// Canvas 2D minimap (roads, player, cars, police, pedestrians, mission marker).
import { BLOCK_LINES, HALF, ROAD_LINES } from './city.js';

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: document.getElementById('hud'),
      money: document.getElementById('money'),
      healthfill: document.getElementById('healthfill'),
      stars: document.getElementById('stars'),
      objective: document.getElementById('objective'),
      objdist: document.getElementById('objdist'),
      speed: document.getElementById('speed'),
      speedunit: document.getElementById('speedunit'),
      prompt: document.getElementById('prompt'),
      toast: document.getElementById('toast'),
      banner: document.getElementById('banner'),
      minimap: document.getElementById('minimap'),
      vignette: document.getElementById('vignette'),
      fpsnote: document.getElementById('fpsnote'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastTimer = 0;
    this.bannerTimer = 0;
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  showToast(text) {
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    this.toastTimer = 4;
  }

  showBanner(big, sub) {
    this.el.banner.querySelector('.big').textContent = big;
    this.el.banner.querySelector('.sub').textContent = sub;
    this.el.banner.classList.remove('hidden');
    this.bannerTimer = 4;
  }

  update(dt) {
    const game = this.game;
    // In a staged screenshot the toast and banner must stay up for the shot.
    const staged = game.shots && game.shots.mode !== 0;
    if (!staged) {
      this.toastTimer -= dt;
      this.bannerTimer -= dt;
    }
    if (this.toastTimer <= 0) this.el.toast.classList.add('hidden');
    if (this.bannerTimer <= 0) this.el.banner.classList.add('hidden');
    this.el.money.textContent = '$' + game.money.toLocaleString('en-US');
    this.el.healthfill.style.width = Math.max(0, game.health) + '%';
    const stars = '★'.repeat(game.wanted) + '☆'.repeat(4 - game.wanted);
    this.el.stars.textContent = stars;
    this.el.objective.textContent = game.missions.objectiveText();
    const target = game.missions.targetPos();
    if (target) {
      const d = Math.hypot(game.player.pos.x - target.x, game.player.pos.z - target.z);
      this.el.objdist.textContent = 'Objective ' + Math.round(d) + ' m away · Debt left $' + Math.max(0, 1500 - game.money);
    } else {
      this.el.objdist.textContent = 'Debt left $' + Math.max(0, 1500 - game.money);
    }
    const speed = game.player.inCar && game.player.car ? Math.abs(game.player.car.speed) * 2.2 : 0;
    this.el.speed.textContent = String(Math.round(speed));
    this.el.speedunit.textContent = game.player.inCar ? 'mph' : 'on foot';
    // interaction prompt
    if (game.state === 'playing' && !game.player.inCar) {
      const car = game.vehicles.nearestCar(game.player.pos, 5, true);
      if (car) {
        this.el.prompt.innerHTML = 'Press <b>E</b> to steal the car';
        this.el.prompt.classList.remove('hidden');
      } else {
        this.el.prompt.classList.add('hidden');
      }
    } else if (game.state === 'playing' && game.player.inCar) {
      this.el.prompt.innerHTML = 'Press <b>E</b> to get out';
      this.el.prompt.classList.remove('hidden');
    } else {
      this.el.prompt.classList.add('hidden');
    }
    // red flash while being rammed
    const hurt = game.time - game.combat.lastHurtAt < 0.4;
    this.el.vignette.style.boxShadow = hurt
      ? 'inset 0 0 120px rgba(255, 30, 60, 0.55)'
      : 'inset 0 0 120px rgba(255, 30, 60, 0.0)';
    this.drawMinimap();
  }

  drawMinimap() {
    const ctx = this.mapCtx;
    const S = 180;
    const scale = S / (HALF * 2 + 40);
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#141a26';
    ctx.fillRect(0, 0, S, S);
    // blocks
    ctx.fillStyle = '#3a4152';
    for (const bx of BLOCK_LINES) {
      for (const bz of BLOCK_LINES) {
        const [mx, my] = toMap(bx - 20, bz - 20);
        ctx.fillRect(mx, my, 40 * scale, 40 * scale);
      }
    }
    // roads
    ctx.strokeStyle = '#5a6274';
    ctx.lineWidth = 12 * scale;
    for (const c of ROAD_LINES) {
      const [x1, y1] = toMap(-HALF, c);
      const [x2, y2] = toMap(HALF, c);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [x3, y3] = toMap(c, -HALF);
      const [x4, y4] = toMap(c, HALF);
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
    }
    // bay
    ctx.fillStyle = '#2a7fa8';
    const [bx0, by0] = toMap(-HALF, -HALF - 34);
    ctx.fillRect(bx0, by0, (HALF * 2) * scale, 34 * scale);
    const game = this.game;
    // mission marker
    const target = game.missions.targetPos();
    if (target) {
      const [mx, my] = toMap(target.x, target.z);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(mx, my - 7); ctx.lineTo(mx + 6, my); ctx.lineTo(mx, my + 7); ctx.lineTo(mx - 6, my);
      ctx.closePath(); ctx.fill();
    }
    // pedestrians
    ctx.fillStyle = '#9aa5b5';
    for (const w of game.pedestrians.walkers) {
      const [mx, my] = toMap(w.mesh.position.x, w.mesh.position.z);
      ctx.fillRect(mx - 1, my - 1, 2, 2);
    }
    // traffic
    ctx.fillStyle = '#e8e8e8';
    for (const c of game.vehicles.traffic) {
      const [mx, my] = toMap(c.mesh.position.x, c.mesh.position.z);
      ctx.beginPath(); ctx.arc(mx, my, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // police
    ctx.fillStyle = '#ff4040';
    for (const cop of game.police.cops) {
      const [mx, my] = toMap(cop.mesh.position.x, cop.mesh.position.z);
      ctx.beginPath(); ctx.arc(mx, my, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow
    const p = game.player.pos;
    const [px, py] = toMap(p.x, p.z);
    const heading = game.player.inCar && game.player.car ? game.player.car.heading : game.player.heading;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(heading), -Math.cos(heading)) + Math.PI);
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // north tick
    ctx.fillStyle = '#9fb4c8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', S / 2 - 3, 12);
  }
}
