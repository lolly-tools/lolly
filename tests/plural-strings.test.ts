// SPDX-License-Identifier: MPL-2.0
/**
 * Plural UI strings: the extractor, English output and the no-regression guarantee.
 *
 * `tn('1 file', '{n} files', { n })` declares both English forms in source. These checks
 * read the real web shell and the real catalogs:
 *   - the extractor sees tn()/tnRaw() calls in either quote style and puts the `other`
 *     form (the catalog key) and the `one` form in the spa corpus;
 *   - English output for every migrated string is what the ternary it replaced produced;
 *   - until the translation pass is merged, no locale reads worse than before the migration.
 * Selection from hand-written ru/pl/ar fixtures lives in shells/web/src/lib/plural.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSpaKeys, extractSpaPluralSources, scanPluralSources } from '../scripts/translate.ts';
import { uiLiterals } from '../scripts/check-ui-copy-vernacular.ts';
import { selectPluralTemplate } from '../shells/web/src/lib/plural.ts';
import type { CatalogValue } from '../shells/web/src/lib/plural.ts';
import { LANG_META, LANGS } from '../engine/src/lang.ts';

// i18n.ts touches window/document/localStorage only inside functions; stubs keep the import clean.
globalThis.window = { location: new URL('http://lolly.test/'), history: { state: null, replaceState: () => {} } } as unknown as typeof globalThis.window;
globalThis.document = { documentElement: { lang: '', dir: '' } } as unknown as Document;
globalThis.localStorage = { getItem: () => null, setItem: () => {} } as unknown as Storage;
const { tn, tnRaw } = await import('../shells/web/src/i18n.ts');

const LOCALES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'shells', 'web', 'src', 'locales');
const sources = extractSpaPluralSources();
const fill = (template: string, n: number): string => template.replaceAll('{n}', String(n)).replaceAll('{count}', String(n)).replaceAll('{total}', String(n));
const paramName = (other: string): string => /\{(n|count|total)\}/.exec(other)?.[1] ?? 'n';

test('the extractor reads tn() and tnRaw() in both quote styles', () => {
  const found = scanPluralSources(`
    a(tn('1 file', '{n} files', { n }));
    b(tnRaw("1 file's size", "{n} files' size", { n }));
    c(tn('one', "other {count}", { count }));
    d(xtn('x', 'y'), obj.tn('x', 'y'), t('1 file'), tn(variable, '{n} z'));
  `);
  assert.deepEqual(found, [
    { one: '1 file', other: '{n} files' },
    { one: "1 file's size", other: "{n} files' size" },
    { one: 'one', other: 'other {count}' },
  ]);
});

test('the corpus carries every plural key and its singular companion', () => {
  assert.ok(sources.length >= 40 && sources.length <= 100, `${sources.length} plural keys; the first pass migrates about 40 to 80`);
  const corpus = new Set(extractSpaKeys());
  for (const { one, other } of sources) {
    assert.ok(corpus.has(other), `${other} (the catalog key) is not in the corpus`);
    assert.ok(corpus.has(one), `${one} (singular companion) is not in the corpus`);
  }
});

test('the vernacular scan sees both English forms of a plural call', () => {
  assert.deepEqual(uiLiterals(`tn('1 file', '{n} files', { n }); t('Save');`), ['Save', '1 file', '{n} files']);
});

test('every plural call has a count placeholder in its other form and a sane singular', () => {
  for (const { one, other } of sources) {
    assert.match(other, /\{(n|count|total)\}/, `${other}: the other form carries no count placeholder`);
    assert.ok(one === other || !/\{(n|count|total)\}/.test(one) || one.startsWith('{'), `${one}: the singular form should be the literal 1, or the same as other`);
  }
});

test('English output is exactly what the replaced ternaries produced', () => {
  // Before the migration each site was `n === 1 ? t(one) : t(other, { n })`. English has no
  // catalog, so tn() must give `one` for 1 and `other` with the number for everything else.
  for (const { one, other } of sources) {
    const key = paramName(other);
    for (const n of [0, 1, 2, 3, 5, 11, 12, 21, 22, 100, 101, 1000]) {
      const want = n === 1 ? one : fill(other, n);
      assert.equal(tnRaw(one, other, { [key]: n }), fill(want, n), `${JSON.stringify(other)} at ${n}`);
      assert.equal(tn(one, other, { [key]: String(n) }), fill(want, n), `${JSON.stringify(other)} at "${n}"`);
    }
  }
});

test('tn escapes params like t, tnRaw does not', () => {
  assert.equal(tn('{n} of <b>', '{n} of {who}', { n: 2, who: '<i>' }), '2 of &lt;i&gt;');
  assert.equal(tnRaw('{n} of <b>', '{n} of {who}', { n: 2, who: '<i>' }), '2 of <i>');
});

test('every singular form was already a catalog key, so no locale loses a translation', () => {
  const english = new Set<string>();
  for (const f of readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json'))) {
    for (const k of Object.keys(JSON.parse(readFileSync(join(LOCALES_DIR, f), 'utf8')))) english.add(k);
  }
  const invented = sources.filter(({ one, other }) => one !== other && !english.has(one));
  assert.deepEqual(invented.map(s => s.one), [], 'a singular English form no catalog has; it would ship untranslated');
});

test('until the translation pass, no locale reads worse than before the migration', () => {
  // Before: `n === 1 ? t(one) : t(other, { n })`, each looked up in the locale's catalog.
  // After: selectPluralTemplate with the same two catalog values. They must agree for every
  // count, in every locale, while the catalog values are still plain strings.
  let checked = 0;
  for (const lang of LANGS) {
    if (lang === 'en') continue;
    const cat = JSON.parse(readFileSync(join(LOCALES_DIR, `${lang}.json`), 'utf8')) as Record<string, CatalogValue>;
    const locale = LANG_META[lang].htmlLang;
    for (const { one, other } of sources) {
      const entry = cat[other], legacy = cat[one];
      if (typeof entry !== 'string') continue; // forms object: the translation pass is merged for this key
      for (let n = 0; n <= 30; n++) {
        const before = n === 1 ? (typeof legacy === 'string' ? legacy : one) : entry;
        const after = selectPluralTemplate({ one, other, entry, legacyOne: legacy, n, locale });
        assert.equal(fill(after, n), fill(before, n), `${lang} ${JSON.stringify(other)} at ${n}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 10000, `only ${checked} comparisons; the loop is not reaching the catalogs`);
});
