// SPDX-License-Identifier: MPL-2.0
/**
 * The connection plate - a private collab's short authentication string
 * (plan 100 section 1, section 6.1; Andy's decision, 2026-08-10).
 *
 * Six characters that two humans read to each other. The properties below are the ones
 * that decide whether that comparison means anything at all:
 *
 *  - ORDER-INDEPENDENCE. The inviter holds (mine, theirs) and the acceptor holds
 *    (theirs, mine). If the derivation were role-shaped, every working pairing would show
 *    two different plates and the check would read as an attack on every honest connect - 
 *    the failure mode that gets a security control switched off.
 *  - SEPARATION. Distinct pairs must give distinct plates, or the comparison passes for a
 *    substitution. Pinned probabilistically over a deterministic corpus, and structurally
 *    for the one collision a hash-of-concatenation invites: ([1,2],[3]) against
 *    ([1],[2,3]), which are the same three bytes without length framing.
 *  - FORM. `XXX-XXX`, and never a character a phone call can turn into another one.
 *  - THE VECTORS. Four fixtures over the real SHA-256, so the derivation cannot be
 *    "refactored" into a different function that still passes every property above. The
 *    plate is a wire-visible contract in the only sense that matters: two devices running
 *    two builds have to agree, or the pair is told it is under attack.
 *
 * The rejection sampling and the block extension are pinned through the injected hasher,
 * because no fixture over the real digest can reach a block whose bytes are all rejected.
 *
 * Run directly:  node --test shells/web/src/collab/plate.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PLATE_ALPHABET,
  PLATE_CHARS,
  PLATE_DOMAIN,
  PLATE_DOMAIN_NATIVE,
  PLATE_RE,
  derivePlate,
  derivePlateFromTranscript,
  formatPlate,
  orderFingerprints,
} from './plate.ts';

/** The suite's fingerprints: 32 bytes, distinct per seed. Same shape as the transport's. */
const fp = (seed: number, length = 32): Uint8Array =>
  Uint8Array.from({ length }, (_, i) => (i * 7 + seed * 31) & 0xff);

/**
 * A seeded byte source, so "512 random pairs" is a fixed corpus that cannot flake either
 * way. The HIGH byte, not the low one: a power-of-two-modulus LCG's low bits have a
 * period of 256, which quietly hands the same fingerprints out again - the corpus stops
 * being 512 distinct pairs and the separation check starts passing for the wrong reason.
 * (It failed for the right one first, which is how this comment exists.)
 */
function lcgBytes(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state >>> 24;
  };
}

// ── Form ──────────────────────────────────────────────────────────────────────────

test('a plate is three symbols, a hyphen and three symbols', async () => {
  const plate = await derivePlate(fp(0), fp(1));
  assert.match(plate, PLATE_RE);
  assert.equal(plate.length, PLATE_CHARS + 1);
  assert.equal(plate[3], '-');
  assert.equal(formatPlate('ABCDEF'), 'ABC-DEF');
});

test('the alphabet carries nothing a phone call can turn into something else', () => {
  // Crockford's four (I, L, O, U) plus the three this file adds. Each one is a character
  // that survives the screen and dies on the way through a human - which is the only
  // channel a plate ever travels.
  for (const banned of ['I', 'L', 'O', 'U', '0', '1', 'B']) {
    assert.ok(!PLATE_ALPHABET.includes(banned), `${banned} must not be in the plate alphabet`);
  }
  assert.equal(PLATE_ALPHABET.length, 29);
  assert.equal(new Set(PLATE_ALPHABET).size, 29, 'no symbol appears twice');
  assert.match(PLATE_ALPHABET, /^[2-9A-Z]+$/, 'upper-case letters and digits only');
});

test('every symbol of the alphabet can actually be drawn', async () => {
  // A reduction that could never reach the tail of the alphabet would shrink the space
  // silently - the plate would still look right and be worth less than it claims.
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) {
    for (const ch of await derivePlate(fp(i), fp(i + 977))) if (ch !== '-') seen.add(ch);
  }
  assert.equal(seen.size, PLATE_ALPHABET.length, `only ${seen.size} of 29 symbols were ever drawn`);
});

// ── Order-independence ────────────────────────────────────────────────────────────

test('both roles derive the same plate: the pair is sorted, never role-ordered', async () => {
  for (const [a, b] of [
    [fp(0), fp(1)],
    [fp(9), fp(2)],
    [new Uint8Array(32), new Uint8Array(32).fill(0xff)],
    [fp(4, 32), fp(4, 48)], // a longer fingerprint (SHA-384) against a shorter one
  ] as const) {
    assert.equal(await derivePlate(a, b), await derivePlate(b, a), 'swapping the arguments changed the plate');
  }
});

test('orderFingerprints: byte-lexicographic, shorter prefix first', () => {
  const [x, y] = orderFingerprints(Uint8Array.from([2, 0]), Uint8Array.from([1, 9]));
  assert.deepEqual([...x], [1, 9]);
  assert.deepEqual([...y], [2, 0]);
  const [p, q] = orderFingerprints(Uint8Array.from([1, 2, 3]), Uint8Array.from([1, 2]));
  assert.deepEqual([...p], [1, 2], 'a prefix sorts before what extends it');
  assert.deepEqual([...q], [1, 2, 3]);
});

test('a device paired with itself still derives a plate rather than throwing', async () => {
  // A loopback pair is how the browser drill runs, and a thrown derivation there would
  // read as a broken feature rather than the degenerate case it is.
  assert.match(await derivePlate(fp(3), fp(3)), PLATE_RE);
});

// ── Separation ────────────────────────────────────────────────────────────────────

test('512 distinct pairs give 512 distinct plates', async () => {
  const rand = lcgBytes(0x5eed);
  const plates = new Map<string, string>();
  for (let i = 0; i < 512; i++) {
    const a = Uint8Array.from({ length: 32 }, rand);
    const b = Uint8Array.from({ length: 32 }, rand);
    const plate = await derivePlate(a, b);
    const key = `${[...a].join()}|${[...b].join()}`;
    const clash = plates.get(plate);
    assert.equal(clash, undefined, `two pairs share the plate ${plate}:\n  ${clash}\n  ${key}`);
    plates.set(plate, key);
  }
  assert.equal(plates.size, 512);
});

test('one flipped bit anywhere in either fingerprint changes the plate', async () => {
  const base = fp(0);
  const peer = fp(1);
  const reference = await derivePlate(base, peer);
  for (const index of [0, 1, 7, 15, 31]) {
    const mutated = Uint8Array.from(base);
    mutated[index]! ^= 0x01;
    assert.notEqual(await derivePlate(mutated, peer), reference, `flipping byte ${index} left the plate alone`);
  }
  const peerMutated = Uint8Array.from(peer);
  peerMutated[31]! ^= 0x80;
  assert.notEqual(await derivePlate(base, peerMutated), reference);
});

test('length framing: two pairs that concatenate identically do not share a plate', async () => {
  // ([1,2],[3]) and ([1],[2,3]) are the bytes 1,2,3 either way. Without the length byte
  // in front of each fingerprint they hash to one plate, and a check whose whole claim is
  // "these two fingerprints and no others" would be agreeing with a different pairing.
  const one = await derivePlate(Uint8Array.from([1, 2]), Uint8Array.from([3]));
  const two = await derivePlate(Uint8Array.from([1]), Uint8Array.from([2, 3]));
  assert.notEqual(one, two);
});

// ── Known vectors (the real SHA-256) ─────────────────────────────────────────────

test('known vectors: the derivation is pinned, not merely well-behaved', async () => {
  // Generated by this module and pinned by hand. If one of these changes, the plate two
  // devices show each other has changed with it - which is a wire-compatibility break
  // between builds, not a test that needs updating.
  assert.equal(PLATE_DOMAIN, 'lolly/collab/plate/v1', 'the domain string is part of every vector below');
  assert.equal(await derivePlate(fp(0), fp(1)), 'PYC-VQC');
  assert.equal(await derivePlate(new Uint8Array(32), new Uint8Array(32).fill(0xff)), 'PRY-W8J');
  assert.equal(
    await derivePlate(
      Uint8Array.from({ length: 32 }, (_, i) => i),
      Uint8Array.from({ length: 32 }, (_, i) => 255 - i),
    ),
    'WAM-SDJ',
  );
  assert.equal(await derivePlate(Uint8Array.from([1, 2]), Uint8Array.from([3])), 'YTZ-N3Z');
});

// ── The injected hasher ──────────────────────────────────────────────────────────

test('bytes that would bias the draw are discarded, not reduced', async () => {
  // 232 is 8 × 29: everything at or above it is thrown away. A `% 29` over the whole byte
  // range would draw the first three symbols ~12.5% more often than the rest, and this is
  // the only place that can be seen - the real digest never serves a scripted block.
  const block = Uint8Array.from([232, 240, 255, 0, 1, 2, 28, 29, 30, 231]);
  const plate = await derivePlate(fp(0), fp(1), { hash: async () => block });
  const expect =
    PLATE_ALPHABET[0]! + PLATE_ALPHABET[1]! + PLATE_ALPHABET[2]!
    + '-'
    + PLATE_ALPHABET[28]! + PLATE_ALPHABET[0]! + PLATE_ALPHABET[1]!;
  assert.equal(plate, expect, '0,1,2,28,29,30 → the first three symbols, the last symbol, then wrap');
});

test('a block with no usable bytes extends the stream instead of biasing it', async () => {
  const calls: Uint8Array[] = [];
  const plate = await derivePlate(fp(0), fp(1), {
    hash: async (input) => {
      calls.push(Uint8Array.from(input));
      // Every byte of the first block is rejected; the second carries the plate.
      return calls.length === 1 ? new Uint8Array(32).fill(255) : Uint8Array.from({ length: 32 }, (_, i) => i);
    },
  });
  assert.equal(calls.length, 2, 'the counter mints another block rather than reaching for a rejected byte');
  assert.match(plate, PLATE_RE);
  const first = calls[0]!;
  const second = calls[1]!;
  assert.equal(first.length, second.length);
  assert.equal(first[first.length - 1], 0, 'the counter is the last byte of the preimage');
  assert.equal(second[second.length - 1], 1);
  assert.deepEqual(
    [...first.slice(0, -1)],
    [...second.slice(0, -1)],
    'only the counter moves between blocks - the fingerprints are hashed identically',
  );
});

test('the preimage is domain-separated and length-framed', async () => {
  // Collected into an array rather than a `let … | null`: control-flow analysis cannot see
  // that the hasher runs, so it narrows the assertion's truthy branch to `never` and the
  // reads below stop typechecking. The array carries the same "was it called?" evidence.
  const calls: Uint8Array[] = [];
  await derivePlate(Uint8Array.from([0xaa, 0xbb]), Uint8Array.from([0xcc]), {
    hash: async (input) => {
      calls.push(Uint8Array.from(input));
      return new Uint8Array(32).fill(7);
    },
  });
  const seen = calls[0];
  assert.ok(seen, 'the hasher was never called');
  const domain = new TextEncoder().encode(PLATE_DOMAIN);
  assert.deepEqual([...seen.slice(0, domain.length)], [...domain]);
  assert.deepEqual(
    [...seen.slice(domain.length)],
    [0x00, 2, 0xaa, 0xbb, 1, 0xcc, 0],
    'separator, then each fingerprint behind its own length byte, sorted, then the counter',
  );
});

test('a hasher that can never yield six symbols fails loudly rather than spinning', async () => {
  await assert.rejects(
    derivePlate(fp(0), fp(1), { hash: async () => new Uint8Array(32).fill(255) }),
    /yielded no plate/,
  );
  await assert.rejects(derivePlate(fp(0), fp(1), { hash: async () => new Uint8Array(0) }), /yielded no plate/);
});

test('a hasher that throws is not swallowed: no plate is better than a wrong one', async () => {
  await assert.rejects(
    derivePlate(fp(0), fp(1), { hash: async () => { throw new Error('no Web Crypto'); } }),
    /no Web Crypto/,
  );
});

// ── Refusals ─────────────────────────────────────────────────────────────────────

test('an absent or impossible fingerprint is refused, never hashed as nothing', async () => {
  await assert.rejects(derivePlate(new Uint8Array(0), fp(1)), /fingerprint must be/);
  await assert.rejects(derivePlate(fp(0), new Uint8Array(0)), /fingerprint must be/);
  await assert.rejects(derivePlate(new Uint8Array(256), fp(1)), /fingerprint must be/);
  await assert.rejects(
    derivePlate(undefined as unknown as Uint8Array, fp(1)),
    /fingerprint must be/,
    'a caller that reads material off a transport that has none must not get a plate',
  );
});

// ── Native transport plate (Noise handshake hash) ───────────────────────────────────

test('a transcript plate has the plate form', async () => {
  assert.match(await derivePlateFromTranscript(fp(5)), PLATE_RE);
});

test('the same handshake hash always yields the same plate (both peers agree)', async () => {
  const h = fp(9);
  assert.equal(await derivePlateFromTranscript(h), await derivePlateFromTranscript(fp(9)));
});

test('a different handshake hash yields a different plate (a MITM leg diverges)', async () => {
  const base = await derivePlateFromTranscript(fp(11));
  // Flip one byte of h - the transcript a man-in-the-middle would produce on one leg.
  const mutated = fp(11);
  mutated[7]! ^= 0x01;
  assert.notEqual(await derivePlateFromTranscript(mutated), base);
});

test('the native domain is separated from the DTLS domain, so plates never collide', async () => {
  assert.notEqual(PLATE_DOMAIN_NATIVE, PLATE_DOMAIN);
  // Same 32 bytes fed to the DTLS pair-derivation (as local==remote==h) vs the transcript
  // derivation must NOT produce the same plate: the domain string is part of the preimage.
  const h = fp(13);
  const asTranscript = await derivePlateFromTranscript(h);
  const asPairDegenerate = await derivePlate(h, h); // a degenerate DTLS pairing over the same bytes
  assert.notEqual(asTranscript, asPairDegenerate, 'domain separation failed - the two plates match');
});

test('an empty or oversized transcript hash is refused, never an approximate plate', async () => {
  await assert.rejects(() => derivePlateFromTranscript(new Uint8Array(0)), /transcript hash must be/);
  await assert.rejects(() => derivePlateFromTranscript(new Uint8Array(256)), /transcript hash must be/);
  await assert.rejects(() => derivePlateFromTranscript(undefined as unknown as Uint8Array), /transcript hash must be/);
});
