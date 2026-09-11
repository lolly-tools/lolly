// SPDX-License-Identifier: MPL-2.0
/**
 * The shared multi-select GESTURES for the tile grids - Projects (#/p) and the
 * Catalogue (#/c). Both grids let you rubber-band a box through the gaps between
 * cards and Shift-click a selection dot to sweep up everything in between, and
 * both do it from this one implementation so they can never drift apart.
 *
 *   • MARQUEE - press in a gap and drag: every selectable tile the box touches is
 *     selected live. A plain drag REPLACES the selection; Shift/Cmd/Ctrl ADDS to
 *     it. A plain click on empty canvas (a press that never became a drag) clears
 *     the selection. Fine-pointer only - touch has the dots.
 *   • SHIFT-RANGE - Shift-clicking a dot selects every tile from the ANCHOR (the
 *     last dot you clicked plainly, or the last tile a marquee caught) through to
 *     that one, inclusive, ADDING them to whatever is already selected. Shift
 *     therefore only ever grows a selection - it never takes one away, so it's
 *     safe to reach for on top of a set you built up with the box.
 *
 * Each view keeps its OWN selection store - Projects a `Map<ref, kind>` (it has to
 * remember whether a ref is a folder / session / image), the Catalogue a plain
 * `Set<id>` of user uploads. Only the gestures live here. The adapter is the whole
 * contract between them: which tiles are selectable, how to read a tile's ref,
 * what's selected right now, and how to reconcile the store to a new set of refs.
 *
 * Everything order-dependent (i.e. what "in between" means) is derived from
 * `tiles()` in DOM order, re-queried per gesture - so a range always spans what
 * the user can actually see, and a grid rebuilt mid-session (a search, a filter,
 * a delete) needs no invalidation here.
 *
 * Wire it ONCE per view mount, against the persistent `viewEl` - both views wipe
 * `viewEl.innerHTML` on every render, so anything bound to the grid inside would
 * be orphaned (and re-wiring per render would reset the anchor under the user's
 * Shift-click). The delegated mousedown + the anchor both outlive a re-render.
 */

/** How the view exposes its grid + selection store to the gestures. */
export interface TileSelectAdapter {
  /**
   * The view's PERSISTENT mount element (`viewEl`) - not the rendered root inside it,
   * which every render() replaces. Owns the delegated mousedown and carries
   * `.is-marqueeing` while a box is being dragged.
   */
  host: HTMLElement;
  /** Every tile these gestures may select, in DOM order. Re-queried on each gesture - never cached. */
  tiles(): HTMLElement[];
  /** A tile's stable ref - `data-ref` in Projects, `data-id` in the Catalogue. */
  refOf(tile: HTMLElement): string;
  /** The refs selected right now (a snapshot; mutating it must not touch the store). */
  current(): Set<string>;
  /**
   * Reconcile the store to EXACTLY these refs, then repaint the affected tiles and
   * sync any bulk bar / select-all in place. Called on every marquee frame, so it
   * must not re-render the grid (that would drop scroll, focus, and the drag).
   */
  setRefs(refs: Set<string>): void;
  /** A plain click on empty canvas while something is selected → drop the selection. */
  clear(): void;
  /** CSS selector a marquee must never START on: tiles, controls, bars, chrome, drop zones. */
  noStart: string;
  /** Opt-in KEYBOARD grid model (plans/132 WP-L + 133 WP-3). Absent = gestures only. */
  keyboard?: TileKeyboardAdapter;
}

/**
 * The keyboard grid model both tile views share: arrows move focus between
 * tiles geometrically (nearest-centre, like the picker's grid nav), Shift+arrow
 * extends the selection range as it moves, Space toggles the focused tile's
 * selection, Cmd/Ctrl+A selects everything on screen, Delete/Backspace routes
 * to the view's (undo-toasted) delete, F2 to its rename, and plain typing
 * jumps to the next tile whose label starts with what was typed. Enter needs
 * no handling - focus rides each tile's own open BUTTON, which activates
 * natively. All of it yields to inputs, dialogs and menus.
 */
export interface TileKeyboardAdapter {
  /** Delete/Backspace over these refs (the selection, or the focused tile). */
  remove?(refs: string[]): void;
  /** F2 on a tile. The element is passed for views whose inline rename swaps tile markup. */
  rename?(ref: string, tile: HTMLElement): void;
  /** Type-ahead label; defaults to the tile's `.tile-title`/full text. */
  labelOf?(tile: HTMLElement): string;
  /** Menu key / Shift+F10 on a tile - open its context menu (plans/133 WP-13). */
  menu?(ref: string, tile: HTMLElement): void;
  /** Cmd/Ctrl+I - "Get info" for the focused tile (or the single selected ref). */
  info?(ref: string): void;
  /** Cmd/Ctrl+X / +C over the selection (or the focused tile); Cmd/Ctrl+V pastes. */
  cut?(refs: string[]): void;
  copy?(refs: string[]): void;
  paste?(): void;
}

/** The handle a view holds onto - it feeds dot clicks in, the gestures do the rest. */
export interface TileSelect {
  /**
   * Handle a click on a tile's selection dot. Shift extends the range from the anchor;
   * a plain click runs the view's own single-tile `toggle` (an in-place repaint) and
   * makes that tile the anchor for the next Shift-click.
   */
  onDotClick(ref: string, shiftKey: boolean, toggle: () => void): void;
  /** Forget the anchor - for a view that clears its selection by some other route. */
  resetAnchor(): void;
  /**
   * Roving tabindex (plans/133 WP-13): ONE Tab stop for the whole grid - the last
   * tile focused (else the first), arrows walk the rest. Call after every
   * render() that rebuilds the tiles; a no-op without the keyboard adapter.
   */
  syncRoving(): void;
  /**
   * Unbind everything. MANDATORY on view teardown (`viewEl._cleanup`): the host is the
   * router's single, PERSISTENT `#view` element - it is never recreated, only emptied
   * (`replaceChildren()`) - so a mousedown left bound here would stack another copy on
   * every navigation, each one closing over a dead view's selection store and render().
   * Also drops any in-flight drag (its document listeners + the box).
   */
  destroy(): void;
}

/** Travel (px) before a press counts as a drag rather than a click. */
const DRAG_SLOP = 5;

/** Both grids mark a tile's selection dot with `data-select` - the shared convention. */
const DOT = '[data-select]';

export function wireTileSelect(a: TileSelectAdapter): TileSelect {
  // The origin of a Shift-range: the last dot clicked plainly, or the last tile a
  // marquee box caught. Null until the user selects something (a Shift-click with no
  // anchor is just a plain click).
  let anchor: string | null = null;

  /**
   * The selectable tiles that are actually ON SCREEN, in DOM order - the seam BOTH gestures
   * derive from (the marquee's hit test and the Shift-range's ordering).
   *
   * A view's tiles() can legitimately hand back tiles the user cannot see: the Catalogue
   * keeps a collapsed group's cards in the DOM and hides them with `display: none`. Those
   * measure {0,0,0,0} - and a zero rect at the viewport origin PASSES the overlap test for
   * any box dragged out to the top-left corner, which would silently select every card in a
   * folded-up section and arm a bulk Delete over cards that are nowhere on screen. Dropping
   * zero-area tiles here kills that at the source, for both gestures and both views at once.
   */
  // Measured once per call and handed back WITH the rects: the marquee needs both on every
  // frame, and reading them twice would mean a second forced layout per tile per frame.
  const liveTiles = (): Array<{ tile: HTMLElement; r: DOMRect }> => {
    const out: Array<{ tile: HTMLElement; r: DOMRect }> = [];
    for (const tile of a.tiles()) {
      const r = tile.getBoundingClientRect();
      if (r.right - r.left > 0 && r.bottom - r.top > 0) out.push({ tile, r });
    }
    return out;
  };

  const orderedRefs = (): string[] => liveTiles().map(({ tile }) => a.refOf(tile));

  /** Select every tile from the anchor through `ref`, inclusive, on TOP of the current selection. */
  function extendTo(ref: string): void {
    const order = orderedRefs();
    const to = order.indexOf(ref);
    if (to < 0) return;                       // the clicked tile isn't selectable (shouldn't happen)
    const from = anchor === null ? -1 : order.indexOf(anchor);
    // The anchor is gone - deleted, or filtered out by a search since it was set. There's no
    // range to span, so treat this as a plain add and re-anchor here, giving the NEXT
    // Shift-click something live to reach back to.
    if (from < 0) {
      a.setRefs(new Set([...a.current(), ref]));
      anchor = ref;
      return;
    }
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    a.setRefs(new Set([...a.current(), ...order.slice(lo, hi + 1)]));
    // The anchor deliberately STAYS put, so a second Shift-click re-reaches from the same
    // origin rather than walking the range along behind the cursor.
  }

  // ── the rubber-band box ─────────────────────────────────────────────────────
  // Fine pointers only: on touch a drag is a scroll, and the dots are the affordance.
  const fine = !!window.matchMedia?.('(pointer: fine)').matches;
  // Everything this instance bound, so destroy() can put it all back (see TileSelect.destroy).
  let releaseHost: (() => void) | null = null;
  let endDrag: (() => void) | null = null;

  if (fine) {
    let sx = 0, sy = 0;
    let box: HTMLDivElement | null = null;
    let base = new Set<string>();
    let additive = false, active = false;

    function onMove(e: MouseEvent): void {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!box) {
        if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;   // micro-jitter - still a click
        box = document.createElement('div');
        box.className = 'tile-marquee';
        document.body.appendChild(box);
        a.host.classList.add('is-marqueeing');
      }
      e.preventDefault();
      const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
      const w = Math.abs(dx), h = Math.abs(dy);
      box.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${w}px;height:${h}px;`;
      // Viewport coords throughout (clientX/Y + getBoundingClientRect), so the hit test stays
      // honest wherever the page is scrolled to.
      const next = additive ? new Set(base) : new Set<string>();
      for (const { tile, r } of liveTiles()) {
        const miss = r.right < x || r.left > x + w || r.bottom < y || r.top > y + h;
        if (!miss) next.add(a.refOf(tile));
      }
      a.setRefs(next);
    }

    // Drop a live drag WITHOUT applying it: unbind everything the drag bound and bin the box.
    // Called at the end of a normal drag, by cancelDrag(), and by destroy() if the user
    // navigates away mid-drag - which would otherwise leak the drag's listeners and orphan
    // the box in document.body (it lives there, not in the view, so the router's
    // replaceChildren() could never reach it).
    endDrag = (): void => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', cancelDrag);
      if (box) { box.remove(); box = null; }
      a.host.classList.remove('is-marqueeing');
      active = false;
      base = new Set();
    };

    // Abandon a live drag and put the selection back exactly as it was when the press began.
    // Two ways in:
    //   • Escape - every other overlay in this app backs out on Escape; a marquee you can see
    //     is sweeping up the wrong cards should too, rather than forcing you to complete it.
    //   • Window blur - Alt/Cmd-Tab away mid-drag and no mouseup is ever delivered, so without
    //     this the box would stay painted at z-index 8000 and `.is-marqueeing` would keep
    //     user-select dead across the view, with the next stray click committing a stale box.
    function cancelDrag(): void {
      if (!active) return;
      const restore = base;          // capture: endDrag() resets it
      const drawn = !!box;
      endDrag!();
      if (drawn) a.setRefs(restore); // undo whatever the box selected on its way out
    }

    function onKey(e: KeyboardEvent): void {
      if (e.key !== 'Escape' || !active) return;
      e.preventDefault();
      e.stopPropagation();           // don't also trip a view's Escape (close menu / clear search)
      cancelDrag();
    }

    function onUp(): void {
      const dragged = !!box;
      endDrag!();
      if (dragged) {
        // The box just defined the selection, so it also defines where the next Shift-range
        // starts: the LAST tile it caught, in DOM order. Shift-clicking a later dot then
        // grows the selection on from where the box stopped, which is what you'd expect.
        const sel = a.current();
        const caught = orderedRefs().filter(r => sel.has(r));
        anchor = caught.length ? caught[caught.length - 1]! : null;
      } else if (!additive && a.current().size) {
        a.clear();          // a press on empty canvas that never moved → deselect everything
        anchor = null;
      }
    }

    const onDown = (e: MouseEvent): void => {
      if (e.button !== 0) return;
      const el = e.target as HTMLElement;
      // A Shift-click on a dot (or on the tile itself, WP-13) extends the range - stop
      // the browser ALSO dragging a text selection across the cards on its way there.
      // Shift-extend-selection is a MOUSEDOWN behaviour, so suppressing it on the click
      // would already be too late.
      if (e.shiftKey && (el.closest(DOT) || a.tiles().some(t => t.contains(el)))) { e.preventDefault(); return; }
      if (active) return;
      // Only ever start a box in a genuine gap - never on a card, control, bar, or drop zone.
      if (el.closest(a.noStart)) return;
      active = true;
      sx = e.clientX; sy = e.clientY;
      additive = e.shiftKey || e.metaKey || e.ctrlKey;
      base = a.current();
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup', onUp, true);
      document.addEventListener('keydown', onKey, true);   // Escape backs the drag out
      window.addEventListener('blur', cancelDrag);         // Alt-Tab away → no mouseup ever comes
    };

    a.host.addEventListener('mousedown', onDown);
    releaseHost = () => a.host.removeEventListener('mousedown', onDown);
  }

  // ── keyboard grid (opt-in; plans/132 WP-L + 133 WP-3) ───────────────────────
  let releaseKeys: (() => void) | null = null;
  let syncRoving: (() => void) | null = null;
  if (a.keyboard) {
    const kb = a.keyboard;
    let typeahead = '';
    let typeaheadTimer: ReturnType<typeof setTimeout> | undefined;

    const inField = (el: Element | null): boolean =>
      !!el && (el.matches('input, textarea, select, [contenteditable="true"], [contenteditable=""]') || !!el.closest('[contenteditable="true"]'));
    const uiOpen = (): boolean =>
      !!document.querySelector('dialog[open], .folder-menu, [role="menu"], [role="listbox"], .ctx-menu');

    /** The tile that currently owns focus, if any. */
    const focusedTile = (): HTMLElement | null => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || !a.host.contains(el)) return null;
      return a.tiles().find(t2 => t2.contains(el)) ?? null;
    };
    /** Where focus lands on a tile: its primary open control - a button, or the
     *  `<a href>` cover projects tiles wear (WP-13) - so Enter opens natively. */
    const focusOf = (tile: HTMLElement): HTMLElement =>
      tile.querySelector<HTMLElement>('.tile-primary, .cat-tile-open') ?? tile.querySelector<HTMLElement>('button, a[href]') ?? tile;

    // Roving tabindex: the one tile that is the grid's Tab stop. Remembered by
    // ref (tiles are rebuilt each render) and refreshed by syncRoving(). The
    // focusin listener is installed by the FIRST syncRoving() call, so a view
    // that never opts in (the Catalogue) keeps its natural Tab order intact.
    let rovingRef: string | null = null;
    let rovingBound = false;
    const applyRoving = (tiles: HTMLElement[]): void => {
      for (const t2 of tiles) {
        const on = a.refOf(t2) === rovingRef;
        focusOf(t2).tabIndex = on ? 0 : -1;
        // The dot + kebab of the ONE focused tile stay reachable by Tab (there is no
        // Menu key on Apple keyboards); every other tile's are skipped.
        for (const ctl of t2.querySelectorAll<HTMLElement>('[data-select], .tile-menu-btn')) ctl.tabIndex = on ? 0 : -1;
      }
    };
    const onFocusIn = (e: FocusEvent): void => {
      const tiles = a.tiles();
      const tile = tiles.find(t2 => t2.contains(e.target as Node));
      if (!tile) return;
      const ref = a.refOf(tile);
      if (ref === rovingRef) return;
      rovingRef = ref;
      applyRoving(tiles);
    };
    syncRoving = (): void => {
      if (!rovingBound) { a.host.addEventListener('focusin', onFocusIn); rovingBound = true; }
      const tiles = a.tiles();
      if (!tiles.length) return;
      if (rovingRef === null || !tiles.some(t2 => a.refOf(t2) === rovingRef)) rovingRef = a.refOf(tiles[0]!);
      applyRoving(tiles);
    };

    const labelOf = (tile: HTMLElement): string =>
      (kb.labelOf?.(tile) ?? tile.querySelector('.tile-title, .cat-tile-name')?.textContent ?? tile.textContent ?? '').trim().toLowerCase();

    /** Geometric arrow move - nearest tile centre in the pressed direction. */
    function arrowTarget(from: DOMRect, dir: string, tiles: Array<{ tile: HTMLElement; r: DOMRect }>): HTMLElement | null {
      const cx = (from.left + from.right) / 2, cy = (from.top + from.bottom) / 2;
      let best: HTMLElement | null = null;
      let bestScore = Infinity;
      for (const { tile, r } of tiles) {
        const tx = (r.left + r.right) / 2, ty = (r.top + r.bottom) / 2;
        const dx = tx - cx, dy = ty - cy;
        const ahead = dir === 'ArrowRight' ? dx > 1 : dir === 'ArrowLeft' ? dx < -1 : dir === 'ArrowDown' ? dy > 1 : dy < -1;
        if (!ahead) continue;
        // Distance along the axis dominates; cross-axis drift is a tie-breaker,
        // so Down lands on the tile below, not the nearest diagonal neighbour.
        const score = dir === 'ArrowLeft' || dir === 'ArrowRight'
          ? Math.abs(dx) + Math.abs(dy) * 3
          : Math.abs(dy) + Math.abs(dx) * 3;
        if (score < bestScore) { bestScore = score; best = tile; }
      }
      return best;
    }

    const toggleRef = (ref: string): void => {
      const next = new Set(a.current());
      if (next.has(ref)) next.delete(ref); else next.add(ref);
      a.setRefs(next);
      anchor = ref;
    };

    const onKeydown = (e: KeyboardEvent): void => {
      if (inField(document.activeElement) || uiOpen()) return;
      // Select all: works from anywhere on the view (not just tile focus).
      if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
        const all = orderedRefs();
        if (!all.length) return;
        e.preventDefault();
        a.setRefs(new Set(all));
        anchor = all[all.length - 1]!;
        return;
      }
      /** The selection, else the focused tile - what Delete / Cut / Copy act on. */
      const actRefs = (): string[] => {
        const sel = [...a.current()];
        const focused = focusedTile();
        return sel.length ? sel : (focused ? [a.refOf(focused)] : []);
      };
      if ((e.key === 'Delete' || e.key === 'Backspace') && kb.remove) {
        const refs = actRefs();
        if (!refs.length) return;
        e.preventDefault();
        kb.remove(refs);
        return;
      }
      // Clipboard + info (plans/133 WP-7 / WP-13). Cmd/Ctrl+V is offered whenever
      // the view has a paste hook - it decides whether its clipboard holds anything.
      if (e.metaKey || e.ctrlKey) {
        const k = e.key.toLowerCase();
        if (k === 'v' && kb.paste) { e.preventDefault(); kb.paste(); return; }
        if ((k === 'x' && kb.cut) || (k === 'c' && kb.copy)) {
          const refs = actRefs();
          if (!refs.length) return;
          e.preventDefault();
          (k === 'x' ? kb.cut! : kb.copy!)(refs);
          return;
        }
        if (k === 'i' && kb.info) {
          const refs = actRefs();
          if (refs.length !== 1) return;
          e.preventDefault();
          kb.info(refs[0]!);
          return;
        }
      }
      const tile = focusedTile();
      if (!tile) return;
      const ref = a.refOf(tile);
      if ((e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) && kb.menu) {
        e.preventDefault();
        kb.menu(ref, tile);
        return;
      }
      if (e.key.startsWith('Arrow')) {
        const target = arrowTarget(tile.getBoundingClientRect(), e.key, liveTiles().filter(t2 => t2.tile !== tile));
        if (!target) return;
        e.preventDefault();
        focusOf(target).focus();
        target.scrollIntoView?.({ block: 'nearest' });
        if (e.shiftKey) extendTo(a.refOf(target));   // range grows as focus walks
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();       // Space would otherwise ACTIVATE the open button
        toggleRef(ref);
        return;
      }
      if (e.key === 'F2' && kb.rename) {
        e.preventDefault();
        kb.rename(ref, tile);
        return;
      }
      // Type-ahead: printable characters accumulate briefly and jump to the
      // first on-screen tile whose label starts with the buffer.
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && /\S/.test(e.key)) {
        typeahead += e.key.toLowerCase();
        clearTimeout(typeaheadTimer);
        typeaheadTimer = setTimeout(() => { typeahead = ''; }, 600);
        const hit = liveTiles().find(t2 => labelOf(t2.tile).startsWith(typeahead));
        if (hit) { e.preventDefault(); focusOf(hit.tile).focus(); hit.tile.scrollIntoView?.({ block: 'nearest' }); }
      }
    };

    document.addEventListener('keydown', onKeydown);
    releaseKeys = () => { document.removeEventListener('keydown', onKeydown); a.host.removeEventListener('focusin', onFocusIn); clearTimeout(typeaheadTimer); };
  }

  return {
    onDotClick(ref, shiftKey, toggle): void {
      if (shiftKey && anchor !== null) { extendTo(ref); return; }
      toggle();
      anchor = ref;
    },
    resetAnchor(): void { anchor = null; },
    syncRoving(): void { syncRoving?.(); },
    destroy(): void {
      endDrag?.();
      releaseHost?.();
      releaseKeys?.();
      releaseKeys = null;
      releaseHost = null;
      endDrag = null;
      anchor = null;
    },
  };
}
