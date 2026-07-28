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
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const SRC = join(repo, 'node_modules/butterchurn-presets/presets/converted');
const OUT = join(repo, 'shells/web/public/viz-presets');

/**
 * A stable, URL-safe id: the filenames carry spaces, brackets and punctuation.
 *
 * MUST MATCH `idFor` in build-viz-preset-list.ts exactly — that script is where a
 * collision is detected, and if the two disagree it stages files under names nothing
 * asks for. A slug longer than 72 chars carries a hash of the full filename, because
 * truncation alone already collided in the shipped list (two "Geiss Chaos Tile edit"
 * variants cut to one id, so one silently overwrote the other).
 */
function idFor(file: string): string {
  const slug = file
    .replace(/\.json$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  if (slug.length <= 72) return slug;
  let h = 0x811c9dc5;
  for (let i = 0; i < file.length; i++) {
    h ^= file.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${slug.slice(0, 67)}-${h.toString(16).padStart(8, '0').slice(0, 4)}`;
}

interface Entry { f: string; n: string; a: string; p: number; t?: number; l?: number }

function main(): void {
  if (!existsSync(SRC)) {
    // Not a failure: a clone that hasn't installed the optional dependency simply gets the
    // brand-native presets, and viz-stock.ts degrades to an empty artist list.
    console.warn('[viz-presets] butterchurn-presets not installed — skipping artist presets');
    return;
  }
  const list = JSON.parse(readFileSync(join(here, 'viz-preset-list.json'), 'utf8')) as Entry[];
  mkdirSync(OUT, { recursive: true });
  // Mean-luminance bounds a preset must fall inside to be OFFERED by name. Measured on a
  // real GPU; 7 of the 452 render pure black and 24 blow out to a flat white field, both
  // reproduced with the brand wrapper bypassed (so it is butterchurn rendering them, not
  // us). They are still STAGED — an id in a saved session must keep resolving — just not
  // put in front of anyone to pick. See build-viz-preset-list.ts for the full reasoning.
  const MIN_LUMA = 3;
  const MAX_LUMA = 235;
  const index: Array<{ id: string; name: string; author: string; popular: boolean; tier: number; ok: boolean }> = [];
  let copied = 0;
  let missing = 0;
  for (const e of list) {
    const from = join(SRC, e.f);
    if (!existsSync(from)) { missing++; continue; }
    const id = idFor(e.f);
    copyFileSync(from, join(OUT, `${id}.json`));
    // `tier` (1 = butterchurn's minimal pack … 6 = in no pack) is what orders the
    // picker; `popular` stays for readers that predate it.
    index.push({
      id, name: e.n, author: e.a,
      popular: e.p === 1,
      tier: e.t ?? (e.p === 1 ? 1 : 6),
      // Unaudited counts as fine: absence of a measurement is not evidence of a fault.
      ok: e.l === undefined || (e.l >= MIN_LUMA && e.l < MAX_LUMA),
    });
    copied++;
  }
  // Sweep anything the index no longer claims. Without this a preset dropped from the
  // list — or one whose id changed — stays on disk and keeps being served to a stale
  // saved session, which reads as "that preset still works" right up until a clean
  // checkout, where it does not.
  const want = new Set(index.map(e => `${e.id}.json`));
  let swept = 0;
  for (const f of readdirSync(OUT)) {
    if (f === 'index.json' || want.has(f)) continue;
    rmSync(join(OUT, f));
    swept++;
  }

  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index));
  const withheld = index.filter(e => !e.ok).length;
  console.log(`[viz-presets] staged ${copied} artist presets${missing ? ` (${missing} not found)` : ''}${swept ? `, swept ${swept} stale` : ''}${withheld ? `, ${withheld} flagged not-offerable` : ''}`);
}

main();
