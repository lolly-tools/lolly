// SPDX-License-Identifier: MPL-2.0
/** Shared WASM transport for the Affinity document reader, used by the browser and Node shells. */
import type { AffinityModel } from '../../../engine/src/design-map-affinity.ts';

export const AFFINITY_MAX_INPUT = 96 * 1024 * 1024;
const MAX_JSON = 48 * 1024 * 1024;
const MAX_RESULT = 128 * 1024 * 1024 + MAX_JSON + 4;

/** Affinity containers open with 00 FF 'K' 'A'; documents and asset libraries share this signature. */
const SIGNATURE = [0x00, 0xff, 0x4b, 0x41];
export function isAffinitySignature(bytes: Uint8Array): boolean {
  return bytes.length >= 16 && SIGNATURE.every((b, i) => bytes[i] === b);
}

export type AffinityKind = 'af' | 'afdesign' | 'afphoto' | 'afpub' | 'aftemplate';
/** The document kind from the file name; the container does not record which app saved the file. */
export function affinityKindOf(name: string): AffinityKind {
  const ext = /\.(af|afdesign|afphoto|afpub|aftemplate)$/i.exec(name.trim())?.[1]?.toLowerCase();
  return (ext ?? 'af') as AffinityKind;
}

export type AffinityErrorCode = 'limit' | 'failed' | 'crashed';
export class AffinityError extends Error {
  readonly code: AffinityErrorCode;
  constructor(code: AffinityErrorCode, message: string) { super(message); this.name = 'AffinityError'; this.code = code; }
}

export interface AffinityInspection {
  kind: AffinityKind;
  /** Container version, 8 to 12. Affinity 1 and 2 write 8 to 11, Affinity 3 writes 12. */
  container: number;
  /** Seconds since 1970 as written by the app, or 0. */
  saved: number;
  /** Affinity's own preview PNG, or null when the file has none the reader accepts. */
  preview: { width: number; height: number; png: Uint8Array } | null;
  previewError: string | null;
  /** Null when the model could not be read; the preview may still be there. */
  document: {
    dpi: number; spreads: number; pages: number; artboards: number; masters: number; layers: number;
    /** Document size in document pixels. */
    width: number; height: number;
    savedBy: string | null; warnings: string[];
  } | null;
  documentError: string | null;
}

interface Span { o: number; l: number }
interface RawFacts {
  container: number; flags: number; saved: number;
  preview: { width: number; height: number; png: Span } | null; previewError: string | null;
  document: AffinityInspection['document']; documentError: string | null;
}

interface AffinityExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  affinity_alloc(length: number): number;
  affinity_free(pointer: number): void;
  affinity_run(pointer: number, length: number, operation: number): number;
  affinity_result_ptr(): number;
  affinity_result_len(): number;
}
function isApi(e: WebAssembly.Exports): e is AffinityExports {
  return e.memory instanceof WebAssembly.Memory && ['affinity_alloc', 'affinity_free', 'affinity_run', 'affinity_result_ptr', 'affinity_result_len'].every(k => typeof e[k] === 'function');
}

function split(out: Uint8Array): { json: unknown; payload: Uint8Array } {
  if (out.length < 4) throw new AffinityError('failed', 'The Affinity reader returned a truncated response.');
  const length = new DataView(out.buffer, out.byteOffset).getUint32(0, true);
  if (length > MAX_JSON || 4 + length > out.length) throw new AffinityError('failed', 'The Affinity reader returned invalid data.');
  return { json: JSON.parse(new TextDecoder().decode(out.subarray(4, 4 + length))), payload: out.subarray(4 + length) };
}
function span(payload: Uint8Array, s: Span): Uint8Array {
  if (!Number.isSafeInteger(s.o) || !Number.isSafeInteger(s.l) || s.o < 0 || s.l < 0 || s.o + s.l > payload.length) throw new AffinityError('failed', 'The Affinity reader returned an invalid data span.');
  return payload.subarray(s.o, s.o + s.l);
}

export async function createAffinityKernel(wasm: Uint8Array) {
  const { instance } = await WebAssembly.instantiate(wasm as Uint8Array<ArrayBuffer>, {});
  if (!isApi(instance.exports)) throw new Error('The Affinity reader ABI is incompatible.');
  const api = instance.exports;
  // A trap (memory ceiling, abort) leaves the instance in an unknown state, so it is retired.
  let dead = false;
  function run(bytes: Uint8Array, operation: number): Uint8Array {
    if (dead) throw new AffinityError('crashed', 'The Affinity reader stopped earlier and must be reloaded.');
    if (!bytes.length) throw new AffinityError('failed', 'This Affinity file is empty.');
    if (bytes.length > AFFINITY_MAX_INPUT) throw new AffinityError('limit', 'Choose an Affinity file smaller than 96 MB for on-device reading.');
    let pointer = 0;
    try {
      pointer = api.affinity_alloc(bytes.length);
      if (!pointer) throw new AffinityError('limit', 'The Affinity reader could not reserve memory for this file.');
      new Uint8Array(api.memory.buffer, pointer, bytes.length).set(bytes);
      const status = api.affinity_run(pointer, bytes.length, operation);
      const length = api.affinity_result_len(), at = api.affinity_result_ptr();
      if (length > MAX_RESULT || at + length > api.memory.buffer.byteLength) throw new AffinityError('limit', 'The Affinity reader returned an oversized response.');
      const out = new Uint8Array(api.memory.buffer, at, length).slice();
      if (status !== 0) throw new AffinityError(status === 2 ? 'limit' : 'failed', new TextDecoder().decode(out));
      return out;
    } catch (error) {
      if (error instanceof AffinityError) throw error;
      if (error instanceof WebAssembly.RuntimeError || error instanceof RangeError) {
        dead = true;
        throw new AffinityError('crashed', 'The Affinity reader ran out of memory or stopped on this file.');
      }
      throw error;
    } finally { if (!dead && pointer) api.affinity_free(pointer); }
  }
  return {
    /** True after a crash; load a fresh instance before the next read. */
    get dead(): boolean { return dead; },
    /** Stage 1: the embedded preview and basic facts. Quick, and never decodes pixel layers. */
    inspect(bytes: Uint8Array, name = 'document.af'): AffinityInspection {
      const { json, payload } = split(run(bytes, 1));
      const raw = json as RawFacts;
      return {
        kind: affinityKindOf(name), container: raw.container, saved: raw.saved,
        preview: raw.preview ? { width: raw.preview.width, height: raw.preview.height, png: span(payload, raw.preview.png).slice() } : null,
        previewError: raw.previewError, document: raw.document, documentError: raw.documentError,
      };
    },
    /** Stage 2: the document model, with its pictures in `payload`. */
    model(bytes: Uint8Array): { model: AffinityModel; payload: Uint8Array } {
      const { json, payload } = split(run(bytes, 2));
      const model = json as AffinityModel;
      if (!model || !Array.isArray(model.spreads) || !Number.isFinite(model.dpi)) throw new AffinityError('failed', 'The Affinity reader returned an invalid model.');
      return { model, payload: payload.slice() };
    },
  };
}
export type AffinityKernel = Awaited<ReturnType<typeof createAffinityKernel>>;
export { span as affinitySpan };

/** Short, plain wording for a reader failure, for import dialogs and the CLI. */
export function describeAffinityError(error: unknown): string {
  if (error instanceof AffinityError) {
    if (error.code === 'limit' || error.code === 'crashed') return `${error.message} Export the design from Affinity as SVG or PDF instead.`;
    return `This Affinity file could not be read on this device: ${error.message}. Export the design from Affinity as SVG or PDF instead.`;
  }
  return error instanceof Error ? error.message : String(error);
}
