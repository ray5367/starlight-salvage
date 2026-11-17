// Starlight Salvage: the program that hands the game in. It runs on Node 22
// with the standard library only, in a container with no network: it copies
// this repository's game/ and screenshots/ beside it into the output
// directory and writes dossier.json there with the vendored make.fun library,
// using the scorer's own caps so a run fails here exactly where the scorer
// would refuse the entry. Outside the grader, MAKEFUN_OUTPUT_DIR stands in
// for /output, and both runs must write the same bytes. The output shares the
// platform's own cap (1,000 entries, 64 MiB) between game/, screenshots/ and
// dossier.json, so the caps below leave the other two room.
// v3 (2026-11-18): the game grew a 3-sector campaign with two bosses and
// thirteen ship systems; this file's contract is unchanged — same copy,
// same dossier, same determinism.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
const screenshotsDir = join(repoRoot, 'screenshots');
if (existsSync(screenshotsDir)) {
  cpSync(screenshotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
