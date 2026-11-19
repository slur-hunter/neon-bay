# Neon Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game that runs in a desktop browser from its own
static files — no network, no account, no downloads. A sun-soaked coastal city
is yours to take: walk its streets, steal cars, outrun the police, run five
jobs for the fixer Mara, and climb from a nobody with $200 to a Neon Bay legend.

Everything in it is original: the city, the characters, the vehicles, the
names, the story, the art and the sounds. Nothing from any commercial game.

## How to play

Open `game/index.html` in desktop Chrome, or run `node serve.ts` and open
http://localhost:8080.

- **W A S D** — move (on foot or driving)
- **SHIFT** — sprint on foot
- **MOUSE DRAG** — look around, **WHEEL** — zoom the camera
- **E** — steal a car / step out of one
- **F** — punch
- **CLICK** — shoot, once you find the pistol at the docks
- **R** — reload, **M** — mute

## What is in the game

- A procedural neon coastal city: 9x9 blocks, docks, a beach, a bridge to an
  island with a lighthouse, and the Spire tower at its heart.
- Traffic (10 cars) and pedestrians (14 walkers) living on the streets.
- Car theft, a wanted level of 1–5 stars, and police cars that chase, ram and
  bust you. Heat cools when you lay low.
- A five-job story chain from the fixer Mara, with a gold beacon marking each
  objective, cash rewards, and a bank robbery to finish.
- Combat: fists, a pistol pickup at the docks, and three armed bank guards.
- A HUD with money, wanted stars, health, speed, the clock, the objective and
  a live minimap. Progress saves to the browser.
- Synthesized sound (engine, sirens, gunshots, jingles) and pooled particle
  effects. No audio files.

## Files

- `game/index.html` — the page, HUD and start screen
- `game/src/main.js` — boot, game loop, input, game state
- `game/src/city.js` — the procedural city, sky, sun, water, landmarks
- `game/src/player.js` — on-foot movement and the orbit camera
- `game/src/vehicles.js` — cars, traffic AI, parked cars, driving physics
- `game/src/pedestrians.js` — sidewalk walkers
- `game/src/police.js` — wanted level, pursuit, busted
- `game/src/missions.js` — Mara's five-job chain and the gold beacon
- `game/src/combat.js` — punch, pistol, bank guards, health
- `game/src/hud.js` — HUD and live minimap
- `game/src/save.js` — localStorage saves
- `game/src/effects.js` — pooled particles
- `game/src/audio.js` — synthesized WebAudio sounds
- `game/src/shots.js` — the four staged screenshot scenes
- `game/vendor/three.module.min.js` — three.js r160, vendored
- `main.ts` — builds `dossier.json` from `game/` and `screenshots/`
- `serve.ts` — serves `game/` on http://localhost:8080
- `screenshots/` — four real renders of the game

## Verify it

```sh
node serve.ts            # play at http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # build the dossier
```

## License

MIT. See `LICENSE`.
