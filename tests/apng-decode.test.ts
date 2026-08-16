// SPDX-License-Identifier: MPL-2.0
/**
 * demuxApng - round-trip against the real packApng packer and packPng encoder.
 * Encode a few genuine PNG frames, splice them into an APNG, demux, and assert
 * the frame count, canvas geometry, per-frame delays, and that every returned
 * still is a structurally valid standalone PNG.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { packPng } from '../engine/src/png.ts';
import { packApng } from '../engine/src/apng.ts';
import { demuxApng } from '../engine/src/apng-decode.ts';
import { zlibCompress } from '../engine/src/deflate.ts';
import { crc32 } from '../engine/src/zip-crypto.ts';

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function writeU32(b: Uint8Array, o: number, v: number): void {
  b[o] = (v >>> 24) & 0xff; b[o + 1] = (v >>> 16) & 0xff; b[o + 2] = (v >>> 8) & 0xff; b[o + 3] = v & 0xff;
}
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
/** A well-formed PNG chunk (length + type + data + real CRC-32 over type+data). */
function chunkOf(type: string, data: Uint8Array): Uint8Array {
  const t = Uint8Array.from([type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)]);
  const body = concat([t, data]);
  const out = new Uint8Array(4 + body.length + 4);
  writeU32(out, 0, data.length);
  out.set(body, 4);
  writeU32(out, 4 + body.length, crc32(body));
  return out;
}
/** True if `png` carries a chunk of the given type anywhere in its stream. */
function hasChunk(png: Uint8Array, type: string): boolean {
  let off = 8;
  while (off + 8 <= png.length) {
    const len = ((png[off]! << 24) | (png[off + 1]! << 16) | (png[off + 2]! << 8) | png[off + 3]!) >>> 0;
    if (String.fromCharCode(png[off + 4]!, png[off + 5]!, png[off + 6]!, png[off + 7]!) === type) return true;
    off += 12 + len;
  }
  return false;
}

/** A solid-colour W×H RGBA PNG, encoded by the engine's own writer. */
function solidPng(w: number, h: number, r: number, g: number, b: number, a = 255): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = a;
  }
  return packPng(px, { width: w, height: h, channels: 4, depth: 8 });
}

function readU32(b: Uint8Array, o: number): number {
  return ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
}

/** Assert `still` is a valid PNG: signature, leading IHDR, trailing IEND, and
 *  return its IHDR width/height. Walks chunks strictly. */
function assertValidPng(still: Uint8Array): { width: number; height: number } {
  for (let i = 0; i < 8; i++) assert.equal(still[i], PNG_SIG[i], `signature byte ${i}`);
  // First chunk must be IHDR (length 13).
  assert.equal(readU32(still, 8), 13, 'IHDR length');
  assert.equal(String.fromCharCode(still[12]!, still[13]!, still[14]!, still[15]!), 'IHDR');
  const width = readU32(still, 16);
  const height = readU32(still, 20);
  // Walk to the end; the last chunk must be a zero-length IEND.
  let off = 8;
  let lastType = '';
  let sawIdat = false;
  while (off + 8 <= still.length) {
    const len = readU32(still, off);
    lastType = String.fromCharCode(still[off + 4]!, still[off + 5]!, still[off + 6]!, still[off + 7]!);
    if (lastType === 'IDAT') sawIdat = true;
    off += 12 + len;
    if (lastType === 'IEND') break;
  }
  assert.equal(off, still.length, 'chunk walk consumes the whole file exactly');
  assert.equal(lastType, 'IEND', 'ends with IEND');
  assert.ok(sawIdat, 'has an IDAT chunk');
  return { width, height };
}

test('demuxApng round-trips packApng frame count, geometry and delays', () => {
  const frames = [
    solidPng(4, 3, 255, 0, 0),
    solidPng(4, 3, 0, 255, 0),
    solidPng(4, 3, 0, 0, 255),
  ];
  const delays = [40, 120, 250];
  const apng = packApng(frames, { delayMs: delays, loops: 7 });

  const out = demuxApng(apng);

  assert.equal(out.width, 4, 'canvas width');
  assert.equal(out.height, 3, 'canvas height');
  assert.equal(out.loops, 7, 'loop count');
  assert.equal(out.frames.length, 3, 'frame count');

  out.frames.forEach((f, i) => {
    // packApng writes full-canvas frames at 0,0, dispose NONE (0), blend SOURCE (0).
    assert.equal(f.x, 0, `frame ${i} x`);
    assert.equal(f.y, 0, `frame ${i} y`);
    assert.equal(f.dispose, 0, `frame ${i} dispose`);
    assert.equal(f.blend, 0, `frame ${i} blend`);
    // packApng encodes delay as delay_num = ms, delay_den = 1000 → delayMs back out is ms.
    assert.equal(f.delayMs, delays[i], `frame ${i} delayMs`);
    const dim = assertValidPng(f.still);
    assert.deepEqual(dim, { width: 4, height: 3 }, `frame ${i} still dimensions`);
  });
});

test('demuxApng stills re-pack through packApng (cross-check validity)', () => {
  const apng = packApng([solidPng(2, 2, 10, 20, 30), solidPng(2, 2, 40, 50, 60)], { delayMs: 67 });
  const out = demuxApng(apng);
  // packApng re-parses every frame (signature + IHDR + IEND); if a still were
  // malformed this throws.
  const stills = out.frames.map((f) => f.still);
  const repacked = demuxApng(packApng(stills, { delayMs: 67 }));
  assert.equal(repacked.frames.length, 2);
});

test('demuxApng handles delay_den 0 as 100', () => {
  // Hand-build a minimal APNG whose single fcTL has delay_den = 0.
  const base = packPng(new Uint8Array(1 * 1 * 4).fill(200), { width: 1, height: 1, channels: 4, depth: 8 });
  const apng = packApng([base], { delayMs: 50 });
  // Locate the fcTL delay_den field and zero it, then set delay_num to 5.
  // fcTL data layout: seq(4) w(4) h(4) x(4) y(4) num(2) den(2) dispose(1) blend(1).
  const mut = apng.slice();
  let off = 8;
  let patched = false;
  while (off + 8 <= mut.length) {
    const len = readU32(mut, off);
    const type = String.fromCharCode(mut[off + 4]!, mut[off + 5]!, mut[off + 6]!, mut[off + 7]!);
    if (type === 'fcTL') {
      const d = off + 8;
      // delay_num at d+20 (u16), delay_den at d+22 (u16).
      mut[d + 20] = 0; mut[d + 21] = 5;   // num = 5
      mut[d + 22] = 0; mut[d + 23] = 0;   // den = 0 → treated as 100
      // Recompute this chunk's CRC over type+data.
      // (Reuse the engine's crc via a fresh pack is overkill; recompute inline.)
      patched = true;
      break;
    }
    off += 12 + len;
  }
  assert.ok(patched, 'found an fcTL to patch');
  // Recompute CRC of the mutated fcTL chunk so demux accepts nothing about CRC - 
  // demuxApng does not verify CRCs, so no recompute is strictly needed; assert the delay.
  const out = demuxApng(mut);
  // 5 / 100 * 1000 = 50 ms.
  assert.equal(out.frames[0]!.delayMs, 50, 'delay_den 0 treated as 100');
});

test('demuxApng rejects a plain still PNG (no acTL)', () => {
  const still = solidPng(3, 3, 1, 2, 3);
  assert.throws(() => demuxApng(still), /not an APNG/);
});

test('demuxApng carries a palette that follows frame-0 fcTL onto an indexed still', () => {
  // The APNG spec lets frame 0's fcTL precede PLTE/IDAT. A demuxer that only
  // captures shared chunks while no frame is open would drop this palette,
  // yielding an invalid indexed standalone PNG. Order: IHDR(indexed) → acTL →
  // fcTL(#0) → PLTE → IDAT → IEND.
  const ihdr = new Uint8Array(13);
  writeU32(ihdr, 0, 1); writeU32(ihdr, 4, 1); // 1×1
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 3;  // colour type 3 = indexed
  const actl = new Uint8Array(8);
  writeU32(actl, 0, 1); writeU32(actl, 4, 0); // num_frames = 1, num_plays = 0
  const fctl = new Uint8Array(26);
  writeU32(fctl, 4, 1); writeU32(fctl, 8, 1); // w = 1, h = 1 (seq/x/y = 0)
  fctl[21] = 10;  // delay_num = 10
  fctl[23] = 100; // delay_den = 100
  const plte = Uint8Array.from([200, 100, 50]); // one palette entry
  const idat = zlibCompress(Uint8Array.from([0x00, 0x00])); // filter 0, palette index 0

  const apng = concat([
    Uint8Array.from(PNG_SIG),
    chunkOf('IHDR', ihdr),
    chunkOf('acTL', actl),
    chunkOf('fcTL', fctl),
    chunkOf('PLTE', plte),
    chunkOf('IDAT', idat),
    chunkOf('IEND', new Uint8Array(0)),
  ]);

  const out = demuxApng(apng);
  assert.equal(out.frames.length, 1, 'one frame');
  const still = out.frames[0]!.still;
  assert.ok(hasChunk(still, 'PLTE'), 'palette carried onto the indexed still');
  assert.equal(still[25], 3, 'still IHDR keeps indexed colour type 3');
});
