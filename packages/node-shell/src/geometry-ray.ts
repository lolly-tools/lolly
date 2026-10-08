// SPDX-License-Identifier: MPL-2.0
/** Owned indexed ray casts; each call returns the original winding and work prefix. */
import type { Bundle, CurveIndex, Cast } from '../../../engine/src/geom/ray-cast.ts';
import {
  GEOMETRY_MAX_CURVES,
  GeometryKernelError,
  type GeometryExports,
} from './geometry-kernel-contract.ts';

export const GEOMETRY_MAX_BUNDLE_RANGES = 4096;
function invalid(message: string): never {
  throw new GeometryKernelError('invalid-argument', message);
}
function bounded(value: number, limit = 1e9): void {
  if (!Number.isFinite(value) || Math.abs(value) > limit)
    invalid('The ray value is outside its finite range.');
}

export function prepareRayIndex(api: GeometryExports, index: CurveIndex) {
  const count = index.curves.length;
  if (!count || count > GEOMETRY_MAX_CURVES)
    throw new GeometryKernelError('limit', 'The ray index is outside the curve limit.');
  const { box } = index;
  if (!box) invalid('A ray index requires its aggregate box.');
  for (const value of [box.x0, box.y0, box.x1, box.y1]) bounded(value);
  if (box.x0 > box.x1 || box.y0 > box.y1) invalid('The ray box has reversed bounds.');
  const snapshot = { ...box };
  for (const row of index.curves) {
    if (row.c.length !== 8) invalid('A ray curve requires eight control coordinates.');
    for (const value of [...row.c, row.box.x0, row.box.y0, row.box.x1, row.box.y1]) bounded(value);
    if (row.box.x0 > row.box.x1 || row.box.y0 > row.box.y1)
      invalid('A curve box has reversed bounds.');
    if (row.box.x0 < box.x0 || row.box.x1 > box.x1 || row.box.y0 < box.y0 || row.box.y1 > box.y1)
      invalid('The aggregate ray box must contain every curve box.');
  }
  let handle = 0,
    query = 0,
    output = 0,
    ranges = 0,
    rangeCapacity = 0,
    disposed = false;
  const source = api.geom_alloc(count * 96);
  try {
    if (!source)
      throw new GeometryKernelError('limit', 'The geometry kernel refused the ray index buffer.');
    const view = new DataView(api.memory.buffer);
    index.curves.forEach(({ c, box }, i) => {
      [...c, box.x0, box.y0, box.x1, box.y1].forEach((value, j) => {
        view.setFloat64(source + i * 96 + j * 8, value, true);
      });
    });
    handle = api.geom_ray_path_create(source);
    if (handle < 1)
      throw new GeometryKernelError(
        handle === -2 ? 'limit' : 'invalid-argument',
        'The geometry kernel refused the ray index.'
      );
  } finally {
    api.geom_free(source);
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    api.geom_path_free(handle);
    for (const pointer of [query, output, ranges]) api.geom_free(pointer);
  }
  function cast(
    px: number,
    py: number,
    ux: number,
    uy: number,
    ref: { x: number; y: number } | null,
    near: number,
    budget: { work: number },
    complete = false,
    bundle: Bundle | null = null
  ): Cast {
    if (disposed) invalid('This ray index has been disposed.');
    for (const value of [px, py, near]) bounded(value);
    if (
      near <= 0 ||
      !Number.isFinite(ux) ||
      !Number.isFinite(uy) ||
      Math.abs(ux) > 1 ||
      Math.abs(uy) > 1 ||
      ux * ux + uy * uy < 0.99 ||
      ux * ux + uy * uy > 1.01
    )
      invalid('A ray requires a positive radius and a unit direction.');
    if (
      !Number.isInteger(budget.work) ||
      Math.abs(budget.work) > 200_000_000 ||
      typeof complete !== 'boolean'
    )
      invalid('The ray work budget or completion flag is invalid.');
    if (ref) {
      bounded(ref.x, 1e12);
      bounded(ref.y, 1e12);
    }
    const records: [number, number, number][] = [];
    if (bundle)
      for (const [ci, intervals] of bundle) {
        if (!Number.isInteger(ci) || ci < 0 || ci >= count)
          invalid('A ray bundle names an unknown curve.');
        for (const interval of intervals) {
          if (
            interval.length !== 2 ||
            !Number.isFinite(interval[0]) ||
            !Number.isFinite(interval[1]) ||
            interval[0] < 0 ||
            interval[1] > 1 ||
            interval[0] > interval[1]
          )
            invalid('A ray bundle requires ordered unit parameter ranges.');
          if (records.length >= GEOMETRY_MAX_BUNDLE_RANGES)
            throw new GeometryKernelError('limit', 'The ray bundle exceeds its range limit.');
          records.push([ci, interval[0], interval[1]]);
        }
      }
    const diag = Math.hypot(snapshot.x1 - snapshot.x0, snapshot.y1 - snapshot.y0);
    const dx = Math.max(snapshot.x0 - px, px - snapshot.x1, 0),
      dy = Math.max(snapshot.y0 - py, py - snapshot.y1, 0);
    const reach = 2 * (diag + Math.hypot(dx, dy)) + 1;
    const x0 = px - ux * reach,
      y0 = py - uy * reach,
      x1 = px + ux * reach,
      y1 = py + uy * reach;
    const length = Math.hypot(x1 - x0, y1 - y0);
    if (!query || !output) {
      api.geom_free(query);
      api.geom_free(output);
      query = api.geom_alloc(96);
      output = api.geom_alloc(32);
      if (!query || !output) {
        api.geom_free(query);
        api.geom_free(output);
        query = 0;
        output = 0;
        throw new GeometryKernelError(
          'limit',
          'The geometry kernel refused the ray query buffers.'
        );
      }
    }
    if (records.length !== rangeCapacity) {
      api.geom_free(ranges);
      ranges = 0;
      rangeCapacity = 0;
      if (records.length) {
        ranges = api.geom_alloc(records.length * 24);
        if (!ranges)
          throw new GeometryKernelError(
            'limit',
            'The geometry kernel refused the ray bundle buffer.'
          );
        rangeCapacity = records.length;
      }
    }
    const view = new DataView(api.memory.buffer);
    [
      px,
      py,
      ux,
      uy,
      near,
      reach,
      length,
      ref?.x ?? 0,
      ref?.y ?? 0,
      ref ? 1 : 0,
      complete ? 1 : 0,
      budget.work,
    ].forEach((value, i) => {
      view.setFloat64(query + i * 8, value, true);
    });
    records.forEach((record, i) => {
      record.forEach((value, j) => {
        view.setFloat64(ranges + i * 24 + j * 8, value, true);
      });
    });
    const status = api.geom_ray_cast(handle, query, ranges, output);
    if (status !== 0)
      throw new GeometryKernelError(
        status === 3 ? 'limit' : status === 2 ? 'invalid-argument' : 'internal',
        `The geometry kernel refused the ray cast (${status}).`
      );
    const result = new DataView(api.memory.buffer);
    const far = result.getFloat64(output, true),
      net = result.getFloat64(output + 8, true),
      ok = result.getFloat64(output + 16, true),
      work = result.getFloat64(output + 24, true);
    if (
      !Number.isInteger(far) ||
      !Number.isInteger(net) ||
      (ok !== 0 && ok !== 1) ||
      !Number.isInteger(work)
    )
      throw new GeometryKernelError(
        'internal',
        'The geometry kernel returned an invalid ray result.'
      );
    budget.work = work;
    return { far, net, ok: ok === 1 };
  }
  return { cast, dispose };
}
