// SPDX-License-Identifier: MPL-2.0
/**
 * hdr-deep-frame.ts - plan 154 WP-3: the DEEP (float-precision) HDR frame source for
 * the STREAMING sequence encoder (audiogram / viz / design animation).
 *
 * Today's streaming HDR path (sequence-render.ts#hdrFrameData) is 8-bit: it reads the
 * composited canvas, runs the engine's `hdrBoostToPQ` (8-bit in, 8-bit PQ code values
 * out) and hands 8-bit RGBA to the encoder. PQ allocates its codes non-uniformly, so a
 * boosted brand highlight pushed toward peak nits has only a handful of 8-bit codes to
 * ride and BANDS. The buffered `renderVideo` path already fixed this (WP-2 Phase 2) by
 * preferring a TRUE 10-bit I420P10 source; this module is the same lift for the
 * streaming/sequence path.
 *
 * The pipeline is the engine's own float dual of the 8-bit path (engine/src/hdr.ts):
 *
 *     fromU8Srgb       8-bit sRGB composite -> linear float DeepFrame (srgb-linear)
 *     hdrViewTransform brand boost + Rec.2020, in FLOAT - the documented dual of
 *                      hdrBoostToPQ, same knobs, nothing clipped
 *     pqEncodeFrame    linear -> full-precision PQ code values (203-nit BT.2408 anchor)
 *     pqToI420P10      PQ RGB -> 10-bit BT.2020-NCL narrow-range YCbCr, the exact
 *                      buffer a WebCodecs `I420P10` HDR VideoFrame takes
 *
 * The composite the streaming path hands us is still an 8-bit canvas (the generators -
 * butterchurn, the audiogram, the 2D compositor - draw 8-bit), so this is NOT yet a
 * float-COMPOSITE: the win is that the boost runs in float and the PQ is read back at
 * 10 bits, so 256 source levels map onto 1024 PQ codes distinctly instead of being
 * re-crushed to 256. A true RGBA16F float-composite framebuffer (so intermediate blend
 * values and >1.0 generated headroom survive the composite too) is the remaining WP-3
 * gap; see sequence-render.ts.
 *
 * DEVICE / FLAG GATING lives here so the caller reads ONE boolean:
 *   - `deepHdrCompositorEnabled()` - the opt-in `lolly.hdrCompositor` flag (mirrors
 *     `lolly.glCompositor`); the deep path is perf-sensitive (4 full-frame passes vs
 *     the 8-bit path's 1) so it is OFF by default and only HDR-panel users opt in.
 *   - `supportsI420P10Frame()` - can this runtime construct the 10-bit VideoFrame at
 *     all (WebKit/Safari support is uncertain)? If not, the caller degrades to the
 *     8-bit path. This is the "float render target unavailable -> degrade" gate.
 *
 * DETERMINISM: nothing here runs unless the caller's `hdrDeep` is true (hdrActive && the
 * flag && the probe). Flag off / no HDR / no I420P10 support => the caller stays on the
 * byte-identical 8-bit path, so the SDR goldens are untouched.
 */

import {
  fromU8Srgb,
  hdrViewTransform,
  pqEncodeFrame,
  pqToI420P10,
  type HdrBoostOptions,
} from '@lolly/engine';

/**
 * The opt-in `lolly.hdrCompositor` flag - the deep float HDR encode's own switch,
 * separate from `lolly.glCompositor` / `lolly.workerEncode`. A test flips it with
 * `localStorage.setItem('lolly.hdrCompositor', '1')`.
 */
export function deepHdrCompositorEnabled(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem('lolly.hdrCompositor') === '1'; }
  catch { return false; }
}

let _i420p10Support: boolean | undefined;
/**
 * True when this runtime can construct a tight-packed 10-bit I420P10 VideoFrame - the
 * deep HDR source. The probe builds the EXACT layout `pqToI420P10` emits (Y ++ U ++ V,
 * one LE Uint16 per sample), so a runtime that rejects that packing degrades to the
 * 8-bit path instead of throwing mid-encode. Memoised - fixed per session. (Same probe
 * as export.ts:supportsI420P10Frame, reproduced by the module-private convention this
 * split already uses rather than exporting one more symbol from export.ts.)
 */
export function supportsI420P10Frame(): boolean {
  if (_i420p10Support !== undefined) return _i420p10Support;
  const VF = (globalThis as { VideoFrame?: typeof VideoFrame }).VideoFrame;
  if (typeof VF === 'undefined') return (_i420p10Support = false);
  try {
    // 2x2 -> Y(4) + U(1) + V(1) = 6 samples.
    const f = new VF(new Uint16Array(6), {
      format: 'I420P10' as VideoPixelFormat, codedWidth: 2, codedHeight: 2, timestamp: 0,
    });
    f.close();
    return (_i420p10Support = true);
  } catch {
    return (_i420p10Support = false);
  }
}

/**
 * 8-bit composite RGBA (canvas `ImageData.data` order) -> 10-bit I420P10 YUV, through
 * the engine's float HDR view transform. The float dual of the 8-bit hdrBoostToPQ path;
 * same brand `targets`/tune knobs. Returns the tight-packed Uint16 plane buffer a
 * WebCodecs `I420P10` VideoFrame takes. `pqEncodeFrame`'s default 203-nit anchor matches
 * `hdrViewTransform`'s, exactly as the buffered renderVideo Phase-2 path pairs them.
 */
export function hdrDeepI420P10(
  rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, hdr: HdrBoostOptions,
): Uint16Array {
  const view = hdrViewTransform(fromU8Srgb(rgba, w, h), hdr);
  return pqToI420P10(pqEncodeFrame(view)).data;
}
