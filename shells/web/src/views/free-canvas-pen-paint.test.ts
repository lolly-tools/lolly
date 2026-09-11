// SPDX-License-Identifier: MPL-2.0
/**
 * The pen's PAINT contract: a drawn path is born with paint, and the paint the user last
 * chose carries to the next path they draw.
 *
 * Why this is worth its own file: editing a path never loses paint (penEditWrite spreads
 * the existing box and rewrites only the path and the frame), so the whole risk sits in the
 * ONE commit that creates a path - which starts from an empty object and therefore renders
 * as nothing at all if a field is left unseeded. A tool may declare `canvas.pathField`
 * (which is what offers the pen) without declaring a `path` add-kind (which is what carries
 * a brand's idea of what a path looks like); Sequence Studio ships exactly that shape, and
 * before this contract a path drawn there committed invisible.
 *
 * Pure half drives free-canvas-pen.ts directly. Wired half mounts the real overlay against
 * jsdom and an in-memory runtime that echoes setInput back through getModel, so a claim
 * about "what lands in the model" is a real round trip.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import type { Box } from './free-canvas-math.ts';
import { initFreeCanvas } from './free-canvas.ts';
import {
  type PathPaintFields,
  pathPaintIsVisible, pathPaintSeed, pickPathPaint, resolveDrawnInk,
} from './free-canvas-pen.ts';

// ── pure ──────────────────────────────────────────────────────────────────────

/** The field names Design and Sequence Studio both use. */
const F: PathPaintFields = { fill: 'bg', stroke: 'stroke', strokeW: 'strokeW', fillRule: 'fillRule' };

test('pathPaintSeed takes each field from the first source that states it', () => {
  const last = { bg: '#ff0000' };                                  // user last used a red fill
  const seed = { bg: '#30ba78', stroke: '#0e1217', strokeW: 4 };    // the tool's path seed
  const got = pathPaintSeed(F, [last, seed]);
  assert.equal(got.bg, '#ff0000', 'the later-used fill wins over the seed');
  assert.equal(got.stroke, '#0e1217', 'and the seed still supplies what the user never set');
  assert.equal(got.strokeW, 4);
});

test('pathPaintSeed treats empty, null and a zero stroke width as "no opinion"', () => {
  // lolly-start's path seed is stroke-only (bg ''), SUSE's is fill-only (stroke '', strokeW 0).
  // Neither may out-rank a later source that actually has the half it omits - which is the
  // whole reason this resolves per field instead of taking one seed wholesale.
  const suseish = { bg: '#30ba78', stroke: '', strokeW: 0, fillRule: 'nonzero' };
  const startish = { bg: '', stroke: '#0e1217', strokeW: 4, fillRule: 'nonzero' };
  const got = pathPaintSeed(F, [suseish, startish]);
  assert.equal(got.bg, '#30ba78', 'the fill comes from the source that has one');
  assert.equal(got.stroke, '#0e1217', 'and the stroke from the one that has THAT');
  assert.equal(got.strokeW, 4, 'with its own width, not the zero that meant "no stroke"');
});

test('pathPaintSeed keeps stroke colour and width together', () => {
  // A colour with no width paints nothing, and a width with no colour is just as invisible,
  // so whichever source wins the colour supplies the width - falling back when it has none.
  const got = pathPaintSeed(F, [{ stroke: '#123456' }], 7);
  assert.equal(got.stroke, '#123456');
  assert.equal(got.strokeW, 7, 'the fallback width rides along rather than leaving a dead stroke');

  const carried = pathPaintSeed(F, [{ stroke: '#123456', strokeW: 12 }], 7);
  assert.equal(carried.strokeW, 12, 'an explicit width is not overwritten by the fallback');
});

test('pathPaintSeed returns nothing when no source has an opinion', () => {
  assert.deepEqual(pathPaintSeed(F, [null, undefined, {}, { bg: '' }]), {});
});

test('pathPaintSeed ignores fields the canvas config does not map', () => {
  const got = pathPaintSeed({ fill: 'bg' }, [{ bg: '#fff', stroke: '#000', strokeW: 3 }]);
  assert.deepEqual(got, { bg: '#fff' }, 'an unmapped field is never invented onto the box');
});

test('pathPaintIsVisible knows the dead states', () => {
  assert.equal(pathPaintIsVisible(F, { bg: '#30ba78' }), true);
  assert.equal(pathPaintIsVisible(F, { stroke: '#0e1217', strokeW: 4 }), true);
  assert.equal(pathPaintIsVisible(F, {}), false, 'no paint at all');
  assert.equal(pathPaintIsVisible(F, { bg: '', stroke: '', strokeW: 0 }), false, 'the empty seed');
  assert.equal(pathPaintIsVisible(F, { stroke: '#0e1217', strokeW: 0 }), false, 'a colour with no width');
  assert.equal(pathPaintIsVisible(F, { bg: 'none', stroke: 'none' }), false, 'explicit none is not paint');
});

test('resolveDrawnInk turns the preview’s own computed colour into a storable hex', () => {
  // What a browser actually hands back for `hsl(var(--primary))` off .fc-pen-layer.
  assert.equal(resolveDrawnInk('rgb(48, 186, 120)'), '#30ba78');
  assert.equal(resolveDrawnInk('#30BA78'), '#30ba78');
  assert.equal(resolveDrawnInk('oklch(0.7 0.15 160)').startsWith('#'), true,
    'a modern colour resolves too - the walkers see these for real');
  // The preview is translucent chrome; the committed shape is artwork.
  assert.equal(resolveDrawnInk('rgba(48, 186, 120, 0.6)'), '#30ba78', 'alpha is dropped');
  // Unreadable: no stylesheet applied, a detached layer. A shape in the wrong colour still
  // beats a shape in none, and a real browser does not reach this.
  assert.equal(resolveDrawnInk(''), '#000000');
  assert.equal(resolveDrawnInk(null), '#000000');
  assert.equal(resolveDrawnInk('not a colour'), '#000000');
  assert.equal(resolveDrawnInk(null, '#ffffff'), '#ffffff', 'the caller can choose the last resort');
});

test('pickPathPaint keeps only the paint fields, and answers null for a box with none', () => {
  const box = { id: 'a', x: 1, y: 2, bg: '#30ba78', strokeW: 4, text: 'hi' };
  assert.deepEqual(pickPathPaint(F, box), { bg: '#30ba78', strokeW: 4 });
  assert.equal(pickPathPaint(F, { id: 'a', x: 1 }), null);
  assert.equal(pickPathPaint(F, null), null);
});

// ── wired ─────────────────────────────────────────────────────────────────────

const dom = new JSDOM('<!DOCTYPE html><body></body>');
const W = dom.window as unknown as typeof globalThis & { MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent; PointerEvent: typeof MouseEvent };
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
  for (let i = 0; i < n; i++) for (const fn of rafQueue.splice(0, rafQueue.length)) fn();
}
(globalThis as Record<string, unknown>).matchMedia = (q: string) =>
  ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
(globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} disconnect() {} };

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);

/** jsdom has no PointerEvent, so the overlay's pointer listeners are driven with a
 *  MouseEvent carrying the pointer properties - the same shim the sibling pen suite uses. */
function pointerEvent(type: string, o: { x: number; y: number; id?: number }): MouseEvent {
  const e = new W.MouseEvent(type, { bubbles: true, cancelable: true, clientX: o.x, clientY: o.y, button: 0 });
  Object.defineProperty(e, 'pointerId', { value: o.id ?? 1 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  Object.defineProperty(e, 'timeStamp', { value: 0 });
  Object.defineProperty(e, 'buttons', { value: type === 'pointermove' ? 1 : 0 });
  return e;
}

const NATIVE = 1000;

/** The paint fields mapped, so the overlay's own resolution is exercised (the sibling pen
 *  suite deliberately maps only `fillField`, which would skip the stroke rungs entirely). */
function cfgWith(addKinds: unknown[]): Record<string, unknown> {
  return {
    idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
    fillField: 'bg', strokeField: 'stroke', strokeWField: 'strokeW', fillRuleField: 'fillRule',
    opacityField: 'opacity', shapeField: 'shape', radiusField: 'radius',
    textField: 'text', groupField: 'group', clipField: 'clip',
    pathField: 'path',
    addKinds,
  };
}

/** Design: a `path` add-kind carrying the brand's idea of a path. */
const WITH_PATH_KIND = [
  { id: 'box', label: 'Box', seed: { bg: '#30ba78' } },
  { id: 'path', label: 'Path', seed: { kind: 'path', shape: 'rect', bg: '', stroke: '#0e1217', strokeW: 4, fillRule: 'nonzero' } },
];
/** Sequence Studio: the pen is offered (pathField) but nothing says what a path looks like. */
const NO_PATH_KIND = [
  { id: 'card', label: 'Card', seed: { bg: '#14181d' } },
  { id: 'text', label: 'Text', seed: {} },
];

interface Fixture {
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  boxes(): Box[];
  destroy(): void;
}

function mount(addKinds: unknown[], initial: Box[] = []): Fixture {
  const viewEl = dom.window.document.createElement('div');
  const stageEl = dom.window.document.createElement('div');
  const canvasEl = dom.window.document.createElement('div');
  stageEl.appendChild(canvasEl);
  viewEl.appendChild(stageEl);
  dom.window.document.body.appendChild(viewEl);
  canvasEl.style.width = NATIVE + 'px';
  canvasEl.style.height = NATIVE + 'px';
  stageEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);
  canvasEl.getBoundingClientRect = () => rect(0, 0, NATIVE, NATIVE);

  const model = new Map<string, unknown>([['boxes', initial]]);
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
    input: { id: 'boxes', canvas: cfgWith(addKinds) as never, fields: [] },
    nativeW: NATIVE, nativeH: NATIVE,
  });
  frames();
  return {
    stageEl, canvasEl,
    boxes: () => model.get('boxes') as Box[],
    destroy() { handle.destroy(); viewEl.remove(); },
  };
}

const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };
const key = (k: string): void => {
  dom.window.dispatchEvent(new W.KeyboardEvent('keydown', { key: k, bubbles: true }));
};

/** Arm the pen - IDEMPOTENT. Finishing a path leaves the pen armed (Escape unwinds one
 *  rung at a time), so a second unconditional click would toggle it back off and the next
 *  "draw" would just be a selection click. */
function armPen(f: Fixture): void {
  const btn = f.stageEl.querySelector<HTMLButtonElement>('.fc-btn-pen');
  assert.ok(btn, 'the pen rail button exists when the manifest declares pathField');
  if (btn!.getAttribute('aria-pressed') === 'true') return;
  click(btn!);
  frames();
}

/** Place one node at native (x, y). */
function place(f: Fixture, x: number, y: number): void {
  f.canvasEl.dispatchEvent(pointerEvent('pointerdown', { x, y }));
  f.canvasEl.dispatchEvent(pointerEvent('pointerup', { x, y }));
  frames();
}

/** Draw a three-node path and finish it with Enter. */
function drawPath(f: Fixture, at: Array<[number, number]> = [[200, 200], [400, 300], [300, 500]]): Box {
  armPen(f);
  for (const [x, y] of at) place(f, x, y);
  key('Enter');
  frames();
  const paths = f.boxes().filter((b) => b.kind === 'path');
  assert.ok(paths.length > 0, 'a path was committed');
  return paths[paths.length - 1]!;
}

test('a drawn path inherits the tool’s path seed', () => {
  const f = mount(WITH_PATH_KIND);
  const box = drawPath(f);
  assert.equal(box.stroke, '#0e1217', 'the seed’s stroke');
  assert.equal(box.strokeW, 4);
  assert.equal(box.fillRule, 'nonzero');
  f.destroy();
});

test('a drawn path is visible even when the tool declares NO path add-kind', () => {
  // The Sequence Studio shape. Before the paint contract this committed an invisible box:
  // no seed, so no fill and no stroke, and the hook renders an empty fill as fill="none".
  const f = mount(NO_PATH_KIND);
  const box = drawPath(f);
  assert.equal(pathPaintIsVisible(F, box as Record<string, never>), true,
    'the drawn shape can actually be seen');
  assert.notEqual(box.bg, '#14181d',
    'and NOT by borrowing the card kind’s fill, which is near-invisible on that artboard');
  f.destroy();
});

/** Drive a real paint control on the object bar: the stroke panel's width slider. Every
 *  paint write on both bars (fill, stroke colour, and the whole stroke panel) commits
 *  through the same `setField`, so this exercises the seam the memory hangs off - and the
 *  slider is the one control that needs no popover, which keeps the test about the write. */
function setStrokeWidthViaControl(f: Fixture, width: number): void {
  const btn = f.stageEl.querySelector<HTMLElement>('.fc-ctxbar [data-cx="stroke"]');
  assert.ok(btn, 'the bar offers a stroke button for a path selection');
  btn!.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  frames();
  const panel = f.stageEl.querySelector<HTMLElement>('.fc-stroke-panel');
  assert.ok(panel, 'the stroke panel opened');
  const rng = panel!.querySelector<HTMLInputElement>('input[data-sp="width"]')!;
  rng.value = String(width);
  rng.dispatchEvent(new W.window.Event('input', { bubbles: true }));
  frames();
  key('Escape');   // close the panel, or its surface swallows the next draw's clicks
  frames();
}

test('the paint the user last set on a path carries to the NEXT path drawn', () => {
  const f = mount(WITH_PATH_KIND);
  const first = drawPath(f);
  assert.equal(first.bg, '', 'the path seed is stroke-only, and no other add-kind overrules it');
  assert.equal(first.strokeW, 4, 'and the seed supplies its width');

  setStrokeWidthViaControl(f, 18);
  assert.equal(f.boxes().find((b) => b.id === first.id)!.strokeW, 18, 'the control really wrote it');

  const second = drawPath(f, [[600, 200], [800, 300], [700, 500]]);
  assert.notEqual(second.id, first.id, 'a second, distinct path');
  assert.equal(second.strokeW, 18, 'and it is born with the width the user just chose');
  assert.equal(second.stroke, '#0e1217', 'while the seed still supplies what was never changed');
  f.destroy();
});

test('recolouring a NON-path selection does not teach the pen anything', () => {
  // Restyling a text box or an image must not hand the pen a fill that means nothing for a
  // curve, so the memory is gated on the selection being all paths.
  const f = mount(WITH_PATH_KIND, [{ id: 'plain', kind: 'box', shape: 'rect', x: 100, y: 100, w: 300, h: 300, bg: '#111111' } as Box]);
  place(f, 250, 250);            // select the plain box
  // A box reaches the stroke panel too since plan 179 A5 (its stroke is a CSS border),
  // but the pen's memory is gated on the SELECTION being all paths, not on which controls
  // are on screen - so nothing here teaches the pen anything whatever the bar offers.
  const bar = f.stageEl.querySelector<HTMLElement>('.fc-ctxbar');
  assert.ok(bar, 'the plain box is selected and has a bar');
  const drawn = drawPath(f, [[600, 200], [800, 300], [700, 500]]);
  assert.equal(drawn.bg, '', 'the path still starts from its own seed, not the box’s fill');
  assert.equal(drawn.strokeW, 4, 'and its own width');
  f.destroy();
});
