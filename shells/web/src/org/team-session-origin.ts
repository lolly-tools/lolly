// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-session-origin.ts - where a mounted tool CAME FROM, when it came from a
 * team session on the instance (plans/100 section 7; the stitch-2 gap named in
 * `lib/collab-launch.ts`'s `CollabLaunchContext.sessionId`).
 *
 * ── The gap this closes ────────────────────────────────────────────────────────
 *
 * The Team-projects modal opens a session by FETCHING it and rewriting the hash to
 * `#/tool/<id>?<serialised state>` (`views/projects.ts`'s `openTeamSession`). That
 * rewrite is a faithful working copy and a deliberate amnesiac: the instance's id for
 * the session survives nowhere in the route, the runtime, or the slot, so by the time
 * the Share dialog builds a `CollabLaunchContext` the id is genuinely unknowable from
 * anything the tool view holds - and the `'work'` opener, whose whole prerequisite is
 * that id (a work collab is a room keyed by it), could only refuse.
 *
 * So the id travels beside the navigation instead of inside it: a one-shot stash armed
 * by the open and spent by the mount it was armed for. The same shape as the other
 * hand-offs that cross this exact seam - `lib/collab-live-mount.ts`'s
 * `carryMountState`/`takeCarriedMountState` and the drop router's stash-then-route - 
 * and for the same reason: the route is a lossy encoder, and some facts about a mount
 * are not input values and have no business being serialised into a shareable link.
 * A team session's id is one of them: it is an instance-side identifier, not part of
 * the creative state, and putting it in the URL would make it a thing users copy.
 *
 * ── Two states, both deliberately small ────────────────────────────────────────
 *
 *  - `pending` - armed by {@link rememberTeamSessionOrigin} in the window between the
 *    open and the mount. Spent by the FIRST {@link consumeTeamSessionOrigin}, whether
 *    or not it matches: a mount of a different tool means the navigation this stash
 *    was armed for never happened, and a stash that outlives its window is exactly how
 *    an unrelated later mount inherits someone else's session id.
 *  - `active` - what that consume promoted, for the life of the mount that consumed
 *    it. Read (never taken) by {@link activeTeamSessionOrigin}, which requires the
 *    caller to name the tool it is asking about, so an origin can only ever answer for
 *    the tool it belongs to.
 *
 * ── The honesty rules (why this file is so cautious) ───────────────────────────
 *
 * The failure mode worth designing against is not "the id is missing" - the opener
 * already has an honest sentence for that - it is **an id that is present and wrong**,
 * which silently opens a room on somebody else's session. Hence:
 *
 *  1. **Every mount consumes.** A non-matching consume clears BOTH states, so a stash
 *     can never survive into the mount after next, and an origin never outlives the
 *     mount that earned it.
 *  2. **A remount never resurrects one.** The collab adoption path force-remounts the
 *     same tool (`lib/collab-live-mount.ts`), and an acceptor's remount is a document
 *     seeded by a PEER - the same tool id, a completely different session. Since the
 *     stash is already spent, that remount consumes nothing and clears `active`. The
 *     origin is lost rather than re-asserted; losing it costs an honest refusal, and
 *     keeping it would cost a wrong room.
 *  3. **The mount releases it on teardown** ({@link releaseTeamSessionOrigin}), so a
 *     Share dialog opened somewhere else later - the Projects view can share a LOCAL
 *     session of the same tool - cannot read an origin from a mount that is gone.
 *  4. **Reloading the tab loses it**, and that is accepted, not worked around. Nothing
 *     here is persisted: `sessionStorage` would survive a reload and thereby survive
 *     every guarantee above. The durable path to a work collab is the invite deep link,
 *     which carries the id in the message (section 7 item 9) - this stash only makes the
 *     in-app "I am already looking at that session" path work.
 *
 * Module state, not a DOM/storage/network surface: this file imports nothing, which is
 * why `views/` may statically import it without dragging the control plane onto the
 * boot path. It lives under `org/` because the fact it carries is control-plane
 * awareness - an id only an instance issues - and the generic seams it threads between
 * (`lib/share-sections.ts`, `lib/collab-launch.ts`) stay product-neutral by not
 * learning about it. `org/collab-share.ts` is the only reader.
 */

/** Where a mounted tool came from, as the instance holds it. */
export interface TeamSessionOrigin {
  /** The instance's id for the session (`TeamSessionRef.id`) - the room key. */
  readonly sessionId: string;
  /** The tool the session opened into; every read must match it. */
  readonly toolId: string;
  /** The team project it was opened from, when the opener knew one. Recorded but
   *  not yet read: a work collab is keyed by the session alone, and the project is
   *  what a future invite/announcement would name it BY. Optional so a caller that
   *  cannot name one does not have to invent one. */
  readonly projectId?: string;
}

/** Armed by the open, spent by the next mount. */
let pending: TeamSessionOrigin | null = null;
/** What the mount that consumed a matching stash is holding, for as long as it lives. */
let active: TeamSessionOrigin | null = null;

/**
 * Arm the stash for the mount that is ABOUT to happen - call it immediately before
 * navigating, never speculatively.
 *
 * A blank session or tool id arms nothing (and clears any previous arm): an origin
 * that cannot name both halves can never be matched, so holding it would only be a
 * chance for the next mount to spend a stash it shouldn't.
 */
export function rememberTeamSessionOrigin(origin: {
  sessionId: string;
  toolId: string;
  projectId?: string;
}): void {
  const sessionId = String(origin.sessionId ?? '').trim();
  const toolId = String(origin.toolId ?? '').trim();
  if (!sessionId || !toolId) { pending = null; return; }
  const projectId = String(origin.projectId ?? '').trim();
  pending = { sessionId, toolId, ...(projectId ? { projectId } : {}) };
}

/**
 * ONE-SHOT: spend the stash for the mount now starting, and return it when it was
 * armed for THIS tool (`null` for every mount that is not a team-session open, which
 * is nearly all of them).
 *
 * Called once per mount, as early as possible, whatever the mount turns out to be - 
 * that is what bounds the stash to its window (rule 1 in the header). The returned
 * value is a convenience for the caller; the module keeps it, so nothing has to be
 * threaded through the view.
 */
export function consumeTeamSessionOrigin(toolId: string): TeamSessionOrigin | null {
  const stash = pending;
  pending = null;
  active = stash && stash.toolId === toolId ? stash : null;
  return active;
}

/**
 * The origin of the LIVE mount of `toolId`, or `null`.
 *
 * The tool id is required (an absent one reads as `null`): the caller is the Share
 * dialog's "Work collab" row, whose context resolves its tool from the address bar,
 * and an origin that cannot be shown to belong to the tool being shared is exactly the
 * present-and-wrong id this module exists to prevent.
 */
export function activeTeamSessionOrigin(toolId: string | null | undefined): TeamSessionOrigin | null {
  if (!active || !toolId || active.toolId !== toolId) return null;
  return active;
}

/** Drop the live mount's origin - called from the tool view's teardown, so an origin
 *  never outlives the mount that earned it (rule 3). Idempotent. */
export function releaseTeamSessionOrigin(): void {
  active = null;
}

/** Diagnostics: is a stash armed and unspent? (Also how a test proves one-shot.) */
export function pendingTeamSessionOrigin(): TeamSessionOrigin | null {
  return pending;
}

/** TEST-ONLY: drop both states. */
export function _clearTeamSessionOriginForTests(): void {
  pending = null;
  active = null;
}
