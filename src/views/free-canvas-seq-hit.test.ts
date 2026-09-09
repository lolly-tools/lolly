// SPDX-License-Identifier: MPL-2.0
/**
 * Playhead-aware canvas selection.
 *
 * A sequence composition stacks its scenes full-canvas; at any playhead time the
 * clock hides every inactive one by stamping sequence-dom's OFF_CLASS on its
 * `.lolly-box`. Hit-testing used to ignore that: a click on the visible scene
 * selected whatever was TOP of the boxes array - usually a scene the user could
 * not see (the bug a screen recording demonstrated: playhead on scene 1, click
 * selects scene 2). Selection must follow what the canvas shows.
 *
 * Runs against the real `initFreeCanvas` on the jsdom harness
 * free-canvas-timeline-add.test.ts established. The canvas DOM is hand-stamped
 * with `.lolly-box[data-box-id]` elements + OFF_CLASS exactly as the tool hooks
 * and the sequence clock leave them - the clock itself never stamps these
 * fixtures (they carry no data-seq attrs), so the class is fully test-owned.
 * Selection is observed through the model: click, press Delete, see which box
 * left the array - a full round trip, no spies.
 *
 * ── THE ONE RULE ────────────────────────────────────────────────────────────
 * The whole of this file exists to pin one sentence, stated verbatim in
 * free-canvas.ts's own header:
 *
 *   "The canvas edits exactly what the canvas shows at the playhead. Moving the
 *    playhead never changes the selection; selecting in the timeline moves the
 *    playhead so the selection stays live; when a selection is nevertheless
 *    off-playhead, the canvas says so and offers to reconcile. The timeline
 *    inspector and the sidebar are the precision fallbacks and are never gated
 *    by time."
 *
 * ACQUISITION (the original five tests) is only a third of it. The other two
 * thirds are covered below, because acquisition alone leaks:
 *
 *  • RETENTION - a selection made while a box was on screen survives the
 *    playhead moving away. The selection chrome is positioned from the MODEL,
 *    not from the DOM, so without suppression a hidden box gets a full outline,
 *    eight resize handles and a contextual bar painted over nothing, and a
 *    resize handle is the one drag entry that never goes through the hit-test.
 *  • KEYBOARD - a nudge or a Delete needs no chrome at all, so the gate is
 *    re-stated in onKey. Asserted the same way as everything else here: press
 *    the key, then look at the model array.
 *
 * The playhead itself is simulated the way the real timeline panel drives it:
 * the OFF_CLASS on the boxes plus a `tl-time` CustomEvent on the stage. That IS
 * the seam - the panel dispatches exactly this, only on an active-set change.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-seq-hit.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';

registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
const W = dom.window as unknown as typeof globalThis & {
  MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent;
};
for (const k of [
  'window', 'document', 'HTMLElement', 'Element', 'KeyboardEvent', 'Event', 'CustomEvent',
  'MouseEvent', 'Node', 'getComputedStyle', 'MutationObserver',
]) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => dom.window.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;
(globalThis as Record<string, unknown>).matchMedia = (q: string) =>
  ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
(globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} disconnect() {} };

const { initFreeCanvas } = await import('./free-canvas.ts');
const { OFF_CLASS } = await import('../bridge/sequence-dom.ts');

// free-canvas deliberately does NOT import sequence-dom (that would drag the lazy
// sequence graph into every editor tool's eager chunk) and carries the class name
// as a literal instead. This pin is what allows the literal: if OFF_CLASS ever
// changes, this fails before any user does.
test('free-canvas seq-off literal matches sequence-dom OFF_CLASS', () => {
  assert.equal(OFF_CLASS, 'seq-off');
});

const NATIVE = 1000;
const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

function pointer(type: string, x: number, y: number): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}

function canvasCfg(): Record<string, unknown> {
  return {
    idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
    fillField: 'bg', textField: 'text', imageField: 'image', fitField: 'fit',
    startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed',
    enterField: 'enter', exitField: 'exit', enterMsField: 'enterMs', exitMsField: 'exitMs',
    muteField: 'mute', laneField: 'lane',
    addKinds: [{ id: 'card', label: 'Card', seed: { kind: 'box', lane: 'seq', dur: 2.5 } }],
  };
}

/**
 * The SAME canvas with the ten time sub-fields removed - i.e. Carousel Maker, Org
 * Chart, Record, and every other editor that is not time-capable. `timeCfg` is null
 * there, so the whole rule is dead code: this is what proves it costs those tools
 * nothing, not even when a stray `seq-off` class is somehow on the page.
 */
function untimedCfg(): Record<string, unknown> {
  const cfg = canvasCfg();
  for (const k of [
    'startField', 'durField', 'clipInField', 'speedField', 'enterField', 'exitField',
    'enterMsField', 'exitMsField', 'muteField', 'laneField',
  ]) delete cfg[k];
  return cfg;
}

// Two full-canvas scenes (scene2 later in the array = on top when both visible)
// and one small untimed overlay badge in the corner, above both.
const SCENES = (): Box[] => ([
  { id: 'scene1', kind: 'box', x: 0, y: 0, w: 1000, h: 1000, start: 0, dur: 2, lane: 'seq' },
  { id: 'scene2', kind: 'box', x: 0, y: 0, w: 1000, h: 1000, start: 2, dur: 2, lane: 'seq' },
  { id: 'badge', kind: 'box', x: 0, y: 0, w: 100, h: 100 },
] as never[]);

interface Fixture {
  stageEl: HTMLElement; canvasEl: HTMLElement;
  boxes(): Box[];
  ids(): string[];
  setOff(...ids: string[]): void;
  /** What the timeline panel dispatches when the ACTIVE SET changes - the real seam. */
  tlTime(playing?: boolean, onion?: Record<string, unknown>): void;
  destroy(): void;
}

function mount(boxes: Box[], cfg: Record<string, unknown> = canvasCfg()): Fixture {
  const doc = dom.window.document;
  const viewEl = doc.createElement('div');
  const stageEl = doc.createElement('div');
  const canvasEl = doc.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  doc.body.appendChild(viewEl);
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);

  // The rendered boxes as the tool hooks paint them (id stamped; the clock/test
  // adds OFF_CLASS). No data-seq attrs, so a mounted clock never touches these.
  for (const b of boxes) {
    const el = doc.createElement('div');
    el.className = 'lolly-box';
    el.setAttribute('data-box-id', String((b as unknown as { id: string }).id));
    canvasEl.appendChild(el);
  }

  const model = new Map<string, unknown>([['boxes', boxes]]);
  const subs: Array<() => void> = [];
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) { model.set(id, value); for (const s of subs) s(); },
    subscribe(fn: () => void) { subs.push(fn); return () => { subs.splice(subs.indexOf(fn), 1); }; },
  };
  const handle = initFreeCanvas({
    viewEl, stageEl, canvasEl,
    runtime: runtime as never,
    host: {} as never,
    input: { id: 'boxes', canvas: cfg as never, fields: [] },
    nativeW: NATIVE, nativeH: NATIVE,
  });
  return {
    stageEl, canvasEl,
    boxes: () => model.get('boxes') as Box[],
    ids: () => (model.get('boxes') as Array<{ id: string }>).map((b) => b.id),
    setOff(...offIds: string[]) {
      for (const el of canvasEl.querySelectorAll('.lolly-box')) {
        el.classList.toggle(OFF_CLASS, offIds.includes(el.getAttribute('data-box-id') as string));
      }
    },
    tlTime(playing = false, onion?: Record<string, unknown>) {
      stageEl.dispatchEvent(new dom.window.CustomEvent('tl-time', {
        bubbles: true, detail: { atMs: 0, activeIds: [], playing, ...(onion || {}) },
      }));
    },
    destroy() { handle.destroy(); viewEl.remove(); doc.body.innerHTML = ''; },
  };
}

/** Let the lazy timeline chunk resolve and any queued frame run. */
const settle = async (): Promise<void> => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };

function clickAt(f: Fixture, x: number, y: number): void {
  f.canvasEl.dispatchEvent(pointer('pointerdown', x, y));
  dom.window.document.dispatchEvent(pointer('pointerup', x, y));
}
function press(key: string): void {
  // The auto-opened timeline panel focuses its ruler; while focus is inside
  // `.tl-panel`, onKey defers to the panel's own key handling (by design). A real
  // canvas click moves focus, jsdom's synthetic pointerdown does not - so park
  // focus on body first, as the browser would after the click.
  (dom.window.document.activeElement as HTMLElement | null)?.blur?.();
  dom.window.document.body.dispatchEvent(
    new W.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}
function pressDelete(): void { press('Delete'); }

test('click selects the VISIBLE scene, not the hidden top-of-array one', async () => {
  const f = mount(SCENES());
  await settle();
  f.setOff('scene2');                      // playhead inside scene1's window
  clickAt(f, 500, 500);
  pressDelete();
  assert.deepEqual(f.ids(), ['scene2', 'badge'], 'the visible scene1 was selected and deleted');
  f.destroy();
});

test('the same click with the playhead on scene2 selects scene2', async () => {
  const f = mount(SCENES());
  await settle();
  f.setOff('scene1');
  clickAt(f, 500, 500);
  pressDelete();
  assert.deepEqual(f.ids(), ['scene1', 'badge']);
  f.destroy();
});

test('an always-on overlay above a hidden scene still wins its own pixels', async () => {
  const f = mount(SCENES());
  await settle();
  f.setOff('scene2');
  clickAt(f, 50, 50);                      // inside the badge, which sits on top
  pressDelete();
  assert.deepEqual(f.ids(), ['scene1', 'scene2']);
  f.destroy();
});

test('with nothing hidden the historical topmost-wins behaviour is unchanged', async () => {
  const f = mount(SCENES());
  await settle();                          // no setOff - no OFF_CLASS anywhere
  clickAt(f, 500, 500);
  pressDelete();
  assert.deepEqual(f.ids(), ['scene1', 'badge'], 'top-of-array scene2 was selected');
  f.destroy();
});

test('a click where ONLY hidden boxes exist selects nothing', async () => {
  const f = mount(SCENES());
  await settle();
  f.setOff('scene1', 'scene2');
  clickAt(f, 500, 500);                    // outside the badge, both scenes hidden
  pressDelete();
  assert.deepEqual(f.ids(), ['scene1', 'scene2', 'badge'], 'nothing was selected, nothing deleted');
  f.destroy();
});

// ── RETENTION: the playhead moving away from a selection ──────────────────────

test('a selection the playhead leaves loses its chrome - no outline, no handles, no bar', async () => {
  const f = mount(SCENES());
  await settle();
  f.setOff('scene1');                        // playhead inside scene2's window
  clickAt(f, 500, 500);                      // …so the click selects the visible scene2
  assert.equal(f.stageEl.querySelectorAll('.fc-outline').length, 1, 'precondition: an outline is up');
  assert.ok(f.stageEl.querySelectorAll('.fc-handle').length >= 8, 'precondition: the resize handles are up');
  assert.equal((f.stageEl.querySelector('.fc-ctxbar') as HTMLElement).hidden, false, 'precondition: the object bar is up');

  f.setOff('scene1', 'scene2');              // the playhead moved off the selection
  f.tlTime();
  assert.equal(f.stageEl.querySelectorAll('.fc-outline').length, 0, 'the outline came down');
  assert.equal(f.stageEl.querySelectorAll('.fc-handle').length, 0,
    'and every resize/rotate handle with it - a handle is the one drag entry that skips the hit-test');
  assert.equal((f.stageEl.querySelector('.fc-ctxbar') as HTMLElement).hidden, true, 'and the object bar');

  // Coming back restores it: this is a suppression, never a deselection.
  f.setOff('scene1');
  f.tlTime();
  assert.equal(f.stageEl.querySelectorAll('.fc-outline').length, 1, 'the same selection is editable again');
  f.destroy();
});

test('the off-playhead banner offers a way back, and it seeks to the box’s OWN start', async () => {
  const f = mount(SCENES());
  await settle();
  const banner = f.stageEl.querySelector('.fc-offplayhead') as HTMLElement;
  assert.ok(banner, 'the reconciliation chip is part of the overlay');
  f.setOff('scene1');
  clickAt(f, 500, 500);                      // scene2, which starts at 2s
  assert.equal(banner.hidden, true, 'a live selection has nothing to reconcile');

  f.setOff('scene1', 'scene2');
  f.tlTime();
  assert.equal(banner.hidden, false, 'the stuck state is the one state that gets an explanation');

  const seeks: number[] = [];
  f.stageEl.addEventListener('fc-seek', (e) => { seeks.push(Number((e as CustomEvent).detail?.atMs)); });
  (banner.querySelector('.fc-offplayhead-go') as HTMLElement)
    .dispatchEvent(new W.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.deepEqual(seeks, [2000], 'scene2’s authored start, in ms - a field read, not arithmetic');
  f.destroy();
});

test('during PLAYBACK the banner stays down - scenes leaving the frame is the point', async () => {
  const f = mount(SCENES());
  await settle();
  f.setOff('scene1');
  clickAt(f, 500, 500);
  f.setOff('scene1', 'scene2');
  f.tlTime(true);                            // the panel says: playing
  const banner = f.stageEl.querySelector('.fc-offplayhead') as HTMLElement;
  assert.equal(banner.hidden, true, 'no chip blinking on every cut');
  // The chrome suppression is NOT relaxed by playback - it is about what can be edited.
  assert.equal(f.stageEl.querySelectorAll('.fc-handle').length, 0);
  f.tlTime(false);
  assert.equal(banner.hidden, false, 'and it returns the moment playback stops');
  f.destroy();
});

// ── KEYBOARD: the third enforcement point ────────────────────────────────────

test('an off-playhead selection refuses every mutating key - the model does not move', async () => {
  const f = mount(SCENES());
  await settle();
  f.setOff('scene1');
  clickAt(f, 500, 500);                      // scene2 selected while visible
  f.setOff('scene1', 'scene2');              // …then the playhead leaves it
  f.tlTime();

  const before = JSON.stringify(f.boxes());
  press('ArrowRight');                       // nudge
  press('ArrowDown');
  press('Delete');
  press('Backspace');
  assert.equal(JSON.stringify(f.boxes()), before,
    'nothing was nudged and nothing was deleted - a full round trip, no spies');

  // And the way out is never blocked: bring the playhead back, and the same key lands.
  f.setOff('scene1');
  f.tlTime();
  pressDelete();
  assert.deepEqual(f.ids(), ['scene1', 'badge'], 'the very same selection deletes once it is on screen');
  f.destroy();
});

test('Escape still deselects an off-playhead selection - the escape route is not gated', async () => {
  const f = mount(SCENES());
  await settle();
  f.setOff('scene1');
  clickAt(f, 500, 500);
  f.setOff('scene1', 'scene2');
  f.tlTime();
  press('Escape');
  const banner = f.stageEl.querySelector('.fc-offplayhead') as HTMLElement;
  assert.equal(banner.hidden, true, 'no selection, nothing stuck, no chip');
  // Nothing was selected any more, so a Delete now removes nothing.
  pressDelete();
  assert.deepEqual(f.ids(), ['scene1', 'scene2', 'badge']);
  f.destroy();
});

// ── the untimed tools pay nothing ─────────────────────────────────────────────

test('with no time model the rule is dead code: chrome, keys and banner are unchanged', async () => {
  const f = mount(SCENES(), untimedCfg());
  await settle();
  f.setOff('scene1', 'scene2');              // a stray class; without timeCfg it means nothing
  clickAt(f, 500, 500);
  assert.equal(f.stageEl.querySelectorAll('.fc-outline').length, 1, 'the chrome is untouched');
  assert.ok(f.stageEl.querySelectorAll('.fc-handle').length >= 8);
  assert.equal((f.stageEl.querySelector('.fc-offplayhead') as HTMLElement).hidden, true, 'and no banner');
  f.tlTime();                                // even the seam is inert without a time model
  assert.equal(f.stageEl.querySelectorAll('.fc-outline').length, 1);
  assert.equal((f.stageEl.querySelector('.fc-offplayhead') as HTMLElement).hidden, true);
  pressDelete();
  assert.deepEqual(f.ids(), ['scene1', 'badge'], 'topmost-wins, byte-identical to before');
  f.destroy();
});

// ── ONION SKIN: ghosts are decoration, never a target ─────────────────────────
//
// The one rule says the canvas edits exactly what the canvas SHOWS at the playhead. A
// ghost is drawn precisely because its scene is NOT shown, so it must be impossible to
// acquire - and the way that is guaranteed is structural, not a new branch in the hit
// test: the ghosts live in a `pointer-events: none` layer inside `.fc-overlay`, which is
// a stage sibling of the canvas. There is no `.lolly-box` for the hit test to find.

test('a painted ghost sits outside the canvas entirely and adds no hit-testable box', async () => {
  const f = mount(SCENES());
  await settle();
  f.setOff('scene2');                                  // playhead inside scene1
  const boxesBefore = f.canvasEl.querySelectorAll('.lolly-box').length;
  f.tlTime(false, { mode: 'outline', past: [], future: ['scene2'], opacity: 1 });
  await settle();                                      // the lazy onion chunk resolves

  const layer = f.stageEl.querySelector('.onion-layer') as HTMLElement;
  assert.ok(layer, 'the ghost layer mounted off the tl-time detail');
  assert.equal(f.canvasEl.contains(layer), false, 'never inside #tool-canvas - exports cannot see it');
  assert.ok(layer.hasAttribute('data-export-hide'));
  assert.equal(f.stageEl.querySelectorAll('.onion-ghost').length, 1, 'one ghost, for the next scene');
  assert.equal(f.canvasEl.querySelectorAll('.lolly-box').length, boxesBefore,
    'the artboard gained no element, so the hit test has nothing new to consider');
  f.destroy();
});

test('clicking where a ghost is drawn still selects the VISIBLE box beneath it', async () => {
  const f = mount(SCENES());
  await settle();
  f.setOff('scene2');
  // scene2 is hidden AND ghosted, dead centre over scene1 - the worst case for the rule.
  f.tlTime(false, { mode: 'filled', past: [], future: ['scene2'], opacity: 1 });
  await settle();
  assert.equal(f.stageEl.querySelectorAll('.onion-ghost').length, 1, 'precondition: a ghost is up');

  clickAt(f, 500, 500);
  pressDelete();
  assert.deepEqual(f.ids(), ['scene2', 'badge'],
    'the click landed on visible scene1, exactly as it does with no ghosts at all');
  f.destroy();
});

test('turning the mode off takes the layer down, and no mode never loads the chunk', async () => {
  const f = mount(SCENES());
  await settle();
  f.setOff('scene2');
  // The default path: every tl-time the panel sends with onion OFF carries mode ''.
  f.tlTime(false, { mode: '', past: [], future: [], opacity: 1 });
  await settle();
  assert.equal(f.stageEl.querySelector('.onion-layer'), null, 'nothing was mounted at all');

  f.tlTime(false, { mode: 'outline', past: [], future: ['scene2'], opacity: 1 });
  await settle();
  assert.ok(f.stageEl.querySelector('.onion-layer'), 'on');

  f.tlTime(false, { mode: '', past: [], future: [], opacity: 1 });
  assert.equal(f.stageEl.querySelector('.onion-layer'), null, 'off again, synchronously');
  f.destroy();
});

test('an untimed tool never mounts the ghost layer, whatever lands on the stage', async () => {
  const f = mount(SCENES(), untimedCfg());
  await settle();
  f.tlTime(false, { mode: 'filled', past: ['scene1'], future: ['scene2'], opacity: 1 });
  await settle();
  assert.equal(f.stageEl.querySelector('.onion-layer'), null,
    'no time model means no playhead means nothing to be either side of');
  f.destroy();
});

test('a CAMERA is never acquired from the canvas - no click, no marquee (plans/104 section 5.4)', () => {
  // A camera paints nothing and is minted with no geometry, so a zero-size marker at
  // the origin would be caught by any marquee crossing it and dragged about as if it
  // were artwork. The exclusion rides the SAME acquisition gate the seq-hidden rule
  // does, which is what keeps it to one expression instead of five call sites.
  // Since the 2026-09-09 split the gate lives in free-canvas/select.ts and its callers are spread over
  // the orchestrator and the feature modules, so read the whole feature.
  const dir = new URL('./free-canvas/', import.meta.url);
  const src = [readFileSync(new URL('./free-canvas.ts', import.meta.url), 'utf8'), ...readdirSync(dir).filter((n) => n.endsWith('.ts')).sort().map((n) => readFileSync(new URL(n, dir), 'utf8'))].join('\n');
  const gate = src.slice(src.indexOf('function seqHiddenSkip'), src.indexOf('function selectionLive'));
  assert.match(gate, /=== 'camera'/, 'the gate excludes a camera by kind');
  assert.ok(gate.includes('seqHiddenId('), 'and still excludes what the playhead is hiding');
  // Every pointer pick goes through it, so the exclusion cannot be half-applied.
  const picks = (src.match(/seqHiddenSkip\(/g) ?? []).length;
  assert.ok(picks >= 5, `every pick passes the gate (found ${picks})`);
});
