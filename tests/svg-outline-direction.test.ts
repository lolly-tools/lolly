// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI's browser-free SVG route (shells/cli/src/svg-outline.ts) and the vector walk
 * every shell shares (packages/node-shell/src/svg-ir.ts), with right-to-left text. Real
 * HarfBuzz and the text composition fixture faces under jsdom, so no browser is needed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createNodeTextAPI } from '../packages/node-shell/src/text.ts';
import { svgDomToIr } from '../packages/node-shell/src/svg-ir.ts';
import { outlineSvgText } from '../shells/cli/src/svg-outline.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const ARABIC = 'tests/fixtures/text-composition/fonts/notosansarabic/NotoSansArabic[wdth,wght].ttf';
const OUTFIT = 'shells/web/public/fonts/Outfit[wght].ttf';
const text = createNodeTextAPI({ repoRoot: REPO });
// The walk asks the host which file a family is. Here a family name is the path.
const host = { text: { ...text, fontUrl: async (family: string) => ({ url: family === 'Arabic' ? ARABIC : OUTFIT }) } } as unknown as HostV1;

function svgOf(markup: string, around = ''): Element {
  const dom = new JSDOM(`<!doctype html><body><div ${around}><svg xmlns="http://www.w3.org/2000/svg" width="400" height="100">${markup}</svg></div></body>`);
  return dom.window.document.querySelector('svg')!;
}
const translateX = (el: Element): number => Number(/translate\(([-\d.]+)/.exec(el.getAttribute('transform') ?? '')![1]);

test('a run the font has no glyphs for stays text, not a row of boxes', async () => {
  const svg = svgOf('<text x="10" y="40" font-family="Outfit" font-size="20">مرحبا بالعالم.</text>');
  const res = await outlineSvgText(svg, host);
  assert.equal(res.outlined, 0);
  assert.equal(svg.querySelectorAll('path').length, 0);
  assert.match(res.fallbacks[0]!.reason, /no glyph for/);
  assert.equal(svg.querySelector('text')!.textContent, 'مرحبا بالعالم.');
});

test('a kept run takes the direction set around the <svg>, because that does not travel', async () => {
  const svg = svgOf('<text x="390" y="40" font-family="Outfit" font-size="20">مرحبا.</text>', 'dir="rtl"');
  await outlineSvgText(svg, host);
  assert.equal(svg.querySelector('text')!.getAttribute('direction'), 'rtl');
});

test('dir="auto" around the <svg> reads the run', async () => {
  const svg = svgOf('<text x="390" y="40" font-family="Outfit" font-size="20">مرحبا.</text>', 'dir="auto"');
  await outlineSvgText(svg, host);
  assert.equal(svg.querySelector('text')!.getAttribute('direction'), 'rtl');
});

test('text-anchor reads against the direction when a run outlines', async () => {
  const svg = svgOf(
    '<text x="390" y="30" direction="rtl" font-family="Arabic" font-size="20">مرحبا</text>'
    + '<text x="10" y="60" direction="rtl" text-anchor="end" font-family="Arabic" font-size="20">مرحبا</text>'
    + '<text x="200" y="90" direction="rtl" text-anchor="middle" font-family="Arabic" font-size="20">مرحبا</text>');
  const res = await outlineSvgText(svg, host);
  assert.equal(res.outlined, 3);
  const { advanceWidth } = await text.toPath({ text: 'مرحبا', fontUrl: ARABIC, fontSize: 20 });
  const paths = [...svg.querySelectorAll('path')];
  assert.ok(Math.abs(translateX(paths[0]!) - (390 - advanceWidth)) < 0.1, 'start is the right edge');
  assert.ok(Math.abs(translateX(paths[1]!) - 10) < 0.1, 'end is the left edge');
  assert.ok(Math.abs(translateX(paths[2]!) - (200 - advanceWidth / 2)) < 0.1, 'middle is the middle');
  for (const p of paths) assert.equal(p.hasAttribute('direction'), false, 'the outline carries no text layout');
});

test('live text mode still keeps left-to-right text live', async () => {
  const svg = svgOf('<text x="10" y="40" font-family="Outfit" font-size="20">Plain</text>');
  const ir = await svgDomToIr(svg, { host, textMode: 'live', resolveFont: async () => ({ url: OUTFIT }), label: 'EMF' } as never);
  assert.deepEqual(ir.prims.map((p) => p.type), ['text']);
});

test('left-to-right runs outline exactly as before: no direction, the same anchors', async () => {
  const svg = svgOf('<text x="10" y="30" font-family="Outfit" font-size="20">Plain</text><text x="390" y="60" text-anchor="end" font-family="Outfit" font-size="20">Plain</text>');
  const res = await outlineSvgText(svg, host);
  assert.equal(res.outlined, 2);
  const { advanceWidth, d } = await text.toPath({ text: 'Plain', fontUrl: OUTFIT, fontSize: 20 });
  const paths = [...svg.querySelectorAll('path')];
  assert.equal(paths[0]!.getAttribute('d'), d);
  assert.equal(translateX(paths[0]!), 10);
  assert.ok(Math.abs(translateX(paths[1]!) - (390 - advanceWidth)) < 0.01);
});

test('the vector walk reads a right-to-left <text> from the right edge it names', async () => {
  const svg = svgOf('<text x="390" y="40" direction="rtl" font-family="Arabic" font-size="20">مرحبا</text>');
  const ir = await svgDomToIr(svg, { host, resolveFont: async () => ({ url: ARABIC }), label: 'EPS' } as never);
  const path = ir.prims.find((p) => p.type === 'path');
  assert.ok(path && path.type === 'path', 'the run outlined');
  const xs = path.subpaths.flatMap((sub) => sub.segments.flatMap((seg) => ('x' in seg ? [seg.x] : [])));
  const right = Math.max(...xs);
  assert.ok(right <= 390.5 && right > 370, `ink ends at the right edge, 390, got ${right}`);
});

test('live text mode outlines a right-to-left run a face covers, because GDI text has no bidi order', async () => {
  const svg = svgOf('<text x="390" y="40" direction="rtl" font-family="Arabic" font-size="20">مرحبا.</text>');
  const ir = await svgDomToIr(svg, { host, textMode: 'live', resolveFont: async () => ({ url: ARABIC }), label: 'EMF' } as never);
  assert.deepEqual(ir.prims.map((p) => p.type), ['path']);
});

test('live text mode keeps a run no face covers live, on its right edge', async () => {
  const svg = svgOf('<text x="390" y="40" direction="rtl" font-family="Outfit" font-size="20">مرحبا</text>');
  const ir = await svgDomToIr(svg, { host, textMode: 'live', resolveFont: async () => ({ url: OUTFIT }), label: 'EMF' } as never);
  const prim = ir.prims.find((p) => p.type === 'text');
  assert.ok(prim && prim.type === 'text');
  assert.equal(prim.align, 'right');
  assert.equal(prim.x, 390);
});
