// SPDX-License-Identifier: MPL-2.0
/** Ordered curve-proximity candidates from start, midpoint and end cells. */
import { type Cubic, evalCubic } from './bezier.ts';

/** Keep pair order and early stopping stable while avoiding string keys in the spatial pass. */
export function visitNearPieces(
  edges: readonly Cubic[],
  weld: number,
  visit: (i: number, j: number) => boolean
): void {
  const cell = Math.max(weld * 4, 1e-12);
  const buckets = new Map<number, Map<number, number[]>>();
  const cells = edges.map((edge) => {
    const mid = evalCubic(edge, 0.5);
    return [edge[0], edge[1], mid.x, mid.y, edge[6], edge[7]].map((value) =>
      Math.round(value / cell)
    );
  });
  for (let i = 0; i < cells.length; i++) {
    const points = cells[i]!;
    for (let at = 0; at < 6; at += 2) {
      const x = points[at]!,
        y = points[at + 1]!;
      let column = buckets.get(x);
      if (!column) {
        column = new Map();
        buckets.set(x, column);
      }
      const bucket = column.get(y);
      if (bucket) {
        if (bucket[bucket.length - 1] !== i) bucket.push(i);
      } else column.set(y, [i]);
    }
  }
  const seen = new Set<number>();
  for (let i = 0; i < cells.length; i++) {
    seen.clear();
    const points = cells[i]!;
    for (let at = 0; at < 6; at += 2) {
      const cx = points[at]!,
        cy = points[at + 1]!;
      for (let ox = -1; ox <= 1; ox++) {
        const column = buckets.get(cx + ox);
        if (!column) continue;
        for (let oy = -1; oy <= 1; oy++) {
          const bucket = column.get(cy + oy);
          if (!bucket) continue;
          for (const j of bucket) {
            if (j <= i || seen.has(j)) continue;
            seen.add(j);
            if (!visit(i, j)) return;
          }
        }
      }
    }
  }
}
