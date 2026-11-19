// save.js — localStorage save of money and mission progress.
const KEY = 'neon-bay-save-v3';

export class Save {
  constructor(game) {
    this.game = game;
  }

  load() {
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

  hasSave() {
    return this.load() !== null;
  }

  write() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        money: this.game.money,
        missionIndex: this.game.missions.index,
        savedAt: Date.now(),
      }));
    } catch {
      // storage may be unavailable; the game still plays
    }
  }

  apply(data) {
    if (!data) return;
    this.game.money = data.money || 0;
    this.game.missions.applySave(data);
  }

  clear() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }
}
