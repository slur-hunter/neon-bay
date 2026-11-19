// Neon Bay — hud.js: the money, stars, clock, health, objective and live minimap.
// One clear job: show the player everything the game is doing, in one glance.
import { CITY } from './city.js';

const MAP_SIZE = 180;
const MAP_SCALE = MAP_SIZE / 336; // city spans -168..168 in both axes
const MAP_ORIGIN = 168;

/** Converts a world x/z into minimap pixels (south is down). */
function toMap(x, z) {
  return [(x + MAP_ORIGIN) * MAP_SCALE, (z + MAP_ORIGIN) * MAP_SCALE];
}

/** Wires the DOM HUD and the minimap canvas. */
export function createHud() {
  const hud = document.getElementById('hud');
  const moneyBox = document.getElementById('money-box');
  const starsBox = document.getElementById('stars');
  const clockBox = document.getElementById('clock-box');
  const objectiveBox = document.getElementById('objective');
  const healthFill = document.getElementById('health-fill');
  const speedBox = document.getElementById('speed-box');
  const crosshair = document.getElementById('crosshair');
  const toastsBox = document.getElementById('toasts');
  const bannerBox = document.getElementById('banner');
  const mapCanvas = document.getElementById('minimap');
  const mapCtx = mapCanvas.getContext('2d');
  let bannerTimer = null;

  function drawMinimap(G) {
    const ctx = mapCtx;
    ctx.fillStyle = '#0e1a2a';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    // The bay and the beach along the south edge.
    const [, beachY] = toMap(0, 152);
    const [, waterY] = toMap(0, 168);
    ctx.fillStyle = '#e8d49a';
    ctx.fillRect(0, beachY, MAP_SIZE, waterY - beachY);
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(0, waterY, MAP_SIZE, MAP_SIZE - waterY);
    // Roads.
    ctx.strokeStyle = '#3a3f4a';
    ctx.lineWidth = Math.max(2, 8 * MAP_SCALE);
    for (const s of CITY.streets) {
      const [px] = toMap(s, 0);
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, MAP_SIZE); ctx.stroke();
      const [, py] = toMap(0, s);
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(MAP_SIZE, py); ctx.stroke();
    }
    // The Spire, the city's landmark.
    const [sx, sy] = toMap(0, 0);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(sx - 3, sy - 3, 6, 6);
    // Traffic as pale dots.
    ctx.fillStyle = '#b8c0cc';
    for (const car of G.vehicles.traffic) {
      const [x, y] = toMap(car.pos.x, car.pos.z);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    // Police as red dots.
    ctx.fillStyle = '#ff4040';
    for (const p of G.police.policeCars) {
      const [x, y] = toMap(p.pos.x, p.pos.z);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // The mission beacon, pulsing gold.
    if (G.missions.target) {
      const [x, y] = toMap(G.missions.target.x, G.missions.target.z);
      const r = 4 + Math.sin(performance.now() * 0.006) * 1.5;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke();
    }
    // The player: a white arrow pointing where they face.
    const pp = G.player.inCar && G.drivenCar ? G.drivenCar.pos : G.player.pos;
    const heading = G.player.inCar && G.drivenCar ? G.drivenCar.heading : G.player.heading;
    const [px, py] = toMap(pp.x, pp.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return {
    show() { hud.classList.add('on'); },
    hide() { hud.classList.remove('on'); },
    setCrosshair(on) { crosshair.classList.toggle('on', on); },
    toast(html) {
      const div = document.createElement('div');
      div.className = 'toast chip';
      div.innerHTML = html;
      toastsBox.appendChild(div);
      while (toastsBox.children.length > 3) toastsBox.removeChild(toastsBox.firstChild);
      setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 4500);
    },
    banner(title, sub) {
      bannerBox.innerHTML = `${title}<small>${sub}</small>`;
      bannerBox.classList.add('on');
      if (bannerTimer) clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => bannerBox.classList.remove('on'), 3200);
    },
    update(G) {
      moneyBox.innerHTML = `$${G.money.toLocaleString('en-US')}<small>NEON BAY</small>`;
      const filled = '★'.repeat(G.police.stars);
      const empty = '☆'.repeat(5 - G.police.stars);
      starsBox.textContent = filled + empty;
      starsBox.style.color = G.police.stars > 0 ? '#ffd23f' : 'rgba(255,255,255,0.45)';
      const hours = Math.floor(G.dayTime) % 24;
      const mins = Math.floor((G.dayTime % 1) * 60);
      const hh = String(hours).padStart(2, '0');
      const mm = String(mins).padStart(2, '0');
      clockBox.innerHTML = `${hh}:${mm}<small>DAY ${G.day} &middot; SUNNY</small>`;
      objectiveBox.innerHTML = `<span class="mara">MARA</span> — ${G.missions.objective}`;
      const hp = Math.max(0, Math.min(100, G.health));
      healthFill.style.width = `${hp}%`;
      healthFill.style.background = hp > 50 ? 'linear-gradient(90deg, #37d67a, #9be15d)' : hp > 25 ? 'linear-gradient(90deg, #e8a33a, #e8d23a)' : 'linear-gradient(90deg, #d83a3a, #ff6a5e)';
      const kmh = G.player.inCar && G.drivenCar ? Math.round(Math.abs(G.drivenCar.speed) * 3.6) : Math.round(Math.abs(G.player.speed) * 3.6);
      speedBox.innerHTML = `${kmh}<small>KM/H</small>`;
      drawMinimap(G);
    },
  };
}
