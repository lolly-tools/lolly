// SPDX-License-Identifier: MPL-2.0
/**
 * collab-ceremony - the invite and accept dialogs of a private collab
 * (plan 100 section 6.1, section 4.5, section 11.25, section 11.26; wave 2.2).
 *
 * WHAT THIS IS. The human half of `collab/ceremony.ts`. That module owns the order of
 * events and nothing else; this one owns the screens the two people actually work
 * through, numbered 1-2-3 on every screen because section 11.25 says the QR Tango survives
 * only when the UI says which step the pair is on. Nothing here decides when a
 * ceremony ends - it renders `machine.state.phase` and feeds events back in.
 *
 * WHY EVERY PLATFORM PIECE ARRIVES THROUGH `opts`. The dialog never imports the RTC
 * provider, the QR encoder or the camera: the transport arrives as `effects` (an
 * object or a factory), the QR as `renderQr`, the scanner as `scan`. Three reasons,
 * in order of weight: the provider is another wave's file and would drag WebRTC into
 * every bundle that shows a share dialog; `BarcodeDetector` is Chromium-only
 * (section 11.27), so scanning has to be an absent capability rather than a broken button;
 * and the whole flow then runs under jsdom with stub effects and a fake clock, which
 * is the only way the ten-minute re-arm and the isolation timeout are testable at all.
 *
 * THE TRANSPORT CONTRACT IS THREE THINGS, NOT ONE ({@link CeremonyEffectsBundle}).
 * The four `CeremonyEffects` mint and apply the blobs, and on their own they are only
 * two thirds of a pairing:
 *
 *   - `events(send)` is how the transport's ICE reaches the machine. WITHOUT IT NO
 *     PAIRING EVER CONNECTS: `connected` is only ever entered from an `ice` event, so
 *     an unwired ceremony parks in `connecting` / `awaiting-connection` until a
 *     watchdog calls it a failure. It is optional purely so a test stub that drives
 *     the machine by hand does not have to implement it.
 *   - `close()` is the teardown. Every cancelled, failed and restarted ceremony hands
 *     its transport back through it; a peer connection plus three data channels is not
 *     something to leave to the garbage collector, and a `timeout` failure leaves one
 *     still gathering. The one exception is ownership transfer: once the pair is live
 *     and `onConnected` has fired, the channel belongs to the session and this dialog
 *     never closes it.
 *
 * THE THREE STEPS, PER ROLE.
 *
 *   inviter   1. name the invite, mint it, show it (link / code / QR)
 *             2. wait for the reply - paste or scan it, with the 10-minute re-arm
 *                counted down in the open and "Make a new invite" always available
 *             3. connect, then hand off through `onConnected`
 *
 *   acceptor  1. paste or scan the invite
 *             2. the tool probe's verdict, then the name field
 *             3. show the reply back (link / code / QR), then connect
 *
 * The acceptor's step 2 runs `checkTool` BEFORE the machine exists, so the probe's
 * verdict can be shown before asking for a name (section 6.1 wants the refusal at accept
 * time, and asking someone to name themselves for a collab that cannot happen is
 * rude). The machine re-runs the same probe when it starts; it is a local catalog
 * lookup, and the machine stays the authority on the outcome.
 *
 * A MISSING TOOL IS A REFUSAL, NOT A DEGRADED JOIN (section 6.1, section 11.22). Peers send values,
 * never code, so the template and hooks always come from the local catalog. The copy
 * names the tool rather than saying "something went wrong".
 *
 * UNREADABLE TEXT NEVER REACHES THE MACHINE. `collab/ceremony.ts`'s header pins this:
 * signals cross that boundary as decoded envelopes, so a mangled paste is this file's
 * problem and must not spend a ceremony. Every pasted or scanned string goes through
 * `readSignal` (the real `sdp-codec`) first; only a decoded payload becomes an event.
 *
 * A11Y. A live region on every step change and every terminal state, focus moved to the
 * step heading (which carries `tabindex="-1"`), Escape mapped to the machine's own
 * cancel event through `mountModal`'s `cancel` handling, and no motion anywhere: the
 * in-flight screens are a heading plus a `role="status"` line, never a pulsing spinner,
 * so `reduceMotion` has nothing to switch off.
 *
 * That live region is mounted INSIDE the `<dialog>` rather than reusing the shell's
 * body-level `announce()`. `mountModal` opens with the native `showModal()`, and the
 * HTML modal-dialog steps mark every node outside the dialog inert; an inert subtree is
 * excluded from the accessibility tree and there is no per-element opt-out from
 * UA-applied inertness. `a11y.ts`'s `data-a11y-live` marker only protects a region from
 * `lib/focus-trap.ts`'s hand-rolled sweep, which is for `role="dialog"` DIV overlays - 
 * it buys nothing here, so every announcement made through it would be dropped.
 *
 * Focus moves only when the STEP changes, never on a countdown tick and never on a
 * validation notice - and a re-render restores the caret and the selection to whatever
 * field held them, with the typed text intact. section 11.25 already calls the reply leg the
 * ceremony's weak point; a dialog that wipes the paste field to tell you the paste was
 * wrong is what makes it one.
 *
 * COPY. Every user-visible string lives in {@link STRINGS}, and every value in that map
 * IS its catalog key: `i18n.ts` looks a translation up by the English source, so the map
 * is both the copy and the extraction list (scripts/translate.ts's `collab` corpus slices
 * it out of this file). Rendering goes through `tRaw(STRINGS.x, params)` - `tRaw` rather
 * than `t` because every string here lands in `textContent`, an attribute or the dialog's
 * live region, never an HTML sink, and t()'s param escaping would render a collaborator
 * called O'Brien as `O&#39;Brien`. Peer-supplied text (a display name, a tool id) only
 * ever reaches the DOM through `textContent`, never a markup sink - the same rule the
 * rest of `collab/` follows, because those strings come from a stranger.
 *
 * The copy is a LAZY namespace (section 2 of the collab i18n wave): its ~180 strings are needed
 * only once someone is actually starting or joining a collab, so they stay out of every
 * boot catalog and load with the dialog (that reasoning is about WHEN the copy is needed,
 * and survives `private-collab` going ON by default on 2026-08-10). English needs no load
 * at all, and an unloaded/untranslated namespace falls back to English string for string,
 * exactly like any missing key.
 */

import { CANVAS_OP_VERSION, isCompatibleOpVersion } from '@lolly-tools/core/canvas-op-v1';
import {
  ANSWER_WAIT_MS,
  createCeremony,
  type CeremonyEffects,
  type CeremonyEndCause,
  type CeremonyEvent,
  type CeremonyMachine,
  type CeremonyOptions,
  type CeremonyRole,
  type CeremonyState,
  type CeremonyTimerHandle,
  type CeremonyTimers,
  type CollabAnswer,
  type CollabInvite,
  type CollabPeer,
  type ToolProbeResult,
} from '../collab/ceremony.ts';
import {
  ANSWER_PARAM,
  INVITE_PARAM,
  decodeToken,
  encodeToken,
  sniffSkin,
  unpack,
  type CollabPayload,
} from '../collab/sdp-codec.ts';
import { derivePlate } from '../collab/plate.ts';
import type { PlateMaterial } from '../collab/plate.ts';
import { mountModal } from './modal.ts';
import { currentLang, loadNamespace, tRaw } from '../i18n.ts';
// Nearby discovery (plans/110 section 3): tap a discovered peer to hand over the invite, instead
// of the peer scanning a QR. The provider is null on every plain web build (no LAN provider
// registered), so the whole panel is absent unless a Tauri shell registered one.
import { getNearbyProvider, timedWindow, type NearbyPeer } from '../lib/nearby.ts';
import { isFlagOnSync, NEARBY_DISCOVERY_FLAG } from '../feature-flags.ts';

// ── Copy ──────────────────────────────────────────────────────────────────────
//
// One map, one namespace. Nothing outside it renders a word at the user; the suite
// scans both the rendered DOM and this file's own source to keep that true. Each value
// is the catalog key `tRaw(…)` looks up, and `{name}` slots are filled by the same call.

export const STRINGS = {
  dialogLabel: 'Private collab',

  // Actions shared by several screens.
  cancel: 'Cancel',
  copyLink: 'Copy the link',
  copyCode: 'Copy the code',
  copied: 'Copied',
  scan: 'Scan a code',
  scanNothing: 'Nothing was scanned. Paste the text instead.',
  scanFailed: 'The camera could not be used. Paste the text instead.',
  // The QR skin (both roles). The invite/reply sit in two tabs (labelled by the existing
  // link/code labels below), each with its own QR: the LINK (a plain phone camera opens it)
  // and the CODE (base32, always small enough to scan, read by Lolly's own scanner - the
  // airgap path, section 6.1 skin 2). Tapping a QR blows it up to near-fullscreen so a second
  // device can scan it from across a desk. `{label}` in `qrEnlarge` is filled by the tab's
  // own label, so the accessible name comes out already translated.
  qrEnlargeHint: 'Tap to enlarge for scanning',
  qrEnlarge: 'Enlarge {label} for scanning',
  qrZoomDismiss: 'Point another device here to scan it. Tap anywhere or press Escape to close.',
  // Shown in the Link tab when the invite is long enough that its URL will not fit a QR a
  // camera can still read (a busy network makes a big invite); the Code tab always fits.
  qrLinkTooBig: 'This link is too long to scan. Copy it instead, or use the Code tab.',

  // Naming (both roles).
  nameLabel: 'Your name in this collab',
  namePlaceholder: 'Name',
  nameHelp: 'Leave this empty to show up as {fallback}.',
  hostFallback: 'Host',
  inviteeFallback: 'Invitee',

  // Inviter, step 1.
  inviteNameHeading: 'Step 1 of 3: Create the invite',
  inviteNameBody: 'The other person sees this name while you work together.',
  createInvite: 'Create the invite',
  inviteMintHeading: 'Step 1 of 3: Making the invite',
  inviteMintBody: 'Getting this device ready.',
  inviteHeading: 'Step 1 of 3: Send the invite',
  inviteBody: 'Send one of these to the other device. Any channel you both trust will do.',
  inviteLinkLabel: 'Invite link',
  inviteCodeLabel: 'Invite code',
  inviteTrust: 'Anyone with this invite can join and edit until you close the session.',
  toWaiting: 'Next: paste the reply',

  // Inviter, step 2.
  waitHeading: 'Step 2 of 3: Wait for the reply',
  waitBody: 'The other device makes a reply. Paste it here, or scan it.',
  replyLabel: 'Paste the reply code here',
  replyPlaceholder: 'Paste the reply here',
  connectAction: 'Connect',
  showInvite: 'Show the invite again',
  newInvite: 'Make a new invite',
  countdown: 'This invite works for another {time}.',
  countdownSpent: 'This invite has run out. Make a new one.',
  rearmed: 'A fresh invite was made. Send that one instead.',
  replyRetry: 'That reply could not be used. Ask for it again.',
  replyEmpty: 'Paste the reply first.',
  replyWrongKind: 'That is an invite, not a reply.',
  replyUnreadable: 'That text is not a reply from Lolly.',

  // Inviter, step 3.
  applyHeading: 'Step 3 of 3: Connecting',
  applyBody: 'Checking the reply.',
  connectHeading: 'Step 3 of 3: Connecting',
  connectBody: 'Looking for a direct route between the two devices.',

  // Acceptor, step 1.
  acceptHeading: 'Step 1 of 3: Paste the invite',
  acceptBody: 'Paste the invite from the other device, or scan its code.',
  inviteFieldLabel: 'Invite from the other device',
  invitePlaceholder: 'Paste the invite here',
  checkInvite: 'Check the invite',
  inviteEmpty: 'Paste the invite first.',
  inviteWrongKind: 'That is a reply, not an invite.',
  inviteUnreadable: 'That text is not an invite from Lolly.',
  probeHeading: 'Step 1 of 3: Checking the invite',
  probeBody: 'Looking for {tool} on this device.',

  // Acceptor, step 2.
  acceptNameHeading: 'Step 2 of 3: Your name',
  acceptNameBody: '{peer} invited you to work on {tool}.',
  joinAction: 'Join the collab',

  // Acceptor, step 3.
  answerMintHeading: 'Step 3 of 3: Making the reply',
  answerMintBody: 'Getting this device ready.',
  answerHeading: 'Step 3 of 3: Send this reply back',
  answerBody: 'The host pastes this code, or opens this link, in their waiting window.',
  answerLinkLabel: 'Reply link',
  answerCodeLabel: 'Reply code',
  // Named actions, not the shared "Copy the link" / "Copy the code". This is the step
  // people stall on: the reply is minted, it looks finished, and nothing on screen said
  // it still has to travel. A button that names what it copies is half of saying so.
  copyReplyLink: 'Copy reply link',
  copyReplyCode: 'Copy reply code',
  answerWait: 'Waiting for the other device to connect.',

  // Connected, and the two notes that can ride along.
  connectedHeading: 'Connected',
  connectedBody: 'You are working with {peer}.',
  // The connection plate (section 1). One sentence, and it says what a MATCH means rather than
  // instructing anyone to compare: the pair who read it out have already understood, and
  // the pair who do not are not made safer by being told to.
  plateBody: 'Both screens show the same plate when the connection is private.',
  // What a screen reader says instead of the plate's own text - see `spokenPlate`, and
  // `plateSlot` for why the visible characters are hidden from it rather than doubled.
  plateSpoken: 'Connection plate {plate}',
  startEditing: 'Start editing',
  reconnecting: 'The link went quiet. Waiting for it to come back.',
  observerOnly: 'The two devices run different collab versions. You can watch, but edits from this device are not sent.',
  minorSkew: 'The two devices run different versions of {tool}. Some fields may not match.',

  // One screen per end cause (section 11.26). Specific copy, one action each.
  fail: {
    'tool-missing': {
      title: 'This device does not have that tool',
      body: 'The collab needs {tool}. Add it to this device, then ask for a new invite.',
      action: 'Close',
    },
    'version-major-mismatch': {
      title: 'The two versions of that tool do not match',
      body: 'This device has a version of {tool} that cannot read the other one. Update both, then try again.',
      action: 'Close',
    },
    'ice-failed-isolation-suspected': {
      title: 'This network blocks direct connections',
      body: 'This network blocks device-to-device connections. Try a hotspot or a wired network.',
      action: 'Try again',
    },
    'connection-lost': {
      title: 'The connection dropped',
      body: 'The other device stopped answering. A new invite is needed to carry on.',
      action: 'Try again',
    },
    timeout: {
      title: 'Nothing came back in time',
      body: 'The other device never replied. Make a new invite and send it again.',
      action: 'Try again',
    },
    'local-rtc-failed': {
      title: 'This device could not open the connection',
      body: 'This browser refused to make a direct connection. Reload the page, then try again.',
      action: 'Close',
    },
    cancelled: {
      title: 'Collab closed',
      body: 'Nothing was shared.',
      action: 'Close',
    },
  },

  // Nearby devices (plans/110 section 3) - the tap-to-hand-over panel on the invite screen.
  nearbyHeading: 'Nearby devices',
  nearbyMakeVisible: 'Make this device visible',
  nearbyHint: 'Make the other device visible too, and it will appear here to tap.',
  nearbyEmpty: 'Looking for nearby devices. Nothing yet - make sure the other one is visible on the same network.',
  nearbyHandingOver: 'Handing the invite over...',
  nearbyFailed: 'That did not reach the device. Try again, or share the code instead.',
} as const;

/**
 * Fill `{placeholder}` slots in a copy string.
 *
 * Kept as a named re-export of `tRaw` rather than deleted: it is what the ceremony's
 * own suites build their expectations with, and naming it here keeps every call site
 * in this file reading as one thing (`tRaw(STRINGS.x, …)`) while the tests keep the
 * verb they had. In English the two are the same function doing the same substitution;
 * in any other language `tRaw` looks the source up in the `collab` catalog first.
 *
 * @deprecated for new code - call {@link tRaw} directly.
 */
export const fill = tRaw;

// ── Routes, timings, small pure helpers ───────────────────────────────────────

/** Where an invite link points (section 6.1 skin 1). */
export const JOIN_ROUTE = '#/join';
/** Where a reply link points (section 11.25 - the answer leg is a link too, not just a blob). */
export const REPLY_ROUTE = '#/join-reply';
/**
 * The attribute an INVITER dialog states its minted invite on, in the link skin.
 *
 * Public DOM surface, like the field ids the reply handoff drives: `collab/join-route.ts`
 * reads it to answer "was this invite made in this browser?" for a second tab. Named here
 * because it is this file that writes it (see `syncInviteStamp`).
 */
export const INVITE_STAMP = 'data-cer-invite';
/** How often the re-arm countdown repaints. One second: it shows m:ss. */
export const COUNTDOWN_TICK_MS = 1000;

// The three editable fields. Named because each is read from three places - the
// element, the value mirror that survives a re-render, and the focus restore.
const NAME_FIELD = 'collab-cer-name';
const REPLY_FIELD = 'collab-cer-reply';
const INVITE_FIELD = 'collab-cer-invite';

/** Causes whose one action restarts the ceremony rather than closing the dialog. */
const RESTARTABLE: ReadonlySet<CeremonyEndCause> = new Set<CeremonyEndCause>([
  'ice-failed-isolation-suspected',
  'connection-lost',
  'timeout',
]);

/** The name shown when someone clears the field (section 4.5 - role-based, never a profile field). */
export function fallbackName(role: CeremonyRole): string {
  return role === 'inviter' ? tRaw(STRINGS.hostFallback) : tRaw(STRINGS.inviteeFallback);
}

/** The chosen display name, or the role fallback. Trimmed; never a profile leak. */
export function resolveName(raw: string | undefined, role: CeremonyRole): string {
  const trimmed = (raw ?? '').trim();
  return trimmed || fallbackName(role);
}

/**
 * The plate as a screen reader should say it: `LOL-123` → `L O L, 1 2 3`.
 *
 * Not decoration. The plate exists to be compared CHARACTER BY CHARACTER against a voice
 * on the other end, and left as its own text a screen reader reads `LOL-123` as a word
 * and a number - "lol, one hundred and twenty-three" - which is unusable for that and
 * worse, sounds like a successful comparison. Spacing the characters is what makes the
 * spoken form and the printed form the same six symbols; the hyphen becomes a comma
 * because a pause is what a group break sounds like.
 */
export function spokenPlate(plate: string): string {
  return plate
    .split('-')
    .map((group) => [...group].join(' '))
    .join(', ');
}

/** `m:ss`, floored at zero. Used for the 10-minute re-arm countdown. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The token inside whatever the human pasted: a bare code, a full `#/join?inv=…`
 * link, or a `inv=…` fragment they highlighted. A codec token never contains `=`
 * (base64url here is unpadded, the QR skin is `A-Z2-7`), so the presence of one is
 * a reliable tell that this is a URL rather than the payload itself.
 */
export function tokenFrom(raw: string, param: string): string {
  const text = String(raw ?? '').trim();
  if (!text.includes('=')) return text;
  const match = new RegExp(`[?&#]${param}=([^&#\\s]+)`).exec(text) ?? new RegExp(`^${param}=([^&#\\s]+)`).exec(text);
  if (!match) return text;
  try {
    return decodeURIComponent(match[1]!);
  } catch {
    return match[1]!;
  }
}

export type SignalKind = 'invite' | 'answer';
export type SignalReadFailure = 'empty' | 'unreadable' | 'wrong-kind';

/** A payload in both skins at once: the link carries base64url, the QR base32. */
export interface SignalView {
  readonly link: string;
  readonly qr: string;
  readonly payload: CollabPayload;
}

export type SignalReadResult =
  | { readonly ok: true; readonly value: SignalView }
  | { readonly ok: false; readonly code: SignalReadFailure };

/**
 * Decode what a human handed us, and re-skin it into both forms. Total: every
 * failure is a code this file has copy for, and nothing throws - the input is a
 * stranger's QR code or a chat message (section 11.21).
 */
export function readSignal(raw: string, expect: SignalKind): SignalReadResult {
  const token = tokenFrom(raw, expect === 'invite' ? INVITE_PARAM : ANSWER_PARAM);
  if (!token) return { ok: false, code: 'empty' };
  const bytes = decodeToken(token, sniffSkin(token));
  if (!bytes.ok) return { ok: false, code: 'unreadable' };
  const payload = unpack(bytes.value);
  if (!payload.ok) return { ok: false, code: 'unreadable' };
  if (payload.value.kind !== expect) return { ok: false, code: 'wrong-kind' };
  return {
    ok: true,
    value: {
      link: encodeToken(bytes.value, 'link'),
      qr: encodeToken(bytes.value, 'qr'),
      payload: payload.value,
    },
  };
}

/**
 * Our own minted signal in both skins. Tolerant on purpose: the transport owns the
 * signal's form, so a build whose signal is not a codec token still gets a
 * copyable blob rather than an empty screen.
 */
export function presentSignal(signal: string, kind: SignalKind): { link: string; qr: string } {
  const read = readSignal(signal, kind);
  if (read.ok) return { link: read.value.link, qr: read.value.qr };
  return { link: signal, qr: signal };
}

/** The invite the machine needs, out of a decoded payload. Peer colour is left for
 *  the receiving shell to re-derive from its own design system (section 4.4). */
export function inviteFromSignal(view: SignalView): CollabInvite | null {
  if (view.payload.kind !== 'invite') return null;
  const meta = view.payload.invite;
  return {
    signal: view.link,
    toolId: meta.toolId,
    toolVersion: meta.toolVersion,
    engineVersion: meta.engineVersion,
    name: meta.name || undefined,
    opVersion: meta.opVersion,
  };
}

/**
 * The failure screen for an end cause. Total over `CeremonyEndCause` (section 11.26).
 *
 * `STRINGS.fail[cause]` is the one place this file reads the map without a `tRaw()`
 * around it, and it is not copy: it is the OBJECT holding this cause's three keys.
 * All three are translated one line down, which is what the guard in
 * `collab-ceremony.test.ts` (and `collab-i18n.test.ts`'s scan) allows it for.
 */
export function failureCopy(
  cause: CeremonyEndCause,
  params: Record<string, string | number> = {},
): { title: string; body: string; action: string; restarts: boolean } {
  const entry = STRINGS.fail[cause];
  return {
    title: tRaw(entry.title),
    body: tRaw(entry.body, params),
    action: tRaw(entry.action),
    restarts: RESTARTABLE.has(cause),
  };
}

// ── Options ───────────────────────────────────────────────────────────────────

/**
 * What a transport factory is told. `name` is a getter, not a value, because the
 * acceptor names itself AFTER the tool probe: the transport reads it when it mints,
 * which is later than when it is built.
 */
export interface CeremonyEffectsContext {
  readonly role: CeremonyRole;
  readonly name: () => string;
}

/**
 * The three ceremony events a transport sources rather than a human: ICE's own state, the
 * ops lane becoming usable, and the peer's op-contract version as declared by the
 * ops-channel hello. Structurally `rtc-transport.ts`'s `RtcCeremonyEvent`, spelled out
 * here so this file does not import the provider even for a type.
 *
 * `ready` belongs here as much as the other two, and leaving it out was a slip rather than
 * a policy: it is the event that actually COMPLETES a pairing (ICE alone never does), the
 * real transport has always emitted it, and the dialog has always forwarded it. The
 * omission never broke the seam - `RtcCeremonyListener` is method-syntax, so the
 * assignment in `collab/join-route.ts` stays bivariant - but it did mean every test
 * driving a fake transport the way the real one behaves was an error the typechecker had
 * to be ignored about.
 */
export type CeremonyTransportEvent = Extract<
  CeremonyEvent,
  { type: 'ice' } | { type: 'ready' } | { type: 'peer-op-version' }
>;

/**
 * What a transport hands the dialog: the four effects the machine drives, plus the two
 * members that make it a live object rather than a bag of functions.
 *
 * Both are optional so a stub that drives the machine by hand stays a plain
 * `CeremonyEffects` - but a REAL transport must implement both. See this file's header:
 * without `events` no pairing reaches `connected`, and without `close` every cancelled
 * or retried ceremony leaks a peer connection and three data channels.
 */
export interface CeremonyEffectsBundle extends CeremonyEffects {
  /**
   * Subscribe the running ceremony to the transport's ICE. Called once per machine,
   * with the machine's own `send` narrowed to the events a transport may source;
   * returns the unsubscribe, which the dialog calls before it builds the next machine.
   *
   * `createRtcTransport` satisfies it directly: `events: transport.onCeremonyEvent`.
   */
  events?(send: (event: CeremonyTransportEvent) => void): () => void;
  /**
   * Tear the transport down. Idempotent, and called for every ceremony this dialog
   * still owns - cancel, Escape, a failure screen, and each `restart`. NOT called once
   * `onConnected` has fired: from that moment the channel is the session's.
   */
  close?(): void;
  /**
   * The pairing's two DTLS certificate fingerprints, for the connection plate (section 1).
   *
   * A LEVEL READ, exactly like the machine's `iceState`/`channelsReady` and asked the same
   * way - on every render, rather than off an edge this dialog may have been in no screen
   * to catch. `null` means "no pairing to describe", which is what the transport answers
   * before both descriptions exist and after it is closed; the connected screen then shows
   * NOTHING, because a plate two people might read out is the one thing here that must not
   * be approximate.
   *
   * Optional for the same reason `events` and `close` are: a stub driving the machine by
   * hand stays a plain `CeremonyEffects`. `createRtcTransport` satisfies it directly - its
   * `RtcCeremonyEffects` declares the same member as required.
   */
  plateMaterial?(): PlateMaterial | null;
}

/** The transport, or a factory for it. Either way this file never imports one. */
export type CeremonyEffectsSource =
  | CeremonyEffectsBundle
  | ((ctx: CeremonyEffectsContext) => CeremonyEffectsBundle);

/** What the caller receives the moment the pair is live. Fires exactly once. */
export interface CeremonyConnectedHandle {
  readonly role: CeremonyRole;
  readonly localName: string;
  readonly peerName: string;
  readonly peer?: CollabPeer;
  readonly toolId?: string;
  readonly invite?: CollabInvite;
  readonly answer?: CollabAnswer;
  /** Contract section 9: a major op-version gap joins as a watcher rather than refusing. */
  readonly observerOnly: boolean;
  readonly toolVersionNote?: 'minor-skew';
  readonly state: CeremonyState;
  /** Close the dialog once the session is wired up. */
  close(): void;
}

export interface CollabCeremonyOptions {
  readonly role: CeremonyRole;
  /**
   * The transport (wave 2.3), injected so this component stays WebRTC-free. A factory
   * is rebuilt per ceremony, so `restart` genuinely gets a fresh peer connection.
   * Implement {@link CeremonyEffectsBundle}'s `events` and `close` for a real one.
   */
  readonly effects: CeremonyEffectsSource;
  /** The tool the session is on. Inviter only; the acceptor reads it off the invite. */
  readonly toolId?: string;
  /** Prefill for the name field, normally the profile firstname. Clearable (section 4.5). */
  readonly profileName?: string;
  /** Draw a QR for a token. Absent means the QR skin is simply not offered (section 11.27). */
  readonly renderQr?: (text: string) => HTMLElement | null | Promise<HTMLElement | null>;
  /** Start a scan. Resolves with the scanned text, or null when nothing was read. */
  readonly scan?: () => Promise<string | null>;
  /**
   * Fires once, when the pair goes live. Handing the handle over also hands over the
   * TRANSPORT: from this call on the dialog will not `close()` it, because the session
   * is the thing using it. A ceremony with no `onConnected` listener has nobody to own
   * the channel, so that one is closed with the dialog like any other.
   */
  readonly onConnected?: (handle: CeremonyConnectedHandle) => void;
  /** Fires once, when the dialog is gone. `state` is absent if none was ever started. */
  readonly onClose?: (state: CeremonyState | undefined) => void;
  /** Fires once with the acceptor's minted REPLY signal, the moment it exists - so a nearby
   *  pairing can hand the reply back over its own channel rather than showing a QR to scan.
   *  Acceptor only; never fired for the inviter (plans/110 section 3). */
  readonly onAnswer?: (signal: string) => void;
  /** Fires once with the inviter's minted INVITE signal, the moment it exists - the symmetric
   *  twin of {@link onAnswer}, so an out-of-band channel (plans/138 Tier C: a shared-cloud
   *  rendezvous) can PUBLISH the invite instead of showing a QR to scan. Inviter only; never
   *  fired for the acceptor. Additive: absent = the QR/link path is byte-identical. */
  readonly onInvite?: (signal: string) => void;
  /** Base for the invite/reply links. Defaults to this page's origin + path. */
  readonly linkBase?: string;
  /** Clipboard write. Defaults to `navigator.clipboard`. */
  readonly copy?: (text: string) => void | Promise<void>;
  readonly timers?: CeremonyTimers;
  readonly now?: () => number;
  /** Machine factory, for tests that need to drive ICE events by hand. */
  readonly createMachine?: (options: CeremonyOptions) => CeremonyMachine;
  readonly answerWaitMs?: number;
  readonly localOpVersion?: string;
}

export interface CollabCeremonyHandle {
  readonly el: HTMLDialogElement;
  close(): void;
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

const DEFAULT_TIMERS: CeremonyTimers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  },
};

interface NodeSpec {
  class?: string;
  text?: string;
  style?: string;
  attrs?: Record<string, string>;
}

/**
 * Build one element. `text` goes in as `textContent`, never markup: display names
 * and tool ids arrive over the wire, and the rest of `collab/` holds the same line.
 */
function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  spec: NodeSpec = {},
  kids: readonly (Node | null)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (spec.class) el.className = spec.class;
  if (spec.text !== undefined) el.textContent = spec.text;
  if (spec.style) el.setAttribute('style', spec.style);
  for (const [key, value] of Object.entries(spec.attrs ?? {})) el.setAttribute(key, value);
  for (const kid of kids) if (kid) el.appendChild(kid);
  return el;
}

const ROW = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 10px';
const SLOT = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 8px';
const TOKEN = 'flex:1 1 12rem;min-width:0;overflow-wrap:anywhere;font-size:12px;padding:6px 8px;border-radius:6px;background:hsl(var(--muted, 0 0% 96%))';
const LABEL = 'flex:0 0 100%;font-size:12px;font-weight:650';
// The plate is read aloud across a room or a phone line, so it is sized to be legible at
// a glance and spaced so no two characters run together. Monospace and no ligatures for
// the same reason the alphabet drops its confusables (`plate.ts`): every symbol has to be
// unmistakable on its own.
const PLATE =
  'margin:0 0 6px;padding:10px 8px;border-radius:10px;background:hsl(var(--muted, 0 0% 96%));text-align:center;'
  + 'font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);'
  + 'font-size:clamp(1.75rem, 9vw, 2.5rem);font-weight:700;letter-spacing:.16em;'
  + 'font-variant-ligatures:none;font-variant-numeric:slashed-zero;overflow-wrap:anywhere';

// ── The dialog ────────────────────────────────────────────────────────────────

type Screen =
  | 'name'
  | 'minting'
  | 'invite'
  | 'waiting'
  | 'applying'
  | 'connecting'
  | 'paste'
  | 'probing'
  | 'answering'
  | 'answer'
  | 'connected'
  | 'failed';

/**
 * Open the ceremony dialog for one role. Returns a handle whose `close()` is the
 * same close Escape and the Cancel button take: the machine is sent `cancel`, then
 * disposed, then `onClose` fires.
 */
export function openCollabCeremony(opts: CollabCeremonyOptions): CollabCeremonyHandle {
  const role = opts.role;
  const timers = opts.timers ?? DEFAULT_TIMERS;
  const clock = opts.now ?? (() => Date.now());
  const answerWaitMs = opts.answerWaitMs ?? ANSWER_WAIT_MS;
  const buildMachine = opts.createMachine ?? createCeremony;
  const localOpVersion = opts.localOpVersion ?? CANVAS_OP_VERSION;

  let machine: CeremonyMachine | null = null;
  let unsubscribe: (() => void) | null = null;
  let unsubscribeTransport: (() => void) | null = null;
  let effectsCache: CeremonyEffectsBundle | null = null;
  /** The live pair owns its transport now; this dialog must not hang up on it. */
  let handedOff = false;
  let closed = false;

  // Inviter: the human has moved off the invite screen onto the reply screen.
  let advanced = false;
  // Acceptor: how far the pre-machine half of step 1/2 has got.
  let acceptStage: 'paste' | 'probing' | 'named' = 'paste';
  let acceptInvite: CollabInvite | null = null;
  let acceptProbe: ToolProbeResult | null = null;
  /**
   * Which probe the acceptor is waiting on. A monotonic token rather than the stage
   * flag alone: Scan and "Check the invite" are both live on the paste screen, so a
   * scan that resolves after a manual submit would otherwise write the FIRST invite's
   * verdict onto the second one and show a refusal for a tool nobody pasted. Same
   * discipline as the machine's own `live(gen)`.
   */
  let probeToken = 0;
  /** A refusal decided before any machine existed (the acceptor's own probe). */
  let earlyCause: CeremonyEndCause | null = null;

  let nameValue = (opts.profileName ?? '').trim();
  /**
   * What is typed in the two paste fields, mirrored out of the DOM so a re-render
   * cannot eat it. Every render rebuilds the screen, and a validation notice IS a
   * render - the one moment the text matters most (section 11.25).
   */
  const pasted = new Map<string, string>();
  let notice = '';
  let copiedAct = '';
  let connectedFired = false;
  // Nearby (plans/110 section 3). The LAN provider, or null when discovery is off or unavailable - 
  // in which case none of the panel, the subscription or the handlers below do anything.
  const nearbyProvider = isFlagOnSync(NEARBY_DISCOVERY_FLAG) ? getNearbyProvider('lan') ?? null : null;
  let nearbyPeers: readonly NearbyPeer[] = [];
  let nearbyUnsub: (() => void) | null = null;
  let nearbyVisible = false;
  let nearbyNote = '';
  // One-shot: the acceptor hands its minted reply back over the nearby channel via onAnswer.
  let answerFired = false;
  // One-shot twin: the inviter hands its minted invite out over an out-of-band channel (onInvite).
  let inviteFired = false;
  let lastStepKey = '';
  let lastPhase: CeremonyState['phase'] | '' = '';

  /**
   * Which of the two QR tabs (invite/reply LINK vs CODE) is showing. Kept here so the
   * choice survives a re-render (an ICE event repaints the invite screen while the human is
   * still on it). Default LINK: a plain camera opens it, which is what most people reach for.
   */
  let qrTab: 'link' | 'code' = 'link';
  /**
   * The QR the visible tab shows, so the tap-to-enlarge handler knows what to draw big. Set
   * by `qrTabbedSlots` for the active tab while a screen is built, cleared each render, so it
   * always matches whatever `[data-act="zoom-qr"]` is on screen. Plus the near-fullscreen
   * `<dialog>` it opens, so closing the ceremony (or opening a second zoom) takes it down.
   */
  let qrZoom: { label: string; value: string } | null = null;
  let qrZoomDialog: HTMLDialogElement | null = null;

  /** The screen currently being built, so `heading` can stamp its step number. */
  let painting: Screen = 'name';

  /**
   * The derived plate, and the pairing it belongs to.
   *
   * Two fields rather than one because the derivation is async and a ceremony can outlive
   * a pairing: `plateFor` keys the in-flight (or finished) derivation to the exact pair of
   * fingerprints it was started for, so a re-invite's plate cannot be painted over the new
   * connection and a resolution that lands after the material changed is dropped. Empty
   * means "nothing to show", which is the honest state before the pair exists, while the
   * digest is in flight, and after any failure.
   */
  let plateText = '';
  let plateFor = '';

  let deadline = 0;
  /** The signal currently stamped on the dialog, so the re-encode happens once per invite. */
  let stampedSignal = '';
  let countdownKey = '';
  let countdownEl: HTMLElement | null = null;
  let tickHandle: CeremonyTimerHandle | null = null;

  const modal = mountModal<void>('', {
    className: 'modal collab-ceremony',
    ariaLabel: tRaw(STRINGS.dialogLabel),
    onClose: () => {
      if (closed) return;
      closed = true;
      closeQrZoom();
      stopTick();
      // Escape, the backdrop, Cancel and the handle's own close() all land here, so
      // the machine's cancel event has exactly one path in - and the machine is
      // disposed straight after, timers and subscribers with it.
      machine?.send({ type: 'cancel' });
      const finalState = machine?.state;
      machine?.dispose();
      unsubscribe?.();
      releaseEffects();
      // Stop browsing and, if we made ourselves discoverable, hide again (plans/110 section 3).
      nearbyUnsub?.();
      nearbyUnsub = null;
      if (nearbyVisible) void nearbyProvider?.hide();
      opts.onClose?.(finalState);
    },
  });
  modal.el.style.width = 'min(540px, 94vw)';

  /** The screen, rebuilt per render. A wrapper, so the live region below survives it. */
  const screenEl = node('div', { attrs: { 'data-cer-screen': '' } });
  /**
   * The dialog's own live region - see the header on why the shell's body-level
   * `announce()` cannot be heard from inside a `showModal()` dialog. One `<span>` per
   * part rather than one joined sentence: `aria-atomic` reads the whole region either
   * way, and it keeps every rendered string individually checkable against STRINGS.
   */
  const liveEl = node('div', {
    class: 'visually-hidden',
    attrs: { 'data-cer-live': '', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
  });
  modal.el.append(screenEl, liveEl);

  function speak(...parts: readonly string[]): void {
    const said = parts.filter((text) => text !== '');
    if (said.length === 0) return;
    liveEl.replaceChildren(...said.map((text) => node('span', { text })));
  }

  // ── Machine plumbing ────────────────────────────────────────────────────────

  function effects(): CeremonyEffectsBundle {
    if (!effectsCache) {
      const source = opts.effects;
      effectsCache =
        typeof source === 'function' ? source({ role, name: () => resolveName(nameValue, role) }) : source;
    }
    return effectsCache;
  }

  /**
   * Hand the transport back. A peer connection and three data channels are not
   * garbage the collector can reason about, and a `timeout` failure leaves one still
   * gathering - so every ceremony this dialog still owns is closed here. The
   * exception is the one that worked: after `onConnected` the session holds it.
   */
  function releaseEffects(): void {
    unsubscribeTransport?.();
    unsubscribeTransport = null;
    const bundle = effectsCache;
    const owned = !handedOff;
    effectsCache = null;
    handedOff = false;
    if (!bundle || !owned) return;
    try {
      bundle.close?.();
    } catch {
      /* a transport that is already gone is not this dialog's problem */
    }
  }

  function startMachine(): CeremonyMachine {
    unsubscribe?.();
    unsubscribeTransport?.();
    unsubscribeTransport = null;
    machine?.dispose();
    const bundle = effects();
    const created = buildMachine({
      role,
      effects: bundle,
      timers,
      answerWaitMs,
      localOpVersion,
    });
    machine = created;
    unsubscribe = created.subscribe(() => {
      if (!closed) render();
    });
    // The transport's ICE is the ONLY way a ceremony reaches `connected`. Unwired, both
    // roles sit in their waiting phase until a watchdog calls the pairing a failure.
    unsubscribeTransport =
      bundle.events?.((event) => {
        if (!closed) created.send(event);
      }) ?? null;
    return created;
  }

  /** Tear the current ceremony down and start the role's first screen over. */
  function restart(): void {
    machine?.dispose();
    unsubscribe?.();
    machine = null;
    unsubscribe = null;
    // A fresh transport for a fresh ceremony: after a failure the old peer
    // connection is spent, so it is closed before the factory is asked for another.
    releaseEffects();
    advanced = false;
    acceptStage = 'paste';
    acceptInvite = null;
    acceptProbe = null;
    probeToken += 1;
    earlyCause = null;
    notice = '';
    pasted.clear();
    connectedFired = false;
    answerFired = false;
    inviteFired = false;
    nearbyNote = '';
    qrTab = 'link';
    // A new ceremony's ten minutes are its own, even if the replacement invite happens
    // to look like the one it replaced.
    countdownKey = '';
    stopTick();
    render();
  }

  // ── Countdown (section 6.1's ten minutes, shown rather than implied) ───────────────

  function stopTick(): void {
    if (tickHandle !== null) timers.clearTimeout(tickHandle);
    tickHandle = null;
    countdownEl = null;
  }

  function paintCountdown(): void {
    if (!countdownEl) return;
    const left = deadline - clock();
    countdownEl.textContent = left > 0 ? tRaw(STRINGS.countdown, { time: formatCountdown(left) }) : tRaw(STRINGS.countdownSpent);
  }

  function scheduleTick(): void {
    if (tickHandle !== null) return;
    const step = (): void => {
      tickHandle = null;
      if (closed || !countdownEl || !countdownEl.isConnected) return;
      paintCountdown();
      scheduleTick();
    };
    tickHandle = timers.setTimeout(step, COUNTDOWN_TICK_MS);
  }

  /**
   * Reset the deadline when (and only when) a different invite is armed.
   *
   * Called from `render`, not from the waiting screen's builder, because the machine's
   * ten minutes start at the MINT (`armAnswerWait`, off the `awaiting-answer`
   * transition) and the human reaches the waiting screen whenever they get round to it.
   * Anchored to the first paint of that screen instead, the dialog would cheerfully
   * promise ten minutes on an invite with one minute left.
   */
  function syncDeadline(key: string): void {
    if (countdownKey === key) return;
    countdownKey = key;
    deadline = clock() + answerWaitMs;
  }

  /**
   * State the minted invite on the dialog element, for the whole life of the ceremony.
   *
   * A second window on this device (`collab/join-route.ts`, the own-invite ask) has one
   * question this dialog is the only thing that can answer: "did you make this invite?"
   * The invite screen already renders the token, but that screen is step 1 - press "Next"
   * and the only evidence is gone, so the answer would flip from yes to no without the
   * invite changing at all. This is that fact, kept where a re-render cannot take it.
   *
   * Inviter only, and the LINK skin, because the token in the other window's address bar
   * is the link skin. Recomputed only when the signal itself changes: `presentSignal`
   * decodes and re-encodes, and `render` runs on every ICE event.
   */
  function syncInviteStamp(signal: string): void {
    if (signal === stampedSignal) return;
    stampedSignal = signal;
    if (signal) modal.el.setAttribute(INVITE_STAMP, presentSignal(signal, 'invite').link);
    else modal.el.removeAttribute(INVITE_STAMP);
  }

  /** The two fingerprints as one comparable string, so a pairing has a stable identity. */
  function plateKey(pair: PlateMaterial): string {
    const hex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex(pair.local)}/${hex(pair.remote)}`;
  }

  /**
   * Keep {@link plateText} in step with the pairing the transport currently describes.
   *
   * Driven from `render`, on the level read rather than an edge - the material becomes
   * available around `ready`, which for a LAN pair can land before the dialog has reached
   * a screen that could have caught an event (the same window `iceState`/`channelsReady`
   * exist for). Asking every render costs one comparison once the key is unchanged.
   *
   * Three failures all end the same way, with no plate rather than a wrong one: an effects
   * bundle with no `plateMaterial` (every hand-driven stub), a read that throws, and a
   * digest that cannot be computed (a runtime with no Web Crypto - `plate.ts` refuses
   * rather than reaching for something weaker). None of them is a ceremony failure: the
   * pairing is live and usable, it simply cannot be confirmed out loud on this device.
   */
  function syncPlate(): void {
    let pair: PlateMaterial | null = null;
    try {
      pair = effectsCache?.plateMaterial?.() ?? null;
    } catch {
      pair = null;
    }
    if (!pair) {
      plateText = '';
      plateFor = '';
      return;
    }
    const key = plateKey(pair);
    if (key === plateFor) return;
    // Claim the key BEFORE awaiting: this is what makes the derivation happen once, and
    // what stops the render this resolution triggers from starting a second one.
    plateFor = key;
    plateText = '';
    void derivePlate(pair.local, pair.remote).then(
      (value) => {
        if (closed || plateFor !== key) return;
        plateText = value;
        render();
        // The step did not change, so `render` will not announce on its own - and a plate
        // that arrives a microtask after the screen is exactly the thing a live region is
        // for. Sighted or not, both people are told the same six characters.
        //
        // Only if it actually PAINTED, though. The material is there from `ready`, which
        // for the inviter is the render that `applyRemote` triggers - a screen ("Looking
        // for a direct route…") that shows no plate. Announcing one there would read out
        // six characters the other person cannot yet see, and the reading-out is the
        // whole ceremony; it has to happen when both screens are showing it.
        if (screenEl.querySelector('[data-cer-plate]')) announceStep();
      },
      () => { /* no plate is better than a wrong one; the connection itself is unaffected */ },
    );
  }

  // ── Input handling ──────────────────────────────────────────────────────────

  function fieldValue(selector: string): string {
    return modal.el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value ?? '';
  }

  function setNotice(text: string): void {
    notice = text;
    speak(text);
    render();
  }

  function submitReply(raw: string): void {
    const read = readSignal(raw, 'answer');
    if (!read.ok) {
      setNotice(
        read.code === 'empty'
          ? tRaw(STRINGS.replyEmpty)
          : read.code === 'wrong-kind'
            ? tRaw(STRINGS.replyWrongKind)
            : tRaw(STRINGS.replyUnreadable),
      );
      return;
    }
    notice = '';
    // Only a decoded envelope becomes an event - see this file's header.
    machine?.send({ type: 'answer', answer: { signal: read.value.link } satisfies CollabAnswer });
  }

  function submitInvite(raw: string): void {
    const read = readSignal(raw, 'invite');
    if (!read.ok) {
      setNotice(
        read.code === 'empty'
          ? tRaw(STRINGS.inviteEmpty)
          : read.code === 'wrong-kind'
            ? tRaw(STRINGS.inviteWrongKind)
            : tRaw(STRINGS.inviteUnreadable),
      );
      return;
    }
    const invite = inviteFromSignal(read.value);
    if (!invite) {
      setNotice(tRaw(STRINGS.inviteUnreadable));
      return;
    }
    notice = '';
    acceptInvite = invite;
    acceptStage = 'probing';
    probeToken += 1;
    const token = probeToken;
    const stale = (): boolean => closed || token !== probeToken || acceptStage !== 'probing';
    render();
    void Promise.resolve(
      effects().checkTool({
        toolId: invite.toolId,
        toolVersion: invite.toolVersion,
        engineVersion: invite.engineVersion,
      }),
    ).then(
      (probe) => {
        if (stale()) return;
        acceptProbe = probe;
        if (probe.status === 'missing') earlyCause = 'tool-missing';
        else if (probe.status === 'version-skew' && probe.severity === 'major') earlyCause = 'version-major-mismatch';
        else acceptStage = 'named';
        render();
      },
      () => {
        if (stale()) return;
        earlyCause = 'local-rtc-failed';
        render();
      },
    );
  }

  function runScan(kind: SignalKind): void {
    if (!opts.scan) return;
    void Promise.resolve(opts.scan()).then(
      (text) => {
        if (closed) return;
        if (!text) {
          setNotice(tRaw(STRINGS.scanNothing));
          return;
        }
        if (kind === 'invite') submitInvite(text);
        else submitReply(text);
      },
      () => {
        if (!closed) setNotice(tRaw(STRINGS.scanFailed));
      },
    );
  }

  function copy(act: string, text: string): void {
    const write = opts.copy
      ? opts.copy(text)
      : globalThis.navigator?.clipboard?.writeText(text);
    void Promise.resolve(write).then(
      () => {
        if (closed) return;
        copiedAct = act;
        speak(tRaw(STRINGS.copied));
        render();
      },
      () => { /* a refused clipboard leaves the code on screen to select by hand */ },
    );
  }

  // ── Screen selection ────────────────────────────────────────────────────────

  function currentCause(): CeremonyEndCause | null {
    if (earlyCause) return earlyCause;
    const state = machine?.state;
    if (state && state.phase === 'failed') return state.cause ?? 'local-rtc-failed';
    return null;
  }

  function screenOf(): Screen {
    if (currentCause()) return 'failed';
    const state = machine?.state;
    if (role === 'inviter') {
      if (!state || state.phase === 'idle') return 'name';
      switch (state.phase) {
        case 'creating-invite':
          return 'minting';
        case 'awaiting-answer':
        case 'reconnect-armed':
          if (state.arming) return 'minting';
          return advanced ? 'waiting' : 'invite';
        case 'applying-answer':
          return 'applying';
        case 'connecting':
          return 'connecting';
        case 'connected':
          return 'connected';
        default:
          return 'waiting';
      }
    }
    if (!state) {
      if (acceptStage === 'probing') return 'probing';
      if (acceptStage === 'named') return 'name';
      return 'paste';
    }
    switch (state.phase) {
      case 'awaiting-connection':
        return 'answer';
      case 'connected':
        return 'connected';
      default:
        return 'answering';
    }
  }

  /**
   * Which of the three steps a screen belongs to. The number is already inside each
   * heading, where a translator can move it; this is the same fact in a form that
   * survives translation, published as `data-cer-step` for tests and for anything
   * that wants to key off progress without parsing copy.
   *
   * Zero means "not a step", and the attribute is then left off entirely rather than
   * stamped with a number. Only the failure screen answers that way: it can be
   * reached from ANY point in the walk (an incompatible op-version is refused while
   * the acceptor is still on step 1), so the old catch-all `return 3` published a
   * ceremony that died at the start as though it had reached the end. Its heading
   * carries no step number either, so an absent attribute is the honest match.
   */
  function stepOf(screen: Screen): number {
    if (screen === 'failed') return 0;
    if (role === 'inviter') {
      if (screen === 'name' || screen === 'minting' || screen === 'invite') return 1;
      if (screen === 'waiting') return 2;
      return 3;
    }
    if (screen === 'paste' || screen === 'probing') return 1;
    if (screen === 'name') return 2;
    return 3;
  }

  // ── Small builders ──────────────────────────────────────────────────────────

  function heading(text: string): HTMLElement {
    const step = stepOf(painting);
    return node('h2', {
      class: 'modal-title',
      text,
      attrs: {
        tabindex: '-1',
        'data-cer-heading': '',
        ...(step ? { 'data-cer-step': String(step) } : {}),
      },
    });
  }

  function body(text: string): HTMLElement {
    return node('p', { class: 'modal-msg', text });
  }

  /**
   * An in-flight line. `role="status"` is kept as a second channel rather than the
   * primary one: it is built fresh with its text already in it, and a live region that
   * arrives populated is the classic case screen readers announce inconsistently - which
   * is what `speak()` and its persistent region exist to cover. Whether the two ever
   * double-speak needs a real browser to answer; both are polite, and a repeated short
   * line is a smaller failure than a missed one.
   */
  function status(text: string): HTMLElement {
    return node('p', { class: 'modal-msg', text, attrs: { role: 'status' } });
  }

  function warn(text: string): HTMLElement {
    return node('p', { class: 'note note--warning', text });
  }

  function button(act: string, text: string, primary = false): HTMLButtonElement {
    return node('button', {
      class: primary ? 'btn btn--primary' : 'btn',
      text,
      attrs: { type: 'button', 'data-act': act },
    });
  }

  function noticeLine(): HTMLElement | null {
    return notice ? node('p', { class: 'note note--error', text: notice, attrs: { role: 'status' } }) : null;
  }

  function actions(...kids: (Node | null)[]): HTMLElement {
    return node('div', { class: 'modal-actions' }, kids);
  }

  function cancelButton(): HTMLButtonElement {
    return button('cancel', tRaw(STRINGS.cancel));
  }

  /**
   * A rendered QR wrapped in a tap-to-enlarge button. The inner SVG is decorative (the
   * button carries the accessible name and the action); the visible hint tells a sighted
   * user it is tappable. Enlarging ({@link openQrZoom}) is the whole point of skin 2
   * (section 6.1) - a second device scans it from a distance.
   */
  function qrButton(label: string, qrEl: HTMLElement): HTMLButtonElement {
    const box = node('div', {
      class: 'collab-cer-qr',
      style: 'margin:0 auto;max-width:200px;line-height:0',
      attrs: { 'data-dynamic': '1' },
    }, [qrEl]);
    return node(
      'button',
      {
        class: 'collab-cer-qr-btn',
        style:
          'display:block;width:100%;margin:0;padding:8px;border:0;border-radius:10px;'
          + 'background:none;cursor:zoom-in;font:inherit;color:inherit',
        attrs: { type: 'button', 'data-act': 'zoom-qr', 'aria-label': tRaw(STRINGS.qrEnlarge, { label }) },
      },
      [
        box,
        node('span', {
          class: 'modal-msg',
          text: tRaw(STRINGS.qrEnlargeHint),
          style: 'display:block;margin:6px 0 0;text-align:center;font-size:12px',
        }),
      ],
    );
  }

  /**
   * A QR of `value`, or nothing at all when the host cannot draw one (section 11.27).
   *
   * Fills async only when it has to: the real renderer (`createQrElementRenderer`) returns
   * the element synchronously, so the common path appends during construction with no
   * flicker on a re-render; a promise-returning renderer is awaited and guarded on the
   * slot still being on screen. A value too large to scan comes back null (`qr-skin.ts`
   * refuses past version 10), and `emptyNote` - passed for the LINK tab, whose URL is the
   * one that can overflow - is shown in its place; the CODE tab passes none because base32
   * always fits.
   */
  function qrSlot(label: string, value: string, emptyNote?: string): HTMLElement | null {
    if (!opts.renderQr) return null;
    const slot = node('div', { class: 'collab-cer-qr-slot', style: 'margin:0 0 8px' });
    const note = (): HTMLElement =>
      node('p', { class: 'modal-msg', text: emptyNote ?? '', style: 'margin:0;text-align:center;font-size:12px' });
    const result = opts.renderQr(value);
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      void Promise.resolve(result).then(
        (el) => {
          if (!slot.isConnected) return;
          if (el) slot.replaceChildren(qrButton(label, el));
          else if (emptyNote) slot.replaceChildren(note());
        },
        () => { if (slot.isConnected && emptyNote) slot.replaceChildren(note()); },
      );
    } else if (result) {
      slot.appendChild(qrButton(label, result as HTMLElement));
    } else if (emptyNote) {
      slot.appendChild(note());
    }
    return slot;
  }

  /**
   * The invite (or reply) in two tabs, each a QR plus its copyable text: the LINK - a plain
   * phone camera opens it and lands on the join page - and the CODE, the base32 skin that
   * always fits a scannable QR and is read by Lolly's own scanner (the airgap path).
   *
   * BOTH panels are in the DOM at once, the inactive one `hidden`, so every copy target and
   * the paste fallback are always present (and `url-mode`'s own tests, which read both
   * tokens at once, keep working). The active tab's QR is the enlarge target ({@link qrZoom}),
   * set synchronously here off `qrTab` rather than in the async `qrSlot`.
   */
  function qrTabbedSlots(
    linkLabel: string, linkValue: string, linkCopyAct: string, linkCopyLabel: string,
    codeLabel: string, codeValue: string, codeCopyAct: string, codeCopyLabel: string,
  ): HTMLElement {
    qrZoom = qrTab === 'link' ? { label: linkLabel, value: linkValue } : { label: codeLabel, value: codeValue };

    const tab = (key: 'link' | 'code', text: string): HTMLButtonElement => {
      const on = qrTab === key;
      return node('button', {
        class: 'collab-cer-qr-tab',
        text,
        style:
          `flex:1;padding:8px 10px;border:0;border-bottom:2px solid ${on ? 'hsl(var(--primary, 222 47% 40%))' : 'transparent'};`
          + `background:none;cursor:pointer;font:inherit;font-weight:${on ? '650' : '400'};`
          + `color:${on ? 'inherit' : 'hsl(var(--muted-foreground, 0 0% 45%))'}`,
        attrs: {
          type: 'button',
          role: 'tab',
          'data-act': key === 'link' ? 'qr-tab-link' : 'qr-tab-code',
          'aria-selected': on ? 'true' : 'false',
        },
      });
    };

    const panel = (
      key: 'link' | 'code', qrLabel: string, value: string, copyAct: string, copyLabel: string, emptyNote?: string,
    ): HTMLElement =>
      node(
        'div',
        {
          style: 'padding-top:10px',
          attrs: { role: 'tabpanel', 'aria-label': qrLabel, ...(qrTab === key ? {} : { hidden: 'hidden' }) },
        },
        [
          qrSlot(qrLabel, value, emptyNote),
          node('div', { style: SLOT }, [
            node('code', { text: value, style: TOKEN, attrs: { 'data-dynamic': '1', 'data-token': copyAct } }),
            button(copyAct, copiedAct === copyAct ? tRaw(STRINGS.copied) : copyLabel),
          ]),
        ],
      );

    return node('div', { style: 'margin:0 0 10px' }, [
      node('div', {
        style: 'display:flex;gap:4px;margin:0 0 2px;border-bottom:1px solid hsl(var(--border, 0 0% 90%))',
        attrs: { role: 'tablist' },
      }, [tab('link', linkLabel), tab('code', codeLabel)]),
      panel('link', linkLabel, linkValue, linkCopyAct, linkCopyLabel, tRaw(STRINGS.qrLinkTooBig)),
      panel('code', codeLabel, codeValue, codeCopyAct, codeCopyLabel),
    ]);
  }

  /** Take down the enlarge overlay, if one is up. Idempotent - the close handler and the
   *  ceremony's own teardown both call it. */
  function closeQrZoom(): void {
    const dlg = qrZoomDialog;
    qrZoomDialog = null;
    if (!dlg) return;
    try {
      if (dlg.open) dlg.close();
    } catch {
      /* a dialog already removed is the goal either way */
    }
    dlg.remove();
  }

  /**
   * Blow the QR up to near-fullscreen for scanning (section 6.1 skin 2).
   *
   * A modal `<dialog>` stacked ABOVE the ceremony's own: the ceremony goes inert beneath
   * it, Escape closes this topmost one through the native `cancel` event (never the
   * ceremony - `mountModal` listens on its own element, and `cancel` fires on the top
   * dialog only), and a tap anywhere dismisses. The code is re-rendered at full size rather
   * than moved, so the small one on the step stays put underneath; the SVG is vector, so it
   * is crisp at any size. It carries its own dim ground rather than styling `::backdrop`, so
   * no stylesheet rule is needed.
   */
  function openQrZoom(label: string, value: string): void {
    if (!opts.renderQr || typeof document === 'undefined') return;
    closeQrZoom();
    const dlg = document.createElement('dialog');
    dlg.className = 'collab-qr-zoom';
    dlg.setAttribute('aria-label', label);
    dlg.setAttribute(
      'style',
      'inset:0;width:100vw;height:100dvh;max-width:100vw;max-height:100dvh;margin:0;padding:0;'
        + 'border:0;background:hsl(0 0% 4% / .92)',
    );
    // A white card so the required quiet zone stays light against the dim ground.
    const frame = node('div', {
      style: 'background:#fff;padding:16px;border-radius:16px;box-shadow:0 10px 50px hsl(0 0% 0% / .5);line-height:0',
    });
    dlg.appendChild(
      node(
        'div',
        {
          style:
            'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;'
            + 'width:100%;height:100%;box-sizing:border-box;padding:20px',
        },
        [
          frame,
          node('p', {
            text: tRaw(STRINGS.qrZoomDismiss),
            style: 'margin:0;max-width:36rem;text-align:center;color:#fff;font-size:14px',
          }),
        ],
      ),
    );
    void Promise.resolve(opts.renderQr(value)).then(
      (el) => {
        if (!el || !frame.isConnected) return;
        // The renderer sizes its wrapper to ~260px; a scan wants it as large as the shorter
        // viewport axis. The SVG inside is width:100% of this, so this is the only override.
        el.setAttribute('style', 'display:block;width:min(86vw, 76dvh);max-width:none;margin:0');
        frame.appendChild(el);
      },
      () => { /* nothing to enlarge; tap-to-close still clears the dim panel */ },
    );
    dlg.addEventListener('cancel', (event) => { event.preventDefault(); closeQrZoom(); });
    dlg.addEventListener('click', () => closeQrZoom());
    document.body.appendChild(dlg);
    qrZoomDialog = dlg;
    dlg.showModal();
  }

  /**
   * The connection plate, or nothing at all.
   *
   * `role="img"` + `aria-label` is the same device `qrSlot` uses, and here it is doing
   * real work rather than labelling a picture: it makes the element a leaf, so a screen
   * reader says the spaced-out {@link spokenPlate} form instead of pronouncing `LOL-123`
   * as a word and a number. The visible characters stay exactly as they are for the eye.
   *
   * `data-dynamic` marks the text as a value rather than copy, like the invite/reply
   * tokens - the plate is six characters of digest, and no catalog can contain it.
   */
  function plateSlot(): HTMLElement | null {
    if (!plateText) return null;
    return node('p', {
      text: plateText,
      style: PLATE,
      attrs: {
        'data-dynamic': '1',
        'data-cer-plate': '',
        role: 'img',
        'aria-label': tRaw(STRINGS.plateSpoken, { plate: spokenPlate(plateText) }),
      },
    });
  }

  function nameField(): HTMLElement {
    return node('div', { style: ROW }, [
      node('label', {
        text: tRaw(STRINGS.nameLabel),
        style: LABEL,
        attrs: { for: NAME_FIELD },
      }),
      node('input', {
        class: 'field-input',
        style: 'flex:1 1 12rem;min-width:0',
        attrs: {
          type: 'text',
          id: NAME_FIELD,
          value: nameValue,
          placeholder: tRaw(STRINGS.namePlaceholder),
          autocomplete: 'off',
          maxlength: '48',
        },
      }),
      node('span', {
        class: 'modal-msg',
        style: 'flex:0 0 100%;margin:0',
        text: tRaw(STRINGS.nameHelp, { fallback: fallbackName(role) }),
      }),
    ]);
  }

  function pasteField(id: string, label: string, placeholder: string): HTMLElement {
    const field = node('textarea', {
      class: 'field-input field-input--mono',
      style: 'flex:1 1 100%;min-height:4.5rem',
      attrs: { id, placeholder, rows: '3', spellcheck: 'false', autocomplete: 'off' },
    });
    // Re-seeded from the mirror, not left blank: this field is rebuilt by every render,
    // including the render that exists only to say the last paste was unreadable.
    field.value = pasted.get(id) ?? '';
    return node('div', { style: ROW }, [node('label', { text: label, style: LABEL, attrs: { for: id } }), field]);
  }

  function scanButton(): HTMLButtonElement | null {
    return opts.scan ? button('scan', tRaw(STRINGS.scan)) : null;
  }

  function peerName(): string {
    const chosen = machine?.state.peer?.name ?? acceptInvite?.name;
    return (chosen ?? '').trim() || fallbackName(role === 'inviter' ? 'acceptor' : 'inviter');
  }

  function toolLabel(): string {
    return acceptInvite?.toolId ?? opts.toolId ?? machine?.state.invite?.toolId ?? '';
  }

  function skewNote(): HTMLElement | null {
    const minor =
      machine?.state.toolVersionNote === 'minor-skew' ||
      (acceptProbe?.status === 'version-skew' && acceptProbe.severity === 'minor');
    return minor ? warn(tRaw(STRINGS.minorSkew, { tool: toolLabel() })) : null;
  }

  function observerNote(): HTMLElement | null {
    const gap =
      machine?.state.observerOnly ??
      (acceptInvite?.opVersion !== undefined && !isCompatibleOpVersion(acceptInvite.opVersion, localOpVersion));
    return gap ? warn(tRaw(STRINGS.observerOnly)) : null;
  }

  // ── Screens ─────────────────────────────────────────────────────────────────

  function buildInviteName(): (Node | null)[] {
    return [
      heading(tRaw(STRINGS.inviteNameHeading)),
      body(tRaw(STRINGS.inviteNameBody)),
      nameField(),
      noticeLine(),
      actions(cancelButton(), button('create-invite', tRaw(STRINGS.createInvite), true)),
    ];
  }

  function buildMinting(headingText: string, bodyText: string): (Node | null)[] {
    return [heading(headingText), status(bodyText), actions(cancelButton())];
  }

  /** Subscribe to the LAN peer list once, repainting on change (plans/110 section 3). */
  function ensureNearbySub(): void {
    if (!nearbyProvider || nearbyUnsub) return;
    nearbyUnsub = nearbyProvider.subscribePeers((peers) => {
      nearbyPeers = peers;
      if (!closed) render();
    });
  }

  /** The "tap a nearby device to hand over the invite" panel, or null when discovery is off
   *  (no LAN provider - every plain web build). Peer names arrive over the wire, so they go
   *  in as `textContent` via `node({text})`, never a markup sink. */
  function buildNearby(): HTMLElement | null {
    if (!nearbyProvider) return null;
    ensureNearbySub();
    const kids: (Node | null)[] = [node('p', { class: 'modal-label', text: tRaw(STRINGS.nearbyHeading) })];
    if (!nearbyVisible) kids.push(button('nearby-visible', tRaw(STRINGS.nearbyMakeVisible)));
    if (nearbyPeers.length) {
      kids.push(
        node(
          'div',
          { class: 'cer-nearby-peers', style: 'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0' },
          nearbyPeers.map((p) =>
            node('button', {
              class: 'btn',
              text: p.name,
              attrs: { type: 'button', 'data-act': 'nearby-pick', 'data-peer-id': p.id },
            }),
          ),
        ),
      );
    } else {
      kids.push(node('p', { class: 'modal-msg', text: tRaw(nearbyVisible ? STRINGS.nearbyEmpty : STRINGS.nearbyHint) }));
    }
    if (nearbyNote) kids.push(node('p', { class: 'modal-msg', attrs: { role: 'status' }, text: nearbyNote }));
    return node('div', { class: 'cer-nearby', style: 'margin:12px 0;padding-top:10px;border-top:1px solid hsl(var(--muted, 0 0% 90%))' }, kids);
  }

  function buildInvite(): (Node | null)[] {
    const invite = machine?.state.invite;
    const skins = presentSignal(invite?.signal ?? '', 'invite');
    const base = opts.linkBase ?? defaultLinkBase();
    return [
      heading(tRaw(STRINGS.inviteHeading)),
      body(tRaw(STRINGS.inviteBody)),
      qrTabbedSlots(
        tRaw(STRINGS.inviteLinkLabel), `${base}${JOIN_ROUTE}?${INVITE_PARAM}=${skins.link}`, 'copy-invite-link', tRaw(STRINGS.copyLink),
        tRaw(STRINGS.inviteCodeLabel), skins.qr, 'copy-invite-code', tRaw(STRINGS.copyCode),
      ),
      warn(tRaw(STRINGS.inviteTrust)),
      buildNearby(),
      noticeLine(),
      actions(cancelButton(), button('to-waiting', tRaw(STRINGS.toWaiting), true)),
    ];
  }

  function buildWaiting(): (Node | null)[] {
    const state = machine?.state;
    countdownEl = node('p', { class: 'modal-msg', style: 'margin:0 0 8px', attrs: { role: 'status' } });
    paintCountdown();
    scheduleTick();
    const retry = state?.retryNote ? warn(tRaw(STRINGS.replyRetry)) : null;
    const rearmed = (state?.rearms ?? 0) > 0 ? warn(tRaw(STRINGS.rearmed)) : null;
    return [
      heading(tRaw(STRINGS.waitHeading)),
      body(tRaw(STRINGS.waitBody)),
      countdownEl,
      rearmed,
      retry,
      pasteField(REPLY_FIELD, tRaw(STRINGS.replyLabel), tRaw(STRINGS.replyPlaceholder)),
      buildNearby(),
      noticeLine(),
      actions(
        button('show-invite', tRaw(STRINGS.showInvite)),
        button('new-invite', tRaw(STRINGS.newInvite)),
        scanButton(),
        cancelButton(),
        button('submit-reply', tRaw(STRINGS.connectAction), true),
      ),
    ];
  }

  function buildPaste(): (Node | null)[] {
    return [
      heading(tRaw(STRINGS.acceptHeading)),
      body(tRaw(STRINGS.acceptBody)),
      pasteField(INVITE_FIELD, tRaw(STRINGS.inviteFieldLabel), tRaw(STRINGS.invitePlaceholder)),
      noticeLine(),
      actions(scanButton(), cancelButton(), button('submit-invite', tRaw(STRINGS.checkInvite), true)),
    ];
  }

  function buildAcceptName(): (Node | null)[] {
    return [
      heading(tRaw(STRINGS.acceptNameHeading)),
      body(tRaw(STRINGS.acceptNameBody, { peer: peerName(), tool: toolLabel() })),
      skewNote(),
      observerNote(),
      nameField(),
      noticeLine(),
      actions(cancelButton(), button('join', tRaw(STRINGS.joinAction), true)),
    ];
  }

  function buildAnswer(): (Node | null)[] {
    const answer = machine?.state.answer;
    const skins = presentSignal(answer?.signal ?? '', 'answer');
    const base = opts.linkBase ?? defaultLinkBase();
    return [
      heading(tRaw(STRINGS.answerHeading)),
      body(tRaw(STRINGS.answerBody)),
      qrTabbedSlots(
        tRaw(STRINGS.answerLinkLabel), `${base}${REPLY_ROUTE}?${ANSWER_PARAM}=${skins.link}`, 'copy-answer-link', tRaw(STRINGS.copyReplyLink),
        tRaw(STRINGS.answerCodeLabel), skins.qr, 'copy-answer-code', tRaw(STRINGS.copyReplyCode),
      ),
      status(tRaw(STRINGS.answerWait)),
      skewNote(),
      observerNote(),
      noticeLine(),
      actions(cancelButton()),
    ];
  }

  /**
   * Connected - and the one screen in the ceremony that says something about the
   * connection's PRIVACY rather than its progress.
   *
   * The plate sits directly under "You are working with Sam", above the notes and the
   * button, for both roles: it is the last thing either person can act on before the
   * session starts, and putting it below a version warning would bury the check under the
   * caveats. The sentence follows the plate rather than leading it - there is nothing to
   * explain until there are six characters to explain.
   *
   * When there is no plate, both nodes are absent and the screen is precisely the one it
   * was before this wave. Nothing hints that something is missing, because nothing is: an
   * unconfirmable pairing is still a working pairing, and a placeholder where a plate goes
   * is an invitation to compare two placeholders.
   */
  function buildConnected(): (Node | null)[] {
    const plate = plateSlot();
    return [
      heading(tRaw(STRINGS.connectedHeading)),
      body(tRaw(STRINGS.connectedBody, { peer: peerName() })),
      plate,
      plate ? body(tRaw(STRINGS.plateBody)) : null,
      machine?.state.reconnecting ? warn(tRaw(STRINGS.reconnecting)) : null,
      skewNote(),
      observerNote(),
      actions(button('done', tRaw(STRINGS.startEditing), true)),
    ];
  }

  function buildFailed(cause: CeremonyEndCause): (Node | null)[] {
    const copyFor = failureCopy(cause, { tool: toolLabel() });
    return [
      heading(copyFor.title),
      body(copyFor.body),
      actions(copyFor.restarts ? button('restart', copyFor.action, true) : button('done', copyFor.action, true)),
    ];
  }

  function defaultLinkBase(): string {
    const loc = globalThis.location as Location | undefined;
    return loc ? `${loc.origin}${loc.pathname}` : '';
  }

  function buildScreen(screen: Screen): (Node | null)[] {
    switch (screen) {
      case 'name':
        return role === 'inviter' ? buildInviteName() : buildAcceptName();
      case 'minting':
        return buildMinting(tRaw(STRINGS.inviteMintHeading), tRaw(STRINGS.inviteMintBody));
      case 'invite':
        return buildInvite();
      case 'waiting':
        return buildWaiting();
      case 'applying':
        return buildMinting(tRaw(STRINGS.applyHeading), tRaw(STRINGS.applyBody));
      case 'connecting':
        return buildMinting(tRaw(STRINGS.connectHeading), tRaw(STRINGS.connectBody));
      case 'paste':
        return buildPaste();
      case 'probing':
        return buildMinting(tRaw(STRINGS.probeHeading), tRaw(STRINGS.probeBody, { tool: toolLabel() }));
      case 'answering':
        return buildMinting(tRaw(STRINGS.answerMintHeading), tRaw(STRINGS.answerMintBody));
      case 'answer':
        return buildAnswer();
      case 'connected':
        return buildConnected();
      case 'failed':
        return buildFailed(currentCause() ?? 'local-rtc-failed');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  /**
   * Two things reset on a phase edge rather than on every paint. A dropped
   * connection re-mints the invite (section 6.1, section 11.3), so the "I have sent it" step has to
   * rewind or the human keeps showing a code that no longer works - and the next
   * connection is a new session, so the handoff is allowed to fire again for it.
   */
  function syncPhase(phase: CeremonyState['phase'] | ''): void {
    if (phase === lastPhase) return;
    if (phase === 'reconnect-armed') advanced = false;
    if (lastPhase === 'connected' && phase !== 'connected') connectedFired = false;
    lastPhase = phase;
  }

  /**
   * Where focus and the caret were, keyed by something that survives the rebuild.
   * Every render replaces the whole screen, so the node holding focus is always gone
   * afterwards - which without this drops the user on `<body>` mid-ceremony.
   */
  interface Caret {
    readonly selector: string;
    readonly start: number | null;
    readonly end: number | null;
  }

  /** Any focusable node in the dialog; the selection members exist only on text controls. */
  interface FocusTarget extends HTMLElement {
    selectionStart?: number | null;
    selectionEnd?: number | null;
    setSelectionRange?(start: number, end: number): void;
  }

  function focusKey(el: Element): string | null {
    if (el.id) return `[id="${el.id}"]`;
    const act = el.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act) return `[data-act="${act}"]`;
    return el.hasAttribute('data-cer-heading') ? '[data-cer-heading]' : null;
  }

  function captureCaret(): Caret | null {
    const active = document.activeElement as FocusTarget | null;
    if (!active || !modal.el.contains(active)) return null;
    const selector = focusKey(active);
    if (!selector) return null;
    const start = typeof active.selectionStart === 'number' ? active.selectionStart : null;
    const end = typeof active.selectionEnd === 'number' ? active.selectionEnd : null;
    return { selector, start, end };
  }

  function restoreCaret(caret: Caret): void {
    const field = screenEl.querySelector<FocusTarget>(caret.selector);
    if (!field) return;
    field.focus();
    if (caret.start === null || typeof field.setSelectionRange !== 'function') return;
    try {
      field.setSelectionRange(caret.start, caret.end ?? caret.start);
    } catch {
      /* a control with no text selection (a button, say) simply keeps focus */
    }
  }

  /**
   * Say the screen: its heading, its first line of prose, and the plate if there is one.
   *
   * Read back off the DOM rather than composed from state, so the live region can only
   * ever repeat what is actually on screen. Called on a step change, and again by
   * `syncPlate` when a plate lands on a step that has already been announced.
   */
  function announceStep(): void {
    speak(
      screenEl.querySelector<HTMLElement>('[data-cer-heading]')?.textContent ?? '',
      screenEl.querySelector('.modal-msg')?.textContent ?? '',
      // The plate's `aria-label` rather than `plateText`: it is the spoken form already,
      // and taking it from the node means a derived plate that is not on this screen
      // cannot be announced as though it were.
      screenEl.querySelector('[data-cer-plate]')?.getAttribute('aria-label') ?? '',
    );
  }

  function render(): void {
    if (closed || !modal.el.isConnected) return;
    const state = machine?.state;
    if (state?.phase === 'closed') return;
    syncPhase(state?.phase ?? '');
    syncPlate();
    // Anchored to the armed invite, wherever the human happens to be looking.
    syncDeadline(`${state?.phase ?? ''}:${state?.rearms ?? 0}:${state?.invite?.signal ?? ''}`);
    syncInviteStamp(role === 'inviter' ? state?.invite?.signal ?? '' : '');

    const screen = screenOf();
    painting = screen;
    // Rebuilt below; `qrTabbedSlots` re-sets it for the active tab if this screen has QRs, so
    // the zoom handler never points at a QR that is no longer on screen.
    qrZoom = null;
    // The countdown element belongs to whichever render made it; drop the stale one
    // before rebuilding so a tick can never paint into a detached node.
    if (screen !== 'waiting') stopTick();
    else countdownEl = null;

    const caret = captureCaret();
    screenEl.replaceChildren(...buildScreen(screen).filter((n): n is Node => n !== null));

    const stepKey = `${screen}:${currentCause() ?? ''}`;
    if (stepKey !== lastStepKey) {
      lastStepKey = stepKey;
      screenEl.querySelector<HTMLElement>('[data-cer-heading]')?.focus();
      announceStep();
    } else if (caret) {
      // Same step, new nodes: a notice, a countdown re-arm, a machine transition that
      // did not change the screen. Whatever was being typed keeps the caret.
      restoreCaret(caret);
    }

    if (state?.phase === 'connected' && !connectedFired) {
      connectedFired = true;
      // The session takes the transport with the handle (see `releaseEffects`).
      if (opts.onConnected) handedOff = true;
      opts.onConnected?.({
        role,
        localName: resolveName(nameValue, role),
        peerName: peerName(),
        peer: state.peer,
        toolId: toolLabel() || undefined,
        invite: state.invite,
        answer: state.answer,
        observerOnly: state.observerOnly,
        toolVersionNote: state.toolVersionNote,
        state,
        close: () => modal.close(),
      });
    }

    // The acceptor's reply is minted the moment it reaches `awaiting-connection`. Hand it
    // straight back over the nearby channel (plans/110 section 3) rather than waiting for a scan.
    if (role === 'acceptor' && state?.answer && !answerFired) {
      answerFired = true;
      opts.onAnswer?.(state.answer.signal);
    }

    // The inviter's invite is minted once; hand it out over an out-of-band channel
    // (plans/138 Tier C rendezvous) the same one-shot way onAnswer hands back a reply.
    if (role === 'inviter' && state?.invite && !inviteFired) {
      inviteFired = true;
      opts.onInvite?.(state.invite.signal);
    }
  }

  // ── Wiring ──────────────────────────────────────────────────────────────────

  modal.el.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    const id = target?.id;
    if (!target || !id) return;
    if (id === NAME_FIELD) nameValue = target.value;
    else if (id === REPLY_FIELD || id === INVITE_FIELD) pasted.set(id, target.value);
  });

  modal.el.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const act = target?.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act) return;
    copiedAct = act.startsWith('copy-') ? copiedAct : '';

    switch (act) {
      case 'cancel':
        modal.close();
        return;
      case 'done':
        modal.close();
        return;
      case 'restart':
        restart();
        return;
      case 'nearby-visible': {
        if (nearbyProvider) {
          nearbyVisible = true;
          void nearbyProvider
            .setVisible(timedWindow(clock()), resolveName(nameValue, role))
            .catch(() => { nearbyVisible = false; });
          render();
        }
        return;
      }
      case 'nearby-pick': {
        // Hand the current invite to the tapped peer over the nearby channel, then feed the
        // reply it sends back through the SAME path a pasted reply takes (plans/110 section 3).
        const peerId = target?.closest<HTMLElement>('[data-peer-id]')?.dataset.peerId;
        const signal = machine?.state.invite?.signal;
        if (nearbyProvider && peerId && signal) {
          nearbyNote = tRaw(STRINGS.nearbyHandingOver);
          render();
          void nearbyProvider
            .exchangeInvite(peerId, signal)
            .then((reply) => { if (!closed) submitReply(reply); })
            .catch(() => { nearbyNote = tRaw(STRINGS.nearbyFailed); if (!closed) render(); });
        }
        return;
      }
      case 'create-invite': {
        nameValue = fieldValue(`#${NAME_FIELD}`);
        const started = machine ?? startMachine();
        started.send({ type: 'invite' });
        render();
        return;
      }
      case 'to-waiting':
        advanced = true;
        render();
        return;
      case 'show-invite':
        advanced = false;
        render();
        return;
      case 'new-invite':
        advanced = false;
        notice = '';
        machine?.send({ type: 'invite' });
        render();
        return;
      case 'submit-reply':
        submitReply(fieldValue(`#${REPLY_FIELD}`));
        return;
      case 'submit-invite':
        submitInvite(fieldValue(`#${INVITE_FIELD}`));
        return;
      case 'scan':
        runScan(role === 'inviter' ? 'answer' : 'invite');
        return;
      case 'zoom-qr':
        if (qrZoom) openQrZoom(qrZoom.label, qrZoom.value);
        return;
      case 'qr-tab-link':
        qrTab = 'link';
        render();
        return;
      case 'qr-tab-code':
        qrTab = 'code';
        render();
        return;
      case 'join': {
        nameValue = fieldValue(`#${NAME_FIELD}`);
        if (!acceptInvite) return;
        const started = startMachine();
        started.send({ type: 'accept', invite: acceptInvite });
        render();
        return;
      }
      case 'copy-invite-link':
      case 'copy-invite-code':
      case 'copy-answer-link':
      case 'copy-answer-code': {
        const token = modal.el.querySelector<HTMLElement>(`[data-token="${act}"]`)?.textContent ?? '';
        if (token) copy(act, token);
        return;
      }
      default:
        return;
    }
  });

  render();

  // The `collab` namespace (i18n.ts) carries this dialog's copy and is not on the boot
  // path. English is skipped OUTRIGHT rather than merely short-circuited inside
  // loadNamespace: the repaint below would be pure churn in the language the map is
  // already written in, and skipping it keeps an English build byte-identical to the
  // one before this wave. Every other language paints English for one microtask and
  // then repaints in place - the dialog has no motion and no focus move on a same-step
  // render (see `render`'s stepKey), so the swap is silent.
  if (currentLang() !== 'en') {
    void loadNamespace('collab').then(() => { if (!closed) render(); });
  }

  return {
    el: modal.el,
    close: () => modal.close(),
  };
}
