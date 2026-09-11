// SPDX-License-Identifier: MPL-2.0
/**
 * Transparent animated GIF packer for the WP-H matte pipeline (plans/124 section 11).
 *
 * The third transparent-video output, alongside engine/webp-anim.ts (`packWebpAnim`)
 * and engine/apng.ts (`packApng`). Those two carry the matte's SOFT alpha verbatim;
 * GIF cannot. A GIF pixel is either fully opaque or fully transparent - one palette
 * entry is nominated as "the transparent colour" in the Graphic Control Extension,
 * and every pixel painting that index shows through. So this packer THRESHOLDS the
 * matte's smoothed alpha to 1 bit: alpha below `alphaThreshold` becomes the single
 * transparent index; everything else is opaque. The dialog says this out loud
 * ("hard-edged transparency") so the user chooses it knowing the edge won't feather.
 *
 * ── Why reserve index 0 rather than gifenc's `oneBitAlpha` ────────────────────
 * gifenc CAN thin alpha to 1 bit inside `quantize({ oneBitAlpha })`, but then the
 * transparent colour lands at WHATEVER palette slot the quantiser happens to place
 * it, and there may be more than one alpha-0 entry. We want ONE stable, known
 * transparent index across every frame so the GCE's transparentIndex is constant.
 * So index 0 is reserved: the RGB is quantised to at most 255 colours (leaving slot
 * 0 free), the opaque indices are shifted up by one, and any sub-threshold pixel is
 * forced to index 0. Index 0 is never produced by an opaque pixel, so it is the
 * transparent index and nothing else.
 *
 * ── Determinism ───────────────────────────────────────────────────────────────
 * gifenc's `quantize`/`applyPalette` are pure (no Math.random, no Date), and the
 * alpha threshold + index remap are plain arithmetic. Same RGBA frames + same
 * threshold ⇒ byte-identical GIF. Pinned in lib/gif-alpha.test.ts.
 */
// Namespace import (not `{ named }`): gifenc's published CJS build hides its named
// exports from Node's static ESM lexer, so a bare `import { GIFEncoder }` throws at
// runtime under `node --test`. Node then surfaces the whole CommonJS export object
// under `default`, while Vite's ESM build exposes the names directly - so resolve
// against whichever shape carries the functions. tsc reads the ambient decl in
// src/vendor.d.ts either way.
import * as gifenc from 'gifenc';

const gifencMod = gifenc as typeof gifenc & { default?: typeof gifenc };
const gifencApi = (typeof gifencMod.GIFEncoder === 'function' ? gifencMod : gifencMod.default) as typeof gifenc;
const { GIFEncoder, quantize, applyPalette } = gifencApi;

/** The reserved transparent palette index. Never assigned to an opaque pixel. */
export const GIF_TRANSPARENT_INDEX = 0;

/** Straight-alpha value (0..255) below which a pixel becomes fully transparent.
 *  Matches gifenc's own default 1-bit split point (< 128). */
export const GIF_DEFAULT_ALPHA_THRESHOLD = 128;

export interface GifAlphaOptions {
  /** Frame width in pixels (every frame shares it). */
  width: number;
  /** Frame height in pixels. */
  height: number;
  /** Milliseconds per frame (GIF stores centiseconds; rounded at write). */
  delayMs: number;
  /** Loop count: 0 = forever (default), -1 = play once, N = N extra loops. */
  loops?: number;
  /** Alpha (0..255) below which a pixel is transparent. Default 128. */
  alphaThreshold?: number;
}

/**
 * Quantise ONE straight-alpha RGBA frame into a GIF index frame with index 0
 * reserved as the single transparent index.
 *
 * Returns the per-frame palette (index 0 = the transparent placeholder colour,
 * 1..N = the opaque colours) and the index buffer (`width*height` bytes, one
 * palette index per pixel). This is the exact byte array gifenc LZW-encodes, so
 * asserting on it is asserting on what a decoder reads back.
 */
export function quantizeGifAlphaFrame(
  rgba: Uint8Array | Uint8ClampedArray,
  alphaThreshold: number = GIF_DEFAULT_ALPHA_THRESHOLD,
): { palette: number[][]; index: Uint8Array } {
  const src = asContiguousU8(rgba);
  // Quantise the RGB (alpha ignored) to at most 255 colours, leaving slot 0 free.
  const colours = quantize(src, 255);
  const opaqueIndex = applyPalette(src, colours);
  // Index 0 is the transparent placeholder; shift the opaque palette up by one.
  const palette: number[][] = [[0, 0, 0], ...colours];
  const index = new Uint8Array(opaqueIndex.length);
  for (let i = 0; i < index.length; i++) {
    const a = src[i * 4 + 3] as number;
    index[i] = a < alphaThreshold ? GIF_TRANSPARENT_INDEX : (opaqueIndex[i] as number) + 1;
  }
  return { palette, index };
}

/**
 * Pack straight-alpha RGBA frames into an animated GIF with a stable transparent
 * index. Each frame carries its own optimal palette (like the no-dither
 * `renderGif` path) with index 0 reserved as transparent, and disposes to the
 * background (dispose: 2) so a transparent region never reveals the frame beneath.
 */
export function packGifAlpha(
  frames: Array<Uint8Array | Uint8ClampedArray>,
  opts: GifAlphaOptions,
): Uint8Array {
  if (frames.length === 0) throw new Error('packGifAlpha: no frames');
  const { width, height } = opts;
  const threshold = opts.alphaThreshold ?? GIF_DEFAULT_ALPHA_THRESHOLD;
  const loops = opts.loops ?? 0;
  const delay = Math.max(1, Math.round(opts.delayMs));

  const gif = GIFEncoder();
  for (let i = 0; i < frames.length; i++) {
    const { palette, index } = quantizeGifAlphaFrame(frames[i] as Uint8Array, threshold);
    gif.writeFrame(index, width, height, {
      palette,
      transparent: true,
      transparentIndex: GIF_TRANSPARENT_INDEX,
      dispose: 2,
      delay,
      // The loop count rides the Netscape ext, written on the first frame only.
      ...(i === 0 ? { repeat: loops } : {}),
    });
  }
  gif.finish();
  // Detach from gifenc's internal growable buffer so the bytes are independently owned.
  return gif.bytesView().slice();
}

/** gifenc reads `new Uint32Array(rgba.buffer)`, which ignores a view's byteOffset
 *  and any trailing buffer slack. Copy into a fresh, zero-offset Uint8Array unless
 *  the input already spans its whole buffer from offset 0. */
function asContiguousU8(rgba: Uint8Array | Uint8ClampedArray): Uint8Array {
  if (rgba instanceof Uint8Array && rgba.byteOffset === 0 && rgba.byteLength === rgba.buffer.byteLength) {
    return rgba;
  }
  const out = new Uint8Array(rgba.length);
  out.set(rgba);
  return out;
}
