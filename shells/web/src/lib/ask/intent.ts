// SPDX-License-Identifier: MPL-2.0
/**
 * Intent classification for the Ask help surface (plans/103 M0).
 *
 * Three intents decide only the ORDER an answer is assembled in, never which
 * retrieval runs - both the docs retrieve and the provider federation always
 * run (answer.ts), so a misclassified query degrades to a reordering, never to
 * a wrong or missing answer. That is the whole safety argument for a keyword
 * classifier instead of a model here.
 *
 *  - 'find' - "where is…", "open…", "go to…": lead with in-app navigation hits.
 *  - 'make' - "make…", "create…", "convert…": lead with tool hits.
 *  - 'docs' - a question ("how do I…", "what is…") or anything else: lead with
 *              the extracted documentation section. This is the default, because
 *              the honest answer to an ambiguous query is the docs.
 *
 * Classification is over the shared fold/tokenize, so it is diacritic- and
 * case-insensitive exactly like the matcher.
 */
import { tokenize } from '../search/match.ts';

export type AskIntent = 'docs' | 'find' | 'make';

/** Leading verbs that ask to be TAKEN somewhere already in the app. */
const FIND_LEADS = new Set([
  'find', 'open', 'show', 'where', 'goto', 'go', 'take', 'jump', 'navigate', 'switch',
]);

/** Leading verbs that ask to MAKE or transform an asset (→ a tool). */
const MAKE_LEADS = new Set([
  'make', 'create', 'generate', 'build', 'design', 'convert', 'resize', 'compress',
  'remove', 'strip', 'export', 'render', 'add',
]);

/**
 * Classify a raw query. Only the FIRST meaningful token decides - "where is the
 * export button" is a find, "how do I export" is a docs question even though
 * both contain "export". An empty query is 'docs' (the neutral default).
 */
export function classifyIntent(raw: string): AskIntent {
  const tokens = tokenize(raw);
  const head = tokens[0];
  if (!head) return 'docs';
  if (FIND_LEADS.has(head)) return 'find';
  if (MAKE_LEADS.has(head)) return 'make';
  return 'docs';
}
