// SPDX-License-Identifier: MPL-2.0
/**
 * Leaving a tool without saving (plan 277 P1). Andy's decision of 27 September
 * 2026: "clear the work, the user intends to discard it when they click leave
 * without saving." Three jobs, kept here rather than in the tool view's session
 * module:
 *
 * 1. discardUnsavedWork: in the tools with automatic history, stop the writer and
 *    return the saved record to its last explicit save, or move a creation that was
 *    never explicitly saved out of Projects. The other tools wrote nothing, so they
 *    have nothing to undo.
 * 2. leftEntryHref / rewriteLeftEntry: the browser entry being left is rewritten,
 *    so Back returns to the saved item, or to the tool as it was opened, and never
 *    to discarded edits kept in the address bar.
 * 3. markEntryUnsaved / entryHoldsUnsavedEdits: an edit that comes back with the
 *    page address (a reload, Back or Forward) still counts as unsaved.
 *
 * Live collaboration and shared mounts have no local history and keep the old
 * behaviour: the caller checks localDocument() first.
 *
 * A document that belongs somewhere else (a team project, lib/document-scope.ts) is
 * different again (plan 75 J6 step 6): the dialog asks "Save changes to Brand
 * refresh?" ({@link leaveQuestion}), Save writes to the project, and Leave without
 * saving means "not to the project", so the device draft automatic history made is
 * kept rather than discarded, and Back returns to the draft.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { WebStateAPI } from '../bridge/state.ts';
import type { DiscardResult } from '../bridge/revision-history.ts';
import type { AutomaticHistory } from './automatic-history.ts';
import { getCollabSessionSource } from '../lib/collab-session-source.ts';
import { markSyncDirty } from '../lib/sync-service.ts';
import { overlaysClosed } from '../lib/overlay-back.ts';
import { documentLeavePrompt, documentScopeClaimed } from '../lib/document-scope.ts';

/** The history.state key that says an entry's address holds edits nobody saved. */
const UNSAVED_KEY = 'lollyUnsaved';
/** Link params that act once on open, so Back must not replay them. `slot` goes too:
 *  an entry that keeps a creation says so with its own `?slot=`. */
const ONE_SHOT_PARAMS = ['slot', 'export', 'copy', 'share'];

/** A local document: not a live collaboration, not a shared or guest mount. */
export function localDocument(opts: { collab: unknown; ephemeral: unknown }): boolean {
  return !opts.collab && !opts.ephemeral && !getCollabSessionSource();
}

/**
 * Discard the edits a Leave without saving throws away. Returns the slot the tool
 * still has a saved creation at (so the entry can point Back at it), or null when
 * there is none: never saved, or just moved out of Projects.
 */
export async function discardUnsavedWork(opts: {
  host: Pick<HostV1, 'state'>;
  controller?: AutomaticHistory;
  slot(): string | null;
  /** Take the creation out of any Projects folder once it has left Projects. */
  unfile?(slot: string): Promise<void>;
  /** Keep the device draft instead of discarding the draft. Defaults to whether the
   *  document belongs somewhere else (a team project). */
  keep?: boolean;
}): Promise<{ outcome: DiscardResult['outcome']; kept: string | null }> {
  if (!opts.controller) return { outcome: 'unchanged', kept: opts.slot() };
  // Closing protects the latest edits as a checkpoint first, so History has them
  // all, and stops the teardown flush from writing them back afterwards.
  await opts.controller.close();
  const slot = opts.slot();
  if (opts.keep ?? documentScopeClaimed()) return { outcome: 'unchanged', kept: slot };
  const history = (opts.host.state as WebStateAPI).history;
  if (!slot || !history?.discard) return { outcome: 'unchanged', kept: slot };
  const { outcome } = await history.discard(slot);
  if (outcome !== 'unchanged') markSyncDirty();
  if (outcome === 'removed') await opts.unfile?.(slot).catch(() => { /* a stale folder entry is harmless */ });
  return { outcome, kept: outcome === 'removed' ? null : slot };
}

/** Where the entry being left should point: the kept creation, else the tool's
 *  launch address without its one-shot params. */
export function leftEntryHref(base: string, launchQuery: string | null | undefined, kept: string | null): string {
  if (kept) return `${base}?slot=${encodeURIComponent(kept)}`;
  const params = new URLSearchParams((launchQuery ?? '').replace(/^\?/, ''));
  for (const key of ONE_SHOT_PARAMS) params.delete(key);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

type EntryState = Record<string, unknown>;
const entryState = (): EntryState => {
  const state: unknown = history.state;
  return state && typeof state === 'object' ? { ...(state as EntryState) } : {};
};

/** Rewrite the current entry (the tool being left) to `href`. A kept creation is
 *  remembered as an explicit open; anything else forgets the document slot. */
export function rewriteLeftEntry(href: string, toolId: string, kept: string | null): void {
  const state = entryState();
  delete state[UNSAVED_KEY];
  if (kept) state.lollyHistory = { toolId, slot: kept, explicit: true };
  else delete state.lollyHistory;
  history.replaceState(state, '', href);
}

/** Record on the current entry whether its address holds unsaved edits of `toolId`. */
export function markEntryUnsaved(toolId: string, unsaved: boolean): void {
  const current = entryState();
  if (unsaved ? current[UNSAVED_KEY] === toolId : !(UNSAVED_KEY in current)) return;
  if (unsaved) current[UNSAVED_KEY] = toolId;
  else delete current[UNSAVED_KEY];
  history.replaceState(current, '', location.href);
}

/** Tools with a second mark write waiting for overlays to close. */
const markWaiting = new Set<string>();

/**
 * Keep the entry's mark in step with `unsaved()`: now, and again once every open
 * overlay has closed and its Back entry has been popped. A save made from a dialog
 * (Save as) runs while that dialog's same-URL copy is the current entry, so a mark
 * written only then would change the copy and leave the tool's entry marked.
 * `live()` stops the second write once the tool has been left.
 */
export function syncEntryMark(toolId: string, unsaved: () => boolean, live: () => boolean): void {
  if (!live()) return;
  markEntryUnsaved(toolId, unsaved());
  if (markWaiting.has(toolId)) return;
  markWaiting.add(toolId);
  void overlaysClosed().then(() => { markWaiting.delete(toolId); if (live()) markEntryUnsaved(toolId, unsaved()); });
}

/** True when the current entry was left with unsaved edits of `toolId`. */
export function entryHoldsUnsavedEdits(toolId: string): boolean {
  return entryState()[UNSAVED_KEY] === toolId;
}

/** The Unsaved changes dialog's question over a document that belongs somewhere else
 *  ("Save changes to Brand refresh?"), or null for the ordinary dialog. */
export function leaveQuestion(): string | null {
  return documentLeavePrompt();
}
