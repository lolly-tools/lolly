// SPDX-License-Identifier: MPL-2.0
/**
 * collab-launch.ts - the two-track collab-opener seam.
 *
 * Pure, DOM-free: proves the dormant default (no opener on either slot ⇒
 * getCollabOpener is undefined and openCollabLaunch is a no-op returning
 * false), that a registered opener receives the session-context shape, that
 * the two tracks are independent (registering one never affects the other),
 * last-wins replacement per track, unregister, and tolerance of a throwing
 * opener. Mirrors lib/approval-request.test.ts's coverage shape.
 *
 * Run directly:  node --test shells/web/src/lib/collab-launch.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerCollabOpener, getCollabOpener, openCollabLaunch, _clearCollabOpenersForTests,
} from './collab-launch.ts';
import type { CollabLaunchContext } from './collab-launch.ts';

test('dormant by default: neither track has an opener', () => {
  _clearCollabOpenersForTests();
  assert.equal(getCollabOpener('private'), undefined);
  assert.equal(getCollabOpener('work'), undefined);
  assert.equal(openCollabLaunch('private', { baseParts: [] }), false);
  assert.equal(openCollabLaunch('work', { baseParts: [] }), false);
});

test('a registered opener receives the context (the session-context shape) and openCollabLaunch returns true', () => {
  _clearCollabOpenersForTests();
  const seen: CollabLaunchContext[] = [];
  registerCollabOpener('work', (ctx) => { seen.push(ctx); });
  const ctx: CollabLaunchContext = { toolId: 'qr-code', baseParts: ['url=https%3A%2F%2Fsuse.com'], currentFormat: 'png' };
  assert.equal(openCollabLaunch('work', ctx), true);
  assert.deepEqual(seen, [ctx]);
});

test('the two tracks are independent: registering one leaves the other dormant', () => {
  _clearCollabOpenersForTests();
  registerCollabOpener('private', () => {});
  assert.notEqual(getCollabOpener('private'), undefined);
  assert.equal(getCollabOpener('work'), undefined);
  assert.equal(openCollabLaunch('work', { baseParts: [] }), false);
});

test('last register wins per track; unregister restores dormancy for that track only', () => {
  _clearCollabOpenersForTests();
  let a = 0, b = 0, workCalls = 0;
  const offA = registerCollabOpener('private', () => { a++; });
  const offB = registerCollabOpener('private', () => { b++; });
  registerCollabOpener('work', () => { workCalls++; });
  openCollabLaunch('private', { baseParts: [] });
  assert.equal(a, 0);
  assert.equal(b, 1, 'later registration replaces the earlier, same track');
  offB();
  assert.equal(openCollabLaunch('private', { baseParts: [] }), false, 'unregister returns that track to dormant');
  openCollabLaunch('work', { baseParts: [] });
  assert.equal(workCalls, 1, 'the other track is untouched by the private-track unregister');
  offA(); // already-superseded unregister - must be a safe no-op
});

test('a throwing opener is swallowed (never breaks the caller)', () => {
  _clearCollabOpenersForTests();
  registerCollabOpener('private', () => { throw new Error('boom'); });
  assert.equal(openCollabLaunch('private', { baseParts: [] }), false);
});
