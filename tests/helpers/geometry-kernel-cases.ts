// SPDX-License-Identifier: MPL-2.0
import type { Cubic } from '../../engine/src/geom/bezier.ts';

/** Deterministic curved paths for complete nearest-query and boundary-cost measurements. */
export function geometryCurves(count: number): Cubic[] {
  let seed = 0x295600;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, (_, index): Cubic => {
    const x = (index % 32) * 40,
      y = Math.floor(index / 32) * 40;
    const curve: Cubic = [
      x,
      y,
      x + random() * 200 - 100,
      y + random() * 200 - 100,
      x + random() * 200 - 100,
      y + random() * 200 - 100,
      x + random() * 10,
      y + random() * 10,
    ];
    return curve.map((value) => Math.round(value * 1e6) / 1e6) as Cubic;
  });
}

export function geometryPathData(curves: readonly Cubic[]): string {
  return curves.map((c) => `M${c[0]} ${c[1]}C${c.slice(2).join(' ')}`).join('');
}
