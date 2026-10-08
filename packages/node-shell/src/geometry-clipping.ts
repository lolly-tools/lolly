// SPDX-License-Identifier: MPL-2.0
/** Shell-owned complete pair-search comparison module and reusable operation workspace. */
import type { Cubic } from '../../../engine/src/geom/bezier.ts';
import type { Intersection } from '../../../engine/src/geom/intersect.ts';
import { GeometryKernelError } from './geometry-kernel-contract.ts';

export const GEOMETRY_CLIP_LIMITS = { initial: 16_384, overrun: 131_072, stalled: 65_536 };
/** The retained norm is V8's two-argument formula, the same as the TypeScript `pmath.hypot`. */
export type GeometryClippingMath = 'retained';
export type { GeometryClipLimits, GeometryClipCounts, GeometryClipResult } from '../../../engine/src/geom/operations.ts';
import type { GeometryClipLimits, GeometryClipResult } from '../../../engine/src/geom/operations.ts';
export type GeometryClippingExports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  geom_alloc(bytes: number): number;
  geom_free(pointer: number): void;
  geom_buffer_bytes(): number;
  geom_clip_create(query: number): number;
  geom_clip_len(handle: number): number;
  geom_clip_read(handle: number, output: number): number;
  geom_clip_free(handle: number): void;
  geom_clip_count(): number;
  geom_clip_hits(): number;
};
function invalid(message: string): never {
  throw new GeometryKernelError('invalid-argument', message);
}
export async function createGeometryClipping(bytes: BufferSource, mathBackend: GeometryClippingMath = 'retained') {
  if (mathBackend !== 'retained') invalid('Unknown clipping maths backend.');
  const compiled = await WebAssembly.compile(bytes);
  if (WebAssembly.Module.imports(compiled).length !== 0)
    throw new GeometryKernelError('internal', 'The clipping module has an unexpected host import.');
  const api = (await WebAssembly.instantiate(compiled, {})).exports as GeometryClippingExports;
  if (
    !(api.memory instanceof WebAssembly.Memory) ||
    [
      'geom_alloc',
      'geom_free',
      'geom_buffer_bytes',
      'geom_clip_create',
      'geom_clip_len',
      'geom_clip_read',
      'geom_clip_free',
      'geom_clip_count',
      'geom_clip_hits',
    ].some((name) => typeof api[name] !== 'function')
  )
    throw new GeometryKernelError('internal', 'The clipping module has an incomplete owned ABI.');
  return {
    createClipWorkspace: () => createClipWorkspace(api),
    stats: () => ({
      results: api.geom_clip_count(),
      hits: api.geom_clip_hits(),
      bufferBytes: api.geom_buffer_bytes(),
      linearBytes: api.memory.buffer.byteLength,
      mathBackend,
    }),
  };
}
export function createClipWorkspace(api: GeometryClippingExports) {
  let query = 0,
    output = 0,
    count = -1,
    disposed = false;
  function release(): void {
    api.geom_free(query);
    api.geom_free(output);
    query = output = 0;
    count = -1;
  }
  function dispose(): void {
    if (!disposed) {
      disposed = true;
      release();
    }
  }
  function intersect(
    a: Cubic,
    b: Cubic,
    tol: number,
    limits: GeometryClipLimits = GEOMETRY_CLIP_LIMITS
  ): GeometryClipResult {
    if (disposed) invalid('This clipping workspace has been disposed.');
    if (
      a.length !== 8 ||
      b.length !== 8 ||
      [...a, ...b, tol].some((v) => !Number.isFinite(v) || Math.abs(v) > 1e9) ||
      tol <= 0
    )
      invalid('Clipping requires finite cubic coordinates and a positive bounded tolerance.');
    for (const [value, cap] of [
      [limits.initial, 10_000_000],
      [limits.overrun, 262_144],
      [limits.stalled, 65_536],
    ])
      if (!Number.isInteger(value) || value! < 0 || value! > cap!)
        invalid('Clipping work controls exceed the supported range.');
    try {
      if (!query) {
        query = api.geom_alloc(160);
        if (!query)
          throw new GeometryKernelError('limit', 'The clipping kernel refused its query buffer.');
      }
      const input = new DataView(api.memory.buffer);
      [...a, ...b, tol, limits.initial, limits.overrun, limits.stalled].forEach((v, i) => {
        input.setFloat64(query + i * 8, v, true);
      });
      const handle = api.geom_clip_create(query);
      if (handle <= 0)
        throw new GeometryKernelError(
          handle === -2 ? 'limit' : handle === -1 ? 'invalid-argument' : 'internal',
          `The clipping kernel refused the complete pair search (${handle}).`
        );
      try {
        const length = api.geom_clip_len(handle);
        if (!Number.isInteger(length) || length < 0 || length > 129)
          throw new GeometryKernelError(
            'internal',
            'The clipping kernel returned an invalid hit count.'
          );
        if (length !== count) {
          api.geom_free(output);
          output = 0;
          count = -1;
          output = api.geom_alloc(48 + length * 48);
          if (!output)
            throw new GeometryKernelError(
              'limit',
              'The clipping kernel refused its result buffer.'
            );
          count = length;
        }
        const status = api.geom_clip_read(handle, output);
        if (status !== 0)
          throw new GeometryKernelError(
            'internal',
            `The clipping kernel refused its owned result (${status}).`
          );
        const view = new DataView(api.memory.buffer);
        const header = Array.from({ length: 6 }, (_, j) => view.getFloat64(output + j * 8, true));
        if (
          [0, 2, 3, 5].some((j) => ![0, 1].includes(header[j]!)) ||
          [1, 4].some((j) => !Number.isInteger(header[j]) || header[j]! < 0)
        )
          throw new GeometryKernelError(
            'internal',
            'The clipping kernel returned invalid work counters.'
          );
        const hits: Intersection[] = [];
        for (let i = 0; i < length; i++) {
          const r = Array.from({ length: 6 }, (_, j) =>
            view.getFloat64(output + 48 + i * 48 + j * 8, true)
          );
          if (r.some((v) => !Number.isFinite(v)) || ![0, 1].includes(r[4]!))
            throw new GeometryKernelError(
              'internal',
              'The clipping kernel returned invalid source contacts.'
            );
          hits.push({ t1: r[0]!, t2: r[1]!, x: r[2]!, y: r[3]!, ...(r[4] ? { dir: r[5]! } : {}) });
        }
        return {
          hits,
          counts: {
            reached: !!header[0],
            nodes: header[1]!,
            overrun: !!header[2],
            searched: !!header[3],
            overrunNodes: header[4]!,
            ceiling: !!header[5],
          },
        };
      } finally {
        api.geom_clip_free(handle);
      }
    } catch (error) {
      release();
      throw error;
    }
  }
  return { intersect, dispose };
}
