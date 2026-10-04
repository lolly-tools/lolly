// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 291 M3b, the `checks` gaps:
 *
 *   - `design.image.low-resolution`: an uploaded or catalog raster drawn at more than
 *     twice its pixel size on the artboard is a warning. The pixel size comes from the
 *     picture's own bytes (a `.lolly` upload, a catalog file); an SVG is never judged.
 *   - A colour with an alpha channel whose opaque base is a palette colour is that
 *     palette colour for the brand check (`#13294bcc` over a brand navy is no
 *     `brand.color.unknown`).
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/check-image-resolution.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateSync } from 'node:zlib';
import { strToU8, zipSync } from 'fflate';

import { checkFile, type CheckFileOptionsV1 } from '../packages/node-shell/src/check.ts';
import { checkBrandDesign } from '../engine/src/brand-check.ts';
import { checkFindingFromBrand } from '../engine/src/design-check.ts';
import type { CheckFindingV1 } from '../packages/core/src/check-v1.ts';

/** A real, decodable grey PNG of the given size. */
function png(width: number, height: number): Uint8Array {
  const chunk = (type: string, data: Uint8Array): Buffer => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])) >>> 0, 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  const raw = Buffer.alloc((width + 1) * height, 0x80);
  for (let y = 0; y < height; y++) raw[y * (width + 1)] = 0; // filter: none
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]));
}

const HEX_A = 'a1'.repeat(32);
const HEX_B = 'b2'.repeat(32);
const HEX_SVG = 'c3'.repeat(32);

function lolly(boxes: Record<string, unknown>[], uploads: Record<string, Uint8Array>, assets?: Record<string, unknown>[]): Uint8Array {
  const manifest = { format: 'lolly-share', formatVersion: 1, minReader: 1, kind: 'session', tool: { id: 'design', version: '1' }, ...(assets ? { assets } : {}) };
  return zipSync({
    'manifest.json': strToU8(JSON.stringify(manifest)),
    'session.json': strToU8(JSON.stringify({ boxes, __toolId: 'design' })),
    ...uploads,
  });
}

const frame = { id: 'slide', kind: 'frame', name: 'Slide', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff', order: 0 };
const OPTS: CheckFileOptionsV1 = { browser: 'off', textMeasure: false };
const lowRes = (findings: readonly CheckFindingV1[]) => findings.filter((f) => f.code === 'design.image.low-resolution');

test('an upload drawn at more than twice its pixel size is a warning; one drawn near its size is not', async () => {
  const boxes = [
    frame,
    // 400 x 225 drawn full bleed with cover: 4.8x.
    { id: 'bleed', kind: 'image', frame: 'slide', x: 0, y: 0, w: 1920, h: 1080, image: { id: `user/media/${HEX_A}`, source: 'user' }, fit: 'cover' },
    // The same picture at 600 x 300 with contain: min(1.5, 1.33) = 1.33x.
    { id: 'inset', kind: 'image', frame: 'slide', x: 100, y: 100, w: 600, h: 300, image: `user/media/${HEX_A}`, fit: 'contain' },
    // 1000 x 500 drawn 800 x 400, zoomed 300%: 2.4x.
    { id: 'zoomed', kind: 'image', frame: 'slide', x: 900, y: 100, w: 800, h: 400, image: `user/media/${HEX_B}`, fit: 'cover', imageFraming: { x: 50, y: 50, zoom: 300 } },
    // A hidden layer is never judged.
    { id: 'hidden', kind: 'image', frame: 'slide', x: 0, y: 0, w: 1920, h: 1080, image: `user/media/${HEX_A}`, fit: 'cover', hidden: true },
    // An SVG has no pixel size to fall short of.
    { id: 'vector', kind: 'image', frame: 'slide', x: 0, y: 600, w: 1900, h: 400, image: `user/media/${HEX_SVG}`, fit: 'fill' },
  ];
  const bytes = lolly(boxes, {
    [`assets/uploads/${HEX_A}.png`]: png(400, 225),
    [`assets/uploads/${HEX_B}.png`]: png(1000, 500),
    [`assets/uploads/${HEX_SVG}.svg`]: strToU8('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
  });
  const report = await checkFile(bytes, 'pictures.lolly', OPTS);
  const found = lowRes(report.findings);
  assert.deepEqual(found.map((f) => f.layerId), ['bleed', 'zoomed']);
  const bleed = found[0]!;
  assert.equal(bleed.family, 'structure');
  assert.equal(bleed.severity, 'warn');
  assert.equal(bleed.needs, 'review');
  assert.equal(bleed.path, '/boxes/1/image');
  assert.equal(bleed.artboardId, 'slide');
  assert.deepEqual(bleed.box, { x: 0, y: 0, width: 1920, height: 1080 });
  assert.equal(bleed.origin.checker, 'image-resolution');
  assert.equal(bleed.evidence?.pixelWidth, 400);
  assert.equal(bleed.evidence?.pixelHeight, 225);
  assert.equal(bleed.evidence?.scale, 4.8);
  assert.equal(bleed.evidence?.source, 'upload');
  assert.match(bleed.message, /400 x 225 px/);
  assert.match(bleed.suggestion ?? '', /960 px wide/);
  assert.equal(found[1]!.evidence?.scale, 2.4);
  assert.equal(report.families.structure.warn, 2);
  assert.match(report.families.structure.reason ?? '', /Measured 3 picture layers for resolution/);
  assert.equal(report.exitCode, 5);
});

test('a .lolly saved by the web shell links its uploads by the manifest path, not a sha-named file', async () => {
  // The web pack (shells/web/src/lib/lolly-pack.ts) writes an upload at a label path and
  // links its `user/upload/<uuid>-<name>` id to that path only through manifest.assets[].path.
  const id = 'user/upload/0b6c3f1e-5b7a-4f43-9d55-1c2f3b4a5d6e-hero.png';
  const boxes = [
    frame,
    { id: 'bleed', kind: 'image', frame: 'slide', x: 0, y: 0, w: 1920, h: 1080, image: { id, source: 'user' }, fit: 'cover' },
    // A treatment modifier on an upload still points at the same bytes.
    { id: 'treated', kind: 'image', frame: 'slide', x: 0, y: 0, w: 1920, h: 1080, image: `${id}?treatment=warm`, fit: 'cover' },
    // A row naming a missing upload, and an asset-ref row with no bytes, stay unmeasured.
    { id: 'gone', kind: 'image', frame: 'slide', x: 0, y: 0, w: 1920, h: 1080, image: 'user/upload/gone', fit: 'cover' },
  ];
  const pic = png(400, 225);
  const bytes = lolly(boxes, { 'assets/uploads/hero.png': pic }, [
    { kind: 'asset', id, source: 'user', path: 'assets/uploads/hero.png', bytes: pic.length, label: 'hero.png', type: 'raster', format: 'png', mime: 'image/png' },
    { kind: 'asset-ref', id: 'user/upload/gone', source: 'user', label: 'user/upload/gone', type: 'data', format: '', mime: '' },
    // A row whose path is not in the zip is ignored rather than trusted.
    { kind: 'asset', id: 'user/upload/elsewhere', source: 'user', path: 'assets/uploads/elsewhere.png' },
  ]);
  const report = await checkFile(bytes, 'web.lolly', OPTS);
  const found = lowRes(report.findings);
  assert.deepEqual(found.map((f) => [f.layerId, f.evidence?.source, f.evidence?.scale]), [['bleed', 'upload', 4.8], ['treated', 'upload', 4.8]]);
  assert.match(report.families.structure.reason ?? '', /Measured 2 picture layers for resolution/);
  assert.match(report.families.structure.reason ?? '', /One picture layer has no picture bytes to read here, so its resolution was not checked/);
});

test('fit none draws a picture at its own size and scale-down never past it', async () => {
  const boxes = [
    frame,
    // 100 x 100 in a 1000 x 1000 box: object-fit none and scale-down both draw it at 1x.
    { id: 'none', kind: 'image', frame: 'slide', x: 0, y: 0, w: 1000, h: 1000, image: `user/media/${HEX_A}`, fit: 'none' },
    { id: 'scaledown', kind: 'image', frame: 'slide', x: 0, y: 0, w: 1000, h: 1000, image: `user/media/${HEX_A}`, fit: 'scale-down' },
    // Framing zoom still enlarges a fit-none picture: 100% of its size times 3.
    { id: 'zoomed-none', kind: 'image', frame: 'slide', x: 0, y: 0, w: 1000, h: 1000, image: `user/media/${HEX_A}`, fit: 'none', imageFraming: { x: 50, y: 50, zoom: 300 } },
    // Contain keeps judging at the box ratio: 10x.
    { id: 'contain', kind: 'image', frame: 'slide', x: 0, y: 0, w: 1000, h: 1000, image: `user/media/${HEX_A}`, fit: 'contain' },
  ];
  const bytes = lolly(boxes, { [`assets/uploads/${HEX_A}.png`]: png(100, 100) });
  const report = await checkFile(bytes, 'fits.lolly', OPTS);
  const found = lowRes(report.findings);
  assert.deepEqual(found.map((f) => [f.layerId, f.evidence?.fit, f.evidence?.scale]), [['zoomed-none', 'none', 3], ['contain', 'contain', 10]]);
});

test('a catalog raster is read from its file; an id with no readable raster is skipped', async () => {
  const boxes = [
    frame,
    { id: 'big', kind: 'image', frame: 'slide', x: 0, y: 0, w: 1920, h: 1080, image: 'example/photos/small?treatment=duotone', fit: 'cover' },
    { id: 'fine', kind: 'image', frame: 'slide', x: 0, y: 0, w: 320, h: 180, image: 'example/photos/small', fit: 'cover' },
    { id: 'logo', kind: 'image', frame: 'slide', x: 0, y: 0, w: 1920, h: 1080, image: 'example/logo/mark', fit: 'contain' },
    { id: 'missing', kind: 'image', frame: 'slide', x: 0, y: 0, w: 1920, h: 1080, image: 'example/photos/gone', fit: 'cover' },
    // A placeholder key is waiting for `lolly package --asset`, so it has no bytes yet.
    { id: 'placeholder', kind: 'image', frame: 'slide', x: 0, y: 0, w: 1920, h: 1080, image: 'photo:cover', fit: 'cover' },
  ];
  const asked: string[] = [];
  const files: Record<string, Uint8Array> = {
    'example/photos/small': png(320, 180),
    'example/logo/mark': strToU8('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"/>'),
  };
  const report = await checkFile(strToU8(JSON.stringify({ boxes })), 'catalog.json', {
    ...OPTS,
    pictureBytes: (id) => { asked.push(id); return files[id] ?? null; },
  });
  // Modifiers are stripped before the file is looked up; a placeholder is never looked up.
  assert.deepEqual([...new Set(asked)].sort(), ['example/logo/mark', 'example/photos/gone', 'example/photos/small']);
  const found = lowRes(report.findings);
  assert.deepEqual(found.map((f) => [f.layerId, f.evidence?.source, f.evidence?.scale]), [['big', 'catalog', 6]]);
});

test('the active profile catalog file gives the pixel size when no reader is passed', async () => {
  // lolly/demo/lorikeet-lollipop is a public raster in the lolly-start catalog, 1628 px wide.
  const boxes = [
    frame,
    { id: 'cover', kind: 'image', frame: 'slide', x: 0, y: 0, w: 1920, h: 1080, image: 'lolly/demo/lorikeet-lollipop', fit: 'cover' },
    { id: 'huge', kind: 'image', frame: 'slide', x: 0, y: 0, w: 4000, h: 3000, image: 'lolly/demo/lorikeet-lollipop', fit: 'cover' },
  ];
  const report = await checkFile(strToU8(JSON.stringify({ boxes })), 'profile.json', { ...OPTS, catalog: { profile: 'lolly-start', assets: [] } });
  const found = lowRes(report.findings);
  assert.deepEqual(found.map((f) => f.layerId), ['huge']);
  assert.ok(Number(found[0]!.evidence?.pixelWidth) > 1000);
});

test('a colour with alpha whose base is a palette colour counts as that palette colour', () => {
  const doc = {
    color: {
      navy: { $type: 'color', $value: '#13294B' },
      white: { $type: 'color', $value: '#ffffff' },
    },
    font: { brand: { $type: 'fontFamily', $value: 'Example Sans' } },
  };
  const boxes = [
    { id: 'scrim', bg: '#13294bcc' },
    { id: 'short', bg: '#fff8' },
    { id: 'rgba', bg: 'rgba(19, 41, 75, 0.5)' },
    { id: 'stroke', stroke: '#13294B80' },
    // A base outside the palette still cannot be compared once composited.
    { id: 'off', bg: '#12345680' },
    // Fully transparent is no colour at all, as before.
    { id: 'clear', bg: '#13294b00' },
  ];
  const report = checkBrandDesign(boxes, doc);
  const byLayer = (id: string) => report.findings.filter((f) => f.layerId === id);
  for (const id of ['scrim', 'short', 'rgba', 'stroke', 'clear']) assert.deepEqual(byLayer(id), [], id);
  assert.equal(report.checked.colors, 4);
  const off = byLayer('off');
  assert.equal(off.length, 1);
  assert.equal(checkFindingFromBrand(off[0]!).code, 'brand.color.unknown');
});
