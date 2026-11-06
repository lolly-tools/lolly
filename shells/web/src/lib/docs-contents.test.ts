// SPDX-License-Identifier: MPL-2.0
/**
 * The page's contents behaviour (lib/docs-contents.ts), shared by /info and the in-app
 * reader: marking the section being read, the floating panel's open and close, Escape and
 * focus, and handing a row to the app's own scroll.
 *
 * Run directly:  node --test shells/web/src/lib/docs-contents.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { contentsRailHtml, pageBarHtml } from '../../../../packages/docs-render/src/contents.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/info/create/using.html' });
const w = dom.window;
Object.assign(globalThis, { window: w, document: w.document, Element: w.Element, HTMLElement: w.HTMLElement });
// jsdom has no layout and no animation frames: run a frame at once.
(w as unknown as { requestAnimationFrame: (f: FrameRequestCallback) => number }).requestAnimationFrame = (f) => { f(0); return 1; };

const { enhanceDocsContents } = await import('./docs-contents.ts');

const labels = { title: 'On this page' };
const heads = [
  { id: 'one', text: 'One', level: 2 as const },
  { id: 'one-a', text: 'One A', level: 3 as const },
  { id: 'two', text: 'Two', level: 2 as const },
];

/** A page: the article with three headings at the given tops, the rail and the control. */
function page(tops: Record<string, number>) {
  const d = w.document;
  d.body.innerHTML = `<main class="docs-content"><h2 id="one">One</h2><h3 id="one-a">One A</h3><h2 id="two">Two</h2></main>`
    + contentsRailHtml(heads, labels)
    + pageBarHtml({ section: 'Create', page: 'Using Lolly', headings: heads, labels: { ...labels, sections: 'Documentation sections' },
      sectionsHtml: '<a class="docs-pathway active" href="#/docs/creators" aria-current="true">Create</a>', pages: null, chevron: '' });
  for (const [id, top] of Object.entries(tops)) {
    (d.getElementById(id) as HTMLElement).getBoundingClientRect = () => ({ top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: top, toJSON: () => ({}) });
  }
  const article = d.querySelector('main') as HTMLElement;
  return { d, article };
}
const current = (d: Document) => [...d.querySelectorAll('a[aria-current="location"]')].map((a) => a.getAttribute('data-contents-target'));

test('the section above the reading line is marked in the rail and the sheet', () => {
  const { d, article } = page({ one: -400, 'one-a': 50, two: 900 });
  const off = enhanceDocsContents({ article, root: d, readingLine: () => 100 });
  // The rail marks the subsection; the sheet lists sections only, so it marks the section.
  assert.deepEqual(current(d), ['one-a', 'one']);
  off();
});

test('nothing is marked above the first section', () => {
  const { d, article } = page({ one: 300, 'one-a': 500, two: 900 });
  const off = enhanceDocsContents({ article, root: d, readingLine: () => 100 });
  assert.deepEqual(current(d), []);
  off();
});

test('the sheet opens on the bar, closes on Escape and gives focus back', () => {
  const { d, article } = page({ one: -400, 'one-a': -200, two: 50 });
  const off = enhanceDocsContents({ article, root: d, readingLine: () => 100 });
  const btn = d.querySelector('.doc-contents-btn') as HTMLButtonElement;
  const panel = d.getElementById('docContentsPanel') as HTMLElement;
  btn.click();
  assert.equal(panel.hidden, false);
  assert.equal(btn.getAttribute('aria-expanded'), 'true');
  assert.equal(d.activeElement?.getAttribute('data-contents-target'), 'two', 'focus goes to the section being read');
  let outer = 0;
  d.body.addEventListener('keydown', () => { outer++; });
  d.activeElement!.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(panel.hidden, true);
  assert.equal(btn.getAttribute('aria-expanded'), 'false');
  assert.equal(d.activeElement, btn, 'Escape returns focus to the button');
  assert.equal(outer, 0, 'an Escape the panel took reached an outer layer too');
  // With the panel closed, Escape is not the panel's to take.
  d.body.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(outer, 1);
  off();
});

test('a press outside closes the sheet', () => {
  const { d, article } = page({ one: 0, 'one-a': 0, two: 0 });
  const off = enhanceDocsContents({ article, root: d });
  (d.querySelector('.doc-contents-btn') as HTMLButtonElement).click();
  article.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true }));
  assert.equal((d.getElementById('docContentsPanel') as HTMLElement).hidden, true);
  off();
});

test('in the app a row goes to jump, which takes the click; on /info the browser follows it', () => {
  const { d, article } = page({ one: 0, 'one-a': 0, two: 0 });
  const asked: string[] = [];
  const off = enhanceDocsContents({ article, root: d, jump: (id) => { asked.push(id); return true; } });
  const row = d.querySelector('.docs-toc a[data-contents-target="two"]') as HTMLAnchorElement;
  const click = new w.MouseEvent('click', { bubbles: true, cancelable: true });
  row.dispatchEvent(click);
  assert.deepEqual(asked, ['two']);
  assert.equal(click.defaultPrevented, true, 'the app route would have taken a bare #id');
  // A modified click is the browser's: a new tab, a copied link.
  const meta = new w.MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
  row.dispatchEvent(meta);
  assert.equal(meta.defaultPrevented, false);
  assert.deepEqual(asked, ['two']);
  off();
  // No jump (the /info call): the link is left alone.
  const off2 = enhanceDocsContents({ article, root: d });
  const plain = new w.MouseEvent('click', { bubbles: true, cancelable: true });
  row.dispatchEvent(plain);
  assert.equal(plain.defaultPrevented, false);
  off2();
});

test('choosing a heading or a section in the sheet closes it', () => {
  const { d, article } = page({ one: 0, 'one-a': 0, two: 0 });
  const off = enhanceDocsContents({ article, root: d, jump: () => true });
  (d.querySelector('.doc-contents-btn') as HTMLButtonElement).click();
  (d.querySelector('#docContentsPanel a[data-contents-target="one"]') as HTMLAnchorElement).click();
  assert.equal((d.getElementById('docContentsPanel') as HTMLElement).hidden, true);
  (d.querySelector('.doc-contents-btn') as HTMLButtonElement).click();
  const section = d.querySelector('#docContentsPanel .docs-pathway') as HTMLAnchorElement;
  section.addEventListener('click', (e) => e.preventDefault()); // jsdom would navigate
  section.click();
  assert.equal((d.getElementById('docContentsPanel') as HTMLElement).hidden, true);
  off();
});
