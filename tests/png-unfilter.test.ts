// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for engine/src/png-unfilter.ts — unfilterPng(), the pure, DOM-free
 * reversal of PNG row filters (types 0 None, 1 Sub, 2 Up, 3 Average, 4 Paeth)
 * that PDF /Predictor >= 10 (and jsPDF's addImage(png,'PNG'), /Predictor 15)
 * apply before DEFLATE.
 *
 * The per-filter cases below carry HAND-COMPUTED filtered inputs and HAND-COMPUTED
 * expected outputs as literals — the assertion is NOT unfilterPng vs its own
 * inverse. The RGB round-trip additionally filters with an independent forward
 * implementation written in this file.
 *
 * Run with: node --test tests/png-unfilter.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { unfilterPng } from '../engine/src/png-unfilter.ts';

const u8 = (...xs: number[]): Uint8Array => Uint8Array.from(xs);

// ── per-filter cases, all values worked out by hand ──────────────────────────

test('filter 0 (None) — samples pass through, filter tags stripped', () => {
  // 2×2, bpp=1. Rows: [0][10 20] [0][30 40]
  const got = unfilterPng(u8(0, 10, 20, 0, 30, 40), 2, 2, 1);
  assert.deepEqual([...got!], [10, 20, 30, 40]);
});

test('filter 1 (Sub) — left neighbour, bpp=1', () => {
  // 3×1, bpp=1. raw=[10,20,45] → filt=[10, 20-10=10, 45-20=25]
  const got = unfilterPng(u8(1, 10, 10, 25), 3, 1, 1);
  assert.deepEqual([...got!], [10, 20, 45]);
});

test('filter 1 (Sub) — byte wrap-around (raw < left)', () => {
  // 2×1, bpp=1. raw=[200,10] → filt=[200, (10-200)&255=66]; decode wraps back.
  const got = unfilterPng(u8(1, 200, 66), 2, 1, 1);
  assert.deepEqual([...got!], [200, 10]);
});

test('filter 2 (Up) — row above, bpp=1', () => {
  // 2×2, bpp=1. row0 None [50 60]; row1 Up: filt=[55-50=5, 90-60=30]
  const got = unfilterPng(u8(0, 50, 60, 2, 5, 30), 2, 2, 1);
  assert.deepEqual([...got!], [50, 60, 55, 90]);
});

test('filter 3 (Average) — floor((left+above)/2), bpp=1', () => {
  // 2×2, bpp=1. row0 None [8 40]; row1 Average:
  //   x0: a=0,b=8  → floor(8/2)=4  → filt=20-4=16
  //   x1: a=20,b=40→ floor(60/2)=30→ filt=100-30=70
  const got = unfilterPng(u8(0, 8, 40, 3, 16, 70), 2, 2, 1);
  assert.deepEqual([...got!], [8, 40, 20, 100]);
});

test('filter 4 (Paeth) — bpp=1', () => {
  // 2×2, bpp=1. row0 None [10 20]; row1 Paeth:
  //   x0: a=0,b=10,c=0  → Paeth=10 → filt=14-10=4
  //   x1: a=14,b=20,c=10→ Paeth=20 → filt=33-20=13
  const got = unfilterPng(u8(0, 10, 20, 4, 4, 13), 2, 2, 1);
  assert.deepEqual([...got!], [10, 20, 14, 33]);
});

test('filter 4 (Paeth) — bpp=3, left neighbour is 3 bytes back', () => {
  // 1×2, bpp=3 (single RGB row, 2 pixels). row0 uses Paeth.
  //   pixel0 (x=0..2): a=0,b=0,c=0 → Paeth=0 → filt = raw = [10,20,30]
  //   pixel1 (x=3..5): a = out of pixel0 same channel, b=0, c=0 → Paeth=a
  //     x3: a=10 → filt=40-10=30 ; x4: a=20 → filt=55-20=35 ; x5: a=30 → filt=70-30=40
  const got = unfilterPng(u8(4, 10, 20, 30, 30, 35, 40), 2, 1, 3);
  assert.deepEqual([...got!], [10, 20, 30, 40, 55, 70]);
});

// ── RGB round-trip via an INDEPENDENT forward filter ─────────────────────────

// Forward PNG filter (encode) — reference impl written here, does NOT call
// unfilterPng. Applies one filter type to every row of an 8bpc image.
function forwardFilter(raw: Uint8Array, w: number, h: number, bpp: number, filter: number): Uint8Array {
  const rowBytes = w * bpp;
  const out = new Uint8Array((rowBytes + 1) * h);
  const at = (row: number, x: number): number => (row < 0 || x < 0 || x >= rowBytes ? 0 : raw[row * rowBytes + x]!);
  const paeth = (a: number, b: number, c: number): number => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    out[y * (rowBytes + 1)] = filter;
    for (let x = 0; x < rowBytes; x++) {
      const cur = at(y, x);
      const a = x >= bpp ? at(y, x - bpp) : 0;
      const b = y > 0 ? at(y - 1, x) : 0;
      const c = y > 0 && x >= bpp ? at(y - 1, x - bpp) : 0;
      let pred: number;
      switch (filter) {
        case 1: pred = a; break;
        case 2: pred = b; break;
        case 3: pred = (a + b) >> 1; break;
        case 4: pred = paeth(a, b, c); break;
        default: pred = 0; break;
      }
      out[y * (rowBytes + 1) + 1 + x] = (cur - pred) & 0xff;
    }
  }
  return out;
}

test('RGB round-trip — every filter type reconstructs the original image', () => {
  const w = 4, h = 3, bpp = 3;
  const raw = new Uint8Array(w * h * bpp);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 37 + 11) & 0xff; // deterministic content
  for (const filter of [0, 1, 2, 3, 4]) {
    const filtered = forwardFilter(raw, w, h, bpp, filter);
    const back = unfilterPng(filtered, w, h, bpp);
    assert.ok(back, `filter ${filter} returned null`);
    assert.deepEqual([...back!], [...raw], `filter ${filter} mismatch`);
  }
});

// ── defensive contract: never throws, returns null on bad input ──────────────

test('truncated buffer → null', () => {
  // needs stride(3)*height(1)=3 bytes; only 2 present.
  assert.equal(unfilterPng(u8(0, 1), 2, 1, 1), null);
});

test('unknown filter tag → null', () => {
  assert.equal(unfilterPng(u8(5, 1, 2), 2, 1, 1), null);
});

test('non-positive dimensions → null', () => {
  assert.equal(unfilterPng(u8(0, 1, 2), 0, 1, 1), null);
  assert.equal(unfilterPng(u8(0, 1, 2), 2, 0, 1), null);
  assert.equal(unfilterPng(u8(0, 1, 2), 2, 1, 0), null);
});

test('empty input → null (no throw)', () => {
  assert.equal(unfilterPng(new Uint8Array(0), 2, 2, 1), null);
});
