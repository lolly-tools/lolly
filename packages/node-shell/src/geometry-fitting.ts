// SPDX-License-Identifier: MPL-2.0
/** Shell-owned complete offset-fitting comparison module and synchronous operation workspace. */
import type { Cubic, Pt } from '../../../engine/src/geom/bezier.ts';
import { GeometryKernelError } from './geometry-kernel-contract.ts';

export const GEOMETRY_MAX_OFFSET_PIECES = 16_384;
export type GeometryFittingMath = 'portable';
export interface GeometryOffsetPiece {
  curve: Cubic;
  dirStart: Pt | null;
  dirEnd: Pt | null;
}
export type GeometryFittingExports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  geom_alloc(bytes: number): number;
  geom_free(pointer: number): void;
  geom_buffer_bytes(): number;
  geom_offset_fit_create(query: number): number;
  geom_offset_fit_len(handle: number): number;
  geom_offset_fit_read(handle: number, output: number): number;
  geom_offset_fit_free(handle: number): void;
  geom_offset_fit_count(): number;
  geom_offset_fit_pieces(): number;
};
function invalid(message: string): never {
  throw new GeometryKernelError('invalid-argument', message);
}
function coordinate(value: number): void {
  if (!Number.isFinite(value) || Math.abs(value) > 1e9)
    invalid('Offset fitting values must be finite and within the supported range.');
}
export async function createGeometryFitting(
  bytes: BufferSource,
  mathBackend: GeometryFittingMath = 'portable'
) {
  if (mathBackend !== 'portable') invalid('Unknown fitting maths backend.');
  const compiled = await WebAssembly.compile(bytes);
  // The fitter and the TypeScript reference share one compiled scalar maths; a host
  // import would bring back the engine-specific rounding this module exists to avoid.
  if (WebAssembly.Module.imports(compiled).length !== 0)
    throw new GeometryKernelError('internal', 'The fitting module has an unexpected host import.');
  const names = ['sin', 'cos', 'acos', 'cbrt', 'atan2'] as const;
  const instance = await WebAssembly.instantiate(compiled, {});
  const api = instance.exports as GeometryFittingExports;
  if (
    !(api.memory instanceof WebAssembly.Memory) ||
    [
      'geom_alloc',
      'geom_free',
      'geom_buffer_bytes',
      'geom_offset_fit_create',
      'geom_offset_fit_len',
      'geom_offset_fit_read',
      'geom_offset_fit_free',
      'geom_offset_fit_count',
      'geom_offset_fit_pieces',
    ].some((name) => typeof api[name] !== 'function')
  )
    throw new GeometryKernelError('internal', 'The fitting module has an incomplete owned ABI.');
  if (names.some((name) => typeof api['geom_math_' + name] !== 'function'))
    throw new GeometryKernelError(
      'internal',
      'The portable fitting module has incomplete scalar maths.'
    );
  return {
    createOffsetFitWorkspace: () => createOffsetFitWorkspace(api),
    stats: () => ({
      mathBackend,
      results: api.geom_offset_fit_count(),
      pieces: api.geom_offset_fit_pieces(),
      bufferBytes: api.geom_buffer_bytes(),
      linearBytes: api.memory.buffer.byteLength,
    }),
  };
}

export function createOffsetFitWorkspace(api: GeometryFittingExports) {
  let query = 0,
    output = 0,
    count = 0,
    disposed = false;
  function release(): void {
    api.geom_free(query);
    api.geom_free(output);
    query = 0;
    output = 0;
    count = 0;
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    release();
  }
  function fit(src: Cubic, distance: number, tol: number): GeometryOffsetPiece[] {
    if (disposed) invalid('This offset fitting workspace has been disposed.');
    if (src.length !== 8) invalid('Offset fitting requires eight cubic coordinates.');
    for (const value of src) coordinate(value);
    coordinate(distance);
    coordinate(tol);
    if (tol <= 0) invalid('Offset fitting requires a positive tolerance.');
    try {
      if (!query) {
        query = api.geom_alloc(80);
        if (!query)
          throw new GeometryKernelError('limit', 'The fitting kernel refused its query buffer.');
      }
      const input = new DataView(api.memory.buffer);
      [...src, distance, tol].forEach((value, i) => {
        input.setFloat64(query + i * 8, value, true);
      });
      const handle = api.geom_offset_fit_create(query);
      if (handle <= 0)
        throw new GeometryKernelError(
          handle === -2 ? 'limit' : handle === -1 ? 'invalid-argument' : 'internal',
          `The fitting kernel refused the complete offset operation (${handle}).`
        );
      try {
        const length = api.geom_offset_fit_len(handle);
        if (!Number.isInteger(length) || length < 0 || length > GEOMETRY_MAX_OFFSET_PIECES)
          throw new GeometryKernelError(
            'internal',
            'The fitting kernel returned an invalid piece count.'
          );
        if (!length) return [];
        if (length !== count) {
          api.geom_free(output);
          output = 0;
          count = 0;
          output = api.geom_alloc(length * 112);
          if (!output)
            throw new GeometryKernelError('limit', 'The fitting kernel refused its result buffer.');
          count = length;
        }
        const status = api.geom_offset_fit_read(handle, output);
        if (status !== 0)
          throw new GeometryKernelError(
            'internal',
            `The fitting kernel refused its owned result (${status}).`
          );
        const result = new DataView(api.memory.buffer);
        const pieces: GeometryOffsetPiece[] = [];
        for (let i = 0; i < length; i++) {
          const record = Array.from({ length: 14 }, (_, j) =>
            result.getFloat64(output + i * 112 + j * 8, true)
          );
          if (
            record.some((v) => !Number.isFinite(v)) ||
            ![0, 1].includes(record[8]!) ||
            ![0, 1].includes(record[11]!)
          )
            throw new GeometryKernelError(
              'internal',
              'The fitting kernel returned invalid controls or source directions.'
            );
          pieces.push({
            curve: record.slice(0, 8) as Cubic,
            dirStart: record[8] ? { x: record[9]!, y: record[10]! } : null,
            dirEnd: record[11] ? { x: record[12]!, y: record[13]! } : null,
          });
        }
        return pieces;
      } finally {
        api.geom_offset_fit_free(handle);
      }
    } catch (error) {
      release();
      throw error;
    }
  }
  return { fit, dispose };
}
