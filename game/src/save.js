// Neon Bay — save.js: progress in the browser's local storage, nothing else.
// One clear job: remember the money, the jobs and where the player stood.
const KEY = 'neon-bay-save-v1';

/** Reads the saved game, or null when there is none. */
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

/** True when a save exists to continue from. */
export function hasSave() {
  return loadSave() !== null;
}

/** Writes the current progress. Never throws: a missing storage just skips. */
export function writeSave(G) {
  try {
    const data = {
      money: G.money,
      health: G.health,
      jobIndex: G.missions.index,
      jobsDone: G.missions.done,
      playerX: G.player.pos.x,
      playerZ: G.player.pos.z,
      dayTime: G.dayTime,
      hasPistol: G.combat.hasPistol,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode, blocked): the game still plays.
  }
}

/** Wipes the save. */
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
