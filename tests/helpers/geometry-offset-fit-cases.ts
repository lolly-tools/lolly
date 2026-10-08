// SPDX-License-Identifier: MPL-2.0
/** Complete source-specific fitting requests shared unchanged across qualified realms. */
import type { Cubic } from '../../engine/src/geom/bezier.ts';
import { offsetErrorCases } from './geometry-offset-error-cases.ts';
export interface OffsetFitCase {
  name: string;
  src: Cubic;
  distance: number;
  tol: number;
}
export function offsetFitCases(): OffsetFitCase[] {
  const cases = offsetErrorCases().map(({ name, src, distance, tol }) => ({
    name,
    src,
    distance,
    tol,
  }));
  cases.push(
    { name: 'signed-zero', src: [-0, 0, -0, 10, 0, 20, 0, 30], distance: -6, tol: 0.001 },
    { name: 'nonuniform-line', src: [30, 0, 29, 0, 0, 0, -10, 0], distance: 7, tol: 0.001 },
    { name: 'reversed-cusp', src: [100, -100, 0, 100, 100, 0, 0, 0], distance: 20, tol: 0.001 },
    {
      name: 'quarter-circle',
      src: [80, 0, 80, 44.18277998646349, 44.18277998646349, 80, 0, 80],
      distance: 6,
      tol: 0.001,
    },
    {
      name: 'near-closed-chord',
      src: [0, 0, 100, 150, -100, 150, 1e-10, -1e-10],
      distance: -20,
      tol: 0.001,
    },
    { name: 'vanishing-end-leg', src: [0, 0, 50, 100, 100, 0, 100, 0], distance: 20, tol: 0.001 },
    {
      name: 'negative-near-zero-distance',
      src: [0, 0, 60, 200, 200, -80, 260, 60],
      distance: -1e-13,
      tol: 0.001,
    }
  );
  return cases;
}
export function seededOffsetFitCases(count = 128): OffsetFitCase[] {
  let seed = 0x295e2;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  return Array.from({ length: count }, (_, i) => {
    const scale = [0.001, 1, 1000][i % 3]!;
    const position = [0, 100, -3000, 1e5][i % 4]!;
    const src = Array.from({ length: 8 }, () => position + (random() - 0.5) * 200 * scale) as Cubic;
    return {
      name: `seeded-${i}`,
      src,
      distance: (random() - 0.5) * 30 * scale,
      tol: [0.01, 0.001][i % 2]! * scale,
    };
  });
}
