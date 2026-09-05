// SPDX-License-Identifier: MPL-2.0

import type { AssetRef } from './asset-ref.ts';

import type { ImageEncodeOpts, ImageInfo, ImageResult } from './images.ts';

// ─── Raster primitives (optional, v1.105) ────────────────────────────────────

/**
 * On-device raster access for tool hooks - see the `raster?` field on HostV1
 * for what this is and why it is separate from `host.images`. Every source it
 * accepts and every value it returns is realm-portable (bytes, Blob, URL,
 * AssetRef, ImageBitmap, RGBA frame); no `HTMLImageElement` and no `document`
 * appear anywhere, so a hook written against it is unchanged when it moves from
 * `new Function` closure-scope injection into a Worker.
 */
export interface RasterAPI {
  /**
   * Realm-correct, SYNCHRONOUS capability probe: can THIS realm rasterise (a 2D
   * canvas context + `createImageBitmap` available)? True on the main thread and
   * inside a Worker with `OffscreenCanvas`; the single honest replacement for
   * every hand-rolled `typeof document === 'undefined'` guard, which reports
   * false in a Worker even where rastering works fine. Synchronous so a hook can
   * branch on it before deciding what to render (like `host.viz.isAvailable`),
   * which is why it is attached eagerly and cannot hide behind a Promise.
   */
  canRaster(): boolean;

  /**
   * Decode enough of `src` to report its ORIENTED pixel dimensions (EXIF
   * rotation applied, matching `decode`) and sniffed MIME. Rejects when `src`
   * can't be read here. Reuses the `ImageInfo` shape `host.images.decode`
   * already returns.
   */
  measure(src: RasterSource): Promise<ImageInfo>;

  /**
   * Decode `src` to a drawable `ImageBitmap` - EXIF orientation baked in,
   * HEIC/AVIF handled via the shell's bundled fallback, SVG via the shell's
   * reliable `<img>` path (decoding an SVG blob directly is unreliable), all
   * behind a decode-bomb guard. Draw it with `ctx.drawImage(bitmap, …)` on a
   * locally-built canvas/OffscreenCanvas exactly where an `<img>` was drawn
   * before - the only call-site change is the object's type. `ImageBitmap` has
   * `width`/`height` (no `naturalWidth`), and the shipped consumers already read
   * `img.naturalWidth || img.width`, so they are unchanged. Call `.close()` when
   * done to release the backing store eagerly (optional; GC'd otherwise). Rejects
   * when `src` can't be read.
   */
  decode(src: RasterSource): Promise<ImageBitmap>;

  /**
   * Encode finished pixels to bytes - the sink side of every `toDataURL` /
   * `toBlob` / `convertToBlob` a hook used to call. Accepts EITHER an
   * `ImageBitmap` (the cheap path - a hook that only composited, no per-pixel
   * read-back) OR a `RasterFrame` of raw RGBA (a hook that pulled pixels via
   * `getImageData` to do its own maths; a live `MediaFrame` is structurally a
   * `RasterFrame` and passes straight through). Mirrors `host.images`'
   * `{ format, quality }` in / `{ bytes, mime, width, height }` out - read the
   * result's actual mime back, since an encoder may fall back (PNG where WebP is
   * unsupported).
   */
  encode(source: ImageBitmap | RasterFrame, opts: ImageEncodeOpts): Promise<ImageResult>;
}

/**
 * What `host.raster` can decode/measure: a fetchable URL (including a `blob:` or
 * `data:` one - the form every AssetRef.url in this app takes), an AssetRef
 * directly (so a hook need not unwrap `.url` itself), or raw encoded bytes / a
 * Blob (so a `file` input's in-memory upload is readable without being written
 * anywhere first). Mirrors `AudioSource`, with `Blob` for `host.images` parity.
 * A local `blob:`/`data:` URL needs no `network` capability.
 */
export type RasterSource = string | AssetRef | Uint8Array | Blob;

/**
 * Raw RGBA pixels - the DOM-free shape `getImageData`/`putImageData` deal in,
 * and the encode-input sibling of `MediaFrame` (minus the timestamp a finished
 * still has no use for). A `MediaFrame` value is structurally assignable here,
 * so an `onFrame` frame hands straight to `encode()`.
 */
export interface RasterFrame {
  width: number;
  height: number;
  /** Tightly-packed RGBA bytes, length width*height*4. */
  data: Uint8ClampedArray;
}
