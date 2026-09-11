// SPDX-License-Identifier: MPL-2.0
/**
 * Retrieval for Ask answers (plans/103 M0).
 *
 * Two independent retrievals, both federating over data the client already
 * holds (plans/99 principle 2):
 *  - `retrieveDocsSections` ranks the /info section index with the shared docs
 *    scorer. This is the ONE place the docs ranking lives; plans/103 M1 swaps in
 *    a lexical+semantic hybrid here and nowhere else.
 *  - `retrieveProviderHits` asks the registered spotlight providers (tools,
 *    settings, places, projects, catalog…) the same tokens, so "where is…" and
 *    "make a…" answers reuse the exact hits the spotlight overlay would show.
 *    The `ask` group is skipped (it would recurse into this surface).
 */
import { GROUP_CAP, searchProviders, type SearchGroupId, type SearchHit } from '../search/registry.ts';
import { scoreHaystack } from '../search/match.ts';
import { loadDocsIndex, type DocsRecord } from '../search/docs-index.ts';
import { cachedEmbedModel, embedAvailable, embedQuery } from './embed.ts';
import { cosineTopK, loadVectors } from './vectors.ts';
import { createDebugLogger } from '../ort.ts';

/** `#/ask?bench` timings (plans/103 section 5) - the Ask view arms the global
 *  flag; `localStorage['lolly:askBench']='1'` works anywhere. */
const bench = createDebugLogger({ tag: 'ask-bench', storageKey: 'lolly:askBench', globalFlag: '__lollyAskBench' });
let embedWarm = false;

/** One ranked documentation section. */
export interface DocsSectionHit { rec: DocsRecord; score: number }

/**
 * A small English stopword set. A natural-language question ("how do I export a
 * transparent PNG?") is mostly function words that appear in no section, and the
 * spotlight matcher is AND-across-tokens - so scoring the raw question finds
 * nothing. Stripping these focuses the match on the content terms. English-only
 * and English-first by design (plans/103): other locales keep every token, where
 * the additive OR scoring below simply treats the extra words as weak signal.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'am', 'be', 'do', 'does', 'did', 'how', 'what', 'why',
  'when', 'where', 'which', 'who', 'can', 'could', 'should', 'would', 'will', 'to', 'of',
  'in', 'on', 'for', 'and', 'or', 'my', 'i', 'me', 'it', 'this', 'that', 'with', 'as',
  'from', 'at', 'by', 'you', 'your', 'we', 'if', 'so', 'get', 'use', 'using',
]);

/**
 * Rank the docs section index against the tokens. Unlike the spotlight docs
 * provider (which is AND-across-tokens - right for a short lookup), Ask questions
 * are natural language, so this is ADDITIVE OR: each content token contributes
 * its best-field weight through the shared matcher (a single-token scoreHaystack
 * call, so folding, word-boundary doubling and the heading>title>body ladder are
 * all still the one matcher's), a missing token just scores 0 instead of zeroing
 * the record, and sections are ranked by how many query terms they cover first,
 * then by weight. This is the ONE place docs ranking lives; plans/103 M1 blends a
 * semantic score in here and nowhere else.
 */
export async function retrieveDocsSections(tokens: readonly string[], limit: number, raw?: string): Promise<DocsSectionHit[]> {
  if (!tokens.length) return [];
  const content = tokens.filter((t) => !STOPWORDS.has(t));
  const use = content.length ? content : tokens; // never strip a query to nothing
  const entries = await loadDocsIndex();
  const scored: Array<DocsSectionHit & { matched: number; i: number }> = [];
  for (let i = 0; i < entries.length; i++) {
    const { rec, fields } = entries[i]!;
    let score = 0;
    let matched = 0;
    for (const tok of use) {
      const s = scoreHaystack(fields, [tok]);
      if (s > 0) { score += s; matched++; }
    }
    if (matched > 0) scored.push({ rec, score, matched, i });
  }
  // Coverage first (a section hitting more of the question wins), then weight.
  scored.sort((a, b) => b.matched - a.matched || b.score - a.score);

  // Tier 1 (plans/103 M1): blend in cosine similarity when the committed
  // vectors AND the consented embed model are both on-device. Any absence or
  // failure degrades to the lexical ranking above - never a wrong answer, and
  // never an implicit model download.
  const sem = raw ? await semanticTopK(raw, entries.length) : null;
  if (!sem) return scored.slice(0, limit).map(({ rec, score }) => ({ rec, score }));
  return blendHybrid(scored, sem, entries, limit);
}

/** How deep each side of the hybrid union reaches (plans/103 section 5). */
const HYBRID_TOP = 32;

/** Cosine top-32 of the raw question against the committed section vectors, as
 *  index → cosine. Null (lexical-only) when the model isn't consented/cached,
 *  vectors are missing or stale, the count disagrees with the index, or
 *  anything throws - the caller treats every null identically. */
async function semanticTopK(raw: string, indexLength: number): Promise<Map<number, number> | null> {
  try {
    if (!embedAvailable() || !(await cachedEmbedModel())) return null;
    const vecs = await loadVectors();
    if (!vecs || vecs.count !== indexLength) return null;
    const cold = !embedWarm;
    const t0 = performance.now();
    const q = await embedQuery(raw);
    embedWarm = true;
    const t1 = performance.now();
    const top = cosineTopK(q, vecs, HYBRID_TOP);
    const t2 = performance.now();
    bench('semantic', { embedMs: Math.round(t1 - t0), cosineMs: +(t2 - t1).toFixed(2), coldStart: cold, count: vecs.count });
    return new Map(top.map((t) => [t.index, t.cos]));
  } catch {
    return null;
  }
}

/** Union of lexical top-32 and cosine top-32, scored
 *  `0.5 * lexNorm + 0.5 * (cos + 1) / 2` (plans/103 section 5). A side that
 *  didn't surface a candidate contributes 0 - absence of evidence, not a
 *  penalty. Lexical coverage stays the tiebreak so exact-term hits keep their
 *  edge among semantic ties. */
export function blendHybrid(
  scored: ReadonlyArray<DocsSectionHit & { matched: number; i: number }>,
  sem: ReadonlyMap<number, number>,
  entries: ReadonlyArray<{ rec: DocsRecord }>,
  limit: number,
): DocsSectionHit[] {
  const lexTop = scored.slice(0, HYBRID_TOP);
  const maxLex = lexTop[0]?.score || 1;
  const byIndex = new Map<number, { rec: DocsRecord; lex: number; matched: number; cos: number | null }>();
  for (const s of lexTop) byIndex.set(s.i, { rec: s.rec, lex: s.score, matched: s.matched, cos: null });
  for (const [i, cos] of sem) {
    const row = byIndex.get(i);
    if (row) { row.cos = cos; continue; }
    const rec = entries[i]?.rec;
    if (rec) byIndex.set(i, { rec, lex: 0, matched: 0, cos });
  }
  const blended = [...byIndex.values()].map((r) => ({
    rec: r.rec,
    matched: r.matched,
    score: 0.5 * (r.lex / maxLex) + 0.5 * (r.cos === null ? 0 : (r.cos + 1) / 2),
  }));
  blended.sort((a, b) => b.score - a.score || b.matched - a.matched);
  return blended.slice(0, limit).map(({ rec, score }) => ({ rec, score }));
}

/** One provider's contribution to an answer. */
export interface ProviderHitGroup { group: SearchGroupId; hits: SearchHit[] }

/** Ask every registered provider (except `ask`) the tokens; drop empty groups. */
export async function retrieveProviderHits(tokens: readonly string[]): Promise<ProviderHitGroup[]> {
  if (!tokens.length) return [];
  const groups = await Promise.all(
    searchProviders()
      .filter((p) => p.id !== 'ask')
      .map(async (p): Promise<ProviderHitGroup> => ({
        group: p.id,
        hits: await p.search(tokens, GROUP_CAP).catch(() => []),
      })),
  );
  return groups.filter((g) => g.hits.length > 0);
}
