// SPDX-License-Identifier: MPL-2.0
/** Pure appearance timing, shared with the standalone player. */
/** A flat row of a `blocks` input, keyed by field id - one Design box. */
export type MotionBox = Record<string, unknown>;

/**
 * How a box arrives on its slide.
 *   • `slide` - with the slide itself, no motion of its own to schedule.
 *   • `click` - on the presenter's Nth advance (the `build` field).
 *   • `time`  - at an authored moment on the timeline (`start`, and `dur` if bounded).
 */
export type AppearMode = 'slide' | 'click' | 'time';

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
export function buildStepOf(b: MotionBox | null | undefined): number {
  const n = numOr(b?.build, 0);
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
  if (b.lane === 'seq' || finite(b.start)) return 'time';
  return 'slide';
}
