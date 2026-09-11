// SPDX-License-Identifier: MPL-2.0
/**
 * Colour Lab (#/lab) - one colour, in full detail.
 *
 * A single scrolling report, not a sidebar-and-stage tool. There is no canvas
 * to zoom and nothing to export, so the page is the document. Every control
 * sits in the flow of the report, next to the thing it changes.
 *
 * ## Why a view and not a tool
 *
 * The controls here are the shell's own: `mountColorField` with its tabbed
 * multi-space picker and the OKLCH rings/sliders. Tools are DATA - they
 * cannot import shell modules - so a tool version would have to reimplement
 * the picker, the one component the component audit unified. A view can also
 * be tall, which no `render.layout` mode allows (each keeps a fixed
 * zoom-to-fit stage). Trade-off accepted: no CLI render, no URL-mode export.
 *
 * ## The page follows the order of the questions
 *
 *   1. **Set a colour** - in any space. The picker, a free-text field, the
 *      brand rail. This is the only thing a first-time visitor needs to
 *      understand.
 *   2. **The charts** - where it lands, four ways, with the comparison-target
 *      control that sets what they draw: sRGB, Display-P3, Rec.2020, and a
 *      press profile if you have added one. High up, because they are the
 *      reason to open the page.
 *   3. **Every notation** - the same colour written for each space, copyable.
 *   4. **Tones and blends** - ramps built from it: through its own lightness,
 *      and across to a second colour you choose, at a step count you set.
 *   5. **Displayable range and readability** - the verdict and the contrast
 *      scores. Real, but reference: you check these once you have a
 *      candidate, so they sit at the bottom, below the charts.
 *
 * Simple at the top, detailed further down.
 *
 * Picking happens in five places: the picker, the text field, the brand
 * rail, a drag on any 2D chart, and any ramp step. All of them go through
 * `setSubject`, so no two paths can disagree.
 *
 * ## The subject is never collapsed to sRGB
 *
 * The colour is kept as the string the user authored and described by the
 * engine's `describeColor`, so `color(display-p3 1 0 0)` reports its real
 * chroma (0.299) and its real gamut (P3). It is not flattened to `#ff0000`
 * and then wrongly marked sRGB-safe.
 *
 * It is also PAINTED from the authored value. Every swatch on this page sets
 * the colour as CSS wrote it, so a wide-gamut display shows the real colour
 * and a narrower one falls back - the browser does that mapping itself, per
 * display, which is better than deciding in advance that nobody can see it.
 * `srgbHex` is used only where a hex is required - the dots drawn over the
 * charts and the 3D canvas, which take a colour as a hex. Chart FILLS are no
 * longer in that group: they paint in the display's own space
 * (lib/display-gamut.ts), so on a P3 screen the plot shows the real colour
 * out to P3's boundary. Where a hex does stand in, it is labelled, not
 * passed off as the value.
 *
 * The picker is no longer in that group either: it is seeded with the
 * authored string and read back through its `detail.css`, so the subject
 * survives a round trip through the control at its real chroma. Its sliders
 * still gamut-map what they PAINT, which is a display honesty question, not
 * a value one.
 */

import '../styles/parts/color-lab.css';
import '../styles/parts/platform.css';     // the .plat-client-* device cards at the foot of the page
import '../lib/oklch-slice.css';           // the .okls-* chart rules (see oklch-slice.ts)
import {
  describeColor, contrastVsExtremes, wcagLevel, oklchToHex, formatOklch, rampOklab,
  apcaVerdict, apcaContrast, apcaUse, APCA_BANDS, APCA_SRGB_ONLY,
  simulateCvdHex, toGrayscaleHex,
  gamutSolid, projectGamutSolid, projectSolidPoint, contrastRatio, GAMUTS,
  parseColor, colorToHexString, interpolateColor, chromaAxisMax,
  gamutSourceId, resolveGamutSource, fastRgbContains, inGamut, maxChroma, clipToGamut, deltaEOk, convertColor,
  iccRoundTripDeltaE, iccRoundTripDecides, ICC_GAMUT_DELTA_E, encodeOklch,
  projectSolidPoints, imageColorCloud,
  gamutSolidToSvg, P3_SOURCE, REC2020_SOURCE,
} from '@lolly/engine';
import type {
  EncodeSpace, ImageCloud,
  ColorDescription, GamutName, GamutSolid, SlicePlane,
  ColorSpaceTag, HueDirection, GamutLimit, GamutSource, IccProfile, RenderingIntent,
  SolidEmbed,
} from '@lolly/engine';
import {
  BLEND_STYLES, HUE_ROUTES, isPolarSpace, cssInterpolation,
} from '../lib/blend-style.ts';
import {
  renderSliceChart, paintSliceChart, wireSliceChart, updateSliceDot,
  sliceFixedOf, formatFixed, contourGamuts,
} from '../lib/oklch-slice.ts';
import type { SliceChartState } from '../lib/oklch-slice.ts';
import { releaseHdrCanvas } from '../lib/hdr-canvas.ts';
import {
  renderGamutSlider, paintGamutSlider, wireGamutSlider, channelRange, clampIntoGamut,
} from '../lib/gamut-slider.ts';
import type { GamutChannel } from '../lib/gamut-slider.ts';
import {
  onDisplayGamutChange, acquire2d, displayAnchorGamut, displayAnchor, displaySupportsHdr,
} from '../lib/display-gamut.ts';
import { hdrPngUrl } from '../lib/hdr-image.ts';
import type { HdrExposure } from '../lib/hdr-image.ts';
import { jellyActive, ensureJelly } from '../lib/jelly.ts';
import { icon } from '../lib/icons.ts';
import {
  activateProfile, deactivateProfile, getProfile, parseProfileLimit, profileFor,
  removeProfile, shortLabel, absentLabel,
} from '../lib/color-profiles.ts';
import type { ColorProfilesHost, ProfileEntry } from '../lib/color-profiles.ts';
import { openProfilesPanel } from '../components/profiles-manager.ts';
import { mountColorField, contrastText } from '../components/color-field.ts';
import { attachScrub } from '../lib/scrub.ts';
import type { MountColorFieldOpts } from '../components/color-field.ts';
import { backPillHtml, mountBackPill } from '../components/back-pill.ts';
import { collectDevice, renderDeviceCards, wireDeviceLive } from '../lib/device-info.ts';
import type { ClientGroup, ClientGroupKey } from '../lib/device-info.ts';
import { createThemeToggle } from '../components/theme-toggle.ts';
import { mountProfileFab } from '../components/profile-menu.ts';
import { homeFabHtml, mountHomeFab } from '../components/home-fab.ts';
import { escape } from '../utils.ts';
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';

/**
 * One brand colour as `host.tokens.colors()` hands it over. `value` is ALWAYS an
 * sRGB hex (the engine bakes the canonical value down in `tokens.ts` `toSwatch`);
 * the only place a wider-gamut value survives is an authored `faces` override
 * (v1.77 - keyed by a CSS space name like `display-p3`/`rec2020`, or a profile id),
 * which is what lets a display-gamut badge ever be meaningful (see `renderBrand`).
 */
interface LabSwatchInput {
  id?: string;
  name?: string;
  value?: string;
  faces?: Record<string, string | number[]>;
}

/** A brand swatch resolved once at mount, then re-badged as the target moves. */
interface BrandSwatch {
  /** What a click seeds - the token's own sRGB hex, so picking is unchanged. */
  pick: string;
  /** The guaranteed-parseable sRGB hex, painted as the fallback fill and shown in the tip. */
  hex: string;
  /** The richest CSS value available (a wide face, else `hex`) - painted on top so a
   *  wide-gamut brand colour shows as itself, and the basis for the gamut verdict. */
  real: string;
  name: string;
  /** The OKLCH of `real`, or null if it would not parse. The badge decision reads this. */
  oklch: { l: number; c: number; h: number } | null;
}

/** The host surface this view needs - only the brand palette, and optionally. */
export interface ColorLabHost {
  /** Only what the theme toggle persists through - the profile is the canonical
   *  theme store. Optional: without it the switch still applies and still sings,
   *  it just is not remembered. */
  profile?: { get(): Promise<object>; set?(profile: object): Promise<unknown> };
  tokens?: { colors?(): Promise<LabSwatchInput[]> | LabSwatchInput[] };
  /** The user-asset rail, only for the stored ICC profiles (lib/color-profiles.ts).
   *  Optional: a host without it simply has no print pill and no `+` affordance. */
  assets?: ColorProfilesHost['assets'];
}

/** The three 2D planes, in the order they are laid out. */
const PLANES: SlicePlane[] = ['lc', 'ch', 'lh'];

/**
 * Each panel is named for the CHANNEL it sets, not for the plane it draws.
 *
 * That pairing is the whole interactive model: a panel is "Lightness" because its
 * slider and its number set lightness, and its chart happens to be the plane with
 * lightness as an axis. Titling them by plane ("Lightness × Chroma") described the
 * picture instead of the control, and - worse - invited the slider under it to
 * drive the plane's FIXED channel, which is a different knob from the one the
 * panel is about.
 */
const PANEL_CHANNEL: Record<SlicePlane, GamutChannel> = { lc: 'l', ch: 'c', lh: 'h' };

const PANEL_TITLE: Record<SlicePlane, string> = {
  lc: 'Lightness',
  ch: 'Chroma',
  lh: 'Hue',
};
/** The plane each panel draws, said plainly under the title. */
const PLANE_TITLE: Record<SlicePlane, string> = {
  lc: 'Lightness × Chroma',
  ch: 'Chroma × Hue',
  lh: 'Lightness × Hue',
};
const PLANE_WHY: Record<SlicePlane, string> = {
  lc: 'How much punch this hue can take, at every lightness.',
  ch: 'Which hues hold up at this lightness - and which collapse.',
  lh: 'The lightness band that can carry this much chroma.',
};

const GAMUT_TITLE: Record<GamutName, string> = {
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
 * displays genuinely reach. Only the last case is a warning, and it earns it by
 * being true regardless of what the user was targeting.
 */
/**
 * A comparison target's name, whatever kind it is: the display gamut's title, or
 * a profile source's own label ('Coated FOGRA39 (relative)').
 *
 * A NAME is the claim, and that is the whole honesty model here - a measured
 * target carries the profile's own name and an intent, a derived one carries a
 * standard's name, and an approximate one (the picker's bare CMYK) carries no
 * name at all. So this never invents a label for a source that has one.
 */
const limitTitle = (limit: GamutLimit): string =>
  (typeof limit === 'string' ? GAMUT_TITLE[limit] : resolveGamutSource(limit).label);

const GAMUT_BLURB: Record<GamutName, string> = {
  srgb: 'Reproducible everywhere - every screen, every browser, every print pipeline.',
  p3: 'More vivid than sRGB reaches. Shown in full on most phones and recent laptops; older monitors fall back.',
  rec2020: 'More vivid still - beyond Display-P3. Very few screens show all of this today.',
  none: 'Beyond every display and print process we can describe. This one will always be mapped down.',
};

/**
 * The blend's default style - Vivid, not the gradient spec's OKLab.
 *
 * Module level because `shellHtml()` writes the pressed state and the mount's own
 * state initialises from it, and those two must not be able to disagree.
 */
const BLEND_DEFAULT_SPACE: ColorSpaceTag = 'oklch';
const BLEND_DEFAULT_HUE: HueDirection = 'shorter';

/** The alternate notations shown ON the swatch, in order. A short list on
 *  purpose - the full set lives in the notation table. */
const SWATCH_ALT_SPACES: readonly string[] = ['oklch', 'lch', 'display-p3'];

/**
 * Which CSS space each of the picker's tabs speaks, so the swatch can lead with
 * the value in the space the user is actually picking in.
 *
 * `cmyk` maps to null: there is no CSS `cmyk()`, and the picker's own CMYK is an
 * approximate conversion for print rather than a colour notation - so the swatch
 * falls back to hex there rather than inventing a syntax. A press profile's tab
 * (`icc:…`) is the same case and is not listed at all; {@link pickerSpaceFor}
 * answers null for it, and for anything else the registry grows.
 */
const PICKER_MODE_SPACE: Record<string, string | null> = {
  oklch: 'oklch',
  hsl: 'hsl',
  rgb: 'srgb',
  hex: null,
  cmyk: null,
};

/** The CSS space a picker tab speaks, or null when it speaks none.
 *  `Object.hasOwn`, so an unregistered mode cannot resolve to a prototype key. */
const pickerSpaceFor = (mode: string): string | null =>
  (Object.hasOwn(PICKER_MODE_SPACE, mode) ? PICKER_MODE_SPACE[mode]! : null);

/** A colour to seed with when nothing else is available. Written in oklch() on
 *  purpose: the report is an OKLCH instrument, and opening on a hex would put the
 *  least informative notation in the field the user is most likely to edit. */
const FALLBACK = 'oklch(62% 0.19 260)';

/** The persistent `#view`, onto which a mounted view stamps its teardown. */
interface ViewElement extends HTMLElement { _cleanup?: () => void }

/**
 * The gamut the Lab opens on: **always Rec.2020**, the widest one we classify, so
 * nothing is hidden until the reader narrows it. `&limit=` in a link still wins.
 *
 * It was briefly seeded from the display - a P3 screen opened on the P3 tab - and
 * Andy asked for Rec.2020 back. The reasoning holds up: the tab is a *comparison
 * target*, a question the reader is asking ("how far past sRGB is this?"), and
 * answering it with the reader's hardware narrows the picture before they have asked
 * anything. Opening at the widest shows the whole envelope, and the tier wash already
 * says which parts of it this display can actually deliver - so nothing is lost by
 * starting wide, while starting narrow hides colour that exists.
 *
 * The display still decides everything it should: the opacity anchor (so a P3 band is
 * fully opaque on a P3 screen) and the canvas encoding. Those are "what can you see",
 * which is the display's business; the tab is "what am I comparing against", which is
 * not. Keeping `displayGamutClaim` out of this line is the whole reason those two are
 * separate functions.
 */
const DEFAULT_LIMIT: Exclude<GamutName, 'none'> = 'rec2020';

/**
 * The chroma ceiling the CONTROLS are scaled to - the sliders, the typed boxes and
 * their scrub gesture - which is deliberately NOT the ceiling the charts are drawn
 * to.
 *
 * A chart's axis follows the comparison target, because a chart is a picture OF that
 * gamut: the envelope should fill the plot. A control is not a picture of anything;
 * it is how the colour gets edited. Scale it to the target and pressing "sRGB" - a
 * lens, not an editor - takes away chroma that was reachable a moment earlier, and
 * the range input's own `max` silently rewrites the subject on the way down. So the
 * controls stay at the widest gamut we classify, whichever tab is pressed, and the
 * chart says where that gamut stops. Indicate, never clamp.
 */
const CONTROL_LIMIT: Exclude<GamutName, 'none'> = 'rec2020';

/**
 * The headroom / nits axis (plan 154 WP-5).
 *
 * A SEPARATE, labelled control - the peak luminance the light end of each chart is
 * exposed to on an HDR display - NOT an extension of the OKLab L slider past 1.0.
 * OKLab L stays honest at <= 1; this axis says "how far into the display's headroom
 * the top of the lightness axis is pushed", which is an exposure choice, not a
 * perceptual coordinate.
 *
 * The floor is SDR reference white (BT.2408 diffuse white, {@link NITS_SDR_WHITE}):
 * at the floor the gain is 1 and nothing rises above SDR white, which is the honest
 * "no headroom used" end. The default and ceiling mirror hdr-image.ts's own
 * `peakNits` default (1000) and leave room to tune upward on a brighter panel.
 */
const NITS_SDR_WHITE = 203;
const NITS_DEFAULT = 1000;
const NITS_MIN = NITS_SDR_WHITE;
const NITS_MAX = 2000;

/**
 * The contrast matrix is N×N over the palette (plus white and black), and N is
 * capped so the grid stays readable and the O(N²) APCA recompute stays cheap. A
 * cap that bites is SURFACED - `renderCvdMatrix` logs it and shows a "first N of M"
 * note - never silently swallowed (the no-silent-caps rule).
 */
const MATRIX_MAX = 12;

/** The five vision-preview modes the diagnostic panel offers. `normal` is the
 *  identity; the rest map to engine simulations (see {@link simulatePalette}). */
export type CvdMode = 'normal' | 'grayscale' | 'protan' | 'deutan' | 'tritan';

/** A press profile mounted as the Lab's comparison target. */
interface ActiveProfile {
  entry: ProfileEntry;
  intent: RenderingIntent;
  src: GamutSource;
  profile: IccProfile;
  /** The substrate: zero ink for an ink space, device white otherwise. PCS Lab. */
  paper: [number, number, number] | null;
  /**
   * Is the round-trip ΔE what decides membership for this file? False for a
   * matrix/TRC or gray profile, whose device cube is tested directly - so the
   * `Shift` readout and the card's tolerance sentence are both withheld rather
   * than stating a rule the verdict beside them does not follow.
   */
  roundTripDecides: boolean;
}

export async function mountColorLab(view: HTMLElement, host: ColorLabHost, params = ''): Promise<void> {
  document.title = 'Colour Lab · Lolly';

  // ── State ────────────────────────────────────────────────────────────────
  /** The colour as AUTHORED - any CSS colour, not necessarily inside sRGB. */
  let subject = seedFrom(params) ?? FALLBACK;
  let desc = describeColor(subject) ?? describeColor(FALLBACK)!;
  /**
   * Which gamut the charts and the solid extend to - the comparison target.
   *
   * Seeded ONCE, before any markup exists: `&limit=` if the link carried one, else
   * {@link DEFAULT_LIMIT}. Computed here rather than inside `shellHtml` because the
   * pressed pill, the typed inputs' bounds, the legend and the charts all read it and
   * must not be able to disagree on first paint.
   *
   * The tab is a comparison target, so it is the USER's choice and nothing else's - not
   * the display's, and not the subject's. A later monitor change repaints (see
   * `onDisplayGamutChange`) and does not move the tab.
   *
   * A {@link GamutLimit} rather than a name, so a press profile is the comparison
   * target by the same route a display gamut is - the whole point of the engine's
   * gamut-source abstraction.
   */
  const urlLimit = limitFrom(params);
  let limit: GamutLimit = urlLimit && !parseProfileLimit(urlLimit)
    ? urlLimit as Exclude<GamutName, 'none'>
    : DEFAULT_LIMIT;
  /**
   * What `&limit=` should say, VERBATIM - not derived from `limit` on the way out.
   *
   * The difference only shows for a link naming a profile this device does not
   * have: the charts fall back to {@link DEFAULT_LIMIT}, but rewriting the URL to
   * `rec2020` would silently downgrade someone's link the next time it was copied.
   * The id stays, the pill says the profile is absent, and adding the file heals it.
   */
  let limitParam: string | null = urlLimit;
  /** Whether the URL should carry `&limit=` - true once the reader has chosen one
   *  (or arrived on a link that had). A detected default is not worth pinning into
   *  a shared link; a decision is. */
  let limitPinned = urlLimit != null;
  /** The mounted press profile, when there is one. At most one at a time - see
   *  `renderLimitSeg` for why the row carries exactly one profile pill. */
  let activeProfile: ActiveProfile | null = null;
  /** A `&limit=icc:…` from a link whose profile is not on this device. */
  let absentLimit: string | null = null;
  /** The brand rail's swatches, resolved once (see the brand-swatch block near the
   *  end of mount) and re-badged by `renderBrand` whenever the comparison target moves. */
  let brandSwatches: BrandSwatch[] = [];
  /**
   * The vision-preview mode driving the contrast matrix AND the brand rail - a
   * read-only diagnostic that never writes a token. `normal` is the identity;
   * `grayscale`/`protan`/`deutan`/`tritan` recolour the swatches through the engine
   * (Machado 2009 / Rec.709) and RESCORE the matrix's APCA on the simulated colours,
   * which is the point: to see how the palette's contrasts hold up for that vision.
   */
  let cvdMode: CvdMode = 'normal';
  /** Simulation severity as a percentage (0–100). Only the three graded CVD types
   *  read it; grayscale and normal ignore it. 100% = full dichromacy, 0% = identity. */
  let cvdSeverity = 100;
  /** Logged at most once when the palette is capped - the no-silent-caps rule. */
  let cvdCapLogged = false;

  // A link that names a profile is resolved BEFORE the first paint: it is one
  // keyed IDB read and a parse measured in microseconds, and doing it later would
  // show the reader a Rec.2020 chart that then flipped to a press gamut.
  if (urlLimit && parseProfileLimit(urlLimit)) {
    const src = await adoptProfileLimit(urlLimit);
    if (src) limit = src;
    else absentLimit = urlLimit;
  }

  /**
   * Mount the profile a `limit` id names and adopt it as {@link activeProfile}.
   * Null when the file is not on this device, will not parse, or cannot answer
   * under that intent - never a source that quietly used a different table.
   */
  async function adoptProfileLimit(id: string): Promise<GamutSource | null> {
    const parsed = parseProfileLimit(id);
    if (!parsed || !host.assets) return null;
    const h = host as ColorProfilesHost;
    try {
      const entry = await getProfile(h, parsed.digest);
      if (!entry) return null;
      const src = await activateProfile(h, parsed.digest, parsed.intent);
      const profile = profileFor(parsed.digest);
      if (!src || !profile) return null;
      // One profile mounted at a time: switching profiles unmounts the last one,
      // so the picker's output row cannot accumulate tabs the Lab's single pill
      // has no way to switch between.
      if (activeProfile && activeProfile.entry.digest !== parsed.digest) {
        deactivateProfile(activeProfile.entry.digest);
      }
      activeProfile = {
        entry, intent: parsed.intent, src, profile, paper: paperWhite(profile, parsed.intent),
        roundTripDecides: iccRoundTripDecides(profile),
      };
      absentLimit = null;
      return src;
    } catch { return null; }
  }
  /**
   * Whether dragging is held inside the target gamut.
   *
   * Default OFF, deliberately: reaching past sRGB is usually the intent, not a
   * mistake, and the app's job is to show the consequence rather than prevent it.
   * ON is for the times you must stay reproducible - proofing to a press, or
   * keeping a palette sRGB-safe - and then chroma yields rather than the axis you
   * are dragging (see clampIntoGamut).
   */
  let boundsOn = false;
  /**
   * The headroom / nits axis's current value - the peak luminance the light end of
   * the charts is exposed to on an HDR display (plan 154 WP-5, {@link NITS_DEFAULT}).
   *
   * Seeded from `&nits=` when a shared link carried one, so an HDR-tuned link
   * reproduces the sender's exposure. `nitsPinned` decides whether it rides back out
   * in the URL - a value the reader chose (or arrived on) is worth sharing; the bare
   * default is not. This is NOT a lightness coordinate - see {@link NITS_DEFAULT}.
   */
  const urlNits = nitsFrom(params);
  let exposureNits = urlNits ?? NITS_DEFAULT;
  let nitsPinned = urlNits != null;
  /**
   * The A/B preview: true shows the HDR boost, false forces the SDR rendering so the
   * two can be compared on the same panel. Only meaningful on an HDR display (on an
   * SDR one there is no boost either way); the control that flips it is hidden off HDR.
   */
  let hdrPreview = true;
  /** The tone ramp's step count. The blend carries its own - see `blendStops`. */
  let steps = 9;
  /**
   * The blend: its far end, how it interpolates, and how many stops it is cut into.
   *
   * The style vocabulary is the canvas gradient panel's (Smooth / Vivid / sRGB - 
   * see lib/blend-style.ts), so the two surfaces name the same thing the same way.
   * The stop count is separate from the tone ramp's on purpose: they answer
   * different questions - a tone ramp is usually a palette of 5–9, while a blend
   * gets cut finely to find one particular intermediate.
   *
   * **Vivid is the default here**, unlike the gradient spec's OKLab (which is a wire
   * format defaulting to what `color-mix()` does). This page is where someone comes
   * to see how much colour a blend can hold, and going round the hue circle is the
   * answer that shows it - travelling through the middle is the thing they came to
   * avoid. sRGB stays one click away for matching an existing asset.
   *
   * The TONE ramp needs no style knob to match: its anchors are all at the subject's
   * own hue, and interpolating between two colours of equal hue is the same operation
   * in OKLab and OKLCH (a = C·cos h, b = C·sin h - a lerp of a and b at fixed h is a
   * lerp of C). It is hue-locked, so it is already vivid by construction, and adding
   * a control that provably changes nothing would be a lie.
   */
  let other = 'oklch(85% 0.13 85)';
  let blendSpace: ColorSpaceTag = BLEND_DEFAULT_SPACE;
  let blendHue: HueDirection = BLEND_DEFAULT_HUE;
  let blendStops = 9;

  /**
   * The third surface the colour is read against, beyond black and white.
   *
   * Defaults to an ordinary light UI surface - near-white but not white, because
   * that is what most colours actually sit on and because the white card already
   * covers the extreme.
   *
   * Three defaults were tried and rejected first, and the rejections are the useful
   * part: the page's own `--background`, which on a light theme IS white and made
   * this card an exact duplicate of the white one; black, the same problem inverted;
   * and a mid grey (#767676, WCAG's 4.5:1 boundary against white), which is the most
   * *interesting* surface but scores Lc 0.0 against any mid-tone subject - true,
   * since the two are near-isoluminant, but it reads as a broken card rather than as
   * a finding.
   */
  let ink = '#f4f4f5';
  /** The 3D view angles, and the solid meshes (cached - each costs a build). */
  const solidView = { yaw: 28, pitch: 18, scale: 0.92 };
  const solidCache = new Map<string, GamutSolid>();
  /**
   * How the solid is embedded. Default 'landscape' - hue laid out flat, so the
   * peaks and troughs per hue are directly comparable.
   *
   * 'lab' is the ColorSync/iccview view: the opponent axes on the floor,
   * lightness standing up, and - the reason it matters here - ONE scale for all
   * three axes. The cylinder divides chroma by the gamut's own peak, which makes
   * every gamut fill the frame identically and destroys exactly the comparison a
   * press profile is loaded to make; in 'lab' sRGB stays squat and Rec.2020 wide,
   * and a press solid is visibly the smaller object it is.
   */
  let solidEmbed: SolidEmbed = 'landscape';

  const cleanups: Array<() => void> = [];

  view.innerHTML = shellHtml();
  mountBackPill(view);
  mountHomeFab(view);

  const $ = <T extends HTMLElement = HTMLElement>(sel: string): T | null =>
    view.querySelector<T>(sel);

  // The theme cycle, icon-only. `host.profile` may be absent (the components view
  // mounts this bare, and so do the tests), and the shared tail treats the profile
  // write as best-effort - but the call itself needs an object, so stub it.
  const chrome = $('[data-lab-chrome]');
  if (chrome) {
    // The home escape is baked into shellHtml()'s chrome (no new raw-HTML sink);
    // the theme cycle and the profile quick link are appended after it, all in
    // the Lab's .lab-chrome-btn skin.
    const chromeHost = host.profile
      ? (host as { profile: NonNullable<ColorLabHost['profile']> })
      : { profile: { get: async () => ({}) } };
    chrome.appendChild(createThemeToggle(chromeHost, { className: 'lab-chrome-btn' }));
    mountProfileFab(chrome, chromeHost, { className: 'lab-chrome-btn' });
  }

  // ── The subject block ────────────────────────────────────────────────────
  const swatch = $('[data-lab-swatch]')!;
  const pickerMount = $('[data-lab-picker]')!;
  // ── The out-of-gamut toast ───────────────────────────────────────────────
  // Transient by design: the toast is the nudge when you cross the boundary, and
  // the gamut card in step 5 is the standing record. A latch means a drag that
  // wanders in and out does not strobe it - it fires once per excursion.
  let toastEl: HTMLElement | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let announcedOut = false;

  function showGamutToast(html: string): void {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast toast--wrap is-muted';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('data-lab-toast', 'gamut');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = `<span class="toast-message">${html}</span>`;
    // Two frames: the element must be in the layout before the transition can run.
    requestAnimationFrame(() => requestAnimationFrame(() => toastEl?.classList.add('is-visible')));
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl?.classList.remove('is-visible'), 7000);
  }
  function hideGamutToast(): void {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl?.classList.remove('is-visible');
  }
  cleanups.push(() => {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl?.remove();
    toastEl = null;
  });

  /** True while the picker is being re-seeded, so its own onChange is ignored. */
  let seeding = false;
  /** The hex the picker emits when it merely restates the colour it was handed - 
   *  the seed baked to sRGB. NOT `srgbHex`, which is gamut-MAPPED (chroma reduced),
   *  so the two differ for a wide-gamut subject and both have to be recognised. */
  let seedBake = '';

  /** The picker's active space tab ('oklch' by default). */
  const pickerMode = (): string =>
    pickerMount.querySelector<HTMLElement>('[data-color-modes]')?.dataset.activeMode ?? 'oklch';

  // Switching the picker's space re-titles the swatch, so the value on it always
  // matches the space being edited. Delegated, because the picker is re-mounted.
  pickerMount.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-color-modes]')) return;
    // After the picker's own handler has moved data-active-mode.
    requestAnimationFrame(() => renderReadouts());
  });

  // Through the same seeding-guarded path as every later re-seed. Mounting it
  // inline here instead is what made EVERY colour report "sRGB": the picker emits
  // an onChange while it wires up, and with no guard that echo overwrote the
  // authored subject with the picker's sRGB hex before the first paint. jsdom
  // never fires that event, so the test suite was blind to it.
  reseedPicker();

  // ── The gamut-limit control ──────────────────────────────────────────────
  const limitSeg = $('[data-lab-limit]')!;
  /** The charts' container, marked `aria-busy` while an expensive target builds. */
  const chartsSection = $('[data-lab-charts]');

  /**
   * The comparison row: the three display gamuts, then AT MOST ONE press pill,
   * then the `+` that opens the profile panel.
   *
   * One profile pill however many are stored, deliberately. Every mounted profile
   * gets a picker tab for free (the output family widens for it), but this row is
   * a comparison-target selector and a fifth, sixth and seventh pill is precisely
   * the failure section 11.6b describes. Which profile is live is chosen in the panel,
   * where the intent buttons and the remove buttons already live.
   *
   * The native row holds no mounted control, so rebuilding its markup is safe.
   * The JELLY row does - see `renderJellyLimit`.
   */
  function renderLimitSeg(): void {
    if (jellyActive()) { renderJellyLimit(); return; }
    const id = gamutSourceId(limit);
    const btn = (val: string, label: string, pressed: boolean, extra = ''): string =>
      `<button type="button" class="view-seg-btn${extra}" data-val="${escape(val)}"
        aria-pressed="${pressed}">${escape(label)}</button>`;
    const pills = GAMUTS.map(g => btn(g, GAMUT_TITLE[g], id === g));
    if (activeProfile) {
      pills.push(btn(
        activeProfile.src.id, shortLabel(activeProfile.entry, activeProfile.intent),
        id === activeProfile.src.id, ' lab-limit-press',
      ));
    } else if (absentLimit) {
      // Never pressed, and clicking it opens the panel rather than switching to a
      // gamut we cannot compute. The URL is untouched - see `limitParam`.
      pills.push(`<button type="button" class="view-seg-btn lab-limit-press"
        data-lab-limit-absent aria-pressed="false" data-state="absent"
        title="${escape(t('This link compares against a profile that isn’t on this device.'))}"
        >${escape(absentLabel(absentLimit))}</button>`);
    }
    if (host.assets) {
      // The name has to be the panel's own: it opens "Colour profiles" (Print /
      // Display / Other), and announcing "Print profile" reinstated exactly the
      // restriction that rename retracted. `data-tip`, not `title`, which no phone
      // can open - and a word beside the glyph, because a lone `+` at the end of a
      // segmented row reads as an overflow control rather than an invitation.
      pills.push(`<button type="button" class="view-seg-btn lab-limit-add" data-lab-profiles
        aria-label="${escape(t('Colour profiles'))}" data-tip="${escape(t('Colour profiles'))}"
        ><span class="lab-limit-add-g" aria-hidden="true">+</span>${escape(t('Add'))}</button>`);
    }
    limitSeg.innerHTML = pills.join('');
  }

  /**
   * The same row under Jelly effects - one <jelly-segmented> for the choices,
   * with the `+ Add` left as an ordinary button beside it.
   *
   * `+` is deliberately NOT a segment. A segmented control's pill means "this is
   * the one you are on", and sliding it onto a button that opens a dialog and
   * then slides back would say the opposite of what happened. It is an action
   * sitting next to a choice, and the native row already treats it that way.
   *
   * Rebuilt only when the SET of options changes, never on an ordinary
   * selection - the whole reason to mount a jelly control is that its pill
   * travels from the old choice to the new one, and re-writing innerHTML would
   * throw that away and park a fresh pill at the destination. Steering the
   * `value` attribute is what makes it slide. Same rule as the nav pill
   * (components/view-toggle.ts), for the same reason.
   *
   * An absent profile (a shared link naming a profile this device does not have)
   * cannot be a segment either: it is not selectable, so it stays a button.
   */
  function renderJellyLimit(): void {
    const id = gamutSourceId(limit);
    const opts: { val: string; label: string }[] =
      GAMUTS.map(g => ({ val: g, label: GAMUT_TITLE[g] }));
    if (activeProfile) {
      opts.push({
        val: activeProfile.src.id,
        label: shortLabel(activeProfile.entry, activeProfile.intent),
      });
    }
    const keys = opts.map(o => o.val).join();
    const seg = limitSeg.querySelector('jelly-segmented');
    if (seg && limitSeg.dataset.keys === keys) {
      seg.setAttribute('value', id);
      return;
    }
    limitSeg.dataset.keys = keys;
    const tail: string[] = [];
    if (!activeProfile && absentLimit) {
      tail.push(`<button type="button" class="view-seg-btn lab-limit-press"
        data-lab-limit-absent aria-pressed="false" data-state="absent"
        title="${escape(t('This link compares against a profile that isn’t on this device.'))}"
        >${escape(absentLabel(absentLimit))}</button>`);
    }
    if (host.assets) {
      tail.push(`<button type="button" class="view-seg-btn lab-limit-add" data-lab-profiles
        aria-label="${escape(t('Colour profiles'))}" data-tip="${escape(t('Colour profiles'))}"
        ><span class="lab-limit-add-g" aria-hidden="true">+</span>${escape(t('Add'))}</button>`);
    }
    limitSeg.innerHTML =
      `<jelly-segmented class="lab-limit-seg" value="${escape(id)}"
        label="${escape(t('See it against'))}">${
        opts.map(o => `<jelly-segment value="${escape(o.val)}">${escape(o.label)}</jelly-segment>`).join('')
      }</jelly-segmented>${tail.join('')}`;
  }

  /**
   * Adopt a comparison target and repaint everything that reads it.
   *
   * Split in two for one reason: a profile-backed target is EXPENSIVE the first
   * time. Its ceiling grid is ~9.4k bisections against a CLUT (`ceilingGrid` in
   * engine/src/gamut.ts) and the 3D solid another 3.8k probes, measured at
   * 400–700 ms per profile × intent in Chrome - one blocking task with no
   * feedback if it runs inside the click. So the cheap half (the pressed pill, the
   * press card, the URL) paints first, the section is marked `aria-busy`, and the
   * charts follow on the next frame. The work still blocks once; it no longer
   * blocks BEFORE the reader has been told their press was pressed.
   *
   * A built-in gamut goes the straight-through path - its grid is a millisecond,
   * and deferring would make a synchronous tab press stop being synchronous for
   * everything that reads it, tests included.
   */
  function setLimit(next: GamutLimit, param: string | null): void {
    limit = next;
    limitParam = param;
    limitPinned = param != null;   // a chosen target travels with the link
    renderLimitSeg();
    renderReadouts();              // the ceilings list and the press card follow the target
    renderBrand();                 // re-badge the brand rail against the new target (cheap, so eager)
    syncUrl();
    const heavy = fastRgbContains(resolveGamutSource(next)) == null
      && typeof requestAnimationFrame === 'function';
    if (!heavy) { repaintForLimit(); return; }
    chartsSection?.setAttribute('aria-busy', 'true');
    // Two frames: one to get the pressed state and the busy attribute on screen,
    // the second to run in. One frame is not enough - the callback of the first
    // still lands before that frame's paint.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      repaintForLimit();
      chartsSection?.removeAttribute('aria-busy');
    }));
  }

  /** The half of a target change that costs: the charts and the solid. */
  function repaintForLimit(): void {
    // The legend keys are part of the chart's markup, so the limit change needs a
    // rebuild, not just a repaint.
    buildCharts();
    paintCharts();
    paintSolid();
    refreshVectors();   // the single-solid still tracks the current limit
  }

  /**
   * (Re)paint the brand rail, badging every swatch whose TRUE colour cannot fit
   * the CURRENT comparison target.
   *
   * A read-only diagnostic: it INDICATES, it never writes - a click still seeds
   * the swatch's own colour verbatim (`pick`), and nothing here mutates the token.
   * The badge is a corner dot (no border on the rounded tile - house rule) plus a
   * `title`/`aria-label` naming the target, the sRGB hex the colour would clip to,
   * and the ΔE of that clip. The verdict is `swatchGamutState`, which asks the
   * ACTUAL gamut (never an ordering - P3 ⊄ Rec.2020), so a press profile narrower
   * than sRGB lights up its plain-hex brand colours, and a display gamut only
   * badges a swatch that carries a genuinely wider face.
   *
   * A no-op until the swatches are resolved; the click delegation is wired once,
   * in the brand-swatch block, so rewriting `innerHTML` here keeps it live.
   */
  function renderBrand(): void {
    const mount = $('[data-lab-brand]');
    if (!mount || !brandSwatches.length) return;
    const gName = limitTitle(limit);
    const sev = cvdSeverity / 100;
    mount.innerHTML = brandSwatches.map((sw) => {
      const g = sw.oklch ? swatchGamutState(sw.oklch, limit) : null;
      const oog = !!g?.outOfGamut;
      const badge = oog ? '<span class="lab-brand-badge" aria-hidden="true"></span>' : '';
      // The tip's extra line explains the badge - "clamped" alone means nothing,
      // the same reasoning as the notation table's fit note. The gamut verdict is on
      // the TRUE colour, so it is unaffected by the vision preview.
      const tip = oog
        ? `${sw.name} ${sw.hex}\n${tRaw('Outside {gamut} - clips to {hex} (ΔE {de})', {
            gamut: gName, hex: g!.clippedHex, de: g!.deltaE.toFixed(2),
          })}`
        : `${sw.name} ${sw.hex}`;
      const label = oog
        ? tRaw('Inspect {name} - outside {gamut}', { name: sw.name, gamut: gName })
        : tRaw('Inspect {name}', { name: sw.name });
      // Normal mode paints exactly as before: --sw the sRGB hex fallback, --sw-real
      // the richest value the CSS layers on top. A vision preview replaces BOTH with
      // the simulated sRGB hex (the simulation is sRGB-only), so the rail shows the
      // palette as that vision type sees it - a diagnostic overlay, never a token edit.
      const fill = cvdMode === 'normal' ? sw.hex : simulatePalette(sw.hex, cvdMode, sev);
      const real = cvdMode === 'normal' ? sw.real : fill;
      return `<button type="button" class="lab-brand-sw"${oog ? ' data-oog="true"' : ''} data-lab-brand-pick="${escape(sw.pick)}"
        style="--sw:${escape(fill)};--sw-real:${escape(real)}" title="${escape(tip)}" aria-label="${escape(label)}">${badge}</button>`;
    }).join('');
  }

  /**
   * The APCA contrast matrix and, above it, the vision-preview segmented control.
   *
   * A diagnostic panel - it never writes a token. The grid is every axis colour as
   * TEXT over every axis colour as BACKGROUND, where the axis is [white, black, …the
   * brand palette]. APCA is polarity-dependent and asymmetric, so cell(row, col) is
   * `apcaContrast(text = row, bg = col)`: the diagonal (a colour on itself) reads ~0,
   * and cell(i,j) generally differs from cell(j,i). Each cell is painted in the
   * pairing's own colours - background the column colour, the |Lc| number in the row
   * colour - so the readability is legible at a glance as well as numerically.
   *
   * When a vision mode is active every axis colour is simulated FIRST and the whole
   * grid is rescored on the simulated colours - the point of the panel is to see how
   * the palette's contrasts survive that vision, not merely how it looks.
   *
   * Independent of the subject and the comparison target (APCA is sRGB-only), so it
   * is rebuilt only when the palette resolves or the vision mode/severity changes - 
   * never on a subject drag.
   */
  function renderCvdMatrix(): void {
    const mount = $('[data-lab-matrix]');
    if (!mount) return;
    const shown = brandSwatches.slice(0, MATRIX_MAX);
    const capped = brandSwatches.length > MATRIX_MAX;
    const sev = cvdSeverity / 100;
    // White and black first - the ceilings of what any colour can carry - then the
    // (capped) palette. Each axis entry keeps its NAME for the cell tooltips and its
    // SIMULATED paint for both the fill and the rescore.
    const axis = [
      { name: t('White'), hex: '#ffffff' },
      { name: t('Black'), hex: '#000000' },
      ...shown.map((s) => ({ name: s.name, hex: s.hex })),
    ].map((a) => ({ ...a, paint: simulatePalette(a.hex, cvdMode, sev) }));

    const grid = contrastMatrix(axis.map((a) => a.paint));
    const chip = (paint: string, name: string): string =>
      `<span class="lab-mx-chip" style="background:${escape(paint)}"></span><span class="lab-mx-name">${escape(name)}</span>`;
    const head = `<tr><th class="lab-mx-corner" scope="col"><span class="sr-only">${escape(t('Text over background'))}</span></th>`
      + axis.map((a) => `<th scope="col" class="lab-mx-h">${chip(a.paint, a.name)}</th>`).join('')
      + '</tr>';
    const body = axis.map((rowA, i) => {
      const cells = axis.map((colA, j) => {
        const cell = grid[i]![j]!;
        const lc = Math.round(Math.abs(cell.lc));
        const bandLabel = APCA_BANDS.find((b) => b.use === cell.band)?.label ?? cell.band;
        const tip = tRaw('{text} on {bg} · Lc {lc} · {use}', {
          text: rowA.name, bg: colA.name, lc: String(lc), use: t(bandLabel),
        });
        // Background is the COLUMN colour (the ground), the number the ROW colour (the
        // text) - the pairing painted as itself. `data-use` carries the APCA band for
        // the cue strip; the number is already integer, so it needs no escaping.
        return `<td class="lab-mx-cell" data-use="${escape(cell.band)}" title="${escape(tip)}"
          style="background:${escape(colA.paint)};color:${escape(rowA.paint)}">${lc}</td>`;
      }).join('');
      return `<tr><th scope="row" class="lab-mx-h">${chip(rowA.paint, rowA.name)}</th>${cells}</tr>`;
    }).join('');
    mount.innerHTML = `<table class="lab-mx-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;

    const note = $('[data-lab-matrix-note]');
    if (note) {
      note.hidden = !capped;
      note.textContent = capped
        ? tRaw('Showing the first {n} of {m} palette colours.', { n: String(MATRIX_MAX), m: String(brandSwatches.length) })
        : '';
    }
    if (capped && !cvdCapLogged) {
      cvdCapLogged = true;
      console.info(`[color-lab] contrast matrix capped to ${MATRIX_MAX} of ${brandSwatches.length} palette colours`);
    }
  }

  /**
   * Open the profile library.
   *
   * Every callback reports back honestly: `onActivate` returns whether the charts
   * actually moved, so a row whose bytes have gone since the list was read cannot
   * leave the panel reading pressed while the pill row says the profile is absent.
   */
  function openProfiles(): void {
    if (!host.assets) return;
    const h = host as ColorProfilesHost;
    void openProfilesPanel({
      host: h,
      active: activeProfile ? { digest: activeProfile.entry.digest, intent: activeProfile.intent } : null,
      absent: absentLimit != null,
      onActivate: async (digest, intent) => {
        const id = `icc:${digest}:${intent}`;
        const src = await adoptProfileLimit(id);
        // Pressing an intent is a choice of comparison target, so it moves the
        // charts as well as the tab - that is the whole reason the button is here.
        if (!src) return false;
        setLimit(src, id);
        remountPickers();
        return true;
      },
      onIngest: async (digest) => {
        // A dropped file only stocks the library - EXCEPT when it is the one a
        // link was waiting for, in which case the pill goes live where it stood.
        // Nothing else needs doing: the id in the URL already matches.
        const want = absentLimit ? parseProfileLimit(absentLimit) : null;
        if (!want || want.digest !== digest) return;
        const src = await adoptProfileLimit(absentLimit!);
        if (src) { setLimit(src, src.id); remountPickers(); }
      },
      onRemove: async (digest) => {
        const wasActive = activeProfile?.entry.digest === digest;
        await removeProfile(h, digest);
        if (wasActive) {
          activeProfile = null;
          setLimit(DEFAULT_LIMIT, null);
        }
        // Unconditionally: the tab is gone from the registry whether or not this
        // was the charted profile, and a field still showing it would resolve a
        // mode nothing answers for.
        remountPickers();
      },
    });
  }

  renderLimitSeg();
  // The flag can be on while the bundle is still loading (`jellyActive` is the
  // sync gate), in which case the row above rendered its plain buttons. Re-render
  // once the elements are defined, so the reader does not have to navigate away
  // and back to see the control they turned on.
  void ensureJelly().then(ok => { if (ok && limitSeg.isConnected) renderLimitSeg(); });

  const pickLimit = (next: string | undefined): void => {
    if (!next || next === gamutSourceId(limit)) return;
    if (activeProfile && next === activeProfile.src.id) setLimit(activeProfile.src, next);
    else if ((GAMUTS as readonly string[]).includes(next)) setLimit(next as Exclude<GamutName, 'none'>, next);
  };

  // Jelly's segmented control reports through `change`, not a click on a button - 
  // its segments are canvas-painted inside a shadow root, so the delegation below
  // never sees them.
  limitSeg.addEventListener('change', (e) => {
    if (!(e.target instanceof Element) || e.target.tagName !== 'JELLY-SEGMENTED') return;
    pickLimit((e as CustomEvent<{ value?: string }>).detail?.value);
  });

  limitSeg.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-lab-profiles]') || target.closest('[data-lab-limit-absent]')) {
      openProfiles();
      return;
    }
    pickLimit(target.closest<HTMLElement>('[data-val]')?.dataset.val);
  });

  // A display change (a window dragged to another monitor, or a surface refusing
  // the wide-gamut option) only REPAINTS: the encode space is part of the paint
  // key, and the "your display" contour is set during the paint. It must not move
  // the tab - the display changing is not the reader changing their comparison.
  // renderReadouts() too, so the preview swatch's HDR fill (paintSwatchHdr) and the
  // gamut readouts re-resolve for the new display, not just the charts. And the nits
  // control is shown or hidden to match: dragging a window onto an HDR panel gives it
  // headroom, dragging back off takes it away.
  cleanups.push(onDisplayGamutChange(() => { syncHdrVisibility(); paintCharts(); renderReadouts(); }));

  const boundsBox = $<HTMLInputElement>('[data-lab-bounds]');
  if (boundsBox) {
    const onBounds = (): void => {
      boundsOn = boundsBox.checked;
      // Turning it ON pulls the CURRENT colour in, rather than waiting for the next
      // drag - otherwise the report would sit out of bounds while claiming to hold them.
      if (boundsOn) setSubject(formatOklch(clampIntoGamut(desc.oklch, limit)));
      else paintSliders();
    };
    boundsBox.addEventListener('change', onBounds);
    cleanups.push(() => boundsBox.removeEventListener('change', onBounds));
  }

  // ── The headroom / nits axis + the SDR↔HDR preview (plan 154 WP-5) ─────────
  // A SEPARATE control from the lightness slider: it sets how far into the display's
  // peak the light end of each chart is exposed, not a lightness past 1.0. Shown only
  // where the panel has the headroom to answer it (`syncHdrVisibility`).
  syncHdrVisibility();
  /** Update the nits readout on the slider itself, live. The verdict card is refreshed
   *  by renderReadouts on commit; this is the cheap continuous echo. */
  const paintNitsOut = (): void => {
    const out = $('[data-lab-nits-slider] [data-gsl-val]');
    if (out) out.textContent = `${exposureNits}`;
  };
  const nitsBox = $('[data-lab-nits-slider]');
  if (nitsBox) {
    // The input's markup value is the default; a `&nits=` link may have moved the
    // state, so bring the thumb and readout to it before wiring.
    const nitsInput = nitsBox.querySelector<HTMLInputElement>('[data-gsl-input]');
    if (nitsInput) nitsInput.value = String(exposureNits);
    paintNitsOut();
    const clampNits = (v: number): number =>
      Math.max(NITS_MIN, Math.min(NITS_MAX, Math.round(v)));
    cleanups.push(wireGamutSlider(nitsBox, {
      // Continuous: move the exposure and repaint at draft quality (the SDR fill is
      // instant; the HDR overlay catches up on release, same as a colour drag).
      onInput: (v) => { exposureNits = clampNits(v); nitsPinned = true; paintNitsOut(); paintCharts('draft'); },
      onChange: (v) => {
        exposureNits = clampNits(v);
        nitsPinned = true;
        paintNitsOut();
        renderReadouts();   // the nits verdict card + the preview swatch follow
        paintCharts('full');
        syncUrl();
      },
    }));
  }
  const hdrSeg = $('[data-lab-hdr-ab]');
  if (hdrSeg) {
    const onHdrAb = (e: Event): void => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-val]');
      const next = btn?.dataset.val === 'sdr' ? false : btn?.dataset.val === 'hdr' ? true : undefined;
      if (next === undefined || next === hdrPreview) return;
      hdrPreview = next;
      hdrSeg.querySelectorAll<HTMLElement>('[data-val]')
        .forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      renderReadouts();   // the preview swatch drops or regains its HDR fill too
      paintCharts('full');
    };
    hdrSeg.addEventListener('click', onHdrAb);
    cleanups.push(() => hdrSeg.removeEventListener('click', onHdrAb));
  }

  // ── The 2D charts ────────────────────────────────────────────────────────
  /** Per-plane chart state, all three sliced through the subject. */
  const chartState = new Map<SlicePlane, SliceChartState>();
  const chartTeardowns: Array<() => void> = [];

  /**
   * The chroma ceiling for a CONTROL: {@link CONTROL_LIMIT}'s, stretched if the
   * subject is already past it.
   *
   * The stretch is what makes "never clamp" literal. A range input cannot hold a
   * value above its own `max`, so any ceiling that could sit below the subject is a
   * value-destroying ceiling - `?c=oklch(0.5 0.7 328)` from a link, or a typed 0.6,
   * has to remain expressible and draggable rather than being pulled back to 0.5.
   */
  const controlCMax = (): number => Math.max(chromaAxisMax(CONTROL_LIMIT), desc.oklch.c);

  function chartStateFor(plane: SlicePlane): SliceChartState {
    const st = chartState.get(plane)
      ?? { plane, fixed: 0 } as SliceChartState;
    // Every plane is sliced AT the subject, so the three of them are three
    // orthogonal cuts through one colour rather than three unrelated views.
    st.fixed = sliceFixedOf(plane, desc.oklch);
    st.limit = limit;
    // The chroma axis reaches exactly as far as this gamut does - 0.34 on sRGB,
    // 0.5 on Rec.2020 - so the envelope fills the plot instead of being squashed
    // into the lower half (sRGB) or clipped flat at the top (Rec.2020). Derived
    // from the LIMIT alone, never from the subject's lightness, so it cannot
    // rescale under the cursor mid-drag.
    st.cMax = chromaAxisMax(limit);
    chartState.set(plane, st);
    return st;
  }

  /** Free every chart's HDR GL context (Tier A). Called before a rebuild discards the
   *  `<canvas data-okls-hdr-gl>` nodes, and on view teardown - the WebGL2 context is only
   *  reclaimed on GC otherwise, so a rebuild-per-limit-change leaks one each time. */
  const releaseChartHdrContexts = (): void => {
    for (const plane of PLANES) {
      const gl = $(`[data-lab-chart="${plane}"]`)?.querySelector<HTMLCanvasElement>('[data-okls-hdr-gl]');
      if (gl) releaseHdrCanvas(gl);
    }
  };

  function buildCharts(): void {
    for (const fn of chartTeardowns.splice(0)) fn();
    releaseChartHdrContexts();   // free the outgoing charts' GL contexts before innerHTML drops them
    for (const plane of PLANES) {
      const mount = $(`[data-lab-chart="${plane}"]`);
      if (!mount) continue;
      const st = chartStateFor(plane);
      mount.innerHTML = renderSliceChart(st, [
        // `hex` paints the dot; `oklch` PLACES it. Placing from the hex - which is
        // gamut-mapped, chroma reduced - sat an out-of-sRGB marker exactly on the sRGB
        // contour on the two planes with a chroma axis, while L×H (whose axes both
        // survive the clamp) showed it outside and the 3D panel said "off the surface".
        { idx: 0, hex: desc.srgbHex, oklch: desc.oklch, label: t('This colour') },
      ], { editable: true });
      chartTeardowns.push(wireSliceChart(mount, {
        stateOf: () => chartStateFor(plane),
        hexOf: () => desc.srgbHex,
        // The AUTHORED colour, so the plane's fixed channel is held at the value the
        // report is describing rather than at its sRGB bake. Without this a drag past
        // a gamut boundary feeds the mapped colour back in every frame and the dot
        // shakes away from the pointer.
        oklchOf: () => desc.oklch,
        // Dragging the dot or clicking empty space both pick - on a report,
        // every chart is an input as well as a readout.
        // Dragging into a chart's P3 band should GIVE you that P3 colour, not its
        // sRGB bake - so this goes through setOklch like the sliders do.
        onRecolor: (_idx, o) => setOklch(o, { silent: true, live: true }),
        onCommit: () => {
          // The one full-fidelity pass per gesture: re-seed the picker, repaint
          // the charts sharp, and write the URL.
          reseedPicker();
          paintCharts('full');
          syncUrl();
          announce(tRaw('Colour set to {c}', { c: desc.srgbHex }));
        },
        onPick: () => {},
        onAdd: (seed) => setOklch(seed),
      }));
      const label = $(`[data-lab-slice-at="${plane}"]`);
      if (label) label.textContent = formatFixed(plane, st.fixed);

      // The slider drives the channel the PANEL is named for.
      const sliderMount = $(`[data-lab-slider="${plane}"]`);
      if (sliderMount) {
        const ch = PANEL_CHANNEL[plane];
        sliderMount.innerHTML = renderGamutSlider(plane, sliderState(ch), desc.oklch[ch]);
        chartTeardowns.push(wireGamutSlider(sliderMount, {
          // Continuous: move the colour and repaint at draft quality.
          onInput: (v) => setOklch({ ...desc.oklch, [ch]: v }, { silent: true, live: true }),
          onChange: (v) => {
            setOklch({ ...desc.oklch, [ch]: v });
            announce(tRaw('Colour set to {c}', { c: desc.srgbHex }));
          },
        }));
      }

      // Typed entry for the same channel. `change` rather than `input`, so a
      // half-typed number doesn't drag the whole report through nonsense values.
      const num = $<HTMLInputElement>(`[data-lab-num="${plane}"]`);
      if (num) {
        const ch2 = PANEL_CHANNEL[plane];
        // Scaled to CONTROL_LIMIT, not to the pressed tab: see controlCMax(). The
        // bounds are still re-derived on every build, because the subject may have
        // moved past them.
        const rNum = channelRange(ch2, controlCMax());
        num.min = String(rNum.min);
        num.max = String(rNum.max);
        const onNum = (): void => {
          const v = Number(num.value);
          if (!Number.isFinite(v)) return;
          const r = channelRange(ch2, controlCMax());
          // Lightness and hue have real ends (0–1, 0–360°). Chroma does not: its
          // ceiling is an axis choice, so a typed value above it is honoured and the
          // axis grows to hold it, rather than the number being taken off the user.
          const clamped = ch2 === 'c'
            ? Math.max(r.min, v)
            : Math.max(r.min, Math.min(r.max, v));
          setOklch({ ...desc.oklch, [ch2]: clamped });
        };
        num.addEventListener('change', onNum);
        chartTeardowns.push(() => num.removeEventListener('change', onNum));

        // Drag the number sideways to change it - the design-tool gesture, on the
        // shared primitive (lib/scrub.ts). Sensitivity is per channel because the
        // three axes are nothing like each other in scale: at the default 1/px,
        // chroma would cross its whole range inside a pixel. These give roughly a
        // full range per ~380px of travel, so a comfortable drag covers the axis and
        // Shift/Alt still coarsen and refine it.
        const SCRUB_PER_PX: Record<GamutChannel, number> = { l: 0.0025, c: 0.001, h: 1 };
        const DECIMALS: Record<GamutChannel, number> = { l: 4, c: 4, h: 2 };
        chartTeardowns.push(attachScrub(num, {
          selector: `[data-lab-num="${plane}"]`,
          min: rNum.min,
          max: rNum.max,
          unitPerPx: SCRUB_PER_PX[ch2],
          decimals: DECIMALS[ch2],
          touch: true,                  // paired with `touch-action: pan-y` in the CSS
          getFallback: () => desc.oklch[ch2],
          // Live while dragging, at draft quality - the same treatment a chart drag
          // and a slider drag get, so all three feel like one control surface.
          onDrag: (_el, v) => setOklch({ ...desc.oklch, [ch2]: v }, { silent: true, live: true }),
          onCommit: onNum,
        }));
      }
    }
  }

  /** Apply the bounds rule, if it is on. Off, the value passes through untouched - 
   *  the report then says where it landed rather than stopping it getting there. */
  const bounded = (o: { l: number; c: number; h: number }): { l: number; c: number; h: number } =>
    (boundsOn ? clampIntoGamut(o, limit) : o);

  /**
   * An OKLCH triple → the subject, as an `oklch()` STRING.
   *
   * Not via `oklchToHex`: that gamut-maps into sRGB, so handing it a wide-gamut
   * request quietly returns the sRGB bake - which made "bounds off" meaningless
   * (asking for chroma 0.34 came back as 0.2672, the sRGB ceiling) and is exactly
   * the silent collapse this whole view exists to avoid. The string keeps the
   * authored value; `describeColor` parses it back losslessly.
   */
  const setOklch = (o: { l: number; c: number; h: number }, opts?: { silent?: boolean; live?: boolean }): void =>
    setSubject(formatOklch(bounded(o)), opts);

  /** The slider's world: the other two channels held at the subject, tiered against
   *  the gamut the charts are drawn to - but scaled to controlCMax(), so pressing a
   *  narrower tab recolours the track without shortening it. */
  function sliderState(ch: GamutChannel) {
    // displayGamut lets a P3 screen paint its P3 segments opaque + in true colour
    // (see gamut-slider.ts); an sRGB screen keeps the honest wash. Repainted on a
    // display change via the onDisplayGamutChange hook below.
    return { channel: ch, base: desc.oklch, limit, cMax: controlCMax(), displayGamut: displayAnchorGamut() };
  }

  /** Repaint the broken tracks - their segments depend on the OTHER two channels,
   *  so every one of them changes whenever the colour does. */
  function paintSliders(): void {
    for (const plane of PLANES) {
      const ch = PANEL_CHANNEL[plane];
      const mount = $(`[data-lab-slider="${plane}"]`);
      if (mount) paintGamutSlider(mount, sliderState(ch), desc.oklch[ch]);
      const num = $<HTMLInputElement>(`[data-lab-num="${plane}"]`);
      // Keep the typed box's ceiling in step with the slider's, so a chroma the user
      // pushed past the axis is not reported as out of range by the box that accepted
      // it (and so the scrub gesture, which reads this attribute, can reach it).
      if (num) {
        const top = String(channelRange(ch, controlCMax()).max);
        if (num.max !== top) num.max = top;
      }
      // Never fight the user mid-type.
      if (num && document.activeElement !== num) {
        num.value = ch === 'h' ? desc.oklch.h.toFixed(2)
          : ch === 'l' ? desc.oklch.l.toFixed(4)
            : desc.oklch.c.toFixed(4);
      }
    }
  }

  /** The exposure the headroom axis is set to, as {@link HdrExposure}. Only
   *  `peakNits` moves for now (the floor, knees stay at hdr-image.ts's defaults);
   *  the rest are Andy's to tune on-device. Consumed by the charts' HDR overlay and
   *  the preview swatch, so the two cannot read different exposures. */
  const currentExposure = (): HdrExposure => ({ peakNits: exposureNits, sdrWhiteNits: NITS_SDR_WHITE });

  /**
   * The luminance THIS colour reaches once the headroom exposure lifts it, in nits.
   *
   * Mirrors hdr-image.ts's gate exactly (a Rec.709 luma on the LINEAR pixel drives a
   * smoothstep between the knees), so darks hold near SDR luminance and only the light
   * end rises toward the peak - and a readout here can never claim a lift the pixels
   * do not get. It is a readout OF the exposure, not a change to OKLab L: pure white
   * reaches the full peak, this colour reaches its own share of it.
   */
  function exposedNits(d: ColorDescription): number {
    const lin = convertColor(d.parsed, 'srgb-linear').components;
    const luma = Math.max(0, 0.2126 * (lin[0] ?? 0) + 0.7152 * (lin[1] ?? 0) + 0.0722 * (lin[2] ?? 0));
    const maxGain = Math.max(1, exposureNits / NITS_SDR_WHITE);
    // smoothstep across the default knees (kneeLo 0.5, kneeHi 1) - the same Hermite
    // ramp applyExposure uses, so the two agree at every luma.
    const edge = Math.max(0, Math.min(1, (luma - 0.5) / 0.5));
    const gate = edge * edge * (3 - 2 * edge);
    const gain = 1 + (maxGain - 1) * gate;
    return Math.round(luma * gain * NITS_SDR_WHITE);
  }

  /** Show the nits control only where the panel actually has headroom - on an SDR
   *  display a control that cannot do anything is worse than absent, so it is hidden
   *  and the readout card carries the one-line "no headroom" note instead (Tier C). */
  function syncHdrVisibility(): void {
    const panel = $('[data-lab-hdr]');
    if (panel) panel.hidden = !displaySupportsHdr();
  }

  function paintCharts(quality: 'full' | 'draft' = 'full'): void {
    // One exposure + one preview flag for the whole row, so the three charts cannot
    // disagree. On an SDR display `hdr`/`exp` are inert (paintSliceChart gates on
    // displaySupportsHdr()), so the fill stays byte-identical to today.
    const exp = currentExposure();
    const hdr = hdrPreview;
    for (const plane of PLANES) {
      const mount = $(`[data-lab-chart="${plane}"]`);
      if (!mount) continue;
      const st = chartStateFor(plane);
      paintSliceChart(mount, st, { quality, exp, hdr });
      updateSliceDot(mount, 0, desc.srgbHex, st, desc.oklch);
      const label = $(`[data-lab-slice-at="${plane}"]`);
      if (label) label.textContent = formatFixed(plane, st.fixed);
    }
    paintSliders();
  }

  // ── The 3D solid ─────────────────────────────────────────────────────────
  // `let`, because `acquire2d` replaces the node when the display's gamut changes
  // under us - a 2D context cannot change colour space after creation. Everything
  // that touches it must go through `adoptSolidCanvas`, or the turn gesture would
  // stay bound to a detached node and die silently.
  let solidCanvas = $<HTMLCanvasElement>('[data-lab-solid]');
  let solidFrame = 0;

  /**
   * The loaded image's colours, or null. When set, the solid stops being the
   * subject and becomes the reference frame it is drawn against.
   *
   * `screen` is the last painted projection of `cloud.points`, kept so a click
   * can be hit-tested without re-projecting - the paint has just done that work
   * for the exact view the reader is looking at, and re-deriving it at click time
   * is how a pick lands on a different point than the one under the cursor.
   */
  let cloud: (ImageCloud & { assumedSpace: boolean; sourceBits: number | null }) | null = null;
  let cloudScreen: { x: number; y: number; depth: number }[] = [];

  function solidFor(lim: GamutLimit): GamutSolid {
    // Keyed by `gamutSourceId` AND the embedding: a GamutSource stringifies to
    // '[object Object]', so two profiles would share one cache entry and the
    // second would silently show the first one's mesh - and two embeddings of one
    // gamut are two different meshes.
    const key = `${gamutSourceId(lim)}|${solidEmbed}`;
    let s = solidCache.get(key);
    // 'landscape': hue laid out flat, lightness in depth, chroma standing up.
    // The peaks and troughs per hue are then directly comparable - on a cylinder
    // half of them are round the back.
    // 192x80 ≈ 15k quads. The ridges are where the mesh shows, and they run along
    // hue, so hue gets the higher count. Built once per gamut and cached (~50ms),
    // then only projected + filled per frame.
    //
    // A profile-backed source gets a COARSER mesh (96x40, ~3.8k quads). Its
    // boundary comes from `maxChroma` bisections against a CLUT rather than a
    // matrix, so the full mesh is ~280ms - long enough that pressing the press
    // pill would look stuck. The press gamut's silhouette is smooth and its
    // ridges are shallower than a display gamut's, so the coarser mesh costs
    // little of what the picture is for.
    if (!s) {
      const fine = typeof lim === 'string';
      s = gamutSolid(lim, fine ? 192 : 96, fine ? 80 : 40, solidEmbed);
      solidCache.set(key, s);
    }
    return s;
  }

  /**
   * A COARSE mesh of a comparison gamut, stroked as a cage rather than filled.
   *
   * Not a second filled solid: two translucent surfaces over each other read
   * as one muddy shape and hide which is in front. A cage shows the same
   * thing the 2D charts already show with a hairline contour: where that
   * gamut stops.
   *
   * Coarse on purpose. The cage is a reference, not the subject. A dense
   * mesh would hide the surface it is drawn over.
   */
  function cageFor(lim: GamutLimit): GamutSolid {
    const key = `cage|${gamutSourceId(lim)}|${solidEmbed}`;
    let s = solidCache.get(key);
    if (!s) {
      // The two counts trade off differently per embedding, because only one of
      // them becomes the NUMBER of lines and the other becomes their smoothness.
      // Landscape draws one contour per lightness row (few, but each traced across
      // every hue); the closed embeddings draw one meridian per hue (few, each
      // traced up through every lightness). Using one pair of counts for both gives
      // either a coarse polygon or a thicket.
      s = solidEmbed === 'landscape' ? gamutSolid(lim, 64, 10, solidEmbed)
        : gamutSolid(lim, 16, 40, solidEmbed);
      solidCache.set(key, s);
    }
    return s;
  }

  function paintSolid(): void {
    if (!solidCanvas) return;
    const box = solidCanvas.getBoundingClientRect();
    if (box.width < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(box.width * dpr), h = Math.round(box.height * dpr);
    // Ask the platform for the widest surface it will give us, and let its ANSWER
    // decide how the fills are written - the same order the slice charts use, so
    // the context and the colours can never name different spaces. A browser that
    // refuses hands back 'srgb' and every fill below is today's rendering.
    const acquired = acquire2d(solidCanvas);
    if (!acquired) return;
    adoptSolidCanvas(acquired.canvas);
    const { ctx, encode } = acquired;
    if (solidCanvas.width !== w || solidCanvas.height !== h) {
      solidCanvas.width = w; solidCanvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);

    const solid = solidFor(limit);
    const fills = projectGamutSolid(solid, solidView);
    // The comparison cage - a reference gamut's surface as ribs over the fill.
    //
    // Only against a PROFILE limit, and that restriction is deliberate.
    // Between the three screen gamuts the nesting is already shown, better, by
    // the 2D contours and the tier ladder; tested by rendering it here, the
    // result was unreadable clutter over the surface it was meant to annotate.
    // A press gamut is the case no other panel can show: it is inside sRGB in
    // the cyans and OUTSIDE it in the yellows, so "which is bigger" has no
    // answer and the crossing itself is the information.
    //
    // Merged into ONE depth-sorted list rather than drawn as a layer on top: a rib
    // that is genuinely behind the surface has to be occluded by it, or the picture
    // claims the press gamut escapes sRGB everywhere instead of only where it does.
    const wires = typeof limit === 'string' ? [] : contourGamuts(limit)
      .flatMap(g => projectGamutSolid(cageFor(g), solidView).map(q => ({ ...q, wire: g })));
    const quads = wires.length
      ? [...fills.map(q => ({ ...q, wire: null as 'srgb' | 'p3' | null })), ...wires]
        .sort((a, b) => a.depth - b.depth)
      : fills.map(q => ({ ...q, wire: null as 'srgb' | 'p3' | null }));
    // Painter's algorithm, already sorted far-to-near by the engine.
    //
    // A quad is stroked in its own colour as well as filled, to close the hairline
    // antialiasing gap between abutting fills. Without the stroke, the mesh shows
    // visible gaps between tiles. But stroking doubles the path work, and on a
    // dense mesh each quad is only a few pixels across - the gaps are then
    // sub-pixel and the stroke buys nothing. So it is spent only where it shows.
    const areaPerQuad = (w * h) / Math.max(1, fills.length);
    const seal = areaPerQuad > 24; // ≈ 5px per side
    // With a cloud loaded the gamut stops being the subject and becomes the
    // frame the cloud is read against, so it is painted faint, as a reference
    // only. An opaque surface would hide every point inside it, which is most
    // of them - the interesting ones are near and past the boundary, and those
    // are exactly the ones you would still see. Dimming the surface rather
    // than making the POINTS translucent keeps each point's own colour true,
    // which is the one thing on this chart that must not be tinted by its
    // rendering.
    if (cloud) ctx.globalAlpha = 0.28;
    for (const q of quads) {
      const [p0, ...rest] = q.points;
      if (!p0) continue;
      ctx.beginPath();
      ctx.moveTo(p0.x * w, p0.y * h);
      for (const p of rest) ctx.lineTo(p.x * w, p.y * h);
      ctx.closePath();
      if (q.wire) {
        // RIBS, not a grid. A full lattice of both cages over a fine surface is
        // unreadable, confirmed by testing it: the Rec.2020 view with sRGB and
        // P3 inside it came out as clutter. One edge per quad, the one running
        // along lightness, leaves a set of hoops that read as a shape at a
        // glance while still being drawn strictly in depth order.
        //
        // White, the ink every gamut boundary is drawn in across this view; the
        // wider reference reads heavier, the same key the 2D legend already uses.
        ctx.beginPath();
        // Which edge to draw depends on the embedding. On the landscape, hue
        // runs across the picture and lightness runs into it, so the
        // hue-direction edge draws contour lines along the ridge. On the
        // closed embeddings the lightness-direction edge draws meridians,
        // which gives a turnable body its shape. The wrong edge for the
        // embedding produces hatching instead.
        const [a, b] = solidEmbed === 'landscape'
          ? [q.points[0], q.points[1]]
          : [q.points[1], q.points[2]];
        if (!a || !b) continue;
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
        ctx.strokeStyle = q.wire === 'p3' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)';
        ctx.lineWidth = (q.wire === 'p3' ? 1.1 : 0.9) * dpr;
        ctx.stroke();
        continue;
      }
      // From the patch's AUTHORED colour, not its sRGB bake: on a P3 surface the
      // bake is precisely the clamp this chart exists to draw the boundary of.
      const rgb = shadedFill(q.oklch, q.shade, encode);
      ctx.fillStyle = rgb;
      ctx.fill();
      if (seal) { ctx.strokeStyle = rgb; ctx.lineWidth = 1; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;

    paintCloud(ctx, w, h, solid, dpr);

    // "You are here". Drawn hollow when the subject is outside the solid being
    // shown, since a filled dot floating off the surface reads as a glitch.
    const m = projectSolidPoint(solid, desc.oklch, solidView);
    ctx.beginPath();
    ctx.arc(m.x * w, m.y * h, 6 * dpr, 0, Math.PI * 2);
    if (m.inside) {
      // Same reasoning as the quads, and it matters most here: the marker is the
      // subject itself, so filling it from `desc.srgbHex` would show a P3 colour
      // as its sRGB fallback on the one screen that did not need the fallback.
      ctx.fillStyle = shadedFill(desc.oklch, 1, encode);
      ctx.fill();
    }
    ctx.lineWidth = 2.5 * dpr;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.lineWidth = 1 * dpr;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.stroke();

    const note = $('[data-lab-solid-note]');
    if (note) {
      const base = m.inside
        ? tRaw('{deg}° · drag to turn', { deg: String(Math.round(((solidView.yaw % 360) + 360) % 360)) })
        : tRaw('Outside {g} - the marker sits off the surface', { g: limitTitle(limit) });
      // Unlabelled white lines over a coloured surface read as decoration. One
      // clause, only when they are actually drawn, naming them in the order they
      // are keyed everywhere else on the page.
      const refs = [...new Set(wires.map(q => q.wire))]
        .map(g => (g === 'p3' ? t('Display-P3') : t('sRGB')));
      note.textContent = refs.length
        ? `${base} · ${tRaw('white lines: {g}', { g: refs.join(' + ') })}`
        : base;
    }
  }

  /**
   * The image's colours as dots in the same space the solid is drawn in.
   *
   * Painted far-to-near so a near point covers a far one, the same painter's
   * order the mesh uses. Without it the cloud looks flat and the rotation no
   * longer shows depth.
   *
   * A dot's radius follows how much of the image it is, on a cube root: linear
   * area would make one dominant colour a disc that swallows the plot, and equal
   * radii would say a single stray pixel matters as much as the sky. The cube
   * root is the compromise that keeps a rare-but-vivid colour visible while still
   * ranking it below the mass.
   */
  function paintCloud(
    ctx: CanvasRenderingContext2D, w: number, h: number, solid: GamutSolid, dpr: number,
  ): void {
    cloudScreen = [];
    if (!cloud || !cloud.points.length) return;
    const pts = projectSolidPoints(solid, cloud.points, solidView);
    cloudScreen = pts;
    const order = pts.map((_, i) => i).sort((a, b) => pts[a]!.depth - pts[b]!.depth);
    const heaviest = cloud.points[0]?.n ?? 1;
    for (const i of order) {
      const p = pts[i]!, c = cloud.points[i]!;
      const r = (1.4 + 3.1 * Math.cbrt(c.n / heaviest)) * dpr;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
      // The point's own colour. It is a bake when the source was wider than the
      // surface, which is honest here for the same reason it is everywhere else on
      // this page: only a displayable colour can be painted, and the gamut shell
      // around the cloud is what says where the painting stopped being the truth.
      ctx.fillStyle = c.hex;
      ctx.fill();
    }
  }

  const scheduleSolid = (): void => {
    if (solidFrame) return;
    solidFrame = requestAnimationFrame(() => { solidFrame = 0; paintSolid(); });
  };
  cleanups.push(() => { if (solidFrame) cancelAnimationFrame(solidFrame); });

  // ── Vector (SVG) stills: a snapshot of the current solid, and a P3-vs-Rec.2020
  //    side-by-side comparison ────────────────────────────────────────────────
  //
  // The canvas above is the live turntable; these are STILLS, in vector. They
  // exist for two reasons. First, the house docs-are-vector rule: a screenshot
  // of the solid should be an SVG of real polygons, not a raster of a canvas.
  // Second, two screen gamuts cannot be shown clearly as overlapping wire
  // cages in the live view - see the clutter problem noted in `paintSolid`.
  // Drawn side by side at one shared angle and scale, the fact that
  // Display-P3 is NOT contained by Rec.2020 becomes visible as shape instead.
  //
  // Painted with `gamutSolidToSvg`'s default sRGB encode: a static SVG can only
  // show colours the viewer's browser can render, so it shows the hull's STRUCTURE
  // in sRGB rather than faking wide-gamut colour. The captions say so.
  const SNAP_SVG_SIZE = 480;

  /** One solid → a self-contained SVG string at the CURRENT orientation. Default
   *  (sRGB-safe) fills; the SAME `solidView` the canvas uses, so a still matches
   *  the turntable's angle exactly. */
  const svgForSolid = (solid: GamutSolid): string =>
    gamutSolidToSvg(projectGamutSolid(solid, solidView), { size: SNAP_SVG_SIZE });

  /**
   * A MODERATE mesh for a comparison gamut - coarser than the main canvas solid on
   * purpose. The compare panel is about silhouette, not surface detail, and a fine
   * mesh would inject tens of thousands of `<polygon>` nodes per hull. Cached by
   * source id + embedding, in the same map as the canvas meshes.
   */
  const compareSolidFor = (source: GamutSource): GamutSolid => {
    const key = `compare|${gamutSourceId(source)}|${solidEmbed}`;
    let s = solidCache.get(key);
    if (!s) { s = gamutSolid(source, 96, 40, solidEmbed); solidCache.set(key, s); }
    return s;
  };

  /** Repaint the single-solid still - only while its panel is open. `solidFor` is
   *  the SAME cached mesh the canvas draws, so the still is geometrically identical
   *  to the turntable, just frozen and in vector. */
  function renderSolidSvg(): void {
    const panel = $<HTMLDetailsElement>('[data-lab-solid-svg-panel]');
    const box = $('[data-lab-solid-svg]');
    if (!panel?.open || !box) return;
    box.innerHTML = svgForSolid(solidFor(limit));
  }

  /** Repaint the Display-P3 vs Rec.2020 comparison - only while its panel is open. */
  function renderCompare(): void {
    const panel = $<HTMLDetailsElement>('[data-lab-compare-panel]');
    const body = $('[data-lab-compare-body]');
    if (!panel?.open || !body) return;
    // ONE write, so the panel carries a single R10 sink. The SVG strings are
    // engine-produced (numeric polygons, no user text); the two labels are the
    // constant gamut titles, still routed through escape() per the house rule.
    const cell = (name: string, source: GamutSource): string =>
      '<figure class="lab-compare-cell">'
      + `<figcaption class="lab-compare-cap">${escape(name)}</figcaption>`
      + `<div class="lab-compare-svg" data-lab-compare-svg="${escape(gamutSourceId(source))}">`
      + `${svgForSolid(compareSolidFor(source))}</div></figure>`;
    body.innerHTML = cell(GAMUT_TITLE.p3, P3_SOURCE) + cell(GAMUT_TITLE.rec2020, REC2020_SOURCE);
  }

  /** rAF-throttled: rebuild whichever vector stills are open. Called on a turn
   *  commit, an embedding change and a target change - never per drag frame (these
   *  are stills, not a second live view), and a no-op when both panels are closed. */
  let vectorFrame = 0;
  function refreshVectors(): void {
    if (vectorFrame) return;
    vectorFrame = requestAnimationFrame(() => { vectorFrame = 0; renderSolidSvg(); renderCompare(); });
  }
  cleanups.push(() => { if (vectorFrame) cancelAnimationFrame(vectorFrame); });

  // Render each still the moment its panel opens (and rebuild on later opens, so it
  // reflects any turning done while it was closed).
  const solidSvgPanel = $<HTMLDetailsElement>('[data-lab-solid-svg-panel]');
  if (solidSvgPanel) {
    const onToggle = (): void => renderSolidSvg();
    solidSvgPanel.addEventListener('toggle', onToggle);
    cleanups.push(() => solidSvgPanel.removeEventListener('toggle', onToggle));
  }
  const comparePanel = $<HTMLDetailsElement>('[data-lab-compare-panel]');
  if (comparePanel) {
    const onToggle = (): void => renderCompare();
    comparePanel.addEventListener('toggle', onToggle);
    cleanups.push(() => comparePanel.removeEventListener('toggle', onToggle));
  }

  /**
   * Point the turn gesture at `next` when the canvas node has been swapped.
   *
   * A no-op in the common case (same node), so it is safe to call on every
   * frame. The swap happens only when the window moves to a monitor with a
   * different gamut, which is rare. But getting it wrong means the solid
   * silently stops turning, so this extra check is worth it.
   */
  function adoptSolidCanvas(next: HTMLCanvasElement): void {
    if (next === solidCanvas) return;
    unbindTurn?.();
    solidCanvas = next;
    unbindTurn = bindTurn(next);
  }

  let unbindTurn: (() => void) | null = null;

  /**
   * Adopt the cloud point nearest the press, if one is close enough.
   *
   * Nearest in SCREEN space using the projection the last paint produced, which
   * is the only definition that matches what the reader saw. Ties are broken by
   * depth, taking the NEARER point - two dots overlapping on screen are one in
   * front of the other, and the front one is the one that was pointed at.
   *
   * A miss does nothing at all. Snapping to the closest point however far away
   * would make an idle tap on empty space silently rewrite the subject.
   */
  function pickFromCloud(e: PointerEvent, el: HTMLCanvasElement): void {
    if (!cloud || !cloudScreen.length) return;
    const box = el.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) return;
    const px = (e.clientX - box.left) / box.width;
    const py = (e.clientY - box.top) / box.height;
    // In fractions of the box, so the tolerance scales with the figure rather
    // than being generous on a phone and mean on a large display.
    const slop = 0.035;
    let best = -1, bestD = slop * slop, bestDepth = -Infinity;
    for (let i = 0; i < cloudScreen.length; i++) {
      const p = cloudScreen[i]!;
      const d = (p.x - px) ** 2 + (p.y - py) ** 2;
      if (d > bestD) continue;
      if (d < bestD || p.depth > bestDepth) { best = i; bestD = d; bestDepth = p.depth; }
    }
    if (best < 0) return;
    const c = cloud.points[best]!;
    setSubject(formatOklch({ l: c.l, c: c.c, h: c.h }));
  }

  function bindTurn(el: HTMLCanvasElement): () => void {
    let dragging = -1;
    let lastX = 0, lastY = 0;
    /**
     * A TOUCH press that has not yet been resolved into a rotation.
     *
     * The canvas is `touch-action: pan-y` (see color-lab.css) so the page can still
     * be scrolled through it - it takes ~60% of a phone's viewport height, and under
     * the previous `touch-action: none` a vertical swipe anywhere on it moved
     * nothing whatsoever: the page was frozen and the solid does not turn on
     * vertical travel alone. Allowing the pan on its own is not enough either, or
     * the rotation would be gone - so the FIRST movement decides, the same axis lock
     * the 2D plots use (lib/oklch-slice.ts): mostly sideways is a turn and the
     * pointer is captured; mostly vertical is the page scrolling past and the
     * gesture is abandoned. A mouse or pen is exempt - a press with a button down is
     * unambiguous, and there is no page pan to protect.
     */
    let pending = false;
    let startX = 0, startY = 0;
    /** Past this much travel the direction is meant rather than jitter, in CSS px. */
    const AXIS_SLOP = 6;
    const beginTurn = (e: PointerEvent): void => {
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-turning');
    };
    const onDown = (e: PointerEvent): void => {
      dragging = e.pointerId;
      lastX = e.clientX; lastY = e.clientY;
      startX = e.clientX; startY = e.clientY;
      pending = e.pointerType === 'touch';
      if (pending) return;   // capturing now would claim a pan we may be handing back
      beginTurn(e);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent): void => {
      if (dragging !== e.pointerId) return;
      if (pending) {
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.hypot(dx, dy) < AXIS_SLOP) return;
        if (Math.abs(dy) >= Math.abs(dx)) { dragging = -1; pending = false; return; }
        pending = false;
        beginTurn(e);
        // From HERE, not from the press: the slop travel belongs to deciding what the
        // gesture was, and spending it as yaw makes the solid jump on first contact.
        lastX = e.clientX; lastY = e.clientY;
      }
      solidView.yaw += (e.clientX - lastX) * 0.5;
      // Pitch is clamped by the engine, but clamp here too so the gesture stops
      // accumulating invisible travel the user then has to undo.
      solidView.pitch = Math.max(-89, Math.min(89, solidView.pitch - (e.clientY - lastY) * 0.4));
      lastX = e.clientX; lastY = e.clientY;
      scheduleSolid();
    };
    const onUp = (e: PointerEvent): void => {
      if (dragging !== e.pointerId) return;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      dragging = -1;
      pending = false;
      el.classList.remove('is-turning');
      // A press that never became a turn is a PICK. Measured from the press, not
      // from a click event: the canvas captures the pointer as soon as a turn
      // starts, so a drag that ends over the canvas still fires `click`, and
      // hanging the pick on that would move the subject every time someone let go
      // of a rotation.
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < AXIS_SLOP) pickFromCloud(e, el);
      else refreshVectors();   // a turn ended - bring any open still up to the new angle
    };
    // Keyboard equivalent: a drag-only control is unusable without one.
    const onKey = (e: KeyboardEvent): void => {
      const step = e.shiftKey ? 15 : 5;
      if (e.key === 'ArrowLeft') solidView.yaw -= step;
      else if (e.key === 'ArrowRight') solidView.yaw += step;
      else if (e.key === 'ArrowUp') solidView.pitch = Math.min(89, solidView.pitch + step);
      else if (e.key === 'ArrowDown') solidView.pitch = Math.max(-89, solidView.pitch - step);
      else return;
      e.preventDefault();
      scheduleSolid();
      refreshVectors();   // keyboard turns are discrete - refresh the open stills
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('keydown', onKey);
    };
  }

  if (solidCanvas) unbindTurn = bindTurn(solidCanvas);
  cleanups.push(() => { unbindTurn?.(); unbindTurn = null; });

  // ── Pop a figure out ─────────────────────────────────────────────────────
  // Delegated at the charts container, so the three slice figures and the solid
  // share one handler and a figure added later needs no wiring.
  //
  // What pops out is the whole `<figure>`, not just its canvas: the solid's
  // embedding tabs, the image controls and each chart's slider are how you USE
  // the thing, and a popped-out plot without them is a picture rather than an
  // instrument.
  const chartsRoot = $('[data-lab-charts]');
  if (chartsRoot) {
    const openPanels = new Map<HTMLElement, { close(): void }>();
    const onPop = (e: Event): void => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-lab-pop]');
      if (!btn) return;
      const fig = btn.closest<HTMLElement>('figure');
      if (!fig) return;
      const existing = openPanels.get(fig);
      if (existing) { existing.close(); return; }
      const title = fig.querySelector('.lab-chart-title')?.textContent?.trim() ?? t('Chart');
      void import('../lib/float-panel.ts').then(({ popOut }) => {
        const panel = popOut(fig, {
          title,
          restoreLabel: t('Put back'),
          // INSIDE the view, not on the body. `$` here is `view.querySelector`, so
          // a figure parked on the body is invisible to every lookup this file
          // makes - measured: the popped chart's canvas stayed at its old backing
          // size through four resizes because `paintCharts` could no longer find
          // its mount. Verified there is no transform/filter/contain between `.lab`
          // and `<body>`, so `position: fixed` still floats it.
          mount: view,
          // Every canvas in this view sizes itself from `getBoundingClientRect`,
          // so a resize is only real once something repaints. Both are called
          // unconditionally - the charts' own paint no-ops when nothing changed
          // (see paintSliceChart's PAINTED key), and the solid's is rAF-gated.
          onResize: () => { paintCharts(); scheduleSolid(); },
          onClose: () => { openPanels.delete(fig); btn.setAttribute('aria-pressed', 'false'); },
        });
        if (!panel) return;
        openPanels.set(fig, panel);
        btn.setAttribute('aria-pressed', 'true');
      });
    };
    chartsRoot.addEventListener('click', onPop);
    cleanups.push(() => {
      chartsRoot.removeEventListener('click', onPop);
      // Leaving the view must take the panels with it - they are mounted at body
      // level, so the router replacing `#view` would otherwise leave them floating
      // over whatever comes next, holding a canvas nothing repaints.
      for (const p of openPanels.values()) p.close();
      openPanels.clear();
    });
  }

  // ── The image cloud ──────────────────────────────────────────────────────
  const cloudFig = solidCanvas?.closest<HTMLElement>('.lab-chart--solid') ?? null;
  const cloudFile = $<HTMLInputElement>('[data-lab-cloud-file]');
  const cloudClear = $<HTMLElement>('[data-lab-cloud-clear]');
  const cloudStats = $<HTMLElement>('[data-lab-cloud-stats]');

  function showCloudStats(name: string): void {
    if (!cloudStats) return;
    if (!cloud) { cloudStats.hidden = true; cloudStats.textContent = ''; return; }
    const pct = (v: number): string => `${(v * 100).toFixed(v >= 0.1 ? 0 : 1)}%`;
    const bits: string[] = [
      tRaw('{n} colours', { n: `${cloud.uniqueCapped ? '>' : ''}${cloud.unique.toLocaleString()}` }),
    ];
    // Only the gamuts that are actually reached. Listing "0% Rec.2020" on every
    // photograph is noise, and the absence is already told by the shell the cloud
    // sits inside.
    for (const [g, label] of [['p3', 'Display-P3'], ['rec2020', 'Rec.2020']] as const) {
      const share = cloud.coverage[g];
      if (share > 0.0005) bits.push(tRaw('{p} beyond sRGB, in {g}', { p: pct(share), g: t(label) }));
    }
    if (cloud.clipped > 0.01) bits.push(tRaw('{p} already clipped', { p: pct(cloud.clipped) }));
    if (cloud.dominantHue) bits.push(tRaw('mostly {h}°', { h: String(Math.round(cloud.dominantHue.h)) }));
    // Depth honesty, same class as the profile caveat below: the canvas read is
    // 8-bit, so a deeper source was flattened before any figure above was counted.
    if (cloud.sourceBits != null && cloud.sourceBits > 8) {
      bits.push(tRaw('{n}-bit source, read at 8-bit', { n: String(cloud.sourceBits) }));
    }
    // The honesty clause, and it goes LAST so it reads as a caveat on the numbers
    // rather than as the headline. An untagged file is sRGB by convention only,
    // and every figure above rests on that.
    bits.push(cloud.assumedSpace
      ? tRaw('no profile - read as {s}', { s: cloud.space === 'display-p3' ? t('Display-P3') : t('sRGB') })
      : tRaw('read as {s}', { s: cloud.space === 'display-p3' ? t('Display-P3') : t('sRGB') }));
    cloudStats.textContent = `${name} · ${bits.join(' · ')}`;
    cloudStats.hidden = false;
  }

  async function loadCloud(file: File): Promise<void> {
    try {
      // Only the DECODER is deferred: it reaches image-resize.ts, which pulls the
      // bitmap/codec machinery. `imageColorCloud` is pure maths already in the
      // engine barrel this view imports anyway.
      const { sampleImageFile } = await import('../lib/image-sample.ts');
      const img = await sampleImageFile(file);
      cloud = { ...imageColorCloud(img.data, img.width, img.height, { space: img.space }), assumedSpace: img.assumed, sourceBits: img.sourceBits };
      if (cloudClear) cloudClear.hidden = false;
      cloudFig?.classList.add('has-cloud');
      showCloudStats(file.name);
      paintSolid();
    } catch (err) {
      // A file that will not decode is the user's file being wrong, not the app
      // breaking - one line, no stack, and the previous cloud (if any) survives.
      showGamutToast(escape(t('That image could not be read.')));
      console.warn('lab: image cloud failed', err);
    }
  }

  if (cloudFile) {
    const onFile = (): void => {
      const f = cloudFile.files?.[0];
      // Cleared so re-choosing the SAME file fires `change` again - otherwise a
      // reader who cleared the plot cannot put the same image back.
      cloudFile.value = '';
      if (f) void loadCloud(f);
    };
    cloudFile.addEventListener('change', onFile);
    cleanups.push(() => cloudFile.removeEventListener('change', onFile));
  }
  if (cloudClear) {
    const onClear = (): void => {
      cloud = null;
      cloudScreen = [];
      cloudClear.hidden = true;
      cloudFig?.classList.remove('has-cloud');
      showCloudStats('');
      paintSolid();
    };
    cloudClear.addEventListener('click', onClear);
    cleanups.push(() => cloudClear.removeEventListener('click', onClear));
  }
  // Dropping onto the figure is the same act as choosing the file. The FIGURE is
  // the target, not a separate box: the plot is what you are dropping onto.
  if (cloudFig) {
    const over = (e: DragEvent): void => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      cloudFig.classList.add('is-drop');
    };
    const leave = (): void => cloudFig.classList.remove('is-drop');
    const drop = (e: DragEvent): void => {
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      e.preventDefault();
      leave();
      if (f.type.startsWith('image/')) void loadCloud(f);
    };
    cloudFig.addEventListener('dragover', over);
    cloudFig.addEventListener('dragleave', leave);
    cloudFig.addEventListener('drop', drop);
    cleanups.push(() => {
      cloudFig.removeEventListener('dragover', over);
      cloudFig.removeEventListener('dragleave', leave);
      cloudFig.removeEventListener('drop', drop);
    });
  }

  const embedSeg = $('[data-lab-embed]');
  if (embedSeg) {
    const onEmbed = (e: Event): void => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-val]');
      const next = btn?.dataset.val as SolidEmbed | undefined;
      if (!next || next === solidEmbed) return;
      solidEmbed = next;
      embedSeg.querySelectorAll<HTMLElement>('[data-val]')
        .forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      paintSolid();
      refreshVectors();   // the stills follow the embedding too
    };
    embedSeg.addEventListener('click', onEmbed);
    cleanups.push(() => embedSeg.removeEventListener('click', onEmbed));
  }

  // ── Vision preview (CVD / grayscale) ──────────────────────────────────────
  // Diagnostic only: it recolours the matrix and the brand rail and rescores the
  // grid, and writes nothing. A plain `.view-seg` like the embedding row above - 
  // no jelly, because the choice is not on a hot path.
  const cvdSeg = $('[data-lab-cvd]');
  const cvdSevRow = $('[data-lab-cvd-sev]');
  const cvdSevInput = $<HTMLInputElement>('[data-lab-cvd-sev-input]');
  const cvdSevOut = $('[data-lab-cvd-sev-out]');
  if (cvdSeg) {
    const onCvd = (e: Event): void => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-val]');
      const next = btn?.dataset.val as CvdMode | undefined;
      if (!next || next === cvdMode) return;
      cvdMode = next;
      cvdSeg.querySelectorAll<HTMLElement>('[data-val]')
        .forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      const graded = next === 'protan' || next === 'deutan' || next === 'tritan';
      if (cvdSevRow) cvdSevRow.hidden = !graded;
      renderCvdMatrix();
      renderBrand();
      announce(tRaw('Vision preview: {mode}', { mode: btn!.textContent?.trim() ?? next }));
    };
    cvdSeg.addEventListener('click', onCvd);
    cleanups.push(() => cvdSeg.removeEventListener('click', onCvd));
  }
  if (cvdSevInput) {
    const onSev = (): void => {
      cvdSeverity = Math.max(0, Math.min(100, Math.round(Number(cvdSevInput.value) || 0)));
      if (cvdSevOut) cvdSevOut.textContent = `${cvdSeverity}%`;
      renderCvdMatrix();
      renderBrand();
    };
    cvdSevInput.addEventListener('input', onSev);
    cleanups.push(() => cvdSevInput.removeEventListener('input', onSev));
  }

  // ── Ramps: tones, and a blend to a second colour ─────────────────────────
  const rampMount = $('[data-lab-ramp]');
  // The two ramps mean different things, so a click on them does different things.
  //
  //  · TONES are derived from the subject, so picking one is "move along my own
  //    ramp" - it re-seeds the report.
  //  · A BLEND stop is an output: an intermediate between this colour and another
  //    one you chose. You want to take it away and use it, not make it the new
  //    subject - doing that would also destroy the blend it came from, since the
  //    near end IS the subject.


  const stepsInput = $<HTMLInputElement>('[data-lab-steps]');
  if (stepsInput) {
    const onSteps = (): void => {
      steps = Math.max(2, Math.min(24, Math.round(Number(stepsInput.value) || 9)));
      const out = $('[data-lab-steps-out]');
      if (out) out.textContent = String(steps);
      renderRamp();
    };
    stepsInput.addEventListener('input', onSteps);
    cleanups.push(() => stepsInput.removeEventListener('input', onSteps));
  }

  // ── The blend's style, hue route, and stop count ─────────────────────────
  /**
   * Make a static `.view-seg` row selectable, and upgrade it to a Jelly control
   * where the flag is on - one selection API either way, so the caller never
   * learns which form it got.
   *
   * The row's own markup is the source of truth for the options: the upgrade
   * reads the buttons already there rather than taking a parallel list, so the
   * two forms cannot drift apart when a style is added.
   *
   * `tipFor` exists because of a real loss. The blend row's labels are one word
   * each (Smooth / Vivid / sRGB) and the reason to pick one lives in a `data-tip`
   * on each button - but a jelly segment is painted on canvas inside a shadow
   * root, so a per-segment tooltip has nowhere to hang. The rationale for the
   * SELECTED style moves onto the host instead: still discoverable by hover,
   * focus and touch, and it describes the choice that is actually in effect.
   */
  function wireSegRow(
    seg: HTMLElement,
    onPick: (val: string) => void,
    tipFor?: (val: string) => string,
  ): void {
    const select = (val: string | undefined): void => {
      if (!val) return;
      segPress(seg, val);
      segTip(seg, tipFor?.(val));
      onPick(val);
    };
    const onClick = (e: Event): void =>
      select((e.target as HTMLElement).closest<HTMLElement>('[data-val]')?.dataset.val);
    const onChange = (e: Event): void => {
      if (!(e.target instanceof Element) || e.target.tagName !== 'JELLY-SEGMENTED') return;
      select((e as CustomEvent<{ value?: string }>).detail?.value);
    };
    seg.addEventListener('click', onClick);
    seg.addEventListener('change', onChange);
    cleanups.push(() => {
      seg.removeEventListener('click', onClick);
      seg.removeEventListener('change', onChange);
    });

    const upgrade = (): void => {
      if (!jellyActive() || seg.querySelector('jelly-segmented')) return;
      const btns = [...seg.querySelectorAll<HTMLElement>('[data-val]')];
      if (!btns.length) return;
      const cur = btns.find(b => b.getAttribute('aria-pressed') === 'true')?.dataset.val
        ?? btns[0]!.dataset.val!;
      const segs = btns.map(b =>
        `<jelly-segment value="${escape(b.dataset.val!)}">${escape(b.textContent?.trim() ?? '')}</jelly-segment>`).join('');
      seg.innerHTML = `<jelly-segmented class="lab-limit-seg" value="${escape(cur)}"
        label="${escape(seg.getAttribute('aria-label') ?? '')}">${segs}</jelly-segmented>`;
      segTip(seg, tipFor?.(cur));
    };
    upgrade();
    // The flag can be on while the bundle is still loading (`jellyActive` is the
    // sync gate), so the row above may have stayed native. Upgrade once it lands,
    // rather than making the reader navigate away and back. A failed chunk load is
    // swallowed: the plain control is already on screen and works.
    void ensureJelly().then(ok => { if (ok && seg.isConnected) upgrade(); }).catch(() => {});
  }

  /** The selected option's rationale, on the jelly host. No-op on a native row,
   *  where each button still carries its own `data-tip`. */
  function segTip(seg: HTMLElement, tip: string | undefined): void {
    const j = seg.querySelector<HTMLElement>('jelly-segmented');
    if (!j) return;
    if (tip) j.dataset.tip = tip;
    else delete j.dataset.tip;
  }

  /** Move a row's selection, whichever form it is in. */
  function segPress(seg: HTMLElement, val: string): void {
    const j = seg.querySelector('jelly-segmented');
    if (j) {
      // Guarded: re-setting the attribute the control just reported would be a
      // second change event, and the pair would ping-pong.
      if (j.getAttribute('value') !== val) j.setAttribute('value', val);
      return;
    }
    seg.querySelectorAll<HTMLElement>('[data-val]')
      .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.val === val)));
  }

  const spaceSeg = $('[data-lab-blend-space]');
  const hueSeg = $('[data-lab-blend-hue]');
  /** Show the hue row only where hue travel is a real choice. */
  const syncHueRow = (): void => { if (hueSeg) hueSeg.hidden = !isPolarSpace(blendSpace); };
  if (spaceSeg) {
    wireSegRow(spaceSeg, (val) => {
      blendSpace = val as ColorSpaceTag;
      syncHueRow();
      renderBlend();
    }, (val) => t(BLEND_STYLES.find(b => b.space === val)?.why ?? ''));
  }
  if (hueSeg) {
    wireSegRow(hueSeg, (val) => { blendHue = val as HueDirection; renderBlend(); });
  }
  syncHueRow();

  const blendStepsBox = $('[data-lab-blend-steps]');
  if (blendStepsBox) {
    // The mixer slider's own input - the same `.gsl` markup the channel sliders use,
    // so it inherits their skin, but its axis is a count rather than a colour and it
    // has no gamut runs to break the rail into.
    const wired = wireGamutSlider(blendStepsBox, {
      onInput: (v) => {
        blendStops = Math.max(2, Math.min(24, Math.round(v)));
        renderBlend();
      },
      onChange: () => {},
    });
    cleanups.push(wired);
  }

  // Once, at mount: the readability cards are stable markup, so this picker is
  // never torn down and re-created by a re-score. (Hoisted declaration - the
  // function is defined further down with the rest of the render helpers.)
  mountInkPicker();

  /**
   * The blend target's picker - the SAME expanded picker as the subject's, with
   * tabs, dials and sliders.
   *
   * It used to be a compact `float` popover, on the idea that a secondary
   * control should carry less weight. But the dials are gated on `inline`
   * inside the component (colorModesHtml's third parameter is passed
   * `inline`), so a float popover can only offer the hex field, alpha and
   * swatches. You cannot pick a blend target perceptually, which is the
   * whole reason the dials exist. Hierarchy should come from placement and
   * heading, not from crippling the control.
   */
  function mountBlendPicker(): void {
    const blendPicker = $('[data-lab-blend-picker]');
    if (!blendPicker) return;
    mountColorField(blendPicker, 'lab-other', {
      value: describeColor(other)?.srgbHex ?? '#e0b64d',
      inline: true,
      modes: true,
      initialMode: 'oklch',
      onChange: (value) => { other = value; renderBlend(); },
    });
  }
  mountBlendPicker();

  /**
   * Re-generate every mounted colour field against the CURRENT space registry.
   *
   * A field bakes its whole tab strip at mount time (`colorModesHtml` reads
   * `colorSpaces()` once) and subscribes to nothing, so mounting or unmounting a
   * profile leaves any field that is not re-mounted holding a stale strip. Only
   * the subject picker used to be re-seeded: the blend and ink pickers never grew
   * the profile tab in-session - the same page showed two different tab rows
   * depending on whether the reader arrived by link or by drop - and after a
   * remove they kept a tab `getColorSpace` no longer resolves.
   *
   * Safe here and not from `renderContrast`: no drag can be in flight while the
   * profile panel is open, which is what made re-mounting the ink picker mid-score
   * destroy the slider under the pointer.
   */
  function remountPickers(): void {
    reseedPicker();
    mountBlendPicker();
    mountInkPicker();
  }
  const blendRaw = $<HTMLInputElement>('[data-lab-blend-raw]');
  if (blendRaw) {
    blendRaw.value = other;
    const onBlendRaw = (): void => {
      if (!describeColor(blendRaw.value)) { blendRaw.setAttribute('aria-invalid', 'true'); return; }
      blendRaw.removeAttribute('aria-invalid');
      other = blendRaw.value.trim();
      renderBlend();
    };
    blendRaw.addEventListener('change', onBlendRaw);
    blendRaw.addEventListener('keydown', (e) => { if (e.key === 'Enter') onBlendRaw(); });
    cleanups.push(() => blendRaw.removeEventListener('change', onBlendRaw));
  }

  // ── The one place the subject changes ────────────────────────────────────
  /**
   * Adopt a new subject and refresh every panel.
   *
   * `fromPicker` skips re-seeding the picker (it already holds the value, and
   * writing back mid-drag fights the user's slider). `silent` suppresses the
   * screen-reader announcement for continuous gestures - a chart drag would
   * otherwise announce on every frame.
   */
  function setSubject(
    next: string,
    opts: { fromPicker?: boolean; silent?: boolean; live?: boolean } = {},
  ): void {
    const parsed = describeColor(next);
    if (!parsed) return;
    subject = next.trim();
    desc = parsed;

    // Re-mounting the picker replaces its markup and re-wires it - far too heavy
    // to run on every frame of a chart drag, and most of what made dragging feel
    // laggy. Skip it while a gesture is live; catch up on release.
    if (!opts.fromPicker && !opts.live) reseedPicker();

    renderReadouts();
    // Draft quality during a gesture. Three engine slices per chart at full
    // resolution is ~50ms a frame across the three charts; at half resolution
    // it's about a quarter of that, and the sharp repaint lands on release.
    paintCharts(opts.live ? 'draft' : 'full');
    scheduleSolid();
    if (!opts.silent) announce(tRaw('{c} - {g}', { c: desc.srgbHex, g: GAMUT_TITLE[desc.gamut] }));
    if (!opts.live) syncUrl();
  }

  /** The picker's additive second onChange argument, read structurally: only `css`
   *  is wanted here, and only its presence distinguishes a picker that speaks the
   *  authored space from one that only has the sRGB bake. */
  type PickerDetail = { css?: string };

  /**
   * A pick from the colour field. Guarded three ways, because every one of them
   * catches a different echo of a value the picker was HANDED, and letting one
   * through replaces the authored colour with the picker's restatement of it:
   *
   *   - `seeding` - the emit that fires synchronously during wiring.
   *   - `seedBake` / `srgbHex` - an emit that arrives after the flag has cleared,
   *     recognised by its sRGB hex. Both, because the seed and the mapped fallback
   *     are the same string for an sRGB subject and different for a wider one.
   *   - `detail.css` vs `desc.input` - the same echo in the authored space, which
   *     is the only form that survives a picker holding a P3 or OKLCH value.
   *
   * Past those it is a real interaction, and `detail.css` is preferred over `value`
   * so a wide pick becomes the subject in the space it was made in rather than as
   * the sRGB approximation the emitted value has to be.
   */
  function onPickerChange(value: string, detail?: PickerDetail): void {
    if (seeding) return;
    const v = value.trim().toLowerCase();
    if (v === seedBake || v === desc.srgbHex.toLowerCase()) return;
    const css = detail?.css?.trim();
    if (css && css.toLowerCase() === desc.input.trim().toLowerCase()) return;
    setSubject(css || value, { fromPicker: true });
  }

  /** Rebuild the picker so it shows the current subject. */
  function reseedPicker(): void {
    seeding = true;
    const parsed = parseColor(desc.input);
    seedBake = (parsed ? colorToHexString(parsed) : desc.srgbHex).toLowerCase();
    mountColorField(pickerMount, 'lab-color', {
      // The AUTHORED string, not its sRGB restatement: the field keeps a value in the
      // space it arrives in, so a P3 or OKLCH subject reopens at its real chroma
      // instead of being flattened before the report describes it.
      value: desc.input,
      inline: true,   // the always-open editor form: rings + sliders shown
      modes: true,    // the tabbed multi-space picker
      initialMode: 'oklch', // the Lab reads in the perceptual space, whatever the everyday default
      // The cast bridges to the additive second onChange parameter; it can go once
      // ColorChangeDetail is part of MountColorFieldOpts' declared signature.
      onChange: onPickerChange as MountColorFieldOpts['onChange'],
    });
    seeding = false;
  }

  /** Keep the URL shareable, without a history entry per change.
   *
   *  `&limit=` rides along only once the target has been chosen: then the link
   *  reproduces the sender's comparison verbatim on any display, instead of the
   *  recipient's own screen re-deciding it. */
  function syncUrl(): void {
    const url = `#/lab?c=${encodeURIComponent(subject)}`
      + (limitPinned && limitParam ? `&limit=${encodeURIComponent(limitParam)}` : '')
      // The headroom axis rides along once it has been set, so an HDR-tuned link
      // reproduces the sender's exposure. Independent of the display: the value is
      // kept even where this screen has no headroom, so forwarding it stays honest.
      + (nitsPinned ? `&nits=${exposureNits}` : '');
    if (window.location.hash !== url) window.history.replaceState(null, '', url);
  }

  /** Everything that is text or a swatch, rebuilt from `desc`. */
  function renderReadouts(): void {
    paintSwatch(swatch, desc, currentExposure(), hdrPreview);
    // The swatch leads with the value in the space the PICKER is set to - OKLCH by
    // default - so the number on the swatch and the number under your hands are
    // the same number. The authored form is never lost: it stays in the entry
    // field, in the alternates below, and in the notation table.
    const mode = pickerMode();
    const leadSpace = pickerSpaceFor(mode);
    const lead = leadSpace ? desc.notations.find(n => n.space === leadSpace)?.css : null;
    const primary = $('[data-lab-sw-primary]');
    if (primary) {
      const shown = lead ?? desc.srgbHex.toUpperCase();
      primary.textContent = shown;
      // Click the value you can see and get exactly it.
      primary.dataset.labCopy = shown;
      // `data-tip` (styles/parts/tooltip.css), not `title`: this value looks like
      // text, nothing else says pressing it copies, and a `title` is invisible to
      // exactly the touch users who cannot hover to discover it. aria-label carries
      // the same sentence - the bubble is a pseudo-element and never read.
      // Focusable with a button role, which is what makes the bubble reachable at
      // all: the primitive opens on `:focus` where there is no hover, and a bare
      // <code> can take neither hover nor focus from a finger. The delegated keydown
      // below completes the bargain - announcing a button and then ignoring Enter
      // would be worse than the tooltip being hidden.
      primary.dataset.tip = tRaw('Copy {v}', { v: shown });
      primary.setAttribute('aria-label', tRaw('Copy {v}', { v: shown }));
      primary.setAttribute('role', 'button');
      primary.tabIndex = 0;
      primary.removeAttribute('title');
    }
    const swSpace = $('[data-lab-sw-space]');
    if (swSpace) {
      const shown = leadSpace ?? 'hex';
      // Name the space being shown AND the authored one when they differ, so the
      // swatch never quietly reads as if the colour were authored in this space.
      const from = desc.parsed.space !== shown ? ` · set in ${desc.parsed.space}` : '';
      swSpace.textContent = `${shown}${from} · ${GAMUT_TITLE[desc.gamut]}`;
    }

    // …then the handful of forms people actually reach for, so the common
    // translation is on the swatch and not only in the table further down. The
    // authored space is skipped, since it is already the line above.
    const alts = $('[data-lab-sw-alts]');
    if (alts) {
      const want: Array<[string, string]> = [];
      // The authored space first when the swatch is leading with a different one - 
      // it is the most relevant alternate, being what the user actually typed.
      const spaces = desc.parsed.space !== leadSpace
        ? [desc.parsed.space, ...SWATCH_ALT_SPACES]
        : [...SWATCH_ALT_SPACES];
      for (const space of spaces) {
        if (space === leadSpace || want.some(([s2]) => s2 === space)) continue;
        const n = desc.notations.find(x => x.space === space);
        if (n) want.push([space, n.css]);
      }
      // Hex last and always: sRGB-only, so it is the fallback expression rather
      // than a peer - but it is still the one most tools demand.
      if (leadSpace) want.push(['hex', desc.srgbHex.toUpperCase()]);
      // Same treatment as the primary value above, and for the same reason: a
      // `title` on a <code> is an affordance no touch or keyboard user can reach.
      alts.innerHTML = want.map(([space, css]) =>
        `<li class="lab-sw-alt"><span class="lab-sw-alt-space">${escape(space)}</span>`
        + `<code data-lab-copy="${escape(css)}" data-tip="${escape(tRaw('Copy {v}', { v: css }))}"`
        + ` role="button" tabindex="0" aria-label="${escape(tRaw('Copy {v}', { v: css }))}">${escape(css)}</code></li>`,
      ).join('');
    }

    if (desc.inSrgb) {
      announcedOut = false;
      hideGamutToast();
    } else if (!announcedOut) {
      announcedOut = true;
      showGamutToast(t(
        'Outside sRGB. The swatches on this page ask your browser for the real colour, so a wide-gamut display shows it and a narrower one falls back to <strong>{hex}</strong>. The charts are drawn in your display’s own space, so they reach exactly as far as it does.',
        { hex: desc.srgbHex.toUpperCase() },
      ));
    }

    // Gamut verdict.
    const g = $('[data-lab-gamut]')!;
    g.dataset.gamut = desc.gamut;
    g.querySelector('[data-lab-gamut-name]')!.textContent = GAMUT_TITLE[desc.gamut];
    g.querySelector('[data-lab-gamut-blurb]')!.textContent = GAMUT_BLURB[desc.gamut];

    // Headroom + per-gamut ceilings.
    const head = $('[data-lab-headroom]')!;
    const over = desc.headroom < 0;
    head.dataset.state = over ? 'over' : 'under';
    head.querySelector('[data-lab-headroom-val]')!.textContent =
      `${over ? '' : '+'}${desc.headroom.toFixed(3)}`;
    head.querySelector('[data-lab-headroom-note]')!.textContent = over
      ? tRaw('beyond sRGB’s ceiling of {max} at this lightness and hue - reach a wider gamut to keep it', { max: desc.ceiling.srgb.toFixed(3) })
      : tRaw('of chroma still available within sRGB at this lightness and hue (ceiling {max})', { max: desc.ceiling.srgb.toFixed(3) });

    const ceils = $('[data-lab-ceilings]')!;
    // A ceiling row per comparison target - the three display gamuts, and the
    // mounted press profile when there is one. Its gain is frequently NEGATIVE
    // against sRGB, which is the point of showing it, so the sign is explicit
    // rather than a hard-coded '+'.
    const rows: Array<{ name: string; c: number }> = GAMUTS.map(g => ({
      name: GAMUT_TITLE[g], c: desc.ceiling[g],
    }));
    if (activeProfile) {
      rows.push({
        name: limitTitle(activeProfile.src),
        c: maxChroma(desc.oklch.l, desc.oklch.h, activeProfile.src),
      });
    }
    ceils.innerHTML = rows.map(({ name, c }, i) => {
      const pct = Math.round((c / (desc.ceiling.srgb || 1) - 1) * 100);
      const gain = i === 0 ? '' :
        ` <span class="lab-ceil-gain">${pct >= 0 ? '+' : '−'}${Math.abs(pct)}%</span>`;
      const reached = desc.oklch.c <= c;
      return `<li class="lab-ceil${reached ? '' : ' is-past'}">
        <span class="lab-ceil-name">${escape(name)}</span>
        <span class="lab-ceil-val">${c.toFixed(3)}${gain}</span>
      </li>`;
    }).join('');

    // Headroom / nits axis (plan 154 WP-5). A SEPARATE readout from chroma headroom:
    // how bright this colour's light gets on the display's luminance axis once the
    // exposure lifts it. Nits, not lightness - OKLab L above is untouched.
    const nitsCard = $('[data-lab-nits]');
    if (nitsCard) {
      const hasHeadroom = displaySupportsHdr();
      const valEl = nitsCard.querySelector('[data-lab-nits-val]')!;
      const noteEl = nitsCard.querySelector('[data-lab-nits-note]')!;
      if (!hasHeadroom) {
        // Tier C: nothing above SDR white to show, so the axis is inert on this screen.
        nitsCard.dataset.state = 'sdr';
        valEl.textContent = t('SDR only');
        noteEl.textContent = t('This screen reports no HDR headroom, so there is nothing above SDR white to show. On an HDR display the light end of each chart would glow.');
      } else if (!hdrPreview) {
        nitsCard.dataset.state = 'sdr-preview';
        valEl.textContent = t('SDR preview');
        noteEl.textContent = t('The A/B toggle is holding the charts at SDR. Flip it back to HDR to see the boost.');
      } else {
        nitsCard.dataset.state = 'hdr';
        valEl.textContent = tRaw('{n} nits', { n: String(exposedNits(desc)) });
        noteEl.textContent = tRaw('where this colour’s light lands, of a {peak}-nit ceiling. Pure white reaches the ceiling; darks hold at SDR luminance.', { peak: String(exposureNits) });
      }
    }

    renderPress();
    renderContrast();
    renderNotations();
    renderRamp();
  }

  function renderContrast(): void {
    const v = contrastVsExtremes(subject);
    if (!v) return;
    // Scored on `srgbHex`, not on the authored value: APCA is fitted to sRGB
    // (APCA_SRGB_ONLY), and it keeps the Lc and the ratio describing one colour.
    scoreCard('white', '#ffffff', v.onWhite, v.against === '#ffffff');
    scoreCard('black', '#000000', v.onBlack, v.against === '#000000');
    scoreCard('ink', ink, contrastRatio(desc.srgbHex, ink), false);

    // The cards carry the authored colour as their background, with the hex as a
    // CSS fallback for displays that can't reach it.
    for (const el of view.querySelectorAll<HTMLElement>('.lab-contrast-card')) {
      el.style.background = desc.srgbHex;
      el.style.background = subject;
    }

    const floor = $('[data-lab-contrast-note]');
    if (floor) {
      // APCA leads. The pairing named is the one APCA prefers, which is NOT always
      // the one WCAG prefers - that disagreement is the whole reason both are here,
      // so when they part company the line says so instead of quietly picking one.
      const white = apcaVerdict('#ffffff', desc.srgbHex);
      const black = apcaVerdict('#000000', desc.srgbHex);
      const apcaWinner = (white && black && white.abs >= black.abs) ? 'white' : 'black';
      const wcagWinner = v.against === '#ffffff' ? 'white' : 'black';
      const best = apcaWinner === 'white' ? white : black;
      floor.textContent = best
        ? tRaw('Best pairing: {ink} at Lc {lc} - {use}. WCAG says {ratio}:1, {level} for body text.', {
          ink: t(apcaWinner),
          lc: best.abs.toFixed(1),
          use: t(best.label),
          ratio: v.ratio.toFixed(2),
          level: v.level === 'fail' ? t('below AA') : v.level,
        }) + (apcaWinner === wcagWinner ? ''
          : ` ${tRaw('The two disagree here - WCAG prefers {other}.', { other: t(wcagWinner) })}`)
        : '';
    }
  }

  /**
   * Fill one card's numbers, in place. APCA first, WCAG second.
   *
   * That order is deliberate and it is the opposite of how most tools present it.
   * APCA models polarity - light text on dark reads worse than the same pair
   * inverted, which WCAG 2's ratio cannot express at all, since it scores both
   * directions identically. So the Lc is the number to design against and the ratio
   * is the number to report to a conformance checklist. Both are shown because both
   * are true; the size tells you which to trust.
   */
  function scoreCard(key: string, textColor: string, ratio: number, best: boolean): void {
    const card = $(`[data-lab-card="${key}"]`);
    if (!card) return;
    card.style.color = textColor;
    card.classList.toggle('is-best', best);
    const bestTag = card.querySelector<HTMLElement>('[data-lab-card-best]');
    if (bestTag) bestTag.hidden = !best;

    const apca = apcaVerdict(textColor, desc.srgbHex);
    const apcaRow = card.querySelector<HTMLElement>('[data-lab-apca]');
    if (apcaRow) {
      apcaRow.hidden = !apca;
      if (apca) apcaRow.dataset.use = apca.use;
      const lc = card.querySelector<HTMLElement>('[data-lab-apca-lc]');
      if (lc) lc.textContent = apca ? `${t('Lc')} ${apca.abs.toFixed(1)}` : '';
      const use = card.querySelector<HTMLElement>('[data-lab-apca-use]');
      if (use) use.textContent = apca ? t(apca.label) : '';
      const pol = card.querySelector<HTMLElement>('[data-lab-apca-pol]');
      if (pol) {
        // Shown only when the text is LIGHTER than its ground - precisely the case
        // WCAG's ratio cannot see.
        pol.hidden = !apca?.reversed;
        pol.textContent = t('light on dark');
        pol.title = t('Light text on a dark background - APCA scores this polarity differently, WCAG cannot tell.');
      }
    }

    const out = card.querySelector<HTMLElement>('[data-lab-ratio]');
    if (out) out.textContent = `${ratio.toFixed(2)}:1`;
    const badges = card.querySelector<HTMLElement>('[data-lab-badges]');
    if (badges) {
      const badge = (name: string, level: string): string =>
        `<span class="lab-wcag" data-level="${escape(level)}">${escape(name)} ${escape(level === 'fail' ? '✗' : level)}</span>`;
      badges.innerHTML = `${badge(t('Body'), wcagLevel(ratio))} ${badge(t('Large'), wcagLevel(ratio, { large: true }))}`;
    }
  }

  /**
   * The third surface's picker - the compact `float` popover, which is what a
   * secondary control on a card wants: the card is already carrying two numbers,
   * and the expanded form's rings would dominate it.
   *
   * Never re-mounted from `renderContrast`, which is what used to destroy it: its
   * own first `onChange` re-ran the score, the slider under the pointer disappeared
   * and the drag died with it. A re-score only writes text into the card around it.
   * `remountPickers` is the one other caller, and it runs from the profile panel
   * where no drag can be in flight.
   */
  function mountInkPicker(): void {
    const host = $('[data-lab-ink-pick]');
    if (!host) return;
    mountColorField(host, 'lab-ink', {
      value: ink,
      float: true,
      modes: true,
      initialMode: 'oklch',
      onChange: (value) => {
        if (!describeColor(value)) return;
        ink = value;
        renderContrast();
      },
    });
  }

  /**
   * The press card: what this colour costs on the mounted profile.
   *
   * Rendered only while a profile is active, and every number in it is
   * MEASURED - it comes from that file's own tables under the named intent.
   * Nothing derived and nothing approximate appears here, which is what lets the
   * card carry the profile's own name as its claim.
   *
   * `Shift` is the round-trip ΔE the membership threshold is applied to. Showing
   * it turns {@link ICC_GAMUT_DELTA_E} from a hidden rule into a readable
   * quantity: at 0.4 the colour is solidly inside, at 2.8 it "passes" and will
   * visibly move. No traffic lights - the number is the finding.
   *
   * It is ABSENT, with the card's tolerance note, for a matrix/TRC or gray
   * profile. `iccGamutSource` decides those on their device cube instead, so the
   * round trip is near zero well outside the gamut - printing it would put
   * "Outside the gamut / Shift ΔE 0.1" directly above a sentence saying ΔE 3.0
   * decides, which is a rule the card visibly breaks. Any RGB or gray display
   * profile is this case, and they mount like any other.
   *
   * `Ink` is total area coverage in the trade's own units (channels × 100, so
   * 0–400%), never normalised, and the row is ABSENT rather than zeroed for a
   * profile that has no ink - every RGB and display profile. There is no ink
   * LIMIT control: a press's limit is the pressroom's number, not the profile's,
   * and a control for it here would be either a policing device or a decoration.
   */
  function renderPress(): void {
    const card = $('[data-lab-press]');
    if (!card) return;
    const ap = activeProfile;
    card.hidden = !ap;
    if (!ap) return;
    const { l, c, h } = desc.oklch;
    const fits = inGamut(l, c, h, ap.src);
    const shift = ap.roundTripDecides ? iccRoundTripDeltaE(ap.profile, ap.intent, l, c, h) : null;
    const ink = ap.src.inkCoverage?.(l, c, h) ?? null;

    card.dataset.state = fits ? 'in' : 'out';
    const note = card.querySelector<HTMLElement>('[data-lab-press-note]');
    if (note) note.hidden = !ap.roundTripDecides;
    card.querySelector('[data-lab-press-name]')!.textContent = limitTitle(ap.src);
    card.querySelector('[data-lab-press-verdict]')!.textContent =
      fits ? t('Reproducible') : t('Outside the gamut');

    const rows: string[] = [];
    const row = (label: string, value: string, chip = ''): string =>
      `<li class="lab-press-row"><span class="lab-press-k">${escape(label)}</span>`
      + `<span class="lab-press-v">${escape(value)}${chip}</span></li>`;
    if (shift != null) rows.push(row(t('Shift'), `ΔE ${shift.toFixed(1)}`));
    if (ink != null) rows.push(row(t('Ink'), `${Math.round(ink * 100)}%`));
    if (ap.paper) {
      // Painted as CSS lab(), which is the space the number is IN - no hop
      // through a hex, so a paper whiter or warmer than sRGB's white shows as
      // itself wherever the display can reach it.
      const [pl, pa, pb] = ap.paper;
      const chip = ` <span class="lab-press-chip" style="background:lab(${pl.toFixed(2)} ${pa.toFixed(2)} ${pb.toFixed(2)})"></span>`;
      rows.push(row(t('Paper'), `L* ${pl.toFixed(1)}`, chip));
    }
    card.querySelector('[data-lab-press-rows]')!.innerHTML = rows.join('');
  }

  function renderNotations(): void {
    const mount = $('[data-lab-notations]');
    if (!mount) return;
    const rows = desc.notations.map(n => `
      <tr${n.exact ? '' : ' class="is-inexact"'}>
        <th scope="row">${escape(n.space)}</th>
        <td><code>${escape(n.css)}</code></td>
        ${/* The marker's explanation IS its content - "clamped" alone means nothing - 
              so it goes on `data-tip` rather than `title`, which no phone can open. */''}
        <td class="lab-note-fit">${n.exact ? '' : `<span data-tip="${escape(t('This space cannot hold the colour - CSS would clamp these numbers.'))}" tabindex="0">${escape(t('clamped'))}</span>`}</td>
        <td><button type="button" class="lab-copy" data-lab-copy="${escape(n.css)}">${escape(t('Copy'))}</button></td>
      </tr>`);
    // …then the press, after the CSS spaces. The ONLY CMYK numbers this table
    // ever prints are profile-backed: `describeColor` is untouched and no generic
    // CMYK row is added, because four numbers with no profile behind them describe
    // no press that exists.
    const press = pressNotation();
    if (press) rows.push(press);
    mount.innerHTML = rows.join('');
  }

  /** The mounted profile's device numbers for this colour, as a table row. */
  function pressNotation(): string | null {
    const ap = activeProfile;
    if (!ap) return null;
    const parsed = parseColor(subject);
    if (!parsed) return null;
    const lab = convertColor(parsed, 'lab').components as [number, number, number];
    const dev = ap.profile.fromLab(ap.intent, lab);
    if (!dev) return null;
    // Four inks in a CMYK space get the trade's own notation; any other channel
    // count gets `device(...)` rather than a syntax invented for the occasion.
    const four = dev.length === 4 && ap.entry.colourSpace.toUpperCase() === 'CMYK';
    const css = four
      ? `cmyk(${dev.map(v => `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`).join(' ')})`
      : `device(${dev.map(v => v.toFixed(2)).join(' ')})`;
    const fits = inGamut(desc.oklch.l, desc.oklch.c, desc.oklch.h, ap.src);
    // The ΔE wording only where the ΔE is what decided it (see renderPress): a
    // matrix/TRC profile is refused by its device cube, and "round-trips 0.0 ΔE
    // away - past the 3.0 tolerance" is a sentence that refutes itself.
    const shift = ap.roundTripDecides
      ? iccRoundTripDeltaE(ap.profile, ap.intent, desc.oklch.l, desc.oklch.c, desc.oklch.h)
      : null;
    const fit = fits ? '' : `<span tabindex="0" data-tip="${escape(shift != null
      ? tRaw('Round-trips {de} ΔE away - past the {tol} tolerance.', { de: shift.toFixed(1), tol: ICC_GAMUT_DELTA_E.toFixed(1) })
      : t('Outside this profile’s gamut.'))}">${escape(t('outside'))}</span>`;
    return `
      <tr${fits ? '' : ' class="is-inexact"'}>
        <th scope="row">${escape(limitTitle(ap.src))}</th>
        <td><code>${escape(css)}</code></td>
        <td class="lab-note-fit">${fit}</td>
        <td><button type="button" class="lab-copy" data-lab-copy="${escape(css)}">${escape(t('Copy'))}</button></td>
      </tr>`;
  }

  /**
   * One clickable ramp step. Every step is also a way to SET the colour.
   *
   * Labelled in OKLCH, with the hex demoted to the second line. Hex is sRGB-only,
   * which makes it the weakest expression of a colour on a page about colour
   * spaces - useful to have, wrong to lead with. The step's own OKLCH says what it
   * IS; the hex is what you paste into something that can't take better.
   */
  function stepHtml(hex: string, action: 'use' | 'copy' = 'use'): string {
    const o = describeColor(hex)?.oklch;
    // The shared inversion rule (contrastText), so a ramp step's label flips at the
  // same lightness as the picker's dial disc and the value pill.
  const ink = contrastText(hex);
    const label = o
      ? `${Math.round(o.l * 100)}% ${o.c.toFixed(3)} ${Math.round(o.h)}`
      : hex.toUpperCase();
    const oklchStr = o ? formatOklch(o) : hex;
    const aria = action === 'copy'
      ? tRaw('Copy {v}', { v: oklchStr })
      : tRaw('Use oklch({v})', { v: label });
    // Each line carries its OWN value to copy, so the notation you click is the
    // notation you get.
    return `<button type="button" class="lab-step" data-lab-step="${escape(hex)}"
      style="background:${escape(hex)};color:${escape(ink)}"
      aria-label="${escape(aria)}">
      <span class="lab-step-oklch" data-lab-copy="${escape(oklchStr)}"
        title="${escape(tRaw('Copy {v}', { v: oklchStr }))}">${escape(label)}</span>
      <span class="lab-step-hex" data-lab-copy="${escape(hex.toUpperCase())}"
        title="${escape(tRaw('Copy {v}', { v: hex.toUpperCase() }))}">${escape(hex.toUpperCase())}</span>
    </button>`;
  }

  function renderRamp(): void {
    if (rampMount) {
      const o = desc.oklch;
      // Through the colour's own hue, from near-white to near-black. The chroma is
      // pulled in at the pale end and pushed out at the dark end because that is
      // what keeps a tint ramp from looking chalky at the top and muddy at the
      // bottom; `correctLightness` then evens the perceptual spacing.
      const tones = rampOklab(
        [oklchToHex({ l: 0.97, c: o.c * 0.22, h: o.h }), desc.srgbHex, oklchToHex({ l: 0.13, c: o.c * 0.5, h: o.h })],
        steps, { correctLightness: true },
      );
      rampMount.innerHTML = tones.map(hex => stepHtml(hex)).join('');
      // The rail: the same three anchors as one continuous CSS gradient, in OKLab
      // (which is what rampOklab interpolates in), so the bar above the swatches is
      // the ramp they were cut from rather than a decorative approximation.
      const rail = $('[data-lab-tone-steps] [data-gsl-track]');
      if (rail) {
        const [pale, dark] = [
          oklchToHex({ l: 0.97, c: o.c * 0.22, h: o.h }),
          oklchToHex({ l: 0.13, c: o.c * 0.5, h: o.h }),
        ];
        rail.innerHTML = `<span class="gsl-seg" style="left:0;width:100%;background:`
          + `linear-gradient(90deg in oklab, ${escape(pale)}, ${escape(subject)}, ${escape(dark)})"></span>`;
      }
      const out = $('[data-lab-tone-steps] [data-gsl-val]');
      if (out) out.textContent = String(steps);
    }
    renderBlend();
  }

  /**
   * The blend ramp, its continuous rail, and the stop count's readout.
   *
   * Cut with the engine's `interpolateColor` rather than `rampOklab`, because the
   * space is the user's choice here and `rampOklab` is - by name and by contract - 
   * OKLab only. It is also the same primitive the canvas gradient panel and the
   * gradient spec bake through, so a blend previewed here and a gradient authored
   * on canvas with the same style agree stop for stop.
   */
  function renderBlend(): void {
    const blendMount = $('[data-lab-blend]');
    if (!blendMount) return;
    const far = describeColor(other);
    const a = parseColor(subject);
    const b = far ? parseColor(other) : null;
    const mix = { space: blendSpace, hue: blendHue };
    const blend: string[] = [];
    if (a && b) {
      for (let i = 0; i < blendStops; i++) {
        // The ends are exact: t hits 0 and 1, so the first and last stop ARE the two
        // colours rather than something a hair inside them.
        const k = blendStops === 1 ? 0 : i / (blendStops - 1);
        blend.push(colorToHexString(interpolateColor(a, b, k, mix)));
      }
    }
    blendMount.innerHTML = blend.map(hex => stepHtml(hex, 'copy')).join('');

    // The rail: one continuous CSS gradient in the same space, so the slider shows
    // what the stops are sampling. Painted from the AUTHORED values, not their
    // sRGB hexes, so a wide-gamut end stays wide on a display that can show it.
    const railBox = $('[data-lab-blend-steps]');
    const track = railBox?.querySelector<HTMLElement>('[data-gsl-track]');
    if (track) {
      track.innerHTML = far
        ? `<span class="gsl-seg" style="left:0;width:100%;background:linear-gradient(90deg `
          + `${cssInterpolation(blendSpace, blendHue)}, ${escape(subject)}, ${escape(other)})"></span>`
        : '';
    }
    const out = railBox?.querySelector<HTMLElement>('[data-gsl-val]');
    if (out) out.textContent = String(blendStops);
  }

  /** A hex's oklch() form - what a step's body copies, matching its visible label. */
  const oklchStringFor = (hex: string): string => {
    const o = describeColor(hex)?.oklch;
    return o ? formatOklch(o) : hex;
  };

  /** Put a value on the clipboard and confirm it on the element that was clicked. */
  function copyValue(value: string, on: HTMLElement): void {
    void Promise.resolve(navigator.clipboard?.writeText(value)).then(() => {
      announce(tRaw('Copied {v}', { v: value }));
      on.classList.add('is-copied');
      setTimeout(() => on.classList.remove('is-copied'), 1200);
    }).catch(() => announce(t('Copy failed')));
  }

  // ONE delegated click handler, on the `.lab` root - which shellHtml replaces on
  // every mount. Bound to `view` instead, the listeners survived the innerHTML
  // swap and stacked up, so a single click fired once per previous mount.
  const labRoot = $('.lab');
  labRoot?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Most specific first: anything showing a value copies THAT value. Clicking the
    // oklch line gives you oklch, clicking the hex line gives you the hex - you get
    // what you pointed at, rather than whichever form we decided was canonical.
    const copy = target.closest<HTMLElement>('[data-lab-copy]');
    if (copy?.dataset.labCopy) { copyValue(copy.dataset.labCopy, copy); return; }

    // Then the ramps. The two mean different things: a TONE step is a point on the
    // subject's own ramp, so it re-seeds; a BLEND stop is an output between this
    // colour and another, so it copies - re-seeding would destroy the blend it came
    // from, since the near end IS the subject.
    const step = target.closest<HTMLElement>('[data-lab-step]');
    const hex = step?.dataset.labStep;
    if (!hex) return;
    if (step!.closest('[data-lab-blend]')) copyValue(oklchStringFor(hex), step!);
    else setSubject(hex);
  });

  // The keyboard half of the copy affordances. The swatch's value lines announce
  // themselves as buttons (role + tabindex, so the touch tooltip can open on focus),
  // and a thing that says "button" has to answer Enter and Space. Nothing else needs
  // this: every other copy target on the page already IS a <button>.
  labRoot?.addEventListener('keydown', (e) => {
    const ev = e as KeyboardEvent;
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const el = ev.target as HTMLElement;
    if (el.getAttribute('role') !== 'button') return;
    const value = el.closest<HTMLElement>('[data-lab-copy]')?.dataset.labCopy;
    if (!value) return;
    ev.preventDefault();
    copyValue(value, el);
  });

  // ── Brand swatches, when there is a brand ────────────────────────────────
  try {
    const colors = await host.tokens?.colors?.();
    const list = Array.isArray(colors) ? colors : [];
    const mount = $('[data-lab-brand]');
    const section = $('[data-lab-brand-section]');
    // Resolve each swatch's TRUE colour ONCE, then `renderBrand` re-badges from
    // this list on every target change without re-reading tokens.
    brandSwatches = list.slice(0, 64).map((c): BrandSwatch | null => {
      const value = String(c.value ?? '');           // ALWAYS an sRGB hex (tokens.ts bakes it)
      const real = widestFace(c) ?? value;           // the richest value we actually have
      const desc = describeColor(real) ?? describeColor(value);
      const hex = describeColor(value)?.srgbHex ?? desc?.srgbHex;
      if (!hex) return null;
      return { pick: value, hex, real, name: String(c.name ?? c.id ?? hex), oklch: desc?.oklch ?? null };
    }).filter((s): s is BrandSwatch => s != null);
    if (mount && brandSwatches.length) {
      renderBrand();
      // The contrast matrix is a PALETTE diagnostic, so it only has something to say
      // once a palette resolved: reveal the panel and fill the grid here (it is
      // independent of the subject, so it is not touched again on a subject change).
      const diag = $('[data-lab-diag]');
      if (diag) diag.hidden = false;
      renderCvdMatrix();
      // Delegated once - `renderBrand` rewrites innerHTML, so a per-swatch listener
      // would be lost on every re-badge. Click still SEEDS the colour; the badge is
      // a read-only overlay and does not touch this path.
      mount.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest<HTMLElement>('[data-lab-brand-pick]');
        if (b?.dataset.labBrandPick) setSubject(b.dataset.labBrandPick);
      });
      // Honest about the limits of the data: `value` is always an sRGB hex, and
      // Display-P3/Rec.2020 both CONTAIN sRGB, so a palette with no wide-gamut faces
      // can only ever badge against a press profile narrower than sRGB - never P3 or
      // Rec.2020. That is correct, not a bug; don't fake a badge to fill the gap.
      if (!brandSwatches.some((s) => s.real !== s.hex)) {
        console.info('[color-lab] brand palette is sRGB-sourced (no wide-gamut faces); ' +
          'display-gamut targets (Display-P3/Rec.2020) will not badge - only a narrower press profile can.');
      }
    } else if (section) {
      section.hidden = true; // no brand mounted - say nothing rather than show an empty rail
    }
  } catch { /* a brandless build simply has no rail */ }

  // ── First paint ──────────────────────────────────────────────────────────
  buildCharts();
  renderReadouts();
  paintCharts();
  paintSolid();

  // Charts and the solid are sized by the page, which reflows on resize.
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => { paintCharts(); scheduleSolid(); });
    const grid = $('[data-lab-charts]');
    if (grid) ro.observe(grid);
    cleanups.push(() => ro.disconnect());
  }

  // ── "This screen" ────────────────────────────────────────────────────────
  // Off the first-paint path: the probe touches WebGL and UA-hints, neither of
  // which the charts wait on. The cards come from lib/device-info.ts verbatim - 
  // the Dashboard's renderer, so the gamut named here and the one named at
  // #/d?tab=device are the same read, not two implementations of it.
  //
  // Display leads: its "Colour gamut" row is the one fact on the page that
  // decides whether what you see IS what the chart claims. Then the GPU (which
  // machine) and the graphics API (how it got to the glass).
  collectDevice()
    .then((snap) => {
      const sec = $('[data-lab-device]');
      const grid = $('[data-lab-device-grid]');
      // A late probe from a superseded mount must not paint over the live one.
      if (!sec || !grid || !view.contains(grid)) return;
      const order: ClientGroupKey[] = ['display', 'gpu', 'graphics'];
      const cards = order
        .map((k) => snap.groups.find((g) => g.key === k))
        .filter((g): g is ClientGroup => !!g);
      if (!cards.length) return; // no probe answered - say nothing rather than show an empty rail
      grid.innerHTML = renderDeviceCards(cards);
      grid.classList.add('plat-hydrated');
      sec.hidden = false;
      cleanups.push(wireDeviceLive(grid)); // the Display card's viewport rows are live
    })
    .catch(() => { /* device snapshot is best-effort - the section stays hidden */ });

  // `#view` is PERSISTENT - the router calls `view.replaceChildren()` and mounts the
  // next view into the same element, so waiting for it to disconnect never fires and
  // this view's rAF loop, ResizeObserver and body-level toast would outlive it.
  // `view._cleanup` is the shell's supported hook (main.ts:148). Chain any existing
  // one rather than clobbering it.
  const prevCleanup = (view as ViewElement)._cleanup;
  (view as ViewElement)._cleanup = () => {
    prevCleanup?.();
    releaseChartHdrContexts();   // Tier-A GL contexts are not otherwise freed on unmount
    for (const fn of cleanups) fn();
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * The gamut verdict for ONE swatch against ONE comparison target - the whole
 * badge decision, pure and in one testable place.
 *
 * `clippedHex` is what the colour BECOMES inside `limit`: chroma given up at
 * constant lightness/hue (CSS Color 4 section 14.2, via `clipToGamut`), rendered to an
 * sRGB hex. `deltaE` is the perceptual distance (ΔEOK) between the swatch and
 * that clip - so a badge can say not just "outside" but "outside, by THIS much";
 * it is exactly 0 when the colour already fits, where `clipToGamut` returns the
 * input untouched and so `clippedHex === oklchToHex(oklch)`.
 *
 * Membership is asked of the ACTUAL gamut (`inGamut`), never inferred from an
 * area ordering: sRGB ⊂ Display-P3 holds, but Display-P3 ⊄ Rec.2020 (P3's red sits
 * outside the Rec.2020 triangle - see the engine's `inGamut`), and a press profile
 * can be narrower than sRGB. Works for a display gamut NAME or any `GamutSource`
 * (an ICC print profile) alike.
 */
export function swatchGamutState(
  oklch: { l: number; c: number; h: number },
  limit: GamutLimit,
): { outOfGamut: boolean; clippedHex: string; deltaE: number } {
  const inside = inGamut(oklch.l, oklch.c, oklch.h, limit);
  const clippedHex = oklchToHex(clipToGamut(oklch, limit));
  return {
    outOfGamut: !inside,
    clippedHex,
    deltaE: inside ? 0 : deltaEOk(formatOklch(oklch), clippedHex),
  };
}

/**
 * The full asymmetric APCA grid over `colors` - the whole matrix, pure and
 * testable in one place.
 *
 * `cell[i][j]` scores `colors[i]` as TEXT on `colors[j]` as BACKGROUND. APCA is
 * polarity-dependent, so this is deliberately NOT symmetric - white-on-black and
 * black-on-white have opposite-signed Lc - and the diagonal (a colour on itself)
 * is ~0, because the engine returns 0 when text and background luminance coincide.
 * `lc` is the SIGNED engine value (`apcaContrast`); `band` is its APCA use-band
 * (`apcaUse`) - the existing band interpretation, not a reinvented threshold. The
 * caller prepends white and black to `colors`.
 */
export function contrastMatrix(colors: string[]): { lc: number; band: string }[][] {
  return colors.map((text) =>
    colors.map((bg) => {
      const lc = apcaContrast(text, bg);
      return { lc, band: apcaUse(lc) };
    }),
  );
}

/**
 * A palette colour as it appears under one vision-preview mode.
 *
 *   · `normal`    → identity (the string is returned unchanged).
 *   · `grayscale` → `toGrayscaleHex` (Rec.709 luma).
 *   · CVD type    → `simulateCvdHex` at `severity` (Machado 2009; 1 = full
 *                   dichromacy, 0 = identity).
 *
 * The engine wrappers are hex-only and return null for an unreadable input; this
 * falls back to the input string so a caller can paint SOMETHING rather than an
 * empty fill. Pure and DOM-free.
 */
export function simulatePalette(hex: string, mode: CvdMode, severity = 1): string {
  if (mode === 'normal') return hex;
  if (mode === 'grayscale') return toGrayscaleHex(hex) ?? hex;
  return simulateCvdHex(hex, mode, severity) ?? hex;
}

/**
 * The widest-gamut authored face on a brand swatch as a CSS colour string, or
 * null when it has none we can read.
 *
 * `faces` (engine `color-faces.ts`) are per-target overrides; only the STRING
 * ones are colours (an ICC face is four ink numbers, not a paintable value). This
 * is the ONLY place a swatch carries a value wider than its baked sRGB `value`, so
 * it is what makes a Display-P3/Rec.2020 badge meaningful when the brand authored
 * one. Rec.2020 before Display-P3, so the richest available value wins.
 */
function widestFace(c: LabSwatchInput): string | null {
  const f = c.faces;
  if (!f) return null;
  for (const key of ['rec2020', 'display-p3'] as const) {
    const v = f[key];
    if (typeof v === 'string' && describeColor(v)) return v;
  }
  return null;
}

/** `?c=<any css colour>` from the route params. */
function seedFrom(params: string): string | null {
  try {
    const q = new URLSearchParams(params.startsWith('?') ? params.slice(1) : params);
    const c = q.get('c');
    return c && describeColor(c) ? c : null;
  } catch { return null; }
}

/**
 * `?…&limit=` from the route params - an explicit comparison target, which beats
 * every kind of detection. One of the three display gamut names, or a profile id
 * exactly as `iccGamutSource` mints it (`icc:<16 hex>:<intent>`).
 *
 * Returned as the RAW string, not resolved: a profile id has to survive into the
 * URL unchanged even on a device that does not have that profile, so resolving it
 * here would throw away the only thing that keeps a shared link honest.
 * Anything else is junk and falls back to null → {@link DEFAULT_LIMIT}.
 */
function limitFrom(params: string): string | null {
  try {
    const q = new URLSearchParams(params.startsWith('?') ? params.slice(1) : params);
    const v = q.get('limit');
    if (!v) return null;
    if ((GAMUTS as readonly string[]).includes(v)) return v;
    return parseProfileLimit(v) ? v : null;
  } catch { return null; }
}

/**
 * `?…&nits=` from the route params - the headroom axis's peak luminance, so an
 * HDR-tuned link reproduces the sender's exposure (plan 154 WP-5). Bounded to the
 * axis's own range and rounded; anything outside or unparseable falls back to null →
 * {@link NITS_DEFAULT}. Carried through even on an SDR recipient (like `&limit=`)
 * rather than dropped, so forwarding the link a second time keeps it intact.
 */
function nitsFrom(params: string): number | null {
  try {
    const q = new URLSearchParams(params.startsWith('?') ? params.slice(1) : params);
    const v = q.get('nits');
    if (!v) return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= NITS_MIN && n <= NITS_MAX ? n : null;
  } catch { return null; }
}

/**
 * A profile's substrate as PCS Lab: zero ink for an ink space (no ink IS the
 * paper), device white otherwise.
 *
 * This is the one number that explains why absolute colorimetric looks different
 * on newsprint, and it is measured rather than assumed - a coated stock and an
 * uncoated one differ by several ΔE at the white point alone. Null when the
 * profile cannot answer under this intent.
 */
function paperWhite(p: IccProfile, intent: RenderingIntent): [number, number, number] | null {
  const ink = /^(CMYK|CMY|[2-9A-F]CLR)$/i.test(p.dataColourSpace.trim());
  const dev = Array.from({ length: p.nChannels }, () => (ink ? 0 : 1));
  return p.toLab(intent, dev);
}

/**
 * Paint an element with the colour as AUTHORED, falling back to its sRGB
 * approximation only where the browser can't take the authored form.
 *
 * Two assignments on purpose: the first is a value every browser understands, the
 * second is the real thing. A browser that can't parse `color(display-p3 …)`
 * ignores the second and keeps the first; one that can uses the real colour and
 * does its own per-display mapping - which beats us deciding up front that
 * nobody can see it.
 */
function paintSwatch(el: HTMLElement, d: ColorDescription, exp?: HdrExposure, preview?: boolean): void {
  el.style.background = d.srgbHex;
  el.style.background = d.input;
  // Ink is chosen against the RENDERED fallback: it has to be readable on the
  // narrow-gamut result too, and the two are close enough that one choice serves.
  // The shared inversion rule (contrastText) - the big swatch used to flip to black
  // a good deal earlier than the dial disc sitting right below it.
  el.style.color = contrastText(d.srgbHex);
  paintSwatchHdr(el, d, exp, preview);
}

/** The blob URL currently backing each swatch's HDR fill, so it can be revoked. */
const SWATCH_HDR = new WeakMap<HTMLElement, string>();

/**
 * On an HDR display, back the preview with a Rec.2100-PQ cICP image of the colour
 * instead of the CSS fill, so a bright colour GLOWS above SDR white and a wide one
 * shows unclamped - the same headroom the slice charts use (lib/hdr-image.ts). A CSS
 * `background`/`color()` can carry wide gamut but nothing above SDR white; only an
 * HDR image can, and it works on every HDR display (WebKit and Chromium alike -
 * there is no live interaction here that would want the canvas path). The colour is
 * a tiny solid, so this encodes inline; the CSS fill from paintSwatch stays as the
 * fallback under it (and on non-HDR displays the image is simply never set).
 */
function paintSwatchHdr(el: HTMLElement, d: ColorDescription, exp?: HdrExposure, preview?: boolean): void {
  const prev = SWATCH_HDR.get(el);
  if (prev) { URL.revokeObjectURL(prev); SWATCH_HDR.delete(el); }
  el.style.backgroundImage = ''; // clear any prior HDR fill → CSS colour shows through
  // `preview === false` is the A/B toggle's SDR side (plan 154 WP-5): the swatch drops
  // its glow to match the charts. On an SDR display displaySupportsHdr() is already
  // false, so the swatch was never lifted there and this stays byte-identical.
  if (!displaySupportsHdr() || preview === false) return;
  const encode = displayAnchor();
  // encodeOklch is the engine's painter path (the same one the slices/quads use), so
  // the preview and the charts cannot disagree; a colour past the display gamut is
  // mapped to its boundary here, exactly as a pixel in a slice would be.
  const [r, g, b] = encodeOklch(d.oklch.l, d.oklch.c, d.oklch.h, encode);
  const byte = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 255);
  const solid = new Uint8ClampedArray([byte(r), byte(g), byte(b), 255, byte(r), byte(g), byte(b), 255,
    byte(r), byte(g), byte(b), 255, byte(r), byte(g), byte(b), 255]); // 2×2 solid
  try {
    const url = hdrPngUrl(solid, 2, 2, encode === 'display-p3' ? 'display-p3-linear' : 'srgb-linear', exp, 8);
    el.style.backgroundImage = `url("${url}")`;
    el.style.backgroundSize = 'cover';
    SWATCH_HDR.set(el, url);
  } catch { /* keep the CSS fill from paintSwatch */ }
}

/** Multiply a hex toward black by `k` - the solid's soft top-light. */
/**
 * A solid patch's fill: its OKLCH encoded for the surface, times the shading.
 *
 * The two branches are the same operation at different widths, which is the whole
 * point - on an sRGB surface this is exactly what `shade(hex, k)` produced, and on
 * a P3 one the colour is real rather than mapped. `encodeOklch` is the engine's
 * own painter path, so a quad here and a pixel in a slice chart cannot disagree.
 *
 * The multiply lands on the ENCODED channels, not on L, matching what the hex path
 * has always done - shading is a lighting effect on the drawing, not a claim about
 * the colour, and moving it into OKLCH would quietly change every existing chart.
 */
function shadedFill(o: { l: number; c: number; h: number }, k: number, encode: EncodeSpace): string {
  const [r, g, b] = encodeOklch(o.l, o.c, o.h, encode);
  const n = (v: number): string => Math.min(1, Math.max(0, v * k)).toFixed(4);
  return encode === 'display-p3'
    ? `color(display-p3 ${n(r)} ${n(g)} ${n(b)})`
    : `rgb(${Math.round(+n(r) * 255)} ${Math.round(+n(g) * 255)} ${Math.round(+n(b) * 255)})`;
}

/**
 * One readability card's fixed structure. Every number in it is filled by
 * `renderContrast`; nothing here is regenerated, so the third card's mounted
 * picker survives every re-score.
 */
function contrastCardShell(key: string, label: string, pickable = false): string {
  return `
      <div class="lab-contrast-card" data-lab-card="${escape(key)}">
        <p class="lab-contrast-sample"><span data-lab-card-label>${escape(label)}</span><span class="lab-best" data-lab-card-best hidden>${escape(t('best'))}</span></p>
        ${pickable ? `<div class="lab-ink-pick" data-lab-ink-pick></div>` : ''}
        <p class="lab-apca" data-lab-apca>
          <span class="lab-apca-lc" data-lab-apca-lc></span>
          <span class="lab-apca-use" data-lab-apca-use></span>
          <span class="lab-apca-pol" data-lab-apca-pol hidden></span>
        </p>
        <p class="lab-contrast-wcag">
          <span class="lab-contrast-ratio" data-lab-ratio></span>
          <span data-lab-badges></span>
        </p>
      </div>`;
}

/**
 * The view's static frame.
 *
 * The comparison row starts as an EMPTY group, filled by `renderLimitSeg` before
 * the first paint. It used to be written from a `limit` parameter, which worked
 * while a limit was one of three names; a mounted press profile makes the row's
 * contents depend on state this function cannot see (which profile, which intent,
 * whether a link's profile is absent), and two places building the same row is
 * exactly the drift this file's comments keep warning about. One owner.
 *
 * Nothing here reaches the typed inputs' bounds either - those are scaled to
 * CONTROL_LIMIT, because a comparison target must not change what is editable.
 */
function shellHtml(): string {
  const seg = (): string =>
    `<div class="view-seg lab-seg lab-limit" role="group" aria-label="${escape(t('See it against'))}" data-lab-limit></div>`;

  // Plot first, caption under it - a figure/figcaption, so "this text describes
  // the thing above" is in the markup and not just in the CSS order.
  /**
   * The "pop this figure out" affordance.
   *
   * On the figure's own title bar rather than floating over the plot: the plot is
   * a drag surface (picking a colour, turning the solid), and a control sitting on
   * it would eat presses meant for the chart.
   */
  /** The entry point's own glyph, so it reads as an invitation rather than as one
   *  more text button in a caption. Through `icon()` rather than inlined - the
   *  glyph is already in its registry, and the primitive guard exists precisely to
   *  stop a second copy of a Lucide path drifting from the first. */
  const IMG_GLYPH = icon('image');

  const popBtn = (label: string): string =>
    `<button type="button" class="lab-pop-btn" data-lab-pop
      aria-label="${escape(tRaw('Pop out {p}', { p: label }))}"
      ${/* Short, because this tooltip is a pseudo-element that cannot be flipped
            back inside the viewport: at the right edge of a phone the longer text
            ran off screen. The full description lives on the aria-label. */''}
      data-tip="${escape(t('Pop out'))}">⤢</button>`;

  const chart = (plane: SlicePlane): string => {
    const ch = PANEL_CHANNEL[plane];
    // CONTROL_LIMIT, not the pressed pill: a control's reach must not depend on
    // which gamut is being compared against. buildCharts() re-derives these against
    // the subject, which is the only thing that can widen them.
    const r = channelRange(ch, chromaAxisMax(CONTROL_LIMIT));
    return `
    <figure class="lab-chart">
      <div class="lab-chart-bar">
        <h3 class="lab-chart-title">${escape(PANEL_TITLE[plane])}</h3>
        ${/* Typed entry with steppers, for the times a slider cannot be precise
              enough - matching a hue to a spec, nudging a ramp step by 0.001. */''}
        <input type="number" class="lab-chart-num" data-lab-num="${plane}"
          min="${r.min}" max="${r.max}" step="${ch === 'h' ? 0.01 : ch === 'l' ? 0.001 : 0.0001}"
          aria-label="${escape(PANEL_TITLE[plane])}">
        ${popBtn(tRaw('{p} chart', { p: PANEL_TITLE[plane] }))}
      </div>
      <div data-lab-chart="${plane}"></div>
      ${/* The axis this plane is sliced along, as a broken track: the solid runs
            are the values that stay displayable, the gaps are the ones that do
            not. Complements dragging INSIDE the chart - the slider moves the
            slice, the drag moves the colour within it. */''}
      <div class="lab-chart-slider" data-lab-slider="${plane}"></div>
      <figcaption class="lab-chart-head">
        <p class="lab-chart-plane">${escape(PLANE_TITLE[plane])} · ${escape(t('at'))}
          <strong data-lab-slice-at="${plane}"></strong></p>
        <p class="lab-chart-why">${escape(PLANE_WHY[plane])}</p>
        <p class="lab-chart-at"><span class="lab-chart-hint">${escape(t('Click or drag the chart to pick'))}</span></p>
      </figcaption>
    </figure>`;
  };

  // The page reads top to bottom as one narrowing sequence - see the module
  // header. Each numbered step below is one of those questions.
  return `
  <div class="lab">
    ${/* Back on the left, screen-context controls on the right - the same division the
          editor's stage HUD uses, and the reason the theme toggle is here at all: this
          page is about how a colour READS, and a colour reads differently in each
          theme. Icon-only, like the zoom controls it is modelled on. */''}
    <div class="lab-back">
      ${backPillHtml()}
      <div class="lab-chrome" data-lab-chrome>${homeFabHtml({ className: 'lab-chrome-btn' })}</div>
    </div>

    <header class="lab-head">
      <h1>${escape(t('Colour Lab'))}</h1>
      <p class="lab-sub">${escape(t('Everything about one colour: where it lands in perceptual space, which displays can show it, how much room is left, and what it is called in every notation.'))}</p>
    </header>

    <!-- 1 · SET A COLOUR. Three ways in, none of them in a sidebar. -->
    <section class="lab-step-block">
      <h2 class="lab-h2 lab-step-h">
        <span class="lab-step-n" aria-hidden="true">1</span>${escape(t('Set a colour'))}
      </h2>
      <div class="lab-subject">
        <div class="lab-swatch" data-lab-swatch>
          <div class="lab-sw-vals">
            <code class="lab-sw-primary" data-lab-sw-primary></code>
            <span class="lab-sw-space" data-lab-sw-space></span>
            <ul class="lab-sw-alts" data-lab-sw-alts></ul>
          </div>
        </div>

        <div class="lab-entry">
          ${/* No text field of our own: the picker's value pill IS the manual entry,
                and two of them was one too many. Wide-gamut values still arrive by
                `?c=`, and will be typeable directly once the picker carries tabs
                for those spaces. */''}
          ${/* The out-of-gamut notice is a TOAST, not a block here - see labToast.
                In the flow it pushed the whole column around whenever a colour
                crossed the sRGB boundary, which is most of what you do in this
                tool. The persistent record of the fact is the gamut card. */''}
          <div class="lab-brand-rail" data-lab-brand-section>
            <span class="lab-field-label">${escape(t('Or from your brand'))}</span>
            <div class="lab-brand" data-lab-brand></div>
          </div>
        </div>

        <div class="lab-picker" data-lab-picker></div>
      </div>
    </section>

    <!-- 2 · THE CHARTS. High up: they are what the page is for, and the gamut
         control comes with them because it governs what they draw. -->
    <section class="lab-step-block">
      <h2 class="lab-h2 lab-step-h">
        <span class="lab-step-n" aria-hidden="true">2</span>${escape(t('Plotted on a colour space'))}
      </h2>
      ${/* Full width, directly above the charts: it governs all four of them, so
            it reads as a control over the whole row rather than a setting tucked
            beside the heading. */''}
      <div class="lab-target">
        ${seg()}
        ${/* Bounds sits WITH the gamut tabs: "bounds" means the bounds of whichever
              target those tabs select, so separating them would orphan it. */''}
        ${/* `.field-toggle` + `.field-check` - the ONE form-control recipe
              (styles/parts/fields.css). A bare checkbox was drawn by the UA at 13×13
              and so missed the recipe's coarse-pointer bump to 20px. */''}
        <label class="lab-bounds field-toggle">
          <input type="checkbox" class="field-check" data-lab-bounds>
          <span>${escape(t('Keep in bounds'))}</span>
        </label>
      </div>
      ${/* The headroom / nits axis + the SDR/HDR A/B preview (plan 154 WP-5). Hidden
            until the display reports HDR headroom (syncHdrVisibility unhides it), so an
            SDR screen never carries a control it cannot answer. The slider wears the
            channel sliders' `.gsl` skin but drives an EXPOSURE into the display's peak,
            deliberately NOT the lightness slider run past 1.0 - see NITS_DEFAULT. */''}
      <div class="lab-hdr" data-lab-hdr hidden>
        <div class="lab-hdr-head">
          <span class="lab-field-label">${escape(t('Headroom / nits'))}</span>
          <p class="lab-hdr-why">${escape(t('How far into your display’s peak the light end of each chart is exposed - an exposure into the display’s headroom, not the lightness axis pushed past 100%.'))}</p>
        </div>
        <div class="lab-hdr-row">
          <div class="gsl lab-mix lab-nits-slider" data-lab-nits-slider>
            <span class="gsl-key" aria-hidden="true">${escape(t('Nits').charAt(0))}</span>
            <div class="gsl-well">
              <div class="gsl-track" data-gsl-track aria-hidden="true"></div>
              <input type="range" class="gsl-input" data-gsl-input
                min="${NITS_MIN}" max="${NITS_MAX}" step="1" value="${NITS_DEFAULT}"
                aria-label="${escape(t('Peak nits'))}">
            </div>
            <output class="gsl-val" data-gsl-val>${NITS_DEFAULT}</output>
          </div>
          <div class="view-seg lab-seg lab-hdr-ab" role="group" aria-label="${escape(t('Preview'))}" data-lab-hdr-ab>
            <button type="button" class="view-seg-btn" data-val="hdr" aria-pressed="true">${escape(t('HDR'))}</button>
            <button type="button" class="view-seg-btn" data-val="sdr" aria-pressed="false">${escape(t('SDR'))}</button>
          </div>
        </div>
      </div>
      <div class="lab-charts" data-lab-charts>
        ${PLANES.map(chart).join('')}
        <figure class="lab-chart lab-chart--solid">
          <canvas class="lab-solid" data-lab-solid tabindex="0"
            role="img" aria-label="${escape(t('The displayable colour volume in OKLCH. Drag or use the arrow keys to turn it.'))}"></canvas>
          <figcaption class="lab-chart-head">
            <div class="lab-chart-bar">
              <h3 class="lab-chart-title">${escape(t('The whole gamut'))}</h3>
              ${popBtn(t('The whole gamut'))}
            </div>
            <p class="lab-chart-why">${escape(t('The shape the three flat charts are slicing. Turn it once and their curves stop looking arbitrary.'))}</p>
            ${/* Two embeddings of one solid, not two pictures. Landscape lays hue
                  out flat so per-hue peaks line up; Lab axes is the ColorSync view,
                  and the one to compare gamuts in - it holds ONE scale across all
                  three axes, so a press solid is visibly smaller than sRGB instead
                  of being normalised to the same frame. */''}
            <div class="view-seg lab-embed" role="group" aria-label="${escape(t('How the solid is drawn'))}" data-lab-embed>
              <button type="button" class="view-seg-btn" data-val="landscape" aria-pressed="true">${escape(t('Landscape'))}</button>
              <button type="button" class="view-seg-btn" data-val="lab" aria-pressed="false">${escape(t('Lab axes'))}</button>
            </div>
            ${/* The second way in (plans/60-color-spaces.md section 11.5): a colour, or an
                  image. It sits on the solid rather than up in step 1 because the
                  result appears HERE - the cloud is drawn in this figure, and an
                  affordance three sections away from its own effect reads as an
                  unrelated upload. Not a dashed box: in this design language a
                  dashed border means drop area and nothing else, and the whole
                  figure is the drop area, so the button must not impersonate one. */''}
            <div class="lab-cloud-row">
              <label class="lab-cloud-add">
                <input type="file" accept="image/*" data-lab-cloud-file hidden>
                <span class="lab-cloud-add-ic" aria-hidden="true">${IMG_GLYPH}</span>
                <span class="lab-cloud-add-txt">
                  <strong>${escape(t('Plot an image'))}</strong>
                  <em>${escape(t('or drop one on the chart - see its colours in here'))}</em>
                </span>
              </label>
              <button type="button" class="lab-cloud-clear" data-lab-cloud-clear hidden>${escape(t('Clear'))}</button>
            </div>
            <p class="lab-cloud-stats" data-lab-cloud-stats hidden></p>
            <p class="lab-chart-at"><strong data-lab-solid-note></strong></p>
            ${/* A STILL of the same solid, in vector. The canvas is the turntable;
                  this is what a docs screenshot captures (real polygons, not a
                  raster) and what you take away. Folded, and rendered on open - 
                  see renderSolidSvg. Painted in sRGB, so it shows structure, not
                  colour beyond sRGB. */''}
            <details class="lab-vecsnap" data-lab-solid-svg-panel>
              <summary>${escape(t('Vector snapshot (SVG)'))}</summary>
              <div class="lab-vecsnap-body" data-lab-solid-svg role="img"
                aria-label="${escape(t('The current gamut solid as a still vector image, at the angle shown above.'))}"></div>
              <p class="lab-vecsnap-note">${escape(t('A still SVG of the shape above, painted in sRGB - it shows the hull’s structure, not colours beyond sRGB.'))}</p>
            </details>
          </figcaption>
        </figure>
      </div>
      ${/* The two-shell comparison. Deliberately SIDE BY SIDE, not overlaid: two
            translucent screen gamuts over each other look like one unclear shape
            and hide which is in front (see paintSolid). At one shared angle and
            scale, Display-P3 NOT being contained by Rec.2020 shows up as SHAPE.
            Folded; rendered on open - see renderCompare. */''}
      <details class="lab-compare" data-lab-compare-panel>
        <summary>${escape(t('Compare gamuts: Display-P3 vs Rec.2020'))}</summary>
        <p class="lab-section-note">${escape(t('The two widest screen gamuts, side by side at the same angle and scale - turn the solid above and reopen this to match it. Display-P3 is not contained by Rec.2020, which is why the shapes differ. Painted in sRGB: these stills show the hulls’ structure, not colours beyond sRGB.'))}</p>
        <div class="lab-compare-grid" data-lab-compare-body></div>
      </details>
    </section>

    <!-- 3 · EVERY NOTATION. -->
    <section class="lab-step-block">
      <h2 class="lab-h2 lab-step-h">
        <span class="lab-step-n" aria-hidden="true">3</span>${escape(t('Every notation'))}
      </h2>
      <p class="lab-section-note">${escape(t('The same colour, written for each space. A row marked “clamped” names a space too narrow to hold it - CSS would round those numbers into range.'))}</p>
      <table class="lab-notations">
        <thead><tr>
          <th scope="col">${escape(t('Space'))}</th>
          <th scope="col">${escape(t('Value'))}</th>
          <th scope="col">${escape(t('Fit'))}</th>
          <th scope="col"><span class="sr-only">${escape(t('Copy'))}</span></th>
        </tr></thead>
        <tbody data-lab-notations></tbody>
      </table>
    </section>

    <!-- 4 · TONES AND BLENDS. What you build out of the colour. -->
    <section class="lab-step-block">
      <div class="lab-step-head">
        <h2 class="lab-h2 lab-step-h">
          <span class="lab-step-n" aria-hidden="true">4</span>${escape(t('Tones and blends'))}
        </h2>

      </div>
      <p class="lab-section-note">${escape(t('Tone steps re-seed the report; blend stops copy to the clipboard.'))}</p>

      <h3 class="lab-h3">${escape(t('Tones'))}</h3>
      <p class="lab-section-note">${escape(t('A perceptually even ramp through this colour, pale to dark.'))}</p>
      ${/* The same mixer slider the blend carries, for the same reason: its rail is
            the continuous ramp the swatches below are sampling, so the control shows
            what it is subdividing. Two ramps, one idiom. */''}
      <div class="gsl lab-mix" data-lab-tone-steps>
        <span class="gsl-key" aria-hidden="true">${escape(t('Stops').charAt(0))}</span>
        <div class="gsl-well">
          <div class="gsl-track" data-gsl-track aria-hidden="true"></div>
          <input type="range" class="gsl-input" data-gsl-input min="2" max="24" step="1" value="9"
            data-lab-steps aria-label="${escape(t('Number of tone steps'))}">
        </div>
        <output class="gsl-val" data-gsl-val data-lab-steps-out>9</output>
      </div>
      <div class="lab-ramp" data-lab-ramp></div>

      <h3 class="lab-h3">${escape(t('Blend to another colour'))}</h3>
      <p class="lab-section-note">${escape(t('The space it travels through decides what the middle looks like. Click a stop to copy it.'))}</p>
      ${/* TWO COLUMNS: the far-end picker BESIDE the ramp it changes, stacking on a
            narrow viewport. Stacked everywhere, the expanded picker's ~554px of tabs,
            dials, channel sliders and alpha pushed the style pills, the stop count and
            every swatch off the bottom of the screen - so the one thing you need while
            picking, the ramp changing under your hands, was the one thing you could not
            see. Source order still reads pick-then-result when it folds. */''}
      <div class="lab-blend">
        <div class="lab-blend-to">
          <div class="lab-blend-to-head">
            <span class="lab-field-label">${escape(t('Blend to'))}</span>
            ${/* Still the only way to type a far end in a space the picker has no tab
                  for - same reason the subject keeps one, and it goes when the picker
                  gains those tabs. */''}
            <input type="text" class="field-input lab-blend-raw" data-lab-blend-raw spellcheck="false"
              autocapitalize="off" autocomplete="off"
              aria-label="${escape(t('The far end of the blend, in any colour space'))}">
          </div>
          <div class="lab-blend-picker" data-lab-blend-picker></div>
        </div>

        <div class="lab-blend-side">
          ${/* Full width of its column, above the ramp - the same shape as the gamut
                control above the charts: it governs everything under it, so it reads
                as a heading row rather than as one more field. */''}
          <div class="lab-blend-styles">
            <div class="view-seg lab-seg" role="group" aria-label="${escape(t('Blend'))}" data-lab-blend-space>
              ${/* `data-tip`, not `title`: the rationale for each style is the whole
                    reason the pills are labelled so briefly, and a `title` is invisible
                    to every touch and keyboard user. The tooltip primitive
                    (styles/parts/tooltip.css) opens on plain focus where there is no
                    hover, so a tap shows it. aria-label carries the same text, since
                    the bubble is a pseudo-element and never read. */''}
              ${BLEND_STYLES.map(b => `<button type="button" class="view-seg-btn" data-val="${b.space}"
                data-tip="${escape(t(b.why))}" aria-label="${escape(`${t(b.label)} - ${t(b.why)}`)}"
                aria-pressed="${b.space === BLEND_DEFAULT_SPACE}">${escape(t(b.label))}</button>`).join('')}
            </div>
            ${/* Hue travel only means anything in a polar space, so the row is present but
                  inert until one is chosen - hidden rather than absent, so choosing Vivid
                  does not reflow the section. */''}
            <div class="view-seg lab-seg lab-blend-hue" role="group" aria-label="${escape(t('Hue route'))}"
              data-lab-blend-hue${isPolarSpace(BLEND_DEFAULT_SPACE) ? '' : ' hidden'}>
              ${HUE_ROUTES.map(r => `<button type="button" class="view-seg-btn" data-val="${r.dir}"
                aria-pressed="${r.dir === BLEND_DEFAULT_HUE}">${escape(t(r.label))}</button>`).join('')}
            </div>
          </div>
          ${/* The stops slider wears the colour-mixer sliders' skin (.gsl, from
                oklch-slice.css) and its rail is painted with the blend itself - so the
                control shows the thing it is subdividing. */''}
          <div class="gsl lab-mix" data-lab-blend-steps>
            <span class="gsl-key" aria-hidden="true">${escape(t('Stops').charAt(0))}</span>
            <div class="gsl-well">
              <div class="gsl-track" data-gsl-track aria-hidden="true"></div>
              <input type="range" class="gsl-input" data-gsl-input min="2" max="24" step="1" value="9"
                aria-label="${escape(t('Number of blend stops'))}">
            </div>
            <output class="gsl-val" data-gsl-val>9</output>
          </div>
          <div class="lab-ramp" data-lab-blend></div>
        </div>
      </div>
    </section>
    <!-- 5 · WHAT IT COSTS YOU. The verdict and the readability scores: real, but
         reference material rather than the reason you opened the page - so they
         sit under the charts and the ramps instead of in front of them. -->
    <section class="lab-step-block">
      <h2 class="lab-h2 lab-step-h">
        <span class="lab-step-n" aria-hidden="true">5</span>${escape(t('Displayable range and readability'))}
      </h2>
      <div class="lab-verdict">
        <div class="lab-card lab-gamut" data-lab-gamut>
          <p class="lab-card-label">${escape(t('Displayable in'))}</p>
          <p class="lab-card-value" data-lab-gamut-name></p>
          <p class="lab-card-note" data-lab-gamut-blurb></p>
        </div>
        <div class="lab-card lab-headroom" data-lab-headroom>
          <p class="lab-card-label">${escape(t('Chroma headroom'))}</p>
          <p class="lab-card-value" data-lab-headroom-val></p>
          <p class="lab-card-note" data-lab-headroom-note></p>
        </div>
        <div class="lab-card">
          <p class="lab-card-label">${escape(t('Chroma ceiling here'))}</p>
          <ul class="lab-ceilings" data-lab-ceilings></ul>
          <p class="lab-card-note">${escape(t('The most chroma each gamut allows at this lightness and hue.'))}</p>
        </div>
        ${/* The headroom / nits card (plan 154 WP-5). A SEPARATE luminance readout,
              not a lightness one: filled by renderReadouts with the nits this colour
              reaches on an HDR panel, or a Tier C "no headroom" note on an SDR screen.
              Always present so the grid slot is stable; its content follows the
              display. */''}
        <div class="lab-card lab-nits" data-lab-nits>
          <p class="lab-card-label">${escape(t('Headroom / nits'))}</p>
          <p class="lab-card-value" data-lab-nits-val></p>
          <p class="lab-card-note" data-lab-nits-note></p>
        </div>
        ${/* The press card. Present but hidden until a profile is mounted, so its
              slot in the grid is stable and adding one does not reflow the row's
              first three cards. Filled by renderPress(); no mounted control in it. */''}
        <div class="lab-card lab-press" data-lab-press hidden>
          <p class="lab-card-label">${escape(t('On press'))}</p>
          <p class="lab-press-name" data-lab-press-name></p>
          <p class="lab-card-value lab-press-verdict" data-lab-press-verdict></p>
          <ul class="lab-press-rows" data-lab-press-rows></ul>
          ${/* The one caveat that is genuinely essential, per card rather than
                per readout: the tolerance is a TOLERANCE, and this reader's round
                trip is markedly conservative in light yellows and deep shadows.
                The number is interpolated, not typed, because a threshold stated
                twice in two places is a threshold that will disagree with itself.

                Hidden for a matrix/TRC or gray profile: those are decided by their
                device cube, not by the round trip (iccRoundTripDecides), so the
                sentence would state a rule the verdict above it does not follow. */''}
          <p class="lab-card-note" data-lab-press-note hidden>${escape(tRaw(
            'In gamut is decided by a round trip within ΔE {tol} - a colour can pass and still shift visibly.',
            { tol: ICC_GAMUT_DELTA_E.toFixed(1) },
          ))}</p>
        </div>
      </div>
      <h3 class="lab-h3">${escape(t('Readability'))}</h3>
      <p class="lab-section-note">${escape(t('APCA first, WCAG second: APCA models polarity - light text on dark reads worse than the same pair inverted - which the WCAG ratio scores identically. Black and white are the ceiling on what the colour can carry; the third surface is yours to set.'))}</p>
      <p class="lab-section-note">${escape(t(APCA_SRGB_ONLY))}</p>
      ${/* The three cards are STABLE markup, scored in place - they are NOT rebuilt on
            every change. The third one hosts a live popover picker, and re-rendering
            the card destroyed that picker on its own first `input` event: the slider
            you were dragging vanished mid-gesture. Anything that owns a mounted
            control cannot be an innerHTML target. */''}
      <div class="lab-contrast" data-lab-contrast>
        ${contrastCardShell('white', t('White text'))}
        ${contrastCardShell('black', t('Black text'))}
        ${contrastCardShell('ink', t('Your surface'), true)}
      </div>
      <p class="lab-contrast-note" data-lab-contrast-note></p>

      ${/* A foldable diagnostic: the palette's APCA contrasts as a grid, plus a
            vision-preview toggle that recolours the grid AND the brand rail above
            and rescores every pairing for that vision. Shown only when a brand
            palette resolved (unhidden in the brand-swatch block); a palette
            diagnostic with no palette has nothing to say. Never writes a token. */''}
      <details class="lab-diag" data-lab-diag hidden>
        <summary class="lab-diag-summary">
          <h3 class="lab-h3">${escape(t('Palette contrast & vision preview'))}</h3>
          <span class="lab-diag-hint">${escape(t('An APCA grid, and how it reads for colour-vision deficiency'))}</span>
        </summary>
        <div class="lab-diag-body">
          <p class="lab-section-note">${escape(t('Every palette colour as TEXT (down the rows) over every palette colour as BACKGROUND (across the columns), plus white and black. APCA is polarity-dependent, so a cell and its mirror differ and the diagonal - a colour on itself - reads ~0. Pick a vision mode to recolour the grid and the brand rail and rescore each pairing for that vision.'))}</p>
          <div class="lab-cvd">
            <div class="view-seg lab-seg" role="group" aria-label="${escape(t('Vision preview'))}" data-lab-cvd>
              <button type="button" class="view-seg-btn" data-val="normal" aria-pressed="true">${escape(t('Normal'))}</button>
              <button type="button" class="view-seg-btn" data-val="grayscale" aria-pressed="false">${escape(t('Grayscale'))}</button>
              <button type="button" class="view-seg-btn" data-val="protan" aria-pressed="false">${escape(t('Protanopia'))}</button>
              <button type="button" class="view-seg-btn" data-val="deutan" aria-pressed="false">${escape(t('Deuteranopia'))}</button>
              <button type="button" class="view-seg-btn" data-val="tritan" aria-pressed="false">${escape(t('Tritanopia'))}</button>
            </div>
            ${/* Severity only bites the three GRADED CVD types (Machado interpolates the
                  matrices); Grayscale and Normal ignore it, so the row is hidden for them. */''}
            <label class="lab-cvd-sev" data-lab-cvd-sev hidden>
              <span class="lab-field-label">${escape(t('Severity'))}</span>
              <input type="range" class="lab-cvd-sev-input" min="0" max="100" step="5" value="100"
                data-lab-cvd-sev-input aria-label="${escape(t('Simulation severity'))}">
              <output class="lab-cvd-sev-out" data-lab-cvd-sev-out>100%</output>
            </label>
          </div>
          <div class="lab-mx" data-lab-matrix></div>
          <p class="lab-section-note lab-mx-note" data-lab-matrix-note hidden></p>
        </div>
      </details>
    </section>

    ${/* 6 · WHAT YOU ARE JUDGING IT ON. Deliberately unnumbered and last: every
          step above is something you DO to the colour, and this is the one thing
          on the page you can't change - the screen the whole page is being read
          through. It matters here more than anywhere else in the app (a P3 pixel
          on an sRGB panel is a promise the display can't keep), so the same three
          device cards the Dashboard draws sit at the foot of the tool that
          depends on them, rather than only a tab away. Same renderer, so the two
          readouts cannot drift; hidden entirely if the probe finds nothing. */''}
    <section class="lab-step-block lab-device" data-lab-device hidden>
      <h2 class="lab-h2">${escape(t('This screen'))}</h2>
      <p class="lab-section-note">${escape(t('What the charts above are being judged on. Read live from this session; nothing is stored or sent anywhere.'))}</p>
      <div class="plat-client-grid lab-device-grid" data-lab-device-grid></div>
      <p class="lab-device-more">
        <a class="lab-device-link" href="#/d?tab=device">${escape(t('Full device readout'))} →</a>
      </p>
    </section>

  </div>`;
}
