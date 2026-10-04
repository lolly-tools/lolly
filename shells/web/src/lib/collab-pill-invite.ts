// SPDX-License-Identifier: MPL-2.0
/**
 * collab-pill-invite - a generic seam for the collab pill's invite button
 * (`components/collab-pill.ts`'s `onInvite` slot), the sibling of lib/collab-launch.ts.
 *
 * The pill renders an invite button only when its caller supplies `onInvite`, and the
 * caller is `views/tool-collab.ts`, which must not learn about the control plane. A
 * work collab's invite needs exactly that: the id the instance holds for the session,
 * who may be invited to it, and a request to the instance. So `org/` registers a
 * provider here (org/collab-invite.ts, "Invite to edit now"), and the tool view asks
 * it, once per pill, what the button does.
 *
 * Same rules as the other single-provider seams: one registrant, last wins, dormant by
 * default. With nothing registered, every collab pill renders no invite button, which
 * is what it did before this seam existed. A private collab gets no button either:
 * the provider answers null for a mount that is not a team session, and the private
 * track invites through its own ceremony.
 *
 * A throwing provider, or an action that throws when pressed, is swallowed: the pill
 * sits over a live tool, and nothing about an invite may take that down.
 */

import type { CollabRole } from './collab-session.ts';

/** What the tool view knows about the pill it is about to mount. */
export interface CollabPillInviteContext {
  /** The mounted tool (its manifest id). */
  readonly toolId: string;
  /** This client's role in the collab, read when called: an observer can watch but
   *  not edit, so it is not offered an invite to edit. */
  role(): CollabRole;
}

/** Answers, for one pill, what its invite button does, or null for no button. */
export type CollabPillInviteProvider = (ctx: CollabPillInviteContext) => (() => void) | null;

let provider: CollabPillInviteProvider | undefined;

/** Register the provider (last wins); returns an unregister fn. */
export function registerCollabPillInvite(fn: CollabPillInviteProvider): () => void {
  provider = fn;
  return () => { if (provider === fn) provider = undefined; };
}

/**
 * The pill's `onInvite` for this mount, or null when nothing is registered or the
 * provider offers no invite here. Tolerant in both directions (see the header).
 */
export function collabPillInviteFor(ctx: CollabPillInviteContext): (() => void) | null {
  if (!provider) return null;
  let action: (() => void) | null;
  try { action = provider(ctx); } catch { return null; }
  if (typeof action !== 'function') return null;
  const run = action;
  return () => {
    try { run(); } catch { /* an invite must never break the pill */ }
  };
}

/** TEST-ONLY: drop the registered provider, restoring the dormant default. */
export function _clearCollabPillInviteForTests(): void {
  provider = undefined;
}
