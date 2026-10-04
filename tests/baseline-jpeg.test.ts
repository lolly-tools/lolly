// SPDX-License-Identifier: MPL-2.0
/**
 * The fixture JPEG encoder (scripts/lib/baseline-jpeg.ts), which writes
 * recreate.pptx's photographs so no fixture byte comes from a versioned
 * dependency. Pinned here: the same pixels give the same bytes, the stream is a
 * baseline JFIF whose frame header states the size (including sizes off the
 * 16 px grid), and an independent decoder reads it back close to the input.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/baseline-jpeg.test.ts
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { encodeBaselineJpeg } from '../scripts/lib/baseline-jpeg.ts';

/** A smooth synthetic picture with one hard edge, w x h RGB. */
function picture(w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      out[i] = Math.round(128 + 100 * Math.sin(x / 30));
      out[i + 1] = Math.round(128 + 80 * Math.cos(y / 25));
      out[i + 2] = x < w / 2 ? 40 : 210;
    }
  }
  return out;
}

/** The SOF0 frame header's height and width, scanning the marker segments. */
function sof0(bytes: Uint8Array): { width: number; height: number; components: number } | null {
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1]!;
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (marker === 0xc0) return { height: (bytes[i + 5]! << 8) | bytes[i + 6]!, width: (bytes[i + 7]! << 8) | bytes[i + 8]!, components: bytes[i + 9]! };
    i += 2 + len;
  }
  return null;
}

test('the same pixels give the same bytes, and a baseline JFIF frame of the stated size', () => {
  const rgb = picture(333, 217);
  const a = encodeBaselineJpeg(rgb, 333, 217, 80);
  const b = encodeBaselineJpeg(new Uint8Array(rgb), 333, 217, 80);
  assert.equal(createHash('sha256').update(a).digest('hex'), createHash('sha256').update(b).digest('hex'));
  assert.deepEqual([...a.subarray(0, 2)], [0xff, 0xd8], 'SOI');
  assert.deepEqual([...a.subarray(a.length - 2)], [0xff, 0xd9], 'EOI');
  assert.equal(new TextDecoder().decode(a.subarray(6, 10)), 'JFIF');
  assert.deepEqual(sof0(a), { width: 333, height: 217, components: 3 });
  assert.notDeepEqual(a, encodeBaselineJpeg(rgb, 333, 217, 60), 'quality changes the tables');
});

test('bad input is refused with the reason', () => {
  assert.throws(() => encodeBaselineJpeg(new Uint8Array(10), 2, 2), /is not 2x2 RGB/);
  assert.throws(() => encodeBaselineJpeg(new Uint8Array(0), 0, 1), /not a size/);
  assert.throws(() => encodeBaselineJpeg(picture(4, 4), 4, 4, 0), /quality 0/);
});

test('an independent decoder reads the stream back close to the input (sharp)', async (t) => {
  let sharp: typeof import('sharp')['default'];
  try { sharp = (await import('sharp')).default; } catch { t.skip('sharp unavailable on this platform'); return; }
  for (const [w, h] of [[333, 217], [17, 9], [1, 1], [64, 48]] as const) {
    const rgb = picture(w, h);
    const psnr = async (jpeg: Uint8Array): Promise<number> => {
      const { data, info } = await sharp(Buffer.from(jpeg)).raw().toBuffer({ resolveWithObject: true });
      assert.deepEqual([info.width, info.height, info.channels], [w, h, 3], `${w}x${h}`);
      let se = 0;
      for (let i = 0; i < rgb.length; i++) se += (rgb[i]! - data[i]!) ** 2;
      return se === 0 ? Infinity : 10 * Math.log10((255 * 255) / (se / rgb.length));
    };
    // libjpeg at the same quality and chroma subsampling is the yardstick.
    const reference = await sharp(Buffer.from(rgb), { raw: { width: w, height: h, channels: 3 } })
      .jpeg({ quality: 80, chromaSubsampling: '4:2:0', mozjpeg: false }).toBuffer();
    const [ours, theirs] = [await psnr(encodeBaselineJpeg(rgb, w, h, 80)), await psnr(new Uint8Array(reference))];
    assert.ok(ours > 25 && ours >= theirs - 1, `${w}x${h} decodes at ${ours.toFixed(1)} dB against libjpeg's ${theirs.toFixed(1)} dB`);
  }
});
