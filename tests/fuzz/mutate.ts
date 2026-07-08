// SPDX-License-Identifier: MPL-2.0
/**
 * Mutation operators for the fuzz harness. Each takes a seed buffer + an Rng and
 * returns a NEW buffer (seeds are never mutated in place, so a corpus is stable
 * across a run). Operators target the ways a hand-rolled binary parser breaks:
 *
 *   - bitFlip / byteSet   — flip individual bits / clobber whole bytes
 *   - truncate            — cut the buffer short (headers promising more than exists)
 *   - splice              — overwrite a random run with random bytes
 *   - duplicateChunk      — repeat a run (nesting/box-count amplification)
 *   - inflateLength       — find a plausible 16/32-bit big-endian length field and
 *                           blow it up, the classic "trust the declared length" trap
 *   - growByte            — bump single bytes toward 0xff (length/count nibbles)
 *
 * mutate() composes 1–4 of these per call, chosen deterministically from the Rng.
 */

import type { Rng } from './prng.ts';

function bitFlip(buf: Uint8Array, rng: Rng): Uint8Array {
  const out = buf.slice();
  if (!out.length) return out;
  const flips = 1 + rng.int(8);
  for (let k = 0; k < flips; k++) {
    const i = rng.int(out.length);
    out[i] = (out[i]! ^ (1 << rng.int(8))) & 0xff;
  }
  return out;
}

function byteSet(buf: Uint8Array, rng: Rng): Uint8Array {
  const out = buf.slice();
  if (!out.length) return out;
  const n = 1 + rng.int(6);
  for (let k = 0; k < n; k++) out[rng.int(out.length)] = rng.byte();
  return out;
}

function truncate(buf: Uint8Array, rng: Rng): Uint8Array {
  if (!buf.length) return buf;
  // Bias toward keeping most of the buffer (header-region truncation is the
  // interesting case, but tail cuts matter too).
  const keep = rng.chance(0.5) ? rng.int(buf.length) : Math.floor(buf.length * (0.5 + rng.next() * 0.5));
  return buf.slice(0, keep);
}

function splice(buf: Uint8Array, rng: Rng): Uint8Array {
  const out = buf.slice();
  if (!out.length) return out;
  const at = rng.int(out.length);
  const len = 1 + rng.int(Math.min(64, out.length - at));
  for (let k = 0; k < len; k++) out[at + k] = rng.byte();
  return out;
}

function duplicateChunk(buf: Uint8Array, rng: Rng): Uint8Array {
  if (!buf.length) return buf;
  const at = rng.int(buf.length);
  const len = 1 + rng.int(Math.min(256, buf.length - at));
  const chunk = buf.subarray(at, at + len);
  const reps = 2 + rng.int(6);
  const out = new Uint8Array(buf.length + len * (reps - 1));
  out.set(buf.subarray(0, at), 0);
  let o = at;
  for (let k = 0; k < reps; k++) { out.set(chunk, o); o += len; }
  out.set(buf.subarray(at + len), o);
  return out;
}

const INFLATED = [0xffffffff, 0x7fffffff, 0x10000000, 0x00ffffff, 0xffff, 0x7fff, 0x1000];

// Overwrite a big-endian length-looking field (a run of bytes whose leading byte
// is small, i.e. a modest declared length) with a huge value — the exact input
// that makes a parser allocate/loop on a number far bigger than the buffer.
function inflateLength(buf: Uint8Array, rng: Rng): Uint8Array {
  const out = buf.slice();
  if (out.length < 4) return byteSet(out, rng);
  const at = rng.int(out.length - 3);
  const v = rng.pick(INFLATED);
  const width = rng.chance(0.5) ? 4 : 2;
  if (width === 4) {
    out[at] = (v >>> 24) & 0xff; out[at + 1] = (v >>> 16) & 0xff;
    out[at + 2] = (v >>> 8) & 0xff; out[at + 3] = v & 0xff;
  } else {
    out[at] = (v >>> 8) & 0xff; out[at + 1] = v & 0xff;
  }
  return out;
}

function growByte(buf: Uint8Array, rng: Rng): Uint8Array {
  const out = buf.slice();
  if (!out.length) return out;
  const n = 1 + rng.int(4);
  for (let k = 0; k < n; k++) {
    const i = rng.int(out.length);
    out[i] = rng.chance(0.5) ? 0xff : Math.min(255, out[i]! + 1 + rng.int(64));
  }
  return out;
}

const OPS = [bitFlip, byteSet, truncate, splice, duplicateChunk, inflateLength, growByte] as const;

/** Apply 1–4 randomly-chosen operators in sequence. Deterministic in `rng`. */
export function mutate(seed: Uint8Array, rng: Rng): Uint8Array {
  let cur = seed;
  const rounds = 1 + rng.int(4);
  for (let k = 0; k < rounds; k++) cur = rng.pick(OPS)(cur, rng);
  return cur;
}
