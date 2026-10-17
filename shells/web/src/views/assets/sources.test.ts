// SPDX-License-Identifier: MPL-2.0
/**
 * The Sources rail's width grip (views/assets/sources.ts over lib/splitter.ts): the
 * separator and its value, the arrow keys, End and Enter, the width kept in browser
 * storage across a fresh render, the cap a narrow window applies without forgetting the
 * wanted width, junk or blocked storage, and the grip surviving the rail's own rebuild.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/assets/sources.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import type { CatCtx } from './context.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://lolly.test/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'localStorage', 'CSS']) {
  Object.defineProperty(globalThis, key, { value: Reflect.get(dom.window, key), configurable: true, writable: true });
}

const { LISTING_ROOM, SOURCES_WIDTH, SOURCES_WIDTH_KEY, resizable, mount } = await import('./sources.ts');

/** The markup views/assets/sections.ts renders, with the workspace `wide` CSS pixels across. */
function render(wide: number): { cat: CatCtx; column: HTMLElement; rail: HTMLElement } {
  const viewEl = document.createElement('main');
  viewEl.innerHTML = '<div class="catalog-workspace"><div class="asset-sources-column"><aside class="asset-sources" aria-label="Sources"></aside></div><div class="catalog-body"></div></div>';
  document.body.replaceChildren(viewEl);
  const workspace = viewEl.querySelector<HTMLElement>('.catalog-workspace')!;
  Object.defineProperty(workspace, 'clientWidth', { value: wide, configurable: true });
  const cat = { viewEl } as unknown as CatCtx;
  return { cat, column: viewEl.querySelector<HTMLElement>('.asset-sources-column')!, rail: viewEl.querySelector<HTMLElement>('.asset-sources')! };
}

const grip = (column: HTMLElement): HTMLElement => column.querySelector<HTMLElement>('.asset-sources-grip')!;
const key = (el: HTMLElement, name: string, init: KeyboardEventInit = {}): void => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }));
};
const stored = (): unknown => {
  const raw = localStorage.getItem(SOURCES_WIDTH_KEY);
  return raw === null ? null : JSON.parse(raw);
};
const wanted = (column: HTMLElement): string => column.style.getPropertyValue('--asset-sources-width');

test('the grip is a separator for the rail, at the default width when nothing is stored', () => {
  localStorage.clear();
  const { cat, column, rail } = render(1200);
  resizable(cat);
  const g = grip(column);
  assert.ok(g, 'the grip sits in the column, beside the rail');
  assert.equal(g.previousElementSibling, rail);
  assert.equal(g.getAttribute('role'), 'separator');
  assert.equal(g.getAttribute('aria-orientation'), 'vertical');
  assert.equal(g.getAttribute('aria-label'), 'Resize the Sources panel');
  assert.equal(g.getAttribute('aria-controls'), rail.id);
  assert.ok(rail.id, 'the rail is given an id for aria-controls');
  assert.equal(g.tabIndex, 0);
  assert.equal(g.getAttribute('aria-valuenow'), String(SOURCES_WIDTH.initial));
  assert.equal(g.getAttribute('aria-valuemin'), String(SOURCES_WIDTH.min));
  assert.equal(g.getAttribute('aria-valuemax'), String(SOURCES_WIDTH.max));
  assert.equal(g.getAttribute('aria-valuetext'), `${SOURCES_WIDTH.initial} pixels wide`);
  assert.equal(wanted(column), `${SOURCES_WIDTH.initial}px`);
  assert.equal(stored(), null, 'mounting alone stores nothing');
});

test('a resize is stored and a fresh render of the view opens at that width', () => {
  localStorage.clear();
  const first = render(1200);
  resizable(first.cat);
  key(grip(first.column), 'ArrowRight');
  assert.equal(grip(first.column).getAttribute('aria-valuenow'), String(SOURCES_WIDTH.initial + 16));
  assert.equal(wanted(first.column), `${SOURCES_WIDTH.initial + 16}px`);
  assert.deepEqual(stored(), { width: SOURCES_WIDTH.initial + 16 });
  key(grip(first.column), 'ArrowLeft', { shiftKey: true });
  assert.deepEqual(stored(), { width: SOURCES_WIDTH.initial + 16 - 64 });

  const second = render(1200);
  resizable(second.cat);
  assert.equal(grip(second.column).getAttribute('aria-valuenow'), String(SOURCES_WIDTH.initial - 48));
  assert.equal(wanted(second.column), `${SOURCES_WIDTH.initial - 48}px`);
});

test('the rail stops at its limits, and Enter goes back to the default and forgets the stored width', () => {
  localStorage.clear();
  const { cat, column } = render(1600);
  resizable(cat);
  const g = grip(column);
  key(g, 'End');
  assert.equal(g.getAttribute('aria-valuenow'), String(SOURCES_WIDTH.max));
  assert.deepEqual(stored(), { width: SOURCES_WIDTH.max });
  key(g, 'ArrowRight');
  assert.equal(g.getAttribute('aria-valuenow'), String(SOURCES_WIDTH.max), 'no wider than the maximum');
  key(g, 'Home');
  assert.equal(g.getAttribute('aria-valuenow'), String(SOURCES_WIDTH.min));
  key(g, 'ArrowLeft');
  assert.deepEqual(stored(), { width: SOURCES_WIDTH.min }, 'no narrower than the minimum');
  key(g, 'Enter');
  assert.equal(g.getAttribute('aria-valuenow'), String(SOURCES_WIDTH.initial));
  assert.equal(wanted(column), `${SOURCES_WIDTH.initial}px`);
  assert.equal(stored(), null);
});

test('a narrow window caps the rail and keeps the listing its room, without forgetting the wanted width', () => {
  localStorage.setItem(SOURCES_WIDTH_KEY, JSON.stringify({ width: 400 }));
  const wide = 600;
  const cap = wide - LISTING_ROOM;
  const { cat, column } = render(wide);
  resizable(cat);
  const g = grip(column);
  assert.equal(g.getAttribute('aria-valuenow'), String(cap), 'the value is the width the rail can show');
  assert.equal(g.getAttribute('aria-valuemax'), String(cap));
  assert.equal(wanted(column), '400px', 'the wanted width stays for a wider window');
  assert.deepEqual(stored(), { width: 400 });

  // The window grows: the value is read again when the grip takes the focus.
  Object.defineProperty(column.parentElement!, 'clientWidth', { value: 1200, configurable: true });
  g.dispatchEvent(new dom.window.FocusEvent('focus'));
  assert.equal(g.getAttribute('aria-valuenow'), '400');
  assert.equal(g.getAttribute('aria-valuemax'), String(SOURCES_WIDTH.max));

  // A window too narrow for the minimum still offers the minimum.
  Object.defineProperty(column.parentElement!, 'clientWidth', { value: 300, configurable: true });
  key(g, 'ArrowLeft');
  assert.equal(g.getAttribute('aria-valuenow'), String(SOURCES_WIDTH.min));
});

test('a stored width outside the limits, junk or a blocked store opens at a valid width', () => {
  localStorage.setItem(SOURCES_WIDTH_KEY, JSON.stringify({ width: 9999 }));
  let view = render(1600);
  resizable(view.cat);
  assert.equal(grip(view.column).getAttribute('aria-valuenow'), String(SOURCES_WIDTH.max));
  assert.equal(wanted(view.column), `${SOURCES_WIDTH.max}px`);

  localStorage.setItem(SOURCES_WIDTH_KEY, '{not json');
  view = render(1600);
  resizable(view.cat);
  assert.equal(grip(view.column).getAttribute('aria-valuenow'), String(SOURCES_WIDTH.initial));

  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!;
  Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('blocked'); }, configurable: true });
  try {
    view = render(1600);
    resizable(view.cat);
    assert.equal(grip(view.column).getAttribute('aria-valuenow'), String(SOURCES_WIDTH.initial));
    key(grip(view.column), 'ArrowRight');
    assert.equal(grip(view.column).getAttribute('aria-valuenow'), String(SOURCES_WIDTH.initial + 16), 'the session still resizes');
  } finally {
    Object.defineProperty(globalThis, 'localStorage', original);
  }
});

test('rebuilding the rail keeps the one grip beside it', () => {
  localStorage.clear();
  const { cat, column, rail } = render(1200);
  Object.assign(cat, {
    allAssets: [], hiddenSet: new Set(), sourceSelection: 'all', sourceExpanded: new Set(), sourceStatuses: [], sourcesOpen: true, sourceCanManage: false,
    host: { state: { save: async () => {} } }, sections: { renderBody() {} },
  });
  mount(cat);
  resizable(cat);
  mount(cat);
  assert.ok(rail.querySelector('[role=tree]'), 'the rail holds the source tree');
  assert.equal(column.querySelectorAll('.asset-sources-grip').length, 1);
  assert.equal(rail.querySelector('.asset-sources-grip'), null, 'the grip is not inside the rail it resizes');
  assert.equal(grip(column).getAttribute('aria-controls'), rail.id);
  cat.sourceDispose?.();
});

test('the stylesheet caps the column with the same room the grip leaves the listing, and hides the grip on a phone', () => {
  const css = readFileSync(new URL('../../components/asset-source-navigation.css', import.meta.url), 'utf8');
  assert.match(css, new RegExp(`\\.asset-sources-column \\{[^}]*max-width: max\\(${SOURCES_WIDTH.min}px, calc\\(100% - ${LISTING_ROOM}px\\)\\)`));
  assert.match(css, new RegExp(`\\.asset-sources \\{[^}]*width: var\\(--asset-sources-width, ${SOURCES_WIDTH.initial}px\\)`));
  assert.match(css, /\.asset-sources-column:has\(> \.asset-sources\[hidden\]\) \{ display: none; \}/, 'a closed rail takes its grip with it');
  const phone = css.slice(css.indexOf('@media (max-width: 700px)'));
  assert.match(phone, /\.asset-sources-grip \{ display: none; \}/);
});
