// SPDX-License-Identifier: MPL-2.0
// Ambient declarations for the export vendor libraries that ship no type
// definitions. Only the surface the adapters actually use is declared — honest,
// narrow contracts, not `any`.

declare module 'dom-to-image-more' {
  import type { DomToImage } from './types.ts';
  export const toPng: DomToImage['toPng'];
  export const toJpeg: DomToImage['toJpeg'];
  export const toCanvas: DomToImage['toCanvas'];
  const lib: DomToImage;
  export default lib;
}

declare module 'gifenc' {
  /** A palette is an array of [r,g,b] (or [r,g,b,a]) tuples. */
  export type GifPalette = number[][];
  export interface GifWriteFrameOpts {
    palette?: GifPalette;
    delay?: number;
    repeat?: number;
  }
  export interface GifEncoderInstance {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: GifWriteFrameOpts): void;
    finish(): void;
    bytesView(): Uint8Array;
  }
  export function GIFEncoder(): GifEncoderInstance;
  export function quantize(rgba: Uint8ClampedArray | Uint8Array, maxColors: number): GifPalette;
  export function applyPalette(rgba: Uint8ClampedArray | Uint8Array, palette: GifPalette): Uint8Array;
}
