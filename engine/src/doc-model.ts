// SPDX-License-Identifier: MPL-2.0
/**
 * doc-model.ts - the ONE block model every document reader produces and every
 * document serialiser consumes. Types only: no logic, no imports, no runtime cost.
 *
 * Lolly already had two independent markdown emitters (`epub-read.ts`,
 * `pdf-text.ts`) and plan 139 adds a docx reader plus two serialisers. Rather
 * than a third and fourth private shape, readers target THIS model and
 * `doc-md.ts` owns the output conventions. A reader decides what a document
 * MEANS; the serialiser decides how that meaning is written.
 *
 * ── STRUCTURE ────────────────────────────────────────────────────────────────
 *   • {@link DocInline} is a nested tagged union: a run carrying bold + italic is
 *     `strong{ em{ text } }`, not a flat run with a mark set. Nesting is what lets
 *     a serialiser wrap without bookkeeping, and it round-trips through HTML.
 *   • {@link DocBlock} is flat and ordered - the document is a block list, not a
 *     tree. A table cell holds inlines only; a nested table flattens into its
 *     parent cell's text (see docx-read.ts) rather than nesting the model.
 *   • Ids on `footnote` / `footnoteRef` are STRINGS because a serialiser prints
 *     them verbatim (`[^3]`). Readers remap producer ids to a sequential
 *     "1", "2", "3" so the emitted document is self-consistent.
 *
 * No block or inline carries geometry, styling or colour: this is the CONTENT
 * projection, the deliberate other half of `pptx-read.ts`'s positioned read-model.
 * Re-flowing into a brand template needs meaning; patching a file in place needs
 * position, and that path has its own model.
 */

/** One inline run. Nesting expresses combined emphasis (`strong{ em{ text } }`). */
export type DocInline =
  | { type: 'text'; text: string }
  | { type: 'strong'; inlines: DocInline[] }
  | { type: 'em'; inlines: DocInline[] }
  /** Underline has no GFM spelling: `mdFromBlocks` drops it to plain text, HTML keeps `<u>`. */
  | { type: 'underline'; inlines: DocInline[] }
  | { type: 'strike'; inlines: DocInline[] }
  /** A code SPAN. Its text is literal: serialisers never parse markup inside it. */
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; inlines: DocInline[] }
  /** Reference to a {@link DocBlock} of type `footnote` with the same `id`. */
  | { type: 'footnoteRef'; id: string }
  /** Hard line break WITHIN a block (a paragraph's `w:br`, not a paragraph split). */
  | { type: 'br' };

/** One list entry. `level` is 0-based nesting depth, not an indent width. */
export interface DocListItem {
  level: number;
  inlines: DocInline[];
}

/** One table cell. `colspan`/`rowspan` are absent (not 1) when the cell is plain. */
export interface DocTableCell {
  inlines: DocInline[];
  colspan?: number;
  rowspan?: number;
}

/** A media part a reader found, with the stable name the emitted document cites.
 *  `path` is the container-internal part path so a caller can materialise bytes;
 *  `name` is what the `image` block's `ref` says. Mirrors deckToMarkdown's list. */
export interface DocMedia {
  path: string;
  name: string;
}

/** One block of a document, in reading order. */
export type DocBlock =
  | { type: 'heading'; level: number; inlines: DocInline[] }
  | { type: 'para'; inlines: DocInline[] }
  | { type: 'list'; ordered: boolean; items: DocListItem[] }
  /** `htmlSpans` is set by the producer when any cell merges: it tells a markdown
   *  serialiser that a GFM pipe table cannot express this table. */
  | { type: 'table'; header?: DocTableCell[]; rows: DocTableCell[][]; htmlSpans?: boolean }
  | { type: 'quote'; inlines: DocInline[] }
  | { type: 'code'; lang?: string; text: string }
  | { type: 'image'; ref: string; alt: string }
  | { type: 'footnote'; id: string; inlines: DocInline[] };
