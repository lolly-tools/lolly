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

import { mountBodyPopover, type PopoverAnchor } from './body-popover.ts';

const VW = 390, VH = 844; // iPhone-class portrait viewport

interface Harness { panel(): HTMLElement; open(): void; close(): void }

function harness(anchorRect: { top: number; bottom: number; right: number }, panel: { w: number; h: number }): Harness {
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
  const handle = mountBodyPopover(anchor, (el) => { el.textContent = 'items'; return null; }, { className: 'test-pop' });
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

test('an unmeasurable panel keeps the plain drop (nothing to reason from)', () => {
  const h = harness({ top: 800, bottom: 832, right: 370 }, { w: 0, h: 0 });
  h.open();
  assert.equal(h.panel().style.top, '840px');
  h.close();
});
