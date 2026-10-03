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
 *     keeping it would cost a wrong room. A WORK collab is the one remount that names
 *     its own session, because its room is keyed by the session id: just before the
 *     remount, org/collab-work-opener.ts arms the stash with that session (the origin
 *     the collab was started from, or the session an invite names), and the Share
 *     dialog inside the room keeps naming the team session instead of offering to save
 *     the document to a project as a new one.
 *  3. **The mount releases it on teardown** ({@link releaseTeamSessionOrigin}), so a
 *     Share dialog opened somewhere else later - the Projects view can share a LOCAL
 *     session of the same tool - cannot read an origin from a mount that is gone.
 *  4. **Reloading the tab keeps it, and nothing else does** (plan 74, W-SHARE-UI). A
 *     person editing a team session expects "Save changes" to still mean that session
 *     after a reload, so the live origin is mirrored into `sessionStorage` (one tab,
 *     chrome state about where the document came from, never tool state) together with
 *     the address the document is at. sessionStorage outlives EVERY same-tab page load,
 *     not only a reload (a bookmark, a typed address, a docs link, a share link), so the
 *     mirror is read back only when all of these hold: the browser says this load is a
 *     reload or a back/forward step, it is the first tool mount of the load, the tool
 *     matches, and the address matches the one the mirror was written at. Every later
 *     mount follows rules 1 and 2 exactly as before. The mirror is removed whenever the
 *     origin ends inside the page (a mismatched or unarmed mount, a release on
 *     teardown), so going to Projects and opening a local session of the same tool finds
 *     nothing to restore. The one release that keeps it is the one that happens while
 *     the page is being unloaded, which is what a reload is.
 *  5. **A stash carries its address.** The open arms the stash with the address it is
 *     about to navigate to, and only a mount at that address spends it as a match. A
 *     navigation that never remounts (the router applies a same-document change in
 *     place) therefore cannot leave a stash for an unrelated later mount of the tool.
 *
 * Module state plus that one guarded storage key, and no imports: which is why `views/`
 * may statically import it without dragging the control plane onto the boot path. It lives under `org/` because the fact it carries is control-plane
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
  /** The team project it was opened from, when the opener knew one. A work collab is
   *  keyed by the session alone; "Save mine as a copy" files the copy into this project.
   *  Optional so a caller without a project does not have to invent one. */
  readonly projectId?: string;
  /** The revision this document was last loaded or saved at: what "Save changes"
   *  quotes back, so a newer save by someone else is a conflict, not an overwrite. */
  readonly rev?: number;
  /** The session's name on the instance, when known. */
  readonly label?: string;
}

/** What a caller may hand in. Blank strings and non-finite revs are dropped. */
export interface TeamSessionOriginInput {
  sessionId: string;
  toolId: string;
  projectId?: string;
  rev?: number;
  label?: string;
}

/** An armed stash: the origin, and the address the navigation it belongs to opens
 *  (rule 5). No address means the caller did not name one: the tool alone decides. */
interface Armed { origin: TeamSessionOrigin; hash?: string }

/** Armed by the open, spent by the next mount. */
let pending: Armed | null = null;
/** What the mount that consumed a matching stash is holding, for as long as it lives. */
let active: TeamSessionOrigin | null = null;
/** True once this page load's first mount has had its one chance at the mirror. */
let restoreSpent = false;
/** True while the page is being unloaded (a reload or a full navigation away). */
let unloading = false;
/** Bumped by every mount, so a save that resolves after the person moved on can tell. */
let generation = 0;
/** TEST-ONLY: the navigation type a simulated page load reports. */
let loadTypeOverride: string | null = null;

/** The one storage key (rule 4). sessionStorage: one tab, gone with the tab. */
export const TEAM_ORIGIN_STORAGE_KEY = 'lolly:team-origin';

/** The address bar's hash, or '' outside a browser. */
function currentHash(): string {
  try { return String(globalThis.window?.location?.hash ?? globalThis.location?.hash ?? ''); } catch { return ''; }
}

/**
 * One address as a comparable key: the route path plus its query with every
 * view-only param (`_ui`, `_panel` and the rest start with `_`) removed and the rest
 * sorted, so a different encoding or order of the same document still matches. Pure.
 */
export function teamAddressKey(hash: string): string {
  const raw = String(hash ?? '').replace(/^#/, '');
  const q = raw.indexOf('?');
  let path = q < 0 ? raw : raw.slice(0, q);
  try { path = decodeURIComponent(path); } catch { /* keep it as written */ }
  const params = new URLSearchParams(q < 0 ? '' : raw.slice(q + 1));
  for (const key of [...params.keys()]) if (key.startsWith('_')) params.delete(key);
  params.sort();
  return `${path}?${params.toString()}`;
}

/** How this page was loaded, as the browser reports it: 'navigate', 'reload',
 *  'back_forward' or 'prerender'. 'navigate' when the browser cannot say. */
function pageLoadType(): string {
  if (loadTypeOverride) return loadTypeOverride;
  try {
    const perf = globalThis.performance as (Performance & { navigation?: { type?: number } }) | undefined;
    const entry = perf?.getEntriesByType?.('navigation')?.[0] as { type?: string } | undefined;
    if (entry?.type) return entry.type;
    const legacy = perf?.navigation?.type;
    return legacy === 1 ? 'reload' : legacy === 2 ? 'back_forward' : 'navigate';
  } catch {
    return 'navigate';
  }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', () => {
    unloading = true;
    // The address the document is at as the page goes away is the one a reload loads.
    if (active) writeMirror(active);
  });
  // A page restored from the back/forward cache is live again: its releases count.
  window.addEventListener('pageshow', () => { unloading = false; });
  // A view rewrote the address (the document changed): the mirror follows the address.
  window.addEventListener('lolly:url-state', () => { if (active) writeMirror(active); });
}

/** A well-formed origin from loose input, or null when either id is missing. */
function normalise(origin: Partial<TeamSessionOriginInput> | null | undefined): TeamSessionOrigin | null {
  if (!origin || typeof origin !== 'object') return null;
  const sessionId = String(origin.sessionId ?? '').trim();
  const toolId = String(origin.toolId ?? '').trim();
  if (!sessionId || !toolId) return null;
  const projectId = String(origin.projectId ?? '').trim();
  const label = typeof origin.label === 'string' ? origin.label.trim() : '';
  const rev = typeof origin.rev === 'number' && Number.isFinite(origin.rev) ? origin.rev : undefined;
  return {
    sessionId,
    toolId,
    ...(projectId ? { projectId } : {}),
    ...(rev !== undefined ? { rev } : {}),
    ...(label ? { label } : {}),
  };
}

function storage(): Storage | null {
  try { return globalThis.sessionStorage ?? null; } catch { return null; }
}

/** Write the origin to the mirror with the current address, or remove the mirror. */
function writeMirror(origin: TeamSessionOrigin | null): void {
  try {
    const s = storage();
    if (!s) return;
    if (origin) s.setItem(TEAM_ORIGIN_STORAGE_KEY, JSON.stringify({ ...origin, hash: currentHash() }));
    else s.removeItem(TEAM_ORIGIN_STORAGE_KEY);
  } catch { /* storage blocked or full: the origin still lives for this page */ }
}

/** The mirror as an armed stash. One without an address is never restored. */
function readMirror(): Armed | null {
  try {
    const raw = storage()?.getItem(TEAM_ORIGIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TeamSessionOriginInput> & { hash?: unknown };
    const origin = normalise(parsed);
    return origin && typeof parsed.hash === 'string' ? { origin, hash: parsed.hash } : null;
  } catch {
    return null;
  }
}

/** Set the live origin and write the same value to the mirror. */
function setActive(origin: TeamSessionOrigin | null): void {
  active = origin;
  writeMirror(origin);
}

/**
 * Arm the stash for the mount that is ABOUT to happen - call it immediately before
 * navigating, never speculatively.
 *
 * A blank session or tool id arms nothing (and clears any previous arm): an origin
 * that cannot name both halves can never be matched, so holding it would only be a
 * chance for the next mount to spend a stash it shouldn't.
 */
export function rememberTeamSessionOrigin(origin: TeamSessionOriginInput, opts: { hash?: string } = {}): void {
  const armed = normalise(origin);
  pending = armed ? { origin: armed, ...(typeof opts.hash === 'string' ? { hash: opts.hash } : {}) } : null;
}

/**
 * ONE-SHOT: spend the stash for the mount now starting, and return it when it was
 * armed for THIS tool (`null` for every mount that is not a team-session open, which
 * is nearly all of them).
 *
 * Called once per mount, as early as possible, whatever the mount turns out to be - 
 * that is what bounds the stash to its window (rule 1 in the header). The returned
 * value is a convenience for the caller; the module keeps it, so nothing has to be
 * threaded through the view. The first mount of a page load with nothing armed gets
 * one look at the reload mirror (rule 4).
 */
export function consumeTeamSessionOrigin(toolId: string): TeamSessionOrigin | null {
  generation++;
  let stash = pending;
  pending = null;
  // The mirror only for a reload (or a back/forward step) of this page: any other load
  // in the tab is a new document, whatever tool it opens (rule 4).
  if (!stash && !restoreSpent) {
    const type = pageLoadType();
    if (type === 'reload' || type === 'back_forward') stash = readMirror();
  }
  restoreSpent = true;
  const here = currentHash();
  const matches = !!stash && stash.origin.toolId === toolId
    && (stash.hash === undefined || teamAddressKey(stash.hash) === teamAddressKey(here));
  setActive(matches ? stash!.origin : null);
  return active;
}

/**
 * The origin of the LIVE mount of `toolId`, or `null`.
 *
 * The tool id is required (an absent one reads as `null`): the callers are the Share
 * dialog's rows, whose context resolves its tool from the address bar, and an origin
 * that cannot be shown to belong to the tool being shared is exactly the
 * present-and-wrong id this module exists to prevent.
 */
export function activeTeamSessionOrigin(toolId: string | null | undefined): TeamSessionOrigin | null {
  if (!active || !toolId || active.toolId !== toolId) return null;
  return active;
}

/**
 * Make the live mount of `origin.toolId` a team document: called after it was SAVED to
 * a team project (a fresh document, or "save mine as a copy"), when there was no open
 * to arm a stash for. Only ever the document on screen: the caller passes that
 * document's tool id.
 * Returns the origin now held, or null when the input was not usable.
 */
export function adoptTeamSessionOrigin(
  origin: TeamSessionOriginInput,
  opts: { generation?: number } = {},
): TeamSessionOrigin | null {
  const next = normalise(origin);
  if (!next) return null;
  // A save started under an earlier mount: the document it saved is no longer the one
  // on screen, so the one on screen must not become that team session.
  if (opts.generation !== undefined && opts.generation !== generation) return null;
  setActive(next);
  return next;
}

/** Which mount is live, as a number that changes with every mount. Read it when a save
 *  starts and hand it to {@link adoptTeamSessionOrigin} when the save resolves. */
export function teamOriginGeneration(): number {
  return generation;
}

/**
 * Keep the live origin of `toolId` through an in-app remount of the SAME document
 * (the tool view's own Reload after a design-system switch): arm the stash with it, at
 * the current address, immediately before dispatching the remount. Never for a
 * remount that brings in a different document (rule 2): only the caller knows which
 * kind it is about to do.
 */
export function carryTeamSessionOriginToRemount(toolId: string): void {
  const origin = activeTeamSessionOrigin(toolId);
  if (origin) pending = { origin, hash: currentHash() };
}

/**
 * Record a successful "Save changes": the live origin of `sessionId` moves to `rev`
 * (and `label`, when given). A no-op when the live origin is some other session, so a
 * save that resolves after the person moved on cannot rewrite the new document's.
 */
export function noteTeamSessionSaved(sessionId: string, rev: number, label?: string, opts: { generation?: number } = {}): void {
  if (!active || active.sessionId !== sessionId) return;
  // The same session reopened by a later mount holds the revision IT loaded at.
  if (opts.generation !== undefined && opts.generation !== generation) return;
  const next = normalise({ ...active, rev, ...(label !== undefined ? { label } : {}) });
  if (next) setActive(next);
}

/** Drop the live mount's origin - called from the tool view's teardown, so an origin
 *  never outlives the mount that earned it (rule 3). Idempotent. During an unload the
 *  mirror is kept, which is the whole of what lets a reload restore it (rule 4). */
export function releaseTeamSessionOrigin(): void {
  active = null;
  if (!unloading) writeMirror(null);
}

// ── Live work collabs ─────────────────────────────────────────────────────────

/** Sessions this tab is in a live work collab on, with how many open handles each has
 *  (a rejoin can overlap the handle it replaces). Module state only, never mirrored:
 *  a room does not survive a reload. */
const liveRooms = new Map<string, number>();

/**
 * Record that this tab joined the live work collab on `sessionId`, and return the call
 * that records leaving (idempotent). org/collab-work-opener.ts makes both calls, the
 * second when the room's handle closes. The Share dialog's rows read
 * {@link teamSessionLive}, so a session this tab is live on is shown as live instead
 * of being offered as a room to start or a document to save over.
 */
export function noteTeamSessionLive(sessionId: string): () => void {
  const id = String(sessionId ?? '').trim();
  if (!id) return () => {};
  liveRooms.set(id, (liveRooms.get(id) ?? 0) + 1);
  let open = true;
  return () => {
    if (!open) return;
    open = false;
    const left = (liveRooms.get(id) ?? 1) - 1;
    if (left > 0) liveRooms.set(id, left);
    else liveRooms.delete(id);
  };
}

/** Whether this tab is in a live work collab on `sessionId` right now. */
export function teamSessionLive(sessionId: string | null | undefined): boolean {
  return !!sessionId && liveRooms.has(sessionId);
}

/** Diagnostics: is a stash armed and unspent? (Also how a test proves one-shot.) */
export function pendingTeamSessionOrigin(): TeamSessionOrigin | null {
  return pending?.origin ?? null;
}

/** TEST-ONLY: drop both states and the mirror, as if the tab were new. */
export function _clearTeamSessionOriginForTests(): void {
  pending = null;
  active = null;
  restoreSpent = false;
  unloading = false;
  loadTypeOverride = null;
  liveRooms.clear();
  writeMirror(null);
}

/** TEST-ONLY: forget the module state but keep the mirror, as a new page load in the
 *  same tab does. `type` is what the browser would report for that load. */
export function _simulateReloadForTests(type: 'reload' | 'navigate' | 'back_forward' = 'reload'): void {
  pending = null;
  active = null;
  restoreSpent = false;
  unloading = false;
  loadTypeOverride = type;
  liveRooms.clear();
}
