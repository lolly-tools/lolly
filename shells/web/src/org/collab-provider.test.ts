// SPDX-License-Identifier: MPL-2.0
/**
 * org/collab-provider.ts + org/collab-protocol.ts - the work-collab client
 * (plan 100 section 7, wave 3.1).
 *
 * Everything is driven through injected seams: a fake WebSocket constructor, a
 * Map-backed outbox store, a captured timer, and a deterministic jitter source. No
 * network, no IndexedDB, no DOM - so this suite proves the transport's behaviour
 * rather than the platform's.
 *
 * Run directly:  node --test shells/web/src/org/collab-provider.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import type { CanvasOp } from '@lolly-tools/core/canvas-op-v1';
import {
  COLLAB_CLOSE,
  MAX_OPS_PER_FRAME,
  chunkOps,
  collabSocketUrl,
  docStateToOps,
  heldKeyIndex,
  isCanvasOp,
  isCrossOriginSocket,
  isTerminalClose,
  parseServerFrame,
  withoutHeldKeys,
} from './collab-protocol.ts';
import type { CollabCloseEvent, CollabSocket, CollabSocketCtor } from './collab-protocol.ts';
import {
  _clearWorkCollabFactoryForTests,
  backoffDelay,
  collabOutboxKey,
  createWorkCollabProvider,
  getWorkCollabFactory,
  registerWorkCollabFactory,
} from './collab-provider.ts';
import type { CollabOutboxStore, WorkCollabEvent, WorkCollabHandle } from './collab-provider.ts';

// ── Harness ───────────────────────────────────────────────────────────────────

/** The fake socket. Handler-form (`on*`) exactly like the real one, so "close()
 *  tears down listeners" is checkable by reading four fields. */
class FakeSocket implements CollabSocket {
  static made: FakeSocket[] = [];
  readonly url: string;
  readyState = 1;
  readonly sent: string[] = [];
  closedWith: number | null = null;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data?: unknown }) => void) | null = null;
  onclose: ((ev: CollabCloseEvent) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeSocket.made.push(this);
  }

  send(data: string): void { this.sent.push(data); }

  close(code?: number): void {
    this.readyState = 3;
    this.closedWith = code ?? null;
  }

  /** Drive the peer side. */
  opened(): void { this.onopen?.(undefined); }
  deliver(frame: unknown): void { this.onmessage?.({ data: JSON.stringify(frame) }); }
  dropped(code = 1006, reason?: string): void { this.onclose?.({ code, reason }); }

  frames(): Array<Record<string, unknown>> {
    return this.sent.map((s) => JSON.parse(s) as Record<string, unknown>);
  }

  framesOfType(t: string): Array<Record<string, unknown>> {
    return this.frames().filter((f) => f.t === t);
  }

  get live(): boolean {
    return !!(this.onopen || this.onmessage || this.onclose || this.onerror);
  }
}

interface Harness {
  handle: WorkCollabHandle;
  sockets: FakeSocket[];
  socket(): FakeSocket;
  events: WorkCollabEvent[];
  timers: Array<{ ms: number; fire: () => void }>;
  cleared: number;
  store: CollabOutboxStore & { data: Map<string, CanvasOp[]> };
}

function memoryStore(seed?: Map<string, CanvasOp[]>): CollabOutboxStore & { data: Map<string, CanvasOp[]> } {
  const data = seed ?? new Map<string, CanvasOp[]>();
  return {
    data,
    async load(key) { return data.get(key) ?? null; },
    async save(key, ops) { data.set(key, [...ops]); },
    async clear(key) { data.delete(key); },
  };
}

interface HarnessOptions {
  clientId?: string;
  store?: CollabOutboxStore & { data: Map<string, CanvasOp[]> };
  outboxLimit?: number;
  random?: () => number;
  reconnect?: boolean;
  principal?: string;
}

/** The scoped IDB key the harness's provider writes under - every test's session is
 *  'sess-1' on the explicit `url`'s origin (see `collabOutboxKey`). */
const KEY = (principal?: string): string =>
  collabOutboxKey('sess-1', { base: 'wss://example.test', principal });

async function harness(o: HarnessOptions = {}): Promise<Harness> {
  FakeSocket.made = [];
  const timers: Array<{ ms: number; fire: () => void }> = [];
  const state = { cleared: 0 };
  const store = o.store ?? memoryStore();
  const events: WorkCollabEvent[] = [];
  const handle = createWorkCollabProvider('sess-1', {
    clientId: o.clientId ?? 'dev-a',
    url: 'wss://example.test/ws/collab/sess-1',
    socket: FakeSocket as unknown as CollabSocketCtor,
    store,
    principal: o.principal,
    random: o.random ?? (() => 0),
    outboxLimit: o.outboxLimit,
    reconnect: o.reconnect,
    setTimer: (fn, ms) => {
      const entry = { ms, fire: fn };
      timers.push(entry);
      return entry;
    },
    clearTimer: () => { state.cleared += 1; },
  });
  handle.on((e) => events.push(e));
  await handle.connect();
  const h: Harness = {
    handle,
    sockets: FakeSocket.made,
    socket: () => FakeSocket.made[FakeSocket.made.length - 1]!,
    events,
    timers,
    get cleared() { return state.cleared; },
    store,
  };
  return h;
}

/** Open + join the current socket, answering with a join-ack shaped the way the
 *  real gateway shapes one: the seat is `you`, never a top-level `role`. */
function joinNow(h: Harness, ack: Record<string, unknown> = {}): void {
  const s = h.socket();
  s.opened();
  s.deliver({
    t: 'join-ack',
    roster: [],
    docState: null,
    serverClock: 0,
    opVersion: '1.1.0',
    you: { id: 'conn-me', userId: 'me', name: 'Me', role: 'writer' },
    ...ack,
  });
}

const origin = (client: string, clock: number) => ({ client, clock });
const param = (key: string, value: string, client: string, clock: number): CanvasOp =>
  ({ k: 'param', key, value, origin: origin(client, clock) });

// ── Join, ack, role ───────────────────────────────────────────────────────────

test('join is sent on open, and join-ack takes the session live as a writer', async () => {
  const h = await harness();
  assert.equal(h.handle.state().status, 'connecting');
  assert.equal(h.socket().url, 'wss://example.test/ws/collab/sess-1');

  h.socket().opened();
  assert.equal(h.handle.state().status, 'joining');
  assert.deepEqual(h.socket().framesOfType('join'), [{ t: 'join', opVersion: '1.1.0' }]);

  h.socket().deliver({
    t: 'join-ack', roster: [{ id: 'c1', userId: 'u1', name: 'Priya' }], docState: null,
    serverClock: 4, opVersion: '1.1.0',
    you: { id: 'c9', userId: 'me', name: 'Me', role: 'writer' },
    unsynced: ['legacy-table'],
  });
  const state = h.handle.state();
  assert.equal(state.status, 'live');
  assert.equal(state.role, 'writer');
  assert.deepEqual([...state.roster], [{ id: 'c1', userId: 'u1', name: 'Priya' }]);
  // The joiner's own seat is `you` - the roster deliberately excludes it.
  assert.deepEqual(state.self, { id: 'c9', userId: 'me', name: 'Me', role: 'writer' });
  // Inputs the gateway cannot sync are carried, not discarded.
  assert.deepEqual([...state.unsynced], ['legacy-table']);
  h.handle.close();
});

test("the seat comes from join-ack.you.role, and an incompatible op major forces observer", async () => {
  const a = await harness();
  joinNow(a, { you: { id: 'c9', userId: 'me', role: 'observer' }, notice: 'no-edit-grant' });
  assert.equal(a.handle.state().role, 'observer');
  assert.equal(a.handle.state().reason, 'no-edit-grant');
  a.handle.close();

  // The gateway said writer, but it speaks a different contract major: we degrade
  // ourselves rather than write ops it will discard.
  const b = await harness();
  joinNow(b, { opVersion: '2.0.0' });
  assert.equal(b.handle.state().role, 'observer');
  assert.equal(b.handle.state().reason, 'op-version');
  b.handle.close();

  // A gateway that publishes the seat as a top-level `role` is still honoured.
  const c = await harness();
  joinNow(c, { you: undefined, role: 'writer' });
  assert.equal(c.handle.state().role, 'writer');
  c.handle.close();
});

test('a join-ack that declares no role at all seats us as an OBSERVER', async () => {
  // Fail closed: absent is never a grant. The gateway names the seat in `you`; an
  // ack with neither `you` nor `role` is a gateway we do not understand, and writing
  // ops it will answer with OBSERVER_READ_ONLY (then persisting them forever) is the
  // worst of both outcomes.
  const h = await harness();
  h.socket().opened();
  h.socket().deliver({ t: 'join-ack', roster: [], docState: null, serverClock: 0, opVersion: '1.1.0' });
  assert.equal(h.handle.state().role, 'observer');

  h.socket().sent.length = 0;
  h.handle.adapter.apply(param('title', 'nope', 'dev-a', 1));
  assert.deepEqual(h.socket().framesOfType('ops'), []);
  assert.deepEqual(h.handle.outbox(), []);
  h.handle.close();
});

test('an observer never sends an ops frame and never queues one', async () => {
  const h = await harness();
  joinNow(h, { you: { id: 'c9', userId: 'me', role: 'observer' } });
  h.socket().sent.length = 0;

  h.handle.adapter.apply(param('title', 'nope', 'dev-a', 1));
  h.handle.adapter.onLocalChange(
    { moved: [], restyled: [], added: ['r1'], removed: [], zChanged: [], frames: [] },
    new Map([['r1', { label: 'x' }]]),
    'rows',
  );

  assert.deepEqual(h.socket().framesOfType('ops'), []);
  assert.deepEqual(h.handle.outbox(), []);
  await h.handle.persisted();
  assert.equal(h.store.data.has(KEY()), false);

  // Presence is a different lane and stays open to observers (plan 100 section 7.5).
  h.handle.adapter.presence({ userId: 'u1', name: 'Sam', color: '#0af', cursor: { x: 0, y: 0 }, selection: [] });
  assert.equal(h.socket().framesOfType('presence').length, 1);
  h.handle.close();
});

// ── Ops round trip ────────────────────────────────────────────────────────────

test('a local op goes out as an ops frame; a remote one lands in the doc and is emitted', async () => {
  const h = await harness();
  joinNow(h);
  h.socket().sent.length = 0;

  h.handle.adapter.apply(param('title', 'Hello', 'dev-a', 7));
  const sent = h.socket().framesOfType('ops');
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0]!.ops, [param('title', 'Hello', 'dev-a', 7)]);
  assert.equal(h.handle.adapter.state().params.get('title'), 'Hello');

  const remote = param('subtitle', 'From Priya', 'dev-b', 9);
  h.socket().deliver({ t: 'ops', from: 'u2', ops: [remote] });
  assert.equal(h.handle.adapter.state().params.get('subtitle'), 'From Priya');
  const opsEvents = h.events.filter((e) => e.kind === 'ops');
  assert.equal(opsEvents.length, 1);
  assert.deepEqual(opsEvents[0]!.ops, [remote]);
  assert.equal(opsEvents[0]!.from, 'u2');
  h.handle.close();
});

test('our own ops echoed back are an ack, never a second apply', async () => {
  const h = await harness();
  joinNow(h);
  const mine = param('title', 'Hello', 'dev-a', 7);
  h.handle.adapter.apply(mine);
  assert.equal(h.handle.outbox().length, 1);

  h.socket().deliver({ t: 'ops', from: 'me', ops: [mine] });
  assert.deepEqual(h.handle.outbox(), []);
  // No inbound `ops` event for our own echo - a local edit must not round-trip.
  assert.equal(h.events.filter((e) => e.kind === 'ops').length, 0);
  h.handle.close();
});

test('the presence lane is opaque and ephemeral in both directions', async () => {
  const h = await harness();
  joinNow(h);
  h.socket().sent.length = 0;

  // The wave-1 engine's frame shape (from/seq/state) - no `userId` at the top
  // level. It must ride out verbatim and arrive back verbatim.
  const wire = { from: 'dev-b', seq: 12, state: { userId: 'u2', name: 'Sam', focus: 'headline' } };
  h.handle.sendPresence(wire);
  assert.deepEqual(h.socket().framesOfType('presence'), [{ t: 'presence', frame: wire }]);

  h.socket().deliver({ t: 'presence', from: 'u2', frame: wire });
  const seen = h.events.find((e) => e.kind === 'presence');
  assert.deepEqual(seen, { kind: 'presence', from: 'u2', frame: wire });

  // Never queued: presence is ephemeral, so a drop loses it rather than replaying it.
  h.socket().dropped(1006);
  h.handle.sendPresence(wire);
  assert.deepEqual(h.handle.outbox(), []);
  h.handle.close();
});

test("a sender-only error frame carries every input the gateway's veto named", async () => {
  const h = await harness();
  joinNow(h);
  // The gateway's shape: {code, message, inputs[]} - a veto groups a batch's
  // rejections by code, so it can name more than one input.
  h.socket().deliver({
    t: 'error', code: 'INPUT_LOCKED', message: 'this input is not writable in this room',
    inputs: ['headline', 'subhead'],
  });
  const err = h.events.find((e) => e.kind === 'error');
  assert.deepEqual(err, {
    kind: 'error',
    code: 'INPUT_LOCKED',
    inputId: 'headline',
    inputs: ['headline', 'subhead'],
    message: 'this input is not writable in this room',
  });

  // The single-input alias still works.
  h.socket().deliver({ t: 'error', code: 'input-locked', inputId: 'only-one' });
  const alias = h.events.filter((e) => e.kind === 'error')[1];
  assert.deepEqual(alias, { kind: 'error', code: 'input-locked', inputId: 'only-one' });
  h.handle.close();
});

test('peer-join / peer-leave keep the roster, keyed on the CONNECTION id', async () => {
  const h = await harness();
  joinNow(h, { roster: [{ id: 'c1', userId: 'u1' }] });
  // The gateway sends the arrival as `member`…
  h.socket().deliver({ t: 'peer-join', member: { id: 'c2', userId: 'u2', name: 'Sam' } });
  assert.deepEqual([...h.handle.state().roster],
    [{ id: 'c1', userId: 'u1' }, { id: 'c2', userId: 'u2', name: 'Sam' }]);

  // …and the departure as the connection `id`, not a user id.
  h.socket().deliver({ t: 'peer-leave', id: 'c1' });
  assert.deepEqual([...h.handle.state().roster], [{ id: 'c2', userId: 'u2', name: 'Sam' }]);
  const left = h.events.find((e) => e.kind === 'peer-leave');
  assert.deepEqual(left, { kind: 'peer-leave', id: 'c1', userId: 'u1', roster: h.handle.state().roster });
  h.handle.close();
});

test("one user's two devices are two roster rows, and one leaving keeps the other", async () => {
  const h = await harness();
  joinNow(h, { roster: [{ id: 'c1', userId: 'u1', name: 'Priya' }] });
  h.socket().deliver({ t: 'peer-join', member: { id: 'c2', userId: 'u1', name: 'Priya' } });
  assert.equal(h.handle.state().roster.length, 2, 'same principal, two connections');
  h.socket().deliver({ t: 'peer-leave', id: 'c2' });
  assert.deepEqual([...h.handle.state().roster], [{ id: 'c1', userId: 'u1', name: 'Priya' }]);
  h.handle.close();
});

test('the peer/from aliases are still honoured for a gateway that uses them', async () => {
  const h = await harness();
  joinNow(h, { roster: [{ userId: 'u1' }] });
  h.socket().deliver({ t: 'peer-join', peer: { userId: 'u2', name: 'Sam' } });
  assert.deepEqual([...h.handle.state().roster], [{ userId: 'u1' }, { userId: 'u2', name: 'Sam' }]);
  h.socket().deliver({ t: 'peer-leave', from: 'u1' });
  assert.deepEqual([...h.handle.state().roster], [{ userId: 'u2', name: 'Sam' }]);
  h.handle.close();
});

// ── The join-ack snapshot seed ────────────────────────────────────────────────

test('join-ack docState seeds local state and reaches the runtime as ops', async () => {
  const h = await harness();
  h.socket().opened();
  h.socket().deliver({
    t: 'join-ack',
    you: { id: 'c9', userId: 'me', role: 'writer' },
    serverClock: 3,
    docState: {
      params: { title: 'Server title' },
      collections: { rows: { order: ['r2', 'r1'], boxes: { r1: { label: 'one', x: 5 }, r2: { label: 'two' } } } },
    },
  });

  const state = h.handle.adapter.state();
  assert.equal(state.params.get('title'), 'Server title');
  const rows = state.collections?.get('rows');
  assert.deepEqual(rows?.order, ['r2', 'r1']);
  assert.deepEqual(rows?.boxes.get('r1'), { label: 'one', x: 5 });

  const seeded = h.events.filter((e) => e.kind === 'ops').flatMap((e) => [...e.ops]);
  assert.ok(seeded.some((op) => op.k === 'param' && op.key === 'title'));
  // Geometry stays on the geometry lane, even in a snapshot seed (plans/99 section 4.3).
  assert.ok(seeded.some((op) => op.k === 'geom' && op.id === 'r1'));
  h.handle.close();
});

test('the seed never overwrites a key an unacked local op still owns', async () => {
  const h = await harness();
  joinNow(h);
  h.handle.adapter.apply(param('title', 'Mine', 'dev-a', 2));   // unacked
  h.socket().sent.length = 0;
  h.events.length = 0;

  // A reconnect whose snapshot is older than our unacked edit, at a HIGHER clock.
  h.socket().dropped(1006);
  h.timers[h.timers.length - 1]!.fire();
  await Promise.resolve();
  h.socket().opened();
  h.socket().deliver({
    t: 'join-ack', you: { id: 'c9', userId: 'me', role: 'writer' }, serverClock: 50,
    docState: { params: { title: 'Stale server value', subtitle: 'Theirs' } },
  });

  // Ours survives - the snapshot governs only keys we are not holding.
  assert.equal(h.handle.adapter.state().params.get('title'), 'Mine');
  assert.equal(h.handle.adapter.state().params.get('subtitle'), 'Theirs');
  const seeded = h.events.filter((e) => e.kind === 'ops').flatMap((e) => [...e.ops]);
  assert.equal(seeded.filter((op) => op.k === 'param' && op.key === 'title').length, 0);
  assert.equal(seeded.filter((op) => op.k === 'param' && op.key === 'subtitle').length, 1);
  h.handle.close();
});

// ── The outbox ────────────────────────────────────────────────────────────────

test('the outbox persists, replays after a reconnect join-ack, and retires on that second delivery', async () => {
  const h = await harness();
  joinNow(h);
  const mine = param('title', 'Typed while online', 'dev-a', 5);
  h.handle.adapter.apply(mine);
  await h.handle.persisted();
  assert.deepEqual(h.store.data.get(KEY()), [mine]);
  // Written to the wire ⇒ nothing is "pending", but the journal still holds it.
  assert.equal(h.handle.state().pending, 0);
  assert.equal(h.handle.state().queued, 1);

  // The socket drops (not a typed close) → backoff timer armed.
  h.socket().dropped(1006);
  assert.equal(h.handle.state().status, 'reconnecting');
  assert.equal(h.timers.length, 1);
  assert.equal(h.timers[0]!.ms, 1000);

  h.timers[0]!.fire();
  await Promise.resolve();
  assert.equal(h.sockets.length, 2);
  joinNow(h);

  // Replayed on the NEW socket, with its original origin so the gateway's
  // (client, clock) dedup recognises it…
  const replay = h.socket().framesOfType('ops');
  assert.equal(replay.length, 1);
  assert.deepEqual(replay[0]!.ops, [mine]);
  // …and retired by that second delivery. There is no echo and no watermark on this
  // wire (the gateway broadcasts ops to PEERS only), so an entry that waited for one
  // would pend forever and re-post on every future join.
  assert.deepEqual(h.handle.outbox(), []);
  await h.handle.persisted();
  assert.equal(h.store.data.has(KEY()), false);
  h.handle.close();
});

test('an entry never yet written to a socket survives its first replay', async () => {
  const h = await harness();
  joinNow(h);
  // Typed while the socket is down: enqueued, never delivered.
  h.socket().dropped(1006);
  const mine = param('title', 'Typed while offline', 'dev-a', 5);
  h.handle.adapter.apply(mine);
  assert.equal(h.handle.state().pending, 1, 'nobody has seen this edit yet');

  h.timers[0]!.fire();
  await Promise.resolve();
  joinNow(h);
  // First delivery - kept, because a first write to a socket is not a receipt.
  assert.deepEqual(h.handle.outbox(), [mine]);
  assert.equal(h.handle.state().pending, 0);

  h.socket().dropped(1006);
  h.timers[1]!.fire();
  await Promise.resolve();
  joinNow(h);
  assert.deepEqual(h.handle.outbox(), [], 'retired on the second delivery');
  h.handle.close();
});

test('a fresh provider adopts a stored outbox and replays it (the total-drop case)', async () => {
  const stored = param('title', 'Survived a crash', 'dev-a', 11);
  const store = memoryStore(new Map([[KEY(), [stored]]]));
  const h = await harness({ store });
  assert.deepEqual(h.handle.outbox(), [stored]);
  assert.equal(h.handle.state().pending, 1, 'a previous run\'s delivery was never witnessed');

  joinNow(h);
  const replay = h.socket().framesOfType('ops');
  assert.equal(replay.length, 1);
  assert.deepEqual(replay[0]!.ops, [stored]);
  assert.deepEqual(h.handle.outbox(), [stored], 'kept for one more join');
  h.handle.close();
});

test('the outbox key is scoped by principal, so a shared device cannot cross-replay', async () => {
  const theirs = param('title', 'User A typed this', 'dev-a', 4);
  const store = memoryStore(new Map([[KEY('user-a'), [theirs]]]));

  // User B signs in on the same device and opens the same session. A's journal is
  // under A's key and must not ride out over B's authenticated socket.
  const b = await harness({ store, principal: 'user-b' });
  assert.deepEqual(b.handle.outbox(), []);
  joinNow(b);
  assert.deepEqual(b.socket().framesOfType('ops'), []);
  b.handle.close();

  // A comes back and still has their own work.
  const a = await harness({ store, principal: 'user-a' });
  assert.deepEqual(a.handle.outbox(), [theirs]);
  a.handle.close();

  assert.notEqual(KEY('user-a'), KEY('user-b'));
  assert.notEqual(KEY('user-a'), collabOutboxKey('sess-1', { base: 'https://other.test', principal: 'user-a' }));
});

test('the cap sheds DELIVERED entries silently and undelivered ones with a warning', async () => {
  // Delivered: shedding costs replay depth, not an edit, so it is silent.
  const live = await harness({ outboxLimit: 2 });
  joinNow(live);
  for (let i = 1; i <= 4; i++) live.handle.adapter.apply(param(`k${i}`, 'v', 'dev-a', i));
  assert.deepEqual(live.handle.outbox().map((op) => (op.k === 'param' ? op.key : '')), ['k3', 'k4']);
  assert.deepEqual(live.events.filter((e) => e.kind === 'warning'), []);
  live.handle.close();

  // Undelivered: this IS the user's work going missing, so it is surfaced.
  const offline = await harness({ outboxLimit: 2 });
  joinNow(offline);
  offline.socket().dropped(1006);
  for (let i = 1; i <= 4; i++) offline.handle.adapter.apply(param(`k${i}`, 'v', 'dev-a', i));
  assert.deepEqual(offline.handle.outbox().map((op) => (op.k === 'param' ? op.key : '')), ['k3', 'k4']);
  const warnings = offline.events.filter((e) => e.kind === 'warning');
  assert.equal(warnings.length, 2);
  assert.deepEqual(warnings[0], { kind: 'warning', code: 'outbox-overflow', dropped: 1 });
  offline.handle.close();
});

test('serverClock is a room-wide maximum and can never retire an entry', async () => {
  const h = await harness();
  joinNow(h);
  const mine = param('title', 'Mine', 'dev-a', 3);
  h.handle.adapter.apply(mine);
  h.socket().dropped(1006);
  h.timers[0]!.fire();
  await Promise.resolve();
  h.socket().opened();
  // The replay cannot be written (the socket died between open and join-ack), so
  // nothing has been delivered a second time. A gateway publishing a room-wide
  // revision under `serverClock` must not retire the entry on its own.
  h.socket().readyState = 3;
  h.socket().deliver({
    t: 'join-ack', you: { id: 'c9', userId: 'me', role: 'writer' },
    serverClock: 999999, docState: null,
  });
  assert.deepEqual(h.handle.outbox(), [mine]);
  h.handle.close();
});

test('a rebuilt document never re-mints a clock this device has already used', async () => {
  // The gateway's replay dedup is strictly monotonic per client, so a re-minted
  // (client, clock) pair is DISCARDED - in a quiet room, silently and forever.
  const h = await harness();
  joinNow(h);
  const first = h.handle.adapter.onLocalChange(
    { moved: [], restyled: [], added: ['r1'], removed: [], zChanged: [], frames: [] },
    new Map([['r1', { label: 'one' }]]),
    'rows',
  );
  const usedClock = first[0]!.origin.clock;
  assert.ok(usedClock > 0);

  // Drop, reconnect, and join an EMPTY room at serverClock 0 - the case where the
  // seed carries nothing to lift the rebuilt doc's clock back over the high-water.
  h.socket().dropped(1006);
  h.timers[0]!.fire();
  await Promise.resolve();
  joinNow(h, { serverClock: 0, docState: null });

  const after = h.handle.adapter.onLocalChange(
    { moved: [], restyled: [], added: ['r2'], removed: [], zChanged: [], frames: [] },
    new Map([['r1', { label: 'one' }], ['r2', { label: 'two' }]]),
    'rows',
  );
  assert.ok(after.length > 0, 'the edit produced ops');
  assert.ok(after[0]!.origin.clock > usedClock,
    `clock went backwards: ${after[0]!.origin.clock} after ${usedClock}`);

  // …and the anchor that carries the floor is invisible to every reader.
  const rows = h.handle.adapter.state().collections?.get('rows');
  assert.deepEqual([...(rows?.boxes.keys() ?? [])], ['r1', 'r2']);
  assert.deepEqual(h.handle.adapter.state().order, []);
  h.handle.close();
});

test('a replay larger than the gateway cap goes out as several frames, never one', async () => {
  // One oversize `ops` frame is not an error frame: the gateway CLOSES the socket
  // (CLOSE.OPS_RATE), which would kill the very session the replay was recovering.
  const many = Array.from({ length: MAX_OPS_PER_FRAME + 30 },
    (_, i) => param(`k${i}`, 'v', 'dev-a', i + 1));
  const store = memoryStore(new Map([[KEY(), many]]));
  const h = await harness({ store, outboxLimit: 1000 });
  assert.equal(h.handle.outbox().length, many.length);

  joinNow(h);
  const frames = h.socket().framesOfType('ops');
  assert.equal(frames.length, 2);
  assert.equal((frames[0]!.ops as unknown[]).length, MAX_OPS_PER_FRAME);
  assert.equal((frames[1]!.ops as unknown[]).length, 30);
  assert.equal(h.socket().closedWith, null, 'the session survived its own replay');
  h.handle.close();
});

// ── Reconnect ─────────────────────────────────────────────────────────────────

test('backoff climbs 1s→30s and the injected jitter only ever subtracts', () => {
  const zero = () => 0;
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 20].map((n) => backoffDelay(n, zero)),
    [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  const full = () => 1;
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => backoffDelay(n, full)),
    [1000, 1500, 3000, 6000, 12000, 22500]);
  // Never outside the documented band, whatever the source returns.
  for (const r of [-5, 0.5, 1.7, Number.NaN]) {
    for (let n = 1; n <= 12; n++) {
      const d = backoffDelay(n, () => r);
      assert.ok(d >= 1000 && d <= 30000, `attempt ${n} random ${r} → ${d}`);
    }
  }
});

test('successive drops climb the schedule; a join resets it', async () => {
  const h = await harness();
  joinNow(h);
  h.socket().dropped(1006);
  h.timers[0]!.fire();
  await Promise.resolve();
  h.socket().dropped(1006);
  h.timers[1]!.fire();
  await Promise.resolve();
  h.socket().dropped(1006);
  assert.deepEqual(h.timers.map((t) => t.ms), [1000, 2000, 4000]);

  h.timers[2]!.fire();
  await Promise.resolve();
  joinNow(h);
  assert.equal(h.handle.state().attempt, 0);
  h.socket().dropped(1006);
  assert.equal(h.timers[3]!.ms, 1000);
  h.handle.close();
});

test('a terminal close ends the session; everything else reconnects', async () => {
  for (const code of [COLLAB_CLOSE.UNAUTHORIZED, COLLAB_CLOSE.PROTOCOL, 1008, 1000]) {
    const h = await harness();
    joinNow(h);
    h.socket().dropped(code, 'nope');
    assert.equal(h.handle.state().status, 'closed', `code ${code}`);
    assert.equal(h.timers.length, 0, `code ${code} armed a timer`);
    h.handle.close();
  }
  // A transport blip, a rate burst, a join timeout, and - the one that matters - 
  // the gateway's own restart all get the backoff. A blanket "the whole private
  // range is terminal" rule turned every redeploy into a fleet-wide kill.
  for (const code of [1012, 1006, COLLAB_CLOSE.GOING_AWAY, COLLAB_CLOSE.OPS_RATE, COLLAB_CLOSE.PRESENCE_RATE, COLLAB_CLOSE.JOIN_TIMEOUT, 4321]) {
    const h = await harness();
    joinNow(h);
    h.socket().dropped(code);
    assert.equal(h.handle.state().status, 'reconnecting', `code ${code}`);
    assert.equal(h.timers.length, 1, `code ${code} did not arm a timer`);
    h.handle.close();
  }
});

test('after a terminal close the provider stops queuing and stops persisting', async () => {
  const h = await harness();
  joinNow(h);
  h.socket().dropped(COLLAB_CLOSE.UNAUTHORIZED, 'this session is no longer valid');
  assert.equal(h.handle.state().status, 'closed');

  h.handle.adapter.onLocalChange(
    { moved: [], restyled: [], added: ['r1'], removed: [], zChanged: [], frames: [] },
    new Map([['r1', { label: 'x' }]]),
    'rows',
  );
  assert.deepEqual(h.handle.outbox(), [], 'a session that can never reconnect must not keep a journal');
  await h.handle.persisted();
  assert.equal(h.store.data.has(KEY()), false);
  h.handle.close();
});

test('a cross-origin instance endpoint is refused with a reason, not retried', async () => {
  // The gateway authenticates from a SameSite=Lax cookie, which a browser will not
  // attach to a cross-site upgrade - so this can never succeed, and a reconnect loop
  // would only hide that.
  FakeSocket.made = [];
  const timers: Array<{ ms: number; fire: () => void }> = [];
  const handle = createWorkCollabProvider('sess-1', {
    clientId: 'dev-a',
    href: 'https://lolly.tools/app/',
    socket: FakeSocket as unknown as CollabSocketCtor,
    store: memoryStore(),
    instanceBase: 'https://acme.example',
    setTimer: (fn, ms) => { const e = { ms, fire: fn }; timers.push(e); return e; },
    clearTimer: () => {},
  });
  await handle.connect();
  assert.equal(FakeSocket.made.length, 0, 'no socket was even constructed');
  assert.equal(handle.state().status, 'closed');
  assert.equal(handle.state().reason, 'cross-origin-instance');
  assert.equal(timers.length, 0, 'no reconnect was armed');
  handle.close();
});

// ── Teardown ──────────────────────────────────────────────────────────────────

test('close() tears down socket handlers, timers and subscribers', async () => {
  const h = await harness();
  joinNow(h);
  h.socket().dropped(1006);          // arm a reconnect timer
  assert.equal(h.timers.length, 1);
  const dropped = h.sockets[0]!;

  h.handle.close();
  assert.equal(h.cleared, 1);        // the pending backoff timer was cleared
  assert.equal(h.handle.state().status, 'closed');
  assert.equal(dropped.live, false); // every handler nulled

  const before = h.events.length;
  // Firing the (already cleared) timer must not resurrect the socket, and the
  // released subscribers must hear nothing more.
  h.timers[0]!.fire();
  await Promise.resolve();
  assert.equal(h.sockets.length, 1);
  assert.equal(h.events.length, before);
});

test('close() sends leave and closes with the normal code while live', async () => {
  const h = await harness();
  joinNow(h);
  h.socket().sent.length = 0;
  const s = h.socket();
  h.handle.close();
  assert.deepEqual(s.frames(), [{ t: 'leave' }]);
  assert.equal(s.closedWith, COLLAB_CLOSE.NORMAL);
  assert.equal(s.live, false);
});

test('overlapping connect() calls open exactly one socket', async () => {
  // `connect()` yields twice (the store load, then endpoint derivation). Two
  // callers used to each reach `new Ctor(url)`, and the loser was orphaned - its
  // handlers detached by the `sock === s` guards, but nothing ever closed it.
  FakeSocket.made = [];
  const handle = createWorkCollabProvider('sess-1', {
    clientId: 'dev-a',
    url: 'wss://example.test/ws/collab/sess-1',
    socket: FakeSocket as unknown as CollabSocketCtor,
    store: memoryStore(),
    setTimer: (fn, ms) => ({ ms, fire: fn }),
    clearTimer: () => {},
  });
  await Promise.all([handle.connect(), handle.connect(), handle.connect()]);
  assert.equal(FakeSocket.made.length, 1);
  handle.close();
});

test('close() keeps undelivered work and drops what the gateway already has', async () => {
  const h = await harness();
  joinNow(h);
  const delivered = param('a', 'sent', 'dev-a', 1);
  h.handle.adapter.apply(delivered);
  h.socket().dropped(1006);
  const stranded = param('b', 'never sent', 'dev-a', 2);
  h.handle.adapter.apply(stranded);

  h.handle.close();
  await h.handle.persisted();
  // Replaying a finished session's delivered ops into the next mount buys nothing;
  // the edit nobody has seen is exactly what the next mount is meant to recover.
  assert.deepEqual(h.store.data.get(KEY()), [stranded]);
});

test('connect() after close() is inert', async () => {
  const h = await harness();
  h.handle.close();
  await h.handle.connect();
  assert.equal(h.sockets.length, 1);
  assert.equal(h.handle.state().status, 'closed');
});

// ── The factory seam ──────────────────────────────────────────────────────────

test('the factory seam is dormant until something registers, and last-wins', () => {
  _clearWorkCollabFactoryForTests();
  assert.equal(getWorkCollabFactory(), undefined);
  const stop = registerWorkCollabFactory(createWorkCollabProvider);
  assert.equal(getWorkCollabFactory(), createWorkCollabProvider);
  stop();
  assert.equal(getWorkCollabFactory(), undefined);
});

// ── Protocol helpers ──────────────────────────────────────────────────────────

test('collabSocketUrl derives wss for same-origin and for a configured instance base', () => {
  // Same-origin: instancePath() returns the path unchanged.
  assert.equal(
    collabSocketUrl('/ws/collab/s1', 'https://lolly.tools/app/'),
    'wss://lolly.tools/ws/collab/s1',
  );
  // A configured (always-https) instance base: instancePath() returns an absolute URL.
  assert.equal(
    collabSocketUrl('https://acme.example/lolly/ws/collab/s1', 'https://lolly.tools/'),
    'wss://acme.example/lolly/ws/collab/s1',
  );
  // Only a plain-http page (a dev server) downgrades to ws:.
  assert.equal(collabSocketUrl('/ws/collab/s1', 'http://localhost:5173/'), 'ws://localhost:5173/ws/collab/s1');
});

test('parseServerFrame rejects everything that is not a known frame object', () => {
  assert.equal(parseServerFrame('not json'), null);
  assert.equal(parseServerFrame('[1,2]'), null);
  assert.equal(parseServerFrame('"hi"'), null);
  assert.equal(parseServerFrame(new Uint8Array([1])), null);
  assert.equal(parseServerFrame(JSON.stringify({ t: 'made-up' })), null);
  assert.deepEqual(parseServerFrame(JSON.stringify({ t: 'leave' })), null); // client-only type
  assert.deepEqual(parseServerFrame(JSON.stringify({ t: 'error', code: 'x' })), { t: 'error', code: 'x' });
});

test('isCanvasOp gates the shape of every kind', () => {
  const good = origin('c', 1);
  assert.equal(isCanvasOp({ k: 'param', key: 'a', value: 1, origin: good }), true);
  assert.equal(isCanvasOp({ k: 'param', key: 'a', value: { x: 1 }, origin: good }), false);
  assert.equal(isCanvasOp({ k: 'field', id: 'r', field: 'f', value: 'v', origin: good }), true);
  assert.equal(isCanvasOp({ k: 'field', id: 'r', field: 'f', value: { deep: 1 }, origin: good }), false);
  assert.equal(isCanvasOp({ k: 'geom', id: 'r', fields: { x: 1 }, origin: good }), true);
  assert.equal(isCanvasOp({ k: 'geom', id: 'r', fields: { x: 'no' }, origin: good }), false);
  assert.equal(isCanvasOp({ k: 'add', id: 'r', row: {}, orderKey: 'i', origin: good }), true);
  assert.equal(isCanvasOp({ k: 'add', id: 'r', row: { nested: {} }, orderKey: 'i', origin: good }), false);
  assert.equal(isCanvasOp({ k: 'order', id: 'r', orderKey: 'i', origin: good }), true);
  assert.equal(isCanvasOp({ k: 'remove', id: 'r', origin: good }), true);
  assert.equal(isCanvasOp({ k: 'remove', id: 'r', col: 7, origin: good }), false);
  assert.equal(isCanvasOp({ k: 'remove', id: 'r' }), false);
  assert.equal(isCanvasOp({ k: 'nope', id: 'r', origin: good }), false);
  assert.equal(isCanvasOp({ k: 'remove', id: 'r', origin: { client: 'c', clock: Number.NaN } }), false);
});

test('withoutHeldKeys strips exactly what an unacked op owns', () => {
  const seedOrigin = origin('', 10);
  const seed = docStateToOps(
    { collections: { rows: { order: ['r1'], boxes: { r1: { label: 'server', x: 3 } } } } },
    seedOrigin,
  );
  const held = heldKeyIndex([
    { k: 'field', id: 'r1', col: 'rows', field: 'label', value: 'mine', origin: origin('dev-a', 1) },
  ]);
  const kept = seed.map((op) => withoutHeldKeys(op, held)).filter((op): op is CanvasOp => op !== null);
  assert.equal(kept.some((op) => op.k === 'field' && op.field === 'label'), false);
  assert.equal(kept.some((op) => op.k === 'geom'), true);
  assert.equal(kept.some((op) => op.k === 'add'), true);

  // Membership is all-or-nothing: an unacked remove owns whether the row exists.
  const removedHeld = heldKeyIndex([{ k: 'remove', id: 'r1', col: 'rows', origin: origin('dev-a', 2) }]);
  assert.equal(withoutHeldKeys(seed.find((op) => op.k === 'add')!, removedHeld), null);
});

test('isTerminalClose names the refusals, and treats everything else as retryable', () => {
  // The close table is the gateway's own (server/src/collab/gateway.ts CLOSE).
  assert.equal(COLLAB_CLOSE.UNAUTHORIZED, 4001);
  assert.equal(COLLAB_CLOSE.JOIN_TIMEOUT, 4003);
  assert.equal(COLLAB_CLOSE.PROTOCOL, 4004);
  assert.equal(COLLAB_CLOSE.PRESENCE_RATE, 4008);
  assert.equal(COLLAB_CLOSE.OPS_RATE, 4009);
  assert.equal(COLLAB_CLOSE.GOING_AWAY, 4010);

  for (const code of [COLLAB_CLOSE.NORMAL, 1008, COLLAB_CLOSE.UNAUTHORIZED, COLLAB_CLOSE.PROTOCOL]) {
    assert.equal(isTerminalClose(code), true, `${code} should end the session`);
  }
  // The gateway signals its own restart in the private range, so a blanket
  // "4000-4999 is terminal" rule ends every live collab in the fleet on a redeploy.
  for (const code of [COLLAB_CLOSE.GOING_AWAY, COLLAB_CLOSE.OPS_RATE, COLLAB_CLOSE.PRESENCE_RATE, COLLAB_CLOSE.JOIN_TIMEOUT, 4999, 1006, 1011, 1012]) {
    assert.equal(isTerminalClose(code), false, `${code} should get the backoff`);
  }
});

test('chunkOps satisfies both of the gateway caps, in order', () => {
  const ops: CanvasOp[] = Array.from({ length: 450 }, (_, i) => param(`k${i}`, 'v', 'dev-a', i + 1));
  const chunks = chunkOps(ops);
  assert.deepEqual(chunks.map((c) => c.length), [MAX_OPS_PER_FRAME, MAX_OPS_PER_FRAME, 50]);
  assert.deepEqual(chunks.flat(), ops, 'order preserved, nothing dropped');

  // The byte budget splits before the op count does when scalars are long.
  const fat: CanvasOp[] = Array.from({ length: 8 }, (_, i) => param(`k${i}`, 'x'.repeat(4000), 'dev-a', i + 1));
  const byBytes = chunkOps(fat, MAX_OPS_PER_FRAME, 10_000);
  assert.ok(byBytes.length > 1, 'a byte-heavy batch is split');
  assert.deepEqual(byBytes.flat(), fat);

  // One op over the whole budget is sent alone rather than dropped: the gateway
  // refusing it is a visible answer, dropping it here would be a silent one.
  const huge = chunkOps([param('k', 'y'.repeat(50_000), 'dev-a', 1)], MAX_OPS_PER_FRAME, 1000);
  assert.equal(huge.length, 1);
  assert.equal(huge[0]!.length, 1);
  assert.deepEqual(chunkOps([]), []);
});

test('isCrossOriginSocket accepts only the page origin', () => {
  assert.equal(isCrossOriginSocket('wss://lolly.tools/ws/collab/s1', 'https://lolly.tools/app/'), false);
  assert.equal(isCrossOriginSocket('ws://localhost:5173/ws/collab/s1', 'http://localhost:5173/'), false);
  assert.equal(isCrossOriginSocket('wss://acme.example/ws/collab/s1', 'https://lolly.tools/'), true);
  assert.equal(isCrossOriginSocket('wss://lolly.tools:8443/ws/x', 'https://lolly.tools/'), true);
  // A downgrade is not "same origin" either, and neither is a URL we cannot parse.
  assert.equal(isCrossOriginSocket('ws://lolly.tools/ws/x', 'https://lolly.tools/'), true);
  assert.equal(isCrossOriginSocket('not a url', 'https://lolly.tools/'), true);
});
