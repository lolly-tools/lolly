// SPDX-License-Identifier: MPL-2.0

// ─── Text-to-path ───────────────────────────────────────────────────────────

export interface TextAPI {
  /**
   * Shape `text` using the given font at `fontSize` px and return an SVG path.
   *
   * The returned `d` string uses SVG coordinates (Y-down) with the baseline at
   * y=0. `bbox.x1` may be slightly positive (left side bearing). `advanceWidth`
   * is the total pen advance in pixels. `bbox` is null for blank/whitespace-only
   * runs.
   *
   * Font shaping respects OpenType features (GPOS, GSUB - ligatures, kerning,
   * contextual alternates) via HarfBuzz, unlike naïve glyph-by-glyph approaches.
   */
  toPath(opts: TextToPathOpts): Promise<TextPathResult>;

  /** Warm the font cache for `fontUrl` without doing any shaping. */
  preload(fontUrl: string): Promise<void>;

  /**
   * The font's variable-axis DEFAULT values, tag → value (`{ wght: 400 }`), or
   * `{}` for a static font. A caller embedding the raw file into a renderer with
   * no variable-axis control (jsPDF) gets exactly this instance, so it needs the
   * defaults to know whether the file will render at the weight it wants.
   * Optional/additive (v1.30); absent on older hosts. (v1.30)
   */
  axisDefaults?(fontUrl: string): Promise<Record<string, number>>;

  /**
   * Resolve a font FAMILY the host knows - brand statics, user-uploaded faces,
   * on-device Google Fonts, the platform face - to a fetchable font file
   * usable as `fontUrl` in toPath()/preload(). `opts` picks the nearest face:
   * `weight` (CSS 100–900, default 400) and `italic` (default false). When the
   * resolved file is a VARIABLE font, `variations` carries the HarfBuzz axis
   * settings (e.g. ['wght=700']) needed to reach the requested weight - pass
   * them through to toPath(), which otherwise shapes the default instance.
   * Resolves null when no file can be found for the family (the caller keeps
   * its <text>/CSS fallback). Optional/additive (v1.60); absent on older
   * hosts - feature-detect `host.text?.fontUrl`.
   */
  fontUrl?(
    family: string,
    opts?: { weight?: number; italic?: boolean }
  ): Promise<{ url: string; variations?: string[] } | null>;
}

export interface TextToPathOpts {
  text: string;
  fontUrl: string;
  fontSize: number;
  /** OpenType feature tags to enable/disable, e.g. `['liga=1', 'kern=1']`. */
  features?: string[];
  /**
   * Uniform tracking added after every glyph, in pixels (CSS letter-spacing). The
   * baked-in advance keeps outlined text (SVG/PDF/EMF) matching the on-screen run
   * instead of forcing a non-outlined <text> fallback. Defaults to 0.
   */
  letterSpacing?: number;
  /**
   * OpenType variation-axis settings for a VARIABLE font, as HarfBuzz strings
   * (`['wght=700']`). Without them a variable face shapes at its default
   * instance - a bold run would outline as regular. Axes not listed take their
   * default value. Ignored by static fonts. (v1.29)
   */
  variations?: string[];
  /**
   * Faces to shape the characters `fontUrl` has no glyph for, tried in order -
   * the same job the browser's font fallback does. Needed because webfont
   * families arrive as DISJOINT subsets (Google Fonts' `latin` file holds no
   * `Ł`, and its `latin-ext` file holds no ASCII), so a single face cannot
   * outline "Łódź". Characters no face covers shape as `.notdef` and are
   * counted in `notdef`. (v1.29)
   */
  fallbackFonts?: Array<{ fontUrl: string; variations?: string[] }>;
  /**
   * Also return the run broken into per-cluster pieces (`TextPathResult.clusters`)
   * - one entry per HarfBuzz cluster, which at the default clustering level is one
   * per grapheme, with a ligature or a base+marks sequence kept as ONE piece. This
   * is what lets a caller animate "letters" of a shaped run without un-shaping it:
   * kerning, ligatures and contextual joining (Arabic) are already applied, and
   * each piece is just moved. Off by default - the merged `d` is unchanged either
   * way. Optional/additive (v1.159).
   */
  clusters?: boolean;
}

/**
 * One shaped cluster of a run (see `TextToPathOpts.clusters`). `start`/`end` are
 * UTF-16 offsets into the source text (a ligature spans several), `d` is that
 * cluster's outline in the SAME coordinates as the merged path (absolute x,
 * baseline y=0), `x` its pen origin in px and `advance` its summed pen advance.
 * Sorted by `start` - logical (reading) order, which for an RTL run is right to
 * left visually. Concatenating every `d` in this order reproduces the merged `d`
 * for a single-direction run. (v1.159)
 */
export interface TextPathCluster {
  start: number;
  end: number;
  d: string;
  x: number;
  advance: number;
}

export interface TextPathResult {
  /** SVG path data string. Baseline at y=0; Y-down coordinate system. */
  d: string;
  /** Total horizontal advance of the run, in pixels. */
  advanceWidth: number;
  /**
   * Tight glyph bounding box in pixels. null for blank or whitespace-only runs.
   * y1 is above the baseline (negative), y2 is below (positive for descenders).
   */
  bbox: { x1: number; y1: number; x2: number; y2: number } | null;
  /**
   * How many glyphs in the run fell back to `.notdef` - the font has no glyph
   * for that character. Outlining then draws blanks or tofu boxes, so a caller
   * that has a fallback (an SVG `<text>` element) should prefer it when this is
   * non-zero. Absent on hosts that predate the field; treat as 0. (v1.29)
   */
  notdef?: number;
  /** The per-cluster breakdown, present only when `opts.clusters` was set. (v1.159) */
  clusters?: TextPathCluster[];
}
