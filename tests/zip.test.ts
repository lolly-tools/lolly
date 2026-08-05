// SPDX-License-Identifier: MPL-2.0
/**
 * zip.ts — round-trip + wire-format assertions for the shared plain-zip primitive.
 * Fixtures are built in-test (storeZip → readZip, and by hand-poking raw bytes)
 * so nothing external is trusted.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readZip, storeZip } from '../engine/src/zip.ts';

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Little-endian uint16/uint32 reads for poking at the wire format. */
const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) => (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

test('round-trips mixed text + binary entries exactly', () => {
  const highlyCompressible = enc.encode('lolly '.repeat(4000)); // deflates well
  const binary = new Uint8Array(1024);
  for (let i = 0; i < binary.length; i++) binary[i] = (i * 37 + 11) & 0xff;
  const empty = new Uint8Array(0);

  const input = [
    { name: 'hello.txt', bytes: enc.encode('Hello, 世界! — a UTF-8 name test é') },
    { name: 'dir/nested/data.bin', bytes: binary },
    { name: 'big.txt', bytes: highlyCompressible },
    { name: 'empty', bytes: empty },
  ];

  const zip = storeZip(input);
  const out = readZip(zip);

  assert.equal(out.length, input.length);
  for (let i = 0; i < input.length; i++) {
    assert.equal(out[i]!.name, input[i]!.name, `name ${i}`);
    assert.deepEqual(out[i]!.bytes, input[i]!.bytes, `bytes for ${input[i]!.name}`);
  }
});

test('a deflated entry is actually stored with method 8 and inflates back', () => {
  const text = enc.encode('the quick brown fox '.repeat(500));
  const zip = storeZip([{ name: 'f.txt', bytes: text }]);

  // The first local file header's method field (offset 8) must be 8 (DEFLATE),
  // and its compressed size (offset 18) strictly smaller than the original.
  assert.equal(u32(zip, 0), 0x04034b50, 'local header signature');
  assert.equal(u16(zip, 8), 8, 'method is DEFLATE');
  const compSize = u32(zip, 18);
  const uncompSize = u32(zip, 22);
  assert.equal(uncompSize, text.length);
  assert.ok(compSize < uncompSize, `compressed (${compSize}) < original (${uncompSize})`);

  const [entry] = readZip(zip);
  assert.deepEqual(entry!.bytes, text);
});

test('mimetypeFirst stores an uncompressed mimetype as the very first entry', () => {
  const mimetype = enc.encode('application/epub+zip');
  // Give it AFTER other entries, with mimetype content long enough that it would
  // normally deflate — proving the reorder + force-stored, not luck.
  const input = [
    { name: 'META-INF/container.xml', bytes: enc.encode('<container/>'.repeat(50)) },
    { name: 'mimetype', bytes: mimetype },
    { name: 'OEBPS/ch1.xhtml', bytes: enc.encode('<p>body</p>'.repeat(50)) },
  ];

  const zip = storeZip(input, { mimetypeFirst: true });

  // First local entry must be the mimetype, STORED (method 0), name "mimetype".
  assert.equal(u32(zip, 0), 0x04034b50, 'local header signature');
  assert.equal(u16(zip, 8), 0, 'method is STORED');
  const nameLen = u16(zip, 26);
  const name = dec.decode(zip.subarray(30, 30 + nameLen));
  assert.equal(name, 'mimetype', 'first entry name');
  // Its data is verbatim, right after the header (no extra field).
  const extraLen = u16(zip, 28);
  const dataStart = 30 + nameLen + extraLen;
  assert.deepEqual(zip.subarray(dataStart, dataStart + mimetype.length), mimetype);

  // And it still reads back correctly, mimetype first.
  const out = readZip(zip);
  assert.equal(out[0]!.name, 'mimetype');
  assert.deepEqual(out[0]!.bytes, mimetype);
  assert.equal(out.length, 3);
});

test('a corrupted CRC throws', () => {
  const zip = storeZip([{ name: 'f.txt', bytes: enc.encode('data that will be tampered with') }]);

  // Flip one byte of the STORED payload without touching the CRC in the headers.
  // (This short, incompressible-ish string stores; find the byte after the local
  // header + name and corrupt it.)
  const nameLen = u16(zip, 26);
  const extraLen = u16(zip, 28);
  const dataStart = 30 + nameLen + extraLen;
  const bad = zip.slice();
  bad[dataStart] = bad[dataStart]! ^ 0xff;

  assert.throws(() => readZip(bad), /CRC-32 mismatch/);
});

test('tolerates a trailing archive comment on the EOCD', () => {
  const zip = storeZip([{ name: 'a', bytes: enc.encode('alpha') }]);
  const comment = enc.encode('this is a trailing zip comment');
  // Rewrite the EOCD comment-length field (last 2 bytes of a comment-less EOCD)
  // and append the comment bytes.
  const withComment = new Uint8Array(zip.length + comment.length);
  withComment.set(zip, 0);
  withComment.set(comment, zip.length);
  const eocdCommentLenOff = zip.length - 2;
  withComment[eocdCommentLenOff] = comment.length & 0xff;
  withComment[eocdCommentLenOff + 1] = (comment.length >> 8) & 0xff;

  const out = readZip(withComment);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.name, 'a');
  assert.deepEqual(out[0]!.bytes, enc.encode('alpha'));
});

test('rejects a non-zip buffer', () => {
  assert.throws(() => readZip(enc.encode('not a zip at all, no EOCD here')), /end-of-central-directory/);
});

test('rejects duplicate entry names on write', () => {
  assert.throws(
    () => storeZip([
      { name: 'dup', bytes: enc.encode('one') },
      { name: 'dup', bytes: enc.encode('two') },
    ]),
    /duplicate entry name/,
  );
});
