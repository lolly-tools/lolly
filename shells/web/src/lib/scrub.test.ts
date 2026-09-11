// SPDX-License-Identifier: MPL-2.0
/*
 * Drag-to-scrub - lib/scrub.ts.
 *
 * Run directly:  node --test shells/web/src/lib/scrub.test.ts
 *
 * Two things matter here. First that generalising this for Colour Lab did not change
 * Pro's behaviour, since Pro's Width/Height cells were the original caller and every
 * new option defaults to what they already had. Second that the float path actually
 * quantises - an unquantised scrub writes 0.13600000000000001 into a field showing
 * 0.1360, and the commit then re-rounds to a different number than the one the user
 * released on.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.Element = dom.window.Element;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
  dom.window.setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((id: number) => dom.window.clearTimeout(id)) as typeof cancelAnimationFrame;
dom.window.Element.prototype.setPointerCapture = function () {};
dom.window.Element.prototype.releasePointerCapture = function () {};

const { attachScrub } = await import('./scrub.ts');

const host = document.getElementById('host')!;

/** A field wired with `opts`, plus a way to drive a drag. */
function field(attrs: Record<string, string>, opts: Record<string, unknown>) {
  host.innerHTML = '';
  const el = document.createElement('input');
  el.type = 'number';
  el.className = 'num';
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  host.appendChild(el);
  const commits: string[] = [];
  const drags: number[] = [];
  const off = attachScrub(host, {
    selector: '.num',
    onCommit: (i) => commits.push(i.value),
    onDrag: (_i, v) => drags.push(v),
    ...opts,
  });
  const ev = (type: string, x: number, init: Record<string, unknown> = {}) => {
    const e = new dom.window.Event(type, { bubbles: true }) as unknown as Record<string, unknown>;
    Object.assign(e, { clientX: x, clientY: 0, button: 0, pointerId: 1, pointerType: 'mouse', ...init });
    (e as unknown as { preventDefault(): void }).preventDefault = () => {};
    el.dispatchEvent(e as unknown as Event);
  };
  const drag = async (from: number, to: number, init: Record<string, unknown> = {}) => {
    ev('pointerdown', from, init);
    ev('pointermove', to, init);
    await new Promise(r => setTimeout(r, 0));   // let the rAF write land
    ev('pointerup', to, init);
  };
  return { el, commits, drags, drag, off };
}

test('Pro’s defaults are unchanged: integers, min 1, mouse only', async () => {
  const f = field({ value: '100' }, {});
  await f.drag(0, 40);
  assert.equal(f.el.value, '140', '1 unit per px, rounded to an integer');
  assert.deepEqual(f.commits, ['140']);
  f.off();

  // min defaults to 1 - a big negative drag stops there, not at 0 or below.
  const g = field({ value: '5' }, {});
  await g.drag(0, -500);
  assert.equal(g.el.value, '1');
  g.off();

  // Touch is ignored unless asked for, so a tap still focuses the field.
  const h = field({ value: '10' }, {});
  await h.drag(0, 60, { pointerType: 'touch' });
  assert.equal(h.el.value, '10', 'a touch drag did nothing');
  assert.deepEqual(h.commits, []);
  h.off();
});

test('a float axis quantises to the field’s own precision', async () => {
  // Colour Lab's chroma: 0.001 per px at 4dp. 34px must land exactly on 0.1700,
  // not on a float that renders as something else.
  const f = field({ value: '0.1360' }, { min: 0, max: 0.48, unitPerPx: 0.001, decimals: 4 });
  await f.drag(0, 34);
  assert.equal(f.el.value, '0.1700');
  assert.equal(f.commits.at(-1), '0.1700');
  // Every live value is quantised too, not just the committed one.
  for (const v of f.drags) {
    assert.equal(Number(v.toFixed(4)), v, `live value is 4dp exact: ${v}`);
  }
  f.off();
});

test('touch is opt-in, and the modifiers coarsen and refine', async () => {
  const f = field({ value: '0.5000' }, { min: 0, max: 1, unitPerPx: 0.0025, decimals: 4, touch: true });
  await f.drag(0, 40, { pointerType: 'touch' });
  assert.equal(f.el.value, '0.6000', 'a touch drag scrubs when asked');
  f.off();

  const shift = field({ value: '0.5000' }, { min: 0, max: 10, unitPerPx: 0.0025, decimals: 4 });
  await shift.drag(0, 40, { shiftKey: true });
  assert.equal(shift.el.value, '1.5000', 'Shift is ×10');
  shift.off();

  const alt = field({ value: '0.5000' }, { min: 0, max: 1, unitPerPx: 0.0025, decimals: 4 });
  await alt.drag(0, 40, { altKey: true });
  assert.equal(alt.el.value, '0.5100', 'Alt is ×0.1');
  alt.off();
});

test('a press that does not travel is a click, and bounds are honoured', async () => {
  const f = field({ value: '0.2000' }, { min: 0, max: 0.4, unitPerPx: 0.001, decimals: 4, onDrag: undefined });
  // Under the 3px threshold: no scrub, no commit - the field stays focusable for typing.
  await f.drag(0, 2);
  assert.equal(f.el.value, '0.2000');
  assert.deepEqual(f.commits, []);
  f.off();

  // The element's own [max] wins over the option's, and clamping applies live.
  const g = field({ value: '0.2000', max: '0.3' }, { min: 0, max: 99, unitPerPx: 0.001, decimals: 4 });
  await g.drag(0, 500);
  assert.equal(g.el.value, '0.3000', 'clamped to the field’s own max');
  g.off();
});
