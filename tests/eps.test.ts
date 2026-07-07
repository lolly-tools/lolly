/**
 * EPS (Encapsulated PostScript) emitter contract tests.
 * Run with: node --test tests/eps.test.ts
 *
 * emitEps is a pure (ir, opts) -> PostScript-text function on the same vector
 * pipeline as SVG/EMF. These assertions read the EPS conventions independently
 * of the emitter's implementation: the magic line, the bounding boxes, the path
 * operators, the fill-rule paint logic, and the RGB/CMYK colour ops.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emitEps } from '../engine/src/eps.ts';

// A filled+stroked path with one cubic + line (nonzero), plus a fill-only
// triangle (evenodd) — same shape as the EMF suite's fixture.
const IR: any = {
  width: 600,
  height: 600,
  prims: [
    {
      type: 'path',
      subpaths: [{
        segments: [
          { op: 'M', x: 10, y: 10 },
          { op: 'C', x1: 20, y1: 0, x2: 40, y2: 0, x: 50, y: 10 },
          { op: 'L', x: 50, y: 50 },
        ],
        closed: true,
      }],
      fill: { r: 255, g: 0, b: 0 },
      stroke: { r: 0, g: 0, b: 0, width: 2 },
      fillRule: 'nonzero',
    },
    {
      type: 'path',
      subpaths: [{
        segments: [
          { op: 'M', x: 100, y: 100 },
          { op: 'L', x: 200, y: 100 },
          { op: 'L', x: 150, y: 200 },
        ],
        closed: true,
      }],
      fill: { r: 0, g: 128, b: 64 },
      stroke: null,
      fillRule: 'evenodd',
    },
  ],
};

// Pull the integer BoundingBox out of the header. The DSC line is exactly
// "%%BoundingBox: 0 0 <int> <int>".
function boundingBox(eps: string): { w: number; h: number } {
  const m = eps.match(/^%%BoundingBox: 0 0 (-?\d+) (-?\d+)$/m);
  assert.ok(m, 'has a "%%BoundingBox: 0 0 <int> <int>" line');
  return { w: Number(m![1]), h: Number(m![2]) };
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test('first line is exactly the EPSF magic comment', () => {
  const eps = emitEps(IR, { width: 600, height: 600 });
  assert.equal(eps.split('\n')[0], '%!PS-Adobe-3.0 EPSF-3.0');
  assert.match(eps, /^%%Creator: Lolly$/m);
});

test('header declares integer %%BoundingBox + %%HiResBoundingBox + LL2', () => {
  const eps = emitEps(IR, { width: 600, height: 600 });
  const bb = boundingBox(eps);
  assert.ok(Number.isInteger(bb.w) && Number.isInteger(bb.h), 'bbox values are ints');
  assert.match(eps, /^%%HiResBoundingBox: 0 0 /m, 'has a %%HiResBoundingBox line');
  assert.match(eps, /^%%LanguageLevel: 2$/m);
  assert.match(eps, /^%%EndComments$/m);
  assert.match(eps, /^%%EndProlog$/m);
});

test('document is bracketed by gsave/translate/scale and closes with showpage + %%EOF', () => {
  const eps = emitEps(IR, { width: 600, height: 600 });
  assert.match(eps, /^gsave$/m);
  assert.match(eps, /1 setlinejoin 1 setlinecap/);
  assert.match(eps, /translate$/m);
  assert.match(eps, /scale$/m);
  assert.ok(eps.includes('showpage'), 'has showpage');
  assert.match(eps, /^grestore$/m);
  assert.ok(eps.trimEnd().endsWith('%%EOF'), 'ends with %%EOF');
});

test('path primitives emit moveto / lineto / curveto / closepath', () => {
  const eps = emitEps(IR, { width: 600, height: 600 });
  assert.match(eps, /\bnewpath\b/);
  assert.match(eps, /\bmoveto\b/);
  assert.match(eps, /\blineto\b/);
  assert.match(eps, /\bcurveto\b/);
  assert.match(eps, /\bclosepath\b/);
});

test('fill rules: evenodd → eofill, nonzero → fill, fill+stroke wraps in gsave/grestore then strokes', () => {
  const eps = emitEps(IR, { width: 600, height: 600 });
  // The fill-only evenodd triangle paints with eofill.
  assert.match(eps, /\beofill\b/, 'evenodd prim uses eofill');
  // The nonzero prim paints with a plain fill (\bfill\b does not match inside "eofill").
  assert.match(eps, /\bfill\b/, 'nonzero prim uses fill');
  // Fill+stroke prim adds its own gsave/grestore around the fill, on top of the
  // document-level pair, then strokes.
  assert.ok(countOf(eps, 'gsave') >= 2, 'a second gsave wraps the filled+stroked path');
  assert.ok(countOf(eps, 'grestore') >= 2, 'matching grestore');
  assert.match(eps, /\bsetlinewidth\b/);
  assert.match(eps, /\bstroke\b/);
});

test('RGB mode uses setrgbcolor and never setcmykcolor', () => {
  const eps = emitEps(IR, { width: 600, height: 600 });
  assert.ok(eps.includes('setrgbcolor'), 'has setrgbcolor');
  assert.ok(!eps.includes('setcmykcolor'), 'no setcmykcolor in RGB mode');
});

test('CMYK mode uses setcmykcolor; pure red → "0 1 1 0 setcmykcolor"', () => {
  const eps = emitEps(IR, { width: 600, height: 600, cmyk: true });
  assert.ok(eps.includes('setcmykcolor'), 'has setcmykcolor');
  assert.ok(!eps.includes('setrgbcolor'), 'no setrgbcolor in CMYK mode');
  // rgbToCmyk(1,0,0) === [0,1,1,0]; the red fill {r:255,g:0,b:0} must emit it.
  assert.ok(eps.includes('0 1 1 0 setcmykcolor'), 'pure red separates to 0 1 1 0');
});

test('physical units set an A4 point bounding box (210×297mm → ~595×842pt, ceil)', () => {
  const eps = emitEps({ ...IR, width: 1, height: 1 }, { width: '210mm', height: '297mm' });
  const bb = boundingBox(eps);
  // 210mm = 595.28pt → ceil 596; 297mm = 841.89pt → ceil 842.
  assert.ok(Math.abs(bb.w - 596) <= 1, `A4 width ~596pt, got ${bb.w}`);
  assert.ok(Math.abs(bb.h - 842) <= 1, `A4 height ~842pt, got ${bb.h}`);
});

test('optional meta.title becomes a single-line %%Title (newlines stripped)', () => {
  const eps = emitEps(IR, { width: 600, height: 600, meta: { title: 'Hello\nWorld' } });
  const m = eps.match(/^%%Title: (.+)$/m);
  assert.ok(m, 'has a %%Title line');
  // If newlines were not stripped, "World" would spill onto a separate line and
  // this single-line capture would miss it.
  assert.ok(m![1]!.includes('Hello') && m![1]!.includes('World'), 'title kept on one line');
});

test('empty prims still produce a valid header / showpage / %%EOF with no path ops', () => {
  const eps = emitEps({ width: 10, height: 10, prims: [] }, {});
  assert.equal(eps.split('\n')[0], '%!PS-Adobe-3.0 EPSF-3.0');
  boundingBox(eps); // still a valid bbox line
  assert.ok(eps.includes('showpage'), 'has showpage');
  assert.ok(eps.trimEnd().endsWith('%%EOF'), 'ends with %%EOF');
  assert.ok(!eps.includes('moveto'), 'no path ops with empty prims');
});

// ── Image escape-hatch: Level-2 DeviceRGB `image` operator ───────────────────
const IMG_IR: any = {
  width: 100, height: 80,
  prims: [{
    type: 'image', x: 10, y: 20, w: 40, h: 30, pxW: 2, pxH: 2,
    rgb: Uint8Array.from([255, 0, 0,  0, 255, 0,  0, 0, 255,  255, 255, 255]),
  }],
};

test('image prim → Level-2 DeviceRGB image with correct matrix + hex data', () => {
  const eps = emitEps(IMG_IR, { width: 100, height: 80 });
  assert.match(eps, /%%LanguageLevel: 2/);
  assert.match(eps, /10 20 translate/, 'translate to dest top-left (device px)');
  assert.match(eps, /40 30 scale/, 'scale to dest size');
  assert.match(eps, /\/DeviceRGB setcolorspace/);
  assert.match(eps, /\/ImageType 1 \/Width 2 \/Height 2 \/BitsPerComponent 8/);
  assert.match(eps, /\/Decode \[0 1 0 1 0 1\]/);
  assert.match(eps, /\/ImageMatrix \[2 0 0 2 0 0\]/, 'row 0 at the top of the dest rect');
  assert.match(eps, /\/DataSource currentfile \/ASCIIHexDecode filter >> image/);
  // Hex is red,green,blue,white = ff0000 00ff00 0000ff ffffff (order preserved).
  assert.ok(eps.includes('ff000000ff000000ffffffff'), 'RGB hex stream present, top-first');
  // The ASCIIHexDecode EOD marker + gsave/grestore wrapper.
  assert.ok(/gsave[\s\S]*image[\s\S]*>\s*\ngrestore/.test(eps), 'wrapped in gsave/grestore with > EOD');
});

test('image + path prims coexist; CMYK variant keeps the image DeviceRGB', () => {
  const mixed: any = { width: 100, height: 80, prims: [IR.prims[0], IMG_IR.prims[0]] };
  const eps = emitEps(mixed, { width: 100, height: 80, cmyk: true });
  assert.match(eps, /setcmykcolor/, 'path still emits CMYK colour');
  assert.match(eps, /\/DeviceRGB setcolorspace/, 'image stays DeviceRGB even in the CMYK variant');
});
