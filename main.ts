// Neon Bay v7 — the entry program (Node 22, standard library only). It hands the
// game in: copies this repository's game/ and screenshots/ into the output dir and
// writes the dossier the judge reads, using the kit's vendored library.
// Run it locally with: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const dest = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameSrc = join(repoRoot, 'game');
const shotsSrc = join(repoRoot, 'screenshots');

mkdirSync(dest, { recursive: true });
cpSync(gameSrc, join(dest, 'game'), { recursive: true });
mkdirSync(join(dest, 'screenshots'), { recursive: true });
if (existsSync(shotsSrc)) {
  cpSync(shotsSrc, join(dest, 'screenshots'), { recursive: true });
}

// Caps the sealed scorer enforces: keep the dossier inside them.
const dossierText = buildDossier(dest, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(dest, 'dossier.json'), dossierText);
