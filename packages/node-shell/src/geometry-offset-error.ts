// SPDX-License-Identifier: MPL-2.0
/** Owned synchronous workspace for complete independent offset verification. */
import { boundsCubic, type Cubic } from '../../../engine/src/geom/bezier.ts';
import { type GeometryExports, GeometryKernelError } from './geometry-kernel-contract.ts';

export const GEOMETRY_MAX_OFFSET_FIT_CURVES = 32;
function invalid(message: string): never {
  throw new GeometryKernelError('invalid-argument', message);
}
function coordinate(value: number): void {
  if (!Number.isFinite(value) || Math.abs(value) > 1e9)
    invalid('Offset verification values must be finite and within the supported range.');
}
function curve(c: Cubic): void {
  if (c.length !== 8) invalid('Offset verification requires eight cubic coordinates.');
  for (const value of c) coordinate(value);
}

export function createOffsetErrorWorkspace(api: GeometryExports) {
  let query = 0,
    fitted = 0,
    output = 0,
    capacity = 0,
    disposed = false;
  function release(): void {
    for (const pointer of [query, fitted, output]) api.geom_free(pointer);
    query = 0;
    fitted = 0;
    output = 0;
    capacity = 0;
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    release();
  }
  function verify(src: Cubic, approx: Cubic[], distance: number, tol: number) {
    if (disposed) invalid('This offset verification workspace has been disposed.');
    if (!approx.length || approx.length > GEOMETRY_MAX_OFFSET_FIT_CURVES)
      throw new GeometryKernelError('limit', 'The offset fit is outside its curve limit.');
    curve(src);
    coordinate(distance);
    coordinate(tol);
    if (tol <= 0) invalid('Offset verification requires a positive tolerance.');
    for (const c of approx) curve(c);
    const boxes = approx.map(boundsCubic);
    for (const b of boxes) for (const v of [b.x0, b.y0, b.x1, b.y1]) coordinate(v);
    if (capacity !== approx.length) {
      release();
      query = api.geom_alloc(80);
      fitted = api.geom_alloc(approx.length * 96);
      output = api.geom_alloc(16);
      if (!query || !fitted || !output) {
        release();
        throw new GeometryKernelError(
          'limit',
          'The geometry kernel refused the offset verification buffers.'
        );
      }
      capacity = approx.length;
    }
    const view = new DataView(api.memory.buffer);
    [...src, distance, tol].forEach((value, i) => {
      view.setFloat64(query + i * 8, value, true);
    });
    approx.forEach((c, i) => {
      const b = boxes[i]!;
      [...c, b.x0, b.y0, b.x1, b.y1].forEach((value, j) => {
        view.setFloat64(fitted + i * 96 + j * 8, value, true);
      });
    });
    const status = api.geom_offset_error(query, fitted, output);
    if (status !== 0)
      throw new GeometryKernelError(
        status === 3 ? 'limit' : status === 2 ? 'invalid-argument' : 'internal',
        `The geometry kernel refused offset verification (${status}).`
      );
    const result = new DataView(api.memory.buffer);
    const error = result.getFloat64(output, true),
      t = result.getFloat64(output + 8, true);
    if (!Number.isFinite(error) || error < 0 || !Number.isFinite(t) || t < 0 || t > 1)
      throw new GeometryKernelError(
        'internal',
        'The geometry kernel returned an invalid offset verification result.'
      );
    return { error, t };
  }
  return { verify, dispose };
}
