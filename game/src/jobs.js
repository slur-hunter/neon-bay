// Missions and progression. Four jobs pay off Rico's $1,200 debt to Vinnie
// "The Ledger" Marlow. RP accrues from job pay; rank is derived from RP.
// District standing is per-district: missions completed in the district
// the player is standing in, never a global count.
export const JOBS = [
  {
    title: 'The Pickup', pay: 200, district: 'Marina',
    text: 'Pick up the package at the corner of 48th and Harbour.',
    story: 'Rico grabs the package. One down — the Ledger is watching.',
    speaker: 'VINNIE "THE LEDGER" MARLOW',
    marker: { x: 0, z: -60 },
  },
  {
    title: 'The Drop', pay: 300, district: 'Marina',
    text: 'Deliver the package to the docks before the heat arrives.',
    story: 'Drop made. Vinnie counts the bills and nods. Two to go.',
    speaker: 'VINNIE "THE LEDGER" MARLOW',
    marker: { x: 120, z: -60 },
  },
  {
    title: 'The Getaway', pay: 300, district: 'Downtown',
    text: 'Reach the safehouse while the heat is on.',
    story: 'Rico slips into the safehouse. The sirens fade. One last job.',
    speaker: 'RICO',
    marker: { x: -60, z: 120 },
  },
  {
    title: 'The Payoff', pay: 400, district: 'Downtown',
    text: "Drive to Vinnie's office and settle the debt.",
    story: "Debt paid. Neon Bay is Rico's again — free roam, no more jobs.",
    speaker: 'VINNIE "THE LEDGER" MARLOW',
    marker: { x: 60, z: 120 },
  },
];

export function rankFor(rp) {
  if (rp >= 800) return 'S';
  if (rp >= 500) return 'A';
  if (rp >= 250) return 'B';
  if (rp >= 100) return 'C';
  return 'D';
}

// District by quadrant of the city grid.
export function districtAt(x, z) {
  if (x < 0 && z < 0) return 'Old Town';
  if (x >= 0 && z < 0) return 'Marina';
  if (x < 0 && z >= 0) return 'Harbour';
  return 'Downtown';
}

export function makeJobs() {
  const state = {
    index: 0,
    money: 0,
    rp: 0,
    doneByDistrict: {},
    missionsDone: 0,
    banner: '',
    bannerTimer: 0,
  };

  function current() {
    return JOBS[Math.min(state.index, JOBS.length - 1)];
  }
  function next() {
    return JOBS[Math.min(state.index + 1, JOBS.length - 1)];
  }
  function standingHere(district) {
    return (state.doneByDistrict[district] || 0) * 25;
  }

  // Returns the completed job, or null. Completion pays, adds RP, updates
  // per-district standing and shows the banner with the story line.
  function tryComplete(px, pz) {
    if (state.index >= JOBS.length) return null;
    const job = JOBS[state.index];
    const dx = px - job.marker.x;
    const dz = pz - job.marker.z;
    if (dx * dx + dz * dz > 36) return null; // within 6 m
    state.money += job.pay;
    state.rp += Math.round(job.pay / 2) + 25;
    state.doneByDistrict[job.district] = (state.doneByDistrict[job.district] || 0) + 1;
    state.missionsDone += 1;
    state.index += 1;
    state.banner = `MISSION COMPLETE — ${job.title} +$${job.pay}`;
    state.bannerTimer = 4;
    return job;
  }

  function applySave(save) {
    state.money = save.money || 0;
    state.index = Math.max(0, Math.min(JOBS.length, save.missionIndex || 0));
    state.rp = save.rp || 0;
    state.missionsDone = state.index;
  }

  return {
    state, JOBS, current, next, standingHere, tryComplete, applySave,
    get money() { return state.money; },
    get rp() { return state.rp; },
    get rank() { return rankFor(state.rp); },
  };
}
