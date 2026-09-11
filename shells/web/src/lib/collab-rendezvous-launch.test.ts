// SPDX-License-Identifier: MPL-2.0
/**
 * lib/collab-rendezvous-launch.ts (plans/138 Tier C, WP3b) - the dialog bindings
 * that route a role's signalling through the shared-cloud rendezvous. Exercised
 * as the dialog would fire them: inviter.onInvite publishes, acceptor.scan pulls +
 * acceptor.onAnswer publishes, inviter.scan pulls - a full loop over one store.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rendezvousBindings } from './collab-rendezvous-launch.ts';
import type { PathStore } from './collab-rendezvous.ts';

function memStore(): PathStore {
  const m = new Map<string, Uint8Array>();
  return { kind: 'memory', async getAt(p) { return m.get(p) ?? null; }, async putAt(p, b) { m.set(p, b.slice()); } };
}
const sleep = (): Promise<void> => new Promise((r) => setTimeout(r, 1));
const opts = { sleep, pollMs: 1, timeoutMs: 5000 };

test('bindings carry the right seams per role', () => {
  const store = memStore();
  const inv = rendezvousBindings('inviter', store, 'c', opts);
  const acc = rendezvousBindings('acceptor', store, 'c', opts);
  assert.ok(inv.onInvite && inv.scan, 'inviter publishes its invite and pulls the reply');
  assert.ok(!inv.onAnswer, 'inviter never publishes an answer');
  assert.ok(acc.scan && acc.onAnswer, 'acceptor pulls the invite and publishes its reply');
  assert.ok(!acc.onInvite, 'acceptor never publishes an invite');
});

test('a full pairing flows through the bindings over one store', async () => {
  const store = memStore();
  const inv = rendezvousBindings('inviter', store, 'sess-1', opts);
  const acc = rendezvousBindings('acceptor', store, 'sess-1', opts);

  inv.onInvite!('OFFER_SIGNAL');                 // inviter's invite minted → published
  assert.equal(await acc.scan!(), 'OFFER_SIGNAL', 'acceptor pulls the invite');
  acc.onAnswer!('ANSWER_SIGNAL');                // acceptor's reply minted → published
  assert.equal(await inv.scan!(), 'ANSWER_SIGNAL', 'inviter pulls the reply');
});

test('a mismatched session code pulls nothing (resolves null, never throws)', async () => {
  const store = memStore();
  rendezvousBindings('inviter', store, 'right', opts).onInvite!('OFFER');
  const wrong = rendezvousBindings('acceptor', store, 'wrong', { sleep, pollMs: 1, timeoutMs: 1, now: (() => { let n = 0; return () => (n += 10); })() });
  assert.equal(await wrong.scan!(), null, 'a scan that finds nothing resolves null for the dialog');
});
