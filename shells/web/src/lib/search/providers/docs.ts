// SPDX-License-Identifier: MPL-2.0
/**
 * The Docs spotlight provider (plans/99 M3) - searches the /info site.
 *
 * The haystack is the static site's own per-locale search index, loaded through
 * the shared lib/search/docs-index.ts module (the record shape, the /info base
 * path and the heading>title>body weights all live there now, so this provider
 * and the Ask help pipeline cannot drift - plans/103 M0). Federating over it at
 * runtime keeps plans/99 principle 2 (no build-time unified index) since it is
 * already per-locale static data the client can reach.
 *
 * LAZY: nothing is fetched until the first search() call, so a user who never
 * searches pays nothing (the same first-interaction rule the docs sidebar
 * follows). The fetch promise is cached PER PROVIDER; ANY failure resolves to an
 * empty record set forever, with no logging - offline is a normal state for this
 * app, not an error.
 *
 * Scoring mirrors the docs sidebar's ladder (heading beats page title beats
 * body prose) through lib/search weights; scoreHaystack's word-boundary doubling
 * preserves the sidebar's extra heading-prefix bonus.
 */
import { icon, type IconName } from '../../icons.ts';
import { scoreHaystack } from '../match.ts';
import { docsAppHrefFor, fetchDocsIndex, type PreparedRecord } from '../docs-index.ts';
import type { SearchHit, SearchProvider } from '../registry.ts';

/**
 * The docs pages' own sidebar-icon keys (docs/build.ts SIDEBAR_ICON → DOC_ICONS)
 * mapped to this shell's icon() names, so a Docs hit wears its PAGE's glyph
 * rather than one generic help mark (plans/103) - sections from different pages
 * are then distinguishable at a glance. A handful of docs glyphs have no exact
 * shell twin and map to the nearest (code→cpu, server→building, home→dashboard,
 * eyeoff→eye); an unknown or missing key falls back to a neutral page glyph.
 */
const DOCS_ICON: Record<string, IconName> = {
  home: 'dashboard', star: 'star', palette: 'palette', wrench: 'wrench',
  checklist: 'checklist', shieldcheck: 'shieldCheck', convert: 'convert',
  usercheck: 'userCheck', pentool: 'penTool', upload: 'upload', clock: 'clock',
  download: 'download', sliders: 'sliders', people: 'users', search: 'search',
  layers: 'layers', hash: 'hash', photos: 'photos', code: 'cpu', link: 'link',
  seal: 'seal', monitor: 'monitor', server: 'building', sparkle: 'sparkle',
  globe: 'globe', box: 'box', document: 'document', cpu: 'cpu', font: 'font',
  check: 'check', lock: 'lock', eyeoff: 'eye',
};

/** The shell icon() name for a docs record's sidebar-icon key (rec.i), so the
 *  spotlight Docs group AND the /ask related-docs links wear the page's glyph.
 *  Exported for the Ask view to share the one mapping. */
export function docsIconName(key: string | undefined): IconName {
  return (key && DOCS_ICON[key]) || 'document';
}

export function createDocsProvider(): SearchProvider {
  // Cached across searches - settled once, kept forever (locale is fixed for
  // the session: switchLang reloads the whole app). Per-provider, not the
  // shared module cache, so each instance fetches once (its own contract test).
  let loaded: Promise<PreparedRecord[]> | null = null;
  const load = (): Promise<PreparedRecord[]> => (loaded ??= fetchDocsIndex());

  return {
    id: 'docs',
    async search(tokens, limit): Promise<SearchHit[]> {
      if (!tokens.length) return [];
      const hits: SearchHit[] = [];
      for (const { rec, fields } of await load()) {
        const score = scoreHaystack(fields, tokens);
        if (score <= 0) continue;
        hits.push({
          icon: icon(docsIconName(rec.i)),
          // A heading is the row (the sidebar shows the page title as context
          // only when there IS a heading); the page-intro record has none, so
          // the page title leads and needs no subtitle repeating it.
          title: rec.h || rec.t,
          ...(rec.h ? { subtitle: rec.t } : {}),
          href: docsAppHrefFor(rec),
          score,
        });
      }
      return hits.sort((a, b) => b.score - a.score).slice(0, limit);
    },
  };
}
