#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Measure how a picture deck is rebuilt (plan 275 WP10): every slide one
 * picture of text over photographs, gradients and cards, read back against a
 * hand transcript written by looking at the slides.
 *
 * Run as: node scripts/rebrand-picture-eval.ts <deck> --transcript=<json> [--emphasis=<json>] [--scope=page|regions] [--json] [--ocr-cache=<file>]
 *
 * The deck is read by `planDeck` from `@lolly-tools/node-shell/rebrand` with the
 * node OCR runner (`nodeFlattenedOcr`, which downloads nothing: without the
 * model on this machine the run stops with exit code 2 and says why), then
 * censused and planned against the starter design system the suite uses.
 * `--scope=regions` reads each colour region on its own, as the first slice did,
 * which is the before reading; `page` (the default) reads the whole slide first.
 *
 * Per slide it prints:
 *   - title: the text the census classed as title, which is what the plan pours
 *     into a layout's title, against the transcript title, three ways: trigram
 *     containment, normalised edit similarity (1 less the edit distance over the
 *     longer length, so an inserted letter costs), and whether the two match
 *     exactly once case, quotes and spacing are folded; beside it, containment
 *     in the text the rebuild itself estimated as title (`roleEstimate`);
 *   - body recall and precision at the word level: transcript body words found in
 *     the rebuilt text that is neither title nor removed, and rebuilt words found
 *     anywhere in the transcript's title, body, items (a table row's cells
 *     included), column headings and callouts, with the rebuilt words found
 *     nowhere in it counted as inserted;
 *   - contrast: the lowest contrast ratio of a rebuilt text run's colour against
 *     the ground the rebuilt slide draws under it (a shape's fill, a picture
 *     crop's own pixels, or the slide's ground colour), and how many runs fall
 *     under 3:1, so text rebuilt in its ground's colour shows, and so does text
 *     whose card the rebuild did not make;
 *   - items: cards and rows the rebuild grouped, against the transcript's items,
 *     and whether the structure read matches the transcript's;
 *   - mark: whether every object over the transcript's common mark box is
 *     proposed for removal and nothing kept draws it: a picture crop that runs
 *     under the mark with the mark painted out (its pixels there hold well
 *     under the detail the slide picture holds) does not draw it;
 *   - crops: each transcript picture credited to at most one crop and each crop
 *     to at most one picture, with the share of the picture's box the crop
 *     covers; a picture is cropped tight when its crop covers at least 70% of it
 *     and is at most 1.5 times its area;
 *   - containers: shapes the rebuild named as the container of a card or a
 *     callout, and how many of them the plan proposes to remove;
 *   - the structure the rebuilt objects read as, and the time the slide took;
 *   - with `--emphasis=<json>` (a second private label file: per slide, the
 *     spans set in another colour or weight than the rest of their paragraph),
 *     each span found with its style, and the letters the rebuild set apart
 *     where the labels say the paragraph is plain;
 *   - quotes and dashes: every curly quote, apostrophe and dash of the
 *     transcript, found by the letters around it, as the typographic character,
 *     as its plain stand-in or not at all, and typographic characters the
 *     rebuild wrote where the transcript has none;
 *   - text at an angle: the slides whose rebuild says it kept text set at an
 *     angle inside a picture.
 *
 * `--ocr-cache=<file>` keeps every recogniser answer in a JSON file keyed by a
 * hash of the crop it was given, and answers a crop seen before from the file,
 * so a change to the rebuild can be measured again in seconds. The times it
 * prints are then not the recogniser's; the call count still is.
 *
 * The transcript is the format of the private labels (`slides[].title`, `body`,
 * `items`, `callouts`, `pictures[].box`, `commonMarks`), boxes as `[x, y, w, h]`
 * fractions of the slide. Nothing is written; the report goes to stdout.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { nodeFlattenedOcr } from '../packages/node-shell/src/rebrand/ocr-node.ts';
import { decodePipelinePicture, planDeck } from '../packages/node-shell/src/rebrand/index.ts';
import type { FlattenedOcrV1 } from '../packages/node-shell/src/rebrand/flattened.ts';
import type { ObjectPlanV1, SlideSourceV1, SourceObjectV1 } from '../packages/core/src/index.ts';
import type { OcrLine } from '../packages/core/src/host-v1.ts';
import { contrastRatio } from '../engine/src/brand-derive.ts';
import { detailShare, lineInkColourOf, type RgbaImageV1 } from '../engine/src/slide-regions.ts';
import { STARTER_DESIGN_SYSTEM, parsePipelineXml } from '../tests/helpers/rebrand-pipeline.ts';

// ─── the transcript ──────────────────────────────────────────────────────────

type Frac = [number, number, number, number];

interface TranscriptSlide {
  slide: number;
  title: string;
  body: string[];
  items: Array<{ label?: string | null; text: string; cells?: string[] }>;
  /** A table's column headings, when the slide is a table. */
  columns?: string[];
  callouts: string[];
  marks: string[];
  pictures: Array<{ what: string; box: Frac }>;
  structure?: string;
}

interface Transcript {
  commonMarks?: Record<string, { box: Frac }>;
  slides: TranscriptSlide[];
}

function readTranscript(file: string): Transcript {
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!raw || typeof raw !== 'object' || !('slides' in raw) || !Array.isArray(raw.slides)) {
    throw new Error(`${file} has no slides array.`);
  }
  return raw as Transcript;
}

// ─── text measures ───────────────────────────────────────────────────────────

/** Lower case, curly quotes and dashes folded to plain ones, everything but letters and figures a space. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, ' ')
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .replace(/'/g, '')
    .trim();
}

function words(text: string): string[] {
  const n = normalise(text);
  return n ? n.split(' ') : [];
}

function trigrams(text: string): Set<string> {
  const n = ` ${normalise(text)} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= n.length; i++) out.add(n.slice(i, i + 3));
  return out;
}

/** Share of the trigrams of `needle` that appear in `hay`. */
function trigramContainment(needle: string, hay: string): number {
  const a = trigrams(needle);
  if (a.size === 0) return 1;
  const b = trigrams(hay);
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / a.size;
}

/** Words of `truth` found in `found`, each found word used once. */
function matchedWords(truth: string[], found: string[]): number {
  const pool = new Map<string, number>();
  for (const w of found) pool.set(w, (pool.get(w) ?? 0) + 1);
  let hit = 0;
  for (const w of truth) {
    const n = pool.get(w) ?? 0;
    if (n > 0) {
      hit++;
      pool.set(w, n - 1);
    }
  }
  return hit;
}

/** Edit distance between two strings, by code point. */
function editDistance(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  let row = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const next = [i];
    for (let j = 1; j <= y.length; j++) {
      next[j] = Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[y.length] ?? 0;
}

/** 1 less the edit distance over the longer length, both normalised: 1 is the same text. */
function editSimilarity(truth: string, found: string): number {
  const a = normalise(truth);
  const b = normalise(found);
  const longer = Math.max(Array.from(a).length, Array.from(b).length);
  return longer ? 1 - editDistance(a, b) / longer : 1;
}

// ─── reading the rebuilt slide ───────────────────────────────────────────────

function textOf(o: SourceObjectV1): string {
  return (o.text?.paras ?? []).map((p) => p.runs.map((r) => r.text).join('')).join('\n');
}

function frac(o: SourceObjectV1, s: SlideSourceV1): Frac {
  return [o.box.x / s.width, o.box.y / s.height, o.box.w / s.width, o.box.h / s.height];
}

function overlap(a: Frac, b: Frac): number {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
  return w > 0 && h > 0 ? w * h : 0;
}

interface Units {
  cards: number;
  callouts: number;
  rows: number;
  /** Containers holding the slide's title: a card the whole slide sits in, neither a card of a grid nor a callout. */
  panels: number;
}

/**
 * The units the rebuild marked through `groupPath`: `<base>.rowN` is a row,
 * `<base>.cardN` an icon over its label, and a group named by a rectangle among
 * its members is a container, a card when it holds a picture and a callout when
 * it holds text alone, unless most of its text is the cells of rows (a table's
 * highlighted column). A card inside a container counts once. Also the ids of
 * the rectangles that name a group.
 */
function unitsOf(slide: SlideSourceV1): Units & { containers: string[] } {
  const byGroup = new Map<string, SourceObjectV1[]>();
  for (const o of slide.objects) {
    for (const id of o.groupPath ?? []) {
      const list = byGroup.get(id);
      if (list) list.push(o);
      else byGroup.set(id, [o]);
    }
  }
  let cards = 0;
  let callouts = 0;
  let rows = 0;
  let panels = 0;
  const containers = new Set<string>();
  for (const o of slide.objects) for (const id of o.groupPath ?? []) if (slide.objects.some((m) => m.id === id && m.kind === 'shape')) containers.add(id);
  for (const [id, members] of byGroup) {
    if (/\.row\d+$/.test(id)) {
      rows++;
      continue;
    }
    if (/\.card\d+$/.test(id)) {
      cards++;
      continue;
    }
    const hasShape = members.some((m) => m.id === id && m.kind === 'shape');
    if (!hasShape) continue;
    // A panel holding the title holds the slide's content: the labels call it a
    // container, not a callout.
    if (slide.objects.some((m) => m.kind === 'text' && m.roleEstimate === 'title' && m.groupPath?.includes(id))) {
      panels++;
      continue;
    }
    const nestedCards = members.some((m) => m.groupPath?.some((g) => /\.card\d+$/.test(g)));
    if (nestedCards) continue;
    // A panel whose text is mostly the cells of rows is a highlighted column of
    // a table, not a callout of its own.
    const texts = slide.objects.filter((m) => m.kind === 'text' && m.groupPath?.includes(id));
    const cells = texts.filter((m) => m.groupPath?.some((g) => /\.row\d+$/.test(g)));
    if (texts.length && cells.length * 2 > texts.length) continue;
    if (members.some((m) => m.kind === 'pic')) cards++;
    else callouts++;
  }
  return { cards, callouts, rows, panels, containers: [...containers].sort() };
}

function structureOf(units: Units, pictures: number, texts: number): string {
  const parts: string[] = [];
  if (units.cards) parts.push(`cards-${units.cards}`);
  if (units.rows) parts.push(`rows-${units.rows}`);
  if (units.callouts) parts.push(units.callouts === 1 ? 'callout' : `callouts-${units.callouts}`);
  if (!parts.length) parts.push(pictures ? `text+pictures-${pictures}` : 'text');
  return `${parts.join('+')} (${texts} text)`;
}

/** The kinds of unit a structure names: cards, rows, a callout; none for a slide of text and pictures. */
function unitKinds(units: Units): string {
  const kinds: string[] = [];
  if (units.cards) kinds.push('cards');
  if (units.rows) kinds.push('rows');
  if (units.callouts) kinds.push('callout');
  return kinds.join('+');
}

/** The same for a transcript's structure name (`cards-3`, `rows-and-callout`, `title-and-image`). */
function transcriptKinds(structure: string): string {
  const kinds: string[] = [];
  if (/cards/.test(structure)) kinds.push('cards');
  if (/rows/.test(structure)) kinds.push('rows');
  if (/callout/.test(structure)) kinds.push('callout');
  return kinds.join('+');
}

// ─── emphasis, quotes and dashes ─────────────────────────────────────────────

interface EmphasisSpan {
  in: string;
  mark: string;
  kind: 'colour' | 'bold';
}

interface EmphasisLabels {
  slides: Array<{ slide: number; spans: EmphasisSpan[] }>;
  plain?: number[];
}

function readEmphasis(file: string): EmphasisLabels {
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!raw || typeof raw !== 'object' || !('slides' in raw) || !Array.isArray(raw.slides)) throw new Error(`${file} has no slides array.`);
  return raw as EmphasisLabels;
}

/** Curly quotes and dashes as their plain stand-ins, one character for one, so positions hold. */
function foldTypography(text: string): string {
  return text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-');
}

/** Two colours this far apart (summed channels) are two colours, not one read twice. */
const EMPHASIS_COLOUR_APART = 60;

function channelDistance(a: string, b: string): number {
  const parse = (hex: string): number[] => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) || 0);
  const x = parse(a);
  const y = parse(b);
  return Math.abs((x[0] ?? 0) - (y[0] ?? 0)) + Math.abs((x[1] ?? 0) - (y[1] ?? 0)) + Math.abs((x[2] ?? 0) - (y[2] ?? 0));
}

/**
 * Each character of a text object's paragraphs with whether it is set apart from
 * its paragraph: in a colour well away from the paragraph's commonest (by letters),
 * or bold in a paragraph mostly not bold. Paragraphs joined by a newline.
 */
function styledChars(o: SourceObjectV1): Array<{ ch: string; colour: boolean; bold: boolean }> {
  const out: Array<{ ch: string; colour: boolean; bold: boolean }> = [];
  for (const [k, para] of (o.text?.paras ?? []).entries()) {
    if (k > 0) out.push({ ch: '\n', colour: false, bold: false });
    const byColour = new Map<string, number>();
    let boldLetters = 0;
    let letters = 0;
    for (const run of para.runs) {
      const n = run.text.replace(/\s/g, '').length;
      letters += n;
      if (run.bold) boldLetters += n;
      const hex = run.color?.hex ?? '';
      byColour.set(hex, (byColour.get(hex) ?? 0) + n);
    }
    const usual = [...byColour.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? '';
    const mostlyBold = boldLetters * 2 > letters;
    for (const run of para.runs) {
      const hex = run.color?.hex ?? '';
      const colour = Boolean(hex && usual && channelDistance(hex, usual) > EMPHASIS_COLOUR_APART);
      const bold = !mostlyBold && run.bold === true;
      for (const ch of run.text) out.push({ ch, colour, bold });
    }
  }
  return out;
}

interface EmphasisRow {
  spans: number;
  found: number;
  styled: number;
  /** Letters set apart outside every labelled span, on a slide the labels cover. */
  stray: number;
}

/** The labelled spans on one slide, found and styled in the rebuilt text, and the letters set apart elsewhere. */
function emphasisOf(texts: SourceObjectV1[], spans: EmphasisSpan[]): EmphasisRow {
  const row: EmphasisRow = { spans: spans.length, found: 0, styled: 0, stray: 0 };
  const objects = texts.map((o) => {
    const chars = styledChars(o);
    return { chars, text: foldTypography(chars.map((c) => c.ch).join('')), claimed: new Set<number>() };
  });
  for (const span of spans) {
    const needle = foldTypography(span.in);
    const hit = objects.map((one) => ({ one, at: one.text.indexOf(needle) })).find((h) => h.at >= 0);
    if (!hit) continue;
    row.found++;
    const start = hit.at + needle.indexOf(foldTypography(span.mark));
    let styled = 0;
    let letters = 0;
    for (let i = start; i < start + span.mark.length; i++) {
      hit.one.claimed.add(i);
      const c = hit.one.chars[i];
      if (!c?.ch.trim()) continue;
      letters++;
      if (span.kind === 'colour' ? c.colour : c.bold) styled++;
    }
    if (letters > 0 && styled >= 0.8 * letters) row.styled++;
  }
  for (const one of objects) {
    one.chars.forEach((c, i) => {
      if (c.ch.trim() && (c.colour || c.bold) && !one.claimed.has(i)) row.stray++;
    });
  }
  return row;
}

/** The curly quotes, apostrophes and dashes the transcript carries, with the plain character OCR may read in their place. */
const TYPOGRAPHIC: Record<string, string> = { '\u2019': "'", '\u2018': "'", '\u201c': '"', '\u201d': '"', '\u2014': '-', '\u2013': '-' };

interface TypographyRow {
  /** Typographic characters in the transcript's text. */
  marks: number;
  /** Read back as the same character. */
  typographic: number;
  /** Read back as the plain stand-in. */
  plain: number;
  /** Typographic characters the rebuild wrote beyond the transcript's. */
  extra: number;
}

/**
 * Every typographic character of the transcript, found in the rebuilt text by up to
 * four letters on each side (spaces left out on both sides, so a line break in the
 * rebuild does not hide it): the same character, its plain stand-in, or neither.
 */
function typographyOf(truth: string, rebuilt: string): TypographyRow {
  const row: TypographyRow = { marks: 0, typographic: 0, plain: 0, extra: 0 };
  const squeeze = (text: string): string => text.replace(/\s+/g, '');
  const t = squeeze(truth);
  const r = squeeze(rebuilt);
  const counts = (text: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (const ch of text) if (ch in TYPOGRAPHIC) m.set(ch, (m.get(ch) ?? 0) + 1);
    return m;
  };
  for (const [i, ch] of Array.from(t).entries()) {
    const plain = TYPOGRAPHIC[ch];
    if (plain === undefined) continue;
    row.marks++;
    const chars = Array.from(t);
    const left = chars.slice(Math.max(0, i - 4), i).join('');
    const right = chars.slice(i + 1, i + 5).join('');
    if (r.includes(`${left}${ch}${right}`)) row.typographic++;
    else if (r.includes(`${foldTypography(left)}${plain}${foldTypography(right)}`) || r.includes(`${left}${plain}${right}`)) row.plain++;
  }
  const want = counts(t);
  for (const [ch, n] of counts(r)) row.extra += Math.max(0, n - (want.get(ch) ?? 0));
  return row;
}

// ─── the run ─────────────────────────────────────────────────────────────────

/** A crop covers a transcript picture when it takes in at least this share of the picture's box... */
const COVER_SHARE = 0.7;
/** ...and is tight when it is at most this many times the picture's area. */
const TIGHT_AREA = 1.5;
/** A crop whose pixels over the mark hold under this share of the detail the slide picture holds there has the mark painted out. */
const PAINTED_DETAIL = 0.5;
/** A rebuilt run under this contrast against its ground is counted as unreadable. */
const MIN_CONTRAST = 3;

interface SlideRow {
  slide: number;
  titleRebuilt: number;
  titleCensus: number;
  titleEdit: number;
  titleExact: boolean;
  bodyWords: number;
  bodyHit: number;
  foundWords: number;
  foundHit: number;
  minContrast: number;
  lowRuns: number;
  runs: number;
  items: number;
  itemsTruth: number;
  structureMatch: boolean;
  mark: 'removed' | 'kept' | 'missing';
  crops: number;
  picturesTruth: number;
  picturesTight: number;
  pictureCover: number[];
  containers: number;
  containersRemoved: number;
  structure: string;
  structureTruth: string;
  ms: number;
  /** Containers holding the title (the slide's own panel). */
  panels: number;
  emphasis: EmphasisRow | null;
  typography: TypographyRow;
  /** The rebuild said it kept text set at an angle inside a picture. */
  angled: boolean;
}

/**
 * Each transcript picture credited to at most one crop and each crop to at
 * most one picture, the best agreeing boxes first: the share of the picture's box each
 * credited crop covers, and whether the crop is tight around it.
 */
function creditCrops(crops: Frac[], pictures: Frac[]): Array<{ cover: number; tight: boolean }> {
  const pairs: Array<{ c: number; p: number; cover: number; fit: number }> = [];
  for (const [c, crop] of crops.entries()) {
    for (const [p, pic] of pictures.entries()) {
      const area = pic[2] * pic[3];
      const shared = overlap(crop, pic);
      const cover = area > 0 ? shared / area : 0;
      // Paired by how well the two boxes agree (shared over joined area), so a
      // crop of a large drawing goes to the drawing rather than a panel inside it.
      const fit = shared / Math.max(1e-9, area + crop[2] * crop[3] - shared);
      if (cover > 0) pairs.push({ c, p, cover, fit });
    }
  }
  pairs.sort((a, b) => b.fit - a.fit || a.p - b.p || a.c - b.c);
  const usedCrop = new Set<number>();
  const out = pictures.map(() => ({ cover: 0, tight: false }));
  for (const { c, p, cover } of pairs) {
    const current = out[p];
    if (usedCrop.has(c) || !current || current.cover > 0) continue;
    usedCrop.add(c);
    const crop = crops[c];
    const pic = pictures[p];
    const area = crop && pic ? (crop[2] * crop[3]) / Math.max(1e-9, pic[2] * pic[3]) : Number.POSITIVE_INFINITY;
    out[p] = { cover, tight: cover >= COVER_SHARE && area <= TIGHT_AREA };
  }
  return out;
}

/**
 * Whether a picture crop over the mark has the mark painted out of it: its
 * pixels over the mark's box hold well under the detail the slide picture holds
 * there (`PAINTED_DETAIL`). A text object or a crop that draws the mark is not.
 */
async function paintedOut(o: SourceObjectV1, slide: SlideSourceV1, mark: Frac, picture: RgbaImageV1 | null, media: Map<string, { bytes: Uint8Array; mime: string }>): Promise<boolean> {
  if (o.kind !== 'pic' || !o.media || !picture) return false;
  const held = media.get(o.media);
  const crop = held ? await decodePipelinePicture(held.bytes, held.mime) : null;
  if (!crop) return false;
  const f = frac(o, slide);
  // The mark's box in the slide picture's pixels and in the crop's, clipped to the crop.
  const x0 = Math.max(mark[0], f[0]);
  const y0 = Math.max(mark[1], f[1]);
  const x1 = Math.min(mark[0] + mark[2], f[0] + f[2]);
  const y1 = Math.min(mark[1] + mark[3], f[1] + f[3]);
  if (x1 <= x0 || y1 <= y0) return false;
  const inWhole = { x: x0 * picture.width, y: y0 * picture.height, w: (x1 - x0) * picture.width, h: (y1 - y0) * picture.height };
  const inCrop = { x: ((x0 - f[0]) / f[2]) * crop.width, y: ((y0 - f[1]) / f[3]) * crop.height, w: ((x1 - x0) / f[2]) * crop.width, h: ((y1 - y0) / f[3]) * crop.height };
  return detailShare(crop, inCrop) < PAINTED_DETAIL * detailShare(picture, inWhole);
}

/**
 * The lowest contrast of a slide's text runs against the ground the rebuild
 * sets them on, and how many fall under `MIN_CONTRAST`. The ground is what the
 * rebuilt slide draws under the text's centre: the topmost shape there (its
 * fill), else the topmost picture crop there (the picture's own pixels, read
 * inside the text's box, column by column, as the rebuild reads a line's
 * ground), else the slide's ground colour. So text rebuilt in the colour of its
 * ground shows, and so does text whose card or panel the rebuild did not make.
 */
function runContrast(slide: SlideSourceV1, picture: RgbaImageV1 | null, texts: SourceObjectV1[], kept: (o: SourceObjectV1) => boolean): { min: number; low: number; runs: number } {
  const sx = picture ? picture.width / slide.width : 1;
  const sy = picture ? picture.height / slide.height : 1;
  let min = Number.POSITIVE_INFINITY;
  let low = 0;
  let runs = 0;
  for (const o of texts) {
    const cx = o.box.x + o.box.w / 2;
    const cy = o.box.y + o.box.h / 2;
    const under = slide.objects
      .filter((u) => u !== o && u.kind !== 'text' && kept(u) && cx >= u.box.x && cx <= u.box.x + u.box.w && cy >= u.box.y && cy <= u.box.y + u.box.h)
      .pop();
    let ground = slide.background.color?.hex;
    if (under?.kind === 'shape' && under.fill?.hex) ground = under.fill.hex;
    else if (under?.kind === 'pic' && picture) ground = lineInkColourOf(picture, { x: o.box.x * sx, y: o.box.y * sy, w: o.box.w * sx, h: o.box.h * sy })?.ground ?? ground;
    if (!ground) continue;
    for (const para of o.text?.paras ?? []) {
      for (const run of para.runs) {
        const hex = run.color?.hex;
        if (!hex || !run.text.trim()) continue;
        const ratio = contrastRatio(hex, ground);
        runs++;
        min = Math.min(min, ratio);
        if (ratio < MIN_CONTRAST) low++;
      }
    }
  }
  return { min: runs ? min : Number.NaN, low, runs };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const deck = args.find((a) => !a.startsWith('--'));
  const transcriptArg = args.find((a) => a.startsWith('--transcript='))?.slice('--transcript='.length);
  const scope = args.find((a) => a.startsWith('--scope='))?.slice('--scope='.length) ?? 'page';
  const emphasisArg = args.find((a) => a.startsWith('--emphasis='))?.slice('--emphasis='.length);
  const emphasis = emphasisArg ? readEmphasis(emphasisArg) : null;
  const json = args.includes('--json');
  if (!deck || !transcriptArg || (scope !== 'page' && scope !== 'regions')) {
    process.stderr.write('Usage: node scripts/rebrand-picture-eval.ts <deck> --transcript=<json> [--scope=page|regions] [--json]\n');
    return 1;
  }
  const transcript = readTranscript(transcriptArg);
  const runner = await nodeFlattenedOcr();
  if (!runner.ok) {
    process.stderr.write(`${runner.message}\n`);
    return 2;
  }
  const cacheFile = args.find((a) => a.startsWith('--ocr-cache='))?.slice('--ocr-cache='.length);
  const cache = new Map<string, OcrLine[]>();
  if (cacheFile && existsSync(cacheFile)) {
    const held: unknown = JSON.parse(readFileSync(cacheFile, 'utf8'));
    if (held && typeof held === 'object') for (const [key, lines] of Object.entries(held)) if (Array.isArray(lines)) cache.set(key, lines);
  }
  let calls = 0;
  let hits = 0;
  /** The recogniser, answered from the cache when the same crop was read before. */
  const read: FlattenedOcrV1 = async (frame, region) => {
    calls++;
    if (!cacheFile) return runner.ocr(frame, region);
    const key = createHash('sha256').update(`${frame.width}x${frame.height}|`).update(frame.data).digest('hex');
    const known = cache.get(key);
    if (known) {
      hits++;
      return known.map((line) => ({ ...line, box: { ...line.box } }));
    }
    const lines = await runner.ocr(frame, region);
    cache.set(key, lines);
    return lines;
  };
  // The regions reading is the page reading's own fallback: a recogniser that
  // refuses the whole slide.
  const ocr: FlattenedOcrV1 = scope === 'regions'
    ? async (frame, region) => {
      if (region.id === 'page') throw new Error('whole-slide reading is off for this run');
      return read(frame, region);
    }
    : read;

  const bytes = new Uint8Array(readFileSync(deck));
  const started = performance.now();
  const planned = await planDeck({
    bytes,
    name: path.basename(deck),
    parseXml: parsePipelineXml,
    system: STARTER_DESIGN_SYSTEM,
    instanceId: 'picture-eval',
    ocr,
    ocrModel: runner.model,
  });
  const totalMs = performance.now() - started;
  if (cacheFile) writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(cache)));
  const planObjects = new Map<string, ObjectPlanV1>();
  for (const slide of planned.plan.slides) for (const o of slide.objects) planObjects.set(o.id, o);
  const censusClass = new Map(planned.census.objects.map((o) => [o.id, o.hypothesis.class] as const));
  const removed = (id: string): boolean => {
    const row = planObjects.get(id);
    return (row?.decision ?? row?.proposal) === 'remove';
  };
  const markBox = Object.values(transcript.commonMarks ?? {})[0]?.box;

  const rows: SlideRow[] = [];
  for (const [index, slide] of planned.source.slides.entries()) {
    const truth = transcript.slides[index];
    if (!truth) continue;
    const report = planned.flattened.find((f) => f.slideId === slide.id);
    const texts = slide.objects.filter((o) => o.kind === 'text');
    const titleText = texts.filter((o) => o.roleEstimate === 'title').map(textOf).join(' ');
    const censusTitle = texts.filter((o) => censusClass.get(o.id) === 'title').map(textOf).join(' ');
    const bodyText = texts.filter((o) => censusClass.get(o.id) !== 'title' && !removed(o.id)).map(textOf).join(' ');
    const bodyTruth = truth.body.flatMap(words);
    const found = words(bodyText);
    const content = [
      ...truth.body,
      ...truth.items.map((i) => `${i.label ?? ''} ${(i.cells ?? [i.text]).join(' ')}`),
      ...(truth.columns ?? []),
      ...truth.callouts,
      truth.title,
    ].flatMap(words);
    const units = unitsOf(slide);
    const pics = slide.objects.filter((o) => o.kind === 'pic' && o.origin === 'raster-region' && !removed(o.id));
    const recovery = slide.recovery ? planned.media.get(slide.recovery.assetRef) : undefined;
    const picture = recovery ? await decodePipelinePicture(recovery.bytes, recovery.mime) : null;
    let mark: SlideRow['mark'] = 'missing';
    if (markBox) {
      const area = markBox[2] * markBox[3];
      // Over the mark: sharing half of the smaller of the two, so a logo set
      // just above the mark is not taken for it and a crop drawing it is.
      const over = slide.objects.filter((o) => {
        const f = frac(o, slide);
        return overlap(f, markBox) >= 0.5 * Math.min(area, f[2] * f[3]);
      });
      // Where the rebuild read the mark itself (the objects over it proposed for
      // removal), a crop is checked over that box, so a logo drawn just above
      // the mark is not taken for the mark's own letters.
      const read = over.filter((o) => removed(o.id)).map((o) => frac(o, slide));
      const stamp: Frac = read.length
        ? [Math.min(...read.map((f) => f[0])), Math.min(...read.map((f) => f[1])), Math.max(...read.map((f) => f[0] + f[2])) - Math.min(...read.map((f) => f[0])), Math.max(...read.map((f) => f[1] + f[3])) - Math.min(...read.map((f) => f[1]))]
        : markBox;
      const shows: boolean[] = [];
      for (const o of over) shows.push(!removed(o.id) && !(await paintedOut(o, slide, stamp, picture, planned.media)));
      if (shows.some(Boolean)) mark = 'kept';
      else if (over.length) mark = 'removed';
    }
    const credited = creditCrops(pics.map((o) => frac(o, slide)), truth.pictures.map((p) => p.box));
    const contrast = runContrast(slide, picture, texts.filter((o) => !removed(o.id)), (o) => !removed(o.id));
    const allFound = words(texts.filter((o) => !removed(o.id)).map(textOf).join(' '));
    const kept = texts.filter((o) => !removed(o.id));
    const labelled = emphasis?.slides.find((one) => one.slide === truth.slide);
    const plain = emphasis?.plain?.includes(truth.slide) === true;
    const truthText = [truth.title, ...truth.body, ...truth.items.map((i) => `${i.label ?? ''} ${(i.cells ?? [i.text]).join(' ')}`), ...(truth.columns ?? []), ...truth.callouts].join(' ');
    rows.push({
      slide: truth.slide,
      titleRebuilt: trigramContainment(truth.title, titleText),
      titleCensus: trigramContainment(truth.title, censusTitle),
      titleEdit: editSimilarity(truth.title, censusTitle),
      titleExact: normalise(truth.title) === normalise(censusTitle),
      bodyWords: bodyTruth.length,
      bodyHit: matchedWords(bodyTruth, found),
      foundWords: allFound.length,
      foundHit: matchedWords(allFound, content),
      minContrast: contrast.min,
      lowRuns: contrast.low,
      runs: contrast.runs,
      items: units.cards + units.rows,
      itemsTruth: truth.items.length,
      structureMatch: unitKinds(units) === transcriptKinds(truth.structure ?? ''),
      mark,
      crops: pics.length,
      picturesTruth: truth.pictures.length,
      picturesTight: credited.filter((c) => c.tight).length,
      pictureCover: credited.map((c) => c.cover),
      containers: units.containers.length,
      containersRemoved: units.containers.filter((id) => removed(id)).length,
      structure: structureOf(units, pics.length, texts.length),
      structureTruth: truth.structure ?? '',
      ms: report?.ms ?? 0,
      panels: units.panels,
      emphasis: labelled || plain ? emphasisOf(kept, labelled?.spans ?? []) : null,
      typography: typographyOf(truthText, kept.map(textOf).join(' ')),
      angled: slide.warnings.some((w) => /at an angle/.test(w.message)),
    });
  }

  const sum = (f: (r: SlideRow) => number): number => rows.reduce((n, r) => n + f(r), 0);
  const overall = {
    scope,
    slides: rows.length,
    censusTitlesOver90: rows.filter((r) => r.titleCensus > 0.9).length,
    censusTitlesExact: rows.filter((r) => r.titleExact).length,
    titleEditMean: sum((r) => r.titleEdit) / Math.max(1, rows.length),
    rebuiltTitlesOver90: rows.filter((r) => r.titleRebuilt > 0.9).length,
    bodyRecall: sum((r) => r.bodyHit) / Math.max(1, sum((r) => r.bodyWords)),
    bodyPrecision: sum((r) => r.foundHit) / Math.max(1, sum((r) => r.foundWords)),
    insertedWords: sum((r) => r.foundWords - r.foundHit),
    lowPrecisionSlides: rows.filter((r) => r.foundWords > 0 && r.foundHit / r.foundWords < 0.9).map((r) => r.slide),
    lowContrastRuns: sum((r) => r.lowRuns),
    runs: sum((r) => r.runs),
    lowContrastSlides: rows.filter((r) => r.lowRuns > 0).map((r) => r.slide),
    marksRemoved: rows.filter((r) => r.mark === 'removed').length,
    picturesTight: sum((r) => r.picturesTight),
    pictures: sum((r) => r.picturesTruth),
    slidesWithPicture: rows.filter((r) => r.picturesTruth > 0).length,
    slidesWithTightCrop: rows.filter((r) => r.picturesTruth > 0 && r.picturesTight > 0).length,
    structureMismatches: rows.filter((r) => !r.structureMatch).map((r) => r.slide),
    containers: sum((r) => r.containers),
    containersRemoved: sum((r) => r.containersRemoved),
    panels: rows.filter((r) => r.panels > 0).map((r) => r.slide),
    emphasisSpans: sum((r) => r.emphasis?.spans ?? 0),
    emphasisFound: sum((r) => r.emphasis?.found ?? 0),
    emphasisStyled: sum((r) => r.emphasis?.styled ?? 0),
    emphasisStray: sum((r) => r.emphasis?.stray ?? 0),
    emphasisStraySlides: rows.filter((r) => (r.emphasis?.stray ?? 0) > 0).map((r) => r.slide),
    typographic: sum((r) => r.typography.marks),
    typographicKept: sum((r) => r.typography.typographic),
    typographicPlain: sum((r) => r.typography.plain),
    typographicExtra: sum((r) => r.typography.extra),
    angledSlides: rows.filter((r) => r.angled).map((r) => r.slide),
    totalMs: Math.round(totalMs),
    ocrCalls: calls,
    ocrCacheHits: hits,
  };
  if (json) {
    process.stdout.write(`${JSON.stringify({ overall, rows }, null, 2)}\n`);
    return 0;
  }
  const pct = (n: number): string => (Number.isFinite(n) ? n.toFixed(2) : '-');
  const lines = [
    '| slide | title (census) | edit | exact | rebuilt title | body recall | precision | inserted | contrast (low runs) | items | structure | mark | tight crops (cover) | containers kept | structure read | transcript | emphasis (stray) | quotes and dashes | ms |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => [
      r.slide,
      pct(r.titleCensus),
      pct(r.titleEdit),
      r.titleExact ? 'yes' : 'no',
      pct(r.titleRebuilt),
      `${r.bodyWords ? pct(r.bodyHit / r.bodyWords) : '-'} (${r.bodyHit}/${r.bodyWords})`,
      r.foundWords ? pct(r.foundHit / r.foundWords) : '-',
      r.foundWords - r.foundHit,
      `${pct(r.minContrast)} (${r.lowRuns}/${r.runs})`,
      `${r.items}/${r.itemsTruth}`,
      r.structureMatch ? 'match' : 'differs',
      r.mark,
      `${r.picturesTight}/${r.picturesTruth} (${r.pictureCover.map((c) => c.toFixed(2)).join(' ') || '-'})`,
      `${r.containers - r.containersRemoved}/${r.containers}`,
      `${r.structure}${r.panels ? ` +panel` : ''}${r.angled ? ' +angled text kept' : ''}`,
      r.structureTruth,
      r.emphasis ? `${r.emphasis.styled}/${r.emphasis.spans} (${r.emphasis.stray})` : '-',
      r.typography.marks || r.typography.extra ? `${r.typography.typographic}/${r.typography.marks} typographic, ${r.typography.plain} plain, ${r.typography.extra} extra` : '-',
      Math.round(r.ms),
    ].join(' | ')).map((line) => `| ${line} |`),
    '',
    `scope ${overall.scope}: census titles over 0.9 ${overall.censusTitlesOver90}/${overall.slides}, exact ${overall.censusTitlesExact}/${overall.slides}, mean edit similarity ${pct(overall.titleEditMean)} (rebuilt title estimate over 0.9 ${overall.rebuiltTitlesOver90}/${overall.slides}); body recall ${pct(overall.bodyRecall)}, precision ${pct(overall.bodyPrecision)} (under 0.9 on slides ${overall.lowPrecisionSlides.join(', ') || 'none'}), ${overall.insertedWords} inserted words; ${overall.lowContrastRuns}/${overall.runs} runs under ${MIN_CONTRAST}:1 (slides ${overall.lowContrastSlides.join(', ') || 'none'}); marks removed ${overall.marksRemoved}/${overall.slides}; pictures cropped tight ${overall.picturesTight}/${overall.pictures}, slides with a tight crop ${overall.slidesWithTightCrop}/${overall.slidesWithPicture}; structure differs on slides ${overall.structureMismatches.join(', ') || 'none'}; containers kept ${overall.containers - overall.containersRemoved}/${overall.containers}; panels holding the title on slides ${overall.panels.join(', ') || 'none'}; ${emphasis ? `emphasis spans styled ${overall.emphasisStyled}/${overall.emphasisSpans} (found ${overall.emphasisFound}), ${overall.emphasisStray} letters set apart elsewhere (slides ${overall.emphasisStraySlides.join(', ') || 'none'}); ` : ''}quotes and dashes typographic ${overall.typographicKept}/${overall.typographic}, plain ${overall.typographicPlain}, extra ${overall.typographicExtra}; angled text kept with its reason on slides ${overall.angledSlides.join(', ') || 'none'}; ${overall.totalMs} ms; ${overall.ocrCalls} recogniser calls (${(overall.ocrCalls / Math.max(1, overall.slides)).toFixed(1)} a slide)${cacheFile ? `, ${overall.ocrCacheHits} from the cache, so the time is not the recogniser's` : ''}`,
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

process.exitCode = await main();
