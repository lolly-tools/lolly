// SPDX-License-Identifier: MPL-2.0

// ─── PPTX (optional) ──────────────────────────────────────────────────────────

export interface PptxAPI {
  /**
   * Report what a deck carries - slide count, the read theme, and the distinct
   * literal colours + explicit typefaces found on slides - for a "what will
   * change" review UI. Read-only; never mutates the input, and NEVER throws:
   * bytes that aren't a readable .pptx resolve with `ok: false` (a picker feeds
   * arbitrary files here, so "not a deck" is an expected answer, not an error).
   * Pass the active brand's swatches/fonts in `opts` to get nearest-brand
   * `suggested` values per colour/font plus a ready-made `themeSuggestion`.
   */
  inspect(bytes: Uint8Array, opts?: PptxInspectOpts): Promise<PptxInspectResult>;

  /**
   * Produce a re-themed copy of the deck. Surgical: only the values the plan
   * names are rewritten (theme slots, literal colour remaps, explicit typeface
   * remaps, embedded-font stripping); every untouched part is byte-identical.
   * THROWS a friendly Error when the bytes are not a .pptx - by the time a
   * rebrand runs the tool has committed to the file, so failure is exceptional
   * (inspect() is the never-throwing probe). Runs locally.
   */
  rebrand(bytes: Uint8Array, plan?: PptxRebrandPlan): Promise<PptxRebrandResult>;
}

/** One brand colour offered as a rebrand target. */
export interface PptxBrandSwatch {
  /** Any common hex form; the host normalises. */
  hex: string;
  /** Display label, e.g. 'Jungle'. */
  name?: string;
  /** Role hint ('bg'/'ink'/'accent'/'neutral' families) - improves slot mapping. */
  role?: string;
}

/** The brand's font slots (family names as they should appear in the deck). */
export interface PptxBrandFonts {
  brand?: string;
  serif?: string;
  mono?: string;
}

export interface PptxInspectOpts {
  /** Brand swatches to suggest against. Non-empty ⇒ the result carries per-colour
   *  `suggested` values and a `themeSuggestion`. */
  swatches?: PptxBrandSwatch[];
  /** Brand fonts to suggest against (per-font `suggested` values). */
  fonts?: PptxBrandFonts;
}

/** One distinct literal colour found on the slides. */
export interface PptxInspectColor {
  /** The colour as found, normalised to `#RRGGBB`. */
  hex: string;
  /** Nearest brand swatch as `#RRGGBB` (present when opts.swatches given). */
  suggested?: string;
  /** True when the nearest match is a perceptual stretch - surface it for a human. */
  review?: boolean;
}

/**
 * What the slides are actually MADE of - the node kinds the reader found,
 * summed across every slide. Added in engine 1.79, so a tool must treat it as
 * optional: an older shell omits it entirely.
 *
 * The point of the counters is to tell a rebrandable deck from a flattened one.
 * A deck whose slides are nothing but `pictures` (a PDF or a set of exported
 * images dropped onto blank slides) carries no colour or typeface a rebrand can
 * reach: the theme swap still rewrites the theme part, but nothing on the slides
 * references it, so the visible result is identical to the input. A tool should
 * say so BEFORE the user spends a download on it.
 */
export interface PptxInspectContent {
  /** Picture nodes (embedded bitmaps/EMF/SVG) across all slides. */
  pictures: number;
  /** Text-bearing nodes. */
  texts: number;
  /** Shape nodes (a fill/line the rebrand can remap). */
  shapes: number;
  /** Table nodes. */
  tables: number;
  /** Nodes the reader could not classify (charts, SmartArt, OLE, …). */
  unknown: number;
}

/** One distinct explicit typeface found in the deck. */
export interface PptxInspectFont {
  family: string;
  /** Brand replacement family (present when opts.fonts given). */
  suggested?: string;
}

export interface PptxInspectResult {
  /** False when the bytes aren't a readable .pptx - every other field is then empty/zero. */
  ok: boolean;
  slideCount: number;
  /** The deck's read theme: clrScheme slot → `#RRGGBB`, plus the scheme faces. */
  theme: { colors: Record<string, string>; majorFont?: string; minorFont?: string };
  /**
   * Distinct LITERAL (non-scheme-linked) colours found on slides, in first-
   * appearance order, capped at 256. Scheme-linked colours are deliberately
   * absent: they follow the theme, so the theme swap rebrands them for free -
   * this list is exactly the residue a colorMap must handle.
   */
  colors: PptxInspectColor[];
  /** Distinct explicit typefaces incl. the theme major/minor, capped at 64. */
  fonts: PptxInspectFont[];
  /** Node-kind tally across the slides - how to spot a flattened, picture-only
   *  deck that a rebrand cannot visibly change. Added in 1.79; optional, so a
   *  tool must feature-detect it (an older shell omits it). */
  content?: PptxInspectContent;
  /** A ready-made theme plan from the brand swatches (present when opts.swatches
   * is non-empty). Colour slots are `#RRGGBB` - pass it to rebrand() as-is. */
  themeSuggestion?: PptxRebrandTheme;
}

/** A brand theme as flat values - the 12 clrScheme slots + the scheme faces.
 *  As plan input the colour slots accept `#RRGGBB` or any common hex form (the
 *  host/engine strip the hash and normalise on write); inspect's
 *  `themeSuggestion` always emits `#RRGGBB`. Any slot omitted is left as-is. */
export interface PptxRebrandTheme {
  dk1?: string;
  lt1?: string;
  dk2?: string;
  lt2?: string;
  accent1?: string;
  accent2?: string;
  accent3?: string;
  accent4?: string;
  accent5?: string;
  accent6?: string;
  hlink?: string;
  folHlink?: string;
  majorFont?: string;
  minorFont?: string;
}

export interface PptxRebrandPlan {
  /** Overwrite the given theme colour slots + scheme fonts in every theme part. */
  theme?: PptxRebrandTheme;
  /** Literal colour remap, `from -> to`. Keys accept any common hex form; the
   *  host normalises them to the engine's hexNorm form before matching. */
  colorMap?: Record<string, string>;
  /** Explicit-typeface remap, exact family name `from -> to`. */
  fontMap?: Record<string, string>;
  /** Remove all embedded-font records (list element, parts, rels, content type). */
  dropEmbeddedFonts?: boolean;
}

/** What the rebrand actually changed. */
export interface PptxRebrandReport {
  themesPatched: number;
  colorsRemapped: number;
  fontsRemapped: number;
  embeddedFontsStripped: number;
  /** Part paths of the slides whose bytes changed. */
  slidesTouched: string[];
}

export interface PptxRebrandResult {
  /** The re-themed deck, ready to download. */
  bytes: Uint8Array;
  report: PptxRebrandReport;
}
