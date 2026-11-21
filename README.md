[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Bay

An original open-world crime game built for make.fun's "Make GTA 6" bounty
(gta6-01). Rico owes $1,200 to Vinnie "The Ledger" Marlow. Four jobs stand
between him and freedom: a pickup, a drop, a getaway, and the payoff.

## Play

Serve it locally and open it in desktop Chrome:

```
node serve.ts
```

Then open http://localhost:8080. WASD to move and drive, mouse drag to look,
E to enter and exit cars, click to punch, Space to brake, M for the car radio,
P to pause. Your money, mission progress and RP save in the browser.

## What is in the game

- A deterministic grid city at golden hour: lit windows, streetlights, palm
  trees, traffic and pedestrians, all procedural (geometry + canvas textures).
- Cars to steal and drive, with real collision damage. Police cruisers chase
  the player at wanted levels 1-4, one cruiser per star, and ram when close.
- Four story jobs with a named contact (Vinnie "The Ledger" Marlow, and Rico
  himself for the getaway), a gold marker beam, and a MISSION COMPLETE banner.
- Progression that is really computed: RP from job pay, rank letter from RP
  thresholds, district standing from missions completed in that district.
- A car radio with two stations of synthesized WebAudio, an engine hum, a
  two-tone siren, and a localStorage save.

## Tech

Three.js r160 (vendored under `game/vendor/`), ES modules under `game/src/`,
no build step, no network request at runtime. `main.ts` hands the game in
with the kit's `vendor/makefun-game.ts` dossier builder.

Built with make.fun — https://make.fun
