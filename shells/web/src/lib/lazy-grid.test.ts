// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createLazyGrid } from './lazy-grid.ts';

function setup() {
  const dom = new JSDOM('<body><div id="pane"></div></body>');
  const g = globalThis as Record<string, unknown>;
  const saved = { getComputedStyle: g.getComputedStyle, IntersectionObserver: g.IntersectionObserver };
  g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  delete g.IntersectionObserver;
  const pane = dom.window.document.getElementById('pane') as unknown as HTMLElement;
  let renders = 0, appends = 0;
  const lazy = createLazyGrid<number>({
    pageSize: 3, gridClass: 'grid', render: (n) => { renders++; return `<i data-n="${n}"></i>`; },
    onAppend: () => { appends++; }, moreLabel: (shown, total) => `Show more ${shown} / ${total}`,
  });
  const restore = () => { g.getComputedStyle = saved.getComputedStyle; g.IntersectionObserver = saved.IntersectionObserver; };
  return { dom, pane, lazy, counts: () => ({ renders, appends }), restore };
}

test('a long list draws one page, and Show more appends the next in place', () => {
  const { pane, lazy, counts, restore } = setup();
  try {
    pane.innerHTML = lazy.grid([1, 2, 3, 4, 5, 6, 7]);
    lazy.observe(pane);
    assert.equal(pane.querySelectorAll('i').length, 3);
    assert.equal(counts().renders, 3, 'only the first page is rendered');
    const first = pane.querySelector('i');
    const button = pane.querySelector<HTMLElement>('[data-lazy-more]')!;
    assert.equal(button.textContent, 'Show more 3 / 7');
    button.click();
    assert.equal(pane.querySelectorAll('i').length, 6);
    assert.equal(pane.querySelector('i'), first, 'the cards already drawn are the same nodes, not a rebuild');
    assert.equal(pane.querySelector('[data-lazy-more]')?.textContent, 'Show more 6 / 7');
    pane.querySelector<HTMLElement>('[data-lazy-more]')!.click();
    assert.deepEqual([...pane.querySelectorAll('i')].map(i => i.getAttribute('data-n')), ['1', '2', '3', '4', '5', '6', '7']);
    assert.equal(pane.querySelector('[data-lazy-more]'), null, 'the button goes once every card is drawn');
    assert.equal(counts().appends, 2);
  } finally { restore(); }
});

test('a short list draws whole with no button', () => {
  const { pane, lazy, restore } = setup();
  try {
    pane.innerHTML = lazy.grid([1, 2]);
    assert.equal(pane.querySelectorAll('i').length, 2);
    assert.equal(pane.querySelector('[data-lazy-more]'), null);
  } finally { restore(); }
});

test('a folded section builds nothing until it is expanded, and only once', () => {
  const { pane, lazy, counts, restore } = setup();
  try {
    let builds = 0;
    pane.innerHTML = `<section>${lazy.defer(() => { builds++; return lazy.grid([1, 2, 3, 4]); })}</section>`;
    assert.equal(builds, 0);
    assert.equal(counts().renders, 0);
    const section = pane.querySelector('section')!;
    assert.equal(lazy.expand(section), true);
    assert.equal(builds, 1);
    assert.equal(section.querySelectorAll('i').length, 3);
    assert.ok(section.querySelector('[data-lazy-more]'), 'the built body is paged too');
    assert.equal(lazy.expand(section), false, 'a second expand is a no-op');
    assert.equal(builds, 1);
  } finally { restore(); }
});

test('reset forgets pending pages, so a stale button does nothing', () => {
  const { pane, lazy, restore } = setup();
  try {
    pane.innerHTML = lazy.grid([1, 2, 3, 4, 5]);
    const button = pane.querySelector<HTMLElement>('[data-lazy-more]')!;
    lazy.reset();
    assert.equal(lazy.more(button), 0);
    assert.equal(pane.querySelectorAll('i').length, 3);
  } finally { restore(); }
});

test('the observer presses Show more when it nears view', () => {
  const { dom, pane, lazy, restore } = setup();
  const observed: Element[] = [];
  let callback: ((entries: Array<{ isIntersecting: boolean; target: Element }>) => void) | null = null;
  (globalThis as Record<string, unknown>).IntersectionObserver = class {
    constructor(cb: typeof callback) { callback = cb; }
    observe(el: Element) { observed.push(el); }
    unobserve() {}
    disconnect() {}
  };
  try {
    pane.innerHTML = lazy.grid([1, 2, 3, 4, 5, 6, 7]);
    lazy.observe(pane);
    assert.equal(observed.length, 1);
    callback!([{ isIntersecting: true, target: observed[0]! }]);
    assert.equal(pane.querySelectorAll('i').length, 6);
    assert.ok(observed.length >= 2, 'the button is observed again so a tall view keeps filling');
    void dom;
  } finally { restore(); }
});
