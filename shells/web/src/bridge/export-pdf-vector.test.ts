// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the DOM-free vector-PDF helpers extracted from
 * bridge/export.ts (stage 1 of the export.ts split).
 * Run directly:  node --test shells/web/src/bridge/export-pdf-vector.test.ts
 *
 * The jsPDF handle these helpers drive is a plain object, so a recording mock
 * captures the exact operator stream - the tests assert the emitted geometry
 * (including the hard-won SVG-spec behaviours: Z resetting the current point to
 * the subpath start, and smooth-curve control-point reflection surviving Q/T).
 * The DOM walkers that call these stay in export.ts, untested here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rgbToCmyk } from '@lolly/engine';
import type { CornerRadii } from '../../../../engine/src/css-box.ts';
import {
  pureRotationDeg, sampleGradientMidpoint, gradStopToRgb, brandSwatchPalette,
  blendSvgWithWhite, parseSvgPathArgs, pdfRoundedRect, withPdfAlpha,
  withPdfClipRect, withPdfRoundedClip, pdfApplyClip, withPdfRotation,
  drawSvgPathToPdf, svgArcToBeziers, applyTextTransform,
  buildCmykPaletteMap, assignSpotResourceNames, cmykKey, paletteHitKey,
  pdfColorHit, cmykN, substitutePdfRgb, svgLen, preserveAspectRatioAlign,
  parseSvgColor, FINISH_MASK_CMYK,
} from './export-pdf-vector.ts';
import { readFileSync } from 'node:fs';

type Op = [string, ...unknown[]];

// Recording jsPDF stand-in: every method the helpers touch pushes [name, ...args].
function pdfRecorder() {
  const ops: Op[] = [];
  const rec = (name: string) => (...args: unknown[]) => { ops.push([name, ...args]); };
  const pdf: any = {};
  for (const m of [
    'moveTo', 'lineTo', 'curveTo', 'close', 'rect', 'roundedRect', 'circle',
    'ellipse', 'fill', 'stroke', 'clip', 'discardPath',
    'saveGraphicsState', 'restoreGraphicsState', 'setCurrentTransformationMatrix',
  ]) pdf[m] = rec(m);
  return { ops, pdf };
}

const names = (ops: Op[]) => ops.map(o => o[0]);
const round2 = (v: unknown) => Math.round((v as number) * 100) / 100;

// ── drawSvgPathToPdf: SVG path data → jsPDF operators ────────────────────────

test('drawSvgPathToPdf: M/L/H/V/Z with absolute and implicit-lineto coordinates', () => {
  const { ops, pdf } = pdfRecorder();
  drawSvgPathToPdf(pdf, 'M10 10 L20 10 H30 V20 Z', v => v, v => v);
  assert.deepEqual(ops, [
    ['moveTo', 10, 10], ['lineTo', 20, 10], ['lineTo', 30, 10],
    ['lineTo', 30, 20], ['close'],
  ]);
  const multi = pdfRecorder();
  drawSvgPathToPdf(multi.pdf, 'M0 0 10 0 10 10', v => v, v => v);
  assert.deepEqual(multi.ops, [['moveTo', 0, 0], ['lineTo', 10, 0], ['lineTo', 10, 10]]);
});

test('drawSvgPathToPdf: Z returns the current point to the subpath start (relative m after z)', () => {
  // The SVG-spec behaviour whose absence mangled the mono-white SUSE wordmark:
  // after closepath, a relative moveto is offset from the subpath START (10,10),
  // not the last drawn point (20,20).
  const { ops, pdf } = pdfRecorder();
  drawSvgPathToPdf(pdf, 'M10 10 L20 20 Z m5 5 l1 1', v => v, v => v);
  assert.deepEqual(ops, [
    ['moveTo', 10, 10], ['lineTo', 20, 20], ['close'],
    ['moveTo', 15, 15], ['lineTo', 16, 16],
  ]);
});

test('drawSvgPathToPdf: S reflects the previous cubic control point', () => {
  const { ops, pdf } = pdfRecorder();
  drawSvgPathToPdf(pdf, 'M0 0 C10 0 20 10 30 10 S50 20 60 10', v => v, v => v);
  assert.deepEqual(ops[1], ['curveTo', 10, 0, 20, 10, 30, 10]);
  // Reflection of (20,10) about (30,10) → (40,10).
  assert.deepEqual(ops[2], ['curveTo', 40, 10, 50, 20, 60, 10]);
});

test('drawSvgPathToPdf: S after a non-curve command collapses to the current point', () => {
  const { ops, pdf } = pdfRecorder();
  drawSvgPathToPdf(pdf, 'M0 0 L10 0 S20 10 30 10', v => v, v => v);
  assert.deepEqual(ops[2], ['curveTo', 10, 0, 20, 10, 30, 10]);
});

test('drawSvgPathToPdf: Q converts to the equivalent cubic', () => {
  const { ops, pdf } = pdfRecorder();
  drawSvgPathToPdf(pdf, 'M0 0 Q15 30 30 0', v => v, v => v);
  assert.deepEqual(ops[1], ['curveTo', 10, 20, 20, 20, 30, 0]);
});

test('drawSvgPathToPdf: T reflects the stored quadratic control point after Q', () => {
  // The regression the in-code comment records: resetting the control point
  // after Q/T mangled smooth-quad glyphs. T here must reflect (15,30) about
  // (30,0) → (45,-30), giving cubic controls (40,-20) and (50,-20).
  const { ops, pdf } = pdfRecorder();
  drawSvgPathToPdf(pdf, 'M0 0 Q15 30 30 0 T60 0', v => v, v => v);
  assert.deepEqual(ops[2]!.slice(1).map(round2), [40, -20, 50, -20, 60, 0]);
});

test('drawSvgPathToPdf: A with a degenerate radius degrades to lineTo', () => {
  const { ops, pdf } = pdfRecorder();
  drawSvgPathToPdf(pdf, 'M0 0 A0 5 0 0 1 10 0', v => v, v => v);
  assert.deepEqual(ops, [['moveTo', 0, 0], ['lineTo', 10, 0]]);
});

test('drawSvgPathToPdf: A emits bezier segments ending on the arc endpoint', () => {
  const { ops, pdf } = pdfRecorder();
  drawSvgPathToPdf(pdf, 'M0 0 A5 5 0 0 1 10 0', v => v, v => v);
  const curves = ops.filter(o => o[0] === 'curveTo');
  assert.equal(curves.length, 2, 'semicircle → two ≤90° segments');
  const last = curves[curves.length - 1]!;
  assert.equal(round2(last[5]), 10);
  assert.ok(Math.abs(last[6] as number) < 1e-9, 'arc lands on y=0');
});

test('drawSvgPathToPdf: tx/ty coordinate transforms apply to every emitted point', () => {
  const { ops, pdf } = pdfRecorder();
  drawSvgPathToPdf(pdf, 'M1 2 L3 4', v => v * 2, v => v * 10);
  assert.deepEqual(ops, [['moveTo', 2, 20], ['lineTo', 6, 40]]);
});

// ── svgArcToBeziers ──────────────────────────────────────────────────────────

test('svgArcToBeziers: degenerate same-point arc → no segments', () => {
  assert.deepEqual(svgArcToBeziers(0, 0, 5, 5, 0, 0, 1, 0, 0), []);
});

test('svgArcToBeziers: semicircle endpoints land on the circle, sweep flips sides', () => {
  const sweep0 = svgArcToBeziers(0, 0, 5, 5, 0, 0, 0, 10, 0);
  const sweep1 = svgArcToBeziers(0, 0, 5, 5, 0, 0, 1, 10, 0);
  assert.equal(sweep0.length, 2);
  assert.equal(sweep1.length, 2);
  // Segment endpoints stay on the r=5 circle centred at (5,0).
  for (const segs of [sweep0, sweep1]) {
    for (const [, , , , ex, ey] of segs) {
      assert.ok(Math.abs(Math.hypot(ex - 5, ey) - 5) < 1e-9, 'endpoint on circle');
    }
    const [, , , , lx, ly] = segs[segs.length - 1]!;
    assert.ok(Math.abs(lx - 10) < 1e-9 && Math.abs(ly) < 1e-9, 'arc ends at (10,0)');
  }
  // In SVG's y-down space, sweep=0 bulges through positive y, sweep=1 negative.
  assert.ok(sweep0[0]![5] > 0);
  assert.ok(sweep1[0]![5] < 0);
});

test('svgArcToBeziers: too-small radii scale up per spec F.6.6 and still hit the endpoint', () => {
  const segs = svgArcToBeziers(0, 0, 5, 5, 0, 0, 1, 20, 0); // chord 20 > 2r
  const [, , , , ex, ey] = segs[segs.length - 1]!;
  assert.ok(Math.abs(ex - 20) < 1e-9 && Math.abs(ey) < 1e-9);
});

test('parseSvgPathArgs: tolerant number scan incl. exponents; empty → []', () => {
  assert.deepEqual(parseSvgPathArgs('10 0 -5.5,3e1 .25'), [10, 0, -5.5, 30, 0.25]);
  assert.deepEqual(parseSvgPathArgs(''), []);
});

// ── geometry / rotation ──────────────────────────────────────────────────────

test('pureRotationDeg: detects a clean rotation, rejects scale/flip/identity', () => {
  assert.equal(pureRotationDeg(null), 0);
  assert.equal(pureRotationDeg('none'), 0);
  const c = Math.SQRT1_2;
  assert.ok(Math.abs(pureRotationDeg(`matrix(${c}, ${c}, ${-c}, ${c}, 0, 0)`) - 45) < 0.01);
  assert.ok(Math.abs(pureRotationDeg('matrix(0, 1, -1, 0, 4, 5)') - 90) < 0.01);
  assert.equal(pureRotationDeg('matrix(1, 0, 0, 1, 5, 7)'), 0, 'translation only');
  assert.equal(pureRotationDeg('matrix(2, 0, 0, 2, 0, 0)'), 0, 'uniform scale');
  assert.equal(pureRotationDeg('matrix(-1, 0, 0, 1, 0, 0)'), 0, 'scaleX(-1) flip');
  assert.equal(pureRotationDeg('rotate(45deg)'), 0, 'only matrix() form is parsed');
});

test('withPdfRotation: rotation about a pivot via T(c)·R·T(−c), state save/restored', async () => {
  const { ops, pdf } = pdfRecorder();
  pdf.Matrix = function (this: any, ...args: number[]) { (this as any).args = args; };
  let drawn = false;
  await withPdfRotation(pdf, 90, 10, 10, () => { drawn = true; });
  assert.ok(drawn);
  assert.deepEqual(names(ops), ['saveGraphicsState', 'setCurrentTransformationMatrix', 'restoreGraphicsState']);
  const m = (ops[1]![1] as any).args.map(round2);
  assert.deepEqual(m, [0, 1, -1, 0, 20, 0]); // cos90,sin90,−sin90,cos90, e=20, f=0
});

test('withPdfRotation: degrades to an unrotated draw when the matrix API is missing', async () => {
  const { ops, pdf } = pdfRecorder();
  delete pdf.setCurrentTransformationMatrix;
  let drawn = false;
  await withPdfRotation(pdf, 45, 0, 0, () => { drawn = true; });
  assert.ok(drawn);
  assert.deepEqual(ops, [], 'no graphics-state churn');
});

// ── clip / alpha / rounded-rect wrappers ─────────────────────────────────────

const RADII_UNEVEN: CornerRadii = {
  topLeft: [8, 8], topRight: [0, 0], bottomRight: [0, 0], bottomLeft: [0, 0],
};

test('pdfRoundedRect: uniform corners use the fast native calls', () => {
  const a = pdfRecorder();
  pdfRoundedRect(a.pdf, 1, 2, 3, 4, RADII_UNEVEN, [5, 6], 'F');
  assert.deepEqual(a.ops, [['roundedRect', 1, 2, 3, 4, 5, 6, 'F']]);
  const b = pdfRecorder();
  pdfRoundedRect(b.pdf, 1, 2, 3, 4, RADII_UNEVEN, [0, 0], 'S');
  assert.deepEqual(b.ops, [['rect', 1, 2, 3, 4, 'S']]);
});

test('pdfRoundedRect: per-corner radii fall back to a four-corner path + fill/stroke', () => {
  const { ops, pdf } = pdfRecorder();
  pdfRoundedRect(pdf, 0, 0, 10, 10, RADII_UNEVEN, null, 'F');
  assert.ok(ops.some(o => o[0] === 'curveTo'), 'rounded top-left corner emits a curve');
  assert.equal(ops[ops.length - 1]![0], 'fill');
  const s = pdfRecorder();
  pdfRoundedRect(s.pdf, 0, 0, 10, 10, RADII_UNEVEN, null, 'S');
  assert.equal(s.ops[s.ops.length - 1]![0], 'stroke');
});

test('withPdfAlpha: sets a GState, draws, then resets to opaque; no-op at alpha 1', () => {
  const states: any[] = [];
  const pdf: any = {
    GState: function (this: any, o: any) { (this as any).o = o; },
    setGState: (g: any) => states.push(g.o),
  };
  const order: string[] = [];
  withPdfAlpha(pdf, 0.5, () => order.push('draw'));
  assert.deepEqual(order, ['draw']);
  assert.deepEqual(states, [
    { opacity: 0.5, 'stroke-opacity': 0.5 },
    { opacity: 1, 'stroke-opacity': 1 },
  ]);
  states.length = 0;
  withPdfAlpha(pdf, 1, () => {});
  assert.deepEqual(states, [], 'opaque draw never touches GState');
});

test('withPdfClipRect: rect-as-path → clip → draw, restored even when draw throws', async () => {
  const { ops, pdf } = pdfRecorder();
  await withPdfClipRect(pdf, 1, 2, 3, 4, () => {});
  assert.deepEqual(names(ops), ['saveGraphicsState', 'rect', 'clip', 'discardPath', 'restoreGraphicsState']);
  assert.deepEqual(ops[1], ['rect', 1, 2, 3, 4, null], 'path-only rect (no paint op)');
  const t = pdfRecorder();
  await assert.rejects(withPdfClipRect(t.pdf, 0, 0, 1, 1, () => { throw new Error('boom'); }));
  assert.equal(t.ops[t.ops.length - 1]![0], 'restoreGraphicsState', 'state restored on throw');
});

test('withPdfRoundedClip: uniform vs per-corner clip paths', async () => {
  const a = pdfRecorder();
  await withPdfRoundedClip(a.pdf, 0, 0, 10, 10, RADII_UNEVEN, [4, 4], () => {});
  assert.deepEqual(a.ops[1], ['roundedRect', 0, 0, 10, 10, 4, 4, null]);
  const b = pdfRecorder();
  await withPdfRoundedClip(b.pdf, 0, 0, 10, 10, RADII_UNEVEN, [0, 0], () => {});
  assert.deepEqual(b.ops[1], ['rect', 0, 0, 10, 10, null]);
  const c = pdfRecorder();
  await withPdfRoundedClip(c.pdf, 0, 0, 10, 10, RADII_UNEVEN, null, () => {});
  assert.ok(c.ops.some(o => o[0] === 'curveTo'), 'per-corner path emitted');
  assert.deepEqual(names(c.ops).filter(n => n === 'clip' || n === 'discardPath'), ['clip', 'discardPath']);
});

test('pdfApplyClip: circle stays a circle under uniform scale, becomes an ellipse otherwise', () => {
  const a = pdfRecorder();
  pdfApplyClip(a.pdf, { kind: 'circle', cx: 10, cy: 10, r: 5 }, 100, 200, 2, 2);
  assert.deepEqual(a.ops, [['circle', 120, 220, 10, null], ['clip'], ['discardPath']]);
  const b = pdfRecorder();
  pdfApplyClip(b.pdf, { kind: 'circle', cx: 10, cy: 10, r: 5 }, 0, 0, 2, 1);
  assert.deepEqual(b.ops[0], ['ellipse', 20, 10, 10, 5, null]);
});

test('pdfApplyClip: inset and polygon shapes', () => {
  const a = pdfRecorder();
  pdfApplyClip(a.pdf, { kind: 'inset', x: 1, y: 2, w: 10, h: 20, r: 3 }, 0, 0, 1, 1);
  assert.deepEqual(a.ops[0], ['roundedRect', 1, 2, 10, 20, 3, 3, null]);
  const b = pdfRecorder();
  pdfApplyClip(b.pdf, { kind: 'polygon', points: [[0, 0], [10, 0], [5, 8]] }, 1, 1, 1, 1);
  assert.deepEqual(b.ops, [
    ['moveTo', 1, 1], ['lineTo', 11, 1], ['lineTo', 6, 9], ['close'],
    ['clip'], ['discardPath'],
  ]);
});

// ── colour parsing / conversion glue ─────────────────────────────────────────

test('parseSvgColor: hex, rgb(), named colours; none/transparent/url → null', () => {
  assert.deepEqual(parseSvgColor('#abc'), [170, 187, 204]);
  assert.deepEqual(parseSvgColor('#30BA78'), [48, 186, 120]);
  assert.deepEqual(parseSvgColor('rgb(1, 2, 3)'), [1, 2, 3]);
  assert.deepEqual(parseSvgColor('rgba(4,5,6,0.5)'), [4, 5, 6]);
  assert.deepEqual(parseSvgColor('steelblue'), [70, 130, 180]);
  assert.deepEqual(parseSvgColor('navy'), [0, 0, 128]);
  assert.equal(parseSvgColor('none'), null);
  assert.equal(parseSvgColor('transparent'), null);
  assert.equal(parseSvgColor('url(#grad)'), null);
  assert.equal(parseSvgColor(null), null);
});

test('blendSvgWithWhite: opacity blend toward white', () => {
  assert.deepEqual(blendSvgWithWhite([0, 0, 0], 0.5), [128, 128, 128]);
  assert.deepEqual(blendSvgWithWhite([10, 20, 30], 1), [10, 20, 30]);
  assert.deepEqual(blendSvgWithWhite([10, 20, 30], 0), [255, 255, 255]);
});

test('sampleGradientMidpoint: averages first/last stops, skips the direction token', () => {
  assert.deepEqual(sampleGradientMidpoint('linear-gradient(to right, #000000, #ffffff)'), [128, 128, 128]);
  assert.deepEqual(sampleGradientMidpoint('linear-gradient(90deg, rgb(0,0,0), rgb(100,100,100))'), [50, 50, 50]);
  assert.deepEqual(sampleGradientMidpoint('linear-gradient(#204060 0%, #204060 100%)'), [32, 64, 96]);
  assert.equal(sampleGradientMidpoint('radial-gradient(circle, #000, #fff)'), null);
  assert.equal(sampleGradientMidpoint('red'), null);
});

test('gradStopToRgb: hex shorthand, rgb() and unparseable stops', () => {
  assert.deepEqual(gradStopToRgb('#0f0 50%', 0, 2), [0, 255, 0]);
  assert.deepEqual(gradStopToRgb('rgba(9, 8, 7, 0.5) 10%', 0, 2), [9, 8, 7]);
  assert.equal(gradStopToRgb('var(--unknown)', 0, 2), null);
});

test('svgLen: percentages resolve against the total, plain numbers pass through', () => {
  assert.equal(svgLen('50%', 200), 100);
  assert.equal(svgLen('12', 999), 12);
  assert.equal(svgLen(25, 999), 25);
  assert.equal(svgLen(null, 999), 0);
  assert.equal(svgLen('garbage', 999), 0);
});

test('preserveAspectRatioAlign: object-position ↔ SVG alignment for the nine anchors', () => {
  assert.equal(preserveAspectRatioAlign('0% 0%'), 'xMinYMin');
  assert.equal(preserveAspectRatioAlign('left top'), 'xMinYMin');
  assert.equal(preserveAspectRatioAlign(undefined), 'xMidYMid');
  assert.equal(preserveAspectRatioAlign('50% 50%'), 'xMidYMid');
  assert.equal(preserveAspectRatioAlign('right bottom'), 'xMaxYMax');
  assert.equal(preserveAspectRatioAlign('0% 100%'), 'xMinYMax');
});

test('applyTextTransform: uppercase, lowercase, capitalize, passthrough', () => {
  assert.equal(applyTextTransform('Hello World', 'uppercase'), 'HELLO WORLD');
  assert.equal(applyTextTransform('Hello World', 'lowercase'), 'hello world');
  assert.equal(applyTextTransform('hello world two', 'capitalize'), 'Hello World Two');
  assert.equal(applyTextTransform('MiXeD', 'none'), 'MiXeD');
  assert.equal(applyTextTransform('MiXeD', undefined), 'MiXeD');
});

// ── brand-palette CMYK / spot machinery ──────────────────────────────────────

test('cmykKey: two-decimal quantisation matches jsPDF rounding of the same channel', () => {
  // jsPDF writes 124/255 as "0.49"; the hex-exact fraction must land on the
  // same bucket or every brand colour silently misses (the documented invariant).
  assert.equal(cmykKey(124 / 255, 0, 254 / 255), cmykKey(0.49, 0, 1));
  assert.equal(cmykKey(1, 0.5, 0), '100,50,0');
});

test('buildCmykPaletteMap: explicit cmyk lock wins; spot-only derives cmyk from hex', () => {
  const map = buildCmykPaletteMap([
    { hex: '#30BA78', cmyk: [90, 0, 60, 0] },
    { hex: '#0C322C', spot: { name: 'PANTONE 3308 C' } },
    { hex: '#FFFFFF' },                        // no lock → skipped
    { cmyk: [1, 2, 3, 4] },                    // no hex → skipped
    { hex: 'bad', cmyk: [1, 2, 3, 4] },        // malformed hex → skipped
  ]);
  assert.equal(map.size, 2);
  const green = map.get(cmykKey(0x30 / 255, 0xBA / 255, 0x78 / 255))!;
  assert.deepEqual(green.cmyk, [0.9, 0, 0.6, 0]);
  assert.equal(green.spot, undefined);
  const pine = map.get(cmykKey(0x0C / 255, 0x32 / 255, 0x2C / 255))!;
  assert.deepEqual(pine.cmyk, rgbToCmyk(0x0C / 255, 0x32 / 255, 0x2C / 255), 'derived from hex');
  assert.equal(pine.spot!.name, 'PANTONE 3308 C');
  assert.deepEqual(pine.spot!.cmyk, pine.cmyk);
});

test('paletteHitKey mirrors the map key; malformed hex → null', () => {
  const entry = { hex: '#30BA78', cmyk: [90, 0, 60, 0] };
  const map = buildCmykPaletteMap([entry]);
  assert.ok(map.has(paletteHitKey(entry)!));
  assert.equal(paletteHitKey({ hex: '#fff' }), null);
  assert.equal(paletteHitKey({}), null);
});

test('pdfColorHit records hits into the used set, misses return null', () => {
  const map = buildCmykPaletteMap([{ hex: '#FF0000', cmyk: [0, 100, 100, 0] }]);
  const used = new Set<string>();
  const hit = pdfColorHit(1, 0, 0, map, used);
  assert.deepEqual(hit!.cmyk, [0, 1, 1, 0]);
  assert.deepEqual([...used], [cmykKey(1, 0, 0)]);
  assert.equal(pdfColorHit(0.2, 0.4, 0.6, map, used), null);
  assert.equal(used.size, 1, 'miss records nothing');
});

test('assignSpotResourceNames: deterministic /CSn names, deduped by spot name', () => {
  const map = buildCmykPaletteMap([
    { hex: '#0C322C', spot: { name: 'Pine' } },
    { hex: '#30BA78', spot: { name: 'Jungle' } },
    { hex: '#EFEFEF', spot: { name: 'Pine' } }, // same ink again → same name
  ]);
  const names2 = assignSpotResourceNames(map);
  assert.equal(names2.size, 2);
  assert.deepEqual(new Set(names2.values()), new Set(['CS1', 'CS2']));
  assert.equal(assignSpotResourceNames(buildCmykPaletteMap([{ hex: '#FF0000', cmyk: [0, 100, 100, 0] }])).size, 0);
});

test('cmykN: compact PDF decimals (trailing zeros stripped, 4dp cap)', () => {
  assert.equal(cmykN(0), '0');
  assert.equal(cmykN(1), '1');
  assert.equal(cmykN(0.5), '0.5');
  assert.equal(cmykN(0.9), '0.9');
  assert.equal(cmykN(0.1234567), '0.1235');
  assert.equal(cmykN(0.25), '0.25');
});

test('substitutePdfRgb: process lock → k/K operators; unmatched → generic conversion', () => {
  const map = buildCmykPaletteMap([{ hex: '#FF0000', cmyk: [0, 100, 100, 0] }]);
  const spotNames = assignSpotResourceNames(map);
  const used = new Set<string>();
  const out = substitutePdfRgb('1 0 0 rg 1 0 0 RG', map, spotNames, used);
  // Red carries CMY → knockout (GSfk fill, GSsk stroke), never overprint.
  assert.equal(out, '/GSfk gs 0 1 1 0 k /GSsk gs 0 1 1 0 K');
  assert.deepEqual([...used], [cmykKey(1, 0, 0)]);
  // A non-palette colour falls back to the engine's generic conversion (also knockout).
  const [c, m, y, k] = rgbToCmyk(0.2, 0.4, 0.6);
  assert.equal(
    substitutePdfRgb('0.2 0.4 0.6 rg', map, spotNames),
    `/GSfk gs ${cmykN(c)} ${cmykN(m)} ${cmykN(y)} ${cmykN(k)} k`,
  );
});

test('substitutePdfRgb: spot lock switches to the /Separation colourspace at full tint', () => {
  const map = buildCmykPaletteMap([{ hex: '#0C322C', spot: { name: 'Pine' } }]);
  const spotNames = assignSpotResourceNames(map);
  const usedSpots = new Set<string>();
  const stream = `${cmykN(0x0C / 255)} ${cmykN(0x32 / 255)} ${cmykN(0x2C / 255)} rg`;
  // jsPDF emits two decimals; feed the exact two-decimal form it would write.
  const jsPdfStream = '0.05 0.2 0.17 rg 0.05 0.2 0.17 RG';
  assert.equal(cmykKey(0.05, 0.2, 0.17), cmykKey(0x0C / 255, 0x32 / 255, 0x2C / 255), stream);
  const out = substitutePdfRgb(jsPdfStream, map, spotNames, undefined, usedSpots);
  // An ordinary (non-finish) spot knocks out - GSfk fill, GSsk stroke.
  assert.equal(out, '/GSfk gs /CS1 cs 1 scn /GSsk gs /CS1 CS 1 SCN');
  assert.deepEqual([...usedSpots], ['Pine']);
});

test('brandSwatchPalette: normalises to 0–1, keeps labels/spot names, dedupes ramp repeats', () => {
  const out = brandSwatchPalette([
    { hex: '#FF0000', cmyk: [0, 100, 100, 0], label: 'Red' },
    { hex: '#FF0000', cmyk: [0, 100, 100, 0], label: 'Red again' }, // dupe hex+ink
    { hex: '#0C322C', spot: { name: 'Pine' }, label: 'Pine' },      // spot-only → derived cmyk
    { hex: '#00FF00' },                                             // no anchor → dropped
    { hex: 'transparent', cmyk: [0, 0, 0, 0] },                     // malformed hex → dropped
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { rgb: [1, 0, 0], cmyk: [0, 1, 1, 0], label: 'Red', spotName: undefined });
  assert.equal(out[1]!.spotName, 'Pine');
  assert.deepEqual(out[1]!.cmyk, rgbToCmyk(0x0C / 255, 0x32 / 255, 0x2C / 255));
});

// ── Declared finishes (host-v1 v1.91 SpotColor.finish) ───────────────────────
// A finish is a press instruction with its own plate, not a colour. Before this,
// `finish` was dropped at the BrandPaletteEntry type boundary, so a declared foil
// separated as an ordinary /Separation whose tint transform resolved to the
// swatch's own screen hex - i.e. a flattening RIP printed plausible metallic
// gold and nothing in the file said otherwise. These pin the mask build at every
// CMYK sink at once: hit.spot.cmyk is the PDF Separation's tint-transform C1,
// hit.cmyk is what the flat TIFF and EPS paths paint.

test('buildCmykPaletteMap: a finish never carries the swatch colour build', () => {
  const map = buildCmykPaletteMap([{ hex: '#C9A227', spot: { name: 'Gold', finish: 'foil' } }]);
  const hit = map.get(cmykKey(0xC9 / 255, 0xA2 / 255, 0x27 / 255))!;
  assert.ok(hit, 'finish swatch still qualifies for substitution');
  assert.deepEqual(hit.cmyk, FINISH_MASK_CMYK, 'TIFF/EPS sink paints the mask');
  assert.deepEqual(hit.spot!.cmyk, FINISH_MASK_CMYK, 'PDF Separation tint transform C1 is the mask');
  assert.equal(hit.spot!.name, 'Gold');
  assert.equal(hit.spot!.finish, 'foil');
  // And it is emphatically NOT the swatch's own derived build.
  assert.notDeepEqual(hit.cmyk, rgbToCmyk(0xC9 / 255, 0xA2 / 255, 0x27 / 255));
});

test('buildCmykPaletteMap: an explicit cmyk anchor does not defeat the finish mask', () => {
  const map = buildCmykPaletteMap([
    { hex: '#C9A227', cmyk: [10, 30, 90, 5], spot: { name: 'Gold', finish: 'foil' } },
  ]);
  const hit = map.get(cmykKey(0xC9 / 255, 0xA2 / 255, 0x27 / 255))!;
  // "An explicit lock always wins" is true for an INK and false for a finish:
  // an anchored "gold-ish" build is exactly the silent failure being removed.
  assert.deepEqual(hit.cmyk, FINISH_MASK_CMYK);
  assert.deepEqual(hit.spot!.cmyk, FINISH_MASK_CMYK);
});

test('buildCmykPaletteMap: an ordinary spot ink is byte-identical to before', () => {
  // Zero blast radius for every spot that exists today (none declare a finish).
  const derived = rgbToCmyk(0x0C / 255, 0x32 / 255, 0x2C / 255);
  const spotOnly = buildCmykPaletteMap([{ hex: '#0C322C', spot: { name: 'Pine' } }]);
  const h1 = spotOnly.get(cmykKey(0x0C / 255, 0x32 / 255, 0x2C / 255))!;
  assert.deepEqual(h1, { cmyk: derived, spot: { name: 'Pine', cmyk: derived } });
  assert.ok(!('finish' in h1.spot!), 'no finish key on an ordinary ink');

  // An explicit process anchor beside a spot lock still wins, as documented.
  const anchored = buildCmykPaletteMap([{ hex: '#FF0000', cmyk: [0, 100, 100, 0], spot: { name: 'Warm Red' } }]);
  assert.deepEqual(anchored.get(cmykKey(1, 0, 0)), {
    cmyk: [0, 1, 1, 0], spot: { name: 'Warm Red', cmyk: [0, 1, 1, 0] },
  });

  // And a plain process lock with no spot is untouched.
  const process = buildCmykPaletteMap([{ hex: '#FF0000', cmyk: [0, 100, 100, 0] }]);
  assert.deepEqual(process.get(cmykKey(1, 0, 0)), { cmyk: [0, 1, 1, 0] });
});

test('buildCmykPaletteMap: an unrecognised finish is honoured, not discarded', () => {
  // FinishKind is an OPEN union (host-v1): a house process must behave like any
  // other finish, never like an error and never like a plain ink.
  const map = buildCmykPaletteMap([{ hex: '#C9A227', spot: { name: 'Gold', finish: 'thermography' } }]);
  const hit = map.get(cmykKey(0xC9 / 255, 0xA2 / 255, 0x27 / 255))!;
  assert.deepEqual(hit.cmyk, FINISH_MASK_CMYK);
  assert.equal(hit.spot!.finish, 'thermography');
});

test('brandSwatchPalette: a finish cell is the mask and names the finish', () => {
  const out = brandSwatchPalette([
    { hex: '#0C322C', spot: { name: 'Pine' }, label: 'Pine' },
    { hex: '#C9A227', spot: { name: 'Gold', finish: 'foil' }, label: 'Foil' },
    // Same ink name, different finish → must not collide in the dedupe key.
    { hex: '#C9A227', spot: { name: 'Gold' }, label: 'Gold ink' },
  ]);
  assert.equal(out.length, 3);
  assert.equal(out[0]!.spotName, 'Pine');
  assert.deepEqual(out[0]!.cmyk, rgbToCmyk(0x0C / 255, 0x32 / 255, 0x2C / 255), 'ordinary ink unchanged');
  assert.equal(out[1]!.spotName, 'Gold (foil)');
  assert.deepEqual(out[1]!.cmyk, FINISH_MASK_CMYK, 'the bar must not assert a process build for a finish');
  assert.equal(out[2]!.spotName, 'Gold');
  assert.deepEqual(out[2]!.cmyk, rgbToCmyk(0xC9 / 255, 0xA2 / 255, 0x27 / 255));
});

test('substitutePdfRgb: a finish switches to its /Separation and OVERPRINTS', () => {
  // The mask build must not demote a finish to flat process ink in the PDF path - 
  // the named plate is the one thing a printer can actually act on - and a finish
  // OVERPRINTS (GSfo fill / GSso stroke) so it sits on the artwork, not through it.
  const map = buildCmykPaletteMap([{ hex: '#0C322C', spot: { name: 'Emboss', finish: 'emboss' } }]);
  const spotNames = assignSpotResourceNames(map);
  const usedSpots = new Set<string>();
  const usedGs = new Set<string>();
  const out = substitutePdfRgb('0.05 0.2 0.17 rg 0.05 0.2 0.17 RG', map, spotNames, undefined, usedSpots, usedGs);
  assert.equal(out, '/GSfo gs /CS1 cs 1 scn /GSso gs /CS1 CS 1 SCN');
  assert.deepEqual([...usedSpots], ['Emboss']);
  assert.deepEqual([...usedGs].sort(), ['GSfo', 'GSso']);
});

test('substitutePdfRgb: overprint policy - 100% K overprints, rich black + white knock out', () => {
  const map = buildCmykPaletteMap([]);
  const spotNames = assignSpotResourceNames(map);
  // Solid black (0 0 0 rg → C=M=Y=0, K=1) OVERPRINTS: GSfo fill, GSso stroke.
  const gs = new Set<string>();
  assert.equal(substitutePdfRgb('0 0 0 rg 0 0 0 RG', map, spotNames, undefined, undefined, gs), '/GSfo gs 0 0 0 1 k /GSso gs 0 0 0 1 K');
  assert.deepEqual([...gs].sort(), ['GSfo', 'GSso']);
  // White / paper (all-zero build) KNOCKS OUT so it never vanishes.
  assert.equal(substitutePdfRgb('1 1 1 rg', map, spotNames), '/GSfk gs 0 0 0 0 k');
  // A rich black lock (carries CMY) KNOCKS OUT - overprinting it would double-print.
  const rich = buildCmykPaletteMap([{ hex: '#0A0A0A', cmyk: [40, 30, 30, 100] }]);
  const richOut = substitutePdfRgb('0.0392 0.0392 0.0392 rg', rich, assignSpotResourceNames(rich));
  assert.match(richOut, /^\/GSfk gs /, richOut);
});

test('substitutePdfRgb: fill and stroke get independent overprint states', () => {
  const map = buildCmykPaletteMap([]);
  const spotNames = assignSpotResourceNames(map);
  // Black fill (overprint) followed by white stroke (knockout): the stroke-knockout
  // state must not touch the fill-overprint one.
  assert.equal(substitutePdfRgb('0 0 0 rg 1 1 1 RG', map, spotNames), '/GSfo gs 0 0 0 1 k /GSsk gs 0 0 0 0 K');
});

// Contract test (same spirit as a11y-prefs-contract.test.ts): the finish fix is
// placed in the SHARED builder precisely so a fourth CMYK format cannot
// reintroduce the defect. Assert no sink builds its own palette map.
test('contract: every CMYK sink obtains its palette through buildCmykPaletteMap', () => {
  const here = new URL('.', import.meta.url).pathname;
  const repo = `${here}../../../../`;
  const exportTs = readFileSync(`${here}export.ts`, 'utf8');
  const vectorTs = readFileSync(`${here}export-pdf-vector.ts`, 'utf8');
  const engineTs = readFileSync(`${repo}engine/src/cmyk-palette.ts`, 'utf8');
  // The FOURTH sink lives in another shell entirely. Scanning only shells/web is
  // how the finish fix stayed web-only while `lolly … --export=eps-cmyk` went on
  // silently converting a declared foil to gold, so the scan crosses the boundary
  // the defect crossed.
  const cliBridgeTs = readFileSync(`${repo}shells/cli/src/bridge.ts`, 'utf8');

  for (const [label, src] of [['export.ts', exportTs], ['cli/bridge.ts', cliBridgeTs]] as const) {
    for (const line of src.split('\n')) {
      if (!/\b(paletteMap|cmykPalette)\s*[:=][^:=]/.test(line)) continue;
      if (/Map</.test(line)) continue;                       // a type annotation, not a binding
      assert.match(line.trim(), /buildCmykPaletteMap\(|brandCmykPalette\(/,
        `${label}: a CMYK sink builds its own palette map instead of using the shared builder: ${line.trim()}`);
    }
    // No sink hand-constructs a spot hit (which is how `finish` got dropped).
    assert.ok(!/spot:\s*\{\s*name/.test(src),
      `${label} hand-constructs a spot hit - it must come from buildCmykPaletteMap`);
  }

  // The CLI's eps-cmyk sink must actually pass a palette; `cmyk: true` alone was
  // the whole bug.
  const eps = cliBridgeTs.slice(cliBridgeTs.indexOf("format === 'eps' || format === 'eps-cmyk'"));
  assert.match(eps.slice(0, 2000), /cmykPalette:/,
    'the CLI eps-cmyk sink passes no palette, so a declared finish is silently converted to its swatch colour');

  // The builder is the ENGINE's, so both shells share one implementation.
  assert.match(vectorTs, /export \{ buildCmykPaletteMap, cmykKey \}/,
    'export-pdf-vector.ts must re-export the engine builder, never redefine one');
  assert.match(engineTs, /export function buildCmykPaletteMap\(/);

  // Both places that derive a CMYK build from a brand swatch consult the finish.
  for (const [src, fn] of [[engineTs, 'buildCmykPaletteMap'], [vectorTs, 'brandSwatchPalette']] as const) {
    const start = src.indexOf(`export function ${fn}(`);
    assert.ok(start > 0, `${fn} not found`);
    const body = src.slice(start, start + 2000);
    assert.match(body, /FINISH_MASK_CMYK/, `${fn} must mask a declared finish`);
  }
});
