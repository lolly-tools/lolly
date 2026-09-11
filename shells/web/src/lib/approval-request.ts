// SPDX-License-Identifier: MPL-2.0
/**
 * approval-request - a generic seam for opening the "request approval" flow.
 *
 * The sibling of lib/share-sections.ts one purpose over: where that lets a feature
 * register EXTRA sections into the Share dialog, this lets a feature register the
 * opener for an approval-request flow, so the tool view can offer "Request approval"
 * without importing any of the machinery behind it. No opener is registered by
 * default, so `openApprovalRequest` is a no-op returning false and the view is
 * byte-identical until something registers one.
 *
 * It knows nothing about WHO registers the opener: a deployment's optional control
 * plane registers one that opens the approval dialog (see src/org/), but the registry
 * is a standalone primitive - a test or a future feature can drive it the same way.
 * The opener is handed a small, product-neutral context (the tool id, an optional
 * subject reference, and a default title) and owns everything else.
 */

export interface ApprovalRequestContext {
  /** The tool whose output is being submitted for approval. */
  toolId?: string;
  /** A short identifier for the subject being approved (e.g. a saved-session id).
   *  When absent, the flow derives a tool-scoped default. */
  subjectRef?: string;
  /** A sensible default title for the request (e.g. the tool/session name). */
  title?: string;
}

/** Opens the approval-request flow for the given context. */
export type ApprovalOpener = (ctx: ApprovalRequestContext) => void;

let opener: ApprovalOpener | undefined;

/** Register the approval opener; returns an unregister fn. A later register replaces
 *  the current opener (last wins), mirroring a single-owner flow. */
export function registerApprovalOpener(fn: ApprovalOpener): () => void {
  opener = fn;
  return () => { if (opener === fn) opener = undefined; };
}

/**
 * Open the approval-request flow, or do nothing when none is registered (the dormant
 * default). Returns whether an opener handled it. Tolerant: a throwing opener is
 * swallowed so a consulting view can never break on it.
 */
export function openApprovalRequest(ctx: ApprovalRequestContext): boolean {
  if (!opener) return false;
  try { opener(ctx); return true; } catch { return false; }
}

/** TEST-ONLY: drop any registered opener, restoring the dormant default. */
export function _clearApprovalOpenerForTests(): void {
  opener = undefined;
}
