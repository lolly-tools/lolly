// SPDX-License-Identifier: MPL-2.0
/**
 * Tests for engine/src/pptx-read.ts `pptxMediaImages` — the DOM-free half of the
 * /verify "Lolly Imprint inside an embedded raster" scan. Given an unzipped
 * .pptx part map (exactly the contract inflatePptx hands back), it names the
 * `ppt/media/*.{png,jpg,jpeg}` parts a pixel-watermark detector can read and
 * omits everything else. The shell owns the unzip + the canvas decode; this
 * pure enumeration is all that lives in the engine.
 *
 * Source of truth: a hand-built part map with a known-correct expected set — no
 * mocking of the function under test.
 *
 * Run with: node --test tests/pptx-media-images.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pptxMediaImages } from '../engine/src/pptx-read.ts';
import type { PptxParts } from '../engine/src/pptx-read.ts';

const bytes = (n: number): Uint8Array => new Uint8Array(n).fill(1);

test('selects only ppt/media raster images (png/jpg/jpeg), case-insensitive', () => {
  const parts: PptxParts = {
    'ppt/presentation.xml': '<p:presentation/>',
    'ppt/media/image1.png': bytes(10),
    'ppt/media/image2.jpeg': bytes(10),
    'ppt/media/image3.jpg': bytes(10),
    'ppt/media/PHOTO.JPG': bytes(10),
    'ppt/media/logo.svg': '<svg/>',           // vector — no pixel mark
    'ppt/media/diagram.emf': bytes(10),        // metafile — not RGBA
    'ppt/media/clip.wmf': bytes(10),           // metafile — not RGBA
    'ppt/media/movie.mp4': bytes(10),          // video — not an image part
    'docProps/thumbnail.jpeg': bytes(10),      // a jpeg, but NOT under ppt/media/
    'ppt/slides/slide1.xml': '<p:sld/>',
  };
  const got = pptxMediaImages(parts).map((e) => e.path);
  assert.deepEqual(got, [
    'ppt/media/PHOTO.JPG',   // sorted: uppercase sorts before lowercase
    'ppt/media/image1.png',
    'ppt/media/image2.jpeg',
    'ppt/media/image3.jpg',
  ]);
});

test('maps extension to decode MIME', () => {
  const parts: PptxParts = {
    'ppt/media/a.png': bytes(4),
    'ppt/media/b.PNG': bytes(4),
    'ppt/media/c.jpg': bytes(4),
    'ppt/media/d.jpeg': bytes(4),
    'ppt/media/e.JPEG': bytes(4),
  };
  const byPath = new Map(pptxMediaImages(parts).map((e) => [e.path, e.mime]));
  assert.equal(byPath.get('ppt/media/a.png'), 'image/png');
  assert.equal(byPath.get('ppt/media/b.PNG'), 'image/png');
  assert.equal(byPath.get('ppt/media/c.jpg'), 'image/jpeg');
  assert.equal(byPath.get('ppt/media/d.jpeg'), 'image/jpeg');
  assert.equal(byPath.get('ppt/media/e.JPEG'), 'image/jpeg');
});

test('skips empty parts (nothing to decode)', () => {
  const parts: PptxParts = {
    'ppt/media/empty.png': bytes(0),
    'ppt/media/emptystr.png': '',
    'ppt/media/real.png': bytes(8),
  };
  assert.deepEqual(pptxMediaImages(parts).map((e) => e.path), ['ppt/media/real.png']);
});

test('excludes nested paths that only look like media', () => {
  const parts: PptxParts = {
    'ppt/media/sub/inner.png': bytes(8),  // a slash after ppt/media/ — not a flat media part
    'notppt/media/x.png': bytes(8),
    'ppt/media/ok.png': bytes(8),
  };
  assert.deepEqual(pptxMediaImages(parts).map((e) => e.path), ['ppt/media/ok.png']);
});

test('caps the number of entries returned (bounds caller decode work)', () => {
  const parts: PptxParts = {};
  for (let i = 0; i < 200; i++) parts[`ppt/media/img${String(i).padStart(3, '0')}.png`] = bytes(4);
  assert.equal(pptxMediaImages(parts, 10).length, 10);
  assert.equal(pptxMediaImages(parts).length, 64); // default cap
  // The cap takes the first N by sorted path, deterministically.
  assert.deepEqual(
    pptxMediaImages(parts, 3).map((e) => e.path),
    ['ppt/media/img000.png', 'ppt/media/img001.png', 'ppt/media/img002.png'],
  );
});

test('degenerate inputs never throw, return empty', () => {
  assert.deepEqual(pptxMediaImages({} as PptxParts), []);
  assert.deepEqual(pptxMediaImages(null as unknown as PptxParts), []);
  assert.deepEqual(pptxMediaImages(undefined as unknown as PptxParts), []);
  assert.deepEqual(pptxMediaImages({ 'ppt/media/a.png': bytes(4) }, 0), []);
  assert.deepEqual(pptxMediaImages({ 'ppt/media/a.png': bytes(4) }, -5), []);
});
