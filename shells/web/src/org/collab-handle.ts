// SPDX-License-Identifier: MPL-2.0
/**
 * org/collab-handle - the Track B ADAPTER: one work-collab provider, seen as the
 * `CollabSessionHandle` a mounted tool actually needs (plan 100 section 7, wave 3.2).
 *
 * `org/collab-provider.ts` speaks the gateway's wire; `lib/collab-session.ts`
 * composes presence, colours and op plumbing for a mount. Neither imports the other,
 * deliberately - the provider's header says so, and `collab/rtc-transport.ts` says
 * the same thing for Track A ("a transport must not depend on a session"). THIS is
 * the file where both may legitimately be named at once, and it holds nothing else:
 * no socket, no roster policy, no UI. Everything below is a shape change.
 *
 * The map, which the provider's header already wrote down and this file makes real:
 *
 *   adapter       → `provider.adapter`                         (identical type)
 *   role          → `provider.state().role`, read LIVE         (identical union)
 *   presenceIn    → the provider's `presence` events, plus the roster seed
 *   sendPresence  → `provider.sendPresence`                    (verbatim)
 *   events        → the provider's `state` events, status-mapped
 *   close         → `provider.close()`
 *   self          → this device's collab client id + the SSO display name
 *   hostClientId  → ABSENT, and that is the answer (see below)
 *   peerRole      → the join-ack roster, looked up by principal
 *
 * ── ROLE IS LIVE, AND WHEN YOU BUILD THE HANDLE MATTERS ───────────────────────
 *
 * The gateway assigns the seat and says so in `join-ack.you.role`; the provider
 * already reads it (and fails closed - absent is never a grant). So `role` here is a
 * GETTER over `provider.state().role`, never a snapshot and never re-derived: there
 * is exactly one place that decides what this client may do, and it is the ack.
 *
 * A handle can be built before the ack (the mount seam,
 * `lib/collab-session-source.ts`, is synchronous), and `state().role` then still
 * reads its pre-join default of `'writer'`. Every LIVE read corrects itself - 
 * `CollabSessionState.role` is rebuilt from `handle.role` on each notify, so the
 * pill's observer banner is right the moment the ack lands. ONE read does not:
 * `createCollabSession` picks its adapter wrapper once, at construction
 * (`handle.role === 'observer' ? observerAdapter(...) : ...`), so a session built
 * before the ack keeps the writer wrapper for its whole life.
 *
 * That is survivable rather than dangerous, and it is worth being precise about why:
 * the provider refuses an observer's ops on its own - `sendOps` and `enqueue` both
 * return early on `role === 'observer'` - so nothing an observer types can reach the
 * wire or the durable outbox by this route. What is left is that their LOCAL
 * convergence doc records edits the room never saw, until the next `join-ack`
 * rebuilds it from the snapshot (`seedFrom`). So: **build the handle, and the
 * session, once the provider reports `'live'`** - which is also when `self.name` is
 * known (below). The wrapper is not duplicated here on purpose; observer semantics
 * have one owner (`collab-session.ts`), and a second suppressor in the transport
 * adapter is how two half-answers to the same question start disagreeing.
 *
 * ── PRESENCE: ALIGN, NEVER RE-STAMP ───────────────────────────────────────────
 *
 * The provider forwards the presence payload verbatim and says why: the lane's SHAPE
 * belongs to the presence engine, not the transport. Two shapes legitimately ride it
 * (`CollabPresencePayload`) and this module is where the choice is finally made:
 *
 *  - a full `PresenceFrame` (`lib/collab-presence.ts`) - what every Lolly shell in a
 *    collab actually sends, carrying the sender's own `from` and per-sender `seq`.
 *    It is passed through UNTOUCHED. Re-stamping `from` with the gateway's frame
 *    `from` would be actively wrong: that is the sender's CONNECTION id, while the
 *    roster key the whole presence engine (and the focus overlay, and the colour
 *    assignment) is built on is the per-device client id. Re-stamping `seq` would be
 *    worse - it is the ONLY thing that resolves an unordered lane (section 11.5), and it is
 *    the sender's counter, not ours.
 *  - a bare `Presence`/`Awareness` (what `CanvasSyncAdapter.presence` takes, which a
 *    handle is explicitly allowed to implement `sendPresence` as). It carries no
 *    envelope, so one is minted: `from` is the gateway's connection id, and `seq` is
 *    a locally minted counter kept strictly above every seq already seen for that
 *    sender. Minting is sound HERE and would not be on Track A: a WebSocket is
 *    ordered and reliable, so arrival order *is* send order and a local counter
 *    carries exactly the information a wire seq would.
 *
 * Anything else - a non-object, an array, an object with neither a `state` envelope
 * nor a `userId` - is dropped. The payload is untrusted input off a socket.
 *
 * ── ROSTER SEEDING, AND THE DEADLOCK IT EXISTS TO BREAK ───────────────────────
 *
 * The `join-ack` roster is the only thing that tells a joiner who is already in the
 * room, and it must reach the presence engine or the room can sit MUTUALLY SILENT:
 * the engine sends nothing at all while its roster is empty (section 4.7 - not "cheap when
 * alone", *nothing*), so a lone incumbent is silent, and a joiner whose engine also
 * knows nobody is silent too. Two people, one room, neither visible, forever.
 *
 * So each roster entry is surfaced through `presenceIn` as a synthetic PLACEHOLDER
 * frame. That gives the engine a peer, which starts its lifecycle and flushes our
 * own state, which the incumbent receives - and now they have a peer, and answer.
 * The handshake completes in one round trip and nobody had to invent a "hello".
 *
 * The wire carries no per-device client id for a roster entry, so a placeholder is
 * keyed by the CONNECTION id (`RosterEntry.id`, the same id `peer-leave` names),
 * falling back to the principal. That is a different key from the one the same
 * person's real frames arrive under, and the seq rules make the difference harmless:
 *
 *  - a placeholder is seeded at `seq` {@link ROSTER_SEED_SEQ} = 0. The engine admits
 *    a frame only when its `seq` is strictly greater than the one it holds, and its
 *    own frames start at 1 - so 0 is the one value that can never mask a live frame,
 *    in either direction. A gateway that ever DID key its roster by device id needs
 *    no special case: the peer's own `seq: 1` frame simply supersedes the
 *    placeholder in place.
 *  - when a real frame arrives from a device we have not linked yet, the placeholder
 *    standing for that principal is retired with a `state: null` leave frame at
 *    {@link ROSTER_RETIRE_SEQ}. The retirement is emitted AFTER the real frame, so
 *    the two rows never both exist across a paint - the engine deletes and adds
 *    inside one synchronous burst, and only the settled roster is ever rendered.
 *  - a placeholder whose roster row disappears is retired the same way, on the state
 *    event that dropped it. That one may be re-seeded later (a genuine rejoin);
 *    a placeholder retired because a real frame replaced it never is.
 *
 * THE SAFETY PROPERTY THAT MAKES ALL OF THIS ACCEPTABLE: a placeholder never
 * refreshes and is never flagged away, so the engine's own TTL sweep evicts it
 * within 30 s no matter what. No bookkeeping mistake here can produce a permanent
 * ghost - the worst case is a stale row for one TTL. That is the bound on every
 * case this file cannot resolve exactly, and there is one: a principal holding
 * several connections (two tabs, a phone - the wire explicitly allows it) is matched
 * by principal alone, so a reconnect that mints a new connection id while the old
 * device is already linked leaves one placeholder standing until the sweep takes it.
 *
 * ── THERE IS NO HOST ──────────────────────────────────────────────────────────
 *
 * `hostClientId` is left ABSENT, and its absence is a statement rather than a gap.
 * Track A is asymmetric by design (section 6.2a: the inviter owns the session, holds the
 * persistence, and is the catch-up source), which is what lets a nameless peer read
 * as "Host". A work collab has no such peer: the SERVER owns persistence and
 * authority (section 7.10 - the availability guarantee Track A structurally cannot make),
 * so every participant is a member of a room. `createCollabSession` reads the
 * absence exactly that way - `isHost` is `hostClientId !== undefined && … === id`,
 * so it is false for everyone and no "Host" tag is rendered. The invitee ordinals
 * fall out the same way and stay unused in practice: identity here comes from SSO
 * (section 7.8), so participants have real names and are never numbered.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ────────────────────────────────────────
 *
 *  - **Guarding the ops lane.** As of 2026-08-09 this adapter DOES republish inbound
 *    ops, as {@link WorkCollabSessionHandle.opsIn} - the same member name and the same
 *    `CollabStream` shape Track A's `RtcCollabHandle` publishes, so `views/tool-collab.ts`
 *    has ONE wire for both tracks instead of a per-track branch. That is a shape change
 *    (this file's whole job) and nothing more: the stream is a verbatim forward of the
 *    provider's `{ kind: 'ops' }` events. What is still emphatically NOT here is the
 *    GUARD. Those ops are untrusted input and must pass the shared op guard
 *    (`collab/op-guard.ts`, plan 100 section 11.21) before they reach the runtime - the
 *    provider's structural gate (`isCanvasOp`) is an envelope check, not the boundary - 
 *    and that happens exactly once, inside `session.applyRemotePatch`, which the MOUNT
 *    calls. Guarding here would mean this file knew about the tool's input model, which
 *    is precisely what it must not know, and would put a second copy of the policy on
 *    one of the two tracks.
 *  - **Colour slots.** `self.colorIndex` stays absent unless a caller supplies one.
 *    The roster carries a `color` HEX from the server's palette and no index, and
 *    inventing a slot from it would be a guess; the session already handles an
 *    unrecognised hex honestly (claim it if it is in our palette, otherwise
 *    re-derive by roster order - section 11.16).
 *  - **Reconnect policy, retries, the outbox.** All the provider's. This adapter
 *    reports states and never acts on them.
 */

import type { CanvasOp } from '@lolly-tools/core/canvas-op-v1';
import { getCollabClientId } from '../lib/collab-plumbing.ts';
import type { PresenceFrame, PresenceState } from '../lib/collab-presence.ts';
import type {
  CollabConnectionState,
  CollabRole,
  CollabSelf,
  CollabSessionHandle,
  CollabStream,
} from '../lib/collab-session.ts';
import type { RosterEntry } from './collab-protocol.ts';
import type { WorkCollabHandle, WorkCollabStatus } from './collab-provider.ts';

/**
 * The ceiling on a WRAPPED payload's own `from` (plan 100 section 11.21).
 *
 * Mirrors `collab/rtc-transport.ts`'s `MAX_CLIENT_ID_CHARS` exactly - duplicated
 * rather than imported, on purpose: this file and that one deliberately do not
 * depend on each other (the module header), and `rtc-handle.ts` sets the precedent
 * of mirroring a small stable constant across the boundary rather than creating a
 * cross-track import (its own `FORBIDDEN_KEYS` mirrors `op-guard.ts`'s for the same
 * reason).
 *
 * `lib/collab-session.ts`'s `admitPresence` explicitly does NOT check a frame's
 * `from`, on the stated grounds that "the envelope is the transport's own contract
 * (`rtc-transport.ts` bounds `from`/`seq` before a frame ever reaches a session)".
 * That is true on Track A, where `parsePresenceFrame` refuses an oversized `from`
 * before the frame exists at all - and it was FALSE here until this line: `p.from`
 * below is a peer's own JSON, relayed verbatim by the gateway
 * (`org/collab-provider.ts`'s `'presence'` case forwards `frame.frame` unexamined),
 * so an unbounded `from` reached `publishPresence` → the presence engine's roster
 * key AND `lastSeq`/`userOf` (this file) unchecked. This constant is what makes the
 * session's stated precondition true on this wire too.
 */
const MAX_PRESENCE_FROM_CHARS = 64;

/** The `seq` a synthetic roster placeholder carries. Zero, so a peer's own frames
 *  (which start at 1) always win - see the header's seeding rules. */
export const ROSTER_SEED_SEQ = 0;

/** The `seq` a placeholder's `state: null` retirement carries - one above the seed,
 *  which is the whole of what the engine's newest-only rule needs to accept it. */
export const ROSTER_RETIRE_SEQ = ROSTER_SEED_SEQ + 1;

/**
 * The provider's socket status as the pill's dot reads it (plan 100 section 4.6).
 *
 * Three of the provider's six statuses are one thing to a human - `'idle'` (built,
 * never connected), `'connecting'` (socket opening) and `'joining'` (open, ack
 * outstanding) are all "not usable yet, nothing is wrong". `'reconnecting'` is
 * first-class and must NOT collapse into `'connecting'`: it means we were live, the
 * roster is still real, and nobody is being evicted (section 11.3).
 *
 * Pure and exported so the mapping is a test rather than a walkthrough.
 */
export function statusToConnection(status: WorkCollabStatus): CollabConnectionState {
  switch (status) {
    case 'live':
      return 'live';
    case 'reconnecting':
      return 'reconnecting';
    case 'closed':
      return 'closed';
    default:
      // 'idle' | 'connecting' | 'joining'
      return 'connecting';
  }
}

/** One inbound presence payload, read into the parts a `PresenceFrame` needs.
 *  `from`/`seq`/`away` are absent when the payload did not carry them. */
export interface ReadPresencePayload {
  readonly from?: string;
  readonly seq?: number;
  readonly state: PresenceState | null;
  readonly away?: boolean;
}

/**
 * Read one presence payload off the wire, or `null` when it is not one.
 *
 * Deliberately SHALLOW about the state itself: the payload's shape belongs to the
 * presence engine (the provider says the same thing, for the same reason), and a
 * stricter guard here would drop every real frame the day the engine adds a field.
 * What is checked is only what this module has to branch on - is there an envelope,
 * and if not, is this a presence state at all rather than some other JSON object.
 */
export function readPresencePayload(payload: unknown): ReadPresencePayload | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  const wrapped = Object.hasOwn(p, 'state')
    && (p.state === null || (typeof p.state === 'object' && p.state !== null && !Array.isArray(p.state)));
  if (wrapped) {
    // An oversized `from` takes the WHOLE frame with it - never just the field - 
    // exactly `rtc-transport.ts`'s `parsePresenceFrame` for the same peer-supplied
    // envelope. Truncating or dropping only `from` would silently fall through to
    // `gatewayFrom` (see `onPresence`) and admit the frame under a DIFFERENT
    // identity than the one it claimed, which is not an honest reading of hostile
    // input; refusing the message is.
    if (typeof p.from === 'string' && p.from.length > MAX_PRESENCE_FROM_CHARS) return null;
    const from = typeof p.from === 'string' && p.from ? p.from : undefined;
    const seq = typeof p.seq === 'number' && Number.isFinite(p.seq) ? p.seq : undefined;
    const away = typeof p.away === 'boolean' ? p.away : undefined;
    return {
      ...(from !== undefined ? { from } : {}),
      ...(seq !== undefined ? { seq } : {}),
      ...(away !== undefined ? { away } : {}),
      state: (p.state ?? null) as PresenceState | null,
    };
  }
  // A bare `Presence`/`Awareness`. `userId` is the contract's required identity
  // field, and it is the one thing that distinguishes a presence state from any
  // other object a gateway might put on this lane.
  if (typeof p.userId !== 'string') return null;
  return { state: p as unknown as PresenceState };
}

export interface WorkCollabHandleOptions {
  /**
   * This device's collab client id. Defaults to `getCollabClientId()` - the SAME
   * singleton `createWorkCollabProvider` defaults to, so in the ordinary path the
   * two agree by construction and neither has to publish it. A caller that passed
   * an explicit `clientId` to the provider MUST pass the same one here: the id is
   * what stamps `op.origin.client` and what a peer's presence frames are keyed by,
   * and two values would put one device on the wire as two clients.
   */
  clientId?: string;
  /** Display name to use before the gateway states one (the org session's SSO name,
   *  when the caller already holds it). The `join-ack` seat wins once it lands. */
  name?: string;
  /** Preferred palette slot, if a caller has one. Absent by default - see the
   *  header: this wire carries a colour hex, never an index. */
  colorIndex?: number;
}

/**
 * What this adapter publishes beyond the session contract: the inbound-ops lane.
 *
 * Named and shaped to match `RtcCollabHandle.opsIn` exactly, because the consumer is the
 * same one line in `views/tool-collab.ts` for both tracks. See the header for why the
 * op GUARD is deliberately not on this side of it.
 */
export interface WorkCollabSessionHandle extends CollabSessionHandle {
  readonly opsIn: CollabStream<readonly CanvasOp[]>;
}

/**
 * Adapt a work-collab provider into the one object `createCollabSession` asks a
 * transport for. Owns no timers and no state beyond the roster bookkeeping the
 * seeding rules need; `close()` is the provider's, plus this adapter's listeners.
 */
export function createWorkCollabHandle(
  provider: WorkCollabHandle,
  opts: WorkCollabHandleOptions = {},
): WorkCollabSessionHandle {
  const clientId = opts.clientId ?? getCollabClientId();

  const presenceSubs = new Set<(frame: PresenceFrame) => void>();
  const stateSubs = new Set<(state: CollabConnectionState) => void>();
  const opsSubs = new Set<(ops: readonly CanvasOp[]) => void>();

  /** Placeholder key → the principal it stands for, while it is standing. */
  const seeded = new Map<string, string>();
  /** Placeholder keys a real frame replaced - never seeded again. */
  const retired = new Set<string>();
  /** Per-device client id → principal, learned from real frames. Also the "have we
   *  linked this device yet" test the retirement pass keys on. */
  const userOf = new Map<string, string>();
  /** Highest `seq` forwarded per sender - the floor a minted seq must clear. */
  const lastSeq = new Map<string, number>();

  /** The last connection state published, so three statuses collapsing into
   *  `'connecting'` cost one event rather than three. */
  let connection: CollabConnectionState | null = null;
  let closing = false;

  function warn(what: string, e: unknown): void {
    console.warn(`[lolly:collab] handle ${what}`, e);
  }

  /** Fan one frame out (or replay it to a single new subscriber). A subscriber's
   *  bug must not take the transport down with it - the provider's own rule. */
  function publishPresence(frame: PresenceFrame, only?: (frame: PresenceFrame) => void): void {
    const held = lastSeq.get(frame.from);
    if (held === undefined || frame.seq > held) lastSeq.set(frame.from, frame.seq);
    for (const fn of only ? [only] : [...presenceSubs]) {
      try {
        fn(frame);
      } catch (e) {
        warn('presence listener', e);
      }
    }
  }

  /** Fan one inbound batch out. Same subscriber-failure rule as presence: a consumer's
   *  bug is its own and must not take the transport, or the other subscribers, down. */
  function publishOps(ops: readonly CanvasOp[]): void {
    if (ops.length === 0) return;
    for (const fn of [...opsSubs]) {
      try {
        fn(ops);
      } catch (e) {
        warn('ops listener', e);
      }
    }
  }

  function publishConnection(next: CollabConnectionState): void {
    connection = next;
    for (const fn of [...stateSubs]) {
      try {
        fn(next);
      } catch (e) {
        warn('state listener', e);
      }
    }
  }

  // ── roster seeding ──────────────────────────────────────────────────────────

  /** A roster row's placeholder key: the CONNECTION id when the gateway sent one
   *  (what `peer-leave` names), the principal otherwise - the same identity rule
   *  the provider's own `rosterKey` takes, for the same reason. */
  function seedKey(entry: RosterEntry): string {
    return typeof entry.id === 'string' && entry.id ? entry.id : entry.userId;
  }

  function seedFrame(entry: RosterEntry): PresenceFrame {
    return {
      from: seedKey(entry),
      seq: ROSTER_SEED_SEQ,
      state: {
        userId: entry.userId,
        name: typeof entry.name === 'string' ? entry.name : '',
        color: typeof entry.color === 'string' ? entry.color : '',
      },
    };
  }

  /** Every roster row that is still a real principal. The gateway's frames are
   *  untrusted, and the provider only guarantees `userId` is a string. */
  function rosterRows(): RosterEntry[] {
    return provider.state().roster.filter(
      (entry): entry is RosterEntry => !!entry && typeof entry.userId === 'string' && entry.userId !== '',
    );
  }

  /**
   * Retire a standing placeholder with a clean leave frame. `blockReseed` is true
   * only when a real frame replaced it: the roster row is still there, so without
   * the block the next state event would resurrect the ghost. A placeholder whose
   * ROW went away is not blocked - the same connection id reappearing is a genuine
   * rejoin, and refusing to seed it would cost the deadlock break.
   */
  function retirePlaceholder(key: string, blockReseed: boolean): void {
    if (!seeded.delete(key)) return;
    if (blockReseed) retired.add(key);
    publishPresence({ from: key, seq: ROSTER_RETIRE_SEQ, state: null });
  }

  /** Seed what the roster gained, retire what it lost. Driven off the provider's
   *  state events, which fire on `join-ack`, `peer-join` and `peer-leave` alike, so
   *  there is one code path rather than three. */
  function syncRoster(): void {
    const present = new Set<string>();
    for (const entry of rosterRows()) {
      const key = seedKey(entry);
      present.add(key);
      if (retired.has(key) || seeded.has(key) || userOf.has(key)) continue;
      seeded.set(key, entry.userId);
      publishPresence(seedFrame(entry));
    }
    for (const key of [...seeded.keys()]) {
      if (!present.has(key)) retirePlaceholder(key, false);
    }
  }

  /**
   * A real frame arrived from `from`. Link the device to its principal and retire
   * ONE placeholder standing for that principal - one per device, so a person on a
   * laptop AND a phone loses one placeholder per announcement rather than both on
   * the first. Anything this cannot match exactly is carried by the TTL (header).
   */
  function linkDevice(from: string, state: PresenceState): void {
    const userId = typeof state.userId === 'string' && state.userId ? state.userId : undefined;
    if (userId === undefined || userOf.has(from)) return;
    userOf.set(from, userId);
    // The gateway keyed its roster by this device id after all: the frame already
    // superseded the placeholder in place, so there is nothing to send.
    if (seeded.delete(from)) {
      retired.add(from);
      return;
    }
    for (const [key, principal] of seeded) {
      if (principal !== userId) continue;
      retirePlaceholder(key, true);
      return;
    }
  }

  // ── inbound ─────────────────────────────────────────────────────────────────

  function onPresence(gatewayFrom: string, payload: unknown): void {
    const read = readPresencePayload(payload);
    if (!read) return;
    const from = read.from ?? (gatewayFrom || '');
    // Nothing to key a roster row on, or our own frame relayed back: the engine
    // would drop both, and forwarding them would pollute the device→principal map.
    if (!from || from === clientId) return;
    const seq = read.seq ?? (lastSeq.get(from) ?? ROSTER_SEED_SEQ) + 1;
    publishPresence({
      from,
      seq,
      state: read.state,
      ...(read.away !== undefined ? { away: read.away } : {}),
    });
    if (read.state) {
      // AFTER the forward, never before - see the header: the placeholder and the
      // real row overlap for the rest of this synchronous burst, which is not long
      // enough to paint, whereas retiring first can empty the roster and stop the
      // engine's lifecycle between the two frames.
      linkDevice(from, read.state);
      return;
    }
    // A clean leave discards that sender's bookkeeping, exactly as the presence
    // engine discards its own (and for the same reason: a device that reloads and
    // starts counting at 1 must be admitted, not locked out). It also keeps these
    // maps sized by the live roster rather than by every device the session ever
    // saw.
    lastSeq.delete(from);
    userOf.delete(from);
  }

  const stopProvider = provider.on((event) => {
    if (event.kind === 'state') {
      syncRoster();
      const next = statusToConnection(event.state.status);
      if (next !== connection) publishConnection(next);
      return;
    }
    if (event.kind === 'presence') { onPresence(event.from, event.frame); return; }
    // Verbatim, including the join-ack snapshot seed the provider delivers on this
    // same lane - that IS this copy's initial state (section 7.3), so a handle that filtered
    // it would mount a joiner on an empty document.
    if (event.kind === 'ops') publishOps(event.ops);
  });

  // ── the handle ──────────────────────────────────────────────────────────────

  const self: CollabSelf = {
    get clientId(): string {
      return clientId;
    },
    /** The gateway's seat once it has stated one (SSO - section 7.8), the caller's hint
     *  before that. Live, though note `createCollabSession` snapshots it at
     *  construction: see the header on building the handle after `'live'`. */
    get name(): string | undefined {
      const stated = provider.state().self?.name;
      return typeof stated === 'string' && stated ? stated : opts.name;
    },
    ...(opts.colorIndex !== undefined ? { colorIndex: opts.colorIndex } : {}),
  };

  return {
    adapter: provider.adapter,
    history: provider.history,
    self,

    get role(): CollabRole {
      // Fail closed, exactly as the provider reads the ack: anything that is not a
      // stated writer is an observer.
      return provider.state().role === 'writer' ? 'writer' : 'observer';
    },

    // hostClientId is deliberately ABSENT - a work collab has no host (header).

    presenceIn: {
      subscribe(fn: (frame: PresenceFrame) => void): () => void {
        presenceSubs.add(fn);
        // Replay the room to a subscriber that arrived after the join-ack. Without
        // it, a handle built (or re-subscribed) once the roster was already known
        // would sit in a room it cannot see, and - because the engine is silent
        // while its roster is empty - could not be seen from either.
        for (const entry of rosterRows()) {
          const key = seedKey(entry);
          if (retired.has(key) || userOf.has(key)) continue;
          seeded.set(key, entry.userId);
          publishPresence(seedFrame(entry), fn);
        }
        return () => {
          presenceSubs.delete(fn);
        };
      },
    },

    /**
     * Inbound ops, forwarded exactly as the provider delivered them.
     *
     * NO replay on subscribe, unlike `presenceIn` and `events`: an op stream is a log of
     * CHANGES, and replaying a batch already applied to the converging document would be
     * at best redundant work and at worst (for anything that is not idempotent under
     * LWW) a second application. The catch-up story here is the gateway's, not this
     * adapter's - a joiner is seeded by the `join-ack` snapshot, which arrives on this
     * same lane as ops, so a subscriber that attaches before `'live'` misses nothing.
     */
    opsIn: {
      subscribe(fn: (ops: readonly CanvasOp[]) => void): () => void {
        opsSubs.add(fn);
        return () => {
          opsSubs.delete(fn);
        };
      },
    },

    events: {
      subscribe(fn: (state: CollabConnectionState) => void): () => void {
        stateSubs.add(fn);
        // The current state, immediately. A provider that is already live emits no
        // further state event until something changes, and a session initialised at
        // 'connecting' would show a spinner over a working room forever.
        const now = statusToConnection(provider.state().status);
        connection = now;
        try {
          fn(now);
        } catch (e) {
          warn('state listener', e);
        }
        return () => {
          stateSubs.delete(fn);
        };
      },
    },

    sendPresence(frame: PresenceFrame): void {
      // Verbatim. Cadence is the presence engine's (50 ms, silent while alone), and
      // whether it can go out at all is the provider's (dropped unless live - 
      // presence is ephemeral by definition and is never queued).
      provider.sendPresence(frame);
    },

    /**
     * A peer's role, or honest ignorance. The presence roster is keyed by device
     * client id, which this wire never carries, so the lookup goes through the
     * principal learned from that device's frames - and falls back to matching the
     * key as a connection id, which is what a placeholder row is. Undefined means
     * "the gateway did not say", and the session renders no tag rather than
     * guessing 'writer'; mislabelling an observer as an editor is the harmful
     * direction.
     */
    peerRole(id: string): CollabRole | undefined {
      const principal = userOf.get(id);
      for (const entry of rosterRows()) {
        const match = entry.id === id || entry.userId === id
          || (principal !== undefined && entry.userId === principal);
        if (!match) continue;
        if (entry.role === 'writer' || entry.role === 'observer') return entry.role;
        return undefined;
      }
      return undefined;
    },

    close(): void {
      if (closing) return;
      closing = true;
      // Closed BEFORE the listeners are dropped, so the provider's final state event
      // still reaches whoever is subscribed - a stream that ends without saying so
      // is how a UI ends up showing a live room that isn't.
      try {
        provider.close();
      } catch (e) {
        warn('close', e);
      }
      if (connection !== 'closed') publishConnection('closed');
      stopProvider();
      presenceSubs.clear();
      stateSubs.clear();
      opsSubs.clear();
    },
  };
}
