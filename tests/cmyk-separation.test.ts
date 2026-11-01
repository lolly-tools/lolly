// SPDX-License-Identifier: MPL-2.0
/**
 * iccSeparation and separationLattice (engine/src/cmyk-separation.ts) against
 * the bundled CC0 FOGRA39-fitted profile (packages/node-shell/icc/).
 *
 * What a print shop would check: black and grey type stays on the K plate, a grey
 * prints at the lightness it was designed at (the device formula prints it far
 * lighter), colours inside the press gamut come back close to their source Lab,
 * no build exceeds the profile's 330 % ink limit, and the raster lattice agrees
 * with the exact conversion. Every printed Lab value here is read back through
 * the profile's own AToB table.
 *
 * Run directly:  node --test tests/cmyk-separation.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  parseIccProfile, iccSeparation, separationLattice, DEVICE_SEPARATION, NEUTRAL_EPSILON,
  rgbToCmyk, convertColor, buildCmykPaletteMap, emitEps,
} from '../engine/src/index.ts';
import type { IccProfile } from '../engine/src/icc.ts';
import { pressProfileBytes } from './helpers/icc-fixture.ts';

const PROFILE_URL = new URL('../packages/node-shell/icc/craft-coated-fogra39.icc', import.meta.url);
const profile = parseIccProfile(new Uint8Array(readFileSync(PROFILE_URL))) as IccProfile;
const sep = iccSeparation(profile)!;

const hex = (h: string): [number, number, number] =>
  [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
const sourceLab = (rgb: [number, number, number]): number[] =>
  convertColor({ space: 'srgb', components: rgb, alpha: 1, missing: 0 }, 'lab').components;
const printedLab = (ink: readonly number[]): number[] => profile.toLab('relative', ink)!;
const deltaE = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/** A fixed pseudo-random sequence, so every run checks the same colours. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

test('the bundled profile drives a separation', () => {
  assert.ok(sep, 'iccSeparation accepts the bundled profile');
  assert.equal(sep.method, 'icc');
  assert.equal(sep.profile, 'Coated FOGRA39 (fitted, craft-cms)');
  const bp = sep.blackPoints!;
  assert.ok(bp.kOnly > 15 && bp.kOnly < 20, `K-only black L* ${bp.kOnly}`);
  assert.ok(bp.rich > 9 && bp.rich < 13, `rich black L* ${bp.rich}`);
  assert.ok(bp.rich < bp.kOnly, 'four inks print darker than K alone');
});

test('paper and black are exact, and black stays on the K plate', () => {
  assert.deepEqual(sep.separate(1, 1, 1), [0, 0, 0, 0]);
  assert.deepEqual(sep.separate(0, 0, 0), [0, 0, 0, 1], 'pure black is 100 % K, so it still overprints');
});

test('every 8-bit grey separates to K only, darker greys taking more K', () => {
  let previous = -1;
  for (let v = 255; v >= 0; v--) {
    const [c, m, y, k] = sep.separate(v / 255, v / 255, v / 255);
    assert.deepEqual([c, m, y], [0, 0, 0], `grey ${v} uses no CMY`);
    assert.ok(k >= previous, `K rises as the grey darkens (grey ${v})`);
    previous = k;
  }
});

test('a grey prints near its designed lightness, unlike the device formula', () => {
  // K alone cannot print darker than about L* 17.5, so black point compensation
  // maps the whole grey scale into the K plate's range: light and mid greys move
  // less than 4 L*, dark greys more. Every grey is closer than the formula.
  for (const g of ['777777', 'bbbbbb', 'dddddd', '444444', '222222']) {
    const rgb = hex(g);
    const want = sourceLab(rgb)[0]!;
    const icc = printedLab(sep.separate(...rgb))[0]!;
    const device = printedLab(rgbToCmyk(...rgb))[0]!;
    if (want > 45) assert.ok(Math.abs(icc - want) < 4, `#${g}: printed L* ${icc.toFixed(1)} against ${want.toFixed(1)}`);
    assert.ok(Math.abs(icc - want) < Math.abs(device - want), `#${g}: L* ${icc.toFixed(1)} is closer to ${want.toFixed(1)} than the device formula's ${device.toFixed(1)}`);
  }
});

test('colours inside the press gamut come back close to their source', () => {
  // Muted colours a coated press reproduces; out-of-gamut colours take the
  // profile's own clipping and are not part of this claim.
  for (const h of ['4682b4', '8fbc8f', '708090', 'b0c4de', 'bc8f8f', '5f9ea0']) {
    const rgb = hex(h);
    const d = deltaE(sourceLab(rgb), printedLab(sep.separate(...rgb)));
    assert.ok(d < 2, `#${h}: ΔE ${d.toFixed(2)}`);
  }
});

test('no separation exceeds the profile\'s 330 % ink limit', () => {
  const rnd = lcg(11);
  for (let i = 0; i < 3000; i++) {
    const ink = sep.separate(rnd(), rnd(), rnd());
    assert.ok(ink.every(v => v >= 0 && v <= 1), 'each ink in 0..1');
    assert.ok(ink.reduce((a, b) => a + b, 0) <= 3.305, `total ink ${ink.join(',')}`);
  }
});

test('the separation is deterministic, and a caller cannot change a remembered answer', () => {
  const first = sep.separate(0.2, 0.5, 0.7);
  first[0] = 99;
  assert.notEqual(sep.separate(0.2, 0.5, 0.7)[0], 99);
  assert.deepEqual(sep.separate(0.2, 0.5, 0.7), sep.separate(0.2, 0.5, 0.7));
});

test('channels within half an 8-bit step count as one grey', () => {
  const near = sep.separate(0.5, 0.5, 0.5 + NEUTRAL_EPSILON * 0.9);
  assert.deepEqual(near.slice(0, 3), [0, 0, 0]);
  const tinted = sep.separate(0.5, 0.5, 0.5 + 2 / 255);
  assert.ok(tinted.slice(0, 3).some(v => v > 0), 'a two-step tint is a colour');
});

test('the raster lattice agrees with the exact separation', () => {
  const ink = separationLattice(sep);
  const out = new Uint8Array(4);
  const rnd = lcg(5);
  let sum = 0;
  const n = 4000;
  for (let i = 0; i < n; i++) {
    const r = (rnd() * 256) | 0, g = (rnd() * 256) | 0, b = (rnd() * 256) | 0;
    ink(r, g, b, out, 0);
    const lattice = printedLab(Array.from(out, v => v / 255));
    const exact = printedLab(sep.separate(r / 255, g / 255, b / 255));
    sum += deltaE(lattice, exact);
  }
  assert.ok(sum / n < 0.5, `mean ΔE ${(sum / n).toFixed(3)}`);
  for (const v of [0, 17, 128, 200, 255]) {
    ink(v, v, v, out, 0);
    assert.deepEqual(Array.from(out.slice(0, 3)), [0, 0, 0], `lattice grey ${v} stays on K`);
  }
  ink(0, 0, 0, out, 0);
  assert.equal(out[3], 255);
  ink(255, 255, 255, out, 0);
  assert.deepEqual(Array.from(out), [0, 0, 0, 0]);
});

test('the device separation is the formula, unchanged', () => {
  assert.equal(DEVICE_SEPARATION.separate, rgbToCmyk);
  assert.equal(DEVICE_SEPARATION.method, 'device');
  const ink = separationLattice(DEVICE_SEPARATION);
  const out = new Uint8Array(4);
  ink(51, 102, 153, out, 0);
  assert.deepEqual(Array.from(out), rgbToCmyk(51 / 255, 102 / 255, 153 / 255).map(v => (v * 255 + 0.5) | 0));
});

test('a profile that cannot drive a separation is refused, not guessed at', () => {
  const srgb = parseIccProfile(new Uint8Array(readFileSync(new URL('../engine/src/color.ts', import.meta.url))));
  assert.equal(srgb, null, 'not a profile at all');
  const flat = parseIccProfile(pressProfileBytes());
  assert.ok(flat, 'the synthetic press profile parses');
  assert.equal(iccSeparation(flat!), null, 'a K ramp with no range cannot place a grey');
  const rgb = parseIccProfile(pressProfileBytes({ space: 'RGB ' }));
  if (rgb) assert.equal(iccSeparation(rgb), null, 'an RGB profile is not a press');
});

test('the palette map and EPS writer use the separation they are given', () => {
  // A spot-only swatch has no CMYK lock, so its process equivalent comes from the separation.
  const palette = [{ hex: '#4682b4', spot: { name: 'Steel' } }];
  const device = buildCmykPaletteMap(palette).values().next().value!;
  const press = buildCmykPaletteMap(palette, sep.separate).values().next().value!;
  assert.deepEqual(device.cmyk, rgbToCmyk(...hex('4682b4')));
  assert.deepEqual(press.cmyk, sep.separate(...hex('4682b4')));

  const ir = {
    width: 10, height: 10,
    prims: [{ type: 'path', fill: { r: 70, g: 130, b: 180 }, subpaths: [{ closed: true, segments: [
      { op: 'M', x: 0, y: 0 }, { op: 'L', x: 10, y: 0 }, { op: 'L', x: 10, y: 10 },
    ] }] }],
  };
  const withPress = emitEps(ir as never, { width: 10, height: 10, cmyk: true, separate: sep.separate });
  const withDevice = emitEps(ir as never, { width: 10, height: 10, cmyk: true });
  const c = sep.separate(70 / 255, 130 / 255, 180 / 255);
  const want = c.map(v => String(Math.round(v * 1000) / 1000)).join(' ') + ' setcmykcolor';
  assert.ok(withPress.includes(want), `EPS carries the press build ${want}`);
  assert.notEqual(withPress, withDevice);
});
