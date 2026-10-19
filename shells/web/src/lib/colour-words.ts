// SPDX-License-Identifier: MPL-2.0
/**
 * The words the colour surfaces use for gamuts and chart planes.
 *
 * The Colour Lab (#/lab) and the swatch details sheet in Assets describe the
 * same facts about a colour: which gamut holds it and what each chart plane
 * shows. Both read these tables, so a swatch and the Lab can never give the
 * same colour two different verdicts. English source strings; callers pass
 * them through `t()` where they are shown.
 */
import type { GamutName, SlicePlane } from '@lolly/engine';

/** The plane each chart draws, said plainly. */
export const PLANE_TITLE: Record<SlicePlane, string> = {
  lc: 'Lightness × Chroma',
  ch: 'Chroma × Hue',
  lh: 'Lightness × Hue',
};

/** What each plane is for, one sentence each. */
export const PLANE_WHY: Record<SlicePlane, string> = {
  lc: 'How much punch this hue can take, at every lightness.',
  ch: 'Which hues hold up at this lightness - and which collapse.',
  lh: 'The lightness band that can carry this much chroma.',
};

export const GAMUT_TITLE: Record<GamutName, string> = {
  srgb: 'sRGB',
  p3: 'Display-P3',
  rec2020: 'Rec.2020',
  none: 'Beyond every display',
};

/**
 * What each verdict MEANS, stated as capability rather than as a restriction.
 *
 * Leading with the limitation ("needs a wide-gamut screen") frames reaching past
 * sRGB as a problem, when it is usually the intent - a vivid colour that modern
 * displays genuinely reach. Only the last case is a warning, and it earns that
 * by being true regardless of what the user was targeting.
 */
export const GAMUT_BLURB: Record<GamutName, string> = {
  srgb: 'Reproducible everywhere - every screen, every browser, every print pipeline.',
  p3: 'More vivid than sRGB reaches. Shown in full on most phones and recent laptops; older monitors fall back.',
  rec2020: 'More vivid still - beyond Display-P3. Very few screens show all of this today.',
  none: 'Beyond every display and print process we can describe. This one will always be mapped down.',
};
