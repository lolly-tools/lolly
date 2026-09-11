// SPDX-License-Identifier: MPL-2.0
/**
 * Glass loupe (lib/loupe-gl.ts) - the pure geometry only. The WebGL half needs a GL context, so
 * it is verified manually in-browser; here we pin offsetToUv/halfWindow, the mapping from a
 * cursor offset (stage-centre origin, as attachZoom's offsetFrom returns) to the texture UV.
 *
 * Run directly:  node --test shells/web/src/lib/loupe-gl.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offsetToUv, halfWindow, LOUPE_MAG } from './loupe-gl.ts';

test('offsetToUv: centre of a centred, unpanned media is (0.5, 0.5)', () => {
  assert.deepEqual(offsetToUv(0, 0, 400, 300, 0, 0), [0.5, 0.5]);
});

test('offsetToUv: the four corners map to the UV corners', () => {
  const W = 400, H = 300;
  assert.deepEqual(offsetToUv(-W / 2, -H / 2, W, H, 0, 0), [0, 0]);   // top-left
  assert.deepEqual(offsetToUv(W / 2, H / 2, W, H, 0, 0), [1, 1]);     // bottom-right
});

test('offsetToUv: pan shifts the sampled point by the pan / size', () => {
  // Panning the media right by tx moves the art under a fixed cursor left in UV.
  assert.deepEqual(offsetToUv(0, 0, 400, 300, 100, 0), [0.5 - 100 / 400, 0.5]);
});

test('offsetToUv: returns null when the cursor is off the art', () => {
  const W = 400, H = 300;
  assert.equal(offsetToUv(W, 0, W, H, 0, 0), null);        // right of the art
  assert.equal(offsetToUv(0, -H, W, H, 0, 0), null);       // above the art
  assert.equal(offsetToUv(0, 0, 0, 300, 0, 0), null);      // zero-size ⇒ undefined
});

test('halfWindow: the lens shows size/LOUPE_MAG media-px, as a UV fraction of each axis', () => {
  const W = 16000, H = 12000;   // e.g. a small asset at 2000%
  const size = 480;
  const [hu, hv] = halfWindow(W, H, size);
  const px = size / LOUPE_MAG / 2;
  assert.equal(hu, px / W);
  assert.equal(hv, px / H);
  assert.ok(hu < hv, 'the wider axis samples a smaller UV fraction');
});
