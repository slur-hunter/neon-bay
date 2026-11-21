[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Bay

An original open-world crime game built for make.fun's **Make GTA 6** bounty
(gta6-01). Rico owes $1,200 to Vinnie "The Ledger" Marlow and works it off
over four jobs across a golden-hour coastal city: steal cars, outrun the
cruisers, make the drops, and settle the ledger on the Strand.

## The game

- A coastal open world: a grid city with a beach boulevard, an ocean horizon,
  a skyline, six facade colours, readable shop and casino signs, palms and
  streetlights, all in golden hour.
- Four story jobs (The Pickup, The Drop, The Getaway, The Ledger) with a
  mission card, a live timer, a stage progress bar, a marker beam and ring,
  and a mission-complete banner with pay.
- Wanted stars 0-4 with named cruisers (REEF-12, TIDE-7, SURF-3, BAY-9) and
  live roles: RAMMING under 7 m, PURSUIT under 30 m, RESPONDING otherwise.
  Cruisers ram, flash red and blue light bars, and the heat decays when you
  break away.
- Progression you can see: health and armour bars, money, a rank name with a
  respect progress bar (DRIVER, FIXER, SHOT CALLER, KINGPIN, LEGEND),
  per-district standing, a time-of-day clock, a car model name with a
  condition percentage and a gear indicator, a live minimap, two synthesized
  radio stations, and a dialogue portrait for Vinnie.
- Punching a pedestrian knocks them down and does NOT raise wanted. Punching
  a police car does. Stealing a car raises the heat to one star. Saves
  persist in localStorage, including per-district standing.

## Controls

WASD move / drive · Mouse drag look · E enter / exit car · Click punch ·
Space brake · M radio station · X sound · P pause

## Play it

Serve it locally with `node serve.ts`, then open http://localhost:8080.
The four screenshots are staged with `?shot=1`, `?shot=2`, `?shot=3` and
`?shot=4` (with `&seed=1` for a deterministic city).

## Build

Node 22, standard library only. `node main.ts` copies `game/` and
`screenshots/` to the output directory and writes `dossier.json`.
