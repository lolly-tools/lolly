// SPDX-License-Identifier: MPL-2.0
/**
 * pptx-read.ts: PARSE an unzipped .pptx part map into a read-model.
 *
 * This is the read half of the PPTX story (`pptx.ts` is the mature *builder*).
 * It mirrors `pdf-map.ts`: a pure, DOM-free interpreter that turns an already-
 * unzipped OOXML part map into positioned nodes the rest of the platform can
 * rebrand / re-author. See plans/49-fable-new-potential-pptx.md track E1.
 *
 * ── DESIGN CONTRACT ──────────────────────────────────────────────────────────
 * • The CALLER inflates the zip and hands us a `Record<path, Uint8Array|string>`
 *   (fflate in the shells; a fixture map in tests). Zip inflation + the `PK`
 *   magic-byte sniff live in the caller, not here.
 * • The engine is XML-library-free, so we ACCEPT AN INJECTED PARSER
 *   `parseXml:(s:string)=>Document`, exactly the way the runtime injects the
 *   host bridge. The web shell passes the native `DOMParser`; Node shells / tests
 *   pass one built from jsdom or @xmldom. We import NO DOM library and never
 *   touch `document`/`window`/`fetch`.
 * • Traversal is namespace-AGNOSTIC: we match on an element's *local* name
 *   ("srgbClr", not "a:srgbClr") so the same walk works whether the injected
 *   parser is namespace-aware (jsdom) or prefix-preserving.
 *
 * ── SECURITY (a hostile zip is the threat model, same as PDF) ─────────────────
 * Every part is size-capped before parsing; slide/node/paragraph/run/table
 * counts are capped; group-shape recursion is depth-capped; a malformed or
 * hostile part NEVER throws: we return what parsed and skip the rest. XML
 * entity-expansion (billion-laughs) is the injected parser's responsibility, but
 * we additionally bound every DFS by a visited-node counter so a pathologically
 * deep/wide tree can't hang us.
 *
 * ── COVERAGE (this is a correct SPIKE, not the whole cathedral) ───────────────
 * Covered (the common case, well): slide size; the theme's 12-slot clrScheme +
 * major/minor fonts; per-slide spTree walk producing text boxes (runs with
 * bold/italic/underline/size/font + colour with schemeClr-vs-literal provenance),
 * shapes (prstGeom + solid fill/line with provenance), pictures (r:embed → media
 * path via slide rels), tables (cell text), grouped shapes (flattened), and
 * speaker notes (best-effort). schemeClr colours are resolved through the theme
 * (with the DEFAULT clrMap bg1→lt1/tx1→dk1/bg2→lt2/tx2→dk2) while preserving the
 * original slot name.
 *
 * Also covered: the TEXT CASCADE. A run's size/bold/italic/underline/font/colour
 * resolves through paragraph `pPr/defRPr` → the shape's own `lstStyle` → the
 * slide layout's matching placeholder → the slide master's matching placeholder
 * and its `txStyles` → `presentation.xml`'s `defaultTextStyle`, per outline
 * level, filling only what the slide left undefined. An explicit off (`b="0"`)
 * is a value, not an absence: it stops inheritance for that field. Placeholders
 * match slide → layout → master by `idx` first, then by type with `title` and
 * `ctrTitle` unified, which also resolves the TYPE of an idx-only slide
 * placeholder.
 *
 * ADDED for plan 274 work package 1, the renovate journey's stage-1 reader:
 *   • Group composition: a grpSp's off/ext/chOff/chExt, rotation and flips are
 *     composed into every child, so a grouped box reports SLIDE coordinates.
 *     `groupPath` records the ancestry; the composed pose is reported as `rot`
 *     plus `flipH` / `flipV`, and `transform` carries the full affine whenever
 *     rotation or a mirror makes the axis-aligned box an approximation.
 *   • Run hyperlinks (`a:hlinkClick`), resolved through the part's own rels.
 *   • `a:gradFill` first stop as the fill colour (`gradient: true` on the node)
 *     and lumMod / lumOff / tint / shade folded into the hex (`modified: true`),
 *     with the theme slot name kept.
 *   • Alt text (`p:cNvPr@descr`, else `@title`).
 *   • A fallback picture for content this reader does not model: the
 *     `mc:Fallback` branch of an `mc:AlternateContent`, else an image part the
 *     chart's own relationships name.
 *   • Native chart caches (`c:ser` / `c:cat` / `c:val`) as `chartData`.
 *   • `warnings`: a cap that drops a slide, a node, a part, a table row or
 *     cell, a chart series or a cached chart value reports it, so a caller can
 *     account for what it did not get. Named exceptions, which shorten one
 *     string in place rather than drop an object: run and cell text, alt text,
 *     a link target and a chart label, each clamped at the length stated under
 *     "hardening caps" below, plus the descendant-visit and colour-transform
 *     bounds.
 *
 * DEFERRED, explicitly (documented so it isn't mistaken for a bug):
 *   • Inheritance beyond run text properties: a placeholder's geometry, fill,
 *     line and bullet formatting are still read from the slide only, so a shape
 *     that states none of them reports none.
 *   • pattFill / blipFill-as-shape-fill, prstClr named colours, custom geometry
 *     whose points name guides (`gdLst` / `avLst` formulas), SmartArt and OLE
 *     internals (surfaced as `unknown` nodes), animations. clrMapOvr per-slide
 *     overrides are ignored (default map used).
 *
 * ADDED for plan 275 decision 32 (vectors stay vectors):
 *   • A picture's SVG part (`asvg:svgBlip` inside the blip's extension list) as
 *     `PptxPicNode.svg`, beside the raster the blip itself names.
 *   • Custom geometry (`a:custGeom`) as SVG path data per `a:path`, in the path's
 *     own space, on shape and text nodes (`custGeom`).
 *   • The chart's embedded workbook: the chart part's own cached values are
 *     read, the xlsx beside it is not.
 */

// ─── public read-model ───────────────────────────────────────────────────────

/** An unzipped OOXML part map. Values are raw bytes or already-decoded text. */
export type PptxParts = Record<string, Uint8Array | string>;

/** DOMParser-shaped adapter injected by the host (web: native; tests: jsdom). */
export type XmlParser = (xml: string) => Document;

/**
 * A colour with its PROVENANCE preserved: this is what makes token-aware
 * rebranding possible ("this fill *was* accent1"). A schemeClr keeps its slot
 * name AND carries the theme-resolved hex; a literal srgbClr carries only a hex.
 *
 * `modified` marks a hex this reader COMPUTED by folding the DrawingML colour
 * transforms the source stated (lumMod, lumOff, tint, shade) into the base
 * colour, so a consumer knows the value is derived rather than written down.
 */
export type PptxReadColor =
  | { scheme: string; hex?: string; modified?: true; alpha?: number } // schemeClr provenance; hex = theme-resolved (undefined for phClr)
  | { hex: string; modified?: true; alpha?: number }; // literal srgbClr / sysClr
// `alpha` (plan 275 decision 32): the colour's own `a:alpha`, 0 to 1, present only
// when it is under 1, so an opaque colour reads exactly as it did before.

/**
 * The first engine version whose reader resolves paragraph formatting (bullets,
 * numbering, alignment, spacing) and strike, baseline and letter case through the
 * cascade (plan 275 section 7.2). A stored source deck whose reader version is older
 * was read without them; `algorithms.reader` is the engine version, so a caller
 * compares against this to decide whether to read the source again. It is the
 * version this reader ships in, never one past `ENGINE_VERSION`: a floor above the
 * running engine would call every fresh reading stale. `tests/pptx-read-274.test.ts`
 * pins that.
 */
export const PPTX_FORMATTING_READER_SINCE = '1.223.0';

/**
 * The first engine version whose reader carries everything a renovation reads from
 * a pptx: the formatting above, plus SVG pictures (`asvg:svgBlip`) and custom
 * geometry read as drawings (plan 275 decision 32). A stored source read before it
 * is read again from its retained bytes, so its charts arrive as editable shapes.
 */
export const PPTX_READER_SINCE = '1.224.0';

export interface PptxReadRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** The underline's named style when it is not a single line (`dbl`, `wavy`, ...). Plan 275. */
  underlineStyle?: string;
  /** Struck through (`strike="sngStrike"` or `dblStrike`). Plan 275. */
  strike?: boolean;
  /** Raised or lowered, by the sign of `baseline`. Plan 275. */
  baseline?: 'super' | 'sub';
  /** Letter case the run is drawn in (`cap`). Plan 275. */
  cap?: 'all' | 'small';
  /** point size (OOXML `sz` is hundredths of a point → /100). */
  sizePt?: number;
  /** explicit `a:latin` typeface override on the run. */
  font?: string;
  color?: PptxReadColor;
  /**
   * The run's `a:hlinkClick` destination: the URL for a relationship marked
   * external, the resolved part path for a jump to another slide, else the bare
   * `action` string when the source states one with no relationship. Absent when
   * the run carries no link.
   */
  href?: string;
}

export interface PptxReadPara {
  runs: PptxReadRun[];
  /** outline level from `a:pPr@lvl` (0 = top). Absent means 0. */
  lvl?: number;
  /**
   * The list marker, resolved through the same cascade as the run properties
   * (the paragraph, the shape's lstStyle, the layout and master placeholders,
   * the master's txStyles, the presentation defaults). `none` is a layer saying
   * so; absent means no layer said anything. Plan 275 section 7.2.
   */
  bullet?: 'none' | 'bullet' | 'number';
  /** The glyph of a `bullet` paragraph (`a:buChar@char`). */
  bulletChar?: string;
  /** The numbering scheme of a `number` paragraph (`a:buAutoNum@type`). */
  numberStyle?: string;
  /** The first number of a `number` list when a layer states one (`startAt`). */
  numberStart?: number;
  /** Paragraph alignment (`algn`), resolved through the cascade. */
  align?: 'left' | 'center' | 'right' | 'justify';
  /** Space before and after, in points (`a:spcBef`, `a:spcAft` as `a:spcPts`). */
  spaceBeforePt?: number;
  spaceAfterPt?: number;
  /** Line spacing as a percentage of single (`a:lnSpc` as `a:spcPct`). */
  lineSpacingPct?: number;
  /** Left margin and first-line indent in EMU (`marL`, `indent`). */
  marginLeftEmu?: number;
  indentEmu?: number;
}

/**
 * A shape's placeholder binding, read from `p:nvSpPr/p:nvPr/p:ph` on the SLIDE
 * itself. `type` tells a consumer which box is the title/subtitle/body and which
 * is furniture (`ftr`, `sldNum`, `dt`); `idx` is the layout slot number. A slide
 * placeholder that states only `idx` takes its `type` from the matching layout
 * or master placeholder; with no layout part to read it falls back to `body`,
 * which is what ECMA-376 says an untyped `ph` means. A shape with no `ph`
 * element at all reports nothing here.
 */
export interface PptxPlaceholder {
  /** `title`, `ctrTitle`, `subTitle`, `body`, `ftr`, `sldNum`, `dt`, `pic`, ... */
  type?: string;
  idx?: number;
}

/**
 * A 2x3 affine, in the order SVG writes one: `[a, b, c, d, e, f]` meaning
 * `X = a*u + c*v + e` and `Y = b*u + d*v + f`.
 */
export type PptxAffine = [number, number, number, number, number, number];

interface NodeBox {
  xEmu: number;
  yEmu: number;
  cxEmu: number;
  cyEmu: number;
  /**
   * Rotation in DEGREES clockwise (OOXML stores 60000ths of a degree), about
   * the box centre. With `flipH` / `flipV` this is the whole pose for a node
   * the reader composed; where `transform` is present it is the axis-aligned
   * reading of the same placement and `transform` is the exact one.
   */
  rot?: number;
  /**
   * This node's exact placement in SLIDE EMU: the affine that maps its own
   * unrotated box space - a point `(u, v)` with u in [0, cxEmu] and v in
   * [0, cyEmu] - onto the slide. Present only when a composed rotation or
   * mirror inside a group makes the axis-aligned box above an approximation; a
   * consumer that needs exactness reads this instead of `rot` and the flips.
   */
  transform?: PptxAffine;
  /**
   * The node is mirrored left to right (`flipH`) or top to bottom (`flipV`)
   * about its own centre, and `rot` then turns the mirrored result, which is
   * the order both OOXML and an SVG `rotate(...) scale(-1, 1)` use. Read from
   * the element's own `a:xfrm` and composed with every enclosing group's, so a
   * mirror inside a mirrored group cancels. Never both at once: two mirrors are
   * a half turn, which `rot` states instead.
   */
  flipH?: true;
  flipV?: true;
  /**
   * The group ancestry, outermost first. Each entry is the group's
   * `p:cNvPr@id`, or a minted `g<n>` when the group states none. Absent for a
   * node that sits straight on the slide.
   */
  groupPath?: string[];
  /** The author's alternative text: `p:cNvPr@descr`, else `@title`. */
  alt?: string;
}

/**
 * One `a:path` of a custom geometry (plan 275 decision 32), as SVG path data in
 * the path's own coordinate space, `0..w` by `0..h`, which DrawingML stretches
 * onto the shape's box. Every command is written absolute: `moveTo` as M,
 * `lnTo` as L, `cubicBezTo` as C, `quadBezTo` raised to C, `arcTo` as cubics in
 * quarter turns or less, `close` as Z.
 */
export interface PptxCustGeomPath {
  d: string;
  /** The path's own coordinate space (`a:path@w` / `@h`, else the shape's extents). */
  w: number;
  h: number;
  /** `a:path@fill="none"`: the path is outline only. */
  noFill?: true;
  /** `a:path@stroke="0"`: the path is fill only. */
  noStroke?: true;
}

/** A shape's custom geometry, read when it states `a:custGeom` in place of `a:prstGeom`. */
export interface PptxCustGeom {
  paths: PptxCustGeomPath[];
}

export interface PptxTextNode extends NodeBox {
  type: 'text';
  paras: PptxReadPara[];
  geom?: string;
  /** The outline of a freeform text shape, when it states custom geometry (see `PptxShapeNode.custGeom`). */
  custGeom?: PptxCustGeom;
  fill?: PptxReadColor;
  /** `true` when the source stated an `a:gradFill`; `fill`, when present, is its lowest stop. */
  gradient?: true;
  ph?: PptxPlaceholder;
}
export interface PptxShapeNode extends NodeBox {
  type: 'shape';
  geom?: string;
  /**
   * The outline a freeform states in `a:custGeom`, when it states one. `geom` stays
   * absent for such a shape, which is how a consumer tells custom geometry from a
   * preset. Absent too when the geometry names guides this reader does not evaluate
   * or passes the caps (`MAX_CUSTGEOM_PATHS`, `MAX_CUSTGEOM_CHARS`); a warning says so.
   */
  custGeom?: PptxCustGeom;
  fill?: PptxReadColor;
  line?: PptxReadColor;
  /** outline width in POINTS from `a:ln@w` (OOXML stores EMU; 12700 = 1pt). */
  lineWidthPt?: number;
  /** `true` when the OUTLINE was an `a:gradFill`; `line`, when present, is its lowest stop. */
  lineGradient?: true;
  /** `true` when the source stated an `a:gradFill`; `fill`, when present, is its lowest stop. */
  gradient?: true;
  ph?: PptxPlaceholder;
}
export interface PptxPicNode extends NodeBox {
  type: 'pic';
  /** the `r:embed` relationship id on the blip. */
  embed?: string;
  /** the media part path the rel resolves to (e.g. "ppt/media/image1.png"). */
  media?: string;
  /**
   * The SVG part the Office 2016 extension names beside the raster
   * (`a:blip/a:extLst/a:ext/asvg:svgBlip@r:embed`), when the picture carries one.
   * `media` is then the raster stand-in PowerPoint draws where SVG is not
   * supported; this is the drawing itself (plan 275 decision 32).
   */
  svg?: string;
  /**
   * The picture's crop (`a:blipFill/a:srcRect`), as fractions of the source cut
   * from each edge; a negative value is a margin. PowerPoint applies it to the
   * `svgBlip` as it does to the raster. Absent when the picture is shown whole.
   */
  srcRect?: { l?: number; t?: number; r?: number; b?: number };
}
export interface PptxTableNode extends NodeBox {
  type: 'table';
  /** cell text, row-major; styling is deferred. */
  rows: string[][];
}
/** One series of a native chart, read from the chart part's own value cache. */
export interface PptxChartSeries {
  /** The series name from `c:tx`, when the part states one. */
  name?: string;
  /** Values by category index. A hole in the cache reads as 0. */
  values: number[];
}

/**
 * What a native chart states about itself in its `ppt/charts/chart*.xml` part:
 * the plot element found, the category labels and the cached numbers. These are
 * the values the writer CACHED beside the chart, so they are what PowerPoint
 * last drew, not the embedded workbook's live cells.
 */
export interface PptxChartData {
  /** The plot element's local name: `barChart`, `pieChart`, `lineChart`, ... */
  type?: string;
  /** `bar` (horizontal bars) or `col` (vertical), stated by a bar chart only. */
  barDir?: string;
  categories?: string[];
  series: PptxChartSeries[];
}

export interface PptxUnknownNode extends NodeBox {
  type: 'unknown';
  /** best-effort tag hint (local element name or graphicData uri). */
  tag?: string;
  /**
   * A picture the FILE itself carries for content this reader does not model:
   * the `mc:Fallback` branch of an `mc:AlternateContent`, else an image part the
   * chart's own relationships name. The value is the media part path, so the
   * caller can hold the exact bytes. Absent when the package carries no such
   * picture, which is the honest answer rather than a drawn stand-in.
   */
  fallbackMedia?: string;
  /** The cached series of a native chart, when the chart part states them. */
  chartData?: PptxChartData;
}

/**
 * Why a read carries less than the file holds. Every cap in this module reports
 * through one of these instead of truncating in silence, so stage 1 of a
 * renovation can account for what it did not get (plan 274 section 3.1).
 */
export const PPTX_READ_WARNING_CODES = [
  'nodes-truncated',
  'slides-truncated',
  'part-too-large',
  'group-depth-exceeded',
  'media-skipped',
] as const;
export type PptxReadWarningCode = (typeof PPTX_READ_WARNING_CODES)[number];

export interface PptxReadWarning {
  code: PptxReadWarningCode;
  /** Plain English, naming what was dropped. A report localises by code, not by this text. */
  message: string;
  /** The slide it happened on, when it happened on one. */
  slideIndex?: number;
  /** How often this same warning was raised. */
  count?: number;
}

export type PptxReadNode =
  | PptxTextNode
  | PptxShapeNode
  | PptxPicNode
  | PptxTableNode
  | PptxUnknownNode;

/** A slide's ground: the `p:bg` of the slide itself, else its layout's, else its master's. */
export interface PptxBackground {
  /** A solid fill (`p:bgPr/a:solidFill`), or a style reference's colour (`p:bgRef`). */
  color?: PptxReadColor;
  /** A picture fill (`p:bgPr/a:blipFill`): the media part path the rel resolves to. */
  media?: string;
  /** `true` when the ground was an `a:gradFill`; `color`, when present, is its lowest stop. */
  gradient?: true;
}

export interface PptxReadSlide {
  index: number;
  nodes: PptxReadNode[];
  notes?: string;
  /**
   * The furniture the slide INHERITS from its layout and master (1.166): every
   * non-placeholder shape, picture and graphic frame of the master (unless the
   * layout or the slide says `showMasterSp="0"`), then of the layout, in paint
   * order, painted BEHIND `nodes`. A template deck's logos, colour bars and page
   * furniture live here rather than on the slides - a Google Slides export of a
   * branded template has slides that are nothing but empty placeholders, and
   * without this layer every one of them read as blank. Absent when there is none.
   */
  inherited?: PptxReadNode[];
  /** The slide's ground, resolved slide → layout → master. Absent when none declares one. */
  background?: PptxBackground;
  /**
   * The name the slide's layout states for itself (`p:cSld@name` on the layout
   * part, "Title and Content", "Two Content"), when it states one. Plan 275
   * section 3.2 reads it as a prior; absent when there is no layout or no name.
   */
  layoutName?: string;
  /**
   * The slide's narration clip, resolved from its audio relationship (plans/180
   * section 5). Absent when the slide has no sound. The Design importer binds this to a
   * `kind:'audio'` box; the bytes stay in the caller's part map, this only names the part.
   *
   * NOT a claim about word timings. Audio we did not synthesise has none, so captions for
   * it must be recovered by Whisper and filed under their own key - see the plan's note
   * that the two rungs are different claims about where the words came from.
   */
  audio?: PptxSlideAudio;
}

/** One sound part a slide points at: the zip part path and its lowercased extension. */
export interface PptxSlideAudio {
  /** The zip part path, e.g. "ppt/media/audio1.wav". */
  part: string;
  /** The part's extension, lowercased and without the dot, e.g. "wav". */
  ext: string;
}

export interface PptxReadTheme {
  /** slot → bare uppercase RRGGBB (matches pptx.ts theme convention). */
  colors: Record<string, string>;
  majorFont?: string;
  minorFont?: string;
}

/** The source package's own docProps/core.xml facts (plans/144 Wave 2 G6):
 *  who made the deck and what it says about itself, surfaced so a round trip
 *  can carry the SOURCE's authorship instead of silently re-authoring it. */
export interface OoxmlCoreProps {
  title?: string;
  creator?: string;
  description?: string;
  /** dcterms:created, verbatim W3CDTF text. */
  created?: string;
}

export interface PptxDeckRead {
  widthEmu: number;
  heightEmu: number;
  theme: PptxReadTheme;
  slides: PptxReadSlide[];
  /** Present when the package carries readable core properties. */
  coreProps?: OoxmlCoreProps;
  /**
   * What the read could not carry: caps reached, parts skipped, media that
   * resolved to nothing. `readPptx` ALWAYS sets it (an empty array when the file
   * read in full). It is optional on the type only so hand-built `PptxDeckRead`
   * literals elsewhere in the tree keep compiling.
   */
  warnings?: PptxReadWarning[];
}

// ─── hardening caps ──────────────────────────────────────────────────────────

const MAX_PART_BYTES = 24 * 1024 * 1024; // skip parsing a part bigger than this
const MAX_PART_CHARS = 16 * 1024 * 1024;
const MAX_SLIDES = 2000;
const MAX_NODES_PER_SLIDE = 8000;
const MAX_GROUP_DEPTH = 16;
const MAX_PARAS = 4000;
const MAX_RUNS_PER_PARA = 4000;
const MAX_TABLE_ROWS = 2000;
const MAX_TABLE_COLS = 512;
const MAX_TEXT_LEN = 200_000; // per run/cell text clamp
const MAX_DFS_VISITS = 200_000; // bound any descendant search
const MAX_PH_TYPE_LEN = 64; // a ph type is a short enum value; clamp a hostile one
const MAX_PH_IDX = 1_000_000;
const MAX_OUTLINE_LVL = 8; // OOXML allows nine outline levels (0..8)
const LVL_COUNT = MAX_OUTLINE_LVL + 1;
const MAX_PH_PER_PART = 2000; // a real layout/master carries under 40
const MAX_STYLE_PARTS = 256; // distinct layout+master parts parsed per deck
const EMU_PER_PT = 12700;
const MAX_COORD = 1e11; // EMU magnitude clamp (slide width is ~1.2e7)
const MAX_ALT_LEN = 4096; // alt text is a sentence, not a payload
const MAX_LAYOUT_NAME_LEN = 256; // a layout name is a short label
const MAX_TOKEN_LEN = 64; // a style token (underline kind, numbering scheme) is a short enum value
const MAX_BULLET_CHAR_LEN = 8; // a bullet glyph is one grapheme; clamp a hostile one
const MAX_NUMBER_START = 32_767; // the schema's own ceiling for buAutoNum startAt
const MAX_SPACING_PT = 1584; // the schema's ceiling for spcPts (158400 hundredths)
const MAX_SPACING_PCT = 13_200; // the schema's ceiling for spcPct (13200000 thousandths)
const MAX_INDENT_EMU = 51_206_400; // the schema's ceiling for marL and indent
const MAX_HREF_LEN = 4096;
const MAX_GROUP_ID_LEN = 64; // a cNvPr id is a small integer in practice
const MAX_CHART_SERIES = 256;
const MAX_CHART_POINTS = 8192;
const MAX_CHART_LABEL_LEN = 1024;
/** Paths one custom geometry may state before the outline is left unread. */
const MAX_CUSTGEOM_PATHS = 64;
/** Characters of written path data per custom geometry: half the SVG tokenizer's own ceiling, for headroom. */
const MAX_CUSTGEOM_CHARS = 200_000;
/** Drawing commands per custom geometry, so a hostile pathLst is bounded before it is written out. */
const MAX_CUSTGEOM_COMMANDS = 20_000;
const MAX_CLR_TRANSFORMS = 16; // colour transforms stated on one colour element
const MAX_WARNINGS = 256; // distinct warnings kept; repeats fold into a count
const DEFAULT_W_EMU = 12_192_000; // 13.333in, 16:9 default
const DEFAULT_H_EMU = 6_858_000; // 7.5in

// Node type constant (avoids depending on the DOM `Node` value namespace).
const ELEMENT_NODE = 1;

// ─── warnings ────────────────────────────────────────────────────────────────

/**
 * Collects warnings, folding a repeat of one code on one slide into a count so a
 * deck that hit the same cap a thousand times yields one row, not a thousand.
 */
interface WarnSink {
  list: PptxReadWarning[];
  add(code: PptxReadWarningCode, message: string, slideIndex?: number): void;
}

const WARNINGS_OVERFLOWED = `more than ${MAX_WARNINGS - 1} kinds of warning were raised; the rest are counted here only`;

function makeWarnSink(): WarnSink {
  const list: PptxReadWarning[] = [];
  const byKey = new Map<string, PptxReadWarning>();
  return {
    list,
    add(code: PptxReadWarningCode, message: string, slideIndex?: number): void {
      const key = `${code}|${slideIndex ?? ''}|${message}`;
      const hit = byKey.get(key);
      if (hit) {
        hit.count = (hit.count ?? 1) + 1;
        return;
      }
      const entry: PptxReadWarning = { code, message, count: 1 };
      if (slideIndex !== undefined) entry.slideIndex = slideIndex;
      // Registered before the list is asked whether it has room, so a repeat of
      // a kind the list could not keep is still added to that kind's own count
      // rather than being counted nowhere.
      byKey.set(key, entry);
      if (list.length < MAX_WARNINGS - 1) {
        list.push(entry);
        return;
      }
      // The last slot is kept for the list's own account of what it left out,
      // so a reader is never told a truncated list is the whole story.
      const over = list[MAX_WARNINGS - 1];
      if (over && over.message === WARNINGS_OVERFLOWED) {
        over.count = (over.count ?? 1) + 1;
        return;
      }
      list.push({ code: 'nodes-truncated', message: WARNINGS_OVERFLOWED, count: 1 });
    },
  };
}

// ─── low-level, namespace-agnostic DOM helpers (operate on the INJECTED doc) ──

/** Local (prefix-free) name of an element/attr node. */
function localName(nodeName: string | null, localHint: string | null): string {
  const raw = localHint || nodeName || '';
  const i = raw.indexOf(':');
  return i >= 0 ? raw.slice(i + 1) : raw;
}

function elemLocal(el: Element): string {
  return localName(el.nodeName, (el as { localName?: string | null }).localName ?? null);
}

function isElement(n: Node | null | undefined): n is Element {
  return n != null && n.nodeType === ELEMENT_NODE;
}

function childElements(el: Element): Element[] {
  const out: Element[] = [];
  const kids = el.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i];
    if (isElement(n)) out.push(n as unknown as Element);
  }
  return out;
}

function firstChildByLocal(el: Element, local: string): Element | null {
  const kids = el.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i];
    if (isElement(n) && elemLocal(n as unknown as Element) === local) return n as unknown as Element;
  }
  return null;
}

function childrenByLocal(el: Element, local: string): Element[] {
  return childElements(el).filter((c) => elemLocal(c) === local);
}

/** First descendant (DFS, bounded) whose local name matches. */
function descendantByLocal(root: Element, local: string): Element | null {
  let visits = 0;
  const stack: Element[] = [root];
  while (stack.length) {
    const el = stack.pop() as Element;
    if (++visits > MAX_DFS_VISITS) return null;
    if (el !== root && elemLocal(el) === local) return el;
    const kids = el.childNodes;
    // push in reverse so DFS keeps document order-ish (order doesn't matter here)
    for (let i = kids.length - 1; i >= 0; i--) {
      const n = kids[i];
      if (isElement(n)) stack.push(n as unknown as Element);
    }
  }
  return null;
}

/** Attribute value by LOCAL name (handles namespaced attrs like `r:embed`). */
function attrByLocal(el: Element, local: string): string | null {
  // Fast path: plain (unprefixed) attribute.
  const direct = el.getAttribute(local);
  if (direct != null) return direct;
  const attrs = el.attributes;
  if (!attrs) return null;
  for (let i = 0; i < attrs.length; i++) {
    const a = attrs[i] as Attr;
    if (localName(a.name, (a as { localName?: string | null }).localName ?? null) === local) return a.value;
  }
  return null;
}

function textOf(el: Element | null): string {
  if (!el) return '';
  const t = el.textContent ?? '';
  return t.length > MAX_TEXT_LEN ? t.slice(0, MAX_TEXT_LEN) : t;
}

// ─── value coercion ──────────────────────────────────────────────────────────

function toInt(v: string | null, def = 0): number {
  if (v == null) return def;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(-MAX_COORD, Math.min(MAX_COORD, n));
}

function truthy(v: string | null): boolean {
  return v === '1' || v === 'true' || v === 'on';
}

/** Normalise any colour string to bare uppercase RRGGBB. */
function normHex(v: string | null): string | undefined {
  if (!v) return undefined;
  const hex = v.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (hex.length < 6) return undefined;
  return hex.slice(0, 6);
}

// ─── part access + decode ────────────────────────────────────────────────────

interface PartStore {
  get(path: string): string | null;
  keys(): string[];
}

function makeStore(parts: PptxParts, onOversize?: (path: string) => void): PartStore {
  // Build a case-insensitive index once (OOXML paths are consistent-case in
  // practice, but a hostile/rezipped archive may not be).
  const lower = new Map<string, string>();
  const keys: string[] = [];
  for (const k of Object.keys(parts)) {
    keys.push(k);
    if (!lower.has(k.toLowerCase())) lower.set(k.toLowerCase(), k);
  }
  const decode = (raw: Uint8Array | string, path: string): string | null => {
    if (typeof raw === 'string') {
      if (raw.length <= MAX_PART_CHARS) return raw;
      onOversize?.(path);
      return null;
    }
    if (raw.byteLength > MAX_PART_BYTES) {
      onOversize?.(path);
      return null;
    }
    try {
      return new TextDecoder('utf-8').decode(raw);
    } catch {
      return null;
    }
  };
  return {
    keys: () => keys,
    get(path: string): string | null {
      let raw = parts[path];
      if (raw === undefined) {
        const real = lower.get(path.toLowerCase());
        if (real === undefined) return null;
        raw = parts[real];
      }
      if (raw === undefined) return null;
      return decode(raw, path);
    },
  };
}

/** Parse a part to a Document, or null on missing/oversized/malformed. */
function parsePart(store: PartStore, path: string, parseXml: XmlParser): Document | null {
  const xml = store.get(path);
  if (xml == null || xml.length === 0) return null;
  let doc: Document;
  try {
    doc = parseXml(xml);
  } catch {
    return null;
  }
  const root = doc?.documentElement;
  if (!root) return null;
  // Both browsers and jsdom surface XML syntax errors as a <parsererror> root.
  if (elemLocal(root) === 'parsererror') return null;
  return doc;
}

// ─── path resolution for relationships ───────────────────────────────────────

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}
function baseOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? path : path.slice(i + 1);
}

/** Resolve a relationship Target (possibly `../`-relative) against a base dir. */
function resolveTarget(baseDir: string, target: string): string {
  if (!target) return target;
  if (target.startsWith('/')) return target.slice(1); // package-absolute
  const segs = (baseDir ? baseDir.split('/') : []).concat(target.split('/'));
  const out: string[] = [];
  for (const s of segs) {
    if (s === '' || s === '.') continue;
    if (s === '..') out.pop();
    else out.push(s);
  }
  return out.join('/');
}

interface Rel {
  id: string;
  type: string;
  target: string; // resolved absolute part path (or external URL untouched)
  external: boolean;
}

/** The rels part for `partPath` is `<dir>/_rels/<base>.rels`. */
function relsPathFor(partPath: string): string {
  const dir = dirOf(partPath);
  const base = baseOf(partPath);
  return (dir ? `${dir}/` : '') + `_rels/${base}.rels`;
}

function parseRels(store: PartStore, partPath: string, parseXml: XmlParser): Rel[] {
  const doc = parsePart(store, relsPathFor(partPath), parseXml);
  if (!doc?.documentElement) return [];
  const baseDir = dirOf(partPath);
  const out: Rel[] = [];
  for (const rel of childElements(doc.documentElement)) {
    if (elemLocal(rel) !== 'Relationship') continue;
    const id = attrByLocal(rel, 'Id') || '';
    const type = attrByLocal(rel, 'Type') || '';
    const target = attrByLocal(rel, 'Target') || '';
    const mode = attrByLocal(rel, 'TargetMode') || '';
    const external = mode.toLowerCase() === 'external';
    out.push({ id, type, external, target: external ? target : resolveTarget(baseDir, target) });
    if (out.length > 100_000) break;
  }
  return out;
}

// ─── colour resolution ───────────────────────────────────────────────────────

// Default clrMap: how the master maps the placeholder slots (bg/tx) to the
// theme's dk/lt slots. Per-slide clrMapOvr is DEFERRED: the default is assumed.
function schemeSlotToThemeKey(slot: string): string {
  switch (slot) {
    case 'bg1':
      return 'lt1';
    case 'tx1':
      return 'dk1';
    case 'bg2':
      return 'lt2';
    case 'tx2':
      return 'dk2';
    default:
      return slot; // accent1..6, hlink, folHlink, dk1/lt1/dk2/lt2, phClr
  }
}

function resolveScheme(slot: string, theme: PptxReadTheme): PptxReadColor {
  const hex = theme.colors[schemeSlotToThemeKey(slot)];
  return hex ? { scheme: slot, hex } : { scheme: slot };
}

/** The DrawingML colour transforms this reader folds in, as fractions of 1. */
interface ClrMods {
  lumMod?: number;
  lumOff?: number;
  tint?: number;
  shade?: number;
}

/** A DrawingML percentage attribute (`val` in thousandths of a percent) as a fraction. */
function pctOf(el: Element): number | undefined {
  const raw = attrByLocal(el, 'val');
  if (raw == null) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(-10, Math.min(10, n / 100_000));
}

/** The transforms a colour element states on itself, capped and order-free. */
function readClrMods(clr: Element): ClrMods | undefined {
  let out: ClrMods | undefined;
  let seen = 0;
  for (const c of childElements(clr)) {
    if (++seen > MAX_CLR_TRANSFORMS) break;
    const ln = elemLocal(c);
    if (ln !== 'lumMod' && ln !== 'lumOff' && ln !== 'tint' && ln !== 'shade') continue;
    const v = pctOf(c);
    if (v === undefined) continue;
    if (!out) out = {};
    out[ln] = v;
  }
  return out;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(0, 2), 16) || 0,
    Number.parseInt(hex.slice(2, 4), 16) || 0,
    Number.parseInt(hex.slice(4, 6), 16) || 0,
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const one = (v: number): string => {
    const n = Math.max(0, Math.min(255, Math.round(v)));
    return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
  };
  return one(r) + one(g) + one(b);
}

/** sRGB 0..255 to HSL with h in [0, 6) sextants and s/l in [0, 1]. No transcendentals. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h, s, l];
}

function hueToChannel(p1: number, q1: number, t: number): number {
  let x = t;
  if (x < 0) x += 6;
  if (x >= 6) x -= 6;
  if (x < 1) return p1 + (q1 - p1) * x;
  if (x < 3) return q1;
  if (x < 4) return p1 + (q1 - p1) * (4 - x);
  return p1;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q1 = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p1 = 2 * l - q1;
  return [hueToChannel(p1, q1, h + 2) * 255, hueToChannel(p1, q1, h) * 255, hueToChannel(p1, q1, h - 2) * 255];
}

/**
 * An sRGB code (0..255) as LINEAR light, scaled to 0..65535.
 *
 * Written down rather than computed: the sRGB transfer curve needs a fractional
 * exponent, and two JavaScript engines may disagree about its last bit, which
 * would let one deck read a different hex on the web shell and on the CLI. Each
 * entry is `round(65535 * f(i / 255))` with `f(v) = v / 12.92` up to 0.04045 and
 * `((v + 0.055) / 1.055) ** 2.4` above it (IEC 61966-2-1). Strictly increasing,
 * so the search below inverts it exactly.
 */
const SRGB_TO_LINEAR: readonly number[] = [
  0, 20, 40, 60, 80, 99, 119, 139, 159, 179, 199, 219, 241, 264, 288, 313,
  340, 367, 396, 427, 458, 491, 526, 562, 599, 637, 677, 718, 761, 805, 851, 898,
  947, 997, 1048, 1101, 1156, 1212, 1270, 1330, 1391, 1453, 1517, 1583, 1651, 1720, 1790, 1863,
  1937, 2013, 2090, 2170, 2250, 2333, 2418, 2504, 2592, 2681, 2773, 2866, 2961, 3058, 3157, 3258,
  3360, 3464, 3570, 3678, 3788, 3900, 4014, 4129, 4247, 4366, 4488, 4611, 4736, 4864, 4993, 5124,
  5257, 5392, 5530, 5669, 5810, 5953, 6099, 6246, 6395, 6547, 6700, 6856, 7014, 7174, 7335, 7500,
  7666, 7834, 8004, 8177, 8352, 8528, 8708, 8889, 9072, 9258, 9445, 9635, 9828, 10022, 10219, 10417,
  10619, 10822, 11028, 11235, 11446, 11658, 11873, 12090, 12309, 12530, 12754, 12980, 13209, 13440, 13673, 13909,
  14146, 14387, 14629, 14874, 15122, 15371, 15623, 15878, 16135, 16394, 16656, 16920, 17187, 17456, 17727, 18001,
  18277, 18556, 18837, 19121, 19407, 19696, 19987, 20281, 20577, 20876, 21177, 21481, 21787, 22096, 22407, 22721,
  23038, 23357, 23678, 24002, 24329, 24658, 24990, 25325, 25662, 26001, 26344, 26688, 27036, 27386, 27739, 28094,
  28452, 28813, 29176, 29542, 29911, 30282, 30656, 31033, 31412, 31794, 32179, 32567, 32957, 33350, 33745, 34143,
  34544, 34948, 35355, 35764, 36176, 36591, 37008, 37429, 37852, 38278, 38706, 39138, 39572, 40009, 40449, 40891,
  41337, 41785, 42236, 42690, 43147, 43606, 44069, 44534, 45002, 45473, 45947, 46423, 46903, 47385, 47871, 48359,
  48850, 49344, 49841, 50341, 50844, 51349, 51858, 52369, 52884, 53401, 53921, 54445, 54971, 55500, 56032, 56567,
  57105, 57646, 58190, 58737, 59287, 59840, 60396, 60955, 61517, 62082, 62650, 63221, 63795, 64372, 64952, 65535,
];

/** The sRGB code whose linear value is nearest `lin` (0..65535). */
function linearToSrgb(lin: number): number {
  const want = lin < 0 ? 0 : lin > 65535 ? 65535 : lin;
  let lo = 0;
  let hi = 255;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((SRGB_TO_LINEAR[mid] ?? 0) < want) lo = mid + 1;
    else hi = mid;
  }
  const here = SRGB_TO_LINEAR[lo] ?? 0;
  const under = lo > 0 ? SRGB_TO_LINEAR[lo - 1] ?? 0 : here;
  return lo > 0 && Math.abs(under - want) <= Math.abs(here - want) ? lo - 1 : lo;
}

/**
 * Fold the stated transforms into a base hex.
 *
 * ECMA-376 states shade and tint against LINEAR light, so this reader converts
 * through the pinned table above instead of multiplying the 0..255 codes: on a
 * theme accent the two answers differ by tens of codes per channel, enough to
 * stop a colour census recognising the value the deck actually shows. lumMod /
 * lumOff move the HSL lightness, which is what PowerPoint's own "Lighter 40%"
 * palette does. The result is marked `modified` so a consumer knows it is a
 * computed value, not a stated one.
 */
function applyClrMods(hex: string, mods: ClrMods): string {
  let [r, g, b] = hexToRgb(hex);
  if (mods.shade !== undefined || mods.tint !== undefined) {
    // A shade is that share of the colour against black, a tint that share
    // against white, both measured in light rather than in code values.
    const shade = mods.shade === undefined ? 1 : clamp01(mods.shade);
    const tint = mods.tint === undefined ? 1 : clamp01(mods.tint);
    const mix = (c: number): number => {
      const code = Math.max(0, Math.min(255, Math.round(c)));
      const lin = SRGB_TO_LINEAR[code] ?? 0;
      return linearToSrgb(lin * shade * tint + 65535 * (1 - tint));
    };
    r = mix(r);
    g = mix(g);
    b = mix(b);
  }
  if (mods.lumMod !== undefined || mods.lumOff !== undefined) {
    const [h, s, l] = rgbToHsl(r, g, b);
    const lit = clamp01(l * (mods.lumMod ?? 1) + (mods.lumOff ?? 0));
    [r, g, b] = hslToRgb(h, s, lit);
  }
  return rgbToHex(r, g, b);
}

/** Fold a colour element's own transforms into a resolved colour, keeping its slot. */
function withClrMods(color: PptxReadColor, clr: Element): PptxReadColor {
  const mods = readClrMods(clr);
  if (!mods || color.hex === undefined) return color;
  const hex = applyClrMods(color.hex, mods);
  if (hex === color.hex) return color;
  return 'scheme' in color ? { scheme: color.scheme, hex, modified: true } : { hex, modified: true };
}

/**
 * Read the colour inside a container element (a `solidFill`, a gradient stop, or
 * a clrScheme slot). Recognises srgbClr / schemeClr / sysClr, and folds the
 * lumMod / lumOff / tint / shade transforms stated on the colour into the hex.
 * pattFill / prstClr still read as undefined (deferred).
 */
function readColor(container: Element | null, theme: PptxReadTheme): PptxReadColor | undefined {
  if (!container) return undefined;
  for (const c of childElements(container)) {
    const ln = elemLocal(c);
    if (ln === 'srgbClr') {
      const hex = normHex(attrByLocal(c, 'val'));
      if (hex) return withAlpha(withClrMods({ hex }, c), c);
    } else if (ln === 'schemeClr') {
      const slot = attrByLocal(c, 'val');
      if (slot) return withAlpha(withClrMods(resolveScheme(slot, theme), c), c);
    } else if (ln === 'sysClr') {
      const hex = normHex(attrByLocal(c, 'lastClr') || attrByLocal(c, 'val'));
      if (hex) return withAlpha(withClrMods({ hex }, c), c);
    }
  }
  return undefined;
}

/**
 * A colour element's own `a:alpha` (thousandths of a percent, 100000 opaque), kept
 * on the colour as 0 to 1 when it is under 1. A translucent chart label or a
 * partly transparent freeform then reads as what PowerPoint draws rather than as
 * a solid colour.
 */
function withAlpha(color: PptxReadColor, clr: Element): PptxReadColor {
  const el = firstChildByLocal(clr, 'alpha');
  const raw = el ? attrByLocal(el, 'val') : null;
  if (raw == null || !/^\d+$/.test(raw.trim())) return color;
  const alpha = Math.max(0, Math.min(1, Number(raw) / 100000));
  return alpha < 1 ? { ...color, alpha: Math.round(alpha * 1000) / 1000 } : color;
}

/** What a fill container (`p:spPr`, `a:ln`) paints with. */
interface ReadFill {
  color?: PptxReadColor;
  gradient?: true;
}

/**
 * A fill: `a:solidFill`, else the FIRST STOP of an `a:gradFill` (the lowest
 * `pos`), which is the nearest single colour a flat consumer can use and the one
 * a colour census should count. `gradient` says the source was a ramp, so nobody
 * mistakes the stop for the whole fill. A pattern or picture fill still reads as
 * no colour.
 */
function readFill(container: Element | null, theme: PptxReadTheme): ReadFill {
  if (!container) return {};
  const solid = firstChildByLocal(container, 'solidFill');
  if (solid) {
    const color = readColor(solid, theme);
    if (color) return { color };
  }
  const grad = firstChildByLocal(container, 'gradFill');
  if (!grad) return {};
  const gsLst = firstChildByLocal(grad, 'gsLst');
  let best: { pos: number; color: PptxReadColor } | undefined;
  if (gsLst) {
    for (const gs of childrenByLocal(gsLst, 'gs')) {
      const color = readColor(gs, theme);
      if (!color) continue;
      const pos = toInt(attrByLocal(gs, 'pos'), 0);
      if (!best || pos < best.pos) best = { pos, color };
    }
  }
  return best ? { color: best.color, gradient: true } : { gradient: true };
}

// ─── theme ───────────────────────────────────────────────────────────────────

const THEME_SLOTS = [
  'dk1',
  'lt1',
  'dk2',
  'lt2',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'accent5',
  'accent6',
  'hlink',
  'folHlink',
];

function pickThemePart(store: PartStore): string | null {
  if (store.get('ppt/theme/theme1.xml') != null) return 'ppt/theme/theme1.xml';
  const themes = store
    .keys()
    .filter((k) => /^ppt\/theme\/theme\d+\.xml$/i.test(k))
    .sort();
  return themes[0] ?? null;
}

// docProps/core.xml → the source's own authorship facts. Values are clamped
// like every other text read here; a missing part returns null.
const MAX_CORE_PROP_LEN = 2048;
function readCoreProps(store: PartStore, parseXml: XmlParser): OoxmlCoreProps | null {
  const doc = parsePart(store, 'docProps/core.xml', parseXml);
  const root = doc?.documentElement;
  if (!root) return null;
  const grab = (local: string): string | undefined => {
    const t = descendantByLocal(root, local)?.textContent?.trim();
    return t ? t.slice(0, MAX_CORE_PROP_LEN) : undefined;
  };
  const out: OoxmlCoreProps = {};
  const title = grab('title');
  if (title) out.title = title;
  const creator = grab('creator');
  if (creator) out.creator = creator;
  const description = grab('description');
  if (description) out.description = description;
  const created = grab('created');
  if (created) out.created = created;
  return Object.keys(out).length ? out : null;
}

function readTheme(store: PartStore, parseXml: XmlParser): PptxReadTheme {
  const theme: PptxReadTheme = { colors: {} };
  const path = pickThemePart(store);
  if (!path) return theme;
  const doc = parsePart(store, path, parseXml);
  if (!doc?.documentElement) return theme;
  const root = doc.documentElement;

  const clrScheme = descendantByLocal(root, 'clrScheme');
  if (clrScheme) {
    for (const slotEl of childElements(clrScheme)) {
      const slot = elemLocal(slotEl);
      if (!THEME_SLOTS.includes(slot)) continue;
      // slot element wraps a single srgbClr/sysClr
      for (const c of childElements(slotEl)) {
        const ln = elemLocal(c);
        const hex =
          ln === 'srgbClr'
            ? normHex(attrByLocal(c, 'val'))
            : ln === 'sysClr'
              ? normHex(attrByLocal(c, 'lastClr') || attrByLocal(c, 'val'))
              : undefined;
        if (hex) {
          theme.colors[slot] = hex;
          break;
        }
      }
    }
  }

  const fontScheme = descendantByLocal(root, 'fontScheme');
  if (fontScheme) {
    const major = firstChildByLocal(fontScheme, 'majorFont');
    const minor = firstChildByLocal(fontScheme, 'minorFont');
    const majorLatin = major ? firstChildByLocal(major, 'latin') : null;
    const minorLatin = minor ? firstChildByLocal(minor, 'latin') : null;
    const mj = majorLatin ? attrByLocal(majorLatin, 'typeface') : null;
    const mn = minorLatin ? attrByLocal(minorLatin, 'typeface') : null;
    if (mj) theme.majorFont = mj;
    if (mn) theme.minorFont = mn;
  }
  return theme;
}

// ─── geometry ────────────────────────────────────────────────────────────────

/** Read an `xfrm` that is a direct child of `container` (spPr for sp/pic; the
 *  graphicFrame itself for tables; there it's `p:xfrm`, same local name). */
function readXfrm(container: Element | null): NodeBox {
  const box: NodeBox = { xEmu: 0, yEmu: 0, cxEmu: 0, cyEmu: 0 };
  if (!container) return box;
  const xfrm = firstChildByLocal(container, 'xfrm');
  if (!xfrm) return box;
  const off = firstChildByLocal(xfrm, 'off');
  const ext = firstChildByLocal(xfrm, 'ext');
  if (off) {
    box.xEmu = toInt(attrByLocal(off, 'x'));
    box.yEmu = toInt(attrByLocal(off, 'y'));
  }
  if (ext) {
    box.cxEmu = toInt(attrByLocal(ext, 'cx'));
    box.cyEmu = toInt(attrByLocal(ext, 'cy'));
  }
  const rot = attrByLocal(xfrm, 'rot');
  if (rot) {
    const deg = toInt(rot) / 60000;
    if (deg) box.rot = deg;
  }
  return box;
}

/** `flipH` / `flipV` on the element's own `a:xfrm`, as -1 / 1 multipliers. */
function readFlips(container: Element | null): [number, number] {
  const xfrm = container ? firstChildByLocal(container, 'xfrm') : null;
  if (!xfrm) return [1, 1];
  return [truthy(attrByLocal(xfrm, 'flipH')) ? -1 : 1, truthy(attrByLocal(xfrm, 'flipV')) ? -1 : 1];
}

const IDENTITY: PptxAffine = [1, 0, 0, 1, 0, 0];

/** The affine that applies `first`, then `then`. */
function mulAffine(then: PptxAffine, first: PptxAffine): PptxAffine {
  return [
    then[0] * first[0] + then[2] * first[1],
    then[1] * first[0] + then[3] * first[1],
    then[0] * first[2] + then[2] * first[3],
    then[1] * first[2] + then[3] * first[3],
    then[0] * first[4] + then[2] * first[5] + then[4],
    then[1] * first[4] + then[3] * first[5] + then[5],
  ];
}

/** A clockwise rotation by `deg`, in the y-down space OOXML coordinates live in. */
function rotAffine(deg: number): PptxAffine {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, -s, c, 0, 0];
}

function clampEmu(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-MAX_COORD, Math.min(MAX_COORD, Math.round(v)));
}

/** The angle of a direction, in degrees, rounded off float noise. */
function degreesOf(x: number, y: number): number {
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  const r = Math.round(deg * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

/** A composed placement as a box can carry it: a mirror, then a turn. */
interface Pose {
  deg: number;
  flipH?: true;
  flipV?: true;
}

/**
 * Split a composed linear part into a rotation and at most one mirror.
 *
 * Everything composed here is a turn, a mirror, or both, so the product is one
 * of those too. When it keeps its orientation the angle says everything. When
 * it mirrors, the SAME matrix reads either as a left-to-right mirror followed
 * by one angle or as a top-to-bottom mirror followed by that angle turned half
 * way round; the reader states whichever angle is nearer zero, so a plain
 * sideways mirror reads as a mirror rather than as a half turn. Taking the
 * angle off the mirroring matrix itself, which `atan2` will happily do, is what
 * turns a mirrored arrow upside down.
 */
function decomposePose(lin: PptxAffine): Pose {
  if (lin[0] * lin[3] - lin[1] * lin[2] >= 0) return { deg: degreesOf(lin[0], lin[1]) };
  const asH = degreesOf(-lin[0], -lin[1]);
  const asV = degreesOf(lin[0], lin[1]);
  return Math.abs(asH) <= Math.abs(asV) ? { deg: asH, flipH: true } : { deg: asV, flipV: true };
}

/**
 * A group's coordinate remap, carried down the walk.
 *
 * `p:grpSpPr/a:xfrm` gives the group's own place on the slide (`off` / `ext`)
 * AND what its children's own coordinates mean (`chOff` / `chExt`), plus the
 * group's rotation and flips. A child's authored box is in the chOff/chExt
 * space, so without composing this every grouped box names the wrong place.
 */
interface GroupCtx {
  m: PptxAffine;
  path: string[];
}

/** Build a group's affine from its `p:grpSpPr/a:xfrm`. */
function groupAffine(grpSp: Element): PptxAffine {
  const pr = firstChildByLocal(grpSp, 'grpSpPr');
  const xfrm = pr ? firstChildByLocal(pr, 'xfrm') : null;
  if (!xfrm) return IDENTITY;
  const off = firstChildByLocal(xfrm, 'off');
  const ext = firstChildByLocal(xfrm, 'ext');
  const chOffEl = firstChildByLocal(xfrm, 'chOff');
  const chExtEl = firstChildByLocal(xfrm, 'chExt');
  const ox = off ? toInt(attrByLocal(off, 'x')) : 0;
  const oy = off ? toInt(attrByLocal(off, 'y')) : 0;
  const ecx = ext ? toInt(attrByLocal(ext, 'cx')) : 0;
  const ecy = ext ? toInt(attrByLocal(ext, 'cy')) : 0;
  const rawCcx = chExtEl ? toInt(attrByLocal(chExtEl, 'cx')) : 0;
  const rawCcy = chExtEl ? toInt(attrByLocal(chExtEl, 'cy')) : 0;
  // A group that states no usable child extent states no remap: its children's
  // coordinates are already the parent's, so the child space IS the group box
  // and the scale stays 1 rather than dividing by zero.
  const haveCh = rawCcx > 0 && rawCcy > 0;
  const cox = haveCh && chOffEl ? toInt(attrByLocal(chOffEl, 'x')) : haveCh ? 0 : ox;
  const coy = haveCh && chOffEl ? toInt(attrByLocal(chOffEl, 'y')) : haveCh ? 0 : oy;
  const ccx = haveCh ? rawCcx : ecx;
  const ccy = haveCh ? rawCcy : ecy;
  const sx = ccx > 0 && ecx > 0 ? ecx / ccx : 1;
  const sy = ccy > 0 && ecy > 0 ? ecy / ccy : 1;
  const fh = truthy(attrByLocal(xfrm, 'flipH')) ? -1 : 1;
  const fv = truthy(attrByLocal(xfrm, 'flipV')) ? -1 : 1;
  const rawRot = attrByLocal(xfrm, 'rot');
  const deg = rawRot ? toInt(rawRot) / 60000 : 0;
  // Centre out: put the child space's centre at the origin, scale and flip it,
  // rotate it, then move it to where the slide says the group sits.
  const toCentre: PptxAffine = [1, 0, 0, 1, -(cox + ccx / 2), -(coy + ccy / 2)];
  const scale: PptxAffine = [sx * fh, 0, 0, sy * fv, 0, 0];
  const rot = deg ? rotAffine(deg) : IDENTITY;
  const place: PptxAffine = [1, 0, 0, 1, ox + ecx / 2, oy + ecy / 2];
  return mulAffine(place, mulAffine(rot, mulAffine(scale, toCentre)));
}

/**
 * Put an authored child box into SLIDE coordinates.
 *
 * The reported box stays axis-aligned: the composed centre, and the extent
 * scaled by the group's own scale. The composed turn and mirror are reported as
 * `rot` plus `flipH` / `flipV`; `transform` is added as well whenever that pair
 * only approximates the node's placement, and `groupPath` records which groups
 * it came through. With no group the authored box and rotation are
 * kept exactly as they were and the element's own mirror is stated, since a
 * mirror about a box's own centre leaves that box where it is.
 */
function composeBox(box: NodeBox, flips: [number, number], group: GroupCtx | undefined): NodeBox {
  if (!group) {
    if (flips[0] > 0 && flips[1] > 0) return box;
    const own: NodeBox = { xEmu: box.xEmu, yEmu: box.yEmu, cxEmu: box.cxEmu, cyEmu: box.cyEmu };
    if (box.rot) own.rot = box.rot;
    if (flips[0] < 0) own.flipH = true;
    if (flips[1] < 0) own.flipV = true;
    return own;
  }
  const m = group.m;
  const gsx = Math.hypot(m[0], m[1]) || 1;
  const gsy = Math.hypot(m[2], m[3]) || 1;
  const w = box.cxEmu * gsx;
  const h = box.cyEmu * gsy;
  const lx = box.xEmu + box.cxEmu / 2;
  const ly = box.yEmu + box.cyEmu / 2;
  const cx = m[0] * lx + m[2] * ly + m[4];
  const cy = m[1] * lx + m[3] * ly + m[5];
  // The group's rotation and reflection with its scale divided out, times the
  // child's own. Both are rotations or reflections, so the product is one too.
  const gLin: PptxAffine = [m[0] / gsx, m[1] / gsx, m[2] / gsy, m[3] / gsy, 0, 0];
  const cLin = mulAffine(box.rot ? rotAffine(box.rot) : IDENTITY, [flips[0], 0, 0, flips[1], 0, 0]);
  const lin = mulAffine(gLin, cLin);
  const out: NodeBox = {
    xEmu: clampEmu(cx - w / 2),
    yEmu: clampEmu(cy - h / 2),
    cxEmu: clampEmu(w),
    cyEmu: clampEmu(h),
  };
  const pose = decomposePose(lin);
  if (pose.deg) out.rot = pose.deg;
  if (pose.flipH) out.flipH = true;
  if (pose.flipV) out.flipV = true;
  const straight = Math.abs(lin[0] - 1) < 1e-9 && Math.abs(lin[1]) < 1e-9 && Math.abs(lin[2]) < 1e-9 && Math.abs(lin[3] - 1) < 1e-9;
  if (!straight) {
    out.transform = [
      lin[0],
      lin[1],
      lin[2],
      lin[3],
      cx - (lin[0] * w + lin[2] * h) / 2,
      cy - (lin[1] * w + lin[3] * h) / 2,
    ];
  }
  out.groupPath = group.path.slice();
  return out;
}

/** `p:cNvPr` of a shape, picture, connector, group or graphic frame. */
function cNvPrOf(el: Element): Element | null {
  for (const child of childElements(el)) {
    if (!/^nv(Sp|Pic|GrpSp|CxnSp|GraphicFrame)Pr$/.test(elemLocal(child))) continue;
    const pr = firstChildByLocal(child, 'cNvPr');
    if (pr) return pr;
  }
  return null;
}

/** The author's alternative text: `descr` first, `title` as the fallback. */
function readAlt(el: Element): string | undefined {
  const pr = cNvPrOf(el);
  if (!pr) return undefined;
  const raw = attrByLocal(pr, 'descr') || attrByLocal(pr, 'title');
  const text = raw ? raw.trim() : '';
  return text ? text.slice(0, MAX_ALT_LEN) : undefined;
}

// ─── shape / text ────────────────────────────────────────────────────────────

/**
 * Run properties as ONE cascade layer states them. `false` on a boolean is an
 * explicit off (`b="0"`) which stops inheritance for that field; `undefined` is
 * absence, which lets the next layer speak.
 */
interface RunProps {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** The named underline style when it is not a single line (`dbl`, `wavy`, ...). */
  underlineStyle?: string;
  strike?: boolean;
  /** Signed `baseline` in thousandths of a percent; 0 is an explicit "on the line". */
  baseline?: number;
  /** `all`, `small` or `none`; `none` is an explicit off. */
  cap?: 'all' | 'small' | 'none';
  sizePt?: number;
  font?: string;
  color?: PptxReadColor;
}

/**
 * Paragraph properties as ONE cascade layer states them (plan 275 section 7.2).
 * The four list fields travel together: the first layer that states a marker kind
 * (`buNone`, `buChar`, `buAutoNum`, `buBlip`) answers all four, so an explicit
 * `buNone` stops an inherited bullet the way `b="0"` stops inherited bold.
 */
interface ParaProps {
  bullet?: 'none' | 'bullet' | 'number';
  bulletChar?: string;
  numberStyle?: string;
  numberStart?: number;
  align?: 'left' | 'center' | 'right' | 'justify';
  spaceBeforePt?: number;
  spaceAfterPt?: number;
  lineSpacingPct?: number;
  marginLeftEmu?: number;
  indentEmu?: number;
}

/** One outline level of one cascade layer: its run defaults and its paragraph properties. */
interface LevelStyle {
  run: RunProps;
  para: ParaProps;
}

/** Read an `a:rPr`/`a:defRPr`/`a:endParaRPr` element into a cascade layer. */
function readRunProps(rPr: Element | null, theme: PptxReadTheme): RunProps {
  const out: RunProps = {};
  if (!rPr) return out;
  const b = attrByLocal(rPr, 'b');
  if (b) out.bold = truthy(b);
  const i = attrByLocal(rPr, 'i');
  if (i) out.italic = truthy(i);
  const u = attrByLocal(rPr, 'u');
  if (u) {
    out.underline = u !== 'none';
    if (u !== 'none' && u !== 'sng') out.underlineStyle = u.slice(0, MAX_TOKEN_LEN);
  }
  const strike = attrByLocal(rPr, 'strike');
  if (strike) out.strike = strike !== 'noStrike';
  const baseline = attrByLocal(rPr, 'baseline');
  if (baseline) {
    const n = Number.parseInt(baseline, 10);
    if (Number.isFinite(n)) out.baseline = n;
  }
  const cap = attrByLocal(rPr, 'cap');
  if (cap === 'all' || cap === 'small' || cap === 'none') out.cap = cap;
  const sz = attrByLocal(rPr, 'sz');
  if (sz) {
    const pt = toInt(sz) / 100;
    if (pt > 0) out.sizePt = pt;
  }
  const latin = firstChildByLocal(rPr, 'latin');
  const face = latin ? attrByLocal(latin, 'typeface') : null;
  if (face) out.font = face;
  const color = readColor(firstChildByLocal(rPr, 'solidFill'), theme);
  if (color) out.color = color;
  return out;
}

/** Fill `out`'s undefined fields from `layer`. Fields already stated stay put. */
function inheritInto(out: RunProps, layer: RunProps | undefined): void {
  if (!layer) return;
  if (out.bold === undefined && layer.bold !== undefined) out.bold = layer.bold;
  if (out.italic === undefined && layer.italic !== undefined) out.italic = layer.italic;
  if (out.underline === undefined && layer.underline !== undefined) {
    out.underline = layer.underline;
    if (layer.underlineStyle !== undefined) out.underlineStyle = layer.underlineStyle;
  }
  if (out.strike === undefined && layer.strike !== undefined) out.strike = layer.strike;
  if (out.baseline === undefined && layer.baseline !== undefined) out.baseline = layer.baseline;
  if (out.cap === undefined && layer.cap !== undefined) out.cap = layer.cap;
  if (out.sizePt === undefined && layer.sizePt !== undefined) out.sizePt = layer.sizePt;
  if (out.font === undefined && layer.font !== undefined) out.font = layer.font;
  if (out.color === undefined && layer.color !== undefined) out.color = layer.color;
}

const ALIGN_OF: Readonly<Record<string, ParaProps['align']>> = {
  l: 'left',
  ctr: 'center',
  r: 'right',
  just: 'justify',
  justLow: 'justify',
  dist: 'justify',
  thaiDist: 'justify',
};

/** The size a spacing element states in points (`a:spcPts`, hundredths of a point), else undefined. */
function spacingPt(el: Element | null): number | undefined {
  const pts = el ? firstChildByLocal(el, 'spcPts') : null;
  const val = pts ? attrByLocal(pts, 'val') : null;
  if (!val) return undefined;
  const n = toInt(val) / 100;
  return Number.isFinite(n) && n >= 0 && n <= MAX_SPACING_PT ? n : undefined;
}

/** The share a spacing element states as a percentage (`a:spcPct`, thousandths of a percent), else undefined. */
function spacingPct(el: Element | null): number | undefined {
  const pct = el ? firstChildByLocal(el, 'spcPct') : null;
  const val = pct ? attrByLocal(pct, 'val') : null;
  if (!val) return undefined;
  const n = toInt(val) / 1000;
  return Number.isFinite(n) && n > 0 && n <= MAX_SPACING_PCT ? n : undefined;
}

/** Read an `a:pPr` or `a:lvlNpPr` element into a paragraph cascade layer. */
function readParaProps(pPr: Element | null): ParaProps {
  const out: ParaProps = {};
  if (!pPr) return out;
  const algn = attrByLocal(pPr, 'algn');
  const align = algn ? ALIGN_OF[algn] : undefined;
  if (align) out.align = align;
  const marL = attrByLocal(pPr, 'marL');
  if (marL) {
    const n = toInt(marL);
    if (Number.isFinite(n) && Math.abs(n) <= MAX_INDENT_EMU) out.marginLeftEmu = n;
  }
  const indent = attrByLocal(pPr, 'indent');
  if (indent) {
    const n = toInt(indent);
    if (Number.isFinite(n) && Math.abs(n) <= MAX_INDENT_EMU) out.indentEmu = n;
  }
  const before = spacingPt(firstChildByLocal(pPr, 'spcBef'));
  if (before !== undefined) out.spaceBeforePt = before;
  const after = spacingPt(firstChildByLocal(pPr, 'spcAft'));
  if (after !== undefined) out.spaceAfterPt = after;
  const line = spacingPct(firstChildByLocal(pPr, 'lnSpc'));
  if (line !== undefined) out.lineSpacingPct = line;
  // The marker kind is a choice in the schema, so at most one of these is present.
  if (firstChildByLocal(pPr, 'buNone')) {
    out.bullet = 'none';
  } else {
    const buChar = firstChildByLocal(pPr, 'buChar');
    const buAutoNum = firstChildByLocal(pPr, 'buAutoNum');
    if (buChar) {
      out.bullet = 'bullet';
      const glyph = attrByLocal(buChar, 'char');
      if (glyph) out.bulletChar = glyph.slice(0, MAX_BULLET_CHAR_LEN);
    } else if (buAutoNum) {
      out.bullet = 'number';
      const type = attrByLocal(buAutoNum, 'type');
      if (type) out.numberStyle = type.slice(0, MAX_TOKEN_LEN);
      const startAt = attrByLocal(buAutoNum, 'startAt');
      if (startAt) {
        const n = toInt(startAt);
        if (Number.isFinite(n) && n >= 1 && n <= MAX_NUMBER_START) out.numberStart = n;
      }
    } else if (firstChildByLocal(pPr, 'buBlip')) {
      // A picture bullet has no glyph this model can carry; it is a bullet all the same.
      out.bullet = 'bullet';
    }
  }
  return out;
}

/** Fill `out`'s undefined paragraph fields from `layer`; the four list fields move as one. */
function inheritParaInto(out: ParaProps, layer: ParaProps | undefined): void {
  if (!layer) return;
  if (out.bullet === undefined && layer.bullet !== undefined) {
    out.bullet = layer.bullet;
    if (layer.bulletChar !== undefined) out.bulletChar = layer.bulletChar;
    if (layer.numberStyle !== undefined) out.numberStyle = layer.numberStyle;
    if (layer.numberStart !== undefined) out.numberStart = layer.numberStart;
  }
  if (out.align === undefined && layer.align !== undefined) out.align = layer.align;
  if (out.spaceBeforePt === undefined && layer.spaceBeforePt !== undefined) out.spaceBeforePt = layer.spaceBeforePt;
  if (out.spaceAfterPt === undefined && layer.spaceAfterPt !== undefined) out.spaceAfterPt = layer.spaceAfterPt;
  if (out.lineSpacingPct === undefined && layer.lineSpacingPct !== undefined) out.lineSpacingPct = layer.lineSpacingPct;
  if (out.marginLeftEmu === undefined && layer.marginLeftEmu !== undefined) out.marginLeftEmu = layer.marginLeftEmu;
  if (out.indentEmu === undefined && layer.indentEmu !== undefined) out.indentEmu = layer.indentEmu;
}

/** Fill both halves of one level from a lower layer. */
function inheritLevelInto(out: LevelStyle, layer: LevelStyle | undefined): void {
  if (!layer) return;
  inheritInto(out.run, layer.run);
  inheritParaInto(out.para, layer.para);
}

/** Cascade layers indexed by outline level (0..8); a hole means "silent here". */
type Levels = (LevelStyle | undefined)[];

/** Read `a:lvl1pPr`..`a:lvl9pPr` under an lstStyle / txStyles kind / defaultTextStyle. */
function readLevels(container: Element | null, theme: PptxReadTheme): Levels | undefined {
  if (!container) return undefined;
  let out: Levels | undefined;
  for (const el of childElements(container)) {
    const m = /^lvl([1-9])pPr$/.exec(elemLocal(el));
    if (!m?.[1]) continue;
    const defRPr = firstChildByLocal(el, 'defRPr');
    const level: LevelStyle = { run: readRunProps(defRPr, theme), para: readParaProps(el) };
    if (!out) out = new Array<LevelStyle | undefined>(LVL_COUNT);
    out[Number.parseInt(m[1], 10) - 1] = level;
  }
  return out;
}

/** One placeholder of a layout or master, with its per-level text styles. */
interface PhStyle {
  type?: string;
  idx?: number;
  lvls?: Levels;
  /** The slot's own geometry - what a slide placeholder without an `a:xfrm` inherits. */
  box?: NodeBox;
}

/** A parsed slideLayout or slideMaster part, reduced to what the cascade needs. */
interface PhLayer {
  phs: PhStyle[];
  /** master only: `p:txStyles` by kind. */
  titleStyle?: Levels;
  bodyStyle?: Levels;
  otherStyle?: Levels;
  /** layout only: the master part path its rels point at. */
  masterPath?: string;
  /** The part's own `p:cSld@name` (a layout's "Title and Content"), when it states one. */
  name?: string;
  /** The part's NON-placeholder shapes, pictures and frames, in paint order - what
   *  every slide using it shows behind its own content (1.166). */
  furniture: PptxReadNode[];
  /** `showMasterSp` on the part's root - false when a layout hides the master's shapes. */
  showMasterSp: boolean;
  /** The part's own `p:bg`, if it declares one. */
  background?: PptxBackground;
}

/** The layers a slide's shapes resolve through, above the shape's own state. */
interface Cascade {
  layout?: PhLayer;
  master?: PhLayer;
  defaults?: Levels;
}

/**
 * `title` and `ctrTitle` are the same slot; an absent type means `body`. Used on
 * both sides of a placeholder match so the two spellings unify.
 */
function phKind(type: string | undefined): string {
  if (!type) return 'body';
  return type === 'ctrTitle' ? 'title' : type;
}

/** Match a slide placeholder against a layer's: `idx` first, then kind. */
function matchPh(layer: PhLayer | undefined, ph: PptxPlaceholder | undefined): PhStyle | undefined {
  if (!layer || !ph) return undefined;
  if (ph.idx !== undefined) {
    const byIdx = layer.phs.find((p) => p.idx === ph.idx);
    if (byIdx) return byIdx;
  }
  const want = phKind(ph.type);
  return layer.phs.find((p) => phKind(p.type) === want);
}

/** The master txStyles kind that governs a placeholder of this type. */
function txStyleFor(master: PhLayer | undefined, type: string | undefined): Levels | undefined {
  if (!master) return undefined;
  const kind = phKind(type);
  if (kind === 'title') return master.titleStyle;
  if (kind === 'body' || kind === 'subTitle') return master.bodyStyle;
  return master.otherStyle;
}

/** What every part read shares: the package, the parser, the theme and the sink. */
interface DeckEnv {
  store: PartStore;
  parseXml: XmlParser;
  theme: PptxReadTheme;
  sink: WarnSink;
  /** Mints an id for a group that states none, so `groupPath` is always a path. */
  nextGroupId: () => string;
}

/** One part's walk: the deck environment plus that part's own relationships. */
interface WalkCtx extends DeckEnv {
  rels: Map<string, Rel>;
  warn: (code: PptxReadWarningCode, message: string) => void;
}

function walkCtx(env: DeckEnv, rels: Map<string, Rel>, slideIndex?: number): WalkCtx {
  return {
    ...env,
    rels,
    warn: (code: PptxReadWarningCode, message: string): void => env.sink.add(code, message, slideIndex),
  };
}

/**
 * A run's `a:hlinkClick` destination. A relationship marked external gives the
 * URL verbatim; an internal one gives the resolved part path, which is how a
 * jump to another slide reads; with no relationship the bare `action` string
 * stands, so a slide-jump action is still visible.
 */
function readHref(rPr: Element | null, rels: Map<string, Rel> | undefined): string | undefined {
  if (!rPr) return undefined;
  const link = firstChildByLocal(rPr, 'hlinkClick');
  if (!link) return undefined;
  const id = readRid(link);
  const rel = id && rels ? rels.get(id) : undefined;
  if (rel?.target) return rel.target.slice(0, MAX_HREF_LEN);
  const action = attrByLocal(link, 'action');
  return action ? action.slice(0, MAX_HREF_LEN) : undefined;
}

function readRun(r: Element, theme: PptxReadTheme, inherit?: RunProps, ctx?: WalkCtx): PptxReadRun | null {
  const t = firstChildByLocal(r, 't');
  const text = textOf(t);
  const rPr = firstChildByLocal(r, 'rPr');
  const props = readRunProps(rPr, theme);
  inheritInto(props, inherit);
  const run: PptxReadRun = { text };
  // An explicit-off resolves to `false` here and stays off the model, which is
  // the same shape a run with nothing to say has always had.
  if (props.bold) run.bold = true;
  if (props.italic) run.italic = true;
  if (props.underline) {
    run.underline = true;
    if (props.underlineStyle) run.underlineStyle = props.underlineStyle;
  }
  if (props.strike) run.strike = true;
  if (props.baseline !== undefined && props.baseline !== 0) run.baseline = props.baseline > 0 ? 'super' : 'sub';
  if (props.cap === 'all' || props.cap === 'small') run.cap = props.cap;
  if (props.sizePt) run.sizePt = props.sizePt;
  if (props.font) run.font = props.font;
  if (props.color) run.color = props.color;
  // A link is the run's own: it is stated on this rPr and never inherited.
  const href = readHref(rPr, ctx?.rels);
  if (href) run.href = href;
  // Keep the run if it carries text OR styling worth preserving.
  if (text.length > 0 || run.bold || run.italic || run.underline || run.sizePt || run.color || run.font || run.href) return run;
  return null;
}

/** Copy a resolved paragraph layer onto the model paragraph, stating only what a layer said. */
function applyParaProps(para: PptxReadPara, props: ParaProps): void {
  if (props.bullet) para.bullet = props.bullet;
  if (props.bullet === 'bullet' && props.bulletChar) para.bulletChar = props.bulletChar;
  if (props.bullet === 'number') {
    if (props.numberStyle) para.numberStyle = props.numberStyle;
    if (props.numberStart !== undefined) para.numberStart = props.numberStart;
  }
  if (props.align) para.align = props.align;
  if (props.spaceBeforePt !== undefined) para.spaceBeforePt = props.spaceBeforePt;
  if (props.spaceAfterPt !== undefined) para.spaceAfterPt = props.spaceAfterPt;
  if (props.lineSpacingPct !== undefined) para.lineSpacingPct = props.lineSpacingPct;
  if (props.marginLeftEmu !== undefined) para.marginLeftEmu = props.marginLeftEmu;
  if (props.indentEmu !== undefined) para.indentEmu = props.indentEmu;
}

function readTxBody(
  txBody: Element | null,
  theme: PptxReadTheme,
  inherit?: (lvl: number) => LevelStyle | undefined,
  ctx?: WalkCtx,
): PptxReadPara[] {
  const paras: PptxReadPara[] = [];
  if (!txBody) return paras;
  const pEls = childrenByLocal(txBody, 'p');
  for (const pEl of pEls) {
    if (paras.length >= MAX_PARAS) {
      ctx?.warn('nodes-truncated', `a text body states more than ${MAX_PARAS} paragraphs; the rest were not read`);
      break;
    }
    const para: PptxReadPara = { runs: [] };
    const pPr = firstChildByLocal(pEl, 'pPr');
    const rawLvl = pPr ? attrByLocal(pPr, 'lvl') : null;
    if (rawLvl != null) {
      const n = Number.parseInt(rawLvl, 10);
      if (Number.isFinite(n) && n > 0) para.lvl = Math.min(n, MAX_OUTLINE_LVL);
    }
    // Paragraph-level defaults sit between the run's own rPr and the shape's.
    const level = inherit ? inherit(para.lvl ?? 0) : undefined;
    let runInherit = level?.run;
    const paraProps = readParaProps(pPr);
    inheritParaInto(paraProps, level?.para);
    applyParaProps(para, paraProps);
    const pDefRPr = pPr ? firstChildByLocal(pPr, 'defRPr') : null;
    if (pDefRPr) {
      const pProps = readRunProps(pDefRPr, theme);
      inheritInto(pProps, runInherit);
      runInherit = pProps;
    }
    const runs = para.runs;
    for (const child of childElements(pEl)) {
      if (runs.length >= MAX_RUNS_PER_PARA) {
        ctx?.warn('nodes-truncated', `a paragraph states more than ${MAX_RUNS_PER_PARA} runs; the rest were not read`);
        break;
      }
      const ln = elemLocal(child);
      if (ln === 'r') {
        const run = readRun(child, theme, runInherit, ctx);
        if (run) runs.push(run);
      } else if (ln === 'br') {
        runs.push({ text: '\n' });
      } else if (ln === 'fld') {
        // a field (slide number, date, etc.): capture its cached text best-effort
        const text = textOf(firstChildByLocal(child, 't'));
        if (text) runs.push({ text });
      }
    }
    paras.push(para);
  }
  return paras;
}

function paraHasText(paras: PptxReadPara[]): boolean {
  for (const p of paras) for (const r of p.runs) if (r.text.trim().length > 0) return true;
  return false;
}

/**
 * Read `p:nvSpPr/p:nvPr/p:ph` off a shape. A `ph` element with no `type`
 * attribute means `body` per ECMA-376, which is how PowerPoint writes an
 * idx-only content placeholder; `explicitType` records that the fallback was
 * used so the cascade may replace it with the layout's real type.
 */
function readPlaceholder(sp: Element): { ph: PptxPlaceholder; explicitType: boolean } | undefined {
  const nvSpPr = firstChildByLocal(sp, 'nvSpPr');
  const nvPr = nvSpPr ? firstChildByLocal(nvSpPr, 'nvPr') : null;
  const ph = nvPr ? firstChildByLocal(nvPr, 'ph') : null;
  if (!ph) return undefined;
  const rawType = attrByLocal(ph, 'type');
  const out: PptxPlaceholder = { type: rawType ? rawType.slice(0, MAX_PH_TYPE_LEN) : 'body' };
  const rawIdx = attrByLocal(ph, 'idx');
  if (rawIdx != null) {
    const idx = Number.parseInt(rawIdx, 10);
    if (Number.isFinite(idx) && idx >= 0) out.idx = Math.min(idx, MAX_PH_IDX);
  }
  return { ph: out, explicitType: !!rawType };
}

/** A path coordinate: a finite number, or null when the point names a guide or is malformed. */
function ptCoord(pt: Element, axis: 'x' | 'y'): number | null {
  const raw = attrByLocal(pt, axis);
  if (raw == null || !/^-?\d+(\.\d+)?$/.test(raw.trim())) return null;
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n) <= MAX_COORD ? n : null;
}

/** A number for SVG path data: at most three decimals, no exponent. */
function pathNum(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

/**
 * An `a:arcTo` from the current point as cubic curves, in pieces of at most a
 * quarter turn. DrawingML states the arc by its radii and two angles: `stAng`
 * is the current point's place on the ellipse and `swAng` how far to sweep,
 * both in 60000ths of a degree and both measured as seen (the visual angle),
 * so each is turned into the ellipse's own parameter before the curve is built.
 * A full turn stays a full turn, which the endpoint form cannot say.
 */
function arcToCubics(
  x: number,
  y: number,
  wR: number,
  hR: number,
  stDeg: number,
  swDeg: number,
): { curves: Array<[number, number, number, number, number, number]>; x: number; y: number } {
  const out: Array<[number, number, number, number, number, number]> = [];
  if (!(wR > 0) || !(hR > 0) || swDeg === 0) return { curves: out, x, y };
  const param = (deg: number): number => {
    const a = (deg * Math.PI) / 180;
    return Math.atan2(wR * Math.sin(a), hR * Math.cos(a));
  };
  const sweep = Math.max(-3600, Math.min(3600, swDeg));
  const t0 = param(stDeg);
  const cx = x - wR * Math.cos(t0);
  const cy = y - hR * Math.sin(t0);
  const pieces = Math.max(1, Math.ceil(Math.abs(sweep) / 90));
  let ta = t0;
  let ex = x;
  let ey = y;
  for (let i = 1; i <= pieces; i++) {
    const visual = stDeg + (sweep * i) / pieces;
    let tb = param(visual);
    // Each piece is at most a quarter turn as seen, so its parameter moves by less
    // than a half turn: the difference is brought into (-pi, pi] and given the
    // sweep's sign, which unwraps the parameter across the whole sweep.
    let delta = tb - ta;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta <= -Math.PI) delta += 2 * Math.PI;
    if (sweep > 0 && delta < 0) delta += 2 * Math.PI;
    if (sweep < 0 && delta > 0) delta -= 2 * Math.PI;
    tb = ta + delta;
    const k = (4 / 3) * Math.tan((tb - ta) / 4);
    const x1 = cx + wR * Math.cos(ta) - k * wR * Math.sin(ta);
    const y1 = cy + hR * Math.sin(ta) + k * hR * Math.cos(ta);
    ex = cx + wR * Math.cos(tb);
    ey = cy + hR * Math.sin(tb);
    const x2 = ex + k * wR * Math.sin(tb);
    const y2 = ey - k * hR * Math.cos(tb);
    out.push([x1, y1, x2, y2, ex, ey]);
    ta = tb;
  }
  return { curves: out, x: ex, y: ey };
}

/**
 * Read `a:custGeom` into SVG path data, one entry per `a:path`. Null, with a
 * warning, when a point names a guide (a formula this reader does not evaluate),
 * when the geometry passes a cap, or when nothing drawable was stated: a partial
 * outline would be a wrong one, and the shape then reads as today, a filled box.
 * `extent` is the shape's own size, which a path that states no `w` / `h` uses.
 */
function readCustGeom(custGeom: Element, extent: { cx: number; cy: number }, ctx: WalkCtx): PptxCustGeom | undefined {
  const pathLst = firstChildByLocal(custGeom, 'pathLst');
  if (!pathLst) return undefined;
  const pathEls = childrenByLocal(pathLst, 'path');
  if (pathEls.length > MAX_CUSTGEOM_PATHS) {
    ctx.warn('nodes-truncated', `a custom shape states more than ${MAX_CUSTGEOM_PATHS} paths, so its outline was not read`);
    return undefined;
  }
  const paths: PptxCustGeomPath[] = [];
  let chars = 0;
  let commands = 0;
  const guided = (): undefined => {
    ctx.warn('nodes-truncated', 'a custom shape places its points by formula, which this reader does not evaluate, so its outline was not read');
    return undefined;
  };
  for (const pathEl of pathEls) {
    // A straight freeform line states no extent on the axis it does not move along:
    // that axis's coordinates are all 0, so its space is taken as 1 wide and the line
    // keeps its outline rather than falling back to a box of no area.
    const w0 = toInt(attrByLocal(pathEl, 'w'), extent.cx);
    const h0 = toInt(attrByLocal(pathEl, 'h'), extent.cy);
    if (!(w0 >= 0) || !(h0 >= 0) || (w0 === 0 && h0 === 0)) continue;
    const w = w0 > 0 ? w0 : 1;
    const h = h0 > 0 ? h0 : 1;
    const parts: string[] = [];
    let x = 0;
    let y = 0;
    let startX = 0;
    let startY = 0;
    let open = false;
    for (const cmd of childElements(pathEl)) {
      if (++commands > MAX_CUSTGEOM_COMMANDS) {
        ctx.warn('nodes-truncated', `a custom shape states more than ${MAX_CUSTGEOM_COMMANDS} drawing commands, so its outline was not read`);
        return undefined;
      }
      const name = elemLocal(cmd);
      const pts = childrenByLocal(cmd, 'pt');
      const coords: number[] = [];
      for (const pt of pts) {
        const px = ptCoord(pt, 'x');
        const py = ptCoord(pt, 'y');
        if (px === null || py === null) return guided();
        coords.push(px, py);
      }
      if (name === 'moveTo' && coords.length >= 2) {
        x = coords[0]!;
        y = coords[1]!;
        startX = x;
        startY = y;
        open = true;
        parts.push(`M${pathNum(x)} ${pathNum(y)}`);
      } else if (name === 'lnTo' && coords.length >= 2) {
        if (!open) parts.push(`M${pathNum(x)} ${pathNum(y)}`);
        open = true;
        x = coords[0]!;
        y = coords[1]!;
        parts.push(`L${pathNum(x)} ${pathNum(y)}`);
      } else if (name === 'cubicBezTo' && coords.length >= 6) {
        if (!open) parts.push(`M${pathNum(x)} ${pathNum(y)}`);
        open = true;
        parts.push(`C${coords.slice(0, 6).map(pathNum).join(' ')}`);
        x = coords[4]!;
        y = coords[5]!;
      } else if (name === 'quadBezTo' && coords.length >= 4) {
        if (!open) parts.push(`M${pathNum(x)} ${pathNum(y)}`);
        open = true;
        const [qx, qy, nx, ny] = coords as [number, number, number, number];
        // A quadratic raised to a cubic: each control point two thirds of the way
        // from its end to the quadratic's one control point.
        parts.push(`C${[x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), nx + (2 / 3) * (qx - nx), ny + (2 / 3) * (qy - ny), nx, ny].map(pathNum).join(' ')}`);
        x = nx;
        y = ny;
      } else if (name === 'arcTo') {
        const read = (attr: string): number | null => {
          const raw = attrByLocal(cmd, attr);
          if (raw == null || !/^-?\d+(\.\d+)?$/.test(raw.trim())) return null;
          const n = Number(raw);
          return Number.isFinite(n) ? n : null;
        };
        const wR = read('wR');
        const hR = read('hR');
        const stAng = read('stAng');
        const swAng = read('swAng');
        if (wR === null || hR === null || stAng === null || swAng === null) return guided();
        if (!open) parts.push(`M${pathNum(x)} ${pathNum(y)}`);
        open = true;
        const arc = arcToCubics(x, y, Math.abs(wR), Math.abs(hR), stAng / 60000, swAng / 60000);
        for (const c of arc.curves) parts.push(`C${c.map(pathNum).join(' ')}`);
        x = arc.x;
        y = arc.y;
      } else if (name === 'close') {
        if (open) parts.push('Z');
        x = startX;
        y = startY;
        open = false;
      }
    }
    const d = parts.join('');
    if (!/[LCZ]/.test(d)) continue;
    chars += d.length;
    if (chars > MAX_CUSTGEOM_CHARS) {
      ctx.warn('nodes-truncated', `a custom shape states more than ${MAX_CUSTGEOM_CHARS} characters of outline, so its outline was not read`);
      return undefined;
    }
    const entry: PptxCustGeomPath = { d, w, h };
    if (attrByLocal(pathEl, 'fill') === 'none') entry.noFill = true;
    const stroke = attrByLocal(pathEl, 'stroke');
    if (stroke === '0' || stroke === 'false') entry.noStroke = true;
    paths.push(entry);
  }
  return paths.length ? { paths } : undefined;
}

function readSp(sp: Element, ctx: WalkCtx, cascade?: Cascade, group?: GroupCtx): PptxReadNode {
  const theme = ctx.theme;
  const spPr = firstChildByLocal(sp, 'spPr');
  const box = readXfrm(spPr);
  let geom: string | undefined;
  let custGeom: PptxCustGeom | undefined;
  let fill: PptxReadColor | undefined;
  let gradient: true | undefined;
  let line: PptxReadColor | undefined;
  let lineGradient: true | undefined;
  let lineWidthPt: number | undefined;
  if (spPr) {
    const prstGeom = firstChildByLocal(spPr, 'prstGeom');
    geom = (prstGeom && attrByLocal(prstGeom, 'prst')) || undefined;
    const custGeomEl = geom ? null : firstChildByLocal(spPr, 'custGeom');
    if (custGeomEl) custGeom = readCustGeom(custGeomEl, { cx: box.cxEmu, cy: box.cyEmu }, ctx);
    const filled = readFill(spPr, theme);
    fill = filled.color;
    gradient = filled.gradient;
    const ln = firstChildByLocal(spPr, 'ln');
    if (ln) {
      const stroke = readFill(ln, theme);
      line = stroke.color;
      lineGradient = stroke.gradient;
      const w = attrByLocal(ln, 'w');
      if (w) {
        const pt = toInt(w) / EMU_PER_PT;
        if (pt > 0) lineWidthPt = pt;
      }
    }
  }

  const read = readPlaceholder(sp);
  let ph = read?.ph;
  const layoutPh = matchPh(cascade?.layout, ph);
  const masterPh = matchPh(cascade?.master, ph);
  if (ph && read && !read.explicitType) {
    const resolved = layoutPh?.type ?? masterPh?.type;
    if (resolved) ph = { ...ph, type: resolved };
  }
  // A placeholder that states no geometry of its own sits where its slot does - on
  // the layout, else the master (ECMA-376 19.3.1.36). PowerPoint writes exactly this
  // for every content placeholder a user never moved.
  if (ph && box.cxEmu === 0 && box.cyEmu === 0) {
    const slot = layoutPh?.box ?? masterPh?.box;
    if (slot) Object.assign(box, slot);
  }

  const txBody = firstChildByLocal(sp, 'txBody');
  const shapeLvls = readLevels(txBody ? firstChildByLocal(txBody, 'lstStyle') : null, theme);
  // Master txStyles govern placeholders only; a plain text box takes the
  // presentation's defaultTextStyle and nothing else.
  const layers = [shapeLvls, layoutPh?.lvls, masterPh?.lvls, ph ? txStyleFor(cascade?.master, ph.type) : undefined, cascade?.defaults].filter(
    (l): l is Levels => !!l,
  );
  let inherit: ((lvl: number) => LevelStyle | undefined) | undefined;
  if (layers.length) {
    const cache: (LevelStyle | undefined)[] = new Array<LevelStyle | undefined>(LVL_COUNT);
    inherit = (lvl: number): LevelStyle | undefined => {
      const at = lvl >= 0 && lvl < LVL_COUNT ? lvl : 0;
      let hit = cache[at];
      if (!hit) {
        hit = { run: {}, para: {} };
        for (const l of layers) inheritLevelInto(hit, l[at]);
        cache[at] = hit;
      }
      return hit;
    };
  }

  const paras = readTxBody(txBody, theme, inherit, ctx);
  const placed = composeBox(box, readFlips(spPr), group);
  if (paraHasText(paras)) {
    const node: PptxTextNode = { type: 'text', ...placed, paras };
    if (geom) node.geom = geom;
    if (custGeom) node.custGeom = custGeom;
    if (fill) node.fill = fill;
    if (gradient) node.gradient = gradient;
    if (ph) node.ph = ph;
    return node;
  }
  const node: PptxShapeNode = { type: 'shape', ...placed };
  if (geom) node.geom = geom;
  if (custGeom) node.custGeom = custGeom;
  if (fill) node.fill = fill;
  if (gradient) node.gradient = gradient;
  if (line) node.line = line;
  if (lineWidthPt) node.lineWidthPt = lineWidthPt;
  if (lineGradient) node.lineGradient = lineGradient;
  if (ph) node.ph = ph;
  return node;
}

/**
 * Parse a slideLayout or slideMaster part down to its placeholders' text styles.
 * Both are attacker-controlled parts: the placeholder count is capped, every
 * level read is bounded to nine, and a missing or malformed part yields null,
 * which degrades the slide to the no-cascade read.
 */
function readPhLayer(env: DeckEnv, path: string): PhLayer | null {
  const { store, parseXml, theme } = env;
  const doc = parsePart(store, path, parseXml);
  const root = doc?.documentElement;
  if (!root) return null;
  const layer: PhLayer = { phs: [], furniture: [], showMasterSp: attrByLocal(root, 'showMasterSp') !== '0' };
  const cSld = firstChildByLocal(root, 'cSld');
  const partName = cSld ? attrByLocal(cSld, 'name') : null;
  if (partName?.trim()) layer.name = partName.trim().slice(0, MAX_LAYOUT_NAME_LEN);
  // The part's own rels: a layout's logo is `r:embed` against the LAYOUT's rels,
  // not the slide's, so its media resolves here, once, for every slide using it.
  const rels = parseRels(store, path, parseXml);
  const relsById = new Map<string, Rel>(rels.map((r) => [r.id, r]));
  // A layout or master is read once and shown on many slides, so its warnings
  // belong to the deck rather than to whichever slide happened to read it first.
  const ctx = walkCtx(env, relsById);
  const spTree = descendantByLocal(root, 'spTree');
  if (spTree) {
    for (const sp of childrenByLocal(spTree, 'sp')) {
      if (layer.phs.length >= MAX_PH_PER_PART) {
        ctx.warn('nodes-truncated', `${path} states more than ${MAX_PH_PER_PART} placeholders; the rest were not read`);
        break;
      }
      const read = readPlaceholder(sp);
      if (!read) continue;
      const txBody = firstChildByLocal(sp, 'txBody');
      const entry: PhStyle = { type: read.ph.type, idx: read.ph.idx };
      const lvls = readLevels(txBody ? firstChildByLocal(txBody, 'lstStyle') : null, theme);
      if (lvls) entry.lvls = lvls;
      const box = readXfrm(firstChildByLocal(sp, 'spPr'));
      if (box.cxEmu > 0 || box.cyEmu > 0) entry.box = box;
      layer.phs.push(entry);
    }
    // Furniture: everything that is NOT a placeholder slot. A slot is where a slide
    // puts its content; a colour bar, a logo picture or a "Confidential" text box is
    // the design itself and paints on every slide that uses the part.
    walkTree(spTree, ctx, layer.furniture, { depth: 0, skipPlaceholders: true });
  }
  const bg = readBackground(root, relsById, theme);
  if (bg) layer.background = bg;
  const txStyles = firstChildByLocal(root, 'txStyles');
  if (txStyles) {
    layer.titleStyle = readLevels(firstChildByLocal(txStyles, 'titleStyle'), theme);
    layer.bodyStyle = readLevels(firstChildByLocal(txStyles, 'bodyStyle'), theme);
    layer.otherStyle = readLevels(firstChildByLocal(txStyles, 'otherStyle'), theme);
  }
  const masterRel = rels.find((r) => /slideMaster$/i.test(r.type) && !r.external);
  if (masterRel?.target) layer.masterPath = masterRel.target;
  return layer;
}

/**
 * A part's own `p:cSld/p:bg`: a solid fill, the lowest stop of a gradient, or a
 * picture fill under `p:bgPr`, else the colour a `p:bgRef` style reference names.
 * A gradient ground is marked `gradient` for the same reason a shape's is, so a
 * consumer choosing a logo against it knows the stop is one end of a ramp. A
 * pattern fill still reads as no ground rather than as a wrong flat colour.
 */
function readBackground(root: Element, relsById: Map<string, Rel>, theme: PptxReadTheme): PptxBackground | undefined {
  const cSld = firstChildByLocal(root, 'cSld');
  const bg = cSld ? firstChildByLocal(cSld, 'bg') : null;
  if (!bg) return undefined;
  const bgPr = firstChildByLocal(bg, 'bgPr');
  if (bgPr) {
    const out: PptxBackground = {};
    const ground = readFill(bgPr, theme);
    if (ground.color) out.color = ground.color;
    if (ground.gradient) out.gradient = ground.gradient;
    const blipFill = firstChildByLocal(bgPr, 'blipFill');
    const blip = blipFill ? firstChildByLocal(blipFill, 'blip') : null;
    const embed = blip ? attrByLocal(blip, 'embed') || attrByLocal(blip, 'link') : null;
    const rel = embed ? relsById.get(embed) : undefined;
    if (rel && !rel.external) out.media = rel.target;
    return out.color || out.media || out.gradient ? out : undefined;
  }
  const bgRef = firstChildByLocal(bg, 'bgRef');
  if (bgRef) {
    const color = readColor(bgRef, theme);
    if (color) return { color };
  }
  return undefined;
}

function readPic(pic: Element, ctx: WalkCtx, group?: GroupCtx): PptxPicNode {
  const spPr = firstChildByLocal(pic, 'spPr');
  const node: PptxPicNode = { type: 'pic', ...composeBox(readXfrm(spPr), readFlips(spPr), group) };
  const blipFill = firstChildByLocal(pic, 'blipFill');
  const blip = blipFill ? firstChildByLocal(blipFill, 'blip') : null;
  const embed = blip ? attrByLocal(blip, 'embed') || attrByLocal(blip, 'link') : null;
  if (embed) {
    node.embed = embed;
    const rel = ctx.rels.get(embed);
    if (rel && !rel.external) node.media = rel.target;
    else ctx.warn('media-skipped', `a picture's relationship ${embed} names no readable part in this package`);
  } else {
    ctx.warn('media-skipped', 'a picture states no image relationship, so it carries no bytes to show');
  }
  // The Office 2016 SVG extension: the blip names the raster, and an `asvg:svgBlip`
  // in its extension list names the drawing itself. Matched by local name, so the
  // prefix a writer chose does not matter.
  const svgBlip = blip ? descendantByLocal(blip, 'svgBlip') : null;
  const svgRid = svgBlip ? attrByLocal(svgBlip, 'embed') || attrByLocal(svgBlip, 'link') : null;
  if (svgRid) {
    const rel = ctx.rels.get(svgRid);
    if (rel && !rel.external) node.svg = rel.target;
    else ctx.warn('media-skipped', `a picture's SVG relationship ${svgRid} names no readable part in this package, so its raster stands in`);
  }
  // The crop, in thousandths of a percent of the source per edge.
  const srcRect = blipFill ? firstChildByLocal(blipFill, 'srcRect') : null;
  if (srcRect) {
    const crop: NonNullable<PptxPicNode['srcRect']> = {};
    for (const side of ['l', 't', 'r', 'b'] as const) {
      const v = Number(attrByLocal(srcRect, side));
      if (Number.isFinite(v) && v !== 0) crop[side] = Math.max(-10, Math.min(1, v / 100_000));
    }
    if (Object.keys(crop).length) node.srcRect = crop;
  }
  return node;
}

/** The plot elements a chart part may hold, in the order a chart states one. */
const CHART_PLOTS: readonly string[] = [
  'barChart',
  'bar3DChart',
  'pieChart',
  'pie3DChart',
  'lineChart',
  'line3DChart',
  'areaChart',
  'area3DChart',
  'doughnutChart',
  'scatterChart',
  'radarChart',
  'bubbleChart',
  'ofPieChart',
  'stockChart',
  'surfaceChart',
];

/**
 * Points of one cache (`c:numCache` / `c:strCache`), placed by their stated
 * `idx`. A point past the cap, or at an index the reader cannot place, is
 * reported rather than dropped quietly: a daily series over a year or a large
 * scatter passes the cap, and a census that fingerprinted the short read
 * believing it had the whole series would be wrong about the deck.
 */
function readCachePoints(ctx: WalkCtx, holder: Element | null, cacheLocal: string): string[] {
  if (!holder) return [];
  const cache = descendantByLocal(holder, cacheLocal);
  if (!cache) return [];
  const out: string[] = [];
  let pastCap = 0;
  let unplaceable = 0;
  for (const pt of childrenByLocal(cache, 'pt')) {
    const idx = toInt(attrByLocal(pt, 'idx'), out.length);
    if (idx >= MAX_CHART_POINTS) {
      pastCap++;
      continue;
    }
    if (idx < 0) {
      unplaceable++;
      continue;
    }
    while (out.length <= idx) out.push('');
    out[idx] = textOf(firstChildByLocal(pt, 'v')).trim().slice(0, MAX_CHART_LABEL_LEN);
  }
  if (pastCap) ctx.warn('nodes-truncated', `a chart cache states values past point ${MAX_CHART_POINTS}; the rest were not read`);
  if (unplaceable) ctx.warn('nodes-truncated', 'a chart cache states a value at an index below zero; it was not read');
  return out;
}

/** `c:val`: the cached numbers. A hole in the cache reads as 0, never as NaN. */
function readChartValues(ctx: WalkCtx, val: Element | null): number[] {
  return readCachePoints(ctx, val, 'numCache').map((s) => {
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  });
}

/** `c:cat`: the category labels, whether the source cached them as text or numbers. */
function readChartCategories(ctx: WalkCtx, cat: Element | null): string[] {
  if (!cat) return [];
  const text = readCachePoints(ctx, cat, 'strCache');
  return text.length ? text : readCachePoints(ctx, cat, 'numCache');
}

/** `c:ser/c:tx`: the series name, from the reference's cache or a literal. */
function readSeriesName(ser: Element): string | undefined {
  const tx = firstChildByLocal(ser, 'tx');
  if (!tx) return undefined;
  const v = descendantByLocal(tx, 'v');
  const text = v ? textOf(v).trim() : '';
  return text ? text.slice(0, MAX_CHART_LABEL_LEN) : undefined;
}

/**
 * The cached series of a chart part. This reads the numbers the WRITER left
 * beside the chart, which is what PowerPoint last drew; the embedded workbook is
 * a separate part this reader does not open.
 */
function readChartPart(ctx: WalkCtx, path: string): PptxChartData | undefined {
  const doc = parsePart(ctx.store, path, ctx.parseXml);
  const root = doc?.documentElement;
  if (!root) return undefined;
  const plotArea = descendantByLocal(root, 'plotArea');
  if (!plotArea) return undefined;
  let plot: Element | undefined;
  for (const c of childElements(plotArea)) {
    if (CHART_PLOTS.includes(elemLocal(c))) {
      plot = c;
      break;
    }
  }
  if (!plot) return undefined;
  const data: PptxChartData = { type: elemLocal(plot), series: [] };
  const dir = firstChildByLocal(plot, 'barDir');
  const dirVal = dir ? attrByLocal(dir, 'val') : null;
  if (dirVal) data.barDir = dirVal.slice(0, 8);
  for (const ser of childrenByLocal(plot, 'ser')) {
    if (data.series.length >= MAX_CHART_SERIES) {
      ctx.warn('nodes-truncated', `a chart states more than ${MAX_CHART_SERIES} series; the rest were not read`);
      break;
    }
    const entry: PptxChartSeries = { values: readChartValues(ctx, firstChildByLocal(ser, 'val')) };
    const name = readSeriesName(ser);
    if (name) entry.name = name;
    if (!data.categories) {
      const cats = readChartCategories(ctx, firstChildByLocal(ser, 'cat'));
      if (cats.length) data.categories = cats;
    }
    data.series.push(entry);
  }
  return data.series.length || data.categories ? data : undefined;
}

/**
 * A picture some writers store beside a chart as its own relationship, so a
 * consumer that cannot draw the chart still has real bytes for it.
 */
function chartFallbackImage(ctx: WalkCtx, chartPart: string): string | undefined {
  for (const rel of parseRels(ctx.store, chartPart, ctx.parseXml)) {
    if (rel.external || !rel.target) continue;
    if (/\/image$/i.test(rel.type)) return rel.target;
  }
  return undefined;
}

function readGraphicFrame(gf: Element, ctx: WalkCtx, group?: GroupCtx): PptxReadNode {
  const theme = ctx.theme;
  // graphicFrame carries its xfrm directly (p:xfrm), not under spPr.
  const box = composeBox(readXfrm(gf), readFlips(gf), group);
  const graphic = firstChildByLocal(gf, 'graphic');
  const gData = graphic ? firstChildByLocal(graphic, 'graphicData') : null;
  const tbl = gData ? firstChildByLocal(gData, 'tbl') : null;
  if (tbl) {
    const rows: string[][] = [];
    for (const tr of childrenByLocal(tbl, 'tr')) {
      if (rows.length >= MAX_TABLE_ROWS) {
        ctx.warn('nodes-truncated', `a table states more than ${MAX_TABLE_ROWS} rows; the rest were not read`);
        break;
      }
      const cells: string[] = [];
      for (const tc of childrenByLocal(tr, 'tc')) {
        if (cells.length >= MAX_TABLE_COLS) {
          ctx.warn('nodes-truncated', `a table row states more than ${MAX_TABLE_COLS} cells; the rest were not read`);
          break;
        }
        const paras = readTxBody(firstChildByLocal(tc, 'txBody'), theme, undefined, ctx);
        cells.push(paras.map((p) => p.runs.map((r) => r.text).join('')).join('\n'));
      }
      rows.push(cells);
    }
    return { type: 'table', ...box, rows };
  }
  const uri = gData ? attrByLocal(gData, 'uri') : null;
  const node: PptxUnknownNode = { type: 'unknown', ...box };
  if (uri) node.tag = uri;
  // A native chart: read what the chart part states about itself, so a consumer
  // knows which chart it is and what it drew, and name the chart's own cached
  // picture when the writer left one.
  if (gData && uri && /\/chart$/i.test(uri)) {
    const chart = firstChildByLocal(gData, 'chart');
    const relId = chart ? readRid(chart) : null;
    const rel = relId ? ctx.rels.get(relId) : undefined;
    if (rel && !rel.external && rel.target) {
      const data = readChartPart(ctx, rel.target);
      if (data) {
        node.chartData = data;
        if (data.type) node.tag = data.type;
      }
      const img = chartFallbackImage(ctx, rel.target);
      if (img) node.fallbackMedia = img;
    }
  }
  return node;
}

/** What one level of the walk carries down. */
interface WalkOpts {
  depth: number;
  cascade?: Cascade;
  skipPlaceholders?: boolean;
  /** The composed group transform, when the walk is inside one. */
  group?: GroupCtx;
}

/** Attach the author's alternative text, when the element states one. */
function withAlt(node: PptxReadNode, el: Element): PptxReadNode {
  const alt = readAlt(el);
  if (alt) node.alt = alt;
  return node;
}

/**
 * The group's own id for `groupPath`, or a minted one when it states none.
 *
 * `p:cNvPr@id` and not `@name`: the id is what an object id is built from
 * elsewhere in this read, it is unique within the part, and it survives the
 * rename a name does not.
 */
function groupIdOf(grpSp: Element, ctx: WalkCtx): string {
  const nv = firstChildByLocal(grpSp, 'nvGrpSpPr');
  const pr = nv ? firstChildByLocal(nv, 'cNvPr') : null;
  const raw = pr ? attrByLocal(pr, 'id') : null;
  const id = raw ? raw.trim() : '';
  return id ? id.slice(0, MAX_GROUP_ID_LEN) : ctx.nextGroupId();
}

/** The media part path of the first `p:pic` under a fallback branch. */
function fallbackPicture(branch: Element, ctx: WalkCtx): string | undefined {
  const pic = descendantByLocal(branch, 'pic');
  if (!pic) return undefined;
  const blipFill = firstChildByLocal(pic, 'blipFill');
  const blip = blipFill ? firstChildByLocal(blipFill, 'blip') : null;
  const embed = blip ? attrByLocal(blip, 'embed') || attrByLocal(blip, 'link') : null;
  const rel = embed ? ctx.rels.get(embed) : undefined;
  return rel && !rel.external && rel.target ? rel.target : undefined;
}

/**
 * `mc:AlternateContent` wraps content a reader may not understand: `mc:Choice`
 * holds the real object, `mc:Fallback` holds what an older consumer should draw,
 * which for a chart, a diagram or an embedded object is usually a picture of it.
 * Reading the Choice keeps the object's identity; reading the Fallback's `p:pic`
 * gives the same node real bytes to show. A Choice that yields no node at all
 * hands on to the next Choice and then to the Fallback, rather than reporting an
 * object the file does carry as nothing. Nothing is drawn or invented here: when
 * the branch carries no picture, `fallbackMedia` stays absent.
 */
function readAlternateContent(el: Element, ctx: WalkCtx, out: PptxReadNode[], opts: WalkOpts): void {
  const fallback = childrenByLocal(el, 'Fallback')[0];
  const branches = [...childrenByLocal(el, 'Choice'), ...(fallback ? [fallback] : [])];
  if (!branches.length) return;
  const before = out.length;
  let taken: Element | undefined;
  for (const branch of branches) {
    // The branch walk counts as a nesting step, so an AlternateContent nested
    // inside its own Choice cannot recurse past the depth cap.
    walkTree(branch, ctx, out, { ...opts, depth: opts.depth + 1 });
    if (out.length > before) {
      taken = branch;
      break;
    }
  }
  // A Choice this reader walks to nothing must not take the Fallback's picture
  // down with it, which is the loss this branch was added to close.
  if (!taken) {
    ctx.warn('nodes-truncated', 'an mc:AlternateContent states no branch this reader could read, so its object was not read');
    return;
  }
  if (!fallback || taken === fallback) return;
  const media = fallbackPicture(fallback, ctx);
  if (!media) return;
  for (let i = before; i < out.length; i++) {
    const node = out[i];
    if (node && node.type === 'unknown' && node.fallbackMedia === undefined) node.fallbackMedia = media;
  }
}

// Walk an spTree (or grpSp) appending nodes. Depth-capped for nested groups;
// a per-slide counter caps total node count. A group's transform is composed
// into every child, so a node's box always names a place on the SLIDE.
function walkTree(tree: Element, ctx: WalkCtx, out: PptxReadNode[], opts: WalkOpts): void {
  const { depth, cascade, skipPlaceholders, group } = opts;
  if (depth > MAX_GROUP_DEPTH) {
    ctx.warn('group-depth-exceeded', `a group nested deeper than ${MAX_GROUP_DEPTH} was not read`);
    return;
  }
  for (const child of childElements(tree)) {
    if (out.length >= MAX_NODES_PER_SLIDE) {
      ctx.warn('nodes-truncated', `more than ${MAX_NODES_PER_SLIDE} shapes on one slide; the rest were not read`);
      return;
    }
    const ln = elemLocal(child);
    try {
      switch (ln) {
        case 'sp':
          // On a layout or master a placeholder is a SLOT, not content: skipped when
          // the walk is collecting the part's furniture.
          if (skipPlaceholders && readPlaceholder(child)) break;
          out.push(withAlt(readSp(child, ctx, cascade, group), child));
          break;
        case 'cxnSp': // connector: a shape with geom + line, no text
          out.push(withAlt(readSp(child, ctx, cascade, group), child));
          break;
        case 'pic':
          out.push(withAlt(readPic(child, ctx, group), child));
          break;
        case 'graphicFrame':
          out.push(withAlt(readGraphicFrame(child, ctx, group), child));
          break;
        case 'AlternateContent':
          readAlternateContent(child, ctx, out, opts);
          break;
        case 'grpSp': {
          const own = groupAffine(child);
          const inner: GroupCtx = {
            m: group ? mulAffine(group.m, own) : own,
            path: [...(group?.path ?? []), groupIdOf(child, ctx)],
          };
          walkTree(child, ctx, out, { ...opts, depth: depth + 1, group: inner });
          break;
        }
        case 'nvGrpSpPr':
        case 'grpSpPr':
          break; // group's own metadata, skip
        default:
          break; // unrecognised structural child, ignore silently
      }
    } catch {
      // A malformed shape never sinks the slide.
    }
  }
}

// ─── narration (plans/180 section 5) ─────────────────────────────────────────

/** Sound extensions a slide's media rel may legitimately name. Everything else on the
 *  media relationship is a video, and a video is not narration. */
const AUDIO_EXTS: ReadonlySet<string> = new Set(['wav', 'mp3', 'm4a', 'mp4a', 'aac', 'ogg', 'oga', 'flac', 'wma', 'aiff', 'aif', 'mid', 'midi']);

/** The extension of a part path, lowercased and without the dot ('' when it has none). */
function extOf(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/**
 * The slide's narration part, from its relationships.
 *
 * PowerPoint writes an embedded sound as TWO relationships to one part - `audio` (the
 * `a:audioFile` link) and `media` (the p14 embed) - so reading either one finds it. The
 * `audio` rel is preferred because only a sound ever carries it; the `media` rel is taken
 * only when its target's extension says sound, since an embedded VIDEO uses that same
 * relationship type. An external (linked) sound is skipped: there are no bytes in the
 * package to bind.
 */
function readSlideAudio(rels: readonly Rel[]): PptxSlideAudio | undefined {
  for (const r of rels) {
    if (r.external || !r.target) continue;
    if (!/\/audio$/i.test(r.type)) continue;
    return { part: r.target, ext: extOf(r.target) };
  }
  for (const r of rels) {
    if (r.external || !r.target) continue;
    if (!/\/media$/i.test(r.type)) continue;
    const ext = extOf(r.target);
    if (AUDIO_EXTS.has(ext)) return { part: r.target, ext };
  }
  return undefined;
}

// ─── notes ───────────────────────────────────────────────────────────────────

function readNotes(store: PartStore, notesPath: string, parseXml: XmlParser): string | undefined {
  const doc = parsePart(store, notesPath, parseXml);
  if (!doc?.documentElement) return undefined;
  const spTree = descendantByLocal(doc.documentElement, 'spTree');
  if (!spTree) return undefined;
  // Prefer the body placeholder; fall back to all text on the notes slide.
  let bodyText: string | null = null;
  const allParts: string[] = [];
  for (const sp of childrenByLocal(spTree, 'sp')) {
    const nvSpPr = firstChildByLocal(sp, 'nvSpPr');
    const nvPr = nvSpPr ? firstChildByLocal(nvSpPr, 'nvPr') : null;
    const ph = nvPr ? firstChildByLocal(nvPr, 'ph') : null;
    const phType = ph ? attrByLocal(ph, 'type') : null;
    const paras = readTxBody(firstChildByLocal(sp, 'txBody'), { colors: {} });
    const text = paras.map((p) => p.runs.map((r) => r.text).join('')).join('\n').trim();
    if (phType === 'body' && bodyText == null) bodyText = text;
    else if (phType !== 'sldNum' && phType !== 'dt' && text) allParts.push(text);
  }
  const result = (bodyText && bodyText.length ? bodyText : allParts.join('\n')).trim();
  return result.length ? result : undefined;
}

// ─── slide ordering ──────────────────────────────────────────────────────────

function slidePathsInOrder(store: PartStore, parseXml: XmlParser, sink?: WarnSink): string[] {
  const pres = parsePart(store, 'ppt/presentation.xml', parseXml);
  const rels = parseRels(store, 'ppt/presentation.xml', parseXml);
  const byId = new Map<string, Rel>(rels.map((r) => [r.id, r]));
  const ordered: string[] = [];
  if (pres?.documentElement) {
    const sldIdLst = descendantByLocal(pres.documentElement, 'sldIdLst');
    if (sldIdLst) {
      for (const sldId of childrenByLocal(sldIdLst, 'sldId')) {
        // A p:sldId carries a numeric `id` (the slide id, not a rel) plus the
        // relationship reference in the namespaced `r:id` attribute; that's the
        // one that resolves to the slide part.
        const relId = readRid(sldId);
        const rel = relId ? byId.get(relId) : undefined;
        if (rel && !rel.external && rel.target) ordered.push(rel.target);
        if (ordered.length >= MAX_SLIDES) {
          sink?.add('slides-truncated', `the deck states more than ${MAX_SLIDES} slides; the rest were not read`);
          break;
        }
      }
    }
  }
  if (ordered.length) return ordered;
  // Fallback: numeric sort of the slide parts.
  const found = store.keys().filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k));
  if (found.length > MAX_SLIDES) {
    sink?.add('slides-truncated', `the package holds more than ${MAX_SLIDES} slide parts; the rest were not read`);
  }
  return found.sort((a, b) => slideNum(a) - slideNum(b)).slice(0, MAX_SLIDES);
}

/** Read the relationship reference (`r:id`) from an element, skipping any plain
 *  `id` attribute (which on sldId is the numeric slide id, not a rel). */
function readRid(el: Element): string | null {
  const attrs = el.attributes;
  if (attrs) {
    for (let i = 0; i < attrs.length; i++) {
      const a = attrs[i] as Attr;
      const full = a.name || '';
      if (full === 'r:id' || (full.endsWith(':id') && full !== 'id')) return a.value;
    }
  }
  return null;
}

function slideNum(path: string): number {
  const m = /slide(\d+)\.xml$/i.exec(path);
  return m?.[1] ? Number.parseInt(m[1], 10) : 0;
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Two node tops within this many EMU are the same row. 114300 EMU is 0.125 in,
 * half a line at 18 pt, the same half-line discipline `pdf-text.ts` applies to
 * PDF runs.
 */
const ROW_TOLERANCE_EMU = 114_300;

/**
 * Sort nodes into READING ORDER: rows top to bottom, then left to right inside
 * a row. Two-column slides come back column by column within each band rather
 * than interleaved, which is what a markdown serialiser needs.
 *
 * Banding is a single pass, not a comparator, so the result is a total order and
 * never depends on the engine's sort implementation. The stored node order is
 * spTree order (the authored z-order some consumers rely on), so this returns a
 * NEW array and mutates nothing. Pure and total: garbage in yields an empty or
 * best-effort array, never a throw.
 */
export function readingOrder(nodes: PptxReadNode[]): PptxReadNode[] {
  if (!Array.isArray(nodes)) return [];
  const coord = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const items: { node: PptxReadNode; i: number; x: number; y: number }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node == null || typeof node !== 'object') continue;
    items.push({ node, i, x: coord(node.xEmu), y: coord(node.yEmu) });
  }
  // Stable by y, ties by authored order.
  items.sort((a, b) => a.y - b.y || a.i - b.i);
  const out: PptxReadNode[] = [];
  let band: typeof items = [];
  let bandTop = 0;
  const flush = (): void => {
    band.sort((a, b) => a.x - b.x || a.i - b.i);
    for (const it of band) out.push(it.node);
    band = [];
  };
  for (const it of items) {
    if (band.length && it.y - bandTop > ROW_TOLERANCE_EMU) flush();
    if (!band.length) bandTop = it.y;
    band.push(it);
  }
  flush();
  return out;
}

/**
 * Detect a PowerPoint part map by the presence of `ppt/presentation.xml`.
 * The `PK` zip-magic sniff belongs to the CALLER (before inflation); this
 * operates on the already-unzipped map for `design-import.ts` routing.
 */
export function isPptx(parts: PptxParts): boolean {
  if (!parts || typeof parts !== 'object') return false;
  const v = parts['ppt/presentation.xml'];
  if (v !== undefined) return typeof v === 'string' ? v.length > 0 : v.byteLength > 0;
  // case-insensitive fallback
  for (const k of Object.keys(parts)) {
    if (k.toLowerCase() === 'ppt/presentation.xml') {
      const raw = parts[k];
      if (raw === undefined) return false;
      return typeof raw === 'string' ? raw.length > 0 : raw.byteLength > 0;
    }
  }
  return false;
}

/** A raster media part of a .pptx that pixel-domain detection can read. */
export interface PptxMediaImage {
  /** The zip part path, e.g. "ppt/media/image3.png". */
  path: string;
  /** The decode MIME the shell hands createImageBitmap. */
  mime: 'image/png' | 'image/jpeg';
}

/**
 * Enumerate the raster image parts of an unzipped .pptx that carry pixels a
 * watermark detector can read: `ppt/media/*.{png,jpg,jpeg}`. Vector / metafile
 * media (`.svg`/`.emf`/`.wmf`) hold no pixel mark by construction and are
 * omitted, as is every non-media part (docProps thumbnails, XML, rels, …).
 * Deterministic (sorted by path) and capped at `max` so a deck carrying
 * hundreds of images bounds a caller's decode work. Pure + DOM-free: the shell
 * owns the unzip (fflate) and the pixel decode (canvas); this only names the
 * parts worth decoding. Empty parts are skipped (nothing to decode; the
 * detector no-ops on them anyway).
 */
export function pptxMediaImages(parts: PptxParts, max = 64): PptxMediaImage[] {
  const out: PptxMediaImage[] = [];
  if (!parts || typeof parts !== 'object' || !(max > 0)) return out;
  for (const path of Object.keys(parts).sort()) {
    const m = /^ppt\/media\/[^/]+\.(png|jpe?g)$/i.exec(path);
    if (!m) continue;
    const raw = parts[path];
    if (raw === undefined || (typeof raw === 'string' ? raw.length === 0 : raw.byteLength === 0)) continue;
    out.push({ path, mime: /png/i.test(m[1]!) ? 'image/png' : 'image/jpeg' });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Parse an unzipped .pptx part map into a read-model. Never throws: a malformed
 * or hostile part yields whatever parsed and skips the rest.
 */
export function readPptx(parts: PptxParts, parseXml: XmlParser): PptxDeckRead {
  const sink = makeWarnSink();
  const deck: PptxDeckRead = {
    widthEmu: DEFAULT_W_EMU,
    heightEmu: DEFAULT_H_EMU,
    theme: { colors: {} },
    slides: [],
    warnings: sink.list,
  };
  if (!parts || typeof parts !== 'object' || typeof parseXml !== 'function') return deck;

  const store = makeStore(parts, (path) =>
    sink.add('part-too-large', `the part ${path.slice(0, 256)} is over the reader's size cap and was skipped`),
  );

  try {
    deck.theme = readTheme(store, parseXml);
  } catch {
    /* keep empty theme */
  }

  try {
    const cp = readCoreProps(store, parseXml);
    if (cp) deck.coreProps = cp;
  } catch {
    /* absent or unreadable core props stay absent */
  }

  // slide size + the deck-wide default text style (the cascade's last layer)
  let defaults: Levels | undefined;
  try {
    const pres = parsePart(store, 'ppt/presentation.xml', parseXml);
    if (pres?.documentElement) {
      const sldSz = descendantByLocal(pres.documentElement, 'sldSz');
      if (sldSz) {
        const cx = toInt(attrByLocal(sldSz, 'cx'), 0);
        const cy = toInt(attrByLocal(sldSz, 'cy'), 0);
        if (cx > 0) deck.widthEmu = cx;
        if (cy > 0) deck.heightEmu = cy;
      }
      defaults = readLevels(descendantByLocal(pres.documentElement, 'defaultTextStyle'), deck.theme);
    }
  } catch {
    /* keep default size */
  }

  // Group ids are minted per DECK, so two groups that both state none still get
  // paths that tell them apart.
  let mintedGroups = 0;
  const env: DeckEnv = {
    store,
    parseXml,
    theme: deck.theme,
    sink,
    nextGroupId: (): string => `g${++mintedGroups}`,
  };

  // Layout/master parts are parsed ONCE each per call, however many slides
  // share them, and the number of distinct parts is capped.
  const layerCache = new Map<string, PhLayer | null>();
  const getLayer = (path: string | undefined): PhLayer | undefined => {
    if (!path) return undefined;
    const cached = layerCache.get(path);
    if (cached !== undefined) return cached ?? undefined;
    if (layerCache.size >= MAX_STYLE_PARTS) {
      sink.add('nodes-truncated', `the deck uses more than ${MAX_STYLE_PARTS} layout and master parts; the rest were not read`);
      return undefined;
    }
    let layer: PhLayer | null = null;
    try {
      layer = readPhLayer(env, path);
    } catch {
      layer = null;
    }
    layerCache.set(path, layer);
    return layer ?? undefined;
  };

  let slidePaths: string[] = [];
  try {
    slidePaths = slidePathsInOrder(store, parseXml, sink);
  } catch {
    slidePaths = [];
  }

  for (let i = 0; i < slidePaths.length && i < MAX_SLIDES; i++) {
    const path = slidePaths[i];
    if (path === undefined) continue;
    const slide: PptxReadSlide = { index: i, nodes: [] };
    try {
      const doc = parsePart(store, path, parseXml);
      if (doc?.documentElement) {
        // slide rels (pic embeds + notes link)
        const rels = parseRels(store, path, parseXml);
        const relsById = new Map<string, Rel>(rels.map((r) => [r.id, r]));
        // layout → master cascade for this slide's placeholders
        const layoutRel = rels.find((r) => /slideLayout$/i.test(r.type) && !r.external);
        const layout = getLayer(layoutRel?.target);
        const master = getLayer(layout?.masterPath);
        const cascade: Cascade | undefined = layout || master || defaults ? { layout, master, defaults } : undefined;
        if (layout?.name) slide.layoutName = layout.name;
        const ctx = walkCtx(env, relsById, i);
        const spTree = descendantByLocal(doc.documentElement, 'spTree');
        if (spTree) walkTree(spTree, ctx, slide.nodes, { depth: 0, cascade });
        // What the slide inherits (1.166): the master's furniture when both the slide
        // and its layout still show master shapes, then the layout's own - always, a
        // layout's shapes are part of the layout. Painted behind the slide's nodes.
        const slideShowsMaster = attrByLocal(doc.documentElement, 'showMasterSp') !== '0';
        const inherited: PptxReadNode[] = [];
        if (master && slideShowsMaster && (!layout || layout.showMasterSp)) inherited.push(...master.furniture);
        if (layout) inherited.push(...layout.furniture);
        if (inherited.length) slide.inherited = inherited;
        const background = readBackground(doc.documentElement, relsById, deck.theme) ?? layout?.background ?? master?.background;
        if (background) slide.background = background;
        // narration (plans/180): the audio rel is the classic one, the media rel is the
        // p14 embed pointing at the same part. Prefer audio; fall back to media only
        // when its target really is a sound, because a VIDEO uses the media rel too.
        const audio = readSlideAudio(rels);
        if (audio) slide.audio = audio;
        // notes
        const notesRel = rels.find((r) => /notesSlide$/i.test(r.type) && !r.external);
        if (notesRel) {
          const notes = readNotes(store, notesRel.target, parseXml);
          if (notes) slide.notes = notes;
        }
      }
    } catch {
      /* a broken slide yields an empty node list, not a crash */
    }
    deck.slides.push(slide);
  }

  return deck;
}
