// Story jobs for Neon Bay: four jobs Rico works through for Vinnie
// "The Ledger" Marlow. Each job has stages, a live timer, a stage progress
// bar and a pay. The staged late-game state is job 4, the last one.
export const JOBS = [
  {
    id: 1,
    title: 'The Pickup',
    desc: 'Pick up the package at the corner of 48th and Harbour.',
    next: 'The Drop',
    marker: { x: 0, z: -60 },
    pay: 200,
    rp: 125,
    stages: ['Reach the corner', 'Grab the package', 'Clear the street'],
  },
  {
    id: 2,
    title: 'The Drop',
    desc: 'Deliver the package to the docks before the heat arrives.',
    next: 'The Getaway',
    marker: { x: 60, z: 30 },
    pay: 350,
    rp: 140,
    stages: ['Drive to the docks', 'Hand off the package'],
  },
  {
    id: 3,
    title: 'The Getaway',
    desc: 'Lose the cruisers, then reach the beach house on the Strand.',
    next: 'The Ledger',
    marker: { x: 60, z: -60 },
    pay: 600,
    rp: 160,
    stages: ['Break the tail', 'Reach the beach house'],
  },
  {
    id: 4,
    title: 'The Ledger',
    desc: 'Collect from the debtors on the Strand, then settle with Vinnie.',
    next: 'Settle with Vinnie',
    marker: { x: 60, z: 0 },
    pay: 1200,
    rp: 190,
    stages: ['Collect the first debt', 'Collect the second debt', 'Settle with Vinnie'],
  },
];

export const RANK_NAMES = {
  D: 'DRIVER',
  C: 'FIXER',
  B: 'SHOT CALLER',
  A: 'KINGPIN',
  S: 'LEGEND',
};

export const RANK_FLOORS = { D: 0, C: 100, B: 250, A: 500, S: 800 };

export function rankFor(rp) {
  if (rp >= 800) return 'S';
  if (rp >= 500) return 'A';
  if (rp >= 250) return 'B';
  if (rp >= 100) return 'C';
  return 'D';
}

export function rankProgress(rp) {
  const rank = rankFor(rp);
  const order = ['D', 'C', 'B', 'A', 'S'];
  const idx = order.indexOf(rank);
  if (idx >= order.length - 1) return { rank, name: RANK_NAMES[rank], pct: 100, cur: rp, next: rp };
  const floor = RANK_FLOORS[rank];
  const nextFloor = RANK_FLOORS[order[idx + 1]];
  const pct = Math.round(((rp - floor) / (nextFloor - floor)) * 100);
  return { rank, name: RANK_NAMES[rank], pct, cur: rp, next: nextFloor };
}

export function formatTimer(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

// District by quadrant: Downtown north-west, Uptown north-east, Marina
// south-west, The Strand the beach strip on the east.
export function districtAt(x, z) {
  if (x >= 60) return 'The Strand';
  if (z < 0) return x < 0 ? 'Downtown' : 'Uptown';
  return x < 0 ? 'Marina' : 'Harbour';
}

export function standingFor(doneByDistrict, district) {
  return (doneByDistrict[district] || 0) * 25;
}
