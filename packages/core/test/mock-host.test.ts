// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockHost } from '../src/index.ts';
import type { AssetRef } from '../src/index.ts';

test('state round-trips through the mock host', async () => {
  const host = createMockHost();
  await host.state.save('slot-1', { count: 3 });
  assert.deepEqual(await host.state.load('slot-1'), { count: 3 });
  assert.equal(await host.state.load('absent'), null);

  const list = await host.state.list();
  assert.equal(list.length, 1);
  assert.equal(list[0]?.slot, 'slot-1');

  await host.state.delete('slot-1');
  assert.equal(await host.state.load('slot-1'), null);
});

test('clipboard and log calls are captured for assertions', async () => {
  const host = createMockHost();
  await host.clipboard.writeText('hello');
  host.log('warn', 'careful now');
  assert.deepEqual(host.inspect.clipboardText, ['hello']);
  assert.equal(host.inspect.logs.at(-1)?.level, 'warn');
  assert.equal(host.inspect.logs.at(-1)?.msg, 'careful now');
});

test('assets get / query / pick honour the provided registry', async () => {
  const logo: AssetRef = {
    source: 'library',
    id: 'demo/logo',
    type: 'vector',
    format: 'svg',
    url: 'about:blank',
    meta: { tags: ['brand'] },
  };
  const host = createMockHost({ assets: { 'demo/logo': logo }, pick: logo });

  assert.equal((await host.assets.get('demo/logo')).id, 'demo/logo');
  assert.equal((await host.assets.query({ tags: ['brand'] })).length, 1);
  assert.equal((await host.assets.query({ tags: ['missing'] })).length, 0);
  assert.equal((await host.assets.query({ type: 'raster' })).length, 0);
  assert.equal((await host.assets.pick({}))?.id, 'demo/logo');
  await assert.rejects(() => host.assets.get('nope'));
});

test('export / file calls are recorded with byte counts', async () => {
  const host = createMockHost();
  await host.export.file(new Blob([new Uint8Array([1, 2, 3])]), { filename: 'out.bin' });
  const call = host.inspect.exports.at(-1);
  assert.equal(call?.kind, 'file');
  assert.equal(call?.filename, 'out.bin');
  assert.equal(call?.bytes, 3);
});
