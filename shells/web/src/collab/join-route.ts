// SPDX-License-Identifier: MPL-2.0
/**
 * join-route - the two URL entry points of a private collab, and the platform
 * composition both ceremony roles share (plan 100 section 6.1 skin 1, section 11.25, section 11.26; wave 2.4).
 *
 * `components/collab-ceremony.ts` owns the screens and imports no platform. `collab/`'s
 * other modules own one platform piece each (the codec, the machine, the transport, the
 * QR). Nothing joined them up: the invite the dialog mints points at `#/join?inv=…`, and
 * until this file there was no `#/join`. This is the wiring, and it is deliberately the
 * only place that knows all four names at once.
 *
 * ── The two routes ─────────────────────────────────────────────────────────────
 *
 * **`#/join?inv=<token>`** - the acceptor's front door. It checks the `private-collab`
 * flag, reads the token, and refuses honestly when it cannot (section 11.21: this is a
 * stranger's link, so an unreadable one gets a plain error screen, never a thrown view).
 * It opens the ACCEPTOR ceremony with the invite already delivered. The human pasted it
 * by clicking the link, so making them paste it again would be pointless.
 *
 * **`#/join` with no `inv` at all** - the same door for the other skin. An invite is a
 * link OR a code (section 6.1), and the code half had nowhere to go: this route used to say
 * "this link carries no invite" and stop. That is a true sentence, but a dead end for
 * the one person it was shown to: somebody holding a code from a chat message. So a
 * bare `#/join` is now a paste card (one field, one button), reachable from the Share
 * dialog's "Join with a code" as well as from the address bar. It FORKS NOTHING: the
 * text goes through the same `readSignal` call the URL token goes through, then walks
 * the same path, delivery included. `inv=` present but EMPTY still gets the old
 * refusal, because that is a link that was built and then damaged, and it is worth
 * saying so.
 *
 * ── The flag gate has two answers, not one (section 6.3 enable-on-accept) ─────────────
 *
 * `private-collab` has been ON by default since 2026-08-10, so the ordinary arrival (a
 * fresh profile, a device that has never seen this feature) walks straight past this
 * gate into the ceremony. That is the whole point of the flip: an invite link is
 * received by someone who has never heard of the feature, and "turn it on in your
 * profile settings" used to dead-end the one moment they had a reason to care. Two
 * kinds of reader still reach the gate, and which branch they get depends on WHO
 * decided:
 *
 *   - **governed off** - a control plane HIDES the flag (`flagHidden`, meaning the
 *     org's `orgFlagGovernance` entry forces the value and no toggle exists for it).
 *     The organization decided, so the page says that, names it as the decider, and
 *     offers no button that would be a lie. A merely-defaulted flag is NOT this: an
 *     instance default the user could still change in their own profile leaves the
 *     decision with the user, so it takes the other branch.
 *   - **ungoverned** - nobody but the reader decides. Since the default is ON, this
 *     means they turned it OFF at some point (or their instance defaults it off
 *     without hiding the switch). They get the enable card: what a private collab is,
 *     in one paragraph, then "Turn on and continue" or "Not now". Turning it on writes
 *     the flag the way the profile toggle writes it (the profile record first, then
 *     the synchronous mirror), and falls straight through into the ceremony with the
 *     invite this route is already holding - no reload, no re-paste. The point is to
 *     offer, not to obey: an off switch someone chose is not a reason to dead-end
 *     them, and not a reason to quietly overrule them either.
 *
 * **The gate renders before the token is read, and that ordering is essential.** A
 * card that said "this invite is unreadable" to a flag-off reader would answer a
 * question about a stranger's link that nobody asked, and would let anyone probe which
 * tokens this build considers valid without ever turning the feature on. Both branches
 * paint the same card for a good invite and a mangled one; the verdict shows afterwards,
 * on the ordinary path, once the feature is actually on.
 *
 * **`#/join-reply?ans=<token>`** - section 11.25's fix for the ceremony's weak point. The
 * answer leg is the awkward half: the invite travels as a link the inviter chose to
 * send, but the reply has to travel BACK, and a blob pasted into a waiting dialog is
 * where pairs give up. So the reply is a link too. Clicking it opens a tab that hands
 * the payload to the tab holding the invite dialog over a `BroadcastChannel`, then gets
 * out of the way. Both legs are then click-or-paste-or-scan.
 *
 * ── One more thing the channel is used for: "did I make this invite?" ──────────
 *
 * Testing an invite in two tabs of one browser is a legitimate thing to do (it is how
 * this ceremony is drilled), and the app said nothing about it, so a person doing it
 * had no way to tell "this works" from "this device is talking to itself". `#/join`
 * now asks, on the same channel and in the same vocabulary ({@link inviteAskMessage}),
 * whether a window here minted the invite it is opening, and puts one dismissible line
 * above the flow if one says yes.
 *
 * It is INFORMATION and nothing else, and everything about how it is wired follows
 * from that: the question goes out AFTER the ceremony is already open and running, it
 * is never awaited, and silence (no channel, no listener, a listener that is busy) gets
 * the same screen as "not mine". A note that could delay or refuse a join would turn a
 * true observation into a gate over a workflow that already works.
 *
 * ── Why the handoff is a BroadcastChannel and not something cleverer ───────────
 *
 * The two tabs are the same origin on the same device, which is exactly the one thing
 * `BroadcastChannel` does with no server, no permission prompt, and no storage write.
 * It is also honest about failure: a channel with nobody listening stays silent, and
 * silence within {@link REPLY_ACK_WAIT_MS} tells this tab to say "the invite window is
 * not open" instead of spinning. The reply tab NEVER assumes it worked; it waits for
 * an ack from the tab that actually took the payload, and that ack is posted only once
 * the dialog has LEFT its paste step (a refused reply is not a delivered one).
 *
 * ── Why the payload is offered before it is sent ───────────────────────────────
 *
 * A `BroadcastChannel` post reaches every other same-origin context, and an SDP answer
 * is a valid answer to any offer: a reply broadcast raw would be swallowed by every tab
 * holding an invite dialog, and the ones it does not belong to would feed a foreign
 * answer to their own ceremony and die on the connect watchdog. Nothing in the payloads
 * can correct that afterwards - a `kind: 'answer'` blob carries only the acceptor's own
 * connection material (`collab/sdp-codec.ts`), with no back-reference to the invite it
 * answers - so the correlation has to be made on the channel, in three steps:
 *
 *   1. this tab posts an OFFER carrying a fresh request id, and no payload;
 *   2. every window whose dialog could actually take a reply BIDS with an id of its own;
 *   3. this tab hands the payload to exactly one bid, addressed to it by id.
 *
 * A window that did not win is never sent the reply at all, so it cannot be poisoned by
 * one. Two bids inside {@link REPLY_BID_WINDOW_MS} means this device has more than one
 * invite waiting, and the reply belongs to exactly one of them: the tab says so and
 * leaves the code to paste, because guessing would break the ceremony it guessed wrong
 * about. Zero bids is the "nobody home" case that was always handled.
 *
 * The delivery itself drives the dialog's OWN paste path ({@link deliverReplyToDialog}):
 * fill the field, press the button. It is not a private back door into the machine: a
 * reply arriving this way is validated by the same `readSignal` call, shows the same
 * notice when it is wrong, and leaves the same trace on screen as one a human pasted.
 * The two selectors that path needs are the dialog's public DOM surface, pinned by a
 * test that renders the real dialog rather than trusting this comment.
 *
 * ── Both routes are cancellable, and stamp that BEFORE they wait ───────────────
 *
 * `#view` is one persistent element (`main.ts`), so a route that paints after the router
 * has moved on does not paint a stale page: it destroys the live one. Both mounts here
 * wait (for an ack, for a profile read, for a camera probe), so both assign their
 * `_cleanup` before the first `await` and re-check `leaving` after every one. A teardown
 * assigned late is worse than none at all: by then it lands on the NEXT view's element
 * and silently replaces that view's own teardown.
 *
 * ── The shared composition ─────────────────────────────────────────────────────
 *
 * {@link createCollabEffects} is the one place the three platform pieces meet: the RTC
 * transport (`collab/rtc-transport.ts`) supplies `createOffer`/`createAnswer`/
 * `applyRemote` plus the ICE events without which no ceremony ever reaches `connected`.
 * The local catalog supplies `checkTool`, the probe section 6.1 requires BEFORE answering,
 * because peers send values and never code (section 11.22), so a tool this device does not
 * have gets a refusal rather than a degraded join. It is a FACTORY, not a bundle: the
 * acceptor names itself after the probe, and `restart` must get a genuinely fresh peer
 * connection.
 *
 * ── Copy ───────────────────────────────────────────────────────────────────────
 *
 * Same rule as the dialog: every user-visible string is in {@link STRINGS}, English for
 * now, batched into the wave-2.7 locale fan-out (section 11.28). Peer-supplied text reaches the
 * DOM only through `textContent`.
 */

import {
  INVITE_STAMP,
  openCollabCeremony,
  readSignal,
  type CeremonyConnectedHandle,
  type CeremonyEffectsBundle,
  type CeremonyEffectsContext,
  type CeremonyEffectsSource,
  type CollabCeremonyHandle,
  type CollabCeremonyOptions,
  type SignalView,
} from '../components/collab-ceremony.ts';
import { ANSWER_PARAM, INVITE_PARAM, MAX_TOKEN_CHARS } from './sdp-codec.ts';
import type { CeremonyRole, ToolProbeRequest, ToolProbeResult } from './ceremony.ts';
import { createRtcTransport, type RtcPeerConnectionCtor, type RtcTransport } from './rtc-transport.ts';
import { createQrElementRenderer, probeBarcodeDetector, scanQrFromVideo } from './qr-skin.ts';
import { flagHidden, isFlagOnSync, setFlagMirror, PRIVATE_COLLAB_FLAG } from '../feature-flags.ts';
import { getCollabClientId, initCollabClientId } from '../lib/collab-plumbing.ts';
import { deliverCollabConnection, releaseParked, type CollabConnection } from '../lib/collab-mount.ts';
import { rtcCollabConnection } from './rtc-connection.ts';
// The same id source the collab client id uses (`lib/collab-plumbing.ts`), and free:
// dependency-free, already in this chunk's import graph.
import { ulid } from '../lib/row-id.ts';
import type { CollabLaunchContext } from '../lib/collab-launch.ts';
import { announce } from '../a11y.ts';
import { loadNamespace, tRaw } from '../i18n.ts';
import { homeFabEl } from '../components/home-fab.ts';
import { createThemeToggle } from '../components/theme-toggle.ts';
// Deep-imported like `i18n.ts`'s `lang.ts` and `brand-vars.ts`'s `tokens.ts`: the engine
// barrel is one shared facade whose whole retained surface would land in this lazy chunk
// for a single version string.
import { ENGINE_VERSION } from '../../../../engine/src/version.ts';

// ── Copy ──────────────────────────────────────────────────────────────────────
//
// One map, one namespace. Every value here IS its own catalog key (i18n.ts looks a
// translation up by the English source), and every render site below reads it through
// `tRaw(…)` - `tRaw` rather than `t` because all of it lands in `textContent` or
// `announce()`, never an HTML sink. The translations ride the lazy `collab` namespace,
// awaited once at the top of each route mount before anything is painted.

export const STRINGS = {
  // The page behind the ceremony dialog on #/join.
  joinTitle: 'Join a collab',
  joinBody: 'Someone invited this device to edit a tool session with them, live and directly.',
  joinDone: 'This collab is closed. Nothing else is being shared.',
  backToTools: 'Back to the tools',

  // Refusals that happen before a ceremony can start.
  offTitle: 'Private collab is turned off on this device',
  offBody: 'Turn on "Private collab" in your profile settings, then open the invite link again.',

  // The flag gate on #/join, which has two answers (section 6.3 enable-on-accept). The
  // organization decided, or nobody but the reader did - and the second one is an
  // offer, not a refusal.
  governedTitle: 'Private collabs are turned off here',
  governedBody: 'The organization that runs this instance decides whether private collabs are allowed on it, and it has turned them off. This is not a setting on this device, so the invite cannot be opened here. Ask whoever runs the instance if this needs to change.',
  enableTitle: 'Turn on private collab to open this invite',
  enableBody: 'A private collab is live editing straight between this device and the device of the person who sent this link. Nothing goes through a server, and no account is needed. It is in beta, and it can be turned off again in the profile settings at any time.',
  enableAction: 'Turn on and continue',
  enableDecline: 'Not now',
  enableDone: 'Private collab is on. Opening the invite.',
  enableNotSaved: 'Private collab is on for this visit only. It could not be saved to this profile, so it may be off again next time.',
  declinedTitle: 'Private collab stays off',
  declinedBody: 'Nothing was turned on. The invite is still in this link, so it can be opened again from here at any time.',

  emptyTitle: 'This link carries no invite',
  emptyBody: 'The invite part of the link is missing. Ask for a fresh one.',
  unreadableTitle: 'This invite could not be read',
  unreadableBody: 'The link is incomplete, or something changed it on the way here. Ask for a fresh invite.',
  wrongKindTitle: 'That link is a reply, not an invite',
  wrongKindBody: 'A reply link only works on the device that made the invite.',

  // The code door - `#/join` with no invite in the link at all. One field, one button,
  // and the same decoder the link path runs.
  codeTitle: 'Join with an invite code',
  codeBody: 'Paste the invite you were sent. A code or a link both work here.',
  codeFieldLabel: 'Invite code or link',
  codePlaceholder: 'Paste the invite here',
  codeAction: 'Join',
  codeEmpty: 'Paste an invite code first.',
  codeUnreadable: 'That is not an invite from Lolly. Check the code and paste it again.',
  codeReplyTitle: 'That is a reply, not an invite',
  codeReplyBody: 'A reply goes back to the window that made the invite. Paste it there - that window is waiting for it.',
  codeRetry: 'Paste a different code',

  // The own-invite note. Informational, never a refusal.
  ownInvite: 'This invite was created on this device. Testing with two tabs works - or send the link to the other person.',
  ownInviteDismiss: 'Dismiss',

  // #/join-reply - the handoff (section 11.25).
  replyTitle: 'Sending the reply back',
  replyWorking: 'Handing the reply to the window that made the invite.',
  replyDelivered: 'Reply delivered. You can close this tab.',
  replyNoWindowTitle: 'The invite window is not open',
  replyNoWindowBody: 'This link only works on the device that made the invite, in the window where it is still waiting. Open it there, or copy the code below and paste it into that window.',
  replyManyTitle: 'More than one invite is waiting on this device',
  replyManyBody: 'This reply belongs to one of them, and handing it to the wrong one would break that collab. Copy the code below and paste it into the window that is waiting for it.',
  replyCodeLabel: 'Reply code',
  copyCode: 'Copy the code',
  copied: 'Copied',
  replyEmptyTitle: 'This link carries no reply',
  replyEmptyBody: 'The reply part of the link is missing. Ask for it again.',
  replyUnreadableTitle: 'This reply could not be read',
  replyUnreadableBody: 'The link is incomplete, or something changed it on the way here. Ask for it again.',
  replyWrongKindTitle: 'That link is an invite, not a reply',
  replyWrongKindBody: 'Open an invite link on the device you want to join with.',

  // Connected, with nothing yet registered to take the connection over.
  scaffold: 'Connected. Live editing arrives in the next step.',
} as const;

// ── Routes and timings ────────────────────────────────────────────────────────

/** The channel both tabs meet on. One name, two files (section 11.25). */
export const CEREMONY_CHANNEL_NAME = 'lolly-collab-ceremony';

/**
 * How long the reply tab waits for a tab to admit it took the payload.
 *
 * 800 ms is a same-device, same-origin postMessage plus one synchronous DOM drive, so it
 * is generous by two orders of magnitude - the number is sized for "a tab that is there
 * but busy", not for the wire. Waiting much longer would only make "nobody is listening"
 * feel like a hang, and that message is the useful one.
 */
export const REPLY_ACK_WAIT_MS = 800;

/**
 * How long the reply tab collects bids before handing the payload to one of them.
 *
 * The trade is stated in one line: this is added to the happy path so that a device with
 * two invites waiting is NOTICED rather than guessed at. A bid is a same-device
 * postMessage round trip, so 150 ms is roughly two orders of magnitude of headroom, and
 * it buys the difference between "one window is waiting" and "more than one is" - which
 * is the difference between a delivered reply and a broken ceremony.
 */
export const REPLY_BID_WINDOW_MS = 150;

/**
 * How long `#/join` waits to hear that this device is the one that made the invite.
 *
 * Nothing is gated on the answer, so this number buys a NOTE and nothing else: the
 * ceremony is already open and running while the question is out. Short for the same
 * reason the bid window is short - it is one same-origin postMessage round trip - and
 * silence is a perfectly good answer, because the overwhelmingly common case is an
 * invite that really did come from somebody else's device.
 */
export const OWN_INVITE_ASK_MS = 200;

/**
 * The version on every channel message. Two app versions may share a device (section 11.19).
 *
 * Bumped to 2 with the offer/bid/grant handoff below, and the bump is the point: a v1
 * tab left open from an older build would have read a v2 grant as a plain broadcast
 * reply and taken a payload addressed to somebody else. Ignoring each other outright is
 * the only safe way for the two protocols to share a device, and the cost of that is a
 * paste, which is the fallback this route already renders.
 */
export const CHANNEL_MESSAGE_VERSION = 2;

/** Cap on an id read off the channel. A ULID is 26; this is only a sanity bound. */
const MAX_ID_CHARS = 64;

/**
 * Where an invite or a reply link points: the app ROOT, not `location.pathname`.
 *
 * This is not tidiness, it is the difference between an invite that opens and one that
 * silently opens something else. A tool session canonicalises its address bar to the
 * path form `/t/<id>` (so a copied link carries the per-tool OG card), and production
 * serves a crawler stub at that exact path whose inline redirect does
 * `location.replace('/#/tool/<id>' + location.search)` - which DROPS the fragment. An
 * invite minted from a tool page with that pathname in its base would therefore land the
 * other device on the tool, with the invite gone and nothing to explain it. Nothing is
 * served in front of the root.
 *
 * `components/collab-ceremony.ts` defaults to `origin + pathname` because a dialog cannot
 * know its host's routing; supplying this is the shell's job, and both ceremony entry
 * points here do it.
 */
export function appLinkBase(): string {
  const loc = globalThis.location as Location | undefined;
  return loc ? `${loc.origin}/` : '';
}

/** The dialog's public DOM surface, as driven by the two delivery helpers below. */
export const INVITE_FIELD_SELECTOR = '#collab-cer-invite';
export const REPLY_FIELD_SELECTOR = '#collab-cer-reply';
export const SUBMIT_INVITE_ACT = '[data-act="submit-invite"]';
export const SUBMIT_REPLY_ACT = '[data-act="submit-reply"]';
export const TO_WAITING_ACT = '[data-act="to-waiting"]';
/**
 * Where an inviter dialog states the invite it minted, in the LINK skin.
 *
 * A stable attribute on the dialog element rather than the invite screen's own token
 * slot, and that is the whole point: the slot exists on step 1 only, so a dialog that
 * has moved on to the reply step would answer "no, not mine" to a question it is the
 * only window that can answer. Pinned against the real dialog by this route's suite.
 *
 * Derived from the dialog's own constant rather than spelled again here: one name, one
 * definition, so the two files cannot drift into disagreeing about it silently.
 */
export const INVITE_STAMP_SELECTOR = `[${INVITE_STAMP}]`;

/** The code door's own surface, so a test drives it the way a human does. */
export const CODE_FIELD_ID = 'collab-join-code';
export const CODE_FIELD_SELECTOR = '#collab-join-code';
export const SUBMIT_CODE_ACT = '[data-act="submit-code"]';

// ── The BroadcastChannel handoff (section 11.25) ─────────────────────────────────────

/** The slice of `BroadcastChannel` this file uses; a test's fake satisfies it. */
export interface CeremonyChannelLike {
  postMessage(data: unknown): void;
  addEventListener(type: 'message', fn: (event: { data?: unknown }) => void): void;
  removeEventListener(type: 'message', fn: (event: { data?: unknown }) => void): void;
  close(): void;
}

export type ChannelFactory = (name: string) => CeremonyChannelLike | null;

/**
 * Open the ceremony channel, or `null` where `BroadcastChannel` does not exist.
 *
 * Null is a supported answer, not an error: the reply-link skin is one of three (section 6.1),
 * and a browser without the API still has paste and scan. The route says so in words
 * rather than failing.
 */
export function openCeremonyChannel(make?: ChannelFactory): CeremonyChannelLike | null {
  if (make) return make(CEREMONY_CHANNEL_NAME);
  const ctor = (globalThis as { BroadcastChannel?: new (name: string) => CeremonyChannelLike }).BroadcastChannel;
  if (typeof ctor !== 'function') return null;
  try {
    return new ctor(CEREMONY_CHANNEL_NAME);
  } catch {
    return null;
  }
}

/** Who a grant is addressed to: this handoff, and the bid that won it. */
export interface ReplyTarget {
  /** The reply tab's id for this handoff, echoed back on the ack. */
  readonly rid: string;
  /** The winning window's own id. */
  readonly bid: string;
}

/** "I have a reply for whoever is waiting for one." No payload - see the header. */
export function replyOfferMessage(rid: string): Record<string, unknown> {
  return { type: 'collab-reply-offer', v: CHANNEL_MESSAGE_VERSION, rid };
}

/** "I am a window that can take it." One per open dialog that could accept a reply. */
export function replyBidMessage(rid: string, bid: string): Record<string, unknown> {
  return { type: 'collab-reply-bid', v: CHANNEL_MESSAGE_VERSION, rid, bid };
}

/** The payload, addressed to the one window that won the bid. */
export function replyMessage(signal: string, to: ReplyTarget): Record<string, unknown> {
  return { type: 'collab-reply', v: CHANNEL_MESSAGE_VERSION, signal, rid: to.rid, to: to.bid };
}

/** The acknowledgement the tab that TOOK the reply posts back. */
export function replyAckMessage(rid: string): Record<string, unknown> {
  return { type: 'collab-reply-ack', v: CHANNEL_MESSAGE_VERSION, rid };
}

/**
 * "Did a window on this device MINT this invite?" - the own-invite ask.
 *
 * Two more words in the same vocabulary, at the same version, read by the same total
 * parsers. Nothing about the ceremony depends on the answer: it decides one sentence on
 * the acceptor's screen, which is why the question can be asked in the open like this
 * and why silence needs no handling beyond "say nothing".
 *
 * The invite token travels in the ask rather than a digest of it. It is the same token
 * this tab's own address bar is holding, on a channel no other origin can reach, so a
 * hash would buy nothing but a second thing that could disagree with itself.
 */
export function inviteAskMessage(rid: string, inv: string): Record<string, unknown> {
  return { type: 'collab-invite-ask', v: CHANNEL_MESSAGE_VERSION, rid, inv };
}

/** "Yes - that is the invite this window minted." */
export function inviteAckMessage(rid: string): Record<string, unknown> {
  return { type: 'collab-invite-ack', v: CHANNEL_MESSAGE_VERSION, rid };
}

function messageBag(data: unknown): Record<string, unknown> | null {
  return data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : null;
}

/** An own, string, non-empty, bounded field - or null. Same rules as the signal below. */
function bagId(bag: Record<string, unknown> | null, key: string): string | null {
  if (!bag || !Object.hasOwn(bag, key)) return null;
  const value = bag[key];
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_ID_CHARS) return null;
  return value;
}

/** Our kind of message, at our version - own properties only, like every field here. */
function isOurs(bag: Record<string, unknown> | null, type: string): boolean {
  if (!bag || !Object.hasOwn(bag, 'type') || !Object.hasOwn(bag, 'v')) return false;
  return bag.type === type && bag.v === CHANNEL_MESSAGE_VERSION;
}

/**
 * The signal inside a reply message, or null.
 *
 * Total and own-property-only. Another tab is not a stranger, but it is not this
 * function either: a message shaped by a different app version, an extension, or a page
 * that simply reuses the channel name must read as "not for us", never as a throw inside
 * a `message` listener.
 */
export function readReplyMessage(data: unknown): string | null {
  const bag = messageBag(data);
  if (!bag || !Object.hasOwn(bag, 'signal')) return null;
  if (!isOurs(bag, 'collab-reply')) return null;
  const signal = bag.signal;
  if (typeof signal !== 'string' || signal.length === 0 || signal.length > MAX_TOKEN_CHARS) return null;
  return signal;
}

/**
 * The request id inside an offer, or null.
 *
 * An offer is the one message on this channel that carries nothing worth having, which
 * is exactly why it can be broadcast: it says "somebody has a reply", and the windows
 * that could take one answer for themselves.
 */
export function readReplyOffer(data: unknown): string | null {
  const bag = messageBag(data);
  return isOurs(bag, 'collab-reply-offer') ? bagId(bag, 'rid') : null;
}

/** The bidder's id inside a bid for THIS handoff, or null. */
export function readReplyBid(data: unknown, rid: string): string | null {
  const bag = messageBag(data);
  if (!isOurs(bag, 'collab-reply-bid') || bagId(bag, 'rid') !== rid) return null;
  return bagId(bag, 'bid');
}

/**
 * The payload inside a grant addressed to `bid`, or null.
 *
 * The `to` check is the whole correlation: a grant meant for another window reads as
 * "not for us" here and is dropped before it can reach a dialog, which is the difference
 * between one tab taking the reply and every tab taking it.
 */
export function readReplyGrant(data: unknown, bid: string): { rid: string; signal: string } | null {
  const bag = messageBag(data);
  if (bagId(bag, 'to') !== bid) return null;
  const rid = bagId(bag, 'rid');
  const signal = readReplyMessage(data);
  if (rid === null || signal === null) return null;
  return { rid, signal };
}

/** Whether a message is the ack this handoff is waiting for. */
export function isReplyAck(data: unknown, rid?: string): boolean {
  const bag = messageBag(data);
  if (!isOurs(bag, 'collab-reply-ack')) return false;
  return rid === undefined || bagId(bag, 'rid') === rid;
}

/**
 * The ask inside an own-invite question, or null. Total, own-property-only, bounded - 
 * the same rules the reply parsers hold, for the same reason (another tab is not a
 * stranger, but it is not this function either).
 */
export function readInviteAsk(data: unknown): { rid: string; inv: string } | null {
  const bag = messageBag(data);
  if (!isOurs(bag, 'collab-invite-ask') || !bag || !Object.hasOwn(bag, 'inv')) return null;
  const rid = bagId(bag, 'rid');
  const inv = bag.inv;
  if (rid === null || typeof inv !== 'string' || inv.length === 0 || inv.length > MAX_TOKEN_CHARS) return null;
  return { rid, inv };
}

/** Whether a message answers THIS own-invite ask. */
export function isInviteAck(data: unknown, rid: string): boolean {
  const bag = messageBag(data);
  return isOurs(bag, 'collab-invite-ack') && bagId(bag, 'rid') === rid;
}

// ── Driving the dialog's own paste path ───────────────────────────────────────

function fillField(root: ParentNode, selector: string, text: string): boolean {
  const field = root.querySelector<HTMLTextAreaElement>(selector);
  if (!field) return false;
  field.value = text;
  // The dialog mirrors what is typed so a re-render cannot eat it; an assigned `.value`
  // fires no event, so the mirror is told by hand. Built from the field's OWN window so
  // this works in a shell where `Event` is not a global.
  const win = field.ownerDocument?.defaultView;
  if (win) field.dispatchEvent(new win.Event('input', { bubbles: true }));
  return true;
}

function press(root: ParentNode, selector: string): boolean {
  const button = root.querySelector<HTMLElement>(selector);
  if (!button) return false;
  button.click();
  return true;
}

/**
 * Put an invite into an open ACCEPTOR dialog exactly as a paste would.
 *
 * Used on `#/join`, where the human already made the "yes, this invite" gesture by
 * clicking the link. The dialog still decodes it, still probes the tool, and still shows
 * its own refusal if either fails - this only saves a paste, it does not skip a check.
 */
export function deliverInviteToDialog(dialog: ParentNode, text: string): boolean {
  if (!fillField(dialog, INVITE_FIELD_SELECTOR, text)) return false;
  return press(dialog, SUBMIT_INVITE_ACT);
}

/**
 * Whether this dialog is in a state where a reply could land at all.
 *
 * The reply field is step 2's; step 1 still shows the invite and reaches step 2 through
 * `to-waiting`. Every other screen - the acceptor's whole flow, a connected pair, a
 * failure - has neither, and a window in one of those must not bid for a payload it
 * would only drop.
 */
export function canTakeReply(dialog: ParentNode): boolean {
  return dialog.querySelector(REPLY_FIELD_SELECTOR) !== null || dialog.querySelector(TO_WAITING_ACT) !== null;
}

/**
 * Put a reply into an open INVITER dialog exactly as a paste would (section 11.25).
 *
 * The reply field lives on step 2, and the dialog may still be sitting on step 1 showing
 * the invite ("I have not sent it yet"), so the step is advanced first through the same
 * button a human would press. Returns false when there is no dialog in a state to take
 * it - which is precisely when the reply tab must NOT be told it worked.
 *
 * "Took it" is read off the dialog, not off the button press. `submitReply` renders its
 * refusal in place (the field, and the text in it, stay put) and the machine ignores an
 * answer arriving in a phase that cannot use one - both of which press a button that
 * exists and change nothing. Leaving the paste step is the observable fact that the
 * reply was accepted, and it is the fact the ack is allowed to claim.
 */
export function deliverReplyToDialog(dialog: ParentNode, text: string): boolean {
  if (!dialog.querySelector(REPLY_FIELD_SELECTOR)) press(dialog, TO_WAITING_ACT);
  if (!fillField(dialog, REPLY_FIELD_SELECTOR, text)) return false;
  if (!press(dialog, SUBMIT_REPLY_ACT)) return false;
  return dialog.querySelector(REPLY_FIELD_SELECTOR) === null;
}

/**
 * The invite an open dialog says it minted, in the link skin, or `''`.
 *
 * Read off {@link INVITE_STAMP_SELECTOR}, which the dialog carries for the whole life of
 * an inviter ceremony. An acceptor dialog has no stamp, which is the right answer: it
 * minted nothing, so it is nobody's own invite.
 */
export function dialogInvite(dialog: ParentNode): string {
  const el = (dialog as Element).querySelector?.(INVITE_STAMP_SELECTOR)
    ?? ((dialog as Element).matches?.(INVITE_STAMP_SELECTOR) ? (dialog as Element) : null);
  return el?.getAttribute(INVITE_STAMP) ?? '';
}

/**
 * Answer "is this invite mine?" on behalf of an open dialog.
 *
 * The dual of {@link askOwnInvite}, and deliberately the thinner half: a window either
 * minted the exact invite being asked about or it says nothing at all. Silence is the
 * default and the safe answer - an ack that a window guessed at would put a note on
 * somebody's screen telling them their collab is not real when it is.
 *
 * Split out from {@link listenForReply} rather than folded into it because the two
 * questions are independent: this one costs no payload, is answerable from any screen,
 * and is the only one an ACCEPTOR dialog could ever be asked about (it answers no).
 */
export function answerInviteAsks(
  channel: CeremonyChannelLike,
  dialog: () => ParentNode | null,
): () => void {
  const onMessage = (event: { data?: unknown }): void => {
    const ask = readInviteAsk(event?.data);
    if (!ask) return;
    const open = dialog();
    if (!open || dialogInvite(open) !== ask.inv) return;
    try {
      channel.postMessage(inviteAckMessage(ask.rid));
    } catch { /* the asking tab simply never hears back, and says nothing */ }
  };
  channel.addEventListener('message', onMessage);
  return () => channel.removeEventListener('message', onMessage);
}

/**
 * Answer `#/join-reply` tabs on behalf of an open dialog (section 11.25).
 *
 * Wired by whoever opened the INVITER ceremony, for as long as that dialog is open. Two
 * messages matter here: an OFFER, which is bid for only when the dialog could actually
 * take a reply, and the GRANT that names this window's bid. Anything addressed to
 * another window is not read as a reply at all - see the header on why a raw broadcast
 * could not be. The ack is posted only when the payload actually landed, because the
 * other tab's whole "did anyone take this?" answer is that ack. Returns the teardown.
 *
 * The own-invite ask rides the same wiring ({@link answerInviteAsks}), so a caller that
 * has an open ceremony answers both of the questions another window can ask about it by
 * calling one function. One teardown, both listeners.
 */
export function listenForReply(
  channel: CeremonyChannelLike,
  dialog: () => ParentNode | null,
): () => void {
  const stopAsks = answerInviteAsks(channel, dialog);
  // One id per listener, so it is one id per open dialog. It never leaves the device and
  // is not a secret: it correlates a grant with the window that asked for it, nothing else.
  const bid = ulid();
  const post = (message: Record<string, unknown>): void => {
    try {
      channel.postMessage(message);
    } catch { /* the other tab falls back to its paste guidance */ }
  };
  const onMessage = (event: { data?: unknown }): void => {
    const offered = readReplyOffer(event?.data);
    if (offered !== null) {
      const waiting = dialog();
      if (waiting && canTakeReply(waiting)) post(replyBidMessage(offered, bid));
      return;
    }
    const grant = readReplyGrant(event?.data, bid);
    if (!grant) return;
    const target = dialog();
    if (!target) return;
    if (!deliverReplyToDialog(target, grant.signal)) return;
    post(replyAckMessage(grant.rid));
  };
  channel.addEventListener('message', onMessage);
  return () => {
    stopAsks();
    channel.removeEventListener('message', onMessage);
  };
}

/**
 * Ask whether a window on this device minted this invite, and resolve with the answer.
 *
 * NEVER blocks anything: the caller fires this beside an already-open ceremony and
 * spends the answer on one note. `false` is returned for silence, for a channel that
 * cannot be posted to, and for a teardown - three different reasons to say nothing,
 * which is the same thing on screen.
 */
export function askOwnInvite(
  channel: CeremonyChannelLike,
  inv: string,
  waitMs = OWN_INVITE_ASK_MS,
): Promise<boolean> {
  const rid = ulid();
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (mine: boolean): void => {
      if (settled) return;
      settled = true;
      channel.removeEventListener('message', onMessage);
      if (timer !== undefined) globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>);
      resolve(mine);
    };
    const onMessage = (event: { data?: unknown }): void => {
      if (isInviteAck(event?.data, rid)) finish(true);
    };
    let timer: unknown;
    channel.addEventListener('message', onMessage);
    try {
      channel.postMessage(inviteAskMessage(rid, inv));
    } catch {
      finish(false);
      return;
    }
    // Only if a same-tick ack has not already settled it - a fake channel in a test
    // delivers synchronously, and a timer left armed there would outlive the test.
    if (!settled) timer = globalThis.setTimeout(() => finish(false), waitMs);
  });
}

// ── The local tool probe (section 6.1) ───────────────────────────────────────────────

/** One row of `window.__toolIndex`, as far as the probe cares. */
export interface ProbeToolEntry {
  readonly id?: unknown;
  readonly version?: unknown;
}

function localTools(): readonly ProbeToolEntry[] {
  if (typeof window === 'undefined') return [];
  const tools = (window as Window & { __toolIndex?: { tools?: unknown } }).__toolIndex?.tools;
  return Array.isArray(tools) ? (tools as readonly ProbeToolEntry[]) : [];
}

function majorOf(version: unknown): number | null {
  if (typeof version !== 'string') return null;
  const major = /^(\d{1,4})\./.exec(version.trim());
  return major ? Number(major[1]) : null;
}

/**
 * Does this device have the invited tool, and at a version that can co-edit?
 *
 * A LINEAR SCAN, not a map lookup. `sdp-codec` already refuses `__proto__` /
 * `constructor` / `prototype` as tool ids for exactly this reason, and a scan means the
 * probe stays correct even if a future decoder is more permissive than today's.
 *
 * Engine version is deliberately NOT judged here. A tool's own `engineVersion` range is
 * enforced by the loader when the tool is opened (`loadTool`, engine 1.53+), so a device
 * that has the tool has already agreed with its own engine about it; refusing a pairing
 * on the PEER's engine version would refuse pairings that work.
 */
export function probeLocalTool(req: ToolProbeRequest, tools: readonly ProbeToolEntry[] = localTools()): ToolProbeResult {
  let found: ProbeToolEntry | null = null;
  for (const tool of tools) {
    if (tool && tool.id === req.toolId) { found = tool; break; }
  }
  if (!found) return { status: 'missing' };
  const localVersion = typeof found.version === 'string' ? found.version : undefined;
  const remote = req.toolVersion;
  if (!localVersion || typeof remote !== 'string' || remote === localVersion) return { status: 'have' };
  const localMajor = majorOf(localVersion);
  const remoteMajor = majorOf(remote);
  // An unparseable version on either side is not evidence of a gap: say "have" and let
  // the pair discover any real incompatibility through the unknown-key rules (section 11.11).
  if (localMajor === null || remoteMajor === null) return { status: 'have' };
  return localMajor === remoteMajor
    ? { status: 'version-skew', severity: 'minor', localVersion }
    : { status: 'version-skew', severity: 'major', localVersion };
}

// ── The shared platform composition ───────────────────────────────────────────

export interface CollabEffectsOptions {
  /** The tool the invite advertises. Inviter only; the acceptor reads it off the invite. */
  readonly toolId?: string;
  /** Its local version, for the peer's own probe. Defaults to this device's index entry. */
  readonly toolVersion?: string;
  /**
   * Packed session seed, carried in band on the ops hello (section 6.1, section 12 Q3).
   *
   * Left absent by every caller in this wave. Seeding the acceptor's copy is the live
   * session's business, and inventing a shape here that the mount then has to honour
   * would be a contract minted by scaffolding.
   */
  readonly seed?: string;
  /** This device's collab client id. Defaults to the per-device persisted ULID (section 11.23). */
  readonly clientId?: string;
  /** Peer-connection constructor. Tests pass a fake; production passes nothing. */
  readonly rtc?: RtcPeerConnectionCtor | null;
  /** Override the catalog probe. Tests, and any shell whose catalog is not `window`-shaped. */
  readonly probe?: (req: ToolProbeRequest) => ToolProbeResult | Promise<ToolProbeResult>;
  /**
   * Called with each transport as it is built - once per ceremony, again after a
   * `restart`. The dialog hands the CHANNEL to `onConnected` but not the object that
   * owns it, so this is the only way the caller can pass it to the mount (see
   * `lib/collab-mount.ts`'s note on who may hang up).
   */
  readonly onTransport?: (transport: RtcTransport) => void;
  /** Diagnostics. Never user copy. */
  readonly log?: (message: string, detail?: unknown) => void;
}

/** This device's version of a tool, for the invite's metadata. */
function localToolVersion(toolId: string | undefined): string | undefined {
  if (!toolId) return undefined;
  for (const tool of localTools()) {
    if (tool && tool.id === toolId && typeof tool.version === 'string') return tool.version;
  }
  return undefined;
}

/**
 * The `effects` a ceremony dialog needs, as a FACTORY.
 *
 * A factory rather than a bundle for two reasons the dialog's own header states: the
 * acceptor names itself AFTER the tool probe, so the transport must read the name through
 * `ctx.name()` at mint time rather than capturing whatever the profile prefilled; and
 * `restart` releases the old bundle and asks again, which is what makes "Try again" a
 * genuinely fresh peer connection instead of a spent one.
 */
export function createCollabEffects(opts: CollabEffectsOptions = {}): (ctx: CeremonyEffectsContext) => CeremonyEffectsBundle {
  const probe = opts.probe ?? probeLocalTool;
  return (ctx) => {
    const transport = createRtcTransport({
      role: ctx.role,
      clientId: opts.clientId ?? getCollabClientId(),
      self: { name: () => ctx.name() },
      // Only the inviter mints an invite, so only the inviter needs a tool ref.
      tool: ctx.role === 'inviter' && opts.toolId
        ? { id: opts.toolId, version: opts.toolVersion ?? localToolVersion(opts.toolId), engineVersion: ENGINE_VERSION }
        : undefined,
      seed: opts.seed,
      rtc: opts.rtc,
      log: opts.log,
    });
    opts.onTransport?.(transport);
    return {
      ...transport.effects,
      checkTool: (req) => Promise.resolve(probe(req)),
      // Without this the dialog renders a perfect ceremony that can only ever end on a
      // watchdog: `connected` is reached from an ICE event and nothing else.
      events: (send) => transport.onCeremonyEvent(send),
      close: () => transport.close(),
    };
  };
}

// ── QR skins, probe-gated (section 11.27) ────────────────────────────────────────────

/**
 * A camera scan, or `undefined` where this browser cannot decode one.
 *
 * `undefined` is the whole progressive-capability story: the dialog hides the Scan
 * button entirely rather than offering one that opens a camera and never decodes
 * (BarcodeDetector is Chromium-only, and even there a platform with no barcode backend
 * reports zero formats).
 *
 * The camera is this file's business, not `qr-skin.ts`'s: acquisition, a visible preview
 * (scanning blind is not scanning), and stopping every track on every exit path.
 */
export async function makeCameraScan(signal: AbortSignal): Promise<(() => Promise<string | null>) | undefined> {
  const capability = await probeBarcodeDetector().catch(() => null);
  if (!capability?.supported) return undefined;
  const media = globalThis.navigator?.mediaDevices;
  if (!media?.getUserMedia) return undefined;

  return async () => {
    let stream: MediaStream | null = null;
    let preview: HTMLElement | null = null;
    try {
      stream = await media.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;
      void video.play().catch(() => { /* a refused autoplay still yields frames to read */ });
      preview = document.createElement('div');
      preview.className = 'collab-scan-preview';
      preview.setAttribute(
        'style',
        'position:fixed;inset:auto 16px 16px auto;z-index:1000;width:min(220px,40vw);border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgb(0 0 0 / .35)',
      );
      video.setAttribute('style', 'display:block;width:100%;height:auto');
      preview.appendChild(video);
      document.body.appendChild(preview);
      return await scanQrFromVideo(video, { signal });
    } catch {
      // A denied camera is not a failure of the ceremony - the dialog says so and the
      // paste field is right there.
      return null;
    } finally {
      preview?.remove();
      for (const track of stream?.getTracks() ?? []) track.stop();
    }
  };
}

// ── Handing a live pair on ────────────────────────────────────────────────────

/**
 * Route a connected ceremony to whatever owns co-editing, and tell the truth when
 * nothing does yet.
 *
 * Nothing owning co-editing is the developer case, not a shipped one: `main.ts` installs
 * the live mount on every boot. When there is none, the pair gets a sentence rather than a
 * dialog that looks finished, and the connection is PARKED rather than dropped so the
 * stitch can adopt it (`lib/collab-mount.ts`).
 */
export function handOffConnection(conn: CollabConnection, dialog: ParentNode | null): boolean {
  const mounted = deliverCollabConnection(conn);
  if (mounted) return true;
  if (dialog) appendScaffoldNote(dialog);
  announce(tRaw(STRINGS.scaffold));
  return false;
}

/**
 * The scaffold note, appended to the dialog rather than rendered into a screen.
 *
 * The dialog rebuilds its screen on every render; a node appended to the `<dialog>`
 * itself sits beside that subtree and survives, which is what makes this a note the
 * dialog's own code does not have to know about. Idempotent.
 */
export function appendScaffoldNote(dialog: ParentNode): void {
  const el = dialog as Element;
  if (el.querySelector?.('[data-collab-scaffold]')) return;
  const note = document.createElement('p');
  note.className = 'note';
  note.setAttribute('data-collab-scaffold', '');
  note.setAttribute('style', 'margin:0 12px 12px');
  note.textContent = tRaw(STRINGS.scaffold);
  el.append(note);
}

/**
 * "This invite was made here" - one dismissible line above the ceremony.
 *
 * PREPENDED to the dialog, for the same reason the scaffold note is appended to it: the
 * screen subtree is rebuilt on every render and a note inside it would vanish on the
 * next machine event, while a sibling of that subtree survives and needs no cooperation
 * from the dialog's own code. Above it, because the note is context for the whole flow
 * rather than a remark about the current step.
 *
 * It is INFORMATION, not a warning, and there is deliberately no action on it beyond
 * dismissing: testing an invite in two tabs of one browser is a legitimate thing to do
 * (it is how this ceremony is drilled), and a screen that blocked it would be wrong.
 * Idempotent.
 */
export function noteOwnInvite(dialog: ParentNode): void {
  const el = dialog as Element;
  if (el.querySelector?.('[data-collab-own-invite]')) return;
  const dismiss = node('button', {
    class: 'btn btn--sm',
    text: tRaw(STRINGS.ownInviteDismiss),
    attrs: { type: 'button', 'data-act': 'dismiss-own-invite' },
  });
  const note = node('p', {
    class: 'note',
    style: 'margin:12px 12px 0;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap',
    // `role="status"` rather than the shell's `announce()`: this lands INSIDE a
    // `showModal()` dialog, and the body-level live region cannot be heard from in
    // there (see the ceremony's own note on why it carries a live region of its own).
    // Writing into that one instead would overwrite the step the reader just heard.
    attrs: { 'data-collab-own-invite': '', role: 'status' },
  }, [node('span', { text: tRaw(STRINGS.ownInvite), style: 'flex:1 1 14rem;min-width:0' }), dismiss]);
  dismiss.addEventListener('click', () => note.remove());
  el.prepend(note);
}

// ── View plumbing ─────────────────────────────────────────────────────────────

interface ViewElement extends HTMLElement { _cleanup?: () => void }

/**
 * A handle a route can pull to stop waiting when it is being torn down.
 *
 * Both routes here wait on something outside themselves - the reply tab on an ack from
 * another window, `#/join` on a human deciding whether to turn the feature on - and both
 * waits are inside a promise the mount is parked on. Teardown has to be able to settle
 * that promise, or `main.ts` deleting the view leaves the mount pending forever.
 */
interface Cancellable { cancel?: () => void }

interface NodeSpec {
  class?: string;
  text?: string;
  style?: string;
  attrs?: Record<string, string>;
}

/** One element. `text` is `textContent`, never markup - the same rule as the dialog. */
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

const CARD = 'max-width:44rem;margin:0 auto;padding:2.5rem 1.25rem';
const TITLE = 'margin:0 0 .5rem;font-size:1.35rem;font-weight:650';
const BODY = 'margin:0 0 1rem;color:hsl(var(--muted-foreground))';

// The fixed top-right escape cluster the ceremony shares with every other
// nav-less view: an always-home FAB (history-free; it goes to the front door no
// matter how the reader arrived), plus the theme cycle when a host can persist it
// (the reply route hands off WITHOUT one, so it gets home only). Every ceremony
// screen (terminal card, enable gate, code door) is painted by card(), which calls
// `view.replaceChildren()`. So the cluster is rebuilt as a sibling on each paint
// and dies with the view. Nothing to tear down, and no state survives a leave.
let ceremonyHost: JoinRouteHost | null = null;
function ceremonyChrome(): HTMLElement {
  const cluster = node('div', { class: 'gallery-topright', attrs: { 'data-collab-chrome': '' } }, [homeFabEl()]);
  if (ceremonyHost?.profile) {
    // Cast for the same reason color-lab.ts does: createThemeToggle only ever
    // reads/writes profile, and JoinRouteHost's profile (optional, nullable get)
    // satisfies that use even though it is not nominally a SetThemeHost.
    cluster.appendChild(createThemeToggle(
      ceremonyHost as unknown as Parameters<typeof createThemeToggle>[0],
      { className: 'theme-fab' },
    ));
  }
  return cluster;
}

/** A plain page: a heading, a sentence, whatever else, and the way back. */
function card(view: HTMLElement, title: string, body: string, extra: readonly (Node | null)[] = []): HTMLElement {
  const back = node('a', { class: 'btn', text: tRaw(STRINGS.backToTools), attrs: { href: '#/' } });
  const box = node('section', { style: CARD, attrs: { 'data-collab-join': '' } }, [
    node('h1', { text: title, style: TITLE, attrs: { tabindex: '-1', 'data-collab-title': '' } }),
    node('p', { text: body, style: BODY, attrs: { 'data-collab-body': '' } }),
    ...extra,
    back,
  ]);
  view.replaceChildren(box);
  // The escape cluster is a fixed-position sibling of the card box, re-added on
  // every paint (replaceChildren above drops the previous one). Appended AFTER the
  // box so the card's own heading still takes focus first.
  view.appendChild(ceremonyChrome());
  announce(title);
  return box;
}

/** The two refusals every route shares, in one place so both spell them identically. */
function flagOff(view: HTMLElement): void {
  card(view, tRaw(STRINGS.offTitle), tRaw(STRINGS.offBody));
}

// ── The flag gate's ungoverned half: the enable card (section 6.3) ───────────────────

/**
 * Offer to turn `private-collab` on, and resolve with what the human decided.
 *
 * Three ways out, and each of them settles the promise exactly once: the primary action
 * (`true`, and the caller does the writing), "Not now" and Esc (`false`, plus a page that
 * says what was and was not done), and the router leaving (`false`, painting nothing - 
 * the view is already being replaced, so the declined page would land on the NEXT route).
 * Esc is the same code path as "Not now" rather than a quieter one: a key that dismissed
 * the offer without saying so would leave a reader unsure whether they had just enabled
 * something.
 *
 * The card's own back link is `card()`'s, so "back" means what it means on every other
 * page here, and nothing is written on the way out.
 */
function offerEnable(view: HTMLElement, hooks: Cancellable): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;

    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      hooks.cancel = undefined;
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };

    const decline = (): void => {
      if (settled) return;
      finish(false);
      card(view, tRaw(STRINGS.declinedTitle), tRaw(STRINGS.declinedBody));
    };

    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || settled) return;
      event.preventDefault();
      decline();
    };

    const turnOn = node('button', {
      class: 'btn btn--primary',
      text: tRaw(STRINGS.enableAction),
      attrs: { type: 'button', 'data-act': 'enable-collab' },
    });
    turnOn.addEventListener('click', () => finish(true));
    const notNow = node('button', {
      class: 'btn',
      text: tRaw(STRINGS.enableDecline),
      attrs: { type: 'button', 'data-act': 'enable-decline' },
    });
    notNow.addEventListener('click', decline);

    hooks.cancel = () => finish(false);
    card(view, tRaw(STRINGS.enableTitle), tRaw(STRINGS.enableBody), [
      node('div', { class: 'modal-actions' }, [turnOn, notNow]),
    ]);
    document.addEventListener('keydown', onKey);
    // The card exists to be decided, so the decision is where the keyboard lands.
    turnOn.focus();
  });
}

/**
 * Turn the flag on the way the profile toggle turns it on.
 *
 * The sibling is `views/profile.ts`'s `#feature-flags` listener, and the order is its
 * order: read the profile, merge ONE key into `featureFlags`, write the record back, then
 * update the synchronous localStorage mirror every flag-gated surface reads. Doing only
 * the second half would light the feature up for exactly one page load and lose it on the
 * next boot - a setting the user chose has to survive being chosen.
 *
 * Returns whether the RECORD was written. A host with no `set` (or a storage error) still
 * gets the mirror, because the invite in front of them is time-limited and refusing to
 * open it would be a worse answer than opening it - but the caller says so out loud
 * rather than letting the reader believe a preference was saved.
 */
async function enablePrivateCollab(host: JoinRouteHost | null | undefined): Promise<boolean> {
  const id = PRIVATE_COLLAB_FLAG.id;
  const profile = host?.profile;
  let saved = false;
  try {
    if (profile?.set) {
      const current = (await profile.get()) ?? {};
      const featureFlags = { ...(current.featureFlags ?? {}), [id]: true };
      await profile.set({ ...current, featureFlags });
      saved = true;
    }
  } catch {
    saved = false;
  }
  setFlagMirror(id, true);
  return saved;
}

// ── The code door: `#/join` with nothing in the link ──────────────────────────

/**
 * Ask for an invite code, and resolve with the decoded invite.
 *
 * The other half of the front door. An invite is a link OR a code by design (section 6.1's
 * three skins), and until this card the code half had no door of its own: a person
 * holding a code pasted out of a chat had nowhere to put it, because `#/join` without a
 * token said "this link carries no invite" and stopped. This is that missing field.
 *
 * **It forks nothing.** The text goes through the same {@link readSignal} call the URL
 * token goes through - same decoder, same skin sniffing, same kind check - and the
 * caller then walks the same path a link walks, right down to
 * {@link deliverInviteToDialog} re-delivering it as if pasted. Two doors, one corridor.
 *
 * The three failures are three different sentences, because they are three different
 * situations for the person in front of the screen:
 *
 *   - EMPTY is a slip; the notice sits beside the field they are still holding.
 *   - UNREADABLE is a truncated or mangled code; same, because the fix is another paste.
 *   - A REPLY is the one that needs a screen. It is not a broken code - it is a perfectly
 *     good one in the wrong window, and the person is one hop from where it belongs, so
 *     they are told where that is (and handed the field back).
 *
 * Resolves with the invite, or `null` when the router leaves. Like {@link offerEnable},
 * the wait IS the screen: nothing resolves it but a good paste or a teardown.
 */
function askForCode(view: HTMLElement, hooks: Cancellable): Promise<SignalView | null> {
  return new Promise<SignalView | null>((resolve) => {
    let settled = false;
    // Mirrored out of the field, so a notice re-render cannot eat what was pasted - 
    // the same rule the ceremony's own paste fields hold (section 11.25).
    let typed = '';

    const finish = (value: SignalView | null): void => {
      if (settled) return;
      settled = true;
      hooks.cancel = undefined;
      resolve(value);
    };
    hooks.cancel = () => finish(null);

    const submit = (): void => {
      const read = readSignal(typed, 'invite');
      if (read.ok) { finish(read.value); return; }
      if (read.code === 'wrong-kind') { misfire(); return; }
      paint(read.code === 'empty' ? tRaw(STRINGS.codeEmpty) : tRaw(STRINGS.codeUnreadable));
    };

    /** A reply pasted into the invite door: right code, wrong window. */
    const misfire = (): void => {
      const again = node('button', {
        class: 'btn',
        text: tRaw(STRINGS.codeRetry),
        attrs: { type: 'button', 'data-act': 'code-retry' },
      });
      again.addEventListener('click', () => paint(''));
      card(view, tRaw(STRINGS.codeReplyTitle), tRaw(STRINGS.codeReplyBody), [
        node('div', { class: 'modal-actions' }, [again]),
      ]);
      again.focus();
    };

    const paint = (notice: string): void => {
      if (settled) return;
      const field = node('textarea', {
        class: 'field-input field-input--mono',
        style: 'display:block;width:100%;min-height:4.5rem',
        attrs: {
          id: CODE_FIELD_ID,
          rows: '3',
          spellcheck: 'false',
          autocomplete: 'off',
          placeholder: tRaw(STRINGS.codePlaceholder),
        },
      });
      field.value = typed;
      field.addEventListener('input', () => { typed = field.value; });
      const go = node('button', {
        class: 'btn btn--primary',
        text: tRaw(STRINGS.codeAction),
        attrs: { type: 'button', 'data-act': 'submit-code' },
      });
      go.addEventListener('click', submit);
      card(view, tRaw(STRINGS.codeTitle), tRaw(STRINGS.codeBody), [
        node('label', {
          text: tRaw(STRINGS.codeFieldLabel),
          style: 'display:block;margin:0 0 .25rem;font-size:12px;font-weight:650',
          attrs: { for: CODE_FIELD_ID },
        }),
        field,
        notice ? node('p', { class: 'note note--warning', text: notice }) : null,
        node('div', { class: 'modal-actions' }, [go]),
      ]);
      // AFTER the paint, and deliberately not through a `role="status"` node: `card()`
      // announces the page it paints, there is ONE live region, and the last write in a
      // frame is the line a reader actually hears. A refusal announced first would be
      // silently overwritten by the title of the card carrying it.
      if (notice) announce(notice);
      // The field is the whole card, and after a refusal it is where the fix happens.
      field.focus();
      try { field.setSelectionRange(typed.length, typed.length); } catch { /* jsdom, and no caret to move */ }
    };

    paint('');
  });
}

// ── #/join ────────────────────────────────────────────────────────────────────

/** The profile record, as far as this route reads and writes it. */
export interface JoinRouteProfile {
  readonly firstname?: string;
  readonly featureFlags?: Record<string, boolean>;
}

/** The slice of the host bridge this route reads. Structural, so a test passes a stub. */
export interface JoinRouteHost {
  profile?: {
    get(): Promise<JoinRouteProfile | null | undefined>;
    /**
     * Optional, and treated as optional: a host that cannot write the profile is the
     * honest "on for this visit only" case (see {@link enablePrivateCollab}), never a
     * crash on the one screen a stranger's invite lands on.
     */
    set?(profile: JoinRouteProfile): unknown;
  };
}

export interface JoinRouteDeps {
  /** Override the flag gate. Tests, and nothing else. */
  readonly flagOn?: () => boolean;
  /**
   * Override the "is this flag the ORGANIZATION's decision?" read (section 6.3).
   *
   * Defaults to `flagHidden`, which is true only when a control plane has hidden the
   * flag's toggle - i.e. its value is forced and no user can change it. An instance that
   * merely sets a default is not this: the user can still choose, so the enable card is
   * the honest screen for them.
   */
  readonly governedOff?: () => boolean;
  /** Open the dialog. Defaults to the real ceremony. */
  readonly openCeremony?: (opts: CollabCeremonyOptions) => CollabCeremonyHandle;
  /** Override the platform composition (which otherwise builds a real RTCPeerConnection). */
  readonly effects?: CeremonyEffectsSource;
  /** Report each transport built, so the connected handoff can carry it. */
  readonly onTransport?: (transport: RtcTransport) => void;
  /** Skip the profile read. */
  readonly profileName?: string;
  /** Base for the reply link this side mints. Defaults to {@link appLinkBase}. */
  readonly linkBase?: string;
  /** Draw a QR. Defaults to the in-repo encoder; `null` turns the skin off. */
  readonly renderQr?: CollabCeremonyOptions['renderQr'] | null;
  /** Scan a QR. Defaults to a probe-gated camera scan; `null` turns the skin off. */
  readonly scan?: CollabCeremonyOptions['scan'] | null;
  /** Take the live pair. Defaults to the collab-mount registry. */
  readonly onConnected?: (conn: CollabConnection, dialog: ParentNode | null) => void;
  /**
   * Open the channel the own-invite ask goes out on. `null` asks nobody.
   *
   * Defaults to the real `BroadcastChannel`, and a browser without one is already the
   * `null` case - which costs a note and nothing else.
   */
  readonly channel?: ChannelFactory | null;
  /** How long the own-invite ask waits. Tests pass 0; nothing is gated on it either way. */
  readonly askMs?: number;
}

/**
 * `#/join` - the acceptor's front door, with or without an invite in the link.
 *
 * Order matters and is the order a person experiences it: may this feature run here at
 * all (and if not, who says so - see the header on the two-branch gate), then is there an
 * invite (in the link, or pasted into the code door when the link carries none), and only
 * then does anything touch a camera or open a peer connection. Every failure before that
 * point is a sentence on a page.
 *
 * The two doors converge deliberately early. Once there is a decoded invite, a code
 * pasted here and a link clicked in a chat app are the same value walking the same path,
 * so nothing downstream - the ceremony, the probe, the delivery, the own-invite ask - 
 * knows or could behave differently based on which door it came through.
 */
export async function mountJoinRoute(
  view: HTMLElement,
  host?: JoinRouteHost | null,
  params = '',
  deps: JoinRouteDeps = {},
): Promise<void> {
  // Set before the first card() (the enable gate can paint one immediately): this
  // route has a host, so its escape cluster carries the theme cycle as well as Home.
  ceremonyHost = host ?? null;
  const scanning = new AbortController();
  let dialog: CollabCeremonyHandle | null = null;
  let handed: CollabConnection | null = null;
  /** The own-invite ask's channel, held only so teardown can close it. */
  let ownAsk: CeremonyChannelLike | null = null;
  // The enable card AND the code door both wait on a human, so teardown needs a way to
  // settle the promise the mount is parked on (see {@link Cancellable}). One handle for
  // both: they are never on screen at the same time.
  const gate: Cancellable = {};
  // `leaving` is set before the view is torn down, so the dialog's own `onClose` knows
  // the difference between "the human closed the ceremony" (repaint the page, announce
  // it) and "the router is leaving" (say nothing into a view that is already being
  // replaced) - and so the awaits below stop rather than open a ceremony over a view
  // that no longer exists.
  let leaving = false;
  // Stamped HERE, before the first await, and never assigned again: the namespace load,
  // the gate, and three more awaits stand between this line and the dialog, and `main.ts`
  // tears a view down by calling `_cleanup()` and then DELETING it. A teardown assigned
  // after that lands on the next view's element (there is one `#view`), replaces the
  // teardown that view just set, and is never called by anyone.
  (view as ViewElement)._cleanup = () => {
    leaving = true;
    gate.cancel?.();
    scanning.abort();
    dialog?.close();
    dialog = null;
    try { ownAsk?.close(); } catch { /* a closed channel is the goal either way */ }
    ownAsk = null;
  };

  // Before the first word is painted, including the refusals below. A route handler is
  // already async, so this costs the flow nothing - and unlike a mount that repaints,
  // it means the page is never briefly English for a reader who chose another language.
  // A no-op in English, and a namespace that fails to load simply leaves the page in
  // English (i18n.ts), so nothing here has to handle a failure.
  await loadNamespace('collab');
  if (leaving) return;

  const flagOn = deps.flagOn ?? (() => isFlagOnSync(PRIVATE_COLLAB_FLAG));
  // Set only when the flag was turned on right here AND the profile write did not take:
  // the page behind the ceremony then carries the one sentence that says so.
  let notSaved: HTMLElement | null = null;
  // What to say out loud once the route has painted whatever comes after the gate. Empty
  // unless the flag was turned on right here - the ordinary path announces nothing extra.
  let proceedSaid = '';
  if (!flagOn()) {
    // Whose refusal is it? A forced flag is the organization's, and no button on this
    // page could honestly undo it. Anything else is the reader's own decision to make.
    const governedOff = deps.governedOff ?? (() => flagHidden(PRIVATE_COLLAB_FLAG.id));
    if (governedOff()) { card(view, tRaw(STRINGS.governedTitle), tRaw(STRINGS.governedBody)); return; }

    // NOTHING has been decoded yet, deliberately - the gate must not double as an oracle
    // on a stranger's token (see the header).
    if (!(await offerEnable(view, gate))) return;
    if (leaving) return;

    const saved = await enablePrivateCollab(host);
    if (leaving) return;
    // The same gate again, not an assumption that the write worked: if neither the record
    // nor the mirror took, the feature really is still off, and the ordinary refusal is
    // the true thing to say.
    if (!flagOn()) { flagOff(view); return; }
    if (!saved) notSaved = node('p', { class: 'note note--warning', text: tRaw(STRINGS.enableNotSaved) });
    // Said after the next paint, not here: `card()` announces the page it paints, there is
    // ONE live region, and the last write in a frame is the line a reader actually hears.
    // Announcing the outcome first would leave it silently overwritten by a page title.
    proceedSaid = saved ? tRaw(STRINGS.enableDone) : tRaw(STRINGS.enableNotSaved);
  }

  // Absent and empty are two different arrivals, and they get two different screens.
  // NO `inv` at all is somebody who navigated here (from the Share dialog's "Join with
  // a code", a bookmark, a typed address) and has a code in hand; the door is the whole
  // answer. `inv=` present but empty is a link that was BUILT and then damaged on the
  // way. That is a fact about the link, and worth saying.
  const token = new URLSearchParams(params).get(INVITE_PARAM);
  let invite: SignalView;
  if (token === null) {
    const pasted = await askForCode(view, gate);
    if (leaving || !pasted) return;
    invite = pasted;
  } else {
    const read = readSignal(token, 'invite');
    if (!read.ok) {
      // Deliberately NOT `proceedSaid` here: it ends "Opening the invite", and nothing is
      // opening. The refusal card announces itself, which is the line that can be acted on.
      if (read.code === 'empty') card(view, tRaw(STRINGS.emptyTitle), tRaw(STRINGS.emptyBody));
      else if (read.code === 'wrong-kind') card(view, tRaw(STRINGS.wrongKindTitle), tRaw(STRINGS.wrongKindBody));
      else card(view, tRaw(STRINGS.unreadableTitle), tRaw(STRINGS.unreadableBody));
      return;
    }
    invite = read.value;
  }

  card(view, tRaw(STRINGS.joinTitle), tRaw(STRINGS.joinBody), notSaved ? [notSaved] : []);
  if (proceedSaid) announce(proceedSaid);

  // A durable client id if the database will give us one; the synchronous fallback
  // already handed out an in-memory ULID, so this never blocks the ceremony.
  await initCollabClientId().catch(() => '');
  if (leaving) return;

  const profileName = deps.profileName ?? (await readFirstname(host));
  if (leaving) return;

  const scan = deps.scan === null
    ? undefined
    : deps.scan ?? (await makeCameraScan(scanning.signal));
  if (leaving) return;
  const renderQr = deps.renderQr === null ? undefined : deps.renderQr ?? createQrElementRenderer();

  let transport: RtcTransport | null = null;
  const effects = deps.effects ?? createCollabEffects({
    onTransport: (built) => { transport = built; deps.onTransport?.(built); },
  });

  const open = deps.openCeremony ?? openCollabCeremony;
  dialog = open({
    role: 'acceptor',
    effects,
    profileName,
    renderQr,
    scan,
    linkBase: deps.linkBase ?? appLinkBase(),
    onConnected: (handle) => {
      const conn = connectionOf('acceptor', handle, transport, undefined);
      if (!conn) return;
      handed = conn;
      (deps.onConnected ?? handOffConnection)(conn, dialog?.el ?? null);
    },
    onClose: () => {
      scanning.abort();
      // This page is about to say "nothing else is being shared", so make that true. A
      // pair nobody adopted is still a live peer connection with three data channels,
      // and the dialog will not close it (`lib/collab-mount.ts`) - we hold the transport
      // precisely so somebody can. A no-op once a mount has taken it.
      if (handed) { releaseParked(handed); handed = null; }
      if (leaving) return;
      card(view, tRaw(STRINGS.joinTitle), tRaw(STRINGS.joinDone));
    },
  });

  // However the invite arrived, it is delivered as if pasted (see the header).
  deliverInviteToDialog(dialog.el, invite.link);

  // And then, beside a ceremony that is already running, one question that changes
  // nothing: did a window on this device make this invite? Fired without an `await`
  // precisely so it cannot delay the flow - the answer, if it ever comes, buys a
  // sentence. Silence, no channel, and a torn-down view are all the same screen.
  const asking = deps.channel === null ? null : openCeremonyChannel(deps.channel);
  if (!asking) return;
  ownAsk = asking;
  void askOwnInvite(asking, invite.link, deps.askMs ?? OWN_INVITE_ASK_MS).then((mine) => {
    if (ownAsk === asking) ownAsk = null;
    try { asking.close(); } catch { /* a closed channel is the goal either way */ }
    if (!mine || leaving || !dialog) return;
    noteOwnInvite(dialog.el);
  });
}

async function readFirstname(host: JoinRouteHost | null | undefined): Promise<string | undefined> {
  try {
    const profile = await host?.profile?.get();
    const name = profile?.firstname;
    return typeof name === 'string' && name.trim() ? name.trim() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The mount payload, or null when the transport is missing.
 *
 * Null happens only when the caller injected effects with no transport behind them (a
 * test, or a future non-RTC rung). Handing a connection to the mount without the object
 * that can send on it and hang it up would be worse than handing it nothing.
 */
function connectionOf(
  role: CeremonyRole,
  handle: CeremonyConnectedHandle,
  transport: RtcTransport | null,
  launch: CollabLaunchContext | undefined,
): CollabConnection | null {
  if (!transport) return null;
  // Track A's producer for the (transport-agnostic) mount seam: it builds the session
  // handle over this transport, wraps hanging it up in `close()`, and arms the latch for
  // the in-band seed that lands after the ceremony's own `connected` (section 6.1, section 12 Q3).
  return rtcCollabConnection({ role, ceremony: handle, transport, launch });
}

// ── #/join-reply ──────────────────────────────────────────────────────────────

export interface JoinReplyDeps {
  readonly flagOn?: () => boolean;
  /** Open the channel. Tests pass a fake; a browser without the API gets `null`. */
  readonly channel?: ChannelFactory | null;
  /** Ack deadline. */
  readonly waitMs?: number;
  /** How long bids are collected before one of them is handed the payload. */
  readonly bidWindowMs?: number;
  /** Timer, injected so a test runs the whole 800 ms instantly. */
  readonly setTimeout?: (fn: () => void, ms: number) => unknown;
  readonly clearTimeout?: (handle: unknown) => void;
  /** Close this tab once the reply landed. Defaults to `window.close()`. */
  readonly closeWindow?: () => void;
  /** Whether the tab actually went away. Defaults to `window.closed`. */
  readonly didClose?: () => boolean;
  /** Clipboard write for the paste fallback. */
  readonly copy?: (text: string) => void | Promise<void>;
}

/**
 * `#/join-reply?ans=<token>` - section 11.25's handoff tab.
 *
 * It does exactly three things: decode, offer the payload to any tab holding an invite
 * dialog, and then either get out of the way or explain itself. It never opens a peer
 * connection of its own - the connection this reply belongs to lives in the OTHER tab,
 * and a second one would be a second ceremony.
 *
 * `window.close()` only works on a window script-opened; a link clicked in a chat app
 * usually is not one. That is why the success copy exists at all - the tab says the job
 * is done and lets the human close it, rather than silently looking like it failed.
 */
export async function mountJoinReplyRoute(
  view: HTMLElement,
  params = '',
  deps: JoinReplyDeps = {},
): Promise<void> {
  // No host on this route by design - it hands a payload to the tab that owns the
  // ceremony and reads no profile of its own - so its escape cluster is Home only,
  // no theme cycle (nothing to persist a theme to). Set before the first card().
  ceremonyHost = null;
  await loadNamespace('collab'); // see mountJoinRoute - the copy loads before it paints
  // One answer here, not two: section 6.3's enable-on-accept is deliberately `#/join` only. A
  // reply link is opened on the device that MINTED the invite, whose flag is necessarily
  // already on - so a flag-off reply tab is not a newcomer to be introduced to the
  // feature, it is a link on the wrong device, and the existing sentence says so.
  const flagOn = deps.flagOn ?? (() => isFlagOnSync(PRIVATE_COLLAB_FLAG));
  if (!flagOn()) { flagOff(view); return; }

  // The dialog mints `?ans=`; section 11.25's prose spelled it `sig`. The minted link is the
  // contract, and the other spelling is accepted so a hand-written link still lands.
  const query = new URLSearchParams(params);
  const token = query.get(ANSWER_PARAM) ?? query.get('sig') ?? '';
  const read = readSignal(token, 'answer');
  if (!read.ok) {
    if (read.code === 'empty') card(view, tRaw(STRINGS.replyEmptyTitle), tRaw(STRINGS.replyEmptyBody));
    else if (read.code === 'wrong-kind') card(view, tRaw(STRINGS.replyWrongKindTitle), tRaw(STRINGS.replyWrongKindBody));
    else card(view, tRaw(STRINGS.replyUnreadableTitle), tRaw(STRINGS.replyUnreadableBody));
    return;
  }

  card(view, tRaw(STRINGS.replyTitle), tRaw(STRINGS.replyWorking));

  // Stamped before the wait, for the reason the header gives: this route's whole job is
  // to wait, and `#view` is one element that the next route paints into.
  let leaving = false;
  const handoff: Cancellable = {};
  let live: CeremonyChannelLike | null = null;
  (view as ViewElement)._cleanup = () => {
    leaving = true;
    handoff.cancel?.();
    try { live?.close(); } catch { /* a closed channel is the goal either way */ }
    live = null;
  };

  const channel = deps.channel === null ? null : openCeremonyChannel(deps.channel);
  if (!channel) { pasteFallback(view, read.value.qr, deps, tRaw(STRINGS.replyNoWindowTitle), tRaw(STRINGS.replyNoWindowBody)); return; }
  live = channel;

  const outcome = await offerReply(channel, read.value.link, deps, handoff);
  try { channel.close(); } catch { /* a closed channel is the goal either way */ }
  live = null;
  // Nothing below may paint: the router has replaced this view with another one, and
  // `card()` would replace THAT view's children with this route's page.
  if (leaving || outcome === 'abandoned') return;

  if (outcome === 'ambiguous') { pasteFallback(view, read.value.qr, deps, tRaw(STRINGS.replyManyTitle), tRaw(STRINGS.replyManyBody)); return; }
  if (outcome === 'nobody') { pasteFallback(view, read.value.qr, deps, tRaw(STRINGS.replyNoWindowTitle), tRaw(STRINGS.replyNoWindowBody)); return; }

  const close = deps.closeWindow ?? (() => { globalThis.window?.close(); });
  try { close(); } catch { /* a window that refuses to close is the common case */ }
  const gone = (deps.didClose ?? (() => globalThis.window?.closed === true))();
  if (!gone) card(view, tRaw(STRINGS.replyTitle), tRaw(STRINGS.replyDelivered));
}

/** What became of one handoff attempt. Every one of these is a different sentence. */
type HandoffOutcome = 'delivered' | 'nobody' | 'ambiguous' | 'abandoned';

/**
 * Offer the reply, hand it to the one window that claims it, and wait for the ack.
 *
 * Never rejects, and never resolves twice. The three-step shape is the header's; what
 * lives here is the bookkeeping it needs - one deadline for the whole exchange, one
 * short window opened by the FIRST bid (so a run with no bidders sets one timer, not
 * two), and a payload that is posted only when exactly one window asked for it.
 */
function offerReply(
  channel: CeremonyChannelLike,
  signal: string,
  deps: JoinReplyDeps,
  hooks: Cancellable,
): Promise<HandoffOutcome> {
  const wait = deps.waitMs ?? REPLY_ACK_WAIT_MS;
  const bidWindow = deps.bidWindowMs ?? REPLY_BID_WINDOW_MS;
  const setT = deps.setTimeout ?? ((fn, ms) => globalThis.setTimeout(fn, ms));
  const clearT = deps.clearTimeout ?? ((handle) => { globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>); });
  const rid = ulid();
  return new Promise<HandoffOutcome>((resolve) => {
    let settled = false;
    let granted = '';
    const bids: string[] = [];
    const timers: unknown[] = [];

    const post = (message: Record<string, unknown>): boolean => {
      try {
        channel.postMessage(message);
        return true;
      } catch {
        return false;
      }
    };

    const finish = (outcome: HandoffOutcome): void => {
      if (settled) return;
      settled = true;
      hooks.cancel = undefined;
      channel.removeEventListener('message', onMessage);
      for (const timer of timers) clearT(timer);
      resolve(outcome);
    };

    /** The bid window is up. One claimant gets the payload; two get nothing. */
    const award = (): void => {
      if (settled || granted !== '') return;
      const only = bids.length === 1 ? bids[0] : undefined;
      if (only === undefined) { finish('ambiguous'); return; }
      granted = only;
      if (!post(replyMessage(signal, { rid, bid: granted }))) finish('nobody');
    };

    const onMessage = (event: { data?: unknown }): void => {
      if (isReplyAck(event?.data, rid)) { finish('delivered'); return; }
      const bid = readReplyBid(event?.data, rid);
      // Late bids are ignored rather than re-awarded: the payload is already with a
      // window that asked for it, and a second copy of it is the very fan-out this
      // protocol exists to prevent.
      if (bid === null || granted !== '' || bids.includes(bid)) return;
      bids.push(bid);
      if (bids.length === 1) timers.push(setT(award, bidWindow));
    };

    channel.addEventListener('message', onMessage);
    hooks.cancel = () => finish('abandoned');
    if (!post(replyOfferMessage(rid))) { finish('nobody'); return; }
    if (!settled) timers.push(setT(() => finish('nobody'), wait));
  });
}

/** Nobody could take the reply: say why, and leave the code where it can be copied. */
function pasteFallback(view: HTMLElement, code: string, deps: JoinReplyDeps, title: string, body: string): void {
  const value = node('code', {
    text: code,
    style: 'display:block;overflow-wrap:anywhere;font-size:12px;padding:8px;border-radius:6px;background:hsl(var(--muted, 0 0% 96%))',
    attrs: { 'data-collab-reply-code': '' },
  });
  const button = node('button', { class: 'btn', text: tRaw(STRINGS.copyCode), attrs: { type: 'button' } });
  button.addEventListener('click', () => {
    const write = deps.copy ? deps.copy(code) : globalThis.navigator?.clipboard?.writeText(code);
    void Promise.resolve(write).then(
      () => { button.textContent = tRaw(STRINGS.copied); },
      () => { /* a refused clipboard leaves the code on screen to select by hand */ },
    );
  });
  card(view, title, body, [
    node('p', { text: tRaw(STRINGS.replyCodeLabel), style: 'margin:0 0 .25rem;font-size:12px;font-weight:650' }),
    value,
    node('p', { style: 'margin:.5rem 0 1rem' }, [button]),
  ]);
}

// Re-exported so `collab/private-opener.ts` reaches the dialog through the ONE dynamic
// import it makes (see that file's header on why the boot module stays platform-free).
export { openCollabCeremony };
