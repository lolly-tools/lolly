/**
 * Unit tests for engine/src/color-tools.ts — the perceptual metrics + ramp
 * math ported per plans/chroma-eval.md. Covers APCA against the published
 * apca-w3 reference pairs (APCA-1.0.98G), ΔEOK's metric properties, bezier
 * ramps (endpoints, counts, lightness correction), class breaks (equal /
 * log / quantile goldens), and the distinct-categorical generator (anchor
 * first, pairwise distance, determinism). Everything imports through the
 * barrel so the export wiring is exercised too.
 *
 * Run with: node --test tests/color-tools.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deltaEOk, apcaContrast, rampOklab, classBreaks, distinctColors,
  makeColorApi, contrastRatio, hexToOklch,
} from '../engine/src/index.ts';

const HEX6 = /^#[0-9a-f]{6}$/;

const approx = (actual: number, expected: number, tol: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) <= tol,
    `${msg ?? 'value'}: ${actual} not within ${tol} of ${expected}`);

// ── apcaContrast ───────────────────────────────────────────────────────────────

// The apca-w3 package's own README examples for the 0.0.98G constants — the
// same generation chroma.js implements. Signed: + dark-on-light, − light-on-dark.
const APCA_GOLDEN: Array<[string, string, number]> = [
  ['#888888', '#ffffff', 63.056469930209424],
  ['#ffffff', '#888888', -68.54146436644962],
  ['#000000', '#aaaaaa', 58.146262578561334],
  ['#aaaaaa', '#000000', -56.24113336839742],
  ['#112233', '#ddeeff', 91.66830811481631],
  ['#ddeeff', '#112233', -93.06770049484275],
];

test('apcaContrast matches the published APCA-1.0.98G reference pairs', () => {
  for (const [txt, bg, lc] of APCA_GOLDEN) {
    approx(apcaContrast(txt, bg), lc, 0.1, `Lc(${txt} on ${bg})`);
  }
});

test('apcaContrast polarity and clamps', () => {
  assert.equal(apcaContrast('#777777', '#777777'), 0); // identical → no contrast
  assert.ok(apcaContrast('#000000', '#ffffff') > 100, 'max contrast exceeds Lc 100');
  assert.ok(apcaContrast('#ffffff', '#000000') < -100);
  // Near-identical pairs collapse to 0 through the low-contrast clamps.
  assert.equal(apcaContrast('#808080', '#828282'), 0);
});

test('apcaContrast composites translucent text onto the background', () => {
  // 50% black on white ≈ solid #808080-ish text on white (compositing in sRGB bytes).
  const composited = apcaContrast('#00000080', '#ffffff');
  const solid = apcaContrast('#808080', '#ffffff');
  approx(composited, solid, 1.5, 'alpha-composited vs pre-flattened');
  assert.ok(composited < apcaContrast('#000000', '#ffffff'), 'translucent text reads lower than opaque');
});

test('apcaContrast accepts oklch() strings and NaNs on garbage', () => {
  const viaOklch = apcaContrast('oklch(0% 0 0)', '#ffffff');
  approx(viaOklch, apcaContrast('#000000', '#ffffff'), 0.1, 'oklch black on white');
  assert.ok(Number.isNaN(apcaContrast('nope', '#ffffff')));
  assert.ok(Number.isNaN(apcaContrast('#ffffff', 'rgb(1,2,3)'))); // rgb() not a stored-token form
});

// ── deltaEOk ───────────────────────────────────────────────────────────────────

test('deltaEOk metric properties', () => {
  assert.equal(deltaEOk('#30ba78', '#30ba78'), 0);
  approx(deltaEOk('#000000', '#ffffff'), 1, 1e-3, 'black↔white spans the L axis');
  const ab = deltaEOk('#4f83cc', '#cc4455');
  assert.equal(ab, deltaEOk('#cc4455', '#4f83cc')); // symmetric
  assert.ok(ab > 0.1, 'clearly different colours are clearly apart');
  assert.ok(deltaEOk('#4f83cc', '#5084cd') < 0.02, 'neighbouring hexes sit under a JND');
  assert.ok(Number.isNaN(deltaEOk('garbage', '#ffffff')));
});

test('deltaEOk reads oklch() token values', () => {
  // A stored oklch() string and its gamut-mapped hex are the same colour.
  const c = hexToOklch('#4f83cc')!;
  const asOklch = `oklch(${(c.l * 100).toFixed(3)}% ${c.c.toFixed(5)} ${c.h.toFixed(3)})`;
  assert.ok(deltaEOk(asOklch, '#4f83cc') < 5e-3);
});

// ── rampOklab ──────────────────────────────────────────────────────────────────

test('rampOklab returns n gamut-safe hexes with exact endpoints', () => {
  const stops = ['#112244', '#cc4455', '#ffeedd'];
  const ramp = rampOklab(stops, 7);
  assert.equal(ramp.length, 7);
  for (const hex of ramp) assert.match(hex, HEX6);
  assert.ok(deltaEOk(ramp[0]!, stops[0]!) < 1e-3, 'first sample is the first stop');
  assert.ok(deltaEOk(ramp[6]!, stops[2]!) < 1e-3, 'last sample is the last stop');
});

test('rampOklab correctLightness equalises perceptual steps', () => {
  // Mid stop chosen well BELOW the endpoints' lightness midpoint so the raw
  // bezier visibly sags — the correction has something to fix.
  const stops = ['#111111', '#223377', '#ffffff'];
  const n = 9;
  const ramp = rampOklab(stops, n, { correctLightness: true });
  const L = ramp.map(h => hexToOklch(h)!.l);
  const ideal = (i: number) => L[0]! + ((L[n - 1]! - L[0]!) * i) / (n - 1);
  for (let i = 0; i < n; i++) {
    approx(L[i]!, ideal(i), 3e-3, `sample ${i} lightness`);
  }
  // Without correction the mid-stop's pull leaves visibly uneven steps.
  const raw = rampOklab(stops, n).map(h => hexToOklch(h)!.l);
  const rawErr = Math.max(...raw.map((l, i) => Math.abs(l - ideal(i))));
  assert.ok(rawErr > 0.01, `uncorrected ramp should deviate (saw ${rawErr})`);
});

test('rampOklab handles two stops, single samples, and bad input', () => {
  const two = rampOklab(['#000000', '#ffffff'], 3);
  assert.equal(two.length, 3);
  approx(hexToOklch(two[1]!)!.l, 0.5, 0.02, 'linear OKLab midpoint sits at mid-lightness');
  assert.deepEqual(rampOklab(['#30ba78'], 1), ['#30ba78']);
  assert.deepEqual(rampOklab(['#30ba78', '#ffffff'], 0), []);
  assert.throws(() => rampOklab([], 5), /at least one stop/);
  assert.throws(() => rampOklab(['#123456', 'nope'], 5), /unparseable stop 1/);
});

test('rampOklab accepts oklch() stops', () => {
  const ramp = rampOklab(['oklch(20% 0.05 250)', 'oklch(90% 0.05 250)'], 5);
  assert.equal(ramp.length, 5);
  const L = ramp.map(h => hexToOklch(h)!.l);
  for (let i = 1; i < L.length; i++) assert.ok(L[i]! > L[i - 1]!, 'lightness ascends');
});

// ── classBreaks ────────────────────────────────────────────────────────────────

test('classBreaks equal intervals', () => {
  assert.deepEqual(classBreaks([0, 3, 10, 7], 'e', 5), [0, 2, 4, 6, 8, 10]);
});

test('classBreaks quantiles interpolate between sorted ranks', () => {
  assert.deepEqual(classBreaks([5, 3, 1, 2, 4], 'q', 4), [1, 2, 3, 4, 5]);
  assert.deepEqual(classBreaks([1, 2, 10, 100], 'q', 2), [1, 6, 100]); // median = 2 + (10−2)/2
});

test('classBreaks log mode spaces decades and rejects non-positive data', () => {
  const breaks = classBreaks([1, 10, 1000], 'l', 3);
  assert.equal(breaks.length, 4);
  for (const [i, expected] of [1, 10, 100, 1000].entries()) {
    approx(breaks[i]!, expected, 1e-9, `log break ${i}`);
  }
  assert.throws(() => classBreaks([0, 1, 10], 'l', 2), /every value > 0/);
});

test('classBreaks ignores non-finite values and empties honestly', () => {
  assert.deepEqual(classBreaks([NaN, 2, Infinity, 4], 'e', 2), [2, 3, 4]);
  assert.deepEqual(classBreaks([], 'q', 4), []);
  assert.deepEqual(classBreaks([NaN], 'e', 3), []);
});

// ── distinctColors ─────────────────────────────────────────────────────────────

test('distinctColors: anchor first, n colours, all pairwise distinct', () => {
  const n = 8;
  const out = distinctColors(n, { anchorHex: '#4f83cc' });
  assert.equal(out.length, n);
  for (const hex of out) assert.match(hex, HEX6);
  assert.ok(deltaEOk(out[0]!, '#4f83cc') < 1e-3, 'series 1 is the brand anchor');
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      assert.ok(deltaEOk(out[i]!, out[j]!) >= 0.02,
        `${out[i]} vs ${out[j]} under the distinctness floor`);
    }
  }
});

test('distinctColors is deterministic and works without an anchor', () => {
  assert.deepEqual(
    distinctColors(6, { anchorHex: '#30ba78' }),
    distinctColors(6, { anchorHex: '#30ba78' }),
  );
  const plain = distinctColors(5);
  assert.equal(plain.length, 5);
  assert.deepEqual(distinctColors(0), []);
});

test('distinctColors keeps a grey anchor verbatim but colours the rest', () => {
  const out = distinctColors(6, { anchorHex: '#777777' });
  assert.ok(deltaEOk(out[0]!, '#777777') < 1e-3);
  const colourful = out.slice(1).filter(h => hexToOklch(h)!.c > 0.05);
  assert.ok(colourful.length >= 4, 'pool re-chromatises around a neutral anchor');
});

// ── makeColorApi (the host.color bridge implementation, v1.40) ─────────────────

test('makeColorApi maps every ColorAPI method onto the engine primitive', () => {
  const api = makeColorApi();
  assert.equal(api.deltaE('#000000', '#ffffff'), deltaEOk('#000000', '#ffffff'));
  assert.equal(api.apca('#888888', '#ffffff'), apcaContrast('#888888', '#ffffff'));
  assert.equal(api.contrast('#000000', '#ffffff'), contrastRatio('#000000', '#ffffff'));
  assert.deepEqual(api.ramp(['#000000', '#ffffff'], 3), rampOklab(['#000000', '#ffffff'], 3));
  assert.deepEqual(api.breaks([0, 5, 10], 'e', 2), classBreaks([0, 5, 10], 'e', 2));
  assert.deepEqual(api.distinct(4, { anchorHex: '#30ba78' }), distinctColors(4, { anchorHex: '#30ba78' }));
  // Synchronous throughout — a hook can call these inline, no await.
  assert.equal(typeof api.contrast('#000000', '#ffffff'), 'number');
});
