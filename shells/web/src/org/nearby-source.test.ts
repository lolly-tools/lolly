// SPDX-License-Identifier: MPL-2.0
/**
 * org nearby-source (org/nearby-source.ts): the `'org'` provider's poll shaping,
 * opt-in POST, and the deliberate refusals (no P2P exchange, no inbound invites).
 *
 * Run directly:  node --test shells/web/src/org/nearby-source.test.ts
 *
 * `instanceFetch` delegates to global fetch for same-origin traffic, so the test
 * stubs `globalThis.fetch`; timers are injected so the poll loop needs no real time.
 */

import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { createOrgNearbyProvider } from './nearby-source.ts';
import type { NearbyPeer } from '../lib/nearby.ts';

interface FetchCall { url: string; init?: RequestInit }
let calls: FetchCall[] = [];
let nextJson: unknown = { members: [] };
let nextOk = true;
let nextStatus = 200;
const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  nextJson = { members: [] };
  nextOk = true;
  nextStatus = 200;
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(nextJson), {
      status: nextStatus,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  // The real Response ctor honours status; force ok independently for the 404/501 case.
  if (!nextOk) { /* handled per-test via status */ }
});

afterEach(() => { globalThis.fetch = realFetch; });

// A manual interval driver.
function makeTimers() {
  let fn: (() => void) | null = null;
  return {
    env: {
      setInterval: (f: () => void) => { fn = f; return 1; },
      clearInterval: () => { fn = null; },
      now: () => 0,
    },
    tick: () => fn?.(),
    stopped: () => fn === null,
  };
}
const flush = () => new Promise<void>((r) => setImmediate(r));

test('subscribePeers polls immediately and shapes members into org peers', async () => {
  nextJson = { members: [
    { userId: 'u-andy', name: 'Andy', near: true },
    { userId: 'u-sam', name: 'Sam', near: false },
    { userId: '', name: 'bad' },          // dropped: empty id
    { userId: 'u-x' },                     // dropped: no name
  ] };
  const timers = makeTimers();
  const p = createOrgNearbyProvider(timers.env);
  let got: readonly NearbyPeer[] = [];
  const off = p.subscribePeers((peers) => { got = peers; });
  await flush();
  assert.equal(calls[0]!.url.includes('/api/v1/collab/nearby'), true);
  assert.deepEqual(got.map((x) => `${x.name}:${x.near}`), ['Andy:true', 'Sam:false']);
  assert.equal(got[0]!.source, 'org');
  assert.equal(got[0]!.kind, 'desktop');
  off();
  assert.equal(timers.stopped(), true, 'poll interval cleared on last unsubscribe');
});

test('a non-ok poll (disabled/501) yields no peers, no throw', async () => {
  nextStatus = 404;
  const timers = makeTimers();
  const p = createOrgNearbyProvider(timers.env);
  let called = 0;
  let last: readonly NearbyPeer[] | null = null;
  p.subscribePeers((peers) => { called++; last = peers; });
  await flush();
  // The callback only fires on a successful shape; a 404 must not deliver an empty
  // list as if it were real membership.
  assert.equal(called, 0);
  assert.equal(last, null);
});

test('setVisible posts visible:true for an active window, hide posts false', async () => {
  const p = createOrgNearbyProvider(makeTimers().env);
  await p.setVisible({ mode: 'timed', until: 10_000 }, 'Andy');
  await p.setVisible({ mode: 'hidden' }, 'Andy');
  await p.hide();
  const posts = calls.filter((c) => c.init?.method === 'POST');
  assert.equal(posts.length, 3);
  assert.deepEqual(JSON.parse(String(posts[0]!.init!.body)), { visible: true });
  assert.deepEqual(JSON.parse(String(posts[1]!.init!.body)), { visible: false });
  assert.deepEqual(JSON.parse(String(posts[2]!.init!.body)), { visible: false });
});

test('exchangeInvite refuses - the org track has no P2P handoff', async () => {
  const p = createOrgNearbyProvider(makeTimers().env);
  await assert.rejects(() => p.exchangeInvite('u-andy', 'token'), /no-p2p-exchange/);
});

test('subscribeInvites never fires and unsubscribes cleanly', () => {
  const p = createOrgNearbyProvider(makeTimers().env);
  let fired = 0;
  const off = p.subscribeInvites(() => { fired++; });
  off();
  assert.equal(fired, 0);
});
