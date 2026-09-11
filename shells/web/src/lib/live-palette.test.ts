// SPDX-License-Identifier: MPL-2.0
/**
 * toPaletteEntry reconstructs groupPalette()-compatible entries from a
 * resolved ColorSwatch. Fixtures mirror the real shape host.tokens.colors()
 * resolves for a catalog doc built by scripts/build-brand-tokens.ts (see
 * brands/suse/catalog/assets/suse/tokens/brand.json): $description → name,
 * the DTCG path's second segment → which bucket the colour came from, group
 * pre-prettified by the engine (toSwatch in engine/src/tokens.ts).
 * Run directly:  node --test shells/web/src/lib/live-palette.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPaletteEntry } from './live-palette.ts';

test('a ramp swatch keeps its family as group, so it re-groups into that ramp', () => {
  const entry = toPaletteEntry({
    path: 'color.ramp.jungle.4', name: 'Jungle 4', group: 'Jungle', value: '#30ba78', cmyk: null, spot: null,
  });
  assert.deepEqual(entry, { hex: '#30ba78', label: 'Jungle 4', cmyk: null, spot: null, group: 'Jungle' });
});

test('a spectrum swatch normalises to the lowercase literal groupPalette() checks for', () => {
  const entry = toPaletteEntry({
    path: 'color.spectrum.teal', name: 'Teal', group: 'Spectrum', value: '#00bda7', cmyk: null, spot: null,
  });
  assert.equal(entry.group, 'spectrum');
});

test('a named brand swatch drops its DTCG parent group, so it falls into the brand bucket', () => {
  // Real SUSE fixture: color.brand.pine, CMYK-tagged (build-brand-tokens.ts
  // $extensions) - the exact case this fix restores for CMYK PDF substitution.
  const entry = toPaletteEntry({
    path: 'color.brand.pine', name: 'Pine', group: 'Brand', value: '#0c322c', cmyk: [65, 0, 35, 85], spot: null,
  });
  assert.deepEqual(entry, { hex: '#0c322c', label: 'Pine', cmyk: [65, 0, 35, 85], spot: null, group: undefined });
});

test('a semantic role swatch also drops its group (no numbered suffix, so groupPalette buckets it as brand)', () => {
  const entry = toPaletteEntry({
    path: 'color.semantic.primary', name: 'Primary', group: 'Roles · Light', value: '#4f84ba', cmyk: null, spot: null,
  });
  assert.equal(entry.group, undefined);
});

test('a malformed cmyk (wrong arity) is treated as absent rather than shipped to the CMYK substituter', () => {
  const entry = toPaletteEntry({
    path: 'color.brand.oops', name: 'Oops', group: 'Brand', value: '#123456', cmyk: [1, 2, 3], spot: null,
  });
  assert.equal(entry.cmyk, null);
});

test('a spot-locked swatch passes its SpotColor through untouched', () => {
  const spot = { name: 'PANTONE 186 C', book: 'PANTONE+ Solid Coated' };
  const entry = toPaletteEntry({
    path: 'color.brand.pine', name: 'Pine', group: 'Brand', value: '#0c322c', cmyk: null, spot,
  });
  assert.deepEqual(entry.spot, spot);
});

test('a finish rides along with the spot - this layer copies, it does not curate', () => {
  // toPaletteEntry passes the SpotColor by reference, so a finish reaches the
  // palette for free. Pinned because the PDF layer downstream still flattens a
  // spot to name+CMYK, and the next slice moves that boundary, not this one.
  const spot = { name: 'Deboss', finish: 'deboss' };
  const entry = toPaletteEntry({
    path: 'color.brand.press', name: 'Press', group: 'Brand', value: '#0c322c', cmyk: null, spot,
  });
  assert.deepEqual(entry.spot, spot);
});

test('a swatch can carry both a CMYK anchor and a spot lock independently', () => {
  const spot = { name: 'PANTONE 186 C' };
  const entry = toPaletteEntry({
    path: 'color.brand.pine', name: 'Pine', group: 'Brand', value: '#0c322c', cmyk: [0, 100, 79, 4], spot,
  });
  assert.deepEqual(entry.cmyk, [0, 100, 79, 4]);
  assert.deepEqual(entry.spot, spot);
});

/**
 * The authored sRGB face reaches the CMYK export.
 *
 * The chain is long enough to be worth pinning end to end: a brand token's
 * override → `toSwatch` (engine) → `toPaletteEntry` → `buildCmykPaletteMap` →
 * the ink substituted into the PDF content stream. Every link is already tested
 * in isolation; what this asserts is that they are actually connected, which is
 * the failure mode that would ship an override nobody honours.
 *
 * The palette map is keyed by QUANTISED RGB derived from the entry's hex - so if
 * `value` carried the automatic bake instead of the authored face, the export
 * would key on the wrong colour and the swatch's own ink would never be found.
 */
test('an authored sRGB face is the hex the CMYK export keys on', async () => {
  const { createTokenSet, TOKEN_EXT } = await import('@lolly/engine');
  const { buildCmykPaletteMap, pdfColorHit } = await import('../bridge/export-pdf-vector.ts');

  const ts = createTokenSet({
    color: {
      brand: {
        $type: 'color',
        $value: 'oklch(70% 0.25 145)',                 // wide-gamut; bakes to something else
        $extensions: { [TOKEN_EXT]: { faces: { srgb: { value: '#00b050' } }, cmyk: [90, 0, 90, 0] } },
      },
    },
  });
  const entry = toPaletteEntry(ts.colors()[0]! as Parameters<typeof toPaletteEntry>[0]);
  assert.equal(entry.hex, '#00b050', 'the palette entry carries the AUTHORED bake');

  const map = buildCmykPaletteMap([{ hex: entry.hex, cmyk: entry.cmyk ? [...entry.cmyk] : undefined }]);
  // Look the colour up the way the export does: by the RGB it is about to write.
  const hit = pdfColorHit(0 / 255, 176 / 255, 80 / 255, map);
  assert.ok(hit, 'the export finds the swatch by its authored hex');
  assert.deepEqual(hit!.cmyk.map(v => Math.round(v * 100)), [90, 0, 90, 0]);

  // Anti-vacuity. The automatic bake of that same colour is a DIFFERENT rgb, and
  // the export must not find the swatch there - otherwise this test would pass
  // just as well with the face ignored.
  const auto = createTokenSet({ color: { brand: { $type: 'color', $value: 'oklch(70% 0.25 145)' } } })
    .colors()[0]!.value;
  assert.notEqual(auto.toLowerCase(), '#00b050', 'the two hexes genuinely differ');
  const n = (i: number): number => parseInt(auto.slice(i, i + 2), 16) / 255;
  assert.equal(pdfColorHit(n(1), n(3), n(5), map), null,
    'the automatic bake is NOT what the export keys on any more');
});
