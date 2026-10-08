// SPDX-License-Identifier: MPL-2.0
/** Run the existing geometry corpus with a retained cast or verifier substituted in a local test bundle. */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { offsetErrorComparisonPlugin } from './lib/geometry-offset-error-comparison.ts';
import { offsetFitComparisonPlugin } from './lib/geometry-offset-fit-comparison.ts';
import { rayComparisonPlugin } from './lib/geometry-ray-comparison.ts';
import { clipComparisonPlugin } from './lib/geometry-clip-comparison.ts';

const repo = fileURLToPath(new URL('../', import.meta.url));
const tests = readdirSync(join(repo, 'tests'))
  .filter((name) => /^geom-.*\.test\.ts$/.test(name))
  .sort();
const offset = process.argv.includes('--offset-error');
const portable = process.argv.includes('--portable-math');
const fitting = portable || process.argv.includes('--offset-fit');
const clipping = process.argv.includes('--clipping');
if ([offset, fitting, clipping].filter(Boolean).length > 1)
  throw new Error('Select one retained comparison backend.');
const output = join(
  repo,
  `plans/295-validation/geometry-${clipping ? 'clip' : portable ? 'portable-fit' : fitting ? 'offset-fit' : offset ? 'offset-error' : 'ray'}-corpus.mjs`
);
mkdirSync(dirname(output), { recursive: true });
await build({
  stdin: {
    contents: `
      import assert from 'node:assert/strict';
      import {afterEach, after} from 'node:test';
      import {${clipping ? 'loadGeometryClipping as loadGeometryKernel' : fitting ? 'loadGeometryFitting as loadGeometryKernel' : 'loadGeometryKernel'}} from 'geometry-ray-corpus:kernel';
      ${clipping ? "import {createClipBackend as createBackend} from './tests/helpers/geometry-clip-backend.ts'; import {setClipProbe as setProbe} from './tests/helpers/geometry-clip-control.ts';" : fitting ? "import {createOffsetFitBackend as createBackend} from './tests/helpers/geometry-offset-fit-backend.ts'; import {setOffsetFitProbe as setProbe} from './tests/helpers/geometry-offset-fit-control.ts';" : offset ? "import {createOffsetErrorBackend as createBackend} from './tests/helpers/geometry-offset-error-backend.ts'; import {setOffsetErrorProbe as setProbe} from './tests/helpers/geometry-offset-error-control.ts';" : "import {createRayBackend as createBackend} from './tests/helpers/geometry-ray-backend.ts'; import {setRayProbe as setProbe} from './tests/helpers/geometry-ray-control.ts';"}
      const kernel = await loadGeometryKernel();
      const backend = createBackend(kernel);
      ${
        clipping
          ? `import {intersectCubics} from './engine/src/geom/intersect.ts';
      const probe = (a,b,tol,limits,counts) => {
        const before = {...counts}; setProbe(undefined);
        try {
          const reference = intersectCubics(a,b,tol), expectedCounts = {...counts};
          Object.assign(counts,before);
          const actual = backend.intersect(a,b,tol,limits,counts);
          assert.deepEqual(actual,reference,'Exact contacts and source directions on each corpus pair.');
          assert.deepEqual(counts,expectedCounts,'Exact cumulative and last work counters on each corpus pair.');
          return actual;
        } finally {setProbe(probe);}
      }; setProbe(probe);`
          : `setProbe(backend.${fitting ? 'fit' : offset ? 'verify' : 'cast'});`
      }
      afterEach(() => {backend.dispose(); ${clipping ? 'assert.equal(kernel.stats().results, 0); assert.equal(kernel.stats().hits, 0);' : fitting ? 'assert.equal(kernel.stats().results, 0); assert.equal(kernel.stats().pieces, 0);' : 'assert.equal(kernel.stats().paths, 0);'} assert.equal(kernel.stats().bufferBytes, 0);});
      after(() => {backend.dispose(); console.log('Retained ${clipping ? 'clipping' : fitting ? 'offset fitting' : offset ? 'offset verification' : 'ray'} corpus:', JSON.stringify(backend.stats()));});
      ${tests.map((name) => `await import(${JSON.stringify('./tests/' + name)});`).join('\n')}
    `,
    resolveDir: repo,
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  packages: 'external',
  outfile: output,
  plugins: [
    clipping
      ? clipComparisonPlugin()
      : fitting
        ? offsetFitComparisonPlugin()
        : offset
          ? offsetErrorComparisonPlugin()
          : rayComparisonPlugin(),
    {
      name: 'ray-corpus-fixtures',
      setup(builder) {
        builder.onResolve({ filter: /^geometry-ray-corpus:kernel$/ }, () => ({
          path: join(
            repo,
            `packages/node-shell/src/geometry-${clipping ? 'clipping' : fitting ? 'fitting' : 'kernel'}-node.ts`
          ),
          external: true,
        }));
        builder.onLoad(
          { filter: /tests\/geom-(coincident-repeats|work-budget|portable-math)\.test\.ts$/ },
          (args) => ({
            contents: readFileSync(args.path, 'utf8').replaceAll(
              'import.meta.url',
              JSON.stringify(pathToFileURL(args.path).href)
            ),
            loader: 'ts',
            resolveDir: dirname(args.path),
          })
        );
      },
    },
  ],
});
const result = spawnSync(process.execPath, ['--test', output], { cwd: repo, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
