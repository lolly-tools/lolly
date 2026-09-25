// SPDX-License-Identifier: MPL-2.0
/**
 * Stage 2 of the renovation journey (plan 274 section 3.2): a read source deck
 * in, a `DeckCensusV1` out.
 *
 * The census measures and says what it found. It never proposes an action:
 * `keep`, `replace` and `remove` belong to the plan stage, and a census that
 * decided anything would make the review a rubber stamp. Three facts stay
 * apart for every object: its origin, carried straight from the source model;
 * a class hypothesis with the evidence it was reached by; and nothing else.
 *
 * What it does, in order:
 *
 *   1. Groups objects across slides. A fingerprint family (kind, fill, media
 *      hash, or text with digit runs wildcarded) GENERATES candidates; each
 *      candidate group is then VERIFIED against the family's median box, within
 *      a positional tolerance, and against the exemplar's content. Media and
 *      vector members are compared on the content identity the source states
 *      (the media hash, the drawing's own markup), not on the family key, so a
 *      difference hash collision or a path hash collision is caught here rather
 *      than reported as a repeat. Text members are compared after digit runs
 *      are wildcarded, so a changing year does not split one footer into three;
 *      a text family's content match is therefore implied by its key, and the
 *      placement test is what can still reject a member. Members that fail
 *      verification are listed as unverified and never acted on.
 *   2. Measures each object into an `ObjectFeaturesV1` record and asks
 *      `deck-census-rules.ts` for the class hypothesis.
 *   3. Takes the three deck-wide censuses: colour keyed by USE (this hex as
 *      body ink, as a ground, as series 3 of a chart), fonts per family with
 *      provenance and roles, and per-slide layout features.
 *
 * Pure: no DOM, no clock, no filesystem, no network, no node crypto, no
 * randomness. Ids are sorted, hashes come from `deck-census-hash.ts`, and the
 * same source and options give byte identical JSON on every host.
 */

import type {
  BoxV1,
  ClassHypothesisV1,
  ColorUseV1,
  ContrastPairV1,
  DeckCensusV1,
  FontUseV1,
  LayoutFeaturesV1,
  LayoutUnitV1,
  ObjectClassV1,
  ObjectGroupV1,
  OcrEvidenceV1,
  RasterStatsV1,
  SlideSourceV1,
  SourceColorV1,
  SourceDeckV1,
  SourceObjectV1,
  SourceWarningV1,
} from '@lolly-tools/core';
import { OBJECT_CLASSES } from '@lolly-tools/core';

import { contrastRatio, hexToOklch } from './brand-derive.ts';
import { censusHash, digitNormalise, hammingDistance, pathHash } from './deck-census-hash.ts';
import { vectorChartEvidence, vectorColourUses, vectorFeatures } from './deck-census-vector.ts';
import {
  CENSUS_RULES,
  CONNECTOR_GEOM,
  GENERATOR_MARK_MAX_WORDS,
  GENERATOR_MARK_SHARE,
  KNOWN_LOGO_HAMMING,
  LEGAL_NOTICE,
  MARGIN_BAND_SHARE,
  ROW_MARKER_EDGE,
  ROW_MARKER_GAP,
  ROW_MARKER_MIN,
  classifyObject,
  type ObjectFeaturesV1,
} from './deck-census-rules.ts';
import { compareCodeUnits as compareText } from './rebrand-order.ts';

/** Positional tolerance a repeated object is allowed, as a share of slide width and height. */
export const DEFAULT_JITTER_TOLERANCE = 0.03;

/** A slide covered by one picture at or above this share reads as flattened. */
export const FLATTENED_AREA_SHARE = 0.9;

/** Chroma in OKLCH at or above which a colour use reads as chromatic rather than neutral. */
export const ACCENT_CHROMA_FLOOR = 0.04;

/** Text below this size takes the ordinary contrast minimum; at or above it, the large-text one. */
export const LARGE_TEXT_PT = 18;

/** Share of a text box a filled shape under it must cover to count as the box it sits on. */
export const BACKGROUND_COVER_SHARE = 0.6;

/** A registered mark to compare a picture against, from a design system on this device. */
export interface KnownLogoV1 {
  /** 16 hex characters, as `dhashFromGrey` writes them. */
  dhash?: string;
  /** The exact content hash or asset ref of the registered bytes. */
  contentHash?: string;
  label: string;
}

export interface CensusOptsV1 {
  /** Rules identity recorded on the census. Defaults to this module's own. */
  rules?: { name: string; version: string };
  /** Pixel statistics for a picture, by its asset ref, when a shell decoded one. */
  rasterStats?: (assetRef: string) => RasterStatsV1 | undefined;
  /** Text recognition evidence for a picture, by its asset ref, when a shell ran it. */
  ocr?: (assetRef: string) => OcrEvidenceV1 | undefined;
  /** Registered marks, so a candidate can be raised to a known logo. */
  knownLogos?: KnownLogoV1[];
  /** Positional tolerance for a repeated object, as a share of slide size. */
  jitterTolerance?: number;
  /** Literal series colours for a native chart, by object id, when a reader supplied them. */
  chartSeriesColors?: (objectId: string) => string[] | undefined;
}

// ─── measuring one object ────────────────────────────────────────────────────

/** Text content of an object, paragraphs joined by a newline. */
function textOf(object: SourceObjectV1): string {
  return (object.text?.paras ?? []).map((para) => para.runs.map((run) => run.text).join('')).join('\n');
}

function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((word) => word.length > 0);
}

/** Words written wholly in lower case, which is the prose signal for a repeated line. */
function lowerCaseWords(text: string): number {
  let count = 0;
  for (const word of wordsOf(text)) {
    const letters = word.replace(/[^\p{L}]/gu, '');
    if (letters.length < 2) continue;
    if (letters === letters.toLowerCase()) count += 1;
  }
  return count;
}

function digitsOnly(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && /\d/.test(trimmed) && /^[\d\s./-]+$/.test(trimmed);
}

const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;

function dateLike(text: string): boolean {
  const trimmed = text.trim();
  if (/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(trimmed)) return true;
  return MONTHS.test(trimmed) && /\d{1,4}/.test(trimmed);
}

/** Distinct fill values a vector drawing states, for the diagram rule. */
function vectorFillCount(svg: string | undefined): number {
  if (!svg) return 0;
  const fills = new Set<string>();
  const re = /fill\s*[:=]\s*"?'?\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-zA-Z]+)/g;
  let match = re.exec(svg);
  while (match) {
    const value = (match[1] ?? '').toLowerCase();
    if (value && value !== 'none') fills.add(value);
    match = re.exec(svg);
  }
  return fills.size;
}

interface SlideFrame {
  slide: SlideSourceV1;
  width: number;
  height: number;
}

/** The box as fractions of its slide, which is the space every comparison happens in. */
function fractionBox(box: BoxV1, frame: SlideFrame): { x: number; y: number; w: number; h: number } {
  return { x: box.x / frame.width, y: box.y / frame.height, w: box.w / frame.width, h: box.h / frame.height };
}

// ─── candidate families and their verification ───────────────────────────────

type GroupKindV1 = ObjectGroupV1['kind'];

interface FamilyMember {
  object: SourceObjectV1;
  frame: SlideFrame;
  /**
   * The content identity the source states for this member, when it states one:
   * the media hash of a picture, the drawing's own markup, the line as written.
   * Undefined when the source carries no identity to compare, which is what
   * holds `exactRepeat` back rather than letting the family key stand in for it.
   */
  exact?: string;
  /** The content as the family key saw it, with digit runs wildcarded for text. */
  normalised: string;
}

interface Family {
  key: string;
  kind: GroupKindV1;
  by: 'exact' | 'dhash' | 'path-hash';
  /** Text families match on the wildcarded form, so a changing year keeps one footer whole. */
  digitWildcard: boolean;
  members: FamilyMember[];
}

interface Candidate {
  key: string;
  kind: GroupKindV1;
  by: Family['by'];
  digitWildcard: boolean;
  exact?: string;
  normalised: string;
}

function familyOf(object: SourceObjectV1, stats: RasterStatsV1 | undefined): Candidate | null {
  if (object.kind === 'pic') {
    if (object.media) {
      return { key: `media:${object.media}`, kind: 'media', by: 'exact', digitWildcard: false, exact: object.media, normalised: object.media };
    }
    if (stats?.dhash) {
      // A difference hash only says "worth comparing". The identity it is
      // verified against is the ref the source carries, when it carries one.
      const candidate: Candidate = { key: `dhash:${stats.dhash}`, kind: 'media', by: 'dhash', digitWildcard: false, normalised: `dhash:${stats.dhash}` };
      const ref = object.fidelity.fallbackAssetRef;
      if (ref) candidate.exact = ref;
      return candidate;
    }
    return null;
  }
  if (object.kind === 'vector' && object.vector) {
    const hash = pathHash(object.vector);
    // No geometry read means no family: a drawing with nothing to hash must not
    // join every other path-free drawing under one empty key.
    if (hash === null) return null;
    return { key: `path:${hash}`, kind: 'vector', by: 'path-hash', digitWildcard: false, exact: object.vector, normalised: `path:${hash}` };
  }
  const text = textOf(object);
  if (text.trim().length > 0) {
    const normalised = digitNormalise(text);
    return { key: `text:${object.kind}:${normalised}`, kind: 'text', by: 'exact', digitWildcard: true, exact: text.trim(), normalised };
  }
  if (object.kind === 'shape') {
    const fill = object.fill?.hex ?? object.fill?.scheme ?? 'none';
    const line = object.line?.color?.hex ?? object.line?.color?.scheme ?? 'none';
    const key = `shape:${object.geom ?? 'rect'}:${fill}:${line}`;
    return { key, kind: 'shape', by: 'exact', digitWildcard: false, exact: key, normalised: key };
  }
  return null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

interface VerifiedGroup {
  group: ObjectGroupV1;
  by: Family['by'];
  /** Slide fraction offset of the widest verified member from the reference box. */
  jitter: number;
  exactRepeat: boolean;
  digitRepeatOnly: boolean;
}

/**
 * Verify one candidate family into a group: the reference is the family's
 * MEDIAN box, not its first member, so a band that drifts a little from slide
 * to slide holds together while one that jumps does not.
 *
 * A member passes on placement AND content. Content is the identity the source
 * states, so two pictures that collide under a difference hash, or two drawings
 * that collide under a path hash, are separated here. A text family matches on
 * the wildcarded form instead, which its key already carries, so placement is
 * what can still reject a text member.
 *
 * Stated rather than hidden: a family that keeps fewer than two verified
 * members on fewer than two slides reports NOTHING, so the rejected candidates
 * of a two-member family are not listed anywhere. `ObjectGroupV1` has no room
 * for a group with no members, and inventing a one-member group would put a
 * group action in front of a person over a single object.
 */
function verifyFamily(family: Family, tolerance: number): VerifiedGroup | null {
  const boxes = family.members.map((member) => fractionBox(member.object.box, member.frame));
  const reference = {
    x: median(boxes.map((b) => b.x)),
    y: median(boxes.map((b) => b.y)),
    w: median(boxes.map((b) => b.w)),
    h: median(boxes.map((b) => b.h)),
  };
  // The exemplar's content is the one every verified member must match exactly.
  let anchorIndex = 0;
  let anchorDistance = Number.POSITIVE_INFINITY;
  boxes.forEach((box, i) => {
    const distance = Math.abs(box.x - reference.x) + Math.abs(box.y - reference.y);
    const member = family.members[i];
    const best = family.members[anchorIndex];
    if (distance < anchorDistance || (distance === anchorDistance && member && best && member.object.id < best.object.id)) {
      anchorDistance = distance;
      anchorIndex = i;
    }
  });
  const anchor = family.members[anchorIndex];
  if (!anchor) return null;

  const verified: FamilyMember[] = [];
  const unverified: FamilyMember[] = [];
  let jitter = 0;
  family.members.forEach((member, i) => {
    const box = boxes[i];
    if (!box) return;
    const dx = Math.abs(box.x - reference.x);
    const dy = Math.abs(box.y - reference.y);
    const dw = Math.abs(box.w - reference.w);
    const dh = Math.abs(box.h - reference.h);
    const placed = dx <= tolerance && dy <= tolerance && dw <= tolerance && dh <= tolerance;
    const sameContent = family.digitWildcard
      ? member.normalised === anchor.normalised
      : member.exact !== undefined && anchor.exact !== undefined
        ? member.exact === anchor.exact
        : member.normalised === anchor.normalised;
    if (placed && sameContent) {
      verified.push(member);
      jitter = Math.max(jitter, dx, dy);
    } else {
      unverified.push(member);
    }
  });

  const slideIds = [...new Set(verified.map((member) => member.frame.slide.id))].sort(compareText);
  if (verified.length < 2 || slideIds.length < 2) return null;

  const members = verified.map((member) => member.object.id).sort(compareText);
  const group: ObjectGroupV1 = {
    id: `group:${censusHash(family.key)}`,
    kind: family.kind,
    members,
    slideIds,
    exemplar: anchor.object.id,
    class: 'unknown',
  };
  if (unverified.length > 0) group.unverified = unverified.map((member) => member.object.id).sort(compareText);
  // Byte identity is claimed only from the identities the source states. When a
  // member carries none, the group repeats but nothing here says it is identical.
  const exactValues = verified.map((member) => member.exact);
  const contentKnown = exactValues.every((value) => value !== undefined);
  const distinct = new Set(exactValues).size;
  return {
    group,
    by: family.by,
    jitter,
    exactRepeat: contentKnown && distinct === 1,
    digitRepeatOnly: contentKnown && distinct > 1,
  };
}

/**
 * Split a family by the box of its members before placement is verified.
 *
 * A family key says what an object is made of (a fill, a media hash), not where
 * it is or how big it is, so one fill can hold several different objects:
 * template-example paints its chameleon mark, a colour bar and the parts of a
 * dozen icons in the same blue. Verified against one median box, the mark lost
 * to the icon parts and reached the review as one item per slide. Members are
 * partitioned by position and size, each within twice the placement tolerance
 * of the partition's first member, so a band that drifts stays in its
 * partition, and each partition is verified on its own.
 *
 * The partition with the most members keeps the family key, and so the group
 * id the family always had; the others take the key with their rank after it.
 * Partitions are formed in member order (slide order, then paint order) and
 * ranked by size, then by their first member's id, so two runs agree.
 */
function boxPartitions(family: Family, tolerance: number): Family[] {
  const limit = tolerance * 2;
  const parts: Array<{ seed: { x: number; y: number; w: number; h: number }; members: FamilyMember[] }> = [];
  for (const member of family.members) {
    const box = fractionBox(member.object.box, member.frame);
    const part = parts.find(({ seed }) => Math.abs(seed.x - box.x) <= limit && Math.abs(seed.y - box.y) <= limit
      && Math.abs(seed.w - box.w) <= limit && Math.abs(seed.h - box.h) <= limit);
    if (part) part.members.push(member);
    else parts.push({ seed: box, members: [member] });
  }
  if (parts.length === 1) return [family];
  parts.sort((a, b) => (b.members.length - a.members.length)
    || compareText(a.members[0]?.object.id ?? '', b.members[0]?.object.id ?? ''));
  return parts.map((part, rank) => ({ ...family, key: rank === 0 ? family.key : `${family.key}|${rank}`, members: part.members }));
}

// ─── the colour census, keyed by use ─────────────────────────────────────────

type Channel = 'fill' | 'stroke' | 'text' | 'series';

interface UseAccumulator {
  useId: string;
  hex: string;
  scheme?: string;
  channel: Channel;
  weight: number;
  objectIds: string[];
  slideId: string;
  distinctionSet?: string;
}

function normaliseHex(hex: string): string {
  const raw = hex.trim();
  const body = raw.startsWith('#') ? raw.slice(1) : raw;
  if (body.length === 3) {
    const [r, g, b] = [body[0] ?? '0', body[1] ?? '0', body[2] ?? '0'];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return `#${body.slice(0, 6).toUpperCase()}`;
}

function chromaOf(hex: string): number {
  const oklch = hexToOklch(hex);
  return oklch ? oklch.c : 0;
}

/** Text weight: run length times its size, which is the ink a reader sees. */
function textWeight(object: SourceObjectV1, hex: string, theme: SourceDeckV1['theme']): number {
  let weight = 0;
  for (const para of object.text?.paras ?? []) {
    for (const run of para.runs) {
      if (resolveColor(run.color, theme) !== hex) continue;
      weight += run.text.length * (run.sizePt ?? 12);
    }
  }
  return weight;
}

// ─── the census ──────────────────────────────────────────────────────────────

/**
 * Take the census of a read source deck.
 *
 * Every optional input is an input a shell may not have: a terminal with no
 * decoder passes no `rasterStats`, a host with no text recognition passes no
 * `ocr`, and the rules read those absences as absences rather than as evidence.
 */
export function censusDeck(source: SourceDeckV1, opts: CensusOptsV1 = {}): DeckCensusV1 {
  const tolerance = opts.jitterTolerance ?? DEFAULT_JITTER_TOLERANCE;
  const frames: SlideFrame[] = source.slides.map((slide) => ({
    slide,
    width: slide.width > 0 ? slide.width : 1280,
    height: slide.height > 0 ? slide.height : 720,
  }));

  const statsOf = (object: SourceObjectV1): RasterStatsV1 | undefined => {
    if (object.raster) return object.raster;
    const ref = object.media ?? object.fidelity.fallbackAssetRef;
    return ref && opts.rasterStats ? opts.rasterStats(ref) : undefined;
  };
  const ocrOf = (object: SourceObjectV1): OcrEvidenceV1 | undefined => {
    if (object.ocr) return object.ocr;
    const ref = object.media ?? object.fidelity.fallbackAssetRef;
    return ref && opts.ocr ? opts.ocr(ref) : undefined;
  };

  // 1. Candidate families, then verification.
  const families = new Map<string, Family>();
  for (const frame of frames) {
    for (const object of frame.slide.objects) {
      const candidate = familyOf(object, statsOf(object));
      if (!candidate) continue;
      const family = families.get(candidate.key)
        ?? { key: candidate.key, kind: candidate.kind, by: candidate.by, digitWildcard: candidate.digitWildcard, members: [] };
      const member: FamilyMember = { object, frame, normalised: candidate.normalised };
      if (candidate.exact !== undefined) member.exact = candidate.exact;
      family.members.push(member);
      families.set(candidate.key, family);
    }
  }

  const groups: ObjectGroupV1[] = [];
  const groupOf = new Map<string, VerifiedGroup>();
  // The id is a hash of the family key, so it survives a second census of the
  // same deck. Two family keys can still hash alike, and two groups sharing one
  // id would let a plan decision resolve to whichever row it found first, so a
  // collision takes a suffix instead. Families are read in sorted key order, so
  // which one takes the suffix is the same on every run.
  const takenIds = new Set<string>();
  for (const key of [...families.keys()].sort(compareText)) {
    const family = families.get(key);
    if (!family || family.members.length < 2) continue;
    const made: VerifiedGroup[] = [];
    const leftover: FamilyMember[] = [];
    for (const part of boxPartitions(family, tolerance)) {
      const verified = part.members.length >= 2 ? verifyFamily(part, tolerance) : null;
      if (!verified) {
        leftover.push(...part.members);
        continue;
      }
      if (takenIds.has(verified.group.id)) {
        let n = 2;
        while (takenIds.has(`${verified.group.id}:${n}`)) n += 1;
        verified.group.id = `${verified.group.id}:${n}`;
      }
      takenIds.add(verified.group.id);
      groups.push(verified.group);
      made.push(verified);
      for (const id of verified.group.members) groupOf.set(id, verified);
    }
    // The same object at another place (the same size, no partition of its
    // own) is still a candidate of the family's first group: listed there,
    // never acted on. A different object that only shares the fill is not.
    const first = made[0];
    const exemplar = first ? family.members.find((member) => member.object.id === first.group.exemplar) : undefined;
    if (first && exemplar) {
      const size = fractionBox(exemplar.object.box, exemplar.frame);
      const same = leftover.filter((member) => {
        const box = fractionBox(member.object.box, member.frame);
        return Math.abs(box.w - size.w) <= tolerance && Math.abs(box.h - size.h) <= tolerance;
      }).map((member) => member.object.id);
      if (same.length > 0) first.group.unverified = [...(first.group.unverified ?? []), ...same].sort(compareText);
    }
  }
  groups.sort((a, b) => compareText(a.id, b.id));

  // 1b. Objects rebuilt from slide pictures that sit in a corner, and the share of
  // the picture slides showing one at the same place: a generator's mark.
  const cornerShare = cornerRepeatShares(frames, tolerance);

  // 2. Per-object features and the class hypothesis.
  const knownLogos = opts.knownLogos ?? [];
  const objects: DeckCensusV1['objects'] = [];
  const classOf = new Map<string, ObjectClassV1>();
  const layouts: LayoutFeaturesV1[] = [];
  const uses = new Map<string, UseAccumulator>();
  const contrastPairs: ContrastPairV1[] = [];
  const flattenedSlideIds: string[] = [];
  const fontRoles = new Map<string, Partial<Record<'title' | 'subtitle' | 'body' | 'other', number>>>();
  const warnings: SourceWarningV1[] = [...source.warnings];

  for (const frame of frames) {
    const { slide } = frame;
    warnings.push(...slide.warnings);
    const slideArea = frame.width * frame.height;

    // Size ranks over the slide's text objects, densely, so equal sizes rank alike.
    const sizes = [...new Set(slide.objects
      .filter((object) => textOf(object).trim().length > 0)
      .map((object) => maxRunPt(object) ?? 0))].sort((a, b) => b - a);
    const context = slideContext(frame);

    const hypotheses = new Map<string, ClassHypothesisV1>();
    for (const object of slide.objects) {
      const text = textOf(object);
      const stats = statsOf(object);
      const ocr = ocrOf(object);
      const verified = groupOf.get(object.id);
      const known = matchKnownLogo(object, stats, knownLogos);
      const box = object.box;
      const centreX = box.x + box.w / 2;
      const centreY = box.y + box.h / 2;
      const inX = centreX < MARGIN_BAND_SHARE * frame.width || centreX > (1 - MARGIN_BAND_SHARE) * frame.width;
      const topBand = centreY < MARGIN_BAND_SHARE * frame.height;
      const bottomBand = centreY > (1 - MARGIN_BAND_SHARE) * frame.height;
      const maxPt = maxRunPt(object);
      const slideCount = frames.length || 1;

      const features: ObjectFeaturesV1 = {
        objectId: object.id,
        slideId: slide.id,
        kind: object.kind,
        origin: object.origin,
        areaShare: slideArea > 0 ? (box.w * box.h) / slideArea : 0,
        aspect: box.h > 0 ? box.w / box.h : 0,
        marginZone: inX || topBand || bottomBand,
        topBand,
        bottomBand,
        longSideShare: Math.max(box.w / frame.width, box.h / frame.height),
        hasFill: object.fill !== undefined,
        fillCount: object.kind === 'vector' ? vectorFillCount(object.vector) : object.fill ? 1 : 0,
        hasText: text.trim().length > 0,
        textLength: text.trim().length,
        wordCount: wordsOf(text).length,
        lowerCaseWords: lowerCaseWords(text),
        digitsOnly: digitsOnly(text),
        dateLike: dateLike(text),
        textParagraphs: object.text?.paras.length ?? 0,
        repeatCount: verified ? verified.group.slideIds.length : 0,
        repeatShare: verified ? verified.group.slideIds.length / slideCount : 0,
        positionJitter: verified ? verified.jitter : 0,
        exactRepeat: verified ? verified.exactRepeat : false,
        digitRepeatOnly: verified ? verified.digitRepeatOnly : false,
        hasChartData: object.chartData !== undefined,
        seriesCount: object.chartData?.series?.length ?? 0,
        hasTable: object.table !== undefined,
        unavailable: object.fidelity.state === 'unavailable',
      };
      if (object.placeholder) features.placeholder = object.placeholder;
      if (maxPt !== undefined) features.maxTextPt = maxPt;
      if (features.hasText) features.sizeRank = Math.max(0, sizes.indexOf(maxPt ?? 0));
      Object.assign(features, context.featuresFor(object, text));
      // A drawing carried as items states its own fills, text and series (plan 275 decision 32).
      Object.assign(features, vectorFeatures(object) ?? {});
      if (verified) {
        features.groupId = verified.group.id;
        features.groupBy = verified.by;
      }
      if (object.tag) features.tag = object.tag;
      const drawnChart = vectorChartEvidence(object);
      if (drawnChart) features.vectorChart = { confidence: drawnChart.confidence, evidence: drawnChart.evidence };
      const corner = cornerShare.get(object.id);
      if (corner !== undefined) features.cornerRepeatShare = corner;
      if (features.hasText && /\p{N}/u.test(text)) features.hasDigit = true;
      if (features.hasText && LEGAL_NOTICE.test(text)) features.legalNotice = true;
      if (corner !== undefined && corner > GENERATOR_MARK_SHARE && object.kind === 'pic' && markWordBeside(object, slide, cornerShare)) {
        features.markWordBeside = true;
      }
      if (ocr) {
        features.ocrState = ocr.state;
        if (ocr.textDensity !== undefined) features.ocrDensity = ocr.textDensity;
        if (ocr.state === 'text-found' && ocr.lines?.length) features.ocrWords = wordsOf(ocr.lines.map((l) => l.text).join(' ')).length;
      }
      if (stats?.axisAlignedEdgeShare !== undefined) features.axisAlignedEdgeShare = stats.axisAlignedEdgeShare;
      if (stats?.distinctColors !== undefined) features.distinctColors = stats.distinctColors;
      if (known) {
        features.knownLogoLabel = known.label;
        if (known.distance !== undefined) features.knownLogoDistance = known.distance;
      }

      const hypothesis = classifyObject(features);
      hypotheses.set(object.id, hypothesis);
      classOf.set(object.id, hypothesis.class);
      const row: DeckCensusV1['objects'][number] = {
        id: object.id,
        slideId: slide.id,
        origin: object.origin,
        hypothesis,
      };
      if (verified) row.groupId = verified.group.id;
      objects.push(row);
    }

    // 3a. Colour uses on this slide.
    collectSlideColors(frame, uses, opts, source.theme);

    // 3b. Font roles from the runs on this slide.
    for (const object of slide.objects) {
      const klass = hypotheses.get(object.id)?.class;
      const role = klass === 'title' ? 'title' : klass === 'subtitle' ? 'subtitle' : klass === 'body' ? 'body' : 'other';
      for (const para of object.text?.paras ?? []) {
        for (const run of para.runs) {
          if (!run.font) continue;
          const family = resolveFamily(run.font, source.theme);
          const provenance = run.fontProvenance ?? (run.font.startsWith('+') ? 'theme' : 'literal');
          const key = `${provenance}:${family}`;
          const roles = fontRoles.get(key) ?? {};
          roles[role] = (roles[role] ?? 0) + 1;
          fontRoles.set(key, roles);
        }
      }
    }

    // 3c. Layout features.
    layouts.push(layoutFeatures(frame, hypotheses));

    const covered = slide.objects.some(
      (object) => object.kind === 'pic' && slideArea > 0 && (object.box.w * object.box.h) / slideArea >= FLATTENED_AREA_SHARE,
    );
    if (slide.origin.flattened === true || covered) flattenedSlideIds.push(slide.id);
  }

  // The group's class is the class its members were given, so a group action in
  // the review speaks about what the group was found to be. A class needs a
  // strict majority to take the group; on a tie the exemplar's own class wins,
  // and when even that is not among the tied classes the group stays unknown
  // rather than taking whichever class the contract happens to list first.
  for (const group of groups) {
    const counts = new Map<ObjectClassV1, number>();
    for (const id of group.members) {
      const klass = classOf.get(id);
      if (!klass) continue;
      counts.set(klass, (counts.get(klass) ?? 0) + 1);
    }
    let bestCount = 0;
    for (const klass of OBJECT_CLASSES) bestCount = Math.max(bestCount, counts.get(klass) ?? 0);
    const tied = OBJECT_CLASSES.filter((klass) => (counts.get(klass) ?? 0) === bestCount && bestCount > 0);
    const exemplarClass = classOf.get(group.exemplar);
    if (tied.length === 1) group.class = tied[0] as ObjectClassV1;
    else if (tied.length > 1 && exemplarClass && tied.includes(exemplarClass)) group.class = exemplarClass;
    else group.class = 'unknown';
  }

  // One logo is one group (close-out F5): a mark drawn as an SVG and as freeform parts
  // at one place, as two parts in two colours, or as a symbol beside its wordmark, is
  // one mark. Groups of a mark class that sit together on most of the slides they share
  // become one group, and an ungrouped drawing part at the same place as a member on its
  // slide joins it, so the review asks once about the mark and every count reads one
  // set.
  mergeCoLocatedMarks(groups, objects, frames);

  // Colour roles, once every use on every slide is in.
  const colorUses = assignRoles([...uses.values()], frames);
  for (const pair of contrastPairsFor(frames, uses)) contrastPairs.push(pair);

  const fonts: FontUseV1[] = source.fonts.map((font) => {
    const use: FontUseV1 = {
      family: font.family,
      provenance: font.provenance,
      runs: font.runs,
      roles: fontRoles.get(`${font.provenance}:${font.family}`) ?? {},
    };
    if (font.available !== undefined) use.available = font.available;
    return use;
  }).sort((a, b) => (b.runs - a.runs) || compareText(a.family, b.family) || compareText(a.provenance, b.provenance));

  return {
    version: 1,
    sourceHash: source.source.hash,
    rules: opts.rules ?? { name: CENSUS_RULES.name, version: CENSUS_RULES.version },
    objects,
    groups,
    colors: { uses: colorUses, contrastPairs },
    fonts,
    layouts,
    flattenedSlideIds: [...new Set(flattenedSlideIds)].sort(compareText),
    warnings,
  };
}

/** Classes of a mark: groups of these at one place are one mark. */
const MARK_GROUP_CLASSES: ReadonlySet<ObjectClassV1> = new Set<ObjectClassV1>([
  'logo-candidate',
  'known-logo',
]);

/** Classes an ungrouped part may carry and still join the mark it sits on: a part the census could not name alone. */
const MARK_PART_CLASSES: ReadonlySet<ObjectClassV1> = new Set<ObjectClassV1>([
  'logo-candidate',
  'known-logo',
  'diagram',
  'decoration',
  'unknown',
]);

/** Two mark groups are one when they sit at one place on at least this share of the slides the smaller one is on. */
export const MARK_MERGE_SHARE = 0.8;

/** Two marks are one shape when their widths over heights are within this share of each other. */
export const MARK_ASPECT_SAME = 0.05;

/**
 * Two boxes of one lockup: level with each other (sharing at least half the shorter
 * one's height) and no further apart across than the taller one is high, as a
 * symbol beside its wordmark stands.
 */
function sideBySide(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  const shared = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (shared < 0.5 * Math.min(a.h, b.h)) return false;
  const gap = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
  return gap <= Math.max(a.h, b.h);
}

/**
 * Merge the groups of a mark class whose members sit at the same place (`samePlace`),
 * or side by side as a symbol and its wordmark do (`sideBySide`), or that are the
 * template's copy of the slides' own mark (`inheritedCopy`, on as many slides),
 * on at least `MARK_MERGE_SHARE` of the slides the smaller group is on, largest group
 * first, and add to each merged group the ungrouped parts (a shape, a drawing or a
 * picture) at the same place as one of its members on that member's slide. The group
 * that stays keeps its id and exemplar; every member takes its class, so the plan
 * scopes the whole mark as one action. Rows and groups change in place.
 */
function mergeCoLocatedMarks(
  groups: ObjectGroupV1[],
  rows: DeckCensusV1['objects'],
  frames: SlideFrame[]
): void {
  const boxOf = new Map<string, { x: number; y: number; w: number; h: number }>();
  const kindOf = new Map<string, SourceObjectV1['kind']>();
  for (const frame of frames) {
    for (const object of frame.slide.objects) {
      boxOf.set(object.id, object.box);
      kindOf.set(object.id, object.kind);
    }
  }
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const marks = groups
    .filter((group) => MARK_GROUP_CLASSES.has(group.class))
    .sort((a, b) => b.members.length - a.members.length || compareText(a.id, b.id));
  if (marks.length === 0) return;
  /** Members of a group on each slide. */
  const bySlide = (group: ObjectGroupV1): Map<string, string[]> => {
    const out = new Map<string, string[]>();
    for (const id of group.members) {
      const slideId = rowById.get(id)?.slideId;
      if (slideId === undefined) continue;
      out.set(slideId, [...(out.get(slideId) ?? []), id]);
    }
    return out;
  };
  const together = (a: readonly string[], b: readonly string[], lockup: boolean): boolean =>
    a.some((one) => {
      const box = boxOf.get(one);
      return (
        box !== undefined &&
        b.some((other) => {
          const near = boxOf.get(other);
          return near !== undefined && (samePlace(box, near) || (lockup && sideBySide(box, near)));
        })
      );
    });
  /** Every member of a group came from the slide master or a layout. */
  const inherited = (group: ObjectGroupV1): boolean =>
    group.members.every((id) => {
      const origin = rowById.get(id)?.origin;
      return origin === 'master' || origin === 'layout';
    });
  const aspectOf = (group: ObjectGroupV1): number => {
    const box = boxOf.get(group.exemplar);
    return box && box.h > 0 ? box.w / box.h : 0;
  };
  /**
   * The template's copy of the slide's own mark: one group inherited from the master
   * or a layout, the other drawn on the slides, both of one shape (their aspects within
   * `MARK_ASPECT_SAME` of each other). A layout that draws the mark where the slides
   * cover it, and the slides that draw it again, show one mark.
   */
  const inheritedCopy = (a: ObjectGroupV1, b: ObjectGroupV1): boolean => {
    if (inherited(a) === inherited(b)) return false;
    const x = aspectOf(a);
    const y = aspectOf(b);
    return x > 0 && y > 0 && Math.abs(x - y) <= MARK_ASPECT_SAME * Math.max(x, y);
  };
  const gone = new Set<ObjectGroupV1>();
  const adopt = (keeper: ObjectGroupV1, ids: readonly string[]): void => {
    const members = new Set(keeper.members);
    for (const id of ids) {
      members.add(id);
      const row = rowById.get(id);
      if (!row) continue;
      row.groupId = keeper.id;
      if (row.hypothesis.class !== keeper.class) {
        row.hypothesis = {
          ...row.hypothesis,
          class: keeper.class,
          alternative: row.hypothesis.class,
        };
      }
    }
    keeper.members = [...members].sort(compareText);
    const slides = new Set(keeper.slideIds);
    for (const id of ids) {
      const slideId = rowById.get(id)?.slideId;
      if (slideId !== undefined) slides.add(slideId);
    }
    keeper.slideIds = [...slides].sort(compareText);
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const keeper of marks) {
      if (gone.has(keeper)) continue;
      for (const other of marks) {
        if (other === keeper || gone.has(other)) continue;
        const mine = bySlide(keeper);
        const theirs = bySlide(other);
        let shared = 0;
        for (const [slideId, ids] of theirs) {
          const held = mine.get(slideId);
          if (held && together(held, ids, true)) shared += 1;
        }
        const enough = (n: number): boolean =>
          n >= 2 && n >= MARK_MERGE_SHARE * Math.min(mine.size, theirs.size);
        if (
          !enough(shared) &&
          !(
            enough([...theirs.keys()].filter((id) => mine.has(id)).length) &&
            inheritedCopy(keeper, other)
          )
        )
          continue;
        // The mark a person sees on the slides is the group's picture, never the template's hidden copy.
        if (inherited(keeper) && !inherited(other)) keeper.exemplar = other.exemplar;
        adopt(keeper, other.members);
        if (other.unverified?.length)
          keeper.unverified = [
            ...new Set([...(keeper.unverified ?? []), ...other.unverified]),
          ].sort(compareText);
        gone.add(other);
        changed = true;
      }
      const mine = bySlide(keeper);
      const parts = rows.filter(
        (row) =>
          row.groupId === undefined &&
          MARK_PART_CLASSES.has(row.hypothesis.class) &&
          ['shape', 'vector', 'pic'].includes(kindOf.get(row.id) ?? '') &&
          together([row.id], mine.get(row.slideId) ?? [], false)
      );
      if (parts.length > 0) {
        adopt(
          keeper,
          parts.map((row) => row.id)
        );
        changed = true;
      }
    }
  }
  if (gone.size === 0) return;
  for (let i = groups.length - 1; i >= 0; i -= 1)
    if (gone.has(groups[i] as ObjectGroupV1)) groups.splice(i, 1);
}

/**
 * Two boxes at one place, whatever their exact edges: sharing at least half the
 * smaller one's area, and neither more than twice the other's. A stamp read as
 * its name on one slide and as its symbol and name on the next is one place.
 */
function samePlace(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  const areaA = a.w * a.h;
  const areaB = b.w * b.h;
  if (w <= 0 || h <= 0 || areaA <= 0 || areaB <= 0) return false;
  return w * h >= 0.5 * Math.min(areaA, areaB) && Math.max(areaA, areaB) <= 2 * Math.min(areaA, areaB);
}

/**
 * For every object a picture slide was rebuilt into (`raster-region`) whose box
 * reaches into a slide corner (the outer `MARGIN_BAND_SHARE` both across and
 * down): the share of the deck's picture slides that show such an object in the
 * same corner with its box within `tolerance` of this one's, as slide
 * fractions, or at the same place (`samePlace`). Quadratic in the corner
 * objects, which are a few per slide.
 */
function cornerRepeatShares(frames: SlideFrame[], tolerance: number): Map<string, number> {
  const out = new Map<string, number>();
  const pictureSlides = frames.filter((frame) => frame.slide.origin.flattened === true);
  if (pictureSlides.length < 2) return out;
  const marks: Array<{ id: string; slideId: string; corner: string; box: { x: number; y: number; w: number; h: number } }> = [];
  for (const frame of pictureSlides) {
    for (const object of frame.slide.objects) {
      if (object.origin !== 'raster-region') continue;
      // Reaching into the corner is enough: a stamp's icon lies just inside the
      // band its words run to the edge in.
      const box = fractionBox(object.box, frame);
      const across = box.x + box.w > 1 - MARGIN_BAND_SHARE ? 'right' : box.x < MARGIN_BAND_SHARE ? 'left' : '';
      const down = box.y + box.h > 1 - MARGIN_BAND_SHARE ? 'bottom' : box.y < MARGIN_BAND_SHARE ? 'top' : '';
      if (across && down) marks.push({ id: object.id, slideId: frame.slide.id, corner: `${down}-${across}`, box });
    }
  }
  for (const mark of marks) {
    const slides = new Set<string>();
    for (const other of marks) {
      if (other.corner !== mark.corner) continue;
      const near = Math.abs(other.box.x - mark.box.x) <= tolerance && Math.abs(other.box.y - mark.box.y) <= tolerance
        && Math.abs(other.box.w - mark.box.w) <= tolerance && Math.abs(other.box.h - mark.box.h) <= tolerance;
      if (!near && !samePlace(other.box, mark.box)) continue;
      slides.add(other.slideId);
    }
    out.set(mark.id, slides.size / pictureSlides.length);
  }
  return out;
}

/**
 * A short text at a repeated corner place standing beside a picture on its
 * slide: level with it (their spans down overlap) and starting or ending within
 * three of the picture's heights of it across. A stamp is drawn as an icon and a
 * name side by side.
 */
function markWordBeside(pic: SourceObjectV1, slide: SlideSourceV1, cornerShare: Map<string, number>): boolean {
  const reach = 3 * Math.max(1, pic.box.h);
  return slide.objects.some((other) => {
    if (other.kind !== 'text' || other === pic) return false;
    if ((cornerShare.get(other.id) ?? 0) <= GENERATOR_MARK_SHARE) return false;
    const words = wordsOf(textOf(other)).length;
    if (words === 0 || words > GENERATOR_MARK_MAX_WORDS) return false;
    const a = pic.box;
    const b = other.box;
    const down = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    const gap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
    return down > 0 && gap <= reach;
  });
}

/** Text of two or more words: the only text a title can be, since a lone letter or figure names nothing. */
function multiWord(text: string): boolean {
  return wordsOf(text).length >= 2;
}

/** One letter and nothing else, the badge of an acronym ("M" of MEDDPICC) rather than a line of text. */
function loneLetter(text: string): boolean {
  return /^\p{L}$/u.test(text.trim());
}

/** A row marker: one or two characters, a letter of an acronym or a row number ("M", "1", "2.", "IV" is too long). */
function rowMarker(text: string): boolean {
  const bare = text.trim().replace(/[.):]$/, '');
  return bare.length >= 1 && bare.length <= 2 && /^[\p{L}\p{N}]+$/u.test(bare);
}

/**
 * The markers on a slide that number its rows (plan 275 section 3.2, the MEDDPICC
 * case): at least `ROW_MARKER_MIN` one- or two-character texts in one column (left
 * edges within `ROW_MARKER_EDGE` of the width), each level with a text of two or more
 * words that starts within `ROW_MARKER_GAP` of the width to its right. A lone letter
 * beside a heading is not in a column of three, so it stays what the rules call it.
 */
function rowNumberingIds(frame: SlideFrame, texts: Array<{ object: SourceObjectV1; text: string }>): Set<string> {
  const out = new Set<string>();
  const box = (object: SourceObjectV1) => fractionBox(object.box, frame);
  const markers = texts.filter((entry) => rowMarker(entry.text));
  const lines = texts.filter((entry) => multiWord(entry.text));
  const paired = markers.filter((marker) => {
    const m = box(marker.object);
    return lines.some((line) => {
      const l = box(line.object);
      const gap = l.x - (m.x + m.w);
      if (gap < -0.01 || gap > ROW_MARKER_GAP) return false;
      const overlap = Math.min(m.y + m.h, l.y + l.h) - Math.max(m.y, l.y);
      const level = overlap >= 0.5 * Math.min(m.h, l.h) || Math.abs((m.y + m.h / 2) - (l.y + l.h / 2)) <= 0.06;
      return level && l.w > m.w;
    });
  });
  for (const seed of paired) {
    const x = box(seed.object).x;
    const column = paired.filter((other) => Math.abs(box(other.object).x - x) <= ROW_MARKER_EDGE);
    if (column.length >= ROW_MARKER_MIN) for (const member of column) out.add(member.object.id);
  }
  return out;
}

/** The group a drawn part belongs to: its innermost ancestor, keyed by the whole path. */
function groupKeyOf(object: SourceObjectV1): string | undefined {
  return object.groupPath && object.groupPath.length > 0 ? object.groupPath.join('/') : undefined;
}

/**
 * What the rules need to know about an object's neighbours on its own slide, read
 * once per slide: whether a title placeholder already names the slide, where the
 * multi-word texts rank by size, and the drawing an object is part of.
 */
function slideContext(frame: SlideFrame): { featuresFor: (object: SourceObjectV1, text: string) => Partial<ObjectFeaturesV1> } {
  const { slide } = frame;
  const texts = slide.objects
    .map((object) => ({ object, text: textOf(object).trim(), pt: maxRunPt(object) ?? 0 }))
    .filter((entry) => entry.text.length > 0);
  const titleOnSlide = new Set(texts
    .filter((entry) => entry.object.placeholder === 'title' || entry.object.placeholder === 'ctrTitle')
    .map((entry) => entry.object.id));
  const worded = texts.filter((entry) => multiWord(entry.text));
  const wordSizes = [...new Set(worded.map((entry) => entry.pt))].sort((a, b) => b - a);
  const topLimit = MARGIN_BAND_SHARE * frame.height;
  const inTop = worded
    .filter((entry) => entry.object.box.y + entry.object.box.h / 2 < topLimit)
    .sort((a, b) => (a.object.box.y - b.object.box.y) || compareText(a.object.id, b.object.id));
  const topmost = inTop[0]?.object.id;
  const largestPt = wordSizes[0];
  const largest = worded.filter((entry) => entry.pt === largestPt);
  const block = (entry: { object: SourceObjectV1; text: string }): boolean =>
    (entry.object.text?.paras.length ?? 0) > 2 || entry.text.length > 120;
  const largestIsBlock = largest.length > 0 && largest.every(block);
  // The rebuild's title estimate on a picture slide: of the texts it estimated
  // as title, the largest, then the highest.
  const estimated = texts
    .filter((entry) => entry.object.origin === 'raster-region' && entry.object.roleEstimate === 'title')
    .sort((a, b) => (b.pt - a.pt) || (a.object.box.y - b.object.box.y) || compareText(a.object.id, b.object.id));
  const roleTitle = estimated[0]?.object.id;
  const numbering = rowNumberingIds(frame, texts);
  // Shapes a picture slide's rebuild names as the container of text on it.
  const holders = new Set<string>();
  for (const entry of texts) for (const id of entry.object.groupPath ?? []) holders.add(id);

  const members = new Map<string, SourceObjectV1[]>();
  for (const object of slide.objects) {
    const key = groupKeyOf(object);
    if (!key) continue;
    const list = members.get(key) ?? [];
    list.push(object);
    members.set(key, list);
  }
  const fillKey = (object: SourceObjectV1): string | undefined => object.fill?.hex?.toUpperCase() ?? object.fill?.scheme;

  return {
    featuresFor(object: SourceObjectV1, text: string): Partial<ObjectFeaturesV1> {
      const out: Partial<ObjectFeaturesV1> = {};
      if (object.kind === 'shape' && object.geom === undefined) out.customGeometry = true;
      if (object.kind === 'shape' && object.geom !== undefined && CONNECTOR_GEOM.test(object.geom)) out.connector = object.geom;
      if (object.kind === 'shape' && object.origin === 'raster-region' && holders.has(object.id)) out.holdsText = true;
      if (object.id === roleTitle) out.roleTitle = true;
      const trimmed = text.trim();
      if (trimmed.length > 0) {
        if ([...titleOnSlide].some((id) => id !== object.id)) out.titleOnSlide = true;
        if (loneLetter(trimmed)) out.loneLetter = true;
        if (numbering.has(object.id)) out.rowNumbering = true;
        if (multiWord(trimmed)) {
          const pt = maxRunPt(object) ?? 0;
          out.wordRank = Math.max(0, wordSizes.indexOf(pt));
          if (pt === largestPt && largest.length === 1) out.uniqueLargest = true;
          if (topmost === object.id) out.topmostInTopBand = true;
        }
        if (largestIsBlock) out.largestIsBlock = true;
      }
      const key = groupKeyOf(object);
      const siblings = key ? (members.get(key) ?? []) : [];
      if (siblings.length >= 2) {
        out.groupSize = siblings.length;
        out.groupFills = new Set(siblings.map(fillKey).filter((value): value is string => value !== undefined)).size;
        if (siblings.every((member) => (member.kind === 'shape' || member.kind === 'vector') && textOf(member).trim().length === 0)) {
          out.groupIsDrawing = true;
        }
      }
      return out;
    },
  };
}

function maxRunPt(object: SourceObjectV1): number | undefined {
  let max: number | undefined;
  for (const para of object.text?.paras ?? []) {
    for (const run of para.runs) {
      if (run.sizePt === undefined) continue;
      max = max === undefined ? run.sizePt : Math.max(max, run.sizePt);
    }
  }
  return max;
}

function minRunPt(object: SourceObjectV1): number | undefined {
  let min: number | undefined;
  for (const para of object.text?.paras ?? []) {
    for (const run of para.runs) {
      if (run.sizePt === undefined) continue;
      min = min === undefined ? run.sizePt : Math.min(min, run.sizePt);
    }
  }
  return min;
}

/** The family a run names, with a theme token resolved through the deck's theme. */
function resolveFamily(font: string, theme: SourceDeckV1['theme']): string {
  if (font === '+mj-lt' || font === '+mj-ea' || font === '+mj-cs') return theme?.majorFont ?? font;
  if (font === '+mn-lt' || font === '+mn-ea' || font === '+mn-cs') return theme?.minorFont ?? font;
  return font;
}

function matchKnownLogo(
  object: SourceObjectV1,
  stats: RasterStatsV1 | undefined,
  known: KnownLogoV1[],
): { label: string; distance?: number } | null {
  if (object.kind !== 'pic' && object.kind !== 'vector') return null;
  const content = object.media;
  for (const entry of known) {
    if (entry.contentHash && content && entry.contentHash === content) return { label: entry.label };
  }
  const dhash = stats?.dhash;
  if (!dhash) return null;
  let best: { label: string; distance: number } | null = null;
  for (const entry of known) {
    if (!entry.dhash || entry.dhash.length !== dhash.length) continue;
    const distance = hammingDistance(entry.dhash, dhash);
    if (distance <= KNOWN_LOGO_HAMMING && (!best || distance < best.distance)) best = { label: entry.label, distance };
  }
  return best;
}

/** One use id per object, channel and hex, in the form the plan states. */
function useIdFor(objectId: string, channel: Channel, hex: string, shared: boolean, index?: number): string {
  if (channel === 'series') return `${objectId}:series:${index ?? 0}`;
  return shared ? `${objectId}:${channel}:${hex.slice(1).toLowerCase()}` : `${objectId}:${channel}`;
}

/**
 * Add one use, merging into an existing use of the SAME hex. Two different
 * colours never merge just because their ids met: the second one takes an id
 * with its hex in it, the way a text object with more than one ink already
 * does, so a use always reports the colour it was measured from.
 */
function addUse(uses: Map<string, UseAccumulator>, use: UseAccumulator): void {
  const suffix = use.hex.replace('#', '').toLowerCase();
  let candidate = use.useId;
  for (let n = 0; n < 8; n += 1) {
    const existing = uses.get(candidate);
    if (!existing) {
      uses.set(candidate, { ...use, useId: candidate });
      return;
    }
    if (existing.hex === use.hex) {
      existing.weight += use.weight;
      for (const id of use.objectIds) if (!existing.objectIds.includes(id)) existing.objectIds.push(id);
      return;
    }
    candidate = n === 0 ? `${use.useId}:${suffix}` : `${use.useId}:${suffix}:${n + 1}`;
  }
}

/** The id of a slide's own ground, kept out of the object id space. */
function groundUseId(slideId: string): string {
  return `slide:${slideId}:fill`;
}

/** The theme key a scheme slot reads from, under the master's default colour map. */
function themeKeyForSlot(slot: string): string {
  switch (slot) {
    case 'bg1': return 'lt1';
    case 'tx1': return 'dk1';
    case 'bg2': return 'lt2';
    case 'tx2': return 'dk2';
    default: return slot;
  }
}

/**
 * The hex a stated colour resolves to: its own, or the theme slot it names.
 *
 * A source may state a colour as a slot alone, and a colour recorded as a slot
 * with no hex is the case the slot-to-slot mapping exists for, so it must not
 * drop out of the census. A slot the theme does not define still resolves to
 * nothing, because the census cannot state a hex it never read.
 */
function resolveColor(color: SourceColorV1 | undefined, theme: SourceDeckV1['theme']): string | undefined {
  if (!color) return undefined;
  if (color.hex) return normaliseHex(color.hex);
  if (!color.scheme) return undefined;
  const hex = theme?.colors?.[themeKeyForSlot(color.scheme)];
  return hex ? normaliseHex(hex) : undefined;
}

function collectSlideColors(
  frame: SlideFrame,
  uses: Map<string, UseAccumulator>,
  opts: CensusOptsV1,
  theme: SourceDeckV1['theme'],
): void {
  const { slide } = frame;
  const slideArea = frame.width * frame.height;
  const ground = resolveColor(slide.background.color, theme);
  if (ground) {
    const use: UseAccumulator = {
      useId: groundUseId(slide.id),
      hex: ground,
      channel: 'fill',
      weight: slideArea,
      objectIds: [],
      slideId: slide.id,
    };
    if (slide.background.color?.scheme) use.scheme = slide.background.color.scheme;
    addUse(uses, use);
  }

  for (const object of slide.objects) {
    const area = Math.max(0, object.box.w * object.box.h);
    const fillHex = resolveColor(object.fill, theme);
    if (fillHex) {
      const use: UseAccumulator = {
        useId: useIdFor(object.id, 'fill', fillHex, false),
        hex: fillHex,
        channel: 'fill',
        weight: area,
        objectIds: [object.id],
        slideId: slide.id,
      };
      if (object.fill?.scheme) use.scheme = object.fill.scheme;
      addUse(uses, use);
    }
    const lineHex = resolveColor(object.line?.color, theme);
    if (lineHex) {
      const perimeter = 2 * (object.box.w + object.box.h);
      const use: UseAccumulator = {
        useId: useIdFor(object.id, 'stroke', lineHex, false),
        hex: lineHex,
        channel: 'stroke',
        weight: perimeter * Math.max(1, object.line?.widthPt ?? 1),
        objectIds: [object.id],
        slideId: slide.id,
      };
      if (object.line?.color?.scheme) use.scheme = object.line.color.scheme;
      addUse(uses, use);
    }

    const runHexes = new Set<string>();
    for (const para of object.text?.paras ?? []) {
      for (const run of para.runs) {
        const hex = resolveColor(run.color, theme);
        if (hex) runHexes.add(hex);
      }
    }
    const shared = runHexes.size > 1;
    for (const hex of [...runHexes].sort(compareText)) {
      const scheme = schemeForRunHex(object, hex, theme);
      const use: UseAccumulator = {
        useId: useIdFor(object.id, 'text', hex, shared),
        hex,
        channel: 'text',
        weight: textWeight(object, hex, theme),
        objectIds: [object.id],
        slideId: slide.id,
      };
      if (scheme) use.scheme = scheme;
      addUse(uses, use);
    }

    // A native chart's series are a distinction set: their targets must stay
    // apart whatever else the plan maps. The reader in this tree does not report
    // a series' own fill, so a caller may supply the literals; without that the
    // theme's accent cycle is what a renderer would draw, and the evidence says so.
    if (object.chartData && (object.chartData.series?.length ?? 0) > 0) {
      const supplied = opts.chartSeriesColors?.(object.id);
      const cycle = accentCycle(theme);
      const count = object.chartData.series?.length ?? 0;
      for (let i = 0; i < count; i += 1) {
        const hex = supplied?.[i] ?? (cycle.length > 0 ? cycle[i % cycle.length] : undefined);
        if (!hex) continue;
        addUse(uses, {
          useId: useIdFor(object.id, 'series', normaliseHex(hex), false, i + 1),
          hex: normaliseHex(hex),
          channel: 'series',
          weight: area / count,
          objectIds: [object.id],
          slideId: slide.id,
          distinctionSet: object.id,
        });
      }
    }

    // A drawing carried as items states its colours part by part: its series as a
    // distinction set, a grey glyph run as ink, the rest as fills and strokes, so a
    // mapping reaches its rows the way it reaches a shape (plan 275 decision 32).
    for (const u of vectorColourUses(object)) {
      addUse(uses, {
        useId: u.useId,
        hex: u.hex,
        channel: u.channel,
        weight: u.weight,
        objectIds: [object.id],
        slideId: slide.id,
        ...(u.distinctionSet ? { distinctionSet: u.distinctionSet } : {}),
      });
    }
  }
}

/**
 * The theme's accent slots in order, which is what a renderer paints a series
 * with when the chart part states no colour of its own. Empty when the deck
 * names no theme, and a caller that CAN read the literal series colours passes
 * them through `chartSeriesColors` instead.
 */
function accentCycle(theme: SourceDeckV1['theme']): string[] {
  const colors = theme?.colors ?? {};
  const out: string[] = [];
  for (let i = 1; i <= 6; i += 1) {
    const hex = colors[`accent${i}`];
    if (hex) out.push(normaliseHex(hex));
  }
  return out;
}

function schemeForRunHex(object: SourceObjectV1, hex: string, theme: SourceDeckV1['theme']): string | undefined {
  for (const para of object.text?.paras ?? []) {
    for (const run of para.runs) {
      if (run.color?.scheme && resolveColor(run.color, theme) === hex) return run.color.scheme;
    }
  }
  return undefined;
}

/**
 * Roles: the ground the slide STATES is its background, text is ink, strokes
 * are strokes, chart series are series, and every other fill is an accent when
 * it carries chroma or a neutral when it does not.
 *
 * A slide that states no ground gets no `bg` use. The heaviest filled shape on
 * a slide is a shape, and calling it the ground would hand the plan stage a
 * full-width accent band as the deck's background colour.
 */
function assignRoles(accumulated: UseAccumulator[], frames: SlideFrame[]): ColorUseV1[] {
  const backgrounds = new Map<string, string>();
  for (const frame of frames) {
    const id = groundUseId(frame.slide.id);
    if (accumulated.some((use) => use.useId === id)) backgrounds.set(frame.slide.id, id);
  }

  const out: ColorUseV1[] = accumulated.map((use) => {
    let role: ColorUseV1['role'];
    if (use.channel === 'text') role = 'ink';
    else if (use.channel === 'stroke') role = 'stroke';
    else if (use.channel === 'series') role = 'series';
    else if (backgrounds.get(use.slideId) === use.useId) role = 'bg';
    else role = chromaOf(use.hex) >= ACCENT_CHROMA_FLOOR ? 'accent' : 'neutral';

    const row: ColorUseV1 = {
      useId: use.useId,
      hex: use.hex,
      role,
      weight: Math.round(use.weight * 1000) / 1000,
      objectIds: [...use.objectIds].sort(compareText),
    };
    if (use.scheme) row.scheme = use.scheme;
    if (use.distinctionSet) row.distinctionSet = use.distinctionSet;
    return row;
  });

  // Within a role, uses are ordered by how much of the slide they cover and how
  // far they stand from its ground, which is the ranking plan 274 section 3.2
  // states for accents. The role order itself is fixed, so two runs agree.
  const groundHex = new Map<string, string>();
  for (const [slideId, useId] of backgrounds) {
    const found = accumulated.find((use) => use.useId === useId);
    if (found) groundHex.set(slideId, found.hex);
  }
  const rankOf = new Map<string, number>();
  for (const use of accumulated) {
    const ground = groundHex.get(use.slideId);
    const separation = ground ? contrastRatio(use.hex, ground) : 1;
    rankOf.set(use.useId, use.weight * separation);
  }
  const roleOrder: ColorUseV1['role'][] = ['bg', 'ink', 'accent', 'series', 'stroke', 'neutral'];
  return out.sort((a, b) => {
    const byRole = roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
    if (byRole !== 0) return byRole;
    const byRank = (rankOf.get(b.useId) ?? 0) - (rankOf.get(a.useId) ?? 0);
    return byRank !== 0 ? byRank : compareText(a.useId, b.useId);
  });
}

/** Share of the foreground box that a candidate background box covers. */
function overlapShare(fore: BoxV1, back: BoxV1): number {
  const area = Math.max(0, fore.w) * Math.max(0, fore.h);
  if (area <= 0) return 0;
  const w = Math.min(fore.x + fore.w, back.x + back.w) - Math.max(fore.x, back.x);
  const h = Math.min(fore.y + fore.h, back.y + back.h) - Math.max(fore.y, back.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / area;
}

/**
 * Contrast pairs: a text colour against the box it actually sits on, and a fill
 * against its own stroke. The minimum is 4.5 for ordinary text and 3 for large
 * text and graphics, measured on the real pair rather than on a slide average.
 *
 * The box a text sits on is found by geometry and paint order: its own fill
 * first, then the last filled object painted UNDER it that covers most of it,
 * then the ground the slide states. A pair is reported only when one of those
 * holds. Pairing a text against the heaviest fill anywhere on the slide would
 * report contrast on two things that never touch, and would hide the real pair
 * as soon as a bigger shape appeared somewhere else.
 *
 * Known limit: a slide that states no ground and puts its text over nothing
 * reports no pair at all, so an empty contrast list means "nothing could be
 * measured" as well as "nothing to fix". The census has no warning code for
 * that, which `tests/rebrand-census.test.ts` pins instead.
 */
function contrastPairsFor(frames: SlideFrame[], uses: Map<string, UseAccumulator>): ContrastPairV1[] {
  const all = [...uses.values()];
  const out: ContrastPairV1[] = [];
  for (const frame of frames) {
    const ground = all.find((use) => use.useId === groundUseId(frame.slide.id));
    const fillOf = (objectId: string): UseAccumulator | undefined =>
      all.find((use) => use.channel === 'fill' && use.objectIds.includes(objectId));
    frame.slide.objects.forEach((object, index) => {
      const ownFill = fillOf(object.id);
      const texts = all.filter((use) => use.channel === 'text' && use.objectIds.includes(object.id));
      if (texts.length > 0) {
        let background = ownFill;
        for (let under = index - 1; under >= 0 && !background; under -= 1) {
          const below = frame.slide.objects[under];
          if (!below) continue;
          const fill = fillOf(below.id);
          if (!fill) continue;
          if (overlapShare(object.box, below.box) >= BACKGROUND_COVER_SHARE) background = fill;
        }
        background = background ?? ground;
        if (background) {
          const smallest = minRunPt(object) ?? 12;
          for (const text of texts) {
            out.push({
              foreground: text.useId,
              background: background.useId,
              minimum: smallest < LARGE_TEXT_PT ? 4.5 : 3,
              objectId: object.id,
            });
          }
        }
      }
      const stroke = all.find((use) => use.channel === 'stroke' && use.objectIds.includes(object.id));
      if (ownFill && stroke) {
        out.push({ foreground: stroke.useId, background: ownFill.useId, minimum: 3, objectId: object.id });
      }
    });
  }
  return out.sort((a, b) => compareText(a.foreground, b.foreground) || compareText(a.background, b.background));
}

function layoutFeatures(frame: SlideFrame, hypotheses: Map<string, ClassHypothesisV1>): LayoutFeaturesV1 {
  const { slide } = frame;
  const slideArea = frame.width * frame.height;
  const counts: Partial<Record<ObjectClassV1, number>> = {};
  let largestTextPt: number | undefined;
  let imageArea = 0;
  let chartPresent = false;
  let tablePresent = false;
  let textParagraphs = 0;
  let textWords = 0;
  const leftEdges = new Set<number>();
  const sizeKeys = new Map<string, number>();

  for (const object of slide.objects) {
    const klass = hypotheses.get(object.id)?.class ?? 'unknown';
    counts[klass] = (counts[klass] ?? 0) + 1;
    const pt = maxRunPt(object);
    if (pt !== undefined) largestTextPt = largestTextPt === undefined ? pt : Math.max(largestTextPt, pt);
    if (object.kind === 'pic' || object.media !== undefined) imageArea += Math.max(0, object.box.w * object.box.h);
    if (object.kind === 'chart' || object.chartData !== undefined) chartPresent = true;
    if (object.kind === 'table' || object.table !== undefined) tablePresent = true;
    const text = textOf(object);
    if (text.trim().length > 0) {
      textParagraphs += object.text?.paras.length ?? 0;
      textWords += wordsOf(text).length;
    }
    leftEdges.add(Math.round(object.box.x / 8));
    const key = `${Math.round(object.box.w / 8)}x${Math.round(object.box.h / 8)}`;
    sizeKeys.set(key, (sizeKeys.get(key) ?? 0) + 1);
  }

  let equalSiblingBoxes = 0;
  for (const count of sizeKeys.values()) if (count > 1) equalSiblingBoxes += count;

  const features: LayoutFeaturesV1 = {
    slideId: slide.id,
    counts,
    imageAreaShare: slideArea > 0 ? Math.min(1, imageArea / slideArea) : 0,
    chartPresent,
    tablePresent,
    distinctLeftEdges: leftEdges.size,
    equalSiblingBoxes,
    textParagraphs,
    textWords,
  };
  if (largestTextPt !== undefined) features.largestTextPt = largestTextPt;
  if (slide.origin.layout) features.sourceLayout = slide.origin.layout;
  const { units, containers } = layoutUnitsOf(frame, hypotheses);
  features.units = units;
  features.containers = containers;
  return features;
}

// ─── layout units (plan 275 section 3.1) ─────────────────────────────────────

/**
 * A picture is content at or over this share of the slide, and an icon under it.
 * The same number as `INCIDENTAL_PICTURE_SHARE` in `deck-compile.ts` (a test pins
 * the two together); stated here because the compile imports this module.
 */
export const LAYOUT_CONTENT_PICTURE = 0.05;
/** A textless shape under this share of the slide is a speck, not a unit. */
export const LAYOUT_TINY_SHAPE = 0.002;
/** A container covers at least this share of the slide... */
export const LAYOUT_CONTAINER_MIN = 0.01;
/** ...and at most this share: a page-wide panel is a background, not a card. */
export const LAYOUT_CONTAINER_MAX = 0.6;
/** A container holds a box when at least this share of the box lies inside it. */
export const CARD_CONTAINMENT = 0.8;

/**
 * Classes whose objects are never layout content: the design system brings its own
 * page number, date, footer and mark, and the template's furniture is the template's.
 */
const NOT_CONTENT: ReadonlySet<ObjectClassV1> = new Set<ObjectClassV1>([
  'page-number',
  'date',
  'footer',
  'recurring-text',
  'template-furniture',
  'logo-candidate',
  'known-logo',
]);

const PICTURE_CLASSES: ReadonlySet<ObjectClassV1> = new Set<ObjectClassV1>(['photo', 'screenshot', 'diagram']);

/** A box as fractions of its slide, clipped to the slide: a picture off the edge counts by what shows. */
function clippedBox(box: BoxV1, frame: SlideFrame): { x: number; y: number; w: number; h: number } {
  const x0 = Math.max(0, box.x / frame.width);
  const y0 = Math.max(0, box.y / frame.height);
  const x1 = Math.min(1, (box.x + box.w) / frame.width);
  const y1 = Math.min(1, (box.y + box.h) / frame.height);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

function areaOf(box: { w: number; h: number }): number {
  return Math.max(0, box.w) * Math.max(0, box.h);
}

/** Share of `inner` that lies inside `outer`. */
function insideShare(inner: { x: number; y: number; w: number; h: number }, outer: { x: number; y: number; w: number; h: number }): number {
  const ix = Math.max(0, Math.min(inner.x + inner.w, outer.x + outer.w) - Math.max(inner.x, outer.x));
  const iy = Math.max(0, Math.min(inner.y + inner.h, outer.y + outer.h) - Math.max(inner.y, outer.y));
  const area = areaOf(inner);
  return area > 0 ? (ix * iy) / area : 0;
}

function roundBox(box: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number } {
  const r = (n: number): number => Math.round(n * 10000) / 10000;
  return { x: r(box.x), y: r(box.y), w: r(box.w), h: r(box.h) };
}

/**
 * The kept content of one slide as the layout read sees it, and the containers that
 * hold it (plan 275 section 3.1).
 *
 * A unit is an object the slide itself placed (or a slide picture was rebuilt into),
 * not hidden and not furniture: a title and its body text, a picture, a chart, a
 * table, a textless shape and an icon (a picture under `LAYOUT_CONTENT_PICTURE`).
 * Ornament (`decoration`) is never content. A container is a filled shape, a drawing
 * or a picture used as a panel that holds text boxes at `CARD_CONTAINMENT`, and it
 * is listed with its members whatever the plan does to it: a card's panel repeated
 * at one place on several slides reads as ornament and is proposed for removal, and
 * for the layout read it is still the card (decision 7). On a slide rebuilt from a
 * picture the containers are the ones the rebuild named through `groupPath`: its
 * panels, its cards (an icon over a label) and its rows.
 */
function layoutUnitsOf(frame: SlideFrame, hypotheses: Map<string, ClassHypothesisV1>): { units: LayoutUnitV1[]; containers: LayoutUnitV1[] } {
  const { slide } = frame;
  const units: LayoutUnitV1[] = [];
  const candidates: Array<{ id: string; box: LayoutUnitV1['box']; panel: boolean }> = [];
  const heading = new Set<string>();
  const rebuilt = new Map<string, SourceObjectV1[]>();
  const objectIds = new Set(slide.objects.map((object) => object.id));
  for (const object of slide.objects) {
    if (object.hidden === true) continue;
    if (object.origin !== 'slide' && object.origin !== 'raster-region') continue;
    const klass = hypotheses.get(object.id)?.class ?? 'unknown';
    if (NOT_CONTENT.has(klass)) continue;
    const box = clippedBox(object.box, frame);
    const area = areaOf(box);
    if (area <= 0) continue;
    const text = textOf(object);
    const words = wordsOf(text).length;
    if (object.origin === 'raster-region' && object.groupPath && object.groupPath.length > 0) {
      const key = object.groupPath[0] as string;
      if (key !== object.id) {
        const list = rebuilt.get(key) ?? [];
        list.push(object);
        rebuilt.set(key, list);
      }
    }
    if (klass === 'decoration') {
      // Ornament is never content; a textless panel of it can still hold a card.
      const panel = object.kind === 'shape' || object.kind === 'vector';
      if (panel && words === 0 && area >= LAYOUT_CONTAINER_MIN && area <= LAYOUT_CONTAINER_MAX) {
        candidates.push({ id: object.id, box, panel: false });
      }
      continue;
    }
    let kind: LayoutUnitV1['kind'];
    if (object.kind === 'table' || object.table !== undefined) kind = 'table';
    else if (object.kind === 'chart' || object.chartData !== undefined) kind = 'chart';
    else if (klass === 'chart' && (object.kind === 'vector' || object.kind === 'pic')) kind = 'chart';
    else if (object.kind === 'pic' || (object.media !== undefined && object.kind !== 'text')) kind = 'pic';
    else if (object.kind === 'vector') kind = area >= LAYOUT_CONTENT_PICTURE ? 'pic' : 'shape';
    else if (words > 0) kind = 'text';
    else if (object.kind === 'shape') kind = 'shape';
    else if (PICTURE_CLASSES.has(klass)) kind = 'pic';
    else continue;
    if (kind === 'shape' && area < LAYOUT_TINY_SHAPE) continue;
    if (kind === 'pic' && area < LAYOUT_CONTENT_PICTURE && !PICTURE_CLASSES.has(klass)) kind = 'icon';
    const unit: LayoutUnitV1 = { id: object.id, kind, box: roundBox(box), words, maxPt: maxRunPt(object) ?? 0 };
    units.push(unit);
    if (klass === 'title' || klass === 'subtitle') heading.add(object.id);
    if (object.origin === 'raster-region') continue;
    if (kind === 'shape' && area >= LAYOUT_CONTAINER_MIN && area <= LAYOUT_CONTAINER_MAX) candidates.push({ id: object.id, box, panel: false });
    if (kind === 'pic' && slide.origin.flattened !== true && area <= LAYOUT_CONTAINER_MAX) candidates.push({ id: object.id, box, panel: true });
  }

  const containers: LayoutUnitV1[] = [];
  const unitOf = new Map(units.map((unit) => [unit.id, unit]));
  const readingOrder = (a: string, b: string): number => {
    const ua = unitOf.get(a)?.box;
    const ub = unitOf.get(b)?.box;
    return ((ua?.y ?? 0) - (ub?.y ?? 0)) || ((ua?.x ?? 0) - (ub?.x ?? 0)) || compareText(a, b);
  };
  const container = (id: string, box: LayoutUnitV1['box'], members: string[]): LayoutUnitV1 => {
    const held = members.map((member) => unitOf.get(member)).filter((unit): unit is LayoutUnitV1 => unit !== undefined);
    return {
      id,
      kind: 'card',
      box: roundBox(box),
      words: held.reduce((sum, unit) => sum + unit.words, 0),
      maxPt: held.reduce((max, unit) => Math.max(max, unit.maxPt), 0),
      members: [...members].sort(readingOrder),
    };
  };

  // A rebuilt slide states its containers: the panel, card or row each object's
  // outermost group names.
  for (const key of [...rebuilt.keys()].sort(compareText)) {
    const members = (rebuilt.get(key) ?? []).filter((object) => unitOf.has(object.id) && !heading.has(object.id)).map((object) => object.id);
    if (!members.some((id) => unitOf.get(id)?.kind === 'text')) continue;
    const panel = objectIds.has(key) ? slide.objects.find((object) => object.id === key) : undefined;
    let box: LayoutUnitV1['box'];
    if (panel) box = clippedBox(panel.box, frame);
    else {
      const boxes = members.map((id) => unitOf.get(id)?.box).filter((one): one is LayoutUnitV1['box'] => one !== undefined);
      const x0 = Math.min(...boxes.map((one) => one.x));
      const y0 = Math.min(...boxes.map((one) => one.y));
      box = { x: x0, y: y0, w: Math.max(...boxes.map((one) => one.x + one.w)) - x0, h: Math.max(...boxes.map((one) => one.y + one.h)) - y0 };
    }
    containers.push(container(key, box, members));
  }

  // Elsewhere, a filled shape, a drawing or a panel picture that holds text boxes,
  // smallest first, so a card inside a band is the card and the band holds the rest.
  const absorbed = new Set<string>();
  candidates.sort((a, b) => (areaOf(a.box) - areaOf(b.box)) || compareText(a.id, b.id));
  for (const candidate of candidates) {
    const inner = units.filter((unit) => unit.id !== candidate.id && !absorbed.has(unit.id) && !heading.has(unit.id)
      && (unit.kind === 'text' || unit.kind === 'pic' || unit.kind === 'icon')
      && insideShare(unit.box, candidate.box) >= CARD_CONTAINMENT);
    if (!inner.some((unit) => unit.kind === 'text')) continue;
    for (const unit of inner) absorbed.add(unit.id);
    absorbed.add(candidate.id);
    containers.push(container(candidate.id, candidate.box, inner.map((unit) => unit.id)));
  }
  return { units, containers };
}
