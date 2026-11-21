// HUD: every panel the screenshots show. Updates are cheap — a line is
// only touched when its text actually changes. The minimap redraws on a
// short throttle. All numbers come from live game state.
import { CITY_HALF, STREET_AT } from './city.js';

function el(id) { return document.getElementById(id); }

export function makeDisplay() {
  const cache = {};
  const set = (id, text) => {
    if (cache[id] !== text) { cache[id] = text; const n = el(id); if (n) n.textContent = text; }
  };
  const show = (id, on) => {
    const key = `show:${id}`;
    if (cache[key] !== on) {
      cache[key] = on;
      const n = el(id);
      if (n) n.style.display = on ? '' : 'none';
    }
  };
  const mini = el('minimap');
  const mctx = mini ? mini.getContext('2d') : null;
  let miniT = 0;

  function drawMinimap(px, pz, yaw, marker, traffic, cops, peds) {
    if (!mctx) return;
    const W = mini.width, H = mini.height;
    const px2 = (v) => ((v + CITY_HALF) / (CITY_HALF * 2)) * W;
    mctx.fillStyle = '#241d33';
    mctx.fillRect(0, 0, W, H);
    mctx.strokeStyle = '#6a6478';
    mctx.lineWidth = 6;
    for (const s of STREET_AT) {
      mctx.beginPath(); mctx.moveTo(0, px2(s)); mctx.lineTo(W, px2(s)); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(px2(s), 0); mctx.lineTo(px2(s), H); mctx.stroke();
    }
    if (marker) {
      mctx.fillStyle = '#ffc94d';
      mctx.beginPath(); mctx.arc(px2(marker.x), px2(marker.z), 5, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#ffc94d';
      mctx.lineWidth = 1.5;
      mctx.beginPath(); mctx.arc(px2(marker.x), px2(marker.z), 9, 0, Math.PI * 2); mctx.stroke();
    }
    mctx.fillStyle = '#8a8a9a';
    for (const c of traffic) mctx.fillRect(px2(c.x) - 1.5, px2(c.z) - 1.5, 3, 3);
    mctx.fillStyle = '#ff4050';
    for (const c of cops) {
      mctx.beginPath(); mctx.arc(px2(c.x), px2(c.z), 3.5, 0, Math.PI * 2); mctx.fill();
    }
    mctx.save();
    mctx.translate(px2(px), px2(pz));
    mctx.rotate(Math.atan2(Math.sin(yaw), Math.cos(yaw)));
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -9); mctx.lineTo(6, 6); mctx.lineTo(-6, 6); mctx.closePath();
    mctx.fill();
    mctx.restore();
  }

  return {
    update(s, dt) {
      // Top-left cluster: stars, health, money, rank, standing.
      const stars = '★'.repeat(s.wanted) + '☆'.repeat(Math.max(0, 4 - s.wanted));
      set('stars', stars);
      const hp = el('healthfill');
      if (hp) {
        const pct = Math.max(0, Math.round(s.health));
        if (cache.hp !== pct) {
          cache.hp = pct;
          hp.style.width = `${pct}%`;
          hp.style.background = pct > 55 ? '#57d977' : pct > 25 ? '#e8b23a' : '#e84a3a';
        }
      }
      set('money', `$${s.money}`);
      set('rankline', `RANK ${s.rank} · ${s.rp} RP`);
      set('districtline', `${s.district} · STANDING ${s.standing}`);
      // Mission block.
      set('jobtitle', s.jobTitle);
      set('jobtext', s.jobText);
      set('jobstage', `JOB ${s.jobIndex + 1}/4`);
      set('jobnext', `NEXT: ${s.nextTitle}`);
      // Police panel: one line per live unit, hidden at wanted 0.
      show('policepanel', s.wanted > 0 && s.police.length > 0);
      if (s.wanted > 0) {
        set('policelines', s.police.map((p) => `${p.callsign} · ${p.role} · ${Math.round(p.dist)}m`).join('\n'));
      }
      // Dialogue box.
      set('speaker', s.speaker);
      set('dialogue', s.story);
      // Speed + compass.
      set('speed', s.inCar ? `${Math.round(Math.abs(s.speed) * 2.2)} mph` : 'ON FOOT');
      const bearing = Math.atan2(s.marker.x - s.px, s.marker.z - s.pz);
      const arrow = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][Math.round(((bearing - s.yaw) % (Math.PI * 2) + Math.PI * 2) / (Math.PI / 4)) % 8];
      set('compass', `${arrow} ${Math.round(Math.hypot(s.marker.x - s.px, s.marker.z - s.pz))}m`);
      // Car-only rows.
      show('damagerow', s.inCar);
      if (s.inCar) {
        const dmg = Math.round(s.damage);
        if (cache.dmg !== dmg) {
          cache.dmg = dmg;
          const d = el('damagefill');
          if (d) {
            d.style.width = `${dmg}%`;
            d.style.background = dmg < 40 ? '#57d977' : dmg < 75 ? '#e8b23a' : '#e84a3a';
          }
        }
        set('damagelabel', `DAMAGE ${dmg}%`);
      }
      show('radiorow', s.inCar);
      if (s.inCar) set('radioline', `♪ ${s.station.name} — ${s.station.track}`);
      // Banner.
      show('banner', s.bannerT > 0);
      if (s.bannerT > 0) set('banner', s.banner);
      // Minimap, throttled.
      miniT += dt;
      if (miniT > 0.15) {
        miniT = 0;
        drawMinimap(s.px, s.pz, s.yaw, s.marker, s.traffic, s.police, s.peds);
      }
    },
    showOverlay(id) {
      for (const o of ['startov', 'pauseov', 'gameoverov', 'loadingov']) {
        const n = el(o);
        if (n) n.style.display = o === id ? 'flex' : 'none';
      }
    },
    hideOverlays() {
      for (const o of ['startov', 'pauseov', 'gameoverov', 'loadingov']) {
        const n = el(o);
        if (n) n.style.display = 'none';
      }
    },
    setContinue(on, label) {
      show('continuerow', on);
      if (on) set('continuelabel', label);
    },
  };
}
