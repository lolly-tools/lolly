// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime, DOCUMENT_API_VERSION, diffDocuments, documentSchema, isProviderRef, measureDocument, packageDocument, parseProviderRef, readZip, validateDocument } from '../engine/src/index.ts';

const manifest = { id: 'card', name: 'Card', version: '1', engineVersion: '*', description: '', status: 'official', category: 'test', inputs: [{ id: 'title', type: 'text', label: 'Title', default: '' }], render: { formats: ['svg'], width: 640, height: 320 } } as any;
const doc = (values: Record<string, unknown>, html = '<svg id="canvas"/>') => ({ apiVersion: DOCUMENT_API_VERSION, toolId: 'card', toolVersion: '1', manifest, model: [], values, hydrated: html, styles: null } as any);

test('provider refs parse without resolving IO', () => {
  assert.deepEqual(parseProviderRef('cms://products/123?size=2'), { raw: 'cms://products/123?size=2', provider: 'cms', scope: 'products', path: '123', query: { size: '2' } });
  assert.equal(isProviderRef('https://example.test/a'), true);
  assert.equal(parseProviderRef('not a ref'), null);
});

test('runtime delegates logical providers without intercepting ordinary asset URLs', async () => {
  const tool = {
    manifest: { ...manifest, inputs: [{ id: 'image', type: 'asset', label: 'Image', default: null }] },
    template: '<svg><image href="{{image.url}}"/></svg>',
  } as any;
  const providerCalls: string[] = [];
  const getCalls: string[] = [];
  const asset = (id: string) => ({ source: 'remote', id, type: 'raster', format: 'png', url: `resolved:${id}` });
  const host = {
    version: '1', profile: { get: async () => ({}) }, log: () => {},
    assets: {
      resolveProvider: async (ref: { raw: string }) => { providerCalls.push(ref.raw); return asset(ref.raw); },
      get: async (id: string) => { getCalls.push(id); return asset(id); },
    },
  } as any;
  const logical = await createRuntime(tool, host, { image: 'cms://products/123' });
  assert.equal((logical.getModel()[0]!.value as any).url, 'resolved:cms://products/123');
  logical.destroy();
  const direct = await createRuntime(tool, host, { image: 'https://assets.example/image.png' });
  assert.equal((direct.getModel()[0]!.value as any).url, 'resolved:https://assets.example/image.png');
  direct.destroy();
  assert.deepEqual(providerCalls, ['cms://products/123']);
  assert.deepEqual(getCalls, ['https://assets.example/image.png']);
});

test('document schema and validation expose typed inputs', () => {
  const schema = documentSchema(manifest) as any;
  assert.equal(schema.properties.title.type, 'string');
  assert.equal(validateDocument({ kind: 'inputs', manifest, value: { title: 'Hello' } }).ok, true);
  assert.equal(validateDocument({ kind: 'inputs', manifest, value: { typo: true } }).ok, false);
});

test('validation admits only manifest-declared empty sentinels', () => {
  const canvasManifest = {
    ...manifest,
    inputs: [{
      id: 'boxes', type: 'blocks', default: [], fields: [
        { id: 'start', type: 'number', default: '' },
        { id: 'enabled', type: 'boolean', default: '' },
        { id: 'width', type: 'number', default: 100 },
      ],
    }],
  } as any;
  const schema = documentSchema(canvasManifest) as any;
  assert.ok(Array.isArray(schema.properties.boxes.items.properties.start.anyOf));
  assert.equal(validateDocument({
    kind: 'inputs', manifest: canvasManifest,
    value: { boxes: [{ start: '', enabled: '', width: 10 }] },
  }).ok, true);
  const invalid = validateDocument({
    kind: 'inputs', manifest: canvasManifest,
    value: { boxes: [{ width: '' }] },
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors[0]!.path, '/boxes/0/width');
});

test('semantic diff and measurement do not rasterize', () => {
  assert.deepEqual(diffDocuments(doc({ title: 'a' }), doc({ title: 'b' })).inputs.changed, ['title']);
  assert.deepEqual(diffDocuments(doc({ product: { id: 1, name: 'mug' } }), doc({ product: { name: 'mug', id: 1 } })).inputs.changed, [], 'object key order is not a semantic change');
  assert.deepEqual(diffDocuments('?a=1', '?a=2&b=3').inputs, { added: ['b'], changed: ['a'], removed: [] });
  assert.deepEqual(measureDocument(doc({})), { width: 640, height: 320, unit: 'px', dpi: 96, boxes: 1, assets: [], bytes: 18, assetBytes: 0 });
});

test('semantic document details include changed boxes, tokens and asset weight', () => {
  const image = { source: 'remote', id: 'cms://dam/logo', type: 'raster', format: 'png', url: 'data:image/png;base64,AQID' };
  const a = { ...doc({ color: { ref: '{color.brand}', value: '#000' } }, '<svg id="canvas" fill="#000"/>'), model: [{ id: 'image', type: 'asset', value: image }, { id: 'color', type: 'color', value: { ref: '{color.brand}', value: '#000' } }] } as any;
  const b = { ...a, hydrated: '<svg id="canvas" fill="#fff"/>', tokens: { color: { ref: '{color.brand}', value: '#fff' } } };
  a.tokens = { color: { ref: '{color.brand}', value: '#000' } };
  assert.deepEqual(diffDocuments(a, b).boxes.changed, ['canvas']);
  assert.deepEqual(diffDocuments(a, b).tokens.changed, ['color']);
  assert.deepEqual(measureDocument(a).assets, [{ id: 'cms://dam/logo', bytes: 3 }]);
  assert.equal(measureDocument(a).assetBytes, 3);
});

test('package emits a real .lolly zip envelope', async () => {
  const packed = await packageDocument(doc({ title: 'hello' }));
  assert.deepEqual([...packed.bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.deepEqual(readZip(packed.bytes).map((entry) => entry.name).sort(), ['README.txt', 'manifest.json', 'session.json']);
});
