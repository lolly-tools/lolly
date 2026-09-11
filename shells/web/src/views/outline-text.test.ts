// SPDX-License-Identifier: MPL-2.0
/**
 * Outline-text conversion (shells/web/src/views/outline-text.ts) - the DOM-free
 * seams. collectTextLines/outlineBoxText need a laid-out browser DOM (Range
 * client rects; jsdom has no layout) and are exercised in the browser, like the
 * export walk they mirror; everything below runs the real module against
 * injected fonts/metrics: geometry translation, deco bars, colour mapping,
 * per-fill grouping, refusal-first behaviour, and the rotated-frame shift.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  translateContours, rectContours, cssColorToHex, rotatedFrameShift, shapeCollectedLines,
  clusterContoursByGlyph, type CollectedLine, type RunStyle,
} from './outline-text.ts';

const STYLE: RunStyle = {
  color: 'rgb(17, 20, 31)', fontSize: 64, fontFamily: 'Outfit', fontWeight: '400',
  fontStyle: 'normal', letterSpacing: 'normal', fontFeatureSettings: 'normal', textTransform: 'none',
};

function line(over: Partial<CollectedLine> = {}): CollectedLine {
  return { text: 'Hi', x: 10, top: 20, width: 80, height: 70, deco: { u: false, s: false }, style: STYLE, ...over };
}

/** metrics that put the baseline at a known spot: half-leading of (height − (a+d)). */
const METRICS = { ascent: 50, descent: 14 };
const DEPS = {
  resolveFont: async () => ({ url: '/fonts/fake.ttf' }),
  metricsFor: () => METRICS,
};

/** textApi stub: one 100×50 square starting at the pen origin, no notdef. */
function stubTextApi(d = 'M0,0L100,0L100,-50L0,-50Z', notdef = 0) {
  const calls: unknown[] = [];
  return {
    calls,
    async toPath(opts: unknown) { calls.push(opts); return { d, advanceWidth: 100, bbox: null, notdef }; },
    async preload() { /* unused */ },
    async axisDefaults() { return {}; },
    async fontUrl() { return null; },
  };
}

test('translateContours shifts every control point exactly', () => {
  const path = rectContours(0, 0, 10, 10);
  const moved = translateContours(path, 5, -3);
  for (const [ci, c] of moved.entries()) {
    for (const [ki, cv] of c.curves.entries()) {
      const orig = path[ci]!.curves[ki]!;
      for (let i = 0; i < 8; i += 2) {
        assert.equal(cv[i], orig[i]! + 5);
        assert.equal(cv[i + 1], orig[i + 1]! - 3);
      }
    }
  }
});

test('rectContours produces one closed contour with the right bounds', () => {
  const path = rectContours(3, 7, 20, 2);
  assert.equal(path.length, 1);
  assert.equal(path[0]!.closed, true);
  const xs: number[] = [], ys: number[] = [];
  for (const cv of path[0]!.curves) for (let i = 0; i < 8; i += 2) { xs.push(cv[i]!); ys.push(cv[i + 1]!); }
  assert.equal(Math.min(...xs), 3);
  assert.equal(Math.max(...xs), 23);
  assert.equal(Math.min(...ys), 7);
  assert.equal(Math.max(...ys), 9);
});

test('cssColorToHex maps computed rgb()/rgba() to safeColor-acceptable hex', () => {
  assert.equal(cssColorToHex('rgb(17, 20, 31)'), '#11141f');
  assert.equal(cssColorToHex('rgba(255, 0, 0, 0.5)'), '#ff000080');
  assert.equal(cssColorToHex('not a colour'), null);
});

test('rotatedFrameShift: zero rotation and concentric frames are no-ops', () => {
  assert.deepEqual(rotatedFrameShift(50, 50, 80, 60, 0), { dx: 0, dy: 0 });
  const same = rotatedFrameShift(50, 50, 50, 50, 137);
  assert.ok(Math.abs(same.dx) < 1e-12 && Math.abs(same.dy) < 1e-12);
});

test('rotatedFrameShift: 90° about the source centre lands the offset centre correctly', () => {
  // Centre offset (10, 0) rotated 90° cw (CSS positive) becomes (0, 10).
  const { dx, dy } = rotatedFrameShift(0, 0, 10, 0, 90);
  assert.ok(Math.abs(dx - -10) < 1e-12, `dx ${dx}`);
  assert.ok(Math.abs(dy - 10) < 1e-12, `dy ${dy}`);
});

test('shapeCollectedLines places the glyph square at pen origin + baseline', async () => {
  const api = stubTextApi();
  const res = await shapeCollectedLines([line()], api as never, DEPS);
  assert.ok(res.ok);
  assert.equal(res.groups.length, 1);
  assert.equal(res.groups[0]!.fill, '#11141f');
  // Baseline: top + (height − (ascent+descent))/2 + ascent = 20 + 3 + 50 = 73.
  // The stub square spans y −50..0 relative to the baseline → 23..73 absolute;
  // x spans pen 0..100 → 10..110.
  const xs: number[] = [], ys: number[] = [];
  for (const c of res.groups[0]!.path) for (const cv of c.curves) for (let i = 0; i < 8; i += 2) { xs.push(cv[i]!); ys.push(cv[i + 1]!); }
  assert.equal(Math.min(...xs), 10);
  assert.equal(Math.max(...xs), 110);
  assert.equal(Math.min(...ys), 23);
  assert.equal(Math.max(...ys), 73);
});

test('shapeCollectedLines emits one glyph box per run in reading order (no merge)', async () => {
  const api = stubTextApi();
  const red: RunStyle = { ...STYLE, color: 'rgb(255, 0, 0)' };
  const res = await shapeCollectedLines(
    [line(), line({ top: 100, style: red }), line({ top: 180 })], api as never, DEPS);
  assert.ok(res.ok);
  // Per glyph now: each single-square run is its OWN box, in reading order - the two dark
  // runs no longer merge, so the letters stay independently selectable/editable.
  assert.deepEqual(res.groups.map((g) => g.fill), ['#11141f', '#ff0000', '#11141f']);
  assert.ok(res.groups.every((g) => g.path.length === 1), 'each glyph is its own single-contour box');
});

test('clusterContoursByGlyph splits side-by-side glyphs, keeps a counter with its outline', () => {
  // Two disjoint squares (a kerning gap between them) → two glyph clusters.
  const twoLetters = [...rectContours(0, 0, 40, 50), ...rectContours(60, 0, 40, 50)];
  const split = clusterContoursByGlyph(twoLetters);
  assert.equal(split.length, 2, 'disjoint x-spans split into two glyphs');
  assert.ok(split.every((g) => g.length === 1));
  // Left-to-right order: first cluster starts at x=0, second at x=60.
  assert.ok(split[0]![0]!.curves[0]![0]! < split[1]![0]!.curves[0]![0]!);

  // An outline with a nested counter (hole strictly inside) → ONE glyph of two contours,
  // so the box still cuts the hole out by winding.
  const withHole = [...rectContours(0, 0, 100, 50), ...rectContours(20, 10, 60, 30)];
  const one = clusterContoursByGlyph(withHole);
  assert.equal(one.length, 1, 'a counter stays with its outline');
  assert.equal(one[0]!.length, 2, 'the glyph box holds outline + counter');
});

test('clusterContoursByGlyph is a no-op for zero or one contour', () => {
  assert.deepEqual(clusterContoursByGlyph([]), []);
  const single = rectContours(5, 5, 10, 10);
  const out = clusterContoursByGlyph(single);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.length, 1);
});

test('shapeCollectedLines splits a multi-glyph run into one box each', async () => {
  // A run whose shaped `d` is two separated squares → two glyph boxes from ONE line.
  const api = stubTextApi('M0,0L40,0L40,-50L0,-50Z M60,0L100,0L100,-50L60,-50Z');
  const res = await shapeCollectedLines([line()], api as never, DEPS);
  assert.ok(res.ok);
  assert.equal(res.groups.length, 2, 'two glyphs → two boxes');
  assert.ok(res.groups.every((g) => g.fill === '#11141f' && g.path.length === 1));
});

test('shapeCollectedLines applies text-transform before shaping', async () => {
  const api = stubTextApi();
  const res = await shapeCollectedLines(
    [line({ text: 'abc', style: { ...STYLE, textTransform: 'uppercase' } })], api as never, DEPS);
  assert.ok(res.ok);
  assert.equal((api.calls[0] as { text: string }).text, 'ABC');
});

test('shapeCollectedLines forwards letter-spacing, features, variations and fallbacks to toPath', async () => {
  const api = stubTextApi();
  const deps = {
    resolveFont: async () => ({ url: '/f.ttf', variations: ['wght=700'], fallbacks: [{ fontUrl: '/fb.ttf' }] }),
    metricsFor: () => METRICS,
  };
  const res = await shapeCollectedLines(
    [line({ style: { ...STYLE, letterSpacing: '5px', fontFeatureSettings: '"liga" 0, "salt" 1' } })],
    api as never, deps);
  assert.ok(res.ok);
  const call = api.calls[0] as {
    letterSpacing: number; features: string[]; variations: string[]; fallbackFonts: { fontUrl: string }[]; fontSize: number;
  };
  assert.equal(call.letterSpacing, 5);
  assert.deepEqual(call.features, ['liga=0', 'salt=1']);
  assert.deepEqual(call.variations, ['wght=700']);
  assert.deepEqual(call.fallbackFonts, [{ fontUrl: '/fb.ttf' }]);
  assert.equal(call.fontSize, 64);
});

test('shapeCollectedLines keeps decoration bars in a separate group from the glyphs', async () => {
  const api = stubTextApi();
  const res = await shapeCollectedLines([line({ deco: { u: true, s: true } })], api as never, DEPS);
  assert.ok(res.ok);
  // glyph box (1 contour) + a distinct deco box (underline + strike = 2 contours),
  // same fill - separated so the bars never nonzero-cancel against glyph contours.
  assert.equal(res.groups.length, 2);
  assert.equal(res.groups[0]!.path.length, 1, 'glyph group holds only the glyph square');
  assert.equal(res.groups[1]!.path.length, 2, 'deco group holds both bars');
  assert.deepEqual(res.groups.map((g) => g.fill), ['#11141f', '#11141f']);
});

test('shapeCollectedLines refuses the whole element on notdef', async () => {
  const api = stubTextApi('M0,0L10,0L10,-10Z', 2);
  const res = await shapeCollectedLines([line()], api as never, DEPS);
  assert.deepEqual(res, { ok: false, reason: 'notdef' });
});

test('shapeCollectedLines refuses when no font resolves', async () => {
  const api = stubTextApi();
  const res = await shapeCollectedLines([line()], api as never, { ...DEPS, resolveFont: async () => null });
  assert.deepEqual(res, { ok: false, reason: 'no-font' });
});

test('shapeCollectedLines refuses empty input and whitespace-only output', async () => {
  const api = stubTextApi();
  assert.deepEqual(await shapeCollectedLines([], api as never, DEPS), { ok: false, reason: 'no-text' });
  assert.deepEqual(
    await shapeCollectedLines([line({ text: '   ' })], api as never, DEPS),
    { ok: false, reason: 'empty' });
});
