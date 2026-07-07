// SPDX-License-Identifier: MPL-2.0
// Regression test for the MP4 provenance corruption fix (engine/src/video-meta.ts).
// A fast-start MP4 has `moov` BEFORE `mdat`; embedding a `udta` into `moov` shifts
// `mdat`, so every stco/co64 chunk offset must be bumped by udta.length or the
// file is unplayable. Progressive files (mdat before moov) must be left alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { embedMp4Meta } from '../engine/src/video-meta.ts';

const ascii = (s: string): Uint8Array => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const u32 = (v: number): Uint8Array => new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
const cat = (...a: Uint8Array[]): Uint8Array => {
  const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0));
  let p = 0; for (const x of a) { o.set(x, p); p += x.length; }
  return o;
};
const box = (type: string, ...payload: Uint8Array[]): Uint8Array => {
  const body = cat(...payload);
  return cat(u32(body.length + 8), ascii(type), body);
};
const rd = (b: Uint8Array, o: number): number => b[o]! * 16777216 + ((b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!);
const TAGS = { title: '', artist: '', date: '', comment: '', encoder: 'Lolly', encodedBy: '', publisher: '' };
const findStcoOffset = (b: Uint8Array): number => {
  for (let i = 0; i + 16 < b.length; i++) {
    if (b[i] === 115 && b[i + 1] === 116 && b[i + 2] === 99 && b[i + 3] === 111) return rd(b, i + 12); // 'stco' → first offset
  }
  return -1;
};
const moovWithStco = (chunkOff: number): Uint8Array =>
  box('moov', box('trak', box('mdia', box('minf', box('stbl', box('stco', u32(0), u32(1), u32(chunkOff)))))));

test('fast-start (moov before mdat): stco chunk offset is shifted by udta.length', () => {
  const mdatData = ascii('SAMPLEDATA');
  const moovLen = moovWithStco(0).length;          // length is offset-independent
  const chunkOff = moovLen + 8;                     // first mdat data byte (after mdat's 8-byte header)
  const file = cat(moovWithStco(chunkOff), box('mdat', mdatData));
  assert.equal(file[chunkOff], mdatData[0], 'fixture: offset points at mdat data');

  const out = embedMp4Meta(file, TAGS);
  const delta = out.length - file.length;
  assert.ok(delta > 0, 'udta was inserted');
  const patched = findStcoOffset(out);
  assert.equal(patched, chunkOff + delta, 'chunk offset bumped by udta.length');
  assert.equal(out[patched], mdatData[0], 'patched offset still lands on the sample data');
});

test('progressive (mdat before moov): offsets left untouched', () => {
  const mdatData = ascii('SAMPLEDATA');
  const mdat = box('mdat', mdatData);
  const chunkOff = 8;                               // mdat data start (mdat is first)
  const file = cat(mdat, moovWithStco(chunkOff));
  const out = embedMp4Meta(file, TAGS);
  assert.ok(out.length > file.length, 'udta inserted');
  assert.equal(findStcoOffset(out), chunkOff, 'offset unchanged (nothing shifted before mdat)');
});
