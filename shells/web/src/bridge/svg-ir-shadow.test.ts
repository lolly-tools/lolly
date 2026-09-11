// SPDX-License-Identifier: MPL-2.0
/**
 * SVG drop-shadow filters → vector shadows, for the formats that have no filters
 * (EMF, EPS, DXF, and the Penpot plugin's PDF, all of which consume svg-ir).
 *
 * `<filter>` is in svg-ir's SKIP set and the `filter` attribute was simply ignored, so
 * every shadow disappeared from those exports. That matters most OUTSIDE this repo:
 * the Penpot export plugin's entire input is Penpot's own SVG, and Penpot writes
 * shadows exactly this way - so a shadowed Penpot board exported to EPS came out with
 * flat, floating shapes.
 *
 * ## The two things worth pinning
 *
 * **The ramp is strokes, not offset copies.** A stroke of width 2t covers exactly the
 * t-wide margin either side of the outline, which gives the outset for free and works
 * on an arbitrary path. Offsetting a general path needs boolean geometry we do not
 * have, so a design that only handled rectangles would have covered Penpot's boards
 * and nothing else.
 *
 * **What is declined.** A filter that is not a drop shadow must produce NOTHING rather
 * than a plausible-looking shadow - a blur-only filter, a colour matrix, a turbulence.
 * Emitting a shadow for those would be a confident wrong answer in a file the user
 * takes to a printer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSvgDropShadow } from './svg-ir.ts';

/** Build a <filter> from markup, DOM-free-ish (uses linkedom-style parsing via jsdom
 *  when available, else DOMParser). node:test runs this under Node, so jsdom it is. */
async function filterEl(inner: string): Promise<Element> {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(`<!doctype html><body><svg xmlns="http://www.w3.org/2000/svg"><defs><filter id="f">${inner}</filter></defs></svg>`);
  const el = dom.window.document.getElementById('f');
  assert.ok(el, 'fixture did not parse');
  return el as unknown as Element;
}

test('feDropShadow shorthand', async () => {
  const s = parseSvgDropShadow(await filterEl(
    `<feDropShadow dx="4" dy="6" stdDeviation="3" flood-color="rgb(10,20,30)" flood-opacity="0.4"/>`));
  assert.ok(s);
  assert.deepEqual([s.dx, s.dy, s.stdDeviation], [4, 6, 3]);
  assert.deepEqual(s.rgb, [10, 20, 30]);
  assert.equal(s.alpha, 0.4);
});

test('feDropShadow with a two-value stdDeviation takes the larger', async () => {
  // The ramp is isotropic; picking the smaller would under-blur.
  const s = parseSvgDropShadow(await filterEl(`<feDropShadow dx="0" dy="0" stdDeviation="2 7" flood-color="#000"/>`));
  assert.equal(s?.stdDeviation, 7);
});

test('the classic chain most tools emit, Penpot included', async () => {
  const s = parseSvgDropShadow(await filterEl(`
    <feFlood flood-opacity="0.25" flood-color="rgb(0,0,0)" result="flood"/>
    <feComposite in="flood" in2="SourceAlpha" operator="in" result="tinted"/>
    <feOffset dx="2" dy="4" in="tinted" result="offset"/>
    <feGaussianBlur stdDeviation="5" in="offset" result="blur"/>
    <feBlend in="SourceGraphic" in2="blur" mode="normal"/>`));
  assert.ok(s, 'the chain form must be recognised - it is what Penpot writes');
  assert.deepEqual([s.dx, s.dy, s.stdDeviation], [2, 4, 5]);
  assert.deepEqual(s.rgb, [0, 0, 0]);
  assert.equal(s.alpha, 0.25);
});

test('a chain with no feFlood is treated as a black shadow', async () => {
  const s = parseSvgDropShadow(await filterEl(
    `<feGaussianBlur in="SourceAlpha" stdDeviation="4"/><feOffset dx="1" dy="1"/>`));
  assert.ok(s);
  assert.deepEqual(s.rgb, [0, 0, 0]);
  assert.equal(s.alpha, 1);
});

test('a chain that RECOLOURS without saying the colour is declined', async () => {
  // An feColorMatrix with no feFlood is tinting the shadow to something we cannot
  // read. A wrong-coloured shadow in a print file is worse than no shadow.
  const s = parseSvgDropShadow(await filterEl(
    `<feGaussianBlur in="SourceAlpha" stdDeviation="4"/><feOffset dx="1" dy="1"/>
     <feColorMatrix values="0 0 0 0 0.9  0 0 0 0 0.2  0 0 0 0 0.1  0 0 0 0.5 0"/>`));
  assert.equal(s, null);
});

test('filters that are not drop shadows produce nothing', async () => {
  // Each of these would otherwise be read as "blur 4, no offset, black" and drawn as
  // a shadow that the source never had.
  assert.equal(parseSvgDropShadow(await filterEl(`<feTurbulence baseFrequency="0.05"/><feGaussianBlur stdDeviation="4"/>`)), null);
  assert.equal(parseSvgDropShadow(await filterEl(`<feGaussianBlur stdDeviation="4"/><feMorphology radius="2"/>`)), null);
  assert.equal(parseSvgDropShadow(await filterEl(`<feImage href="x.png"/>`)), null);
  assert.equal(parseSvgDropShadow(await filterEl(`<feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer>`)), null);
  assert.equal(parseSvgDropShadow(await filterEl(``)), null);
});

test('a blur with neither offset nor spread is not a shadow', async () => {
  // `filter: blur()` on a shape is a blur of the shape itself, not a shadow behind it.
  assert.equal(parseSvgDropShadow(await filterEl(`<feGaussianBlur stdDeviation="0"/>`)), null);
});

test('malformed numbers fall back rather than producing NaN', async () => {
  const s = parseSvgDropShadow(await filterEl(
    `<feDropShadow dx="abc" dy="" stdDeviation="junk" flood-color="#000" flood-opacity="nope"/>`));
  assert.ok(s);
  for (const v of [s.dx, s.dy, s.stdDeviation, s.alpha]) assert.ok(Number.isFinite(v), `${v} is not finite`);
});
