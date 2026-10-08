// SPDX-License-Identifier: MPL-2.0
/** One current engine bundle with a comparison-only complete pair-search substitution. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type Plugin } from 'esbuild';
import type * as intersections from '../../engine/src/geom/intersect.ts';
import type { setClipProbe } from '../../tests/helpers/geometry-clip-control.ts';
import type { geometryStageWorkflows } from '../../tests/helpers/geometry-stage-workflows.ts';
import type { qualifyClipping } from '../../tests/helpers/geometry-clip-qualification.ts';
import type { createGeometryClipping } from '../../packages/node-shell/src/geometry-clipping.ts';
const repo = fileURLToPath(new URL('../../', import.meta.url));
export function clipComparisonPlugin(): Plugin {
  return {
    name: 'clip-comparison',
    setup(builder) {
      builder.onLoad({ filter: /engine\/src\/geom\/intersect\.ts$/ }, async (args) => {
        const source = await readFile(args.path, 'utf8');
        const entry =
          /export function intersectCubics\(c1: Cubic, c2: Cubic, tol = EPS\): Intersection\[\] \{/g;
        assert.equal([...source.matchAll(entry)].length, 1, 'One complete cubic pair entry.');
        return {
          contents:
            `import {clipProbe} from ${JSON.stringify(repo + 'tests/helpers/geometry-clip-control.ts')};\n` +
            source.replace(
              entry,
              (match) =>
                match +
                '\nif (clipProbe) return clipProbe(c1,c2,tol,{initial:CLIP_BUDGET.maxNodes,overrun:OVERRUN_BUDGET.maxNodes,stalled:SCAN_LIMITS.maxStalledPairs},CLIP_COUNTS);'
            ),
          loader: 'ts',
          resolveDir: dirname(args.path),
        };
      });
    },
  };
}
export async function loadClipComparison() {
  const result = await build({
    stdin: {
      contents:
        "export {geometryStageWorkflows} from './tests/helpers/geometry-stage-workflows.ts'; export * from './engine/src/geom/intersect.ts'; export {setClipProbe} from './tests/helpers/geometry-clip-control.ts'; export {qualifyClipping} from './tests/helpers/geometry-clip-qualification.ts'; export {createGeometryClipping} from './packages/node-shell/src/geometry-clipping.ts';",
      resolveDir: repo,
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    plugins: [clipComparisonPlugin()],
  });
  const code = result.outputFiles[0]!.text;
  const module = (await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  )) as typeof intersections & {
    setClipProbe: typeof setClipProbe;
    geometryStageWorkflows: typeof geometryStageWorkflows;
    qualifyClipping: typeof qualifyClipping;
    createGeometryClipping: typeof createGeometryClipping;
  };
  return { module, code };
}
