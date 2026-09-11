// SPDX-License-Identifier: MPL-2.0
/**
 * plate - the connection plate, a private collab's short authentication string
 * (plan 100 section 1, section 6.1; Andy's decision, 2026-08-10).
 *
 * WHAT THIS IS, AND WHAT IT IS NOT. Plan 100 section 1 floated a license-plate code as a third
 * SKIN - six spoken characters standing in for the invite blob, redeemed against a tiny
 * rendezvous. Andy's call reverses the direction: the plate is the CONFIRMATION, never a
 * carrier. It carries no material, needs no rendezvous, and is derived from the pairing
 * that already exists. The link and the QR stay the only things that move SDP, so the
 * "codes need a server" trade in section 1 does not apply to this at all - an airgapped pair
 * gets a plate exactly like everyone else.
 *
 * It is the ZRTP-style SAS (RFC 6189 section 7), doing the one job a fingerprint-carrying blob
 * cannot do on its own: proving the blob was not swapped in flight. Both screens show six
 * characters at the moment they connect; the humans compare them out loud. Matching
 * plates mean both devices hashed the SAME PAIR of DTLS certificate fingerprints, which
 * they can only do if each one is holding the other's real certificate. A middleman has
 * to terminate DTLS on both sides - two certificates of its own, which is two
 * fingerprints neither human's device ever saw - and no substitution it can make in the
 * invite or the reply produces two matching plates. It cannot compute a plate for a pair
 * of fingerprints it is not, itself, one half of.
 *
 * THE MATERIAL IS THE THING THE HANDSHAKE ACTUALLY VALIDATED. `rtc-transport.ts` hands
 * over the fingerprint it extracted from its OWN local description and the one it decoded
 * from the peer's blob - the same bytes it reconstructed the remote SDP from, so the same
 * bytes DTLS checked the certificate against. A plate derived from anything else (a
 * re-read of the SDP text, a fingerprint the UI cached) would be a number that agrees with
 * itself and proves nothing.
 *
 * ── The alphabet: 29 characters, and each exclusion has a reason ──────────────────
 *
 * `23456789ACDEFGHJKMNPQRSTVWXYZ`. Crockford base32 already drops I, L, O and U - I and L
 * against the digit 1, O against 0, U so a code cannot spell an accident. Three more go,
 * because this code is SPOKEN and typed from hearing rather than scanned:
 *
 *  - **0 and 1.** Crockford's answer to O/0 and I/L/1 is a tolerant DECODER: it accepts
 *    the letters and folds them onto the digits. A plate has no decoder. The comparator
 *    is two people on a phone, and "oh" against "zero" is precisely the ambiguity the
 *    comparison must not absorb - the one moment the two strings differ is the moment the
 *    whole mechanism exists for.
 *  - **B.** 8 stays (the digits earn their place: an all-letter plate reads as a word,
 *    and a word gets remembered and half-recalled instead of compared character by
 *    character), and B against 8 is the last pair in Crockford's set that a condensed
 *    face still blurs.
 *
 * What that leaves is 29 symbols, which is deliberately NOT a power of two - see
 * {@link derivePlate} for why the draw is rejection-sampled rather than reduced.
 *
 * Six characters is 29^6 ≈ 5.9 × 10^8, a shade over 29 bits. ZRTP's own SAS is 2^16 over
 * four base32 characters; this is ~8000× that, and an attacker gets exactly one attempt - 
 * the plate is compared once, at connect, over a DTLS session whose keys are already
 * fixed. There is no oracle to grind against and nothing to retry.
 *
 * ── Async, with the hasher injected ──────────────────────────────────────────────
 *
 * Web Crypto's digest is async, so this is async, and the hasher arrives the way
 * `beam-protocol.ts`'s does: a default that reaches for `crypto.subtle` and throws a
 * named error when there is none, overridable by the caller. That seam is what lets the
 * suite pin the rejection sampling and the block-extension path against a scripted
 * digest, which no fixture over the real SHA-256 could reach.
 *
 * Pure: no DOM, no clock, no storage, no RTC. It takes two byte arrays and returns a
 * string, which is why the ceremony dialog may import it without importing a transport.
 */

/**
 * The 29 symbols a plate is drawn from - see the header for what each exclusion buys.
 * Crockford base32 (no I, L, O, U) minus 0, 1 and B.
 */
export const PLATE_ALPHABET = '23456789ACDEFGHJKMNPQRSTVWXYZ';

/** How many symbols one plate carries. */
export const PLATE_CHARS = 6;

/** How many symbols per group; a plate is displayed `XXX-XXX`. */
export const PLATE_GROUP = 3;

/**
 * Domain separation. A digest with no purpose stamped into it is a digest that can be
 * replayed as a different one - this string is what stops a plate ever being confused
 * with (or substituted for) some other SHA-256 over the same two fingerprints.
 */
export const PLATE_DOMAIN = 'lolly/collab/plate/v1';

/** What a rendered plate looks like: three symbols, a hyphen, three symbols. */
export const PLATE_RE = new RegExp(`^[${PLATE_ALPHABET}]{${PLATE_GROUP}}-[${PLATE_ALPHABET}]{${PLATE_CHARS - PLATE_GROUP}}$`);

/**
 * The two DTLS certificate fingerprints one pairing is built on: ours, and the peer's
 * as its blob declared it.
 *
 * Bytes only, deliberately. The algorithm is implied by the length (32/48/64 for
 * SHA-256/384/512, the only three `sdp-codec.ts` accepts) and the length is framed into
 * the preimage, so two different algorithms can never collide into one preimage.
 */
export interface PlateMaterial {
  /** This device's own fingerprint, from the local description it minted its blob from. */
  readonly local: Uint8Array;
  /** The peer's, decoded from the blob that was applied as the remote description. */
  readonly remote: Uint8Array;
}

/** A complete-buffer digest. The default is SHA-256; a test injects its own. */
export type PlateHasher = (bytes: Uint8Array) => Promise<Uint8Array>;

/** Bytes above this are DISCARDED rather than reduced - see {@link derivePlate}. */
const REJECT_FROM = 256 - (256 % PLATE_ALPHABET.length); // 232 = 8 × 29

/** A fingerprint is length-framed into a single byte, so it must fit in one. */
const MAX_FINGERPRINT_BYTES = 255;

/**
 * SHA-256 over a complete buffer. Same shape and same missing-crypto stance as
 * `beam-protocol.ts`'s `sriSha256`: a runtime with no Web Crypto is told so by name
 * rather than handed a weaker digest.
 */
export const sha256Bytes: PlateHasher = async (bytes) => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('plate: no Web Crypto - cannot derive a connection plate');
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Uint8Array(await subtle.digest('SHA-256', copy.buffer));
};

/**
 * Byte-lexicographic order, with the shorter of two prefixes first.
 *
 * This is the whole reason both devices compute the same plate without agreeing on who
 * is who: the inviter holds (mine, theirs) and the acceptor holds (theirs, mine), and
 * sorting collapses the two into one ordered pair. Nothing role-shaped is hashed - 
 * putting the role in would make the two sides derive different plates and turn a working
 * pairing into a permanent mismatch.
 */
export function orderFingerprints(a: Uint8Array, b: Uint8Array): [Uint8Array, Uint8Array] {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    if (av !== bv) return av < bv ? [a, b] : [b, a];
  }
  return a.length <= b.length ? [a, b] : [b, a];
}

/**
 * `DOMAIN || 0x00 || len(first) || first || len(second) || second || counter`.
 *
 * Every variable-length field is length-framed. Without that, ([1,2], [3]) and ([1],
 * [2,3]) hash the same three bytes and two unrelated pairings share a plate - which for
 * a check whose entire job is "these two fingerprints, and no others" would be the one
 * defect that matters. The counter is what extends the digest stream when rejection
 * sampling runs a block dry.
 */
function preimage(domain: Uint8Array, first: Uint8Array, second: Uint8Array, counter: number): Uint8Array {
  const out = new Uint8Array(domain.length + 1 + 1 + first.length + 1 + second.length + 1);
  let at = 0;
  out.set(domain, at);
  at += domain.length;
  out[at++] = 0x00;
  out[at++] = first.length;
  out.set(first, at);
  at += first.length;
  out[at++] = second.length;
  out.set(second, at);
  at += second.length;
  out[at] = counter;
  return out;
}

/** `ABCDEF` → `ABC-DEF`. Split out so a caller can format a plate it already has. */
export function formatPlate(symbols: string): string {
  return `${symbols.slice(0, PLATE_GROUP)}-${symbols.slice(PLATE_GROUP)}`;
}

/**
 * The SAS domain for the native (Noise-over-TCP) transport, plans/110 section 4. DISTINCT from
 * `PLATE_DOMAIN` on purpose: a native plate is derived from a Noise handshake hash, a
 * DTLS plate from a pair of certificate fingerprints, and separating the domains means a
 * value drawn for one transport can never be read as, or substituted for, the other's.
 */
export const PLATE_DOMAIN_NATIVE = 'lolly/collab/plate/native/v1';

/** `DOMAIN || 0x00 || len(value) || value || counter` - the single-value preimage, for a
 *  shared transcript hash both peers compute identically (so no ordering is needed). */
function preimageSingle(domain: Uint8Array, value: Uint8Array, counter: number): Uint8Array {
  const out = new Uint8Array(domain.length + 1 + 1 + value.length + 1);
  let at = 0;
  out.set(domain, at);
  at += domain.length;
  out[at++] = 0x00;
  out[at++] = value.length;
  out.set(value, at);
  at += value.length;
  out[at] = counter;
  return out;
}

/**
 * The plate for a native pairing, from the Noise handshake hash `h` (plans/110 section 4).
 *
 * Unlike {@link derivePlate}, there is no PAIR to order: after a completed Noise XX
 * handshake both peers hold the SAME `h`, a transcript hash over both static keys, both
 * ephemerals, and every handshake message. A man-in-the-middle who terminated and
 * re-originated the handshake computes a DIFFERENT `h` on each leg, so equal plates prove
 * one unbroken handshake.
 *
 * CRUCIAL CAVEAT (review finding #1): this holds ONLY because the native transport binds the
 * initiator to its static key BEFORE the handshake (the static-key commitment in
 * `native_transport.rs run_initiator`/`run_responder`). A bare XX handshake hash is NOT a
 * safe 6-char SAS input on its own - the initiator picks its static in the last message, so a
 * MITM could grind it (~2^29) to force a matching plate. The commitment removes that freedom;
 * do not treat `h` as a safe SAS input for any handshake that lacks it.
 *
 * Rejection-sampled and domain-framed exactly like {@link derivePlate}; throws rather than
 * returning an approximate plate, for the same reason.
 */
export async function derivePlateFromTranscript(
  h: Uint8Array,
  opts: { readonly hash?: PlateHasher } = {},
): Promise<string> {
  if (!(h instanceof Uint8Array) || h.length === 0 || h.length > MAX_FINGERPRINT_BYTES) {
    throw new Error(`plate: a transcript hash must be 1–${MAX_FINGERPRINT_BYTES} bytes`);
  }
  const hash = opts.hash ?? sha256Bytes;
  const domain = new TextEncoder().encode(PLATE_DOMAIN_NATIVE);
  let symbols = '';
  for (let counter = 0; counter < 256 && symbols.length < PLATE_CHARS; counter++) {
    const block = await hash(preimageSingle(domain, h, counter));
    for (const byte of block) {
      if (symbols.length === PLATE_CHARS) break;
      if (byte >= REJECT_FROM) continue;
      symbols += PLATE_ALPHABET[byte % PLATE_ALPHABET.length];
    }
  }
  if (symbols.length < PLATE_CHARS) throw new Error('plate: the digest stream yielded no plate');
  return formatPlate(symbols);
}

/**
 * The plate for one pairing: `XXX-XXX`, identical on both devices.
 *
 * Order-independent by construction (see {@link orderFingerprints}), so neither side has
 * to know whether it invited or accepted.
 *
 * **Why rejection sampling.** 29 does not divide 256, so `byte % 29` would draw the first
 * three symbols of the alphabet ~12.5% more often than the rest - a real, if modest,
 * narrowing of the space a forger has to hit, and a bias that is free to avoid. Bytes at
 * or above {@link REJECT_FROM} (232 = 8 × 29) are discarded instead; each surviving byte
 * is uniform over the 29 symbols. About 9.4% of bytes are thrown away, so a 32-byte
 * digest almost always yields the six symbols in its first block - and when it does not,
 * the counter mints another block rather than reaching for a biased shortcut. Every path
 * is deterministic: the same two fingerprints always produce the same plate.
 *
 * Throws on an empty or oversized fingerprint, and on a hasher that cannot answer (no Web
 * Crypto, by default). It never returns a partial or a placeholder plate: a caller shows
 * nothing rather than something wrong, because a plate the humans might read out is the
 * one thing here that must not be approximate.
 */
export async function derivePlate(
  fpA: Uint8Array,
  fpB: Uint8Array,
  opts: { readonly hash?: PlateHasher } = {},
): Promise<string> {
  for (const fp of [fpA, fpB]) {
    if (!(fp instanceof Uint8Array) || fp.length === 0 || fp.length > MAX_FINGERPRINT_BYTES) {
      throw new Error(`plate: a fingerprint must be 1–${MAX_FINGERPRINT_BYTES} bytes`);
    }
  }
  const hash = opts.hash ?? sha256Bytes;
  const [first, second] = orderFingerprints(fpA, fpB);
  const domain = new TextEncoder().encode(PLATE_DOMAIN);

  let symbols = '';
  // 256 blocks of rejection-sampled digest without six survivors is not a case that
  // exists (p < 2^-1000); the bound is here so a broken injected hasher - one that
  // returns nothing, or nothing but rejected bytes - fails loudly instead of spinning.
  for (let counter = 0; counter < 256 && symbols.length < PLATE_CHARS; counter++) {
    const block = await hash(preimage(domain, first, second, counter));
    for (const byte of block) {
      if (symbols.length === PLATE_CHARS) break;
      if (byte >= REJECT_FROM) continue;
      symbols += PLATE_ALPHABET[byte % PLATE_ALPHABET.length];
    }
  }
  if (symbols.length < PLATE_CHARS) throw new Error('plate: the digest stream yielded no plate');
  return formatPlate(symbols);
}
