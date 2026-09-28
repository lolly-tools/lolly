// SPDX-License-Identifier: MPL-2.0
/**
 * What the view that opened a saved document already knew about it: its name and its
 * thumbnail, as the tile showed them. The tool view reads this for its "Opening…"
 * card (components/open-progress.ts) so the card can name and picture the document
 * straight away. Reading them from storage instead would mean `host.state.list()`,
 * which reads every saved record, at exactly the moment a large one is loading.
 *
 * One-shot and in memory: the next mount takes it, and it only counts for the slot it
 * was noted for, so a stale note can never name a different document.
 */

export interface OpenIntent {
  slot: string;
  name?: string;
  thumb?: string | null;
}

let pending: OpenIntent | null = null;

/** Called by an opener just before it navigates to the tool route for `slot`. */
export function noteOpenIntent(intent: OpenIntent): void {
  pending = intent;
}

/** The fields of a saved-session row (a `host.state.list()` entry) that the note is built from. */
export interface OpenIntentRow {
  label?: string | null;
  filename?: string | null;
  thumb?: string | null;
}

/**
 * Note `slot` from the row its tile was drawn from: the row's label, else its filename,
 * else `fallbackName`, and the row's thumbnail. Openers call this rather than building
 * the note by hand, so every list gives a document the same name.
 */
export function noteSessionOpen(slot: string, row: OpenIntentRow | undefined, fallbackName?: string): void {
  noteOpenIntent({ slot, name: row?.label || row?.filename || fallbackName || undefined, thumb: row?.thumb });
}

/** The note for `slot`, or null. Always spends the note, matching or not. */
export function takeOpenIntent(slot: string): OpenIntent | null {
  const note = pending;
  pending = null;
  return note && note.slot === slot ? note : null;
}
