// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { matchesGlob } from 'node:path';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const { includeFiles, excludeFiles } = config.functions['api/mcp/**'];

test('MCP includes compressed emoji packs without also forcing raw bundles into the function', () => {
  // Vercel adds includeFiles before tracing; excludeFiles only filters the trace.
  // A broad community/** include therefore defeats the raw-bundle exclusion.
  assert.ok(includeFiles.length <= 256, 'Vercel limits function glob length');
  const names = readdirSync(new URL('../community/emoji-packs/', import.meta.url))
    .filter(name => name.endsWith('.json') && name !== 'index.json');
  assert.ok(names.length >= 7);
  for (const name of names) {
    const raw = `community/emoji-packs/${name}`;
    assert.equal(matchesGlob(raw, includeFiles), false, raw);
    assert.equal(matchesGlob(raw, excludeFiles), true, raw);
    assert.equal(matchesGlob(`${raw}.gz`, includeFiles), true, `${raw}.gz`);
    assert.equal(matchesGlob(`${raw}.gz`, excludeFiles), false, `${raw}.gz`);
  }
  for (const required of [
    'profiles.json', 'community/emoji-packs/index.json',
    'community/agenda/tool.json', 'community/agenda/presentation.js',
    'community/street-map/data/example.json', 'community/_shared/design-renderer.js',
    'brands/lolly-start/tools/voice-recorder/tool.json',
    'brands/lolly-start/catalog/assets/index.json', 'brands/lolly-start/catalog/fonts/ttf/example.ttf',
    'brands/lolly-start/catalog/tools/index.json', 'brands/lolly-start/catalog/previews/agenda.svg',
    'brands/lolly-start/catalog/previews/agenda.json', 'packages/node-shell/wasm/jxl/codec.wasm',
    'packages/node-shell/wasm/adobe-psd/adobe-psd.wasm',
    'packages/node-shell/wasm/adobe-psd/LICENSES.txt',
    'shells/web/public/fonts/SUSE[wght].ttf',
    'shells/web/public/fonts/SUSEMono[wght].ttf',
  ]) assert.equal(matchesGlob(required, includeFiles), true, required);
  assert.equal(matchesGlob('brands/suse/catalog/assets/index.json', includeFiles), false);
});
