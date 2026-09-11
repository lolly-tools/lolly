// SPDX-License-Identifier: MPL-2.0
/**
 * Mobile snap-sheet driver - the tool view's controls sheet (views/tool.ts,
 * where this logic originated verbatim) and the brand studio's palette sheet
 * (views/start.ts) share it. Drives a peek/half/full dock via a CSS height var
 * + a data attribute on `layoutEl` - heights, never transforms, so the sheet
 * can't become a containing block and trap position:fixed descendants.
 *
 * The tool view's hook names and behaviour are the defaults (so its CSS is
 * untouched): anchor 'top' (panel hangs from the top, grip on its BOTTOM edge),
 * `--sheet-h` / `data-sheet` / `--peek-h` / `is-sheet-dragging` /
 * `.sidebar-header`. The studio passes `anchor: 'bottom'` (panel rises from the
 * bottom, grip on its TOP edge - the drag delta and the snap thirds flip) and
 * its own names so two sheets never collide on one page.
 */

// Classify a vertical swipe as a flick. A flick is either fast (high velocity)
// or a long, decisive drag; small/slow moves are taps or jitter. Returns
// 1 (down), -1 (up), or 0 (neither). Shared by the controls sheet and the
// export popup so both surfaces feel the same.
export function flickDirection(dy: number, dt: number): number {
  const FAST = 0.35; // px/ms - a quick flick
  const FAR  = 48;   // px - a slow but decisive drag still counts
  if (Math.abs(dy) < 18) return 0;
  const v = dt > 0 ? Math.abs(dy) / dt : Infinity;
  if (v < FAST && Math.abs(dy) < FAR) return 0;
  return dy > 0 ? 1 : -1;
}

export type SheetState = 'peek' | 'half' | 'full';

/** The CSS hooks the driver writes onto `layoutEl` - parametrised so each
 *  sheet owns its own vocabulary; defaults are the tool view's names. */
export interface SheetNames {
  /** Inline height var set while dragging (per-state values live in CSS). */
  heightVar: string;
  /** Attribute carrying the current snap state. */
  stateAttr: string;
  /** Var carrying the measured peek height. */
  peekVar: string;
  /** Class present while a drag tracks the finger (CSS kills transitions). */
  draggingClass: string;
  /** Selector (within `sidebarEl`) for the header that doubles as a wide drag
   *  handle and whose real height IS the peek height. Optional - without a
   *  match the 56px fallback peek stands. */
  headerSel?: string;
}

export interface MobileSheetOptions {
  /** 'top' = the tool view's controls panel; 'bottom' flips the drag delta
   *  (finger up grows the sheet) and the release-position snap thirds. */
  anchor?: 'top' | 'bottom';
  /** Snap stops, most-collapsed first. */
  states?: readonly SheetState[];
  /** State stamped at mount (attribute only - onChange doesn't fire for it). */
  initial?: SheetState;
  /** Media query gating drags (the sheet only exists on small viewports). */
  mq?: string;
  /** Fires on each drag move (no argument) and each snap (with the state). */
  onChange?: ((state?: SheetState) => void) | null;
  names?: Partial<SheetNames>;
}

export interface MobileSheetHandle {
  /** Re-measure the peek height from the header's live size - call when the
   *  header's content changes or on orientationchange. */
  refresh: () => void;
  state: () => SheetState;
  /** Programmatic snap (fires onChange) - Esc-to-peek, tap-to-tile flows. */
  setState: (s: SheetState) => void;
  teardown: () => void;
}

const DEFAULT_NAMES: SheetNames = {
  heightVar: '--sheet-h',
  stateAttr: 'data-sheet',
  peekVar: '--peek-h',
  draggingClass: 'is-sheet-dragging',
  headerSel: '.sidebar-header',
};

// Drive the panel via the grip on its free edge. Dragging sets an inline
// height var on the layout (the panel height + grip position read it live);
// whatever sits behind is a static backdrop the panel slides over. Releasing
// snaps to the nearest of peek/half/full. A plain tap on the grip steps
// through the stops with a bounce (peek↔half↔full), so half - both the
// panel and the backdrop in view - is always one tap from either extreme.
export function setupMobileSheet(layoutEl: HTMLElement, sidebarEl: HTMLElement, gripEl: HTMLElement, opts: MobileSheetOptions = {}): MobileSheetHandle {
  const names: SheetNames = { ...DEFAULT_NAMES, ...opts.names };
  const anchor = opts.anchor ?? 'top';
  // 'bottom' flips the drag delta: the panel grows as the finger moves UP.
  const dir = anchor === 'bottom' ? -1 : 1;
  const onChange = opts.onChange;
  const SNAPS: readonly SheetState[] = opts.states ?? ['peek', 'half', 'full'];
  const mq = window.matchMedia(opts.mq ?? '(max-width: 640px)');
  let state: SheetState = opts.initial ?? 'half';
  let dragging = false, moved = false, tapMode = false, tapDir = 1, startY = 0, startH = 0;
  const cleanups: Array<() => void> = [];

  // The VISIBLE height, not the layout one: these sheets are full of text
  // inputs, and a soft keyboard shrinks the visual viewport without moving the
  // layout viewport. Measuring the layout height would cap a drag (and place
  // the snap thirds) against space the keyboard covers. Read live, never cached
  // - the keyboard opens and closes under an already-mounted sheet. The thirds
  // below compare it against a getBoundingClientRect Y, so this holds while the
  // visible area starts at the layout top (true whenever a keyboard is up; a
  // pinch-zoom pan is the un-handled case, and drags are already gated to
  // small viewports).
  const vh = () => window.visualViewport?.height ?? window.innerHeight;
  // Peek = the sheet's minimized height, which must equal the real header height
  // so the whole header shows, not just its first row. Measured from headerEl
  // below (it varies - e.g. 44px tap targets on touch); 56 is only the
  // pre-measurement fallback.
  let PEEK = 56;

  function setState(s: SheetState): void {
    state = s;
    layoutEl.style.removeProperty(names.heightVar); // drop any drag override; the per-state var animates in
    layoutEl.setAttribute(names.stateAttr, s);
    onChange?.(s);
  }

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    layoutEl.classList.remove(names.draggingClass);
    // We just dropped `transition: none` (used for 1:1 tracking). Flush layout so
    // the restored height/top transition is live at the CURRENT height before
    // setState changes it - otherwise the class-removal + height change batch into
    // one recalc and the snap jumps instead of animating.
    void sidebarEl.offsetHeight;
    if (!moved) {                                   // a press, not a drag
      if (tapMode) {
        // Tap walks the sheet through its stops with a bounce (peek↔half↔full),
        // reversing at the ends. So half - both the controls AND the backdrop
        // visible - is always one tap from either extreme, and you can always
        // recentre the divider after moving it; the sheet never jumps the full
        // span in a single tap.
        const idx = Math.max(0, SNAPS.indexOf(state));
        if (idx === 0) tapDir = 1;
        else if (idx === SNAPS.length - 1) tapDir = -1;
        setState(SNAPS[idx + tapDir]!);
      } else {
        layoutEl.style.removeProperty(names.heightVar); // header tap: no-op
      }
      return;
    }
    // Positional zones, no velocity: where the divider comes to rest decides the
    // dock. The screen splits into equal thirds and the divider's resting Y picks
    // the stop - release in the third nearest the sheet's anchor → dock collapsed
    // (peek), the far third → dock expanded (full), the MIDDLE third → the 50/50
    // split (half). So a drag to the middle from either extreme always lands on
    // split, and a drag to an edge stays there.
    const rect = sidebarEl.getBoundingClientRect();
    const dividerY = anchor === 'bottom' ? rect.top : rect.bottom; // grip rides the sheet's free edge
    const third = vh() / 3;
    const nearTop    = anchor === 'bottom' ? SNAPS[SNAPS.length - 1]! : SNAPS[0]!;
    const nearBottom = anchor === 'bottom' ? SNAPS[0]! : SNAPS[SNAPS.length - 1]!;
    if (dividerY < third)     return setState(nearTop);
    if (dividerY > third * 2) return setState(nearBottom);
    setState(SNAPS[Math.min(1, SNAPS.length - 1)]!);
  };

  // Turn an element into a drag handle: the sheet follows the finger and snaps on
  // release. `tapToggles` gives the grip its tap-to-toggle; `guard` lets the
  // header ignore presses that land on a real control (links, buttons, inputs).
  function addDragHandle(handleEl: HTMLElement, { tapToggles = false, guard = null }: { tapToggles?: boolean; guard?: ((e: PointerEvent) => boolean) | null } = {}): void {
    const onDown = (e: PointerEvent): void => {
      if (!mq.matches || (guard && !guard(e))) return;
      dragging = true; moved = false; tapMode = tapToggles;
      startY = e.clientY;
      startH = sidebarEl.getBoundingClientRect().height;
      layoutEl.classList.add(names.draggingClass);
      handleEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent): void => {
      if (!dragging) return;
      if (Math.abs(e.clientY - startY) > 4) moved = true;
      const h = Math.min(vh() * 0.92, Math.max(PEEK, startH + dir * (e.clientY - startY))); // never below peek → grip stays visible
      layoutEl.style.setProperty(names.heightVar, h + 'px');
      onChange?.();
    };
    handleEl.addEventListener('pointerdown', onDown);
    handleEl.addEventListener('pointermove', onMove);
    handleEl.addEventListener('pointerup', endDrag);
    handleEl.addEventListener('pointercancel', endDrag);
    cleanups.push(() => {
      handleEl.removeEventListener('pointerdown', onDown);
      handleEl.removeEventListener('pointermove', onMove);
      handleEl.removeEventListener('pointerup', endDrag);
      handleEl.removeEventListener('pointercancel', endDrag);
    });
  }

  // The grip is the obvious handle; the header is the "wide blank area" the panel
  // wanted - grab anywhere on it that isn't an actual control and drag the sheet
  // through its three stops.
  addDragHandle(gripEl, { tapToggles: true });
  const headerEl = names.headerSel ? sidebarEl.querySelector<HTMLElement>(names.headerSel) : null;
  // Drive the peek height from the header's real height so the minimized sheet
  // shows the whole header. The tool view's header is content-based and
  // effectively constant per device, so its one-time measure at mount suffices;
  // the studio's peek strip re-renders with the palette, so it re-measures via
  // the handle's refresh().
  const measurePeek = (): void => {
    if (!headerEl) return;
    const h = Math.ceil(headerEl.getBoundingClientRect().height);
    if (h > 0) { PEEK = h; layoutEl.style.setProperty(names.peekVar, h + 'px'); }
  };
  if (headerEl) {
    addDragHandle(headerEl, {
      guard: e => !(e.target as HTMLElement).closest('a, button, input, select, textarea, label'),
    });
    measurePeek();
  }

  // The body is for scrolling the sheet's content - nothing else. It deliberately
  // has NO drag/flick handler: a touch that lands on the inputs (or the gaps
  // between them) must only ever scroll the list, never resize or dock the sheet.
  // The grip and the header are the sole handles, so scrolling the content can't
  // collapse the sheet out from under you.

  layoutEl.setAttribute(names.stateAttr, state); // define the var; only consumed under the mobile media query

  return {
    refresh: measurePeek,
    state: () => state,
    setState,
    teardown: () => {
      cleanups.forEach(fn => fn());
      layoutEl.classList.remove(names.draggingClass);
      layoutEl.removeAttribute(names.stateAttr);
      layoutEl.style.removeProperty(names.heightVar);
      layoutEl.style.removeProperty(names.peekVar);
    },
  };
}
