// SPDX-License-Identifier: MPL-2.0
/**
 * The collab session composition layer (plan 100 section 4.6, section 5).
 *
 * Every piece this module composes is already tested on its own, so what is worth
 * pinning here is only what COMPOSITION can get wrong - and each of these has a
 * specific way of failing silently:
 *
 *  1. ZERO TRAFFIC WHEN ALONE survives the wiring (section 4.7). The presence engine
 *     promises it; a session that pushed a frame on every focus change would break
 *     it from the outside, and single-player would start paying for a feature it
 *     does not have.
 *  2. Focus changes ride the 50 ms throttle and the LAST one still lands. Tabbing
 *     through a sidebar is a burst; a frame per control is the bug.
 *  3. A blocks row is addressed by its STABLE ID, never its array index. The DOM
 *     only knows the index, so this is the one place the model has to be consulted - 
 *     get it wrong and a peer's ring lands on whichever row moved into that slot.
 *  4. Inbound frames build the roster in first-seen order, and colours are
 *     deterministic: a peer's own broadcast colour is honoured, an unknown one is
 *     re-derived, and nobody doubles up.
 *  5. An observer's edits never become ops, while remote ops still land (contract
 *     section 9 - read everything, write nothing).
 *  6. `close()` leaves NOTHING behind - zero armed timers (asserted through the
 *     injected timer hook, the only honest way), the runtime's setInput restored,
 *     the transport closed, and a clean `null` leave frame sent while the wire was
 *     still up.
 *  7. THE GUARD IS ACTUALLY ON BOTH INBOUND WIRES (section 6.3, section 11.21). `op-guard.ts`
 *     proves what the guard decides; these cases prove it is CONSULTED - that a
 *     refused op cannot reach `runtime.applyPatch` or the converging document, that
 *     a refused presence frame cannot reach the roster, and that structural abuse
 *     leaves through `onAbuse` rather than by closing a transport this module does
 *     not own. The drop-vs-disconnect split is tested as the two separate behaviours
 *     it is: a DROP takes one op and the batch carries on, while structural ABUSE
 *     condemns the whole message - so "the valid ops beside it still apply" is a
 *     claim about drop-class malice only, and asserting it of a prototype key would
 *     be asserting the opposite of what the guard is documented to do.
 *
 * Everything runs on fake time and a hand-driven frame scheduler, so no case here
 * sleeps or depends on rAF.
 *
 * Run directly:  node --test shells/web/src/lib/collab-session.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { ReferenceCanvasDoc } from '@lolly-tools/core/canvas-op-v1';
import type {
  Awareness, BoxId, BoxRow, CanvasOp, CanvasSyncAdapter, Damage,
} from '@lolly-tools/core/canvas-op-v1';
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/#/t/qr-code' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.FocusEvent = dom.window.FocusEvent;
globalThis.Event = dom.window.Event;
// jsdom boots at visibilityState 'prerender', so `document.hidden` is TRUE out of the
// box - which would make every session here start away. Pin it to the state a real
// foreground tab is in; the away case flips it deliberately.
const setHidden = (v: boolean): void => {
  Object.defineProperty(document, 'hidden', { value: v, configurable: true });
};
setHidden(false);

const { createCollabSession, focusTokenFor, _clearCollabPaletteCacheForTests, COLLAB_ANNOUNCE_MS } =
  await import('./collab-session.ts');
type SessionModule = typeof import('./collab-session.ts');
type CollabSessionHandle = Parameters<SessionModule['createCollabSession']>[0]['handle'];
type CollabConnectionState = Parameters<Parameters<CollabSessionHandle['events']['subscribe']>[0]>[0];
type CollabColor = NonNullable<Parameters<SessionModule['createCollabSession']>[0]['colors']>[number];
type CollabAbuseEvent =
  Parameters<NonNullable<Parameters<SessionModule['createCollabSession']>[0]['onAbuse']>>[0];

const { PRESENCE_HEARTBEAT_MS, PRESENCE_THROTTLE_MS } = await import('./collab-presence.ts');
type PresenceModule = typeof import('./collab-presence.ts');
type PresenceFrame = Parameters<
  NonNullable<Parameters<PresenceModule['createPresenceEngine']>[0]['send']>
>[0];
type PresenceState = NonNullable<PresenceFrame['state']>;

const { ROW_ID_FIELD } = await import('./row-id.ts');

// ── fake time ─────────────────────────────────────────────────────────────────

function fakeClock() {
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
    now: (): number => t,
    setTimer: (fn: () => void, ms: number): unknown => {
      const id = nextId++;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimer: (handle: unknown): void => { timers.delete(handle as number); },
    advance(ms: number): void { const until = t + ms; runDue(until); t = until; },
    /** Timers still armed - how "left nothing behind" is asserted. */
    pending: (): number => timers.size,
  };
}

// ── fakes ─────────────────────────────────────────────────────────────────────

/** A minimal subscribable stream plus a `push` a test drives it with. */
function stream<T>() {
  const subs = new Set<(v: T) => void>();
  return {
    subscribe(fn: (v: T) => void): () => void { subs.add(fn); return () => { subs.delete(fn); }; },
    push(v: T): void { for (const fn of [...subs]) fn(v); },
    count: (): number => subs.size,
  };
}

/** A real converging adapter, with every crossing recorded. */
class FakeAdapter implements CanvasSyncAdapter {
  readonly doc = new ReferenceCanvasDoc('peer');
  readonly applied: CanvasOp[] = [];
  readonly local: { rows: Map<BoxId, BoxRow>; col?: string }[] = [];
  readonly remote: CanvasOp[][] = [];
  onLocalChange(damage: Damage, rows: Map<BoxId, BoxRow>, col?: string): CanvasOp[] {
    this.local.push({ rows: new Map(rows), col });
    return this.doc.onLocalChange(damage, rows, col);
  }
  apply(op: CanvasOp): void { this.applied.push(op); this.doc.apply(op); }
  applyRemotePatch(ops: readonly CanvasOp[]): Damage {
    this.remote.push([...ops]);
    return this.doc.applyRemotePatch(ops);
  }
  presence(_a: Awareness): void { /* ephemeral */ }
  state() { return this.doc.state(); }
}

interface Wire {
  handle: CollabSessionHandle;
  adapter: FakeAdapter;
  /** Every outbound presence frame, in order. */
  sent: PresenceFrame[];
  /** Deliver an inbound frame. */
  deliver(frame: PresenceFrame): void;
  /** Push a connection-state change. */
  connect(state: CollabConnectionState): void;
  closes: number;
  inboundSubs(): number;
}

function wire(over: Partial<{
  role: 'writer' | 'observer';
  name: string;
  colorIndex: number;
  hostClientId: string;
  peerRole(id: string): 'writer' | 'observer' | undefined;
}> = {}): Wire {
  const adapter = new FakeAdapter();
  const presenceIn = stream<PresenceFrame>();
  const events = stream<CollabConnectionState>();
  const sent: PresenceFrame[] = [];
  const out: Wire = {
    adapter,
    sent,
    closes: 0,
    deliver: (frame) => { presenceIn.push(frame); },
    connect: (state) => { events.push(state); },
    inboundSubs: () => presenceIn.count(),
    handle: {
      adapter,
      role: over.role ?? 'writer',
      self: {
        clientId: 'SELF',
        ...(over.name !== undefined ? { name: over.name } : {}),
        ...(over.colorIndex !== undefined ? { colorIndex: over.colorIndex } : {}),
      },
      presenceIn,
      sendPresence: (frame) => { sent.push(frame); },
      events,
      close: () => { out.closes += 1; },
      ...(over.hostClientId !== undefined ? { hostClientId: over.hostClientId } : {}),
      ...(over.peerRole ? { peerRole: over.peerRole } : {}),
    },
  };
  return out;
}

/** A runtime wired the way mountTool wires one (mirrors collab-plumbing.test.ts). */
interface Harness {
  getModel(): InputModelItem[];
  setInput(id: string, value: InputValue): Promise<void>;
  applyPatch(values: Record<string, unknown>): Promise<void>;
  readonly patches: Record<string, unknown>[];
}

function harness(items: InputModelItem[]): Harness {
  let model = items.map(i => ({ ...i }));
  const patches: Record<string, unknown>[] = [];
  const write = (id: string, value: unknown): void => {
    model = model.map(i => (i.id === id ? { ...i, value: value as InputValue } : i));
  };
  return {
    patches,
    getModel: () => model,
    async setInput(id, value) { write(id, value); },
    async applyPatch(values) {
      patches.push(values);
      for (const [id, v] of Object.entries(values)) if (model.some(i => i.id === id)) write(id, v);
    },
  };
}

const text = (id: string, value: InputValue): InputModelItem =>
  ({ id, type: 'text', value, isDirty: false, control: 'text-input' });

const blocks = (id: string, value: InputValue): InputModelItem =>
  ({ id, type: 'blocks', value, isDirty: false, control: 'blocks', fields: [{ id: 'label', type: 'text' }] });

/** A declared input whose value is an OBJECT - the `param` lane's counter-example. */
const assetInput = (id: string): InputModelItem =>
  ({ id, type: 'asset', value: null, isDirty: false, control: 'asset-picker' });

/** The guard logs every refusal it makes; capture the lines so the suite's output
 *  stays readable AND the logging itself can be asserted rather than assumed. */
function captureWarn(): { lines: unknown[][]; restore(): void } {
  const lines: unknown[][] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]): void => { lines.push(args); };
  return { lines, restore: (): void => { console.warn = original; } };
}

/** A hand-driven frame scheduler, so nothing here depends on rAF. */
function scheduler() {
  const pending: (() => void)[] = [];
  return {
    raf: (fn: () => void) => { pending.push(fn); },
    async frame(): Promise<void> {
      for (const fn of pending.splice(0, pending.length)) fn();
      await new Promise(r => setTimeout(r, 0));
    },
  };
}

/** A presence payload from a peer. */
const peerState = (over: Partial<PresenceState> = {}): PresenceState =>
  ({ userId: 'U', name: '', color: '', ...over } as PresenceState);

/** Three fixed colours - the palette derivation has its own test; this file cares
 *  only about WHICH slot each person ends up in. */
const swatch = (hex: string, hue: number): CollabColor =>
  ({ hex, hue, source: 'spun', lc: { light: 41, dark: 42 } });
const COLORS: CollabColor[] = [swatch('#aa0000', 20), swatch('#00aa00', 140), swatch('#0000aa', 260)];

/** A sidebar the delegated focus listener can be attached to. */
function sidebar(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `
    <input data-input-id="title">
    <input data-input-id="subtitle">
    <div class="blocks-input" data-input-id="items">
      <div class="block-item" data-block-index="0"><input class="block-field" data-field-id="items.0.label"></div>
      <div class="block-item" data-block-index="1"><input class="block-field" data-field-id="items.1.label"></div>
    </div>`;
  document.body.appendChild(el);
  return el;
}

const focusIn = (el: Element): void => {
  el.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }));
};
const focusOut = (el: Element, to: Element | null = null): void => {
  el.dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true, relatedTarget: to }));
};

// ── the cases ─────────────────────────────────────────────────────────────────

test('alone: focus changes cost nothing on the wire, and arm no timer', () => {
  const clock = fakeClock();
  const w = wire();
  const root = sidebar();
  const session = createCollabSession({
    handle: w.handle,
    runtime: harness([text('title', ''), text('subtitle', '')]),
    sidebarRoot: root,
    colors: COLORS,
    doc: null,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });

  focusIn(root.querySelector('[data-input-id="title"]')!);
  focusIn(root.querySelector('[data-input-id="subtitle"]')!);
  clock.advance(PRESENCE_HEARTBEAT_MS * 3);

  assert.equal(w.sent.length, 0, 'nothing to say, nobody to hear (plan 100 section 4.7)');
  assert.equal(clock.pending(), 0, 'and not even a timer scheduled');
  session.close();
  root.remove();
});

test('with a peer here, a burst of focus changes is one throttled frame - the last one', () => {
  const clock = fakeClock();
  const w = wire();
  const root = sidebar();
  const session = createCollabSession({
    handle: w.handle,
    runtime: harness([text('title', ''), text('subtitle', '')]),
    sidebarRoot: root,
    colors: COLORS,
    doc: null,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });

  // A peer arrives: the engine announces us immediately, which is the frame that
  // makes the newcomer able to see us at all.
  w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1', name: 'Priya' }) });
  assert.equal(w.sent.length, 1, 'first company flushes our own state');

  focusIn(root.querySelector('[data-input-id="title"]')!);
  focusIn(root.querySelector('[data-input-id="subtitle"]')!);
  assert.equal(w.sent.length, 1, 'both landed inside the 50 ms window - nothing extra went out yet');

  clock.advance(PRESENCE_THROTTLE_MS);
  assert.equal(w.sent.length, 2, 'exactly one trailing flush for the burst');
  assert.equal(w.sent[1]!.state?.focus, 'subtitle', 'and it carries the LAST focus, not the first');

  session.close();
  root.remove();
});

test('a blocks row is addressed by its stable id, never by its array index', () => {
  const clock = fakeClock();
  const w = wire();
  const root = sidebar();
  const runtime = harness([
    blocks('items', [{ [ROW_ID_FIELD]: 'AAA', label: 'a' }, { [ROW_ID_FIELD]: 'BBB', label: 'b' }]),
  ]);
  const session = createCollabSession({
    handle: w.handle, runtime, sidebarRoot: root, colors: COLORS, doc: null,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1' }) });

  const secondRow = root.querySelector('.block-item[data-block-index="1"] input')!;
  focusIn(secondRow);
  clock.advance(PRESENCE_THROTTLE_MS);
  assert.equal(w.sent.at(-1)!.state?.focus, 'items:BBB', 'the token is "<blocksId>:<rowId>"');

  // The rows swap places (a peer inserted above, a drag reordered). The DOM index is
  // unchanged; the identity behind it is not - and THAT is what must be reported.
  void runtime.applyPatch({
    items: [{ [ROW_ID_FIELD]: 'BBB', label: 'b' }, { [ROW_ID_FIELD]: 'AAA', label: 'a' }],
  });
  focusOut(secondRow);
  focusIn(secondRow);
  clock.advance(PRESENCE_THROTTLE_MS);
  assert.equal(w.sent.at(-1)!.state?.focus, 'items:AAA', 'the index moved, so the token moved with it');

  session.close();
  root.remove();
});

test('a row with no stable id degrades to the plain input id rather than lying', () => {
  const runtime = harness([blocks('items', [{ label: 'a' }])]);
  const root = sidebar();
  const token = focusTokenFor(
    root.querySelector('.block-item[data-block-index="0"] input'),
    runtime.getModel(),
    root,
  );
  assert.equal(token, 'items', 'a coarser ring beats a ring on the wrong row');
  root.remove();
});

test('focus leaving the sidebar clears the report; moving within it never blanks', () => {
  const clock = fakeClock();
  const w = wire();
  const root = sidebar();
  const outside = document.createElement('button');
  document.body.appendChild(outside);
  const session = createCollabSession({
    handle: w.handle,
    runtime: harness([text('title', ''), text('subtitle', '')]),
    sidebarRoot: root, colors: COLORS, doc: null,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1' }) });

  const title = root.querySelector<HTMLElement>('[data-input-id="title"]')!;
  const subtitle = root.querySelector<HTMLElement>('[data-input-id="subtitle"]')!;
  focusIn(title);
  clock.advance(PRESENCE_THROTTLE_MS);

  // focusout fires BEFORE the next focusin; resolving from relatedTarget is what
  // keeps a "focus: nothing" frame out of the gap between two controls.
  focusOut(title, subtitle);
  assert.equal(session.state().self.focus, 'subtitle', 'the handover reads as the destination');
  focusIn(subtitle);
  clock.advance(PRESENCE_THROTTLE_MS);
  assert.ok(
    w.sent.every(f => f.state === null || f.state.focus !== undefined || f.seq === 1),
    'no blank-focus frame between two sidebar controls',
  );

  focusOut(subtitle, outside);
  clock.advance(PRESENCE_THROTTLE_MS);
  assert.equal(session.state().self.focus, undefined, 'leaving the sidebar clears it');
  assert.equal(w.sent.at(-1)!.state?.focus, undefined);

  session.close();
  root.remove();
  outside.remove();
});

test('inbound frames build the roster in first-seen order; a null state leaves at once', () => {
  const clock = fakeClock();
  const w = wire();
  const session = createCollabSession({
    handle: w.handle, runtime: harness([text('title', '')]), colors: COLORS, doc: null,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  const seen: number[] = [];
  session.subscribe(s => seen.push(s.peers.length));

  w.deliver({ from: 'P2', seq: 1, state: peerState({ userId: 'P2', name: 'Sam' }) });
  w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1', name: 'Priya' }) });
  assert.deepEqual(session.state().peers.map(p => p.clientId), ['P2', 'P1'], 'join order, not id order');
  assert.deepEqual(session.state().peers.map(p => p.name), ['Sam', 'Priya']);
  assert.deepEqual(seen, [1, 2], 'each arrival notified exactly once');

  w.deliver({ from: 'P2', seq: 2, state: null });
  assert.deepEqual(session.state().peers.map(p => p.clientId), ['P1']);

  session.close();
});

test('an away peer stays in the roster, flagged - a hidden tab is not a dead tab', () => {
  const clock = fakeClock();
  const w = wire();
  const session = createCollabSession({
    handle: w.handle, runtime: harness([text('title', '')]), colors: COLORS, doc: null,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1' }), away: true });
  assert.equal(session.state().peers.length, 1);
  assert.equal(session.state().peers[0]!.away, true);
  session.close();
});

test("colours: a peer's own broadcast colour is honoured, an unknown one is re-derived, nobody doubles up", () => {
  const clock = fakeClock();
  const w = wire({ colorIndex: 0 });
  const session = createCollabSession({
    handle: w.handle, runtime: harness([text('title', '')]), colors: COLORS, doc: null,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });

  // P1 paints itself blue and says so; P2 is on a different brand pack, so its hex
  // is not one of ours at all (section 11.16) and has to be re-derived locally.
  w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1', color: '#0000AA' }) });
  w.deliver({ from: 'P2', seq: 1, state: peerState({ userId: 'P2', color: '#123456' }) });

  const state = session.state();
  assert.equal(state.self.color, '#aa0000', 'the ceremony index wins for self');
  assert.equal(state.self.colorIndex, 0);
  assert.equal(state.peers[0]!.color, '#0000aa', 'case-insensitive claim of a colour we know');
  assert.equal(state.peers[1]!.color, '#00aa00', 'the only slot left');
  const hexes = [state.self.color, ...state.peers.map(p => p.color)];
  assert.equal(new Set(hexes).size, 3, 'three people, three colours');

  session.close();
});

test('the same roster yields the same colours on a second, independent session', () => {
  const build = () => {
    const clock = fakeClock();
    const w = wire({ colorIndex: 1 });
    const session = createCollabSession({
      handle: w.handle, runtime: harness([text('title', '')]), colors: COLORS, doc: null,
      now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    });
    w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1' }) });
    w.deliver({ from: 'P2', seq: 1, state: peerState({ userId: 'P2' }) });
    const out = [session.state().self.color, ...session.state().peers.map(p => p.color)];
    session.close();
    return out;
  };
  assert.deepEqual(build(), build(), 'nothing here reads a clock or a random source');
});

test('the "Invitee 2+" ordinal and the host flag come off the declared host', () => {
  const clock = fakeClock();
  const w = wire({ hostClientId: 'SELF' });
  const session = createCollabSession({
    handle: w.handle, runtime: harness([text('title', '')]), colors: COLORS, doc: null,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1' }) });
  w.deliver({ from: 'P2', seq: 1, state: peerState({ userId: 'P2' }) });
  w.deliver({ from: 'P3', seq: 1, state: peerState({ userId: 'P3', name: 'Priya' }) });

  const s = session.state();
  assert.equal(s.self.isHost, true);
  assert.equal(s.self.inviteeIndex, 0, 'a host is never numbered');
  assert.deepEqual(s.peers.map(p => p.inviteeIndex), [1, 2, 0], 'only the anonymous ones are');
  session.close();
});

test('a peer role is reported only when the transport actually knows it', () => {
  const clock = fakeClock();
  const w = wire({ role: 'observer', peerRole: (id) => (id === 'P1' ? 'observer' : undefined) });
  const session = createCollabSession({
    handle: w.handle, runtime: harness([text('title', '')]), colors: COLORS, doc: null,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1' }) });
  w.deliver({ from: 'P2', seq: 1, state: peerState({ userId: 'P2' }) });

  const s = session.state();
  assert.equal(s.role, 'observer');
  assert.equal(s.self.role, 'observer');
  assert.equal(s.peers[0]!.role, 'observer');
  assert.equal(s.peers[1]!.role, undefined, 'silence is not "writer"');
  session.close();
});

test('connection-state changes republish on the session stream', () => {
  const clock = fakeClock();
  const w = wire();
  const session = createCollabSession({
    handle: w.handle, runtime: harness([text('title', '')]), colors: COLORS, doc: null,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  const seen: string[] = [];
  session.subscribe(s => seen.push(s.connection));
  assert.equal(session.state().connection, 'connecting');
  w.connect('live');
  w.connect('live');
  w.connect('reconnecting');
  assert.deepEqual(seen, ['live', 'reconnecting'], 'a repeat of the same state is not a change');
  session.close();
});

test('an observer edits nothing onto the wire, but remote ops still land', async () => {
  const clock = fakeClock();
  const sched = scheduler();
  const w = wire({ role: 'observer' });
  const runtime = harness([text('title', 'before')]);
  const session = createCollabSession({
    handle: w.handle, runtime, colors: COLORS, doc: null, raf: sched.raf,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });

  await runtime.setInput('title', 'typed by the observer');
  assert.deepEqual(w.adapter.applied, [], 'no op minted');
  assert.deepEqual(w.adapter.local, [], 'and the adapter never saw a local gesture');

  session.applyRemotePatch([
    { k: 'param', key: 'title', value: 'from the room', origin: { client: 'P1', clock: 9 } },
  ]);
  await sched.frame();
  assert.deepEqual(runtime.patches, [{ title: 'from the room' }], 'reading still works');
  assert.equal(w.adapter.remote.length, 1, 'and the observer document converges');

  session.close();
});

test('a writer edit does become an op (the observer case is a real difference)', async () => {
  const clock = fakeClock();
  const sched = scheduler();
  const w = wire();
  const runtime = harness([text('title', 'before')]);
  const session = createCollabSession({
    handle: w.handle, runtime, colors: COLORS, doc: null, raf: sched.raf,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  await runtime.setInput('title', 'after');
  assert.equal(w.adapter.applied.length, 1);
  assert.equal(w.adapter.applied[0]!.k, 'param');
  session.close();
});

test('away rides visibilitychange', () => {
  const clock = fakeClock();
  const w = wire();
  const session = createCollabSession({
    handle: w.handle, runtime: harness([text('title', '')]), colors: COLORS,
    doc: document,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1' }) });
  const before = w.sent.length;
  assert.equal(w.sent.at(-1)!.away, false, 'a foreground tab is not away');

  setHidden(true);
  document.dispatchEvent(new dom.window.Event('visibilitychange'));
  clock.advance(PRESENCE_THROTTLE_MS);
  assert.ok(w.sent.length > before, 'the flag change is worth a frame');
  assert.equal(w.sent.at(-1)!.away, true);

  setHidden(false);
  document.dispatchEvent(new dom.window.Event('visibilitychange'));
  clock.advance(PRESENCE_THROTTLE_MS);
  assert.equal(w.sent.at(-1)!.away, false, 'and coming back is worth another');

  session.close();
});

test('a session started in an already-hidden tab reports away from the first frame', () => {
  const clock = fakeClock();
  const w = wire();
  setHidden(true);
  const session = createCollabSession({
    handle: w.handle, runtime: harness([text('title', '')]), colors: COLORS,
    doc: document,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  setHidden(false);
  w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1' }) });
  assert.equal(w.sent.at(-1)!.away, true, 'the state was read at construction, not only on change');
  session.close();
});

test('close() leaves nothing behind: no timers, no listeners, no wrapper, no transport', async () => {
  const clock = fakeClock();
  const sched = scheduler();
  const w = wire();
  const runtime = harness([text('title', 'before')]);
  const original = runtime.setInput;
  const root = sidebar();
  const session = createCollabSession({
    handle: w.handle, runtime, sidebarRoot: root, colors: COLORS, doc: document, raf: sched.raf,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  assert.notEqual(runtime.setInput, original, 'the op wrapper is installed while live');

  w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1' }) });
  assert.ok(clock.pending() > 0, 'company arms the heartbeat and the sweep');

  const notified: number[] = [];
  session.subscribe(s => notified.push(s.peers.length));
  const before = w.sent.length;

  session.close();

  assert.equal(clock.pending(), 0, 'every timer disarmed - the whole point of the injected hook');
  assert.equal(w.closes, 1, 'the transport was closed, once');
  assert.equal(w.inboundSubs(), 0, 'and unsubscribed from');
  assert.equal(runtime.setInput, original, 'the runtime got its own setInput back');
  assert.equal(w.sent.length, before + 1, 'a clean leave went out while the wire was still up');
  assert.equal(w.sent.at(-1)!.state, null, 'and it is the null frame, not a stale snapshot');

  // Nothing that arrives afterwards may wake it.
  w.deliver({ from: 'P2', seq: 1, state: peerState({ userId: 'P2' }) });
  focusIn(root.querySelector('[data-input-id="title"]')!);
  await runtime.setInput('title', 'after close');
  clock.advance(PRESENCE_HEARTBEAT_MS * 2);
  assert.deepEqual(notified, [], 'no notification after close');
  assert.equal(clock.pending(), 0);
  assert.equal(w.sent.length, before + 1, 'and no further traffic');
  assert.equal(w.adapter.applied.length, 0, 'the detached wrapper emits no ops');

  session.close();
  assert.equal(w.closes, 1, 'close() is idempotent');
  root.remove();
});

test('setFocus reports focus from outside the sidebar (the canvas overlay path)', () => {
  const clock = fakeClock();
  const w = wire();
  const session = createCollabSession({
    handle: w.handle, runtime: harness([text('title', '')]), colors: COLORS, doc: null,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1' }) });
  session.setFocus('items:AAA');
  clock.advance(PRESENCE_THROTTLE_MS);
  assert.equal(w.sent.at(-1)!.state?.focus, 'items:AAA');
  session.setFocus(null);
  clock.advance(PRESENCE_THROTTLE_MS);
  assert.equal(w.sent.at(-1)!.state?.focus, undefined);
  session.close();
});

test('location comes from the callback, re-read on every publish', () => {
  const clock = fakeClock();
  const w = wire();
  let slide = 'slide-1';
  const session = createCollabSession({
    handle: w.handle, runtime: harness([text('title', '')]), colors: COLORS, doc: null,
    getLocation: () => slide,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1' }) });
  assert.equal(w.sent.at(-1)!.state?.location, 'slide-1');
  slide = 'slide-4';
  session.refreshLocation();
  clock.advance(PRESENCE_THROTTLE_MS);
  assert.equal(w.sent.at(-1)!.state?.location, 'slide-4');
  assert.equal(session.state().self.location, 'slide-4');
  session.close();
});

test('a derived palette is memoised per (accent, palette) pair', () => {
  _clearCollabPaletteCacheForTests();
  const clock = fakeClock();
  const opts = {
    runtime: harness([text('title', '')]),
    palette: ['#2563eb', '#f97316'],
    accent: '#2563eb',
    doc: null,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  } as const;
  const a = wire();
  const b = wire();
  const s1 = createCollabSession({ ...opts, handle: a.handle });
  const s2 = createCollabSession({ ...opts, handle: b.handle });
  assert.equal(s1.state().self.color, s2.state().self.color);
  assert.ok(/^#[0-9a-f]{6}$/i.test(s1.state().self.color), 'a real derived hex, not a placeholder');
  s1.close();
  s2.close();
});

test('a throwing subscriber does not stop the ones after it', () => {
  const clock = fakeClock();
  const w = wire();
  const session = createCollabSession({
    handle: w.handle, runtime: harness([text('title', '')]), colors: COLORS, doc: null,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  let reached = 0;
  session.subscribe(() => { throw new Error('consumer bug'); });
  session.subscribe(() => { reached += 1; });
  w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1' }) });
  assert.equal(reached, 1);
  session.close();
});

test('the "Invitee 2+" ordinal is the same on every device, not lowest-for-whoever-is-asking', () => {
  // section 4.5's numbering is consumed by collabDisplayName, which feeds the avatar title,
  // the roster row, the stack's aria-label, the focus chip and every announce()
  // string. If two devices number the same two people differently, each side calls
  // ITSELF "Invitee" and the other "Invitee 2" - two people with two different names
  // for the same two people, which is worse than not numbering at all.
  const view = (selfId: string, peerId: string, hostClientId?: string) => {
    const clock = fakeClock();
    const w = wire(hostClientId !== undefined ? { hostClientId } : {});
    (w.handle.self as { clientId: string }).clientId = selfId;
    const session = createCollabSession({
      handle: w.handle, runtime: harness([text('title', '')]), colors: COLORS, doc: null,
      now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    });
    w.deliver({ from: peerId, seq: 1, state: peerState({ userId: peerId }) });
    const s = session.state();
    const named = new Map<string, number>([[s.self.clientId, s.self.inviteeIndex]]);
    for (const p of s.peers) named.set(p.clientId, p.inviteeIndex);
    session.close();
    return named;
  };

  // Two anonymous peers, no host declared - an explicitly supported configuration
  // ("absent is fine and simply means every nameless peer reads as an invitee").
  const fromA = view('AAA', 'BBB');
  const fromB = view('BBB', 'AAA');
  assert.deepEqual([...fromA].sort(), [...fromB].sort(),
    'both devices agree on who is Invitee and who is Invitee 2');
  assert.equal(fromA.get('AAA'), 1);
  assert.equal(fromA.get('BBB'), 2);

  // Hub mode - a declared host plus two invitees, which is what the "2+" numbering
  // exists for in the first place. The host is never numbered on either device.
  const hubFromA = view('AAA', 'BBB', 'HOST');
  const hubFromB = view('BBB', 'AAA', 'HOST');
  assert.deepEqual([...hubFromA].sort(), [...hubFromB].sort(),
    'and they still agree once a host is declared');
});

// ── the guard on the two inbound wires (section 6.3, section 11.21) ─────────────────────────

/** One op origin. The client id is a peer's, because that is the point. */
const from = (clock: number, client = 'P1'): { client: string; clock: number } => ({ client, clock });

/** A session with the guard's reports collected. */
function guarded(items: InputModelItem[], over: Parameters<typeof wire>[0] = {}) {
  const clock = fakeClock();
  const sched = scheduler();
  const w = wire(over);
  const runtime = harness(items);
  const abuse: CollabAbuseEvent[] = [];
  const session = createCollabSession({
    handle: w.handle, runtime, colors: COLORS, doc: null, raf: sched.raf,
    onAbuse: (e) => { abuse.push(e); },
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  return { clock, sched, w, runtime, session, abuse };
}

test('drop-class malice is refused per-op, and the valid ops beside it still apply', async () => {
  // section 11.11's rule, which is also section 11.19's forward-compatibility rule: an op this
  // build cannot make sense of costs that op and nothing else. An input id we do not
  // declare (a newer peer), an object-valued input addressed on the scalar lane, and
  // an over-sized string are all things a buggy or half-migrated peer genuinely
  // emits - none of them is a reason to end a session.
  const g = guarded([text('title', 'before'), text('subtitle', 'sub'), assetInput('logo')]);
  const log = captureWarn();
  try {
    g.session.applyRemotePatch([
      { k: 'param', key: 'title', value: 'landed', origin: from(1) },
      { k: 'param', key: 'undeclared', value: 'x', origin: from(2) },
      { k: 'param', key: 'logo', value: 'suse/logo/primary', origin: from(3) },
      { k: 'param', key: 'subtitle', value: 'x'.repeat(65 * 1024), origin: from(4) },
    ] as unknown as CanvasOp[]);
    await g.sched.frame();
  } finally {
    log.restore();
  }

  assert.deepEqual(g.runtime.patches, [{ title: 'landed' }],
    'exactly the one legal write reached the runtime');
  assert.equal(g.w.adapter.remote.length, 1, 'and the adapter saw one batch');
  assert.equal(g.w.adapter.remote[0]!.length, 1, 'containing only the op that survived');
  assert.deepEqual(g.abuse, [], 'a drop is not abuse - nothing to disconnect over');
  assert.equal(log.lines.length, 1, 'the refusals are reported once for the message');
  assert.deepEqual(log.lines[0]![1], ['unknown-input: undeclared', 'wrong-lane: logo', 'value-too-large'],
    'with the typed reason for each, and the peer-derived detail the guard capped');

  g.session.close();
});

test('a prototype key condemns the whole message and leaves as an abuse event', async () => {
  // The other half of the split. A `__proto__` collection id, and an own `__proto__`
  // inside an `add` row, are both schema-VALID (op-guard.test.ts asserts that against
  // the canonical ajv validator) and both become object keys downstream. Nothing in
  // this codebase can emit one, so section 11.21 treats the sender as hostile: the batch is
  // condemned entire - including the perfectly good op travelling with it - and the
  // verdict goes out for the transport to act on.
  const g = guarded([text('title', 'before'), blocks('items', [{ [ROW_ID_FIELD]: 'AAA', label: 'a' }])]);
  const log = captureWarn();
  try {
    g.session.applyRemotePatch([
      { k: 'param', key: 'title', value: 'would have been fine', origin: from(1) },
      { k: 'field', id: 'AAA', col: '__proto__', field: 'label', value: 'x', origin: from(2) },
    ] as unknown as CanvasOp[]);
    await g.sched.frame();
  } finally {
    log.restore();
  }

  assert.deepEqual(g.runtime.patches, [], 'nothing from that message reached the runtime');
  assert.deepEqual(g.w.adapter.remote, [], 'and nothing reached the converging document');
  assert.equal(g.abuse.length, 1);
  assert.equal(g.abuse[0]!.lane, 'ops');
  assert.equal(g.abuse[0]!.reason, 'forbidden-key');
  assert.equal(g.w.closes, 0, 'the session did NOT hang up - that is the transport\'s call');
  assert.equal(g.session.state().connection, 'connecting', 'and it did not fake a state change');

  // The same verdict for the other shape: an own `__proto__` key inside a row, which
  // only `JSON.parse` (i.e. the wire) can produce.
  const log2 = captureWarn();
  try {
    g.session.applyRemotePatch([{
      k: 'add', id: 'BBB', col: 'items', orderKey: 'i', origin: from(3),
      row: JSON.parse('{"__proto__": {"label": "pwn"}}') as Record<string, unknown>,
    }] as unknown as CanvasOp[]);
    await g.sched.frame();
  } finally {
    log2.restore();
  }
  assert.deepEqual(g.runtime.patches, [], 'still nothing');
  assert.equal(g.abuse.length, 2);
  assert.equal(g.abuse[1]!.reason, 'forbidden-key');
  assert.equal(({} as Record<string, unknown>).label, undefined, 'and Object.prototype is untouched');

  g.session.close();
});

test('a presence flood raises the abuse event, and the flooding frame never lands', () => {
  // section 11.21's ~40 frames/s. The window is measured on the INJECTED clock, which never
  // advances here - so this is one second's worth of traffic by construction, with no
  // sleeping and no dependence on how fast the machine runs the loop.
  const g = guarded([text('title', '')]);
  const log = captureWarn();
  try {
    for (let seq = 1; seq <= 41; seq++) {
      g.w.deliver({ from: 'P1', seq, state: peerState({ userId: 'P1', name: 'Flood' }) });
    }
  } finally {
    log.restore();
  }

  assert.equal(g.abuse.length, 1, 'exactly the frame that broke the ceiling');
  assert.equal(g.abuse[0]!.lane, 'presence');
  assert.equal(g.abuse[0]!.reason, 'rate-limited');
  assert.equal(g.abuse[0]!.from, 'P1', 'the transport is told WHICH peer to act on');
  assert.equal(g.session.presence.roster()[0]!.seq, 40,
    'the 41st frame never reached the engine - it did not even move the bookkeeping');
  assert.equal(g.w.closes, 0, 'and again: reported, not hung up on');

  g.session.close();
});

test('a presence frame that would poison a CSS value is dropped, not escalated', () => {
  // A colour is painted into a style value, so `url(…)` in one is a network fetch
  // from the viewer's browser to an address the peer chose. It is refused - but it is
  // a VALUE, and a value out of range is exactly what section 11.11 says to drop and carry
  // on with, so the peer keeps its seat.
  const g = guarded([text('title', '')]);
  const log = captureWarn();
  try {
    g.w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1', color: 'url(https://x.example/p)' }) });
  } finally {
    log.restore();
  }

  assert.deepEqual(g.session.state().peers, [], 'the frame never became a roster entry');
  assert.deepEqual(g.abuse, [], 'and a bad colour is not grounds for a disconnect');
  assert.equal(log.lines.length, 1);
  assert.deepEqual(log.lines[0]![1], ['unsafe-string: color']);

  // The same peer, one legal frame later, is simply here.
  g.w.deliver({ from: 'P1', seq: 2, state: peerState({ userId: 'P1', name: 'Priya' }) });
  assert.deepEqual(g.session.state().peers.map(p => p.name), ['Priya']);

  g.session.close();
});

test('clean traffic is byte-identical: the same op objects, the same counts, no noise', async () => {
  // The zero-behaviour-change claim, made where it can actually fail. The guard is a
  // GATE, never a codec: what the adapter applies must be the very object the peer
  // sent, not a normalized copy of it - a clone would silently break the identity a
  // future adapter (or a `===` in a differ) is entitled to rely on.
  const g = guarded([text('title', 'before'), blocks('items', [{ [ROW_ID_FIELD]: 'AAA', label: 'a' }])]);
  const batch = [
    { k: 'param', key: 'title', value: 'from the room', origin: from(1) },
    { k: 'field', id: 'AAA', col: 'items', field: 'label', value: 'edited', origin: from(2) },
    { k: 'add', id: 'BBB', col: 'items', row: { label: 'new' }, orderKey: 'j', origin: from(3) },
  ] as unknown as CanvasOp[];

  const log = captureWarn();
  try {
    g.w.deliver({ from: 'P1', seq: 1, state: peerState({ userId: 'P1', name: 'Priya' }) });
    g.session.applyRemotePatch(batch);
    await g.sched.frame();
  } finally {
    log.restore();
  }

  assert.deepEqual(log.lines, [], 'clean traffic writes nothing to the console');
  assert.deepEqual(g.abuse, [], 'and raises nothing');
  assert.equal(g.w.adapter.remote.length, 1, 'one coalesced batch, exactly as before');
  const delivered = g.w.adapter.remote[0]!;
  assert.equal(delivered.length, batch.length);
  for (let i = 0; i < batch.length; i++) {
    assert.equal(delivered[i], batch[i], 'the same object, not a copy of it');
  }
  assert.equal(g.runtime.patches.length, 1, 'one apply');
  assert.equal(g.runtime.patches[0]!.title, 'from the room');
  assert.deepEqual(
    (g.runtime.patches[0]!.items as { label?: unknown }[]).map(r => r.label), ['edited', 'new'],
    'the collection rebuild is untouched by the guard',
  );
  assert.equal(g.session.state().peers.length, 1, 'and the presence lane still admits a real peer');

  g.session.close();
});

// ── the discovery announcer (drill finding 2026-08-10) ────────────────────────

test('undiscovered: a live connection with an empty roster announces on a slow cadence until first contact', () => {
  const clock = fakeClock();
  const w = wire();
  const session = createCollabSession({
    handle: w.handle,
    runtime: harness([text('title', '')]),
    sidebarRoot: null,
    colors: COLORS,
    doc: null,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });

  // Not live yet: silence, exactly as before.
  clock.advance(COLLAB_ANNOUNCE_MS * 3);
  assert.equal(w.sent.length, 0, 'no announce before the connection is live');

  w.connect('live');
  clock.advance(PRESENCE_THROTTLE_MS + 1);
  assert.ok(w.sent.length >= 1, 'going live while undiscovered speaks first');
  const afterLive = w.sent.length;

  clock.advance(COLLAB_ANNOUNCE_MS * 2 + 10);
  assert.ok(w.sent.length > afterLive, 'the lossy lane gets repeats until first contact');

  // First contact: the announcer stands down; ordinary presence rules take over.
  w.deliver({ from: 'PEER', seq: 1, state: peerState({ userId: 'PEER', name: 'P' }) });
  const atContact = w.sent.length;
  clock.advance(COLLAB_ANNOUNCE_MS * 2);
  const announcesAfterContact = w.sent.length - atContact;
  // The 15s heartbeat may not have elapsed; the 2s announcer must be gone.
  assert.ok(announcesAfterContact <= 1, `announcer stops on first contact (saw ${announcesAfterContact} extra frames)`);

  session.close();
  const atClose = w.sent.length;
  clock.advance(COLLAB_ANNOUNCE_MS * 4);
  assert.equal(w.sent.length, atClose, 'close leaves no announcer running');
});
