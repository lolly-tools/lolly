// SPDX-License-Identifier: MPL-2.0
/** Complete workflows use the actual engine dependency boundary in each host. */
import { CLIP_COUNTS } from '../../engine/src/geom/intersect.ts';
import { createGeometryOperationScope } from '../../packages/node-shell/src/geometry-operation-scope.ts';
import { geometryStageWorkflows } from './geometry-stage-workflows.ts';

export function qualifyGeometryOperations(modules: Parameters<typeof createGeometryOperationScope>[0]) {
  const zero = Object.fromEntries(Object.keys(CLIP_COUNTS).map(key => [key, 0]));
  const workflows = geometryStageWorkflows().map(row => {
    const run = (selected: Parameters<typeof createGeometryOperationScope>[0]) => {
      const owner = createGeometryOperationScope(selected);
      Object.assign(CLIP_COUNTS, zero);
      try { return { result: row.run(owner.operations), counts: { ...CLIP_COUNTS }, owner: owner.stats() }; }
      finally { owner.dispose(); }
    };
    return { id: row.id, reference: run({}), clipping: run({ clipping: modules.clipping }), combined: run(modules) };
  });
  return { workflows, clipping: modules.clipping?.stats(), fitting: modules.fitting?.stats() };
}
