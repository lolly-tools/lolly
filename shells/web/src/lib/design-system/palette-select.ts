// SPDX-License-Identifier: MPL-2.0
/**
 * palette-select.ts - the Colours pane's selection model (plan 182 section 5.5).
 *
 * Selection in the palette used to be a MODE: press "Select", tiles collect,
 * one bar deletes them, Escape leaves. Once a system carries a few ramps and a
 * dozen custom colours that is not enough, so selection becomes a gesture -
 * marquee, Shift-range, Cmd-toggle, per-group Select all, arrows - and the bar
 * appears with the first selected tile and leaves with the last.
 *
 * The rules are all HERE, DOM-free, because brand-editor.ts has no test harness
 * of its own: the pane hands over reading order (`order()`, own tiles only) and
 * plain rectangles, and gets back a set. Reading order is the pane's DOM order
 * across every open group, which is what makes a Shift-range span two groups.
 *
 * THE ANCHOR AND THE RANGE BASE are two different things, and keeping them
 * apart is what makes "Cmd-click three, then Shift-click" behave the way a file
 * manager does. `anchor` is where a range starts; `rangeBase` is the selection
 * as it stood before the current range, so a second Shift-click from the same
 * anchor REPLACES the span it drew rather than accumulating one.
 *
 * Nothing here knows about starter/inherited colours: `order()` never lists
 * them, so "Select all" cannot sweep them up by construction rather than by a
 * filter somebody has to remember.
 */

/** A rectangle in whatever coordinate space the caller measures in - client
 *  coordinates, in the pane's case, for both the marquee and the tiles. */
export interface SelectRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** One tile the marquee can touch. A folded group passes none of its tiles,
 *  which is how a folded section stays out of a sweep. */
export interface SelectTile {
  key: string;
  rect: SelectRect;
}

export interface KeyboardOpts {
  /** Shift extends the selection instead of moving the focus alone. */
  shift?: boolean;
  /** Cmd/Ctrl - with `a`, selects every tile the pane owns. */
  meta?: boolean;
  /** Tiles per row in the focused tile's own grid, measured by the caller
   *  (offsetTop equality). Up/Down step by this much through reading order. */
  columns?: number;
}

export interface KeyboardResult {
  /** The tile that should hold focus after the press - unchanged when the key
   *  moved nothing. */
  focus: string | null;
  /** The model consumed the key; the caller preventDefaults on true. */
  handled: boolean;
  /** Escape only: there WAS a selection and it is gone. False means the press
   *  did nothing here, so the studio's own Escape ladder must carry on. */
  cleared: boolean;
}

export interface PaletteSelection {
  /** The selection in reading order. */
  keys(): string[];
  has(key: string): boolean;
  size(): number;
  /** Where the next Shift-range starts, or null. */
  anchor(): string | null;
  /** Replace the selection outright (a plain click, a marquee result). */
  set(keys: Iterable<string>): void;
  /** Cmd/Ctrl-click: add or remove one, and start the next range here. */
  toggle(key: string): void;
  /** Shift-click: the span between two tiles in reading order, over whatever
   *  the selection held before the current range. */
  range(anchorKey: string, key: string): void;
  /** Cmd-A - every tile `order()` lists, which is every OWN tile. */
  all(): void;
  /** A group header's "Select all": add these to the selection. */
  allInGroup(keys: Iterable<string>): void;
  clear(): void;
  /** Every tile the rectangle touches becomes the selection (over `base`, for a
   *  Shift/Cmd-held drag). Returns what it touched, in reading order. */
  marquee(rect: SelectRect, tiles: readonly SelectTile[], base?: Iterable<string>): string[];
  /** Arrows / Shift-arrows / Space / Escape / Cmd-A against a focused tile. */
  keyboard(key: string, focusedKey: string | null, opts?: KeyboardOpts): KeyboardResult;
  /** Drop keys `order()` no longer lists - a repaint after a delete. */
  prune(): void;
  onChange(cb: () => void): () => void;
}

/** Two rectangles genuinely overlap. A degenerate rectangle - the one a plain
 *  click on empty space produces - touches nothing at all, whether or not it
 *  sits inside a tile's box, so a click clears the selection instead of quietly
 *  making one. */
function overlaps(a: SelectRect, b: SelectRect): boolean {
  if (a.right <= a.left || a.bottom <= a.top) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function createSelection(opts: { order: () => string[] }): PaletteSelection {
  const sel = new Set<string>();
  let anchorKey: string | null = null;
  /** The selection before the current range - see the module note. */
  let rangeBase: Set<string> | null = null;
  const subs = new Set<() => void>();

  const notify = (): void => {
    for (const cb of [...subs]) {
      try { cb(); } catch (err) { console.warn('[palette-select] listener failed', err); }
    }
  };
  /** Run a mutation and notify only if the selection actually moved. */
  const change = (fn: () => void): void => {
    const before = [...sel].join('␟');
    fn();
    if ([...sel].join('␟') !== before) notify();
  };
  const snapshot = (): void => { rangeBase = new Set(sel); };
  const orderIndex = (): Map<string, number> => new Map(opts.order().map((k, i) => [k, i]));

  const setKeys = (keys: Iterable<string>): void => {
    sel.clear();
    for (const k of keys) sel.add(k);
  };

  const doRange = (from: string, to: string): void => {
    const idx = orderIndex();
    const a = idx.get(from), b = idx.get(to);
    if (a === undefined || b === undefined) return;
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    const span = opts.order().slice(lo, hi + 1);
    const base = rangeBase ?? new Set(sel);
    setKeys([...base, ...span]);
  };

  const api: PaletteSelection = {
    keys: () => opts.order().filter(k => sel.has(k)),
    has: (key) => sel.has(key),
    size: () => sel.size,
    anchor: () => anchorKey,

    set(keys) {
      change(() => {
        setKeys(keys);
        const list = [...sel];
        anchorKey = list.length ? list[list.length - 1]! : null;
        snapshot();
      });
    },

    toggle(key) {
      change(() => {
        if (sel.has(key)) sel.delete(key); else sel.add(key);
        anchorKey = key;
        snapshot();
      });
    },

    range(from, to) {
      change(() => {
        doRange(from, to);
        anchorKey = from; // the anchor STAYS put, so the next Shift redraws the span
      });
    },

    all() {
      change(() => {
        setKeys(opts.order());
        const list = [...sel];
        anchorKey = list.length ? list[list.length - 1]! : null;
        snapshot();
      });
    },

    allInGroup(keys) {
      change(() => {
        let last: string | null = null;
        for (const k of keys) { sel.add(k); last = k; }
        if (last) anchorKey = last;
        snapshot();
      });
    },

    clear() {
      change(() => { sel.clear(); anchorKey = null; rangeBase = null; });
    },

    marquee(rect, tiles, base) {
      const touched = tiles.filter(tile => overlaps(rect, tile.rect)).map(tile => tile.key);
      change(() => {
        setKeys(base ? [...base, ...touched] : touched);
        snapshot();
        if (!anchorKey || !sel.has(anchorKey)) anchorKey = touched[0] ?? null;
      });
      const idx = orderIndex();
      return [...new Set(touched)].sort((a, b) => (idx.get(a) ?? 0) - (idx.get(b) ?? 0));
    },

    keyboard(key, focusedKey, kopts = {}) {
      const none: KeyboardResult = { focus: focusedKey, handled: false, cleared: false };
      if (key === 'Escape') {
        if (!sel.size) return none;
        api.clear();
        return { focus: focusedKey, handled: true, cleared: true };
      }
      if ((key === 'a' || key === 'A') && kopts.meta) {
        api.all();
        return { focus: focusedKey, handled: true, cleared: false };
      }
      if (key === ' ' || key === 'Spacebar') {
        if (!focusedKey) return none;
        api.toggle(focusedKey);
        return { focus: focusedKey, handled: true, cleared: false };
      }
      const step = key === 'ArrowLeft' ? -1
        : key === 'ArrowRight' ? 1
          : key === 'ArrowUp' ? -Math.max(1, kopts.columns ?? 1)
            : key === 'ArrowDown' ? Math.max(1, kopts.columns ?? 1)
              : 0;
      if (!step) return none;
      const order = opts.order();
      if (!order.length) return none;
      const at = focusedKey ? order.indexOf(focusedKey) : -1;
      // No focus yet: the first press moves focus to an end of the list rather
      // than nowhere, so a keyboard user can enter the grid without a pointer.
      const next = at < 0
        ? (step > 0 ? 0 : order.length - 1)
        : Math.min(order.length - 1, Math.max(0, at + step));
      const focus = order[next]!;
      if (kopts.shift) {
        const from = anchorKey ?? focusedKey ?? focus;
        api.range(from, focus);
      }
      return { focus, handled: true, cleared: false };
    },

    prune() {
      const live = new Set(opts.order());
      change(() => {
        for (const k of [...sel]) if (!live.has(k)) sel.delete(k);
        if (anchorKey && !live.has(anchorKey)) anchorKey = null;
        if (rangeBase) for (const k of [...rangeBase]) if (!live.has(k)) rangeBase.delete(k);
      });
    },

    onChange(cb) {
      subs.add(cb);
      return () => { subs.delete(cb); };
    },
  };
  return api;
}
