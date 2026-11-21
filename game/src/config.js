// Every tunable number and name in one place: the city layout, the palette, the
// story jobs, the ranks, the police and the radios. No code here reads a file.
export const STEP = 1 / 60;

/** The Strand runs north (negative Z) along the beach. East (+X) is the ocean. */
export const WORLD = {
  strandX: 34,
  strandHalfWidth: 7,
  beachX0: 41,
  beachX1: 58,
  oceanX0: 58,
  northEnd: -150,
  southEnd: 130,
  westEnd: -70,
  crossStreets: [-60, -20, 20, 60, 100],
  sideStreets: [8, -12, -32],
  blockDepth: 34,
};

/** Six facade colours with different window patterns, so no street reads as one block. */
export const FACADES = [
  { base: '#c98a4b', trim: '#8a5a2b', lit: 0.45 },
  { base: '#3f7d7a', trim: '#2a5553', lit: 0.5 },
  { base: '#b65a52', trim: '#7e3a34', lit: 0.4 },
  { base: '#d8c49a', trim: '#a68d5f', lit: 0.55 },
  { base: '#6f83a8', trim: '#4a5a75', lit: 0.5 },
  { base: '#a67ba0', trim: '#6f5270', lit: 0.45 },
];

export const SIGNS = [
  { text: 'THE STRAND', sub: 'NEON BAY', colour: '#e8b4d8', glow: '#ff7ad9' },
  { text: 'CASINO AZUL', sub: 'SLOTS · TABLES · SHOWS', colour: '#9fd8ff', glow: '#2fa8ff' },
  { text: 'TACOS EL FARO', sub: 'OPEN LATE', colour: '#ffd27a', glow: '#ff9d2e' },
  { text: 'HARBOUR HOTEL', sub: 'ROOMS · ROOFTOP BAR', colour: '#b8ffd2', glow: '#2ed573' },
  { text: "VINNIE'S", sub: 'THE LEDGER', colour: '#ffb3b3', glow: '#ff4757' },
  { text: 'NEON BAY', sub: 'OCEAN DRIVE', colour: '#e8e8ff', glow: '#a29bfe' },
];

export const JOBS = [
  { id: 0, title: 'COLLECT FROM MARCO', pay: 400, place: 'Marco’s stall, The Strand', detail: 'Marco owes Vinnie $400. Walk over, remind him, bring it back.' },
  { id: 1, title: 'TAKE THE DROP', pay: 600, place: 'Harbour gate', detail: 'Drive the package to the harbour gate. No detours, no cops.' },
  { id: 2, title: 'THE LAST COLLECTION', pay: 800, place: 'Casino Azul', detail: 'One more debtor at the casino. Collect $800 and stay calm.' },
  { id: 3, title: 'SETTLE WITH VINNIE', pay: 1200, place: 'The Strand', detail: 'Collect from the debtors on the Strand, then settle with Vinnie.' },
];

export const RANKS = [
  { letter: 'D', name: 'ROOKIE', min: 0 },
  { letter: 'C', name: 'HUSTLER', min: 100 },
  { letter: 'B', name: 'SHOT CALLER', min: 250 },
  { letter: 'A', name: 'KINGPIN', min: 500 },
  { letter: 'S', name: 'LEGEND', min: 800 },
];

export function rankFor(rp) {
  let found = RANKS[0];
  for (const rank of RANKS) if (rp >= rank.min) found = rank;
  const next = RANKS.find((rank) => rank.min > rp) ?? null;
  return { rank: found, next };
}

export const CRUISERS = ['REEF-12', 'TIDE-7', 'SURF-3', 'BAY-9'];

export const RADIOS = [
  { name: 'SUNSET FM', show: 'Neon Nights · The Palms', hue: '#ffb347' },
  { name: 'NIGHT DRIVE', show: 'Bassline · DJ Marlow', hue: '#7ad9ff' },
];

export const CARS = [
  { name: 'NEON STING GT', colour: 0x2e7d4f, condition: 96 },
  { name: 'PALM RUNNER', colour: 0xc0392b, condition: 71 },
  { name: 'CORAL COUPE', colour: 0xd4a017, condition: 82 },
  { name: 'HARBOUR SEDAN', colour: 0x5b6b8c, condition: 64 },
  { name: 'SAND DUNE', colour: 0xe67e22, condition: 58 },
];

export const PED_SHIRTS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xfd79a8, 0xffffff, 0x2d3436];

export const PLAYER_CAR = { name: 'NEON STING GT', colour: 0x2e7d4f, condition: 96 };

export const SAVE_KEY = 'neonbay-save-v1';
export const MISSION_TIME = 120;
export const WANTED_MAX = 4;
