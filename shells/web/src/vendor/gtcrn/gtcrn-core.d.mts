/** The vendored GTCRN surface (see README.md). Deliberately narrow: only what
 *  lib/audio-clean-core.ts drives. */
export interface GtcrnModule {
  HEAPF32: Float32Array;
  _malloc(bytes: number): number;
  _free(ptr: number): void;
}
export declare class GtcrnProcessor {
  constructor(module: GtcrnModule, opts?: { sampleRate?: 16000 | 48000 });
  readonly frameSize: number;
  /** Enhance exactly one frame (frameSize samples); returns a fresh frame. */
  process(frame: Float32Array): Float32Array;
  destroy(): void;
}
declare const gtcrnFactory: (opts?: { wasmBinary?: ArrayBuffer }) => Promise<GtcrnModule>;
export { gtcrnFactory };
/** The embedded upstream gtcrn.wasm bytes. */
export declare function gtcrnWasmBinary(): ArrayBuffer;
