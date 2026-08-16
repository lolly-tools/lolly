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
 *   runs → lines → columns → blocks → markdown
 *
 * PURE and DOM-free, like the rest of the engine. It takes nodes, not bytes, so
 * the same pass serves the web shell, the CLI and any future exploder surface.
 *
 * ### What the geometry can and cannot be trusted for
 *
 * `x`, `y` and `fontSize` come straight from the text matrix and are exact. `w`
 * is NOT: pdf-map estimates it as `chars × size × 0.55` because it never
 * measures glyphs. So every decision here keys off x-positions, baselines and
 * font sizes, and treats width as a soft hint (column gutters, which is the one
 * place a rough width is good enough, because a gutter is wide by definition).
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
 * Column detection is deliberately CONSERVATIVE. Splitting a page into columns
 * that are not there scrambles prose far worse than leaving real columns
 * interleaved, and the layout of a two-column page is not reliably distinguishable
 * from a two-column table. The thresholds below (wide gutter, several lines a
 * side, lines that fill their column) err toward "one column".
 */

import type { PdfNode } from './pdf-map.ts';

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

// ── shapes ────────────────────────────────────────────────────────────────────

/** One positioned fragment of text: a node, or one line of a multi-line node. */
export interface TextItem {
  text: string;
  /** Left edge, in the page's top-left y-down box space. */
  x: number;
  /** Baseline, not the box top: mixed sizes on one line share a baseline, not a top. */
  baseline: number;
  /** Estimated right edge. Soft: pdf-map does not measure glyphs. */
  right: number;
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
  /** Which column it came from, 0-based left to right. */
  column: number;
}

export interface PageText {
  blocks: TextBlock[];
  /** Plain text: blocks separated by blank lines, in reading order. */
  text: string;
  /** The same content as markdown: headings and list items marked up. */
  markdown: string;
  /** How many columns the page was read as (1 when no split was believed). */
  columns: number;
  /**
   * The page paints no text but is mostly covered by an image: a SCAN.
   * There is nothing to extract without OCR, and callers must say so rather
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
const LIST_MARKER = /^\s*(?:[•‣▪◦·–—*-]|\(?\d{1,3}[.)]|\(?[a-zA-Z][.)])\s+/;

/** Markdown control characters that would change meaning at the START of a line. */
function escapeLeading(s: string): string {
  return s.replace(/^([#>|]|\d+[.)]\s|[-*+]\s)/, '\\$1');
}

// ── 1. runs → items ───────────────────────────────────────────────────────────

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

  for (const n of nodes) {
    if (n.kind !== 'text') continue;
    const raw = n.text ?? '';
    if (!raw.trim()) continue;
    if (Math.abs(n.rot ?? 0) > MAX_SKEW_DEG) { rotated++; continue; }

    const size = Math.max(1, n.fontSize ?? 12);
    const bold = isBold(n);
    const font = String(n.fontFamily ?? '');
    const lines = raw.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const text = lines[i]!;
      if (!text.trim()) continue;
      items.push({
        text,
        x: n.x,
        // Undo pdf-map's box-top shift, then step down one line per split line
        // at the node's REAL leading when the interpreter measured one.
        baseline: n.y + size * 0.8 + i * size * (typeof n.lineHeight === 'number' && isFinite(n.lineHeight) && n.lineHeight > 0 ? n.lineHeight : 1.4),
        // 0.55em per character is pdf-map's own estimate; reused so the two
        // agree, and only ever consulted for gutter-width decisions.
        right: n.x + text.length * size * 0.55,
        size,
        font,
        bold,
        ...(typeof n.mcid === 'number' ? { mcid: n.mcid } : {}),
      });
    }
  }
  return { items, rotated };
}

// ── 2. items → lines ──────────────────────────────────────────────────────────

/** Join two fragments, inserting a space only where the geometry implies one. */
function joinFragments(acc: string, next: TextItem, prevRight: number): string {
  if (!acc) return next.text;
  if (/\s$/.test(acc) || /^\s/.test(next.text)) return acc + next.text;
  // A visible gap means a word break; touching or overlapping fragments are one
  // word split by a style change (or by kerning the estimate got slightly wrong).
  return next.x - prevRight > next.size * 0.2 ? `${acc} ${next.text}` : acc + next.text;
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
    let prevRight = -Infinity;
    for (const it of byX) {
      text = joinFragments(text, it, prevRight);
      prevRight = it.right;
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

// ── 3. lines → columns ────────────────────────────────────────────────────────

/**
 * Find the vertical gutters that separate columns, as x cut positions.
 *
 * This runs on ITEMS, before lines are assembled, and that ordering is load-
 * bearing: a two-column page very often aligns its columns on a shared baseline
 * grid, so assembling lines first splices the left and right columns into single
 * lines spanning the page, and by then there is no gutter left to find.
 *
 * The test is a merged-interval sweep over horizontal extents: a gap no item
 * crosses is a candidate gutter.
 */
interface Gutter { x: number; gap: number }

function findGutters(items: TextItem[], bodySize: number): Gutter[] {
  const spans = items.map((i) => [i.x, Math.max(i.right, i.x + 1)] as const).sort((a, b) => a[0] - b[0]);
  if (!spans.length) return [];
  const cuts: Gutter[] = [];
  let reach = spans[0]![1];
  for (const [x0, x1] of spans) {
    const gap = x0 - reach;
    if (gap >= bodySize * GUTTER_SIZES) cuts.push({ x: (reach + x0) / 2, gap });
    reach = Math.max(reach, x1);
  }
  return cuts.slice(0, MAX_COLUMNS - 1);
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
 * Is this really a multi-column layout, or a table that happens to have a gap?
 *
 * Judged on the assembled LINES rather than the items, because that is where the
 * distinction actually shows: a column of prose has lines that fill their
 * measure, whereas table cells stay short no matter how wide the column is. The
 * guard is deliberately strict: reading one column as two destroys the prose,
 * whereas reading two columns as one merely interleaves them, so ambiguity must
 * resolve to "one column".
 */
function believableColumns(cols: TextLine[][], widestGutter: number): boolean {
  if (cols.length < 2) return false;
  return cols.every((col) => {
    if (col.length < MIN_COLUMN_LINES) return false;
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
}

// ── 4. lines → blocks ─────────────────────────────────────────────────────────

/** De-hyphenate across a line break: "inter-\nnational" → "international". */
function appendLine(acc: string, next: string): string {
  if (!acc) return next;
  if (/[\p{Ll}]-$/u.test(acc) && /^[\p{Ll}]/u.test(next)) return acc.slice(0, -1) + next;
  return `${acc} ${next}`;
}

function blocksFromColumn(lines: TextLine[], column: number): TextBlock[] {
  if (!lines.length) return [];
  const ordered = [...lines].sort((a, b) => a.baseline - b.baseline);

  // Typical WITHIN-paragraph leading, measured from the page rather than assumed:
  // a deck and a dissertation have very different ideas of what a gap means.
  //
  // A low quantile, NOT the median: the deltas being measured include the
  // paragraph gaps this value is meant to detect, so the median is pulled up by
  // the very thing it is being compared against. On a three-line page (one
  // 16pt-leaded pair plus a 44pt gap) the median IS 30, and a 44pt gap then reads
  // as ordinary leading. The 25th percentile keeps reporting the body leading as
  // long as most lines are inside paragraphs, which is what "paragraph" means.
  const deltas: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const d = ordered[i]!.baseline - ordered[i - 1]!.baseline;
    if (d > 0) deltas.push(d);
  }
  deltas.sort((a, b) => a - b);
  const p25 = deltas.length ? deltas[Math.floor(0.25 * (deltas.length - 1))]! : 0;
  // Floored at the font's own size so one unusually tight pair (a subscript, two
  // runs that just missed the line tolerance) cannot collapse the estimate and
  // shatter the page into one-line blocks.
  const leading = Math.max(p25, ordered[0]!.size * 0.9) || ordered[0]!.size * 1.2;

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
    if (buf.length) {
      const prev = buf[buf.length - 1]!;
      const gap = line.baseline - prev.baseline;
      const sizeShift = Math.abs(line.size - prev.size) / Math.max(prev.size, 1) > SIZE_SHIFT;
      // A list marker always opens its own block, otherwise consecutive bullets
      // glue into one paragraph.
      if (gap > leading * PARA_GAP || sizeShift || line.bold !== prev.bold || LIST_MARKER.test(line.text)) flush();
    }
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

  for (const el of tagged) {
    const mine: TextItem[] = [];
    for (const id of el.mcids) for (const it of byMcid.get(id) ?? []) mine.push(it);
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
  const { items, rotated } = toItems(nodes);

  if (!items.length) {
    // No text at all. If a raster covers the page, this is a scan and the right
    // answer is "needs OCR", not "empty".
    const pageArea = Math.max(1, (opts.width ?? 0) * (opts.height ?? 0));
    const covered = nodes.some((n) =>
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
    const { blocks: tb, used } = taggedBlocks(items, opts.tagged);
    const totalChars = items.reduce((a, it) => a + it.text.length, 0);
    const taggedChars = [...used].reduce((a, it) => a + it.text.length, 0);
    // Coverage gate: a document with a token structure tree over mostly-untagged
    // content would otherwise hand back a confident-looking fragment of itself.
    // Below the floor the tree is not trusted at all and geometry runs instead.
    if (totalChars > 0 && taggedChars / totalChars >= MIN_TAGGED_COVERAGE && tb.length) {
      // Whatever the tree did not claim is usually an artifact (a running head, a
      // page number) that genuinely sits outside the flow. It is appended, and counted
      // so a caller can say so rather than imply the page was fully tagged.
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

  // Cut columns on items, assemble lines inside each, then check the split was
  // real. If it was not, fall back to assembling every item as one column. The
  // lines have to be rebuilt, because lines built per-column are not the lines a
  // single-column page has.
  const cuts = items.length >= MIN_COLUMN_LINES * 2 ? findGutters(items, bodySize) : [];
  let columns: TextLine[][] = cuts.length ? splitByCuts(items, cuts.map((c) => c.x)).map(toLines) : [];
  if (!believableColumns(columns, Math.max(...cuts.map((c) => c.gap), 0))) columns = [toLines(items)];

  const blocks = columns.flatMap((col, i) => blocksFromColumn(col, i));
  markHeadings(blocks);

  return {
    blocks,
    text: blocksToText(blocks),
    markdown: blocksToMarkdown(blocks),
    columns: columns.length,
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
  const parts = pages.map((p, i) => {
    if (p.scanned) return md ? `> _Page ${i + 1} is a scanned image — no text layer to extract._` : `[Page ${i + 1}: scanned image, no text layer]`;
    return md ? p.markdown : p.text;
  });
  return parts.filter((s) => s.trim()).join(md ? '\n\n---\n\n' : '\n\n').trim();
}
