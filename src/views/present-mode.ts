// SPDX-License-Identifier: MPL-2.0
// present-mode.ts - the presentation-mode conductor (plan 112, M1).
//
// Turns a design frame document into a fullscreen, click-advanced DECK. The
// deck MODEL and every index/direction/state-class decision live in the pure, DOM-free
// present-math.ts; this file is the DOM half: it reads the rendered `.lolly-frame-page`
// nodes, builds a fixed full-viewport stage, drives transitions through a state-class
// contract, and handles keyboard / tap / overview / fullscreen / URL sync.
//
// WHY CLONES, NOT THE LIVE NODES. The plan sketched normalising the live frame pages in
// place (the sequence-dom record-and-restore contract). Two facts pushed this to a
// safer shape: (1) the design canvas sits under the free-canvas CAMERA transform,
// so a `position:fixed` page presented in place resolves against that transformed
// ancestor, not the viewport (the containing-block trap this codebase already fights in
// float panels). (2) Restore fidelity is the plan's #1 risk - a leaked transform means a
// wrong export later. Cloning the pages into a body-level stage means the ORIGINAL
// canvas DOM is never touched, so restore is not a discipline to get right - it is
// automatic (remove the stage; the editor underneath is byte-identical). Media/interactive
// continuity is preserved the same way the timeline preserves it: video-mount keys resume
// off `data-video-key`, which survives the clone. M2 layers real media conduct on top.

import {
  buildDeck,
  resolveAddress,
  navDir,
  frameStates,
  walkNext,
  walkPrev,
  stackStep,
  clampIndex,
  matchMorphBoxes,
  seedStacks,
  cameraFor,
  flightPath,
  unionRect,
  FLIGHT_MARGIN,
  FLIGHT_MAX_SPANS,
  type Camera,
  type Deck,
  type FrameSpec,
  type MorphBox,
  type NavDir,
  type Rect,
  type Viewport,
} from './present-math.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { announce } from '../a11y.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { mountLottiePlayers, destroyLottiePlayers, lottiePlayerFor } from './lottie-mount.ts';
import { mountAnimSvgPlayers } from './anim-svg-mount.ts';
import { createSequenceTime, DRIVE_FPS } from '../bridge/sequence-dom.ts';
import { NARRATION_TAIL_MS } from '../lib/motion-model.ts';
import { PENDING_MS, poseSlideBoxes } from '../lib/slide-pose.ts';
import { easingPoints, splitPhaseWindowMs } from '../lib/transitions.ts';
import { MIN_TRANSITION_MS, MAX_TRANSITION_MS } from '../bridge/sequence-plan.ts';
import { CAPTION_BOX_CLASS } from './timeline-captions.ts';

/** How long the HUD stays visible after the last pointer/key wake (viz-overlay's 2600). */
const IDLE_MS = 2600;

/**
 * A burned-in caption box, by the two marks the export path already reads
 * (`CAPTION_SELECTOR` in bridge/sequence-render.ts): the caption preset's own class, or
 * `data-caption` for a tool that marks its captions itself. The model's `group` never
 * reaches the markup, so these two are all there is to go on.
 *
 * Captions are for a FILE - a video someone watches without a presenter - so the podium
 * hides them unless the document asks for them (plans/180 section 4, and the doc-level
 * `showCaptionsWhenPresenting`). A live speaker subtitling themselves is the odd case.
 */
const CAPTION_SELECTOR = `.lolly-box.${CAPTION_BOX_CLASS}, .lolly-box[data-caption]`;

/**
 * An audio box the presenter is allowed to SPEAK on its slide (plans/180 M-E).
 *
 * Two marks, one rule. `data-narration="1"` is the flag the tool's hook stamps on a clip
 * made from this slide's speaker notes - that clip exists to be heard, so it is conducted
 * without asking. `data-present-audio="1"` is the same opt-in a video box already carries:
 * any OTHER audio on a slide (a bed, a sound effect) is silent at the podium until its
 * author says otherwise, because a deck must never blare.
 *
 * Both are read off the `[data-audio-src]` marker OR its `.lolly-box` wrapper, because the
 * hook writes them on the marker while a hand-authored document may carry them on the box.
 * tests/design-present-narration.test.ts drives the REAL hook output through this file, so
 * the two halves of the contract cannot drift apart again.
 */
function speaksOnItsSlide(marker: HTMLElement): boolean {
  if (isNarrationMarker(marker)) return true;
  const box = marker.closest?.('.lolly-box') ?? null;
  for (const el of [marker, box]) {
    if (!el) continue;
    const opt = el.getAttribute('data-present-audio');
    if (opt != null && opt !== '0' && opt !== 'false') return true;
  }
  return false;
}

/**
 * Is this marker the slide's OWN VOICE - a clip made from its speaker notes?
 *
 * Narrower than {@link speaksOnItsSlide} on purpose, and the difference decides whether
 * the captions stay up: a bed that opted into present audio is not the thing saying the
 * words, but a narration clip is, and on a narrated slide the podium IS the speaker.
 */
function isNarrationMarker(marker: HTMLElement): boolean {
  const box = marker.closest?.('.lolly-box') ?? null;
  for (const el of [marker, box]) {
    if (el?.hasAttribute('data-narration')) return true;
  }
  return false;
}
/** replaceState no more than once per second (reveal's MAX_REPLACE_STATE_FREQUENCY;
 *  Safari throttles it). The conductor fires onAddress freely; the caller debounces. */

export interface OpenPresentOptions {
  /** The tool canvas scope that holds the rendered `.lolly-frame-page` nodes (#tool-content). */
  source: HTMLElement;
  /** The `?s=` address to open on (position, frame id, or `h.f`); null → the first slide. */
  initial?: string | null;
  /** `?loop` - wrap at the ends (signage). */
  loop?: boolean;
  /** Deck-level slide transition, the fallback for a frame that names none of its own
   *  (M5, and plan 179 M4's per-frame `slideTransition`). `morph` FLIPs matching boxes
   *  between slides, `flight` flies the camera between artboards on the canvas stage;
   *  `slide`/`fade`/`none` use the CSS state-class transition. */
  transition?: 'slide' | 'fade' | 'morph' | 'flight' | 'none';
  /** Called on every active-slide OR build-step change with the reorder-proof frame id
   *  and the current build threshold (0 = none). The caller debounces this into
   *  `history.replaceState` as `s=<id>` or `s=<id>.<build>`, keeping the URL a live deep link. */
  onAddress?: (frameId: string, index: number, build: number) => void;
  /** Called once when the presenter is fully torn down (URL cleanup, editor resume). */
  onClose?: () => void;
  /** Where to mount the stage. Defaults to document.body (an un-transformed root, so the
   *  fixed stage fills the true viewport). */
  container?: HTMLElement;
  /** The LIVE tool canvas, read for the CSS custom properties the clones consume
   *  (`--brand-*`, `--lolly-*`, `--font-*`). The stage is a body-level overlay, so it does
   *  not inherit the brand slots applyBrandVars writes inline on the canvas element - and a
   *  box authored `fg: var(--brand-on-primary, #ffffff)` would then paint its FALLBACK here
   *  and the brand colour in the editor (plan 179 T7). Defaults to the mounted
   *  `#tool-canvas`/`#tool-content`. */
  varsFrom?: HTMLElement | null;
}

export interface PresentController {
  /** Tear down: exit fullscreen, remove the stage, restore the page, fire onClose. Idempotent. */
  close(): void;
  /** Navigate to an `s=` address (position / id / `h.f`). No-op if it resolves to nothing. */
  go(address: string): void;
  /**
   * Toggle the speaker view - the same verb the `s` key and the toolbar button carry.
   * Exposed so the Design top bar's "Speaker view" row can open the presenter straight
   * into it (plan 179 M1): the caller opens, awaits, then calls this. A second call
   * closes it again, so it is a toggle here too rather than a one-way door.
   */
  speaker(): void;
  /** The active frame's id, or null before the first render. */
  readonly frameId: string | null;
  /** Whether the overview (all-frames map) is showing. */
  readonly overview: boolean;
}

/** Parse an authored pixel value off an inline style (`left:120px` → 120). */
function px(el: HTMLElement, prop: 'left' | 'top' | 'width' | 'height'): number {
  const v = parseFloat(el.style.getPropertyValue(prop));
  return Number.isFinite(v) ? v : 0;
}

/** Did the document ASK to auto-advance? The hook stamps `data-auto-advance` on the doc
 *  root (`.lolly-frames` for a framed doc, `.artboard` for a frameless one) when the tool's
 *  `autoAdvance` input is on; a caller may also carry it on the source scope itself.
 *
 *  This is the whole of plan 179 T3. A frame's `dur` is its TIMELINE length first - "Place
 *  in order" writes one on every frame - and the hook stamps that same number as
 *  `data-frame-dur`. Treating the attribute's mere presence as consent turned every
 *  click-advanced deck into a 3-second kiosk deck the moment its author laid it on the
 *  timeline. So the dwell is armed by an explicit request, never inferred from a length. */
function wantsAutoAdvance(source: HTMLElement): boolean {
  return docFlag(source, 'data-auto-advance');
}

/** Everywhere a DOCUMENT-level attribute may sit: the doc root the hook stamps
 *  (`.lolly-frames` framed, `.artboard` frameless), whatever wrapper the template
 *  actually used, and the source scope itself for a caller that carries it there. */
function docRoots(source: HTMLElement): Array<HTMLElement | null> {
  return [
    source,
    ...source.querySelectorAll<HTMLElement>('.lolly-frames, .artboard'),
    source.querySelector<HTMLElement>('.lolly-frame-page')?.parentElement ?? null,
  ];
}

/** A document-level yes/no. Present and not `0`/`false` is a yes; absent is a no. */
function docFlag(source: HTMLElement, attr: string): boolean {
  for (const r of docRoots(source)) {
    const v = r?.getAttribute(attr);
    if (v != null && v !== '0' && v !== 'false') return true;
  }
  return false;
}

/** A document-level millisecond setting, or `dflt` where the document names none. */
function docMs(source: HTMLElement, attr: string, dflt: number): number {
  for (const r of docRoots(source)) {
    const v = Number(r?.getAttribute(attr));
    if (Number.isFinite(v) && v >= 0) return Math.round(v);
  }
  return dflt;
}

/** Read the rendered frame pages into the pure model's FrameSpec shape. Order is DOM
 *  order - the hook already emits pages sorted (order asc, tie x asc), so document order
 *  IS presentation order; geometry comes off the inline pageStyle the hook wrote.
 *  `kiosk` false ignores `data-frame-dur` outright (see wantsAutoAdvance): every frame
 *  reads as manual, so no dwell arms, no progress bar and no pause button appear. */
function readFrames(source: HTMLElement, kiosk: boolean): { specs: FrameSpec[]; pages: HTMLElement[] } {
  const pages = [...source.querySelectorAll<HTMLElement>('.lolly-frame-page')];
  const specs = pages.map((page, i): FrameSpec => {
    const d = kiosk ? Number(page.getAttribute('data-frame-dur')) : NaN; // kiosk dwell, ms (hook-stamped)
    return {
      id: page.getAttribute('data-frame-id') || String(i),
      order: i,
      x: px(page, 'left'),
      y: px(page, 'top'),
      w: px(page, 'width') || 1,
      h: px(page, 'height') || 1,
      dur: Number.isFinite(d) && d > 0 ? d : null,
      stackOf: page.getAttribute('data-frame-stack') || null,
    };
  });
  // Sub-slide stacks (plan 112 M5): authored stackOf wins outright; with none
  // authored, same-x columns become stacks (seedStacks documents its abstentions).
  return { specs: seedStacks(specs), pages };
}

// ---- Per-slide motion (plan 179 M4) --------------------------------------------------
//
// A box can be given an Enter, an Exit, a hold or a keyframe track, and the presenter now
// plays them - on a LOCAL clock that starts when its slide arrives. The applier is the one
// the timeline and the video export already use (`createSequenceTime`), so a deck animates
// the same way in all three; what this file adds is the slide-local timebase and the three
// ways a box can be asked to appear (with the slide, on a click, at a time).
//
// The clock is `setTimeout` paced against a wall clock, never `requestAnimationFrame`: a
// projector tab that loses focus stops getting frames, and a deck that freezes mid-build
// because the presenter alt-tabbed is the whole reason the export path banned rAF too.

/**
 * The window the slide's own clock runs inside, declared on the clone as `data-seq-ms`.
 *
 * It has to be declared, because an open-ended box on a stage with NO length is
 * unconditionally on screen (sequence-dom's `isActiveAt` says so, and it is right to - an
 * untimed board has no window to be outside of). Without a length a parked fragment would
 * simply show. Long enough that nothing an author can express reaches the end of it, short
 * enough that PENDING_MS is outside.
 */
const SLIDE_SPAN_MS = PENDING_MS - 1;

/** A hold or a keyframe track never settles, so a slide carrying one has no natural end.
 *  Ten minutes, then the clock stops: a projector parked on a slide should not tick until
 *  the battery is flat, and nobody is watching a wobble that long. */
const PRESENT_CLOCK_MAX_MS = 600_000;

/** The clock's step, shared with the export driver so both step at the same rate. */
const MOTION_STEP_MS = 1000 / DRIVE_FPS;

/** EASINGS.smooth as CSS - the flight camera's one curve. Read from the shared table
 *  rather than retyped, so a change there moves the camera too. */
const FLIGHT_EASE_CSS = `cubic-bezier(${(easingPoints('smooth') ?? [0.4, 0, 0.2, 1]).join(',')})`;

/** A number off an attribute, or `fallback` when it is absent or junk. */
function numAttr(el: Element, name: string, fallback: number): number {
  const raw = el.getAttribute(name);
  if (raw == null || raw === '') return fallback;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
}

/** Copy a box's presenter-only Enter/Exit (`data-pr-*`) onto the names the applier reads.
 *  The hook emits those for an UNTIMED box, because widening `data-t-enter` to every box
 *  would change what the video compositor renders (it reads that attribute off all of
 *  them). Only this file reads `data-pr-*`, and only onto its own clone. */
/**
 * Rewrite one CLONE's timing into slide-local terms. Runs ONCE per clone (the result is
 * remembered on it), and never touches the original page - the presenter's whole restore
 * story is that the editor's DOM was never in this.
 *
 * The document's timeline is one long line across every frame; a slide's clock starts at
 * zero when that slide arrives. The three ways of appearing land as three different
 * starts - with the slide (0, open-ended), at a time (the authored start minus the
 * frame's), on a click (parked at PENDING_MS until `stepBuild` reaches it) - and that
 * mapping is `poseSlideBoxes`, shared with the video compositor so the film and the
 * podium pose a slide from one rule (plans/184 R1). No slide length is passed: a click
 * deck has none, and exits play on the way out instead (`beginExits`).
 *
 * Returns how many boxes ended up on the clock; zero means the slide has nothing to
 * animate and no session is opened for it at all.
 */
function restampSlideMotion(clone: HTMLElement, reduced: boolean): number {
  const already = clone.dataset.prRestamped;
  if (already != null) return Number(already) || 0;
  // The PAGE's own timing is the document timeline's, and this clone is a slide, not a
  // clip in a longer film: its start would otherwise hide the whole slide.
  const frameStartMs = numAttr(clone, 'data-t-start', 0);
  for (const name of ['data-t-start', 'data-t-dur', 'data-t-enter', 'data-t-exit']) clone.removeAttribute(name);
  clone.setAttribute('data-seq-ms', String(SLIDE_SPAN_MS));
  const { posed } = poseSlideBoxes(clone, { reduced, clicks: 'park', pageStartMs: 0, authoredPageStartMs: frameStartMs, pageDurMs: null });
  clone.dataset.prRestamped = String(posed);
  return posed;
}

/** Park every fragment above `threshold` and release the ones at or below it. Called on
 *  arrival, so a slide entered backwards (which shows every build) is already complete. */
function armBuildStarts(clone: HTMLElement, threshold: number): void {
  for (const box of clone.querySelectorAll<HTMLElement>('[data-build]')) {
    const v = Number(box.getAttribute('data-build')) || 0;
    if (v < 1) continue;
    box.setAttribute('data-t-start', v <= threshold ? '0' : String(PENDING_MS));
  }
}

/**
 * When this slide's motion is over: the last moment any box is still moving.
 *
 * A hold or a keyframe track has no such moment - both are cyclical - so a slide carrying
 * either runs to the cap instead. Parked fragments are skipped: their clock has not
 * started, and `wake()` recomputes this the moment one is clicked.
 */
function motionEndMs(clone: HTMLElement): number {
  if (clone.querySelector('[data-t-hold],[data-t-kf]')) return PRESENT_CLOCK_MAX_MS;
  let end = 0;
  for (const el of clone.querySelectorAll<HTMLElement>('[data-t-start]')) {
    const start = numAttr(el, 'data-t-start', 0);
    if (start >= PENDING_MS) continue;
    const enterMs = el.getAttribute('data-t-enter') ? numAttr(el, 'data-t-enter-ms', 400) : 0;
    // Split text finishes when its LAST unit does - the same window the applier deals its
    // per-unit delays from, imported rather than re-typed so the two cannot drift.
    const tail = el.getAttribute('data-t-split')
      ? splitPhaseWindowMs(numAttr(el, 'data-t-stagger', 60), el.querySelectorAll('.lly-u').length, enterMs)
      : enterMs;
    end = Math.max(end, start + tail);
    const dur = numAttr(el, 'data-t-dur', NaN);
    if (Number.isFinite(dur)) {
      const exitMs = el.getAttribute('data-t-exit') ? numAttr(el, 'data-t-exit-ms', 400) : 0;
      end = Math.max(end, start + dur + exitMs);
    }
  }
  return Math.min(PRESENT_CLOCK_MAX_MS, Math.max(0, Math.round(end)));
}

/** One slide's running motion. `begin` is separate from opening because a flight holds the
 *  clock until the camera settles - the slide should start moving where the audience is
 *  looking, not while they are still travelling. */
interface SlideMotion {
  /** Which clone this belongs to (the walk index). */
  readonly index: number;
  /** The slide-local clock, ms since `begin()`. Frozen while paused. */
  t(): number;
  /** Start the clock. Idempotent. */
  begin(): void;
  /** Re-read the end and put the pose on screen now - after a fragment is revealed. */
  wake(): void;
  setPaused(paused: boolean): void;
  /** Stop ticking and KEEP the pose (the slide is at rest, or on its way out). */
  stop(): void;
  /** Stop, and hand every box back exactly as it was rendered. */
  teardown(): void;
}

/**
 * Take back the out points a LEAVE wrote (plans/184 R4). A slide re-entered later has to
 * arrive whole: a box whose exit played on the way out would otherwise be past its end
 * from the first tick and never show.
 */
function clearLeaveDurs(clone: HTMLElement): void {
  for (const box of clone.querySelectorAll<HTMLElement>('[data-pr-leave-dur]')) {
    box.removeAttribute('data-t-dur');
    box.removeAttribute('data-pr-leave-dur');
  }
}

/**
 * Give every box on screen with an authored Exit an out point NOW, so its exit plays
 * (plans/184 R4). Returns how long the longest exit takes, in ms - what a leave waits.
 *
 * A with-the-slide box is open-ended on the slide's clock and could never exit; a click
 * box is the same once revealed. The timeline and the video play those exits (the box
 * ends where the frame does), so the podium was the one player where an authored Exit
 * was silently nothing. Each box gets `data-t-dur = now - start + window`, which puts
 * the applier's exit phase exactly at now; a timed box with its own length keeps it. The
 * marker lets `clearLeaveDurs` undo this on the slide's next arrival.
 */
function beginExits(clone: HTMLElement, atMs: number): number {
  let longest = 0;
  for (const box of clone.querySelectorAll<HTMLElement>('[data-t-exit]')) {
    const kind = box.getAttribute('data-t-exit');
    if (!kind || kind === 'none' || box.hasAttribute('data-t-dur')) continue;
    const start = numAttr(box, 'data-t-start', 0);
    if (start >= PENDING_MS || start > atMs) continue;   // parked, or not yet arrived
    const exitMs = Math.min(MAX_TRANSITION_MS, Math.max(MIN_TRANSITION_MS, numAttr(box, 'data-t-exit-ms', 400)));
    // Split text leaves when its LAST unit has - the window the applier deals its exits
    // from, imported rather than re-typed so the wait and the motion cannot disagree.
    const win = box.getAttribute('data-t-split')
      ? splitPhaseWindowMs(numAttr(box, 'data-t-stagger', 60), box.querySelectorAll('.lly-u').length, exitMs)
      : exitMs;
    box.setAttribute('data-t-dur', String(Math.max(1, Math.round(atMs - start + win))));
    box.setAttribute('data-pr-leave-dur', '1');
    longest = Math.max(longest, win);
  }
  return Math.round(longest);
}

/** Open the motion session for one slide's clone, posed at t=0, clock not yet running.
 *  Null when the slide has nothing to animate - the common case, and it costs one query. */
function openSlideMotion(
  clone: HTMLElement,
  index: number,
  reduced: boolean,
  buildThreshold: number,
): SlideMotion | null {
  clearLeaveDurs(clone);
  if (!restampSlideMotion(clone, reduced)) return null;
  armBuildStarts(clone, buildThreshold);
  const session = createSequenceTime(clone); // no media callback - conductMedia owns video
  const now = (): number => (
    typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
  );
  let started = false;
  let paused = false;
  let done = false;
  let t0 = 0;
  let pausedAt = 0;
  let endMs = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const elapsed = (): number => (started ? Math.max(0, Math.round((paused ? pausedAt : now()) - t0)) : 0);
  const applyAt = (t: number): void => {
    // One bad frame never stops the deck: a throwing applier must not take the whole
    // presentation down with it, and the next tick will very likely be fine.
    try { session.apply(t); } catch { /* keep presenting */ }
  };
  const applyNow = (): void => { applyAt(elapsed()); };
  const schedule = (): void => {
    if (timer == null && started && !paused && !done) timer = setTimeout(tick, MOTION_STEP_MS);
  };
  function tick(): void {
    timer = null;
    if (!started || paused || done) return;
    const t = elapsed();
    applyNow();
    // Past the end we hold the last pose rather than restoring: an unfired fragment must
    // stay unfired (that is exactly what driveSequenceTime's stop() gets wrong for a deck).
    if (t >= endMs) return;
    schedule();
  }
  session.apply(0); // the pose the slide arrives in, before anyone sees it
  const motion: SlideMotion = {
    index,
    t: elapsed,
    begin() {
      if (started || done) return;
      started = true;
      endMs = motionEndMs(clone);
      // Take t0 last and pose at exactly 0, not at `elapsed()`: the DOM query above and a
      // second `now()` read cost a few ms on a loaded machine, and a slide that is paused
      // straight after `begin()` (armSlideMotion behind the overview) would otherwise
      // freeze a few ms INTO its entrance instead of at the start of it.
      t0 = now();
      applyAt(0);
      schedule();
    },
    wake() {
      if (done) return;
      if (!started) { motion.begin(); return; }
      endMs = motionEndMs(clone);
      applyNow();
      schedule();
    },
    setPaused(v) {
      if (v === paused || done) return;
      paused = v;
      if (v) {
        pausedAt = now();
        if (timer) { clearTimeout(timer); timer = null; }
      } else {
        // The wall clock ran on while we were black; the slide's did not.
        t0 += now() - pausedAt;
        applyNow();
        schedule();
      }
    },
    stop() {
      done = true;
      if (timer) { clearTimeout(timer); timer = null; }
    },
    teardown() {
      motion.stop();
      try { session.restore(); } catch { /* a torn-down clone is about to be dropped anyway */ }
    },
  };
  return motion;
}

export function openPresentMode(opts: OpenPresentOptions): PresentController | null {
  const { source, loop = false, onAddress, onClose, transition = 'slide' } = opts;
  const container = opts.container ?? document.body;
  /** The deck's own transition - what a frame that names none of its own falls back to. */
  const docTransition: string = transition;

  // Defensive: clear any stage a prior session leaked (a route change can re-mount the
  // tool without running the presenter's teardown, orphaning a body-level stage).
  for (const s of document.querySelectorAll('.pr-stage')) s.remove();

  // Kiosk dwell is opt-in (T3): the document's own `autoAdvance` request, or the reserved
  // `?kiosk` signage flag this presenter was opened with (which is also what `loop` means -
  // signage links `?present&kiosk` must keep advancing).
  const kiosk = loop || wantsAutoAdvance(source);
  const { specs, pages } = readFrames(source, kiosk);
  if (specs.length === 0) return null; // nothing to present - caller nudges "add frames"

  // The two document-level narration settings the podium honours (plans/180): whether the
  // burned-in captions stay up while a human is speaking, and how long after the last word
  // a narrated deck waits before it moves on. Both read once, at open, from the doc root.
  const showCaptions = docFlag(source, 'data-present-captions');
  const narrationTailMs = docMs(source, 'data-narration-tail', NARRATION_TAIL_MS);

  const deck: Deck = buildDeck(specs);
  const reduced = prefersReducedMotion();

  // ---- Stage DOM (a body-level fixed overlay; never a child of the canvas) ----------
  const stage = document.createElement('div');
  stage.className = 'pr-stage';
  stage.tabIndex = -1;
  stage.setAttribute('role', 'region');
  stage.setAttribute('aria-label', t('Presentation'));
  stage.setAttribute('data-export-hide', ''); // never captured by an export walk
  stage.dataset.prTransition = transition;     // 'slide' | 'fade' | 'morph' (present.css varies on it)
  if (reduced) stage.classList.add('pr-reduced');

  // T7: carry the tool canvas's brand/typeface custom properties onto the stage. The clones
  // are byte-identical to the canvas's markup, so a box whose colour reads
  // `var(--brand-on-primary, #ffffff)` resolves against WHOEVER hosts it - and this stage is
  // a body-level overlay outside the canvas element applyBrandVars writes those slots onto.
  // Copy the live values (once, at open) so the fallback can never win here and the two
  // surfaces cannot disagree about a colour. Re-applied to the speaker popup's document
  // below, which hosts clones of its own.
  const scopeVars = readScopeVars(opts.varsFrom ?? document.querySelector<HTMLElement>('#tool-canvas, #tool-content'));
  applyScopeVars(stage, scopeVars);

  const framesEl = document.createElement('div');
  // `pr-scope` is the shared style-scope class the re-scoped tool CSS targets - carried by
  // the deck AND by slide-preview containers (speaker view), so a preview gets styled too.
  framesEl.className = 'pr-frames pr-scope';
  stage.appendChild(framesEl);

  // Clone each rendered page. Clones are ours to mutate freely; the originals are never
  // touched. Strip the authored absolute placement (present.css centres every page in
  // one co-located stack) and stamp the per-page fit scale + walk index.
  const cloneByIndex: HTMLElement[] = [];
  // Does the deck SPEAK, and is any of it its own voice? Both are decided here, off the
  // clones, because both change the chrome: a deck that plays audio on its own must offer
  // a way to silence it (WCAG 1.4.2 Audio Control), and a slide narrating itself keeps its
  // captions - there is no live speaker saying the same words.
  let deckSpeaks = false;
  for (let i = 0; i < pages.length; i++) {
    const src = pages[i]!;
    const clone = src.cloneNode(true) as HTMLElement;
    clone.classList.add('pr-page');
    clone.removeAttribute('data-pdf-page'); // not a page to export; a slide to show
    clone.style.removeProperty('left');
    clone.style.removeProperty('top');
    clone.style.removeProperty('margin');
    // Mark build boxes (M3): a `data-build` child is a fragment revealed on advance - 
    // it starts hidden (present.css) and gets `pr-shown` when its step is reached.
    for (const bx of clone.querySelectorAll<HTMLElement>('[data-build]')) bx.classList.add('pr-build');
    // Burned-in captions are a property of the FILE, not of the room (plans/180 section
    // 4): a live speaker is saying the same words out loud, so the podium hides them.
    // EXCEPT on a slide that narrates itself - there the synthesized voice is the only
    // carrier of the content, nobody in the room is speaking, and hiding the cues cut
    // from that very voice's word timings leaves a deaf attendee with nothing. Hidden on
    // the CLONE only, so the canvas, the export and the video keep every caption as
    // authored, and the document flag still forces them on everywhere.
    const markers = [...clone.querySelectorAll<HTMLElement>('[data-audio-src]')];
    const slideNarrates = markers.some(isNarrationMarker);
    if (markers.some(speaksOnItsSlide)) deckSpeaks = true;
    if (!showCaptions && !slideNarrates) {
      for (const cap of clone.querySelectorAll<HTMLElement>(CAPTION_SELECTOR)) cap.hidden = true;
    }
    // The clone keeps its authored width/height (child boxes are in frame-local coords),
    // so a single scale fits the whole page - letterboxed to its own aspect.
    clone.dataset.prIndex = String(i);
    framesEl.appendChild(clone);
    cloneByIndex[i] = clone;
  }

  // ---- HUD + tap zones (siblings of the frames, so slide content stays clickable) ----
  const tapPrev = el('button', 'pr-tap pr-tap-prev');
  tapPrev.setAttribute('aria-label', t('Previous'));
  const tapNext = el('button', 'pr-tap pr-tap-next');
  tapNext.setAttribute('aria-label', t('Next'));
  stage.append(tapPrev, tapNext);

  // Kiosk auto-advance is only offered when the doc asked for it AND at least one frame
  // declares a dwell - readFrames already nulled every `dur` when it did not (T3).
  const deckHasDurs = specs.some((s) => (s.dur ?? 0) > 0);

  const hud = el('div', 'pr-hud');
  const counter = el('span', 'pr-counter');
  const btnPrev = hudBtn('chevronLeft', t('Previous'));
  const btnNext = hudBtn('chevronRight', t('Next'));
  // Pause holds a KIOSK dwell, and it also holds a voice: a narrated deck plays itself
  // whether or not the author turned auto-advance on, so the button is offered for either
  // reason. Icon/label swap in syncPauseBtn.
  const btnPause = (deckHasDurs || deckSpeaks) ? hudBtn('play', t('Pause')) : null;
  // WCAG 1.4.2: audio that starts on its own and runs past three seconds needs a control
  // that silences it without leaving the presentation. Blackout is not that control - it
  // blanks the screen - so a deck that speaks gets its own mute.
  const btnMute = deckSpeaks ? hudBtn('volumeOn', t('Mute narration')) : null;
  const btnSpeaker = hudBtn('monitor', t('Speaker view'));
  const btnOverview = hudBtn('grid', t('Overview'));
  const btnExit = hudBtn('close', t('Exit presentation'));
  hud.append(btnPrev, counter, btnNext, ...(btnPause ? [btnPause] : []),
    ...(btnMute ? [btnMute] : []), btnSpeaker, btnOverview, btnExit);
  stage.appendChild(hud);

  // Kiosk dwell progress - a thin bar that fills over the active frame's dur, then advances.
  const progress = el('div', 'pr-progress');
  const progressFill = el('div', 'pr-progress-fill');
  progress.appendChild(progressFill);
  if (deckHasDurs) stage.appendChild(progress);

  // A transient message, INSIDE the stage: the presenter usually owns fullscreen, where a
  // body-level toast would render behind the fullscreen element and be seen by nobody. Its
  // one job today is telling the presenter where the speaker view went (P4).
  const noteEl = el('div', 'pr-note');
  noteEl.setAttribute('role', 'status');
  noteEl.hidden = true;
  stage.appendChild(noteEl);

  container.appendChild(stage);
  // The tool's styles.css is scoped `#tool-canvas .lolly-box{…}`; clones live in a
  // body-level stage, so copy those box-layout rules re-scoped to `.pr-frames`. Faithful
  // to whatever the tool defines (no drift), and structural only - text/colour ride inline.
  injectToolBoxStyles(stage);

  // ---- State -------------------------------------------------------------------------
  const initAddr = resolveAddress(opts.initial, deck);
  let active = clampIndex(deck, initAddr.position?.index ?? 0);
  let build = 0;           // current build threshold of the active frame (0 = none revealed); set below
  let overview = false;
  let closed = false;
  let blackout = false;    // `b` - a black hold that pauses media + auto-advance
  let autoPaused = false;  // the deck HELD by the user: the dwell stops, and so does the sound
  let muted = false;       // `m` / the HUD mute - the audio control WCAG 1.4.2 asks for
  let appliedState: string[] = []; // frame `state` tokens currently on the stage root (M4)
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let armTimer: ReturnType<typeof setTimeout> | null = null;
  let advTimer: ReturnType<typeof setTimeout> | null = null;
  let morphTimer: ReturnType<typeof setTimeout> | null = null;
  let noteTimer: ReturnType<typeof setTimeout> | null = null;
  let popupProbe: ReturnType<typeof setTimeout> | null = null;
  // Narration (plans/180 M-E). One <audio> per marker, made on first use; the pending
  // lead-in timers; which markers this session has put on the air; and the two pieces of
  // the T9 advance - "the dwell ran out while the slide was still speaking" and the tail
  // that runs after the last word.
  const narrationEls = new Map<HTMLElement, HTMLAudioElement>();
  const narrationTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  const narrationPlaying = new Set<HTMLElement>();
  const narrationDone = new Set<HTMLElement>();
  let narrationDue = false;
  let narrTailTimer: ReturnType<typeof setTimeout> | null = null;
  // Per-slide motion (M4): the active slide's session, plus the ones on their way out -
  // a leaving slide keeps its pose for the length of the outgoing transition and only
  // then hands its boxes back, so nothing snaps mid-move.
  let motion: SlideMotion | null = null;
  const leaving: Array<{ m: SlideMotion; timer: ReturnType<typeof setTimeout> }> = [];
  // Flight (section 7): the canvas stage, and the pair of frames a camera move is between.
  let canvasMode = false;
  let flying: { from: number; to: number } | null = null;
  let flyTimer: ReturnType<typeof setTimeout> | null = null;
  /** A leave held while the departing slide's exits play (plans/184 R4). */
  let leaveTimer: ReturnType<typeof setTimeout> | null = null;
  // Speaker view (the presenter's private panel: current + next slide previews, notes, timer).
  let speaker: HTMLElement | null = null;
  let speakerRefs: {
    nowSlot: HTMLElement; nextSlot: HTMLElement; nextWrap: HTMLElement;
    notes: HTMLElement; timer: HTMLElement; counter: HTMLElement;
  } | null = null;
  let speakerWin: Window | null = null;      // the SECOND WINDOW (null → in-page fallback)
  let speakerDoc: Document = document;        // the document the panel lives in (popup or main)
  let speakerTimer: ReturnType<typeof setInterval> | null = null;
  let speakerStart = 0;
  const ownedFullscreen = { v: false };

  // Lock page scroll while the modal deck is up; record to restore exactly.
  const htmlEl = document.documentElement;
  const prevOverflow = htmlEl.style.overflow;
  htmlEl.style.overflow = 'hidden';

  function frameIdAt(i: number): string {
    return deck.positions[clampIndex(deck, i)]?.id ?? '';
  }

  // Any frame carrying `data-build` fragments? Skip all build work when none (the common case).
  const deckHasBuilds = cloneByIndex.some((c) => c.querySelector('[data-build]'));

  // ---- Builds (M3): fragment reveals within a slide ----------------------------------
  // Distinct build values on a frame, ascending (equal values reveal together - reveal's
  // data-fragment-index). A box with no build is always visible; `build` (the threshold)
  // reveals every box whose value ≤ it.
  function buildStepsOf(index: number): number[] {
    const clone = cloneByIndex[clampIndex(deck, index)];
    if (!clone) return [];
    const set = new Set<number>();
    for (const bx of clone.querySelectorAll('[data-build]')) {
      const v = Number(bx.getAttribute('data-build'));
      if (Number.isFinite(v) && v >= 1) set.add(v);
    }
    return [...set].sort((a, b) => a - b);
  }
  function maxBuildOf(index: number): number {
    const steps = buildStepsOf(index);
    return steps.length ? steps[steps.length - 1]! : 0;
  }
  function applyBuilds(index: number, threshold: number): void {
    const clone = cloneByIndex[clampIndex(deck, index)];
    if (!clone) return;
    const boxes = [...clone.querySelectorAll<HTMLElement>('[data-build]')];
    let maxShown = 0;
    for (const bx of boxes) {
      const v = Number(bx.getAttribute('data-build')) || 0;
      const shown = v <= threshold;
      bx.classList.toggle('pr-shown', shown);
      bx.classList.remove('pr-current');
      if (shown) maxShown = Math.max(maxShown, v);
    }
    // The most-recently-revealed step is `current` (CSS can emphasise it - reveal's shape).
    if (maxShown > 0) for (const bx of boxes) {
      if ((Number(bx.getAttribute('data-build')) || 0) === maxShown) bx.classList.add('pr-current');
    }
  }

  // Fit scale per clone: min(vw/fw, vh/fh), leaving a small margin so a slide never
  // kisses the screen edge. Recomputed on resize.
  function layoutScales(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (let i = 0; i < cloneByIndex.length; i++) {
      const clone = cloneByIndex[i]!;
      const fw = specs[i]!.w;
      const fh = specs[i]!.h;
      const fit = Math.min(vw / fw, vh / fh) * FLIGHT_MARGIN;
      clone.style.setProperty('--pr-scale', String(fit));
      if (overview) setOverviewTransform(i, vw, vh);
    }
    // The camera frames a frame the same way the stacked stage fits one, so a deck that
    // flies and a deck that pushes show a slide at exactly the same size.
    if (canvasMode) setCamera(cameraFor(frameRect(active), viewport(), FLIGHT_MARGIN), 0);
  }

  /** How much of the viewport the whole deck fills in the overview map. */
  const OVERVIEW_MARGIN = 0.86;

  /** The viewport, in CSS pixels. */
  function viewport(): Viewport { return { w: window.innerWidth, h: window.innerHeight }; }
  /** One frame's authored rectangle on the canvas. */
  function frameRect(i: number): Rect {
    const s = specs[clampIndex(deck, i)]!;
    return { x: s.x, y: s.y, w: s.w, h: s.h };
  }

  // Overview = the authored arrangement (the deck map) scaled to fit the union bbox into
  // the viewport. Columns read as columns - no commercial player has an audience overview.
  // It is `cameraFor` over the union rectangle, which is the SAME placement rule the
  // flight transition flies: one function, so the map and the flight can never disagree
  // which position a frame takes on screen (plan 179 M4 section 7).
  function setOverviewTransform(i: number, vw: number, vh: number): void {
    const cam = cameraFor(unionRect(specs.map((_, k) => frameRect(k))), { w: vw, h: vh }, OVERVIEW_MARGIN);
    const s = specs[i]!;
    // present.css places each page at (--pr-ox,--pr-oy) with transform-origin top-left and
    // scale(--pr-oscale), which is this camera applied per page rather than to a container.
    const clone = cloneByIndex[i]!;
    clone.style.setProperty('--pr-ox', `${cam.tx + s.x * cam.scale}px`);
    clone.style.setProperty('--pr-oy', `${cam.ty + s.y * cam.scale}px`);
    clone.style.setProperty('--pr-oscale', String(cam.scale));
  }

  // ---- The canvas stage (section 7) ---------------------------------------------------
  // For a flight the deck stops being a stack of centred pages and becomes what it was
  // authored as: frames at their own x/y, with ONE transform on the container as the
  // camera. Entering and leaving is a class plus a handful of custom properties, so a deck
  // can mix a flight between two artboards with a plain push everywhere else.
  function setCanvasMode(on: boolean): void {
    if (canvasMode === on) return;
    canvasMode = on;
    stage.classList.toggle('pr-canvas', on);
    if (on) {
      for (let i = 0; i < cloneByIndex.length; i++) {
        const s = specs[i]!;
        cloneByIndex[i]!.style.setProperty('--pr-cx', `${s.x}px`);
        cloneByIndex[i]!.style.setProperty('--pr-cy', `${s.y}px`);
      }
      setCamera(cameraFor(frameRect(active), viewport(), FLIGHT_MARGIN), 0);
    } else {
      framesEl.style.removeProperty('transition-property');
      framesEl.style.removeProperty('transition-duration');
      framesEl.style.removeProperty('transition-timing-function');
      for (const c of cloneByIndex) {
        c.style.removeProperty('--pr-cx');
        c.style.removeProperty('--pr-cy');
      }
    }
  }

  /** Point the camera, taking `ms` to get there (0 = now). The transform itself is
   *  composed in present.css out of these three properties. */
  function setCamera(cam: Camera, ms: number): void {
    framesEl.style.transitionProperty = 'transform';
    framesEl.style.transitionDuration = `${Math.max(0, Math.round(ms))}ms`;
    framesEl.style.transitionTimingFunction = FLIGHT_EASE_CSS;
    framesEl.style.setProperty('--pr-cam-s', String(cam.scale));
    framesEl.style.setProperty('--pr-cam-x', `${cam.tx}px`);
    framesEl.style.setProperty('--pr-cam-y', `${cam.ty}px`);
  }

  // The heart: assign the state-class contract for the whole deck at `active`, in travel
  // direction `dir`. Positional trichotomy from present-math; direction on the root.
  function render(dir: NavDir): void {
    const states = frameStates(deck, active, /* viewDistance */ 1);
    stage.dataset.navDir = dir ?? '';
    for (const st of states) {
      const clone = cloneByIndex[st.index]!;
      clone.classList.toggle('pr-past', st.state === 'past');
      clone.classList.toggle('pr-active', st.state === 'present');
      clone.classList.toggle('pr-future', st.state === 'future');
      clone.classList.toggle('pr-prev', st.isPrev);
      clone.classList.toggle('pr-next', st.isNext);
      clone.classList.toggle('pr-stack', st.isStack);
      // The rendering monopoly: pages beyond the live window unload (a11y.css turns
      // [hidden] into display:none) and leave the a11y tree. The two frames a camera is
      // travelling between are exempt for the length of the flight - the one being left
      // can be well outside the window on a jump, and unloading it mid-move would show
      // the audience an empty canvas rushing past.
      clone.toggleAttribute('hidden', st.hidden && !overview && !inFlight(st.index));
      clone.setAttribute('aria-hidden', st.state === 'present' ? 'false' : 'true');
      clone.tabIndex = st.state === 'present' ? 0 : -1;
      // Builds: the active slide reveals up to `build`; every other slide shows all its
      // fragments (a past slide is complete; a future one arrives complete then resets to 0
      // as it becomes active, so it never flashes empty mid-transition).
      if (deckHasBuilds) applyBuilds(st.index, st.index === active ? build : maxBuildOf(st.index));
    }
    // will-change only on the two pages in flight, dropped after the move settles.
    armWillChange();
    syncSlideMotion();  // the arriving slide's own clock (M4)
    counter.textContent = `${active + 1} / ${deck.count}`;
    conductMedia();     // play the active slide's video, pause the rest
    scheduleAdvance();  // (re)arm the kiosk dwell for the new active frame
    applyFrameState();  // lift the active frame's state tokens onto the stage root
    if (speaker) renderSpeaker(); // keep the presenter panel's current/next previews in step
    onAddress?.(frameIdAt(active), active, build);
  }

  // Per-frame `state` (M4, reveal data-state): the active frame's sanitised tokens become
  // classes on the presenter root, so Custom CSS can theme the whole stage per slide
  // (`.pr-stage.dark …` in present.css, or an author rule). Removed when the frame leaves.
  function applyFrameState(): void {
    for (const cls of appliedState) stage.classList.remove(cls);
    appliedState = [];
    const raw = cloneByIndex[active]?.getAttribute('data-frame-state') ?? '';
    for (const tok of raw.split(/\s+/)) {
      if (/^[a-z0-9-]+$/.test(tok)) { stage.classList.add(tok); appliedState.push(tok); }
    }
  }

  // ---- Per-slide motion, wired to the deck (M4) ---------------------------------------
  /** Is this page one of the two a camera move is currently between? */
  function inFlight(i: number): boolean {
    return !!flying && (flying.from === i || flying.to === i);
  }

  /** Abandon a camera move in progress. Whoever calls this renders next, so the pages the
   *  flight was keeping painted come back under the ordinary window rule. */
  function cancelFlight(): void {
    if (flyTimer) { clearTimeout(flyTimer); flyTimer = null; }
    flying = null;
  }

  /** How long a leaving slide keeps its pose after the swap: the outgoing transition,
   *  plus the same 60ms of slack `armWillChange` leaves. The exits themselves have
   *  already played by the time the swap happens (`goIndex` waits for them, plans/184
   *  R4); this is only when the boxes are handed back. */
  const MOTION_LEAVE_MS = (reduced ? 0 : 460) + 60;

  /**
   * Start the active slide's exits and say how long they take. Zero when there is nothing
   * to wait for: no clock on this slide, reduced motion (exits were stripped), or no box
   * with an Exit still on screen. The clock is woken so the exit plays past the end the
   * session had computed.
   */
  function startLeaving(): number {
    const m = motion;
    const clone = cloneByIndex[active];
    if (!m || m.index !== active || !clone || reduced) return 0;
    const wait = beginExits(clone, m.t());
    if (wait > 0) m.wake();
    return wait;
  }

  /** Drop a held leave: whoever calls this is about to move on its own terms. */
  function cancelLeave(): void {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    delete stage.dataset.prLeaving;
  }

  /** Hand back one leaving slide (or all of them) at once, rather than on its timer. */
  function flushLeaving(index?: number): void {
    for (const entry of [...leaving]) {
      if (index != null && entry.m.index !== index) continue;
      clearTimeout(entry.timer);
      leaving.splice(leaving.indexOf(entry), 1);
      entry.m.teardown();
    }
  }

  /** Open the active slide's motion session, retiring the one before it. */
  function syncSlideMotion(): void {
    if (motion && motion.index === active) { syncBuildStarts(active, build); return; }
    if (motion) {
      const m = motion;
      motion = null;
      m.stop(); // the pose stays on screen while the slide travels out
      const entry = {
        m,
        timer: setTimeout(() => { flushLeaving(m.index); }, MOTION_LEAVE_MS),
      };
      leaving.push(entry);
    }
    // A slide re-entered before its own teardown ran would otherwise be composed by two
    // sessions at once, and the older one's restore would undo the newer one's pose.
    flushLeaving(active);
    motion = openSlideMotion(cloneByIndex[active]!, active, reduced, build);
    // The old fixed build fade is CSS; a slide on the clock hides its fragments through
    // the applier instead, and each one enters with whatever it was authored to.
    stage.classList.toggle('pr-motion', !!motion);
    if (!flying) armSlideMotion();
  }

  /**
   * Start the arriving slide's clock - or hold it, if nobody can see the slide yet.
   *
   * `setOverview` and `setBlackout` pause the session that is open WHEN they run, which
   * is not the same as pausing every session. Several keys navigate without leaving the
   * map (`ArrowUp`, `Home`, `End`, and the controller's `go`), so a slide could arrive
   * behind the overview, start ticking, and have played its whole entrance - or run past
   * `PRESENT_CLOCK_MAX_MS` and stopped - by the time the map came down. The audience then
   * saw the slide snap in at rest, its entrance already spent.
   *
   * `begin()` first, THEN the pause: the clock's own rebase is written for a pause that
   * arrives after it has a t0, and starting paused would carry a small negative offset
   * into the resume.
   */
  function armSlideMotion(): void {
    const m = motion;
    if (!m) return;
    m.begin();
    m.setPaused(overview || blackout || autoPaused);
  }

  /** Release the fragments up to `threshold` at the current clock, and park the rest.
   *  Stepping backwards puts a fragment back to PENDING, so it re-enters if reached again. */
  function syncBuildStarts(index: number, threshold: number): void {
    const m = motion;
    const clone = cloneByIndex[index];
    if (!m || m.index !== index || !clone) return;
    const at = String(m.t());
    const parked = String(PENDING_MS);
    let changed = false;
    for (const box of clone.querySelectorAll<HTMLElement>('[data-build]')) {
      const v = Number(box.getAttribute('data-build')) || 0;
      if (v < 1) continue;
      const isParked = box.getAttribute('data-t-start') === parked;
      if (v <= threshold && isParked) { box.setAttribute('data-t-start', at); changed = true; }
      else if (v > threshold && !isParked) { box.setAttribute('data-t-start', parked); changed = true; }
    }
    if (changed) m.wake();
  }

  // ---- Media conduct (M2) ------------------------------------------------------------
  // Play the ACTIVE slide's video, pause every other. pause() preserves currentTime, so
  // returning to a slide RESUMES rather than restarts (Andy's decision 7) - no extra state.
  // Audio stays muted: mute:false unmuting is deferred (the field defaults to audible, so
  // honouring it literally would blare a whole deck at once - it needs a clearer signal).
  function conductMedia(): void {
    for (let i = 0; i < cloneByIndex.length; i++) {
      // `autoPaused` belongs here as much as blackout does. Pause used to stop the dwell
      // timer and nothing else, so a viewer holding a narrated slide kept listening to it
      // talk to its last word - the one thing the button looked like it would stop.
      const isActive = i === active && !blackout && !overview && !autoPaused;
      // A frame the camera is flying away from stays alive until the move is over: both frames
      // are on screen for the whole move, and a video that froze on take-off would be
      // the one thing the audience is watching.
      const plays = (isActive || (inFlight(i) && !blackout && !overview && !autoPaused));
      for (const v of cloneByIndex[i]!.querySelectorAll<HTMLVideoElement>('video')) {
        if (plays) {
          // Unmute ONLY a box that explicitly opted into present audio (data-present-audio);
          // entering the presenter is a user gesture, so the unmute is allowed. Everything
          // else stays muted - the deck never blares (plan section 8, Andy's opt-in decision).
          v.muted = muted || !isActive || v.getAttribute('data-present-audio') !== '1';
          const p = v.play?.(); if (p && typeof p.catch === 'function') p.catch(() => {});
        } else {
          try { v.muted = true; v.pause(); } catch { /* jsdom / not-ready - never throw */ }
        }
      }
      // Lottie: play the active slide's players, pause the rest (mounted below, async - a
      // marker with no player yet is simply skipped and picked up on the next conduct).
      for (const marker of cloneByIndex[i]!.querySelectorAll('[data-lottie-src]')) {
        const player = lottiePlayerFor(marker);
        if (!player) continue;
        try { plays ? player.play() : player.pause(); } catch { /* never throw out of conduct */ }
      }
      // Narration (plans/180 M-E): a Design audio box renders as a bare `[data-audio-src]`
      // marker, so the presenter gives it an <audio> of its own and conducts it exactly
      // like the video - the ACTIVE slide speaks, every other slide pauses, and pause
      // keeps its position so returning to a slide resumes rather than restarts.
      for (const marker of cloneByIndex[i]!.querySelectorAll<HTMLElement>('[data-audio-src]')) {
        if (!speaksOnItsSlide(marker)) continue;
        // `i !== active` is a slide the deck has LEFT; the active slide with isActive
        // false is the same slide behind a blackout or the map, which only pauses.
        if (isActive) startNarration(marker); else pauseNarration(marker, i !== active);
      }
    }
  }

  // ---- Narration conduct (plans/180 M-E) ---------------------------------------------
  //
  // The clip does not start with the slide: it starts after the LEAD-IN, which is where
  // the dwell solver put it (T2 - the first word must not land while the slide is still
  // arriving). The presenter does not have to be told that number, because the clip's own
  // start already IS it: restampSlideMotion has rewritten the box into slide-local time by
  // the time conductMedia runs, so a narration clip at `leadIn` into its slide carries
  // `data-t-start="<leadIn>"`. One source of truth, no second setting to disagree with.

  /** The <audio> for one marker, made on first use and kept with it for the session. */
  function narrationAudio(marker: HTMLElement): HTMLAudioElement | null {
    const cached = narrationEls.get(marker);
    if (cached) return cached;
    const src = marker.getAttribute('data-audio-src') || '';
    if (!src) return null;
    const audio = marker.ownerDocument.createElement('audio');
    audio.preload = 'auto';
    audio.src = src;
    // Silenced, not stopped, when the viewer asked for quiet: the clip keeps its clock,
    // so `ended` still moves a kiosk deck on and returning to a slide still resumes.
    audio.muted = muted;
    audio.setAttribute('data-narration-audio', '');
    // Inside the marker, which the tool's own stylesheet already hides: an <audio> with
    // no controls draws nothing, and keeping it in the clone means the stage teardown
    // takes it with everything else rather than leaving a player running on a closed deck.
    marker.appendChild(audio);
    // Finished is tracked HERE rather than read off `audio.ended`, because that is the
    // one fact the advance turns on and a media element reports it differently across
    // engines (and not at all in a test realm). A clip that has said its piece does not
    // say it again when the slide is returned to.
    audio.addEventListener('ended', () => {
      narrationPlaying.delete(marker);
      narrationDone.add(marker);
      onNarrationEnded();
    });
    narrationEls.set(marker, audio);
    return audio;
  }

  /** How long after its slide arrives this clip speaks: its own slide-local start. */
  function leadInOf(marker: HTMLElement): number {
    const box = marker.closest?.('.lolly-box') as HTMLElement | null;
    const start = box ? numAttr(box, 'data-t-start', 0) : 0;
    if (!Number.isFinite(start) || start <= 0) return 0;
    // A parked fragment is not a lead-in - it is a clip waiting for a click it will never
    // get, so it stays silent rather than speaking a day from now.
    return start >= PENDING_MS ? -1 : Math.min(start, 60_000);
  }

  /** Speak this marker on the slide the audience is looking at, after its lead-in. */
  function startNarration(marker: HTMLElement): void {
    if (narrationPlaying.has(marker) || narrationDone.has(marker) || narrationTimers.has(marker)) return;
    const audio = narrationAudio(marker);
    if (!audio) return;
    const lead = leadInOf(marker);
    if (lead < 0) return;
    const play = (): void => {
      narrationPlaying.add(marker);
      const p = audio.play?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };
    // Only the FIRST arrival waits: a slide come back to resumes where it was paused,
    // and a second silence there would be heard as the deck hesitating.
    if (lead <= 0 || audio.currentTime > 0) { play(); return; }
    narrationTimers.set(marker, setTimeout(() => { narrationTimers.delete(marker); play(); }, lead));
  }

  /** Take this marker off the air, keeping its position (the video's resume rule). */
  function pauseNarration(marker: HTMLElement, slideLeft = false): void {
    narrationPlaying.delete(marker);
    const timer = narrationTimers.get(marker);
    if (timer) { clearTimeout(timer); narrationTimers.delete(marker); }
    const audio = narrationEls.get(marker);
    if (!audio) return;
    try { audio.pause(); } catch { /* jsdom / not-ready - never throw out of conduct */ }
    // A clip that had already FINISHED goes back to the top when its slide is left, so a
    // looping deck (signage) speaks on every lap rather than going silent after the first.
    // Only on a real slide change: a blackout taken after the last word must not rewind
    // the slide the presenter is still standing on, and speak it again on the way back.
    if (slideLeft && narrationDone.delete(marker)) {
      try { audio.currentTime = 0; } catch { /* not seekable yet - it starts where it starts */ }
    }
  }

  /** Silence, or un-silence, everything the deck plays by itself (`m` / the HUD button). */
  function setMuted(on: boolean): void {
    if (muted === on) return;
    muted = on;
    for (const audio of narrationEls.values()) {
      try { audio.muted = muted; } catch { /* jsdom / not-ready - never throw */ }
    }
    syncMuteBtn();
    // Video mute is decided per box inside the conduct, so it re-reads the flag there.
    conductMedia();
    announce(muted ? t('Narration muted.') : t('Narration unmuted.'));
  }

  function syncMuteBtn(): void {
    if (!btnMute) return;
    const label = muted ? t('Unmute narration') : t('Mute narration');
    btnMute.setAttribute('aria-label', label);
    btnMute.setAttribute('data-tip', label);
    btnMute.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btnMute.innerHTML = icon(muted ? 'volumeOff' : 'volumeOn', { size: 22 });
  }

  /** Stop every clip this session started, and forget the timers (close, and blackout). */
  function stopAllNarration(): void {
    for (const marker of [...narrationPlaying]) pauseNarration(marker);
    for (const [marker, timer] of narrationTimers) { clearTimeout(timer); narrationTimers.delete(marker); }
  }

  /** Is the active slide still speaking? What the kiosk advance waits on (T9). */
  function narrationSpeaking(): boolean {
    const clone = cloneByIndex[active];
    if (!clone) return false;
    for (const marker of clone.querySelectorAll<HTMLElement>('[data-audio-src]')) {
      if (!speaksOnItsSlide(marker)) continue;
      if (narrationTimers.has(marker)) return true;      // still inside its lead-in
      if (narrationPlaying.has(marker)) return true;     // on the air
    }
    return false;
  }

  /** A clip finished. If the dwell already ran out, the tail is the last thing owed. */
  function onNarrationEnded(): void {
    if (!narrationDue || narrationSpeaking()) return;
    narrationDue = false;
    if (narrTailTimer) clearTimeout(narrTailTimer);
    narrTailTimer = setTimeout(() => { narrTailTimer = null; next(); }, narrationTailMs);
  }

  // ---- Kiosk auto-advance (M2): dwell on a frame's dur, then advance; stoppable, with a
  // visible progress bar (reveal's autoSlideStoppable - the polish commercial kiosks lack).
  function clearAdvance(): void {
    if (advTimer) { clearTimeout(advTimer); advTimer = null; }
    if (narrTailTimer) { clearTimeout(narrTailTimer); narrTailTimer = null; }
    narrationDue = false;
    progress.classList.remove('pr-progress-on');
    progressFill.style.transition = 'none';
    progressFill.style.transform = 'scaleX(0)';
  }
  function scheduleAdvance(): void {
    clearAdvance();
    const durMs = deck.positions[active]?.frame.dur ?? 0;
    const atEnd = active === deck.count - 1 && !loop; // last slide, no wrap → stop (don't spin)
    if (!durMs || durMs <= 0 || autoPaused || blackout || overview || atEnd) return;
    progress.classList.add('pr-progress-on');
    progressFill.style.transition = 'none';
    progressFill.style.transform = 'scaleX(0)';
    void progressFill.offsetWidth; // reflow so the fill animation restarts each slide
    progressFill.style.transition = reduced ? 'none' : `transform ${durMs}ms linear`;
    progressFill.style.transform = 'scaleX(1)';
    advTimer = setTimeout(() => { advTimer = null; advanceOrWaitForNarration(); }, durMs);
  }

  /**
   * The dwell ran out. On a narrated slide that is not the whole answer (plans/180 T9).
   *
   * The dwell solver sizes a slide to hold its narration, so the two normally end
   * together - but a clip that started late (decode, a slow fetch) or ran long would be
   * cut off mid-sentence by a timer that never listened to it. So the timer is the FLOOR
   * and the words are the signal: still speaking, and the advance waits for `ended` plus
   * the tail; silent, and it moves on exactly as it always has.
   */
  function advanceOrWaitForNarration(): void {
    if (!narrationSpeaking()) { next(); return; }
    narrationDue = true;
  }
  function syncPauseBtn(): void {
    if (!btnPause) return;
    const label = autoPaused ? t('Resume') : t('Pause');
    btnPause.setAttribute('aria-label', label);
    btnPause.setAttribute('data-tip', label);
    btnPause.innerHTML = icon(autoPaused ? 'play' : 'pause', { size: 22 });
  }
  function togglePause(): void {
    autoPaused = !autoPaused;
    syncPauseBtn();
    // Hold the SOUND too, the way blackout already does. Without this the progress bar
    // froze and the slide stayed put while the voice carried on to its last word.
    conductMedia();
    // …and the slide's own motion, so a build does not run on behind a held deck.
    motion?.setPaused(autoPaused || blackout || overview);
    scheduleAdvance();
    announce(autoPaused ? t('Paused.') : t('Playing.'));
  }

  // ---- Blackout (`b`): a black hold that pauses media + auto-advance; any key resumes.
  function setBlackout(on: boolean): void {
    if (blackout === on) return;
    blackout = on;
    stage.classList.toggle('pr-blackout', on);
    conductMedia();
    scheduleAdvance();
    // The slide's clock holds where it was: a hold taken mid-build must not fast-forward
    // the rest of the slide while nobody can see it.
    motion?.setPaused(blackout || overview || autoPaused);
  }

  function armWillChange(): void {
    if (armTimer) clearTimeout(armTimer);
    const dur = reduced ? 0 : 460;
    for (let i = 0; i < cloneByIndex.length; i++) {
      const near = Math.abs(i - active) <= 1;
      cloneByIndex[i]!.style.willChange = near ? 'transform, opacity' : 'auto';
    }
    armTimer = setTimeout(() => {
      for (const c of cloneByIndex) c.style.willChange = 'auto';
    }, dur + 60);
  }

  // ---- Morph (M5): FLIP matching boxes from the leaving slide to the entering one ------
  function boxEl(clone: HTMLElement, id: string): HTMLElement | null {
    const safe = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(id) : id.replace(/["\\]/g, '\\$&');
    try { return clone.querySelector<HTMLElement>(`.lolly-box[data-box-id="${safe}"]`); } catch { return null; }
  }
  function boxDescriptors(index: number): MorphBox[] {
    const clone = cloneByIndex[clampIndex(deck, index)];
    if (!clone) return [];
    return [...clone.querySelectorAll<HTMLElement>('.lolly-box')].map((b) => {
      const media = b.querySelector<HTMLElement>('video[data-video-key], img[src], [data-lottie-src], [data-anim-src]');
      const imageKey = media?.getAttribute('data-video-key') || media?.getAttribute('src')
        || media?.getAttribute('data-lottie-src') || media?.getAttribute('data-anim-src') || '';
      return {
        id: b.getAttribute('data-box-id') ?? '',
        matchOf: b.getAttribute('data-match'),
        text: b.querySelector('.lolly-box-text')?.textContent ?? '',
        imageKey,
      };
    });
  }
  function morphTo(toIndex: number, dir: NavDir, buildTarget: number): void {
    const fromClone = cloneByIndex[active];
    const pairs = fromClone ? matchMorphBoxes(boxDescriptors(active), boxDescriptors(toIndex)) : [];
    // FIRST - measure the leaving boxes' on-screen rects (that slide is still active).
    const fromRects = new Map<string, DOMRect>();
    if (fromClone) for (const p of pairs) {
      const el = boxEl(fromClone, p.fromId);
      if (el) fromRects.set(p.toId, el.getBoundingClientRect());
    }
    // Switch: `pr-morphing` crossfades the PAGES (both centred) instead of sliding, so only
    // the matched boxes appear to travel.
    stage.classList.add('pr-morphing');
    active = clampIndex(deck, toIndex);
    build = Math.max(0, Math.min(buildTarget, maxBuildOf(active)));
    render(dir);
    // LAST + INVERT + PLAY - animate each entering box from where its partner was.
    const toClone = cloneByIndex[active];
    const pageScale = toClone ? (Number(toClone.style.getPropertyValue('--pr-scale')) || 1) : 1;
    const dur = reduced ? 1 : 520;
    if (toClone) for (const p of pairs) {
      const el = boxEl(toClone, p.toId);
      const from = fromRects.get(p.toId);
      if (!el || !from || !el.getBoundingClientRect) continue;
      const to = el.getBoundingClientRect();
      if (!to.width || !to.height) continue;
      // Screen delta → page-local transform: a box's transform composes with the page's
      // scale(--pr-scale), so a screen translate of `d`px is `d/pageScale` locally; the size
      // ratio is scale-invariant (the page scale cancels).
      const dx = (from.left - to.left) / pageScale;
      const dy = (from.top - to.top) / pageScale;
      el.style.transformOrigin = 'top left';
      el.animate?.(
        [{ transform: `translate(${dx}px,${dy}px) scale(${from.width / to.width},${from.height / to.height})` }, { transform: 'none' }],
        { duration: dur, easing: 'cubic-bezier(0.4,0,0.2,1)', fill: 'backwards' },
      );
    }
    if (morphTimer) clearTimeout(morphTimer);
    morphTimer = setTimeout(() => stage.classList.remove('pr-morphing'), dur + 60);
  }

  /** How long a message stays on the stage before it clears itself. */
  const NOTE_MS = 3600;

  /** Say something to the presenter: on the stage (visible in fullscreen, unlike a
   *  body-level toast) and in the live region (audible to a screen reader).
   *
   *  The stage is usually the PROJECTOR, so the audience reads this too - which is why the
   *  reassuring messages take a shorter `ms` than the ones that report a problem. */
  function note(message: string, ms = NOTE_MS): void {
    noteEl.textContent = message;
    noteEl.hidden = false;
    announce(message);
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      noteTimer = null;
      noteEl.hidden = true;
      noteEl.textContent = '';
    }, ms);
  }

  // ---- Speaker view (M5) -------------------------------------------------------------
  // A presenter-only panel: a large preview of the CURRENT slide, a small preview of what's
  // NEXT, the active frame's speaker `notes`, an elapsed timer, and its own prev/next. It's
  // the slide-preview primitive (`makeSlidePreview`) put to work - a static, scaled re-clone
  // of a frame that reuses the same `.pr-scope` box styling the deck does.
  //
  // DUAL-SCREEN by default: `S` opens the panel in a SECOND WINDOW (`window.open`), so the
  // deck stays on the projector while the presenter reads notes on their laptop. Same-origin,
  // so no postMessage - we hold the window handle and drive its DOM directly; `render()` calls
  // `renderSpeaker()` and it repaints whichever document the panel lives in. If the popup is
  // blocked (or jsdom, which has no `window.open`), it falls back to an IN-PAGE overlay that
  // covers the deck - a rehearsal/notes aid on a single screen.

  /** A static, non-playing re-clone of frame `index`, scaled to FIT a `boxW`×`boxH` slot
   *  (letterboxed to the frame's own aspect), built in `doc` (the deck's window or the popup). */
  function makeSlidePreview(index: number, boxW: number, boxH: number, doc: Document): HTMLElement {
    const i = clampIndex(deck, index);
    const fw = specs[i]?.w || 1;
    const fh = specs[i]?.h || 1;
    const scale = Math.min(boxW / fw, boxH / fh);
    const wrap = doc.createElement('div');
    wrap.className = 'pr-scope pr-preview';
    wrap.style.width = `${Math.round(fw * scale)}px`;
    wrap.style.height = `${Math.round(fh * scale)}px`;
    const src = cloneByIndex[i];
    if (src) {
      // importNode adopts the clone into `doc` (cross-window for the popup; a plain deep clone
      // in the deck's own document) - so a preview works in either window unchanged.
      const clone = doc.importNode(src, true) as HTMLElement;
      clone.removeAttribute('hidden');
      clone.removeAttribute('id');
      // Drop the deck state/placement classes - a preview is a still, top-left, scaled page;
      // the build classes (pr-build/pr-shown) are KEPT so a fragment slide reads as authored.
      clone.classList.remove('pr-page', 'pr-active', 'pr-past', 'pr-future', 'pr-prev', 'pr-next', 'pr-stack');
      clone.style.position = 'absolute';
      clone.style.left = '0';
      clone.style.top = '0';
      clone.style.margin = '0';
      clone.style.transformOrigin = 'top left';
      clone.style.transform = `scale(${scale})`;
      clone.style.opacity = '1';
      clone.style.transition = 'none';
      // A preview never plays: freeze its media so N previews don't spin decoders.
      for (const v of clone.querySelectorAll<HTMLVideoElement>('video')) {
        v.muted = true; v.autoplay = false; v.removeAttribute('autoplay');
        try { v.pause(); } catch { /* not-ready - ignore */ }
      }
      // The narration players are OURS, not the author's markup (see narrationAudio), so a
      // preview drops them outright rather than holding a second copy of the voice track -
      // which would fetch and decode it again, in the popup window as well as this one.
      for (const a of clone.querySelectorAll('[data-narration-audio]')) a.remove();
      wrap.appendChild(clone);
    }
    return wrap;
  }

  function renderSpeaker(): void {
    if (!speaker || !speakerRefs) return;
    // Fall back to the panel's own window dimensions when a slot hasn't been laid out yet.
    const winW = speakerWin ? speakerWin.innerWidth : window.innerWidth;
    const winH = speakerWin ? speakerWin.innerHeight : window.innerHeight;
    const nowW = Math.max(160, speakerRefs.nowSlot.clientWidth || Math.round(winW * 0.5));
    const nowH = Math.max(120, speakerRefs.nowSlot.clientHeight || Math.round(winH * 0.6));
    speakerRefs.nowSlot.replaceChildren(makeSlidePreview(active, nowW, nowH, speakerDoc));
    // Next: walkNext returns the same index at the last slide when not looping → no next.
    const nx = walkNext(deck, active, { loop });
    const noNext = nx === active && !loop;
    speakerRefs.nextWrap.style.visibility = noNext ? 'hidden' : '';
    if (noNext) {
      speakerRefs.nextSlot.replaceChildren();
    } else {
      const nextW = Math.max(120, speakerRefs.nextSlot.clientWidth || Math.round(winW * 0.22));
      const nextH = Math.max(90, speakerRefs.nextSlot.clientHeight || Math.round(winH * 0.22));
      speakerRefs.nextSlot.replaceChildren(makeSlidePreview(nx, nextW, nextH, speakerDoc));
    }
    const notes = cloneByIndex[active]?.getAttribute('data-frame-notes') ?? '';
    speakerRefs.notes.textContent = notes;
    speakerRefs.notes.style.display = notes ? '' : 'none';
    speakerRefs.counter.textContent = `${active + 1} / ${deck.count}`;
  }

  function fmtClock(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    return `${String(m).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
  function tickSpeaker(): void {
    // The heartbeat also reaps a popup that is gone. Two very different reasons, told apart
    // by the probe window (P4): inside it the window never really appeared, so fall back to
    // the in-page panel; after it the presenter closed the thing deliberately, so respect it.
    if (speakerWin && !liveDoc(speakerWin)) {
      const neverAppeared = popupProbe != null;
      closeSpeaker();
      if (neverAppeared && !closed) openSpeakerInPage();
      return;
    }
    if (speakerRefs) speakerRefs.timer.textContent = fmtClock(Date.now() - speakerStart);
  }

  /** Build the panel in `doc`, appended to `host`. Elements are created in `doc` so the popup
   *  gets nodes it owns (icon() returns HTML strings, valid in either document). */
  function buildSpeaker(doc: Document, host: HTMLElement): void {
    const mk = (tag: string, cls: string): HTMLElement => { const n = doc.createElement(tag); n.className = cls; return n; };
    const navBtn = (iconName: string, label: string): HTMLButtonElement => {
      const b = doc.createElement('button');
      b.className = 'pr-hud-btn'; b.type = 'button';
      b.setAttribute('aria-label', label); b.setAttribute('data-tip', label);
      b.innerHTML = icon(iconName as Parameters<typeof icon>[0], { size: 22 });
      return b;
    };
    const root = mk('div', 'pr-speaker');
    const now = mk('div', 'pr-sp-now');
    const nowTag = mk('span', 'pr-sp-tag'); nowTag.textContent = t('Current');
    const nowSlot = mk('div', 'pr-sp-slot');
    now.append(nowTag, nowSlot);
    const aside = mk('div', 'pr-sp-aside');
    const timer = mk('div', 'pr-sp-timer'); timer.textContent = '00:00';
    const nextWrap = mk('div', 'pr-sp-nextwrap');
    const nextTag = mk('span', 'pr-sp-tag'); nextTag.textContent = t('Next');
    const nextSlot = mk('div', 'pr-sp-slot pr-sp-slot-next');
    nextWrap.append(nextTag, nextSlot);
    const notes = mk('div', 'pr-sp-notes');
    const controls = mk('div', 'pr-sp-controls');
    const spPrev = navBtn('chevronLeft', t('Previous'));
    const counter = mk('span', 'pr-sp-counter');
    const spNext = navBtn('chevronRight', t('Next'));
    spPrev.addEventListener('click', () => { wake(); prev(); });
    spNext.addEventListener('click', () => { wake(); next(); });
    controls.append(spPrev, counter, spNext);
    aside.append(timer, nextWrap, notes, controls);
    root.append(now, aside);
    host.appendChild(root);
    speaker = root;
    speakerRefs = { nowSlot, nextSlot, nextWrap, notes, timer, counter };
  }

  /** Prepare a blank popup: full-height dark body, the app's same-origin stylesheets copied in
   *  (so present.css `.pr-speaker*` rules apply), plus the re-scoped tool `.lolly-box` CSS. */
  function setupSpeakerWindow(win: Window): void {
    const d = win.document;
    const theme = document.documentElement.getAttribute('data-theme');
    if (theme) d.documentElement.setAttribute('data-theme', theme);
    d.head.replaceChildren();
    d.body.replaceChildren();
    d.title = t('Speaker view'); // AFTER clearing head - the setter re-creates the <title> element
    // Copy the app's own <style>/<link> - skip anything inside the stage (the box CSS we add
    // fresh below, re-scoped) so we don't double it. This brings present.css `.pr-speaker*`.
    for (const node of Array.from(document.querySelectorAll<HTMLElement>('link[rel="stylesheet"], style'))) {
      if (node.closest('.pr-stage')) continue;
      if (node.tagName === 'LINK') {
        const l = d.createElement('link');
        l.rel = 'stylesheet';
        l.href = (node as HTMLLinkElement).href; // resolved absolute URL - safe against about:blank base
        d.head.appendChild(l);
      } else {
        const s = d.createElement('style');
        s.textContent = node.textContent || '';
        d.head.appendChild(s);
      }
    }
    const box = d.createElement('style');
    box.textContent = collectToolBoxCss();
    d.head.appendChild(box);
    // The popup hosts its own slide clones, so it needs the canvas's brand slots for the
    // same reason the stage does (T7) - a copied stylesheet carries no inline custom property.
    applyScopeVars(d.documentElement, scopeVars);
    // A minimal full-height dark body, appended LAST so it out-ranks the app's own base sheet.
    const base = d.createElement('style');
    base.textContent = 'html,body{margin:0;height:100%;background:#0b0f18;overflow:hidden}';
    d.head.appendChild(base);
  }

  // Keys inside the popup: Esc / S close the panel (not the whole deck); everything else drives
  // the deck through the shared handler, so arrows/space work from either window.
  function onSpeakerKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' || e.key === 's' || e.key === 'S') { e.preventDefault(); closeSpeaker(); return; }
    onKey(e);
  }

  /** How long to wait before deciding an opened popup never really appeared (P4). Some
   *  blockers hand back a live handle and close the window a tick later. */
  const POPUP_PROBE_MS = 500;

  /** The popup's document, or null when the handle is dead, unreachable or was never real. */
  function liveDoc(w: Window | null): Document | null {
    if (!w) return null;
    try { return w.closed ? null : (w.document ?? null); } catch { return null; } // cross-origin about:blank
  }

  /** The per-session bits both hosts share: start the clock, paint, sync the button. */
  function startSpeakerSession(): void {
    speakerStart = Date.now();
    if (speakerTimer) clearInterval(speakerTimer);
    speakerTimer = setInterval(tickSpeaker, 500);
    tickSpeaker();
    renderSpeaker();
    syncSpeakerBtn();
  }

  /** The single-screen fallback: the panel over the deck, in THIS tab. Only ever reached
   *  because the popup failed, so it always says so - the P4 defect was pressing `s`,
   *  getting a silently blocked popup, and seeing nothing at all. */
  function openSpeakerInPage(): void {
    speakerWin = null;
    speakerDoc = document;
    buildSpeaker(document, stage);
    stage.classList.add('pr-speaker-on');
    startSpeakerSession();
    note(t('Popup blocked. Showing the speaker view here.'));
  }

  function toggleSpeaker(): void {
    if (speaker || speakerWin) { closeSpeaker(); return; }
    let win: Window | null = null;
    try { win = window.open('', 'lolly-speaker', 'popup=yes,width=1100,height=760'); } catch { win = null; }
    // A blocker answers in three ways: null, a handle whose document is unreachable, or a
    // window that vanishes a moment later. The first two are visible now; the third needs a
    // probe, so the popup stays the preferred path and the fallback arrives on its own.
    const doc = liveDoc(win);
    if (win && doc) {
      speakerWin = win;
      speakerDoc = doc;
      setupSpeakerWindow(win);
      buildSpeaker(speakerDoc, speakerDoc.body);
      speakerDoc.addEventListener('keydown', onSpeakerKey, true);
      try { win.focus(); } catch { /* focus may be denied - harmless */ }
      startSpeakerSession();
      note(t('Speaker view opened in a new window.'), 2000); // the audience sees this one too
      if (popupProbe) clearTimeout(popupProbe);
      popupProbe = setTimeout(() => {
        popupProbe = null;
        if (closed || !speakerWin) return;
        if (liveDoc(speakerWin)) return;          // still there - nothing to rescue
        closeSpeaker();
        openSpeakerInPage();
      }, POPUP_PROBE_MS);
    } else {
      if (win) { try { win.close(); } catch { /* nothing to close */ } }
      openSpeakerInPage();
    }
  }
  function closeSpeaker(): void {
    if (popupProbe) { clearTimeout(popupProbe); popupProbe = null; }
    if (!speaker && !speakerWin) return;
    if (speakerTimer) { clearInterval(speakerTimer); speakerTimer = null; }
    if (speaker) speaker.remove();
    const w = speakerWin;
    speaker = null;
    speakerRefs = null;
    speakerWin = null;
    speakerDoc = document;
    stage.classList.remove('pr-speaker-on');
    if (w) { try { if (!w.closed) w.close(); } catch { /* already gone */ } }
    syncSpeakerBtn();
  }
  function syncSpeakerBtn(): void {
    const on = !!speaker || !!speakerWin;
    btnSpeaker.classList.toggle('pr-hud-btn-on', on);
    btnSpeaker.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  // ---- Navigation --------------------------------------------------------------------
  /**
   * The transition that governs a move, per plan 179 M4: the EARLIER frame's own
   * `Transition to next` (`data-frame-transition`, stamped by the hook), falling back to
   * the deck's. Both directions read the same frame, so going back plays the move that
   * brought you there, in reverse - a pair of slides has one transition between them, not
   * two. A jump reads the destination's predecessor, which is the transition an author
   * set for arriving at that slide.
   *
   * `custom` means the author is driving the frame's enter/exit from the timeline, so
   * nothing is derived from it here either - it resolves to the deck's.
   */
  function transitionFor(from: number, to: number): string {
    const i = Math.abs(to - from) === 1 ? Math.min(from, to) : Math.max(0, to - 1);
    const own = cloneByIndex[clampIndex(deck, i)]?.getAttribute('data-frame-transition') ?? '';
    const kind = own && own !== 'custom' ? own : docTransition;
    return !kind || kind === 'custom' ? 'slide' : kind;
  }

  // Reveal the active slide's remaining builds before leaving it (`build` = threshold).
  function goIndex(idx: number, dir: NavDir, buildTarget = 0): void {
    const clamped = clampIndex(deck, idx);
    if (clamped === active && dir !== null && buildTarget === build) return;
    if (clamped !== active) {
      // The departing slide's exits play FIRST (plans/184 R4): the swap waits for the
      // longest of them, then runs exactly as it would have. A second move during the
      // wait does not wait again - the newer intent wins and the deck goes now. Andy
      // (2026-09-04): "the wait is fine if the exit is playing".
      if (leaveTimer) cancelLeave();
      else {
        const wait = startLeaving();
        if (wait > 0) {
          stage.dataset.prLeaving = '1';
          leaveTimer = setTimeout(() => { leaveTimer = null; delete stage.dataset.prLeaving; goIndex(idx, dir, buildTarget); }, wait);
          return;
        }
      }
      let kind = transitionFor(active, clamped);
      // A flight is a camera move over the canvas, so it needs both real motion and the
      // stacked stage stood down: a reduced-motion viewer crossfades, and so does a move
      // asked for from the overview (which is already a map of the whole canvas).
      if (kind === 'flight' && (reduced || overview)) kind = 'fade';
      stage.dataset.prTransition = kind;
      if (kind === 'flight') { flyTo(clamped, dir, buildTarget); return; }
      // Advancing out of a flight abandons it: the frames it was holding on screen go
      // back under the ordinary window rule, and the arriving slide's clock is free to run.
      cancelFlight();
      if (canvasMode) setCanvasMode(false);
      // Morph is a slide-to-slide FLIP; reduced motion / overview fall through to a plain render.
      if (kind === 'morph' && !overview && !reduced) { morphTo(clamped, dir, buildTarget); return; }
    }
    active = clamped;
    build = Math.max(0, Math.min(buildTarget, maxBuildOf(active)));
    render(dir);
  }

  /**
   * Fly the camera from the active frame to `toIndex` (section 7, Andy's request).
   *
   * The slide swap is immediate - classes, media and the arriving slide's pose all change
   * on this tick - and only the CAMERA is animated, in one or two legs depending on
   * whether the two frames share the screen (`flightPath` decides, and pins the rule in
   * present-math). The arriving slide's own clock is held until the camera settles, so
   * its boxes animate in where the audience is looking rather than somewhere in transit.
   */
  function flyTo(toIndex: number, dir: NavDir, buildTarget: number): void {
    const from = active;
    const path = flightPath(frameRect(from), frameRect(toIndex), viewport());
    if (!path || path.spans > FLIGHT_MAX_SPANS) {
      // Nothing to fly (a degenerate frame), or so far that the move would read as a
      // whoosh rather than a journey. Crossfade instead and say so in the attribute.
      stage.dataset.prTransition = 'fade';
      if (canvasMode) setCanvasMode(false);
      active = clampIndex(deck, toIndex);
      build = Math.max(0, Math.min(buildTarget, maxBuildOf(active)));
      render(dir);
      return;
    }
    cancelFlight();
    flying = { from, to: clampIndex(deck, toIndex) };
    setCanvasMode(true);
    active = flying.to;
    build = Math.max(0, Math.min(buildTarget, maxBuildOf(active)));
    render(dir);
    let leg = 0;
    const fly = (): void => {
      const phase = path.phases[leg++];
      if (!phase) {
        flyTimer = null;
        flying = null;
        // The pages the flight kept alive can go now, and the slide starts moving. Not a
        // full render: re-running it here would re-arm a kiosk dwell that has been
        // counting down since take-off.
        for (const st of frameStates(deck, active, /* viewDistance */ 1)) {
          cloneByIndex[st.index]!.toggleAttribute('hidden', st.hidden && !overview);
        }
        conductMedia();
        armSlideMotion();
        return;
      }
      setCamera(phase, phase.ms);
      flyTimer = setTimeout(fly, phase.ms);
    };
    fly();
  }

  // Advance a build within a slide until they're exhausted, then move to the next slide.
  function stepBuild(id: string, active_: number, b: number): void {
    build = b;
    applyBuilds(active_, build);
    // On a slide with its own motion this is what actually reveals the fragment: its
    // start becomes NOW, so it enters with whatever it was authored to (M4 T5).
    syncBuildStarts(active_, build);
    onAddress?.(id, active_, build);
  }
  function next(): void {
    if (overview) { setOverview(false); return; }
    const nextStep = buildStepsOf(active).find((v) => v > build);
    if (nextStep != null) { stepBuild(frameIdAt(active), active, nextStep); return; }
    const to = walkNext(deck, active, { loop });
    goIndex(to, navDir(deck.positions[active] ?? null, deck.positions[to] ?? null) ?? 'right', 0);
  }
  function prev(): void {
    if (overview) { setOverview(false); return; }
    if (build > 0) { stepBuild(frameIdAt(active), active, buildStepsOf(active).filter((v) => v < build).pop() ?? 0); return; }
    const to = walkPrev(deck, active, { loop });
    // Backward arrival shows all builds (reveal behaviour).
    goIndex(to, navDir(deck.positions[active] ?? null, deck.positions[to] ?? null) ?? 'left', maxBuildOf(to));
  }
  function stackVert(dir: 'up' | 'down'): void {
    const to = stackStep(deck, active, dir);
    if (to !== active) goIndex(to, dir);
  }
  function go(address: string): void {
    const addr = resolveAddress(address, deck);
    if (!addr.position) return;
    goIndex(addr.position.index, navDir(deck.positions[active] ?? null, addr.position), addr.build ?? 0);
  }

  // ---- Overview ----------------------------------------------------------------------
  function setOverview(on: boolean): void {
    if (overview === on) return;
    overview = on;
    stage.classList.toggle('pr-overview', on);
    if (on && speaker) closeSpeaker(); // two full-screen presenter modes don't co-exist
    // The map is its own camera over the same canvas, so the flight's stage stands down
    // while it is up rather than the two composing into one wrong transform.
    if (on) { cancelFlight(); setCanvasMode(false); }
    motion?.setPaused(on || blackout);
    if (on) {
      // Everything visible in the map; recompute positions, drop hidden. Media + kiosk
      // dwell pause while the map is up (a wall of playing videos would be chaos).
      for (const c of cloneByIndex) c.removeAttribute('hidden');
      layoutScales();
      conductMedia();
      clearAdvance();
    } else {
      render(null); // re-collapse to the co-located stack at the current active
    }
  }

  // ---- Fullscreen --------------------------------------------------------------------
  function enterFullscreen(): void {
    const req = stage.requestFullscreen?.bind(stage);
    if (req) req().then(() => { ownedFullscreen.v = true; }).catch(() => { /* already fills the viewport */ });
  }

  // ---- Idle-hide chrome (woken by pointer, key, focus) -------------------------------
  function wake(): void {
    stage.classList.remove('pr-idle');
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!overview) stage.classList.add('pr-idle'); }, IDLE_MS);
  }

  // ---- Input -------------------------------------------------------------------------
  function isTyping(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function onKey(e: KeyboardEvent): void {
    if (closed || isTyping(e.target)) return;
    wake();
    // Any key resumes from a blackout hold (reveal's `B`): the screen was black, so the
    // keystroke is spent lifting it, not navigating.
    if (blackout) { setBlackout(false); e.preventDefault(); e.stopPropagation(); return; }
    let handled = true;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case ' ': case 'Spacebar':
        overview ? setOverview(false) : next(); break;
      case 'ArrowLeft': case 'PageUp':
        prev(); break;
      case 'ArrowDown':
        overview ? setOverview(false) : stackVert('down'); break;
      case 'ArrowUp':
        stackVert('up'); break;
      case 'Home': goIndex(0, 'left'); break;
      case 'End': goIndex(deck.count - 1, 'right'); break;
      case 'o': case 'O': setOverview(!overview); break;
      case 's': case 'S': toggleSpeaker(); break;
      case 'b': case 'B': setBlackout(true); break;
      case 'k': case 'K': if (deckHasDurs || deckSpeaks) togglePause(); else handled = false; break;
      case 'm': case 'M': if (deckSpeaks) setMuted(!muted); else handled = false; break;
      case 'f': case 'F': enterFullscreen(); break;
      case 'Escape':
        // Esc peels one layer. When the browser owns fullscreen it consumes Escape
        // itself, so we only ever see it for the overview→deck and deck→exit steps.
        if (document.fullscreenElement) { handled = false; break; }
        if (overview) setOverview(false); else close();
        break;
      default: handled = false;
    }
    if (handled) {
      // Capture-phase + stop: a handled deck key never also reaches the free-canvas
      // editor underneath (arrows must not nudge a selected box while presenting).
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // Overview: clicking a frame opens it.
  function onFramesClick(e: MouseEvent): void {
    if (!overview) return;
    const page = (e.target as HTMLElement).closest<HTMLElement>('.pr-page');
    if (!page) return;
    const i = Number(page.dataset.prIndex);
    if (Number.isFinite(i)) { setOverview(false); goIndex(i, null); }
  }

  // ---- Wiring ------------------------------------------------------------------------
  const onResize = () => layoutScales();
  tapPrev.addEventListener('click', () => { wake(); prev(); });
  tapNext.addEventListener('click', () => { wake(); next(); });
  btnPrev.addEventListener('click', () => { wake(); prev(); });
  btnNext.addEventListener('click', () => { wake(); next(); });
  btnOverview.addEventListener('click', () => { wake(); setOverview(!overview); });
  btnSpeaker.addEventListener('click', () => { wake(); toggleSpeaker(); });
  btnPause?.addEventListener('click', () => { wake(); togglePause(); });
  btnMute?.addEventListener('click', () => { wake(); setMuted(!muted); });
  btnExit.addEventListener('click', () => close());
  framesEl.addEventListener('click', onFramesClick);
  document.addEventListener('keydown', onKey, true);
  stage.addEventListener('pointermove', wake);
  stage.addEventListener('pointerdown', wake);
  stage.addEventListener('focusin', wake);
  window.addEventListener('resize', onResize);

  // ---- Go ----------------------------------------------------------------------------
  syncPauseBtn();
  syncMuteBtn();
  build = deckHasBuilds ? Math.max(0, Math.min(initAddr.build ?? 0, maxBuildOf(active))) : 0; // s=h.f deep-link
  layoutScales();
  render(null);
  wake();
  stage.focus({ preventScroll: true });
  enterFullscreen();
  // Hydrate motion content on the clones so it actually plays in present mode: lottie
  // players and animated-SVG markers (video autoplays natively via its markup). Both are
  // async (fetch + inject); re-conduct once mounted so non-active players start paused.
  void Promise.all([
    mountLottiePlayers(framesEl, { isCurrent: () => !closed }),
    mountAnimSvgPlayers(framesEl, { isCurrent: () => !closed }),
  ]).then(() => { if (!closed) conductMedia(); });

  function close(): void {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    if (idleTimer) clearTimeout(idleTimer);
    if (armTimer) clearTimeout(armTimer);
    if (advTimer) clearTimeout(advTimer);
    if (leaveTimer) clearTimeout(leaveTimer);
    if (morphTimer) clearTimeout(morphTimer);
    if (noteTimer) clearTimeout(noteTimer);
    if (narrTailTimer) clearTimeout(narrTailTimer);
    // Silence first, then drop the stage: an <audio> that is playing when its node is
    // removed keeps playing in more than one engine, and a voice still talking over a
    // closed deck is the worst way to find that out.
    stopAllNarration();
    cancelFlight();
    // Every slide clock stops here, including the ones still holding their pose on the way
    // out: each has a session registered with the sequence writers, and a stage that is
    // about to be removed must not leave one behind.
    motion?.teardown();
    motion = null;
    flushLeaving();
    closeSpeaker(); // stops the timer, the popup probe AND closes the second window / overlay
    htmlEl.style.overflow = prevOverflow;
    if (ownedFullscreen.v && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    destroyLottiePlayers(stage); // reap OUR players only - lottie-web's global rAF ticks detached trees otherwise
    stage.remove(); // clones (and their media) die with it; originals are untouched
    onClose?.();
  }

  return {
    close,
    go,
    // Same function the `s` key and the toolbar button call - one implementation, so a
    // caller-opened speaker view and a key-opened one are the same state.
    speaker: () => { if (!closed) toggleSpeaker(); },
    get frameId() { return closed ? null : frameIdAt(active); },
    get overview() { return overview; },
  };
}

/** Gather the tool canvas's `.lolly-box*` layout rules (scoped `#tool-canvas .lolly-box…`)
 *  re-scoped to `.pr-scope` (carried by the deck AND every slide preview), so cloned boxes
 *  position correctly outside the canvas. Structural rules only - the frame/page rules are
 *  excluded because present.css owns page placement; text and colour are inline on the boxes.
 *  Same-origin sheets only; cross-origin `cssRules` access throws and is skipped. Returned as a
 *  string so it can be injected into the stage AND into the speaker popup's document. */
function collectToolBoxCss(): string {
  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin - skip
    if (!rules) continue;
    for (const rule of Array.from(rules)) {
      // @keyframes the shell scoped for the tool's customCss (M4) - copy verbatim; the
      // names are already scoped and the animation-name references below match them.
      if (rule instanceof CSSKeyframesRule) { css += rule.cssText + '\n'; continue; }
      if (!(rule instanceof CSSStyleRule)) continue;
      const sel = rule.selectorText;
      if (!sel || !sel.includes('#tool-canvas')) continue;
      // Skip the frame/page positioning rules - present.css owns page placement, and an
      // unlayered injected copy would out-rank it (position:relative would break centring).
      if (/\.lolly-frames|\.lolly-frame-page/.test(sel)) continue;
      // Everything else: the tool's .lolly-box layout AND the doc-level customCss (both
      // scoped `#tool-canvas …` by the shell), re-scoped onto the present stage.
      css += rule.cssText.split('#tool-canvas').join('.pr-scope') + '\n';
    }
  }
  return css;
}
/** The custom-property namespaces a tool template is allowed to consume: the brand's
 *  semantic colour slots (brand-vars.ts applyBrandVars), the shell's mark/logo vars, and the
 *  typeface stacks. Deliberately NOT everything - the shell's own `:root` shadcn triples
 *  stay where they are, so copying can't redefine chrome tokens on the stage. */
const SCOPE_VAR_RE = /^--(?:brand|lolly|font)-/;

/** Every `--brand-*` / `--lolly-*` / `--font-*` property in force on `el`, as name/value
 *  pairs ready to re-apply elsewhere.
 *
 *  Names are gathered from the INLINE declarations on `el` and its ancestors (applyBrandVars
 *  writes the brand slots straight onto the canvas element; applyChromeBrandVars writes the
 *  typeface stacks onto `<html>`) UNION whatever the computed style is willing to enumerate -
 *  only the newest engines list custom properties there, and jsdom lists none, so neither
 *  source alone is sufficient. Values come from the computed style wherever it answers, so a
 *  token inherited from a stylesheet resolves too. */
function readScopeVars(el: HTMLElement | null): Array<[string, string]> {
  if (!el) return [];
  const vals = new Map<string, string>();
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const decl = node.style;
    for (let i = 0; i < decl.length; i++) {
      const name = decl.item(i);
      // Nearest ancestor wins, exactly as the cascade would resolve it on `el`.
      if (SCOPE_VAR_RE.test(name) && !vals.has(name)) vals.set(name, decl.getPropertyValue(name).trim());
    }
  }
  let computed: CSSStyleDeclaration | null = null;
  try { computed = getComputedStyle(el); } catch { /* no view (detached realm) - inline reading stands */ }
  if (computed) {
    for (let i = 0; i < computed.length; i++) {
      const name = computed.item(i);
      if (SCOPE_VAR_RE.test(name)) vals.set(name, '');
    }
    for (const name of [...vals.keys()]) {
      const v = computed.getPropertyValue(name).trim();
      if (v) vals.set(name, v);
    }
  }
  return [...vals].filter(([, v]) => v !== '');
}

/** Write `vars` onto `target` as inline custom properties (the stage root, or the speaker
 *  popup's `<html>`). */
function applyScopeVars(target: HTMLElement, vars: ReadonlyArray<readonly [string, string]>): void {
  for (const [name, value] of vars) target.style.setProperty(name, value);
}

function injectToolBoxStyles(stage: HTMLElement): void {
  const css = collectToolBoxCss();
  if (css) {
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    stage.appendChild(styleEl);
  }
}

// ---- tiny DOM helpers ----------------------------------------------------------------
function el(tag: string, className: string): HTMLElement {
  const n = document.createElement(tag);
  n.className = className;
  return n;
}
function hudBtn(iconName: string, label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'pr-hud-btn';
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.setAttribute('data-tip', label);
  // icon() returns an inline SVG string; the icon set is camelCase (chevronLeft, …).
  b.innerHTML = icon(iconName as Parameters<typeof icon>[0], { size: 22 });
  return b;
}
