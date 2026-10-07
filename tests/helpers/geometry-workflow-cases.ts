// SPDX-License-Identifier: MPL-2.0
import type { Cubic } from '../../engine/src/geom/bezier.ts';
import { subCubic } from '../../engine/src/geom/bezier.ts';
import type { GeomPath } from '../../engine/src/geom/path.ts';

function circle(x: number, y: number, r: number): GeomPath[number] {
  const k = r * 0.5522847498307936;
  return {
    closed: true,
    curves: [
      [x + r, y, x + r, y + k, x + k, y + r, x, y + r],
      [x, y + r, x - k, y + r, x - r, y + k, x - r, y],
      [x - r, y, x - r, y - k, x - k, y - r, x, y - r],
      [x, y - r, x + k, y - r, x + r, y - k, x + r, y],
    ],
  };
}

export function circleGrid(count: number, dx = 0, dy = 0): GeomPath {
  return Array.from({ length: count }, (_, i) =>
    circle((i % 4) * 60 + dx, Math.floor(i / 4) * 60 + dy, 24)
  );
}

export function wigglePath(count: number): GeomPath {
  return [
    {
      closed: false,
      curves: Array.from({ length: count }, (_, i): Cubic => {
        const x = i * 40,
          s = i % 2 ? -1 : 1;
        return [x, 0, x + 13, 60 * s, x + 27, 60 * s, x + 40, 0];
      }),
    },
  ];
}

export function intersectionPairs(): { name: string; a: Cubic; b: Cubic }[] {
  const base: Cubic = [0, 0, 45000, 30000, -15000, 30000, 30000, 0];
  return [
    {
      name: 'ordinary arcs',
      a: [0, 0, 55.23, 0, 100, 44.77, 100, 100],
      b: [100, 0, 44.77, 0, 0, 44.77, 0, 100],
    },
    {
      name: 'coincident C/S regression',
      a: [20, 20, 20, 30, 30, 40, 40, 4],
      b: [20, 20, 20, 30, 30, 40, 40, 40],
    },
    {
      name: 'reparameterised loop regression',
      a: subCubic(base, 0, 0.7),
      b: subCubic(base, 0.3, 1),
    },
  ];
}
