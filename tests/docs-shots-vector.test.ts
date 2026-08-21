// SPDX-License-Identifier: MPL-2.0
/**
 * The /info docs are vector-first: a docs screenshot is an SVG unless there is a
 * physical reason it cannot be.
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
 * See plans/69-svg-snapshot-without-print.md section 16.3 for the full diagnosis of each.
 */
const RASTER_ALLOWED: Record<string, string> = {
  // gallery + aud-gallery-landscape left this list 2026-07-31: the missing top nav was a
  // walker defect, not a property of the page. `.gallery-topbar` is `display: contents`,
  // whose getBoundingClientRect() is 0x0, and the walker's `rect.width < 0.5` guard was
  // dropping it AND its whole subtree. Fixed in visitSvgNode; the nav is vector again.
  // RESIDUAL, accepted: the Cover Flow covers carry a 3-D `rotateY` that parseCssMatrix
  // refuses, so they fall to the axis-aligned-box path and some cover content mis-scales.
  // They are decorative, half-cropped at the frame edge, and everything else on the page
  // - nav, hero card, tiles, footer - is faithful.
  // ov2-phone-audiogram + um-asset-audiogram left this list 2026-08-05: the walker now
  // snapshots the <canvas> (export.ts, tag === 'canvas') and downscales it to its rendered
  // box via the rasterDpi recipe param - walker=1&format=svg&rasterDpi=110 - so the audiogram
  // ships as vector chrome with the canvas embedded as a smaller bitmap, under the budget.
  'seq-onion-ghosts':
    'Onion ghosts over the scene they ghost. Neither vector path can hold both at once: '
    + 'the ghost layer is [data-export-hide] (editor chrome is deliberately unreachable '
    + 'from every export, which is what guarantees an export carries none of it), so a '
    + 'walker walk rooted above it drops the ghosts and one rooted at it drops the scene; '
    + 'and Chromium print flattens the ghost group opacity to opaque, hiding the live '
    + 'scene underneath. Re-check when the walker gains a docs-capture root that can opt '
    + 'INTO export-hidden chrome.',
  // cc-verify-masthead left this list 2026-08-05: same fix as cc-verify-mobile - the masthead
  // is a wider frame of the same storm photo, now walker=1&format=svg&rasterDpi=96 with the
  // photo downscaled to its box (under the vector budget) AND its genAI credential preserved:
  // the walker carries the source's C2PA forward as a componentOf ingredient, so a re-verify
  // of the SVG still raises the GEN AI flag (trainedAlgorithmicMedia). That provenance-through-
  // downscale fix is exactly why a raster masthead was no longer acceptable here.
  // cc-verify-mobile left this list 2026-08-05: the walker CAN now downscale an embedded
  // raster to its box, via the `rasterDpi` recipe param (ExportOpts.rasterDpi). The mobile
  // Verify shot is `walker=1&format=svg&rasterDpi=96` - vector chrome with the storm photo
  // embedded at its rendered box, under the vector budget. The masthead is a wider frame of
  // the same photo and could follow the same way.
  // incl-neuro-viz left this list 2026-07-31: the panel chrome is vector now, with only
  // the WebGL canvas embedded as a bitmap <image> (the honest hybrid - a fragment
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
      + '`walker=1&format=svg` first - most of the original PNG list converted unchanged. '
      + 'If it genuinely cannot, add it to RASTER_ALLOWED with the reason.',
  );
});

test('docs: the raster allowlist has no stale entries', () => {
  const raster = new Set(englishRecipes().filter((r) => r.format !== 'svg').map((r) => r.slug));
  const stale = Object.keys(RASTER_ALLOWED).filter((s) => !raster.has(s));
  assert.deepEqual(
    stale,
    [],
    'These slugs are no longer raster recipes - delete them from RASTER_ALLOWED so the '
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
  // Variants are suffixes on the slug: `<slug>[.<loc>][.dark].<ext>`. Strip by KNOWN
  // suffix, not by shape - `.dark` is two of the shapes a locale code can take ('de',
  // 'pt-br'), so a shape match either eats a real slug segment or misses the theme.
  const locales = readdirSync(join(DOCS, 'i18n'), { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name);
  const suffixes = new Set(['dark', ...locales]);
  const baseSlug = (f: string): string => {
    let s = f.replace(/\.(png|jpg|jpeg)$/, '');
    for (;;) {
      const m = /\.([^.]+)$/.exec(s);
      if (!m || !suffixes.has(m[1]!)) return s;
      s = s.slice(0, -m[0].length);
    }
  };
  const undeclared = bitmaps.filter((f) => !(baseSlug(f) in RASTER_ALLOWED));
  assert.deepEqual(undeclared, [], 'Undeclared bitmap baselines in docs/shots - prune them.');
});
