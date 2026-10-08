// SPDX-License-Identifier: MPL-2.0
/** Identical immutable controls for independent verification across Node, browser and worker. */
import type { Cubic } from '../../engine/src/geom/bezier.ts';
import { offsetCubic } from '../../engine/src/geom/offset.ts';

export interface OffsetErrorCase {
  name: string;
  src: Cubic;
  approx: Cubic[];
  distance: number;
  tol: number;
}
export function offsetErrorCases(): OffsetErrorCase[] {
  const line: Cubic = [0, 0, 10, 0, 20, 0, 30, 0];
  const lifted: Cubic = [0, 6, 10, 6, 20, 6, 30, 6];
  const sources: [string, Cubic][] = [
    ['smooth', [0, 0, 60, 200, 200, -80, 260, 60]],
    ['cusp', [0, 0, 100, 0, 0, 100, 100, -100]],
    ['endpoint-fallback', [0, 0, 0, 0, 50, 100, 100, 0]],
    ['loop', [0, 0, 100, 150, -100, 150, 0, 0]],
    ['near-line', [0, 0, 10, 1e-8, 20, -1e-8, 30, 0]],
  ];
  const cases: OffsetErrorCase[] = [
    { name: 'exact-line', src: line, approx: [lifted], distance: 6, tol: 0.01 },
    {
      name: 'shifted-line',
      src: line,
      approx: [[0, 6.125, 10, 6.125, 20, 6.125, 30, 6.125]],
      distance: 6,
      tol: 0.01,
    },
    {
      name: 'missing-normal',
      src: [1, 1, 1, 1, 1, 1, 1, 1],
      approx: [lifted],
      distance: 6,
      tol: 0.001,
    },
    {
      name: 'tiny-no-normal',
      src: line.map((x) => x * 1e-280) as Cubic,
      approx: [lifted],
      distance: 6,
      tol: 0.001,
    },
    { name: 'zero-distance', src: line, approx: [line], distance: 0, tol: 1e-9 },
  ];
  for (const [name, src] of sources)
    for (const distance of [-20, 6, 20]) {
      // A whole offset can contain several separately fitted features; the raw verifier
      // admits one fit of at most 32 curves, so select one bounded candidate snapshot.
      const approx = offsetCubic(src, distance, 0.01).slice(0, 32);
      for (const tol of [0.01, 0.001, 1e-9])
        cases.push({
          name: `${name}/${distance}/${tol}`,
          src: [...src],
          approx: approx.map((c) => [...c]),
          distance,
          tol,
        });
    }
  cases.push({
    name: 'maximum-chain',
    src: line,
    approx: Array.from(
      { length: 32 },
      (_, i) => lifted.map((x, j) => (j % 2 ? x + i : x)) as Cubic
    ),
    distance: 6,
    tol: 0.001,
  });
  cases.push({
    name: 'large-position',
    src: line.map((x) => x + 1e8) as Cubic,
    approx: [lifted.map((x) => x + 1e8) as Cubic],
    distance: 6,
    tol: 1e-9,
  });
  return cases;
}
