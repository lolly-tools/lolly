// SPDX-License-Identifier: MPL-2.0

// ─── Images (optional, v1.60) ────────────────────────────────────────────────

/**
 * On-device image transforms. Every method accepts raw encoded bytes or a Blob
 * (the two forms user files arrive in - InputFile.bytes, picker Blobs) and
 * resolves to plain bytes + dimensions, so the contract stays DOM-free.
 * Decode-bomb guards, EXIF-orientation baking, and per-format support are the
 * SHELL's responsibility - read the RESULT's mime/width/height rather than
 * assuming a request was honoured exactly (a shell may fall back, e.g. PNG
 * where WebP encoding is unsupported).
 */
export interface ImagesAPI {
  /**
   * Decode enough of the image to report its pixel dimensions and detected
   * MIME type (sniffed from the bytes, never from a filename). Dimensions are
   * the ORIENTED ones (EXIF rotation applied), matching what resize/encode
   * produce. Rejects when the bytes are not a decodable image on this shell.
   */
  decode(input: Uint8Array | Blob): Promise<ImageInfo>;

  /**
   * Downscale the image (aspect preserved; never upscales) and return it
   * re-encoded. `maxEdge` caps the longest edge; explicit `width`/`height`
   * fit the image WITHIN that box. Output format defaults per the shell
   * (typically the source format where re-encodable) - pass `format` to pin
   * it. An animated source flattens to its first frame.
   */
  resize(input: Uint8Array | Blob, opts: ImageResizeOpts): Promise<ImageResult>;

  /**
   * Re-encode the image into `format` at its full (oriented) size - the
   * convert path: HEIC → JPEG, PNG → WebP, … `quality` applies to the lossy
   * formats. An animated source flattens to its first frame.
   */
  encode(input: Uint8Array | Blob, opts: ImageEncodeOpts): Promise<ImageResult>;
}

export interface ImageInfo {
  /** Oriented pixel width (EXIF rotation applied). */
  width: number;
  /** Oriented pixel height. */
  height: number;
  /** MIME type sniffed from the bytes, e.g. 'image/heic'. */
  mime: string;
  /** True for an animated container (GIF/APNG/animated WebP) - a resize/encode
   *  flattens it to a still. Absent when the shell can't tell. */
  animated?: boolean;
}

/** Encodings host.images can emit. Deliberately narrower than what it can
 *  READ (HEIC/AVIF/TIFF decode in, but only web-safe formats out). */
export type ImageEncodeFormat = 'webp' | 'jpeg' | 'png';

export interface ImageResizeOpts {
  /** Longest-edge cap in px (aspect preserved). */
  maxEdge?: number;
  /** Fit-within target width in px. */
  width?: number;
  /** Fit-within target height in px. */
  height?: number;
  /** Output encoding; defaults per the shell (see resize()). */
  format?: ImageEncodeFormat;
  /** Quality 0..1 for the lossy formats. Ignored for PNG. */
  quality?: number;
  /** Carry the source's own descriptive metadata (EXIF authorship, copyright,
   *  description, software, capture date, and the XMP packet) into the output
   *  container (v1.149). `true` carries everything EXCEPT location; pass
   *  `{ gps: true }` to keep the GPS fix too. Default false - today's
   *  behaviour, a re-encode drops everything. A C2PA credential is never
   *  copied (its hard binding is to the source bytes). The result's `carried`
   *  report says exactly what carried and what dropped, and why. */
  carryMetadata?: boolean | { gps?: boolean };
}

export interface ImageEncodeOpts {
  /** Target encoding. */
  format: ImageEncodeFormat;
  /** Quality 0..1 for the lossy formats. Ignored for PNG. */
  quality?: number;
  /** See ImageResizeOpts.carryMetadata (v1.149). */
  carryMetadata?: boolean | { gps?: boolean };
}

/** What a metadata carry did - `carried` names the fields now present in the
 *  output bytes; `dropped` names everything that did not move and why, so a
 *  drop is never silent (plans/144: "honor at least"). */
export interface MetaCarryReport {
  carried: string[];
  dropped: { field: string; why: string }[];
}

/** An encoded transform result - the mime/dimensions of `bytes`, which may
 *  differ from the request (shell fallbacks; never-upscale clamping). */
export interface ImageResult {
  /** The encoded image. */
  bytes: Uint8Array;
  /** MIME type of `bytes`. */
  mime: string;
  /** Output pixel width. */
  width: number;
  /** Output pixel height. */
  height: number;
  /** When `carryMetadata` was requested: what carried and what dropped (v1.149). */
  carried?: MetaCarryReport;
}
