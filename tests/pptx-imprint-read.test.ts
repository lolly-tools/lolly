// SPDX-License-Identifier: MPL-2.0
/**
 * Tests for the ENGINE half of the /verify "Lolly Imprint inside a .pptx
 * embedded raster" story: enumeration (`pptxMediaImages` / `isPptx`) + detection
 * (`detectWatermark`) reading a GENUINE v2-imprinted `ppt/media` raster.
 *
 * Why this exists: a green deck exported by deck-builder shows NO Imprint in
 * /verify — not because the read path is broken, but because an ordinary
 * deck-builder deck (text boxes, roundRect shapes, gradient fills, byte-faithful
 * user photos/SVG logos) lowers to NATIVE PowerPoint vector + verbatim user
 * bytes. There is no Lolly-RENDERED raster in `ppt/media`, so nothing carries the
 * pixel Imprint (see export-pptx.ts: only rasterPic / svgPic thread
 * `opts._imprintSink`). The mark only appears when an element must be baked
 * (rotated / CSS-filtered / effect / inline <svg>).
 *
 * This test isolates that: it MANUFACTURES the raster the vector deck never
 * produces — a real v2 `embedWatermark` render encoded to a `ppt/media` PNG (and
 * JPEG) — and proves the read chain finds it. So when a real deck reads clean,
 * the failure is upstream at EMBED (no raster was made), not here at read.
 *
 * The zip unzip + canvas decode are the shell's job (browser-only, unverifiable
 * here); this covers the two DOM-free, node-runnable links: part enumeration and
 * the detection math. sharp (a repo devDep) stands in for the shell's PNG/JPEG
 * codec; the test skips cleanly if it can't load, mirroring
 * tests/pixel-watermark-robustness.test.ts.
 *
 * Run with: node --test tests/pptx-imprint-read.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isPptx, pptxMediaImages } from '../engine/src/pptx-read.ts';
import type { PptxParts } from '../engine/src/pptx-read.ts';
import { embedWatermark, detectWatermark } from '../engine/src/pixel-watermark.ts';

let sharp: (typeof import('sharp'))['default'] | undefined;
try { sharp = (await import('sharp')).default; } catch { /* optional */ }
const skip = sharp ? false : 'sharp not available';

// Multi-scale "photo-like" RGBA — the shared, CALIBRATED generator (see
// helpers/photo-like.ts): real codecs behave as they would on a photograph and
// there are plenty of non-flat 8x8 blocks for the embed floor
// (MIN_IMPRINT_BLOCKS ~ 594; 384^2 = 2304 blocks).
import { photoLike } from './helpers/photo-like.ts';

// Encode a raw RGBA image to PNG/JPEG bytes, exactly as buildPptxParts stores
// `ppt/media/imageN_M.ext` — verbatim in the zip, no re-encode. Round-trips the
// codec so decode reads NATIVE stored resolution (no resize; the mark rides an
// 8×8 grid a rescale would shift).
async function toPng(rgba: Uint8Array, w: number, h: number): Promise<Uint8Array> {
  return new Uint8Array(await sharp!(Buffer.from(rgba), { raw: { width: w, height: h, channels: 4 } }).png().toBuffer());
}
async function toJpeg(rgba: Uint8Array, w: number, h: number, q = 90): Promise<Uint8Array> {
  return new Uint8Array(await sharp!(Buffer.from(rgba), { raw: { width: w, height: h, channels: 4 } }).jpeg({ quality: q }).toBuffer());
}
async function decodeRgba(bytes: Uint8Array): Promise<{ data: Uint8Array; width: number; height: number }> {
  const { data, info } = await sharp!(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}
const det = (i: { data: Uint8Array; width: number; height: number }) =>
  detectWatermark(i.data, { width: i.width, height: i.height });

test('a v2-imprinted ppt/media PNG is enumerated and detected end-to-end', { skip }, async () => {
  const W = 384, H = 384;
  const marked = embedWatermark(photoLike(W, H, 101), { width: W, height: H });
  const pngBytes = await toPng(marked, W, H);
  const jpegBytes = await toJpeg(embedWatermark(photoLike(W, H, 202), { width: W, height: H }), W, H, 90);

  // The part map inflatePptx would hand back for a deck whose ONLY images are
  // Lolly-rendered rasters (the rotated/filtered/effect case) — plus vector
  // siblings that must be OMITTED (no pixel mark by construction).
  const parts: PptxParts = {
    'ppt/presentation.xml': '<p:presentation/>',
    'ppt/media/image1_1.png': pngBytes,   // v2-imprinted render
    'ppt/media/image2_1.jpeg': jpegBytes, // v2-imprinted render, jpeg branch
    'ppt/media/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>', // vector logo — skipped
    'ppt/media/chart.emf': new Uint8Array(64).fill(1),                 // metafile — skipped
    'ppt/slides/slide1.xml': '<p:sld/>',
  };

  // 1. enumeration: recognises it as a pptx, names exactly the two rasters (png
  //    before jpeg by sort), maps mimes, omits .svg/.emf and non-media parts.
  assert.equal(isPptx(parts), true);
  assert.deepEqual(pptxMediaImages(parts), [
    { path: 'ppt/media/image1_1.png', mime: 'image/png' },
    { path: 'ppt/media/image2_1.jpeg', mime: 'image/jpeg' },
  ]);

  // 2. detection: decode each enumerated part back to RGBA at native resolution
  //    and read the v2 mark. This is the exact contract scanRgbaImages runs, minus
  //    the browser createImageBitmap/canvas decode (sharp stands in).
  const pngHit = det(await decodeRgba(parts['ppt/media/image1_1.png'] as Uint8Array));
  assert.ok(pngHit.present, `PNG media should carry the v2 Imprint (score ${pngHit.score.toFixed(4)})`);

  const jpegHit = det(await decodeRgba(parts['ppt/media/image2_1.jpeg'] as Uint8Array));
  assert.ok(jpegHit.present, `JPEG media should survive q90 and carry the Imprint (score ${jpegHit.score.toFixed(4)})`);
});

test('an all-vector / unmarked-raster deck reads absent — never a false hit', { skip }, async () => {
  const W = 384, H = 384;
  // An ordinary deck-builder deck: byte-faithful USER photo (never imprinted —
  // it is the user's own asset, not Lolly-rendered pixels) alongside vector art.
  const userPhoto = await toPng(photoLike(W, H, 303), W, H); // NO embedWatermark
  const parts: PptxParts = {
    'ppt/presentation.xml': '<p:presentation/>',
    'ppt/media/image1_1.png': userPhoto,
    'ppt/media/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
  };

  // Enumeration still surfaces the raster (the reader can't know it's unmarked
  // without decoding) …
  assert.deepEqual(pptxMediaImages(parts), [{ path: 'ppt/media/image1_1.png', mime: 'image/png' }]);
  // … but detection correctly finds NO mark. Absence must read as "nothing to
  // report", never as a positive — the /verify scan surfaces only a true hit.
  const miss = det(await decodeRgba(parts['ppt/media/image1_1.png'] as Uint8Array));
  assert.equal(miss.present, false, `unmarked user photo must not false-positive (score ${miss.score.toFixed(4)})`);
});
