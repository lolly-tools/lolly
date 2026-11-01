// SPDX-License-Identifier: MPL-2.0
// The studio measures its pinned bars onto the page's root, where start-bar.css
// reads them as the page's scroll padding, so keyboard focus is never left under
// the bar (WCAG 2.4.11). The bar at the top counts at every width; the room bar
// counts only while it is fixed to the bottom edge (a phone). Leaving the studio
// takes both values with it, so no other view inherits a padded page.
// Run with node --import ./tests/css-stub.mjs --test <this file>.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/#/start' });
const original = new Map<string, PropertyDescriptor | undefined>();
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'location', 'localStorage', 'navigator', 'CustomEvent', 'Event', 'MutationObserver', 'getComputedStyle']) {
  original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (dom.window as unknown as Record<string, unknown>)[key] });
}
after(() => {
  for (const [key, desc] of original) { if (desc) Object.defineProperty(globalThis, key, desc); else delete (globalThis as Record<string, unknown>)[key]; }
  dom.window.close();
});

const { wireEditorPanels } = await import('./rooms.ts');
type Start = Parameters<typeof wireEditorPanels>[0];

/** A studio shell whose bar and room bar report the given heights. */
function studio(barHeight: number, roomBar: { height: number; fixed: boolean }) {
  const shell = document.createElement('div');
  shell.innerHTML = '<div class="ds-top"><header class="ds-bar"></header><nav class="ds-room-nav"></nav></div><div class="ds-shell"></div>';
  document.body.appendChild(shell);
  const rect = (height: number) => () => ({ height, width: 0, top: 0, left: 0, right: 0, bottom: height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  const top = shell.querySelector<HTMLElement>('.ds-top')!;
  const nav = shell.querySelector<HTMLElement>('.ds-room-nav')!;
  top.getBoundingClientRect = rect(barHeight);
  nav.getBoundingClientRect = rect(roomBar.height);
  if (roomBar.fixed) nav.style.position = 'fixed';
  const start = { editorRoot: null, shell, unsubStickyTop: null } as unknown as Start;
  return { shell, start };
}

const root = (): CSSStyleDeclaration => document.documentElement.style;

test('a desk pads the top by the bar and leaves the foot alone', () => {
  const { shell, start } = studio(100, { height: 44, fixed: false });
  try {
    wireEditorPanels(start);
    assert.equal(root().getPropertyValue('--ds-sticky-top'), '108px', 'the bar plus a breath');
    assert.equal(root().getPropertyValue('--ds-sticky-bottom'), '', 'the room strip is part of the pinned block, not a bar at the foot');
  } finally { start.unsubStickyTop?.(); shell.remove(); }
});

test('a phone pads the foot by the room bar fixed to the bottom edge', () => {
  const { shell, start } = studio(48, { height: 56, fixed: true });
  try {
    wireEditorPanels(start);
    assert.equal(root().getPropertyValue('--ds-sticky-top'), '56px');
    assert.equal(root().getPropertyValue('--ds-sticky-bottom'), '64px');
  } finally { start.unsubStickyTop?.(); shell.remove(); }
});

test('leaving the studio clears both values off the root', () => {
  const { shell, start } = studio(48, { height: 56, fixed: true });
  wireEditorPanels(start);
  assert.ok(start.unsubStickyTop, 'the studio keeps a way to stop measuring');
  start.unsubStickyTop!();
  shell.remove();
  assert.equal(root().getPropertyValue('--ds-sticky-top'), '');
  assert.equal(root().getPropertyValue('--ds-sticky-bottom'), '');
});

test('a resize after the bar has gone clears the values too', () => {
  const { shell, start } = studio(100, { height: 0, fixed: false });
  wireEditorPanels(start);
  shell.remove();
  window.dispatchEvent(new window.Event('resize'));
  assert.equal(root().getPropertyValue('--ds-sticky-top'), '', 'a stale padding never outlives the bar');
  start.unsubStickyTop?.();
});
