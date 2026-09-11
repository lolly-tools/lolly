// SPDX-License-Identifier: MPL-2.0
/**
 * The colour picker's space registry - what spaces exist, what channels each one
 * has, and the four generic operations the picker performs on any of them.
 *
 * Before this module the picker had one hand-written state machine for OKLCH and
 * a second, "generic" one for HSL/RGB/CMYK that round-tripped every drag through
 * an sRGB hex (`genFromHex`/`genToHex`). That round trip is why wide-gamut and
 * perceptual spaces were impossible: a `color(display-p3 1 0 0)` handed to the
 * picker came back as `#ff0b0c` and the authored colour was gone. Here a field
 * holds ONE `CssColor` and every space is data - a channel list plus, for the
 * spaces the engine has no tag for, a compose/decompose pair.
 *
 * The registry is a Map rather than a record literal so a press profile × intent
 * can be mounted at runtime (`registerColorProfile`) without an enum edit: a
 * `GamutSource`'s id already carries its intent, so profile × intent is naturally
 * one key. Nothing calls that in this pass - it is the seam, exercised by tests.
 *
 * DOM-free and dependency-free on purpose: it runs under bare `node --test`, and
 * every pure function the picker needs lives here rather than in color-field.ts.
 */

import {
  parseColor, formatColor, convertColor, colorToHexString, colorToSrgb,
  inGamut, resolveGamutSource, MISSING_C2, rgbToCmyk, cmykToRgbApprox,
  gamutTierProbe, BEYOND_TIER,
} from '@lolly/engine';
import type { CssColor, ColorSpaceTag, GamutLimit, GamutSource } from '@lolly/engine';

// ─── The mode set ─────────────────────────────────────────────────────────────

export type ColorModeFamily = 'perceptual' | 'device' | 'output';

/** The built-in spaces. Stable strings - they persist in `data-active-mode`. */
export type BuiltinColorMode =
  | 'oklch' | 'oklab' | 'lch' | 'lab' | 'xyz-d65'   // family: perceptual
  | 'hex' | 'rgb' | 'hsl'                            // family: device
  | 'display-p3' | 'rec2020' | 'cmyk';               // family: output

/** One press profile × rendering intent. Verbatim `GamutSource.id`
 *  ('icc:<sha256-prefix>:<intent>' - engine/src/gamut-source.ts). */
export type ProfileColorMode = `icc:${string}`;

export type ColorMode = BuiltinColorMode | ProfileColorMode;

/** Family order = visual order = arrow-key order. */
const FAMILY_ORDER: readonly ColorModeFamily[] = ['perceptual', 'device', 'output'];

export interface ChannelSpec {
  /** Unique within its space; the dataset key and `data-mode-ch` / `data-dial-ch` value. */
  ch: string;
  /** The row's glyph - 'L'. */
  label: string;
  /** 'Lightness' - the slider's accessible name. */
  aria: string;
  /** Range in DISPLAY units (what the slider and the readout speak). */
  min: number; max: number; step: number;
  /** display → CssColor component. Omit when identical. */
  toComp?(v: number): number;
  /** CssColor component → display. Omit when identical. */
  fromComp?(v: number): number;
  /** Readout text, display units. */
  fmt(v: number): string;
  /** Samples for the track ramp: 2 linear, 13 hue, up to 24 curved. */
  stops: number;
  /** A genuine hue axis - only these have no 12-o'clock seam on a dial. */
  circular?: boolean;
  /** This channel is the space's hue → powerless-hue memory applies. */
  hue?: boolean;
  /**
   * Rewrite the values the OTHER channels are held at while THIS channel's ramp
   * is sampled - for painting only, never for the gamut test. OKLCH's hue floors
   * chroma so the sweep is still visible when the colour is near grey.
   */
  hold?(vals: Record<string, number>): Record<string, number>;
}

export interface SpaceSpec {
  mode: ColorMode;
  family: ColorModeFamily;
  /** 'OKLCH' - the tab's pill text. */
  label: string;
  /** 'reference' | 'Coated FOGRA39 · perceptual'. */
  sub?: string;
  /** Extra words for the tab's aria-label, after the family. */
  ariaSuffix?: string;
  /** The engine space the channels live in; null = pseudo-space (compose/decompose own it). */
  tag: ColorSpaceTag | null;
  channels: readonly ChannelSpec[];
  /** What the broken track and the out-of-gamut caution are measured against. */
  limit: GamutLimit;
  /** Bounded-space check for the exact/approximated badge, in CssColor units. Omit = unbounded. */
  bounds?: readonly (readonly [number, number])[];
  /** Space the bounds are expressed in, when it is not `tag` (a pseudo-space's is). */
  boundsIn?: ColorSpaceTag;
  /** Only pseudo-spaces override these two. */
  compose?(vals: Record<string, number>, alpha: number): CssColor;
  decompose?(c: CssColor): Record<string, number>;
  /** Value-field notation + parse. Default: formatColor/parseColor via `tag`. */
  text?(c: CssColor): string;
  /**
   * Value-field notation from the PANEL's own display values, for a space whose
   * conversion is many-to-one: CMYK's c=m=y=100 composes to black, which decomposes
   * back as k=100, so `text` (a fresh decomposition) would state a different ink
   * split from the sliders the user just dragged. Where this exists the picker
   * prefers it while the panel holds cached values.
   */
  textFrom?(vals: Record<string, number>, alpha: number): string;
  parse?(raw: string): CssColor | null;
  /** CSS for one gradient stop. Default: formatColor(c) in the colour's own space. */
  stopCss?(c: CssColor): string;
}

// ─── Channel-spec helpers ─────────────────────────────────────────────────────

const deg = (v: number): string => `${Math.round(v)}°`;
const pct = (v: number): string => `${Math.round(v)}%`;
const int = (v: number): string => `${Math.round(v)}`;
const dp3 = (v: number): string => v.toFixed(3);

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** At most two decimals, no trailing zeros - a byte-exact colour reads as `48`. */
const short = (v: number): string => String(Math.round(v * 100) / 100);

/** ` / 0.5`, or '' for an opaque colour. */
const alphaPart = (a: number): string => (a < 1 ? ` / ${Math.round(a * 1000) / 1000}` : '');

/** A 0–255 display channel over a 0–1 component - the RGB spaces' three. */
const rgbChannels = (): ChannelSpec[] => [
  { ch: 'r', label: 'R', aria: 'Red', min: 0, max: 255, step: 1, toComp: v => v / 255, fromComp: v => v * 255, fmt: int, stops: 2 },
  { ch: 'g', label: 'G', aria: 'Green', min: 0, max: 255, step: 1, toComp: v => v / 255, fromComp: v => v * 255, fmt: int, stops: 2 },
  { ch: 'b', label: 'B', aria: 'Blue', min: 0, max: 255, step: 1, toComp: v => v / 255, fromComp: v => v * 255, fmt: int, stops: 2 },
];

// ─── The registry ─────────────────────────────────────────────────────────────

const SPACES = new Map<ColorMode, SpaceSpec>();

const register = (spec: SpaceSpec): void => { SPACES.set(spec.mode, spec); };

const SRGB_CUBE: readonly (readonly [number, number])[] = [[0, 1], [0, 1], [0, 1]];

// Perceptual - "describes the colour itself, independent of any device". XYZ is
// linear-light rather than perceptual, but it answers that same question, so it
// sits here with the sublabel "reference" instead of earning a fourth family.
// None of these are bounded, so a wide-gamut colour is EXACT in all of them - 
// which is the whole reason the picker now keeps one CssColor.

// OKLCH samples at the 24-stop ceiling rather than the 9/9/13 its smooth
// full-range ramp used: it is the one UNBOUNDED space whose tracks break against
// sRGB, and at 9 samples a run's edge lands up to 12.5% of the track away from
// the truth - for #30ba78 the lightness axis holds its chroma from L 65% to 96%
// but a 9-sample scan reports 75%–87.5%, hiding displayable colour. The other
// spaces keep cheap stop counts because their tracks cannot break (an in-range
// sRGB/P3/Rec.2020 component is by definition inside that gamut).
register({
  mode: 'oklch', family: 'perceptual', label: 'OKLCH', tag: 'oklch', limit: 'srgb',
  channels: [
    { ch: 'l', label: 'L', aria: 'Lightness', min: 0, max: 100, step: 0.5, toComp: v => v / 100, fromComp: v => v * 100, fmt: pct, stops: 24 },
    { ch: 'c', label: 'C', aria: 'Chroma', min: 0, max: 0.4, step: 0.004, fmt: dp3, stops: 24 },
    {
      ch: 'h', label: 'H', aria: 'Hue', min: 0, max: 360, step: 1, fmt: deg, stops: 24,
      circular: true, hue: true,
      hold: v => ({ ...v, c: Math.max(v.c ?? 0, 0.08) }),
    },
  ],
});

register({
  mode: 'oklab', family: 'perceptual', label: 'OKLab', tag: 'oklab', limit: 'srgb',
  channels: [
    { ch: 'l', label: 'L', aria: 'Lightness', min: 0, max: 100, step: 0.5, toComp: v => v / 100, fromComp: v => v * 100, fmt: pct, stops: 2 },
    { ch: 'a', label: 'a', aria: 'Green to red', min: -0.4, max: 0.4, step: 0.002, fmt: dp3, stops: 24 },
    { ch: 'b', label: 'b', aria: 'Blue to yellow', min: -0.4, max: 0.4, step: 0.002, fmt: dp3, stops: 24 },
  ],
});

// CIELAB-D50 LCH. NOTE the collision: `StorageFormat`'s 'lch' (lib/color-formats.ts)
// means OKLCH, this one means CIELAB LCH - two different colours behind one
// four-letter string. Nothing here converts between them, but wiring a picker mode
// id straight into a token's storage format would produce silently wrong colours.
register({
  mode: 'lch', family: 'perceptual', label: 'LCH', tag: 'lch', limit: 'srgb',
  channels: [
    { ch: 'l', label: 'L', aria: 'Lightness', min: 0, max: 100, step: 0.5, fmt: pct, stops: 2 },
    { ch: 'c', label: 'C', aria: 'Chroma', min: 0, max: 150, step: 0.5, fmt: int, stops: 24 },
    { ch: 'h', label: 'H', aria: 'Hue', min: 0, max: 360, step: 0.5, fmt: deg, stops: 24, circular: true, hue: true },
  ],
});

register({
  mode: 'lab', family: 'perceptual', label: 'Lab', tag: 'lab', limit: 'srgb',
  channels: [
    { ch: 'l', label: 'L', aria: 'Lightness', min: 0, max: 100, step: 0.5, fmt: pct, stops: 2 },
    { ch: 'a', label: 'a', aria: 'Green to red', min: -125, max: 125, step: 0.5, fmt: int, stops: 24 },
    { ch: 'b', label: 'b', aria: 'Blue to yellow', min: -125, max: 125, step: 0.5, fmt: int, stops: 24 },
  ],
});

// The three maxima are D65 white's own tristimulus values, to enough digits that
// white itself lands INSIDE the axis: rounded to 1.089, Z's ceiling sits below the
// 1.08905775 plain white converts to, and the picker then cautioned that white was
// outside XYZ.
register({
  mode: 'xyz-d65', family: 'perceptual', label: 'XYZ', sub: 'reference', tag: 'xyz-d65', limit: 'srgb',
  channels: [
    { ch: 'x', label: 'X', aria: 'X tristimulus', min: 0, max: 0.95046, step: 0.002, fmt: dp3, stops: 24 },
    { ch: 'y', label: 'Y', aria: 'Y tristimulus (luminance)', min: 0, max: 1, step: 0.002, fmt: dp3, stops: 24 },
    { ch: 'z', label: 'Z', aria: 'Z tristimulus', min: 0, max: 1.08906, step: 0.002, fmt: dp3, stops: 24 },
  ],
});

// Device - the sRGB notations. Bounded, so a wider colour reads "approximated".

register({
  mode: 'hex', family: 'device', label: 'HEX', tag: 'srgb', limit: 'srgb',
  channels: rgbChannels(),                 // hex has no sliders of its own
  bounds: SRGB_CUBE,
  text: c => colorToHexString(c),
  // A user pasting a hex usually omits the '#'; everything else falls through to
  // the full CSS parser in spaceParse.
  parse: raw => parseColor(/^[0-9a-f]{3,8}$/i.test(raw.trim()) ? `#${raw.trim()}` : raw),
});

/** The sliders' own units - 0–255 per channel, in the legacy CSS form. Left
 *  UNCLAMPED on purpose: `rgb()` parses an out-of-range component as-is, so this
 *  states exactly what the readouts beside the sliders state and reads back as the
 *  same colour. The default (`formatColor(convertColor(c,'srgb'))`) would speak
 *  0–1 fractions while the sliders speak 0–255 - one colour, two unit systems in
 *  one panel. */
const rgbText = (c: CssColor): string => {
  const s = convertColor(c, 'srgb');
  const [r, g, b] = s.components;
  return `rgb(${short(r * 255)} ${short(g * 255)} ${short(b * 255)}${alphaPart(s.alpha)})`;
};

register({
  mode: 'rgb', family: 'device', label: 'RGB', tag: 'srgb', limit: 'srgb',
  channels: rgbChannels(), bounds: SRGB_CUBE,
  text: rgbText,
});

/** HSL's saturation, CLAMPED for display. The engine's srgbToHsl reports the true
 *  (possibly >100%) saturation of a wider colour, but `hsl()` is legacy syntax and
 *  clamps s/l on the way back in - so writing the unclamped number would put a
 *  string in the field that no consumer, this one included, resolves to the colour
 *  shown. Same convention as HEX: the text says what this space can actually say,
 *  and the caution line says it is outside sRGB. The COLOUR is untouched. */
const hslText = (c: CssColor): string => {
  const h = convertColor(c, 'hsl');
  const cl = (v: number): number => Math.min(100, Math.max(0, v));
  return formatColor({ ...h, components: [h.components[0] ?? 0, cl(h.components[1] ?? 0), cl(h.components[2] ?? 0)] });
};

register({
  mode: 'hsl', family: 'device', label: 'HSL', tag: 'hsl', limit: 'srgb',
  text: hslText,
  channels: [
    { ch: 'h', label: 'H', aria: 'Hue', min: 0, max: 360, step: 1, fmt: deg, stops: 13, circular: true, hue: true },
    { ch: 's', label: 'S', aria: 'Saturation', min: 0, max: 100, step: 1, fmt: pct, stops: 2 },
    { ch: 'l', label: 'L', aria: 'Lightness', min: 0, max: 100, step: 1, fmt: pct, stops: 3 },
  ],
  // HSL's own components go out of range for a wider colour in ways that are hard
  // to read (saturation past 100); the honest question is whether sRGB holds it.
  bounds: SRGB_CUBE, boundsIn: 'srgb',
});

// Output - what a device or a press can actually put down.

register({
  mode: 'display-p3', family: 'output', label: 'P3', tag: 'display-p3', limit: 'p3',
  channels: rgbChannels(), bounds: SRGB_CUBE,
});

register({
  mode: 'rec2020', family: 'output', label: 'Rec.2020', tag: 'rec2020', limit: 'rec2020',
  channels: rgbChannels(), bounds: SRGB_CUBE,
});

const CMYK_CHANNELS: readonly ChannelSpec[] = [
  { ch: 'c', label: 'C', aria: 'Cyan', min: 0, max: 100, step: 1, fmt: pct, stops: 7 },
  { ch: 'm', label: 'M', aria: 'Magenta', min: 0, max: 100, step: 1, fmt: pct, stops: 7 },
  { ch: 'y', label: 'Y', aria: 'Yellow', min: 0, max: 100, step: 1, fmt: pct, stops: 7 },
  { ch: 'k', label: 'K', aria: 'Black', min: 0, max: 100, step: 1, fmt: pct, stops: 7 },
];

/** Four ink percentages → an sRGB CssColor, via the engine's naive substitution. */
function cmykCompose(vals: Record<string, number>, alpha: number): CssColor {
  const [r, g, b] = cmykToRgbApprox([
    (vals.c ?? 0) / 100, (vals.m ?? 0) / 100, (vals.y ?? 0) / 100, (vals.k ?? 0) / 100,
  ]);
  return { space: 'srgb', components: [r, g, b], alpha, missing: 0 };
}

function cmykDecompose(c: CssColor): Record<string, number> {
  const [ci, mi, yi, ki] = rgbToCmyk(...colorToSrgb(c));
  return { c: ci * 100, m: mi * 100, y: yi * 100, k: ki * 100 };
}

/** `cmyk(62% 23% 0% 38%)` - the alpha rides along, because text copied out of the
 *  value field is the one place the field's opacity would otherwise be dropped. */
const cmykTextFrom = (vals: Record<string, number>, alpha: number): string =>
  `cmyk(${['c', 'm', 'y', 'k'].map(k => `${Math.round(vals[k] ?? 0)}%`).join(' ')}${alphaPart(alpha)})`;

const cmykText = (c: CssColor): string => cmykTextFrom(cmykDecompose(c), c.alpha);

// CMYK survives the profile work rather than being deleted with it - the brand
// editor reads CMYK today - but it is APPROXIMATE, and in this vocabulary a NAME
// is the claim: a measured target carries a profile's own name and an intent
// ('Coated FOGRA39 · relative'), a derived one carries a standard's name ('sRGB'),
// and an approximate one carries no name at all. Beside a named profile tab, a
// bare `CMYK` already reads as unqualified - so the distinction survives for
// screen readers (`ariaSuffix`) and disappears as visual noise, which is what the
// old visible 'uncalibrated' sublabel had become.
register({
  mode: 'cmyk', family: 'output', label: 'CMYK', ariaSuffix: 'no profile', tag: null, limit: 'srgb',
  channels: CMYK_CHANNELS,
  bounds: SRGB_CUBE, boundsIn: 'srgb',
  compose: cmykCompose, decompose: cmykDecompose,
  text: cmykText, textFrom: cmykTextFrom,
  stopCss: c => colorToHexString(c),
});

/**
 * The profile's OWN transform, both ways, in PCS Lab and 0–1 device channels.
 *
 * A profile tab is registered only where this exists, because the tab wears the
 * profile's name and an intent - and a name is the claim. Numbers published under
 * 'Coated FOGRA39 · relative' have to come out of that file's tables; anything
 * else is the bare, deliberately unnamed CMYK tab's job.
 */
export interface ProfileDevice {
  /** Device channels (0–1, in `inks` order) → PCS Lab. Null when it cannot. */
  toLab(dev: readonly number[]): [number, number, number] | null;
  /** PCS Lab → device channels (0–1, in `inks` order). Null when it cannot. */
  fromLab(lab: readonly [number, number, number]): number[] | null;
}

export interface ProfileSpaceOpts extends Partial<SpaceSpec> {
  /** The profile's own data colour space - 'CMYK', 'RGB', 'Lab'. Names the tab. */
  space?: string;
}

/** `device(0.62 0.23 0.00 0.38)` - the notation a non-CMYK ink set gets, rather
 *  than a syntax invented for the occasion. Matches the Colour Lab's press row. */
const deviceTextFrom = (inks: readonly ChannelSpec[]) =>
  (vals: Record<string, number>, _alpha: number): string =>
    `device(${inks.map(i => ((vals[i.ch] ?? 0) / 100).toFixed(2)).join(' ')})`;

/**
 * Mount one press profile × rendering intent as a tab. `src.id` already carries
 * the intent, so a second intent for the same profile is simply a second key and
 * nothing here changes. `SpaceSpec.limit` is the source itself, which is what
 * makes the broken tracks and the ink-coverage caution work on a press profile
 * with no extra code path.
 *
 * `device` is REQUIRED, and that is the whole point: the tab converts through the
 * profile's own tables under the named intent, so the numbers it shows are the
 * same ones the Colour Lab's press notation row prints. It used to compose
 * through the naive sRGB substitution the bare CMYK tab uses - which published an
 * approximation under a measured profile's name, contradicted the press row on
 * the same page, and, for any ink count other than four, threw the channel values
 * away and returned black on the first arrow key.
 *
 * `space` names the tab: 'CMYK' for a four-ink CMYK profile, 'RGB' for a monitor
 * profile, and so on. Never a blanket 'CMYK' - a three-channel RGB profile
 * labelled CMYK is a false claim about the file.
 */
export function registerColorProfile(
  src: GamutSource,
  inks: readonly ChannelSpec[],
  device: ProfileDevice,
  opts: ProfileSpaceOpts = {},
): void {
  const { space, ...extra } = opts;
  const intent = src.id.split(':')[2] ?? '';
  const base = src.label.replace(/\s*\([^)]*\)\s*$/, '');
  const inkKeys = inks.map(i => i.ch).join(',');
  const name = (space ?? (inkKeys === 'c,m,y,k' ? 'CMYK' : '')).trim();
  const four = inks.length === 4 && name.toUpperCase() === 'CMYK';

  /** Display percentages → the profile's Lab, as a CssColor in `lab()`. */
  const compose = (vals: Record<string, number>, alpha: number): CssColor => {
    const dev = inks.map(i => clamp01((vals[i.ch] ?? 0) / 100));
    const lab = device.toLab(dev);
    // A transform that declines mid-drag must not destroy the colour: black is
    // the wrong answer to "we could not convert". Fall back to the neutral axis
    // at the requested lightness rather than inventing a hue.
    if (!lab) return { space: 'srgb', components: [0, 0, 0], alpha, missing: 0 };
    return { space: 'lab', components: [lab[0], lab[1], lab[2]], alpha, missing: 0 };
  };
  const decompose = (c: CssColor): Record<string, number> => {
    const lab = convertColor(c, 'lab').components as [number, number, number];
    const dev = device.fromLab(lab);
    return Object.fromEntries(inks.map((i, n) => [i.ch, clamp01(dev?.[n] ?? 0) * 100]));
  };
  const textFrom = four ? cmykTextFrom : deviceTextFrom(inks);

  register({
    mode: src.id as ProfileColorMode,
    family: 'output',
    label: name || 'Device',
    sub: intent ? `${base} · ${intent}` : base,
    ariaSuffix: intent ? `${base}, ${intent} intent` : base,
    tag: null,
    channels: inks,
    limit: src,
    compose,
    decompose,
    text: c => textFrom(decompose(c), c.alpha),
    textFrom,
    stopCss: c => colorToHexString(c),
    ...extra,
  });
}

/** Unmount a profile tab. Stored overrides keyed on the same id are untouched. */
export function unregisterColorProfile(id: string): void {
  if (id.startsWith('icc:')) SPACES.delete(id as ProfileColorMode);
}

/** Built-ins ∪ profiles, in family order (which is tab order and arrow order). */
export function colorSpaces(): readonly SpaceSpec[] {
  const out: SpaceSpec[] = [];
  for (const family of FAMILY_ORDER) {
    for (const spec of SPACES.values()) if (spec.family === family) out.push(spec);
  }
  return out;
}

/** One space by mode, or undefined (an unmounted profile, or junk in a URL). */
export function getColorSpace(mode: string): SpaceSpec | undefined {
  return SPACES.get(mode as ColorMode);
}

/** Familiar HSL controls first; perceptual OKLCH is one tab away. */
export const DEFAULT_COLOR_MODE: ColorMode = 'hsl';

/**
 * A mode id as an HTML id fragment. Profile ids contain colons, which are legal
 * in an `id` but hostile in a selector, so every non-alphanumeric becomes a dash:
 * 'icc:ab12cd:perceptual' → 'icc-ab12cd-perceptual'.
 */
export function slugMode(mode: string): string {
  return String(mode).toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

// ─── The four generics ────────────────────────────────────────────────────────

const identity = (v: number): number => v;

/** Display values → one CssColor. The ONLY way a drag produces a colour: there
 *  is no hex in this path, which is what kills the old genFromHex/genToHex spine. */
export function composeColor(spec: SpaceSpec, vals: Record<string, number>, alpha: number): CssColor {
  const a = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1;
  if (spec.compose) return spec.compose(vals, a);
  const comps = spec.channels.map(c => {
    const raw = vals[c.ch];
    const v = Number.isFinite(raw) ? raw! : c.min;
    return (c.toComp ?? identity)(v);
  });
  return {
    space: spec.tag!,
    components: [comps[0] ?? 0, comps[1] ?? 0, comps[2] ?? 0],
    alpha: a,
    missing: 0,
  };
}

/**
 * One CssColor → this space's display values.
 *
 * `lastHue` stands in for any hue channel the conversion reports as POWERLESS
 * (grey has no hue, so `convertColor` marks it missing). Reading the hue back out
 * of an achromatic conversion instead is the low-chroma hue drift - a near-grey's
 * hue wandering as you drag lightness - and it is now impossible in EVERY space
 * with a hue, not just OKLCH.
 */
export function decomposeColor(spec: SpaceSpec, canonical: CssColor, lastHue: number): Record<string, number> {
  if (spec.decompose) return spec.decompose(canonical);
  const conv = convertColor(canonical, spec.tag!);
  const out: Record<string, number> = {};
  spec.channels.forEach((c, i) => {
    const powerless = c.hue && (conv.missing & (1 << i)) !== 0;
    out[c.ch] = powerless ? lastHue : (c.fromComp ?? identity)(conv.components[i] ?? 0);
  });
  return out;
}

/** The CSS for one stop of a track/dial ramp. */
function stopCss(spec: SpaceSpec, c: CssColor): string {
  return spec.stopCss ? spec.stopCss(c) : formatColor(c);
}

/**
 * One contiguous equal-tier stretch of a channel's axis, in 0–1 track fractions.
 *
 * `tier` 0 is inside `spec.limit`; 1.. are the rings out (the gamut reachable one
 * step wider, then the one after that); {@link BEYOND_TIER} is the stretch no
 * display gamut holds. The runs cover [0,1] by construction - adjacent runs share
 * their boundary fraction exactly.
 */
export interface ChannelRun { from: number; to: number; stops: string[]; tier: number }

/**
 * Every run along one channel - reachable AND not - with the other channels held.
 *
 * The generalisation of lib/gamut-slider.ts's `gamutRuns` to any space and any
 * gamut limit, including a press profile (a `GamutSource` is a valid limit). The
 * tier-0 runs paint solid, so the layout of the track still says where you can
 * actually go; the rest paint as washes of decreasing opacity as they go up gamuts
 * (color-field.ts's `runParts`), so an unreachable stretch reads as "the axis
 * continues, your limit cannot reach it" instead of as a hole. A two-stop gradient
 * across the whole axis would instead go flat wherever the colours all map to the
 * same boundary colour, which looks like a rendering bug and hides the information.
 *
 * The gamut test uses the TRUE held values; only the painted colour takes
 * `ChannelSpec.hold` (OKLCH's hue floors chroma so its sweep stays visible at
 * grey - a display trick that must not invent gamut gaps).
 *
 * Three cost decisions, because this runs for every channel of the mounted space
 * on every colour change (`paintTracks`, rAF-coalesced):
 *
 * - a probe is ONE `composeColor` + ONE `convertColor` to oklch, then the hoisted
 *   membership tests inside `gamutTierProbe`. Calling `inGamut` once per tier
 *   instead needs 243 membership calls per OKLCH panel against this version's 121,
 *   and measures 87.7 µs against 82.5. Worth having, but note how SMALL that gap
 *   is: the conversion dominates, so the way to make this cheaper is fewer probes,
 *   never a cheaper membership test.
 * - a wash carries at most 3 stops (start, mid, end): it is a faint low-contrast
 *   band, and 24 `formatColor` calls across it buy nothing (88.8 µs with full
 *   stops, ~8%).
 * - a boundary is refined ONCE and shared by the two runs it separates, which
 *   roughly halves the halvings AND keeps the runs exactly contiguous. Refining
 *   each run's own edges independently lands the two estimates up to a tolerance
 *   apart, and CSS then interpolates an alpha fade across that sliver - blurring
 *   the very edge the bisection exists to sharpen. This one is for correctness
 *   first; the probes it saves are a bonus.
 * - the refinement is where structure is DISCOVERED, so the blind sweep can stay
 *   coarse: a halving that lands on a third tier has found a band the sweep stepped
 *   over, and recursing into both halves costs only where there was something to
 *   find. Raising the sweep to catch the same bands instead would pay on every
 *   channel of every space.
 *
 * Measured per full panel repaint - all channels of one space, 3000 iterations,
 * node 24, seed `oklch(62% 0.19 260)` - in µs and in probes, against the earlier
 * version of this function that classified from the paint grid alone: OKLCH 83 → 108
 * (121 → 150), OKLab 100 → 111, XYZ 90 → 110 (116 → 147), Lab 66 → 111 (80 → 141),
 * LCH 56 → 112 (77 → 126), HSL 23 → 29 (31), CMYK 13 → 18 (36), HEX/RGB/P3 8.6 →
 * 14.6 (6 → 27). The bounded spaces move now where they did not before, and that is
 * the fix: their `stops: 2` channels used to be classified from two endpoint samples,
 * so their rings were mispositioned by up to 25% of the track or lost entirely.
 * Worst measured single channel is 67 probes; the ceiling is `m` sweep samples
 * (≤ 24) + MAX_REFINE_PROBES → 72. Worst full panel across every space and a spread
 * of seeds: 118 µs.
 *
 * `paintTracks` is rAF-coalesced and skips the channel being dragged, so a drag
 * frame repaints 2 of 3 axes ≈ 75 µs: 0.45% of a 16.7 ms frame.
 */

/**
 * Tolerance at a boundary that touches tier 0 - the reachable edge, which is the
 * information. Sampling alone leaves it short by up to one whole step (4.3% of the
 * track at 24 stops), enough to leave the thumb in a gap while the caution line
 * calls the colour exact. 0.15% of the track is a boundary the eye cannot fault.
 *
 * A TOLERANCE, not a halving count, and that distinction is a bug fixed rather than
 * a preference: a fixed count only bounds the error if the bracket width is fixed
 * too. It is not - a channel with `stops: 2` (the hex/RGB/P3/Rec.2020 components,
 * Lab/LCH/OKLab L, HSL S: 15 channels across 8 of the 11 registered spaces) samples
 * only frac 0 and 1, so its one interior bracket is the WHOLE axis. Two halvings of
 * that leave the edge off by up to 25% of the track, and when the true boundary sits
 * in the far quarter the keep side never moves at all, so the run came back
 * `from === to` - the ring was computed and then painted as nothing. Halving until
 * the bracket is under a tolerance cannot do that, whatever the bracket started at.
 */
const EDGE_TOL = 0.0015;

/** Tolerance between two washes. A wash edge is decoration, so 1% of the track is
 *  plenty - but it still has to be a tolerance (see EDGE_TOL). */
const OUTER_TOL = 0.01;

/** Halvings ceiling per bracket, so a pathological tolerance cannot spin. A whole
 *  axis (bracket 1) reaches EDGE_TOL in 10 and OUTER_TOL in 7. */
const MAX_DEPTH = 12;

/** Ceiling on the halvings spent refining ONE channel, whatever structure it has. The
 *  explicit bound on the added work: a high-chroma hue axis can cross tiers a dozen
 *  times, and each crossing is a bracket. Past it the remaining boundaries stand where
 *  the last halving left them (error ≤ that bracket, never a collapsed run). */
const MAX_REFINE_PROBES = 48;

/**
 * Floor on the tier SWEEP, independent of how many stops a channel paints.
 *
 * `stops` says how finely a ramp needs painting; it says nothing about how finely the
 * axis crosses gamuts. Two samples cannot see structure at all, so a `stops: 2`
 * channel (15 of them across 8 of the 11 registered spaces, including both default
 * device tabs) was classified from its two endpoints: LCH L at `oklch(62% 0.19 260)`
 * truly carries seven bands and reported four. The sweep only has to bracket a
 * CHANGE - the refinement below finds bands hidden inside a bracket - so 9 is enough
 * wherever the endpoints of some step differ. A band between two same-tier samples is
 * still invisible, deliberately: see the sub-sample note in engine/src/gamut-tier.ts,
 * and note that a finer blind sweep pays on every channel to catch it.
 */
const TIER_SAMPLES_MIN = 9;

/**
 * Narrowness rank for "bisect from the narrower tier's side", so `crossing` always
 * belongs to the narrower tier.
 *
 * At a tier-0 boundary that is the original invariant verbatim - tier 0 never
 * claims a colour the limit cannot show, and the wash beside it overstates its
 * reach by at most one tolerance, which is the right direction for a hint.
 * BEYOND_TIER is numerically the lowest but describes the WIDEST region (no gamut
 * at all), so it ranks last rather than first.
 */
const narrowness = (tier: number): number => (tier === BEYOND_TIER ? Number.POSITIVE_INFINITY : tier);

export function channelRuns(
  spec: SpaceSpec,
  ch: ChannelSpec,
  vals: Record<string, number>,
  alpha = 1,
): ChannelRun[] {
  // Two grids, deliberately: `n` is how many stops a solid ramp is worth painting,
  // `m` is how finely the axis is asked WHERE it changes tier. They were one number,
  // which is how a 2-stop channel ended up classified from its two endpoints.
  const n = Math.max(2, Math.min(24, Math.round(ch.stops)));
  const m = Math.max(n, TIER_SAMPLES_MIN);
  const held = ch.hold ? ch.hold(vals) : vals;
  const valueAt = (frac: number): number => ch.min + frac * (ch.max - ch.min);
  const tierAt = gamutTierProbe(spec.limit);
  const tierOf = (frac: number): number => {
    const probe = convertColor(composeColor(spec, { ...vals, [ch.ch]: valueAt(frac) }, alpha), 'oklch');
    return tierAt(probe.components[0]!, probe.components[1]!, probe.components[2]!);
  };
  const paintAt = (frac: number): string =>
    stopCss(spec, composeColor(spec, { ...held, [ch.ch]: valueAt(frac) }, alpha));

  // 1. Tiers only - the stop colours are computed once the boundaries are known, so a
  //    wash never pays for the samples it will not paint. The parts list is built left
  //    to right and each part is closed by the next one's opening fraction, so the runs
  //    are contiguous BY CONSTRUCTION rather than by two estimates agreeing.
  const parts: { tier: number; from: number; to: number }[] = [];
  const open = (tier: number, frac: number): void => {
    const last = parts[parts.length - 1];
    if (!last) { parts.push({ tier, from: 0, to: 1 }); return; }
    if (last.tier === tier) return;                       // the same band continues
    last.to = frac;
    parts.push({ tier, from: frac, to: 1 });
  };
  let budget = MAX_REFINE_PROBES;

  /**
   * Locate the crossing(s) between two probed fractions of different tier, opening a
   * part for every band found on the way.
   *
   * Halving to a TOLERANCE, not a fixed count: a count only bounds the error when the
   * bracket width is fixed, and here it is one sample step on a 24-stop channel and
   * the whole axis on a 2-stop one (which is how a ring came back `from === to` and
   * painted as nothing). And when a halving lands on a THIRD tier, that is a band the
   * sweep stepped over: recurse into both halves rather than discard the probe, which
   * is what lets a 9-sample sweep resolve a 7-band LCH lightness axis.
   */
  const scan = (
    loFrac: number, loTier: number, hiFrac: number, hiTier: number, depth: number, found = false,
  ): void => {
    // A band the sweep stepped over is, by definition, narrower than the bracket that
    // hid it, so a 1% wash tolerance can land BOTH of its boundaries on one fraction - 
    // the collapsed run again. Once a third tier turns up, its edges get the tight
    // tolerance; the cost is paid only where structure was actually found.
    const tol = loTier === 0 || hiTier === 0 || found ? EDGE_TOL : OUTER_TOL;
    if (hiFrac - loFrac > tol && depth > 0 && budget > 0) {
      budget--;
      const midFrac = (loFrac + hiFrac) / 2;
      const midTier = tierOf(midFrac);
      if (midTier === loTier) { scan(midFrac, midTier, hiFrac, hiTier, depth - 1, found); return; }
      if (midTier === hiTier) { scan(loFrac, loTier, midFrac, midTier, depth - 1, found); return; }
      scan(loFrac, loTier, midFrac, midTier, depth - 1, true);
      scan(midFrac, midTier, hiFrac, hiTier, depth - 1, true);
      return;
    }
    // Inside the tolerance: the boundary is the endpoint held by the NARROWER tier, so
    // tier 0 never claims a colour the limit cannot show and the wash beside it
    // overstates its reach by at most one tolerance - the right direction for a hint.
    open(hiTier, narrowness(loTier) <= narrowness(hiTier) ? loFrac : hiFrac);
  };

  // The sweep, taken whole before any refinement so each crossing can see whether the
  // band on EITHER side spans a single sample - one that does is as narrow as a
  // mid-bracket discovery and gets the same tight tolerance, or its two boundaries both
  // round to that one sample's fraction and the run collapses.
  const sweep: number[] = [];
  for (let i = 0; i < m; i++) sweep.push(tierOf(i / (m - 1)));
  const spansOneSample = (i: number): boolean =>
    sweep[i] !== sweep[i - 1] && sweep[i] !== sweep[i + 1];   // undefined at the ends: never equal
  open(sweep[0]!, 0);
  for (let i = 1; i < m; i++) {
    if (sweep[i] === sweep[i - 1]) continue;
    const thin = spansOneSample(i - 1) || spansOneSample(i);
    scan((i - 1) / (m - 1), sweep[i - 1]!, i / (m - 1), sweep[i]!, MAX_DEPTH, thin);
  }

  // 2. Colours. A tier-0 run keeps roughly the `stops` density its channel asked for,
  //    spread across its own stretch (`runParts` positions them that way, so reading
  //    them off the sweep grid instead put each colour slightly beside its own
  //    fraction); a wash gets start/mid/end and no more.
  return parts.map((p) => {
    const { from, to } = p;
    const stops: string[] = [];
    if (p.tier === 0) {
      const count = Math.max(2, Math.round((to - from) * (n - 1)) + 1);
      for (let k = 0; k < count; k++) stops.push(paintAt(from + ((to - from) * k) / (count - 1)));
    } else {
      const seen = new Set<number>();
      for (const f of [from, (from + to) / 2, to]) if (!seen.has(f)) { seen.add(f); stops.push(paintAt(f)); }
    }
    return { from, to, stops, tier: p.tier };
  });
}

/** Slack on a range test: conversion float noise, not a real excursion. Relative to
 *  the channel's own range so it means the same thing on a 0–255 axis and a 0–0.4
 *  one. `BOUNDS_SLACK` below is the same idea in component units - the two
 *  disagreeing is what made plain white report "Outside Lab". */
const RANGE_SLACK = 1e-6;

/**
 * A display value pinned into its slider's range - `convertColor` leaves RGB
 * components unclamped (P3 red is `color(rec2020 0.869 0.175 -0.005)`), so a
 * decomposed value can genuinely fall outside the axis. The slider goes to the
 * edge; the COLOUR is never rewritten, because looking at a colour in a narrower
 * space must not alter it.
 */
export function pinValue(ch: ChannelSpec, v: number): { at: number; pinned: boolean } {
  if (!Number.isFinite(v)) return { at: ch.min, pinned: false };
  const slack = Math.abs(ch.max - ch.min) * RANGE_SLACK;
  if (v < ch.min - slack) return { at: ch.min, pinned: true };
  if (v > ch.max + slack) return { at: ch.max, pinned: true };
  return { at: Math.min(ch.max, Math.max(ch.min, v)), pinned: false };
}

/** The value field's text for this colour in this space. */
export function spaceText(spec: SpaceSpec, c: CssColor): string {
  if (spec.text) return spec.text(c);
  return formatColor(convertColor(c, spec.tag!));
}

// A bare component list - '62% 0.11 250', '255, 0, 0', '40, 0, 30, 10 / 0.5' - 
// in the space's own DISPLAY units. This is the notation the picker's value field
// spoke before it spoke full CSS, and people have it in muscle memory.
const BARE = /^[\d\s.,%/+-]+$/;

function bareComponents(spec: SpaceSpec, raw: string): CssColor | null {
  if (!BARE.test(raw)) return null;
  const slash = raw.split('/');
  if (slash.length > 2) return null;
  const nums = (slash[0]!.match(/[+-]?\d*\.?\d+/g) ?? []).map(Number);
  if (nums.length !== spec.channels.length || nums.some(n => !Number.isFinite(n))) return null;
  const alphaNums = slash.length === 2 ? (slash[1]!.match(/[+-]?\d*\.?\d+/g) ?? []).map(Number) : [];
  const alpha = alphaNums.length === 1
    ? (/%/.test(slash[1]!) ? alphaNums[0]! / 100 : alphaNums[0]!)
    : 1;
  const vals: Record<string, number> = {};
  spec.channels.forEach((c, i) => { vals[c.ch] = nums[i]!; });
  return composeColor(spec, vals, alpha);
}

/**
 * Parse whatever the user typed into the value field: this space's own notation
 * first, then a bare component list in its display units, then the full CSS
 * parser. The last step is the point - a hex pasted while OKLCH is active, or an
 * `oklch()`/`color(display-p3 …)` pasted anywhere, must land rather than be
 * silently held as unparseable.
 */
export function spaceParse(spec: SpaceSpec, raw: string): CssColor | null {
  const s = String(raw).trim();
  if (!s) return null;
  if (spec.parse) { const own = spec.parse(s); if (own) return own; }
  const bare = bareComponents(spec, s);
  if (bare) return bare;
  const css = parseColor(s);
  if (css) return css;
  // A space with no CSS notation of its own writes `cmyk(40% 0% 30% 10%)`. Accept
  // its own output back by unwrapping the label the engine cannot parse.
  const fn = /^[a-z][a-z0-9-]*\((.*)\)$/i.exec(s);
  return fn ? bareComponents(spec, fn[1]!) : null;
}

/**
 * Did the text the user typed state an alpha of its own?
 *
 * The parsed colour cannot answer this: every parser defaults a missing alpha to 1,
 * so `alpha === 1` covers both "`#30ba78`, say nothing about opacity" and "`ff`,
 * make it opaque". The picker needs the difference - the first inherits the alpha
 * the slider is showing, the second is an instruction - and reading it off the
 * NOTATION is the only place the difference still exists.
 */
export function notationHasAlpha(raw: string): boolean {
  const s = String(raw).trim();
  if (!s) return false;
  const hex = /^#?([0-9a-f]+)$/i.exec(s);
  if (hex) return hex[1]!.length === 4 || hex[1]!.length === 8;   // #rgba / #rrggbbaa
  // Modern syntax puts alpha after a slash - inside the parens for a colour
  // function, bare for the picker's own component list ('62% 0.11 250 / 0.5').
  const args = /\(([^)]*)\)\s*$/.exec(s);
  const body = args ? args[1]! : s;
  if (body.includes('/')) return true;
  // …and the legacy comma forms carry it as a fourth component.
  return /^(?:rgba?|hsla?)\(/i.test(s) && body.split(',').length === 4;
}

/** Slack on a bounds test - a byte-rounded channel lands a hair outside. */
const BOUNDS_SLACK = 1e-4;

/**
 * Can this space state the colour exactly, or only approximate it? Unbounded
 * spaces (the perceptual ones) can always state it; a bounded one cannot when a
 * component falls outside its range. This drives the "exact / approximated from a
 * wider colour" half of the caution line - the gamut half is `inGamut` against
 * `SpaceSpec.limit`, which is a different question (a press profile is bounded by
 * ink, not by component range).
 */
export function spaceExactness(spec: SpaceSpec, canonical: CssColor): 'exact' | 'approx' {
  if (!spec.bounds) return 'exact';
  const tag = spec.boundsIn ?? spec.tag;
  if (!tag) return 'exact';
  const comps = convertColor(canonical, tag).components;
  for (let i = 0; i < spec.bounds.length && i < 3; i++) {
    const b = spec.bounds[i];
    if (!b) continue;
    const v = comps[i] ?? 0;
    if (v < b[0] - BOUNDS_SLACK || v > b[1] + BOUNDS_SLACK) return 'approx';
  }
  return 'exact';
}

/** Is the colour reproducible by this space's limit? */
export function spaceInGamut(spec: SpaceSpec, canonical: CssColor): boolean {
  const o = convertColor(canonical, 'oklch');
  return inGamut(o.components[0], o.components[1], o.components[2], spec.limit);
}

/** The limit's human name ('sRGB', 'Coated FOGRA39 (perceptual)'). */
export function limitLabel(limit: GamutLimit): string {
  return resolveGamutSource(limit).label;
}

/** Total ink for this colour on this space's limit, in channels (1.0 = one ink
 *  at full), or null where the concept does not apply - every RGB gamut. */
export function spaceInkCoverage(spec: SpaceSpec, canonical: CssColor): number | null {
  const src = resolveGamutSource(spec.limit);
  if (!src.inkCoverage) return null;
  const o = convertColor(canonical, 'oklch');
  return src.inkCoverage(o.components[0], o.components[1], o.components[2]);
}

/** Hue memory's seed: the colour's OKLCH hue, or null when it is powerless. */
export function hueOf(c: CssColor): number | null {
  const o = convertColor(c, 'oklch');
  return (o.missing & MISSING_C2) !== 0 ? null : o.components[2];
}
