// SPDX-License-Identifier: MPL-2.0
/**
 * nearby-boot - the LAN provider built over a native invoke (lib/nearby-boot.ts):
 * the poll→fanout loop, browse lifecycle, timed-window auto-hide, invite
 * respond/decline once-only, output clamping, and the off-Tauri dormancy of
 * installNearbyBoot.
 *
 * Run directly:  node --test shells/web/src/lib/nearby-boot.test.ts
 *
 * Pure: a fake invoke records calls and returns programmable poll payloads; timers
 * and the clock are injected so nothing waits in real time.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createNearbyLanProvider,
  installNearbyBoot,
  tauriInvoke,
  _resetNearbyBootForTests,
  type TauriInvoke,
} from './nearby-boot.ts';
import { _clearNearbyProvidersForTests, anyNearbyAvailable, type NearbyInboundInvite, type NearbyPeer } from './nearby.ts';

// ── A controllable environment ───────────────────────────────────────────────────

interface Timer { id: number; fn: () => void; due: number; interval?: number }

class FakeEnv {
  clock = 0;
  private seq = 1;
  private timers = new Map<number, Timer>();
  calls: Array<{ cmd: string; args?: Record<string, unknown> }> = [];
  pollResult: unknown = { peers: [], invites: [] };
  exchangeReply: unknown = 'REPLY-TOKEN';
  failCmd: string | null = null;

  invoke: TauriInvoke = async (cmd, args) => {
    this.calls.push({ cmd, args });
    if (this.failCmd === cmd) throw new Error(`fail:${cmd}`);
    if (cmd === 'nearby_poll') return this.pollResult;
    if (cmd === 'nearby_exchange_invite') return this.exchangeReply;
    return undefined;
  };

  now = () => this.clock;
  setTimeout = (fn: () => void, ms: number) => { const id = this.seq++; this.timers.set(id, { id, fn, due: this.clock + ms }); return id; };
  clearTimeout = (h: unknown) => { this.timers.delete(h as number); };
  setInterval = (fn: () => void, ms: number) => { const id = this.seq++; this.timers.set(id, { id, fn, due: this.clock + ms, interval: ms }); return id; };
  clearInterval = (h: unknown) => { this.timers.delete(h as number); };

  /** Advance the clock, firing due timers (intervals re-arm). */
  advance(ms: number): void {
    const target = this.clock + ms;
    // step in small hops so intervals fire repeatedly
    while (true) {
      let next: Timer | null = null;
      for (const t of this.timers.values()) if (t.due <= target && (!next || t.due < next.due)) next = t;
      if (!next) break;
      this.clock = next.due;
      if (next.interval) next.due += next.interval; else this.timers.delete(next.id);
      next.fn();
    }
    this.clock = target;
  }
  env() { return { invoke: this.invoke, now: this.now, setTimeout: this.setTimeout, clearTimeout: this.clearTimeout, setInterval: this.setInterval, clearInterval: this.clearInterval }; }
  cmds(): string[] { return this.calls.map(c => c.cmd); }
}

// A microtask flush - the provider's async invokes resolve on the microtask queue.
const flush = () => new Promise<void>(r => setImmediate(r));

test('installNearbyBoot is dormant off Tauri (no global)', () => {
  _clearNearbyProvidersForTests();
  _resetNearbyBootForTests();
  assert.equal(tauriInvoke(), null);
  installNearbyBoot();
  assert.equal(anyNearbyAvailable(), false);
});

test('subscribePeers starts browsing + polling and fans out sanitized peers', async () => {
  const fe = new FakeEnv();
  fe.pollResult = { peers: [
    { id: 'peer-1', name: 'Andy', kind: 'desktop' },
    { id: 'peer-2', name: 'Priya', kind: 'mobile' },
    { id: '', name: 'bad', kind: 'desktop' },      // dropped: empty id
    { id: 'peer-4', kind: 'desktop' },               // dropped: no name
  ], invites: [] };
  const p = createNearbyLanProvider(fe.env());
  let got: readonly NearbyPeer[] = [];
  const off = p.subscribePeers(peers => { got = peers; });
  await flush();
  assert.ok(fe.cmds().includes('nearby_browse'));
  assert.equal(fe.calls.find(c => c.cmd === 'nearby_browse')?.args?.on, true);
  assert.ok(fe.cmds().includes('nearby_poll'));
  assert.deepEqual(got.map(x => x.id), ['peer-1', 'peer-2']);
  assert.equal(got[0]!.source, 'lan');
  assert.equal(got[1]!.kind, 'mobile');
  off();
  await flush();
  assert.equal(fe.calls.filter(c => c.cmd === 'nearby_browse').pop()?.args?.on, false);
});

test('the poll loop stops when the last subscriber leaves and we are not visible', async () => {
  const fe = new FakeEnv();
  const p = createNearbyLanProvider(fe.env());
  const off = p.subscribePeers(() => {});
  await flush();
  const before = fe.calls.filter(c => c.cmd === 'nearby_poll').length;
  off();
  fe.advance(POLL_INTERVALS(3));
  await flush();
  const after = fe.calls.filter(c => c.cmd === 'nearby_poll').length;
  assert.equal(after, before, 'no further polls after unsubscribe');
});

test('setVisible timed advertises then auto-hides at the deadline', async () => {
  const fe = new FakeEnv();
  const p = createNearbyLanProvider(fe.env());
  await p.setVisible({ mode: 'timed', until: fe.clock + 600_000 }, 'Andy');
  await flush();
  assert.ok(fe.cmds().includes('nearby_set_visible'));
  assert.equal(fe.calls.find(c => c.cmd === 'nearby_set_visible')?.args?.name, 'Andy');
  assert.equal(fe.cmds().includes('nearby_hide'), false);
  fe.advance(600_000);
  await flush();
  assert.ok(fe.cmds().includes('nearby_hide'), 'auto-hid at the deadline');
});

test('setVisible hidden calls hide, never advertises', async () => {
  const fe = new FakeEnv();
  const p = createNearbyLanProvider(fe.env());
  await p.setVisible({ mode: 'hidden' }, 'Andy');
  await flush();
  assert.equal(fe.cmds().includes('nearby_set_visible'), false);
});

test('standing visibility advertises with no auto-hide', async () => {
  const fe = new FakeEnv();
  const p = createNearbyLanProvider(fe.env());
  await p.setVisible({ mode: 'standing' }, 'Andy');
  await flush();
  assert.ok(fe.cmds().includes('nearby_set_visible'));
  fe.advance(60 * 60 * 1000);
  await flush();
  assert.equal(fe.cmds().includes('nearby_hide'), false, 'standing never auto-hides');
});

test('inbound invite is surfaced once; respond sends the reply; decline is ignored after', async () => {
  const fe = new FakeEnv();
  fe.pollResult = { peers: [], invites: [{ exchangeId: 'x1', fromName: 'Priya', token: 'INV-TOKEN' }] };
  const p = createNearbyLanProvider(fe.env());
  const seen: NearbyInboundInvite[] = [];
  p.subscribeInvites(inv => seen.push(inv));
  await flush();
  fe.advance(POLL_INTERVALS(2)); // poll again - must NOT re-surface the same exchange
  await flush();
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.fromName, 'Priya');
  assert.equal(seen[0]!.token, 'INV-TOKEN');
  seen[0]!.respond('MY-REPLY');
  await flush();
  const reply = fe.calls.find(c => c.cmd === 'nearby_send_reply');
  assert.ok(reply);
  assert.equal(reply?.args?.token, 'MY-REPLY');
  seen[0]!.decline(); // already answered - no decline call
  await flush();
  assert.equal(fe.cmds().includes('nearby_decline'), false);
});

test('exchangeInvite forwards the token and returns the reply', async () => {
  const fe = new FakeEnv();
  const p = createNearbyLanProvider(fe.env());
  const reply = await p.exchangeInvite('peer-1', 'MY-INVITE');
  assert.equal(reply, 'REPLY-TOKEN');
  const call = fe.calls.find(c => c.cmd === 'nearby_exchange_invite');
  assert.equal(call?.args?.peerId, 'peer-1');
  assert.equal(call?.args?.token, 'MY-INVITE');
});

test('exchangeInvite rejects on an empty reply', async () => {
  const fe = new FakeEnv();
  fe.exchangeReply = '';
  const p = createNearbyLanProvider(fe.env());
  await assert.rejects(() => p.exchangeInvite('peer-1', 'MY-INVITE'), /empty-reply/);
});

test('setVisible surfaces a native advertise failure', async () => {
  const fe = new FakeEnv();
  fe.failCmd = 'nearby_set_visible';
  const p = createNearbyLanProvider(fe.env());
  await assert.rejects(() => p.setVisible({ mode: 'standing' }, 'Andy'), /advertise-failed/);
});

// POLL_MS is internal; advancing by a few intervals is enough to prove loop behaviour.
function POLL_INTERVALS(n: number): number { return n * 1200; }
