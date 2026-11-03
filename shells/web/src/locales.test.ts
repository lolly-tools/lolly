// SPDX-License-Identifier: MPL-2.0
/**
 * Structural invariants for the 26 translated UI catalogs (src/locales/<lang>.json).
 *
 * Nothing checked these before. The catalogs are produced two ways - the machine
 * pipeline (scripts/translate.ts) and hand/agent waves writing through
 * scripts/i18n/overrides/ - and BOTH can silently break a string in ways that only
 * show up as a bug report from someone who doesn't read English:
 *
 *   - a dropped `{name}` placeholder renders "Welcome back, " with a blank where a
 *     person's name should be, or throws on a missing interpolation
 *   - an invented placeholder interpolates nothing and prints the braces literally
 *   - a translated product name ("Lolly" → "Piruleta") breaks recognition, and the
 *     glossary lists exactly which terms must survive
 *   - a key some catalogs carry and others do not renders English in the ones that lack
 *     it, and looks like nothing at all in a diff of any single file
 *
 * A catalog is keyed BY its English source string, so the English side of every
 * comparison is right there in the key - no separate source of truth to drift from.
 *
 * Deliberately NOT checked: whether the translation is any good. That is a human
 * judgement and this file makes no attempt at it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANG_META } from '../../../engine/src/lang.ts';
import type { Lang } from '../../../engine/src/lang.ts';
import { isPluralForms, pluralCategoriesFor } from './lib/plural.ts';
import type { CatalogValue } from './lib/plural.ts';
import { scanPluralSources } from '../../../scripts/translate.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(HERE, 'locales');
const GLOSSARY = join(HERE, '..', '..', '..', 'scripts', 'i18n', 'glossary.json');
/** The hand-listed half of the spa corpus - every key extractSpaKeys cannot scan for. */
const EXTRA_KEYS = join(HERE, '..', '..', '..', 'scripts', 'i18n', 'extra-keys.spa.json');

/** `{name}` / `{count}` - the interpolation form i18n.ts's t() understands. */
const PLACEHOLDER = /\{[a-zA-Z][\w.-]*\}/g;

const catalogs = readdirSync(LOCALES_DIR)
  .filter((f) => f.endsWith('.json') && f !== 'en.json')
  .map((f) => ({ lang: f.replace(/\.json$/, ''), path: join(LOCALES_DIR, f) }));

test('sanity: the locale catalogs were actually found', () => {
  assert.ok(catalogs.length >= 20, `only ${catalogs.length} catalogs - did locales/ move?`);
});

test('every translation carries the same placeholders as its English key', () => {
  const problems: string[] = [];
  let checked = 0;
  for (const { lang, path } of catalogs) {
    const cat = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
    for (const [en, tr] of Object.entries(cat)) {
      if (typeof tr !== 'string' || !tr) continue;
      const want = (en.match(PLACEHOLDER) ?? []).slice().sort();
      const got = (tr.match(PLACEHOLDER) ?? []).slice().sort();
      if (!want.length && !got.length) continue;
      checked++;
      // Multiset equality: a placeholder repeated in the source must repeat in the
      // translation, and word order between them is the translator's business.
      if (want.join('\u0000') !== got.join('\u0000')) {
        problems.push(`${lang}: ${JSON.stringify(en.slice(0, 60))}\n    expected ${want.join(' ') || '(none)'} but got ${got.join(' ') || '(none)'}`);
      }
    }
  }
  assert.ok(checked >= 100, `only ${checked} placeholder-bearing strings seen - the scan is not finding them`);
  assert.equal(problems.length, 0, `\nPlaceholder mismatch - these will render wrong or throw:\n${problems.slice(0, 30).join('\n')}\n${problems.length > 30 ? `…and ${problems.length - 30} more\n` : ''}`);
});

test('glossary neverTranslate terms survive translation', () => {
  const never: string[] = (JSON.parse(readFileSync(GLOSSARY, 'utf8')) as { neverTranslate: string[] }).neverTranslate;
  assert.ok(never.length >= 3, 'glossary.neverTranslate looks empty - has it moved?');

  const problems: string[] = [];
  let checked = 0;
  for (const { lang, path } of catalogs) {
    const cat = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
    for (const [en, tr] of Object.entries(cat)) {
      if (typeof tr !== 'string' || !tr) continue;
      for (const term of never) {
        // Only assert on terms the SOURCE actually contains, and count occurrences:
        // a term dropped entirely is the failure, not a case or spacing difference.
        const inEn = en.split(term).length - 1;
        if (!inEn) continue;
        checked++;
        const inTr = tr.split(term).length - 1;
        if (inTr < inEn) {
          problems.push(`${lang}: "${term}" appears ${inEn}x in the source but ${inTr}x in "${tr.slice(0, 60)}"`);
        }
      }
    }
  }
  assert.ok(checked >= 20, `only ${checked} neverTranslate occurrences seen - the scan is not finding them`);
  assert.equal(problems.length, 0, `\nA protected term was translated away:\n${problems.slice(0, 20).join('\n')}\n`);
});

test('every catalog carries exactly the same key set', () => {
  // The catalogs are generated per language from ONE corpus, so their key sets are the
  // same set by construction - writeCatalogFromCache walks the corpus keys and writes a
  // value for every one of them, falling back to English. A locale short of a key
  // therefore did not fail to translate it: it was never regenerated, and the string is
  // MISSING rather than untranslated.
  //
  // That is invisible at runtime - t() falls back to the English source either way - and
  // it is exactly how six locales (bg, no, pl, tr, uk, zh-hant) ended up with none of a
  // wave's eight new Share-dialog and Feature-flags strings while the other twenty had
  // all eight. The echo check below cannot see it (a missing key is not an echo), and the
  // placeholder and glossary checks only look at keys that ARE present.
  const sets = catalogs.map(({ lang, path }) => ({
    lang,
    keys: new Set(Object.keys(JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>)),
  }));
  const union = new Set(sets.flatMap((s) => [...s.keys]));
  assert.ok(union.size > 1000, `only ${union.size} keys across every catalog - did the corpus shrink?`);

  const problems: string[] = [];
  for (const { lang, keys } of sets) {
    const missing = [...union].filter((k) => !keys.has(k));
    if (missing.length) {
      problems.push(`${lang}: missing ${missing.length} key(s) other catalogs have, e.g. ${missing.slice(0, 3).map((k) => JSON.stringify(k.slice(0, 50))).join(', ')}`);
    }
  }
  assert.deepEqual(
    problems,
    [],
    '\nA key present in some catalogs and absent from others renders English in the ones that '
    + 'lack it, with nothing failing. Add it in all three layers (the catalog, '
    + 'scripts/i18n/overrides/spa.<lang>.json, and cache.json) or regenerate:\n'
    + `${problems.join('\n')}\n`,
  );
});

test('every hand-listed spa key reached every catalog', () => {
  // The blind spot in the test above, which compares the catalogs only with EACH OTHER.
  // Twenty-six files that are all short the same key agree perfectly, so a string that
  // never reached ANY of them is invisible there - and that is not hypothetical: the
  // session-tile badge's `Collaborator` and `{name} (away)` were listed in
  // extra-keys.spa.json and present in nought of twenty-six, rendering English in every
  // language with every gate green.
  //
  // extra-keys.spa.json is the half of the corpus a scan cannot rebuild: extractSpaKeys
  // finds literal `t('…')` call sites by regex, so anything dynamically keyed exists in
  // that file or nowhere. Checking it against the catalogs is therefore checking the one
  // input whose loss is silent. The scanned half needs no equivalent - a key extracted
  // from source that is missing from a catalog is a stale catalog, which is what the
  // union comparison above already reports.
  const extra = JSON.parse(readFileSync(EXTRA_KEYS, 'utf8')) as string[];
  assert.ok(extra.length > 100, `only ${extra.length} hand-listed keys - extra-keys.spa.json moved or shrank`);

  const problems: string[] = [];
  for (const { lang, path } of catalogs) {
    const cat = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
    const missing = extra.filter((k) => !Object.hasOwn(cat, k));
    if (missing.length) {
      problems.push(`${lang}: ${missing.length} missing, e.g. ${missing.slice(0, 3).map((k) => JSON.stringify(k.slice(0, 50))).join(', ')}`);
    }
  }
  assert.deepEqual(
    problems,
    [],
    '\nA key in extra-keys.spa.json that no catalog carries renders English everywhere, and '
    + 'the cross-catalog comparison above cannot see it because all 26 agree. Regenerate '
    + '(pnpm run translate --corpus spa) or add the English source as the value until a '
    + `translation exists:\n${problems.join('\n')}\n`,
  );
});

/**
 * How much of a catalog is still its own English source, over the values a translator
 * was meant to change. Shared by both echo guards below - same helper, same name and
 * same shape as collab-i18n.test.ts's, so the boot corpus and the lazy namespace are
 * measured identically - and exercised on synthetic catalogs by `the echo guards fail
 * a wholly-English catalog`, which is the only way a check reading 26 known-good files
 * can show it would still fail on a bad one.
 */
function echoStats(
  cat: Record<string, string>,
  gradeable: (en: string) => boolean,
): { graded: number; echoed: number } {
  const graded = Object.entries(cat).filter(([en]) => gradeable(en));
  return { graded: graded.length, echoed: graded.filter(([en, tr]) => tr === en).length };
}

/** The first guard's sample: long enough that a real translation cannot match it. */
const SUBSTANTIAL = (en: string): boolean => en.length >= 25 && /\s/.test(en);

test('no translation is left as an untranslated English echo of a long string', () => {
  // A catalog entry equal to its own key is the pipeline's English-fallback marker:
  // writeCatalogFromCache writes the key itself for anything with neither a cache entry
  // nor an override ("never ship broken output"). Short strings legitimately match - 
  // "OK", "PDF", a product name - so only flag substantial ones, and only when a
  // locale has a LOT of them, which is the signature of a half-finished wave rather
  // than a handful of genuine passthroughs.
  const problems: string[] = [];
  for (const { lang, path } of catalogs) {
    const cat = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
    const { graded, echoed } = echoStats(cat, SUBSTANTIAL);
    if (graded >= 50 && echoed > graded * 0.25) {
      problems.push(`${lang}: ${echoed}/${graded} long strings are identical to English - a wave probably did not finish`);
    }
  }
  assert.equal(problems.length, 0, `\n${problems.join('\n')}\n`);
});

/**
 * Sources a real translation may leave byte-identical, each with its reason - see the
 * matching list in collab-i18n.test.ts, which this one mirrors for the boot corpus.
 * Deliberately short: the check below is a floor, not a quality bar, so it does not need
 * every legitimate passthrough named - only enough that the ratio means something.
 */
const IDENTICAL_OK: ReadonlySet<string> = new Set([
  'OK', 'PDF', 'SVG', 'PNG', 'DPI', 'GPU', 'QR', 'Lolly', 'Pro', 'beta',
]);

/** The second guard's sample: everything the allowlist does not excuse. */
const GRADEABLE = (en: string): boolean => !IDENTICAL_OK.has(en);

test('no catalog is an English echo end to end', () => {
  // The backstop the check above cannot be. That one samples only strings of 25+
  // characters and only fires past fifty of them, which is the right shape for catching
  // a half-finished wave and the wrong shape for catching a catalog that was never
  // translated at all - a file of short labels can be 100% English and never present
  // fifty samples. No sample floor here, and the allowlist is what a legitimately
  // short catalog uses to stay green.
  //
  // Loose on purpose (>90%): the question is "was this file ever translated", and the
  // check above is what asks "was this wave finished".
  const problems: string[] = [];
  for (const { lang, path } of catalogs) {
    const cat = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
    const { graded, echoed } = echoStats(cat, GRADEABLE);
    if (!graded) continue;
    // The allowlist excuses individual strings; it must never become an exemption for
    // the catalog. Growing it past a handful hollows this guard out from the side,
    // without anyone having to touch the ratio below.
    assert.ok(
      graded >= Object.keys(cat).length * 0.9,
      `${lang}: IDENTICAL_OK excuses ${Object.keys(cat).length - graded} of ${Object.keys(cat).length} strings - `
      + 'the allowlist names a handful of universals, it does not shrink the sample',
    );
    if (echoed > graded * 0.9) {
      problems.push(`${lang}: ${echoed}/${graded} values are byte-identical to their English key - this catalog is the English fallback, not a translation`);
    }
  }
  assert.deepEqual(problems, [], `\n${problems.join('\n')}\n`);
});

test('the echo guards fail a wholly-English catalog and clear a translated one', () => {
  // Both guards above read the same 26 files, all of which pass, so a green run proves
  // nothing about whether they can still fail. That is how the defect they exist for got
  // in: the completeness check was keys-only, a Norwegian catalog that was 174/174
  // English satisfied it, and its green tick looked exactly like a real translation's.
  //
  // These two synthetic catalogs are the missing half. The first is what the pipeline
  // writes for a language it holds no cache entries for; the second is what a finished
  // wave looks like. A comparison flipped or a threshold nudged past 1 fails here, on a
  // fixture, rather than the next time a locale quietly ships English.
  const keys = [...new Set(catalogs.flatMap(({ path }) => Object.keys(JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>)))];
  assert.ok(keys.length >= 500, `only ${keys.length} boot keys - the fixtures below are not representative`);

  const untranslated = Object.fromEntries(keys.map((k) => [k, k]));
  const translated = Object.fromEntries(keys.map((k) => [k, IDENTICAL_OK.has(k) ? k : `«${k}»`]));

  const eSub = echoStats(untranslated, SUBSTANTIAL);
  assert.ok(eSub.graded >= 50, `only ${eSub.graded} substantial strings - the first guard would not even run`);
  assert.ok(eSub.echoed > eSub.graded * 0.25, 'the substantial-sample guard no longer fires on an all-English catalog');

  const eAll = echoStats(untranslated, GRADEABLE);
  assert.ok(eAll.echoed > eAll.graded * 0.9, 'the end-to-end guard no longer fires on an all-English catalog');

  // The other direction, so neither guard can be "strengthened" into flagging real work.
  const tSub = echoStats(translated, SUBSTANTIAL);
  assert.ok(!(tSub.graded >= 50 && tSub.echoed > tSub.graded * 0.25), 'the substantial-sample guard flags a translated catalog');
  assert.equal(echoStats(translated, GRADEABLE).echoed, 0, 'a translated catalog still reads as echoed - the comparison is wrong');
});

// ── Plural values, ellipsis parity, echo coverage, length budget ────────────────
//
// A catalog value is a string, or a forms object keyed by CLDR plural category (see
// lib/plural.ts and docs/contributing-setup.md). Nothing above reads a forms object, so
// these checks cover the shape and the cross-locale quality signals around forms objects.

type Catalog = Record<string, CatalogValue>;
const readCatalog = (path: string): Catalog => JSON.parse(readFileSync(path, 'utf8')) as Catalog;
const htmlLangOf = (lang: string): string => LANG_META[lang as Lang]?.htmlLang ?? lang;

/** Every string a catalog entry carries: the value itself, or each form of a forms object. */
function formsOf(value: CatalogValue): string[] {
  return isPluralForms(value) ? Object.values(value).filter((v): v is string => typeof v === 'string') : [value];
}

/** Problems with the plural values in one catalog: wrong category set, empty form, or a foreign placeholder. */
function pluralShapeProblems(lang: string, cat: Catalog): string[] {
  const want = [...pluralCategoriesFor(htmlLangOf(lang))].sort();
  const problems: string[] = [];
  for (const [en, value] of Object.entries(cat)) {
    if (!isPluralForms(value)) continue;
    const got = Object.keys(value).sort();
    if (got.join() !== want.join()) {
      problems.push(`${lang}: ${JSON.stringify(en.slice(0, 50))} has categories [${got}] but ${htmlLangOf(lang)} needs [${want}]`);
      continue;
    }
    const allowed = new Set(en.match(PLACEHOLDER) ?? []);
    for (const [cat2, form] of Object.entries(value)) {
      if (typeof form !== 'string' || !form.trim()) { problems.push(`${lang}: ${JSON.stringify(en.slice(0, 50))} form ${cat2} is empty`); continue; }
      const foreign = (form.match(PLACEHOLDER) ?? []).filter((p) => !allowed.has(p));
      if (foreign.length) problems.push(`${lang}: ${JSON.stringify(en.slice(0, 50))} form ${cat2} uses ${foreign.join(' ')} which the English key lacks`);
    }
  }
  return problems;
}

test('every plural value carries exactly the categories its locale uses', () => {
  const problems = catalogs.flatMap(({ lang, path }) => pluralShapeProblems(lang, readCatalog(path)));
  assert.deepEqual(problems, [], `\n${problems.slice(0, 30).join('\n')}\n`);
});

test('the plural shape check fails a wrong category set and clears a right one', () => {
  // The 26 real catalogs hold no forms object until the translation pass is merged, so the
  // check above is vacuous today. These fixtures keep it honest: it must fail on each of
  // the mistakes a translator makes (an English-shaped pair for Russian, a missing
  // category, a stray one, an emptied form) and pass a correct Russian and Japanese entry.
  const key = '{n} files';
  assert.equal(pluralShapeProblems('ru', { [key]: { one: 'a', few: 'b', many: 'c', other: 'd' } }).length, 0);
  assert.equal(pluralShapeProblems('ja', { [key]: { other: '{n} 個' } }).length, 0);
  assert.equal(pluralShapeProblems('ru', { [key]: { one: 'a', other: 'd' } }).length, 1, 'English-shaped pair for ru');
  assert.equal(pluralShapeProblems('ru', { [key]: { one: 'a', few: 'b', other: 'd' } }).length, 1, 'missing many');
  assert.equal(pluralShapeProblems('ja', { [key]: { one: 'a', other: 'd' } }).length, 1, 'stray one for ja');
  assert.equal(pluralShapeProblems('ru', { [key]: { one: 'a', few: 'b', many: ' ', other: 'd' } }).length, 1, 'empty form');
  assert.equal(pluralShapeProblems('ru', { [key]: { one: '{x}', few: 'b', many: 'c', other: 'd' } }).length, 1, 'foreign placeholder');
});

test('every migrated plural key has a plain or forms value in every catalog', () => {
  // Plural keys come from tn()/tnRaw() call sites. Whatever state the translation pass is
  // in, each locale must carry the key, as the plain string it had before or as forms.
  const sources: Array<{ one: string; other: string }> = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'locales') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) sources.push(...scanPluralSources(readFileSync(full, 'utf8')));
    }
  };
  walk(HERE);
  assert.ok(sources.length >= 30, `only ${sources.length} plural call sites found - did the scan or the migration move?`);
  const problems: string[] = [];
  for (const { lang, path } of catalogs) {
    const cat = readCatalog(path);
    const missing = sources.filter(({ other }) => !Object.hasOwn(cat, other));
    if (missing.length) problems.push(`${lang}: ${missing.length} plural key(s) missing, e.g. ${JSON.stringify(missing[0]!.other)}`);
  }
  assert.deepEqual(problems, [], `\n${problems.join('\n')}\n`);
});

/** Trailing ellipsis: "…" or "...". A menu item ending in one opens a dialog, and the translation must end the same way. */
const ELLIPSIS = /(…|\.\.\.)$/;

/**
 * Catalog entries that break ellipsis parity on purpose, keyed `lang|English source`: the
 * "Add from…" family, where the ellipsis sits mid-phrase or leads in the target language's
 * word order. The translation defects this list once held were fixed on 2026-11-03. The list is a
 * ratchet: new entries are failures, and fixing one means deleting its line.
 */
const ELLIPSIS_KNOWN: ReadonlySet<string> = new Set([
  'ur|Add from…',
  'zh-hant|Add from…',
  'zh|Add from…',
]);

test('trailing-ellipsis parity holds for every form of every entry', () => {
  const problems: string[] = [];
  const stale = new Set(ELLIPSIS_KNOWN);
  for (const { lang, path } of catalogs) {
    for (const [en, value] of Object.entries(readCatalog(path))) {
      const wantEllipsis = ELLIPSIS.test(en);
      for (const form of formsOf(value)) {
        if (typeof form !== 'string' || !form || form === en) continue;
        if (ELLIPSIS.test(form.trim()) === wantEllipsis) continue;
        const id = `${lang}|${en}`;
        stale.delete(id);
        if (!ELLIPSIS_KNOWN.has(id)) problems.push(`${id}: English ${wantEllipsis ? 'ends' : 'does not end'} in an ellipsis, translation ${JSON.stringify(form.slice(0, 50))} ${wantEllipsis ? 'does not' : 'does'}`);
      }
    }
  }
  assert.deepEqual(problems, [], `\n${problems.join('\n')}\n`);
  assert.deepEqual([...stale], [], `\nThese ELLIPSIS_KNOWN entries are fixed now; delete them:\n${[...stale].join('\n')}\n`);
});

test('echo coverage report: per locale, how much of the catalog is still English', (t) => {
  // Report only. The two guards above fail a wave that did not finish; this prints the
  // numbers a reviewer wants at a glance, including how many migrated plural keys
  // already carry a forms object (the translation pass moves that from 0 to all).
  const lines: string[] = [];
  for (const { lang, path } of catalogs) {
    const cat = readCatalog(path);
    const entries = Object.entries(cat).filter(([en]) => GRADEABLE(en));
    const echoed = entries.filter(([en, v]) => typeof v === 'string' && v === en).length;
    const plural = Object.values(cat).filter(isPluralForms).length;
    lines.push(`${lang.padEnd(8)} echo ${String(echoed).padStart(4)}/${entries.length} (${((100 * echoed) / Math.max(1, entries.length)).toFixed(1)}%)  plural forms ${plural}`);
  }
  t.diagnostic(`\n${lines.join('\n')}`);
  assert.equal(lines.length, catalogs.length);
});

/**
 * Length budget for short UI strings: a source of 24 characters or fewer should not grow
 * past `factor * length + SLACK` in translation, or it overflows buttons, tabs and chips.
 * Calibrated on the catalogs of 2026-11-03 (95th percentile of the ratio is about 2.0 for
 * the alphabetic scripts and under 1.0 for CJK) with margin, so today's outliers are the
 * ones reported. Warning only: a long label is sometimes the right translation, and the
 * fix is a wider control or a shorter word, which a person decides.
 */
const SHORT_SOURCE = 24;
const LENGTH_SLACK = 4;
const LENGTH_FACTOR_DEFAULT = 3;
const LENGTH_FACTOR: Readonly<Record<string, number>> = { zh: 1.5, 'zh-hant': 1.5, ja: 1.8, ko: 2 };

test('length-expansion budget for short strings (warning only)', (t) => {
  const lines: string[] = [];
  for (const { lang, path } of catalogs) {
    const factor = LENGTH_FACTOR[lang] ?? LENGTH_FACTOR_DEFAULT;
    const over: string[] = [];
    let checked = 0;
    for (const [en, value] of Object.entries(readCatalog(path))) {
      if (en.length > SHORT_SOURCE) continue;
      for (const form of formsOf(value)) {
        if (typeof form !== 'string') continue;
        checked++;
        if (form.length > Math.ceil(en.length * factor) + LENGTH_SLACK) over.push(`${JSON.stringify(en)} -> ${JSON.stringify(form)}`);
      }
    }
    lines.push(`${lang.padEnd(8)} ${String(over.length).padStart(3)} over budget (x${factor}+${LENGTH_SLACK}) of ${checked} short entries${over.length ? `, e.g. ${over.slice(0, 2).join('; ')}` : ''}`);
  }
  t.diagnostic(`\n${lines.join('\n')}`);
  assert.equal(lines.length, catalogs.length);
});
