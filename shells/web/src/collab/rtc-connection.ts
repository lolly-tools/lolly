// SPDX-License-Identifier: MPL-2.0
/**
 * rtc-connection - Track A's producer for `lib/collab-mount.ts`'s transport-agnostic
 * seam: a connected ceremony becomes a `CollabConnection` (plan 100 section 5, section 6.1, section 6.2a,
 * section 12 Q3; wave 2.5).
 *
 * The seam used to carry an `RtcTransport` and the ceremony's dialog handle, which made
 * it Track A's shape wearing a generic name - an org room has neither. It now carries a
 * built {@link CollabSessionHandle} and a `close()`, so this file is where "a WebRTC pair
 * is up" turns into that, and `org/collab-handle.ts` is where a work room does. Neither
 * mount knows which one it got.
 *
 * WHY IT IS ITS OWN MODULE, and not two lines inside the ceremony wiring: it is the only
 * place outside a mounted tool that pulls `collab/rtc-handle.ts` (and through it
 * `ReferenceCanvasDoc` + the op guard). `collab/private-opener.ts` sits on the BOOT path
 * - it registers the Share-dialog opener as an import side effect - so a static import
 * of the convergence stack there would be downloaded and parsed on every load of the app,
 * for a ceremony almost none of those loads will start (true whichever way the
 * `private-collab` flag defaults; it is ON as of 2026-08-10). Living here, it rides the
 * same lazily-imported ceremony chunk as `join-route.ts`, which is the code that needs it.
 *
 * ── The seed latch (section 6.1, section 12 Q3) ─────────────────────────────────────────────
 *
 * The acceptor's session state arrives IN BAND, on the ops-lane hello - never in the
 * invite blob, which is sized for a QR (section 6.1). But the ceremony reaches `connected` off
 * an ICE event, and ICE connects before the SCTP data channel the hello rides on. So the
 * connection is handed to the mount BEFORE its seed exists, every time.
 *
 * Rather than have the mount guess, the latch is armed HERE - at hand-off, the earliest
 * moment a caller holds the transport and the last moment before the mount would want to
 * read it - and published as {@link CollabConnection.seedLater}. `rtc-handle.ts`
 * deliberately ignores `hello.seed` ("a caller that wants it subscribes to
 * `transport.on('message')` itself", and it is untrusted URL text either way), which is
 * exactly the door this uses.
 *
 * A seed that never lands is NOT an error and the promise still resolves (with
 * `undefined`) once the deadline passes: section 6.2's late joiner gets the full state from the
 * peer through ordinary convergence, so the seed only ever buys a faster, already-
 * populated first paint.
 *
 * ── The beam link (section 6.4) ───────────────────────────────────────────────────────
 *
 * The paired channel is a general encrypted conduit; co-editing is one payload type on
 * it, and the bulk lane is another (`collab/beam-ui.ts`). The transport is the only
 * thing that holds that lane, and this is the only module that holds the transport, so
 * the connection carries it on as `beam` - the mount cannot re-derive it, exactly like
 * every other field on {@link CollabConnection}.
 *
 * It is an ADDITIVE mixin on the return type rather than a field of the seam's own
 * interface, and that is the point: `lib/collab-mount.ts` is transport-agnostic, an org
 * room has no beam and never will (section 7 - the server path carries ops and presence), so
 * the mount reads it structurally and a work collab simply answers "none". The send
 * control is then absent on Track B by construction, not by a flag someone has to
 * remember to check.
 */

import { createRtcCollabHandle } from './rtc-handle.ts';
import { bindHistoryExchange } from './history-exchange.ts';
import { seedFromQuery } from '../lib/collab-live-mount.ts';
import type { CollabBeamCapable } from './beam-ui.ts';
import type { CeremonyRole, CeremonyTimerHandle } from './ceremony.ts';
import type { CeremonyConnectedHandle } from '../components/collab-ceremony.ts';
import type { CollabConnection, CollabSeed } from '../lib/collab-mount.ts';
import type { CollabLaunchContext } from '../lib/collab-launch.ts';
import type { RtcTransport } from './rtc-transport.ts';

/**
 * How long the acceptor's mount may wait for the in-band seed before opening the tool
 * empty and letting convergence fill it in.
 *
 * Sized against section 7's join-to-interactive target (<3 s) minus the tool load that follows:
 * the hello is the FIRST frame on a reliable ordered channel that has just opened, so in
 * practice this resolves in milliseconds. It exists so a peer that sends no seed at all
 * (an older build, a state too big for one frame) cannot hold the tool closed.
 */
export const SEED_WAIT_MS = 1_500;

/**
 * The clock/timer seam, so the wait is provable at CPU speed rather than in real time.
 *
 * Structurally `CeremonyTimers`, and forwarded to the handle as such: a connected
 * transport arms the section 6.2 divergence backstop the moment the handle exists, so a caller
 * that fakes THIS clock and not that one has a real 20-second timer running behind its
 * test. One seam, both timers.
 */
export interface RtcConnectionTimers {
  setTimeout(fn: () => void, ms: number): CeremonyTimerHandle;
  clearTimeout(handle: CeremonyTimerHandle): void;
}

const REAL_TIMERS: RtcConnectionTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => { clearTimeout(h as ReturnType<typeof setTimeout>); },
};

export interface RtcConnectionInput {
  /** Which end of the ceremony this is. Decides the session host AND, per section 6.2a, which
   *  side's copy is ephemeral. */
  readonly role: CeremonyRole;
  /** The dialog's connected handle - the chosen names and the observer-only verdict. */
  readonly ceremony: CeremonyConnectedHandle;
  /** The live transport. This module takes ownership of hanging it up. */
  readonly transport: RtcTransport;
  /** Inviter only: the Share-dialog context the collab was started from. */
  readonly launch?: CollabLaunchContext;
  /** Inviter only: the live model, already serialised (see `collab-live-mount.ts`). */
  readonly seed?: CollabSeed;
  /** Override the seed deadline. Tests, and nothing else. */
  readonly seedWaitMs?: number;
  readonly timers?: RtcConnectionTimers;
}

/**
 * Latch the first in-band seed the peer sends.
 *
 * Resolves with the seed, or `undefined` when the deadline passes with none - never
 * rejects, and never resolves twice. The subscription is dropped either way, so a hello
 * arriving after the deadline (a re-armed lane) cannot resurrect a settled promise.
 */
function latchSeed(
  transport: RtcTransport,
  waitMs: number,
  timers: RtcConnectionTimers,
): Promise<CollabSeed | undefined> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: unknown = null;
    let off: (() => void) | null = null;

    const finish = (seed: CollabSeed | undefined): void => {
      if (settled) return;
      settled = true;
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
      try { off?.(); } catch { /* an already-closed transport drops its own listeners */ }
      off = null;
      resolve(seed);
    };

    off = transport.on('message', (message) => {
      if (message.lane !== 'ops' || message.kind !== 'hello') return;
      // A hello with no seed is the ordinary "you'll receive it on connect" case (section 6.1)
      // and is NOT the end of the wait: this pair sends exactly one hello, but a
      // restarted lane may send another, and the frame that carries the seed is the one
      // worth waiting for.
      const seed = seedFromQuery(message.seed);
      if (seed) finish(seed);
    });

    timer = timers.setTimeout(() => { finish(undefined); }, waitMs);
  });
}

/**
 * A connected ceremony as a {@link CollabConnection}.
 *
 * The handle is built HERE rather than at mount time because only this side of the
 * ceremony holds the transport, and because the register index the backstop depends on
 * must start indexing from the pair's first frame - not from whenever a tool finished
 * loading (section 6.2's divergence backstop rests on "the index mirrors the document").
 */
export function rtcCollabConnection(input: RtcConnectionInput): CollabConnection & CollabBeamCapable {
  const { role, ceremony, transport } = input;
  const timers = input.timers ?? REAL_TIMERS;
  const handle = createRtcCollabHandle({
    transport,
    role,
    timers,
    self: {
      clientId: transport.clientId,
      // The name the human typed into the ceremony, never a profile field (section 11.23).
      // Empty stays empty: `collab-session.ts` renders the "Host"/"Invitee N" fallback
      // for an anonymous peer, and a blank string is how it is told there is one.
      name: ceremony.localName || undefined,
    },
  });

  // Bind the negotiated shared-history exchange to the reliable beam-json control path
  // (plan 221 section 9): the responder answers a peer's request from this side's memory
  // history, gated on the handshake (`historySharingAvailable`) and on disclosure
  // (earlier revisions are not shared). It coexists with beam transfers on the lane -
  // each frame kind ignores the other - and is torn down when the connection closes.
  const historyBinding = handle.history
    ? bindHistoryExchange({
        documentId: `collab:${ceremony.toolId ?? 'design'}`,
        sharing: () => handle.historySharingAvailable(),
        history: handle.history,
        sendJson: frame => { transport.beam.json(frame); },
        onJson: fn => transport.on('message', message => { if (message.lane === 'beam' && message.kind === 'json') fn(message.json); }),
      })
    : undefined;

  const waitMs = input.seedWaitMs ?? SEED_WAIT_MS;
  // Only the side that is RECEIVING a seed waits for one. The inviter already holds its
  // own model, and an inviter waiting on its peer's hello would delay its own remount by
  // the deadline for a value it would then ignore.
  const seedLater = input.seed === undefined && role === 'acceptor'
    ? latchSeed(transport, waitMs, timers)
    : undefined;

  return {
    role,
    handle,
    // `handle.close()` closes the transport under it (rtc-handle's own teardown does),
    // so this is one call and not two - a second `transport.close()` would be a no-op,
    // but stating the ownership once is what keeps it true if either side changes.
    close: () => { historyBinding?.dispose(); handle.close(); },
    ...(historyBinding ? { requestPeerHistory: historyBinding.requestList, requestPeerRevision: historyBinding.requestPayload } : {}),
    toolId: ceremony.toolId,
    launch: input.launch,
    // section 6.2a: the inviter owns the saved session, so the acceptor's copy never lands in a
    // slot on this device.
    ephemeral: role === 'acceptor',
    seed: input.seed,
    seedLater,
    // section 6.4. The transport is published whole because `CollabBeamTransport` is exactly
    // the two members a beam uses (`beam` and `on`), and narrowing it to a fresh object
    // here would mean a second shape to keep in step with the transport's. The names
    // are the ceremony's - what the human typed, never a profile field (section 11.23) - and
    // an empty one stays absent so `beam-session.ts` renders the section 4.5 role fallback.
    beam: {
      transport,
      role,
      ...(ceremony.peerName ? { peerName: ceremony.peerName } : {}),
      ...(ceremony.localName ? { selfName: ceremony.localName } : {}),
    },
  };
}
