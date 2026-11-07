// SPDX-License-Identifier: MPL-2.0
/**
 * The docs search ranking (plan 354 D4): one ranking over one index, for both places
 * a reader searches the docs. The app's spotlight (providers/docs.ts) imports this
 * module, and docs/build.ts bundles the same file into the /info site's script
 * (`LollyDocsRank`), so the two searches cannot drift. It holds no DOM, no fetch and
 * no locale, so the static site can carry the same file.
 *
 * The index has one record per page section, plus one for each page's intro (its
 * heading is ''). A page is the answer a reader usually wants first and its sections
 * are one press away inside it, so pages lead:
 *  - a page record matched in its title outranks any section matched in its heading
 *    (PAGE_TITLE_WEIGHT over HEADING_WEIGHT);
 *  - a page record also matches on its whole contents (every heading and snippet of
 *    the page), weakly. The intro snippet is short, so without this "export svg"
 *    found no page at all: the Export page's intro never says SVG.
 *
 * Ask (lib/ask/retrieve.ts) ranks the same records differently on purpose: it wants
 * the section that answers a question, not the page. It reads `fields`, which this
 * module leaves at the original heading > title > body ladder.
 */
import { fold, scoreHaystack, type SearchField } from './match.ts';

/** One /info page section, as docs/build.ts's indexSections writes the record. Keys are
 *  short because the file ships once per locale and is fetched by readers:
 *  p=page slug, t=page title, h=heading ('' for the page intro), a=anchor
 *  ('' for the page intro), x=body snippet, i=page sidebar-icon key (optional -
 *  absent in indices built before plans/103; the consumer falls back). */
export interface DocsRecord { p: string; t: string; h: string; a: string; x: string; i?: string }

/** A record with its haystacks folded once at load, not per keystroke. `fields` is
 *  the record on its own (Ask reads these); `search` is what the docs search ranks,
 *  which for a page record adds the page title's weight and the page's contents. */
export interface PreparedRecord { rec: DocsRecord; fields: SearchField[]; search: SearchField[] }

/** A ranked search result. */
export interface RankedDocsRecord { rec: DocsRecord; score: number }

/** The docs scorer's field weights (heading > page title > body). */
export const HEADING_WEIGHT = 8;
export const TITLE_WEIGHT = 3;
export const BODY_WEIGHT = 1;
/** A page's own record matched in its title: above any heading, so pages lead. */
export const PAGE_TITLE_WEIGHT = 10;
/** A page's own record matched somewhere in its contents: below any section's own
 *  text, so a section that uses the term still outranks a page that only contains the term. */
export const PAGE_CONTENTS_WEIGHT = 0.5;

/** Fold a raw record list into the prebuilt-haystack shape once. */
export function prepareRecords(records: unknown): PreparedRecord[] {
  const list = Array.isArray(records) ? (records as DocsRecord[]) : [];
  const contents = new Map<string, string[]>();
  for (const rec of list) {
    const parts = contents.get(rec.p) ?? [];
    parts.push(String(rec.h ?? ''), String(rec.x ?? ''));
    contents.set(rec.p, parts);
  }
  return list.map((rec): PreparedRecord => {
    const heading = { text: fold(String(rec.h ?? '')), weight: HEADING_WEIGHT };
    const title = fold(String(rec.t ?? ''));
    const body = { text: fold(String(rec.x ?? '')), weight: BODY_WEIGHT };
    const fields = [heading, { text: title, weight: TITLE_WEIGHT }, body];
    const search = rec.h
      ? fields
      : [
          heading,
          { text: title, weight: PAGE_TITLE_WEIGHT },
          body,
          { text: fold((contents.get(rec.p) ?? []).join(' ')), weight: PAGE_CONTENTS_WEIGHT },
        ];
    return { rec, fields, search };
  });
}

/** Fold a query and split it into tokens, exactly as the app's search does. */
export { tokenize } from './match.ts';

/** Every record matching every token, best first. On an equal score a page comes
 *  before a section, and otherwise the index order holds. */
export function rankDocs(records: readonly PreparedRecord[], tokens: readonly string[]): RankedDocsRecord[] {
  if (!tokens.length) return [];
  const hits: Array<RankedDocsRecord & { i: number }> = [];
  for (let i = 0; i < records.length; i++) {
    const { rec, search } = records[i]!;
    const score = scoreHaystack(search, tokens);
    if (score > 0) hits.push({ rec, score, i });
  }
  hits.sort((a, b) => b.score - a.score || Number(!!a.rec.h) - Number(!!b.rec.h) || a.i - b.i);
  return hits.map(({ rec, score }) => ({ rec, score }));
}
