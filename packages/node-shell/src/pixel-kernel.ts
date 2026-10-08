// SPDX-License-Identifier: MPL-2.0
/** Rust/WASM numerical reference for the GPU LUT recipe. This is not a graphics fallback. */
import { readFile } from 'node:fs/promises';
import type { GradeLut } from '../../../engine/src/grade.ts';
import { admitLutJob } from './pixel-kernel-contract.ts';

type PixelKernelExports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  lolly_alloc(bytes: number): number;
  lolly_free(pointer: number): void;
  lolly_allocated_bytes(): number;
  lolly_grade_lut(pixels: number, samples: number, kind: number, size: number, amount: number, minR: number, minG: number, minB: number, maxR: number, maxG: number, maxB: number): number;
};

function isPixelKernel(exports: WebAssembly.Exports): exports is PixelKernelExports {
  return exports.memory instanceof WebAssembly.Memory && ['lolly_alloc', 'lolly_free', 'lolly_allocated_bytes', 'lolly_grade_lut'].every(key => typeof exports[key] === 'function');
}

let pending: Promise<PixelKernelExports> | null = null;
export function pixelKernel(): Promise<PixelKernelExports> {
  if (!pending) {
    pending = (async () => {
      const bytes = await readFile(new URL('../wasm/pixel-kernel/pixel-kernel.wasm', import.meta.url));
      const { instance } = await WebAssembly.instantiate(new Uint8Array(bytes), {});
      if (!isPixelKernel(instance.exports)) throw new Error('The pixel kernel ABI is incompatible.');
      return instance.exports;
    })().catch(error => { pending = null; throw error; });
  }
  return pending;
}

export async function gradeLutWasm(pixels: Uint8ClampedArray, lut: GradeLut, intensity = 1): Promise<Uint8ClampedArray> {
  const amount = admitLutJob(pixels, lut, intensity);
  if (!pixels.length) return pixels.slice();
  const api = await pixelKernel();
  const source = api.lolly_alloc(pixels.byteLength);
  let table = 0;
  try {
    if (!source) throw new Error('The pixel kernel refused the frame allocation.');
    table = api.lolly_alloc(lut.data.byteLength);
    if (!table) throw new Error('The pixel kernel refused the LUT allocation.');
    new Uint8Array(api.memory.buffer, source, pixels.byteLength).set(pixels);
    new Uint8Array(api.memory.buffer, table, lut.data.byteLength).set(new Uint8Array(lut.data.buffer, lut.data.byteOffset, lut.data.byteLength));
    const status = api.lolly_grade_lut(source, table, lut.kind === '1d' ? 0 : 1, lut.size, amount, ...lut.domainMin, ...lut.domainMax);
    if (status !== 0) throw new Error(`The pixel kernel rejected the operation (${status}).`);
    return new Uint8ClampedArray(api.memory.buffer, source, pixels.byteLength).slice();
  } finally {
    if (table) api.lolly_free(table);
    if (source) api.lolly_free(source);
  }
}
