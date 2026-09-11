// SPDX-License-Identifier: MPL-2.0
/**
 * beam-ui - the door into the beam (plan 100 section 6.4; the stitch-2 debt named in
 * `collab/beam-session.ts`'s header as "the caller's line").
 *
 * Five modules already implement a beam end to end - the frames (`beam-protocol.ts`),
 * the lane (`rtc-transport.ts`), staging (`lib/beam-sink.ts`), the payload
 * (`lib/beam-pack.ts`), the consent UI (`components/beam-toast.ts`) - and
 * `beam-session.ts` wires the five together. What none of them has is a way in: the
 * session is created by nobody, the toast is mounted by nobody, and `sendCurrentSession`
 * is called by nobody. A user with two paired devices could not beam a thing.
 *
 * This module is that one missing call, and deliberately nothing else. It owns no
 * frames, no storage, no protocol and no copy at all - every string a human reads
 * during a beam belongs to the toast or the pack, and the ONE new control's label
 * belongs to `components/collab-pill.ts`'s STRINGS map, which is where the translation
 * corpus can see it.
 *
 * ── The three seams it joins ───────────────────────────────────────────────────
 *
 *   1. **the lane.** `beam-session.ts` documents its own production wiring in one
 *      line - `createBeamSession({ lane: asBeamLane(transport.beam), inbound:
 *      beamInbound(transport) })` - and that line is here, verbatim, because this is
 *      the only module allowed to name both a transport and a beam session at once.
 *      `asBeamLane` is a compile-time no-op whose whole job is to fail `tsc` if the
 *      two shapes ever drift; keeping it means the drift proof travels with the call.
 *   2. **the library.** The default ingest needs a `BeamPackHost` - the bridge slice a
 *      pack is landed into. There is exactly one place in the shell that holds one AND
 *      knows which collab it belongs to, and it is a MOUNTED TOOL
 *      (`views/tool-collab.ts`). An ACCEPTOR holds two of them, which is the one place
 *      this module branches: their `host.state` has been swapped for the memory bridge
 *      (section 11.17), so their working copy PACKS from the ephemeral one and never touches a
 *      slot - while a beam they accepted LANDS in the real library, because section 6.4 says a
 *      received gift lands there attributed. `packHost` is that second host, and every
 *      caller with only one passes `host` alone and sees no branch at all.
 *   3. **the human.** `mountBeamToast(container, session.toast)` - on BOTH ends, at
 *      collab mount time, because the toast is not only the receiver's consent sheet:
 *      it is also the sender's "waiting for Priya to accept…", its progress bars and
 *      its cancel. One mount serves both directions (the session multiplexes an
 *      outgoing and an incoming beam onto one event stream), which is why there is one
 *      toast per collab and not one per beam.
 *
 * ── Consent stays where it was ────────────────────────────────────────────────
 *
 * Nothing here decides anything. The receiver's `accept`/`decline` travels back through
 * the toast port (`BeamEventSource`), exactly as `beam-session.ts` specifies, and the
 * sender's UI is the same event stream read from the other side - so the sender watches
 * its own beam through the receiver's component, with no second progress surface to
 * keep in sync and no way for this module to skip a gate it does not own.
 *
 * ── What it deliberately does NOT do ──────────────────────────────────────────
 *
 *  - **Reach for a transport.** {@link CollabBeamLink} arrives already built by whoever
 *    made the pair (`collab/rtc-connection.ts`), and is read STRUCTURALLY at the mount
 * - the `CollabHandleLanes` idiom from `views/tool-collab.ts`. A work collab (Track
 *    B) publishes none, so the send control is structurally absent there rather than
 *    hidden behind a flag: the server path has no beam and never will (section 7).
 *  - **Know what a session IS.** {@link BeamCurrentSessionReader} is injected by the
 *    mounted view, because "the thing I am working on right now" is the runtime's live
 *    model and this module cannot see one.
 *  - **Own a clock or a retry.** A beam is paced by the lane's own drain callback
 *    (section 11.6) and ended by the human or by the transport.
 *
 * ── The one honest limit ──────────────────────────────────────────────────────
 *
 * A beam can only be offered and received while BOTH peers have the tool mounted,
 * because that is when each side's session subscribes to the lane. In practice that is
 * every moment a collab is live - the acceptor is navigated straight into the tool and
 * the inviter is remounted into it - but a frame that arrives in the gap between
 * `connected` and the tool's first paint is dropped rather than queued. Queuing it
 * would mean staging bytes for a consent sheet with nowhere to appear.
 */

import { asBeamLane, beamInbound, createBeamSession } from './beam-session.ts';
import type { BeamSendResult, BeamSession, BeamSinkFactory } from './beam-session.ts';
import { mountBeamToast } from '../components/beam-toast.ts';
import type { BeamEventSource, BeamToastHandle } from '../components/beam-toast.ts';
import type { BeamPackHost } from '../lib/beam-pack.ts';
import type { CeremonyRole } from './ceremony.ts';
import type { RtcBeamLane, RtcInboundMessage } from './rtc-transport.ts';

// ── What a transport publishes ────────────────────────────────────────────────

/**
 * The transport slice a beam needs, and the whole of it: the bulk lane, plus the
 * inbound stream every lane is multiplexed onto.
 *
 * `RtcTransport` satisfies it as-is (see `collab/rtc-connection.ts`, which publishes
 * itself under this type), and so does a fake with six methods - which is what keeps
 * the whole feature testable with no `RTCPeerConnection` anywhere.
 */
export interface CollabBeamTransport {
  readonly beam: RtcBeamLane;
  on(type: 'message', fn: (message: RtcInboundMessage) => void): () => void;
}

/**
 * The beam half of a live collab, as the producer of a pair hands it over.
 *
 * Carried on the `CollabConnection` under the optional `beam` key ({@link
 * CollabBeamCapable}) rather than in `lib/collab-mount.ts`'s own interface, for the
 * reason `views/tool-collab.ts` reads `opsIn`/`roleIn` structurally: the mount seam is
 * transport-agnostic, and a field only Track A can fill has no business being part of
 * the contract Track B also implements.
 */
export interface CollabBeamLink {
  readonly transport: CollabBeamTransport;
  /** This device's ceremony role - decides only the section 4.5 fallback name for a nameless
   *  peer. Either side may send and either side may receive. */
  readonly role: CeremonyRole;
  /** The peer's chosen display name (section 11.23: chosen, never a profile field). */
  readonly peerName?: string;
  /** This device's chosen display name - the receiver's "From …" attribution. */
  readonly selfName?: string;
}

/** The optional extra a Track A `CollabConnection` carries. Mixed into the producer's
 *  return type so no excess-property check has to be defeated and `lib/collab-mount.ts`
 *  stays free of Track A's shape. */
export interface CollabBeamCapable {
  readonly beam?: CollabBeamLink;
}

// ── What "this session, right now" is ─────────────────────────────────────────

/**
 * What {@link CollabBeamUi.sendCurrentSessionNow} beams.
 *
 * Two shapes because `beam-session.ts`'s `sendCurrentSession` takes two: a SAVED slot
 * (packed with its own label and tile) or a LIVE, unsaved state record - the working
 * copy, which is what an inviter mid-edit and an ephemeral acceptor both actually have.
 */
export type BeamCurrentSession =
  | { readonly slot: string }
  | {
      /** The live model as a session record would hold it (`__toolId` and friends
       *  included), which is exactly what `hostWithLiveSession` shadows a slot with. */
      readonly state: Record<string, unknown>;
      /** The label the receiver files it under; also the offer's name. */
      readonly label?: string;
      /** A tile for the received session. A live state has none of its own. */
      readonly thumb?: string | null;
    };

/** Read at the moment the human presses send, never cached - the point of "current". */
export type BeamCurrentSessionReader = () => BeamCurrentSession | null;

// ── The handle ────────────────────────────────────────────────────────────────

export interface CollabBeamUiOptions {
  readonly link: CollabBeamLink;
  /** The bridge slice an incoming beam is INGESTED into. Without one the session refuses
   *  an incoming beam up front (`beam-session.ts` declines rather than accepting a
   *  transfer it could never keep), and `sendCurrentSessionNow` fails unless
   *  {@link CollabBeamUiOptions.packHost} supplies the other direction. */
  readonly host?: BeamPackHost | null;
  /**
   * The bridge slice an OUTGOING pack is built from, when it is not the same one.
   *
   * `BeamSession.sendCurrentSession` has taken a per-send host override since it was
   * written ("a caller with two hosts in play"); this is that caller. An ACCEPTOR has
   * exactly two: a memory-backed clone holding the working copy they may give away
   * (section 11.17), and the real library a gift they accepted must land in (section 6.4). Defaults to
   * {@link CollabBeamUiOptions.host}, so every other mount passes one host and notices
   * nothing.
   */
  readonly packHost?: BeamPackHost | null;
  readonly currentSession?: BeamCurrentSessionReader | null;
  /** Where a received beam stages before it is landed. Defaults to `lib/beam-sink.ts`'s
   *  IndexedDB sink, one per beam - a pass-through of `beam-session.ts`'s own option,
   *  for a shell with no IndexedDB (and for a suite that must not need one). */
  readonly sink?: BeamSinkFactory;
  /** Where the toast mounts. Defaults to a div this module appends to `document.body`
   *  and removes on close - the toast card is `position: fixed`, so its container is
   *  a hook and not a layout box (`components/beam-toast.css`). */
  readonly container?: HTMLElement | null;
  /** Injected for tests, and so a shell with an isolated tree could pass its own. */
  readonly mountToast?: (container: HTMLElement, source: BeamEventSource) => BeamToastHandle;
  /** Diagnostics. Never user copy. */
  readonly log?: (message: string, meta?: unknown) => void;
}

export interface CollabBeamUi {
  /** The live session, for a caller that wants to watch it. */
  readonly session: BeamSession;
  /** Is the bulk lane open? THE visibility test for the send control - a button that
   *  can only fail is worse than no button (section 4.6's "no dead controls" rule, the same
   *  reason the pill renders no invite without an `onInvite`). */
  isOpen(): boolean;
  /** Beam whatever this device is working on, right now. Never throws: a refusal comes
   *  back as `{ ok: false, reason }` so the caller can say something true. */
  sendCurrentSessionNow(): Promise<BeamSendResult>;
  /** Toast down, session closed, container removed if we made it. Idempotent. */
  close(): void;
}

/** True when `value` looks like a transport that can carry a beam. Duck-typed on the
 *  two members this module actually calls, for the reason `views/tool-collab.ts`
 *  duck-types its lanes: neither track's object shape may leak into the seam. */
function isBeamTransport(value: unknown): value is CollabBeamTransport {
  const t = value as { beam?: { isOpen?: unknown }; on?: unknown } | null | undefined;
  return !!t && typeof t.on === 'function' && typeof t.beam?.isOpen === 'function';
}

/**
 * The beam link on a connection, or `null` for one that carries none.
 *
 * Exported because the MOUNT (`lib/collab-live-mount.ts`) is on the boot path and must
 * not import this module for a value - it duck-types the link itself and calls in here
 * only behind a dynamic import. This is the same predicate, for anyone who can afford
 * the import, and the place the shape is stated once.
 */
export function beamLinkOf(conn: unknown): CollabBeamLink | null {
  const link = (conn as CollabBeamCapable | null | undefined)?.beam;
  if (!link || typeof link !== 'object') return null;
  if (!isBeamTransport(link.transport)) return null;
  return link;
}

/**
 * Create one collab's beam: the session over the pair's bulk lane, and the toast that
 * asks (and reports) on both ends.
 *
 * Synchronous and total - a missing `document`, a container that will not take a child
 * or a toast that throws on mount all leave a working SESSION with no UI rather than
 * failing the collab. Presence is cosmetic and a collab is not (`views/tool-collab.ts`'s
 * own rule, applied one layer down).
 */
export function createCollabBeamUi(opts: CollabBeamUiOptions): CollabBeamUi {
  const { link } = opts;
  const log = opts.log ?? ((): void => {});
  const lane = asBeamLane(link.transport.beam);
  const read = opts.currentSession ?? null;
  // Resolved once: the send path must not re-decide per press which library it is
  // packing from, and `null` for both is still a legal (send-less) session.
  const packHost = opts.packHost ?? opts.host ?? null;

  const session = createBeamSession({
    lane,
    inbound: beamInbound(link.transport),
    role: link.role,
    ...(link.peerName ? { peerName: link.peerName } : {}),
    ...(link.selfName ? { selfName: link.selfName } : {}),
    ...(opts.host ? { host: opts.host } : {}),
    ...(opts.sink ? { sink: opts.sink } : {}),
    log,
  });

  // ── the toast, one per collab ───────────────────────────────────────────────

  let ownedContainer: HTMLElement | null = null;
  let container: HTMLElement | null = opts.container ?? null;
  if (!container && typeof document !== 'undefined' && document.body) {
    ownedContainer = document.createElement('div');
    ownedContainer.className = 'beam-toast-host';
    try {
      document.body.appendChild(ownedContainer);
      container = ownedContainer;
    } catch (err) {
      ownedContainer = null;
      log('beam-ui: the toast container could not be attached', err);
    }
  }

  let toast: BeamToastHandle | null = null;
  if (container) {
    try {
      toast = (opts.mountToast ?? mountBeamToast)(container, session.toast);
    } catch (err) {
      log('beam-ui: the toast could not be mounted', err);
    }
  }

  let closed = false;

  async function sendCurrentSessionNow(): Promise<BeamSendResult> {
    if (closed) return { ok: false, reason: 'closed' };
    // Checked here as well as inside `send` so the caller's failure reads as the truth
    // ("the channel is down") rather than as a build that could not find a session.
    if (!lane.isOpen()) return { ok: false, reason: 'lane-closed' };
    if (!read) return { ok: false, reason: 'build-failed', detail: 'beam-ui: no live session reader' };

    let current: BeamCurrentSession | null = null;
    try {
      current = read();
    } catch (err) {
      log('beam-ui: the live session could not be read', err);
      return { ok: false, reason: 'build-failed', detail: String(err) };
    }
    if (!current) return { ok: false, reason: 'build-failed', detail: 'beam-ui: nothing to send' };

    // The host override is passed on BOTH shapes, so "which library does a pack come
    // from" has one answer per session rather than one per payload kind.
    const from = packHost ? { host: packHost } : {};
    if ('slot' in current) return session.sendCurrentSession(current.slot, from);
    return session.sendCurrentSession(current.state, {
      ...from,
      ...(current.label ? { label: current.label } : {}),
      ...(current.thumb !== undefined ? { thumb: current.thumb } : {}),
    });
  }

  return {
    session,
    isOpen() {
      if (closed) return false;
      try {
        return lane.isOpen();
      } catch {
        return false;
      }
    },
    sendCurrentSessionNow,
    close() {
      if (closed) return;
      closed = true;
      try {
        toast?.dispose();
      } catch (err) {
        log('beam-ui: the toast refused to dispose', err);
      }
      toast = null;
      // Only what we made. A container the caller supplied is the caller's.
      ownedContainer?.remove();
      ownedContainer = null;
      container = null;
      // Last, so a beam still in flight sees its own terminal state (and its staging
      // is discarded - section 11.18) before the stream it reports on goes away.
      session.close();
    },
  };
}
