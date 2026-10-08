// SPDX-License-Identifier: MPL-2.0
/** Compile a same-source engine with an explicit comparison-only ray-cast hook. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type Plugin } from 'esbuild';
import type { makeGeomApi } from '../../engine/src/geom-api.ts';
import type { setRayProbe } from '../../tests/helpers/geometry-ray-control.ts';

const repo = fileURLToPath(new URL('../../', import.meta.url));
export function rayComparisonPlugin(): Plugin {
  return {
    name: 'ray-comparison',
    setup(builder) {
      builder.onLoad({ filter: /engine\/src\/geom\/ray-cast\.ts$/ }, async (args) => {
        const source = await readFile(args.path, 'utf8');
        const marker = '): Cast {';
        assert.equal(source.split(marker).length, 2, 'one complete cast entry');
        return {
          contents:
            `import {rayProbe} from ${JSON.stringify(repo + 'tests/helpers/geometry-ray-control.ts')};\n` +
            source.replace(
              marker,
              marker +
                '\nif (rayProbe) return rayProbe(idx, px, py, ux, uy, ref, near, budget, complete, bundle);'
            ),
          loader: 'ts',
          resolveDir: dirname(args.path),
        };
      });
    },
  };
}
export async function loadRayComparison() {
  const compiled = await build({
    stdin: {
      contents:
        "export {makeGeomApi} from './engine/src/geom-api.ts'; export {setRayProbe} from './tests/helpers/geometry-ray-control.ts';",
      resolveDir: repo,
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    plugins: [rayComparisonPlugin()],
  });
  return (await import(
    `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0]!.text).toString('base64')}`
  )) as {
    makeGeomApi: typeof makeGeomApi;
    setRayProbe: typeof setRayProbe;
  };
}
