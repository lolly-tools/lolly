// SPDX-License-Identifier: MPL-2.0
/**
 * PDF text reconstruction: positioned glyph runs to reading-ordered prose.
 *
 * `interpretPdfPage` (pdf-map.ts) hands back what the page PAINTS: a flat list of
 * text nodes, each one BT…ET block's worth of glyphs at a position. That is not
 * text you can read. A two-column paper comes back interleaved, a heading is just
 * a run that happens to be larger, and a sentence broken across three style
 * changes is three nodes. This module turns that back into prose:
 *
 *   runs → items → regions and columns → lines → blocks → markdown
 *
 * PURE and DOM-free, like the rest of the engine. It takes nodes, not bytes, so
 * the same pass serves the web shell, the CLI and any future exploder surface.
 *
 * ### What the geometry can and cannot be trusted for
 *
 * `x`, `y` and `fontSize` come straight from the text matrix and are exact. A
 * line's right edge is exact only when the node carries `lineInk`, the ink width
 * pdf-map measures with the font's own advance widths; without it the edge is
 * estimated as `chars × size × 0.55`. So every decision here keys off
 * x-positions, baselines and font sizes, and treats width as a hint: a word
 * break between runs needs a wider gap when the edge is estimated, and a column
 * gutter is wide by definition. The measured edge feeds the column tests too,
 * and they need it: once the spaces between words are restored, the estimate
 * grows with every space and runs a left column's lines into its gutter.
 *
 * A node's `text` can already contain newlines: the interpreter breaks a line
 * when the pen drops within one BT…ET. Those become separate lines here, sharing
 * the node's x. This is an approximation, since the interpreter does not keep each
 * line's own origin, and a harmless one because a pen-drop inside one text object
 * is nearly always a left-aligned continuation.
 *
 * ### Reading order
 *
 * Geometric only. A tagged PDF's `/StructTreeRoot` states the true order and
 * would beat any heuristic, but reaching it needs MCIDs threaded through the
 * interpreter and a struct-tree walk in the shell; `order: 'geometric'` on the
 * result says which path produced it so a caller can tell the difference once
 * the tagged path exists.
 *
 * Column detection is CONSERVATIVE on purpose. Splitting a page into columns
 * that are not there scrambles prose far worse than leaving real columns
 * interleaved, and the layout of a two-column page is not reliably distinguishable
 * from a two-column table. The thresholds below (wide gutter, several lines a
 * side, lines that fill their column) err toward "one column". Columns are
 * looked for region by region, so a title across the width or a row of cards
 * under a two-column section does not hide the gutters beside it.
 */

import { pdfWordBreak, PDF_WORD_GAP_EM, type PdfNode } from './pdf-map.ts';

// ── tunables ──────────────────────────────────────────────────────────────────

/** Baselines within this fraction of the font size are the same line. */
const LINE_TOLERANCE = 0.4;
/** A vertical gap wider than this many line-heights starts a new block. */
const PARA_GAP = 1.55;
/** A font-size change of more than this fraction starts a new block. */
const SIZE_SHIFT = 0.15;
/** A block this much larger than body text is a heading. */
const HEADING_RATIO = 1.15;
/** Text rotated more than this many degrees is out of flow (stamps, watermarks). */
const MAX_SKEW_DEG = 5;
/** A column gutter must be at least this many body-sizes wide. */
const GUTTER_SIZES = 1.8;
/** …and each column must hold at least this many lines to be believed. */
const MIN_COLUMN_LINES = 4;
/** …and its lines must fill at least this fraction of its width on average
 *  (a two-column TABLE has short cells; two-column PROSE has full lines). */
const MIN_COLUMN_FILL = 0.25;
/** Cap on columns, so a pathological page cannot fragment into slivers. */
const MAX_COLUMNS = 4;
/** An image covering this fraction of the page, with no text, means a scan. */
const SCAN_COVERAGE = 0.5;

/** Direct-call budgets mirror and tighten the upstream interpreter's page cap. */
export const PDF_TEXT_MAX_NODES = 4_000;
export const PDF_TEXT_MAX_ITEMS = 20_000;
export const PDF_TEXT_MAX_CHARS = 16 * 1024 * 1024;
export const PDF_TEXT_MAX_TAGGED_ELEMENTS = 20_000;
export const PDF_TEXT_MAX_MCIDS_PER_ELEMENT = 4_000;
export const PDF_TEXT_MAX_TAGGED_REFERENCES = 100_000;
export const PDF_TEXT_MAX_JOIN_PAGES = 10_000;

// ── shapes ────────────────────────────────────────────────────────────────────

/** One positioned fragment of text: a node, or one line of a multi-line node. */
export interface TextItem {
  text: string;
  /** Left edge, in the page's top-left y-down box space. */
  x: number;
  /** Baseline, not the box top: mixed sizes on one line share a baseline, not a top. */
  baseline: number;
  /**
   * Right edge. Measured (the end of the last visible glyph) when the node
   * carries `lineInk`, and `measured` says so; otherwise estimated at 0.55 em a
   * character.
   */
  right: number;
  /** True when `right` was measured with the font's advance widths. */
  measured?: boolean;
  /** Character spacing after each glyph, from the node, in page units. */
  tracking?: number;
  /** The node's last line ended in a space glyph the text trimmed (`PdfNode.spaceAfter`). */
  spaceAfter?: true;
  size: number;
  font: string;
  bold: boolean;
  /** Marked-content id, when the page is tagged. */
  mcid?: number;
}

export interface TextLine {
  text: string;
  x: number;
  right: number;
  baseline: number;
  /** The dominant size on the line (by character count). */
  size: number;
  bold: boolean;
}

export type BlockKind = 'heading' | 'paragraph' | 'list-item';

export interface TextBlock {
  kind: BlockKind;
  /** 1–6 for headings; absent otherwise. */
  level?: number;
  /**
   * The block's prose, lines joined and de-hyphenated.
   *
   * For a list item this EXCLUDES the leading marker, which is carried in
   * `marker` instead. Keeping the bullet inside the text made every renderer
   * responsible for stripping it, and the moment one of them forgot (an HTML
   * view whose CSS also draws a bullet) the item rendered "• • thing".
   */
  text: string;
  /** A list item's original marker ("•", "2.", "a)"), verbatim from the page. */
  marker?: string;
  size: number;
  bold: boolean;
  /**
   * Which column it came from, 0-based left to right WITHIN ITS OWN ROW of the
   * page: numbering starts again at 0 for each band of columns (a two-column
   * section, the row of cards under it), so column 0 of one row and column 0 of
   * the next need not be the same place on the page. A column that holds a
   * pair of columns of its own takes two numbers. Text read as one flow is 0.
   */
  column: number;
}

export interface PageText {
  blocks: TextBlock[];
  /** Plain text: blocks separated by blank lines, in reading order. */
  text: string;
  /** The same content as markdown: headings and list items marked up. */
  markdown: string;
  /**
   * The most columns one row of the page was split into (1 when no split
   * was believed). A page with a two-column section above a row of three cards
   * reports 3.
   */
  columns: number;
  /**
   * The page paints no text but is mostly covered by an image: a SCAN.
   * There is nothing to extract without OCR, and callers must report it rather
   * than present an empty result as "this page is blank".
   */
  scanned: boolean;
  /** Runs skipped as out of flow (rotated stamps, watermarks). */
  rotated: number;
  /**
   * Runs the structure tree did not claim, appended after the tagged flow.
   * Only meaningful when `order` is 'tagged'; usually running heads and page
   * numbers, which genuinely sit outside the reading order.
   */
  untagged?: number;
  /**
   * How the reading order was decided. 'tagged' means the document stated it
   * (`/StructTreeRoot`) and we followed it; 'geometric' means we inferred it
   * from positions, which is a good guess and no more than that.
   */
  order: 'geometric' | 'tagged';
}

// ── helpers ───────────────────────────────────────────────────────────────────

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function isBold(n: PdfNode): boolean {
  const w = n.fontWeight;
  if (typeof w === 'number') return w >= 600;
  if (typeof w === 'string') return /bold|black|heavy|semibold/i.test(w);
  return /bold|black|heavy/i.test(String(n.fontFamily ?? ''));
}

/** Leading list marker, if the line opens with one. */
const LIST_MARKER = /^\s*(?:[•‣▪◦·–\u2014*-]|\(?\d{1,3}[.)]|\(?[a-zA-Z][.)])\s+/;

/** Markdown control characters that would change meaning at the START of a line. */
function escapeLeading(s: string): string {
  return s.replace(/^([#>|]|\d+[.)]\s|[-*+]\s)/, '\\$1');
}

// ── 1. runs → items ───────────────────────────────────────────────────────────

/**
 * A line's right edge: measured from the node's `lineInk` (which counts from the
 * node's `x`, whatever the line's own start) when it has one.
 */
function rightEdge(n: PdfNode, lineIndex: number, text: string, size: number): Pick<TextItem, 'right' | 'measured' | 'tracking'> {
  const ink = Array.isArray(n.lineInk) ? n.lineInk[lineIndex] : undefined;
  const tracking = typeof n.tracking === 'number' && Number.isFinite(n.tracking) && n.tracking > 0 ? { tracking: n.tracking } : {};
  if (typeof ink === 'number' && Number.isFinite(ink) && ink > 0) return { right: n.x + ink, measured: true, ...tracking };
  return { right: n.x + text.length * size * 0.55, ...tracking };
}

/**
 * Flatten text nodes into positioned single-line items.
 *
 * The baseline is recovered by undoing the shift pdf-map applies when it emits a
 * node (`y = origin.y - size * 0.8`): clustering on the box TOP would split a
 * line that mixes sizes, because a 20pt and an 8pt run sharing a baseline have
 * tops 10pt apart.
 */
function toItems(nodes: PdfNode[]): { items: TextItem[]; rotated: number } {
  const items: TextItem[] = [];
  let rotated = 0;
  let chars = 0;

  for (let nodeIndex = 0; nodeIndex < nodes.length && nodeIndex < PDF_TEXT_MAX_NODES; nodeIndex++) {
    const n = nodes[nodeIndex]!;
    if (n.kind !== 'text') continue;
    const source = typeof n.text === 'string' ? n.text : '';
    const remaining = PDF_TEXT_MAX_CHARS - chars;
    if (remaining <= 0 || items.length >= PDF_TEXT_MAX_ITEMS) break;
    const raw = source.slice(0, remaining);
    chars += raw.length;
    if (!raw.trim()) continue;
    if (Math.abs(n.rot ?? 0) > MAX_SKEW_DEG) { rotated++; continue; }

    const size = Math.max(1, n.fontSize ?? 12);
    const bold = isBold(n);
    const font = String(n.fontFamily ?? '');
    let lineStart = 0;
    let lineIndex = 0;
    while (lineStart <= raw.length && items.length < PDF_TEXT_MAX_ITEMS) {
      const newline = raw.indexOf('\n', lineStart);
      const lineEnd = newline < 0 ? raw.length : newline;
      const text = raw.slice(lineStart, lineEnd);
      if (text.trim()) {
        items.push({
          text,
          x: n.x,
          // Undo pdf-map's box-top shift, then step down one line per split line
          // at the node's REAL leading when the interpreter measured one.
          baseline: n.y + size * 0.8 + lineIndex * size * (typeof n.lineHeight === 'number' && isFinite(n.lineHeight) && n.lineHeight > 0 ? n.lineHeight : 1.4),
          // The measured ink width when the interpreter supplied one; otherwise
          // 0.55 em a character, pdf-map's own default advance, so the two agree.
          ...rightEdge(n, lineIndex, text, size),
          ...(newline < 0 && n.spaceAfter ? { spaceAfter: true as const } : {}),
          size,
          font,
          bold,
          ...(typeof n.mcid === 'number' ? { mcid: n.mcid } : {}),
        });
      }
      if (newline < 0) break;
      lineStart = newline + 1;
      lineIndex++;
    }
  }
  return { items, rotated };
}

// ── 2. items → lines ──────────────────────────────────────────────────────────

/** An estimated right edge can overshoot a real one, so its break needs a wider gap. */
const ESTIMATED_WORD_GAP_EM = 0.2;

/**
 * Join two fragments, inserting a space only where the geometry implies one.
 *
 * A visible gap means a word break; touching or overlapping fragments are one
 * word split by a style change, or by kerning. With a measured edge the gap is
 * taken net of the previous run's character spacing, so letter-spaced type
 * split by a style change stays one word, and the threshold is the
 * interpreter's own (`PDF_WORD_GAP_EM`). No space goes between two characters of
 * a script written without them unless the gap is a wide one (`pdfWordBreak`).
 * A run that showed a trailing space glyph is always followed by a break when
 * the next run starts past its ink.
 */
function joinFragments(acc: string, next: TextItem, prev: TextItem | null): string {
  if (!acc || !prev) return acc + next.text;
  const measured = prev.measured === true;
  const gap = next.x - prev.right - (measured ? prev.tracking ?? 0 : 0);
  const size = Math.max(1, next.size);
  // The document spelled the break: a run that showed a trailing space glyph.
  if (prev.spaceAfter && gap > 0 && !/\s$/.test(acc) && !/^\s/.test(next.text)) return `${acc} ${next.text}`;
  return pdfWordBreak(acc, next.text, gap / size, measured ? PDF_WORD_GAP_EM : ESTIMATED_WORD_GAP_EM)
    ? `${acc} ${next.text}`
    : acc + next.text;
}

function toLines(items: TextItem[]): TextLine[] {
  if (!items.length) return [];
  // Baseline first, then x: reading order within a line falls out of the sort.
  const sorted = [...items].sort((a, b) => (a.baseline - b.baseline) || (a.x - b.x));

  const lines: TextLine[] = [];
  let bucket: TextItem[] = [sorted[0]!];

  const flush = (): void => {
    if (!bucket.length) return;
    const byX = [...bucket].sort((a, b) => a.x - b.x);
    let text = '';
    let prev: TextItem | null = null;
    for (const it of byX) {
      text = joinFragments(text, it, prev);
      prev = it;
    }
    // The dominant size is the one carrying the most characters: a line ending
    // in a small footnote marker is still a body line.
    const weight = new Map<number, number>();
    for (const it of byX) weight.set(it.size, (weight.get(it.size) ?? 0) + it.text.length);
    let size = byX[0]!.size;
    let best = -1;
    for (const [s, w] of weight) if (w > best) { best = w; size = s; }
    const boldChars = byX.reduce((a, it) => a + (it.bold ? it.text.length : 0), 0);
    const allChars = byX.reduce((a, it) => a + it.text.length, 0);

    text = text.replace(/\s+/g, ' ').trim();
    if (text) {
      lines.push({
        text,
        x: byX[0]!.x,
        right: Math.max(...byX.map((i) => i.right)),
        baseline: median(byX.map((i) => i.baseline)),
        size,
        bold: allChars > 0 && boldChars / allChars > 0.6,
      });
    }
    bucket = [];
  };

  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i]!;
    const ref = bucket[bucket.length - 1]!;
    const tol = Math.max(1, Math.min(ref.size, it.size) * LINE_TOLERANCE);
    if (Math.abs(it.baseline - ref.baseline) <= tol) bucket.push(it);
    else { flush(); bucket = [it]; }
  }
  flush();
  return lines;
}

// ── 3. items → regions → columns ─────────────────────────────────────────────

/**
 * Columns are found per REGION, not per page, and on ITEMS, before lines are
 * assembled.
 *
 * Items first, because a two-column page very often sets its columns on a shared
 * baseline grid: assembling lines first splices the left and right columns into
 * single lines spanning the page, and by then there is no gutter left to find.
 *
 * Per region, because a slide or a report page rarely runs its columns from top
 * to bottom. A title spans the width above them, a row of three cards sits under
 * a two-column section, a page number sits in a corner. A page-wide sweep finds
 * no gap that the title does not cross, so it reads every column interleaved. The
 * sweep here cuts the region into horizontal SLABS (runs of items whose vertical
 * extents touch, so one slab is one text row, or several rows set solid), then
 * grows a SECTION down from a slab for as long as some vertical opening wide
 * enough to be a gutter stays clear of every item in it. A section is cut again
 * into ROWS where every column starts over at once (a grid of cards, a table
 * whose cells run to several lines), and each row whose columns pass the checks
 * below is read column by column; everything else joins the single-column flow
 * around it. Each column is swept again, so a column can hold a titled pair of
 * columns of its own.
 *
 * A section that fails is not tried again from each of its own slabs: the next
 * attempt starts at the first slab that opens a gutter the slab above it
 * crosses, and an attempt whose openings rejoin the failed section's openings
 * at the same slab stops there. Without both, a long table is split once for
 * every row it has, and some tail of it passes the checks by chance.
 *
 * Right edges are the measured ink when the interpreter supplied `lineInk`, which
 * is what makes a slide's gutter visible at all: the 0.55 em estimate of a
 * left column's longer lines runs into a gutter of two or three ems.
 */
interface Gutter { x: number; gap: number }
/**
 * A horizontal stretch no item crosses. `settled` is its right edge at the
 * moment it first had text on both sides, which is the left edge of the column
 * to its right.
 */
interface Opening { x0: number; x1: number; settled?: number }
/** A run of items read as one column, and its column number within its row, 0-based left to right. */
interface Flow { items: TextItem[]; column: number }
/** The work spent on this page so far, the narrowest gutter, and the body size. */
interface Sweep { steps: number; minGap: number; bodySize: number }

/**
 * Work cap for the region sweep, per page: one unit for each slab-to-slab
 * intersection and for each slab a section spans, and one for each item handed
 * to a line or column pass. Past it, the rest of the page is read as one flow.
 */
const MAX_SWEEP_STEPS = 400_000;
/** How deep columns may nest inside columns. */
const MAX_REGION_DEPTH = 3;
/** A column this short is believed only when its lines visibly wrap (a card of prose). */
const MIN_WRAPPED_COLUMN_LINES = 3;
/**
 * A column with this share of its lines on the baselines of the column beside
 * it, each line opening afresh, is a table column: labels beside their values.
 */
const TABLE_PAIRED = 0.75;
/**
 * Two neighbouring columns must run beside each other: at least this share of
 * one column's lines shares some height with a line of the other. Entries that
 * zig-zag down the page, left, right, left, never do.
 */
const SIDE_BY_SIDE = 0.5;

const itemTop = (it: TextItem): number => it.baseline - it.size * 0.8;
const itemBottom = (it: TextItem): number => it.baseline + it.size * 0.2;
const itemRight = (it: TextItem): number => Math.max(it.right, it.x + 1);
const lineTop = (l: TextLine): number => l.baseline - l.size * 0.8;
const lineBottom = (l: TextLine): number => l.baseline + l.size * 0.2;

/** Group items into horizontal slabs: items whose vertical extents overlap share one. */
function slabsOf(items: TextItem[]): TextItem[][] {
  const sorted = [...items].sort((a, b) => (itemTop(a) - itemTop(b)) || (a.x - b.x));
  const slabs: TextItem[][] = [];
  let bottom = -Infinity;
  for (const it of sorted) {
    const last = slabs[slabs.length - 1];
    if (last && itemTop(it) < bottom) { last.push(it); bottom = Math.max(bottom, itemBottom(it)); }
    else { slabs.push([it]); bottom = itemBottom(it); }
  }
  return slabs;
}

/** The horizontal openings of one slab inside [lo, hi], each at least `min` wide. */
function openingsOf(slab: TextItem[], lo: number, hi: number, min: number): Opening[] {
  const spans = slab.map((it) => [it.x, itemRight(it)] as const).sort((a, b) => a[0] - b[0]);
  const out: Opening[] = [];
  let reach = lo;
  for (const [x0, x1] of spans) {
    if (x0 - reach >= min) out.push({ x0: reach, x1: x0 });
    reach = Math.max(reach, x1);
  }
  if (hi - reach >= min) out.push({ x0: reach, x1: hi });
  return out;
}

/**
 * The parts of a section's openings (`a`) that the next slab's openings (`b`)
 * also keep clear, each at least `min` wide, carrying each part's settled edge.
 */
function intersectOpenings(a: Opening[], b: Opening[], min: number): Opening[] {
  const out: Opening[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const x0 = Math.max(a[i]!.x0, b[j]!.x0);
    const x1 = Math.min(a[i]!.x1, b[j]!.x1);
    const settled = a[i]!.settled;
    if (x1 - x0 >= min) out.push(settled === undefined ? { x0, x1 } : { x0, x1, settled });
    if (a[i]!.x1 < b[j]!.x1) i++;
    else j++;
  }
  return out;
}

/**
 * Record the right edge of every opening that now has text on both sides (an
 * edge short of the region's own edge was set by an item), and say whether a
 * slab moved a settled opening's right edge left by more than an em AND by
 * more than the width the opening keeps.
 *
 * That move is a DIFFERENT gutter: the next row of text starts well inside the
 * one this section was found on, as a row of three cards does under two
 * columns. The intersection alone would slide on to the narrow stretch the two
 * layouts happen to share and read the cards into the columns above them. A
 * smaller move is a column whose first row was indented (a centred heading over
 * a table), and a left edge moving right is only a longer line in the left
 * column; both are allowed.
 */
function settleOpenings(openings: Opening[], lo: number, hi: number, em: number): { openings: Opening[]; moved: boolean } {
  let moved = false;
  const out = openings.map((o) => {
    if (o.settled !== undefined) {
      const lost = o.settled - o.x1;
      if (lost > em && lost > o.x1 - o.x0) moved = true;
      return o;
    }
    return o.x0 > lo && o.x1 < hi ? { ...o, settled: o.x1 } : o;
  });
  return { openings: out, moved };
}

/**
 * Does the slab above cross some opening of this slab, over a stretch at least
 * `min` wide? Then a gutter can begin here, and a section is worth growing from
 * this slab. In a run of slabs that keep the same openings (the rows of a
 * table, the lines of two columns) only the first qualifies.
 */
function opensGutter(above: Opening[], here: Opening[], min: number): boolean {
  return here.some((o) => {
    let reach = o.x0;
    for (const p of above) {
      if (p.x1 <= reach) continue;
      if (p.x0 >= o.x1) break;
      if (p.x0 - reach >= min) return true;
      reach = Math.max(reach, p.x1);
    }
    return o.x1 - reach >= min;
  });
}

/** The same openings, one for one, each edge within `em` of its counterpart's. */
function sameOpenings(a: Opening[], b: Opening[], em: number): boolean {
  return a.length === b.length && a.every((o, k) => Math.abs(o.x0 - b[k]!.x0) <= em && Math.abs(o.x1 - b[k]!.x1) <= em);
}

const slabTop = (slab: TextItem[]): number => slab.reduce((m, it) => Math.min(m, itemTop(it)), Infinity);
const slabBottom = (slab: TextItem[]): number => slab.reduce((m, it) => Math.max(m, itemBottom(it)), -Infinity);

/** Every item of the slab falls between the same two openings. */
function oneSided(slab: TextItem[], openings: Opening[]): boolean {
  const side = (it: TextItem): number => openings.filter((o) => it.x >= (o.x0 + o.x1) / 2).length;
  const first = side(slab[0]!);
  return slab.every((it) => side(it) === first);
}

/** Partition items into columns at the given cuts. */
function splitByCuts(items: TextItem[], cuts: number[]): TextItem[][] {
  const cols: TextItem[][] = Array.from({ length: cuts.length + 1 }, () => []);
  for (const it of items) {
    let i = 0;
    while (i < cuts.length && it.x >= cuts[i]!) i++;
    cols[i]!.push(it);
  }
  return cols;
}

/**
 * The openings that can be gutters, widest first up to the column cap, then in
 * order left to right. Only an opening with text on both sides counts (`first`
 * and `last` are the leftmost and rightmost item starts), so the strip beyond a
 * section's last column cannot take one of the capped places.
 */
function gutterCuts(openings: Opening[], first: number, last: number): Gutter[] {
  return openings
    .filter((o) => first < o.x0 && last >= o.x1)
    .map((o) => ({ x: (o.x0 + o.x1) / 2, gap: o.x1 - o.x0 }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, MAX_COLUMNS - 1)
    .sort((a, b) => a.x - b.x);
}

/**
 * Some line runs on from the one above it: it opens in lower case after a line
 * with no closing stop. `lines` is in baseline order, as `toLines` returns it.
 */
function wraps(lines: TextLine[]): boolean {
  return lines.some((l, k) => k > 0 && /^\p{Ll}/u.test(l.text) && !/[.!?:]$/.test(lines[k - 1]!.text));
}

/**
 * Every line opens with a capital or a digit: each one starts something new,
 * as labels do. Lines in a script without case never qualify, since nothing
 * then shows whether they start afresh or run on.
 */
function opensEveryLine(lines: TextLine[]): boolean {
  return lines.every((l) => /^[\p{Lu}\p{Nd}]/u.test(l.text));
}

/**
 * Enough lines to be a column: four, or three when one of them wraps onto the
 * next, which is a card of prose rather than a stack of labels.
 */
function enoughLines(lines: TextLine[]): boolean {
  if (lines.length >= MIN_COLUMN_LINES) return true;
  if (lines.length < MIN_WRAPPED_COLUMN_LINES) return false;
  return wraps(lines);
}

/**
 * The share of `a`'s lines that meet a line of `b`, where `meets` is only ever
 * true for two lines whose baselines are within `reach`. Both are in baseline
 * order, so one pass over each is enough.
 */
function shareOf(a: TextLine[], b: TextLine[], reach: number, meets: (l: TextLine, o: TextLine) => boolean): number {
  if (!a.length) return 0;
  let k = 0;
  let hits = 0;
  for (const l of a) {
    while (k < b.length && b[k]!.baseline < l.baseline - reach) k++;
    for (let m = k; m < b.length && b[m]!.baseline <= l.baseline + reach; m++) {
      if (meets(l, b[m]!)) { hits++; break; }
    }
  }
  return hits / a.length;
}

const largestSize = (lines: TextLine[]): number => lines.reduce((m, l) => Math.max(m, l.size), 1);

/** The share of `a`'s lines that share some height with a line of `b`. */
const besideShare = (a: TextLine[], b: TextLine[]): number =>
  shareOf(a, b, largestSize(a) + largestSize(b), (l, o) => lineTop(l) < lineBottom(o) && lineTop(o) < lineBottom(l));

/** The share of `a`'s lines that sit on the baseline of a line of `b`. */
const pairedShare = (a: TextLine[], b: TextLine[]): number =>
  shareOf(a, b, Math.max(1, Math.max(largestSize(a), largestSize(b)) * LINE_TOLERANCE),
    (l, o) => Math.abs(l.baseline - o.baseline) <= Math.max(1, Math.min(l.size, o.size) * LINE_TOLERANCE));

/**
 * Typical WITHIN-paragraph leading of lines in baseline order, measured from the
 * page rather than assumed: a deck and a dissertation have very different ideas
 * of what a gap means.
 *
 * A low quantile, NOT the median: the deltas being measured include the
 * paragraph gaps this value is meant to detect, so the median is pulled up by
 * the very thing it is being compared against. On a three-line page (one
 * 16pt-leaded pair plus a 44pt gap) the median IS 30, and a 44pt gap then reads
 * as ordinary leading. The 25th percentile keeps reporting the body leading as
 * long as most lines are inside paragraphs, which is what "paragraph" means.
 *
 * Floored at the font's own size so one unusually tight pair (a subscript, two
 * runs that just missed the line tolerance) cannot collapse the estimate and
 * shatter the page into one-line blocks.
 */
function typicalLeading(ordered: TextLine[]): number {
  if (!ordered.length) return 0;
  const deltas: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const d = ordered[i]!.baseline - ordered[i - 1]!.baseline;
    if (d > 0) deltas.push(d);
  }
  deltas.sort((a, b) => a - b);
  const p25 = deltas.length ? deltas[Math.floor(0.25 * (deltas.length - 1))]! : 0;
  return Math.max(p25, ordered[0]!.size * 0.9) || ordered[0]!.size * 1.2;
}

/** The size carrying the most characters, and whether most characters are bold. */
function dominantStyle(lines: TextLine[]): { size: number; bold: boolean } {
  const chars = new Map<number, number>();
  let bold = 0;
  let all = 0;
  for (const l of lines) {
    chars.set(l.size, (chars.get(l.size) ?? 0) + l.text.length);
    all += l.text.length;
    if (l.bold) bold += l.text.length;
  }
  let size = lines[0]?.size ?? 0;
  let best = -1;
  for (const [s, n] of chars) if (n > best) { best = n; size = s; }
  return { size, bold: all > 0 && bold / all > 0.5 };
}

/**
 * Cut a section into rows where every column starts over at once.
 *
 * A grid of cards, or a table whose cells run to several lines, keeps its
 * gutters clear from its first row to its last, so the sweep grows one section
 * over all of it, and reading that column by column reads card 1, card 4,
 * card 2. A row ends at a slab boundary where each column with text both above
 * and below it (two at least) leaves a paragraph gap there and opens its next
 * line the way its row opened, or in bold or a larger size. At least one column
 * must open in bold or larger, so two columns of plain prose that break their
 * paragraphs on the same baseline stay one section. A column with text on one
 * side only (it ended, or has not begun) has no say.
 */
function rowsOf(slabs: TextItem[][], gutters: Gutter[], sweep: Sweep): TextItem[][][] {
  if (slabs.length < 2 || !gutters.length) return [slabs];
  const items = slabs.flat();
  sweep.steps += items.length;
  const cols = splitByCuts(items, gutters.map((g) => g.x)).map((col) => {
    const lines = toLines(col);
    return { lines, leading: typicalLeading(lines), body: dominantStyle(lines), next: 0, first: 0 };
  });
  const rows: TextItem[][][] = [];
  let from = 0;
  for (let k = 1; k < slabs.length; k++) {
    const y = slabTop(slabs[k]!);
    let sides = 0;
    let emphasised = 0;
    let restarts = true;
    for (const c of cols) {
      while (c.next < c.lines.length && c.lines[c.next]!.baseline < y) c.next++;
      if (c.next === c.first || c.next === c.lines.length) continue;
      sides++;
      const above = c.lines[c.next - 1]!;
      const below = c.lines[c.next]!;
      const opened = c.lines[c.first]!;
      const stronger = below.size > c.body.size * (1 + SIZE_SHIFT) || (below.bold && !c.body.bold);
      const repeats = Math.abs(below.size - opened.size) <= opened.size * SIZE_SHIFT && below.bold === opened.bold;
      if (below.baseline - above.baseline <= c.leading * PARA_GAP || !(stronger || repeats)) restarts = false;
      if (stronger) emphasised++;
    }
    if (restarts && sides >= 2 && emphasised > 0) {
      rows.push(slabs.slice(from, k));
      from = k;
      for (const c of cols) c.first = c.next;
    }
  }
  rows.push(slabs.slice(from));
  return rows;
}

/**
 * Split one section (or one row of it) at its gutters, or refuse.
 *
 * A column with too few lines (a page number beside the cards, an empty strip at
 * the region's edge) is merged into its neighbour across the narrower gutter,
 * and the checks run again, so one stray run cannot veto a real split. In a
 * `grid` row every cell counts, however short, because the rows around it are
 * the evidence the layout is a grid.
 */
function splitSection(items: TextItem[], gutters: Gutter[], grid: boolean, sweep: Sweep): TextItem[][] | null {
  let cuts = gutters;
  while (cuts.length) {
    if (sweep.steps + items.length > MAX_SWEEP_STEPS) return null;
    sweep.steps += items.length;
    const cols = splitByCuts(items, cuts.map((c) => c.x));
    const lines = cols.map(toLines);
    const weak = lines.findIndex((l) => (grid ? !l.length : !enoughLines(l)));
    if (weak < 0) return believableColumns(lines, Math.max(...cuts.map((c) => c.gap)), grid) ? cols : null;
    const left = weak > 0 ? cuts[weak - 1] : undefined;
    const right = weak < cuts.length ? cuts[weak] : undefined;
    const drop = !left ? weak : !right ? weak - 1 : left.gap <= right.gap ? weak - 1 : weak;
    cuts = cuts.filter((_, k) => k !== drop);
  }
  return null;
}

/**
 * Read one region into flows in reading order: top to bottom, and inside a row
 * of columns, left column first. Column numbers start again at 0 in each row;
 * a column holding two columns of its own takes two numbers.
 */
function readRegion(items: TextItem[], depth: number, sweep: Sweep): Flow[] {
  if (depth >= MAX_REGION_DEPTH || items.length < MIN_WRAPPED_COLUMN_LINES * 2) return [{ items, column: 0 }];
  const slabs = slabsOf(items);
  let lo = Infinity;
  let hi = -Infinity;
  for (const it of items) {
    if (Number.isFinite(it.x)) lo = Math.min(lo, it.x);
    if (Number.isFinite(itemRight(it))) hi = Math.max(hi, itemRight(it));
  }
  if (!(hi > lo)) return [{ items, column: 0 }];
  const open = slabs.map((s) => openingsOf(s, lo, hi, sweep.minGap));
  const firstX = slabs.map((s) => s.reduce((m, it) => Math.min(m, it.x), Infinity));
  const lastX = slabs.map((s) => s.reduce((m, it) => Math.max(m, it.x), -Infinity));

  const flows: Flow[] = [];
  let single: TextItem[] = [];
  const flush = (): void => {
    if (single.length) flows.push({ items: single, column: 0 });
    single = [];
  };
  const toSingle = (from: number, to: number): void => {
    for (let k = from; k < to; k++) single.push(...slabs[k]!);
  };
  /**
   * The last section that failed: its first and end slabs, and the openings it
   * kept clear after each of its slabs (`path[k - start]` after slab k).
   */
  let failed: { start: number; end: number; path: Opening[][] } | null = null;
  /** Go on after a failed stretch from the next slab that opens a gutter the one above it crosses. */
  const nextStart = (from: number, end: number): number => {
    let next = from + 1;
    while (next < end && !opensGutter(open[next - 1]!, open[next]!, sweep.minGap)) next++;
    return next;
  };
  let i = 0;
  /** Slabs before this index went to a section; from it on, to the single flow. */
  let done = 0;
  while (i < slabs.length) {
    if (sweep.steps >= MAX_SWEEP_STEPS) { toSingle(i, slabs.length); break; }
    // Grow the section while an opening stays clear of every slab in it and
    // the column right of it keeps its left edge.
    let clear = settleOpenings(open[i]!, lo, hi, sweep.bodySize).openings;
    const path: Opening[][] = [clear];
    let j = i + 1;
    let rejoined = false;
    while (clear.length && j < slabs.length && sweep.steps < MAX_SWEEP_STEPS) {
      sweep.steps++;
      const next = settleOpenings(intersectOpenings(clear, open[j]!, sweep.minGap), lo, hi, sweep.bodySize);
      if (!next.openings.length || next.moved) break;
      clear = next.openings;
      path.push(clear);
      // A start inside the section that just failed, whose openings are now
      // that section's openings at the same slab, reads the rest of that
      // stretch the same way, and splitting it again only tests a shorter tail.
      if (failed && j > failed.start && j < failed.end && sameOpenings(clear, failed.path[j - failed.start]!, sweep.bodySize)) { rejoined = true; break; }
      j++;
    }
    if (rejoined && failed) {
      const next = nextStart(i, failed.end);
      toSingle(i, next);
      i = next;
      continue;
    }
    // The short last line of a paragraph above leaves every gutter clear, so it
    // can open a section it does not belong to. While the section's first slab
    // sits in one column and nearer to the flow above than to the slab below,
    // it stays with the flow above.
    let start = i;
    while (start > done && start + 1 < j && oneSided(slabs[start]!, clear)
      && slabTop(slabs[start]!) - slabBottom(slabs[start - 1]!) < slabTop(slabs[start + 1]!) - slabBottom(slabs[start]!)) start++;
    let first = Infinity;
    let last = -Infinity;
    for (let k = start; k < j; k++) { first = Math.min(first, firstX[k]!); last = Math.max(last, lastX[k]!); }
    sweep.steps += j - start;
    const gutters = clear.length ? gutterCuts(clear, first, last) : [];
    const rows = gutters.length ? rowsOf(slabs.slice(start, j), gutters, sweep) : [];
    const read = rows.map((row) => {
      const rowItems = row.flat();
      return { items: rowItems, cols: splitSection(rowItems, gutters, rows.length > 1, sweep) };
    });

    if (!read.some((r) => r.cols)) {
      if (j > i + 1) failed = { start: i, end: j, path };
      const next = nextStart(i, j);
      toSingle(i, next);
      i = next;
      continue;
    }

    toSingle(i, start);
    for (const r of read) {
      if (!r.cols) { single.push(...r.items); continue; }
      flush();
      let base = 0;
      for (const col of r.cols) {
        let span = 1;
        for (const f of readRegion(col, depth + 1, sweep)) {
          flows.push({ items: f.items, column: base + f.column });
          span = Math.max(span, f.column + 1);
        }
        base += span;
      }
    }
    if (read[read.length - 1]!.cols) done = j;
    i = j;
  }
  flush();
  return flows;
}

/**
 * Is this really a multi-column layout, or a table that happens to have a gap?
 *
 * Judged on the assembled LINES rather than the items, because that is where the
 * distinction actually shows: a column of prose has lines that fill their
 * measure, whereas table cells stay short no matter how wide the column is. The
 * guard is strict on purpose: reading one column as two destroys the prose,
 * whereas reading two columns as one merely interleaves them, so ambiguity must
 * resolve to "one column".
 *
 * Two more tests look at neighbouring columns. They must run beside each other,
 * or they are entries that alternate down the page (a zig-zag timeline), whose
 * order is top to bottom. And outside a grid row, a column whose lines sit on
 * its neighbour's baselines and each open with a capital or a digit is a table
 * column (labels beside their values), which reads row by row.
 */
function believableColumns(cols: TextLine[][], widestGutter: number, grid: boolean): boolean {
  if (cols.length < 2) return false;
  const shaped = cols.every((col) => {
    if (grid ? !col.length : !enoughLines(col)) return false;
    const left = Math.min(...col.map((l) => l.x));
    const right = Math.max(...col.map((l) => l.right));
    const width = right - left;
    if (width <= 0) return false;
    // A column of text is WIDER than the gutter beside it; a column of table
    // cells is narrower than the gap beside it. This is the test that separates
    // the two, and the fill ratio alone cannot make it: when every cell in a
    // column is equally short, the column's own width IS the cell width, so the
    // ratio is a perfect 1.0 and the table sails through.
    if (width <= widestGutter) return false;
    return median(col.map((l) => (l.right - l.x) / width)) >= MIN_COLUMN_FILL;
  });
  if (!shaped) return false;
  for (let k = 1; k < cols.length; k++) {
    const a = cols[k - 1]!;
    const b = cols[k]!;
    if (Math.max(besideShare(a, b), besideShare(b, a)) < SIDE_BY_SIDE) return false;
    if (grid) continue;
    if ((pairedShare(a, b) >= TABLE_PAIRED && opensEveryLine(a)) || (pairedShare(b, a) >= TABLE_PAIRED && opensEveryLine(b))) return false;
  }
  return true;
}

// ── 4. lines → blocks ─────────────────────────────────────────────────────────

/** De-hyphenate across a line break: "inter-\nnational" → "international". */
function appendLine(acc: string, next: string): string {
  if (!acc) return next;
  if (/[\p{Ll}]-$/u.test(acc) && /^[\p{Ll}]/u.test(next)) return acc.slice(0, -1) + next;
  return `${acc} ${next}`;
}

/** One word that is a figure: a number, or a percentage. */
const FIGURE = /^[+-]?\d[\d.,]*%?$/;

/**
 * The line ends in a figure and holds no other: a row of a list with one value
 * ("Strategy 15%"). A row with several figures is a table row, which reads on
 * as one run with its neighbours.
 */
function endsInOneFigure(text: string): boolean {
  const words = text.split(' ');
  return FIGURE.test(words[words.length - 1]!) && words.filter((w) => FIGURE.test(w)).length === 1;
}

/**
 * Does `line` start a new block after `prev`?
 *
 * A paragraph gap, a change of size, and a list marker always do. A change of
 * weight does too (a bold heading at body size), unless the line runs on from
 * the one above: it opens in lower case after a line with no closing stop, so
 * a phrase set in bold mid-sentence stays in its paragraph. And two lines that
 * each end in their only figure, the second opening in capitals or a digit, are
 * rows of a list with no markers ("Strategy 15%", "Legal 10%"), not a wrapped
 * sentence.
 */
function startsBlock(prev: TextLine, line: TextLine, leading: number): boolean {
  if (line.baseline - prev.baseline > leading * PARA_GAP) return true;
  if (Math.abs(line.size - prev.size) / Math.max(prev.size, 1) > SIZE_SHIFT) return true;
  if (LIST_MARKER.test(line.text)) return true;
  const runsOn = /^\p{Ll}/u.test(line.text) && !/[.!?:]$/.test(prev.text);
  if (line.bold !== prev.bold && !runsOn) return true;
  return endsInOneFigure(prev.text) && endsInOneFigure(line.text) && /^[\p{Lu}\d]/u.test(line.text);
}

function blocksFromColumn(lines: TextLine[], column: number): TextBlock[] {
  if (!lines.length) return [];
  const ordered = [...lines].sort((a, b) => a.baseline - b.baseline);
  const leading = typicalLeading(ordered);

  const out: TextBlock[] = [];
  let buf: TextLine[] = [];

  const flush = (): void => {
    if (!buf.length) return;
    const marker = LIST_MARKER.exec(buf[0]!.text)?.[0]?.trim();
    let text = '';
    for (const l of buf) text = appendLine(text, l.text);
    // The marker is recorded once, here, and removed from the prose, so no
    // renderer downstream has to know what a bullet looks like.
    if (marker) text = text.replace(LIST_MARKER, '');
    const size = median(buf.map((l) => l.size));
    if (text.trim()) {
      out.push({
        kind: marker ? 'list-item' : 'paragraph',
        text: text.trim(),
        ...(marker ? { marker } : {}),
        size,
        bold: buf.every((l) => l.bold),
        column,
      });
    }
    buf = [];
  };

  for (const line of ordered) {
    if (buf.length && startsBlock(buf[buf.length - 1]!, line, leading)) flush();
    buf.push(line);
  }
  flush();
  return out;
}

/**
 * Build blocks from the structure tree instead of from geometry.
 *
 * Geometry is still used INSIDE an element, to join its runs into lines and
 * repair hyphenation, because that part is not a guess: within one paragraph,
 * position really does say what follows what. What the structure tree replaces
 * is everything geometry cannot know: which paragraph comes next, where one
 * block ends and the next begins, and whether something is a heading.
 *
 * That distinction is why this is a separate assembly path rather than a sort
 * applied afterwards. `toLines` and `blocksFromColumn` both re-sort by baseline,
 * so a reading rank attached to items upstream would simply be discarded; and
 * block BOUNDARIES are geometric there too, so even a correct reordering of
 * blocks would keep the wrong blocks.
 */
function taggedBlocks(items: TextItem[], tagged: TaggedElement[]): {
  blocks: TextBlock[]; used: Set<TextItem>;
} {
  const byMcid = new Map<number, TextItem[]>();
  for (const it of items) {
    if (typeof it.mcid !== 'number') continue;
    const bucket = byMcid.get(it.mcid);
    if (bucket) bucket.push(it);
    else byMcid.set(it.mcid, [it]);
  }

  const blocks: TextBlock[] = [];
  const used = new Set<TextItem>();
  let references = 0;

  for (let elementIndex = 0; elementIndex < tagged.length && elementIndex < PDF_TEXT_MAX_TAGGED_ELEMENTS; elementIndex++) {
    const el = tagged[elementIndex]!;
    if (!el || !Array.isArray(el.mcids) || typeof el.type !== 'string') continue;
    const mine: TextItem[] = [];
    for (let idIndex = 0; idIndex < el.mcids.length && idIndex < PDF_TEXT_MAX_MCIDS_PER_ELEMENT; idIndex++) {
      if (references >= PDF_TEXT_MAX_TAGGED_REFERENCES || mine.length >= PDF_TEXT_MAX_ITEMS) break;
      references++;
      for (const it of byMcid.get(el.mcids[idIndex]!) ?? []) {
        mine.push(it);
        if (mine.length >= PDF_TEXT_MAX_ITEMS) break;
      }
    }
    if (!mine.length) continue;
    for (const it of mine) used.add(it);

    // Lines within the element, then one block per element: a /P IS a paragraph.
    const lines = toLines(mine);
    if (!lines.length) continue;
    let text = '';
    for (const l of lines) text = appendLine(text, l.text);

    const marker = LIST_MARKER.exec(text)?.[0]?.trim();
    const { kind, level } = kindFromType(el.type);
    if (marker) text = text.replace(LIST_MARKER, '');
    text = text.trim();
    if (!text) continue;

    blocks.push({
      kind,
      ...(level ? { level } : {}),
      text,
      ...(marker ? { marker } : {}),
      size: median(lines.map((l) => l.size)),
      bold: lines.every((l) => l.bold),
      column: 0,
    });
  }
  return { blocks, used };
}

// ── 5. headings ───────────────────────────────────────────────────────────────

/**
 * Promote larger-than-body blocks to headings, levelled by size rank.
 *
 * Body size is the size carrying the most CHARACTERS, not the most blocks. A
 * page of one long paragraph under six big headings still has body text at the
 * paragraph's size.
 */
function markHeadings(blocks: TextBlock[]): void {
  const chars = new Map<number, number>();
  for (const b of blocks) chars.set(b.size, (chars.get(b.size) ?? 0) + b.text.length);
  let body = 0;
  let best = -1;
  for (const [size, n] of chars) if (n > best) { best = n; body = size; }
  if (!body) return;

  const headingSizes = [...new Set(blocks.filter((b) => b.size >= body * HEADING_RATIO).map((b) => b.size))]
    .sort((a, b) => b - a);

  for (const b of blocks) {
    if (b.kind === 'list-item') continue;
    const rank = headingSizes.indexOf(b.size);
    if (rank >= 0) {
      b.kind = 'heading';
      b.level = Math.min(6, rank + 1);
    }
  }
}

// ── 6. rendering ──────────────────────────────────────────────────────────────

/**
 * Join rendered blocks, keeping runs of list items tight.
 *
 * Blocks are normally separated by a blank line, but a blank line BETWEEN list
 * items makes markdown render a loose list (every item wrapped in its own
 * paragraph). Consecutive items therefore get a single newline, so a list that
 * looked like a list in the PDF still looks like one after extraction.
 */
function joinBlocks(blocks: TextBlock[], render: (b: TextBlock) => string): string {
  let out = '';
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (i) out += (b.kind === 'list-item' && blocks[i - 1]!.kind === 'list-item') ? '\n' : '\n\n';
    out += render(b);
  }
  return out.trim();
}

function blocksToText(blocks: TextBlock[]): string {
  // Plain text re-adds the document's OWN marker, so a .txt reads like the page
  // it came from rather than like markdown with the syntax filed off.
  return joinBlocks(blocks, (b) => (b.marker ? `${b.marker} ${b.text}` : b.text));
}

function blocksToMarkdown(blocks: TextBlock[]): string {
  return joinBlocks(blocks, (b) => {
    if (b.kind === 'heading') return `${'#'.repeat(b.level ?? 1)} ${b.text}`;
    if (b.kind === 'list-item') return `- ${b.text}`;
    return escapeLeading(b.text);
  });
}

// ── the pass ──────────────────────────────────────────────────────────────────

/**
 * One element of a tagged PDF's structure tree, already flattened to document
 * order by the caller (the shell owns the `/StructTreeRoot` walk, because that
 * needs a PDF object parser this module must not have).
 */
export interface TaggedElement {
  /** Marked-content ids this element owns, in document order. */
  mcids: number[];
  /** Structure type verbatim: 'P', 'H1'…'H6', 'LI', 'LBody', 'Figure', … */
  type: string;
}

export interface PdfTextOptions {
  /** Page box size, used only to judge whether an image covers the page. */
  width?: number;
  height?: number;
  /**
   * The page's structure elements in DOCUMENT order. When supplied and the page
   * is sufficiently tagged, this replaces the geometric reconstruction outright:
   * the document states its own reading order, and no heuristic can beat that.
   */
  tagged?: TaggedElement[];
}

/** Below this fraction of tagged characters the structure tree is not trusted. */
const MIN_TAGGED_COVERAGE = 0.6;

/**
 * Structure type → block kind. The document's own statement, so it OUTRANKS the
 * font-size heuristic: a `/P` set in 24pt is a paragraph the author chose to set
 * large, not a heading, and `markHeadings` must not second-guess it.
 */
function kindFromType(type: string): { kind: BlockKind; level?: number } {
  const t = type.replace(/^\//, '');
  const h = /^H([1-6])$/.exec(t);
  if (h) return { kind: 'heading', level: Number(h[1]) };
  if (t === 'H' || t === 'Title') return { kind: 'heading', level: 1 };
  if (t === 'LI' || t === 'LBody' || t === 'Lbl') return { kind: 'list-item' };
  return { kind: 'paragraph' };
}

/**
 * Reconstruct one page's prose from its interpreted nodes.
 *
 * Never throws: a page whose geometry makes no sense yields empty blocks, which
 * is a truthful answer. `scanned` distinguishes "no text on this page" from
 * "this page is a picture of text", because the two need very different words in
 * front of a user.
 */
export function extractPageText(nodes: PdfNode[], opts: PdfTextOptions = {}): PageText {
  const boundedNodes = Array.isArray(nodes) ? nodes.slice(0, PDF_TEXT_MAX_NODES) : [];
  const { items, rotated } = toItems(boundedNodes);

  if (!items.length) {
    // No text at all. If a raster covers the page, this is a scan and the right
    // answer is "needs OCR", not "empty".
    const pageArea = Math.max(1, (opts.width ?? 0) * (opts.height ?? 0));
    const covered = boundedNodes.some((n) =>
      n.kind === 'image' && (n.w * n.h) / pageArea >= SCAN_COVERAGE);
    return {
      blocks: [], text: '', markdown: '', columns: 1,
      scanned: covered, rotated, order: 'geometric',
    };
  }

  // Body size sets the gutter threshold, so it is measured from the raw items,
  // before any grouping that a wrong threshold could distort.
  const sizeChars = new Map<number, number>();
  for (const it of items) sizeChars.set(it.size, (sizeChars.get(it.size) ?? 0) + it.text.length);
  let bodySize = items[0]!.size;
  let bestChars = -1;
  for (const [s, n] of sizeChars) if (n > bestChars) { bestChars = n; bodySize = s; }

  // ── the tagged path ───────────────────────────────────────────────────────
  // A structure tree states the reading order outright, so when the page really
  // is tagged there is nothing for geometry to decide at the block level.
  if (opts.tagged?.length) {
    const { blocks: tb, used } = taggedBlocks(items, opts.tagged.slice(0, PDF_TEXT_MAX_TAGGED_ELEMENTS));
    const totalChars = items.reduce((a, it) => a + it.text.length, 0);
    const taggedChars = [...used].reduce((a, it) => a + it.text.length, 0);
    // Coverage gate: a document with a token structure tree over mostly-untagged
    // content would otherwise hand back a confident-looking fragment of itself.
    // Below the floor the tree is not trusted at all and geometry runs instead.
    if (totalChars > 0 && taggedChars / totalChars >= MIN_TAGGED_COVERAGE && tb.length) {
      // Whatever the tree did not claim is usually an artifact (a running head, a
      // page number) that genuinely sits outside the flow. It is appended, and counted
      // so a caller can report it rather than imply the page was fully tagged.
      const leftovers = items.filter((it) => !used.has(it));
      const extra = leftovers.length ? blocksFromColumn(toLines(leftovers), 0) : [];
      const blocks = [...tb, ...extra];
      return {
        blocks,
        text: blocksToText(blocks),
        markdown: blocksToMarkdown(blocks),
        columns: 1,
        scanned: false,
        rotated,
        untagged: leftovers.length,
        order: 'tagged',
      };
    }
  }

  // Find columns region by region on the items, then assemble lines inside each
  // flow. The lines are built per flow, because lines built across a gutter are
  // the interleaving this is here to prevent.
  const flows = readRegion(items, 0, { steps: 0, minGap: bodySize * GUTTER_SIZES, bodySize });
  const columns = flows.reduce((n, f) => Math.max(n, f.column + 1), 1);

  const blocks = flows.flatMap((f) => blocksFromColumn(toLines(f.items), f.column));
  markHeadings(blocks);

  return {
    blocks,
    text: blocksToText(blocks),
    markdown: blocksToMarkdown(blocks),
    columns,
    scanned: false,
    rotated,
    order: 'geometric',
  };
}

/**
 * Join extracted pages into one document.
 *
 * Pages are separated by a rule in markdown and a blank line in plain text.
 * Scanned pages become an explicit note rather than silently contributing
 * nothing. A reader must be able to tell a gap from an absence.
 */
export function joinPageText(pages: PageText[], opts: { markdown?: boolean } = {}): string {
  const md = opts.markdown !== false;
  const parts = pages.slice(0, PDF_TEXT_MAX_JOIN_PAGES).map((p, i) => {
    if (p.scanned) return md ? `> _Page ${i + 1} is a scanned image - no text layer to extract._` : `[Page ${i + 1}: scanned image, no text layer]`;
    return md ? p.markdown : p.text;
  });
  return parts.filter((s) => s.trim()).join(md ? '\n\n---\n\n' : '\n\n').trim();
}
