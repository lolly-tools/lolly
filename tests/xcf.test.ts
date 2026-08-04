// SPDX-License-Identifier: MPL-2.0
/**
 * XCF reader (engine/src/xcf.ts). There is no engine XCF writer (deliberate —
 * see the psd-write.ts header's conversion story), so fixtures come from
 * buildXcf() below: a minimal two-pass XCF byte builder covering v001 (4-byte
 * pointers, RLE/none tiles) and v011 (8-byte pointers, zlib tiles via the
 * engine's own zlibCompress). The builder is also the fuzz seed source
 * (tests/fuzz/targets.ts imports it via tests/helpers/xcf-fixture.ts).
 *
 * Run with: node --test tests/xcf.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { XcfUnsupportedError, isXcf, readXcf } from '../engine/src/xcf.ts';
import type { InflateFn } from '../engine/src/raster-layers.ts';
import { type XcfFixtureLayer, buildXcf } from './helpers/xcf-fixture.ts';

const inflate: InflateFn = (bytes, maxOut) => {
  const out = inflateSync(bytes, { maxOutputLength: maxOut });
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
};

/** Deterministic RGBA for a w×h layer. */
function pix(w: number, h: number, seed = 1): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = (i * seed + 40) & 0xff;
    out[i + 1] = (i * seed * 5 + 3) & 0xff;
    out[i + 2] = (i * 11 + seed) & 0xff;
    out[i + 3] = 255;
  }
  return out;
}

test('xcf: isXcf accepts file/v001/v011 tokens, refuses others', () => {
  assert.equal(isXcf(buildXcf({ version: 1, width: 2, height: 2, layers: [] })), true);
  assert.equal(isXcf(buildXcf({ version: 11, width: 2, height: 2, layers: [] })), true);
  const bad = buildXcf({ version: 1, width: 2, height: 2, layers: [] }).slice();
  bad[0] = 0x47; // break the magic
  assert.equal(isXcf(bad), false);
  const badTok = buildXcf({ version: 1, width: 2, height: 2, layers: [] }).slice();
  badTok[9] = 0x78; // 'x001' is not a version token
  assert.equal(isXcf(badTok), false);
  assert.equal(isXcf(new Uint8Array(4)), false);
});

test('xcf: v001 RLE — geometry, order reversal, opacity, mode, visibility, pixels', () => {
  const topPix = pix(6, 4, 3);
  const botPix = pix(8, 8, 1);
  const layers: XcfFixtureLayer[] = [
    // File order is TOP first.
    { name: 'top layer', width: 6, height: 4, pixels: topPix, x: -2, y: 3, opacity255: 128, mode: 30, visible: false },
    { name: 'bottom', width: 8, height: 8, pixels: botPix, x: 0, y: 0, mode: 28 },
  ];
  const bytes = buildXcf({ version: 1, width: 8, height: 8, layers, compression: 1 });
  const warns: string[] = [];
  const doc = readXcf(bytes, { onWarn: (c) => warns.push(c) });

  assert.deepEqual(warns, [], 'clean fixture must read without warnings');
  assert.equal(doc.format, 'xcf');
  assert.equal(doc.width, 8);
  assert.equal(doc.height, 8);
  assert.equal(doc.depth, 8);
  assert.equal(doc.composite, undefined, 'XCF stores no composite');
  assert.equal(doc.layers.length, 2);

  // Returned bottom-to-top.
  const [bottom, top] = doc.layers as [typeof doc.layers[0], typeof doc.layers[0]];
  assert.equal(bottom.name, 'bottom');
  assert.equal(bottom.blend, 'normal');
  assert.equal(bottom.visible, true);
  assert.deepEqual(bottom.pixels, botPix);

  assert.equal(top.name, 'top layer');
  assert.equal(top.x, -2);
  assert.equal(top.y, 3);
  assert.equal(top.width, 6);
  assert.equal(top.height, 4);
  assert.ok(Math.abs(top.opacity - 128 / 255) < 1e-6);
  assert.equal(top.blend, 'multiply');
  assert.equal(top.blendRaw, 'xcf:30');
  assert.equal(top.blendLossy, false);
  assert.equal(top.visible, false);
  assert.deepEqual(top.pixels, topPix);
});

test('xcf: v011 zlib + wide pointers + float opacity', () => {
  const px = pix(70, 65, 7); // spans multiple 64px tiles
  const bytes = buildXcf({
    version: 11,
    width: 70,
    height: 65,
    compression: 2,
    layers: [{ name: 'ζlib layer', width: 70, height: 65, pixels: px, floatOpacity: 0.25, mode: 31 }],
  });
  const doc = readXcf(bytes, { inflate });
  assert.equal(doc.layers.length, 1);
  const l = doc.layers[0]!;
  assert.equal(l.name, 'ζlib layer');
  assert.ok(Math.abs(l.opacity - 0.25) < 1e-6);
  assert.equal(l.blend, 'screen');
  assert.deepEqual(l.pixels, px);
});

test('xcf: zlib tiles without an injected inflate degrade with a warning', () => {
  const bytes = buildXcf({
    version: 11,
    width: 4,
    height: 4,
    compression: 2,
    layers: [{ name: 'z', width: 4, height: 4, pixels: pix(4, 4) }],
  });
  const warns: string[] = [];
  const doc = readXcf(bytes, { onWarn: (c) => warns.push(c) });
  assert.ok(warns.includes('tile.zlib.skipped'));
  const l = doc.layers[0]!;
  // Geometry survives; pixels are the transparent fallback.
  assert.equal(l.width, 4);
  assert.ok(l.pixels.every((b) => b === 0));
});

test('xcf: uncompressed tiles (PROP_COMPRESSION 0)', () => {
  const px = pix(5, 3, 2);
  const bytes = buildXcf({
    version: 1,
    width: 5,
    height: 3,
    compression: 0,
    layers: [{ name: 'raw', width: 5, height: 3, pixels: px }],
  });
  const doc = readXcf(bytes);
  assert.deepEqual(doc.layers[0]!.pixels, px);
});

test('xcf: grayscale and gray-alpha layers normalise to RGBA', () => {
  // Gray base: layer type Gray (2) — builder derives planes from RGBA input's R.
  const px = new Uint8Array([
    10, 10, 10, 255, 200, 200, 200, 255,
    90, 90, 90, 255, 0, 0, 0, 255,
  ]);
  const bytes = buildXcf({
    version: 1,
    width: 2,
    height: 2,
    baseType: 1,
    layers: [{ name: 'g', width: 2, height: 2, pixels: px, layerType: 2 }],
  });
  const doc = readXcf(bytes);
  assert.equal(doc.colorMode, 'gray');
  assert.deepEqual(doc.layers[0]!.pixels, px);
});

test('xcf: groups via PROP_GROUP_ITEM + PROP_ITEM_PATH', () => {
  const bytes = buildXcf({
    version: 11,
    width: 4,
    height: 4,
    compression: 0,
    layers: [
      // Top-down: group, then its member, then a root-level layer.
      { name: 'Group', width: 4, height: 4, pixels: pix(4, 4), isGroup: true, itemPath: [0] },
      { name: 'inside', width: 4, height: 4, pixels: pix(4, 4, 2), itemPath: [0, 0] },
      { name: 'root', width: 4, height: 4, pixels: pix(4, 4, 3), itemPath: [1] },
    ],
  });
  const doc = readXcf(bytes, { inflate });
  assert.equal(doc.layers.length, 3);
  // Bottom-to-top: root, inside, Group.
  const [root, inside, group] = doc.layers as [typeof doc.layers[0], typeof doc.layers[0], typeof doc.layers[0]];
  assert.equal(root.name, 'root');
  assert.deepEqual(root.groupPath, []);
  assert.equal(group.name, 'Group');
  assert.equal(group.isGroup, true);
  assert.equal(inside.name, 'inside');
  assert.deepEqual(inside.groupPath, [doc.layers.indexOf(group)]);
});

test('xcf: 16-bit non-linear precision folds to 8-bit', () => {
  const px = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]); // 1x2 RGBA
  const bytes = buildXcf({
    version: 11,
    width: 1,
    height: 2,
    precision: 250,
    compression: 0,
    layers: [{ name: 'deep', width: 1, height: 2, pixels: px, sampleBytes: 2 }],
  });
  const doc = readXcf(bytes, { inflate });
  assert.equal(doc.depth, 16);
  assert.deepEqual(doc.layers[0]!.pixels, px);
});

test('xcf: layer mask multiplies into alpha when PROP_APPLY_MASK set', () => {
  const px = new Uint8Array(2 * 2 * 4).fill(255);
  const mask = new Uint8Array([255, 128, 0, 64]);
  const bytes = buildXcf({
    version: 1,
    width: 2,
    height: 2,
    compression: 0,
    layers: [{ name: 'masked', width: 2, height: 2, pixels: px, mask, applyMask: true }],
  });
  const doc = readXcf(bytes);
  const a = doc.layers[0]!.pixels;
  assert.deepEqual([a[3], a[7], a[11], a[15]], [255, 128, 0, 64]);
});

test('xcf: refusals are typed with honest codes', () => {
  assert.throws(() => readXcf(new Uint8Array([1, 2, 3])), (e: unknown) =>
    e instanceof XcfUnsupportedError && e.code === 'not-xcf');
  // Float precision refused.
  const float = buildXcf({ version: 11, width: 2, height: 2, precision: 600, layers: [] });
  assert.throws(() => readXcf(float, { inflate }), (e: unknown) =>
    e instanceof XcfUnsupportedError && e.code === 'precision');
  // Dimension lie.
  const big = buildXcf({ version: 1, width: 2, height: 2, layers: [] }).slice();
  new DataView(big.buffer, big.byteOffset).setUint32(14, 400_000);
  assert.throws(() => readXcf(big), (e: unknown) =>
    e instanceof XcfUnsupportedError && e.code === 'bounds');
});

test('xcf: a newer version parses with a warning (v012 attempted as v011)', () => {
  const bytes = buildXcf({
    version: 12,
    width: 3,
    height: 3,
    compression: 0,
    layers: [{ name: 'future', width: 3, height: 3, pixels: pix(3, 3) }],
  });
  const warns: string[] = [];
  const doc = readXcf(bytes, { onWarn: (c) => warns.push(c) });
  assert.ok(warns.includes('version.newer'));
  assert.deepEqual(doc.layers[0]!.pixels, pix(3, 3));
});

test('xcf: truncation degrades or refuses typed — never an uncontrolled throw', () => {
  const full = buildXcf({
    version: 1,
    width: 8,
    height: 8,
    compression: 1,
    layers: [{ name: 'L', width: 8, height: 8, pixels: pix(8, 8) }],
  });
  for (let cut = 14; cut < full.length; cut += 5) {
    try {
      const doc = readXcf(full.subarray(0, cut));
      assert.ok(Array.isArray(doc.warnings));
    } catch (e) {
      assert.ok(e instanceof XcfUnsupportedError, `uncontrolled throw at cut ${cut}: ${String(e)}`);
    }
  }
});

test('xcf: an invalid tile pointer yields a transparent tile + warning, not a crash', () => {
  const bytes = buildXcf({
    version: 1,
    width: 4,
    height: 4,
    compression: 0,
    layers: [{ name: 'x', width: 4, height: 4, pixels: pix(4, 4) }],
  }).slice();
  // The single tile pointer is the last 4-byte pointer before the tile data;
  // scan for a plausible pointer and stomp it out of range.
  // (The builder writes the tile table immediately before the tile bytes.)
  const doc0 = readXcf(bytes); // sanity: intact first
  assert.ok(doc0.layers[0]!.pixels.some((b) => b !== 0));
  // Corrupt: find the level's tile pointer by rebuilding with a poisoned table.
  const poisoned = buildXcf({
    version: 1,
    width: 4,
    height: 4,
    compression: 0,
    layers: [{ name: 'x', width: 4, height: 4, pixels: pix(4, 4), poisonTilePtr: true }],
  });
  const warns: string[] = [];
  const doc = readXcf(poisoned, { onWarn: (c) => warns.push(c) });
  assert.ok(warns.includes('tile.bad'));
  assert.ok(doc.layers[0]!.pixels.every((b) => b === 0));
});

test('xcf: decode budget skips layers before allocating', () => {
  const bytes = buildXcf({
    version: 1,
    width: 16,
    height: 16,
    compression: 0,
    layers: [
      { name: 'a', width: 16, height: 16, pixels: pix(16, 16) },
      { name: 'b', width: 16, height: 16, pixels: pix(16, 16, 2) },
    ],
  });
  const warns: string[] = [];
  const doc = readXcf(bytes, { maxDecodedBytes: 2200, onWarn: (c) => warns.push(c) });
  assert.ok(warns.includes('decode.budget.exhausted'));
  assert.equal(doc.layers.length, 2);
  assert.ok(doc.layers.some((l) => l.pixels.length === 0));
});
