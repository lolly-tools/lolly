// SPDX-License-Identifier: MPL-2.0
/**
 * PLACING something on a touch canvas: the armed-tool hint, and the ink a new text box
 * starts with.
 *
 * Two mobile-audit findings, one code path (the create arm and the box it drops):
 *
 *  1. Choosing Text or Image from the Add menu arms a placement tool. On a mouse the
 *     crosshair cursor carries that state; on a finger there is no cursor, so the menu
 *     closed and nothing whatsoever happened until the canvas was tapped - which first-run
 *     users read as a broken button. The arm now says what it is waiting for, on a coarse
 *     pointer only.
 *  2. A text add-kind seeds ONE authored ink (Design: `fg: '#11141f'`). Placed on a dark
 *     artboard that is near-black on near-black, and at fit zoom on a phone the result is
 *     not "hard to read" - typing produces nothing visible at all. The seed is now flipped
 *     to whichever of black/white reads on the ground under the box, and ONLY when the
 *     seeded ink does not already read there, so every light-artboard default is untouched.
 *
 * Driven through the real `initFreeCanvas` on the jsdom harness free-canvas-pen.test.ts
 * established - the arm goes through the rail's Add menu and the placement through real
 * pointer events, so the claims are about the path a user takes. The hint's
 * pointer-transparency is a stylesheet rule (jsdom applies no CSS), so it is guarded as
 * rule TEXT, exactly as free-canvas-pen-contrast.test.ts does for the pen chrome.
 *
 * NOT covered here, and checked by hand in a browser: the touch zoom-to-legible-type on
 * entering an edit (`zoomForTouchEdit`) needs a laid-out, transformed canvas - jsdom
 * reports no `offsetHeight` and no computed font size, so the guard short-circuits and
 * there is nothing to observe.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-touch-place.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';
import { initFreeCanvas } from './free-canvas.ts';

// ── jsdom bootstrap (same shape as free-canvas-add-picker.test.ts) ─────────────
const dom = new JSDOM('<!DOCTYPE html><body></body>');
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
for (const k of ['window', 'document', 'HTMLElement', 'KeyboardEvent', 'Event', 'MouseEvent', 'Node', 'getComputedStyle', 'MutationObserver']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
const rafQueue: Array<() => void> = [];
(globalThis as Record<string, unknown>).requestAnimationFrame = (fn: FrameRequestCallback): number => {
  rafQueue.push(() => fn(0));
  return rafQueue.length;
};
(globalThis as Record<string, unknown>).cancelAnimationFrame = (): void => {};
function frames(n = 3): void {
  for (let i = 0; i < n; i++) {
    const pending = rafQueue.splice(0, rafQueue.length);
    for (const fn of pending) fn();
  }
}
// The one media query these tests steer. Everything else (reduced motion, …) answers
// false, so turning "touch" on cannot drag an unrelated preference along with it.
let coarse = false;
(globalThis as Record<string, unknown>).matchMedia = (q: string) =>
  ({ matches: q.includes('coarse') ? coarse : false, media: q, addEventListener() {}, removeEventListener() {} });
(globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} disconnect() {} };

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

function pointerEvent(type: string, x: number, y: number): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'timeStamp', { value: 0 });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}

// ── fixture ───────────────────────────────────────────────────────────────────

const NATIVE = 1000;
/** Design's own authored text ink - the value the legibility pass has to argue with. */
const SEED_FG = '#11141f';

/** Design's canvas block, trimmed to the fields the create path reads. `resolveFrame` is
 *  written against the literal x/y/w/h/kind/id names Design uses, so the fixture keeps
 *  them rather than renaming. */
function canvasCfg(): Record<string, unknown> {
  return {
    idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
    fillField: 'bg', opacityField: 'opacity', shapeField: 'shape', radiusField: 'radius',
    textField: 'text', textColorField: 'fg', fontSizeField: 'fontSize', kindField: 'kind',
    imageField: 'image', fitField: 'fit',
    addKinds: [
      { id: 'text', label: 'Text', seed: { kind: 'text', bg: '', shape: 'rect', text: 'Text', fg: SEED_FG, fontSize: 64 } },
      { id: 'image', label: 'Image', seed: { kind: 'image', bg: '', fit: 'contain', text: '' } },
      // Authored like text (the create path folds it into `wasText`) but carrying its OWN
      // dark fill, so its ink question is about the card and not about the artboard.
      { id: 'card', label: 'Card', seed: { kind: 'box', bg: '#14181d', text: '' } },
      { id: 'frame', label: 'Artboard', seed: { kind: 'frame', bg: '#fafbfe', shape: 'rect' } },
    ],
  };
}

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  boxes(): Box[];
  destroy(): void;
}

/** `ground` is painted on the artboard element, because that is what the editor reads:
 *  the `background` input can hold an alias or a gradient, so the legibility pass asks the
 *  DOM what was actually written. `frames` seeds the document with artboard boxes. */
function mount(o: { ground?: string; frames?: boolean } = {}): Fixture {
  const viewEl = dom.window.document.createElement('div');
  const stageEl = dom.window.document.createElement('div');
  const canvasEl = dom.window.document.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  dom.window.document.body.appendChild(viewEl);
  canvasEl.style.width = NATIVE + 'px';
  canvasEl.style.height = NATIVE + 'px';
  if (o.ground) canvasEl.style.backgroundColor = o.ground;
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);

  const initial: Box[] = o.frames
    ? [{ id: 'f1', kind: 'frame', x: 0, y: 0, w: NATIVE, h: NATIVE, bg: '#fafbfe' }]
    : [];
  const model = new Map<string, unknown>([['boxes', initial], ['background', '']]);
  const subs: Array<() => void> = [];
  const runtime = {
    getModel: () => [...model.entries()].map(([id, value]) => ({ id, value })),
    setInput(id: string, value: unknown) { model.set(id, value); for (const s of subs) s(); },
    subscribe(fn: () => void) { subs.push(fn); return () => { subs.splice(subs.indexOf(fn), 1); }; },
  };
  const handle = initFreeCanvas({
    viewEl, stageEl, canvasEl,
    runtime: runtime as never,
    host: { assets: { pick: async () => null } } as never,
    input: { id: 'boxes', canvas: canvasCfg() as never, fields: [] },
    nativeW: NATIVE, nativeH: NATIVE,
    ...(o.frames ? { frame: { frameField: 'frame', frameKind: 'frame' } } : {}),
  });
  frames();
  return {
    stageEl, canvasEl,
    boxes: () => (model.get('boxes') as Box[]) || [],
    destroy() { handle.destroy(); viewEl.remove(); dom.window.document.body.innerHTML = ''; },
  };
}

const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };

/** Arm a placement kind through the rail's Add menu, the way a user does. */
function arm(f: Fixture, label: string): void {
  const add = f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-add');
  assert.ok(add, 'the rail has an Add button');
  click(add!);
  frames();
  const items = [...f.stageEl.querySelectorAll<HTMLButtonElement>('.fc-pop-item, .fc-pop-gitem')];
  const item = items.find(b => (b.textContent ?? '').trim() === label);
  assert.ok(item, `the Add menu offers "${label}" (saw ${items.map(b => (b.textContent ?? '').trim()).join(', ')})`);
  click(item!);
  frames();
}

/** Tap the canvas centre to drop the armed box. */
function place(f: Fixture): void {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', 500, 500));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', 500, 500));
  frames();
}

const hint = (f: Fixture): HTMLElement | null => f.stageEl.querySelector<HTMLElement>('.fc-armhint');
const placedText = (f: Fixture): Box => {
  const b = f.boxes().filter(x => String(x?.['kind']) === 'text');
  assert.equal(b.length, 1, 'exactly one text box was placed');
  return b[0]!;
};

// ── the ink a new text box starts with ─────────────────────────────────────────

test('text placed on a dark artboard flips to white ink instead of keeping the dark seed', () => {
  const f = mount({ ground: '#101010' });
  try {
    arm(f, 'Text');
    place(f);
    assert.equal(placedText(f)['fg'], '#ffffff',
      'near-black on near-black is not faint, it is nothing on screen - the seed has to give way');
  } finally { f.destroy(); }
});

test('text placed on a light artboard keeps the authored seed ink byte-for-byte', () => {
  const f = mount({ ground: '#ffffff' });
  try {
    arm(f, 'Text');
    place(f);
    // The whole point of only rewriting the illegible case: every shipped default artboard
    // is light, so the common path must not move at all.
    assert.equal(placedText(f)['fg'], SEED_FG);
  } finally { f.destroy(); }
});

test('a light artboard already reading dark ink is left alone even when its own ground is pale', () => {
  // #f5f5f5 ground with a dark seed: same side of the flip as #ffffff, so nothing changes.
  const f = mount({ ground: '#f5f5f5' });
  try {
    arm(f, 'Text');
    place(f);
    assert.equal(placedText(f)['fg'], SEED_FG);
  } finally { f.destroy(); }
});

test('the ground is the FRAME the text lands in, not the pasteboard behind it', () => {
  // The regression a backdrop-only reading would ship: a dark pasteboard around a light
  // artboard would flip the ink to white, on a white page.
  const f = mount({ ground: '#101010', frames: true });
  try {
    arm(f, 'Text');
    place(f);
    const box = placedText(f);
    assert.equal(box['frame'], 'f1', 'the box landed inside the artboard');
    assert.equal(box['fg'], SEED_FG, 'a light artboard reads the dark seed, so the seed stands');
  } finally { f.destroy(); }
});

test('a card reads its OWN fill, not the artboard it was dropped on', () => {
  const f = mount({ ground: '#ffffff' });
  try {
    arm(f, 'Card');
    place(f);
    const card = f.boxes().find(b => String(b?.['bg']) === '#14181d');
    assert.ok(card, 'the card was placed');
    assert.equal(card!['fg'], '#ffffff',
      'text on a near-black card is white ink whatever the artboard behind it is doing');
  } finally { f.destroy(); }
});

test('an unreadable ground leaves the seed alone rather than guessing', () => {
  // No painted background anywhere (jsdom paints nothing by default) - the honest answer
  // is "no opinion", not a coin flip.
  const f = mount();
  try {
    arm(f, 'Text');
    place(f);
    assert.equal(placedText(f)['fg'], SEED_FG);
  } finally { f.destroy(); }
});

// ── the armed-tool hint ───────────────────────────────────────────────────────

test('arming Text on a touch pointer says what the canvas is waiting for', () => {
  coarse = true;
  const f = mount({ ground: '#ffffff' });
  try {
    assert.equal(hint(f)?.hidden, true, 'nothing is armed yet');
    arm(f, 'Text');
    const h = hint(f);
    assert.equal(h?.hidden, false, 'the arm is invisible without a cursor, so it has to be spelled out');
    assert.match(h!.textContent ?? '', /place text/i, 'the wording names what is being placed');
  } finally { f.destroy(); coarse = false; }
});

test('a kind that is not text gets the generic wording', () => {
  coarse = true;
  const f = mount({ ground: '#ffffff' });
  try {
    arm(f, 'Image');
    assert.match(hint(f)!.textContent ?? '', /place it/i);
  } finally { f.destroy(); coarse = false; }
});

test('a fine pointer gets the hint too - in its own words', () => {
  // This test used to assert the opposite: the chip was touch-only, because a mouse has
  // a crosshair cursor. A crosshair is not a sentence - plan 179 A18 reported the Add
  // menu's Artboard / Image / Box as "arm a draw mode silently", and a pink `+` was the
  // whole feedback. So the chip is shown on every pointer now; only the WORDS differ,
  // because a mouse drags to size and a finger taps to place.
  const f = mount({ ground: '#ffffff' });
  try {
    arm(f, 'Text');
    assert.equal(hint(f)?.hidden, false, 'the arm says what it is waiting for');
    assert.match(hint(f)!.textContent ?? '', /drag on the canvas/i, 'a mouse is asked to drag');
    assert.match(hint(f)!.textContent ?? '', /escape/i, 'and told the way out');
  } finally { f.destroy(); }
});

test('placing takes the hint down, and so does Escape', () => {
  coarse = true;
  const f = mount({ ground: '#ffffff' });
  try {
    arm(f, 'Text');
    place(f);
    assert.equal(hint(f)?.hidden, true, 'the arm was consumed');
    arm(f, 'Text');
    assert.equal(hint(f)?.hidden, false);
    f.stageEl.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    frames();
    assert.equal(hint(f)?.hidden, true, 'Escape disarms, so the sentence stops being true');
  } finally { f.destroy(); coarse = false; }
});

test('dismissing the hint keeps it dismissed for the rest of the mount', () => {
  coarse = true;
  const f = mount({ ground: '#ffffff' });
  try {
    arm(f, 'Text');
    const x = f.stageEl.querySelector<HTMLButtonElement>('.fc-armhint-x');
    assert.ok(x, 'the chip carries a dismiss button');
    click(x!);
    assert.equal(hint(f)?.hidden, true);
    arm(f, 'Image');
    assert.equal(hint(f)?.hidden, true, 'someone who has read it once does not need it on every add');
  } finally { f.destroy(); coarse = false; }
});

// ── the chip must not eat the tap it is asking for ────────────────────────────

test('the hint chip is pointer-transparent apart from its dismiss button', () => {
  const css = readFileSync(new URL('../styles/parts/editor.css', import.meta.url), 'utf8');
  const chip = /\.fc-armhint\s*\{([^}]*)\}/.exec(css);
  assert.ok(chip, 'editor.css must declare .fc-armhint');
  assert.match(chip![1]!, /pointer-events:\s*none/,
    'the chip asks for a canvas tap - it must not be able to swallow one');
  const x = /\.fc-armhint-x\s*\{([^}]*)\}/.exec(css);
  assert.ok(x, 'editor.css must declare .fc-armhint-x');
  assert.match(x![1]!, /pointer-events:\s*auto/, 'the dismiss button is the one part that is clickable');
  // buttons.css owns the fill/hover/focus of a `.btn`; restating them here is what R2 refuses.
  assert.doesNotMatch(x![1]!, /background:|box-shadow:/, 'the dismiss is a .btn - only its shape is local');
  // Positioned inside the stage overlay, so the stage's own insets already keep it out of
  // the safe area. A fixed chip would have needed env(safe-area-inset-*) of its own.
  assert.match(chip![1]!, /position:\s*absolute/);
});
