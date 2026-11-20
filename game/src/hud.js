// hud.js — the HUD: wanted stars, health, money, mission text with its stage
// and next step, a police-response panel, a dialogue box, speed, and a Canvas
// 2D minimap (player, cars, police, mission marker), plus the overlays.
import { CITY } from './city.js';

export function createHud() {
  const starsEl = document.getElementById('stars');
  const healthEl = document.getElementById('healthbar');
  const moneyEl = document.getElementById('money');
  const missionEl = document.getElementById('mission');
  const stageEl = document.getElementById('stage');
  const speedEl = document.getElementById('speed');
  const bannerEl = document.getElementById('banner');
  const compassArrowEl = document.getElementById('compassArrow');
  const compassDistEl = document.getElementById('compassDist');
  const policeEl = document.getElementById('policePanel');
  const policeListEl = document.getElementById('policeList');
  const dialogueEl = document.getElementById('dialogue');
  const dialogueNameEl = document.getElementById('dialogueName');
  const dialogueTextEl = document.getElementById('dialogueText');
  const minimap = document.getElementById('minimap');
  const mm = minimap.getContext('2d');
  const startEl = document.getElementById('start');
  const pauseEl = document.getElementById('pause');
  const gameoverEl = document.getElementById('gameover');
  const loadingEl = document.getElementById('loading');

  let bannerTimer = null;
  let lastPoliceHtml = null;
  let lastDialogueKey = null;
  let lastStageHtml = null;

  function setStars(n) {
    let html = '';
    for (let i = 0; i < 4; i++) {
      html += i < n ? '★' : '<span class="off">★</span>';
    }
    starsEl.innerHTML = html;
  }

  function setHealth(h) {
    const pct = Math.max(0, Math.min(100, h));
    healthEl.style.width = pct + '%';
    healthEl.style.background = pct > 50
      ? 'linear-gradient(90deg,#37d67a,#9be15d)'
      : pct > 25 ? 'linear-gradient(90deg,#f2c200,#ff9c1a)' : 'linear-gradient(90deg,#e23c2e,#ff7a5c)';
  }

  function setMoney(m) {
    moneyEl.textContent = '$' + m.toLocaleString('en-US');
  }

  function setSpeed(mph) {
    speedEl.innerHTML = Math.round(mph) + ' <small>mph</small>';
  }

  function setMission(html) {
    missionEl.innerHTML = html;
  }

  // Stage line under the mission text: "JOB 2/4" and the next job's title.
  // The DOM is touched only when the line actually changes.
  function setStage(index, total, nextTitle) {
    const html = '<b>JOB ' + index + '/' + total + '</b><br>NEXT: ' + nextTitle;
    if (html === lastStageHtml) return;
    lastStageHtml = html;
    stageEl.innerHTML = html;
  }

  // Police-response panel: one line per active cruiser, callsign, live role
  // and distance. Hidden while the heat is off. Rebuilt only when a unit's
  // line changes, so the per-frame call costs nothing when the chase is steady.
  function setPolice(units) {
    if (!units || units.length === 0) {
      if (lastPoliceHtml !== '') {
        lastPoliceHtml = '';
        policeEl.style.display = 'none';
      }
      return;
    }
    const html = units.map((u) =>
      '<div>' + u.callsign + ' &middot; ' + u.role + ' &middot; ' + u.dist + 'm</div>').join('');
    if (html === lastPoliceHtml) return;
    lastPoliceHtml = html;
    policeEl.style.display = 'block';
    policeListEl.innerHTML = html;
  }

  // Dialogue box: a named character speaks the current job's own story line.
  // The DOM is touched only when the speaker or the line changes.
  function setDialogue(name, text) {
    const key = name + '\n' + text;
    if (key === lastDialogueKey) return;
    lastDialogueKey = key;
    dialogueNameEl.textContent = name;
    dialogueTextEl.textContent = text;
    dialogueEl.style.display = 'block';
  }

  function message(title, sub, ms) {
    bannerEl.innerHTML = title + (sub ? '<small>' + sub + '</small>' : '');
    bannerEl.style.display = 'block';
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { bannerEl.style.display = 'none'; }, ms || 2600);
  }

  function hideBanner() {
    bannerEl.style.display = 'none';
  }

  // Compass: an arrow pointing toward the mission marker relative to the
  // camera, with the distance in metres. Hidden once the debt is paid.
  function setCompass(angleRad, distM) {
    if (angleRad === null) {
      compassArrowEl.style.display = 'none';
      compassDistEl.textContent = '';
      return;
    }
    compassArrowEl.style.display = 'inline-block';
    compassArrowEl.style.transform = 'rotate(' + angleRad + 'rad)';
    compassDistEl.textContent = Math.round(distM) + 'm';
  }

  // Minimap: roads, blocks, player arrow, cars, police, mission marker.
  function drawMinimap(state) {
    const S = 180;
    const half = CITY.half;
    const toMap = (x, z) => [((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S];
    mm.clearRect(0, 0, S, S);
    mm.fillStyle = '#0d1a2e';
    mm.fillRect(0, 0, S, S);
    // Roads.
    mm.fillStyle = '#3a3f46';
    for (const s of CITY.streetCenters) {
      const [px] = toMap(s, 0);
      const [, pz] = toMap(0, s);
      mm.fillRect(px - 4, 0, 8, S);
      mm.fillRect(0, pz - 4, S, 8);
    }
    // Blocks.
    mm.fillStyle = '#5a5148';
    for (const bx of CITY.blockCenters) {
      for (const bz of CITY.blockCenters) {
        const [x, y] = toMap(bx - CITY.block / 2, bz - CITY.block / 2);
        const w = (CITY.block / (half * 2)) * S;
        mm.fillRect(x, y, w, w);
      }
    }
    // Mission marker.
    if (state.mission && !state.missionDone) {
      const [x, y] = toMap(state.mission.x, state.mission.z);
      mm.fillStyle = '#ffd23f';
      mm.beginPath();
      mm.arc(x, y, 6, 0, Math.PI * 2);
      mm.fill();
      mm.strokeStyle = '#fff';
      mm.lineWidth = 2;
      mm.stroke();
    }
    // Traffic and parked cars.
    mm.fillStyle = '#9fd8ff';
    for (const c of state.cars || []) {
      const [x, y] = toMap(c.pos.x, c.pos.z);
      mm.fillRect(x - 2, y - 2, 4, 4);
    }
    // Police.
    mm.fillStyle = '#ff4d4d';
    for (const c of state.police || []) {
      const [x, y] = toMap(c.pos.x, c.pos.z);
      mm.beginPath();
      mm.arc(x, y, 3.5, 0, Math.PI * 2);
      mm.fill();
    }
    // Player arrow.
    const [px, py] = toMap(state.player.x, state.player.z);
    mm.save();
    mm.translate(px, py);
    mm.rotate(Math.atan2(Math.sin(state.player.yaw), Math.cos(state.player.yaw)) * -1 + Math.PI);
    mm.fillStyle = '#7dff9b';
    mm.beginPath();
    mm.moveTo(0, -7);
    mm.lineTo(5, 6);
    mm.lineTo(-5, 6);
    mm.closePath();
    mm.fill();
    mm.restore();
  }

  return {
    setStars,
    setHealth,
    setMoney,
    setSpeed,
    setMission,
    setStage,
    setPolice,
    setDialogue,
    message,
    hideBanner,
    drawMinimap,
    setCompass,
    showStart() { startEl.style.display = 'flex'; pauseEl.style.display = 'none'; gameoverEl.style.display = 'none'; },
    hideStart() { startEl.style.display = 'none'; },
    showPause() { pauseEl.style.display = 'flex'; },
    hidePause() { pauseEl.style.display = 'none'; },
    showGameOver(text) {
      document.getElementById('gameoverText').textContent = text;
      gameoverEl.style.display = 'flex';
    },
    hideGameOver() { gameoverEl.style.display = 'none'; },
    hideLoading() { loadingEl.style.display = 'none'; },
    setContinue(money) {
      document.getElementById('continueRow').style.display = money > 0 ? 'block' : 'none';
      document.getElementById('continueMoney').textContent = money;
    },
  };
}
