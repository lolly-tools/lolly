// SPDX-License-Identifier: MPL-2.0
/** Shared WASM transport for spreadsheet formulas, used by the browser and Node shells. */
import type { CalcRunner } from '../../../engine/src/calc.ts';

const MAX_REQUEST = 16 * 1024 * 1024;
const MAX_RESULT = 40 * 1024 * 1024;
/** A module that has grown past this is replaced after the call, so one huge sheet does not pin its memory. */
const MAX_RETAINED_MEMORY = 256 * 1024 * 1024;

interface CalcExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  gridcraft_calc_alloc(length: number): number;
  gridcraft_calc_free(pointer: number): void;
  gridcraft_calc_run(pointer: number, length: number, operation: number): number;
  gridcraft_calc_result_ptr(): number;
  gridcraft_calc_result_len(): number;
}
function isApi(e: WebAssembly.Exports): e is CalcExports {
  return e.memory instanceof WebAssembly.Memory
    && ['gridcraft_calc_alloc', 'gridcraft_calc_free', 'gridcraft_calc_run', 'gridcraft_calc_result_ptr', 'gridcraft_calc_result_len'].every(k => typeof e[k] === 'function');
}

/** Compile the module. The browser refuses a synchronous compile of a large module, so this is asynchronous. */
export async function compileGridcraftCalc(wasm: Uint8Array): Promise<WebAssembly.Module> {
  const module = await WebAssembly.compile(wasm as Uint8Array<ArrayBuffer>);
  if (WebAssembly.Module.imports(module).length) throw new Error('The calculation module asks the host for imports.');
  return module;
}

/**
 * A synchronous runner over a compiled module. The module aborts instead of unwinding,
 * so a trap leaves it unusable: the instance is dropped, the call fails with a plain
 * message, and the next call starts a fresh one.
 */
export function createGridcraftCalcRunner(module: WebAssembly.Module): CalcRunner {
  let api: CalcExports | undefined;
  const instance = (): CalcExports => {
    if (api) return api;
    const exports = new WebAssembly.Instance(module, {}).exports;
    if (!isApi(exports)) throw new Error('The calculation module ABI is incompatible.');
    api = exports;
    return exports;
  };
  return (operation, request) => {
    if (!request.length || request.length > MAX_REQUEST) throw new Error('The calculation request is too large.');
    const module = instance();
    let pointer = 0;
    try {
      pointer = module.gridcraft_calc_alloc(request.length);
      if (!pointer) throw new Error('The calculation module refused the request allocation.');
      new Uint8Array(module.memory.buffer, pointer, request.length).set(request);
      const status = module.gridcraft_calc_run(pointer, request.length, operation);
      const length = module.gridcraft_calc_result_len(), at = module.gridcraft_calc_result_ptr();
      if (length > MAX_RESULT || at + length > module.memory.buffer.byteLength) throw new Error('The calculation module returned an oversized response.');
      const out = new Uint8Array(module.memory.buffer, at, length).slice();
      if (status !== 0) throw new Error(new TextDecoder().decode(out));
      return out;
    } catch (error) {
      if (error instanceof WebAssembly.RuntimeError) {
        api = undefined;
        throw new Error('The calculation stopped on this input. Simplify the formulas and try again.');
      }
      throw error;
    } finally {
      if (api && pointer) api.gridcraft_calc_free(pointer);
      if (api && api.memory.buffer.byteLength > MAX_RETAINED_MEMORY) api = undefined;
    }
  };
}
