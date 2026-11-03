// SPDX-License-Identifier: MPL-2.0
/**
 * An inspector dialog as the second pane (lib/split-inspector.ts): non-modal in two
 * columns, reserving the inline end like the edge dock, and back to a modal on a
 * tabletop or outside split. The dialog is a fake that records its modality.
 *
 * Run directly:  node --test shells/web/src/lib/split-inspector.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
const win = dom.window as unknown as Window & typeof globalThis;
globalThis.window = win;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.requestAnimationFrame = ((fn: FrameRequestCallback) => setTimeout(() => fn(0), 0)) as unknown as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
let coarse = true;
const mm = ((q: string) => ({
  get matches() { return q.includes('pointer: coarse') ? coarse : false; },
  media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
})) as unknown as typeof globalThis.matchMedia;
win.matchMedia = mm;
globalThis.matchMedia = mm;
function size(width: number, height: number): void {
  Object.defineProperty(win, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(win, 'innerHeight', { value: height, configurable: true });
}

const { followSplitPane, inspectorPaneWanted, PANE_CLASS } = await import('./split-inspector.ts');
const { startLayoutPosture, NATIVE_FOLD_EVENT } = await import('./layout-posture.ts');

function fakeDialog() {
  const el = document.createElement('dialog');
  const modes: boolean[] = [];
  return { el, modes, setModal: (m: boolean) => { modes.push(m); } };
}
const root = (): HTMLElement => document.documentElement;

test('outside split the dialog stays a modal and nothing is reserved', () => {
  size(1280, 800);
  coarse = false;
  const stop = startLayoutPosture(win);
  const d = fakeDialog();
  const off = followSplitPane(d, { id: 'i-desk' });
  try {
    assert.equal(inspectorPaneWanted(), false);
    assert.deepEqual(d.modes, [true]);
    assert.equal(d.el.classList.contains(PANE_CLASS), false);
    assert.equal(root().style.getPropertyValue('--dock-w'), '');
    assert.equal(root().hasAttribute('data-edge-dock'), false);
  } finally { off(); stop(); }
});

test('in two columns the dialog is a non-modal pane on the inline end, reserving that side', () => {
  size(890, 626);
  coarse = true;
  const stop = startLayoutPosture(win);
  const d = fakeDialog();
  const off = followSplitPane(d, { id: 'i-cols' });
  try {
    assert.equal(d.modes.at(-1), false);
    assert.ok(d.el.classList.contains(PANE_CLASS));
    // Right hand, left to right: the browser has the left pane, the details the right.
    assert.equal(d.el.style.getPropertyValue('--split-pane-w'), '437px');
    assert.equal(root().style.getPropertyValue('--dock-w'), '453px', 'the pane plus the gutter');
    assert.equal(root().hasAttribute('data-edge-dock'), true);
  } finally { off(); stop(); }
  assert.equal(root().style.getPropertyValue('--dock-w'), '', 'closing the details gives the side back');
  assert.equal(root().hasAttribute('data-edge-dock'), false);
});

test('a turn onto the table makes it a modal again, in place', () => {
  size(800, 760);
  coarse = true;
  const stop = startLayoutPosture(win);
  const d = fakeDialog();
  const off = followSplitPane(d, { id: 'i-table' });
  try {
    assert.equal(d.modes.at(-1), false);
    win.dispatchEvent(new win.CustomEvent(NATIVE_FOLD_EVENT, { detail: { state: 'half-opened', orientation: 'horizontal', bounds: { x: 0, y: 380, width: 800, height: 0 }, isSeparating: true, occlusion: 'none' } }));
    assert.equal(d.modes.at(-1), true);
    assert.equal(d.el.classList.contains(PANE_CLASS), false);
    assert.equal(root().style.getPropertyValue('--dock-w'), '');
  } finally { off(); stop(); }
});
