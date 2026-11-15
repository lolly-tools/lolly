// SPDX-License-Identifier: MPL-2.0
/**
 * The instrument popup's place and how the music generator's lists move (#/music).
 *
 * The instrument browser (instrument-browser.ts) opens beside what the person clicked:
 * a lane head, or a section in a lane. On a wide screen it is a popup placed next to that
 * origin (to its right where there is room, else to its left, else over it), and it grows
 * out of the click and shrinks back into it when it closes, so it is clear where the
 * choice came from. On a phone it is a sheet that rises from the bottom.
 *
 * The lists (the instrument cards, the genre cards, the Manage rows) come in with the
 * app's entrance cascade (lib/reveal.ts, the gallery's and the utilities' card-in), a
 * little quicker and with no sound over the music. Every motion here is skipped under
 * reduced motion (the system's or Lolly's own, lib/a11y-prefs.ts) and under the
 * performance setting (feature-flags.ts perfUiOn), and the popup then opens and closes
 * at once.
 */
import { prefersReducedMotion } from '../../lib/a11y-prefs.ts';
import { staggerReveal } from '../../lib/reveal.ts';
import { perfUiOn } from '../../feature-flags.ts';

export interface PopupRect { left: number; top: number; right: number; bottom: number }
/** Where a popup came from: the point clicked, and the box around it (a lane head, or a slice of a lane). */
export interface PopupOrigin { x: number; y: number; rect: PopupRect }
export interface PopupPlace {
  left: number;
  top: number;
  /** The origin in the popup's own box, for its transform-origin: it grows from there. */
  originX: number;
  originY: number;
  side: 'right' | 'left' | 'over';
}

/** The gap between the origin and the popup, and the popup's margin from the screen's edges. */
const GAP = 12;
const MARGIN = 16;

/**
 * Place a popup of `size` beside `origin` in a viewport of `view`: to the right of the
 * origin's box where there is room, else to its left, else over the point clicked, kept inside
 * the screen. Its top lines up a little above the origin's top so its heading sits by
 * what was clicked.
 */
export function placePopup(origin: PopupOrigin, size: { width: number; height: number }, view: { width: number; height: number }): PopupPlace {
  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
  let left: number;
  let side: PopupPlace['side'];
  if (origin.rect.right + GAP + size.width <= view.width - MARGIN) { left = origin.rect.right + GAP; side = 'right'; }
  else if (origin.rect.left - GAP - size.width >= MARGIN) { left = origin.rect.left - GAP - size.width; side = 'left'; }
  else { left = clamp(origin.x - size.width / 2, MARGIN, Math.max(MARGIN, view.width - MARGIN - size.width)); side = 'over'; }
  const top = clamp(origin.rect.top - GAP, MARGIN, Math.max(MARGIN, view.height - MARGIN - size.height));
  return { left: Math.round(left), top: Math.round(top), originX: Math.round(origin.x - left), originY: Math.round(origin.y - top), side };
}

/** Whether the studio moves at all: never under reduced motion or the performance setting. */
export const motionOn = (): boolean => !prefersReducedMotion() && !perfUiOn();

/** The quick cascade a list comes in with: the gallery's own, a little faster, with no sound over the music. */
export function cascade(items: Element[]): void {
  if (!items.length || perfUiOn()) return;
  staggerReveal(items, { step: 8, max: 160, sound: false });
}

/**
 * Play a leaving animation by adding `className`, then resolve: on the animation's end, or
 * after `ms` in case none runs (a browser that skips it, a hidden tab). Resolves at once
 * when motion is off.
 */
export function playOut(el: HTMLElement, className: string, ms: number): Promise<void> {
  if (!motionOn()) return Promise.resolve();
  return new Promise((done) => {
    let finished = false;
    const finish = (): void => { if (finished) return; finished = true; el.removeEventListener('animationend', onEnd); clearTimeout(timer); done(); };
    const onEnd = (e: AnimationEvent): void => { if (e.target === el) finish(); };
    const timer = setTimeout(finish, ms);
    el.addEventListener('animationend', onEnd);
    el.classList.add(className);
  });
}

/** The bar runs of one kind of section, as [first, after last]; every bar when `section` is null (the whole lane). */
export function barRuns(sections: readonly string[], section: string | null): Array<[number, number]> {
  if (section === null) return [[0, sections.length]];
  const out: Array<[number, number]> = [];
  sections.forEach((s, i) => {
    if (s !== section) return;
    const last = out[out.length - 1];
    if (last && last[1] === i) last[1] = i + 1; else out.push([i, i + 1]);
  });
  return out;
}

/**
 * Light up, on the timeline behind the popup, what the popup is about: each run of bars
 * washed and outlined in the track's colour, across the track's lane (`top` and `height`).
 */
export function drawPopupFocus(cx: CanvasRenderingContext2D, runs: ReadonlyArray<[number, number]>, xOf: (bar: number) => number, top: number, height: number, colour: string): void {
  cx.save();
  cx.fillStyle = colour;
  cx.strokeStyle = colour;
  cx.lineWidth = 2;
  for (const [a, b] of runs) {
    const x0 = xOf(a), x1 = xOf(b);
    cx.globalAlpha = 0.14;
    cx.fillRect(x0, top, x1 - x0, height);
    cx.globalAlpha = 0.85;
    cx.strokeRect(x0 + 1, top + 1, x1 - x0 - 2, height - 2);
  }
  cx.restore();
}
