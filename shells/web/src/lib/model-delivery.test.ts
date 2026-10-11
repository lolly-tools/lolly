// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { downloadVerifiedModel, verifyModelBytes } from './model-delivery.ts';
import { modelDirectoryId, modelFile, modelCacheUrl, modelNetworkUrl, configureTransformerDelivery } from './model-manifest.ts';

const bytes = new TextEncoder().encode('abcdefghij');
const file = { url: '/models/example/model.onnx', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
class MemoryCache {
  entries = new Map<string, Response>();
  async match(key: string) { return this.entries.get(key)?.clone(); }
  async put(key: string, response: Response) { this.entries.set(key, response.clone()); }
  async delete(key: string) { return this.entries.delete(key); }
}
const cacheAsApi = (cache: MemoryCache) => cache as unknown as Cache;
function interrupted(tag = '"same-entity"'): Response {
  let read = 0;
  return new Response(new ReadableStream({ pull(controller) { if (read++ === 0) controller.enqueue(bytes.slice(0, 5)); else controller.error(new Error('connection lost')); } }), { headers: { etag: tag } });
}
test('full sha256 checks decoded bytes and detects same-size corruption', async () => {
  assert.equal(await verifyModelBytes(bytes.buffer, file), true);
  assert.equal(await verifyModelBytes(new TextEncoder().encode('0123456789').buffer, file), false);
});
test('interrupted identity transfer resumes with Range and If-Range, then verifies the whole file', async () => {
  const cache = new MemoryCache(); let calls = 0;
  const fetcher: typeof fetch = async (_input, init) => {
    if (++calls === 1) return interrupted();
    assert.deepEqual(init?.headers, { range: 'bytes=5-', 'if-range': '"same-entity"' });
    return new Response(bytes.slice(5), { status: 206, headers: { etag: '"same-entity"', 'content-range': 'bytes 5-9/10' } });
  };
  await assert.rejects(downloadVerifiedModel(file, 'https://models.test/model', { partialCache: cacheAsApi(cache), fetcher }), /connection lost/);
  assert.equal((await cache.match('https://models.test/model'))?.headers.get('etag'), '"same-entity"');
  const result = await downloadVerifiedModel(file, 'https://models.test/model', { partialCache: cacheAsApi(cache), fetcher });
  assert.deepEqual(new Uint8Array(result.bytes), bytes); assert.equal(cache.entries.size, 0);
});
test('a server ignoring If-Range replaces the prefix; a weak ETag never permits resume', async () => {
  const cache = new MemoryCache(); const url = 'https://models.test/model';
  await cache.put(url, new Response(bytes.slice(0, 5), { headers: { etag: '"old"', 'x-lolly-model-sha256': file.sha256 } }));
  const result = await downloadVerifiedModel(file, url, { partialCache: cacheAsApi(cache), fetcher: async () => new Response(bytes, { headers: { etag: '"new"' } }) });
  assert.deepEqual(new Uint8Array(result.bytes), bytes);
  await assert.rejects(downloadVerifiedModel(file, url, { partialCache: cacheAsApi(cache), fetcher: async () => interrupted('W/"weak"') }), /connection lost/);
  assert.equal(cache.entries.size, 0);
});
test('a poisoned prefix is detected and retried from zero; malformed or encoded 206 is refused', async () => {
  const cache = new MemoryCache(); const url = 'https://models.test/model';
  await cache.put(url, new Response('XXXXX', { headers: { etag: '"same-entity"', 'x-lolly-model-sha256': file.sha256 } }));
  let calls = 0;
  const result = await downloadVerifiedModel(file, url, { partialCache: cacheAsApi(cache), fetcher: async (_input, init) => {
    if (++calls === 1) return new Response(bytes.slice(5), { status: 206, headers: { etag: '"same-entity"', 'content-range': 'bytes 5-9/10' } });
    assert.deepEqual(init?.headers, {}); return new Response(bytes);
  } });
  assert.equal(calls, 2); assert.deepEqual(new Uint8Array(result.bytes), bytes);
  const invalid: Record<string, string>[] = [{ 'content-range': 'bytes 4-9/10' }, { 'content-range': 'bytes 5-9/10', 'content-encoding': 'gzip' }];
  for (const extra of invalid) {
    await cache.put(url, new Response(bytes.slice(0, 5), { headers: { etag: '"same-entity"', 'x-lolly-model-sha256': file.sha256 } }));
    await assert.rejects(downloadVerifiedModel(file, url, { partialCache: cacheAsApi(cache), fetcher: async () => new Response(bytes.slice(5), { status: 206, headers: { etag: '"same-entity"', ...extra } }) }), /Invalid model range/);
    assert.equal(cache.entries.size, 0);
  }
});
test('model IDs and current cache keys use real hashed family directories', () => {
  for (const id of ['kokoro', 'whisper', 'reword/smollm2-360m-instruct', 'ai-detect/e5-small-ai-detector', 'embed']) {
    const resolved = modelDirectoryId(id); assert.match(resolved, /^\/models\/[a-z0-9-]+@[a-f0-9]{16}(\/.*)?$/);
    const original = `/models/${id}/config.json`, descriptor = modelFile(original)!;
    assert.ok(descriptor); assert.equal(modelNetworkUrl(original), descriptor.immutableUrl);
    assert.equal(modelCacheUrl(descriptor.immutableUrl!), descriptor.immutableUrl);
  }
});
test('transformer delivery installs verified custom caching without opening the remote Hub', () => {
  const env = { fetch: async () => new Response(), useCustomCache: false, customCache: null as unknown, useBrowserCache: true };
  configureTransformerDelivery(env);
  assert.equal(env.useCustomCache, true); assert.equal(env.useBrowserCache, false);
  assert.equal(typeof (env.customCache as { match: unknown }).match, 'function');
});
