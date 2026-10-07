// SPDX-License-Identifier: MPL-2.0
/** The shell loads fitting bytes; each realm receives the same immutable source requests. */

import { CLIP_COUNTS } from '../../engine/src/geom/intersect.ts';
import {
  createGeometryFitting,
  type GeometryFittingMath,
} from '../../packages/node-shell/src/geometry-fitting.ts';
import { createOffsetFitBackend } from './geometry-offset-fit-backend.ts';
import type { OffsetFitCase } from './geometry-offset-fit-cases.ts';
import { getOffsetFitReference, setOffsetFitProbe } from './geometry-offset-fit-control.ts';
import { geometryStageWorkflows } from './geometry-stage-workflows.ts';
export async function probeOffsetFitting(
  inputs: OffsetFitCase[],
  mathBackend: GeometryFittingMath = 'host'
) {
  const bytes = new Uint8Array(
    await (
      await fetch(mathBackend === 'portable' ? '/geometry-fit-portable.wasm' : mathBackend === 'host-norm' ? '/geometry-fit-host-norm.wasm' : '/geometry-fit.wasm')
    ).arrayBuffer()
  );
  const kernel = await createGeometryFitting(bytes, mathBackend);
  const workspace = kernel.createOffsetFitWorkspace();
  const reference = getOffsetFitReference();
  let cases: {
    name: string;
    reference: ReturnType<typeof reference>;
    actual: ReturnType<typeof reference>;
  }[];
  try {
    cases = inputs.map((row) => ({
      name: row.name,
      reference: reference(row.src, row.distance, row.tol),
      actual: workspace.fit(row.src, row.distance, row.tol),
    }));
  } finally {
    workspace.dispose();
  }
  const counters = () => ({
    pairs: CLIP_COUNTS.pairs,
    nodes: CLIP_COUNTS.nodes,
    overruns: CLIP_COUNTS.overruns,
    overrunNodes: CLIP_COUNTS.overrunNodes,
    ceilings: CLIP_COUNTS.ceilings,
  });
  const delta = (before: ReturnType<typeof counters>) =>
    Object.fromEntries(
      Object.entries(counters()).map(([key, value]) => [
        key,
        value - before[key as keyof typeof before],
      ])
    );
  const workflows = geometryStageWorkflows().map((row) => {
    setOffsetFitProbe(undefined);
    const before = counters(),
      reference = row.run(),
      referenceCounts = delta(before);
    const referenceLast = CLIP_COUNTS.lastNodes;
    const backend = createOffsetFitBackend(kernel),
      start = counters();
    try {
      setOffsetFitProbe(backend.fit);
      const actual = row.run();
      return {
        name: row.id,
        reference,
        actual,
        referenceCounts,
        actualCounts: delta(start),
        referenceLast,
        actualLast: CLIP_COUNTS.lastNodes,
        backend: backend.stats(),
      };
    } finally {
      setOffsetFitProbe(undefined);
      backend.dispose();
    }
  });
  return { cases, workflows, afterDispose: kernel.stats() };
}
