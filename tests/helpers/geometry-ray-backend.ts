// SPDX-License-Identifier: MPL-2.0
/** Comparison-only ownership wrapper: at most eight immutable ray indexes per operation. */
import type { createGeometryKernel } from '../../packages/node-shell/src/geometry-kernel.ts';
import type { castRay, CurveIndex } from '../../engine/src/geom/ray-cast.ts';

export function createRayBackend(kernel: Awaited<ReturnType<typeof createGeometryKernel>>) {
  const paths = new Map<
    CurveIndex,
    { path: ReturnType<typeof kernel.prepareRayIndex>; curves: number }
  >();
  let preparations = 0,
    calls = 0,
    evictions = 0,
    residentCurves = 0;
  const cast: typeof castRay = (
    index,
    px,
    py,
    ux,
    uy,
    ref,
    near,
    budget,
    complete = false,
    bundle = null
  ) => {
    calls++;
    if (!index.curves.length) return { far: 0, net: 0, ok: true };
    let entry = paths.get(index);
    if (entry) paths.delete(index);
    else {
      while (paths.size && (paths.size >= 8 || residentCurves + index.curves.length > 32000)) {
        const oldest = paths.keys().next().value!;
        const previous = paths.get(oldest)!;
        previous.path.dispose();
        residentCurves -= previous.curves;
        paths.delete(oldest);
        evictions++;
      }
      entry = { path: kernel.prepareRayIndex(index), curves: index.curves.length };
      residentCurves += entry.curves;
      preparations++;
    }
    paths.set(index, entry);
    return entry.path.cast(px, py, ux, uy, ref, near, budget, complete, bundle);
  };
  return {
    cast,
    stats: () => ({ preparations, calls, evictions }),
    dispose: () => {
      for (const entry of paths.values()) entry.path.dispose();
      paths.clear();
      residentCurves = 0;
    },
  };
}
