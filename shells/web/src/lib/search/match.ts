// SPDX-License-Identifier: MPL-2.0
/**
 * The shared search matcher (plans/99-unified-search.md M0) - the ONE place
 * query text is folded, tokenized and scored against a haystack. Every search
 * surface in the shell (gallery, catalogue, projects, picker, the spotlight
 * overlay's providers) converges on this module; no new surface may hand-roll
 * its own `.toLowerCase().includes()` (plans/99 principle 1).
 *
 * Contract:
 *  - `fold` is the single normalization: lowercase, NFD, combining marks
 *    stripped (é→e, and Arabic harakat etc. via \p{M}), ß→ss. Both sides of a
 *    match must be folded - callers pre-fold their haystacks ONCE when built
 *    (the prebuilt-haystack pattern projects/catalogue already use), and
 *    `tokenize` folds the query.
 *  - `scoreHaystack` is AND-across-tokens: every token must hit at least one
 *    field or the whole item scores 0. Each token contributes its best field's
 *    weight, doubled when the token matches at a word boundary (a prefix of a
 *    word). No word segmentation - CJK matches as a plain substring, which is
 *    deliberate (plans/99 principle 6: segmentation is out of scope).
 */

/** The one debounce every search field shares (was 120/110/120ms per view). */
export const SEARCH_DEBOUNCE_MS = 120;

/** A weighted haystack field. `text` MUST already be folded (see fold). */
export interface SearchField {
  text: string;
  weight: number;
}

/** Lowercase + strip diacritics/combining marks + ß→ss. Idempotent. */
export function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '').replace(/ß/g, 'ss');
}

/** Fold a query and split it into non-empty whitespace-delimited tokens. */
export function tokenize(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

// A "word" character for the boundary-prefix bonus: any Unicode letter or digit.
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** 0 = no match, 1 = substring, 2 = matches at a word boundary (word prefix). */
function matchQuality(text: string, token: string): 0 | 1 | 2 {
  let i = text.indexOf(token);
  if (i === -1) return 0;
  while (i !== -1) {
    if (i === 0 || !WORD_CHAR.test(text[i - 1]!)) return 2;
    i = text.indexOf(token, i + 1);
  }
  return 1;
}

/**
 * Score an item's fields against a tokenized query.
 *
 * AND semantics: every token must match at least one field, else 0. Each
 * matching token contributes the best available `weight` across the fields - 
 * doubled where it hits a word boundary - and the item's score is the sum.
 * An empty token list scores 0 (an empty query means "don't rank", not
 * "everything matches" - callers gate on query length before ranking).
 */
export function scoreHaystack(fields: readonly SearchField[], tokens: readonly string[]): number {
  if (!tokens.length) return 0;
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const field of fields) {
      const quality = matchQuality(field.text, token);
      if (!quality) continue;
      const contribution = quality === 2 ? field.weight * 2 : field.weight;
      if (contribution > best) best = contribution;
    }
    if (!best) return 0;
    total += best;
  }
  return total;
}
