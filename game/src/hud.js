// The HUD: every panel is fed by live game data, and the DOM is only touched
// when a value actually changes. The compass (arrow + live distance to the
// marker) is always visible, in every shot.
import { SPEAKERS } from './jobs.js';

const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

function arrowFor(relAngle) {
  const idx = Math.round(relAngle / (Math.PI / 4)) % 8;
  return ARROWS[(idx + 8) % 8];
}

export class Hud {
  constructor(doc) {
    this.el = {};
    const ids = [
      'stars', 'healthfill', 'money', 'rank', 'standing', 'police', 'mission-title',
      'mission-text', 'mission-stage', 'mission-next', 'speedbox', 'compass',
      'radio', 'damage', 'damagefill', 'dialogue', 'banner', 'minimap', 'sound',
      'start-overlay', 'pause-overlay', 'over-overlay', 'continue-row',
      'start-money', 'start-mission',
    ];
    for (const id of ids) this.el[id] = doc.getElementById(id);
    this.last = {};
    this.mapTimer = 0;
  }

  set(id, value) {
    if (this.last[id] === value) return;
    this.last[id] = value;
    const node = this.el[id];
    if (node) node.textContent = value;
  }

  show(id, visible) {
    const key = id + ':vis';
    if (this.last[key] === visible) return;
    this.last[key] = visible;
    const node = this.el[id];
    // use an explicit display value: the stylesheet hides these panels by
    // default, so an empty inline value would fall back to hidden
    if (node) node.style.display = visible ? 'block' : 'none';
  }

  update(G, dt) {
    const jobs = G.jobs;
    const job = jobs.current;
    // wanted stars
    let stars = '';
    for (let i = 0; i < 4; i++) stars += i < G.police.wanted ? '★' : '☆';
    this.set('stars', stars);
    this.set('money', '$' + jobs.money);
    this.set('rank', 'RANK ' + jobs.rank + ' · ' + jobs.rp + ' RP');
    this.set('standing', jobs.district + ' · STANDING ' + jobs.standing);
    // health bar
    const hp = Math.max(0, Math.round(G.health));
    if (this.last.health !== hp) {
      this.last.health = hp;
      const fill = this.el.healthfill;
      if (fill) {
        fill.style.width = hp + '%';
        fill.style.background = hp > 50 ? '#37d67a' : hp > 25 ? '#f2c230' : '#e23b2e';
      }
    }
    // police panel
    const panel = G.police.panel();
    const panelText = panel.map((u) => u.name + ' · ' + u.role + ' · ' + u.dist + 'm').join('\n');
    this.set('police', panelText);
    this.show('police', panel.length > 0);
    // mission block
    this.set('mission-title', job.title);
    this.set('mission-text', job.text);
    this.set('mission-stage', 'JOB ' + Math.min(jobs.index + 1, 4) + '/4');
    this.set('mission-next', jobs.finished ? 'Debt settled — free roam' : 'NEXT: ' + jobs.nextTitle);
    // speed / on foot + compass (always visible, live distance)
    const marker = job.marker;
    const px = G.inCar ? G.car.pos.x : G.hero.pos.x;
    const pz = G.inCar ? G.car.pos.z : G.hero.pos.z;
    const dx = marker[0] - px;
    const dz = marker[1] - pz;
    const dist = Math.round(Math.hypot(dx, dz));
    const bearing = Math.atan2(dx, dz);
    const rel = bearing - G.camYaw;
    this.set('compass', arrowFor(rel) + ' ' + dist + 'm');
    if (G.inCar) {
      const mph = Math.round(Math.abs(G.car.speed) * 2.237);
      this.set('speedbox', mph + ' mph');
    } else {
      this.set('speedbox', 'ON FOOT');
    }
    // radio + damage (car only)
    if (G.inCar) {
      const st = G.sound.stationInfo;
      this.set('radio', '♪ ' + st.name + ' — ' + st.track);
      this.show('radio', true);
      const dmg = Math.round(G.car.damage);
      if (this.last.damage !== dmg) {
        this.last.damage = dmg;
        const fill = this.el.damagefill;
        if (fill) fill.style.width = dmg + '%';
      }
      this.set('damage', 'DAMAGE ' + dmg + '%');
      this.show('damage', true);
    } else {
      this.show('radio', false);
      this.show('damage', false);
    }
    // dialogue: current job's own story line
    this.set('dialogue', SPEAKERS[job.speaker] + '\n' + job.story);
    // banner
    this.show('banner', G.bannerTimer > 0);
    if (G.bannerTimer > 0 && this.last.bannerText !== G.bannerText) {
      this.last.bannerText = G.bannerText;
      const b = this.el.banner;
      if (b) b.textContent = G.bannerText;
    }
    // sound state
    this.set('sound', G.sound.muted ? 'SOUND OFF' : 'SOUND ON');
    // minimap, throttled
    this.mapTimer -= dt;
    if (this.mapTimer <= 0) {
      this.mapTimer = 0.12;
      this.drawMinimap(G, px, pz);
    }
  }

  drawMinimap(G, px, pz) {
    const cv = this.el.minimap;
    if (!cv) return;
    const g = cv.getContext('2d');
    const S = cv.width;
    const scale = S / 430;
    const toX = (x) => S / 2 + x * scale;
    const toY = (z) => S / 2 + z * scale;
    g.fillStyle = '#14101f';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = '#5a4a68';
    g.lineWidth = 2;
    for (let k = -3; k <= 3; k++) {
      const c = k * 52;
      g.beginPath();
      g.moveTo(toX(c), 0);
      g.lineTo(toX(c), S);
      g.stroke();
      g.beginPath();
      g.moveTo(0, toY(c));
      g.lineTo(S, toY(c));
      g.stroke();
    }
    // mission marker
    const job = G.jobs.current;
    g.fillStyle = '#ffd23e';
    g.beginPath();
    g.arc(toX(job.marker[0]), toY(job.marker[1]), 5, 0, Math.PI * 2);
    g.fill();
    // traffic
    g.fillStyle = '#8ad0ff';
    for (const m of G.traffic.movers) {
      const x = m.axis === 'x' ? m.along : m.lane;
      const z = m.axis === 'x' ? m.lane : m.along;
      g.fillRect(toX(x) - 1.5, toY(z) - 1.5, 3, 3);
    }
    // police
    g.fillStyle = '#ff4040';
    for (const c of G.police.cruisers) {
      g.beginPath();
      g.arc(toX(c.x), toY(c.z), 3, 0, Math.PI * 2);
      g.fill();
    }
    // player arrow
    const yaw = G.inCar ? G.car.yaw : G.hero.yaw;
    g.save();
    g.translate(toX(px), toY(pz));
    g.rotate(Math.atan2(Math.sin(yaw), -Math.cos(yaw)));
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4.5, 5);
    g.lineTo(-4.5, 5);
    g.closePath();
    g.fill();
    g.restore();
  }
}
