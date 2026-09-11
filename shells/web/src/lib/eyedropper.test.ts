// SPDX-License-Identifier: MPL-2.0
/**
 * The eyedropper's sampling maths (plan 216 item 8) - the part that decides which
 * colour a finger over the surface picks. The loupe overlay, the offscreen-canvas
 * decode and host.export.render are browser/device concerns (jsdom has no canvas
 * getImageData, and the acceptance is a real on-device drag), so this pins the pure
 * logic a bug would hide in: the client->pixel map, edge clamping, and hex output.
 *
 * The "two-colour PNG" of the plan's acceptance is modelled at the DECODED level -
 * a hand-built RGBA frame split left/right - since the PNG->ImageData step is the
 * canvas decode this test deliberately does not stand in for.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rgbToHex, clientToImagePixel, pixelHex, sampleAt, type SampleFrame } from './eyedropper.ts';

/** A `w`x`h` frame, left half `left`, right half `right` (each `[r,g,b]`). */
function splitFrame(w: number, h: number, left: [number, number, number], right: [number, number, number]): SampleFrame {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = x < w / 2 ? left : right;
      const i = (y * w + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

test('rgbToHex formats, pads and clamps each channel', () => {
  assert.equal(rgbToHex(0, 0, 0), '#000000');
  assert.equal(rgbToHex(255, 255, 255), '#ffffff');
  assert.equal(rgbToHex(255, 0, 128), '#ff0080');
  assert.equal(rgbToHex(1, 2, 3), '#010203');
  assert.equal(rgbToHex(-5, 300, 127.6), '#00ff80', 'out-of-range rounds+clamps into byte range');
});

test('clientToImagePixel maps a fraction of the rect to a pixel, clamped at the edges', () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };
  // Centre of the rect -> centre-ish pixel of a 20x10 image.
  assert.deepEqual(clientToImagePixel(rect, 20, 10, 200, 100), { x: 10, y: 5 });
  // Top-left corner -> pixel (0,0).
  assert.deepEqual(clientToImagePixel(rect, 20, 10, 100, 50), { x: 0, y: 0 });
  // Beyond the far corner -> last pixel, never out of range.
  assert.deepEqual(clientToImagePixel(rect, 20, 10, 9999, 9999), { x: 19, y: 9 });
  // Before the rect -> clamped to 0.
  assert.deepEqual(clientToImagePixel(rect, 20, 10, -50, -50), { x: 0, y: 0 });
});

test('a zero-area rect maps to the origin instead of dividing by zero', () => {
  assert.deepEqual(clientToImagePixel({ left: 0, top: 0, width: 0, height: 0 }, 8, 8, 40, 40), { x: 0, y: 0 });
});

test('pixelHex reads a pixel, and answers black for an out-of-range index', () => {
  const f = splitFrame(2, 1, [10, 20, 30], [200, 100, 50]);
  assert.equal(pixelHex(f, 0, 0), '#0a141e');
  assert.equal(pixelHex(f, 1, 0), '#c86432');
  assert.equal(pixelHex(f, 99, 99), '#000000', 'off the frame is black, not a throw');
});

test('sampleAt: a finger over the left half picks the left colour, the right half the right', () => {
  const frame = splitFrame(100, 40, [255, 0, 0], [0, 0, 255]);   // red | blue
  const rect = { left: 0, top: 0, width: 300, height: 120 };     // 3x scaled on screen
  assert.equal(sampleAt(frame, rect, 60, 60), '#ff0000', 'left third of the surface is red');
  assert.equal(sampleAt(frame, rect, 240, 60), '#0000ff', 'right third is blue');
  // The boundary and the far edge stay on real pixels.
  assert.equal(sampleAt(frame, rect, 299, 119), '#0000ff', 'the far corner samples the last (blue) pixel');
});
