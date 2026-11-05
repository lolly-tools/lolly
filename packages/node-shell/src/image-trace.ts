// SPDX-License-Identifier: MPL-2.0
/** Shared WASM transport for Trace image, used by the browser worker and the Node shell. */
import {
  IMAGE_TRACE_MAX_PIXELS, IMAGE_TRACE_OPS, IMAGE_TRACE_PRESETS, ImageTraceError, readImageTraceWire,
  type ImageTracePreset, type ImageTraceResult,
} from '../../../engine/src/image-trace.ts';

const MAX_REQUEST = 8 + IMAGE_TRACE_MAX_PIXELS * 4;
const MAX_RESULT = 64 * 1024 * 1024;

interface TraceExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  image_trace_alloc(length: number): number;
  image_trace_free(pointer: number): void;
  image_trace_run(pointer: number, length: number, operation: number): number;
  image_trace_result_ptr(): number;
  image_trace_result_len(): number;
}
function isApi(e: WebAssembly.Exports): e is TraceExports {
  return e.memory instanceof WebAssembly.Memory
    && ['image_trace_alloc', 'image_trace_free', 'image_trace_run', 'image_trace_result_ptr', 'image_trace_result_len'].every(k => typeof e[k] === 'function');
}

export interface ImageTraceKernel {
  /** Trace straight-alpha RGBA. Throws `ImageTraceError` for a refusal. */
  trace(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, preset: ImageTracePreset): ImageTraceResult;
  /** The raw JSON the module returned, for tests that compare bytes. */
  traceBytes(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, preset: ImageTracePreset): Uint8Array;
}

export async function createImageTraceKernel(wasm: Uint8Array): Promise<ImageTraceKernel> {
  const { instance } = await WebAssembly.instantiate(wasm as Uint8Array<ArrayBuffer>, {});
  if (!isApi(instance.exports)) throw new Error('The image trace module ABI is incompatible.');
  const api = instance.exports;

  function traceBytes(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, preset: ImageTracePreset): Uint8Array {
    if (!IMAGE_TRACE_PRESETS.includes(preset)) throw new ImageTraceError('invalid', 'Choose one of the trace presets.');
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new ImageTraceError('invalid', 'The image has no size to trace.');
    if (width * height > IMAGE_TRACE_MAX_PIXELS) throw new ImageTraceError('limit', 'This image is too large to trace. Scale it down first.');
    if (rgba.length !== width * height * 4) throw new ImageTraceError('invalid', 'The pixel data does not match the image size.');
    const length = 8 + rgba.length;
    if (length > MAX_REQUEST) throw new ImageTraceError('limit', 'This image is too large to trace. Scale it down first.');
    const pointer = api.image_trace_alloc(length);
    if (!pointer) throw new ImageTraceError('failed', 'The image trace module refused the request allocation.');
    try {
      const view = new DataView(api.memory.buffer, pointer, length);
      view.setUint32(0, width, true);
      view.setUint32(4, height, true);
      new Uint8Array(api.memory.buffer, pointer + 8, rgba.length).set(rgba as Uint8Array);
      const status = api.image_trace_run(pointer, length, IMAGE_TRACE_OPS[preset]);
      const at = api.image_trace_result_ptr(), size = api.image_trace_result_len();
      if (size > MAX_RESULT || at + size > api.memory.buffer.byteLength) throw new ImageTraceError('failed', 'The image trace module returned an oversized response.');
      const out = new Uint8Array(api.memory.buffer, at, size).slice();
      if (status !== 0) throw new ImageTraceError('failed', new TextDecoder().decode(out));
      return out;
    } finally { api.image_trace_free(pointer); }
  }

  function trace(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, preset: ImageTracePreset): ImageTraceResult {
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder().decode(traceBytes(rgba, width, height, preset))); }
    catch (error) {
      if (error instanceof SyntaxError) throw new ImageTraceError('invalid', 'The tracer returned a result that could not be read.');
      throw error;
    }
    return readImageTraceWire(parsed);
  }
  return { trace, traceBytes };
}
