// SPDX-License-Identifier: MPL-2.0
/**
 * PatchMatch inpainting: the inpaint WASM module through the Node loader, the size rule that
 * keeps Telea for small marks, and proof that a small mark takes the same Telea bytes as before.
 *
 * Run with: node --test tests/inpaint-patchmatch.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { inpaintTelea } from '../engine/src/inpaint.ts';
import { loadInpaintKernel } from '../packages/node-shell/src/inpaint-node.ts';
import {
  INPAINT_LARGE_MASK_PIXELS, INPAINT_MAX_PIXELS, InpaintKernelError, chooseRemovalFill, countMask,
} from '../packages/node-shell/src/inpaint.ts';

const kernel = await loadInpaintKernel();

/** A repeating texture with a gentle gradient and fixed noise: patches elsewhere in the image match the hole. */
function texture(w: number, h: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  let s = 7;
  const noise = (): number => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s / 4294967296) * 14 - 7; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, band = ((x >> 3) + (y >> 4)) & 1 ? 36 : 0;
    px[i] = 90 + x * 0.3 + band + noise(); px[i + 1] = 120 + y * 0.2 + band + noise(); px[i + 2] = 100 + band + noise(); px[i + 3] = 255;
  }
  return px;
}
function disc(w: number, h: number, cx: number, cy: number, r: number): Uint8Array {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) m[y * w + x] = 1;
  return m;
}
const sha = (b: Uint8ClampedArray | Uint8Array): string => createHash('sha256').update(b).digest('hex');

test('a large hole in a texture is filled close to the known background', () => {
  const w = 256, h = 224, clean = texture(w, h), mask = disc(w, h, 128, 112, 54);
  const dirty = new Uint8ClampedArray(clean);
  for (let i = 0; i < mask.length; i++) if (mask[i]) { dirty[i * 4] = 255; dirty[i * 4 + 1] = 0; dirty[i * 4 + 2] = 255; }
  assert.ok(countMask(mask) >= INPAINT_LARGE_MASK_PIXELS);
  const out = kernel.fill(dirty, w, h, mask);
  let diff = 0, n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) { for (let c = 0; c < 3; c++) { diff += Math.abs(out[i * 4 + c]! - clean[i * 4 + c]!); n++; } }
  const mean = diff / n;
  assert.ok(mean < 10, `mean difference inside the mask is ${mean.toFixed(2)} of 255`);
  // Pixels outside the mask are byte for byte the input.
  for (let i = 0; i < mask.length; i++) if (!mask[i]) {
    assert.equal(out[i * 4], dirty[i * 4]); assert.equal(out[i * 4 + 3], 255);
  }
});

test('the same request gives the same bytes, twice and across instances', async () => {
  const w = 96, h = 96, img = texture(w, h), mask = disc(w, h, 48, 48, 20);
  const a = kernel.fill(img, w, h, mask), b = kernel.fill(img, w, h, mask);
  assert.equal(sha(a), sha(b));
  const { createInpaintKernel } = await import('../packages/node-shell/src/inpaint.ts');
  const { readFile } = await import('node:fs/promises');
  const fresh = await createInpaintKernel(new Uint8Array(await readFile(new URL('../packages/node-shell/wasm/inpaint/inpaint.wasm', import.meta.url))));
  assert.equal(sha(fresh.fill(img, w, h, mask)), sha(a));
});

test('an empty mask returns the image unchanged', () => {
  const w = 40, h = 30, img = texture(w, h);
  assert.equal(sha(kernel.fill(img, w, h, new Uint8Array(w * h))), sha(img));
});

test('the pixel cap and bad requests are refused with a clear error', () => {
  const side = Math.ceil(Math.sqrt(INPAINT_MAX_PIXELS)) + 1;
  assert.throws(() => kernel.fill(new Uint8ClampedArray(0), side, side, new Uint8Array(0)), /too large/);
  assert.throws(() => kernel.fill(new Uint8ClampedArray(16), 2, 2, new Uint8Array(3)), InpaintKernelError);
  assert.throws(() => kernel.fill(new Uint8ClampedArray(16), 0, 2, new Uint8Array(0)), InpaintKernelError);
  assert.throws(() => kernel.fill(new Uint8ClampedArray(16), 2, 2, new Uint8Array(4), { patchRadius: 99 }), /radius/);
  // The module enforces the cap itself too: a raw request over it is refused without a trap.
  const w = 4097, h = 4096;
  assert.throws(() => kernel.fill(new Uint8ClampedArray(w * h * 4), w, h, new Uint8Array(w * h)), /too large/);
});

test('a mask with nothing left to copy from is an error, not a trap', () => {
  assert.throws(() => kernel.fill(texture(8, 8), 8, 8, new Uint8Array(64).fill(1)), InpaintKernelError);
});

test('semi-transparent pixels keep a working alpha channel', () => {
  const w = 96, h = 96, img = texture(w, h);
  for (let i = 0; i < w * h; i++) img[i * 4 + 3] = 200;
  const mask = disc(w, h, 48, 48, 14), out = kernel.fill(img, w, h, mask);
  for (let i = 0; i < w * h; i++) if (mask[i]) assert.ok(Math.abs(out[i * 4 + 3]! - 200) <= 2);
});

test('small marks keep Telea and large regions go to PatchMatch', () => {
  assert.equal(chooseRemovalFill(0), 'telea');
  assert.equal(chooseRemovalFill(INPAINT_LARGE_MASK_PIXELS - 1), 'telea');
  assert.equal(chooseRemovalFill(INPAINT_LARGE_MASK_PIXELS), 'patchmatch');
});

test('Telea output for a small mark is byte-identical to the pinned digest', () => {
  const w = 64, h = 64, img = texture(w, h), mask = disc(w, h, 32, 32, 6);
  assert.equal(chooseRemovalFill(countMask(mask)), 'telea');
  const a = inpaintTelea({ width: w, height: h, data: new Uint8ClampedArray(img) }, mask);
  assert.equal(sha(a.data), 'b4de5ba38d6095fc6478fe4df5a2cb19a6535ec6134c0bd591a441b4ac15180f');
});

test('the module imports nothing from the host', async () => {
  const { readFile } = await import('node:fs/promises');
  const module = await WebAssembly.compile(new Uint8Array(await readFile(new URL('../packages/node-shell/wasm/inpaint/inpaint.wasm', import.meta.url))));
  assert.deepEqual(WebAssembly.Module.imports(module), []);
});
