// SPDX-License-Identifier: MPL-2.0
/**
 * Docs search-index contract.
 *
 * `docs/build.ts` builds the index from each page's RENDERED HTML precisely so the
 * anchors it emits are ids that exist on the page. That is a claim about two pieces
 * of code agreeing, and the failure mode is silent: a result still looks right in
 * the dropdown and simply lands at the top of the page instead of the section. So
 * the agreement is asserted here against the shipped artifacts.
 *
 * Tests the BUILT site (`shells/web/public/info/`), which is what actually ships and
 * is committed, rather than importing build.ts - that module self-executes a full
 * 27-locale build on import and exports nothing.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const INFO = fileURLToPath(new URL('../shells/web/public/info/', import.meta.url));

interface Record_ { p: string; t: string; h: string; a: string; x: string }

/** English, a CJK locale, and an RTL locale - the three anchor-derivation paths. */
const LOCALES = ['en', 'zh', 'ar'];

const dirFor = (lang: string) => (lang === 'en' ? INFO : resolve(INFO, lang));
const indexFor = (lang: string): Record_[] =>
  JSON.parse(readFileSync(resolve(dirFor(lang), 'search-index.json'), 'utf-8')) as Record_[];

/** A regular page ships as <slug>.html; a generated side-door page carries a
 *  directory slug (formats/svg, convert/png-to-jpg) and ships as
 *  <slug>/index.html. The index records both kinds since the side doors joined it. */
const pageFile = (lang: string, slug: string) => {
  const flat = resolve(dirFor(lang), `${slug}.html`);
  return existsSync(flat) ? flat : resolve(dirFor(lang), slug, 'index.html');
};

// The index (search-index.json) is COMMITTED, but the rendered pages it is
// validated against are build products (public/info/*.html is gitignored) - so
// gating on the index alone passes in every fresh checkout and then fails on
// the absent pages. A page file must be present too before this suite can
// judge agreement between the two.
const built = existsSync(resolve(INFO, 'search-index.json')) && existsSync(resolve(INFO, 'index.html'));

describe('docs search index', { skip: built ? false : 'run `npm run build:info` first' }, () => {
  for (const lang of LOCALES) {
    describe(lang, () => {
      test('has records covering many pages', () => {
        const records = indexFor(lang);
        assert.ok(records.length > 100, `${lang}: only ${records.length} records`);
        assert.ok(new Set(records.map((r) => r.p)).size > 20, `${lang}: too few pages indexed`);
      });

      test('every record points at a page that exists', () => {
        const missing = new Set<string>();
        for (const r of indexFor(lang)) {
          if (!existsSync(pageFile(lang, r.p))) missing.add(r.p);
        }
        assert.deepEqual([...missing], [], `${lang}: records reference missing pages`);
      });

      test('every anchor exists as an id on its page', () => {
        const pages = new Map<string, string>();
        const broken: string[] = [];
        for (const r of indexFor(lang)) {
          if (!r.a) continue;   // the page-intro record deliberately has no anchor
          let html = pages.get(r.p);
          if (html === undefined) {
            html = readFileSync(pageFile(lang, r.p), 'utf-8');
            pages.set(r.p, html);
          }
          if (!html.includes(`id="${r.a}"`)) broken.push(`${r.p}#${r.a}`);
        }
        assert.deepEqual(broken, [], `${lang}: anchors with no matching id`);
      });

      test('entities are decoded, not carried through raw', () => {
        // The one signal that can't false-positive on this corpus. "No angle
        // brackets" cannot be asserted: the docs teach HTML, so authoring-tools
        // legitimately indexes `<div class="my-tool">` as prose. A surviving
        // `&amp;` on the other hand is always a decode bug.
        const raw = indexFor(lang)
          .filter((r) => /&(amp|lt|gt|quot|nbsp|#39);/i.test(r.h + r.x))
          .slice(0, 5)
          .map((r) => `${r.p}#${r.a}`);
        assert.deepEqual(raw, [], `${lang}: undecoded HTML entities in the index`);
      });

      test('text is collapsed onto one line', () => {
        const ragged = indexFor(lang)
          .filter((r) => /[\n\r\t]|\s{2,}/.test(r.h + r.x))
          .slice(0, 5)
          .map((r) => `${r.p}#${r.a}`);
        assert.deepEqual(ragged, [], `${lang}: uncollapsed whitespace in the index`);
      });

      test('no record is entirely empty', () => {
        const empty = indexFor(lang).filter((r) => !r.h && !r.x).map((r) => r.p);
        assert.deepEqual(empty, [], `${lang}: records with neither heading nor text`);
      });
    });
  }

  test('a heading that strips to nothing still gets a usable anchor', () => {
    // Every non-Latin heading used to render id="" - the same empty id on every
    // heading of the page - because the slug character class is [a-z0-9]. The
    // positional fallback is what makes a deep link into a translated page work.
    const zh = indexFor('zh').filter((r) => r.a.startsWith('section-'));
    assert.ok(zh.length > 20, `expected positional anchors in zh, got ${zh.length}`);
    const html = readFileSync(resolve(dirFor('zh'), `${zh[0]!.p}.html`), 'utf-8');
    assert.ok(!html.includes('id=""'), 'no heading may ship an empty id');
  });

  test('the index stays small enough to fetch on first keystroke', () => {
    // Fetched lazily, once, only when someone actually searches - but it is still
    // a blocking wait before the first result, so the ceiling is deliberate.
    for (const lang of LOCALES) {
      const bytes = readFileSync(resolve(dirFor(lang), 'search-index.json')).byteLength;
      assert.ok(bytes < 400_000, `${lang}: index is ${Math.round(bytes / 1024)} KB — trim SEARCH_SNIPPET_MAX`);
    }
  });
});
