// SPDX-License-Identifier: MPL-2.0
/**
 * collab-launch - a generic seam for opening a collab's invite/ceremony flow,
 * per plans/100 section 0's two flavours ("Work collab" / "Private collab").
 *
 * The sibling of lib/approval-request.ts one purpose over - same last-wins
 * single-opener shape - except a collab has TWO independent openers, one per
 * track, because the two flows are structurally different (section 1): a work collab
 * (org rooms, Track B) is registered from `org/` when the control plane grants
 * it; a private collab (P2P, Track A) is an OSS individual feature registered
 * from the ceremony UI, never from `org/`. Keeping them as two named slots
 * (rather than one opener the caller has to disambiguate) is what lets
 * `org/collab-share.ts` and `lib/collab-share-private.ts` each know, without
 * consulting the other, whether THEIR row has anything to open.
 *
 * STALENESS NOTE (2026-08-09): the two slots no longer share one dormant story,
 * and this header used to claim they did. NEITHER is dormant-by-default any more,
 * but they stop being dormant in different ways and for different reasons.
 *
 * The `'work'` slot is registered by `org/collab-work-opener.ts`, from `org/`'s
 * member branch, and ONLY on an instance whose control plane grants `collab.join`
 * (section 7 item 9). So on a plain deployment - no control plane at all, which is every
 * public build - `getCollabOpener('work')` still returns `undefined`,
 * `openCollabLaunch('work', …)` is still a no-op returning `false`, and
 * `org/collab-share.ts`'s row still renders nothing. That is dormancy by ABSENCE
 * of an instance, not by absence of code, and it is the shape every `org/`
 * registration in this shell has.
 *
 * The `'private'` slot is NOT dormant by default any more: `collab/private-
 * opener.ts` registers it unconditionally as a side effect of being imported, and
 * `main.ts` imports it for exactly that effect (wave 2.4, plans/100 section 6.1) - so on
 * every boot of this app `getCollabOpener('private')` returns a real function,
 * not `undefined`. What the flag decides is what that function DOES, not whether
 * it exists: it checks `isFlagOnSync(PRIVATE_COLLAB_FLAG)` itself and returns
 * before touching a peer connection when the flag is off, so
 * `lib/collab-share-private.ts`'s row is silent for anyone who turned it off (or
 * whose instance governs it off). Since 2026-08-10 that flag is ON by default, so
 * the shipped state is a working row - but the split is unchanged and still
 * deliberate: the flag gates BEHAVIOUR, registration happens either way (see
 * `private-opener.ts`'s own header - a flag flipped in the profile must work
 * without a reload, in both directions).
 */

/** The two collab flavours, matching plans/100 section 0's naming exactly. */
export type CollabTrack = 'private' | 'work';

/** The small, product-neutral context an opener needs to start the ceremony
 *  for the session the Share dialog is currently open on. Mirrors
 *  lib/share-sections.ts's ShareSectionContext minus the clipboard helper,
 *  which a ceremony dialog has no use for. */
export interface CollabLaunchContext {
  /** The tool the session belongs to. */
  toolId?: string;
  /** The query parts the dialog serialised the current state into ("key=value") - 
   *  what the invite ultimately needs to seed the acceptor/joiner's session. */
  baseParts: readonly string[];
  /** The export format the session implies, if any. */
  currentFormat?: string;
  /**
   * The id of the session AS THE CONTROL PLANE HOLDS IT, when this mount came from
   * one (`org/session-source.ts`'s `TeamSessionRef.id`). Absent for every ordinary
   * local session, which is the common case and the reason it is optional.
   *
   * A work collab is a room keyed by that id (plans/100 section 7), so the `'work'` opener
   * cannot start one without it - while a private collab never uses it at all, since
   * Track A pairs two devices rather than joining a server room. Hence a field on the
   * shared context rather than a second opener signature: the two tracks read the
   * parts of it they need.
   *
   * POPULATED BY ONE PATH ONLY, and never guessed. The Projects view opens a team
   * session by fetching it and rewriting the hash to `#/tool/<id>?<serialised state>`
   * (`views/projects.ts`'s `openTeamSession`) - a faithful working copy that has
   * deliberately forgotten where it came from, since the id is not an input and has no
   * business in a shareable link. So the open stashes it beside the navigation
   * (`org/team-session-origin.ts`), the tool view spends the stash at mount, and
   * `org/collab-share.ts`'s row reads it back when the user presses "Start a collab".
   * Everything else - a local session, a deep link, a reload of a team session, a
   * remount - leaves the field ABSENT, and the `'work'` opener's honest refusal
   * ("this mount is not a team session") is the answer there. The invite deep link,
   * which carries the id in the message, remains the durable path.
   */
  sessionId?: string;
}

/** Opens the given track's collab ceremony/join flow for the given context. */
export type CollabOpener = (ctx: CollabLaunchContext) => void;

const openers: Partial<Record<CollabTrack, CollabOpener>> = {};

/** Register a track's opener; returns an unregister fn. A later register for
 *  the SAME track replaces the current one (last wins) - the two tracks never
 *  interfere with each other. */
export function registerCollabOpener(track: CollabTrack, fn: CollabOpener): () => void {
  openers[track] = fn;
  return () => { if (openers[track] === fn) delete openers[track]; };
}

/** The opener registered for a track, or `undefined` (see the header for what
 *  "dormant" now means per track - absence of an instance for `'work'`, versus
 *  a flag check inside an opener that is always there for `'private'`). Callers
 *  use this to gate visibility (a row with nothing to open must not render). */
export function getCollabOpener(track: CollabTrack): CollabOpener | undefined {
  return openers[track];
}

/**
 * Open a track's collab flow, or do nothing when no opener is registered for
 * it (the dormant default). Returns whether an opener handled it. Tolerant: a
 * throwing opener is swallowed so a consulting row can never break the Share
 * dialog on it - mirrors lib/approval-request.ts's openApprovalRequest.
 */
export function openCollabLaunch(track: CollabTrack, ctx: CollabLaunchContext): boolean {
  const fn = openers[track];
  if (!fn) return false;
  try { fn(ctx); return true; } catch { return false; }
}

/** TEST-ONLY: drop any registered openers, restoring the dormant default. */
export function _clearCollabOpenersForTests(): void {
  delete openers.private;
  delete openers.work;
}
