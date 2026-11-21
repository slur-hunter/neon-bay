// HUD for Neon Bay: every readout is driven by live game state, never a
// static label. The density bundle lives here: armour bar, clock, car name
// with condition and gear, mission timer, stage progress bar, rank name
// with a respect bar, and a dialogue portrait drawn on a canvas.
import { formatTimer } from './jobs.js';

function el(id) {
  return document.getElementById(id);
}

export function drawPortrait(canvas, speaker) {
  if (!canvas) return;
  const g = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#2a2233';
  g.fillRect(0, 0, w, h);
  // Face.
  g.fillStyle = '#e8b98a';
  g.beginPath();
  g.arc(w / 2, h * 0.52, w * 0.3, 0, Math.PI * 2);
  g.fill();
  // Hat.
  g.fillStyle = '#1c1c2e';
  g.fillRect(w * 0.18, h * 0.16, w * 0.64, h * 0.16);
  g.fillRect(w * 0.1, h * 0.3, w * 0.8, h * 0.07);
  g.fillStyle = '#ffd23e';
  g.fillRect(w * 0.18, h * 0.28, w * 0.64, h * 0.045);
  // Eyes.
  g.fillStyle = '#1c1c2e';
  g.beginPath();
  g.arc(w * 0.4, h * 0.52, w * 0.045, 0, Math.PI * 2);
  g.arc(w * 0.6, h * 0.52, w * 0.045, 0, Math.PI * 2);
  g.fill();
  // Moustache and ledger book.
  g.fillStyle = '#3a2a1a';
  g.fillRect(w * 0.36, h * 0.66, w * 0.28, h * 0.06);
  g.fillStyle = '#e8dcc0';
  g.fillRect(w * 0.14, h * 0.82, w * 0.72, h * 0.14);
  g.strokeStyle = '#7a6a4a';
  g.lineWidth = 1;
  g.strokeRect(w * 0.14, h * 0.82, w * 0.72, h * 0.14);
  void speaker;
}

export function formatClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function setBar(fillEl, pct) {
  if (fillEl) fillEl.style.width = Math.max(0, Math.min(100, pct)) + '%';
}

function compassArrow(angleRad) {
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  const idx = Math.round(((angleRad % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 4)) % 8;
  return arrows[idx];
}

export function updateHud(s) {
  const stars = el('stars');
  if (stars) {
    let text = '';
    for (let i = 0; i < 4; i += 1) text += i < s.wanted ? '★' : '☆';
    stars.textContent = text;
  }
  setBar(el('health-fill'), s.health);
  const hn = el('health-num');
  if (hn) hn.textContent = 'HEALTH ' + Math.round(s.health);
  setBar(el('armour-fill'), s.armour);
  const an = el('armour-num');
  if (an) an.textContent = 'ARMOUR ' + Math.round(s.armour);
  const money = el('money');
  if (money) money.textContent = '$' + s.money.toLocaleString('en-US');
  const rankName = el('rank-name');
  if (rankName) rankName.textContent = 'RANK ' + s.rankInfo.rank + ' · ' + s.rankInfo.name;
  setBar(el('rp-fill'), s.rankInfo.pct);
  const rpNum = el('rp-num');
  if (rpNum) rpNum.textContent = s.rankInfo.cur + ' / ' + s.rankInfo.next + ' RP';
  const district = el('district');
  if (district) district.textContent = s.district.toUpperCase() + ' · STANDING ' + s.standing;
  const clock = el('clock');
  if (clock) clock.textContent = formatClock(s.clockMinutes);
  const mt = el('mission-title');
  if (mt) mt.textContent = s.job.title.toUpperCase();
  const md = el('mission-desc');
  if (md) md.textContent = s.job.desc;
  const mj = el('mission-job');
  if (mj) mj.textContent = 'JOB ' + s.job.id + '/4 · ' + s.job.next.toUpperCase();
  const timer = el('mission-timer');
  if (timer) timer.textContent = formatTimer(s.timerSeconds);
  setBar(el('stage-fill'), (s.stageIndex / Math.max(1, s.stageTotal)) * 100);
  const stageNum = el('stage-num');
  if (stageNum) stageNum.textContent = 'STAGE ' + s.stageIndex + '/' + s.stageTotal;
  const speed = el('speed');
  if (speed) speed.textContent = s.inCar ? Math.round(s.speedMph) + ' mph' : 'ON FOOT';
  const compass = el('compass');
  if (compass) compass.textContent = compassArrow(s.compassAngle) + ' ' + Math.round(s.compassDist) + 'm';
  const radio = el('radio');
  if (radio) radio.textContent = s.radio.name + ' — ' + s.radio.track + ' · ' + s.radio.artist;
  setBar(el('damage-fill'), s.damage);
  const dn = el('damage-num');
  if (dn) dn.textContent = 'DAMAGE ' + Math.round(s.damage) + '%';
  const carLine = el('car-line');
  if (carLine) {
    carLine.textContent = s.inCar
      ? s.carName + ' / CONDITION ' + Math.round(s.carCondition) + '% · ' + s.gear
      : '';
  }
  const panel = el('police-panel');
  if (panel) {
    panel.textContent = '';
    for (const u of s.police) {
      const row = document.createElement('div');
      row.className = 'police-row';
      row.textContent = u.name + ' · ' + u.role + ' · ' + u.dist + 'm';
      panel.appendChild(row);
    }
    if (s.police.length === 0) {
      const row = document.createElement('div');
      row.className = 'police-row';
      row.textContent = 'NO UNITS ON YOU';
      panel.appendChild(row);
    }
  }
  const soundPill = el('sound-pill');
  if (soundPill) soundPill.textContent = s.muted ? 'SOUND OFF · X' : 'SOUND ON · X';
  const dlg = el('dialogue');
  if (dlg) {
    if (s.dialogue) {
      dlg.style.display = 'flex';
      const sp = el('speaker');
      if (sp) sp.textContent = s.dialogue.speaker;
      const dt = el('dialogue-text');
      if (dt) dt.textContent = s.dialogue.text;
      drawPortrait(el('portrait'), s.dialogue.speaker);
    } else {
      dlg.style.display = 'none';
    }
  }
}

export function drawMinimap(canvas, s) {
  if (!canvas) return;
  const g = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const sx = (x) => ((x + 100) / 214) * w;
  const sz = (z) => ((z + 100) / 200) * h;
  g.fillStyle = '#14121c';
  g.fillRect(0, 0, w, h);
  // Ocean on the right.
  g.fillStyle = '#1f6a80';
  g.fillRect(sx(68), 0, w - sx(68), h);
  // Beach.
  g.fillStyle = '#e0c48f';
  g.fillRect(sx(60), 0, sx(68) - sx(60), h);
  // Roads.
  g.strokeStyle = '#8a7a5a';
  g.lineWidth = 3;
  for (const x of [-60, -30, 0, 30, 60]) {
    g.beginPath();
    g.moveTo(sx(x), 0);
    g.lineTo(sx(x), h);
    g.stroke();
  }
  for (const z of [-60, -30, 0, 30, 60]) {
    g.beginPath();
    g.moveTo(0, sz(z));
    g.lineTo(w, sz(z));
    g.stroke();
  }
  // Marker.
  g.fillStyle = '#ffd23e';
  g.beginPath();
  g.arc(sx(s.marker.x), sz(s.marker.z), 4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffd23e';
  g.beginPath();
  g.arc(sx(s.marker.x), sz(s.marker.z), 7, 0, Math.PI * 2);
  g.stroke();
  // Traffic.
  g.fillStyle = '#d9d9d9';
  for (const t of s.traffic) {
    g.fillRect(sx(t.x) - 1.5, sz(t.z) - 1.5, 3, 3);
  }
  // Police.
  g.fillStyle = '#2e6fff';
  for (const p of s.policePos) {
    g.beginPath();
    g.arc(sx(p.x), sz(p.z), 2.5, 0, Math.PI * 2);
    g.fill();
  }
  // Player arrow.
  g.save();
  g.translate(sx(s.player.x), sz(s.player.z));
  g.rotate(s.player.heading);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(0, -6);
  g.lineTo(4, 5);
  g.lineTo(-4, 5);
  g.closePath();
  g.fill();
  g.restore();
}
