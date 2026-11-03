// SPDX-License-Identifier: MPL-2.0
/**
 * Writes the plural translation work file: every tn()/tnRaw() key in the web shell,
 * its English forms, and for each of the 26 locales the CLDR categories that locale
 * needs (from Intl.PluralRules) plus the single translation it carries today.
 *
 *   node scripts/plural-work.ts [out.json]
 *
 * Default output: plans/plural-strings/translation-work.json (plans/ is gitignored).
 * The translation pass fills `locales[lang].forms` for each key and merges the result
 * into shells/web/src/locales/<lang>.json as a forms object under the `other` key.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSpaPluralSources } from './translate.ts';
import { LANGS, LANG_META } from '../engine/src/lang.ts';
import { pluralCategoriesFor, pluralCategory } from '../shells/web/src/lib/plural.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? join(ROOT, 'plans', 'plural-strings', 'translation-work.json');

type Cat = Record<string, string | Record<string, string>>;
const catalogs = new Map<string, Cat>();
for (const lang of LANGS) {
  if (lang === 'en') continue;
  const path = join(ROOT, 'shells', 'web', 'src', 'locales', `${lang}.json`);
  catalogs.set(lang, existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as Cat : {});
}

const locales: Record<string, { htmlLang: string; categories: string[]; examples: Record<string, number[]> }> = {};
for (const lang of LANGS) {
  if (lang === 'en') continue;
  const htmlLang = LANG_META[lang].htmlLang;
  const categories = pluralCategoriesFor(htmlLang);
  const examples: Record<string, number[]> = Object.fromEntries(categories.map(c => [c, [] as number[]]));
  for (let n = 0; n <= 200; n++) { const list = examples[pluralCategory(htmlLang, n)]; if (list && list.length < 8) list.push(n); }
  const fraction = examples.other;
  if (fraction) fraction.push(1.5);
  locales[lang] = { htmlLang, categories, examples };
}

const keys = extractSpaPluralSources().map(({ one, other }) => ({
  key: other,
  en: { one, other },
  locales: Object.fromEntries(Object.entries(locales).map(([lang, meta]) => {
    const cat = catalogs.get(lang)!;
    return [lang, {
      categories: meta.categories,
      existing: { other: cat[other] ?? null, one: cat[one] ?? null },
      forms: null,
    }];
  })),
}));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({
  note: 'Fill locales[lang].forms for each key with one string per listed category. Keep every {placeholder} the English other form has; a form for a category that selects only the number 1 may drop {n}. Translate for the audience of the language, not word for word.',
  locales,
  keys,
}, null, 2) + '\n');
console.log(`${keys.length} plural keys x ${Object.keys(locales).length} locales -> ${out}`);
