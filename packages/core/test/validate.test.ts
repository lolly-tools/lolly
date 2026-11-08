// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateTool, defineTool } from '../src/index.ts';

test('validateTool accepts a well-formed manifest', () => {
  const manifest = defineTool({
    id: 'demo-tool',
    name: 'Demo Tool',
    version: '1.0.0',
    engineVersion: '1.0.0',
    status: 'community',
    render: { width: 100, height: 100, formats: ['svg'] },
    inputs: [{ id: 'a', type: 'text' }],
  });
  const result = validateTool(manifest);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('validateTool reports missing required fields with a path', () => {
  const result = validateTool({ name: 'No Id Here' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.some((e) => /required/.test(e.message)));
});

test('validateTool rejects an unknown status', () => {
  const result = validateTool({
    id: 'demo-tool',
    name: 'Demo Tool',
    version: '1.0.0',
    engineVersion: '1.0.0',
    status: 'gold-plated',
    render: { width: 1, height: 1, formats: ['svg'] },
    inputs: [],
  });
  assert.equal(result.valid, false);
});

test('the bundled example tool validates', () => {
  const path = fileURLToPath(new URL('../examples/hello-badge/tool.json', import.meta.url));
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  const result = validateTool(manifest);
  assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
});

test('renditionOf names a top-level asset input and one of the rendition actions', () => {
  const base = {
    id: 'demo-tool', name: 'Demo Tool', version: '1.0.0', engineVersion: '1.0.0', status: 'community',
    render: { width: 1, height: 1, formats: ['png'] },
    inputs: [{ id: 'image', type: 'asset' }, { id: 'caption', type: 'text' }],
  };
  assert.equal(validateTool({ ...base, renditionOf: { input: 'image', action: 'c2pa.filtered' } }).valid, true);
  const notAsset = validateTool({ ...base, renditionOf: { input: 'caption', action: 'c2pa.filtered' } });
  assert.deepEqual(notAsset.errors.map((e) => e.path), ['/renditionOf/input']);
  assert.equal(validateTool({ ...base, renditionOf: { input: 'missing', action: 'c2pa.filtered' } }).valid, false);
  assert.equal(validateTool({ ...base, renditionOf: { input: 'image', action: 'c2pa.created' } }).valid, false, 'a rendition is never a new file');
});
