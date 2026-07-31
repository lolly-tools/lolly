// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/icc-pixels.ts — ICC profiles applied to DeepFrame buffers.
 *
 * ASCII-first console output, per tests/README.md.
 *
 * Evidence comes in three kinds, so the module is never tested only against
 * itself:
 *   - EXTERNAL anchors: sRGB encoded 0.5 -> linear 0.21404114 (IEC 61966-2.1)
 *     -> CIE L* 53.389; ICC PCS illuminant nCIEXYZ (0.9642, 1.0, 0.8249)
 *     (ICC.1:2010 sec. 7.2.16); CIE L* of Y=0.5 = 76.069.
 *   - CROSS checks: the lattice path against icc.ts's own toLab on the same
 *     profile (the reader is itself pinned against littleCMS in icc.test.ts).
 *   - ROUND trips with STATED tolerances (see each test) plus refusal cases.
 *
 * The in-tree srgbIccProfile() is a matrix/TRC profile (direct per-pixel
 * path); the LUT/tetrahedral lattice path is exercised with synthetic mft2
 * profiles built from tests/helpers/icc-fixture.ts.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseIccProfile, type IccProfile } from '../engine/src/icc.ts';
import { srgbIccProfile } from '../engine/src/color.ts';
import { convertSpace, createDeepFrame, type DeepFrame } from '../engine/src/pixels.ts';
import {
  ICC_DEVICE_SPACE,
  applyIccToFrame,
  convertViaIcc,
  iccResolvedIntent,
} from '../engine/src/icc-pixels.ts';
import { ascii, buildProfile, descTag, identityCurv, mft2, pressProfileBytes, u16, u32 } from './helpers/icc-fixture.ts';

// ─── fixtures ─────────────────────────────────────────────────────────────────

/** Parsed in-tree sRGB writer profile — a v2 matrix/TRC display profile. */
function srgbProfile(): IccProfile {
  const p = parseIccProfile(srgbIccProfile());
  assert.ok(p, 'the in-tree srgbIccProfile() bytes must parse back through icc.ts');
  return p;
}

/** A 1-row device frame from RGBA pixel tuples. */
function frameOf(pixels: ReadonlyArray<readonly [number, number, number, number]>): DeepFrame {
  const f = createDeepFrame(pixels.length, 1);
  pixels.forEach((px, i) => f.data.set(px, i * 4));
  return f;
}

/** Deterministic pseudo-random values (mulberry32) so failures reproduce. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * An mft2 element whose CLUT is the IDENTITY map on the encoded values (grid 2,
 * corner nodes = corner coordinates, last channel fastest per ICC.1:2010
 * sec. 10.10) — so A2B0 = decodePcs and B2A0 = encodePcs exactly, and the
 * device -> PCS -> device trip is the identity by construction. Both the decode
 * and the map are affine, which tetrahedral interpolation reproduces exactly:
 * any residual in the round trip below is the lattice machinery's own.
 */
function identityMft2(): number[] {
  const el: number[] = [...ascii('mft2'), 0, 0, 0, 0, 3, 3, 2, 0];
  for (const v of [1, 0, 0, 0, 1, 0, 0, 0, 1]) el.push(...u32(v * 65536));
  el.push(...u16(2), ...u16(2));
  for (let d = 0; d < 3; d++) el.push(...u16(0), ...u16(65535));
  for (let c0 = 0; c0 < 2; c0++) {
    for (let c1 = 0; c1 < 2; c1++) {
      for (let c2 = 0; c2 < 2; c2++) el.push(...u16(c0 * 65535), ...u16(c1 * 65535), ...u16(c2 * 65535));
    }
  }
  for (let k = 0; k < 3; k++) el.push(...u16(0), ...u16(65535));
  return el;
}

/** An RGB Lab-PCS LUT profile with an identity A2B0/B2A0 pair. */
function identityLutProfile(): IccProfile {
  const p = parseIccProfile(buildProfile({
    deviceClass: 'mntr', space: 'RGB ', pcs: 'Lab ',
    tags: [['A2B0', identityMft2()], ['B2A0', identityMft2()]],
  }));
  assert.ok(p, 'the identity LUT profile must parse');
  return p;
}

// ─── the direct (matrix/TRC) path, against the in-tree sRGB profile ───────────

test('sRGB profile: device -> PCS -> device round trip is identity within TRC-table tolerance', () => {
  const p = srgbProfile();
  // Tolerance 1e-3 on device values, and why: the profile's TRC is a
  // 1024-sample 16-bit table, so the dominant error is 16-bit sample rounding
  // (~7.6e-6 in linear light) pulled back through the inverse curve, whose
  // slope tops out at 12.92 in the linear toe -> ~1e-4 encoded; the bisection
  // inverse adds 2^-41. 1e-3 clears that by an order of magnitude while still
  // failing on any real defect (a swapped channel or a skipped curve is >1e-2).
  const rand = rng(0xC0FFEE);
  const pixels: [number, number, number, number][] = [];
  for (let i = 0; i < 64; i++) {
    pixels.push([0.02 + rand() * 0.96, 0.02 + rand() * 0.96, 0.02 + rand() * 0.96, rand()]);
  }
  const dev = frameOf(pixels);
  const lab = applyIccToFrame(dev, p, 'toPcs', 'relative');
  assert.ok(lab, 'toPcs must succeed on a matrix/TRC profile');
  assert.equal(lab.space, 'lab', 'the PCS side is a real lab frame');
  const back = applyIccToFrame(lab, p, 'fromPcs', 'relative');
  assert.ok(back, 'fromPcs must succeed');
  assert.equal(back.space, ICC_DEVICE_SPACE, 'device output carries the device sentinel space');
  for (let i = 0; i < dev.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(back.data[i + c]! - dev.data[i + c]!);
      assert.ok(d <= 1e-3, `pixel ${i / 4} ch ${c}: round-trip drift ${d} exceeds 1e-3`);
    }
    assert.equal(back.data[i + 3], dev.data[i + 3], 'alpha passes through both legs untouched');
  }
});

test('sRGB white -> PCS lands on Lab (100,0,0) and the ICC PCS illuminant XYZ', () => {
  const p = srgbProfile();
  const lab = applyIccToFrame(frameOf([[1, 1, 1, 1]]), p, 'toPcs', 'relative');
  assert.ok(lab);
  // Media-relative colorimetry maps device white to the PCS white.
  assert.ok(Math.abs(lab.data[0]! - 100) < 0.1, `white L* = ${lab.data[0]}, expected 100`);
  assert.ok(Math.abs(lab.data[1]!) < 0.3 && Math.abs(lab.data[2]!) < 0.3,
    `white a*/b* = (${lab.data[1]}, ${lab.data[2]}), expected neutral`);
  // And in XYZ: the PCS illuminant nCIEXYZ (0.9642, 1.0, 0.8249) — ICC.1:2010
  // sec. 7.2.16. Converted through pixels.ts's own Lab->XYZ leg, so this also
  // pins that the two modules' Lab conventions (L 0..100, D50) agree.
  const xyz = convertSpace(lab, 'xyz-d50');
  const want = [0.9642, 1.0, 0.8249];
  for (let c = 0; c < 3; c++) {
    const d = Math.abs(xyz.data[c]! - want[c]!);
    assert.ok(d < 2e-3, `white XYZ[${c}] = ${xyz.data[c]}, expected ${want[c]} (PCS illuminant)`);
  }
});

test('sRGB mid-grey anchor: encoded 0.5 -> L* 53.389 (not a linear 50)', () => {
  const p = srgbProfile();
  const lab = applyIccToFrame(frameOf([[0.5, 0.5, 0.5, 1]]), p, 'toPcs', 'relative');
  assert.ok(lab);
  // External anchor, computed outside this codebase: IEC 61966-2.1 EOTF puts
  // encoded 0.5 at linear 0.21404114; CIE L* of Y = 0.21404114 is 53.389. A
  // transform that skipped the TRC would return ~76 (L* of Y=0.5) and one that
  // read encoded values as L* would return 50 — both far outside 0.05.
  assert.ok(Math.abs(lab.data[0]! - 53.389) < 0.05, `mid-grey L* = ${lab.data[0]}, expected 53.389`);
  assert.ok(Math.abs(lab.data[1]!) < 0.05 && Math.abs(lab.data[2]!) < 0.05, 'mid-grey stays neutral');
});

test('device values above 1.0 clamp: ICC transforms are display-referred', () => {
  const p = srgbProfile();
  const boosted = applyIccToFrame(frameOf([[1.5, 1.5, 1.5, 1]]), p, 'toPcs', 'relative');
  const white = applyIccToFrame(frameOf([[1, 1, 1, 1]]), p, 'toPcs', 'relative');
  assert.ok(boosted && white);
  for (let c = 0; c < 3; c++) {
    assert.equal(boosted.data[c], white.data[c], 'HDR headroom does not survive an ICC transform');
  }
});

// ─── the LUT / tetrahedral lattice path ───────────────────────────────────────

test('intent selects the table: A2B0 vs A2B1 read differently, absent tables fall back to perceptual', () => {
  const withBoth = parseIccProfile(buildProfile({
    deviceClass: 'mntr', space: 'RGB ', pcs: 'Lab ',
    tags: [
      ['A2B0', mft2(3, 3, [0x4000, 0x8000, 0x8000])], // constant L* = 16384*100/65280 = 25.098
      ['A2B1', mft2(3, 3, [0xC000, 0x8000, 0x8000])], // constant L* = 49152*100/65280 = 75.294
    ],
  }));
  assert.ok(withBoth, 'the two-table profile must parse');
  const px = frameOf([[0.3, 0.6, 0.9, 1]]);
  const perc = applyIccToFrame(px, withBoth, 'toPcs', 'perceptual');
  const rel = applyIccToFrame(px, withBoth, 'toPcs', 'relative');
  assert.ok(perc && rel);
  // Constant CLUTs, so the lattice+tetrahedral machinery must return the
  // node value exactly; 0.01 only allows float32 storage noise.
  assert.ok(Math.abs(perc.data[0]! - 25.098) < 0.01, `perceptual read A2B0: L*=${perc.data[0]}`);
  assert.ok(Math.abs(rel.data[0]! - 75.294) < 0.01, `relative read A2B1: L*=${rel.data[0]}`);
  assert.ok(Math.abs(perc.data[0]! - rel.data[0]!) > 40, 'the two intents must read different tables');

  // Only A2B0 exists: saturation and absolute both degrade to the perceptual
  // table (ICC.1:2010 clause 8: only the ...0 pair is universally required),
  // and iccResolvedIntent reports the substitution instead of hiding it.
  const only0 = parseIccProfile(buildProfile({
    deviceClass: 'mntr', space: 'RGB ', pcs: 'Lab ',
    tags: [['A2B0', mft2(3, 3, [0x4000, 0x8000, 0x8000])]],
  }));
  assert.ok(only0);
  assert.equal(iccResolvedIntent(only0, 'toPcs', 'saturation'), 'perceptual');
  assert.equal(iccResolvedIntent(only0, 'toPcs', 'absolute'), 'perceptual');
  assert.equal(iccResolvedIntent(withBoth, 'toPcs', 'relative'), 'relative', 'no fallback when the table exists');
  const sat = applyIccToFrame(px, only0, 'toPcs', 'saturation');
  assert.ok(sat, 'a missing saturation table must not refuse to render');
  assert.ok(Math.abs(sat.data[0]! - 25.098) < 0.01, 'the fallback renders through A2B0');
  assert.equal(iccResolvedIntent(only0, 'fromPcs', 'perceptual'), null,
    'no B2A and no direct inverse: the reverse direction is honestly unusable');
});

test('identity LUT profile round-trips random pixels through the tetrahedral lattice', () => {
  const p = identityLutProfile();
  // Tolerance 1e-3, and why: the sampled transform is affine per channel
  // (identity CLUT composed with the legacy16 Lab encode/decode, which cancel
  // — see icc.ts decodePcs), and tetrahedral interpolation reproduces affine
  // functions exactly, so the only residual is float32 lattice storage and
  // accumulation (~1e-7 relative). 1e-3 is three orders of margin; a wrong
  // tetrahedron pick or stride shows up as >1e-2 on off-diagonal pixels.
  // Values stay in [0.05, 0.95] so the legacy16 overrange (L* up to 100.39 at
  // device 1.0) stays inside the lattice's Lab encoding box.
  const rand = rng(0xBADA55);
  const pixels: [number, number, number, number][] = [];
  for (let i = 0; i < 128; i++) {
    pixels.push([0.05 + rand() * 0.9, 0.05 + rand() * 0.9, 0.05 + rand() * 0.9, 1]);
  }
  const dev = frameOf(pixels);
  const lab = applyIccToFrame(dev, p, 'toPcs', 'perceptual');
  assert.ok(lab);
  // Cross-check the lattice against the reader's own per-colour answer.
  for (const i of [0, 40, 124]) {
    const direct = p.toLab('perceptual', [dev.data[i * 4]!, dev.data[i * 4 + 1]!, dev.data[i * 4 + 2]!]);
    assert.ok(direct);
    for (let c = 0; c < 3; c++) {
      assert.ok(Math.abs(lab.data[i * 4 + c]! - direct[c]!) < 1e-3,
        `pixel ${i} ch ${c}: lattice ${lab.data[i * 4 + c]} vs direct toLab ${direct[c]}`);
    }
  }
  const back = applyIccToFrame(lab, p, 'fromPcs', 'perceptual');
  assert.ok(back);
  for (let i = 0; i < dev.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(back.data[i + c]! - dev.data[i + c]!);
      assert.ok(d <= 1e-3, `pixel ${i / 4} ch ${c}: LUT round-trip drift ${d} exceeds 1e-3`);
    }
  }
});

// ─── gray (single-channel direct) ─────────────────────────────────────────────

test('gray profile: kTRC direct path, Y anchor, and replication into RGB', () => {
  const p = parseIccProfile(buildProfile({
    deviceClass: 'mntr', space: 'GRAY', pcs: 'XYZ ',
    tags: [['kTRC', identityCurv()]],
  }));
  assert.ok(p, 'the synthetic gray profile must parse');
  const lab = applyIccToFrame(frameOf([[0.5, 0.5, 0.5, 1]]), p, 'toPcs', 'relative');
  assert.ok(lab);
  // External anchor: CIE L* of Y = 0.5 is 76.069 (identity tone curve, so the
  // device value IS luminance here).
  assert.ok(Math.abs(lab.data[0]! - 76.069) < 0.01, `gray 0.5 L* = ${lab.data[0]}, expected 76.069`);
  assert.ok(Math.abs(lab.data[1]!) < 0.01 && Math.abs(lab.data[2]!) < 0.01, 'gray is neutral in PCS');
  const back = applyIccToFrame(lab, p, 'fromPcs', 'relative');
  assert.ok(back);
  assert.ok(Math.abs(back.data[0]! - 0.5) < 1e-3, 'round trip recovers the ink value');
  assert.equal(back.data[0], back.data[1], 'one device channel replicates into R=G');
  assert.equal(back.data[0], back.data[2], 'and into B');
});

// ─── convertViaIcc ────────────────────────────────────────────────────────────

test('convertViaIcc chains through PCS: sRGB -> sRGB is identity, no intermediate frame semantics leak', () => {
  const p = srgbProfile();
  const rand = rng(0x5EED);
  const pixels: [number, number, number, number][] = [];
  for (let i = 0; i < 32; i++) pixels.push([rand() * 0.9 + 0.05, rand() * 0.9 + 0.05, rand() * 0.9 + 0.05, rand()]);
  const dev = frameOf(pixels);
  const out = convertViaIcc(dev, p, p, 'relative');
  assert.ok(out, 'chaining a profile into itself must work');
  assert.equal(out.space, ICC_DEVICE_SPACE);
  for (let i = 0; i < dev.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(out.data[i + c]! - dev.data[i + c]!);
      assert.ok(d <= 2e-3, `pixel ${i / 4} ch ${c}: chained drift ${d} exceeds 2e-3`);
    }
    assert.equal(out.data[i + 3], dev.data[i + 3], 'alpha survives the fused chain');
  }
  // And across profile kinds: sRGB (direct) into the identity LUT profile
  // (lattice). The destination's device side is the legacy16 Lab encoding, so
  // mid-grey L* 53.389 must land at (L/100)*(65280/65535) = 0.53175.
  const grey = convertViaIcc(frameOf([[0.5, 0.5, 0.5, 1]]), p, identityLutProfile(), 'relative');
  assert.ok(grey);
  assert.ok(Math.abs(grey.data[0]! - 0.53175) < 1e-3, `mixed-kind chain: got ${grey.data[0]}, expected 0.53175`);
});

// ─── refusals (never throw; null per icc.ts's convention) ─────────────────────

test('unsupported and malformed inputs refuse cleanly with null', () => {
  const srgb = srgbProfile();
  const dev = frameOf([[0.5, 0.5, 0.5, 1]]);

  // CMYK: four device channels have no RGBA-frame representation yet.
  const cmyk = parseIccProfile(pressProfileBytes());
  assert.ok(cmyk);
  assert.equal(applyIccToFrame(dev, cmyk, 'toPcs', 'perceptual'), null, 'CMYK toPcs refused');
  const lab1 = applyIccToFrame(dev, srgb, 'toPcs', 'relative');
  assert.ok(lab1);
  assert.equal(applyIccToFrame(lab1, cmyk, 'fromPcs', 'perceptual'), null, 'CMYK fromPcs refused');

  // One-way RGB LUT profile: forward works, reverse honestly refuses.
  const oneWay = parseIccProfile(buildProfile({
    deviceClass: 'mntr', space: 'RGB ', pcs: 'Lab ',
    tags: [['A2B0', mft2(3, 3, [0x8000, 0x8080, 0x8080])]],
  }));
  assert.ok(oneWay);
  assert.ok(applyIccToFrame(dev, oneWay, 'toPcs', 'perceptual'), 'A2B0-only profile renders forward');
  assert.equal(applyIccToFrame(lab1, oneWay, 'fromPcs', 'perceptual'), null, 'no B2A: reverse refused');
  assert.equal(convertViaIcc(dev, srgb, oneWay, 'perceptual'), null, 'chain refused when the reverse leg is missing');

  // A profile with no transform at all (desc only).
  const empty = parseIccProfile(buildProfile({
    deviceClass: 'mntr', space: 'RGB ', pcs: 'XYZ ',
    tags: [['desc', descTag('nothing here')]],
  }));
  assert.ok(empty, 'a transformless profile still parses');
  assert.equal(applyIccToFrame(dev, empty, 'toPcs', 'perceptual'), null, 'no tables, no matrix/TRC: refused');
  assert.equal(iccResolvedIntent(empty, 'toPcs', 'perceptual'), null);

  // Frame-shape refusals.
  assert.equal(applyIccToFrame(createDeepFrame(1, 1, 'lab'), srgb, 'toPcs', 'relative'), null,
    'a lab frame is not device channels');
  assert.equal(applyIccToFrame(lab1, srgb, 'toPcs', 'relative'), null, 'toPcs refuses its own output');
  const deviceOut = applyIccToFrame(lab1, srgb, 'fromPcs', 'relative');
  assert.ok(deviceOut);
  assert.equal(applyIccToFrame(deviceOut, srgb, 'fromPcs', 'relative'), null,
    'fromPcs refuses a device-sentinel frame: device values are not colorimetric');
  const badLen = { width: 2, height: 2, data: new Float32Array(3), space: 'srgb-linear' } as DeepFrame;
  assert.equal(applyIccToFrame(badLen, srgb, 'toPcs', 'relative'), null, 'length/dims mismatch refused');
  assert.equal(applyIccToFrame(dev, null as unknown as IccProfile, 'toPcs', 'relative'), null, 'null profile refused');
  assert.equal(
    applyIccToFrame(dev, srgb, 'sideways' as never, 'relative'), null, 'unknown direction refused');
  assert.equal(applyIccToFrame(dev, srgb, 'toPcs', 'vivid' as never), null, 'unknown intent refused (proto keys included)');
  assert.equal(applyIccToFrame(dev, srgb, 'toPcs', 'constructor' as never), null, 'prototype key is not an intent');
});

test('non-finite pixel values are read as 0, not NaN-poisoned or fatal', () => {
  const p = srgbProfile();
  const f = frameOf([[Number.NaN, 0.5, Number.POSITIVE_INFINITY, 1]]);
  const lab = applyIccToFrame(f, p, 'toPcs', 'relative');
  assert.ok(lab, 'a damaged pixel must not refuse the whole frame');
  for (let c = 0; c < 3; c++) assert.ok(Number.isFinite(lab.data[c]!), 'output stays finite');
});

// ─── fromPcs accepts any colorimetric space (per-scanline Lab conversion) ─────

test('fromPcs converts a non-lab colorimetric frame per scanline before applying the profile', () => {
  const p = srgbProfile();
  const lab = applyIccToFrame(frameOf([[0.5, 0.5, 0.5, 1]]), p, 'toPcs', 'relative');
  assert.ok(lab);
  const xyz = convertSpace(lab, 'xyz-d50');
  const fromLab = applyIccToFrame(lab, p, 'fromPcs', 'relative');
  const fromXyz = applyIccToFrame(xyz, p, 'fromPcs', 'relative');
  assert.ok(fromLab && fromXyz);
  for (let c = 0; c < 3; c++) {
    assert.ok(Math.abs(fromLab.data[c]! - fromXyz.data[c]!) < 1e-4,
      'the same colour expressed in xyz-d50 must produce the same device values');
  }
});

// ─── real profile (gated fixture, same convention as icc-real-profiles.test.ts) ─

const PROFILE_DIR = process.env.ICC_PROFILE_DIR || join(homedir(), 'Desktop', 'profiles');

test('real profile: sRGB-v2-2014.icc applied to a 2x2 frame round-trips', (t) => {
  const path = join(PROFILE_DIR, 'sRGB-v2-2014.icc');
  if (!existsSync(path)) {
    t.skip(`real-profile fixture not on this machine: ${path}`);
    return;
  }
  const p = parseIccProfile(new Uint8Array(readFileSync(path)));
  assert.ok(p, 'the ICC-published sRGB v2 profile must parse');
  const dev = createDeepFrame(2, 2);
  dev.data.set([1, 1, 1, 1], 0);
  dev.data.set([0.5, 0.5, 0.5, 1], 4);
  dev.data.set([0.8, 0.2, 0.1, 1], 8);
  dev.data.set([0.02, 0.02, 0.02, 1], 12);
  const lab = applyIccToFrame(dev, p, 'toPcs', 'relative');
  assert.ok(lab);
  assert.ok(Math.abs(lab.data[0]! - 100) < 0.5, `real profile white L* = ${lab.data[0]}`);
  assert.ok(Math.abs(lab.data[4]! - 53.389) < 0.5, `real profile mid-grey L* = ${lab.data[4]} (IEC anchor 53.389)`);
  const back = applyIccToFrame(lab, p, 'fromPcs', 'relative');
  assert.ok(back);
  for (let i = 0; i < dev.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(back.data[i + c]! - dev.data[i + c]!);
      assert.ok(d <= 5e-3, `real profile pixel ${i / 4} ch ${c}: drift ${d} exceeds 5e-3`);
    }
  }
});
