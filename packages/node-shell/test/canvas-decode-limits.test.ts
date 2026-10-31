// SPDX-License-Identifier: MPL-2.0
/**
 * Decode limits (canvas.ts `DecodeLimits`), which the hosted MCP server sets per
 * render so a picture someone sends cannot make it allocate gigabytes.
 *
 * Run directly:  node --test packages/node-shell/test/canvas-decode-limits.test.ts
 *
 * A decode's memory follows the size a picture states, not its byte count: a
 * 150-byte SVG that declares 20000 x 20000 is a 1.6 GB canvas, and a PNG header can
 * declare the same over a few hundred bytes of zeros. Every limit is checked against
 * the stated size before a canvas exists, and the refusal says which limit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { JSDOM } from 'jsdom';
import {
  createNodeRasterAPI, decodeRefusalWarnings, decodeToCanvas, hostedDecodeLimits, installNodeCanvas, isCanvasAvailable, nodeCanvas,
  pictureName, ImagePixelLimitError, HOSTED_DECODE_MAX_PIXELS, HOSTED_DECODE_BUDGET_PIXELS,
} from '../src/canvas.ts';
import type { DecodeLimits } from '../src/canvas.ts';

const SKIP = !isCanvasAvailable() && '@napi-rs/canvas is not installed here';

const svg = (w: number, h: number): Uint8Array => new TextEncoder().encode(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#222"/></svg>`,
);

/** A PNG whose header claims `w` x `h` over a tiny body: the decompression-bomb shape. */
function claimedPng(w: number, h: number): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer): number => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.alloc(64))), chunk('IEND', Buffer.alloc(0)),
  ]));
}

async function realPng(w: number, h: number): Promise<Uint8Array> {
  const mod = (await nodeCanvas())!;
  const c = mod.createCanvas(w, h);
  c.getContext('2d').fillRect(0, 0, w, h);
  const buf = c.toBuffer('image/png');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

test('the hosted limits are one 4096 x 4096 picture and four of them per render', () => {
  assert.equal(HOSTED_DECODE_MAX_PIXELS, 4096 * 4096);
  assert.equal(HOSTED_DECODE_BUDGET_PIXELS, 4 * 4096 * 4096);
  const a = hostedDecodeLimits(), b = hostedDecodeLimits();
  assert.notEqual(a, b, 'a fresh set for each render');
  assert.deepEqual(a, { maxPixels: HOSTED_DECODE_MAX_PIXELS, budgetPixels: HOSTED_DECODE_BUDGET_PIXELS, used: 0, refusals: [], refused: [] });
});

test('an SVG declaring 20000 x 20000 is refused before its canvas is made', { skip: SKIP }, async () => {
  const limits = hostedDecodeLimits();
  const before = process.memoryUsage().rss;
  await assert.rejects(decodeToCanvas(svg(20000, 20000), 'image/svg+xml', limits), (err: unknown) =>
    err instanceof ImagePixelLimitError && /A 20000 x 20000 picture was not decoded: this server decodes pictures of up to 16,777,216 pixels\./.test(err.message));
  assert.ok(process.memoryUsage().rss - before < 400e6, 'no 1.6 GB canvas');
  assert.equal(limits.refusals!.length, 1, 'the refusal is recorded for the caller');
  assert.equal(limits.used, 0, 'nothing counted against the budget');
});

test('a PNG header claiming 30000 x 30000 is refused before it is decoded', { skip: SKIP }, async () => {
  await assert.rejects(decodeToCanvas(claimedPng(30000, 30000), undefined, hostedDecodeLimits()), ImagePixelLimitError);
});

test('pictures under the cap decode and count against the render budget', { skip: SKIP }, async () => {
  const limits: DecodeLimits = { maxPixels: 100 * 100, budgetPixels: 150 * 100, used: 0, refusals: [] };
  const png = await realPng(100, 100);
  const first = await decodeToCanvas(png, undefined, limits);
  assert.equal(first?.width, 100);
  assert.equal(limits.used, 100 * 100);
  await assert.rejects(decodeToCanvas(png, undefined, limits), /this render has used 10,000 of the 15,000 pixels it may decode/);
  await assert.rejects(decodeToCanvas(svg(101, 100), 'image/svg+xml', limits), /A 101 x 100 picture was not decoded/);
  assert.equal(limits.refusals!.length, 2);
});

test('no limits is the default: the CLI and the TUI decode the person\'s own files', { skip: SKIP }, async () => {
  const canvas = await decodeToCanvas(await realPng(300, 200));
  assert.deepEqual([canvas?.width, canvas?.height], [300, 200]);
});

test('host.raster.decode and measure honour the limits with a clear refusal', { skip: SKIP }, async () => {
  const api = createNodeRasterAPI({ limits: { maxPixels: 64 * 64 } })!;
  await assert.rejects(api.decode(svg(65, 64)), /A 65 x 64 picture was not decoded: this server decodes pictures of up to 4,096 pixels\./);
  await assert.rejects(api.measure(svg(65, 64)), ImagePixelLimitError);
  const ok = await api.decode(await realPng(64, 64));
  assert.equal(ok.width, 64);
});

test('the realm\'s Image, createImageBitmap and <canvas> follow the limits installNodeCanvas was given', { skip: SKIP }, async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const target: { URL: typeof URL; createImageBitmap?: unknown; Image?: unknown } = { URL };
  const limits: DecodeLimits = { maxPixels: 200 * 200, used: 0, refusals: [] };
  assert.equal(await installNodeCanvas(dom.window as never, target as never, { limits }), true);
  const bitmap = target.createImageBitmap as (src: unknown) => Promise<{ width: number }>;
  await assert.rejects(bitmap(new Blob([svg(1000, 1000) as BlobPart])), ImagePixelLimitError);
  assert.equal((await bitmap(new Blob([await realPng(50, 50) as BlobPart]))).width, 50);

  const Img = target.Image as new () => { src: string; onload: (() => void) | null; onerror: ((e: unknown) => void) | null };
  const failed = await new Promise<unknown>((resolve) => {
    const img = new Img();
    img.onload = () => resolve(null);
    img.onerror = (e) => resolve(e);
    img.src = 'data:image/svg+xml;base64,' + Buffer.from(svg(1000, 1000)).toString('base64');
  });
  assert.ok(failed instanceof ImagePixelLimitError, 'Image fires onerror with the refusal');

  const big = dom.window.document.createElement('canvas');
  big.width = 1000; big.height = 1000;
  assert.equal(big.getContext('2d'), null, 'a canvas over the cap answers getContext with null, as a browser does');
  const small = dom.window.document.createElement('canvas');
  small.width = 100; small.height = 100;
  assert.ok(small.getContext('2d'));

  // Installing again replaces the limits: a later render reads its own.
  await installNodeCanvas(dom.window as never, target as never, {});
  await bitmap(new Blob([svg(1000, 1000) as BlobPart]));
});

test('raster bytes labelled image/svg+xml meet the header check, never an eager decode', { skip: SKIP }, async () => {
  // Skia decodes a raster as soon as it loads one, so the label must not route
  // raster bytes past the header check: the bytes decide what they are.
  const mod = (await nodeCanvas()) as unknown as { loadImage: (...a: unknown[]) => Promise<unknown> };
  const original = mod.loadImage;
  let loads = 0;
  mod.loadImage = (...a: unknown[]) => { loads++; return original.apply(mod, a); };
  try {
    const limits = hostedDecodeLimits();
    await assert.rejects(decodeToCanvas(claimedPng(6000, 6000), 'image/svg+xml', limits), (err: unknown) =>
      err instanceof ImagePixelLimitError && /A 6000 x 6000 picture was not decoded/.test(err.message));
    assert.equal(loads, 0, 'refused from its header, before Skia loaded anything');
    assert.equal(limits.refused?.[0]?.limit, 'picture');
    // An SVG is still an SVG whatever it is labelled.
    await assert.rejects(decodeToCanvas(svg(20000, 20000), 'image/png', hostedDecodeLimits()), /A 20000 x 20000 picture was not decoded/);
  } finally {
    mod.loadImage = original;
  }
});

test('the warnings give how many pictures were left out, and which by name', { skip: SKIP }, async () => {
  const files = new Map<string, Uint8Array>([
    ['https://example.com/logos/acme.svg?sig=secret', svg(300, 150)],
    ['https://example.com/logos/globex.svg', svg(400, 120)],
    ['/catalog/assets/initech.svg', svg(100, 100)],
  ]);
  const limits: DecodeLimits = { maxPixels: 200 * 200, budgetPixels: 300 * 210, used: 0, refusals: [], refused: [] };
  const api = createNodeRasterAPI({ limits, readUrl: async (url) => files.get(url) ?? svg(10, 10) })!;
  // Two over the per-picture cap, each asked for twice (a hook that retries).
  for (const url of ['https://example.com/logos/acme.svg?sig=secret', 'https://example.com/logos/globex.svg']) {
    await assert.rejects(api.decode(url), ImagePixelLimitError);
    await assert.rejects(api.decode(url), ImagePixelLimitError);
  }
  // Four pictures fill the budget, then three more are left out: one named, two inline.
  for (let i = 0; i < 4; i++) await api.decode(svg(150, 100 + i));
  await assert.rejects(api.decode('/catalog/assets/initech.svg'), ImagePixelLimitError);
  await assert.rejects(api.decode(svg(120, 120)), ImagePixelLimitError);
  await assert.rejects(api.decode(new Blob([svg(130, 130) as BlobPart])), ImagePixelLimitError);

  assert.equal(limits.refusals!.length, 7, 'every refusal is still recorded as it was thrown');
  assert.deepEqual(decodeRefusalWarnings(limits), [
    '2 pictures were not decoded: this server decodes pictures of up to 40,000 pixels, and these are larger (acme.svg at 300 x 150 and globex.svg at 400 x 120).',
    '3 pictures were not decoded: each would have taken this render past the 63,000 pixels it may decode (initech.svg and 2 more).',
  ]);

  const one: DecodeLimits = { maxPixels: 100, refused: [] };
  await assert.rejects(decodeToCanvas(svg(20, 20), undefined, one));
  assert.deepEqual(decodeRefusalWarnings(one), ['A 20 x 20 picture was not decoded: this server decodes pictures of up to 100 pixels.']);
  assert.deepEqual(decodeRefusalWarnings(undefined), []);
  assert.deepEqual(decodeRefusalWarnings(hostedDecodeLimits()), []);
});

test('a picture is named by its asset name, its id or the end of its URL, never by inline bytes', () => {
  assert.equal(pictureName('https://cdn.example.com/a/b/Acme%20Logo.png?token=1#x'), 'Acme Logo.png');
  assert.equal(pictureName('/catalog/assets/lolly/logo/primary.svg'), 'primary.svg');
  assert.equal(pictureName({ id: 'lolly/logo/primary', url: 'data:image/svg+xml;base64,AA' }), 'lolly/logo/primary');
  assert.equal(pictureName({ id: 'data:image/png;base64,AA', url: 'data:image/png;base64,AA', meta: { name: 'sponsor.png' } }), 'sponsor.png');
  assert.equal(pictureName('data:image/png;base64,AAAA'), undefined);
  assert.equal(pictureName('blob:lolly-node/1'), undefined);
  assert.equal(pictureName(new Uint8Array(4)), undefined);
});
