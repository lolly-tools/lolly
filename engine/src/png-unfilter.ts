// SPDX-License-Identifier: MPL-2.0
// ─── PNG row-filter reversal (PDF /Predictor >= 10, and standalone PNG IDAT) ──
//
// PNG (and PDF's PNG-predictor Flate variant) run each scanline through a byte
// predictor BEFORE DEFLATE, so an inflated stream is not yet the raw samples:
// every row is prefixed with a 1-byte filter tag (0 None, 1 Sub, 2 Up,
// 3 Average, 4 Paeth) and the bytes are differences against reconstructed
// neighbours. This reverses that step — the last thing standing between an
// inflated jsPDF `addImage(png,'PNG')` embed (which writes /Predictor 15) and
// the actual pixels the /verify Lolly-Imprint scan needs to read.
//
// Pure + DOM-free (engine contract): no DOM, no deps, defensive on every input.
// Spec: PNG (RFC 2083 §6) / PDF 32000-1 §7.4.4.4 (LZW/Flate predictors).

/**
 * Reverse PNG row filters over an already-inflated scanline buffer.
 *
 * Input layout: `height` rows, each `1 + width * bytesPerPixel` bytes — a filter
 * tag then that row's filtered samples. Only 8-bit-per-component images are
 * covered (rowBytes = width * bytesPerPixel); sub-byte depths are the caller's
 * responsibility to reject. Returns the reconstructed `height * width *
 * bytesPerPixel` samples with the filter tags removed.
 *
 * Never throws: a truncated buffer, unknown filter tag, or non-positive
 * dimension returns null so callers can treat it as "couldn't decode".
 *
 * @param inflated       DEFLATE-inflated stream (filter tags still present).
 * @param width          samples-group count per row (image pixel width).
 * @param height         row count (image pixel height).
 * @param bytesPerPixel  bytes per pixel used for the Sub/Average/Paeth left
 *                       offset — ceil(components * bitsPerComponent / 8); for the
 *                       8-bit path this is simply the component count (1/3/4).
 */
export function unfilterPng(
  inflated: Uint8Array,
  width: number,
  height: number,
  bytesPerPixel: number,
): Uint8Array | null {
  const bpp = Math.floor(bytesPerPixel);
  const w = Math.floor(width);
  const h = Math.floor(height);
  if (!(bpp > 0) || !(w > 0) || !(h > 0)) return null;
  const rowBytes = w * bpp;
  const stride = rowBytes + 1; // filter tag + scanline
  // Guard against overflow / an absurd allocation before touching memory.
  if (!Number.isSafeInteger(rowBytes) || !Number.isSafeInteger(stride * h)) return null;
  if (inflated.length < stride * h) return null; // truncated stream

  const out = new Uint8Array(rowBytes * h);
  let prevRow = 0; // output offset of the row above (row 0 treats "above" as zeros)
  for (let y = 0; y < h; y++) {
    const filter = inflated[y * stride]!;
    const inRow = y * stride + 1;
    const outRow = y * rowBytes;
    for (let x = 0; x < rowBytes; x++) {
      const raw = inflated[inRow + x]!;
      // Neighbours are the ALREADY-RECONSTRUCTED bytes (0 outside the image).
      const a = x >= bpp ? out[outRow + x - bpp]! : 0;             // left
      const b = y > 0 ? out[prevRow + x]! : 0;                     // above
      const c = (y > 0 && x >= bpp) ? out[prevRow + x - bpp]! : 0; // above-left
      let val: number;
      switch (filter) {
        case 0: val = raw; break;                    // None
        case 1: val = raw + a; break;                // Sub
        case 2: val = raw + b; break;                // Up
        case 3: val = raw + ((a + b) >> 1); break;   // Average (floor)
        case 4: val = raw + paethPredictor(a, b, c); break; // Paeth
        default: return null;                        // unknown filter tag
      }
      out[outRow + x] = val & 0xff; // wrap mod 256 per spec
    }
    prevRow = outRow;
  }
  return out;
}

// PNG Paeth predictor (RFC 2083 §6.6): pick the neighbour (left/above/above-left)
// closest to the initial estimate p = a + b - c, ties resolving a → b → c.
function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}
