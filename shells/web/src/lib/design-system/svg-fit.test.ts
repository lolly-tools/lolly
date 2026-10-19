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

const refusalOf = (svg: string): string => {
  const fit = fitSvgToArtwork(svg);
  assert.equal(fit.ok, false, `fitted: ${fit.ok ? fit.svg : ''}`);
  return !fit.ok ? fit.reason : '';
};

test('a CSS transform, a root transform or a transform the scan cannot read is refused, never cropped', () => {
  const rect = '<rect x="10" y="10" width="20" height="20"';
  assert.match(refusalOf(`<svg viewBox="0 0 100 100">${rect} style="transform: translate(50px,50px)"/></svg>`), /a CSS transform/);
  assert.match(refusalOf(`<svg viewBox="0 0 100 100"><style>rect{transform:translate(50px,50px)}</style>${rect}/></svg>`), /a CSS transform/);
  assert.match(refusalOf(`<svg viewBox="0 0 100 100" transform="translate(40 0)">${rect}/></svg>`), /a transform on the root <svg>/);
  assert.match(refusalOf(`<svg viewBox="0 0 100 100"><style>.a{translate:50px 0}</style>${rect} class="a"/></svg>`), /a CSS transform/);
  assert.match(refusalOf(`<svg viewBox="0 0 100 100">${rect} transform="rotate(45)" style="transform-origin:center"/></svg>`), /a CSS transform/);
  assert.match(refusalOf(`<svg viewBox="0 0 100 100">${rect} transform="rotate(45)" transform-origin="20 20"/></svg>`), /a transform origin/);
  assert.match(refusalOf(`<svg viewBox="0 0 100 100">${rect} transform="translateX(50)"/></svg>`), /a transform that cannot be read/);
  assert.match(refusalOf(`<svg viewBox="0 0 100 100">${rect} transform="rotate(45deg)"/></svg>`), /a transform that cannot be read/);
  assert.match(refusalOf(`<svg viewBox="0 0 100 100">${rect} transform="matrix(1 0 0 1 50)"/></svg>`), /a transform that cannot be read/);
  const readable = fitSvgToArtwork(`<svg viewBox="0 0 100 100">${rect} transform="translate(5, 5) scale(2)"/><rect x="0" y="0" width="1" height="1" transform="none"/></svg>`);
  assert.ok(readable.ok && readable.box.x === 0 && readable.box.width === 65, 'attribute transforms are measured');
});

test('stroke widths that are not fixed lengths, non-numeric miter limits and non-scaling strokes are refused', () => {
  const stroked = (attrs: string) => `<svg viewBox="0 0 100 100"><rect x="10" y="10" width="20" height="20" stroke="#000" ${attrs}/></svg>`;
  for (const width of ['1em', '2ex', '1rem', 'calc(4px + 2px)', 'var(--w)', '5%']) {
    assert.match(refusalOf(stroked(`stroke-width="${width}"`)), /a stroke width that is not a fixed length/, width);
  }
  assert.match(refusalOf(stroked('style="stroke-width: var(--w)"')), /not a fixed length/);
  assert.match(refusalOf('<svg viewBox="0 0 100 100"><style>rect{stroke-width:1em}</style><rect width="20" height="20"/></svg>'), /not a fixed length/);
  assert.match(refusalOf('<svg viewBox="0 0 100 100"><style>rect{stroke:#000;stroke-width:inherit}</style><rect width="20" height="20"/></svg>'), /not a fixed length/);
  assert.match(refusalOf(stroked('stroke-miterlimit="var(--m)"')), /a stroke miter limit that is not a number/);
  assert.match(refusalOf('<svg viewBox="0 0 100 100"><g transform="scale(0.1)"><rect x="100" y="100" width="200" height="200" stroke="#000" stroke-width="10" vector-effect="non-scaling-stroke"/></g></svg>'), /a non-scaling stroke/);
  assert.match(refusalOf('<svg viewBox="0 0 100 100"><style>rect{vector-effect:non-scaling-stroke}</style><rect width="20" height="20" stroke="#000"/></svg>'), /a non-scaling stroke/);
});

test('stroke widths inherit, convert absolute units and take the widest stylesheet width and miter limit', () => {
  const inherit = svgArtworkBounds('<svg viewBox="0 0 100 100"><g stroke="#000" stroke-width="4" stroke-linejoin="round"><rect x="10" y="10" width="10" height="10" stroke-width="inherit"/></g></svg>');
  assert.deepEqual(inherit.box, { x: 8, y: 8, width: 14, height: 14 });
  const inches = svgArtworkBounds('<svg viewBox="0 0 100 100"><rect x="30" y="30" width="10" height="10" stroke="#000" stroke-width="0.25in" stroke-linejoin="round"/></svg>');
  assert.deepEqual(inches.box, { x: 18, y: 18, width: 34, height: 34 }, '0.25in is 24 user units');
  // A sharp join whose miter reaches about x=40: the sheet's limit of 20 bounds it at 20 units.
  const join = '<path d="M10 10 L30 12 L10 14"';
  const sheetMiter = svgArtworkBounds(`<svg viewBox="0 0 100 100"><style>.a{stroke:#000;stroke-width:2;stroke-miterlimit:20}.b{stroke-miterlimit:2}</style>${join} class="a"/></svg>`);
  assert.deepEqual(sheetMiter.box, { x: -10, y: -10, width: 60, height: 44 });
  const lowSheetMiter = svgArtworkBounds(`<svg viewBox="0 0 100 100"><style>.a{stroke:#000;stroke-width:2;stroke-miterlimit:2}</style>${join} class="a"/></svg>`);
  assert.deepEqual(lowSheetMiter.box, { x: 6, y: 6, width: 28, height: 12 }, 'never below the default limit of 4');
  const attributeStroke = svgArtworkBounds(`<svg viewBox="0 0 100 100"><style>path{stroke-miterlimit:20}</style>${join} stroke="#000" stroke-width="2"/></svg>`);
  assert.deepEqual(attributeStroke.box, { x: -10, y: -10, width: 60, height: 44 }, 'a sheet limit applies to an attribute stroke');
  const sheetWidth = svgArtworkBounds('<svg viewBox="0 0 100 100"><style>rect{stroke-width:6}</style><rect x="10" y="10" width="10" height="10" stroke="#000" stroke-linejoin="round"/></svg>');
  assert.deepEqual(sheetWidth.box, { x: 7, y: 7, width: 16, height: 16 }, 'a sheet width applies to an attribute stroke');
});

test('a visible shape inside a hidden group is measured, and stylesheet display rules are not trusted to hide', () => {
  const shape = (x: number, extra = '') => `<rect x="${x}" y="${x}" width="10" height="10"${extra}/>`;
  const visible = svgArtworkBounds(`<svg viewBox="0 0 100 100">${shape(10)}<g visibility="hidden">${shape(50)}${shape(80, ' visibility="visible"')}</g></svg>`);
  assert.deepEqual(visible.box, { x: 10, y: 10, width: 80, height: 80 });
  const hidden = svgArtworkBounds(`<svg viewBox="0 0 100 100">${shape(10)}<g display="none">${shape(80, ' visibility="visible"')}</g></svg>`);
  assert.deepEqual(hidden.box, { x: 10, y: 10, width: 10, height: 10 });
  const revealed = svgArtworkBounds(`<svg viewBox="0 0 100 100"><style>.on{display:inline}</style>${shape(10)}${shape(80, ' class="on" display="none"')}</svg>`);
  assert.deepEqual(revealed.box, { x: 10, y: 10, width: 80, height: 80 });
});

test('CSS geometry, animation, unconverted lengths, unsized images, scripts, external sheets and markup entities are refused', () => {
  const unit = '<rect width="10" height="10"/>';
  for (const [svg, why] of [
    [`<svg viewBox="0 0 100 100"><style>rect{width:90px}</style>${unit}</svg>`, /positions or sizes set in CSS/],
    ['<svg viewBox="0 0 100 100"><circle r="5" style="cx: 90px"/></svg>', /positions or sizes set in CSS/],
    ['<svg viewBox="0 0 100 100"><rect width="10" height="10"><animate attributeName="x" to="90" dur="1s"/></rect></svg>', /animation/],
    [`<svg viewBox="0 0 100 100"><style>@keyframes m{to{opacity:0}} rect{animation:m 1s}</style>${unit}</svg>`, /animation/],
    ['<svg viewBox="0 0 1000 1000"><rect width="50%" height="10"/></svg>', /a shape position or size that is not a plain number/],
    ['<svg viewBox="0 0 100 100"><circle cx="1em" cy="5" r="5"/></svg>', /not a plain number/],
    ['<svg viewBox="0 0 100 100"><image href="a.png" x="10" y="10"/></svg>', /an image with no width or height/],
    [`<svg viewBox="0 0 100 100">${unit}<script>document.querySelector("rect").setAttribute("x", 90)</script></svg>`, /a script/],
    [`<?xml-stylesheet href="art.css"?><svg viewBox="0 0 100 100">${unit}</svg>`, /an external stylesheet/],
    [`<svg viewBox="0 0 100 100"><style>@import url(art.css);</style>${unit}</svg>`, /an external stylesheet/],
    [`<!DOCTYPE svg [<!ENTITY far "<rect x='90' width='10' height='10'/>">]><svg viewBox="0 0 100 100">${unit}&far;</svg>`, /entity declarations that add markup/],
  ] as const) {
    assert.match(refusalOf(svg), why);
  }
});

test('an Illustrator-style file with a namespace entity, a root style and a class stylesheet is still fitted', () => {
  const svg = '<?xml version="1.0" encoding="utf-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" [<!ENTITY ns_svg "http://www.w3.org/2000/svg">]>'
    + '<svg version="1.1" xmlns="&ns_svg;" x="0px" y="0px" viewBox="0 0 500 500" style="enable-background:new 0 0 500 500;" xml:space="preserve">'
    + '<style type="text/css">.st0{fill:#FFFFFF;}.st1{fill:none;stroke:#000000;stroke-width:2;stroke-miterlimit:10;}</style>'
    + '<rect x="100" y="100" class="st0" width="100px" height="50"/><polyline class="st1" points="250,250 300,300 350,250"/></svg>';
  const fit = fitSvgToArtwork(svg);
  assert.ok(fit.ok, !fit.ok ? fit.reason : '');
  // The sheet strokes every shape at width 2 with miter limit 10, so each reaches 10 further.
  assert.deepEqual(fit.box, { x: 90, y: 90, width: 270, height: 220 });
});
