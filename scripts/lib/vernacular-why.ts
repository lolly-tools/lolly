// SPDX-License-Identifier: MPL-2.0
/**
 * The one explanation every vernacular gate prints when it fails, so a person
 * who has never met these checks can tell in ten seconds what was flagged and why.
 *
 * Three gates share it: check-docs-vernacular.ts (English docs sources),
 * check-code-comment-vernacular.ts (comments in the owned TypeScript) and
 * check-ui-copy-vernacular.ts (strings a person reads in the app). Keep this
 * text plain and short; it is the first thing a sceptic reads.
 */

export const VERNACULAR_WHY = `
Why this check exists
  Much of this repo is written with AI assistance, and AI-written text has
  habits a reader recognises: em dashes, filler phrases ("seamless",
  "worth noting", "at the end of the day") and a few words nobody says out
  loud. Readers notice, and the product's promise is output a person
  directed. Every doc page is also machine-translated into 26 languages,
  where those habits translate badly. The maintainer asked for them gone
  and kept gone (2026-08-16).

What it checks
  A fixed list of characters and phrases, matched literally. No model judges
  your text. It reads wording only and never runs or tests behaviour.

Why it is a ratchet
  The tree started with tens of thousands of hits, so the baseline records a
  per-file count that may only go down. A new file must be clean. A file you
  improve must lower its recorded count (run the script with --write after a
  reviewed fix). A file that regresses fails.

How to pass
  Reword the flagged lines in plain English. Replace an em dash with a comma,
  a full stop or " - ". The full phrase list is BANNED_PHRASES in
  scripts/check-docs-vernacular.ts, with the rules for a literal-use ALLOW entry
  in that file's header.
`.trimEnd();

/** Print the explanation once, after a gate's per-line findings. */
export function printVernacularWhy(): void {
  console.error(VERNACULAR_WHY);
}
