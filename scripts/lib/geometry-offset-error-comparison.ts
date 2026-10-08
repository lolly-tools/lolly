// SPDX-License-Identifier: MPL-2.0
/** Compile a same-source engine with an explicit comparison-only complete offset verifier hook. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type Plugin } from 'esbuild';
import type { CLIP_COUNTS } from '../../engine/src/geom/intersect.ts';
import type { offsetError } from '../../engine/src/geom/offset-error.ts';
import type { setOffsetErrorProbe } from '../../tests/helpers/geometry-offset-error-control.ts';
import type { geometryStageWorkflows } from '../../tests/helpers/geometry-stage-workflows.ts';

const repo = fileURLToPath(new URL('../../', import.meta.url));
export function offsetErrorComparisonPlugin(): Plugin {
  return {
    name: 'offset-error-comparison',
    setup(builder) {
      builder.onLoad({ filter: /engine\/src\/geom\/offset-error\.ts$/ }, async (args) => {
        const source = await readFile(args.path, 'utf8');
        const entry =
          /export function offsetError\([\s\S]*?\): \{\s*error: number;\s*t: number\s*\} \{/g;
        assert.equal([...source.matchAll(entry)].length, 1, 'One complete offset verifier entry.');
        return {
          contents:
            `import {offsetErrorProbe} from ${JSON.stringify(repo + 'tests/helpers/geometry-offset-error-control.ts')};\n` +
            source.replace(
              entry,
              (match) =>
                match + '\nif (offsetErrorProbe) return offsetErrorProbe(src, approx, d, tol);'
            ),
          loader: 'ts',
          resolveDir: dirname(args.path),
        };
      });
    },
  };
}
export async function loadOffsetErrorComparison() {
  const result = await build({
    stdin: {
      contents:
        "export {geometryStageWorkflows} from './tests/helpers/geometry-stage-workflows.ts'; export {offsetError} from './engine/src/geom/offset-error.ts'; export {setOffsetErrorProbe} from './tests/helpers/geometry-offset-error-control.ts'; export {CLIP_COUNTS} from './engine/src/geom/intersect.ts';",
      resolveDir: repo,
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    plugins: [offsetErrorComparisonPlugin()],
  });
  const code = result.outputFiles[0]!.text;
  const module = (await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  )) as {
    geometryStageWorkflows: typeof geometryStageWorkflows;
    offsetError: typeof offsetError;
    setOffsetErrorProbe: typeof setOffsetErrorProbe;
    CLIP_COUNTS: typeof CLIP_COUNTS;
  };
  return { module, code };
}
