// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { fetchAssetBytes, readMogrt } from './mogrt.ts';
const definition = {
  authorApp: 'aefx', capsuleName: 'Brand title',
  usedFontsLocalized: { en_US: ['SUSE', 'SUSE'] },
  clientControls: [{ uiName: { strDB: [{ localeString: 'en_US', str: 'Title' }] }, value: { strDB: [{ localeString: 'en_US', str: '<script>hello</script>' }] } }],
};
test('MOGRT preserves supplied previews and reads localized controls without interpreting markup', async () => {
  const result = readMogrt(zipSync({
    'definition.json': strToU8(JSON.stringify(definition)), 'thumb.mp4': new Uint8Array([1, 2, 3]),
    'thumb.png': new Uint8Array([4, 5]), 'project.aegraphic': new Uint8Array(1024 * 1024),
  }));
  assert.equal(result.name, 'Brand title');
  assert.deepEqual(result.fonts, ['SUSE']);
  assert.deepEqual(result.controls.map(({ name, value }) => ({ name, value })), [{ name: 'Title', value: '<script>hello</script>' }]);
  assert.deepEqual(new Uint8Array(await result.video!.arrayBuffer()), new Uint8Array([1, 2, 3]));
});
test('MOGRT refuses oversized preview members and malformed definitions; absent media stays absent', () => {
  assert.throws(() => readMogrt(zipSync({ 'definition.json': strToU8('{}') })), /valid MOGRT/);
  assert.throws(() => readMogrt(zipSync({ 'thumb.png': new Uint8Array(2 * 1024 * 1024 + 1) })), /too large/);
  assert.throws(() => readMogrt(zipSync({ 'definition.json': new Uint8Array(1024 * 1024 + 1) })), /too large/);
  const result = readMogrt(zipSync({ 'definition.json': strToU8(JSON.stringify(definition)) }));
  assert.equal(result.video, null); assert.equal(result.poster, null);
});
test('preview downloader bounds streamed bytes even without Content-Length', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(12)); c.close(); } }));
  try { await assert.rejects(fetchAssetBytes('https://example.test/file', 8, new AbortController().signal), /too large/); }
  finally { globalThis.fetch = original; }
});
