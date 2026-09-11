// SPDX-License-Identifier: MPL-2.0
/**
 * How a slide's boxes sit on a clock - the ONE answer the presenter and the video
 * compositor both read (plans/184 R1: Present and Export as video are two renderings of
 * one timeline).
 *
 * A Design slide's boxes appear three ways (motion-model's `appearModeOf`): with the
 * slide, on a click, or at a time. The presenter used to turn those into slide-local
 * starts in its own loop; the compositor photographed the slide as ONE still and never
 * asked, so a box that faded in on stage was simply there in the mp4, and a timed box
 * was wherever the editor's playhead had left it. Both now call this.
 *
 *   • with the slide - start at the slide's start; open-ended, unless it has an Exit
 *     and the slide has a known length, in which case it ends where the slide ends so
 *     the exit plays there (the presenter has no length for a click deck and plays the
 *     exit when the slide leaves instead - `beginExits`).
 *   • at a time      - the authored start, re-measured from the slide's own start.
 *   • on a click     - PARKED (a day ahead) for the podium, which releases it on the
 *     click; SHOWN from the slide's start for a film, which has nobody to click.
 *
 * DOM only. Every attribute it writes is remembered, and `restore()` puts them back
 * byte for byte - the compositor poses the live editor DOM for the length of a render.
 */
import { appearModeOf } from './motion-model.ts';

/** A parked start: so far ahead that the applier reads the box as "not yet" and hides it.
 *  What holds a build fragment back until its click. One day, in ms. */
export const PENDING_MS = 86_400_000;

export interface SlidePoseOpts {
  /** Reduced motion: the moving parts come off, the timing stays. */
  reduced: boolean;
  /** A build step is a click: parked until it comes (podium) or shown from the start (film). */
  clicks: 'park' | 'show';
  /** Where this slide starts on the clock the caller applies - 0 for a slide-local clone,
   *  the page's timeline start for a film. */
  pageStartMs: number;
  /** The page's AUTHORED timeline start, which a timed box's own start was measured against. */
  authoredPageStartMs: number;
  /** The slide's length when it is known, so a box with an Exit can end with it. */
  pageDurMs: number | null;
}

export interface SlidePose {
  /** How many boxes ended up on the clock. Zero: the slide has nothing to animate. */
  posed: number;
  /** The boxes on the clock, in DOM order. */
  boxes: HTMLElement[];
  /** Put every attribute back exactly as it was. */
  restore(): void;
}

const TIMING_ATTRS = [
  'data-t-start', 'data-t-dur',
  'data-t-enter', 'data-t-enter-ms', 'data-t-enter-ease',
  'data-t-exit', 'data-t-exit-ms', 'data-t-exit-ease',
  'data-t-hold', 'data-t-kf', 'data-t-split',
] as const;

const REDUCED_STRIP = ['data-t-enter', 'data-t-exit', 'data-t-hold', 'data-t-kf', 'data-t-split'] as const;

/** The presenter-only Enter/Exit (`data-pr-*`, stamped by the Design hook for a
 *  with-the-slide box) becomes the applier's own `data-t-*`. */
function adoptPresenterMotion(box: Element): void {
  for (const phase of ['enter', 'exit'] as const) {
    const kind = box.getAttribute(`data-pr-${phase}`);
    if (!kind) continue;
    box.setAttribute(`data-t-${phase}`, kind);
    const ms = box.getAttribute(`data-pr-${phase}-ms`);
    if (ms) box.setAttribute(`data-t-${phase}-ms`, ms);
    const ease = box.getAttribute(`data-pr-${phase}-ease`);
    if (ease) box.setAttribute(`data-t-${phase}-ease`, ease);
  }
}

const num = (el: Element, name: string, fallback: number): number => {
  const v = Number(el.getAttribute(name));
  return Number.isFinite(v) ? v : fallback;
};

const hasMotion = (box: Element): boolean =>
  box.hasAttribute('data-t-enter') || box.hasAttribute('data-t-exit')
  || box.hasAttribute('data-t-hold') || box.hasAttribute('data-t-kf');

export function poseSlideBoxes(page: HTMLElement, o: SlidePoseOpts): SlidePose {
  const saved: Array<[HTMLElement, Array<[string, string | null]>]> = [];
  const boxes: HTMLElement[] = [];
  const pageEnd = o.pageDurMs != null && o.pageDurMs > 0 ? o.pageStartMs + o.pageDurMs : null;
  for (const box of page.querySelectorAll<HTMLElement>('.lolly-box')) {
    saved.push([box, TIMING_ATTRS.map((a) => [a, box.getAttribute(a)])]);
    adoptPresenterMotion(box);
    if (o.reduced) for (const a of REDUCED_STRIP) box.removeAttribute(a);
    const mode = appearModeOf({
      build: box.getAttribute('data-build'),
      start: box.getAttribute('data-t-start'),
      lane: box.getAttribute('data-t-lane'),
    });
    /** A box that starts at `start`: open-ended, or ending with the slide when it has an
     *  Exit to play there. A timed box keeps its own authored length. */
    const settle = (start: number, keepDur: boolean): void => {
      box.setAttribute('data-t-start', String(Math.max(0, Math.round(start))));
      boxes.push(box);
      if (keepDur && box.hasAttribute('data-t-dur')) return;
      const exit = box.getAttribute('data-t-exit');
      if (exit && exit !== 'none' && pageEnd != null && pageEnd > start) box.setAttribute('data-t-dur', String(Math.round(pageEnd - start)));
      else box.removeAttribute('data-t-dur');
    };
    if (mode === 'click') {
      if (o.clicks === 'park') {
        box.setAttribute('data-t-start', String(PENDING_MS));
        box.removeAttribute('data-t-dur');   // a revealed fragment stays; a click has no out point
        boxes.push(box);
      } else settle(o.pageStartMs, false);
    } else if (mode === 'time') {
      settle(num(box, 'data-t-start', 0) - o.authoredPageStartMs + o.pageStartMs, true);
    } else if (hasMotion(box)) {
      // Arrives with the slide AND has something to animate. A box with nothing to
      // animate is left exactly as rendered: it is already on screen, and every element
      // the applier is handed is one more it measures every frame and hands back after.
      settle(o.pageStartMs, false);
    }
  }
  return {
    posed: boxes.length,
    boxes,
    restore() {
      for (const [box, attrs] of saved) {
        for (const [name, value] of attrs) {
          if (value == null) box.removeAttribute(name);
          else box.setAttribute(name, value);
        }
      }
    },
  };
}
