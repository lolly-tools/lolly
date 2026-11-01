// SPDX-License-Identifier: MPL-2.0
/** Shared WASM transport for the DXF reader, used by the browser and Node shells. */
import type { DxfRaw, DxfReader } from '../../../engine/src/dxf-import.ts';

export const DXF_MAX_INPUT = 32 * 1024 * 1024;
export const DXF_MAX_OUTPUT = 48 * 1024 * 1024;
const OP_READ = 1;

export type DxfErrorCode = 'limit' | 'failed' | 'crashed';
export class DxfError extends Error {
  readonly code: DxfErrorCode;
  constructor(code: DxfErrorCode, message: string) { super(message); this.name = 'DxfError'; this.code = code; }
}

interface DxfExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  dxf_alloc(length: number): number;
  dxf_free(pointer: number): void;
  dxf_run(pointer: number, length: number, operation: number): number;
  dxf_result_ptr(): number;
  dxf_result_len(): number;
}
function isApi(e: WebAssembly.Exports): e is DxfExports {
  return e.memory instanceof WebAssembly.Memory
    && ['dxf_alloc', 'dxf_free', 'dxf_run', 'dxf_result_ptr', 'dxf_result_len'].every(k => typeof e[k] === 'function');
}

export async function createDxfKernel(wasm: Uint8Array) {
  const { instance } = await WebAssembly.instantiate(wasm as Uint8Array<ArrayBuffer>, {});
  if (!isApi(instance.exports)) throw new Error('The DXF reader ABI is incompatible.');
  const api = instance.exports;
  // A trap (memory ceiling, abort) leaves the instance in an unknown state, so it is retired.
  let dead = false;
  return {
    /** True after a crash; load a fresh instance before the next file. */
    get dead(): boolean { return dead; },
    /** Read a DXF file (ASCII or binary, R12 to 2018) into the flat entity list. */
    read: ((bytes: Uint8Array): DxfRaw => {
      if (dead) throw new DxfError('crashed', 'The DXF reader stopped earlier and must be reloaded.');
      if (!bytes.length) throw new DxfError('failed', 'This DXF file is empty.');
      if (bytes.length > DXF_MAX_INPUT) throw new DxfError('limit', 'Choose a DXF file smaller than 32 MB. Purge unused blocks and layers in your CAD program, or export a smaller area.');
      let pointer = 0;
      try {
        pointer = api.dxf_alloc(bytes.length);
        if (!pointer) throw new DxfError('limit', 'The DXF reader could not reserve memory for this file.');
        new Uint8Array(api.memory.buffer, pointer, bytes.length).set(bytes);
        const status = api.dxf_run(pointer, bytes.length, OP_READ);
        const length = api.dxf_result_len(), at = api.dxf_result_ptr();
        if (length > DXF_MAX_OUTPUT || at + length > api.memory.buffer.byteLength) throw new DxfError('limit', 'The DXF reader returned an oversized response.');
        const out = new Uint8Array(api.memory.buffer, at, length).slice();
        const text = new TextDecoder().decode(out);
        if (status !== 0) throw new DxfError(/larger than|more than|too large/.test(text) ? 'limit' : 'failed', text);
        const parsed = JSON.parse(text) as DxfRaw;
        if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.e) || !Array.isArray(parsed.layers)) throw new DxfError('failed', 'The DXF reader returned an unreadable response.');
        return parsed;
      } catch (error) {
        if (error instanceof DxfError) throw error;
        if (error instanceof WebAssembly.RuntimeError || error instanceof RangeError) {
          dead = true;
          throw new DxfError('crashed', 'The DXF reader ran out of memory or stopped on this file.');
        }
        throw error;
      } finally {
        if (!dead && pointer) api.dxf_free(pointer);
      }
    }) satisfies DxfReader,
  };
}
export type DxfKernel = Awaited<ReturnType<typeof createDxfKernel>>;

/** Short, plain wording for a reader failure, for import dialogs and the CLI. */
export function describeDxfError(error: unknown): string {
  if (error instanceof DxfError) return error.code === 'failed' ? `This DXF file could not be read: ${error.message}` : error.message;
  return error instanceof Error ? error.message : String(error);
}
