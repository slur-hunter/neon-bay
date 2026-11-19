// createHud runs the whole 2D layer: money, wanted stars, health, speed,
// objective, clock, minimap, messages, title screen and pause menu.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const moneyEl = $('money');
  const starsEl = $('stars');
  const healthFill = $('healthFill');
  const speedEl = $('speed');
  const objectiveEl = $('objective');
  const clockEl = $('clock');
  const dayEl = $('day');
  const messageEl = $('message');
  const titleEl = $('title');
  const pauseEl = $('pause');
  const missionEl = $('missionList');
  const bustedEl = $('busted');
  const damageEl = $('damage');
  const minimap = $('minimap');
  const mctx = minimap.getContext('2d');
  let messageTimer = 0;

  function fmtMoney(n) {
    return '$' + Math.floor(n).toLocaleString('en-US');
  }

  return {
    showMessage(text, seconds = 3) {
      messageEl.textContent = text;
      messageEl.style.opacity = '1';
      messageTimer = seconds;
    },
    showTitle(hasSave) {
      titleEl.style.display = 'flex';
      $('continueBtn').style.display = hasSave ? 'block' : 'none';
    },
    hideTitle() { titleEl.style.display = 'none'; },
    showPause(show) { pauseEl.style.display = show ? 'flex' : 'none'; },
    showMissions(show) { missionEl.style.display = show ? 'block' : 'none'; },
    showBusted(show, reason) {
      bustedEl.style.display = show ? 'flex' : 'none';
      if (show) $('bustedText').textContent = reason;
    },
    flashDamage() {
      damageEl.style.opacity = '0.55';
      setTimeout(() => { damageEl.style.opacity = '0'; }, 120);
    },
    setMissionList(html) { missionEl.innerHTML = html; },
    update(dt, G) {
      if (messageTimer > 0) {
        messageTimer -= dt;
        if (messageTimer <= 0) messageEl.style.opacity = '0';
      }
      moneyEl.textContent = fmtMoney(G.money);
      starsEl.textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
      starsEl.style.color = G.wanted > 0 ? '#ff2d78' : '#8888aa';
      healthFill.style.width = Math.max(0, G.health) + '%';
      healthFill.style.background = G.health > 50 ? '#37e08b' : G.health > 25 ? '#ffb02e' : '#ff2d55';
      speedEl.textContent = G.inCar ? Math.round(Math.abs(G.inCar.speed) * 2.2) + ' km/h' : '';
      objectiveEl.textContent = G.objective || '';
      const mins = Math.floor(G.minutes % 1440);
      const hh = String(Math.floor(mins / 60)).padStart(2, '0');
      const mm = String(mins % 60).padStart(2, '0');
      clockEl.textContent = hh + ':' + mm;
      dayEl.textContent = 'DAY ' + G.day;
      // minimap: world [-240,240] -> 168px
      const S = 168;
      const toMap = (x) => ((x + 240) / 480) * S;
      mctx.fillStyle = '#101018';
      mctx.fillRect(0, 0, S, S);
      mctx.strokeStyle = '#3a3a55';
      mctx.lineWidth = 3;
      for (const r of [-180, -140, -100, -60, -20, 20, 60, 100, 140, 180]) {
        mctx.beginPath(); mctx.moveTo(toMap(r), 0); mctx.lineTo(toMap(r), S); mctx.stroke();
        mctx.beginPath(); mctx.moveTo(0, toMap(r)); mctx.lineTo(S, toMap(r)); mctx.stroke();
      }
      // beach and water
      mctx.fillStyle = '#b99b62';
      mctx.fillRect(0, toMap(190), S, toMap(240) - toMap(190));
      mctx.fillStyle = '#0a2a4a';
      mctx.fillRect(0, toMap(240), S, S - toMap(240));
      mctx.fillRect(toMap(240), 0, S - toMap(240), S);
      // mission marker
      if (G.marker) {
        const pulse = 5 + Math.sin(performance.now() / 300) * 2;
        mctx.fillStyle = '#ffd23e';
        mctx.beginPath();
        mctx.arc(toMap(G.marker.x), toMap(G.marker.z), pulse, 0, Math.PI * 2);
        mctx.fill();
        mctx.strokeStyle = '#fff';
        mctx.lineWidth = 1.5;
        mctx.stroke();
      }
      // police dots
      if (G.policeCars) {
        mctx.fillStyle = '#ff3355';
        for (const p of G.policeCars) {
          mctx.beginPath();
          mctx.arc(toMap(p.pos.x), toMap(p.pos.z), 3, 0, Math.PI * 2);
          mctx.fill();
        }
      }
      // player arrow
      const px = toMap(G.playerPos.x);
      const pz = toMap(G.playerPos.z);
      mctx.save();
      mctx.translate(px, pz);
      mctx.rotate(Math.atan2(Math.sin(G.playerHeading), Math.cos(G.playerHeading)) + Math.PI);
      mctx.fillStyle = '#00e5ff';
      mctx.beginPath();
      mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath();
      mctx.fill();
      mctx.restore();
    },
  };
}
