// saveGame and loadGame persist progress in localStorage: money, missions,
// position, health, weapon and the clock.
const KEY = 'neonbay-save-v1';

export function saveGame(G) {
  try {
    const data = {
      money: Math.floor(G.money),
      missionsDone: G.missionsDone,
      missionIndex: G.missionIndex,
      x: Math.round(G.playerPos.x),
      z: Math.round(G.playerPos.z),
      health: Math.round(G.health),
      hasWeapon: !!G.hasWeapon,
      day: G.day,
      minutes: Math.floor(G.minutes),
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
