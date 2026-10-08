// SPDX-License-Identifier: MPL-2.0
/** Immutable pair requests, with explicit production and existing qualification budgets. */
import { type Cubic, subCubic } from '../../engine/src/geom/bezier.ts';
import {
  GEOMETRY_CLIP_LIMITS,
  type GeometryClipLimits,
} from '../../packages/node-shell/src/geometry-clipping.ts';
import { bitsFloat, floatBits } from './geometry-portable-math-cases.ts';
import { intersectionPairs } from './geometry-workflow-cases.ts';
import type { createGeometryFitting } from '../../packages/node-shell/src/geometry-fitting.ts';
import { offsetFitCases } from './geometry-offset-fit-cases.ts';
export interface ClipCase {
  name: string;
  a: Cubic;
  b: Cubic;
  tol: number;
  limits: GeometryClipLimits;
}
export interface ClipWireCase {
  name: string;
  a: string[];
  b: string[];
  tol: string;
  limits: GeometryClipLimits;
}
export const clipWire = (row: ClipCase): ClipWireCase => ({
  ...row,
  a: row.a.map(floatBits),
  b: row.b.map(floatBits),
  tol: floatBits(row.tol),
});
export const clipUnwire = (row: ClipWireCase): ClipCase => ({
  ...row,
  a: row.a.map(bitsFloat) as Cubic,
  b: row.b.map(bitsFloat) as Cubic,
  tol: bitsFloat(row.tol),
});
const reverse = (c: Cubic): Cubic => [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1]];
export function clipCases(): ClipCase[] {
  const arch: Cubic = [0, 0, 30, 30, 70, 30, 100, 0];
  const pairs = [
    ...intersectionPairs(),
    {
      name: 'signed-zero-lines',
      a: [-0, 0, 0, 0, 90, 0, 100, 0] as Cubic,
      b: [50, -10, 50, -3, 50, 7, 50, 10] as Cubic,
    },
    { name: 'nonuniform-line-curve', a: [0, 15, 0, 15, 90, 15, 100, 15] as Cubic, b: arch },
    { name: 'shared-full', a: arch, b: [...arch] as Cubic },
    { name: 'shared-subrange', a: subCubic(arch, 0, 0.7), b: subCubic(arch, 0.3, 1) },
    {
      name: 'zero-angle-contact',
      a: arch,
      b: [
        0, -0.0000026999999999999996, 30, 30.0000063, 70, 29.9999853, 100, 0.00003430000000000001,
      ] as Cubic,
    },
    { name: 'point-vs-curve', a: [50, 20, 50, 20, 50, 20, 50, 20] as Cubic, b: arch },
    {
      name: 'endpoint-cusp',
      a: [0, 0, 0, 0, 50, 30, 100, 0] as Cubic,
      b: [0, 0, 0, 0, 50, -30, 100, 0] as Cubic,
    },
    { name: 'outside-bounds', a: arch, b: arch.map((v, i) => v + (i % 2 ? 1000 : 0)) as Cubic },
  ];
  const modes = [
    GEOMETRY_CLIP_LIMITS,
    { ...GEOMETRY_CLIP_LIMITS, initial: 0 },
    { ...GEOMETRY_CLIP_LIMITS, initial: 0, overrun: 0 },
    { ...GEOMETRY_CLIP_LIMITS, initial: 0, stalled: 4 },
    { ...GEOMETRY_CLIP_LIMITS, initial: 0, stalled: 0 },
    { ...GEOMETRY_CLIP_LIMITS, initial: 10_000_000, overrun: 262_144 },
  ];
  return pairs.flatMap((p) =>
    modes.flatMap((limits, i) => [
      {
        name: p.name + '/' + i,
        a: [...p.a] as Cubic,
        b: [...p.b] as Cubic,
        tol: 1e-9,
        limits: { ...limits },
      },
      {
        name: p.name + '/' + i + '/swapped',
        a: [...p.b] as Cubic,
        b: [...p.a] as Cubic,
        tol: 1e-9,
        limits: { ...limits },
      },
      {
        name: p.name + '/' + i + '/reversed',
        a: reverse(p.a),
        b: reverse(p.b),
        tol: 1e-9,
        limits: { ...limits },
      },
    ])
  );
}
export function seededClipCases(count = 128): ClipCase[] {
  let seed = 0x295c11;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  const rows: ClipCase[] = [];
  for (let i = 0; i < count; i++) {
    const a = Array.from({ length: 8 }, () => (random() - 0.5) * 200) as Cubic;
    const b =
      i % 4
        ? (Array.from({ length: 8 }, () => (random() - 0.5) * 200) as Cubic)
        : (a.map((v) => v + (random() - 0.5) * 1e-4) as Cubic);
    rows.push({
      name: 'seeded-' + i,
      a,
      b,
      tol: [1e-9, 1e-6, 0.01][i % 3]!,
      limits: { ...GEOMETRY_CLIP_LIMITS, ...(i % 2 ? { initial: 0 } : {}) },
    });
  }
  return rows;
}

export function canonicalClipCases(
  kernel: Awaited<ReturnType<typeof createGeometryFitting>>
): ClipCase[] {
  const names = new Set([
    'smooth/-20/0.001',
    'smooth/20/0.001',
    'cusp/20/0.001',
    'loop/6/0.001',
    'reversed-cusp',
    'quarter-circle',
  ]);
  const workspace = kernel.createOffsetFitWorkspace(),
    rows: ClipCase[] = [];
  try {
    for (const r of offsetFitCases().filter((r) => names.has(r.name))) {
      const pieces = workspace.fit(r.src, r.distance, r.tol);
      // The corpus selects up to eight adjacent pairs from each complete owned fit.
      for (let i = 0; i < Math.min(8, pieces.length - 1); i++)
        for (const initial of [16_384, 0]) {
          const a = pieces[i]!.curve,
            b = pieces[i + 1]!.curve,
            limits = { ...GEOMETRY_CLIP_LIMITS, initial };
          rows.push({
            name: `canonical/${r.name}/${i}/${initial}`,
            a: [...a],
            b: [...b],
            tol: 1e-9,
            limits,
          });
          rows.push({
            name: `canonical/${r.name}/${i}/${initial}/swapped`,
            a: [...b],
            b: [...a],
            tol: 1e-9,
            limits: { ...limits },
          });
        }
    }
  } finally {
    workspace.dispose();
  }
  return rows;
}
