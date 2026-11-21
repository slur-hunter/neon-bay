// Save: localStorage (money, mission index, RP, timestamp), with safe
// load and save. A corrupt or missing save is just an empty one.
const KEY = 'neon-bay-save-v8';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s.money !== 'number' || typeof s.index !== 'number') return null;
    return { money: s.money, index: s.index, rp: s.rp || 0, at: s.at || 0 };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      money: state.money, index: state.index, rp: state.rp, at: Date.now(),
    }));
  } catch { /* storage unavailable */ }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
