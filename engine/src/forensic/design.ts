// SPDX-License-Identifier: MPL-2.0
/**
 * Verify pages from a Design document's authored geometry (plan 291, W1).
 *
 * The forensic layout rules read `ForensicPage` lines and shapes. For an export
 * those come from decoded pixels or a PDF's text layer; for a Design document they
 * come straight from the rows, method `source-geometry`, so a photo can never be
 * read as a false eyebrow and nothing needs OCR. One page per artboard (`frame`
 * row), in the order the structure check lists artboards, with coordinates made
 * local to the artboard.
 *
 * Where a row leaves a field out, the renderer's own default applies
 * (`textCss` and `radiusFor` in `community/design/hooks.js`): size 48, padding 8,
 * line height 1.12, centred, middle, and a corner radius only on a `rounded` or
 * `pill` shape. Line boxes are estimates: wraps are worked out from an average
 * glyph width, and shrink-to-fit text is read at its authored size. The coverage
 * entries record the estimate, and a page whose text could not all be read is marked
 * incomplete rather than read as clean.
 *
 * Every line and shape box is recorded in `refs` against the layer ids it came
 * from. The forensic rules and `forensicReport` keep those box objects by
 * reference, so a finding's location leads back to its layers.
 *
 * Pure: no DOM, no clock, no network.
 */
import { parseColorToSrgb8 } from '../css-color.ts';
import { parseDesignText } from '../design-text.ts';
import {
  FORENSIC_VERSION,
  type ForensicBox,
  type ForensicCoverage,
  type ForensicLine,
  type ForensicPage,
  type ForensicShape,
} from './types.ts';

/** What a line or shape box on a Design page came from. */
export interface DesignForensicRef {
  /** The layer ids: one for a text line, the panel and then its strip for a card. */
  layerIds: string[];
  /** The artboard the page was built from, absent for a document without artboards. */
  artboardId?: string;
  kind: 'line' | 'shape';
}

export interface DesignForensicOptions {
  /** The Design `textDocument` input, for boxes whose words live in a composed story. */
  textDocument?: unknown;
  /** Resolves a `{token.path}` reference or a `var(--name)` to a CSS colour, or null. */
  resolveColor?: (value: string) => string | null;
  /** Most pages to build, 1 to 100 (the forensic report's own ceiling). Default 100. */
  pageCap?: number;
  /** Page size for a document with no artboards. Default: the extent of its rows. */
  width?: number;
  height?: number;
}

export interface DesignForensicPages {
  pages: ForensicPage[];
  /** The artboard id of each page, by index; empty string for a document without artboards. */
  artboardIds: string[];
  refs: WeakMap<ForensicBox, DesignForensicRef>;
  coverage: ForensicCoverage[];
}

type Row = Record<string, unknown>;

/** Renderer defaults, `textCss` in community/design/hooks.js. */
export const DESIGN_TEXT_DEFAULTS = {
  fontSize: 48,
  pad: 8,
  lineHeight: 1.12,
  align: 'center',
  valign: 'middle',
} as const;

/** Average advance of one character, as a share of the font size. */
const GLYPH_WIDTH = 0.55;
/** Confidence of an estimated line; the eyebrow rule needs at least 0.6. */
const LINE_CONFIDENCE = 0.9;
/** Text whose geometry is not known (a composed story, a rotated row): read, never measured. */
const TEXT_ONLY_CONFIDENCE = 0.5;
const EDGE_TOLERANCE = 3;
const STRIP_SHARE = 0.15;
const PAGE_LIMIT = 100;
const LINE_LIMIT = 10_000;
const SHAPE_LIMIT = 1000;
const TEXT_LIMIT = 65_536;
const NOT_DRAWN = new Set(['frame', 'audio', 'camera', '3d', 'web']);

const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
function num(value: unknown, fallback: number): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const truthy = (v: unknown): boolean => v === true || v === 'true' || v === 1 || v === '1';

/** Corner radius as the renderer draws it: only `rounded` uses the field, a pill is half its short side. */
export function designCornerRadius(row: Row): number {
  const shape = str(row.shape);
  const w = num(row.w, 0);
  const h = num(row.h, 0);
  if (shape === 'rounded') return Math.max(0, num(row.radius, 0));
  if (shape === 'pill') return Math.min(w, h) / 2;
  return 0;
}

/** The words of each composed story, keyed by its first frame's box id. Null when the document is unreadable. */
function storyText(input: unknown): Map<string, string> | null {
  let doc: unknown = input;
  if (typeof input === 'string') {
    if (!input.trim()) return new Map();
    try {
      doc = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (doc === undefined || doc === null) return new Map();
  if (!record(doc) || !Array.isArray(doc.stories)) return null;
  const out = new Map<string, string>();
  for (const story of doc.stories) {
    if (!record(story) || typeof story.source !== 'string' || !Array.isArray(story.frameIds)) continue;
    const first = story.frameIds.find((id): id is string => typeof id === 'string');
    // U+FFFC holds an inline object (an emoji, an icon): it draws no word.
    if (first) out.set(first, story.source.replace(/￼/g, ''));
  }
  return out;
}

/** Longest paint value read as a colour; anything longer is not one. */
const MAX_PAINT_LENGTH = 256;

interface Paint {
  rgb: [number, number, number];
  alpha: number;
  hex: string;
}

function paintOf(value: unknown, resolve?: (value: string) => string | null): Paint | null {
  let raw = str(value).trim();
  if (!raw && record(value) && typeof value.ref === 'string') raw = value.ref;
  // No colour value is this long; the bound also keeps every pattern below cheap.
  if (!raw || raw.length > MAX_PAINT_LENGTH) return null;
  if (/^\{[^{}]+\}$/.test(raw)) {
    const resolved = resolve?.(raw);
    if (!resolved || resolved.length > MAX_PAINT_LENGTH) return null;
    raw = resolved;
  }
  // One quantifier per stretch of input: `\s*` around the fallback would overlap
  // `[^)]*` and backtrack cubically on an unclosed `var(--a,` and a run of spaces.
  // The fallback is trimmed below instead.
  const variable = /^var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,([^)]*\)?))?\)$/.exec(raw);
  if (variable) {
    const resolved = resolve?.(`var(${variable[1]})`) ?? variable[2]?.trim();
    if (!resolved) return null;
    raw = resolved;
  }
  const c = parseColorToSrgb8(raw);
  if (!c) return null;
  const hex = `#${c
    .slice(0, 3)
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
  return { rgb: [c[0], c[1], c[2]], alpha: c[3], hex };
}

const saturated = (p: Paint): boolean => Math.max(...p.rgb) - Math.min(...p.rgb) >= 60;

interface Placed {
  row: Row;
  id: string;
  index: number;
  box: ForensicBox;
  rotated: boolean;
}

interface Estimate {
  lines: Array<{ text: string; box: ForensicBox }>;
  size: number;
}

/** Greedy word wrap at an average glyph width, the way the box's text would break. */
function wrap(text: string, chars: number): string[] {
  if (text.length <= chars) return [text];
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/(\s+)/)) {
    if (!word) continue;
    if (line && (line + word).trimEnd().length > chars && word.trim()) {
      out.push(line.trimEnd());
      line = word.trimStart();
    } else line += word;
  }
  if (line.trim()) out.push(line.trimEnd());
  return out.length ? out : [text];
}

/** The text a row draws, as source lines (one per `\n`), with list numbers kept and markup taken out. */
function drawnLines(row: Row, text: string): string[] {
  if (truthy(row.plainText)) return text.replace(/\r\n?/g, '\n').split('\n');
  return parseDesignText(text).map((line) => {
    const words = line.runs.map((run) => run.text).join('');
    return line.list === 'number' ? `${line.number}. ${words}` : words;
  });
}

function estimateLines(row: Row, box: ForensicBox, text: string): Estimate {
  const size = Math.max(1, Math.round(num(row.fontSize, DESIGN_TEXT_DEFAULTS.fontSize)));
  const lineHeight = clamp(num(row.lineHeight, DESIGN_TEXT_DEFAULTS.lineHeight), 0.5, 4);
  const pad = Math.round(clamp(num(row.pad, DESIGN_TEXT_DEFAULTS.pad), 0, 400));
  const align = ['left', 'center', 'right'].includes(str(row.align)) ? str(row.align) : DESIGN_TEXT_DEFAULTS.align;
  const valign = ['top', 'middle', 'bottom'].includes(str(row.valign)) ? str(row.valign) : DESIGN_TEXT_DEFAULTS.valign;
  const inner = Math.max(1, box.width - 2 * pad);
  const advance = size * GLYPH_WIDTH;
  const chars = Math.max(1, Math.floor(inner / advance));
  const visual = drawnLines(row, text).flatMap((line) => (line.trim() ? wrap(line, chars) : ['']));
  const pitch = size * lineHeight;
  const block = visual.length * pitch;
  const top =
    valign === 'top' ? box.y + pad : valign === 'bottom' ? box.y + box.height - pad - block : box.y + (box.height - block) / 2;
  const lines: Estimate['lines'] = [];
  visual.forEach((line, i) => {
    const words = line.trim();
    if (!words) return;
    const width = Math.min(inner, line.length * advance);
    const x =
      align === 'left' ? box.x + pad : align === 'right' ? box.x + box.width - pad - width : box.x + (box.width - width) / 2;
    lines.push({ text: words, box: { x, y: top + i * pitch, width, height: pitch } });
  });
  return { lines, size };
}

/** A strip on one edge of a rounded panel, or null. Edges are checked on all four sides. */
function accentOf(
  panel: Placed,
  strip: Placed,
  stripRadius: number
): { edge: 'left' | 'top' | 'right' | 'bottom'; width: number } | null {
  const p = panel.box;
  const s = strip.box;
  const t = EDGE_TOLERANCE;
  const across = (a0: number, a1: number, b0: number, b1: number): boolean =>
    Math.abs(a0 - b0) < t && Math.abs(a1 - b1) < t;
  const horizontal = across(s.x, s.width, p.x, p.width);
  const vertical = across(s.y, s.height, p.y, p.height);
  const above = strip.index > panel.index;
  // A strip painted over the panel inside one edge.
  if (above) {
    if (horizontal && s.y <= p.y + t && s.y + s.height > p.y && s.y + s.height < p.y + p.height * STRIP_SHARE)
      return { edge: 'top', width: s.y + s.height - Math.max(s.y, p.y) };
    if (
      horizontal &&
      s.y + s.height >= p.y + p.height - t &&
      s.y < p.y + p.height &&
      s.y > p.y + p.height * (1 - STRIP_SHARE)
    )
      return { edge: 'bottom', width: Math.min(s.y + s.height, p.y + p.height) - s.y };
    if (vertical && s.x <= p.x + t && s.x + s.width > p.x && s.x + s.width < p.x + p.width * STRIP_SHARE)
      return { edge: 'left', width: s.x + s.width - Math.max(s.x, p.x) };
    if (
      vertical &&
      s.x + s.width >= p.x + p.width - t &&
      s.x < p.x + p.width &&
      s.x > p.x + p.width * (1 - STRIP_SHARE)
    )
      return { edge: 'right', width: Math.min(s.x + s.width, p.x + p.width) - s.x };
    return null;
  }
  // A rounded strip painted under the panel and showing past one edge (a shifted backing card).
  if (stripRadius <= 0) return null;
  if (horizontal && Math.abs(s.y + s.height - p.y - p.height) < t && p.y - s.y > 0 && p.y - s.y < p.height * STRIP_SHARE)
    return { edge: 'top', width: p.y - s.y };
  if (horizontal && Math.abs(s.y - p.y) < t && s.y + s.height - p.y - p.height > 0 && s.y + s.height - p.y - p.height < p.height * STRIP_SHARE)
    return { edge: 'bottom', width: s.y + s.height - p.y - p.height };
  if (vertical && Math.abs(s.x + s.width - p.x - p.width) < t && p.x - s.x > 0 && p.x - s.x < p.width * STRIP_SHARE)
    return { edge: 'left', width: p.x - s.x };
  if (vertical && Math.abs(s.x - p.x) < t && s.x + s.width - p.x - p.width > 0 && s.x + s.width - p.x - p.width < p.width * STRIP_SHARE)
    return { edge: 'right', width: s.x + s.width - p.x - p.width };
  return null;
}

const union = (a: ForensicBox, b: ForensicBox): ForensicBox => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

/**
 * Build one Verify page per artboard from a Design `boxes` value, by source
 * geometry. Hidden rows, fully transparent rows and rows wholly outside their
 * artboard are left out. A document without artboards becomes one page.
 */
export function designForensicPages(boxes: unknown, opts: DesignForensicOptions = {}): DesignForensicPages {
  const refs = new WeakMap<ForensicBox, DesignForensicRef>();
  const coverage: ForensicCoverage[] = [];
  const rows = Array.isArray(boxes) ? boxes.filter(record) : [];
  if (!Array.isArray(boxes)) {
    coverage.push({
      collector: 'pages',
      state: 'failed',
      reason: 'The document has no boxes array to read.',
      version: FORENSIC_VERSION,
    });
    return { pages: [], artboardIds: [], refs, coverage };
  }
  const indexed = rows.map((row, index) => ({ row, index, id: str(row.id) }));
  const frames = indexed
    .filter((r) => r.row.kind === 'frame')
    .sort(
      (a, b) =>
        num(a.row.order, a.index) - num(b.row.order, b.index) ||
        num(a.row.x, 0) - num(b.row.x, 0) ||
        a.id.localeCompare(b.id)
    );
  const stories = storyText(opts.textDocument);
  const cap = Math.round(clamp(num(opts.pageCap, PAGE_LIMIT), 1, PAGE_LIMIT));

  type Group = { artboardId: string; origin: { x: number; y: number }; width: number; height: number; clip: boolean; members: typeof indexed };
  const groups: Group[] = [];
  if (frames.length) {
    for (const frame of frames)
      groups.push({
        artboardId: frame.id,
        origin: { x: num(frame.row.x, 0), y: num(frame.row.y, 0) },
        width: Math.max(0, num(frame.row.w, 0)),
        height: Math.max(0, num(frame.row.h, 0)),
        clip: true,
        members: indexed.filter((r) => r.row.kind !== 'frame' && r.id && str(r.row.frame) === frame.id),
      });
  } else {
    const members = indexed.filter((r) => r.row.kind !== 'frame');
    const extentW = members.reduce((m, r) => Math.max(m, num(r.row.x, 0) + num(r.row.w, 0)), 0);
    const extentH = members.reduce((m, r) => Math.max(m, num(r.row.y, 0) + num(r.row.h, 0)), 0);
    groups.push({
      artboardId: '',
      origin: { x: 0, y: 0 },
      width: Math.max(0, num(opts.width, extentW)),
      height: Math.max(0, num(opts.height, extentH)),
      clip: false,
      members,
    });
  }
  if (groups.length > cap)
    coverage.push({
      collector: 'pages',
      state: 'partial',
      reason: `Only the first ${cap} of ${groups.length} artboards were read.`,
      version: FORENSIC_VERSION,
    });
  else
    coverage.push({
      collector: 'pages',
      state: 'completed',
      reason: `${groups.length} ${groups.length === 1 ? 'page' : 'pages'} built from the document's artboards.`,
      version: FORENSIC_VERSION,
    });

  const pages: ForensicPage[] = [];
  const artboardIds: string[] = [];
  for (const [n, group] of groups.slice(0, cap).entries()) {
    const pageId = String(n + 1);
    const artboardRef = group.artboardId ? { artboardId: group.artboardId } : {};
    const notes: string[] = [];
    let complete = true;
    const placed: Placed[] = [];
    for (const { row, index, id } of group.members) {
      if (truthy(row.hidden) || NOT_DRAWN.has(str(row.kind))) continue;
      if (num(row.opacity, 100) <= 0) continue;
      const box: ForensicBox = {
        x: num(row.x, 0) - group.origin.x,
        y: num(row.y, 0) - group.origin.y,
        width: Math.max(0, num(row.w, 0)),
        height: Math.max(0, num(row.h, 0)),
      };
      if (
        group.clip &&
        (box.x >= group.width || box.y >= group.height || box.x + box.width <= 0 || box.y + box.height <= 0)
      )
        continue;
      placed.push({ row, id, index, box, rotated: num(row.rot, 0) % 360 !== 0 });
    }

    // Lines: every row that draws words, in reading order (rows top to bottom, then
    // left to right), each row's lines kept together so its sentences stay whole.
    const lines: ForensicLine[] = [];
    let rotatedShapes = false;
    let estimatedFit = false;
    const reading = [...placed].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x || a.index - b.index);
    for (const item of reading) {
      const { row } = item;
      let text = '';
      let confidence = LINE_CONFIDENCE;
      if (str(row.textStory)) {
        const story = stories?.get(item.id);
        if (story === undefined) {
          complete = false;
          if (!notes.includes('story')) notes.push('story');
          continue;
        }
        text = story;
        // A story carries its own type sizes, so its lines are read but never measured.
        confidence = TEXT_ONLY_CONFIDENCE;
      } else text = str(row.text);
      if (!text.trim()) continue;
      if (item.rotated) confidence = TEXT_ONLY_CONFIDENCE;
      if (truthy(row.fitText)) estimatedFit = true;
      const estimate = estimateLines(str(row.textStory) ? { ...row, plainText: true } : row, item.box, text);
      for (const line of estimate.lines) {
        const forensic: ForensicLine = { text: line.text, box: line.box, size: estimate.size, confidence };
        refs.set(line.box, { layerIds: [item.id], ...artboardRef, kind: 'line' });
        lines.push(forensic);
      }
    }
    // The forensic page budget: whole lines only, so every kept line is in the page text.
    const kept: ForensicLine[] = [];
    let length = 0;
    for (const line of lines) {
      const add = line.text.length + (kept.length ? 1 : 0);
      if (kept.length >= LINE_LIMIT || length + add > TEXT_LIMIT) {
        complete = false;
        notes.push('lines');
        break;
      }
      length += add;
      line.index = kept.length;
      kept.push(line);
    }
    const text = kept.map((l) => l.text).join('\n');

    // Shapes: a rounded, opaque panel with a thin saturated strip along one edge.
    const shapes: ForensicShape[] = [];
    const panels: Array<{ item: Placed; radius: number; fill: Paint }> = [];
    const strips: Array<{ item: Placed; radius: number; paint: Paint }> = [];
    for (const item of placed) {
      const { row } = item;
      const kind = str(row.kind) || 'box';
      if (item.rotated) {
        if (kind === 'box' || kind === 'path') rotatedShapes = true;
        continue;
      }
      if (kind === 'box') {
        const fill = paintOf(row.bg, opts.resolveColor);
        if (!fill || fill.alpha <= 0) continue;
        const radius = designCornerRadius(row);
        if (radius > 0 && fill.alpha >= 0.99 && item.box.width >= 60 && item.box.height >= 40)
          panels.push({ item, radius, fill });
        if (saturated(fill)) strips.push({ item, radius, paint: fill });
      } else if (kind === 'path') {
        // A straight rule drawn along an edge: a thin path box with a stroke.
        const stroke = paintOf(row.stroke, opts.resolveColor);
        const weight = num(row.strokeW, 0);
        if (!stroke || weight <= 0 || !saturated(stroke)) continue;
        const b = item.box;
        if (b.height <= Math.max(2, weight))
          strips.push({ item: { ...item, box: { x: b.x, y: b.y + b.height / 2 - weight / 2, width: b.width, height: weight } }, radius: 0, paint: stroke });
        else if (b.width <= Math.max(2, weight))
          strips.push({ item: { ...item, box: { x: b.x + b.width / 2 - weight / 2, y: b.y, width: weight, height: b.height } }, radius: 0, paint: stroke });
      }
    }
    for (const panel of panels)
      for (const strip of strips) {
        if (shapes.length >= SHAPE_LIMIT) break;
        if (strip.item.id === panel.item.id || strip.paint.hex === panel.fill.hex) continue;
        const accent = accentOf(panel.item, strip.item, strip.radius);
        if (!accent || accent.width <= 0) continue;
        const box = union(panel.item.box, strip.item.box);
        refs.set(box, { layerIds: [panel.item.id, strip.item.id], ...artboardRef, kind: 'shape' });
        shapes.push({ box, radius: panel.radius, fill: panel.fill.hex, accent: { ...accent, colour: strip.paint.hex } });
      }
    if (shapes.length >= SHAPE_LIMIT) notes.push('shapes');

    const page: ForensicPage = {
      id: pageId,
      width: group.width,
      height: group.height,
      text,
      source: 'digital',
      complete,
      lines: kept,
      shapes,
      layoutMethod: 'source-geometry',
    };
    pages.push(page);
    artboardIds.push(group.artboardId);
    const reasons = [
      'Line boxes are estimated from the authored geometry with the renderer defaults; font metrics are not measured.',
      ...(estimatedFit ? ['Shrink-to-fit text is read at its authored size.'] : []),
      ...(notes.includes('story') ? ['A composed text story could not be read, so this page is incomplete.'] : []),
      ...(rotatedShapes ? ['Rotated shapes were not read as cards.'] : []),
      ...(notes.includes('lines') ? ['The page holds more text than one forensic page reads.'] : []),
      ...(notes.includes('shapes') ? ['Only the first 1000 cards were read.'] : []),
    ];
    coverage.push({
      collector: 'design-geometry',
      page: pageId,
      state: complete && !rotatedShapes && !notes.includes('shapes') ? 'completed' : 'partial',
      reason: reasons.join(' '),
      version: FORENSIC_VERSION,
    });
  }
  return { pages, artboardIds, refs, coverage };
}
