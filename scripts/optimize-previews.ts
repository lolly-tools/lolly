#!/usr/bin/env node
/**
 * Runs svgo over every generated preview SVG (catalog/previews/*.svg) in place.
 *
 * `npm run previews` already svgo-optimises each thumbnail as it's captured (see
 * scripts/optimize-preview-svg.ts → svgoThumb, wired into build-previews.ts). This
 * standalone pass re-optimises the ALREADY-COMMITTED previews without a full
 * Playwright regen — useful after bumping svgo, or as a cheap pre-deploy sweep to
 * make sure nothing slipped through un-minified. Idempotent: only writes when the
 * result is smaller, so re-running is a no-op.
 *
 *   npm run optimize:previews
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svgoThumb } from './optimize-preview-svg.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'catalog', 'previews');

const svgs = readdirSync(DIR).filter((f) => f.endsWith('.svg'));
let totalBefore = 0, totalAfter = 0, shrunk = 0;

for (const name of svgs) {
  const file = join(DIR, name);
  const before = readFileSync(file, 'utf8');
  const after = svgoThumb(before);
  const b = Buffer.byteLength(before), a = Buffer.byteLength(after);
  totalBefore += b; totalAfter += a;
  if (a < b) {
    writeFileSync(file, after);
    shrunk++;
    console.log(`  ${name.padEnd(26)} ${(b / 1024).toFixed(0)}K → ${(a / 1024).toFixed(0)}K  (${Math.round((b - a) * 100 / b)}%)`);
  }
}

const pct = totalBefore ? Math.round((totalBefore - totalAfter) * 100 / totalBefore) : 0;
console.log(`\nsvgo: optimised ${shrunk}/${svgs.length} previews — ${(totalBefore / 1024).toFixed(0)}K → ${(totalAfter / 1024).toFixed(0)}K (${pct}% smaller)`);
