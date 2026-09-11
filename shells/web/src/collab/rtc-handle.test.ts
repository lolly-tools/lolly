// SPDX-License-Identifier: MPL-2.0
/**
 * The Track A handle: a transport pair, two documents, and the rules that keep them
 * the same document (plan 100 section 6.2, section 6.2a, section 11.19, section 11.21; wave 2.3).
 *
 * `rtc-transport.test.ts` pins the wire and `collab-session.test.ts` pins the
 * composition; neither can see what this file exists for - TWO handles, each with its
 * own `ReferenceCanvasDoc`, converging (or not) across a lane that is allowed to lose
 * a frame. A backstop that never repairs anything passes every single-sided test.
 *
 * WHAT IS REAL: both handles, both documents, the real register index, the real
 * ordering rules, the real op contract. FAKE: the transport (an in-memory pair - the
 * five methods `RtcHandleTransport` names, plus a switch to swallow a frame), the
 * clock, and the outbound coalescing scheduler, so nothing sleeps and a dropped
 * packet is a boolean rather than a race.
 *
 * Run only this file:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/collab/rtc-handle.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CanvasOp, Damage, ParamValue } from '@lolly-tools/core/canvas-op-v1';

import { opKeys } from '../org/collab-protocol.ts';
import type { PresenceFrame } from '../lib/collab-presence.ts';
import type { CollabConnectionState } from '../lib/collab-session.ts';
import type { CeremonyTimerHandle, CeremonyTimers } from './ceremony.ts';
import { createRtcCollabHandle, registerKeys } from './rtc-handle.ts';
import { isCapturableCollabHistory, HISTORY_PROTOCOL_VERSION } from '../lib/collab-history.ts';
import { CANVAS_OP_VERSION } from '@lolly-tools/core/canvas-op-v1';
import type { RtcCollabHandle, RtcHandleTransport, RtcTransportSatisfiesHandleTransport } from './rtc-handle.ts';
import type {
  RtcConnectionState,
  RtcInboundMessage,
  RtcPresenceOutbound,
  RtcSendResult,
  RtcTransportEventMap,
  RtcTransportState,
} from './rtc-transport.ts';

// ── Clock ──────────────────────────────────────────────────────────────────────────

class TestClock implements CeremonyTimers {
  now = 0;
  private seq = 0;
  private readonly due = new Map<number, { at: number; fn: () => void }>();

  setTimeout(fn: () => void, ms: number): CeremonyTimerHandle {
    this.seq += 1;
    this.due.set(this.seq, { at: this.now + ms, fn });
    return this.seq;
  }

  clearTimeout(handle: CeremonyTimerHandle): void {
    this.due.delete(handle as number);
  }

  /** Armed timers - the only honest way to prove a teardown is complete. */
  pending(): number {
    return this.due.size;
  }

  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      let nextId = -1;
      let nextAt = Number.POSITIVE_INFINITY;
      for (const [id, entry] of this.due) {
        if (entry.at <= target && entry.at < nextAt) {
          nextAt = entry.at;
          nextId = id;
        }
      }
      if (nextId === -1) break;
      const entry = this.due.get(nextId);
      this.due.delete(nextId);
      if (!entry) break;
      this.now = entry.at;
      entry.fn();
    }
    this.now = target;
  }
}

/** The outbound coalescing hop, run by hand so a "one gesture, one frame" assertion
 *  is a call and not a `setTimeout(0)`. */
function makeScheduler(): { schedule: (fn: () => void) => void; run(): void } {
  const queue: (() => void)[] = [];
  return {
    schedule(fn) {
      queue.push(fn);
    },
    run() {
      while (queue.length > 0) {
        const fn = queue.shift();
        fn?.();
      }
    },
  };
}

// ── The fake transport pair ────────────────────────────────────────────────────────

function transportState(connection: RtcConnectionState): RtcTransportState {
  const open = connection === 'live';
  return {
    connection,
    ice: open ? 'connected' : 'new',
    gathering: 'complete',
    lanes: {
      ops: open ? 'open' : 'connecting',
      presence: open ? 'open' : 'connecting',
      beam: open ? 'open' : 'connecting',
    },
    everConnected: open,
    localCandidates: 2,
    remoteCandidates: 2,
    candidatePairSeen: open,
    diagnosis: open ? 'connection-lost' : 'isolation-suspected',
    isolationSuspected: !open,
  };
}

class FakeTransport implements RtcHandleTransport {
  readonly clientId: string;
  peer: FakeTransport | null = null;
  connection: RtcConnectionState = 'live';
  closed = false;
  /** Every ops-lane payload written, verbatim. */
  readonly opsOut: unknown[] = [];
  readonly presenceOut: PresenceFrame[] = [];
  /** Refuse a frame carrying more ops than this, as the SCTP ceiling does. */
  maxOpsPerFrame = Number.POSITIVE_INFINITY;
  /** Swallow the next N ops frames AFTER reporting them sent - a lost packet. */
  dropOps = 0;

  private readonly messageListeners = new Set<(value: RtcInboundMessage) => void>();
  private readonly stateListeners = new Set<(value: RtcTransportState) => void>();

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  state(): RtcTransportState {
    return transportState(this.connection);
  }

  sendOp(op: unknown): RtcSendResult {
    if (this.closed) return 'closed';
    if (this.connection !== 'live') return 'not-open';
    const count = Array.isArray(op) ? op.length : 1;
    if (count > this.maxOpsPerFrame) return 'too-large';
    this.opsOut.push(op);
    if (this.dropOps > 0) {
      this.dropOps -= 1;
      return 'sent';
    }
    this.peer?.deliver({ lane: 'ops', kind: 'op', op });
    return 'sent';
  }

  sendPresence(frame: RtcPresenceOutbound): RtcSendResult {
    if (this.closed) return 'closed';
    if (this.connection !== 'live') return 'not-open';
    const out: PresenceFrame = {
      from: frame.from ?? this.clientId,
      seq: frame.seq ?? 0,
      state: frame.state,
      away: frame.away === true,
    };
    this.presenceOut.push(out);
    this.peer?.deliver({ lane: 'presence', kind: 'presence', frame: out });
    return 'sent';
  }

  /** The peer's in-band op-version declaration (rtc-transport sends it the moment the
   *  ops lane opens; here it is a call, so a test can choose when it lands). */
  hello(clientId: string, opVersion: string, history?: string): void {
    this.deliver({ lane: 'ops', kind: 'hello', clientId, opVersion, ...(history === undefined ? {} : { history }) });
  }

  deliver(message: RtcInboundMessage): void {
    for (const fn of [...this.messageListeners]) fn(message);
  }

  setConnection(next: RtcConnectionState): void {
    this.connection = next;
    const snapshot = this.state();
    for (const fn of [...this.stateListeners]) fn(snapshot);
  }

  on<K extends keyof RtcTransportEventMap>(
    type: K,
    fn: (value: RtcTransportEventMap[K]) => void,
  ): () => void {
    if (type === 'message') {
      const listener = fn as (value: RtcInboundMessage) => void;
      this.messageListeners.add(listener);
      return () => {
        this.messageListeners.delete(listener);
      };
    }
    if (type === 'state') {
      const listener = fn as (value: RtcTransportState) => void;
      this.stateListeners.add(listener);
      return () => {
        this.stateListeners.delete(listener);
      };
    }
    return () => {};
  }

  close(): void {
    this.closed = true;
    this.connection = 'closed';
  }

  /** Ops payloads, normalised to arrays - the shape this module always writes. */
  frames(): CanvasOp[][] {
    return this.opsOut.map((payload) => (Array.isArray(payload) ? (payload as CanvasOp[]) : [payload as CanvasOp]));
  }
}

// ── One side of the pair ──────────────────────────────────────────────────────────

const NO_DAMAGE: Damage = { moved: [], restyled: [], added: [], removed: [], zChanged: [], frames: [] };

interface Side {
  readonly id: string;
  readonly handle: RtcCollabHandle;
  readonly transport: FakeTransport;
  readonly clock: TestClock;
  /** Ops surfaced for the plumbing, flattened. */
  readonly inbound: CanvasOp[];
  /** Write a scalar input, exactly as `collab-plumbing.ts` mints one: a `param` op on
   *  this device's Lamport counter, delivered through the adapter's single-op door. */
  set(key: string, value: ParamValue): void;
  /** Write a blocks collection through the adapter's gesture door. */
  rows(col: string, rows: Record<string, Record<string, string | number | boolean | null>>): void;
  params(): Record<string, unknown>;
  boxes(col: string): Record<string, Record<string, unknown>>;
}

interface PairOptions {
  readonly backstopMs?: number;
  readonly stateChunkOps?: number;
  readonly stateChunkGapMs?: number;
  readonly opsPerMessage?: number;
}

interface Pair {
  readonly a: Side;
  readonly b: Side;
  /** Run the coalescing hop on both sides - the microtask a real handle would take. */
  flush(): void;
  /** Advance both clocks. */
  advance(ms: number): void;
}

function makeSide(
  id: string,
  role: 'inviter' | 'acceptor',
  scheduler: { schedule: (fn: () => void) => void },
  opts: PairOptions,
): Side {
  const transport = new FakeTransport(id);
  const clock = new TestClock();
  const handle = createRtcCollabHandle({
    transport,
    role,
    self: { clientId: id, name: id.toLowerCase(), colorIndex: role === 'inviter' ? 0 : 1 },
    timers: clock,
    now: () => clock.now,
    schedule: scheduler.schedule,
    ...(opts.backstopMs === undefined ? {} : { backstopMs: opts.backstopMs }),
    ...(opts.stateChunkOps === undefined ? {} : { stateChunkOps: opts.stateChunkOps }),
    ...(opts.stateChunkGapMs === undefined ? {} : { stateChunkGapMs: opts.stateChunkGapMs }),
    ...(opts.opsPerMessage === undefined ? {} : { opsPerMessage: opts.opsPerMessage }),
  });

  const inbound: CanvasOp[] = [];
  // The device Lamport counter `collab-plumbing.ts` holds, absorbed from every op we
  // see so a local write is causally after everything applied (plans/99 section 8).
  let lamport = 0;
  handle.opsIn.subscribe((ops) => {
    for (const op of ops) {
      inbound.push(op);
      if (op.origin.clock > lamport) lamport = op.origin.clock;
    }
  });

  return {
    id,
    handle,
    transport,
    clock,
    inbound,
    set(key, value) {
      lamport += 1;
      handle.adapter.apply({ k: 'param', key, value, origin: { client: id, clock: lamport } });
    },
    rows(col, rows) {
      const map = new Map(Object.entries(rows));
      handle.adapter.onLocalChange(NO_DAMAGE, map, col);
    },
    params() {
      const out: Record<string, unknown> = {};
      for (const [key, value] of handle.docState().params) out[key] = value;
      return out;
    },
    boxes(col) {
      const out: Record<string, Record<string, unknown>> = {};
      const store = handle.docState().collections?.get(col);
      if (!store) return out;
      for (const id2 of store.order) {
        const row = store.boxes.get(id2);
        if (row) out[id2] = { ...row };
      }
      return out;
    },
  };
}

function makePair(opts: PairOptions = {}): Pair {
  const scheduler = makeScheduler();
  const a = makeSide('AAA', 'inviter', scheduler, opts);
  const b = makeSide('BBB', 'acceptor', scheduler, opts);
  a.transport.peer = b.transport;
  b.transport.peer = a.transport;
  return {
    a,
    b,
    flush() {
      scheduler.run();
    },
    advance(ms) {
      a.clock.advance(ms);
      b.clock.advance(ms);
      scheduler.run();
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────────

test('a real transport still satisfies the subset a session asks for', () => {
  // The assignment is the whole test: the exported conditional type resolves to
  // `never` the moment `RtcTransport` stops satisfying `RtcHandleTransport`, and
  // `= true` then fails `tsc` rather than production. It lives here because a type
  // alias alone proves nothing - nothing consumes it in the module.
  const proof: RtcTransportSatisfiesHandleTransport = true;
  assert.equal(proof, true);
});

test('the hello negotiates the shared-history capability; an older peer leaves it off', () => {
  const pair = makePair();
  // Before the peer's hello arrives, sharing is unavailable - never assumed.
  assert.equal(pair.a.handle.peerHistoryProtocol(), undefined);
  assert.equal(pair.a.handle.historySharingAvailable(), false);

  // A peer that announces the same capability: both sides agree, and the exchange
  // protocol may open behind this gate.
  pair.a.transport.hello('BBB', CANVAS_OP_VERSION, HISTORY_PROTOCOL_VERSION);
  assert.equal(pair.a.handle.peerHistoryProtocol(), HISTORY_PROTOCOL_VERSION);
  assert.equal(pair.a.handle.historySharingAvailable(), true);

  // An older peer omits it: recorded as absent, sharing stays off, and ordinary
  // editing is unaffected (the memory-only session history keeps working).
  const older = makePair();
  older.a.transport.hello('BBB', CANVAS_OP_VERSION);
  assert.equal(older.a.handle.peerHistoryProtocol(), undefined);
  assert.equal(older.a.handle.historySharingAvailable(), false);
  older.a.set('title', 'still editable');
  older.flush();
  assert.equal(older.b.params().title, 'still editable', 'editing survives a peer with no history capability');

  // An unrecognised future capability is not mistaken for agreement.
  const future = makePair();
  future.a.transport.hello('BBB', CANVAS_OP_VERSION, 'history-v2');
  assert.equal(future.a.handle.peerHistoryProtocol(), 'history-v2');
  assert.equal(future.a.handle.historySharingAvailable(), false);
});

test('each side exposes an ephemeral session history the leave disposes', async () => {
  const pair = makePair();
  const host = pair.a.handle.history; // 'AAA' is the inviter
  const invitee = pair.b.handle.history; // 'BBB' is the acceptor
  assert.ok(host && invitee, 'both sides expose a transport history');
  assert.equal(host?.scope, 'shared', 'the inviter shares its session');
  assert.equal(invitee?.scope, 'memory', 'an invitee stays memory-scoped');
  assert.equal(invitee?.durability, 'session');
  assert.equal(invitee?.canRestore, false, 'shared P2P restore is deferred to the barrier protocol');
  assert.ok(isCapturableCollabHistory(invitee), 'the P2P history fills itself');
  if (isCapturableCollabHistory(invitee)) {
    invitee.capture({ documentId: 'd', toolId: 'design', actorId: 'BBB', data: { title: 'shared' } });
    assert.equal((await invitee.list()).entries.length, 1);
    pair.b.handle.close();
    assert.equal((await invitee.list()).entries.length, 0, 'leaving drops every retained checkpoint');
  }
});

test('two handles converge on interleaved ops', () => {
  const pair = makePair();

  pair.a.set('title', 'a-first');
  pair.flush();
  pair.b.set('subtitle', 'b-first');
  pair.flush();
  pair.a.set('subtitle', 'a-second');
  pair.flush();

  assert.deepEqual(pair.a.params(), { title: 'a-first', subtitle: 'a-second' });
  assert.deepEqual(pair.b.params(), pair.a.params());

  // Concurrent: both write the same key before either flush reaches the other, so the
  // two ops carry the same Lamport clock and the tie breaks on client id ('BBB' wins).
  pair.a.set('title', 'concurrent-a');
  pair.b.set('title', 'concurrent-b');
  pair.flush();

  assert.deepEqual(pair.a.params(), pair.b.params(), 'the pair must agree');
  assert.equal(pair.a.params().title, 'concurrent-b', 'the higher client id wins an equal clock');

  // A collection gesture crosses the same way, scoped by `col`.
  pair.a.rows('items', { r1: { text: 'one' } });
  pair.flush();
  pair.b.rows('items', { r1: { text: 'one' }, r2: { text: 'two' } });
  pair.flush();

  assert.deepEqual(pair.b.boxes('items'), { r1: { text: 'one' }, r2: { text: 'two' } });
  assert.deepEqual(pair.a.boxes('items'), pair.b.boxes('items'));
});

test('the backstop repairs a dropped op, and stays quiet when nothing changed', () => {
  const pair = makePair({ backstopMs: 20_000 });

  // The lane loses exactly one frame - reliable-ordered SCTP makes this rare, which
  // is precisely why nothing else in the system would ever notice.
  pair.a.transport.dropOps = 1;
  pair.a.set('title', 'survives');
  pair.flush();

  assert.deepEqual(pair.a.params(), { title: 'survives' });
  assert.deepEqual(pair.b.params(), {}, 'the frame was lost, so the pair has diverged');

  pair.advance(20_000);

  assert.deepEqual(pair.b.params(), { title: 'survives' }, 'the exchange repaired it');
  assert.deepEqual(pair.a.params(), pair.b.params());

  // Nothing has changed since, so the next tick must cost NOTHING (section 6.2's "only when
  // dirty" - a pair that is idle stays silent).
  const framesBefore = pair.a.transport.opsOut.length;
  pair.advance(20_000);
  assert.equal(pair.a.transport.opsOut.length, framesBefore, 'an idle side sends no exchange');

  // …and a fresh edit re-arms it.
  pair.a.transport.dropOps = 1;
  pair.a.set('title', 'again');
  pair.flush();
  assert.equal(pair.b.params().title, 'survives');
  pair.advance(20_000);
  assert.equal(pair.b.params().title, 'again');
});

test('a state exchange states membership before the fields that need it', () => {
  const pair = makePair({ backstopMs: 20_000 });

  pair.a.rows('items', { r1: { text: 'one' } });
  pair.flush();
  // A second gesture on the same row: the row's `text` register now belongs to a
  // `field` op, while membership and paint order still belong to the `add`.
  pair.a.transport.dropOps = 1;
  pair.a.rows('items', { r1: { text: 'two' } });
  pair.flush();

  assert.deepEqual(pair.b.boxes('items'), { r1: { text: 'one' } }, 'the edit was lost');

  const before = pair.a.transport.frames().length;
  pair.advance(20_000);
  const exchange = pair.a.transport.frames().slice(before).flat();

  assert.ok(exchange.length >= 2, 'the exchange restates the add and the field write');
  const lastAdd = exchange.map((op) => op.k).lastIndexOf('add');
  const firstWrite = exchange.findIndex((op) => op.k === 'field' || op.k === 'geom');
  assert.ok(lastAdd >= 0 && firstWrite >= 0);
  assert.ok(lastAdd < firstWrite, 'adds precede field writes so a model rebuild agrees');
  assert.equal(
    exchange.filter((op) => op.k === 'add').length,
    1,
    'one op per register: the add is stated once, not once per field it owns',
  );

  assert.deepEqual(pair.b.boxes('items'), { r1: { text: 'two' } });
  assert.deepEqual(pair.a.boxes('items'), pair.b.boxes('items'));
});

test('an op we already hold is never applied a second time', () => {
  const pair = makePair();

  pair.a.set('title', 'mine');
  pair.flush();
  assert.equal(pair.b.inbound.length, 1);

  // B's backstop holds the whole converged document, ops that originated on A
  // included, so its exchange legitimately restates them back at A.
  const inboundBefore = pair.a.inbound.length;
  pair.b.handle.exchangeState();
  pair.flush();

  assert.equal(pair.a.inbound.length, inboundBefore, 'a restatement of what we hold is inert');
  assert.deepEqual(pair.a.params(), { title: 'mine' });

  // The same restatement is not inert for a side that lost it: B drops its copy by
  // starting from nothing (a fresh acceptor), and the exchange seeds it.
  const fresh = makePair();
  fresh.a.set('title', 'seed');
  fresh.flush();
  assert.deepEqual(fresh.b.params(), { title: 'seed' });
});

test('a peer on an incompatible op major makes this side observer-only', () => {
  const pair = makePair();
  const roles: string[] = [];
  pair.a.handle.roleIn.subscribe((role) => roles.push(role));

  assert.equal(pair.a.handle.role, 'writer');
  assert.deepEqual(roles, ['writer'], 'the role stream replays on subscribe');

  pair.a.transport.hello('BBB', '2.0.0');

  assert.equal(pair.a.handle.role, 'observer');
  assert.deepEqual(roles, ['writer', 'observer']);
  assert.equal(pair.a.handle.reason(), 'op-version');
  assert.equal(pair.a.handle.peerOpVersion(), '2.0.0');
  assert.equal(pair.a.handle.peerRole('BBB'), 'observer', 'the peer cannot write to us either');
  assert.equal(pair.a.handle.peerRole('nobody'), undefined, 'honest ignorance, never a guess');

  // An observer's edits reach neither its own document nor the wire.
  const framesBefore = pair.a.transport.opsOut.length;
  pair.a.set('title', 'not allowed');
  pair.flush();
  assert.deepEqual(pair.a.params(), {});
  assert.equal(pair.a.transport.opsOut.length, framesBefore);
  assert.deepEqual(pair.b.params(), {});

  // A compatible minor is not a demotion (section 11.19 - PWA staleness makes skew routine).
  const other = makePair();
  other.a.transport.hello('BBB', '1.9.0');
  assert.equal(other.a.handle.role, 'writer');
  assert.equal(other.a.handle.peerRole('BBB'), 'writer');
});

test('the inviter is the host on both sides (section 6.2a)', () => {
  const pair = makePair();

  assert.equal(pair.a.handle.hostClientId, 'AAA', 'the inviter owns the session');
  assert.equal(pair.b.handle.hostClientId, undefined, 'the acceptor has not met anyone yet');
  assert.equal(pair.b.handle.peerClientId(), undefined);

  // The transport sends its hello the moment the ops lane opens.
  pair.b.transport.hello('AAA', '1.1.0');
  pair.a.transport.hello('BBB', '1.1.0');

  assert.equal(pair.b.handle.hostClientId, 'AAA', 'the acceptor learns the host in band');
  assert.equal(pair.a.handle.hostClientId, 'AAA', 'and the inviter never stops being it');
  assert.equal(pair.b.handle.peerClientId(), 'AAA');
  assert.equal(pair.a.handle.peerClientId(), 'BBB');
});

test('presence rides its own lane, and our own frame never comes back', () => {
  const pair = makePair();
  const seen: PresenceFrame[] = [];
  pair.a.handle.presenceIn.subscribe((frame) => seen.push(frame));

  pair.b.handle.sendPresence({
    from: 'BBB',
    seq: 1,
    state: { userId: 'BBB', name: 'bbb', color: '#123456', focus: 'title' },
  });

  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.from, 'BBB');
  assert.equal(seen[0]?.state?.focus, 'title');
  assert.equal(pair.b.transport.presenceOut.length, 1, 'the frame went out verbatim');

  // A relay that echoed our own frame back must never become our own roster entry.
  pair.a.transport.deliver({
    lane: 'presence',
    kind: 'presence',
    frame: { from: 'AAA', seq: 9, state: { userId: 'AAA', name: 'aaa', color: '#abcdef' } },
  });
  assert.equal(seen.length, 1);
});

test('close tears down every timer, the transport, and the streams', () => {
  const pair = makePair({ backstopMs: 20_000 });
  const states: CollabConnectionState[] = [];
  pair.a.handle.events.subscribe((state) => states.push(state));

  assert.deepEqual(states, ['live'], 'the connection stream replays, or a live pair reads as connecting forever');
  assert.ok(pair.a.clock.pending() > 0, 'the backstop is armed');

  pair.a.set('title', 'before closing');
  pair.a.handle.close();

  assert.equal(pair.a.clock.pending(), 0, 'close() leaves ZERO armed timers');
  assert.equal(pair.a.transport.closed, true);
  assert.deepEqual(states, ['live', 'closed']);
  assert.equal(pair.b.params().title, 'before closing', 'the last gesture still went out');

  // Idempotent, and inert afterwards.
  pair.a.handle.close();
  const framesBefore = pair.a.transport.opsOut.length;
  pair.a.set('title', 'after closing');
  pair.flush();
  assert.equal(pair.a.transport.opsOut.length, framesBefore);
  assert.equal(pair.a.clock.pending(), 0);
});

test('a transport failure surfaces on the handle events', () => {
  const pair = makePair({ backstopMs: 20_000 });
  const states: CollabConnectionState[] = [];
  pair.a.handle.events.subscribe((state) => states.push(state));

  // A UDP blip is not death (section 11.3): it greys the avatar and evicts nobody.
  pair.a.transport.setConnection('reconnecting');
  assert.deepEqual(states, ['live', 'reconnecting']);

  // Edits made during the blip cannot reach the wire, so the side stays dirty…
  pair.a.set('title', 'typed while dropped');
  pair.flush();
  assert.deepEqual(pair.b.params(), {});

  // …and the recovery restates them without waiting out the backstop.
  pair.a.transport.setConnection('live');
  assert.deepEqual(states, ['live', 'reconnecting', 'live']);
  assert.deepEqual(pair.b.params(), { title: 'typed while dropped' });

  // ICE `failed` is death: the transport reports closed, and so does the handle.
  pair.a.transport.setConnection('closed');
  assert.deepEqual(states, ['live', 'reconnecting', 'live', 'closed']);
  assert.equal(pair.a.clock.pending(), 0, 'a closed transport disarms the backstop');
});

test('a big exchange is chunked, paced, and halved onto the frame ceiling', () => {
  const pair = makePair({ backstopMs: 20_000, stateChunkOps: 2, stateChunkGapMs: 1_000 });

  // One dropped frame loses all five ops: a gesture's ops are coalesced into one.
  pair.a.transport.dropOps = 1;
  for (const key of ['one', 'two', 'three', 'four', 'five']) pair.a.set(key, key);
  pair.flush();
  assert.equal(pair.a.transport.frames().length, 1, 'one coalescing hop, one frame');
  assert.deepEqual(pair.b.params(), {}, 'and that frame was lost');

  // The SCTP ceiling refuses anything over two ops here, so the halving path runs on
  // top of the pacing.
  pair.a.transport.maxOpsPerFrame = 2;
  const before = pair.a.transport.frames().length;
  pair.advance(20_000);

  const first = pair.a.transport.frames().slice(before);
  assert.ok(first.length >= 1);
  assert.equal(Object.keys(pair.b.params()).length, 2, 'only the first chunk has gone out');

  pair.advance(1_000);
  pair.advance(1_000);

  assert.deepEqual(pair.b.params(), { one: 'one', two: 'two', three: 'three', four: 'four', five: 'five' });
  for (const frame of pair.a.transport.frames().slice(before)) {
    assert.ok(frame.length <= 2, 'no frame exceeds what the lane will carry');
  }

  // The exchange landed in full, so the side is clean again: the next tick is silent.
  const settled = pair.a.transport.opsOut.length;
  pair.advance(20_000);
  assert.equal(pair.a.transport.opsOut.length, settled);
});

test('an edit made mid-exchange, if the lane drops it, is not swallowed by the exchange landing', () => {
  const pair = makePair({ backstopMs: 20_000, stateChunkOps: 2, stateChunkGapMs: 1_000 });

  // Five keys, one dropped coalescing frame - the same 3-chunk exchange (2, 2, 1)
  // the "big exchange" test above paces.
  pair.a.transport.dropOps = 1;
  for (const key of ['one', 'two', 'three', 'four', 'five']) pair.a.set(key, key);
  pair.flush();
  assert.deepEqual(pair.b.params(), {}, 'and that frame was lost');

  // The backstop fires and lands chunk 1 of 3. Chunks 2 and 3 are still queued,
  // paced 1s apart - the exchange is mid-flight.
  pair.advance(20_000);
  assert.equal(Object.keys(pair.b.params()).length, 2, 'only the first chunk has landed so far');

  // A brand-new local edit, made WHILE that exchange is still pacing - and its own
  // live frame is the one the lane drops this time. This is exactly the case the
  // exchange's snapshot (taken before any of this happened, in `exchangeState()`)
  // cannot cover: 'midway' is not one of the five keys being restated, so nothing
  // about finishing that restatement should mean this edit is repaired.
  pair.a.transport.dropOps = 1;
  pair.a.set('midway', 'edit');
  pair.flush();
  assert.equal(pair.b.params().midway, undefined, 'that edit was lost too');

  // Let the in-flight exchange finish landing, in full.
  pair.advance(1_000);
  pair.advance(1_000);
  assert.deepEqual(
    pair.b.params(), { one: 'one', two: 'two', three: 'three', four: 'four', five: 'five' },
    'the exchange completed - but it was never snapshotted with the sixth key',
  );
  assert.equal(pair.b.params().midway, undefined, "and 'midway' is correctly still missing");

  // The exchange fully landed, but a local edit outran its snapshot: the divergence
  // backstop must still treat this side as dirty, or 'midway' has no repair path
  // left until some UNRELATED edit happens to re-arm it (section 6.2 - "cleared only by an
  // exchange that fully landed" is not the same claim as "cleared only when nothing
  // has changed since the exchange was built").
  pair.advance(20_000);
  assert.equal(pair.b.params().midway, 'edit', 'the next tick repairs the edit the first exchange missed');
});

test('inbound ops are refused before they can become state (section 11.21)', () => {
  // A forbidden key is a cap breach: the peer is disconnected, not throttled.
  const forbidden = makePair();
  forbidden.a.transport.deliver({
    lane: 'ops',
    kind: 'op',
    op: [{ k: 'add', id: 'r1', row: JSON.parse('{"__proto__": 1}'), orderKey: 'i', origin: { client: 'BBB', clock: 1 } }],
  });
  assert.equal(forbidden.a.handle.reason(), 'op-forbidden-key');
  assert.equal(forbidden.a.transport.closed, true);
  assert.deepEqual(forbidden.a.handle.docState().boxes.size, 0);

  // A clock outside the safe-integer band would win every future merge for the life
  // of the document - also a breach.
  const poison = makePair();
  poison.a.transport.deliver({
    lane: 'ops',
    kind: 'op',
    op: [{ k: 'param', key: 'title', value: 'x', origin: { client: 'BBB', clock: 1e308 } }],
  });
  assert.equal(poison.a.handle.reason(), 'op-clock-out-of-range');
  assert.deepEqual(poison.a.params(), {});

  // An oversized batch is refused whole, on its length alone.
  const flood = makePair({ opsPerMessage: 4 });
  const batch = Array.from({ length: 5 }, (_, i) => ({
    k: 'param', key: `k${i}`, value: i, origin: { client: 'BBB', clock: i + 1 },
  }));
  flood.a.transport.deliver({ lane: 'ops', kind: 'op', op: batch });
  assert.equal(flood.a.handle.reason(), 'op-batch-too-large');
  assert.deepEqual(flood.a.params(), {});

  // A merely unrecognisable op is DROPPED - section 11.11's "never the batch, never a throw"
  // - and the session carries on.
  const skew = makePair();
  skew.a.transport.deliver({
    lane: 'ops',
    kind: 'op',
    op: [
      { k: 'from-the-future', id: 'r1', origin: { client: 'BBB', clock: 1 } },
      { k: 'param', key: 'title', value: 'kept', origin: { client: 'BBB', clock: 2 } },
    ],
  });
  assert.equal(skew.a.handle.reason(), undefined, 'version skew is not abuse');
  assert.equal(skew.a.transport.closed, false);
  assert.deepEqual(skew.a.params(), { title: 'kept' });

  // NaN/Infinity pass the schema's `typeof` test and poison every layout downstream.
  const notFinite = makePair();
  notFinite.a.transport.deliver({
    lane: 'ops',
    kind: 'op',
    op: [{ k: 'geom', id: 'r1', col: 'items', fields: { x: Number.POSITIVE_INFINITY }, origin: { client: 'BBB', clock: 1 } }],
  });
  assert.equal(notFinite.a.transport.closed, false);
  assert.equal(notFinite.a.handle.docState().collections, undefined, 'nothing was applied');

  // A bare (unbatched) op is still accepted - the transport's payload is opaque.
  const bare = makePair();
  bare.a.transport.deliver({
    lane: 'ops',
    kind: 'op',
    op: { k: 'param', key: 'title', value: 'bare', origin: { client: 'BBB', clock: 1 } },
  });
  assert.deepEqual(bare.a.params(), { title: 'bare' });
});

test('registerKeys matches the gateway seam register grammar (opKeys)', () => {
  const origin = { client: 'AAA', clock: 3 };
  const corpus: CanvasOp[] = [
    { k: 'param', key: 'title', value: 'x', origin },
    { k: 'field', id: 'r1', field: 'text', value: 'x', origin },
    { k: 'field', id: 'r1', col: 'items', field: 'text', value: 'x', origin },
    { k: 'geom', id: 'r1', fields: { x: 1, y: 2 }, origin },
    { k: 'geom', id: 'r1', col: 'items', fields: { rot: 4 }, origin },
    { k: 'order', id: 'r1', orderKey: 'i', origin },
    { k: 'order', id: 'r1', col: 'items', orderKey: 'i', origin },
    { k: 'remove', id: 'r1', origin },
    { k: 'remove', id: 'r1', col: 'items', origin },
    { k: 'add', id: 'r1', row: { text: 'x', x: 1 }, orderKey: 'i', origin },
    { k: 'add', id: 'r1', col: 'items', row: {}, orderKey: 'i', origin },
  ];
  for (const op of corpus) {
    assert.deepEqual(registerKeys(op), opKeys(op), `drifted on ${op.k}`);
  }

  // The point of the grammar, not just its spelling: a geom write and a field write on
  // the same coordinate own the SAME register, so an index cannot hold both.
  assert.deepEqual(
    registerKeys({ k: 'geom', id: 'r1', fields: { x: 1 }, origin }),
    registerKeys({ k: 'field', id: 'r1', field: 'x', value: 1, origin }),
  );
});
