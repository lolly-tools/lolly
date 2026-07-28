// SPDX-License-Identifier: MPL-2.0
/**
 * How high a CHROMA AXIS has to reach for a given gamut — the one number every
 * chroma scale in the UI is drawn against.
 *
 * A flat ceiling cannot serve three gamuts at once. Chroma is not bounded by
 * anything intrinsic (OKLCH will happily name c = 2), so an axis maximum is a
 * choice, and the only honest choice is the widest chroma the gamut being shown
 * actually reaches. Pick one constant for all of them and it is wrong in both
 * directions at once: at 0.4 the top fifth of an sRGB chart can never contain a
 * colour, which squashes the envelope into the lower half and doubles how much
 * chroma a given mouse move covers, while Rec.2020's green and magenta spikes run
 * past 0.4 and get drawn with flat tops — the chart running out of axis and
 * looking like a property of the gamut.
 *
 * So the ceiling is derived from the gamut, by asking {@link maxChroma} over the
 * whole lightness × hue field. Two properties matter as much as the number:
 *
 *  - It depends on the LIMIT ONLY, never on the colour being edited. A ceiling
 *    that tracked the maximum at the current lightness would rescale the axis
 *    under the cursor mid-drag, which is worse than the bug it fixes.
 *  - It is derived rather than tabulated per name, because a limit may be an ICC
 *    press profile ({@link GamutSource}) and not one of the three display gamuts.
 *
 * The sweep is memoised by `gamutSourceId`, so it runs once per gamut per session
 * — never per frame.
 *
 * Pure and deterministic (the cache is a memo of a pure function): no Date, no
 * Math.random, no IO.
 */

import { maxChroma, gamutCeilingPeak, GAMUT_GRID_STEP } from './gamut.ts';
import { gamutSourceId } from './gamut-source.ts';
import type { GamutLimit } from './gamut-source.ts';

/**
 * Headroom above the true peak, so the boundary is visibly INSIDE the plot
 * instead of grazing the frame — a spike that touches the top edge reads as
 * clipped whether or not it is.
 */
const AXIS_HEADROOM = 1.05;

/** Granularity the ceiling is rounded UP to. Fine enough that the headroom stays
 *  small (no dead band at the top of an sRGB chart), coarse enough that the
 *  number reads as a number: 0.34, 0.38, 0.50. */
const AXIS_GRAIN = 0.02;

/**
 * Tick steps worth labelling a chroma axis with, smallest first. A step is chosen
 * from this ladder rather than computed as `cMax / 4`, so the labels stay round
 * (0.10, 0.20, …) whatever the ceiling turns out to be.
 */
const TICK_STEPS = [0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.5, 1] as const;

/** About this many labelled steps across the axis. */
const TICK_TARGET = 5;

const PEAK_CACHE = new Map<string, number>();

/**
 * The highest chroma this gamut reaches anywhere — over every lightness and every
 * hue, not at the colour in hand.
 *
 * The coarse stage is the PAINTER's ceiling grid (`gamutCeilingPeak`), not a
 * sweep of its own. This function used to run a 48×90 sweep of exactly the same
 * `maxChroma` surface the slice painter tabulates, so a press profile paid for
 * two full boundary searches to draw one chart. Sharing the table makes an axis
 * ceiling cost only the local refinement — and, for an ICC source, the table has
 * to exist anyway before a single pixel can be painted.
 *
 * The refinement is a local search inside one grid cell either way at ~8x the
 * resolution: the boundary surface is smooth in both L and h, so the true peak
 * cannot be far from the grid's argmax. Memoised, so the cost is paid once per
 * gamut.
 */
export function peakChroma(limit: GamutLimit): number {
  const id = gamutSourceId(limit);
  const hit = PEAK_CACHE.get(id);
  if (hit !== undefined) return hit;

  const coarse = gamutCeilingPeak(limit);
  let best = coarse.c;
  for (let i = -8; i <= 8; i++) {
    const l = coarse.l + (i * GAMUT_GRID_STEP.l) / 8;
    if (!(l > 0) || l >= 1) continue;
    for (let j = -8; j <= 8; j++) {
      const c = maxChroma(l, coarse.h + (j * GAMUT_GRID_STEP.h) / 8, limit);
      if (c > best) best = c;
    }
  }

  PEAK_CACHE.set(id, best);
  return best;
}

/**
 * The ceiling a chroma axis drawn against this gamut should use: the peak plus a
 * little headroom, rounded up to a readable step.
 *
 * Everything that scales chroma — the 2D slice charts, the L/C/H sliders, the
 * typed number inputs and the axis ticks — must use THIS number, or they disagree
 * about where a colour sits.
 */
export function chromaAxisMax(limit: GamutLimit): number {
  const peak = peakChroma(limit) * AXIS_HEADROOM;
  if (!(peak > 0)) return AXIS_GRAIN;
  // Rounded through integers: 0.34 / 0.02 lands on 16.999999999999996 in binary
  // floating point, and a naive ceil would step it to 0.36.
  const steps = Math.ceil(peak / AXIS_GRAIN - 1e-9);
  return Number((steps * AXIS_GRAIN).toFixed(4));
}

/**
 * The spacing to label a chroma axis of this height at — a round number from
 * {@link TICK_STEPS}, not `cMax / 4`, so the labels are 0.10 / 0.20 / 0.30 rather
 * than 0.085 / 0.17 / 0.255.
 */
export function chromaTickStep(cMax: number): number {
  const want = (cMax > 0 ? cMax : AXIS_GRAIN) / TICK_TARGET;
  for (const s of TICK_STEPS) if (s >= want) return s;
  return TICK_STEPS[TICK_STEPS.length - 1]!;
}
