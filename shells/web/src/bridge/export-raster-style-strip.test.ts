// Regression guard for the "gradient SVG vanishes from PDF" bug.
//
// The <img>→SVG PDF branch appends the inlined SVG off-screen so the vector walk can
// read computed fills - style="position:absolute;left:-99999px;top:0;width:Npx;height:Mpx".
// When the SVG contains a gradient it takes the raster escape-hatch instead, which CLONES
// that same element, serialises it, and loads it standalone as an <img>. If the off-screen
// layout style rides into the clone, left:-99999px shifts the whole artwork off the raster
// (→ a fully transparent PNG) and a style width/height overrides the raster's sizing
// attributes. That is exactly how bag-video's gradient Geeko came out MISSING from every
// Design PDF while it rendered on-screen and in SVG export.
//
// stripRasterLayoutStyle() is the fix boundary: it must remove every layout prop from the
// clone while leaving paint-bearing declarations (color for currentColor, --custom-props
// for var() fills) intact. Rasterisation itself needs a real browser, so this pins the
// serialisation-level invariant that the pixel bug depended on.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { stripRasterLayoutStyle } from './export.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.document = dom.window.document;

const SVG_NS = 'http://www.w3.org/2000/svg';

test('stripRasterLayoutStyle removes the off-screen layout props that blank the raster', () => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  // The exact style the <img>→SVG branch stamps on for the off-screen measure.
  svg.setAttribute('style', 'position:absolute;left:-99999px;top:0;width:521px;height:845px');

  stripRasterLayoutStyle(svg);

  const s = (svg as unknown as HTMLElement).style;
  for (const p of ['position', 'left', 'top', 'width', 'height']) {
    assert.equal(s.getPropertyValue(p), '', `${p} must be stripped (it blanks/mis-sizes the raster)`);
  }
  // left:-99999px is the specific value that shifted the artwork off the raster.
  assert.ok(!svg.getAttribute('style')?.includes('-99999'), 'the off-screen offset must not survive into the serialised clone');
});

test('stripRasterLayoutStyle preserves paint-bearing declarations (currentColor, var() fills)', () => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('style', 'position:absolute;left:-99999px;color:#ff0000;--brand:#00ff88');

  stripRasterLayoutStyle(svg);

  const s = (svg as unknown as HTMLElement).style;
  assert.equal(s.getPropertyValue('position'), '', 'layout prop still stripped alongside paint props');
  // color drives currentColor; the custom property drives var() fills - both must survive
  // or a legitimately-styled artwork would lose its paint in the raster.
  assert.equal(s.getPropertyValue('color'), 'rgb(255, 0, 0)', 'color (currentColor source) must be preserved');
  assert.equal(s.getPropertyValue('--brand'), '#00ff88', 'custom property (var() fill source) must be preserved');
});

test('stripRasterLayoutStyle is a no-op on an element with no style', () => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  assert.doesNotThrow(() => stripRasterLayoutStyle(svg));
  assert.equal(svg.getAttribute('style'), null);
});
