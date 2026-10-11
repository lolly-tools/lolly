// SPDX-License-Identifier: MPL-2.0
import type { LayoutRequest, LayoutSolver } from '@lolly/engine';

interface Exports {
  memory: WebAssembly.Memory;
  layout_alloc(length: number): number;
  layout_free(pointer: number, length: number): void;
  layout_solve(pointer: number, length: number): number;
  layout_output_len(): number;
}
const MAX_BYTES = 8 * 1024 * 1024;

/** One synchronous instance belongs to one host; returned objects own their values. */
export async function createLayoutKernel(bytes: Uint8Array): Promise<LayoutSolver> {
  const module = await WebAssembly.compile(bytes as Uint8Array<ArrayBuffer>);
  if (WebAssembly.Module.imports(module).length)
    throw new Error('Layout kernel must not import host functions.');
  const api = new WebAssembly.Instance(module, {}).exports as unknown as Exports;
  for (const name of [
    'layout_alloc',
    'layout_free',
    'layout_solve',
    'layout_output_len',
  ] as const) {
    if (typeof api[name] !== 'function') throw new Error(`Layout kernel lacks ${name}.`);
  }
  if (!(api.memory instanceof WebAssembly.Memory)) throw new Error('Layout kernel lacks memory.');
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  return (request: LayoutRequest) => {
    const input = encoder.encode(JSON.stringify(request));
    if (input.length > MAX_BYTES) throw new Error('Layout request exceeds 8 MiB.');
    const pointer = api.layout_alloc(input.length);
    if (!pointer) throw new Error('Layout allocation failed.');
    try {
      new Uint8Array(api.memory.buffer, pointer, input.length).set(input);
      const output = api.layout_solve(pointer, input.length);
      const length = api.layout_output_len();
      if (!length || length > MAX_BYTES) throw new Error('Layout response exceeds 8 MiB.');
      const result = JSON.parse(decoder.decode(new Uint8Array(api.memory.buffer, output, length)));
      if (result.error) throw new Error(String(result.error));
      const vectors = (value: unknown, count: number, width: number): boolean =>
        Array.isArray(value) &&
        value.length === count &&
        value.every(
          (row) => Array.isArray(row) && row.length === width && row.every(Number.isFinite)
        );
      if (
        !vectors(result.bounds, request.items.length + 1, 8) ||
        (request.mode === 'grid' &&
          (!vectors(result.columns, request.columns.length, 5) ||
            !vectors(result.rows, request.rows.length, 5)))
      ) {
        throw new Error('Layout kernel returned malformed geometry.');
      }
      return result;
    } finally {
      api.layout_free(pointer, input.length);
    }
  };
}
