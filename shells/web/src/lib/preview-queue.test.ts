// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreviewQueue } from './preview-queue.ts';

function fixture() {
  const pending = new Set<() => void>();
  const errors: unknown[] = [];
  const queue = createPreviewQueue(callback => {
    pending.add(callback);
    return () => { pending.delete(callback); };
  }, error => { errors.push(error); });
  const step = async () => {
    const callback = [...pending][0];
    assert.ok(callback, 'an idle job should be scheduled');
    pending.delete(callback);
    callback();
    await new Promise<void>(resolve => setImmediate(resolve));
  };
  const drain = async () => { while (pending.size) await step(); };
  return { queue, pending, errors, step, drain };
}

test('visible covers, then off-screen covers, precede every extra template across consumers', async () => {
  const f = fixture(), seen: string[] = [];
  const add = (name: string, priority: number) => f.queue.add({ priority: () => priority, run: async () => { seen.push(name); } });
  add('strip/template', 2); // the strip has already asked for an extra look
  add('grid/off-screen cover', 1);
  add('strip/cover', 0);
  add('grid/template', 2);
  add('grid/visible cover', 0);
  await f.drain();
  assert.deepEqual(seen, ['strip/cover', 'grid/visible cover', 'grid/off-screen cover', 'strip/template', 'grid/template']);
});

test('a newly queued cover overtakes an extra template even after idle was scheduled', async () => {
  const f = fixture(), seen: string[] = [];
  let release!: () => void;
  f.queue.add({ priority: () => 0, run: async () => { seen.push('first'); await new Promise<void>(resolve => { release = resolve; }); } });
  f.queue.add({ priority: () => 2, run: async () => { seen.push('extra'); } });
  await f.step();
  assert.equal(f.pending.size, 0, 'only one render may run at a time');
  release();
  await new Promise<void>(resolve => setImmediate(resolve));
  f.queue.add({ priority: () => 0, run: async () => { seen.push('new cover'); } });
  await f.drain();
  assert.deepEqual(seen, ['first', 'new cover', 'extra']);
});

test('hidden work parks without blocking, reprioritizes on wake, and stale cards are discarded', async () => {
  const f = fixture(), seen: string[] = [];
  let visible = false;
  f.queue.add({ priority: () => visible ? 0 : null, run: async () => { seen.push('revealed cover'); } });
  f.queue.add({ priority: () => 0, stale: () => true, run: async () => { seen.push('removed'); } });
  f.queue.add({ priority: () => 2, run: async () => { seen.push('extra'); } });
  await f.drain();
  assert.deepEqual(seen, ['extra']);
  visible = true;
  f.queue.wake();
  await f.drain();
  assert.deepEqual(seen, ['extra', 'revealed cover']);
});

test('a failed cover does not block the remaining tools, and teardown cancels pending work', async () => {
  const f = fixture(), seen: string[] = [];
  f.queue.add({ priority: () => 0, run: async () => { throw new Error('unavailable tool'); } });
  f.queue.add({ priority: () => 0, run: async () => { seen.push('next cover'); } });
  await f.drain();
  assert.equal(f.errors.length, 1);
  assert.deepEqual(seen, ['next cover']);
  f.queue.add({ priority: () => 2, run: async () => { seen.push('extra'); } });
  f.queue.destroy();
  await f.drain();
  assert.deepEqual(seen, ['next cover']);
  assert.equal(f.pending.size, 0);
});
