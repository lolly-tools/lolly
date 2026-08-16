// SPDX-License-Identifier: MPL-2.0
/**
 * layer-stack tool contract tests.
 *
 * Run with: node --test tests/layer-stack-tool.test.ts
 *
 * Loads the REAL tool straight from community/layer-stack and drives it
 * through the engine with a stubbed host - only the host is stubbed; the code
 * under test is the shipped manifest + hooks. Guards:
 *   - the URL-string normalisation contract: a compact-decoded boolean arrives
 *     as the STRING 'false' (truthy!) and numbers as strings - the hook's view
 *     styles must treat them as their real types,
 *   - view styles: hidden → display:none, opacity/blend only when non-default,
 *   - headless exportFile degradation: no DOM Image → a clear error, and a
 *     host without host.layers → the feature-detect error,
 *   - the wire-format pin lives in shells/web/src/lib/blocks-url.test.ts.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const TOOLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(TOOLS_DIR, path), 'utf8');

assert.ok(existsSync(join(TOOLS_DIR, 'layer-stack', 'tool.json')),
  'community/layer-stack/tool.json is missing — the tool was renamed or deleted');

const tool = await loadTool('layer-stack', fetchFile);

const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  img: { source: 'library', id: 'user/upload/1-l0.png', url: 'blob:l0' },
  x: 0, y: 0, o: 100, v: true, b: '', n: '', g: '',
  ...over,
});

/** Mount and return the hydrated template's per-layer style strings, in order. */
async function mountStyles(layers: unknown[]): Promise<string[]> {
  const rt: any = await createRuntime(tool as any, baseHost() as any, { layers } as any);
  const html: string = rt.getHydrated();
  return [...html.matchAll(/class="layer"[^>]*style="([^"]*)"/g)].map((m) => m[1]!);
}

test('view styles: position, opacity, blend — and defaults cost nothing', async () => {
  const styles = await mountStyles([
    row({ x: -40, y: 128 }),
    row({ o: 45, b: 'multiply' }),
  ]);
  assert.equal(styles.length, 2, 'one img per layer row');
  assert.equal(styles[0], 'left:-40px;top:128px');
  assert.equal(styles[1], 'left:0px;top:0px;opacity:0.45;mix-blend-mode:multiply');
});

test('URL-string values normalise: the "false" string hides, numeric strings position', async () => {
  const styles = await mountStyles([
    row({ v: 'false' }),          // compact-URL boolean — truthy as a string!
    row({ x: '25', y: '-3', o: '80' }),
    row({ v: '0' }),
  ]);
  assert.equal(styles[0], 'display:none');
  assert.equal(styles[1], 'left:25px;top:-3px;opacity:0.8');
  assert.equal(styles[2], 'display:none');
});

test('headless exportFile degrades with clear errors, never a crash', async () => {
  // No host.layers at all → the feature-detect message.
  const bare: any = await createRuntime(tool as any, baseHost() as any, { layers: [row()] } as any);
  await assert.rejects(() => bare.exportFile(), /isn.t available/);

  // host.layers present but no DOM Image to decode pixels with → the honest
  // "couldn't read layers back" error (never a half-written PSD).
  const withLayers = baseHost({
    layers: { writePsd: async () => new Uint8Array([1]) },
  });
  const rt: any = await createRuntime(tool as any, withLayers as any, { layers: [row()] } as any);
  await assert.rejects(() => rt.exportFile(), /could be read back/);
});
