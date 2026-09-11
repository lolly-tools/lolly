// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-dom.ts - putting a timed composition's LIVE DOM at a given time.
 *
 * The single implementation of the phase-1 attribute contract as applied to real
 * elements: which `.lolly-box` is on screen at `t`, and what transform/opacity an
 * enter/exit transition composes on top of that box's AUTHORED inline styles. Two
 * very different callers need exactly this and must never disagree:
 *
 *   • views/sequence-clock.ts - the preview playhead (scrub + play), which imports
 *     everything below rather than owning it. This module was carved OUT of the
 *     clock; the clock re-exports the whole surface, so its public API is unchanged.
 *   • bridge/export.ts renderLive - "Record live" films the real DOM in real time,
 *     and nothing else advances a sequence stage while it does, so the capture has
 *     to drive the playhead itself (`driveSequenceTime`). Without it a live take is
 *     one held frame.
 *
 * The same applier also backs the planned contact-sheet export (`cuts=N`), which
 * walks t across the sequence snapshotting the DOM - hence the general session API
 * rather than anything capture-shaped.
 *
 * NOT the same thing as sequence-plan.ts. That module resolves a layer's state for
 * the CANVAS compositor (a draw plan of numbers, no DOM writes); this one mutates
 * live elements. The two are pinned to each other by tests/sequence-plan.test.ts,
 * which asserts the numeric parity rather than trusting a comment.
 *
 * EVERY WRITE IS REVERSIBLE. One class and SIX inline properties per box - 
 * `transform`, `opacity`, and (only on a stage that authors depth, plans/104)
 * `filter`, `z-index`, `width` and `height` - with the authored values captured before
 * the first write and handed back verbatim on restore (declaration-identical, not
 * byte-identical: writing through CSSStyleDeclaration re-serialises the whole `style`
 * attribute). That list is the WHOLE per-frame surface; anything that photographs a
 * live stage - sequence-render's plate capture, clip-thumbs' borrow, sequence-cuts, and
 * this module's own `driveSequenceTime` - neutralises exactly these, through the
 * read/restore seam below, so a new one arriving here is a change to their contract
 * too.
 *
 * `width`/`height` are THE ONE DELIBERATE EXCEPTION to "the applier never writes
 * layout" (plans/104 section 5.2, the P1 reversal). Every other property here is composited:
 * it changes what the box looks like without changing what the box IS, so a frame
 * costs no reflow. A keyed `w`/`h` costs one, on purpose - text REWRAPS, a border stays
 * one pixel wide, a flex row re-distributes. That is the entire reason the channel
 * exists, and it is why the canvas compositor cannot fake it with a stretched plate and
 * re-photographs a sized layer per frame instead (parity beats speed). The cost is
 * bounded by the same gate as the rest of depth: with no `data-t-kf` mentioning `w`
 * or `h`, `fold.sized` is false everywhere, the two slots stay null and no layout write
 * is ever issued.
 *
 * Composition, not clobbering: a box carries authored inline styles from the tool
 * hook - `transform:rotate(-4deg)`, `opacity:0.8`. An entrance animation adds to
 * those, never replaces them:
 *
 *     translate(dx,dy)  <authored...>  rotate(animRot)  scale(sc)
 *
 * which multiplies out to the same matrix order the video compositor uses
 * (`translate -> rotate(authored+anim) -> scale`), so a scrubbed preview, a live
 * take and a composited render agree. The transition maths itself is IMPORTED from
 * lib/transitions.ts - never re-derived here.
 *
 * DEPTH RIDES THE SAME RULE (plans/104). Keyframe evaluation and the camera
 * projection come from the engine (`evaluateKf`, `projectLayer`, `dofBlur`), folded
 * into per-layer numbers by ONE adapter - `foldKfPose` in sequence-plan.ts - that
 * this module and the canvas planner both call. Neither side owns a formula, so
 * neither side can drift from the other; tests/sequence-plan.test.ts asserts it.
 * A document with no `data-t-z` and no `data-t-kf` never reaches any of it.
 */

import {
  recTransition, isTransitionKind, isSplitTier, isSplitOrder, splitRanks, splitSeedOf,
  splitPhaseWindowMs, splitUnitP, MAX_SPLIT_STAGGER_MS,
  holdPose, isHoldFx, withHold, DEFAULT_HOLD_RATE, MIN_HOLD_RATE, MAX_HOLD_RATE,
  type TransitionKind, type SplitTier, type SplitOrder, type HoldFx,
} from '../lib/transitions.ts';
// The clamps are the bridge-side declarations in sequence-plan.ts (themselves
// mirroring the tool hook + timeline-math). Importing them rather than restating
// them is the point of this module existing - and the same goes for the depth
// adapters below: the keyframe/projection maths is the engine's, and the fold that
// turns it into per-layer numbers belongs to exactly one module.
import {
  MIN_SPEED, MAX_SPEED, MIN_TRANSITION_MS, MAX_TRANSITION_MS,
  REST_TRANSITION, composeFilter, foldKfPose, isProjectable, kfTrackOf,
  planCameraView, readDepthZ, readTiltDeg, splitFilterBlur, viewMoves,
  type SeqPlanEnv,
} from './sequence-plan.ts';
import {
  evaluateKf, kfMatrix3dCss,
  type KfCameraClip, type KfCameraView, type KfMatrix3, type KfTrack,
} from '@lolly/engine';
import { clamp } from '@lolly/engine';

export { MIN_SPEED, MAX_SPEED, MIN_TRANSITION_MS, MAX_TRANSITION_MS };

// ── attribute readers (pure) ────────────────────────────────────────────────

/** One box's timing as the hook stamped it. Milliseconds, except `speed`. */
export interface Timing {
  /** ms */
  start: number;
  /** ms, or null for an open-ended box (no `data-t-dur`). */
  dur: number | null;
  /** ms into the source media at the clip's in-point. */
  clipIn: number;
  /** Playback rate multiplier, 0.25–4. */
  speed: number;
  enter: TransitionKind | null;
  enterMs: number;
  exit: TransitionKind | null;
  exitMs: number;
  /**
   * The authored geometry curve for each preset, as written - a preset name or a CSS
   * cubic-bezier. '' when unauthored, and lib/transitions.ts answers an unparseable
   * one with the preset's own built-in curve, so this is deliberately NOT validated
   * here: there is one validator, and it is the module that consumes it.
   */
  enterEase: string;
  exitEase: string;
  /**
   * Split text animation (plans/175 WP-A): the tier the enter/exit runs per unit at
   * ('' = whole box, the pre-existing behaviour), the start-to-start gap between
   * units, and the order units are dealt in. Only ever non-empty on a box whose hook
   * stamped `data-t-split`, which it does for timed text boxes alone.
   */
  split: SplitTier | '';
  stagger: number;
  splitOrder: SplitOrder;
  /**
   * Hold effect (plans/175 WP-B): a small looping motion while the box is on
   * screen ('' = still, the pre-existing behaviour) and its rate in cycles/sec.
   * Composed with the transition offset via `withHold` - the same fold the
   * planner applies, so preview and export read identical numbers.
   */
  hold: HoldFx | '';
  holdRate: number;
  /** True when the box declared `data-t-mute="1"` (its audio stays silent). */
  mute: boolean;
  /**
   * True when the box declared `data-t-ignored="1"` (transcript strikethrough, plans/174):
   * skipped by playback and export - never on screen, never mixed. The hook has already
   * compressed the surviving clips' `data-t-start`, so a marked box simply drops out.
   */
  ignored: boolean;
  /** Clip volume 0..2 (`data-t-gain`; absent = 1 = as recorded). */
  gain: number;
  /** Stereo pan -1..1 (`data-t-pan`; absent = 0 = centred). Plans/165 WP-5. */
  pan: number;
  /** Duck-to level 0..1 under other audio (`data-t-duck`; absent = 1 = no duck). Plans/165 WP-6. */
  duck: number;
  /** Pitch transpose in semitones (`data-t-pitch`; absent = 0 = as recorded). Plans/165 WP-7b. */
  pitch: number;
  /** Tape-style varispeed (`data-t-varispeed`; absent = pitch preserved). Plans/165 WP-7b. */
  varispeed: boolean;
  /** Audio effect chain (`data-t-fx`, the engine fx grammar; '' = none). Plans/101 section 3.4. */
  fx: string;
  lane: 'seq' | '';
  /**
   * The box's DEPTH in px above the surface (`data-t-z`), held to the engine's own
   * field clamp. 0 - the flat board - is what every document written before
   * plans/104 reads as, and what keeps the projection an exact identity.
   */
  z: number;
  /**
   * The box's own TILT in degrees (`data-t-rx` / `data-t-ry`), held to the same field
   * clamp the planner's reader applies - one `readTiltDeg`, imported, so a
   * hand-authored angle cannot mean two different things to the two evaluators (P2.1).
   * 0 is the flat card, and an `rx`/`ry` token in the track REPLACES the field for its
   * segment, exactly as `z` does.
   */
  rx: number;
  ry: number;
  /**
   * The parsed keyframe track (`data-t-kf`), empty when the box is not keyframed.
   * Parsed through the SHARED cache in sequence-plan.ts, so this reader and the
   * canvas planner get the same frozen array for the same wire string - one parse,
   * one memoised channel index, and no way for the two to read a track differently.
   */
  kf: KfTrack;
  /**
   * True when this element is a `[data-pdf-page]` FRAME PAGE (frames-as-scenes).
   * It is timed like any other element and keeps its transitions - but section 5.4 scopes
   * v1's camera and keyframes to boxes on a `[data-sequence]` stage, so a frame is
   * excluded from the projection. The hooks already refuse to stamp `data-t-z` /
   * `data-t-kf` on one; this is the reader's own half of that contract.
   */
  frame: boolean;
}

function attrNum(el: Element, name: string, fallback: number): number {
  const raw = el.getAttribute(name);
  if (raw == null || raw === '') return fallback;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Read a box's timing off its attributes. Tolerant of everything - a hand-authored
 * URL can put any string in any of these, and the answer must still be a legal
 * Timing rather than a NaN that poisons the playhead.
 */
export function readTiming(el: Element): Timing {
  const durRaw = el.getAttribute('data-t-dur');
  const durNum = durRaw == null || durRaw === '' ? NaN : parseFloat(durRaw);
  const enter = el.getAttribute('data-t-enter');
  const exit = el.getAttribute('data-t-exit');
  return {
    start: Math.max(0, attrNum(el, 'data-t-start', 0)),
    dur: Number.isFinite(durNum) ? Math.max(0, durNum) : null,
    clipIn: Math.max(0, attrNum(el, 'data-clip-in', 0)),
    speed: clamp(attrNum(el, 'data-t-speed', 1), MIN_SPEED, MAX_SPEED),
    enter: isTransitionKind(enter) ? enter : null,
    enterMs: clamp(attrNum(el, 'data-t-enter-ms', 400), MIN_TRANSITION_MS, MAX_TRANSITION_MS),
    exit: isTransitionKind(exit) ? exit : null,
    exitMs: clamp(attrNum(el, 'data-t-exit-ms', 400), MIN_TRANSITION_MS, MAX_TRANSITION_MS),
    enterEase: el.getAttribute('data-t-enter-ease') || '',
    exitEase: el.getAttribute('data-t-exit-ease') || '',
    split: ((): SplitTier | '' => {
      const v = el.getAttribute('data-t-split');
      return isSplitTier(v) ? v : '';
    })(),
    stagger: clamp(attrNum(el, 'data-t-stagger', 60), 0, MAX_SPLIT_STAGGER_MS),
    splitOrder: ((): SplitOrder => {
      const v = el.getAttribute('data-t-split-order');
      return isSplitOrder(v) && v !== '' ? v : '';
    })(),
    hold: ((): HoldFx | '' => {
      const v = el.getAttribute('data-t-hold');
      return isHoldFx(v) ? v : '';
    })(),
    holdRate: clamp(attrNum(el, 'data-t-hold-rate', DEFAULT_HOLD_RATE), MIN_HOLD_RATE, MAX_HOLD_RATE),
    mute: el.getAttribute('data-t-mute') === '1',
    ignored: el.getAttribute('data-t-ignored') === '1',
    gain: clamp(attrNum(el, 'data-t-gain', 1), 0, 2),
    pan: clamp(attrNum(el, 'data-t-pan', 0), -1, 1),
    duck: clamp(attrNum(el, 'data-t-duck', 1), 0, 1),
    pitch: clamp(attrNum(el, 'data-t-pitch', 0), -12, 12),
    varispeed: (el.getAttribute?.('data-t-varispeed') ?? null) === '1',
    fx: (el.getAttribute?.('data-t-fx') ?? '').slice(0, 200),
    lane: el.getAttribute('data-t-lane') === 'seq' ? 'seq' : '',
    z: readDepthZ(el.getAttribute('data-t-z')),
    rx: readTiltDeg(el.getAttribute('data-t-rx')),
    ry: readTiltDeg(el.getAttribute('data-t-ry')),
    kf: kfTrackOf(el.getAttribute('data-t-kf')),
    frame: el.getAttribute('data-pdf-page') != null,
  };
}

/**
 * A box's end in ms. An open-ended box (no authored duration) runs to the end of the
 * sequence - the same reading the tool hook takes when it derives `data-seq-ms`.
 */
export function endOf(timing: Timing, seqMs: number): number {
  if (timing.dur != null) return timing.start + timing.dur;
  return Math.max(timing.start, Number.isFinite(seqMs) && seqMs > 0 ? seqMs : timing.start);
}

/**
 * Is the box on screen at `tMs`? HALF-OPEN `[start, start + dur)` - the frame at
 * exactly `start + dur` belongs to whatever comes next, which is what makes a
 * gapless seq row cut cleanly instead of flashing both clips for one frame.
 */
export function isActiveAt(timing: Timing, tMs: number, seqMs: number): boolean {
  // An ignored (struck-through) box is never on screen - plans/174. It is the one gate
  // for the visual side; the audio scheduler and the export planner carry their own.
  if (timing.ignored) return false;
  // A stage with NO derived sequence has no window for an open-ended box to be outside
  // of, so it is simply on screen. Without this, opening the timeline on an untimed
  // board hid every open-ended box the applier walks: endOf collapses to the start at
  // seqMs 0, the half-open span is empty, and a scenery box that is lifted or tilted
  // (which is what put it in the applier's set) vanished the moment the clock existed.
  if (timing.dur == null && !(Number.isFinite(seqMs) && seqMs > 0)) return true;
  const end = endOf(timing, seqMs);
  // A zero-length box is never on screen (its half-open span is empty), except the
  // degenerate open-ended-at-the-very-end case, which `end > start` already excludes.
  return tMs >= timing.start && tMs < end;
}

/** Which transition is mid-flight at `tMs`, and how far through it is (1 = at rest). */
export interface TransitionAt {
  kind: TransitionKind;
  /** Progress 0→1, in recTransition's convention (0 = fully out, 1 = at rest). */
  p: number;
  /**
   * The authored geometry curve of the phase that WON, so a caller never has to
   * re-derive which of the two eases applies from the kind it was handed (enter and
   * exit can name the same kind, and at a crossfade the kind is not either field's).
   * '' - the unauthored case - is exactly what recTransition ignores.
   */
  ease: string;
}

/**
 * The animation state of an ACTIVE box at `tMs`, or null when it is simply at rest.
 *
 * Enter runs forward from the clip's head; exit runs backward into its tail. When a
 * clip is shorter than its two transitions the windows overlap, and the one that is
 * further from rest wins - the same "whichever is smaller" reading the compositor
 * takes with `min(headP, 1 - exitP)` in bridge/export.ts, resolved to a single kind
 * because a DOM box can only carry one transform.
 */
export function transitionAt(timing: Timing, tMs: number, seqMs: number): TransitionAt | null {
  const local = tMs - timing.start;
  const end = endOf(timing, seqMs);
  let enterP = 1;
  if (timing.enter && timing.enter !== 'none' && local < timing.enterMs) {
    enterP = clamp(local / timing.enterMs, 0, 1);
  }
  let exitP = 1;
  // An open-ended box has no tail to exit into (its end is the sequence's, which
  // moves as the composition is edited), so exits only apply to a bounded box.
  if (timing.exit && timing.exit !== 'none' && timing.dur != null) {
    const remain = end - tMs;
    if (remain < timing.exitMs) exitP = clamp(remain / timing.exitMs, 0, 1);
  }
  if (enterP >= 1 && exitP >= 1) return null;
  return enterP <= exitP
    ? { kind: timing.enter as TransitionKind, p: enterP, ease: timing.enterEase }
    : { kind: timing.exit as TransitionKind, p: exitP, ease: timing.exitEase };
}

// ── split text units (plans/175 WP-A) ───────────────────────────────────────
//
// A box whose hook stamped `data-t-split` animates its enter/exit PER UNIT - the
// `.lly-u` spans the hook wrapped its text in - instead of as one block. The box
// itself stays at rest (the apply loop suppresses its whole-box transition); each
// unit runs the box's own kind for the box's own enterMs/exitMs, offset by its
// dealt rank × stagger. All the arithmetic is lib/transitions.ts's split helpers,
// shared verbatim with the export planner, so preview, export and worker agree.
//
// A null enter kind is the CUT tier: each unit simply appears at its offset -
// split + stagger + "Cut (no animation)" IS the typewriter.

interface SplitUnitsRec {
  /** Invalidation key: order|stagger-independent - ranks depend on order and n only. */
  key: string;
  spans: HTMLElement[];
  ranks: number[];
  /** Each unit's untransformed layout box, measured once (recTransition's w/h). */
  sizes: { w: number; h: number }[];
}

const SPLIT_UNITS = new WeakMap<Element, SplitUnitsRec>();
/** Boxes whose unit spans currently carry our transform/opacity writes. */
const SPLIT_DIRTY = new WeakSet<Element>();

function splitUnitsOf(el: HTMLElement, timing: Timing): SplitUnitsRec | null {
  const spans = el.querySelectorAll?.('.lly-u');
  const n = spans ? spans.length : 0;
  // One unit animates exactly like the whole box - fall back to the block path.
  if (n < 2) return null;
  const key = `${timing.splitOrder}|${n}`;
  let rec = SPLIT_UNITS.get(el);
  if (!rec || rec.key !== key || rec.spans.length !== n || rec.spans[0] !== spans[0]) {
    const list = Array.from(spans) as HTMLElement[];
    rec = {
      key,
      spans: list,
      ranks: splitRanks(timing.splitOrder, n,
        splitSeedOf(el.getAttribute?.('data-box-id') ?? '', n)),
      // A unit is an HTML span (offsetWidth) or, on the shaped glyph tier (plans/175
      // WP-D), an SVG <g> - which has no offset box, so its own bbox stands in.
      sizes: list.map((s) => {
        const bb = (s as unknown as { getBBox?: () => { width: number; height: number } }).getBBox?.();
        return bb ? { w: bb.width || 0, h: bb.height || 0 } : { w: s.offsetWidth || 0, h: s.offsetHeight || 0 };
      }),
    };
    SPLIT_UNITS.set(el, rec);
  }
  return rec;
}

/** Remove every unit-span write this module made under `el`. Cheap when it made none. */
export function clearSplitUnits(el: Element): void {
  if (!SPLIT_DIRTY.has(el)) return;
  SPLIT_DIRTY.delete(el);
  const rec = SPLIT_UNITS.get(el);
  const spans = rec ? rec.spans : Array.from(el.querySelectorAll?.('.lly-u') ?? []) as HTMLElement[];
  for (const s of spans) {
    s.style.removeProperty('transform');
    s.style.removeProperty('opacity');
  }
}

/**
 * Drive one split box's unit spans at `tMs`. Returns 'animating' while a phase
 * window is open, 'rest' when every unit is at rest (writes cleared), and null
 * when the box carries no usable units - the caller then falls back to the
 * whole-box transition exactly as if no tier were authored.
 */
export function applySplitUnits(el: HTMLElement, timing: Timing, tMs: number, seqMs: number): 'animating' | 'rest' | null {
  const units = splitUnitsOf(el, timing);
  if (!units) return null;
  const n = units.spans.length;
  const local = tMs - timing.start;
  const endLocal = endOf(timing, seqMs) - timing.start;
  const enterPhaseMs = timing.enter && timing.enter !== 'none' ? timing.enterMs : 0;
  const enterWin = timing.stagger > 0 || enterPhaseMs > 0
    ? splitPhaseWindowMs(timing.stagger, n, enterPhaseMs) : 0;
  // Exits only apply to a bounded box (transitionAt's own rule).
  const exitKind = timing.exit && timing.exit !== 'none' && timing.dur != null ? timing.exit : null;
  const exitWin = exitKind ? splitPhaseWindowMs(timing.stagger, n, timing.exitMs) : 0;
  const entering = local < enterWin;
  const exiting = exitWin > 0 && endLocal - local < exitWin;
  if (!entering && !exiting) {
    clearSplitUnits(el);
    return 'rest';
  }
  const localIntoExit = local - (endLocal - exitWin);
  for (let i = 0; i < n; i++) {
    const rank = units.ranks[i] as number;
    const size = units.sizes[i] as { w: number; h: number };
    // Progress toward rest for each phase this unit is inside; the one further
    // from rest wins, mirroring transitionAt on the whole box.
    const pEnter = entering ? splitUnitP(local, rank, timing.stagger, enterPhaseMs) : 1;
    const pExit = exiting ? 1 - splitUnitP(localIntoExit, rank, timing.stagger, timing.exitMs) : 1;
    const p = Math.min(pEnter, pExit);
    const kind = pEnter <= pExit ? timing.enter : exitKind;
    const ease = pEnter <= pExit ? timing.enterEase : timing.exitEase;
    const span = units.spans[i] as HTMLElement;
    if (p >= 1) {
      span.style.removeProperty('transform');
      span.style.removeProperty('opacity');
      continue;
    }
    if (!kind || kind === 'none') {
      // The cut tier: out until the unit's offset passes, then simply there.
      span.style.removeProperty('transform');
      span.style.opacity = p > 0 ? '1' : '0';
      continue;
    }
    const off = recTransition(kind, p, size.w, size.h, ease);
    const parts: string[] = [];
    if (off.dx || off.dy) parts.push(`translate(${n3(off.dx)}px, ${n3(off.dy)}px)`);
    if (off.rot) parts.push(`rotate(${n3(off.rot)}deg)`);
    if (off.sc !== 1) parts.push(`scale(${n3(off.sc)})`);
    if (parts.length) span.style.transform = parts.join(' ');
    else span.style.removeProperty('transform');
    span.style.opacity = String(Math.round(clamp(off.alpha, 0, 1) * 10000) / 10000);
  }
  SPLIT_DIRTY.add(el);
  return 'animating';
}

/**
 * The render-side entry (the live-raster tier): read the box's own attributes and
 * drive its units at `tMs`. Returns applySplitUnits' answer so the caller can key
 * its plate memo on "animating" vs "at rest".
 */
export function applySplitAt(el: HTMLElement, tMs: number, seqMs: number): 'animating' | 'rest' | null {
  const timing = readTiming(el);
  if (!timing.split) return null;
  return applySplitUnits(el, timing, tMs, seqMs);
}

// ── style composition (pure) ────────────────────────────────────────────────

const n3 = (v: number): string => String(Math.round(v * 1000) / 1000);

/**
 * Build the inline transform for an animating box: the animation's translation
 * OUTSIDE the authored transform, its extra rotation and scale INSIDE it.
 *
 * List order is outermost-first in CSS, so this multiplies out to
 * `translate → rotate(authored + anim) → scale`, matching the compositor's canvas
 * order exactly (bridge/export.ts drawObject). Putting the animation's rotate after
 * the authored one is what keeps a box the user rotated by hand spinning about its
 * own centre rather than swinging around the authored angle.
 *
 * P2 - `m3` is the TILTED camera's element-local homography (plans/104 section 6.4), and it
 * takes the leading translate's place and nothing else's. It sits exactly where the
 * translate sat because that is what it generalises: at `rx = ry = 0` the engine's
 * matrix IS `translate(dx, dy)` (a pinned golden), so the authored transform, the
 * rotation and the scale keep composing against it in the order they always did. Null
 * - every camera before this milestone - reproduces the previous string byte for byte,
 * which is the whole reason the parameter is optional and defaulted rather than
 * threaded through every call site.
 *
 * ONE `matrix3d` PER ELEMENT, AND THE ELEMENT STAYS FLAT. The matrix carries its own
 * perspective divide, so no ancestor may declare `perspective` or
 * `transform-style: preserve-3d` - the Cover Flow rule (`parseCssMatrix` refuses a real
 * 3D context, and a walker capture of one comes out mis-scaled or blank).
 */
export function composeTransform(
  authored: string,
  tr: { dx: number; dy: number; sc: number; rot: number },
  m3: KfMatrix3 | null = null,
): string {
  const parts: string[] = [];
  let auth = (authored || '').trim();
  if (m3) {
    parts.push(kfMatrix3dCss(m3));
    // P2.1 - the box's own tilt is already INSIDE the matrix (the fold composed it from
    // data-t-rx/-ry), and the hook bakes the same tilt into the authored string so an
    // untimed board and a still export render it with no engine at all. Re-emitting that
    // baked group here would apply the tilt twice, so the hook's one canonical prefix is
    // stripped. Anchored (^) and shaped exactly as boxCss writes it - a user cannot
    // author it (box transforms are hook-generated), and any m3 implies the fold ran
    // over this element's own attributes, so the prefix is stale by construction.
    auth = auth.replace(/^perspective\(\d+(?:\.\d+)?px\)(?:\s+rotate[XY]\(-?[\d.]+deg\))+\s*/, '');
  } else if (tr.dx || tr.dy) parts.push(`translate(${n3(tr.dx)}px, ${n3(tr.dy)}px)`);
  if (auth && auth !== 'none') parts.push(auth);
  if (tr.rot) parts.push(`rotate(${n3(tr.rot)}deg)`);
  if (tr.sc !== 1) parts.push(`scale(${n3(tr.sc)})`);
  return parts.join(' ');
}

/** Multiply an authored opacity string by the animation's alpha. */
export function composeOpacity(authored: string, alpha: number): string {
  const base = authored === '' || authored == null ? 1 : parseFloat(authored);
  const b = Number.isFinite(base) ? base : 1;
  return String(Math.round(clamp(b * alpha, 0, 1) * 10000) / 10000);
}

// ── the authored-style store ────────────────────────────────────────────────

interface Authored {
  transform: string;
  opacity: string;
  /**
   * The authored inline `filter`, and the two halves it comes apart into: the blur
   * radius the fold adds to, and everything else (today the `shadow`/`depth`
   * drop-shadow) which is re-composed after it. Split once, on capture, because the
   * split is a regex and this record outlives every frame.
   */
  filter: string;
  filterBlur: number;
  filterRest: string;
  /** The authored inline `z-index` ('' = auto, which is what every box ships with). */
  zIndex: string;
  /**
   * The authored inline `width`/`height` DECLARATIONS ('' = none, i.e. the box sizes
   * itself). Kept as strings beside the measured numbers below because restoring has
   * to hand back the declaration, not a re-spelling of the measurement: a box that
   * shipped `width:auto` must end up with no inline width at all.
   */
  width: string;
  height: string;
  /** Layout size, measured BEFORE any transform was written (rects lie afterwards). */
  w: number;
  h: number;
  /**
   * The AUTHORED position, px - read from the inline style, which is exactly where
   * the canvas planner reads it (`stylePx(el,'left')`). The projection anchors on the
   * box's authored centre, so the two evaluators have to agree about where that is;
   * a measured `offsetLeft` would answer relative to whatever ancestor happens to be
   * positioned, which the planner never sees.
   */
  left: number;
  top: number;
  /** Last strings we wrote, so a steady frame costs zero style writes. */
  lastTransform: string | null;
  lastOpacity: string | null;
  lastFilter: string | null;
  lastZIndex: string | null;
  lastWidth: string | null;
  lastHeight: string | null;
  /** Audio boxes render nothing visible - never worth a transform. */
  audio: boolean;
  /**
   * Camera markers render nothing visible either (plans/104 section 5.4): a camera is a
   * timeline citizen that carries a POSE, not a picture. Mirrors `audio` exactly - 
   * no transform, no filter, no z-index, no projection - because the audio exclusion
   * only ever worked because both evaluators actively detect it.
   */
  camera: boolean;
  /**
   * This element is part of the stage's BACKGROUND PLANE, not a layer of its own
   * (plans/104 section 5.5) - see `isBackgroundPlane`.
   *
   * It IS projected: the export draws the bg plate through the same `projectLayer`
   * every layer goes through, so the preview has to move it too or a pan slides the
   * composition across frozen wallpaper. What it must never do is take a RANK: the
   * compositor draws the background before the first layer, unconditionally, so a
   * sunken box (`z: -200`) belongs above it. Ranking the plane among the layers would
   * put the connector artwork over that box in the preview and under it in the export.
   */
  plane: boolean;
}

/**
 * Remembers each touched element's original inline transform/opacity so every write
 * is reversible. Keyed by element, so an innerHTML rebuild (which mints brand-new
 * nodes) can never hand a stale authored value to a fresh box - `prune` simply drops
 * the entries whose elements are gone.
 */
export interface AuthoredStore {
  get(el: HTMLElement): Authored;
  /**
   * The authored values this store holds for `el`, WITHOUT capturing them if it does
   * not - the read a photographer takes (plans/104 section 6 point 0). `get` would capture
   * whatever is on the element right now, which mid-keyframe is the applier's own
   * composed pose: exactly the value that must never be mistaken for the authored one.
   */
  peek(el: HTMLElement): AuthoredStyle | null;
  /** Put one element back exactly as it was found. */
  restore(el: HTMLElement): void;
  /** Put everything back and forget it. */
  restoreAll(): void;
  /** Forget entries for elements not in `keep` (they were destroyed by a repaint). */
  prune(keep: Set<HTMLElement>): void;
  size(): number;
}

/**
 * One element's AUTHORED inline styles - the four properties the applier composes
 * over - as a reader outside this module sees them.
 *
 * `''` means "no inline declaration", which is not the same as a neutral value: a
 * box with no authored `filter` must be photographed with `filter:none`, and one with
 * `blur(2px)` authored must be photographed with `blur(2px)` - never with whatever the
 * playhead happened to compose.
 */
export interface AuthoredStyle {
  transform: string;
  opacity: string;
  filter: string;
  zIndex: string;
  /**
   * The authored inline `width`/`height` declarations - '' when the box sizes itself.
   * A photographer that neutralises on a CLONE has to know these, because a keyed
   * `w`/`h` is a real layout write (see the header): without them a thumbnail taken
   * mid-keyframe would be shot at the stretched size, re-wrapping its text.
   */
  width: string;
  height: string;
  /** True when the applier has actually written at least one of the six. */
  written: boolean;
}

/** The authored inline `left`/`top`, the planner's own read, with a layout fallback. */
function authoredOrigin(el: HTMLElement): { left: number; top: number } {
  const l = parseFloat(el.style?.left || '');
  const t = parseFloat(el.style?.top || '');
  return {
    left: Number.isFinite(l) ? l : (el.offsetLeft || 0),
    top: Number.isFinite(t) ? t : (el.offsetTop || 0),
  };
}

function measure(el: HTMLElement): { w: number; h: number } {
  // offsetWidth/Height is the UNTRANSFORMED layout box; getBoundingClientRect is not
  // (it returns the transformed bbox, which would feed our own animation back into
  // itself frame after frame). jsdom reports 0 for both, hence the style fallback.
  const w = el.offsetWidth || parseFloat(el.style.width) || 0;
  const h = el.offsetHeight || parseFloat(el.style.height) || 0;
  return { w: Number.isFinite(w) ? w : 0, h: Number.isFinite(h) ? h : 0 };
}

// ── the live pose, readable from outside (plans/104 section 6.5) ─────────────
//
// An EDITOR drawing chrome over a posed stage - the selection outline, the resize
// handles - has to place it where the box actually is, and section 6.5's rule is that it
// gets there through "the same fold the applier used", never through a second
// evaluation of the same track. Re-deriving is what the whole `foldKfPose` seam exists
// to prevent, and an editor has no honest way to do it anyway: it holds the model, not
// the parsed layers, and the pose it would have to reproduce includes the transition
// state and the camera as well as the keyframes.
//
// So the applier publishes what it just wrote, keyed by element. A WeakMap because the
// key is a DOM node that a repaint destroys; the entry is dropped the moment the pose
// comes off (see `put` and the apply loop's else branch), so "no entry" and "not posed"
// are the same answer and a stale pose can never outlive the write that made it.
const LIVE_POSE = new WeakMap<Element, SequencePose>();

/**
 * The pose the applier currently has one element in - {@link KfFold}'s displacement
 * half, relative to the box's AUTHORED rect.
 *
 * Everything here is what `composeTransform` put in the inline transform, in the units
 * it put it there: `dx`/`dy` are the leading `translate` (stage-native px, applied
 * OUTSIDE the box's own rotation), `sc` the trailing `scale`, `rot` the extra
 * `rotate` composed after the authored one. `w`/`h` are the layout size at this
 * instant, which is the box's own unless the track keyed one (`sized`).
 */
export interface SequencePose {
  dx: number;
  dy: number;
  sc: number;
  rot: number;
  w: number;
  h: number;
  /** True when `w`/`h` are a KEYED size, i.e. the applier wrote the layout box too. */
  sized: boolean;
  /**
   * True when the pose rides a homography - a TILTED camera's (P2) or the box's own
   * tilt (P2.1) - so `dx`/`dy`/`sc`
   * describe the projected CENTRE and its magnification but NOT the quad the element
   * paints. A caller drawing geometry from this gets the projected-AABB approximation
   * section 6.5 allows for tilt, not the trapezoid.
   */
  tilted: boolean;
}

/**
 * The pose {@link SequencePose} describes for `el`, or null when the applier has it at
 * rest (or has never touched it). The read costs one WeakMap lookup and no layout.
 */
export function sequencePoseOf(el: Element | null | undefined): SequencePose | null {
  return (el && LIVE_POSE.get(el)) || null;
}

export function createAuthoredStore(): AuthoredStore {
  const map = new Map<HTMLElement, Authored>();
  const put = (el: HTMLElement, rec: Authored): void => {
    // Restoring an EMPTY authored value must remove the property, not set it to '',
    // or the box keeps a `transform:;` declaration it never had. Both writes are
    // skipped when the value already matches: touching a CSSStyleDeclaration
    // re-serialises the whole `style` attribute, and a no-op restore should not even
    // reflow the attribute string.
    if (el.style.transform !== rec.transform) {
      if (rec.transform) el.style.transform = rec.transform; else el.style.removeProperty('transform');
    }
    if (el.style.opacity !== rec.opacity) {
      if (rec.opacity) el.style.opacity = rec.opacity; else el.style.removeProperty('opacity');
    }
    // `filter` and `z-index` join the surface only on a depth stage, so on every
    // other document `lastFilter`/`lastZIndex` stay null and these two comparisons
    // are the only trace this feature leaves on the restore path.
    if (el.style.filter !== rec.filter) {
      if (rec.filter) el.style.filter = rec.filter; else el.style.removeProperty('filter');
    }
    if (el.style.zIndex !== rec.zIndex) {
      if (rec.zIndex) el.style.zIndex = rec.zIndex; else el.style.removeProperty('z-index');
    }
    // The layout pair, and the only two writes here that cost a reflow - so they are
    // skipped unless this element actually carries one of ours. On every document that
    // keyframes no size `lastWidth`/`lastHeight` stay null forever and these two
    // branches are never entered at all.
    if (rec.lastWidth !== null && el.style.width !== rec.width) {
      if (rec.width) el.style.width = rec.width; else el.style.removeProperty('width');
    }
    if (rec.lastHeight !== null && el.style.height !== rec.height) {
      if (rec.height) el.style.height = rec.height; else el.style.removeProperty('height');
    }
    rec.lastTransform = null;
    rec.lastOpacity = null;
    rec.lastFilter = null;
    rec.lastZIndex = null;
    rec.lastWidth = null;
    rec.lastHeight = null;
    // The published pose comes off with the styles that expressed it - here rather
    // than at each of `restore`/`restoreAll`'s call sites, so a writer that stands
    // down for an export (see `withAuthoredDom`) cannot leave an editor drawing chrome
    // at a pose the DOM no longer holds.
    LIVE_POSE.delete(el);
    // The unit spans come clean with the box (plans/175): a plate photographed
    // through `withAuthoredDom` must show the text at rest, not mid-typewriter.
    clearSplitUnits(el);
  };
  return {
    get(el) {
      let rec = map.get(el);
      if (!rec) {
        const size = measure(el);
        const origin = authoredOrigin(el);
        const filter = el.style.filter || '';
        const fx = splitFilterBlur(filter);
        rec = {
          transform: el.style.transform || '',
          opacity: el.style.opacity || '',
          filter,
          filterBlur: fx.blur,
          filterRest: fx.rest,
          zIndex: el.style.zIndex || '',
          width: el.style.width || '',
          height: el.style.height || '',
          w: size.w,
          h: size.h,
          left: origin.left,
          top: origin.top,
          lastTransform: null,
          lastOpacity: null,
          lastFilter: null,
          lastZIndex: null,
          lastWidth: null,
          lastHeight: null,
          audio: !!el.querySelector('.lolly-box-audio'),
          camera: !!(el.matches?.('[data-cam]') || el.querySelector?.('[data-cam]')),
          plane: isBackgroundPlane(el),
        };
        map.set(el, rec);
      } else {
        // `left`/`top` are NEVER part of the composed surface - the applier writes
        // transform/opacity/filter/z-index and nothing else - so the inline
        // declaration is always the authored one and re-reading it is free (a string
        // parse; no layout, and no fallback to `offsetLeft` here for exactly that
        // reason). It has to be re-read because free-canvas moves a box during a
        // gesture by writing `left`/`top` straight onto the element with no model
        // write and no repaint: a cached origin would parallax a dragged lifted box
        // from its PRE-drag centre and lag the pointer.
        const l = parseFloat(el.style?.left || '');
        const t = parseFloat(el.style?.top || '');
        if (Number.isFinite(l)) rec.left = l;
        if (Number.isFinite(t)) rec.top = t;
        if (!rec.w || !rec.h) {
          // First measurement happened before layout (a box measured during the same
          // frame it was painted). Re-measure until it answers, but only while we have
          // written nothing - after that the rect would include our own transform, or
          // (since the `w`/`h` channels landed) our own stretched layout box, which
          // would then become the AUTHORED size every later frame tweens from.
          if (rec.lastTransform == null && rec.lastWidth == null && rec.lastHeight == null) {
            const size = measure(el);
            if (size.w) rec.w = size.w;
            if (size.h) rec.h = size.h;
          }
        }
      }
      return rec;
    },
    peek(el) {
      const rec = map.get(el);
      if (!rec) return null;
      return {
        transform: rec.transform,
        opacity: rec.opacity,
        filter: rec.filter,
        zIndex: rec.zIndex,
        width: rec.width,
        height: rec.height,
        written: rec.lastTransform !== null || rec.lastOpacity !== null
          || rec.lastFilter !== null || rec.lastZIndex !== null
          || rec.lastWidth !== null || rec.lastHeight !== null,
      };
    },
    restore(el) {
      const rec = map.get(el);
      if (rec) put(el, rec);
    },
    restoreAll() {
      for (const [el, rec] of map) put(el, rec);
      map.clear();
    },
    prune(keep) {
      for (const el of [...map.keys()]) if (!keep.has(el)) map.delete(el);
    },
    size: () => map.size,
  };
}

// ── the live-writer registry (the export-time read/restore seam) ────────────
//
// THE PROBLEM (plans/104 section 6 point 0, the review's top finding, found twice).
// `renderSequence` parses and PHOTOGRAPHS the live artboard - the same artboard the
// preview clock has been writing on. Every read it takes is an authored read:
// `readLayer` takes the box's rotation off `style.transform`, its opacity off
// `style.opacity`, its blur off `style.filter` (sequence-plan.ts:225-231). Before
// plans/104 those writes were brief transition windows, so an export taken mid-fade
// was a little wrong in a way nobody had measured. Under keyframes nearly every t has
// a composed transform, opacity and filter on nearly every box, and the failure is
// total: authored geometry read PRE-PROJECTED and then projected again, a keyframed
// blur baked into the plate AND applied again by the executor. The playhead can be
// parked anywhere when an export starts, which is what makes this a correctness bug
// rather than a nicety.
//
// THE FIX, and why it is a registry. The authored values are not on the DOM - that is
// the whole point of the AuthoredStore - and the exporter is three modules away from
// the clock that holds them. So every live writer (the preview clock, each
// `createSequenceTime` session) announces itself here, and anything that READS or
// PHOTOGRAPHS the stage asks the registry to make the DOM authored again first:
//
//   • `withAuthoredDom(root, fn)` - the whole-export scope. Every writer over `root`
//     stands down (its writes handed back) AND STAYS DOWN for the duration, because an
//     rAF tick landing mid-export would otherwise re-pose the stage between two plate
//     shots. Balanced, so nested scopes compose; the writers re-assert on the way out.
//     Used by `renderSequence` (the whole film) and by `renderSequenceCuts` (all N
//     stills of a contact sheet) - a reader that opens its OWN session on the same
//     root needs it as much as a photographer does, because that session's
//     AuthoredStore captures whatever is on the element the first time it touches it.
//   • `beginAuthoredDom(root)` - the same scope opened and closed by hand, for a
//     reader whose span is not one function call: `driveSequenceTime`'s live take runs
//     between `start()` and `stop()` on somebody else's timer.
//   • `authoredStyleOf(el)` - the non-mutating read, for a photographer that can
//     neutralise on its own CLONE instead (clip-thumbs' dom-to-image `style` override).
//     Nothing on the live stage moves, so a thumbnail shot cannot flicker the editor.
//   • `borrowAuthoredPose(el)` - one element restored in place, for a reader that walks
//     the LIVE subtree and has no clone to neutralise (the vector twin).
//
// A writer that has written nothing costs every one of these exactly one Set iteration
// over an empty-or-tiny registry: a document with no clock (a CLI render, a headless
// test, an export of a stage nobody ever played) takes the identical path it took
// before this existed.

/**
 * A live composer of per-frame writes - the preview clock, or a `createSequenceTime`
 * session - as the read/restore seam sees it.
 */
export interface SequenceWriter {
  /** The subtree this writer composes over. */
  root: HTMLElement;
  /** The authored values it is composing against. */
  store: AuthoredStore;
  /**
   * Stop / allow this writer's per-frame writes. Called by the registry ONLY, and
   * balanced by it: while paused, `apply`-shaped calls must write nothing at all
   * (a paused clock keeps its clock, it just stops touching the DOM).
   */
  setPaused(paused: boolean): void;
  /** Re-assert this writer's own current time. Must be a no-op while paused. */
  reapply(): void;
}

const WRITERS = new Set<SequenceWriter>();
/** How many scopes are currently holding each writer down. */
const SUSPENDED = new WeakMap<SequenceWriter, number>();

/**
 * Announce a live writer. Returns the deregistration - call it when the writer stops
 * writing for good (a clock's `destroy`, a session's `restore`), never merely when it
 * pauses, or a photographer would stop being able to find its authored values.
 */
export function registerSequenceWriter(w: SequenceWriter): () => void {
  WRITERS.add(w);
  return () => { WRITERS.delete(w); };
}

/** Writers whose subtree overlaps `root` in either direction. */
function writersOver(root: HTMLElement | null): SequenceWriter[] {
  if (!root || !WRITERS.size) return [];
  const out: SequenceWriter[] = [];
  for (const w of WRITERS) {
    const r = w.root;
    if (!r) continue;
    if (r === root || root.contains?.(r) || r.contains?.(root)) out.push(w);
  }
  return out;
}

/** Writers that hold a record for `el` (whether or not they have written to it yet). */
function writersHolding(el: HTMLElement | null): { w: SequenceWriter; authored: AuthoredStyle }[] {
  if (!el || !WRITERS.size) return [];
  const out: { w: SequenceWriter; authored: AuthoredStyle }[] = [];
  for (const w of WRITERS) {
    const authored = w.store.peek(el);
    if (authored) out.push({ w, authored });
  }
  return out;
}

function suspendWriter(w: SequenceWriter): void {
  const depth = SUSPENDED.get(w) ?? 0;
  SUSPENDED.set(w, depth + 1);
  if (depth === 0) {
    w.setPaused(true);
    // The authored styles go back; the `.seq-off` visibility does NOT. Hiding is
    // applied, not composed, and every photographer already strips it per shot
    // (`rasterBox`, `borrowVisibility`) - lifting it here would un-hide the whole
    // composition on the live stage for the length of an export.
    w.store.restoreAll();
  }
}

function resumeWriter(w: SequenceWriter): void {
  const depth = SUSPENDED.get(w) ?? 0;
  if (depth > 1) { SUSPENDED.set(w, depth - 1); return; }
  SUSPENDED.set(w, 0);
  w.setPaused(false);
  w.reapply();
}

/**
 * Run `fn` with `root` showing its AUTHORED pose - every live writer over it stood
 * down, and held down until `fn` settles.
 *
 * This is the scope an export runs inside. It restores on every path including a
 * throw, and it re-asserts the writers afterwards, so a failed export leaves the
 * editor exactly where the user left it (the same contract `session.restore()` in
 * sequence-cuts has always had).
 */
export async function withAuthoredDom<T>(root: HTMLElement, fn: () => T | Promise<T>): Promise<T> {
  const release = beginAuthoredDom(root);
  try {
    return await fn();
  } finally {
    release();
  }
}

/**
 * The same scope, opened and closed BY HAND - for a reader whose span is not one
 * function call.
 *
 * `driveSequenceTime` is the case that forces it: a live capture's authored window
 * opens at `start()` and closes at `stop()`, with the frames in between arriving on
 * someone else's timer, so there is no `fn` to wrap. Idempotent release, because
 * `stop()` is documented idempotent and safe before `start()`.
 *
 * The writers held are snapshotted HERE, before the caller opens its own session, so
 * a session created inside the scope is not itself suspended and writes normally - 
 * which is the whole point: the scope stands the OTHER writers down (the preview
 * clock), it does not stop the reader from composing.
 */
export function beginAuthoredDom(root: HTMLElement): () => void {
  const held = writersOver(root);
  for (const w of held) suspendWriter(w);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    // Reverse order, so nested scopes unwind the way they wound up.
    for (const w of [...held].reverse()) {
      try { resumeWriter(w); } catch { /* one writer's repaint must not strand the others */ }
    }
  };
}

/**
 * The authored inline styles a live writer is composing over on `el`, or null when
 * nobody is writing on it.
 *
 * Null is the byte-identity answer: no writer, or a writer that has not written to
 * this element, means the DOM already IS authored and a caller must change nothing.
 */
export function authoredStyleOf(el: HTMLElement | null | undefined): AuthoredStyle | null {
  for (const { authored } of writersHolding(el ?? null)) {
    if (authored.written) return authored;
  }
  return null;
}

/**
 * Put ONE element back to its authored pose in place, and hand back the undo.
 *
 * For a reader that walks the LIVE subtree and has no clone to neutralise on (the
 * timeline's vector twin). The release re-asserts each writer at its own current time
 * rather than re-writing the old values, so a playhead that moved during the read
 * lands on the right pose instead of a stale one. A no-op - down to the returned
 * closure - when nothing was written on `el`.
 */
export function borrowAuthoredPose(el: HTMLElement | null | undefined): () => void {
  const held = writersHolding(el ?? null).filter((h) => h.authored.written);
  if (!held.length) return () => { /* nothing composed here: nothing to borrow */ };
  for (const { w } of held) w.store.restore(el as HTMLElement);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    for (const { w } of held) {
      try { w.reapply(); } catch { /* a repaint mid-shot is the writer's problem, not the shot's */ }
    }
  };
}

// ── applyTime, against a plain element list ─────────────────────────────────

/** Everything applyTime needs beyond the elements themselves. */
export interface ApplyCtx {
  /** Sequence length in ms (for open-ended boxes and the exit tail). */
  seqMs: number;
  store: AuthoredStore;
  /**
   * Called once per timed box after its visual state is settled, so the caller can
   * drive that box's media (a <video>'s currentTime, a Lottie player's frame).
   * `sourceMs` is the position INSIDE the media: `clipIn + local * speed`.
   */
  media?(el: HTMLElement, timing: Timing, sourceMs: number, active: boolean): void;
  /**
   * The stage's NATIVE size, px - the projection's principal point is its centre
   * (section 4.1). A FUNCTION rather than two numbers on purpose: reading `offsetWidth`
   * forces layout, and this pass runs every frame, so a stage that authors no depth
   * must never pay for it. It is called at most once per apply, and only once
   * something actually needs projecting.
   */
  stage?(): { w: number; h: number };
  /**
   * The camera clips governing this stage (section 5.4), latest-in-array covering `t` wins.
   *
   * An OVERRIDE, and normally absent: the applier derives the cameras from the very
   * elements it was handed, exactly as the planner derives them from its own layers
   * (`stageCameras`), so the two evaluators cannot be told different cameras for the
   * same stage. Supplying it replaces that derivation wholesale - a test seam, and the
   * hook a caller that already knows the camera set can use to skip the walk.
   *
   * With no camera box at all the resolution is the DEFAULT camera - which projects a
   * z = 0 layer at eff = 1, i.e. leaves every existing document alone.
   */
  cameras?: SeqPlanEnv['cameras'];
}

/** The stage element's own native box, as `ApplyCtx.stage` wants it. */
export function stageNativeSize(stage: HTMLElement | null): { w: number; h: number } {
  if (!stage) return { w: 0, h: 0 };
  // offsetWidth/Height is the UNTRANSFORMED layout box - the artboard's authored
  // size, unaffected by whatever CSS scale the shell is previewing it at, which is
  // also the number renderSequence sizes its output from. jsdom answers 0, hence the
  // inline-style fallback (the tool hook writes both).
  const w = stage.offsetWidth || parseFloat(stage.style?.width || '') || 0;
  const h = stage.offsetHeight || parseFloat(stage.style?.height || '') || 0;
  return { w: Number.isFinite(w) ? w : 0, h: Number.isFinite(h) ? h : 0 };
}

/** The class the panel's stylesheet turns into `display:none`. */
export const OFF_CLASS = 'seq-off';

/**
 * The class lib/clip-thumbs.ts parks a box under while it photographs it for a timeline
 * thumbnail - `transform: translate(-200vw,-200vw) !important` in timeline.css. A shot
 * has to lift `seq-off` to photograph anything, and parking is what keeps the un-hidden
 * box off the live artboard for the ~100ms-1.5s that takes.
 */
export const SHOT_CLASS = 'tl-shot';

/**
 * Stamped by a thumbnail shot on every element whose `seq-off` it borrowed, carrying the
 * shot's own token. It is the LEASE on that element's visibility: while it is present the
 * shot owns the class (so a tick mid-shot must not re-hide the box it is reading), and
 * the applier revokes the lease - attribute and park both - the moment it wants that box
 * on screen, which is the shot's signal to stand down instead of re-hiding it.
 *
 * Without the lease the playhead could be scrubbed ONTO a parked box: the applier removed
 * `seq-off`, believed the scene live, and the park kept it 200vw off the viewport for the
 * rest of the shot - a black stage that popped back when the shot finally settled.
 */
export const BORROW_ATTR = 'data-tl-borrowed';

/**
 * Take a box's visibility back off any thumbnail shot holding it.
 *
 * `closest` rather than the element itself because the park is on the BOX while the
 * borrow may have been taken on a descendant: un-parking the ancestor is what actually
 * puts the pixels back on the artboard.
 */
export function releaseShotBorrow(el: HTMLElement): void {
  const parked = el.closest?.(`.${SHOT_CLASS}`) as HTMLElement | null;
  parked?.classList.remove(SHOT_CLASS);
  if (el.hasAttribute?.(BORROW_ATTR)) el.removeAttribute(BORROW_ATTR);
}

/**
 * Put every timed element into the state it should be in at `tMs`.
 *
 * Exported taking an explicit element list so the whole visual contract - the
 * half-open window, the composition with authored styles, the restore on leaving a
 * transition - is unit-testable without a clock, an AudioContext or a live canvas.
 *
 * ELEMENT-KIND AGNOSTIC. Every element handed in is gated the same way - a `.lolly-box`
 * object clip and a `[data-pdf-page]` frame page (Design's frames-as-scenes: each
 * frame carries `data-t-start`/`data-t-dur` once sequenced) are both just "an element with
 * timing". The frame whose [start, start+dur) contains `tMs` keeps its pixels; every other
 * TIMED frame gets `.seq-off` → display:none, so the canvas shows one slide at a time. This
 * function must NEVER filter by class or tag: an untimed (spatial) frame is excluded purely
 * by having no `data-t-start`, so it is never in the caller's list and is never hidden.
 */
export function applyTimeToElements(els: HTMLElement[], tMs: number, ctx: ApplyCtx): void {
  // Timing is read for EVERY element before anything is written, because the
  // per-frame `z-index` (section 4.2) is a RANK across the whole stage: it cannot be known
  // while the first box is still being read. This first pass touches attributes only
  // - no layout, no writes - so it costs the same as the read the single-pass version
  // used to do inline.
  const n = els.length;
  const timings: Timing[] = new Array(n);
  let anyBoxDepth = false;
  // section 5.4: a frames-as-scenes document is out of depth scope in v1 - the WHOLE
  // document, not only its pages. The planner opts out on the same condition and for
  // the same reason (the two evaluators are told different stage sizes there; see
  // `sequenceDrawPlan`), so the two agree by construction rather than by coincidence.
  let framesDoc = false;
  // Cameras, derived from the SAME elements (section 5.4). Built here, in the read-only pass,
  // for the same reason the timings are: the camera governing frame `t` has to be known
  // before the first box is posed, and a camera can appear anywhere in DOM order.
  const derived: KfCameraClip[] = [];
  for (let i = 0; i < n; i++) {
    const el = els[i] as HTMLElement;
    const timing = readTiming(el);
    timings[i] = timing;
    // The camera marker, asked exactly as the AuthoredStore asks it. `layerKind` in the
    // planner asks the same question of the same attribute - the audio precedent only
    // works because BOTH evaluators actively detect it, and so does this one.
    const cam = !!(el.matches?.('[data-cam]') || el.querySelector?.('[data-cam]'));
    if (cam) {
      derived.push({
        // Butted, half-open windows - cuts, not blends. An open-ended camera (the
        // "Always on" scenery chip) never ends.
        start: timing.start,
        end: timing.dur != null ? timing.start + timing.dur : null,
        base: timing.z !== 0 ? { z: timing.z } : null,
        track: timing.kf.length > 0 ? timing.kf : null,
      });
    } else if (timing.z !== 0 || timing.rx !== 0 || timing.ry !== 0 || timing.kf.length > 0) {
      // A CAMERA's own z/kf are the camera pose, not a lifted layer - counting them
      // here would make an otherwise flat stage measure itself and project every box
      // through a camera that has not moved.
      //
      // The TILT term (P2.1) is what lets a box carrying nothing but an `rx` field be
      // seen at all: with no depth, no track and no camera on the stage this latch is
      // the only thing that measures the stage and builds a view, and without it the
      // field would be inert here while the planner projected it.
      anyBoxDepth = true;
    }
    if (timing.frame) framesDoc = true;
  }
  const cameras = ctx.cameras ?? (derived.length > 0 ? derived : null);
  // The gate, and it is the byte-identity floor: with no box carrying depth or a tilt
  // and no camera on the stage, `view` stays null, the stage is never measured,
  // `foldKfPose` is never called, and `filter`/`z-index` are never written. The
  // condition is the planner's own (`sequenceDrawPlan` projects when
  // `viewMoves(view) || z || rx || ry || kf`), so
  // the moment P1 hands cameras in, both evaluators start projecting on the same
  // frame rather than one of them lagging.
  const hasCamera = !!cameras && cameras.length > 0;
  let view: KfCameraView | null = null;
  let moving = false;
  if (!framesDoc && (anyBoxDepth || hasCamera)) {
    const size = ctx.stage?.() ?? { w: 0, h: 0 };
    view = planCameraView({ stageW: size.w, stageH: size.h, cameras }, tMs);
    moving = viewMoves(view);
  }
  // Resolved depth per element, and which elements take part in the paint-order rank.
  const zs = view ? new Float64Array(n) : null;
  const ranked = view ? new Uint8Array(n) : null;
  const recs: Authored[] = new Array(n);
  let anyLift = false;
  // True the moment any element in this pass is CARRYING a z-index we wrote - which
  // is what makes the rank pass below responsible for taking it away again, not only
  // for putting it on. A track whose z curve returns to the flat board would otherwise
  // leave the last rank frozen on the boxes, and a stale rank is a wrong paint order.
  let anyStaleRank = false;

  for (let i = 0; i < n; i++) {
    const el = els[i] as HTMLElement;
    const timing = timings[i] as Timing;
    const rec = ctx.store.get(el);
    recs[i] = rec;
    if (rec.lastZIndex !== null) anyStaleRank = true;
    // The BACKGROUND PLANE is not a clip: it has no window, and the compositor draws
    // the bg plate on every frame unconditionally. Reading a window off it would blank
    // the connector artwork - and stop projecting it - at exactly t = seqMs, where an
    // open-ended box's half-open span has just closed.
    const active = rec.plane || isActiveAt(timing, tMs, ctx.seqMs);
    // Class-only visibility. We deliberately do NOT also write `style.visibility`:
    // it is a property the tool's own boxCss is free to author, and a belt-and-braces
    // write there would be indistinguishable from the author's on restore. The class
    // is the whole contract; timeline.css owns what it means.
    // This pass is the AUTHORITY on visibility, including over a thumbnail shot that
    // borrowed it: making a box active revokes the lease and un-parks it in the same
    // breath, so the scene under the playhead is on the artboard now, not when the shot
    // gets round to settling. Going the other way the shot keeps what it borrowed - it is
    // parked offscreen anyway, and re-hiding it here would photograph the blank the
    // borrow exists to prevent - and its own restore puts `seq-off` back.
    if (active) { el.classList.remove(OFF_CLASS); releaseShotBorrow(el); }
    else if (!el.hasAttribute?.(BORROW_ATTR)) el.classList.add(OFF_CLASS);

    // An audio bed and a camera marker are timeline citizens with no picture: no
    // transition, no projection, no style write of any kind (section 5.4).
    const silent = rec.audio || rec.camera;
    // Split text (plans/175 WP-A): the units carry the transition, the box stays at
    // rest - so a non-null split state suppresses the whole-box transition below.
    // No usable units (a single word, a rebuilt DOM) → null → the block path, exactly
    // as if no tier were authored.
    let splitState: 'animating' | 'rest' | null = null;
    if (timing.split && !silent) {
      if (active) splitState = applySplitUnits(el, timing, tMs, ctx.seqMs);
      else clearSplitUnits(el);
    }
    const tr = active && !silent && splitState === null ? transitionAt(timing, tMs, ctx.seqMs) : null;
    // Hold effect (plans/175 WP-B): a looping pose of box-local time, composed with
    // the transition offset below. Whole-box always - a split box's units carry the
    // enter/exit while the box itself pulses, on both evaluators identically.
    const hold = active && !silent && timing.hold
      ? holdPose(timing.hold, tMs - timing.start, timing.holdRate, rec.w, rec.h)
      : null;
    // The section 5.4 exclusions, asked through the SAME predicate the planner asks - an
    // audio bed, a camera marker, and a `[data-pdf-page]` frame page (which keeps its
    // ordinary transitions, but v1's camera and keyframes reach only boxes on a
    // [data-sequence] stage).
    // Two questions, and they are NOT the same one. "Does this element take part in
    // the paint order at all" is the section 5.4 exclusion set (audio bed, camera marker,
    // frame page); "does it need the fold computed" additionally requires that
    // something actually moved it. Conflating them is what made the DOM rank a
    // SUBSET of what the planner sorts - see the rank pass below.
    const projectable = isProjectable({
      kind: rec.camera ? 'camera' : rec.audio ? 'audio' : 'static',
      frameScene: timing.frame,
    });
    // The BACKGROUND PLANE (section 5.5) is projected on exactly the same terms as a layer - 
    // it is an implicit z = 0 one, and `rec.left/top/w/h` on a full-artboard child
    // resolve to the stage's own rect, so the fold produces the very numbers the
    // worker's bg draw uses (`projectLayer` at the stage centre, z = 0). It is only
    // ever moved by a camera, never by timing, so it needs no transition and takes no
    // rank (see `Authored.plane` and the rank pass below).
    const projecting = view !== null && active && projectable
      && (moving || timing.z !== 0 || timing.rx !== 0 || timing.ry !== 0 || timing.kf.length > 0);
    if (tr || projecting || hold) {
      const off0 = tr ? recTransition(tr.kind, tr.p, rec.w, rec.h, tr.ease) : REST_TRANSITION;
      const off = hold ? withHold(off0, hold) : off0;
      // ONE fold, shared with the canvas planner - see foldKfPose. `t` is the
      // sequence clock; a keyframe track runs on LOCAL box time, unscaled (section 5.1).
      const fold = projecting && view
        ? foldKfPose({
          view,
          cx: rec.left + rec.w / 2,
          cy: rec.top + rec.h / 2,
          tr: off,
          pose: evaluateKf(timing.kf, tMs - timing.start),
          zField: timing.z,
          rxField: timing.rx,
          ryField: timing.ry,
          authoredBlur: rec.filterBlur,
          boxW: rec.w,
          boxH: rec.h,
        })
        : {
          dx: off.dx, dy: off.dy, scale: off.sc, rot: off.rot, alpha: off.alpha,
          blur: rec.filterBlur, z: 0, w: rec.w, h: rec.h, sized: false, m3: null,
        };
      // THE LAYOUT WRITE (section 5.2, and the header's stated exception). Gated on `sized`,
      // which is only ever true when the track actually mentioned `w`/`h` - so a stage
      // that keyframes position, scale, opacity, blur or depth still issues not one
      // reflow. Written BEFORE the transform so the browser lays the box out once and
      // composites once, rather than reflowing after it has already been transformed.
      if (fold.sized) {
        const wCss = `${n3(fold.w)}px`;
        const hCss = `${n3(fold.h)}px`;
        if (wCss !== rec.lastWidth) { el.style.width = wCss; rec.lastWidth = wCss; }
        if (hCss !== rec.lastHeight) { el.style.height = hCss; rec.lastHeight = hCss; }
      } else if (rec.lastWidth !== null || rec.lastHeight !== null) {
        // The track's `w`/`h` segment ended (or the box left the projection): hand the
        // authored declarations back rather than freezing the last tweened size on.
        if (rec.width) el.style.width = rec.width; else el.style.removeProperty('width');
        if (rec.height) el.style.height = rec.height; else el.style.removeProperty('height');
        rec.lastWidth = null;
        rec.lastHeight = null;
      }
      // P2 - a TILTED camera hands the fold a homography, and it goes on this element
      // and no other: per-element `matrix3d`, flattened, never a shared `perspective`
      // ancestor (section 6.4's Cover Flow rule). The z-index rank below is unaffected and has
      // to be - under tilt the paint order is still the view-axis order the engine
      // resolved, and a browser given a flat matrix3d has no depth of its own to sort by.
      const transform = composeTransform(
        rec.transform, { dx: fold.dx, dy: fold.dy, sc: fold.scale, rot: fold.rot }, fold.m3,
      );
      const opacity = composeOpacity(rec.opacity, fold.alpha);
      // Published for the editor chrome (see `sequencePoseOf`) BEFORE the write is
      // skipped as unchanged: the pose is a property of this frame, not of the diff,
      // so a steady playhead still answers where the box is.
      LIVE_POSE.set(el, {
        dx: fold.dx, dy: fold.dy, sc: fold.scale, rot: fold.rot,
        w: fold.w, h: fold.h, sized: fold.sized, tilted: fold.m3 !== null,
      });
      if (transform !== rec.lastTransform) {
        if (transform) el.style.transform = transform; else el.style.removeProperty('transform');
        rec.lastTransform = transform;
      }
      if (opacity !== rec.lastOpacity) {
        el.style.opacity = opacity;
        rec.lastOpacity = opacity;
      }
      // `filter` is written ONLY when the total blur has actually moved off the
      // authored one - compared as a NUMBER, so a box whose blur nothing touched
      // keeps its authored declaration spelled exactly as the hook wrote it, rather
      // than an equivalent re-serialisation of it. Blur first, then whatever else the
      // author asked for (the `shadow`/`depth` drop-shadow), so the shadow keeps
      // following the blurred silhouette (section 5.5).
      const filter = fold.blur === rec.filterBlur ? rec.filter : composeFilter(fold.blur, rec.filterRest);
      if (filter !== (rec.lastFilter ?? rec.filter)) {
        if (filter) el.style.filter = filter; else el.style.removeProperty('filter');
        rec.lastFilter = filter;
      }
      if (zs && ranked) {
        zs[i] = fold.z;
        // Ranked = "has a picture and is on screen", NOT "was projected". A flat box
        // resolves to z = 0 and still has to be IN the sort, or it floats above every
        // lifted one (see the rank pass). The background plane is the one thing that
        // is projected and never ranked: the compositor draws it before the first
        // layer, so a sunken box belongs above it.
        ranked[i] = projectable && !rec.plane ? 1 : 0;
        if (projecting && fold.z !== 0) anyLift = true;
      }
    } else {
      // No transition, no projection - but an ACTIVE box with a picture is still a
      // participant in the paint order at its authored depth (z = 0, the array's own
      // initial value). Only then does the restore below apply.
      if (zs && ranked && active && projectable && !rec.plane) ranked[i] = 1;
      // Unconditional, unlike the restore below: this box is at rest THIS frame
      // whether or not we were the ones who last moved it, and an editor asking for
      // its pose must be told "none" rather than handed another session's.
      LIVE_POSE.delete(el);
      if (rec.lastTransform !== null || rec.lastOpacity !== null || rec.lastFilter !== null
        || rec.lastWidth !== null || rec.lastHeight !== null) {
        // Left the window (or went off screen): hand the authored styles straight
        // back. `lastZIndex` is deliberately NOT in this test - the rank pass below
        // owns that slot for the whole stage and will restore it in the same frame if
        // this element has dropped out of the rank; restoring it here would take a
        // rank away from a box that is about to be given one again.
        ctx.store.restore(el);
      }
    }

    // The background plane has no media to drive - the export photographs it as a
    // STILL plate - so it is not offered to the caller's media hook either.
    if (ctx.media && !rec.plane) {
      const local = Math.max(0, tMs - timing.start);
      ctx.media(el, timing, timing.clipIn + local * timing.speed, active);
    }
  }

  // section 4.2 - paint order IS depth order. Affine-per-layer only reproduces a true
  // perspective render when the two agree, and z is keyframable, so two layers' z
  // curves can cross mid-move. The canvas planner sorts its PlanItems; a live DOM
  // cannot be re-ordered, so the same ranking is expressed as `z-index`.
  //
  // Skipped whole unless something is actually lifted - the planner's own gate - so a
  // stage that only keyframes x/y/opacity never grows a stacking property it did not
  // have. Ranks start at 1 for the same reason: `z-index: 0` and `z-index: auto` are
  // not the same declaration, and only one of them is what these boxes shipped with.
  //
  // THE RANK SET IS THE SORT SET. Every ACTIVE element with a picture is ranked, not
  // only the ones the fold touched: in CSS a positioned box with an integer `z-index`
  // paints in a higher stacking level than every `auto` sibling, so ranking only the
  // projected boxes would mean "the lifted ones float above all the flat ones" - the
  // exact opposite of the planner, which sorts the WHOLE plan (a flat item carries
  // `resolvedZ = 0`) the moment anything is lifted. A flat box and a SUNKEN one
  // (`z = -200`, a shipped value) is the two-box counter-example: the planner paints
  // the sunken one first, a projecting-only rank painted it last.
  //
  // The pass ALSO runs when the stage has flattened back out (`anyStaleRank`), because
  // then it is the pass that takes the rank away: a z curve returning to the board
  // must return the paint order to DOM order with it.
  if ((zs && ranked && anyLift) || anyStaleRank) {
    const order: number[] = [];
    if (zs && ranked && anyLift) {
      for (let i = 0; i < n; i++) if (ranked[i]) order.push(i);
      order.sort((a, b) => (zs[a] as number) - (zs[b] as number) || a - b);
    }
    const rank = new Map<number, string>();
    for (let r = 0; r < order.length; r++) rank.set(order[r] as number, String(r + 1));
    for (let i = 0; i < n; i++) {
      const rec = recs[i] as Authored | undefined;
      if (!rec) continue;
      const el = els[i] as HTMLElement;
      const zi = rank.get(i);
      // Somebody else may own this slot: free-canvas hoists a DRAGGED box to
      // `z-index: 9999` straight on the element for the length of the gesture (no
      // model write, no repaint). If the inline value is not the one we last wrote,
      // the rank is not ours to move - leave it, and drop our claim so the restore
      // path cannot hand back a value the other writer has since replaced.
      const mine = rec.lastZIndex === null
        ? (el.style.zIndex || '') === rec.zIndex
        : el.style.zIndex === rec.lastZIndex;
      if (!mine) { rec.lastZIndex = null; continue; }
      if (zi === undefined) {
        // Not ranked this frame. If we ever ranked it, hand the authored value back.
        if (rec.lastZIndex !== null) {
          if (rec.zIndex) el.style.zIndex = rec.zIndex; else el.style.removeProperty('z-index');
          rec.lastZIndex = null;
        }
      } else if (zi !== (rec.lastZIndex ?? rec.zIndex)) {
        el.style.zIndex = zi;
        rec.lastZIndex = zi;
      }
    }
  }
}

// ── a whole stage, at a time ────────────────────────────────────────────────

/**
 * The `[data-sequence]` artboard inside (or at) `root`, or null when the render
 * target is not a timed composition. Same reading as sequence-plan's
 * `parseSequenceStage`, so "is a sequence" means one thing everywhere.
 */
export function sequenceStageOf(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  return root.matches?.('[data-sequence]')
    ? root
    : (root.querySelector?.('[data-sequence]') as HTMLElement | null);
}

/** The declared sequence length in ms (`data-seq-ms`), or 0 when untimed. */
export function sequenceDurationMs(root: HTMLElement | null): number {
  const stage = sequenceStageOf(root) ?? root;
  if (!stage) return 0;
  const el = stage.matches?.('[data-seq-ms]')
    ? stage
    : (stage.querySelector?.('[data-seq-ms]') as HTMLElement | null)
      ?? (root?.querySelector?.('[data-seq-ms]') as HTMLElement | null);
  const v = parseFloat(el?.getAttribute('data-seq-ms') || '');
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Everything on a stage that carries TIMING, DEPTH or a POSE.
 *
 * The applier's element set, and it is deliberately the union rather than
 * `[data-t-start]` alone - which is what it was, and what made the two evaluators
 * enumerate different scenes (plans/104 P1 review, HIGH 1):
 *
 *  • `[data-t-start]` - anything timed. NOT restricted to `.lolly-box`, so a sequenced
 *    `[data-pdf-page]` frame page (frames-as-scenes) is gated by the exact same pass,
 *    and its `.seq-off` is the same class sequence-render.ts strips before it
 *    photographs a frame. A frames doc has no `[data-sequence]` stage, so
 *    `sequenceStageOf` falls back to `root` and still finds the pages.
 *  • `[data-t-z]` / `[data-t-kf]` - SCENERY that is lifted or animated. The hooks emit
 *    these for a timed and an untimed box alike ("a scenery box on a sequence stage is
 *    visible throughout and can still be lifted off the surface or animated"), while
 *    the planner enumerates every `.lolly-box` regardless of timing. Without them a
 *    scenery box's z and its whole keyframe track were live in the export and inert in
 *    the preview.
 *  • `[data-cam]` - the camera MARKER, mapped to the box that carries its pose. section 5.4's
 *    headline "Always on" scene camera is untimed by construction, so it has no
 *    `data-t-start` and the applier could not see the one element whose whole job is to
 *    move everything else: the camera-pan drag, the wheel dolly and all five presets
 *    committed to the model and then did nothing visible in the editor. A camera at the
 *    DEFAULT pose carries neither `data-t-z` nor `data-t-kf` and still has to be here,
 *    because cuts resolve to the LATEST camera covering `t` - a default one later in
 *    DOM order legitimately cuts an earlier moving one back to rest.
 *
 * Plus, once a camera exists at all, the stage's BACKGROUND PLANE: its own children
 * that are not layers. That is exactly the residue `sequence-render.ts` photographs
 * into the bg plate (it hides every `.lolly-box` and timed frame page and shoots what
 * is left - the connector layer, for one), and section 5.5 requires BOTH paths to project it,
 * or a pan slides every layer across frozen wallpaper. Gated on a camera being present
 * because without one nothing can move the plane, so a camera-less document - every
 * document written before this - is not given one extra element to walk.
 */
export function sequenceTimeElements(stage: HTMLElement | null): HTMLElement[] {
  if (!stage?.querySelectorAll) return [];
  const out: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const push = (el: HTMLElement | null | undefined): void => {
    if (el && !seen.has(el)) { seen.add(el); out.push(el); }
  };
  for (const el of stage.querySelectorAll<HTMLElement>(POSED_SEL)) {
    // A camera's pose rides on the BOX (`data-t-kf`/`data-t-z` like every other box);
    // `[data-cam]` is only the non-visual marker inside it, and the marker carries
    // nothing. Both evaluators ask this same question - `layerKind` accepts the marker
    // ON the element too, which is why the fallback is the element itself.
    push(el.hasAttribute?.('data-cam') ? (el.closest?.('.lolly-box') as HTMLElement | null) ?? el : el);
  }
  if (stage.querySelector?.('[data-cam]')) {
    for (const child of [...stage.children]) {
      if (isBackgroundPlane(child as HTMLElement)) push(child as HTMLElement);
    }
    // ...and every FLAT box. The planner projects every `.lolly-box` the moment the
    // view moves (`sequenceDrawPlan`: `viewMoves(view) || z || kf`), while this set
    // used to hold only the posed ones - so an untimed, unlifted, trackless box was
    // moved by the export and frozen in the preview, the exact divergence the union
    // above exists to prevent. Gated on a camera for the same reason the background
    // plane is: without one nothing can move a flat box, so a camera-less document
    // walks not one extra element and stays byte-identical.
    for (const el of stage.querySelectorAll<HTMLElement>('.lolly-box')) push(el);
  }
  return out;
}

/** Elements carrying timing, depth, a tilt, a keyframe track, or a camera marker. */
const POSED_SEL = '[data-t-start], [data-t-z], [data-t-rx], [data-t-ry], [data-t-kf], [data-cam]';

/** Tags that paint nothing, so photographing or projecting them means nothing. */
const UNPAINTED = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META', 'TITLE', 'NOSCRIPT']);

/**
 * Is this element part of the stage's BACKGROUND PLANE - the implicit z = 0 layer
 * (plans/104 section 5.5) rather than a layer of its own?
 *
 * The definition is the export's, restated as a predicate rather than re-derived: the
 * bg plate is the stage shot with every `.lolly-box` and every timed `[data-pdf-page]`
 * hidden, so anything else the stage paints IS the background - today the bound-path
 * connector layer, tomorrow whatever a tool puts behind its boxes. `[data-export-hide]`
 * is excluded for the same reason it is excluded from the plate: the export walk drops
 * it, so it is not in the background the compositor projects.
 *
 * WHAT IS DELIBERATELY LEFT OUT: the stage element's OWN paint. It cannot be given a
 * transform (that would move every child with it), and it does not need one - all three
 * tools author the artboard as a flat colour (`safeColor(inp.background, …)` in each
 * `hooks.js`), and a uniform plane is invariant under the translate + uniform scale a
 * projection is. `bgOverscanPad` is derived so the projected plate still covers the
 * frame, so there is no edge to reveal either. The one residue is the behind-camera
 * guard: past `u = 0.8` the export fades the whole bg plate with `alphaGuard` while the
 * artboard's own fill stays opaque in the preview. That is the extreme end of a
 * fly-through, it is stated here, and it is the only part of section 5.5's bg rule the DOM
 * cannot express.
 */
export function isBackgroundPlane(el: HTMLElement | null): boolean {
  if (!el || typeof el.matches !== 'function') return false;
  if (UNPAINTED.has(el.tagName)) return false;
  return !el.matches(`${POSED_SEL}, .lolly-box, [data-pdf-page], [data-export-hide]`);
}

/** A reversible run of applications against one root. Reuse it across frames. */
export interface SequenceTimeSession {
  /** Put every timed box into the state it should be in at `tMs`. */
  apply(tMs: number): void;
  /** The stage's declared length, ms (re-read each call - a repaint can change it). */
  durationMs(): number;
  /** Hand every touched element its authored class/styles back, and forget them. */
  restore(): void;
}

/**
 * Open a session over `root`.
 *
 * A session, not a bare function, because the authored styles have to be remembered
 * ACROSS frames: capturing them per call would re-capture our own animated transform
 * on frame 2 and bake it in. `restore()` is what makes the DOM byte-for-byte the
 * caller's again - always call it in a `finally`.
 */
export function createSequenceTime(
  root: HTMLElement,
  opts: { media?: ApplyCtx['media']; cameras?: ApplyCtx['cameras'] } = {},
): SequenceTimeSession {
  const store = createAuthoredStore();
  const boxes = (): HTMLElement[] => sequenceTimeElements(sequenceStageOf(root) ?? root);
  // What the read/restore seam knows this session by. `lastT` is remembered so a
  // suspended session can be put back exactly where it was, rather than at 0 - an
  // export that finishes must hand the editor back the frame the user was looking at.
  let paused = false;
  let lastT: number | null = null;
  let unregister: (() => void) | null = null;
  const session: SequenceTimeSession = {
    apply(tMs) {
      lastT = tMs;
      if (paused) return;
      // Registered lazily, on the first write rather than at construction: a session
      // that never applied has composed nothing, so there is nothing for a
      // photographer to restore and no reason to hold its root alive in the registry.
      // (Re-registered here too, because `restore()` deregisters and a session may be
      // driven again afterwards - `driveSequenceTime`'s stop/start is exactly that.)
      if (!unregister) unregister = registerSequenceWriter(writer);
      const els = boxes();
      // A repaint mints new nodes; dropping the dead entries keeps the store from
      // handing a stale authored value to a fresh box at the same position.
      store.prune(new Set(els));
      applyTimeToElements(els, tMs, {
        seqMs: sequenceDurationMs(root),
        store,
        // Lazy by contract: a stage that authors no depth never calls this, so no
        // frame of an ordinary composition pays a forced layout for a feature it
        // does not use.
        stage: () => stageNativeSize(sequenceStageOf(root) ?? root),
        ...(opts.media ? { media: opts.media } : {}),
        ...(opts.cameras ? { cameras: opts.cameras } : {}),
      });
    },
    durationMs: () => sequenceDurationMs(root),
    restore() {
      // The class is not part of the authored-style store (it is applied, not
      // composed), so it has to be lifted separately - the same two-step the preview
      // clock's destroy() does. Leaving it behind hides every box that was off screen
      // at the last applied frame: a live capture would end with a blank canvas.
      // Any in-flight shot's lease goes with it: this session is done asserting
      // visibility, so a restore arriving afterwards must not re-hide anything.
      for (const el of boxes()) { el.classList.remove(OFF_CLASS); releaseShotBorrow(el); }
      store.restoreAll();
      // This session is no longer composing anything, so the seam must stop counting
      // it - a deregistered writer is one nobody can suspend, restore or read through.
      unregister?.();
      unregister = null;
      paused = false;
      lastT = null;
    },
  };
  const writer: SequenceWriter = {
    root,
    store,
    setPaused(v) { paused = v; },
    reapply() { if (!paused && lastT != null) session.apply(lastT); },
  };
  return session;
}

// Sessions opened by the free-function form below, keyed by root so repeated calls
// keep composing against the SAME captured authored styles.
const AD_HOC = new WeakMap<HTMLElement, SequenceTimeSession>();

/**
 * Put `root`'s composition at `tMs`. The convenience form of `createSequenceTime`
 * for callers that just want to step time (a contact sheet walking t across the
 * sequence): the session is remembered per root, so the authored styles are captured
 * once. Pair it with `restoreSequenceTime(root)` when finished.
 */
export function applySequenceTime(root: HTMLElement, tMs: number): void {
  let s = AD_HOC.get(root);
  if (!s) { s = createSequenceTime(root); AD_HOC.set(root, s); }
  s.apply(tMs);
}

/** Undo every `applySequenceTime` write on `root`. A no-op if there were none. */
export function restoreSequenceTime(root: HTMLElement): void {
  const s = AD_HOC.get(root);
  if (s) { s.restore(); AD_HOC.delete(root); }
}

/**
 * RELEASE THE CLOCK: hand `root` back to its author for as long as nobody is looking
 * at a playhead, and hand back the resume (plans/179 T2).
 *
 * This is `beginAuthoredDom` plus the one thing that scope deliberately leaves alone.
 * A photographer suspends the writers because it is about to READ authored geometry,
 * and it strips `.seq-off` per shot itself - so lifting the class there would un-hide
 * the whole composition on the live stage for the length of an export. The timeline
 * CLOSING is the opposite case: nothing is reading, the user is back on the canvas,
 * and the contract that governs a canvas with no clock is "every box shows". Leaving
 * the class behind is exactly the bug this exists to fix - close the panel on a deck
 * that has been placed in order and three of the four artboards stay `display: none`
 * with only their labels on screen.
 *
 * A HOLD, not a teardown, and that is the whole point: the writers keep their clocks
 * (so reopening resumes at the same playhead), the registry's own depth counter keeps
 * them down, and an export taken while the panel is shut nests inside this hold
 * instead of resuming it out from under us. Calling the returned closure lifts the
 * hold and re-asserts each writer at its own current time.
 */
export function releaseSequenceDom(root: HTMLElement): () => void {
  const resume = beginAuthoredDom(root);
  for (const el of sequenceTimeElements(sequenceStageOf(root) ?? root)) {
    el.classList.remove(OFF_CLASS);
    releaseShotBorrow(el);
  }
  return resume;
}

/** A playhead someone else's clock is pacing. See `driveSequenceTime`. */
export interface SequenceDriver {
  /** Begin at t=0 and advance in real time. Idempotent. */
  start(): void;
  /** Stop advancing and restore the DOM. Idempotent, safe before `start`. */
  stop(): void;
}

/** Frames per second the live driver steps the DOM at. */
export const DRIVE_FPS = 30;

/**
 * Advance `root`'s playhead in REAL TIME for `durationMs`, then hold the last frame.
 *
 * Paced by setTimeout against a wall clock, deliberately NOT rAF - the same rule the
 * rest of the export path follows: rAF stops entirely in a backgrounded tab, which
 * would strand a live capture on one frame (the exact bug this exists to fix). Each
 * tick reads the clock rather than counting frames, so a throttled timer skips
 * ahead instead of drifting into slow motion.
 */
export function driveSequenceTime(
  root: HTMLElement,
  o: {
    durationMs: number;
    fps?: number;
    /** Test seam: monotonic ms. */
    now?: () => number;
    /** Test seam: returns a canceller. */
    schedule?: (fn: () => void, ms: number) => () => void;
  },
): SequenceDriver {
  // THE READ/RESTORE SEAM (plans/104 section 6 point 0), the live-capture half. This driver
  // opens a SECOND session on a root the preview clock is very likely already posing,
  // and `AuthoredStore.get()` captures whatever is on the element at first touch - so
  // without standing the clock down first, every frame of a live take would compose on
  // top of the pose the playhead happened to be parked on. Held open for the whole
  // take rather than per frame, because a clock tick landing between two of ours would
  // re-pose the stage mid-recording.
  let releaseAuthored: (() => void) | null = null;
  const session = createSequenceTime(root);
  const now = o.now ?? (typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => Date.now());
  const schedule = o.schedule ?? ((fn, ms) => {
    const h = setTimeout(fn, ms) as unknown as number;
    return () => clearTimeout(h as unknown as ReturnType<typeof setTimeout>);
  });
  const step = 1000 / Math.max(1, o.fps ?? DRIVE_FPS);
  const total = Math.max(0, o.durationMs);
  let cancel: (() => void) | null = null;
  let running = false;
  let t0 = 0;

  const tick = (): void => {
    cancel = null;
    if (!running) return;
    const t = now() - t0;
    // Past the end we hold the final frame rather than snapping back to 0 or
    // clearing the stage: a recorder still rolling must keep seeing the composition.
    try { session.apply(Math.min(t, total)); } catch { /* one bad frame never stops the take */ }
    if (t >= total) { running = false; return; }
    cancel = schedule(tick, step);
  };

  return {
    start() {
      if (running) return;
      running = true;
      // Before the first apply: this session must not be inside the snapshot it takes.
      releaseAuthored ??= beginAuthoredDom(root);
      t0 = now();
      tick();
    },
    stop() {
      running = false;
      if (cancel) { cancel(); cancel = null; }
      session.restore();
      // Last, so the preview clock re-asserts onto an artboard this driver has already
      // handed back - the same unwind order `withAuthoredDom` gives an export.
      releaseAuthored?.();
      releaseAuthored = null;
    },
  };
}
