// SPDX-License-Identifier: MPL-2.0
/**
 * The Docs spotlight provider (plans/99 M3) - lazy fetch of the /info
 * search index, lib/search scoring, sidebar-identical hrefs.
 *
 * Run directly:  node --test shells/web/src/lib/search/providers/docs.test.ts
 *
 * What these pin: nothing is fetched until the first search; the record shape
 * ({p,t,h,a,x} - docs/build.ts indexSections) parses into hits whose href is the
 * IN-APP reader route (#/docs/<slug>, the heading anchor carried as ?h=<anchor>,
 * omitted for the page-intro record); the heading>title>body weight ladder orders
 * results; the locale still selects the fetched index (/info/<lang>/search-index)
 * though the in-app href drops the lang prefix; any fetch failure resolves to []
 * forever (offline is normal, never an error); the limit caps, best score first.
 *
 * fetch is stubbed globally - the provider is the only fetcher in this suite, and the
 * stub records every URL so laziness and the cached-failure invariants are
 * observable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// jsdom globals BEFORE the dynamic imports (the i18n module writes <html lang>
// on a language switch).
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

// ── fetch stub ───────────────────────────────────────────────────────────────
type FetchImpl = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
const fetchCalls: string[] = [];
let fetchImpl: FetchImpl = async () => ({ ok: true, json: async () => [] });
globalThis.fetch = ((url: string) => {
  fetchCalls.push(String(url));
  return fetchImpl(String(url));
}) as unknown as typeof fetch;

const { createDocsProvider } = await import('./docs.ts');
const { tokenize } = await import('../match.ts');
const { icon } = await import('../../icons.ts');
const { setActiveLang } = await import('../../../i18n.ts');

/** Fixture - the exact record shape docs/build.ts's indexSections writes. */
const RECORDS = [
  // The page-intro record: no heading, no anchor.
  { p: 'url-mode', t: 'URL mode', h: '', a: '', x: 'every input is expressible as URL params' },
  // A section record.
  { p: 'authoring-tools', t: 'Authoring tools', h: 'Declaring inputs', a: 'declaring-inputs', x: 'inputs live in the manifest' },
  // The weight-ladder trio: 'colour' in a heading, a title and a body.
  { p: 'colour-heading', t: 'Alpha', h: 'Colour maths', a: 'colour-maths', x: 'plain prose' },
  { p: 'colour-title', t: 'Colour Lab', h: 'Panels', a: 'panels', x: 'plain prose' },
  { p: 'colour-body', t: 'Gamma', h: 'Extras', a: 'extras', x: 'notes about colour here' },
  // Diacritics in the source - fold() must let "creme" find it.
  { p: 'recipes', t: 'Recipes', h: 'Crème brûlée', a: 'creme-brulee', x: '' },
];

const serveRecords = (): void => {
  fetchImpl = async () => ({ ok: true, json: async () => RECORDS });
};

test('lazy: creating the provider fetches nothing; empty tokens fetch nothing', async () => {
  serveRecords();
  const provider = createDocsProvider();
  assert.equal(fetchCalls.length, 0);
  assert.deepEqual(await provider.search([], 5), []);
  assert.equal(fetchCalls.length, 0, 'an empty query must not trigger the index fetch');
});

test('parses the record shape and builds in-app reader hrefs', async () => {
  serveRecords();
  fetchCalls.length = 0;
  const provider = createDocsProvider();

  // A section hit: heading leads, page title is the subtitle, anchor rides ?h=.
  const section = await provider.search(tokenize('declaring'), 5);
  assert.equal(section.length, 1);
  assert.equal(section[0]!.title, 'Declaring inputs');
  assert.equal(section[0]!.subtitle, 'Authoring tools');
  assert.equal(section[0]!.href, '#/docs/authoring-tools?h=declaring-inputs');
  assert.ok(section[0]!.icon.includes('<svg'), 'rows carry the help glyph');

  // The page-intro hit: page title leads, no subtitle repeating it, no anchor.
  const intro = await provider.search(tokenize('expressible'), 5);
  assert.equal(intro.length, 1);
  assert.equal(intro[0]!.title, 'URL mode');
  assert.equal(intro[0]!.subtitle, undefined);
  assert.equal(intro[0]!.href, '#/docs/url-mode');

  // One fetch served both searches - the index promise is cached.
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0], '/info/search-index.json');
});

test('per-page icon: the record sidebar-icon key selects the row glyph', async () => {
  fetchImpl = async () => ({ ok: true, json: async () => [
    { p: 'a', t: 'A', h: 'One', a: 'one', x: 'zzz', i: 'convert' },
    { p: 'b', t: 'B', h: 'Two', a: 'two', x: 'zzz', i: 'usercheck' },
    { p: 'c', t: 'C', h: 'Three', a: 'three', x: 'zzz' }, // no i → neutral fallback
  ] });
  const prov = createDocsProvider();
  const convertHit = (await prov.search(tokenize('one'), 5))[0]!;
  const userHit = (await prov.search(tokenize('two'), 5))[0]!;
  const fallbackHit = (await prov.search(tokenize('three'), 5))[0]!;
  assert.equal(convertHit.icon, icon('convert'));
  assert.equal(userHit.icon, icon('userCheck')); // 'usercheck' → shell's userCheck
  assert.equal(fallbackHit.icon, icon('document'));
  assert.notEqual(convertHit.icon, userHit.icon); // distinguishable - the whole point
});

test('weight ladder: heading beats page title beats body, and the limit caps best-first', async () => {
  serveRecords();
  const provider = createDocsProvider();
  const hits = await provider.search(tokenize('colour'), 5);
  assert.deepEqual(hits.map((h) => h.title), ['Colour maths', 'Panels', 'Extras']);
  assert.ok(hits[0]!.score > hits[1]!.score && hits[1]!.score > hits[2]!.score);
  // limit slices AFTER the sort - the best survive.
  const capped = await provider.search(tokenize('colour'), 2);
  assert.deepEqual(capped.map((h) => h.title), ['Colour maths', 'Panels']);
});

test('multi-word queries AND across the whole record; diacritics fold', async () => {
  serveRecords();
  const provider = createDocsProvider();
  // Both tokens hit the same record (heading + body) → one hit; a missing
  // token zeroes it.
  assert.equal((await provider.search(tokenize('colour maths'), 5)).length, 1);
  assert.equal((await provider.search(tokenize('colour nonexistent'), 5)).length, 0);
  // "creme" finds "Crème brûlée".
  const folded = await provider.search(tokenize('creme brulee'), 5);
  assert.equal(folded.length, 1);
  assert.equal(folded[0]!.href, '#/docs/recipes?h=creme-brulee');
});

test('locale base path: a non-English session fetches under /info/<lang>/ but links to the app route', async () => {
  serveRecords();
  await setActiveLang('fr'); // catalog load failure falls back to {} - fine here
  try {
    fetchCalls.length = 0;
    const provider = createDocsProvider();
    const hits = await provider.search(tokenize('declaring'), 5);
    assert.equal(fetchCalls[0], '/info/fr/search-index.json');
    // The in-app reader route drops the lang prefix - it renders in the app's
    // current locale (fr here), so the href is the same as an English session's.
    assert.equal(hits[0]!.href, '#/docs/authoring-tools?h=declaring-inputs');
  } finally {
    await setActiveLang('en');
  }
});

test('failure resolves [] forever - one fetch, no retry storm, nothing thrown', async () => {
  fetchImpl = async () => { throw new Error('offline'); };
  fetchCalls.length = 0;
  const provider = createDocsProvider();
  assert.deepEqual(await provider.search(tokenize('anything'), 5), []);
  assert.deepEqual(await provider.search(tokenize('anything else'), 5), []);
  assert.equal(fetchCalls.length, 1, 'the failed fetch is cached, not retried');
});

test('a non-ok response and a non-array body both resolve []', async () => {
  fetchImpl = async () => ({ ok: false, json: async () => RECORDS });
  assert.deepEqual(await createDocsProvider().search(tokenize('declaring'), 5), []);
  fetchImpl = async () => ({ ok: true, json: async () => ({ not: 'an array' }) });
  assert.deepEqual(await createDocsProvider().search(tokenize('declaring'), 5), []);
});
