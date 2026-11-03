// SPDX-License-Identifier: MPL-2.0
/**
 * Plural selection for UI strings, a dependency-free leaf shared by i18n.ts, the
 * locale checks and the translation tooling.
 *
 * Categories are the Unicode CLDR plural categories (zero, one, two, few, many,
 * other), chosen per locale by the platform's `Intl.PluralRules`. A catalog value
 * is either a plain string (used for every count, the pre-plural behaviour) or a
 * forms object keyed by category: `{ "one": "...", "few": "...", "many": "...",
 * "other": "..." }`.
 *
 * English is the key. A plural call site declares both English forms in source,
 * `tn(oneForm, otherForm, { n })` with both forms as string literals: the catalog key is the `other` form, and
 * the `one` form is the English text shown for a count of 1 when no translation
 * exists yet.
 */

/** A catalog value for a plural key: one string per CLDR category. */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>>;

/** What a locale catalog may hold for a key. */
export type CatalogValue = string | PluralForms;

export const PLURAL_CATEGORIES: readonly Intl.LDMLPluralRule[] = ['zero', 'one', 'two', 'few', 'many', 'other'];

/** Param keys that may hold the count, in priority order. */
const COUNT_KEYS = ['n', 'count', 'total'] as const;

const rulesCache = new Map<string, Intl.PluralRules>();

function rulesFor(locale: string): Intl.PluralRules {
  let rules = rulesCache.get(locale);
  if (!rules) {
    try { rules = new Intl.PluralRules(locale); } catch { rules = new Intl.PluralRules('en'); }
    rulesCache.set(locale, rules);
  }
  return rules;
}

/** The CLDR category `n` falls in for `locale` (a BCP 47 tag such as `ru` or `zh-Hant`). */
export function pluralCategory(locale: string, n: number): Intl.LDMLPluralRule {
  return rulesFor(locale).select(n);
}

/** Exactly the categories a locale uses, in CLDR order. A plural value must carry all of them. */
export function pluralCategoriesFor(locale: string): Intl.LDMLPluralRule[] {
  const used = new Set(rulesFor(locale).resolvedOptions().pluralCategories);
  return PLURAL_CATEGORIES.filter(c => used.has(c));
}

/** True for a forms object (as opposed to a plain string value). */
export function isPluralForms(value: unknown): value is PluralForms {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The count a plural call carries: the first of `n`, `count`, `total` that is numeric, else undefined. */
export function pluralCount(params: Record<string, string | number> | undefined): number | undefined {
  if (!params) return undefined;
  for (const key of COUNT_KEYS) {
    const raw = params[key];
    if (raw === undefined || raw === '') continue;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export interface PluralSelection {
  /** The English `one` form from source. */
  one: string;
  /** The English `other` form from source, which is also the catalog key. */
  other: string;
  /** The catalog value for the `other` key, if the locale has one. */
  entry: CatalogValue | undefined;
  /** The catalog value for the English `one` text as a plain key: the translation a
   *  locale carried before this string became a plural key. Exact-1 only. */
  legacyOne: CatalogValue | undefined;
  /** The count. */
  n: number;
  /** The BCP 47 tag of the catalog in effect (ignored when `entry` is absent). */
  locale: string;
}

/**
 * Choose the template for a count. Order:
 *  1. a forms object: the locale's category, then its `other`, then the English source;
 *  2. a count of exactly 1 with a plain-string translation of the singular English
 *     text: that translation, so a locale never gets worse when a string becomes plural;
 *  3. a plain string, which every other count shares;
 *  4. nothing: the English forms, chosen by English rules.
 */
export function selectPluralTemplate(sel: PluralSelection): string {
  const { one, other, entry, legacyOne, n, locale } = sel;
  if (isPluralForms(entry)) {
    return entry[pluralCategory(locale, n)] ?? entry.other ?? other;
  }
  if (n === 1 && typeof legacyOne === 'string' && legacyOne) return legacyOne;
  if (typeof entry === 'string') return entry;
  return pluralCategory('en', n) === 'one' ? one : other;
}
