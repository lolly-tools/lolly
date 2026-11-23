// SPDX-License-Identifier: MPL-2.0
/**
 * The WOFF2 guard (src/woff2.ts): every public WOFF2 font in the tree decodes to the
 * bytes the pinned decoder has always returned, a collection decodes too, and malformed
 * or oversized files are refused before the decoder runs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { brotliCompressSync } from 'node:zlib';
import { checkSfntOutput, decodeWoff2, preflightWoff2, Woff2Error, WOFF2_LIMITS } from '../src/woff2.ts';

const ROOT = new URL('../../../', import.meta.url);
const read = (path: string): Uint8Array => new Uint8Array(readFileSync(new URL(path, ROOT)));
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const corpus = JSON.parse(readFileSync(new URL('./fixtures/woff2-corpus.json', import.meta.url), 'utf8')) as { fonts: Record<string, { bytes: number; sha256: string }> };
const SMALL = 'shells/web/public/fonts/Outfit-latin-ext[wght].woff2';

function refusedWith(code: string): (error: unknown) => boolean {
  return (error) => error instanceof Woff2Error && error.code === code;
}

/** A WOFF2 file from parts, for header and directory cases. Table data is whatever `data` holds. */
function woff2Of(opts: {
  flavor?: number;
  tables: Array<{ index: number; length: number; transformLength?: number; version?: number }>;
  data?: Uint8Array;
  collection?: Uint8Array;
  priv?: number;
  lengthField?: number;
  trailing?: number;
}): Uint8Array {
  const dir: number[] = [];
  const base128 = (value: number): number[] => {
    const out = [value & 0x7f];
    for (value = Math.floor(value / 128); value > 0; value = Math.floor(value / 128)) out.unshift((value & 0x7f) | 0x80);
    return out;
  };
  for (const t of opts.tables) {
    dir.push(((t.version ?? 0) << 6) | t.index, ...base128(t.length));
    if (t.transformLength !== undefined) dir.push(...base128(t.transformLength));
  }
  const compressed = brotliCompressSync(opts.data ?? new Uint8Array(opts.tables.reduce((n, t) => n + (t.transformLength ?? t.length), 0)));
  const collection = opts.collection ?? new Uint8Array(0);
  const compressedOffset = 48 + dir.length + collection.length;
  const privOffset = (compressedOffset + compressed.length + 3) & ~3;
  const size = (opts.priv ? privOffset + opts.priv : privOffset) + (opts.trailing ?? 0);
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x774f4632);
  view.setUint32(4, opts.flavor ?? 0x00010000);
  view.setUint32(8, opts.lengthField ?? size);
  view.setUint16(12, opts.tables.length);
  view.setUint32(20, compressed.length);
  if (opts.priv) { view.setUint32(40, privOffset); view.setUint32(44, opts.priv); }
  out.set(dir, 48);
  out.set(collection, 48 + dir.length);
  out.set(compressed, compressedOffset);
  return out;
}

/** Two sfnt fonts as one TrueType collection, each table copied (no sharing). */
function collectionOf(fonts: Uint8Array[]): Uint8Array {
  const headers = fonts.map((font) => 12 + 16 * new DataView(font.buffer, font.byteOffset).getUint16(4));
  let offset = 12 + 4 * fonts.length + headers.reduce((a, b) => a + b, 0);
  const parts: Array<{ at: number; bytes: Uint8Array }> = [];
  const directories: Uint8Array[] = [];
  for (const font of fonts) {
    const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
    const count = view.getUint16(4);
    const directory = new Uint8Array(font.subarray(0, 12 + 16 * count));
    const dv = new DataView(directory.buffer);
    for (let i = 0; i < count; i++) {
      const record = 12 + 16 * i;
      const from = view.getUint32(record + 8), length = view.getUint32(record + 12);
      offset = (offset + 3) & ~3;
      dv.setUint32(record + 8, offset);
      parts.push({ at: offset, bytes: font.subarray(from, from + length) });
      offset += length;
    }
    directories.push(directory);
  }
  const result = new Uint8Array((offset + 3) & ~3);
  const view = new DataView(result.buffer);
  view.setUint32(0, 0x74746366); view.setUint32(4, 0x00010000); view.setUint32(8, fonts.length);
  let at = 12 + 4 * fonts.length;
  directories.forEach((directory, i) => { view.setUint32(12 + 4 * i, at); result.set(directory, at); at += directory.length; });
  for (const part of parts) result.set(part.bytes, part.at);
  return result;
}

test('every public WOFF2 font decodes to the reference bytes of the pinned decoder', async () => {
  const entries = Object.entries(corpus.fonts);
  assert.equal(entries.length, 23);
  for (const [path, expected] of entries) {
    const out = await decodeWoff2(read(path));
    assert.equal(out.length, expected.bytes, path);
    assert.equal(sha256(out), expected.sha256, path);
  }
});

test('the guard hands back exactly what the decoder returns', async () => {
  const bytes = read(SMALL);
  const { default: decompress } = await import('woff2-encoder/decompress');
  assert.deepEqual(await decodeWoff2(bytes), new Uint8Array(await decompress(bytes)));
});

test('a WOFF2 collection decodes and checks every font in the collection', async () => {
  const { compress, decompress } = await import('woff2-encoder');
  const ttc = collectionOf([read('shells/web/public/fonts/SUSEMono[wght].ttf'), read('shells/web/public/fonts/Outfit[wght].ttf')]);
  const woff2 = await compress(ttc);
  const facts = preflightWoff2(woff2);
  assert.equal(facts.collection, true);
  assert.equal(facts.fonts, 2);
  const out = await decodeWoff2(woff2);
  assert.deepEqual(out, new Uint8Array(await decompress(woff2)));
  assert.equal(new DataView(out.buffer, out.byteOffset).getUint32(0), 0x74746366);
});

test('preflight reads the real header without decompressing', () => {
  const bytes = read(SMALL);
  const facts = preflightWoff2(bytes);
  assert.equal(facts.flavor, 0x00010000);
  assert.equal(facts.collection, false);
  assert.equal(facts.totalSfntSize, corpus.fonts[SMALL]!.bytes);
  assert.ok(facts.uncompressedSize > 0 && facts.uncompressedSize <= facts.totalSfntSize);
  assert.equal(facts.compressedOffset + facts.compressedLength <= bytes.length, true);
});

test('files that are not WOFF2, or are too large to read, are refused by name', () => {
  assert.throws(() => preflightWoff2(read('shells/web/public/fonts/Outfit[wght].ttf')), refusedWith('not-woff2'));
  const big = new Uint8Array(WOFF2_LIMITS.maxInputBytes + 4);
  big.set([0x77, 0x4f, 0x46, 0x32]);
  assert.throws(() => preflightWoff2(big), refusedWith('too-large'));
});

test('a damaged header or directory is refused before the decoder runs', () => {
  const head = { index: 1, length: 54 };
  const cases: Array<[reason: string, bytes: Uint8Array]> = [
    ['header is incomplete', read(SMALL).subarray(0, 40)],
    ['length field does not match', woff2Of({ tables: [head], lengthField: 999 })],
    ['declares no tables', woff2Of({ tables: [] })],
    ['transformed loca table has a length', woff2Of({ tables: [{ index: 10, length: 100, transformLength: 80 }, { index: 11, length: 20, transformLength: 4 }] })],
    ['bytes after its last block', woff2Of({ tables: [head], trailing: 8 })],
    ['points at a missing table', woff2Of({ flavor: 0x74746366, tables: [head], collection: Uint8Array.of(0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 5) })],
    ['glyf and loca apart', woff2Of({ flavor: 0x74746366, tables: [head, { index: 10, length: 40, transformLength: 40 }, head, { index: 11, length: 12, transformLength: 0 }], collection: Uint8Array.of(0, 1, 0, 0, 1, 2, 0, 1, 0, 0, 1, 3) })],
  ];
  // Each case is refused for its own reason, not by an earlier check it happens to trip.
  for (const [reason, bytes] of cases) {
    assert.throws(() => preflightWoff2(bytes), (error) => refusedWith('malformed')(error) && (error as Error).message.includes(reason), reason);
  }
  assert.doesNotThrow(() => preflightWoff2(woff2Of({ tables: [head] })), 'the unchanged crafted file is accepted');
  // A base128 length with a leading zero byte, written by hand.
  const leading = woff2Of({ tables: [head] });
  leading[49] = 0x80;
  assert.throws(() => preflightWoff2(leading), /leading zero/);
});

test('declared sizes the decoder could not hold are refused, not attempted', async () => {
  // The measured case: an 11 MB file whose last table claims 1,000,000,000 bytes grew the
  // shared decoder by about 1 GB for the session. Its ratio is under 100, so only the
  // 30 MiB ceiling refuses the file.
  const huge = woff2Of({ tables: [{ index: 1, length: 54 }, { index: 5, length: 1_000_000_000 }], data: new Uint8Array(64), priv: 11_000_000 });
  assert.throws(() => preflightWoff2(huge), refusedWith('too-large'));
  await assert.rejects(decodeWoff2(huge), refusedWith('too-large'));
  // More data than 100 times the file size: google/woff2 refuses that ratio too.
  const ratio = woff2Of({ tables: [{ index: 5, length: 400_000 }], data: new Uint8Array(16) });
  assert.ok(ratio.length * 100 < 400_000);
  assert.throws(() => preflightWoff2(ratio), refusedWith('too-large'));
  // A caller's tighter limit applies to the preflight and to the output.
  await assert.rejects(decodeWoff2(read(SMALL), { maxOutputBytes: 1024 }), refusedWith('too-large'));
});

test('decoder output that is not a coherent sfnt is refused', () => {
  const sfnt = read('shells/web/public/fonts/Outfit[wght].ttf');
  checkSfntOutput(sfnt, { collection: false });
  const shifted = new Uint8Array(sfnt);
  new DataView(shifted.buffer).setUint32(12 + 8, sfnt.length);
  assert.throws(() => checkSfntOutput(shifted, { collection: false }), refusedWith('bad-output'));
  const flavor = new Uint8Array(sfnt);
  flavor.set([0x77, 0x4f, 0x46, 0x32]);
  assert.throws(() => checkSfntOutput(flavor, { collection: false }), refusedWith('bad-output'));
  assert.throws(() => checkSfntOutput(sfnt, { collection: true }), refusedWith('bad-output'));
  assert.throws(() => checkSfntOutput(sfnt, { collection: false }, 1024), refusedWith('too-large'));
});

test('one-byte changes to the header and directory give a checked font or a Woff2Error', async () => {
  const bytes = read(SMALL);
  const { compressedOffset } = preflightWoff2(bytes);
  let decoded = 0;
  for (let at = 0; at < compressedOffset; at++) {
    for (const value of [0x00, 0xff, (bytes[at]! + 1) & 0xff]) {
      if (value === bytes[at]) continue;
      const mutated = new Uint8Array(bytes);
      mutated[at] = value;
      try {
        const out = await decodeWoff2(mutated);
        checkSfntOutput(out, { collection: false });
        decoded++;
      } catch (error) {
        assert.ok(error instanceof Woff2Error, `byte ${at} = ${value}: ${String(error)}`);
      }
    }
  }
  // Header fields the decoder ignores (the reserved word, totalSfntSize, versions) still decode.
  assert.ok(decoded > 0);
  // And the decoder is still healthy afterwards.
  assert.equal(sha256(await decodeWoff2(bytes)), corpus.fonts[SMALL]!.sha256);
});
