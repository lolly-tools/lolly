// SPDX-License-Identifier: MPL-2.0
/**
 * A run no font can draw, in the vector walk every shell shares (packages/node-shell/src/svg-ir.ts).
 * Shaping it outlines `.notdef` boxes, so EPS and WMF draw it as a picture painted through
 * its own shape (a stencil prim), and DXF, which goes to cutting machines and CAD, stops
 * with a message that quotes the run. Real HarfBuzz and real faces under jsdom.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createNodeTextAPI } from '../packages/node-shell/src/text.ts';
import { svgDomToIr, type TextPictureRequest } from '../packages/node-shell/src/svg-ir.ts';
import { needsBrowserTier } from '../packages/node-shell/src/browser-tier.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const OUTFIT = 'shells/web/public/fonts/Outfit[wght].ttf';
const host = { text: createNodeTextAPI({ repoRoot: REPO }) } as unknown as HostV1;
const resolveFont = async () => ({ url: OUTFIT });

function svgOf(markup: string): Element {
  const dom = new JSDOM(`<!doctype html><body><svg xmlns="http://www.w3.org/2000/svg" width="400" height="100">${markup}</svg></body>`);
  return dom.window.document.querySelector('svg')!;
}

// Syriac and Tamil have no fallback font, and Outfit has neither.
const SYRIAC = 'ܫܠܡܐ ܥܠܡܐ';
const TAMIL = 'வணக்கம்';

/** A picture 20 x 10 px whose left half is the words, 4 picture px to a user unit. */
const fakePicture = async (run: TextPictureRequest) => {
  const pxW = 20, pxH = 10;
  const alpha = new Uint8Array(pxW * pxH);
  for (let y = 0; y < pxH; y++) for (let x = 0; x < 10; x++) alpha[y * pxW + x] = 255;
  return { alpha, pxW, pxH, left: -1, top: -run.fontSize, width: 5, height: 2.5, advance: 3 };
};

test('without a setting, a run no font covers outlines as before', async () => {
  const ir = await svgDomToIr(svgOf(`<text x="10" y="40" font-family="Outfit" font-size="20">${TAMIL}</text>`), { host, resolveFont, label: 'EPS' });
  assert.deepEqual(ir.prims.map((p) => p.type), ['path']);
});

test('DXF stops at a run no font covers, naming the run and its script', async () => {
  await assert.rejects(
    svgDomToIr(svgOf(`<text x="10" y="40" font-family="Outfit" font-size="20">${SYRIAC}</text>`), { host, resolveFont, label: 'DXF', uncoveredText: 'refuse' }),
    (err: Error) => {
      assert.match(err.message, new RegExp(`^DXF export stopped at the text "${SYRIAC}": no font here has its letters \\(Syriac\\)\\.`));
      assert.match(err.message, /cutting machines and CAD/);
      assert.equal(needsBrowserTier(err), false, 'a browser cannot do better for DXF');
      return true;
    },
  );
});

test('DXF keeps every run a font covers', async () => {
  const ir = await svgDomToIr(svgOf('<text x="10" y="40" font-family="Outfit" font-size="20">Plain words</text>'), { host, resolveFont, label: 'DXF', uncoveredText: 'refuse' });
  assert.deepEqual(ir.prims.map((p) => p.type), ['path']);
});

test('EPS and WMF draw a run no font covers as a stencil in its ink, placed by its anchor', async () => {
  const seen: string[] = [];
  for (const label of ['EPS', 'WMF']) {
    const svg = svgOf(`<text x="100" y="40" text-anchor="end" fill="#123456" font-family="Outfit" font-size="20">${TAMIL}</text><text x="10" y="80" font-family="Outfit" font-size="20">Plain</text>`);
    const ir = await svgDomToIr(svg, { host, resolveFont, label, uncoveredText: 'picture', pictureText: fakePicture, onPicturedText: (t) => seen.push(t) });
    assert.deepEqual(ir.prims.map((p) => p.type), ['stencil', 'path'], label);
    const prim = ir.prims[0]!;
    assert.ok(prim.type === 'stencil');
    // The advance (3) ends at x = 100; the picture starts 1 before that start, 20 above the baseline.
    assert.deepEqual([prim.x, prim.y, prim.w, prim.h], [96, 20, 5, 2.5]);
    assert.deepEqual(prim.fill, { r: 0x12, g: 0x34, b: 0x56 });
    assert.deepEqual([prim.pxW, prim.pxH], [20, 10]);
    // Covered pixels become set bits: the left ten of each twenty-pixel row.
    assert.deepEqual([...prim.bits.slice(0, 3)], [0xff, 0xc0, 0x00]);
  }
  assert.deepEqual(seen, [TAMIL, TAMIL]);
});

test('the picture request carries the run, its direction and a 300 dpi scale', async () => {
  let req: TextPictureRequest | null = null;
  await svgDomToIr(svgOf(`<g transform="scale(2)"><text x="10" y="40" direction="rtl" font-family="Outfit" font-weight="700" font-size="20">${SYRIAC}</text></g>`), {
    host, resolveFont, label: 'EPS', uncoveredText: 'picture', pictureText: async (r) => { req = r; return fakePicture(r); },
  });
  assert.ok(req);
  const r = req as TextPictureRequest;
  assert.equal(r.text, SYRIAC);
  assert.equal(r.direction, 'rtl');
  assert.equal(r.fontWeight, '700');
  assert.equal(r.fontSize, 20);
  assert.ok(Math.abs(r.scale - (300 / 96) * 2) < 1e-9);
});

test('with no text renderer, EPS and WMF ask for the browser tier instead of writing boxes', async () => {
  await assert.rejects(
    svgDomToIr(svgOf(`<text x="10" y="40" font-family="Outfit" font-size="20">${TAMIL}</text>`), { host, resolveFont, label: 'WMF', uncoveredText: 'picture' }),
    (err: Error) => { assert.equal(needsBrowserTier(err), true); assert.match(err.message, /^WMF export stopped at the text/); return true; },
  );
});

test('turned text cannot become an upright picture, so the export says so', async () => {
  await assert.rejects(
    svgDomToIr(svgOf(`<text x="10" y="40" transform="rotate(30)" font-family="Outfit" font-size="20">${TAMIL}</text>`), { host, resolveFont, label: 'EPS', uncoveredText: 'picture', pictureText: fakePicture }),
    /cannot be turned or slanted in EPS/,
  );
});
