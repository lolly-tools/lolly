// SPDX-License-Identifier: MPL-2.0
/**
 * Shared tile context menu - right-click, press-and-hold (touch), and an explicit
 * `openAt()` for kebab buttons - over one body-mounted popover.
 *
 * Extracted from views/projects.ts, which grew the reference implementation
 * (pointAnchor + edge-clamped positioning + "right-click inside a multi-selection
 * opens the BULK menu"), so the gallery and catalog get the identical behaviour
 * instead of a third and fourth hand-rolled copy. The popover lifecycle (Escape,
 * outside pointerdown, resize, route change, focus trap) is mountBodyPopover's;
 * this module owns only what sits above it:
 *
 *  - `contextmenu` delegation on the persistent host element: resolve the tile,
 *    ask the view for its ref, and open the single-tile menu at the cursor - or
 *    the bulk menu when the tile is part of the current multi-selection. A tile
 *    the view declines (refOf → null) falls through to the NATIVE menu.
 *  - The touch bridge: press-and-hold on a tile opens the same menu. Android
 *    Chrome fires `contextmenu` on a long-press but iOS Safari never does over
 *    ordinary elements (see free-canvas.ts's two-finger-tap rationale), so the
 *    hold is armed manually per free-canvas's toolBtn pattern: HOLD_MS timer,
 *    travel-slop cancel (a press that moves is a scroll), and the click that the
 *    ending pointerup still delivers is swallowed so the tile doesn't ALSO
 *    activate. Bare `setTimeout`/`clearTimeout` on purpose - pairing
 *    `window.setTimeout` with a bare `clearTimeout` cancels nothing under jsdom.
 *    Touch/pen pointers only: on a mouse a >420ms press is a hesitation or an
 *    HTML5 drag (projects tiles are draggable), never a menu request.
 *  - Menu content and dispatch stay the VIEW's: `singleHtml`/`bulkHtml` build the
 *    rows (see `menuItemHtml` below), `onAction` handles the picked `[data-act]`.
 *    The menu is closed BEFORE onAction runs so a follow-up dialog never opens
 *    behind it.
 *
 * A11y shape carried over from projects: a single-tile menu's items ARE the
 * popover (role="menu"); the bulk menu prefixes a plain-text "{n} selected" head,
 * so its role="menu" must live on an inner wrapper (the caller's bulkHtml owns
 * that) and the outer div demotes to a plain group.
 *
 * `destroy()` is mandatory in the view's `_cleanup` - the host listeners survive
 * the view's own re-renders by design (that's why they bind to the persistent
 * viewEl), so only teardown removes them.
 */

import { mountBodyPopover, pointAnchor, type PopoverAnchor } from '../components/body-popover.ts';
import { escape } from '../utils.ts';

/** How long a press has to be held to count as "show me this tile's menu" rather
 *  than "open this tile" - same feel as free-canvas's rail buttons. */
const HOLD_MS = 420;
/** Pointer travel that turns a hold into a scroll/drag and cancels the menu, screen px. */
const HOLD_SLOP = 8;

/** One row of a context menu: icon + label, `render`/`danger` tinted variants.
 *  The `.folder-menu-item` family is the app-wide menu row (folders.css). */
export function menuItemHtml(
  act: string,
  icon: string,
  label: string,
  { render = false, danger = false }: { render?: boolean; danger?: boolean } = {},
): string {
  return `<button type="button" class="folder-menu-item${render ? ' folder-menu-item--render' : ''}${danger ? ' folder-menu-item--danger' : ''}" role="menuitem" data-act="${escape(act)}">${icon}<span>${escape(label)}</span></button>`;
}

/** What a single-tile open carries: the tile's ref, the tile element (null when a
 *  header-level kebab has no enclosing tile), and an optional caller payload (e.g.
 *  projects' folder/session/image kind, read off the kebab's dataset). */
export interface ContextMenuTarget {
  ref: string;
  tile: HTMLElement | null;
  data?: string;
}

export interface TileContextMenuOptions {
  /** The PERSISTENT view element (survives render()), not the re-rendered root. */
  host: HTMLElement;
  /** closest() selector for a tile that owns a menu. */
  tileSelector: string;
  /** The tile's ref - return null to decline (native menu / no hold armed). */
  refOf(tile: HTMLElement): string | null;
  /** True when the ref is part of the current multi-selection → open the bulk menu. */
  isBulkTarget?(ref: string): boolean;
  /** Rows for one tile's menu (menuItemHtml strings). Return '' to decline. */
  singleHtml(target: ContextMenuTarget): string;
  /** Bulk menu body: a `.folder-menu-head` count + an inner role="menu" list. */
  bulkHtml?(): string;
  /**
   * Background menu (plans/133 WP-13 - the file-manager "right-click on empty
   * canvas" menu: New folder / Paste / Select all…). Opens for a right-click inside
   * the host that hits no tile and no control (links, buttons, fields, dialogs
   * keep the native menu). Return '' to decline for this click.
   */
  backgroundHtml?(): string;
  /** Dispatch a picked row. `target` is null for the bulk AND background menus -
   *  `kind` tells them apart. Runs after close(). */
  onAction(act: string, target: ContextMenuTarget | null, kind: 'single' | 'bulk' | 'background'): void;
  /** Popover class. The default pairs the shared skin with fixed positioning. */
  className?: string;
}

export interface TileContextMenuHandle {
  /** Open the single-tile menu at a point. `anchor` (a kebab button) receives the
   *  focus restore + aria-expanded upkeep; pointer opens leave it null. */
  openAt(x: number, y: number, target: ContextMenuTarget, anchor?: HTMLElement | null): void;
  openBulkAt(x: number, y: number): void;
  openBackgroundAt(x: number, y: number): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

/** Clamped to stay on-screen (flips up near the bottom edge) - the popover is
 *  position:fixed, so viewport coordinates are the whole story. */
function clampedPosition(el: HTMLDivElement, anchor: PopoverAnchor): void {
  const r = anchor.getBoundingClientRect();
  const pw = el.offsetWidth, ph = el.offsetHeight;
  const left = Math.max(8, Math.min(r.left, window.innerWidth - pw - 12));
  const top = (r.top + ph > window.innerHeight - 8) ? Math.max(8, r.top - ph - 12) : r.top;
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

export function wireTileContextMenu(opts: TileContextMenuOptions): TileContextMenuHandle {
  const point = pointAnchor();
  type Pending = { kind: 'single'; target: ContextMenuTarget } | { kind: 'bulk' } | { kind: 'background' };
  let pending: Pending | null = null;

  const popover = mountBodyPopover(point, (el) => {
    if (!pending) return null;
    el.setAttribute('role', pending.kind === 'bulk' ? 'group' : 'menu');
    el.innerHTML = pending.kind === 'bulk' ? (opts.bulkHtml?.() ?? '')
      : pending.kind === 'background' ? (opts.backgroundHtml?.() ?? '')
      : opts.singleHtml(pending.target);
    el.addEventListener('click', onMenuClick);
    return el.querySelector<HTMLElement>('[data-act]');
  }, { className: opts.className ?? 'folder-menu ctx-menu', position: clampedPosition });

  function onMenuClick(e: MouseEvent): void {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    const p = pending; // snapshot - close() below is what makes a stale click impossible
    if (!item || !p) return;
    const act = item.dataset.act!;
    popover.close();
    opts.onAction(act, p.kind === 'single' ? p.target : null, p.kind);
  }

  function openBackgroundAt(x: number, y: number): void {
    popover.close();
    pending = { kind: 'background' };
    point.x = x; point.y = y; point.delegate = null;
    popover.open();
  }

  function openAt(x: number, y: number, target: ContextMenuTarget, anchor: HTMLElement | null = null): void {
    popover.close();
    pending = { kind: 'single', target };
    point.x = x; point.y = y; point.delegate = anchor;
    popover.open();
  }

  function openBulkAt(x: number, y: number): void {
    popover.close();
    pending = { kind: 'bulk' };
    point.x = x; point.y = y; point.delegate = null;
    popover.open();
  }

  /** Open at a point, routing to the bulk menu when the tile is in the selection. */
  function openFor(ref: string, tile: HTMLElement, x: number, y: number): void {
    if (opts.bulkHtml && opts.isBulkTarget?.(ref)) openBulkAt(x, y);
    else openAt(x, y, { ref, tile });
  }

  // ── right-click ───────────────────────────────────────────────────────────
  const onContextMenu = (e: MouseEvent): void => {
    const tile = (e.target as HTMLElement).closest<HTMLElement>(opts.tileSelector);
    if (!tile || !opts.host.contains(tile)) {
      // Empty canvas: the background menu, unless the click is on something with
      // its own native menu (a link, a control, a field) or the view declines.
      if (!opts.backgroundHtml || !opts.host.contains(e.target as Node)) return;
      if ((e.target as HTMLElement).closest('a, button, input, textarea, select, [contenteditable], dialog, [role="menu"]')) return;
      const html = opts.backgroundHtml();
      if (!html) return;
      e.preventDefault();
      openBackgroundAt(e.clientX, e.clientY);
      return;
    }
    // An Android long-press already opened the menu via the hold below and the OS
    // follows up with a contextmenu - swallow it instead of flickering a re-open.
    if (holdFired) { e.preventDefault(); return; }
    const ref = opts.refOf(tile);
    if (ref == null) return;   // declined → the native menu shows
    e.preventDefault();
    openFor(ref, tile, e.clientX, e.clientY);
  };

  // ── press-and-hold (the touch path) ───────────────────────────────────────
  let holdTimer: ReturnType<typeof setTimeout> | 0 = 0;
  let holdFrom: { x: number; y: number } | null = null;
  let holdTile: HTMLElement | null = null;
  let holdFired = false;

  const cancelHold = (): void => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = 0; }
    holdFrom = null; holdTile = null;
  };

  const onPointerDown = (e: PointerEvent): void => {
    holdFired = false;
    if (e.button > 0) return;                                   // right button takes the contextmenu path
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    const tile = (e.target as HTMLElement).closest<HTMLElement>(opts.tileSelector);
    if (!tile || !opts.host.contains(tile) || opts.refOf(tile) == null) return;
    holdFrom = { x: e.clientX, y: e.clientY };
    holdTile = tile;
    holdTimer = setTimeout(() => {
      holdTimer = 0;
      const from = holdFrom, t = holdTile;
      holdFrom = null; holdTile = null;
      if (!from || !t?.isConnected) return;
      const ref = opts.refOf(t);
      if (ref == null) return;
      holdFired = true;
      openFor(ref, t, from.x, from.y);
    }, HOLD_MS);
  };
  const onPointerMove = (e: PointerEvent): void => {
    // A press that travels is someone scrolling the grid, not someone holding a tile.
    if (holdFrom && Math.hypot(e.clientX - holdFrom.x, e.clientY - holdFrom.y) > HOLD_SLOP) cancelHold();
  };
  const onPointerEnd = (): void => cancelHold();
  // Capture phase: the pointerup that ends a hold still delivers a click to the
  // tile (whose whole body is often a link/button) - eat exactly that one so a
  // menu request never ALSO opens the tile.
  const onClickCapture = (e: MouseEvent): void => {
    if (!holdFired) return;
    holdFired = false;
    e.preventDefault();
    e.stopPropagation();
  };

  opts.host.addEventListener('contextmenu', onContextMenu);
  opts.host.addEventListener('pointerdown', onPointerDown);
  opts.host.addEventListener('pointermove', onPointerMove);
  opts.host.addEventListener('pointerup', onPointerEnd);
  opts.host.addEventListener('pointercancel', onPointerEnd);
  opts.host.addEventListener('click', onClickCapture, true);

  return {
    openAt,
    openBulkAt,
    openBackgroundAt,
    close: () => popover.close(),
    isOpen: () => popover.isOpen(),
    destroy: () => {
      cancelHold();
      popover.close();
      opts.host.removeEventListener('contextmenu', onContextMenu);
      opts.host.removeEventListener('pointerdown', onPointerDown);
      opts.host.removeEventListener('pointermove', onPointerMove);
      opts.host.removeEventListener('pointerup', onPointerEnd);
      opts.host.removeEventListener('pointercancel', onPointerEnd);
      opts.host.removeEventListener('click', onClickCapture, true);
    },
  };
}
