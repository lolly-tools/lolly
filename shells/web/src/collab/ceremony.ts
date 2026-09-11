// SPDX-License-Identifier: MPL-2.0
/**
 * ceremony - the private-collab pairing state machine (plan 100 section 6.1, section 6.2a, wave 2.2).
 *
 * PURE LOGIC. This module owns the *order of events* in a Track-A pairing and nothing
 * else: no DOM, no `RTCPeerConnection`, no codec, no timers of its own. Everything that
 * touches a platform arrives injected - the four effects (`createOffer`, `checkTool`,
 * `createAnswer`, `applyRemote`) and the two timer functions. That is what makes the
 * whole ceremony testable at fake-time speed with stub effects, which matters more here
 * than almost anywhere else in the shell: the failure modes this machine exists to model
 * (a ten-minute unanswered invite, a laptop lid closing, a guest network eating peer
 * traffic) are exactly the ones you cannot reproduce by hand.
 *
 * The dialogs (wave 2.2's UI half), the SDP mini-codec (2.1) and the RTC provider (2.3)
 * sit AROUND it: the codec turns a `CollabInvite` into the ~100-byte blob a QR carries
 * and back, the provider owns the peer connection and feeds `{ type: 'ice' }` events in,
 * the dialogs render `state.phase` and call `send()`. Signals cross this boundary as
 * DECODED envelopes on purpose - a blob that does not decode is the dialog's problem
 * ("that reply isn't readable, try again") and must not end a ceremony, so it never
 * becomes an event here.
 *
 * ── The two paths (section 6.1) ──────────────────────────────────────────────────────────
 *
 *   inviter:  idle → creating-invite → awaiting-answer ⇄(re-arm) → applying-answer
 *                                                                → connecting → connected
 *             connected --ICE failed--> reconnect-armed → (answer) → applying-answer → …
 *
 *   acceptor: idle → reading-invite → creating-answer → awaiting-connection → connected
 *
 * Terminal is `failed` (with a cause the UI turns into specific copy, section 11.26) or
 * `closed` (the user cancelled). `reconnect-armed` is NOT terminal - it is the inviter
 * holding a freshly minted re-invite, because a dropped WebRTC connection can never be
 * resumed and always needs a fresh ceremony (section 6.1); pre-minting the offer the moment the
 * old one dies is what makes the session card's "Reconnect" QR feel pre-armed.
 *
 * ── Why the acceptor probes before answering (section 6.1) ───────────────────────────────
 *
 * A private collab requires the tool on BOTH devices: peers send values, never code
 * (section 11.22), so the template and hooks always come from the local catalog. `checkTool`
 * answers `have` / `missing` / `version-skew`, and `missing` is an honest terminal
 * refusal at accept time rather than a join that renders nothing.
 *
 * ── The two version axes (deliberately different outcomes) ────────────────────────
 *
 *  1. TOOL version (probed): a MAJOR skew means the two catalogs disagree about what the
 *     input ids mean, so the ops would land on the wrong fields → terminal refusal
 *     (`version-major-mismatch`). A minor skew is a soft note (`toolVersionNote`), section 11.19.
 *  2. OP-CONTRACT version (`CANVAS_OP_VERSION`): a major mismatch is NOT a refusal - 
 *     contract section 9 says the client joins OBSERVER-ONLY rather than corrupting state, so
 *     `state.observerOnly` is set and the pair still connects. Both peers set the flag on
 *     themselves, which is the symmetric, safe outcome. Either envelope MAY carry the
 *     peer's version; when the byte-starved signalling payload does not, the ops
 *     channel's hello declares it through the `peer-op-version` event instead, which
 *     still lands before the first op. Undeclared is silence, never an assumed gap.
 *
 * ── What "connected" MEANS: channels ready, never ICE connected ───────────────────
 *
 * `connected` is entered on one signal and one only: `{ type: 'ready' }`, the transport
 * reporting that the ops channel - the session-critical lane - is open on this side.
 *
 * ICE reaching `connected` is NOT that, and the difference is a shipped bug, not a
 * nicety. A data channel opens only after BOTH descriptions have been applied, which is
 * the entire ceremony completing; ICE `connected` means a candidate pair answered a
 * binding request, which on a loopback/LAN pair Chrome reports BEFORE the answer has been
 * carried back to the inviter at all (pre-answer connectivity via peer-reflexive checks).
 * Gate the phase on ICE and the acceptor is promoted out of `awaiting-connection` in the
 * same synchronous turn it entered it: step 3 never renders, the reply the inviter is
 * waiting for is never deliverable, and the inviter waits for ever. Drill evidence: the
 * answer screen's copy control never appeared, `replyLeg='none'`, inviter stuck on step 2.
 * The original trace says the same thing from the other end - `ice:connected` at 542ms,
 * both sides' channels open at 1269ms. Those 727ms are the ceremony.
 *
 * So ICE keeps every OTHER job and loses exactly one: `failed`/`closed` still ends the
 * ceremony with the isolation diagnosis, `disconnected` still raises the transient
 * `reconnecting` flag, `checking` still arms the connect watchdog - and an ICE
 * `connected` on its own now changes no phase anywhere.
 *
 * ── The publish-before-promote guarantee (section 11.25) ─────────────────────────────────
 *
 * A promotion may never SKIP a step a human has to act on. The acceptor's answer must be
 * published and rendered before anything can move it to `connected`, and the inviter's
 * wait may not be skipped past applying a real answer. Both fall out of one rule: `ready`
 * promotes only from `connecting` (inviter, entered after `applyRemote` succeeded) and
 * `awaiting-connection` (acceptor, entered with `state.answer` already set and notified).
 * A `ready` that arrives in any earlier phase is LATCHED, not dropped and not acted on - 
 * it is re-read on entering one of those two phases, after that phase has been published.
 * In practice a transport cannot report ready that early; the latch is what makes that a
 * property of this machine rather than a property of the transport being well behaved.
 *
 * ── Both surfaces are read level-triggered on entry, not only edge-triggered ───────
 *
 * The transport's events are EDGE-triggered: one notification per transition, and only
 * the phase the machine happens to be in when it lands can act on it. Two phases can only
 * ever be LEFT WELL by such an event - `awaiting-connection` (acceptor) and `connecting`
 * (inviter); every other way out of them is a deadline expiring, which is to say a
 * failure. And both are entered from inside an `await` that the transitions can, and on a
 * LAN routinely do, land during. `setLocalDescription` returns and ~5ms later ICE has
 * already gone `checking` → `connected`, while this machine is still sitting in
 * `creating-answer` (or `applying-answer`) waiting for the effect that started it. Those
 * edges arrive, match no phase that acts on them, and are dropped. Nothing looks again,
 * so a pair whose channels are open on both sides sits on the answer screen until the
 * ten-minute human deadline.
 *
 * So on ENTERING either phase the machine asks the transport what things ARE - ICE via
 * `CeremonyEffects.iceState`, the lane via `CeremonyEffects.channelsReady` - and runs
 * each answer through the same path a live event takes (`syncIce` → `onIce`, `syncReady`
 * → `onReady`). One pair of helpers, both roles, no special case: the inviter's version
 * of the race is identical in shape and merely wins by a couple of milliseconds today,
 * which is not a property worth depending on. ICE is read FIRST, so a pairing that died
 * during the mint fails rather than completing.
 *
 * `rtc-transport.ts` replaying its last emitted state to a new subscriber is the other
 * half of the guard, and the two do NOT overlap - they cover the two distinct ways these
 * signals go missing, which is why both exist:
 *
 *   - the edge was HEARD and dropped, because the phase it landed in does not act on it
 *     → the level read on entry, here (and the `ready` latch, for an effects bundle that
 *     has no level read to offer);
 *   - the edge was never heard at all, because nobody was subscribed yet → the replay,
 *     there. A machine wired up after its transport already connected (a dialog
 *     restart, the `#/join-reply` handoff) has no edge to have mistimed.
 *
 * Neither subsumes the other; together, a transition that was not acted on is always
 * re-presented, and the class stops being reachable. They are safe to stack because both
 * land on `onIce`/`onReady`, which are idempotent in the value (see `syncIce`).
 *
 * ── `disconnected` is not death (section 11.3) ───────────────────────────────────────────
 *
 * ICE `disconnected` self-heals in seconds on a UDP blip, so it only raises the transient
 * `reconnecting` flag: no timer, no state change, no re-pair UI (presence greys the
 * avatar, it does not evict). Only `failed`/`closed` is fatal - and then only the inviter
 * arms a re-invite, because the inviter owns the session and is the authoritative
 * continuation (section 6.2a); the acceptor's copy is ephemeral, so its drop ends in
 * `connection-lost` and its way back is scanning the inviter's fresh invite.
 *
 * No wall clock anywhere: every deadline is a delta handed to the injected timers, so a
 * device with a wrong clock (the airgap case, section 11.7) behaves identically.
 */

import { CANVAS_OP_VERSION, isCompatibleOpVersion } from '@lolly-tools/core/canvas-op-v1';

// ── Roles, phases, causes ──────────────────────────────────────────────────────────

/** Who this machine is acting for. The pair is asymmetric on purpose (section 6.2a). */
export type CeremonyRole = 'inviter' | 'acceptor';

/**
 * Every state the ceremony can be in. Each maps to one screen of the dialog (section 11.26 - 
 * "ceremony states need first-class UI"), which is why the in-flight ones are named
 * separately rather than collapsed into a boolean.
 */
export type CeremonyPhase =
  /** Nothing started. */
  | 'idle'
  /** inviter: minting the offer (non-trickle ICE gathering happens here). */
  | 'creating-invite'
  /** inviter: the invite exists and the human is delivering it; re-arms every 10 min. */
  | 'awaiting-answer'
  /** inviter: an answer arrived and is being applied. */
  | 'applying-answer'
  /** inviter: descriptions exchanged, ICE is negotiating. */
  | 'connecting'
  /** acceptor: decoding done, probing the local catalog for the tool. */
  | 'reading-invite'
  /** acceptor: minting the answer. */
  | 'creating-answer'
  /** acceptor: the answer exists and the human is delivering it back; then the channels. */
  | 'awaiting-connection'
  /** Both: the transport reports the ops channel OPEN - the pair can carry a session. */
  | 'connected'
  /** inviter: the connection died; a fresh invite is minted and waiting (section 6.1, section 11.3). */
  | 'reconnect-armed'
  /** Terminal: ended with a cause the UI turns into specific copy (section 11.26). */
  | 'failed'
  /** Terminal: the user closed it. Not an error - never show failure copy for this. */
  | 'closed';

/**
 * Why a ceremony ended. Distinct causes, not one "it broke" - section 11.26 asks for specific
 * copy per cause, and the difference between "this network blocks device-to-device
 * traffic" and "your invite went unanswered" is the difference between a support ticket
 * and a shrug.
 */
export type CeremonyEndCause =
  /** The acceptor does not have the tool. Honest refusal at accept time (section 6.1). */
  | 'tool-missing'
  /** The two catalogs hold incompatible MAJOR versions of the tool (see header). */
  | 'version-major-mismatch'
  /**
   * ICE reported `failed`, or never got anywhere before the connect watchdog expired,
   * having NEVER connected. On a LAN that is overwhelmingly Wi-Fi client isolation or
   * blocked mDNS (section 11.1, section 11.2) - the copy should say so and suggest a hotspot or wire,
   * not blame the invite.
   */
  | 'ice-failed-isolation-suspected'
  /** A live connection died (section 11.3). Different copy from never having connected. */
  | 'connection-lost'
  /** A human leg ran out of time: the invite went unanswered, or an effect hung. */
  | 'timeout'
  /** The local WebRTC stack refused (no WebRTC, permission, malformed local state). */
  | 'local-rtc-failed'
  /** The user cancelled. Only ever appears on `closed`. */
  | 'cancelled';

/** True for the two phases nothing can leave. */
export function isCeremonyTerminal(phase: CeremonyPhase): boolean {
  return phase === 'failed' || phase === 'closed';
}

// ── The signals (logical form; the codec owns the bytes) ───────────────────────────

/**
 * The identity that crosses the wire - chosen, never leaked (section 11.23). Both fields are
 * optional because the QR budget is real: `sdp-codec.ts` makes the name optional and
 * carries the colour as a palette index, so an anonymous pair is a legitimate outcome
 * and the UI needs a "someone" fallback either way.
 */
export interface CollabPeer {
  /** Display name, defaulting to profile firstname but editable at ceremony time. */
  readonly name?: string;
  /** Collaborator colour hint; the receiving shell may re-derive it instead (section 4.4). */
  readonly colour?: string;
}

/**
 * The invite payload (section 6.1), in logical form. The mini-codec (wave 2.1) is what squeezes
 * `signal` to the QR budget; everything else is small metadata the acceptor needs BEFORE
 * it answers.
 */
export interface CollabInvite extends CollabPeer {
  /** The connection blob: DTLS fingerprint + ICE ufrag/pwd + host candidates. */
  readonly signal: string;
  /** The tool both devices must have (section 6.1). */
  readonly toolId: string;
  /** The inviter's copy of the tool, for the skew check. */
  readonly toolVersion?: string;
  /** The inviter's engine version - a soft note only (section 11.19). */
  readonly engineVersion?: string;
  /**
   * The inviter's `CANVAS_OP_VERSION` (contract section 9 → observer-only on a major gap).
   * OPTIONAL because the signalling payload is byte-starved and may not carry it: when
   * it is absent the machine assumes compatibility and the in-band hello settles it via
   * the `peer-op-version` event, which lands before the first op either way.
   */
  readonly opVersion?: string;
  /** Packed `z`-param session seed, or absent for "you'll receive it on connect". */
  readonly seed?: string;
}

/** The reply leg (section 11.25 - the weak point, which is why it is a first-class payload). */
export interface CollabAnswer extends CollabPeer {
  /** The acceptor's connection blob. */
  readonly signal: string;
  /** The acceptor's `CANVAS_OP_VERSION`; optional for the same reason as the invite's. */
  readonly opVersion?: string;
}

// ── Injected effects (typed results, never thrown control flow) ────────────────────

/** What the acceptor asks its local catalog about the invited tool. */
export interface ToolProbeRequest {
  readonly toolId: string;
  readonly toolVersion?: string;
  readonly engineVersion?: string;
}

/**
 * The probe's answer. `version-skew` carries its own severity because the two outcomes
 * are opposite: a major skew refuses, a minor skew connects with a note.
 */
export type ToolProbeResult =
  | { readonly status: 'have' }
  | { readonly status: 'missing' }
  | { readonly status: 'version-skew'; readonly severity: 'major' | 'minor'; readonly localVersion?: string };

/** `ok: false` is a refusal with a diagnostic, not an exception. */
export type CreateOfferResult =
  | { readonly ok: true; readonly invite: CollabInvite }
  | { readonly ok: false; readonly detail?: string };

export type CreateAnswerResult =
  | { readonly ok: true; readonly answer: CollabAnswer }
  | { readonly ok: false; readonly detail?: string };

/**
 * Applying the peer's answer. `retryable` is the section 11.25 concession: a mis-scanned or
 * truncated reply must send the inviter back to waiting with a note, NOT end a ceremony
 * the humans are still working. Everything else is a local stack failure.
 */
export type ApplyRemoteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly retryable?: boolean; readonly detail?: string };

export interface CeremonyEffects {
  /** Mint an invite. `attempt` counts re-arms, for the transport's own logging. */
  createOffer(req: { readonly attempt: number }): Promise<CreateOfferResult>;
  /** Probe the local catalog before answering (section 6.1). Acceptor only. */
  checkTool(req: ToolProbeRequest): Promise<ToolProbeResult>;
  /** Take the remote offer and mint the answer. Acceptor only. */
  createAnswer(invite: CollabInvite): Promise<CreateAnswerResult>;
  /** Apply the peer's answer to the local connection. Inviter only. */
  applyRemote(answer: CollabAnswer): Promise<ApplyRemoteResult>;
  /**
   * What is the transport's ICE state RIGHT NOW? The level read behind the header's
   * "ICE is read level-triggered on entry" - asked on entering `awaiting-connection`
   * and `connecting`, and processed through the same `onIce` path a live event takes.
   *
   * OPTIONAL, and additive on purpose. Effects written before it (and every stub that
   * only needs the four legs) keep working unchanged: with the method absent the
   * machine behaves exactly as it did, and the transport's replay-on-subscribe covers
   * the same window from the other side.
   *
   * `undefined` means "cannot say" and is treated as `new` - no transition. It must not
   * throw; a thrown read is swallowed and treated the same way, because a transport
   * that cannot answer a diagnostic question has not failed the ceremony.
   */
  iceState?(): CeremonyIceState | undefined;
  /**
   * Is the session-critical lane (the ops data channel) OPEN on this side RIGHT NOW?
   *
   * The level read behind `{ type: 'ready' }`, and the only thing that completes a
   * pairing - see the header's "What 'connected' MEANS". Asked on entering
   * `awaiting-connection` and `connecting`, immediately after `iceState`, and processed
   * through the same `onReady` path a live event takes.
   *
   * OPTIONAL and additive for the same reasons `iceState` is: a stub that only implements
   * the four legs keeps working, and the edge event plus the transport's replay cover the
   * same window from the other side. Anything but `true` - including `undefined` and a
   * thrown read - means "not ready", which is never a failure, only a not-yet.
   */
  channelsReady?(): boolean | undefined;
}

// ── Injected time ──────────────────────────────────────────────────────────────────

export type CeremonyTimerHandle = unknown;

/** The two timer functions, injected so tests run a whole ten-minute re-arm instantly. */
export interface CeremonyTimers {
  setTimeout(fn: () => void, ms: number): CeremonyTimerHandle;
  clearTimeout(handle: CeremonyTimerHandle): void;
}

const REAL_TIMERS: CeremonyTimers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  },
};

/** How long an invite (or an answer awaiting delivery) stays live before re-arming (section 6.1). */
export const ANSWER_WAIT_MS = 10 * 60_000;
/** How long ICE gets to connect once both descriptions exist, before isolation is suspected. */
export const CONNECT_WATCHDOG_MS = 45_000;
/** Budget for one injected effect. Non-trickle ICE gathering with no reachable STUN
 *  simply waits, so the mint legs need a ceiling of their own. */
export const EFFECT_BUDGET_MS = 20_000;
/**
 * How many times the answer leg may be re-armed before the ceremony gives up.
 *
 * Both re-arm paths spend it: the ten-minute timer that re-mints an unanswered
 * invite, and an answer that came back unreadable (section 11.25), which restarts the same
 * wait. Counting only the first would leave an invite's lifetime unbounded - one
 * garbled paste every nine minutes holds the offer open for ever.
 */
export const MAX_REARMS = 2;

// ── State ──────────────────────────────────────────────────────────────────────────

export interface CeremonyState {
  readonly role: CeremonyRole;
  readonly phase: CeremonyPhase;
  /** The invite this side minted (inviter) or received (acceptor), once known. */
  readonly invite?: CollabInvite;
  /** The answer minted (acceptor) or accepted (inviter). */
  readonly answer?: CollabAnswer;
  /** The other side's chosen identity, as soon as a payload carries it. */
  readonly peer?: CollabPeer;
  /** How much of the answer leg's budget is spent (section 6.1) - a re-mint after ten
   *  unanswered minutes, or an answer that came back unreadable, each cost one.
   *  Reset to 0 the moment the pair connects. See {@link MAX_REARMS}. */
  readonly rearms: number;
  /** An invite mint is in flight - the QR/link is not ready to show yet. */
  readonly arming: boolean;
  /** ICE said `disconnected`: transient, grey the avatar, do NOT re-pair (section 11.3). */
  readonly reconnecting: boolean;
  /** Has this ceremony ever been live? Changes the copy on a late failure. */
  readonly everConnected: boolean;
  /** Op-contract major mismatch → join, but send no ops (contract section 9, section 11.19). */
  readonly observerOnly: boolean;
  /** Minor tool skew: connect, and say "you're on different versions" (section 11.19). */
  readonly toolVersionNote?: 'minor-skew';
  /** Set when a retryable answer was rejected, so the dialog can say "try that again". */
  readonly retryNote?: string;
  /** Terminal only. */
  readonly cause?: CeremonyEndCause;
  /** Terminal only: a diagnostic for logs, never user copy. */
  readonly detail?: string;
}

// ── Events ─────────────────────────────────────────────────────────────────────────

/** ICE transport states, structurally `RTCIceConnectionState` (kept DOM-free here). */
export type CeremonyIceState =
  | 'new'
  | 'checking'
  | 'connected'
  | 'completed'
  | 'disconnected'
  | 'failed'
  | 'closed';

export type CeremonyEvent =
  /** inviter: start, or re-mint the invite right now. */
  | { readonly type: 'invite' }
  /** acceptor: a decoded invite arrived (link, paste, QR scan, share sheet). */
  | { readonly type: 'accept'; readonly invite: CollabInvite }
  /** inviter: a decoded answer arrived (paste, QR scan, `#/join-reply` handoff section 11.25). */
  | { readonly type: 'answer'; readonly answer: CollabAnswer }
  /**
   * Either: the peer declared its `CANVAS_OP_VERSION` in band (the ops-channel hello).
   * The escape hatch for signalling payloads too small to carry it - it recomputes
   * `observerOnly` and lands before the first op, which is all contract section 9 requires.
   */
  | { readonly type: 'peer-op-version'; readonly opVersion: string }
  /** Either: the peer connection's ICE state changed. */
  | { readonly type: 'ice'; readonly state: CeremonyIceState }
  /**
   * Either: the transport's session-critical lane is OPEN on this side.
   *
   * The one signal that completes a pairing (see the header). It carries no payload
   * because it is not a transition between values - a data channel opens once and the
   * transport emits this once per peer connection.
   */
  | { readonly type: 'ready' }
  /** Either: the user closed the ceremony. */
  | { readonly type: 'cancel' };

export interface CeremonyOptions {
  readonly role: CeremonyRole;
  readonly effects: CeremonyEffects;
  /** Defaults to the real global timers. */
  readonly timers?: CeremonyTimers;
  /** This device's op-contract version; defaults to the pinned `CANVAS_OP_VERSION`. */
  readonly localOpVersion?: string;
  readonly answerWaitMs?: number;
  readonly connectWatchdogMs?: number;
  readonly effectBudgetMs?: number;
  readonly maxRearms?: number;
}

export interface CeremonyMachine {
  /** The current state. Replaced wholesale on every change, so it diffs by identity. */
  readonly state: CeremonyState;
  /** Feed an event in. Unknown-for-this-role or out-of-phase events are ignored. */
  send(event: CeremonyEvent): void;
  /** Observe state. Returns an unsubscribe; a throwing subscriber cannot break the machine. */
  subscribe(fn: (state: CeremonyState) => void): () => void;
  /** Drop timers and subscribers without emitting. Not a state change - see `cancel`. */
  dispose(): void;
}

// ── The machine ────────────────────────────────────────────────────────────────────

export function createCeremony(opts: CeremonyOptions): CeremonyMachine {
  const role = opts.role;
  const effects = opts.effects;
  const timers = opts.timers ?? REAL_TIMERS;
  const localOpVersion = opts.localOpVersion ?? CANVAS_OP_VERSION;
  const answerWaitMs = opts.answerWaitMs ?? ANSWER_WAIT_MS;
  const connectWatchdogMs = opts.connectWatchdogMs ?? CONNECT_WATCHDOG_MS;
  const effectBudgetMs = opts.effectBudgetMs ?? EFFECT_BUDGET_MS;
  const maxRearms = opts.maxRearms ?? MAX_REARMS;

  const subscribers = new Set<(state: CeremonyState) => void>();
  const pending = new Set<CeremonyTimerHandle>();
  /**
   * Bumped by every phase change. An effect is TAGGED with the generation its phase
   * change returned (never with a re-read of this counter - see `setPhase`) and
   * discards its own result if it no longer matches, so a cancel, a timeout or an ICE
   * failure during a mint can never be undone by the late resolution of the work it
   * abandoned - including a cancel that arrives re-entrantly, from a subscriber
   * reacting to the very phase change that started the work.
   */
  let generation = 0;
  let disposed = false;
  /**
   * Has the transport reported its session-critical lane open for THIS pairing?
   *
   * The buffer behind the header's publish-before-promote guarantee: a `ready` that lands
   * in a phase which may not complete (the acceptor still minting its answer, the inviter
   * still waiting for one) is remembered rather than acted on or dropped, and re-read by
   * `syncReady` on entering a phase that may. Reset by every fresh mint - `startInvite`
   * and `onAccept` - because each of those is a new peer connection, and the transport
   * resets its own `readyEmitted` at exactly the same points.
   */
  let readyLatched = false;

  let state: CeremonyState = {
    role,
    phase: 'idle',
    rearms: 0,
    arming: false,
    reconnecting: false,
    everConnected: false,
    observerOnly: false,
  };

  function notify(): void {
    for (const fn of [...subscribers]) {
      try {
        fn(state);
      } catch {
        /* a subscriber's failure is its own; the machine keeps its state */
      }
    }
  }

  function patch(next: Partial<CeremonyState>): void {
    state = { ...state, ...next };
    notify();
  }

  function clearTimers(): void {
    for (const handle of pending) timers.clearTimeout(handle);
    pending.clear();
  }

  /** Is the phase that owns `gen` still the current one? */
  function live(gen: number): boolean {
    return !disposed && gen === generation;
  }

  function startTimer(gen: number, ms: number, fn: () => void): void {
    const handle = timers.setTimeout(() => {
      pending.delete(handle);
      if (!live(gen)) return;
      fn();
    }, ms);
    pending.add(handle);
  }

  /**
   * Every phase change abandons the previous phase's timers and in-flight effects.
   *
   * Returns the generation it established, and callers MUST tag the work they start
   * afterwards with that number rather than re-reading `generation`. `patch` notifies
   * synchronously, and a subscriber rendering `state.phase` can call `send()` from
   * inside that notification - a Cancel button wired straight to the new screen does
   * exactly that. The re-entrant event bumps the counter again, so work started after
   * the notify would otherwise capture the CANCELLED generation, look live to the
   * very guard that exists to abandon it, and resurrect a ceremony the user closed.
   */
  function setPhase(phase: CeremonyPhase, extra: Partial<CeremonyState> = {}): number {
    clearTimers();
    generation += 1;
    const gen = generation;
    patch({ phase, ...extra });
    return gen;
  }

  /**
   * Contract section 9: a MAJOR op-contract gap means observer-only, never a refusal. An
   * undeclared version is not a gap - it is silence, and the in-band hello answers it.
   */
  function observerOnlyFor(peerOpVersion: string | undefined): boolean {
    return peerOpVersion !== undefined && !isCompatibleOpVersion(peerOpVersion, localOpVersion);
  }

  function fail(cause: Exclude<CeremonyEndCause, 'cancelled'>, detail?: string): void {
    setPhase('failed', { cause, detail, arming: false, reconnecting: false });
  }

  interface RaceHandlers<T> {
    readonly onResult: (value: T) => void;
    readonly onExpired: () => void;
    /** A thrown effect is a hard local failure - effects are meant to return results. */
    readonly onThrew: (detail: string) => void;
  }

  /** `gen` is the phase this work belongs to - passed in, never re-read (see `setPhase`). */
  function race<T>(gen: number, work: Promise<T>, handlers: RaceHandlers<T>): void {
    let settled = false;
    const running = (): boolean => !settled && live(gen);
    startTimer(gen, effectBudgetMs, () => {
      if (!running()) return;
      settled = true;
      handlers.onExpired();
    });
    work.then(
      (value) => {
        if (!running()) return;
        settled = true;
        handlers.onResult(value);
      },
      (err: unknown) => {
        if (!running()) return;
        settled = true;
        handlers.onThrew(String(err));
      },
    );
  }

  // ── Inviter legs ────────────────────────────────────────────────────────────────

  /**
   * Mint an invite. `armed` distinguishes the first ceremony (`creating-invite` →
   * `awaiting-answer`) from a re-invite after a drop, which lives in `reconnect-armed`
   * throughout so the session card can keep showing one thing (section 6.1).
   */
  function startInvite(armed: boolean, attempt: number): void {
    // A mint is a NEW peer connection, so the previous pairing's readiness dies with it.
    // Cleared before the phase change, because that change notifies synchronously and a
    // subscriber may drive the machine straight back into this file.
    readyLatched = false;
    const gen = setPhase(armed ? 'reconnect-armed' : 'creating-invite', {
      arming: true,
      rearms: attempt,
      invite: undefined,
      answer: undefined,
      retryNote: undefined,
      observerOnly: false,
    });
    // A subscriber that cancelled from inside that notification has already ended
    // this ceremony; minting an offer for it would open a peer connection nobody can
    // use and nobody will close.
    if (!live(gen)) return;
    race(gen, effects.createOffer({ attempt }), {
      onResult: (res) => {
        if (!res.ok) {
          fail('local-rtc-failed', res.detail);
          return;
        }
        const next = setPhase(armed ? 'reconnect-armed' : 'awaiting-answer', { arming: false, invite: res.invite });
        if (!live(next)) return;
        armAnswerWait(armed, next);
      },
      onExpired: () => fail('timeout', 'the invite could not be minted in time'),
      onThrew: (detail) => fail('local-rtc-failed', detail),
    });
  }

  /** The 10-minute re-arm (section 6.1): a stale offer's candidates are worth less than a fresh one. */
  function armAnswerWait(armed: boolean, gen: number): void {
    startTimer(gen, answerWaitMs, () => {
      if (state.rearms >= maxRearms) {
        fail('timeout', 'the invite went unanswered');
        return;
      }
      startInvite(armed, state.rearms + 1);
    });
  }

  function onInvite(): void {
    if (role !== 'inviter') return;
    if (state.phase === 'idle' || state.phase === 'awaiting-answer') {
      startInvite(false, 0);
      return;
    }
    if (state.phase === 'reconnect-armed') startInvite(true, 0);
  }

  function onAnswer(answer: CollabAnswer): void {
    if (role !== 'inviter') return;
    if (state.phase !== 'awaiting-answer' && state.phase !== 'reconnect-armed') return;
    if (!state.invite) return;
    const armed = state.phase === 'reconnect-armed';
    const gen = setPhase('applying-answer', {
      answer,
      peer: { name: answer.name, colour: answer.colour },
      observerOnly: observerOnlyFor(answer.opVersion),
      retryNote: undefined,
    });
    if (!live(gen)) return;
    race(gen, effects.applyRemote(answer), {
      onResult: (res) => {
        if (res.ok) {
          const next = setPhase('connecting');
          if (!live(next)) return;
          startTimer(next, connectWatchdogMs, () => fail('ice-failed-isolation-suspected', 'connect watchdog'));
          // ICE, and on a fast pair the channels too, can have run the whole way inside
          // the `applyRemote` above - this phase is entered AFTER the transitions it
          // waits for. Same reads the acceptor does, deliberately not a special case:
          // this leg loses the race by about two milliseconds rather than not having it.
          // ICE first, so a pairing that died mid-apply fails instead of completing.
          syncIce(next);
          syncReady(next);
          return;
        }
        if (res.retryable) {
          // section 11.25: a bad paste is a step to repeat, not a ceremony to restart - but
          // it SPENDS a re-arm. `armAnswerWait` starts the ten minutes over, so an
          // answer that never reads (a cracked camera, a chat client mangling the
          // token) would otherwise hold this offer, its ICE credentials and the
          // "anyone with this invite can join and edit" window open for as long as
          // someone keeps pasting - with no fresh candidates ever minted either.
          // The budget bounds the whole answer leg, not just its idle stretches.
          const spent = state.rearms + 1;
          if (spent > maxRearms) {
            fail('timeout', res.detail ?? 'the answer never read back');
            return;
          }
          const next = setPhase(armed ? 'reconnect-armed' : 'awaiting-answer', {
            answer: undefined,
            observerOnly: false,
            rearms: spent,
            retryNote: res.detail ?? 'unreadable-answer',
          });
          if (!live(next)) return;
          armAnswerWait(armed, next);
          return;
        }
        fail('local-rtc-failed', res.detail);
      },
      onExpired: () => fail('timeout', 'the answer could not be applied in time'),
      onThrew: (detail) => fail('local-rtc-failed', detail),
    });
  }

  // ── Acceptor legs ───────────────────────────────────────────────────────────────

  function onAccept(invite: CollabInvite): void {
    if (role !== 'acceptor') return;
    if (state.phase !== 'idle') return;
    // Same rule as `startInvite`: answering mints a peer connection of this side's own.
    readyLatched = false;
    const gen = setPhase('reading-invite', {
      invite,
      peer: { name: invite.name, colour: invite.colour },
      observerOnly: observerOnlyFor(invite.opVersion),
      toolVersionNote: undefined,
    });
    if (!live(gen)) return;
    race(
      gen,
      effects.checkTool({
        toolId: invite.toolId,
        toolVersion: invite.toolVersion,
        engineVersion: invite.engineVersion,
      }),
      {
        onResult: (probe) => {
          if (probe.status === 'missing') {
            // section 6.1: peers send values, never code - so a missing tool is a refusal.
            fail('tool-missing', invite.toolId);
            return;
          }
          if (probe.status === 'version-skew' && probe.severity === 'major') {
            fail('version-major-mismatch', probe.localVersion);
            return;
          }
          const note = probe.status === 'version-skew' ? ('minor-skew' as const) : undefined;
          startAnswer(invite, note);
        },
        onExpired: () => fail('timeout', 'the tool probe did not answer in time'),
        onThrew: (detail) => fail('local-rtc-failed', detail),
      },
    );
  }

  function startAnswer(invite: CollabInvite, note: 'minor-skew' | undefined): void {
    const gen = setPhase('creating-answer', { toolVersionNote: note });
    if (!live(gen)) return;
    race(gen, effects.createAnswer(invite), {
      onResult: (res) => {
        if (!res.ok) {
          fail('local-rtc-failed', res.detail);
          return;
        }
        // The answer is PUBLISHED here, and this notification is the one the dialog turns
        // into step 3. Everything that could complete the ceremony runs strictly after
        // it - see the header's publish-before-promote guarantee. That ordering is the
        // whole fix: promote first and the reply the inviter is waiting for never becomes
        // deliverable, which is a pair that cannot connect rather than one that connects
        // early.
        const next = setPhase('awaiting-connection', { answer: res.answer });
        if (!live(next)) return;
        // The long budget: the human still has to carry this blob back (section 6.1). It
        // shortens to the connect watchdog the moment ICE starts checking.
        startTimer(next, answerWaitMs, () => fail('timeout', 'the answer was never delivered'));
        // …and on a LAN the entire handshake may already have happened inside the
        // `createAnswer` above, whose edges this machine was in no phase to act on. The
        // reason the acceptor could sit here with healthy channels for ten minutes.
        syncIce(next);
        syncReady(next);
      },
      onExpired: () => fail('timeout', 'the answer could not be minted in time'),
      onThrew: (detail) => fail('local-rtc-failed', detail),
    });
  }

  // ── Readiness: the only thing that completes a pairing ──────────────────────────

  /**
   * Read the transport's CURRENT lane readiness and process it exactly as a live event.
   *
   * The `ready` half of the level read, run on entering the two phases that may complete,
   * immediately after `syncIce`. The latch is consulted FIRST and answers on its own: an
   * effects bundle with no `channelsReady` still completes if it delivered the edge while
   * the machine was in an earlier phase, which is exactly the case `readyLatched` exists
   * for and the one a level read cannot cover.
   *
   * `gen` is the generation the entering phase change returned, never a re-read of the
   * counter, and it is checked before the read and AGAIN after it - `channelsReady` is
   * foreign code that may itself have sent a `cancel`. Anything but `true` is "not yet",
   * never a failure: a transport that cannot answer has not broken the ceremony, and the
   * edge event, the replay and the watchdog are all still in play.
   */
  function syncReady(gen: number): void {
    if (!live(gen)) return;
    if (readyLatched) {
      onReady();
      return;
    }
    if (typeof effects.channelsReady !== 'function') return;
    let now: boolean | undefined;
    try {
      now = effects.channelsReady();
    } catch {
      return;
    }
    if (now !== true) return;
    if (!live(gen)) return;
    onReady();
  }

  /**
   * The pair can carry a session: this is the ONLY transition into `connected`.
   *
   * Latching first and acting second is the publish-before-promote guarantee: from any
   * phase that still owes a human a step - the acceptor minting or holding its answer's
   * predecessors, the inviter waiting for a reply - this records the fact and changes
   * nothing, and `syncReady` re-reads it once the machine reaches a phase that may
   * complete. The machine may not skip publishing the answer, whatever the transport says
   * and whenever it says it.
   *
   * Idempotent in the value, which is what lets the edge, the latch, the level read and
   * the transport's replay-on-subscribe all stack: a `ready` while already `connected` is
   * a no-op, and `reconnecting` stays ICE's to own (the channels never closed).
   */
  function onReady(): void {
    readyLatched = true;
    if (state.phase !== 'connecting' && state.phase !== 'awaiting-connection') return;
    setPhase('connected', {
      arming: false,
      reconnecting: false,
      everConnected: true,
      rearms: 0,
      retryNote: undefined,
    });
  }

  // ── ICE (section 11.3) ─────────────────────────────────────────────────────────────────

  /**
   * Read the transport's CURRENT ICE state and process it exactly as a live event.
   *
   * Called on entering the two phases the transport is the only good way out of, because
   * both are entered from inside an `await` the transitions can land during - see the
   * header's "Both surfaces are read level-triggered on entry" for the measured trace.
   * Run BEFORE `syncReady`, so a pairing that died during the mint fails rather than
   * completing. Deliberately routed through `onIce` rather than given its own transition
   * table: a level read that decided things for itself would be a second, drifting copy
   * of the ICE policy.
   *
   * `gen` is the generation the entering phase change returned, never a re-read of the
   * counter (see `setPhase`). A subscriber that cancelled from inside that phase's
   * notification has already ended this ceremony, and a level read must not be the thing
   * that resurrects it - so the guard is checked before the read and AGAIN after it,
   * since `iceState` is foreign code that may itself have sent a `cancel`.
   *
   * Idempotent by construction, which is what lets the transport's replay-on-subscribe
   * exist alongside it: `onIce('connected')` moves no phase at all now, and
   * `onIce('checking')` in `awaiting-connection` re-arms one watchdog to the same
   * deadline. Two guards, never two transitions.
   */
  function syncIce(gen: number): void {
    if (!live(gen)) return;
    if (typeof effects.iceState !== 'function') return;
    let now: CeremonyIceState | undefined;
    try {
      now = effects.iceState();
    } catch {
      // A transport that cannot answer has not failed the ceremony: the edge-triggered
      // events, and the watchdog behind them, are both still in play.
      return;
    }
    if (now === undefined || now === 'new') return;
    if (!live(gen)) return;
    onIce(now);
  }

  function onIce(ice: CeremonyIceState): void {
    switch (ice) {
      case 'new':
        return;
      case 'checking':
        // The peer has our payload; from here it is a network question, not a human one.
        if (state.phase === 'awaiting-connection') {
          clearTimers();
          startTimer(generation, connectWatchdogMs, () => fail('ice-failed-isolation-suspected', 'connect watchdog'));
        }
        return;
      case 'connected':
      case 'completed':
        // NOT a completion. A candidate pair answering a binding request says nothing
        // about whether the ceremony finished - on loopback it happens BEFORE the answer
        // has even been carried back - and promoting on it is precisely the bug that made
        // the acceptor skip its own answer screen. The channels are the signal; see
        // `onReady`. The only thing left here is un-greying a live pair that blipped.
        if (state.phase === 'connected' && state.reconnecting) patch({ reconnecting: false });
        return;
      case 'disconnected':
        // NOT a failure: it self-heals in seconds, and no timer is started on purpose - 
        // the browser escalates to `failed` itself if it does not (section 11.3).
        if (!state.reconnecting) patch({ reconnecting: true });
        return;
      case 'failed':
      case 'closed':
        if (state.phase === 'connected') {
          if (role === 'inviter') startInvite(true, 0);
          else fail('connection-lost');
          return;
        }
        if (state.phase === 'connecting' || state.phase === 'awaiting-connection') {
          fail('ice-failed-isolation-suspected');
        }
        return;
    }
  }

  // ── Public surface ──────────────────────────────────────────────────────────────

  function send(event: CeremonyEvent): void {
    if (disposed) return;
    if (isCeremonyTerminal(state.phase)) return;
    switch (event.type) {
      case 'cancel':
        setPhase('closed', { cause: 'cancelled', arming: false, reconnecting: false });
        return;
      case 'invite':
        onInvite();
        return;
      case 'accept':
        onAccept(event.invite);
        return;
      case 'answer':
        onAnswer(event.answer);
        return;
      case 'peer-op-version': {
        // No phase change: this is a claim about the peer, not a step in the ceremony.
        const observerOnly = observerOnlyFor(event.opVersion);
        if (observerOnly !== state.observerOnly) patch({ observerOnly });
        return;
      }
      case 'ice':
        onIce(event.state);
        return;
      case 'ready':
        onReady();
        return;
    }
  }

  return {
    get state() {
      return state;
    },
    send,
    subscribe(fn) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    dispose() {
      disposed = true;
      clearTimers();
      generation += 1;
      subscribers.clear();
    },
  };
}
