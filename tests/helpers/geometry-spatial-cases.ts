// SPDX-License-Identifier: MPL-2.0
import { type Cubic, evalCubic } from '../../engine/src/geom/bezier.ts';
import { geometryCurves } from './geometry-kernel-cases.ts';
import { circleGrid, wigglePath } from './geometry-workflow-cases.ts';

/** Historical string-key traversal is the ordering reference for the new numerical indexes. */
export function referenceVisitNearPieces(
  edges: readonly Cubic[],
  weld: number,
  visit: (i: number, j: number) => boolean
): void {
  const cell = Math.max(weld * 4, 1e-12),
    buckets = new Map<string, number[]>();
  const mids = edges.map((edge) => evalCubic(edge, 0.5));
  const put = (x: number, y: number, i: number) => {
    const key = `${Math.round(x / cell)},${Math.round(y / cell)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      if (bucket[bucket.length - 1] !== i) bucket.push(i);
    } else buckets.set(key, [i]);
  };
  edges.forEach((edge, i) => {
    put(edge[0], edge[1], i);
    put(mids[i]!.x, mids[i]!.y, i);
    put(edge[6], edge[7], i);
  });
  const seen = new Set<number>();
  for (let i = 0; i < edges.length; i++) {
    seen.clear();
    const edge = edges[i]!;
    for (const [x, y] of [
      [edge[0], edge[1]],
      [mids[i]!.x, mids[i]!.y],
      [edge[6], edge[7]],
    ]) {
      const cx = Math.round(x! / cell),
        cy = Math.round(y! / cell);
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          for (const j of buckets.get(`${cx + ox},${cy + oy}`) ?? []) {
            if (j <= i || seen.has(j)) continue;
            seen.add(j);
            if (!visit(i, j)) return;
          }
        }
    }
  }
}

export function referenceNearPairs(edges: readonly Cubic[], weld: number): [number, number][] {
  const out: [number, number][] = [];
  referenceVisitNearPieces(edges, weld, (i, j) => {
    out.push([i, j]);
    return true;
  });
  return out;
}

export function spatialCases(): { name: string; curves: Cubic[]; weld: number }[] {
  const point = (x: number, y = x): Cubic => [x, y, x, y, x, y, x, y];
  const random = geometryCurves(128);
  const copies = random.flatMap((curve) => [
    curve,
    curve.map((v, i) => v + (i % 2 ? -0.001 : 0.001)) as Cubic,
    [curve[6], curve[7], curve[4], curve[5], curve[2], curve[3], curve[0], curve[1]] as Cubic,
  ]);
  return [
    { name: 'one curve', curves: [point(0)], weld: 1 },
    { name: 'all duplicate cells', curves: Array.from({ length: 16 }, () => point(0)), weld: 1 },
    {
      name: 'negative half cells',
      curves: [-2, 2, -6, 6, -10, 10, -0].map((x) => point(x)),
      weld: 1,
    },
    {
      name: 'cell boundary neighbors',
      curves: [-2 - 1e-12, -2 + 1e-12, 2 - 1e-12, 2 + 1e-12].map((x) => point(x)),
      weld: 1,
    },
    {
      name: 'huge cells and floor radius',
      curves: [point(1e9), point(1e9), point(-1e9), point(-1e9)],
      weld: 1e-13,
    },
    {
      name: 'end and midpoint contacts',
      curves: [[0, 0, 40, 80, -40, 80, 0, 0], point(0), point(0, 60), point(100)],
      weld: 0.01,
    },
    { name: 'random reversed near copies', curves: copies, weld: 0.01 },
    { name: 'circle grid', curves: circleGrid(16).flatMap((c) => c.curves), weld: 1e-5 },
    { name: 'wiggle', curves: wigglePath(40)[0]!.curves, weld: 1e-5 },
  ];
}
