// SPDX-License-Identifier: MPL-2.0
/**
 * A click deck as a moving picture, for one export (plans/184 R3).
 *
 * A Design document with artboards and no timeline used to export mp4/webm/gif as the
 * whole stage for the export's duration: slide one, five seconds, then nothing. Nobody
 * clicks in a video, so the slides have to be given times. This stamps the same
 * attributes the Design hook writes for a sequenced deck - `data-t-start`/`data-t-dur`/
 * `data-t-lane` on each `[data-pdf-page]`, `data-sequence`/`data-seq-ms` on the
 * `.lolly-frames` root - onto the LIVE DOM for the length of the export, in the order
 * the pages are laid out (the hook already sorted them by `order`, then x), each for
 * its own dwell (`data-frame-dur`, the presenter's auto-advance length) or the export's
 * duration when it has none. The deck's slide transition rides along as the junction
 * between pages (sequence-plan's applyDeckTransitions). The returned function restores
 * every attribute exactly, so the document itself never changes and nothing is saved.
 *
 * DOM only: no model, no runtime. The export panel owns when this applies (a moving
 * format, two or more pages, no `?s=` single-slide pick, no timeline of the doc's own).
 */

/** The floor on one slide's time, ms - the planner's own minimum clip length. */
const MIN_DWELL_MS = 100;

export interface StageDeckOpts {
  /** What a page with no dwell of its own gets, ms. */
  dwellMs: number;
}

/**
 * Stamp the deck onto a temporary timeline. Null when there is nothing to do: fewer
 * than two untimed pages, or a timeline already present (then the document's own
 * timing is the truth and must not be touched).
 */
export function stageDeckAsSequence(canvas: HTMLElement, o: StageDeckOpts): (() => void) | null {
  if (canvas.querySelector?.('[data-sequence]')) return null;
  const pages = [...canvas.querySelectorAll<HTMLElement>('[data-pdf-page]')].filter((p) => !p.hasAttribute('data-t-start'));
  if (pages.length < 2) return null;
  const root = (pages[0]!.closest?.('.lolly-frames') as HTMLElement | null) ?? pages[0]!.parentElement;
  if (!root) return null;
  const undo: Array<() => void> = [];
  const set = (el: HTMLElement, name: string, value: string): void => {
    const prev = el.getAttribute(name);
    el.setAttribute(name, value);
    undo.push(() => { if (prev == null) el.removeAttribute(name); else el.setAttribute(name, prev); });
  };
  const fallback = Number.isFinite(o.dwellMs) && o.dwellMs > 0 ? o.dwellMs : 5000;
  let t = 0;
  for (const p of pages) {
    const own = Number(p.getAttribute('data-frame-dur'));
    const dur = Math.max(MIN_DWELL_MS, Math.round(own > 0 ? own : fallback));
    set(p, 'data-t-start', String(t));
    set(p, 'data-t-dur', String(dur));
    set(p, 'data-t-lane', 'seq');
    t += dur;
  }
  set(root, 'data-sequence', '');
  set(root, 'data-seq-ms', String(t));
  // Tells the compositor these pages had no authored timeline start (plans/184 R1): a
  // timed box inside one was measured from 0, not from the page's staged start.
  set(root, 'data-deck-staged', '1');
  return () => { for (const u of undo.reverse()) u(); };
}

/** The total a staged deck would run, ms - for a label before the export starts. */
export function stagedDeckMs(canvas: HTMLElement, dwellMs: number): number {
  const fallback = Number.isFinite(dwellMs) && dwellMs > 0 ? dwellMs : 5000;
  let t = 0;
  for (const p of canvas.querySelectorAll<HTMLElement>('[data-pdf-page]')) {
    if (p.hasAttribute('data-t-start')) continue;
    const own = Number(p.getAttribute('data-frame-dur'));
    t += Math.max(MIN_DWELL_MS, Math.round(own > 0 ? own : fallback));
  }
  return t;
}
