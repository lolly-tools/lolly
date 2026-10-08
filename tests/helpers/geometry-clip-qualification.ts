// SPDX-License-Identifier: MPL-2.0
/** Identical controls and counter state qualify complete pair searches and complete workflows. */
import {
  CLIP_BUDGET,
  CLIP_COUNTS,
  OVERRUN_BUDGET,
  SCAN_LIMITS,
  intersectCubics,
  type Intersection,
} from '../../engine/src/geom/intersect.ts';
import type { createGeometryClipping } from '../../packages/node-shell/src/geometry-clipping.ts';
import { createClipBackend } from './geometry-clip-backend.ts';
import { clipUnwire, type ClipWireCase } from './geometry-clip-cases.ts';
import { setClipProbe } from './geometry-clip-control.ts';
import { floatBits } from './geometry-portable-math-cases.ts';
import { geometryStageWorkflows } from './geometry-stage-workflows.ts';
export function hitBits(hits: Intersection[]) {
  return hits.map((h) =>
    [h.t1, h.t2, h.x, h.y].map(floatBits).concat(h.dir === undefined ? [] : [floatBits(h.dir)])
  );
}
export function qualifyClipping(
  kernel: Awaited<ReturnType<typeof createGeometryClipping>>,
  inputs: ClipWireCase[]
) {
  const saved = { ...CLIP_COUNTS },
    savedLimits = [CLIP_BUDGET.maxNodes, OVERRUN_BUDGET.maxNodes, SCAN_LIMITS.maxStalledPairs];
  const initial = {
    pairs: 17,
    nodes: 23,
    overruns: 3,
    overrunNodes: 43,
    lastNodes: 11,
    lastOverrunNodes: 19,
    maxOverrunNodes: 31,
    ceilings: 2,
  };
  try {
    const cases = inputs.map((wire) => {
      const row = clipUnwire(wire),
        backend = createClipBackend(kernel);
      CLIP_BUDGET.maxNodes = row.limits.initial;
      OVERRUN_BUDGET.maxNodes = row.limits.overrun;
      SCAN_LIMITS.maxStalledPairs = row.limits.stalled;
      setClipProbe(undefined);
      Object.assign(CLIP_COUNTS, initial);
      const reference = hitBits(intersectCubics(row.a, row.b, row.tol)),
        referenceCounts = { ...CLIP_COUNTS };
      Object.assign(CLIP_COUNTS, initial);
      setClipProbe(backend.intersect);
      try {
        const actual = hitBits(intersectCubics(row.a, row.b, row.tol));
        return {
          name: row.name,
          reference,
          actual,
          referenceCounts,
          actualCounts: { ...CLIP_COUNTS },
        };
      } finally {
        setClipProbe(undefined);
        backend.dispose();
      }
    });
    [CLIP_BUDGET.maxNodes, OVERRUN_BUDGET.maxNodes, SCAN_LIMITS.maxStalledPairs] = savedLimits as [
      number,
      number,
      number,
    ];
    const workflows = geometryStageWorkflows().map((row) => {
      setClipProbe(undefined);
      Object.assign(CLIP_COUNTS, initial);
      const reference = row.run(),
        referenceCounts = { ...CLIP_COUNTS },
        backend = createClipBackend(kernel);
      Object.assign(CLIP_COUNTS, initial);
      setClipProbe(backend.intersect);
      try {
        const actual = row.run();
        return {
          name: row.id,
          reference,
          actual,
          referenceCounts,
          actualCounts: { ...CLIP_COUNTS },
          backend: backend.stats(),
        };
      } finally {
        setClipProbe(undefined);
        backend.dispose();
      }
    });
    return { cases, workflows, afterDispose: kernel.stats() };
  } finally {
    setClipProbe(undefined);
    Object.assign(CLIP_COUNTS, saved);
    [CLIP_BUDGET.maxNodes, OVERRUN_BUDGET.maxNodes, SCAN_LIMITS.maxStalledPairs] = savedLimits as [
      number,
      number,
      number,
    ];
  }
}
