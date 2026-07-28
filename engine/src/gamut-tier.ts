// SPDX-License-Identifier: MPL-2.0
/**
 * How far OUT of the active gamut a colour is — "which ring", not "in or out".
 *
 * A picker axis is painted from the runs the active limit can show, and every
 * stretch it cannot used to be a hole over a flat rail. A hole says "nothing
 * here" when the truthful statement is "your screen can show this, your limit
 * cannot" — so each unreachable stretch gets a TIER, and the shells paint tier 1
 * as a wash, tier 2 fainter, concentric rings of decreasing opacity out from the
 * limit. This module is the classifier the picker (`components/color-spaces.ts`)
 * and the Colour Lab sliders (`lib/gamut-slider.ts`) both rank against, so there
 * is one tier model rather than two that can drift.
 *
 * Membership only. A tier is the answer to a `contains` call, NEVER a position in
 * a list:
 *
 *   Display-P3 is not a subset of Rec.2020. Its red primary lies outside the
 *   Rec.2020 red–green edge, so "the next gamut out" cannot be computed by
 *   incrementing an index — every candidate is an independent `contains` on the
 *   same l/c/h. A previous version of this codebase ranked by index and was
 *   wrong for exactly that colour, behind a test that asserted the arithmetic
 *   instead of the membership.
 *
 * Consequences worth knowing, all of them falling out of that rule:
 *
 * - limit `srgb` → candidates [p3, rec2020], so the answers are 0, 1, 2 or beyond;
 *   tier 3 needs a limit off the ladder (see the ICC case below). The P3 red corner
 *   is **tier 1** — quoted at full precision because it sits ON the hull and
 *   rounding pushes it off: L 0.6485740719414326, C 0.29948528899928223,
 *   h 28.958137085704436 (at 4 decimals `inGamut(…, 'p3')` is already false, and the
 *   tier reads BEYOND). A Rec.2020-only colour is tier 2. Measured tiers around a
 *   24-sample hue circle at l 0.6 / c 0.25, `.` for beyond:
 *   `111.......22...2...00001` — interleaving no index arithmetic can produce.
 * - limit `p3` → sRGB never appears as a tier: it is a true subset, so those
 *   colours answer tier 0 first. Rec.2020-only is tier 2.
 * - limit `rec2020` → the P3-only region is **tier 2**, a wash, not "beyond".
 *   This is the case the old bug got wrong.
 * - an ICC press limit (`iccGamutSource`) → its `id` matches none of the three,
 *   so all three are candidates: tier 1 sRGB, tier 2 P3-not-sRGB, tier 3
 *   Rec.2020-only, then beyond. "Your press can't put it down, your screen can
 *   show it." No new code path — a `SpaceSpec.limit` is already a `GamutSource`.
 *
 * Sub-sample honesty: the widest P3-beyond-Rec.2020 excursion is ~0.0020 chroma
 * (L 0.63, h 29) = 0.50% of a 0–0.4 chroma track, while one 24-sample step is
 * 4.35%. Under a Rec.2020 limit a tier-2 band is usually thinner than a sample
 * and will not render at all. The classifier is still correct — do NOT add a
 * sub-sample search to "fix" it, which is where cost explodes for a band a pixel
 * wide.
 *
 * Pure and deterministic: no Date, no Math.random, no IO.
 */

import {
  P3_SOURCE, REC2020_SOURCE, SRGB_SOURCE, fastRgbContains, resolveGamutSource,
} from './gamut-source.ts';
import type { GamutLimit, GamutSource } from './gamut-source.ts';

/** No gamut on the ladder holds this colour (or it is not a colour at all). */
export const BEYOND_TIER = -1;

/**
 * The order in which candidates are ASKED — narrowest-nominal first, so the
 * tightest true statement about a colour wins and the rings read outward.
 *
 * This order is a QUESTION order, never an implication: membership in one entry
 * is never taken to imply membership in a later one (see the module comment on
 * Display-P3 and Rec.2020). Every entry is asked independently.
 */
export const GAMUT_TIER_LADDER: readonly GamutSource[] = [SRGB_SOURCE, P3_SOURCE, REC2020_SOURCE];

/**
 * A tier classifier bound to one limit, with each candidate's fast membership
 * test hoisted out of the loop.
 *
 * Call this ONCE per axis paint and the returned function per probe: resolving
 * the limit and picking `fastRgbContains` per candidate is the work worth doing
 * once, and the returned closure is monomorphic where `contains` is not.
 *
 * `fastRgbContains` deliberately skips the domain guard, so the finiteness check
 * that guard would have done happens here, once, up front.
 */
export function gamutTierProbe(limit: GamutLimit): (l: number, c: number, h: number) => number {
  const src = resolveGamutSource(limit);
  const test = (s: GamutSource): ((l: number, c: number, h: number) => boolean) =>
    fastRgbContains(s) ?? ((l, c, h) => s.contains(l, c, h));
  const inside = test(src);
  const outer = GAMUT_TIER_LADDER.filter(g => g.id !== src.id).map(test);
  return (l, c, h) => {
    if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) return BEYOND_TIER;
    if (inside(l, c, h)) return 0;
    for (let i = 0; i < outer.length; i++) if (outer[i]!(l, c, h)) return i + 1;
    return BEYOND_TIER;
  };
}

/** Single-shot {@link gamutTierProbe} — for tests and cold call sites. Do not
 *  call this in a loop; it re-resolves and re-hoists every time. */
export function gamutTier(l: number, c: number, h: number, limit: GamutLimit): number {
  return gamutTierProbe(limit)(l, c, h);
}
