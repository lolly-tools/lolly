// SPDX-License-Identifier: MPL-2.0
/**
 * Stage the curated MilkDrop artist presets for the web shell's visualizer.
 *
 * DEPEND, DON'T VENDOR. These presets are community MilkDrop works by ~118 authors; the
 * `butterchurn-presets` package's MIT notice covers its converter, not the works. So the
 * files are never committed to this repo — they are copied out of node_modules at build
 * time into a gitignored public directory, exactly the way a font or a wasm blob from a
 * dependency is staged. `scripts/viz-preset-list.json` holds only identifiers (filename,
 * display name, author) plus a popularity flag, which is metadata rather than content.
 *
 * Ranking in that list comes from which pack butterchurn itself ships a preset in —
 * `butterchurnPresetsMinimal` is what butterchurnviz.com opens with, so membership there
 * is the closest thing to a popularity signal that exists — combined with the preset's own
 * authored `rating`, its shader richness, and a per-author cap so one prolific author can't
 * dominate the list.
 *
 * Run by the web shell's prebuild; safe to run repeatedly.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const SRC = join(repo, 'node_modules/butterchurn-presets/presets/converted');
const OUT = join(repo, 'shells/web/public/viz-presets');

interface Entry { f: string; n: string; a: string; p: number }

function main(): void {
  if (!existsSync(SRC)) {
    // Not a failure: a clone that hasn't installed the optional dependency simply gets the
    // brand-native presets, and viz-stock.ts degrades to an empty artist list.
    console.warn('[viz-presets] butterchurn-presets not installed — skipping artist presets');
    return;
  }
  const list = JSON.parse(readFileSync(join(here, 'viz-preset-list.json'), 'utf8')) as Entry[];
  mkdirSync(OUT, { recursive: true });
  const index: Array<{ id: string; name: string; author: string; popular: boolean }> = [];
  let copied = 0;
  let missing = 0;
  for (const e of list) {
    const from = join(SRC, e.f);
    if (!existsSync(from)) { missing++; continue; }
    // A stable, URL-safe id: the filenames carry spaces, brackets and punctuation.
    const id = e.f.replace(/\.json$/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 72);
    copyFileSync(from, join(OUT, `${id}.json`));
    index.push({ id, name: e.n, author: e.a, popular: e.p === 1 });
    copied++;
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index));
  console.log(`[viz-presets] staged ${copied} artist presets${missing ? ` (${missing} not found)` : ''}`);
}

main();
