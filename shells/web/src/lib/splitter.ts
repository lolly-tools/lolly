// SPDX-License-Identifier: MPL-2.0
/**
 * A column edge a person can drag: the window-splitter pattern, once, for every view
 * that has a resizable side column (plan 275 close-out section 9.1).
 *
 * The grip is a `role="separator"` with a value: the pointer drags it with capture and
 * one write per frame, the keyboard moves it (Left and Right by `step`, with Shift by
 * `bigStep`, Home and End to the limits, Enter back to the default), and a double click
 * restores the default too. The value is the panel's width in CSS pixels, and
 * `aria-valuenow`, `aria-valuemin` and `aria-valuemax` follow it, with the caller's
 * words for it as `aria-valuetext` and the panel it resizes as `aria-controls`.
 *
 * A drag is not the only way with a pointer (WCAG 2.5.7): a click that does not move
 * widens the panel by `bigStep`, and a click at the widest goes back to the narrowest,
 * so one pointer reaches every width. The click waits out the double click, which
 * restores the default instead.
 *
 * The keys the grip uses stop at the grip, and so does an arrow with a modifier the
 * grip does not use, so a view's own shortcuts (moving a slide with Alt and an arrow)
 * never act while a grip has the focus.
 *
 * The helper owns the gesture and the clamp to the limits the caller gives it. The
 * caller owns everything about the layout: `set` applies a wanted width (after a
 * clamp of its own, such as keeping a centre column wide enough) and says what it
 * applied. Persistence is two small helpers over `localStorage`, for a per-viewer
 * chrome preference only: a failed read is an empty record and a failed write is lost.
 *
 * The look is the shared `.resize-grip` (styles/parts/tool.css): an invisible hit strip
 * with a centred pill that shows on hover, on focus and while dragging. The tool
 * sidebar (views/tool/setup.ts) and Design's navigator (views/design-navigator.ts)
 * still carry their own copies of this gesture; moving them onto this helper is a
 * follow-up.
 */

/** The limits a panel's width moves between, and the width a reset goes back to. */
export interface SplitterLimits {
  min: number;
  max: number;
  initial: number;
}

export interface SplitterOptions {
  /** The separator element. The helper sets its role, name, value and tab stop. */
  grip: HTMLElement;
  /**
   * Which side of the grip the panel is on, in reading order: `start` for a panel
   * before the grip (a left column in a left-to-right page), `end` for one after it.
   * The drag and the arrow keys follow the page's direction.
   */
  panel: 'start' | 'end';
  /** The separator's accessible name, such as "Resize the review list". */
  label: string;
  /** The value in words, as `aria-valuetext`, such as "272 pixels wide". */
  valueText?: (px: number) => string;
  /** The panel the grip resizes, named by `aria-controls`. It is given an id when it has none. */
  controls?: HTMLElement;
  /** A hover hint for the pointer ways, as the grip's `title`. */
  hint?: string;
  /** The panel's width now. */
  value: () => number;
  /** The limits now. Read on every move, so a limit may depend on the other columns. */
  limits: () => SplitterLimits;
  /**
   * Apply a wanted width, already inside `limits()`. `done` is false while a drag
   * moves and true when it ends and for each key. Returns the width applied, when the
   * caller clamped further; nothing means `px` was applied as given.
   */
  set: (px: number, done: boolean) => number | undefined;
  /** Enter and a double click. Without it, `set(limits().initial, true)`. */
  reset?: () => void;
  /** Called when a drag starts and when it ends. */
  onDrag?: (dragging: boolean) => void;
  /** Pixels per arrow key. Default 16. */
  step?: number;
  /** Pixels per arrow key with Shift. Default 64. */
  bigStep?: number;
}

export interface SplitterHandle {
  /** Write the value and the limits to the separator's attributes again. */
  sync: () => void;
  /** True while a pointer drag is running. */
  dragging: () => boolean;
  /** Remove the listeners and end a drag in progress. */
  dispose: () => void;
}

export const SPLITTER_STEP = 16;
export const SPLITTER_BIG_STEP = 64;
/** A press that moves less than this, in CSS px, is a click, not a drag. */
export const SPLITTER_CLICK_SLOP = 4;
/** How long a click waits for a second one before it widens the panel, in ms. */
export const SPLITTER_CLICK_WAIT = 300;

/**
 * The width a click moves to: `bigStep` wider, and back to the narrowest from the
 * widest, so repeated clicks reach every width in turn.
 */
export function clickStepWidth(px: number, min: number, max: number, bigStep: number): number {
  const top = Math.max(min, max);
  if (px >= top - 0.5) return min;
  return Math.min(top, px + bigStep);
}

let panelSeq = 0;

/** `px` inside `[min, max]`; a `max` under `min` gives `min`. */
export function clampWidth(px: number, min: number, max: number): number {
  const top = Math.max(min, max);
  if (!Number.isFinite(px)) return min;
  return Math.min(top, Math.max(min, px));
}

/**
 * How a pointer or arrow key moving right changes the panel's width: +1 grows it, -1
 * shrinks it. A panel before the grip grows to the right in a left-to-right page and to
 * the left in a right-to-left one; a panel after the grip does the opposite.
 */
export function growSign(panel: 'start' | 'end', rtl: boolean): 1 | -1 {
  const before = panel === 'start' ? 1 : -1;
  return (rtl ? -before : before) as 1 | -1;
}

function isRtl(el: HTMLElement): boolean {
  try {
    const dir = getComputedStyle(el).direction;
    if (dir === 'rtl' || dir === 'ltr') return dir === 'rtl';
  } catch {
    /* no computed style: fall back to the attribute */
  }
  return el.closest('[dir]')?.getAttribute('dir') === 'rtl';
}

const raf = (fn: () => void): number => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : Number(setTimeout(fn, 16)));
const unraf = (id: number): void => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
};

/** Make `grip` a window splitter for one panel. */
export function mountSplitter(opts: SplitterOptions): SplitterHandle {
  const { grip, panel } = opts;
  const step = opts.step ?? SPLITTER_STEP;
  const bigStep = opts.bigStep ?? SPLITTER_BIG_STEP;
  grip.setAttribute('role', 'separator');
  grip.setAttribute('aria-orientation', 'vertical');
  grip.setAttribute('aria-label', opts.label);
  if (opts.hint) grip.title = opts.hint;
  if (opts.controls) {
    if (!opts.controls.id) opts.controls.id = `splitter-panel-${++panelSeq}`;
    grip.setAttribute('aria-controls', opts.controls.id);
  }
  grip.tabIndex = 0;

  const sync = (): void => {
    const { min, max } = opts.limits();
    const now = Math.round(opts.value());
    grip.setAttribute('aria-valuemin', String(Math.round(min)));
    grip.setAttribute('aria-valuemax', String(Math.round(Math.max(min, max))));
    grip.setAttribute('aria-valuenow', String(now));
    if (opts.valueText) grip.setAttribute('aria-valuetext', opts.valueText(now));
  };

  /** Clamp, apply, and write the value the caller applied. */
  const apply = (px: number, done: boolean): void => {
    const { min, max } = opts.limits();
    opts.set(Math.round(clampWidth(px, min, max)), done);
    sync();
  };

  const reset = (): void => {
    if (opts.reset) opts.reset();
    else opts.set(opts.limits().initial, true);
    sync();
  };

  let drag: { pointerId: number; x0: number; w0: number; sign: 1 | -1; far: boolean } | null = null;
  let want = 0;
  let frame = 0;
  let clickTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelClick = (): void => {
    if (clickTimer !== null) clearTimeout(clickTimer);
    clickTimer = null;
  };

  /** A click that did not move: widen after the double-click wait, unless a second click comes. */
  const clickStep = (): void => {
    cancelClick();
    clickTimer = setTimeout(() => {
      clickTimer = null;
      const { min, max } = opts.limits();
      apply(clickStepWidth(opts.value(), min, max, bigStep), true);
    }, SPLITTER_CLICK_WAIT);
  };

  const end = (commit: boolean): void => {
    if (!drag) return;
    const { pointerId } = drag;
    drag = null;
    if (frame) {
      unraf(frame);
      frame = 0;
    }
    if (commit) apply(want, true);
    try {
      if (grip.hasPointerCapture?.(pointerId)) grip.releasePointerCapture(pointerId);
    } catch {
      /* never captured */
    }
    delete grip.dataset.dragging;
    opts.onDrag?.(false);
  };

  const onDown = (ev: PointerEvent): void => {
    if (ev.button !== 0 || drag) return;
    // A second press is a double click or a drag, never the first click's step.
    cancelClick();
    drag = { pointerId: ev.pointerId, x0: ev.clientX, w0: opts.value(), sign: growSign(panel, isRtl(grip)), far: false };
    want = drag.w0;
    grip.dataset.dragging = 'true';
    try {
      grip.setPointerCapture(ev.pointerId);
    } catch {
      /* no pointer capture (jsdom) */
    }
    opts.onDrag?.(true);
    // No text selection under the drag. Focus stays where it was: a focus moved by
    // script here would draw the keyboard ring on every drag.
    ev.preventDefault();
  };

  const onMove = (ev: PointerEvent): void => {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    // No button held now means the release was lost (an overlay took the capture):
    // finish rather than let a hover keep resizing.
    if (ev.buttons === 0) {
      end(true);
      return;
    }
    if (Math.abs(ev.clientX - drag.x0) >= SPLITTER_CLICK_SLOP) drag.far = true;
    // A press still inside the click's slop is not a resize yet.
    if (!drag.far) return;
    want = drag.w0 + drag.sign * (ev.clientX - drag.x0);
    if (frame) return;
    frame = raf(() => {
      frame = 0;
      if (drag) apply(want, false);
    });
  };

  const onUp = (ev: PointerEvent): void => {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    const click = ev.type === 'pointerup' && !drag.far && Math.abs(ev.clientX - drag.x0) < SPLITTER_CLICK_SLOP;
    if (click) {
      end(false);
      clickStep();
      return;
    }
    // A cancelled pointer has no position worth reading, so it keeps the last move's width.
    if (ev.type === 'pointerup') want = drag.w0 + drag.sign * (ev.clientX - drag.x0);
    end(true);
  };

  const onKey = (ev: KeyboardEvent): void => {
    const arrow = ev.key === 'ArrowRight' || ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' || ev.key === 'ArrowDown';
    if (ev.metaKey || ev.ctrlKey || ev.altKey) {
      // Not a resize, and not the view's either: an arrow chord stops at the grip.
      if (arrow) ev.stopPropagation();
      return;
    }
    const { min, max } = opts.limits();
    let next: number | null = null;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      const dx = (ev.key === 'ArrowRight' ? 1 : -1) * (ev.shiftKey ? bigStep : step);
      next = opts.value() + growSign(panel, isRtl(grip)) * dx;
    } else if (ev.key === 'Home') next = min;
    else if (ev.key === 'End') next = max;
    else if (ev.key === 'Enter') {
      ev.preventDefault();
      ev.stopPropagation();
      reset();
      return;
    }
    if (next === null) return;
    ev.preventDefault();
    ev.stopPropagation();
    apply(next, true);
  };

  const onDouble = (ev: MouseEvent): void => {
    ev.preventDefault();
    cancelClick();
    reset();
  };

  const onLost = (ev: PointerEvent): void => {
    if (drag && ev.pointerId === drag.pointerId) end(true);
  };

  grip.addEventListener('pointerdown', onDown);
  grip.addEventListener('pointermove', onMove);
  grip.addEventListener('pointerup', onUp);
  grip.addEventListener('pointercancel', onUp);
  grip.addEventListener('lostpointercapture', onLost);
  grip.addEventListener('keydown', onKey);
  grip.addEventListener('dblclick', onDouble);
  sync();

  return {
    sync,
    dragging: () => drag !== null,
    dispose: () => {
      cancelClick();
      end(false);
      grip.removeEventListener('pointerdown', onDown);
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onUp);
      grip.removeEventListener('pointercancel', onUp);
      grip.removeEventListener('lostpointercapture', onLost);
      grip.removeEventListener('keydown', onKey);
      grip.removeEventListener('dblclick', onDouble);
    },
  };
}

/**
 * Read a stored record of widths by name, such as `{ queue: 300 }`. Anything that is
 * not a finite positive number is dropped, and a missing, unreadable or blocked store
 * reads as an empty record.
 */
export function readStoredWidths(key: string): Record<string, number> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return {};
  }
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  const out: Record<string, number> = {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return out;
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) out[name] = Math.round(value);
  }
  return out;
}

/** Store a record of widths by name. An empty record removes the key. A blocked store loses the write. */
export function writeStoredWidths(key: string, widths: Record<string, number | undefined>): void {
  const clean: Record<string, number> = {};
  for (const [name, value] of Object.entries(widths)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) clean[name] = Math.round(value);
  }
  try {
    if (Object.keys(clean).length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(clean));
  } catch {
    /* private window or blocked storage: this session only */
  }
}
