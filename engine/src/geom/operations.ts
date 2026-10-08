// SPDX-License-Identifier: MPL-2.0
/** Numerical dependencies belong to one caller-owned geometry operation. */
import type { Cubic, Pt } from './bezier.ts';
import { CLIP_BUDGET, CLIP_COUNTS, EPS, intersectCubics, OVERRUN_BUDGET, SCAN_LIMITS, type Intersection } from './intersect.ts';

export interface GeometryClipLimits { initial: number; overrun: number; stalled: number }
export interface GeometryClipCounts {
  reached: boolean; nodes: number; overrun: boolean; searched: boolean;
  overrunNodes: number; ceiling: boolean;
}
export interface GeometryClipResult { hits: Intersection[]; counts: GeometryClipCounts }
export interface GeometryOffsetPiece { curve: Cubic; dirStart: Pt | null; dirEnd: Pt | null }
export interface GeometryOperations {
  clipping?(a: Cubic, b: Cubic, tolerance: number, limits: GeometryClipLimits): GeometryClipResult;
  fitting?(curve: Cubic, distance: number, tolerance: number): GeometryOffsetPiece[];
}
export class GeometryOperationError extends Error {
  readonly code: 'limit' | 'invalid-argument' | 'internal';
  constructor(code: GeometryOperationError['code'], message: string) {
    super(message); this.name = 'GeometryOperationError'; this.code = code;
  }
}

/** Update diagnostic counters only after a selected kernel returns a complete result. */
export function intersectWithOperations(a: Cubic, b: Cubic, tolerance = EPS, operations?: GeometryOperations): Intersection[] {
  if (!operations?.clipping) return intersectCubics(a, b, tolerance);
  const result = operations.clipping(a, b, tolerance, {
    initial: CLIP_BUDGET.maxNodes, overrun: OVERRUN_BUDGET.maxNodes, stalled: SCAN_LIMITS.maxStalledPairs,
  });
  const counts = result.counts;
  if (counts.reached) {
    CLIP_COUNTS.pairs++; CLIP_COUNTS.nodes += counts.nodes; CLIP_COUNTS.lastNodes = counts.nodes;
  }
  if (counts.overrun) CLIP_COUNTS.overruns++;
  if (counts.searched) {
    CLIP_COUNTS.overrunNodes += counts.overrunNodes; CLIP_COUNTS.lastOverrunNodes = counts.overrunNodes;
    CLIP_COUNTS.maxOverrunNodes = Math.max(CLIP_COUNTS.maxOverrunNodes, counts.overrunNodes);
  }
  if (counts.ceiling) CLIP_COUNTS.ceilings++;
  return result.hits;
}
