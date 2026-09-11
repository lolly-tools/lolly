// SPDX-License-Identifier: MPL-2.0
/**
 * beats.ts - how much of a room is on screen (plan 182 section 3a).
 *
 * A room has three beats, and the {@link OwnershipReport} decides which one is
 * showing. Nothing below the current beat exists in the DOM at all - not folded,
 * not dimmed, absent - because a folded panel is still a thing to read and four
 * of them are a list. A first-time visitor should be able to finish beat 0
 * without scrolling on a phone.
 *
 *  - **0** - nothing of the room's own. One centred column with the one gesture
 *    that starts a design system.
 *  - **1** - the first thing. The room's working layout, minus everything that
 *    only makes sense over a set.
 *  - **2** - a system. Everything the room has.
 *
 * The decision lives here, pure, because the rooms that read it are DOM-heavy
 * (`lib/brand-editor.ts` has no test harness by design) and the thresholds are
 * the part worth pinning. Nothing here reads a document, a host or the DOM.
 */

import type { OwnershipReport } from './ownership.ts';

/** Which beat a room is at. */
export type Beat = 0 | 1 | 2;

/**
 * How many colours of a person's own read as a system rather than a set of
 * tries - the point where the Colours room stops holding anything back.
 *
 * Higher than the Overview's `OWN_COLORS_ENOUGH` (3, "is this worth calling a
 * palette") on purpose: that answers whether the studio has something in it,
 * this answers whether somebody is ready for shade curves, contrast targets and
 * a print build.
 */
export const SYSTEM_OWN_COLORS = 6;

/** What the beat helpers read. A `Pick`, not the whole report, so a caller that
 *  counts its own swatches (the Colours room does - it holds them in the stored
 *  value space) can hand over a count without building a report first. */
export type BeatReport = Pick<OwnershipReport, 'counts'>;

export interface ColourBeatOpts {
  /**
   * A generated ramp exists in the document.
   *
   * The room cannot answer this from a count: a generate writes ramps whose
   * steps are all "own" but which nobody picked one at a time, and it is the
   * moment the person has a palette rather than a colour. The caller supplies
   * it from the same test the Overview's `worthExporting` makes (a
   * `ramp.secondary` group - `deriveBrandTokens` always writes one).
   */
  generatedRamp?: boolean;
}

/**
 * The Colours room's beat.
 *
 * Zero own colours is beat 0 whatever else is true - a starter palette is
 * scaffolding, not a system, and the room says so by showing one control. A
 * generated ramp or {@link SYSTEM_OWN_COLORS} own colours is beat 2. Everything
 * between is beat 1.
 */
export function colourBeat(report: BeatReport, opts: ColourBeatOpts = {}): Beat {
  const own = report.counts.ownColors;
  if (own <= 0) return 0;
  if (opts.generatedRamp || own >= SYSTEM_OWN_COLORS) return 2;
  return 1;
}

/**
 * The Type room's beat, re-exported.
 *
 * It lives in `beats-type.ts`, written by the Type milestone alongside this
 * file, and it asks a question this module's counts cannot answer on their own:
 * a face can be installed on the device and hold no role, and beat 0 hides the
 * very list that manages it. Re-exported here so both rooms are reached through
 * one module and the CSS reads one vocabulary; the implementation stays where
 * the room that owns it put it.
 */
export { typeBeat } from './beats-type.ts';
export type { TypeBeat } from './beats-type.ts';
