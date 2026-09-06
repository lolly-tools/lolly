// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveToolBundle } from './tool-bundle.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';

test('unsigned tool bundles carry recursive literal media/library dependencies and refuse missing required files', async () => {
  const previous = globalThis.fetch;
  const source = new Map([
    ['tool.json', '{"id":"demo"}'], ['template.html', '<img src="/tools/demo/assets/photo.svg">'],
    ['hooks.js', 'var library = "/tools/demo/lib/draw.js";'],
    ['lib/draw.js', 'var art = "/tools/demo/assets/second.svg";'],
    ['assets/photo.svg', '<svg/>'], ['assets/second.svg', '<svg/>'],
  ]);
  globalThis.fetch = async input => {
    const path = String(input).split('/tools/demo/')[1] ?? '';
    const body = source.get(path);
    return new Response(body ?? '', { status: body ? 200 : 404, headers: { 'content-type': path.endsWith('.html') ? 'text/html' : 'text/plain' } });
  };
  const manifest = { id: 'demo', hooks: { file: 'hooks.js' } } as unknown as ToolManifest;
  try {
    const result = await resolveToolBundle('demo', manifest);
    assert.ok(result); assert.equal(result.trust, 'custom');
    assert.ok(result.files['assets/photo.svg']); assert.ok(result.files['lib/draw.js']); assert.ok(result.files['assets/second.svg']);
    source.delete('assets/second.svg');
    assert.equal(await resolveToolBundle('demo', manifest), null, 'do not claim a selected tool is portable when a known dependency is missing');
    source.set('assets/second.svg', '<svg/>'); source.delete('hooks.js');
    assert.equal(await resolveToolBundle('demo', manifest), null);
  } finally { globalThis.fetch = previous; }
});
