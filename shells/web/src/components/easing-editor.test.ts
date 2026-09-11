// SPDX-License-Identifier: MPL-2.0
/**
 * easing-editor tests - the curve editor driven through its real DOM under jsdom.
 *
 * What is pinned here is the CONTRACT the timeline depends on, not the drawing:
 *
 *   • mounting writes NOTHING. Opening the editor on an unauthored field and closing
 *     it again must leave the field unauthored, or the control silently authors an
 *     ease into every box anyone ever glanced at.
 *   • one commit per GESTURE. A held arrow repeats keydown and fires one keyup, so a
 *     sustained nudge is one undo step; a nudge that ends where it started is none.
 *   • every value that enters or leaves goes through lib/transitions.ts. A pasted
 *     preset name or `cubic-bezier(...)` comes back as the canonical wire string, and
 *     junk reverts rather than half-applying.
 *   • x is time and is pinned to [0,1]; y is not, because that is the overshoot family.
 *
 * NOT covered (browser-only): that the curve LOOKS right, pointer dragging (jsdom
 * reports a zero rect for every element, so there is no client→user-space mapping to
 * exercise), the rAF motion preview actually animating, and focus rings.
 *
 * Run directly:  node --test shells/web/src/components/easing-editor.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';

registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'matchMedia']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((h: number) => dom.window.cancelAnimationFrame(h)) as typeof cancelAnimationFrame;

const { mountEasingEditor } = await import('./easing-editor.ts');
const { easingPoints, easingToWire } = await import('../lib/transitions.ts');

interface Rig {
  ed: ReturnType<typeof mountEasingEditor>;
  commits: string[];
  handle(n: 1 | 2): Element;
  read: HTMLInputElement;
  teardown(): void;
}

function rig(value?: unknown): Rig {
  const parent = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(parent);
  const commits: string[] = [];
  const ed = mountEasingEditor(parent as unknown as HTMLElement, {
    value,
    onCommit: (w) => commits.push(w),
  });
  return {
    ed, commits,
    handle: (n) => ed.root.querySelector(`.ease-ed-handle[data-handle="${n}"]`)!,
    read: ed.root.querySelector('.ease-ed-input') as HTMLInputElement,
    teardown() { ed.destroy(); parent.remove(); },
  };
}

/** One keyboard nudge, the way a key press actually arrives: down then up. */
function nudge(el: Element, key: string, opts: { shiftKey?: boolean; repeats?: number } = {}): void {
  for (let i = 0; i < (opts.repeats ?? 1); i++) {
    el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, shiftKey: !!opts.shiftKey, bubbles: true, cancelable: true }));
  }
  el.dispatchEvent(new dom.window.KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
}

function type(el: HTMLInputElement, v: string): void {
  el.value = v;
  el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
}

test('mounting on an UNAUTHORED field commits nothing - opening the editor is not authoring', () => {
  const r = rig(undefined);
  try {
    assert.equal(r.commits.length, 0, 'no write on mount');
    // It still shows a curve to push around: a blank plot has nothing to grab.
    assert.deepEqual(r.ed.points(), [0.33, 1, 0.68, 1]);
    assert.equal(r.read.value, 'cubic-bezier(0.33,1,0.68,1)', 'and the readout says what is on screen');
  } finally { r.teardown(); }
});

test('an authored value seeds the editor - presets and beziers alike', () => {
  const a = rig('ease-in-out');
  try { assert.deepEqual(a.ed.points(), easingPoints('ease-in-out')); } finally { a.teardown(); }
  const b = rig('cubic-bezier(0.1, 0.9, 0.2, 1.4)');
  try {
    assert.deepEqual(b.ed.points(), [0.1, 0.9, 0.2, 1.4]);
    assert.equal(b.commits.length, 0, 'seeding is not an edit');
  } finally { b.teardown(); }
});

test('the readout round-trips a typed curve through easingToWire, and a preset NAME too', () => {
  const r = rig();
  try {
    type(r.read, 'cubic-bezier(0.10, 0.90, 0.20, 1.40)');
    assert.deepEqual(r.commits, ['cubic-bezier(0.1,0.9,0.2,1.4)'], 'canonicalised, exactly once');
    assert.equal(r.read.value, easingToWire('cubic-bezier(0.1,0.9,0.2,1.4)'));

    // A preset name is legal input - easingPoints answers for both spellings, so
    // refusing one here would be a second vocabulary. It resolves to its points.
    type(r.read, 'ease-in');
    assert.equal(r.commits.length, 2);
    assert.deepEqual(r.ed.points(), easingPoints('ease-in'));
    assert.equal(r.commits[1], easingToWire(`cubic-bezier(${easingPoints('ease-in')!.join(',')})`));
  } finally { r.teardown(); }
});

test('junk in the readout reverts and writes nothing', () => {
  const r = rig('ease-out');
  try {
    type(r.read, 'wobble(3)');
    assert.equal(r.commits.length, 0, 'nothing committed');
    assert.deepEqual(r.ed.points(), easingPoints('ease-out'), 'the curve is untouched');
    assert.equal(r.read.value, easingToWire(`cubic-bezier(${easingPoints('ease-out')!.join(',')})`), 'and the box shows the real value again');

    // x is TIME: a bezier whose control point leaves the unit interval is not a
    // function of progress, and easingPoints - not this module - is what says so.
    type(r.read, 'cubic-bezier(1.4,0,0.5,1)');
    assert.equal(r.commits.length, 0, 'an out-of-range x is refused, not clamped behind the user\'s back');
  } finally { r.teardown(); }
});

test('a held arrow key is ONE commit, and a nudge that goes nowhere is none', () => {
  const r = rig('linear');
  try {
    // Ten repeats of keydown (what a held key produces) and a single keyup.
    nudge(r.handle(1), 'ArrowRight', { repeats: 10 });
    assert.equal(r.commits.length, 1, 'one gesture, one undo step');
    assert.equal(r.ed.points()[0], 0.1, '10 nudges of 0.01');

    // Shift is the coarse step.
    nudge(r.handle(1), 'ArrowRight', { shiftKey: true });
    assert.equal(r.ed.points()[0], 0.2);
    assert.equal(r.commits.length, 2);

    // A key that moves nothing must not cost an undo step.
    nudge(r.handle(1), 'Enter');
    assert.equal(r.commits.length, 2, 'a non-nudge key commits nothing');
  } finally { r.teardown(); }
});

test('x is pinned to [0,1]; y is deliberately allowed past the resting value', () => {
  const r = rig('linear');
  try {
    nudge(r.handle(1), 'ArrowLeft', { repeats: 40, shiftKey: true });
    assert.equal(r.ed.points()[0], 0, 'time cannot run backwards past the start');
    nudge(r.handle(2), 'ArrowRight', { repeats: 40, shiftKey: true });
    assert.equal(r.ed.points()[2], 1, 'nor past the end');

    // The overshoot family lives above 1 and the anticipate family below 0.
    nudge(r.handle(2), 'ArrowUp', { repeats: 4, shiftKey: true });
    assert.ok(r.ed.points()[3] > 1, `y went past the resting value (got ${r.ed.points()[3]})`);
    nudge(r.handle(1), 'ArrowDown', { repeats: 3, shiftKey: true });
    assert.ok(r.ed.points()[1] < 0, `and below it (got ${r.ed.points()[1]})`);

    // Every one of those is still a legal authored ease as far as the engine is concerned.
    assert.ok(easingPoints(r.commits.at(-1)), 'the committed string parses back');
  } finally { r.teardown(); }
});

test('an arrow on a handle does not also reach the panel behind it', () => {
  const r = rig();
  try {
    let leaked = 0;
    dom.window.document.body.addEventListener('keydown', () => { leaked++; });
    const e = new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    r.handle(1).dispatchEvent(e);
    assert.equal(leaked, 0, 'the panel binds arrows to nudge the SELECTED CLIP - a curve nudge must not move one');
    assert.equal(e.defaultPrevented, true, 'and it does not scroll the page either');
  } finally { r.teardown(); }
});

test('the plot redraws what it committed - curve, handles and readout stay one value', () => {
  const r = rig();
  try {
    type(r.read, 'cubic-bezier(0,0.5,1,0.5)');
    const h1 = r.handle(1), h2 = r.handle(2);
    // The unit square is 168 wide with 14 of padding, so x=0 is 14 and x=1 is 182.
    assert.equal(h1.getAttribute('cx'), '14');
    assert.equal(h2.getAttribute('cx'), '182');
    assert.equal(h1.getAttribute('cy'), h2.getAttribute('cy'), 'equal y, equal height');
    const d = r.ed.root.querySelector('.ease-ed-curve')!.getAttribute('d')!;
    assert.ok(d.startsWith('M14,') && d.includes('C14,'), `the curve uses the same points (${d})`);
    assert.equal(h1.getAttribute('aria-valuetext'), '0, 0.5', 'and it is spoken, not only drawn');
  } finally { r.teardown(); }
});

test('destroy is idempotent and takes the card with it', () => {
  const r = rig();
  r.ed.destroy();
  assert.equal(r.ed.root.isConnected, false, 'the card is gone');
  // The panel calls destroy on teardown even when the popover already closed itself,
  // so a second call has to be a no-op rather than a throw inside a `finally`.
  r.ed.destroy();
  // And nothing it was still holding can write: a stray release after teardown is
  // exactly the leak the document-level pointerup would otherwise leave behind.
  dom.window.document.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true }));
  assert.equal(r.commits.length, 0);
});
