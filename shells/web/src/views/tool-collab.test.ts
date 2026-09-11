// SPDX-License-Identifier: MPL-2.0
/**
 * The presence chrome of a mounted tool, composed and then taken apart again
 * (plan 100 section 4.6, section 5).
 *
 * `views/tool.ts` cannot be mounted outside Vite, so its own guards are source
 * scans - but the thing those scans guard CAN be mounted, which is half the reason
 * `tool-collab.ts` is a module. This suite drives the real composition against a
 * real (jsdom) tool layout with a scripted transport, and pins the four properties
 * a reviewer would otherwise have to take on trust:
 *
 *  1. THE EXPORT INVARIANT. Not one node, class or attribute appears inside the
 *     render surface - the pill is a child of the stage and the overlay layer is a
 *     sibling of the canvas. A collaborator's presence must not be able to change a
 *     byte of an exported PNG (section 4.6, section 8), and "we were careful" is not a check.
 *  2. PRESENCE ACTUALLY LANDS. A peer's frame becomes an avatar, a sidebar ring in
 *     that peer's colour, and a cursor node - through the same wiring the tool view
 *     uses, not a test-only path.
 *  3. TEARDOWN IS COMPLETE. A navigation away mid-collab leaves ZERO timers, zero
 *     listeners, zero pending frames and zero nodes: the injected clock counts every
 *     timer armed and cleared, the sidebar comes back byte-identical to how it went
 *     in, and the transport is closed exactly once.
 *  4. TEARDOWN IS IDEMPOTENT. The tool view's abort path can genuinely call it
 *     twice; the second call must be a no-op, not a double dispose.
 *
 * Run directly:  node --test shells/web/src/views/tool-collab.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import type { PresenceFrame } from '../lib/collab-presence.ts';
import type { CanvasOp } from '@lolly-tools/core/canvas-op-v1';
import type { CollabSessionHandle } from '../lib/collab-session.ts';

const dom = new JSDOM(
  `<!doctype html><html><body>
     <div class="tool-stage" id="tool-stage">
       <div class="stage-nav" id="stage-nav"></div>
       <div class="tool-canvas-outer" id="tool-canvas-outer">
         <div class="tool-canvas" id="tool-canvas"></div>
       </div>
     </div>
     <div id="tool-inputs"></div>
   </body></html>`,
  { url: 'http://localhost/#/t/qr-code' },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.MouseEvent = dom.window.MouseEvent;
// jsdom ships no rAF unless it is pretending to be visual, and `announce()` (a11y.ts)
// defers its live-region write through one. Without this the FIRST thing the focus
// layer does on a roster change throws, the session swallows it (a subscriber's
// failure is its own), and the cursor layer downstream of it silently never runs - 
// which is exactly the kind of bug this suite exists to catch, so it must not be
// caused by the harness itself.
globalThis.requestAnimationFrame ??= ((cb: FrameRequestCallback) =>
  setTimeout(() => { cb(Date.now()); }, 0) as unknown as number) as typeof globalThis.requestAnimationFrame;
globalThis.cancelAnimationFrame ??= ((h: number) => {
  clearTimeout(h as unknown as ReturnType<typeof setTimeout>);
}) as typeof globalThis.cancelAnimationFrame;
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as unknown as typeof globalThis.ResizeObserver;

const { liveSessionState, mountToolCollab, pillLaneOffset, PILL_LANE_GAP_PX } = await import('./tool-collab.ts');

// ── fixtures ──────────────────────────────────────────────────────────────────

/** A clock whose armed timers can be counted - the only honest way to prove a
 *  teardown left nothing behind. */
function fakeClock() {
  const live = new Map<number, () => void>();
  let next = 1;
  let t = 0;
  return {
    armed: (): number => live.size,
    now: (): number => t,
    advance: (ms: number): void => { t += ms; },
    setTimer: (fn: () => void, _ms: number): unknown => { const id = next++; live.set(id, fn); return id; },
    clearTimer: (h: unknown): void => { live.delete(h as number); },
  };
}

/** The two OPTIONAL lanes a real transport publishes beyond the session contract - 
 *  `RtcCollabHandle.opsIn`/`roleIn` on Track A, `WorkCollabSessionHandle.opsIn` on
 *  Track B. The composition duck-types them, so the fake declares them the same way. */
interface FakeLanes {
  opsIn?: { subscribe(fn: (ops: readonly CanvasOp[]) => void): () => void };
  roleIn?: { subscribe(fn: (role: 'writer' | 'observer') => void): () => void };
}

/** A transport that records what the session asked of it. */
function fakeHandle(over: Partial<CollabSessionHandle> & FakeLanes = {}) {
  const sent: PresenceFrame[] = [];
  let deliver: ((frame: PresenceFrame) => void) | null = null;
  let closes = 0;
  const handle: CollabSessionHandle = {
    adapter: {
      onLocalChange: () => [],
      apply: () => {},
      applyRemotePatch: () => ({ col: '', moved: [], restyled: [], added: [], removed: [], zChanged: false }),
      presence: () => {},
      state: () => ({ boxes: new Map(), params: new Map(), order: [] }),
    } as unknown as CollabSessionHandle['adapter'],
    role: 'writer',
    self: { clientId: 'ME', name: 'Andy' },
    presenceIn: { subscribe: (fn) => { deliver = fn; return () => { deliver = null; }; } },
    sendPresence: (frame) => { sent.push(frame); },
    events: { subscribe: () => () => {} },
    close: () => { closes += 1; },
    ...over,
  } as CollabSessionHandle;
  return {
    handle,
    sent,
    closes: (): number => closes,
    subscribed: (): boolean => deliver !== null,
    arrive: (frame: PresenceFrame): void => { deliver?.(frame); },
  };
}

/** The runtime slice the composition touches. */
function fakeRuntime() {
  return {
    getModel: () => [{ id: 'headline', type: 'text', label: 'Headline', value: 'hi' }] as never,
    setInput: async (): Promise<void> => {},
    applyPatch: async (): Promise<void> => {},
  };
}

interface Layout {
  stage: HTMLElement;
  canvas: HTMLElement;
  sidebar: HTMLElement;
  /** Snapshot of the sidebar markup before anything decorated it. */
  sidebarBefore: string;
}

function layout(): Layout {
  const doc = dom.window.document;
  const stage = doc.getElementById('tool-stage')!;
  const canvas = doc.getElementById('tool-canvas')!;
  const sidebar = doc.getElementById('tool-inputs')!;
  // A realistic sidebar row: `[data-input-id]` on the control, wrapped in `.input-row`.
  sidebar.innerHTML = '<label class="input-row"><span>Headline</span>'
    + '<input data-input-id="headline" value="hi"></label>';
  canvas.innerHTML = '<h1 data-canvas-input="headline">hi</h1>';
  // Leave the stage as the mount found it (a previous test's pill/layer removed).
  for (const el of [...stage.children]) {
    if (el.id !== 'stage-nav' && el.id !== 'tool-canvas-outer') el.remove();
  }
  return { stage, canvas, sidebar, sidebarBefore: sidebar.innerHTML };
}

const peerFrame = (over: Partial<PresenceFrame['state']> = {}, seq = 1): PresenceFrame => ({
  from: 'PEER',
  seq,
  state: {
    userId: 'PEER',
    name: 'Priya',
    color: '#00a0a0',
    ...over,
  } as PresenceFrame['state'],
});

async function mount(clock = fakeClock(), transport = fakeHandle()) {
  const l = layout();
  const collab = await mountToolCollab({
    handle: transport.handle,
    runtime: fakeRuntime(),
    toolManifest: { id: 'qr-code' },
    host: null,
    stage: l.stage,
    canvas: l.canvas,
    sidebar: l.sidebar,
    // A fixed palette, so the assertions pin colours rather than the derivation
    // (which collab-colors.test.ts owns).
    colors: [
      { hex: '#aa0000', oklch: { l: 0.7, c: 0.12, h: 20 } },
      { hex: '#00a0a0', oklch: { l: 0.7, c: 0.12, h: 190 } },
    ] as never,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    raf: (fn) => { fn(); },
  });
  return { ...l, collab, clock, transport };
}

// ── 0. the ops wire ───────────────────────────────────────────────────────────

test('inbound ops reach the session - without this wire a collab never RECEIVES an edit', async () => {
  // The one property that makes everything else worth having. `CollabSessionHandle`
  // carries no ops member on purpose; both adapters publish one and both say the MOUNT
  // owns joining it to `session.applyRemotePatch`. Until it was joined, the roster, the
  // rings, the cursors and the pill all worked and every edit on either side was local
  // forever, with the pill reading "live".
  const remote: CanvasOp[][] = [];
  let push: ((ops: readonly CanvasOp[]) => void) | null = null;
  const transport = fakeHandle({
    adapter: {
      onLocalChange: () => [],
      apply: () => {},
      applyRemotePatch: (ops: readonly CanvasOp[]) => {
        remote.push([...ops]);
        return { col: '', moved: [], restyled: [], added: [], removed: [], zChanged: false };
      },
      presence: () => {},
      state: () => ({ boxes: new Map(), params: new Map(), order: [] }),
    } as unknown as CollabSessionHandle['adapter'],
    opsIn: { subscribe: (fn) => { push = fn; return () => { push = null; }; } },
  });
  const { collab } = await mount(fakeClock(), transport);

  assert.notEqual(push, null, 'the mount subscribes to the lane its transport publishes');
  push!([{ k: 'param', key: 'headline', value: 'from the peer', origin: { client: 'PEER', clock: 4 } }]);
  assert.equal(remote.length, 1, 'a peer edit lands in the converging document');
  assert.deepEqual(remote[0], [
    { k: 'param', key: 'headline', value: 'from the peer', origin: { client: 'PEER', clock: 4 } },
  ]);

  // …through the guarded door, not around it: a prototype key is refused before the
  // adapter sees it (section 11.21), which is only true because the ops go through
  // `session.applyRemotePatch` rather than straight to the document.
  push!([{ k: 'param', key: '__proto__', value: 'polluted', origin: { client: 'PEER', clock: 5 } }]);
  assert.equal(remote.length, 1, 'the hostile batch never reached the document');

  collab.teardown();
  assert.equal(push, null, 'and the lane is unsubscribed with everything else');
});

test('a section 11.19 observer downgrade republishes, so the pill stops claiming you can edit', async () => {
  let role: 'writer' | 'observer' = 'writer';
  let demote: ((next: 'writer' | 'observer') => void) | null = null;
  const transport = fakeHandle({
    roleIn: {
      subscribe: (fn) => {
        demote = fn;
        fn(role);   // both tracks REPLAY on subscribe - this must not cause a republish
        return () => { demote = null; };
      },
    },
  });
  // Live, exactly as both real handles expose it - `rtc-handle.ts` and
  // `org/collab-handle.ts` both define `role` as a GETTER, never a snapshot, and
  // `CollabSessionState.role` is rebuilt from it on every notify. (Defined rather than
  // spread: an object spread copies a getter's VALUE, which would freeze it here.)
  Object.defineProperty(transport.handle, 'role', { get: () => role, configurable: true });
  const { collab } = await mount(fakeClock(), transport);

  const seen: string[] = [];
  collab.session.subscribe((s) => { seen.push(s.role); });
  assert.deepEqual(seen, [], 'the replayed current role is not a change');

  role = 'observer';
  demote!('observer');
  assert.deepEqual(seen, ['observer'],
    'a demotion that arrives while nothing else is happening still has to reach the UI');

  collab.teardown();
});

// ── 1. the export invariant ───────────────────────────────────────────────────

test('no presence node, class or attribute ever enters the render surface', async () => {
  const { canvas, stage, collab, transport } = await mount();
  transport.arrive(peerFrame({ focus: 'headline', cursor: { x: 0.5, y: 0.5 } }));

  assert.equal(canvas.innerHTML, '<h1 data-canvas-input="headline">hi</h1>',
    'the canvas is READ, never written - an export must not move a pixel (section 4.6, section 8)');
  assert.equal(canvas.querySelector('.collab-canvas-layer'), null);
  assert.equal(canvas.querySelector('.collab-pill'), null);
  assert.equal(canvas.getAttribute('style'), null, 'not even a positioning side effect');

  // …and both surfaces are on the stage, outside the render.
  assert.ok(stage.querySelector(':scope > .collab-pill'), 'the pill is a child of the stage');
  const layer = stage.querySelector('.collab-canvas-layer');
  assert.ok(layer, 'the overlay layer mounted');
  assert.equal(canvas.contains(layer), false, 'as a SIBLING of the canvas, never inside it');

  collab.teardown();
});

test('the two canvas surfaces SHARE one layer, which is the z-order collab.css assumes', async () => {
  const { stage, collab } = await mount();
  assert.equal(stage.querySelectorAll('.collab-canvas-layer').length, 1);
  collab.teardown();
});

// ── 2. presence lands ─────────────────────────────────────────────────────────

test('a peer becomes an avatar, a sidebar ring in their colour, and a cursor', async () => {
  const { stage, sidebar, collab, transport } = await mount();

  assert.equal(stage.querySelectorAll('.collab-av').length, 1, 'self only, before anyone arrives');
  assert.equal(sidebar.querySelectorAll('.is-remote-focus').length, 0);

  transport.arrive(peerFrame({ focus: 'headline', cursor: { x: 0.25, y: 0.75 } }));

  assert.equal(stage.querySelectorAll('.collab-av').length, 2, 'self + Priya');
  const row = sidebar.querySelector<HTMLElement>('.is-remote-focus');
  assert.ok(row, 'the focused control’s row is ringed');
  assert.equal(row.style.getPropertyValue('--collab-color'), '#00a0a0',
    'in the colour that peer paints themselves (they claimed a hex in our palette)');
  assert.equal(row.querySelector('[data-collab-chips]')?.textContent, 'Priya',
    'with a name chip, because colour is never the only differentiator (section 4.8)');
  assert.equal(stage.querySelectorAll('.collab-cursor').length, 1, 'and a cursor node');

  // Focus moves away → the ring goes with it, nothing is stranded.
  transport.arrive(peerFrame({ cursor: { x: 0.25, y: 0.75 } }, 2));
  assert.equal(sidebar.querySelectorAll('.is-remote-focus').length, 0);

  collab.teardown();
});

test('an away peer keeps their roster entry but drops their ring and cursor (section 11.4)', async () => {
  const { stage, sidebar, collab, transport } = await mount();
  transport.arrive({ ...peerFrame({ focus: 'headline', cursor: { x: 0.5, y: 0.5 } }), away: true });

  assert.equal(stage.querySelectorAll('.collab-av').length, 2, 'still in the roster - away is not gone');
  assert.equal(sidebar.querySelectorAll('.is-remote-focus').length, 0, 'but a stale ring is worse than none');
  assert.equal(stage.querySelectorAll('.collab-cursor:not([hidden])').length, 0);

  collab.teardown();
});

test('reanchor is safe to call before, during and after a roster', async () => {
  const { collab, transport, sidebar } = await mount();
  collab.reanchor();
  transport.arrive(peerFrame({ focus: 'headline' }));
  collab.reanchor();
  assert.equal(sidebar.querySelectorAll('.is-remote-focus').length, 1,
    're-applying restores the decoration a sidebar rebuild would have washed off');
  collab.teardown();
  collab.reanchor();   // must not resurrect anything
  assert.equal(sidebar.querySelectorAll('.is-remote-focus').length, 0);
});

// ── 3. teardown is complete ───────────────────────────────────────────────────

test('teardown leaves ZERO timers, zero nodes and a sidebar byte-identical to before', async () => {
  const clock = fakeClock();
  const transport = fakeHandle();
  const { stage, canvas, sidebar, sidebarBefore, collab } = await mount(clock, transport);
  transport.arrive(peerFrame({ focus: 'headline', cursor: { x: 0.5, y: 0.5 } }));
  assert.ok(clock.armed() > 0, 'a live session arms presence timers - otherwise this proves nothing');

  collab.teardown();

  assert.equal(clock.armed(), 0, 'a navigation away mid-collab must leave no timer running');
  assert.equal(stage.querySelector('.collab-pill'), null, 'the pill is gone');
  assert.equal(stage.querySelector('.collab-canvas-layer'), null, 'the overlay layer is gone');
  assert.equal(stage.querySelector('.collab-cursor'), null, 'and every pooled cursor node with it');
  assert.equal(sidebar.innerHTML, sidebarBefore,
    'the sidebar is returned exactly as it was found - no class, no chip, no leftover style=""');
  assert.equal(canvas.innerHTML, '<h1 data-canvas-input="headline">hi</h1>');
  assert.equal(transport.closes(), 1, 'the transport is closed exactly once');
  assert.equal(transport.subscribed(), false, 'and its presence subscription released');
});

test('the leave frame goes out BEFORE the transport closes, so peers drop us at once', async () => {
  const transport = fakeHandle();
  const { collab } = await mount(fakeClock(), transport);
  transport.arrive(peerFrame());
  const before = transport.sent.length;

  collab.teardown();

  const leaves = transport.sent.slice(before).filter(f => f.state === null);
  assert.equal(leaves.length, 1, 'exactly one null-state leave frame (section 4.7)');
  assert.equal(transport.closes(), 1);
});

test('teardown is idempotent - the tool view’s abort path can call it twice', async () => {
  const clock = fakeClock();
  const transport = fakeHandle();
  const { collab } = await mount(clock, transport);
  transport.arrive(peerFrame({ focus: 'headline' }));

  collab.teardown();
  collab.teardown();
  collab.teardown();

  assert.equal(transport.closes(), 1, 'the transport is not closed three times');
  assert.equal(clock.armed(), 0);
});

test('one failing teardown step must not strand the transport still open', async () => {
  const clock = fakeClock();
  const transport = fakeHandle();
  const { stage, collab } = await mount(clock, transport);
  // Rip the pill out from under the component: `destroy()` still runs, but the
  // popover/DOM work inside it now has a torn tree to walk.
  stage.querySelector('.collab-pill')?.remove();

  const realWarn = console.warn;
  console.warn = (): void => {};
  try { collab.teardown(); } finally { console.warn = realWarn; }

  assert.equal(transport.closes(), 1, 'the last step still ran');
  assert.equal(clock.armed(), 0);
});

// ── 4. the pill's lane ────────────────────────────────────────────────────────

test('the pill measures the HUD it shares a lane with, rather than guessing', () => {
  const stage = dom.window.document.getElementById('tool-stage')!;
  stage.ownerDocument.documentElement.dir = 'ltr';
  assert.equal(pillLaneOffset(stage, () => 120), `${120 + PILL_LANE_GAP_PX}px`);
  assert.equal(pillLaneOffset(stage, () => 0), '', 'a zero-width HUD needs no clearance');
});

test('in RTL there is nothing to clear - the HUD is physical, the pill is logical', () => {
  const stage = dom.window.document.getElementById('tool-stage')!;
  stage.ownerDocument.documentElement.dir = 'rtl';
  try {
    assert.equal(pillLaneOffset(stage, () => 120), '',
      'they sit on opposite edges of the stage, so an offset would push the pill in for nothing');
  } finally {
    stage.ownerDocument.documentElement.dir = 'ltr';
  }
});

// ── 4b. what a beam may carry off this device ─────────────────────────────────
//
// `currentSession` is the reader the beam presses at send time, and `liveSessionState`
// is the whole of its judgement about what may leave. Both halves are pinned here: what
// travels (the model, by value) and what must not (the user's own file bytes, section 3).

/** An `InputFile` as the runtime holds one - real bytes, plus a blob URL that means
 *  nothing on another origin. */
const pickedFile = (bytes: number): Record<string, unknown> => ({
  __file: true,
  name: 'scan.pdf',
  mime: 'application/pdf',
  size: bytes,
  bytes: new Uint8Array(bytes),
  url: 'blob:https://lolly.tools/9f2c',
});

test('a picked FILE never leaves the device, however the input is shaped', () => {
  const state = liveSessionState([
    { id: 'headline', type: 'text', value: 'Berlin' },
    { id: 'doc', type: 'file', value: pickedFile(64) },
    { id: 'pages', type: 'file', value: [pickedFile(8), pickedFile(8)] },
    // A hook can put anything in any input, so the VALUE shape is checked too - the
    // property is "no bytes leave", not "the manifest was honest".
    { id: 'sneaky', type: 'text', value: pickedFile(8) },
    { id: 'logo', type: 'asset', value: { source: 'user', id: 'user/upload/9-logo.png' } },
  ]);

  assert.deepEqual(Object.keys(state).sort(), ['headline', 'logo'],
    'plan section 3 is explicit: `file` inputs never sync, "local file - not shared". Bytes travel '
    + 'as chunked, checksummed asset ITEMS or not at all');
  // The key is DROPPED, not blanked: an absent input reads as "not set" everywhere,
  // while a null is a value the receiver's tool has to interpret.
  assert.equal('doc' in state, false);
  assert.deepEqual(state.logo, { source: 'user', id: 'user/upload/9-logo.png' },
    'an ASSET ref still travels - that is the whole point of the pack that carries it');
});

test('what survives is JSON, which is what the pack actually sends', () => {
  // The failure this prevents is not abstract. `buildBeamOffer` ends in
  // `JSON.stringify(sessionData)`, and JSON.stringify renders a Uint8Array as
  // `{"0":137,"1":80,…}` - roughly 12 chars per byte, under a 100 MB pick cap and a 1 GB
  // item ceiling that would both wave it through. Before that, the asset-ref walk
  // recurses into `Object.values()` of the byte array, once per byte.
  const json = JSON.stringify(liveSessionState([
    { id: 'doc', type: 'file', value: pickedFile(4096) },
    { id: 'headline', type: 'text', value: 'Berlin' },
  ]));
  assert.equal(json.includes('"0":'), false, 'a Uint8Array leaked into the session JSON');
  assert.ok(json.length < 200, `the session JSON is ${json.length} chars for one short string`);
});

test('the export markers travel, and only they', () => {
  const state = liveSessionState(
    [{ id: 'headline', type: 'text', value: 'Berlin' }],
    {
      // What `renderActions`'s snapshot hands over …
      __toolId: 'poster', __export_format: 'pdf', __export_width: '297',
      __export_height: '420', __export_unit: 'mm', __export_dpi: '300',
      __export_bleed: '3', __export_marks: 'crop', __export_profile: 'FOGRA51',
      // … and what it must not be able to shadow: an input value from outside the
      // model that produced it.
      headline: 'From the DOM, not the model',
    },
  );

  assert.equal(state.headline, 'Berlin', 'the model is the only source of input values');
  assert.equal(state.__toolId, undefined, 'identity is stamped by the caller, not merged in');
  assert.equal(state.__export_format, 'pdf');
  assert.equal(state.__export_unit, 'mm');
  assert.equal(state.__export_dpi, '300',
    'without these a beamed A3/300 DPI setup reopens on the receiver as a default-size PNG '
    + '- views/tool.ts reads them straight back off a resumed session');
  assert.deepEqual(liveSessionState([], null), {}, 'and a tool with no export bar sends none');
});

// ── 5. a failed construction unwinds itself ───────────────────────────────────

test('a throw DURING construction leaves no timer, no listener and no wrapped setInput', async () => {
  const clock = fakeClock();
  const transport = fakeHandle();
  const l = layout();
  const runtime = fakeRuntime();
  const originalSetInput = runtime.setInput;

  // A measurement that blows up midway through the mount - the pill's lane sync is
  // the last thing construction does before subscribing, so by this point the session
  // has already armed its heartbeat + sweep timers, added `visibilitychange` on the
  // document, added the sidebar's focusin/focusout pair and wrapped runtime.setInput.
  // Anything that throws after createCollabSession has the same shape; this one is
  // reachable without stubbing a module.
  const nav = l.stage.querySelector<HTMLElement>('.stage-nav')!;
  const realRect = nav.getBoundingClientRect;
  nav.getBoundingClientRect = (): DOMRect => { throw new Error('measure blew up'); };

  const realWarn = console.warn;
  console.warn = (): void => {};
  try {
    await assert.rejects(
      mountToolCollab({
        handle: transport.handle,
        runtime,
        toolManifest: { id: 'qr-code' },
        host: null,
        stage: l.stage,
        canvas: l.canvas,
        sidebar: l.sidebar,
        colors: [{ hex: '#aa0000', oklch: { l: 0.7, c: 0.12, h: 20 } }] as never,
        now: clock.now,
        setTimer: clock.setTimer,
        clearTimer: clock.clearTimer,
        raf: (fn) => { fn(); },
      }),
      /measure blew up/,
      'the failure still reaches the caller - it is unwound, not swallowed',
    );
  } finally {
    console.warn = realWarn;
    nav.getBoundingClientRect = realRect;
  }

  // The caller (views/tool.ts) never gets a teardown handle out of a rejected mount,
  // so if this function does not unwind, nothing ever will: a 15 s heartbeat and a
  // 3 s sweep would run for the life of the tab, on a view the user has left.
  assert.equal(clock.armed(), 0, 'no presence timer is left armed');
  assert.equal(transport.closes(), 1, 'the transport is closed exactly once');
  assert.equal(transport.subscribed(), false, 'and its presence subscription released');
  assert.equal(runtime.setInput, originalSetInput,
    'runtime.setInput is unwrapped - a permanently wrapped setter would emit ops for a '
    + 'session that no longer exists');
  assert.equal(l.stage.querySelector('.collab-pill'), null, 'no pill left on the stage');
  assert.equal(l.stage.querySelector('.collab-canvas-layer'), null, 'no overlay layer either');
  assert.equal(l.sidebar.innerHTML, l.sidebarBefore, 'and the sidebar is exactly as it was found');
});
