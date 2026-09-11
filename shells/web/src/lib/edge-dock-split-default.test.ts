/**
 * The stacked split's DEFAULT: two full panels docked with no split ever dragged share
 * the column evenly, clamped to MIN_SLOT_H. Before 2026-09-03 the top slot kept flex:none
 * and its content height, so an inspector showing one collapsed section left the lower
 * panel a sliver at the top (87px) and the divider unreachable. Its own file because the
 * module remembers the split for the life of the import and edge-dock.test.ts drags it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
localStorage.setItem('lolly:edge-dock', JSON.stringify({ width: 400 }));   // no split on record
(globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({
  matches: false, media: q, addEventListener() {}, removeEventListener() {},
});
if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}
const ED = await import('./edge-dock.ts');

function panel(id: string): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  document.body.appendChild(el);
  return el;
}

test('two unrelated stacked panels share the height evenly when no split was ever dragged', () => {
  ED.requestDock('neuro', panel('pi'));
  const body = document.querySelector<HTMLElement>('.edge-dock-body')!;
  // jsdom lays nothing out: give the body a height so the split has something to share.
  Object.defineProperty(body, 'clientHeight', { value: 600, configurable: true });
  ED.requestDock('transcript', panel('px'));
  const top = body.querySelector<HTMLElement>('.edge-dock-slot:not(.edge-dock-slot--compact)')!;
  assert.equal(top.style.flex, '0 0 auto', 'the top slot is sized explicitly');
  assert.equal(top.style.height, '300px', 'an even share, not the top panel\'s content height');
});

test('a short column still gives each panel the minimum', () => {
  const body = document.querySelector<HTMLElement>('.edge-dock-body')!;
  Object.defineProperty(body, 'clientHeight', { value: 300, configurable: true });
  ED.releaseDock('transcript');
  ED.requestDock('transcript', document.getElementById('px')!);
  const top = body.querySelector<HTMLElement>('.edge-dock-slot:not(.edge-dock-slot--compact)')!;
  assert.equal(top.style.height, '200px', 'clamped to MIN_SLOT_H (200)');
});
