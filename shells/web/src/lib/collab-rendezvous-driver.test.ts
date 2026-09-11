// SPDX-License-Identifier: MPL-2.0
/**
 * lib/collab-rendezvous-driver.ts (plans/138 Tier C, WP3) - bridges a ceremony to
 * the shared-store rendezvous. Driven here against a FAKE ceremony machine (the
 * real one is covered by ceremony.test.ts) and an in-memory store, with injected
 * codecs so no SDP is needed: a full inviter↔joiner pairing, a bad answer token,
 * and a terminal ceremony (missing tool) aborting the wait.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { driveRendezvousInviter, driveRendezvousJoiner } from './collab-rendezvous-driver.ts';
import type { PathStore } from './collab-rendezvous.ts';
import type { CeremonyMachine, CeremonyState, CeremonyEvent } from '../collab/ceremony.ts';

function memStore(): PathStore {
  const m = new Map<string, Uint8Array>();
  return { kind: 'memory', async getAt(p) { return m.get(p) ?? null; }, async putAt(p, b) { m.set(p, b.slice()); } };
}
const sleep = (): Promise<void> => new Promise((r) => setTimeout(r, 1));
const okInvite = (t: string) => ({ ok: true as const, value: { invite: { signal: t, toolId: 't' } } });
const okAnswer = (t: string) => ({ ok: true as const, value: { signal: t } });

// A minimal CeremonyMachine that mimics the transitions the driver depends on.
// `onAccept` lets a test send the acceptor to a terminal phase (missing tool).
function fakeMachine(role: 'inviter' | 'acceptor', onAccept: 'answer' | 'fail' = 'answer') {
  let state = { role, phase: 'idle', rearms: 0, arming: false, reconnecting: false, everConnected: false, observerOnly: false } as CeremonyState;
  const subs = new Set<(s: CeremonyState) => void>();
  const sends: CeremonyEvent[] = [];
  const set = (p: Partial<CeremonyState>): void => { state = { ...state, ...p }; for (const f of [...subs]) f(state); };
  const machine: CeremonyMachine = {
    get state() { return state; },
    subscribe(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
    dispose() { subs.clear(); },
    send(e) {
      sends.push(e);
      if (e.type === 'invite') setTimeout(() => set({ phase: 'awaiting-answer', invite: { signal: 'OFFER_TOKEN', toolId: 't' } }), 1);
      else if (e.type === 'accept') setTimeout(() => (onAccept === 'answer'
        ? set({ phase: 'awaiting-connection', invite: e.invite, answer: { signal: 'ANSWER_TOKEN' } })
        : set({ phase: 'failed', cause: 'tool-missing', detail: 'no such tool' })), 1);
      else if (e.type === 'answer') set({ phase: 'connecting', answer: e.answer });
    },
  };
  return Object.assign(machine, { sends });
}

test('a full inviter↔joiner pairing completes through the store', async () => {
  const store = memStore();
  const inviter = fakeMachine('inviter');
  const joiner = fakeMachine('acceptor');
  const opts = { sleep, pollMs: 1, timeoutMs: 5000, decodeInvite: okInvite, decodeAnswer: okAnswer };

  await Promise.all([
    driveRendezvousInviter(inviter, store, 'code-1', opts),
    driveRendezvousJoiner(joiner, store, 'code-1', opts),
  ]);

  const accept = joiner.sends.find((e) => e.type === 'accept');
  assert.equal(accept && accept.type === 'accept' && accept.invite.signal, 'OFFER_TOKEN', 'joiner accepted the offer');
  const answer = inviter.sends.find((e) => e.type === 'answer');
  assert.equal(answer && answer.type === 'answer' && answer.answer.signal, 'ANSWER_TOKEN', 'inviter applied the answer');
});

test('a bad answer token rejects the inviter (retryable at the ceremony layer)', async () => {
  const store = memStore();
  const inviter = fakeMachine('inviter');
  const joiner = fakeMachine('acceptor');
  const badAnswer = () => ({ ok: false as const, code: 'truncated' as const, reason: 'mangled answer' });

  await Promise.all([
    assert.rejects(
      () => driveRendezvousInviter(inviter, store, 'c', { sleep, pollMs: 1, timeoutMs: 5000, decodeInvite: okInvite, decodeAnswer: badAnswer }),
      /mangled answer/,
    ),
    driveRendezvousJoiner(joiner, store, 'c', { sleep, pollMs: 1, timeoutMs: 5000, decodeInvite: okInvite, decodeAnswer: okAnswer }),
  ]);
  assert.ok(!inviter.sends.some((e) => e.type === 'answer'), 'no answer applied on a bad token');
});

test('a terminal ceremony (missing tool) aborts the joiner wait', async () => {
  const store = memStore();
  const inviter = fakeMachine('inviter');
  const joiner = fakeMachine('acceptor', 'fail');
  await Promise.all([
    // inviter publishes its offer then waits for an answer that never comes → times out
    assert.rejects(() => driveRendezvousInviter(inviter, store, 'c', { sleep, pollMs: 1, timeoutMs: 30, now: (() => { let n = 0; return () => (n += 20); })(), decodeInvite: okInvite, decodeAnswer: okAnswer }), /Timed out/),
    assert.rejects(() => driveRendezvousJoiner(joiner, store, 'c', { sleep, pollMs: 1, timeoutMs: 5000, decodeInvite: okInvite, decodeAnswer: okAnswer }), /ended before pairing|no such tool/),
  ]);
});
