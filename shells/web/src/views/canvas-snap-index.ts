// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
// Copyright (c) KALEIDOS SUBSIDIARY SL
// Adapted from Penpot's axis buckets and bounded snap queries. Source receipts
// and the sorted-array adaptation are in design-canvas-ux.penpot/PROVENANCE.md.

interface SnapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface SnapCanvas {
  w: number;
  h: number;
}
type Axis = 'x' | 'y';

/** Maximum prepared targets per axis, including the three artboard targets. */
export const MAX_SNAP_INDEX_TARGETS = 65_536;

interface AxisTarget {
  value: number;
  ordinal: number;
  min: number;
  max: number;
  object: boolean;
}

interface AxisIndex {
  targets: AxisTarget[];
  tree: Uint32Array;
  leafCount: number;
}

/** A gesture snapshot. The source array and its bounds must remain unchanged. */
export interface CanvasSnapIndex {
  readonly source: readonly SnapBounds[];
  readonly sourceLength: number;
  readonly w: number;
  readonly h: number;
  readonly x: AxisIndex;
  readonly y: AxisIndex;
}

export interface IndexedSnapPick {
  d: number;
  line: number;
  min: number;
  max: number;
  object: boolean;
}

const EMPTY = 0xffff_ffff;

function earlier(index: AxisIndex, a: number, b: number): number {
  if (a === EMPTY) return b;
  if (b === EMPTY) return a;
  return index.targets[a]!.ordinal < index.targets[b]!.ordinal ? a : b;
}

function prepareAxis(targets: AxisTarget[]): AxisIndex {
  targets.sort((a, b) => a.value - b.value || a.ordinal - b.ordinal);
  let leafCount = 1;
  while (leafCount < targets.length) leafCount *= 2;
  const tree = new Uint32Array(leafCount * 2).fill(EMPTY);
  const index = { targets, tree, leafCount };
  for (let i = 0; i < targets.length; i++) tree[leafCount + i] = i;
  for (let i = leafCount - 1; i > 0; i--) tree[i] = earlier(index, tree[i * 2]!, tree[i * 2 + 1]!);
  return index;
}

/** Prepare independent axis buckets once, using artboard then object order. */
export function createCanvasSnapIndex(
  others: readonly SnapBounds[],
  canvas: SnapCanvas
): CanvasSnapIndex | null {
  if (
    others.length > Math.floor((MAX_SNAP_INDEX_TARGETS - 3) / 3) ||
    !Number.isFinite(canvas.w) ||
    !Number.isFinite(canvas.h)
  )
    return null;
  const x: AxisTarget[] = [];
  const y: AxisTarget[] = [];
  function append(
    axis: AxisTarget[],
    value: number,
    min: number,
    max: number,
    object: boolean
  ): void {
    axis.push({ value, ordinal: axis.length, min, max, object });
  }
  for (const value of [0, canvas.w / 2, canvas.w]) append(x, value, 0, canvas.h, false);
  for (const value of [0, canvas.h / 2, canvas.h]) append(y, value, 0, canvas.w, false);
  for (const other of others) {
    const cx = (other.minX + other.maxX) / 2;
    const cy = (other.minY + other.maxY) / 2;
    if (![other.minX, other.minY, other.maxX, other.maxY, cx, cy].every(Number.isFinite))
      return null;
    for (const value of [other.minX, cx, other.maxX])
      append(x, value, other.minY, other.maxY, true);
    for (const value of [other.minY, cy, other.maxY])
      append(y, value, other.minX, other.maxX, true);
  }
  return {
    source: others,
    sourceLength: others.length,
    w: canvas.w,
    h: canvas.h,
    x: prepareAxis(x),
    y: prepareAxis(y),
  };
}

export function matchesCanvasSnapIndex(
  index: CanvasSnapIndex | null | undefined,
  others: readonly SnapBounds[],
  canvas: SnapCanvas
): index is CanvasSnapIndex {
  return (
    !!index &&
    index.source === others &&
    index.sourceLength === others.length &&
    Object.is(index.w, canvas.w) &&
    Object.is(index.h, canvas.h)
  );
}

function lowerBound(index: AxisIndex, test: (target: AxisTarget) => boolean): number {
  let from = 0;
  let to = index.targets.length;
  while (from < to) {
    const middle = (from + to) >>> 1;
    if (test(index.targets[middle]!)) to = middle;
    else from = middle + 1;
  }
  return from;
}

function earliestInRange(index: AxisIndex, from: number, to: number): number {
  let best = EMPTY;
  from += index.leafCount;
  to += index.leafCount;
  while (from < to) {
    if (from & 1) best = earlier(index, best, index.tree[from++]!);
    if (to & 1) best = earlier(index, best, index.tree[--to]!);
    from >>>= 1;
    to >>>= 1;
  }
  return best;
}

function nearest(index: AxisIndex, edge: number, threshold: number): IndexedSnapPick | null {
  const split = lowerBound(index, (target) => target.value >= edge);
  const before = split > 0 ? Math.abs(index.targets[split - 1]!.value - edge) : Infinity;
  const after =
    split < index.targets.length ? Math.abs(index.targets[split]!.value - edge) : Infinity;
  const distance = Math.min(before, after);
  if (distance > threshold) return null;
  // Subtraction can round several distinct values to the same distance. Query
  // their whole interval so original insertion order still decides every tie.
  const from = lowerBound(index, (target) => target.value - edge >= -distance);
  const to = lowerBound(index, (target) => target.value - edge > distance);
  const winner = earliestInRange(index, from, to);
  if (winner === EMPTY) return null;
  const target = index.targets[winner]!;
  return {
    d: target.value - edge,
    line: target.value,
    min: target.min,
    max: target.max,
    object: target.object,
  };
}

/** Query the threshold range, retaining active-edge then target insertion ties. */
export function queryCanvasSnapAxis(
  index: CanvasSnapIndex,
  axis: Axis,
  edges: readonly number[],
  threshold: number,
  guides: readonly number[] = []
): IndexedSnapPick | null {
  let best: IndexedSnapPick | null = null;
  for (const edge of edges) {
    let pick = nearest(index[axis], edge, threshold);
    for (const line of guides) {
      if (!Number.isFinite(line)) continue;
      const d = line - edge;
      if (Math.abs(d) <= threshold && (!pick || Math.abs(d) < Math.abs(pick.d)))
        pick = { d, line, min: 0, max: axis === 'x' ? index.h : index.w, object: false };
    }
    if (pick && (!best || Math.abs(pick.d) < Math.abs(best.d))) best = pick;
  }
  return best;
}
