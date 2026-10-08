// SPDX-License-Identifier: MPL-2.0
/** Shell-loaded geometry pilot. Instantiation is async; prepared path queries are synchronous. */
import type { Cubic } from '../../../engine/src/geom/bezier.ts';

import {
  GEOMETRY_MAX_CURVES,
  GEOMETRY_MAX_QUERIES,
  GEOMETRY_MAX_WORK,
  GEOMETRY_MAX_NEAR_CURVES,
  GEOMETRY_MAX_NEAR_PAIRS,
  GEOMETRY_MAX_POLYNOMIALS,
  GEOMETRY_MAX_COEFFICIENT,
  GeometryKernelError,
  type GeometryExports,
} from './geometry-kernel-contract.ts';
export {
  GEOMETRY_MAX_CURVES,
  GEOMETRY_MAX_QUERIES,
  GEOMETRY_MAX_WORK,
  GEOMETRY_MAX_NEAR_CURVES,
  GEOMETRY_MAX_NEAR_PAIRS,
  GEOMETRY_MAX_POLYNOMIALS,
  GEOMETRY_MAX_COEFFICIENT,
  GeometryKernelError,
} from './geometry-kernel-contract.ts';
import { prepareRayIndex } from './geometry-ray.ts';
import { createOffsetErrorWorkspace } from './geometry-offset-error.ts';
import type { CurveIndex } from '../../../engine/src/geom/ray-cast.ts';
const MAX_COORDINATE = 1e9;
const ROOT_RECORD_BYTES = 72;

function isGeometryKernel(exports: WebAssembly.Exports): exports is GeometryExports {
  return (
    exports.memory instanceof WebAssembly.Memory &&
    [
      'geom_alloc',
      'geom_free',
      'geom_path_create',
      'geom_ray_path_create',
      'geom_ray_cast',
      'geom_path_free',
      'geom_nearest_batch',
      'geom_near_pairs',
      'geom_cubic_roots_batch',
      'geom_offset_error',
      'geom_buffer_bytes',
      'geom_path_count',
      'geom_curve_count',
    ].every((key) => typeof exports[key] === 'function')
  );
}

export interface GeometryNearest {
  curve: number;
  t: number;
  point: { x: number; y: number };
  distance: number;
}

export type GeometryPolynomial = readonly [number, number, number, number];
export interface GeometryRoots {
  roots: number[];
  directions: number[];
}

function coordinate(value: number): void {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_COORDINATE)
    throw new GeometryKernelError(
      'invalid-argument',
      'Geometry coordinates must be finite and within the supported range.'
    );
}

/** Each path owns an immutable control snapshot; dispose releases its opaque handle and query buffers. */
export async function createGeometryKernel(bytes: Uint8Array<ArrayBuffer>) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  if (!isGeometryKernel(instance.exports))
    throw new GeometryKernelError('internal', 'The geometry kernel ABI is incompatible.');
  const api = instance.exports;

  /** Reuses owned batch buffers. Results are copied into JavaScript before the next call. */
  function createRootWorkspace() {
    let input = 0,
      output = 0,
      capacity = 0,
      disposed = false;
    function dispose(): void {
      if (disposed) return;
      disposed = true;
      api.geom_free(input);
      api.geom_free(output);
    }
    function solve(polynomials: readonly GeometryPolynomial[]): GeometryRoots[] {
      if (disposed)
        throw new GeometryKernelError('invalid-argument', 'This root workspace has been disposed.');
      if (!polynomials.length) return [];
      if (polynomials.length > GEOMETRY_MAX_POLYNOMIALS)
        throw new GeometryKernelError('limit', 'The polynomial batch exceeds its work limit.');
      for (const polynomial of polynomials) {
        if (polynomial.length !== 4)
          throw new GeometryKernelError('invalid-argument', 'A cubic requires four coefficients.');
        for (const coefficient of polynomial)
          if (!Number.isFinite(coefficient) || Math.abs(coefficient) > GEOMETRY_MAX_COEFFICIENT)
            throw new GeometryKernelError(
              'invalid-argument',
              'Polynomial coefficients must be finite and within the supported range.'
            );
      }
      if (capacity !== polynomials.length) {
        api.geom_free(input);
        api.geom_free(output);
        input = 0;
        output = 0;
        capacity = 0;
        input = api.geom_alloc(polynomials.length * 32);
        output = api.geom_alloc(polynomials.length * ROOT_RECORD_BYTES);
        if (!input || !output) {
          api.geom_free(input);
          api.geom_free(output);
          input = 0;
          output = 0;
          throw new GeometryKernelError('limit', 'The geometry kernel refused the root buffers.');
        }
        capacity = polynomials.length;
      }
      const source = new DataView(api.memory.buffer);
      polynomials.forEach((polynomial, i) => {
        for (let j = 0; j < 4; j++) source.setFloat64(input + i * 32 + j * 8, polynomial[j]!, true);
      });
      const status = api.geom_cubic_roots_batch(input, output);
      if (status !== 0)
        throw new GeometryKernelError(
          status === 3 ? 'limit' : status === 2 ? 'invalid-argument' : 'internal',
          `The geometry kernel refused the polynomial batch (${status}).`
        );
      const result = new DataView(api.memory.buffer);
      return polynomials.map((_, i) => {
        const offset = output + i * ROOT_RECORD_BYTES;
        const count = result.getFloat64(offset, true);
        if (!Number.isInteger(count) || count < 0 || count > 4)
          throw new GeometryKernelError(
            'internal',
            'The geometry kernel returned an invalid count.'
          );
        const roots: number[] = [],
          directions: number[] = [];
        for (let j = 0; j < count; j++) {
          roots.push(result.getFloat64(offset + 8 + j * 16, true));
          directions.push(result.getFloat64(offset + 16 + j * 16, true));
        }
        return { roots, directions };
      });
    }
    return { solve, dispose };
  }

  function prepare(curves: readonly Cubic[]) {
    if (!curves.length || curves.length > GEOMETRY_MAX_CURVES)
      throw new GeometryKernelError('limit', 'The geometry path is outside the curve limit.');
    for (const curve of curves) {
      if (curve.length !== 8)
        throw new GeometryKernelError(
          'invalid-argument',
          'Geometry curves require eight control coordinates.'
        );
      for (const value of curve) coordinate(value);
    }
    const curveCount = curves.length;
    let handle = 0,
      queries = 0,
      output = 0,
      capacity = 0;
    let disposed = false,
      pairOutput = 0,
      pairCapacity = 0;
    const source = api.geom_alloc(curves.length * 64);
    try {
      if (!source)
        throw new GeometryKernelError('limit', 'The geometry kernel refused the path allocation.');
      const view = new DataView(api.memory.buffer);
      for (const [index, curve] of curves.entries())
        for (let i = 0; i < 8; i++) view.setFloat64(source + index * 64 + i * 8, curve[i]!, true);
      handle = api.geom_path_create(source);
      if (handle < 1)
        throw new GeometryKernelError(
          handle === -2 ? 'limit' : 'invalid-argument',
          'The geometry kernel refused the path snapshot.'
        );
    } finally {
      api.geom_free(source);
    }

    function dispose(): void {
      if (disposed) return;
      disposed = true;
      api.geom_path_free(handle);
      api.geom_free(queries);
      api.geom_free(output);
      api.geom_free(pairOutput);
    }

    function nearestBatch(points: readonly (readonly [number, number])[]): GeometryNearest[] {
      if (disposed)
        throw new GeometryKernelError('invalid-argument', 'This geometry path has been disposed.');
      if (!points.length) return [];
      if (points.length > GEOMETRY_MAX_QUERIES || points.length * curveCount > GEOMETRY_MAX_WORK)
        throw new GeometryKernelError('limit', 'The geometry query batch exceeds its work budget.');
      for (const point of points) {
        if (point.length !== 2)
          throw new GeometryKernelError(
            'invalid-argument',
            'Geometry queries require coordinate pairs.'
          );
        coordinate(point[0]);
        coordinate(point[1]);
      }
      if (points.length !== capacity) {
        api.geom_free(queries);
        api.geom_free(output);
        queries = 0;
        output = 0;
        capacity = 0;
        queries = api.geom_alloc(points.length * 16);
        output = api.geom_alloc(points.length * 40);
        if (!queries || !output) {
          api.geom_free(queries);
          api.geom_free(output);
          queries = 0;
          output = 0;
          throw new GeometryKernelError(
            'limit',
            'The geometry kernel refused the query allocation.'
          );
        }
        capacity = points.length;
      }
      const view = new DataView(api.memory.buffer);
      points.forEach(([x, y], index) => {
        view.setFloat64(queries + index * 16, x, true);
        view.setFloat64(queries + index * 16 + 8, y, true);
      });
      const status = api.geom_nearest_batch(handle, queries, output);
      if (status !== 0)
        throw new GeometryKernelError(
          status === 3 ? 'limit' : status === 2 ? 'invalid-argument' : 'internal',
          `The geometry kernel refused the query (${status}).`
        );
      // Recreate the view after the call: WASM growth can detach an earlier buffer.
      const result = new DataView(api.memory.buffer);
      return points.map((_, index) => {
        const offset = output + index * 40;
        return {
          curve: result.getFloat64(offset, true),
          t: result.getFloat64(offset + 8, true),
          point: {
            x: result.getFloat64(offset + 16, true),
            y: result.getFloat64(offset + 24, true),
          },
          distance: result.getFloat64(offset + 32, true),
        };
      });
    }
    function nearPairs(weld: number, maxPairs = GEOMETRY_MAX_NEAR_PAIRS): [number, number][] {
      if (disposed)
        throw new GeometryKernelError('invalid-argument', 'This geometry path has been disposed.');
      if (!Number.isFinite(weld) || weld <= 0 || weld > MAX_COORDINATE)
        throw new GeometryKernelError(
          'invalid-argument',
          'The geometry weld radius must be finite and positive.'
        );
      if (
        curveCount > GEOMETRY_MAX_NEAR_CURVES ||
        !Number.isInteger(maxPairs) ||
        maxPairs < 1 ||
        maxPairs > GEOMETRY_MAX_NEAR_PAIRS
      )
        throw new GeometryKernelError(
          'limit',
          'The geometry proximity pass exceeds its admission limits.'
        );
      if (pairCapacity !== maxPairs) {
        api.geom_free(pairOutput);
        pairOutput = 0;
        pairCapacity = 0;
        pairOutput = api.geom_alloc(maxPairs * 8);
        if (!pairOutput)
          throw new GeometryKernelError(
            'limit',
            'The geometry kernel refused the pair allocation.'
          );
        pairCapacity = maxPairs;
      }
      const count = api.geom_near_pairs(handle, weld, pairOutput);
      if (count < 0)
        throw new GeometryKernelError(
          count === -3 ? 'limit' : count === -2 ? 'invalid-argument' : 'internal',
          `The geometry kernel refused the proximity pass (${count}).`
        );
      const result = new DataView(api.memory.buffer);
      return Array.from({ length: count }, (_, i): [number, number] => [
        result.getUint32(pairOutput + i * 8, true),
        result.getUint32(pairOutput + i * 8 + 4, true),
      ]);
    }
    return {
      nearest: (x: number, y: number): GeometryNearest => nearestBatch([[x, y]])[0]!,
      nearestBatch,
      nearPairs,
      dispose,
    };
  }
  return {
    prepare,
    createRootWorkspace,
    createOffsetErrorWorkspace: () => createOffsetErrorWorkspace(api),
    prepareRayIndex: (index: CurveIndex) => prepareRayIndex(api, index),
    stats: () => ({
      paths: api.geom_path_count(),
      curves: api.geom_curve_count(),
      bufferBytes: api.geom_buffer_bytes(),
      linearBytes: api.memory.buffer.byteLength,
    }),
  };
}
