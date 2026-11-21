// SPDX-License-Identifier: MPL-2.0
/**
 * components/body-popover.ts - `defaultPosition`'s viewport fit, exercised through
 * the real mountBodyPopover (the panel has to be appended before it is measurable,
 * which is the whole point of the check).
 *
 * jsdom lays nothing out, so offsetWidth/offsetHeight are stubbed on the prototype
 * to stand in for a measured panel; the anchor is a plain PopoverAnchor with a
 * scripted rect, which is all the default path reads.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { mountBodyPopover, type PopoverAnchor, type BodyPopoverOptions } from './body-popover.ts';

const VW = 390, VH = 844; // iPhone-class portrait viewport

interface Harness { panel(): HTMLElement; open(): void; close(): void }

function harness(anchorRect: { top: number; bottom: number; right: number }, panel: { w: number; h: number }, options: Partial<BodyPopoverOptions> = {}): Harness {
  const d = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const w = d.window;
  Object.defineProperty(w, 'innerWidth', { value: VW, configurable: true });
  Object.defineProperty(w, 'innerHeight', { value: VH, configurable: true });
  Object.defineProperty(w.HTMLElement.prototype, 'offsetWidth', { get: () => panel.w, configurable: true });
  Object.defineProperty(w.HTMLElement.prototype, 'offsetHeight', { get: () => panel.h, configurable: true });
  (globalThis as Record<string, unknown>).window = w;
  (globalThis as Record<string, unknown>).document = w.document;
  (globalThis as Record<string, unknown>).HTMLElement = w.HTMLElement;
  (globalThis as Record<string, unknown>).Node = w.Node;

  const anchor: PopoverAnchor = {
    getBoundingClientRect: () => ({
      top: anchorRect.top, bottom: anchorRect.bottom,
      left: anchorRect.right - 32, right: anchorRect.right,
      width: 32, height: anchorRect.bottom - anchorRect.top,
    }),
    contains: () => false,
  };
  const handle = mountBodyPopover(anchor, (el) => { el.textContent = 'items'; return null; }, { className: 'test-pop', ...options });
  return {
    panel: () => w.document.querySelector('.test-pop') as HTMLElement,
    open: () => handle.open(),
    close: () => handle.close(),
  };
}

test('a popover that fits keeps the plain drop below the anchor', () => {
  const h = harness({ top: 100, bottom: 132, right: 370 }, { w: 220, h: 300 });
  h.open();
  const el = h.panel();
  assert.equal(el.style.top, '140px', 'anchor.bottom + 8');
  assert.equal(el.style.right, '20px', 'right-aligned to the anchor');
  h.close();
});

test('a popover anchored near the bottom flips above the anchor', () => {
  const h = harness({ top: 700, bottom: 732, right: 370 }, { w: 220, h: 300 });
  h.open();
  const el = h.panel();
  // 732 + 8 + 300 = 1040 > 844 - 8, so it flips: 700 - 300 - 8.
  assert.equal(el.style.top, '392px');
  assert.equal(Number.parseInt(el.style.top, 10) + 300 <= VH - 8, true, 'stays inside the viewport bottom');
  h.close();
});

test('a panel taller than the viewport clamps to the top margin instead of flipping', () => {
  const h = harness({ top: 700, bottom: 732, right: 370 }, { w: 220, h: 900 });
  h.open();
  assert.equal(h.panel().style.top, '8px');
  h.close();
});

test('a wide panel clamps its right inset so its left edge stays on-screen', () => {
  // Anchor hard against the right edge: the un-clamped inset (8) would put the
  // panel's left edge at 390 - 8 - 360 = 22... so widen it past the viewport.
  const h = harness({ top: 100, bottom: 132, right: 200 }, { w: 380, h: 200 });
  h.open();
  // Desired inset 190 would push the left edge to -180; clamped to 390 - 380 - 8 = 2,
  // which is under the margin, so it pins flush at 8.
  assert.equal(h.panel().style.right, '8px');
  h.close();
});

test('a reserved scrollbar gutter moves the clamp to the containing block’s real right edge', () => {
  // A classic scrollbar's gutter leaves the fixed containing block 15px narrower than
  // innerWidth, so a `right` inset puts the panel 15px further left than innerWidth predicts.
  const CB = VW - 15;
  const panel = { w: 352, h: 200 };
  const h = harness({ top: 100, bottom: 132, right: 236 }, panel);
  const proto = (window as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement.prototype;
  const previous = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function (this: HTMLElement) {
    const right = CB - Number.parseInt(this.style.right || '0', 10);
    return { left: right - panel.w, right, top: 0, bottom: 0, width: panel.w, height: panel.h, x: right - panel.w, y: 0, toJSON: () => ({}) } as DOMRect;
  };
  try {
    h.open();
    // innerWidth alone gives 390 - 352 - 8 = 30, which puts the left edge at 375 - 30 - 352 = -7.
    assert.equal(h.panel().style.right, '15px');
    assert.equal(h.panel().getBoundingClientRect().left, 8, 'the left edge keeps its margin inside the viewport');
  } finally { h.close(); proto.getBoundingClientRect = previous; }
});

test('an unmeasurable panel keeps the plain drop (nothing to reason from)', () => {
  const h = harness({ top: 800, bottom: 832, right: 370 }, { w: 0, h: 0 });
  h.open();
  assert.equal(h.panel().style.top, '840px');
  h.close();
});


/** A popover with two buttons in it, opened from a real trigger, for the listener
 *  options. `before` runs ahead of the open, as a host surface's own wiring does. */
function live(options: Partial<BodyPopoverOptions>, before?: (doc: Document) => void) {
  const d = new JSDOM('<!doctype html><html><body><div id="host"><button id="trigger">Open</button><div id="stopper">canvas</div></div></body></html>', { pretendToBeVisual: true });
  const w = d.window;
  (globalThis as Record<string, unknown>).window = w;
  (globalThis as Record<string, unknown>).document = w.document;
  (globalThis as Record<string, unknown>).HTMLElement = w.HTMLElement;
  (globalThis as Record<string, unknown>).Node = w.Node;
  before?.(w.document);
  const trigger = w.document.getElementById('trigger') as HTMLButtonElement;
  const handle = mountBodyPopover(trigger, (el) => {
    el.innerHTML = '<button id="first">One</button><button id="last">Two</button>';
    return el.querySelector<HTMLElement>('#first');
  }, { className: 'test-pop', ...options });
  const key = (target: Element, k: string): KeyboardEvent => {
    const event = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  const press = (target: Element): void => { target.dispatchEvent(new w.Event('pointerdown', { bubbles: true })); };
  const tick = (): Promise<void> => new Promise((resolve) => { w.setTimeout(resolve, 0); });
  return { w, doc: w.document, trigger, handle, key, press, tick };
}

test('capture: Escape inside the panel closes it before a host listener on document hears it', () => {
  let hostHeard = 0;
  const onHost = (e: Event): void => { if ((e as KeyboardEvent).key === 'Escape') hostHeard += 1; };
  const t = live({ capture: true }, (doc) => doc.addEventListener('keydown', onHost));
  t.handle.open();
  t.key(t.doc.getElementById('first')!, 'Escape');
  assert.equal(t.handle.isOpen(), false);
  assert.equal(hostHeard, 0, 'the host surface keeps its Escape for the next press');
  assert.equal(t.doc.activeElement, t.trigger, 'focus goes back to the trigger');
});

test('without capture a host listener registered first on document still hears the same Escape', () => {
  let hostHeard = 0;
  const onHost = (e: Event): void => { if ((e as KeyboardEvent).key === 'Escape') hostHeard += 1; };
  const t = live({}, (doc) => doc.addEventListener('keydown', onHost));
  t.handle.open();
  t.key(t.doc.getElementById('first')!, 'Escape');
  assert.equal(t.handle.isOpen(), false);
  assert.equal(hostHeard, 1, 'the default is unchanged for every other caller');
});

test('capture: a press on a surface that stops pointerdown still closes the panel', async () => {
  const t = live({ capture: true });
  t.doc.getElementById('stopper')!.addEventListener('pointerdown', (e) => e.stopPropagation());
  t.handle.open();
  await t.tick();
  t.press(t.doc.getElementById('stopper')!);
  assert.equal(t.handle.isOpen(), false);
  t.handle.open();
  await t.tick();
  t.press(t.trigger);
  assert.equal(t.handle.isOpen(), true, 'a press on the trigger is left to its own click');
  t.handle.close();
  const bubbling = live({});
  bubbling.doc.getElementById('stopper')!.addEventListener('pointerdown', (e) => e.stopPropagation());
  bubbling.handle.open();
  await bubbling.tick();
  bubbling.press(bubbling.doc.getElementById('stopper')!);
  assert.equal(bubbling.handle.isOpen(), true, 'without capture the stopped press never reaches the shell');
  bubbling.handle.close();
});

test('trapFocus: false focuses what render returns and leaves Tab to the browser', () => {
  const t = live({ trapFocus: false });
  t.handle.open();
  assert.equal(t.doc.activeElement?.id, 'first');
  const tab = t.key(t.doc.getElementById('last')!, 'Tab');
  assert.equal(tab.defaultPrevented, false, 'Tab carries on past the last control');
  t.handle.close();
  const trapped = live({});
  trapped.handle.open();
  assert.equal(trapped.doc.activeElement?.id, 'first');
  assert.equal(trapped.key(trapped.doc.getElementById('last')!, 'Tab').defaultPrevented, true, 'the default trap still holds Tab');
  trapped.handle.close();
});

test('expanding popover content stays inside the viewport and stops tracking on close', () => {
  let resize: (() => void) | undefined;
  let disconnected = false;
  const previous = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) { resize = () => callback([], this); }
    observe() {}
    unobserve() {}
    disconnect() { disconnected = true; }
  } as typeof ResizeObserver;
  const panel = { w: 220, h: 100 };
  const h = harness({ top: 500, bottom: 532, right: 370 }, panel, { trackSize: true });
  try {
    h.open();
    assert.equal(h.panel().style.top, '540px');
    panel.h = 400;
    resize!();
    assert.equal(h.panel().style.top, '92px', 'the expanded chooser flips above its trigger');
    h.close();
    assert.equal(disconnected, true);
  } finally { h.close(); globalThis.ResizeObserver = previous; }
});
