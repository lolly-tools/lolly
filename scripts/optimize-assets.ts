#!/usr/bin/env node
/**
 * Runs svgo over the authored catalog SVG assets (catalog/assets/**\/*.svg) in place.
 *
 * These ship and load in the gallery/pickers, so minifying them cuts transfer +
 * parse cost like the previews (npm run optimize:previews). Brand-safe config —
 * MUCH more conservative than the thumbnail pass:
 *   - inlineStyles/minifyStyles OFF: the themable two-colour icons carry a
 *     byte-exact <defs><style>.c1{…}.c2{…}</style></defs> that engine/icon-theme.ts
 *     detects with a strict regex and string-replaces `class="c1"`→fill. Inlining or
 *     reformatting that block silently makes all 122 icons un-themable.
 *   - cleanupIds/convertColors OFF: never touch url(#id) refs or exact brand colours.
 *   - floatPrecision 3: brand marks (logo typography) keep fine-curve fidelity.
 * Plus a SAFETY NET: any icon svgo would make un-themable is left untouched.
 *
 * After running, rebuild + validate the catalog (asset bytes changed → checksums):
 *   npm run optimize:assets && npm run build:catalog && npm run validate:catalog
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimize, type Config } from 'svgo';
import { isThemableIconSvg } from '../engine/src/icon-theme.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'catalog', 'assets');

const CONFIG: Config = {
  multipass: true,
  floatPrecision: 3,
  plugins: [{
    name: 'preset-default',
    params: { overrides: {
      inlineStyles: false, minifyStyles: false, cleanupIds: false,
      convertColors: false, removeUselessDefs: false, removeHiddenElems: false,
    } },
  }],
};

const svgs = readdirSync(DIR, { recursive: true })
  .map(String).filter((f) => f.endsWith('.svg'));

let totalBefore = 0, totalAfter = 0, shrunk = 0, skippedTheme = 0;

for (const rel of svgs) {
  const file = join(DIR, rel);
  const before = readFileSync(file, 'utf8');
  let after: string;
  try { after = optimize(before, CONFIG).data; } catch { continue; }
  const wasThemable = isThemableIconSvg(before);
  // Safety net: never let optimisation break a themable icon's engine contract.
  if (wasThemable && !isThemableIconSvg(after)) { skippedTheme++; continue; }
  const b = Buffer.byteLength(before), a = Buffer.byteLength(after);
  totalBefore += b; totalAfter += a;
  if (a < b) { writeFileSync(file, after); shrunk++; }
}

const pct = totalBefore ? Math.round((totalBefore - totalAfter) * 100 / totalBefore) : 0;
console.log(`svgo: optimised ${shrunk}/${svgs.length} assets — ${(totalBefore / 1024).toFixed(0)}K → ${(totalAfter / 1024).toFixed(0)}K (${pct}% smaller)`);
if (skippedTheme) console.log(`  (${skippedTheme} themable icon(s) left untouched — svgo would have broken their theme contract)`);
console.log('Next: npm run build:catalog && npm run validate:catalog  (asset checksums changed)');
