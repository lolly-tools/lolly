// SPDX-License-Identifier: MPL-2.0
/*
 * oklch-slice.ts - the chart's markup and its drag/click/add contract.
 *
 * Run directly:  node --test shells/web/src/lib/oklch-slice-dom.test.ts
 *
 * The geometry is pinned separately (oklch-slice.test.ts, pure functions). What
 * this file covers is the part that only exists once there is a DOM: that dots
 * land where the geometry says, that a drag moves ONLY the two channels the
 * plane has axes for, and that a press which doesn't travel is a click rather
 * than a zero-distance recolour.
 *
 * jsdom has no canvas 2D context, so `paintSliceChart` is out of scope here - 
 * it bails on `getContext('2d')` returning null, which is also what makes it
 * safe to call in this environment. The fill it would paint is verified against
 * the engine directly in tests/gamut.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="mount"></div></body></html>', {
  url: 'http://localhost/',
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
// The wiring uses pointer capture, which jsdom does not implement.
dom.window.Element.prototype.setPointerCapture = function () {};
dom.window.Element.prototype.releasePointerCapture = function () {};
dom.window.Element.prototype.hasPointerCapture = function () { return false; };

const { renderSliceChart, wireSliceChart, updateSliceDot } = await import('./oklch-slice.ts');
const { SLICE_C_MAX } = await import('./oklch-slice-geom.ts');
const { hexToOklch, oklchToHex } = await import('@lolly/engine');
import type { SliceChartState, SliceDot } from './oklch-slice.ts';

const PLOT = { left: 0, top: 0, width: 400, height: 250 };

/** Mount a chart and give its plot a real box (jsdom lays nothing out). */
function mount(state: SliceChartState, dots: SliceDot[]) {
  const root = document.getElementById('mount')!;
  root.innerHTML = renderSliceChart(state, dots, { editable: true });
  const plot = root.querySelector('[data-okls-plot]') as HTMLElement;
  plot.getBoundingClientRect = () => ({
    ...PLOT, right: PLOT.width, bottom: PLOT.height, x: 0, y: 0, toJSON: () => ({}),
  }) as DOMRect;
  return { root, plot };
}

/** A pointer event at a fraction of the plot box. */
function pointer(
  type: string, fx: number, fy: number, target?: Element,
  opts: { pointerType?: string; dx?: number; dy?: number } = {},
): void {
  const ev = new dom.window.Event(type, { bubbles: true, cancelable: true }) as unknown as
    Record<string, unknown>;
  ev.clientX = fx * PLOT.width + (opts.dx ?? 0);
  ev.clientY = fy * PLOT.height + (opts.dy ?? 0);
  ev.pointerId = 1;
  ev.pointerType = opts.pointerType ?? '';
  (target ?? document.querySelector('[data-okls-plot]')!)
    .dispatchEvent(ev as unknown as Event);
}

/** Give a rendered dot the box its percentage position implies - jsdom lays out
 *  nothing, and the touch slop test is entirely about distance in pixels. */
function boxDot(root: HTMLElement, idx: number, size = 20): HTMLElement {
  const dot = root.querySelector(`[data-okls-idx="${idx}"]`) as HTMLElement;
  const cx = (parseFloat(dot.style.left) / 100) * PLOT.width;
  const cy = (parseFloat(dot.style.top) / 100) * PLOT.height;
  dot.getBoundingClientRect = () => ({
    left: cx - size / 2, top: cy - size / 2, width: size, height: size,
    right: cx + size / 2, bottom: cy + size / 2, x: cx - size / 2, y: cy - size / 2,
    toJSON: () => ({}),
  }) as DOMRect;
  return dot;
}

interface Oklch { l: number; c: number; h: number }

const HANDLERS = (state: SliceChartState, hexes: Record<number, string>) => {
  const calls = {
    recolor: [] as { idx: number; o: Oklch }[],
    commit: 0,
    pick: [] as number[],
    add: [] as Oklch[],
  };
  return {
    calls,
    h: {
      stateOf: () => state,
      hexOf: (idx: number) => hexes[idx] ?? '#888888',
      onRecolor: (idx: number, o: Oklch) => calls.recolor.push({ idx, o }),
      onCommit: () => { calls.commit++; },
      onPick: (idx: number) => calls.pick.push(idx),
      onAdd: (seed: Oklch) => calls.add.push(seed),
    },
  };
};

test('dots render at the position the geometry gives them', () => {
  // #2f7d4f is oklch(0.5289 0.10565 154.407).
  const state: SliceChartState = { plane: 'lc', fixed: 154.407, cMax: SLICE_C_MAX };
  const { root } = mount(state, [{ idx: 0, hex: '#2f7d4f', label: 'Green' }]);
  const dot = root.querySelector('[data-okls-idx="0"]') as HTMLElement;
  assert.ok(dot, 'the dot is rendered');
  // x = c / cMax = 0.10565 / 0.4 = 26.4%; y = 1 - l = 47.1%.
  assert.ok(Math.abs(parseFloat(dot.style.left) - 26.41) < 0.1, `left ${dot.style.left}`);
  assert.ok(Math.abs(parseFloat(dot.style.top) - 47.11) < 0.1, `top ${dot.style.top}`);
  assert.equal(dot.dataset.hex, '#2F7D4F');
  // Sliced at its own hue, so no fade.
  assert.equal(dot.style.getPropertyValue('--off'), '0.000');
});

test('a dot off the current plane is marked as off it, in the DOM and to AT', () => {
  const state: SliceChartState = { plane: 'lc', fixed: 30 };
  const { root } = mount(state, [{ idx: 0, hex: '#2f7d4f', label: 'Green' }]);
  const dot = root.querySelector('[data-okls-idx="0"]') as HTMLElement;
  assert.ok(Number(dot.style.getPropertyValue('--off')) > 0.4, 'green is far from hue 30');
  assert.match(dot.getAttribute('aria-label')!, /off this slice/);
});

test('a drag moves only the plane’s two channels, keeping the swatch’s own hue', () => {
  const state: SliceChartState = { plane: 'lc', fixed: 30, cMax: SLICE_C_MAX };
  const hexes = { 0: '#2f7d4f' }; // a green, on a red-hue plane
  const { root, plot } = mount(state, [{ idx: 0, hex: hexes[0], label: 'Green' }]);
  const { calls, h } = HANDLERS(state, hexes);
  const off = wireSliceChart(root, h);

  const dot = root.querySelector('[data-okls-idx="0"]')!;
  pointer('pointerdown', 0.5, 0.5, dot);
  pointer('pointermove', 0.25, 0.2);   // x = chroma 0.1, y = lightness 0.8
  pointer('pointerup', 0.25, 0.2);

  assert.equal(calls.recolor.length, 1, 'one recolour');
  const o = calls.recolor[0]!.o;
  assert.ok(Math.abs(o.c - 0.1) < 1e-6, `chroma from x: ${o.c}`);
  assert.ok(Math.abs(o.l - 0.8) < 1e-6, `lightness from y: ${o.l}`);
  // The plane is at hue 30, but the swatch is green - its own hue must survive.
  assert.ok(o.h > 120 && o.h < 170, `hue kept from the swatch, not the plane: ${o.h}`);
  assert.equal(calls.commit, 1, 'the drag committed once, on release');
  assert.equal(calls.pick.length, 0, 'a drag is not a click');
  off();
});

test('a press that does not travel is a click, not a zero-distance recolour', () => {
  const state: SliceChartState = { plane: 'lc', fixed: 30 };
  const { root } = mount(state, [{ idx: 3, hex: '#c02020', label: 'Red' }]);
  const { calls, h } = HANDLERS(state, { 3: '#c02020' });
  const off = wireSliceChart(root, h);

  const dot = root.querySelector('[data-okls-idx="3"]')!;
  pointer('pointerdown', 0.5, 0.5, dot);
  pointer('pointermove', 0.503, 0.503); // inside the 4px click threshold
  pointer('pointerup', 0.503, 0.503);

  assert.deepEqual(calls.pick, [3]);
  assert.equal(calls.recolor.length, 0);
  assert.equal(calls.commit, 0);
  off();
});

test('clicking empty space adds a swatch at that colour, on the current plane', () => {
  const state: SliceChartState = { plane: 'ch', fixed: 0.7, cMax: SLICE_C_MAX };
  const { root } = mount(state, []);
  const { calls, h } = HANDLERS(state, {});
  const off = wireSliceChart(root, h);

  pointer('pointerdown', 0.25, 0.5);
  pointer('pointerup', 0.25, 0.5);

  assert.equal(calls.add.length, 1);
  const seed = calls.add[0]!;
  // 'ch': x is hue (0.25 → 90°), y is chroma with the max at the top
  // (0.5 → half of cMax), and the fixed channel is the plane's lightness.
  assert.ok(Math.abs(seed.h - 90) < 1e-6, `hue from x: ${seed.h}`);
  assert.ok(Math.abs(seed.c - SLICE_C_MAX / 2) < 1e-6, `chroma from y: ${seed.c}`);
  assert.ok(Math.abs(seed.l - 0.7) < 1e-6, `lightness from the plane: ${seed.l}`);
  off();
});

test('updateSliceDot moves and recolours a dot without a re-render', () => {
  const state: SliceChartState = { plane: 'lc', fixed: 145, cMax: SLICE_C_MAX };
  const { root } = mount(state, [{ idx: 0, hex: '#2f7d4f', label: 'Green' }]);
  const dot = root.querySelector('[data-okls-idx="0"]') as HTMLElement;
  const before = dot.style.left;

  updateSliceDot(root, 0, '#e8f5ec', state); // much lighter, much less chroma
  assert.notEqual(dot.style.left, before, 'it moved');
  assert.equal(dot.dataset.hex, '#E8F5EC');
  assert.ok(dot.classList.contains('is-light'), 'a pale dot gets the light outline');
  assert.equal(dot.style.getPropertyValue('--dot'), '#e8f5ec');

  // The SAME element, not a replacement - a drag depends on it surviving.
  assert.equal(root.querySelector('[data-okls-idx="0"]'), dot);
});

test('the chart announces the plane and the value it is sliced at', () => {
  const { root } = mount({ plane: 'lc', fixed: 145 }, []);
  const label = root.querySelector('[data-okls-plot]')!.getAttribute('aria-label')!;
  assert.match(label, /Lightness × Chroma/);
  assert.match(label, /hue 145°/);

  const { root: r2 } = mount({ plane: 'ch', fixed: 0.7 }, []);
  assert.match(r2.querySelector('[data-okls-plot]')!.getAttribute('aria-label')!, /lightness 70%/);
});

test('a drag holds the AUTHORED fixed channel, not a gamut-mapped bake of it', () => {
  // The shake this pins: on the chroma × hue plane the held channel is LIGHTNESS,
  // and it used to be recovered from `hexOf` - which in Colour Lab is the subject's
  // sRGB bake. Outside sRGB that bake has a different lightness from the colour
  // being described, so every frame of a drag re-derived the plane from a colour
  // that was not the subject, the dot left the pointer, and the next frame
  // re-derived it from the new bake. It only misbehaved past the gamut boundary.
  const state: SliceChartState = { plane: 'ch', fixed: 0.5, cMax: SLICE_C_MAX };
  const { root } = mount(state, [{ idx: 0, hex: '#ff0000', label: 'Wide red' }]);
  // A wide-gamut red: L 0.72. Its sRGB bake is a DIFFERENT lightness - that gap is
  // the whole bug, so assert the fixture actually has one before relying on it.
  const authored = { l: 0.72, c: 0.31, h: 29 };
  // hexToOklch is nullable (a bad hex ⇒ null); this literal is fine, so pin it once.
  const baked = hexToOklch('#ff0000')!;
  assert.ok(Math.abs(baked.l - authored.l) > 0.01,
    `the fixture's bake really does differ in lightness: ${baked.l} vs ${authored.l}`);

  const { calls, h } = HANDLERS(state, { 0: '#ff0000' });
  const off = wireSliceChart(root, { ...h, oklchOf: () => authored });
  const dot = root.querySelector('[data-okls-idx="0"]')!;
  pointer('pointerdown', 0.5, 0.5, dot);
  pointer('pointermove', 0.3, 0.4);
  pointer('pointerup', 0.3, 0.4);

  assert.equal(calls.recolor.length, 1);
  const o = calls.recolor[0]!.o;
  assert.ok(Math.abs(o.l - authored.l) < 1e-9, `lightness held at the authored value: ${o.l}`);
  assert.notEqual(o.l, baked.l);
  // And the two moving channels still come straight off the pointer.
  assert.ok(Math.abs(o.h - 0.3 * 360) < 1e-6, `hue from x: ${o.h}`);
  assert.ok(Math.abs(o.c - 0.6 * SLICE_C_MAX) < 1e-6, `chroma from y: ${o.c}`);
  off();
});

test('without oklchOf the hex is still the fallback, so hex-native callers are unchanged', () => {
  // The brand editor's swatches genuinely ARE hex, so nothing there needed to change.
  const state: SliceChartState = { plane: 'ch', fixed: 0.5, cMax: SLICE_C_MAX };
  const { root } = mount(state, [{ idx: 0, hex: '#2f7d4f', label: 'Green' }]);
  const { calls, h } = HANDLERS(state, { 0: '#2f7d4f' });
  const off = wireSliceChart(root, h);
  const dot = root.querySelector('[data-okls-idx="0"]')!;
  pointer('pointerdown', 0.5, 0.5, dot);
  pointer('pointermove', 0.3, 0.4);
  pointer('pointerup', 0.3, 0.4);
  assert.equal(calls.recolor.length, 1);
  assert.ok(Math.abs(calls.recolor[0]!.o.l - hexToOklch('#2f7d4f')!.l) < 1e-9,
    'lightness held at the hex’s own lightness');
  off();
});

test('a TOUCH that misses the dot by a thumb’s width still drags it', () => {
  // The 20px dot against a 44px target floor: a press 25px away used to do nothing
  // at all - not a recolour (the drag was over "empty space") and not a click
  // either - while the caption said to drag the chart. The nearest dot within half
  // a target is adopted instead.
  const state: SliceChartState = { plane: 'lc', fixed: 154.407, cMax: SLICE_C_MAX };
  const { root } = mount(state, [{ idx: 0, hex: '#2f7d4f', label: 'Green' }]);
  boxDot(root, 0);
  const { calls, h } = HANDLERS(state, { 0: '#2f7d4f' });
  const off = wireSliceChart(root, h);

  // 18px below the dot's centre, on the plot itself - not on the button.
  const at = { dx: 0, dy: 18, pointerType: 'touch' };
  pointer('pointerdown', 0.2641, 0.4711, undefined, at);
  pointer('pointermove', 0.6, 0.25, undefined, { pointerType: 'touch' });
  pointer('pointerup', 0.6, 0.25, undefined, { pointerType: 'touch' });

  assert.equal(calls.recolor.length, 1, 'the near-miss dragged the dot');
  assert.equal(calls.recolor[0]!.idx, 0);
  assert.equal(calls.commit, 1);
  assert.equal(calls.add.length, 0, 'and was not read as empty space');
  off();
});

test('a MOUSE press at the same distance is still empty space', () => {
  // Precision is the mouse's whole advantage, and in the brand editor a click NEAR a
  // swatch is how a new one is added beside it. Only touch gets the slop.
  const state: SliceChartState = { plane: 'lc', fixed: 154.407, cMax: SLICE_C_MAX };
  const { root } = mount(state, [{ idx: 0, hex: '#2f7d4f', label: 'Green' }]);
  boxDot(root, 0);
  const { calls, h } = HANDLERS(state, { 0: '#2f7d4f' });
  const off = wireSliceChart(root, h);

  const at = { dx: 0, dy: 18, pointerType: 'mouse' };
  pointer('pointerdown', 0.2641, 0.4711, undefined, at);
  pointer('pointerup', 0.2641, 0.4711, undefined, at);

  assert.equal(calls.add.length, 1, 'a mouse click 18px off the dot adds');
  assert.equal(calls.pick.length, 0);
  off();
});

test('a touch further away than the slop is still empty space', () => {
  const state: SliceChartState = { plane: 'lc', fixed: 154.407, cMax: SLICE_C_MAX };
  const { root } = mount(state, [{ idx: 0, hex: '#2f7d4f', label: 'Green' }]);
  boxDot(root, 0);
  const { calls, h } = HANDLERS(state, { 0: '#2f7d4f' });
  const off = wireSliceChart(root, h);

  const at = { dx: 0, dy: 40, pointerType: 'touch' };
  pointer('pointerdown', 0.2641, 0.4711, undefined, at);
  pointer('pointerup', 0.2641, 0.4711, undefined, at);
  assert.equal(calls.add.length, 1);
  assert.equal(calls.pick.length, 0);
  off();
});

test('a cancelled press is never read as a click', () => {
  // The plot is `touch-action: pan-y` now, so a vertical swipe over the chart is a
  // page scroll and the browser takes the pointer away mid-gesture. If that arrived
  // as a release, scrolling past the chart would SET the colour under the thumb.
  const state: SliceChartState = { plane: 'ch', fixed: 0.7, cMax: SLICE_C_MAX };
  const { root } = mount(state, []);
  const { calls, h } = HANDLERS(state, {});
  const off = wireSliceChart(root, h);

  pointer('pointerdown', 0.25, 0.5, undefined, { pointerType: 'touch' });
  pointer('pointercancel', 0.25, 0.5, undefined, { pointerType: 'touch' });
  assert.equal(calls.add.length, 0, 'a scroll is not a pick');
  assert.equal(calls.pick.length, 0);

  // A release still is one, so nothing about tapping changed.
  pointer('pointerdown', 0.25, 0.5, undefined, { pointerType: 'touch' });
  pointer('pointerup', 0.25, 0.5, undefined, { pointerType: 'touch' });
  assert.equal(calls.add.length, 1);
  off();
});

test('a recolour in flight is committed when the gesture is cancelled', () => {
  const state: SliceChartState = { plane: 'lc', fixed: 154.407, cMax: SLICE_C_MAX };
  const { root } = mount(state, [{ idx: 0, hex: '#2f7d4f', label: 'Green' }]);
  const dot = boxDot(root, 0);
  const { calls, h } = HANDLERS(state, { 0: '#2f7d4f' });
  const off = wireSliceChart(root, h);
  pointer('pointerdown', 0.5, 0.5, dot, { pointerType: 'touch' });
  pointer('pointermove', 0.3, 0.3, undefined, { pointerType: 'touch' });
  pointer('pointercancel', 0.3, 0.3, undefined, { pointerType: 'touch' });
  assert.equal(calls.recolor.length, 1);
  assert.equal(calls.commit, 1, 'the frames that already changed the colour are kept');
  off();
});

test('the x axis marks its END labels and which ones a narrow chart drops', () => {
  // CSS cannot count these: the axis NAME is a <span> too, so `nth-of-type` saw it
  // as one of the ticks and could not tell a first from a last.
  const { root } = mount({ plane: 'lc', fixed: 30, cMax: 0.5 }, []);
  const axis = root.querySelector('.okls-axis--x')!;
  const ticks = [...axis.querySelectorAll('.okls-tick')];
  assert.ok(ticks.length >= 6, `chroma ticks: ${ticks.length}`);
  assert.ok(ticks[0]!.classList.contains('okls-tick--first'));
  assert.ok(ticks[ticks.length - 1]!.classList.contains('okls-tick--last'));
  assert.equal(ticks[ticks.length - 1]!.textContent, '0.50');
  // The ceiling is never the label a narrow chart hides.
  assert.ok(!ticks[ticks.length - 1]!.classList.contains('okls-tick--thin'),
    'the chroma ceiling is kept when the axis thins');
  assert.ok(ticks.some(t => t.classList.contains('okls-tick--thin')), 'something thins');
});

// ── The near-miss slop, and the axis lock that keeps it honest ───────────────
// A 20px dot against a 44px thumb meant a routine near-miss did nothing at all, so
// `dotNear` adopts the closest dot within TOUCH_SLOP. That fix, unqualified, was worse
// than the bug: a vertical page-scroll swipe starting within 22px of a dot destroyed
// the colour (measured on a real device profile: a 120px vertical drag 12px from the
// dot drove lightness 61% → 100% with the page frozen). So an ADOPTED dot must wait
// for the first movement to say which gesture this is.

/** Drive a gesture with a given pointer type and per-move offsets. */
function gesture(
  root: HTMLElement, plot: HTMLElement, start: { x: number; y: number },
  moves: Array<{ x: number; y: number }>, pointerType = 'touch', target?: Element,
): void {
  const fire = (type: string, x: number, y: number, t?: Element) => {
    const e = new dom.window.Event(type, { bubbles: true }) as unknown as Record<string, unknown>;
    Object.assign(e, { clientX: x, clientY: y, button: 0, pointerId: 5, pointerType });
    (e as unknown as { preventDefault(): void }).preventDefault = () => {};
    (t ?? plot).dispatchEvent(e as unknown as Event);
  };
  fire('pointerdown', start.x, start.y, target);
  for (const m of moves) fire('pointermove', m.x, m.y);
  const last = moves[moves.length - 1] ?? start;
  fire('pointerup', last.x, last.y);
}

test('a touch NEAR a dot adopts it - but only for a sideways drag', () => {
  const state: SliceChartState = { plane: 'lc', fixed: 30, cMax: SLICE_C_MAX };
  const { root, plot } = mount(state, [{ idx: 0, hex: '#2f7d4f', label: 'Green' }]);
  const { calls, h } = HANDLERS(state, { 0: '#2f7d4f' });
  const off = wireSliceChart(root, h);
  const dot = root.querySelector<HTMLElement>('[data-okls-idx="0"]')!;
  const r = dot.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;

  // Mostly SIDEWAYS from 15px off the dot: the guess was right, take the gesture.
  gesture(root, plot, { x: cx + 15, y: cy }, [{ x: cx + 60, y: cy + 4 }, { x: cx + 90, y: cy + 6 }]);
  assert.ok(calls.recolor.length > 0, 'a sideways near-miss drag recolours');
  assert.equal(calls.commit, 1, 'and commits once');
  off();
});

test('a vertical swipe near a dot scrolls the page instead of destroying the colour', () => {
  // THE REGRESSION. This must never recolour, never commit, and never be read as a
  // click on empty space either - the user was scrolling.
  const state: SliceChartState = { plane: 'lc', fixed: 30, cMax: SLICE_C_MAX };
  const { root, plot } = mount(state, [{ idx: 0, hex: '#2f7d4f', label: 'Green' }]);
  const { calls, h } = HANDLERS(state, { 0: '#2f7d4f' });
  const off = wireSliceChart(root, h);
  const dot = root.querySelector<HTMLElement>('[data-okls-idx="0"]')!;
  const r = dot.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;

  for (const dx of [0, 12, 16, 20]) {
    calls.recolor.length = 0; calls.commit = 0; calls.add.length = 0; calls.pick.length = 0;
    gesture(root, plot, { x: cx + dx, y: cy }, [{ x: cx + dx, y: cy - 40 }, { x: cx + dx, y: cy - 120 }]);
    assert.equal(calls.recolor.length, 0, `offset ${dx}: no recolour on a vertical swipe`);
    assert.equal(calls.commit, 0, `offset ${dx}: nothing committed`);
    assert.equal(calls.add.length, 0, `offset ${dx}: not treated as a tap on empty space`);
  }
  off();
});

test('a DIRECT press on the dot may still be dragged vertically - that is the control', () => {
  // Lightness is the vertical axis on this plane, so exempting a direct hit from the
  // axis lock is not an oversight: dragging the dot straight up is the gesture.
  const state: SliceChartState = { plane: 'lc', fixed: 30, cMax: SLICE_C_MAX };
  const { root, plot } = mount(state, [{ idx: 0, hex: '#2f7d4f', label: 'Green' }]);
  const { calls, h } = HANDLERS(state, { 0: '#2f7d4f' });
  const off = wireSliceChart(root, h);
  const dot = root.querySelector<HTMLElement>('[data-okls-idx="0"]')!;
  const r = dot.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  gesture(root, plot, { x: cx, y: cy }, [{ x: cx, y: cy - 50 }, { x: cx, y: cy - 90 }], 'touch', dot);
  assert.ok(calls.recolor.length > 0, 'a direct vertical drag on the dot still recolours');
  assert.equal(calls.commit, 1);
  off();
});

test('a RETARGETED touch beside the dot is still axis-locked - target is not geometry', () => {
  // THE SECOND HALF OF THE SAME REGRESSION. Chrome's touch adjustment enlarges the hit
  // region by the touch radius and delivers a finger-sized pointerdown to the 20px dot
  // from up to ~24px away, so `e.target === dot` for presses that never touched it. The
  // direct-hit exemption then skipped the axis lock and a pure vertical scroll swipe
  // drove lightness to 100% with the page frozen - measured at 390×844, radiusX 18 /
  // radiusY 22, at every offset from 0 to 24px. Because TOUCH_SLOP is 22 and the
  // retarget reaches 24, there was no offset at which the lock ran at all for a thumb.
  const state: SliceChartState = { plane: 'lc', fixed: 30, cMax: SLICE_C_MAX };
  const { root, plot } = mount(state, [{ idx: 0, hex: '#2f7d4f', label: 'Green' }]);
  const { calls, h } = HANDLERS(state, { 0: '#2f7d4f' });
  const off = wireSliceChart(root, h);
  const dot = boxDot(root, 0, 20);   // a real 20px box, so "inside" means something
  const r = dot.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;

  // The dot is `touch-action: none` for its own 2D drag, and the browser reads that
  // from the RETARGETED node before our first pointermove runs - so handing the
  // gesture back is not enough here, there is no native pan waiting for it. The page
  // stayed dead under the finger until the wiring carried the scroll itself.
  const panned: number[] = [];
  const realScrollBy = dom.window.scrollBy;
  dom.window.scrollBy = ((_x: number, y: number) => { panned.push(y); }) as typeof realScrollBy;

  // Vertical swipe, delivered TO THE DOT, from outside the dot's own box.
  for (const dx of [12, 16, 20, 24]) {
    calls.recolor.length = 0; calls.commit = 0; calls.add.length = 0; calls.pick.length = 0;
    panned.length = 0;
    gesture(root, plot, { x: cx + dx, y: cy },
      [{ x: cx + dx, y: cy - 40 }, { x: cx + dx, y: cy - 120 }], 'touch', dot);
    assert.equal(calls.recolor.length, 0, `retargeted at ${dx}px: no recolour on a scroll`);
    assert.equal(calls.commit, 0, `retargeted at ${dx}px: nothing committed`);
    assert.equal(calls.add.length, 0, `retargeted at ${dx}px: not a tap on empty space`);
    assert.equal(panned.reduce((a, b) => a + b, 0), 120,
      `retargeted at ${dx}px: the page gets the whole 120px of travel, not a dead gesture`);
  }
  // The adoption itself survives: sideways from the same retargeted press still drags,
  // and a drag we DID take never scrolls the page under it.
  panned.length = 0;
  gesture(root, plot, { x: cx + 16, y: cy },
    [{ x: cx + 70, y: cy + 3 }, { x: cx + 100, y: cy + 5 }], 'touch', dot);
  assert.ok(calls.recolor.length > 0, 'a sideways retargeted drag still recolours');
  assert.equal(calls.commit, 1);
  assert.deepEqual(panned, [], 'a recolour never scrolls the page as well');
  dom.window.scrollBy = realScrollBy;
  off();
});

test('a MOUSE near-miss is not adopted, so “click near a swatch to add one” survives', () => {
  // The brand editor relies on it. A mouse is precise; only the imprecise pointer
  // gets slop.
  const state: SliceChartState = { plane: 'lc', fixed: 30, cMax: SLICE_C_MAX };
  const { root, plot } = mount(state, [{ idx: 0, hex: '#2f7d4f', label: 'Green' }]);
  const { calls, h } = HANDLERS(state, { 0: '#2f7d4f' });
  const off = wireSliceChart(root, h);
  const dot = root.querySelector<HTMLElement>('[data-okls-idx="0"]')!;
  const r = dot.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  gesture(root, plot, { x: cx + 15, y: cy }, [{ x: cx + 15, y: cy }], 'mouse');
  assert.equal(calls.add.length, 1, 'a mouse click 15px off the dot still adds');
  assert.equal(calls.pick.length, 0);
  off();
});

// ── The RENDER path's authored chroma ────────────────────────────────────────
// The Colour Lab subject observed at L 0.795 / C 0.176 / H 243, which is outside
// sRGB. Its sRGB bake keeps L and H and drops C to roughly 0.12, so a dot placed
// from that hex lands ON the sRGB contour - while the L×H plane (whose axes both
// survive the clamp) and the 3D panel both say "outside". `oklch` is the fix.
const WIDE = { l: 0.795, c: 0.176, h: 243 };
const WIDE_HEX = oklchToHex(WIDE);
const WIDE_BAKED = hexToOklch(WIDE_HEX)!;

test('the fixture really is outside sRGB - chroma reduced, lightness and hue kept', () => {
  // Guard the guard: if the engine's mapping ever changed shape, the two tests below
  // would pass for the wrong reason (a bake that is simply equal to the authored value).
  assert.ok(WIDE_BAKED.c < WIDE.c - 0.02,
    `the bake really does drop chroma: ${WIDE_BAKED.c} vs ${WIDE.c}`);
  assert.ok(Math.abs(WIDE_BAKED.l - WIDE.l) < 0.02, `lightness survives: ${WIDE_BAKED.l}`);
});

for (const [plane, axis] of [['lc', 'left'], ['ch', 'top']] as const) {
  test(`a dot's ${plane} position comes from the authored chroma, not the sRGB bake`, () => {
    const state: SliceChartState = {
      plane, fixed: plane === 'lc' ? WIDE.h : WIDE.l, cMax: SLICE_C_MAX,
    };
    const { root } = mount(state, [
      { idx: 0, hex: WIDE_HEX, oklch: WIDE, label: 'This colour' },
    ]);
    const dot = root.querySelector<HTMLElement>('[data-okls-idx="0"]')!;
    // 'lc' puts chroma on x; 'ch' puts it on y, maximum at the TOP.
    const want = plane === 'lc' ? WIDE.c / SLICE_C_MAX : 1 - WIDE.c / SLICE_C_MAX;
    const baked = plane === 'lc' ? WIDE_BAKED.c / SLICE_C_MAX : 1 - WIDE_BAKED.c / SLICE_C_MAX;
    const got = parseFloat(dot.style[axis]) / 100;
    assert.ok(Math.abs(got - want) < 1e-4, `${axis} at the authored chroma: ${got} vs ${want}`);
    assert.ok(Math.abs(got - baked) > 0.05, `and NOT at the clamped chroma ${baked}`);
    // The paint is still the only colour a screen can show.
    assert.equal(dot.style.getPropertyValue('--dot'), WIDE_HEX);
    // Sliced AT the subject on every plane, so nothing is faded or announced as off
    // it - which is what the L×H plane used to contradict, its fixed channel being
    // the very chroma the bake reduced.
    assert.equal(dot.style.getPropertyValue('--off'), '0.000');
  });
}

test('the lh plane no longer reports the subject as off its own slice', () => {
  // 'lh' holds CHROMA fixed. With the position derived from the bake, the dot's
  // chroma was ~0.12 against a slice fixed at the authored 0.176, so the report's
  // own colour was faded and announced as "off this slice (different chroma)".
  const state: SliceChartState = { plane: 'lh', fixed: WIDE.c, cMax: SLICE_C_MAX };
  const { root } = mount(state, [{ idx: 0, hex: WIDE_HEX, oklch: WIDE, label: 'This colour' }]);
  const dot = root.querySelector<HTMLElement>('[data-okls-idx="0"]')!;
  assert.equal(dot.style.getPropertyValue('--off'), '0.000');
  assert.doesNotMatch(dot.getAttribute('aria-label')!, /off this slice/);
});

test('updateSliceDot takes the authored colour too, so a drag keeps the fixed position', () => {
  const state: SliceChartState = { plane: 'lc', fixed: WIDE.h, cMax: SLICE_C_MAX };
  const { root } = mount(state, [{ idx: 0, hex: WIDE_HEX, oklch: WIDE, label: 'This colour' }]);
  const dot = root.querySelector<HTMLElement>('[data-okls-idx="0"]')!;
  const rendered = dot.style.left;

  // The live-update path had the same bake-into-position mistake, so repainting a
  // stationary dot used to SNAP it back to the sRGB contour after the render placed
  // it correctly.
  updateSliceDot(root, 0, WIDE_HEX, state, WIDE);
  assert.equal(dot.style.left, rendered, 'the authored position is stable across a repaint');

  updateSliceDot(root, 0, WIDE_HEX, state);
  assert.notEqual(dot.style.left, rendered,
    'and omitting it falls back to the hex - what the brand editor relies on');
  assert.ok(Math.abs(parseFloat(dot.style.left) / 100 - WIDE_BAKED.c / SLICE_C_MAX) < 1e-4);
});

test('a hex-only dot lands exactly where it did before, for the brand editor', () => {
  const state: SliceChartState = { plane: 'lc', fixed: 154.407, cMax: SLICE_C_MAX };
  const { root } = mount(state, [{ idx: 0, hex: '#2f7d4f', label: 'Green' }]);
  const dot = root.querySelector<HTMLElement>('[data-okls-idx="0"]')!;
  // The same numbers the first test in this file pins, restated against the geometry
  // rather than as literals: no `oklch` means no behaviour change at all.
  const o = hexToOklch('#2f7d4f')!;
  assert.ok(Math.abs(parseFloat(dot.style.left) / 100 - o.c / SLICE_C_MAX) < 1e-4);
  assert.ok(Math.abs(parseFloat(dot.style.top) / 100 - (1 - o.l)) < 1e-4);
});
