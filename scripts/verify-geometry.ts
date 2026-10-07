// SPDX-License-Identifier: MPL-2.0
/** Geometry qualification requires the TypeScript reference, WASM corpus and a real browser worker. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const files = [
    'tests/geom-bezier.test.ts',
    'tests/geom-nearest-cache.test.ts',
    'tests/geom-near-pieces.test.ts',
    'tests/geom-roots.test.ts',
    'tests/geom-ray-cast.test.ts',
    'packages/node-shell/test/geometry-kernel.test.ts',
    'packages/node-shell/test/geometry-spatial.test.ts',
    'packages/node-shell/test/geometry-roots.test.ts',
    'packages/node-shell/test/geometry-ray.test.ts',
    'packages/node-shell/test/geometry-ray-workflows.test.ts',
    'packages/node-shell/test/geometry-offset-error.test.ts',
    'packages/node-shell/test/geometry-offset-fit.test.ts',
    'packages/node-shell/test/geometry-portable-fit.test.ts',
    'packages/node-shell/test/geometry-clipping.test.ts',
    'packages/node-shell/test/geometry-operation-scope.test.ts',
    'packages/node-shell/test/geometry-host.test.ts',
    'packages/node-shell/test/geometry-host-norm.test.ts',
    'packages/node-shell/test/geometry-policy.test.ts',
    'tests/geometry-host.test.ts',
    'tests/geometry-kernel.browser.test.ts',
    'tests/geometry-offset-fit.browser.test.ts',
    'tests/geometry-portable-fit.browser.test.ts',
    'tests/geometry-clipping.browser.test.ts',
    'tests/geometry-operation-scope.browser.test.ts',
    'tests/geometry-host.browser.test.ts',
    'tests/geometry-host-norm.browser.test.ts',
  ];
const options = {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    stdio: 'inherit' as const,
    env: { ...process.env, LOLLY_GEOMETRY_REQUIRED: '1', LOLLY_GEOMETRY_BROWSER: process.env.LOLLY_GEOMETRY_BROWSER ?? 'chromium' },
  };
const focused = spawnSync(process.execPath, ['--test', ...files.filter(file => !file.includes('.browser.'))], options);
// Large browser corpora share CPU; serial files keep their unchanged wall-clock limits meaningful.
const result = focused.status === 0
  ? spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files.filter(file => file.includes('.browser.'))], options)
  : focused;
if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
else {
  const corpus = spawnSync(process.execPath, ['scripts/verify-geometry-ray-corpus.ts'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    stdio: 'inherit',
  });
  if (corpus.error) throw corpus.error;
  process.exitCode = corpus.status ?? 1;
  if (corpus.status === 0) {
    const verification = spawnSync(
      process.execPath,
      ['scripts/verify-geometry-ray-corpus.ts', '--offset-error'],
      {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        stdio: 'inherit',
      }
    );
    if (verification.error) throw verification.error;
    process.exitCode = verification.status ?? 1;
    if (verification.status === 0) {
      const fitting = spawnSync(
        process.execPath,
        ['scripts/verify-geometry-ray-corpus.ts', '--offset-fit'],
        {
          cwd: fileURLToPath(new URL('../', import.meta.url)),
          stdio: 'inherit',
        }
      );
      if (fitting.error) throw fitting.error;
      process.exitCode = fitting.status ?? 1;
      if (fitting.status === 0) {
        const portable = spawnSync(
          process.execPath,
          ['scripts/verify-geometry-ray-corpus.ts', '--portable-math'],
          { cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit' }
        );
        if (portable.error) throw portable.error;
        process.exitCode = portable.status ?? 1;
        if (portable.status === 0) {
          const clipping = spawnSync(
            process.execPath,
            ['scripts/verify-geometry-ray-corpus.ts', '--clipping'],
            { cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit' }
          );
          if (clipping.error) throw clipping.error;
          process.exitCode = clipping.status ?? 1;
        }
      }
    }
  }
}
