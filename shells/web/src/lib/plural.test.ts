// SPDX-License-Identifier: MPL-2.0
// Plural selection from a small hand-written fixture catalog (not the real locales).
//
// The fixtures spell out the CLDR rules the platform's Intl.PluralRules applies, so a
// wrong category table in any engine, or a regression in the selection order, fails
// here with the exact language and count in the message.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isPluralForms, pluralCategoriesFor, pluralCategory, pluralCount, selectPluralTemplate } from './plural.ts';
import type { CatalogValue } from './plural.ts';

const ONE = '1 file';
const OTHER = '{n} files';

const fixtures: Record<string, CatalogValue> = {
  ru: { one: '{n} файл', few: '{n} файла', many: '{n} файлов', other: '{n} файла' },
  pl: { one: '{n} plik', few: '{n} pliki', many: '{n} plików', other: '{n} pliku' },
  ar: { zero: 'لا ملفات', one: 'ملف واحد', two: 'ملفان', few: '{n} ملفات', many: '{n} ملفًا', other: '{n} ملف' },
};

const NONE = Symbol('no catalog entry');
const render = (locale: string, n: number, given: CatalogValue | typeof NONE = fixtures[locale]!, legacyOne?: string): string =>
  selectPluralTemplate({ one: ONE, other: OTHER, entry: given === NONE ? undefined : given, legacyOne, n, locale }).replaceAll('{n}', String(n));

test('ru renders 1, 2, 5 and 21 with the right form', () => {
  assert.equal(render('ru', 1), '1 файл');
  assert.equal(render('ru', 2), '2 файла');
  assert.equal(render('ru', 5), '5 файлов');
  assert.equal(render('ru', 21), '21 файл');
});

test('pl renders 1, 2, 5 and 21 with the right form', () => {
  assert.equal(render('pl', 1), '1 plik');
  assert.equal(render('pl', 2), '2 pliki');
  assert.equal(render('pl', 5), '5 plików');
  assert.equal(render('pl', 21), '21 plików');
});

test('ar renders 1, 2, 5 and 21 with the right form', () => {
  assert.equal(render('ar', 1), 'ملف واحد');
  assert.equal(render('ar', 2), 'ملفان');
  assert.equal(render('ar', 5), '5 ملفات');
  assert.equal(render('ar', 21), '21 ملفًا');
  assert.equal(render('ar', 0), 'لا ملفات');
});

test('the categories the fixtures rely on are the ones the platform reports', () => {
  assert.deepEqual(pluralCategoriesFor('ru'), ['one', 'few', 'many', 'other']);
  assert.deepEqual(pluralCategoriesFor('pl'), ['one', 'few', 'many', 'other']);
  assert.deepEqual(pluralCategoriesFor('ar'), ['zero', 'one', 'two', 'few', 'many', 'other']);
  assert.deepEqual(pluralCategoriesFor('ja'), ['other']);
  assert.deepEqual(pluralCategoriesFor('en'), ['one', 'other']);
  for (const [locale, forms] of Object.entries(fixtures)) {
    assert.deepEqual(Object.keys(forms as object).sort(), [...pluralCategoriesFor(locale)].sort(), `${locale} fixture covers exactly its categories`);
  }
});

test('English forms are chosen by English rules when there is no translation', () => {
  assert.equal(render('en', 1, NONE), '1 file');
  assert.equal(render('en', 0, NONE), '0 files');
  assert.equal(render('en', 2, NONE), '2 files');
  assert.equal(render('en', 21, NONE), '21 files');
  // An untranslated locale shows English, so the English rule applies, not the locale's.
  assert.equal(render('ru', 21, NONE), '21 files');
});

test('a plain string translation is used for every category, so a locale never regresses', () => {
  for (const n of [0, 1, 2, 5, 21, 100]) {
    assert.equal(render('ru', n, '{n} файлов'), `${n} файлов`);
  }
});

test('a count of exactly 1 prefers the singular translation a locale already had', () => {
  assert.equal(render('ru', 1, '{n} файлов', '1 файл'), '1 файл');
  assert.equal(render('ru', 21, '{n} файлов', '1 файл'), '21 файлов');
  assert.equal(render('ru', 1, NONE, '1 файл'), '1 файл');
  // Once a forms object exists it owns every count, including 1.
  assert.equal(render('ru', 1, fixtures.ru, '1 файл!'), '1 файл');
});

test('a forms object missing a category falls back to its other form, then to English', () => {
  assert.equal(render('ru', 5, { other: '{n} шт.' }), '5 шт.');
  assert.equal(render('ru', 5, {}), '5 files');
});

test('pluralCount reads n, then count, then total', () => {
  assert.equal(pluralCount({ n: 3, count: 9 }), 3);
  assert.equal(pluralCount({ count: '4' }), 4);
  assert.equal(pluralCount({ total: 7, name: 'x' }), 7);
  assert.equal(pluralCount({ name: 'x' }), undefined);
  assert.equal(pluralCount(undefined), undefined);
  assert.equal(pluralCount({ n: 'many' }), undefined);
});

test('isPluralForms tells forms objects from strings', () => {
  assert.equal(isPluralForms({ one: 'a', other: 'b' }), true);
  assert.equal(isPluralForms('a'), false);
  assert.equal(isPluralForms(undefined), false);
  assert.equal(isPluralForms(null), false);
});

test('pluralCategory follows the locale', () => {
  assert.equal(pluralCategory('ru', 21), 'one');
  assert.equal(pluralCategory('ru', 11), 'many');
  assert.equal(pluralCategory('zh-Hant', 1), 'other');
});
