// SPDX-License-Identifier: MPL-2.0
/**
 * The loopback pair - plan 100 section 10's "two real runtimes in one process" proof
 * (wave 1.6).
 *
 * Every piece below this file is already unit-tested in isolation, and that is
 * exactly the problem: `collab-plumbing.test.ts` drives a hand-written runtime
 * harness, `collab-presence.test.ts` drives one engine with scripted frames, and
 * `collab-session.test.ts` drives one session against a fake peer. None of them
 * can see the failure this file exists for - TWO real engine runtimes, each with
 * its own document, converging (or not) through a real op path. A CRDT that is
 * wrong is wrong only in the pair.
 *
 * WHAT IS REAL HERE, and what is not:
 *
 *  - REAL: two `createRuntime` mounts of the same tool fixture (hooks included),
 *    two `ReferenceCanvasDoc`s, two `createCollabSession`s over the real
 *    `attachCollabPlumbing`, the real presence engine, the real `createHistory`
 *    undo model wired in mountTool's order (history wrapper first, collab wrapper
 *    outside it - `views/tool.ts` section "Undo / redo", `collab-plumbing.ts` header).
 *  - FAKE: the transport. `LoopbackWire` is the whole of it - one side's outbound
 *    ops become the other's `applyRemotePatch`, one side's presence frames become
 *    the other's `presenceIn`. That is precisely the `CollabSessionHandle`
 *    reconciliation contract, so a Track A RTC provider or a Track B socket
 *    substitutes for it without this file changing.
 *  - FAKE: time (an injected clock + timers) and the frame scheduler, so nothing
 *    here sleeps and nothing depends on rAF.
 *
 * A `WireAdapter` is what an RTC provider actually is: a `CanvasSyncAdapter` that
 * delegates convergence to a `ReferenceCanvasDoc` and puts everything the LOCAL
 * doors produce (`onLocalChange`'s return, `apply`'s single op) on the wire.
 * `applyRemotePatch` is the remote door and sends nothing - which is where an echo
 * storm would come from if the seam ever blurred, and section 5 of this file measures it.
 *
 * ── ONE HONEST LIMITATION, STATED RATHER THAN HIDDEN ──────────────────────────
 *
 * `collab-plumbing.ts` holds ONE Lamport counter per MODULE (it is per-device, and
 * a device runs one copy of the module). Two logical devices inside one process
 * therefore share it, so the param ops this shell mints get globally-increasing
 * clocks even when the edits are causally concurrent. Convergence still means what
 * it means - LWW resolves, both sides land on the same value - but a same-clock
 * tie broken by client id is NOT exercised on the param lane by this file. The
 * blocks lanes do not share: each side's ops are minted by its own
 * `ReferenceCanvasDoc`, which carries its own clock, so the concurrent-add case
 * below is a genuine two-clock merge. Fixing the param case needs an injectable
 * clock in the plumbing (there is none today) - reported, not papered over.
 *
 * Run only this file:
 *   node --test shells/web/src/lib/collab-loopback.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ReferenceCanvasDoc } from '@lolly-tools/core/canvas-op-v1';
import type {
  Awareness, BoxId, BoxRow, CanvasDocState, CanvasOp, CanvasSyncAdapter, Damage, ParamValue,
} from '@lolly-tools/core/canvas-op-v1';

import { createRuntime } from '../../../../engine/src/runtime.ts';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import type { LoadedTool } from '../../../../engine/src/loader.ts';
import type { HostV1 } from '../../../../engine/src/bridge/host-v1.ts';

import { cloneValue, createHistory } from '../views/tool-history.ts';
import type { HistoryModel } from '../views/tool-history.ts';

import {
  _clearCanvasSyncProviderForTests, getCanvasSyncProvider, registerCanvasSyncProvider,
} from './canvas-sync-provider.ts';
import { _resetCollabDeviceForTests, attachCollabPlumbing } from './collab-plumbing.ts';
import { createCollabSession } from './collab-session.ts';
import type {
  CollabConnectionState, CollabSession, CollabSessionHandle,
} from './collab-session.ts';
import {
  PRESENCE_HEARTBEAT_MS, PRESENCE_SWEEP_MS, PRESENCE_THROTTLE_MS, PRESENCE_TTL_MS,
} from './collab-presence.ts';
import type { PresenceFrame } from './collab-presence.ts';
import type { CollabColor } from './collab-colors.ts';
import { ROW_ID_FIELD, ulid } from './row-id.ts';

// ── the tool fixture ──────────────────────────────────────────────────────────

/**
 * Scalars of three types + one generic `blocks` collection + a HOOK that derives
 * both a declared input (`mirror`) and an extras-only key (`tally`) on every
 * change. The hook is what makes section 5's claim testable at all: derived state is
 * re-derived locally on each peer and must never become ops (section 11.9), and the two
 * peers' derivations must agree, which is the determinism the render hash reads.
 *
 * `formats: ['png']` keeps the engine from synthesising the `convertPaths` input
 * (vector formats do), so the model here is exactly what the manifest declares.
 */
const HOOKS_SOURCE = [
  'function onInput({ model }) {',
  '  var by = {};',
  '  for (var i = 0; i < model.length; i++) by[model[i].id] = model[i].value;',
  '  var items = Array.isArray(by.items) ? by.items : [];',
  '  var labels = items.map(function (r) { return String(r && r.label); }).join(",");',
  '  return { mirror: "mirror:" + String(by.title), tally: items.length + "/" + labels };',
  '}',
].join('\n');

let toolSeq = 0;

/** A loadable tool. Both peers in a pair MUST share the id: a hook factory is
 *  memoised by `id@version`, and two peers running the same tool is the premise. */
function loopbackTool(id: string): LoadedTool {
  return {
    trustClass: 'builtin-verified',
    manifest: {
      id, name: 'Loopback', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 40, height: 40, formats: ['png'] },
      inputs: [
        { id: 'title', type: 'text', default: 'hello' },
        { id: 'count', type: 'number', default: 1, min: 0, max: 10 },
        { id: 'flag', type: 'boolean', default: false },
        { id: 'mirror', type: 'text', default: '' },
        {
          id: 'items', type: 'blocks', default: [],
          fields: [{ id: 'label', type: 'text' }, { id: 'note', type: 'text' }],
        },
      ],
      hooks: { onInput: true },
    },
    template:
      '<t>{{title}}</t><c>{{count}}</c><f>{{flag}}</f><m>{{mirror}}</m><x>{{tally}}</x>' +
      '<l>{{#each items}}[{{label}}/{{note}}]{{/each}}</l>',
    styles: null,
    hooksSource: HOOKS_SOURCE,
    hooksUrl: null,
    textTemplates: {},
    textTemplateErrors: {},
  };
}

/** The minimal HostV1 a hooks-only, asset-free, compose-free tool needs. */
function engineHost(): HostV1 {
  return {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
  } as unknown as HostV1;
}

// ── fake time + a hand-driven frame scheduler ─────────────────────────────────

interface FakeClock {
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  advance(ms: number): void;
  pending(): number;
}

function fakeClock(): FakeClock {
  let t = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const runDue = (until: number): void => {
    for (;;) {
      let id = -1;
      let due: { at: number; fn: () => void } | undefined;
      for (const [key, timer] of timers) {
        if (timer.at > until) continue;
        if (!due || timer.at < due.at) { due = timer; id = key; }
      }
      if (!due) return;
      timers.delete(id);
      t = due.at;
      due.fn();
    }
  };
  return {
    now: () => t,
    setTimer: (fn, ms) => { const id = nextId++; timers.set(id, { at: t + ms, fn }); return id; },
    clearTimer: (handle) => { timers.delete(handle as number); },
    advance(ms) { const until = t + ms; runDue(until); t = until; },
    pending: () => timers.size,
  };
}

interface Scheduler {
  raf(fn: () => void): void;
  pending(): number;
  runAll(): boolean;
}

function scheduler(): Scheduler {
  let queue: (() => void)[] = [];
  return {
    raf: (fn) => { queue.push(fn); },
    pending: () => queue.length,
    runAll() {
      if (queue.length === 0) return false;
      const due = queue;
      queue = [];
      for (const fn of due) fn();
      return true;
    },
  };
}

const tick = (): Promise<void> => new Promise<void>((r) => { setTimeout(r, 0); });

// ── the wire ──────────────────────────────────────────────────────────────────

/** A minimal subscribable stream plus the `push` the transport drives it with. */
function stream<T>(): { subscribe(fn: (v: T) => void): () => void; push(v: T): void } {
  const subs = new Set<(v: T) => void>();
  return {
    subscribe(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
    push(v) { for (const fn of [...subs]) fn(v); },
  };
}

/**
 * What an RTC/socket provider IS, reduced to its shape: a `CanvasSyncAdapter`
 * whose convergence is a `ReferenceCanvasDoc` and whose LOCAL doors also transmit.
 *
 * `onLocalChange` (a row gesture the adapter differs) and `apply` (the single-op
 * door the shell mints params and order rewrites through) are both outbound.
 * `applyRemotePatch` is the inbound door and transmits NOTHING - the one line that
 * separates a converging pair from an echo storm.
 */
class WireAdapter implements CanvasSyncAdapter {
  readonly doc: ReferenceCanvasDoc;
  /** Every op this side put on the wire, flat, in order. */
  readonly sent: CanvasOp[] = [];
  /** How many separate messages those ops travelled in. */
  messages = 0;
  /** Every op batch this side took OFF the wire. */
  readonly received: CanvasOp[][] = [];
  /** Installed by the wire once both ends exist. */
  transmit: (ops: readonly CanvasOp[]) => void = () => {};

  constructor(clientId: string) {
    this.doc = new ReferenceCanvasDoc(clientId);
  }

  onLocalChange(damage: Damage, rows: Map<BoxId, BoxRow>, col?: string): CanvasOp[] {
    const ops = this.doc.onLocalChange(damage, rows, col);
    this.put(ops);
    return ops;
  }

  apply(op: CanvasOp): void {
    this.doc.apply(op);
    this.put([op]);
  }

  applyRemotePatch(ops: readonly CanvasOp[]): Damage {
    this.received.push([...ops]);
    return this.doc.applyRemotePatch(ops);
  }

  presence(a: Awareness): void { this.doc.presence(a); }
  state(): CanvasDocState { return this.doc.state(); }

  private put(ops: readonly CanvasOp[]): void {
    if (ops.length === 0) return;
    this.messages += 1;
    for (const op of ops) this.sent.push(op);
    this.transmit(ops);
  }
}

/** One end of the pair: a real runtime under mountTool's wrapper stack. */
interface Node {
  readonly id: string;
  readonly runtime: Runtime;
  readonly session: CollabSession;
  readonly adapter: WireAdapter;
  readonly history: HistoryModel;
  readonly sched: Scheduler;
  /** Outbound presence frames, in order. */
  readonly presenceOut: PresenceFrame[];
  /** Edit through the FULL wrapper stack, exactly as a sidebar control does. */
  set(id: string, value: InputValue): Promise<void>;
  /** mountTool's `applyHistory`, verbatim: a replay is a local edit that syncs. */
  undo(): Promise<void>;
  /** Declared input id → value, the comparable projection of the input model. */
  values(): Record<string, InputValue>;
  hydrated(): string;
  /** Flip the tab hidden/visible (section 11.4's away flag). */
  hide(hidden: boolean): void;
}

/** The two lanes the transport owns for one end. */
interface Lanes {
  presenceIn(frame: PresenceFrame): void;
  events(state: CollabConnectionState): void;
}

interface Wire {
  readonly a: Node;
  readonly b: Node;
  /** The transport's join handshake (section 4.7): each side's snapshot, minus the
   *  joiner's own entry, plus a `live` connection event. */
  join(): void;
  /** Buffer ops instead of delivering them - a partition, which is how two edits
   *  are made genuinely concurrent in one process. Presence is never held (its
   *  lane is lossy and immediate by construction). */
  hold(): void;
  release(order?: 'a-first' | 'b-first'): void;
  /**
   * Stop DELIVERING one side's presence frames (they are still counted as sent).
   * This is section 11.4's real shape: a background tab whose timers are throttled to
   * ~1/min keeps a perfectly healthy channel while its heartbeat stops arriving.
   * It is also the only way to make the away exemption testable - with both
   * engines live, A's own 15 s heartbeat refreshes B's TTL and nobody would ever
   * be evicted for any reason.
   *
   * DIRECTIONAL, and that matters: a symmetric cut also makes the SILENT side
   * evict the healthy one, and an engine with an empty roster sends nothing at
   * all (section 4.7), so the backgrounded tab could never announce its own return. Only
   * the starved side goes quiet here.
   */
  blackout(side: 'a' | 'b' | null): void;
  /** Run frames on both sides until nothing is queued. */
  settle(): Promise<void>;
  close(): void;
}

/** Three fixed swatches. The palette derivation has its own test; this file cares
 *  only that a roster entry gets ONE of them, deterministically. */
const COLORS: CollabColor[] = [
  { hex: '#aa0000', hue: 20, source: 'palette', lc: { light: 41, dark: 42 } },
  { hex: '#00aa00', hue: 140, source: 'palette', lc: { light: 41, dark: 42 } },
  { hex: '#0000aa', hue: 260, source: 'spun', lc: { light: 41, dark: 42 } },
];

async function loopback(clock: FakeClock, opts: { names?: [string, string] } = {}): Promise<Wire> {
  const toolId = `collab-loopback-${++toolSeq}`;
  const ids: [string, string] = ['A-DEVICE', 'B-DEVICE'];
  const held = { on: false };
  const dark = { from: null as string | null };
  const queued = new Map<string, CanvasOp[][]>([[ids[0], []], [ids[1], []]]);
  const nodes = new Map<string, Node>();
  const lanes = new Map<string, Lanes>();

  const deliverOps = (to: string, ops: readonly CanvasOp[]): void => {
    if (held.on) { queued.get(to)!.push([...ops]); return; }
    nodes.get(to)!.session.applyRemotePatch(ops);
  };

  async function makeNode(self: string, peer: string, name: string): Promise<Node> {
    const runtime = await createRuntime(loopbackTool(toolId), engineHost(), {});
    const adapter = new WireAdapter(self);
    const sched = scheduler();
    const presenceIn = stream<PresenceFrame>();
    const events = stream<CollabConnectionState>();
    const presenceOut: PresenceFrame[] = [];

    // A fake Document, so the away flag (section 11.4) is drivable without jsdom.
    const visibility = new Set<() => void>();
    const fakeDoc = {
      hidden: false,
      addEventListener: (_type: string, fn: () => void): void => { visibility.add(fn); },
      removeEventListener: (_type: string, fn: () => void): void => { visibility.delete(fn); },
    };

    // ── mountTool's wrapper stack, in mountTool's order ──────────────────────
    // 1. the undo-history wrapper (views/tool.ts), over the engine's setter;
    // 2. the collab wrapper, installed OUTSIDE it by attachCollabPlumbing - so a
    //    local edit records a step AND syncs, and a history replay syncs too.
    const history = createHistory();
    let applyingHistory = false;
    let at = 0;   // injected "now" for the history model's gesture coalescing
    const baseSetInput = runtime.setInput.bind(runtime);
    runtime.setInput = (id: string, value: InputValue): Promise<void> => {
      if (!applyingHistory) {
        const cur = runtime.getModel().find(i => i.id === id);
        if (cur) {
          at += 1000;   // every edit is its own gesture (COALESCE_MS is 500)
          history.record({ id, label: cur.label || cur.id, before: cur.value, after: value }, at);
        }
      }
      return baseSetInput(id, value);
    };

    // The presence lane is lossy and immediate by construction - never held by the
    // partition, which only ever buffers OPS. A frame goes into the peer's
    // `presenceIn` stream, the same door an RTC data channel writes to, so a peer
    // that has closed (and torn down its subscription) simply stops hearing us.
    const handle: CollabSessionHandle = {
      adapter,
      role: 'writer',
      self: { clientId: self, name },
      presenceIn,
      sendPresence: (frame) => {
        presenceOut.push(frame);
        if (dark.from !== self) lanes.get(peer)?.presenceIn(frame);
      },
      events,
      close: () => {},
      hostClientId: ids[0],
    };
    lanes.set(self, { presenceIn: (f) => { presenceIn.push(f); }, events: (s) => { events.push(s); } });

    const session = createCollabSession({
      handle,
      runtime,
      toolManifest: { id: toolId },
      sidebarRoot: null,
      colors: COLORS,
      doc: fakeDoc as unknown as Document,
      now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
      raf: sched.raf,
    });

    adapter.transmit = (ops) => { deliverOps(peer, ops); };

    return {
      id: self, runtime, session, adapter, history, sched, presenceOut,
      set: (id, value) => runtime.setInput(id, value),
      async undo() {
        const entry = history.undo();
        if (!entry) return;
        applyingHistory = true;
        history.endGesture();
        let pending: Promise<void>;
        try { pending = runtime.setInput(entry.id, cloneValue(entry.before)); }
        finally { applyingHistory = false; }
        await pending;
      },
      values: () => Object.fromEntries(runtime.getModel().map(i => [i.id, i.value])),
      hydrated: () => runtime.getHydrated(),
      hide(hidden) {
        fakeDoc.hidden = hidden;
        for (const fn of [...visibility]) fn();
      },
    };
  }

  const names = opts.names ?? ['Ada', 'Grace'];
  const a = await makeNode(ids[0], ids[1], names[0]);
  nodes.set(ids[0], a);
  const b = await makeNode(ids[1], ids[0], names[1]);
  nodes.set(ids[1], b);

  const wire: Wire = {
    a, b,
    join() {
      // The handshake the transport owes the presence engine (section 4.7): the full set
      // MINUS the joiner's own entry (tldraw's orphan bug). One frame each is
      // enough to bootstrap - the receiving engine answers immediately, because a
      // client that has been dutifully silent is otherwise invisible to the
      // newcomer. Everything after this is the two engines talking.
      for (const frame of a.session.presence.snapshot(b.id)) lanes.get(b.id)!.presenceIn(frame);
      for (const frame of b.session.presence.snapshot(a.id)) lanes.get(a.id)!.presenceIn(frame);
      for (const id of ids) lanes.get(id)!.events('live');
    },
    hold() { held.on = true; },
    blackout(side) { dark.from = side === null ? null : side === 'a' ? ids[0] : ids[1]; },
    release(order = 'a-first') {
      held.on = false;
      const first = order === 'a-first' ? ids[1] : ids[0];   // "a-first" = A's ops land first
      const second = first === ids[0] ? ids[1] : ids[0];
      for (const to of [first, second]) {
        const batches = queued.get(to)!.splice(0);
        for (const batch of batches) nodes.get(to)!.session.applyRemotePatch(batch);
      }
    },
    async settle() {
      for (let i = 0; i < 60; i++) {
        let ran = false;
        for (const node of [a, b]) if (node.sched.runAll()) ran = true;
        await tick();
        await tick();
        if (!ran && a.sched.pending() === 0 && b.sched.pending() === 0) return;
      }
      throw new Error('loopback did not settle');
    },
    close() {
      a.session.close();
      b.session.close();
    },
  };
  return wire;
}

// ── comparison helpers ────────────────────────────────────────────────────────

/** FNV-1a over the hydrated template - the render-hash proxy section 10 asks for. The
 *  hydrated string IS what the shell builds the DOM (and therefore the export)
 *  from, so equality here is the strongest determinism claim available without a
 *  browser. */
function renderHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The converged document, serialized so two docs compare as strings. Re-sorted
 *  here rather than trusting `state()`'s own canonicalisation, so a regression in
 *  that canonicalisation cannot hide behind this assertion. */
function serializeDoc(s: CanvasDocState): string {
  const byKey = (a: readonly [string, unknown], b: readonly [string, unknown]): number =>
    (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  const rows = (m: Map<BoxId, BoxRow>): unknown[] =>
    [...m.entries()].sort(byKey).map(([id, row]) => [id, Object.keys(row).sort().map(k => [k, row[k]])]);
  const params: [string, ParamValue][] = [...s.params.entries()].sort(byKey);
  const collections = s.collections
    ? [...s.collections.entries()].sort(byKey).map(([id, c]) => [id, c.order, rows(c.boxes)])
    : null;
  return JSON.stringify([['order', s.order], ['boxes', rows(s.boxes)], ['params', params], ['collections', collections]]);
}

function assertConverged(w: Wire, label: string): void {
  assert.deepEqual(w.a.values(), w.b.values(), `${label}: input models converge`);
  assert.equal(w.a.hydrated(), w.b.hydrated(), `${label}: identical render (hydrated template)`);
  assert.equal(
    renderHash(w.a.hydrated()), renderHash(w.b.hydrated()),
    `${label}: identical render hash`,
  );
  assert.equal(
    serializeDoc(w.a.adapter.doc.state()), serializeDoc(w.b.adapter.doc.state()),
    `${label}: identical serialized doc state`,
  );
}

/** One `blocks` row as the model holds it. */
type Row = { [key: string]: InputValue | undefined };

/** A blocks row, born with its stable id exactly as the sidebar mints one. */
const row = (label: string, note = ''): Row => ({ [ROW_ID_FIELD]: ulid(), label, note });

/** The op kinds this side sent, as a readable list for the failure message. */
const kinds = (ops: readonly CanvasOp[]): string[] =>
  ops.map(o => (o.k === 'param' ? `param:${o.key}` : `${o.k}`));

const itemsOf = (node: Node): Row[] => {
  const value = node.values().items;
  return Array.isArray(value) ? (value as Row[]) : [];
};

// ── 1 + 2. convergence and the determinism hash ───────────────────────────────

test('interleaved scalar + blocks edits on both sides converge to one model, one render, one doc', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('loopback');
  const clock = fakeClock();
  const w = await loopback(clock);
  w.join();

  // Ground truth: they start identical, so every assertion below is about the
  // edits and not about a shared starting point.
  assertConverged(w, 'baseline');

  // ── scalars, alternating sides ───────────────────────────────────────────
  await w.a.set('title', 'from A');
  await w.settle();
  await w.b.set('flag', true);
  await w.settle();
  await w.a.set('count', 4);
  await w.settle();
  assertConverged(w, 'scalars');
  assert.equal(w.b.values().title, 'from A', 'A\'s scalar actually landed on B');
  assert.equal(w.a.values().flag, true, 'and B\'s landed on A');

  // ── blocks: add on both sides, sequentially ──────────────────────────────
  const r1 = row('a-one');
  await w.a.set('items', [r1]);
  await w.settle();
  assertConverged(w, 'first add');
  assert.equal(itemsOf(w.b).length, 1, 'the row crossed');

  const r2 = row('b-one');
  await w.b.set('items', [...itemsOf(w.b), r2]);
  await w.settle();
  assertConverged(w, 'second add');
  assert.deepEqual(itemsOf(w.a).map(r => r.label), ['a-one', 'b-one']);

  // ── field edits, one per side ────────────────────────────────────────────
  await w.a.set('items', itemsOf(w.a).map(r => (r[ROW_ID_FIELD] === r1[ROW_ID_FIELD] ? { ...r, label: 'a-one*' } : r)));
  await w.settle();
  await w.b.set('items', itemsOf(w.b).map(r => (r[ROW_ID_FIELD] === r2[ROW_ID_FIELD] ? { ...r, note: 'noted' } : r)));
  await w.settle();
  assertConverged(w, 'field edits');
  assert.deepEqual(itemsOf(w.a).map(r => `${r.label}/${r.note}`), ['a-one*/', 'b-one/noted']);

  // ── reorder (the gesture no row-map diff can see - the shell mints it) ────
  await w.a.set('items', [...itemsOf(w.a)].reverse());
  await w.settle();
  assertConverged(w, 'reorder');
  assert.deepEqual(itemsOf(w.b).map(r => r.label), ['b-one', 'a-one*'], 'the reorder crossed');

  // ── remove ───────────────────────────────────────────────────────────────
  await w.b.set('items', itemsOf(w.b).filter(r => r[ROW_ID_FIELD] !== r1[ROW_ID_FIELD]));
  await w.settle();
  assertConverged(w, 'remove');
  assert.deepEqual(itemsOf(w.a).map(r => r.label), ['b-one']);

  // ── genuinely concurrent structural edits: neither side has seen the other's ──
  // Released in the OPPOSITE order to the one they were made in, so this is a
  // real interleaving and not a disguised sequence. Structural row ops MERGE
  // (`rebuildCollection` adds, removes and re-sorts rather than replacing), while a
  // per-key VALUE write converges instead through the adapter's post-apply state - 
  // see the concurrent same-key test below, which owns that boundary.
  w.hold();
  await w.a.set('items', [...itemsOf(w.a), row('a-two')]);
  await w.b.set('items', [...itemsOf(w.b), row('b-two')]);
  w.release('b-first');
  await w.settle();
  assertConverged(w, 'concurrent add');
  assert.equal(itemsOf(w.a).length, 3, 'both concurrent rows survived (no lost insert)');

  // Concurrent removals of DIFFERENT rows, released the other way again.
  const survivors = itemsOf(w.a);
  w.hold();
  await w.a.set('items', survivors.filter(r => r.label !== 'a-two'));
  await w.b.set('items', survivors.filter(r => r.label !== 'b-two'));
  w.release('a-first');
  await w.settle();
  assertConverged(w, 'concurrent remove');
  assert.deepEqual(itemsOf(w.a).map(r => r.label), ['b-one'], 'both removals stuck');

  // The determinism claim section 10 actually asks for, stated once, at the end.
  const hash = renderHash(w.a.hydrated());
  assert.equal(renderHash(w.b.hydrated()), hash, 'render hash identical across the pair');
  assert.ok(w.a.hydrated().includes('<m>mirror:'), 'the hook-derived input is in the render');
  assert.ok(/<x>\d+\//.test(w.a.hydrated()), 'and so is the hook-derived extra');

  w.close();
  assert.equal(clock.pending(), 0, 'no timer left armed');
});

/**
 * THE CONCURRENT SAME-KEY CASE. Written first as a KNOWN GAP (2026-08-09, by this
 * file) and flipped the same day when `collab-plumbing.ts` was fixed; kept as the
 * regression, because it is the only arrangement that can tell the two behaviours
 * apart.
 *
 * WHAT WAS WRONG: two peers write the same key while partitioned. Their DOCUMENTS
 * always converged - `ReferenceCanvasDoc` arbitrates by Lamport `(clock, client)`
 * and discards the loser. Their INPUT MODELS did not: `buildPatch` read `op.value`
 * straight off the wire and handed it to `runtime.applyPatch`, having never asked
 * the adapter which write won. The side whose local write was NEWER got stomped by
 * the older remote value, and the pair ended up on two different models - and two
 * different renders - permanently, until somebody wrote that key again.
 *
 * WHY IT WAS INVISIBLE ELSEWHERE: every unit test delivers a remote op to a side
 * that has NOT concurrently written the same key, which is the only case where "raw
 * op value" and "converged value" agree. It takes two real runtimes and a partition
 * to separate them, which is exactly what section 10 asked this file for.
 *
 * THE FIX: `flush()` now snapshots `adapter.state()` after `applyRemotePatch` and
 * builds the patch from the CONVERGED value of each touched key. That is also what a
 * Yjs adapter requires rather than merely prefers - its merge result is a property of
 * the shared type, never of the op payload.
 */
test('a remote write that LOSES the merge does not stomp the local model', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('loopback');
  const clock = fakeClock();
  const w = await loopback(clock);
  w.join();

  w.hold();
  await w.a.set('title', 'A concurrent');   // lower Lamport clock - this write LOST
  await w.b.set('title', 'B concurrent');   // higher - this is the write that WON
  w.release('a-first');
  await w.settle();

  // The CRDT is right, on both sides - it always was.
  assert.equal(
    w.a.adapter.doc.state().params.get('title'), 'B concurrent',
    'A\'s document took the newer write',
  );
  assert.equal(
    w.b.adapter.doc.state().params.get('title'), 'B concurrent',
    'and B\'s document kept its own newer write - the documents converge',
  );

  // …and now so are the models. B must NOT take the stale remote value over its own
  // newer write, and A must take the winner rather than its own losing one.
  assert.equal(w.b.values().title, 'B concurrent',
    'the loser\'s value never reaches the winner\'s model');
  assert.equal(w.a.values().title, 'B concurrent',
    'and the loser adopts what actually won');
  assertConverged(w, 'concurrent same-key param');

  // Same mechanism one lane down: a concurrent FIELD write inside a collection.
  const r = row('start');
  await w.a.set('items', [r]);
  await w.settle();
  w.hold();
  await w.a.set('items', [{ ...r, label: 'from A' }]);
  await w.b.set('items', [{ ...r, label: 'from B' }]);
  w.release('a-first');
  await w.settle();
  assert.deepEqual(
    itemsOf(w.a).map(x => x.label), itemsOf(w.b).map(x => x.label),
    'the field lane inside a collection converges in the MODEL too, not just in the doc',
  );
  assertConverged(w, 'concurrent same-field row');

  w.close();
});

test('a constrained value converges in the MODEL even though the doc carries the raw write', async () => {
  // section 11.11: an out-of-range remote value is clamped by the receiver's own
  // constraints, not dropped. Both peers clamp identically, so the models
  // converge - while the doc keeps the literal that crossed the wire. Documented
  // here because "doc == model" is the assumption a future reader would make.
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('loopback');
  const clock = fakeClock();
  const w = await loopback(clock);
  w.join();

  await w.a.set('count', 99);          // max is 10
  await w.settle();

  assert.equal(w.a.values().count, 10, 'the sender clamped');
  assert.equal(w.b.values().count, 10, 'and the receiver clamped to the same value');
  assertConverged(w, 'clamped');
  assert.equal(
    w.a.adapter.doc.state().params.get('count'), 99,
    'the doc holds the literal that crossed - the doc is not the model',
  );
  w.close();
});

// ── 3. presence ───────────────────────────────────────────────────────────────

test('presence: silent while alone, one throttled frame carries focus, away crosses, leave removes', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('loopback');
  const clock = fakeClock();
  const w = await loopback(clock, { names: ['Ada', 'Grace'] });

  // ── alone ────────────────────────────────────────────────────────────────
  w.a.session.setFocus('title');
  w.a.session.setFocus('items');
  w.a.session.refreshLocation();
  clock.advance(PRESENCE_HEARTBEAT_MS * 3);

  assert.equal(w.a.presenceOut.length, 0, 'nothing to say, nobody to hear (section 4.7)');
  assert.equal(w.b.presenceOut.length, 0, 'and the same on the other side');
  assert.equal(clock.pending(), 0, 'not even a timer scheduled while alone');

  assert.equal(w.a.session.state().connection, 'connecting', 'and no connection is claimed yet');

  // ── join ─────────────────────────────────────────────────────────────────
  w.join();
  assert.equal(w.a.session.state().connection, 'live', 'the transport\'s state reaches the session');
  assert.equal(w.a.presenceOut.length, 1, 'the handshake costs A exactly one frame');
  assert.equal(w.b.presenceOut.length, 1, 'and B exactly one');
  assert.equal(w.b.session.state().peers.length, 1, 'B sees A');
  assert.equal(w.a.session.state().peers.length, 1, 'A sees B');
  assert.equal(w.b.session.state().peers[0]!.name, 'Ada', 'the chosen name crossed, nothing else');

  // ── focus, inside one throttle window ────────────────────────────────────
  const focusToken = 'items:01J0000000000000000000000A';
  w.a.session.setFocus(focusToken);
  w.a.session.setFocus('title');
  w.a.session.setFocus(focusToken);     // a burst - the LAST one must be what lands
  assert.equal(w.a.presenceOut.length, 1, 'the burst is coalesced, nothing sent yet');

  clock.advance(PRESENCE_THROTTLE_MS);
  assert.equal(w.a.presenceOut.length, 2, 'exactly one frame for the whole burst');
  assert.equal(
    w.b.session.state().peers[0]!.focus, focusToken,
    'and B\'s roster shows the focus within one throttle window (section 4.1, section 4.7)',
  );

  // ── away (section 11.4): a hidden tab says so, and is never evicted ─────────────
  w.a.hide(true);
  clock.advance(PRESENCE_THROTTLE_MS);
  assert.equal(w.b.session.state().peers[0]!.away, true, 'the away flag crossed');

  // …and now the part that makes that flag worth having. A backgrounded tab's
  // timers are throttled to ~1/min, so ITS heartbeat stops arriving while the
  // channel is fine and the other direction keeps flowing. Starve A's outbound
  // lane and run well past the TTL: the away peer must still be there. (Without
  // this, the assertion proves nothing - A's own 15 s heartbeat would keep
  // refreshing B's TTL, so no peer could ever be evicted for any reason.)
  w.blackout('a');
  clock.advance(PRESENCE_TTL_MS * 2 + PRESENCE_SWEEP_MS);
  assert.equal(w.b.session.state().peers.length, 1, 'an away peer is exempt from eviction');
  assert.equal(w.b.session.state().peers[0]!.away, true, 'and still reads as away, never as gone');

  w.blackout(null);
  w.a.hide(false);
  clock.advance(PRESENCE_THROTTLE_MS);
  assert.equal(w.b.session.state().peers[0]!.away, false, 'and comes back');

  // ── leave: the clean `null` frame removes immediately, not at the TTL ────
  assert.equal(w.b.session.state().peers.length, 1, 'A is still in the roster');
  w.a.session.close();
  assert.equal(w.b.session.state().peers.length, 0, 'a clean leave removes at once (section 4.7)');
  assert.equal(
    w.a.presenceOut.at(-1)?.state, null,
    'and the leave really was the `null` frame, sent while the wire was still up',
  );

  w.b.session.close();
  assert.equal(clock.pending(), 0, 'both sides left no timer armed');
});

test('presence control: a silent VISIBLE peer IS evicted at the TTL', async () => {
  // The counterweight to the away exemption above. Without this, "an away peer is
  // not evicted" could be true because NOTHING is ever evicted - which would make
  // a crashed peer ghost forever, the exact failure the TTL exists to prevent.
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('loopback');
  const clock = fakeClock();
  const w = await loopback(clock);
  w.join();
  assert.equal(w.b.session.state().peers.length, 1);

  w.blackout('a');                                         // A's tab crashed: no leave frame
  clock.advance(PRESENCE_TTL_MS + PRESENCE_SWEEP_MS * 2);
  assert.equal(w.b.session.state().peers.length, 0, 'a silent, VISIBLE peer is swept at the TTL');

  w.close();
  assert.equal(clock.pending(), 0, 'and the lifecycle stopped with the last peer');
});

// ── 4. undo isolation ─────────────────────────────────────────────────────────

test('undo is local-user-scoped: A\'s undo re-converges the pair and never touches B\'s stack', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('loopback');
  const clock = fakeClock();
  const w = await loopback(clock);
  w.join();

  await w.a.set('title', 'A wrote this');
  await w.settle();
  await w.b.set('flag', true);
  await w.settle();

  assert.deepEqual(w.a.history.sizes(), { undo: 1, redo: 0 }, 'A recorded its own edit');
  assert.deepEqual(
    w.b.history.sizes(), { undo: 1, redo: 0 },
    'B recorded ONLY its own - A\'s remote value never entered B\'s history',
  );
  assert.equal(w.b.values().title, 'A wrote this');

  // A undoes. Per section 5 a replay is just another local edit: it syncs.
  await w.a.undo();
  await w.settle();

  assert.equal(w.a.values().title, 'hello', 'A is back at the default');
  assert.equal(w.b.values().title, 'hello', 'and the undo re-converged the pair');
  assertConverged(w, 'after A undo');

  assert.deepEqual(w.a.history.sizes(), { undo: 0, redo: 1 }, 'A\'s own stack moved');
  assert.deepEqual(
    w.b.history.sizes(), { undo: 1, redo: 0 },
    'B\'s stack is untouched - my undo never moves your history (section 10)',
  );

  // And B's own undo still undoes B's edit, not A's.
  await w.b.undo();
  await w.settle();
  assert.equal(w.b.values().flag, false);
  assert.equal(w.a.values().flag, false, 'B\'s undo crossed too');
  assertConverged(w, 'after B undo');
  assert.deepEqual(w.a.history.sizes(), { undo: 0, redo: 1 }, 'and A\'s stack still did not move');

  w.close();
});

// ── 5. echo / duplication ─────────────────────────────────────────────────────

test('op counts on the wire match the edits made: no echo, no hook-derived re-emit', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('loopback');
  const clock = fakeClock();
  const w = await loopback(clock);
  w.join();

  // Ground truth FIRST: the hook really does write another declared input and an
  // extras-only key, so "no hook-derived ops" is not vacuously true.
  await w.a.set('title', 'one');
  await w.settle();
  assert.equal(w.a.values().mirror, 'mirror:one', 'the hook wrote a second DECLARED input');
  assert.ok(w.a.hydrated().includes('<x>0/</x>'), 'and an extras-only key');
  assert.equal(w.b.values().mirror, 'mirror:one', 'the receiver DERIVED the same value locally');

  assert.deepEqual(kinds(w.a.adapter.sent), ['param:title'], 'one scalar edit = one op');
  assert.deepEqual(w.b.adapter.sent, [], 'the receiver emitted NOTHING - no echo');

  // A blocks add: the adapter's differ mints the AddOp, the shell adds the paint
  // order the differ cannot see. Two ops, and not one more.
  const r1 = row('one');
  await w.a.set('items', [r1]);
  await w.settle();
  assert.deepEqual(
    kinds(w.a.adapter.sent), ['param:title', 'add', 'order'],
    'a first add costs an AddOp plus the shell\'s order rewrite',
  );
  assert.deepEqual(w.b.adapter.sent, [], 'still nothing back');

  // A field edit is the cheap common case: exactly one op, no order rewrite.
  await w.a.set('items', [{ ...r1, label: 'one*' }]);
  await w.settle();
  assert.deepEqual(
    kinds(w.a.adapter.sent), ['param:title', 'add', 'order', 'field'],
    'a field edit adds exactly one op',
  );

  // Now the other direction, to prove the silence is not just "B never edits".
  await w.b.set('flag', true);
  await w.settle();
  assert.deepEqual(kinds(w.b.adapter.sent), ['param:flag'], 'B emits for B\'s own edit only');
  assert.equal(
    w.a.adapter.sent.length, 4,
    'and A emitted nothing in response to B\'s op (no ping-pong)',
  );

  // Nothing hook-derived ever crossed, on either side, for any op kind.
  const all = [...w.a.adapter.sent, ...w.b.adapter.sent];
  assert.ok(
    all.every(o => o.k !== 'param' || o.key !== 'mirror'),
    'the hook-written input is never an op (section 11.9)',
  );
  assert.ok(
    all.every(o => o.k === 'param' || o.k === 'order' || !('row' in o) || !('tally' in o.row)),
    'and the extras-only key is not even a field',
  );

  // The wire totals, as measured: 5 ops in 5 messages, one per gesture.
  assert.equal(all.length, 5, 'five ops for five gestures + one order rewrite');
  assert.equal(w.a.adapter.messages + w.b.adapter.messages, 5);
  assert.equal(w.a.adapter.received.length, 1, 'A took exactly one batch off the wire');
  assert.equal(w.b.adapter.received.length, 3, 'B took three (title, the add gesture, the field)');

  // POSITIVE CONTROL. `mirror` is absent above because the HOOK wrote it, not
  // because the seam refuses that input - typed by hand it crosses like any
  // other scalar. Without this, the section 11.9 assertion could pass for the wrong
  // reason forever.
  await w.a.set('mirror', 'typed by hand');
  await w.settle();
  assert.deepEqual(
    kinds(w.a.adapter.sent).slice(-1), ['param:mirror'],
    'the SAME input does cross when a user writes it - the hook is what was silent',
  );

  assertConverged(w, 'after the counted run');
  w.close();
});

// ── 6. solo cost ──────────────────────────────────────────────────────────────

test('solo: with no provider registered a mount touches nothing and calls no adapter', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('solo-device');
  assert.equal(getCanvasSyncProvider(), undefined, 'the registry starts empty');

  const runtime = await createRuntime(loopbackTool(`collab-solo-${++toolSeq}`), engineHost(), {});
  const spy = new WireAdapter('never-registered');
  let transmits = 0;
  spy.transmit = () => { transmits += 1; };

  const before = runtime.setInput;
  const plumbing = attachCollabPlumbing(runtime);

  assert.equal(plumbing, null, 'no provider, no plumbing');
  assert.equal(runtime.setInput, before, 'and setInput was never wrapped - byte-identical single-player');

  await runtime.setInput('title', 'solo');
  await runtime.setInput('items', [row('solo-row')]);
  await runtime.setInput('count', 3);

  assert.equal(spy.sent.length, 0, 'zero ops minted');
  assert.equal(spy.messages, 0, 'zero messages');
  assert.equal(transmits, 0, 'zero transmissions');
  assert.equal(spy.received.length, 0, 'zero inbound');
  assert.equal(spy.doc.state().params.size, 0, 'and the document was never touched');

  const soloRender = runtime.getHydrated();

  // The positive control: the SAME sequence with the adapter registered does
  // reach it - otherwise the zeros above would prove only that the spy is inert.
  const unregister = registerCanvasSyncProvider(spy);
  const wired = await createRuntime(loopbackTool(`collab-wired-${++toolSeq}`), engineHost(), {});
  const wiredBefore = wired.setInput;
  const attached = attachCollabPlumbing(wired);
  assert.notEqual(attached, null, 'a registered provider IS picked up');
  assert.notEqual(wired.setInput, wiredBefore, 'and setInput IS wrapped');

  await wired.setInput('title', 'solo');
  await wired.setInput('items', [row('solo-row')]);
  await wired.setInput('count', 3);

  assert.ok(spy.sent.length > 0, `the same edits DO reach a registered adapter (${spy.sent.length} ops)`);
  assert.equal(
    wired.getHydrated(), soloRender,
    'and being in a collab does not change one byte of the render',
  );

  attached?.detach();
  unregister();
  _clearCanvasSyncProviderForTests();
});
