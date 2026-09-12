// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/cmyk-palette.ts - the one brand-swatch -> CMYK lookup shared by
 * every CMYK export sink (web PDF/TIFF/EPS, CLI eps-cmyk).
 *
 * Pins the two things a regression here would silently break for every sink:
 *   - cmykKey() quantises to the SAME 2-decimal precision the PDF content
 *     stream writer emits, so a brand-exact hex always looks up correctly.
 *   - buildCmykPaletteMap() gives a declared FINISH (foil, spot-uv, ...) the
 *     100% K FINISH_MASK_CMYK build, never the swatch's own colour - the
 *     documented "make a flattening RIP paint an unmistakable mask, not a
 *     plausible metallic" contract - even when an explicit cmyk lock is also
 *     present (finish must win over an anchored cmyk).
 *   - a spot-only lock derives its build from the swatch hex, and the spot
 *     entry carries the same numbers as the process build.
 *   - malformed/incomplete entries (no hex, short hex, neither cmyk nor spot)
 *     are skipped rather than corrupting the map.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cmykKey,
  buildCmykPaletteMap,
  paletteHasFinish,
  FINISH_MASK_CMYK,
  type BrandPaletteEntry,
} from '../engine/src/cmyk-palette.ts';

test('cmykKey buckets each channel to whole percent, the precision the PDF content stream writes', () => {
  // 254/255 -> "1.00" in the PDF stream, 124/255 -> "0.49" - both round-trip
  // through Math.round(x*100) without landing on a rounding boundary.
  assert.equal(cmykKey(254 / 255, 0, 0), '100,0,0');
  assert.equal(cmykKey(124 / 255, 124 / 255, 124 / 255), '49,49,49');
  assert.equal(cmykKey(0, 0, 0), '0,0,0');
  assert.equal(cmykKey(1, 1, 1), '100,100,100');
});

test('buildCmykPaletteMap looks up an exact brand hex via its locked cmyk', () => {
  const palette: BrandPaletteEntry[] = [{ hex: '#00c853', cmyk: [80, 0, 65, 0], label: 'brand green' }];
  const map = buildCmykPaletteMap(palette);
  const r = 0x00 / 255, g = 0xc8 / 255, b = 0x53 / 255;
  const hit = map.get(cmykKey(r, g, b));
  assert.ok(hit);
  assert.deepEqual(hit!.cmyk, [0.8, 0, 0.65, 0]);
  assert.equal(hit!.spot, undefined);
});

test('a declared finish always builds the 100% K mask, even over an explicit cmyk lock', () => {
  const palette: BrandPaletteEntry[] = [{
    hex: '#d4af37',
    cmyk: [10, 20, 70, 0], // an anchored "gold-ish" build a brand author picked for screen use
    spot: { name: 'Foil Gold', finish: 'foil' } as BrandPaletteEntry['spot'],
  }];
  const map = buildCmykPaletteMap(palette);
  const r = 0xd4 / 255, g = 0xaf / 255, b = 0x37 / 255;
  const hit = map.get(cmykKey(r, g, b));
  assert.ok(hit);
  assert.deepEqual(hit!.cmyk, FINISH_MASK_CMYK);
  assert.equal(hit!.spot?.name, 'Foil Gold');
  assert.equal(hit!.spot?.cmyk, FINISH_MASK_CMYK);
  assert.equal(hit!.spot?.finish, 'foil');
});

test('FINISH_MASK_CMYK is 100% K, never fully transparent or 400% TAC', () => {
  assert.deepEqual(FINISH_MASK_CMYK, [0, 0, 0, 1]);
});

test('entries missing a usable hex or with neither cmyk nor spot are skipped, not crashed on', () => {
  const palette: BrandPaletteEntry[] = [
    { hex: undefined, cmyk: [1, 2, 3, 4] } as BrandPaletteEntry,
    { hex: '#fff', cmyk: [1, 2, 3, 4] }, // too short to be a 6-digit hex
    { hex: '#123456' }, // no cmyk and no spot lock
  ];
  const map = buildCmykPaletteMap(palette);
  assert.equal(map.size, 0);
});

test('a spot-only lock with no finish derives its build from the swatch hex, and the spot mirrors it', () => {
  // Pure red converts to CMYK with no rounding, so the derived build can be
  // compared exactly: no ink where the channel is full, full ink elsewhere.
  const palette: BrandPaletteEntry[] = [{
    hex: '#ff0000',
    spot: { name: 'Brand Red' } as BrandPaletteEntry['spot'],
  }];
  const map = buildCmykPaletteMap(palette);
  const hit = map.get(cmykKey(1, 0, 0));
  assert.ok(hit);
  assert.deepEqual(hit!.cmyk, [0, 1, 1, 0]);
  assert.deepEqual(hit!.spot?.cmyk, [0, 1, 1, 0]);
  assert.equal(hit!.spot?.finish, undefined);
});

test('paletteHasFinish is true only when some swatch declares a non-empty finish', () => {
  assert.equal(paletteHasFinish(undefined), false);
  assert.equal(paletteHasFinish([]), false);
  assert.equal(paletteHasFinish([{ hex: '#000000', cmyk: [0, 0, 0, 100] }]), false);
  assert.equal(paletteHasFinish([{ hex: '#000000', spot: { name: 'x', finish: '' } as BrandPaletteEntry['spot'] }]), false);
  assert.equal(paletteHasFinish([{ hex: '#000000', spot: { name: 'x', finish: 'emboss' } as BrandPaletteEntry['spot'] }]), true);
});
