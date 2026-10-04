// SPDX-License-Identifier: MPL-2.0
/**
 * content-inventory.ts - what a source deck says, slide by slide, for an agent
 * that has to rebuild the deck (plan 291 W2). `lolly read`, the `lolly_read` MCP tool
 * and the fidelity family of `lolly check` all read this one projection.
 *
 * It is a projection of the rebrand reader and census, not a second reader:
 * `inventoryFromSource(source, census, opts)` takes the `SourceDeckV1` and the
 * `DeckCensusV1` that `readDeck` already produced and returns a
 * `ContentInventoryV1` (`@lolly-tools/core/content-inventory-v1`). Per slide it
 * keeps the text frames in reading order, each with a role, its runs and a
 * normalised plain string; the speaker notes with paragraphs and line breaks
 * kept apart; the pictures by content hash with their kind; tables and charts as
 * data; and every object with its census class, so decoration can be told from
 * content.
 *
 * Roles come from the placeholder, then the census class, then a few plain
 * rules over the text itself: a short line in capitals or a lone number is a
 * `label` (an eyebrow, a step marker), a citation ("Source:", "Figure 3:") or
 * small print is a `caption`, and text set entirely in an icon font is `other`,
 * because its letters are a glyph name rather than copy.
 *
 * What the source does not show stays out of `text` and `pictures` (a Photoshop
 * layer switched off), listed under `objects` with `hidden` and counted in a
 * warning; a PDF's invisible text, a scan's OCR layer, is kept and marked hidden.
 * A slide the source marks flattened is one picture of its text, and says so in
 * a `slide-flattened` warning with its OCR state, so an empty `text` list is not
 * read as an empty slide. A drawing reports its SVG (`opts.vectors`), with the
 * raster stand-in as `fallbackRef`. Text is folded out of the Latin ligature block.
 *
 * Pure and deterministic: no DOM, no filesystem, no clock, no hashing. The host
 * supplies what needs I/O through `opts`: the media facts (hash, size, pixel
 * size, written file), the structured notes the pptx reader keeps
 * (`PptxReadSlide.notesParas`) and picture crops by object id.
 */

import {
  CONTENT_INVENTORY_VERSION,
  INVENTORY_SOURCE_KINDS,
  type ContentInventoryV1,
  type DeckCensusV1,
  type InventoryBoxV1,
  type InventoryChartV1,
  type InventoryCropV1,
  type InventoryMediaV1,
  type InventoryNotesV1,
  type InventoryObjectV1,
  type InventoryParagraphV1,
  type InventoryPictureKindV1,
  type InventoryPictureV1,
  type InventoryRunV1,
  type InventorySlideV1,
  type InventorySourceKindV1,
  type InventoryTableV1,
  type InventoryTextRoleV1,
  type InventoryTextV1,
  type ObjectClassV1,
  type SlideSourceV1,
  type SourceDeckV1,
  type SourceObjectV1,
  type SourceParaV1,
  type SourceRunV1,
} from '@lolly-tools/core';

/** One distinct picture file the host read, keyed in `opts.media` by its media ref. */
export interface InventoryMediaInputV1 {
  /** Lower-case hex SHA-256 of the bytes. */
  sha256: string;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  /** Where the host wrote the bytes, when it wrote them. */
  file?: string;
}

/** A notes paragraph as the pptx reader keeps it: runs, with `a:br` as a `\n` run. */
export interface InventoryNotesParaInputV1 {
  runs: ReadonlyArray<{ text: string }>;
}

export interface InventoryFromSourceOptsV1 {
  /** The file name; the source's own name, then `source`, when absent. */
  name?: string;
  /** Lower-case hex SHA-256 of the source bytes; read from `source.source.hash` when absent. */
  sha256?: string;
  /** Size of the source file; `source.source.bytes` when absent. */
  bytes?: number;
  /** Every media ref the source draws, with its facts. A picture whose ref is missing here is left out with a warning. */
  media: ReadonlyMap<string, InventoryMediaInputV1>;
  /**
   * Speaker notes as paragraphs, by slide position. Absent for a slide (or
   * altogether) when the reader kept only the flat string: the notes then arrive
   * as one paragraph, because a paragraph end and a line break read the same.
   */
  notesParas?: ReadonlyArray<ReadonlyArray<InventoryNotesParaInputV1> | undefined>;
  /** Picture crops (pptx `a:srcRect`) by source object id. */
  crops?: ReadonlyMap<string, InventoryCropV1>;
  /** Host warnings to carry, after the reader's own. */
  warnings?: ReadonlyArray<{ code: string; message: string }>;
  /**
   * The drawing itself for each `vector` object, by source object id: a media ref
   * (present in `media`) for the SVG the source carries beside its raster stand-in.
   * Such a picture reports the SVG, and the raster as its `fallbackRef`.
   */
  vectors?: ReadonlyMap<string, string>;
  /** A rendered thumbnail per slide, by slide position, when the host drew them. */
  thumbnails?: ReadonlyArray<{ file: string; width: number; height: number } | undefined>;
}

/** A picture under this share of the slide is an icon, the census's own threshold for an `icon` layout unit. */
const ICON_AREA_SHARE = 0.05;
/** A JPEG over this share of the slide is a photo. */
const PHOTO_AREA_SHARE = 0.25;
/** Any other picture over this share of the slide is the slide's background. */
const BACKGROUND_AREA_SHARE = 0.6;
/** A label is short: an eyebrow, a step marker, a tag. */
const LABEL_MAX_WORDS = 6;
/** Text whose largest run is under this many points reads as small print. */
const CAPTION_MAX_PT = 10;
/** Small print is short; a long run of small text is still body copy. */
const CAPTION_MAX_WORDS = 20;
/** The slide size when a source states none, in reference px. */
const DEFAULT_SLIDE = { width: 960, height: 540 };

/**
 * A citation: the lead word, an optional figure number, then a colon or a spaced
 * dash. A headline that only starts with the word ("Data is how we lose the
 * exit", "Data-driven", "Notes from the field") has no such mark, so it stays body.
 */
const CAPTION_LEAD = /^(?:sources?|notes?|fig(?:ure)?s?\.?|data|citation|credits?|(?:photo|image)(?:\s+credits?)?)(?:\s+\d+[a-z]?)?\s*(?::|[-\u2013\u2014]\s)/i;
/** A citation set larger than this is a statement, not small print. */
const CAPTION_LEAD_MAX_PT = 18;
/** The Latin ligature block (U+FB00 to U+FB06) a PDF's text often carries. */
const LIGATURES = /[\uFB00-\uFB06]/g;
const URL_ONLY = /^(?:https?:\/\/|www\.)\S+$/i;
const NUMBER_MARKER = /^(?:\d{1,3}|[ivx]{1,5})[.):]?$/i;
/** Fonts whose letters are glyph names: `east` in Material Icons draws an arrow. */
const ICON_FONT = /material\s*(?:icons|symbols)|font\s*awesome|fontawesome|glyphicons|icomoon|ionicons|feather|remix\s*icon|bootstrap\s*icons|segoe\s*(?:mdl2|fluent)\s*(?:assets|icons)|wingdings|webdings|^symbol$/i;
const HEX = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i;

/** Weight a face name states, or undefined when it states none. */
export function weightOfFace(face: string | undefined): number | undefined {
  const s = face ?? '';
  if (/thin|hairline/i.test(s)) return 100;
  if (/extra[\s-]*light|ultra[\s-]*light/i.test(s)) return 200;
  if (/semi[\s-]*bold|demi[\s-]*bold/i.test(s)) return 600;
  if (/extra[\s-]*bold|ultra[\s-]*bold/i.test(s)) return 800;
  if (/black|heavy/i.test(s)) return 900;
  if (/bold/i.test(s)) return 700;
  if (/medium/i.test(s)) return 500;
  if (/light/i.test(s)) return 300;
  if (/regular|normal|book/i.test(s)) return 400;
  return undefined;
}

const round = (n: number): number => Math.round(n * 1e6) / 1e6;

function fractionBox(box: { x: number; y: number; w: number; h: number }, width: number, height: number): InventoryBoxV1 {
  return {
    x: round(box.x / width),
    y: round(box.y / height),
    width: round(Math.max(0, box.w) / width),
    height: round(Math.max(0, box.h) / height),
  };
}

/** Share of the slide the box covers, clipped to the slide. */
function areaShare(box: { x: number; y: number; w: number; h: number }, width: number, height: number): number {
  const w = Math.max(0, Math.min(box.x + box.w, width) - Math.max(box.x, 0));
  const h = Math.max(0, Math.min(box.y + box.h, height) - Math.max(box.y, 0));
  return (w * h) / (width * height);
}

function sha256Of(hash: string): string {
  const hex = hash.replace(/^sha256:/i, '').toLowerCase();
  return /^[0-9a-f]{64}$/.test(hex) ? hex : '';
}

function sourceKind(kind: string): InventorySourceKindV1 {
  if ((INVENTORY_SOURCE_KINDS as readonly string[]).includes(kind)) return kind as InventorySourceKindV1;
  throw new TypeError(`inventoryFromSource reads a pptx, pdf or psd source deck, not ${kind}.`);
}

function themeFace(font: string | undefined, theme: SourceDeckV1['theme']): string | undefined {
  if (!font) return undefined;
  if (!font.startsWith('+')) return font;
  if (/^\+mj/i.test(font)) return theme?.majorFont;
  if (/^\+mn/i.test(font)) return theme?.minorFont;
  return undefined;
}

/**
 * Ligatures folded to their letters (`\uFB01` to `fi`), so copied text and a search
 * for "office" both work. Only that block: a full NFKC would change other characters.
 */
export function foldLigatures(text: string): string {
  return text.replace(LIGATURES, (c) => c.normalize('NFKC'));
}

function projectRun(run: SourceRunV1, theme: SourceDeckV1['theme']): InventoryRunV1 {
  const out: InventoryRunV1 = { text: foldLigatures(run.text) };
  if (run.bold) out.bold = true;
  if (run.italic) out.italic = true;
  const hex = run.color?.hex ? HEX.exec(run.color.hex) : null;
  if (hex) out.color = `#${hex[1]!.toLowerCase()}`;
  const font = themeFace(run.font, theme);
  if (font) out.font = font;
  const faceWeight = weightOfFace(font);
  const weight = run.bold ? Math.max(faceWeight ?? 0, 700) : faceWeight;
  if (weight !== undefined) out.weight = weight;
  if (typeof run.sizePt === 'number' && Number.isFinite(run.sizePt) && run.sizePt >= 0) out.size = run.sizePt;
  return out;
}

const paraText = (para: SourceParaV1): string => para.runs.map((r) => r.text).join('');

/** Paragraphs with styling-only empty runs dropped and blank paragraphs trimmed off both ends. */
function projectParas(paras: readonly SourceParaV1[], theme: SourceDeckV1['theme']): InventoryParagraphV1[] {
  let start = 0;
  let end = paras.length;
  while (start < end && paraText(paras[start]!).trim() === '') start++;
  while (end > start && paraText(paras[end - 1]!).trim() === '') end--;
  return paras.slice(start, end).map((para) => {
    const out: InventoryParagraphV1 = { runs: para.runs.filter((r) => r.text !== '').map((r) => projectRun(r, theme)) };
    if (typeof para.lvl === 'number' && para.lvl > 0) out.lvl = Math.min(8, Math.floor(para.lvl));
    if (para.bullet === 'bullet') out.bullet = true;
    else if (para.bullet === 'number') out.bullet = 'number';
    if (para.align) out.align = para.align;
    return out;
  });
}

/** Lines with runs of spaces folded and ends trimmed, blank lines off both ends. */
function normaliseLines(text: string): string[] {
  const lines = foldLigatures(text).replace(/\r\n?|\v|\u2028|\u2029/g, '\n').split('\n').map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim());
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start] === '') start++;
  while (end > start && lines[end - 1] === '') end--;
  return lines.slice(start, end);
}

function plainOf(paragraphs: readonly InventoryParagraphV1[]): string {
  return normaliseLines(paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n')).join('\n');
}

function largestPt(object: SourceObjectV1): number {
  let max = 0;
  for (const para of object.text?.paras ?? []) for (const run of para.runs) max = Math.max(max, run.sizePt ?? 0);
  return max;
}

/** Every run that carries letters is drawn in capitals, by its text or by its `case`. */
function allCaps(object: SourceObjectV1): boolean {
  let letters = false;
  for (const para of object.text?.paras ?? []) {
    for (const run of para.runs) {
      if (!/\p{L}/u.test(run.text)) continue;
      letters = true;
      if (run.case === 'upper') continue;
      if (run.text !== run.text.toUpperCase()) return false;
    }
  }
  return letters;
}

function iconFontOnly(object: SourceObjectV1, theme: SourceDeckV1['theme']): boolean {
  let seen = false;
  for (const para of object.text?.paras ?? []) {
    for (const run of para.runs) {
      if (run.text.trim() === '') continue;
      const face = themeFace(run.font, theme);
      if (!face || !ICON_FONT.test(face)) return false;
      seen = true;
    }
  }
  return seen;
}

/** The role a text frame plays: placeholder first, then the census class, then the text itself. */
function roleOf(object: SourceObjectV1, klass: ObjectClassV1 | undefined, plain: string, theme: SourceDeckV1['theme']): InventoryTextRoleV1 {
  if (iconFontOnly(object, theme)) return 'other';
  switch (object.placeholder) {
    case 'title':
    case 'ctrTitle':
      return 'title';
    case 'subTitle':
      return 'subtitle';
    case 'sldNum':
      return 'page-number';
    case 'ftr':
    case 'dt':
      return 'footer';
    default:
      break;
  }
  switch (klass) {
    case 'title':
      return 'title';
    case 'subtitle':
      return 'subtitle';
    case 'page-number':
      return 'page-number';
    case 'footer':
    case 'date':
      return 'footer';
    case 'template-furniture':
      return 'label';
    case 'recurring-text':
      return 'caption';
    case 'decoration':
    case 'logo-candidate':
    case 'known-logo':
      return 'other';
    default:
      break;
  }
  const words = plain.split(/\s+/).filter(Boolean).length;
  if (plain.split('\n').length === 1 && NUMBER_MARKER.test(plain)) return 'label';
  if (words > 0 && words <= LABEL_MAX_WORDS && plain.split('\n').length <= 2 && allCaps(object)) return 'label';
  if (words > 0 && words <= CAPTION_MAX_WORDS && plain.split('\n').length <= 2) {
    const pt = largestPt(object);
    if (URL_ONLY.test(plain)) return 'caption';
    if (CAPTION_LEAD.test(plain) && pt <= CAPTION_LEAD_MAX_PT) return 'caption';
    if (pt > 0 && pt < CAPTION_MAX_PT) return 'caption';
  }
  return 'body';
}

function pictureKind(
  object: SourceObjectV1,
  klass: ObjectClassV1 | undefined,
  iconUnit: boolean,
  slide: { width: number; height: number },
  flattened: boolean,
): InventoryPictureKindV1 {
  if (klass === 'logo-candidate' || klass === 'known-logo') return 'logo';
  if (klass === 'photo') return 'photo';
  const share = areaShare(object.box, slide.width, slide.height);
  if (iconUnit || share < ICON_AREA_SHARE) return 'icon';
  if (/^image\/jpe?g$/i.test(object.mediaMime ?? '') && share >= PHOTO_AREA_SHARE) return 'photo';
  // A slide that is one picture of itself: the page picture is the content, not a ground.
  if (share >= BACKGROUND_AREA_SHARE) return flattened ? 'picture' : 'background';
  return 'picture';
}

/** What an OCR state means for the text of a slide that is one picture. */
const OCR_SAYS: Record<string, string> = {
  'not-run': 'the text was not read (OCR not run)',
  unavailable: 'the text was not read (OCR unavailable here)',
  'no-text-found': 'OCR found no text in it',
  'text-found': 'its text was read by OCR',
};

/**
 * The warning for a slide the source marks flattened: its text is pixels, so an
 * empty `text` list does not mean an empty slide.
 */
function flattenedWarning(slide: SlideSourceV1, number: number): { code: string; message: string } {
  const ocr = slide.ocr?.state ?? 'not-run';
  const says = OCR_SAYS[ocr] ?? `OCR state ${ocr}`;
  const message = slide.recovery
    ? `Slide ${number} was one picture of its text and was rebuilt from its regions; ${says}.`
    : `Slide ${number} is one picture of its text, kept as that picture; ${says}.`;
  return { code: 'slide-flattened', message };
}

/** Why a picture's bytes were not stored, in words. */
function unavailableWhy(reason: string | undefined): string {
  if (reason === 'media-missing') return 'its picture part is missing from the file';
  if (reason === 'media-too-large') return 'its picture is over the size the reader stores';
  return reason ? `its picture was not stored (${reason})` : 'its picture was not stored';
}

function projectNotes(slide: SlideSourceV1, paras: ReadonlyArray<InventoryNotesParaInputV1> | undefined): InventoryNotesV1 | null {
  let paragraphs: Array<{ lines: string[] }>;
  if (paras && paras.length > 0) {
    paragraphs = paras.map((p) => ({ lines: foldLigatures(p.runs.map((r) => r.text).join('')).replace(/\r\n?|\v/g, '\n').split('\n') }));
  } else if (slide.notes) {
    paragraphs = [{ lines: foldLigatures(slide.notes).split('\n') }];
  } else {
    return null;
  }
  // The edges are trimmed as the reader trims its flat string: blank paragraphs
  // and blank lines off both ends, then the outer whitespace. Inside, a blank line
  // is kept, because the speaker left it there.
  const blank = (p: { lines: string[] }): boolean => p.lines.every((l) => l.trim() === '');
  while (paragraphs.length > 0 && blank(paragraphs[0]!)) paragraphs.shift();
  while (paragraphs.length > 0 && blank(paragraphs[paragraphs.length - 1]!)) paragraphs.pop();
  if (paragraphs.length === 0) return null;
  const first = paragraphs[0]!;
  while (first.lines.length > 1 && first.lines[0]!.trim() === '') first.lines.shift();
  first.lines[0] = first.lines[0]!.trimStart();
  const last = paragraphs[paragraphs.length - 1]!;
  while (last.lines.length > 1 && last.lines[last.lines.length - 1]!.trim() === '') last.lines.pop();
  last.lines[last.lines.length - 1] = last.lines[last.lines.length - 1]!.trimEnd();
  // `text` is the authoring form a Design artboard's notes take (plan 291 M4): a blank
  // line between paragraphs, a newline for a line break inside one, and a line of one
  // no-break space (U+00A0) for an empty line inside one. `paragraphs` is the exact form.
  const inside = (p: { lines: string[] }): string => p.lines.map((l, k) => (l.trim() === '' && k > 0 && k < p.lines.length - 1 ? '\u00a0' : l)).join('\n');
  return { text: paragraphs.map(inside).join('\n\n'), paragraphs };
}

/**
 * Project a read source deck and its census into a content inventory. Pure: the
 * same source, census and options always give identical inventory bytes.
 */
export function inventoryFromSource(source: SourceDeckV1, census: DeckCensusV1, opts: InventoryFromSourceOptsV1): ContentInventoryV1 {
  const kind = sourceKind(source.source.kind);
  const classOf = new Map<string, ObjectClassV1>();
  for (const entry of census.objects) classOf.set(entry.id, entry.hypothesis.class);
  const iconUnits = new Set<string>();
  for (const layout of census.layouts) for (const unit of layout.units ?? []) if (unit.kind === 'icon') iconUnits.add(unit.id);

  const warnings: Array<{ code: string; message: string }> = source.warnings.map((w) => ({ code: w.code, message: w.message }));
  const first = source.slides[0];
  const deckSize = first && first.width > 0 && first.height > 0 ? { width: first.width, height: first.height } : DEFAULT_SLIDE;

  const slides: InventorySlideV1[] = source.slides.map((slide, position) => {
    const number = position + 1;
    const size = slide.width > 0 && slide.height > 0 ? { width: slide.width, height: slide.height } : deckSize;
    const flattened = slide.origin.flattened === true;
    if (flattened) warnings.push(flattenedWarning(slide, number));
    for (const w of slide.warnings) warnings.push({ code: w.code, message: `Slide ${number}: ${w.message}` });
    const readingPos = new Map<string, number>();
    for (const [i, id] of slide.readingOrder.entries()) readingPos.set(id, i);
    const byReading = [...slide.objects].sort((a, b) => {
      const ra = readingPos.get(a.id) ?? Number.POSITIVE_INFINITY;
      const rb = readingPos.get(b.id) ?? Number.POSITIVE_INFINITY;
      return ra === rb ? 0 : ra < rb ? -1 : 1;
    });

    // A hidden object (a Photoshop layer switched off, invisible text) is not what
    // the slide shows, so it stays out of text and pictures and is listed only under
    // objects. A PDF's invisible text is the exception: on a scanned page it is the
    // OCR layer, the only text the page has, so it is kept and marked hidden.
    let hiddenLeftOut = 0;
    let hiddenTextKept = 0;
    const keepsHiddenText = kind === 'pdf';

    const text: InventoryTextV1[] = [];
    for (const object of byReading) {
      if (!object.text || object.table !== undefined) continue;
      if (object.hidden && !(keepsHiddenText && object.kind === 'text')) {
        hiddenLeftOut++;
        continue;
      }
      const paragraphs = projectParas(object.text.paras, source.theme);
      const plain = plainOf(paragraphs);
      if (plain === '') continue;
      const klass = classOf.get(object.id);
      const entry: InventoryTextV1 = {
        objectId: object.id,
        role: roleOf(object, klass, plain, source.theme),
        class: klass ?? 'unknown',
        box: fractionBox(object.box, size.width, size.height),
        paragraphs,
        plain,
      };
      const reading = readingPos.get(object.id) ?? object.readingIndex;
      if (typeof reading === 'number') entry.readingIndex = reading;
      if (object.hidden) {
        entry.hidden = true;
        hiddenTextKept++;
      }
      text.push(entry);
    }

    const pictures: InventoryPictureV1[] = [];
    const background = slide.background.media;
    if (background) {
      const media = opts.media.get(background);
      if (media) {
        pictures.push(withFacts<InventoryPictureV1>({
          objectId: `${slide.id}#background`, ref: background, sha256: media.sha256, mime: media.mime, bytes: media.bytes,
          box: { x: 0, y: 0, width: 1, height: 1 }, kind: 'background', class: 'decoration',
        }, media));
      } else {
        warnings.push({ code: 'media-unknown', message: `Slide ${number}: the background picture ${background} was not read, so it is left out.` });
      }
    }
    for (const object of slide.objects) {
      if (object.kind !== 'pic' && object.kind !== 'vector') continue;
      if (object.hidden) {
        hiddenLeftOut++;
        continue;
      }
      // A drawing reports its SVG; the raster stand-in the source carries with the SVG is its fallback.
      const drawing = object.kind === 'vector' ? opts.vectors?.get(object.id) : undefined;
      const svg = drawing ? opts.media.get(drawing) : undefined;
      const ref = svg ? drawing! : object.media;
      if (!ref) {
        if (object.fidelity.state === 'unavailable') {
          warnings.push({
            code: 'media-unavailable',
            message: `Slide ${number}: the picture ${object.id} is left out: ${unavailableWhy(object.fidelity.reason)}.`,
          });
        }
        continue;
      }
      const media = svg ?? opts.media.get(ref);
      if (!media) {
        warnings.push({ code: 'media-unknown', message: `Slide ${number}: the picture ${object.id} draws ${ref}, which was not read, so it is left out.` });
        continue;
      }
      const klass = classOf.get(object.id);
      const picture: InventoryPictureV1 = {
        objectId: object.id, ref, sha256: media.sha256, mime: media.mime, bytes: media.bytes,
        box: fractionBox(object.box, size.width, size.height),
        kind: pictureKind(object, klass, iconUnits.has(object.id), size, flattened),
        class: klass ?? 'unknown',
      };
      if (svg && object.media && object.media !== ref && opts.media.has(object.media)) picture.fallbackRef = object.media;
      const crop = object.kind === 'pic' ? opts.crops?.get(object.id) : undefined;
      if (crop && Object.keys(crop).length > 0) picture.crop = { ...crop };
      if (object.alt) picture.alt = object.alt;
      pictures.push(withFacts(picture, media));
    }

    const tables: InventoryTableV1[] = [];
    const charts: InventoryChartV1[] = [];
    for (const object of slide.objects) {
      if (object.hidden && (object.table || object.chartData || object.kind === 'chart')) {
        hiddenLeftOut++;
        continue;
      }
      if (object.table) tables.push({ objectId: object.id, rows: object.table.map((row) => row.map(foldLigatures)) });
      if (object.chartData || object.kind === 'chart') {
        const chart: InventoryChartV1 = { objectId: object.id };
        if (object.chartData?.type) chart.type = object.chartData.type;
        if (object.chartData?.categories) chart.categories = [...object.chartData.categories];
        if (object.chartData?.series) {
          chart.series = object.chartData.series.map((s) => (s.name === undefined ? { values: [...s.values] } : { name: s.name, values: [...s.values] }));
        }
        charts.push(chart);
      }
    }
    if (hiddenLeftOut > 0) {
      warnings.push({
        code: 'hidden-left-out',
        message: `Slide ${number}: ${hiddenLeftOut === 1 ? 'one hidden object is' : `${hiddenLeftOut} hidden objects are`} left out of text and pictures, as the source does not show ${hiddenLeftOut === 1 ? 'it' : 'them'}; ${hiddenLeftOut === 1 ? 'it is' : 'they are'} still listed under objects.`,
      });
    }
    if (hiddenTextKept > 0) {
      warnings.push({
        code: 'hidden-text-kept',
        message: `Slide ${number}: ${hiddenTextKept === 1 ? 'one line of text is' : `${hiddenTextKept} lines of text are`} invisible on the page, as a scan's OCR layer is; ${hiddenTextKept === 1 ? 'that line is' : 'they are'} listed as text with hidden set.`,
      });
    }

    const objects: InventoryObjectV1[] = slide.objects.map((object) => {
      const entry: InventoryObjectV1 = { id: object.id, kind: object.kind, class: classOf.get(object.id) ?? 'unknown' };
      if (object.hidden) entry.hidden = true;
      return entry;
    });
    const out: InventorySlideV1 = {
      number,
      id: slide.id,
      text,
      notes: projectNotes(slide, opts.notesParas?.[position]),
      pictures,
      tables,
      charts,
      objects,
    };
    if (slide.origin.layoutName) out.layoutName = slide.origin.layoutName;
    const thumbnail = opts.thumbnails?.[position];
    if (thumbnail) out.thumbnail = { file: thumbnail.file, width: Math.round(thumbnail.width), height: Math.round(thumbnail.height) };
    return out;
  });

  const media: InventoryMediaV1[] = [...opts.media].map(([ref, facts]) => withFacts<InventoryMediaV1>({ ref, sha256: facts.sha256, mime: facts.mime, bytes: facts.bytes }, facts));
  for (const w of opts.warnings ?? []) warnings.push({ code: w.code, message: w.message });

  const sha256 = opts.sha256 ?? sha256Of(source.source.hash);
  const inventory: ContentInventoryV1 = {
    version: CONTENT_INVENTORY_VERSION,
    source: {
      name: opts.name ?? source.source.name ?? 'source',
      sha256,
      bytes: opts.bytes ?? source.source.bytes ?? 0,
      kind,
      slides: slides.length,
      width: deckSize.width,
      height: deckSize.height,
    },
    slides,
    media,
    warnings,
  };
  if (source.source.title) inventory.source.title = source.source.title;
  return inventory;
}

/** Carry the optional pixel size and written file onto a picture or media entry. */
function withFacts<T extends { width?: number; height?: number; file?: string }>(entry: T, facts: InventoryMediaInputV1): T {
  if (typeof facts.width === 'number' && facts.width >= 1) entry.width = Math.round(facts.width);
  if (typeof facts.height === 'number' && facts.height >= 1) entry.height = Math.round(facts.height);
  if (facts.file) entry.file = facts.file;
  return entry;
}
