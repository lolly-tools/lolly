// SPDX-License-Identifier: MPL-2.0
/**
 * text-measure-v1: where a Design text layer's lines break and how tall the text
 * is, before anything is drawn (plan 291, W5). `lolly measure --text`, the
 * `lolly_measure_text` MCP tool and the `text-measure` checker of `lolly check`
 * return a `TextMeasureV1`, mirrored by `schemas/text-measure-v1.schema.json`
 * (with a byte-identical copy under `packages/core/schema/` for the SDK).
 *
 * The measure mirrors how the Design canvas lays out a plain text layer: the
 * renderer's defaults and clamps (size 48, weight 700, line height 1.12, padding 8,
 * vertical alignment middle), its text subset (bold as CSS `bolder`, `{wNNN|}`,
 * `{mono|}`, italic runs in the brand italic face, list markers), CSS
 * `white-space: pre-wrap` with `overflow-wrap: anywhere` breaking at UAX #14
 * opportunities with trailing spaces hanging, and Chromium's line box and
 * `scrollHeight` arithmetic. Text is shaped with HarfBuzz from the same variable
 * faces the canvas loads.
 *
 * `scrollHeight` is the number the mounted audit compares with the box's
 * `clientHeight`, so a clipped verdict here is the audit's verdict. Line widths are
 * predictions within `tolerance`: a line whose slack is under `tolerance.nearEdgePx`
 * is flagged `nearEdge`, and a caller should widen the box by a few px there
 * rather than trust a sub-pixel fit. The comparison runs were on macOS Chromium;
 * Linux Chromium (CI, the render worker) is not yet verified.
 *
 * Text story layers (`textStory`) are laid out by the engine's own composer and are
 * never measured with this model.
 *
 * Types and constants only: no runtime, no DOM, no I/O.
 */

/** Report discriminator. */
export const TEXT_MEASURE_FORMAT = 'lolly-text-measure' as const;
/** Bumped only for a change an older reader would misread. */
export const TEXT_MEASURE_VERSION = 1 as const;
/** How the measure was taken: HarfBuzz advances and a CSS pre-wrap greedy breaker. */
export const TEXT_MEASURE_METHOD = 'harfbuzz-css-greedy' as const;

/**
 * What ended a line. `end`: the text ends there. `forced`: a newline in the text.
 * `space`: a soft wrap after white space. `opportunity`: a soft wrap at another
 * UAX #14 break (after a hyphen, between ideographs). `anywhere`: a word wider than
 * the line, cut between two characters (`overflow-wrap: anywhere`).
 */
export const TEXT_MEASURE_BREAKS = ['end', 'forced', 'space', 'opportunity', 'anywhere'] as const;
export type TextMeasureBreakV1 = (typeof TEXT_MEASURE_BREAKS)[number];

/** Vertical alignment inside the box, as Design's `valign` field. */
export const TEXT_MEASURE_VALIGNS = ['top', 'middle', 'bottom'] as const;
export type TextMeasureValignV1 = (typeof TEXT_MEASURE_VALIGNS)[number];

/** The brand's font families by slot, as the web shell's `--font-*` variables carry them. */
export interface TextMeasureFontsV1 {
  /** `font.brand`, the face `sans` names. */
  brand: string;
  /** `font.mono`, the face `mono` names. Defaults to the brand face. */
  mono?: string;
  /** `font.display`, the face `display` names. Defaults to the brand face. */
  display?: string;
  /** `font.italic`, the face italic runs use in every box. Defaults to the brand face. */
  italic?: string;
}

/**
 * What to measure: the fields of a Design text row that change its layout. An
 * absent field takes the renderer's default.
 */
export interface TextMeasureSpecV1 {
  /** The text, in Design's subset (`**bold**`, `*italic*`, `{w600|...}`, `{mono|...}`, `- ` lists). */
  text: string;
  /** `sans` (default), `display`, `mono`, or a family name. */
  font?: string;
  /** The brand's families by slot. Default: the platform faces. */
  fonts?: TextMeasureFontsV1;
  /** CSS weight, rounded to 100 and clamped to 100 to 900 (mono to 800). Default 700. */
  weight?: string | number;
  /**
   * Set every run in emphasis, as an italic style lowers to `*...*`: runs take the
   * italic face (an attribute run's font inside the emphasis keeps its family) and the
   * list marker and the layer's own face stay upright, as the canvas draws them.
   */
  italic?: boolean;
  /** The row's `plainText`: the text is drawn verbatim, with no markup, lists or emphasis. */
  plain?: boolean;
  /** px, rounded. Default 48. */
  size?: number;
  /** Unitless, clamped to 0.5 to 4. Default 1.12. */
  lineHeight?: number;
  /** Inner padding on every side, px, rounded and clamped to 0 to 400. Default 8. */
  pad?: number;
  /** Letter spacing, px, clamped to -100 to 400. Default 0. */
  tracking?: number;
  /** Ligatures on (default). Off, or any tracking, turns `liga` and `clig` off. */
  ligatures?: boolean;
  /** Stylistic alternates (`salt`). Default off. */
  alternates?: boolean;
  /** The box width, px. */
  width: number;
  /** The box height, px. Given, the result says whether the text is clipped. */
  height?: number;
  /** A border drawn inside the box, px, which narrows and shortens the text area. */
  strokeW?: number;
  /** Default `middle`. */
  valign?: TextMeasureValignV1;
}

/** One face a measure used. */
export interface TextMeasureFaceV1 {
  /** The font token or family the layer named (`sans`, `mono`, `display`, `italic`, or a family). */
  token: string;
  family: string;
  weight: number;
  italic: boolean;
  /** The font file, as the shaper gives its path (`/fonts/SUSE[wght].ttf`). */
  file: string;
  /** Variation axis settings applied to the file (`{ wght: 500 }`). */
  variations?: Record<string, number>;
}

/** One laid-out line. Offsets are UTF-16 indices into the drawn text of its paragraph (markup removed, list marker included). */
export interface TextMeasureLineV1 {
  index: number;
  /** The paragraph (source line between newlines) this line belongs to, 0-based. */
  paragraph: number;
  /** The drawn text, trailing white space included. */
  text: string;
  start: number;
  end: number;
  /** Advance width without trailing white space, px, two decimals. */
  width: number;
  /** `availableWidth - width`, px, two decimals. Negative only for one character wider than the line. */
  slack: number;
  break: TextMeasureBreakV1;
  /**
   * The break is fragile: the line's slack, or how far the next word missed by, is
   * under `tolerance.nearEdgePx`, so a renderer a little wider or narrower could
   * break this line elsewhere.
   */
  nearEdge: boolean;
}

/** The box the text sits in, when a height was given. */
export interface TextMeasureBoxV1 {
  width: number;
  height: number;
  /** The text area's height: the box height less the border on both sides. */
  clientHeight: number;
}

/** What does not fit, when a height was given. */
export interface TextMeasureOverflowV1 {
  /** `scrollHeight - clientHeight`, px; negative is room to spare. */
  y: number;
  /** True when a line is wider than the text area (one character wider than the line). */
  x: boolean;
  /** The mounted audit's verdict: `scrollHeight > clientHeight + 0.5`, or `x`. */
  clipped: boolean;
  /**
   * Lines whose glyphs (ascent to descent) the box cuts, by `valign`: the last lines for
   * top, both ends for middle, the first for bottom. Empty when the text is not clipped.
   */
  hiddenLines: number[];
}

/** How far a prediction may be from the canvas. */
export interface TextMeasureToleranceV1 {
  /** Typical per-line width error, px. */
  widthPx: number;
  /** Worst per-line width error seen at a line end, px. */
  lineEndPx: number;
  /** The margin `nearEdge` uses: the larger of 3 px and 0.04 of the font size. */
  nearEdgePx: number;
}

export interface TextMeasureV1 {
  format: typeof TEXT_MEASURE_FORMAT;
  version: typeof TEXT_MEASURE_VERSION;
  method: typeof TEXT_MEASURE_METHOD;
  /** The layer's own face: its font at its weight. */
  font: TextMeasureFaceV1;
  /** Every face the text used, the layer's own first. */
  faces: TextMeasureFaceV1[];
  /** The values used after the renderer's defaults and clamps. */
  size: number;
  weight: number;
  lineHeight: number;
  /** One line box, px: `floor(lineHeight * size * 64) / 64`, as Chromium's layout unit. */
  lineHeightPx: number;
  pad: number;
  tracking: number;
  /** The box width, px, rounded the way the renderer rounds a box width. */
  width: number;
  /** The text area's width: the box width less padding and border on both sides. */
  availableWidth: number;
  lines: TextMeasureLineV1[];
  lineCount: number;
  /** The text block's height, px: padding plus the line boxes. */
  height: number;
  /** What the canvas reports as the text's `scrollHeight`, whole px: the last line's glyphs can reach below its line box. */
  scrollHeight: number;
  /** True when any line is `nearEdge`. */
  nearEdge: boolean;
  /**
   * Characters a measured face has no glyph for (at most 64). The canvas draws them in
   * a fallback font, so the lines holding them are `nearEdge` and the height is not a
   * verdict to trust; `lolly check` does not judge such a layer from this measure.
   */
  uncovered?: string[];
  box?: TextMeasureBoxV1;
  overflow?: TextMeasureOverflowV1;
  tolerance: TextMeasureToleranceV1;
  /** What the measure assumed or could not model, in plain sentences. */
  notes: string[];
}
