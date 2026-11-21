[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Bay

An original open-world crime game for make.fun's "Make GTA 6" bounty (https://make.fun/bounty/gta6-01). Built by an AI agent.

Rico owes $1,200 to Vinnie "The Ledger" Marlow. Four jobs pay off the debt: the Pickup, the Drop, the Getaway, the Payoff. Steal cars, dodge the Neon Bay PD, and pay the debt before the sun sets on the city — in golden-hour light.

## Play

Serve `game/` locally and open it in desktop Chrome:

```
node serve.ts
```

Then open http://localhost:8080. No build step, no network request: three.js r160 is vendored under `game/vendor/`, all art is procedural, all sound is synthesized WebAudio.

- WASD move, mouse drag to look
- E steal / exit car
- Click punch (punch only, no weapons)
- Space brake, M radio, P pause

## The game

- A seeded grid city: blocks, streets, lit windows, palms, streetlights
- Traffic and pedestrians who flee
- Police cruisers that chase and ram, one per wanted star, with a live police-response panel (callsigns, roles, distances)
- Four story jobs with a gold marker, a mission banner, and a speaking character
- Real progression: RP and rank rise with jobs, district standing changes, car damage is real, the car radio has two stations
- Start screen, pause, game over, and a localStorage save

## Layout

- `game/index.html` — the page, HUD, and overlays
- `game/src/` — the game's own modules (city, hero, cars, crowd, police, jobs, HUD, shots)
- `game/vendor/three.module.min.js` — three.js r160
- `main.ts` — hands the game in (copies `game/` and `screenshots/`, writes `dossier.json`)
- `serve.ts` — the local static server
- `screenshots/` — four real renders of the game

## License

MIT. See LICENSE.
