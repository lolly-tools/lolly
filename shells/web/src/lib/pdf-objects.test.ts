// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the PDF function/shading/pattern decoders (lib/pdf-objects.ts),
 * driven by REAL in-memory pdf-lib objects - the same object graph a loaded
 * document produces, just assembled by hand.
 *
 * These are the four gates that, closed, turned the Brand Studio colours tab into a
 * white ghost page:
 *   buildShading  refused anything but ShadingType 2/3
 *   buildPattern  refused anything but PatternType 2
 *   parseFunction refused FunctionType 4
 *   and the engine's `scn` CLEARED the fill for a pattern it couldn't reproduce
 * The last test drives the whole shell→engine pipe and asserts the coarse property
 * that actually failed: a wall of pattern-filled swatches yields a wall of distinct
 * colours, not white.
 *
 * Run with: node --test shells/web/src/lib/pdf-objects.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PDFArray, PDFContext, PDFDict, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import type { PDFObject } from 'pdf-lib';

import { buildPattern, buildShading, shadingComps, type ShadingCtx } from './pdf-objects.ts';
import type { TileSource } from './pdf-shading.ts';
import { interpretPdfPage } from '../../../../engine/src/pdf-map.ts';
import type { PdfPattern, PdfResources } from '../../../../engine/src/pdf-map.ts';

// ── in-memory PDF object builders ────────────────────────────────────────────

const ctx = (): PDFContext => PDFContext.create();
const arr = (c: PDFContext, vals: number[]): PDFArray => {
  const a = PDFArray.withContext(c);
  for (const v of vals) a.push(PDFNumber.of(v));
  return a;
};
const dict = (c: PDFContext, entries: Record<string, PDFObject>): PDFDict => {
  const d = PDFDict.withContext(c);
  for (const [k, v] of Object.entries(entries)) d.set(PDFName.of(k), v);
  return d;
};
const stream = (c: PDFContext, entries: Record<string, PDFObject>, body: string): PDFRawStream =>
  PDFRawStream.of(dict(c, entries), new TextEncoder().encode(body));

interface Harness { ec: ShadingCtx; warns: string[]; tiles: Map<string, TileSource>; resourceCalls: number; }
function harness(c: PDFContext, nested: PdfResources = {}): Harness {
  const warns: string[] = [];
  const tiles = new Map<string, TileSource>();
  const h = {
    warns, tiles, resourceCalls: 0,
    ec: {
      ctx: c, tiles, warn: (m: string) => warns.push(m),
      resources: (): PdfResources => { h.resourceCalls++; return nested; },
    } as ShadingCtx,
  };
  return h;
}

/** A FunctionType 4 taking (u,v) and returning three components. */
const type4 = (c: PDFContext, body: string): PDFRawStream => stream(c, {
  FunctionType: PDFNumber.of(4),
  Domain: arr(c, [0, 1, 0, 1]),
  Range: arr(c, [0, 1, 0, 1, 0, 1]),
}, body);

/** A ShadingType 1 over that function. */
const type1Shading = (c: PDFContext, fn: PDFObject, extra: Record<string, PDFObject> = {}): PDFDict => dict(c, {
  ShadingType: PDFNumber.of(1),
  ColorSpace: PDFName.of('DeviceRGB'),
  Domain: arr(c, [0, 1, 0, 1]),
  Function: fn,
  ...extra,
});

// ── colour spaces ────────────────────────────────────────────────────────────
test('shadingComps buckets device spaces by component count', () => {
  assert.equal(shadingComps('DeviceRGB'), 3);
  assert.equal(shadingComps('DeviceGray'), 1);
  assert.equal(shadingComps('DeviceCMYK'), 4);
  assert.equal(shadingComps(null), 3);
});

// ── ShadingType 1 + FunctionType 4: the three rungs ──────────────────────────
test('a CONSTANT Type-4 function-based shading resolves to a flat colour', () => {
  const c = ctx();
  const h = harness(c);
  // `{ pop pop 0.2 0.4 0.6 }` - drop both inputs, push a fixed RGB.
  const sh = buildShading(h.ec, type1Shading(c, type4(c, '{ pop pop 0.2 0.4 0.6 }')));
  assert.ok(sh, 'shading decoded');
  assert.equal(sh!.type, 1);
  assert.equal(sh!.tileKey, undefined, 'a constant field needs no raster tile');
  assert.equal(sh!.flat, '#336699');
  assert.deepEqual(h.warns, ['shading.type1.flat']);
  assert.equal(h.tiles.size, 0);
});

test('a LINEAR Type-4 function-based shading is re-expressed as an axial gradient', () => {
  const c = ctx();
  const h = harness(c);
  // f(u,v) = (u, u, u): drop v, then triplicate u.
  const sh = buildShading(h.ec, type1Shading(c, type4(c, '{ pop dup dup }')));
  assert.ok(sh, 'shading decoded');
  assert.equal(sh!.type, 2, 'emitted as a real ShadingType 2 - vector, not raster');
  assert.equal(sh!.tileKey, undefined);
  assert.ok(sh!.stops.length >= 2);
  assert.equal(sh!.stops[0]!.color, '#000000');
  assert.equal(sh!.stops[sh!.stops.length - 1]!.color, '#ffffff');
  const [x0, y0, x1, y1] = sh!.coords as [number, number, number, number];
  assert.ok(Math.abs(y1 - y0) < 1e-6 && x1 > x0, `horizontal axis expected, got ${sh!.coords}`);
  assert.deepEqual(h.warns, ['shading.type1.axialised']);
});

test('an irreducibly 2-D Type-4 shading registers a raster tile plus a mean colour', () => {
  const c = ctx();
  const h = harness(c);
  // A hue sweep: R from the angle (atan, DEGREES 0..360), G/B from the radius.
  const prog = '{ 2 copy 0.5 sub exch 0.5 sub exch atan 360 div 3 1 roll '
    + '0.5 sub dup mul exch 0.5 sub dup mul add sqrt 1.414 div dup }';
  const sh = buildShading(h.ec, type1Shading(c, type4(c, prog)));
  assert.ok(sh, 'shading decoded');
  assert.equal(sh!.type, 1);
  assert.equal(sh!.tileKey, 'shd0');
  assert.match(sh!.flat!, /^#[0-9a-f]{6}$/);
  assert.deepEqual(h.warns, ['shading.type1.tiled']);
  assert.equal(h.tiles.size, 1, 'the tile source is registered but NOT rasterised here');
  assert.ok(h.tiles.get('shd0')!.evaluate(0.9, 0.7), 'the registered evaluator works');
  // The wheel's exact centre is `0 0 atan` - undefined, so the evaluator faults
  // there rather than inventing a colour. That pixel renders transparent and the
  // node's flat back-stop shows through.
  assert.equal(h.tiles.get('shd0')!.evaluate(0.5, 0.5), null);
});

test('the shading dict’s own /Matrix rides on shadingMatrix, unbaked', () => {
  const c = ctx();
  const h = harness(c);
  const sh = buildShading(h.ec, type1Shading(c, type4(c, '{ pop pop 0.2 0.4 0.6 }'), { Matrix: arr(c, [2, 0, 0, 3, 10, 20]) }));
  assert.deepEqual(sh!.shadingMatrix, [2, 0, 0, 3, 10, 20]);
  assert.deepEqual(sh!.domain, [0, 1, 0, 1]);
});

test('a non-unit /Domain is carried through verbatim', () => {
  const c = ctx();
  const h = harness(c);
  const s = type1Shading(c, type4(c, '{ pop pop 0.2 0.4 0.6 }'));
  s.set(PDFName.of('Domain'), arr(c, [-1, 1, 0, 2]));
  const sh = buildShading(h.ec, s);
  assert.deepEqual(sh!.domain, [-1, 1, 0, 2]);
});

test('a Type-4 program we cannot compile is reported and the shading dropped', () => {
  const c = ctx();
  const h = harness(c);
  assert.equal(buildShading(h.ec, type1Shading(c, type4(c, '{ 1 2 frobnicate'))), null);
  assert.ok(h.warns.includes('function.type4.unparsed'), JSON.stringify(h.warns));
});

// ── the still-supported axial path must not regress ──────────────────────────
test('a ShadingType 2 over a Type-2 exponential function still yields stops + a flat', () => {
  const c = ctx();
  const h = harness(c);
  const fn = dict(c, {
    FunctionType: PDFNumber.of(2), Domain: arr(c, [0, 1]),
    C0: arr(c, [1, 0, 0]), C1: arr(c, [0, 0, 1]), N: PDFNumber.of(1),
  });
  const sh = buildShading(h.ec, dict(c, {
    ShadingType: PDFNumber.of(2), ColorSpace: PDFName.of('DeviceRGB'),
    Coords: arr(c, [0, 0, 100, 0]), Function: fn,
  }));
  assert.ok(sh);
  assert.equal(sh!.type, 2);
  assert.equal(sh!.stops[0]!.color, '#ff0000');
  assert.equal(sh!.stops[sh!.stops.length - 1]!.color, '#0000ff');
  assert.match(sh!.flat!, /^#[0-9a-f]{6}$/, 'even an axial shading carries a back-stop colour');
  assert.deepEqual(h.warns, []);
});

test('a mesh shading (types 4–7) is refused, with the type named', () => {
  const c = ctx();
  const h = harness(c);
  assert.equal(buildShading(h.ec, dict(c, { ShadingType: PDFNumber.of(7) })), null);
  assert.deepEqual(h.warns, ['shading.unsupported (ShadingType 7)']);
});

// ── patterns ─────────────────────────────────────────────────────────────────
test('PatternType 2 over a constant shading unwraps to a plain colour', () => {
  const c = ctx();
  const h = harness(c);
  const pat = buildPattern(h.ec, dict(c, {
    PatternType: PDFNumber.of(2),
    Matrix: arr(c, [1, 0, 0, 1, 5, 6]),
    Shading: type1Shading(c, type4(c, '{ pop pop 1 0.5 0 }')),
  }), 0);
  assert.ok(pat);
  assert.equal(pat!.flat, '#ff8000');
  assert.equal(pat!.shading, undefined, 'no gradient def for what is only a colour');
  assert.deepEqual(pat!.matrix, [1, 0, 0, 1, 5, 6]);
});

test('PatternType 2 over a real gradient keeps BOTH the shading and the back-stop', () => {
  const c = ctx();
  const h = harness(c);
  const pat = buildPattern(h.ec, dict(c, {
    PatternType: PDFNumber.of(2),
    Shading: type1Shading(c, type4(c, '{ pop dup dup }')),
  }), 0);
  assert.ok(pat?.shading, 'gradient present');
  assert.equal(pat!.shading!.type, 2);
  assert.match(pat!.flat!, /^#[0-9a-f]{6}$/);
});

test('PatternType 1 comes back as a tiling body with its own resources', () => {
  const c = ctx();
  const nested: PdfResources = { patterns: { P5: { flat: '#ff8800' } } };
  const h = harness(c, nested);
  const body = '/G8 gs\n/Pattern CS /Pattern cs /P5 SCN /P5 scn\n0 0 1080 676 re\nf*';
  const pat = buildPattern(h.ec, stream(c, {
    PatternType: PDFNumber.of(1),
    PaintType: PDFNumber.of(1),
    TilingType: PDFNumber.of(1),
    BBox: arr(c, [0, 0, 1080, 676]),
    XStep: PDFNumber.of(1080),
    YStep: PDFNumber.of(676),
    Resources: dict(c, {}),
  }, body), 0);
  assert.ok(pat?.tiling, 'tiling decoded');
  assert.equal(pat!.tiling!.content, body);
  assert.deepEqual(pat!.tiling!.bbox, [0, 0, 1080, 676]);
  assert.equal(pat!.tiling!.xStep, 1080);
  assert.equal(pat!.tiling!.paintType, 1);
  assert.equal(pat!.tiling!.resources, nested);
  assert.equal(h.resourceCalls, 1, 'the pattern’s own /Resources were walked');
  assert.deepEqual(h.warns, []);
});

test('PaintType 2 (an uncoloured stencil tile) is reported as such', () => {
  const c = ctx();
  const h = harness(c);
  const pat = buildPattern(h.ec, stream(c, {
    PatternType: PDFNumber.of(1), PaintType: PDFNumber.of(2),
    BBox: arr(c, [0, 0, 10, 10]),
  }, '0 0 10 10 re f'), 0);
  assert.equal(pat!.tiling!.paintType, 2);
  assert.equal(pat!.tiling!.xStep, 10, 'XStep defaults to the bbox width');
});

test('a tiling pattern with no BBox is refused rather than half-decoded', () => {
  const c = ctx();
  const h = harness(c);
  assert.equal(buildPattern(h.ec, stream(c, { PatternType: PDFNumber.of(1) }, 're f'), 0), null);
  assert.deepEqual(h.warns, ['pattern.unsupported (tiling, no stream or BBox)']);
});

test('an unknown PatternType is refused, with the type named', () => {
  const c = ctx();
  const h = harness(c);
  assert.equal(buildPattern(h.ec, dict(c, { PatternType: PDFNumber.of(9) }), 0), null);
  assert.deepEqual(h.warns, ['pattern.unsupported (PatternType 9)']);
});

// ── the whole shell → engine pipe, on the shape that failed ──────────────────
test('a wall of Chromium-shaped oklch swatches yields distinct colours, not white', () => {
  // Reproduces the observed print output: every swatch fills with a PatternType 1
  // whose only content is `/Pn scn <bbox> re f*`, where Pn is a PatternType 2 over
  // a ShadingType 1 driven by a constant FunctionType 4. Before this change all 40
  // fills resolved to '' and the page rendered white.
  const c = ctx();
  const h = harness(c);
  const N = 40;
  const patterns: Record<string, PdfPattern> = {};
  let content = '';
  for (let i = 0; i < N; i++) {
    const rgb = [i / N, 1 - i / N, ((i * 7) % N) / N];
    const inner = buildPattern(h.ec, dict(c, {
      PatternType: PDFNumber.of(2),
      Shading: type1Shading(c, type4(c, `{ pop pop ${rgb.map((v) => v.toFixed(4)).join(' ')} }`)),
    }), 0);
    assert.ok(inner, `inner pattern ${i}`);
    const outer = buildPattern(h.ec, stream(c, {
      PatternType: PDFNumber.of(1), PaintType: PDFNumber.of(1),
      BBox: arr(c, [0, 0, 40, 40]),
    }, `/G0 gs /Pattern CS /Pattern cs /S${i} SCN /S${i} scn 0 0 40 40 re f*`), 0);
    assert.ok(outer?.tiling, `outer pattern ${i}`);
    outer!.tiling!.resources = { patterns: { [`S${i}`]: inner! } };
    patterns[`P${i}`] = outer!;
    content += `q 1 0 0 1 ${(i % 8) * 45} ${Math.floor(i / 8) * 45} cm /P${i} scn 0 0 40 40 re f Q `;
  }

  const warns: string[] = [];
  const nodes = interpretPdfPage({
    content, width: 400, height: 300, patterns,
    onWarn: (code) => warns.push(code),
  });

  assert.equal(nodes.length, N, 'every swatch became a node');
  const fills = new Set(nodes.map((n) => n.fill).filter((f): f is string => !!f && f !== '#ffffff'));
  assert.ok(fills.size >= N, `expected ≥${N} distinct non-white fills, got ${fills.size}`);
  assert.equal(warns.filter((w) => w === 'pattern.tiling.collapsed').length, N);
  assert.equal(warns.filter((w) => w === 'pattern.unsupported').length, 0);
});
