// SPDX-License-Identifier: MPL-2.0
/**
 * Auto-cycling policy for a MilkDrop surface - shared by the Neurospicy dock and the
 * catalog's audio details modal so the two cannot drift.
 *
 * What lives here is the POLICY, not the rendering: which intervals are offered, what
 * the saved preference is, when cycling is suppressed, and the timer itself. What stays
 * with each caller is the part only it can know - which surfaces are live and what
 * "advance" means for it. That split is why this extracts cleanly: the dock cycles
 * presets AND colour schemes across two surfaces, the modal cycles one preset in one
 * canvas, and neither detail belongs in a timer.
 *
 * THE SUPPRESSION RULES ARE THE INTERESTING PART, and both were learned the hard way in
 * the dock:
 *
 *   A surface nobody can see must not cycle. A collapsed dock keeps its handle but its
 *   canvas stops being laid out, so the render loop retires - and `setPreset` on a
 *   renderer that is not drawing costs a full preset rebuild, every interval, forever.
 *
 *   Silence must not cycle. With no audio signal the field is static anyway, so rotating
 *   presets only churns the GPU behind a status note.
 *
 * Reduced motion turns cycling OFF by default rather than merely slowing it: an
 * unrequested change of the whole picture on a timer is exactly what that preference
 * asks us not to do. A user who explicitly picks an interval still gets it - the
 * preference sets the default, it does not overrule a deliberate choice.
 */

import { prefersReducedMotion } from './a11y-prefs.ts';

/** Intervals offered, in seconds. 0 is Off. 5 is a restless slideshow; 40 lets a preset
 *  breathe but is long enough that a session can look like it only has one. */
export const CYCLE_CHOICES = [0, 5, 20, 40] as const;
export type CycleSeconds = (typeof CYCLE_CHOICES)[number];

/** The interval a first-time user gets, when motion is not restricted.
 *  20s (Andy's pick, 2026-07-31) - long enough for a preset to establish itself, short
 *  enough that the breadth of the library is visible in a sitting. 40 was the old value
 *  and is still one click away for anyone who wants the slower rhythm. */
export const CYCLE_DEFAULT: CycleSeconds = 20;

/** localStorage key. Shared deliberately: someone who has chosen a rhythm for the dock
 *  has expressed a preference about visualisers, not about one widget. */
export const CYCLE_KEY = 'lolly:vizCycle';

/**
 * The saved interval in seconds, 0 for off.
 *
 * Tolerates the legacy `'1'` value (an earlier on/off boolean) by reading it as the
 * default interval - a stored preference should survive the control that wrote it
 * gaining more options.
 */
export function loadCycleSeconds(): number {
  try {
    const saved = localStorage.getItem(CYCLE_KEY);
    if (saved === '1') return CYCLE_DEFAULT;
    if (saved !== null) {
      const n = Number(saved);
      if ((CYCLE_CHOICES as readonly number[]).includes(n)) return n;
    }
  } catch { /* storage off - fall through to the default */ }
  return prefersReducedMotion() ? 0 : CYCLE_DEFAULT;
}

export function saveCycleSeconds(seconds: number): void {
  try { localStorage.setItem(CYCLE_KEY, String(seconds)); } catch { /* best-effort */ }
}

export interface VizCycleOpts {
  /**
   * Advance to the next look. Called only when the surface is genuinely live, so an
   * implementation can do the expensive thing (a preset rebuild) without re-checking.
   */
  onTick(): void;
  /**
   * Is this surface worth cycling right now? Callers answer with whatever they can see:
   * "is the renderer drawing", "is there audio". Returning false SKIPS a tick rather
   * than stopping the timer, so cycling resumes by itself when the surface comes back.
   */
  shouldRun?(): boolean;
  /** Starting interval; defaults to the saved preference. */
  seconds?: number;
}

export interface VizCycle {
  /** (Re)start at the current interval. Idempotent. */
  start(): void;
  stop(): void;
  /** Change the interval, persist it, and restart. 0 stops. */
  set(seconds: number): void;
  /** The interval in force. */
  seconds(): number;
  /** Restart the clock without changing the interval - call after a MANUAL pick so the
   *  chosen preset gets its full turn instead of being replaced a moment later. */
  kick(): void;
}

export function createVizCycle(opts: VizCycleOpts): VizCycle {
  let seconds = opts.seconds ?? loadCycleSeconds();
  let timer: ReturnType<typeof setInterval> | undefined;

  const stop = (): void => {
    if (timer !== undefined) { clearInterval(timer); timer = undefined; }
  };
  const start = (): void => {
    stop();
    if (seconds <= 0) return;
    timer = setInterval(() => {
      if (opts.shouldRun && !opts.shouldRun()) return;
      opts.onTick();
    }, seconds * 1000);
  };

  return {
    start,
    stop,
    set(next: number) {
      seconds = (CYCLE_CHOICES as readonly number[]).includes(next) ? next : 0;
      saveCycleSeconds(seconds);
      start();
    },
    seconds: () => seconds,
    kick: start,
  };
}
