// SPDX-License-Identifier: MPL-2.0
/**
 * rtc-connection - Track A's producer for the transport-agnostic mount seam
 * (plan 100 section 5, section 6.1, section 6.2a, section 12 Q3).
 *
 * Two things are worth pinning, and they are both about TIME.
 *
 *   1. The seed arrives AFTER the hand-off. A ceremony reaches `connected` off an ICE
 *      event, and ICE connects before the SCTP channel the hello rides on - so a
 *      connection built at `connected` cannot know its seed yet, every time. The latch
 *      is why the acceptor's tool opens populated instead of empty-then-converging.
 *   2. Waiting is BOUNDED. A peer that sends no seed (an older build; a state too big
 *      for one 64 KB frame, which `rtc-transport` drops rather than lose the op-version
 *      declaration beside it) must not hold the tool closed - section 6.2's late joiner gets
 *      the state from the peer anyway, just later.
 *
 * Run directly:  node --test shells/web/src/collab/rtc-connection.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SEED_WAIT_MS, rtcCollabConnection } from './rtc-connection.ts';
import type { RtcConnectionTimers } from './rtc-connection.ts';
import type { CeremonyConnectedHandle } from '../components/collab-ceremony.ts';
import type { RtcInboundMessage, RtcTransport } from './rtc-transport.ts';
import { HISTORY_PROTOCOL_VERSION, isCapturableCollabHistory } from '../lib/collab-history.ts';
import { CANVAS_OP_VERSION } from '@lolly-tools/core/canvas-op-v1';

/** The five members `createRtcCollabHandle` asks of a transport, plus a message pump. */
function transport(): RtcTransport & { deliver(message: RtcInboundMessage): void; closed(): number } {
  const listeners = new Map<string, Set<(value: unknown) => void>>();
  let closes = 0;
  return {
    role: 'acceptor',
    clientId: 'device-b',
    effects: {} as RtcTransport['effects'],
    state: () => ({ connection: 'live' }) as ReturnType<RtcTransport['state']>,
    sendOp: () => 'sent',
    sendPresence: () => 'sent',
    sendBeam: () => 'sent',
    beam: {} as RtcTransport['beam'],
    on(type: string, fn: (value: never) => void) {
      const set = listeners.get(type) ?? new Set();
      listeners.set(type, set);
      set.add(fn as (value: unknown) => void);
      return () => { set.delete(fn as (value: unknown) => void); };
    },
    onCeremonyEvent: () => () => {},
    close() { closes += 1; },
    deliver(message: RtcInboundMessage) { for (const fn of [...(listeners.get('message') ?? [])]) fn(message); },
    closed: () => closes,
  } as unknown as RtcTransport & { deliver(message: RtcInboundMessage): void; closed(): number };
}

/** Two transports whose beam-json frames cross to each other, for a real over-the-wire
 *  history exchange. Ops/hellos are delivered by hand so the handshake can be posed. */
function beamPair() {
  const mk = (clientId: string) => {
    const listeners = new Map<string, Set<(value: unknown) => void>>();
    let peer: { deliver(m: RtcInboundMessage): void } | null = null;
    const t = {
      role: 'acceptor', clientId, effects: {} as RtcTransport['effects'],
      state: () => ({ connection: 'live' }) as ReturnType<RtcTransport['state']>,
      sendOp: () => 'sent', sendPresence: () => 'sent', sendBeam: () => 'sent',
      beam: { json: (m: unknown) => peer?.deliver({ lane: 'beam', kind: 'json', json: m }) } as unknown as RtcTransport['beam'],
      on(type: string, fn: (value: never) => void) {
        const set = listeners.get(type) ?? new Set(); listeners.set(type, set); set.add(fn as (value: unknown) => void);
        return () => { set.delete(fn as (value: unknown) => void); };
      },
      onCeremonyEvent: () => () => {}, close() {},
      deliver(message: RtcInboundMessage) { for (const fn of [...(listeners.get('message') ?? [])]) fn(message); },
      link(other: { deliver(m: RtcInboundMessage): void }) { peer = other; },
    } as unknown as RtcTransport & { deliver(m: RtcInboundMessage): void; link(o: { deliver(m: RtcInboundMessage): void }): void };
    return t;
  };
  const a = mk('AAA'); const b = mk('BBB');
  a.link(b); b.link(a);
  return { a, b };
}

test('a peer requests the other side history over the beam lane once the handshake agrees', async () => {
  const { a, b } = beamPair();
  const host = rtcCollabConnection({ role: 'inviter', ceremony: ceremony({ toolId: 'design' }), transport: b, timers: timers() });
  const guest = rtcCollabConnection({ role: 'acceptor', ceremony: ceremony({ toolId: 'design' }), transport: a, timers: timers() });

  // Both sides announce the capability on the hello: the exchange is now enabled.
  a.deliver({ lane: 'ops', kind: 'hello', clientId: 'BBB', opVersion: CANVAS_OP_VERSION, history: HISTORY_PROTOCOL_VERSION });
  b.deliver({ lane: 'ops', kind: 'hello', clientId: 'AAA', opVersion: CANVAS_OP_VERSION, history: HISTORY_PROTOCOL_VERSION });

  // The host captures a shared-session revision into its memory history.
  assert.ok(isCapturableCollabHistory(host.handle.history));
  if (isCapturableCollabHistory(host.handle.history)) {
    host.handle.history.capture({ documentId: 'doc', toolId: 'design', label: 'Poster', actorId: 'BBB', data: { title: 'shared' } });
  }

  // The guest asks over the wire and receives the host disclosure-filtered metadata.
  assert.equal(typeof guest.requestPeerHistory, 'function');
  const list = await guest.requestPeerHistory!('session');
  assert.equal(list.length, 1);
  assert.equal(list[0]?.label, 'Poster');
  assert.equal((list[0] as { preview?: unknown }).preview, undefined, 'metadata only: no payload or preview crosses');

  guest.close(); host.close();
});

test('a peer fetches a shared revision payload over the beam lane, hash-verified', async () => {
  const { a, b } = beamPair();
  const host = rtcCollabConnection({ role: 'inviter', ceremony: ceremony({ toolId: 'design' }), transport: b, timers: timers() });
  const guest = rtcCollabConnection({ role: 'acceptor', ceremony: ceremony({ toolId: 'design' }), transport: a, timers: timers() });
  a.deliver({ lane: 'ops', kind: 'hello', clientId: 'BBB', opVersion: CANVAS_OP_VERSION, history: HISTORY_PROTOCOL_VERSION });
  b.deliver({ lane: 'ops', kind: 'hello', clientId: 'AAA', opVersion: CANVAS_OP_VERSION, history: HISTORY_PROTOCOL_VERSION });

  assert.ok(isCapturableCollabHistory(host.handle.history));
  let revisionId = '';
  if (isCapturableCollabHistory(host.handle.history)) {
    revisionId = host.handle.history.capture({ documentId: 'doc', toolId: 'design', actorId: 'BBB', data: { title: 'the shared draft', count: 7 } }).id;
  }

  // The guest lists, then fetches the one revision's full payload as a new local copy.
  const list = await guest.requestPeerHistory!('session');
  assert.equal(list[0]?.id, revisionId);
  const payload = await guest.requestPeerRevision!(revisionId);
  assert.deepEqual(payload, { title: 'the shared draft', count: 7 });

  guest.close(); host.close();
});

test('shared history is refused over the wire when the peer never announced the capability', async () => {
  const { a, b } = beamPair();
  const host = rtcCollabConnection({ role: 'inviter', ceremony: ceremony({ toolId: 'design' }), transport: b, timers: timers() });
  const guest = rtcCollabConnection({ role: 'acceptor', ceremony: ceremony({ toolId: 'design' }), transport: a, timers: timers() });
  // Only an op-version hello, no history capability: the guest must not assume sharing.
  a.deliver({ lane: 'ops', kind: 'hello', clientId: 'BBB', opVersion: CANVAS_OP_VERSION });
  await assert.rejects(guest.requestPeerHistory!('session'), /not available/);
  guest.close(); host.close();
});

const ceremony = (over: Partial<CeremonyConnectedHandle> = {}): CeremonyConnectedHandle => ({
  role: 'acceptor',
  localName: 'Priya',
  peerName: 'Andy',
  toolId: 'qr-code',
  observerOnly: false,
  state: {} as CeremonyConnectedHandle['state'],
  close: () => {},
  ...over,
} as CeremonyConnectedHandle);

/**
 * Timers that fire only when a test says so, filtered by delay.
 *
 * The filter matters: this one seam feeds BOTH the seed deadline and (through the
 * handle) the section 6.2 divergence backstop a live transport arms at construction. Firing
 * indiscriminately would restate the document mid-assertion; counting indiscriminately
 * would call a backstop "a seed wait".
 */
function timers(): RtcConnectionTimers & { fire(ms?: number): void; armed(ms?: number): number } {
  const pending = new Map<object, { fn: () => void; ms: number }>();
  const match = (entry: { ms: number }, ms?: number): boolean => ms === undefined || entry.ms === ms;
  return {
    setTimeout(fn, ms) { const key = {}; pending.set(key, { fn, ms }); return key; },
    clearTimeout(handle) { pending.delete(handle as object); },
    fire(ms) {
      for (const [key, entry] of [...pending]) {
        if (!match(entry, ms)) continue;
        pending.delete(key);
        entry.fn();
      }
    },
    armed(ms) {
      let n = 0;
      for (const entry of pending.values()) if (match(entry, ms)) n++;
      return n;
    },
  };
}

test('the connection is transport-agnostic: a session handle and one way to hang up', () => {
  const wire = transport();
  const conn = rtcCollabConnection({ role: 'acceptor', ceremony: ceremony(), transport: wire, timers: timers() });

  assert.ok(conn.handle.adapter, 'what createCollabSession takes, built here where the transport is');
  assert.equal(conn.handle.self.clientId, 'device-b', 'the per-device id, never a profile field (section 11.23)');
  assert.equal(conn.handle.self.name, 'Priya', 'the name the human typed into the ceremony');
  assert.equal(conn.toolId, 'qr-code');
  assert.equal(conn.ephemeral, true, "section 6.2a: the acceptor's copy never lands in a slot");

  conn.close();
  assert.equal(wire.closed(), 1, 'closing the session closes the transport under it');
});

test('the inviter is never ephemeral and never waits for a seed it already holds', async () => {
  const clock = timers();
  const conn = rtcCollabConnection({
    role: 'inviter',
    ceremony: ceremony({ role: 'inviter', localName: 'Andy' }),
    transport: transport(),
    seed: { url: 'https://suse.com' },
    timers: clock,
  });
  assert.equal(conn.ephemeral, false, 'section 6.2a: the inviter owns the saved session');
  assert.deepEqual(conn.seed, { url: 'https://suse.com' });
  assert.equal(conn.seedLater, undefined, 'nothing to wait for - and waiting would delay its own remount');
  assert.equal(clock.armed(SEED_WAIT_MS), 0, 'no seed deadline armed for a value we hold');
});

test('the acceptor latches the seed off the hello that lands after `connected`', async () => {
  const wire = transport();
  const clock = timers();
  const conn = rtcCollabConnection({ role: 'acceptor', ceremony: ceremony(), transport: wire, timers: clock });
  assert.equal(conn.seed, undefined, 'it cannot be known yet - that is the whole reason for the latch');

  // A hello with no seed is the ordinary "you'll receive it on connect" case and must not
  // end the wait; the frame that carries the seed is the one worth waiting for.
  wire.deliver({ lane: 'ops', kind: 'hello', clientId: 'device-a' });
  wire.deliver({ lane: 'ops', kind: 'hello', clientId: 'device-a', seed: 'url=https%3A%2F%2Fsuse.com&size=512' });

  const seed = await conn.seedLater!;
  assert.equal(seed?.url, 'https://suse.com');
  assert.equal(seed?.size, '512');
  assert.equal(clock.armed(SEED_WAIT_MS), 0, 'the deadline is disarmed the moment the seed lands');
});

test('a peer that sends no seed resolves the wait instead of holding the tool closed', async () => {
  const clock = timers();
  const conn = rtcCollabConnection({ role: 'acceptor', ceremony: ceremony(), transport: transport(), timers: clock });
  assert.equal(clock.armed(SEED_WAIT_MS), 1);
  clock.fire(SEED_WAIT_MS);
  assert.equal(await conn.seedLater!, undefined, 'section 6.2: convergence delivers the state, just later');
});

test('a seed arriving after the deadline cannot resurrect a settled wait', async () => {
  const wire = transport();
  const clock = timers();
  const conn = rtcCollabConnection({ role: 'acceptor', ceremony: ceremony(), transport: wire, timers: clock });
  clock.fire(SEED_WAIT_MS);
  assert.equal(await conn.seedLater!, undefined);
  wire.deliver({ lane: 'ops', kind: 'hello', clientId: 'device-a', seed: 'url=late' });
  assert.equal(await conn.seedLater!, undefined, 'a promise settles once, and the mount has already moved on');
});

test('the deadline is a bound on absurdity, not a budget anyone hits honestly', () => {
  assert.ok(SEED_WAIT_MS > 0 && SEED_WAIT_MS <= 3_000,
    'the hello is the first frame on a channel that just opened - section 7 wants join-to-interactive under 3 s');
});
