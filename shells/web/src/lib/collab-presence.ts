// SPDX-License-Identifier: MPL-2.0
/**
 * collab-presence - the roster and the wire cadence for live presence
 * (plan 100 section 4.5–section 4.8, section 11.4, section 11.5; wave 1.1).
 *
 * TRANSPORT-BLIND BY CONSTRUCTION. This module holds who is here, what they are
 * looking at, and WHEN a frame may go out. It owns no socket, no data channel, no
 * DOM and no globals: frames arrive through `receive()` and leave through the
 * injected `send()`, so the same engine drives a WebRTC pair (Track A), a ws room
 * (Track B) and the loopback test harness (section 10) without knowing which it is. The
 * clock and the timers are injected too - tests run it on fake time, and the
 * heartbeat can move into a Worker later (section 11.4) by handing it a different
 * `setTimer`, not by rewriting this.
 *
 * The numbers are the plan's, pinned once here (section 4.7):
 *
 *   • **50 ms send throttle** while peers are present - leading edge plus a trailing
 *     flush, so the last state of a burst always lands.
 *   • **ZERO traffic when alone.** Not "cheap when alone" - nothing sent, and no
 *     timer even scheduled (tldraw's occupancy scaling, radicalised: nothing to say,
 *     nobody to hear). Presence starts costing the moment a first peer appears, and
 *     that arrival flushes our own state so the newcomer sees us immediately.
 *   • **15 s self-refresh**, **30 s eviction**, **3 s sweep** (the Yjs constants).
 *   • **`null` state = clean leave**, applied immediately rather than waiting out
 *     the TTL.
 *
 * TWO SNAGS ARE DESIGNED IN, not left to the transport:
 *
 *  - **section 11.5 - unordered frames arrive stale.** The presence lane is deliberately
 *    lossy (`maxRetransmits: 0`), so a cursor frame can overtake a newer one. Every
 *    frame carries a per-sender sequence number and the roster applies newest-only:
 *    a frame whose `seq` is not strictly greater than the one we hold for that
 *    sender is dropped, not merged. Presence is a whole-value register - there is
 *    no field-level merge to fall back on, which is exactly why the ordering has to
 *    be resolved here.
 *  - **section 11.4 - a background tab is not a dead tab.** Chrome throttles background
 *    timers to ~1/min, so a helper reading their email would look evicted at TTL
 *    while the connection is perfectly healthy. So a peer flagged `away` is EXEMPT
 *    from eviction: the TTL is for silent crashes only, and a closed channel or a
 *    failed ICE connection is removed by the transport calling `remove()`. An away
 *    peer shows as away, never as gone.
 *
 * A leave DISCARDS the sender's sequence bookkeeping, so a device that reloads and
 * rejoins with its counter back at 1 is admitted straight away. The trade, stated
 * rather than hidden: a frame still in flight when the leave overtakes it re-adds
 * that peer, and the TTL is what removes it again. Ghosting for one sweep beats
 * locking a real rejoin out for 30 s. (A per-session epoch alongside `seq` would
 * settle both; it is not in the v1.1 frame shape, so it is not invented here.)
 *
 * A reload with NO leave - the tab that crashed, the phone that slept - is bounded
 * by the same 30 s: a frame whose `seq` is not newer is accepted anyway once the
 * sender has been silent for a whole TTL. Eviction alone cannot carry that, because
 * the away exemption above means an away peer is never evicted, and its stale
 * bookkeeping would otherwise stand for the life of the session.
 *
 * Ordering note for the colour engine (section 4.4, wave 1.4): `roster()` returns peers in
 * FIRST-SEEN order, which is what makes "deterministic first-unused-wins by join
 * order" reproducible on every client. `firstSeen` is carried per peer so a caller
 * can re-derive it after an eviction reshuffles the map.
 *
 * No wall clock: the default clock is `performance.now()` where it exists. Presence
 * never converges (it is not the op path - section 11.7), but a device whose system clock
 * jumps must not evict a peer that is sitting right there, which a monotonic clock
 * gets for free.
 */

// Canonical presence payload - the contract's v1.1 `Presence` (plan 100 section 3).
import type { Presence } from '@lolly-tools/core/canvas-op-v1';

/**
 * What one client says about itself on the awareness lane.
 *
 * Structurally the contract's `Presence`, with the two canvas-only lanes relaxed to
 * optional: focus presence ships on EVERY tool (section 4.1) while a true x/y cursor is
 * opt-in per tool (section 4.3), so a sidebar-only tool has no cursor and no selection to
 * report. A full `Presence` is assignable to this; the reverse is not, and the test
 * pins that direction so the two cannot drift apart silently.
 */
export type PresenceState =
  Omit<Presence, 'cursor' | 'selection'> & Partial<Pick<Presence, 'cursor' | 'selection'>>;

/** One presence frame as it crosses the wire. */
export interface PresenceFrame {
  /** The SENDING client's id (the per-device ULID of plan 100 section 5) - the roster key.
   *  Distinct from `state.userId`, which is the identity a human sees; in a private
   *  collab they are usually the same value, and nothing here assumes it. */
  readonly from: string;
  /** Per-sender sequence number, strictly increasing. Newest-only (section 11.5). */
  readonly seq: number;
  /** The sender's presence, or `null` for a clean leave (section 4.7). */
  readonly state: PresenceState | null;
  /** The sender's tab is hidden (section 11.4). Away is a display state, never a reason
   *  to evict. */
  readonly away?: boolean;
}

/** A roster entry - one peer as this client currently understands them. */
export interface PresencePeer {
  /** The peer's client id (the frame's `from`). */
  readonly id: string;
  readonly state: PresenceState;
  /** The sequence number of the newest frame applied for this peer. */
  readonly seq: number;
  readonly away: boolean;
  /** Engine-clock ms of the first frame that created this entry - the join order
   *  the collaborator-colour assignment keys off (section 4.4). */
  readonly firstSeen: number;
  /** Engine-clock ms of the newest applied frame - what the TTL measures. */
  readonly lastSeen: number;
}

/** Outbound coalescing window while peers are present (section 4.7). */
export const PRESENCE_THROTTLE_MS = 50;
/** Re-broadcast our own state this often so peers' TTLs never expire us (section 4.7). */
export const PRESENCE_HEARTBEAT_MS = 15_000;
/** Silence after which a peer is presumed crashed (section 4.7). Away peers are exempt. */
export const PRESENCE_TTL_MS = 30_000;
/** How often the roster is checked for expiries (section 4.7). */
export const PRESENCE_SWEEP_MS = 3_000;

export interface PresenceEngineOptions {
  /** This device's collab client id - stamped on every outbound frame, and the
   *  entry a joiner's handshake snapshot must not echo back (section 4.7). */
  clientId: string;
  /** Hand one frame to the transport. Called at most once per `PRESENCE_THROTTLE_MS`
   *  and never while the roster is empty. Omitted = a sink (the engine still keeps
   *  a roster, which is what an observer-only peer wants). */
  send?(frame: PresenceFrame): void;
  /** Monotonic ms. Injected so tests run on fake time. */
  now?(): number;
  /** One-shot timer returning an opaque handle. Repetition is built on top by
   *  rescheduling, so a Worker-hosted heartbeat (section 11.4) only has to supply these
   *  two functions. */
  setTimer?(fn: () => void, ms: number): unknown;
  clearTimer?(handle: unknown): void;
}

export interface PresenceEngine {
  /** Replace this client's presence. Coalesced and throttled outbound; silent while
   *  alone. */
  setLocal(state: PresenceState): void;
  /** Merge a few fields into the local state (a focus change, a cursor sample).
   *  A no-op before the first `setLocal` - there is nothing to merge into. */
  updateLocal(patch: Partial<PresenceState>): void;
  /** Flag this client's tab hidden/visible (`visibilitychange`, section 11.4). Sends when
   *  the flag actually changes so peers can grey the avatar. */
  setAway(away: boolean): void;
  /** Apply one inbound frame. Returns false when it was dropped as stale/out-of-
   *  order (section 11.5), self-addressed, or a leave for a peer we never had. */
  receive(frame: PresenceFrame): boolean;
  /** Drop a peer outright - the transport's call on channel close or ICE `failed`
   *  (section 11.3, section 11.4). Not the TTL's job. */
  remove(clientId: string): void;
  /** DISCOVERY escape hatch: emit the local state once, NOW, even while the roster
   *  is empty. The occupancy rule ("no traffic while alone") exists so an idle solo
   *  session costs nothing - but in a serverless pair BOTH sides start alone with no
   *  join-ack to seed them, so "alone" is indistinguishable from "undiscovered" and
   *  someone must speak first (plan 100 drill finding, 2026-08-10). The composition
   *  layer calls this while its transport is LIVE and the roster is empty (the
   *  presence lane is lossy, so it repeats on a slow cadence until first contact).
   *  Emits through the same seq/throttle path as every other frame so the peer's
   *  newest-only rule stays coherent; a no-op before the first `setLocal`. */
  announce(): void;
  /** Every peer, in first-seen order. Excludes this client. */
  roster(): PresencePeer[];
  /** This client's presence, or null before the first `setLocal`. */
  self(): PresenceState | null;
  /** The join handshake payload (section 4.7): everything we know - our own state and
   *  every peer - MINUS the joiner's own entry, which echoing back is tldraw's
   *  orphan bug. Each frame carries its origin's newest `seq`, so the receiver's
   *  newest-only rule makes the snapshot idempotent against live frames. */
  snapshot(joinerId?: string): PresenceFrame[];
  /** Subscribe to roster changes (peer joined / updated / went away / left).
   *  Local-only changes do not fire it. Returns a real teardown. */
  subscribe(fn: (peers: readonly PresencePeer[]) => void): () => void;
  /** Broadcast the clean-disconnect `null` frame (when anyone is listening), stop
   *  every timer, drop the roster and the subscribers. Idempotent. */
  destroy(): void;
}

/** Mutable twin of `PresencePeer` - copied out, never handed to a caller. */
interface PeerRecord {
  id: string;
  state: PresenceState;
  seq: number;
  away: boolean;
  firstSeen: number;
  lastSeen: number;
}

function defaultNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function createPresenceEngine(opts: PresenceEngineOptions): PresenceEngine {
  const { clientId } = opts;
  const send = opts.send;
  const now = opts.now || defaultNow;
  const setTimer = opts.setTimer || ((fn: () => void, ms: number): unknown => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer
    || ((handle: unknown): void => { clearTimeout(handle as ReturnType<typeof setTimeout>); });

  /** Insertion-ordered, so `roster()` is join order (section 4.4). */
  const peers = new Map<string, PeerRecord>();
  const subscribers = new Set<(peers: readonly PresencePeer[]) => void>();

  let local: PresenceState | null = null;
  let away = false;
  let seq = 0;
  let lastSentAt = Number.NEGATIVE_INFINITY;
  /** The armed trailing flush, or null when the window is clear. */
  let trailing: unknown = null;
  let stopHeartbeat: (() => void) | null = null;
  let stopSweep: (() => void) | null = null;
  let destroyed = false;

  // ── timers ──────────────────────────────────────────────────────────────────

  /** A repeating timer built from one-shots. Returns its canceller; `fn` may cancel
   *  it re-entrantly (the last eviction stopping the lifecycle does exactly that),
   *  which is why the reschedule re-checks.
   *
   *  The reschedule is in a `finally` because a tick that throws must not be the END
   *  of the chain: the sweep dispatches subscribers and the heartbeat calls into the
   *  transport, so one throwing consumer would otherwise silently disable TTL
   *  eviction for the life of the engine - and `syncLifecycle`'s `||=` can never
   *  re-arm a canceller that is still non-null. The throw still reaches the host and
   *  is reported; it just no longer takes presence down with it. */
  function repeat(ms: number, fn: () => void): () => void {
    let handle: unknown = null;
    let stopped = false;
    const tick = (): void => {
      if (stopped) return;
      handle = null;
      try {
        fn();
      } finally {
        if (!stopped) handle = setTimer(tick, ms);
      }
    };
    handle = setTimer(tick, ms);
    return () => {
      stopped = true;
      if (handle !== null) { clearTimer(handle); handle = null; }
    };
  }

  /** Occupancy scaling (section 4.7): the heartbeat and the sweep exist only while someone
   *  is here to hear them. Alone, this engine schedules nothing at all. */
  function syncLifecycle(): void {
    if (destroyed || peers.size === 0) {
      // The trailing flush belongs to the roster too. Every path that can empty the
      // roster comes through here (a `remove()`, a `null` leave frame, an eviction),
      // and an armed trailing timer that outlived the last peer would fire a frame
      // into an empty room - traffic while alone, which is the one thing this engine
      // promises never to produce.
      if (trailing !== null) { clearTimer(trailing); trailing = null; }
      stopHeartbeat?.();
      stopSweep?.();
      stopHeartbeat = null;
      stopSweep = null;
      return;
    }
    stopHeartbeat ||= repeat(PRESENCE_HEARTBEAT_MS, () => { if (local) scheduleSend(); });
    stopSweep ||= repeat(PRESENCE_SWEEP_MS, sweep);
  }

  // ── outbound ────────────────────────────────────────────────────────────────

  function emit(state: PresenceState | null): void {
    if (trailing !== null) { clearTimer(trailing); trailing = null; }
    lastSentAt = now();
    seq += 1;
    try {
      send?.({ from: clientId, seq, state, away });
    } catch {
      // The lane is lossy by construction (`maxRetransmits: 0`), so a frame the
      // transport refused - a channel that closed between the arm and the flush - is
      // exactly the case the next heartbeat covers. Swallowing it here keeps a
      // closed channel from killing the heartbeat that would otherwise notice.
    }
  }

  /** Leading edge + trailing flush, at most one frame per window - and nothing at
   *  all while alone, which is the whole of the occupancy rule on the send side. */
  function scheduleSend(): void {
    if (destroyed || !local || peers.size === 0) return;
    if (trailing !== null) return;
    const since = now() - lastSentAt;
    if (since >= PRESENCE_THROTTLE_MS) { emit(local); return; }
    trailing = setTimer(() => {
      trailing = null;
      // Re-checked, not assumed: `syncLifecycle` disarms this timer when the roster
      // empties, and an injected timer that fires anyway must still not break the
      // "nothing while alone" rule.
      if (local && !destroyed && peers.size > 0) emit(local);
    }, PRESENCE_THROTTLE_MS - since);
  }

  // ── roster ──────────────────────────────────────────────────────────────────

  /** A subscriber's failure is its own. One throwing roster listener must not skip
   *  the listeners after it, must not rethrow into the transport that called
   *  `receive()`, and above all must not kill the sweep it was dispatched from. */
  function notify(): void {
    if (subscribers.size === 0) return;
    const snap = roster();
    for (const fn of [...subscribers]) {
      try {
        fn(snap);
      } catch {
        /* not ours to handle; the roster is already committed */
      }
    }
  }

  /** Copied twice over: the record so a caller cannot re-seat a peer, and the state
   *  so a caller cannot write through to the store (and to every later subscriber).
   *  One level is enough - `Presence`'s nested `cursor`/`viewport`/`selection` are
   *  `readonly` in the contract, so reaching them needs a cast. */
  function roster(): PresencePeer[] {
    return [...peers.values()].map((p) => ({ ...p, state: { ...p.state } }));
  }

  /** Evict the silent, never the away (section 11.4). */
  function sweep(): void {
    const t = now();
    let changed = false;
    for (const [id, peer] of peers) {
      if (peer.away) continue;
      if (t - peer.lastSeen >= PRESENCE_TTL_MS) { peers.delete(id); changed = true; }
    }
    if (!changed) return;
    syncLifecycle();
    notify();
  }

  function receive(frame: PresenceFrame): boolean {
    // Our own frame looped back by a relay: never our own roster entry.
    if (destroyed || frame.from === clientId) return false;
    const t = now();
    const existing = peers.get(frame.from);
    // Newest-only (section 11.5). `<=` so a duplicate is as inert as a stale one.
    //
    // …unless the sender has been silent for a whole TTL, in which case the frame is
    // read as a RESTART rather than as reordering. `lastSeen` only moves on an
    // accepted frame, so a device that reloads and starts counting at 1 again can
    // never climb back over the seq we hold: eviction is the only thing that clears
    // the bookkeeping, and an away peer is exempt from eviction (section 11.4) - which would
    // make the lockout permanent for exactly the peer most likely to reload. The
    // header states the trade as "locking a real rejoin out for 30 s"; this is what
    // makes 30 s the actual bound, without evicting anyone to get it. Reordering on
    // the lossy lane spans milliseconds, never half a minute, so nothing real is
    // misread as a restart.
    if (existing && frame.seq <= existing.seq && t - existing.lastSeen < PRESENCE_TTL_MS) return false;

    if (frame.state === null) {
      if (!existing) return false;
      peers.delete(frame.from);
      syncLifecycle();
      notify();
      return true;
    }

    const wasEmpty = peers.size === 0;
    peers.set(frame.from, {
      id: frame.from,
      state: frame.state,
      seq: frame.seq,
      away: frame.away === true,
      firstSeen: existing ? existing.firstSeen : t,
      lastSeen: t,
    });
    if (wasEmpty) {
      // First company: start the lifecycle, and announce ourselves - a client that
      // has been dutifully silent is otherwise invisible to the peer that just
      // arrived (section 4.7).
      syncLifecycle();
      scheduleSend();
    }
    notify();
    return true;
  }

  return {
    setLocal(state: PresenceState): void {
      if (destroyed) return;
      local = state;
      scheduleSend();
    },

    updateLocal(patch: Partial<PresenceState>): void {
      if (destroyed || !local) return;
      local = { ...local, ...patch };
      scheduleSend();
    },

    setAway(next: boolean): void {
      if (destroyed || away === next) return;
      away = next;
      scheduleSend();
    },

    announce(): void {
      if (destroyed || !local) return;
      // The one deliberate exception to the occupancy rule (see the interface doc):
      // emit through the SAME throttle/seq path as every other frame - bypassing the
      // roster gate, not the rate gate - so the peer's newest-only rule stays
      // coherent when the engine's ordinary sends begin.
      if (trailing !== null) return;
      const since = now() - lastSentAt;
      if (since >= PRESENCE_THROTTLE_MS) { emit(local); return; }
      trailing = setTimer(() => {
        trailing = null;
        if (local && !destroyed) emit(local);
      }, PRESENCE_THROTTLE_MS - since);
    },

    receive,
    remove(id: string): void {
      if (!peers.delete(id)) return;
      syncLifecycle();
      notify();
    },
    roster,
    self(): PresenceState | null {
      return local;
    },

    snapshot(joinerId?: string): PresenceFrame[] {
      const out: PresenceFrame[] = [];
      if (local && clientId !== joinerId) {
        out.push({ from: clientId, seq, state: local, away });
      }
      for (const peer of peers.values()) {
        if (peer.id === joinerId) continue;
        out.push({ from: peer.id, seq: peer.seq, state: peer.state, away: peer.away });
      }
      return out;
    },

    subscribe(fn: (peers: readonly PresencePeer[]) => void): () => void {
      subscribers.add(fn);
      return () => { subscribers.delete(fn); };
    },

    destroy(): void {
      if (destroyed) return;
      // The clean-disconnect frame (section 4.7) - only when there is someone to tell, and
      // never through the throttle: it is the last thing we say.
      if (peers.size > 0) emit(null);
      destroyed = true;
      if (trailing !== null) { clearTimer(trailing); trailing = null; }
      peers.clear();
      syncLifecycle();
      subscribers.clear();
      local = null;
    },
  };
}
