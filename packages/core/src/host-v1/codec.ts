// SPDX-License-Identifier: MPL-2.0

/**
 * A deep image frame handed to `host.codec` - the tool-facing mirror of the
 * engine's `DeepFrame` (tools cannot import the engine, so the shape is restated
 * here as the versioned contract). RGBA interleaved Float32, LINEAR light,
 * un-premultiplied, unbounded; `space` travels WITH the buffer (babl's lesson).
 * Default space is `'srgb-linear'`.
 */
export interface CodecFrame {
  width: number;
  height: number;
  /** RGBA interleaved, length = width * height * 4. Linear, un-premultiplied, unbounded. */
  data: Float32Array;
  /** Working-space primaries + white point. Default `'srgb-linear'`. */
  space?: 'srgb-linear' | 'display-p3-linear' | 'rec2020-linear';
}

/**
 * Deep image codecs (see `HostV1.codec`). Each turns a linear {@link CodecFrame}
 * into finished image bytes; the tool decides depth by picking the method. All
 * async (a shell may offload to a Worker) and all pure with respect to the frame
 * (never mutated). A shell without a given format resolves to the same bytes as
 * its sibling - the maths is the engine's, not the shell's.
 */
export interface CodecAPI {
  /** 16-bit sRGB PNG - real per-channel precision, no HDR. Smooth where 8-bit bands. */
  png16(frame: CodecFrame, opts?: { dpi?: number; channels?: 3 | 4 }): Promise<Uint8Array>;
  /** OpenEXR master. `'half'` (default) or `'float'` samples. */
  exr(
    frame: CodecFrame,
    opts?: { pixelType?: 'half' | 'float'; channels?: 'rgba' | 'rgb' }
  ): Promise<Uint8Array>;
  /** Radiance RGBE (.hdr) master. */
  radiance(frame: CodecFrame, opts?: { exposure?: number }): Promise<Uint8Array>;
  /** Error-diffused (Floyd–Steinberg) 8-bit sRGB PNG from a deep source - smooth 8-bit. */
  dither8(frame: CodecFrame, opts?: { dpi?: number; channels?: 3 | 4 }): Promise<Uint8Array>;
}
