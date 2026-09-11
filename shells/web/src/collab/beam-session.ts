// SPDX-License-Identifier: MPL-2.0
/**
 * beam-session - the stitch that makes a **beam** an end-to-end feature
 * (plan 100 section 6.4, section 11.6, section 11.15a, section 11.16, section 11.18, section 11.24; wave 2.5).
 *
 * Four modules already do the whole job between them, and none of them knows the
 * others exist - deliberately, because each is only testable that way:
 *
 *   `collab/beam-protocol.ts`  the frames + the two state machines (no transport,
 *                              no storage, no clock)
 *   `collab/rtc-transport.ts`  the beam LANE: `json`/`binary` out, a
 *                              `bufferedamountlow` pull point, and inbound frames
 *                              on the transport's `message` stream
 *   `lib/beam-sink.ts`         where received chunks stage (IndexedDB), and what
 *                              `discard()` actually removes
 *   `lib/beam-pack.ts`         what a beam CARRIES: `buildBeamOffer` on the way
 *                              out, `ingestBeamItem` on the way in
 *   `components/beam-toast.ts` the consent + progress UI, specified against an
 *                              event stream (`BeamEventSource`) rather than a wire
 *
 * THIS module is the only place all five may be named at once. It owns no frames, no
 * storage, no DOM and no copy beyond the two role fallbacks below: everything it does
 * is wiring, and every seam it wires is injectable, so the whole feature runs
 * headlessly against a fake lane pair, an in-memory sink and a scripted toast port.
 *
 * ── The four wires ────────────────────────────────────────────────────────────
 *
 *   1. **out**  `buildBeamOffer` → `createBeamSender` → the lane's `json`/`binary`
 *   2. **pull** the lane's `onDrain` → `sender.nextChunk()`. The sender is
 *      pull-based on purpose (section 11.6): not one frame leaves except from a pull, so
 *      the transport's `bufferedamountlow` IS the backpressure story and a 38 MB
 *      beam can never outrun the channel. {@link BeamSessionOptions.lane}'s
 *      `bufferedAmount()`/`lowThreshold` are the whole of the pacing policy.
 *   3. **in**   inbound frames → `createBeamReceiver` over a `createBeamSink` per
 *      beam → on `complete`, `ingestBeamItem` for each staged item, attributed to
 *      the peer's chosen name (section 6.4: received items land "From Priya").
 *   4. **consent** the toast port. An incoming offer surfaces as an
 *      `offer-received` event and NOTHING else happens until the human's
 *      `accept()`/`decline()` comes back through the same port (section 11.24). The
 *      session never accepts on its own, and the protocol refuses bytes that arrive
 *      before consent regardless - one gate, asserted twice.
 *
 * ── One outgoing beam, one incoming beam ──────────────────────────────────────
 *
 * Both machines share one lane and filter by `beamId`, so an outgoing and an incoming
 * beam coexist happily (every inbound control frame is offered to both; each ignores
 * what is not its own). A SECOND concurrent incoming beam is refused, and the reason
 * is structural rather than a limit someone picked: a payload frame carries no
 * `beamId` - it is identified purely by immediately following its header - so two
 * interleaved incoming transfers on one reliable-ordered lane could not be told apart
 * byte from byte. The refusal goes out as a `decline`, whose vocabulary has no "busy"
 * word; `user` is the least misleading of the five (nothing about the size, the kind
 * or this device's space was wrong - it simply said no).
 *
 * ── A silent lane is a stalled beam, so it is made loud ───────────────────────
 *
 * `RtcBeamLane.json`/`.binary` return `void` and LOG a refused frame - the transport
 * has nobody to tell. A sender writing into a closed lane would therefore sit in
 * `offered` forever with no error and nothing to cancel. So the wire this module
 * hands the protocol pre-checks `lane.isOpen()` and THROWS when it is not: both
 * machines already treat a throwing wire as a `transport` cancel (their writes are
 * wrapped precisely for `RTCDataChannel.send`'s two throwing conditions), so a dead
 * channel lands as a terminal state on the side that can still see it, instead of a
 * progress bar that never moves.
 *
 * ── What this does NOT do ────────────────────────────────────────────────────
 *
 *  - **Decide.** Consent is the human's (the toast port), and policy caps are
 *    `BeamPolicy`'s, enforced inside the receiver.
 *  - **Mount anything.** No DOM here at all: `mountBeamToast(el, session.toast)` is
 *    the caller's line, and this module is `import type` only against that file.
 *  - **Own identity.** `peerName` arrives resolved (section 11.23: chosen, never leaked).
 *    With none, the section 4.5 role fallback applies - the peer of an inviter is an
 *    Invitee, the peer of an acceptor is the Host.
 *  - **Read a wall clock.** Nothing here is timed; the only pacing signal is the
 *    lane's own drain callback (section 11.7's rule holds by construction).
 */

import {
  BEAM_PROTOCOL_VERSION,
  createBeamReceiver,
  createBeamSender,
  parseBeamMessage,
} from './beam-protocol.ts';
import type {
  BeamCancelReason,
  BeamDeclineReason,
  BeamHasher,
  BeamItem,
  BeamOfferMessage,
  BeamPolicy,
  BeamRecvPhase,
  BeamRecvState,
  BeamReceiver,
  BeamSendPhase,
  BeamSendState,
  BeamSender,
  BeamSink,
  BeamWire,
} from './beam-protocol.ts';
import { createBeamSink } from '../lib/beam-sink.ts';
import {
  BeamPackError,
  MANIFEST_ITEM_ID,
  buildBeamOffer,
  createBeamIngest,
  ingestBeamItem,
  rollbackBeamIngest,
} from '../lib/beam-pack.ts';
import type {
  BeamIngestResult,
  BeamPackErrorCode,
  BeamPackHost,
  BeamPackSource,
  BeamPackWorkerFactory,
  BeamSessionRow,
  BuiltBeamOffer,
} from '../lib/beam-pack.ts';
import type { BeamEventSource, BeamOfferView, BeamRole, BeamToastEvent } from '../components/beam-toast.ts';
import type { CeremonyRole } from './ceremony.ts';
import type { RtcBeamLane, RtcInboundMessage } from './rtc-transport.ts';

// ── Copy ──────────────────────────────────────────────────────────────────────
//
// One map, one wave - the house shape (`lib/beam-pack.ts`, `lib/beam-sink.ts`). Two
// words only: the section 4.5 role fallbacks for a peer who chose no name. Everything else a
// human reads about a beam is either the pack's own (`beam-pack.ts`'s STRINGS) or the
// toast's (`components/beam-toast.ts`'s).

export const STRINGS = {
  /** A nameless peer, seen from the acceptor's side - they own the session (section 6.2a). */
  hostName: 'Host',
  /** A nameless peer, seen from the inviter's side. */
  inviteeName: 'Invitee',
};

// ── The lane ──────────────────────────────────────────────────────────────────

/**
 * The transport surface a beam needs, and the whole of it.
 *
 * Structurally identical to `rtc-transport.ts`'s `RtcBeamLane` - the two writers ARE
 * `beam-protocol.ts`'s `BeamWire`, and `onDrain` is the `bufferedamountlow` pull
 * point. Declared here rather than imported as a value so a test (and a future
 * non-WebRTC transport - section 11.29's LAN socket rung) can satisfy it without a
 * `RTCPeerConnection` anywhere; {@link asBeamLane} is the compile-time proof that the
 * real one still fits.
 */
export interface BeamLane {
  json(message: unknown): void;
  binary(bytes: Uint8Array): void;
  /** Register the pull. Fires when the channel opens and on every drain. */
  onDrain(pull: () => void): () => void;
  bufferedAmount(): number;
  readonly lowThreshold: number;
  isOpen(): boolean;
}

/** The transport's beam lane, as this module's contract. A no-op whose only job is to
 *  fail `tsc` if `RtcBeamLane` and {@link BeamLane} ever drift apart. */
export function asBeamLane(lane: RtcBeamLane): BeamLane {
  return lane;
}

/** One inbound frame off the beam lane. */
export type BeamInboundFrame =
  | { readonly kind: 'json'; readonly json: unknown }
  | { readonly kind: 'binary'; readonly bytes: Uint8Array };

/** Where inbound frames come from. The lane itself has no inbound half - the
 *  transport multiplexes every lane onto one `message` stream. */
export interface BeamInboundSource {
  subscribe(fn: (frame: BeamInboundFrame) => void): () => void;
}

/**
 * The transport's `message` stream, narrowed to the beam lane.
 *
 * `createBeamSession({ lane: asBeamLane(transport.beam), inbound: beamInbound(transport) })`
 * is the entire production wiring.
 */
export function beamInbound(transport: {
  on(type: 'message', fn: (message: RtcInboundMessage) => void): () => void;
}): BeamInboundSource {
  return {
    subscribe(fn) {
      return transport.on('message', (message) => {
        if (message.lane !== 'beam') return;
        if (message.kind === 'json') fn({ kind: 'json', json: message.json });
        else fn({ kind: 'binary', bytes: message.bytes });
      });
    },
  };
}

// ── The staging seam ──────────────────────────────────────────────────────────

/** One sealed item, as the ingest step receives it. `lib/beam-sink.ts`'s
 *  `BeamStagedItem` satisfies this; a test's in-memory sink can too. */
export interface BeamStagedBytes {
  readonly itemIndex: number;
  /** The item's exact bytes (section 6.4: byte-exact, or C2PA does not survive the trip). */
  readonly blob: Blob;
}

/** `BeamSink` plus the hand-off the ingest step needs. `createBeamSink` returns one. */
export interface BeamSessionSink extends BeamSink {
  takeAll(): readonly BeamStagedBytes[];
}

/** One sink per beam - `beamId` keys the staging rows. */
export type BeamSinkFactory = (beamId: string) => BeamSessionSink;

// ── The ingest seam ───────────────────────────────────────────────────────────

export interface BeamIngestInput {
  readonly beamId: string;
  /** The offer the human consented to - the item labels and sizes they were shown. */
  readonly offer: BeamOfferMessage;
  /** Sealed items in index order. Item 0 is the pack manifest. */
  readonly items: readonly BeamStagedBytes[];
  /** The peer's display name, for attribution (section 6.4). */
  readonly fromName?: string;
}

/** Land a completed beam. Throwing means nothing was kept - the default rolls back
 *  everything it wrote before rethrowing (section 11.18). */
export type BeamIngestFn = (input: BeamIngestInput) => Promise<readonly BeamIngestResult[]>;

/** An ingest that failed and undid itself. `rolledBack` is what the compensating
 *  deletes actually managed, so a caller can be honest rather than optimistic. */
export class BeamIngestFailure extends Error {
  readonly code: BeamPackErrorCode | 'unknown';
  readonly rolledBack: { readonly removed: number; readonly failed: number };

  constructor(cause: unknown, rolledBack: { removed: number; failed: number }) {
    super(`beam-session: ingest failed - ${errText(cause)}`, { cause });
    this.name = 'BeamIngestFailure';
    this.code = cause instanceof BeamPackError ? cause.code : 'unknown';
    this.rolledBack = rolledBack;
  }
}

/** What one completed incoming beam did. */
export interface BeamIngestOutcome {
  readonly beamId: string;
  readonly results: readonly BeamIngestResult[];
  /** Present when the ingest failed; `results` is then empty and nothing was kept. */
  readonly error?: { readonly code: BeamPackErrorCode | 'unknown'; readonly detail: string };
  readonly rolledBack?: { readonly removed: number; readonly failed: number };
}

// ── Sending ───────────────────────────────────────────────────────────────────

export type BeamSendRefusal =
  /** A beam is already going out on this lane. */
  | 'busy'
  /** The beam channel is not open. */
  | 'lane-closed'
  /** `sendCurrentSession` with no `BeamPackHost` to read the session from. */
  | 'no-host'
  /** `buildBeamOffer` refused - see `code`. */
  | 'build-failed'
  | 'closed';

export type BeamSendResult =
  | {
      readonly ok: true;
      readonly beamId: string;
      readonly totalBytes: number;
      /** Catalog ids the receiver must resolve locally (section 11.16) - surfaced so the
       *  sender's UI can say "3 brand images resolve on their device" honestly. */
      readonly byReference: readonly string[];
    }
  | {
      readonly ok: false;
      readonly reason: BeamSendRefusal;
      readonly detail?: string;
      readonly code?: BeamPackErrorCode;
    };

/** Extras for {@link BeamSession.sendCurrentSession}. */
export interface BeamCurrentSessionOptions {
  /** Overrides the session's own host (a caller with two hosts in play). */
  readonly host?: BeamPackHost;
  /** The offer's name; defaults to the session's label. */
  readonly name?: string;
  /** The label a LIVE (unsaved) state is packed under. */
  readonly label?: string;
  /** Attribution written on the receiver's rows; defaults to `selfName`. */
  readonly fromName?: string;
  /** A tile for the received session. Only read for a live state - a saved slot
   *  already has one. */
  readonly thumb?: string | null;
  readonly workerFactory?: BeamPackWorkerFactory | null;
}

// ── The session ───────────────────────────────────────────────────────────────

export interface BeamSessionState {
  readonly outgoing: BeamSendState | null;
  readonly incoming: BeamRecvState | null;
}

export interface BeamSessionOptions {
  /** The bulk lane (section 11.6: beam gets its own channel, so ops never queue behind it). */
  readonly lane: BeamLane;
  /** This device's ceremony role. Decides the section 4.5 fallback name for a nameless peer,
   *  and nothing else - either side may send, either side may receive. */
  readonly role: CeremonyRole;
  /** The peer's chosen display name, already resolved (section 11.23). */
  readonly peerName?: string;
  /** This device's chosen display name - travels in the pack manifest as `fromName`
   *  and becomes the receiver's "From …" attribution. */
  readonly selfName?: string;
  /** Staging. Defaults to `lib/beam-sink.ts`'s IndexedDB sink, one per beam. */
  readonly sink?: BeamSinkFactory;
  /** The bridge slice a pack is built from and ingested into. Required for
   *  `sendCurrentSession` and for the default ingest. */
  readonly host?: BeamPackHost;
  /** Override the landing step (a Worker, a test spy). Defaults to `beam-pack.ts`. */
  readonly ingest?: BeamIngestFn;
  /** Inbound frames. A caller may instead feed {@link BeamSession.receiveJson} /
   *  {@link BeamSession.receiveBinary} directly. */
  readonly inbound?: BeamInboundSource;
  /** A listener wired before anything can happen - an inbound offer may land during
   *  construction, before a caller could have subscribed to {@link BeamSession.toast}. */
  readonly onEvent?: (event: BeamToastEvent) => void;
  /** Fires once per completed incoming beam, after the items have landed. */
  readonly onIngested?: (outcome: BeamIngestOutcome) => void;
  /**
   * Verification hasher. Defaults to `null`, which means THE SINK produces the
   * digest - the section 11.15a arrangement, where the protocol buffers nothing at all
   * (`createBeamSink` hashes what it staged). A custom sink that returns no digest
   * must pass `sha256Hasher` here; verification is never skipped either way.
   */
  readonly hasher?: BeamHasher | null;
  /** Payload bytes per chunk frame; clamped by the protocol to ≤64 KB (section 11.6). */
  readonly chunkBytes?: number;
  /** Receiver-side caps, on top of the protocol ceilings. */
  readonly policy?: BeamPolicy;
  /** Passed to `buildBeamOffer`; `null` hashes in place (a headless caller). */
  readonly workerFactory?: BeamPackWorkerFactory | null;
  /** Diagnostics. Never user copy. */
  readonly log?: (message: string, meta?: unknown) => void;
}

export interface BeamSession {
  /** The port `components/beam-toast.ts` consumes: `mountBeamToast(el, session.toast)`.
   *  Events out, `accept`/`decline`/`cancel` back in - the session is the source, so
   *  a scripted double in a test drives the same three calls the UI does. */
  readonly toast: BeamEventSource;
  state(): BeamSessionState;
  /** Beam a pack. Takes a `BeamPackSource` (built here) or an already-built offer,
   *  which this session then owns and disposes when the transfer settles. */
  send(request: BeamPackSource | BuiltBeamOffer): Promise<BeamSendResult>;
  /**
   * The section 11.16 offer: this session plus its closure - every user-local asset it
   * references, and the catalog ids it does NOT send, listed by reference so a
   * cross-profile pair is told the truth rather than rendering silently broken.
   *
   * Takes a saved slot id, or a live state object (an unsaved working copy - the
   * acceptor's ephemeral one, section 11.17). section 6.2a means this is usually the inviter's
   * move; nothing here enforces that, because an acceptor beaming one of their own
   * saved sessions is an ordinary thing to want.
   */
  sendCurrentSession(slotOrState: string | Record<string, unknown>, opts?: BeamCurrentSessionOptions): Promise<BeamSendResult>;
  /** One inbound control frame (already JSON-decoded). */
  receiveJson(raw: unknown): void;
  /** One inbound payload frame. */
  receiveBinary(bytes: Uint8Array): void;
  /** Tear down: unsubscribe, end both machines silently, and discard any staging
   *  (section 11.18 - a transfer that did not complete leaves nothing). Idempotent. */
  close(): void;
}

/** The slot a live, unsaved state is packed under. Never written to any store: it
 *  exists only inside the shadow host below, for the length of one `buildBeamOffer`. */
export const LIVE_SESSION_SLOT = 'lolly/beam-live-session';

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isSendSettled(phase: BeamSendPhase): boolean {
  return phase === 'complete' || phase === 'declined' || phase === 'cancelled';
}

function isRecvSettled(phase: BeamRecvPhase): boolean {
  return phase === 'complete' || phase === 'declined' || phase === 'cancelled';
}

/** Payload items a HUMAN should be told about: the pack manifest is bookkeeping
 *  (`BeamOfferView.itemCount`'s documented rule). */
function payloadCount(items: readonly BeamItem[]): number {
  let n = 0;
  for (const item of items) if (item.id !== MANIFEST_ITEM_ID) n += 1;
  return n;
}

function sumBytes(items: readonly BeamItem[]): number {
  let n = 0;
  for (const item of items) n += item.bytes;
  return n;
}

function labelAt(items: readonly BeamItem[], index: number): string | undefined {
  return items[index]?.label;
}

/**
 * A host whose `state` shadows ONE slot with a live, unsaved state.
 *
 * `buildBeamOffer` reads a session through `state.load`/`state.list`, which is exactly
 * the seam a working copy needs: the closure walk, the hashing, the manifest and the
 * assets-before-sessions ordering are then the same code for a saved slot and a live
 * one. Every other method is forwarded through an arrow so a real bridge object keeps
 * its `this`.
 */
function hostWithLiveSession(
  host: BeamPackHost,
  data: Record<string, unknown>,
  opts: BeamCurrentSessionOptions,
): BeamPackHost {
  const row: BeamSessionRow = {
    slot: LIVE_SESSION_SLOT,
    toolId: data.__toolId,
    toolVersion: data.__toolVersion,
    label: opts.label ?? data.__label,
    thumb: opts.thumb ?? null,
  };
  return {
    ...host,
    state: {
      list: async () => [...(await host.state.list()), row],
      load: (slot) => (slot === LIVE_SESSION_SLOT ? Promise.resolve(data) : host.state.load(slot)),
      save: (slot, value, thumb) => host.state.save(slot, value, thumb),
      ...(host.state.delete ? { delete: (slot: string) => host.state.delete!(slot) } : {}),
    },
  };
}

/** The default landing step: `beam-pack.ts`, in item order, rolling back everything
 *  it wrote if any item fails (section 11.18 - no partial ingest). */
function defaultIngest(host: BeamPackHost): BeamIngestFn {
  return async ({ offer, items, fromName }) => {
    const ctx = createBeamIngest(host, { ...(fromName ? { fromName } : {}) });
    const out: BeamIngestResult[] = [];
    try {
      for (const staged of items) {
        const item = offer.items[staged.itemIndex];
        if (!item) throw new BeamPackError('unknown-item', `item ${staged.itemIndex} was never offered`);
        out.push(await ingestBeamItem(item, staged.blob, ctx));
      }
    } catch (err) {
      throw new BeamIngestFailure(err, await rollbackBeamIngest(ctx));
    }
    return out;
  };
}

/** A pack failure, in the wire's own vocabulary, so the toast's exhaustive copy map
 *  has a line for it. Nothing here is guessed: each maps to the reason the same
 *  failure would have produced had the protocol caught it first. */
function reasonForIngest(code: BeamPackErrorCode | 'unknown'): BeamCancelReason {
  switch (code) {
    case 'checksum-mismatch':
      return 'checksum-mismatch';
    case 'store-failed':
      return 'sink-failure';
    case 'too-large':
      return 'too-large';
    case 'too-many-items':
      return 'too-many-items';
    case 'bad-manifest':
    case 'unknown-item':
    case 'unsafe-item':
      return 'bad-message';
    default:
      return 'sink-failure';
  }
}

export function createBeamSession(opts: BeamSessionOptions): BeamSession {
  const lane = opts.lane;
  const log = opts.log ?? ((): void => {});
  const makeSink: BeamSinkFactory = opts.sink ?? ((id) => createBeamSink(id));
  const hasher: BeamHasher | null = opts.hasher === undefined ? null : opts.hasher;
  const ingestFn: BeamIngestFn | null = opts.ingest ?? (opts.host ? defaultIngest(opts.host) : null);

  const subs = new Set<(event: BeamToastEvent) => void>();
  let closed = false;

  // ── outgoing ────────────────────────────────────────────────────────────────
  let outSender: BeamSender | null = null;
  let outBuilt: BuiltBeamOffer | null = null;
  let outItems: readonly BeamItem[] = [];
  let outUnsub: (() => void) | null = null;
  let outPhase: BeamSendPhase = 'idle';
  let outAnnounced = false;
  let outAccepted = false;
  let outDone = 0;
  let outBytes = -1;

  // ── incoming ────────────────────────────────────────────────────────────────
  let inRecv: BeamReceiver | null = null;
  let inSink: BeamSessionSink | null = null;
  let inOffer: BeamOfferMessage | null = null;
  let inUnsub: (() => void) | null = null;
  let inPhase: BeamRecvPhase = 'waiting';
  let inAnnounced = false;
  let inAccepted = false;
  let inDone = 0;
  let inBytes = -1;
  let inLanded = false;

  function emit(event: BeamToastEvent): void {
    try {
      opts.onEvent?.(event);
    } catch {
      /* a broken observer must not break a transfer */
    }
    for (const fn of [...subs]) {
      try {
        fn(event);
      } catch {
        /* same rule */
      }
    }
  }

  /** The peer's name for attribution and for the consent sheet. section 4.5's fallback:
   *  the peer of an inviter is an invitee, the peer of an acceptor is the host. */
  function peerName(): string {
    const chosen = (opts.peerName ?? '').trim();
    if (chosen) return chosen;
    return opts.role === 'inviter' ? STRINGS.inviteeName : STRINGS.hostName;
  }

  function offerView(
    beamId: string,
    role: BeamRole,
    kind: BeamOfferMessage['kind'],
    name: string,
    items: readonly BeamItem[],
    totalBytes: number,
  ): BeamOfferView {
    return {
      beamId,
      role,
      kind,
      name,
      itemCount: payloadCount(items),
      totalBytes,
      peerName: peerName(),
    };
  }

  /**
   * The wire both machines write through. `lane.json`/`.binary` swallow a refused
   * frame (see the header), so the open check is what turns a dead channel into a
   * `transport` cancel instead of a beam that stops moving and never says why.
   */
  const wire: BeamWire = {
    json(message) {
      if (!lane.isOpen()) throw new Error('beam-session: the beam lane is not open');
      lane.json(message);
    },
    binary(bytes) {
      if (!lane.isOpen()) throw new Error('beam-session: the beam lane is not open');
      lane.binary(bytes);
    },
  };

  // ── the pull (section 11.6) ────────────────────────────────────────────────────────

  let pumping = false;
  let wake = false;

  /**
   * Pull until the channel's buffer reaches its low threshold, then stop and wait for
   * the lane to say it drained. `wake` covers the race where a drain fires while a
   * pull is still in flight: the flag survives the await and the loop takes another
   * pass, so a drain can never be lost and leave a beam parked.
   */
  async function pump(): Promise<void> {
    const sender = outSender;
    if (!sender || closed) return;
    if (pumping) {
      wake = true;
      return;
    }
    pumping = true;
    try {
      do {
        wake = false;
        while (!closed && outSender === sender && sender.state.phase === 'sending') {
          let buffered = 0;
          try {
            buffered = lane.bufferedAmount();
          } catch {
            buffered = 0;
          }
          if (buffered >= lane.lowThreshold) break;
          const pulled = await sender.nextChunk();
          if (pulled !== 'sent') break;
        }
      } while (wake && !closed);
    } catch (err) {
      log('beam-session: the send pump stopped', errText(err));
    } finally {
      pumping = false;
    }
  }

  // ── outgoing state → events ─────────────────────────────────────────────────

  function onSendState(st: BeamSendState): void {
    const prev = outPhase;
    outPhase = st.phase;

    if (!outAnnounced && st.phase !== 'idle') {
      outAnnounced = true;
      emit({
        t: 'offer-received',
        offer: offerView(st.beamId, 'sender', st.kind, st.name, st.items, sumBytes(st.items)),
      });
    }
    if (!outAccepted && (st.phase === 'sending' || st.phase === 'paused')) {
      outAccepted = true;
      emit({ t: 'accepted', beamId: st.beamId });
    }
    if (outAccepted && st.progress.bytes !== outBytes) {
      outBytes = st.progress.bytes;
      emit({
        t: 'progress',
        beamId: st.beamId,
        progress: st.progress,
        itemLabel: labelAt(outItems, st.progress.itemIndex),
      });
    }
    if (st.progress.itemsDone > outDone) {
      for (let i = outDone; i < st.progress.itemsDone; i++) {
        emit({ t: 'item-done', beamId: st.beamId, itemIndex: i, itemLabel: labelAt(outItems, i) });
      }
      outDone = st.progress.itemsDone;
    }
    if (st.phase !== prev && isSendSettled(st.phase)) {
      if (st.phase === 'complete') {
        emit({ t: 'complete', beamId: st.beamId, itemCount: payloadCount(outItems) });
      } else {
        emit({ t: 'cancelled', beamId: st.beamId, reason: st.reason ?? 'user' });
      }
      // The retained blobs go now; a settled beam will never read them again.
      try {
        outBuilt?.dispose();
      } catch {
        /* releasing a pack's handles must not fail a finished transfer */
      }
      outBuilt = null;
      outUnsub?.();
      outUnsub = null;
      return;
    }
    if (st.phase === 'sending' && prev !== 'sending') void pump();
  }

  function startOutgoing(pack: BuiltBeamOffer): string {
    outBuilt = pack;
    outItems = pack.offer.items;
    outPhase = 'idle';
    outAnnounced = false;
    outAccepted = false;
    outDone = 0;
    outBytes = -1;
    const sender = createBeamSender({
      offer: pack.offer,
      source: pack.source,
      wire,
      ...(opts.chunkBytes !== undefined ? { chunkBytes: opts.chunkBytes } : {}),
    });
    outSender = sender;
    outUnsub = sender.subscribe(onSendState);
    sender.offer();
    return sender.state.beamId;
  }

  // ── incoming state → events → ingest ────────────────────────────────────────

  function onRecvState(st: BeamRecvState): void {
    const prev = inPhase;
    inPhase = st.phase;

    if (!inAnnounced && st.offer) {
      inAnnounced = true;
      inOffer = st.offer;
      emit({
        t: 'offer-received',
        offer: offerView(st.offer.beamId, 'receiver', st.offer.kind, st.offer.name, st.offer.items, st.offer.totalBytes),
      });
    }
    if (!inAccepted && st.phase === 'receiving') {
      inAccepted = true;
      emit({ t: 'accepted', beamId: st.beamId });
    }
    if (inAccepted && st.progress.bytes !== inBytes) {
      inBytes = st.progress.bytes;
      emit({
        t: 'progress',
        beamId: st.beamId,
        progress: st.progress,
        itemLabel: labelAt(st.offer?.items ?? [], st.progress.itemIndex),
      });
    }
    if (st.progress.itemsDone > inDone) {
      for (let i = inDone; i < st.progress.itemsDone; i++) {
        emit({ t: 'item-done', beamId: st.beamId, itemIndex: i, itemLabel: labelAt(st.offer?.items ?? [], i) });
      }
      inDone = st.progress.itemsDone;
    }
    if (st.phase === prev || !isRecvSettled(st.phase)) return;
    if (st.phase === 'complete') {
      // `complete` is emitted from inside the receiver's own staging chain, so every
      // finalize + verify has already passed. Nothing enters the library before this
      // point (section 11.18), and the toast's "Saved to your library" waits for the ingest.
      void land(st);
      return;
    }
    // Decline / cancel / violation: the protocol has already discarded staging.
    emit({ t: 'cancelled', beamId: st.beamId, reason: st.reason ?? 'user' });
    inUnsub?.();
    inUnsub = null;
  }

  async function land(st: BeamRecvState): Promise<void> {
    if (inLanded) return;
    inLanded = true;
    const beamId = st.beamId;
    const offer = st.offer;
    const sink = inSink;
    inUnsub?.();
    inUnsub = null;

    let items: readonly BeamStagedBytes[] = [];
    try {
      items = sink ? [...sink.takeAll()].sort((a, b) => a.itemIndex - b.itemIndex) : [];
    } catch (err) {
      log('beam-session: staged items could not be collected', errText(err));
    }

    if (!offer || !ingestFn) {
      // Nowhere to put it. Never silently "complete": the toast would say the items
      // were saved, which would be the one lie this whole path exists to avoid.
      log('beam-session: a beam completed with no ingest configured', { beamId, items: items.length });
      emit({ t: 'cancelled', beamId, reason: 'sink-failure' });
      await discardStaging(sink);
      return;
    }

    try {
      const results = await ingestFn({ beamId, offer, items, fromName: peerName() });
      emit({ t: 'complete', beamId, itemCount: countLanded(results) });
      opts.onIngested?.({ beamId, results });
    } catch (err) {
      const code = err instanceof BeamIngestFailure ? err.code : err instanceof BeamPackError ? err.code : 'unknown';
      emit({ t: 'cancelled', beamId, reason: reasonForIngest(code) });
      opts.onIngested?.({
        beamId,
        results: [],
        error: { code, detail: errText(err) },
        ...(err instanceof BeamIngestFailure ? { rolledBack: err.rolledBack } : {}),
      });
    } finally {
      await discardStaging(sink);
    }
  }

  /** Staging outlives nothing (section 11.18). The protocol discards on every terminal that
   *  is not `complete`; this is the `complete` half, run once the bytes are safely
   *  somewhere else (or once the attempt to put them there has failed and undone). */
  async function discardStaging(sink: BeamSessionSink | null): Promise<void> {
    if (!sink) return;
    try {
      await sink.discard();
    } catch (err) {
      log('beam-session: staging could not be cleared', errText(err));
    }
  }

  function countLanded(results: readonly BeamIngestResult[]): number {
    let n = 0;
    for (const result of results) if (result.kind !== 'manifest') n += 1;
    return n;
  }

  function startIncoming(offer: BeamOfferMessage, raw: unknown): void {
    // No ingest, no beam - decided BEFORE the human is asked or a single byte moves.
    // `land()` already refuses to lie about a completion with nowhere to put the
    // result (`!ingestFn` there), but that check ran only after the sink was staged
    // and the whole payload had streamed in - accepting a transfer this session
    // could never keep, then discovering that at the very end. The condition is
    // identical to `makeSink`'s failure just below (nowhere for this beam to land),
    // so it is refused the same way, with the same reason.
    if (!ingestFn) {
      log('beam-session: no ingest configured for an incoming beam', offer.beamId);
      declineRaw(offer.beamId, 'no-space');
      return;
    }
    if (inRecv) {
      try {
        inRecv.dispose();
      } catch {
        /* the previous beam is already settled */
      }
    }
    let sink: BeamSessionSink;
    try {
      sink = makeSink(offer.beamId);
    } catch (err) {
      log('beam-session: no staging for an incoming beam', errText(err));
      declineRaw(offer.beamId, 'no-space');
      return;
    }
    inSink = sink;
    inOffer = null;
    inPhase = 'waiting';
    inAnnounced = false;
    inAccepted = false;
    inDone = 0;
    inBytes = -1;
    inLanded = false;
    const receiver = createBeamReceiver({
      wire,
      sink,
      hasher,
      ...(opts.policy ? { policy: opts.policy } : {}),
    });
    inRecv = receiver;
    inUnsub = receiver.subscribe(onRecvState);
    receiver.receive(raw);
  }

  /** A refusal for a beam this session never built a machine for. */
  function declineRaw(beamId: string, reason: BeamDeclineReason): void {
    try {
      wire.json({ v: BEAM_PROTOCOL_VERSION, beamId, t: 'decline', reason });
    } catch (err) {
      log('beam-session: a decline could not be written', errText(err));
    }
  }

  function liveReceiver(): BeamReceiver | null {
    return inRecv && !isRecvSettled(inRecv.state.phase) ? inRecv : null;
  }

  // ── inbound ─────────────────────────────────────────────────────────────────

  function receiveJson(raw: unknown): void {
    if (closed) return;
    // Every control frame is offered to both machines; each ignores what is not its
    // own beam (the sender does it by id, the receiver by id once it has an offer).
    outSender?.receive(raw);
    const parsed = parseBeamMessage(raw);
    const offer = parsed.ok && parsed.value.t === 'offer' ? parsed.value : null;
    const live = liveReceiver();
    if (live) {
      if (offer && offer.beamId !== inOffer?.beamId) {
        // Two incoming beams cannot share one lane - payload frames carry no id.
        log('beam-session: refusing a second incoming beam', offer.beamId);
        declineRaw(offer.beamId, 'user');
        return;
      }
      live.receive(raw);
      return;
    }
    if (offer) startIncoming(offer, raw);
  }

  function receiveBinary(bytes: Uint8Array): void {
    if (closed) return;
    const live = liveReceiver();
    if (!live) {
      log('beam-session: a payload frame arrived with no beam to stage it');
      return;
    }
    live.receiveBinary(bytes);
  }

  // ── the toast port (section 11.24) ─────────────────────────────────────────────────

  const toast: BeamEventSource = {
    subscribe(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
    accept(beamId) {
      if (closed) return;
      if (!inRecv || inOffer?.beamId !== beamId) return;
      inRecv.accept();
    },
    decline(beamId, reason) {
      if (closed) return;
      if (!inRecv || inOffer?.beamId !== beamId) return;
      inRecv.decline(reason ?? 'user');
    },
    cancel(beamId, reason) {
      if (closed) return;
      const why: BeamCancelReason = reason ?? 'user';
      if (outSender && outSender.state.beamId === beamId) outSender.cancel(why);
      if (inRecv && inOffer?.beamId === beamId) inRecv.cancel(why);
    },
  };

  // ── sending ─────────────────────────────────────────────────────────────────

  async function send(request: BeamPackSource | BuiltBeamOffer): Promise<BeamSendResult> {
    if (closed) return { ok: false, reason: 'closed' };
    if (outSender && !isSendSettled(outSender.state.phase)) return { ok: false, reason: 'busy' };
    if (!lane.isOpen()) return { ok: false, reason: 'lane-closed' };

    let pack: BuiltBeamOffer;
    if ('from' in request) {
      try {
        pack = await buildBeamOffer(request);
      } catch (err) {
        return {
          ok: false,
          reason: 'build-failed',
          detail: errText(err),
          ...(err instanceof BeamPackError ? { code: err.code } : {}),
        };
      }
    } else {
      pack = request;
    }

    // Hashing a tag pack takes a while, and the lane may have died (or another send
    // may have won) in the meantime. The built pack is disposed rather than leaked.
    const stale = closed ? 'closed' : outSender && !isSendSettled(outSender.state.phase) ? 'busy' : null;
    if (stale) {
      pack.dispose();
      return { ok: false, reason: stale };
    }
    const beamId = startOutgoing(pack);
    return { ok: true, beamId, totalBytes: pack.totalBytes, byReference: pack.byReference };
  }

  async function sendCurrentSession(
    slotOrState: string | Record<string, unknown>,
    extra: BeamCurrentSessionOptions = {},
  ): Promise<BeamSendResult> {
    const host = extra.host ?? opts.host;
    if (!host) return { ok: false, reason: 'no-host' };
    const fromName = extra.fromName ?? opts.selfName;
    const workerFactory = extra.workerFactory !== undefined ? extra.workerFactory : opts.workerFactory;
    const common = {
      ...(extra.name ? { name: extra.name } : {}),
      ...(fromName ? { fromName } : {}),
      ...(workerFactory !== undefined ? { workerFactory } : {}),
    };
    if (typeof slotOrState === 'string') {
      return send({ from: 'session', host, slot: slotOrState, ...common });
    }
    return send({
      from: 'session',
      host: hostWithLiveSession(host, slotOrState, extra),
      slot: LIVE_SESSION_SLOT,
      ...common,
    });
  }

  // ── construction ────────────────────────────────────────────────────────────
  //
  // `opts.onEvent` is not registered in `subs`: it fires from `emit()` directly, so a
  // consumer's unsubscribe can never take it down and it is already listening when an
  // inbound offer lands during construction.

  let offDrain: (() => void) | null = null;
  try {
    offDrain = lane.onDrain(() => {
      void pump();
    });
  } catch (err) {
    log('beam-session: the lane refused a drain listener', errText(err));
  }

  const offInbound: (() => void) | null =
    opts.inbound?.subscribe((frame) => {
      if (frame.kind === 'json') receiveJson(frame.json);
      else receiveBinary(frame.bytes);
    }) ?? null;

  return {
    toast,

    state() {
      return {
        outgoing: outSender ? outSender.state : null,
        incoming: inRecv ? inRecv.state : null,
      };
    },

    send,
    sendCurrentSession,
    receiveJson,
    receiveBinary,

    close() {
      if (closed) return;
      closed = true;
      offDrain?.();
      offDrain = null;
      offInbound?.();
      outUnsub?.();
      outUnsub = null;
      inUnsub?.();
      inUnsub = null;
      try {
        outSender?.dispose();
      } catch {
        /* a machine that is already settled is not a problem */
      }
      try {
        // Terminal + silent, and the section 11.18 latch fires: half-received staging never
        // outlives the session that was receiving it.
        inRecv?.dispose();
      } catch {
        /* same */
      }
      try {
        outBuilt?.dispose();
      } catch {
        /* same */
      }
      outBuilt = null;
      subs.clear();
    },
  };
}
