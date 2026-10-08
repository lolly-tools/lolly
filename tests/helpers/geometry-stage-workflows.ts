// SPDX-License-Identifier: MPL-2.0
/** Reproducible fitting/clipping workflows using existing analytic and regression inputs. */

import type { Cubic } from '../../engine/src/geom/bezier.ts';
import type { Intersection } from '../../engine/src/geom/intersect.ts';
import { intersectWithOperations, type GeometryOperations } from '../../engine/src/geom/operations.ts';
import { offsetCubic } from '../../engine/src/geom/offset.ts';
import { type GeomPath, toSvgPathData } from '../../engine/src/geom/path.ts';
import { makeGeomApi } from '../../engine/src/geom-api.ts';
import { circleGrid, intersectionPairs, wigglePath } from './geometry-workflow-cases.ts';

type StageResult = ReturnType<ReturnType<typeof makeGeomApi>['stroke']> | Cubic[] | Intersection[];
export interface GeometryStageWorkflow {
  id: string;
  kind: 'bridge' | 'piece' | 'pair';
  source: string;
  inputs: Record<string, unknown>;
  run(operations?: GeometryOperations): StageResult;
  runWithApi?(api: ReturnType<typeof makeGeomApi>): StageResult;
}

function bridge(runWithApi: NonNullable<GeometryStageWorkflow['runWithApi']>) {
  return { runWithApi, run: (operations?: GeometryOperations) => runWithApi(makeGeomApi(operations)) };
}

export function geometryStageWorkflows(): GeometryStageWorkflow[] {
  const circles = toSvgPathData(circleGrid(16), 12);
  const shifted = toSvgPathData(circleGrid(16, 18, 12), 12);
  const wiggle = toSvgPathData(wigglePath(40), 12);
  const rows: GeometryStageWorkflow[] = [];
  for (const tolerance of [0.01, 0.001]) {
    rows.push(
      {
        id: `offset-circles-${tolerance}`,
        kind: 'bridge',
        source: 'tests/helpers/geometry-workflow-cases.ts: circleGrid(16)',
        inputs: { d: circles, distance: 6, tolerance, join: 'round' },
        ...bridge(api => api.offset(circles, 6, { join: 'round', tolerance, decimals: 9 })),
      },
      {
        id: `stroke-wiggle-${tolerance}`,
        kind: 'bridge',
        source: 'tests/helpers/geometry-workflow-cases.ts: wigglePath(40)',
        inputs: { d: wiggle, width: 12, tolerance, join: 'round', cap: 'round' },
        ...bridge(api => api.stroke(wiggle, 12, { join: 'round', cap: 'round', tolerance, decimals: 9 })),
      }
    );
  }
  const cusp: Cubic = [0, 0, 100, 0, 0, 100, 100, -100];
  const lostLobe: GeomPath = [
    {
      closed: false,
      curves: [
        [-46.1499, -53.9709, 11.0416, -33.8951, -54.2973, -54.8821, 26.8313, -27.0415],
        [26.8313, -27.0415, 1.418, -36.9279, 32.4307, -10.5099, -30.8422, 33.3265],
        [-30.8422, 33.3265, -57.0003, 25.3133, 14.307, 46.577, -46.1499, -53.9709],
      ],
    },
  ];
  const regressionStrokes: [string, GeomPath, number, number, string][] = [
    [
      'stroke-cusp',
      [{ closed: false, curves: [cusp] }],
      10,
      0.001,
      'tests/geom-offset.test.ts: CUSP, round cusp outline',
    ],
    [
      'stroke-lost-lobe',
      lostLobe,
      4,
      0.01,
      'tests/geom-stroke.test.ts: lostLobe, self-folding chain',
    ],
  ];
  for (const [id, path, width, tolerance, source] of regressionStrokes) {
    const d = toSvgPathData(path, 12);
    rows.push({
      id,
      kind: 'bridge',
      source,
      inputs: { d, width, tolerance, join: 'round', cap: 'round' },
      ...bridge(api => api.stroke(d, width, { join: 'round', cap: 'round', tolerance, decimals: 9 })),
    });
  }
  const crossing: GeomPath = [
    {
      closed: true,
      curves: [
        [5.3941, -49.5121, -1.3494, -32.0786, -30.6456, -57.4887, -52.4931, 20.7614],
        [-52.4931, 20.7614, 16.1985, 43.3485, 22.5823, -33.6112, 25.6171, 6.5897],
        [25.6171, 6.5897, 48.1933, -23.4278, -29.2288, 7.7406, -40.159, -42.6903],
        [-40.159, -42.6903, -53.4551, -11.9816, -15.6685, -55.4734, -19.2914, 42.2458],
        [-19.2914, 42.2458, 23.5786, -20.8941, -40.5981, -40.444, 5.3941, -49.5121],
      ],
    },
  ];
  const crossingSvg = toSvgPathData(crossing, 12);
  rows.push(
    {
      id: 'offset-crossing-loop',
      kind: 'bridge',
      source: 'tests/geom-offset.test.ts: five-times-self-crossing loop grown by 7',
      inputs: { d: crossingSvg, distance: 7, tolerance: 0.01, join: 'miter' },
      ...bridge(api => api.offset(crossingSvg, 7, { join: 'miter', tolerance: 0.01, decimals: 9 })),
    },
    {
      id: 'union-circles',
      kind: 'bridge',
      source: 'tests/helpers/geometry-workflow-cases.ts: two circleGrid(16) operands',
      inputs: { ds: [circles, shifted] },
      ...bridge(api => api.union([circles, shifted], { decimals: 9 })),
    }
  );
  const smooth: Cubic = [0, 0, 60, 200, 200, -80, 260, 60];
  rows.push({
    id: 'offset-piece-smooth',
    kind: 'piece',
    source: 'tests/geom-fit.test.ts: OFFSET_BASE exact +20 offset',
    inputs: { curve: smooth, distance: 20, tolerance: 0.001 },
    run: (operations) => offsetCubic(smooth, 20, 0.001, operations),
  });
  for (const pair of intersectionPairs())
    rows.push({
      id: `pair-${pair.name.replace(/[^a-z0-9]+/gi, '-')}`,
      kind: 'pair',
      source: 'tests/helpers/geometry-workflow-cases.ts: intersectionPairs',
      inputs: { a: pair.a, b: pair.b },
      run: (operations) => intersectWithOperations(pair.a, pair.b, undefined, operations),
    });
  return rows;
}
