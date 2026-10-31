// SPDX-License-Identifier: MPL-2.0
/**
 * `/tools/<tool-id>/assets/<file>` as an asset id: a picture a tool ships in its own
 * folder (packages/node-shell/src/tool-asset-id.ts). Example looks name their
 * pictures this way so the catalog index, the slim index and the preview bundle
 * carry a short path rather than the picture's bytes.
 *
 *  - the grammar is one file directly in a tool's assets folder, with a picture
 *    extension, and nothing that could leave that folder;
 *  - the Node shells' bridge (the CLI's, which the TUI and the MCP server reuse)
 *    reads the file from the active profile's tool folder as a data: URL, and a
 *    file that is not there is an error the runtime turns into a dropped asset.
 *
 * The web shell's half (shells/web/src/bridge/assets.ts) reads the same path
 * through its verified catalog fetch; the gallery render of Logo Wall's example
 * look is where that half runs.
 *
 * Run with: node --test tests/tool-asset-id.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { parseToolAssetId } from '../packages/node-shell/src/tool-asset-id.ts';
import { createCliBridge } from '../shells/cli/src/bridge.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE = join(ROOT, 'community', 'flythrough', 'assets', 'sample.svg');

test('the grammar names one picture in a tool\'s own assets folder', () => {
  assert.deepEqual(parseToolAssetId('/tools/logo-wall/assets/your-logo.svg'),
    { toolId: 'logo-wall', file: 'your-logo.svg', type: 'vector', format: 'svg', mime: 'image/svg+xml' });
  assert.deepEqual(parseToolAssetId('/tools/frame/assets/photo.JPEG'),
    { toolId: 'frame', file: 'photo.JPEG', type: 'raster', format: 'jpg', mime: 'image/jpeg' });
  for (const id of [
    '/tools/logo-wall/assets/../tool.json',
    '/tools/logo-wall/assets/sub/your-logo.svg',
    '/tools/logo-wall/hooks.js',
    '/tools/logo-wall/assets/your-logo.svg?v=2',
    '/tools/logo-wall/assets/.hidden.svg',
    '/tools/logo-wall/assets/script.js',
    'tools/logo-wall/assets/your-logo.svg',
    'https://lolly.tools/tools/logo-wall/assets/your-logo.svg',
    'lolly/logo/primary',
    undefined,
  ]) assert.equal(parseToolAssetId(id), null, String(id));
});

test('the Node bridge reads a tool asset from the tool\'s folder', { skip: !existsSync(SAMPLE) && 'flythrough is not mounted' }, async () => {
  const dom = new JSDOM();
  try {
    const host = await createCliBridge({ dom: dom as never, aiEnabled: false });
    const ref = await host.assets.get('/tools/flythrough/assets/sample.svg');
    assert.equal(ref.type, 'vector');
    assert.equal(ref.format, 'svg');
    assert.equal(ref.url, 'data:image/svg+xml;base64,' + readFileSync(SAMPLE).toString('base64'));
    await assert.rejects(host.assets.get('/tools/flythrough/assets/missing.svg'), /Tool asset not found/);
  } finally {
    dom.window.close();
  }
});
