// SPDX-License-Identifier: MPL-2.0
/**
 * The shared drop-down sheet driver (lib/mobile-sheet.ts) behind a tool's inputs on a
 * phone and Design's phone panel: the `inset` a sheet that hangs below a bar reads, the
 * grip's expanded state, and the grip's keyboard activation.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/mobile-sheet.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Event', 'MouseEvent', 'PointerEvent']) {
  const value = (dom.window as unknown as Record<string, unknown>)[key];
  if (value) (globalThis as Record<string, unknown>)[key] = value;
}
// The phone layout: a narrow window. jsdom has no layout, so heights are stubbed.
Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: 390 });
Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 844 });
const mql = (query: string) => ({ matches: /max-width/.test(query), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
(dom.window as unknown as { matchMedia: typeof mql }).matchMedia = mql;
(globalThis as Record<string, unknown>).matchMedia = mql;
if (!(dom.window as unknown as { PointerEvent?: unknown }).PointerEvent) (globalThis as Record<string, unknown>).PointerEvent = dom.window.MouseEvent;

const { setupMobileSheet } = await import('./mobile-sheet.ts');

const rect = (top: number, height: number): DOMRect => ({ top, height, bottom: top + height, left: 0, right: 390, width: 390, x: 0, y: top, toJSON() { return this; } } as DOMRect);

function fixture(inset = 0) {
  const layout = document.createElement('div');
  const sheet = document.createElement('div');
  const head = document.createElement('div');
  head.className = 'sidebar-header';
  sheet.append(head);
  const grip = document.createElement('button');
  layout.append(sheet, grip);
  document.body.append(layout);
  let height = 300;
  sheet.getBoundingClientRect = () => rect(inset, height);
  head.getBoundingClientRect = () => rect(inset, 52);
  grip.setPointerCapture = () => {};
  const changes: Array<string | undefined> = [];
  const handle = setupMobileSheet(layout, sheet, grip, { initial: 'peek', inset: () => inset, onChange: (s) => changes.push(s) });
  return { layout, sheet, grip, handle, changes, setHeight: (h: number) => { height = h; } };
}

test('a sheet that hangs below a bar measures its stops from the anchor edge', () => {
  const f = fixture(58);
  try {
    // The peek is the head strip plus the bar it hangs from, so the CSS stop for the peek
    // puts the sheet's edge under the strip, not 58px short of the strip's foot.
    assert.equal(f.layout.style.getPropertyValue('--peek-h'), `${52 + 58}px`);
    // A drag starts from the edge's distance from the anchor: the box (300) plus the bar.
    f.setHeight(300);
    f.grip.dispatchEvent(new PointerEvent('pointerdown', { clientY: 400, bubbles: true }));
    f.grip.dispatchEvent(new PointerEvent('pointermove', { clientY: 450, bubbles: true }));
    assert.equal(f.layout.style.getPropertyValue('--sheet-h'), `${300 + 58 + 50}px`);
    f.grip.dispatchEvent(new PointerEvent('pointerup', { clientY: 450, bubbles: true }));
  } finally { f.handle.teardown(); f.layout.remove(); }
});

test('without an inset nothing changes for a tool\'s sheet', () => {
  const f = fixture(0);
  try {
    assert.equal(f.layout.style.getPropertyValue('--peek-h'), '52px');
    f.grip.dispatchEvent(new PointerEvent('pointerdown', { clientY: 300, bubbles: true }));
    f.grip.dispatchEvent(new PointerEvent('pointermove', { clientY: 340, bubbles: true }));
    assert.equal(f.layout.style.getPropertyValue('--sheet-h'), '340px');
    f.grip.dispatchEvent(new PointerEvent('pointerup', { clientY: 340, bubbles: true }));
  } finally { f.handle.teardown(); f.layout.remove(); }
});

test('the grip says whether the sheet is open past its first stop, and the keyboard steps it', () => {
  const f = fixture(0);
  try {
    assert.equal(f.grip.getAttribute('aria-expanded'), 'false', 'at the peek');
    // Enter or Space on a button is a click with no pointer behind it (detail 0).
    f.grip.dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true }));
    assert.equal(f.layout.getAttribute('data-sheet'), 'half');
    assert.equal(f.grip.getAttribute('aria-expanded'), 'true');
    f.grip.dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true }));
    assert.equal(f.layout.getAttribute('data-sheet'), 'full');
    f.grip.dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true }));
    assert.equal(f.layout.getAttribute('data-sheet'), 'half', 'and back, with the tap\'s bounce');
    // A pointer's own click (detail 1) is the drag handle's to answer, not this one's.
    f.grip.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true }));
    assert.equal(f.layout.getAttribute('data-sheet'), 'half');
    assert.deepEqual(f.changes, ['half', 'full', 'half']);
  } finally {
    f.handle.teardown();
    assert.equal(f.grip.hasAttribute('aria-expanded'), false, 'teardown takes the state off');
    f.layout.remove();
  }
});
