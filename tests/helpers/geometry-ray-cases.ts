// SPDX-License-Identifier: MPL-2.0
import { boundsCubic, lineToCubic, type Cubic } from '../../engine/src/geom/bezier.ts';
import type { Bundle, CurveIndex } from '../../engine/src/geom/ray-cast.ts';
import { circleGrid, wigglePath } from './geometry-workflow-cases.ts';

export interface RayCase {
  name: string;
  index: CurveIndex;
  point: [number, number];
  direction: [number, number];
  ref: { x: number; y: number } | null;
  near: number;
  work: number;
  complete: boolean;
  bundle: Bundle | null;
  expected?: { far: number; net: number; ok: boolean; work: number };
}
export type RayWire = Omit<RayCase, 'bundle'> & { bundle: [number, [number, number][]][] | null };
export function rayIndex(curves: readonly Cubic[]): CurveIndex {
  const rows = curves.map((c) => ({ c, box: boundsCubic(c) }));
  if (!rows.length) return { curves: [], box: null };
  return {
    curves: rows,
    box: {
      x0: Math.min(...rows.map((row) => row.box.x0)),
      y0: Math.min(...rows.map((row) => row.box.y0)),
      x1: Math.max(...rows.map((row) => row.box.x1)),
      y1: Math.max(...rows.map((row) => row.box.y1)),
    },
  };
}
export function rayCases(): RayCase[] {
  const vertical = (x: number): Cubic => lineToCubic(x, -1, x, 1);
  const base: RayCase = {
    name: 'rising crossing',
    index: rayIndex([vertical(1)]),
    point: [0, 0],
    direction: [1, 0],
    ref: null,
    near: 1e-9,
    work: 100,
    complete: false,
    bundle: null,
    expected: { far: 1, net: 0, ok: true, work: 91 },
  };
  const rows: RayCase[] = [
    base,
    {
      ...base,
      name: 'reversed crossing',
      index: rayIndex([lineToCubic(1, 1, 1, -1)]),
      expected: { far: -1, net: 0, ok: true, work: 91 },
    },
    {
      ...base,
      name: 'behind origin',
      index: rayIndex([vertical(-1)]),
      expected: { far: 0, net: 0, ok: true, work: 99 },
    },
    { ...base, name: 'zero budget', work: 0, expected: { far: 0, net: 0, ok: false, work: 0 } },
    {
      ...base,
      name: 'negative budget',
      work: -8,
      expected: { far: 0, net: 0, ok: false, work: -8 },
    },
    {
      ...base,
      name: 'one work unit finishes its curve',
      work: 1,
      expected: { far: 1, net: 0, ok: true, work: -8 },
    },
    {
      ...base,
      name: 'budget stops before second curve',
      index: rayIndex([vertical(1), vertical(2)]),
      work: 9,
      expected: { far: 1, net: 0, ok: false, work: 0 },
    },
    {
      ...base,
      name: 'along ray stops before later crossing',
      index: rayIndex([lineToCubic(0, 0, 2, 0), vertical(1)]),
      expected: { far: 0, net: 0, ok: false, work: 99 },
    },
    {
      ...base,
      name: 'completion visits past along-ray curve',
      index: rayIndex([lineToCubic(0, 0, 2, 0), vertical(1)]),
      complete: true,
      expected: { far: 1, net: 0, ok: false, work: 90 },
    },
    {
      ...base,
      name: 'curve through query joins reference',
      index: rayIndex([vertical(0)]),
      ref: { x: 0, y: 1 },
      expected: { far: 0, net: 1, ok: true, work: 91 },
    },
    {
      ...base,
      name: 'front twin range',
      index: rayIndex([vertical(3e-7)]),
      ref: { x: 0, y: 1 },
      bundle: new Map([[0, [[0.4, 0.6]]]]),
      expected: { far: 0, net: 1, ok: true, work: 91 },
    },
    {
      ...base,
      name: 'behind twin range',
      index: rayIndex([vertical(-3e-7)]),
      ref: { x: 0, y: 1 },
      bundle: new Map([[0, [[0.4, 0.6]]]]),
      expected: { far: 0, net: 1, ok: true, work: 91 },
    },
    {
      ...base,
      name: 'other branch is outside twin range',
      index: rayIndex([vertical(3e-7)]),
      ref: { x: 0, y: 1 },
      bundle: new Map([[0, [[0.1, 0.2]]]]),
      expected: { far: 1, net: 0, ok: true, work: 91 },
    },
    {
      ...base,
      name: 'near band retries',
      index: rayIndex([vertical(1e-8)]),
      ref: { x: 0, y: 1 },
      expected: { far: 0, net: 0, ok: false, work: 91 },
    },
    {
      ...base,
      name: 'near band completion',
      index: rayIndex([vertical(1e-8)]),
      ref: { x: 0, y: 1 },
      complete: true,
      expected: { far: 1, net: 0, ok: false, work: 91 },
    },
    {
      ...base,
      name: 'double tangency',
      index: rayIndex([[0, 0, 10, 20, 20, 20, 30, 0]]),
      point: [-10, 15],
      expected: { far: 0, net: 0, ok: false, work: 91 },
    },
    {
      ...base,
      name: 'tangency completion',
      index: rayIndex([[0, 0, 10, 20, 20, 20, 30, 0]]),
      point: [-10, 15],
      complete: true,
      expected: { far: 0, net: 0, ok: false, work: 91 },
    },
  ];
  const paths = [
    circleGrid(16),
    wigglePath(40),
    [{ closed: false, curves: [[0, 0, 45000, 30000, -15000, 30000, 30000, 0] as Cubic] }],
  ];
  for (const [pi, path] of paths.entries()) {
    const index = rayIndex(path.flatMap((contour) => contour.curves));
    for (let i = 0; i < 48; i++) {
      const angle = i * 2.399963229728653;
      rows.push({
        ...base,
        name: `path ${pi}, direction ${i}`,
        index,
        point: [i * 7 - 30, i * 3 - 20],
        direction: i === 0 ? [1, 0] : i === 1 ? [0, 1] : [Math.cos(angle), Math.sin(angle)],
        ref: i % 3 ? null : { x: 1, y: -0.4 },
        work: i % 7 ? 200_000_000 : i * 4,
        complete: i % 2 === 0,
        expected: undefined,
      });
    }
  }
  return rows;
}
