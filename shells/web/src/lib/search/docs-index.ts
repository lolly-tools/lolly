// SPDX-License-Identifier: MPL-2.0
/**
 * The shared /info search-index loader (plans/103 M0).
 *
 * The Docs spotlight provider (providers/docs.ts) and the Ask help pipeline
 * (lib/ask/*) both federate over the static site's per-locale search index - 
 * `/info/search-index.json` for English, `/info/<lang>/search-index.json`
 * otherwise, one record per page section, exactly as docs/build.ts's
 * indexSections writes it. This module is the ONE place that path, that record
 * shape, and the docs scorer's field weights live, so the two consumers cannot
 * drift (plans/99 principle 1 applied to the docs haystack).
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
import { fold, type SearchField } from './match.ts';

/** One /info page section, as docs/build.ts's indexSections writes it. Keys are
 *  short because the file ships once per locale and is fetched by readers:
 *  p=page slug, t=page title, h=heading ('' for the page intro), a=anchor
 *  ('' for the page intro), x=body snippet, i=page sidebar-icon key (optional - 
 *  absent in indices built before plans/103; the consumer falls back). */
export interface DocsRecord { p: string; t: string; h: string; a: string; x: string; i?: string }

/** A record with its haystack folded once at load, not per keystroke. */
export interface PreparedRecord { rec: DocsRecord; fields: SearchField[] }

/** The docs scorer's field weights (heading > page title > body). Shared so the
 *  provider and the Ask retriever rank identically. */
export const HEADING_WEIGHT = 8;
export const TITLE_WEIGHT = 3;
export const BODY_WEIGHT = 1;

/** The /info base for a locale: English is unprefixed, every other locale lives
 *  under /info/<lang>/ (mirrors i18n.ts's docsHref and the docs sidebar). */
export function docsBase(lang: Lang): string {
  return lang === 'en' ? '/info' : `/info/${lang}`;
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

/** Fold a raw record list into the prebuilt-haystack shape once. */
export function prepareRecords(records: unknown): PreparedRecord[] {
  return (Array.isArray(records) ? (records as DocsRecord[]) : []).map((rec): PreparedRecord => ({
    rec,
    fields: [
      { text: fold(String(rec.h ?? '')), weight: HEADING_WEIGHT },
      { text: fold(String(rec.t ?? '')), weight: TITLE_WEIGHT },
      { text: fold(String(rec.x ?? '')), weight: BODY_WEIGHT },
    ],
  }));
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
