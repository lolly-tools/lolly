// SPDX-License-Identifier: MPL-2.0
/**
 * Rebrand renovation contracts (plan 274). An old deck is read into a faithful,
 * positioned source model with a fidelity fact per object; a census says where each
 * object came from and what it probably is, with evidence; a renovation plan holds
 * proposals and a person's or preset's decisions, kept apart; a compile turns the
 * accepted content into Design's own authored values with lineage both ways; and a
 * report accounts for every source object. Origin is evidence, never a verdict. A
 * placeholder is never described as a picture of the source. Nothing here reads a
 * file, touches the DOM, or knows the time.
 *
 * Three surfaces share these types unchanged: the web view at #/rebrand, the CLI
 * `lolly rebrand plan|compile|inspect` stages and the MCP `lolly_rebrand` tool. The
 * JSON schemas under schemas/rebrand-*.schema.json mirror them and are pinned by
 * tests/rebrand-contract.test.ts.
 */

export const REBRAND_CONTRACT_VERSION = 1 as const;

/** Reference pixel space every source adapter normalises to (px at 96 dpi). */
export const REBRAND_REFERENCE_DPI = 96 as const;

// ---------------------------------------------------------------------------
// Stage 1: the source, as faithfully as it could be read
// ---------------------------------------------------------------------------

export const SOURCE_KINDS = ['pptx', 'pdf', 'image', 'docx'] as const;
export type SourceKindV1 = (typeof SOURCE_KINDS)[number];

export const SOURCE_OBJECT_KINDS = ['text', 'shape', 'pic', 'vector', 'table', 'chart', 'unknown'] as const;
export type SourceObjectKindV1 = (typeof SOURCE_OBJECT_KINDS)[number];

/** Where an object was declared. Structural evidence, not a class and not an action. */
export const SOURCE_ORIGINS = ['slide', 'layout', 'master', 'pdf-artifact', 'raster-region'] as const;
export type SourceOriginV1 = (typeof SOURCE_ORIGINS)[number];

/**
 * How faithfully the object can be shown and carried. `editable` is modelled
 * content (text, shapes, tables); `raster-preserved` means the exact bytes are held
 * (a picture, or a real fallback image the file carried for an unsupported object);
 * `approximate` is drawn from an incomplete model; `unavailable` has nothing to
 * show and travels as an unresolved record with recovery choices.
 */
export const FIDELITY_STATES = ['editable', 'raster-preserved', 'approximate', 'unavailable'] as const;
export type FidelityStateV1 = (typeof FIDELITY_STATES)[number];

export const FIDELITY_REASONS = [
  'native-chart-no-fallback',
  'smartart-no-fallback',
  'ole-no-fallback',
  'unsupported-media-format',
  'media-too-large',
  'media-missing',
  'reader-approximation',
  'geometry-approximation',
  'cap-reached',
  'ocr-estimate',
] as const;
export type FidelityReasonV1 = (typeof FIDELITY_REASONS)[number];

export interface FidelityV1 {
  state: FidelityStateV1;
  reason?: FidelityReasonV1;
  /** A stable asset ref (exact media hash) holding real fallback bytes when the state is `raster-preserved` for an unsupported object. */
  fallbackAssetRef?: string;
  /** Where the fallback came from: the file itself, a PDF the person supplied, or a local renderer. */
  fallbackSource?: 'embedded' | 'supplied-pdf' | 'local-renderer';
}

export const PLACEHOLDER_TYPES = ['title', 'ctrTitle', 'subTitle', 'body', 'ftr', 'sldNum', 'dt', 'pic'] as const;
export type PlaceholderTypeV1 = (typeof PLACEHOLDER_TYPES)[number];

/** An axis-aligned box in reference px with a clockwise rotation in degrees. */
export interface BoxV1 { x: number; y: number; w: number; h: number; rot: number }

/** A colour with provenance: a theme slot reference keeps its slot name beside the resolved hex. */
export interface SourceColorV1 { hex?: string; scheme?: string; alpha?: number }

export interface SourceRunV1 {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /**
   * The underline's named style when the source states one other than a single
   * line (pptx `u="dbl"`, `u="wavy"`, ...). Evidence only: Design draws one
   * underline, so a style is reported, never invented. Plan 275 section 7.2.
   */
  underlineStyle?: string;
  /** Struck through (pptx `strike="sngStrike"` or `dblStrike`). Plan 275 section 7.2. */
  strike?: boolean;
  /** Raised or lowered, by sign only (pptx `baseline` above or below 0). Plan 275 section 7.2. */
  baseline?: 'super' | 'sub';
  /** Letter case the source draws (pptx `cap="all"` is `upper`, `cap="small"` is `small-caps`). Plan 275 section 7.2. */
  case?: 'upper' | 'small-caps';
  sizePt?: number;
  font?: string;
  /** `theme` when the face is a theme reference (`+mj-lt`, `+mn-lt`); `literal` otherwise. */
  fontProvenance?: 'theme' | 'literal';
  color?: SourceColorV1;
  href?: string;
}

export interface SourceParaV1 {
  runs: SourceRunV1[];
  /** Outline level, 0-based. */
  lvl?: number;
  /**
   * The list marker kind after the reader resolved it through the master's body
   * style; an explicit `none` stops an inherited bullet the way `b="0"` stops
   * inherited bold.
   */
  bullet?: 'none' | 'bullet' | 'number';
  align?: 'left' | 'center' | 'right' | 'justify';
  /** The glyph a `bullet` paragraph draws (pptx `a:buChar`). Plan 275 section 7.2. */
  bulletChar?: string;
  /** The numbering scheme a `number` paragraph uses (pptx `a:buAutoNum` type, `arabicPeriod`, `alphaLcParenR`, ...). */
  numberStyle?: string;
  /** The first number of a `number` list when the source states one other than 1 (pptx `startAt`). */
  numberStart?: number;
  /** Space before the paragraph in points. */
  spaceBeforePt?: number;
  /** Space after the paragraph in points. */
  spaceAfterPt?: number;
  /** Line spacing as a percentage of single spacing (100 is single). */
  lineSpacingPct?: number;
  /** Left indent of the paragraph in reference px (pptx `marL`). */
  indentPx?: number;
  /** First-line offset against `indentPx` in reference px, negative for a hanging bullet (pptx `indent`). */
  firstIndentPx?: number;
}

export const OCR_STATES = ['not-run', 'unavailable', 'no-text-found', 'text-found'] as const;
export type OcrStateV1 = (typeof OCR_STATES)[number];

export interface OcrLineEvidenceV1 { text: string; confidence: number; box: BoxV1 }

/** OCR evidence for a picture or a raster region. `not-run` and `unavailable` are not evidence of anything. */
export interface OcrEvidenceV1 {
  state: OcrStateV1;
  lines?: OcrLineEvidenceV1[];
  /** Characters recognised per 1000 px² of the object, when text was found. */
  textDensity?: number;
  model?: string;
}

/** Pixel statistics a shell computed over a decoded picture; every field optional so a CLI without a decoder stays honest. */
export interface RasterStatsV1 {
  width?: number;
  height?: number;
  /** 64-bit difference hash as 16 hex characters. A candidate signal, never storage identity. */
  dhash?: string;
  /** Distinct colours after coarse quantisation, a discreteness signal. */
  distinctColors?: number;
  /** Share of edge pixels on long axis-aligned runs (graphics) versus short random ones (photos). */
  axisAlignedEdgeShare?: number;
  edgeDensity?: number;
  transparentShare?: number;
}

/**
 * What a text object probably is, estimated from the size of its type against the
 * rest of the page (ocr-typeset). An estimate for the census to weigh, never a
 * placeholder binding: a flattened slide states no placeholders.
 */
export const SOURCE_ROLE_ESTIMATES = ['title', 'body'] as const;
export type SourceRoleEstimateV1 = (typeof SOURCE_ROLE_ESTIMATES)[number];

export const SOURCE_WARNING_CODES = [
  'nodes-truncated',
  'slides-truncated',
  'media-skipped',
  'part-too-large',
  'group-transform-approximated',
  'gradient-flattened',
  'links-dropped',
  'video-dropped',
  'notes-dropped',
  'metafile-not-converted',
  'vector-budget-reached',
] as const;
export type SourceWarningCodeV1 = (typeof SOURCE_WARNING_CODES)[number];

export interface SourceWarningV1 {
  code: SourceWarningCodeV1;
  message: string;
  /** Object ids the warning concerns, when it concerns specific objects. */
  objectIds?: string[];
  count?: number;
}

export interface SourceObjectV1 {
  /** `<slide-id>.<source part or shape id>`. Permanent for this source; never reassigned. */
  id: string;
  /** Content hash for matching across slides and revisions. Not the identity. */
  fingerprint: string;
  kind: SourceObjectKindV1;
  box: BoxV1;
  /** The full 2x3 affine `[a, b, c, d, e, f]` when box + rot cannot describe it (reflection, nested groups). */
  transform?: number[];
  /** Ancestry of group ids, outermost first, so a group action can find its members. */
  groupPath?: string[];
  clip?: BoxV1;
  origin: SourceOriginV1;
  fidelity: FidelityV1;
  placeholder?: PlaceholderTypeV1;
  /** The reading-order position, when the source states one. */
  readingIndex?: number;
  text?: { paras: SourceParaV1[] };
  alt?: string;
  fill?: SourceColorV1;
  line?: { color?: SourceColorV1; widthPt?: number };
  /** Preset geometry name (`rect`, `ellipse`, `roundRect`, ...). */
  geom?: string;
  /** A stable asset ref (exact media hash) for a picture's bytes. Never a blob URL, a path or base64. */
  media?: string;
  mediaMime?: string;
  /** Standalone SVG text for extracted vector art. */
  vector?: string;
  table?: string[][];
  /** For `unknown` and `chart`: the graphicData uri or local name, so a native chart is recognisable. */
  tag?: string;
  /** Chart data when the native chart's workbook was read. */
  chartData?: { type?: string; categories?: string[]; series?: Array<{ name?: string; values: number[] }> };
  ocr?: OcrEvidenceV1;
  raster?: RasterStatsV1;
  hidden?: boolean;
  /** Title or body, estimated from reconstructed text on a flattened slide. Absent means nobody estimated it. */
  roleEstimate?: SourceRoleEstimateV1;
  /**
   * The drawing as bounded, paint-ordered items (plan 275 decision 32), for a
   * compile to emit as editable Design rows. Set on a `vector` read from an SVG
   * picture and on a `shape` read from custom geometry. `vector` stays the archive
   * copy of the whole SVG; this is the structure a compile reads.
   */
  vectorItems?: VectorItemsV1;
}

/**
 * Why the itemiser left an item out. An invisible item (no fill and no stroke,
 * zero opacity, zero area with no stroke) is dropped without a record, so a
 * chart's empty background rectangle does not make the chart approximate.
 */
export const VECTOR_OMIT_REASONS = [
  'cap-reached',
  'unsupported-element',
  'unsupported-paint',
  'unsupported-text',
] as const;
export type VectorOmitReasonV1 = (typeof VECTOR_OMIT_REASONS)[number];

/** Items stored per object. The compile places fewer (its own row cap); the rest wait for a later fold into one painted row. */
export const VECTOR_ITEMS_MAX = 2000;
/** Characters of path data (`d`) summed over one object's items. */
export const VECTOR_ITEMS_MAX_CHARS = 1_048_576;
/** Items summed over one deck. Past it, further objects stay pictures and the source warns `vector-budget-reached`. */
export const VECTOR_DECK_ITEMS_MAX = 20_000;

export interface VectorItemsV1 {
  version: 1;
  /** The drawing's user space: the SVG viewBox after the root's own transform, or the custom geometry's path space. */
  viewBox: { x: number; y: number; w: number; h: number };
  items: VectorItemV1[];
  /** Items left out, by reason, so the compile can say what did not travel. Absent means nothing was left out. */
  omitted?: Array<{ reason: VectorOmitReasonV1; count: number }>;
  /** The document's own name for itself, from `<title>`, at most 120 characters. */
  title?: string;
  /** The document's own description, from `<desc>` (a chart states its data source and licence there), at most 500 characters. */
  desc?: string;
}

/** Shared by both item kinds. Opacity is 0 to 1 as SVG states it; a compile converts to Design's 0 to 100. */
interface VectorItemBaseV1 {
  /** The element's own and inherited `opacity`, multiplied. */
  opacity?: number;
  /** A category or series name the source states on the element (`data-recolor`, `data-series`, `data-name`), at most 64 characters. */
  series?: string;
  /** The ancestor `<g>` chain as `id` or `class` names, outermost first, at most 8. */
  groups?: string[];
}

export interface VectorPathItemV1 extends VectorItemBaseV1 {
  kind: 'path';
  /** Absolute SVG path data in viewBox units with every ancestor transform composed in. */
  d: string;
  /** The item's bounds in viewBox units, from the path's control points. */
  box: { x: number; y: number; w: number; h: number };
  /** The source element when it was a `rect` or `ellipse` whose composed transform has no rotation or skew (a compile may emit a box row), or a `line`. */
  shape?: 'rect' | 'ellipse' | 'line';
  /** Corner radius of a `rect`, in viewBox units. */
  rx?: number;
  fill?: SourceColorV1 | { none: true };
  fillOpacity?: number;
  fillRule?: 'nonzero' | 'evenodd';
  /** Stroke in viewBox units. SVG's defaults (butt caps, miter joins) apply when absent. */
  stroke?: {
    color: SourceColorV1;
    width: number;
    opacity?: number;
    cap?: 'butt' | 'round' | 'square';
    join?: 'miter' | 'round' | 'bevel';
    dash?: number[];
  };
}

export interface VectorTextItemV1 extends VectorItemBaseV1 {
  kind: 'text';
  text: string;
  x: number;
  y: number;
  anchor?: 'start' | 'middle' | 'end';
  /** Font size in viewBox units. */
  size: number;
  font?: string;
  bold?: boolean;
  italic?: boolean;
  fill?: SourceColorV1;
}

export type VectorItemV1 = VectorPathItemV1 | VectorTextItemV1;

/**
 * The whole-slide picture of a flattened slide, kept as a recovery option after
 * the picture was split into regions: a person can always go back to it.
 * Written exactly when no object on the slide still holds that picture:
 * after the regions replaced its picture object, or when the picture came from
 * outside the slide (a page render) and nothing on the slide carries it. A
 * flattened slide kept as one picture has no `recovery`, because its picture
 * object is still there.
 */
export interface SlideRecoveryV1 {
  assetRef: string;
  /** The picture object the regions replaced, when the slide had one (a pptx picture, a pdf page image). */
  fromObjectId?: string;
}

/**
 * Text recognition over a flattened slide as a whole. `text-found` means some
 * object on the slide carries a reading that found text (a recogniser's, or the
 * document's own text layer), and `model` names whichever reading that was.
 * `no-text-found` means a recogniser read every region that could hold text and
 * found none; a reading of only part of the slide that found nothing stays
 * `not-run`. `not-run` and `unavailable` name no model, because nothing ran. No
 * time is recorded: the contract holds no clock readings.
 */
export type SlideOcrV1 =
  | { state: 'not-run' | 'unavailable' }
  | { state: 'no-text-found' | 'text-found'; model?: string };

export interface SlideSourceV1 {
  /** Stable slide identity, independent of display order (a part name or a content hash). */
  id: string;
  index: number;
  width: number;
  height: number;
  background: { color?: SourceColorV1; media?: string };
  /** In z-order (paint order). */
  objects: SourceObjectV1[];
  notes?: string;
  transition?: { kind?: string; durationMs?: number };
  /** Object ids in reading order. */
  readingOrder: string[];
  warnings: SourceWarningV1[];
  /**
   * `layout` and `master` are the part paths the slide was built from. `layoutName`
   * is the layout's own name (pptx `<p:cSld name>`), which the layout matcher reads
   * as a prior (plan 275 section 3.2); a part path says nothing about the layout.
   */
  origin: { kind: SourceKindV1; layout?: string; layoutName?: string; master?: string; flattened?: boolean };
  /**
   * A rendering of the whole slide for display (a rendered SVG or a shell's screenshot), with its own
   * fidelity. On a flattened slide the whole-slide picture is not put here: it
   * stays in its picture object, or in `recovery` once that object is replaced.
   */
  preview?: { assetRef: string; fidelity: FidelityStateV1 };
  /** On a flattened slide whose picture object was replaced by its regions: the whole-slide picture. See `SlideRecoveryV1`. */
  recovery?: SlideRecoveryV1;
  /** On a flattened slide: whether text recognition ran over it, and with which model. */
  ocr?: SlideOcrV1;
}

export interface SourceDeckV1 {
  version: typeof REBRAND_CONTRACT_VERSION;
  source: {
    kind: SourceKindV1;
    /** `sha256:<hex>` of the source bytes. */
    hash: string;
    /** Survives revisions of the same deck: core-props identifier, or the first hash seen. */
    lineageId: string;
    /** Separates two imports of the same bytes. */
    instanceId: string;
    name?: string;
    bytes?: number;
    pageCount: number;
    title?: string;
  };
  slides: SlideSourceV1[];
  /** Fonts the source names, with whether each is available on this device. */
  fonts: Array<{ family: string; provenance: 'theme' | 'literal'; runs: number; available?: boolean }>;
  theme?: { colors?: Record<string, string>; majorFont?: string; minorFont?: string };
  warnings: SourceWarningV1[];
  /** Parser identity and version, for replay. */
  reader: { name: string; version: string };
}

// ---------------------------------------------------------------------------
// Stage 2: the census - origin, class hypothesis, evidence
// ---------------------------------------------------------------------------

export const OBJECT_CLASSES = [
  'template-furniture',
  'decoration',
  'logo-candidate',
  'known-logo',
  'recurring-text',
  'page-number',
  'footer',
  'date',
  'title',
  'subtitle',
  'body',
  'chart',
  'screenshot',
  'photo',
  'table',
  'diagram',
  'unknown',
] as const;
export type ObjectClassV1 = (typeof OBJECT_CLASSES)[number];

export const EVIDENCE_SIGNALS = [
  'origin',
  'placeholder',
  'repeat-count',
  'repeat-share',
  'position-jitter',
  'margin-zone',
  'area-share',
  'aspect',
  'text-length',
  'text-size',
  'size-rank',
  'digit-normalised-repeat',
  'native-tag',
  'chart-data',
  'ocr-state',
  'ocr-density',
  'edge-stats',
  'colour-discreteness',
  'dhash-group',
  'path-hash-group',
  'known-identity',
  'column-alignment',
  'fill-count',
] as const;
export type EvidenceSignalV1 = (typeof EVIDENCE_SIGNALS)[number];

export interface EvidenceV1 {
  signal: EvidenceSignalV1;
  value: number | string | boolean;
  /** Contribution to the hypothesis, -1..1. */
  weight: number;
  /** The one plain sentence the review shows, with the numbers in it. */
  sentence?: string;
}

export interface ClassHypothesisV1 {
  class: ObjectClassV1;
  /** Internal ordering only; not shown to a person until calibrated. */
  confidence: number;
  evidence: EvidenceV1[];
  /** Runner-up class when the gap is small, so the review can offer it. */
  alternative?: ObjectClassV1;
}

/** A verified group of objects sharing one identity across slides (the same mark on 24 slides). */
export interface ObjectGroupV1 {
  id: string;
  kind: 'media' | 'vector' | 'text' | 'shape';
  /** Member object ids, after verification (exact hash, dimensions, placement). */
  members: string[];
  /** Candidates that matched by dHash or path hash but failed verification. Never acted on. */
  unverified?: string[];
  slideIds: string[];
  /** Representative member for thumbnails and evidence sentences. */
  exemplar: string;
  class: ObjectClassV1;
}

/** One use of a colour: this hex as body ink, as a background, as series 3 of a chart. Keys are use ids, never bare hexes. */
export interface ColorUseV1 {
  useId: string;
  hex: string;
  /** Theme slot when the source used a scheme reference; the plan maps slot to slot first. */
  scheme?: string;
  role: 'bg' | 'ink' | 'accent' | 'neutral' | 'series' | 'stroke';
  /** Area-weighted dominance in reference px², text weighted by run length times size. */
  weight: number;
  objectIds: string[];
  /** For `series`: the distinction set (chart object id) whose members must stay distinct. */
  distinctionSet?: string;
}

/** Two uses that must keep contrast: text on its box, or fill and stroke of one object. */
export interface ContrastPairV1 {
  foreground: string;
  background: string;
  /** 4.5 for ordinary text, 3 for large text or graphics. */
  minimum: number;
  objectId: string;
}

export interface FontUseV1 {
  family: string;
  provenance: 'theme' | 'literal';
  runs: number;
  /** Roles the face was used for, with counts. */
  roles: Partial<Record<'title' | 'subtitle' | 'body' | 'other', number>>;
  available?: boolean;
}

/** What a layout unit is. `card` is a filled shape holding text boxes; `icon` is a picture too small to be content. */
export const LAYOUT_UNIT_KINDS = ['text', 'pic', 'chart', 'table', 'card', 'shape', 'icon'] as const;
export type LayoutUnitKindV1 = (typeof LAYOUT_UNIT_KINDS)[number];

/** A box as fractions of the slide, origin top left. */
export interface FractionBoxV1 { x: number; y: number; w: number; h: number }

/**
 * One piece of kept content on a slide as the layout read sees it (plan 275
 * section 3.1): its box in slide fractions, clipped to the slide, its word count,
 * its largest type size and, for a card, the text boxes it holds.
 */
export interface LayoutUnitV1 {
  /** The source object id, or the container's object id for a card. */
  id: string;
  kind: LayoutUnitKindV1;
  box: FractionBoxV1;
  words: number;
  /** Largest run size in points; 0 when the unit holds no text. */
  maxPt: number;
  /** Source object ids a card absorbed, in reading order. */
  members?: string[];
}

/** Per-slide features the archetype fit reads. Plain numbers, so a rule can be tested on them. */
export interface LayoutFeaturesV1 {
  slideId: string;
  counts: Partial<Record<ObjectClassV1, number>>;
  largestTextPt?: number;
  imageAreaShare: number;
  chartPresent: boolean;
  tablePresent: boolean;
  distinctLeftEdges: number;
  equalSiblingBoxes: number;
  textParagraphs: number;
  textWords: number;
  sourceLayout?: string;
  /** The kept content as units, for the structure read (plan 275 section 3.1). Absent on a census from before it. */
  units?: LayoutUnitV1[];
  /**
   * Filled shapes, vectors and panels that hold text boxes, including ones the plan
   * proposes to remove as decoration: for the layout read a removed shape is still
   * a container, never content.
   */
  containers?: LayoutUnitV1[];
}

export interface DeckCensusV1 {
  version: typeof REBRAND_CONTRACT_VERSION;
  sourceHash: string;
  /** Rules identity and version, for replay. */
  rules: { name: string; version: string };
  objects: Array<{ id: string; slideId: string; origin: SourceOriginV1; hypothesis: ClassHypothesisV1; groupId?: string }>;
  groups: ObjectGroupV1[];
  colors: { uses: ColorUseV1[]; contrastPairs: ContrastPairV1[] };
  fonts: FontUseV1[];
  layouts: LayoutFeaturesV1[];
  /** Slides that are one picture covering over 90% of the slide, or a scanned pdf page. */
  flattenedSlideIds: string[];
  warnings: SourceWarningV1[];
}

// ---------------------------------------------------------------------------
// Stage 3 and 4: the renovation plan - proposals and decisions, kept apart
// ---------------------------------------------------------------------------

export const PLAN_ACTIONS = ['keep', 'replace', 'remove'] as const;
export type PlanActionV1 = (typeof PLAN_ACTIONS)[number];

export const REVIEW_STATES = ['unreviewed', 'accepted', 'needs-attention'] as const;
export type ReviewStateV1 = (typeof REVIEW_STATES)[number];

export const DECISION_AUTHORS = ['rule', 'preset', 'user', 'agent'] as const;
export type DecisionAuthorV1 = (typeof DECISION_AUTHORS)[number];

export type ReplacementV1 =
  | { kind: 'brand-logo'; variant: 'on-light' | 'on-dark' | 'mono' | 'auto' }
  | { kind: 'placeholder'; label: string }
  | { kind: 'asset'; id: string }
  | { kind: 'supplied-picture'; assetRef: string }
  | { kind: 'tool'; url: string }
  | { kind: 'filter'; toolId: string; params?: Record<string, string> };

export interface ObjectPlanV1 {
  id: string;
  class: ObjectClassV1;
  evidence: EvidenceV1[];
  /** What the first pass or the preset proposed. */
  proposal: PlanActionV1;
  proposalReplacement?: ReplacementV1;
  /** What a person or an agent decided. The effective action is `decision ?? proposal`. */
  decision?: PlanActionV1;
  decisionReplacement?: ReplacementV1;
  review: ReviewStateV1;
  author?: DecisionAuthorV1;
  /** The group the decision was applied through, when it was a group action. */
  scope?: string;
  locked?: boolean;
  /** Archetype role the object is assigned to when kept. */
  role?: ArchetypeRoleV1;
  /** Where a kept object that fits no role goes. */
  surplus?: 'continuation' | 'tray';
  /**
   * The object's text as a person corrected it (plan 275 decision 29): OCR text on a
   * slide rebuilt from a picture, or any text read wrongly. The compile writes this in
   * place of the source runs; the source keeps what was read, so the correction is a
   * decision like any other and undo restores the reading.
   */
  textOverride?: string;
}

export const ARCHETYPE_ROLES = ['title', 'subtitle', 'body', 'visual', 'data', 'caption', 'number', 'label', 'quote', 'attribution'] as const;
export type ArchetypeRoleV1 = (typeof ARCHETYPE_ROLES)[number];

export const ARCHETYPE_IDS = [
  'title',
  'section',
  'content',
  'two-column',
  'split',
  'visual',
  'full-image',
  'quote',
  'big-number',
  'main-point',
  'agenda',
  'table',
] as const;
/** The twelve archetype ids every master before the layout library carries. The published union; it does not widen. */
export type ArchetypeIdV1 = (typeof ARCHETYPE_IDS)[number];

/**
 * The same twelve under the name plan 275 gives them: the ids a master that
 * predates the layout library carries, and the labels such a master falls back
 * to. The set of archetype ids is open from plan 275 on; this list is not.
 */
export const KNOWN_ARCHETYPE_IDS = ARCHETYPE_IDS;

/**
 * A layout library entry id (plan 275 section 2.5): lower case letters, digits
 * and dashes, starting with a letter, 2 to 41 characters (`columns-3`,
 * `grid-2x2`). Ids are permanent and never reused.
 */
export type StructureIdV1 = string;

/**
 * What an archetype-valued field holds from plan 275 on: one of the twelve, or
 * an archetype a master generated from the library, whose id is the library id.
 * A reader meets an id its master does not carry by falling back and saying so.
 */
export type ArchetypeRefV1 = ArchetypeIdV1 | StructureIdV1;

/** The written form of a `StructureIdV1`; every one of the twelve matches it too. */
export const STRUCTURE_ID_PATTERN: RegExp = /^[a-z][a-z0-9-]{1,40}$/;

/** True for a string written the way an archetype or library id is written. Says nothing about whether a master carries it. */
export function isArchetypeRef(value: unknown): value is ArchetypeRefV1 {
  return typeof value === 'string' && STRUCTURE_ID_PATTERN.test(value);
}

/** True for one of the twelve archetype ids. */
export function isKnownArchetypeId(value: unknown): value is ArchetypeIdV1 {
  return typeof value === 'string' && (ARCHETYPE_IDS as readonly string[]).includes(value);
}

/**
 * One sentence a person reads: a stable code, its numbers and names, and the
 * English text. Declared here from plan 275 on, because a slide plan carries
 * them; `engine/src/rebrand-review.ts` re-exports it unchanged.
 */
export interface ReviewMessageV1 {
  code: string;
  params: Record<string, string | number>;
  text: string;
}

/** How sure the layout read is, stated to a person only as sentences (plan 275 section 3.3). */
export const LAYOUT_MATCH_BANDS = ['clear', 'likely', 'none'] as const;
export type LayoutMatchBandV1 = (typeof LAYOUT_MATCH_BANDS)[number];

/** What the structure matcher found on a slide. The number is never shown to a person. */
export interface LayoutMatchV1 {
  structure: StructureIdV1;
  /** Similarity score in 0 to 1, not a probability. */
  confidence: number;
  /** Share of the slide's kept body units the structure explains, 0 to 1. */
  coverage: number;
  band: LayoutMatchBandV1;
  /** The rounded row and grid vector plus the picture side: the key "apply to similar slides" groups by. */
  signature: string;
}

/** A slide's own ground, overriding the deck theme for that slide (plan 275 section 6.2). */
export const SLIDE_GROUNDS = ['light', 'dark', 'brand'] as const;
export type SlideGroundV1 = (typeof SLIDE_GROUNDS)[number];

export interface SlidePlanV1 {
  id: string;
  include: boolean;
  /** An archetype id the plan's master carries; from plan 275 on it may be a library id. */
  layout: ArchetypeRefV1;
  /** `auto` is a layout the one opt-in Auto-match action set (plan 275 decision 28). */
  layoutSource: 'proposed' | 'user' | 'preset' | 'auto';
  /** Runner-up archetype when the gap was small. */
  layoutAlternative?: ArchetypeRefV1;
  objects: ObjectPlanV1[];
  /** Order among included slides, when the person reordered. */
  order?: number;
  /** The coded, translatable sentences the layout chooser shows under Suggested and Also fits. Plain words; the numbers live in `params`. */
  layoutReasons?: ReviewMessageV1[];
  /** What the structure matcher found, so the queue can group and the report can say. */
  layoutMatch?: LayoutMatchV1;
  /** This slide's ground when it differs from the deck theme's. Absent means the deck's. */
  ground?: SlideGroundV1;
  /**
   * How the slide is built (plan 275 section 4, the first two chooser tiles).
   * Absent means `layout`: poured into `layout`. `original` places the kept
   * objects where the source had them, restyled by the colour and font mappings
   * (the Keep the design placement for this one slide). `picture` keeps the slide
   * as it was: the recovery picture when the slide has one, otherwise the source
   * objects at their places with no mapping applied, as one group, under the
   * master's title-only furniture. `layout` is still recorded so switching back
   * restores it.
   */
  arrangement?: SlideArrangementV1;
}

export const SLIDE_ARRANGEMENTS = ['layout', 'original', 'picture'] as const;
export type SlideArrangementV1 = (typeof SLIDE_ARRANGEMENTS)[number];

export const COLOR_UNRESOLVED_REASONS = [
  'palette-too-small',
  'contrast-unreachable',
  'locked-conflict',
  'no-candidate-in-role',
] as const;
export type ColorUnresolvedReasonV1 = (typeof COLOR_UNRESOLVED_REASONS)[number];

export interface ColorMappingV1 {
  useId: string;
  from: string;
  scheme?: string;
  role: ColorUseV1['role'];
  /** Resolved hex in the design system, when assigned. */
  to?: string;
  /** Token path when the target is a design-system token; the compile emits a scheme reference for it. */
  toPath?: string;
  locked?: boolean;
  unresolved?: ColorUnresolvedReasonV1;
  /** Object ids the mapping affects. A raster is never in this list. */
  affects: string[];
  /**
   * The target on slides whose ground differs from the deck's (plan 275 section
   * 6.2): the solver runs once per ground group, so one use can hold a second
   * target that keeps its contrast on a dark or brand ground.
   */
  byGround?: Partial<Record<'dark' | 'brand', { to?: string; toPath?: string }>>;
}

export interface FontMappingV1 {
  from: string;
  to: string;
  toPath?: string;
  /** `alias` from the substitution table, `class` from the family class, `user`. */
  source: 'alias' | 'class' | 'user';
}

/** A remembered decision, keyed by fingerprint and slide lineage, carried forward only on a verified match. */
export interface DecisionMemoryV1 {
  fingerprint: string;
  slideLineage: string;
  action: PlanActionV1;
  replacement?: ReplacementV1;
  author: DecisionAuthorV1;
  scope?: string;
  planRevision: number;
  /** Set when carried into a new revision: how the object was matched. */
  carriedBy?: 'exact' | 'fingerprint' | 'group';
}

/** The deck themes a person picks from (plan 275 section 6.1). */
export const DECK_THEME_IDS = ['light', 'dark', 'brand', 'look'] as const;
export type DeckThemeIdV1 = (typeof DECK_THEME_IDS)[number];

/**
 * A deck theme: a small token remap over the resolved design system for one
 * project (plan 275 section 6.2). `mode` names the design system mode the tokens
 * resolve in (the pack's own dark mode for Dark); `remap` moves a token path to
 * another; `flipDark` flips every archetype's `dark` flag; `lookId` names the
 * saved look a `look` theme lays over the design system.
 */
export interface DeckThemeV1 {
  id: DeckThemeIdV1;
  mode?: 'light' | 'dark';
  remap: Array<{ from: string; to: string }>;
  lookId?: string;
  flipDark?: boolean;
}

export interface DesignSystemSnapshotV1 {
  id: string;
  masterId?: string;
  masterVersion?: string;
  /** `sha256:<hex>` over the resolved token values. Taken before the theme, so a themed plan is never refused for being themed. */
  tokenHash: string;
  fontHashes: Record<string, string>;
  assetHashes: Record<string, string>;
  presetId?: string;
  presetVersion?: string;
  /** The deck theme, when a person chose one. Absent means the master as shipped. */
  theme?: DeckThemeV1;
}

/** A colour target a person or an organisation pinned for one colour use. */
export interface PresetLockedColorV1 {
  useId: string;
  /** `#rrggbb`. */
  to: string;
  toPath?: string;
}

/**
 * A named policy over the first pass (plan 274 section 2.2). Everything on it is
 * optional, and an absent field leaves the rule in place, so a preset states the
 * few things an organisation wants different rather than a whole plan. Declared
 * here from plan 275 on (it was in `engine/src/rebrand-plan.ts`, which re-exports
 * it), so its layout keys can grow without an engine edit.
 */
export interface RenovationPresetV1 {
  id: string;
  version?: string;
  /** The proposed action for a class, in place of the rule's own. */
  actions?: Partial<Record<ObjectClassV1, PlanActionV1>>;
  /** The review state a class's rows take, in place of the rule's own. */
  review?: Partial<Record<ObjectClassV1, ReviewStateV1>>;
  layout?: {
    /** An archetype forced for every slide built from this source layout part path. The keys stay part paths. */
    bySourceLayout?: Record<string, ArchetypeRefV1>;
    /** An archetype forced for every slide whose source layout has this name (`origin.layoutName`). Plan 275. */
    bySourceLayoutName?: Record<string, ArchetypeRefV1>;
    /** An archetype forced for every slide the matcher read as this structure signature or library id. Plan 275. */
    byStructure?: Record<string, ArchetypeRefV1>;
    /** The archetype a near tie falls back to. Defaults to `content`. */
    fallback?: ArchetypeRefV1;
    /** The gap under which the top two count as a tie. */
    minGap?: number;
  };
  logo?: { policy: 'brand' | 'keep' | 'drop'; variantByBackground?: boolean };
  /** Slides to leave out of the renovation. */
  excludeSlideIds?: string[];
  /** OKLab separation inside a colour distinction set. */
  minSeparation?: number;
  /** Colour targets a person or an organisation pinned. */
  lockedColors?: PresetLockedColorV1[];
}

export interface AlgorithmVersionsV1 {
  reader: string;
  census: string;
  plan: string;
  compile?: string;
}

export interface RenovationPlanV1 {
  version: typeof REBRAND_CONTRACT_VERSION;
  source: { lineageId: string; hash: string; instanceId: string };
  revision: number;
  presetId?: string;
  designSystem: DesignSystemSnapshotV1;
  algorithms: AlgorithmVersionsV1;
  mode: 'renovate' | 'keep-design';
  slides: SlidePlanV1[];
  colors: ColorMappingV1[];
  fonts: FontMappingV1[];
  logo: { policy: 'brand' | 'keep' | 'drop'; variantByBackground: boolean };
  /** Seed for the deterministic re-solve behind Shuffle. */
  shuffleSeed?: number;
  decisions: DecisionMemoryV1[];
  /** Decisions carried into this revision and those that need another look. */
  carryForward?: { carried: string[]; needsReview: string[] };
}

// ---------------------------------------------------------------------------
// Stage 5: the compiled deck - Design's own authored values, plus lineage
// ---------------------------------------------------------------------------

/** One row of Design's `boxes` blocks input in its declared field ids. The wire order lives in schemas/blocks-wire-order.json. */
export type DesignBoxRowV1 = Record<string, string | number | boolean | null>;

export interface CompiledFrameV1 {
  /** The frame layer id. */
  id: string;
  sourceSlideId: string;
  name: string;
  width: number;
  height: number;
  archetype: ArchetypeRefV1;
  masterId?: string;
  notes?: string;
  /** Child layers, in z-order, as Design box rows. Each carries `frame` = this frame id. */
  layers: DesignBoxRowV1[];
  /** Ids of layers seeded from the master's furniture. */
  furnitureLayerIds: string[];
  /** Ids of authored placeholder layers standing in for unresolved objects. */
  placeholderLayerIds: string[];
  /** True for a continuation slide the compile added for surplus content. */
  continuation?: boolean;
}

/** Source to output and output to source, both directions, one to many and many to one. */
export interface LineageV1 {
  forward: Array<{ sourceObjectId: string; layerIds: string[] }>;
  backward: Array<{ layerId: string; sourceObjectIds: string[]; derived?: 'furniture' | 'placeholder' | 'continuation' }>;
}

export interface CompiledDeckV1 {
  version: typeof REBRAND_CONTRACT_VERSION;
  source: { lineageId: string; hash: string; instanceId: string };
  planRevision: number;
  designSystem: DesignSystemSnapshotV1;
  algorithms: AlgorithmVersionsV1;
  frames: CompiledFrameV1[];
  /** Kept objects that fit no role and were sent to the tray rather than a continuation slide. */
  tray: Array<{ sourceObjectId: string; layer: DesignBoxRowV1 }>;
  lineage: LineageV1;
  report: RebrandReportV1;
}

// ---------------------------------------------------------------------------
// The report - every source object accounted for
// ---------------------------------------------------------------------------

export const DISPOSITIONS = ['retained', 'transformed', 'removed', 'unresolved'] as const;
export type DispositionV1 = (typeof DISPOSITIONS)[number];

export const REPORT_CODES = [
  'object.retained',
  'object.transformed',
  'object.removed',
  'object.unresolved',
  'object.replaced-logo',
  'object.placeholder-authored',
  'object.surplus-continuation',
  'object.surplus-tray',
  'text.overflow',
  'text.font-substituted',
  'colour.assigned',
  'colour.unresolved',
  'colour.contrast-below-minimum',
  'layout.overlap-with-furniture',
  'layout.below-readable-size',
  'source.cap-reached',
  'source.media-skipped',
  'slide.excluded',
  'slide.continuation-added',
  'review.applied-unreviewed',
  'export.verified',
  'export.not-verified',
  'text.formatting-not-carried',
  'layout.poured-to-continuation',
  'layout.auto-matched',
  'text.corrected',
  'vector.items-omitted',
  'vector.kept-as-picture',
  'vector.metafile-not-converted',
  'slide.original-arrangement',
  'slide.kept-as-picture',
] as const;
export type ReportCodeV1 = (typeof REPORT_CODES)[number];

export interface ReportEntryV1 {
  code: ReportCodeV1;
  /** Plain English, localisable by the shell from the code. */
  message: string;
  slideId?: string;
  objectId?: string;
  layerId?: string;
  disposition?: DispositionV1;
  class?: ObjectClassV1;
  action?: PlanActionV1;
  author?: DecisionAuthorV1;
  review?: ReviewStateV1;
  fidelity?: FidelityStateV1;
  reason?: string;
}

export interface RebrandReportV1 {
  version: typeof REBRAND_CONTRACT_VERSION;
  sourceHash: string;
  planRevision: number;
  counts: {
    slides: { source: number; included: number; excluded: number; continuation: number };
    objects: Record<DispositionV1, number>;
    byClass: Partial<Record<ObjectClassV1, Record<DispositionV1, number>>>;
    logosReplaced: number;
    coloursAssigned: number;
    coloursUnresolved: number;
    fontsSubstituted: number;
    appliedUnreviewed: number;
  };
  entries: ReportEntryV1[];
  /** Set only after a readback of the produced bytes; absent means "not verified", never "verified". */
  exportVerified?: { format: string; check: string };
}

// ---------------------------------------------------------------------------
// The renovation project - the durable local unit of work (plan 274 section 3.5)
// ---------------------------------------------------------------------------

export const PROJECT_STAGES = ['ingest', 'census', 'plan', 'review', 'compile', 'done'] as const;
export type ProjectStageV1 = (typeof PROJECT_STAGES)[number];

export interface RenovationProjectV1 {
  version: typeof REBRAND_CONTRACT_VERSION;
  id: string;
  name: string;
  source: SourceDeckV1['source'] & {
    /** Asset ref holding the retained source bytes; absent when the person declined to retain them. */
    bytesAssetRef?: string;
  };
  /** The last stage that completed and was written. */
  checkpoint: { stage: ProjectStageV1; at?: string; planRevision?: number };
  /** Revision counter for stale-write refusal between two tabs. */
  revision: number;
  designSystem: DesignSystemSnapshotV1;
  /** Ids of the stored records, so the project stays small and the big ones load on demand. */
  parts: { sourceDeck?: string; census?: string; plan?: string; compiled?: string };
  designSessionIds: string[];
  createdAt?: string;
  updatedAt?: string;
  /**
   * The first proposed slide drawn small, as a standalone SVG string, for the lists
   * that name the project (plan 275 close-out, section 3.2): written once after the
   * first compile, at a fixed long edge, and absent when the drawing would be over
   * `PROJECT_THUMB_SVG_MAX` bytes, where a list draws the layout's wireframe instead.
   * It names no external resource: a picture in it is drawn as a flat box.
   */
  thumbSvg?: string;
}

/** The most bytes a project's `thumbSvg` holds (UTF-8). A larger drawing is not stored. */
export const PROJECT_THUMB_SVG_MAX = 16 * 1024;

/** Outcome of one deck in a bulk run. `needs-review` is not a success. */
export const FILE_OUTCOMES = ['ready', 'needs-review', 'failed'] as const;
export type FileOutcomeV1 = (typeof FILE_OUTCOMES)[number];

export const REBRAND_ERROR_CODES = [
  'source.unreadable',
  'source.too-large',
  'source.encrypted',
  'plan.hash-mismatch',
  'plan.revision-stale',
  'plan.invalid',
  'design-system.master-missing',
  'design-system.logo-missing',
  'ocr.unavailable',
  'compile.unresolved-objects',
  'export.failed',
  'storage.quota',
] as const;
export type RebrandErrorCodeV1 = (typeof REBRAND_ERROR_CODES)[number];

/** What a surface can do for this journey. Read before promising anything. */
export interface RebrandCapabilitiesV1 {
  surface: 'web' | 'tauri' | 'cli' | 'tui' | 'mcp-local' | 'mcp-hosted';
  /** Where the bytes go. `device` or `local-process` keep them; `configured-server` transfers them. */
  bytes: 'device' | 'local-process' | 'configured-server';
  ocr: boolean;
  rasterFallback: boolean;
  nativePptx: boolean;
  designDocument: boolean;
  limits: { maxBytes?: number; maxSlides?: number; maxDecodedPixels?: number };
  retention?: string;
}

// ---------------------------------------------------------------------------
// The project store and stage events - one contract for the web store (host.state +
// user assets), the node store (a directory) and the worker runner
// ---------------------------------------------------------------------------

export const PROJECT_PART_KINDS = ['sourceDeck', 'census', 'plan', 'compiled'] as const;
export type ProjectPartKindV1 = (typeof PROJECT_PART_KINDS)[number];

/** Why a write was refused. `stale-revision` is the two-tab case; `quota` keeps the in-memory work and offers a download. */
export const PROJECT_WRITE_REFUSALS = ['stale-revision', 'quota', 'missing-project', 'invalid-part'] as const;
export type ProjectWriteRefusalV1 = (typeof PROJECT_WRITE_REFUSALS)[number];

export type ProjectWriteResultV1 =
  | { ok: true; revision: number }
  | { ok: false; refusal: ProjectWriteRefusalV1; message: string; currentRevision?: number };

export interface RenovationProjectStoreV1 {
  list(): Promise<RenovationProjectV1[]>;
  get(id: string): Promise<RenovationProjectV1 | null>;
  /** Creates the record and returns it with revision 1. */
  create(input: Omit<RenovationProjectV1, 'version' | 'revision' | 'checkpoint' | 'parts' | 'designSessionIds'>): Promise<RenovationProjectV1>;
  /** A short transaction: the caller passes the revision it read; a different stored revision refuses the write. */
  update(id: string, expectedRevision: number, patch: Partial<Omit<RenovationProjectV1, 'id' | 'version' | 'revision'>>): Promise<ProjectWriteResultV1>;
  /** Writes one big part and points the project at it, under the same revision rule. */
  putPart(id: string, expectedRevision: number, kind: ProjectPartKindV1, value: SourceDeckV1 | DeckCensusV1 | RenovationPlanV1 | CompiledDeckV1): Promise<ProjectWriteResultV1>;
  getPart<T = unknown>(id: string, kind: ProjectPartKindV1): Promise<T | null>;
  /** Marks a stage complete. The checkpoint is what recovery resumes from. */
  checkpoint(id: string, expectedRevision: number, stage: ProjectStageV1, planRevision?: number): Promise<ProjectWriteResultV1>;
  /** Removes the project, its parts and its derivatives; shared asset bytes are removed only when nothing else references them. */
  remove(id: string): Promise<{ removedAssetRefs: string[]; keptAssetRefs: string[] }>;
}

/** Progress a stage runner reports. Counts, never an invented percentage. */
export interface StageProgressV1 {
  projectId: string;
  planRevision?: number;
  stage: ProjectStageV1;
  /** "Reading slide 8 of 40", "Review ready; reading text on 6 slides". */
  message: string;
  done?: number;
  total?: number;
}

/** A stage result is accepted only when its project id and plan revision match what the view holds now. */
export interface StageEnvelopeV1<T = unknown> {
  projectId: string;
  planRevision?: number;
  stage: ProjectStageV1;
  /** Algorithm version the result came from, so a changed rule never overwrites an accepted decision. */
  algorithmVersion: string;
  result: T;
}

/** Decoded-pixel and cache ceilings a device class gets. Numbers, so a test can pin them. */
export interface DecodeBudgetV1 {
  deviceClass: 'desktop' | 'laptop' | 'phone';
  maxDecodedPixels: number;
  maxCacheBytes: number;
  thumbnailLongEdge: number;
  previewLongEdge: number;
  ocrConcurrency: number;
  decodeConcurrency: number;
}
