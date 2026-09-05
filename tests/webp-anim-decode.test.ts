// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packWebpAnim } from '../engine/src/webp-anim.ts';
import { demuxWebpAnim, WEBP_DEMUX_MAX_DIM } from '../engine/src/webp-anim-decode.ts';

// --- tiny RIFF chunk + still-WebP builders (all little-endian) ---------------

function chunk(cc: string, payload: number[]): number[] {
  const n = payload.length;
  const bytes = [
    cc.charCodeAt(0), cc.charCodeAt(1), cc.charCodeAt(2), cc.charCodeAt(3),
    n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff,
    ...payload,
  ];
  if (n & 1) bytes.push(0x00); // pad to even
  return bytes;
}

function riff(body: number[]): Uint8Array {
  const size = 4 + body.length;
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46,                    // 'RIFF'
    size & 0xff, (size >>> 8) & 0xff, (size >>> 16) & 0xff, (size >>> 24) & 0xff,
    0x57, 0x45, 0x42, 0x50,                    // 'WEBP'
    ...body,
  ]);
}

// A minimal simple-lossless still: 0x2f signature + 14-bit(w-1) | 14-bit(h-1).
function vp8lPayload(w: number, h: number): number[] {
  const bits = ((w - 1) & 0x3fff) | (((h - 1) & 0x3fff) << 14);
  return [0x2f, bits & 0xff, (bits >>> 8) & 0xff, (bits >>> 16) & 0xff, (bits >>> 24) & 0xff, 0xde, 0xad];
}

function stillVp8l(w: number, h: number): Uint8Array {
  return riff(chunk('VP8L', vp8lPayload(w, h)));
}

// An extended still with a real separate ALPH chunk + lossy VP8 image.
function stillVp8xAlpha(w: number, h: number): Uint8Array {
  const vp8x = [0x10, 0, 0, 0, (w - 1) & 0xff, ((w - 1) >>> 8) & 0xff, ((w - 1) >>> 16) & 0xff,
    (h - 1) & 0xff, ((h - 1) >>> 8) & 0xff, ((h - 1) >>> 16) & 0xff];
  const alph = [0x00, 0x11, 0x22, 0x33];
  const vp8 = [0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0, 0, 0, 0]; // arbitrary lossy payload
  return riff([...chunk('VP8X', vp8x), ...chunk('ALPH', alph), ...chunk('VP8 ', vp8)]);
}

const startsWithRiffWebp = (b: Uint8Array): boolean =>
  b.length >= 12 &&
  String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!) === 'RIFF' &&
  String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!) === 'WEBP';

const fourccAt = (b: Uint8Array, o: number): string =>
  String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);

// --- round-trip: pack real still WebPs, then demux them back -----------------

test('demuxWebpAnim recovers frame count, durations, loops and canvas from packWebpAnim', () => {
  const frameA = stillVp8l(4, 4);          // simple lossless, no alpha
  const frameB = stillVp8xAlpha(4, 4);     // extended, separate ALPH chunk
  const packed = packWebpAnim([frameA, frameB], {
    delayMs: [100, 250],
    loops: 3,
    width: 4,
    height: 4,
  });

  const out = demuxWebpAnim(packed);

  assert.equal(out.width, 4);
  assert.equal(out.height, 4);
  assert.equal(out.loops, 3);
  assert.equal(out.frames.length, 2);
  assert.deepEqual(out.frames.map((f) => f.durationMs), [100, 250]);

  // packWebpAnim lays every frame full-canvas at 0,0 with overwrite blend.
  for (const f of out.frames) {
    assert.equal(f.x, 0);
    assert.equal(f.y, 0);
    assert.equal(f.frameWidth, 4);
    assert.equal(f.frameHeight, 4);
    assert.equal(f.blend, 1);   // packWebpAnim writes hdr[15]=0x02 → blend bit set
    assert.equal(f.dispose, 0);
    assert.ok(startsWithRiffWebp(f.still), 'each still begins with RIFF..WEBP');
  }

  // Frame A: no alpha → emitted as the simple form (VP8L directly after WEBP).
  assert.equal(fourccAt(out.frames[0]!.still, 12), 'VP8L');

  // Frame B: had an ALPH chunk → emitted as extended VP8X form carrying it.
  assert.equal(fourccAt(out.frames[1]!.still, 12), 'VP8X');
  assert.ok(
    Array.from(out.frames[1]!.still).join(',').includes('65,76,80,72'), // 'ALPH'
    'alpha still carries its ALPH chunk',
  );
});

test('demuxed stills round-trip through packWebpAnim again (stable)', () => {
  const packed = packWebpAnim([stillVp8l(8, 8), stillVp8l(8, 8)], { delayMs: 40, loops: 0, width: 8, height: 8 });
  const first = demuxWebpAnim(packed);
  // Re-pack the recovered stills and re-demux - count/geometry must survive.
  const repacked = packWebpAnim(first.frames.map((f) => f.still), { delayMs: 40, width: 8, height: 8 });
  const second = demuxWebpAnim(repacked);
  assert.equal(second.frames.length, 2);
  assert.equal(second.width, 8);
  assert.equal(second.height, 8);
  for (const f of second.frames) assert.ok(startsWithRiffWebp(f.still));
});

// --- direct parse of a hand-built animation with NON-zero frame offsets ------

test('demuxWebpAnim reads ANMF frame offsets, duration and blend/dispose flags', () => {
  const u24 = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff];
  // ANMF: X/2=1(→2), Y/2=2(→4), W-1=3(→4), H-1=1(→2), dur=123, flags=0x03 (blend=1,dispose=1)
  const anmfHdr = [...u24(1), ...u24(2), ...u24(3), ...u24(1), ...u24(123), 0x03];
  const anmfPayload = [...anmfHdr, ...chunk('VP8L', vp8lPayload(4, 2))];

  const vp8x = [0x02, 0, 0, 0, ...u24(15), ...u24(9)]; // animation flag, canvas 16x10
  const anim = [0, 0, 0, 0, 0x02, 0x00];               // bg transparent, loops=2
  const bytes = riff([...chunk('VP8X', vp8x), ...chunk('ANIM', anim), ...chunk('ANMF', anmfPayload)]);

  const out = demuxWebpAnim(bytes);
  assert.equal(out.width, 16);
  assert.equal(out.height, 10);
  assert.equal(out.loops, 2);
  assert.equal(out.frames.length, 1);
  const f = out.frames[0]!;
  assert.equal(f.x, 2);
  assert.equal(f.y, 4);
  assert.equal(f.frameWidth, 4);
  assert.equal(f.frameHeight, 2);
  assert.equal(f.durationMs, 123);
  assert.equal(f.blend, 1);
  assert.equal(f.dispose, 1);
  assert.equal(fourccAt(f.still, 12), 'VP8L');
});

test('demuxWebpAnim rejects non-WebP bytes', () => {
  assert.throws(() => demuxWebpAnim(new Uint8Array([1, 2, 3, 4])), /not a WebP/);
});

test('demuxWebpAnim refuses hostile canvas dimensions before host decode', () => {
  const u24 = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff];
  const vp8x = [0x02, 0, 0, 0, ...u24(WEBP_DEMUX_MAX_DIM), ...u24(0)];
  assert.throws(() => demuxWebpAnim(riff(chunk('VP8X', vp8x))), /canvas .* exceeds/);
});
