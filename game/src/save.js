// localStorage save: money, mission index, RP, timestamp. All guarded.
const KEY = 'neon-bay-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.index !== 'number') return null;
    return {
      money: Math.max(0, Math.floor(data.money)),
      index: Math.max(0, Math.min(4, Math.floor(data.index))),
      rp: typeof data.rp === 'number' ? Math.max(0, Math.floor(data.rp)) : 0,
      ts: typeof data.ts === 'number' ? data.ts : 0,
    };
  } catch (err) {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ money: state.money, index: state.index, rp: state.rp, ts: Date.now() }),
    );
  } catch (err) {
    // storage full or blocked: the game keeps playing without a save.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (err) {
    // ignore
  }
}
