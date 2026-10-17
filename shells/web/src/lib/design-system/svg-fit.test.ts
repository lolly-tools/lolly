// SPDX-License-Identifier: MPL-2.0
/**
 * fitSvgToArtwork / svgArtworkBounds (trim-bounds.ts): an SVG's viewBox fitted to
 * its painted artwork, strokes included, with only the root tag rewritten.
 *
 * Run with: node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/svg-fit.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitSvgToArtwork, svgArtworkBounds } from './trim-bounds.ts';

const body = (svg: string): string => svg.slice(svg.indexOf('>') + 1);

test('only the root tag changes; a physical size keeps its size per user unit', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100mm" height="100mm"><rect x="10" y="10" width="20" height="30" fill="red"/></svg>';
  const fit = fitSvgToArtwork(svg);
  assert.ok(fit.ok);
  assert.deepEqual(fit.box, { x: 10, y: 10, width: 20, height: 30 });
  assert.deepEqual(fit.before, { x: 0, y: 0, width: 100, height: 100 });
  assert.equal(fit.svg, '<svg viewBox="10 10 20 30" width="20mm" height="30mm" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="20" height="30" fill="red"/></svg>');
  assert.equal(body(fit.svg), body(svg));
  assert.equal(fit.raster, false);
});

test('without a viewBox, user units are CSS pixels and the size stays in its own unit', () => {
  const px = fitSvgToArtwork('<svg width="200" height="100"><rect x="50" y="25" width="100" height="50"/></svg>');
  assert.ok(px.ok);
  assert.match(px.svg, /^<svg viewBox="50 25 100 50" width="100" height="50">/);
  const inches = fitSvgToArtwork('<svg width="2in" height="1in"><rect x="48" y="24" width="96" height="48"/></svg>');
  assert.ok(inches.ok);
  assert.match(inches.svg, /^<svg viewBox="48 24 96 48" width="1in" height="0.5in">/);
});

test('a relative size is dropped so the viewBox sizes the drawing', () => {
  const fit = fitSvgToArtwork('<svg viewBox="0 0 50 50" width="100%" height="100%"><circle cx="25" cy="25" r="10"/></svg>');
  assert.ok(fit.ok);
  assert.match(fit.svg, /^<svg viewBox="15 15 20 20">/);
});

test('strokes widen the painted box, inheriting through groups', () => {
  const round = svgArtworkBounds('<svg viewBox="0 0 100 100"><g stroke="#000" stroke-width="4" stroke-linejoin="round"><path d="M10 10 L50 10 L50 50"/></g></svg>');
  assert.deepEqual(round.box, { x: 8, y: 8, width: 44, height: 44 });
  const mitred = svgArtworkBounds('<svg viewBox="0 0 100 100"><rect x="10" y="10" width="10" height="10" style="stroke: blue; stroke-width: 2"/></svg>');
  assert.deepEqual(mitred.box, { x: 6, y: 6, width: 18, height: 18 }, 'default miter limit 4 bounds every corner');
  const none = svgArtworkBounds('<svg viewBox="0 0 100 100"><g stroke="#000" stroke-width="4"><rect x="10" y="10" width="10" height="10" stroke="none"/></g></svg>');
  assert.deepEqual(none.box, { x: 10, y: 10, width: 10, height: 10 });
  const sheet = svgArtworkBounds('<svg viewBox="0 0 100 100"><style>.a{stroke:#000;stroke-width:3}</style><rect class="a" x="10" y="10" width="10" height="10" stroke="none"/></svg>');
  assert.deepEqual(sheet.box, { x: 4, y: 4, width: 22, height: 22 }, 'a stylesheet stroke outranks the attribute');
});

test('content whose painted edge cannot be measured is refused, never cropped', () => {
  for (const [svg, why] of [
    ['<svg viewBox="0 0 100 100"><rect width="10" height="10"/><text x="80" y="90">Hi</text></svg>', /text/],
    ['<svg viewBox="0 0 100 100"><defs><path id="p" d="M0 0h5"/></defs><use href="#p" x="90"/></svg>', /<use> reference/],
    ['<svg viewBox="0 0 100 100"><rect width="10" height="10" filter="url(#blur)"/></svg>', /filter/],
    ['<svg viewBox="0 0 100 100"><path d="M0 0L10 10" marker-end="url(#m)"/></svg>', /markers/],
    ['<svg viewBox="0 0 100 100"><svg x="10" viewBox="0 0 1 1"><rect width="1" height="1"/></svg></svg>', /nested <svg>/],
  ] as const) {
    const fit = fitSvgToArtwork(svg);
    assert.equal(fit.ok, false);
    assert.match(!fit.ok ? fit.reason : '', why);
  }
});

test('a raster image wrapped in SVG is fitted and reported as raster, not vector', () => {
  const fit = fitSvgToArtwork('<svg viewBox="0 0 400 300"><image href="data:image/png;base64,AAAA" x="100" y="50" width="200" height="100"/></svg>');
  assert.ok(fit.ok);
  assert.equal(fit.raster, true);
  assert.match(fit.svg, /viewBox="100 50 200 100"/);
});

test('nothing drawn, or a viewBox that already fits, leaves the file alone with a reason', () => {
  const empty = fitSvgToArtwork('<svg viewBox="0 0 10 10"><defs><rect width="4" height="4"/></defs></svg>');
  assert.equal(empty.ok, false);
  const fitted = fitSvgToArtwork('<svg viewBox="10 10 20 30"><rect x="10" y="10" width="20" height="30"/></svg>');
  assert.equal(fitted.ok, false);
  assert.match(!fitted.ok ? fitted.reason : '', /already fits/);
  assert.equal(fitSvgToArtwork('<html></html>').ok, false);
});

test('padding is added in user units on every side', () => {
  const fit = fitSvgToArtwork('<svg viewBox="0 0 100 100"><rect x="10" y="10" width="20" height="30"/></svg>', { pad: 2 });
  assert.ok(fit.ok);
  assert.match(fit.svg, /viewBox="8 8 24 34"/);
});
