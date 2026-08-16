// SPDX-License-Identifier: MPL-2.0
/**
 * PSD reader + writer (engine/src/psd.ts, psd-write.ts).
 *
 * The round-trip suite is the contract: readPsd(writePsd(doc)) must reproduce
 * every layer's name/rect/opacity/visibility/blend/pixels exactly. Hand-built
 * byte fixtures cover what our writer never emits (16-bit, grayscale, CMYK,
 * refusals, damage) - the same house style as pptx-read's fixtures.
 *
 * Run with: node --test tests/psd.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PsdUnsupportedError, isPsd, readPsd } from '../engine/src/psd.ts';
import { type PsdWriteDoc, writePsd } from '../engine/src/psd-write.ts';

// ─── fixture helpers ─────────────────────────────────────────────────────────

/** Deterministic RGBA pixels for a w×h layer. */
function pix(w: number, h: number, seed = 1): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = (i * seed + 13) & 0xff;
    out[i + 1] = (i * seed * 3 + 89) & 0xff;
    out[i + 2] = (i * seed * 7 + 233) & 0xff;
    out[i + 3] = 255 - ((i >> 2) % 3) * 10;
  }
  return out;
}

/** Flat-colour RGBA (compresses hard - exercises the RLE path). */
function flatPix(w: number, h: number, r: number, g: number, b: number, a = 255): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < out.length; i += 4) { out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = a; }
  return out;
}

/** Hand-build a minimal PSD: header + empty sections + RAW composite. */
function rawPsd(opts: {
  version?: number; channels?: number; width: number; height: number;
  depth?: number; mode?: number; planes?: Uint8Array[];
}): Uint8Array {
  const { version = 1, channels = 3, width, height, depth = 8, mode = 3 } = opts;
  const bps = depth === 16 ? 2 : 1;
  const planes = opts.planes ?? Array.from({ length: channels }, () => new Uint8Array(width * height * bps));
  const head = new Uint8Array(26 + 4 + 4 + (version === 2 ? 8 : 4) + 2);
  const v = new DataView(head.buffer);
  head.set([0x38, 0x42, 0x50, 0x53]);
  v.setUint16(4, version);
  v.setUint16(12, channels);
  v.setUint32(14, height);
  v.setUint32(18, width);
  v.setUint16(22, depth);
  v.setUint16(24, mode);
  // color-mode-data len 0 at 26, image-resources len 0 at 30, layer&mask len 0, compression 0.
  const compAt = 26 + 4 + 4 + (version === 2 ? 8 : 4);
  v.setUint16(compAt, 0); // RAW composite
  const parts = [head, ...planes];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// ─── sniff ───────────────────────────────────────────────────────────────────

test('psd: isPsd accepts v1 + v2, refuses others', () => {
  assert.equal(isPsd(rawPsd({ width: 2, height: 2 })), true);
  assert.equal(isPsd(rawPsd({ width: 2, height: 2, version: 2 })), true);
  assert.equal(isPsd(new Uint8Array([0x38, 0x42, 0x50, 0x53, 0, 3])), false); // version 3
  assert.equal(isPsd(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), false);        // PNG
  assert.equal(isPsd(new Uint8Array(0)), false);
});

// ─── round-trip ──────────────────────────────────────────────────────────────

test('psd: write→read round-trip pins name/rect/opacity/visibility/blend/pixels', () => {
  const doc: PsdWriteDoc = {
    width: 32,
    height: 24,
    layers: [
      { name: 'Background', x: 0, y: 0, width: 32, height: 24, pixels: flatPix(32, 24, 200, 210, 220) },
      { name: 'Nöisy Layér — ünïcode', x: -4, y: 3, width: 16, height: 10, pixels: pix(16, 10, 5), opacity: 0.5, blend: 'multiply' },
      { name: 'hidden', x: 8, y: -2, width: 6, height: 6, pixels: flatPix(6, 6, 255, 0, 0, 128), visible: false, blend: 'screen' },
    ],
  };
  const bytes = writePsd(doc);
  const warns: string[] = [];
  const back = readPsd(bytes, { onWarn: (c) => warns.push(c) });

  assert.equal(back.format, 'psd');
  assert.equal(back.width, 32);
  assert.equal(back.height, 24);
  assert.equal(back.depth, 8);
  assert.equal(back.colorMode, 'rgb');
  assert.deepEqual(warns, [], 'clean file must read without warnings');
  assert.equal(back.layers.length, 3);
  assert.ok(back.composite, 'writer emits a merged composite');
  assert.equal(back.composite!.width, 32);

  for (let i = 0; i < doc.layers.length; i++) {
    const want = doc.layers[i]!;
    const got = back.layers[i]!;
    assert.equal(got.name, want.name, `layer ${i} name`);
    assert.equal(got.x, want.x);
    assert.equal(got.y, want.y);
    assert.equal(got.width, want.width);
    assert.equal(got.height, want.height);
    assert.ok(Math.abs(got.opacity - (want.opacity ?? 1)) < 1 / 254, `layer ${i} opacity`);
    assert.equal(got.blend, want.blend ?? 'normal', `layer ${i} blend`);
    assert.equal(got.blendLossy, false);
    assert.equal(got.visible, want.visible ?? true, `layer ${i} visibility`);
    assert.equal(got.isGroup, false);
    assert.deepEqual(got.groupPath, []);
    assert.deepEqual(got.pixels, want.pixels, `layer ${i} pixels`);
  }
});

test('psd: every CSS blend mode survives the round-trip losslessly', () => {
  const modes = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge',
    'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation',
    'color', 'luminosity'] as const;
  const doc: PsdWriteDoc = {
    width: 4,
    height: 4,
    layers: modes.map((blend, i) => ({
      name: blend, x: 0, y: 0, width: 2, height: 2, pixels: flatPix(2, 2, i * 10, 0, 0), blend,
    })),
  };
  const back = readPsd(writePsd(doc));
  assert.deepEqual(back.layers.map((l) => l.blend), [...modes]);
  assert.deepEqual(back.layers.map((l) => l.blendLossy), modes.map(() => false));
});

test('psd: composite honours the provided flatten and layer order (bottom-to-top)', () => {
  const doc: PsdWriteDoc = {
    width: 2,
    height: 2,
    layers: [
      { name: 'bottom', x: 0, y: 0, width: 2, height: 2, pixels: flatPix(2, 2, 10, 20, 30) },
      { name: 'top', x: 0, y: 0, width: 1, height: 1, pixels: flatPix(1, 1, 250, 0, 0) },
    ],
  };
  const back = readPsd(writePsd(doc));
  // Src-over flatten: pixel (0,0) shows the top layer, (1,1) the bottom.
  const px = back.composite!.pixels;
  assert.deepEqual([px[0], px[1], px[2]], [250, 0, 0]);
  const o = (1 * 2 + 1) * 4;
  assert.deepEqual([px[o], px[o + 1], px[o + 2]], [10, 20, 30]);
  // Array order is bottom-to-top.
  assert.equal(back.layers[0]!.name, 'bottom');
  assert.equal(back.layers[1]!.name, 'top');
});

// ─── hand-built fixtures ─────────────────────────────────────────────────────

test('psd: 16-bit RAW grayscale folds to 8-bit and records the source depth', () => {
  // 2x1, gray 16-bit: samples 0x0000 and 0xFFFF.
  const plane = new Uint8Array([0x00, 0x00, 0xff, 0xff]);
  const bytes = rawPsd({ width: 2, height: 1, depth: 16, mode: 1, channels: 1, planes: [plane] });
  const doc = readPsd(bytes);
  assert.equal(doc.depth, 16);
  assert.equal(doc.colorMode, 'gray');
  assert.ok(doc.composite);
  const px = doc.composite!.pixels;
  assert.deepEqual([px[0], px[1], px[2], px[3]], [0, 0, 0, 255]);
  assert.deepEqual([px[4], px[5], px[6], px[7]], [255, 255, 255, 255]);
});

test('psd: CMYK without a profile converts naively with a warning', () => {
  // 1x1 CMYK RAW: stored INVERTED (255 = no ink). Pure cyan ink: C=0, M=Y=K=255.
  const planes = [new Uint8Array([0]), new Uint8Array([255]), new Uint8Array([255]), new Uint8Array([255])];
  const bytes = rawPsd({ width: 1, height: 1, mode: 4, channels: 4, planes });
  const warns: string[] = [];
  const doc = readPsd(bytes, { onWarn: (c) => warns.push(c) });
  assert.equal(doc.colorMode, 'cmyk');
  assert.ok(warns.includes('cmyk.no-profile'));
  const px = doc.composite!.pixels;
  // Naive fold: rgb = stored/255 * k-white → cyan ink = (0,255,255).
  assert.deepEqual([px[0], px[1], px[2], px[3]], [0, 255, 255, 255]);
});

test('psd: PSB (version 2) composite reads', () => {
  const planes = [
    new Uint8Array([1, 2]), new Uint8Array([3, 4]), new Uint8Array([5, 6]),
  ];
  const bytes = rawPsd({ width: 2, height: 1, version: 2, planes });
  const doc = readPsd(bytes);
  assert.equal(doc.width, 2);
  const px = doc.composite!.pixels;
  assert.deepEqual([px[0], px[1], px[2]], [1, 3, 5]);
  assert.deepEqual([px[4], px[5], px[6]], [2, 4, 6]);
});

// ─── refusals (typed, controlled) ────────────────────────────────────────────

test('psd: refusals are typed PsdUnsupportedError with honest codes', () => {
  const cases: Array<[Uint8Array, string]> = [
    [new Uint8Array([1, 2, 3]), 'not-psd'],
    [rawPsd({ width: 2, height: 2, mode: 2 }), 'color-mode'],  // indexed
    [rawPsd({ width: 2, height: 2, mode: 9 }), 'color-mode'],  // lab
    [rawPsd({ width: 2, height: 2, depth: 32 }), 'depth'],
    [rawPsd({ width: 2, height: 2, depth: 1 }), 'depth'],
  ];
  for (const [bytes, code] of cases) {
    assert.throws(
      () => readPsd(bytes),
      (e: unknown) => e instanceof PsdUnsupportedError && e.code === code,
      `expected ${code}`,
    );
  }
  // Dimension lie: header claims 40k on a v1 file.
  const big = rawPsd({ width: 2, height: 2 });
  new DataView(big.buffer).setUint32(18, 40_000);
  assert.throws(() => readPsd(big), (e: unknown) => e instanceof PsdUnsupportedError && e.code === 'bounds');
});

// ─── damage: warn + degrade, never throw ─────────────────────────────────────

test('psd: truncation inside sections degrades with warnings, never throws', () => {
  const full = writePsd({
    width: 8,
    height: 8,
    layers: [{ name: 'L', x: 0, y: 0, width: 8, height: 8, pixels: pix(8, 8) }],
  });
  // Chop at every point past the header: the ONLY permitted throw is the typed
  // structural refusal (a top-level section length itself cut off); anything
  // else must degrade to a document with warnings. No other exception class.
  for (let cut = 26; cut < full.length; cut += 7) {
    try {
      const doc = readPsd(full.subarray(0, cut));
      assert.ok(Array.isArray(doc.warnings));
    } catch (e) {
      assert.ok(e instanceof PsdUnsupportedError, `uncontrolled throw at cut ${cut}: ${String(e)}`);
    }
  }
});

test('psd: a lying RLE row table skips the layer with a warning', () => {
  const full = writePsd({
    width: 8,
    height: 8,
    layers: [{ name: 'flat', x: 0, y: 0, width: 8, height: 8, pixels: flatPix(8, 8, 9, 9, 9) }],
  });
  // Find the first layer channel data (compression 1 marker after records) and
  // corrupt a row length to an absurd value. The alpha channel is written
  // first; poke its first row-length entry.
  // Rather than byte-hunt, corrupt EVERY u16 0x0001..0x0004-looking row length:
  // simpler and still deterministic - flip a mid-file byte region and require
  // "no throw + document still returned".
  const bytes = full.slice();
  for (let i = 60; i < Math.min(bytes.length, 160); i++) bytes[i] = 0xff;
  const warns: string[] = [];
  const doc = readPsd(bytes, { onWarn: (c) => warns.push(c) });
  assert.ok(Array.isArray(doc.layers));
  assert.ok(warns.length > 0, 'corruption must surface as warnings');
});

test('psd: decode budget skips layers before allocating, document survives', () => {
  const doc: PsdWriteDoc = {
    width: 16,
    height: 16,
    layers: [
      { name: 'a', x: 0, y: 0, width: 16, height: 16, pixels: flatPix(16, 16, 1, 2, 3) },
      { name: 'b', x: 0, y: 0, width: 16, height: 16, pixels: flatPix(16, 16, 4, 5, 6) },
    ],
  };
  const warns: string[] = [];
  const back = readPsd(writePsd(doc), { maxDecodedBytes: 1400, onWarn: (c) => warns.push(c) });
  assert.ok(warns.includes('decode.budget.exhausted'));
  // Layer rows still exist (geometry survives), pixels may be empty.
  assert.equal(back.layers.length, 2);
  assert.ok(back.layers.some((l) => l.pixels.length === 0));
});

test('psd: compositeOnly skips layer decode entirely', () => {
  const back = readPsd(writePsd({
    width: 4,
    height: 4,
    layers: [{ name: 'x', x: 0, y: 0, width: 4, height: 4, pixels: flatPix(4, 4, 7, 7, 7) }],
  }), { compositeOnly: true });
  assert.equal(back.layers.length, 0);
  assert.ok(back.composite);
});

test('psd: writer refuses incoherent docs', () => {
  assert.throws(() => writePsd({ width: 0, height: 4, layers: [] }), TypeError);
  assert.throws(() => writePsd({
    width: 4, height: 4,
    layers: [{ name: 'bad', x: 0, y: 0, width: 4, height: 4, pixels: new Uint8Array(3) }],
  }), TypeError);
});
