// SPDX-License-Identifier: MPL-2.0
/**
 * der-read.js contract tests: the shared bounds-checked DER/ASN.1 TLV walker
 * under x509.ts, seal.ts and c2pa-verify.ts, plus the ECDSA signature-shape
 * conversions and the EC named-curve table.
 * Run with: node --test tests/der-read.test.ts
 *
 * CONTRACT (discovered by reading the module, asserted below): every entry
 * point is SYNCHRONOUS and THROWS on malformed input - it is the "throws
 * promptly" contract of docs/parser-inventory.md, not the house
 * never-throw/return-null reader contract. `derTlv` never returns a TLV whose
 * `end` reaches past the buffer, and it never returns a NaN offset.
 *
 * THE INVARIANT under test (the module header calls it "the GIF lesson"): a
 * multi-byte length head must be bounds-checked BEFORE its bytes are read,
 * because an out-of-range Uint8Array read yields `undefined`, `undefined`
 * NaN-poisons the accumulated length, and `j + NaN > b.length` is false - so a
 * naive walker's overrun guard passes silently and hands its caller a TLV with
 * end === NaN. `naiveDerTlv` below is that naive walker (it is deliberately the
 * structure of the in-file helper tests/x509.test.ts uses), and the pair of
 * assertions in "the NaN-poison read" pins the difference.
 *
 * DER inputs reach this module straight out of attacker-controlled files (an
 * x5chain in a foreign C2PA manifest, a SEAL record in an uploaded image), so
 * "throws" and "does not silently mis-parse" are both security properties.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { derTlv, derChildren, ecdsaDerToRaw, ecdsaRawToDer, EC_CURVES } from '../engine/src/der-read.ts';

// ─── local DER writer (fixtures only - never the module under test) ───────────

/** Minimal-form DER length: short form under 0x80, else 0x8k + k big-endian bytes. */
function derLen(n: number): Uint8Array {
  if (n < 0x80) return Uint8Array.of(n);
  const out: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) out.unshift(v & 0xff);
  return Uint8Array.of(0x80 | out.length, ...out);
}

function tlv(tag: number, body: Uint8Array): Uint8Array {
  const len = derLen(body.length);
  const out = new Uint8Array(1 + len.length + body.length);
  out[0] = tag;
  out.set(len, 1);
  out.set(body, 1 + len.length);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

const SEQUENCE = 0x30;
const INTEGER = 0x02;
const OCTET_STRING = 0x04;
const NULL_TAG = 0x05;

/**
 * The naive TLV walker this module exists to replace: it reads the k length
 * bytes WITHOUT checking that k of them are present. Kept here so the invariant
 * has a live counterexample rather than a comment.
 */
function naiveDerTlv(b: Uint8Array, i: number): { tag: number; contentStart: number; end: number } {
  const tag = b[i]!;
  let len = b[i + 1]!;
  let j = i + 2;
  if (len & 0x80) {
    const k = len & 0x7f;
    len = 0;
    for (let x = 0; x < k; x++) len = len * 256 + b[j++]!; // out-of-range → undefined → NaN
  }
  if (j + len > b.length) throw new Error('naive: length overruns buffer');
  return { tag, contentStart: j, end: j + len };
}

// ─── well-formed TLVs ─────────────────────────────────────────────────────────

test('short-form length: primitive and constructed TLVs report exact spans', () => {
  const octets = tlv(OCTET_STRING, Uint8Array.of(1, 2, 3));
  assert.deepEqual(derTlv(octets, 0), { tag: 0x04, start: 0, contentStart: 2, end: 5 });

  const seq = tlv(SEQUENCE, octets);
  assert.deepEqual(derTlv(seq, 0), { tag: 0x30, start: 0, contentStart: 2, end: 7 });

  // A TLV at a non-zero offset keeps `start` at the offset it was asked for.
  const pair = concat([Uint8Array.of(0xaa, 0xbb), octets]);
  assert.deepEqual(derTlv(pair, 2), { tag: 0x04, start: 2, contentStart: 4, end: 7 });
});

test('a zero-length value is legal: contentStart === end, no read of the content', () => {
  assert.deepEqual(derTlv(Uint8Array.of(NULL_TAG, 0x00), 0), { tag: 0x05, start: 0, contentStart: 2, end: 2 });
  // and it is legal as the LAST bytes of the buffer (the i + 2 header check is
  // an exact bound, not an off-by-one that demands a trailing byte).
  const seq = tlv(SEQUENCE, Uint8Array.of(NULL_TAG, 0x00));
  const kids = derChildren(seq, derTlv(seq, 0));
  assert.equal(kids.length, 1);
  assert.equal(kids[0]!.contentStart, kids[0]!.end);
});

test('long-form lengths (0x81/0x82/0x83) resolve to the right content span', () => {
  for (const n of [0x80, 0xff, 0x100, 0xffff, 0x10000]) {
    const body = new Uint8Array(n).fill(0x41);
    const bytes = tlv(OCTET_STRING, body);
    const head = 1 + derLen(n).length;
    const got = derTlv(bytes, 0);
    assert.equal(got.contentStart, head, `${n}: header width`);
    assert.equal(got.end, head + n, `${n}: content end`);
    assert.equal(got.end, bytes.length, `${n}: TLV tiles the buffer`);
  }
  // Explicit byte shapes, so a change in the accepted length forms is visible.
  assert.equal(derTlv(concat([Uint8Array.of(0x04, 0x81, 0x80), new Uint8Array(0x80)]), 0).end, 3 + 0x80);
  assert.equal(derTlv(concat([Uint8Array.of(0x04, 0x82, 0x01, 0x00), new Uint8Array(0x100)]), 0).end, 4 + 0x100);
  assert.equal(derTlv(concat([Uint8Array.of(0x04, 0x83, 0x01, 0x00, 0x00), new Uint8Array(0x10000)]), 0).end, 5 + 0x10000);
});

test('derChildren returns immediate children in order and they tile the container', () => {
  const kids = [tlv(INTEGER, Uint8Array.of(7)), tlv(OCTET_STRING, Uint8Array.of(1, 2)), tlv(NULL_TAG, new Uint8Array(0))];
  const seq = tlv(SEQUENCE, concat(kids));
  const top = derTlv(seq, 0);
  const got = derChildren(seq, top);
  assert.deepEqual(got.map((c) => c.tag), [0x02, 0x04, 0x05]);
  assert.equal(got[0]!.start, top.contentStart);
  assert.equal(got[0]!.end, got[1]!.start);
  assert.equal(got[1]!.end, got[2]!.start);
  assert.equal(got[2]!.end, top.end, 'children tile the parent exactly');
  // Nested constructed children are NOT flattened.
  const outer = tlv(SEQUENCE, seq);
  assert.deepEqual(derChildren(outer, derTlv(outer, 0)).map((c) => c.tag), [0x30]);
});

// ─── truncation and overrunning lengths (all THROW) ───────────────────────────

test('a truncated header throws "der: truncated"', () => {
  assert.throws(() => derTlv(new Uint8Array(0), 0), /der: truncated/);
  assert.throws(() => derTlv(Uint8Array.of(SEQUENCE), 0), /der: truncated/);
  // ...and reading past the last complete TLV throws rather than inventing one.
  const bytes = tlv(NULL_TAG, new Uint8Array(0));
  assert.throws(() => derTlv(bytes, 1), /der: truncated/);
  assert.throws(() => derTlv(bytes, bytes.length), /der: truncated/);
});

test('a length that claims more bytes than the buffer holds throws (short and long form)', () => {
  // short form: declares 5 content bytes, 2 present
  assert.throws(() => derTlv(Uint8Array.of(OCTET_STRING, 0x05, 1, 2), 0), /der: length overruns buffer/);
  // long form, complete head, content truncated: declares 0x0100, 4 present
  assert.throws(
    () => derTlv(concat([Uint8Array.of(OCTET_STRING, 0x82, 0x01, 0x00), new Uint8Array(4)]), 0),
    /der: length overruns buffer/,
  );
  // a 64-bit-wide length head cannot be reached without content to match it
  assert.throws(
    () => derTlv(Uint8Array.of(OCTET_STRING, 0x88, 255, 255, 255, 255, 255, 255, 255, 255), 0),
    /der: length overruns buffer/,
  );
  // maximum k (0x7f = 127 length bytes) is refused on the head bounds check
  assert.throws(
    () => derTlv(concat([Uint8Array.of(OCTET_STRING, 0xff), new Uint8Array(10)]), 0),
    /der: length overruns buffer/,
  );
});

test('truncation mid-value inside a container throws out of derChildren', () => {
  // A SEQUENCE whose declared content is present, but whose last child's value
  // is cut off at the buffer end.
  const bytes = concat([Uint8Array.of(SEQUENCE, 0x06, INTEGER, 0x01, 0x07, OCTET_STRING, 0x09, 0x00)]);
  assert.throws(() => derChildren(bytes, derTlv(bytes, 0)), /der: length overruns buffer/);
});

test('the NaN-poison read: a truncated long-form length HEAD throws, where a naive walker accepts it', () => {
  // 0x82 promises two length bytes; only one is present. This is the exact
  // input the module header describes.
  const poison = Uint8Array.of(SEQUENCE, 0x82, 0x01);

  // The naive walker reads b[3] === undefined, so len becomes NaN, `4 + NaN >
  // 3` is false, and its guard lets a NaN-ended TLV through.
  const naive = naiveDerTlv(poison, 0);
  assert.ok(Number.isNaN(naive.end), 'the naive walker really does NaN-poison its end offset');
  assert.equal(naive.tag, 0x30, 'and it returns a plausible-looking TLV');

  // The real walker checks j + k against the buffer BEFORE the loop.
  assert.throws(() => derTlv(poison, 0), /der: length overruns buffer/);

  // Same shape one byte further in, and with a wider k: still a prompt throw,
  // never a NaN.
  assert.throws(() => derTlv(Uint8Array.of(SEQUENCE, 0x83, 0x00, 0x01), 0), /der: length overruns buffer/);
  assert.throws(() => derTlv(Uint8Array.of(SEQUENCE, 0x84), 0), /der: length overruns buffer/);
});

test('no reachable input yields a NaN or out-of-range span (sweep over truncations of a real structure)', () => {
  // Every prefix of a nested structure either parses to an in-bounds TLV or
  // throws. Nothing in between - that is the whole contract in one loop.
  const full = tlv(SEQUENCE, concat([
    tlv(INTEGER, Uint8Array.of(0x01)),
    tlv(OCTET_STRING, new Uint8Array(200).fill(0x5a)),
    tlv(SEQUENCE, tlv(NULL_TAG, new Uint8Array(0))),
  ]));
  for (let cut = 0; cut <= full.length; cut++) {
    const bytes = full.subarray(0, cut);
    let got: ReturnType<typeof derTlv> | null = null;
    try { got = derTlv(bytes, 0); } catch (err) {
      assert.match((err as Error).message, /^der: (truncated|length overruns buffer)$/, `cut ${cut}`);
      continue;
    }
    assert.ok(Number.isSafeInteger(got.end), `cut ${cut}: end is a real number`);
    assert.ok(Number.isSafeInteger(got.contentStart), `cut ${cut}: contentStart is a real number`);
    assert.ok(got.end <= bytes.length, `cut ${cut}: span stays inside the buffer`);
    assert.ok(got.contentStart <= got.end, `cut ${cut}: span is not inverted`);
  }
});

// ─── forms the module accepts that DER itself does not ────────────────────────

test('the indefinite-length form (0x80) is NOT rejected: it reads as an empty TLV', () => {
  // BER's indefinite length is illegal in DER. This walker does not reject it:
  // 0x80 has the high bit set with k === 0, so the length accumulator stays 0
  // and the TLV is reported as zero-length, with its would-be content left to
  // the caller's sibling walk. Documented here because it is the module's real
  // behaviour, and because every consumer (x509/seal/c2pa-verify) ultimately
  // gates on a signature over the bytes, so a mis-parse fails closed rather
  // than validating.
  assert.deepEqual(
    derTlv(Uint8Array.of(SEQUENCE, 0x80, NULL_TAG, 0x00, 0x00, 0x00), 0),
    { tag: 0x30, start: 0, contentStart: 2, end: 2 },
  );
  // Consequence: an indefinite container's content is walked as its SIBLINGS.
  const bytes = concat([Uint8Array.of(SEQUENCE, 0x06, SEQUENCE, 0x80), tlv(NULL_TAG, new Uint8Array(0)), Uint8Array.of(0x00, 0x00)]);
  const kids = derChildren(bytes, derTlv(bytes, 0));
  assert.deepEqual(kids.map((c) => c.tag), [0x30, 0x05, 0x00], 'the inner NULL becomes a sibling of the indefinite SEQUENCE');
});

test('a child may overrun its parent when the buffer continues past it', () => {
  // derTlv bounds-checks against the BUFFER, and derChildren stops at the
  // parent's end without re-checking that the last child fitted inside it. A
  // hostile inner length can therefore report a span that reaches past the
  // container it was read from (still inside the buffer - never out of bounds).
  // Pinned as behaviour, not endorsed: callers that slice by a child's span
  // must not assume the parent bounded it.
  const bytes = concat([Uint8Array.of(SEQUENCE, 0x02, OCTET_STRING, 0x06), new Uint8Array(6).fill(0xcc)]);
  const top = derTlv(bytes, 0);
  assert.equal(top.end, 4);
  const kids = derChildren(bytes, top);
  assert.equal(kids.length, 1);
  assert.equal(kids[0]!.end, 10, 'the child reports an end past its parent');
  assert.ok(kids[0]!.end <= bytes.length, 'but never past the buffer');
});

// ─── depth ────────────────────────────────────────────────────────────────────

test('deep nesting: no declared depth cap, and no stack growth to blow', () => {
  // The module declares NO MAX_DEPTH - deliberately, per its header: derTlv
  // reads one TLV and derChildren iterates one level, so neither recurses and
  // depth costs a caller's loop, not stack frames. 5000 levels (well past any
  // certificate) walk clean; a depth cap would have to live in the caller.
  const DEPTH = 5000;
  let bytes = tlv(NULL_TAG, new Uint8Array(0));
  for (let i = 0; i < DEPTH; i++) bytes = tlv(SEQUENCE, bytes);

  let node = derTlv(bytes, 0);
  let walked = 0;
  while (node.tag === SEQUENCE) {
    const kids = derChildren(bytes, node);
    assert.equal(kids.length, 1, `level ${walked}`);
    node = kids[0]!;
    walked++;
  }
  assert.equal(walked, DEPTH);
  assert.equal(node.tag, NULL_TAG);

  // The pathological flat case: a buffer that is nothing but constructed
  // headers with truncated content must throw, not walk forever.
  assert.throws(() => derChildren(new Uint8Array(4096).fill(SEQUENCE), derTlv(concat([Uint8Array.of(SEQUENCE, 0x82, 0x10, 0x00), new Uint8Array(4096).fill(SEQUENCE)]), 0)), /der:/);
});

// ─── ECDSA signature shapes ───────────────────────────────────────────────────

test('ecdsaRawToDer → ecdsaDerToRaw round-trips every curve width', () => {
  for (const { size } of Object.values(EC_CURVES)) {
    for (const fill of [0x01, 0x7f, 0x80, 0xff]) {
      const raw = new Uint8Array(size * 2).fill(fill);
      const der = ecdsaRawToDer(raw);
      assert.equal(derTlv(der, 0).tag, SEQUENCE);
      assert.deepEqual(derChildren(der, derTlv(der, 0)).map((c) => c.tag), [INTEGER, INTEGER]);
      assert.deepEqual(ecdsaDerToRaw(der, size), raw, `size ${size} fill ${fill}`);
    }
    // Halves with leading zeros (the minimal-INTEGER path) and all-zero halves.
    const padded = new Uint8Array(size * 2);
    padded[size - 1] = 0x09;
    assert.deepEqual(ecdsaDerToRaw(ecdsaRawToDer(padded), size), padded, `size ${size} leading zeros`);
    const zero = new Uint8Array(size * 2);
    assert.deepEqual(ecdsaDerToRaw(ecdsaRawToDer(zero), size), zero, `size ${size} all zero`);
  }
});

test('ecdsaRawToDer emits minimal INTEGERs with a 0x00 sign pad only when needed', () => {
  // r high bit set → 0x00-prefixed; s leading zeros → stripped.
  const raw = new Uint8Array(64);
  raw.fill(0xff, 0, 32);
  raw[32] = 0x00; raw[33] = 0x00; raw[34] = 0x11;
  const der = ecdsaRawToDer(raw);
  const [r, s] = derChildren(der, derTlv(der, 0));
  assert.equal(der[r!.contentStart], 0x00, 'r gained a sign pad');
  assert.equal(r!.end - r!.contentStart, 33);
  assert.equal(der[s!.contentStart], 0x11, 's leading zeros stripped');
  assert.equal(s!.end - s!.contentStart, 30);
  // and it still restores to the original fixed-width bytes
  assert.deepEqual(ecdsaDerToRaw(der, 32), raw);
});

test('ecdsaDerToRaw rejects anything that is not a well-formed ECDSA-Sig-Value', () => {
  const good = ecdsaRawToDer(new Uint8Array(64).fill(0x22));
  // wrong outer tag (SET instead of SEQUENCE)
  const wrongTag = good.slice();
  wrongTag[0] = 0x31;
  assert.throws(() => ecdsaDerToRaw(wrongTag, 32), /not an ECDSA-Sig-Value/);
  // one INTEGER only
  assert.throws(() => ecdsaDerToRaw(tlv(SEQUENCE, tlv(INTEGER, Uint8Array.of(5))), 32), /not an ECDSA-Sig-Value/);
  // right arity, wrong child tags
  assert.throws(
    () => ecdsaDerToRaw(tlv(SEQUENCE, concat([tlv(OCTET_STRING, Uint8Array.of(1)), tlv(OCTET_STRING, Uint8Array.of(2))])), 32),
    /not an ECDSA-Sig-Value/,
  );
  // an integer wider than the curve field must not be silently truncated
  assert.throws(() => ecdsaDerToRaw(good, 16), /wider than the curve/);
  // truncation surfaces as the walker's own error, not a bad signature
  assert.throws(() => ecdsaDerToRaw(good.subarray(0, good.length - 4), 32), /der: length overruns buffer/);
  assert.throws(() => ecdsaDerToRaw(new Uint8Array(1), 32), /der: truncated/);
});

test('EC_CURVES pins the OID → curve/hash/field-width table', () => {
  assert.deepEqual(EC_CURVES['2a8648ce3d030107'], { curve: 'P-256', hash: 'SHA-256', size: 32 });
  assert.deepEqual(EC_CURVES['2b81040022'], { curve: 'P-384', hash: 'SHA-384', size: 48 });
  assert.deepEqual(EC_CURVES['2b81040023'], { curve: 'P-521', hash: 'SHA-512', size: 66 });
  assert.equal(Object.keys(EC_CURVES).length, 3, 'a new curve needs its paired SHA and field width checked here');
  // The size column is what ecdsaDerToRaw pads to: it must match the field size
  // (P-521 is 66 bytes, not 64 - the classic off-by-two in this table).
  for (const [oid, { size }] of Object.entries(EC_CURVES)) {
    const raw = new Uint8Array(size * 2).fill(0x5a);
    assert.deepEqual(ecdsaDerToRaw(ecdsaRawToDer(raw), size), raw, oid);
  }
});
