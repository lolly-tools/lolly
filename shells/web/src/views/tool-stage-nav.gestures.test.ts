// SPDX-License-Identifier: MPL-2.0
/**
 * Gesture ownership on the stage (lib/stage-gestures.ts): a press that starts inside an
 * element marked `data-stage-gestures="own"` is not tracked for the stage's pan or
 * pinch, and a plain wheel over it is left alone, while Ctrl or Cmd with the wheel still
 * zooms the stage. Everything else on the stage pans and pinches as before.
 *
 * Driven through real pointer and wheel events against the real controller in jsdom
 * (see tool-stage-nav.keys.test.ts for why jsdom's zero rects are fine here).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
if (typeof dom.window.matchMedia !== 'function') {
  (dom.window as unknown as { matchMedia: (q: string) => { matches: boolean } }).matchMedia = () => ({ matches: false });
}

const { setupStageNav } = await import('./tool-stage-nav.ts');

function mount() {
  const stage = document.createElement('div');
  const outer = document.createElement('div');
  const canvas = document.createElement('div');
  const owned = document.createElement('canvas');
  owned.setAttribute('data-stage-gestures', 'own');
  const plain = document.createElement('div');
  canvas.append(owned, plain);
  outer.appendChild(canvas);
  stage.appendChild(outer);
  document.body.appendChild(stage);
  const nav = setupStageNav(stage, outer, canvas, 800, null);
  return { stage, outer, owned, plain, nav, teardown() { nav.destroy(); stage.remove(); } };
}

/** jsdom has no PointerEvent; a MouseEvent carrying the pointer fields is what the handlers read. */
function pointer(target: Element, type: string, id: number, x: number, y: number, pointerType = 'touch', button = 0): void {
  const e = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button });
  Object.assign(e, { pointerId: id, pointerType });
  target.dispatchEvent(e);
}

function pinch(target: Element): void {
  pointer(target, 'pointerdown', 1, 100, 100);
  pointer(target, 'pointerdown', 2, 200, 100);
  pointer(target, 'pointermove', 1, 60, 100);
  pointer(target, 'pointermove', 2, 240, 100);
  pointer(target, 'pointerup', 1, 60, 100);
  pointer(target, 'pointerup', 2, 240, 100);
}

test('a pinch on an element that owns its gestures leaves the stage view alone', () => {
  const h = mount();
  try {
    pinch(h.owned);
    assert.equal(h.outer.style.transform, '', 'no stage zoom');
    assert.equal(h.nav.isZoomed(), false);
  } finally { h.teardown(); }
});

test('a pinch anywhere else on the stage still zooms the view', () => {
  const h = mount();
  try {
    // The fingers stay down so the settle-at-fit on release cannot clear the transform.
    pointer(h.plain, 'pointerdown', 1, 100, 100);
    pointer(h.plain, 'pointerdown', 2, 200, 100);
    pointer(h.plain, 'pointermove', 1, 40, 100);
    pointer(h.plain, 'pointermove', 2, 260, 100);
    assert.match(h.outer.style.transform, /scale\(/, 'the stage zoomed');
  } finally { h.teardown(); }
});

test('a plain wheel over an owning element is left to it; Ctrl or Cmd still zooms the stage', () => {
  const h = mount();
  try {
    // Zoomed first, so a plain wheel anywhere else would pan.
    h.nav.zoomBy(2);
    const before = h.outer.style.transform;
    const plain = new dom.window.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 40 });
    h.owned.dispatchEvent(plain);
    assert.equal(plain.defaultPrevented, false, 'the stage did not claim it');
    assert.equal(h.outer.style.transform, before, 'no pan');
    const elsewhere = new dom.window.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 40 });
    h.plain.dispatchEvent(elsewhere);
    assert.equal(elsewhere.defaultPrevented, true, 'a wheel elsewhere pans the zoomed stage');
    const zoom = new dom.window.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -40, ctrlKey: true });
    h.owned.dispatchEvent(zoom);
    assert.equal(zoom.defaultPrevented, true, 'Ctrl with the wheel is the stage zoom, over any element');
  } finally { h.teardown(); }
});

test('a middle-button drag on an owning element does not pan the stage', () => {
  const h = mount();
  try {
    pointer(h.owned, 'pointerdown', 7, 100, 100, 'mouse', 1);
    pointer(h.owned, 'pointermove', 7, 160, 140, 'mouse', 1);
    assert.equal(h.outer.style.transform, '');
    assert.equal(h.stage.classList.contains('is-grabbing'), false);
  } finally { h.teardown(); }
});
