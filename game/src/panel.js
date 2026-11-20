// Neon Bay v7 — the HUD. Stars, health, money, mission block with its stage and
// NEXT line, the police-response panel, the dialogue box, speed, compass, minimap
// and the overlays. Every setter caches its last value and only touches the DOM
// when the content actually changes, so the per-frame updates stay cheap.
import { GRID } from './metropolis.js';

export function createPanel() {
  const $ = (id) => document.getElementById(id);
  const els = {
    stars: $('stars'), health: $('healthbar'), money: $('money'),
    mission: $('mission'), stage: $('stageLine'),
    police: $('policePanel'), policeList: $('policeList'),
    dialogue: $('dialogue'), dialogueName: $('dialogueName'), dialogueText: $('dialogueText'),
    speed: $('speed'), compass: $('compass'), compassArrow: $('compassArrow'), compassDist: $('compassDist'),
    minimap: $('minimap'), banner: $('banner'), bannerTitle: $('bannerTitle'), bannerSub: $('bannerSub'),
    start: $('start'), pause: $('pause'), gameover: $('gameover'), loading: $('loading'),
    continueRow: $('continueRow'), continueMoney: $('continueMoney'), gameoverText: $('gameoverText'),
  };
  const last = {};
  let bannerTimer = null;

  function setText(el, key, value) {
    if (last[key] === value) return;
    last[key] = value;
    el.innerHTML = value;
  }

  function setStars(n) {
    let html = '';
    for (let i = 0; i < 4; i++) {
      html += i < n ? '★' : '<span class="off">★</span>';
    }
    setText(els.stars, 'stars', html);
  }

  function setHealth(h) {
    const v = Math.max(0, Math.min(100, Math.round(h)));
    if (last.health === v) return;
    last.health = v;
    els.health.style.width = v + '%';
    els.health.style.background = v > 50
      ? 'linear-gradient(90deg,#37c978,#7dff9b)'
      : v > 25 ? 'linear-gradient(90deg,#f2c200,#ffd23f)' : 'linear-gradient(90deg,#d23c2e,#ff6b5e)';
  }

  function setMoney(m) {
    setText(els.money, 'money', '$' + Math.round(m).toLocaleString('en-US'));
  }

  function setSpeed(mph) {
    setText(els.speed, 'speed', Math.round(mph) + ' <small>mph</small>');
  }

  function setMission(html) {
    setText(els.mission, 'mission', html);
  }

  // Stage + NEXT line inside the mission block.
  function setStage(index, total, nextTitle) {
    setText(els.stage, 'stage', `JOB ${index}/${total} &nbsp;·&nbsp; NEXT: ${nextTitle}`);
  }

  // Police-response panel: one line per active cruiser. Hidden at wanted 0.
  function setPolice(units) {
    if (!units || units.length === 0) {
      if (last.police !== '') { last.police = ''; els.police.style.display = 'none'; }
      return;
    }
    const html = units.map((u) => `${u.callsign} · ${u.role} · ${u.dist}m`).join('<br>');
    if (last.police === html) return;
    last.police = html;
    els.policeList.innerHTML = html;
    els.police.style.display = 'block';
  }

  function setDialogue(name, text) {
    const key = name + '|' + text;
    if (last.dialogue === key) return;
    last.dialogue = key;
    els.dialogueName.textContent = name;
    els.dialogueText.textContent = text;
  }

  function message(title, sub, ms) {
    els.bannerTitle.textContent = title;
    els.bannerSub.textContent = sub || '';
    els.banner.style.display = 'block';
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { els.banner.style.display = 'none'; }, ms || 2600);
  }

  function hideBanner() {
    if (bannerTimer) clearTimeout(bannerTimer);
    els.banner.style.display = 'none';
  }

  function setCompass(angleRad, distM) {
    if (angleRad === null || angleRad === undefined) {
      if (last.compass !== 'off') { last.compass = 'off'; els.compass.style.display = 'none'; }
      return;
    }
    if (last.compass !== 'on') { last.compass = 'on'; els.compass.style.display = 'block'; }
    const deg = Math.round(angleRad * 180 / Math.PI);
    if (last.compassDeg !== deg) {
      last.compassDeg = deg;
      els.compassArrow.style.transform = `rotate(${deg}deg)`;
    }
    setText(els.compassDist, 'compassDist', Math.round(distM) + 'm');
  }

  // Minimap: static roads+blocks drawn once to an offscreen canvas, blitted each
  // frame, then the moving pieces (marker, cars, police, player) on top.
  let staticLayer = null;
  function toMap(x, z) {
    const s = 180 / (GRID.half * 2);
    return [(x + GRID.half) * s, (z + GRID.half) * s];
  }
  function drawMinimap(state) {
    const cv = els.minimap;
    const g = cv.getContext('2d');
    if (!staticLayer) {
      staticLayer = document.createElement('canvas');
      staticLayer.width = 180; staticLayer.height = 180;
      const s = staticLayer.getContext('2d');
      s.fillStyle = '#0d1a2e';
      s.fillRect(0, 0, 180, 180);
      s.fillStyle = '#5a5148';
      for (const bx of GRID.blockCenters) {
        for (const bz of GRID.blockCenters) {
          const [x, y] = toMap(bx - GRID.blockSize / 2, bz - GRID.blockSize / 2);
          s.fillRect(x, y, GRID.blockSize * (180 / (GRID.half * 2)), GRID.blockSize * (180 / (GRID.half * 2)));
        }
      }
      s.strokeStyle = '#3a3f46';
      s.lineWidth = 6;
      for (const c of GRID.streetCenters) {
        const [x] = toMap(c, 0);
        s.beginPath(); s.moveTo(x, 0); s.lineTo(x, 180); s.stroke();
        const [, y] = toMap(0, c);
        s.beginPath(); s.moveTo(0, y); s.lineTo(180, y); s.stroke();
      }
    }
    g.drawImage(staticLayer, 0, 0);
    if (state.mission && !state.missionDone) {
      const [mx, my] = toMap(state.mission.x, state.mission.z);
      g.fillStyle = '#ffd23f';
      g.beginPath(); g.arc(mx, my, 6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(mx, my, 6, 0, Math.PI * 2); g.stroke();
    }
    for (const c of state.cars || []) {
      const [x, y] = toMap(c.x, c.z);
      g.fillStyle = '#9fd8ff';
      g.fillRect(x - 2, y - 2, 4, 4);
    }
    for (const p of state.police || []) {
      const [x, y] = toMap(p.x, p.z);
      g.fillStyle = '#ff4444';
      g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill();
    }
    const [px, py] = toMap(state.player.x, state.player.z);
    g.save();
    g.translate(px, py);
    g.rotate(state.playerYaw || 0);
    g.fillStyle = '#37c978';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath(); g.fill();
    g.restore();
  }

  function showStart() { els.start.style.display = 'flex'; }
  function hideStart() { els.start.style.display = 'none'; }
  function showPause() { els.pause.style.display = 'flex'; }
  function hidePause() { els.pause.style.display = 'none'; }
  function showGameOver(text) { els.gameoverText.textContent = text; els.gameover.style.display = 'flex'; }
  function hideGameOver() { els.gameover.style.display = 'none'; }
  function hideLoading() { els.loading.style.display = 'none'; }
  function setContinue(money) {
    if (money > 0) {
      els.continueRow.style.display = 'block';
      els.continueMoney.textContent = '$' + Math.round(money).toLocaleString('en-US');
    } else {
      els.continueRow.style.display = 'none';
    }
  }

  return {
    setStars, setHealth, setMoney, setSpeed, setMission, setStage, setPolice,
    setDialogue, message, hideBanner, setCompass, drawMinimap,
    showStart, hideStart, showPause, hidePause, showGameOver, hideGameOver,
    hideLoading, setContinue,
  };
}
