// SPDX-License-Identifier: MPL-2.0
/**
 * Gallery tiles (views/gallery-tiles.ts): one markup for every browse layout. Each tile
 * carries, from its first paint, the pieces Card draws (Continue, the quiet "+ New",
 * the status line, the formats line, the detail cells), and Grid hides every one of
 * them, so Grid draws what it drew before plan 302.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/gallery-tiles.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test/#/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement });
const { cardMarkup, viewCardMarkup } = await import('./gallery-tiles.ts');

const css = (rel: string): string => readFileSync(new URL(`../styles/parts/${rel}`, import.meta.url), 'utf8');
const tile = (html: string): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.firstElementChild as HTMLElement;
};
const ICON = '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';
const tool = {
  id: 'poster', name: 'Poster', description: 'Make a poster.', status: 'official', category: 'designer',
  formats: ['png', 'svg', 'pdf'], icon: ICON,
};
const session = {
  toolId: 'poster', slot: 'poster:abc', filename: 'Spring', thumb: null,
  updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
} as unknown as Parameters<typeof cardMarkup>[1];

test('a tool tile carries Continue, the quiet "+ New" and its detail cells', () => {
  const el = tile(cardMarkup(tool, session, [], false, false, false, '4 templates'));
  assert.ok(el.classList.contains('gtile--resumable'));
  const resume = el.querySelector<HTMLButtonElement>('.gtile-meta > .gtile-resume > button.gtile-resume-link')!;
  assert.ok(resume, 'Continue is a real button in the text column');
  assert.equal(resume.dataset.resume, 'poster');
  assert.equal(resume.dataset.slot, 'poster:abc');
  assert.equal(resume.getAttribute('aria-label'), 'Continue Spring');
  assert.match(resume.textContent ?? '', /^Continue · 2d ago$/);

  const quiet = el.querySelector<HTMLAnchorElement>('.gtile-cap > a.gtile-new-icon')!;
  const pill = el.querySelector<HTMLAnchorElement>('.gtile-cap > a.gtile-new')!;
  assert.equal(quiet.getAttribute('href'), pill.getAttribute('href'), 'the same template chooser as the Grid pill');
  assert.equal(quiet.getAttribute('aria-label'), 'New Poster');
  assert.equal(quiet.dataset.newTool, 'poster');
  assert.ok(quiet.querySelector('svg path'), 'the plus glyph from lib/icons.ts');
  assert.equal(quiet.textContent?.trim(), '', 'an icon button: its name is the label');

  const name = el.querySelector<HTMLElement>('.gtile-name')!;
  const cells = el.querySelector<HTMLElement>('.tile-cols')!;
  assert.equal(name.dataset.describedby, cells.id);
  assert.equal(name.hasAttribute('aria-describedby'), false, 'described only outside Grid, by the layout switch');
  assert.deepEqual([...cells.querySelectorAll<HTMLElement>('.tile-col')].map(c => [c.dataset.col, c.textContent]),
    [['opened', '2d ago'], ['format', 'PNG'], ['category', 'Designer'], ['description', 'Make a poster.']]);
  assert.equal(cells.querySelectorAll('.tile-col > bdi').length, 4, 'each value keeps its own direction');
});

test('a tool with no icon still has a stand-in for the Card thumbnail slot', () => {
  const el = tile(cardMarkup({ ...tool, icon: undefined } as unknown as typeof tool, undefined, []));
  const slot = el.querySelector<HTMLElement>('.gtile-cap > .tool-card-icon.tool-card-icon--fallback')!;
  assert.ok(slot.querySelector('svg'));
  assert.equal(slot.getAttribute('aria-hidden'), 'true');
  assert.equal(tile(cardMarkup(tool, undefined, [])).querySelector('.tool-card-icon--fallback'), null);
});

test('a tool with no session has no Continue, and an unavailable one has no "+ New"', () => {
  const fresh = tile(cardMarkup(tool, undefined, []));
  assert.equal(fresh.classList.contains('gtile--resumable'), false);
  assert.equal(fresh.querySelector('.gtile-resume'), null);
  assert.equal(fresh.querySelector('.tile-col[data-col="opened"]')!.textContent, '');
  const desktop = tile(cardMarkup({ ...tool, capabilities: ['filesystem'] }, session, []));
  assert.ok(desktop.classList.contains('gtile--unavailable'), 'a capability this shell lacks');
  assert.equal(desktop.querySelector('.gtile-new, .gtile-new-icon, .gtile-resume'), null);
});

test('the status line copy is for the eye only where the caption already announces it', () => {
  const plain = tile(cardMarkup({ ...tool, status: 'experimental' }, undefined, []));
  const line = plain.querySelector<HTMLElement>('.gtile-meta > .gtile-status')!;
  assert.ok(line.querySelector('.badge-experimental'));
  assert.equal(line.hasAttribute('aria-hidden'), false, 'with no preview, Card hides the caption badge, so this one is read');
  const withLook = tile(cardMarkup({ ...tool, status: 'experimental', examples: [{ values: {} }] } as typeof tool, undefined, []));
  assert.ok(withLook.classList.contains('gtile--has-preview'));
  assert.equal(withLook.querySelector('.gtile-status')!.getAttribute('aria-hidden'), 'true');
  assert.ok(withLook.querySelector('.gtile-cap > .visually-hidden'), 'the caption still announces the status');
  assert.equal(tile(cardMarkup(tool, undefined, [])).querySelector('.gtile-status'), null, 'an official tool has no status line');
});

test('a utility tile carries its formats line and cells; a view card its description cell', () => {
  const el = tile(cardMarkup(tool, undefined, [], false, true));
  assert.ok(el.classList.contains('gtile--utility'));
  assert.equal(el.querySelector('.gtile-fmts')!.textContent, 'PNG · SVG · PDF');
  assert.equal(el.querySelector('.gtile-new, .gtile-new-icon'), null, 'utilities have no starting points to choose');
  assert.equal(el.querySelector('.tile-col[data-col="format"]')!.textContent, 'PNG');
  const view = { id: 'compare', href: '#/compare', icon: 'document' as const, name: 'Compare', description: 'Compare two files.' };
  const card = tile(viewCardMarkup(view));
  const cells = card.querySelector<HTMLElement>('.tile-cols')!;
  assert.equal(card.querySelector<HTMLElement>('.gtile-name')!.dataset.describedby, cells.id);
  assert.equal(cells.querySelector('[data-col="format"]')!.textContent, '', 'a view card has no format');
  assert.equal(cells.querySelector('[data-col="description"]')!.textContent, view.description);
});

test('Grid hides every piece only Card draws', () => {
  const sheet = css('browse-layout.css');
  const base = /\.gtile-resume,\s*\.gtile-new-icon,\s*\.gtile-status,\s*\.gtile-fmts,\s*\.tool-card-icon\.tool-card-icon--fallback \{ display: none; \}/;
  assert.match(sheet, base);
  assert.match(css('projects.css'), /^\.tile-cols \{ display: none; \}$/m, 'the detail cells are hidden everywhere but List');
  const rules = [...sheet.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1]!.trim(), body: m[2]! }));
  for (const piece of ['gtile-resume', 'gtile-new-icon', 'gtile-status', 'gtile-fmts']) {
    const shows = rules.filter(r => r.selector.includes(`.${piece}`) && /(?:^|;)\s*display:(?!\s*none)/.test(r.body));
    assert.ok(shows.length > 0, `${piece} is drawn somewhere`);
    for (const r of shows) assert.match(r.selector, /\[data-browse-layout="card"\]/, `${piece} shows only in Card: ${r.selector}`);
  }
});
