// The story: Rico owes Vinnie "The Ledger" Marlow $1,200 and works it off over four
// jobs across Neon Bay. Each job has a marker, a timer and a stage bar; finishing one
// pays, raises respect and rank, and saves. The staged late-game state is job 4 of 4.
import { JOBS, MISSION_TIME, SAVE_KEY, rankFor } from './config.js';
import { clamp } from './util.js';

export const JOB_MARKERS = [
  { x: 34, z: -30, district: 'THE STRAND' },
  { x: -12, z: 60, district: 'HARBOUR' },
  { x: 34, z: -60, district: 'CASINO ROW' },
  { x: 34, z: 20, district: 'THE STRAND' },
];

export function createJobs() {
  const state = {
    money: 0,
    jobIndex: 0,
    rp: 0,
    standing: 0,
    health: 100,
    armour: 0,
    timer: MISSION_TIME,
    stage: 1,
    stages: 3,
    district: 'THE STRAND',
    banner: null,
    bannerTime: 0,
    dialogue: null,
    completed: false,
  };

  function job() {
    return JOBS[state.jobIndex];
  }

  function save() {
    try {
      window.localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          money: state.money,
          jobIndex: state.jobIndex,
          rp: state.rp,
          standing: state.standing,
          health: state.health,
          armour: state.armour,
        }),
      );
    } catch {
      // Storage can be off: the run then lasts this visit only.
    }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (typeof data.money !== 'number' || typeof data.jobIndex !== 'number') return false;
      state.money = clamp(data.money, 0, 999999);
      state.jobIndex = clamp(data.jobIndex, 0, JOBS.length - 1);
      state.rp = clamp(data.rp ?? 0, 0, 9999);
      state.standing = clamp(data.standing ?? 0, 0, 100);
      state.health = clamp(data.health ?? 100, 0, 100);
      state.armour = clamp(data.armour ?? 0, 0, 100);
      return true;
    } catch {
      return false;
    }
  }

  return {
    state,
    job,
    save,
    load,

    rank() {
      return rankFor(state.rp);
    },

    /** Finish the current job: pay, respect, a banner, and save. */
    completeJob() {
      const current = job();
      state.money += current.pay;
      state.rp += 125;
      state.standing = clamp(state.standing + 25, 0, 100);
      state.banner = { title: 'MISSION COMPLETE', line: `${current.title} +$${current.pay}`, time: 12 };
      state.bannerTime = 12;
      state.jobIndex = Math.min(state.jobIndex + 1, JOBS.length - 1);
      state.timer = MISSION_TIME;
      state.stage = 1;
      if (state.jobIndex === JOBS.length - 1 && state.money >= 5200) state.completed = true;
      save();
    },

    /** The staged late-game state every screenshot uses: last job, big money, rank B. */
    stageLateGame() {
      state.money = 5200;
      state.jobIndex = 3;
      state.rp = 390;
      state.standing = 50;
      state.health = 88;
      state.armour = 65;
      state.timer = 115;
      state.stage = 2;
      state.stages = 3;
      state.district = 'THE STRAND';
      state.banner = null;
      state.completed = false;
    },

    setDialogue(speaker, text) {
      state.dialogue = { speaker, text };
    },

    clearDialogue() {
      state.dialogue = null;
    },

    step(dt) {
      state.timer = Math.max(0, state.timer - dt);
      if (state.bannerTime > 0) state.bannerTime -= dt;
      if (state.bannerTime <= 0) state.banner = null;
    },
  };
}
