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
 * Sheet presentation (opt in with `presentation: 'sheet'`): under a coarse pointer
 * the same menu opens as a bottom sheet instead of a popover at the finger - a
 * full-width panel with an optional head (the tile's thumbnail and name), rows at
 * 48 px, a Cancel row, and a scrim drawn INSIDE the mounted container (the popover
 * shell has none). The scrim and Cancel close it and hand focus back to what opened
 * it; Escape and system Back close it through the popover shell as before. A
 * caller that does not opt in gets exactly the popover it always got, and a mouse
 * right-click on a hybrid device still gets the popover, since the sheet is for a
 * finger.
 *
 * `destroy()` is mandatory in the view's `_cleanup` - the host listeners survive
 * the view's own re-renders by design (that's why they bind to the persistent
 * viewEl), so only teardown removes them.
 */

import { mountBodyPopover, pointAnchor, type PopoverAnchor } from '../components/body-popover.ts';
import { t } from '../i18n.ts';
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
  { render = false, danger = false, reason = '' }: { render?: boolean; danger?: boolean; reason?: string } = {},
): string {
  // A row that cannot run now stays focusable (aria-disabled, not `disabled`) and says
  // why in words on a second line, since a `title` never shows on touch. The reason is
  // the row's description, not part of its name, so the name stays the label a voice
  // user says. A picked aria-disabled row dispatches nothing (see onMenuClick).
  if (reason) {
    const why = `ctx-why-${escape(act)}`;
    return `<button type="button" class="folder-menu-item folder-menu-item--off${danger ? ' folder-menu-item--danger' : ''}" role="menuitem" data-act="${escape(act)}" aria-disabled="true" aria-describedby="${why}">${icon}<span class="folder-menu-text"><span>${escape(label)}</span><small class="folder-menu-reason" id="${why}" aria-hidden="true">${escape(reason)}</small></span></button>`;
  }
  return `<button type="button" class="folder-menu-item${render ? ' folder-menu-item--render' : ''}${danger ? ' folder-menu-item--danger' : ''}" role="menuitem" data-act="${escape(act)}">${icon}<span>${escape(label)}</span></button>`;
}

/** The head of a menu shown as a sheet: the tile's name, and optionally its picture. */
export interface ContextMenuSheetHead {
  /** Plain text; escaped here. */
  name: string;
  /** Trusted markup for a small picture (an `<svg>` or `<img>` the caller drew), shown
   *  at 16:9 beside the name. It is decorative: the name carries the meaning. */
  thumb?: string;
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
  /**
   * The tile under a point, for a host whose tiles the browser cannot hit-test: Cover
   * Flow's covers sit in a preserve-3d fan whose events all target the track (see
   * featured-row.ts). Asked only when the event target has no enclosing tile and is not
   * a control. Return null for "no tile here".
   */
  tileAt?(x: number, y: number): HTMLElement | null;
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
  /**
   * 'sheet' opens the menu as a bottom sheet when the device has a coarse pointer and
   * the menu was not asked for with a mouse. Default 'popover', which never changes.
   */
  presentation?: 'popover' | 'sheet';
  /** The sheet's head for this open (sheet presentation only). `target` is null for the
   *  bulk and background menus. Return null for no head; a bulk menu then keeps its own
   *  `.folder-menu-head` line as the head. */
  head?(target: ContextMenuTarget | null, kind: 'single' | 'bulk' | 'background'): ContextMenuSheetHead | null;
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

/** The mounted container's class when the menu is a sheet. It keeps `ctx-menu` so a
 *  caller's own `.ctx-menu` lookups still find it, and drops the popover skin. */
const SHEET_CLASS = 'ctx-menu ctx-sheet-host';
let sheetSeq = 0;

/** The sheet's markup around the caller's rows: scrim, head, rows, Cancel. */
function sheetHtml(body: string, kind: 'single' | 'bulk' | 'background', head: ContextMenuSheetHead | null, id: string): string {
  const headHtml = head
    ? `<div class="ctx-sheet-head">${head.thumb ? `<span class="ctx-sheet-thumb" aria-hidden="true">${head.thumb}</span>` : ''}<span class="ctx-sheet-name" id="${id}">${escape(head.name)}</span></div>`
    : '';
  // A bulk body carries its own role="menu" list (and its own head line); the others
  // are bare rows, so the sheet gives them the list.
  const list = kind === 'bulk' ? body : `<div class="ctx-sheet-list" role="menu"${head ? ` aria-labelledby="${id}"` : ''}>${body}</div>`;
  return '<div class="ctx-sheet-scrim" data-sheet-scrim aria-hidden="true"></div>'
    + `<div class="ctx-sheet">${headHtml}<div class="ctx-sheet-body">${list}</div>`
    + `<div class="ctx-sheet-foot"><button type="button" class="btn btn--ghost ctx-sheet-cancel" data-sheet-cancel>${escape(t('Cancel'))}</button></div>`
    + '</div>';
}

/** The sheet's position is its CSS (pinned to the bottom edge); the popover's is the point. */
function placeMenu(el: HTMLDivElement, anchor: PopoverAnchor): void {
  if (el.classList.contains('ctx-sheet-host')) { el.style.left = ''; el.style.top = ''; return; }
  clampedPosition(el, anchor);
}

/** Where focus goes back to after a sheet opened from a tile with no button of its own. */
function focusTargetIn(tile: HTMLElement | null): HTMLElement | null {
  if (!tile?.isConnected) return null;
  if (tile.matches('button, a[href], [tabindex]')) return tile;
  return tile.querySelector<HTMLElement>('button, a[href], [tabindex]');
}

export function wireTileContextMenu(opts: TileContextMenuOptions): TileContextMenuHandle {
  const point = pointAnchor();
  type Opening = { kind: 'single'; target: ContextMenuTarget } | { kind: 'bulk' } | { kind: 'background' };
  /** `quiet`: a sheet a finger opened with no button behind it. Focus goes to the sheet
   *  itself, not its first row, so no row looks chosen before the finger picks one. */
  type Pending = Opening & { sheet: boolean; quiet: boolean };
  let pending: Pending | null = null;
  /** The kind of pointer that last pressed inside the host, so a mouse right-click on a
   *  touch laptop keeps the popover. Empty until one does. */
  let lastPointer = '';
  /** Focus goes here when a sheet closes and no button opened it (a press-and-hold). */
  let sheetReturn: HTMLElement | null = null;
  /** Where the last press inside the open sheet began: nowhere yet, a row or the scrim.
   *  A pointer click counts only when its press began in the sheet, so the release of
   *  the hold that opened it (a tap the browser hit-tests at the finger, which the new
   *  sheet now covers) never picks a row or closes it. A keyboard click has no press. */
  let pressedIn: '' | 'sheet' | 'scrim' = '';

  // The point supplies geometry and, when a button opened the menu, the focus restore
  // and aria-expanded upkeep. A sheet opened by a hold returns focus to its tile.
  const anchor: PopoverAnchor = {
    getBoundingClientRect: () => point.getBoundingClientRect(),
    contains: () => false,
    focus: () => { if (point.delegate) point.delegate.focus(); else sheetReturn?.focus(); },
    setAttribute: (name, value) => point.setAttribute?.(name, value),
  };

  const wantsSheet = (): boolean => opts.presentation === 'sheet'
    && lastPointer !== 'mouse'
    && Boolean(window.matchMedia?.('(any-pointer: coarse)').matches);

  const popover = mountBodyPopover(anchor, (el) => {
    if (!pending) return null;
    const body = pending.kind === 'bulk' ? (opts.bulkHtml?.() ?? '')
      : pending.kind === 'background' ? (opts.backgroundHtml?.() ?? '')
      : opts.singleHtml(pending.target);
    const head = pending.sheet ? (opts.head?.(pending.kind === 'single' ? pending.target : null, pending.kind) ?? null) : null;
    const id = pending.sheet ? `ctx-sheet-${++sheetSeq}` : '';
    el.innerHTML = pending.sheet ? sheetHtml(body, pending.kind, head, id) : body;
    if (pending.sheet) {
      el.className = SHEET_CLASS;
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      labelSheet(el, head, id);
      el.addEventListener('pointerdown', onSheetPointerDown);
      el.addEventListener('mousedown', onSheetMouseDown);
      if (pending.quiet) {
        el.tabIndex = -1;
        el.addEventListener('keydown', onSheetKey);
      }
    } else {
      el.setAttribute('role', pending.kind === 'bulk' ? 'group' : 'menu');
    }
    el.addEventListener('click', onMenuClick);
    return pending.quiet ? el : el.querySelector<HTMLElement>('[data-act]');
  }, { className: opts.className ?? 'folder-menu ctx-menu', position: placeMenu });

  /** Labels the sheet: its own head, or the bulk body's count line when there is none. */
  function labelSheet(el: HTMLElement, head: ContextMenuSheetHead | null, id: string): void {
    const own = el.querySelector<HTMLElement>('.ctx-sheet-body > .folder-menu-head');
    if (head) own?.remove();
    else if (own) own.id = id;
    if (head || own) el.setAttribute('aria-labelledby', id);
    const list = el.querySelector<HTMLElement>('.ctx-sheet-body [role="menu"]');
    if (list && (head || own) && !list.hasAttribute('aria-labelledby') && !list.hasAttribute('aria-label')) list.setAttribute('aria-labelledby', id);
  }

  function onSheetPointerDown(e: PointerEvent): void {
    pressedIn = (e.target as HTMLElement).closest?.('[data-sheet-scrim]') ? 'scrim' : 'sheet';
  }

  /** The release of the opening hold also sends a compatibility mousedown to the row now
   *  under the finger. Cancelling it keeps focus where the sheet put it. */
  function onSheetMouseDown(e: MouseEvent): void {
    if (pressedIn === '') e.preventDefault();
  }

  /** From the quiet sheet itself, Tab reaches the first row by DOM order, but Shift+Tab
   *  would leave the sheet, so it wraps to the last control (Cancel) instead. */
  function onSheetKey(e: KeyboardEvent): void {
    const el = e.currentTarget as HTMLElement;
    if (e.key !== 'Tab' || !e.shiftKey || document.activeElement !== el) return;
    e.preventDefault();
    el.querySelector<HTMLElement>('[data-sheet-cancel]')?.focus();
  }

  function onMenuClick(e: MouseEvent): void {
    const hit = e.target as HTMLElement;
    if (pending?.sheet) {
      const pressed = pressedIn;
      pressedIn = '';
      if (hit.closest('[data-sheet-scrim]')) { if (pressed === 'scrim') popover.close(true); return; }
      if (e.detail > 0 && pressed !== 'sheet') return;
      if (hit.closest('[data-sheet-cancel]')) { popover.close(true); return; }
    }
    const item = hit.closest<HTMLElement>('[data-act]');
    const p = pending; // snapshot - close() below is what makes a stale click impossible
    if (!item || !p) return;
    if (item.getAttribute('aria-disabled') === 'true') return; // it says why; it does nothing
    const act = item.dataset.act!;
    popover.close();
    opts.onAction(act, p.kind === 'single' ? p.target : null, p.kind);
  }

  /** One open path for all three menus. */
  function openKind(next: Opening, x: number, y: number, delegate: HTMLElement | null, finger = false): void {
    popover.close();
    const sheet = wantsSheet();
    pending = { ...next, sheet, quiet: sheet && finger && !delegate };
    pressedIn = '';
    sheetReturn = sheet && !delegate && next.kind === 'single' ? focusTargetIn(next.target.tile) : null;
    point.x = x; point.y = y; point.delegate = delegate;
    popover.open();
  }

  function openBackgroundAt(x: number, y: number): void {
    openKind({ kind: 'background' }, x, y, null);
  }

  function openAt(x: number, y: number, target: ContextMenuTarget, anchor: HTMLElement | null = null): void {
    openKind({ kind: 'single', target }, x, y, anchor);
  }

  function openBulkAt(x: number, y: number): void {
    openKind({ kind: 'bulk' }, x, y, null);
  }

  /** Open at a point, routing to the bulk menu when the tile is in the selection. */
  function openFor(ref: string, tile: HTMLElement, x: number, y: number, finger: boolean): void {
    if (opts.bulkHtml && opts.isBulkTarget?.(ref)) openKind({ kind: 'bulk' }, x, y, null, finger);
    else openKind({ kind: 'single', target: { ref, tile } }, x, y, null, finger);
  }

  /** The tile under an event: its enclosing tile, else the host's own answer. */
  const tileOf = (e: MouseEvent): HTMLElement | null => {
    const el = e.target as HTMLElement;
    const hit = el.closest<HTMLElement>(opts.tileSelector);
    if (hit || !opts.tileAt || el.closest('button, input, textarea, select, [contenteditable]')) return hit;
    return opts.tileAt(e.clientX, e.clientY);
  };

  // ── right-click ───────────────────────────────────────────────────────────
  const onContextMenu = (e: MouseEvent): void => {
    // A keyboard-made contextmenu has no pointer type; it leaves the last one standing.
    const kindOf = (e as PointerEvent).pointerType;
    if (kindOf) lastPointer = kindOf;
    const tile = tileOf(e);
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
    openFor(ref, tile, e.clientX, e.clientY, kindOf === 'touch' || kindOf === 'pen');
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
    if (e.pointerType) lastPointer = e.pointerType;
    if (e.button > 0) return;                                   // right button takes the contextmenu path
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    const tile = tileOf(e);
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
      openFor(ref, t, from.x, from.y, true);
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
