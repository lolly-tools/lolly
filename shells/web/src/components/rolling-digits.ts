// SPDX-License-Identifier: MPL-2.0
/**
 * Rolling digits: a readout whose figures roll to the next value, like a counter,
 * when it changes in a step (a zoom stop, a preset size). Chrome only: never mount
 * one inside the tool canvas or an export stage, which are the user's output.
 *
 * The element keeps its real text. A visually hidden `.rd-text` holds the value as
 * plain text, so screen readers, `textContent`, find-in-page and copy all read the
 * one true value, and a live region on the host (if it has one) announces it once.
 * The rolling glyphs beside it are `aria-hidden` and carry no text node at all:
 * each column draws its digits from a CSS `content` strip (parts/rolling-digits.css)
 * and moves it with a transform, so nothing here adds text a reader could find.
 *
 * Three rules keep it calm:
 *   - reduced motion (the OS setting or the app's own pref) sets every value at once;
 *   - values arriving faster than a roll (a pinch, a scrub) are set at once too,
 *     since a figure that never stops rolling reads as noise, not as a step;
 *   - figures are tabular, so a column never changes width and the readout never
 *     nudges the label next to the readout.
 *
 * Columns are matched from the right, so only a new leading figure (99% to 100%)
 * adds an element. Every other update is a custom property on an existing element
 * plus the hidden text node's data, which keeps it cheap enough to run every frame (see lib/steady-dom.ts
 * for why a tree change on this path costs more than it looks).
 */
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { setText } from '../lib/steady-dom.ts';

/** A value arriving within this many ms of the last is set without rolling. */
export const ROLL_QUIET_MS = 140;

/** Each column's strip holds 0-9 three times; a resting digit sits in the middle set. */
const MID = 10;

export interface RollingDigits {
  /** Show `text`. Digits roll when the change is a step; everything else is set. */
  set(text: string): void;
  /** The value shown now. */
  readonly text: string;
}

interface Column {
  el: HTMLElement;
  /** The digit shown, or the literal character for a fixed glyph. */
  ch: string;
  /** Strip position (digits only), 0-29; MID + digit at rest. */
  pos: number;
}

const isDigit = (c: string): boolean => c >= '0' && c <= '9';

/** The numeric value of a readout ("1,250%" is 1250), or NaN. */
export function readoutNumber(text: string): number {
  const m = /-?\d[\d,]*(?:\.\d+)?/.exec(text.replace(/−/g, '-'));
  return m ? parseFloat(m[0].replace(/,/g, '')) : NaN;
}

/**
 * The strip position a digit column moves to. `dir` is the way the whole number
 * moved: up rolls each digit upward through 9 to 0, down the other way, so a
 * counter going from 199 to 200 turns its tens and units over the top.
 */
export function nextPosition(pos: number, from: number, to: number, dir: number): number {
  if (from === to) return pos;
  const up = (to - from + 10) % 10;
  const down = (from - to + 10) % 10;
  const delta = dir > 0 ? up : dir < 0 ? -down : (up <= down ? up : -down);
  return pos + delta;
}

/**
 * Take over the content of `host` and show `initial` there. The host keeps its own
 * classes, attributes and size; only its children change.
 */
export function mountRollingDigits(host: HTMLElement, initial = host.textContent ?? ''): RollingDigits {
  const doc = host.ownerDocument;
  host.classList.add('rd');
  const real = doc.createElement('span');
  real.className = 'rd-text visually-hidden';
  const roll = doc.createElement('span');
  roll.className = 'rd-roll';
  roll.setAttribute('aria-hidden', 'true');
  host.replaceChildren(real, roll);

  let text = '';
  let cols: Column[] = [];
  let lastSet = -Infinity;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  const place = (c: Column, pos: number, instant: boolean): void => {
    c.pos = pos;
    c.el.classList.toggle('rd-col--instant', instant);
    c.el.style.setProperty('--rd-pos', String(pos));
  };

  /** Bring every rolled column back to the middle set, without motion. */
  const settle = (): void => {
    settleTimer = null;
    for (const c of cols) {
      if (!isDigit(c.ch)) continue;
      const rest = MID + Number(c.ch);
      if (c.pos !== rest) place(c, rest, true);
    }
  };

  const column = (ch: string): Column => {
    const el = doc.createElement('span');
    if (!isDigit(ch)) {
      el.className = 'rd-ch';
      el.dataset.ch = ch;
      return { el, ch, pos: 0 };
    }
    el.className = 'rd-col';
    const c: Column = { el, ch, pos: 0 };
    place(c, MID + Number(ch), true);
    return c;
  };

  /**
   * Match the new text's characters to the columns already shown, from the right
   * (figures line up by their units), and make a column for anything new. Returns
   * the columns that stay, so only they roll.
   */
  const reconcile = (chars: string[]): Set<Column> => {
    const kept = new Set<Column>();
    const next: Column[] = [];
    for (let i = chars.length - 1, j = cols.length - 1; i >= 0; i--, j--) {
      const ch = chars[i]!;
      const old = j >= 0 ? cols[j] : undefined;
      if (old && (isDigit(ch) ? isDigit(old.ch) : old.ch === ch)) { next[i] = old; kept.add(old); }
      else next[i] = column(ch);
    }
    const same = next.length === cols.length && next.every((c, i) => c === cols[i]);
    cols = next;
    if (!same) roll.replaceChildren(...cols.map(c => c.el));
    return kept;
  };

  const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const apply = (next: string, instant: boolean): void => {
    const dir = Math.sign(readoutNumber(next) - readoutNumber(text)) || 0;
    setText(real, next);
    const chars = [...next];
    const kept = reconcile(chars);
    let rolled = false;
    chars.forEach((ch, i) => {
      const c = cols[i]!;
      if (!isDigit(ch) || !kept.has(c)) return;
      const from = Number(c.ch);
      const to = Number(ch);
      c.ch = ch;
      if (from === to) return;
      if (instant) { place(c, MID + to, true); return; }
      let pos = nextPosition(c.pos, from, to, dir);
      // Rolled off either end of the strip (several steps before a settle): restart
      // from the middle set first, then roll.
      if (pos < 0 || pos > 29) {
        place(c, MID + from, true);
        void c.el.offsetWidth; // commit the jump before the roll starts
        pos = nextPosition(MID + from, from, to, dir);
      }
      place(c, pos, false);
      rolled = true;
    });
    if (rolled) {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 450);
    }
    text = next;
  };

  const set = (next: string): void => {
    if (next === text) return;
    const t = now();
    const quick = t - lastSet < ROLL_QUIET_MS;
    lastSet = t;
    apply(next, quick || prefersReducedMotion());
  };

  apply(initial, true);
  return {
    set,
    get text() { return text; },
  };
}

