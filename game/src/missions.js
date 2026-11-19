// createMissions runs Mara's job chain: five missions with briefings, targets,
// rewards and progression. Money and missions done are the progression.
import * as THREE from 'three';

const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    briefing: 'Mara: New in the Bay? Steal a car, any car, and bring it to the Docks. The crew is watching.',
    reward: 200,
  },
  {
    id: 'bay-runner',
    title: 'Bay Runner',
    briefing: 'Mara: Package run. Get to the Bay Bar on the beach. No questions, no stops.',
    reward: 350,
  },
  {
    id: 'lose-the-heat',
    title: 'Lose the Heat',
    briefing: 'Mara: The PD is on you. Get two stars, then vanish. Lay low until the heat dies.',
    reward: 500,
  },
  {
    id: 'crew-pickup',
    title: 'Crew Pickup',
    briefing: 'Mara: Pick up Rook at the north plaza and Juno at the east flats, then bring them to the Hideout.',
    reward: 750,
  },
  {
    id: 'neon-heist',
    title: 'Neon Heist',
    briefing: 'Mara: The big one. Hit the Bay Bank, grab the cash, and lose the cops across the north bridge.',
    reward: 1500,
  },
];

const TARGETS = {
  docks: new THREE.Vector3(230, 0, -40),
  beachBar: new THREE.Vector3(0, 0, 212),
  rook: new THREE.Vector3(0, 0, -140),
  juno: new THREE.Vector3(120, 0, 120),
  hideout: new THREE.Vector3(-160, 0, 160),
  bank: new THREE.Vector3(40, 0, -40),
  bridge: new THREE.Vector3(0, 0, -212),
};

export function createMissions() {
  let index = 0;
  let stage = 0;
  let done = 0;
  let active = true;

  function current() {
    return active ? MISSIONS[index] : null;
  }

  function targetFor() {
    const m = current();
    if (!m) return null;
    switch (m.id) {
      case 'first-wheels': return TARGETS.docks;
      case 'bay-runner': return TARGETS.beachBar;
      case 'lose-the-heat': return null;
      case 'crew-pickup':
        return stage === 0 ? TARGETS.rook : stage === 1 ? TARGETS.juno : TARGETS.hideout;
      case 'neon-heist': return stage === 0 ? TARGETS.bank : TARGETS.bridge;
      default: return null;
    }
  }

  function near(pos, target, r) {
    return target && Math.hypot(pos.x - target.x, pos.z - target.z) < r;
  }

  return {
    get index() { return index; },
    get done() { return done; },
    get active() { return active; },
    get all() { return MISSIONS; },
    setIndex(i, d) { index = i; done = d; stage = 0; active = index < MISSIONS.length; },
    current,
    targetFor,
    startBriefing() {
      const m = current();
      return m ? m.briefing : 'All jobs done. The Bay is yours, kid.';
    },
    // returns an event object when something happens, else null
    update(G) {
      const m = current();
      if (!m) return null;
      const pos = G.playerPos;
      if (m.id === 'first-wheels') {
        if (G.inCar && near(pos, TARGETS.docks, 14)) {
          return this.complete(G);
        }
      } else if (m.id === 'bay-runner') {
        if (near(pos, TARGETS.beachBar, 12)) return this.complete(G);
      } else if (m.id === 'lose-the-heat') {
        if (stage === 0 && G.wanted >= 2) {
          stage = 1;
          return { type: 'stage', text: 'Heat is on. Now vanish: stay out of sight until the stars fade.' };
        }
        if (stage === 1 && G.wanted === 0) return this.complete(G);
      } else if (m.id === 'crew-pickup') {
        if (stage === 0 && near(pos, TARGETS.rook, 10)) {
          stage = 1;
          return { type: 'stage', text: 'Rook is in. Now get Juno at the east flats.' };
        }
        if (stage === 1 && near(pos, TARGETS.juno, 10)) {
          stage = 2;
          return { type: 'stage', text: 'Juno is in. Bring the crew to the Hideout.' };
        }
        if (stage === 2 && near(pos, TARGETS.hideout, 12)) return this.complete(G);
      } else if (m.id === 'neon-heist') {
        if (stage === 0 && near(pos, TARGETS.bank, 10)) {
          stage = 1;
          return { type: 'stage', text: 'Cash grabbed! The alarm is up: lose the cops across the north bridge.', grab: true };
        }
        if (stage === 1 && near(pos, TARGETS.bridge, 12) && G.wanted === 0) return this.complete(G);
      }
      return null;
    },
    complete(G) {
      const m = current();
      G.money += m.reward;
      done += 1;
      index += 1;
      stage = 0;
      active = index < MISSIONS.length;
      return { type: 'complete', text: 'Job done: ' + m.title + ' — +' + m.reward + '$', reward: m.reward };
    },
  };
}
