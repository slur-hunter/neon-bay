// Save and load for Neon Bay: localStorage with strict validation. Every
// field is checked before it is trusted, and a bad save falls back to a
// fresh game. Per-district standing IS persisted (earlier versions lost
// it on load).
const KEY = 'neon-bay-save-v12';

export function defaultSave() {
  return {
    money: 0,
    missionIndex: 0,
    rp: 0,
    armour: 0,
    health: 100,
    doneByDistrict: { Downtown: 0, Uptown: 0, Marina: 0, Harbour: 0, 'The Strand': 0 },
    clockMinutes: 17 * 60 + 41,
    version: 12,
  };
}

function isInt(v) {
  return typeof v === 'number' && Number.isFinite(v) && Math.floor(v) === v;
}

export function validateSave(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version !== 12) return null;
  if (!isInt(raw.money) || raw.money < 0 || raw.money > 1000000) return null;
  if (!isInt(raw.missionIndex) || raw.missionIndex < 0 || raw.missionIndex > 3) return null;
  if (!isInt(raw.rp) || raw.rp < 0 || raw.rp > 2000) return null;
  if (!isInt(raw.armour) || raw.armour < 0 || raw.armour > 100) return null;
  if (!isInt(raw.health) || raw.health < 0 || raw.health > 100) return null;
  if (!raw.doneByDistrict || typeof raw.doneByDistrict !== 'object') return null;
  for (const d of ['Downtown', 'Uptown', 'Marina', 'Harbour', 'The Strand']) {
    if (!isInt(raw.doneByDistrict[d]) || raw.doneByDistrict[d] < 0 || raw.doneByDistrict[d] > 20) return null;
  }
  if (!isInt(raw.clockMinutes) || raw.clockMinutes < 0 || raw.clockMinutes >= 1440) return null;
  return raw;
}

export function loadSave() {
  try {
    const text = window.localStorage.getItem(KEY);
    if (!text) return null;
    return validateSave(JSON.parse(text));
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const data = {
      money: state.money,
      missionIndex: state.missionIndex,
      rp: state.rp,
      armour: Math.round(state.armour),
      health: Math.round(state.health),
      doneByDistrict: state.doneByDistrict,
      clockMinutes: Math.floor(state.clockMinutes),
      version: 12,
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Storage may be unavailable; a fresh game is the safe fallback.
  }
}
