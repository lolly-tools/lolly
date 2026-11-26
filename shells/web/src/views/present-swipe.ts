// SPDX-License-Identifier: MPL-2.0
/**
 * Touch swiping between slides in present mode.
 *
 * The idea is Detent's Stories pager: the slide follows the finger, and the release
 * decides from where the finger was going, not only where it stopped. The physics (a
 * release-velocity estimate, the coast projection and the rubber band at the ends) is
 * the shared Detent port in lib/detent-physics.ts, imported rather than copied.
 *
 * A swipe is one more way to press Next or Back. It calls the same step an edge tap
 * calls, so builds, focused web pages, blackout and the deck's own transitions behave
 * exactly as they do for a tap, a key or a clicker.
 *
 * What the finger may move is the AUTHORED transition between the two slides, and only
 * when that transition can be scrubbed: `slide` (the push and fade in present.css) and
 * `fade` follow the finger, and release finishes or reverses them from where the finger
 * left them. `none` (a cut), `morph` and `flight` have no in-between a finger could hold,
 * so the deck stays still while the finger moves and, if the release commits, plays the
 * authored transition in full. Reduced motion never follows: a swipe still changes the
 * slide, on release, with the deck's reduced transition.
 *
 * Who owns a touch is decided once, when it starts, and again when it picks an axis:
 * only a touch pointer, one finger, on the deck (or on the speaker view's Current
 * slide), not on a control, a web page box, an interactive box, a scroller or anything
 * that declares its own touch handling, with the page not zoomed in and no text
 * selected; then it must travel sideways first, with no long press beforehand. Every
 * other touch is left entirely to the browser and the slide.
 */
import { project, rubberband, velocityTracker } from '../lib/detent-physics.ts';
import type { NavDir } from './present-math.ts';

/** How far a finger moves before the gesture picks an axis, in CSS pixels. */
export const SWIPE_SLOP_PX = 10;
/** A finger that rests this long before it moves is a long press: text selection or a
 *  context menu, never a swipe. */
export const SWIPE_LONG_PRESS_MS = 450;
/** Sideways travel must beat vertical travel by this ratio (about 40 degrees). */
export const SWIPE_AXIS_RATIO = 1.2;
/** A release commits when the finger, coasting on, would land past this share of the
 *  stage width. */
export const SWIPE_COMMIT_SHARE = 0.3;
/** A flick shorter than this never commits, however fast. */
export const SWIPE_MIN_PX = 24;
/** The coast a release is projected with: iOS's per-millisecond retention, Detent's
 *  default (a time constant of about half a second). */
export const SWIPE_DECAY = 0.998;
/** How far the `slide` transition pushes a page: present.css puts `pr-past` at -12vw and
 *  `pr-future` at 12vw. present-swipe.test.ts reads the stylesheet so the two agree. */
export const SLIDE_TRAVEL_VW = 12;
/** The rubber band's constant at the ends of a deck that does not loop (iOS uses 0.55). */
const RUBBER_BAND = 0.55;
/** The shortest settle after a release, so a near-finished move still reads as one. */
const MIN_SETTLE_MS = 120;
/** A click that arrives this soon after a swipe belongs to the swipe, not to a tap. */
const CLICK_AFTER_SWIPE_MS = 600;

/** What a swipe in one direction would do: the slide it reaches and the transition it
 *  plays, `'end'` at the end of a deck that does not loop, or null when the step is not a
 *  slide change (a build, a focused page, a held or already-leaving deck). */
export type SwipePlan = { index: number; kind: string; dir: NavDir } | 'end' | null;

export interface PresentSwipeConfig {
  stage: HTMLElement;
  pages: readonly HTMLElement[];
  reduced: boolean;
  /** False while a swipe must do nothing: the overview, a production output, a closed deck. */
  enabled(): boolean;
  /** The slide on screen now. */
  index(): number;
  plan(direction: 1 | -1): SwipePlan;
  /** One step forward (1) or back (-1): the edge tap's own step. */
  step(direction: 1 | -1): void;
}

export interface PresentSwipeController { destroy(): void }

export interface PagePose { tx: number; ty: number; op: number }

/** The two transitions a finger can hold. */
export function followsFinger(kind: string): kind is 'slide' | 'fade' {
  return kind === 'slide' || kind === 'fade';
}

/** Which axis a touch has chosen, or null while it is still inside the slop. */
export function swipeAxis(dx: number, dy: number): 'x' | 'y' | null {
  if (Math.hypot(dx, dy) < SWIPE_SLOP_PX) return null;
  return Math.abs(dx) > Math.abs(dy) * SWIPE_AXIS_RATIO ? 'x' : 'y';
}

/** Does a release at `dx` moving at `velocity` (px per ms) change the slide? */
export function swipeCommits(dx: number, velocity: number, width: number): boolean {
  if (!(width > 0) || Math.abs(dx) < SWIPE_MIN_PX) return false;
  const landing = project(dx, velocity, SWIPE_DECAY);
  return Math.sign(landing) === Math.sign(dx) && Math.abs(landing) >= width * SWIPE_COMMIT_SHARE;
}

/**
 * The authored transition at `progress` (0 at rest, 1 arrived): where the leaving and the
 * arriving page sit. `direction` 1 is Next, which leaves the way `pr-past` goes; -1 is Back.
 * Both properties move in step with the finger; the authored easing belongs to the time
 * the release hands back to the stylesheet.
 */
export function followPoses(kind: 'slide' | 'fade', progress: number, travelPx: number, direction: 1 | -1): { leaving: PagePose; arriving: PagePose } {
  const p = Math.max(0, Math.min(1, progress));
  const push = kind === 'slide' ? travelPx : 0;
  return {
    leaving: { tx: -direction * push * p, ty: 0, op: 1 - p },
    arriving: { tx: direction * push * (1 - p), ty: 0, op: p },
  };
}

/** The give at the end of a deck that does not loop: the slide moves a little with the
 *  finger and no further than one push. */
export function endPose(dx: number, travelPx: number): PagePose {
  return { tx: Math.sign(dx) * rubberband(Math.abs(dx), travelPx, RUBBER_BAND), ty: 0, op: 1 };
}

const CHROME = '.pr-hud, .pr-embed-return, .pr-note, .pr-progress';
/** Things with gestures of their own. A web page box is the page's even as a poster, so a
 *  swipe there never depends on whether the page has loaded yet. */
const OWNS_TOUCH = 'input, textarea, select, button:not(.pr-tap), a[href], [contenteditable]:not([contenteditable="false"]), video[controls], audio[controls], iframe, .lolly-box-web, [data-interact], .pr-interact-focus';

/** Can an element scroll on its own, in either axis? */
function scrolls(el: Element, style: CSSStyleDeclaration): boolean {
  const y = /auto|scroll/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
  const x = /auto|scroll/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
  return x || y;
}

/**
 * Why a touch starting on `target` is not a swipe, or null when it may be one.
 *
 * `speaker` touches are allowed only on the speaker view's Current slide; its notes keep
 * their scroll and their text. Anything between the target and the stage that sets its
 * own `touch-action` (a drawing surface, a carousel, a map) has said it handles the
 * finger itself, and so has anything that can scroll.
 */
export function swipeRefusal(target: Element | null, stage: HTMLElement): string | null {
  if (!target || !stage.contains(target)) return 'outside';
  if (target === stage) return null;
  if (target.closest(CHROME)) return 'chrome';
  if (target.closest('.pr-speaker') && !target.closest('.pr-sp-now')) return 'speaker';
  if (target.closest(OWNS_TOUCH)) return 'control';
  const win = stage.ownerDocument.defaultView;
  for (let el: Element | null = target; el && el !== stage; el = el.parentElement) {
    const style = win?.getComputedStyle(el);
    if (!style) continue;
    const action = style.touchAction;
    if (action && action !== 'auto' && action !== 'manipulation') return 'touch-action';
    if (scrolls(el, style)) return 'scroller';
  }
  return null;
}

interface Gesture {
  id: number;
  x0: number;
  y0: number;
  t0: number;
  /** pending: inside the slop; drag: ours; ignored: the browser's, until the finger lifts. */
  state: 'pending' | 'drag' | 'ignored';
  index: number;
  speaker: boolean;
  dx: number;
  direction: 0 | 1 | -1;
  plan: SwipePlan;
  posed: Set<HTMLElement>;
}

export function mountPresentSwipe(config: PresentSwipeConfig): PresentSwipeController {
  const { stage, pages, reduced } = config;
  const doc = stage.ownerDocument;
  const win = doc.defaultView!;
  const tracker = velocityTracker();
  const touches = new Set<number>();
  let gesture: Gesture | null = null;
  let quietUntil = 0;
  const settling = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

  const width = (): number => stage.clientWidth || win.innerWidth;
  const travel = (): number => (win.innerWidth * SLIDE_TRAVEL_VW) / 100;
  /** The stylesheet's transition length, in ms (`--pr-dur`, 0.46s unless retuned). */
  const duration = (): number => {
    const raw = win.getComputedStyle(stage).getPropertyValue('--pr-dur').trim();
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return 460;
    return raw.endsWith('ms') ? n : n * 1000;
  };

  function release(page: HTMLElement): void {
    const timer = settling.get(page);
    if (timer) clearTimeout(timer);
    settling.delete(page);
    for (const prop of ['transition', 'will-change', '--pr-tx', '--pr-ty', '--pr-op', '--pr-dur']) page.style.removeProperty(prop);
  }
  function pose(page: HTMLElement, p: PagePose): void {
    const timer = settling.get(page);
    if (timer) { clearTimeout(timer); settling.delete(page); }
    page.style.transition = 'none';
    page.style.willChange = 'transform, opacity';
    page.style.setProperty('--pr-tx', `${p.tx}px`);
    page.style.setProperty('--pr-ty', `${p.ty}px`);
    page.style.setProperty('--pr-op', String(p.op));
    gesture?.posed.add(page);
  }
  function unpose(g: Gesture): void {
    for (const page of g.posed) release(page);
    g.posed.clear();
  }

  /** Can the deck show this move under the finger right now? */
  function followable(g: Gesture, plan: SwipePlan, direction: 1 | -1): HTMLElement | 'end' | null {
    if (reduced || g.speaker || !plan) return null;
    if (stage.matches('.pr-canvas, .pr-overview, .pr-blackout, .pr-morphing')) return null;
    if (plan === 'end') return 'end';
    if (!followsFinger(plan.kind) || (plan.dir !== 'left' && plan.dir !== 'right')) return null;
    const arriving = pages[plan.index];
    // A loop's wrap arrives at a slide outside the paint window, on the far side of the
    // stack: nothing to slide in, so that move plays on release.
    const side = direction === 1 ? 'pr-future' : 'pr-past';
    if (!arriving || arriving.hidden || !arriving.classList.contains(side)) return null;
    return arriving;
  }

  function follow(g: Gesture, dx: number): void {
    const direction: 1 | -1 = dx < 0 ? 1 : -1;
    if (direction !== g.direction) {
      unpose(g);
      g.direction = direction;
      g.plan = config.plan(direction);
    }
    const leaving = pages[g.index];
    const arriving = followable(g, g.plan, direction);
    if (!leaving || !arriving) return;
    if (arriving === 'end') { pose(leaving, endPose(dx, travel())); return; }
    const kind = (g.plan as { kind: 'slide' | 'fade' }).kind;
    const poses = followPoses(kind, Math.abs(dx) / width(), travel(), direction);
    pose(leaving, poses.leaving);
    pose(arriving, poses.arriving);
  }

  /** Hand the posed pages back to the stylesheet over `ms`, from wherever the finger left
   *  them. With `explicit`, the move back runs on its own transition, whatever the deck's
   *  last move was; without it, the stylesheet's transition for the move being made. */
  function settle(g: Gesture, ms: number, explicit: boolean): void {
    for (const page of g.posed) {
      page.style.removeProperty('--pr-tx');
      page.style.removeProperty('--pr-ty');
      page.style.removeProperty('--pr-op');
      page.style.setProperty('--pr-dur', `${ms}ms`);
      if (explicit) page.style.transition = `transform ${ms}ms var(--pr-ease), opacity ${ms}ms linear`;
      else page.style.removeProperty('transition');
      settling.set(page, setTimeout(() => release(page), ms + 60));
    }
    g.posed.clear();
  }

  function finish(g: Gesture, velocity: number): void {
    const dx = g.dx;
    const progress = Math.min(1, Math.abs(dx) / width());
    const full = duration();
    const commit = g.plan !== 'end' && swipeCommits(dx, velocity, width());
    quietUntil = performance.now() + CLICK_AFTER_SWIPE_MS;
    if (!commit) { settle(g, Math.max(MIN_SETTLE_MS, Math.round(full * progress)), true); return; }
    // The rest of the authored transition plays from where the finger left the slides.
    // The pose comes off in the same task as the step, so the stylesheet's transition
    // starts from the finger's frame rather than from rest.
    settle(g, Math.max(MIN_SETTLE_MS, Math.round(full * (1 - progress))), false);
    config.step(dx < 0 ? 1 : -1);
  }

  function abandon(g: Gesture): void {
    if (g.state === 'drag') {
      quietUntil = performance.now() + CLICK_AFTER_SWIPE_MS;
      if (g.posed.size) settle(g, MIN_SETTLE_MS, true);
    }
    g.state = 'ignored';
  }

  const onDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    // The first finger of a new touch: whatever an earlier touch left behind is over.
    if (e.isPrimary) {
      touches.clear();
      if (gesture) { abandon(gesture); gesture = null; }
    }
    touches.add(e.pointerId);
    if (gesture) {
      // A second finger: a pinch, or a two-finger scroll. The deck stands down.
      abandon(gesture);
      return;
    }
    if (touches.size > 1 || !config.enabled()) return;
    if ((win.visualViewport?.scale ?? 1) > 1.01) return;          // zoomed in: the finger pans the zoom
    const selection = win.getSelection();
    if (selection && !selection.isCollapsed) return;               // working with a selection
    if (swipeRefusal(e.target as Element | null, stage)) return;
    gesture = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp,
      state: 'pending', index: config.index(),
      speaker: !!(e.target as Element).closest?.('.pr-speaker'),
      dx: 0, direction: 0, plan: null, posed: new Set(),
    };
    tracker.reset();
    tracker.push(e.timeStamp, e.clientX);
  };

  const onMove = (e: PointerEvent): void => {
    const g = gesture;
    if (!g || e.pointerId !== g.id || g.state === 'ignored') return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (g.state === 'pending') {
      const axis = swipeAxis(dx, dy);
      if (!axis) return;
      if (axis === 'y' || e.timeStamp - g.t0 > SWIPE_LONG_PRESS_MS) { g.state = 'ignored'; return; }
      g.state = 'drag';
    }
    // The deck moved under the finger (a kiosk dwell, a narration ending): this swipe
    // was about a slide that has gone, so it lets go rather than step twice.
    if (config.index() !== g.index || !config.enabled()) { abandon(g); return; }
    tracker.push(e.timeStamp, e.clientX);
    g.dx = dx;
    follow(g, dx);
  };

  const onUp = (e: PointerEvent): void => {
    touches.delete(e.pointerId);
    const g = gesture;
    if (!g || e.pointerId !== g.id) return;
    gesture = null;
    if (g.state !== 'drag') return;
    if (config.index() !== g.index || !config.enabled()) { abandon(g); return; }
    finish(g, tracker.get(e.timeStamp));
  };

  const onCancel = (e: PointerEvent): void => {
    touches.delete(e.pointerId);
    const g = gesture;
    if (!g || e.pointerId !== g.id) return;
    gesture = null;
    abandon(g);
  };

  // Engines that ignore `touch-action: pan-y` would still pan or navigate on a sideways
  // drag; once a swipe is ours, its moves are not the browser's.
  const onTouchMove = (e: TouchEvent): void => {
    if (gesture?.state === 'drag' && e.cancelable) e.preventDefault();
  };
  // A swipe that began on an edge tap zone must not also press that zone.
  const onClick = (e: MouseEvent): void => {
    if (performance.now() < quietUntil && (e.target as Element | null)?.closest?.('.pr-tap')) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  // Zoomed in, every pan belongs to the browser so the slide can be read up close.
  const onZoom = (): void => { stage.classList.toggle('pr-zoomed', (win.visualViewport?.scale ?? 1) > 1.01); };

  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onCancel);
  stage.addEventListener('touchmove', onTouchMove, { passive: false });
  stage.addEventListener('click', onClick, true);
  win.visualViewport?.addEventListener('resize', onZoom);
  onZoom();

  return {
    destroy(): void {
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onCancel);
      stage.removeEventListener('touchmove', onTouchMove);
      stage.removeEventListener('click', onClick, true);
      win.visualViewport?.removeEventListener('resize', onZoom);
      for (const page of [...settling.keys()]) release(page);
      gesture = null;
    },
  };
}
