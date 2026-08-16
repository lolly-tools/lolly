// SPDX-License-Identifier: MPL-2.0
/**
 * PackBits run-length coding (TIFF 6.0 section 9) - the byte compression Photoshop
 * calls "RLE" for PSD channel data (compression method 1) and TIFF uses for
 * Compression=32773. One scheme, two container homes, so it lives alone here
 * where psd.ts, psd-write.ts and any future TIFF reader can share it.
 *
 * Wire form, header byte `h` read as signed:
 *   0..127   → literal: copy the next h+1 bytes
 *   -1..-127 → run: repeat the next byte 1-h times (2..128)
 *   -128     → no-op (skip)
 *
 * Contract matches png-unfilter.ts: the decoder is defensive on every input and
 * NEVER throws - a truncated packet, source overrun or destination overrun
 * returns -1 so callers can treat it as "couldn't decode" and skip the row or
 * layer. The encoder emits runs only at length >= 3 (a 2-byte run costs the
 * same as 2 literal bytes but splits the literal packet, so it never wins).
 * Pure + DOM-free (engine contract): no DOM, no deps, no allocation surprises.
 */

/**
 * Encode `src` as one PackBits stream. Worst case (no runs anywhere) the
 * output is src.length + ceil(src.length/128) bytes - each 128-byte literal
 * packet pays a 1-byte header, never more.
 */
export function packBitsEncode(src: Uint8Array): Uint8Array {
  const n = src.length;
  if (n === 0) return new Uint8Array(0);
  const out = new Uint8Array(n + Math.ceil(n / 128) + 1);
  let o = 0;
  let i = 0;
  while (i < n) {
    // Measure the run starting here (capped at the 128-byte packet limit).
    let runEnd = i + 1;
    while (runEnd < n && runEnd - i < 128 && src[runEnd] === src[i]) runEnd++;
    const runLen = runEnd - i;
    if (runLen >= 3) {
      out[o++] = 257 - runLen; // signed -(runLen-1)
      out[o++] = src[i]!;
      i = runEnd;
    } else {
      // Literal packet: absorb bytes until a run of >= 3 begins or 128 bytes.
      let j = i + 1;
      while (j < n && j - i < 128) {
        if (j + 2 < n && src[j] === src[j + 1] && src[j] === src[j + 2]) break;
        j++;
      }
      const litLen = j - i;
      out[o++] = litLen - 1;
      out.set(src.subarray(i, j), o);
      o += litLen;
      i = j;
    }
  }
  return out.slice(0, o);
}

/**
 * Decode PackBits from `src[srcStart, srcEnd)` into exactly `dstLen` bytes at
 * `dst[dstStart]`. Returns the byte count written (=== dstLen on success) or
 * -1 - never throws - when the stream is truncated, a packet would overrun the
 * destination, or the bounds arguments are incoherent. Strict by design: a PSD
 * row's decoded length is known exactly, and a stream that disagrees is
 * damage, not tolerance.
 */
export function packBitsDecode(
  src: Uint8Array,
  srcStart: number,
  srcEnd: number,
  dst: Uint8Array,
  dstStart: number,
  dstLen: number,
): number {
  if (srcStart < 0 || srcEnd > src.length || srcStart > srcEnd) return -1;
  if (dstStart < 0 || dstLen < 0 || dstStart + dstLen > dst.length) return -1;
  let i = srcStart;
  let o = dstStart;
  const dstEndAt = dstStart + dstLen;
  while (o < dstEndAt) {
    if (i >= srcEnd) return -1; // ran out of packets before filling the row
    const h = src[i++]!;
    if (h === 128) continue; // no-op
    if (h < 128) {
      const len = h + 1; // literal
      if (i + len > srcEnd || o + len > dstEndAt) return -1;
      dst.set(src.subarray(i, i + len), o);
      i += len;
      o += len;
    } else {
      const len = 257 - h; // run of 2..128
      if (i >= srcEnd || o + len > dstEndAt) return -1;
      dst.fill(src[i++]!, o, o + len);
      o += len;
    }
  }
  return o - dstStart;
}
