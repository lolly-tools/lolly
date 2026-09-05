// SPDX-License-Identifier: MPL-2.0

// ─── Layered-bitmap write-back (optional, v1.102) ────────────────────────────

/**
 * One layer of a {@link LayersAPI.writePsd} document - the tool-facing mirror
 * of the engine's `PsdWriteLayer` (tools cannot import the engine, so the shape
 * is restated here as the versioned contract). Pixels are plain 8-bit RGBA,
 * un-premultiplied sRGB - exactly what a canvas `getImageData` gives.
 */
export interface LayerWrite {
  name: string;
  /** Document-space bounds; width/height must match the pixel buffer. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** RGBA8, length width*height*4. */
  pixels: Uint8Array;
  /** 0..1, default 1. */
  opacity?: number;
  /** A CSS mix-blend-mode value ('normal' | 'multiply' | …), default 'normal'. */
  blend?: string;
  /** Default true. */
  visible?: boolean;
}

/** A layered document for {@link LayersAPI.writePsd}; layers are bottom-to-top. */
export interface LayeredWriteDoc {
  width: number;
  height: number;
  layers: LayerWrite[];
}

/**
 * Layered-bitmap serialisers (see `HostV1.layers`). Async so a shell may
 * offload the encode; the maths is the engine's `psd-write.ts`, so web and CLI
 * emit identical bytes for identical docs.
 */
export interface LayersAPI {
  /** Serialise as a layered Photoshop PSD (8-bit RGB v1; see engine psd-write.ts). */
  writePsd(doc: LayeredWriteDoc): Promise<Uint8Array>;
}
