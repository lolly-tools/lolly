// SPDX-License-Identifier: MPL-2.0
/** One current engine bundle with a comparison-only complete offset-pieces substitution. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type Plugin } from 'esbuild';
import type { CLIP_COUNTS } from '../../engine/src/geom/intersect.ts';
import type {
  OffsetFitProbe,
  setOffsetFitProbe,
} from '../../tests/helpers/geometry-offset-fit-control.ts';
import type { geometryStageWorkflows } from '../../tests/helpers/geometry-stage-workflows.ts';

const repo = fileURLToPath(new URL('../../', import.meta.url));
export function offsetFitComparisonPlugin(): Plugin {
  return {
    name: 'offset-fit-comparison',
    setup(builder) {
      builder.onLoad({ filter: /engine\/src\/geom\/offset\.ts$/ }, async (args) => {
        const source = await readFile(args.path, 'utf8');
        const entry =
          /function offsetPieces\(c: Cubic, distance: number, tol: number\): OffsetPiece\[\] \{/g;
        assert.equal([...source.matchAll(entry)].length, 1, 'One complete offset pieces entry.');
        return {
          contents:
            `import {offsetFitProbe,setOffsetFitReference} from ${JSON.stringify(repo + 'tests/helpers/geometry-offset-fit-control.ts')};\n` +
            source.replace(
              entry,
              (match) => match + '\nif (offsetFitProbe) return offsetFitProbe(c, distance, tol);'
            ) +
            '\nsetOffsetFitReference(offsetPieces); export {offsetPieces};\n',
          loader: 'ts',
          resolveDir: dirname(args.path),
        };
      });
    },
  };
}
export async function loadOffsetFitComparison() {
  const result = await build({
    stdin: {
      contents:
        "export {geometryStageWorkflows} from './tests/helpers/geometry-stage-workflows.ts'; export {offsetPieces} from './engine/src/geom/offset.ts'; export {setOffsetFitProbe} from './tests/helpers/geometry-offset-fit-control.ts'; export {CLIP_COUNTS} from './engine/src/geom/intersect.ts';",
      resolveDir: repo,
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    plugins: [offsetFitComparisonPlugin()],
  });
  const code = result.outputFiles[0]!.text;
  const module = (await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  )) as {
    geometryStageWorkflows: typeof geometryStageWorkflows;
    offsetPieces: OffsetFitProbe;
    setOffsetFitProbe: typeof setOffsetFitProbe;
    CLIP_COUNTS: typeof CLIP_COUNTS;
  };
  return { module, code };
}
