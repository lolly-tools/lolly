// SPDX-License-Identifier: MPL-2.0
/**
 * collab-session - the ONE object a mounted tool needs to be in a collab
 * (plan 100 section 4.6, section 5; wave 1.x).
 *
 * Wave 0 and wave 1.1 each landed a piece of the machine, and deliberately did
 * not wire them together: `collab-plumbing.ts` moves ops, `collab-presence.ts`
 * keeps the roster, `collab-colors.ts` derives the palette, `row-id.ts` names a
 * blocks row. Every one of them is transport-blind, DOM-free, and separately
 * tested. That is exactly why none of them is useful to a caller on its own:
 * `mountTool` would otherwise have to know the wiring order, the throttle rules,
 * the focus-token grammar, and the colour-assignment tie-breaks, then know them
 * AGAIN for the second transport.
 *
 * So this module is the composition, and nothing else. It owns no socket, no
 * `RTCPeerConnection`, no room id and no ceremony: everything that touches a
 * network arrives as a {@link CollabSessionHandle}, which is the reconciliation
 * target described below. What it does own is the four wires between the pieces:
 *
 *   1. inbound presence frames  → the presence engine's `receive()`
 *   2. the engine's outbound    → `handle.sendPresence()` (throttled by the engine)
 *   3. ops                      → `attachCollabPlumbing` against `handle.adapter`
 *   4. the roster               → collaborator colours, and one state stream the
 *                                 collab pill / focus overlay / projects badge read
 *
 * ── THE GUARD SITS ON BOTH INBOUND WIRES (section 6.3, section 11.21) ───────────────────────
 *
 * Wires 1 and 3 are the ONLY two doors a peer's bytes come through, and this module
 * owns both of them. So this is where `createOpGuard` runs, once per session, built
 * from the mounted tool's own declared input model. Nothing downstream is the
 * boundary: `collab-plumbing.ts` re-checks a couple of the same rules as defence in
 * depth (its `buildPatch` own-property whitelist), and the presence engine checks
 * none of them at all, because neither one can see the manifest that says what is
 * legal.
 *
 * Three rules fall out of that placement, and each is essential:
 *
 *  - **Inbound only.** Our OWN ops are not guarded on the way out. They were minted
 *    from this device's own model by `collab-plumbing.ts`; the peer that receives
 *    them runs its own guard, which is the only guard whose opinion protects the
 *    peer. Guarding outbound would cost every keystroke a schema validation to
 *    discover something we already know.
 *  - **Drop is not disconnect.** An op this build simply does not recognise (an
 *    input id a newer peer declares, a value that lost its type) is dropped, that
 *    op only, and the session carries on: PWA staleness makes version skew routine
 *    (section 11.19). A STRUCTURAL breach (a prototype key, a depth/length/rate cap) has
 *    no innocent sender, and `ABUSE_REASONS` is the set that says so. It is raised
 *    as {@link CollabAbuseEvent} through `onAbuse`, and NOTHING is closed from
 *    here: disconnecting is a transport decision (it owns the peer connection, the
 *    ceremony's re-invite, and the failure copy), so this module reports and the
 *    wiring layer acts. A session that hung up on its own transport would also be
 *    a session that could hang up on a Track B room it does not own.
 *  - **The whitelist is the model, read once.** Inputs are DECLARED in the manifest,
 *    never inferred from a template, so a mounted tool's set of legal ids/sub-fields
 *    cannot change while the session lives - only their values can. One
 *    `runtime.getModel()` read at construction is therefore the whole whitelist, and
 *    re-deriving it per batch would be per-op work for an answer that cannot differ.
 *
 * ── THE RECONCILIATION CONTRACT (read this before writing a transport) ─────────
 *
 * `CollabSessionHandle` is what BOTH tracks reduce to, and it is the whole of what
 * this module will ever ask a transport for:
 *
 *  - **Track A (private collab, `src/collab/`).** The ceremony (`ceremony.ts`)
 *    reaches `phase: 'connected'`, and the RTC provider (wave 2.3) builds a handle:
 *    `adapter` is the `ReferenceCanvasDoc`, `presenceIn` is the unordered
 *    `maxRetransmits: 0` data channel, `sendPresence` writes to it, `events` maps
 *    ICE state (`disconnected` → `'reconnecting'`, NEVER a leave - section 11.3), `self`
 *    carries the name and palette index chosen at ceremony time (`sdp-codec.ts`
 *    carries `colorIndex` as a u8 for exactly this), and `hostClientId` is the
 *    inviter's. The inviter owns the session (section 6.2a), which is what lets a
 *    nameless peer render as "Host" rather than "Invitee".
 *  - **Track B (work collab, `org/collab-provider.ts`).** The registered Yjs
 *    adapter is `adapter`; `presenceIn`/`sendPresence` sit on the room's awareness
 *    lane (a handle MAY implement `sendPresence` as `adapter.presence(frame.state)`
 *    where the adapter owns awareness itself); `events` maps socket state; `self`
 *    carries the SSO display name; `role` comes from `org/collab-config.ts`'s
 *    `canEditCollab()` - a member who may join but not edit is an `'observer'`,
 *    and so is either peer after a `CANVAS_OP_VERSION` major mismatch (contract section 9).
 *
 * Neither transport is imported here, and this module is never the thing that
 * decides a collab exists - `mountTool` asks for a handle and gets `null` in every
 * build that ships no provider, which is every build of this repo today.
 *
 * ── WHAT AN OBSERVER IS, MECHANICALLY ─────────────────────────────────────────
 *
 * `role: 'observer'` does not disable the plumbing. It wraps the adapter so
 * `onLocalChange`/`apply` are inert while `applyRemotePatch` still lands. An
 * observer therefore keeps converging with the room and keeps a live presence
 * entry (they are IN the session, visibly, with an observer tag in the roster).
 * Their own edits simply never become ops. Detaching the plumbing instead would
 * silently stop their view updating, which is the opposite of observing.
 *
 * ── FOCUS IS THE DEFAULT PRESENCE PRIMITIVE (section 4.1) ────────────────────────────
 *
 * Not a cursor: the canvas is a rendered preview, so "which control are you in"
 * is the thing that generalises to every tool. One delegated `focusin`/`focusout`
 * pair on the sidebar root resolves the focused element to the plan's focus token,
 * an input id, or `"<blocksId>:<rowId>"` for a blocks row. The row id comes from
 * the MODEL (wave 0.3's `row-id.ts`), never from the DOM: a `.block-item` carries
 * `data-block-index`, an array position, and a concurrent insert invalidates an
 * array position as an identity. Delegation also means the listener survives the
 * sidebar's innerHTML rebuilds, which a per-control listener would not.
 *
 * Nothing here writes a class or an attribute into tool DOM. The remote-focus
 * paint is an overlay anchored from element rects (section 4.6, wave 1.2) and lives
 * outside `.tool-canvas` - this module only decides WHAT to say about focus.
 *
 * ── TIME ──────────────────────────────────────────────────────────────────────
 *
 * This module schedules no timer of its own. Every timer in a session belongs to
 * the presence engine, whose clock/`setTimer`/`clearTimer` are forwarded straight
 * through from the options - so a test can assert that `close()` leaves ZERO
 * armed timers, which is the only honest way to prove a teardown is complete.
 */

import type { CanvasOp, CanvasSyncAdapter, Damage } from '@lolly-tools/core/canvas-op-v1';
// The ONE place a peer's bytes are decided on (see the header). `collab/` is Track
// A's home, but op-guard is transport-blind by construction - it imports the shared
// contract and `row-id.ts` and nothing else - so a session may reach for it exactly
// as `lib/beam-sink.ts` reaches for `collab/beam-protocol.ts`.
import { ABUSE_REASONS, createOpGuard } from '../collab/op-guard.ts';
import type {
  OpGuard, OpGuardCaps, OpGuardInput, OpRejectReason, OpRejection, RateKind,
} from '../collab/op-guard.ts';
import { assignColor, collabPalette } from './collab-colors.ts';
import type { CollabColor, CollabPaletteEntry } from './collab-colors.ts';
import { attachCollabPlumbing } from './collab-plumbing.ts';
import type { CollabPlumbing, CollabRuntime } from './collab-plumbing.ts';
import { createPresenceEngine } from './collab-presence.ts';
import type { PresenceEngine, PresenceFrame, PresencePeer, PresenceState } from './collab-presence.ts';
import { rowIdField } from './row-id.ts';
import type { CollabHistoryCapability } from './collab-history.ts';
import type { HistoryRange, HistoryWireEntry } from '../collab/history-exchange.ts';
import type { SavedStateData } from '../bridge/state.ts';

// ── The handle: what a transport owes a session ────────────────────────────────

/** Whether this client's edits become ops. See the header's observer note. */
export type CollabRole = 'writer' | 'observer';

/**
 * The connection as a human reads it in the collab pill's dot (section 4.6).
 *
 * `'reconnecting'` is a first-class state and not a synonym for trouble: ICE
 * `disconnected` self-heals in seconds on a UDP blip (section 11.3), so the transport
 * reports it here, the avatar greys, and NOBODY is evicted. Only `'closed'` means
 * the session is over.
 */
export type CollabConnectionState = 'connecting' | 'live' | 'reconnecting' | 'closed';

/** The minimum subscribable stream shape. Deliberately not an EventTarget: a
 *  transport should not have to mint DOM events to talk to this module, and a
 *  test should not have to construct them to drive it. */
export interface CollabStream<T> {
  /** Returns a real teardown; calling it twice must be safe. */
  subscribe(fn: (value: T) => void): () => void;
}

/** This client's identity on the wire - chosen, never leaked (section 11.23). */
export interface CollabSelf {
  /** The per-device collab client id (a random ULID, `collab-plumbing.ts`). */
  readonly clientId: string;
  /** The display name chosen at ceremony time, or absent for an anonymous peer
   *  (the UI then renders the role fallback - section 4.5). Never a profile field. */
  readonly name?: string;
  /** Preferred slot in the derived collaborator palette. Carried across the wire
   *  as a u8 by `sdp-codec.ts`, so both sides agree without negotiating. */
  readonly colorIndex?: number;
}

/**
 * Everything a transport supplies. See the header for how each track fills it in.
 */
export interface CollabSessionHandle {
  /** The convergence document. `ReferenceCanvasDoc` in Track A, Yjs in Track B. */
  readonly adapter: CanvasSyncAdapter;
  /** This client's own role. */
  readonly role: CollabRole;
  /** Optional shared or memory-only revision history supplied by the transport. */
  readonly history?: CollabHistoryCapability;
  /** Ask the peer for the revisions it will share, over the negotiated `history-v1`
   *  capability (plan 221 section 9). Present only when a transport carries the exchange and
   *  the peer agreed it; metadata only. Populated by the mount from the connection. */
  requestPeerHistory?(range?: HistoryRange): Promise<readonly HistoryWireEntry[]>;
  /** Fetch one peer revision's full payload, hash-verified - for opening a new local
   *  copy, never for overwriting the live shared document. */
  requestPeerRevision?(revisionId: string): Promise<SavedStateData>;
  readonly self: CollabSelf;
  /** Inbound presence frames, exactly as they came off the lane - unordered and
   *  possibly stale. The engine's per-sender `seq` rule sorts that out (section 11.5). */
  readonly presenceIn: CollabStream<PresenceFrame>;
  /** Hand one outbound frame to the transport. Called at most once per 50 ms, and
   *  never at all while this client is alone in the session (section 4.7). */
  sendPresence(frame: PresenceFrame): void;
  /** Connection-state changes. The session republishes them on its own stream. */
  readonly events: CollabStream<CollabConnectionState>;
  /** Tear the transport down. Called once, last, by {@link CollabSession.close}. */
  close(): void;

  /** The client id that owns the session (section 6.2a - the inviter in Track A). Used
   *  ONLY to pick the "Host" vs "Invitee" fallback for a peer with no name; absent
   *  is fine and simply means every nameless peer reads as an invitee. */
  readonly hostClientId?: string;
  /** A peer's role, when the transport knows it (the server does in Track B; a
   *  Track A pair learns it from the op-version hello). Returning `undefined` is
   *  honest ignorance - the roster then shows no role tag rather than guessing
   *  "writer", because mislabelling an observer as an editor is the harmful
   *  direction. */
  peerRole?(clientId: string): CollabRole | undefined;
}

// ── What the UI reads back ────────────────────────────────────────────────────

/**
 * One person in the session, as the pill/roster/overlay render them.
 *
 * `name` is the RAW chosen name (`''` for an anonymous peer) rather than a
 * resolved label: the "Host"/"Invitee N" fallback is display copy and belongs in
 * the component that can translate it, so this carries the two facts that decide
 * it - {@link isHost} and {@link inviteeIndex} - instead of pre-baking English.
 */
export interface CollabParticipant {
  /** Roster key: the per-device client id the frames are stamped with. */
  readonly clientId: string;
  /** The identity a human sees; equal to `clientId` in a private collab. */
  readonly userId: string;
  /** The chosen display name, or `''` when this person is anonymous. */
  readonly name: string;
  /** sRGB hex from the derived palette, or `''` when no palette could be built. */
  readonly color: string;
  /** Index of {@link color} in the derived palette; `-1` when there is none. */
  readonly colorIndex: number;
  /** Known role, or `undefined` when the transport did not say (see `peerRole`). */
  readonly role?: CollabRole;
  /** Hidden tab (section 11.4). A display state - never a reason to evict. */
  readonly away: boolean;
  /** The focus token: an input id, or `"<blocksId>:<rowId>"` (section 4.1). */
  readonly focus?: string;
  /** Slide/page/scene for big tools (section 4.2). */
  readonly location?: string;
  readonly isSelf: boolean;
  /** Owns the session (section 6.2a). False for everyone when no host was declared. */
  readonly isHost: boolean;
  /**
   * 1-based ordinal among the ANONYMOUS non-host participants, ordered by client
   * id - the number in the plan's "Invitee 2+" (section 4.5). `0` for anyone who chose a
   * name and for the host, neither of which is ever numbered. Client id, not join
   * order, precisely so the ordinal a person is given never depends on who is
   * asking; see `build()` for why join order cannot deliver that.
   */
  readonly inviteeIndex: number;
}

/** The whole of what a collab looks like from the outside, at one instant. */
export interface CollabSessionState {
  readonly connection: CollabConnectionState;
  /** This client's role - the pill's observer banner reads it. */
  readonly role: CollabRole;
  readonly self: CollabParticipant;
  /** Everyone else, in first-seen (join) order. */
  readonly peers: readonly CollabParticipant[];
  /** The tool this session is mounted on, when the caller declared one. */
  readonly toolId?: string;
}

/** The manifest slice a session reads - structural, so no engine import. */
export interface CollabToolManifest {
  readonly id?: string;
}

// ── What the guard reports (section 11.21) ───────────────────────────────────────────

/**
 * A peer sent something no build of this protocol can produce in good faith - a
 * prototype key, a payload past a depth/length/node cap, an over-sized batch, an
 * out-of-band Lamport clock, or more traffic per second than the lane allows.
 *
 * section 11.21 says explicitly that such a peer is DISCONNECTED rather than silently
 * throttled, and equally explicitly (by where it puts the connection) that the
 * disconnect is not this module's job to perform: the transport owns the peer
 * connection, the ceremony's re-invite, and the section 11.26 "specific cause" failure
 * copy. So this is the whole of what the session does about it: say what
 * happened, with the typed reason the copy keys off, and let the wiring layer
 * decide. The offending message is already discarded by the time this fires.
 */
export interface CollabAbuseEvent {
  /** Which inbound lane it arrived on. */
  readonly lane: RateKind;
  /** The first structural reason in {@link ABUSE_REASONS} - what the copy keys off. */
  readonly reason: OpRejectReason;
  /** Everything the guard refused in that one message, abuse and drops alike. Every
   *  `detail` is peer-derived and length-capped by the guard: safe to LOG, never
   *  safe to render as trusted text. */
  readonly rejected: readonly OpRejection[];
  /** The sending client id, when the lane's envelope carries one the transport has
   *  already validated (presence frames do; an ops batch does not - an op's
   *  `origin.client` is payload, and payload is what is under suspicion). */
  readonly from?: string;
}

export interface CollabSessionOptions {
  /** The transport. */
  handle: CollabSessionHandle;
  /** The mounted tool's runtime - the same object `attachCollabPlumbing` wraps. */
  runtime: CollabRuntime;
  /** The tool being edited. Carried into the state for the pill's label and for
   *  diagnostics; nothing here branches on it. */
  toolManifest?: CollabToolManifest | null;
  /**
   * The element the sidebar's controls live under. ONE delegated listener pair is
   * attached to it - omit it (or pass null) and the session simply never reports
   * focus, which is what a headless/loopback caller wants.
   */
  sidebarRoot?: HTMLElement | null;
  /** Where this client is (slide/page/scene). Re-read whenever presence goes out,
   *  so a tool wires it by supplying the callback, not by pushing updates. */
  getLocation?: () => string | undefined;

  /**
   * A peer misbehaved structurally (section 11.21). Called AFTER the offending message has
   * been discarded, so a handler that does nothing is a safe handler - the only
   * thing left to decide is whether to hang up, and that is the transport's call
   * (see {@link CollabAbuseEvent}). A throwing handler is swallowed: a consumer's
   * failure must not take the session down on the hostile-input path of all places.
   */
  onAbuse?(event: CollabAbuseEvent): void;
  /**
   * Overrides for individual guard ceilings - the affordance `OpGuardCaps` exists
   * for ("a test can trip one cheaply and a future transport can tighten them
   * without a code change"). Omitted entries keep their shipped value; omit the
   * option entirely and the session runs section 11.21's published numbers.
   */
  guardCaps?: Partial<OpGuardCaps>;

  /** The derived collaborator colours. Pass this to skip the derivation entirely
   *  (a caller that already holds a palette, or a test pinning exact hexes). */
  colors?: readonly CollabColor[];
  /** The active pack's colour tokens - `await host.tokens.colors()` goes straight
   *  in. Ignored when `colors` is given. */
  palette?: readonly CollabPaletteEntry[];
  /** The pack accent (`color.semantic.primary`), which anchors the hue spin. */
  accent?: string | null;

  /** The document whose `visibilitychange` drives the away flag (section 11.4).
   *  Defaults to the ambient one; pass null to opt out entirely. */
  doc?: Document | null;
  /** Monotonic clock, forwarded to the presence engine. */
  now?(): number;
  /** One-shot timer, forwarded to the presence engine. The session arms none of
   *  its own, so these are the ONLY timers a session can leave behind. */
  setTimer?(fn: () => void, ms: number): unknown;
  clearTimer?(handle: unknown): void;
  /** Frame scheduler, forwarded to the op plumbing. */
  raf?: (fn: () => void) => void;
}

export interface CollabSession {
  /** The transport this session was built on. */
  readonly handle: CollabSessionHandle;
  /** The presence engine - the focus overlay and cursor layer (waves 1.2/1.3)
   *  read the roster straight off it rather than through the state stream. */
  readonly presence: PresenceEngine;
  /** The op plumbing, or null when no adapter could be attached. */
  readonly plumbing: CollabPlumbing | null;
  /** The current state. Cheap: recomputed on change, not on read. */
  state(): CollabSessionState;
  /** Subscribe to state changes. Returns a real teardown. */
  subscribe(fn: (state: CollabSessionState) => void): () => void;
  /** Report a focus token from somewhere that is not the sidebar - the canvas
   *  overlay, a float panel. `null`/`undefined` clears it. */
  setFocus(focus: string | null | undefined): void;
  /** Re-read `getLocation()` and publish it (a slide change, a scene switch). */
  refreshLocation(): void;
  /** Inbound ops from the transport - the only door they have. Guarded (section 11.21)
   *  and then coalesced per frame by the plumbing: an op the guard drops never
   *  reaches the adapter, and a structurally abusive message takes the whole batch
   *  with it and raises `onAbuse`. */
  applyRemotePatch(ops: readonly CanvasOp[]): void;
  /** Tear everything down: listeners, subscriptions, presence timers, the op
   *  wrapper, and finally the transport. Idempotent - safe as a `_cleanup` hook. */
  close(): void;
}

// ── Palette derivation, memoised ──────────────────────────────────────────────

/**
 * `collabPalette` sweeps the hue circle in 1° steps, measuring APCA against every
 * chrome surface of both themes, and does it again for each budget the
 * drop-a-pack-hue loop tries. That is a few thousand colour conversions: nothing
 * on a mount, but it is the same answer every time for a given pack, and a session
 * is not the only caller (the focus overlay and the projects badge want the same
 * colours). So it is computed once per (accent, palette) pair.
 *
 * Bounded rather than a plain cache: a brand editor session can walk through many
 * palettes, and an unbounded module-level Map of dead palettes is a leak with a
 * slow fuse. Oldest-out at {@link PALETTE_CACHE_MAX}; a re-derivation costs
 * milliseconds, so the eviction is free in a way the leak is not.
 */
const PALETTE_CACHE_MAX = 8;
const paletteCache = new Map<string, CollabColor[]>();

/** The colour string behind a palette entry, in the two shapes callers hold. */
function entryColor(entry: CollabPaletteEntry): string {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    const v = (entry as { value?: unknown }).value;
    if (typeof v === 'string') return v;
  }
  return '';
}

function derivePalette(
  palette: readonly CollabPaletteEntry[] | undefined,
  accent: string | null | undefined,
): CollabColor[] {
  // A newline cannot appear in a colour token, so it is a delimiter no entry can
  // forge - two different palettes can never collide onto one cache key.
  const key = `${accent ?? ''}\n${(palette ?? []).map(entryColor).join('\n')}`;
  const hit = paletteCache.get(key);
  if (hit) return hit;
  const colors = collabPalette({ palette, accent: accent ?? null });
  if (paletteCache.size >= PALETTE_CACHE_MAX) {
    const oldest = paletteCache.keys().next();
    if (!oldest.done) paletteCache.delete(oldest.value);
  }
  paletteCache.set(key, colors);
  return colors;
}

/** TEST-ONLY: drop the memoised palettes. */
export function _clearCollabPaletteCacheForTests(): void {
  paletteCache.clear();
}

// ── Focus tokens (section 4.1) ───────────────────────────────────────────────────────

/**
 * The stable row id of a blocks row at `index`, read from the MODEL.
 *
 * The DOM knows only `data-block-index` - an array position, which a peer's
 * concurrent insert renumbers - so the id is looked up through `rowIdField`, the
 * one definition the sidebar mints rows with and the op plumbing addresses them
 * by (`row-id.ts`). Returns null for an index that is out of range or a row that
 * predates the id migration, and the caller then reports the plain input id: a
 * slightly coarser focus ring is a far better outcome than a token pointing at
 * whichever row happens to sit at that position on the other device.
 */
function blockRowIdAt(item: Parameters<typeof rowIdField>[0] & { value?: unknown }, index: number): string | null {
  if (!Array.isArray(item.value)) return null;
  const row = item.value[index] as Record<string, unknown> | undefined;
  if (!row || typeof row !== 'object') return null;
  const id = row[rowIdField(item)];
  return typeof id === 'string' && id ? id : null;
}

/**
 * Resolve a focused element to the plan's focus token.
 *
 * `closest('[data-input-id]')` is what makes this work through the sidebar's
 * shapes at once: a plain `<input>` carries the attribute itself, a `jelly-*`
 * custom element carries it on the host (and `focusin` retargets out of the
 * shadow root, so the host is what we see), a vector control carries it on the
 * container, and a blocks field carries only `data-field-id` - its nearest
 * `[data-input-id]` ancestor is the `.blocks-input` wrapper, which is exactly the
 * collection id the token needs.
 *
 * Exported because the focus overlay (wave 1.2) has to run the SAME grammar
 * backwards - a token it cannot map to an element is a ring it cannot paint.
 */
export function focusTokenFor(
  el: Element | null | undefined,
  model: ReturnType<CollabRuntime['getModel']>,
  root?: HTMLElement | null,
): string | undefined {
  if (!el || typeof (el as Element).closest !== 'function') return undefined;
  if (root && !root.contains(el)) return undefined;
  const host = el.closest<HTMLElement>('[data-input-id]');
  const id = host?.dataset.inputId;
  if (!id) return undefined;
  const item = model.find(i => i.id === id);
  if (!item || item.type !== 'blocks') return id;
  const block = el.closest<HTMLElement>('.block-item');
  const index = Number(block?.dataset.blockIndex);
  if (!Number.isInteger(index) || index < 0) return id;
  const rowId = blockRowIdAt(item, index);
  return rowId ? `${id}:${rowId}` : id;
}

// ── Observer suppression ──────────────────────────────────────────────────────

/**
 * The adapter an observer edits against: convergence intact, emission dead.
 *
 * `onLocalChange` returning `[]` and `apply` doing nothing is what stops a local
 * edit becoming ops (the plumbing emits exactly what these two produce), while
 * `applyRemotePatch`, `presence` and `state` pass straight through so the
 * observer's document still tracks the room. Contract section 9's observer-only join is
 * this, precisely: read everything, write nothing.
 */
function observerAdapter(adapter: CanvasSyncAdapter): CanvasSyncAdapter {
  return {
    onLocalChange: (): CanvasOp[] => [],
    apply: (): void => {},
    applyRemotePatch: (ops: readonly CanvasOp[]): Damage => adapter.applyRemotePatch(ops),
    presence: (a): void => adapter.presence(a),
    state: () => adapter.state(),
  };
}

// ── The guard's two adapters ──────────────────────────────────────────────────

/**
 * The clock the guard's rate windows are measured on when the caller injects none.
 *
 * section 11.7's "no wall clock" rule is about CONVERGENCE - LWW rides Lamport
 * `(clock, client)` and nothing here touches that. A rate window is a local
 * throttle, so `performance.now()` (monotonic where it exists) is not just
 * acceptable but the right source: a device whose system clock jumps mid-session
 * must not accuse a peer of flooding, and `op-guard.ts` takes `nowMs` as a
 * parameter precisely so the decision about which clock lives out here.
 */
function defaultNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/** An absent cursor, in the shape the contract's `Presence` requires one to be. */
const NO_CURSOR = Object.freeze({ x: 0, y: 0 });

/**
 * One inbound presence payload, widened to the shape `checkPresence` validates.
 *
 * A DELIBERATE mismatch between two landed contracts, reconciled here rather than by
 * bending either: `Presence` (packages/core) makes `cursor` and `selection`
 * REQUIRED, because it was written for a canvas. `PresenceState`
 * (`collab-presence.ts`) relaxes both to optional, because focus presence ships on
 * every tool (section 4.1) while a true x/y cursor is opt-in per tool (section 4.3): a
 * sidebar-only tool has neither to report, and every frame this shell sends today
 * omits both. Handing those straight to the guard would refuse 100% of real traffic.
 *
 * So the two canvas-only lanes are filled in with their empty forms, but only when
 * the sender omitted them, which is exactly the widening `PresenceState`
 * describes. It costs nothing in safety: a lane the peer DID send is passed through
 * untouched and checked for real, and the synthetic pair is never handed on. The
 * roster still receives the peer's ORIGINAL frame, so no fabricated cursor can be
 * painted.
 *
 * Spread, not mutation: `{ ...state }` defines own data properties, so an own
 * `__proto__` a peer's `JSON.parse` produced stays an own key here and still dies on
 * the guard's forbidden-key check instead of quietly re-seating a prototype.
 */
function guardablePresence(state: PresenceState): unknown {
  if (state === null || typeof state !== 'object') return state;
  const raw = state as unknown as Record<string, unknown>;
  const hasCursor = Object.hasOwn(raw, 'cursor');
  const hasSelection = Object.hasOwn(raw, 'selection');
  if (hasCursor && hasSelection) return state;
  return {
    ...raw,
    ...(hasCursor ? {} : { cursor: NO_CURSOR }),
    ...(hasSelection ? {} : { selection: [] }),
  };
}

/**
 * How many refusal lines one session may write to the console before it stops.
 *
 * Not tidiness: the refusal path is driven by untrusted input at up to 200 ops and
 * 40 presence frames a second, so an uncapped `console.warn` is itself a small
 * denial of service against the person being attacked (devtools retains every line
 * and its arguments). The first refusals are the diagnostic; the ten-thousandth is
 * noise. Abuse EVENTS are never suppressed - only the logging is.
 */
const REFUSAL_LOG_MAX = 20;

/** Discovery-announce cadence while live + undiscovered (lossy lane ⇒ repeat until
 *  first contact; see the announcer block in `createCollabSession`). Exported for
 *  tests. */
export const COLLAB_ANNOUNCE_MS = 2_000;

// ── The session ───────────────────────────────────────────────────────────────

/** Lowercase hex, for the `taken` set's comparisons. */
const hexKey = (hex: string): string => hex.toLowerCase();

export function createCollabSession(opts: CollabSessionOptions): CollabSession {
  const { handle, runtime } = opts;
  const colors: readonly CollabColor[] = opts.colors ?? derivePalette(opts.palette, opts.accent);
  const selfId = handle.self.clientId;
  const selfName = handle.self.name ?? '';
  const doc = opts.doc === undefined ? (globalThis as { document?: Document }).document ?? null : opts.doc;
  const now: () => number = opts.now ?? defaultNow;

  let closed = false;
  let connection: CollabConnectionState = 'connecting';
  let focus: string | undefined;
  let cached: CollabSessionState | null = null;
  const subscribers = new Set<(state: CollabSessionState) => void>();

  // ── colours ────────────────────────────────────────────────────────────────

  /**
   * Self's colour. A `colorIndex` from the ceremony wins outright - it is the slot
   * BOTH devices already agreed on (`sdp-codec.ts` carries it), so honouring it is
   * what makes "same person, same colour, on every client" true without a single
   * round trip. Without one, slot 0 is the preferred seat and `assignColor` walks
   * from there.
   */
  function selfColor(): CollabColor | null {
    const i = handle.self.colorIndex;
    if (typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < colors.length) return colors[i]!;
    return assignColor(0, null, colors);
  }

  /**
   * Colours for the roster, in two passes and in this order for a reason.
   *
   * PASS 1 honours what a peer said about itself: `Presence.color` is the colour
   * that peer is painting itself, its rings and its cursor in, so if our palette
   * contains that hex we hand it back unchanged. This is the path that actually
   * runs in a same-profile pair, and it is why nobody sees Priya as teal while
   * Priya sees herself as amber.
   *
   * PASS 2 is the cross-profile case (section 11.16): two devices on different packs
   * derive different palettes, so a peer's hex is simply not one of ours and no
   * amount of agreement protocol will make it one. We re-derive locally by join
   * order - `assignColor` walking forward from the peer's roster position, with
   * everything already seated marked taken - which the ceremony explicitly allows
   * ("the receiving shell may re-derive it instead"). The two clients then differ
   * on hue; the name chip, the halo and the roster are what keep that survivable,
   * which is the same reason colour is never allowed to be the only signal.
   */
  function assignRoster(peers: readonly PresencePeer[]): Map<string, CollabColor | null> {
    const out = new Map<string, CollabColor | null>();
    const taken = new Set<string>();
    const mine = selfColor();
    if (mine) taken.add(hexKey(mine.hex));

    const byHex = new Map(colors.map(c => [hexKey(c.hex), c]));
    const pending: PresencePeer[] = [];
    for (const peer of peers) {
      const claimed = typeof peer.state.color === 'string' ? byHex.get(hexKey(peer.state.color)) : undefined;
      if (claimed && !taken.has(hexKey(claimed.hex))) {
        taken.add(hexKey(claimed.hex));
        out.set(peer.id, claimed);
      } else {
        pending.push(peer);
      }
    }
    for (const peer of pending) {
      // Join order counts self as 0, so a peer's preferred slot is its roster
      // position plus one - the same arithmetic every client performs.
      const order = peers.indexOf(peer) + 1;
      const c = assignColor(order, taken, colors);
      if (c) taken.add(hexKey(c.hex));
      out.set(peer.id, c);
    }
    return out;
  }

  // ── the boundary (section 6.3, section 11.21) ────────────────────────────────────────────

  /**
   * ONE guard for the life of the session, built from the tool's DECLARED inputs.
   *
   * `runtime.getModel()` is the model `attachCollabPlumbing` already projects ops
   * against, and an `InputModelItem` IS an `OpGuardInput` structurally (id, type,
   * blocks `fields`, the canvas collection's `canvas` config) - so this reuses the
   * runtime's own data rather than re-reading a manifest the session was only handed
   * an id for. A runtime that cannot produce a model yields an EMPTY whitelist, which
   * refuses everything: failing closed is the only safe direction on a boundary, and
   * a mount with no model has nothing an op could legitimately address anyway.
   */
  const guard: OpGuard = createOpGuard({
    inputs: ((): readonly OpGuardInput[] => {
      try {
        return runtime.getModel();
      } catch {
        return [];
      }
    })(),
    ...(opts.guardCaps ? { caps: opts.guardCaps } : {}),
  });

  let refusalsLogged = 0;

  /**
   * Report one message's refusals: a bounded console line for the human, and the
   * typed event for the transport when the verdict is structural abuse.
   */
  function refuse(lane: RateKind, rejected: readonly OpRejection[], from?: string): void {
    if (refusalsLogged < REFUSAL_LOG_MAX) {
      refusalsLogged += 1;
      const detail = rejected.map(r => (r.detail === undefined ? r.reason : `${r.reason}: ${r.detail}`));
      console.warn(`[lolly:collab] refused inbound ${lane}`, detail);
      if (refusalsLogged === REFUSAL_LOG_MAX) {
        console.warn('[lolly:collab] further inbound refusals will not be logged');
      }
    }
    const abuse = rejected.find(r => ABUSE_REASONS.has(r.reason));
    if (!abuse) return;
    try {
      opts.onAbuse?.({
        lane,
        reason: abuse.reason,
        rejected: [...rejected],
        ...(from !== undefined ? { from } : {}),
      });
    } catch {
      // A consumer's failure is its own - and least of all here, where swallowing it
      // is what keeps a hostile peer from turning a buggy handler into a crash.
    }
  }

  /** Inbound ops, filtered to the ones allowed to become state. */
  function admitOps(ops: readonly CanvasOp[]): readonly CanvasOp[] {
    // An empty message carries no arrivals to charge and nothing to inspect. Charging
    // it one unit anyway would let a peer's harmless empty frame eat the budget of a
    // legitimate 200-op second and get them disconnected for it - a false accusation,
    // which is the one failure this lane must not produce (op-guard's own window is
    // biased the same way).
    if (ops.length === 0) return ops;
    // The rate lane is charged FIRST and from the batch length alone, so a flood is
    // caught for the cost of a length read even when every op in it is well formed.
    if (!guard.recordAndCheckRate('ops', ops.length, now())) {
      refuse('ops', [{ reason: 'rate-limited', detail: String(ops.length) }]);
      return [];
    }
    const checked = guard.checkOps(ops);
    if (checked.rejected.length) refuse('ops', checked.rejected);
    return checked.ok;
  }

  /**
   * Inbound presence: true when this frame may reach the roster.
   *
   * `seeded` exempts the RATE lane only - never the structural check below it - for
   * the one window where that is honest: the SYNCHRONOUS replay a transport's own
   * `presenceIn.subscribe()` call may perform before returning (Track B's
   * `org/collab-handle.ts` - "Replay the room to a subscriber that arrived after the
   * join-ack"). That replay is not peer traffic arriving at a rate at all; it is a
   * transport restating what it already knows, ALL AT ONCE, about a room whose
   * membership the gateway already bounds (section 7.5's "~10 writers, observers beyond").
   * Charging it against the same 40/s budget real traffic answers to is the
   * section 11.21 rate cap solving a problem it was never aimed at - a room past the cap
   * making its own JOINER look like the abuser, and every member past it silently
   * missing from the roster. Track A's `presenceIn` never replays on subscribe (see
   * `rtc-handle.ts`'s bare `emitter<PresenceFrame>()`), so `seeded` is always false
   * there and this is a no-op on that track.
   */
  function admitPresence(frame: PresenceFrame, seeded = false): boolean {
    if (!seeded && !guard.recordAndCheckRate('presence', 1, now())) {
      refuse('presence', [{ reason: 'rate-limited' }], frame.from);
      return false;
    }
    // A clean leave (section 4.7) carries no peer-authored state at all - the envelope is
    // the transport's own contract (`rtc-transport.ts` bounds `from`/`seq` before a
    // frame ever reaches a session), so there is nothing here for the guard to look
    // at, and refusing it would leave the peer ghosting until the 30 s TTL.
    if (frame.state === null) return true;
    // Anything else - including a transport that lied about the type and sent no
    // state at all - goes through the guard, which refuses a non-object as malformed.
    const checked = guard.checkPresence(guardablePresence(frame.state));
    if (checked.rejected.length) refuse('presence', checked.rejected, frame.from);
    return checked.ok !== null;
  }

  // ── presence ───────────────────────────────────────────────────────────────

  const presence = createPresenceEngine({
    clientId: selfId,
    send: (frame) => {
      try {
        handle.sendPresence(frame);
      } catch {
        // The presence lane is lossy by construction; a transport that refused a
        // frame is covered by the next heartbeat, and must not take the engine's
        // timers down with it.
      }
    },
    ...(opts.now ? { now: opts.now } : {}),
    ...(opts.setTimer ? { setTimer: opts.setTimer } : {}),
    ...(opts.clearTimer ? { clearTimer: opts.clearTimer } : {}),
  });

  /** This client's presence payload. `userId` is the client id: a private collab
   *  has no account, and section 11.23 says nothing else from the profile ever crosses. */
  function localState(): PresenceState {
    const c = selfColor();
    const base: PresenceState = {
      userId: selfId,
      name: selfName,
      color: c?.hex ?? '',
    };
    const location = opts.getLocation?.();
    return {
      ...base,
      ...(focus !== undefined ? { focus } : {}),
      ...(typeof location === 'string' && location ? { location } : {}),
    };
  }

  /** Republish our presence. The engine decides whether that costs a frame: it
   *  coalesces to one per 50 ms window and sends NOTHING while we are alone. */
  function publish(): void {
    if (closed) return;
    presence.setLocal(localState());
  }

  // ── state ──────────────────────────────────────────────────────────────────

  function participantFor(
    clientId: string,
    state: PresenceState,
    color: CollabColor | null,
    away: boolean,
    isSelf: boolean,
    inviteeIndex: number,
  ): CollabParticipant {
    const role = isSelf ? handle.role : handle.peerRole?.(clientId);
    const name = typeof state.name === 'string' ? state.name : '';
    return {
      clientId,
      userId: typeof state.userId === 'string' && state.userId ? state.userId : clientId,
      name,
      color: color?.hex ?? '',
      colorIndex: color ? colors.indexOf(color) : -1,
      ...(role ? { role } : {}),
      away,
      ...(typeof state.focus === 'string' ? { focus: state.focus } : {}),
      ...(typeof state.location === 'string' ? { location: state.location } : {}),
      isSelf,
      isHost: handle.hostClientId !== undefined && handle.hostClientId === clientId,
      inviteeIndex,
    };
  }

  function build(): CollabSessionState {
    const peers = presence.roster();
    const assigned = assignRoster(peers);
    const isHostId = (id: string): boolean =>
      handle.hostClientId !== undefined && handle.hostClientId === id;
    const selfIsHost = isHostId(selfId);

    /**
     * The "Invitee 2+" ordinals (section 4.5), numbered by SORTED CLIENT ID.
     *
     * The ordinal has to be the same on every device or it is worse than useless:
     * `collabDisplayName` feeds it to the avatar title, the roster row, the stack's
     * aria-label, the focus chip and every `announce()` string, so a pair would each
     * call themselves "Invitee" and each call the other "Invitee 2" - two people with
     * two different names for the same two people. First-seen JOIN order cannot fix
     * that, however it walks: each device learns of the others in its own order, and
     * its own arrival is not in that sequence at all, so whoever is asking always
     * takes the lowest free number. The client ids are the one total order every
     * participant already agrees on without negotiating, a clock, or a round trip - 
     * so that is what numbers them. Named participants and the host are never
     * numbered, so they are simply not in the set.
     */
    const anonymous = [
      ...(!selfName && !selfIsHost ? [selfId] : []),
      ...peers
        .filter(p => !(typeof p.state.name === 'string' && p.state.name !== '') && !isHostId(p.id))
        .map(p => p.id),
    ].sort();
    const inviteeIndex = new Map(anonymous.map((id, i) => [id, i + 1]));

    const self = participantFor(
      selfId, presence.self() ?? localState(), selfColor(), false, true, inviteeIndex.get(selfId) ?? 0,
    );
    const list = peers.map(peer => participantFor(
      peer.id, peer.state, assigned.get(peer.id) ?? null, peer.away, false,
      inviteeIndex.get(peer.id) ?? 0,
    ));
    return {
      connection,
      role: handle.role,
      self,
      peers: list,
      ...(opts.toolManifest?.id ? { toolId: opts.toolManifest.id } : {}),
    };
  }

  function notify(): void {
    cached = null;
    if (subscribers.size === 0) return;
    const snap = state();
    for (const fn of [...subscribers]) {
      try {
        fn(snap);
      } catch {
        /* a consumer's failure is its own - the roster is already committed */
      }
    }
  }

  function state(): CollabSessionState {
    cached ??= build();
    return cached;
  }

  // ── wiring ─────────────────────────────────────────────────────────────────

  const teardown: (() => void)[] = [];

  const adapter = handle.role === 'observer' ? observerAdapter(handle.adapter) : handle.adapter;
  const plumbing: CollabPlumbing | null = attachCollabPlumbing(runtime, {
    adapter,
    clientId: selfId,
    ...(opts.raf ? { raf: opts.raf } : {}),
  });

  teardown.push(presence.subscribe(() => { notify(); }));
  // `seeding` is true for exactly the synchronous extent of the `subscribe()` call
  // below - see `admitPresence`'s header note. A transport whose `presenceIn` replays
  // its known roster does so INSIDE this very call, before it returns, which is what
  // makes "am I still inside that call" an honest test for "is this the replay".
  let seeding = true;
  teardown.push(handle.presenceIn.subscribe((frame) => {
    if (closed) return;
    // The guard runs BEFORE the engine sees the frame: a refused frame must not
    // create a roster entry, must not move a peer's `seq` bookkeeping, and must not
    // reset the TTL that would otherwise evict a peer that stopped speaking sense.
    if (!admitPresence(frame, seeding)) return;
    presence.receive(frame);
  }));
  seeding = false;
  teardown.push(handle.events.subscribe((next) => {
    if (closed || next === connection) return;
    connection = next;
    notify();
  }));

  // Focus tracking OUT (section 4.1). One delegated pair on the sidebar root, so it
  // survives every innerHTML rebuild the sidebar does.
  function applyFocus(next: string | undefined): void {
    if (closed || next === focus) return;
    focus = next;
    publish();
    notify();
  }

  const root = opts.sidebarRoot ?? null;
  if (root) {
    const onFocusIn = (e: Event): void => {
      applyFocus(focusTokenFor(e.target as Element | null, runtime.getModel(), root));
    };
    // `focusout` fires BEFORE the matching `focusin`, and its `relatedTarget` is
    // where focus is going - so resolving from that instead of clearing avoids a
    // spurious "focus: nothing" frame between every two controls. A tab out of the
    // sidebar (or out of the document, where relatedTarget is null) resolves to
    // undefined and clears, which is the honest report.
    const onFocusOut = (e: Event): void => {
      applyFocus(focusTokenFor((e as FocusEvent).relatedTarget as Element | null, runtime.getModel(), root));
    };
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    teardown.push(() => {
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
    });
  }

  // Away (section 11.4): a hidden tab is not a dead tab - it says so, and stays in the
  // roster exempt from the TTL.
  if (doc) {
    const onVisibility = (): void => { presence.setAway(doc.hidden === true); };
    doc.addEventListener('visibilitychange', onVisibility);
    teardown.push(() => { doc.removeEventListener('visibilitychange', onVisibility); });
    if (doc.hidden === true) presence.setAway(true);
  }

  // DISCOVERY announcer (drill finding 2026-08-10): in a serverless pair BOTH sides
  // start with an empty roster, and the engine's occupancy rule ("no traffic while
  // alone") would leave them silent at each other forever - an open channel with an
  // empty roster is not "alone", it is "undiscovered". While the connection is live
  // and nobody has been heard, repeat `announce()` on a slow cadence: the presence
  // lane is lossy (`maxRetransmits: 0`), so a single hello can vanish and repetition
  // until first contact is the correct amount of noise (tiny frames, ~2 s apart).
  // Stops on first roster entry, on any non-live connection state, and on close - 
  // Track B never runs it past one tick, because the join-ack roster seed lands
  // during `presenceIn.subscribe` above.
  {
    const setT = opts.setTimer ?? ((fn: () => void, ms: number): unknown => setTimeout(fn, ms));
    const clearT = opts.clearTimer
      ?? ((h: unknown): void => { clearTimeout(h as ReturnType<typeof setTimeout>); });
    let announceTimer: unknown = null;
    const stopAnnouncer = (): void => {
      if (announceTimer !== null) { clearT(announceTimer); announceTimer = null; }
    };
    const tick = (): void => {
      announceTimer = null;
      if (closed || connection !== 'live' || presence.roster().length > 0) return;
      presence.announce();
      announceTimer = setT(tick, COLLAB_ANNOUNCE_MS);
    };
    const syncAnnouncer = (): void => {
      if (closed || connection !== 'live' || presence.roster().length > 0) { stopAnnouncer(); return; }
      if (announceTimer === null) tick();
    };
    teardown.push(presence.subscribe(syncAnnouncer));
    teardown.push(handle.events.subscribe(syncAnnouncer));
    teardown.push(stopAnnouncer);
    syncAnnouncer();
  }

  publish();

  return {
    handle,
    presence,
    plumbing,
    state,
    subscribe(fn) {
      subscribers.add(fn);
      return () => { subscribers.delete(fn); };
    },
    setFocus(next) {
      applyFocus(typeof next === 'string' && next ? next : undefined);
    },
    refreshLocation() {
      if (closed) return;
      publish();
      notify();
    },
    applyRemotePatch(ops) {
      if (closed) return;
      // The one door ops come through, so the guard runs here - before the plumbing
      // queues anything, and therefore before `adapter.applyRemotePatch` can put a
      // hostile write into the converging document (where LWW would keep it).
      plumbing?.applyRemotePatch(admitOps(ops));
    },
    close() {
      if (closed) return;
      closed = true;
      // Order matters. Stop emitting ops first (the runtime's setInput wrapper is
      // restored), then let presence say goodbye while the transport is still up - 
      // `destroy()` broadcasts the `null` leave frame so peers drop us immediately
      // instead of ghosting for the 30 s TTL - and only then close the transport.
      plumbing?.detach();
      for (const fn of teardown.splice(0)) {
        try { fn(); } catch { /* a listener that is already gone is not an error */ }
      }
      presence.destroy();
      try { handle.close(); } catch { /* the transport's failure is not the view's */ }
      subscribers.clear();
      cached = null;
    },
  };
}
