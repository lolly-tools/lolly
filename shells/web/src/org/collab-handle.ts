// SPDX-License-Identifier: MPL-2.0
/**
 * Adapt a Work provider to the mounted tool's CollabSessionHandle.
 *
 * Work owns authorization, persistence and reconnect. This adapter publishes
 * connection/role changes, save status, roster/presence and document updates.
 * The session and provider guard operations against the current tool manifest.
 *
 * Build after admission so the seat and identity are known. Role remains a live
 * getter, and a role change notifies the session even when the socket stays live.
 * Snapshots replay the provider's current document to a late subscriber; deltas
 * do not replay. This prevents a mount after join from retaining tool defaults.
 *
 * Presence uses the gateway-assigned connection identity for both real frames
 * and roster placeholders. Two tabs of one account therefore remain separate.
 * Placeholders start at sequence zero; real presence supersedes them and an
 * explicit leave retires the matching connection. Legacy principal-only frames
 * retain bounded fallback bookkeeping.
 *
 * Work has no host participant: the server owns the room. Private RTC retains
 * its own host, identity and persistence contracts.
 */

import type { CanvasOp } from '@lolly-tools/core/canvas-op-v1';
import { getCollabClientId } from '../lib/collab-plumbing.ts';
import type { CollabDocumentSnapshot } from '../lib/collab-plumbing.ts';
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
  epoch?: string;
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
      ...(typeof p.epoch === 'string' ? { epoch: p.epoch.slice(0, 256) } : {}),
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
  people?: () => void;
  assets?: import('../lib/canvas-assets.ts').CanvasAssetsCapability;
  comments?: import('../lib/canvas-comments.ts').CanvasCommentsCapability;
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
  readonly snapshotIn: CollabStream<CollabDocumentSnapshot>;
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
  const clientId = opts.clientId ?? provider.clientId ?? getCollabClientId();

  const recoverySubs = new Set<(value: { id: string; ops: readonly CanvasOp[] }) => void>();
  const saveSubs = new Set<(state: import('../lib/collab-session.ts').CollabSaveState) => void>();
  let assetState = { pending: 0, message: '' };
  let saveError = '', saveErrorCode = '';
  const saveState = () => {
    const state = provider.state();
    return { pending: state.pending + assetState.pending, ...(assetState.message && !assetState.pending ? { retry: () => opts.assets?.retry?.() } : {}),
      message: assetState.message || (assetState.pending ? 'Image changes pending' : '') || saveError || (state.pending ? 'Edits pending'
      : state.status !== 'live' ? 'Work disconnected'
      : state.reason === 'durable-receipts-required' ? 'View only: update the work server'
      : state.role === 'observer' ? 'View only' : 'Saved to work') };
  };
  const publishSave = () => { for (const fn of saveSubs) fn(saveState()); };
  const stopAssets = opts.assets?.status.subscribe(value => { assetState = value; publishSave(); });
  const presenceSubs = new Set<(frame: PresenceFrame) => void>();
  const stateSubs = new Set<(state: CollabConnectionState) => void>();
  const opsSubs = new Set<(ops: readonly CanvasOp[]) => void>();
  const snapshotSubs = new Set<(snapshot: CollabDocumentSnapshot) => void>();

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
  let lastRole = provider.state().role;
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
        ...entry.presence,
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
    for (const key of [...userOf.keys()]) {
      if (key.startsWith('cm_') && !present.has(key)) {
        publishPresence({ from: key, epoch: key, seq: (lastSeq.get(key) ?? 0) + 1, state: null });
        userOf.delete(key); lastSeq.delete(key); retired.delete(key);
      }
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
    const from = read.epoch ? gatewayFrom : read.from ?? (gatewayFrom || '');
    // Nothing to key a roster row on, or our own frame relayed back: the engine
    // would drop both, and forwarding them would pollute the device→principal map.
    if (!from || from === clientId) return;
    const seq = read.seq ?? (lastSeq.get(from) ?? ROSTER_SEED_SEQ) + 1;
    publishPresence({
      from,
      seq,
      state: read.state,
      epoch: read.epoch,
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
    if (event.kind === 'recovery') { for (const fn of recoverySubs) fn(event); return; }
    if (event.kind === 'error') { saveErrorCode = event.code; saveError = event.message || event.code; publishSave(); return; }
    if (event.kind === 'warning') { saveError = 'Pending edits are full. Save a copy before continuing.'; publishSave(); return; }
    if (event.kind === 'state') {
      if (saveErrorCode === 'local-save-failed' && !event.state.localSaveFailed) { saveError = ''; saveErrorCode = ''; }
      publishSave();
      syncRoster();
      const next = statusToConnection(event.state.status);
      if (next !== connection || event.state.role !== lastRole) {
        lastRole = event.state.role;
        publishConnection(next);
      }
      return;
    }
    if (event.kind === 'presence') { onPresence(event.from, event.frame); return; }
    // Snapshots replace the runtime projection; ordinary operations are deltas.
    if (event.kind === 'ops') {
      const snapshot = event.snapshot ? provider.snapshot?.() : undefined;
      if (snapshot) { for (const fn of snapshotSubs) fn(snapshot); }
      else publishOps(event.ops);
    }
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
    assets: opts.assets,
    admission: 'work-room',
    recoveryIn: { subscribe(fn) { recoverySubs.add(fn); for (const copy of provider.recoveries?.() ?? []) fn(copy); return () => { recoverySubs.delete(fn); }; } },
    saveIn: { subscribe(fn) { saveSubs.add(fn); fn(saveState()); return () => { saveSubs.delete(fn); }; } },
    adapter: provider.adapter,
    history: provider.history,
    self,

    get role(): CollabRole {
      // Fail closed, exactly as the provider reads the ack: anything that is not a
      // stated writer is an observer.
      const state = provider.state();
      return state.role === 'writer' && state.status !== 'closed' ? 'writer' : 'observer';
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

    /** Inbound deltas do not replay. A late mount catches up through snapshotIn. */
    opsIn: {
      subscribe(fn: (ops: readonly CanvasOp[]) => void): () => void {
        opsSubs.add(fn);
        return () => {
          opsSubs.delete(fn);
        };
      },
    },

    snapshotIn: {
      subscribe(fn) {
        snapshotSubs.add(fn);
        // The work opener connects before mounting. Read the CURRENT document,
        // including any edits received since join, instead of replaying an old event.
        const snapshot = provider.state().status === 'live' ? provider.snapshot?.() : undefined;
        if (snapshot) fn(snapshot);
        return () => { snapshotSubs.delete(fn); };
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
    claims: provider.claims,
    comments: opts.comments,
    people: opts.people,

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
      const exact = rosterRows().find(entry => entry.id === id);
      if (exact) return exact.role === 'writer' || exact.role === 'observer' ? exact.role : undefined;
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
      stopAssets?.(); opts.assets?.close();
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
      saveSubs.clear(); recoverySubs.clear();
      stateSubs.clear();
      opsSubs.clear();
      snapshotSubs.clear();
    },
  };
}
