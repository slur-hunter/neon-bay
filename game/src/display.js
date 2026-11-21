// HUD: every panel the game shows, updated cheaply — each value is cached
// and the DOM is only touched when the content actually changes.
// All numbers come from live game state; nothing here is hardcoded.
import { CITY_EDGE, STREET_AT } from './city.js';

export function buildDisplay(doc) {
  const el = (id) => doc.getElementById(id);
  const starsEl = el('hud-stars');
  const healthFill = el('hud-health-fill');
  const moneyEl = el('hud-money');
  const rankEl = el('hud-rank');
  const standEl = el('hud-standing');
  const missionTitle = el('hud-mission-title');
  const missionText = el('hud-mission-text');
  const missionStage = el('hud-mission-stage');
  const missionNext = el('hud-mission-next');
  const policeEl = el('hud-police');
  const policeList = el('hud-police-list');
  const dialogName = el('hud-dialog-name');
  const dialogText = el('hud-dialog-text');
  const speedEl = el('hud-speed');
  const compassEl = el('hud-compass');
  const damageWrap = el('hud-damage-wrap');
  const damageFill = el('hud-damage-fill');
  const damageText = el('hud-damage-text');
  const radioWrap = el('hud-radio');
  const radioText = el('hud-radio-text');
  const bannerEl = el('hud-banner');
  const minimap = el('hud-minimap');
  const soundEl = el('hud-sound');
  const ctx = minimap ? minimap.getContext('2d') : null;

  const last = {};
  function set(key, node, value) {
    if (last[key] !== value) {
      last[key] = value;
      if (node) node.textContent = value;
    }
  }
  function show(key, node, on) {
    if (last[key] !== on) {
      last[key] = on;
      if (node) node.style.display = on ? '' : 'none';
    }
  }

  function update(s) {
    // Stars: filled gold up to the wanted level.
    let stars = '';
    for (let i = 0; i < 4; i++) stars += i < s.wanted ? '★' : '☆';
    set('stars', starsEl, stars);
    // Health bar colour shifts green -> amber -> red.
    const hp = Math.max(0, Math.min(100, s.health));
    if (last.hp !== hp) {
      last.hp = hp;
      healthFill.style.width = hp + '%';
      healthFill.style.background = hp > 55 ? '#37d67a' : hp > 25 ? '#ffb02e' : '#ff4040';
    }
    set('money', moneyEl, '$' + s.money);
    set('rank', rankEl, `RANK ${s.rank} · ${s.rp} RP`);
    set('standing', standEl, `${s.district} · STANDING ${s.standing}`);
    set('mtitle', missionTitle, s.jobTitle);
    set('mtext', missionText, s.jobText);
    set('mstage', missionStage, `JOB ${Math.min(s.jobIndex + 1, 4)}/4`);
    set('mnext', missionNext, 'NEXT: ' + s.nextTitle);
    // Police panel: hidden at wanted 0, one live line per cruiser.
    show('police', policeEl, s.wanted > 0 && s.policeLines.length > 0);
    set('plines', policeList, s.policeLines.join('\n'));
    set('dname', dialogName, s.speaker);
    set('dtext', dialogText, s.story);
    set('speed', speedEl, s.inCar ? `${Math.round(s.speedMph)} mph` : 'ON FOOT');
    const arrow = s.compassDeg >= -45 && s.compassDeg < 45 ? '↑'
      : s.compassDeg >= 45 && s.compassDeg < 135 ? '→'
      : s.compassDeg >= 135 || s.compassDeg < -135 ? '↓' : '←';
    set('compass', compassEl, `${arrow} ${Math.round(s.markerDist)}m`);
    // Damage bar only in a car; radio line only in a car.
    show('dmg', damageWrap, s.inCar);
    if (s.inCar) {
      const dg = Math.round(s.damage);
      if (last.dmg !== dg) {
        last.dmg = dg;
        damageFill.style.width = dg + '%';
      }
      set('dmgtext', damageText, `DAMAGE ${dg}%`);
      set('radio', radioText, `♪ ${s.stationName} — ${s.stationTrack}`);
    }
    show('radio', radioWrap, s.inCar && s.radioOn);
    set('sound', soundEl, s.muted ? 'SOUND OFF' : 'SOUND ON');
    // Banner: mission complete, fades with its own timer.
    show('banner', bannerEl, s.banner !== '');
    set('banner', bannerEl, s.banner);
    drawMinimap(s);
  }

  let miniTick = 0;
  function drawMinimap(s) {
    if (!ctx) return;
    miniTick++;
    if (miniTick % 3 !== 0 && last.mini === s.playerX + ',' + s.playerZ) return;
    last.mini = s.playerX + ',' + s.playerZ;
    const W = minimap.width;
    const H = minimap.height;
    const scale = W / (CITY_EDGE * 2 + 20);
    const toX = (x) => (x + CITY_EDGE + 10) * scale;
    const toZ = (z) => (z + CITY_EDGE + 10) * scale;
    ctx.fillStyle = '#1c1424';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#4a3a55';
    ctx.lineWidth = 1;
    for (const st of STREET_AT) {
      ctx.beginPath();
      ctx.moveTo(toX(st), 0);
      ctx.lineTo(toX(st), H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, toZ(st));
      ctx.lineTo(W, toZ(st));
      ctx.stroke();
    }
    // Mission marker: gold ring.
    ctx.strokeStyle = '#ffd21a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(toX(s.markerX), toZ(s.markerZ), 5, 0, Math.PI * 2);
    ctx.stroke();
    // Traffic: pale dots. Police: red dots.
    ctx.fillStyle = '#c8c8d8';
    for (const [tx, tz] of s.trafficDots) ctx.fillRect(toX(tx) - 1, toZ(tz) - 1, 2, 2);
    ctx.fillStyle = '#ff4040';
    for (const [px, pz] of s.policeDots) {
      ctx.beginPath();
      ctx.arc(toX(px), toZ(pz), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow, pointing where the player faces.
    const px = toX(s.playerX);
    const pz = toZ(s.playerZ);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(s.playerYaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return { update };
}
