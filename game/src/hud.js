// HUD: every panel the screenshots show, updated only when its content
// changes. All numbers come from live game state passed in each frame;
// nothing here is a constant pretending to be data.
import { STREET_LINES } from './city.js';

const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

export function makeHud(doc) {
  const el = (id) => doc.getElementById(id);
  const starsEl = el('stars');
  const healthEl = el('health-fill');
  const moneyEl = el('money');
  const rankEl = el('rank-rp');
  const districtEl = el('district');
  const policeEl = el('police-panel');
  const mTitle = el('mission-title');
  const mText = el('mission-text');
  const mStage = el('mission-stage');
  const mNext = el('mission-next');
  const dlgName = el('dialogue-name');
  const dlgText = el('dialogue-text');
  const speedEl = el('speed-box');
  const compassEl = el('compass');
  const radioEl = el('radio-line');
  const damageRow = el('damage-row');
  const damageEl = el('damage-fill');
  const damagePct = el('damage-pct');
  const bannerEl = el('banner');
  const soundEl = el('sound-pill');
  const mapCanvas = el('minimap');
  const mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null;

  const cache = {};

  function setText(node, key, value) {
    if (!node || cache[key] === value) return;
    cache[key] = value;
    node.textContent = value;
  }
  function setHtml(node, key, value) {
    if (!node || cache[key] === value) return;
    cache[key] = value;
    node.innerHTML = value;
  }

  function compassArrow(relAngle) {
    let a = relAngle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    const idx = Math.round(a / (Math.PI / 4));
    return ARROWS[((idx % 8) + 8) % 8];
  }

  function drawMinimap(s) {
    if (!mapCtx) return;
    const W = mapCanvas.width;
    const H = mapCanvas.height;
    const toMap = (x, z) => [((x + 200) / 400) * W, ((z + 200) / 400) * H];
    mapCtx.fillStyle = '#0d0d1a';
    mapCtx.fillRect(0, 0, W, H);
    mapCtx.strokeStyle = '#3a3a55';
    mapCtx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        mapCtx.strokeRect(
          ((STREET_LINES[i] + 8 + 200) / 400) * W,
          ((STREET_LINES[j] + 8 + 200) / 400) * H,
          ((44 / 400) * W), ((44 / 400) * H),
        );
      }
    }
    mapCtx.strokeStyle = '#8a8aa8';
    mapCtx.lineWidth = 2;
    for (const line of STREET_LINES) {
      const [x1, y1] = toMap(line, -200);
      const [x2, y2] = toMap(line, 200);
      mapCtx.beginPath(); mapCtx.moveTo(x1, y1); mapCtx.lineTo(x2, y2); mapCtx.stroke();
      const [a1, b1] = toMap(-200, line);
      const [a2, b2] = toMap(200, line);
      mapCtx.beginPath(); mapCtx.moveTo(a1, b1); mapCtx.lineTo(a2, b2); mapCtx.stroke();
    }
    if (s.marker) {
      const [mx, my] = toMap(s.marker.x, s.marker.z);
      mapCtx.fillStyle = '#ffd21f';
      mapCtx.beginPath(); mapCtx.arc(mx, my, 5, 0, Math.PI * 2); mapCtx.fill();
    }
    if (s.traffic) {
      mapCtx.fillStyle = '#cfcfdd';
      for (const t of s.traffic) {
        const [tx, ty] = toMap(t.x, t.z);
        mapCtx.fillRect(tx - 1, ty - 1, 2, 2);
      }
    }
    if (s.police) {
      mapCtx.fillStyle = '#3a7bff';
      for (const p of s.police) {
        const [px, py] = toMap(p.x, p.z);
        mapCtx.beginPath(); mapCtx.arc(px, py, 3, 0, Math.PI * 2); mapCtx.fill();
      }
    }
    if (s.player) {
      const [px, py] = toMap(s.player.x, s.player.z);
      mapCtx.save();
      mapCtx.translate(px, py);
      mapCtx.rotate(Math.atan2(Math.sin(s.player.yaw), Math.cos(s.player.yaw)) * -1 + Math.PI);
      mapCtx.fillStyle = '#ffffff';
      mapCtx.beginPath();
      mapCtx.moveTo(0, -6); mapCtx.lineTo(4, 5); mapCtx.lineTo(-4, 5); mapCtx.closePath();
      mapCtx.fill();
      mapCtx.restore();
    }
  }

  // s: {wanted, health, money, rank, rp, district, standing, policeUnits,
  // mission, stage, next, speaker, story, speedLabel, compassArrow,
  // compassDist, radio, damage, banner, soundOn, marker, player, traffic,
  // police}
  function update(s) {
    let stars = '';
    for (let i = 0; i < 4; i++) stars += i < s.wanted ? '★' : '☆';
    setText(starsEl, 'stars', stars);
    if (healthEl) {
      const pct = Math.max(0, Math.min(100, Math.round(s.health)));
      if (cache.health !== pct) {
        cache.health = pct;
        healthEl.style.width = `${pct}%`;
        healthEl.style.background = pct > 50 ? '#2fae5f' : pct > 25 ? '#ff9a3d' : '#e84a3a';
      }
    }
    setText(moneyEl, 'money', `$${s.money}`);
    setText(rankEl, 'rank', `RANK ${s.rank} · ${s.rp} RP`);
    setText(districtEl, 'district', `${s.district} · STANDING ${s.standing}`);
    if (policeEl) {
      const show = s.wanted > 0 && s.policeUnits && s.policeUnits.length > 0;
      if (cache.policeShow !== show) {
        cache.policeShow = show;
        policeEl.style.display = show ? 'block' : 'none';
      }
      if (show) {
        const html = s.policeUnits
          .map((u) => `${u.callsign} · ${u.role} · ${u.dist}m`).join('<br>');
        setHtml(policeEl, 'police', html);
      }
    }
    setText(mTitle, 'mtitle', s.mission.title);
    setText(mText, 'mtext', s.mission.text);
    setText(mStage, 'mstage', `JOB ${s.stage}`);
    setText(mNext, 'mnext', `NEXT: ${s.next}`);
    setText(dlgName, 'dname', s.speaker);
    setText(dlgText, 'dtext', s.story);
    setText(speedEl, 'speed', s.speedLabel);
    setText(compassEl, 'compass', `${s.compassArrow} ${s.compassDist}m`);
    if (radioEl) {
      const show = !!s.radio;
      if (cache.radioShow !== show) {
        cache.radioShow = show;
        radioEl.style.display = show ? 'block' : 'none';
      }
      if (show) setText(radioEl, 'radio', `♪ ${s.radio.name} — ${s.radio.track}`);
    }
    if (damageRow) {
      const show = s.damage !== null && s.damage !== undefined;
      if (cache.dmgShow !== show) {
        cache.dmgShow = show;
        damageRow.style.display = show ? 'block' : 'none';
      }
      if (show) {
        const pct = Math.round(s.damage);
        if (cache.dmg !== pct) {
          cache.dmg = pct;
          damageEl.style.width = `${pct}%`;
          damagePct.textContent = `DAMAGE ${pct}%`;
        }
      }
    }
    if (bannerEl) {
      const show = !!s.banner;
      if (cache.bannerShow !== show) {
        cache.bannerShow = show;
        bannerEl.style.display = show ? 'block' : 'none';
      }
      if (show) setText(bannerEl, 'banner', s.banner);
    }
    setText(soundEl, 'sound', s.soundOn ? 'SOUND ON' : 'SOUND OFF');
    drawMinimap(s);
  }

  function show(id) {
    const n = el(id);
    if (n) n.style.display = 'block';
  }
  function hide(id) {
    const n = el(id);
    if (n) n.style.display = 'none';
  }

  return { update, show, hide, compassArrow };
}
