// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { Resvg } from '@resvg/resvg-js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTool, createRuntime } from '@lolly/engine';
import { createCliBridge } from '../../cli/src/bridge.ts';
import { exportToFile, setDocumentTokenSelection } from './engine-render.ts';

test('native export CSS follows document colourway changes and resetting to the default', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-colourway-export-'));
  const dom = new JSDOM('<!doctype html><div id="canvas"></div>');
  const prior = process.env.LOLLY_STATE_DIR;
  process.env.LOLLY_STATE_DIR = join(dir, 'state');
  try {
    const tokens = {
      day: { color: { semantic: { primary: { $type: 'color', $value: '#30ba78' } } } },
      night: { color: { semantic: { primary: { $type: 'color', $value: '#00d5e5' } } } },
      $themes: [
        { id: 'day', name: 'Day', group: 'colourway', selectedTokenSets: { day: 'enabled' } },
        { id: 'night', name: 'Night', group: 'colourway', selectedTokenSets: { night: 'enabled' } },
      ],
      $metadata: { activeThemeSelection: { colourway: 'day' } },
    };
    const host = await createCliBridge({ dom, catalogAssets: [], tokensDocument: tokens });
    const manifest = {
      id: 'colourway-fixture',
      name: 'Colourway fixture',
      status: 'community',
      version: '1.0.0',
      engineVersion: '^1.0.0',
      inputs: [],
      render: { formats: ['svg'], width: 100, height: 40, c2pa: false },
    };
    const tool = await loadTool(manifest.id, async (path) =>
      path.endsWith('tool.json')
        ? JSON.stringify(manifest)
        : path.endsWith('template.html')
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="var(--brand-primary)"/></svg>'
          : ''
    );
    const runtime = await createRuntime(tool, host, {});
    const path = join(dir, 'fixture.svg');
    await setDocumentTokenSelection(runtime, host, { colourway: 'night' });
    await exportToFile(runtime, dom, tool.manifest, 'svg', path, { madeWith: false });
    const night = await readFile(path, 'utf8');
    assert.match(night, /#00d5e5/i);
    assert.deepEqual([...new Resvg(night).render().pixels.subarray(0, 4)], [0, 213, 229, 255]);
    await setDocumentTokenSelection(runtime, host, {});
    await exportToFile(runtime, dom, tool.manifest, 'svg', path, { madeWith: false });
    const day = await readFile(path, 'utf8');
    assert.match(day, /#30ba78/i);
    assert.deepEqual([...new Resvg(day).render().pixels.subarray(0, 4)], [48, 186, 120, 255]);
    runtime.destroy();
  } finally {
    dom.window.close();
    if (prior === undefined) delete process.env.LOLLY_STATE_DIR;
    else process.env.LOLLY_STATE_DIR = prior;
    await rm(dir, { recursive: true, force: true });
  }
});
