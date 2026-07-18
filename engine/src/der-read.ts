// SPDX-License-Identifier: MPL-2.0
/**
 * DER/ASN.1 read-side authority — the bounds-checked TLV walker plus the ECDSA
 * signature-shape conversions and the EC named-curve table, shared by the
 * certificate/signature modules (c2pa-verify.ts, x509.ts, seal.ts). These used
 * to be per-module copies; this is the one canonical implementation.
 *
 * INTERNAL — deliberately NOT exported from index.ts; consumers import this
 * module directly (x509.ts re-exports ecdsaRawToDer for its existing callers).
 *
 * INVARIANT (the GIF lesson — same rule as the CBOR decoder in c2pa-verify.ts):
 * every multi-byte length head is bounds-checked BEFORE its bytes are read.
 * An out-of-range Uint8Array read yields undefined, which NaN-poisons the
 * computed length and silently defeats the `j + len > b.length` guard below —
 * hostile input must fail with a prompt throw, never a silent mis-parse.
 * DER inputs here come straight out of attacker-controlled files.
 */

import { concatBytes } from './bytes.ts';

export interface DerTlv { tag: number; start: number; contentStart: number; end: number; }

/** Read one DER TLV at offset `i`. Throws on truncation or a length that
 *  overruns the buffer — never returns a TLV that reaches past `b`. */
export function derTlv(b: Uint8Array, i: number): DerTlv {
  if (i + 2 > b.length) throw new Error('der: truncated');
  const tag = b[i]!;
  let len = b[i + 1]!;
  let j = i + 2;
  if (len & 0x80) {
    const k = len & 0x7f;
    // Bounds check BEFORE reading the k length bytes (module invariant above):
    // an out-of-range read yields undefined → len becomes NaN → the guard
    // after this block is false → a truncated TLV would be silently accepted.
    if (j + k > b.length) throw new Error('der: length overruns buffer');
    len = 0;
    for (let x = 0; x < k; x++) len = len * 256 + b[j++]!;
  }
  if (j + len > b.length) throw new Error('der: length overruns buffer');
  return { tag, start: i, contentStart: j, end: j + len };
}

/** All immediate children of a constructed TLV, in order. */
export function derChildren(b: Uint8Array, tlv: DerTlv): DerTlv[] {
  const kids: DerTlv[] = [];
  let i = tlv.contentStart;
  while (i < tlv.end) {
    const c = derTlv(b, i);
    kids.push(c);
    i = c.end;
  }
  return kids;
}

/**
 * EC named-curve OIDs (hex of the OID content) → WebCrypto curve name, the SHA
 * an ECDSA CA on that curve signs with, and the field width in bytes. C2PA
 * signing hierarchies mix curves (a Google chain is a P-256 leaf under a P-384
 * intermediate under a P-384 root), and an ECDSA CA signs with the SHA paired
 * to its curve, so the verify hash and the r||s integer width are read from
 * the SIGNER's curve, not fixed. SEAL consumers use curve + size only (the
 * SEAL digest comes from the record's own `da=`).
 */
export const EC_CURVES: Record<string, { curve: string; hash: string; size: number }> = {
  '2a8648ce3d030107': { curve: 'P-256', hash: 'SHA-256', size: 32 }, // prime256v1
  '2b81040022': { curve: 'P-384', hash: 'SHA-384', size: 48 },       // secp384r1
  '2b81040023': { curve: 'P-521', hash: 'SHA-512', size: 66 },       // secp521r1
};

/**
 * DER ECDSA-Sig-Value (SEQUENCE { INTEGER r, INTEGER s }) → the fixed-width
 * raw r||s (IEEE P1363) WebCrypto verifies — the inverse of ecdsaRawToDer:
 * strip each INTEGER's leading 0x00 sign pads, left-pad back to the curve
 * field width (`size` bytes per integer). Throws on anything that is not a
 * well-formed ECDSA-Sig-Value that fits the curve.
 */
export function ecdsaDerToRaw(derSig: Uint8Array, size: number): Uint8Array {
  const top = derTlv(derSig, 0);
  if (top.tag !== 0x30) throw new Error('der: not an ECDSA-Sig-Value');
  const [r, s] = derChildren(derSig, top);
  if (!r || !s || r.tag !== 0x02 || s.tag !== 0x02) throw new Error('der: not an ECDSA-Sig-Value');
  const out = new Uint8Array(size * 2);
  let at = 0;
  for (const int of [r, s]) {
    let i = int.contentStart;
    while (i < int.end && derSig[i] === 0) i++;
    const v = derSig.subarray(i, int.end);
    if (v.length > size) throw new Error('der: ECDSA integer wider than the curve');
    out.set(v, at + size - v.length);
    at += size;
  }
  return out;
}

// Just enough DER *writing* for ecdsaRawToDer below — byte-identical to
// x509.ts's der()/derLen()/derUint() writers. Kept private here (x509.ts owns
// the general writer set) to avoid an x509 ↔ der-read import cycle.
function derLen(n: number): Uint8Array {
  if (n < 0x80) return Uint8Array.of(n);
  if (n < 0x100) return Uint8Array.of(0x81, n);
  if (n < 0x10000) return Uint8Array.of(0x82, n >>> 8, n & 0xff);
  return Uint8Array.of(0x83, n >>> 16, (n >>> 8) & 0xff, n & 0xff);
}
function derWrap(tag: number, body: Uint8Array): Uint8Array {
  return concatBytes([Uint8Array.of(tag), derLen(body.length), body]);
}

/** WebCrypto's raw r||s ECDSA signature → DER ECDSA-Sig-Value (what X.509 and
 *  SEAL store): each half as a minimal DER INTEGER (leading zeros stripped,
 *  0x00-prefixed when the high bit is set) inside a SEQUENCE. */
export function ecdsaRawToDer(raw: Uint8Array): Uint8Array {
  const half = raw.length / 2;
  const int = (bytes: Uint8Array): Uint8Array => {
    let i = 0;
    while (i < bytes.length - 1 && bytes[i] === 0) i++;
    const v = bytes.subarray(i);
    return v[0]! & 0x80 ? derWrap(0x02, concatBytes([Uint8Array.of(0), v])) : derWrap(0x02, v);
  };
  return derWrap(0x30, concatBytes([int(raw.subarray(0, half)), int(raw.subarray(half))]));
}
