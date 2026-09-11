// SPDX-License-Identifier: MPL-2.0
/**
 * collab-tile-state - a generic registry for an EXTERNAL source of live-collab
 * PRESENCE, keyed by saved-session slot, plus the pure DOM renderer that paints it
 * onto a Projects grid tile (plan 100 section 4.6, section 4.8; wave 1.5).
 *
 * Mirrors `session-source.ts`'s shape exactly (see its header for the pattern this
 * follows): a neutral seam the Projects view consults so a tile can show "who's in
 * here right now" without knowing whether that answer came from a Track A peer
 * connection, a Track B room, or nothing at all. It is EMPTY by default, so
 * `getCollabTileProvider()` returns undefined and `renderCollabBadge` is called
 * with an empty peer list - which paints NOTHING (see below) - so every tile in
 * this repo renders exactly as it did before this file existed.
 *
 * THERE IS NO LIVE PROVIDER YET. Track A's ceremony (wave 2.x) and Track B's org
 * adapter (wave 3.x) are what will eventually call `registerCollabTileProvider`,
 * the same way `src/org/index.ts`'s member branch calls `registerSessionSource`
 * today. Until one of them does, this seam is inert - a single registration slot
 * (last-wins), the same convention as every other optional-provider seam in this
 * codebase (`canvas-sync-provider.ts`, `session-source.ts`).
 *
 * WHY A PULL MODEL. `peersFor(slot)` is synchronous and called at TILE RENDER
 * time (Projects' `wire()`, after every `viewEl.innerHTML` rebuild) rather than
 * the badge subscribing to a push feed itself. A provider that wants live updates
 * mid-view (a peer joining while the Projects grid is open) re-renders through
 * its own means - most naturally by triggering the same `wire()`/`render()` path
 * the view already re-runs on every data change - so this module stays exactly
 * what it says: a registry plus a renderer, no timers, no subscriptions, no DOM
 * beyond the one tile it's handed.
 *
 * ── Copy ─────────────────────────────────────────────────────────────────────
 *
 * FOUR strings, and all four are BOOT-catalog copy rather than the lazy `collab`
 * namespace: the badge's `aria-label` in its two count forms, plus the two an avatar's
 * hover `title` needs (the stand-in for a peer who sent no name, and the away suffix).
 * `renderCollabBadge` is synchronous and Projects calls it once per tile on every
 * render pass, so there is no await to load a namespace from - and a screen-reader-only
 * string is the last place an English fallback is acceptable.
 *
 * Every one of them is a literal `t()`/`tRaw()` argument, so scripts/translate.ts's
 * extractSpaKeys picks them up with no hand-list. `tRaw` rather than `t` throughout
 * because both sinks are text (`setAttribute`, and the `title` property), where an
 * escaped `{n}` or an apostrophe in a name would be read out as an entity.
 */
import { tRaw } from '../i18n.ts';

/** One collaborator as a session tile's badge needs to know them - a small
 *  projection of `PresencePeer` (collab-presence.ts), not that type itself: a
 *  tile has no use for cursor/viewport/selection, and importing the full
 *  `Presence` shape here would couple a Projects-grid decoration to the awareness
 *  wire contract for no reason. */
export interface CollabTilePeer {
  /** The peer's collab client id - used only as a React-style key by callers
   *  that diff a peer list; the badge itself never reads it. */
  readonly id: string;
  /** Display name (section 4.5's naming rules already resolved it by the time it gets
   *  here - "Priya F.", "Invitee 2", "Host", …). Its first character becomes the
   *  avatar's initial; falls back to a bullet when absent/empty. */
  readonly name?: string;
  /** The collaborator's assigned colour (collab-colors.ts's `CollabColor.hex`),
   *  as a CSS colour string. Falls back to the theme's `--primary` when absent - 
   *  a tile must never fail to render for want of a colour. */
  readonly color?: string;
  /** Tab hidden (collab-presence.ts's `away`). An away peer still counts toward
   *  "who's here" but paints at reduced opacity - never hidden outright. The
   *  tile badge is a lightweight glance affordance (the pill's roster popover is
   *  where "who's here, who's away" is spelled out in full - collab-pill.ts), so
   *  opacity is paired here with a text hint in the avatar's `title` rather than
   *  a second shape: enough to not be the ONLY signal, without a state machine
   *  this small badge has no room for. */
  readonly away?: boolean;
}

export interface CollabTileProvider {
  /** Every peer currently live on the session at `slot`, or an empty array
   *  (never undefined/null - callers do not have to guard the return). Ordering
   *  is the provider's own join order, matching `collab-presence.ts`'s roster. */
  peersFor(slot: string): readonly CollabTilePeer[];
}

let current: CollabTileProvider | undefined;

/** Register the external collab-tile provider; returns an unregister fn
 *  (last-wins - see the header). */
export function registerCollabTileProvider(provider: CollabTileProvider): () => void {
  current = provider;
  return () => {
    if (current === provider) current = undefined;
  };
}

/** The registered provider, or undefined when dormant (no live collab anywhere). */
export function getCollabTileProvider(): CollabTileProvider | undefined {
  return current;
}

/** TEST-ONLY: clear the registry back to its dormant default. */
export function _clearCollabTileProviderForTests(): void {
  current = undefined;
}

// ── The badge ────────────────────────────────────────────────────────────────

/** Avatars shown before the cluster collapses to "+N" - the same 3 the plan's
 *  collab-pill uses (section 4.6), so a person who has seen the pill recognises the
 *  tile badge as the same idiom. */
const MAX_AVATARS = 3;

/** class of the badge element this function owns end-to-end (create/update/
 *  remove) - never touched by anything else, so re-renders are idempotent. */
const BADGE_CLASS = 'collab-tile-badge';

function initialOf(name: string | undefined): string {
  const ch = (name ?? '').trim().charAt(0);
  return ch ? ch.toUpperCase() : '•'; // U+2022 BULLET - a name-less peer still shows as SOMEONE, not a blank
}

/**
 * One avatar, as a NODE. The colour is deliberately not set here.
 *
 * A peer-supplied colour interpolated into a `style` attribute is a CSS injection
 * (section 11.21 - inbound presence is untrusted, continuously): HTML-escaping replaces only
 * `&<>"'`, so a `;` passes straight through and `red;background-image:url(https://x)`
 * would land as extra declarations on the tile. Every other collab surface writes the
 * same value through `style.setProperty`, which silently REJECTS a value containing
 * `;` - so this one does too, in {@link paintColors} after the avatars exist.
 *
 * Built with `createElement`/`textContent` rather than a markup string (primitive-guards
 * R10). The name and the initial are PEER-SUPPLIED, so the old version's correctness
 * rested on two `escape()` calls being present and staying present; a text node cannot
 * be made to mean markup, so that class of mistake is now unavailable rather than merely
 * avoided. Same element, same class list, same `title`, same single text child.
 */
function avatarEl(doc: Document, peer: CollabTilePeer): HTMLElement {
  const el = doc.createElement('span');
  el.className = peer.away ? 'collab-tile-avatar collab-tile-avatar--away' : 'collab-tile-avatar';
  // Peer-supplied, so the name goes in as a PARAM rather than being concatenated into
  // the key: a name is data, and only the sentence around it is copy. The away form is
  // one whole string for the same reason the count forms are - a suffix glued onto a
  // name is a shape several languages cannot reproduce.
  const name = peer.name || tRaw('Collaborator');
  el.title = peer.away ? tRaw('{name} (away)', { name }) : name;
  el.textContent = initialOf(peer.name);
  return el;
}

/**
 * The structure of a value we are willing to hand to the CSS OM as a colour.
 *
 * A STRUCTURE test, not a colour parser - the sheet's `var(--collab-color, …)` fallback
 * already handles a value CSS cannot use, so the only job here is to make it
 * impossible for the value to stop being a single value. The allowed set covers every
 * colour syntax this codebase mints (`#rrggbb`, `rgb()`, `hsl(h s l / a)`, `oklch()`,
 * a bare keyword) and excludes the two characters that end one declaration and start
 * another (`;` `:`) along with brackets, quotes and backslash. Length-capped because
 * a colour is short and an attacker's payload is not.
 */
const SAFE_COLOR = /^[#a-zA-Z0-9(),.%/ -]{1,64}$/;

/**
 * Apply each shown peer's colour through the CSS OM (see {@link avatarHtml}). The
 * "+N" chip is excluded by class: it represents a count, not a person, and has no
 * colour of its own.
 *
 * Screened BEFORE `setProperty` rather than trusting it. A browser's CSSOM does
 * reject a declaration-list value here, and custom-property substitution cannot
 * split a declaration either - but "it happens to be safe two layers down" is not a
 * property this file can assert about itself, and jsdom stores the raw string, so a
 * test could never see the difference. The screen makes the guarantee local.
 */
function paintColors(badge: Element, shown: readonly CollabTilePeer[]): void {
  const avatars = badge.querySelectorAll<HTMLElement>('.collab-tile-avatar:not(.collab-tile-more)');
  shown.forEach((peer, i) => {
    const el = avatars[i];
    if (el && peer.color && SAFE_COLOR.test(peer.color)) {
      el.style.setProperty('--collab-color', peer.color);
    }
  });
}

/**
 * Paint (or clear) a session tile's live-collab badge.
 *
 * @param tileEl  the tile's root element - a `.folder-tile[data-kind="session"]`
 *                (folder-tiles.ts's `sessionTile()` shape), though nothing here
 *                reads its class list; any element the caller wants a badge
 *                appended to works.
 * @param peers   every peer currently live on that tile's session, or an empty
 *                array/undefined for "no live collab here".
 *
 * ABSENT PROVIDER = ZERO DOM. Call this with an empty `peers` array (the honest
 * answer when `getCollabTileProvider()` is undefined) and it removes any badge
 * it previously painted and otherwise touches NOTHING - the tile's own markup,
 * written by folder-tiles.ts, is never read or rewritten. A tile that never had
 * a live collab is therefore byte-identical whether this function was called on
 * it or not, which is what keeps every build of this repo - none of which ships
 * a provider yet - pixel-for-pixel unchanged (co-located test pins this).
 *
 * Idempotent: safe to call on every render pass (Projects' `wire()` does). It
 * updates its own badge element in place rather than replacing the tile's
 * innerHTML, so it never disturbs sibling controls (`.tile-check`, the drag
 * handlers bound to `.tile-primary`, …) or fires an image reload on `.tile-cover`.
 */
export function renderCollabBadge(
  tileEl: Element,
  peers: readonly CollabTilePeer[] | undefined
): void {
  const existing = tileEl.querySelector(`:scope > .${BADGE_CLASS}`);
  const list = peers ?? [];
  if (list.length === 0) {
    existing?.remove();
    return;
  }

  const doc = tileEl.ownerDocument;
  const badge = (existing as HTMLElement | null) ?? doc.createElement('span');
  if (!existing) {
    badge.className = BADGE_CLASS;
    tileEl.appendChild(badge);
  }
  badge.setAttribute('role', 'status');

  const shown = list.slice(0, MAX_AVATARS);
  const extra = list.length - shown.length;
  // A binary singular/plural split, like beam-toast's item nouns: the catalogs are flat
  // English-keyed strings with no plural DSL, so a language with more than two forms
  // takes the general one. Kept as two whole sentences rather than a count glued to a
  // noun, so a translator can move `{n}` wherever their grammar needs it.
  const label =
    list.length === 1 ? tRaw('Live now - 1 person editing') : tRaw('Live now - {n} people editing', { n: list.length });
  badge.setAttribute('aria-label', label);

  // Rebuilt in place, node by node: `replaceChildren` clears the previous pass exactly
  // as the old wholesale `innerHTML` assignment did, without a raw-HTML sink for a
  // reviewer to re-check every time this shape changes (primitive-guards R10).
  const avatars = doc.createElement('span');
  avatars.className = 'collab-tile-avatars';
  avatars.setAttribute('aria-hidden', 'true');
  for (const peer of shown) avatars.appendChild(avatarEl(doc, peer));
  if (extra > 0) {
    const more = doc.createElement('span');
    more.className = 'collab-tile-avatar collab-tile-more';
    more.textContent = `+${extra}`;
    avatars.appendChild(more);
  }

  const dot = doc.createElement('span');
  dot.className = 'collab-tile-dot';
  dot.setAttribute('data-state', 'live');
  dot.setAttribute('aria-hidden', 'true');

  badge.replaceChildren(avatars, dot);
  paintColors(badge, shown);
}
