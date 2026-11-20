// The HUD: stars, health, money, mission block (title + text + JOB x/4
// stage + NEXT line), police-response panel, dialogue box, speed, compass,
// minimap and the banner, plus the start / pause / game-over overlays.
// Every setter caches its last string and only touches the DOM on change,
// so the per-frame updates stay cheap.

export function createDisplay() {
  const el = (id) => document.getElementById(id);
  const starsEl = el('stars');
  const healthEl = el('healthbar');
  const moneyEl = el('money');
  const missionTitleEl = el('missionTitle');
  const missionTextEl = el('missionText');
  const stageEl = el('stageLine');
  const speedEl = el('speed');
  const bannerEl = el('banner');
  const compassEl = el('compass');
  const compassArrowEl = el('compassArrow');
  const compassDistEl = el('compassDist');
  const mapEl = el('minimap');
  const mapCtx = mapEl.getContext('2d');
  const policeEl = el('policePanel');
  const dialogueEl = el('dialogue');
  const dialogueNameEl = el('dialogueName');
  const dialogueTextEl = el('dialogueText');
  const startEl = el('start');
  const pauseEl = el('pause');
  const gameoverEl = el('gameover');
  const gameoverTextEl = el('gameoverText');
  const loadingEl = el('loading');
  const continueRowEl = el('continueRow');
  const continueMoneyEl = el('continueMoney');

  const cache = {};
  let bannerTimer = null;

  function setText(node, key, value) {
    if (cache[key] !== value) {
      cache[key] = value;
      node.textContent = value;
    }
  }

  function setHtml(node, key, value) {
    if (cache[key] !== value) {
      cache[key] = value;
      node.innerHTML = value;
    }
  }

  function setStars(n) {
    let html = '';
    for (let i = 0; i < 4; i++) {
      html += i < n ? '★' : '<span class="off">★</span>';
    }
    setHtml(starsEl, 'stars', html);
  }

  function setHealth(h) {
    const pct = Math.max(0, Math.min(100, Math.round(h)));
    const color = pct > 50 ? '#37c978' : pct > 25 ? '#f2c200' : '#d23c2e';
    const value = `${pct}%|${color}`;
    if (cache.health !== value) {
      cache.health = value;
      healthEl.style.width = `${pct}%`;
      healthEl.style.background = color;
    }
  }

  function setMoney(m) {
    setText(moneyEl, 'money', '$' + Number(m).toLocaleString('en-US'));
  }

  function setSpeed(mph) {
    setHtml(speedEl, 'speed', `${Math.round(mph)} <small>mph</small>`);
  }

  function setMission(title, text) {
    setText(missionTitleEl, 'missionTitle', title);
    setText(missionTextEl, 'missionText', text);
  }

  // "JOB 2/4" plus the next job's title, inside the mission block.
  function setStage(index, total, nextTitle) {
    setText(stageEl, 'stage', `JOB ${index}/${total} · NEXT: ${nextTitle}`);
  }

  // One line per cruiser: "REEF-12 · RAMMING · 24m". Hidden at wanted 0.
  function setPolice(units) {
    if (!units || units.length === 0) {
      if (cache.police !== '') {
        cache.police = '';
        policeEl.style.display = 'none';
      }
      return;
    }
    const html =
      '<div class="policeTitle">BAY CITY PD — RESPONSE</div>' +
      units.map((u) => `<div>${u.callsign} · ${u.role} · ${u.dist}m</div>`).join('');
    if (cache.police !== html) {
      cache.police = html;
      policeEl.innerHTML = html;
      policeEl.style.display = 'block';
    }
  }

  function setDialogue(name, text) {
    setText(dialogueNameEl, 'dialogueName', name);
    setText(dialogueTextEl, 'dialogueText', text);
  }

  function message(title, sub, ms) {
    const value = `${title}|${sub}`;
    if (cache.banner !== value) {
      cache.banner = value;
      bannerEl.innerHTML = `${title}<br><small>${sub}</small>`;
    }
    bannerEl.style.display = 'block';
    if (bannerTimer) window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => {
      bannerEl.style.display = 'none';
    }, ms ?? 2600);
  }

  function hideBanner() {
    bannerEl.style.display = 'none';
    if (bannerTimer) window.clearTimeout(bannerTimer);
  }

  function setCompass(angleRad, distM) {
    if (angleRad === null || angleRad === undefined) {
      if (cache.compass !== 'hidden') {
        cache.compass = 'hidden';
        compassEl.style.visibility = 'hidden';
      }
      return;
    }
    if (cache.compass !== 'shown') {
      cache.compass = 'shown';
      compassEl.style.visibility = 'visible';
    }
    compassArrowEl.style.transform = `rotate(${angleRad}rad)`;
    setText(compassDistEl, 'compassDist', `${Math.round(distM)}m`);
  }

  // The static map layer (roads + blocks) is drawn once to an offscreen
  // canvas; each frame only blits it and draws the moving markers, so the
  // minimap costs almost nothing at 60 fps.
  let staticLayer = null;
  let staticKey = '';
  function buildStaticLayer(state) {
    const size = 180;
    const half = state.half;
    const key = `${half}|${state.streets.join(',')}|${state.blocks.join(',')}`;
    if (staticLayer && staticKey === key) return staticLayer;
    staticKey = key;
    const layer = document.createElement('canvas');
    layer.width = size;
    layer.height = size;
    const ctx = layer.getContext('2d');
    const toMap = (v) => ((v + half) / (half * 2)) * size;
    ctx.fillStyle = '#0d1a2e';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#5a5148';
    for (const bx of state.blocks) {
      for (const bz of state.blocks) {
        ctx.fillRect(toMap(bx - 21), toMap(bz - 21), 42 / (half * 2) * size, 42 / (half * 2) * size);
      }
    }
    ctx.fillStyle = '#3a3f46';
    for (const s of state.streets) {
      ctx.fillRect(toMap(s - 7), 0, 14 / (half * 2) * size, size);
      ctx.fillRect(0, toMap(s - 7), size, 14 / (half * 2) * size);
    }
    staticLayer = layer;
    return layer;
  }

  // 180x180 minimap: roads, blocks, mission marker, traffic, police, player.
  function drawMinimap(state) {
    const size = 180;
    const half = state.half;
    const toMap = (v) => ((v + half) / (half * 2)) * size;
    mapCtx.drawImage(buildStaticLayer(state), 0, 0);
    if (state.mission && !state.missionDone) {
      mapCtx.fillStyle = '#ffd23f';
      mapCtx.beginPath();
      mapCtx.arc(toMap(state.mission.x), toMap(state.mission.z), 6, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.strokeStyle = '#ffffff';
      mapCtx.lineWidth = 1.5;
      mapCtx.stroke();
    }
    mapCtx.fillStyle = '#9fd8ff';
    for (const car of state.cars) {
      mapCtx.fillRect(toMap(car.x) - 2, toMap(car.z) - 2, 4, 4);
    }
    mapCtx.fillStyle = '#ff4444';
    for (const cop of state.police) {
      mapCtx.beginPath();
      mapCtx.arc(toMap(cop.x), toMap(cop.z), 3.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Player arrow, rotated by yaw.
    mapCtx.save();
    mapCtx.translate(toMap(state.player.x), toMap(state.player.z));
    mapCtx.rotate(state.player.yaw);
    mapCtx.fillStyle = '#37c978';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 5);
    mapCtx.lineTo(-5, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  function showStart() {
    startEl.style.display = 'flex';
  }
  function hideStart() {
    startEl.style.display = 'none';
  }
  function showPause() {
    pauseEl.style.display = 'flex';
  }
  function hidePause() {
    pauseEl.style.display = 'none';
  }
  function showGameOver(text) {
    gameoverTextEl.textContent = text;
    gameoverEl.style.display = 'flex';
  }
  function hideGameOver() {
    gameoverEl.style.display = 'none';
  }
  function hideLoading() {
    loadingEl.style.display = 'none';
  }
  function setContinue(money) {
    if (money > 0) {
      continueRowEl.style.display = 'block';
      setText(continueMoneyEl, 'continueMoney', '$' + Number(money).toLocaleString('en-US'));
    } else {
      continueRowEl.style.display = 'none';
    }
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
    setCompass,
    drawMinimap,
    showStart,
    hideStart,
    showPause,
    hidePause,
    showGameOver,
    hideGameOver,
    hideLoading,
    setContinue,
  };
}
