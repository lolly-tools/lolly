// SPDX-License-Identifier: MPL-2.0
/**
 * Adobe TrustMark — BCH data-layer decode (pure GF(2^7) math, DOM-free).
 *
 * TrustMark (github.com/adobe/trustmark) is Adobe's C2PA "durable soft
 * binding" watermark: a neural encoder hides a 100-bit payload in an image's
 * pixels; a matching neural DECODER (an ONNX model, run via onnxruntime-web)
 * reads back a 100-bit boolean array. This file has NOTHING to do with that
 * neural step — it starts *after* it, taking the 100 recovered bits and
 * running the BCH error-correction + schema framing that turns "noisy bits
 * off a decoder" into "a validated, error-corrected payload, or nothing".
 * That distinction is what makes `valid: true` here a real detection rather
 * than a coin flip: a random/unmarked image's decoder output is statistically
 * indistinguishable from noise, and noise fails the BCH check overwhelmingly
 * (see tests/trustmark.test.ts) — the ECC pass is the actual evidence.
 *
 * The neural decode itself — fetching the ONNX model, running inference,
 * resizing pixels to the model's input — lives in the WEB SHELL
 * (shells/web/src/lib/trustmark.ts), which depends on onnxruntime-web and a
 * <canvas>. This module stays engine-appropriate: no DOM, no ONNX, no
 * network — just the bit-level math, so it is usable from any shell
 * (including a future CLI `--deep` path via onnxruntime-node) and unit
 * testable in plain node:test.
 *
 * Port provenance and how it was checked: `bchDecode`/`bchEncode`/
 * `createBchEngine`/`getRoots`/`buildCyclic` are a line-for-line TypeScript
 * transliteration of Adobe's own reference decoder — `python/trustmark/
 * bchecc.py` (the BCH engine) and `python/trustmark/datalayer.py` (the
 * schema/version framing this module's `decodeTrustmarkPayload` mirrors),
 * fetched from github.com/adobe/trustmark @ main, MIT-licensed (see notice
 * below). The schema table (four BCH(t,137) variants, 96 data+ecc bits + a
 * 4-bit version tail = 100 bits total) matches the JS reference
 * (`js/tm_datalayer.js`) too. This port was cross-checked — not just
 * typechecked — against Adobe's UNMODIFIED bchecc.py: a standalone Python
 * harness ran the real reference encoder/decoder (BCH_POLYNOMIAL=137, every
 * schema version) to produce known-good and known-bad bit vectors (pristine,
 * single-bit-flip, exactly-t-bit-flip, and heavily-corrupted packets), which
 * are embedded verbatim as the primary fixtures in tests/trustmark.test.ts.
 * The only thing NOT verified here is the neural decoder itself (no ONNX
 * model, no image, no browser in this environment) — see the web-shell
 * module's header for that half of the honesty ledger.
 *
 * One deliberate deviation from the shipped JS reference, flagged for
 * review: `js/tm_datalayer.js`'s `DataLayer_Decode` retries decoding under
 * up to three OTHER schema versions when the version read from the trailing
 * bits fails to validate (and, on a fallback success, oddly still reports
 * the ORIGINALLY-read version in its soft-binding string — reads as an
 * upstream quirk, not intentional). `decodeTrustmarkPayload` below does NOT
 * do this: it decodes under exactly the schema the trailing 2 bits name, and
 * nothing else. Trying every schema against noise is a real false-positive
 * amplifier (up to ~4x the chance some engine's syndrome accidentally
 * resolves) that conflicts with this codebase's hard "no false positives"
 * bar for a green detection pip (see plans/watermark-detectors.md) — the
 * Python reference (used for both encode AND decode, the more authoritative
 * half of Adobe's own repo) does not have this fallback either.
 *
 * Ported-from-TrustMark notice (applies to bchDecode, bchEncode, getRoots,
 * buildCyclic, createBchEngine, and the schema table in
 * decodeTrustmarkPayload):
 *
 *   TrustMark — Copyright 2023 Adobe. All rights reserved.
 *   Licensed under the MIT License:
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a
 *   copy of this software and associated documentation files (the
 *   "Software"), to deal in the Software without restriction, including
 *   without limitation the rights to use, copy, modify, merge, publish,
 *   distribute, sublicense, and/or sell copies of the Software, and to
 *   permit persons to whom the Software is furnished to do so, subject to
 *   the following conditions: the above copyright notice and this
 *   permission notice shall be included in all copies or substantial
 *   portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT
 *   WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
 *   (Full text: https://github.com/adobe/trustmark/blob/main/LICENSE)
 */

// ─── GF(2^m) BCH engine (ported from bchecc.py's `BCH` class) ────────────────

/** One error-locator/generator polynomial: degree + coefficients (index 0 =
 *  constant term), sized generously like the Python `polynomial` dataclass's
 *  ad-hoc `c` lists — callers always allocate `c` big enough up front. */
interface Poly { deg: number; c: number[] }

/** The constructed state of one BCH(t, poly) instance — the TS shape of
 *  Python's `self.ECCstate`. `eccBuf`/`errloc` are SCRATCH fields mutated by
 *  bchEncode/bchDecode/getRoots, mirroring the reference's stateful object
 *  (decode() calls encode() first purely for its ecc_buf side effect — kept
 *  for fidelity rather than refactored into a purer return-value shape). Not
 *  safe to call concurrently against the same engine instance for that
 *  reason (matches the Python original, which has the same property).
 */
export interface BchEngine {
  readonly m: number;
  readonly t: number;
  readonly poly: number;
  readonly n: number;            // 2^m - 1
  readonly eccBytes: number;     // ceil(m*t / 8) — the codec's fixed ecc-byte-buffer width
  eccBits: number;               // g.deg — the REAL (possibly smaller) meaningful ecc bit count
  cyclicTab: number[];
  exponents: number[];
  logarithms: number[];
  elpPre: number[];
  eccBuf: number[];              // scratch — see class doc above
  errloc: number[];              // scratch — root/bit-flip positions from the last decode() call
}

function deg(x: number): number {
  let count = 0;
  let v = x >>> 0;
  while (v >>> 1) { v = v >>> 1; count++; }
  return count;
}

function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

function load4Bytes(b0: number, b1: number, b2: number, b3: number): number {
  return (((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0);
}

// ── Galois field arithmetic over GF(2^m), log/antilog tables ─────────────────
function gMod(engine: BchEngine, v: number): number {
  return v < engine.n ? v : v - engine.n;
}
function gModN(engine: BchEngine, v: number): number {
  const n = engine.n;
  while (v >= n) {
    v -= n;
    v = (v & n) + (v >>> engine.m);
  }
  return v;
}
function gLog(engine: BchEngine, x: number): number {
  return engine.logarithms[x]!;
}
function gPow(engine: BchEngine, i: number): number {
  return engine.exponents[gModN(engine, i)]!;
}
function gMul(engine: BchEngine, a: number, b: number): number {
  if (a > 0 && b > 0) {
    return engine.exponents[gMod(engine, engine.logarithms[a]! + engine.logarithms[b]!)]!;
  }
  return 0;
}
function gDiv(engine: BchEngine, a: number, b: number): number {
  if (a) {
    return engine.exponents[gMod(engine, engine.logarithms[a]! + engine.n - engine.logarithms[b]!)]!;
  }
  return 0;
}
function gSqrt(engine: BchEngine, a: number): number {
  return a ? engine.exponents[gMod(engine, 2 * engine.logarithms[a]!)]! : 0;
}

/** Chien-search-equivalent root finder for the error-locator polynomial
 *  (general cyclotomic-coset search for deg>2, closed forms for deg 1/2).
 *  Mirrors bchecc.py's `getroots` exactly, incl. the `k` parameter being
 *  locally repurposed as a bit-length partway through (kept as a fresh `kk`
 *  local here instead of shadowing, same effect). Sets engine.errloc and
 *  returns the root count, or -1 when fewer roots than poly.deg were found
 *  (uncorrectable — more bit errors than this code can fix). */
function getRoots(engine: BchEngine, k: number, poly: Poly): number {
  const roots: number[] = [];
  if (poly.deg > 2) {
    const kk = k * 8 + engine.eccBits;
    const rep: number[] = new Array(engine.t * 2).fill(0);
    const d = poly.deg;
    const l = engine.n - gLog(engine, poly.c[poly.deg]!);
    for (let i = 0; i < d; i++) {
      rep[i] = poly.c[i] ? gMod(engine, gLog(engine, poly.c[i]!) + l) : -1;
    }
    rep[poly.deg] = 0;
    const syn0 = gDiv(engine, poly.c[0]!, poly.c[poly.deg]!);
    for (let i = engine.n - kk + 1; i <= engine.n; i++) {
      let syn = syn0;
      for (let j = 1; j <= poly.deg; j++) {
        const m = rep[j]!;
        if (m >= 0) syn = syn ^ gPow(engine, m + j * i);
      }
      if (syn === 0) {
        roots.push(engine.n - i);
        if (roots.length === poly.deg) break;
      }
    }
    if (roots.length < poly.deg) {
      engine.errloc = [];
      return -1;
    }
  }
  if (poly.deg === 1) {
    if (poly.c[0]) {
      roots.push(gMod(engine, engine.n - engine.logarithms[poly.c[0]!]! + engine.logarithms[poly.c[1]!]!));
    }
  }
  if (poly.deg === 2) {
    if (poly.c[0] && poly.c[1]) {
      const l0 = engine.logarithms[poly.c[0]!]!;
      const l1 = engine.logarithms[poly.c[1]!]!;
      const l2 = engine.logarithms[poly.c[2]!]!;
      const u = gPow(engine, l0 + l2 + 2 * (engine.n - l1));
      let r = 0;
      let v = u;
      while (v) {
        const i = deg(v);
        r = r ^ engine.elpPre[i]!;
        v = v ^ (1 << i);
      }
      if ((gSqrt(engine, r) ^ r) === u) {
        roots.push(gModN(engine, 2 * engine.n - l1 - engine.logarithms[r]! + l2));
        roots.push(gModN(engine, 2 * engine.n - l1 - engine.logarithms[r ^ 1]! + l2));
      }
    }
  }
  engine.errloc = roots;
  return roots.length;
}

/** Precomputes the 4x256-entry cyclic remainder table used by bchEncode's
 *  table-driven encoder (a standard byte-at-a-time CRC-style speedup for a
 *  fixed generator polynomial). Mirrors `build_cyclic`. */
function buildCyclic(engine: BchEngine, g: number[]): void {
  const l = ceilDiv(engine.m * engine.t, 32);
  const plen = ceilDiv(engine.eccBits + 1, 32);
  const ecclen = ceilDiv(engine.eccBits, 32);
  engine.cyclicTab = new Array(4 * 256 * l).fill(0);
  for (let i = 0; i < 256; i++) {
    for (let b = 0; b < 4; b++) {
      const offset = (b * 256 + i) * l;
      let data = (i << (8 * b)) >>> 0;
      while (data) {
        const d = deg(data);
        data = (data ^ (g[0]! >>> (31 - d))) >>> 0;
        for (let j = 0; j < ecclen; j++) {
          const hi = d < 31 ? (g[j]! << (d + 1)) >>> 0 : 0;
          const lo = (j + 1 < plen) ? (g[j + 1]! >>> (31 - d)) : 0;
          engine.cyclicTab[j + offset] = (engine.cyclicTab[j + offset]! ^ (hi | lo)) >>> 0;
        }
      }
    }
  }
}

/** Builds a BCH(t, poly) engine: the Galois field tables, the generator
 *  polynomial (and its true bit-degree, `eccBits`), and the cyclic encode
 *  table. Mirrors `BCH.__init__`. TrustMark always calls this with
 *  poly=137 (a degree-7 primitive polynomial over GF(2), i.e. GF(128)) and
 *  t in {8,5,4,3} — one engine per schema version. */
export function createBchEngine(t: number, poly: number): BchEngine {
  let tmp = poly;
  let m = 0;
  while (tmp >>> 1) { tmp = tmp >>> 1; m++; }

  const n = (1 << m) - 1;
  const eccBytes = ceilDiv(m * t, 8);

  const engine: BchEngine = {
    m, t, poly, n,
    eccBytes,
    eccBits: 0, // set below, once the generator polynomial's real degree is known
    cyclicTab: [],
    exponents: new Array(n + 1).fill(0),
    logarithms: new Array(n + 1).fill(0),
    elpPre: new Array(m + 1).fill(0),
    eccBuf: [],
    errloc: new Array(t).fill(0),
  };

  const k = 1 << deg(poly);
  if (k !== (1 << m)) throw new Error('trustmark: BCH polynomial degree does not match field size');

  let x = 1;
  for (let i = 0; i < n; i++) {
    engine.exponents[i] = x;
    engine.logarithms[x] = i;
    if (i && x === 1) throw new Error('trustmark: BCH polynomial is not primitive for this field');
    x *= 2;
    if (x & k) x ^= poly;
  }
  engine.logarithms[0] = 0;
  engine.exponents[n] = 1;

  // Build the generator polynomial g(x) = product of minimal polynomials of
  // alpha^1, alpha^3, ..., alpha^(2t-1) (the standard narrow-sense BCH
  // construction) via its roots' cyclotomic cosets.
  const g: Poly = { deg: 0, c: new Array(m * t + 1).fill(0) };
  const roots: number[] = new Array(n + 1).fill(0);
  for (let i = 0; i < t; i++) {
    let r = 2 * i + 1;
    for (let j = 0; j < m; j++) {
      roots[r] = 1;
      r = gMod(engine, 2 * r);
    }
  }
  g.deg = 0;
  g.c[0] = 1;
  for (let i = 0; i < n; i++) {
    if (roots[i]) {
      const r = engine.exponents[i]!;
      g.c[g.deg + 1] = 1;
      for (let j = g.deg; j > 0; j--) {
        g.c[j] = gMul(engine, g.c[j]!, r) ^ g.c[j - 1]!;
      }
      g.c[0] = gMul(engine, g.c[0]!, r);
      g.deg += 1;
    }
  }

  // Pack g's coefficients MSB-first into 32-bit words (genpoly) — the form
  // buildCyclic's table generator consumes.
  const genpoly: number[] = new Array(ceilDiv(m * t + 1, 32)).fill(0);
  let nrem = g.deg + 1;
  let gi = 0;
  while (nrem > 0) {
    const nbits = nrem > 32 ? 32 : nrem;
    let word = 0;
    for (let j = 0; j < nbits; j++) {
      if (g.c[nrem - 1 - j]) word |= (1 << (31 - j));
    }
    genpoly[gi] = word >>> 0;
    gi++;
    nrem -= nbits;
  }
  engine.eccBits = g.deg;

  buildCyclic(engine, genpoly);

  // Precompute elp_pre: for each bit position r < m, the field element x
  // whose quadratic trace root gives elp_pre[r] — used by getRoots' deg==2
  // closed-form solver.
  let aexp = 0;
  for (let i = 0; i < m; i++) {
    let sum = 0;
    for (let j = 0; j < m; j++) sum ^= gPow(engine, i * (1 << j));
    if (sum) { aexp = engine.exponents[i]!; break; }
  }
  let x2 = 0;
  const precomp: number[] = new Array(31).fill(0);
  let remaining = m;
  while (x2 <= n && remaining) {
    let y = gSqrt(engine, x2) ^ x2;
    for (let i = 0; i < 2; i++) {
      const r = gLog(engine, y);
      if (y && r < m && !precomp[r]) {
        engine.elpPre[r] = x2;
        precomp[r] = 1;
        remaining--;
        break;
      }
      y = y ^ aexp;
    }
    x2++;
  }

  return engine;
}

/** Systematic BCH encode: returns `engine.eccBytes` parity bytes for `data`,
 *  and (matching the reference) leaves the FULL raw remainder register in
 *  `engine.eccBuf` as a side effect — bchDecode relies on this to compute its
 *  syndrome. Mirrors `BCH.encode`. */
export function bchEncode(engine: BchEngine, dataIn: readonly number[]): number[] {
  const data = dataIn as number[];
  const datalen = data.length;
  const l = ceilDiv(engine.m * engine.t, 32) - 1;
  const eccMaxWords = ceilDiv(31 * 64, 32);
  const r: number[] = new Array(eccMaxWords).fill(0);

  const tab0idx = 0;
  const tab1idx = tab0idx + 256 * (l + 1);
  const tab2idx = tab1idx + 256 * (l + 1);
  const tab3idx = tab2idx + 256 * (l + 1);

  let mlen = Math.floor(datalen / 4);
  let offset = 0;
  while (mlen > 0) {
    let w = load4Bytes(data[offset]!, data[offset + 1]!, data[offset + 2]!, data[offset + 3]!);
    w = (w ^ r[0]!) >>> 0;
    const p0 = tab0idx + (l + 1) * ((w >>> 0) & 0xff);
    const p1 = tab1idx + (l + 1) * ((w >>> 8) & 0xff);
    const p2 = tab2idx + (l + 1) * ((w >>> 16) & 0xff);
    const p3 = tab3idx + (l + 1) * ((w >>> 24) & 0xff);
    for (let i = 0; i < l; i++) {
      r[i] = (r[i + 1]! ^ engine.cyclicTab[p0 + i]! ^ engine.cyclicTab[p1 + i]! ^ engine.cyclicTab[p2 + i]! ^ engine.cyclicTab[p3 + i]!) >>> 0;
    }
    r[l] = (engine.cyclicTab[p0 + l]! ^ engine.cyclicTab[p1 + l]! ^ engine.cyclicTab[p2 + l]! ^ engine.cyclicTab[p3 + l]!) >>> 0;
    mlen--;
    offset += 4;
  }

  let posn = offset;
  let leftdata = datalen - offset;
  while (leftdata > 0) {
    const tmp = data[posn]!;
    posn++;
    let pidx = (l + 1) * (((r[0]! >>> 24) ^ tmp) & 0xff);
    for (let i = 0; i < l; i++) {
      r[i] = (((r[i]! << 8) | (r[i + 1]! >>> 24)) ^ engine.cyclicTab[pidx]!) >>> 0;
      pidx++;
    }
    r[l] = ((r[l]! << 8) ^ engine.cyclicTab[pidx]!) >>> 0;
    leftdata--;
  }

  engine.eccBuf = r.slice();
  const eccout: number[] = [];
  for (const e of r) {
    eccout.push((e >>> 24) & 0xff, (e >>> 16) & 0xff, (e >>> 8) & 0xff, (e >>> 0) & 0xff);
  }
  return eccout.slice(0, engine.eccBytes);
}

/**
 * BCH decode: given `data` (the message bytes) and `recvecc` (the received
 * parity bytes, `engine.eccBytes` long), corrects up to `t` bit errors
 * IN PLACE across `data` (and, for the part of `recvecc` covered by whole
 * leading 4-byte words, `recvecc` too — see note below) and returns the
 * number of bits corrected, or -1 when the error count exceeds what this
 * code can fix (uncorrectable — the honest "not a match" answer; NEVER
 * silently returns wrong data as if it were right). Mirrors `BCH.decode`.
 *
 * Upstream quirk, preserved for fidelity: the reference locally REBINDS its
 * `recvecc` parameter (`recvecc = recvecc[offset:]`, a new list) before the
 * final bit-flip loop runs, so any correction landing in the ecc region
 * lands in that local remainder copy, not the caller's original array —
 * `recvecc`'s corrected bytes never actually reach the caller. This is
 * invisible to every consumer (Adobe's own datalayer.py, and this module)
 * because only `data` is ever read back after decode() returns; the
 * function's real output is `data` plus its return code. Reproduced here
 * (`recvTail`, a local copy) rather than "fixed", since fidelity to the
 * reference is the whole point of this port.
 */
export function bchDecode(engine: BchEngine, data: number[], recvecc: number[]): number {
  bchEncode(engine, data); // side effect: engine.eccBuf now holds data's OWN computed parity
  engine.errloc = [];

  const ecclen = recvecc.length;
  let mlen = Math.floor(ecclen / 4);
  const eccbuf: number[] = [];
  let offset = 0;
  while (mlen > 0) {
    eccbuf.push(load4Bytes(recvecc[offset]!, recvecc[offset + 1]!, recvecc[offset + 2]!, recvecc[offset + 3]!));
    offset += 4;
    mlen--;
  }
  let recvTail = recvecc.slice(offset); // see upstream-quirk note above
  const leftdata = recvTail.length;
  if (leftdata > 0) {
    recvTail = recvTail.concat(new Array(4 - leftdata).fill(0));
    eccbuf.push(load4Bytes(recvTail[0]!, recvTail[1]!, recvTail[2]!, recvTail[3]!));
  }

  const eccwords = ceilDiv(engine.m * engine.t, 32);
  let sum = 0;
  for (let i = 0; i < eccwords; i++) {
    engine.eccBuf[i] = (engine.eccBuf[i]! ^ eccbuf[i]!) >>> 0;
    sum = sum | engine.eccBuf[i]!;
  }
  if (sum === 0) return 0; // received parity matches recomputed parity exactly — no bit flips

  let s = engine.eccBits;
  const t = engine.t;
  const syn: number[] = new Array(2 * t).fill(0);

  const m = s & 31;
  const synbuf = engine.eccBuf; // alias, not a copy — mutations below feed the loop just after
  if (m) {
    const idx = Math.floor(s / 32);
    synbuf[idx] = (synbuf[idx]! & (~0 << (32 - m))) >>> 0;
  }

  let synptr = 0;
  while (s > 0 || synptr === 0) {
    let poly = synbuf[synptr]!;
    synptr++;
    s -= 32;
    while (poly) {
      const i = deg(poly);
      for (let j = 0; j < 2 * t; j += 2) {
        syn[j] = syn[j]! ^ gPow(engine, (j + 1) * (i + s));
      }
      poly = (poly ^ (1 << i)) >>> 0;
    }
  }
  for (let i = 0; i < t; i++) syn[2 * i + 1] = gSqrt(engine, syn[i]!);

  // Berlekamp-Massey: find the error-locator polynomial elp(x) of minimal
  // degree whose coefficients satisfy the syndrome recurrence.
  const n = engine.n;
  let pp = -1;
  let pd = 1;
  let pelp: Poly = { deg: 0, c: new Array(2 * t).fill(0) };
  pelp.c[0] = 1;
  const elp: Poly = { deg: 0, c: new Array(2 * t).fill(0) };
  elp.c[0] = 1;
  let d = syn[0]!;

  for (let i = 0; i < t; i++) {
    if (elp.deg > t) break;
    if (d) {
      const k = 2 * i - pp;
      const elpCopy: Poly = { deg: elp.deg, c: elp.c.slice() };
      const tmp0 = gLog(engine, d) + n - gLog(engine, pd);
      for (let j = 0; j <= pelp.deg; j++) {
        if (pelp.c[j]) {
          const l = gLog(engine, pelp.c[j]!);
          elp.c[j + k] = elp.c[j + k]! ^ gPow(engine, tmp0 + l);
        }
      }
      const tmp1 = pelp.deg + k;
      if (tmp1 > elp.deg) {
        elp.deg = tmp1;
        pelp = elpCopy;
        pd = d;
        pp = 2 * i;
      }
    }
    if (i < t - 1) {
      d = syn[2 * i + 2]!;
      for (let j = 1; j <= elp.deg; j++) {
        d = d ^ gMul(engine, elp.c[j]!, syn[2 * i + 2 - j]!);
      }
    }
  }

  const nroots = getRoots(engine, data.length, elp);
  const datalen = data.length;
  const nbits = datalen * 8 + engine.eccBits;

  for (let i = 0; i < nroots; i++) {
    if (engine.errloc[i]! >= nbits) return -1;
    let e = nbits - 1 - engine.errloc[i]!;
    e = (e & ~7) | (7 - (e & 7));
    engine.errloc[i] = e;
  }

  for (const bitflip of engine.errloc) {
    const byte = Math.floor(bitflip / 8);
    const bit = 1 << (bitflip & 7);
    if (bitflip < (data.length + recvecc.length) * 8) {
      if (byte < data.length) {
        data[byte] = data[byte]! ^ bit;
      } else {
        recvTail[byte - data.length] = recvTail[byte - data.length]! ^ bit;
      }
    }
  }

  return nroots;
}

// ─── TrustMark data-layer framing (ported from datalayer.py's schema logic) ──

const BCH_POLYNOMIAL = 137;
/** Bits 0..(ECC_REGION_BITS-1) hold data+ecc for whichever schema the
 *  trailing version bits name; the last VERSION_FIELD_BITS bits hold the
 *  schema version (0-3, only the low 2 bits are ever nonzero — see
 *  decodeTrustmarkPayload). Matches DataLayer(100, ...) upstream. */
const ECC_REGION_BITS = 96;
const VERSION_FIELD_BITS = 4;
/** Total TrustMark payload length in bits — the shape `detectTrustmark`
 *  (web shell) must hand in after reading the neural decoder's raw output. */
export const TRUSTMARK_PAYLOAD_BITS = ECC_REGION_BITS + VERSION_FIELD_BITS;

export type TrustmarkSchemaName = 'BCH_SUPER' | 'BCH_5' | 'BCH_4' | 'BCH_3';

interface SchemaInfo { name: TrustmarkSchemaName; dataBits: number; t: number }
/** DataLayer_GetSchemaDataBits / DataLayer_GetSchemaName / DataLayer_GetECCEngine,
 *  keyed by the 2-bit version read from the payload's trailing bits. */
const SCHEMA_INFO: Record<number, SchemaInfo> = {
  0: { name: 'BCH_SUPER', dataBits: 40, t: 8 },
  1: { name: 'BCH_5', dataBits: 61, t: 5 },
  2: { name: 'BCH_4', dataBits: 68, t: 4 },
  3: { name: 'BCH_3', dataBits: 75, t: 3 },
};

let engineCache: Record<number, BchEngine> | null = null;
function schemaEngine(version: number): BchEngine | undefined {
  if (!engineCache) {
    engineCache = {};
    for (const v of Object.keys(SCHEMA_INFO)) {
      const vi = Number(v);
      engineCache[vi] = createBchEngine(SCHEMA_INFO[vi]!.t, BCH_POLYNOMIAL);
    }
  }
  return engineCache[version];
}

function padToByteBoundary(bits: readonly number[]): number[] {
  const pad = (8 - (bits.length % 8)) % 8;
  return pad ? bits.concat(new Array(pad).fill(0)) : bits.slice();
}
function bitsToBytes(bits: readonly number[]): number[] {
  const padded = padToByteBoundary(bits);
  const bytes: number[] = [];
  for (let i = 0; i < padded.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (padded[i + j] ? 1 : 0);
    bytes.push(byte);
  }
  return bytes;
}
function bytesToBitString(bytes: readonly number[], count: number): string {
  let s = '';
  for (const b of bytes) s += (b & 0xff).toString(2).padStart(8, '0');
  return s.slice(0, count);
}
function bitStringToHex(bits: string): string {
  const pad = (4 - (bits.length % 4)) % 4;
  const padded = bits + '0'.repeat(pad);
  let hex = '';
  for (let i = 0; i < padded.length; i += 4) hex += parseInt(padded.slice(i, i + 4), 2).toString(16);
  return hex;
}

export interface TrustmarkDecodeResult {
  /** True ONLY when the BCH error-correction check passed — a real,
   *  error-corrected read. Never true for noise; see tests/trustmark.test.ts
   *  for the false-positive-resistance evidence this claim rests on. */
  valid: boolean;
  /** The 2-bit schema version read from the payload's trailing bits (0-3),
   *  or -1 when the input wasn't TRUSTMARK_PAYLOAD_BITS long. */
  version: number;
  /** Human name of the schema, or 'unknown' when version was unreadable. */
  schema: TrustmarkSchemaName | 'unknown';
  /** The error-corrected payload data bits (schema-length, e.g. 40 for
   *  BCH_SUPER), as a '0'/'1' string. '' when invalid. */
  dataBits: string;
  /** dataBits packed MSB-first into bytes, zero-padded to a nibble, as
   *  lowercase hex — what the UI shows as "the payload". '' when invalid. */
  payloadHex: string;
  /** Adobe's own soft-binding value shape (`js/tm_datalayer.js`'s
   *  formatSoftBindingData): "<version>*<raw 100-bit packet>". Present only
   *  when valid — the literal string a c2pa.soft-binding assertion using
   *  `com.adobe.trustmark.<variant>` would carry. */
  softBinding?: string;
}

/**
 * Validates and decodes a 100-bit TrustMark payload (the boolean/bit array a
 * neural decoder produces — see this module's header). Reads the schema
 * version from the trailing 2 bits, then runs ONLY that schema's BCH decode
 * (deliberately no multi-schema fallback — see the module header's "one
 * deliberate deviation" note). `valid: false` on ANY failure: wrong length,
 * unreadable version, or an ECC check that didn't pass. Never throws.
 */
export function decodeTrustmarkPayload(bits: ArrayLike<number | boolean>): TrustmarkDecodeResult {
  try {
    if (!bits || bits.length !== TRUSTMARK_PAYLOAD_BITS) {
      return { valid: false, version: -1, schema: 'unknown', dataBits: '', payloadHex: '' };
    }
    const bitArr: number[] = new Array(bits.length);
    for (let i = 0; i < bits.length; i++) bitArr[i] = bits[i] ? 1 : 0;

    // DataLayer_GetVersion: the low 2 bits of the trailing 4-bit version
    // field (upstream only ever writes versions 0-3, whose top 2 bits are
    // always 0 — see module header).
    const version = bitArr[bitArr.length - 2]! * 2 + bitArr[bitArr.length - 1]!;
    const info = SCHEMA_INFO[version];
    const engine = schemaEngine(version);
    if (!info || !engine) {
      return { valid: false, version, schema: 'unknown', dataBits: '', payloadHex: '' };
    }

    const dataBitArr = bitArr.slice(0, info.dataBits);
    const eccBitArr = bitArr.slice(info.dataBits, ECC_REGION_BITS);
    const dataBytes = bitsToBytes(dataBitArr);
    const eccBytes = bitsToBytes(eccBitArr);
    if (eccBytes.length !== engine.eccBytes) {
      return { valid: false, version, schema: info.name, dataBits: '', payloadHex: '' };
    }

    const flips = bchDecode(engine, dataBytes, eccBytes);
    if (flips === -1) {
      return { valid: false, version, schema: info.name, dataBits: '', payloadHex: '' };
    }

    const correctedBits = bytesToBitString(dataBytes, info.dataBits);
    return {
      valid: true,
      version,
      schema: info.name,
      dataBits: correctedBits,
      payloadHex: bitStringToHex(correctedBits),
      softBinding: `${version}*${bitArr.join('')}`,
    };
  } catch {
    // Defensive only — every branch above is bounds-checked and this should
    // be unreachable; a caller feeding untrusted/garbled bits must never
    // crash the verify page over it.
    return { valid: false, version: -1, schema: 'unknown', dataBits: '', payloadHex: '' };
  }
}
