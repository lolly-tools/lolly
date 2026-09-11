// SPDX-License-Identifier: MPL-2.0
/**
 * The Ask answer orchestrator (plans/103 M0).
 *
 * One question in, one assembled answer out. Both retrievals always run; the
 * intent only orders the presentation (answer.ts returns the parts, the view
 * lays them out). For the best-matching documentation section it fetches that
 * page's markdown twin and extracts the WHOLE section (chunks.alignPage), so the
 * reader gets the real answer rather than the index's 240-char snippet; if the
 * twin is missing, the page can't be aligned (non-markdown pages), or the locale
 * has no English twin, it falls back to the snippet and always offers the
 * open-in-docs link. Answers are verbatim docs text - nothing is generated.
 */
import { currentLang } from '../../i18n.ts';
import { tokenize } from '../search/match.ts';
import { docsAppHrefFor, loadDocsIndex, type DocsRecord } from '../search/docs-index.ts';
import { classifyIntent, type AskIntent } from './intent.ts';
import { alignPage } from './chunks.ts';
import { renderAnswerMd } from './render-md.ts';
import { retrieveDocsSections, retrieveProviderHits, type ProviderHitGroup } from './retrieve.ts';

/** How the primary answer's page/section is named under the extracted text. */
export interface AskCitation { page: string; pageTitle: string; heading: string }

/** The lead of an answer: the extracted (or snippet) section for the top docs hit. */
export interface AskPrimary {
  /** Safe HTML from render-md - the full section, or the snippet on fallback. */
  html: string;
  citation: AskCitation;
  /** In-app reader deep link to the exact section (`#/docs/<slug>?h=<anchor>`). */
  href: string;
  /** True when only the 240-char index snippet was available (no full section). */
  fromSnippet: boolean;
}

/** One assembled answer. */
export interface AskAnswer {
  intent: AskIntent;
  /** The extracted documentation section, or null when nothing matched the docs. */
  primary: AskPrimary | null;
  /** Other matching sections, offered as follow-up links. */
  related: DocsRecord[];
  /** Grouped in-app hits (tools, settings, places…) for navigate/make intents. */
  toolHits: ProviderHitGroup[];
}

/** How many related sections to offer under the primary answer. */
const RELATED_MAX = 4;

// The full-text twins are English-only static files - fetched once each, cached
// for the session (a missing twin resolves to null, never an error).
const twinCache = new Map<string, Promise<string | null>>();
function loadTwin(slug: string): Promise<string | null> {
  let p = twinCache.get(slug);
  if (!p) {
    p = fetch(`/info/${slug}.md`).then((r) => (r.ok ? r.text() : null)).catch(() => null);
    twinCache.set(slug, p);
  }
  return p;
}

/** Test seam - drop the twin cache. */
export function _resetTwinCache(): void {
  twinCache.clear();
}

/** Assemble the answer for one raw question. */
export async function answerQuestion(raw: string): Promise<AskAnswer> {
  const tokens = tokenize(raw);
  const intent = classifyIntent(raw);
  const [docHits, toolHits] = await Promise.all([
    retrieveDocsSections(tokens, RELATED_MAX + 1, raw),
    retrieveProviderHits(tokens),
  ]);

  let primary: AskPrimary | null = null;
  const related: DocsRecord[] = [];

  if (docHits.length) {
    const top = docHits[0]!.rec;
    const href = docsAppHrefFor(top);

    // Extract the full section from the English twin when we can; else snippet.
    let sectionMd: string | null = null;
    if (currentLang() === 'en') {
      const twin = await loadTwin(top.p);
      if (twin) {
        const pageRecs = (await loadDocsIndex()).filter((pr) => pr.rec.p === top.p).map((pr) => pr.rec);
        const idx = pageRecs.findIndex((r) => r.a === top.a && r.h === top.h);
        if (idx >= 0) sectionMd = alignPage(twin, pageRecs)[idx] ?? null;
      }
    }

    primary = {
      html: renderAnswerMd(sectionMd ?? top.x),
      citation: { page: top.p, pageTitle: top.t, heading: top.h },
      href,
      fromSnippet: sectionMd === null,
    };
    for (const dh of docHits.slice(1, RELATED_MAX + 1)) related.push(dh.rec);
  }

  return { intent, primary, related, toolHits };
}
