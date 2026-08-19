// SPDX-License-Identifier: MPL-2.0
/**
 * darkroom layered-mode contract tests (the plan-106 Layers fold).
 *
 * Run with: node --test tests/darkroom-layers.test.ts
 *
 * Loads the REAL tool straight from community/darkroom and drives it through
 * the engine with a stubbed host - only the host is stubbed; the code under
 * test is the shipped manifest + hooks. Guards:
 *   - the manifest carries the retired Layers tool's wire contract: the
 *     `layers` blocks input keeps urlKey `l` and the append-only field order
 *     (the byte-level pin lives in shells/web/src/lib/blocks-url.test.ts),
 *   - the template offers the PSD rebuild only in layered mode,
 *   - headless exportFile degradation: no host.layers → the feature-detect
 *     error, no decodable pixels → the honest "couldn't read layers back"
 *     error (never a half-written PSD).
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

assert.ok(existsSync(join(TOOLS_DIR, 'darkroom', 'tool.json')),
  'community/darkroom/tool.json is missing — the tool was renamed or deleted');

const tool: any = await loadTool('darkroom', fetchFile);

const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  img: { source: 'library', id: 'user/upload/1-l0.png', url: 'blob:l0' },
  x: 0, y: 0, o: 100, v: true, b: '', n: '', g: '',
  ...over,
});

test('manifest keeps the Layers wire contract', () => {
  const layers = tool.manifest.inputs.find((i: any) => i.id === 'layers');
  assert.ok(layers, 'the layers blocks input folded in from layer-stack');
  assert.equal(layers.type, 'blocks');
  assert.equal(layers.urlKey, 'l', 'compact URL key — every old layer-stack link depends on it');
  // Append-only forever: reordering or renaming any of these corrupts every
  // shared/bookmarked layered URL in existence.
  assert.deepEqual(layers.fields.map((f: any) => f.id), ['img', 'x', 'y', 'o', 'v', 'b', 'n', 'g']);
  assert.equal(tool.manifest.hooks.exportFile, true, 'the layered PSD export is declared');
});

test('template offers the PSD rebuild only in layered mode', async () => {
  const layered: any = await createRuntime(tool, baseHost() as any, { layers: [row()] } as any);
  assert.match(layered.getHydrated(), /data-export-file/, 'layered mode shows the PSD button');

  const plain: any = await createRuntime(tool, baseHost() as any, {} as any);
  assert.doesNotMatch(plain.getHydrated(), /data-export-file/, 'no layers, no PSD button');
});

test('headless exportFile degrades with clear errors, never a crash', async () => {
  // No host.layers at all → the feature-detect message.
  const bare: any = await createRuntime(tool, baseHost() as any, { layers: [row()] } as any);
  await assert.rejects(() => bare.exportFile(), /isn.t available/);

  // host.layers present but nothing to decode pixels with headlessly → the
  // honest "couldn't read layers back" error.
  const withLayers = baseHost({
    layers: { writePsd: async () => new Uint8Array([1]) },
  });
  const rt: any = await createRuntime(tool, withLayers as any, { layers: [row()] } as any);
  await assert.rejects(() => rt.exportFile(), /could be read back/);
});
