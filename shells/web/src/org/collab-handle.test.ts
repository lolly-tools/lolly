// SPDX-License-Identifier: MPL-2.0
/**
 * org/collab-handle.ts - the Track B handle adapter (plan 100 section 7, wave 3.2).
 *
 * Everything is driven through a FAKE PROVIDER: the real one's exported surface
 * (`adapter`, `connect`, `close`, `state`, `on`, `sendPresence`, `outbox`,
 * `persisted`) and nothing else, so this suite proves the ADAPTATION rather than the
 * socket - `collab-provider.test.ts` already owns the wire. No network, no DOM, no
 * IndexedDB, and the presence engine runs on injected fake time.
 *
 * What is worth pinning here is only what an adapter can get wrong, and each of
 * these has a specific way of failing silently:
 *
 *  1. ROLE comes from the gateway's ack and is never re-derived - and an observer
 *     role really does engage `collab-session`'s observer wrapper, which is the only
 *     thing that stops a local edit becoming an op.
 *  2. A peer's `from`/`seq` cross UNCHANGED. Re-stamping either would break the
 *     roster key or the newest-only rule (section 11.5) - silently, and only for the peer.
 *  3. The join-ack roster reaches the presence engine, a LIVER frame supersedes the
 *     placeholder it seeded, and the placeholder does not linger as a ghost.
 *  4. There is no host, so no participant is ever tagged one.
 *  5. `'reconnecting'` survives the status mapping instead of collapsing into
 *     `'connecting'` - the difference between "greying an avatar" and "the room is
 *     starting up".
 *  6. `close()` closes the provider, says `'closed'` on the way out, and leaves no
 *     subscription behind.
 *
 * Run directly:  node --test shells/web/src/org/collab-handle.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ReferenceCanvasDoc } from '@lolly-tools/core/canvas-op-v1';
import type {
  Awareness, BoxId, BoxRow, CanvasOp, CanvasSyncAdapter, Damage,
} from '@lolly-tools/core/canvas-op-v1';
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';
import type { CollabColor } from '../lib/collab-colors.ts';
import type { CollabRuntime } from '../lib/collab-plumbing.ts';
import type { PresenceFrame, PresenceState } from '../lib/collab-presence.ts';
import { createCollabSession } from '../lib/collab-session.ts';
import type { CollabConnectionState } from '../lib/collab-session.ts';
import {
  ROSTER_RETIRE_SEQ,
  ROSTER_SEED_SEQ,
  createWorkCollabHandle,
  readPresencePayload,
  statusToConnection,
} from './collab-handle.ts';
import type { RosterEntry } from './collab-protocol.ts';
import type {
  WorkCollabEvent,
  WorkCollabHandle,
  WorkCollabState,
  WorkCollabStatus,
} from './collab-provider.ts';

// ── fake time ─────────────────────────────────────────────────────────────────

function fakeClock() {
  let t = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: (): number => t,
    setTimer: (fn: () => void, ms: number): unknown => {
      const id = nextId++;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimer: (handle: unknown): void => { timers.delete(handle as number); },
    advance(ms: number): void {
      const until = t + ms;
      for (;;) {
        let id = -1;
        let due: { at: number; fn: () => void } | undefined;
        for (const [key, timer] of timers) {
          if (timer.at > until) continue;
          if (!due || timer.at < due.at) { due = timer; id = key; }
        }
        if (!due) break;
        timers.delete(id);
        t = due.at;
        due.fn();
      }
      t = until;
    },
    pending: (): number => timers.size,
  };
}

// ── the fake provider ─────────────────────────────────────────────────────────

/** A real converging adapter, with every LOCAL crossing recorded - which is how
 *  "an observer's edits never become ops" is observed from the outside. */
class RecordingAdapter implements CanvasSyncAdapter {
  readonly doc = new ReferenceCanvasDoc('work');
  readonly applied: CanvasOp[] = [];
  readonly remote: CanvasOp[][] = [];
  onLocalChange(damage: Damage, rows: Map<BoxId, BoxRow>, col?: string): CanvasOp[] {
    const ops = this.doc.onLocalChange(damage, rows, col);
    this.applied.push(...ops);
    return ops;
  }
  apply(op: CanvasOp): void { this.applied.push(op); this.doc.apply(op); }
  applyRemotePatch(ops: readonly CanvasOp[]): Damage {
    this.remote.push([...ops]);
    return this.doc.applyRemotePatch(ops);
  }
  presence(_a: Awareness): void { /* ephemeral */ }
  state() { return this.doc.state(); }
}

interface Fake {
  provider: WorkCollabHandle;
  adapter: RecordingAdapter;
  /** Outbound presence payloads, in order. */
  sent: PresenceFrame[];
  closes: number;
  subs(): number;
  /** Patch the provider state and emit the `state` event that goes with it. */
  setState(patch: Partial<WorkCollabState>): void;
  /** Deliver an inbound presence frame, as the gateway relays it. */
  presence(from: string, frame: unknown): void;
  state(): WorkCollabState;
}

function fakeProvider(initial: Partial<WorkCollabState> = {}): Fake {
  const adapter = new RecordingAdapter();
  const listeners = new Set<(event: WorkCollabEvent) => void>();
  const sent: PresenceFrame[] = [];
  let state: WorkCollabState = {
    status: 'idle',
    role: 'writer',
    roster: [],
    attempt: 0,
    pending: 0,
    queued: 0,
    unsynced: [],
    ...initial,
  };
  const emit = (event: WorkCollabEvent): void => {
    for (const fn of [...listeners]) fn(event);
  };
  const out: Fake = {
    adapter,
    sent,
    closes: 0,
    subs: () => listeners.size,
    state: () => state,
    setState(patch) {
      state = { ...state, ...patch };
      emit({ kind: 'state', state });
    },
    presence(from, frame) {
      emit({ kind: 'presence', from, frame });
    },
    provider: {
      sessionId: 'sess-1',
      adapter,
      connect: () => Promise.resolve(),
      close(): void {
        out.closes += 1;
        // Exactly the real provider's order: the final state is delivered, THEN the
        // subscribers are released.
        state = { ...state, status: 'closed' };
        emit({ kind: 'state', state });
        listeners.clear();
      },
      state: () => state,
      on(listener) {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      },
      sendPresence(frame) { sent.push(frame as PresenceFrame); },
      outbox: () => [],
      persisted: () => Promise.resolve(),
    },
  };
  return out;
}

const member = (over: Partial<RosterEntry> & { userId: string }): RosterEntry => ({ ...over });

// ── a session, with nothing but the pieces this file needs ────────────────────

const text = (id: string, value: InputValue): InputModelItem =>
  ({ id, type: 'text', value, isDirty: false, control: 'text-input' });

/** A runtime wired the way mountTool wires one. */
function harness(items: InputModelItem[]): CollabRuntime {
  let model = items.map(i => ({ ...i }));
  const write = (id: string, value: unknown): void => {
    model = model.map(i => (i.id === id ? { ...i, value: value as InputValue } : i));
  };
  return {
    getModel: () => model,
    async setInput(id, value) { write(id, value); },
    async applyPatch(values) {
      for (const [id, v] of Object.entries(values)) if (model.some(i => i.id === id)) write(id, v);
    },
  };
}

const swatch = (hex: string, hue: number): CollabColor =>
  ({ hex, hue, source: 'spun', lc: { light: 41, dark: 42 } });
const COLORS: CollabColor[] = [swatch('#aa0000', 20), swatch('#00aa00', 140), swatch('#0000aa', 260)];

const peerState = (over: Partial<PresenceState> = {}): PresenceState =>
  ({ userId: 'U', name: '', color: '', ...over } as PresenceState);

/** The session under test, over a work handle. `doc: null` opts out of
 *  `visibilitychange` entirely, so nothing here needs a DOM. */
function session(fake: Fake, clientId = 'DEVICE-SELF') {
  const clock = fakeClock();
  const runtime = harness([text('title', '')]);
  const handle = createWorkCollabHandle(fake.provider, { clientId });
  const s = createCollabSession({
    handle,
    runtime,
    colors: COLORS,
    doc: null,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    raf: (fn) => { fn(); },
  });
  return { handle, session: s, runtime, clock };
}

// ── the cases ─────────────────────────────────────────────────────────────────

test('status maps onto the connection alphabet, and reconnecting survives it', () => {
  const seen: Record<WorkCollabStatus, CollabConnectionState> = {
    idle: statusToConnection('idle'),
    connecting: statusToConnection('connecting'),
    joining: statusToConnection('joining'),
    live: statusToConnection('live'),
    reconnecting: statusToConnection('reconnecting'),
    closed: statusToConnection('closed'),
  };
  assert.deepEqual(seen, {
    idle: 'connecting',
    connecting: 'connecting',
    joining: 'connecting',
    live: 'live',
    // Not 'connecting': a reconnect keeps the roster and evicts nobody (section 11.3).
    reconnecting: 'reconnecting',
    closed: 'closed',
  });
});

test('a presence payload is read as a frame, a bare Presence, or not at all', () => {
  const wrapped = readPresencePayload({ from: 'D1', seq: 7, state: peerState({ userId: 'u1' }), away: true });
  assert.deepEqual(wrapped, { from: 'D1', seq: 7, away: true, state: peerState({ userId: 'u1' }) });

  const leave = readPresencePayload({ from: 'D1', seq: 8, state: null });
  assert.equal(leave?.state, null, 'a clean leave is a frame with a null state, not junk');

  const bare = readPresencePayload({ userId: 'u1', name: 'Priya', color: '#aa0000' });
  assert.equal(bare?.from, undefined, 'an unenveloped Awareness carries no from/seq');
  assert.equal(bare?.seq, undefined);
  assert.equal((bare?.state as PresenceState).name, 'Priya');

  for (const junk of [null, undefined, 'frame', 42, [1, 2], { hello: 'world' }]) {
    assert.equal(readPresencePayload(junk), null, `rejected: ${JSON.stringify(junk)}`);
  }
});

test('role comes from the ack, live - including a mid-session downgrade', () => {
  const fake = fakeProvider();
  const handle = createWorkCollabHandle(fake.provider, { clientId: 'DEVICE-SELF' });
  assert.equal(handle.role, 'writer', 'the provider default, before any ack');

  fake.setState({ status: 'live', role: 'observer', reason: 'no-edit-grant' });
  assert.equal(handle.role, 'observer', 'read through to the provider, never cached');

  fake.setState({ role: 'writer' });
  assert.equal(handle.role, 'writer');

  // Fail closed on anything that is not a stated writer - the same reading the
  // provider takes of an ack that declares no role at all.
  fake.setState({ role: 'nonsense' as unknown as WorkCollabState['role'] });
  assert.equal(handle.role, 'observer');
});

test("an observer's edits never become ops: the session's wrapper engages", async () => {
  const observing = fakeProvider({ status: 'live', role: 'observer' });
  const w = session(observing);
  assert.equal(w.session.state().role, 'observer', 'the pill reads the ack');
  await w.runtime.setInput('title', 'typed by an observer');
  assert.deepEqual(observing.adapter.applied, [], 'read everything, write nothing (contract section 9)');
  w.session.close();

  // The same edit, as a writer, to prove the suppression above is the ROLE and not
  // a broken harness.
  const writing = fakeProvider({ status: 'live', role: 'writer' });
  const v = session(writing);
  await v.runtime.setInput('title', 'typed by a writer');
  assert.equal(writing.adapter.applied.length, 1);
  assert.equal(writing.adapter.applied[0]?.k, 'param');
  v.session.close();
});

test('a peer frame crosses with its own from and seq - never re-stamped', () => {
  const fake = fakeProvider({ status: 'live' });
  const handle = createWorkCollabHandle(fake.provider, { clientId: 'DEVICE-SELF' });
  const seen: PresenceFrame[] = [];
  handle.presenceIn.subscribe(f => { seen.push(f); });

  // `from` on the gateway frame is the sender's CONNECTION id; the frame's own
  // `from` is the per-device client id the roster is keyed by. The device id wins.
  fake.presence('conn-9', { from: 'DEVICE-P1', seq: 41, state: peerState({ userId: 'priya' }), away: true });
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.from, 'DEVICE-P1');
  assert.equal(seen[0]?.seq, 41, 'the sender\'s counter, carried verbatim (section 11.5)');
  assert.equal(seen[0]?.away, true);

  // A bare Awareness has no envelope: the gateway's connection id names the sender
  // and the seq is minted above everything seen for it.
  fake.presence('conn-7', { userId: 'sam', name: 'Sam', color: '#00aa00' });
  assert.equal(seen[1]?.from, 'conn-7');
  assert.equal(seen[1]?.seq, 1);
  fake.presence('conn-7', { userId: 'sam', name: 'Sam', color: '#00aa00' });
  assert.equal(seen[2]?.seq, 2, 'a minted counter is strictly increasing per sender');

  // Our own frame relayed back is never forwarded.
  fake.presence('conn-1', { from: 'DEVICE-SELF', seq: 99, state: peerState() });
  assert.equal(seen.length, 3);
});

test('the join-ack roster seeds the engine, and a live frame supersedes the seed', () => {
  const fake = fakeProvider();
  const w = session(fake);

  // The ack: one incumbent, whose device has said nothing (it is alone, so its own
  // engine is silent - the deadlock this seeding exists to break).
  fake.setState({
    status: 'live',
    roster: [member({ id: 'conn-priya', userId: 'priya', name: 'Priya', color: '#00aa00', role: 'writer' })],
  });

  let peers = w.session.state().peers;
  assert.equal(peers.length, 1, 'the room is visible from the roster alone');
  assert.equal(peers[0]?.clientId, 'conn-priya', 'keyed by the connection id - the wire carries no device id');
  assert.equal(peers[0]?.name, 'Priya');
  assert.equal(peers[0]?.role, 'writer', 'peerRole resolved through the roster');
  assert.ok(fake.sent.length >= 1, 'and having a peer is what makes us announce ourselves at all');

  // Priya's device answers. Her real frame arrives under her DEVICE id, so the
  // placeholder is retired rather than superseded in place.
  fake.presence('conn-priya', {
    from: 'DEVICE-PRIYA',
    seq: 1,
    state: peerState({ userId: 'priya', name: 'Priya', color: '#00aa00' }),
  });

  peers = w.session.state().peers;
  assert.equal(peers.length, 1, 'exactly one Priya - the placeholder did not become a ghost');
  assert.equal(peers[0]?.clientId, 'DEVICE-PRIYA');
  assert.equal(peers[0]?.role, 'writer', 'still resolved, now through the device to the principal');

  // The roster still lists her connection; the retired placeholder must not come back.
  fake.setState({ attempt: 0 });
  assert.deepEqual(w.session.state().peers.map(p => p.clientId), ['DEVICE-PRIYA']);

  w.session.close();
  assert.equal(w.clock.pending(), 0, 'and the session left no timer armed');
});

test('the seed can never mask a live frame: seq 0 out, seq 1 to retire', () => {
  const fake = fakeProvider();
  const handle = createWorkCollabHandle(fake.provider, { clientId: 'DEVICE-SELF' });
  const seen: PresenceFrame[] = [];
  handle.presenceIn.subscribe(f => { seen.push(f); });

  fake.setState({ status: 'live', roster: [member({ id: 'conn-a', userId: 'ada', name: 'Ada' })] });
  assert.equal(seen[0]?.seq, ROSTER_SEED_SEQ);
  assert.equal(ROSTER_SEED_SEQ, 0, 'below every seq the presence engine can ever mint');
  assert.deepEqual(seen[0]?.state, { userId: 'ada', name: 'Ada', color: '' });

  fake.presence('conn-a', { from: 'DEVICE-ADA', seq: 1, state: peerState({ userId: 'ada' }) });
  // Forward FIRST, retire second - so the two rows never both exist across a paint.
  assert.equal(seen[1]?.from, 'DEVICE-ADA');
  assert.equal(seen[2]?.from, 'conn-a');
  assert.equal(seen[2]?.state, null, 'the placeholder leaves cleanly');
  assert.equal(seen[2]?.seq, ROSTER_RETIRE_SEQ);
});

test('a roster row that leaves takes its placeholder with it, and may return', () => {
  const fake = fakeProvider();
  const w = session(fake);
  fake.setState({ status: 'live', roster: [member({ id: 'conn-a', userId: 'ada', name: 'Ada' })] });
  assert.equal(w.session.state().peers.length, 1);

  fake.setState({ roster: [] });
  assert.equal(w.session.state().peers.length, 0, 'the server said they went');

  // A genuine rejoin on the same connection id is seeded again: only a placeholder
  // that a REAL frame replaced is blocked from returning.
  fake.setState({ roster: [member({ id: 'conn-a', userId: 'ada', name: 'Ada' })] });
  assert.deepEqual(w.session.state().peers.map(p => p.clientId), ['conn-a']);
  w.session.close();
});

test('a subscriber that arrives after the ack still gets the room', () => {
  const fake = fakeProvider({
    status: 'live',
    roster: [member({ id: 'conn-a', userId: 'ada', name: 'Ada' })],
  });
  const handle = createWorkCollabHandle(fake.provider, { clientId: 'DEVICE-SELF' });
  const seen: PresenceFrame[] = [];
  const stop = handle.presenceIn.subscribe(f => { seen.push(f); });
  assert.equal(seen.length, 1, 'replayed on subscribe - no state event will restate it');
  assert.equal(seen[0]?.from, 'conn-a');
  stop();
});

test('nobody is the host, so nobody is tagged one', () => {
  const fake = fakeProvider();
  const w = session(fake);
  assert.equal(w.handle.hostClientId, undefined, 'the server owns the session, not a peer (section 7.10)');
  assert.equal(Object.hasOwn(w.handle, 'hostClientId'), false, 'absent, not undefined-valued');

  fake.setState({ status: 'live', roster: [member({ id: 'conn-a', userId: 'ada', name: 'Ada' })] });
  fake.presence('conn-a', { from: 'DEVICE-ADA', seq: 1, state: peerState({ userId: 'ada', name: 'Ada' }) });

  const state = w.session.state();
  assert.equal(state.self.isHost, false);
  assert.deepEqual(state.peers.map(p => p.isHost), [false]);
  w.session.close();
});

test('an anonymous work peer is still never numbered against a host', () => {
  // The invitee ordinals are Track A copy (section 4.5). With no host declared, `isHost` is
  // false for everyone and the numbering falls back to plain client-id order - which
  // is exactly what it should do, and never "Invitee 2" beside a "Host" that is not
  // there.
  const fake = fakeProvider();
  const w = session(fake);
  fake.presence('conn-x', { from: 'DEVICE-X', seq: 1, state: peerState({ userId: 'x', name: '' }) });
  const peer = w.session.state().peers[0];
  assert.equal(peer?.isHost, false);
  assert.ok((peer?.inviteeIndex ?? 0) > 0, 'numbered as an anonymous participant, not as a host');
  w.session.close();
});

test('connection events: the current state on subscribe, then changes only', () => {
  const fake = fakeProvider();
  const handle = createWorkCollabHandle(fake.provider, { clientId: 'DEVICE-SELF' });
  const seen: CollabConnectionState[] = [];
  handle.events.subscribe(s => { seen.push(s); });
  assert.deepEqual(seen, ['connecting'], 'idle reads as connecting');

  fake.setState({ status: 'connecting' });
  fake.setState({ status: 'joining' });
  assert.deepEqual(seen, ['connecting'], 'three statuses, one thing a human sees');

  fake.setState({ status: 'live' });
  fake.setState({ status: 'reconnecting', attempt: 1 });
  fake.setState({ status: 'connecting' });
  fake.setState({ status: 'live' });
  assert.deepEqual(seen, ['connecting', 'live', 'reconnecting', 'connecting', 'live']);
});

test('a reconnect greys the pill and evicts nobody', () => {
  const fake = fakeProvider();
  const w = session(fake);
  fake.setState({ status: 'live', roster: [member({ id: 'conn-a', userId: 'ada', name: 'Ada' })] });
  fake.presence('conn-a', { from: 'DEVICE-ADA', seq: 1, state: peerState({ userId: 'ada', name: 'Ada' }) });
  assert.equal(w.session.state().connection, 'live');

  fake.setState({ status: 'reconnecting', attempt: 1 });
  const state = w.session.state();
  assert.equal(state.connection, 'reconnecting');
  assert.deepEqual(state.peers.map(p => p.clientId), ['DEVICE-ADA'], 'a drop is not a leave (section 11.3)');
  w.session.close();
});

test('close(): the provider closes, the stream says so, and nothing is left subscribed', () => {
  const fake = fakeProvider({ status: 'live' });
  const handle = createWorkCollabHandle(fake.provider, { clientId: 'DEVICE-SELF' });
  const seen: CollabConnectionState[] = [];
  handle.events.subscribe(s => { seen.push(s); });
  handle.presenceIn.subscribe(() => { /* held open on purpose */ });
  assert.equal(fake.subs(), 1, 'one provider subscription for the whole handle');

  handle.close();
  assert.equal(fake.closes, 1);
  assert.deepEqual(seen, ['live', 'closed'], 'the final state reaches a subscriber that is still listening');
  assert.equal(fake.subs(), 0);

  handle.close();
  assert.equal(fake.closes, 1, 'idempotent');
});

test("close() still terminates the stream when the provider says nothing", () => {
  const fake = fakeProvider({ status: 'live' });
  // A provider whose close() is silent (a stub, a shell that already tore down):
  // the handle's own stream must still end in 'closed' rather than hang on 'live'.
  const silent: WorkCollabHandle = { ...fake.provider, close: () => { /* says nothing */ } };
  const handle = createWorkCollabHandle(silent, { clientId: 'DEVICE-SELF' });
  const seen: CollabConnectionState[] = [];
  handle.events.subscribe(s => { seen.push(s); });
  handle.close();
  assert.deepEqual(seen, ['live', 'closed']);
});

test('the session closing closes the transport exactly once', () => {
  const fake = fakeProvider({ status: 'live' });
  const w = session(fake);
  w.session.close();
  assert.equal(fake.closes, 1);
  w.session.close();
  assert.equal(fake.closes, 1);
});

test('self: the device client id, and the SSO name once the gateway states one', () => {
  const fake = fakeProvider();
  const handle = createWorkCollabHandle(fake.provider, { clientId: 'DEVICE-SELF', name: 'me@local' });
  assert.equal(handle.self.clientId, 'DEVICE-SELF');
  assert.equal(handle.self.name, 'me@local', 'the caller hint stands until the ack');
  fake.setState({ status: 'live', self: member({ id: 'conn-me', userId: 'andy', name: 'Andy Fitzsimon' }) });
  assert.equal(handle.self.name, 'Andy Fitzsimon', 'the gateway seat wins (section 7.8)');
  assert.equal(handle.self.colorIndex, undefined, 'this wire carries a hex, never a slot');
});

test('peerRole is honest ignorance when the gateway did not say', () => {
  const fake = fakeProvider({
    status: 'live',
    roster: [
      member({ id: 'conn-a', userId: 'ada', role: 'observer' }),
      member({ id: 'conn-b', userId: 'bo' }),
    ],
  });
  const handle = createWorkCollabHandle(fake.provider, { clientId: 'DEVICE-SELF' });
  assert.equal(handle.peerRole?.('conn-a'), 'observer');
  assert.equal(handle.peerRole?.('conn-b'), undefined, 'no tag beats a guessed "writer"');
  assert.equal(handle.peerRole?.('nobody'), undefined);
});

test('presence goes out verbatim, and a listener that throws cannot take the handle down', () => {
  const fake = fakeProvider({ status: 'live' });
  const handle = createWorkCollabHandle(fake.provider, { clientId: 'DEVICE-SELF' });
  const seen: PresenceFrame[] = [];
  handle.presenceIn.subscribe(() => { throw new Error('subscriber bug'); });
  handle.presenceIn.subscribe(f => { seen.push(f); });

  const frame: PresenceFrame = { from: 'DEVICE-SELF', seq: 3, state: peerState({ userId: 'andy' }) };
  handle.sendPresence(frame);
  assert.deepEqual(fake.sent, [frame], 'handed to the lane unchanged');

  fake.presence('conn-a', { from: 'DEVICE-ADA', seq: 1, state: peerState({ userId: 'ada' }) });
  assert.equal(seen.length, 1, 'the second subscriber still got its frame');
});

test('a clean leave discards that sender\'s bookkeeping, so a reload is admitted', () => {
  const fake = fakeProvider({ status: 'live' });
  const handle = createWorkCollabHandle(fake.provider, { clientId: 'DEVICE-SELF' });
  const seen: PresenceFrame[] = [];
  handle.presenceIn.subscribe(f => { seen.push(f); });

  // A device with no envelope of its own, counted up to 3 by the minted counter…
  fake.presence('conn-a', { userId: 'ada', name: 'Ada', color: '' });
  fake.presence('conn-a', { userId: 'ada', name: 'Ada', color: '' });
  fake.presence('conn-a', { userId: 'ada', name: 'Ada', color: '' });
  assert.deepEqual(seen.map(f => f.seq), [1, 2, 3]);

  // …then leaves, and comes back. The counter restarts, which is exactly what the
  // presence engine does with its own bookkeeping on a leave - and the engine has
  // dropped the peer, so a seq of 1 is accepted rather than read as stale.
  fake.presence('conn-a', { from: 'conn-a', seq: 4, state: null });
  fake.presence('conn-a', { userId: 'ada', name: 'Ada', color: '' });
  assert.equal(seen.at(-1)?.seq, 1);
});
