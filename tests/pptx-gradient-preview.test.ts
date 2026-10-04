// SPDX-License-Identifier: MPL-2.0
/**
 * A PPTX gradient scrim keeps its alpha all the way to the slide's own drawing
 * (plan 291 section 6).
 *
 * `lolly read --thumbnails` draws each slide through the faithful compile
 * (engine/src/deck-compile.ts `compileFaithful`) and the frame preview
 * (engine/src/frame-preview-svg.ts). The reader used to keep only a gradient's lowest
 * stop and the compile only its hex, so a white scrim fading from alpha 0 drew as an
 * opaque white block over the photo, and a pine one as a near solid slide. Now every
 * stop travels: pptx-read `gradientFill`, the source object's `fillGradient`, the
 * faithful row's `grad` spec (sRGB, `#rrggbbaa` stops) and an SVG gradient with one
 * `stop-opacity` per stop.
 *
 * Public: the deck is built here with the engine's own writer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { zipSync } from 'fflate';

import { packPng } from '../engine/src/png.ts';
import { buildPptxParts, type PptxSlide } from '../engine/src/pptx.ts';
import { compileFaithful } from '../engine/src/deck-compile.ts';
import { framePreviewSvg } from '../engine/src/frame-preview-svg.ts';
import { readContentInventory } from '../packages/node-shell/src/content-inventory.ts';

const W = 12192000;
const H = 6858000;
const RED = [220, 30, 30];

/** A solid red picture, so whatever the scrim leaves uncovered reads as red. */
function redPng(): Uint8Array {
  const px = new Uint8Array(64 * 36 * 4);
  for (let i = 0; i < px.length; i += 4) { px[i] = RED[0]!; px[i + 1] = RED[1]!; px[i + 2] = RED[2]!; px[i + 3] = 255; }
  return packPng(px, { width: 64, height: 36 });
}

/** A one-slide deck: a full-bleed picture under a white scrim that fades in from the top. */
function scrimDeck(): Uint8Array {
  const slide: PptxSlide = {
    media: [{ bytes: redPng(), ext: 'png' }],
    shapes: [
      { kind: 'pic', x: 0, y: 0, cx: W, cy: H, media: 0 },
      // The delivered caption scrim: three stops, 0 then 0.8 then 0.902 alpha, top to bottom.
      {
        kind: 'rect', x: 0, y: 0, cx: W, cy: H,
        fill: { grad: [{ pos: 0, color: 'FFFFFF', alpha: 0 }, { pos: 0.6, color: 'FFFFFF', alpha: 0.8 }, { pos: 1, color: 'FFFFFF', alpha: 0.90196 }], angle: 180 },
      },
    ],
  };
  const parts = buildPptxParts([slide], { emuW: W, emuH: H, now: '2026-10-03T00:00:00.000Z' });
  const files: Record<string, Uint8Array> = {};
  for (const [path, body] of Object.entries(parts)) files[path] = typeof body === 'string' ? new TextEncoder().encode(body) : body as Uint8Array;
  return zipSync(files);
}

/** RGBA pixels of an 8-bit, non-interlaced RGBA PNG (what resvg writes). */
function decodeRgba(png: Uint8Array): { width: number; height: number; px: Uint8Array } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let at = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (at < png.length) {
    const len = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    const data = png.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      assert.equal(data[8], 8, 'bit depth 8');
      assert.equal(data[9], 6, 'RGBA');
    } else if (type === 'IDAT') idat.push(data);
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const px = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x]!;
      const a = x >= 4 ? px[y * stride + x - 4]! : 0;
      const b = y > 0 ? px[(y - 1) * stride + x]! : 0;
      const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4]! : 0;
      let p = 0;
      if (filter === 1) p = a;
      else if (filter === 2) p = b;
      else if (filter === 3) p = (a + b) >> 1;
      else if (filter === 4) {
        const e = a + b - c;
        const pa = Math.abs(e - a), pb = Math.abs(e - b), pc = Math.abs(e - c);
        p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = (v + p) & 0xff;
    }
  }
  return { width, height, px };
}

test('the faithful compile carries a 3-stop alpha scrim as a grad spec, and the preview as stop-opacity', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-scrim-'));
  try {
    const { source } = await readContentInventory({ bytes: scrimDeck(), name: 'scrim.pptx' });
    const scrim = source.slides[0]!.objects.find((o) => o.kind === 'shape');
    assert.ok(scrim?.fillGradient, 'the source object keeps the whole gradient');
    assert.deepEqual(scrim!.fillGradient!.stops.map((s) => s.color.alpha ?? 1), [0, 0.8, 0.902], 'every stop keeps its alpha');
    assert.equal(scrim!.fillGradient!.angle, 180, 'a:lin ang 90 degrees (pointing down) is CSS 180');

    const frame = compileFaithful(source).frames[0]!;
    const row = frame.layers.find((l) => typeof l.grad === 'string');
    assert.ok(row, 'the scrim row states a grad');
    assert.equal(row!.grad, 'lin.srgb_180_ffffff00-0_ffffffcc-60_ffffffe6-100');
    assert.equal(row!.bg, undefined, 'no opaque bg under the gradient');

    const svg = framePreviewSvg(frame, { assetHref: () => undefined, emptySlots: false });
    assert.match(svg, /<linearGradient id="lg[0-9a-z]+" gradientUnits="userSpaceOnUse"/);
    assert.match(svg, /stop-color="#ffffff" stop-opacity="0"/, 'the top stop is fully transparent');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lolly read thumbnails: the photo shows through the transparent top of the scrim', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-scrim-'));
  try {
    const { inventory } = await readContentInventory({ bytes: scrimDeck(), name: 'scrim.pptx', mediaDir: dir, thumbnails: true });
    const thumb = inventory.slides[0]!.thumbnail;
    assert.ok(thumb, 'slide 1 was drawn');
    const { width, height, px } = decodeRgba(new Uint8Array(readFileSync(thumb!.file.startsWith("/") ? thumb!.file : join(dir, thumb!.file))));
    const at = (fx: number, fy: number): number[] => {
      const i = (Math.floor(fy * (height - 1)) * width + Math.floor(fx * (width - 1))) * 4;
      return [px[i]!, px[i + 1]!, px[i + 2]!];
    };
    const top = at(0.5, 0.02);
    const bottom = at(0.5, 0.98);
    assert.ok(top[0]! > 180 && top[1]! < 80 && top[2]! < 80, `the top of the slide is the red photo, not a white block (${top})`);
    assert.ok(bottom[1]! > 200 && bottom[2]! > 200, `the bottom of the slide is under a near-white scrim (${bottom})`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
