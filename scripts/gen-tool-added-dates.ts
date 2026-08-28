// SPDX-License-Identifier: MPL-2.0
/**
 * gen-tool-added-dates - mint `scripts/data/tool-added-dates.json`: tool id →
 * the date its tool.json was FIRST added in its pack's git history.
 *
 * Why a committed map instead of asking git at catalog-build time: the catalog
 * index must regenerate byte-identically everywhere it is checked (the
 * validate-catalog drift gate, CI included), and CI checkouts can be shallow -
 * a shallow clone answers "first commit" with whatever its truncated history
 * starts at, which would make the index disagree with the committed copy. So
 * git is consulted HERE, once, on a full local checkout, and the builder reads
 * the committed answer.
 *
 * The walk follows renames (--follow), so the 2026-08-27 one-word renames keep
 * their original dates. A tool with no history yet (brand-new, uncommitted)
 * simply doesn't appear; run this again once it is committed and rebuild the catalog.
 *
 * Usage: node scripts/gen-tool-added-dates.ts   # then npm run build:catalog:all
 */

import { readdirSync, realpathSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'scripts/data/tool-added-dates.json');

/** Every tool.json the ACTIVE PROFILE VIEW knows... is only the active brand's
 *  slice - so walk the PACK SOURCES directly instead: every mounted pack keeps
 *  its dates regardless of which profile happens to be active when this runs. */
function packDirs(): string[] {
  const dirs = [join(ROOT, 'community')];
  const brands = join(ROOT, 'brands');
  if (existsSync(brands)) {
    for (const b of readdirSync(brands, { withFileTypes: true })) {
      const t = join(brands, b.name, 'tools');
      if (b.isDirectory() && existsSync(t)) dirs.push(t);
    }
  }
  return dirs;
}

function firstAddedDate(toolJsonPath: string): string | null {
  try {
    const real = realpathSync(toolJsonPath);
    // -M25%: the 2026-08-27 one-word renames re-wrote each tool.json's id field
    // in the same commit that moved the directory, dropping similarity below
    // git's default rename threshold - without the lower bar, --follow stops at
    // the rename and every renamed tool "was added" the day it was renamed.
    const out = execFileSync('git', ['-C', dirname(real), 'log', '--follow', '-M25%', '--diff-filter=A', '--format=%aI', '--', real], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!out) return null;
    const lines = out.split('\n');
    const earliest = lines[lines.length - 1]!.trim();
    return earliest ? earliest.slice(0, 10) : null;   // date only - the hour is noise
  } catch { return null; }
}

async function main(): Promise<void> {
  // Seed from the committed map so a PACK MOVE keeps its date: a tool copied
  // into another pack has no git history there until it is committed, and its
  // true first-added date is the one already on record (e.g. 3d moved
  // community -> suse on 2026-08-28 but was first added 2026-08-16). Fresh git
  // answers still win; the seed only stands in where git has nothing yet.
  let dates: Record<string, string> = {};
  try { dates = JSON.parse(readFileSync(OUT, 'utf8')); } catch { /* first run - no map yet */ }
  const seen = new Set<string>();
  for (const pack of packDirs()) {
    for (const entry of readdirSync(pack, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifest = join(pack, entry.name, 'tool.json');
      if (!existsSync(manifest)) continue;
      let id = entry.name;
      try { id = JSON.parse(readFileSync(manifest, 'utf8')).id ?? entry.name; } catch { /* dir name stands in */ }
      seen.add(id);
      const date = firstAddedDate(manifest);
      const prev = dates[id];
      if (date && prev && date !== prev) dates[id] = date < prev ? date : prev;
      else if (date) dates[id] = date;
      else if (prev) console.warn(`  = ${id} - no git history here yet (a fresh copy or move); keeping its recorded date ${prev}`);
      else console.warn(`  ? ${id} - no git history for its tool.json (uncommitted?), skipped`);
    }
  }
  // A tool no pack ships any more drops off the map with it.
  for (const id of Object.keys(dates)) if (!seen.has(id)) delete dates[id];
  const sorted = Object.fromEntries(Object.entries(dates).sort(([a], [b]) => a.localeCompare(b)));
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`✓ ${Object.keys(sorted).length} tools dated → ${OUT}`);
  console.log('  Next: npm run build:catalog:all (mirrors `added` into every brand index)');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
