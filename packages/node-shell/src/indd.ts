// SPDX-License-Identifier: MPL-2.0
/** Shared WASM transport for the INDD to IDML converter, used by the browser and Node shells. */

export const INDD_MAX_INPUT = 128 * 1024 * 1024;
export const INDD_MAX_OUTPUT = 128 * 1024 * 1024;
const MAX_WARNING_JSON = 128 * 1024;
const MAX_NAME_BYTES = 256;

/** The 16-byte signature every InDesign 2.0 and later file starts with, then ASCII DOCUMENT. */
const SIGNATURE = [0x06, 0x06, 0xed, 0xf5, 0xd8, 0x1d, 0x46, 0xe5, 0xbd, 0x31, 0xef, 0xe7, 0xfe, 0x74, 0xb7, 0x1d];
const DOCUMENT = [0x44, 0x4f, 0x43, 0x55, 0x4d, 0x45, 0x4e, 0x54];

/** True when the bytes open with the InDesign database signature. */
export function isInddSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 24 && SIGNATURE.every((b, i) => bytes[i] === b) && DOCUMENT.every((b, i) => bytes[16 + i] === b);
}

export type InddErrorCode = 'limit' | 'failed' | 'crashed';
export class InddError extends Error {
  readonly code: InddErrorCode;
  constructor(code: InddErrorCode, message: string) { super(message); this.name = 'InddError'; this.code = code; }
}

export interface InddConversion {
  /** The IDML package, a ZIP. */
  idml: Uint8Array;
  /** Problems that did not stop the conversion. */
  warnings: string[];
}

interface InddExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  indd_alloc(length: number): number;
  indd_free(pointer: number): void;
  indd_run(pointer: number, length: number, namePointer: number, nameLength: number): number;
  indd_result_ptr(): number;
  indd_result_len(): number;
}
function isApi(e: WebAssembly.Exports): e is InddExports {
  return e.memory instanceof WebAssembly.Memory && ['indd_alloc', 'indd_free', 'indd_run', 'indd_result_ptr', 'indd_result_len'].every(k => typeof e[k] === 'function');
}

export async function createInddKernel(wasm: Uint8Array) {
  const { instance } = await WebAssembly.instantiate(wasm as Uint8Array<ArrayBuffer>, {});
  if (!isApi(instance.exports)) throw new Error('The INDD converter ABI is incompatible.');
  const api = instance.exports;
  // A trap (memory ceiling, abort) leaves the instance in an unknown state, so it is retired.
  let dead = false;
  function put(bytes: Uint8Array): number {
    const pointer = api.indd_alloc(bytes.length);
    if (!pointer) throw new InddError('limit', 'The INDD converter could not reserve memory for this file.');
    new Uint8Array(api.memory.buffer, pointer, bytes.length).set(bytes);
    return pointer;
  }
  return {
    /** True after a crash; load a fresh instance before the next conversion. */
    get dead(): boolean { return dead; },
    convert(bytes: Uint8Array, name = 'document.indd'): InddConversion {
      if (dead) throw new InddError('crashed', 'The INDD converter stopped earlier and must be reloaded.');
      if (!bytes.length) throw new InddError('failed', 'This InDesign file is empty.');
      if (bytes.length > INDD_MAX_INPUT) throw new InddError('limit', 'Choose an InDesign file smaller than 128 MB for on-device conversion.');
      const label = new TextEncoder().encode(name).subarray(0, MAX_NAME_BYTES);
      let pointer = 0, namePointer = 0;
      try {
        pointer = put(bytes);
        if (label.length) namePointer = put(label);
        const status = api.indd_run(pointer, bytes.length, namePointer, label.length);
        const length = api.indd_result_len(), at = api.indd_result_ptr();
        if (length > INDD_MAX_OUTPUT + MAX_WARNING_JSON + 4 || at + length > api.memory.buffer.byteLength) throw new InddError('limit', 'The INDD converter returned an oversized response.');
        const out = new Uint8Array(api.memory.buffer, at, length).slice();
        if (status !== 0) throw new InddError(status === 2 ? 'limit' : 'failed', new TextDecoder().decode(out));
        if (out.length < 4) throw new InddError('failed', 'The INDD converter returned a truncated response.');
        const jsonLength = new DataView(out.buffer, out.byteOffset).getUint32(0, true);
        if (jsonLength > MAX_WARNING_JSON || 4 + jsonLength > out.length) throw new InddError('failed', 'The INDD converter returned invalid warnings.');
        const warnings = JSON.parse(new TextDecoder().decode(out.subarray(4, 4 + jsonLength))) as unknown;
        if (!Array.isArray(warnings) || !warnings.every(w => typeof w === 'string')) throw new InddError('failed', 'The INDD converter returned invalid warnings.');
        return { idml: out.subarray(4 + jsonLength), warnings };
      } catch (error) {
        if (error instanceof InddError) throw error;
        if (error instanceof WebAssembly.RuntimeError || error instanceof RangeError) {
          dead = true;
          throw new InddError('crashed', 'The INDD converter ran out of memory or stopped on this file.');
        }
        throw error;
      } finally {
        if (!dead) { if (pointer) api.indd_free(pointer); if (namePointer) api.indd_free(namePointer); }
      }
    },
  };
}
export type InddKernel = Awaited<ReturnType<typeof createInddKernel>>;

/** Short, plain wording for a converter failure, for import dialogs and the CLI. */
export function describeInddError(error: unknown): string {
  if (error instanceof InddError) {
    if (error.code === 'limit' || error.code === 'crashed') return `${error.message} Export an IDML from InDesign (File, Export, InDesign Markup) instead.`;
    return `This InDesign file could not be converted on this device: ${error.message}. Export an IDML from InDesign (File, Export, InDesign Markup) instead.`;
  }
  return error instanceof Error ? error.message : String(error);
}
