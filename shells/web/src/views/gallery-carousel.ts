// SPDX-License-Identifier: MPL-2.0
/**
 * The gallery tile's example strip - its markup and every function over it.
 *
 * A tile's cover is a baked file when the visitor's context matches a bake, and a live
 * render otherwise. Its other looks render lazily, one live render each
 * (views/gallery.ts's preview queue), and only once the person shows interest in that
 * tile (`data-looks-wanted`). So a strip can hold skeleton panes for a while.
 * The strip still has to say what it IS in that window: how many looks are
 * coming, which one you are on, and that it can be stepped. So the nav and the dot
 * row are built from the look COUNT, which the manifest knows before a single
 * render starts, and each dot carries its look's state:
 *
 *   - `data-look-pending`  no render has arrived yet. The dot is dim and small; under
 *                          motion it breathes. It is the progress indicator - there
 *                          is no spinner and no placeholder art.
 *   - `data-failed`        the render (or the image) failed. Cleared of pending, so a
 *                          dead look never breathes forever, and left unclickable
 *                          because that pane will stay empty.
 *   - neither              the look is on screen and the dot is the plain white one.
 *
 * Two rules fall out of that, and both are the point of the file:
 *
 *   1. nothing steps onto a pane that has no art. `advanceCarousel` walks the READY
 *      set only, and a dot click on a pending or failed look is dropped. With fewer
 *      than two ready looks the arrows carry `data-nav-inert` and hold still - the
 *      affordance is visible, it just does not lie about what is behind it.
 *   2. `syncCarState` derives the whole surface from the slides' own classes, so it
 *      is idempotent: call it after a load, after a failure, or on wiring, and the
 *      dots and arrows tell the truth about that instant.
 *
 * `data-look-pending` is also read by lib/capture-neutral.ts: a docs capture waits for
 * the strips to stop being pending before it stamps the frame final, so a baseline
 * is a filled grid rather than a race. Clearing pending only ever removes an
 * attribute, never a node, so the settle loop's "has the DOM stopped growing" test
 * is unaffected.
 *
 * Split out of views/gallery.ts (plans/246) so this behaviour is testable without
 * Vite - `mountGallery` cannot be imported outside it (stylesheet imports), which
 * is why its siblings are all source-scan suites. See gallery-carousel.test.ts.
 */

import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { LOOK_PENDING_ATTR, captureNeutralPinned } from '../lib/capture-neutral.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';

/** Attribute a dot carries while its look has not rendered yet. The capture pin owns
 *  the name (a docs capture waits on it), so the two can never drift apart. */
export const CAR_PENDING_ATTR = LOOK_PENDING_ATTR;
/** Attribute a dot carries once its look's render or image load failed. */
export const CAR_FAILED_ATTR = 'data-failed';
/** Styling hook for an arrow with fewer than two ready examples. */
export const CAR_INERT_ATTR = 'data-nav-inert';

const CHEVRON_LEFT = icon('chevronLeft', { strokeWidth: 2.4 });
const CHEVRON_RIGHT = icon('chevronRight', { strokeWidth: 2.4 });

/**
 * The dot row for a strip of `count` looks - built from the count, so it is in the
 * first paint of the tile. Every dot starts pending; `syncCarState` corrects each dot
 * already showing art (a lead frame) the moment the strip is wired.
 *
 * One look needs no position indicator, so the row is empty below two - matching
 * the arrows, which would have nowhere to go.
 */
export function carouselDotsMarkup(count: number): string {
  if (count < 2) return '';
  const dots = Array.from({ length: count }, (_, k) =>
    `<button class="gcar-dot${k === 0 ? ' is-active' : ''}" type="button" data-i="${k}" ${CAR_PENDING_ATTR} tabindex="-1" aria-label="${esc(t('Example {n}', { n: k + 1 }))}" aria-disabled="true"></button>`).join('');
  return `<div class="gcar-dots">${dots}</div>`;
}

/**
 * The prev/next arrows for a strip of `count` looks. Both start inert: on a cold tile
 * nothing has rendered, so there is nowhere to step yet (the CSS dims an inert arrow
 * and drops its hover state).
 */
export function carouselNavMarkup(count: number): string {
  if (count < 2) return '';
  return `<button class="gcar-nav gcar-prev" type="button" ${CAR_INERT_ATTR} aria-disabled="true" aria-label="${esc(t('Previous example'))}" title="${esc(t('Previous example'))}">${CHEVRON_LEFT}</button>`
    + `<button class="gcar-nav gcar-next" type="button" ${CAR_INERT_ATTR} aria-disabled="true" aria-label="${esc(t('Next example'))}" title="${esc(t('Next example'))}">${CHEVRON_RIGHT}</button>`;
}

/** Is this slide showing real art - a lead frame (real src from the start) or a
 *  look whose image has decoded? */
export function isSlideReady(slide: Element): boolean {
  return slide.classList.contains('gcar-slide--lead') || slide.classList.contains('is-loaded');
}

/** Did this slide's look give up (render threw, or the image failed to load)? */
export function isSlideFailed(slide: Element): boolean {
  return slide.classList.contains('is-failed');
}

/** Child indices of the slides that are actually READY to show. Prev/next cycle
 *  ONLY these, so a strip with several looks still pending never rotates onto a
 *  not-yet-loaded slide's flat skeleton; the set grows as each look decodes. */
export function readyCarIndices(track: HTMLElement): number[] {
  const out: number[] = [];
  const kids = track.children;
  for (let i = 0; i < kids.length; i++) if (isSlideReady(kids[i]!)) out.push(i);
  return out;
}

/** Reflect the centred slide in the dots. */
export function setCarDot(gcar: HTMLElement, idx: number): void {
  gcar.querySelectorAll<HTMLElement>('.gcar-dot').forEach((d, k) => {
    d.classList.toggle('is-active', k === idx);
    d.setAttribute('aria-current', String(k === idx));
  });
  gcar.querySelectorAll<HTMLElement>('.gcar-slide').forEach((slide, k) => { slide.inert = k !== idx; });
}

/**
 * Repaint the dots and the arrows from the slides' own state. Idempotent and the
 * single writer of both, so every caller (a load, a failure, wiring) agrees.
 */
export function syncCarState(gcar: HTMLElement): void {
  const track = gcar.querySelector<HTMLElement>('.gcar-track');
  const slides = track ? [...track.children] : [];
  gcar.querySelectorAll<HTMLElement>('.gcar-dot').forEach((dot, k) => {
    const slide = slides[k];
    const ready = !!slide && isSlideReady(slide);
    const failed = !!slide && isSlideFailed(slide);
    dot.toggleAttribute(CAR_PENDING_ATTR, !ready && !failed);
    dot.toggleAttribute(CAR_FAILED_ATTR, !ready && failed);
    dot.setAttribute('aria-disabled', String(!ready));
  });
  // Fewer than two ready looks ⇒ there is no second pane to step to. The arrows stay
  // in place and report it, rather than vanishing and reappearing as the strip fills.
  const inert = slides.filter(isSlideReady).length < 2;
  gcar.querySelectorAll<HTMLElement>('.gcar-nav').forEach(b => {
    b.toggleAttribute(CAR_INERT_ATTR, inert);
    b.setAttribute('aria-disabled', String(inert));
  });
  if (track) setCarDot(gcar, Math.round(track.scrollLeft / (track.clientWidth || 1)));
}

/** A look arrived: show it, stop the tile's waiting tracer, clear its dot. */
export function markLookReady(gcar: HTMLElement, slide: HTMLElement): void {
  slide.removeAttribute(CAR_PENDING_ATTR);
  slide.removeAttribute('data-preview-label');
  slide.removeAttribute('aria-label');
  slide.classList.remove('is-failed');
  slide.classList.add('is-loaded');
  gcar.classList.add('has-art');
  syncCarState(gcar);
  // An arrow pressed a moment ago, before a second look existed, takes its step now.
  const owed = owedSteps.get(gcar);
  const track = gcar.querySelector<HTMLElement>('.gcar-track');
  if (owed && track && readyCarIndices(track).length > 1) {
    owedSteps.delete(gcar);
    if (performance.now() - owed.at <= OWED_STEP_MS) advanceCarousel(gcar, owed.dir, true);
  }
}

/** Attribute a strip carries once the person has shown interest in its other looks. */
export const CAR_WANTED_ATTR = 'data-looks-wanted';

/** Mark a strip as wanted. True when this call is what marked the strip. */
export function wantLooks(gcar: HTMLElement | null | undefined): boolean {
  if (!gcar || gcar.hasAttribute(CAR_WANTED_ATTR)) return false;
  gcar.setAttribute(CAR_WANTED_ATTR, '');
  return true;
}

/**
 * Interest in a card is the pointer over the card, the focus inside the card, or a press
 * on the card. One set of listeners on the grid outlives each repaint of its cards.
 * `onWanted` runs each time a strip is newly marked. Returns the undo.
 */
export function wireLookInterest(grid: HTMLElement, onWanted: () => void): () => void {
  const interest = (e: Event): void => {
    if (wantLooks((e.target as Element | null)?.closest?.('.gtile')?.querySelector<HTMLElement>('.gcar'))) onWanted();
  };
  const types = ['pointerover', 'focusin', 'pointerdown'] as const;
  for (const type of types) grid.addEventListener(type, interest, { passive: true });
  return () => { for (const type of types) grid.removeEventListener(type, interest); };
}

/**
 * Extra looks are drawn on interest, so a press can land on an arrow before there is a
 * second look to show. The press is kept for a few seconds and the step is taken when
 * that look arrives. A look that takes longer arrives without moving the strip: by then
 * the person has stopped expecting the press to do anything.
 */
const OWED_STEP_MS = 4000;
const owedSteps = new WeakMap<HTMLElement, { dir: number; at: number }>();
function stepOrOwe(gcar: HTMLElement, dir: number): void {
  const track = gcar.querySelector<HTMLElement>('.gcar-track');
  if (track && readyCarIndices(track).length < 2) { owedSteps.set(gcar, { dir, at: performance.now() }); return; }
  advanceCarousel(gcar, dir, true);
}

/** A look will not arrive (render threw, image errored, or the look is gone). The
 *  dot leaves the pending state either way - a dead look must not breathe forever. */
export function markLookFailed(gcar: HTMLElement, slide: HTMLElement): void {
  slide.removeAttribute(CAR_PENDING_ATTR);
  slide.dataset.previewLabel = t('Preview unavailable');
  slide.setAttribute('aria-label', t('Preview unavailable'));
  slide.classList.remove('is-loaded', 'gcar-slide--lead');
  slide.classList.add('is-failed');
  gcar.classList.add('has-art');
  syncCarState(gcar);
}

/**
 * Drop the nav and the dots for good: this strip will never rotate. Two callers -
 * a paged document rebuilt as a static deck, and the perf-ui flag, which skips the
 * live renders altogether. Both are permanent states, so a position indicator for
 * panes that are never coming is worse than none.
 */
export function stripCarouselNav(gcar: HTMLElement): void {
  gcar.querySelectorAll('.gcar-nav, .gcar-dots').forEach(el => { el.remove(); });
}

/** Move to a given slide by index. Smooth native scroll, so touch, trackpad and
 *  this code all agree on the same scroll-snap points. The strip's box is a fixed
 *  square (parts/gallery.css .gcar) and every slide is object-fit:contain, so
 *  nothing here resizes the box. */
export function scrollCarTo(gcar: HTMLElement, idx: number): void {
  const track = gcar.querySelector<HTMLElement>('.gcar-track');
  if (!track?.clientWidth) return;
  track.scrollTo({ left: idx * track.clientWidth, behavior: prefersReducedMotion() || captureNeutralPinned() ? 'instant' : 'smooth' });
  setCarDot(gcar, idx);
}

/** Step the strip by ±1 READY look (wrapping when asked). A no-op while fewer than
 *  two looks have arrived, which is the state the arrows advertise as inert. */
export function advanceCarousel(gcar: HTMLElement, dir: number, wrap: boolean): void {
  const track = gcar.querySelector<HTMLElement>('.gcar-track');
  if (!track?.clientWidth) return;
  const ready = readyCarIndices(track);
  if (ready.length < 2) return;   // 0–1 loaded → nothing to rotate through yet
  const cur = Math.round(track.scrollLeft / track.clientWidth);
  // The centred slide's position within the ready set. If the strip is parked on a
  // slide that hasn't loaded (e.g. a manual dot jump), fall back to the last ready
  // slide at or before it, so the next step still moves to a decoded frame.
  let pos = ready.indexOf(cur);
  if (pos === -1) { pos = 0; for (let k = 0; k < ready.length; k++) if (ready[k]! <= cur) pos = k; }
  let next = pos + dir;
  if (next >= ready.length) next = wrap ? 0 : ready.length - 1;
  if (next < 0) next = wrap ? ready.length - 1 : 0;
  scrollCarTo(gcar, ready[next]!);
}

export function wireCarousel(gcar: HTMLElement): void {
  const track = gcar.querySelector<HTMLElement>('.gcar-track');
  if (!track) return;
  // Delegated nav/dot clicks off the .gcar root, so the paged path can rebuild the
  // dots/arrows (unknown page count) with no re-wiring. A click on a slide link (not a
  // nav/dot) falls through untouched, so it still opens the tool.
  gcar.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('.gcar-prev')) { e.preventDefault(); stepOrOwe(gcar, -1); }
    else if (el.closest('.gcar-next')) { e.preventDefault(); stepOrOwe(gcar, 1); }
    else {
      const dot = el.closest<HTMLElement>('.gcar-dot');
      if (!dot) return;
      e.preventDefault();
      // A dot for a look with no art is inert (the CSS also takes it out of the hit
      // test): jumping there would park the strip on an empty pane.
      if (dot.hasAttribute(CAR_PENDING_ATTR) || dot.hasAttribute(CAR_FAILED_ATTR)) return;
      scrollCarTo(gcar, Number(dot.dataset.i));
    }
  });
  // pointer/wheel/touch = the user; NOT the programmatic scrollTo above (which emits no
  // such event), so auto-advance can't pause itself. Sync the dots on every scroll.
  track.addEventListener('scroll', () => { if (track.clientWidth) setCarDot(gcar, Math.round(track.scrollLeft / track.clientWidth)); }, { passive: true });
  // Correct a swipe only after it settles. A pending pane must not leave the
  // tile blank, and incoming previews must not pull against an active gesture.
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  const settle = (): void => {
    clearTimeout(scrollTimer);
    if (!gcar.isConnected || !track.clientWidth) return;
    const ready = readyCarIndices(track);
    const current = Math.round(track.scrollLeft / track.clientWidth);
    if (!ready.length || ready.includes(current)) return;
    const nearest = ready.reduce((best, i) => Math.abs(i - current) < Math.abs(best - current) ? i : best);
    track.scrollTo({ left: nearest * track.clientWidth, behavior: 'instant' });
    setCarDot(gcar, nearest);
  };
  track.addEventListener('scrollend', settle);
  track.addEventListener('scroll', () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(settle, 180); }, { passive: true });
  // A lead frame ships real art, so the strip can already be part-ready at wiring.
  syncCarState(gcar);
}

/**
 * The example index of the slide currently centred in a carousel, or null when that
 * slide isn't an example (the resume/lead frame, a document page, or an empty strip).
 * Lets a click anywhere on the card open the SAME look the strip is showing right now.
 */
export function activeExampleIndex(gcar: HTMLElement): number | null {
  const track = gcar.querySelector<HTMLElement>('.gcar-track');
  if (!track) return null;
  const centred = track.querySelectorAll<HTMLElement>('.gcar-slide')[Math.round(track.scrollLeft / (track.clientWidth || 1))];
  const raw = centred?.dataset.exIndex;
  return raw === undefined ? null : Number(raw);
}
