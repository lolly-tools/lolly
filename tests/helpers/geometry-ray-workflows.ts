// SPDX-License-Identifier: MPL-2.0
/** Complete-operation recipes exercise the retained stage through the unchanged SVG bridge. */
import type { makeGeomApi } from '../../engine/src/geom-api.ts';
import { circleGrid, wigglePath } from './geometry-workflow-cases.ts';
import { toSvgPathData } from '../../engine/src/geom/path.ts';

export function rayWorkflows() {
  const circles = toSvgPathData(circleGrid(16), 12),
    shifted = toSvgPathData(circleGrid(16, 18, 12), 12),
    wiggle = toSvgPathData(wigglePath(40), 12);
  const cusp = 'M0,0 C100,100 -100,100 0,0 Z';
  const a = 'M0,0 H100 V100 H0 Z',
    thin = 'M99.99999,0 H200 V100 H99.99999 Z';
  const large = 'M100000000,100000000 h1 v1 h-1 z',
    largeShift = 'M100000000.5,100000000.5 h1 v1 h-1 z';
  type Api = ReturnType<typeof makeGeomApi>;
  return [
    {
      name: 'union: 16 circle pairs',
      run: (api: Api) => api.union([circles, shifted], { decimals: 9 }),
    },
    {
      name: 'intersection: 16 circle pairs',
      run: (api: Api) => api.intersect([circles, shifted], { decimals: 9 }),
    },
    {
      name: 'difference: 16 circle pairs',
      run: (api: Api) => api.difference([circles, shifted], { decimals: 9 }),
    },
    {
      name: 'offset: 16 circles',
      run: (api: Api) => api.offset(circles, 6, { join: 'round', tolerance: 0.01, decimals: 9 }),
    },
    {
      name: 'stroke: 40 cubic wiggle',
      run: (api: Api) =>
        api.stroke(wiggle, 12, { join: 'round', cap: 'round', tolerance: 0.01, decimals: 9 }),
    },
    {
      name: 'cusp and its exact copy',
      run: (api: Api) => api.union([cusp, cusp], { decimals: 9 }),
    },
    { name: 'thin overlap', run: (api: Api) => api.intersect([a, thin], { decimals: 9 }) },
    {
      name: 'large-position overlap',
      run: (api: Api) => api.union([large, largeShift], { decimals: 9 }),
    },
  ];
}
