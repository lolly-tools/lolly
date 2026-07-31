// SPDX-License-Identifier: MPL-2.0
/**
 * The /info docs are vector-first: a docs screenshot is an SVG unless there is a
 * reason it physically cannot be.
 *
 * This guard exists because `format=png` used to carry no expiry. Twelve of the
 * original twenty raster recipes were born PNG in the first screenshot commit and
 * were never re-tested after the DOM->SVG walker landed; when they finally were,
 * they converted on the first try (Mesh Gradient: a 708 KB PNG -> a 6 KB SVG of
 * real <radialGradient> stops). A temporary workaround had become a permanent
 * property of the file simply because nothing ever asked again.
 *
 * So the allowlist below is the ONLY place a raster docs shot may be declared, and
 * every entry has to say why. The test fails in both directions:
 *   - a new `format=png|jpg` recipe that is not listed  -> add a reason or go vector
 *   - a listed slug that is no longer raster            -> delete it from the list
 * The second direction is the one that matters. Without it the list rots exactly the
 * way `format=png` did: silently, by staying true after it stopped being true.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseShotRecipes } from '../scripts/lib/shot-compare.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');

/**
 * Slugs allowed to ship as a bitmap, each with the reason it cannot be vector.
 * See plans/svg-snapshot-without-print.md §16.3 for the full diagnosis of each.
 */
const RASTER_ALLOWED: Record<string, string> = {
  // gallery + aud-gallery-landscape left this list 2026-07-31: the missing top nav was a
  // walker defect, not a property of the page. `.gallery-topbar` is `display: contents`,
  // whose getBoundingClientRect() is 0x0, and the walker's `rect.width < 0.5` guard was
  // dropping it AND its whole subtree. Fixed in visitSvgNode; the nav is vector again.
  // RESIDUAL, accepted: the Cover Flow covers carry a 3-D `rotateY` that parseCssMatrix
  // refuses, so they fall to the axis-aligned-box path and some cover content mis-scales.
  // They are decorative, half-cropped at the frame edge, and everything else on the page
  // — nav, hero card, tiles, footer — is faithful.
  'ov2-phone-audiogram':
    'The audiogram paints to <canvas>. Vector-expressible in principle (all nine '
    + 'non-MilkDrop styles use only the 2D subset that maps onto SVG) but it needs a '
    + 'change to the TOOL, not to the pipeline.',
  'um-asset-audiogram': 'Same canvas visualiser as `ov2-phone-audiogram`.',
  // incl-neuro-viz left this list 2026-07-31: the panel chrome is vector now, with only
  // the WebGL canvas embedded as a bitmap <image> (the honest hybrid — a fragment
  // shader's per-pixel field has no geometry to recover, but everything around it does).
  // The ?neuro demo renders a fixed driven frame sequence so the embedded bitmap is
  // byte-stable under the exact-string vector compare.
};

/** Every recipe declared across the English docs pages. */
function englishRecipes() {
  const out: Array<{ slug: string; format: string; page: string }> = [];
  for (const f of readdirSync(DOCS)) {
    if (!f.endsWith('.md')) continue;
    for (const r of parseShotRecipes(readFileSync(join(DOCS, f), 'utf-8')).recipes) {
      out.push({ slug: r.slug, format: r.format, page: f });
    }
  }
  return out;
}

test('docs: every screenshot recipe is vector unless allowlisted with a reason', () => {
  const raster = englishRecipes().filter((r) => r.format !== 'svg');
  const unexplained = raster.filter((r) => !(r.slug in RASTER_ALLOWED));
  assert.deepEqual(
    unexplained.map((r) => `${r.page}: ${r.slug} (format=${r.format})`),
    [],
    'A docs shot may only be a bitmap when it physically cannot be vector. Try '
      + '`walker=1&format=svg` first — most of the original PNG list converted unchanged. '
      + 'If it genuinely cannot, add it to RASTER_ALLOWED with the reason.',
  );
});

test('docs: the raster allowlist has no stale entries', () => {
  const raster = new Set(englishRecipes().filter((r) => r.format !== 'svg').map((r) => r.slug));
  const stale = Object.keys(RASTER_ALLOWED).filter((s) => !raster.has(s));
  assert.deepEqual(
    stale,
    [],
    'These slugs are no longer raster recipes — delete them from RASTER_ALLOWED so the '
      + 'list keeps meaning what it says.',
  );
});

test('docs: every allowlist entry states a reason', () => {
  for (const [slug, why] of Object.entries(RASTER_ALLOWED)) {
    assert.ok(why.trim().length > 40, `${slug}: the reason must be specific enough to re-check later`);
  }
});

test('docs: no committed baseline is an undeclared bitmap', () => {
  // The recipes are the source of truth; docs/shots is generated. A bitmap on disk that
  // no allowlisted recipe claims is either a retired baseline nobody pruned or a shot
  // that went vector while its old pixels stayed behind and kept shipping.
  const bitmaps = readdirSync(join(DOCS, 'shots')).filter((f) => /\.(png|jpg|jpeg)$/.test(f));
  // Localized variants are `<slug>.<loc>.<ext>` and inherit their recipe's format.
  const undeclared = bitmaps.filter((f) => {
    const slug = f.replace(/\.(png|jpg|jpeg)$/, '').replace(/\.[a-z]{2}(-[a-z]+)?$/i, '');
    return !(slug in RASTER_ALLOWED);
  });
  assert.deepEqual(undeclared, [], 'Undeclared bitmap baselines in docs/shots — prune them.');
});
