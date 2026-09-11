// SPDX-License-Identifier: MPL-2.0
// Ambient declarations for export vendor libraries that ship no type
// definitions. Only the surface the export bridge actually uses is declared -
// narrow, honest contracts rather than `any`.

declare module 'dom-to-image-more' {
  interface DomToImageOptions {
    width?: number;
    height?: number;
    bgcolor?: string;
    quality?: number;
    scale?: number;
    cacheBust?: boolean;
    imagePlaceholder?: string;
    style?: Record<string, string>;
    filter?: (node: Node) => boolean;
    [k: string]: unknown;
  }
  interface DomToImage {
    toPng(node: Node, options?: DomToImageOptions): Promise<string>;
    toJpeg(node: Node, options?: DomToImageOptions): Promise<string>;
    toSvg(node: Node, options?: DomToImageOptions): Promise<string>;
    toBlob(node: Node, options?: DomToImageOptions): Promise<Blob>;
    toCanvas(node: Node, options?: DomToImageOptions): Promise<HTMLCanvasElement>;
    toPixelData(node: Node, options?: DomToImageOptions): Promise<Uint8ClampedArray>;
  }
  export const toPng: DomToImage['toPng'];
  export const toJpeg: DomToImage['toJpeg'];
  export const toSvg: DomToImage['toSvg'];
  export const toBlob: DomToImage['toBlob'];
  export const toCanvas: DomToImage['toCanvas'];
  export const toPixelData: DomToImage['toPixelData'];
  const lib: DomToImage;
  export default lib;
}

// butterchurn (the MilkDrop visualizer) ships a webpack UMD bundle and no types.
// Only what lib/butterchurn-viz.ts calls is declared. `loadPreset` takes our OWN
// preset shape deliberately: we author presets as real functions rather than the
// equation SOURCE STRINGS the stock converted packs use, which is what keeps the
// visualizer off `new Function` (see lib/viz-presets.ts).
declare module 'butterchurn' {
  export interface ButterchurnVisualizer {
    connectAudio(node: AudioNode): void;
    /** Selective - unhooks only this node's branch into butterchurn's tap. */
    disconnectAudio(node: AudioNode): void;
    loadPreset(preset: import('./lib/viz-presets.ts').VizPreset, blendSeconds?: number): void;
    setRendererSize(width: number, height: number, opts?: Record<string, number>): void;
    /** Draw one frame. Call from a requestAnimationFrame loop. */
    render(): void;
  }
  export interface ButterchurnOptions {
    width: number;
    height: number;
    pixelRatio?: number;
    textureRatio?: number;
    meshWidth?: number;
    meshHeight?: number;
    outputFXAA?: boolean;
  }
  export function createVisualizer(
    ctx: BaseAudioContext,
    canvas: HTMLCanvasElement,
    opts: ButterchurnOptions,
  ): ButterchurnVisualizer;
  const butterchurn: { createVisualizer: typeof createVisualizer };
  export default butterchurn;
}

declare module 'gifenc' {
  /** A palette is an array of [r,g,b] (or [r,g,b,a]) tuples. */
  export type GifPalette = number[][];
  export interface GifWriteFrameOpts {
    palette?: GifPalette;
    delay?: number;
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
    dispose?: number;
  }
  export interface GifEncoderInstance {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: GifWriteFrameOpts): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
  }
  export function GIFEncoder(): GifEncoderInstance;
  export function quantize(rgba: Uint8ClampedArray | Uint8Array, maxColors: number): GifPalette;
  export function applyPalette(rgba: Uint8ClampedArray | Uint8Array, palette: GifPalette): Uint8Array;
}
