// SPDX-License-Identifier: MPL-2.0
/**
 * Stage-nav keyboard zoom - the "both zooms work and neither captures the other"
 * contract. Design and Sequence Studio share this controller (views/tool.ts
 * mounts setupStageNav for every canvas tool); the timeline panel pins the same
 * chord rule for its own bindings in timeline-panel.test.ts.
 *
 *   · Shift+'+' / Shift+'_' (and the bare = / - / 0 / 1 keys) step the CANVAS
 *     zoom and are preventDefault()ed - they are the studio's.
 *   · Cmd/Ctrl+'=' / Cmd/Ctrl+'-' / Cmd/Ctrl+'0' are the BROWSER's whole-UI zoom
 *     (reset): the handler must neither step the canvas nor preventDefault, or
 *     native page zoom can never fire on a canvas tool. That regression shipped - 
 *     the handler matched bare `key` values with no modifier guard - so this file
 *     is the pin, not a nicety.
 *   · While focus sits in a text field, the zoom keys type instead of zooming.
 *
 * Driven through real window KeyboardEvents against the real controller in jsdom.
 * jsdom reports zero rects, which the zoom math tolerates by design: minScale()
 * floors at 1 and maxScale() at 16 when the canvas has no width, so zoom-in from
 * Fit still lands on scale 1.25 and the transform is observable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'KeyboardEvent', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
// Belt-and-braces: setupStageNav gates its desktop wiring on matchMedia('(pointer:
// coarse)'). jsdom implements matchMedia (matches: false), but a missing impl would
// silently skip the keyboard wiring and turn every assertion below into a false pass.
if (typeof dom.window.matchMedia !== 'function') {
  (dom.window as unknown as { matchMedia: (q: string) => { matches: boolean } }).matchMedia = () => ({ matches: false });
}

const { setupStageNav } = await import('./tool-stage-nav.ts');

/** The canvas zoom the outer wrapper currently shows (1 = Fit, transform cleared). */
function scaleOf(outer: HTMLElement): number {
  const t = outer.style.transform;
  if (!t) return 1;
  const m = t.match(/scale\(([\d.e+-]+)\)/);
  return m ? Number(m[1]) : 1;
}

function mount() {
  const stage = document.createElement('div');
  const outer = document.createElement('div');
  const canvas = document.createElement('div');
  outer.appendChild(canvas);
  stage.appendChild(outer);
  document.body.appendChild(stage);
  const nav = setupStageNav(stage, outer, canvas, 800, null);
  return { stage, outer, nav, teardown() { nav.destroy(); stage.remove(); } };
}

/** Dispatch a keydown on window - the channel setupStageNav listens on. */
function press(key: string, mods: Record<string, boolean> = {}): KeyboardEvent {
  const e = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods });
  dom.window.dispatchEvent(e);
  return e;
}

test("Shift+'+' / Shift+'_' step the canvas zoom (the studio's keys, preventDefault()ed)", () => {
  const h = mount();
  try {
    assert.equal(scaleOf(h.outer), 1, 'precondition: mounted at Fit');
    const zin = press('+', { shiftKey: true });
    assert.equal(zin.defaultPrevented, true, "Shift+'+' is the canvas's - consumed");
    assert.ok(Math.abs(scaleOf(h.outer) - 1.25) < 1e-9, 'one step in = scale 1.25');
    const zout = press('_', { shiftKey: true });
    assert.equal(zout.defaultPrevented, true, "Shift+'_' is the canvas's - consumed");
    assert.ok(Math.abs(scaleOf(h.outer) - 1) < 1e-9, 'one step back out returns to Fit');
  } finally { h.teardown(); }
});

test('the bare keys still work - = / - step, 0 fits (unshifted layouts keep their zoom)', () => {
  const h = mount();
  try {
    assert.equal(press('=').defaultPrevented, true);
    assert.ok(Math.abs(scaleOf(h.outer) - 1.25) < 1e-9, "bare '=' zooms in");
    assert.equal(press('-').defaultPrevented, true);
    assert.ok(Math.abs(scaleOf(h.outer) - 1) < 1e-9, "bare '-' zooms back out");
    press('=');
    assert.equal(press('0').defaultPrevented, true);
    assert.equal(h.outer.style.transform, '', "'0' resets to Fit");
  } finally { h.teardown(); }
});

test('Cmd/Ctrl/Alt chords pass through untouched - browser whole-UI zoom is never captured', () => {
  const h = mount();
  try {
    // Zoom first, so a mistaken fit()/zoom on a chord is visible as a scale change.
    press('+', { shiftKey: true });
    assert.ok(Math.abs(scaleOf(h.outer) - 1.25) < 1e-9, 'precondition: canvas zoomed to 1.25');
    const chords: Array<[string, Record<string, boolean>]> = [
      ['=', { metaKey: true }], ['=', { ctrlKey: true }],
      ['-', { metaKey: true }], ['-', { ctrlKey: true }],
      ['0', { metaKey: true }], ['0', { ctrlKey: true }],
      ['+', { metaKey: true, shiftKey: true }], ['_', { ctrlKey: true, shiftKey: true }],
      ['=', { altKey: true }], ['1', { metaKey: true }],
    ];
    for (const [key, mods] of chords) {
      const e = press(key, mods);
      assert.equal(e.defaultPrevented, false, `${JSON.stringify(mods)}+${key} belongs to the browser`);
      assert.ok(Math.abs(scaleOf(h.outer) - 1.25) < 1e-9, `${JSON.stringify(mods)}+${key} did not move the canvas zoom`);
    }
  } finally { h.teardown(); }
});

test("typing '+' (or 0/1) in a text field types - the canvas does not zoom underneath", () => {
  const h = mount();
  const input = document.createElement('input');
  document.body.appendChild(input);
  try {
    input.focus();
    assert.equal(document.activeElement, input, 'precondition: focus is in the field');
    for (const [key, mods] of [['+', { shiftKey: true }], ['_', { shiftKey: true }], ['0', {}], ['1', {}]] as Array<[string, Record<string, boolean>]>) {
      const e = press(key, mods);
      assert.equal(e.defaultPrevented, false, `${key} must reach the field`);
    }
    assert.equal(scaleOf(h.outer), 1, 'the canvas zoom never moved');
  } finally { input.remove(); h.teardown(); }
});
