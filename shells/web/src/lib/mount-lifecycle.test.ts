// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { MountLifecycle } from './mount-lifecycle.ts';

test('dispose aborts first, releases in LIFO order, isolates failures, and is idempotent', () => {
  const order: string[] = [];
  const errors: string[] = [];
  const scope = new MountLifecycle({
    onDisposeError: (name) => errors.push(name),
  });
  scope.add('first', () => order.push(`first:${scope.signal.aborted}`));
  scope.add('broken', () => { throw new Error('boom'); });
  scope.add('last', () => order.push(`last:${scope.signal.aborted}`));

  scope.dispose();
  scope.dispose();

  assert.deepEqual(order, ['last:true', 'first:true']);
  assert.deepEqual(errors, ['broken']);
  assert.equal(scope.disposed, true);
});

test('late resources are immediately released and cannot survive navigation', () => {
  const disposed: string[] = [];
  const scope = new MountLifecycle();
  scope.dispose();
  scope.add('late transport', () => disposed.push('transport'));
  assert.deepEqual(disposed, ['transport']);
});

test('registered listeners, timers, and animation frames leave no callbacks behind', async () => {
  const scope = new MountLifecycle();
  const target = new EventTarget();
  let events = 0;
  let timers = 0;
  let frames = 0;
  scope.listen('document listener', target, 'change', () => { events += 1; });
  scope.timeout('deferred patch', () => { timers += 1; }, 0);

  const pending = new Map<number, FrameRequestCallback>();
  const scheduler = {
    requestAnimationFrame(callback: FrameRequestCallback): number { pending.set(7, callback); return 7; },
    cancelAnimationFrame(id: number): void { pending.delete(id); },
  };
  scope.animationFrame('paint', () => { frames += 1; }, scheduler);
  scope.dispose();
  target.dispatchEvent(new Event('change'));
  pending.get(7)?.(1);
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.deepEqual({ events, timers, frames, pending: pending.size }, { events: 0, timers: 0, frames: 0, pending: 0 });
});

test('the abort signal blocks an async continuation after disposal', async () => {
  const scope = new MountLifecycle();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let patches = 0;
  const continuation = gate.then(() => {
    if (!scope.signal.aborted) patches += 1;
  });
  scope.dispose();
  release();
  await continuation;
  assert.equal(patches, 0);
});
