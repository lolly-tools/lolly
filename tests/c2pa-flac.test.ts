// SPDX-License-Identifier: MPL-2.0
/**
 * FLAC C2PA placer/reader round-trip.
 * Run with: node --test tests/c2pa-flac.test.ts
 *
 * FLAC has no C2PA-spec container binding (c2pa-rs has no FLAC reader), so this
 * is a Lolly-only credential - the JUMBF store rides in an APPLICATION metadata
 * block (type 2, application id 'C2PA') inserted after STREAMINFO. Same class as
 * the Ogg/WebM bindings: Lolly's own verifier reads it, c2patool does not.
 *
 * These prove the correctness half: the placed file STILL PARSES as valid FLAC
 * (fLaC marker, STREAMINFO first, exactly one terminal metadata block, block
 * lengths land exactly on the audio frames), the manifest reads back byte-for-byte,
 * the signed embed verifies end-to-end and its hard binding catches a frame tamper.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { embedC2pa, attachC2paStore, C2PA_FORMATS } from '../engine/src/c2pa.ts';
import { verifyC2pa, sniffFormat, extractC2paStore } from '../engine/src/c2pa-verify.ts';

const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const ascii = (b: Uint8Array, o: number, n: number): string => String.fromCharCode(...b.subarray(o, o + n));
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// A FLAC metadata block: 1 header byte [last<<7 | type], 3-byte BE length, body.
const block = (type: number, last: boolean, body: Uint8Array): Uint8Array =>
  concat([Uint8Array.of((last ? 0x80 : 0) | type, (body.length >> 16) & 0xff, (body.length >> 8) & 0xff, body.length & 0xff), body]);

// STREAMINFO (type 0) is always 34 bytes; content is never decoded by the binding.
function streaminfo(last: boolean): Uint8Array {
  const body = new Uint8Array(34);
  body[0] = 0x10; // min block size 4096 - just so it is not all zeros
  return block(0, last, body);
}
const FRAMES = bytesOf('FLACFRAMES!'); // a recognizable frame region (11 bytes)

// STREAMINFO is the only metadata block (its last-block flag is set).
const tinyFlac = (): Uint8Array => concat([bytesOf('fLaC'), streaminfo(true), FRAMES]);
// STREAMINFO (not last) then a PADDING block (type 1, last) - exercises the
// "other blocks follow STREAMINFO" branch of the flag re-derivation.
const flacWithPadding = (): Uint8Array => concat([bytesOf('fLaC'), streaminfo(false), block(1, true, new Uint8Array(16)), FRAMES]);

/** Independent structural check: walk the metadata chain and return where the
 *  audio frames begin. Asserts the FLAC invariants the placer must preserve. */
function parseFlac(bytes: Uint8Array): { framesStart: number; blockTypes: number[] } {
  assert.equal(ascii(bytes, 0, 4), 'fLaC', 'fLaC marker');
  let off = 4;
  const blockTypes: number[] = [];
  let terminated = false;
  while (off + 4 <= bytes.length) {
    const header = bytes[off]!;
    const last = (header & 0x80) !== 0;
    const type = header & 0x7f;
    const len = (bytes[off + 1]! << 16) | (bytes[off + 2]! << 8) | bytes[off + 3]!;
    if (blockTypes.length === 0) assert.equal(type, 0, 'first metadata block is STREAMINFO');
    blockTypes.push(type);
    off += 4 + len;
    assert.ok(off <= bytes.length, `block length overruns file at type ${type}`);
    if (last) { terminated = true; break; }
  }
  assert.ok(terminated, 'exactly one metadata block carries the terminal flag');
  return { framesStart: off, blockTypes };
}

const OPTS = {
  title: 'FLAC Fixture',
  claimGenerator: 'Lolly lolly.tools',
  generatorInfo: { name: 'Lolly', version: '1.9.0' },
  environment: { tool: 'Fixture Tool', format: 'flac', surface: 'test', engine: 'node', os: 'test' },
  author: { name: 'Testy McTestface' },
};

test('flac is a declared stampable format', () => {
  assert.ok(C2PA_FORMATS.includes('flac'));
  assert.equal(sniffFormat(tinyFlac()), 'flac');
});

for (const [name, fixture] of [['streaminfo-only', tinyFlac], ['streaminfo+padding', flacWithPadding]] as Array<[string, () => Uint8Array]>) {
  test(`placeFlac (${name}): places a known manifest, file still parses, reads back byte-for-byte`, () => {
    // A payload spanning every byte value (0x00 and high bytes included) so
    // byte-exactness is a real test, not an ASCII-only one.
    const known = Uint8Array.from({ length: 257 }, (_, i) => i & 0xff);
    const out = attachC2paStore(fixture(), 'flac', known);

    // (c) still a valid FLAC: STREAMINFO first, exactly one terminal block, and
    // the metadata chain sits EXACTLY on the untouched audio frames.
    const { framesStart, blockTypes } = parseFlac(out);
    assert.equal(blockTypes[0], 0, 'STREAMINFO stays first');
    assert.equal(blockTypes[1], 2, 'our credential is the second block (APPLICATION)');
    assert.equal(ascii(out, framesStart, FRAMES.length), 'FLACFRAMES!', 'audio frames are byte-identical and unmoved');

    // (d) the manifest reads back byte-for-byte through the extract side.
    const ex = extractC2paStore(out);
    assert.ok(ex, 'extractC2paStore finds the FLAC credential');
    assert.equal(ex!.format, 'flac');
    assert.deepEqual(Array.from(ex!.store), Array.from(known), 'manifest is byte-identical after the round-trip');
  });
}

test('flac: signed embed verifies end-to-end, and a frame tamper breaks the binding', async () => {
  const out = await embedC2pa(tinyFlac(), 'flac', OPTS);
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  assert.equal(report.madeWithLolly, true);
  assert.equal(report.format, 'flac');
  assert.deepEqual(report.author, { name: 'Testy McTestface' });

  // Flip a byte of the ORIGINAL audio frames (the file's last byte is frame
  // content - placeFlac appends nothing after the frames): the byte-range data
  // hash must fail, and nothing else.
  const tampered = out.slice();
  tampered[out.length - 1] = tampered[out.length - 1]! ^ 0x01;
  const broken = await verifyC2pa(tampered);
  assert.equal(broken.state, 'invalid');
  assert.ok(broken.checks.some((c) => c.code === 'assertion.dataHash.mismatch' && !c.ok), JSON.stringify(broken.checks));
});

test('flac: re-stamping replaces the credential instead of stacking a second APPLICATION block', async () => {
  const once = await embedC2pa(tinyFlac(), 'flac', OPTS);
  const twice = await embedC2pa(once, 'flac', { ...OPTS, title: 'Second Pass' });
  // Still exactly ONE C2PA APPLICATION block (a stacked second one would show as
  // a second type-2 block before the frames).
  const { blockTypes } = parseFlac(twice);
  assert.equal(blockTypes.filter((t) => t === 2).length, 1, 'the prior credential was replaced, not accumulated');
  const report = await verifyC2pa(twice);
  assert.equal(report.state, 'valid', 'flac re-stamp verifies');
  assert.equal(report.claim?.title, 'Second Pass', 'newest credential wins');
});

test('placeFlac on non-FLAC bytes fails cleanly, like the other placers', () => {
  assert.throws(() => attachC2paStore(bytesOf('not a flac file at all........'), 'flac', new Uint8Array(4)), /not a FLAC/);
  // A malformed FLAC (a metadata length that overruns the file) is refused,
  // not read past.
  const broken = concat([bytesOf('fLaC'), Uint8Array.of(0x80, 0xff, 0xff, 0xff), new Uint8Array(4)]);
  assert.throws(() => attachC2paStore(broken, 'flac', new Uint8Array(4)), /malformed FLAC/);
});
