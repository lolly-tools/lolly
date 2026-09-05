// SPDX-License-Identifier: MPL-2.0
/**
 * font-convert: TTF/OTF ⇄ WOFF1 container round-trips against a real font.
 *
 * The required property is that a font's TABLE DATA survives a
 * sfnt→WOFF→sfnt round-trip byte-for-byte, and that every directory checksum
 * stays consistent with the bytes it describes. We use the shipped Outfit
 * variable TTF (always present - it is the web shell's platform face) as a real
 * fixture, and also exercise the synthetic minimal-sfnt path so the test does
 * not depend on any one font's table set.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sfntKind, sfntToWoff, woffToSfnt, fontConversionTargets, convertFontContainer } from '../engine/src/font-convert.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTFIT = join(HERE, '..', 'shells', 'web', 'public', 'fonts', 'Outfit[wght].ttf');

test('font targets follow the outline flavor, never the requested filename', () => {
  const ttf = new Uint8Array(readFileSync(OUTFIT));
  const woff = sfntToWoff(ttf);
  assert.deepEqual(fontConversionTargets(ttf), ['ttf', 'woff']);
  assert.deepEqual(fontConversionTargets(woff), ['ttf', 'woff']);
  assert.throws(() => convertFontContainer(ttf, 'otf'), /different outlines/);
  assert.throws(() => convertFontContainer(woff, 'otf'), /different outlines/);
  assert.equal(sfntKind(convertFontContainer(woff, 'ttf')), 'ttf');
  const cffHeader = woff.slice(); cffHeader.set([0x4f, 0x54, 0x54, 0x4f], 4);
  assert.deepEqual(fontConversionTargets(cffHeader), ['otf', 'woff']);
  assert.deepEqual(fontConversionTargets(woff.subarray(0, 8)), []);
});

/** Parse an sfnt directory into tag → bytes, for structural comparison. */
function readTables(bytes: Uint8Array): Map<string, Uint8Array> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const num = dv.getUint16(4, false);
  const map = new Map<string, Uint8Array>();
  for (let i = 0; i < num; i++) {
    const e = 12 + i * 16;
    const tag = String.fromCharCode(bytes[e]!, bytes[e + 1]!, bytes[e + 2]!, bytes[e + 3]!);
    const off = dv.getUint32(e + 8, false);
    const len = dv.getUint32(e + 12, false);
    map.set(tag, bytes.subarray(off, off + len));
  }
  return map;
}

/** sfnt table checksum (big-endian uint32 words, right-zero-padded tail). */
function checksum(data: Uint8Array): number {
  let sum = 0;
  const full = data.length & ~3;
  let i = 0;
  for (; i < full; i += 4) {
    sum = (sum + (((data[i]! << 24) | (data[i + 1]! << 16) | (data[i + 2]! << 8) | data[i + 3]!) >>> 0)) >>> 0;
  }
  if (i < data.length) {
    let w = 0;
    for (let b = 0; b < 4; b++) w = ((w << 8) | (i + b < data.length ? data[i + b]! : 0)) >>> 0;
    sum = (sum + w) >>> 0;
  }
  return sum >>> 0;
}

test('sfntKind reads the container magic', () => {
  assert.equal(sfntKind(new Uint8Array([0x00, 0x01, 0x00, 0x00])), 'ttf');
  assert.equal(sfntKind(new Uint8Array([0x74, 0x72, 0x75, 0x65])), 'ttf'); // 'true'
  assert.equal(sfntKind(new Uint8Array([0x4f, 0x54, 0x54, 0x4f])), 'otf'); // 'OTTO'
  assert.equal(sfntKind(new Uint8Array([0x77, 0x4f, 0x46, 0x46])), 'woff');
  assert.equal(sfntKind(new Uint8Array([0x77, 0x4f, 0x46, 0x32])), 'woff2');
  assert.equal(sfntKind(new Uint8Array([0x74, 0x74, 0x63, 0x66])), null); // 'ttcf' collection
  assert.equal(sfntKind(new Uint8Array([1, 2, 3])), null); // too short
});

test('real TTF → WOFF → TTF preserves every table byte-for-byte', () => {
  const ttf = new Uint8Array(readFileSync(OUTFIT));
  assert.equal(sfntKind(ttf), 'ttf');

  const woff = sfntToWoff(ttf);
  assert.equal(sfntKind(woff), 'woff');
  // WOFF should not be larger than the sfnt (tables are compressed-or-stored).
  assert.ok(woff.length <= ttf.length, `woff ${woff.length} vs ttf ${ttf.length}`);

  const back = woffToSfnt(woff);
  assert.equal(sfntKind(back), 'ttf');

  const orig = readTables(ttf);
  const round = readTables(back);
  assert.equal(round.size, orig.size, 'table count preserved');
  for (const [tag, data] of orig) {
    const got = round.get(tag);
    assert.ok(got, `table ${tag} present after round-trip`);
    if (tag === 'head') {
      // checkSumAdjustment (bytes 8..12) is recomputed for the new layout, so it
      // may differ legitimately; every other byte of head must survive.
      const a = data.slice(); const b = got!.slice();
      a[8] = a[9] = a[10] = a[11] = 0;
      b[8] = b[9] = b[10] = b[11] = 0;
      assert.deepEqual([...b], [...a], 'head bytes preserved (adjustment aside)');
    } else {
      assert.deepEqual([...got!], [...data], `table ${tag} bytes preserved`);
    }
  }
});

test('reconstructed sfnt directory checksums match the table data', () => {
  const ttf = new Uint8Array(readFileSync(OUTFIT));
  const back = woffToSfnt(sfntToWoff(ttf));
  const dv = new DataView(back.buffer, back.byteOffset, back.byteLength);
  const num = dv.getUint16(4, false);
  for (let i = 0; i < num; i++) {
    const e = 12 + i * 16;
    const tag = String.fromCharCode(back[e]!, back[e + 1]!, back[e + 2]!, back[e + 3]!);
    const stored = dv.getUint32(e + 4, false);
    const off = dv.getUint32(e + 8, false);
    const len = dv.getUint32(e + 12, false);
    const data = back.subarray(off, off + len);
    if (tag === 'head') {
      // head's checksum is computed with checkSumAdjustment (bytes 8..12) zeroed.
      const patched = data.slice();
      patched[8] = patched[9] = patched[10] = patched[11] = 0;
      assert.equal(checksum(patched), stored, 'head checksum (adjustment zeroed)');
    } else {
      assert.equal(checksum(data), stored, `${tag} checksum consistent`);
    }
  }
});

test('reconstructed sfnt has a valid head.checkSumAdjustment', () => {
  const ttf = new Uint8Array(readFileSync(OUTFIT));
  const back = woffToSfnt(sfntToWoff(ttf));
  const tables = readTables(back);
  const head = tables.get('head');
  assert.ok(head, 'head table present');
  // Whole-font checksum with checkSumAdjustment zeroed, plus the stored
  // adjustment, must equal the magic 0xB1B0AFBA (OpenType section head).
  const dv = new DataView(back.buffer, back.byteOffset, back.byteLength);
  // locate head within `back`
  const num = dv.getUint16(4, false);
  let headOff = -1;
  for (let i = 0; i < num; i++) {
    const e = 12 + i * 16;
    if (String.fromCharCode(back[e]!, back[e + 1]!, back[e + 2]!, back[e + 3]!) === 'head') {
      headOff = dv.getUint32(e + 8, false);
      break;
    }
  }
  assert.ok(headOff >= 0);
  const adjustment = dv.getUint32(headOff + 8, false);
  const whole = back.slice();
  whole[headOff + 8] = whole[headOff + 9] = whole[headOff + 10] = whole[headOff + 11] = 0;
  assert.equal((checksum(whole) + adjustment) >>> 0, 0xb1b0afba);
});

test('unpacking an already-sfnt font leaves its actual outline format untouched', () => {
  const ttf = new Uint8Array(readFileSync(OUTFIT));
  // woffToSfnt on an already-sfnt input returns it unchanged (container is sfnt).
  assert.strictEqual(woffToSfnt(ttf), ttf);
});

// ── Synthetic minimal sfnt: two fake tables, exercised without any real font ──
function synthSfnt(): Uint8Array {
  const tables: Array<{ tag: string; data: Uint8Array }> = [
    { tag: 'aaaa', data: new Uint8Array([1, 2, 3, 4, 5, 6, 7]) },          // odd length → padded
    { tag: 'bbbb', data: new Uint8Array(Array.from({ length: 64 }, (_, i) => i & 0xff)) },
  ];
  const num = tables.length;
  let total = 12 + num * 16;
  const offs = tables.map((t) => { const o = total; total = (total + t.data.length + 3) & ~3; return o; });
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x00010000, false);
  dv.setUint16(4, num, false);
  for (let i = 0; i < num; i++) {
    const t = tables[i]!;
    const e = 12 + i * 16;
    for (let k = 0; k < 4; k++) out[e + k] = t.tag.charCodeAt(k);
    dv.setUint32(e + 4, checksum(t.data), false);
    dv.setUint32(e + 8, offs[i]!, false);
    dv.setUint32(e + 12, t.data.length, false);
    out.set(t.data, offs[i]!);
  }
  return out;
}

test('synthetic sfnt round-trips through WOFF', () => {
  const sfnt = synthSfnt();
  const back = woffToSfnt(sfntToWoff(sfnt));
  const a = readTables(sfnt);
  const b = readTables(back);
  assert.equal(b.size, a.size);
  for (const [tag, data] of a) {
    assert.deepEqual([...b.get(tag)!], [...data], `synthetic ${tag} preserved`);
  }
});

test('woffToSfnt rejects WOFF2 and garbage', () => {
  assert.throws(() => woffToSfnt(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0])), /WOFF2/);
  assert.throws(() => woffToSfnt(new Uint8Array([0, 0, 0, 0])), /not a WOFF/);
});

test('sfntToWoff rejects a WOFF input and truncated data', () => {
  const woff = sfntToWoff(synthSfnt());
  assert.throws(() => sfntToWoff(woff), /already a WOFF/);
  assert.throws(() => sfntToWoff(new Uint8Array([0x00, 0x01])), /not a TTF\/OTF|truncated/);
});

test('hostile WOFF: an out-of-range table offset throws, does not read past end', () => {
  // Build a WOFF whose single directory entry points past the buffer.
  const buf = new Uint8Array(44 + 20 + 4);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 0x774f4646, false); // 'wOFF'
  dv.setUint32(4, 0x00010000, false); // flavor
  dv.setUint32(8, buf.length, false); // length
  dv.setUint16(12, 1, false);         // numTables
  dv.setUint32(16, 64, false);        // totalSfntSize
  const e = 44;
  dv.setUint32(e, 0x61616161, false);     // tag 'aaaa'
  dv.setUint32(e + 4, 9999, false);       // offset - way past end
  dv.setUint32(e + 8, 4, false);          // compLength
  dv.setUint32(e + 12, 4, false);         // origLength
  dv.setUint32(e + 16, 0, false);         // checksum
  assert.throws(() => woffToSfnt(buf), /out of range/);
});
