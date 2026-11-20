// save.js — Neon Bay's save: money and mission progress in localStorage.
// Everything is wrapped in try/catch: a browser that blocks storage still plays.
const KEY = 'neonbay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return { money: data.money, missionIndex: data.missionIndex };
  } catch (e) {
    return null;
  }
}

export function saveGame(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: data.money,
      missionIndex: data.missionIndex,
      savedAt: Date.now(),
    }));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) { /* ignore */ }
}
