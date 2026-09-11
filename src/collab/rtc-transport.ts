// SPDX-License-Identifier: MPL-2.0
/**
 * rtc-transport - the WebRTC half of a private collab (plan 100 section 6.1, section 6.2, section 11.3, section 11.5, section 11.6).
 *
 * This is the only module in the shell that touches `RTCPeerConnection`. It
 * owns the peer connection, the three data channels, and the mapping from
 * ICE's vocabulary into the two vocabularies the rest of the feature speaks:
 * the ceremony's events (`ceremony.ts`) and a session's connection state. It
 * owns no policy: it does not decide when to re-invite, what a failure means
 * to a human, or which ops are legal.
 *
 * ── Everything platform-shaped is injected ────────────────────────────────────────
 *
 * `opts.rtc` is the `RTCPeerConnection` constructor, defaulting to the
 * global one, and `opts.timers` is the clock. That is not a testing nicety
 * bolted on afterwards: the behaviours this module exists to get right (a
 * gathering phase that never completes because no STUN server is reachable,
 * ICE going `disconnected` for four seconds and healing, a guest network
 * where candidates gather on both sides and no pair ever forms) cannot be
 * produced on demand from a real browser. The whole suite therefore runs on
 * a scripted fake at CPU speed, and the interfaces below
 * ({@link RtcPeerConnectionLike}, {@link RtcDataChannelLike}) are the
 * minimum surface a fake has to implement. The real DOM classes satisfy
 * them structurally, and `defaultPeerConnectionCtor()` is where that is
 * *typechecked* rather than assumed: no cast, so a DOM-lib change that
 * broke the subset would fail `tsc`, not production.
 *
 * ── Non-trickle gathering is the whole point of the ceremony (section 6.1) ───────────────
 *
 * The humans are the signalling channel: A shows one blob, B shows one
 * back. That only works if every candidate is already inside the blob, so
 * `createOffer`/`createAnswer` set the local description and then WAIT for
 * gathering to finish before extracting. The wait is bounded
 * ({@link GATHER_TIMEOUT_MS}) and, on expiry, proceeds with what it has
 * instead of failing. On a LAN the host candidates arrive in milliseconds
 * and the only thing still outstanding is a STUN reflexive lookup that is
 * never coming back, exactly the airgapped case this feature is for. A blob
 * with the host candidates in it pairs; a ceremony that timed out waiting
 * for the internet does not.
 *
 * ── `disconnected` is not death (section 11.3) ──────────────────────────────────────────
 *
 * ICE `disconnected` self-heals in seconds on a UDP blip. It moves this
 * module's connection state to `'reconnecting'` and nothing else: no
 * teardown, no re-pair, no eviction. Only `failed`/`closed` is fatal, and
 * the ceremony decides what that means (the inviter arms a fresh invite,
 * the acceptor ends in `connection-lost`). Conflating the two is the single
 * most expensive mistake available here: it would show a re-pair dialog
 * every time a Wi-Fi packet went missing.
 *
 * Both `connectionstatechange` and `iceconnectionstatechange` are watched
 * and mapped into the ceremony's alphabet, deduped by last-emitted value.
 * Two sources rather than one because `connectionState` is the better
 * signal (it folds DTLS in) and `iceConnectionState` is the more
 * universally implemented; a browser that reports only one still drives
 * the ceremony correctly.
 *
 * ── ICE-connected is NOT session-usable: `{ type: 'ready' }` is (section 6.2) ───────────
 *
 * The one signal that means "this pair can carry a session" is the ops
 * channel being OPEN on this side. Data channels only open once BOTH
 * descriptions have been applied, which is the whole ceremony completing;
 * ICE reaching `connected` means only that some candidate pair answered a
 * binding request, and on a loopback/LAN pair Chrome reports exactly that
 * BEFORE the answer has been carried back to the inviter (pre-answer
 * connectivity from peer-reflexive checks). The measured trace says the
 * same thing from the other end: `ice:connected` at 542ms, channels open
 * on both sides at 1269ms.
 *
 * So this module sources a first-class `{ type: 'ready' }` alongside the
 * ICE stream, and `ceremony.ts` gates its `connected` phase on that and
 * nothing else. ICE keeps every other job it had (failure diagnosis, the
 * transient `disconnected` flag, arming the connect watchdog), and an ICE
 * `connected` on its own moves no phase anywhere.
 *
 * `ready` is emitted ONCE per peer connection (the ops channel cannot
 * re-open) and reset by {@link newPeerConnection} exactly like
 * `lastEmittedIce`, so a re-invite never inherits the previous pairing's
 * completion.
 *
 * ── The ceremony surface is STATE, so it replays on subscribe ────────────────────
 *
 * `{ type: 'ice' }`, `{ type: 'ready' }` and `{ type: 'peer-op-version' }`
 * are not notifications of things that happened, they are the current
 * value of something, and a subscriber that arrives after the last
 * transition would otherwise never learn it. On a LAN that is the normal
 * case, not an edge one: ICE reaches `connected` within about five
 * milliseconds of `setLocalDescription`, well inside the awaits the
 * ceremony mints its answer in, and on the `#/join-reply` handoff the
 * channels can be open before the machine that cares exists at all.
 *
 * {@link RtcTransport.onCeremonyEvent} therefore delivers the last EMITTED
 * ICE state, the ops lane's readiness, and the peer's last declared op
 * version, to the new subscriber immediately and to it alone, in that
 * order, because that is the order they happen in and because a replayed
 * failure must beat a replayed completion.
 *
 * This is the half of the guard that covers an edge NOBODY HEARD: a
 * machine wired up after its transport already connected, which is what a
 * dialog restart or the `#/join-reply` handoff produces. The other half
 * lives in `ceremony.ts`: an edge that WAS heard and dropped, because the
 * phase it landed in had no ICE exit. Neither subsumes the other, and the
 * ceremony's header spells the pair out. Two properties make them safe to
 * stack, so belt and braces never double-fires a transition:
 *
 *  - the live stream is deduped on `lastEmittedIce` (and `readyEmitted`), so
 *    a value that was just replayed can never be emitted again without
 *    changing first: replay and live are disjoint;
 *  - every consumer of these three events is idempotent in the value.
 *    `onIce('connected')` while connected is a no-op, a second `ready`
 *    while connected is a no-op, and a repeated op-version recomputes the
 *    same flag.
 *
 * `lastEmittedIce` and `readyEmitted` reset with each new peer connection,
 * so a re-invite replays nothing from the pairing it replaced. A closed
 * transport replays nothing at all.
 *
 * The whole-state `'state'` event is left edge-only on purpose: it already
 * publishes a complete snapshot and pairs with {@link RtcTransport.state}
 * as its level read, so a subscriber has somewhere to ask. The ceremony
 * surface had neither, which is the bug.
 *
 * ── The plate material: both fingerprints, exactly as they were used ────────────
 *
 * The connection plate (`plate.ts`) is the pairing's short authentication
 * string, and it is only worth anything if it is derived from the
 * fingerprints the DTLS handshake actually validated against. This module
 * is the only place that holds both: {@link RtcCeremonyEffects.plateMaterial}
 * publishes the one `extract()` pulled out of our OWN local description
 * before minting a blob, and the one `decodePayload()` read out of the
 * peer's blob, the byte-for-byte fingerprint `reconstruct()` put into the
 * remote description. A plate derived from a re-read, a cache or a display
 * string would be a number that agrees with itself and proves nothing.
 *
 * Two latches, reset by {@link newPeerConnection} exactly like
 * `readyEmitted` and `lastEmittedIce`: a re-invite is a new pairing with a
 * new certificate on at least one side, and inheriting the spent pairing's
 * fingerprint would show two humans a plate for a connection that no
 * longer exists. `null` until BOTH are known (and after `close()`),
 * because half a pair derives nothing: the caller shows nothing rather
 * than a wrong plate. Copies go out, not the arrays themselves: this is a
 * diagnostic read, and the pairing's trust root is not something to hand
 * out a mutable handle to.
 *
 * ── The isolation heuristic (section 11.1, section 11.2, section 11.26) ───────────────────────────────
 *
 * "It didn't connect" is a support ticket; "this network blocks
 * device-to-device traffic" is a shrug and a hotspot. The difference is
 * knowable: Wi-Fi client isolation and blocked mDNS both look like
 * *candidates gathered on both sides, and no candidate pair ever formed*.
 * {@link RtcTransportState.diagnosis} reports that, alongside the two
 * neighbouring diagnoses it must not be confused with (we gathered nothing
 * at all; the peer's blob carried nothing), and `isolationSuspected` is
 * the boolean the failure copy keys off. A pair is observed either by ICE
 * reaching `connected`/`completed` or by a `getStats()` sample containing
 * a `candidate-pair` report; the second path is what catches the case
 * where a pair formed and DTLS then failed, a different story from
 * isolation that must not borrow its copy.
 *
 * ── Three channels, three jobs (section 6.2, section 11.6) ─────────────────────────────────────
 *
 *   ops       ordered + reliable      the convergence lane; also carries the hello
 *   presence  unordered, 0 retransmits  cursors/focus; stale frames are expected (section 11.5)
 *   beam      ordered + reliable      bulk transfer, on its OWN channel (section 11.6)
 *
 * Beam gets its own channel because a 38 MB pack sharing the ops channel
 * would queue every edit behind it: head-of-line blocking that would make
 * co-editing feel broken for the whole duration of a transfer. Every frame
 * is capped at {@link MAX_FRAME_BYTES} (section 11.6's cross-browser SCTP
 * ceiling): oversize is refused as a typed result, never sent and never
 * allowed to kill the channel.
 *
 * Presence frames carry the sender's own `from`/`seq` when they already
 * have them: `PresenceEngine.snapshot()` relays OTHER peers' frames
 * verbatim, so re-stamping would corrupt the join handshake. Only an
 * unstamped frame gets this client's id and the next sequence number
 * (section 11.5, the receiver applies newest-only).
 *
 * ── Integration points, deliberately not imported ────────────────────────────────
 *
 * {@link RtcBeamLane} is structurally a `BeamWire` from `beam-protocol.ts`
 * (`json` + `binary`), and `onDrain()` is where that module's
 * `createBeamSender().nextChunk()` belongs: pull until `bufferedAmount()`
 * reaches `lowThreshold`, then let the `bufferedamountlow` event pull
 * again. The import is left out on purpose: a transport that hard-depends
 * on the beam protocol cannot be used by a session that never beams.
 *
 * Likewise the session adapter. `lib/collab-session.ts` defines a
 * `CollabSessionHandle` with `presenceIn`/`sendPresence`/`events`/`close`;
 * {@link RtcTransportState.connection} already uses that module's exact
 * `'connecting' | 'live' | 'reconnecting' | 'closed'` alphabet so the
 * adapter is a shape change and not a translation. TODO (stitch pass):
 * write `toCollabSessionHandle(transport, adapter, self)` in the wiring
 * layer, where both modules may legitimately be imported at once. It is
 * not written here because a transport must not depend on a session, and
 * `collab-session.ts` is still moving.
 *
 * ── What this deliberately does NOT do ──────────────────────────────────────────
 *
 * Stated so nobody assumes it is handled here and nobody implements it twice:
 *
 *  - **Op validation.** Inbound ops are shape-checked as an envelope and
 *    handed on verbatim. `validateCanvasOp` + the manifest's own-property
 *    whitelist (section 11.21) run where the tool's input model is in scope, not here.
 *  - **Rate caps.** section 11.21 wants ~200 ops/s and ~40 presence/s, with a peer
 *    that exceeds them disconnected rather than silently throttled. The
 *    counters belong with the policy that acts on them (the session layer
 *    holds the roster and the disconnect); what this module owns is the
 *    per-frame size cap, which is a wire property.
 *  - **Reconnect policy.** It reports the states; `ceremony.ts` decides
 *    what a drop means, and only the inviter arms a fresh invite (section 6.2a).
 *  - **The presence roster.** Frames pass through unreordered and
 *    unmerged; newest-only is `lib/collab-presence.ts`'s rule (section 11.5).
 *
 * No wall clock anywhere: every deadline is a delta handed to the injected
 * timers, so a device with a wrong clock (the airgap case, section 11.7) behaves
 * identically.
 */

import { CANVAS_OP_VERSION } from '@lolly-tools/core/canvas-op-v1';
import { errText } from '../lib/util/errors.ts';
import { isRecord } from '../lib/util/guards.ts';
import { HISTORY_PROTOCOL_VERSION } from '../lib/collab-history.ts';
import type { CeremonyEffects, CeremonyEvent, CeremonyIceState, CeremonyRole, CeremonyTimers } from './ceremony.ts';
import type { CollabAnswer, CollabInvite } from './ceremony.ts';
import type { PlateMaterial } from './plate.ts';
import { SDP_CODEC_VERSION, decodePayload, encodePayload, extract, reconstruct } from './sdp-codec.ts';
import type { CodecResult, InviteMeta, TokenSkin } from './sdp-codec.ts';
import type { PresenceFrame, PresenceState } from '../lib/collab-presence.ts';

// ── Tunables ───────────────────────────────────────────────────────────────────────

/**
 * How long non-trickle gathering may take before the blob is minted with
 * whatever candidates exist. Host candidates land in milliseconds; this
 * ceiling exists for the srflx lookup that never returns on a network with
 * no route out (section 6.1).
 */
export const GATHER_TIMEOUT_MS = 5_000;

/** Cross-browser SCTP-safe ceiling for one message (section 11.6). */
export const MAX_FRAME_BYTES = 64 * 1024;

/** `bufferedAmountLowThreshold` for the beam channel - the pull point (section 6.4). */
export const BEAM_LOW_THRESHOLD = 256 * 1024;

/** A peer's client id is a ULID; this only has to be generous enough not to be a rule. */
export const MAX_CLIENT_ID_CHARS = 64;

/** The three lanes, in the order they are created (section 6.2, section 11.6). */
export const LANES = ['ops', 'presence', 'beam'] as const;
export type RtcLane = (typeof LANES)[number];

/**
 * Channel options per lane. `presence` is the lossy one on purpose: a
 * cursor sample that arrives late is worse than one that never arrives,
 * which is why section 11.5 puts a sequence number on every frame instead of
 * asking SCTP to keep order.
 */
export const CHANNEL_INIT: Readonly<Record<RtcLane, RTCDataChannelInit>> = {
  ops: { ordered: true },
  presence: { ordered: false, maxRetransmits: 0 },
  beam: { ordered: true },
};

// ── The platform surface, as narrow as it can be ──────────────────────────────────

/**
 * The union of every event field this module reads. `type` is here so that a real DOM
 * `Event` shares a property with it - without an overlap the all-optional shape would
 * be a "weak type" and the real listener signatures would stop being assignable.
 */
export interface RtcEventLike {
  readonly type?: string;
  /** `message` events. */
  readonly data?: unknown;
  /** `icecandidate` events; `null` is the end-of-gathering signal. */
  readonly candidate?: unknown;
  /** `datachannel` events (the acceptor's channels arrive this way). */
  readonly channel?: unknown;
}

export type RtcListener = (event: RtcEventLike) => void;

/** `{ type, sdp }` - satisfied by both `RTCSessionDescription` and its `Init` form. */
export interface RtcDescriptionLike {
  readonly type?: string;
  readonly sdp?: string;
}

/** A `getStats()` report, reduced to the one operation the pair heuristic needs. */
export interface RtcStatsLike {
  forEach(visit: (report: unknown) => void): void;
}

/** The subset of `RTCDataChannel` this module uses. */
export interface RtcDataChannelLike {
  readonly label: string;
  /** `RTCDataChannelState` widened to `string` so a fake need not import DOM types. */
  readonly readyState: string;
  binaryType: string;
  readonly bufferedAmount: number;
  bufferedAmountLowThreshold: number;
  send(data: string | ArrayBufferLike | ArrayBufferView): void;
  close(): void;
  addEventListener(type: string, listener: RtcListener): void;
  removeEventListener(type: string, listener: RtcListener): void;
}

/** The subset of `RTCPeerConnection` this module uses. */
export interface RtcPeerConnectionLike {
  readonly iceGatheringState: string;
  readonly iceConnectionState: string;
  readonly connectionState: string;
  readonly localDescription: RtcDescriptionLike | null;
  createDataChannel(label: string, init?: RTCDataChannelInit): RtcDataChannelLike;
  createOffer(): Promise<RtcDescriptionLike>;
  createAnswer(): Promise<RtcDescriptionLike>;
  setLocalDescription(description?: RtcDescriptionLike): Promise<void>;
  setRemoteDescription(description: RtcDescriptionLike): Promise<void>;
  addEventListener(type: string, listener: RtcListener): void;
  removeEventListener(type: string, listener: RtcListener): void;
  /** Optional: absent in some webviews (section 11.29), and the heuristic degrades honestly. */
  getStats?(): Promise<RtcStatsLike>;
  close(): void;
}

export type RtcPeerConnectionCtor = new (config?: RTCConfiguration) => RtcPeerConnectionLike;

/**
 * The ambient constructor, or `null` where WebRTC does not exist (a Tauri
 * Linux webview with webkitgtk's WebRTC off, section 11.29, an honest refusal, not
 * a crash).
 *
 * The assignment matters beyond its one line: it is the
 * compile-time proof that the real `RTCPeerConnection` still satisfies
 * {@link RtcPeerConnectionLike}. Casting here would make the minimal
 * interfaces above a description of what the DOM looked like once, rather
 * than a checked subset of what it is.
 */
export function defaultPeerConnectionCtor(): RtcPeerConnectionCtor | null {
  if (typeof RTCPeerConnection === 'undefined') return null;
  const ctor: RtcPeerConnectionCtor = RTCPeerConnection;
  return ctor;
}

/** Same shape as the ceremony's timers, so one injected clock drives both. */
export type RtcTimers = CeremonyTimers;

const REAL_TIMERS: RtcTimers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  },
};

// ── Public shapes ─────────────────────────────────────────────────────────────────

/** Chosen identity, never a profile field (section 11.23). */
export interface RtcSelfIdentity {
  /**
   * Display name, or absent for an anonymous peer.
   *
   * A THUNK IS ALLOWED, and on the acceptor it is what you want: that side
   * names itself AFTER the tool probe, i.e. after the transport has been
   * built, so a plain string here freezes whatever the profile prefilled
   * and the peer never sees the name the human typed. Read once per mint
   * (`inviteMeta`, `createAnswer`), never cached, exactly the contract the
   * ceremony dialog's `CeremonyEffectsContext.name` getter is written against.
   */
  readonly name?: string | (() => string | undefined);
  /** Slot in the derived collaborator palette; travels as a u8 (section 4.4). */
  readonly colorIndex?: number;
  /** Resolved colour, carried for the local UI only - the peer re-derives (section 4.4). */
  readonly colour?: string;
}

/** The tool the pair must both have (section 6.1). Required to mint an invite. */
export interface RtcToolRef {
  readonly id: string;
  /** Defaults to {@link UNKNOWN_VERSION}: the codec refuses an EMPTY version field on
   *  the way back in, so "unknown" has to be spelled, not omitted. */
  readonly version?: string;
  readonly engineVersion?: string;
}

/**
 * What the codec's version fields fall back to. `readVersionField` treats
 * a zero-length string as a malformed payload, so a missing version
 * cannot be encoded as `''`. It would pack cleanly and then fail to unpack
 * on the peer's device, the worst possible place to discover it.
 */
export const UNKNOWN_VERSION = '0.0.0';

/**
 * Structurally identical to `collab-session.ts`'s `CollabConnectionState`, so the
 * adapter is a rename and not a mapping. `'reconnecting'` is a first-class state, not
 * a synonym for trouble (section 11.3).
 */
export type RtcConnectionState = 'connecting' | 'live' | 'reconnecting' | 'closed';

export type RtcLaneState = 'absent' | 'connecting' | 'open' | 'closed';

export type RtcGatheringState = 'idle' | 'gathering' | 'complete' | 'timed-out';

/**
 * Why a failure *now* would have happened: the input to section 11.26's per-cause copy.
 *
 * Read it when the ceremony reports a failure. Before that it is a live
 * read of what is still missing (a pair that has not formed yet reads as
 * `isolation-suspected`, because that is genuinely what the evidence says
 * at that instant), useful for a connecting spinner and misleading if
 * mistaken for a verdict.
 */
export type RtcDiagnosis =
  /** It was live and then died - different copy from never having connected (section 11.3). */
  | 'connection-lost'
  /** We gathered nothing at all: no usable interface, or mDNS fully blocked (section 11.1). */
  | 'no-local-candidates'
  /** The peer's blob carried no candidates - their side, not this network. */
  | 'no-remote-candidates'
  /** Both sides had candidates and no pair ever formed: client isolation (section 11.2). */
  | 'isolation-suspected'
  /** A pair formed and the connection still failed - DTLS/SCTP, not the network path. */
  | 'handshake-failed';

export interface RtcTransportState {
  readonly connection: RtcConnectionState;
  /** The last ICE state handed to the ceremony, in the ceremony's own alphabet. */
  readonly ice: CeremonyIceState;
  readonly gathering: RtcGatheringState;
  readonly lanes: Readonly<Record<RtcLane, RtcLaneState>>;
  /** True once this pair has been connected at all: ICE reached connected,
   *  or every lane opened. It is what turns a late failure into
   *  `connection-lost` rather than a network diagnosis (section 11.3): they DID
   *  reach each other once. */
  readonly everConnected: boolean;
  /** Candidates gathered locally for the blob we minted. */
  readonly localCandidates: number;
  /** Candidates carried by the peer's blob, once one has been applied. */
  readonly remoteCandidates: number;
  /** A candidate pair was observed (ICE connected, or a `getStats` sample said so). */
  readonly candidatePairSeen: boolean;
  /** See {@link RtcDiagnosis}. */
  readonly diagnosis: RtcDiagnosis;
  /** The section 11.2 heuristic, as the failure copy wants it: `diagnosis` is isolation. */
  readonly isolationSuspected: boolean;
}

export type RtcSendResult =
  | 'sent'
  /** The lane exists but is not open yet - the caller should retry on `channel-open`. */
  | 'not-open'
  /** Over {@link MAX_FRAME_BYTES}. Refused, not sent: an oversize write kills SCTP. */
  | 'too-large'
  /** The transport is closed. Terminal; stop sending. */
  | 'closed'
  /** The frame could not be serialised (a cycle, a BigInt) - a caller bug, not a peer's. */
  | 'unserializable';

/** One inbound frame, already parsed and shape-checked. */
export type RtcInboundMessage =
  | { readonly lane: 'ops'; readonly kind: 'op'; readonly op: unknown }
  | {
      readonly lane: 'ops';
      readonly kind: 'hello';
      readonly clientId?: string;
      readonly opVersion?: string;
      /** The peer's announced shared-history capability, or absent for an older peer. */
      readonly history?: string;
      /** The inviter's packed session seed (section 6.1) - see {@link RtcTransportOptions.seed}. */
      readonly seed?: string;
    }
  | { readonly lane: 'presence'; readonly kind: 'presence'; readonly frame: PresenceFrame }
  | { readonly lane: 'beam'; readonly kind: 'json'; readonly json: unknown }
  | { readonly lane: 'beam'; readonly kind: 'binary'; readonly bytes: Uint8Array };

export interface RtcTransportEventMap {
  readonly message: RtcInboundMessage;
  readonly state: RtcTransportState;
  readonly 'channel-open': RtcLane;
}

/** Exactly the ceremony events this module can source. `machine.send(ev)` takes them raw. */
export type RtcCeremonyEvent = Extract<
  CeremonyEvent,
  { type: 'ice' } | { type: 'ready' } | { type: 'peer-op-version' }
>;

/**
 * A ceremony-event subscriber.
 *
 * Written in method form so its parameter is compared BIVARIANTLY, which is
 * deliberate and is the seam's whole reason for existing: a caller that
 * spells the union out for itself (the dialog layer keeps a structural copy
 * instead of importing this module, even for a type) must not be broken by
 * a variant being ADDED here. The events are additive by contract (`ready`
 * joined `ice` and `peer-op-version` in this wave), and every consumer is a
 * `machine.send`, which takes the full `CeremonyEvent` union anyway. A
 * subscriber typed for fewer variants still receives them all at runtime,
 * the behaviour that keeps a pairing completing; it is never handed
 * something the machine cannot read.
 */
export type RtcCeremonyListener = { listen(event: RtcCeremonyEvent): void }['listen'];

/**
 * The three effects `createCeremony` injects; `checkTool` stays the catalog's job.
 *
 * Plus the two level reads, `iceState` and `channelsReady`, REQUIRED here
 * even though the contract makes them optional, because this transport can
 * always answer and the whole point of them is that the ceremony's gated
 * phases can ask on entry instead of depending on an edge they may have
 * been in no phase to act on. Declared on the effects bundle rather than
 * only on {@link RtcTransport} so the existing
 * `{ ...transport.effects, checkTool }` wiring picks them up with no change
 * at the seam.
 */
export type RtcCeremonyEffects = Pick<CeremonyEffects, 'createOffer' | 'createAnswer' | 'applyRemote'> & {
  iceState(): CeremonyIceState;
  channelsReady(): boolean;
  /**
   * The two DTLS fingerprints this pairing is built on, for `plate.ts`: ours
   * as extracted from our own local description, theirs as decoded from the
   * blob that became the remote description. See the header. `null` until
   * both are known and once the transport is closed; never a partial pair,
   * because a plate derived from half of one would be a confident number
   * about nothing.
   *
   * A LEVEL READ, like `iceState` and `channelsReady`, and available from
   * `ready` onwards for both roles: the inviter has its own from
   * `createOffer` and the peer's from `applyRemote`, the acceptor has the
   * peer's from `createAnswer` and its own from the blob it mints in the
   * same call.
   */
  plateMaterial(): PlateMaterial | null;
};

/**
 * The bulk lane. `json` + `binary` are `beam-protocol.ts`'s `BeamWire` verbatim, so a
 * `createBeamSender({ wire: transport.beam, … })` needs no shim; `onDrain` is where its
 * `nextChunk()` goes.
 *
 * Both writers return `void` because `BeamWire` does - a refused frame is logged, and a
 * caller that wants the result uses {@link RtcTransport.sendBeam} instead.
 */
export interface RtcBeamLane {
  json(message: unknown): void;
  binary(bytes: Uint8Array): void;
  /**
   * Register the pull. Fired when the channel opens and on every `bufferedamountlow`.
   * Returns a real teardown.
   */
  onDrain(pull: () => void): () => void;
  bufferedAmount(): number;
  readonly lowThreshold: number;
  isOpen(): boolean;
}

/** A presence frame on its way out; `from`/`seq` are filled in only when absent. */
export type RtcPresenceOutbound = Omit<PresenceFrame, 'from' | 'seq'> & {
  readonly from?: string;
  readonly seq?: number;
};

export interface RtcTransport {
  readonly role: CeremonyRole;
  readonly clientId: string;
  /** Ready to hand to `createCeremony({ effects: { ...transport.effects, checkTool } })`. */
  readonly effects: RtcCeremonyEffects;
  state(): RtcTransportState;
  sendOp(op: unknown): RtcSendResult;
  sendPresence(frame: RtcPresenceOutbound): RtcSendResult;
  /** The typed writer behind {@link RtcBeamLane.json} / `.binary`. */
  sendBeam(payload: { readonly json: unknown } | { readonly bytes: Uint8Array }): RtcSendResult;
  readonly beam: RtcBeamLane;
  on<K extends keyof RtcTransportEventMap>(type: K, fn: (value: RtcTransportEventMap[K]) => void): () => void;
  /**
   * ICE, the ops lane's readiness, and the in-band op-version hello, in the
   * ceremony's own event shape.
   *
   * REPLAYS on subscribe: the new subscriber is handed the last emitted ICE
   * state, a `ready` if the ops channel is already open, and the peer's
   * last declared op version, synchronously, in that order, before this
   * returns. See the header: these events carry state, and a LAN pair can
   * be fully open before a ceremony has finished minting its answer. The
   * replay goes to this subscriber only, and cannot double-fire a
   * transition (the live stream is deduped on the same value).
   */
  onCeremonyEvent(fn: RtcCeremonyListener): () => void;
  /** Tear down channels, the peer connection, every listener and every timer. Idempotent. */
  close(): void;
}

export interface RtcTransportOptions {
  readonly role: CeremonyRole;
  /** This device's collab client id (a random ULID, section 11.23). Stamped on the hello. */
  readonly clientId: string;
  /** Defaults to the ambient `RTCPeerConnection`; a test passes its fake. */
  readonly rtc?: RtcPeerConnectionCtor | null;
  readonly config?: RTCConfiguration;
  readonly timers?: RtcTimers;
  readonly self?: RtcSelfIdentity;
  /** Required to mint an invite; unused by the acceptor. */
  readonly tool?: RtcToolRef;
  /** This device's `CANVAS_OP_VERSION`; defaults to the pinned one. */
  readonly opVersion?: string;
  /** This device's shared-history capability, announced on the hello beside the op
   *  version; defaults to `HISTORY_PROTOCOL_VERSION`. A peer that reads a value it does
   *  not recognise simply leaves shared history disabled (plan 221 section 9). */
  readonly historyProtocol?: string;
  /**
   * Packed `z`-param session seed, or absent for "you'll receive it on connect" (section 6.1).
   *
   * It travels IN BAND, on the ops-channel hello, never in the invite blob.
   * The blob is sized for a QR (section 6.1 wants ≤150 B, `MAX_PAYLOAD_BYTES` caps
   * it at 512) and a packed session state does not fit; section 12 Q3 leans
   * transfer-on-connect for exactly this reason. The hello still lands
   * before the first op, and it is dropped from the frame instead of being
   * allowed to push the hello over {@link MAX_FRAME_BYTES}, because losing
   * the op-version declaration would be the worse trade.
   */
  readonly seed?: string;
  /** Which text skin the minted blobs wear. `'qr'` for a scan, `'link'` for a URL. */
  readonly skin?: TokenSkin;
  readonly gatherTimeoutMs?: number;
  readonly beamLowThreshold?: number;
  /** Diagnostics. Never user copy. */
  readonly log?: (message: string, detail?: unknown) => void;
}

// ── Pure helpers (exported: the dialogs need them too) ────────────────────────────

/**
 * What a decoded invite token yields.
 *
 * `colorIndex` rides alongside rather than inside the invite because the
 * two are different things: `CollabPeer.colour` is a resolved hex the
 * receiving shell MAY use, and the wire carries a palette SLOT (section 4.4) that
 * the receiver resolves against its own derived palette. Stuffing the
 * index into the colour field would produce a peer chip painted `"3"`.
 */
export interface DecodedInvite {
  readonly invite: CollabInvite;
  /** Palette slot the inviter chose; resolve it via `lib/collab-colors.ts`. */
  readonly colorIndex?: number;
}

/**
 * A scanned/pasted invite token to the `CollabInvite` the ceremony's
 * `accept` event takes. Everything the acceptor needs BEFORE it answers
 * (tool id, versions, the inviter's chosen name) comes out of the same
 * blob that carries the connection material, which is why the probe can
 * happen before a single packet moves (section 6.1).
 */
export function inviteFromToken(token: string, skin: TokenSkin | 'auto' = 'auto'): CodecResult<DecodedInvite> {
  const decoded = decodePayload(token, skin);
  if (!decoded.ok) return decoded;
  if (decoded.value.kind !== 'invite') {
    return { ok: false, code: 'bad-field', reason: 'rtc-transport: that token is an answer, not an invite' };
  }
  const meta = decoded.value.invite;
  return {
    ok: true,
    value: {
      invite: {
        signal: token,
        toolId: meta.toolId,
        toolVersion: meta.toolVersion,
        engineVersion: meta.engineVersion,
        opVersion: meta.opVersion,
        name: meta.name,
      },
      colorIndex: meta.colorIndex,
    },
  };
}

/**
 * A pasted/scanned reply token to the `CollabAnswer` the ceremony's
 * `answer` event takes.
 *
 * The answer record carries connection material only (the codec spends no
 * bytes on metadata it does not need), so the peer's name arrives in band
 * instead, on the presence lane. A failure here is the section 11.25 retryable
 * one: a bad paste is a step to repeat, not a ceremony to end.
 */
export function answerFromToken(token: string, skin: TokenSkin | 'auto' = 'auto'): CodecResult<CollabAnswer> {
  const decoded = decodePayload(token, skin);
  if (!decoded.ok) return decoded;
  if (decoded.value.kind !== 'answer') {
    return { ok: false, code: 'bad-field', reason: 'rtc-transport: that token is an invite, not an answer' };
  }
  return { ok: true, value: { signal: token } };
}

/**
 * Is this frame over the SCTP ceiling (section 11.6)?
 *
 * Every UTF-16 code unit costs at most 3 UTF-8 bytes (a surrogate pair is 2
 * units = 4 bytes), so a frame under a third of the cap is provably fine
 * and the encode is skipped, which covers every op and every presence
 * sample, i.e. essentially all traffic.
 */
const frameEncoder = new TextEncoder();
export function exceedsFrameLimit(text: string): boolean {
  if (text.length * 3 <= MAX_FRAME_BYTES) return false;
  return frameEncoder.encode(text).length > MAX_FRAME_BYTES;
}

/**
 * Shape-check an inbound presence frame (section 11.21, every remote byte is untrusted).
 *
 * Only the envelope is checked here: `from`/`seq`/`away` are this module's
 * contract with the roster, while `state` is the session's to validate
 * against the tool's declared inputs. The fields are copied one by one
 * instead of spread, so nothing a peer added rides along into the roster.
 */
export function parsePresenceFrame(value: unknown): PresenceFrame | null {
  if (!isRecord(value)) return null;
  const from = value.from;
  const seq = value.seq;
  const state = value.state;
  const away = value.away;
  if (typeof from !== 'string' || from.length === 0 || from.length > MAX_CLIENT_ID_CHARS) return null;
  if (typeof seq !== 'number' || !Number.isFinite(seq)) return null;
  if (state !== null && !isRecord(state)) return null;
  if (away !== undefined && typeof away !== 'boolean') return null;
  return {
    from,
    seq,
    state: state === null ? null : (state as PresenceState),
    away: away === true,
  };
}

/** ICE states are already the ceremony's alphabet; `connectionState` needs mapping. */
function mapConnectionState(value: string): CeremonyIceState | null {
  switch (value) {
    case 'new':
      return 'new';
    case 'connecting':
      return 'checking';
    case 'connected':
      return 'connected';
    case 'disconnected':
      return 'disconnected';
    case 'failed':
      return 'failed';
    case 'closed':
      return 'closed';
    default:
      return null;
  }
}

const ICE_STATES: readonly string[] = ['new', 'checking', 'connected', 'completed', 'disconnected', 'failed', 'closed'];

function mapIceState(value: string): CeremonyIceState | null {
  return ICE_STATES.indexOf(value) >= 0 ? (value as CeremonyIceState) : null;
}

function isCandidatePairReport(report: unknown): boolean {
  return isRecord(report) && report.type === 'candidate-pair';
}

// ── The transport ─────────────────────────────────────────────────────────────────

export function createRtcTransport(opts: RtcTransportOptions): RtcTransport {
  const role = opts.role;
  const clientId = opts.clientId;
  const ctor = opts.rtc === undefined ? defaultPeerConnectionCtor() : opts.rtc;
  const timers = opts.timers ?? REAL_TIMERS;
  const opVersion = opts.opVersion ?? CANVAS_OP_VERSION;
  const historyProtocol = opts.historyProtocol ?? HISTORY_PROTOCOL_VERSION;
  const skin: TokenSkin = opts.skin ?? 'link';
  const gatherTimeoutMs = opts.gatherTimeoutMs ?? GATHER_TIMEOUT_MS;
  const beamLowThreshold = opts.beamLowThreshold ?? BEAM_LOW_THRESHOLD;
  const log = opts.log ?? ((): void => {});

  const listeners: {
    message: Set<(value: RtcInboundMessage) => void>;
    state: Set<(value: RtcTransportState) => void>;
    'channel-open': Set<(value: RtcLane) => void>;
  } = { message: new Set(), state: new Set(), 'channel-open': new Set() };
  const ceremonyListeners = new Set<RtcCeremonyListener>();
  const drainListeners = new Set<() => void>();

  /** Every `addEventListener` this module made, paired with its removal. Cleared per pc. */
  let teardowns: (() => void)[] = [];
  const pendingTimers = new Set<unknown>();

  let pc: RtcPeerConnectionLike | null = null;
  const channels = new Map<RtcLane, RtcDataChannelLike>();
  const laneStates: Record<RtcLane, RtcLaneState> = { ops: 'absent', presence: 'absent', beam: 'absent' };

  let closed = false;
  let connection: RtcConnectionState = 'connecting';
  let ice: CeremonyIceState = 'new';
  let lastEmittedIce: CeremonyIceState | null = null;
  /**
   * Has `{ type: 'ready' }` gone out for THIS peer connection? Both the
   * dedup key for the live stream and the flag the replay reads, exactly
   * as `lastEmittedIce` is for ICE.
   *
   * A data channel cannot re-open, so this is a one-way latch within a
   * pairing, and it is reset by `newPeerConnection`, because a re-invite
   * is a new pairing and inheriting the dead one's completion would tell a
   * fresh ceremony it had already finished.
   */
  let readyEmitted = false;
  /**
   * Which CHANNELS have already been announced open, as opposed to merely being open.
   *
   * `laneStates` cannot answer this: `bindChannel` sets a lane to `'open'`
   * before it announces it (an inbound channel can arrive already open),
   * so by the time `onChannelOpen` runs, the state it would test is the
   * state it was called about. This is the latch that makes the
   * announcement idempotent, needed because BOTH of `bindChannel`'s paths
   * fire on a real browser: an acceptor's channel arrives from
   * `ondatachannel` already `'open'` (so the inline call runs), and Chrome
   * then dispatches the `open` event to the listener bound a few lines
   * earlier anyway. Measured, not theorised: the acceptor put its ops
   * hello on the wire twice, 2ms apart, on every loopback pairing in the
   * browser drill.
   *
   * Keyed on the channel rather than the lane, so it says "this channel has
   * spoken" rather than "this lane is spoken for": a genuinely new channel
   * on the same lane is a new thing to announce, and keying by lane would
   * silence it. Weak, so it needs no resetting anywhere: a spent pairing's
   * channels are unreachable and go with it.
   */
  const announced = new WeakSet<object>();
  /**
   * The peer's last declared `CANVAS_OP_VERSION`, held for the replay (see the header).
   * `null` is "the peer has not said", which is silence and not a gap - the same
   * distinction `ceremony.ts` draws, so a replay of nothing is the correct nothing.
   */
  let lastPeerOpVersion: string | null = null;
  let gathering: RtcGatheringState = 'idle';
  let gatherWaiters: ((result: 'complete' | 'timeout') => void)[] = [];
  let localCandidates = 0;
  let remoteCandidates = 0;
  let remoteApplied = false;
  /**
   * The pairing's two DTLS fingerprints, for the connection plate (see the header).
   *
   * `localFingerprint` is written where the blob is minted, because that is
   * where our own local description is read; `remoteFingerprint` is
   * written where the peer's blob is decoded, beside
   * `remoteCandidates`/`remoteApplied`, because those three are the same
   * fact: a remote description was applied, and this is what it said.
   */
  let localFingerprint: Uint8Array | null = null;
  let remoteFingerprint: Uint8Array | null = null;
  let candidatePairSeen = false;
  let everConnected = false;
  /**
   * Sticky between a `disconnected` and the next real `connected`/`completed` (section 11.3).
   *
   * A UDP blip does not go straight back: `RTCIceTransport` legally
   * returns through `checking` (Chrome does), and `connectionState:
   * 'connecting'` maps to the same thing, while the SCTP channels stay
   * open throughout, so the lane test alone would read `live` again
   * halfway through the recovery. section 11.3 wants the avatar greyed for the
   * duration of the reconnect, not un-greyed and re-greyed.
   */
  let recovering = false;
  let presenceSeq = 0;
  let snapshot: RtcTransportState | null = null;

  // ── timers ─────────────────────────────────────────────────────────────────────

  function startTimer(ms: number, fn: () => void): unknown {
    const handle = timers.setTimeout(() => {
      pendingTimers.delete(handle);
      fn();
    }, ms);
    pendingTimers.add(handle);
    return handle;
  }

  function stopTimer(handle: unknown): void {
    if (!pendingTimers.has(handle)) return;
    pendingTimers.delete(handle);
    timers.clearTimeout(handle);
  }

  function clearTimers(): void {
    for (const handle of pendingTimers) timers.clearTimeout(handle);
    pendingTimers.clear();
  }

  // ── events ─────────────────────────────────────────────────────────────────────

  function emit<K extends keyof RtcTransportEventMap>(type: K, value: RtcTransportEventMap[K]): void {
    const set = listeners[type] as Set<(v: RtcTransportEventMap[K]) => void>;
    for (const fn of [...set]) {
      try {
        fn(value);
      } catch {
        /* a broken observer must not break the transport */
      }
    }
  }

  function emitCeremony(event: RtcCeremonyEvent): void {
    // Recorded HERE, not at the call site, so what the replay hands out is
    // by construction the last thing that went out; the two cannot drift
    // apart. ICE's equivalent (`lastEmittedIce`) is written by `observeIce`
    // because it is also the dedup key that decides whether this function
    // is called at all.
    if (event.type === 'peer-op-version') lastPeerOpVersion = event.opVersion;
    for (const fn of [...ceremonyListeners]) {
      try {
        fn(event);
      } catch {
        /* same rule */
      }
    }
  }

  /**
   * Hand ONE new subscriber the state it would otherwise have arrived too late for.
   *
   * Not a broadcast: every other listener already has these values, and
   * re-delivering them to a set would be exactly the double-fire the header
   * promises cannot happen. `lastEmittedIce`, not `ice`, so the replayed
   * value is one the live stream has already deduped on: it cannot be
   * emitted again without changing first. `'new'` is the absence of a
   * transition and is not worth replaying; a closed transport has no live
   * state to describe, and its listener set has been cleared anyway.
   */
  function replayCeremony(fn: RtcCeremonyListener): void {
    if (closed) return;
    const iceNow = lastEmittedIce;
    // Causal order, which is also the order that fails safe: ICE happened
    // first, `ready` needs both descriptions applied, and the op-version
    // hello can only arrive on an already-open ops channel. A pairing whose
    // lane opened and then died replays its `failed` BEFORE its `ready`, so
    // the ceremony ends rather than completing.
    if (iceNow !== null && iceNow !== 'new') {
      try {
        fn({ type: 'ice', state: iceNow });
      } catch {
        /* a broken observer must not break the transport */
      }
    }
    if (readyEmitted) {
      try {
        fn({ type: 'ready' });
      } catch {
        /* same rule */
      }
    }
    if (lastPeerOpVersion !== null) {
      try {
        fn({ type: 'peer-op-version', opVersion: lastPeerOpVersion });
      } catch {
        /* same rule */
      }
    }
  }

  function diagnose(): RtcDiagnosis {
    if (everConnected) return 'connection-lost';
    if (localCandidates === 0) return 'no-local-candidates';
    if (remoteApplied && remoteCandidates === 0) return 'no-remote-candidates';
    if (!candidatePairSeen) return 'isolation-suspected';
    return 'handshake-failed';
  }

  function buildState(): RtcTransportState {
    const diagnosis = diagnose();
    return {
      connection,
      ice,
      gathering,
      lanes: { ...laneStates },
      everConnected,
      localCandidates,
      remoteCandidates,
      candidatePairSeen,
      diagnosis,
      isolationSuspected: diagnosis === 'isolation-suspected',
    };
  }

  function sameState(a: RtcTransportState, b: RtcTransportState): boolean {
    return (
      a.connection === b.connection &&
      a.ice === b.ice &&
      a.gathering === b.gathering &&
      a.everConnected === b.everConnected &&
      a.localCandidates === b.localCandidates &&
      a.remoteCandidates === b.remoteCandidates &&
      a.candidatePairSeen === b.candidatePairSeen &&
      a.diagnosis === b.diagnosis &&
      a.lanes.ops === b.lanes.ops &&
      a.lanes.presence === b.lanes.presence &&
      a.lanes.beam === b.lanes.beam
    );
  }

  function publish(): void {
    const next = buildState();
    if (snapshot && sameState(snapshot, next)) return;
    snapshot = next;
    emit('state', next);
  }

  function state(): RtcTransportState {
    if (!snapshot) snapshot = buildState();
    return snapshot;
  }

  // ── connection state (section 11.3) ───────────────────────────────────────────────────

  function recomputeConnection(): void {
    if (closed) {
      connection = 'closed';
      return;
    }
    if (ice === 'failed' || ice === 'closed') {
      connection = 'closed';
      return;
    }
    if (ice === 'disconnected' || recovering) {
      // Transient by construction: grey the avatar, evict nobody, tear nothing down.
      connection = 'reconnecting';
      return;
    }
    connection = laneStates.ops === 'open' ? 'live' : 'connecting';
  }

  /**
   * One ICE observation, from either source. Deduped on the mapped value
   * so a browser that drives both `connectionstatechange` and
   * `iceconnectionstatechange` does not hand the ceremony the same
   * transition twice.
   */
  function observeIce(next: CeremonyIceState): void {
    if (closed) return;
    if (next === 'connected' || next === 'completed') {
      candidatePairSeen = true;
      everConnected = true;
      recovering = false;
    } else if (next === 'disconnected') {
      recovering = true;
    } else if (next === 'failed' || next === 'closed') {
      recovering = false;
    }
    ice = next;
    samplePairs();
    if (lastEmittedIce !== next) {
      lastEmittedIce = next;
      recomputeConnection();
      publish();
      emitCeremony({ type: 'ice', state: next });
      return;
    }
    recomputeConnection();
    publish();
  }

  /**
   * Ask the stack whether a candidate pair exists. This is what separates
   * "the network would not let these two devices see each other" from
   * "they saw each other and the handshake failed": two failures with the
   * same shape and completely different copy. Fire-and-forget: a stack
   * without `getStats` (section 11.29) simply keeps the ICE-reached-connected
   * path as its only evidence.
   */
  function samplePairs(): void {
    const conn = pc;
    if (!conn || candidatePairSeen || typeof conn.getStats !== 'function') return;
    let report: Promise<RtcStatsLike>;
    try {
      report = conn.getStats();
    } catch {
      return;
    }
    if (!report || typeof report.then !== 'function') return;
    report.then(
      (result) => {
        if (closed || candidatePairSeen || !result || typeof result.forEach !== 'function') return;
        let seen = false;
        try {
          result.forEach((entry) => {
            if (isCandidatePairReport(entry)) seen = true;
          });
        } catch {
          return;
        }
        if (!seen) return;
        candidatePairSeen = true;
        publish();
      },
      () => {
        /* stats are a diagnostic; their absence is not a failure */
      },
    );
  }

  // ── peer connection lifecycle ──────────────────────────────────────────────────

  function runTeardowns(): void {
    const list = teardowns;
    teardowns = [];
    for (const fn of list) {
      try {
        fn();
      } catch {
        /* removal must never throw past close() */
      }
    }
  }

  function listen(target: { addEventListener(t: string, l: RtcListener): void; removeEventListener(t: string, l: RtcListener): void }, type: string, fn: RtcListener): void {
    target.addEventListener(type, fn);
    teardowns.push(() => {
      target.removeEventListener(type, fn);
    });
  }

  function resolveGathering(result: 'complete' | 'timeout'): void {
    const waiters = gatherWaiters;
    gatherWaiters = [];
    for (const fn of waiters) fn(result);
  }

  function markGatherComplete(): void {
    if (gathering === 'complete') return;
    gathering = 'complete';
    publish();
    resolveGathering('complete');
  }

  /**
   * Close any previous connection and build a fresh one.
   *
   * A re-invite always gets a NEW peer connection: a dropped WebRTC
   * connection can never be resumed, its ICE credentials are spent, and
   * reusing the object would mint an offer whose candidates the peer has
   * already failed to reach (section 6.1, section 11.3).
   */
  function newPeerConnection(): RtcPeerConnectionLike | null {
    if (!ctor) return null;
    disposePeer();
    let conn: RtcPeerConnectionLike;
    try {
      conn = new ctor(opts.config);
    } catch (err) {
      log('rtc-transport: RTCPeerConnection refused to construct', errText(err));
      return null;
    }
    pc = conn;
    gathering = 'gathering';
    localCandidates = 0;
    remoteCandidates = 0;
    remoteApplied = false;
    // A new pairing means a new certificate on at least one side. A plate carried over
    // from the connection this one replaced would be two humans agreeing about something
    // that is gone.
    localFingerprint = null;
    remoteFingerprint = null;
    candidatePairSeen = false;
    ice = 'new';
    lastEmittedIce = null;
    // A fresh peer connection is a fresh pairing, not the tail of the old
    // one's blip, and not the tail of the old peer's declarations or its
    // completion either, so the replay of a re-invite starts empty instead
    // of describing a connection that is gone.
    readyEmitted = false;
    lastPeerOpVersion = null;
    recovering = false;

    listen(conn, 'icecandidate', (event) => {
      // A null candidate is the end-of-gathering signal; some stacks give only this and
      // never move `iceGatheringState`, so both paths have to complete the wait.
      if (event.candidate === null || event.candidate === undefined) {
        markGatherComplete();
        return;
      }
      localCandidates += 1;
      publish();
    });
    listen(conn, 'icegatheringstatechange', () => {
      if (conn.iceGatheringState === 'complete') markGatherComplete();
    });
    listen(conn, 'iceconnectionstatechange', () => {
      const mapped = mapIceState(conn.iceConnectionState);
      if (mapped) observeIce(mapped);
    });
    listen(conn, 'connectionstatechange', () => {
      const mapped = mapConnectionState(conn.connectionState);
      if (mapped) observeIce(mapped);
    });
    listen(conn, 'datachannel', (event) => {
      const channel = asDataChannel(event.channel);
      if (!channel) return;
      const lane = LANES.find((l) => l === channel.label);
      if (!lane) {
        // Forward compatibility: a future lane from a newer peer is ignored, not fatal.
        log('rtc-transport: ignoring an unknown data channel', channel.label);
        return;
      }
      bindChannel(lane, channel);
    });
    // A re-arm inherits the previous connection's `'closed'` reading until this runs;
    // the session is connecting again, and the pill must say so.
    recomputeConnection();
    publish();
    return conn;
  }

  function asDataChannel(value: unknown): RtcDataChannelLike | null {
    if (typeof value !== 'object' || value === null) return null;
    const candidate = value as Partial<RtcDataChannelLike>;
    if (typeof candidate.label !== 'string' || typeof candidate.send !== 'function') return null;
    return value as RtcDataChannelLike;
  }

  function disposePeer(): void {
    runTeardowns();
    for (const channel of channels.values()) {
      try {
        channel.close();
      } catch {
        /* a channel that is already gone is not a problem */
      }
    }
    channels.clear();
    for (const lane of LANES) laneStates[lane] = 'absent';
    resolveGathering('timeout');
    if (pc) {
      try {
        pc.close();
      } catch {
        /* same */
      }
    }
    pc = null;
  }

  // ── channels ───────────────────────────────────────────────────────────────────

  function bindChannel(lane: RtcLane, channel: RtcDataChannelLike): void {
    channels.set(lane, channel);
    laneStates[lane] = channel.readyState === 'open' ? 'open' : 'connecting';
    try {
      channel.binaryType = 'arraybuffer';
    } catch {
      /* a fake or an exotic stack may not allow it; only beam reads binary */
    }
    if (lane === 'beam') {
      try {
        channel.bufferedAmountLowThreshold = beamLowThreshold;
      } catch {
        /* diagnostics only */
      }
      listen(channel, 'bufferedamountlow', () => {
        pumpDrain();
      });
    }
    listen(channel, 'open', () => {
      onChannelOpen(lane, channel);
    });
    listen(channel, 'close', () => {
      laneStates[lane] = 'closed';
      recomputeConnection();
      publish();
    });
    listen(channel, 'error', () => {
      // Not fatal on its own: ICE decides whether the session is over (section 11.3).
      log('rtc-transport: data channel error', lane);
    });
    listen(channel, 'message', (event) => {
      receive(lane, event.data);
    });
    // The acceptor's channels can arrive already open: `ondatachannel` fires
    // after the channel exists, and on a fast local pair the `open` event
    // has already been and gone. Doing the work inline is the difference
    // between a session that starts and one that waits for an event that
    // will never fire again. It is NOT an either/or with the listener
    // above: Chrome dispatches `open` to it afterwards anyway, which is why
    // the announcement is latched per channel instead of trusted to run once.
    if (channel.readyState === 'open') {
      onChannelOpen(lane, channel);
      return;
    }
    recomputeConnection();
    publish();
  }

  function onChannelOpen(lane: RtcLane, channel: RtcDataChannelLike): void {
    if (closed) return;
    // Once per channel. Everything below is either idempotent in the value
    // (the lane state, `everConnected`, the republish) or explicitly
    // latched (`ready`), except `sendHello`, which would put a second
    // hello on the wire, and the inviter's hello carries the whole seed.
    // See `announced`.
    if (announced.has(channel)) return;
    announced.add(channel);
    laneStates[lane] = 'open';
    if (LANES.every((l) => laneStates[l] === 'open')) everConnected = true;
    recomputeConnection();
    publish();
    // The hello goes out before anything else on the lane, so a peer whose signalling
    // blob was too small for an op version still learns it before the first op (section 11.19).
    if (lane === 'ops') {
      sendHello();
      // ...and only NOW is this pairing a session. Announced before
      // `channel-open` so the ceremony has reached `connected` before any
      // session code reacts to the lane: the dialog's completion and the
      // first op are then in the order a reader expects.
      if (!readyEmitted) {
        readyEmitted = true;
        emitCeremony({ type: 'ready' });
      }
    }
    emit('channel-open', lane);
    if (lane === 'beam') pumpDrain();
  }

  function createChannels(conn: RtcPeerConnectionLike): boolean {
    for (const lane of LANES) {
      let channel: RtcDataChannelLike;
      try {
        channel = conn.createDataChannel(lane, CHANNEL_INIT[lane]);
      } catch (err) {
        log('rtc-transport: createDataChannel failed', errText(err));
        return false;
      }
      bindChannel(lane, channel);
    }
    return true;
  }

  function pumpDrain(): void {
    for (const fn of [...drainListeners]) {
      try {
        fn();
      } catch {
        /* a pull that throws must not stall the other pulls */
      }
    }
  }

  // ── the wire ───────────────────────────────────────────────────────────────────

  function writeText(lane: RtcLane, text: string): RtcSendResult {
    if (closed) return 'closed';
    const channel = channels.get(lane);
    if (!channel) return 'not-open';
    if (channel.readyState !== 'open') return 'not-open';
    if (exceedsFrameLimit(text)) return 'too-large';
    try {
      channel.send(text);
    } catch (err) {
      log('rtc-transport: send failed', errText(err));
      return 'not-open';
    }
    return 'sent';
  }

  function writeJson(lane: RtcLane, value: unknown): RtcSendResult {
    let text: string;
    try {
      text = JSON.stringify(value);
    } catch (err) {
      log('rtc-transport: frame is not serialisable', errText(err));
      return 'unserializable';
    }
    if (typeof text !== 'string') return 'unserializable';
    return writeText(lane, text);
  }

  /**
   * The in-band op-contract declaration (section 11.19, contract section 9) and the
   * session seed (section 6.1). The signalling blob is byte-starved (sized for a
   * QR), so neither is guaranteed a slot in it; the ops channel says both
   * in its first frame, which still lands before the first op, and that is
   * all either contract requires.
   *
   * A seed too big for one frame is DROPPED instead of being allowed to
   * fail the whole hello: an acceptor that gets no seed asks for the state
   * on connect, but one that gets no hello never learns the peer's op version.
   */
  function sendHello(): void {
    const seed = opts.seed;
    if (seed === undefined) {
      writeJson('ops', { t: 'hello', c: clientId, v: opVersion, h: historyProtocol });
      return;
    }
    const result = writeJson('ops', { t: 'hello', c: clientId, v: opVersion, h: historyProtocol, s: seed });
    if (result !== 'too-large' && result !== 'unserializable') return;
    log('rtc-transport: session seed did not fit the hello frame', seed.length);
    // The seed is what is dropped, never the op-version or history declarations: an
    // acceptor with no seed asks for state on connect, but one with no hello learns neither.
    writeJson('ops', { t: 'hello', c: clientId, v: opVersion, h: historyProtocol });
  }

  function receive(lane: RtcLane, data: unknown): void {
    if (closed) return;
    if (lane === 'beam' && typeof data !== 'string') {
      const bytes = toBytes(data);
      if (!bytes) {
        log('rtc-transport: unreadable binary beam frame');
        return;
      }
      emit('message', { lane: 'beam', kind: 'binary', bytes });
      return;
    }
    if (typeof data !== 'string') {
      log('rtc-transport: binary frame on a JSON lane', lane);
      return;
    }
    if (data.length > MAX_FRAME_BYTES) {
      log('rtc-transport: oversize inbound frame', lane);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      // Untrusted input: a peer's malformed frame is dropped, never thrown (section 11.21).
      log('rtc-transport: unparsable frame', lane);
      return;
    }
    if (lane === 'presence') {
      const frame = parsePresenceFrame(parsed);
      if (!frame) {
        log('rtc-transport: malformed presence frame');
        return;
      }
      emit('message', { lane: 'presence', kind: 'presence', frame });
      return;
    }
    if (lane === 'beam') {
      emit('message', { lane: 'beam', kind: 'json', json: parsed });
      return;
    }
    if (!isRecord(parsed)) {
      log('rtc-transport: ops frame is not an envelope');
      return;
    }
    if (parsed.t === 'hello') {
      const peerId = typeof parsed.c === 'string' ? parsed.c : undefined;
      const peerOpVersion = typeof parsed.v === 'string' ? parsed.v : undefined;
      const peerHistory = typeof parsed.h === 'string' && parsed.h.length > 0 ? parsed.h : undefined;
      // The seed is a packed URL fragment from a stranger (section 11.21): typed here, and
      // validated where it is applied - the same rule any shared lolly link follows.
      const peerSeed = typeof parsed.s === 'string' && parsed.s.length > 0 ? parsed.s : undefined;
      emit('message', { lane: 'ops', kind: 'hello', clientId: peerId, opVersion: peerOpVersion, history: peerHistory, seed: peerSeed });
      if (peerOpVersion) emitCeremony({ type: 'peer-op-version', opVersion: peerOpVersion });
      return;
    }
    if (parsed.t === 'op') {
      emit('message', { lane: 'ops', kind: 'op', op: parsed.d });
      return;
    }
    // An unknown envelope from a newer peer is ignored, not fatal (section 11.19).
    log('rtc-transport: unknown ops envelope', parsed.t);
  }

  // A DataChannel payload, not an AudioSource: every ArrayBufferView is viewed
  // in place (no copy), and everything else is null rather than a throw.
  function toBytes(data: unknown): Uint8Array | null {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return null;
  }

  // ── the ceremony effects (section 6.1) ────────────────────────────────────────────────

  /**
   * Wait for non-trickle gathering, bounded. On expiry the blob is minted
   * with whatever has been gathered. See the header: a LAN pair's host
   * candidates are already in, and the outstanding srflx lookup is never
   * coming back on a network with no route out.
   */
  function waitForGathering(): Promise<'complete' | 'timeout'> {
    const conn = pc;
    if (!conn) return Promise.resolve('timeout');
    if (gathering === 'complete' || conn.iceGatheringState === 'complete') {
      markGatherComplete();
      return Promise.resolve('complete');
    }
    return new Promise((resolve) => {
      let settled = false;
      let timer: unknown = null;
      const waiter = (result: 'complete' | 'timeout'): void => {
        if (settled) return;
        settled = true;
        stopTimer(timer);
        resolve(result);
      };
      gatherWaiters.push(waiter);
      timer = startTimer(gatherTimeoutMs, () => {
        if (settled) return;
        settled = true;
        gatherWaiters = gatherWaiters.filter((fn) => fn !== waiter);
        // Not a failure: mint with what we have (see the header). A LAN pair's
        // host candidates are already in; the outstanding lookup is a STUN
        // round trip that this network is never going to complete.
        if (gathering !== 'complete') {
          gathering = 'timed-out';
          publish();
        }
        resolve('timeout');
      });
    });
  }

  function localSdp(): string | null {
    const description = pc?.localDescription;
    const sdp = description?.sdp;
    return typeof sdp === 'string' && sdp.length > 0 ? sdp : null;
  }

  async function mintBlob(kind: 'invite' | 'answer'): Promise<{ ok: true; token: string } | { ok: false; detail: string }> {
    await waitForGathering();
    const sdp = localSdp();
    if (!sdp) return { ok: false, detail: 'no local description after gathering' };
    const material = extract(sdp);
    if (!material.ok) return { ok: false, detail: material.reason };
    localCandidates = material.value.candidates.length;
    // The fingerprint we are about to PUT ON THE WIRE, which is the one the
    // peer will validate our certificate against, so it is the one the
    // plate must be derived from.
    localFingerprint = material.value.fingerprint.bytes;
    publish();
    const payload =
      kind === 'invite'
        ? { kind: 'invite' as const, material: material.value, invite: inviteMeta() }
        : { kind: 'answer' as const, material: material.value };
    const token = encodePayload(payload, skin);
    if (!token.ok) return { ok: false, detail: token.reason };
    return { ok: true, token: token.value };
  }

  /**
   * The chosen display name AT MINT TIME. Read through the thunk on every
   * call instead of snapshotted at construction: the acceptor builds its
   * transport for the tool probe and only then asks the human what to be
   * called, so a cached value would put the profile prefill on the wire
   * and silently discard what they typed (section 4.5, section 11.23).
   */
  function selfName(): string | undefined {
    const name = opts.self?.name;
    const resolved = typeof name === 'function' ? name() : name;
    const trimmed = (resolved ?? '').trim();
    return trimmed === '' ? undefined : trimmed;
  }

  function inviteMeta(): InviteMeta {
    const tool = opts.tool;
    return {
      v: SDP_CODEC_VERSION,
      toolId: tool?.id ?? '',
      toolVersion: tool?.version ?? UNKNOWN_VERSION,
      engineVersion: tool?.engineVersion ?? UNKNOWN_VERSION,
      name: selfName(),
      colorIndex: opts.self?.colorIndex,
      opVersion,
    };
  }

  const effects: RtcCeremonyEffects = {
    /**
     * The ceremony's level read (`CeremonyEffects.iceState`): what ICE is
     * RIGHT NOW, asked on entering a phase whose only exits are ICE
     * events. `ice` and not `lastEmittedIce`, because the question is
     * about the connection and not about what this module has already
     * said; they differ only inside `observeIce`, which is synchronous and
     * cannot be observed from here.
     *
     * A closed transport reports `'closed'` (or the `'failed'` it died
     * of), which the ceremony reads as the end it is, never as a pair
     * still forming.
     */
    iceState() {
      return ice;
    },

    /**
     * The ceremony's OTHER level read: is the session-critical lane open on this side?
     *
     * This is the question `ceremony.ts` gates `connected` on, asked on
     * entering a phase whose only good exit is the pair becoming usable. It
     * reads the lane, not the `readyEmitted` latch, because it answers
     * about the connection as it is now: a lane that has since closed is
     * not ready, whatever was announced earlier.
     *
     * A closed transport is never ready.
     */
    channelsReady() {
      return !closed && laneStates.ops === 'open';
    },

    /**
     * The pairing's two DTLS fingerprints, or `null`: the level read
     * behind the plate.
     *
     * Both or neither: a plate over half a pair is a confident number
     * about nothing, and the ceremony's rule is to show nothing rather
     * than something wrong. A closed transport describes no pairing,
     * exactly as `channelsReady` reports no readiness.
     *
     * Copies, not the stored arrays. A caller only reads these, but they
     * are the pairing's trust root and a diagnostic accessor has no
     * business handing out a mutable handle to one; the cost is 64 bytes,
     * on a call that happens once per connection.
     */
    plateMaterial() {
      if (closed || !localFingerprint || !remoteFingerprint) return null;
      return { local: Uint8Array.from(localFingerprint), remote: Uint8Array.from(remoteFingerprint) };
    },

    async createOffer(req) {
      if (closed) return { ok: false, detail: 'transport closed' };
      if (!ctor) return { ok: false, detail: 'this device has no WebRTC' };
      if (!opts.tool?.id) return { ok: false, detail: 'no tool declared for the invite' };
      const conn = newPeerConnection();
      if (!conn) return { ok: false, detail: 'could not open a peer connection' };
      // The channels must exist BEFORE the offer: an m=application section
      // only appears in the SDP once there is something to carry, and the
      // acceptor's `ondatachannel` is how it ever sees these three (section 6.2).
      if (!createChannels(conn)) return { ok: false, detail: 'could not open the data channels' };
      try {
        const offer = await conn.createOffer();
        await conn.setLocalDescription(offer);
      } catch (err) {
        return { ok: false, detail: errText(err) };
      }
      const blob = await mintBlob('invite');
      if (!blob.ok) return { ok: false, detail: blob.detail };
      log('rtc-transport: invite minted', { attempt: req.attempt, candidates: localCandidates });
      const tool = opts.tool;
      return {
        ok: true,
        invite: {
          signal: blob.token,
          toolId: tool.id,
          toolVersion: tool.version ?? UNKNOWN_VERSION,
          engineVersion: tool.engineVersion ?? UNKNOWN_VERSION,
          opVersion,
          name: selfName(),
          colour: opts.self?.colour,
          seed: opts.seed,
        },
      };
    },

    async createAnswer(invite) {
      if (closed) return { ok: false, detail: 'transport closed' };
      if (!ctor) return { ok: false, detail: 'this device has no WebRTC' };
      // Sniffed rather than assumed: the acceptor's own `skin` option says
      // how IT will dress the reply, and says nothing about how the invite
      // arrived (a link pasted into a device set up to scan is the
      // ordinary case, not an error).
      const decoded = decodePayload(invite.signal, 'auto');
      if (!decoded.ok) return { ok: false, detail: decoded.reason };
      if (decoded.value.kind !== 'invite') return { ok: false, detail: 'that token is not an invite' };
      const remote = reconstruct(decoded.value.material, 'offer');
      if (!remote.ok) return { ok: false, detail: remote.reason };
      const conn = newPeerConnection();
      if (!conn) return { ok: false, detail: 'could not open a peer connection' };
      remoteCandidates = decoded.value.material.candidates.length;
      // AFTER `newPeerConnection`, which clears both latches: written
      // first, it would be wiped by the reset that follows it and the
      // acceptor would never have a plate.
      remoteFingerprint = decoded.value.material.fingerprint.bytes;
      remoteApplied = true;
      try {
        // `ondatachannel` is already wired by `newPeerConnection`, so the three channels
        // are caught the moment the remote description names them (section 6.2).
        await conn.setRemoteDescription({ type: 'offer', sdp: remote.value });
        const answer = await conn.createAnswer();
        await conn.setLocalDescription(answer);
      } catch (err) {
        return { ok: false, detail: errText(err) };
      }
      const blob = await mintBlob('answer');
      if (!blob.ok) return { ok: false, detail: blob.detail };
      return {
        ok: true,
        answer: {
          signal: blob.token,
          opVersion,
          name: selfName(),
          colour: opts.self?.colour,
        },
      };
    },

    async applyRemote(answer) {
      if (closed) return { ok: false, detail: 'transport closed' };
      const conn = pc;
      if (!conn) return { ok: false, detail: 'no local connection to apply an answer to' };
      const decoded = decodePayload(answer.signal, 'auto');
      // section 11.25: an unreadable reply is a step the humans repeat, not a ceremony that
      // ends. Only a local stack failure below is non-retryable.
      if (!decoded.ok) return { ok: false, retryable: true, detail: decoded.reason };
      if (decoded.value.kind !== 'answer') {
        return { ok: false, retryable: true, detail: 'that token is an invite, not a reply' };
      }
      const remote = reconstruct(decoded.value.material, 'answer');
      if (!remote.ok) return { ok: false, retryable: true, detail: remote.reason };
      remoteCandidates = decoded.value.material.candidates.length;
      remoteFingerprint = decoded.value.material.fingerprint.bytes;
      remoteApplied = true;
      try {
        await conn.setRemoteDescription({ type: 'answer', sdp: remote.value });
      } catch (err) {
        return { ok: false, detail: errText(err) };
      }
      publish();
      return { ok: true };
    },
  };

  // ── the beam lane ──────────────────────────────────────────────────────────────

  function sendBeam(payload: { readonly json: unknown } | { readonly bytes: Uint8Array }): RtcSendResult {
    if ('json' in payload) return writeJson('beam', payload.json);
    const bytes = payload.bytes;
    if (closed) return 'closed';
    const channel = channels.get('beam');
    if (!channel || channel.readyState !== 'open') return 'not-open';
    if (bytes.byteLength > MAX_FRAME_BYTES) return 'too-large';
    try {
      channel.send(bytes);
    } catch (err) {
      log('rtc-transport: beam send failed', errText(err));
      return 'not-open';
    }
    return 'sent';
  }

  const beam: RtcBeamLane = {
    json(message) {
      const result = sendBeam({ json: message });
      if (result !== 'sent') log('rtc-transport: beam control frame not sent', result);
    },
    binary(bytes) {
      const result = sendBeam({ bytes });
      if (result !== 'sent') log('rtc-transport: beam payload frame not sent', result);
    },
    onDrain(pull) {
      drainListeners.add(pull);
      return () => {
        drainListeners.delete(pull);
      };
    },
    bufferedAmount() {
      return channels.get('beam')?.bufferedAmount ?? 0;
    },
    lowThreshold: beamLowThreshold,
    isOpen() {
      return channels.get('beam')?.readyState === 'open';
    },
  };

  // ── public surface ─────────────────────────────────────────────────────────────

  function close(): void {
    if (closed) return;
    closed = true;
    clearTimers();
    disposePeer();
    connection = 'closed';
    ice = ice === 'failed' ? 'failed' : 'closed';
    publish();
    listeners.message.clear();
    listeners.state.clear();
    listeners['channel-open'].clear();
    ceremonyListeners.clear();
    drainListeners.clear();
  }

  return {
    role,
    clientId,
    effects,
    state,
    sendOp(op) {
      return writeJson('ops', { t: 'op', d: op });
    },
    sendPresence(frame) {
      // Only an unstamped frame is stamped: `PresenceEngine.snapshot()` relays other
      // peers' frames verbatim, and re-numbering those would break the join handshake.
      const from = frame.from ?? clientId;
      const seq = frame.seq ?? (presenceSeq += 1);
      const out: PresenceFrame = { from, seq, state: frame.state, away: frame.away === true };
      return writeJson('presence', out);
    },
    sendBeam,
    beam,
    on(type, fn) {
      const set = listeners[type] as Set<typeof fn>;
      set.add(fn);
      return () => {
        set.delete(fn);
      };
    },
    onCeremonyEvent(fn) {
      // Registered BEFORE the replay: if the replayed state makes this subscriber do
      // something that moves ICE again, it should hear that too. The other order would
      // give it the stale value and silently drop the live one.
      ceremonyListeners.add(fn);
      replayCeremony(fn);
      return () => {
        ceremonyListeners.delete(fn);
      };
    },
    close,
  };
}
