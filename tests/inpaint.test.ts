// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/inpaint.ts - the Telea 2004 fast-marching inpainting port behind
 * Retouch (plans/124 WP-E, Track 1 classical).
 *
 * What is pinned here:
 *   - only masked pixels move: everything outside the mask is byte-identical,
 *     which is what makes the mask-bbox windowing safe
 *   - an empty mask is a pure copy and the caller's buffers are never touched
 *   - determinism: index-broken heap ties give the same bytes on every run
 *   - a flat colour reconstructs exactly, a linear ramp reconstructs close
 *     (accuracy only - both are order-INSENSITIVE, so they cannot catch a
 *     broken march; the rotation-antisymmetry test below is the order guard,
 *     verified to fail under index-order and max-heap mutations of the heap)
 *   - alpha edges: colour is weighted BY alpha, so transparent neighbours
 *     never drag a fill toward black (the straight-alpha fringe bug)
 *   - border masks, a fully masked frame (documented mid-grey), progress
 *
 * Run with: node --test tests/inpaint.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inpaintTelea, type InpaintFrame } from '../engine/src/inpaint.ts';

/** Hand-rolled LCG (Numerical Recipes constants) so the "random" image is fixed. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A blank opaque frame. */
function blank(width: number, height: number): InpaintFrame {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width, height, data };
}

/** A frame painted by a per-pixel callback returning [r,g,b,a]. */
function painted(
  width: number,
  height: number,
  fn: (x: number, y: number) => [number, number, number, number],
): InpaintFrame {
  const f = blank(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fn(x, y);
      const i = (y * width + x) * 4;
      f.data[i] = r;
      f.data[i + 1] = g;
      f.data[i + 2] = b;
      f.data[i + 3] = a;
    }
  }
  return f;
}

/** An all-zero mask covering width*height pixels. */
const emptyMask = (width: number, height: number): Uint8Array => new Uint8Array(width * height);

/** A filled axis-aligned rectangle of mask bytes, clipped to the frame. */
function rectMask(width: number, height: number, x0: number, y0: number, x1: number, y1: number): Uint8Array {
  const m = emptyMask(width, height);
  for (let y = Math.max(0, y0); y <= Math.min(height - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(width - 1, x1); x++) m[y * width + x] = 1;
  }
  return m;
}

test('unmasked pixels are byte-identical to the input', () => {
  const rnd = lcg(0x5eed);
  const W = 64;
  const H = 48;
  const src = painted(W, H, () => [
    Math.floor(rnd() * 256),
    Math.floor(rnd() * 256),
    Math.floor(rnd() * 256),
    255,
  ]);
  const before = Uint8ClampedArray.from(src.data);

  // A round-ish blob, not a rectangle, so the bbox carries unmasked pixels too.
  const mask = emptyMask(W, H);
  const cx = 30;
  const cy = 22;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      const dy = (y - cy) * 1.4;
      if (dx * dx + dy * dy <= 9 * 9) mask[y * W + x] = 255;
    }
  }
  const maskBefore = Uint8Array.from(mask);

  const out = inpaintTelea(src, mask);
  assert.notEqual(out.data, src.data, 'a new buffer is returned');
  assert.deepEqual([...src.data], [...before], 'the input frame is untouched');
  assert.deepEqual([...mask], [...maskBefore], 'the mask is untouched');

  let changedMasked = 0;
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    const same =
      out.data[i] === before[i] &&
      out.data[i + 1] === before[i + 1] &&
      out.data[i + 2] === before[i + 2] &&
      out.data[i + 3] === before[i + 3];
    if (mask[p] === 0) {
      assert.ok(same, `unmasked pixel ${p % W},${Math.floor(p / W)} moved`);
    } else if (!same) {
      changedMasked++;
    }
  }
  assert.ok(changedMasked > 100, `the blob was actually repainted (${changedMasked} pixels changed)`);
});

test('an empty mask returns an identical copy and mutates nothing', () => {
  const rnd = lcg(1234);
  const src = painted(17, 11, () => [
    Math.floor(rnd() * 256),
    Math.floor(rnd() * 256),
    Math.floor(rnd() * 256),
    Math.floor(rnd() * 256),
  ]);
  const before = Uint8ClampedArray.from(src.data);
  const mask = emptyMask(17, 11);

  const out = inpaintTelea(src, mask);
  assert.equal(out.width, 17);
  assert.equal(out.height, 11);
  assert.notEqual(out.data, src.data, 'a new buffer is returned');
  assert.deepEqual([...out.data], [...before]);
  assert.deepEqual([...src.data], [...before], 'the input frame is untouched');
});

test('deterministic: two runs on the same input give byte-identical output', () => {
  const W = 40;
  const H = 40;
  const make = (): InpaintFrame => {
    const r = lcg(99);
    return painted(W, H, () => [
      Math.floor(r() * 256),
      Math.floor(r() * 256),
      Math.floor(r() * 256),
      200 + Math.floor(r() * 56),
    ]);
  };
  const mask = rectMask(W, H, 14, 12, 26, 27);
  const a = inpaintTelea(make(), mask, { radius: 6 });
  const b = inpaintTelea(make(), mask, { radius: 6 });
  assert.deepEqual([...a.data], [...b.data]);
});

test('a hole in a solid colour fills with that colour', () => {
  const W = 48;
  const H = 48;
  const COLOR: [number, number, number, number] = [37, 149, 92, 255];
  const src = painted(W, H, () => [...COLOR] as [number, number, number, number]);
  const mask = rectMask(W, H, 18, 18, 29, 29);

  const out = inpaintTelea(src, mask, { radius: 5 });
  for (let p = 0; p < W * H; p++) {
    if (mask[p] === 0) continue;
    const i = p * 4;
    for (let c = 0; c < 4; c++) {
      const got = out.data[i + c] as number;
      assert.ok(
        Math.abs(got - (COLOR[c] as number)) <= 1,
        `channel ${c} at ${p % W},${Math.floor(p / W)}: got ${got}, want ${COLOR[c]} +/- 1`,
      );
    }
  }
});

test('a hole in a horizontal ramp fills close to the analytic ramp', () => {
  const W = 64;
  const H = 64;
  const ramp = (x: number): number => Math.round((x * 255) / (W - 1));
  const src = painted(W, H, x => [ramp(x), ramp(x), ramp(x), 255]);
  const mask = rectMask(W, H, 28, 28, 35, 35);

  const out = inpaintTelea(src, mask, { radius: 5 });
  let worst = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (mask[y * W + x] === 0) continue;
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        const err = Math.abs((out.data[i + c] as number) - ramp(x));
        if (err > worst) worst = err;
        assert.ok(err <= 24, `at ${x},${y} channel ${c}: got ${out.data[i + c]}, want ~${ramp(x)} (err ${err})`);
      }
      assert.equal(out.data[i + 3], 255, 'alpha survives a fully opaque ramp');
    }
  }
  assert.ok(worst <= 24, `worst ramp error ${worst}`);
});

test('a mask touching the frame border fills from the side that has pixels', () => {
  const W = 32;
  const H = 32;
  const src = painted(W, H, () => [10, 200, 60, 255]);
  // Flush against the top-left corner, so two of the four sides have nothing.
  const mask = rectMask(W, H, 0, 0, 5, 5);

  const out = inpaintTelea(src, mask, { radius: 4 });
  for (let p = 0; p < W * H; p++) {
    if (mask[p] === 0) continue;
    const i = p * 4;
    assert.ok(Math.abs((out.data[i] as number) - 10) <= 1, `r at ${p}: ${out.data[i]}`);
    assert.ok(Math.abs((out.data[i + 1] as number) - 200) <= 1, `g at ${p}: ${out.data[i + 1]}`);
    assert.ok(Math.abs((out.data[i + 2] as number) - 60) <= 1, `b at ${p}: ${out.data[i + 2]}`);
    assert.equal(out.data[i + 3], 255);
  }
});

test('a full-frame mask yields the documented mid-grey and terminates', () => {
  const W = 24;
  const H = 18;
  const src = painted(W, H, () => [200, 30, 30, 128]);
  const mask = new Uint8Array(W * H).fill(1);

  const out = inpaintTelea(src, mask, { radius: 3 });
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    assert.deepEqual(
      [out.data[i], out.data[i + 1], out.data[i + 2], out.data[i + 3]],
      [128, 128, 128, 255],
      `pixel ${p}`,
    );
  }
});

test('onProgress reports non-decreasing counts and ends at (total, total)', () => {
  const W = 96;
  const H = 96;
  const rnd = lcg(7);
  const src = painted(W, H, () => [
    Math.floor(rnd() * 256),
    Math.floor(rnd() * 256),
    Math.floor(rnd() * 256),
    255,
  ]);
  const mask = rectMask(W, H, 10, 10, 79, 79); // 70x70 = 4900 masked, several ticks
  let expectedTotal = 0;
  for (const m of mask) if (m !== 0) expectedTotal++;

  const calls: Array<[number, number]> = [];
  inpaintTelea(src, mask, { radius: 4, onProgress: (filled, total) => calls.push([filled, total]) });

  assert.ok(calls.length >= 2, `several progress calls (${calls.length})`);
  let prev = -1;
  for (const [filled, total] of calls) {
    assert.equal(total, expectedTotal, 'total is the masked-pixel count');
    assert.ok(filled >= prev, `filled is non-decreasing (${prev} then ${filled})`);
    assert.ok(filled <= total, `filled never exceeds total (${filled} > ${total})`);
    prev = filled;
  }
  assert.deepEqual(calls[calls.length - 1], [expectedTotal, expectedTotal], 'the last call is (total, total)');
});

test('onProgress fires once for an empty mask', () => {
  const src = blank(8, 8);
  const calls: Array<[number, number]> = [];
  inpaintTelea(src, emptyMask(8, 8), { onProgress: (f, t) => calls.push([f, t]) });
  assert.deepEqual(calls, [[0, 0]]);
});

test('bad sizes throw a clear error', () => {
  const src = blank(4, 4);
  assert.throws(() => inpaintTelea(src, new Uint8Array(15)), /mask is 15 bytes, expected 16/);
  assert.throws(
    () => inpaintTelea({ width: 4, height: 4, data: new Uint8ClampedArray(60) }, new Uint8Array(16)),
    /frame data is 60 bytes, expected 64/,
  );
  assert.throws(
    () => inpaintTelea({ width: 4.5, height: 4, data: new Uint8ClampedArray(64) }, new Uint8Array(16)),
    /non-negative integers/,
  );
});

test('the radius is clamped to [1, 64] and out-of-range values still fill', () => {
  const W = 32;
  const H = 32;
  const src = painted(W, H, () => [80, 80, 200, 255]);
  const mask = rectMask(W, H, 12, 12, 19, 19);
  for (const radius of [0, -3, 1000, Number.NaN]) {
    const out = inpaintTelea(src, mask, { radius });
    const i = (16 * W + 16) * 4;
    assert.ok(Math.abs((out.data[i + 2] as number) - 200) <= 1, `radius ${radius}: got ${out.data[i + 2]}`);
  }
});

test('a 200x200 window with a 60x60 hole completes quickly', () => {
  const W = 200;
  const H = 200;
  const rnd = lcg(4242);
  const src = painted(W, H, () => [
    Math.floor(rnd() * 256),
    Math.floor(rnd() * 256),
    Math.floor(rnd() * 256),
    255,
  ]);
  const mask = rectMask(W, H, 70, 70, 129, 129);

  const t0 = process.hrtime.bigint();
  const out = inpaintTelea(src, mask, { radius: 5 });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.equal(out.width, W);
  assert.ok(ms < 2000, `60x60 hole inpainted in ${ms.toFixed(1)}ms (budget 2000ms)`);
});

// ── Review-driven guards (2026-08-19 adversarial pass) ───────────────────────

test('marching order: a 180deg-antisymmetric image fills antisymmetrically', () => {
  // The flat and ramp cases are order-insensitive (any local average passes
  // them), so this is the one assertion that actually discriminates the fast
  // march: an image antisymmetric under 180deg rotation (out(p) + out(p') =
  // 255) with a rotation-symmetric mask must fill antisymmetrically too, and
  // only a correct near-to-far march preserves that within a few levels.
  // Measured: the real heap scores worst |out(p)+out(p')-255| ~= 7; an
  // index-order pop scores ~71 and a max-heap (far-first) ~57.
  const w = 48;
  const h = 48;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Radial + angular field, antisymmetric about the centre by construction:
      // v(p) = 127.5 + f(p), where f(rot180(p)) = -f(p).
      const cx = x - (w - 1) / 2;
      const cy = y - (h - 1) / 2;
      const f = 90 * Math.sin(Math.atan2(cy, cx)) * Math.min(1, Math.hypot(cx, cy) / 20);
      const v = Math.round(127.5 + f);
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const mask = new Uint8Array(w * h);
  for (let y = 18; y < 30; y++) for (let x = 18; x < 30; x++) mask[y * w + x] = 1; // centred = rotation-symmetric
  const out = inpaintTelea({ width: w, height: h, data }, mask, { radius: 5 });
  let worst = 0;
  for (let y = 18; y < 30; y++) {
    for (let x = 18; x < 30; x++) {
      const i = (y * w + x) * 4;
      const j = ((h - 1 - y) * w + (w - 1 - x)) * 4;
      worst = Math.max(worst, Math.abs((out.data[i] as number) + (out.data[j] as number) - 255));
    }
  }
  assert.ok(worst <= 20, `antisymmetry error ${worst} > 20 - the march order is broken`);
});

test('alpha edges: transparent neighbours never drag the fill toward black', () => {
  // Straight alpha means a transparent pixel's RGB is arbitrary (0,0,0,0 from
  // getImageData). Colour must therefore be weighted BY alpha: filling a
  // stroke that straddles an opaque-red/transparent seam must stay pure red
  // wherever the filled alpha is meaningful, not premultiplied-dark red.
  const w = 40;
  const h = 20;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (x < 20) { data[i] = 255; data[i + 3] = 255; } // opaque red; x >= 20 stays (0,0,0,0)
    }
  }
  const mask = new Uint8Array(w * h);
  for (let y = 6; y < 14; y++) for (let x = 16; x < 24; x++) mask[y * w + x] = 1;
  const out = inpaintTelea({ width: w, height: h, data }, mask, { radius: 5 });
  for (let y = 6; y < 14; y++) {
    for (let x = 16; x < 24; x++) {
      const i = (y * w + x) * 4;
      const a = out.data[i + 3] as number;
      const r = out.data[i] as number;
      if (a > 32) {
        assert.ok(r >= 230, `filled pixel (${x},${y}) has a=${a} but r=${r} - colour tracked alpha (the black-fringe bug)`);
      }
      assert.equal(out.data[i + 1], 0, 'green stays zero');
    }
  }
});
