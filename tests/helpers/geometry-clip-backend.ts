// SPDX-License-Identifier: MPL-2.0
/** Complete pair ownership and exact cumulative counter updates for qualification bundles. */
import type { createGeometryClipping } from '../../packages/node-shell/src/geometry-clipping.ts';
import type { ClipProbe } from './geometry-clip-control.ts';
export function createClipBackend(kernel: Awaited<ReturnType<typeof createGeometryClipping>>) {
  let workspace: ReturnType<typeof kernel.createClipWorkspace> | undefined;
  let calls = 0,
    returnedHits = 0;
  const intersect: ClipProbe = (a, b, tol, limits, counts) => {
    workspace ??= kernel.createClipWorkspace();
    calls++;
    const result = workspace.intersect(a, b, tol, limits),
      c = result.counts;
    if (c.reached) {
      counts.pairs++;
      counts.nodes += c.nodes;
      counts.lastNodes = c.nodes;
    }
    if (c.overrun) counts.overruns++;
    if (c.searched) {
      counts.overrunNodes += c.overrunNodes;
      counts.lastOverrunNodes = c.overrunNodes;
      counts.maxOverrunNodes = Math.max(counts.maxOverrunNodes, c.overrunNodes);
    }
    if (c.ceiling) counts.ceilings++;
    returnedHits += result.hits.length;
    return result.hits;
  };
  return {
    intersect,
    stats: () => ({ calls, returnedHits }),
    dispose: () => {
      workspace?.dispose();
      workspace = undefined;
    },
  };
}
