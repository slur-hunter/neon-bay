// Neon Bay v7 — save. One small localStorage record: money, mission index and
// a timestamp. Every call is guarded; a bad record loads as nothing.
const SAVE_KEY = 'neon-bay-save-v7';

export function loadKeep() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function saveKeep(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch { /* storage may be unavailable */ }
}

export function clearKeep() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
