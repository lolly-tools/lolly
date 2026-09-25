// SPDX-License-Identifier: MPL-2.0
/**
 * A wireframe picture of one slide layout, for the layout choosers in Design and in
 * Rebrand (plan 274 WP 5a, plan 275 sections 2.8 and 4, decision 30).
 *
 * Pure. It reads a slide master and returns SVG markup: no DOM, no document, no theme.
 * Geometry is the master's own fractions resolved at the thumbnail size, and every fill is
 * a fixed neutral tone written into the markup, so the picture says the same thing in the
 * light theme and the dark one.
 *
 * The tones are fixed on purpose. A thumbnail is a picture of a slide, so it is content
 * the way the canvas and an export are content, and content does not invert with the app
 * chrome. A light layout is a light page with dark marks; a dark layout is a dark page
 * with light marks. The tile frame, the mark on the current tile, the name under it and
 * the panel around the grid are chrome, and they stay on tokens in the stylesheet.
 *
 * Any box takes any content (decision 30): text, a picture, a chart or a table. So a box
 * is drawn as a neutral content box, a slot with a small plus in it, and never as "the
 * picture box" or "the text box": a picture layout's slot is the same plus, and what sets
 * a picture layout apart is its arrangement (a full page, a caption under it, a split).
 * Three roles are strong enough to draw: a title is one heavy rule, a number is a
 * numeral (counted 1, 2, 3 across a layout that holds several), a quote is a pair of
 * quote marks. On top of that a layout carries the marks that say what it is for
 * (section 2.8): the cell outline round a repeated box, the rule a timeline runs on, the
 * chevrons between steps, a bullet column on an agenda, bars on a chart, lines on a
 * table and a circle for a portrait. Those marks come from the layout, not from the box,
 * so the picture of Title and chart and the picture of Title and body differ while their
 * big boxes still take the same content.
 *
 * A letter or a role name inside a 96 px tile would be too small to read and would need
 * translating in 26 languages; the marks need neither.
 */
import type {
  ArchetypeIdV1,
  ArchetypeRefV1,
  ArchetypeRoleV1,
  ArchetypeV1,
  MasterBoxV1,
  PlaceholderLayerV1,
  SlideMasterV1,
} from '@lolly-tools/core';
import { findArchetype, findFurniture } from '@lolly-tools/core';

/**
 * The class names on the markup, named once so this file and the chooser stylesheet
 * agree. They name the parts; they do not carry the colour. `dark` marks a layout whose
 * own background the master states as dark.
 */
export const THUMB_CLASS = {
  root: 'arch-thumb',
  dark: 'is-dark',
  page: 'arch-page',
  furniture: 'arch-furn',
  cell: 'arch-group',
  placeholder: 'arch-ph',
  mark: 'arch-mark',
} as const;

/** One page and the tones drawn on it. */
export interface ThumbTones {
  /** The page itself. */
  page: string;
  /** The hairline round the page, so it reads as a sheet on a tile of either theme. */
  edge: string;
  /** Master furniture: the panel, the scrim, the bar drawn behind the words. */
  furniture: string;
  /** The empty slot a placeholder stands for. */
  placeholder: string;
  /** The rules, the numeral, the plus and the layout marks. */
  mark: string;
}

/**
 * The two pages, as fixed neutrals.
 *
 * Both sets are drawn on a tile of either theme, so each page carries its own edge rather
 * than relying on the tile behind it for contrast: a dark page on a dark tile and a light
 * page on a light tile both need a line to end on.
 */
export const THUMB_TONES: { light: ThumbTones; dark: ThumbTones } = {
  light: {
    page: '#f7f8f9',
    edge: '#d5d9de',
    furniture: '#dcdfe3',
    placeholder: '#e7eaed',
    mark: '#55595f',
  },
  dark: {
    page: '#15181b',
    edge: '#2f3338',
    furniture: '#464a4f',
    placeholder: '#33373b',
    mark: '#c9ced3',
  },
};

export interface ArchetypeThumbOpts {
  /** Width in px. The height follows the master's own page ratio. */
  width?: number;
  /**
   * The library structure the layout restyles, which decides its layout marks. The
   * chooser states it (a master older than the library names none); left out, it is
   * the archetype's own `structure`, else its id.
   */
  structure?: string;
  /**
   * `none` draws the page, the furniture, the cell outlines and the boxes with nothing
   * inside them: no plus, no role glyph and no layout mark. A tile 40 px wide or less
   * (the strip's layout pill, the Auto-match tally) is too small for a mark to read,
   * and a plus that small reads as an add button. Defaults to `all`.
   */
  marks?: 'all' | 'none';
}

const DEFAULT_WIDTH = 96;

/** 16:9, for a master whose size cannot be read. */
const FALLBACK_RATIO = 0.5625;

/** A box shorter or narrower than this, in px at the thumbnail size, gets no plus: it would be a smudge. */
const PLUS_MIN_SIDE = 7;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One decimal, so the same layout at the same width is always the same string. */
function n(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const r = Math.round(value * 10) / 10;
  return String(Object.is(r, -0) ? 0 : r);
}

/** One filled rectangle. The tone travels on the element, not on a stylesheet rule. */
function rect(cls: string, fill: string, r: Rect, radius = 1): string {
  return (
    `<rect class="${cls}" fill="${fill}" x="${n(r.x)}" y="${n(r.y)}"` +
    ` width="${n(Math.max(0, r.w))}" height="${n(Math.max(0, r.h))}" rx="${n(radius)}"/>`
  );
}

/** A master fraction box at the thumbnail size. */
function place(box: MasterBoxV1, w: number, h: number): Rect {
  return { x: box.x * w, y: box.y * h, w: box.w * w, h: box.h * h };
}

function inset(r: Rect, by: number): Rect {
  return { x: r.x + by, y: r.y + by, w: r.w - by * 2, h: r.h - by * 2 };
}

function union(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: right - x, h: bottom - y };
}

// ─── role glyphs: title, number, quote ───────────────────────────────────────

/** A title is one heavy rule across its box. */
function titleMark(r: Rect, tones: ThumbTones): string {
  const box = inset(r, Math.min(Math.min(r.w, r.h) * 0.14, 3));
  if (box.w <= 0 || box.h <= 0) return '';
  const weight = Math.max(1, Math.min(box.h * 0.55, 5));
  return rect(THUMB_CLASS.mark, tones.mark, { x: box.x, y: box.y + (box.h - weight) / 2, w: box.w, h: weight }, weight / 2);
}

/** A number is a numeral: a stem with a flag and a foot, drawn like a one. */
function numberMark(r: Rect, tones: ThumbTones): string {
  const size = Math.min(r.h * 0.72, r.w * 0.9, 16);
  if (size < 4) return rect(THUMB_CLASS.mark, tones.mark, inset(r, Math.min(r.w, r.h) * 0.2), 0.5);
  const stroke = Math.max(1.1, size * 0.18);
  const x = r.x + Math.min(r.w * 0.12, 3);
  const y = r.y + (r.h - size) / 2;
  const stemX = x + size * 0.28;
  return (
    rect(THUMB_CLASS.mark, tones.mark, { x: stemX, y, w: stroke, h: size }, 0.3) +
    `<path class="${THUMB_CLASS.mark}" fill="${tones.mark}" d="M${n(stemX)} ${n(y)} L${n(stemX + stroke)} ${n(y)}` +
    ` L${n(x)} ${n(y + size * 0.3)} L${n(x)} ${n(y + size * 0.3 - stroke)} Z"/>` +
    rect(THUMB_CLASS.mark, tones.mark, { x: x + size * 0.05, y: y + size - stroke * 0.8, w: size * 0.55, h: stroke * 0.8 }, 0.3)
  );
}

/**
 * The digits 1 to 9 as strokes on a box one unit high and one wide, for a layout that
 * counts its numbers (a numbered list, steps, several figures). Drawn as paths rather
 * than set as text, so a tile needs no font and draws the same on every host.
 */
const DIGITS: readonly string[] = [
  'M0.25 0.2 L0.55 0 L0.55 1 M0.25 1 L0.85 1',
  'M0.1 0.22 C0.15 -0.05 0.9 -0.05 0.88 0.28 C0.85 0.5 0.3 0.7 0.1 1 L0.92 1',
  'M0.1 0.1 C0.4 -0.08 0.9 0 0.85 0.25 C0.8 0.45 0.5 0.47 0.4 0.47 C0.6 0.47 0.95 0.55 0.9 0.78 C0.85 1.05 0.3 1.05 0.08 0.88',
  'M0.7 1 L0.7 0 L0.05 0.68 L0.95 0.68',
  'M0.88 0 L0.2 0 L0.12 0.45 C0.4 0.33 0.92 0.38 0.9 0.7 C0.88 1.05 0.3 1.05 0.08 0.88',
  'M0.8 0.05 C0.4 0.05 0.1 0.35 0.1 0.68 C0.1 0.95 0.3 1 0.5 1 C0.75 1 0.9 0.85 0.9 0.66 C0.9 0.45 0.72 0.36 0.5 0.36 C0.3 0.36 0.12 0.48 0.1 0.62',
  'M0.08 0 L0.92 0 L0.35 1',
  'M0.5 0.46 C0.15 0.46 0.15 0 0.5 0 C0.85 0 0.85 0.46 0.5 0.46 C0.1 0.46 0.1 1 0.5 1 C0.9 1 0.9 0.46 0.5 0.46 Z',
  'M0.9 0.38 C0.88 0.55 0.72 0.64 0.5 0.64 C0.25 0.64 0.1 0.5 0.1 0.32 C0.1 0.12 0.28 0 0.5 0 C0.75 0 0.9 0.15 0.9 0.38 C0.9 0.7 0.6 0.95 0.2 0.95',
];

/**
 * The digit `digit` (1 to 9) in a number box, for a layout that counts its numbers. Past
 * nine, or in a box too small for a stroke to read, it is the lone numeral's mark.
 */
function digitMark(r: Rect, digit: number, tones: ThumbTones): string {
  const d = DIGITS[digit - 1];
  const size = Math.min(r.h * 0.72, r.w * 0.9, 16);
  if (!d || size < 6) return numberMark(r, tones);
  const stroke = Math.max(1, size * 0.14);
  const w = size * 0.6;
  const x = r.x + Math.min(r.w * 0.12, 3);
  const y = r.y + (r.h - size) / 2;
  // The unit box scaled to the glyph: every number in the path is a fraction of it.
  const path = d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_m, a: string, b: string) => `${n(x + Number(a) * w)} ${n(y + Number(b) * size)}`);
  return `<path class="${THUMB_CLASS.mark}" fill="none" stroke="${tones.mark}" stroke-width="${n(stroke)}"`
    + ` stroke-linecap="round" stroke-linejoin="round" d="${path}"/>`;
}

/** A quote is a pair of opening quote marks in the top corner of its box. */
function quoteMark(r: Rect, tones: ThumbTones): string {
  const s = Math.min(r.h * 0.4, r.w * 0.2, 8);
  if (s < 3) return '';
  const x = r.x + Math.min(r.w * 0.08, 4);
  const y = r.y + Math.min(r.h * 0.15, 4);
  const one = (cx: number): string =>
    `<circle class="${THUMB_CLASS.mark}" fill="${tones.mark}" cx="${n(cx + s * 0.3)}" cy="${n(y + s * 0.62)}" r="${n(s * 0.3)}"/>` +
    `<path class="${THUMB_CLASS.mark}" fill="${tones.mark}" d="M${n(cx + s * 0.02)} ${n(y + s * 0.6)}` +
    ` L${n(cx + s * 0.4)} ${n(y)} L${n(cx + s * 0.52)} ${n(y + s * 0.08)} L${n(cx + s * 0.34)} ${n(y + s * 0.62)} Z"/>`;
  return one(x) + one(x + s * 0.72);
}

// ─── the neutral box and the layout marks ────────────────────────────────────

/** Any content goes here: a small plus in the middle of the slot. */
function contentMark(r: Rect, tones: ThumbTones): string {
  if (Math.min(r.w, r.h) < PLUS_MIN_SIDE) return '';
  const arm = Math.max(2, Math.min(Math.min(r.w, r.h) * 0.28, 5));
  const bar = Math.max(0.9, arm * 0.3);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return (
    rect(THUMB_CLASS.mark, tones.mark, { x: cx - arm, y: cy - bar / 2, w: arm * 2, h: bar }, bar / 2) +
    rect(THUMB_CLASS.mark, tones.mark, { x: cx - bar / 2, y: cy - arm, w: bar, h: arm * 2 }, bar / 2)
  );
}

/** A head and shoulders in a circle: the portrait of a person. */
function portraitMark(r: Rect, tones: ThumbTones): string {
  const d = Math.min(r.w, r.h) * 0.8;
  if (d < 6) return contentMark(r, tones);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return `<circle class="${THUMB_CLASS.mark}" fill="none" stroke="${tones.mark}" stroke-width="1" cx="${n(cx)}" cy="${n(cy)}" r="${n(d / 2)}"/>`
    + `<circle class="${THUMB_CLASS.mark}" fill="${tones.mark}" cx="${n(cx)}" cy="${n(cy - d * 0.1)}" r="${n(d * 0.16)}"/>`;
}

/** Rising bars on a base line: what a chart layout holds. */
function barMarks(r: Rect, tones: ThumbTones): string {
  const box = inset(r, Math.min(Math.min(r.w, r.h) * 0.16, 4));
  if (box.w <= 4 || box.h <= 4) return contentMark(r, tones);
  const heights = [0.45, 0.7, 0.55, 0.9];
  const gap = box.w * 0.08;
  const bw = (box.w - gap * (heights.length - 1)) / heights.length;
  let out = '';
  heights.forEach((share, i) => {
    const bh = box.h * share;
    out += rect(THUMB_CLASS.mark, tones.mark, { x: box.x + i * (bw + gap), y: box.y + box.h - bh, w: bw, h: bh }, 0.5);
  });
  return out;
}

/** Rows and one column rule, which is what a table layout holds. */
function tableMarks(r: Rect, tones: ThumbTones): string {
  const box = inset(r, Math.min(Math.min(r.w, r.h) * 0.12, 3));
  if (box.w <= 0 || box.h <= 0) return '';
  const rows = 3;
  const weight = Math.max(0.8, Math.min(box.h / (rows * 3), 2));
  let out = '';
  for (let i = 0; i < rows; i += 1) {
    const y = box.y + (box.h - weight) * (i / (rows - 1));
    out += rect(THUMB_CLASS.mark, tones.mark, { x: box.x, y, w: box.w, h: weight }, weight / 2);
  }
  return out + rect(
    THUMB_CLASS.mark,
    tones.mark,
    { x: box.x + box.w * 0.38, y: box.y, w: weight, h: box.h },
    weight / 2
  );
}

/** A column of bullet dots with a short rule beside each: an agenda. */
function bulletMarks(r: Rect, tones: ThumbTones): string {
  const box = inset(r, Math.min(Math.min(r.w, r.h) * 0.14, 3));
  if (box.w <= 6 || box.h <= 6) return contentMark(r, tones);
  const rows = 4;
  const slot = box.h / rows;
  const dot = Math.max(0.9, Math.min(slot * 0.22, 2));
  let out = '';
  for (let i = 0; i < rows; i += 1) {
    const cy = box.y + slot * (i + 0.5);
    out += `<circle class="${THUMB_CLASS.mark}" fill="${tones.mark}" cx="${n(box.x + dot)}" cy="${n(cy)}" r="${n(dot)}"/>`;
    const weight = Math.max(0.9, Math.min(slot * 0.3, 2.2));
    out += rect(THUMB_CLASS.mark, tones.mark, { x: box.x + dot * 3.5, y: cy - weight / 2, w: box.w * (i === rows - 1 ? 0.45 : 0.7), h: weight }, weight / 2);
  }
  return out;
}

/** A small chevron pointing right, centred on a point. */
function chevron(cx: number, cy: number, size: number, tones: ThumbTones): string {
  const s = size / 2;
  const t = Math.max(0.8, size * 0.28);
  return `<path class="${THUMB_CLASS.mark}" fill="${tones.mark}" d="M${n(cx - s * 0.6)} ${n(cy - s)} L${n(cx - s * 0.6 + t)} ${n(cy - s)}` +
    ` L${n(cx + s * 0.6)} ${n(cy)} L${n(cx - s * 0.6 + t)} ${n(cy + s)} L${n(cx - s * 0.6)} ${n(cy + s)} L${n(cx + s * 0.6 - t)} ${n(cy)} Z"/>`;
}

// ─── what a layout is for ────────────────────────────────────────────────────

const CHART_LAYOUTS = new Set(['chart', 'chart-and-callout', 'callout-and-chart', 'charts-2', 'dashboard']);
const TABLE_LAYOUTS = new Set(['table', 'table-and-text']);
const AGENDA_LAYOUTS = new Set(['agenda', 'agenda-two-column']);
const PORTRAIT_LAYOUTS = /^(team-|profile$|quote-portrait$)/;
const STRIP_ROLES = new Set<ArchetypeRoleV1>(['label', 'caption', 'attribution', 'subtitle']);

/**
 * The mark inside one box: a role glyph, else the layout's mark for this box, else the
 * neutral plus. `count` is the box's place among the layout's numbers, 1 first, when it
 * holds more than one; 0 for a lone number.
 */
function boxMark(structure: string, ph: PlaceholderLayerV1, r: Rect, tones: ThumbTones, count: number): string {
  const role: ArchetypeRoleV1 = ph.role;
  if (role === 'title') return titleMark(r, tones);
  if (role === 'number') return count > 0 ? digitMark(r, count, tones) : numberMark(r, tones);
  if (role === 'quote') return quoteMark(r, tones);
  if (role === 'visual' && PORTRAIT_LAYOUTS.test(structure)) return portraitMark(r, tones);
  if (role === 'data' && TABLE_LAYOUTS.has(structure)) return tableMarks(r, tones);
  if (role === 'data' && CHART_LAYOUTS.has(structure)) return barMarks(r, tones);
  if (role === 'data' && ph.kind === 'table') return tableMarks(r, tones);
  if (role === 'body' && AGENDA_LAYOUTS.has(structure)) return bulletMarks(r, tones);
  // A short line of words (a label over a box, a caption, a byline, a subtitle) is a
  // strip, not a box: a plus in every one made a grid of boxes read as a grid of pluses.
  if (STRIP_ROLES.has(role)) return '';
  return contentMark(r, tones);
}

/** The outline round each repeated cell, and the chevrons between steps. */
function cellMarks(archetype: ArchetypeV1, structure: string, w: number, h: number, tones: ThumbTones): string {
  const cells = new Map<string, Rect[]>();
  for (const ph of archetype.placeholders) {
    if (!ph.group) continue;
    const list = cells.get(ph.group) ?? [];
    list.push(place(ph.box, w, h));
    cells.set(ph.group, list);
  }
  const outlines = [...cells.values()].map(union);
  let out = '';
  for (const r of outlines) {
    const o = inset(r, -1);
    out += `<rect class="${THUMB_CLASS.cell}" fill="none" stroke="${tones.edge}" stroke-width="0.8"` +
      ` x="${n(o.x)}" y="${n(o.y)}" width="${n(o.w)}" height="${n(o.h)}" rx="1.5"/>`;
  }
  if (/^steps-\d+$/.test(structure) && outlines.length > 1) {
    const sorted = [...outlines].sort((a, b) => a.x - b.x);
    for (let i = 0; i + 1 < sorted.length; i += 1) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (!a || !b) continue;
      const gap = b.x - (a.x + a.w);
      const size = Math.max(2.5, Math.min(gap * 0.9, 5));
      out += chevron(a.x + a.w + gap / 2, a.y + Math.min(a.h * 0.2, 6), size, tones);
    }
  }
  return out;
}

/**
 * The rule a repeated layout runs on (a timeline), at the thumbnail size. A master states
 * the axis and may leave the rest to the cells, so what it leaves out is read off the
 * cells: a rule across takes their width, a rule down takes their height.
 */
function ruleRect(archetype: ArchetypeV1, w: number, h: number): Rect | null {
  const rule = archetype.repeat?.rule;
  if (!rule) return null;
  const grouped = archetype.placeholders.filter((ph) => ph.group).map((ph) => place(ph.box, w, h));
  if (grouped.length === 0) return null;
  const cells = union(grouped);
  if (rule.y !== undefined) {
    return {
      x: rule.x !== undefined ? rule.x * w : cells.x,
      y: rule.y * h,
      w: rule.w !== undefined ? rule.w * w : cells.w,
      h: Math.max(0.8, (rule.h ?? 0) * h),
    };
  }
  if (rule.x !== undefined) {
    return { x: rule.x * w, y: cells.y, w: Math.max(0.8, (rule.w ?? 0) * w), h: cells.h };
  }
  return null;
}

/**
 * One layout as SVG markup, or '' when this master has no archetype by that id.
 *
 * Paint order is the slide's own: the page, then the furniture the layout shows, then
 * the rule and the cell outlines, then its boxes, so a backdrop panel is under the
 * words here exactly as it does on the canvas.
 *
 * The layout's own background decides which of the two fixed pages it is drawn on, so a
 * dark layout reads as a dark slide under either theme.
 */
export function archetypeThumbSvg(
  master: SlideMasterV1,
  archetypeId: ArchetypeIdV1 | ArchetypeRefV1,
  opts: ArchetypeThumbOpts = {}
): string {
  const archetype = findArchetype(master, archetypeId);
  if (!archetype) return '';
  const w = Math.max(24, Math.round(opts.width ?? DEFAULT_WIDTH));
  const ratio = master.size.height / master.size.width;
  const h = Math.max(12, Math.round(w * (Number.isFinite(ratio) && ratio > 0 ? ratio : FALLBACK_RATIO)));

  const isDark = archetype.background?.dark === true;
  const tones = isDark ? THUMB_TONES.dark : THUMB_TONES.light;
  const structure = opts.structure ?? archetype.structure ?? archetype.id;

  const page = { x: 0.5, y: 0.5, w: w - 1, h: h - 1 };
  let body =
    `<rect class="${THUMB_CLASS.page}" fill="${tones.page}" stroke="${tones.edge}"` +
    ` stroke-width="1" x="${n(page.x)}" y="${n(page.y)}" width="${n(page.w)}"` +
    ` height="${n(page.h)}" rx="2"/>`;
  for (const id of archetype.furniture ?? []) {
    const piece = findFurniture(master, id);
    if (piece) body += rect(THUMB_CLASS.furniture, tones.furniture, place(piece.box, w, h));
  }
  const marked = opts.marks !== 'none';
  const rule = marked ? ruleRect(archetype, w, h) : null;
  if (rule) body += rect(THUMB_CLASS.mark, tones.mark, rule, 0.4);
  // The cell outlines stay at any size; the chevrons between steps are marks.
  body += cellMarks(archetype, marked ? structure : '', w, h, tones);
  // Several numbers count up in reading order, so a numbered list reads 1, 2, 3 and not
  // 1, 1, 1; a lone big number keeps the one numeral.
  const numbers = archetype.placeholders.filter((ph) => ph.role === 'number');
  const counted = numbers.length > 1
    ? [...numbers].sort((a, b) => (a.box.y - b.box.y) || (a.box.x - b.box.x))
    : [];
  for (const ph of archetype.placeholders) {
    const r = place(ph.box, w, h);
    body += rect(THUMB_CLASS.placeholder, tones.placeholder, r);
    if (marked) body += boxMark(structure, ph, r, tones, counted.indexOf(ph) + 1);
  }

  const cls = isDark ? `${THUMB_CLASS.root} ${THUMB_CLASS.dark}` : THUMB_CLASS.root;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 ${w} ${h}"` +
    ` width="${w}" height="${h}" aria-hidden="true">${body}</svg>`
  );
}
