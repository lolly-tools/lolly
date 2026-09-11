// SPDX-License-Identifier: MPL-2.0
/**
 * collab-pill - the floating collaborator cluster over the stage (plan 100 section 4.6).
 *
 * The plan calls this "the anchor component", and the reason it is built before any
 * transport exists is Andy's: "we can't build this and not have the realestate
 * ready". It is the one place a person looks to answer *who is here, can they see
 * what I see, and is the connection alive* - so it holds an avatar stack (3 + "+N"),
 * a connection-state dot, an optional invite affordance and a roster popover, and
 * nothing else. Cursors, focus rings and the projects badge are separate surfaces
 * that read the same session state.
 *
 * ── The idiom it borrows ──────────────────────────────────────────────────────
 *
 * The stage HUD (`.stage-nav`, `styles/parts/editor.css`): a translucent `--card`
 * capsule at 0.85 alpha over a 6px backdrop blur, a hairline `--border`, a 999px
 * radius, sized off the shared `--chrome-*` row tokens so it lines up with the back
 * pill at every width. That module is NOT touched - this is its own component with
 * its own injected sheet, the `music-player.ts`/`neuro-dock.ts` pattern, because a
 * collab is lazy chrome that must cost a single-player build nothing.
 *
 * ── Placement is the CONTAINER'S job, deliberately ────────────────────────────
 *
 * section 4.6 puts the pill top-right of the canvas area, which is the lane `.stage-nav`
 * moved into (editor.css says why: the docked timeline band owns the bottom). Two
 * things cannot share one lane by accident, and this component cannot see the HUD,
 * so it does not guess: the base class is an inline-flex cluster with no position at
 * all, and `.collab-pill--stage` adds the absolute top-inline-end placement offset
 * by `--collab-pill-offset` (default 0). The stitch pass that mounts this in the
 * tool view sets that offset to clear whatever else is in the lane. A component that
 * pinned itself would be a collision nobody could fix from the outside.
 *
 * ── Colour is never the only differentiator (section 4.8) ────────────────────────────
 *
 * Three rules follow from that, and each is required rather than decorative:
 *
 *  - the connection dot pairs its colour with a SHAPE (filled disc / hollow ring /
 *    split disc / barred ring) and a `title`, plus a visually-hidden live label - 
 *    green-vs-red alone fails for the ~8% of men who would read them as one colour;
 *  - every avatar carries a 1px halo in the theme ground plus an outer hairline in
 *    the theme ink (the selection-handle convention, section 4.4), so a collaborator colour
 *    that happens to match the artwork behind it still reads as a separate object;
 *  - initials are `aria-hidden` and the accessible name is the full roster - two
 *    letters in a 24px disc are an identifier for people who can already see the
 *    colour, never the accessible one.
 *
 * Names, tags and every announcement go through `announce()`; the entrance flash on
 * a newly joined avatar is skipped under `prefersReducedMotion()`, and the
 * reconnecting pulse is gated in CSS against BOTH the OS query and the app's own
 * `data-a11y-motion` attribute (parts/base.css does not zero transitions globally,
 * so each component honours both signals itself).
 *
 * Every chrome size is `calc(Npx * var(--a11y-fs))` and every offset is a LOGICAL
 * property, so the cluster grows with the large-text preference and mirrors in RTL
 * without a second stylesheet.
 *
 * ── What this does NOT do ─────────────────────────────────────────────────────
 *
 * It never imports the launch registry, the ceremony or a transport: `onInvite` is a
 * callback slot, and the invite button exists only when a caller supplies one. It
 * renders no markup into `.tool-canvas`/`#tool-content` and touches no export stage
 * - a render must stay byte-identical whether or not anyone is watching (section 4.6, section 8).
 */

import { announce as announceLive } from '../a11y.ts';
// `tRaw` throughout, not `t`: every string in this file lands in `textContent`, an
// attribute or `announce()` - never an HTML sink - and t()'s param escaping would
// render an apostrophe in a collaborator's name as `O&#39;Brien`.
import { currentLang, loadNamespace, tRaw } from '../i18n.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import type { CollabParticipant, CollabSessionState } from '../lib/collab-session.ts';
import { icon, type IconName } from '../lib/icons.ts';
import { mountBodyPopover } from './body-popover.ts';
import type { BodyPopoverHandle, PopoverAnchor } from './body-popover.ts';

// ── Copy ──────────────────────────────────────────────────────────────────────
//
// One map, one namespace - the house shape (`components/collab-ceremony.ts`,
// `components/beam-toast.ts`, `lib/beam-pack.ts`). Every value IS its own catalog key:
// `i18n.ts` looks a translation up by the English source, so this map is both the copy
// and the extraction list scripts/translate.ts's `collab` corpus slices out of the file.
//
// These strings USED to be inline `tRaw('…')` literals, which read as translated and
// were not: the pipeline's scanner only matches a quote immediately after `t(`, so every
// one of them was invisible to it and would have shipped English in all 26 languages
// with nothing reporting it. The map is what makes them findable.
export const STRINGS = {
  /** The cluster itself, for a screen reader. */
  group: 'Collaboration',
  /** The invite button (its label and its tooltip are the same words). */
  invite: 'Invite someone',
  /** The beam control (section 6.4): hand the whole session - and the uploads it uses - down
   *  the channel that is already up. */
  sendSession: 'Send this session',
  /** A send that never reached the toast, announced. Everything that fails AFTER the
   *  offer goes out is the toast's own copy, with its typed reason. */
  sendFailed: 'That could not be sent.',
  /** The roster popover. */
  roster: 'Collaborators',
  /** The avatar stack's accessible name - everyone here, by name. */
  stack: 'Collaborators: {names}',

  // section 4.5's role fallbacks, for anyone who did not choose a name.
  host: 'Host',
  invitee: 'Invitee',
  inviteeNumbered: 'Invitee {n}',

  // Roster row tags.
  you: 'You',
  observer: 'Observer',
  awayTag: 'Away',
  /** The pill's own banner: this client can watch but not edit. */
  observing: 'Observing',

  // Announcements.
  joined: '{name} joined',
  left: '{name} left',

  // The connection dot's five states (see DOT_LABEL_KEYS).
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  away: 'Away',
  closed: 'Disconnected',
};

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLE_ID = 'collab-pill-styles';

/**
 * The three state hues, as raw HSL triplets rather than tokens.
 *
 * `tokens.css` names only `--destructive` of the three; the live/away dot, toast
 * states and validation copy have always reached for green and amber by convention.
 * Naming the convention here is the honest version - and it is the same convention
 * `collab-colors.ts` guards a 32° arc around (`SEMANTIC_HUES`), so no collaborator's
 * colour can ever be mistaken for this dot.
 */
const CSS = `
.collab-pill {
  display: inline-flex;
  align-items: center;
  gap: calc(6px * var(--a11y-fs));
  box-sizing: border-box;
  min-height: var(--chrome-h);
  padding: calc(3px * var(--a11y-fs)) calc(8px * var(--a11y-fs));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  background: hsl(var(--card) / 0.85);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  color: hsl(var(--foreground));
  font-size: calc(12px * var(--a11y-fs));
  line-height: 1;
  /* Local, overridable state hues - see the constant's note above. */
  --collab-live: 142 71% 36%;
  --collab-wait: 38 92% 45%;
  --collab-gone: 0 72% 48%;
}

/* The stage-HUD placement (section 4.6). --collab-pill-offset is what clears whatever else
   owns the top-inline-end lane (.stage-nav, editor.css); the mount site sets it.
   --vv-* are the pinch-zoom offsets the rest of the top row uses; they are physical
   by nature (the visual viewport is), which is why only the inset composes them. */
.collab-pill--stage {
  position: absolute;
  top: calc(var(--chrome-top) + var(--vv-top, 0px));
  inset-inline-end: calc(var(--chrome-inset) + var(--vv-right, 0px) + var(--collab-pill-offset, 0px));
  z-index: 20;
}

/* ── Connection dot: colour AND shape, never colour alone ─────────────────── */
.collab-dot {
  flex: none;
  box-sizing: border-box;
  width: calc(10px * var(--a11y-fs));
  height: calc(10px * var(--a11y-fs));
  border-radius: 999px;
  position: relative;
}
.collab-dot[data-state="live"] { background: hsl(var(--collab-live)); }
/* A hollow ring reads as "not settled yet" at a glance, with no colour needed. */
.collab-dot[data-state="connecting"],
.collab-dot[data-state="reconnecting"] {
  background: none;
  border: calc(2px * var(--a11y-fs)) solid hsl(var(--collab-wait));
}
.collab-dot[data-state="reconnecting"] { animation: collab-dot-pulse 1.4s ease-in-out infinite; }
/* Split disc - present but not attending. */
.collab-dot[data-state="away"] {
  background: linear-gradient(to bottom, hsl(var(--collab-wait)) 50%, transparent 50%);
  border: 1px solid hsl(var(--collab-wait));
}
/* Barred ring: the "no entry" shape, so the red is a second signal not the only one. */
.collab-dot[data-state="closed"] {
  background: none;
  border: 1px solid hsl(var(--collab-gone));
}
.collab-dot[data-state="closed"]::after {
  content: "";
  position: absolute;
  inset-inline: 50%;
  top: 10%;
  bottom: 10%;
  width: 1px;
  background: hsl(var(--collab-gone));
  transform: rotate(45deg);
  transform-origin: center;
}
@keyframes collab-dot-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) {
  .collab-dot[data-state="reconnecting"] { animation: none; }
  .collab-av.is-new { animation: none; }
}
html[data-a11y-motion="reduce"] .collab-dot[data-state="reconnecting"] { animation: none; }
html[data-a11y-motion="reduce"] .collab-av.is-new { animation: none; }

/* ── Avatar stack ─────────────────────────────────────────────────────────── */
.collab-stack {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.collab-av {
  flex: none;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: calc(24px * var(--a11y-fs));
  height: calc(24px * var(--a11y-fs));
  border-radius: 999px;
  font-size: calc(11px * var(--a11y-fs));
  font-weight: 700;
  line-height: 1;
  /* One fixed ink, because the avatar's ground is a collaborator colour projected
     into a fixed OKLCH band (collab-colors.ts) - it does not move with the theme,
     so neither should the letters on it. */
  color: hsl(222 47% 8%);
  /* The 1px halo: the inner ring in the theme ground separates two overlapping
     avatars, the outer hairline in the theme ink keeps the disc legible against a
     canvas that happens to be the same colour (section 4.4). */
  box-shadow: 0 0 0 1px hsl(var(--card)), 0 0 0 calc(2px * var(--a11y-fs)) hsl(var(--foreground) / 0.28);
  margin-inline-start: calc(-7px * var(--a11y-fs));
}
.collab-stack .collab-av:first-child { margin-inline-start: 0; }
.collab-av[data-away="1"] { opacity: 0.55; }
.collab-av--more {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: calc(10px * var(--a11y-fs));
}
.collab-av.is-new { animation: collab-av-in 0.18s ease-out; }
@keyframes collab-av-in { from { transform: scale(0.6); opacity: 0; } to { transform: none; opacity: 1; } }

/* ── Tags + invite ────────────────────────────────────────────────────────── */
.collab-tag {
  flex: none;
  padding: calc(2px * var(--a11y-fs)) calc(6px * var(--a11y-fs));
  border-radius: 999px;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: calc(10px * var(--a11y-fs));
  font-weight: 600;
  white-space: nowrap;
}
/* One control geometry for every icon button in the cluster: the invite slot and the
   action slots (section 6.4's "Send this session"). Two classes rather than one because the
   invite button is addressed by name elsewhere in this file (the lazy-namespace
   repaint re-stamps ITS label, not an action's). */
.collab-invite,
.collab-action {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: calc(24px * var(--a11y-fs));
  height: calc(24px * var(--a11y-fs));
  padding: 0;
  border: none;
  border-radius: 999px;
  background: none;
  color: inherit;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
/* The inline-flex above out-specifies the UA's [hidden] { display: none }, so an action
   hidden while its lane is down would still paint without this. */
.collab-invite[hidden],
.collab-action[hidden] { display: none; }
.collab-action:disabled { opacity: 0.5; cursor: default; }
.collab-invite:hover,
.collab-action:not(:disabled):hover { background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); }
.collab-invite svg,
.collab-action svg { width: calc(15px * var(--a11y-fs)); height: calc(15px * var(--a11y-fs)); }
@media (prefers-reduced-motion: reduce) { .collab-invite, .collab-action { transition: none; } }
html[data-a11y-motion="reduce"] .collab-invite,
html[data-a11y-motion="reduce"] .collab-action { transition: none; }

/* ── Roster popover ───────────────────────────────────────────────────────── */
.collab-roster {
  position: fixed;
  z-index: 9000;
  min-width: calc(200px * var(--a11y-fs));
  max-width: min(calc(320px * var(--a11y-fs)), 90vw);
  padding: calc(6px * var(--a11y-fs));
  border: 1px solid hsl(var(--border));
  border-radius: calc(12px * var(--a11y-fs));
  background: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
  box-shadow: 0 10px 30px hsl(var(--foreground) / 0.18);
  font-size: calc(12px * var(--a11y-fs));
}
.collab-roster:focus { outline: none; }
.collab-roster-list { margin: 0; padding: 0; list-style: none; }
.collab-roster-row {
  display: flex;
  align-items: center;
  gap: calc(8px * var(--a11y-fs));
  padding: calc(5px * var(--a11y-fs)) calc(6px * var(--a11y-fs));
  border-radius: calc(8px * var(--a11y-fs));
}
.collab-roster-row + .collab-roster-row { margin-block-start: calc(2px * var(--a11y-fs)); }
.collab-roster-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.collab-roster-tags { display: inline-flex; gap: calc(4px * var(--a11y-fs)); flex: none; }`;

function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

// ── Pure helpers (exported: the focus overlay and the projects badge need the
//    same names, and a test can pin them without a DOM) ────────────────────────

/** How many avatars the stack shows before it collapses to "+N" (section 4.6). */
export const COLLAB_STACK_MAX = 3;

/** The dot's five states, in the order a session walks them. */
export type CollabDotState = 'connecting' | 'live' | 'reconnecting' | 'away' | 'closed';

/**
 * What the dot shows.
 *
 * `away` is not a connection state on the wire - the transport is perfectly healthy
 * - but it IS what a person needs to know, so a live session in which every peer has
 * a hidden tab reads as away rather than as live (section 11.4: a background tab is not a
 * dead tab, and it is not an attending one either). With nobody else here at all the
 * dot stays live: being alone is not being away.
 */
export function pillDotState(state: CollabSessionState): CollabDotState {
  if (state.connection !== 'live') return state.connection;
  const peers = state.peers;
  return peers.length > 0 && peers.every(p => p.away) ? 'away' : 'live';
}

/**
 * The label a person is shown, with section 4.5's role fallbacks.
 *
 * A chosen name always wins. Without one the person is identified by their place in
 * the session instead of by a device id: the inviter owns the session (section 6.2a) so
 * they are the Host, everyone else is an Invitee, numbered from the second one on so
 * a pair never reads as "Invitee 1".
 */
export function collabDisplayName(p: CollabParticipant): string {
  if (p.name) return p.name;
  if (p.isHost) return tRaw(STRINGS.host);
  return p.inviteeIndex > 1 ? tRaw(STRINGS.inviteeNumbered, { n: p.inviteeIndex }) : tRaw(STRINGS.invitee);
}

/**
 * Up to two initials for the avatar disc.
 *
 * Code points, not code units, so an emoji or an astral-plane name does not get
 * sliced into a lone surrogate; and the first letter of each of the first two
 * WORDS, which is what makes "Priya Fernandes" read as PF rather than PR. A name
 * with no letters at all (only punctuation, only spaces) yields '' and the disc is
 * then colour + halo only - which is fine, because the initials were never the
 * accessible name.
 */
export function collabInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  let out = '';
  for (const word of words) {
    const first = [...word][0];
    if (first) out += first.toUpperCase();
  }
  return out;
}

/** The chip's truncation point (section 4.5: "chips truncate at ~12 chars"). The full name
 *  always survives in the roster and in every announcement. */
export const COLLAB_CHIP_MAX = 12;

/** `name` shortened for a chip, with an ellipsis when it was cut. */
export function collabChipName(name: string): string {
  const chars = [...name];
  return chars.length <= COLLAB_CHIP_MAX ? name : `${chars.slice(0, COLLAB_CHIP_MAX - 1).join('')}…`;
}

// ── The component ─────────────────────────────────────────────────────────────

/** The slice of a `CollabSession` the pill reads. Structural, so a test drives it
 *  with a scripted stream and the stitch pass passes the real session straight in. */
export interface CollabPillSource {
  state(): CollabSessionState;
  subscribe(fn: (state: CollabSessionState) => void): () => void;
}

/**
 * The extra controls the cluster knows how to LABEL.
 *
 * A kind rather than a caller-supplied string, and that is the whole design: every
 * word this component renders has to live in {@link STRINGS} above, or the
 * translation corpus cannot see it (`collab-i18n.test.ts` scans this file's map and
 * nothing else). So a caller supplies BEHAVIOUR - what to run, and whether it is
 * available right now - and the pill supplies the copy, the glyph and the a11y name.
 */
export type CollabPillActionKind = 'send-session';

export interface CollabPillAction {
  readonly kind: CollabPillActionKind;
  /** Run it. Awaited: the control disables itself for the duration, so a beam cannot
   *  be started twice by a double click. A throw is announced, never swallowed. */
  onSelect(): void | Promise<unknown>;
  /**
   * Re-read on EVERY render: `false` hides the control.
   *
   * Not a constant, because the answer changes under the user - a beam's lane dies
   * with the pair, and leaving a button that can only fail is the dead control section 4.6
   * refuses. The session's own state stream is what re-renders the pill, so a
   * connection dropping to `closed` takes the action with it in the same paint.
   * Absent means always shown.
   */
  available?(): boolean;
}

export interface CollabPillOptions {
  /** The live session state. */
  source: CollabPillSource;
  /**
   * The invite slot. The button is rendered ONLY when this is supplied - a session
   * nobody may invite into (an org room, a joined pair) must not show a dead
   * control. Wiring it to the launch registry is the stitch pass's job; this
   * component deliberately imports nothing from it.
   */
  onInvite?: () => void;
  /**
   * Extra controls, in order, after the invite slot.
   *
   * The same rule as `onInvite` one step generalised: an action that is not supplied
   * is not rendered, so a work collab (whose transport has no beam lane at all) grows
   * no send button rather than one that answers "not available". The caller decides
   * what exists; this component decides what it is called.
   */
  actions?: readonly CollabPillAction[];
  /** Extra class on the root - pass `'collab-pill--stage'` for the section 4.6 placement. */
  className?: string;
  /** Screen-reader announcer. Injected so a test can assert the join/leave copy
   *  without a live region (and so /pro's isolated tree could pass its own). */
  announce?: (message: string) => void;
  /** Reduced-motion read. Injected for the same reason. */
  reducedMotion?: () => boolean;
}

export interface CollabPill {
  /** The mounted root element. */
  readonly el: HTMLElement;
  /** Re-render from the source's current state (the stream does this for you). */
  refresh(): void;
  /** Unsubscribe, close the popover, remove the element. Idempotent. */
  destroy(): void;
}

/** One avatar disc. `title` is the full name; the letters are decoration. */
function avatarEl(p: CollabParticipant): HTMLElement {
  const el = document.createElement('span');
  el.className = 'collab-av';
  el.dataset.clientId = p.clientId;
  if (p.away) el.dataset.away = '1';
  if (p.color) el.style.background = p.color;
  el.title = collabDisplayName(p);
  const letters = document.createElement('span');
  letters.setAttribute('aria-hidden', 'true');
  letters.textContent = collabInitials(collabDisplayName(p));
  el.appendChild(letters);
  return el;
}

function tagEl(text: string): HTMLElement {
  const el = document.createElement('span');
  el.className = 'collab-tag';
  el.textContent = text;
  return el;
}

/**
 * The dot's label, as KEY NAMES rather than copy.
 *
 * A table of resolved strings would be five `STRINGS.x` references sitting outside any
 * `tRaw()` - indistinguishable, to a reviewer or to the scan in `collab-i18n.test.ts`,
 * from five sites that forgot to translate. Holding `keyof typeof STRINGS` keeps the
 * single translation at the render site and still has TypeScript check both the state
 * coverage and the key spelling.
 */
const DOT_LABEL_KEYS: Record<CollabDotState, keyof typeof STRINGS> = {
  connecting: 'connecting',
  live: 'live',
  reconnecting: 'reconnecting',
  away: 'away',
  closed: 'closed',
};

/** An action's copy and glyph, by kind - key NAMES for the reason above, and one
 *  exhaustive record per concern so a new kind fails the typecheck three times rather
 *  than rendering nameless. */
const ACTION_LABEL_KEYS: Record<CollabPillActionKind, keyof typeof STRINGS> = {
  'send-session': 'sendSession',
};
const ACTION_FAIL_KEYS: Record<CollabPillActionKind, keyof typeof STRINGS> = {
  'send-session': 'sendFailed',
};
const ACTION_ICONS: Record<CollabPillActionKind, IconName> = {
  'send-session': 'plane',
};

/**
 * `icon()` markup as a real node, so this file holds no raw-HTML sink (primitive-guards
 * R10). `icon()` returns one of this repo's own path constants, so this was never a
 * safety problem - it is the inventory rule: an `innerHTML` line is a line a reviewer
 * re-checks on every edit, and this one never had to be one. The parse yields the same
 * element tree the HTML parser built, so the rendered DOM is unchanged; a host with no
 * DOMParser (or an unregistered glyph) leaves the button with its accessible name and
 * no picture, which is the same floor an absent icon always had.
 */
function iconNode(name: IconName): Element | null {
  const markup = icon(name);
  const parser = document.defaultView?.DOMParser ?? (globalThis as { DOMParser?: typeof DOMParser }).DOMParser;
  if (!markup || !parser) return null;
  const parsed = new parser().parseFromString(markup, 'image/svg+xml').documentElement;
  // DOMParser reports a malformed document as a <parsererror> root rather than throwing.
  if (!parsed || parsed.localName === 'parsererror' || parsed.getElementsByTagName('parsererror').length) return null;
  return document.importNode(parsed, true);
}

/**
 * Position the roster popover under the pill, aligned to its inline-END edge.
 *
 * `body-popover.ts`'s default aligns to the physical right, which mirrors wrong in
 * RTL - the popover would hang off the far side of the cluster it belongs to. The
 * document direction decides which physical edge "inline-end" is, and the 8px floor
 * on both sides keeps it inside the viewport either way.
 */
function positionRoster(el: HTMLDivElement, anchor: PopoverAnchor): void {
  const r = anchor.getBoundingClientRect();
  const rtl = typeof getComputedStyle === 'function'
    && getComputedStyle(document.documentElement).direction === 'rtl';
  el.style.top = `${Math.round(r.bottom + 8)}px`;
  if (rtl) {
    el.style.right = '';
    el.style.left = `${Math.max(8, Math.round(r.left))}px`;
  } else {
    el.style.left = '';
    el.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
  }
}

export function mountCollabPill(container: HTMLElement, opts: CollabPillOptions): CollabPill {
  ensureStyles();
  const say = opts.announce ?? ((m: string) => { announceLive(m); });
  const stillness = opts.reducedMotion ?? prefersReducedMotion;

  const el = document.createElement('div');
  el.className = opts.className ? `collab-pill ${opts.className}` : 'collab-pill';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', tRaw(STRINGS.group));

  const dot = document.createElement('span');
  dot.className = 'collab-dot';
  const dotLabel = document.createElement('span');
  dotLabel.className = 'visually-hidden';
  dotLabel.setAttribute('aria-live', 'polite');

  const stack = document.createElement('button');
  stack.type = 'button';
  stack.className = 'collab-stack';
  stack.setAttribute('aria-haspopup', 'true');
  stack.setAttribute('aria-expanded', 'false');

  const tags = document.createElement('span');
  tags.className = 'collab-pill-tags';

  el.append(dot, dotLabel, stack, tags);

  if (opts.onInvite) {
    const invite = document.createElement('button');
    invite.type = 'button';
    invite.className = 'collab-invite';
    invite.setAttribute('aria-label', tRaw(STRINGS.invite));
    invite.title = tRaw(STRINGS.invite);
    const glyph = iconNode('plus');
    if (glyph) invite.appendChild(glyph);
    invite.addEventListener('click', () => { opts.onInvite?.(); });
    el.appendChild(invite);
  }

  // ── action slots ────────────────────────────────────────────────────────────
  //
  // Built ONCE and hidden/shown per render, rather than rebuilt with the avatars.
  // A control that is destroyed and recreated on every presence tick loses focus
  // mid-keyboard-navigation and re-fires its own tooltip; the visibility read is the
  // only thing that has to be live.
  const actionSlots: { action: CollabPillAction; el: HTMLButtonElement }[] = [];
  for (const action of opts.actions ?? []) {
    // An unknown kind is a control we have no words for. Rendering it nameless would
    // be worse than not rendering it.
    if (!Object.hasOwn(ACTION_LABEL_KEYS, action.kind)) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'collab-action';
    btn.dataset.action = action.kind;
    const glyph = iconNode(ACTION_ICONS[action.kind]);
    if (glyph) btn.appendChild(glyph);
    btn.addEventListener('click', () => { void runAction(action, btn); });
    el.appendChild(btn);
    actionSlots.push({ action, el: btn });
  }

  /** Label (and re-label, after the lazy namespace lands) every action slot. */
  function labelActions(): void {
    for (const slot of actionSlots) {
      const label = tRaw(STRINGS[ACTION_LABEL_KEYS[slot.action.kind]]);
      slot.el.setAttribute('aria-label', label);
      slot.el.title = label;
    }
  }
  labelActions();

  /**
   * Run one action, exactly once at a time.
   *
   * The disable is the whole guard: a beam is a transfer, and a second one started by
   * an impatient second click is refused by the session as `busy` - a refusal the
   * human would read as "it didn't work". A failure that never reached the toast (no
   * lane, nothing to send, a build that threw) is announced here, because the toast
   * only exists from the offer frame onward.
   */
  async function runAction(action: CollabPillAction, btn: HTMLButtonElement): Promise<void> {
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      await action.onSelect();
    } catch (e) {
      console.warn('[lolly:collab] pill action failed', e);
      say(tRaw(STRINGS[ACTION_FAIL_KEYS[action.kind]]));
    } finally {
      btn.disabled = false;
    }
  }

  container.appendChild(el);

  // ── roster popover ──────────────────────────────────────────────────────────

  let rosterEl: HTMLElement | null = null;

  function renderRoster(host: HTMLElement, state: CollabSessionState): void {
    host.textContent = '';
    const list = document.createElement('ul');
    list.className = 'collab-roster-list';
    for (const p of [state.self, ...state.peers]) {
      const row = document.createElement('li');
      row.className = 'collab-roster-row';
      const name = document.createElement('span');
      name.className = 'collab-roster-name';
      name.textContent = collabDisplayName(p);
      const rowTags = document.createElement('span');
      rowTags.className = 'collab-roster-tags';
      if (p.isSelf) rowTags.appendChild(tagEl(tRaw(STRINGS.you)));
      if (p.isHost) rowTags.appendChild(tagEl(tRaw(STRINGS.host)));
      // Only an observer is tagged. A writer needs no badge, and labelling an
      // unknown role as one would be a claim the transport never made.
      if (p.role === 'observer') rowTags.appendChild(tagEl(tRaw(STRINGS.observer)));
      if (p.away) rowTags.appendChild(tagEl(tRaw(STRINGS.awayTag)));
      row.append(avatarEl(p), name, rowTags);
      list.appendChild(row);
    }
    host.appendChild(list);
  }

  const popover: BodyPopoverHandle = mountBodyPopover(
    stack,
    (host) => {
      rosterEl = host;
      host.tabIndex = -1;
      // Stamped here rather than through the `ariaLabel` option: that option is read
      // off an object literal evaluated at MOUNT, which for a lazily-loaded namespace
      // is one microtask too early. The builder runs on every open, so the panel is
      // named in whatever language has landed by then. Same attribute, same order.
      host.setAttribute('aria-label', tRaw(STRINGS.roster));
      renderRoster(host, opts.source.state());
      // Focus the panel itself: it holds no controls, and leaving focus on the
      // trigger would make Escape and the focus wrap read as if nothing opened.
      return host;
    },
    {
      className: 'collab-roster',
      role: 'group',
      position: positionRoster,
    },
  );
  stack.addEventListener('click', () => {
    if (popover.isOpen()) popover.close(true);
    else popover.open();
  });

  // ── render ──────────────────────────────────────────────────────────────────

  /** Who was here last render, and what they were called - the join/leave
   *  announcements are its diff. */
  let seen: Map<string, string> | null = null;

  function render(state: CollabSessionState): void {
    const dotState = pillDotState(state);
    dot.dataset.state = dotState;
    const label = tRaw(STRINGS[DOT_LABEL_KEYS[dotState]]);
    dot.title = label;
    if (dotLabel.textContent !== label) dotLabel.textContent = label;

    const everyone = [state.self, ...state.peers];
    const shown = everyone.length > COLLAB_STACK_MAX
      ? everyone.slice(0, COLLAB_STACK_MAX)
      : everyone;
    const overflow = everyone.length - shown.length;

    stack.textContent = '';
    const fresh = !stillness();
    for (const p of shown) {
      const av = avatarEl(p);
      if (fresh && seen && !p.isSelf && !seen.has(p.clientId)) av.classList.add('is-new');
      stack.appendChild(av);
    }
    if (overflow > 0) {
      const more = document.createElement('span');
      more.className = 'collab-av collab-av--more';
      more.setAttribute('aria-hidden', 'true');
      more.textContent = `+${overflow}`;
      stack.appendChild(more);
    }
    stack.setAttribute(
      'aria-label',
      tRaw(STRINGS.stack, { names: everyone.map(collabDisplayName).join(', ') }),
    );

    tags.textContent = '';
    // The observer banner is about THIS client - "you can watch but not edit" is a
    // fact about the person reading it, so it rides the pill, not only the roster.
    if (state.role === 'observer') tags.appendChild(tagEl(tRaw(STRINGS.observing)));

    // Availability, re-read every paint. A throwing predicate hides its control
    // rather than taking the roster down with it - the same containment rule the
    // announcements below and `tool-collab.ts`'s two overlays are written to.
    for (const slot of actionSlots) {
      let shown = true;
      try {
        shown = slot.action.available?.() !== false;
      } catch (e) {
        console.warn('[lolly:collab] pill action availability', e);
        shown = false;
      }
      slot.el.hidden = !shown;
    }

    // Join/leave, announced once each. The first render is the roster as found, not
    // a burst of arrivals, so it seeds the map silently. Names are carried in that
    // map rather than looked up on the way out - by the time someone has left, the
    // roster entry that knew what to call them is gone.
    const now = new Map(state.peers.map(p => [p.clientId, collabDisplayName(p)] as const));
    if (seen) {
      for (const [id, name] of now) {
        if (!seen.has(id)) say(tRaw(STRINGS.joined, { name }));
      }
      for (const [id, name] of seen) {
        if (!now.has(id)) say(tRaw(STRINGS.left, { name }));
      }
    }
    seen = now;

    if (rosterEl && popover.isOpen()) renderRoster(rosterEl, state);
    else if (!popover.isOpen()) rosterEl = null;
  }

  render(opts.source.state());
  const unsubscribe = opts.source.subscribe(render);

  let destroyed = false;

  // The pill's copy is in the lazy `collab` namespace (i18n.ts). English is skipped
  // OUTRIGHT rather than relying on loadNamespace's own early return, so an English
  // build behaves exactly as it did before this wave; every other language paints
  // English for one microtask and then repaints in place. Repainting is safe here - 
  // `render` is a pure function of the source's state, and the two static labels
  // (`aria-label` on the group, the invite button) are re-stamped with it.
  if (currentLang() !== 'en') {
    void loadNamespace('collab').then(() => {
      if (destroyed) return;
      el.setAttribute('aria-label', tRaw(STRINGS.group));
      const inviteBtn = el.querySelector<HTMLButtonElement>('.collab-invite');
      if (inviteBtn) {
        inviteBtn.setAttribute('aria-label', tRaw(STRINGS.invite));
        inviteBtn.title = tRaw(STRINGS.invite);
      }
      labelActions();
      render(opts.source.state());
    });
  }

  return {
    el,
    refresh() { if (!destroyed) render(opts.source.state()); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      popover.close();
      rosterEl = null;
      el.remove();
    },
  };
}
