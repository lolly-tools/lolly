// SPDX-License-Identifier: MPL-2.0
/**
 * The shared column splitter (lib/splitter.ts, plan 275 close-out section 9.1): the
 * separator's role and value, the arrow keys with and without Shift, Home, End, Enter
 * and a double click, the pointer drag with one write per frame and a commit on
 * release, the click that widens (the single-pointer way), the value in words and the
 * panel it controls, the keys stopping at the grip, the clamp, right to left, and the
 * two storage helpers when storage works, holds junk or is blocked.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/splitter.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://lolly.test/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'localStorage']) {
  Object.defineProperty(globalThis, key, { value: Reflect.get(dom.window, key), configurable: true, writable: true });
}

/** A frame queue the test runs by hand, so "one write per frame" can be counted. */
let frames: Array<() => void> = [];
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: (fn: () => void) => frames.push(fn),
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  value: (id: number) => {
    frames[id - 1] = () => {};
  },
  configurable: true,
  writable: true,
});
function runFrame(): void {
  const due = frames;
  frames = [];
  for (const fn of due) fn();
}

const {
  clampWidth, clickStepWidth, growSign, mountSplitter, readStoredWidths, writeStoredWidths, SPLITTER_BIG_STEP, SPLITTER_CLICK_WAIT, SPLITTER_STEP,
} = await import('./splitter.ts');

interface Harness {
  grip: HTMLElement;
  width: () => number;
  sets: Array<{ px: number; done: boolean }>;
  drags: boolean[];
  handle: ReturnType<typeof mountSplitter>;
}

function harness(opts: { panel?: 'start' | 'end'; rtl?: boolean; start?: number; reset?: () => void; cap?: number } = {}): Harness {
  document.documentElement.setAttribute('dir', opts.rtl ? 'rtl' : 'ltr');
  const grip = document.createElement('div');
  document.body.replaceChildren(grip);
  let width = opts.start ?? 272;
  const sets: Array<{ px: number; done: boolean }> = [];
  const drags: boolean[] = [];
  const handle = mountSplitter({
    grip,
    panel: opts.panel ?? 'start',
    label: 'Resize the review list',
    value: () => width,
    limits: () => ({ min: 220, max: 420, initial: 272 }),
    set: (px, done) => {
      sets.push({ px, done });
      // A caller may clamp further, such as a centre column's floor.
      width = opts.cap === undefined ? px : Math.min(px, opts.cap);
      return width;
    },
    reset: opts.reset,
    onDrag: (on) => void drags.push(on),
  });
  return { grip, width: () => width, sets, drags, handle };
}

function key(el: Element, name: string, extra: KeyboardEventInit = {}): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...extra });
  el.dispatchEvent(ev);
  return ev;
}

/** jsdom has no PointerEvent, so a MouseEvent carries the pointer's id. */
function pointer(el: Element, type: string, clientX: number, buttons = 1, pointerId = 1): Event {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, button: 0, buttons });
  Object.defineProperty(ev, 'pointerId', { value: pointerId });
  el.dispatchEvent(ev);
  return ev;
}

test('the grip is a vertical separator with a name, a tab stop and its value', () => {
  const { grip } = harness();
  assert.equal(grip.getAttribute('role'), 'separator');
  assert.equal(grip.getAttribute('aria-orientation'), 'vertical');
  assert.equal(grip.getAttribute('aria-label'), 'Resize the review list');
  assert.equal(grip.tabIndex, 0);
  assert.equal(grip.getAttribute('aria-valuemin'), '220');
  assert.equal(grip.getAttribute('aria-valuemax'), '420');
  assert.equal(grip.getAttribute('aria-valuenow'), '272');
});

test('Left and Right move 16 px, 64 px with Shift, and aria-valuenow follows', () => {
  const h = harness();
  assert.equal(SPLITTER_STEP, 16);
  assert.equal(SPLITTER_BIG_STEP, 64);
  assert.equal(key(h.grip, 'ArrowRight').defaultPrevented, true);
  assert.equal(h.width(), 288);
  key(h.grip, 'ArrowRight', { shiftKey: true });
  assert.equal(h.width(), 352);
  key(h.grip, 'ArrowLeft');
  assert.equal(h.width(), 336);
  assert.equal(h.grip.getAttribute('aria-valuenow'), '336');
  assert.ok(h.sets.every((s) => s.done), 'each key is a finished change');
});

test('Home and End go to the limits, the arrows stop at them, and other keys pass through', () => {
  const h = harness();
  key(h.grip, 'End');
  assert.equal(h.width(), 420);
  key(h.grip, 'ArrowRight', { shiftKey: true });
  assert.equal(h.width(), 420, 'held at the maximum');
  key(h.grip, 'Home');
  assert.equal(h.width(), 220);
  key(h.grip, 'ArrowLeft');
  assert.equal(h.width(), 220, 'held at the minimum');
  assert.equal(key(h.grip, 'ArrowUp').defaultPrevented, false, 'the view keeps Up and Down');
  assert.equal(key(h.grip, 'ArrowRight', { metaKey: true }).defaultPrevented, false, 'a shortcut is not a resize');
});

test('Enter and a double click restore the default, through the caller\'s reset when it has one', () => {
  const h = harness({ start: 400 });
  key(h.grip, 'Enter');
  assert.equal(h.width(), 272);
  key(h.grip, 'End');
  h.grip.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  assert.equal(h.width(), 272);
  let resets = 0;
  const own = harness({
    start: 400,
    reset: () => {
      resets += 1;
    },
  });
  key(own.grip, 'Enter');
  own.grip.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  assert.equal(resets, 2);
  assert.equal(own.sets.length, 0, 'the caller\'s reset replaces the default set');
});

test('the drag writes once per frame while it moves and commits on release', () => {
  const h = harness();
  pointer(h.grip, 'pointerdown', 500);
  assert.equal(h.grip.dataset.dragging, 'true');
  assert.deepEqual(h.drags, [true]);
  pointer(h.grip, 'pointermove', 510);
  pointer(h.grip, 'pointermove', 530);
  pointer(h.grip, 'pointermove', 540);
  assert.equal(h.sets.length, 0, 'nothing is written between frames');
  runFrame();
  assert.deepEqual(h.sets, [{ px: 312, done: false }], 'one write for three moves, at the last position');
  assert.equal(h.grip.getAttribute('aria-valuenow'), '312');
  pointer(h.grip, 'pointermove', 1000);
  runFrame();
  assert.equal(h.width(), 420, 'the drag is held at the maximum');
  pointer(h.grip, 'pointerup', 560, 0);
  assert.deepEqual(h.sets.at(-1), { px: 332, done: true });
  assert.equal(h.grip.dataset.dragging, undefined);
  assert.deepEqual(h.drags, [true, false]);
  assert.equal(h.handle.dragging(), false);
});

test('a lost release ends the drag, and a cancel keeps the last width', () => {
  const lost = harness();
  pointer(lost.grip, 'pointerdown', 500);
  pointer(lost.grip, 'pointermove', 520);
  runFrame();
  pointer(lost.grip, 'pointermove', 600, 0);
  assert.equal(lost.handle.dragging(), false, 'a move with no button held finishes');
  assert.equal(lost.sets.at(-1)?.done, true);
  pointer(lost.grip, 'pointermove', 700);
  runFrame();
  assert.equal(lost.width(), 292, 'a hover after it does not resize');

  const cancelled = harness();
  pointer(cancelled.grip, 'pointerdown', 500);
  pointer(cancelled.grip, 'pointermove', 540);
  runFrame();
  pointer(cancelled.grip, 'pointercancel', 0, 0);
  assert.deepEqual(cancelled.sets.at(-1), { px: 312, done: true });
});

test('a panel after the grip, and a right-to-left page, turn the direction round', () => {
  assert.equal(growSign('start', false), 1);
  assert.equal(growSign('end', false), -1);
  assert.equal(growSign('start', true), -1);
  assert.equal(growSign('end', true), 1);
  const after = harness({ panel: 'end', start: 320 });
  key(after.grip, 'ArrowLeft');
  assert.equal(after.width(), 336, 'Left widens a column on the right');
  pointer(after.grip, 'pointerdown', 800);
  pointer(after.grip, 'pointerup', 760, 0);
  assert.equal(after.width(), 376, 'dragging its edge left widens it');
  const rtl = harness({ rtl: true });
  key(rtl.grip, 'ArrowLeft');
  assert.equal(rtl.width(), 288, 'in a right-to-left page the queue is on the right and Left widens it');
  document.documentElement.setAttribute('dir', 'ltr');
});

test('aria-valuenow reports what the caller applied, not what was asked', () => {
  const h = harness({ cap: 300 });
  key(h.grip, 'End');
  assert.equal(h.sets.at(-1)?.px, 420);
  assert.equal(h.grip.getAttribute('aria-valuenow'), '300');
});

test('clampWidth holds a width inside its limits, and a maximum under the minimum gives the minimum', () => {
  assert.equal(clampWidth(100, 220, 420), 220);
  assert.equal(clampWidth(500, 220, 420), 420);
  assert.equal(clampWidth(300, 220, 420), 300);
  assert.equal(clampWidth(300, 220, 100), 220);
  assert.equal(clampWidth(Number.NaN, 220, 420), 220);
});

test('the storage helpers keep whole positive widths and survive junk and a blocked store', () => {
  localStorage.clear();
  assert.deepEqual(readStoredWidths('lolly-test-columns'), {});
  writeStoredWidths('lolly-test-columns', { queue: 300.4, decide: undefined, bad: -2 });
  assert.equal(localStorage.getItem('lolly-test-columns'), '{"queue":300}');
  assert.deepEqual(readStoredWidths('lolly-test-columns'), { queue: 300 });
  writeStoredWidths('lolly-test-columns', {});
  assert.equal(localStorage.getItem('lolly-test-columns'), null, 'an empty record removes the key');
  localStorage.setItem('lolly-test-columns', '{not json');
  assert.deepEqual(readStoredWidths('lolly-test-columns'), {});
  localStorage.setItem('lolly-test-columns', '[1,2]');
  assert.deepEqual(readStoredWidths('lolly-test-columns'), {});
  localStorage.setItem('lolly-test-columns', '{"queue":"wide","decide":320,"x":null}');
  assert.deepEqual(readStoredWidths('lolly-test-columns'), { decide: 320 });

  const real = globalThis.localStorage;
  const blocked = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('SecurityError'); },
    removeItem() { throw new Error('SecurityError'); },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: blocked, configurable: true, writable: true });
  try {
    assert.deepEqual(readStoredWidths('lolly-test-columns'), {});
    assert.doesNotThrow(() => writeStoredWidths('lolly-test-columns', { queue: 300 }));
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: real, configurable: true, writable: true });
  }
});

test('dispose removes the listeners', () => {
  const h = harness();
  h.handle.dispose();
  key(h.grip, 'ArrowRight');
  assert.equal(h.width(), 272);
});

test('the value in words, the panel it controls and the pointer hint are on the grip', () => {
  const panel = document.createElement('nav');
  const grip = document.createElement('div');
  document.body.replaceChildren(panel, grip);
  let width = 272;
  mountSplitter({
    grip,
    panel: 'start',
    label: 'Resize the review list',
    valueText: (px) => `${px} pixels wide`,
    controls: panel,
    hint: 'Drag, or click to widen.',
    value: () => width,
    limits: () => ({ min: 220, max: 420, initial: 272 }),
    set: (px) => {
      width = px;
      return px;
    },
  });
  assert.equal(grip.getAttribute('aria-valuetext'), '272 pixels wide');
  assert.ok(panel.id, 'the panel is given an id');
  assert.equal(grip.getAttribute('aria-controls'), panel.id);
  assert.equal(grip.title, 'Drag, or click to widen.');
  key(grip, 'ArrowRight');
  assert.equal(grip.getAttribute('aria-valuetext'), '288 pixels wide');
});

test('a click that does not move widens by the big step after the double-click wait, and wraps at the widest', async () => {
  assert.equal(clickStepWidth(272, 220, 420, 64), 336);
  assert.equal(clickStepWidth(400, 220, 420, 64), 420);
  assert.equal(clickStepWidth(420, 220, 420, 64), 220, 'the widest goes back to the narrowest');
  const h = harness();
  pointer(h.grip, 'pointerdown', 500);
  pointer(h.grip, 'pointermove', 502);
  runFrame();
  assert.equal(h.sets.length, 0, 'a move inside the slop is not a drag');
  pointer(h.grip, 'pointerup', 501, 0);
  assert.equal(h.width(), 272, 'nothing yet: a second click could still come');
  await new Promise((r) => setTimeout(r, SPLITTER_CLICK_WAIT + 30));
  assert.equal(h.width(), 336);
  assert.deepEqual(h.sets.at(-1), { px: 336, done: true });
  assert.equal(h.grip.getAttribute('aria-valuenow'), '336');

  // A double click restores the default and takes no step.
  pointer(h.grip, 'pointerdown', 500);
  pointer(h.grip, 'pointerup', 500, 0);
  pointer(h.grip, 'pointerdown', 500);
  pointer(h.grip, 'pointerup', 500, 0);
  h.grip.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, SPLITTER_CLICK_WAIT + 30));
  assert.equal(h.width(), 272);
  h.handle.dispose();
});

test('the grip keeps its keys, and an arrow chord never reaches the view', () => {
  const h = harness();
  const heard: string[] = [];
  const onDoc = (e: KeyboardEvent): void => void heard.push(`${e.altKey ? 'Alt+' : ''}${e.key}`);
  document.addEventListener('keydown', onDoc);
  try {
    key(h.grip, 'ArrowRight');
    key(h.grip, 'Home');
    key(h.grip, 'Enter');
    const alt = key(h.grip, 'ArrowRight', { altKey: true });
    assert.equal(alt.defaultPrevented, false, 'the browser keeps the chord');
    assert.equal(h.width(), 272, 'and it is not a resize');
    key(h.grip, 'z');
    assert.deepEqual(heard, ['z'], 'only a key the grip does not use goes on to the view');
  } finally {
    document.removeEventListener('keydown', onDoc);
  }
});
