# Neon Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Bay** is an original open-world crime game that runs in a desktop browser from
its own static files — no build step, no network request. You are Rex, a courier in the
sun-soaked city of Neon Bay, and you owe $1,500 to Sal Vane, the loan shark who owns the
docks. Take his four jobs, pay the debt, and take the city back.

## What it does

- A drivable city on foot and by car: a 5×5 block street grid with traffic looping around
  the blocks, pedestrians on the sidewalks, parked cars, a bay and a wooden pier.
- Steal any car (E) and drive it — traffic stops, police notice, and the wanted level rises.
- Wanted level 0–4 stars: police cars spawn, chase you with flashing light bars, and ram
  you. Lose them and the heat cools off.
- Four story missions with a gold beacon, minimap marker, and payout: dock pickup, bank
  drop, losing the heat, and the last run to the marina. Completing all four pays the debt.
- Combat on foot (click to punch), health, game over and retry.
- HUD with money, health bar, wanted stars, mission objective and distance, speed, and a
  live Canvas 2D minimap (player, traffic, police, pedestrians, mission marker).
- Start screen with the story and controls, pause screen, and a localStorage save of your
  money and job progress.
- Bright late-afternoon sun, long shadows, and synthesized WebAudio sound (engine, sirens,
  pickup chime) with M to mute.

## How to run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Click **START THE JOB** and play.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Walk / drive (Shift to sprint on foot) |
| Mouse drag | Look around (click the scene to lock the mouse) |
| E | Steal / enter a car, get out of a car |
| Click | Punch (on foot) |
| Space | Handbrake while driving |
| P / Esc | Pause and save |
| M | Mute sound |

## Files

- `game/index.html` — the page: canvas, HUD, start/pause/game-over screens
- `game/src/main.js` — boot, lights, input, game loop, wanted decay
- `game/src/city.js` — street grid, blocks, buildings, bay, pier, collision
- `game/src/vehicles.js` — car meshes, traffic loops, parked cars, driving
- `game/src/player.js` — on-foot movement, third-person camera, entering cars
- `game/src/police.js` — police spawning, chase AI, ramming, siren light bars
- `game/src/pedestrians.js` — sidewalk walkers
- `game/src/missions.js` — the four jobs, beacon, payouts
- `game/src/combat.js` — punching, ram damage, health, game over
- `game/src/hud.js` — DOM HUD and the minimap
- `game/src/save.js` — localStorage save and load
- `game/src/audio.js` — WebAudio synth effects
- `game/src/effects.js` — particle bursts and screen shake
- `game/src/shots.js` — the four `?shot=` staged scenes for screenshots
- `game/vendor/three.module.min.js` — three.js r160, vendored
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and
  writes `dossier.json`
- `serve.ts` — the local static server for testing
- `screenshots/` — four real renders of the game (1280×800 JPEG)

Everything in the city, the characters, the vehicles, the names and the story is original.
Nothing is taken from any commercial game.

## License

MIT — see `LICENSE`.
