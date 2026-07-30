// SPDX-License-Identifier: MPL-2.0
/**
 * Contract tests for the DOM-free CSS "paint" parsers the export walkers (SVG + PDF)
 * share: clip-path basic shapes, radial-gradient geometry, and drop-shadow filters.
 * These feed the vector clip / gradient / shadow output, so the geometry must match
 * what a browser renders. Run with: node --test tests/css-paint.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseClipShape, parseRadialGradient, parseConicGradient, parseDropShadowFilter,
  splitCssArgs, parseGradientStop, parseGradientAngle, expandGradientStops,
} from '../engine/src/css-paint.ts';

const close = (a: number, b: number, eps = 1e-3): boolean => Math.abs(a - b) <= eps;

// ── clip-path ─────────────────────────────────────────────────────────────────

test('parseClipShape: circle at centre (closest-side default)', () => {
  const s = parseClipShape('circle(at 50% 50%)', 200, 100);
  assert.equal(s?.kind, 'circle');
  if (s?.kind === 'circle') { assert.equal(s.cx, 100); assert.equal(s.cy, 50); assert.equal(s.r, 50); } // min side dist
});

test('parseClipShape: circle explicit radius + position', () => {
  const s = parseClipShape('circle(40px at 30px 20px)', 200, 100);
  assert.deepEqual(s, { kind: 'circle', cx: 30, cy: 20, r: 40 });
});

test('parseClipShape: ellipse with two radii', () => {
  const s = parseClipShape('ellipse(60px 30px at 50% 50%)', 200, 100);
  assert.equal(s?.kind, 'ellipse');
  if (s?.kind === 'ellipse') { assert.equal(s.rx, 60); assert.equal(s.ry, 30); assert.equal(s.cx, 100); assert.equal(s.cy, 50); }
});

test('parseClipShape: inset with per-side values and round radius', () => {
  const s = parseClipShape('inset(10px 20px 30px 40px round 8px)', 200, 100);
  // top=10 right=20 bottom=30 left=40 → x=40 y=10 w=200-40-20=140 h=100-10-30=60
  assert.deepEqual(s, { kind: 'inset', x: 40, y: 10, w: 140, h: 60, r: 8 });
});

test('parseClipShape: inset single value (all sides equal)', () => {
  const s = parseClipShape('inset(10px)', 200, 100);
  assert.deepEqual(s, { kind: 'inset', x: 10, y: 10, w: 180, h: 80, r: 0 });
});

test('parseClipShape: polygon keeps >=3 points, drops <3', () => {
  const tri = parseClipShape('polygon(0 0, 100 0, 50 80)', 100, 80);
  assert.equal(tri?.kind, 'polygon');
  if (tri?.kind === 'polygon') assert.deepEqual(tri.points, [[0, 0], [100, 0], [50, 80]]);
  assert.equal(parseClipShape('polygon(0 0, 100 0)', 100, 80), null);   // <3 → null
});

test('parseClipShape: url()/path()/unparseable → null (caller rasterises)', () => {
  assert.equal(parseClipShape('url(#m)', 100, 100), null);
  assert.equal(parseClipShape('path("M0 0 L10 10Z")', 100, 100), null);
  assert.equal(parseClipShape('circle(closest-corner at 50% 50%)', 100, 100), null); // NaN radius → null
});

// ── radial-gradient geometry ────────────────────────────────────────────────

test('parseRadialGradient: default ellipse farthest-corner at centre', () => {
  // default shape = ellipse, size = farthest-corner: rx = (w/2)·√2, ry = (h/2)·√2
  const g = parseRadialGradient('radial-gradient(rgb(255, 0, 0), rgb(0, 0, 255))', 200, 100);
  assert.ok(g);
  assert.equal(g!.cx, 100); assert.equal(g!.cy, 50);
  assert.ok(close(g!.rx, 100 * Math.SQRT2));
  assert.ok(close(g!.ry, 50 * Math.SQRT2));
  assert.equal(g!.stops.length, 2);
});

test('parseRadialGradient: explicit ellipse size (percent) + position — the quotes/daily-card form', () => {
  const g = parseRadialGradient('radial-gradient(42% 48% at 30% 28%, rgb(48, 186, 120), transparent 70%)', 500, 300);
  assert.ok(g);
  assert.ok(close(g!.cx, 150));         // 30% of 500
  assert.ok(close(g!.cy, 84));          // 28% of 300
  assert.ok(close(g!.rx, 210));         // 42% of 500
  assert.ok(close(g!.ry, 144));         // 48% of 300
  // Flattened to hex + a separate opacity, like every non-opaque-hex form (see the
  // stop test below for why the legacy rgb() passthrough had to go).
  assert.equal(g!.stops[0]!.colorStr, '#30ba78');
  assert.equal(g!.stops[1]!.opacity, 0); // transparent
  assert.equal(g!.stops[1]!.offset, '70%');
});

test('parseRadialGradient: circle closest-side', () => {
  // circle at centre of 200×100 → closest side dist = 50 (min of 100,50)
  const g = parseRadialGradient('radial-gradient(circle closest-side at 50% 50%, rgb(0,0,0), rgb(255,255,255))', 200, 100);
  assert.ok(g);
  assert.ok(close(g!.rx, 50)); assert.ok(close(g!.ry, 50));
});

test('parseRadialGradient: circle farthest-corner (hypot of far sides)', () => {
  // circle at top-left corner of 200×100: far x=200, far y=100 → r=hypot(200,100)
  const g = parseRadialGradient('radial-gradient(circle at 0 0, rgb(0,0,0), rgb(1,1,1))', 200, 100);
  assert.ok(g);
  assert.ok(close(g!.rx, Math.hypot(200, 100)));
});

test('parseRadialGradient: non-radial → null', () => {
  assert.equal(parseRadialGradient('linear-gradient(rgb(0,0,0), rgb(1,1,1))', 100, 100), null);
  assert.equal(parseRadialGradient('none', 100, 100), null);
});

// ── drop-shadow filter ──────────────────────────────────────────────────────

test('parseDropShadowFilter: single shadow, colour-first (computed form)', () => {
  const s = parseDropShadowFilter('drop-shadow(rgb(0, 0, 0) 2px 4px 6px)');
  assert.deepEqual(s, [{ dx: 2, dy: 4, blur: 6, color: 'rgb(0, 0, 0)' }]);
});

test('parseDropShadowFilter: blur omitted defaults to 0', () => {
  const s = parseDropShadowFilter('drop-shadow(rgba(0, 0, 0, 0.5) 3px 3px)');
  assert.deepEqual(s, [{ dx: 3, dy: 3, blur: 0, color: 'rgba(0, 0, 0, 0.5)' }]);
});

test('parseDropShadowFilter: chained shadows preserved in order', () => {
  const s = parseDropShadowFilter('drop-shadow(rgb(0, 0, 0) 1px 1px 1px) drop-shadow(rgb(255, 0, 0) -2px -2px 2px)');
  assert.equal(s?.length, 2);
  assert.equal(s![0]!.dx, 1);
  assert.equal(s![1]!.dx, -2);
  assert.equal(s![1]!.color, 'rgb(255, 0, 0)');
});

test('parseDropShadowFilter: any non-drop-shadow function → null (rasterise)', () => {
  assert.equal(parseDropShadowFilter('blur(4px)'), null);
  assert.equal(parseDropShadowFilter('drop-shadow(rgb(0,0,0) 2px 2px) grayscale(1)'), null);
  assert.equal(parseDropShadowFilter('none'), null);
  assert.equal(parseDropShadowFilter(''), null);
});

// ── shared splitters (spot-check the parens-aware behaviour) ─────────────────

test('splitCssArgs: does not split commas inside parens', () => {
  assert.deepEqual(splitCssArgs('rgb(1, 2, 3) 0%, rgb(4, 5, 6) 100%'), ['rgb(1, 2, 3) 0%', 'rgb(4, 5, 6) 100%']);
});

test('parseGradientStop: peels position off a spaced rgb() colour', () => {
  const s = parseGradientStop('rgb(48, 186, 120) 25%', 0, 2);
  // The colour comes back as an OPAQUE hex, not the rgb() verbatim: `stop-color`'s
  // alpha multiplies with `stop-opacity` in SVG, and callers set both from this one
  // result — so returning `rgba(…,0.5)` next to `opacity: 0.5` exported the stop at
  // ~0.25 alpha. Every form now flattens the same way; only an opaque 6-digit hex
  // passes through untouched.
  assert.equal(s.colorStr, '#30ba78');
  assert.equal(s.opacity, 1);
  assert.equal(s.offset, '25%');
});

test('parseGradientStop: alpha rides on `opacity` ONLY, never twice', () => {
  for (const [css, hex, op] of [
    ['rgba(255,0,0,0.5)', '#ff0000', 0.5],
    ['#30ba7880', '#30ba78', 128 / 255],
    ['oklab(0.628 0.225 0.126 / 0.25)', '#ff0000', 0.25],
    // The modern slash syntax used to report opacity 1 (the old regex only matched the
    // legacy comma form), so its alpha was invisible to every consumer.
    ['rgb(1 2 3 / 50%)', '#010203', 0.5],
  ] as Array<[string, string, number]>) {
    const s = parseGradientStop(css, 0, 2);
    assert.equal(s.colorStr, hex, css);
    assert.ok(Math.abs(s.opacity - op) < 1e-6, `${css}: opacity ${s.opacity}`);
    assert.ok(!/rgba|[0-9a-f]{8}/i.test(s.colorStr!), `${css}: no alpha inside the colour`);
  }
});

// ── Zero-area clips are UNDERSTOOD, not unparseable ──────────────────────────
// `clip-path: inset(50%)` is the standard visually-hidden / skip-link idiom, and
// `parseClipShape` used to answer it with `null`. Callers read `null` as "a shape
// I can't vectorise" and fall back to rasterising the element's whole subtree —
// so the single most common clip-path value in the app rasterised everything
// under it, and on an ancestor that turned a whole page snapshot into one big
// screenshot. `{kind:'empty'}` lets a caller do the correct thing: paint nothing.
test('parseClipShape: a zero-area clip reports empty, not null', () => {
  for (const cp of ['inset(50%)', 'inset(50% 50% 50% 50%)', 'inset(60% 10%)', 'circle(0)', 'circle(0%)', 'ellipse(0 0)']) {
    const s = parseClipShape(cp, 200, 100);
    assert.ok(s, `${cp} should parse, not return null`);
    assert.equal(s!.kind, 'empty', `${cp} → ${JSON.stringify(s)}`);
  }
});

test('parseClipShape: a shape it genuinely cannot read still reports null', () => {
  for (const cp of ['url(#mask)', 'path("M0 0 L10 10")', 'circle(banana)', 'inset(banana)']) {
    assert.equal(parseClipShape(cp, 200, 100), null, cp);
  }
});

test('parseClipShape: a clip WITH area is unaffected', () => {
  const ins = parseClipShape('inset(10% 20%)', 200, 100);
  assert.deepEqual(ins, { kind: 'inset', x: 40, y: 10, w: 120, h: 80, r: 0 });
  assert.equal(parseClipShape('circle(40%)', 200, 100)!.kind, 'circle');
  assert.equal(parseClipShape('ellipse(30% 40%)', 200, 100)!.kind, 'ellipse');
  assert.equal(parseClipShape('polygon(0 0, 10px 0, 10px 10px)', 200, 100)!.kind, 'polygon');
});

// ── conic-gradient ───────────────────────────────────────────────────────────
// SVG has no conic primitive, so the walkers draw this as a fan of wedges. Before
// it existed, a conic background rasterised the whole element — on the qr fixture,
// one page background became a 1168x900 PNG. The geometry that matters is the
// CENTRE and the START ANGLE: CSS measures clockwise from 12 o'clock, and every
// consumer has to undo that against SVG's 3-o'clock zero.

test('conic-gradient: a bare stop list centres in the box and starts at 0', () => {
  const g = parseConicGradient('conic-gradient(rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)', 200, 100);
  assert.ok(g);
  assert.equal(g.cx, 100); assert.equal(g.cy, 50);
  assert.equal(g.fromRad, 0);
  assert.equal(g.stops.length, 2);
});

test('conic-gradient: "from <angle>" is read in every angle unit', () => {
  const at = (v: string) => parseConicGradient(`conic-gradient(from ${v}, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)`, 100, 100)?.fromRad ?? NaN;
  assert.equal(Math.round((at('90deg') * 180) / Math.PI), 90);
  assert.equal(Math.round((at('0.25turn') * 180) / Math.PI), 90);
  assert.equal(Math.round((at('1.5708rad') * 180) / Math.PI), 90);
  assert.equal(Math.round((at('100grad') * 180) / Math.PI), 90);
});

test('conic-gradient: "at <position>" moves the centre, in px, % and keywords', () => {
  const at = (v: string) => parseConicGradient(`conic-gradient(at ${v}, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)`, 200, 100);
  assert.deepEqual([at('25% 75%')!.cx, at('25% 75%')!.cy], [50, 75]);
  assert.deepEqual([at('10px 20px')!.cx, at('10px 20px')!.cy], [10, 20]);
  assert.deepEqual([at('left top')!.cx, at('left top')!.cy], [0, 0]);
  assert.deepEqual([at('right bottom')!.cx, at('right bottom')!.cy], [200, 100]);
  assert.deepEqual([at('center')!.cx, at('center')!.cy], [100, 50]);
});

test('conic-gradient: "from" and "at" together', () => {
  const g = parseConicGradient('conic-gradient(from 45deg at 10% 20%, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)', 100, 100);
  assert.ok(g);
  assert.equal(Math.round((g.fromRad * 180) / Math.PI), 45);
  assert.deepEqual([g.cx, g.cy], [10, 20]);
});

test('conic-gradient: repeating-conic-gradient is accepted, and flagged', () => {
  // The transparency checkerboard behind every tool canvas in this app is one of
  // these. Refusing it meant rasterising the whole stage; the flag tells the caller
  // to WRAP its sampling, because the stop list is one period rather than the sweep.
  const g = parseConicGradient('repeating-conic-gradient(rgb(255, 0, 0) 0%, rgb(0, 0, 255) 25%)', 100, 100);
  assert.ok(g);
  assert.equal(g.repeating, true);
  assert.equal(g.stops.length, 2);
  assert.equal(parseConicGradient('conic-gradient(rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)', 100, 100)!.repeating, false);
});

test('conic-gradient: the real checkerboard value parses', () => {
  // Verbatim from getComputedStyle on .tool-stage. Its hard stops are written as a
  // DECREASING offset ("0%" after "25%"), which CSS clamps rather than reorders.
  const g = parseConicGradient(
    'repeating-conic-gradient(rgba(255, 255, 255, 0.024) 0%, rgba(255, 255, 255, 0.024) 25%, rgba(0, 0, 0, 0.024) 0%, rgba(0, 0, 0, 0.024) 50%)',
    100, 100);
  assert.ok(g, 'the checkerboard must parse — it is the whole reason this exists');
  assert.equal(g.repeating, true);
  assert.equal(g.stops.length, 4);
  assert.equal(g.stops[0]!.opacity, 0.024);
});

test('conic-gradient: too few usable stops is refused', () => {
  assert.equal(parseConicGradient('conic-gradient(rgb(1, 1, 1))', 100, 100), null);
  // A stop whose colour is genuinely unreadable still yields nothing.
  assert.equal(parseConicGradient('conic-gradient(notacolor 0%, alsonot 100%)', 100, 100), null);
});

test('conic-gradient: named and modern-space stops resolve (they used to yield no stops)', () => {
  // Named colours WERE unresolvable DOM-free, so `conic-gradient(rebeccapurple,
  // papayawhip)` produced no stops and the whole gradient was refused. css-color.ts
  // owns the named table now, so these are ordinary colours.
  const named = parseConicGradient('conic-gradient(rebeccapurple 0%, papayawhip 100%)', 100, 100);
  assert.ok(named, 'a named-colour conic gradient parses');
  assert.deepEqual(named.stops.map(s => s.colorStr), ['#663399', '#ffefd5']);

  const modern = parseConicGradient('conic-gradient(oklab(0.628 0.225 0.126) 0%, color(srgb 0 0 1) 100%)', 100, 100);
  assert.ok(modern, 'a modern-space conic gradient parses');
  assert.deepEqual(modern.stops.map(s => s.colorStr), ['#ff0000', '#0000ff']);
});

test('conic-gradient: a non-conic value is not claimed', () => {
  assert.equal(parseConicGradient('linear-gradient(rgb(1, 1, 1), rgb(2, 2, 2))', 100, 100), null);
  assert.equal(parseConicGradient('none', 100, 100), null);
  assert.equal(parseConicGradient('', 100, 100), null);
});

test('conic-gradient: a garbage angle falls back to 0 rather than NaN', () => {
  const g = parseConicGradient('conic-gradient(from abc, rgb(1,1,1) 0%, rgb(2,2,2) 100%)', 100, 100);
  assert.ok(g);
  assert.ok(Number.isFinite(g.fromRad));
});

test('parseGradientAngle: grad is not misread as rad', () => {
  // Pre-existing defect found while adding the conic parser: the suffix tests ran
  // rad before grad, and 'grad'.endsWith('rad') is true — so a 90-degree gradient
  // written as 100grad came out as 100 radians.
  const deg = (r: number) => Math.round((r * 180) / Math.PI);
  assert.equal(deg(parseGradientAngle('100grad')), 90);
  assert.equal(deg(parseGradientAngle('200grad')), 180);
  assert.equal(deg(parseGradientAngle('1.5708rad')), 90);
  assert.equal(deg(parseGradientAngle('90deg')), 90);
  assert.equal(deg(parseGradientAngle('0.25turn')), 90);
});

test('double-position stops expand — the checkerboard idiom keeps its bands', () => {
  // `c 0% 25%, transparent 0% 50%` means c from 0-25% and clear from 25-50%
  // (CSS double-position shorthand). Collapsing each pair to its FIRST position
  // put both stops at 0% and dissolved the band structure entirely — the
  // transparency checkerboard behind every tool canvas is this exact idiom.
  const g = parseConicGradient(
    'repeating-conic-gradient(rgba(226, 232, 240, 0.5) 0% 25%, rgba(0, 0, 0, 0) 0% 50%)', 16, 16);
  assert.ok(g);
  assert.equal(g.repeating, true);
  assert.deepEqual(g.stops.map((s) => [s.colorStr, s.opacity, s.offset]), [
    ['#e2e8f0', 0.5, '0%'], ['#e2e8f0', 0.5, '25%'],
    ['#000000', 0, '0%'], ['#000000', 0, '50%'],
  ]);
});

test('expandGradientStops leaves single-position stops untouched', () => {
  const single = [{ colorStr: '#111111', opacity: 1, offset: '10%' }];
  assert.deepEqual(expandGradientStops(single), single);
  const dbl = [{ colorStr: '#222222', opacity: 0.4, offset: '10%', offset2: '30%' }];
  assert.deepEqual(expandGradientStops(dbl), [
    { colorStr: '#222222', opacity: 0.4, offset: '10%' },
    { colorStr: '#222222', opacity: 0.4, offset: '30%' },
  ]);
});
