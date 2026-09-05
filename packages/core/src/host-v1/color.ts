// SPDX-License-Identifier: MPL-2.0

export interface ColorAPI {
  /** ΔEOK - Euclidean distance in OKLab (0 identical … ≈1 black↔white; ~0.02 is a JND). */
  deltaE(a: string, b: string): number;
  /** APCA-W3 Lc, signed (advisory; |60| ≈ body text). WCAG 2.1 stays the compliance number. */
  apca(text: string, bg: string): number;
  /** WCAG 2.1 contrast ratio, 1–21 (order-independent). */
  contrast(a: string, b: string): number;
  /** `n` colours along a smooth OKLab bezier through `stops`; optional perceptually-even lightness steps. */
  ramp(stops: string[], n: number, opts?: { correctLightness?: boolean }): string[];
  /** `n + 1` class boundaries over data - 'e' equal, 'l' log₁₀ (positive data only), 'q' quantile. */
  breaks(data: number[], mode: 'e' | 'l' | 'q', n: number): number[];
  /** Up to `n` visually distinct categorical colours, seeded from a brand anchor. */
  distinct(n: number, opts?: { anchorHex?: string; minDeltaE?: number }): string[];
  /**
   * The ACCENT colours of a classic colour-harmony scheme, seeded from
   * `seedHex` (hex forms only - normalise oklch()/lch() first). The seed
   * itself is never returned (it is the scheme's 0° member), so a k-colour
   * scheme yields k−1 accents; each keeps the seed's OKLCH lightness/chroma
   * and rotates only the hue, emitted gamut-mapped. `kind` defaults to
   * 'complement'. An unparseable seed falls back to a neutral mid-blue rather
   * than throwing - the picker always has something to show (this is the
   * brand editor's generator, engine/src/brand-schemes.ts, attached).
   * Optional/additive (v1.60); feature-detect on older hosts.
   */
  schemes?(seedHex: string, kind?: ColorSchemeKind): ColorSchemeAccent[];
  /**
   * Interpolate between two colours the way CSS Color 4 does: in `opts.space`
   * (default `oklab`), with PREMULTIPLIED alpha, travelling the hue circle per
   * `opts.hue` (default `shorter`). Returns hex (8-digit when translucent), or
   * null if either colour is unreadable.
   *
   * Premultiplication is why this exists rather than a per-channel lerp: mixing
   * toward `transparent` unpremultiplied drags the colour toward transparent's
   * *black*, so a red→transparent midpoint comes out dark red at 50% instead of
   * plain red at 50%. Optional/additive (v1.68); feature-detect on older hosts.
   */
  mix?(a: string, b: string, t: number, opts?: ColorMixOptions): string | null;
  /**
   * A Lolly gradient spec string → a CSS gradient value (`linear-gradient(…)` /
   * `radial-gradient(…)` / `conic-gradient(…)`) ready for `background-image`, or
   * null if the spec can't be read.
   *
   * Spec grammar: `<kind>[.<space>[.<hue>]]_<angle>_<colour>-<pos>_…`, e.g.
   * `lin_90_30ba78-0_efefef-100`. The stops come back interpolated in the spec's
   * space and BAKED into plain sRGB stops - extra stops inserted only where sRGB
   * would visibly diverge - because an SVG `<linearGradient>` and a PDF axial
   * shading have no interpolation-space knob. So one value renders the same on
   * screen, in SVG and in PDF, and a tool never hand-rolls colour maths to get a
   * gradient that isn't muddy. Optional/additive (v1.68).
   */
  gradientCss?(spec: string): string | null;
  /**
   * The narrowest display gamut that can show this colour - `'srgb'`, `'p3'`,
   * `'rec2020'`, or `'none'` when nothing can. Accepts the same hex /
   * `oklch()` / `lch()` forms as the rest of this API.
   *
   * Use it to tell a user *why* a colour changed: `oklchToHex`-style mapping
   * silently reduces chroma, and "outside sRGB, fine on a modern display" is a
   * very different message from "no display can show this".
   * Optional/additive (v1.69); feature-detect on older hosts.
   */
  gamut?(color: string): ColorGamut;
  /**
   * The highest chroma that still fits `limit` (default `'srgb'`) at this
   * lightness (0–1, not the CSS percent) and hue (degrees).
   *
   * This is the real, hue-dependent ceiling - yellow carries far more chroma
   * than blue - so it beats a fixed maximum for building even ramps or
   * clamping a picker. Optional/additive (v1.69).
   */
  maxChroma?(l: number, h: number, limit?: Exclude<ColorGamut, 'none'>): number;
  /**
   * One 2D plane through OKLCH space as RGBA pixels, ready for
   * `new ImageData(data, width)` - the gamut charts on oklch.com, as a
   * primitive. Transparent outside `limit`; see {@link ColorSliceOptions} for
   * the axis convention.
   *
   * Pixels beyond sRGB come back gamut-mapped, because the buffer is 8-bit
   * sRGB - draw the boundary from `maxChroma` on top rather than trusting the
   * fill's colour out there. Optional/additive (v1.69).
   */
  slice?(opts: ColorSliceOptions): ColorSliceImage;
  /**
   * The in-gamut region of a slice plane, as closed rings in the plane's unit
   * square (x right, y DOWN) - multiply by a pixel box and you have an SVG
   * `clipPath` or a filled `<path>`.
   *
   * This is the vector counterpart to {@link ColorAPI.slice}: a raster surface
   * can leave the out-of-gamut area transparent, an SVG has to describe it. An
   * ARRAY of rings, because on the 'lh' plane the region breaks into islands
   * (see `plane` in {@link ColorSliceOptions}). Optional/additive (v1.69).
   */
  gamutRegion?(
    plane: ColorSlicePlane,
    fixed: number,
    limit?: Exclude<ColorGamut, 'none'>,
    steps?: number,
    cMax?: number
  ): { x: number; y: number }[][];
  /**
   * A colour string → OKLCH (`l` 0–1, not the CSS percent; `h` in degrees), or
   * null if it can't be read. The inverse of {@link ColorAPI.fromOklch}.
   *
   * Without this a tool cannot get at the perceptual axes at all - `schemes()`
   * returns OKLCH for the accents it generates but never for the seed - so any
   * tool wanting to reason about lightness or chroma had to carry its own
   * matrices. Optional/additive (v1.69).
   */
  oklch?(color: string): { l: number; c: number; h: number; alpha?: number } | null;
  /**
   * OKLCH → hex, gamut-mapped into sRGB per CSS Color 4 section 14.2 (hue and
   * lightness preserved, chroma reduced - never a raw channel clip). 8-digit
   * when `alpha` is under 1. Optional/additive (v1.69).
   */
  fromOklch?(o: { l: number; c: number; h: number; alpha?: number }): string;
  /**
   * Invert {@link ColorAPI.apca}: at a fixed `hue`/`chroma`, the OKLCH lightness
   * whose forward APCA Lc against `bgHex` is closest to `|targetLc|`. Returns the
   * solved colour as gamut-mapped hex plus the signed Lc it ACTUALLY achieves.
   *
   * `apca` scores a pair; this is the other direction - "give me a tone of this
   * hue that reads at Lc 60 on this background" - the one move a contrast-first
   * ramp needs and that no forward call can do. Polarity is taken from the
   * background (dark text on a light bg, light on a dark one), never from the
   * sign of `targetLc`; a negative argument is the same request as its magnitude.
   *
   * `reachable` is false when the target magnitude is beyond what this hue/chroma
   * can carry against this background (e.g. past APCA's near-black ceiling) - then
   * `hex`/`lc` are the closest achievable, not a guess. Chroma is clamped into
   * `opts.limit`'s gamut (default `'srgb'`) at the solved lightness, so the colour
   * is real. Optional/additive (v1.107); feature-detect on older hosts.
   */
  solveApca?(
    hue: number,
    chroma: number,
    targetLc: number,
    bgHex: string,
    opts?: ColorApcaSolveOptions
  ): ColorApcaSolveResult;
  /**
   * Read an ICC profile's bytes into a handle the three methods below take, or
   * null when the bytes are not a profile that can be evaluated.
   *
   * Until this existed, "will it print?" had no answer here: `gamut()` reports
   * the three DISPLAY gamuts, and a press is neither of them - a colour can sit
   * comfortably inside sRGB and still be unreachable in CMYK, which is exactly
   * the case a brand palette needs flagged before it goes to a printer. The
   * profile is the user's own file (the one their print shop sent), so nothing
   * about a press condition has to be guessed or hard-coded.
   *
   * `intent` defaults to `'relative'`, the intent a proof is normally judged
   * under. A profile that cannot be asked about gamut under that intent yields a
   * handle with `usable: false` rather than one silently answering from a
   * different intent's table - a wrong colour that looks right is worse than no
   * answer.
   *
   * Malformed bytes return null and never throw, however hostile.
   * Optional/additive (v1.70); feature-detect on older hosts.
   */
  iccProfile?(bytes: Uint8Array, intent?: ColorRenderingIntent): ColorProfileGamut | null;
  /**
   * Is this OKLCH colour reproducible on the device `profile` describes?
   * `l` is 0–1 (not the CSS percent), `h` in degrees.
   *
   * A soft-proofing answer, not a colorimetric one: it is decided by whether the
   * profile can round-trip the colour, so within a few ΔE of the gamut surface it
   * may be called either way, and a fully saturated process primary reads as
   * outside. Treat it as "flag this for review", not as a verdict.
   * False for a handle whose `usable` is false. Optional/additive (v1.70).
   */
  inProfileGamut?(profile: ColorProfileGamut, l: number, c: number, h: number): boolean;
  /**
   * The highest chroma this profile can reproduce at a given lightness and hue -
   * {@link ColorAPI.maxChroma}'s counterpart for a press rather than a display,
   * so a ramp can be built to what will actually print. 0 for an unusable
   * handle. Optional/additive (v1.70).
   */
  profileMaxChroma?(profile: ColorProfileGamut, l: number, h: number): number;
  /**
   * Total ink coverage for the colour, or null when the profile's space has no
   * ink (an RGB or a display profile).
   *
   * The unit is channels - 1.0 is one ink at full, so four-colour process can
   * reach 4.0, the trade's "400% TAC". Not normalised to 0–1, because a
   * pressroom's limit is written as a percentage of that total (300%, 340%) and
   * dividing by the channel count would throw away the only figure a printer
   * would recognise. Optional/additive (v1.70).
   */
  inkCoverage?(profile: ColorProfileGamut, l: number, c: number, h: number): number | null;
  /**
   * Serialise a flat list of named swatches as a design-interchange TEXT file -
   * a DTCG design-tokens JSON (`'tokens-json'`, nested by each swatch's dotted
   * key), a plain CSS custom-properties block (`'css-vars'`), a set of bg/text/
   * border utility classes (`'css-classes'`), an SCSS `$var` block (`'scss'`), or
   * a GIMP `.gpl` palette (`'gpl'`). Swatches whose `hex` is empty or an
   * unresolved alias are dropped; `opts.paletteName` names the `.gpl` header.
   *
   * The same serializers the web shell's Swatches download uses, so a palette a
   * tool exports and one the brand editor downloads are byte-identical. Pure +
   * synchronous. The binary Adobe `.ase` is {@link ColorAPI.paletteExportBytes}
   * (bytes, not text). Optional/additive (v1.108); feature-detect on older hosts.
   */
  paletteExport?(
    swatches: ColorPaletteSwatch[],
    format: ColorPaletteTextFormat,
    opts?: { paletteName?: string }
  ): string;
  /**
   * The binary counterpart to {@link ColorAPI.paletteExport}: the same swatch list
   * as an Adobe Swatch Exchange (`.ase`) file - RGB colour-entry blocks readable by
   * Illustrator, Photoshop and Affinity. `format` is `'ase'` (the one binary
   * palette format), taken for symmetry with the text call and forward room.
   * Optional/additive (v1.108); feature-detect on older hosts.
   */
  paletteExportBytes?(swatches: ColorPaletteSwatch[], format: 'ase'): Uint8Array;
}

/**
 * A single swatch for {@link ColorAPI.paletteExport} / `paletteExportBytes`: a
 * canonical dotted key (slugged into CSS identifiers / JSON path segments and
 * nested for the tokens tree), a display name, a group label (prefixed onto the
 * .gpl / .ase entry names), and a resolved sRGB hex. A swatch whose `hex` is
 * empty or a non-hex value (an unresolved alias, `transparent`) is dropped by the
 * serializers. Mirrored locally - packages/core carries no engine dependency -
 * from the engine's `PaletteSwatch`.
 */
export interface ColorPaletteSwatch {
  key: string;
  name: string;
  group: string;
  hex: string;
}

/** The TEXT palette formats {@link ColorAPI.paletteExport} produces (the binary
 *  `.ase` goes through `paletteExportBytes`). */
export type ColorPaletteTextFormat = 'tokens-json' | 'css-vars' | 'css-classes' | 'scss' | 'gpl';

/**
 * Options for {@link ColorAPI.solveApca}. Mirrored locally (packages/core carries
 * no engine dependency) from the engine's `ApcaSolveOptions`.
 */
export interface ColorApcaSolveOptions {
  /** Gamut the solved chroma is clamped into (default `'srgb'`). */
  limit?: Exclude<ColorGamut, 'none'>;
  /** Lightness-scan resolution for locating the contrast maximum (default 512).
   *  Higher tightens the max on the unreachable path; the reachable path is exact
   *  by bisection regardless. */
  samples?: number;
}

/**
 * The result of {@link ColorAPI.solveApca}. Mirrored locally (packages/core carries
 * no engine dependency) from the engine's `ApcaSolveResult`.
 */
export interface ColorApcaSolveResult {
  /** Solved OKLCH lightness (0–1). */
  l: number;
  /** Chroma actually used at `l`, clamped into `limit`'s gamut (≤ the request). */
  chroma: number;
  /** The hue passed through, unchanged (normalised to 0–360). */
  hue: number;
  /** The solved colour, gamut-mapped hex. */
  hex: string;
  /** Signed forward APCA Lc this colour ACTUALLY achieves (positive dark-on-light,
   *  negative light-on-dark). */
  lc: number;
  /** Signed target: `|targetLc|` carrying the polarity forced by the background. */
  target: number;
  /** False when the target magnitude exceeds the most this hue/chroma can reach
   * against this background - then `hex`/`lc` are the closest achievable. */
  reachable: boolean;
}

/**
 * The four ICC rendering intents. Which one a profile is asked under changes the
 * answer, so it is fixed when the handle is made rather than passed per query.
 */
export type ColorRenderingIntent = 'perceptual' | 'relative' | 'saturation' | 'absolute';

/**
 * A parsed ICC profile, as a handle plus what is worth showing a user about it.
 *
 * Opaque by design: the tables themselves stay in the host, and a tool passes
 * this object back to `inProfileGamut` / `profileMaxChroma` / `inkCoverage`.
 * An object a tool built itself is not a handle and gets the no-answer result
 * (false / 0 / null), never a plausible wrong one.
 */
export interface ColorProfileGamut {
  /** Stable identity, derived from the profile's own bytes + intent. Safe as a
   *  cache key; a tool caching by anything else keys on nothing. */
  readonly id: string;
  /** Human label, e.g. 'Coated FOGRA39 (relative)'. */
  readonly label: string;
  /** ICC device class: 'prtr' (printer), 'mntr' (display), 'scnr', … */
  readonly deviceClass: string;
  /** ICC data colour space: 'CMYK', 'RGB', 'GRAY', … */
  readonly colourSpace: string;
  /** Device channel count - 4 for process CMYK. */
  readonly channels: number;
  /** The intent this handle answers under. */
  readonly intent: ColorRenderingIntent;
  /** ICC spec version the profile declares, e.g. '2.2.0' or '4.3.0'. */
  readonly version: string;
  /** False when this profile cannot answer a gamut question under `intent` - no
   *  table for it, no reverse transform to test membership with, or an abstract
   *  transform with no device gamut at all. Every query then returns its
   *  no-answer value. Check this before drawing a chart of nothing. */
  readonly usable: boolean;
}

/** Display gamuts, narrowest first; `'none'` is outside even Rec.2020. */
export type ColorGamut = 'srgb' | 'p3' | 'rec2020' | 'none';

/**
 * Which plane {@link ColorAPI.slice} paints. In every name the FIRST letter is
 * the vertical axis and the SECOND is the horizontal one:
 *
 * 'lc' - lightness (y, 1 at the top) × chroma (x, 0 at the left), at a fixed hue
 * 'ch' - chroma (y, 0 at the bottom) × hue (x, 0–360°), at a fixed lightness
 * 'lh' - lightness (y, 1 at the top) × hue (x, 0–360°), at a fixed chroma
 */
export type ColorSlicePlane = 'lc' | 'ch' | 'lh';

export interface ColorSliceOptions {
  plane: ColorSlicePlane;
  /** The third channel: hue° for 'lc', lightness 0–1 for 'ch', chroma for 'lh'. */
  fixed: number;
  width: number;
  height: number;
  /** Ceiling of the chroma axis. Default 0.4. */
  cMax?: number;
  /** Paint nothing beyond this gamut. Default 'rec2020'. */
  limit?: Exclude<ColorGamut, 'none'>;
}

export interface ColorSliceImage {
  /** RGBA bytes, row-major from the TOP row. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Options for {@link ColorAPI.mix} (mirrors CSS Color 4 section 12–13). */
export interface ColorMixOptions {
  /** Interpolation space. Default `oklab`; `srgb` models a plain CSS gradient. */
  space?: ColorInterpolationSpace;
  /** Hue travel for a polar space. Default `shorter`. */
  hue?: ColorHueDirection;
}

/** The interpolation spaces `mix()` and a gradient spec accept. */
export type ColorInterpolationSpace =
  | 'oklab'
  | 'oklch'
  | 'lab'
  | 'lch'
  | 'srgb'
  | 'srgb-linear'
  | 'hsl';

/** How to travel around the hue circle between two polar colours. */
export type ColorHueDirection = 'shorter' | 'longer' | 'increasing' | 'decreasing';

/** The harmony schemes `schemes()` accepts (mirrors engine brand-schemes.ts -
 *  the numeral is the scheme's TOTAL colour count, seed included). */
export type ColorSchemeKind =
  | 'complement'
  | 'adjacent-3'
  | 'triad-3'
  | 'tetrad-4'
  | 'free-2'
  | 'free-3'
  | 'free-4';

/** One generated harmony accent: its gamut-mapped sRGB hex, the OKLCH it was
 * emitted from, and the normalised hue (degrees, [0,360) - same as `oklch.h`,
 *  surfaced for callers that sort/group swatches by hue). */
export interface ColorSchemeAccent {
  hex: string;
  oklch: { l: number; c: number; h: number };
  hue: number;
}
