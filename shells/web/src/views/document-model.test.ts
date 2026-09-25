// SPDX-License-Identifier: MPL-2.0
/**
 * The specification browser (views/document-model.ts) - the mount path.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/document-model.test.ts
 *
 * The view imports three stylesheets, so the run MUST use the --import
 * ./tests/css-stub.mjs hook or Node throws ERR_UNKNOWN_FILE_EXTENSION.
 *
 * What is covered: the rail is built from `index.json`; the bare route renders the
 * contents; a chapter is fetched from `/info/spec/document-model/<slug>.html` and
 * rehosted into the content column with its scripts gone and the Draft pill in
 * its title; the search filters chapters, headings and the open chapter's passages;
 * a `?h=` deep link marks its heading in the chapter and in the rail; a missing
 * chapter and a missing index each render their own status message; and main.ts
 * still imports the view lazily.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

// jsdom's CSS parser predates some of the syntax the shell's sheets use, and a
// parse failure dumps the whole sheet into the test log. Nothing here reads
// computed style (jsdom applies no layout), so that one error is swallowed and
// every other page error still prints.
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (err: Error) => {
  if (!/Could not parse CSS stylesheet/.test(err.message)) process.stderr.write(`[jsdom] ${err.message}\n`);
});

// jsdom globals pinned onto globalThis BEFORE the dynamic import of the module
// under test - the view and its import graph expect a browser realm.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://lolly.tools/#/document-model',
  pretendToBeVisual: true,
  virtualConsole,
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.history = dom.window.history;
// jsdom ships no window.CSS, so provide the one member the view uses (CSS.escape,
// in scrollToHeading and the heading mark). A plain identifier escaper is enough
// for the heading ids here.
globalThis.CSS = (dom.window as unknown as { CSS?: typeof CSS }).CSS ?? ({
  escape: (s: string) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
} as unknown as typeof CSS);
globalThis.localStorage = dom.window.localStorage; // currentTheme() reads localStorage
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame;

const { mountDocumentModel, readSpecIndex } = await import('./document-model.ts');

// A minimal host - the view only touches host.profile when the theme cycle is
// clicked, which no test does, so a get/set pair of no-ops is enough.
const host = {
  profile: { get: async () => ({}), set: async () => {} },
} as unknown as Parameters<typeof mountDocumentModel>[1];

const INDEX_URL = '/info/spec/document-model/index.json';
const chapterUrl = (slug: string): string => `/info/spec/document-model/${slug}.html`;

const INDEX = {
  version: 'draft-2026-09-24',
  updatedAt: '2026-09-24',
  chapters: [
    {
      slug: '01-constitution',
      title: 'Constitution',
      headings: [
        { id: 'thesis', text: 'Thesis and scope', level: 2 },
        { id: 'invariants', text: 'The thirteen invariants', level: 3 },
      ],
    },
    {
      slug: '02-records',
      title: 'Records and identity',
      headings: [{ id: 'record-map', text: 'The record map', level: 2 }],
    },
    { slug: '03-source-and-patches', title: 'Source rows, payloads and patches', headings: [] },
  ],
};

/** A chapter page as the docs build writes it: the h1 lifted into a masthead band
 *  OUTSIDE `.docs-content`, a script to exercise the strip, stamped headings. */
const CHAPTER_HTML = `<!doctype html><html><head><title>Constitution - Lolly</title></head>
<body>
  <div class="docs-masthead">
    <canvas class="docs-mast-canvas" aria-hidden="true"></canvas>
    <div class="docs-mast-inner"><h1 id="top">Constitution</h1></div>
  </div>
  <div class="docs-wrap">
    <main class="docs-content page-01-constitution">
      <p>A Lolly document represents a complete tool.</p>
      <script>window.__specShouldNeverRun = true;</script>
      <h2 id="thesis">Thesis and scope</h2>
      <p>Operations are fundamental; compositions and timelines are optional.</p>
      <h3 id="invariants">The thirteen invariants</h3>
      <p>A tool id is a permanent contract and is never reused.</p>
    </main>
  </div>
</body></html>`;

/** A fresh, DOCUMENT-CONNECTED mount element. The view bails after a fetch when
 *  the element is not connected, so every mount target must be on the body. */
function freshView(): HTMLElement {
  const el = document.createElement('main');
  el.id = 'view';
  document.body.appendChild(el);
  return el;
}

let fetchUrls: string[] = [];

interface StubRoute { ok: boolean; body?: string; json?: unknown }

/** Serve a fixed map of URLs. Anything not in the map answers 404, which is how
 *  the missing-chapter and missing-index branches are exercised. */
function stubFetch(routes: Record<string, StubRoute>): void {
  fetchUrls = [];
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    fetchUrls.push(url);
    const hit = routes[url];
    if (!hit) return { ok: false, text: async () => '', json: async () => ({}) };
    return { ok: hit.ok, text: async () => hit.body ?? '', json: async () => hit.json ?? {} };
  }) as unknown as typeof fetch;
}

const FULL_SITE: Record<string, StubRoute> = {
  [INDEX_URL]: { ok: true, json: INDEX },
  [chapterUrl('01-constitution')]: { ok: true, body: CHAPTER_HTML },
  [chapterUrl('02-records')]: { ok: true, body: CHAPTER_HTML },
};

test('the rail is built from index.json, and the bare route renders the contents', async () => {
  stubFetch(FULL_SITE);
  const view = freshView();

  await mountDocumentModel(view, host, null, '');

  assert.ok(fetchUrls.includes(INDEX_URL), `read the index (saw ${JSON.stringify(fetchUrls)})`);

  const sections = view.querySelectorAll('.dm-nav .dm-sec');
  assert.equal(sections.length, 3, 'one rail section per chapter');
  assert.equal(
    view.querySelector('.dm-nav a.dm-chapter')!.getAttribute('href'),
    '#/document-model/01-constitution',
    'a chapter link is the hash route for that chapter',
  );
  assert.equal(
    view.querySelectorAll('.dm-nav a.dm-heading').length, 3,
    'every heading of every chapter is in the rail',
  );
  assert.equal(
    view.querySelector('.dm-nav a.dm-heading')!.getAttribute('href'),
    '#/document-model/01-constitution?h=thesis',
    'a heading link carries its id as ?h= (a second # cannot ride a hash route)',
  );
  // A chapter with no headings gets no fold control to press.
  const folds = [...view.querySelectorAll<HTMLButtonElement>('.dm-nav .dm-fold')];
  assert.equal(folds.length, 3, 'a fold button per chapter');
  assert.equal(folds[2]!.disabled, true, 'the headingless chapter cannot be unfolded');

  // No chapter was asked for, so nothing was fetched beyond the index and the
  // content column is the contents.
  assert.ok(!fetchUrls.some((u) => u.endsWith('.html')), 'no chapter page was fetched');
  const rows = view.querySelectorAll('.dm-content .dm-toc .dm-toc-row');
  assert.equal(rows.length, 3, 'the contents lists every chapter');
  assert.ok(view.querySelector('.dm-content h1 .dm-pill'), 'the contents title carries the Draft pill');

  view.remove();
});

test('the shared chrome is built as nodes, with no raw-HTML sink in this view', async () => {
  stubFetch(FULL_SITE);
  const view = freshView();

  await mountDocumentModel(view, host, null, '');

  // backHomeHtml() and lib/icons.ts return markup strings. The view parses them
  // into nodes rather than assigning innerHTML, so this is the proof that the
  // shared pill, its home escape and a glyph all survive that parse.
  assert.ok(view.querySelector('.chrome-topleft'), 'the back-pill island is mounted');
  assert.ok(view.querySelector('[data-back-pill]'), 'the pill is wired by mountBackPill');
  assert.ok(view.querySelector('[data-home-fab]'), 'the always-Home escape rides with it');
  assert.ok(view.querySelector('.gallery-topright button'), 'the theme cycle is in the top-right cluster');
  assert.ok(view.querySelector('.dm-search-icon svg'), 'an icon parsed into a real <svg> node');

  view.remove();
});

test('a chapter is fetched and rehosted, with its scripts gone and the notice under its title', async () => {
  stubFetch(FULL_SITE);
  const view = freshView();

  await mountDocumentModel(view, host, '01-constitution', '');

  assert.ok(
    fetchUrls.includes(chapterUrl('01-constitution')),
    `fetched the built chapter page (saw ${JSON.stringify(fetchUrls)})`,
  );

  const article = view.querySelector<HTMLElement>('.dm-content article.docs-content');
  assert.ok(article, 'the .docs-content fragment is rehosted into an <article>');
  assert.ok(article!.classList.contains('page-01-constitution'), 'the page-<slug> class rides across');
  assert.equal(article!.querySelector('main'), null, 'the fragment main is rehosted, not nested');
  assert.equal(article!.querySelector('script'), null, 'a fetched page\'s scripts are removed');
  assert.ok(article!.querySelector('#thesis'), 'a stamped heading came with the fragment');

  // The build lifts the h1 into a masthead band outside the fragment, so the
  // chapter would otherwise open on its first paragraph with no title.
  const h1 = article!.querySelector('h1');
  assert.ok(h1, 'the title is lifted out of the masthead band');
  assert.equal(h1!.firstChild?.textContent, 'Constitution');
  assert.equal(article!.firstElementChild, h1, 'and it opens the chapter');
  assert.equal(article!.querySelector('canvas'), null, 'the band decoration stays behind');

  const pill = h1!.querySelector('.dm-pill');
  assert.ok(pill, 'the title carries the Draft pill');
  assert.equal(pill!.textContent, 'Draft');
  assert.match(pill!.getAttribute('aria-label') || '', /draft for review, dated 2026-09-24/);
  assert.equal(article!.querySelectorAll('.dm-pill').length, 1, 'the draft is said once');
  assert.equal(article!.querySelector('.dm-draft'), null, 'no banner beside the pill');

  // Previous and next, and the same chapter on the docs site.
  const next = view.querySelector<HTMLAnchorElement>('.dm-pager .dm-step--next');
  assert.ok(next, 'the first chapter has a next');
  assert.equal(next!.getAttribute('href'), '#/document-model/02-records');
  assert.equal(view.querySelector('.dm-pager .dm-step--prev'), null, 'and no previous');
  assert.equal(
    view.querySelector<HTMLAnchorElement>('.dm-source-link')!.getAttribute('href'),
    chapterUrl('01-constitution'),
    'the source link opens the same chapter on the docs site',
  );

  // The rail says which chapter is open.
  const open = view.querySelector<HTMLAnchorElement>('.dm-nav a.dm-chapter[aria-current="page"]');
  assert.ok(open, 'the open chapter is marked in the rail');
  assert.equal(open!.textContent, 'Constitution');
  assert.equal(
    view.querySelector<HTMLElement>('#dm-headings-01-constitution')!.hidden, false,
    'its headings are unfolded',
  );
  assert.equal(
    view.querySelector<HTMLElement>('#dm-headings-02-records')!.hidden, true,
    'another chapter stays folded',
  );

  view.remove();
});

test('the search filters chapters and their headings', async () => {
  stubFetch(FULL_SITE);
  const view = freshView();

  await mountDocumentModel(view, host, null, '');

  const search = view.querySelector<HTMLInputElement>('.dm-search-input')!;
  const sectionOf = (slug: string): HTMLElement =>
    view.querySelector<HTMLElement>(`#dm-headings-${slug}`)!.closest<HTMLElement>('.dm-sec')!;

  search.value = 'records';
  search.dispatchEvent(new dom.window.Event('input'));
  assert.equal(sectionOf('02-records').hidden, false, 'the chapter whose title matches stays');
  assert.equal(sectionOf('01-constitution').hidden, true, 'a chapter with no match goes');
  assert.equal(sectionOf('03-source-and-patches').hidden, true, 'and so does the third');
  assert.equal(view.querySelector<HTMLElement>('.dm-none')!.hidden, true, 'something matched, so no empty message');

  // A heading match opens its chapter and hides the headings that did not match.
  search.value = 'invariants';
  search.dispatchEvent(new dom.window.Event('input'));
  assert.equal(sectionOf('01-constitution').hidden, false, 'the chapter holding the heading stays');
  assert.equal(sectionOf('02-records').hidden, true, 'the others go');
  const headings = view.querySelectorAll<HTMLElement>('#dm-headings-01-constitution a.dm-heading');
  assert.equal(headings[0]!.hidden, true, 'a heading that does not match is hidden');
  assert.equal(headings[1]!.hidden, false, 'the matching heading is shown');
  assert.equal(
    view.querySelector<HTMLElement>('#dm-headings-01-constitution')!.hidden, false,
    'and its chapter is unfolded by the search',
  );

  search.value = 'nothing here matches';
  search.dispatchEvent(new dom.window.Event('input'));
  assert.equal(view.querySelector<HTMLElement>('.dm-none')!.hidden, false, 'an empty result says so');
  // A rail with nothing in it is a dead end: whatever the answer, the reader can
  // still reach another chapter from here.
  assert.equal(sectionOf('02-records').hidden, false, 'and every chapter is still reachable');

  // Cleared, the rail returns to its resting shape.
  search.value = '';
  search.dispatchEvent(new dom.window.Event('input'));
  assert.equal(sectionOf('02-records').hidden, false, 'every chapter is back');
  assert.equal(
    view.querySelector<HTMLElement>('#dm-headings-01-constitution')!.hidden, true,
    'and no chapter is open, because none was asked for',
  );

  view.remove();
});

test('the search reaches the open chapter\'s passages', async () => {
  stubFetch(FULL_SITE);
  const view = freshView();

  await mountDocumentModel(view, host, '01-constitution', '');

  const search = view.querySelector<HTMLInputElement>('.dm-search-input')!;
  const band = view.querySelector<HTMLElement>('.dm-band-passages')!;
  assert.equal(band.hidden, true, 'no search, no passage band');

  search.value = 'timelines';
  search.dispatchEvent(new dom.window.Event('input'));
  assert.equal(band.hidden, false, 'a word from the prose opens the band');
  const hits = view.querySelectorAll<HTMLButtonElement>('.dm-passages .dm-passage');
  assert.equal(hits.length, 1, 'one passage carries the word');
  assert.match(hits[0]!.textContent || '', /Operations are fundamental/);

  hits[0]!.click();
  assert.ok(
    view.querySelector('.dm-content article.docs-content .dm-hit'),
    'pressing a passage marks it in the chapter',
  );

  search.value = '';
  search.dispatchEvent(new dom.window.Event('input'));
  assert.equal(band.hidden, true, 'clearing the search closes the band again');

  view.remove();
});

test('a ?h= deep link marks its heading in the chapter and in the rail', async () => {
  stubFetch(FULL_SITE);
  const view = freshView();

  // scrollIntoView has no layout in jsdom and is wrapped in try/catch; the mount
  // must not throw, and the mark is what proves the link was followed.
  await mountDocumentModel(view, host, '01-constitution', 'h=invariants');

  const target = view.querySelector('.dm-content article.docs-content #invariants');
  assert.ok(target, 'the deep-link heading is in the rehosted chapter');
  assert.ok(target!.classList.contains('dm-target'), 'and it is marked as the one asked for');

  const railHit = view.querySelector('.dm-nav a.dm-heading.dm-heading--current');
  assert.ok(railHit, 'the rail marks the same heading');
  assert.equal(railHit!.textContent, 'The thirteen invariants');

  view.remove();
});

test('a missing chapter and a missing index each render a status message', async () => {
  stubFetch(FULL_SITE);
  const view = freshView();

  await mountDocumentModel(view, host, '99-not-a-chapter', '');
  let status = view.querySelector('.dm-status');
  assert.ok(status, 'an unknown chapter shows a status message');
  assert.match(status!.textContent || '', /could not be found/i);
  assert.equal(view.querySelector('article.docs-content'), null, 'and mounts no chapter');
  assert.ok(view.querySelectorAll('.dm-nav .dm-sec').length, 'while the rail still lists the chapters');
  view.remove();

  // A chapter the index names but the build did not write: the index answers,
  // the page 404s, and the view says which failure it was.
  stubFetch({ [INDEX_URL]: { ok: true, json: INDEX } });
  const missingPage = freshView();
  await mountDocumentModel(missingPage, host, '02-records', '');
  assert.match(missingPage.querySelector('.dm-status')!.textContent || '', /could not be found/i);
  missingPage.remove();

  // No index at all: the specification has not been built into this tree.
  stubFetch({});
  const noIndex = freshView();
  await mountDocumentModel(noIndex, host, '01-constitution', '');
  status = noIndex.querySelector('.dm-status');
  assert.ok(status, 'a missing index shows a status message');
  assert.match(status!.textContent || '', /not available in the app yet/i);
  assert.equal(noIndex.querySelector('.dm-nav .dm-sec'), null, 'and there is no rail to build');
  noIndex.remove();
});

test('readSpecIndex keeps well-formed rows and drops the rest', () => {
  assert.equal(readSpecIndex(null), null, 'nothing is not an index');
  assert.equal(readSpecIndex({ chapters: [] }), null, 'an index with no chapters is no index');
  assert.equal(readSpecIndex({ chapters: 'no' }), null, 'chapters must be a list');

  const read = readSpecIndex({
    version: 'draft-2026-09-24',
    chapters: [
      { slug: 'ok', title: 'Fine', headings: [{ id: 'a', text: 'A', level: 2 }, { id: 'b', text: 'B', level: 4 }] },
      { slug: '', title: 'No slug' },
      { title: 'No slug at all' },
      { slug: 'no-headings', title: 'Still fine' },
    ],
  });
  assert.ok(read, 'the well-formed rows survive');
  assert.deepEqual(read!.chapters.map((c) => c.slug), ['ok', 'no-headings'], 'a row with no slug is dropped');
  assert.deepEqual(read!.chapters[0]!.headings.map((h) => h.id), ['a'], 'a heading below h2 or h3 is dropped');
  assert.deepEqual(read!.chapters[1]!.headings, [], 'a chapter with no headings reads as an empty list');
  assert.equal(read!.updatedAt, '', 'a missing date reads as empty, never as a guess');
});

test('main.ts imports the specification browser lazily, on its own route', () => {
  const main = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../main.ts'), 'utf8');
  assert.match(main, /case 'document-model':/, 'the route has a mount case');
  assert.match(
    main, /await import\('\.\/views\/document-model\.ts'\)/,
    'and the view is reached by a dynamic import, so it stays off the cold-load bundle',
  );
  assert.doesNotMatch(
    main, /^import[^\n]*from '\.\/views\/document-model\.ts';/m,
    'nothing pulls the view in statically',
  );
  assert.match(
    main, /parts\[0\] === 'document-model'/,
    'and #/document-model parses to that route',
  );
});
