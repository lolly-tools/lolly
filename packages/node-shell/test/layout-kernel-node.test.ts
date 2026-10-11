// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { build } from 'esbuild';
import type { LayoutRequest, LayoutSolver } from '../../../engine/src/design-layout.ts';

for (const [name, entry, assets] of [
  ['serverless', 'api/mcp/layout.mjs', 'packages/node-shell/wasm/layout-kernel'],
  ['installed CLI', 'dist/layout.mjs', 'wasm/layout-kernel'],
] as const) test(`a relocated ${name} bundle loads its included layout kernel and solves geometry`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lolly-layout-bundle-'));
  try {
    const bundle = join(root, entry);
    const wasmDir = join(root, assets);
    await mkdir(wasmDir, { recursive: true });
    await cp(new URL('../wasm/layout-kernel/layout-kernel.wasm', import.meta.url), join(wasmDir, 'layout-kernel.wasm'));
    const source = fileURLToPath(new URL('../src/layout-kernel-node.ts', import.meta.url));
    await build({
      stdin: { contents: `export { loadLayoutKernel } from ${JSON.stringify(source)};`, loader: 'ts', resolveDir: dirname(source) },
      bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: bundle,
    });
    const { loadLayoutKernel } = await import(pathToFileURL(bundle).href) as { loadLayoutKernel(): Promise<LayoutSolver> };
    const corpus = JSON.parse(await readFile(new URL('../wasm/layout-kernel/fixtures/modern-layout.json', import.meta.url), 'utf8')) as {
      cases: { request: LayoutRequest; expected: unknown }[];
    };
    const solve = await loadLayoutKernel();
    assert.deepEqual(solve(corpus.cases[0]!.request), corpus.cases[0]!.expected);
    await rm(wasmDir, { recursive: true });
    await assert.rejects(loadLayoutKernel, /layout kernel is not installed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
