// Every pixel of the HUD: the left panel (wanted, health, armour, money, rank),
// the right panel (clock, mission card, speed, compass, police), the bottom-left
// panel (radio, car, damage, dialogue with a portrait, controls), the minimap and
// the sound pill, plus the title card, the mission banner and the title screen.
import { WORLD } from './config.js';
import { clockText, compassText, money, timerText } from './util.js';

const VINNIE_PORTRAIT =
  '<svg viewBox="0 0 64 64" width="52" height="52" aria-hidden="true">' +
  '<rect x="14" y="18" width="36" height="38" rx="10" fill="#e8b98a"/>' +
  '<rect x="10" y="10" width="44" height="12" rx="4" fill="#3a3a44"/>' +
  '<rect x="16" y="4" width="32" height="10" rx="4" fill="#3a3a44"/>' +
  '<rect x="20" y="30" width="8" height="4" rx="2" fill="#1c1c22"/>' +
  '<rect x="36" y="30" width="8" height="4" rx="2" fill="#1c1c22"/>' +
  '<rect x="24" y="44" width="16" height="5" rx="2" fill="#5a3a22"/>' +
  '<rect x="22" y="50" width="20" height="3" rx="1" fill="#7a5230"/>' +
  '</svg>';

function panel(id, style) {
  const div = document.createElement('div');
  div.id = id;
  div.style.cssText =
    'position:absolute;background:rgba(12,10,24,0.72);border:1px solid rgba(255,255,255,0.16);' +
    'border-radius:10px;padding:10px 12px;color:#f2f2f8;font-family:Arial,sans-serif;' + style;
  return div;
}

function bar(fillId, colour) {
  return (
    '<div style="height:8px;background:rgba(255,255,255,0.18);border-radius:4px;overflow:hidden;margin:3px 0 6px">' +
    `<div id="${fillId}" style="height:100%;width:50%;background:${colour};border-radius:4px"></div></div>`
  );
}

export function createHud() {
  const root = document.getElementById('hud');
  const left = panel('hud-left', 'top:14px;left:14px;width:250px;font-size:15px;line-height:1.35');
  left.innerHTML =
    '<div id="hud-stars" style="font-size:19px;letter-spacing:3px;color:#ffd23e">☆☆☆☆</div>' +
    '<div>HEALTH <span id="hud-health">100</span></div>' + bar('hud-health-fill', '#37d67a') +
    '<div>ARMOUR <span id="hud-armour">0</span></div>' + bar('hud-armour-fill', '#4aa8ff') +
    '<div id="hud-money" style="font-size:26px;font-weight:bold;color:#7dff9b">$0</div>' +
    '<div id="hud-rank" style="color:#ffd23e;font-weight:bold">RANK D · ROOKIE</div>' +
    '<div style="font-size:13px"><span id="hud-rp">0 / 100 RP</span></div>' + bar('hud-rp-fill', '#ffd23e') +
    '<div id="hud-district" style="font-size:14px">THE STRAND · STANDING 0</div>';
  root.appendChild(left);

  const right = panel('hud-right', 'top:14px;right:14px;width:300px;font-size:15px;line-height:1.4;text-align:right');
  right.innerHTML =
    '<div id="hud-clock" style="font-size:26px;font-weight:bold">18:00</div>' +
    '<div id="hud-job-title" style="color:#ffd23e;font-weight:bold">THE LEDGER</div>' +
    '<div id="hud-job-detail" style="font-size:13px;color:#d8d8e8">Collect from the debtors on the Strand, then settle with Vinnie.</div>' +
    '<div id="hud-job-line" style="font-size:14px">JOB 1/4 · COLLECT FROM MARCO</div>' +
    '<div style="font-size:18px;font-weight:bold"><span id="hud-timer">2:00</span> · STAGE <span id="hud-stage">1/3</span></div>' +
    bar('hud-stage-fill', '#ff7ad9') +
    '<div id="hud-speed" style="font-size:20px;font-weight:bold">ON FOOT</div>' +
    '<div id="hud-compass" style="font-size:16px;color:#7ad9ff">↑ 0m</div>' +
    '<div id="hud-police" style="font-size:14px;color:#ffb3b3">NO UNITS ON YOU</div>';
  root.appendChild(right);

  const bottom = panel('hud-bottom', 'left:14px;bottom:14px;width:420px;font-size:14px;line-height:1.45');
  bottom.innerHTML =
    '<div id="hud-radio">SUNSET FM — Neon Nights · The Palms</div>' +
    '<div id="hud-car" style="display:none">NEON STING GT / CONDITION 96% · G2</div>' +
    '<div>DAMAGE <span id="hud-damage">0</span>%</div>' + bar('hud-damage-fill', '#ff5a4e') +
    '<div id="hud-dialogue" style="display:none;border:1px solid rgba(255,255,255,0.22);border-radius:8px;padding:8px;margin:6px 0">' +
    '<div style="display:flex;gap:10px;align-items:flex-start"><div id="hud-portrait">' + VINNIE_PORTRAIT + '</div>' +
    '<div><div style="color:#ffd23e;font-weight:bold">VINNIE</div><div id="hud-dialogue-text"></div></div></div></div>' +
    '<div style="font-size:12px;color:#b8b8cc">WASD move / drive · Mouse drag look · E enter / exit car · Click punch · Space brake · M radio · X sound · P pause</div>';
  root.appendChild(bottom);

  const mapWrap = panel('hud-map', 'right:14px;bottom:14px;width:164px;padding:8px;text-align:center');
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = 148;
  mapCanvas.height = 148;
  mapCanvas.style.display = 'block';
  mapWrap.appendChild(mapCanvas);
  const soundPill = document.createElement('div');
  soundPill.id = 'hud-sound';
  soundPill.style.cssText = 'margin-top:6px;font-size:13px;color:#f2f2f8';
  soundPill.textContent = 'SOUND ON · X';
  mapWrap.appendChild(soundPill);
  root.appendChild(mapWrap);

  const titleCard = document.createElement('div');
  titleCard.id = 'hud-title-card';
  titleCard.style.cssText =
    'position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);text-align:center;display:none;' +
    'color:#fff;font-family:Arial,sans-serif;text-shadow:0 2px 18px rgba(0,0,0,0.6)';
  titleCard.innerHTML =
    '<div style="font-size:52px;font-weight:bold;letter-spacing:14px">THE STRAND</div>' +
    '<div style="font-size:22px;letter-spacing:10px;color:#ffd23e">NEON BAY</div>';
  root.appendChild(titleCard);

  const banner = document.createElement('div');
  banner.id = 'hud-banner';
  banner.style.cssText =
    'position:absolute;left:50%;top:22%;transform:translate(-50%,-50%);text-align:center;display:none;' +
    'color:#ffd23e;font-family:Arial,sans-serif;text-shadow:0 2px 18px rgba(0,0,0,0.7)';
  banner.innerHTML =
    '<div style="font-size:38px;font-weight:bold;letter-spacing:4px">MISSION COMPLETE</div>' +
    '<div id="hud-banner-line" style="font-size:20px;color:#fff">The Ledger +$1200</div>';
  root.appendChild(banner);

  const titleScreen = document.createElement('div');
  titleScreen.id = 'hud-title-screen';
  titleScreen.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'background:rgba(10,8,20,0.55);color:#fff;font-family:Arial,sans-serif;text-align:center';
  titleScreen.innerHTML =
    '<div style="font-size:64px;font-weight:bold;letter-spacing:10px">NEON BAY</div>' +
    '<div style="font-size:20px;color:#ffd23e;letter-spacing:6px;margin:6px 0 18px">AN OPEN-WORLD CRIME GAME</div>' +
    '<div style="font-size:16px;max-width:560px;line-height:1.5">Rico owes $1,200 to Vinnie "The Ledger" Marlow. ' +
    'Work it off over four jobs across the Strand: steal cars, outrun the cruisers, make the drops.</div>' +
    '<div style="margin-top:22px;font-size:15px;color:#d8d8e8">WASD move / drive · Mouse drag look · E enter car · Click punch · Space brake</div>' +
    '<button id="hud-start" style="margin-top:24px;font-size:20px;font-weight:bold;padding:12px 34px;border-radius:10px;' +
    'border:none;background:#ffd23e;color:#1c1c22;cursor:pointer">START</button>' +
    '<div id="hud-load-note" style="margin-top:12px;font-size:13px;color:#b8b8cc"></div>';
  root.appendChild(titleScreen);

  const pauseScreen = document.createElement('div');
  pauseScreen.id = 'hud-pause-screen';
  pauseScreen.style.cssText =
    'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;' +
    'background:rgba(10,8,20,0.6);color:#fff;font-family:Arial,sans-serif;text-align:center';
  pauseScreen.innerHTML =
    '<div style="font-size:44px;font-weight:bold">PAUSED</div>' +
    '<div style="font-size:16px;margin-top:10px">Press P or click to keep playing. Progress saves after every job.</div>';
  root.appendChild(pauseScreen);

  const mapCtx = mapCanvas.getContext('2d');
  const $ = (id) => document.getElementById(id);

  function drawMap(view) {
    const w = 148;
    const h = 148;
    const toX = (x) => ((x - WORLD.westEnd) / (WORLD.oceanX0 + 30 - WORLD.westEnd)) * w;
    const toZ = (z) => ((z - WORLD.northEnd) / (WORLD.southEnd - WORLD.northEnd)) * h;
    mapCtx.fillStyle = '#20202c';
    mapCtx.fillRect(0, 0, w, h);
    mapCtx.fillStyle = '#1d6f9e';
    mapCtx.fillRect(toX(WORLD.oceanX0), 0, w - toX(WORLD.oceanX0), h);
    mapCtx.fillStyle = '#d9b380';
    mapCtx.fillRect(toX(WORLD.beachX0), 0, toX(WORLD.oceanX0) - toX(WORLD.beachX0), h);
    mapCtx.strokeStyle = '#8a8a96';
    mapCtx.lineWidth = 3;
    mapCtx.beginPath();
    mapCtx.moveTo(toX(WORLD.strandX), 0);
    mapCtx.lineTo(toX(WORLD.strandX), h);
    mapCtx.stroke();
    mapCtx.lineWidth = 2;
    for (const x of WORLD.sideStreets) {
      mapCtx.beginPath();
      mapCtx.moveTo(toX(x), 0);
      mapCtx.lineTo(toX(x), h);
      mapCtx.stroke();
    }
    for (const z of WORLD.crossStreets) {
      mapCtx.beginPath();
      mapCtx.moveTo(0, toZ(z));
      mapCtx.lineTo(w, toZ(z));
      mapCtx.stroke();
    }
    const marker = view.marker;
    mapCtx.fillStyle = '#ffd23e';
    mapCtx.beginPath();
    mapCtx.arc(toX(marker.x), toZ(marker.z), 4, 0, Math.PI * 2);
    mapCtx.fill();
    for (const car of view.traffic) {
      mapCtx.fillStyle = '#f2f2f8';
      mapCtx.fillRect(toX(car.x) - 1, toZ(car.z) - 1, 2, 2);
    }
    for (const cruiser of view.cruisers) {
      if (!cruiser.active) continue;
      mapCtx.fillStyle = '#4aa8ff';
      mapCtx.beginPath();
      mapCtx.arc(toX(cruiser.x), toZ(cruiser.z), 3, 0, Math.PI * 2);
      mapCtx.fill();
    }
    mapCtx.fillStyle = '#ffd23e';
    mapCtx.save();
    mapCtx.translate(toX(view.player.x), toZ(view.player.z));
    mapCtx.rotate(view.player.heading);
    mapCtx.beginPath();
    mapCtx.moveTo(0, -6);
    mapCtx.lineTo(4, 5);
    mapCtx.lineTo(-4, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  return {
    update(view) {
      const jobs = view.jobs;
      const rank = jobs.rank();
      const stars = '★'.repeat(view.wanted) + '☆'.repeat(4 - view.wanted);
      $('hud-stars').textContent = stars;
      $('hud-health').textContent = Math.round(jobs.state.health);
      $('hud-health-fill').style.width = jobs.state.health + '%';
      $('hud-armour').textContent = Math.round(jobs.state.armour);
      $('hud-armour-fill').style.width = jobs.state.armour + '%';
      $('hud-money').textContent = money(jobs.state.money);
      $('hud-rank').textContent = `RANK ${rank.rank.letter} · ${rank.rank.name}`;
      const next = rank.next;
      const span = next ? next.min - rank.rank.min : 1;
      const progress = next ? jobs.state.rp - rank.rank.min : span;
      $('hud-rp').textContent = `${jobs.state.rp} / ${next ? next.min : jobs.state.rp} RP`;
      $('hud-rp-fill').style.width = Math.min(100, (progress / span) * 100) + '%';
      $('hud-district').textContent = `${jobs.state.district} · STANDING ${jobs.state.standing}`;
      $('hud-clock').textContent = clockText(view.clockMinutes);
      const current = jobs.job();
      $('hud-job-title').textContent = 'THE LEDGER';
      $('hud-job-detail').textContent = current.detail;
      $('hud-job-line').textContent = `JOB ${jobs.state.jobIndex + 1}/4 · ${current.title}`;
      $('hud-timer').textContent = timerText(jobs.state.timer);
      $('hud-stage').textContent = `${jobs.state.stage}/${jobs.state.stages}`;
      $('hud-stage-fill').style.width = (jobs.state.stage / jobs.state.stages) * 100 + '%';
      $('hud-speed').textContent = view.onFoot ? 'ON FOOT' : `${Math.round(Math.abs(view.speed) * 2.2)} mph`;
      $('hud-compass').textContent = `↑ ${compassText(view.compass)}`;
      const active = view.cruisers.filter((c) => c.active);
      $('hud-police').innerHTML =
        active.length === 0
          ? 'NO UNITS ON YOU'
          : active.map((c) => `${c.name} · ${c.role} · ${Math.round(c.distance)}m`).join('<br>');
      $('hud-radio').textContent = `${view.radio.name} — ${view.radio.show}`;
      const carLine = $('hud-car');
      if (view.onFoot) {
        carLine.style.display = 'none';
      } else {
        carLine.style.display = 'block';
        carLine.textContent = `${view.carName} / CONDITION ${view.carCondition}% · ${view.gear}`;
      }
      $('hud-damage').textContent = Math.round(view.damage);
      $('hud-damage-fill').style.width = view.damage + '%';
      const dialogue = $('hud-dialogue');
      if (jobs.state.dialogue) {
        dialogue.style.display = 'block';
        $('hud-dialogue-text').textContent = jobs.state.dialogue.text;
      } else {
        dialogue.style.display = 'none';
      }
      $('hud-sound').textContent = view.soundOn ? 'SOUND ON · X' : 'SOUND OFF · X';
      titleCard.style.display = view.titleCard ? 'block' : 'none';
      if (jobs.state.banner) {
        banner.style.display = 'block';
        $('hud-banner-line').textContent = jobs.state.banner.line;
      } else {
        banner.style.display = 'none';
      }
      drawMap(view);
    },

    showTitle(hasSave) {
      titleScreen.style.display = 'flex';
      $('hud-load-note').textContent = hasSave ? 'A saved run is on this machine — START continues it.' : '';
    },
    hideTitle() {
      titleScreen.style.display = 'none';
    },
    showPause() {
      pauseScreen.style.display = 'flex';
    },
    hidePause() {
      pauseScreen.style.display = 'none';
    },
    onStart(handler) {
      $('hud-start').addEventListener('click', handler);
    },
  };
}
