// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BrowserJobQueue, BrowserQueueFullError, BrowserQueueTimeoutError, browserQueueOptions,
} from '../src/browser-jobs.ts';

const deferred = () => {
  let resolve!: () => void;
  return { promise: new Promise<void>((done) => { resolve = done; }), resolve };
};

test('browser jobs never exceed concurrency and start queued work FIFO', async () => {
  const queue = new BrowserJobQueue({ maxConcurrent: 1, maxQueued: 2, waitTimeoutMs: 1_000 });
  const first = deferred();
  const order: string[] = [];
  const a = queue.run(async () => { order.push('a:start'); await first.promise; order.push('a:end'); });
  const b = queue.run(async () => { order.push('b'); });
  const c = queue.run(async () => { order.push('c'); });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual({ active: queue.active, queued: queue.queued, order }, { active: 1, queued: 2, order: ['a:start'] });
  first.resolve();
  await Promise.all([a, b, c]);
  assert.deepEqual(order, ['a:start', 'a:end', 'b', 'c']);
});

test('browser queue refuses overflow and times out a stale waiter', async () => {
  const queue = new BrowserJobQueue({ maxConcurrent: 1, maxQueued: 1, waitTimeoutMs: 5 });
  const first = deferred();
  const active = queue.run(() => first.promise);
  const timed = queue.run(async () => {});
  await assert.rejects(queue.run(async () => {}), BrowserQueueFullError);
  await assert.rejects(timed, BrowserQueueTimeoutError);
  first.resolve();
  await active;
});

test('browser queue configuration is bounded and defaults conservatively', () => {
  assert.deepEqual(browserQueueOptions({}), { maxConcurrent: 2, maxQueued: 16, waitTimeoutMs: 30_000 });
  assert.throws(() => browserQueueOptions({ LOLLY_BROWSER_MAX_CONCURRENCY: '0' }), /between 1 and 32/);
  assert.throws(() => browserQueueOptions({ LOLLY_BROWSER_MAX_QUEUE: '1001' }), /between 1 and 1000/);
});
