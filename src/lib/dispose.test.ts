// SPDX-License-Identifier: MPL-2.0
/** The disposable mount scope (lib/dispose.ts). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScope } from './dispose.ts';

class Target extends EventTarget {}

test('listeners, timers and frames registered through a scope are released together, newest first', () => {
  const g = globalThis as Record<string, unknown>;
  const rafs: number[] = [];
  const cancelled: number[] = [];
  g.requestAnimationFrame = (_fn: FrameRequestCallback) => { const id = rafs.length + 1; rafs.push(id); return id; };
  g.cancelAnimationFrame = (id: number) => { cancelled.push(id); };
  try {
    const scope = createScope();
    const target = new Target();
    let fired = 0;
    scope.listen(target, 'ping', () => { fired++; });
    const order: string[] = [];
    scope.add(() => order.push('first'));
    scope.add(() => order.push('second'));
    scope.raf(() => {});
    scope.timeout(() => { fired += 100; }, 5);
    target.dispatchEvent(new Event('ping'));
    assert.equal(fired, 1);
    scope.dispose();
    target.dispatchEvent(new Event('ping'));
    assert.equal(fired, 1, 'the listener is gone');
    assert.deepEqual(order, ['second', 'first'], 'newest first');
    assert.deepEqual(cancelled, [1]);
    assert.equal(scope.disposed, true);
    scope.dispose(); // idempotent
  } finally {
    delete g.requestAnimationFrame;
    delete g.cancelAnimationFrame;
  }
});

test('a release that throws is reported and the rest still run; a late registration is released at once', () => {
  const errors: unknown[] = [];
  const scope = createScope((e) => errors.push(e));
  const ran: string[] = [];
  scope.add(() => { ran.push('a'); });
  scope.add(() => { throw new Error('boom'); });
  scope.add(() => { ran.push('c'); });
  scope.dispose();
  assert.deepEqual(ran, ['c', 'a']);
  assert.equal(errors.length, 1);
  let late = false;
  scope.add(() => { late = true; });
  assert.equal(late, true, 'after dispose, a registration is released immediately');
});

test('an individual release removes just that registration', () => {
  const scope = createScope();
  const target = new Target();
  let a = 0;
  let b = 0;
  const offA = scope.listen(target, 'x', () => { a++; });
  scope.listen(target, 'x', () => { b++; });
  offA();
  target.dispatchEvent(new Event('x'));
  assert.deepEqual([a, b], [0, 1]);
  scope.dispose();
  target.dispatchEvent(new Event('x'));
  assert.deepEqual([a, b], [0, 1]);
});
