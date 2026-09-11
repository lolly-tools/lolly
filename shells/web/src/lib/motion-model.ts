// SPDX-License-Identifier: MPL-2.0
/**
 * ONE motion model for a Design document (plans/179 M4).
 *
 * Design grew three separate ways to say "when does this appear" - a build step, a
 * timeline start, and "just show it with the slide" - and each player (the presenter,
 * the video compositor, the .pptx writer) worked out what a box meant on its own. They
 * disagreed. This module is the single answer: one derived mode, one exclusive patch
 * that writes it, one mapping from a deck transition to the per-box pair that expresses
 * it, and one definition of a slide's REST pose for stills.
 *
 * Nothing here is stored. `appearModeOf` derives the mode from fields the manifest
 * already has (`build`, `start`, `dur`, `lane`), so a link shared before this existed
 * reads back exactly as its author left it and no migration is needed.
 *
 * DOM: two functions take an element and read ATTRIBUTES off it - `buildStepsDropped`
 * and `restMsOf`. Everything else is pure data, so the CLI can call it. Nothing here
 * measures layout, writes a style or listens to an event.
 */

import { splitPhaseWindowMs, type TransitionKind } from './transitions.ts';
import { t } from '../i18n.ts';

/** A flat row of a `blocks` input, keyed by field id - one Design box. */
export type MotionBox = Record<string, unknown>;

/**
 * How a box arrives on its slide.
 *   • `slide` - with the slide itself, no motion of its own to schedule.
 *   • `click` - on the presenter's Nth advance (the `build` field).
 *   • `time`  - at an authored moment on the timeline (`start`, and `dur` if bounded).
 */
export type AppearMode = 'slide' | 'click' | 'time';

/** The four fields the mode is derived from and written to. Design's own ids. */
const F_BUILD = 'build';
const F_START = 'start';
const F_DUR = 'dur';
const F_LANE = 'lane';

/** The scenes lane value - a box on this lane is a timeline clip. */
const SEQ_LANE = 'seq';

/** Does `v` hold a finite number (an authored value, not an empty field)? */
function finite(v: unknown): boolean {
  if (v == null || v === '') return false;
  const x = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(x);
}

/** `v` as a finite number, or `d`. */
function numOr(v: unknown, d: number): number {
  if (v == null || v === '') return d;
  const x = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : d;
}

/** The authored build step (a positive integer), or 0 for "no build". */
function buildStepOf(b: MotionBox | null | undefined): number {
  const n = numOr(b?.[F_BUILD], 0);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : 0;
}

/**
 * Which of the three ways this box appears.
 *
 * BUILD WINS on a box that carries both a step and a start. That is not a preference,
 * it is what the three players already do: each of them checks `build` first, so a box
 * with both has always behaved as a click fragment. Deriving it the other way round
 * would silently change documents that are already out there.
 */
export function appearModeOf(b: MotionBox | null | undefined): AppearMode {
  if (!b) return 'slide';
  if (buildStepOf(b) >= 1) return 'click';
  if (b[F_LANE] === SEQ_LANE || finite(b[F_START])) return 'time';
  return 'slide';
}

/** What {@link setAppear} is being asked to write. */
export interface AppearIntent {
  mode: AppearMode;
  /** `click`: the advance this box appears on. Rounded, floored at 1. */
  step?: number;
  /** `time`: the moment it appears, SECONDS. */
  startS?: number;
  /** `time`: how long it stays, SECONDS. Omit for open-ended. */
  durS?: number;
}

/** The exclusive patch {@link setAppear} returns - always all four fields. */
export interface AppearPatch {
  [F_BUILD]: string | number;
  [F_START]: string | number;
  [F_DUR]: string | number;
  [F_LANE]: string;
}

/* ── the numbers a mode switch would otherwise throw away ──────────────────── */

/** What one box carried before it was switched out of a mode. */
interface AppearMemory {
  step?: number;
  startS?: number;
  durS?: number;
}

/**
 * Per-box memory of the step / start / length, keyed by the box's own `id`.
 *
 * The ONE piece of state in this module, and it is a convenience rather than a fact: it
 * is never stored, never shared and never restored across a reload. It exists because
 * the exclusive patch below is exclusive on purpose - pressing "With the slide" clears
 * the build step, so pressing "On click" again a second later had nothing left to read
 * and came back as step 1. Both surfaces' controls say the number survives a look at
 * another mode; this is what makes that true.
 *
 * Bounded, because a long session on a big document would otherwise keep an entry per
 * box for the life of the tab: past the cap the oldest key goes, which at worst costs
 * one box the default it would have had anyway.
 *
 * The key is the row's own id, which is unique WITHIN a document and not across them -
 * so every surface that mounts over a document clears it first ({@link
 * resetAppearMemory}), and a number can never travel from one document to the next.
 */
const REMEMBERED = new Map<string, AppearMemory>();
const MEMORY_CAP = 500;

/**
 * Forget every remembered number - called when a surface mounts over a document.
 *
 * Ids are only unique inside one document, so without this a box called `b1` in the deck
 * opened second would be offered the step `b1` had in the deck opened first. Clearing on
 * mount costs at most one convenience default: the field falls back to what it always
 * was (step 1, start 0).
 */
export function resetAppearMemory(): void {
  REMEMBERED.clear();
}

/** The box's own id field - Design's, and the only key a patch consumer shares. */
const F_ID = 'id';

/** `b`'s memory key, or null when the row has no id to remember it by. */
function memoryKeyOf(b: MotionBox | null | undefined): string | null {
  const id = String(b?.[F_ID] ?? '').trim();
  return id || null;
}

/** Fold whatever `b` is carrying right now into its memory, and hand the memory back. */
function rememberAppear(b: MotionBox | null | undefined): AppearMemory {
  const key = memoryKeyOf(b);
  if (!key) return {};
  const next: AppearMemory = { ...(REMEMBERED.get(key) ?? {}) };
  const step = buildStepOf(b);
  const startS = numOr(b?.[F_START], Number.NaN);
  const durS = numOr(b?.[F_DUR], Number.NaN);
  if (step >= 1) next.step = step;
  if (Number.isFinite(startS)) next.startS = startS;
  if (Number.isFinite(durS) && durS > 0) next.durS = durS;
  if (!REMEMBERED.has(key) && REMEMBERED.size >= MEMORY_CAP) {
    const oldest = REMEMBERED.keys().next().value;
    if (oldest !== undefined) REMEMBERED.delete(oldest);
  }
  REMEMBERED.set(key, next);
  return next;
}

/**
 * The patch that puts `b` in `mode`, and takes it out of the other two.
 *
 * EXCLUSIVE by construction: every one of the four fields is in the returned object on
 * every call, so a box can never end up carrying both a build step and a start. That is
 * the bug the three-way control exists to make impossible.
 *
 * The cleared value is the EMPTY STRING, never `undefined`: the compact-blocks URL codec
 * writes one column per field, and `undefined` means "no opinion" to the runtime's patch
 * merge - so clearing with it would leave the old value standing in the link.
 *
 * Never mutates: the caller gets a patch to spread, and `b` is only read.
 *
 * The NUMBERS survive a look at another mode. Every call folds whatever `b` is carrying
 * into {@link REMEMBERED} first, so the step a box had when the user pressed "With the
 * slide" is still there when they press "On click" again - which is what both surfaces'
 * controls have always claimed, and what the exclusive clear below used to make untrue.
 */
export function setAppear(b: MotionBox | null | undefined, intent: AppearIntent): AppearPatch {
  const memory = rememberAppear(b);
  if (intent.mode === 'click') {
    const step = Math.max(1, Math.round(numOr(intent.step, numOr(b?.[F_BUILD], memory.step ?? 1))));
    return { [F_BUILD]: step, [F_START]: '', [F_DUR]: '', [F_LANE]: '' };
  }
  if (intent.mode === 'time') {
    // The lane is PRESERVED, not chosen here: a sequence clip stays a clip and an
    // overlay stays an overlay. Only the ways of appearing are exclusive - which lane a
    // timed box lives on is a separate decision the timeline already owns.
    const lane = String(b?.[F_LANE] ?? '') === SEQ_LANE ? SEQ_LANE : '';
    const startS = Math.max(0, numOr(intent.startS, numOr(b?.[F_START], memory.startS ?? 0)));
    const durS = intent.durS == null
      ? numOr(b?.[F_DUR], memory.durS ?? NaN)
      : numOr(intent.durS, NaN);
    return {
      [F_BUILD]: '',
      [F_START]: startS,
      [F_DUR]: Number.isFinite(durS) && durS > 0 ? durS : '',
      [F_LANE]: lane,
    };
  }
  return { [F_BUILD]: '', [F_START]: '', [F_DUR]: '', [F_LANE]: '' };
}

/** One line saying how this box appears - the summary a collapsed Motion row shows. */
export function appearSummary(b: MotionBox | null | undefined): string {
  const mode = appearModeOf(b);
  if (mode === 'click') return t('On click, step {n}', { n: buildStepOf(b) });
  if (mode === 'time') {
    const startS = numOr(b?.[F_START], 0);
    const durS = numOr(b?.[F_DUR], NaN);
    const at = Math.round(startS * 10) / 10;
    if (Number.isFinite(durS) && durS > 0) {
      return t('At {t}s for {d}s', { t: at, d: Math.round(durS * 10) / 10 });
    }
    return t('At {t}s', { t: at });
  }
  return t('With the slide');
}

/* ── deck transition → the per-box pair that expresses it ──────────────────── */

/** The per-box enter/exit a deck transition lowers to, plus why it was degraded. */
export interface SlideTransitionPair {
  enter: TransitionKind;
  exit: TransitionKind;
  /** English, for a log: what this transition could not be rendered as, and why. */
  note?: string;
}

/**
 * The enter/exit pair a deck-level transition means for ONE frame, or `null` when
 * nothing may be derived.
 *
 * `slide` is the pair worth reading twice. An ENTERING slide comes in from the right,
 * which is the kind named `slide-left` (transitions.ts: "Slide from right"). Its
 * predecessor has to LEAVE to the left, and an exit runs the entrance backwards - so
 * departing leftwards is `slide-right`. The names look swapped and are not.
 *
 * `custom` returns null on purpose: it is the author saying the frame's own timeline
 * enter/exit are the truth, so nothing derives over them. So does an unknown value, and
 * so does '' - which means "follow the deck" and must be resolved to the document's own
 * transition BEFORE this is called.
 */
export function slideTransitionPair(kind: unknown): SlideTransitionPair | null {
  switch (String(kind ?? '')) {
    case 'fade':
      return { enter: 'fade', exit: 'fade' };
    case 'slide':
      return { enter: 'slide-left', exit: 'slide-right' };
    case 'morph':
      return {
        enter: 'fade',
        exit: 'fade',
        note: 'morph is rendered as a crossfade here: matching boxes are only tweened live in present mode.',
      };
    case 'flight':
      return {
        enter: 'fade',
        exit: 'fade',
        note: 'fly between artboards is rendered as a crossfade here: the camera move only exists in present mode, because every frame is composited at its own origin.',
      };
    case 'none':
      return { enter: 'none', exit: 'none' };
    default:
      return null;
  }
}

/* ── how long a narrated slide has to be ───────────────────────────────────── */

/** Default lead-in before the first word, ms (plans/180 T1). Also the floor T2 raises
 *  to the frame's own enter length, so narration never talks over the slide arriving. */
export const NARRATION_LEAD_IN_MS = 400;
/** Default silence after the last word, ms (plans/180 T1) - the breath before the
 *  slide leaves, and what makes the exit read as deliberate rather than a cut-off. */
export const NARRATION_TAIL_MS = 600;

/** What {@link narrationDwellMs} needs to know about one slide. All in milliseconds. */
export interface NarrationDwellInput {
  /** The narration clip's own length. 0 for a slide with no notes. */
  narrationMs: number;
  /** The frame's enter motion. Raises the lead-in (T2), never lowers it. */
  enterMs?: number;
  /** The frame's exit motion. Runs entirely AFTER the tail (T3). */
  exitMs?: number;
  /** Override the 400 ms lead-in - a document-level setting. */
  leadInMs?: number;
  /** Override the 600 ms tail - a document-level setting. */
  tailMs?: number;
  /** What the author already set this slide's dwell to. Never shortened. */
  authoredMs?: number;
}

/** A finite, non-negative millisecond count, else `d`. Zero is a real answer here - a
 *  document may set a 0 ms lead-in - so only a negative or non-finite value falls back. */
function ms(v: unknown, d = 0): number {
  const x = typeof v === 'number' ? v : Number.NaN;
  return Number.isFinite(x) && x >= 0 ? x : d;
}

/**
 * How long a narrated slide must stay on screen (plans/180 T1-T3), in milliseconds.
 *
 * Three rules, one number:
 *   T1 the slide is at least the lead-in, the narration, the tail and the exit;
 *   T2 the lead-in is never shorter than the slide's own enter motion, so the first
 *      word does not land while the slide is still arriving;
 *   T3 nothing leaves until the tail has run, which is what the `+ exit` term buys.
 * And the author's own dwell is a FLOOR, not a target: a slide someone deliberately
 * left up for thirty seconds stays up for thirty seconds.
 *
 * Pure and unit-only, so the dwell solver, the presenter and the .pptx `advTm` all
 * derive the same length from the same inputs. A slide with no narration comes back as
 * its authored dwell (or 0), which is what keeps "Narrate" from touching frames that
 * have nothing to say.
 */
export function narrationDwellMs(input: NarrationDwellInput | null | undefined): number {
  const narrationMs = ms(input?.narrationMs);
  const authoredMs = ms(input?.authoredMs);
  if (narrationMs <= 0) return Math.round(authoredMs);
  const leadIn = Math.max(ms(input?.leadInMs, NARRATION_LEAD_IN_MS), ms(input?.enterMs));
  const tail = ms(input?.tailMs, NARRATION_TAIL_MS);
  const exit = ms(input?.exitMs);
  return Math.round(Math.max(authoredMs, leadIn + narrationMs + tail + exit));
}

/* ── the two element readers ───────────────────────────────────────────────── */

/**
 * How many distinct BUILD STEPS a moving-format export of `root` will not show.
 *
 * A build is a click, and a video has no clicks. Rather than invent a pace for them -
 * which would put words on screen at a speed nobody chose - the exports draw every
 * fragment and say how many steps went unseen, so the author can reach for "Place in
 * order" and time them deliberately. Distinct steps, not boxes: three boxes revealed
 * together are one click.
 */
export function buildStepsDropped(root: Element | null | undefined): number {
  const els = root?.querySelectorAll?.('[data-build]');
  if (!els || !els.length) return 0;
  const steps = new Set<number>();
  for (const el of Array.from(els)) {
    const n = numOr(el.getAttribute('data-build'), 0);
    if (Number.isFinite(n) && n >= 1) steps.add(Math.round(n));
  }
  return steps.size;
}

/**
 * The moment, in the sequence clock's own ms, at which every animated box on `page` has
 * finished arriving - the pose a STILL export of that page should be taken at.
 *
 * Without this a per-artboard still catches the slide mid-entrance: an exported PNG of a
 * page whose boxes fade in at 400 ms is a page of half-transparent boxes. The rest pose
 * is the latest of every box's `start + enterMs`, extended by the split tail when the
 * text animates per unit (the stagger deals the last unit its own delay, which is what
 * `splitPhaseWindowMs` computes - imported rather than re-typed so the still and the
 * live preview agree to the millisecond).
 *
 * A box that NEVER SETTLES - a keyframe track, a hold effect - does not drag this moment
 * anywhere. It used to: the earliest start among those boxes was taken as a ceiling, on
 * the reasoning that a cyclical motion has no "after" and reads most honestly at its
 * beginning. A scenery decoration carries a hold or a track with NO start at all, which
 * is a start of 0, so one gently pulsing shape pinned the whole page to t = 0 and the
 * still came out with every fading headline still transparent - a blank board. One
 * still is one moment, so the moment belongs to the boxes that do settle, and a
 * decoration is photographed wherever its own loop has got to by then. A page whose
 * only motion IS scenery still rests at 0: an untimed box has no `data-t-start`, so it
 * contributes nothing to the maximum above.
 */
export function restMsOf(page: Element | null | undefined): number {
  if (!page?.querySelectorAll) return 0;
  let rest = 0;
  for (const el of Array.from(page.querySelectorAll('[data-t-start]'))) {
    const start = numOr(el.getAttribute('data-t-start'), 0);
    const enterMs = el.getAttribute('data-t-enter') ? numOr(el.getAttribute('data-t-enter-ms'), 400) : 0;
    let tail = enterMs;
    if (el.getAttribute('data-t-split')) {
      const units = el.querySelectorAll('.lly-u').length;
      tail = splitPhaseWindowMs(numOr(el.getAttribute('data-t-stagger'), 60), units, enterMs);
    }
    const at = start + tail;
    if (at > rest) rest = at;
  }
  return rest > 0 ? Math.round(rest) : 0;
}
