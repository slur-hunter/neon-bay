// localStorage save: money, mission index, RP and a timestamp. Loads are
// validated so a corrupt or foreign value can never break the game.
const KEY = 'neonbay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return {
      money: Number.isFinite(s.money) ? Math.max(0, Math.floor(s.money)) : 0,
      missionIndex: Number.isFinite(s.missionIndex)
        ? Math.max(0, Math.min(4, Math.floor(s.missionIndex))) : 0,
      rp: Number.isFinite(s.rp) ? Math.max(0, Math.floor(s.rp)) : 0,
      timestamp: Number.isFinite(s.timestamp) ? s.timestamp : 0,
    };
  } catch {
    return null;
  }
}

export function storeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: state.money,
      missionIndex: state.missionIndex,
      rp: state.rp,
      timestamp: Date.now(),
    }));
  } catch { /* storage may be unavailable; the game still plays */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
