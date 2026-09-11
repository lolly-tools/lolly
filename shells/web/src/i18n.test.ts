// SPDX-License-Identifier: MPL-2.0
// Unit tests for i18n.ts's persist-time URL handling (and the RTL dir stamp).
//
// A `lang` URL override is session-only and out-ranks the saved preference in
// initI18n's precedence chain - so an explicit picker choice must strip it from
// the address bar (both places peekUrlLang reads: the search string and the
// hash query), or the switch appears not to stick on any ?lang= link.
//
// i18n.ts only touches window/document/localStorage inside functions, so plain
// object stubs installed before the dynamic import are enough - no jsdom. The
// 'en' switch is used for the strip cases because it skips the locale-chunk
// dynamic import entirely; the 'ar' case relies on that import's .catch(() =>
// ({default:{}})) fallback (node can't import .json without attributes), which
// still exercises the <html dir> stamp.
import test from 'node:test';
import assert from 'node:assert/strict';

const replaceCalls: string[] = [];
const win = {
  location: new URL('http://lolly.test/'),
  history: { state: null, replaceState: (_s: unknown, _t: string, next: string) => { replaceCalls.push(next); } },
};
globalThis.window = win as unknown as typeof globalThis.window;
globalThis.history = win.history as unknown as History; // i18n.ts uses the bare `history` global
globalThis.document = { documentElement: { lang: '', dir: '' } } as unknown as Document;
globalThis.localStorage = { getItem: () => null, setItem: () => {} } as unknown as Storage;

const { setActiveLang, t, tRaw } = await import('./i18n.ts');

// ── t() / tRaw() param escaping (SUSE assessment 2026-08, S5) ─────────────────
// t()'s result is routinely assigned to innerHTML, so param escaping must be the
// DEFAULT rather than a thing each caller remembers. tRaw() keeps the old
// behaviour for text sinks and markup params. The catalog string stays raw in
// both - locale files carry markup on purpose (docs/threat-model.md).

test('t() HTML-escapes interpolated params', () => {
  assert.equal(
    t('Checking {name}', { name: '<img src=x onerror=alert(1)>' }),
    'Checking &lt;img src=x onerror=alert(1)&gt;',
  );
  assert.equal(t('Hi {who}', { who: `O'Brien & Sons` }), 'Hi O&#39;Brien &amp; Sons');
});

test('t() escapes every occurrence of a repeated param', () => {
  assert.equal(t('{x} and {x}', { x: '<b>' }), '&lt;b&gt; and &lt;b&gt;');
});

test('t() leaves numeric params alone (escaping is a no-op there)', () => {
  assert.equal(t('{n} items', { n: 12 }), '12 items');
});

test('tRaw() does NOT escape params - the text-sink / markup escape hatch', () => {
  assert.equal(tRaw('Hi {who}', { who: `O'Brien` }), `Hi O'Brien`);
  assert.equal(tRaw('go {link}', { link: '<a href="#">x</a>' }), 'go <a href="#">x</a>');
});

test('the catalog source string itself is never escaped by either function', () => {
  // Translations intentionally contain markup; escaping the catalog value would
  // render those tags as visible text. Only PARAMS are escaped.
  assert.equal(t('Up to <strong>{n}</strong> free', { n: 3 }), 'Up to <strong>3</strong> free');
  assert.equal(tRaw('Up to <strong>{n}</strong> free', { n: 3 }), 'Up to <strong>3</strong> free');
});

test('t() and tRaw() agree when there are no params at all', () => {
  assert.equal(t('Save Profile'), tRaw('Save Profile'));
  assert.equal(t('Save Profile'), 'Save Profile');
});

async function stripped(url: string): Promise<string | null> {
  win.location = new URL(url);
  replaceCalls.length = 0;
  await setActiveLang('en', { persist: true });
  return replaceCalls[0] ?? null;
}

test('persist strips a search-string lang override', async () => {
  assert.equal(await stripped('http://lolly.test/?lang=de#/p'), '/#/p');
});

test('persist strips a hash-query lang override', async () => {
  assert.equal(await stripped('http://lolly.test/#/p?lang=de'), '/#/p');
});

test('persist strips lang from both places at once', async () => {
  assert.equal(await stripped('http://lolly.test/?lang=de#/p?lang=de'), '/#/p');
});

test('other params ride through byte-identical (compact URL-mode encodings)', async () => {
  assert.equal(
    await stripped('http://lolly.test/?a=1&lang=de&b=2#/tool/qr-code?url=https%3A%2F%2Fs.com&lang=de&color=ff0~00'),
    '/?a=1&b=2#/tool/qr-code?url=https%3A%2F%2Fs.com&color=ff0~00',
  );
});

test('a bare valueless ?lang is stripped too', async () => {
  assert.equal(await stripped('http://lolly.test/?lang#/p'), '/#/p');
});

test('params merely ending in "lang" are not false-positives', async () => {
  assert.equal(await stripped('http://lolly.test/?slang=de#/p?golang=1'), null);
});

test('no lang override ⇒ no history rewrite at all', async () => {
  assert.equal(await stripped('http://lolly.test/#/p'), null);
});

test('non-persist switches never touch the URL', async () => {
  win.location = new URL('http://lolly.test/?lang=de#/p');
  replaceCalls.length = 0;
  await setActiveLang('en', { persist: false });
  assert.equal(replaceCalls.length, 0);
});

test('<html dir> stamps rtl for Arabic and restores ltr on the way back', async () => {
  const doc = document.documentElement;
  await setActiveLang('ar', { persist: false }); // catalog import fails under node - caught, empty catalog
  assert.equal(doc.lang, 'ar');
  assert.equal(doc.dir, 'rtl');
  await setActiveLang('de', { persist: false });
  assert.equal(doc.dir, 'ltr');
});
