// SPDX-License-Identifier: MPL-2.0
/**
 * collab-mount - the single seam between a ceremony that has just CONNECTED and the
 * code that turns that connection into a live co-editing session (plan 100 section 5, section 6.2a,
 * section 11.17; wave 2.5's door, opened here in 2.4).
 *
 * The house single-provider pattern, fourth of its kind: `lib/canvas-sync-provider.ts`
 * registers the convergence adapter, `lib/collab-session-source.ts` registers the
 * per-mount session factory, `lib/collab-launch.ts` registers the two openers - and this
 * one registers the MOUNT. Same rules throughout: one registrant at a time, last wins,
 * dormant by default, a throwing registrant swallowed so a ceremony can never be broken
 * by the thing it hands off to.
 *
 * WHERE THIS LIVES IN THE CHAIN, because four registries is three too many to hold in your
 * head: the ceremony ends with a live pair and nowhere to put it; `collab-session-source`
 * is asked, per tool mount, whether THIS tool on THIS slot is in a collab. Nothing joins
 * those two facts. That join is the registrant here - given a {@link CollabConnection} it
 * builds a `CollabSessionHandle` over the transport, registers it as the session source
 * for the slot the ceremony ran from (section 6.2a pins a private collab to exactly that slot),
 * gives the acceptor a memory-backed `host.state` so its copy stays ephemeral (section 11.17),
 * and takes the user to the tool. None of that belongs in a dialog, and none of it can be
 * written until the session composition exists - hence a seam rather than a call.
 *
 * WHY A PARKING SURFACE EXISTS, and why it is not over-engineering. The ceremony is
 * driven by two humans on their own schedule; the mount is registered by whichever
 * module owns co-editing, and in a lazily-chunked shell that module may not be loaded
 * yet - the acceptor arrives on `#/join` cold, from a link, with no tool view ever
 * having mounted. So the two events genuinely race. Dropping a connection because the
 * adopter was half a second late would throw away a completed WebRTC pairing that costs
 * two people a fresh ceremony to rebuild (section 6.1: a dropped connection needs a whole new
 * invite). {@link parkHandle} keeps it; {@link takeParked} is how the stitch adopts it.
 *
 * The stitch's contract, stated once so it is not folklore:
 *
 * ```ts
 * const off = registerCollabMount(mountLiveSession);
 * for (const conn of takeParked()) void mountLiveSession(conn);   // adopt the race
 * ```
 *
 * Registration deliberately does NOT drain by itself. The registrant decides when it is
 * ready to receive (it may want its own state wired first), and a drain hidden inside
 * `registerCollabMount` would fire re-entrantly during the registrant's own import.
 *
 * WHAT PARKING CANNOT DO, said plainly. A parked connection is a live transport - in
 * Track A an `RTCPeerConnection` with three data channels attached. The ceremony dialog
 * will not close it: `CeremonyConnectedHandle.close()` closes the DIALOG, and the
 * transport was handed to whoever built it (see `components/collab-ceremony.ts`'s
 * `releaseEffects` - after `onConnected` the dialog will not hang up). That is why
 * {@link CollabConnection} carries its own {@link CollabConnection.close}: the adopter
 * needs it, AND it is the only thing that can hang the pair up. It is also why
 * {@link MAX_PARKED} is small - an unadopted connection is a leak we can bound, so the
 * oldest is evicted (and closed, since we hold the only handle to it) rather than
 * accumulating.
 *
 * WHY THIS SEAM IS TRANSPORT-AGNOSTIC (wave 2.5). It carried an `RtcTransport` while
 * Track A was the only producer. It no longer does: the connection arrives as a built
 * {@link CollabSessionHandle} - the one thing `createCollabSession` asks a transport for
 * - plus a `close()` that hangs up whatever is underneath. Track A wraps its transport
 * inside that `close()` (`collab/rtc-connection.ts`); Track B wraps `provider.close`
 * (`org/collab-handle.ts`). One mount serves both, and neither track's object shape
 * leaks into the seam or into the mount registered on it (section 7's last paragraph: the shell
 * has exactly ONE collab client implementation - only the transport object differs).
 *
 * SO PARKING IS BOUNDED THREE WAYS, and the third one is the one that matters. Eviction
 * at {@link MAX_PARKED} closes what it drops; {@link takeParked} hands ownership to the
 * adopter; and {@link releaseParked} is what the CEREMONY calls when its dialog closes
 * with nobody having adopted the pair. Without that last one the whole flow ends in a
 * lie: `collab/join-route.ts`'s `onClose` paints "This collab is closed. Nothing else is
 * being shared." while the peer connection and its three channels are still open for the
 * lifetime of the page - and today, with no mount registered anywhere in product code,
 * that is EVERY successful private collab, not an edge case. A parked connection whose
 * ceremony is gone has no adopter coming: the ceremony is how a connection gets here.
 *
 * There is deliberately no TTL on top of those three. A timer cannot tell "the stitch is
 * half a second late" (the race parking exists for) from "nobody is coming", so it would
 * either be long enough to be no bound at all or short enough to hang up a pair the
 * adopter was about to take. The dialog closing is the fact, not a guess about one.
 */

import type { CeremonyRole } from '../collab/ceremony.ts';
import type { CollabSessionHandle } from './collab-session.ts';
import type { CollabLaunchContext } from './collab-launch.ts';
import type { HistoryRange, HistoryWireEntry } from '../collab/history-exchange.ts';
import type { SavedStateData } from '../bridge/state.ts';

/**
 * Which participant this device is.
 *
 * Track A's pairing is asymmetric (section 6.2a: the inviter owns persistence, the acceptor's
 * copy is ephemeral), so its two roles are the ceremony's own. Track B has no ceremony
 * and no owner-of-the-session - the server is the authority - so everyone joining an org
 * room is a `'member'`: not ephemeral, not seeded from a peer, seeded by the join-ack.
 */
export type CollabConnectionRole = CeremonyRole | 'member';

/** Values a mount seeds a runtime with: URL-mode parameters, exactly the key/value
 *  pairs `parseUrlState` reads. See `lib/collab-live-mount.ts` for why the seed is in
 *  that currency and not raw input values. */
export type CollabSeed = Record<string, unknown>;

/**
 * One live session, as handed over the moment its transport reaches `connected`.
 *
 * Every field is what the adopter cannot re-derive: the ceremony is gone by then, and
 * neither the handle nor the transport under it is reachable from any registry.
 */
export interface CollabConnection {
  /** Which participant this device is. The inviter owns the session (section 6.2a). */
  readonly role: CollabConnectionRole;
  /** The built session handle - the convergence adapter, this client's identity, the
   *  presence lanes and the connection-state stream. What `createCollabSession` takes. */
  readonly handle: CollabSessionHandle;
  /**
   * Hang the session up: the handle's teardown AND the transport beneath it.
   *
   * Separate from `handle.close()` on purpose - a producer may own things the session
   * knows nothing about (Track A's ceremony effects, Track B's provider), and the
   * parking surface must be able to end a pair nobody adopted without knowing which
   * track made it.
   */
  close(): void;
  /** The tool both peers have (section 6.1). Absent only on a malformed invite. */
  readonly toolId?: string;
  /** Inviter only: the Share-dialog context the collab was started from. */
  readonly launch?: CollabLaunchContext;
  /**
   * True when this device's copy must never touch a saved slot - the acceptor's working
   * copy is ephemeral (section 6.2a), which section 11.17 implements as a memory-backed `host.state`
   * rather than an audit of every save call site. The adopter owns doing that; this flag
   * is the ceremony telling it which side it is on.
   */
  readonly ephemeral: boolean;
  /**
   * The session state this mount should be BORN with (section 12 Q3: transfer-on-connect, one
   * path), when it is known at hand-off time. The inviter's is its own live model; a
   * `'member'` never carries one (the server seeds through the join-ack).
   */
  readonly seed?: CollabSeed;
  /**
   * The same seed when it can only arrive after this hand-off, with `undefined` for
   * "there will not be one".
   *
   * Track A needs it: the seed rides the ops-lane hello (section 6.1 - the invite blob is sized
   * for a QR and a packed session is not), and the ceremony reaches `connected` off an
   * ICE event, which precedes the data channel the hello arrives on. So the acceptor's
   * connection is handed over BEFORE its seed exists, and a mount that wants to open the
   * tool already populated waits on this instead of guessing. Absent whenever {@link
   * seed} is already known, and a mount must never wait on it forever - a seed that
   * never lands is not an error, it is convergence doing the job instead (section 6.2's late
   * joiner gets the full state from the peer).
   */
  readonly seedLater?: Promise<CollabSeed | undefined>;
  /**
   * Ask the peer for the revisions it will share, over the negotiated `history-v1`
   * capability (plan 221 section 9). Present only on a transport that carries the exchange
   * (Track A today); it resolves empty or rejects `unavailable` when the peer did not
   * agree the capability, and returns metadata only - payloads are a separate transfer.
   */
  readonly requestPeerHistory?: (range?: HistoryRange) => Promise<readonly HistoryWireEntry[]>;
  /**
   * Fetch one peer revision's full payload over the negotiated capability - chunked and
   * hash-verified (plan 221 section 9). Present alongside {@link requestPeerHistory}; rejects if
   * the peer withholds the revision or the bytes fail their checksum. The result is used
   * only to open a NEW local copy, never to overwrite the live shared document.
   */
  readonly requestPeerRevision?: (revisionId: string) => Promise<SavedStateData>;
}

/** What a registrant provides: take a live pair and make it a session. */
export type CollabMount = (conn: CollabConnection) => void | Promise<void>;

/** How many unadopted connections may be held at once. See the header's leak note. */
export const MAX_PARKED = 2;

let current: CollabMount | undefined;
const parked: CollabConnection[] = [];

/** Register the live-session mount; returns an unregister fn (last-wins). */
export function registerCollabMount(fn: CollabMount): () => void {
  current = fn;
  return () => { if (current === fn) current = undefined; };
}

/** The registered mount, or undefined while nothing owns co-editing yet. */
export function getCollabMount(): CollabMount | undefined {
  return current;
}

/**
 * Hold a connection made before anyone registered. Oldest-out at {@link MAX_PARKED}, and
 * an evicted connection is hung up rather than left dangling - we hold its transport, so
 * unlike the dialog we actually can.
 */
export function parkHandle(conn: CollabConnection): void {
  parked.push(conn);
  while (parked.length > MAX_PARKED) {
    const dropped = parked.shift();
    try { dropped?.close(); } catch { /* an already-dead transport is fine */ }
  }
}

/** Drain every parked connection, oldest first. Call it right after registering. */
export function takeParked(): CollabConnection[] {
  return parked.splice(0, parked.length);
}

/**
 * Hang up a connection nobody adopted - the ceremony's own teardown (see the header).
 *
 * Idempotent and ownership-aware: it acts ONLY while the connection is still parked, so
 * calling it for a pair a mount already took (or a drained one the stitch now owns) is a
 * no-op rather than a hang-up behind the adopter's back. Returns whether it closed one,
 * which is the only thing a caller could want to know.
 */
export function releaseParked(conn: CollabConnection): boolean {
  const at = parked.indexOf(conn);
  if (at < 0) return false;
  parked.splice(at, 1);
  try { conn.close(); } catch { /* an already-dead transport is fine */ }
  return true;
}

/** How many connections are waiting for an adopter. Diagnostics and tests. */
export function parkedCount(): number {
  return parked.length;
}

/**
 * Hand a live pair to the registered mount, or park it when there is none.
 *
 * Returns whether a mount took it - which is exactly the question the ceremony's caller
 * asks to decide between "we are live" and the scaffold note (`main.ts` installs a mount
 * on every boot, so the only person who ever sees that note is a developer running
 * without one, and they are owed the truth rather than a dialog that pretends).
 *
 * A throwing or rejecting mount is treated as HANDLED, not as a parking case: it owns the
 * connection from the moment it was called, and re-parking it would hand the same live
 * transport to a second adopter later.
 */
export function deliverCollabConnection(conn: CollabConnection): boolean {
  const fn = current;
  if (!fn) {
    parkHandle(conn);
    return false;
  }
  try {
    const result = fn(conn);
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch(() => { /* the mount owns its own failure */ });
    }
  } catch { /* same rule */ }
  return true;
}

/** TEST-ONLY: clear the registry and the parking surface back to their dormant defaults. */
export function _clearCollabMountForTests(): void {
  current = undefined;
  parked.length = 0;
}
