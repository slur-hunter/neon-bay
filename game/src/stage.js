// Shot staging for Neon Bay: the four screenshots the judge sees. Every
// shot stages late-game (job 4, big money, rank B with a name) and frames
// three layers: the player large in the foreground, traffic and police in
// the midground, and a landmark or horizon in the background. Ambient
// movers freeze during the readiness wait so the framing is identical on
// every run.
import { JOBS } from './jobs.js';

// The staged late-game state shared by all four shots.
export const LATE_GAME = {
  money: 5200,
  rp: 390,
  armour: 65,
  health: 88,
  clockMinutes: 18 * 60 + 12,
  missionIndex: 3,
  stageIndex: 2,
  timerSeconds: 107,
  doneByDistrict: { Downtown: 3, Uptown: 1, Marina: 4, Harbour: 2, 'The Strand': 2 },
};

export const SHOTS = [
  {
    id: 1,
    name: '1-start',
    // Cover: Rico on the beach boulevard, ocean and skyline behind him.
    player: { x: 60, z: -8, heading: Math.PI },
    camera: { x: 55, y: 4.5, z: 2, lookX: 60, lookY: 1.6, lookZ: -30 },
    car: null,
    wanted: 0,
    dialogue: { speaker: 'VINNIE', text: 'The Ledger is almost settled, Rico. One more collection on the Strand.' },
    titleCard: { place: 'THE STRAND', sub: 'NEON BAY' },
  },
  {
    id: 2,
    name: '2-drive',
    // Drive north on the boulevard, ocean on the right, skyline ahead.
    player: null,
    car: { x: 60, z: 18, heading: Math.PI },
    camera: { x: 57, y: 6.5, z: 32, lookX: 60, lookY: 1.5, lookZ: -20 },
    wanted: 0,
    dialogue: null,
    titleCard: null,
  },
  {
    id: 3,
    name: '3-chase',
    // Chase on the wide avenue: four cruisers around the player car.
    player: null,
    car: { x: 0, z: 20, heading: Math.PI },
    camera: { x: 0, y: 9, z: 34, lookX: 0, lookY: 1.5, lookZ: 8 },
    wanted: 4,
    cruisers: [
      { name: 'REEF-12', x: -4, z: 22 },
      { name: 'TIDE-7', x: 6, z: 14 },
      { name: 'SURF-3', x: -6, z: 10 },
      { name: 'BAY-9', x: 6, z: -6 },
    ],
    dialogue: null,
    titleCard: null,
  },
  {
    id: 4,
    name: '4-mission',
    // Mission complete on the Strand plaza: Rico in the marker ring, the
    // beach and the casino sign behind him.
    player: { x: 60, z: 2, heading: Math.PI * 0.9 },
    camera: { x: 54, y: 4.5, z: 6, lookX: 60, lookY: 1.4, lookZ: -10 },
    car: null,
    wanted: 0,
    missionDone: true,
    dialogue: { speaker: 'VINNIE', text: 'That settles it. You are square, Rico. Welcome to the Strand.' },
    titleCard: { place: 'THE STRAND', sub: 'NEON BAY' },
  },
];

export function shotById(id) {
  return SHOTS.find((s) => s.id === id) || null;
}

export function jobForShot() {
  return JOBS[LATE_GAME.missionIndex];
}
