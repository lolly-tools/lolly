// SPDX-License-Identifier: MPL-2.0
/**
 * nearby - the discovery-provider registry (lib/nearby.ts): registration/last-wins,
 * the dormant default, source ordering, and the pure visibility-window maths.
 *
 * Run directly:  node --test shells/web/src/lib/nearby.test.ts
 *
 * No DOM, no timers, no network - the registry is pure and the window helpers take
 * an injected `now`, so this is plain node:test.
 */

import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import {
  registerNearbyProvider,
  getNearbyProvider,
  listNearbyProviders,
  anyNearbyAvailable,
  _clearNearbyProvidersForTests,
  isVisibilityActive,
  visibilityRemainingMs,
  timedWindow,
  NEARBY_WINDOW_MS,
  type NearbyProvider,
  type NearbySource,
} from './nearby.ts';

function stubProvider(source: NearbySource): NearbyProvider {
  return {
    source,
    async setVisible() {},
    async hide() {},
    subscribePeers() { return () => {}; },
    subscribeInvites() { return () => {}; },
    async exchangeInvite() { return 'reply'; },
  };
}

beforeEach(() => { _clearNearbyProvidersForTests(); });

test('dormant by default: nothing registered', () => {
  assert.equal(anyNearbyAvailable(), false);
  assert.deepEqual(listNearbyProviders(), []);
  assert.equal(getNearbyProvider('lan'), undefined);
  assert.equal(getNearbyProvider('org'), undefined);
});

test('register + get + unregister', () => {
  const lan = stubProvider('lan');
  const off = registerNearbyProvider(lan);
  assert.equal(getNearbyProvider('lan'), lan);
  assert.equal(anyNearbyAvailable(), true);
  off();
  assert.equal(getNearbyProvider('lan'), undefined);
  assert.equal(anyNearbyAvailable(), false);
});

test('last-wins per source; unregister of a replaced provider is a no-op', () => {
  const first = stubProvider('lan');
  const second = stubProvider('lan');
  const offFirst = registerNearbyProvider(first);
  registerNearbyProvider(second);
  assert.equal(getNearbyProvider('lan'), second);
  offFirst(); // first is no longer the registered one - must not evict second
  assert.equal(getNearbyProvider('lan'), second);
});

test('listNearbyProviders orders lan before org regardless of registration order', () => {
  registerNearbyProvider(stubProvider('org'));
  registerNearbyProvider(stubProvider('lan'));
  assert.deepEqual(listNearbyProviders().map(p => p.source), ['lan', 'org']);
});

test('the two sources are independent slots', () => {
  registerNearbyProvider(stubProvider('lan'));
  registerNearbyProvider(stubProvider('org'));
  assert.equal(listNearbyProviders().length, 2);
  assert.ok(getNearbyProvider('lan'));
  assert.ok(getNearbyProvider('org'));
});

// ── visibility-window maths ──────────────────────────────────────────────────────

test('isVisibilityActive: hidden never, standing always', () => {
  assert.equal(isVisibilityActive({ mode: 'hidden' }, 1000), false);
  assert.equal(isVisibilityActive({ mode: 'standing' }, 1000), true);
});

test('isVisibilityActive: timed honours the deadline', () => {
  assert.equal(isVisibilityActive({ mode: 'timed', until: 2000 }, 1000), true);
  assert.equal(isVisibilityActive({ mode: 'timed', until: 1000 }, 1000), false); // exact = expired
  assert.equal(isVisibilityActive({ mode: 'timed', until: 500 }, 1000), false);
});

test('isVisibilityActive: a timed window with no deadline is treated as expired', () => {
  assert.equal(isVisibilityActive({ mode: 'timed' }, 1000), false);
});

test('visibilityRemainingMs clamps and is zero for non-timed', () => {
  assert.equal(visibilityRemainingMs({ mode: 'timed', until: 2500 }, 1000), 1500);
  assert.equal(visibilityRemainingMs({ mode: 'timed', until: 500 }, 1000), 0);
  assert.equal(visibilityRemainingMs({ mode: 'standing' }, 1000), 0);
  assert.equal(visibilityRemainingMs({ mode: 'hidden' }, 1000), 0);
});

test('timedWindow builds a 10-minute window from now', () => {
  const w = timedWindow(1000);
  assert.equal(w.mode, 'timed');
  assert.equal(w.until, 1000 + NEARBY_WINDOW_MS);
  assert.equal(isVisibilityActive(w, 1000 + NEARBY_WINDOW_MS - 1), true);
  assert.equal(isVisibilityActive(w, 1000 + NEARBY_WINDOW_MS), false);
});
