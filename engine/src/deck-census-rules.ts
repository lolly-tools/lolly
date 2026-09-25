// SPDX-License-Identifier: MPL-2.0
/**
 * The class rules of the deck census (plan 274 section 3.2), as one pure
 * function over plain numbers.
 *
 * `censusDeck` in `deck-census.ts` measures a source object into an
 * `ObjectFeaturesV1` record; everything about what that object PROBABLY is
 * happens here, so a rule can be read, tested and changed without touching the
 * measurement. Three facts stay apart, because folding them together is how a
 * confidentiality line gets deleted:
 *
 *   - origin, which is where the object was declared and is carried straight
 *     from the source model,
 *   - the class hypothesis these rules produce, with the evidence that reached
 *     it and a confidence used for ordering only,
 *   - the proposed action, which is a later stage's policy and never appears in
 *     this file.
 *
 * Every rule returns its evidence as `EvidenceV1` rows carrying a signal, the
 * measured value and a weight. The one plain sentence each row carries is
 * written from `REVIEW_MESSAGES` in `rebrand-review.ts` by `evidenceMessage`, so
 * the review translates it by code and a test can read the same rows.
 *
 * Pure: no DOM, no clock, no filesystem, no randomness.
 */

import type {
  ClassHypothesisV1,
  EvidenceV1,
  ObjectClassV1,
  PlaceholderTypeV1,
  SourceObjectKindV1,
  SourceOriginV1,
} from '@lolly-tools/core';

import { evidenceMessage } from './rebrand-review.ts';
import { compareCodeUnits } from './rebrand-order.ts';

/** Rule identity and version, recorded on the census for replay. */
export const CENSUS_RULES = { name: 'deck-census-rules', version: 'census-rules-2026-09-25.1' } as const;

// ─── the numbers the rules turn on, in one place so a test can read them ─────

/** A group on at least this share of the slides feeds decoration and logo candidates. */
export const REPEAT_SHARE_FLOOR = 0.2;
/** Preset shape names of the connector tool: straight, bent and curved connectors. */
export const CONNECTOR_GEOM = /^(straight|bent|curved)Connector\d*$/;
/** A logo candidate repeats on more than half the slides. */
export const LOGO_REPEAT_SHARE = 0.5;
/** A logo candidate covers under this share of the slide. */
export const LOGO_MAX_AREA_SHARE = 0.06;
/** The outer band, as a share of slide width and height, a logo candidate sits in. */
export const MARGIN_BAND_SHARE = 0.15;
/** A logo candidate's width over height stays between these. */
export const LOGO_ASPECT_MIN = 1;
export const LOGO_ASPECT_MAX = 8;
/**
 * A logo candidate's long side stays under this share of the matching slide
 * side. A strip of picture across the top of a layout (SAP - Event in a Box: 583
 * by 89 px on a 1280 px slide, 46%) is small in area and sits in the margin,
 * and is still a strip rather than a mark.
 */
export const LOGO_MAX_LONG_SIDE_SHARE = 0.3;
/** A known logo matches by exact content hash, or by dHash within this many bits. */
export const KNOWN_LOGO_HAMMING = 6;
/** Text under this size counts as small for the decoration rule. */
export const SMALL_TEXT_PT = 8;
/** A repeated small line with more words than this keeps its content class. */
export const DECORATION_MAX_WORDS = 2;
/** A repeated line longer than this many words is read as a sentence, not a key. */
export const LABEL_MAX_WORDS = 8;
/** A rect covering at least this share of the slide reads as page furniture. */
export const FULL_BLEED_AREA_SHARE = 0.2;
/** A rect whose long side covers at least this share of the slide reads as a band. */
export const PAGE_WIDE_SHARE = 0.8;
/** Recognised characters per 1000 px squared above which a picture is text heavy. */
export const TEXT_DENSITY_FLOOR = 0.5;
/** Edge runs on the long axis at or above this share read as drawn graphics. */
export const GRAPHICS_EDGE_SHARE = 0.5;
/** Distinct colours at or below this count read as drawn graphics. */
export const GRAPHICS_DISTINCT_COLORS = 64;
/** A runner-up within this confidence gap is offered as the alternative. */
export const ALTERNATIVE_GAP = 0.15;
/**
 * A heading in the top band over a slide of body copy may run to this many
 * characters and still be read as the title, one paragraph at most. A banner
 * that states a term and its definition is the case (MEDDPICC: 101 to 126
 * characters); a whole introductory paragraph is not.
 */
export const HEADING_MAX_CHARS = 160;
/** A lone letter at or above this size is a badge, the "M" of an acronym, and not a line of text. */
export const DISPLAY_LETTER_PT = 24;
/**
 * Row numbering (plan 275 section 3.2, the labelled stack): at least this many short
 * markers of one or two characters in one column...
 */
export const ROW_MARKER_MIN = 3;
/** ...their left edges within this share of the slide width... */
export const ROW_MARKER_EDGE = 0.05;
/** ...each with a longer text starting within this share of the slide width to its right. */
export const ROW_MARKER_GAP = 0.12;
/**
 * A generator's mark on a picture deck ("NotebookLM", "Made with Gamma"): a
 * rebuilt object at one slide corner, at the same place on more than this
 * share of the deck's picture slides...
 */
export const GENERATOR_MARK_SHARE = 0.5;
/** ...covering under this share of the slide... */
export const GENERATOR_MARK_MAX_AREA = 0.01;
/** ...and, when it is text, of at most this many words. */
export const GENERATOR_MARK_MAX_WORDS = 3;
/** A small picture a picture slide's rebuild made in a margin, reading at most this many words, is a logo's lockup. */
export const LOCKUP_MAX_WORDS = 2;
/**
 * Wording a short corner line carries when it is a legal or classification
 * notice rather than a generator's name: such a line is kept for a person to
 * judge, never proposed for removal as a mark. Rules data, matched without case.
 */
export const LEGAL_NOTICE = /\b(confidential|internal|proprietary|restricted|classified|secret|sensitive|copyright|draft|embargo(ed)?|nda|rights reserved|do not (distribute|copy|share|forward|circulate))\b|\u00a9|\(c\)/i;

/**
 * What the census measured about one object. Plain numbers and flags, so every
 * rule below is testable without a deck.
 */
export interface ObjectFeaturesV1 {
  objectId: string;
  slideId: string;
  kind: SourceObjectKindV1;
  origin: SourceOriginV1;
  placeholder?: PlaceholderTypeV1;
  /** Box area over slide area. */
  areaShare: number;
  /** Width over height, or 0 when the height is 0. */
  aspect: number;
  /** The box centre sits in the outer band of the slide. */
  marginZone: boolean;
  /** The box centre sits in the top or the bottom band. */
  topBand: boolean;
  bottomBand: boolean;
  /** The long side of the box over the matching slide side. */
  longSideShare: number;
  /** The object states a fill colour. */
  hasFill: boolean;
  /** Distinct fill values a vector states, for the diagram rule. */
  fillCount: number;
  hasText: boolean;
  textLength: number;
  wordCount: number;
  /** Words written wholly in lower case, the prose signal a repeated line is read by. */
  lowerCaseWords: number;
  digitsOnly: boolean;
  dateLike: boolean;
  /** The largest run size on the object, in points. */
  maxTextPt?: number;
  /**
   * Rank of this object's largest text size among the distinct sizes of the
   * slide's text objects, 0 is the largest. Equal sizes share a rank, so the rank
   * counts larger sizes, not larger texts, and the review sentence says sizes.
   */
  sizeRank?: number;
  textParagraphs: number;
  /** Slides the object's verified group appears on. */
  repeatCount: number;
  repeatShare: number;
  /** The widest normalised box offset from the group's reference box. */
  positionJitter: number;
  /** The group's members carry byte identical media or identical text. */
  exactRepeat: boolean;
  /** The group holds together only once digit runs are wildcarded. */
  digitRepeatOnly: boolean;
  /** The verified group this object belongs to, when it has one. */
  groupId?: string;
  /** How the group was generated: by exact hash, by dHash or by a path hash. */
  groupBy?: 'exact' | 'dhash' | 'path-hash';
  /** The graphicData uri or plot element name, for a native chart or diagram. */
  tag?: string;
  hasChartData: boolean;
  seriesCount: number;
  hasTable: boolean;
  ocrState?: 'not-run' | 'unavailable' | 'no-text-found' | 'text-found';
  ocrDensity?: number;
  axisAlignedEdgeShare?: number;
  distinctColors?: number;
  /** The label of the known source identity this object matched. */
  knownLogoLabel?: string;
  /** Bits between this object's dHash and the known logo's, when it matched on one. */
  knownLogoDistance?: number;
  /** The object carries no bytes and no model, so its appearance is unavailable. */
  unavailable: boolean;
  /** A shape drawn with its own outline (a freeform) rather than a preset such as a rectangle. */
  customGeometry?: boolean;
  /** The preset name when the shape is a connector (straight, bent or curved), which joins parts of a drawing. */
  connector?: string;
  /** Objects in this object's innermost group on its slide, itself included, when it is in one. */
  groupSize?: number;
  /** Distinct fills among those group members. */
  groupFills?: number;
  /** Every member of that group is a textless shape or vector: the group is a drawing. */
  groupIsDrawing?: boolean;
  /** Another object on the slide is a title placeholder with text in it. */
  titleOnSlide?: boolean;
  /**
   * A drawing carried as items that reads as a chart (`vectorChartEvidence` in
   * `deck-census-vector.ts`: its own title names a chart, or its bars share an edge
   * and state series names). Its confidence and evidence rows, as that reading gives them.
   */
  vectorChart?: { confidence: number; evidence: EvidenceV1[] };
  /** The text is one letter and nothing else. */
  loneLetter?: boolean;
  /**
   * The text is one of a column of short markers (one or two characters: a letter
   * of an acronym, a row number), each level with a longer text that starts just to
   * its right (plan 275 section 3, the MEDDPICC case): the markers number the rows,
   * so they are content, never ornament.
   */
  rowNumbering?: boolean;
  /** Rank of this text's largest size among the slide's texts of two or more words, 0 is the largest. Absent for shorter text. */
  wordRank?: number;
  /** This text alone holds the slide's largest size among texts of two or more words. */
  uniqueLargest?: boolean;
  /** The first text of two or more words in the slide's top band, reading down. */
  topmostInTopBand?: boolean;
  /** The slide's largest text of two or more words is a block (more than two paragraphs or 120 characters). */
  largestIsBlock?: boolean;
  /**
   * For an object a flattened slide was rebuilt into (`raster-region`) whose box
   * reaches into a slide corner: the share of the deck's picture slides that
   * show such an object at the same place, this slide included.
   */
  cornerRepeatShare?: number;
  /**
   * For a picture at a repeated corner place: a short text at a repeated corner
   * place stands beside it on its slide, so the two are one stamp (an icon and
   * its name) rather than a logo on its own.
   */
  markWordBeside?: boolean;
  /**
   * Text a picture slide was rebuilt into whose rebuild estimated it as the
   * slide's title (`roleEstimate`), the largest such text on its slide.
   */
  roleTitle?: boolean;
  /** Words its OCR evidence read, for a picture whose reading found text. */
  ocrWords?: number;
  /** The text holds a figure: a page number, a date, a version. */
  hasDigit?: boolean;
  /** The text carries legal or classification wording (`LEGAL_NOTICE`). */
  legalNotice?: boolean;
  /**
   * A shape a picture slide was rebuilt into that other objects on its slide,
   * text among them, name as their container (`groupPath`): a card's panel or a
   * callout's box.
   */
  holdsText?: boolean;
}

interface Candidate {
  class: ObjectClassV1;
  confidence: number;
  evidence: EvidenceV1[];
}

/**
 * Every row with its one sentence, written from the review's message table so the
 * census, the plan and the queue read the same words. The sentence says what was
 * found, never how the rule works; the reasons live in the comments above.
 */
function withSentences(evidence: readonly EvidenceV1[], klass: ObjectClassV1, kind: SourceObjectKindV1): EvidenceV1[] {
  return evidence.map((row, index) => ({ ...row, sentence: evidenceMessage(evidence, index, { class: klass, kind }).text }));
}

/** A picture whose statistics read as drawn graphics rather than a photograph. */
function graphicsLike(f: ObjectFeaturesV1): boolean {
  const edges = f.axisAlignedEdgeShare;
  const colors = f.distinctColors;
  if (edges === undefined && colors === undefined) return false;
  const edgeVote = edges === undefined ? true : edges >= GRAPHICS_EDGE_SHARE;
  const colorVote = colors === undefined ? true : colors <= GRAPHICS_DISTINCT_COLORS;
  return edgeVote && colorVote;
}

/** A picture whose statistics read as a photograph: short random edges, many colours. */
function photoLike(f: ObjectFeaturesV1): boolean {
  const edges = f.axisAlignedEdgeShare;
  const colors = f.distinctColors;
  if (edges === undefined && colors === undefined) return false;
  const edgeVote = edges === undefined ? true : edges < GRAPHICS_EDGE_SHARE;
  const colorVote = colors === undefined ? true : colors > GRAPHICS_DISTINCT_COLORS;
  return edgeVote && colorVote;
}

/** Text with a word in it, which is what keeps a repeated line out of the bin. */
function wordBearing(f: ObjectFeaturesV1): boolean {
  return f.hasText && f.wordCount > 0 && !f.digitsOnly;
}

/**
 * A repeated line reads as prose when it carries a word written wholly in lower
 * case ("Figures in EUR millions"), and as a label when it does not
 * ("Key: EU, US, APAC").
 *
 * Known limit, stated rather than hidden: the signal is lower case Latin
 * letters, so an all-caps line ("FIGURES IN EUR MILLIONS") and a language that
 * capitalises its nouns ("Vertrauliche Interne Verwendung") both score zero and
 * read as a label. A caseless script (CJK, Arabic, Hebrew) scores as lower case
 * and stays prose, which is the safe direction. The word floor below is the
 * second signal that keeps a long all-caps sentence out of the label branch,
 * and `repeats` no longer lets this test veto a footer on placement, so the
 * cost of getting it wrong is a confidence and an alternative rather than a
 * class. Measured on 52 synthetic objects and, on 2026-09-24, on three labelled
 * private decks: there it costs six objects, the column headings "Why SUSE" and
 * "Customer Challenges" that Why SUSE Summary repeats on three slides, which a
 * person reads as content and this test reads as recurring text. Both are kept
 * and flagged, so the miss is a noun, not a removal.
 */
function proseLike(f: ObjectFeaturesV1): boolean {
  return f.lowerCaseWords > 0;
}

/** A repeated line short enough, and written flatly enough, to read as a key. */
function labelLike(f: ObjectFeaturesV1): boolean {
  return !proseLike(f) && f.wordCount <= LABEL_MAX_WORDS;
}

/** Declared by the slide layout or the master, so every slide on that layout shows it. */
function inherited(f: ObjectFeaturesV1): boolean {
  return f.origin === 'layout' || f.origin === 'master';
}

/** A picture, or a drawing: a vector, or a shape drawn as a freeform, with no text. */
function markLike(f: ObjectFeaturesV1): boolean {
  if (f.hasText) return false;
  return f.kind === 'pic' || f.kind === 'vector' || (f.kind === 'shape' && f.customGeometry === true);
}

/** A title's shape: at most two paragraphs and 120 characters. */
function titleLength(f: ObjectFeaturesV1): boolean {
  return f.textParagraphs <= 2 && f.textLength <= 120;
}

function repeats(f: ObjectFeaturesV1): boolean {
  return f.groupId !== undefined && f.repeatShare >= REPEAT_SHARE_FLOOR && f.repeatCount > 1;
}

function repeatEvidence(f: ObjectFeaturesV1): EvidenceV1[] {
  const rows: EvidenceV1[] = [
    { signal: 'repeat-count', value: f.repeatCount, weight: 0.3 },
    { signal: 'repeat-share', value: Number(f.repeatShare.toFixed(3)), weight: 0.2 },
  ];
  if (f.positionJitter > 0) {
    rows.push({ signal: 'position-jitter', value: Number(f.positionJitter.toFixed(4)), weight: 0.05 });
  }
  if (f.groupBy) {
    const signal = f.groupBy === 'path-hash' ? 'path-hash-group' : f.groupBy === 'dhash' ? 'dhash-group' : 'repeat-count';
    rows.push({ signal, value: f.groupBy, weight: 0.05 });
  }
  return rows;
}

function originEvidence(f: ObjectFeaturesV1): EvidenceV1 {
  return { signal: 'origin', value: f.origin, weight: 0.3 };
}

// ─── the rule table of plan 274 section 3.2, row by row ──────────────────────

function nativeCandidates(f: ObjectFeaturesV1): Candidate[] {
  const out: Candidate[] = [];
  if (f.kind === 'table' || f.hasTable) {
    out.push({
      class: 'table',
      confidence: 0.95,
      evidence: [{ signal: 'native-tag', value: 'table', weight: 0.95 }],
    });
  }
  if (f.kind === 'chart' || f.hasChartData || /chart|diagram/i.test(f.tag ?? '')) {
    const evidence: EvidenceV1[] = [];
    if (f.tag) evidence.push({ signal: 'native-tag', value: f.tag, weight: 0.6 });
    // The file's own data outranks anything read off pixels.
    if (f.hasChartData) evidence.push({ signal: 'chart-data', value: f.seriesCount, weight: 0.35 });
    out.push({ class: 'chart', confidence: 0.95, evidence });
  }
  // A drawing whose items read as a chart. At its own confidence, which a tie with a
  // large textless drawing's ornament reading settles for the chart by class order.
  if (f.vectorChart) out.push({ class: 'chart', confidence: f.vectorChart.confidence, evidence: [...f.vectorChart.evidence] });
  return out;
}

/**
 * What a placeholder binding says the object is.
 *
 * A content-bearing slot (title, subtitle, body) only carries its class when
 * there is text in it. An empty inherited title box is an empty slot, not a
 * title: reporting it as a title at 0.95 would put a confident content class in
 * front of a reviewer with nothing behind it, and would count it as a title in
 * the layout census that the archetype fit reads.
 */
function placeholderCandidates(f: ObjectFeaturesV1): Candidate[] {
  const ph = f.placeholder;
  if (!ph) return [];
  const named = (klass: ObjectClassV1, confidence: number): Candidate => ({
    class: klass,
    confidence,
    evidence: [{ signal: 'placeholder', value: ph, weight: confidence }],
  });
  const emptySlot = (): Candidate[] => [{
    class: 'template-furniture',
    confidence: 0.6,
    evidence: [{ signal: 'placeholder', value: ph, weight: 0.4 }, originEvidence(f)],
  }];
  switch (ph) {
    case 'sldNum': return [named('page-number', 0.95)];
    case 'ftr': return [named('footer', 0.9)];
    case 'dt': return [named('date', 0.9)];
    case 'title': case 'ctrTitle': return f.hasText ? [named('title', 0.95)] : emptySlot();
    case 'subTitle': return f.hasText ? [named('subtitle', 0.9)] : emptySlot();
    case 'body': {
      if (!f.hasText) return emptySlot();
      // A foreign template that sets its titles in a text slot: on a slide with
      // no title placeholder in use, the one largest short line of two or more
      // words is the title, whichever slot it was typed into.
      if (!f.titleOnSlide && f.wordRank === 0 && f.uniqueLargest === true && titleLength(f)) {
        return [{
          class: 'title',
          confidence: 0.85,
          evidence: [
            { signal: 'size-rank', value: f.sizeRank ?? 0, weight: 0.5 },
            { signal: 'placeholder', value: ph, weight: 0.3 },
            { signal: 'text-length', value: f.wordCount, weight: 0.1 },
          ],
        }, named('body', 0.8)];
      }
      return [named('body', 0.8)];
    }
    // Any other slot left empty (a picture, chart or table slot) is an empty
    // slot too; one with text in it is read by the text rules.
    default: return f.hasText ? [] : emptySlot();
  }
}

/**
 * A small mark in the margin: the logo rule's shape test, shared by a picture, a
 * vector drawing and a freeform shape, since a template draws its mark in one
 * of those three ways.
 */
function marginMark(f: ObjectFeaturesV1): boolean {
  return markLike(f) && f.marginZone && f.areaShare < LOGO_MAX_AREA_SHARE
    && f.longSideShare < LOGO_MAX_LONG_SIDE_SHARE
    && f.aspect >= LOGO_ASPECT_MIN && f.aspect <= LOGO_ASPECT_MAX;
}

function markCandidates(f: ObjectFeaturesV1): Candidate[] {
  if (!markLike(f)) return [];
  const out: Candidate[] = [];
  if (f.knownLogoLabel !== undefined) {
    out.push({
      class: 'known-logo',
      confidence: 0.95,
      evidence: [{ signal: 'known-identity', value: f.knownLogoLabel, weight: 0.95 }],
    });
  }
  if (!marginMark(f)) return out;
  const shape = [
    { signal: 'area-share' as const, value: Number(f.areaShare.toFixed(4)), weight: 0.2 },
    { signal: 'margin-zone' as const, value: true, weight: 0.2 },
    { signal: 'aspect' as const, value: Number(f.aspect.toFixed(2)), weight: 0.1 },
  ];
  if (repeats(f) && f.repeatShare > LOGO_REPEAT_SHARE) {
    out.push({ class: 'logo-candidate', confidence: 0.85, evidence: [...repeatEvidence(f), ...shape] });
  } else if (f.origin === 'raster-region' && f.kind === 'pic' && f.ocrState === 'text-found' && (f.ocrWords ?? 0) >= 1 && (f.ocrWords ?? 0) <= LOCKUP_MAX_WORDS) {
    // A picture slide's rebuild keeps a mark and the name beside it in a margin
    // as one picture (a logo's lockup): a small picture there reading a word or
    // two is a logo, whether or not it repeats, since a picture deck often shows
    // its logos on a few slides only. The review confirms it.
    out.push({ class: 'logo-candidate', confidence: 0.7, evidence: [{ signal: 'ocr-state', value: 'text-found', weight: 0.3 }, ...shape] });
  } else if (inherited(f)) {
    // The layout repeats it by construction: every slide on that layout shows
    // it, so a small mark the template placed in the margin is a logo candidate
    // even on a deck where only one slide uses the layout. That holds when the
    // mark is the active design system's own logo too: the census says what the
    // object is, and replacing a mark with the same mark is the plan's answer,
    // not a reason to carry it as an unclassed picture.
    out.push({ class: 'logo-candidate', confidence: 0.85, evidence: [originEvidence(f), ...shape] });
  }
  return out;
}

/**
 * The generator's mark on a picture deck. A slide tool that exports every slide
 * as one picture stamps its name in a corner of each ("NotebookLM", "Made with
 * Gamma"); rebuilt from the picture, the stamp comes back as a short text or a
 * small picture at the same corner on most slides. It is decoration, proposed for
 * removal like the rest, whatever it says: no product name is known here, and the
 * repetition at one corner across the picture slides is the whole signal. The
 * reading can differ from slide to slide ("NotebookLM", "NotebookL M"), so the
 * repetition is measured by place, not by the text grouping.
 */
function generatorMarkCandidates(f: ObjectFeaturesV1): Candidate[] {
  const share = f.cornerRepeatShare;
  if (f.origin !== 'raster-region' || share === undefined || share <= GENERATOR_MARK_SHARE) return [];
  if (f.kind !== 'text' && f.kind !== 'pic') return [];
  if (f.areaShare >= GENERATOR_MARK_MAX_AREA) return [];
  if (f.hasText && f.wordCount > GENERATOR_MARK_MAX_WORDS) return [];
  // What a corner line also is, left to the rules that know it: a page number
  // or a date carries figures, and a legal or classification notice its wording.
  if (f.hasText && (f.hasDigit === true || f.legalNotice === true)) return [];
  // A picture repeated byte for byte (or by dHash) in the margin on most slides,
  // with no stamp's name beside it, is a logo: the logo rule replaces it.
  if (f.kind === 'pic' && f.markWordBeside !== true && marginMark(f) && repeats(f) && f.repeatShare > LOGO_REPEAT_SHARE) return [];
  return [{
    class: 'decoration',
    confidence: 0.9,
    evidence: [
      { signal: 'repeat-share', value: Number(share.toFixed(3)), weight: 0.4 },
      { signal: 'margin-zone', value: f.bottomBand ? 'bottom' : 'top', weight: 0.2 },
      { signal: 'area-share', value: Number(f.areaShare.toFixed(4)), weight: 0.1 },
      originEvidence(f),
    ],
  }];
}

function pictureCandidates(f: ObjectFeaturesV1): Candidate[] {
  if (f.kind !== 'pic' && f.kind !== 'vector') return [];
  const out: Candidate[] = [];

  // A picture the layout or master placed is the template's own, whatever it
  // shows: it comes with the template and is never content a slide chose, so it
  // does not ask the archetype for a picture slot. Origin outranks what the
  // pixels read as (photo 0.75 and below), and a mark rule outranks origin.
  if (inherited(f) && !marginMark(f) && f.knownLogoLabel === undefined) {
    out.push({ class: 'template-furniture', confidence: 0.8, evidence: [originEvidence(f), { signal: 'area-share', value: Number(f.areaShare.toFixed(4)), weight: 0.1 }] });
  }

  const ocr = f.ocrState;
  if (ocr === 'text-found' && (f.ocrDensity ?? 0) >= TEXT_DENSITY_FLOOR && graphicsLike(f)) {
    out.push({
      class: 'chart',
      confidence: 0.6,
      evidence: [
        { signal: 'ocr-density', value: Number((f.ocrDensity ?? 0).toFixed(3)), weight: 0.3 },
        { signal: 'edge-stats', value: Number((f.axisAlignedEdgeShare ?? 0).toFixed(3)), weight: 0.2 },
        { signal: 'colour-discreteness', value: f.distinctColors ?? 0, weight: 0.15 },
      ],
    });
  }
  if (ocr === 'text-found' && photoLike(f)) {
    out.push({
      class: 'screenshot',
      confidence: 0.65,
      evidence: [
        { signal: 'ocr-state', value: ocr, weight: 0.3 },
        { signal: 'edge-stats', value: Number((f.axisAlignedEdgeShare ?? 0).toFixed(3)), weight: 0.25 },
      ],
    });
  }
  if (ocr === 'no-text-found' && photoLike(f)) {
    out.push({
      class: 'photo',
      confidence: 0.75,
      evidence: [
        { signal: 'ocr-state', value: ocr, weight: 0.35 },
        { signal: 'edge-stats', value: Number((f.axisAlignedEdgeShare ?? 0).toFixed(3)), weight: 0.25 },
        { signal: 'area-share', value: Number(f.areaShare.toFixed(4)), weight: 0.1 },
      ],
    });
  }
  // Text that was not read is not evidence of a photograph: diagrams, maps and
  // product art carry no text either, so such a picture stays unknown.
  if (ocr === undefined || ocr === 'not-run' || ocr === 'unavailable') {
    out.push({
      class: 'unknown',
      confidence: 0.4,
      evidence: [{ signal: 'ocr-state', value: ocr ?? 'not-run', weight: 0.4 }],
    });
  }

  if (f.kind === 'vector' && f.fillCount >= 3 && !f.hasText) {
    out.push({
      class: 'diagram',
      confidence: 0.6,
      evidence: [{ signal: 'fill-count', value: f.fillCount, weight: 0.4 }],
    });
  }
  return out;
}

function shapeCandidates(f: ObjectFeaturesV1): Candidate[] {
  if (f.kind !== 'shape' && f.kind !== 'vector') return [];
  if (f.hasText) return [];
  // A placeholder is a slot, never ornament: an empty one is template
  // furniture (the placeholder rule), whatever its size or repetition.
  if (f.placeholder) return [];
  const out: Candidate[] = [];
  // The panel or box a picture slide's rebuild found holding text (a card, a
  // callout) is what makes those objects one unit. It is not ornament to drop
  // with the rest; no class names a container yet, so it stays unclassed and is
  // kept for a person, above the size, fill and repetition rules below.
  if (f.holdsText === true && f.origin === 'raster-region') {
    out.push({
      class: 'unknown',
      confidence: 0.82,
      evidence: [
        originEvidence(f),
        { signal: 'area-share', value: Number(f.areaShare.toFixed(4)), weight: 0.2 },
        { signal: 'fill-count', value: Math.max(1, f.fillCount), weight: 0.1 },
      ],
    });
  }
  // Part of a drawing on the slide itself: a freeform, or one of several
  // textless shapes grouped together with nothing else, that is not a band the
  // slides repeat. What the layout or master draws is the template's ornament. An icon or a diagram segment is drawn
  // this way, and each part is content of the drawing rather than ornament of
  // the slide. A repeated or page-wide part still reads as decoration below,
  // and wins, because those rules are stronger.
  const drawnPart = f.customGeometry === true || ((f.groupSize ?? 0) >= 2 && f.groupIsDrawing === true);
  if (drawnPart && f.origin === 'slide' && !repeats(f)) {
    const fills = f.groupFills ?? 0;
    out.push({
      class: 'diagram',
      confidence: 0.62,
      evidence: fills >= 2
        ? [{ signal: 'fill-count', value: fills, weight: 0.3 }]
        : [{ signal: 'text-length', value: 0, weight: 0.2 }, { signal: 'area-share', value: Number(f.areaShare.toFixed(4)), weight: 0.1 }],
    });
  }
  // A connector drawn on the slide itself is a line of a drawing: the connector
  // tool joins shapes. template-example slide 18 draws its timeline axis as one
  // across the whole slide, and the page-wide rule below read it as ornament and
  // proposed its removal (a label marks it as one to keep). So a connector
  // outranks the page-wide rule; a repeated one still reads as decoration,
  // which is stronger. On the private corpus this moves one labelled object
  // (the axis, from a diagram>decoration miss to a hit) and nine unlabelled
  // connectors (SAP - Event in a Box 7, Sovereignty Conversations 2).
  if (f.connector !== undefined && f.origin === 'slide' && !repeats(f)) {
    out.push({
      class: 'diagram',
      confidence: 0.75,
      evidence: [{ signal: 'native-tag', value: f.connector, weight: 0.3 }, { signal: 'text-length', value: 0, weight: 0.1 }],
    });
  }
  if (repeats(f)) {
    out.push({
      class: 'decoration',
      confidence: 0.8,
      evidence: [...repeatEvidence(f), { signal: 'text-length', value: 0, weight: 0.2 }],
    });
  }
  if (f.areaShare >= FULL_BLEED_AREA_SHARE || f.longSideShare >= PAGE_WIDE_SHARE) {
    out.push({
      class: 'decoration',
      confidence: 0.7,
      evidence: [
        { signal: 'area-share', value: Number(f.areaShare.toFixed(4)), weight: 0.3 },
        { signal: 'text-length', value: 0, weight: 0.2 },
      ],
    });
  }
  if (f.hasFill) {
    out.push({
      class: 'decoration',
      confidence: 0.55,
      evidence: [{ signal: 'fill-count', value: Math.max(1, f.fillCount), weight: 0.25 }],
    });
  }
  return out;
}

function textCandidates(f: ObjectFeaturesV1): Candidate[] {
  if (!f.hasText) return [];
  const out: Candidate[] = [];

  if (f.digitsOnly && repeats(f) && f.marginZone) {
    out.push({
      class: 'page-number',
      confidence: 0.8,
      evidence: [...repeatEvidence(f), { signal: 'digit-normalised-repeat', value: true, weight: 0.3 }],
    });
  }

  if (f.origin === 'layout' || f.origin === 'master') {
    if (wordBearing(f)) {
      // Words in it mean repetition alone does not make it disposable. Text the
      // template draws on one slide only (a closing slide's address block) does
      // not recur in this deck, so it is template furniture first and recurring
      // text second; both are kept and flagged, so only the noun moves.
      const recurs = repeats(f);
      out.push({
        class: 'recurring-text',
        confidence: recurs ? 0.75 : 0.62,
        evidence: [originEvidence(f), { signal: 'text-length', value: f.wordCount, weight: 0.25 }],
      });
      out.push({
        class: 'template-furniture',
        confidence: recurs ? 0.6 : 0.75,
        evidence: [originEvidence(f), { signal: 'text-length', value: f.wordCount, weight: 0.2 }],
      });
    } else {
      out.push({ class: 'template-furniture', confidence: 0.7, evidence: [originEvidence(f)] });
    }
  }

  if (repeats(f)) {
    const isLabel = labelLike(f);
    if (f.digitRepeatOnly) {
      // A line of digits alone that changes from slide to slide in the margin is the
      // slide's number, whatever band it sits in: the footer rule above ties with the
      // page-number rule at one confidence and the alphabet used to settle it as a
      // footer, which put the old number in the new footer beside the new number (F2).
      const numbered = f.digitsOnly && !f.dateLike && f.marginZone;
      const klass: ObjectClassV1 = f.dateLike ? 'date' : numbered ? 'page-number' : f.bottomBand ? 'footer' : 'recurring-text';
      out.push({
        class: klass,
        confidence: 0.8,
        evidence: [
          ...repeatEvidence(f),
          { signal: 'digit-normalised-repeat', value: true, weight: 0.3 },
          ...(f.bottomBand ? [{ signal: 'margin-zone' as const, value: 'bottom', weight: 0.15 }] : []),
        ],
      });
    } else if (isLabel) {
      const klass: ObjectClassV1 = f.bottomBand && f.marginZone ? 'footer' : 'recurring-text';
      out.push({
        class: klass,
        confidence: 0.7,
        evidence: [...repeatEvidence(f), { signal: 'text-length', value: f.wordCount, weight: 0.2 }],
      });
    } else if (f.bottomBand && f.marginZone) {
      // Prose repeated in the bottom margin band is raised as a footer
      // CANDIDATE rather than dropped. It sits just under the body rule, so the
      // class stays body and footer comes back as the alternative: a repeated
      // sentence-case line down there is a real footer about as often as it is
      // a note that belongs to the slide ("Figures in EUR millions"), and
      // nothing measured here separates the two. Before this the prose test
      // vetoed the whole branch, so a footer written in sentences left no trace.
      out.push({
        class: 'footer',
        confidence: 0.55,
        evidence: [
          ...repeatEvidence(f),
          { signal: 'margin-zone', value: 'bottom', weight: 0.2 },
          { signal: 'text-length', value: f.wordCount, weight: 0.1 },
        ],
      });
    }
    if ((f.maxTextPt ?? 99) < SMALL_TEXT_PT && f.wordCount <= DECORATION_MAX_WORDS) {
      out.push({
        class: 'decoration',
        confidence: 0.6,
        evidence: [
          ...repeatEvidence(f),
          { signal: 'text-size', value: f.maxTextPt ?? 0, weight: 0.2 },
          { signal: 'text-length', value: f.wordCount, weight: 0.1 },
        ],
      });
    }
  }

  // Text a picture slide was rebuilt into carries the rebuild's own title
  // estimate: the largest text on the page, set well over the body. On a picture
  // deck the title sits wherever the design put it (over a photograph, beside
  // cards), so the top band says little there, and this is the evidence.
  if (f.roleTitle === true && !f.titleOnSlide && f.origin === 'raster-region'
    && f.textParagraphs <= 2 && f.textLength <= HEADING_MAX_CHARS) {
    out.push({
      class: 'title',
      confidence: 0.72,
      evidence: [
        { signal: 'text-size', value: f.maxTextPt ?? 0, weight: 0.4 },
        originEvidence(f),
        { signal: 'text-length', value: f.wordCount, weight: 0.1 },
      ],
    });
  }

  // A lone letter at display size is a badge (the "M" of an acronym set in a
  // circle), not a title and not a line of text: it names nothing on its own.
  // Body stays the runner-up, so the review can change it back in one step.
  if (f.rowNumbering === true) {
    // A column of letters or numbers, each beside the row it opens: row numbering,
    // read as a label column. Kept as body, so the layout read sees numbered rows.
    out.push({
      class: 'body',
      confidence: 0.75,
      evidence: [
        { signal: 'column-alignment', value: true, weight: 0.4 },
        { signal: 'text-length', value: f.wordCount, weight: 0.1 },
      ],
    });
  } else if (f.loneLetter === true && (f.maxTextPt ?? 0) >= DISPLAY_LETTER_PT) {
    out.push({
      class: 'decoration',
      confidence: 0.65,
      evidence: [
        { signal: 'text-size', value: f.maxTextPt ?? 0, weight: 0.3 },
        { signal: 'text-length', value: f.wordCount, weight: 0.2 },
      ],
    });
  }

  // A title is text of two or more words: the title placeholder first (the
  // placeholder rule), then the largest such text in the top band, then, when
  // the slide's largest text is a block of body copy, the first short line in
  // the top band. Size is ranked over texts of two or more words only, so a
  // 48 pt letter badge never outranks the heading beside it. The size-rank
  // evidence row still states the rank over every text, so its sentence stays
  // true on a slide where such a badge is larger.
  const single = titleLength(f);
  const titleFree = !f.titleOnSlide;
  if (titleFree && f.wordRank === 0 && f.topBand && single) {
    out.push({
      class: 'title',
      confidence: 0.7,
      evidence: [
        { signal: 'size-rank', value: f.sizeRank ?? 0, weight: 0.4 },
        { signal: 'margin-zone', value: 'top', weight: 0.2 },
        { signal: 'text-length', value: f.wordCount, weight: 0.1 },
      ],
    });
  } else if (titleFree && f.topmostInTopBand === true && f.largestIsBlock === true
    && f.textParagraphs <= 1 && f.textLength <= HEADING_MAX_CHARS) {
    // The MEDDPICC case: a 14 pt heading over 18 pt question lists. The
    // largest text is the list, so size alone would name no title at all.
    out.push({
      class: 'title',
      confidence: 0.62,
      // No size-rank row: the heading is not the largest text, and a sentence
      // that ranked it would count a letter badge the rank here leaves out.
      evidence: [
        { signal: 'margin-zone', value: 'top', weight: 0.3 },
        { signal: 'text-length', value: f.wordCount, weight: 0.1 },
      ],
    });
  } else if (titleFree && f.wordRank === 1 && f.topBand && single) {
    out.push({
      class: 'subtitle',
      confidence: 0.55,
      evidence: [
        { signal: 'size-rank', value: f.sizeRank ?? 1, weight: 0.3 },
        { signal: 'margin-zone', value: 'top', weight: 0.15 },
      ],
    });
  }

  out.push({
    class: 'body',
    confidence: 0.6,
    evidence: [
      { signal: 'text-length', value: f.wordCount, weight: 0.3 },
      ...(f.sizeRank === undefined ? [] : [{ signal: 'size-rank' as const, value: f.sizeRank, weight: 0.1 }]),
    ],
  });
  return out;
}

/**
 * The class hypothesis for one object: the strongest rule that fired, the
 * runner-up when the two are close, and the evidence both were reached by.
 *
 * Confidence orders a review queue. It is not calibrated against labelled decks
 * yet, so it is not a number to show a person.
 */
export function classifyObject(f: ObjectFeaturesV1): ClassHypothesisV1 {
  const all: Candidate[] = [
    ...nativeCandidates(f),
    ...placeholderCandidates(f),
    ...markCandidates(f),
    ...generatorMarkCandidates(f),
    ...pictureCandidates(f),
    ...shapeCandidates(f),
    ...textCandidates(f),
  ];

  if (all.length === 0) {
    // No rule recognised this object, so it stays unknown and is never removed
    // by default. An unreadable appearance is recorded as its fidelity too.
    const evidence: EvidenceV1[] = [{ signal: 'native-tag', value: f.tag ?? f.kind, weight: 0.2 }];
    if (f.unavailable) evidence.push({ signal: 'native-tag', value: 'unavailable', weight: 0.1 });
    return { class: 'unknown', confidence: 0.3, evidence: withSentences(evidence, 'unknown', f.kind) };
  }

  // Strongest first; ties settle alphabetically by class name, so two runs over
  // the same deck agree. That order carries no meaning of its own: the sibling
  // tie-break for a GROUP's class in `deck-census.ts` needs a strict majority
  // and falls back to the exemplar, which is a different rule on purpose.
  const ordered = [...all].sort((a, b) => (b.confidence - a.confidence) || compareCodeUnits(a.class, b.class));
  const best = ordered[0] as Candidate;
  const merged: EvidenceV1[] = withSentences(best.evidence, best.class, f.kind);
  const runnerUp = ordered.find((c) => c.class !== best.class);
  const hypothesis: ClassHypothesisV1 = { class: best.class, confidence: best.confidence, evidence: merged };
  if (runnerUp && best.confidence - runnerUp.confidence <= ALTERNATIVE_GAP) hypothesis.alternative = runnerUp.class;
  return hypothesis;
}
