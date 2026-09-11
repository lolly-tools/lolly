// SPDX-License-Identifier: MPL-2.0
/**
 * org/collab-work-opener - the `'work'` slot of `lib/collab-launch.ts`, and the inbox
 * affordance that joins one from an invite (plan 100 section 7 items 9 + 11, section 12 Q3; wave 3.3).
 *
 * The Track B sibling of `collab/private-opener.ts`, one track over. Read that file's
 * header first: the two are deliberately the same shape (an opener registered into a
 * named slot, the heavy half behind a dynamic import, the live session handed to
 * `lib/collab-mount.ts` and nowhere else), and everything below is the delta a SERVER
 * room brings - no ceremony, no SDP, no pairing. A work collab is joined, not agreed:
 * the room already exists, keyed by the session id the instance holds.
 *
 * ── The one chain, stated once ─────────────────────────────────────────────────
 *
 *   createWorkCollabProvider(sessionId)   the ws pipe        org/collab-provider.ts
 *     → createWorkCollabHandle(provider)  the shape change   org/collab-handle.ts
 *       → deliverCollabConnection({role:'member', …})        lib/collab-mount.ts
 *
 * Both entry points below funnel into exactly that, so there is one way a work collab
 * starts. The mount takes it from there - it registers the session source, seeds the
 * copy and takes the user to the tool (`lib/collab-mount.ts`'s header). This module
 * therefore navigates nowhere and touches no runtime: doing either here would be a
 * second half-implementation of the adoption contract.
 *
 * ── WHY IT WAITS FOR `'live'` BEFORE BUILDING THE HANDLE ───────────────────────
 *
 * `org/collab-handle.ts` states the rule and the reason: `createCollabSession` picks
 * its adapter wrapper ONCE, at construction, from `handle.role`, and the gateway does
 * not assign the seat until the `join-ack`. A handle built while the provider still
 * holds its pre-join `'writer'` default hands an OBSERVER the writer wrapper for the
 * life of the session - survivable (the provider refuses their ops on its own) but it
 * means their local doc records edits the room never saw. Waiting costs one promise and
 * removes the whole class. It is also when `self.name` is known.
 *
 * The wait is bounded ({@link CONNECT_TIMEOUT_MS} - section 7.11 targets join-to-interactive
 * under 3 s, so several times that is already a failure) and every exit that is not
 * `'live'` closes the provider. A socket left open behind a failure message is a room
 * the user has silently joined.
 *
 * ── HONEST FAILURE IS THE POINT OF THE FETCH ───────────────────────────────────
 *
 * The invite path fetches the session BEFORE it connects, through
 * `org/session-source.ts`'s status-carrying `fetchTeamSession`. Not to warm a cache:
 * an invite outlives the thing it invites you to, and the three ways that happens need
 * three different sentences - the session was deleted (410), your access was revoked
 * (403), or it is not there at all (404). A ws connect answers all three as "the socket
 * closed", which is how a product ends up telling someone to check their network when
 * an administrator removed them from a project.
 *
 * What the fetch does NOT do is seed the copy. `CollabConnection.seed` is URL-mode
 * parameters, and it is documented as absent for a `'member'`: the server owns this
 * session's state and delivers it in the `join-ack` snapshot, so handing the mount a
 * second, older copy of it - in a different currency, fetched over a different
 * connection - is two sources of truth for one document. The fetch's other product is
 * the SERVER's `toolId`, which is section 7.11's preload (the mount can start loading the tool
 * while the handshake completes) and is the one fact the invite could have gone stale on.
 *
 * ── WHAT GATES WHAT ────────────────────────────────────────────────────────────
 *
 *  - STARTING one (`openWorkCollab`) needs `collab.edit`: you are proposing that other
 *    people co-edit this session, which is an editing act.
 *  - JOINING one (`joinWorkCollabFromInvite`, and whether the invite action renders at
 *    all) needs `collab.join`. Absent or false ⇒ NO action element - the message still
 *    reads as ordinary text, because an invite you cannot act on is still news you are
 *    entitled to.
 *  - Both bits default false and are read LIVE, on every press, through
 *    `org/collab-config.ts`. Checking inside rather than around the registration is the
 *    house pattern (`collab/private-opener.ts`'s note on the flag): policy that changes
 *    mid-session takes effect without a reload, and the cost of an inert registration is
 *    one closure.
 *
 * ── Copy ───────────────────────────────────────────────────────────────────────
 *
 * Every user-visible string is in {@link STRINGS}, and every read of it goes through
 * `tRaw()` - the same convention `collab/join-route.ts` uses, and the reason the map is
 * a corpus source in scripts/translate.ts's COLLAB_SOURCES. The copy rides the lazy
 * `collab` namespace (i18n.ts) because that is what this surface is: a work collab is
 * the server-room half of the same feature, and its sentences are the same register.
 * Both async entry points await `loadNamespace('collab')` before they can produce a
 * message, and the one synchronous painter (`buildCollabInviteAction`) re-stamps its
 * label when the namespace lands - an unloaded namespace renders English, exactly like
 * a missing key. Server-supplied text never reaches the DOM from here at all.
 */

import { registerCollabOpener, type CollabLaunchContext } from '../lib/collab-launch.ts';
import { registerWorkCollabPolicy } from '../lib/collab-availability.ts';
// Value imports, and cheap ones: `lib/collab-mount.ts` imports nothing but types, and
// `org/collab-config.ts` is two accessors over org-config state this module's own chunk
// already carries.
import { deliverCollabConnection, type CollabConnection } from '../lib/collab-mount.ts';
import { canEditCollab, canJoinCollab } from './collab-config.ts';
import { fetchTeamSession } from './session-source.ts';
import { orgSession } from './index.ts';
import { announce } from '../a11y.ts';
import { currentLang, loadNamespace, tRaw } from '../i18n.ts';
import type { WorkCollabHandle } from './collab-provider.ts';
import type { CollabSessionHandle } from '../lib/collab-session.ts';
import { createWorkCollabHistory } from './collab-history.ts';

// ── Copy ──────────────────────────────────────────────────────────────────────
//
// One map, one wave (section 11.28). No interpolation: none of these name a person, a
// session or an instance, deliberately - an invite's own title already did.
//
// These are catalog KEYS, not the rendered copy: the English source doubles as the
// lookup key (i18n.ts), so every read below is `tRaw(STRINGS.x)` - tRaw and not t
// because every sink here is text (`textContent`, `announce()`), where escaping would
// show a reader `O&#39;Brien`. A bare read would render English in all 26 languages
// with nothing failing, which is what collab-i18n.test.ts pins.

export const STRINGS = {
  /** The inbox affordance itself. */
  open: 'Open the collab',
  opening: 'Opening the collab…',
  joined: 'You are in the collab.',

  /** Refusals before anything is attempted. */
  noSession: 'Open this session from Team projects first - a work collab runs on the copy your instance holds.',
  cannotEdit: 'This instance has not given you editing in a work collab.',
  cannotJoin: 'This instance does not offer work collabs to you.',

  /** The invite outlived the thing it invited you to. */
  gone: 'This collab has ended - the session it ran on was deleted.',
  forbidden: 'You no longer have access to this session, so this collab cannot be opened.',
  missing: 'That session is not on this instance any more.',
  unreachable: 'This instance could not be reached. Try again when you are back online.',
  /** 401: the instance answered, and what it said was "who are you?". */
  signedOut: 'Your session with this instance has expired. Sign in again, then open the collab.',
  /** 5xx: the instance answered, and the answer was its own fault. */
  serverError: 'This instance had a problem opening that session. Try again in a moment.',

  /** The room refused, or never answered. */
  crossOrigin: "This instance's collab service is on another origin, so it cannot be joined from here.",
  refused: 'The collab did not accept this device. Ask whoever invited you to check your access.',
  slow: 'The collab did not answer in time. Try opening it again.',

  /** Nothing owns co-editing in this build (see lib/collab-mount.ts's parking note). */
  noMount: 'This version cannot open a live collab yet.',
} as const;

/**
 * How long the join may take before it is called a failure. section 7.11 targets
 * join-to-interactive under 3 s; several times that is a room that is not answering,
 * and the user is owed a sentence rather than a spinner.
 */
export const CONNECT_TIMEOUT_MS = 15_000;

/**
 * Longest id accepted off an inbox message. The instance mints short opaque ids; a
 * longer one is a malformed (or hostile) message, and it would otherwise be spent
 * building a request path. Untrusted input, bounded before it is used.
 */
export const MAX_ID_CHARS = 200;

// ── The invite payload ────────────────────────────────────────────────────────

/** The machine-readable half of a collab invite (lolly-work `collab/invites.ts`'s
 *  `buildInviteMessage`). `cta.url` is the human half and is not read here - the
 *  server has no shell route to bake in, which is exactly why `data` exists. */
export interface WorkCollabInvite {
  readonly sessionId: string;
  readonly projectId?: string;
  readonly toolId?: string;
  readonly toolVersion?: string;
}

/** The shape this module needs off an inbox message - structural on purpose, so
 *  `org/banner.ts`'s `InboxMessage` satisfies it without either file importing the
 *  other's type (the banner imports this module lazily, and only for an invite). */
export interface InviteMessageLike {
  readonly kind?: string;
  readonly data?: Record<string, string> | undefined;
}

function readId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= MAX_ID_CHARS ? trimmed : undefined;
}

/**
 * The invite carried by a message, or `null` when it carries none.
 *
 * Both markers are accepted - the message's own `kind: 'collab'` and the payload's
 * `data.kind: 'collab-invite'` - because the server sets both and neither is the
 * documented one on its own. Either alone is enough; a usable `sessionId` is the
 * thing that actually decides, since without it there is nothing to join.
 *
 * Pure, and exported for that reason: this is the whole of the message parsing, and
 * everything it rejects (a missing payload, a blank or absurd id, some other kind of
 * message) leaves the banner rendering the message as plain text.
 */
export function readCollabInvite(msg: InviteMessageLike | null | undefined): WorkCollabInvite | null {
  if (!msg) return null;
  const data = msg.data;
  if (!data || typeof data !== 'object') return null;
  if (msg.kind !== 'collab' && data.kind !== 'collab-invite') return null;
  const sessionId = readId(data.sessionId);
  if (!sessionId) return null;
  const projectId = readId(data.projectId);
  const toolId = readId(data.toolId);
  const toolVersion = readId(data.toolVersion);
  return {
    sessionId,
    ...(projectId ? { projectId } : {}),
    ...(toolId ? { toolId } : {}),
    ...(toolVersion ? { toolVersion } : {}),
  };
}

// ── Outcomes ──────────────────────────────────────────────────────────────────

/** Why a work collab did not open. One reason per sentence in {@link STRINGS}, so a
 *  caller can branch on the fact and still show the copy it was given. */
export type WorkCollabFailure =
  | 'no-session'      // nothing to join: this mount is not a team session (see CollabLaunchContext.sessionId)
  | 'not-permitted'   // the instance withholds the capability bit
  | 'gone'            // 410 - the session was deleted
  | 'forbidden'       // 403 - access revoked
  | 'missing'         // 404 - no such session
  | 'signed-out'      // 401 - the instance answered; the cookie is what expired
  | 'server-error'    // 5xx - the instance answered, and the fault is its own
  | 'unreachable'     // no verdict at all (network, non-JSON, unusable body)
  | 'cross-origin'    // the derived gateway endpoint cannot carry this instance's cookie
  | 'refused'         // the room closed the socket on us
  | 'timeout'         // never reached 'live'
  | 'no-mount';       // nothing owns co-editing; the connection is parked (lib/collab-mount.ts)

export type WorkCollabOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: WorkCollabFailure; readonly message: string };

const fail = (reason: WorkCollabFailure, message: string): WorkCollabOutcome => ({ ok: false, reason, message });

// ── Injectable wiring (production loads it; tests supply it) ──────────────────

/**
 * The three things this module cannot construct without the ws client.
 *
 * Behind a factory so the module that RENDERS the invite button costs a banner
 * nothing: `buildCollabInviteAction` runs with none of it loaded, and the provider +
 * adapter chunk arrives only once somebody presses the button. It is also the entire
 * test seam - no WebSocket, no IndexedDB outbox, no timers of the real client.
 */
export interface WorkCollabWiring {
  /** Build the provider for a session (the registered factory when there is one). */
  makeProvider(sessionId: string): WorkCollabHandle;
  /** Adapt it into what a mounted tool asks a transport for. */
  makeHandle(provider: WorkCollabHandle): CollabSessionHandle;
  /** The provider's own reason string for a non-same-origin endpoint. */
  readonly crossOriginReason: string;
}

export interface WorkCollabDeps {
  readonly canEdit?: () => boolean;
  readonly canJoin?: () => boolean;
  readonly fetchSession?: typeof fetchTeamSession;
  readonly wiring?: () => Promise<WorkCollabWiring> | WorkCollabWiring;
  readonly deliver?: (conn: CollabConnection) => boolean;
  readonly timeoutMs?: number;
  readonly setTimer?: (fn: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

/** This member's principal - the partition key of the provider's durable outbox.
 *  Read here for the fallback path below; the registered factory already carries it. */
function memberPrincipal(): string | undefined {
  const s = orgSession();
  return s?.kind === 'member' ? s.user.sub : undefined;
}

/**
 * Load the ws client and expose it as {@link WorkCollabWiring}.
 *
 * It prefers the factory `org/index.ts` registered, because that one carries the
 * principal, and the principal is what keeps one signed-in user's undelivered ops off
 * the next user's socket on a shared browser (`WorkCollabOptions.principal`). The
 * fallback is not a bypass of that: it reads the SAME principal off the org session,
 * and exists only for the ordering window where a member presses an invite before the
 * factory's own lazy import has resolved. The capability gate was already applied by
 * the caller, so the fallback grants nothing the factory would not have.
 */
async function loadWiring(): Promise<WorkCollabWiring> {
  const [provider, adapter] = await Promise.all([
    import('./collab-provider.ts'),
    import('./collab-handle.ts'),
  ]);
  // The durable per-device client id must exist before a provider is built - two
  // clients on the wire from one device is what it prevents. Idempotent.
  await provider.initWorkCollab().catch(() => { /* an in-memory id still works */ });
  return {
    makeProvider(sessionId: string): WorkCollabHandle {
      const registered = provider.getWorkCollabFactory();
      return registered
        ? registered(sessionId, { history: createWorkCollabHistory(sessionId) })
        : provider.createWorkCollabProvider(sessionId, { principal: memberPrincipal(), history: createWorkCollabHistory(sessionId) });
    },
    makeHandle: (p) => adapter.createWorkCollabHandle(p),
    crossOriginReason: provider.CROSS_ORIGIN_REASON,
  };
}

// ── Connect ───────────────────────────────────────────────────────────────────

interface LiveOutcome {
  readonly live: boolean;
  readonly reason?: string;
  readonly timedOut?: boolean;
}

/**
 * Resolve once the provider is live, closed, or out of time.
 *
 * The current state is read BEFORE and AFTER subscribing: a provider that is already
 * live emits no further event, and waiting for one would hang on the healthy path.
 */
function awaitLive(provider: WorkCollabHandle, deps: WorkCollabDeps): Promise<LiveOutcome> {
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number): unknown => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h: unknown): void => clearTimeout(h as ReturnType<typeof setTimeout>));
  return new Promise<LiveOutcome>((resolve) => {
    let settled = false;
    let timer: unknown;
    let off: (() => void) | null = null;
    // Set when `done` runs before `provider.on()` has returned its unsubscribe - a
    // listener that fires synchronously would otherwise leave the subscription live.
    let dropped = false;

    const done = (out: LiveOutcome): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) { try { clearTimer(timer); } catch { /* a spent timer is fine */ } }
      if (off) { try { off(); } catch { /* ditto */ } } else dropped = true;
      resolve(out);
    };

    const read = (): boolean => {
      let state: ReturnType<WorkCollabHandle['state']>;
      try {
        state = provider.state();
      } catch {
        done({ live: false });
        return true;
      }
      if (state.status === 'live') { done({ live: true }); return true; }
      if (state.status === 'closed') { done({ live: false, reason: state.reason }); return true; }
      return false;
    };

    try {
      off = provider.on(() => { read(); });
    } catch {
      done({ live: false });
      return;
    }
    if (dropped) { try { off(); } catch { /* ignore */ } }
    if (settled) return;
    if (read()) return;
    timer = setTimer(() => done({ live: false, timedOut: true }), deps.timeoutMs ?? CONNECT_TIMEOUT_MS);
  });
}

/** What a connect attempt needs to know, from whichever entry point asked for it. */
interface ConnectPlan {
  readonly sessionId: string;
  readonly toolId?: string;
  readonly launch?: CollabLaunchContext;
}

/**
 * The one chain (see the header), and every way it can end.
 *
 * A failure closes the provider on the way out. A success hands the connection to
 * `lib/collab-mount.ts` and keeps nothing: from that moment the mount owns the
 * session, including hanging it up.
 */
async function connectAndDeliver(plan: ConnectPlan, deps: WorkCollabDeps): Promise<WorkCollabOutcome> {
  let wiring: WorkCollabWiring;
  try {
    wiring = await (deps.wiring ? deps.wiring() : loadWiring());
  } catch {
    return fail('unreachable', tRaw(STRINGS.unreachable));
  }

  let provider: WorkCollabHandle;
  try {
    provider = wiring.makeProvider(plan.sessionId);
  } catch {
    return fail('unreachable', tRaw(STRINGS.unreachable));
  }

  const stop = (): void => { try { provider.close(); } catch { /* an already-dead socket is fine */ } };

  try {
    await provider.connect();
  } catch {
    stop();
    return fail('unreachable', tRaw(STRINGS.unreachable));
  }

  const live = await awaitLive(provider, deps);
  if (!live.live) {
    stop();
    if (live.timedOut) return fail('timeout', tRaw(STRINGS.slow));
    if (live.reason && live.reason === wiring.crossOriginReason) return fail('cross-origin', tRaw(STRINGS.crossOrigin));
    return fail('refused', tRaw(STRINGS.refused));
  }

  let handle: CollabSessionHandle;
  try {
    handle = wiring.makeHandle(provider);
  } catch {
    stop();
    return fail('refused', tRaw(STRINGS.refused));
  }

  const conn: CollabConnection = {
    role: 'member',
    handle,
    // The seam asks for "the handle's teardown AND the transport beneath it", and on
    // this track that is ONE call: `createWorkCollabHandle`'s own `close()` is defined
    // as the provider's close plus this adapter's listeners, in that order, so the
    // final state event still reaches anyone subscribed. Calling `stop()` here instead
    // would hang the socket up and leave the adapter believing it was still live.
    close: () => { try { handle.close(); } catch { stop(); } },
    ...(plan.toolId ? { toolId: plan.toolId } : {}),
    ...(plan.launch ? { launch: plan.launch } : {}),
    // A work collab edits the instance's own durable session - the server is the
    // authority and the persistence (section 7.3), so nothing about this copy is ephemeral.
    // That is the opposite of a private collab's acceptor (section 6.2a/section 11.17).
    ephemeral: false,
    // No `seed`/`seedLater`, per the seam's own contract: a member is seeded by the
    // gateway's join-ack snapshot. See the header.
  };

  const deliver = deps.deliver ?? deliverCollabConnection;
  // `false` means nothing owns co-editing yet, so the connection is PARKED rather than
  // dropped (lib/collab-mount.ts) and a mount registering a moment later still adopts
  // it. The user is told the truth about what they can see NOW rather than a promise
  // about a race - the same call `collab/join-route.ts`'s `handOffConnection` makes.
  if (!deliver(conn)) return fail('no-mount', tRaw(STRINGS.noMount));
  return { ok: true };
}

// ── Entry point 1: the Share dialog's "Work collab" row ───────────────────────

/**
 * Start a work collab on the session this mount came from.
 *
 * `ctx.sessionId` is the whole prerequisite: a work collab is a room keyed by the id
 * the instance holds, and a tool mounted from a local session has no such id. See
 * `CollabLaunchContext.sessionId` for why nothing populates it yet and what the honest
 * refusal is standing in for.
 */
export async function openWorkCollab(
  ctx: CollabLaunchContext,
  deps: WorkCollabDeps = {},
): Promise<WorkCollabOutcome> {
  // Every exit below produces a sentence, so the copy is a prerequisite rather than a
  // repaint. One already-resolved promise in English and on a second call (i18n.ts's
  // loadNamespace is idempotent and a no-op for 'en'); a failed load leaves English.
  await loadNamespace('collab');
  const canEdit = deps.canEdit ?? canEditCollab;
  if (!canEdit()) return fail('not-permitted', tRaw(STRINGS.cannotEdit));
  const sessionId = readId(ctx.sessionId);
  if (!sessionId) return fail('no-session', tRaw(STRINGS.noSession));
  return connectAndDeliver(
    { sessionId, ...(ctx.toolId ? { toolId: ctx.toolId } : {}), launch: ctx },
    deps,
  );
}

// ── Entry point 2: an invite in the inbox ─────────────────────────────────────

/**
 * Join the collab an invite names: resolve the session, then connect.
 *
 * The fetch is what makes the failures honest (see the header), and `toolId` prefers the
 * SERVER's answer over the invite's: the invite is a snapshot from whenever it was sent,
 * and the session is what is actually being joined. The session's inputs are read and
 * deliberately not forwarded - the join-ack owns this copy's state.
 */
export async function joinWorkCollabFromInvite(
  invite: WorkCollabInvite,
  deps: WorkCollabDeps = {},
): Promise<WorkCollabOutcome> {
  await loadNamespace('collab'); // see openWorkCollab - the copy loads before a message exists
  const canJoin = deps.canJoin ?? canJoinCollab;
  if (!canJoin()) return fail('not-permitted', tRaw(STRINGS.cannotJoin));

  const got = await (deps.fetchSession ?? fetchTeamSession)(invite.sessionId).catch(() => null);
  if (!got) return fail('unreachable', tRaw(STRINGS.unreachable));
  if (!got.ok) {
    // The whole reason this fetch carries a STATUS is that "could not be reached" is a
    // different fact from "the instance answered and said no", and telling someone to
    // check their internet connection when an administrator removed them from a project
    // is the mis-diagnosis this module's header names. A 401 has exactly that shape and
    // used to fall into the network sentence: `lib/instance.ts` has no global re-auth
    // interception, so an overnight cookie expiry surfaced as "you are offline".
    if (got.status === 410) return fail('gone', tRaw(STRINGS.gone));
    if (got.status === 403) return fail('forbidden', tRaw(STRINGS.forbidden));
    if (got.status === 404) return fail('missing', tRaw(STRINGS.missing));
    if (got.status === 401) return fail('signed-out', tRaw(STRINGS.signedOut));
    if (got.status >= 500) return fail('server-error', tRaw(STRINGS.serverError));
    // Genuinely no verdict: a status this module has no reading for (or none at all,
    // which is what a network failure and an unusable body both look like here).
    return fail('unreachable', tRaw(STRINGS.unreachable));
  }

  const toolId = got.data.toolId || invite.toolId;
  return connectAndDeliver({ sessionId: invite.sessionId, ...(toolId ? { toolId } : {}) }, deps);
}

// ── The inbox affordance ──────────────────────────────────────────────────────

/**
 * The "Open the collab" control for an invite message, or `null`.
 *
 * `null` for anything that is not an invite, and - the honesty rule - for a member
 * whose instance has not granted `collab.join`. No disabled button, no "ask your
 * administrator": the message still renders as ordinary text, which is what it always
 * was. An affordance that cannot work is worse than none.
 *
 * The returned element owns its own outcome: pressing it disables the button, and a
 * failure REPLACES it with the sentence for that failure (announced assertively, since
 * a bar the user is looking away from is exactly where a silent failure hides). It
 * loads none of the ws client until pressed.
 */
export function buildCollabInviteAction(
  msg: InviteMessageLike | null | undefined,
  deps: WorkCollabDeps = {},
): HTMLElement | null {
  const invite = readCollabInvite(msg);
  if (!invite) return null;
  const canJoin = deps.canJoin ?? canJoinCollab;
  if (!canJoin()) return null;

  const wrap = document.createElement('span');
  wrap.className = 'org-banner-collab';
  wrap.dataset.collabInvite = invite.sessionId;
  wrap.style.cssText = 'flex:0 0 auto;display:inline-flex;align-items:center;gap:.4rem';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--sm';
  btn.dataset.act = 'open-collab';
  btn.textContent = tRaw(STRINGS.open);
  wrap.appendChild(btn);

  // The only synchronous painter on this module's surface, so it follows the pill's
  // pattern (components/collab-pill.ts): English is skipped OUTRIGHT rather than
  // relying on loadNamespace's own early return, so an English build behaves exactly
  // as it did before; every other language paints English for one microtask and then
  // re-stamps the label in place. Only the label, and only while the button is still
  // idle: a press swaps in `opening` and the two entry points await the namespace
  // themselves, so re-stamping a pressed button would overwrite a later truth with an
  // earlier one. Deliberately NOT gated on `isConnected` - this element is returned
  // detached and the caller appends it, so a namespace that is already loaded resolves
  // its microtask before that happens and the guard would silently skip the repaint.
  if (currentLang() !== 'en') {
    void loadNamespace('collab').then(() => {
      if (!btn.disabled) btn.textContent = tRaw(STRINGS.open);
    });
  }

  const showFailure = (message: string): void => {
    const note = document.createElement('span');
    note.className = 'note';
    note.dataset.collabInviteError = '';
    note.style.cssText = 'color:hsl(var(--muted-foreground));font-size:.85rem';
    note.textContent = message;
    wrap.replaceChildren(note);
    announce(message, { assertive: true });
  };

  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = tRaw(STRINGS.opening);
    announce(tRaw(STRINGS.opening));
    void joinWorkCollabFromInvite(invite, deps)
      .then((outcome) => {
        if (outcome.ok) {
          // The mount is taking the user to the tool; the bar it was pressed from lives
          // above the view and survives that navigation, so the spent control goes.
          wrap.remove();
          announce(tRaw(STRINGS.joined));
          return;
        }
        showFailure(outcome.message);
      })
      .catch(() => { showFailure(tRaw(STRINGS.unreachable)); });
  });

  return wrap;
}

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Register the `'work'` opener (last-wins), plus the `collab.edit` policy the neutral
 * availability seam asks for the work track; returns the unregister fn for both.
 *
 * Called by `org/index.ts`'s member branch on an instance that grants `collab.join`,
 * beside the provider-factory registration it depends on. The capability re-check
 * lives INSIDE the opener (see the header), so this registration says only "this
 * instance offers work collabs", never "this member may start one".
 *
 * The policy is the same statement in the other direction. `lib/collab-availability.ts`
 * (plans/108 Phase 1) decides where a surface may offer a work collab, and one of its
 * three conditions is `collab.edit` - a control-plane grant only `org/` may read. So it
 * is handed over as a live callback rather than imported, which keeps the seam neutral
 * and keeps the answer fresh: policy that changes mid-session takes effect without a
 * reload, exactly like the opener's own press-time checks. It travels with the opener
 * because a work collab needs both facts or neither.
 *
 * `CollabOpener` is fire-and-forget, so the outcome is announced rather than returned:
 * the share row's own `announce('Starting a collab')` is a promise this keeps or
 * corrects a moment later.
 */
export function registerWorkCollabOpener(deps: WorkCollabDeps = {}): () => void {
  const offPolicy = registerWorkCollabPolicy(canEditCollab);
  const offOpener = registerCollabOpener('work', (ctx) => {
    void openWorkCollab(ctx, deps)
      .then((outcome) => { announce(outcome.ok ? tRaw(STRINGS.joined) : outcome.message, { assertive: !outcome.ok }); })
      .catch(() => { announce(tRaw(STRINGS.unreachable), { assertive: true }); });
  });
  return () => { offOpener(); offPolicy(); };
}
