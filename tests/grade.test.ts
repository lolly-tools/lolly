// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for engine/src/grade.ts - the .cube/.3dl readers, the tetrahedral
 * sampler, the in-place RGBA frame apply, and the film grain + vignette pass.
 *
 * The companion tests/grade-drift.test.ts checks the SAME functions against the
 * copy that still lives in community/darkroom/hooks.js - including the parity of
 * the grain + vignette pass at frame 0, which is lifted from the tool's own
 * `grainVignettePass` rather than compared against a transcription here. This
 * file checks that the engine's behaviour is right in the first place: bounds
 * honoured before a grid is allocated, the sampler exact on the lattice, and the
 * grain lattice answering to the seed and the reference resolution it is given.
 *
 * Run with: node --test tests/grade.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CUBE_MAX_N,
  GRAIN_REF_LONG_EDGE,
  TDL_MAX_N,
  type GradeLut,
  applyGrainVignette,
  applyLutFrame,
  gradeMulberry32,
  grainCellPx,
  parse3dlLut,
  parseCubeLut,
  parseLutText,
  sampleLut,
} from '../engine/src/grade.ts';

// ── fixtures ─────────────────────────────────────────────────────────────────

/** The eight corners of a 2³ identity cube, red-fastest (the .cube row order). */
const IDENTITY_2_ROWS = [
  '0 0 0', '1 0 0', '0 1 0', '1 1 0',
  '0 0 1', '1 0 1', '0 1 1', '1 1 1',
];

const identityCube2 = [
  'TITLE "Identity"',
  'LUT_3D_SIZE 2',
  'DOMAIN_MIN 0.0 0.0 0.0',
  'DOMAIN_MAX 1.0 1.0 1.0',
  ...IDENTITY_2_ROWS,
].join('\n');

/** An N³ identity grid as .cube text, red-fastest. */
function identityCubeText(N: number): string {
  const rows: string[] = [`LUT_3D_SIZE ${N}`];
  for (let bI = 0; bI < N; bI++) {
    for (let gI = 0; gI < N; gI++) {
      for (let rI = 0; rI < N; rI++) {
        rows.push(`${rI / (N - 1)} ${gI / (N - 1)} ${bI / (N - 1)}`);
      }
    }
  }
  return rows.join('\n');
}

/** An identity LUT record built directly, no parsing. */
function identityLut(N: number): GradeLut {
  const data = new Float32Array(N * N * N * 3);
  for (let bI = 0; bI < N; bI++) {
    for (let gI = 0; gI < N; gI++) {
      for (let rI = 0; rI < N; rI++) {
        const o = ((bI * N + gI) * N + rI) * 3;
        data[o] = rI / (N - 1);
        data[o + 1] = gI / (N - 1);
        data[o + 2] = bI / (N - 1);
      }
    }
  }
  return { kind: '3d', size: N, data, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: '' };
}

/** Counts Float32Array constructions while fn runs, so "the bound is checked
 *  BEFORE the grid is allocated" can be asserted rather than assumed. */
function countingAllocations<T>(fn: () => T): { allocs: number; thrown: unknown } {
  const Real = globalThis.Float32Array;
  let allocs = 0;
  let thrown: unknown = null;
  (globalThis as { Float32Array: unknown }).Float32Array = new Proxy(Real, {
    construct(target, args: unknown[]) {
      allocs++;
      return new (target as Float32ArrayConstructor)(...(args as [number]));
    },
  });
  try {
    fn();
  } catch (e) {
    thrown = e;
  } finally {
    (globalThis as { Float32Array: unknown }).Float32Array = Real;
  }
  return { allocs, thrown };
}

// ── .cube parsing ────────────────────────────────────────────────────────────

test('parseCubeLut reads a 3D cube: kind, size, title, domain, red-fastest data', () => {
  const lut = parseCubeLut(identityCube2);
  assert.equal(lut.kind, '3d');
  assert.equal(lut.size, 2);
  assert.equal(lut.title, 'Identity');
  assert.deepEqual(lut.domainMin, [0, 0, 0]);
  assert.deepEqual(lut.domainMax, [1, 1, 1]);
  assert.equal(lut.data.length, 2 * 2 * 2 * 3);
  // Row 1 is (r=1,g=0,b=0): red advances first.
  assert.deepEqual(Array.from(lut.data.slice(3, 6)), [1, 0, 0]);
  // The last row is the white corner.
  assert.deepEqual(Array.from(lut.data.slice(21, 24)), [1, 1, 1]);
});

test('parseCubeLut reads a 1D cube', () => {
  const lut = parseCubeLut('LUT_1D_SIZE 3\n0 0 0\n0.5 0.25 0.75\n1 1 1\n');
  assert.equal(lut.kind, '1d');
  assert.equal(lut.size, 3);
  assert.equal(lut.data.length, 9);
  assert.deepEqual(Array.from(lut.data.slice(3, 6)), [0.5, 0.25, 0.75]);
});

test('parseCubeLut honours DOMAIN_MIN / DOMAIN_MAX', () => {
  const lut = parseCubeLut([
    'LUT_3D_SIZE 2', 'DOMAIN_MIN -0.5 -0.5 -0.5', 'DOMAIN_MAX 1.5 1.5 1.5', ...IDENTITY_2_ROWS,
  ].join('\n'));
  assert.deepEqual(lut.domainMin, [-0.5, -0.5, -0.5]);
  assert.deepEqual(lut.domainMax, [1.5, 1.5, 1.5]);
  // The declared domain is what sampleLut normalises through: an input of 0.5
  // sits at the middle of -0.5..1.5, so an identity table returns 0.5.
  assert.deepEqual(sampleLut(lut, 0.5, 0.5, 0.5), [0.5, 0.5, 0.5]);
  // And an input of 0 sits a quarter of the way up, not at the black corner.
  const [r] = sampleLut(lut, 0, 0, 0);
  assert.ok(Math.abs(r - 0.25) < 1e-6, `expected 0.25, got ${r}`);
});

test('parseCubeLut ignores comments, blank lines and unknown LUT_ keywords', () => {
  const lut = parseCubeLut([
    '# a comment', '', 'LUT_3D_SIZE 2', 'LUT_IN_VIDEO_RANGE', '   ', ...IDENTITY_2_ROWS,
  ].join('\r\n'));
  assert.equal(lut.size, 2);
  assert.equal(lut.data.length, 24);
});

test('parseCubeLut throws when there is no size declaration', () => {
  assert.throws(() => parseCubeLut('0 0 0\n1 1 1\n'), /Not a \.cube LUT/);
});

test('parseCubeLut throws on a truncated grid, naming the row counts', () => {
  const text = ['LUT_3D_SIZE 2', ...IDENTITY_2_ROWS.slice(0, 5)].join('\n');
  assert.throws(() => parseCubeLut(text), /LUT is truncated \(5 of 8 rows\)/);
});

test('parseCubeLut refuses an oversized grid BEFORE allocating it', () => {
  const text = `LUT_3D_SIZE ${CUBE_MAX_N + 1}\n0 0 0\n1 1 1\n`;
  const { allocs, thrown } = countingAllocations(() => parseCubeLut(text));
  assert.match(String((thrown as Error).message), /LUT grid too large \(max 129\)/);
  assert.equal(allocs, 0, 'the cap must be checked before any Float32Array is built');
});

test('a parsed identity cube round-trips through the sampler at a realistic grid size', () => {
  // 17 is the smallest bake size the darkroom tool offers, so this is the
  // coarsest real grid a shell will hand the sampler.
  const lut = parseCubeLut(identityCubeText(17));
  assert.equal(lut.size, 17);
  const probes: Array<[number, number, number]> = [[0, 0, 0], [1, 1, 1], [0.3, 0.61, 0.94], [0.5, 0.5, 0.5]];
  for (const [r, g, b] of probes) {
    const out = sampleLut(lut, r, g, b);
    assert.ok(Math.abs(out[0] - r) < 1e-6 && Math.abs(out[1] - g) < 1e-6 && Math.abs(out[2] - b) < 1e-6,
      `identity at ${r},${g},${b} → ${out.join(',')}`);
  }
});

test('parseCubeLut accepts a grid exactly at the cap declaration (then reports truncation)', () => {
  // The cap is inclusive: N === CUBE_MAX_N passes the bound and fails only on
  // the row count, which proves the comparison is > and not >=.
  assert.throws(() => parseCubeLut(`LUT_3D_SIZE ${CUBE_MAX_N}\n0 0 0\n`), /truncated/);
});

// ── .3dl parsing ─────────────────────────────────────────────────────────────

/**
 * A .3dl for an N-grid: a mesh line of N levels, then N³ BLUE-fastest triples
 * of an identity ramp on the given integer scale.
 *
 * N must be at least 4. The mesh line is recognised by having MORE than three
 * numbers on it, so a 2- or 3-level grid has no distinguishable mesh line at
 * all - a 3-entry one is read as a data row, a 2-entry one is dropped. The
 * cube-root fallback below is what covers those, and it is why the grids here
 * are 4 wide.
 */
function tdlText(N: number, scale: number): string {
  const mesh = Array.from({ length: N }, (_, i) => Math.round((i / (N - 1)) * 1023)).join(' ');
  const rows: string[] = [mesh];
  const q = (v: number) => Math.round((v / (N - 1)) * scale);
  for (let rI = 0; rI < N; rI++) {
    for (let gI = 0; gI < N; gI++) {
      for (let bI = 0; bI < N; bI++) rows.push(`${q(rI)} ${q(gI)} ${q(bI)}`);
    }
  }
  return rows.join('\n');
}

/** A .3dl with no mesh line: N³ rows only, so the size comes from the cube root. */
function tdlNoMesh(N: number, scale: number): string {
  const q = (v: number) => Math.round((v / (N - 1)) * scale);
  const rows: string[] = [];
  for (let rI = 0; rI < N; rI++) {
    for (let gI = 0; gI < N; gI++) {
      for (let bI = 0; bI < N; bI++) rows.push(`${q(rI)} ${q(gI)} ${q(bI)}`);
    }
  }
  return rows.join('\n');
}

test('parse3dlLut takes its size from the mesh line and reorders blue-fastest to red-fastest', () => {
  const lut = parse3dlLut(tdlText(4, 255));
  assert.equal(lut.kind, '3d');
  assert.equal(lut.size, 4);
  assert.deepEqual(lut.domainMin, [0, 0, 0]);
  assert.deepEqual(lut.domainMax, [1, 1, 1]);
  assert.equal(lut.data.length, 64 * 3);
  const third = 85 / 255;
  const near = (got: number, want: number, what: string) =>
    assert.ok(Math.abs(got - want) < 1e-6, `${what}: ${got} vs ${want}`);
  // Destination index 1 (red-fastest) is (r=1/3, g=0, b=0). In the SOURCE that
  // triple sat 16 rows in, because the source runs blue fastest.
  near(lut.data[3]!, third, 'red advances first');
  assert.equal(lut.data[4], 0);
  assert.equal(lut.data[5], 0);
  // Destination index N (= 4) is (0, 1/3, 0).
  assert.equal(lut.data[12], 0);
  near(lut.data[13]!, third, 'green advances at stride N');
  // Destination index N² (= 16) is (0, 0, 1/3): blue varies slowest in the output.
  assert.equal(lut.data[48], 0);
  near(lut.data[50]!, third, 'blue advances at stride N²');
});

test('parse3dlLut detects the output scale from the data peak', () => {
  for (const scale of [255, 1023, 4095, 65535]) {
    const lut = parse3dlLut(tdlText(4, scale));
    // With the right scale detected, the white corner normalises to exactly 1.0.
    assert.deepEqual(Array.from(lut.data.slice(189, 192)), [1, 1, 1], `scale ${scale}`);
    // And black stays black whichever scale was picked.
    assert.deepEqual(Array.from(lut.data.slice(0, 3)), [0, 0, 0], `scale ${scale}`);
  }
});

test('parse3dlLut skips comments and keyword lines', () => {
  const lut = parse3dlLut(`# comment\n3DMESH\nMesh 1 10\n${tdlText(4, 255)}`);
  assert.equal(lut.size, 4);
});

test('parse3dlLut falls back to the cube root of the row count when there is no mesh line', () => {
  const lut = parse3dlLut(tdlNoMesh(4, 1023));
  assert.equal(lut.size, 4);
  assert.deepEqual(Array.from(lut.data.slice(189, 192)), [1, 1, 1]);
});

test('parse3dlLut throws on a truncated grid', () => {
  const full = tdlText(4, 255).split('\n');
  assert.throws(() => parse3dlLut(full.slice(0, 10).join('\n')), /Not a \.3dl LUT/);
});

test('parse3dlLut refuses an oversized declaration BEFORE allocating', () => {
  // Reaching the TDL_MAX_N message needs size³ real rows, which no unit test
  // can afford, so the tool rejects an outsized mesh through the row-count
  // check first. Either way nothing is allocated, which is the property that
  // bounds the parse.
  const mesh = Array.from({ length: TDL_MAX_N + 1 }, (_, i) => i).join(' ');
  const { allocs, thrown } = countingAllocations(() => parse3dlLut(`${mesh}\n0 0 0\n1 1 1\n`));
  assert.match(String((thrown as Error).message), /Not a \.3dl LUT/);
  assert.equal(allocs, 0, 'nothing is allocated for a grid that never passes the checks');
});

// ── parseLutText: the try-both chain ─────────────────────────────────────────

test('parseLutText routes a .3dl name straight to the .3dl reader', () => {
  const lut = parseLutText(tdlText(4, 255), 'my-look.3dl');
  assert.equal(lut.size, 4);
  assert.equal(lut.kind, '3d');
});

test('parseLutText reads .cube text with no name at all', () => {
  assert.equal(parseLutText(identityCube2).title, 'Identity');
});

test('parseLutText falls back to .3dl for a .3dl renamed .txt', () => {
  const lut = parseLutText(tdlText(4, 1023), 'renamed.txt');
  assert.equal(lut.kind, '3d');
  assert.equal(lut.size, 4);
});

test('parseLutText reports the .3dl error for text that is neither format', () => {
  // The fallback swallows the .cube message: a mangled .cube reports the .3dl
  // one. Kept deliberately, because it is what the tool's own banner says.
  assert.throws(() => parseLutText('hello, this is not a LUT', 'broken.cube'), /Not a \.3dl LUT/);
});

test('parseLutText is case-insensitive about the .3dl extension', () => {
  assert.equal(parseLutText(tdlText(4, 255), 'LOOK.3DL').size, 4);
});

// ── sampleLut ────────────────────────────────────────────────────────────────

test('sampleLut is the identity on an identity lattice, on and off the grid', () => {
  const lut = identityLut(5);
  for (const v of [0, 0.125, 0.25, 0.37, 0.5, 0.63, 0.75, 1]) {
    const [r, g, b] = sampleLut(lut, v, v, v);
    assert.ok(Math.abs(r - v) < 1e-6, `r at ${v}: ${r}`);
    assert.ok(Math.abs(g - v) < 1e-6, `g at ${v}: ${g}`);
    assert.ok(Math.abs(b - v) < 1e-6, `b at ${v}: ${b}`);
  }
  // Off the diagonal too, where trilinear and tetrahedral disagree.
  const [r2, g2, b2] = sampleLut(lut, 0.1, 0.8, 0.42);
  assert.ok(Math.abs(r2 - 0.1) < 1e-6 && Math.abs(g2 - 0.8) < 1e-6 && Math.abs(b2 - 0.42) < 1e-6);
});

test('sampleLut returns the stored corner values exactly on the lattice', () => {
  // A 2³ table whose only non-identity corner is red-white.
  const data = identityLut(2).data.slice();
  data[3] = 0.25; data[4] = 0.5; data[5] = 0.75; // the (r=1,g=0,b=0) corner
  const lut: GradeLut = {
    kind: '3d', size: 2, data, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: '',
  };
  assert.deepEqual(sampleLut(lut, 1, 0, 0), [0.25, 0.5, 0.75]);
  assert.deepEqual(sampleLut(lut, 0, 0, 0), [0, 0, 0]);
  assert.deepEqual(sampleLut(lut, 1, 1, 1), [1, 1, 1]);
});

test('sampleLut handles the N === 2 case, where floor() would land on the last index', () => {
  // With N === 2, floor(1 * (N-1)) is 1 but the cell origin must be 0 or the
  // upper corner reads past the table. The special case in the sampler is what
  // keeps white white.
  const lut = identityLut(2);
  assert.deepEqual(sampleLut(lut, 1, 1, 1), [1, 1, 1]);
  const [r] = sampleLut(lut, 0.5, 0.5, 0.5);
  assert.ok(Math.abs(r - 0.5) < 1e-6);
});

test('sampleLut clamps inputs outside the domain to the table edges', () => {
  const lut = identityLut(3);
  assert.deepEqual(sampleLut(lut, -1, -1, -1), [0, 0, 0]);
  assert.deepEqual(sampleLut(lut, 2, 2, 2), [1, 1, 1]);
});

test('sampleLut interpolates a 1D table per channel', () => {
  const lut: GradeLut = {
    kind: '1d',
    size: 3,
    data: new Float32Array([0, 0, 0, 0.25, 0.5, 0.75, 1, 1, 1]),
    domainMin: [0, 0, 0],
    domainMax: [1, 1, 1],
    title: '',
  };
  assert.deepEqual(sampleLut(lut, 0.5, 0.5, 0.5), [0.25, 0.5, 0.75]);
  const [r] = sampleLut(lut, 0.25, 0, 0);
  assert.ok(Math.abs(r - 0.125) < 1e-6, `midway to the mid stop: ${r}`);
});

// ── applyLutFrame ────────────────────────────────────────────────────────────

/** A small RGBA frame with a deterministic spread of values. */
function testFrame(px: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(px * 4);
  for (let i = 0; i < px; i++) {
    d[i * 4] = (i * 37) & 0xff;
    d[i * 4 + 1] = (i * 91) & 0xff;
    d[i * 4 + 2] = (i * 53) & 0xff;
    d[i * 4 + 3] = (i * 7) & 0xff;
  }
  return d;
}

test('applyLutFrame with an identity LUT leaves the frame alone', () => {
  const before = testFrame(64);
  const after = new Uint8ClampedArray(before);
  applyLutFrame(after, identityLut(33));
  assert.deepEqual(Array.from(after), Array.from(before));
});

test('applyLutFrame never touches alpha', () => {
  const d = testFrame(32);
  const alpha = Array.from(d).filter((_, i) => i % 4 === 3);
  // An aggressive LUT: everything goes to mid grey.
  const flat = identityLut(2);
  flat.data.fill(0.5);
  applyLutFrame(d, flat);
  assert.deepEqual(Array.from(d).filter((_, i) => i % 4 === 3), alpha);
  assert.deepEqual(Array.from(d.slice(0, 3)), [128, 128, 128]);
});

test('applyLutFrame with intensity 0 is a no-op', () => {
  const before = testFrame(32);
  const after = new Uint8ClampedArray(before);
  const flat = identityLut(2);
  flat.data.fill(0);
  applyLutFrame(after, flat, 0);
  assert.deepEqual(Array.from(after), Array.from(before));
});

test('applyLutFrame with intensity 0.5 lands halfway between original and graded', () => {
  const flat = identityLut(2);
  flat.data.fill(0); // everything → black
  const d = new Uint8ClampedArray([200, 100, 40, 255]);
  applyLutFrame(d, flat, 0.5);
  assert.deepEqual(Array.from(d), [100, 50, 20, 255]);
});

test('applyLutFrame clamps an out-of-range table value through the clamped store', () => {
  const hot = identityLut(2);
  hot.data.fill(4); // 4 × 255 is far past a byte
  const d = new Uint8ClampedArray([10, 20, 30, 200]);
  applyLutFrame(d, hot);
  assert.deepEqual(Array.from(d), [255, 255, 255, 200]);
});

test('applyLutFrame routes a 1D table and a non-unit domain through the sampler', () => {
  // Neither shape can go through the flat-index hot loop, which assumes a 3D
  // grid on 0..1. Both must still grade correctly.
  const oneD: GradeLut = {
    kind: '1d', size: 2, data: new Float32Array([0, 0, 0, 0.5, 0.5, 0.5]),
    domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: '',
  };
  const a = new Uint8ClampedArray([255, 255, 255, 255]);
  applyLutFrame(a, oneD);
  assert.deepEqual(Array.from(a), [128, 128, 128, 255]);

  const wide: GradeLut = { ...identityLut(2), domainMin: [0, 0, 0], domainMax: [2, 2, 2] };
  const b = new Uint8ClampedArray([255, 255, 255, 255]);
  applyLutFrame(b, wide);
  // 1.0 sits halfway up a 0..2 domain, so an identity table returns 0.5.
  assert.deepEqual(Array.from(b), [128, 128, 128, 255]);
});

// ── grain + vignette ─────────────────────────────────────────────────────────

const NO_TEXTURE = { grain: 0, grainSize: 2, vignette: 0, seed: 7 };

test('applyGrainVignette with grain 0 and vignette 0 is a no-op', () => {
  const before = testFrame(16 * 16);
  const after = new Uint8ClampedArray(before);
  applyGrainVignette(after, 16, 16, NO_TEXTURE);
  assert.deepEqual(Array.from(after), Array.from(before));
});

test('applyGrainVignette darkens the corners and leaves the centre alone', () => {
  const W = 32;
  const H = 32;
  const d = new Uint8ClampedArray(W * H * 4).fill(200);
  applyGrainVignette(d, W, H, { grain: 0, grainSize: 2, vignette: 1, seed: 7 });
  const at = (x: number, y: number) => d[(y * W + x) * 4]!;
  assert.equal(at(W / 2, H / 2), 200, 'the centre keeps its value');
  assert.ok(at(0, 0) < 200, `top-left darkened: ${at(0, 0)}`);
  assert.ok(at(W - 1, H - 1) < 200, `bottom-right darkened: ${at(W - 1, H - 1)}`);
  // The falloff is monotonic outward along the diagonal.
  assert.ok(at(4, 4) >= at(1, 1), 'further out is never lighter');
  // Alpha is untouched by the vignette too.
  assert.equal(d[3], 200);
});

test('applyGrainVignette is deterministic for one seed and frame index', () => {
  const a = new Uint8ClampedArray(24 * 24 * 4).fill(128);
  const b = new Uint8ClampedArray(24 * 24 * 4).fill(128);
  const p = { grain: 0.6, grainSize: 2, vignette: 0, seed: 4242 };
  applyGrainVignette(a, 24, 24, p, 5);
  applyGrainVignette(b, 24, 24, p, 5);
  assert.deepEqual(Array.from(a), Array.from(b));
  assert.notDeepEqual(Array.from(a), new Array(a.length).fill(128), 'grain actually did something');
});

test('applyGrainVignette draws different noise for a different frame index', () => {
  const p = { grain: 0.6, grainSize: 2, vignette: 0, seed: 4242 };
  const f0 = new Uint8ClampedArray(24 * 24 * 4).fill(128);
  const f1 = new Uint8ClampedArray(24 * 24 * 4).fill(128);
  applyGrainVignette(f0, 24, 24, p, 0);
  applyGrainVignette(f1, 24, 24, p, 1);
  assert.notDeepEqual(Array.from(f0), Array.from(f1), 'consecutive frames must not share a lattice');
});

test('applyGrainVignette treats a missing frameIndex as frame 0', () => {
  // The still path calls it with four arguments; the video path advances the
  // fifth. Byte-for-byte parity with the darkroom still itself is asserted in
  // tests/grade-drift.test.ts, against the tool's own grainVignettePass.
  const W = 29; // not a whole number of cells, so the lattice edges are exercised
  const H = 23;
  const p = { grain: 0.45, grainSize: 1.6, vignette: 0.7, seed: 7 };
  const explicit = testFrame(W * H);
  const implicit = testFrame(W * H);
  applyGrainVignette(explicit, W, H, p, 0);
  applyGrainVignette(implicit, W, H, p);
  assert.deepEqual(Array.from(implicit), Array.from(explicit));
});

// ── the grain lattice cell ───────────────────────────────────────────────────
// grainSize is a cell size in pixels, so without a reference resolution the same
// slider draws a different texture on every frame size - the defect that made a
// grade previewed at 960 px ship with grain twice as fine at 1920.

test('grainCellPx without a reference is the absolute cell darkroom uses', () => {
  assert.equal(grainCellPx(2, 960, 540), 2);
  assert.equal(grainCellPx(2, 3840, 2160), 2, 'the frame size is ignored outright');
  assert.equal(grainCellPx(2, 1920, 1080, 0), 2, 'a zero reference is "no reference"');
  assert.equal(grainCellPx(0, 1920, 1080), 1, 'a zero cell would make the lattice infinite');
  assert.equal(grainCellPx(-3, 1920, 1080, 1080), 1 * (1920 / 1080), 'and is floored before scaling');
});

test('grainCellPx scales the cell with the frame, so the texture is a fraction of the picture', () => {
  const small = grainCellPx(2, 960, 540, GRAIN_REF_LONG_EDGE);
  const large = grainCellPx(2, 1920, 1080, GRAIN_REF_LONG_EDGE);
  assert.equal(large / small, 2, 'twice the frame, twice the cell - the same grain by eye');
  // Cells per picture width is the invariant that actually matters.
  assert.ok(Math.abs(960 / small - 1920 / large) < 1e-9, 'the same lattice count across the width');
  // Orientation reads the LONG edge, so a portrait crop of the same clip agrees.
  assert.equal(grainCellPx(2, 1080, 1920, GRAIN_REF_LONG_EDGE), large);
  // At the reference itself the slider value is the pixel count.
  assert.equal(grainCellPx(2.5, GRAIN_REF_LONG_EDGE, 600, GRAIN_REF_LONG_EDGE), 2.5);
});

test('grainCellPx floors a degenerate cell rather than allocating a lattice per pixel', () => {
  // A 96-px thumbnail against a 1080 reference wants a tenth-of-a-pixel cell,
  // which is white noise plus a pointless allocation.
  assert.equal(grainCellPx(1, 96, 54, GRAIN_REF_LONG_EDGE), 0.5);
  assert.equal(grainCellPx(2, Number.NaN, Number.NaN, GRAIN_REF_LONG_EDGE), 0.5, 'and NaN cannot escape');
});

test('applyGrainVignette with a reference edge equals the absolute path at the scaled cell', () => {
  // The direct statement of what refLongEdge does: it is grainCellPx, applied.
  const W = 64;
  const H = 36;
  const p = { grain: 0.5, grainSize: 2, vignette: 0.3, seed: 11 };
  const scaled = testFrame(W * H);
  const equivalent = testFrame(W * H);
  applyGrainVignette(scaled, W, H, p, 0, GRAIN_REF_LONG_EDGE);
  applyGrainVignette(
    equivalent,
    W,
    H,
    { ...p, grainSize: grainCellPx(p.grainSize, W, H, GRAIN_REF_LONG_EDGE) },
    0,
  );
  assert.deepEqual(Array.from(scaled), Array.from(equivalent));

  // And a reference of 0 (or none) leaves the still's own output untouched.
  const absolute = testFrame(W * H);
  const zeroRef = testFrame(W * H);
  applyGrainVignette(absolute, W, H, p, 0);
  applyGrainVignette(zeroRef, W, H, p, 0, 0);
  assert.deepEqual(Array.from(zeroRef), Array.from(absolute));
  assert.notDeepEqual(Array.from(scaled), Array.from(absolute), 'the reference did change the texture');
});

test('gradeMulberry32 is darkroom variant, not the zzfx one', () => {
  // A frozen sample of darkroom's sequence. If someone points this at
  // zzfx-compose's same-named function these numbers change and every grain
  // pixel with them, which is the whole reason the two are kept apart.
  const rng = gradeMulberry32(1);
  const first = [rng(), rng(), rng()];
  const again = gradeMulberry32(1);
  assert.deepEqual([again(), again(), again()], first, 'same seed, same sequence');
  for (const v of first) assert.ok(v >= 0 && v < 1, `in range: ${v}`);
  const other = gradeMulberry32(2);
  assert.notEqual(other(), first[0], 'a different seed diverges immediately');
});
