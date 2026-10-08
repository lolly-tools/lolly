// SPDX-License-Identifier: MPL-2.0
/** Drawing operations written as PDF (plan 295, P3d): a well-formed, byte-stable file, and what it refuses. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { compileDesignDraw, describeDesignDrawPictures, layoutDesignDrawText, outlineDesignDrawText } from '../engine/src/design-draw.ts';
import { designDrawPdf, designDrawPdfFindings } from '../engine/src/design-draw-pdf.ts';
import type { TextShaperV1 } from '../engine/src/design-text-measure.ts';
import { deflateSync } from 'node:zlib';
import { crc32, encodePng } from './helpers/studio3d-glb.ts';

const shaper: TextShaperV1 = async (run) => {
  const advances = [...run.text].map((ch) => (ch === ' ' ? run.size / 4 : run.size / 2) + run.tracking);
  return { advances, total: advances.reduce((a, b) => a + b, 0), font: { file: `/fonts/${run.family}.ttf`, variations: { wght: run.weight }, metrics: { upem: 1000, ascent: 980, descent: 280 } } };
};
const RGBA = encodePng(4, 2, (x) => [x * 60, 0, 0, x === 0 ? 0 : 255]);
/** A 4 x 2 PNG of colour type 2, no alpha, so the writer embeds the compressed rows as they are. */
const RGB = (() => {
  const chunk = (type: string, data: Uint8Array) => {
    const body = new Uint8Array(4 + data.length);
    body.set([...type].map((c) => c.charCodeAt(0)));
    body.set(data, 4);
    const out = new Uint8Array(8 + data.length + 4);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    out.set(body, 4);
    dv.setUint32(8 + data.length, crc32(body));
    return out;
  };
  const ihdr = new Uint8Array(13);
  new DataView(ihdr.buffer).setUint32(0, 4);
  new DataView(ihdr.buffer).setUint32(4, 2);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const rows = new Uint8Array(2 * (1 + 4 * 3));
  for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) rows[y * 13 + 1 + x * 3] = x * 60;
  const parts = [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', new Uint8Array(0))];
  return Uint8Array.from(parts.flatMap((p) => [...p]));
})();
/** A JPEG header with a baseline frame of 32 x 16, three components: enough for the writer, which embeds JPEG as delivered. */
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

async function page() {
  const rows = [
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 400, h: 300, bg: '#ffffff' },
    { id: 'fade', kind: 'box', x: 10, y: 10, w: 100, h: 60, grad: 'lin.srgb_90_ff0000-0_ff000000-100' },
    { id: 'group', kind: 'box', x: 120, y: 10, w: 100, h: 60, bg: '#00ff00', opacity: 50, blend: 'multiply', stroke: '#000000', strokeW: 4 },
    { id: 'alpha', kind: 'image', x: 10, y: 100, w: 80, h: 40, image: 'pics/rgba', fit: 'fill' },
    { id: 'opaque', kind: 'image', x: 100, y: 100, w: 80, h: 40, image: 'pics/rgb', fit: 'fill' },
    { id: 'photo', kind: 'image', x: 200, y: 100, w: 64, h: 32, image: 'pics/jpeg', fit: 'fill' },
    { id: 'words', kind: 'text', x: 10, y: 200, w: 300, h: 60, text: 'Hi', fontSize: 20 },
  ];
  const draw = compileDesignDraw(rows as never, { width: 400, height: 300 }, { effects: true, colors: 'resolved' });
  await layoutDesignDrawText(draw, shaper);
  await outlineDesignDrawText(draw, async ({ text }) => ({ d: `M0 0L${text.length * 5} 0L0 -10Z` }));
  const pictures = new Map([['pics/rgba', { bytes: RGBA, mime: 'image/png' }], ['pics/rgb', { bytes: RGB, mime: 'image/png' }], ['pics/jpeg', { bytes: JPEG, mime: 'image/jpeg' }]]);
  const sizes: Record<string, { width: number; height: number }> = { 'pics/rgba': { width: 4, height: 2 }, 'pics/rgb': { width: 4, height: 2 }, 'pics/jpeg': { width: 32, height: 16 } };
  await describeDesignDrawPictures(draw, async (ref) => sizes[ref] ?? null);
  return { draw, pictures };
}

test('a page writes as a PDF that loads, with the same bytes every time', async () => {
  const { draw, pictures } = await page();
  assert.deepEqual(designDrawPdfFindings(draw, pictures), []);
  const pdf = designDrawPdf([{ page: draw, pictures, size: { w: 300, h: 225 } }], { title: 'Cover', creator: 'Lolly' });
  assert.deepEqual(designDrawPdf([{ page: draw, pictures, size: { w: 300, h: 225 } }], { title: 'Cover', creator: 'Lolly' }), pdf, 'deterministic');
  assert.match(latin1(pdf.subarray(0, 8)), /^%PDF-1\.7/);
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  assert.equal(doc.getPageCount(), 1);
  assert.deepEqual(doc.getPage(0).getMediaBox(), { x: 0, y: 0, width: 300, height: 225 });
  assert.equal(doc.getTitle(), 'Cover');
});

test('each feature takes its PDF form', async () => {
  const { draw, pictures } = await page();
  const text = latin1(designDrawPdf([{ page: draw, pictures, size: { w: 300, h: 225 } }]));
  assert.ok(text.includes('/ShadingType 2') && text.includes('/S /Luminosity'), 'a gradient with a translucent stop is a shading under a luminosity soft mask');
  assert.ok(text.includes('/Group << /Type /Group /S /Transparency >>') && text.includes('/BM /Multiply') && text.includes('/ca 0.5'), 'opacity and blend paint the box as one transparency group');
  assert.ok(text.includes('/SMask'), 'a PNG with alpha writes its alpha as a soft mask');
  assert.ok(text.includes('/Predictor 15 /Colors 3'), 'an opaque PNG keeps its own rows, read with the PNG predictor');
  assert.ok(text.includes('/DCTDecode') && text.includes('/Width 32 /Height 16'), 'a JPEG is embedded as delivered');
});

test('what PDF cannot carry without rasterising is a finding', async () => {
  const rows = [
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 400, h: 300 },
    { id: 'shadowed', kind: 'box', x: 10, y: 10, w: 50, h: 50, bg: '#000000', shadow: 'box' },
    { id: 'blurred', kind: 'box', x: 70, y: 10, w: 50, h: 50, bg: '#000000', blur: 3 },
    { id: 'gif', kind: 'image', x: 10, y: 100, w: 50, h: 50, image: 'pics/gif' },
    { id: 'live', kind: 'text', x: 10, y: 200, w: 200, h: 50, text: 'Live' },
  ];
  const draw = compileDesignDraw(rows as never, { width: 400, height: 300 }, { effects: true, colors: 'resolved' });
  await layoutDesignDrawText(draw, shaper);
  await describeDesignDrawPictures(draw, async () => ({ width: 10, height: 10 }));
  const pictures = new Map([['pics/gif', { bytes: Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), mime: 'image/gif' }]]);
  assert.deepEqual(designDrawPdfFindings(draw, pictures).map((f) => `${f.feature} (${f.id})`),
    ['pdf-shadow (shadowed)', 'pdf-blur (blurred)', 'pdf-image-format (gif)', 'pdf-live-text (live)']);
});
