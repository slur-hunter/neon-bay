# Neon Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game that runs offline in a desktop browser. Rico the courier owes $1,200 to Vinnie "The Ledger" Marlow, and four jobs stand between him and a clean slate. Explore Neon Bay on foot and by car, steal cars, outrun the police, and earn every dollar.

## What is in the game

- A drivable city: 5x5 blocks of streets, sidewalks, buildings, streetlights and palms, in bright late-afternoon sun
- On foot and by car: walk the streets, steal a parked car (E), drive it, brake, and hop out again
- Traffic and pedestrians: cars drive their lanes, people stroll the sidewalks and scatter from a speeding car
- Wanted level and police: stealing raises stars, cruisers chase and ram, and the heat decays once you escape their sight
- Missions and a story: four jobs (pickup, drop, getaway, payoff) with markers, payouts and story text
- Combat: punch on foot (click) — the police notice
- HUD with a minimap: stars, health, money, speed, mission objective, and a live map of the player, cars, police and the mission marker
- Start screen, pause, game over, and a save (localStorage) of money and mission progress
- Synthesized sound: engine hum, sirens, pickup chime, punch and crash — all WebAudio, no audio files

## How to run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network request: every file the game loads lives under `game/`.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Mouse drag | Look around |
| E | Steal / exit car |
| Click | Punch (on foot) |
| Space | Brake |
| Shift | Run |
| P / Esc | Pause |
| M | Mute |

## Files

- `game/index.html` — the page, HUD and overlays
- `game/src/main.js` — bootstrap, game loop, camera, input, wiring
- `game/src/city.js` — the city: streets, blocks, buildings, lights
- `game/src/player.js` — Rico on foot
- `game/src/vehicles.js` — parked cars, traffic, driving physics
- `game/src/pedestrians.js` — people on the sidewalks
- `game/src/police.js` — the wanted system and the chase
- `game/src/missions.js` — the four jobs and their markers
- `game/src/combat.js` — the punch
- `game/src/effects.js` — particles and camera shake
- `game/src/hud.js` — stars, health, money, minimap, overlays
- `game/src/audio.js` — synthesized WebAudio sounds
- `game/src/save.js` — localStorage save and load
- `game/src/shots.js` — staged `?shot=1..4` scenes for screenshots
- `game/vendor/three.module.min.js` — three.js r160, vendored
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes the dossier
- `serve.ts` — the local static server
- `screenshots/` — four real renders of the game

## License

MIT. See `LICENSE`.
