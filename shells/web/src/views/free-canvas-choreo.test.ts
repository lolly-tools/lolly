// SPDX-License-Identifier: MPL-2.0
/**
 * "Choreograph" - the SURFACE (plans/104 P4).
 *
 * The two halves this file does NOT re-test: the generator (`choreograph()` in
 * ./choreograph.ts, which owns the arc grammar, the stagger and the Resolution Rule) and
 * its model write (`applyChoreograph`, which owns the promotions and the camera row) -
 * both are evaluated through the real keyframe engine by tests/choreograph.test.ts. What
 * is pinned here is everything BETWEEN them, i.e. everything a user actually touches:
 *
 *   • WHERE the action is offered - the right-click menu (present on any keyframe-capable
 *     tool, disabled under two posable boxes so the menu keeps its height) and the More
 *     panel (drawn only when this selection could be posed);
 *   • the PICKER - six cards in the generator's own order, the length that follows the
 *     chosen card until the user types one, and the count sentence;
 *   • the law that matters most: confirm writes the model exactly ONCE, so a whole motion
 *     arc is a single undo step;
 *   • and that free-canvas's module-scope `CHOREO_SHOWCASES` has not drifted from
 *     `SHOWCASE_IDS` / `SHOWCASE_MS`. That copy is what lets the picker draw itself
 *     without fetching the lazy chunk, so nothing but a test can hold the two equal.
 *
 * The real ./choreograph.ts runs: it is an ordinary dynamic import with no network and no
 * IndexedDB behind it, so the only stub is the .css one every free-canvas suite needs.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-choreo.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';

// free-canvas reaches timeline-panel.ts through a dynamic import (the confirm opens the
// timeline), and that chunk imports its own stylesheet. Node has no idea what a .css
// module is; Vite is what resolves it for real.
registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
const W = dom.window as unknown as typeof globalThis & {
  MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent; Event: typeof Event;
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

const { initFreeCanvas, CHOREO_SHOWCASES, FC_TILT } = await import('./free-canvas.ts');
const { DEFAULT_STAGGER_MS, SHOWCASE_IDS, SHOWCASE_MS } = await import('./choreograph.ts');
const { KF_TILT_CONTROL } = await import('./timeline-panel.ts');
const { parseKf } = await import('../../../../engine/src/keyframes.ts');

const NATIVE = 1000;
const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

/** A keyframable, time-capable canvas block: the ten time fields, plus `kf`, `z` and a
 *  camera add-kind for the showcase's camera track to be seeded from. */
function canvasCfg(): Record<string, unknown> {
  return {
    idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
    fillField: 'bg', opacityField: 'opacity', shapeField: 'shape', radiusField: 'radius',
    textField: 'text', groupField: 'group', clipField: 'clip', imageField: 'image', fitField: 'fit',
    startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed',
    enterField: 'enter', exitField: 'exit', enterMsField: 'enterMs', exitMsField: 'exitMs',
    muteField: 'mute', laneField: 'lane',
    kfField: 'kf', zField: 'z', rxField: 'rx', ryField: 'ry',
    addKinds: [
      { id: 'box', label: 'Box', seed: {} },
      { id: 'camera', label: 'Camera', seed: { kind: 'camera' } },
    ],
  };
}

/** Two plates side by side: the smallest thing a showcase will pose. */
const STACK = (): Box[] => [
  { id: 'a', x: 100, y: 100, w: 300, h: 200, rot: 0, z: 0 },
  { id: 'b', x: 500, y: 100, w: 300, h: 200, rot: 0, z: 23.53 },
] as Box[];

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  boxes(): Box[];
  writes(): number;
  destroy(): void;
}

function mount(seed: Box[], cfg: Record<string, unknown> = canvasCfg(), extra: Record<string, unknown> = {}): Fixture {
  const doc = dom.window.document;
  const viewEl = doc.createElement('div');
  const stageEl = doc.createElement('div');
  const canvasEl = doc.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  doc.body.appendChild(viewEl);
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);

  // The rendered cards as a tool's hooks paint them (free-canvas-seq-hit.test.ts's
  // fixture). They are how the selection is READ back per id: `syncBoxA11y` reflects
  // `selection` onto them as aria-pressed after every sync.
  for (const b of seed) {
    const el = doc.createElement('div');
    el.className = 'lolly-box';
    el.setAttribute('data-box-id', String((b as unknown as { id: string }).id));
    canvasEl.appendChild(el);
  }

  const model = new Map<string, unknown>([['boxes', seed]]);
  const subs: Array<() => void> = [];
  let writes = 0;
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) { writes++; model.set(id, value); for (const s of subs) s(); },
    subscribe(fn: () => void) { subs.push(fn); return () => { subs.splice(subs.indexOf(fn), 1); }; },
  };
  const handle = initFreeCanvas({
    viewEl, stageEl, canvasEl,
    runtime: runtime as never,
    host: {} as never,
    input: { id: 'boxes', canvas: cfg as never, fields: [] },
    nativeW: NATIVE, nativeH: NATIVE,
    ...extra,
  });
  return {
    stageEl, canvasEl,
    boxes: () => model.get('boxes') as Box[],
    writes: () => writes,
    destroy() { handle.destroy(); viewEl.remove(); doc.body.innerHTML = ''; },
  };
}

/** Let the lazy chunk imports and any queued frame run. */
const settle = async (): Promise<void> => { for (let i = 0; i < 24; i++) await new Promise((r) => setTimeout(r, 0)); };

function pointerEvent(type: string, x: number, y: number): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'timeStamp', { value: 0 });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}
const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };
const escapeKey = (): void => {
  dom.window.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
};

/** Click one box - the ordinary way a single selection is made. */
function selectOne(f: Fixture, x: number, y: number): void {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', x, y));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', x, y));
}
/** Marquee the whole canvas, which takes both plates. */
function selectBoth(f: Fixture): void {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', 50, 50));
  f.canvasEl.dispatchEvent(pointerEvent('pointermove', 950, 500));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', 950, 500));
}
function rightClick(f: Fixture, x: number, y: number): void {
  f.canvasEl.dispatchEvent(new W.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
}

/** The context menu's rows, by their label text. */
function menuRows(f: Fixture): Map<string, HTMLButtonElement> {
  const out = new Map<string, HTMLButtonElement>();
  for (const b of f.stageEl.querySelectorAll<HTMLButtonElement>('.fc-context-menu button')) {
    const label = (b.textContent || '').trim();
    if (label && !out.has(label)) out.set(label, b);
  }
  return out;
}
/** The ids the canvas currently holds selected, read off the rendered cards. */
const selectedIds = (f: Fixture): string[] =>
  Array.from(f.canvasEl.querySelectorAll<HTMLElement>('.lolly-box[aria-pressed="true"]'))
    .map((el) => el.getAttribute('data-box-id') || '').sort();

// ══ where the action is offered ═══════════════════════════════════════════════

test('one box is not a showcase: the entry is THERE, and disabled', () => {
  const f = mount(STACK());
  try {
    selectOne(f, 200, 200);
    rightClick(f, 200, 200);
    const row = menuRows(f).get('Choreograph…');
    assert.ok(row, 'the entry is what tells someone the feature exists; a menu that '
      + 'changes height between right-clicks teaches nothing');
    assert.equal(row!.disabled, true, 'but a showcase over one box is just a keyframe');
  } finally { f.destroy(); }
});

test('a tool with nowhere to write keyframes never offers it', () => {
  const cfg = canvasCfg();
  delete cfg.kfField;
  const f = mount(STACK(), cfg);
  try {
    selectBoth(f);
    rightClick(f, 200, 200);
    assert.equal(menuRows(f).has('Choreograph…'), false,
      'progressive capability, not a branch - the tracks would have no field to live in');
  } finally { f.destroy(); }
});

test('the More panel carries it too - and only when this selection can be posed', () => {
  const f = mount(STACK());
  try {
    selectOne(f, 200, 200);
    click(f.stageEl.querySelector<HTMLButtonElement>('[data-cx="more"]')!);
    assert.equal(f.stageEl.querySelector('[data-mp-choreo]'), null,
      'a dead row among live controls reads as broken; the panel is rebuilt per open '
      + 'so it has no constant-height promise to keep');
    escapeKey();

    selectBoth(f);
    click(f.stageEl.querySelector<HTMLButtonElement>('[data-cx="more"]')!);
    assert.ok(f.stageEl.querySelector('[data-mp-choreo]'),
      'a user who never right-clicks would otherwise never meet the feature');
  } finally { f.destroy(); }
});

// ══ the More panel's "Perspective tilt" rows (plans/104 P2.1) ═════════════════

/** Open the More panel over whatever is selected and hand back its rows. */
function openMore(f: Fixture): HTMLElement {
  const btn = f.stageEl.querySelector<HTMLButtonElement>('[data-cx="more"]');
  assert.ok(btn, 'the selection chrome carries a More button');
  click(btn!);
  const p = f.stageEl.querySelector<HTMLElement>('.fc-more-panel');
  assert.ok(p, 'the More panel opened');
  return p!;
}
const tiltRows = (p: HTMLElement): string[] =>
  Array.from(p.querySelectorAll<HTMLInputElement>('input[data-mp="rx"], input[data-mp="ry"]')).map((el) => el.dataset.mp!);

test('the tilt rows are drawn for ONE plain box, and one slider move is exactly one model write', () => {
  const f = mount(STACK());
  try {
    selectOne(f, 200, 200);
    const p = openMore(f);
    assert.deepEqual(tiltRows(p), ['rx', 'ry'], 'pitch and yaw, in that order');
    const rx = p.querySelector<HTMLInputElement>('input[data-mp="rx"]')!;
    assert.equal(rx.min, String(FC_TILT[0]));
    assert.equal(rx.max, String(FC_TILT[1]));

    const before = f.writes();
    rx.value = '30';
    rx.dispatchEvent(new W.Event('input', { bubbles: true }));
    assert.equal(f.writes() - before, 1, 'one input event, one commit - the sibling sliders\' deal');
    assert.equal(f.boxes().find((b) => (b as unknown as { id: string }).id === 'a')!.rx, 30);
    assert.equal(p.querySelector('[data-mp-val="rx"]')!.textContent, '30', 'and the readout follows');
  } finally { f.destroy(); }
});

test('no tilt rows on a camera, on a multi-selection, or on a tool that declares no tilt fields', () => {
  const withCam = [...STACK(), { id: 'cam', kind: 'camera', x: 100, y: 500, w: 200, h: 120, rot: 0 }] as Box[];
  const cam = mount(withCam, canvasCfg(), { deepLink: { select: ['cam'] } });
  try {
    // The camera has its own Tilt X/Y in the timeline's Camera group; two doors onto one
    // channel with different ranges is the failure this hiding exists to avoid.
    assert.deepEqual(tiltRows(openMore(cam)), []);
  } finally { cam.destroy(); }

  const many = mount(STACK());
  try {
    selectBoth(many);
    // The panel READS the first box and WRITES the whole selection, so a mixed selection
    // would stamp one box's angle onto every other.
    assert.deepEqual(tiltRows(openMore(many)), []);
  } finally { many.destroy(); }

  const cfg = canvasCfg();
  delete cfg.rxField; delete cfg.ryField;
  const bare = mount(STACK(), cfg);
  try {
    selectOne(bare, 200, 200);
    assert.deepEqual(tiltRows(openMore(bare)), [], 'progressive capability: no field, no row');
  } finally { bare.destroy(); }
});

test('the More panel\'s tilt range still matches the timeline\'s KF_TILT_CONTROL', () => {
  // free-canvas reaches timeline-panel only through a dynamic import, so FC_TILT is a
  // hand-copied constant - the CHOREO_SHOWCASES deal, and this is what holds it.
  assert.deepEqual([...FC_TILT], [...KF_TILT_CONTROL]);
});

// ══ the picker ════════════════════════════════════════════════════════════════

/** Marquee both plates, right-click one of them, and press Choreograph. */
function openPicker(f: Fixture): HTMLElement {
  selectBoth(f);
  rightClick(f, 200, 200);
  const row = menuRows(f).get('Choreograph…');
  assert.ok(row, 'the entry is present');
  assert.equal(row!.disabled, false, 'two posable boxes are a stack');
  click(row!);
  const p = f.stageEl.querySelector<HTMLElement>('.fc-choreo-panel');
  assert.ok(p, 'the picker opened');
  return p!;
}

test('the picker offers the showcases, checks the first, and states the count', () => {
  const f = mount(STACK());
  try {
    const p = openPicker(f);
    assert.equal(p.getAttribute('role'), 'dialog');
    const cards = Array.from(p.querySelectorAll<HTMLButtonElement>('.fc-choreo-card'));
    assert.deepEqual(cards.map((c) => c.dataset.choreo), [...SHOWCASE_IDS],
      'in the generator\'s own order, so the picker and the plan tell one story');
    assert.deepEqual(cards.map((c) => c.getAttribute('aria-checked')),
      SHOWCASE_IDS.map((_, i) => i === 0 ? 'true' : 'false'), 'Buildup is the default');
    assert.equal(p.querySelector<HTMLInputElement>('[data-choreo-sec]')!.value, '3',
      'prefilled with Buildup\'s own authored length, in seconds');
    // The third number the picker restates rather than imports, and the one the drift test
    // below cannot reach: it lives in the markup, not in CHOREO_SHOWCASES.
    assert.equal(p.querySelector<HTMLInputElement>('[data-choreo-stagger]')!.value, String(DEFAULT_STAGGER_MS),
      'and the generator\'s own default gap, so the picker is not a second opinion');
    const tumble = p.querySelector<HTMLInputElement>('[data-choreo-tumble]')!;
    assert.ok(tumble, 'the Tumble toggle is offered');
    assert.equal(tumble.checked, false, 'and ships OFF - one tilt key changes the export tier');
    // The sentence is the dialog's DESCRIPTION (read after its name when focus arrives),
    // not a live region: it is written once and never re-worded, so a live region here
    // would announce nothing.
    const hint = p.querySelector<HTMLElement>('.fc-num-hint');
    assert.equal(p.getAttribute('aria-describedby'), hint?.id);
    assert.match(hint!.textContent || '', /^2 boxes\./, 'it says what it is about to act on');
    // A roving tabindex: the checked card is the group's one Tab stop.
    assert.deepEqual(cards.map((c) => c.tabIndex), SHOWCASE_IDS.map((_, i) => i === 0 ? 0 : -1));
    assert.equal(f.writes(), 0, 'nothing is written until the user confirms');
  } finally { f.destroy(); }
});

test('the length follows the chosen showcase - until the user types one', () => {
  const f = mount(STACK());
  try {
    const p = openPicker(f);
    const sec = p.querySelector<HTMLInputElement>('[data-choreo-sec]')!;
    const card = (id: string): HTMLButtonElement => p.querySelector<HTMLButtonElement>(`[data-choreo="${id}"]`)!;
    click(card('hero'));
    assert.equal(card('hero').getAttribute('aria-checked'), 'true');
    assert.equal(card('buildup').getAttribute('aria-checked'), 'false', 'a radiogroup holds one');
    assert.equal(sec.value, '6', 'the Hero arc is a six-second piece');

    sec.value = '4';
    sec.dispatchEvent(new W.Event('input', { bubbles: true }));
    click(card('scan'));
    assert.equal(sec.value, '4',
      'once the length is theirs, switching cards must not quietly overwrite it');
    click(card('type-snap'));
    for (const key of ['float', 'tumble']) {
      const input = p.querySelector<HTMLInputElement>(`[data-choreo-${key}]`)!;
      assert.equal(input.disabled, true); assert.equal(input.checked, false);
    }
    click(card('buildup'));
    assert.equal(p.querySelector<HTMLInputElement>('[data-choreo-float]')!.disabled, false);
  } finally { f.destroy(); }
});

// ══ the write ═════════════════════════════════════════════════════════════════

test('confirming writes the model exactly ONCE - the whole arc is one undo step', async () => {
  const f = mount(STACK());
  try {
    const p = openPicker(f);
    const before = f.writes();
    click(p.querySelector<HTMLButtonElement>('[data-choreo-yes]')!);
    await settle();

    assert.equal(f.writes() - before, 1,
      'ONE commit: the tracks, the promotions and the camera come back with one ⌘Z');
    const rows = f.boxes() as Array<Record<string, unknown>>;
    assert.equal(rows.length, 3, 'the two plates, plus the scene camera the showcase needed');

    for (const id of ['a', 'b']) {
      const b = rows.find((r) => r.id === id)!;
      const track = parseKf(b.kf);
      assert.ok(track.length >= 2, `${id} carries a real track, not a single pose`);
      // A fresh board has no sequence at all, so every posed box is promoted to a clip
      // that starts at 0 and runs the arc - otherwise the keyframes have no clock.
      assert.equal(b.start, 0, `${id} starts the arc`);
      assert.equal(b.dur, 3, `${id} runs Buildup's own three seconds`);
    }

    const cam = rows.find((r) => r.kind === 'camera');
    assert.ok(cam, 'the camera move was asked for, so a scene camera was minted for it');
    assert.ok(parseKf(cam!.kf).length >= 2, 'and keyed, in absolute sequence time');

    assert.equal(f.stageEl.querySelector('.fc-choreo-panel'), null, 'the picker is done');
    assert.deepEqual(selectedIds(f), ['a', 'b'],
      'the posed boxes stay selected, so the next gesture is about what just moved');
  } finally { f.destroy(); }
});

test('cancelling, and Escape, change nothing at all', async () => {
  const f = mount(STACK());
  try {
    const p = openPicker(f);
    click(p.querySelector<HTMLButtonElement>('[data-choreo-no]')!);
    await settle();
    assert.equal(f.writes(), 0);
    assert.equal(f.stageEl.querySelector('.fc-choreo-panel'), null, 'the picker is gone');

    const q = openPicker(f);
    assert.ok(q, 'and it reopens');
    escapeKey();
    await settle();
    assert.equal(f.writes(), 0, 'a dismissal means no');
    assert.equal(f.stageEl.querySelector('.fc-choreo-panel'), null);
  } finally { f.destroy(); }
});

// ══ the copy that cannot drift ════════════════════════════════════════════════

test('the picker\'s showcase table still matches the generator\'s', () => {
  assert.deepEqual(CHOREO_SHOWCASES.map((s) => s.id), [...SHOWCASE_IDS],
    'same ids, same order - the picker draws the plan the generator will write');
  assert.deepEqual(
    CHOREO_SHOWCASES.map((s) => s.ms),
    SHOWCASE_IDS.map((id) => SHOWCASE_MS[id]),
    'and the same authored lengths, so the prefilled seconds are not a second opinion',
  );
  for (const s of CHOREO_SHOWCASES) {
    assert.ok(s.label && s.sub, `${s.id} has a name and a line of copy`);
  }
});

// ── the deep links (docs/url-mode.md "On a tool route": _sel / _t / _panel) ──────────

test('a link can land on the picker: _sel selects the boxes and _panel=choreograph opens it over them', async () => {
  const f = mount(STACK(), canvasCfg(), { deepLink: { select: ['a', 'b', 'nope'], panel: 'choreograph' } });
  try {
    const p = f.stageEl.querySelector<HTMLElement>('.fc-choreo-panel');
    assert.ok(p, 'the picker is open at mount, with no click');
    assert.match(p!.querySelector('.fc-num-hint')!.textContent || '', /^2 boxes\./, 'over the two known ids - the unknown one is ignored');
    assert.equal(f.writes(), 0, 'landing on a picture writes nothing');
  } finally { f.destroy(); }
});

test('_panel without a selection opens nothing, and _sel alone only selects', () => {
  const none = mount(STACK(), canvasCfg(), { deepLink: { panel: 'choreograph' } });
  try {
    assert.equal(none.stageEl.querySelector('.fc-choreo-panel'), null, 'no selection, no picker');
  } finally { none.destroy(); }
  const sel = mount(STACK(), canvasCfg(), { deepLink: { select: ['b'] } });
  try {
    assert.equal(sel.stageEl.querySelector('.fc-choreo-panel'), null);
    const pressed = Array.from(sel.canvasEl.querySelectorAll<HTMLElement>('.lolly-box[aria-pressed="true"]')).map((el) => el.dataset.boxId);
    assert.deepEqual(pressed, ['b'], 'the selection is reflected onto the cards');
    assert.equal(sel.writes(), 0);
  } finally { sel.destroy(); }
});

test('_t opens the timeline and parks the playhead there', async () => {
  const f = mount(STACK(), canvasCfg(), { deepLink: { playhead: 1.2 } });
  try {
    await settle();
    await settle();
    const ruler = f.stageEl.querySelector('.tl-ruler') ?? document.querySelector('.tl-ruler');
    assert.ok(ruler, 'the lazy timeline chunk was fetched and mounted by the link alone');
    const readout = Array.from(document.querySelectorAll<HTMLElement>('[class*="tl-"]')).map((e) => e.textContent || '').find((s) => /^\d:\d\d\.\d \/ \d:\d\d\.\d$/.test(s.trim()));
    assert.ok(readout && readout.trim().startsWith('0:01.2'), `the transport reads the parked time, got ${JSON.stringify(readout)}`);
    assert.equal(f.writes(), 0, 'parking the playhead is not an edit');
  } finally { f.destroy(); }
});

for (const recipe of ['editorial-reveal', 'type-snap', 'feature-cascade', 'assemble-loop']) {
  test(`quick ${recipe} applies editable tracks in one undo step`, async () => {
    const f = mount(STACK());
    try {
      const p = openPicker(f);
      click(p.querySelector(`[data-choreo-quick="${recipe}"]`)!);
      await settle();
      assert.equal(f.writes(), 1);
      assert.equal(f.boxes().length, 2, 'quick recipes keep the authored camera');
      for (const box of f.boxes()) assert.ok(parseKf(box.kf).length >= 4);
      assert.equal(f.stageEl.querySelector('.fc-choreo-panel'), null);
    } finally { f.destroy(); }
  });
}
