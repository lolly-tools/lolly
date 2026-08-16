// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the PURE soft-mask helpers (engine/src/pdf-smask.ts) - the geometry
 * and colour arithmetic around ExtGState /SMask evaluation, tested away from the
 * interpreter that drives them.
 *
 * Run with: node --test tests/pdf-smask.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  constantMask, isAchromatic, isShadowPlate, maskRegion, relativeLuminance,
} from '../engine/src/pdf-smask.ts';
import type { PdfNode } from '../engine/src/pdf-map.ts';

const I = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const near = (a: number, b: number, eps = 0.01): boolean => Math.abs(a - b) <= eps;

// ── maskRegion ────────────────────────────────────────────────────────────────

test('maskRegion: identity transform → the bbox itself, as AABB + quad clip', () => {
  const r = maskRegion([10, 20, 110, 80], I);
  assert.ok(r);
  assert.ok(near(r.x, 10) && near(r.y, 20) && near(r.w, 100) && near(r.h, 60), JSON.stringify(r));
  // The clip is the true traversed quad, closed.
  assert.equal(r.clip.d, 'M10 20L110 20L110 80L10 80Z');
  assert.equal(r.clip.evenOdd, false);
});

test('maskRegion: a y-flip still yields a positive-extent region', () => {
  // The page flip the interpreter seeds: d = -1, f = pageHeight.
  const r = maskRegion([0, 100, 50, 200], { a: 1, b: 0, c: 0, d: -1, e: 0, f: 300 });
  assert.ok(r);
  assert.ok(near(r.y, 100) && near(r.h, 100), JSON.stringify(r));
});

test('maskRegion: a rotation widens the AABB but the clip keeps the real quad', () => {
  const m = { a: 0.7, b: 0.7, c: -0.7, d: 0.7, e: 0, f: 0 };
  const r = maskRegion([0, 0, 100, 100], m);
  assert.ok(r);
  // 100x100 rotated 45° → a 140x140 AABB.
  assert.ok(near(r.w, 140, 0.5) && near(r.h, 140, 0.5), `${r.w}x${r.h}`);
  // Four distinct corners, none of them axis-aligned with each other.
  assert.equal((r.clip.d.match(/L/g) || []).length, 3);
  assert.ok(r.clip.d.includes('-70'), r.clip.d);
});

test('maskRegion: degenerate + hostile inputs are refused, never thrown', () => {
  for (const bad of [
    undefined, [], [1, 2, 3], [NaN, 0, 10, 10], [0, 0, Infinity, 0],
    [0, 0, 0, 0], [0, 0, 0.001, 5],
  ]) {
    assert.equal(maskRegion(bad as number[] | undefined, I), null, JSON.stringify(bad));
  }
  assert.equal(maskRegion([0, 0, 10, 10], { a: NaN, b: 0, c: 0, d: 1, e: 0, f: 0 }), null);
  assert.equal(maskRegion([0, 0, 10, 10], { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 }), null);
});

// ── relativeLuminance / isAchromatic ─────────────────────────────────────────

test('relativeLuminance: a DeviceGray mask value maps to ITSELF (the exact case)', () => {
  // /Luminosity of a grey (g,g,g) is g, and Rec.709 over sRGB gives 0.2126g +
  // 0.7152g + 0.0722g = g. That identity is what makes the constant-fold rung and
  // an un-folded <mask> agree.
  for (const v of [0, 0x40, 0x80, 0xc0, 0xff]) {
    const hex = '#' + v.toString(16).padStart(2, '0').repeat(3);
    assert.ok(near(relativeLuminance(hex), v / 255, 0.002), `${hex} → ${relativeLuminance(hex)}`);
  }
});

test('relativeLuminance: green weighs most, blue least; junk is 0', () => {
  assert.ok(relativeLuminance('#00ff00') > relativeLuminance('#ff0000'));
  assert.ok(relativeLuminance('#ff0000') > relativeLuminance('#0000ff'));
  assert.equal(relativeLuminance('none'), 0);
  assert.equal(relativeLuminance(''), 0);
  assert.equal(relativeLuminance('url(#x)'), 0);
});

test('isAchromatic: neutrals and unresolved paints yes, brand colours no', () => {
  assert.ok(isAchromatic('#000000'));
  assert.ok(isAchromatic('#0e1217'));   // the shadow ink Chromium prints
  assert.ok(isAchromatic(''));          // an unresolved paint isn't content we vouch for
  assert.ok(!isAchromatic('#30ba78'));  // SUSE green
});

// ── constantMask ─────────────────────────────────────────────────────────────

const rect = (o: Partial<PdfNode> = {}): PdfNode =>
  ({ kind: 'box', shape: 'rect', x: 0, y: 0, w: 100, h: 100, rot: 0, fill: '#808080', ...o }) as PdfNode;

test('constantMask: one flat rect over the bbox folds to its luminance', () => {
  const v = constantMask([rect()], { w: 100, h: 100 });
  assert.ok(v != null);
  assert.ok(near(v, 128 / 255, 0.002), String(v));
});

test('constantMask: the rect’s own opacity multiplies in', () => {
  const v = constantMask([rect({ fill: '#ffffff', opacity: 40 })], { w: 100, h: 100 });
  assert.ok(v != null && near(v, 0.4, 0.005), String(v));
});

test('constantMask: anything that is a SHAPE rather than a constant is refused', () => {
  // partial coverage - a shape
  assert.equal(constantMask([rect({ w: 50, h: 50 })], { w: 100, h: 100 }), null);
  // two nodes
  assert.equal(constantMask([rect(), rect()], { w: 100, h: 100 }), null);
  // a raster / a gradient / a vector path
  assert.equal(constantMask([rect({ _imageXObject: 'm0' })], { w: 100, h: 100 }), null);
  assert.equal(constantMask([rect({ _gradient: {} as never })], { w: 100, h: 100 }), null);
  assert.equal(constantMask([rect({ _vectorPath: 'M0 0Z' })], { w: 100, h: 100 }), null);
  // an ellipse, text, no fill, no region
  assert.equal(constantMask([rect({ shape: 'ellipse' })], { w: 100, h: 100 }), null);
  assert.equal(constantMask([rect({ kind: 'text' })], { w: 100, h: 100 }), null);
  assert.equal(constantMask([rect({ fill: '' })], { w: 100, h: 100 }), null);
  assert.equal(constantMask([rect()], { w: 0, h: 100 }), null);
  assert.equal(constantMask([], { w: 100, h: 100 }), null);
});

// ── isShadowPlate ────────────────────────────────────────────────────────────

const mask = { key: 'k', nodes: [], x: 0, y: 0, w: 10, h: 10, subtype: 'Luminosity' as const };

test('isShadowPlate: masked + translucent + achromatic only', () => {
  assert.ok(isShadowPlate(rect({ fill: '#000000', opacity: 28, _softMask: mask })));
  // unmasked: an ordinary translucent grey is real content
  assert.ok(!isShadowPlate(rect({ fill: '#000000', opacity: 28 })));
  // opaque: real content that happens to be masked (a rounded swatch tile)
  assert.ok(!isShadowPlate(rect({ fill: '#000000', opacity: 100, _softMask: mask })));
  // chromatic: a translucent brand tint under a mask
  assert.ok(!isShadowPlate(rect({ fill: '#30ba78', opacity: 28, _softMask: mask })));
  // a masked translucent vector path counts too (a shadow ring)
  assert.ok(isShadowPlate({ kind: 'image', x: 0, y: 0, w: 9, h: 9, rot: 0, opacity: 20, _vectorPath: 'M0 0Z', _vectorFill: '#0e1217', _softMask: mask } as PdfNode));
});
