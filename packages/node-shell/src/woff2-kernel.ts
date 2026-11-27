// SPDX-License-Identifier: MPL-2.0
/**
 * The WOFF2 decoder module (wasm/woff2-kernel: wuff with brotli-decompressor, in Rust), shared by
 * the browser worker, the Node worker thread and the tests.
 *
 * The page or process compiles the module once (`compileWoff2Kernel`); every decode then
 * gets a fresh instance with its own memory (`decodeWithWoff2Kernel`), so nothing one
 * font leaves in memory reaches the next. The module imports nothing from the host.
 */

/** The largest result the module may hand back: its own 30 MiB ceiling. */
const MAX_RESULT = 30 * 1024 * 1024;
const OP_DECODE = 1;

interface Woff2Exports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  woff2_alloc(length: number): number;
  woff2_free(pointer: number): void;
  woff2_run(pointer: number, length: number, operation: number): number;
  woff2_result_ptr(): number;
  woff2_result_len(): number;
}

function isWoff2Api(e: WebAssembly.Exports): e is Woff2Exports {
  return e.memory instanceof WebAssembly.Memory
    && ['woff2_alloc', 'woff2_free', 'woff2_run', 'woff2_result_ptr', 'woff2_result_len'].every((k) => typeof e[k] === 'function');
}

/** Compile the module from its bytes. The result can be posted to a worker. */
export function compileWoff2Kernel(wasm: Uint8Array): Promise<WebAssembly.Module> {
  return WebAssembly.compile(wasm as Uint8Array<ArrayBuffer>);
}

/**
 * Decode one WOFF2 file in a new instance of `module`. Throws an Error whose message is
 * the module's reason when it refuses the file, or a WebAssembly.RuntimeError when the
 * instance stops (the instance and its memory are then discarded).
 */
export async function decodeWithWoff2Kernel(module: WebAssembly.Module, bytes: Uint8Array): Promise<Uint8Array> {
  const instance = await WebAssembly.instantiate(module, {});
  if (!isWoff2Api(instance.exports)) throw new Error('The WOFF2 decoder module does not have the expected interface.');
  const api = instance.exports;
  const pointer = api.woff2_alloc(bytes.length);
  if (!pointer) throw new Error('The WOFF2 decoder could not take a file of this size.');
  new Uint8Array(api.memory.buffer, pointer, bytes.length).set(bytes);
  const status = api.woff2_run(pointer, bytes.length, OP_DECODE);
  const at = api.woff2_result_ptr(), length = api.woff2_result_len();
  if (length > MAX_RESULT || at + length > api.memory.buffer.byteLength) throw new Error('The WOFF2 decoder returned more than it may.');
  const out = new Uint8Array(api.memory.buffer, at, length).slice();
  if (status !== 0) throw new Error(new TextDecoder().decode(out));
  return out;
}
