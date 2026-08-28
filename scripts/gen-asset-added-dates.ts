// SPDX-License-Identifier: MPL-2.0
/**
 * gen-asset-added-dates - mint `scripts/data/asset-added-dates.json`: asset id →
 * the date its file was FIRST added in its pack's git history. The catalog-asset
 * twin of gen-tool-added-dates.ts, and it exists for the same reason: the assets
 * index must regenerate byte-identically everywhere it is checked (the
 * validate-catalog drift gate, CI included), and CI checkouts can be shallow - a
 * shallow clone answers "first commit" with whatever its truncated history starts
 * at. So git is consulted HERE, once, on a full local checkout, and
 * checksum-assets.ts writes the committed answer into each brand's index the same
 * way it writes checksums.
 *
 * One asset is dated from ONE file: its first `formats` entry, the primary. The
 * later variants (a @2x, a webp thumb, a poster) are derivatives of it, so their
 * own add dates would answer a different question.
 *
 * Two brands ship some of the same ids (the `lolly/loops/*` music is in both the
 * SUSE and lolly-start packs), so a shared id keeps the EARLIEST of the two dates:
 * that is both the true "first added anywhere" and independent of walk order.
 *
 * Assets whose files moved into their pack during the 2026-07 repository split
 * floor at the split date; the history before it lives in the archived repos.
 *
 * Usage: node scripts/gen-asset-added-dates.ts   # then npm run build:catalog:all
 */

import { readdirSync, realpathSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'scripts/data/asset-added-dates.json');

/** Every mounted brand's catalog directory. The repo-root `catalog/` view is only
 *  the ACTIVE brand's slice, so walk the pack sources directly - every mounted
 *  pack gets its dates regardless of which profile happens to be active. */
function catalogDirs(): string[] {
  const dirs: string[] = [];
  const brands = join(ROOT, 'brands');
  if (!existsSync(brands)) return dirs;
  for (const b of readdirSync(brands, { withFileTypes: true })) {
    const c = join(brands, b.name, 'catalog');
    if (b.isDirectory() && existsSync(join(c, 'assets/index.json'))) dirs.push(c);
  }
  return dirs;
}

function firstAddedDate(file: string): string | null {
  try {
    const real = realpathSync(file);
    // -M25%, matching the tool dates: a file that was moved AND re-encoded in one
    // commit drops below git's default rename threshold, and without the lower bar
    // --follow stops at the move and the asset "was added" the day it was moved.
    const out = execFileSync('git', ['-C', dirname(real), 'log', '--follow', '-M25%', '--diff-filter=A', '--format=%aI', '--', real], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!out) return null;
    const lines = out.split('\n');
    const earliest = lines[lines.length - 1]!.trim();
    return earliest ? earliest.slice(0, 10) : null;   // date only - the hour is noise
  } catch { return null; }
}

interface AssetEntry { id: string; formats?: Array<{ url: string }> }

async function main(): Promise<void> {
  const dates: Record<string, string> = {};
  let undated = 0;
  for (const catalog of catalogDirs()) {
    const index = JSON.parse(readFileSync(join(catalog, 'assets/index.json'), 'utf8')) as { assets: AssetEntry[] };
    for (const asset of index.assets) {
      const url = asset.formats?.[0]?.url;
      if (!url) continue;
      // Index urls are catalog-root absolute ("/catalog/assets/…"); resolve them
      // against THIS pack's catalog, never the repo-root view.
      const file = join(catalog, url.replace(/^\/catalog\//, ''));
      if (!existsSync(file)) continue;
      const date = firstAddedDate(file);
      if (!date) { undated++; continue; }
      if (!dates[asset.id] || date < dates[asset.id]!) dates[asset.id] = date;
    }
  }
  if (undated) console.warn(`  ? ${undated} asset file(s) have no git history yet (uncommitted?), skipped`);
  const sorted = Object.fromEntries(Object.entries(dates).sort(([a], [b]) => a.localeCompare(b)));
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`✓ ${Object.keys(sorted).length} assets dated → ${OUT}`);
  console.log('  Next: npm run build:catalog:all (mirrors `added` into every brand index)');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
