// SPDX-License-Identifier: MPL-2.0
/** Same-format file variants never share their byte cache or survive a changed source URL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetsAPI, type AssetMetaRecord } from './assets.ts';
const id = 'ext/brand/cache-example', first = 'a'.repeat(24), second = 'b'.repeat(24);
const formats = [{ format: 'jpeg', url: `/catalog/${id}/wide` }, { format: 'jpeg', url: `/catalog/${id}/square` }];
const meta: AssetMetaRecord = { id, type: 'raster', version: '1', tier: 'on-demand', formats,
  meta: { assetFiles: [{ id: first, ...formats[0], name: 'Wide.jpg' }, { id: second, ...formats[1], name: 'Square.jpg' }] } };
test('two JPEG attachments load, cache and expire independently', async t => {
  const stores = new Map<string, Map<string, unknown>>([['asset-meta', new Map([[id, meta]])], ['asset-blob', new Map()]]);
  const db = { get: async (store: string, key: string) => stores.get(store)?.get(key),
    getAll: async (store: string) => [...stores.get(store)?.values() ?? []],
    put: async (store: string, value: unknown, key: string) => { stores.get(store)?.set(key, value); },
    delete: async (store: string, key: string) => { stores.get(store)?.delete(key); },
    transaction: () => ({ store: { put: async (value: AssetMetaRecord) => { stores.get('asset-meta')!.set(value.id, value); } }, done: Promise.resolve() }) };
  let reads = 0;
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => { reads++; return new Response(String(url).includes('square') ? 'square bytes' : 'wide bytes'); });
  const assets = createAssetsAPI(db as never);
  const a = await assets._getBlob(`${id}?file=${first}`, { fetchIfMissing: true });
  await assets.get(`${id}?file=${second}`);
  const b = await assets._getBlob(`${id}?file=${second}`, { fetchIfMissing: true });
  assert.equal(await a?.text(), 'wide bytes'); assert.equal(await b?.text(), 'square bytes'); assert.equal(reads, 2);
  assert.equal(await (await assets._getBlob(`${id}?file=${second}`, { fetchIfMissing: true }))?.text(), 'square bytes'); assert.equal(reads, 2);
  assert.equal(stores.get('asset-blob')!.size, 2);
  await assets._syncFromIndex([{ ...meta, formats: formats.map(f => ({ ...f, url: f.url + '-new' })) }]);
  assert.equal(stores.get('asset-blob')!.size, 0);
  assert.equal(await assets._getBlob(`${id}?file=${'c'.repeat(24)}`, { fetchIfMissing: true }), null);
});
