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
  const el = tile(cardMarkup(tool, session, [], false, false, false, { short: '4', label: '4 templates' }));
  assert.ok(el.classList.contains('gtile--resumable'));
  const resume = el.querySelector<HTMLButtonElement>('.gtile-meta > .gtile-resume > button.gtile-resume-link')!;
  assert.ok(resume, 'Continue is a real button in the text column');
  assert.equal(resume.dataset.resume, 'poster');
  assert.equal(resume.dataset.slot, 'poster:abc');
  assert.equal(resume.getAttribute('aria-label'), 'Continue Spring');
  assert.match(resume.textContent ?? '', /^Continue · 2d ago$/);

  const quiet = el.querySelector<HTMLAnchorElement>('.gtile-cap > a.gtile-new-icon')!;
  assert.equal(el.querySelector('.gtile-new'), null, 'the + New pill is retired');
  const chip = el.querySelector<HTMLAnchorElement>('.gtile-cap > a.gtile-tpl')!;
  assert.ok(chip, 'the starting-point chip sits in the caption line, not the text column');
  assert.equal(quiet.getAttribute('href'), chip.getAttribute('href'), 'the same template chooser as the icon');
  assert.ok(chip.querySelector('.gtile-tpl-icon svg'), 'a document glyph');
  assert.equal(chip.querySelector('.gtile-tpl-n')?.textContent, '4', 'and the short count beside it');
  assert.equal(chip.title, '4 templates', 'the whole line is the tooltip');
  assert.equal(chip.getAttribute('aria-label'), '4 templates. Start a new Poster session',
    'the accessible name starts with what the chip shows, then says what it does');
  assert.equal(quiet.getAttribute('aria-label'), 'New Poster');
  assert.equal(quiet.dataset.newTool, 'poster');
  assert.ok(quiet.querySelector('svg path'), 'the plus glyph from lib/icons.ts');
  assert.equal(quiet.textContent?.trim(), '', 'an icon button: its name is the label');

  const name = el.querySelector<HTMLElement>('.gtile-name')!;
  const cells = el.querySelector<HTMLElement>('.tile-cols')!;
  assert.equal(name.dataset.describedby, cells.id);
  assert.equal(name.hasAttribute('aria-describedby'), false, 'described only outside Grid, by the layout switch');
  assert.deepEqual([...cells.querySelectorAll<HTMLElement>('.tile-col')].map(c => [c.dataset.col, c.querySelector('bdi')?.textContent]),
    [['opened', '2d ago'], ['format', 'PNG'], ['category', 'Designer'], ['description', 'Make a poster.']]);
  assert.equal(cells.querySelectorAll('.tile-col > bdi').length, 4, 'each value keeps its own direction');
  assert.equal(cells.textContent, '2d ago, PNG, Designer, Make a poster.', 'the description reads as a list, not one run of words');
  assert.equal(cells.querySelectorAll('.tile-col > .visually-hidden').length, 3, 'the commas are for the ear only');
});

test('a tool with no icon still has a stand-in for the Card thumbnail slot', () => {
  const el = tile(cardMarkup({ ...tool, icon: undefined } as unknown as typeof tool, undefined, []));
  const slot = el.querySelector<HTMLElement>('.gtile-cap > .tool-card-icon.tool-card-icon--fallback')!;
  assert.ok(slot.querySelector('svg'));
  assert.equal(slot.getAttribute('aria-hidden'), 'true');
  assert.equal(tile(cardMarkup(tool, undefined, [])).querySelector('.tool-card-icon--fallback'), null);
});

test('a tool with no starting points carries its chip hidden, ready for a later "Start with"', () => {
  const el = tile(cardMarkup(tool, undefined, []));
  const chip = el.querySelector<HTMLAnchorElement>('.gtile-cap > a.gtile-tpl')!;
  assert.ok(chip.hidden, 'hidden, so it is out of sight and out of the accessibility tree');
  assert.equal(chip.hasAttribute('aria-label'), false);
  assert.equal(chip.querySelector('.gtile-tpl-n')?.textContent, '');
});

test('a tool with no session has no Continue, and an unavailable one has no "+ New"', () => {
  const fresh = tile(cardMarkup(tool, undefined, []));
  assert.equal(fresh.classList.contains('gtile--resumable'), false);
  assert.equal(fresh.querySelector('.gtile-resume'), null);
  assert.equal(fresh.querySelector('.tile-col[data-col="opened"]')!.textContent, '');
  assert.equal(fresh.querySelector('.tile-cols')!.textContent, 'PNG, Designer, Make a poster.', 'an empty cell adds no comma');
  const desktop = tile(cardMarkup({ ...tool, capabilities: ['filesystem'] }, session, []));
  assert.ok(desktop.classList.contains('gtile--unavailable'), 'a capability this shell lacks');
  assert.equal(desktop.querySelector('.gtile-tpl, .gtile-new-icon, .gtile-resume'), null);
});

test('the status line copy is for the eye only where the caption already announces it', () => {
  // A saved session with no look: the tile's box is the Continue button, which holds no
  // badge, so the status stays in the caption and Card's copy of it is the one read.
  const resumable = tile(cardMarkup({ ...tool, status: 'experimental' }, session, []));
  const line = resumable.querySelector<HTMLElement>('.gtile-meta > .gtile-status')!;
  assert.ok(line.querySelector('.badge-experimental'));
  for (const text of ['.gtile-resume', '.gtile-desc']) {
    assert.ok(line.compareDocumentPosition(resumable.querySelector(text)!) & 4 /* FOLLOWING */,
      `the badge leads ${text}, so a narrow row cuts the text and never the badge`);
  }
  const utility = tile(cardMarkup({ ...tool, status: 'experimental' }, session, [], false, true));
  assert.ok(utility.querySelector('.gtile-meta > .gtile-status')!.previousElementSibling?.classList.contains('gtile-name'));
  assert.equal(line.hasAttribute('aria-hidden'), false, 'with no picture box, Card hides the caption badge, so this one is read');
  // No look and no session: the icon leads the box, and the badge sits on its corner,
  // in the same place as on a preview.
  const plain = tile(cardMarkup({ ...tool, status: 'experimental' }, undefined, []));
  assert.ok(plain.querySelector('.gtile-tile--iconled > .badge-experimental'), 'the badge sits on the icon box');
  assert.equal(plain.querySelector('.gtile-status')!.getAttribute('aria-hidden'), 'true');
  assert.ok(plain.querySelector('.gtile-cap > .visually-hidden'), 'the caption still announces the status');
  assert.equal(plain.querySelector('.gtile-cap > .badge'), null, 'one badge, on the box');
  const withLook = tile(cardMarkup({ ...tool, status: 'experimental', examples: [{ values: {} }] } as typeof tool, undefined, []));
  assert.ok(withLook.classList.contains('gtile--has-preview'));
  assert.equal(withLook.querySelector('.gtile-status')!.getAttribute('aria-hidden'), 'true');
  assert.ok(withLook.querySelector('.gtile-cap > .visually-hidden'), 'the caption still announces the status');
  assert.equal(tile(cardMarkup(tool, undefined, [])).querySelector('.gtile-status'), null, 'an official tool has no status line');
});

test('a utility tile carries its cells and no formats line; a view card its description cell', () => {
  const el = tile(cardMarkup(tool, undefined, [], false, true));
  assert.ok(el.classList.contains('gtile--utility'));
  assert.equal(el.querySelector('.gtile-fmts'), null, 'formats live in the About dialog, not on the card');
  assert.equal(el.querySelector('.gtile-tpl, .gtile-new-icon'), null, 'utilities have no starting points to choose');
  assert.equal(el.querySelector('.tile-col[data-col="format"]')!.textContent, 'PNG');
  const view = { id: 'compare', href: '#/compare', icon: 'document' as const, name: 'Compare', description: 'Compare two files.' };
  const card = tile(viewCardMarkup(view));
  const cells = card.querySelector<HTMLElement>('.tile-cols')!;
  assert.equal(card.querySelector<HTMLElement>('.gtile-name')!.dataset.describedby, cells.id);
  assert.equal(cells.querySelector('[data-col="format"]')!.textContent, '', 'a view card has no format');
  assert.equal(cells.querySelector('[data-col="description"]')!.textContent, view.description);
});

test('Grid hides every piece only Card and List draw, the description included', () => {
  const sheet = css('browse-layout.css');
  const base = /\.gtile-resume,\s*\.gtile-new-icon,\s*\.gtile-status,\s*\.gtile-desc,\s*\.tool-card-icon\.tool-card-icon--fallback \{ display: none; \}/;
  assert.match(sheet, base);
  assert.match(css('projects.css'), /^\.tile-cols \{ display: none; \}$/m, 'the detail cells are hidden everywhere but List');
  const rules = [...sheet.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1]!.trim(), body: m[2]! }));
  for (const piece of ['gtile-resume', 'gtile-new-icon', 'gtile-status', 'gtile-desc']) {
    const shows = rules.filter(r => r.selector.includes(`.${piece}`) && /(?:^|;)\s*display:(?!\s*none)/.test(r.body));
    assert.ok(shows.length > 0, `${piece} is drawn somewhere`);
    for (const r of shows) assert.match(r.selector, /\[data-browse-layout="card"\]/, `${piece} shows only in Card: ${r.selector}`);
  }
});

test('a programme member sees no status chip but Experimental, and staff keep every chip (plans/82 M6)', async () => {
  const { setProgrammeMember } = await import('../lib/workspace-templates.ts');
  const chips = () => ['community', 'experimental'].map((status) => !!tile(cardMarkup({ ...tool, status }, undefined, [], false, false, false, '')).querySelector(`.badge-${status}`));
  assert.deepEqual(chips(), [true, true], 'staff: Community and Experimental');
  setProgrammeMember(true);
  try {
    assert.deepEqual(chips(), [false, true], 'a member: Experimental only, for its watermark');
  } finally { setProgrammeMember(false); }
});
