[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/slur-hunter/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Bay

An original open-world crime game built for make.fun's **Make GTA 6** bounty
(gta6-01). Rico owes $1,200 to Vinnie "The Ledger" Marlow and works it off
over four jobs across a golden-hour waterfront city: steal cars, outrun the
cruisers, make the drops.

## The city

The Strand is a waterfront avenue with the ocean on its east side, so the
horizon stays open: beach, palms, the Casino Azul sign, the Tacos El Faro
sign, and a skyline to the north. Six facade colours, lit windows, street
lamps, traffic and pedestrians on every street.

## What is in the game

- On foot and by car: walk the Strand, steal a parked car with E, drive it,
  brake with Space, punch with a click (punching a pedestrian never raises
  wanted; punching a police car does).
- Wanted 0 to 4 stars with named cruisers (REEF-12, TIDE-7, SURF-3, BAY-9)
  that chase, ram and respond by live distance, with flashing light bars and a
  live police panel.
- Four story jobs with a mission card, a marker beam and ring, a timer and a
  stage bar, and a mission-complete banner with pay. Rico's own car is the
  NEON STING GT.
- Progression: money, respect points and a rank with a name (ROOKIE, HUSTLER,
  SHOT CALLER, KINGPIN, LEGEND), district standing, health and an armour bar
  that absorbs damage before health, a time-of-day clock, a car name with
  condition and gear, and a minimap with roads, the marker, the player arrow,
  traffic and police.
- Two radio stations (SUNSET FM and NIGHT DRIVE), a siren while wanted, an
  engine hum while driving, and a sound toggle. Save and load after every job.

## Controls

WASD move / drive · Mouse drag look · E enter / exit car · Click punch ·
Space brake · M radio · X sound · P pause

## Play it

Serve `game/` with any static server (`node serve.ts` serves it on
http://localhost:8080) and open `game/index.html` in desktop Chrome. No
network request is made: every file the game loads sits under `game/`.
