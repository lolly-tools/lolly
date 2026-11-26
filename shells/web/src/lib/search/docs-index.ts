// SPDX-License-Identifier: MPL-2.0
/**
 * The shared /info search-index loader (plans/103 M0).
 *
 * The Docs spotlight provider (providers/docs.ts) and the Ask help pipeline
 * (lib/ask/*) both federate over the static site's per-locale search index - 
 * `/info/search-index.json` for English, `/info/<lang>/search-index.json`
 * otherwise, one record per page section, exactly as docs/build.ts's
 * indexSections writes it. This module is the ONE place that path lives; the
 * record shape, the field weights and the search ranking live beside it in
 * docs-rank.ts, which the /info site bundles as well, so no consumer can drift
 * (plans/99 principle 1 applied to the docs haystack).
 *
 * `loadDocsIndex()` is module-level, locale-keyed and cached: the index is
 * fetched once per session per locale and shared. Any failure resolves to an
 * empty record set - offline is a normal state for this app, not an error, so
 * a missing/unreachable index simply means "no docs answers", silently.
 *
 * The Docs provider keeps its OWN per-instance cache (see docs.ts) rather than
 * this one, because its test asserts a fresh fetch per provider; it reuses the
 * pure helpers here (docsBase/prepareRecords/docsHrefFor/weights) so the two
 * paths stay byte-identical.
 */
import { currentLang, docsAppHref, type Lang } from '../../i18n.ts';
import type { DocsRecord, PreparedRecord } from './docs-rank.ts';
import { prepareRecords } from './docs-rank.ts';
import { infoLocaleBuilt } from '../info-locales.ts';

// The record shape, the weights and the folding live in docs-rank.ts, which the /info
// site bundles too (plan 354 D4); they are re-exported here for the existing importers.
export {
  BODY_WEIGHT, HEADING_WEIGHT, PAGE_CONTENTS_WEIGHT, PAGE_TITLE_WEIGHT, TITLE_WEIGHT,
  prepareRecords, rankDocs,
} from './docs-rank.ts';
export type { DocsRecord, PreparedRecord, RankedDocsRecord } from './docs-rank.ts';

/** The /info base for a locale: English is unprefixed, every other locale lives
 *  under /info/<lang>/ (mirrors i18n.ts's docsInfoHref and the docs sidebar). A build
 *  that leaves out `lang`'s pages (lib/info-locales.ts) searches the English index
 *  and links its English pages, which it does serve, instead of a missing index. */
export function docsBase(lang: Lang): string {
  return lang === 'en' || !infoLocaleBuilt(lang) ? '/info' : `/info/${lang}`;
}

/** The /info deep-link for a record - base + '/' + p + '.html' + ('#' + a when
 *  anchored) - EXACTLY the docs sidebar's construction. This is the SHARE/SEO
 *  form (the static, crawlable page); INTERNAL navigation uses docsAppHrefFor
 *  below, which routes the in-app reader instead. The .html suffix is
 *  required (a /info/<lang>/ directory URL 404s in dev - see docsHref's note). */
export function docsHrefFor(base: string, rec: DocsRecord): string {
  return `${base}/${rec.p}.html${rec.a ? `#${rec.a}` : ''}`;
}

/** The IN-APP docs-reader href for a record - `#/docs/<slug>`, with the section's
 *  heading anchor carried as a `?h=<anchor>` QUERY param (NOT a second '#':
 *  `#/docs/<slug>#<anchor>` is a double hash the SPA hash router can't parse).
 *  views/docs.ts reads `h` on mount and scrolls that heading into view. The
 *  language rides the app's current locale (docsAppHref drops any lang prefix),
 *  so this is INTERNAL navigation only - share/SEO links stay on docsHrefFor /
 *  docsInfoHref. */
export function docsAppHrefFor(rec: DocsRecord): string {
  const href = docsAppHref(rec.p);
  return rec.a ? `${href}?h=${encodeURIComponent(rec.a)}` : href;
}

/** Fetch + fold the active locale's index (uncached - callers cache). */
export async function fetchDocsIndex(): Promise<PreparedRecord[]> {
  const base = docsBase(currentLang());
  try {
    const r = await fetch(`${base}/search-index.json`);
    if (!r.ok) return [];
    return prepareRecords(await r.json());
  } catch {
    return []; // offline/missing index → no docs, silently
  }
}

// Module-level, locale-keyed cache - settled once per (locale), kept for the
// session. A language switch reloads the whole app in production, but the map is
// keyed by lang so a test-time switch re-fetches too.
const cache = new Map<Lang, Promise<PreparedRecord[]>>();

/** The shared, cached docs index for the active locale. */
export function loadDocsIndex(): Promise<PreparedRecord[]> {
  const lang = currentLang();
  let p = cache.get(lang);
  if (!p) { p = fetchDocsIndex(); cache.set(lang, p); }
  return p;
}

/** Test seam - drop the cache so a suite can serve a fresh fixture. */
export function _resetDocsIndexCache(): void {
  cache.clear();
}
