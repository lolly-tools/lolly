// SPDX-License-Identifier: MPL-2.0

/**
 * Detect machine-readable codes in one RGBA frame, on-device (plans/162 Part 2).
 * Optional/additive (v1.153). See the `scan` field on HostV1 for the shell ladder
 * and the progressive-enhancement contract.
 */
export interface ScanAPI {
  /**
   * The formats this shell can decode right now, in BarcodeDetector naming
   * ('qr_code', 'data_matrix', 'aztec', 'pdf417', 'ean_13', 'code_128', …). Sync
   * + cheap: a reader tool reads it to build its format filter and to decide what
   * to promise. The set can WIDEN after the first detect() if a lazy decoder chunk
   * loads, so treat it as "at least these", not a frozen list.
   */
  formats(): string[];

  /**
   * Detect codes in a frame. `frame` is any RGBA buffer with width/height - a live
   * `MediaFrame` (for a viewfinder) or a `RasterFrame` decoded from a still image
   * are both structurally valid. Read the pixels synchronously-valid; resolve with
   * every hit found (empty array for none), never reject for "nothing there". A
   * decode that overruns is the caller's to pace - the runtime's `onFrame` loop
   * already drops overlapping frames, so a slow decode self-throttles.
   * `opts.formats` restricts the search (a subset of `formats()`); omitted = all.
   */
  detect(
    frame: { data: Uint8ClampedArray; width: number; height: number },
    opts?: { formats?: string[] }
  ): Promise<ScanHit[]>;
}

/** One decoded code from `ScanAPI.detect`. */
export interface ScanHit {
  /** The symbology, in BarcodeDetector naming ('qr_code', 'data_matrix', …). */
  format: string;
  /** The decoded text exactly as carried - untrusted input; a reader must not act on it automatically. */
  rawValue: string;
  /** The raw payload bytes, present when the content is not valid UTF-8 (e.g. a binary QR). */
  rawBytes?: Uint8Array;
  /** The code's quad in frame coordinates [[x,y]×4], for a viewfinder overlay. Absent if the decoder can't localise. */
  corners?: [number, number][];
}
