// Types for the vendored Emscripten build of libopenmpt (libopenmpt.mjs).
// Only the surface mod-worker.ts actually uses is declared. The module default-exports
// an Emscripten factory (EXPORT_NAME=createLibopenmpt) returning the ready module.

/** The Emscripten `Module` object once instantiated, narrowed to what we call. */
export interface LibopenmptModule {
  /** Wrap an exported C function. `ret`/`argTypes` use Emscripten's type names. */
  cwrap(name: string, ret: 'number' | null, argTypes: Array<'number'>): (...args: number[]) => number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  /** Live heap views - re-read after any allocation, ALLOW_MEMORY_GROWTH can detach them. */
  readonly HEAPU8: Uint8Array;
  readonly HEAPF32: Float32Array;
}

/** Instantiate the module. Emscripten's SINGLE_FILE build embeds the wasm, so no fetch. */
declare const createLibopenmpt: (moduleOverrides?: Record<string, unknown>) => Promise<LibopenmptModule>;
export default createLibopenmpt;
