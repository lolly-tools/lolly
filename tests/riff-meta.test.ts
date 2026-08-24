// SPDX-License-Identifier: MPL-2.0
/**
 * embedWavInfo (engine/src/riff-meta.ts) - the WAV LIST/INFO writer that gives
 * a generated clip its human-readable authorship (the audio sibling of the mp4
 * ilst / WebM Tags embeds in video-meta.ts). Pins the byte structure: chunk
 * grammar, NUL termination + even padding, field presence rules (IART only
 * when provided, ISFT always), the RIFF size patch, replace-not-duplicate on a
 * re-tag, and the conservative no-op on anything unwalkable.
 *
 * Run with: node --test tests/riff-meta.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { embedWavInfo } from '../engine/src/riff-meta.ts';
import { parseWav } from '../engine/src/wav.ts';

/** A real minimal WAV: 16-bit PCM mono. */
function tinyWav(frames = 8): Uint8Array {
  const dataLen = frames * 2;
  const u8 = new Uint8Array(44 + dataLen);
  const dv = new DataView(u8.buffer);
  const put = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i++) u8[at + i] = s.charCodeAt(i);
  };
  put(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); put(8, 'WAVE');
  put(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 24000, true); dv.setUint32(28, 48000, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  put(36, 'data'); dv.setUint32(40, dataLen, true);
  for (let i = 0; i < frames; i++) dv.setInt16(44 + i * 2, i * 100, true);
  return u8;
}

const str = (b: Uint8Array, at: number, n: number): string => String.fromCharCode(...b.subarray(at, at + n));
const u32 = (b: Uint8Array, at: number): number => new DataView(b.buffer, b.byteOffset).getUint32(at, true);

/** Walk the INFO payload of the LAST LIST/INFO chunk → { id: rawValueBytes }. */
function readInfo(wav: Uint8Array): { subs: Map<string, Uint8Array>; listStart: number; listSize: number } {
  let found: { start: number; size: number } | null = null;
  for (let i = 12; i + 8 <= wav.length; ) {
    const size = u32(wav, i + 4);
    if (str(wav, i, 4) === 'LIST' && str(wav, i + 8, 4) === 'INFO') found = { start: i, size };
    i += 8 + size + (size & 1);
  }
  assert.ok(found, 'a LIST/INFO chunk exists');
  const subs = new Map<string, Uint8Array>();
  const end = found!.start + 8 + found!.size;
  for (let i = found!.start + 12; i + 8 <= end; ) {
    const size = u32(wav, i + 4);
    subs.set(str(wav, i, 4), wav.slice(i + 8, i + 8 + size));
    i += 8 + size + (size & 1);
  }
  return { subs, listStart: found!.start, listSize: found!.size };
}

test('writes INAM/ICMT/ISFT with NUL termination, even padding and a patched RIFF size', () => {
  const out = embedWavInfo(tinyWav(), { title: 'Hello', comment: 'A comment' });
  assert.equal(u32(out, 4), out.length - 8, 'RIFF size covers the appended LIST');
  const { subs, listSize } = readInfo(out);
  assert.equal(listSize & 1, 0, 'the LIST payload is even');
  const text = (id: string): string => {
    const v = subs.get(id);
    assert.ok(v, `${id} present`);
    assert.equal(v![v!.length - 1], 0, `${id} is NUL-terminated`);
    return new TextDecoder().decode(v!.subarray(0, v!.length - 1));
  };
  assert.equal(text('INAM'), 'Hello');
  assert.equal(text('ICMT'), 'A comment');
  assert.equal(text('ISFT'), 'lolly.tools', 'software defaults to lolly.tools');
  assert.ok(!subs.has('IART'), 'no artist without an opted-in author');
  // 'Hello' + NUL = 6 bytes (even, no pad); 'A comment' + NUL = 10.
  assert.equal(subs.get('INAM')!.length, 6);
});

test('an odd-length value gains a pad byte the declared size does not count', () => {
  const out = embedWavInfo(tinyWav(), { title: 'Hi' }); // 'Hi' + NUL = 3, padded to 4
  const { subs } = readInfo(out);
  assert.equal(subs.get('INAM')!.length, 3, 'declared size counts value + NUL only');
  // The walk above steps by size + (size & 1) - reaching ISFT proves the pad byte.
  assert.ok(subs.has('ISFT'));
});

test('IART appears exactly when an artist is provided', () => {
  const { subs } = readInfo(embedWavInfo(tinyWav(), { title: 'T', artist: 'Andy F' }));
  assert.ok(subs.has('IART'));
  assert.equal(new TextDecoder().decode(subs.get('IART')!.subarray(0, subs.get('IART')!.length - 1)), 'Andy F');
});

test('re-tagging replaces the LIST/INFO chunk, never duplicates it', () => {
  const once = embedWavInfo(tinyWav(), { title: 'First' });
  const twice = embedWavInfo(once, { title: 'Second' });
  let count = 0;
  for (let i = 12; i + 8 <= twice.length; ) {
    const size = u32(twice, i + 4);
    if (str(twice, i, 4) === 'LIST' && str(twice, i + 8, 4) === 'INFO') count++;
    i += 8 + size + (size & 1);
  }
  assert.equal(count, 1);
  const { subs } = readInfo(twice);
  assert.equal(new TextDecoder().decode(subs.get('INAM')!.subarray(0, subs.get('INAM')!.length - 1)), 'Second');
  assert.equal(u32(twice, 4), twice.length - 8, 'RIFF size stays exact through a replace');
});

test('the tagged file still decodes to identical samples', () => {
  const bare = tinyWav();
  const tagged = embedWavInfo(bare, { title: 'Hello', comment: 'Synthetic voice' });
  const a = parseWav(bare);
  const b = parseWav(tagged);
  assert.equal(b.sampleRate, a.sampleRate);
  assert.deepEqual(Array.from(b.channels[0]!), Array.from(a.channels[0]!));
});

test('non-WAV or unwalkable input comes back untouched - never corrupted', () => {
  const junk = Uint8Array.from('this is not a riff file at all!!', (c) => c.charCodeAt(0));
  assert.equal(embedWavInfo(junk, { title: 'X' }), junk);
  // A chunk whose declared size runs past EOF makes the walk unsafe → no-op.
  const truncated = tinyWav();
  new DataView(truncated.buffer).setUint32(40, 0xffff, true);
  assert.equal(embedWavInfo(truncated, { title: 'X' }), truncated);
});

test('ICOP carries the copyright notice (plans/144 Wave 2 G4)', () => {
  const { subs } = readInfo(embedWavInfo(tinyWav(), { title: 'T', copyright: '© 2026 Ana Kovac' }));
  assert.ok(subs.has('ICOP'));
  const raw = subs.get('ICOP')!;
  assert.equal(new TextDecoder().decode(raw.subarray(0, raw.length - 1)), '© 2026 Ana Kovac');
});
