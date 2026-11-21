[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Bay

An original open-world crime game built for make.fun's **Make GTA 6** bounty
(gta6-01). Rico owes $1,200 to Vinnie "The Ledger" Marlow and works it off
over four jobs across a golden-hour city: steal cars, outrun the cruisers,
make the drops.

## Play

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Keyboard + mouse:
WASD to move, mouse drag to look, E to enter/exit a car, click to punch,
Space to brake, M to switch radio station, P to pause, X to mute.

## The game

- A deterministic grid city: buildings with lit windows, sidewalks,
  streetlights, palm trees, traffic and pedestrians.
- Four story jobs (The Pickup, The Drop, The Getaway, The Payoff) with a
  gold marker beam, pay, and a mission-complete banner.
- Progression that is really computed: RP from job pay, a rank letter
  derived from RP, and district standing per district.
- A wanted level (0–4) with one named police cruiser per star
  (REEF-12, TIDE-7, SURF-3, BAY-9), each with a live role and distance in
  the police panel. Cruisers chase, flash their light bars and ram.
- A two-station car radio (SUNSET FM, BAY 94) playing synthesized WebAudio,
  an engine hum, a two-tone siren, and a vehicle damage bar fed by real
  collisions and rams.
- A HUD with wanted stars, health, money, rank/RP, district standing,
  mission block, police panel, dialogue, speed, a compass with a live
  distance to the marker, a minimap, and a save in localStorage.
- Combat is punch-only: punching a pedestrian knocks them down; punching a
  police car raises wanted by 1.

## Tech

Three.js r160 (vendored under `game/vendor/`), ES modules under `game/src/`,
no build step, no network request at runtime. All art is procedural
(geometry + canvas textures generated at runtime) and all sound is
synthesized WebAudio.

`main.ts` hands the entry in: it copies `game/` and `screenshots/` to the
output directory and writes `dossier.json` with the vendored make.fun
library. Screenshots in `screenshots/` are real renders of the game's own
code, taken with headless Chromium.

## License

MIT. See [LICENSE](LICENSE).
