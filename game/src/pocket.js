// Save: localStorage (money, mission index, RP, timestamp).
// Safe load (validates numbers), safe save, clear. Never throws.
const KEY = 'neon-bay-save-v9';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.money !== 'number' || typeof d.index !== 'number') return null;
    return {
      money: d.money,
      index: Math.max(0, Math.min(4, Math.floor(d.index))),
      rp: typeof d.rp === 'number' ? d.rp : 0,
      at: typeof d.at === 'number' ? d.at : 0,
    };
  } catch (e) {
    return null;
  }
}

export function saveGame(money, index, rp) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money, index, rp, at: Date.now(),
    }));
  } catch (e) { /* storage unavailable */ }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) { /* storage unavailable */ }
}
