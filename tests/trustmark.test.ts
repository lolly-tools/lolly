/**
 * TrustMark BCH data-layer tests (engine/src/trustmark.ts).
 * Run with: node --test tests/trustmark.test.ts
 *
 * How REAL_VECTORS / BOUNDARY_VECTORS / NOISE_VECTORS below were produced —
 * NOT hand-written, NOT this module's own output echoed back at itself:
 *
 *   1. Fetched `python/trustmark/bchecc.py` (the BCH engine) and
 *      `python/trustmark/datalayer.py` (the schema/version framing) verbatim
 *      from github.com/adobe/trustmark @ main (MIT-licensed — see
 *      engine/src/trustmark.ts's header for the full notice).
 *   2. bchecc.py has zero external dependencies and ran as-is. datalayer.py
 *      imports numpy only to wrap plain str/bytearray operations in an array
 *      shape its own encode/decode methods never actually need — those exact
 *      operations (raw_payload_split, process_encode, the decode framing)
 *      were reimplemented one-for-one in a small numpy-free Python harness
 *      calling the SAME unmodified bchecc.BCH class.
 *   3. That harness encoded a random payload per schema version (seeded,
 *      reproducible), then decoded: the pristine packet, one with a single
 *      bit flipped, one with exactly `t` bits flipped (the guaranteed-
 *      correctable maximum), one with `t+1` bits flipped (one past that
 *      bound), one heavily corrupted (~40% of the data+ecc bits), and 200
 *      independent random 100-bit strings with no relation to any valid
 *      packet (a false-positive-rate sweep).
 *   4. Every one of those (216 total incl. the 200-sample sweep) was then run
 *      through THIS FILE's `decodeTrustmarkPayload` and compared byte-for-
 *      byte against the Python reference's answer before this suite was
 *      written — 216/216 matched, including the reference's own single
 *      random false-accept (NOISE_VECTORS' one `valid: true` row). This test
 *      file embeds a representative slice of that cross-check as permanent
 *      regression coverage, not the full 216 (excessive for a unit suite).
 *
 * This validates the BCH/ECC bit-level math against Adobe's own algorithm.
 * It does NOT validate the neural decoder (pixels → 100 raw bits) — no ONNX
 * model, image, or browser is available in this environment. See
 * shells/web/src/lib/trustmark.ts's header for that half of the picture.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  decodeTrustmarkPayload, createBchEngine, bchEncode, bchDecode,
  TRUSTMARK_PAYLOAD_BITS,
} from '../engine/src/trustmark.ts';

// Deterministic PRNG — tests must not depend on Math.random (project convention;
// see tests/steganalysis.test.ts).
function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 48271) % 0x7fffffff) / 0x7fffffff;
}

function bitsFromString(s: string): number[] {
  return s.split('').map((c) => Number(c));
}

// ─── Real vectors, generated from Adobe's OWN unmodified reference implementation ──
// (python/trustmark/{bchecc,datalayer}.py fetched from github.com/adobe/trustmark @
// main, MIT-licensed) via the harness described in this file's header — an
// independent oracle, not this port's own output. Regenerate if TrustMark's
// reference ever changes its bit layout.
interface RealVector {
  version: number; t: number; dataBits: number; secret: string; packet: string;
  singleBitFlip: { corrupted: string };
  maxCorrectable: { corrupted: string };
  heavyCorruption: { corrupted: string };
}
const REAL_VECTORS: RealVector[] = [
  {
    version: 0, t: 8, dataBits: 40,
    secret: '1000000100001110000010010001011110010001',
    packet: '1000000100001110000010010001011110010001101111101010101110010111110000000100100101110111100101100000',
    singleBitFlip: { corrupted: '1000000100101110000010010001011110010001101111101010101110010111110000000100100101110111100101100000' },
    maxCorrectable: { corrupted: '0000000100000110000010011001011110011001101111100010101110011111110000001100100101111111100101100000' },
    heavyCorruption: { corrupted: '1001011101001100001101111000011010101010101101100010111110101110110101110001110100111111001001110000' },
  },
  {
    version: 1, t: 5, dataBits: 61,
    secret: '1110101111001100111010010110010010001110101001010101001010111',
    packet: '1110101111001100111010010110010010001110101001010101001010111110000000111000011100000101111000100001',
    singleBitFlip: { corrupted: '1110101111101100111010010110010010001110101001010101001010111110000000111000011100000101111000100001' },
    maxCorrectable: { corrupted: '0110101111001100111110010110010010001100101001010101001011111110000000111000111100000101111000100001' },
    heavyCorruption: { corrupted: '0110110001011100000111010101010011010100011001011110100110111110001011011100011001101100110100110001' },
  },
  {
    version: 2, t: 4, dataBits: 68,
    secret: '11011011010110011111011011100110100110011111101001111100011001000011',
    packet: '1101101101011001111101101110011010011001111110100111110001100100001101111110010101110000101001100010',
    singleBitFlip: { corrupted: '1101101101111001111101101110011010011001111110100111110001100100001101111110010101110000101001100010' },
    maxCorrectable: { corrupted: '0101101101011001111101100110011010011001111110101111110001100100001101110110010101110000101001100010' },
    heavyCorruption: { corrupted: '1111101111111001000110101110101111100000100101100101110101100011111011110000010101100100011010100010' },
  },
  {
    version: 3, t: 3, dataBits: 75,
    secret: '101011001001110010111010011100000001011111110101100010111101001001101111111',
    packet: '1010110010011100101110100111000000010111111101011000101111010010011011111110111110100111010000010011',
    singleBitFlip: { corrupted: '1010110010111100101110100111000000010111111101011000101111010010011011111110111110100111010000010011' },
    maxCorrectable: { corrupted: '0010110010011100101110100111000010010111111101011000101111010010111011111110111110100111010000010011' },
    heavyCorruption: { corrupted: '1010010011100000001110101111001010010001010100011011101100001000010100001100111010101100111110110011' },
  },
];

// Exactly t+1 bit errors (one past the guaranteed-correctable radius) — the reference
// rejects all four; a real BCH code is not obligated to (bounded-distance decoding
// only GUARANTEES correction up to t, not rejection beyond it), so this is an
// empirical-match check against the reference, not a mathematical necessity.
const BOUNDARY_VECTORS: Array<{ version: number; corrupted: string; refValid: boolean }> = [
  { version: 0, corrupted: '0010010000011011101001101011010111110011110101000111111110100111111011101011100001101101001000110000', refValid: false },
  { version: 1, corrupted: '1010011111011001100100111000100100001110011110010001110000001111010110101000010011001011110100000001', refValid: false },
  { version: 2, corrupted: '1111000000000010100010100000010010100101011011001101110001110011011000011101010011010011001110100010', refValid: false },
  { version: 3, corrupted: '0101001100100010010100111011011001011000010011011001001110110101011101100000100110000010111100100011', refValid: false },
];

// Pure random 100-bit noise (no relation to any valid packet), decoded exactly as
// decodeTrustmarkPayload would in production — read whatever schema the trailing 2
// bits happen to name, decode only that. 26 of the reference's 200-sample sweep,
// selected to include its ONE false accept (a real, expected BCH property — a
// t-error-correcting code occasionally decodes unstructured noise to some valid
// codeword by chance; the reference's own rate here is 1/200 = 0.5%). Each row's
// `valid`/`data` is the REFERENCE's answer, not a hand-picked expectation.
const NOISE_VECTORS: Array<{ bits: string; valid: boolean; version: number; data: string }> = [
  { bits: '0010110111001010110011010010010001100011010000110010000011011000100101011101011010111000100111100001', valid: false, version: 1, data: '0010110111001010110011010010010001100011010000110010000011011' },
  { bits: '1100111111000011001000001000111110010011100001101000110001101001000010010111001000010100101010011111', valid: false, version: 3, data: '110011111100001100100000100011111001001110000110100011000110100100001001011' },
  { bits: '1000110101001010010001010010101111110001000000001011000100001110011110101011010011010100001100100101', valid: false, version: 1, data: '1000110101001010010001010010101111110001000000001011000100001' },
  { bits: '0010000101011000111000101101000000111101111110100011111110011011111011001101011101110100111010110011', valid: false, version: 3, data: '001000010101100011100010110100000011110111111010001111111001101111101100110' },
  { bits: '1110001100011011011110001100010001101100000110000101110010011110001101110110111110000010000001101001', valid: false, version: 1, data: '1110001100011011011110001100010001101100000110000101110010011' },
  { bits: '0110001101100101110100101000111100001011100100110111000000111010010000011000100101000011110011111001', valid: false, version: 1, data: '0110001101100101110100101000111100001011100100110111000000111' },
  { bits: '0001111101011001000001010011001011000011000011000011010110100010001100110110000110001100011000110101', valid: false, version: 1, data: '0001111101011001000001010011001011000011000011000011010110100' },
  { bits: '0101000000000111110111101110001101000000000000010100100001001011100101001111010001111000111010110000', valid: false, version: 0, data: '0101000000000111110111101110001101000000' },
  { bits: '0111111010101101101100000100000111101001010000000010111001010101000101100101111111000111001001110101', valid: false, version: 1, data: '0111111010101101101100000100000111101001010000000010111001010' },
  { bits: '1000000110101001100000101100111000111010010111101001110000100011011001011011100110011011110101000111', valid: false, version: 3, data: '100000011010100110000010110011100011101001011110100111000010001101100101101' },
  { bits: '0011101111110000011110100110100001011111110111011001110011000010101100010010100100011000110001000001', valid: false, version: 1, data: '0011101111110000011110100110100001011111110111011001110011000' },
  { bits: '1011011111110111011011011110010000111110011111010100011100111000111100111101110010011001000010001001', valid: false, version: 1, data: '1011011111110111011011011110010000111110011111010100011100111' },
  { bits: '1010111100111110011001100110101101011001011011000110101111101001100011011000101001001011110011111111', valid: false, version: 3, data: '101011110011111001100110011010110101100101101100011010111110100110001101100' },
  { bits: '0011101001001001110101100100110001100010110101111111010010111001011010010000001101011111001110110110', valid: false, version: 2, data: '00111010010010011101011001001100011000101101011111110100101110010110' },
  { bits: '0110011001100000101100101010011011011110011010011000111101101000001000100110000101010110011111110110', valid: false, version: 2, data: '01100110011000001011001010100110110111100110100110001111011010000010' },
  { bits: '1010001111110111100000011011011100100111000001010001010000101100001101010000111110111110100100011000', valid: false, version: 0, data: '1010001111110111100000011011011100100111' },
  { bits: '1011101010000001011011100000111001001011110001111001110011100101111000101111000010110101001111101010', valid: false, version: 2, data: '10111010100000010110111000001110010010111100011110011100111001011110' },
  { bits: '1011100101001110101010110101001101011010101010111001111111111101110101101000100110101011110011001100', valid: false, version: 0, data: '1011100101001110101010110101001101011010' },
  { bits: '1101111000110011011101110001010100010011100011100111110011011010000101110111001100100100101010100011', valid: false, version: 3, data: '110111100011001101110111000101010001001110001110011111001101101000010111011' },
  { bits: '1111001111001110110001100000001111000011001100111001101101111011000101101000111101001100001100110010', valid: false, version: 2, data: '11110011110011101100011000000011110000110011001110011011011110110001' },
  { bits: '0111111000011100010110101110000011010111010111011111001111001011100101010000000101100111000100001110', valid: false, version: 2, data: '01111110000111000101101011100000110101110101110111110011110010111001' },
  { bits: '0100101101001101000001101011000011111111000111001101000101110011000011111111110101100110101111011110', valid: false, version: 2, data: '01001011010011010000011010110000111111110001110011010001011100110000' },
  { bits: '1101110100010111011110000001001001011000101001010000001010100010000001000000101001001111110111101010', valid: false, version: 2, data: '11011101000101110111100000010010010110001010010100000010101000100000' },
  { bits: '1010101111010010000010010101000100100111001001001110110101011000000001010000001110101000010000000000', valid: false, version: 0, data: '1010101111010010000010010101000100100111' },
  { bits: '1011100111110100010110101001110000001101110111111100110010010001100011101110100110010111101011001111', valid: false, version: 3, data: '101110011111010001011010100111000000110111011111110011001001000110001110111' },
  { bits: '0011111101000010100010111100101100111011100000000110110010000000010011000011100010110111010010001111', valid: true, version: 3, data: '011111110100001010101011100010110011101110000000011011001000000001001100001' },
];

// ─── decodeTrustmarkPayload: real-reference cross-checks ────────────────────

test('decodeTrustmarkPayload: pristine packets decode to their exact secret, every schema', () => {
  for (const v of REAL_VECTORS) {
    const r = decodeTrustmarkPayload(bitsFromString(v.packet));
    assert.equal(r.valid, true, `version ${v.version} pristine should validate`);
    assert.equal(r.version, v.version);
    assert.equal(r.dataBits, v.secret, `version ${v.version} recovered data should match the encoded secret`);
    assert.equal(r.dataBits.length, v.dataBits);
  }
});

test('decodeTrustmarkPayload: a single-bit error is corrected, every schema', () => {
  for (const v of REAL_VECTORS) {
    const r = decodeTrustmarkPayload(bitsFromString(v.singleBitFlip.corrupted));
    assert.equal(r.valid, true, `version ${v.version} single-bit-flip should still validate`);
    assert.equal(r.dataBits, v.secret, `version ${v.version} should recover the original secret despite the flip`);
  }
});

test('decodeTrustmarkPayload: exactly t bit errors (the guaranteed-correctable max) are still corrected', () => {
  for (const v of REAL_VECTORS) {
    const r = decodeTrustmarkPayload(bitsFromString(v.maxCorrectable.corrupted));
    assert.equal(r.valid, true, `version ${v.version} (t=${v.t}) should correct exactly t errors`);
    assert.equal(r.dataBits, v.secret);
  }
});

test('decodeTrustmarkPayload: heavy corruption is rejected — never silently returns wrong data', () => {
  for (const v of REAL_VECTORS) {
    const r = decodeTrustmarkPayload(bitsFromString(v.heavyCorruption.corrupted));
    assert.equal(r.valid, false, `version ${v.version} heavy corruption must not validate`);
    // The honest failure shape: no payload offered up as if it were real.
    assert.equal(r.dataBits, '');
    assert.equal(r.payloadHex, '');
  }
});

test('decodeTrustmarkPayload: t+1 bit errors match the reference\'s rejection', () => {
  for (const b of BOUNDARY_VECTORS) {
    const r = decodeTrustmarkPayload(bitsFromString(b.corrupted));
    assert.equal(r.valid, b.refValid, `version ${b.version} at t+1 errors should match the reference`);
  }
});

test('decodeTrustmarkPayload: pure random noise is classified exactly as the reference classifies it', () => {
  let sawTheKnownFalseAccept = false;
  for (const n of NOISE_VECTORS) {
    const r = decodeTrustmarkPayload(bitsFromString(n.bits));
    assert.equal(r.valid, n.valid, `noise row should match the reference's valid/invalid verdict`);
    assert.equal(r.version, n.version);
    if (n.valid) {
      assert.equal(r.dataBits, n.data);
      sawTheKnownFalseAccept = true;
    }
  }
  // Confirms the fixture actually exercises the false-accept row (not just 25
  // rejections) — a t-error-correcting BCH code IS expected to occasionally
  // accept unstructured noise; the point of this suite is that our port's
  // rate of doing so matches the reference's, not that it never happens.
  assert.equal(sawTheKnownFalseAccept, true);
});

// ─── Input-shape guards (no reference needed — pure length/bounds checks) ───

test('decodeTrustmarkPayload: wrong-length input is rejected without throwing', () => {
  for (const len of [0, 1, 99, 101, 1000]) {
    const r = decodeTrustmarkPayload(new Array(len).fill(0));
    assert.equal(r.valid, false);
    assert.equal(r.version, -1);
    assert.equal(r.schema, 'unknown');
  }
});

test('decodeTrustmarkPayload: accepts booleans as well as 0/1 numbers', () => {
  const bits = bitsFromString(REAL_VECTORS[0]!.packet).map((b) => !!b);
  const r = decodeTrustmarkPayload(bits);
  assert.equal(r.valid, true);
  assert.equal(r.dataBits, REAL_VECTORS[0]!.secret);
});

test('TRUSTMARK_PAYLOAD_BITS is 100 (96 data+ecc + 4 version bits, per the reference)', () => {
  assert.equal(TRUSTMARK_PAYLOAD_BITS, 100);
});

// ─── Low-level BCH engine: structural invariants (this module's own encode+decode) ──
// These exercise createBchEngine/bchEncode/bchDecode directly (not through the
// datalayer framing above), across freshly-generated random payloads — a second,
// independent angle on the same "corrects up to t, rejects beyond it" property,
// this time generated and checked entirely within this port rather than against
// an external oracle.

test('BCH engine: eccBits/eccBytes match the reference for every TrustMark schema', () => {
  // GF(2^7) (n=127) is what poly=137 actually builds (see engine/src/trustmark.ts's
  // header) — these figures come straight from running Adobe's own bchecc.py.
  const expected = [
    { t: 8, eccBits: 56, eccBytes: 7 },
    { t: 5, eccBits: 35, eccBytes: 5 },
    { t: 4, eccBits: 28, eccBytes: 4 },
    { t: 3, eccBits: 21, eccBytes: 3 },
  ];
  for (const e of expected) {
    const engine = createBchEngine(e.t, 137);
    assert.equal(engine.m, 7);
    assert.equal(engine.n, 127);
    assert.equal(engine.eccBits, e.eccBits, `t=${e.t} eccBits`);
    assert.equal(engine.eccBytes, e.eccBytes, `t=${e.t} eccBytes`);
  }
});

test('BCH engine: a valid codeword (zero corruption) decodes with zero reported bitflips', () => {
  const rnd = lcg(99);
  for (const t of [8, 5, 4, 3]) {
    const engine = createBchEngine(t, 137);
    const dataLen = 8; // bytes — arbitrary, well within this engine's capacity
    const data = Array.from({ length: dataLen }, () => Math.floor(rnd() * 256));
    const ecc = bchEncode(engine, data);
    const flips = bchDecode(engine, data.slice(), ecc.slice());
    assert.equal(flips, 0, `t=${t} pristine codeword should report 0 corrected bits`);
  }
});

test('BCH engine: single-bit and exactly-t-bit corruption are corrected; data is recovered exactly', () => {
  const rnd = lcg(7);
  for (const t of [8, 5, 4, 3]) {
    const engine = createBchEngine(t, 137);
    const dataLen = 8;
    const original = Array.from({ length: dataLen }, () => Math.floor(rnd() * 256));
    const ecc = bchEncode(engine, original);

    // Flip exactly 1 bit in the data bytes.
    const oneFlip = original.slice();
    oneFlip[0] = oneFlip[0]! ^ 0x01;
    const flips1 = bchDecode(engine, oneFlip, ecc.slice());
    assert.ok(flips1 >= 0, `t=${t} single-bit flip should be correctable (got ${flips1})`);
    assert.deepEqual(oneFlip, original, `t=${t} recovered data should equal the original after 1-bit correction`);

    // Flip exactly t bits, spread across the data bytes (data is 8 bytes = 64
    // bits, comfortably more than the largest t=8 here).
    const tFlip = original.slice();
    for (let i = 0; i < t; i++) {
      const byteIdx = i % dataLen;
      tFlip[byteIdx] = tFlip[byteIdx]! ^ (1 << (i % 8));
    }
    const flipsT = bchDecode(engine, tFlip, ecc.slice());
    assert.ok(flipsT >= 0, `t=${t} exactly-t-bit corruption should be correctable (got ${flipsT})`);
    assert.deepEqual(tFlip, original, `t=${t} recovered data should equal the original after t-bit correction`);
  }
});

test('BCH engine: corrupting the ecc bytes themselves (not just data) is also correctable up to t', () => {
  const rnd = lcg(2024);
  for (const t of [8, 5, 4, 3]) {
    const engine = createBchEngine(t, 137);
    const original = Array.from({ length: 8 }, () => Math.floor(rnd() * 256));
    const ecc = bchEncode(engine, original);
    const corruptedEcc = ecc.slice();
    corruptedEcc[0] = corruptedEcc[0]! ^ 0x01;
    const data = original.slice();
    const flips = bchDecode(engine, data, corruptedEcc);
    assert.ok(flips >= 0, `t=${t} single ecc-byte bit flip should be correctable`);
    assert.deepEqual(data, original, `t=${t} data should be untouched/confirmed correct`);
  }
});
