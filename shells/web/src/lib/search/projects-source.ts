// SPDX-License-Identifier: MPL-2.0
/**
 * The projects search source (plans/99 M2) - the ONE definition of how a saved
 * session or folder is matched, and how a session opens, shared by BOTH
 * views/projects.ts and the spotlight's projects provider
 * (lib/search/providers/projects.ts). Extracted per plans/99 section 8 M2 so the two
 * surfaces cannot drift: same haystack, same token semantics, same open target.
 *
 * Matching is lib/search's folded token-AND (plans/99 principle 1) - this is
 * the deliberate migration off the view's old substring `.includes()`: a query
 * of several words now requires every word to hit (in any field), and
 * diacritics fold (a session named "Café menu" matches "cafe"). Haystacks are
 * built ONCE per data load (the prebuilt-index pattern the view always used)
 * and come out pre-folded, so per-query work is scan-only.
 */

import { fold, scoreHaystack } from './match.ts';

/** The slice of a host.state.list() row the haystack reads (WebStateAPI rows
 *  carry more; `filename` is `string | null` there, hence the loose types). */
export interface SessionSearchEntry {
  slot: string;
  toolId: string;
  label?: string | null;
  filename?: string | null;
}

/**
 * A session's search haystack: display title parts (label, filename), the
 * tool's display name and id, and the literal 'batch' keyword for batch
 * sessions (so "batch" surfaces every batch grid - the view's long-standing
 * semantics, preserved verbatim). Pre-folded; match with matchesHaystack.
 */
export function buildSessionHaystack(
  entry: SessionSearchEntry,
  toolName: (id: string) => string,
  isBatch: boolean,
): string {
  return fold(
    [entry.label, entry.filename, toolName(entry.toolId), entry.toolId, isBatch ? 'batch' : '']
      .filter(Boolean)
      .join(' '),
  );
}

/** A folder's haystack: its folded name plus any user tags (2026-08-20) -
 *  tagging a folder "client, q3" makes it findable by either word. */
export function buildFolderHaystack(name: string, tags?: readonly string[]): string {
  return fold([name, ...(tags ?? [])].join(' '));
}

/**
 * Score a prebuilt (folded) haystack against tokenize()d query tokens - the
 * single-field, weight-1 form of scoreHaystack. 0 = no match (AND semantics:
 * every token must hit); positive = match, usable as a spotlight hit score.
 */
export function matchesHaystack(haystack: string, tokens: readonly string[]): number {
  return scoreHaystack([{ text: haystack, weight: 1 }], tokens);
}

// ── Opening a session (the projects tile's semantics) ───────────────────────

/**
 * One-shot marker read + cleared by the tool view on mount: the tool's Save
 * button returns to this URL instead of the gallery. sessionStorage so it
 * survives the navigation to the tool and dies with the tab. Owned here (not in
 * views/projects.ts) so the view's disarm-on-mount and every arm site share the
 * literal key.
 */
export const RETURN_KEY = 'lolly:returnTo';

/** Arm the one-shot Save-return target (a navigateTo-compatible URL, e.g.
 *  '/#/p' or '/#/p/<folderId>'). Silently a no-op in private mode. */
export function armSessionReturn(returnTo: string): void {
  try { sessionStorage.setItem(RETURN_KEY, returnTo); } catch { /* private mode */ }
}

/**
 * Where opening a saved session navigates - exactly what a projects tile does:
 * a batch session opens its grid in /pro; a single-tool session resumes its
 * tool with the saved slot. Callers pass `isBatch` (lib/batch-slots.ts
 * isBatchSlot) so this module stays a leaf.
 */
export function sessionOpenHref(entry: { slot: string; toolId: string }, isBatch: boolean): string {
  return isBatch
    ? `#/batch?session=${encodeURIComponent(entry.slot)}`
    : `#/tool/${entry.toolId || ''}?slot=${encodeURIComponent(entry.slot)}`;
}
