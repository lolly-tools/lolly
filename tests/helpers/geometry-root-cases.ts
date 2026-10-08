// SPDX-License-Identifier: MPL-2.0
import type {
  GeometryPolynomial,
  GeometryRoots,
} from '../../packages/node-shell/src/geometry-kernel.ts';
import { cubicRoots01 } from '../../engine/src/geom/intersect.ts';
import { circleGrid, wigglePath } from './geometry-workflow-cases.ts';

export interface RootCase {
  name: string;
  coefficients: GeometryPolynomial;
  roots: number[];
  directions: number[];
}

/** Expected roots come from explicit linear/quadratic/cubic factors. */
export function analyticRootCases(): RootCase[] {
  const rows: RootCase[] = [
    {
      name: 'three crossings',
      coefficients: [1, -1.6, 0.73, -0.09],
      roots: [0.2, 0.5, 0.9],
      directions: [1, -1, 1],
    },
    {
      name: 'double tangency and crossing',
      coefficients: [1, -1.6, 0.8, -0.128],
      roots: [0.4, 0.8],
      directions: [0, 1],
    },
    {
      name: 'triple crossing',
      coefficients: [1, -1.5, 0.75, -0.125],
      roots: [0.5],
      directions: [1],
    },
    {
      name: 'both endpoints',
      coefficients: [1, -1.5, 0.5, 0],
      roots: [0, 0.5, 1],
      directions: [1, -1, 1],
    },
    {
      name: 'quadratic crossings',
      coefficients: [0, 1, -0.7, 0.1],
      roots: [0.2, 0.5],
      directions: [-1, 1],
    },
    { name: 'quadratic tangency', coefficients: [0, 1, -1, 0.25], roots: [0.5], directions: [0] },
    { name: 'linear crossing', coefficients: [0, 0, 2, -1], roots: [0.5], directions: [1] },
    { name: 'negative zero endpoint', coefficients: [0, 0, 1, -0], roots: [0], directions: [1] },
    {
      name: 'endpoint rounding slack',
      coefficients: [0, 0, 1000.0000000000002, 1.1102230246251565e-16],
      roots: [0],
      directions: [1],
    },
    { name: 'left root within slack', coefficients: [0, 0, 1, 5e-10], roots: [0], directions: [1] },
    {
      name: 'right root within slack',
      coefficients: [0, 0, 1, -1.0000000005],
      roots: [1],
      directions: [1],
    },
    { name: 'outside slack', coefficients: [0, 0, 1, 2e-9], roots: [], directions: [] },
    { name: 'constant', coefficients: [0, 0, 0, 1], roots: [], directions: [] },
    { name: 'zero polynomial', coefficients: [0, 0, 0, 0], roots: [], directions: [] },
    { name: 'no real root in range', coefficients: [1, 0, 1, 1], roots: [], directions: [] },
  ];
  return rows.flatMap((row) => [
    row,
    {
      name: `${row.name}, reversed sign`,
      coefficients: row.coefficients.map((value) => -value) as unknown as GeometryPolynomial,
      roots: row.roots,
      directions: row.directions.map((value) => (value === 0 ? 0 : -value)),
    },
  ]);
}

export function referenceRoots(coefficients: GeometryPolynomial): GeometryRoots {
  const directions: number[] = [];
  return { roots: cubicRoots01(...coefficients, directions), directions };
}

/** Degenerate, near-repeated and scaled coefficients supplement analytic cases. */
export function rootPolynomialCorpus(count = 4096): GeometryPolynomial[] {
  let seed = 295;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const scales = [1, 1e-280, 1e-150, 1e-12, 1e12, 1e50, 1e98];
  const rows: GeometryPolynomial[] = [
    [2.4715770989605977e-9, -3.0000000023232825, 3.000000000727632, -0.5141400000759269],
    [1e-308, 1e-308, 1e-308, -1e-308],
    [1e-301, -1e-300, 2e-300, -5e-301],
    [1, -1.5000000000000002, 0.7500000000000001, -0.125],
  ];
  while (rows.length < count) {
    const i = rows.length,
      x = random() * 3 - 1,
      y = i % 5 ? random() * 3 - 1 : x + (i % 2 ? 1e-10 : 0),
      z = i % 7 ? random() * 3 - 1 : y,
      scale = scales[i % scales.length]! * (i % 2 ? -1 : 1);
    const coefficients: [number, number, number, number] =
      i % 3
        ? [1, -(x + y + z), x * y + x * z + y * z, -x * y * z]
        : [random() * 2 - 1, random() * 2 - 1, random() * 2 - 1, random() * 2 - 1];
    if (i % 11 === 0) coefficients[0] *= 1e-14;
    if (i % 13 === 0) coefficients[0] = 0;
    if (i % 17 === 0) coefficients[1] = 0;
    rows.push(coefficients.map((value) => value * scale) as unknown as GeometryPolynomial);
  }
  return rows.slice(0, count);
}

/** The same signed-distance coefficients used by line/cubic intersection, over reusable paths. */
export function lineDistanceBatches() {
  return [
    { name: 'circle-grid line queries', path: circleGrid(16) },
    { name: 'wiggle line queries', path: wigglePath(40) },
  ].map(({ name, path }) => {
    const coefficients: GeometryPolynomial[] = [];
    for (let ray = 0; ray < 24; ray++) {
      const angle = (ray * Math.PI) / 12,
        nx = -Math.sin(angle),
        ny = Math.cos(angle),
        x = ray * 7,
        y = ray * 5 - 40;
      for (const contour of path)
        for (const curve of contour.curves) {
          const ds = [0, 2, 4, 6].map((i) => nx * (curve[i]! - x) + ny * (curve[i + 1]! - y));
          const [d0, d1, d2, d3] = ds as [number, number, number, number];
          coefficients.push([
            -d0 + 3 * d1 - 3 * d2 + d3,
            3 * d0 - 6 * d1 + 3 * d2,
            -3 * d0 + 3 * d1,
            d0,
          ]);
        }
    }
    return { name, coefficients };
  });
}
