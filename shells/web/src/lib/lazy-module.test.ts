// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lazyModule } from './lazy-module.ts';

test('concurrent and later callers share one module load', async () => {
  let calls = 0;
  let finish!: (value: object) => void;
  const module = {};
  const load = lazyModule(() => {
    calls++;
    return new Promise<object>(resolve => { finish = resolve; });
  });
  assert.equal(calls, 0, 'creating a loader keeps the module lazy');
  const first = load();
  assert.equal(load(), first);
  await Promise.resolve();
  assert.equal(calls, 1);
  finish(module);
  assert.equal(await first, module);
  assert.equal(load(), first);
  assert.equal(await load(), module);
  assert.equal(calls, 1);
});

test('a rejected load can retry, including a synchronous loader failure', async () => {
  let calls = 0;
  const module = {};
  const load = lazyModule(() => {
    calls++;
    if (calls === 1) throw new Error('First load failed');
    if (calls === 2) return Promise.reject(new Error('Second load failed'));
    return Promise.resolve(module);
  });
  const first = load();
  assert.equal(load(), first);
  await assert.rejects(first, /First load failed/);
  await assert.rejects(load(), /Second load failed/);
  assert.equal(await load(), module);
  assert.equal(await load(), module);
  assert.equal(calls, 3);
});
