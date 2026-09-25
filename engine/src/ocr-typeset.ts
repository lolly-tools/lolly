// SPDX-License-Identifier: MPL-2.0
/**
 * Typesetting recovery from OCR lines (plan 274 section 6, point 4): the lines a
 * recogniser read inside one text region in, paragraphs with reading order,
 * bullets, nesting, an estimated size and a role guess out.
 *
 * Each step is a rule over the line boxes and their text, stated where it runs:
 *
 *   - Fragments on one row join into one line first: a detector boxes large
 *     type word by word.
 *   - Reading order is a topological sort over a column graph (Breuel 2003),
 *     not an XY cut. Line `a` comes before line `b` when they share horizontal
 *     extent and `a` is higher, or when `a` lies wholly left of `b` and no third
 *     line between them vertically spans both. Ties go to the higher, then the
 *     further left line, so the order is total.
 *   - Paragraphs follow the line pitch and the left edge: a line opens a new
 *     paragraph after a gap over 1.35 pitches, at a size change, at a new left
 *     edge, or when it starts with a bullet. The pitch is the lower quartile of
 *     the gaps between neighbouring lines, so the gaps between paragraphs do not
 *     widen it.
 *   - Bullets are an isolated leading glyph before the text. A glyph the detector
 *     boxed on its own joins the line to its right whatever its size. PP-OCR
 *     reads a round bullet as `o`, `e` or nothing, so `o`, `O` and `e` count only
 *     with support: a hanging indent under the line, or another paragraph
 *     opening with a marker of the same kind at the same edge (one bullet style
 *     can come back as `o` on one line and `e` on the next). A hyphen, a dash, a
 *     star, `>` and an arrow need the same support and never count before a
 *     figure. A number or letter with `.` or `)` is a numbered item, with the
 *     same support. A paragraph whose first line starts where its bullet
 *     neighbours' text starts is a bullet whose glyph was not read.
 *   - Nesting clusters the paragraphs' marker edges within one column.
 *   - Size is an estimate: a line's box height over the height its glyph set
 *     reaches in the target face (all capitals reach the cap height, a line
 *     with `b`, `d` or `h` reaches the ascender, one with `g`, `p` or `y` also
 *     reaches below the baseline, lower case without either stays at the
 *     x-height), then the median over the paragraph. The default face ratios
 *     are a typical sans; a caller with the target face passes
 *     `OS/2.sCapHeight / unitsPerEm`. The baseline pitch is reported beside it
 *     as a cross-check, never mixed in.
 *   - Role is a guess from that estimate: a paragraph is a title when its size
 *     is a large share of the page height, or when it leads the block and is
 *     clearly larger than the rest, and never under `minTitlePx` when a caller
 *     that typesets a page's blocks apart passes the page's title size.
 *
 * Over a whole page (plan 275 WP10) the lines are first grouped into blocks by
 * `ocrTextBlocks` (one row a word space apart, or stacked on a shared edge a
 * line's gap apart, at one size, with no rule between), and each block is
 * typeset on its own.
 *
 * Pure and deterministic: no DOM, no clock, no randomness. Every output keeps
 * the index of the input line it came from, so a caller can put the evidence
 * beside the result.
 */

/** One recognised line, as `host.ocr.run` returns it (`OcrLine`). */
export interface OcrLineInputV1 {
  text: string;
  confidence: number;
  box: { x: number; y: number; w: number; h: number };
}

/** How far up and down a line's glyphs reach, read off its text. */
export type GlyphSetV1 =
  | 'caps'
  | 'ascender'
  | 'x-height'
  | 'caps-descender'
  | 'ascender-descender'
  | 'x-height-descender'
  | 'none';

export interface TypesetOptsV1 {
  /** Cap height over the em of the target face (`OS/2.sCapHeight / unitsPerEm`). Default 0.7. */
  capHeight?: number;
  /** x-height over the em. Default 0.72 of the cap height. */
  xHeight?: number;
  /** Ascender height over the em. Default 1.06 of the cap height. */
  ascender?: number;
  /** Descender depth over the em. Default 0.3 of the cap height. */
  descender?: number;
  /** Share of a box's height the detector adds around the ink. Default 0. */
  boxPadding?: number;
  /** Page height in the same units as the boxes, for the title share. */
  pageHeight?: number;
  /** A paragraph whose size is at least this share of the page height is a title. Default 0.056 (about 30 pt on a 7.5 inch slide). */
  titleShare?: number;
  /** A leading paragraph this many times the size of the rest is a title. Default 1.35. */
  titleRatio?: number;
  /** Past this many lines the column graph is skipped and lines are read top to bottom. Default 150. */
  maxLines?: number;
  /**
   * A paragraph smaller than this (in the boxes' units) is never a title,
   * whatever its share of the page. A caller that typesets the blocks of one
   * page apart passes the page's largest size over `titleRatio`, so body copy
   * set large stays body beside a larger title.
   */
  minTitlePx?: number;
}

export interface TypesetLineV1 {
  /** Index in the input of the line's first fragment. */
  index: number;
  /** Input indices of every fragment joined into this line, left to right. */
  parts: number[];
  /** The text with a recognised bullet glyph removed. */
  text: string;
  /** The text as read. */
  raw: string;
  confidence: number;
  box: { x: number; y: number; w: number; h: number };
  glyphSet: GlyphSetV1;
  /** This line's own size estimate in the boxes' units, or null when it has no letters or digits. */
  sizePx: number | null;
}

export type BulletEvidenceV1 = 'glyph' | 'glyph-and-indent' | 'repeated-glyph' | 'text-indent';

export interface TypesetParagraphV1 {
  /** Input line indices, in reading order (every fragment of every line). */
  lines: number[];
  text: string;
  box: { x: number; y: number; w: number; h: number };
  /** Column index, 0 from the left. */
  column: number;
  /** Outline level, 0-based. */
  lvl: number;
  /** `number` for a numbered or lettered item, whose marker is left out of `text`. */
  bullet: 'none' | 'bullet' | 'number';
  /** The glyph or list marker as read, when one was. */
  bulletGlyph?: string;
  bulletEvidence?: BulletEvidenceV1;
  /** Estimated size (median over the lines), or null. */
  sizePx: number | null;
  role: 'title' | 'body';
  roleEvidence: { pageShare?: number; ratioToRest?: number };
  /** Mean recognition confidence of the lines. */
  confidence: number;
  align?: 'left' | 'center' | 'right';
}

export interface TypesetBlockV1 {
  /** In reading order. */
  paragraphs: TypesetParagraphV1[];
  /** Lines after fragments on one row were joined, by first input index; lines with no text are left out. */
  lines: TypesetLineV1[];
  /** Input line indices in reading order (every fragment). */
  order: number[];
  columns: number;
  size: {
    basis: 'estimate';
    /** Median over every line with an estimate. */
    sizePx: number | null;
    samples: number;
    /** Line pitch between lines of one column (lower quartile), the cross-check. */
    pitchPx: number | null;
    capHeight: number;
  };
  /** True when the line count passed `maxLines` and the lines were read top to bottom. */
  orderFallback: boolean;
}

const DEFAULT_CAP = 0.7;
const DEFAULT_TITLE_SHARE = 0.056;
const DEFAULT_TITLE_RATIO = 1.35;
const DEFAULT_MAX_LINES = 150;
/** A gap over this many median pitches opens a paragraph. */
const PARAGRAPH_PITCH = 1.35;
/** With no pitch to go by, a gap over this many line heights opens a paragraph. */
const PARAGRAPH_HEIGHTS = 1.6;
/** Lines whose heights differ by more than this ratio are different sizes. */
const SIZE_STEP = 1.33;
/** Edges within this many median line heights are one edge. */
const EDGE_TOLERANCE = 0.5;
/** A hanging indent is at least this many line heights. */
const HANG_MIN = 0.3;

/** Fragments sharing this share of the smaller height are on one row. */
const JOIN_OVERLAP = 0.6;
/** Fragments whose heights differ by more than this ratio are different sizes. */
const JOIN_SIZE = 1.5;
/** Fragments at most this many heights apart are one line: a word space is well under one. */
const JOIN_GAP = 1.0;
/** A lone bullet glyph joins the fragment on its right across at most this many of that fragment's heights. */
const BULLET_JOIN_GAP = 2.5;
/** Bullet glyphs that mean nothing else at the start of a line. Written as escapes so the source stays plain ASCII. */
const BULLET_GLYPHS = new Set([
  '\u2022', '\u00b7', '\u25cf', '\u25cb', '\u25e6', '\u25aa', '\u25ab', '\u25a0', '\u25a1', '\u25c6', '\u25c7',
  '\u25ba', '\u25b6', '\u27a2', '\u27a4', '\u2713', '\u2714',
]);
/**
 * Marks that open a list item but also mean something as text: a hyphen, an en
 * dash, a star (a footnote), a greater-than sign and an arrow. Counted only with
 * the support the ambiguous round-bullet readings need, and never before a
 * figure (`> 50%` is a comparison, not a bullet).
 */
const SUPPORTED_BULLETS = new Set(['-', '\u2013', '*', '>', '\u2192']);
/** What a recogniser reads a round bullet as. Counted only with support. */
const AMBIGUOUS_BULLETS = new Set(['o', 'O', 'e']);
/** A list number or letter: `1.`, `12)`, `a.` or `b)`, then a space. */
const NUMBER_MARKER = /^(\d{1,3}|[a-z])([.)])\s+(?=[\p{L}\p{N}"'(])/u;

type Box = { x: number; y: number; w: number; h: number };

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function xOverlap(a: Box, b: Box): number {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
}

function cy(b: Box): number {
  return b.y + b.h / 2;
}

function unionBox(boxes: Box[]): Box {
  const first = boxes[0] ?? { x: 0, y: 0, w: 0, h: 0 };
  let x0 = first.x;
  let y0 = first.y;
  let x1 = first.x + first.w;
  let y1 = first.y + first.h;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// ─── reading order ───────────────────────────────────────────────────────────

/**
 * Reading order over boxes by a topological sort of Breuel's column graph (see
 * the module header). Returns indices into `boxes`. Past `max` boxes the graph
 * is skipped (it is cubic in the box count) and the order is top to bottom, then
 * left to right, with `fallback` set.
 */
export function readingOrderOf(boxes: Box[], max = DEFAULT_MAX_LINES): { order: number[]; fallback: boolean } {
  const n = boxes.length;
  const byPosition = (a: number, b: number): number => {
    const A = boxes[a];
    const B = boxes[b];
    if (!A || !B) return a - b;
    return A.y - B.y || A.x - B.x || a - b;
  };
  if (n > max) return { order: [...Array(n).keys()].sort(byPosition), fallback: true };
  const edges: number[][] = Array.from({ length: n }, () => []);
  const indegree = new Array<number>(n).fill(0);
  for (let a = 0; a < n; a++) {
    const A = boxes[a];
    if (!A) continue;
    for (let b = 0; b < n; b++) {
      const B = boxes[b];
      if (a === b || !B) continue;
      let before = false;
      if (xOverlap(A, B) > 0) {
        before = cy(A) < cy(B) || (cy(A) === cy(B) && A.x < B.x);
      } else if (A.x + A.w <= B.x) {
        const lo = Math.min(cy(A), cy(B));
        const hi = Math.max(cy(A), cy(B));
        before = true;
        for (let c = 0; c < n && before; c++) {
          const C = boxes[c];
          if (c === a || c === b || !C) continue;
          if (cy(C) > lo && cy(C) < hi && xOverlap(C, A) > 0 && xOverlap(C, B) > 0) before = false;
        }
      }
      if (before) {
        edges[a]?.push(b);
        indegree[b] = (indegree[b] ?? 0) + 1;
      }
    }
  }
  const done = new Uint8Array(n);
  const order: number[] = [];
  while (order.length < n) {
    let pick = -1;
    for (let i = 0; i < n; i++) {
      if (done[i] || (indegree[i] ?? 0) > 0) continue;
      if (pick < 0 || byPosition(i, pick) < 0) pick = i;
    }
    // A cycle (possible in odd layouts) is broken at the highest remaining line.
    if (pick < 0) {
      for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || byPosition(i, pick) < 0)) pick = i;
    }
    done[pick] = 1;
    order.push(pick);
    for (const next of edges[pick] ?? []) indegree[next] = (indegree[next] ?? 0) - 1;
  }
  return { order, fallback: false };
}

// ─── glyph sets and size ─────────────────────────────────────────────────────

/** How far a string's glyphs reach: see the module header. */
export function glyphSetOf(text: string): GlyphSetV1 {
  const letters = text.replace(/[^\p{L}\p{Nd}()[\]{}|/]/gu, '');
  if (letters.length === 0) return 'none';
  const full = /[()[\]{}|/]/.test(letters);
  const lowerAscender = /[bdfhklt]/.test(letters);
  const capOrDigit = /[\p{Lu}\p{Nd}]/u.test(letters) || /[i]/.test(letters);
  const descends = full || /[gjpqyQ]/.test(letters);
  const top: 'caps' | 'ascender' | 'x-height' = full || lowerAscender ? 'ascender' : capOrDigit ? 'caps' : 'x-height';
  return descends ? WITH_DESCENDER[top] : top;
}

/** A glyph set's name once the line also reaches below the baseline. */
const WITH_DESCENDER: Record<'caps' | 'ascender' | 'x-height', GlyphSetV1> = {
  caps: 'caps-descender',
  ascender: 'ascender-descender',
  'x-height': 'x-height-descender',
};

/** Height over the em a glyph set reaches in the target face. */
function reachOf(set: GlyphSetV1, opts: TypesetOptsV1): number | null {
  const cap = opts.capHeight ?? DEFAULT_CAP;
  const x = opts.xHeight ?? cap * 0.72;
  const asc = opts.ascender ?? cap * 1.06;
  const desc = opts.descender ?? cap * 0.3;
  switch (set) {
    case 'caps':
      return cap;
    case 'ascender':
      return asc;
    case 'x-height':
      return x;
    case 'caps-descender':
      return cap + desc;
    case 'ascender-descender':
      return asc + desc;
    case 'x-height-descender':
      return x + desc;
    default:
      return null;
  }
}

/** A size estimate (the em in the boxes' units) for one line, or null when its text has no letters. */
export function lineSizeEstimate(text: string, boxHeight: number, opts: TypesetOptsV1 = {}): number | null {
  const reach = reachOf(glyphSetOf(text), opts);
  if (!reach || boxHeight <= 0) return null;
  const ink = boxHeight * (1 - Math.max(0, Math.min(0.9, opts.boxPadding ?? 0)));
  return Math.round((ink / reach) * 100) / 100;
}

// ─── bullets ─────────────────────────────────────────────────────────────────

interface Lead {
  /** The marker as read: a glyph, or a number or letter with its `.` or `)`. */
  glyph: string;
  rest: string;
  /** True when the marker also reads as text, so it counts only with support. */
  ambiguous: boolean;
  kind: 'bullet' | 'number';
}

/** The isolated leading marker of a line, when it has one. */
function leadingGlyph(text: string): Lead | null {
  const t = text.trimStart();
  const number = NUMBER_MARKER.exec(t);
  if (number) return { glyph: `${number[1]}${number[2]}`, rest: t.slice(number[0].length), ambiguous: true, kind: 'number' };
  const first = Array.from(t)[0];
  if (!first) return null;
  const after = t.slice(first.length);
  const rest = after.trimStart();
  if (BULLET_GLYPHS.has(first)) {
    return /^[\p{L}\p{N}"'(]/u.test(rest) ? { glyph: first, rest, ambiguous: false, kind: 'bullet' } : null;
  }
  if (SUPPORTED_BULLETS.has(first)) {
    // Glued to a word it is punctuation; before a figure it is a sign (`> 50%`, `- 3`).
    if (rest === after) return null;
    return /^[\p{L}"'(]/u.test(rest) ? { glyph: first, rest, ambiguous: true, kind: 'bullet' } : null;
  }
  if (AMBIGUOUS_BULLETS.has(first)) {
    // `o Revenue`. An unspaced `eRevenue` is not taken: it cannot be told from
    // `eCommerce` or `oAuth` without the gap between the glyph and the letter.
    const spaced = /^\s+([\p{L}\p{N}].*)$/su.exec(after);
    if (spaced?.[1]) return { glyph: first, rest: spaced[1], ambiguous: true, kind: 'bullet' };
  }
  return null;
}

// ─── paragraphs ──────────────────────────────────────────────────────────────

interface Work {
  line: TypesetLineV1;
  lead: Lead | null;
}

interface Para {
  items: Work[];
  bullet: boolean;
  kind: 'bullet' | 'number';
  glyph?: string;
  evidence?: BulletEvidenceV1;
}

/** Group lines, taken in reading order, into paragraphs; `starts` are the lines that must open one. */
function groupParagraphs(ordered: Work[], starts: Set<number>, medianH: number, pitch: number | null): Para[] {
  const paras: Para[] = [];
  let current: Para | null = null;
  const tol = EDGE_TOLERANCE * medianH;
  for (const work of ordered) {
    const line = work.line;
    let continues = false;
    if (current && !starts.has(line.index)) {
      const prev = current.items[current.items.length - 1]?.line;
      const first = current.items[0]?.line;
      if (prev && first) {
        const below = line.box.y >= prev.box.y + prev.box.h * 0.5;
        const gap = cy(line.box) - cy(prev.box);
        const limit = pitch ? PARAGRAPH_PITCH * pitch : PARAGRAPH_HEIGHTS * medianH;
        const ratio = Math.max(line.box.h, prev.box.h) / Math.max(1, Math.min(line.box.h, prev.box.h));
        const sameEdge = Math.abs(line.box.x - prev.box.x) <= tol;
        const hanging = current.items.length === 1 && line.box.x > first.box.x + HANG_MIN * medianH && line.box.x < first.box.x + 4 * medianH;
        const firstIndent = current.items.length === 1 && line.box.x < first.box.x - HANG_MIN * medianH && first.box.x - line.box.x < 3 * medianH && !current.bullet;
        continues =
          xOverlap(line.box, prev.box) > 0 &&
          below &&
          gap <= limit &&
          ratio <= SIZE_STEP &&
          (sameEdge || (hanging && current.bullet) || firstIndent);
      }
    }
    if (continues && current) {
      current.items.push(work);
    } else {
      current = { items: [work], bullet: false, kind: 'bullet' };
      if (work.lead && starts.has(line.index)) {
        current.bullet = true;
        current.kind = work.lead.kind;
        current.glyph = work.lead.glyph;
      }
      paras.push(current);
    }
  }
  return paras;
}

/** Continuation lines that start right of the first line: a hanging indent. */
function hangsUnder(para: Para, medianH: number): boolean {
  const first = para.items[0]?.line;
  if (!first || para.items.length < 2) return false;
  return para.items.slice(1).every((w) => w.line.box.x > first.box.x + HANG_MIN * medianH);
}

// ─── line assembly ───────────────────────────────────────────────────────────

/**
 * Join fragments a recogniser returned for one printed line. PP-OCR's detector
 * boxes large type word by word, so a title comes back as four boxes on one
 * baseline; left apart, the column graph would read them as four paragraphs.
 * Two fragments join when they share most of their height, are a similar size
 * and sit no further apart than about a word space at that size.
 */
/**
 * Whether `glyph` is a bullet the detector boxed on its own, sitting at the
 * start of `line`: a single marker character, left of the line, its vertical
 * centre inside the line's box and the gap no wider than `BULLET_JOIN_GAP` line
 * heights. A bullet is smaller than the letters, so the size test that keeps two
 * lines of different sizes apart does not apply to it.
 */
function bulletBeside(glyph: { text: string; box: Box } | undefined, line: { text: string; box: Box } | undefined): boolean {
  if (!glyph || !line || Array.from(glyph.text).length !== 1) return false;
  if (!BULLET_GLYPHS.has(glyph.text) && !SUPPORTED_BULLETS.has(glyph.text) && !AMBIGUOUS_BULLETS.has(glyph.text)) return false;
  if (Array.from(line.text).length < 2) return false;
  const middle = cy(glyph.box);
  const gap = line.box.x - (glyph.box.x + glyph.box.w);
  return middle >= line.box.y && middle <= line.box.y + line.box.h && gap >= -0.25 * glyph.box.w && gap <= BULLET_JOIN_GAP * line.box.h;
}

function assembleLines(input: OcrLineInputV1[], opts: TypesetOptsV1): TypesetLineV1[] {
  const items = input
    .map((l, index) => ({ l, index }))
    .filter(({ l }) => typeof l.text === 'string' && l.text.trim() !== '')
    .map(({ l, index }) => ({
      index,
      text: l.text.trim(),
      confidence: Number.isFinite(l.confidence) ? l.confidence : 0,
      box: { x: l.box.x, y: l.box.y, w: Math.max(0, l.box.w), h: Math.max(0, l.box.h) },
    }));
  const parent = items.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while ((parent[r] ?? r) !== r) r = parent[r] ?? r;
    return r;
  };
  if (items.length <= (opts.maxLines ?? DEFAULT_MAX_LINES)) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]?.box;
        const b = items[j]?.box;
        if (!a || !b) continue;
        const lo = Math.max(1, Math.min(a.h, b.h));
        const vOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        const gap = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
        const oneRow = vOverlap >= JOIN_OVERLAP * lo && Math.max(a.h, b.h) / lo <= JOIN_SIZE && gap <= JOIN_GAP * Math.max(a.h, b.h);
        if (oneRow || bulletBeside(items[i], items[j]) || bulletBeside(items[j], items[i])) parent[find(j)] = find(i);
      }
    }
  }
  const groups = new Map<number, typeof items>();
  items.forEach((item, i) => {
    const r = find(i);
    const list = groups.get(r);
    if (list) list.push(item);
    else groups.set(r, [item]);
  });
  const lines: TypesetLineV1[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.box.x - b.box.x || a.index - b.index);
    const raw = group.map((g) => g.text).join(' ');
    const chars = group.reduce((n, g) => n + g.text.length, 0);
    const box = unionBox(group.map((g) => g.box));
    const estimates = group.map((g) => lineSizeEstimate(g.text, g.box.h, opts)).filter((e): e is number => e !== null);
    lines.push({
      index: Math.min(...group.map((g) => g.index)),
      parts: group.map((g) => g.index),
      text: raw,
      raw,
      confidence: Math.round((group.reduce((s, g) => s + g.confidence * g.text.length, 0) / Math.max(1, chars)) * 1000) / 1000,
      box,
      glyphSet: glyphSetOf(raw),
      // Each fragment's box fits its own glyphs, so each gives its own estimate and
      // the line takes their median.
      sizePx: estimates.length ? Math.round(median(estimates) * 100) / 100 : null,
    });
  }
  return lines.sort((a, b) => a.index - b.index);
}

// ─── blocks over a whole page ────────────────────────────────────────────────

/**
 * Whether a barrier (a rule drawn across the page) stands between two lines:
 * its middle lies in the gap between them, above one and below the other or
 * left of one and right of the other, and it spans across both.
 */
function divided(a: Box, b: Box, barriers: Box[]): boolean {
  const [upper, lower] = a.y <= b.y ? [a, b] : [b, a];
  const [left, right] = a.x <= b.x ? [a, b] : [b, a];
  return barriers.some((r) => {
    const my = r.y + r.h / 2;
    const mx = r.x + r.w / 2;
    const across = my >= upper.y + upper.h / 2 && my <= lower.y + lower.h / 2 && xOverlap(r, upper) > 0 && xOverlap(r, lower) > 0;
    const yShared = (s: Box): boolean => Math.min(r.y + r.h, s.y + s.h) - Math.max(r.y, s.y) > 0;
    const down = mx >= left.x + left.w / 2 && mx <= right.x + right.w / 2 && yShared(left) && yShared(right) && r.h > r.w;
    return (across && r.w >= r.h) || down;
  });
}

/** Two stacked lines are one block across a gap up to this share of the smaller line's height. */
const BLOCK_STACK_GAP = 0.9;
/** Two lines of one row are one block across a gap up to this many of the larger line's heights: a detector splits a line at a wide space, not between table cells. */
const BLOCK_ROW_GAP = 0.8;
/** Lines whose heights differ by more than this ratio are separate blocks: a title over its body. */
const BLOCK_SIZE_STEP = 1.45;
/** Stacked lines share a left edge within this many line heights (a hanging indent included)... */
const BLOCK_LEFT_EDGE = 2.5;
/** ...or a centre or a right edge within this many. */
const BLOCK_OTHER_EDGE = 1.5;

/**
 * Group the lines a detector found over a whole page into blocks, each a set of
 * input indices that `typesetOcrLines` then reads as one region. Two lines share
 * a block when they are one row a word space or so apart, or stacked with a
 * shared horizontal extent, a shared left, centre or right edge and a gap under
 * `BLOCK_STACK_GAP` of the smaller height, with no barrier (`barriers`, the
 * page's rules) standing between them; lines of clearly different heights never share one, so a title set
 * close over its body stays a block of its own. The relation is closed over
 * (a chain of neighbours is one block). Blocks come back in the order of their
 * first line, lines in input order. Lines with no text are left out.
 * Quadratic in the line count.
 */
export function ocrTextBlocks(input: OcrLineInputV1[], barriers: Box[] = []): number[][] {
  const items = input
    .map((l, index) => ({ l, index }))
    .filter(({ l }) => typeof l.text === 'string' && l.text.trim() !== '' && l.box.w > 0 && l.box.h > 0);
  const parent = items.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while ((parent[r] ?? r) !== r) r = parent[r] ?? r;
    return r;
  };
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]?.l.box;
      const b = items[j]?.l.box;
      if (!a || !b) continue;
      const lo = Math.max(1, Math.min(a.h, b.h));
      const hi = Math.max(a.h, b.h);
      if (hi / lo > BLOCK_SIZE_STEP) continue;
      const vOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const hGap = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
      const oneRow = vOverlap >= JOIN_OVERLAP * lo && hGap <= BLOCK_ROW_GAP * hi;
      const vGap = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
      // A paragraph's lines share an edge: the left one, or the centre or the right
      // one for centred or right-set text. A label that only happens to sit under
      // a paragraph (a caption in a drawing) shares none of them.
      const aligned = Math.abs(a.x - b.x) <= BLOCK_LEFT_EDGE * lo
        || Math.abs(a.x + a.w / 2 - (b.x + b.w / 2)) <= BLOCK_OTHER_EDGE * lo
        || Math.abs(a.x + a.w - (b.x + b.w)) <= BLOCK_OTHER_EDGE * lo;
      const stacked = aligned && xOverlap(a, b) > 0 && vGap <= BLOCK_STACK_GAP * lo && vOverlap < JOIN_OVERLAP * lo;
      if ((oneRow || stacked) && !divided(a, b, barriers)) parent[find(j)] = find(i);
    }
  }
  const groups = new Map<number, number[]>();
  items.forEach((item, i) => {
    const r = find(i);
    const list = groups.get(r);
    if (list) list.push(item.index);
    else groups.set(r, [item.index]);
  });
  return [...groups.values()].map((g) => g.sort((a, b) => a - b)).sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
}

// ─── the entry point ─────────────────────────────────────────────────────────

/**
 * A paragraph's lines as one text. A line ending in a hyphen runs on into the
 * next, and so does one ending in a dash set close to its word
 * ("carelessness\u2014" then "it was"); a dash with a space before it keeps the
 * space after it too.
 */
function joinLines(texts: string[]): string {
  let out = '';
  for (const t of texts) {
    const piece = t.trim();
    if (!piece) continue;
    if (!out) out = piece;
    else if (out.endsWith('-') || /\S[\u2014\u2013]$/u.test(out)) out += piece;
    else out += ` ${piece}`;
  }
  return out;
}

/**
 * Recover paragraphs, bullets, nesting, reading order, a size estimate and a
 * role guess from the OCR lines of one text region. See the module header for
 * each rule.
 */
export function typesetOcrLines(input: OcrLineInputV1[], opts: TypesetOptsV1 = {}): TypesetBlockV1 {
  const lines = assembleLines(input, opts);
  const cap = opts.capHeight ?? DEFAULT_CAP;
  if (lines.length === 0) {
    return {
      paragraphs: [],
      lines: [],
      order: [],
      columns: 0,
      size: { basis: 'estimate', sizePx: null, samples: 0, pitchPx: null, capHeight: cap },
      orderFallback: false,
    };
  }

  const reading = readingOrderOf(
    lines.map((l) => l.box),
    opts.maxLines ?? DEFAULT_MAX_LINES,
  );
  const ordered: Work[] = [];
  for (const i of reading.order) {
    const line = lines[i];
    if (line) ordered.push({ line, lead: leadingGlyph(line.raw) });
  }
  const medianH = Math.max(1, median(lines.map((l) => l.box.h)));

  // The pitch between neighbouring lines of one column and one size.
  const pitches: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1]?.line;
    const b = ordered[i]?.line;
    if (!a || !b) continue;
    const ratio = Math.max(a.box.h, b.box.h) / Math.max(1, Math.min(a.box.h, b.box.h));
    const gap = cy(b.box) - cy(a.box);
    if (xOverlap(a.box, b.box) > 0 && gap > 0 && gap < 3 * medianH && ratio <= SIZE_STEP) pitches.push(gap);
  }
  // The lower quartile rather than the median: in a short block the gaps between
  // paragraphs are a large share of the pairs and would widen the line pitch.
  const sortedPitches = [...pitches].sort((a, b) => a - b);
  const pitch = sortedPitches.length ? (sortedPitches[Math.floor(sortedPitches.length / 4)] ?? null) : null;

  // First pass: every candidate glyph opens a paragraph. Then the ambiguous ones
  // keep that only with support, and the grouping runs again without the rest.
  const tol = EDGE_TOLERANCE * medianH;
  const candidates = new Set(ordered.filter((w) => w.lead).map((w) => w.line.index));
  const tentative = groupParagraphs(ordered, candidates, medianH, pitch);
  const confirmed = new Set<number>();
  const evidence = new Map<number, BulletEvidenceV1>();
  for (const para of tentative) {
    const head = para.items[0];
    if (!head?.lead) continue;
    const hang = hangsUnder(para, medianH);
    if (!head.lead.ambiguous) {
      confirmed.add(head.line.index);
      evidence.set(head.line.index, hang ? 'glyph-and-indent' : 'glyph');
      continue;
    }
    // Another paragraph opening with a marker of the same kind at the same edge.
    const repeated = tentative.some((other) => {
      const oh = other.items[0];
      return other !== para && oh?.lead?.kind === head.lead?.kind && oh !== undefined && Math.abs(oh.line.box.x - head.line.box.x) <= tol;
    });
    if (hang || repeated) {
      confirmed.add(head.line.index);
      evidence.set(head.line.index, hang ? 'glyph-and-indent' : 'repeated-glyph');
    }
  }
  const paras = groupParagraphs(ordered, confirmed, medianH, pitch);
  for (const para of paras) {
    const head = para.items[0];
    if (!para.bullet || !head?.lead) continue;
    head.line.text = head.lead.rest.trim();
    para.evidence = evidence.get(head.line.index) ?? 'glyph';
  }

  // Columns: paragraphs joined by shared horizontal extent, numbered from the left.
  const boxes = paras.map((p) => unionBox(p.items.map((w) => w.line.box)));
  const parent = paras.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while ((parent[r] ?? r) !== r) r = parent[r] ?? r;
    return r;
  };
  // A paragraph over two side-by-side paragraphs (a heading across both columns)
  // spans them: it would join the columns into one, so it is left out of the
  // grouping and takes the leftmost column it covers.
  const spans = boxes.map((p, i) =>
    boxes.some((a, j) => j !== i && xOverlap(p, a) > 0 && boxes.some((b, k) => k !== i && k !== j && xOverlap(p, b) > 0 && xOverlap(a, b) <= 0)),
  );
  for (let i = 0; i < paras.length; i++) {
    for (let j = i + 1; j < paras.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a && b && !spans[i] && !spans[j] && xOverlap(a, b) > 0) parent[find(j)] = find(i);
    }
  }
  const rootLeft = new Map<number, number>();
  paras.forEach((_, i) => {
    if (spans[i]) return;
    const r = find(i);
    const left = boxes[i]?.x ?? 0;
    rootLeft.set(r, Math.min(rootLeft.get(r) ?? left, left));
  });
  const roots = [...rootLeft.entries()].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(([r]) => r);
  const columnOf = paras.map((_, i) => {
    if (!spans[i]) return roots.indexOf(find(i));
    const box = boxes[i];
    const covered = paras.map((_, j) => j).filter((j) => !spans[j] && box && boxes[j] && xOverlap(box, boxes[j] ?? box) > 0);
    return covered.length ? Math.min(...covered.map((j) => roots.indexOf(find(j)))) : 0;
  });

  // A paragraph starting where a neighbouring bullet's text starts is a bullet
  // whose glyph the recogniser did not read.
  const textIndent = (para: Para): number => {
    const first = para.items[0]?.line;
    const cont = para.items[1]?.line;
    if (first && cont && hangsUnder(para, medianH)) return cont.box.x - first.box.x;
    return medianH;
  };
  paras.forEach((para, i) => {
    if (para.bullet) return;
    const head = para.items[0]?.line;
    if (!head) return;
    for (const j of [i - 1, i + 1]) {
      const other = paras[j];
      const oh = other?.items[0]?.line;
      if (!other || !oh || !other.bullet || columnOf[j] !== columnOf[i]) continue;
      if (Math.abs(head.box.x - (oh.box.x + textIndent(other))) <= tol) {
        para.bullet = true;
        para.kind = other.kind;
        para.evidence = 'text-indent';
        break;
      }
    }
  });

  // Levels: marker edges clustered within each column.
  const markerX = paras.map((para, i) => {
    const head = para.items[0]?.line;
    const x = head?.box.x ?? 0;
    if (para.evidence === 'text-indent') {
      const neighbour = [paras[i - 1], paras[i + 1]].find((o) => o?.bullet && o.evidence !== 'text-indent');
      return x - (neighbour ? textIndent(neighbour) : medianH);
    }
    return x;
  });
  const lvl = new Array<number>(paras.length).fill(0);
  for (let col = 0; col < roots.length; col++) {
    const members = paras.map((_, i) => i).filter((i) => columnOf[i] === col);
    const edges = [...new Set(members.map((i) => markerX[i] ?? 0))].sort((a, b) => a - b);
    const clusters: number[] = [];
    for (const e of edges) {
      const last = clusters[clusters.length - 1];
      if (last === undefined || e - last > tol * 1.2) clusters.push(e);
    }
    for (const i of members) {
      const x = markerX[i] ?? 0;
      let k = 0;
      for (let c = 0; c < clusters.length; c++) if (x >= (clusters[c] ?? 0) - tol * 1.2) k = c;
      lvl[i] = Math.min(8, k);
    }
  }

  // Alignment per column, from every line in it.
  const alignOf = new Map<number, TypesetParagraphV1['align']>();
  for (let col = 0; col < roots.length; col++) {
    const colLines = paras.flatMap((p, i) => (columnOf[i] === col && !spans[i] ? p.items.map((w) => w.line.box) : []));
    if (colLines.length < 2) continue;
    const spread = (f: (b: Box) => number): number => {
      const v = colLines.map(f);
      return Math.max(...v) - Math.min(...v);
    };
    if (spread((b) => b.x) <= tol) alignOf.set(col, 'left');
    else if (spread((b) => b.x + b.w / 2) <= tol) alignOf.set(col, 'center');
    else if (spread((b) => b.x + b.w) <= tol) alignOf.set(col, 'right');
  }

  // A centred or right-set column has no left edge to indent from: its lines start
  // where their width puts them, so a paragraph there takes a level only as a bullet
  // (a card's centred heading over a narrower line is not a nested item).
  paras.forEach((para, i) => {
    const align = alignOf.get(columnOf[i] ?? 0);
    if ((align === 'center' || align === 'right') && !para.bullet) lvl[i] = 0;
  });

  const paraSize = paras.map((p) => {
    const sizes = p.items.map((w) => w.line.sizePx).filter((s): s is number => s !== null);
    return sizes.length ? Math.round(median(sizes) * 100) / 100 : null;
  });
  const titleShare = opts.titleShare ?? DEFAULT_TITLE_SHARE;
  const titleRatio = opts.titleRatio ?? DEFAULT_TITLE_RATIO;
  const out: TypesetParagraphV1[] = paras.map((para, i) => {
    const size = paraSize[i] ?? null;
    const rest = paraSize.filter((s, j): s is number => j !== i && s !== null);
    const restMedian = rest.length ? median(rest) : null;
    const roleEvidence: TypesetParagraphV1['roleEvidence'] = {};
    let role: TypesetParagraphV1['role'] = 'body';
    if (size !== null && opts.pageHeight && opts.pageHeight > 0) {
      roleEvidence.pageShare = Math.round((size / opts.pageHeight) * 1000) / 1000;
      if (roleEvidence.pageShare >= titleShare) role = 'title';
    }
    if (size !== null && restMedian) {
      roleEvidence.ratioToRest = Math.round((size / restMedian) * 100) / 100;
      if (i === 0 && roleEvidence.ratioToRest >= titleRatio) role = 'title';
    }
    if (role === 'title' && size !== null && opts.minTitlePx !== undefined && size < opts.minTitlePx) role = 'body';
    const items = para.items;
    const confidence = items.reduce((s, w) => s + w.line.confidence, 0) / Math.max(1, items.length);
    const result: TypesetParagraphV1 = {
      lines: items.flatMap((w) => w.line.parts),
      text: joinLines(items.map((w) => w.line.text)),
      box: boxes[i] ?? unionBox(items.map((w) => w.line.box)),
      column: columnOf[i] ?? 0,
      lvl: lvl[i] ?? 0,
      bullet: para.bullet ? para.kind : 'none',
      sizePx: size,
      role,
      roleEvidence,
      confidence: Math.round(confidence * 1000) / 1000,
    };
    if (para.bullet && para.glyph && para.evidence !== 'text-indent') result.bulletGlyph = para.glyph;
    if (para.evidence) result.bulletEvidence = para.evidence;
    const align = spans[i] ? undefined : alignOf.get(columnOf[i] ?? 0);
    if (align) result.align = align;
    return result;
  });

  // A paragraph with no letters to measure (a lone `?` in another colour) takes
  // the role of the paragraph before it, or after it when it leads.
  out.forEach((para, i) => {
    if (para.sizePx !== null) return;
    const neighbour = out[i - 1] ?? out.slice(i + 1).find((p) => p.sizePx !== null);
    if (neighbour) para.role = neighbour.role;
  });

  const sizes = lines.map((l) => l.sizePx).filter((s): s is number => s !== null);
  return {
    paragraphs: out,
    lines,
    order: reading.order.flatMap((i) => lines[i]?.parts ?? []),
    columns: Math.max(1, roots.length),
    size: {
      basis: 'estimate',
      sizePx: sizes.length ? Math.round(median(sizes) * 100) / 100 : null,
      samples: sizes.length,
      pitchPx: pitch === null ? null : Math.round(pitch * 100) / 100,
      capHeight: cap,
    },
    orderFallback: reading.fallback,
  };
}
