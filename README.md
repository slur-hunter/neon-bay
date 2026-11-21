[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Bay

An original open-world crime game for make.fun's **Make GTA 6** bounty (gta6-01). Rico owes $1,200 to Vinnie "The Ledger" Marlow. Four jobs — The Pickup, The Drop, The Getaway, The Payoff — stand between him and freedom.

Explore a golden-hour grid city on foot and by car, steal cars, dodge police cruisers that chase and ram, punch your way out of trouble, and watch your rank, RP and district standing rise with every job done. Synthesized WebAudio only: engine hum, two-tone sirens, and a two-station car radio (M switches station).

## Play

```sh
node serve.ts
# open http://localhost:8080/game/index.html
```

WASD move · mouse drag to look · E enter / exit car · click punch · Space brake · M radio · P pause · X mute.

## Tech

Three.js r160 (vendored under `game/vendor/`), ES modules under `game/src/`, no build step, no network request at runtime. `main.ts` hands the game in: it copies `game/` and `screenshots/` and writes `dossier.json` with the vendored make.fun library.

## Screenshots

Four real renders of the game's own code: cover (on foot at golden hour), driving, a four-star police chase, and a mission complete.
