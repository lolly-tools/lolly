// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-plan.ts - the PURE PLANNER behind deterministic sequence export
 * (Fable timeline, phase 3 section 0.0 "DESIGN REQUIREMENT added by the spike").
 *
 * Node cannot run WebCodecs, and Playwright's bundled Chromium has no proprietary
 * codecs. So anything that lives inside the compositor is browser-only and, in
 * practice, untested. This module holds the ENTIRE correctness surface of
 * a sequence render: stage parsing, activity windows, junction crossfade alpha,
 * `clipIn + (t − start) × speed` source mapping, the fixed-fps timestamp grid, the
 * silent-truncation guard, and error normalisation. It has no canvas, no WebCodecs, no
 * media element, and no mediabunny anywhere in it. The executor that consumes a plan
 * is a thin loop of `ctx.save()` / `drawImage` / `ctx.restore()` calls with no
 * decisions of its own.
 *
 * It reads a DOM node, but only ever with `getAttribute`, `style.*`, `querySelector`, and
 * `className` - everything jsdom implements. So the whole module runs headlessly
 * under `node:test`.
 *
 * PARITY IS THE POINT. The preview (views/sequence-clock.ts) and the exported file
 * must agree pixel for pixel. So:
 *   • the transition maths is IMPORTED from lib/transitions.ts, never re-derived;
 *   • the activity window is the same half-open `[start, start + dur)`;
 *   • enter/exit progress, the "whichever is further from rest wins" pick, and the
 *     open-ended-box exit suppression use the same readings as `transitionAt`;
 *   • the composed rotation is `authored + animation`, matching the CSS order
 *     `translate → rotate(authored) → rotate(anim) → scale` that the clock writes
 *     and the canvas order `translate → rotate(authored + anim) → scale` that the
 *     compositor issues.
 * tests/sequence-plan.test.ts checks that parity against the real sequence-clock
 * functions. Do not trust this comment instead of the test.
 *
 * DELIBERATELY NOT imported: views/sequence-clock.ts. This is bridge code. The
 * bridge does not depend on the views layer (no bridge module does today), and the
 * clock also loads the lottie mount and the seek queue. The overlap is about 40 lines of
 * attribute reading, and the test file pins the two implementations together.
 */

import {
  recTransition, isTransitionKind, isSplitTier, isSplitOrder, splitSeedOf,
  splitPhaseWindowMs, MAX_SPLIT_STAGGER_MS,
  holdPose, isHoldFx, withHold, DEFAULT_HOLD_RATE, MIN_HOLD_RATE, MAX_HOLD_RATE,
  DEFAULT_TRANSITION_MS,
  type TransitionKind, type SplitTier, type SplitOrder, type HoldFx,
} from '../lib/transitions.ts';
// THE PARITY LAW, extended to depth (plans/104 section 4): every keyframe and projection
// FORMULA lives in the engine and is imported. Never restate it here, and never restate it in
// sequence-dom.ts. The two evaluators share this module's adapters, and those adapters
// share the engine's maths. So a drift needs a deliberate edit in one place, not
// an oversight in two.
import {
  parseKf, evaluateKf, projectLayer, dofBlur, resolveCamera, cameraTilted,
  DEFAULT_PERSPECTIVE, KF_CLAMPS, KF_MAX_BLUR, KF_Z_FIELD_CLAMP,
  type KfTrack, type KfPose, type KfCameraClip, type KfCameraView, type KfMatrix3,
} from '@lolly/engine';
import { clamp } from '@lolly/engine';

// ── clamps (mirroring the tool hook + timeline-math, so nothing can disagree) ──

/** Ceiling for any authored time value, ms. Mirrors timeline-math's MAX_TIME_S. */
export const MAX_TIME_MS = 3_600_000;
/** Playback-rate range, mirroring timeline-math MIN_SPEED/MAX_SPEED. */
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4;
/** Transition-length range, mirroring sequence-clock's MIN/MAX_TRANSITION_MS. */
export const MIN_TRANSITION_MS = 100;
export const MAX_TRANSITION_MS = 3000;
/**
 * How long a deck's slide transition runs in a video - the presenter's own `--pr-dur`
 * (styles/parts/present.css, 0.46 s), so the mp4 of a sequenced deck changes slides at
 * the pace the podium does (plans/184 R2).
 */
export const DECK_TRANSITION_MS = 460;
/** The deck transitions the compositor renders as a junction dissolve (see applyDeckTransitions). */
const DECK_DISSOLVES: ReadonlySet<string> = new Set(['fade', 'slide', 'morph', 'flight']);
/** The enter/exit length a box gets when it declares a kind but no duration. Defined in
 *  lib/transitions.ts and re-exported here, so the readers cannot drift to two numbers. */
export { DEFAULT_TRANSITION_MS };

/**
 * How far short of `computeDuration()` a decode may land before it counts as
 * truncated. Two output frames: one covers the ordinary "the last packet's
 * presentation time is a frame before the container's stated end" rounding, the
 * second absorbs a container whose duration is a hair long. Three or more would
 * start hiding real truncation, which is the whole thing this guard exists to catch.
 */
export const TRUNCATION_TOLERANCE_FRAMES = 2;

// ── depth: the `kf` track and the `z` field, read once and shared ───────────

/** The one empty track - `evaluateKf` returns `{}` for it without touching the index. */
export const EMPTY_KF_TRACK: KfTrack = parseKf('');

/**
 * Parsed `kf` tracks, keyed on the WIRE STRING.
 *
 * Both evaluators call this, so a box's track is parsed once per distinct value
 * rather than once per reader per frame - and, more importantly, both get back the
 * SAME frozen array, which is what lets the engine memoise its per-track channel
 * index against the object (a WeakMap keyed on the track) instead of rebuilding it
 * 30 times a second on each side.
 *
 * Bounded and cleared wholesale on overflow, the `EASE_PTS_CACHE` posture: the key
 * is untrusted text from a hand-edited URL, so it must not be able to grow without
 * limit. Per-thread by construction (module state), which is exactly the section 5.1 rule - 
 * the worker rebuilds its own from the strings it was handed.
 */
const KF_CACHE = new Map<string, KfTrack>();
const KF_CACHE_MAX = 256;

/** A `data-t-kf` / `kf` field value → its parsed track. Junk parses to an empty track, never throws. */
export function kfTrackOf(raw: string | null | undefined): KfTrack {
  if (typeof raw !== 'string' || raw === '') return EMPTY_KF_TRACK;
  const hit = KF_CACHE.get(raw);
  if (hit) return hit;
  const track = parseKf(raw);
  if (KF_CACHE.size >= KF_CACHE_MAX) KF_CACHE.clear();
  KF_CACHE.set(raw, track);
  return track;
}

/**
 * The volume keys of a parsed track (the kf grammar's `v` channel - plans/165
 * WP-3), in the CLIP-LOCAL seconds the audio envelope consumes. null when the
 * track keys no volume, so both consumers skip the work on the common un-keyed
 * clip. Pose channels on the same keys are ignored here exactly as the visual
 * fold ignores `v`.
 */
export function volumeKeysOf(track: KfTrack | null | undefined): { tSec: number; value: number }[] | null {
  if (!track || track.length === 0) return null;
  const out: { tSec: number; value: number }[] = [];
  for (const k of track) {
    const v = k.v.v;
    if (typeof v === 'number' && Number.isFinite(v)) out.push({ tSec: k.t / 1000, value: v });
  }
  return out.length ? out : null;
}

/**
 * A `data-t-z` attribute → the box's depth, px above the surface.
 *
 * Clamped with the ENGINE's `KF_Z_FIELD_CLAMP` rather than a re-typed −300…900: the
 * field clamp and the (much wider) `kf` wire clamp are deliberately different numbers
 * (section 5.1), and a second copy of either is how they stop being the same number.
 */
export function readDepthZ(raw: string | null | undefined): number {
  const v = parseFloat(raw ?? '');
  if (!Number.isFinite(v)) return 0;
  return clamp(v, KF_Z_FIELD_CLAMP[0], KF_Z_FIELD_CLAMP[1]);
}

/**
 * The per-box tilt FIELD's range, degrees (P2.1). The same ±75 the camera's own tilt
 * control uses (`KF_TILT_CONTROL`, views/timeline-panel.ts) for a different reason:
 * a box tilt changes no depth and cannot break the paint-order sort, but the box's own
 * perspective divide has a near plane - `W > 0` over the whole box needs
 * `hw·|sin(ry)| + hh·|cos(ry)·sin(rx)| < P` (the `R` of `boxTiltMatrix`, engine
 * keyframes.ts). That condition depends on the BOX SIZE, so ±75 does not guarantee it:
 * measured at P = 1200, a 400x240 card is safe over the whole band (worst corner
 * W = 0.81) and 1920x1080 still clears it (0.09), but 2560x1440 goes negative at the
 * far corner of rx −75 / ry −60 and paints garbage there. The clamp buys the ordinary
 * board, not every board; a near-plane guard sized to the box is the follow-on if a
 * full-wall canvas ever meets an extreme tilt. Deliberately NOT the ±180 kf WIRE clamp: the field and
 * the wire are different numbers, exactly as z's are. The same 75 is typed in three
 * more places (the manifest's min/max, the hook's own `TILT_MAX`, `KF_TILT_CONTROL`) -
 * importing timeline-panel.ts here for a two-number tuple would pull a whole view into
 * the planner, so this is a hand-copied constant with its siblings named.
 */
const KF_TILT_FIELD_CLAMP: readonly [number, number] = [-75, 75];

/**
 * A `data-t-rx` / `data-t-ry` attribute → the box's own tilt in degrees.
 *
 * `readDepthZ`'s twin, and it exists once so BOTH readers (this file's `readLayer`, the
 * applier's `readTiming`) hold a hand-authored angle to the same band. Junk, an absent
 * attribute and an infinity all read as 0, which is the flat board.
 */
export function readTiltDeg(raw: string | null | undefined): number {
  const v = parseFloat(raw ?? '');
  if (!Number.isFinite(v)) return 0;
  return clamp(v, KF_TILT_FIELD_CLAMP[0], KF_TILT_FIELD_CLAMP[1]);
}

/**
 * Split an authored inline `filter` into its blur radius and everything else.
 *
 * The tool hook writes ONE declaration - `filter: blur(4.5px) drop-shadow(...)`,
 * blur first so the shadow follows the blurred silhouette - and from section 5.5 the PLANNER
 * owns the total blur (authored + the kf `b` channel + depth-of-field). So the two
 * halves have to come apart: the number joins the fold, the remainder (today: the
 * `shadow`/`depth` drop-shadow) is carried through untouched and re-composed after it.
 *
 * Only the FIRST `blur()` term is lifted - that is the whole vocabulary the hooks
 * author. A second one is left in `rest` and applies exactly as it does today.
 */
export function splitFilterBlur(filter: string): { blur: number; rest: string } {
  const s = (filter || '').trim();
  if (!s || s === 'none') return { blur: 0, rest: '' };
  const m = /(?:^|\s)blur\(\s*(-?\d*\.?\d+)px\s*\)/.exec(s);
  if (!m) return { blur: 0, rest: s };
  const v = parseFloat(m[1] as string);
  const rest = `${s.slice(0, m.index)} ${s.slice(m.index + m[0].length)}`.trim().replace(/\s+/g, ' ');
  return { blur: Number.isFinite(v) && v > 0 ? v : 0, rest };
}

/** Re-compose a filter declaration from a blur radius and the rest, in the authored order. */
export function composeFilter(blurPx: number, rest: string): string {
  const parts: string[] = [];
  if (blurPx > 0) parts.push(`blur(${Math.round(blurPx * 1000) / 1000}px)`);
  if (rest) parts.push(rest);
  return parts.join(' ');
}

// ── the parsed stage ────────────────────────────────────────────────────────

/** What one `.lolly-box` on a `[data-sequence]` artboard is, to the exporter. */
export interface SeqLayer {
  el: HTMLElement;
  /** DOM order - this IS the z order, exactly as the browser paints it. */
  idx: number;
  /** ms */
  startMs: number;
  /** ms. An open-ended box gets the rest of the sequence (see `openEnded`). */
  durMs: number;
  /** ms into the source media at the clip's in-point. */
  clipInMs: number;
  /** Playback-rate multiplier, 0.25–4. */
  speed: number;
  mute: boolean;
  /** Struck-through / ignored (plans/174): dropped from the drawn frames and the audio
   *  mix. The hook has already compressed the surviving clips' startMs, so this layer
   *  just falls out - no picture, no sound, no gap. Absent = not ignored. */
  ignored?: boolean;
  /** Clip volume 0..2 (1 = as recorded) - the audio mix's flat gain. */
  gain: number;
  /** Stereo pan -1..1 (0 = centred) - equal-power in the export mix (plans/165 WP-5). */
  pan: number;
  /** Duck-to level 0..1 while other audio plays (1 = no duck) - plans/165 WP-6 v1. */
  duck: number;
  /** Pitch transpose in semitones (-12..12, 0 = as recorded) - plans/165 WP-7b. */
  pitch: number;
  /** Tape-style varispeed: pitch follows speed instead of being preserved - plans/165 WP-7b. */
  varispeed: boolean;
  /** Audio effect chain (the engine fx grammar; '' = none) - plans/101 section 3.4. */
  fx: string;
  enter: TransitionKind | null;
  enterMs: number;
  exit: TransitionKind | null;
  exitMs: number;
  /**
   * The authored geometry curve for each preset, as written - a preset name or a CSS
   * cubic-bezier, '' when unauthored. Passed through unvalidated on purpose: the one
   * validator is lib/transitions.ts, which answers an unparseable curve with the
   * preset's own, so preview and export cannot disagree about what junk means.
   */
  enterEase: string;
  exitEase: string;
  /**
   * Split text animation (plans/175 WP-A): the tier ('' = whole box), the
   * start-to-start unit gap (ms), the dealt order, the number of `.lly-u` unit
   * spans the hook wrapped (counted at parse - the worker has no DOM), and the
   * deterministic shuffle seed (hashed off `data-box-id`). While `splitActive`,
   * the whole-box transition is suppressed and the layer's picture is a live
   * per-frame raster of the DOM units - see makeLiveRaster's split branch.
   */
  split: SplitTier | '';
  splitStaggerMs: number;
  splitOrder: SplitOrder;
  splitUnits: number;
  splitSeed: number;
  /**
   * Hold effect (plans/175 WP-B): the looping while-on-screen pose ('' = still)
   * and its rate, cycles/sec. Composed with the transition offset via `withHold`
   * before the fold - the DOM applier's own combine, so the two never disagree.
   */
  hold: HoldFx | '';
  holdRate: number;
  lane: '' | 'seq';
  /**
   * `camera` is the plan-104 section 5.4 non-visual marker: a timeline citizen with no
   * picture at all, exactly like `audio`. It contributes no plate, no draw and no
   * pixel; it exists so a scene can carry a pose over time.
   */
  kind: 'static' | 'video' | 'lottie' | 'audio' | 'camera';
  /** Native px, straight off the inline style - the renderRecord read. */
  rect: { x: number; y: number; w: number; h: number; rot: number };
  /** Authored inline opacity, 0–1 (1 when unset). */
  opacity: number;
  /** Authored `mix-blend-mode`, '' when unset. */
  blend: string;
  /** Authored `border-radius`, '' when unset. */
  radius: string;
  /** Authored `clip-path`, '' when unset. */
  clipPath: string;
  /**
   * The box's DEPTH - px above (positive) or below (negative) the stage plane
   * (`data-t-z`), already held to the engine's field clamp. 0 is the flat board, and
   * a `z` token in the keyframe track REPLACES it for that segment (section 5.2).
   */
  z: number;
  /**
   * The box's own TILT in degrees (`data-t-rx` / `data-t-ry`), held to the field clamp
   * (P2.1). 0 is the flat card, and an `rx`/`ry` token in the keyframe track REPLACES
   * the field for that segment, exactly as `z` does.
   */
  rx: number;
  ry: number;
  /** The parsed keyframe track (`data-t-kf`), empty when the box is not keyframed. */
  kf: KfTrack;
  /**
   * The AUTHORED blur radius, px, lifted out of the inline `filter` - the base the
   * kf `b` channel and depth-of-field add over (section 5.5: the planner owns the total).
   */
  blur: number;
  /**
   * Everything else the authored `filter` said, in order - today the `shadow` /
   * `depth` drop-shadow. Re-composed AFTER the blur term so the shadow keeps
   * following the blurred silhouette.
   */
  shadowFilter: string;
  /**
   * True when the box declared no `data-t-dur` - scenery, or a clip that simply
   * runs to the end of the sequence. NOT in the phase-3 sketch's interface, but
   * required for parity: sequence-clock suppresses the exit transition of a box
   * whose `dur` is null (its end moves as the composition is edited, so it has no
   * stable tail to fade into), and `durMs` alone cannot express that.
   */
  openEnded: boolean;
  /**
   * The slide transition a timed frame page plays INTO the next one, resolved the way
   * the presenter resolves it: the page's own `data-frame-transition`, else the deck's
   * `data-deck-transition` on the render root, else the manifest default 'slide'. Empty
   * for anything that is not a frame page. Read by `applyDeckTransitions`. Optional so a
   * layer literal built elsewhere (the tests, an older wire) reads as "no deck transition".
   */
  frameTransition?: string;
  /** Set by `applyDeckTransitions` on a page whose exit it wrote - the deck's slide
   *  transition standing in as a dissolve, which the renderer says once per export. */
  deckDissolve?: boolean;
  /**
   * True when this layer is a timed FRAME PAGE ([data-pdf-page]) - a "Design"
   * frames-as-scenes slide, photographed whole. A frames slideshow places its pages
   * side by side on the pasteboard (x = 0, 1120, 2240 …), but the video output is one
   * slide wide: without normalisation slides 2..N draw off-canvas and only slide 1
   * ever shows. `normalizeFrameScene` rewrites a frameScene layer's DRAW rect to the
   * output viewport so every slide fills its window at the origin - a compositor-only
   * re-anchor; the committed geometry (the frame's real x/y, its exported PDF page) is
   * never touched. An object-clip `.lolly-box` carries no [data-pdf-page] → false →
   * keeps its authored position within the single artboard.
   */
  frameScene: boolean;
}

export interface SequenceStage {
  layers: SeqLayer[];
  /** Sequence length, ms. 0 when the composition declares nothing timed. */
  totalMs: number;
}

function num(raw: string | null, fallback: number): number {
  if (raw == null || raw === '') return fallback;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
}

/** A style property, read defensively - a synthetic element may have no `style`. */
function styleProp(el: HTMLElement, prop: string): string {
  try {
    const v = el.style?.getPropertyValue?.(prop);
    return typeof v === 'string' ? v.trim() : '';
  } catch {
    return '';
  }
}

function stylePx(el: HTMLElement, prop: string): number {
  const v = parseFloat(styleProp(el, prop));
  return Number.isFinite(v) ? v : 0;
}

/** The `rotate(Ndeg)` term of an inline transform - the renderRecord regex. */
export function rotationOf(transform: string): number {
  const m = /rotate\(\s*(-?[\d.]+)deg\s*\)/.exec(transform || '');
  const v = m ? parseFloat(m[1] as string) : 0;
  return Number.isFinite(v) ? v : 0;
}

function hasClass(el: HTMLElement, cls: string): boolean {
  try {
    if (el.classList?.contains?.(cls)) return true;
  } catch {
    /* synthetic element */
  }
  return Boolean(el.querySelector?.(`.${cls}`));
}

/**
 * What kind of thing this box paints.
 *
 * `video` also matches a box whose `<video>` has already been swapped for a frozen
 * still by export.ts's `snapshotMotion` - that swap copies the video's className, so
 * `.lolly-box-video` survives it. Ordering matters: an audio box carries a marker
 * div and nothing else, and must never fall through to `static`.
 */
export function layerKind(el: HTMLElement): SeqLayer['kind'] {
  // A frames-as-scenes page ([data-pdf-page]) is captured as ONE still per
  // slide. So it is a STATIC scene layer even when it contains a <video>/lottie
  // child. Check this first, before the descendant probes below, so the frame is never
  // mis-classified by what it holds. (Design, plan 92.)
  if (el.getAttribute?.('data-pdf-page') != null) return 'static';
  // Check for a CAMERA (plan 104 section 5.4) before every media probe. This mirrors the hooks' own rule
  // that a camera is keyed off `kind` ALONE: the marker div is all a camera box ever
  // contains, so nothing it might pick up later can re-classify it. Detection uses the
  // marker, not the class name, because `[data-cam]` is what the hooks promise both
  // evaluators. The audio precedent below only works because both evaluators detect it the same way.
  if (el.getAttribute?.('data-cam') != null || el.querySelector?.('[data-cam]')) return 'camera';
  if (hasClass(el, 'lolly-box-audio') || el.querySelector?.('[data-audio-src]')) return 'audio';
  if (hasClass(el, 'lolly-box-lottie') || el.querySelector?.('[data-lottie-src]')) return 'lottie';
  if (el.querySelector?.('video') || hasClass(el, 'lolly-box-video')) return 'video';
  return 'static';
}

/**
 * The split-text half of a layer read (plans/175 WP-A): tier, gap, order, and the
 * live unit count plus the deterministic shuffle seed - both DOM facts, captured
 * here because the worker's hydrated layers have no element to count spans on.
 */
function readSplit(el: HTMLElement): Pick<SeqLayer, 'split' | 'splitStaggerMs' | 'splitOrder' | 'splitUnits' | 'splitSeed'> {
  const tierRaw = el.getAttribute?.('data-t-split') ?? null;
  const tier = isSplitTier(tierRaw) ? tierRaw : '';
  const n = tier ? (el.querySelectorAll?.('.lly-u')?.length ?? 0) : 0;
  const orderRaw = el.getAttribute?.('data-t-split-order') ?? null;
  return {
    split: tier,
    splitStaggerMs: clamp(num(el.getAttribute?.('data-t-stagger') ?? null, 60), 0, MAX_SPLIT_STAGGER_MS),
    splitOrder: isSplitOrder(orderRaw) && orderRaw !== '' ? orderRaw : '',
    splitUnits: n,
    splitSeed: splitSeedOf(el.getAttribute?.('data-box-id') ?? '', n),
  };
}

/**
 * Does this layer's transition run per text unit (plans/175 WP-A)? Static picture
 * boxes only - media kinds keep their whole-box transitions - and a box that split
 * into fewer than two units animates as a block, exactly as if no tier were authored.
 */
export function splitActive(layer: Pick<SeqLayer, 'split' | 'splitUnits' | 'kind'>): boolean {
  return layer.split !== '' && layer.splitUnits > 1 && layer.kind === 'static';
}

/**
 * Is a split layer's per-unit animation MID-FLIGHT at `tMs`? The live-raster memo
 * keys on this: inside a window every frame is a fresh shot, outside them one
 * at-rest shot serves the whole clip. Windows mirror the DOM applier's exactly -
 * enter runs even with no authored kind (the cut/typewriter tier), exits need an
 * authored kind and a bounded box.
 */
export function splitAnimatingAt(layer: SeqLayer, tMs: number, totalMs: number): boolean {
  if (!splitActive(layer)) return false;
  const total = Number.isFinite(totalMs) && totalMs > 0 ? totalMs : 0;
  const durMs = layer.openEnded && total > 0 ? Math.max(0, total - layer.startMs) : layer.durMs;
  const local = tMs - layer.startMs;
  const enterPhase = layer.enter && layer.enter !== 'none' ? layer.enterMs : 0;
  const enterWin = layer.splitStaggerMs > 0 || enterPhase > 0
    ? splitPhaseWindowMs(layer.splitStaggerMs, layer.splitUnits, enterPhase) : 0;
  if (local >= 0 && local < enterWin) return true;
  if (layer.exit && layer.exit !== 'none' && !layer.openEnded) {
    const exitWin = splitPhaseWindowMs(layer.splitStaggerMs, layer.splitUnits, layer.exitMs);
    if (local <= durMs && durMs - local < exitWin) return true;
  }
  return false;
}

/**
 * Read one `.lolly-box` into a SeqLayer.
 *
 * Tolerant of EVERYTHING. A hand-authored URL can set any of these attributes,
 * so the result must always be a legal layer, never a NaN
 * that breaks a 900-frame render halfway through.
 */
export function readLayer(el: HTMLElement, idx: number, totalMs: number): SeqLayer {
  const startRaw = el.getAttribute?.('data-t-start') ?? null;
  const durRaw = el.getAttribute?.('data-t-dur') ?? null;
  const durNum = durRaw == null || durRaw === '' ? Number.NaN : parseFloat(durRaw);
  const openEnded = !Number.isFinite(durNum);
  const startMs = clamp(num(startRaw, 0), 0, MAX_TIME_MS);
  const enter = el.getAttribute?.('data-t-enter') ?? null;
  const exit = el.getAttribute?.('data-t-exit') ?? null;
  const total = Number.isFinite(totalMs) && totalMs > 0 ? totalMs : 0;
  // Split the authored `filter` HERE, once per parse, not per frame:
  // the blur radius goes into the fold; the rest passes through untouched (section 5.5).
  const fx = splitFilterBlur(styleProp(el, 'filter'));
  return {
    el,
    idx,
    startMs,
    // An open-ended box (scenery, or a clip with no authored length) runs to the end
    // of the sequence, the same way sequence-clock's endOf reads it.
    durMs: openEnded ? Math.max(0, total - startMs) : clamp(durNum, 0, MAX_TIME_MS),
    clipInMs: clamp(num(el.getAttribute?.('data-clip-in') ?? null, 0), 0, MAX_TIME_MS),
    speed: clamp(num(el.getAttribute?.('data-t-speed') ?? null, 1), MIN_SPEED, MAX_SPEED),
    mute: (el.getAttribute?.('data-t-mute') ?? null) === '1',
    ignored: (el.getAttribute?.('data-t-ignored') ?? null) === '1',
    gain: clamp(num(el.getAttribute?.('data-t-gain') ?? null, 1), 0, 2),
    pan: clamp(num(el.getAttribute?.('data-t-pan') ?? null, 0), -1, 1),
    duck: clamp(num(el.getAttribute?.('data-t-duck') ?? null, 1), 0, 1),
    pitch: clamp(num(el.getAttribute?.('data-t-pitch') ?? null, 0), -12, 12),
    varispeed: (el.getAttribute?.('data-t-varispeed') ?? null) === '1',
    fx: (el.getAttribute?.('data-t-fx') ?? '').slice(0, 200),
    enter: isTransitionKind(enter) ? enter : null,
    enterMs: clamp(num(el.getAttribute?.('data-t-enter-ms') ?? null, DEFAULT_TRANSITION_MS), MIN_TRANSITION_MS, MAX_TRANSITION_MS),
    exit: isTransitionKind(exit) ? exit : null,
    exitMs: clamp(num(el.getAttribute?.('data-t-exit-ms') ?? null, DEFAULT_TRANSITION_MS), MIN_TRANSITION_MS, MAX_TRANSITION_MS),
    enterEase: el.getAttribute?.('data-t-enter-ease') || '',
    exitEase: el.getAttribute?.('data-t-exit-ease') || '',
    ...readSplit(el),
    hold: ((): HoldFx | '' => {
      const v = el.getAttribute?.('data-t-hold') ?? null;
      return isHoldFx(v) ? v : '';
    })(),
    holdRate: clamp(num(el.getAttribute?.('data-t-hold-rate') ?? null, DEFAULT_HOLD_RATE), MIN_HOLD_RATE, MAX_HOLD_RATE),
    lane: (el.getAttribute?.('data-t-lane') ?? null) === 'seq' ? 'seq' : '',
    kind: layerKind(el),
    rect: {
      x: stylePx(el, 'left'),
      y: stylePx(el, 'top'),
      w: Math.max(0, stylePx(el, 'width')),
      h: Math.max(0, stylePx(el, 'height')),
      rot: rotationOf(styleProp(el, 'transform')),
    },
    opacity: clamp(num(styleProp(el, 'opacity') || null, 1), 0, 1),
    blend: styleProp(el, 'mix-blend-mode'),
    radius: styleProp(el, 'border-radius'),
    clipPath: styleProp(el, 'clip-path'),
    openEnded,
    frameTransition: el.getAttribute?.('data-pdf-page') != null ? deckTransitionOf(el) : '',
    frameScene: el.getAttribute?.('data-pdf-page') != null,
    z: readDepthZ(el.getAttribute?.('data-t-z') ?? null),
    rx: readTiltDeg(el.getAttribute?.('data-t-rx') ?? null),
    ry: readTiltDeg(el.getAttribute?.('data-t-ry') ?? null),
    kf: kfTrackOf(el.getAttribute?.('data-t-kf') ?? null),
    blur: fx.blur,
    shadowFilter: fx.rest,
  };
}

/**
 * Re-anchor a timed FRAME-PAGE scene layer to the OUTPUT viewport (ISSUE 1).
 *
 * A "Design" frames slideshow places its pages side by side on the pasteboard. So a
 * page's authored `left`/`top` (the rect readLayer read) puts slides 2..N off the
 * one-slide-wide output canvas: the "only slide 1 shows" bug. For a frameScene layer
 * this rewrites the DRAW rect to `(0, 0, nativeW, nativeH)`, where nativeW/nativeH are
 * the output's pre-scale native size (a frame's own size; see renderSequence's
 * frames-mode branch). `drawItem` then translates to the viewport centre and draws the
 * plate over the full `outW × outH`. So each slide fills its window regardless of the
 * frame's spatial x/y.
 *
 * PURE and compositor-only: it returns a COPY with a new rect and leaves the committed
 * model (the frame's real x/y, its [data-pdf-page] export page) untouched. So the
 * carousel still lays out side by side in the editor and still exports as multi-page
 * PDF. A non-frameScene layer (every object-clip `.lolly-box`) is returned unchanged.
 * So the object-clip Video / Sequence Studio path stays byte-identical.
 */
export function normalizeFrameScene(layer: SeqLayer, nativeW: number, nativeH: number): SeqLayer {
  if (!layer.frameScene) return layer;
  const w = Number.isFinite(nativeW) && nativeW > 0 ? nativeW : layer.rect.w;
  const h = Number.isFinite(nativeH) && nativeH > 0 ? nativeH : layer.rect.h;
  // Contain-fit (plans/141 WP-C): artboards stay freely mixed-size in the doc, and the
  // FORMAT resolves them at export time - a slide whose aspect differs from the output
  // frame letterboxes (centred, aspect kept) rather than stretching. A slide matching
  // the output aspect fills it exactly, so a uniform slideshow is byte-identical.
  const lw = layer.rect.w > 0 ? layer.rect.w : w;
  const lh = layer.rect.h > 0 ? layer.rect.h : h;
  const s = Math.min(w / lw, h / lh);
  const dw = lw * s;
  const dh = lh * s;
  return { ...layer, rect: { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh, rot: 0 } };
}

/**
 * Parse a render target into a sequence stage, or null when it isn't one.
 *
 * "Is one" means the node, or a descendant, carries `[data-sequence]` - the
 * all-or-nothing marker the tool hook stamps on the artboard when the composition
 * has anything timed at all. Everything below is read from THAT element, not from
 * `node`, so an export wrapper around the artboard changes nothing.
 */
export function parseSequenceStage(node: HTMLElement): SequenceStage | null {
  if (!node) return null;
  const stage = node.matches?.('[data-sequence]')
    ? node
    : (node.querySelector?.('[data-sequence]') as HTMLElement | null);
  if (!stage) return null;
  const msEl = stage.matches?.('[data-seq-ms]')
    ? stage
    : (stage.querySelector?.('[data-seq-ms]') as HTMLElement | null)
      ?? (node.querySelector?.('[data-seq-ms]') as HTMLElement | null);
  const rawMs = num(msEl?.getAttribute?.('data-seq-ms') ?? null, 0);
  const totalMs = rawMs > 0 ? Math.min(rawMs, MAX_TIME_MS) : 0;
  // Frames-as-scenes (Design, plan 92): a doc can time whole FRAME
  // PAGES end-to-end (`data-t-start` on each `[data-pdf-page]`) instead of individual
  // `.lolly-box` clips. When any timed frame page exists, the scene layers ARE those
  // pages. Each page is captured whole and gated so exactly one shows at the playhead.
  // Their `.lolly-box` children are NOT separate layers (they belong to the frame's
  // picture), and neither are the pasteboard scratch boxes (the paged export excludes
  // those too). This is a mode branch, not a selector swap: an object-clip Video / Sequence
  // Studio doc carries no `[data-pdf-page]`, so it falls through to the `.lolly-box`
  // enumeration unchanged, keeping its timed clips AND its open-ended scenery.
  const frames = stage.querySelectorAll
    ? [...stage.querySelectorAll<HTMLElement>('[data-pdf-page][data-t-start]')]
    : [];
  // Sound INSIDE a timed page. A narration clip (plans/180) lives in its slide's page,
  // on the seq lane, and an audio box paints nothing - it only sounds. The walk above
  // stops at the page, so every narrated export was silent (2026-09-03). Timed audio
  // boxes under a timed page join the walk as audio layers of their own, read from
  // their own attributes; the page stays the one still it always was.
  const soundInPages = frames.length > 0 && stage.querySelectorAll
    ? [...stage.querySelectorAll<HTMLElement>('[data-pdf-page][data-t-start] .lolly-box[data-t-start]')]
        .filter((b) => b.getAttribute?.('data-pdf-page') == null
          && (hasClass(b, 'lolly-box-audio') || !!b.querySelector?.('[data-audio-src]')))
    : [];
  const els = frames.length > 0
    ? [...frames, ...soundInPages]
    : (stage.querySelectorAll ? [...stage.querySelectorAll<HTMLElement>('.lolly-box')] : []);
  return { layers: applyDeckTransitions(els.map((el, i) => readLayer(el, i, totalMs))), totalMs };
}

/**
 * The slide transition a timed frame page plays into the next one - the page's own
 * `data-frame-transition`, else the deck's `data-deck-transition` (the Design hook stamps
 * it on the render root when the document's Slide transition is not the default), else
 * 'slide', which is what views/tool.ts hands the presenter when nothing is set.
 */
export function deckTransitionOf(el: HTMLElement): string {
  const own = (el.getAttribute?.('data-frame-transition') ?? '').trim();
  if (own) return own;
  const root = (el.closest?.('[data-deck-transition]') ?? null) as HTMLElement | null;
  return (root?.getAttribute?.('data-deck-transition') ?? '').trim() || 'slide';
}

/**
 * A timed deck's slide transitions, as junction dissolves (plans/184 R2).
 *
 * The presenter plays the deck's Slide transition between consecutive slides; the
 * compositor knew nothing of it, so the mp4 of a sequenced deck cut where the podium
 * faded. Consecutive frame pages whose outgoing page resolves to fade, slide, morph or
 * flight get a fade exit on A and a fade enter on B of the presenter's own length, so
 * `crossfadeJunctions` forms the same handover it forms for two faded clips. slide,
 * morph and flight have no compositor form (no camera to fly, no boxes to morph across
 * a photographed still) and render as the dissolve - the nearest honest thing, which
 * the renderer logs. `none` cuts; `custom` leaves the page's own timeline enter/exit in
 * charge; an authored enter or exit on either side is never overridden. Only the
 * junctions change: the first page never fades in from nothing, the last never fades
 * out. The preview still cuts (a DOM page that has left its window is display:none),
 * exactly as it does for two faded clips - see the crossfadeJunctions note.
 */
export function applyDeckTransitions(layers: SeqLayer[]): SeqLayer[] {
  const pages = layers
    .filter((l) => l.frameScene && l.durMs > 0 && !l.ignored)
    .sort((a, b) => a.startMs - b.startMs || a.idx - b.idx);
  for (let i = 0; i < pages.length - 1; i++) {
    const a = pages[i] as SeqLayer;
    const b = pages[i + 1] as SeqLayer;
    if (!DECK_DISSOLVES.has(a.frameTransition ?? '')) continue;
    if (a.openEnded || Math.abs(endOf(a) - b.startMs) > 1) continue;
    if (a.exit != null || b.enter != null) continue;
    a.exit = 'fade'; a.exitMs = DECK_TRANSITION_MS; a.deckDissolve = true;
    b.enter = 'fade'; b.enterMs = DECK_TRANSITION_MS;
  }
  return layers;
}

/**
 * The same stage, re-resolved against a different length.
 *
 * Only OPEN-ENDED layers change: they have no authored duration, so "runs to the end
 * of the sequence" must be re-read against the new end (this is exactly what
 * readLayer did with the parsed `data-seq-ms`). A bounded clip keeps its authored
 * span. A longer total shows whatever the composition has past its last clip; a
 * shorter one stops rendering before the tail, because the frame grid the
 * caller builds from `totalMs` decides how far the render goes.
 */
export function withTotalMs(stage: SequenceStage, totalMs: number): SequenceStage {
  const total = Math.round(clamp(totalMs, 0, MAX_TIME_MS));
  if (!(total > 0) || total === stage.totalMs) return stage;
  return {
    totalMs: total,
    layers: stage.layers.map(l => (l.openEnded ? { ...l, durMs: Math.max(0, total - l.startMs) } : l)),
  };
}

/**
 * Honour an explicit export-bar duration.
 *
 * The rule (Fable timeline): the clip's length IS the timeline's length, unless the
 * user directly changed this export. The shell flags that change with
 * `durationUserSet`, set only when the user actually edited the duration
 * field. In that case the sequence tool's own beforeExport leaves `opts.duration` alone
 * instead of overwriting it with the derived length. Without the flag the
 * stage keeps the length it declared in `data-seq-ms`, so the export tracks the
 * timeline automatically.
 */
export function applyDurationOverride(
  stage: SequenceStage,
  opts: { duration?: unknown; durationUserSet?: unknown } | null | undefined,
): SequenceStage {
  if (!opts || opts.durationUserSet !== true) return stage;
  const secs = typeof opts.duration === 'number' ? opts.duration : parseFloat(String(opts.duration ?? ''));
  if (!Number.isFinite(secs) || secs <= 0) return stage;
  return withTotalMs(stage, secs * 1000);
}

// ── the camera view and the section 4.1 fold (shared by BOTH evaluators) ───────────

/**
 * What a stage looks THROUGH, beyond its layers: its native size and any cameras.
 *
 * Optional on every entry point, and an absent env resolves to the DEFAULT camera
 * (P = 1200, pose 0) over a zero-sized stage - which projects a z = 0 layer at
 * eff = 1, i.e. exactly nothing. That is the section 5.4 rule stated as a default rather
 * than as a special case: "no camera box → the DEFAULT camera", never a literal
 * identity, because an identity would swallow z.
 */
export interface SeqPlanEnv {
  /** Stage-native width, px BEFORE export scale S. The projection's principal point is the stage centre. */
  stageW?: number;
  /** Stage-native height, px. */
  stageH?: number;
  /**
   * The camera clips governing this stage, in DOM order (latest-in-array covering
   * `t` wins - cuts, not blends). P0 passes none and every stage runs at the default
   * camera; P1 fills this in from the `camera` layers, and nothing downstream changes.
   */
  cameras?: readonly KfCameraClip[] | null;
}

/**
 * The camera clips a parsed stage carries (section 5.4), derived from its own layers.
 *
 * DERIVED, not re-queried: a `camera` layer is an ordinary `.lolly-box` with a
 * `[data-cam]` marker inside it, already parsed into `SeqLayer` by `readLayer` - so
 * building the clips from the LAYERS rather than from the DOM is what lets the worker
 * have them too. `SeqJobLayer` carries `kind`, `z` and `kf` across `postMessage`, so
 * the executor reconstructs the identical camera track from the identical numbers
 * instead of being sent a second, separately-serialised copy that could disagree.
 *
 * Windows are BUTTED, half-open `[start, end)` - cuts, not blends (section 5.4) - and an
 * open-ended camera (no authored `data-t-dur`: the "Always on" scenery chip, or a
 * clip that simply runs to the end) has no end at all. Latest-in-array wins, and DOM
 * order is array order, so two overlapping cameras cut to the later one.
 *
 * `base` carries the camera's own `z` FIELD as the scene-default dolly. Every other
 * channel comes from the track, where a `t0` key IS the scene default (evaluation
 * clamp-holds before the first key), which is why there is no second wire for it.
 */
export function stageCameras(layers: readonly SeqLayer[] | null | undefined): KfCameraClip[] {
  if (!Array.isArray(layers)) return [];
  const out: KfCameraClip[] = [];
  for (const L of layers) {
    if (!L || L.kind !== 'camera') continue;
    out.push({
      start: L.startMs,
      end: L.openEnded ? null : L.startMs + L.durMs,
      base: L.z !== 0 ? { z: L.z } : null,
      track: L.kf.length > 0 ? L.kf : null,
    });
  }
  return out;
}

/**
 * Does a camera exist that MOVES - i.e. that makes a layer's effects vary from frame
 * to frame, so its plate cannot carry them (section 5.5, P1 obligation 1)?
 *
 * Asked ONCE per render, over the whole camera set, because a plate is shot once for
 * the whole render while `projecting` is a per-frame question. A camera that is
 * anywhere other than the default at any instant changes eff (hence the magnification
 * a plate is shot for) or the depth-of-field radius, and a filter baked into a plate
 * cannot follow either - so `ownsLayerFx` has to hear about it.
 *
 * Deliberately COARSE: any track at all counts, and so does any base that is not the
 * documented default pose. A false positive costs a compositor-owned filter on a
 * document that has a camera; a false negative bakes a blur that was supposed to
 * change. Only the first is recoverable, and only documents authored after this
 * feature can have a camera at all, so the byte-identity floor is untouched.
 */
export function camerasMove(cameras: readonly KfCameraClip[] | null | undefined): boolean {
  if (!Array.isArray(cameras)) return false;
  for (const c of cameras) {
    if (!c || typeof c !== 'object') continue;
    if (Array.isArray(c.track) && c.track.length > 0) return true;
    const b = c.base;
    if (!b || typeof b !== 'object') continue;
    if ((b.x ?? 0) !== 0 || (b.y ?? 0) !== 0 || (b.z ?? 0) !== 0) return true;
    if ((b.a ?? 0) !== 0 || (b.f ?? 0) !== 0) return true;
    if (b.p != null && b.p !== DEFAULT_PERSPECTIVE) return true;
    // A tilt is a camera away from its default, the same as a pan
    // (P2). It changes every projectable layer's magnification and its DOF distance,
    // so a plate cannot hold a filter shot from a single instant here either.
    if (cameraTilted(b)) return true;
  }
  return false;
}

/**
 * Does any camera in this set author a TILT, and if so, which channel and how much
 * (P2, section 6.4)?
 *
 * This is the gate `renderSequence` branches on. It has the same COARSE shape as `camerasMove`
 * for the same reason: it is asked once for a whole render, over the whole camera set,
 * because the answer decides which compositor runs, and that cannot change mid-film.
 * Any non-zero `rx`/`ry` anywhere, in a base pose or in any keyframe of any camera,
 * makes the render a tilted one, even if the angle is zero for most of its length.
 *
 * It returns the TRIGGER rather than a boolean because section 6.4 asks for the gate to be
 * "logged with the trigger": a user whose export just took a ten-times-slower path
 * should see the name of the channel that caused it.
 */
export function camerasTilt(
  cameras: readonly KfCameraClip[] | null | undefined,
): { ch: 'rx' | 'ry'; deg: number; atMs: number | null } | null {
  if (!Array.isArray(cameras)) return null;
  for (const c of cameras) {
    if (!c || typeof c !== 'object') continue;
    const b = c.base;
    if (b && typeof b === 'object') {
      for (const ch of ['rx', 'ry'] as const) {
        const v = b[ch];
        if (typeof v === 'number' && Number.isFinite(v) && v !== 0) return { ch, deg: v, atMs: null };
      }
    }
    if (!Array.isArray(c.track)) continue;
    for (const key of c.track) {
      for (const ch of ['rx', 'ry'] as const) {
        const v = key?.v?.[ch];
        if (typeof v === 'number' && Number.isFinite(v) && v !== 0) {
          return { ch, deg: v, atMs: (typeof c.start === 'number' ? c.start : 0) + key.t };
        }
      }
    }
  }
  return null;
}

/**
 * Does any BOX on this stage author a tilt of its own, and if so which channel and how
 * much (P2.1)?
 *
 * `camerasTilt`'s sibling, in the same shape and for the same reason: `renderSequence`
 * asks both once per render and takes the homography tier if either answers. Without
 * it a box-tilt-only document walks into the canvas compositor, whose transform is
 * affine by definition, and exports the centre-magnified approximation of a trapezoid -
 * a silently wrong picture, in the export only, with the preview correct.
 *
 * COARSE on purpose, and it is an exact NON-ZERO VALUE test rather than "has an rx/ry
 * track": gating on the track alone would move every existing tumble onto the slower
 * tier for the frames where its angle is zero, and the untilted floor has to stay
 * untouched by construction. Skips the layers the projection excludes (audio beds,
 * camera markers, frame pages) - a camera's own tilt is `camerasTilt`'s answer.
 */
export function boxesTilt(
  layers: readonly SeqLayer[] | null | undefined,
): { ch: 'rx' | 'ry'; deg: number; atMs: number | null } | null {
  if (!Array.isArray(layers)) return null;
  // A frames DOCUMENT is out of depth scope wholesale (the planner short-circuits
  // `projecting` on the same condition), so a tilt there renders as nothing - reporting
  // it would only send the export to the slow capture tier for a picture it cannot change.
  if (layers.some((l) => l?.frameScene)) return null;
  for (const layer of layers) {
    if (!layer || !isProjectable(layer)) continue;
    for (const ch of ['rx', 'ry'] as const) {
      const v = layer[ch];
      if (typeof v === 'number' && Number.isFinite(v) && v !== 0) return { ch, deg: v, atMs: null };
    }
    if (!Array.isArray(layer.kf)) continue;
    for (const key of layer.kf) {
      for (const ch of ['rx', 'ry'] as const) {
        const v = key?.v?.[ch];
        if (typeof v === 'number' && Number.isFinite(v) && v !== 0) {
          return { ch, deg: v, atMs: (Number.isFinite(layer.startMs) ? layer.startMs : 0) + key.t };
        }
      }
    }
  }
  return null;
}

/** The camera + stage `t` is projected through. One resolution per frame, shared by every layer. */
export function planCameraView(env: SeqPlanEnv | null | undefined, tMs: number): KfCameraView {
  const w = Number(env?.stageW);
  const h = Number(env?.stageH);
  return {
    ...resolveCamera(env?.cameras ?? null, tMs),
    w: Number.isFinite(w) && w > 0 ? w : 0,
    h: Number.isFinite(h) && h > 0 ? h : 0,
  };
}

/**
 * True when a view moves something that is NOT lifted, that is, when even a z = 0 box
 * has to be projected. A pan/dolly/aperture does this; perspective strength alone does
 * not (section 4.3: `eff(z = camZ) === 1` for every `p`, so on a flat scene `p` is a no-op).
 *
 * This check is for cost and byte-identity, not correctness. When it is false, a stage
 * only projects the boxes that authored depth themselves. Every other
 * box takes the exact same path it took before this feature existed.
 */
export function viewMoves(view: KfCameraView): boolean {
  // TILT COUNTS (P2). A tilted camera moves a z = 0 box more than a pan does; it
  // reshapes it. Leaving tilt out here would leave every flat layer on the
  // screen-parallel path while the lifted ones pitched, breaking the artwork apart.
  // Use the same test as the pan: "does even a flat box have to be
  // projected".
  return view.x !== 0 || view.y !== 0 || view.z !== 0 || view.a > 0 || cameraTilted(view);
}

/** The surface-space inputs one layer brings to the fold. */
export interface KfFoldInput {
  view: KfCameraView;
  /** Authored centre, stage-native px. */
  cx: number;
  cy: number;
  /** The transition's own offsets - `recTransition`'s numbers, verbatim. */
  tr: { dx: number; dy: number; sc: number; alpha: number; rot: number };
  /** The keyframe pose at this instant (`{}` when the box has no track). */
  pose: KfPose;
  /** The box's `z` FIELD. A `z` token in the pose replaces it (section 5.2). */
  zField: number;
  /**
   * The box's own TILT fields, degrees (P2.1). An `rx`/`ry` token in the pose replaces
   * the field for its segment, which is `z`'s rule verbatim. Optional so every
   * pre-P2.1 call site is byte-identical: absent means "no tilt authored", the engine's
   * exact-zero gate answers false, and the fold hands back the numbers it always did.
   */
  rxField?: number;
  ryField?: number;
  /** The box's authored blur radius, px. */
  authoredBlur: number;
  /**
   * The box's AUTHORED size, stage-native px - the base a `w`/`h` token replaces
   * (section 5.2, P1). Optional so every pre-w/h caller keeps its exact behaviour: absent
   * means "no size to tween", and the fold hands back the same numbers it always did.
   */
  boxW?: number;
  boxH?: number;
}

/** What the fold hands back. Every consumer applies these numbers; none re-derives them. */
export interface KfFold {
  /** Projected offset from the authored centre - the transition AND keyframe offsets are inside it. */
  dx: number;
  dy: number;
  /** Transition scale × keyframe scale × eff. */
  scale: number;
  /** Transition rotation + keyframe rotation, degrees. */
  rot: number;
  /** Transition alpha × keyframe opacity × the behind-camera guard. */
  alpha: number;
  /** TOTAL blur, px at stage-native scale: authored + keyframe `b` + depth-of-field. */
  blur: number;
  /** The depth this layer resolved to - the projection input AND the section 4.2 paint-order key. */
  z: number;
  /**
   * The layer's RESOLVED size at this instant, stage-native px: its authored size
   * unless a `w`/`h` token replaced it (section 5.2, P1). Equal to the authored size on
   * every layer that keyframes no size, which is the byte-identity floor - the DOM
   * writes no `width`/`height` and the compositor draws the same rect it always did.
   */
  w: number;
  h: number;
  /** True when `w`/`h` are a keyed size rather than the box's own - the reflow flag. */
  sized: boolean;
  /**
   * P2 - the element-local homography a TILTED camera needs, or null (every other
   * case, which is every document before this milestone).
   *
   * It REPLACES the leading `translate(dx, dy)` in a DOM consumer's transform list and
   * changes nothing else: `scale` still carries eff and `rot` is still applied after
   * it, because the engine divides the centre magnification back out of the matrix.
   * `dx`/`dy` stay populated - they are the projected CENTRE, which is what the chrome
   * (handles, motion path) reads - so a consumer that only wants a position needs to
   * know nothing about tilt.
   *
   * The CANVAS compositor has no way to draw this: `setTransform` is affine by
   * definition. That is why a tilted export is captured off the live DOM instead
   * (section 6.4's P2a capture tier), gated in `renderSequence` before a plate is shot.
   */
  m3: KfMatrix3 | null;
}

/**
 * The section 4.1 fold, assembled once for both evaluators.
 *
 * The maths is the engine's (`projectLayer`, `dofBlur`); what lives here is the
 * ORDER - authored → transition → keyframe → camera projection - and the channel
 * semantics of section 5.2: `x/y` fold into the projected offset, `s` multiplies the
 * transition scale, `r` adds to the rotation, `o` multiplies the alpha, `b` adds over
 * the authored blur, and a keyed `z` replaces the box's own field for that segment.
 *
 * ONE deliberate departure from calling `projectLayer` blind: when the projection is
 * an EXACT identity - eff = 1 and the camera parked at the origin - the offsets are
 * taken straight from the transition instead of round-tripping through
 * `W/2 + (cx + dx − W/2)`. That expression is identity in ℝ and NOT in IEEE-754
 * (W = 1920, cx = 10, dx = 0.1 comes back as 0.10000000000002274), and a document
 * that uses no depth at all must export byte-identically to what it exported before
 * this feature existed. The short-circuit is the byte-identity floor, not an
 * optimisation, and it is here - in the one function both paths call - precisely so
 * it cannot be applied on one side and forgotten on the other.
 */
export function foldKfPose(inp: KfFoldInput): KfFold {
  const { pose, tr, view } = inp;
  const z = typeof pose.z === 'number' ? pose.z : inp.zField;
  // The box's own tilt, on `z`'s rule exactly: the FIELD is the base, and a keyed
  // rx/ry REPLACES it for that segment - so a tumble whose last key omits the channel
  // settles back onto whatever the box authored, which is flat on a box that authored
  // nothing (P2.1).
  const rx = typeof pose.rx === 'number' ? pose.rx : (inp.rxField ?? 0);
  const ry = typeof pose.ry === 'number' ? pose.ry : (inp.ryField ?? 0);
  const boxTilted = cameraTilted({ rx, ry });
  const dxK = pose.x ?? 0;
  const dyK = pose.y ?? 0;
  // SIZE, and it moves the anchor (section 5.2, P1). `w`/`h` are ABSOLUTE px that replace the
  // box's own size for their segment, and a box grows from its top-left in both
  // evaluators - the DOM because `left`/`top` are what is authored and `width`/`height`
  // are what is written, the canvas because `rect.x/y` is the draw origin. So the
  // CENTRE the projection anchors on moves by half the growth, and it has to move here,
  // in the one function both evaluators call, or the preview and the export disagree
  // about where a stretched box's middle is. `sized` is false on every layer that
  // keyframes no size, and then every expression below is the one that shipped.
  const boxW = Number.isFinite(inp.boxW) ? (inp.boxW as number) : 0;
  const boxH = Number.isFinite(inp.boxH) ? (inp.boxH as number) : 0;
  const keyedW = typeof pose.w === 'number' && boxW > 0;
  const keyedH = typeof pose.h === 'number' && boxH > 0;
  // `parseKf` already held the token to `KF_CLAMPS`; re-held here because a pose can
  // also be built by hand (a rebase, a test) and a NaN width would size a plate to NaN.
  const w = keyedW ? clamp(pose.w as number, KF_CLAMPS.w[0], KF_CLAMPS.w[1]) : boxW;
  const h = keyedH ? clamp(pose.h as number, KF_CLAMPS.h[0], KF_CLAMPS.h[1]) : boxH;
  // The layer scale WITHOUT eff - what the box's own extent is multiplied by before the
  // projection sees it. Read only by the tilted branch, which needs the posed corners to
  // find the layer's nearest approach to the near plane (the guard generalisation).
  const layerScale = typeof pose.s === 'number' ? tr.sc * pose.s : tr.sc;
  const proj = projectLayer(view, {
    bx: inp.cx + (w - boxW) / 2,
    by: inp.cy + (h - boxH) / 2,
    dxT: tr.dx, dyT: tr.dy, dxK, dyK, z,
    w: w * layerScale, h: h * layerScale,
    rx, ry,
  });
  // `!cameraTilted` FIRST, and it is not redundant. The rest of this test was written
  // for the affine tier, where `eff === 1` and a parked camera really do imply
  // `proj.dx === tr.dx + dxK` in ℝ. Under tilt that implication is false: `proj.scale`
  // is `P/D` at the layer's posed CENTRE and can be exactly 1 - `ry = 45` puts
  // `sin = cos` in IEEE, so a layer at `z = −100` off to one side lands `dC === P`
  // exactly - while the homography has still moved that centre 41 px sideways. Taking
  // the transition offset there would throw the projection away and hand the chrome
  // (handles, motion path) a centre the render does not use. The clause is an exact
  // zero test on rx/ry, so the untilted byte-identity floor is untouched by
  // construction: with no angle authored, `flat` is the expression that shipped.
  // …and `!boxTilted` for the same reason one step in (P2.1). A box tilt under a parked
  // camera leaves `proj.scale` at exactly 1 and the camera at the origin, so `flat`
  // would be true and the transition offset taken straight through - while the matrix
  // handed to the consumers embeds `proj.dx`. Identical in ℝ, ~2e-14 px apart in
  // IEEE-754, and the "one number, both consumers" law is broken either way round.
  const flat = !cameraTilted(view) && !boxTilted && proj.scale === 1 && view.x === 0 && view.y === 0;
  // DOF IS A SCREEN-SPACE NUMBER; THE OTHER TWO ARE LAYER-SPACE ONES. `dofBlur`
  // already carries `eff(z)·eff(f)` (section 4.4) and is documented as "px at stage-native
  // scale" - i.e. what the viewer sees. But BOTH executors apply `PlanItem.blur` in
  // the layer's own space and then magnify the result by `item.scale`, which contains
  // eff: the canvas blurs a plate-resolution scratch and draws it under
  // `ctx.scale(item.scale)`, and CSS applies `filter` before `transform`. So the
  // authored blur and the kf `b` channel are correctly magnified by eff (that is what
  // they did before this feature existed, and what a CSS blur has always done), while
  // the DOF term would be magnified by eff a SECOND time - eff², up to 100× at the
  // guard. Dividing it out here, in the one function both evaluators call, is what
  // makes the number the viewer sees the number section 4.4 defines.
  const dof = proj.scale > 0 ? dofBlur(view, z) / proj.scale : dofBlur(view, z);
  return {
    dx: flat ? tr.dx + dxK : proj.dx,
    dy: flat ? tr.dy + dyK : proj.dy,
    scale: (typeof pose.s === 'number' ? tr.sc * pose.s : tr.sc) * proj.scale,
    rot: typeof pose.r === 'number' ? tr.rot + pose.r : tr.rot,
    alpha: (typeof pose.o === 'number' ? tr.alpha * pose.o : tr.alpha) * proj.alphaGuard,
    blur: clamp(inp.authoredBlur + (pose.b ?? 0) + dof, 0, KF_MAX_BLUR),
    z,
    w,
    h,
    sized: keyedW || keyedH,
    m3: proj.m,
  };
}

/**
 * Does this layer take part in the projection at all (section 5.4 exclusions)?
 *
 * Audio beds and camera markers paint nothing, and a `[data-pdf-page]` frame page is
 * out of scope for v1 - "camera + kf apply only to boxes on a `[data-sequence]`
 * stage; frame pages are excluded from projection and cannot carry kf". The hooks
 * already refuse to stamp `data-t-z`/`data-t-kf` on a frame; this is the reader's own
 * half of that contract, so a hand-written attribute cannot smuggle one in either.
 */
export function isProjectable(layer: Pick<SeqLayer, 'kind' | 'frameScene'>): boolean {
  return layer.kind !== 'audio' && layer.kind !== 'camera' && !layer.frameScene;
}

/**
 * Does the COMPOSITOR own this layer's filter, or does its plate keep it?
 *
 * section 5.5 hands the whole blur to the planner - plate shot clean, `PlanItem.blur`
 * applied once by the executor. That is right for a layer with depth, and it is a
 * REGRESSION for one without: `shadow: content` is pre-104 vocabulary that the hooks
 * have always emitted as `filter: drop-shadow(...)`, and a document using it, with no
 * `kf`, no `z` and no depth shadow, would otherwise get a padded plate, a
 * filter-neutralised shot and a canvas-recreated shadow - `ctx.filter` on Chromium, a
 * `source-in` fill plus a JS box blur on WebKit. Measurably not the bytes it exported
 * yesterday. The byte-identity floor is the harder promise, so it wins: ownership
 * moves only for a layer that actually authored depth.
 *
 * ONE PREDICATE, THREE OBEYING SITES - the plate's `pad`, the plate's
 * filter-neutralisation and `itemFx` - because the plate is shot ONCE for the whole
 * render while `projecting` is a per-frame question. Hence `cameraMoves`: a camera
 * that moves at any point in the window makes every projectable layer's fx
 * compositor-owned for the whole render. P1 passes it; M1 has no cameras, so it is
 * false and the predicate reduces to "this box authored z or a track".
 */
export function ownsLayerFx(
  layer: Pick<SeqLayer, 'kind' | 'frameScene' | 'z' | 'kf'>, cameraMoves = false,
): boolean {
  return isProjectable(layer) && (cameraMoves || layer.z !== 0 || layer.kf.length > 0);
}

// ── the draw plan ───────────────────────────────────────────────────────────

/** One layer's fully-resolved state at one instant. The executor just draws it. */
export interface PlanItem {
  /**
   * The layer, with `durMs` resolved against the totalMs the plan was asked for
   * (an open-ended box is handed back as a copy carrying the span it actually ran
   * for). `layer.el` is always the original element reference.
   */
  layer: SeqLayer;
  /**
   * Position inside the layer's own source media, seconds - `clipIn + local × speed`.
   * null for a `static` layer (there is no source to seek).
   */
  sourceSec: number | null;
  /** Authored opacity × the transition's alpha, 0–1. */
  alpha: number;
  /** Transition translation, px (applied OUTSIDE the rotation, like the clock). */
  dx: number;
  dy: number;
  /** Transition scale about the box centre, times the keyframe scale and the projection's eff. */
  scale: number;
  /** Authored rotation + the transition's + the keyframe's, degrees. */
  rot: number;
  /**
   * TOTAL blur radius, px at stage-native scale (× S at export): the box's authored
   * blur + the keyframe `b` channel + depth-of-field. The PLANNER owns the whole
   * number (section 5.5) - an executor applies exactly this and nothing else, and a plate
   * shot with the element's own filter still on it would then blur twice.
   *
   * Equals `item.layer.blur` on every layer that authors no depth, which is what
   * keeps a clean document's plates and draws identical to today.
   */
  blur: number;
  /**
   * The layer's DRAW size at this instant, stage-native px - its authored
   * `rect.w`/`rect.h` unless the track keyed `w`/`h` (section 5.2, P1). An executor sizes
   * and anchors from THESE, not from the rect, so a stretched box occupies
   * `[rect.x, rect.x + w)` exactly as it does in the reflowed DOM.
   */
  w: number;
  h: number;
  /**
   * True when `w`/`h` came from the track. The compositor's reflow flag: a sized
   * layer's plate must be re-captured per frame (the live-raster path), because a
   * stretched plate is a stretched picture and the preview REFLOWS - text rewraps,
   * a border stays one pixel. Parity beats speed (section 5.2).
   */
  sized: boolean;
  /**
   * The depth this layer resolved to at this instant - the `z` field unless a `z`
   * token in the track overrode it. This is the section 4.2 paint-order key: the plan comes
   * back sorted by it (ascending - higher z is nearer the camera, so it paints last).
   */
  resolvedZ: number;
  /**
   * P2 - `KfFold.m3`, carried through. Null on every untilted camera, which is the
   * only case a canvas executor can draw: `drawItem` composes an affine transform and
   * there is no affine spelling of a homography. A non-null value here means the frame
   * belongs to the P2a capture tier, and `renderSequence` has already gated on the
   * camera set before any plate was photographed - an executor that met one anyway
   * would draw the centre-magnified approximation rather than nothing, which is the
   * survivable direction.
   */
  m3: KfMatrix3 | null;
}

const IDENTITY = { dx: 0, dy: 0, sc: 1, alpha: 1, rot: 0 } as const;

/** The at-rest transition - exported so the DOM path folds through the same zero. */
export const REST_TRANSITION = IDENTITY;

/** A layer's nominal end, ms - before any crossfade extension. */
export function endOf(layer: SeqLayer): number {
  return layer.startMs + layer.durMs;
}

/**
 * The junction crossfades a set of layers IMPLIES, as `layer.idx → extra ms`.
 *
 * Phase 2 stores no overlap in the model: a crossfade is authored as
 * `A.exit = 'fade'`, `B.enter = 'fade'` on two GAPLESS neighbours in the seq lane,
 * and its length is `min(A.exitMs, B.enterMs)` "straddling the cut". The preview
 * cannot show that (a DOM box that has left its window is `display:none`), so the
 * export derives it here: A stays alive for that long past the cut, fading out,
 * while B fades in over the same window - so at the midpoint the two alphas are
 * equal and neither clip is ever fully absent.
 *
 * Both sides use the SAME derived length, which is what makes the alphas cross;
 * B's own longer `enterMs`, if it has one, does not stretch the handover.
 *
 * The length is ALSO clamped to `B.durMs`. Nothing else bounds it: the two
 * transition lengths are independent of the clips they belong to, so a 1000 ms
 * `exitMs` handing over to a 200 ms clip would keep A alive 800 ms past the end of
 * the very clip it was handing over to - and `recTransition`'s alpha holds at
 * exactly 1.0 for the first 40 % of a fade, so A would reappear at FULL opacity on
 * top of whatever came after B. Since B starts where A ends, clamping to `B.durMs`
 * is also what keeps the tail inside the sequence.
 *
 * Adjacency is `A.end === B.start` within a 1 ms tolerance, because the authored
 * times are rounded to milliseconds by the tool hook.
 */
export function crossfadeJunctions(layers: SeqLayer[]): { aIdx: number; bIdx: number; ms: number }[] {
  const out: { aIdx: number; bIdx: number; ms: number }[] = [];
  // A timed frame page is a sequence clip whatever lane attribute it carries: exactly
  // one shows at the playhead, so two adjacent pages can hand over like two clips.
  const seq = layers.filter((l) => (l.lane === 'seq' || l.frameScene) && l.durMs > 0).sort((a, b) => a.startMs - b.startMs || a.idx - b.idx);
  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i] as SeqLayer;
    const b = seq[i + 1] as SeqLayer;
    if (a.exit !== 'fade' || b.enter !== 'fade') continue;
    if (a.openEnded) continue;                      // no stable tail to hand over from
    // A split layer never forms a junction crossfade (plans/175): its fade runs per
    // unit inside its own window, which is also what the preview shows - so the two
    // sides simply cut, rather than export-only handover logic disagreeing with it.
    if (splitActive(a) || splitActive(b)) continue;
    if (Math.abs(endOf(a) - b.startMs) > 1) continue;
    const ms = Math.min(a.exitMs, b.enterMs, b.durMs);
    if (ms > 0) out.push({ aIdx: a.idx, bIdx: b.idx, ms });
  }
  return out;
}

/** The outgoing side of every junction crossfade: `layer.idx → extra ms of life`. */
export function crossfadeExtensions(layers: SeqLayer[]): Map<number, number> {
  return new Map(crossfadeJunctions(layers).map((j) => [j.aIdx, j.ms]));
}

/**
 * The AUDIO half of every junction crossfade (plans/165 WP-4): per layer idx, the
 * seconds its sound keeps playing past the cut (`tailSec`, the A side) and the
 * handover length its fade-in shortens to (`headSec`, the B side). Derived from the
 * SAME junctions the picture uses, so sound and picture can never disagree about
 * where a handover is or how long it lasts. A middle clip in a chain of fades
 * carries both sides at once.
 */
export function audioCrossfades(layers: SeqLayer[]): Map<number, { tailSec?: number; headSec?: number }> {
  const out = new Map<number, { tailSec?: number; headSec?: number }>();
  for (const j of crossfadeJunctions(layers)) {
    out.set(j.aIdx, { ...out.get(j.aIdx), tailSec: j.ms / 1000 });
    out.set(j.bIdx, { ...out.get(j.bIdx), headSec: j.ms / 1000 });
  }
  return out;
}

/**
 * Clip-presence duck spans for one layer (plans/165 WP-6 v1): the windows, in the
 * layer's OWN clip-local seconds, where any OTHER audible clip plays. The envelope
 * folds these in at the layer's duck-to level (clipGainEvents' `duck`); merging and
 * ramping happen there, exactly as the bed's envelope does it. The EXPORT upgraded
 * to signal-derived spans (WP-6 v2: activitySpans over the decoded PCM, in
 * sequence-render's post-loop duck pass); this presence form remains the reference
 * the preview's DOM walk (sequence-clock's duckSpansOf) mirrors - a conservative
 * superset of where the neighbours actually make sound.
 */
export function duckSpansFor(layers: SeqLayer[], self: SeqLayer): { from: number; to: number }[] {
  const a0 = self.startMs;
  const a1 = self.startMs + self.durMs;
  const out: { from: number; to: number }[] = [];
  for (const l of layers) {
    if (l === self || l.idx === self.idx) continue;
    if (l.kind !== 'video' && l.kind !== 'audio') continue;
    if (l.mute || l.ignored || l.durMs <= 0) continue;
    const from = Math.max(l.startMs, a0);
    const to = Math.min(l.startMs + l.durMs, a1);
    if (to - from > 50) out.push({ from: (from - a0) / 1000, to: (to - a0) / 1000 });
  }
  return out;
}

/** Where a layer's picture actually stops, ms - its end plus any crossfade tail. */
function liveEndOf(layer: SeqLayer, extendMs: number): number {
  return endOf(layer) + extendMs;
}

/**
 * The animation state of an ACTIVE layer at `tMs`, or null when it is at rest.
 *
 * Identical in every respect to sequence-clock's `transitionAt` - enter forward from
 * the head, exit backward into the tail, whichever is further from rest wins, exits
 * suppressed on an open-ended box - except for the crossfade case, where A's exit is
 * DEFERRED into the extension window past the cut instead of running before it, and
 * B's enter is shortened to the handover length so the two alphas cross.
 */
function transitionOf(layer: SeqLayer, tMs: number, extendMs: number, xfadeEnterMs: number | null): { kind: TransitionKind; p: number; ease: string } | null {
  // Split text (plans/175 WP-A): the UNITS carry the transition - the live-raster
  // tier photographs them mid-animation off the DOM - so the whole box is at rest
  // for the compositor's own transform/alpha. Suppressed here, at the one place a
  // whole-box transition is derived, so every executor (in-thread, worker, GL)
  // agrees without carrying its own rule.
  if (splitActive(layer)) return null;
  const local = tMs - layer.startMs;
  const enterMs = xfadeEnterMs ?? layer.enterMs;
  let enterP = 1;
  if (layer.enter && layer.enter !== 'none' && enterMs > 0 && local < enterMs) {
    enterP = clamp(local / enterMs, 0, 1);
  }
  let exitP = 1;
  if (extendMs > 0) {
    // Crossfade tail: at rest right up to the cut, then out across the handover.
    const past = tMs - endOf(layer);
    if (past >= 0) exitP = clamp(1 - past / extendMs, 0, 1);
  } else if (layer.exit && layer.exit !== 'none' && !layer.openEnded && layer.exitMs > 0) {
    const remain = endOf(layer) - tMs;
    if (remain < layer.exitMs) exitP = clamp(remain / layer.exitMs, 0, 1);
  }
  if (enterP >= 1 && exitP >= 1) return null;
  // Each phase carries its OWN authored curve. A crossfade tail is the one case where
  // the kind is not either field's ('fade', derived from the junction) - but the curve
  // still belongs to the exit the author wrote, which is the side that is leaving.
  return enterP <= exitP
    ? { kind: layer.enter as TransitionKind, p: enterP, ease: layer.enterEase }
    : { kind: (extendMs > 0 ? 'fade' : layer.exit) as TransitionKind, p: exitP, ease: layer.exitEase };
}

/**
 * Everything visible at `tMs`, in PAINT order.
 *
 * Paint order is DOM order until depth is in play, and resolved-z order once it is
 * (section 4.2): affine-per-layer only reproduces a true perspective render if draw order is
 * depth order, and z is keyframable, so two layers' z curves can cross mid-move. The
 * sort is ascending (higher z is nearer the camera → painted last), stable, with DOM
 * order as the tiebreak - and it is SKIPPED entirely when every layer resolved to
 * z = 0, so a document with no depth comes back in exactly the order it always did.
 *
 * Audio layers ARE included while they are active - the mix needs their span and
 * their `sourceSec` - but they paint nothing, and a `camera` layer is the same kind of
 * citizen: an executor must skip both when drawing, exactly as the clock skips writing
 * a transform for one.
 */
export function sequenceDrawPlan(
  layers: SeqLayer[], tMs: number, totalMs: number, env?: SeqPlanEnv | null,
): PlanItem[] {
  const t = Number.isFinite(tMs) ? tMs : 0;
  const total = Number.isFinite(totalMs) && totalMs > 0 ? totalMs : 0;
  // ONE camera resolution per frame, shared by every layer - a per-layer resolution
  // would let two layers in the same frame disagree about where the camera is.
  const view = planCameraView(env, t);
  const moving = viewMoves(view);
  // section 5.4, FRAMES-AS-SCENES IS OUT OF SCOPE FOR DEPTH IN v1 - the WHOLE document, not
  // only its pages. `isProjectable` already refuses a `[data-pdf-page]` layer, but a
  // frames document's ordinary boxes sit on the same stage, and the two evaluators are
  // told DIFFERENT stage sizes there: the exporter sizes its output to the first timed
  // frame's own box (a slideshow's `[data-sequence]` spans the side-by-side pasteboard
  // of every slide) while the applier measures the artboard. The projection's principal
  // point is `W/2`, so a divergent W is a divergent pose for every box that authored a
  // z. Rather than teach one of them the other's number for a case the plan defers
  // anyway, the whole document opts out - stated here, and pinned by the parity suite.
  const framesDoc = layers.some((l) => l.frameScene);
  // An OPEN-ENDED box runs to the end of the sequence, and the caller's totalMs is
  // the authority on where that is - a parse-time duration can be stale (the stage
  // was re-rendered, or the exporter padded the tail). Re-derive rather than trust.
  const spanOf = (l: SeqLayer): SeqLayer =>
    l.openEnded && total > 0 ? { ...l, durMs: Math.max(0, total - l.startMs) } : l;
  const spans = layers.map(spanOf);
  const junctions = crossfadeJunctions(spans);
  const ext = new Map(junctions.map((j) => [j.aIdx, j.ms]));
  // B's enter is clamped to the handover length at a crossfade junction, so the two
  // alphas cross rather than B taking its own (possibly longer) time to arrive.
  const xfadeEnter = new Map(junctions.map((j) => [j.bIdx, j.ms]));
  const out: PlanItem[] = [];
  for (const layer of spans) {
    if (layer.ignored) continue;   // struck-through: never drawn (plans/174)
    const extendMs = ext.get(layer.idx) ?? 0;
    // A zero-length window is empty - an open-ended box in an untimed composition
    // (totalMs 0), or a clip trimmed to nothing, is never on screen.
    if (layer.durMs <= 0 && extendMs <= 0) continue;
    if (t < layer.startMs || t >= liveEndOf(layer, extendMs)) continue;
    const silent = layer.kind === 'audio' || layer.kind === 'camera';
    const local = Math.max(0, t - layer.startMs);
    const tr = silent ? null : transitionOf(layer, t, extendMs, xfadeEnter.get(layer.idx) ?? null);
    const off0 = tr ? recTransition(tr.kind, tr.p, layer.rect.w, layer.rect.h, tr.ease) : IDENTITY;
    // Hold effect (plans/175 WP-B): composed exactly as the DOM applier composes it,
    // so preview and export read the same pose at every t. Whole-box, plate-free -
    // the executor's per-frame transform animates a static plate.
    const off = !silent && layer.hold
      ? withHold(off0, holdPose(layer.hold, local, layer.holdRate, layer.rect.w, layer.rect.h))
      : off0;
    // A box projects when it authored depth or a tilt of its own, or when the camera is
    // somewhere that moves even a flat layer. Nothing else touches the fold, so a
    // stage with none of them takes the pre-104 path exactly. The tilt term is not
    // optional: a box carrying only an `rx` field has no depth and no track, so
    // without it the field is inert here and the preview and the export disagree.
    const projecting = !framesDoc && isProjectable(layer)
      && (moving || layer.z !== 0 || layer.rx !== 0 || layer.ry !== 0 || layer.kf.length > 0);
    // `t` is the SEQUENCE clock; a keyframe track runs on LOCAL box time, unscaled - 
    // the same timebase as enterMs (section 5.1). Speed remaps media, never keyframes.
    const fold = projecting
      ? foldKfPose({
        view,
        cx: layer.rect.x + layer.rect.w / 2,
        cy: layer.rect.y + layer.rect.h / 2,
        tr: off,
        pose: evaluateKf(layer.kf, t - layer.startMs),
        zField: layer.z,
        rxField: layer.rx,
        ryField: layer.ry,
        authoredBlur: layer.blur,
        boxW: layer.rect.w,
        boxH: layer.rect.h,
      })
      : {
        dx: off.dx, dy: off.dy, scale: off.sc, rot: off.rot, alpha: off.alpha,
        blur: layer.blur, z: 0, w: layer.rect.w, h: layer.rect.h, sized: false, m3: null,
      };
    // A layer the behind-camera guard has ramped to 0 stays IN the plan carrying
    // alpha 0, rather than being dropped from it: `alpha <= 0` is already the
    // executor's own skip, and the truncation reconciliation counts REQUESTS against
    // draws - quietly shortening the plan is how a complete export dies as
    // SEQ_TRUNCATED (see `ReconcileInput.requestedFrames`).
    out.push({
      layer,
      sourceSec: layer.kind === 'static' || layer.kind === 'camera' ? null : (layer.clipInMs + local * layer.speed) / 1000,
      alpha: clamp(layer.opacity * fold.alpha, 0, 1),
      dx: fold.dx,
      dy: fold.dy,
      scale: fold.scale,
      rot: layer.rect.rot + fold.rot,
      blur: fold.blur,
      resolvedZ: fold.z,
      w: fold.w,
      h: fold.h,
      sized: fold.sized,
      m3: fold.m3,
    });
  }
  // section 4.2: paint order IS depth order once anything is lifted. `Array.prototype.sort`
  // is stable, and `out` was built in DOM order, so the explicit idx tiebreak is
  // belt-and-braces rather than essential - but it says out loud which order two
  // layers at the same depth keep.
  //
  // AND IT STAYS THE `z` ORDER UNDER TILT (P2), which is not obvious and is worth
  // stating. The painter order that reproduces a perspective render is the VIEW-AXIS
  // one, and a pitched camera's view axis is not the z axis. But the layers are
  // PARALLEL PLANES: the view-axis depth of a plane is `P − (… + κ·(z − camZ))` with
  // `κ = cos(rx)·cos(ry)`, so for κ > 0 a higher `z` is nearer EVERYWHERE the two
  // overlap, and sorting by z and sorting by view-axis distance are the same sort.
  //
  // **κ > 0 IS THE CONDITION, and it is enforced by the CONTROL range, not by taste.**
  // Past a quarter turn the sign flips: at `rx = −120` three layers at z 0/100/200 have
  // view-axis depths 1200/1250/1300, so the HIGHEST z is the farthest, this sort paints
  // it last, and the behind-camera guard never rescues it because `D = P − κζ` grows
  // with ζ once κ < 0 (all three stay fully opaque; the lifted layer also shrinks). The
  // wire clamp is ±180 because a hand-edited share link has to be held to something - 
  // it is not a control range, and the Tilt X / Tilt Y fields and the shift-drag are
  // both held to `KF_TILT_CONTROL` (±75) instead, which keeps `κ ≥ cos(75°)² = 0.067`
  // for every combination the UI can author. A link that says 120 renders in the wrong
  // order; that is the documented cost of a wire wider than its controls, and the
  // alternative (a per-frame view-axis sort) buys nothing the UI can reach.
  if (out.some((i) => i.resolvedZ !== 0)) {
    out.sort((a, b) => a.resolvedZ - b.resolvedZ || a.layer.idx - b.layer.idx);
  }
  return out;
}

// ── the frame grid ──────────────────────────────────────────────────────────

/**
 * The output frame times, ms: `n × 1000 / fps` for n in [0, ceil(totalMs/1000 × fps)).
 *
 * Written as `(n * 1000) / fps` rather than `n * (1000 / fps)` so the grid is exact
 * on every whole second at 24/25/30/60 fps instead of accumulating a float drift
 * that eventually costs a frame at the end of a long sequence.
 */
export function frameTimestamps(totalMs: number, fps: number): number[] {
  if (!Number.isFinite(totalMs) || totalMs <= 0) return [];
  if (!Number.isFinite(fps) || fps <= 0) return [];
  const count = Math.ceil((totalMs / 1000) * fps - 1e-9);
  const out: number[] = [];
  for (let n = 0; n < count; n++) out.push((n * 1000) / fps);
  return out;
}

/** Which frames of one output grid a layer is on screen for, and what it decodes. */
export interface FrameWindow {
  /** First grid index the layer is live at, -1 when it never is. */
  first: number;
  /** Last grid index the layer is live at, -1 when it never is. */
  last: number;
  /**
   * The SOURCE times (SECONDS) this layer's decoder will be asked for, ascending - 
   * one per live frame. Empty for a `static` layer (there is nothing to seek).
   */
  span: number[];
}

/**
 * A layer's activity window against ONE EXPLICIT GRID.
 *
 * The grid is a parameter rather than something re-derived from `(fps, totalMs)`
 * because the orchestrator does not always walk the whole grid: a gif/apng export
 * is capped to `maxVideoFrames()`. When the window and the loop disagree, provider
 * lifetime, the overlap budget and - worst - the truncation verdict are all computed
 * against frames that were never rendered, and a perfectly complete export dies as
 * SEQ_TRUNCATED after every frame has already been encoded. One grid, one window,
 * one answer; and phase 2.5's contact sheet gets to pass its own sparse grid.
 *
 * `extraMs` is the layer's crossfade tail from `crossfadeExtensions`, if any: those
 * frames are composited too, so their samples must be decoded too.
 */
export function activeFrameWindow(layer: SeqLayer, grid: number[], extraMs = 0): FrameWindow {
  const extend = Number.isFinite(extraMs) && extraMs > 0 ? extraMs : 0;
  const end = liveEndOf(layer, extend);
  const span: number[] = [];
  let first = -1;
  let last = -1;
  for (let i = 0; i < grid.length; i++) {
    const t = grid[i] as number;
    if (t < layer.startMs) continue;
    if (t >= end) break;
    if (first < 0) first = i;
    last = i;
    // `static` has nothing to seek - and neither has a `camera`, which is a pose over
    // time and not a source at all (section 5.4).
    if (layer.kind !== 'static' && layer.kind !== 'camera') {
      span.push((layer.clipInMs + (t - layer.startMs) * layer.speed) / 1000);
    }
  }
  return { first, last, span };
}

/**
 * The SOURCE times (SECONDS) this layer's decoder will be asked for, ascending.
 *
 * This is the list to hand straight to mediabunny's `samplesAtTimestamps()`: it is
 * monotonically sorted by construction (speed is always positive), so the sink takes
 * its optimised path and decodes each packet at most once - spike rule 2.
 *
 * A convenience over `activeFrameWindow` for the full grid; the orchestrator uses
 * the window directly so its loop and its span can never be built from different
 * grids.
 */
export function activeSpanTimestamps(layer: SeqLayer, fps: number, totalMs: number, extraMs = 0): number[] {
  return activeFrameWindow(layer, frameTimestamps(totalMs, fps), extraMs).span;
}

// ── error normalisation (spike rule 8) ──────────────────────────────────────

/** Every failure this pipeline is allowed to report. */
export const SEQ_ERROR_CODES = Object.freeze([
  'SEQ_UNSUPPORTED_MEDIA',
  'SEQ_DECODE_FAILED',
  'SEQ_TRUNCATED',
  'SEQ_NO_CODEC',
  'SEQ_TOO_HEAVY',
  'SEQ_ABORTED',
  // P2 (plans/104 section 6.4). A tilted camera is composited by CAPTURING the live DOM, and
  // dom-to-image cannot serialise a playing `<video>` - the freeze would bake one frame
  // of it under the whole move. That combination refuses with a visible notice rather
  // than exporting something wrong, and it is its own code because it is neither a
  // decode failure nor a missing codec: it is a composition this tier does not do yet.
  'SEQ_TILT_UNSUPPORTED',
] as const);

export type SeqErrorCode = (typeof SEQ_ERROR_CODES)[number];

export interface CodedError {
  code: SeqErrorCode;
  message: string;
}

function isSeqCode(v: unknown): v is SeqErrorCode {
  return typeof v === 'string' && (SEQ_ERROR_CODES as readonly string[]).includes(v);
}

/** An Error carrying one of our codes, so a throw survives `toCodedError` intact. */
export class SequenceError extends Error {
  readonly code: SeqErrorCode;
  constructor(code: SeqErrorCode, message: string) {
    super(message);
    this.name = 'SequenceError';
    this.code = code;
  }
}

export function sequenceError(code: SeqErrorCode, message: string): SequenceError {
  return new SequenceError(code, message);
}

function nameOf(e: object): string {
  const n = (e as { name?: unknown }).name;
  if (typeof n === 'string' && n) return n;
  const ctor = (e as { constructor?: { name?: unknown } }).constructor;
  return typeof ctor?.name === 'string' ? ctor.name : '';
}

function messageOf(e: object): string {
  const m = (e as { message?: unknown }).message;
  if (typeof m === 'string' && m) return m;
  try {
    return String(e);
  } catch {
    return 'Unknown error';
  }
}

/**
 * Normalise ANY throw from the sequence pipeline into one coded shape.
 *
 * Three flavours arrive here (spike rule 8) and none of them can be tested with
 * `instanceof`: mediabunny's typed errors come from a lazily-imported chunk, WebCodecs
 * throws `DOMException` (absent in Node entirely), and plain `Error`s carry their
 * meaning only in the message. So this matches on NAMES and message shape - which is
 * also what makes it unit-testable without a browser.
 */
export function toCodedError(e: unknown): CodedError {
  if (e == null) return { code: 'SEQ_DECODE_FAILED', message: 'Unknown error' };
  if (typeof e === 'string') return { code: 'SEQ_DECODE_FAILED', message: e };
  if (typeof e !== 'object') return { code: 'SEQ_DECODE_FAILED', message: String(e) };

  const code = (e as { code?: unknown }).code;
  if (isSeqCode(code)) return { code, message: messageOf(e) };

  const name = nameOf(e);
  const msg = messageOf(e);
  const low = `${name} ${msg}`.toLowerCase();

  // mediabunny's typed errors.
  if (name === 'UnsupportedInputFormatError') return { code: 'SEQ_UNSUPPORTED_MEDIA', message: msg };
  if (name === 'InputDisposedError') return { code: 'SEQ_ABORTED', message: msg };

  // WebCodecs / DOM.
  if (name === 'AbortError') return { code: 'SEQ_ABORTED', message: msg };
  if (name === 'NotSupportedError') return { code: 'SEQ_NO_CODEC', message: msg };
  if (name === 'QuotaExceededError') return { code: 'SEQ_TOO_HEAVY', message: msg };
  if (name === 'EncodingError' || name === 'OperationError' || name === 'InvalidStateError' || name === 'DataError') {
    return { code: 'SEQ_DECODE_FAILED', message: msg };
  }

  // Plain Errors, where only the wording carries the meaning.
  if (/truncat|unexpected end|incomplete file/.test(low)) return { code: 'SEQ_TRUNCATED', message: msg };
  if (/abort|cancell?ed/.test(low)) return { code: 'SEQ_ABORTED', message: msg };
  if (/out of memory|allocation failed|too (large|heavy|many)/.test(low)) return { code: 'SEQ_TOO_HEAVY', message: msg };
  if (/codec|not supported|unsupported|cannot be decoded/.test(low)) return { code: 'SEQ_NO_CODEC', message: msg };
  return { code: 'SEQ_DECODE_FAILED', message: msg };
}

// ── the silent-truncation guard (spike rule 7) ──────────────────────────────

export interface ReconcileInput {
  /** The span that was asked for, seconds - already clamped to what the source can
   *  actually answer (see `sourceFrameSec` for why the end is fuzzy). */
  expectedSec: number;
  /** How many frames the decode actually yielded. */
  decodedFrames: number;
  /** The last decoded sample's timestamp, seconds, zero-based on the span. */
  lastTsSec: number;
  /** The rate the span was sampled at, in the SOURCE's own time domain. */
  fps: number;
  /**
   * How many samples the executor actually asked the provider for.
   *
   * `decodedFrames` counts DRAWS, and the executor legitimately skips them: a fully
   * transparent box, a zero-size box, the first frame of a fade (whose alpha is
   * exactly 0). Counting a skipped draw as a missing frame turns a hidden
   * audio-only clip into a whole-export SEQ_TRUNCATED. Omit to fall back to "assume
   * the whole span was asked for"; 0 means nothing was asked and nothing can be
   * concluded.
   */
  requestedFrames?: number;
  /**
   * Requests that landed past the source's own duration - a clip trimmed longer
   * than its media, which the timeline permits and which is NOT truncation.
   */
  unreachableFrames?: number;
  /**
   * The source's own frame interval, seconds, when it is known.
   *
   * The tolerance below is in span frames, but the error it has to absorb is one
   * SOURCE frame: `lastTsSec` is the decoded sample's presentation time, which lags
   * the requested time by up to the source's frame interval. Without this a 12 fps
   * screen recording, or any clip slowed below 0.5x (which samples the source
   * FASTER than the output rate), reports a shortfall it does not have.
   */
  sourceFrameSec?: number;
}

/**
 * Did the decode actually cover the clip, or did it quietly stop early?
 *
 * A truncated container decodes a CLEAN, short iteration with no error at all, so a
 * try/catch proves nothing - the only evidence is arithmetic. Two independent
 * signals are checked and the worse one wins: the last presented timestamp (which
 * catches a decode that stopped mid-file) and the answer count (which catches a
 * decode that skipped packets while still reaching the end).
 *
 * Tolerance is TRUNCATION_TOLERANCE_FRAMES span frames plus one source frame - see
 * those two fields.
 */
export function reconcileDecoded(opts: ReconcileInput): { ok: boolean; shortfallSec: number } {
  const fps = Number.isFinite(opts.fps) && opts.fps > 0 ? opts.fps : 30;
  const frame = 1 / fps;
  const expected = Number.isFinite(opts.expectedSec) && opts.expectedSec > 0 ? opts.expectedSec : 0;
  if (expected <= 0) return { ok: true, shortfallSec: 0 };
  const requested = Number.isFinite(opts.requestedFrames as number)
    ? Math.max(0, Math.trunc(opts.requestedFrames as number))
    : null;
  // The executor never asked this provider for anything (an invisible layer kept
  // only for its audio). Silence is the correct answer, not evidence of a bad file.
  if (requested === 0) return { ok: true, shortfallSec: 0 };
  const frames = Number.isFinite(opts.decodedFrames) && opts.decodedFrames > 0 ? opts.decodedFrames : 0;
  const lastTs = Number.isFinite(opts.lastTsSec) && opts.lastTsSec > 0 ? opts.lastTsSec : 0;
  const unreachable = Number.isFinite(opts.unreachableFrames as number)
    ? Math.max(0, Math.trunc(opts.unreachableFrames as number))
    : 0;
  const srcFrame = Number.isFinite(opts.sourceFrameSec as number) && (opts.sourceFrameSec as number) > 0
    ? (opts.sourceFrameSec as number)
    : 0;
  // The final frame is PRESENTED one frame before the source's end, so a complete
  // decode reaches `expected - frame`, not `expected`.
  const byTs = expected - (lastTs + frame);
  // Unanswered REQUESTS, in seconds - the direct measure of a file that stopped
  // answering. Requests the source could never answer (past its end) don't count.
  const byCount = requested != null
    ? (requested - unreachable - frames) * frame
    : expected - frames * frame;
  const shortfallSec = Math.max(0, byTs, byCount);
  const tolerance = TRUNCATION_TOLERANCE_FRAMES * frame + srcFrame + 1e-9;
  return { ok: shortfallSec <= tolerance, shortfallSec };
}
