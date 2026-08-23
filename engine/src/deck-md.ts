// SPDX-License-Identifier: MPL-2.0
/**
 * deck-md.ts - serialise a .pptx READ-MODEL to Deck Studio's markdown dialect.
 *
 * `pptx-read.ts` recovers a positioned read-model; `community/deck-studio` parses
 * a whole markdown deck back into slides that the branded .pptx writer exports.
 * This module is the join between them, so "drop an old deck, get it back in the
 * current brand" is a tested contract rather than two halves that nearly agree.
 * The contract test is `tests/deck-roundtrip.test.ts`, which feeds this output
 * through deck-studio's own `parseSpec`.
 *
 * ── THE DIALECT (aligned to deck-studio's parser, plans/139 section 3) ────────
 *   • Slides are separated by a blank line, `---`, blank line. `---` is NEVER the
 *     first line: deck-studio strips a LEADING `---` block as YAML frontmatter.
 *     Empty chunks are dropped for the same reason.
 *   • The ph-classified title (`title`/`ctrTitle`) becomes the chunk's heading:
 *     `#` for the first slide, `##` for the rest. A slide with no placeholder
 *     title emits no heading; guessing is the placeholder cascade's job (WP7).
 *   • `subTitle` becomes the plain paragraph right after the heading. Deck Studio
 *     reads a SECOND heading as its subtitle field, but emitting one would split
 *     a single-slide deck in two: with no `---` present, `parseMarkdownDeck`
 *     falls back to splitting before every `#`/`##`. A paragraph is safe in both
 *     readings and costs only the subtitle's styling.
 *   • Body paragraphs become `-` list items, two spaces of indent per outline
 *     level. Deck Studio's `parseBody` reads exactly that: leading pairs of
 *     spaces are the level, a leading `-` is stripped, one line per bullet.
 *   • Bold runs emit `**text**`, italic `*text*`. Bold WINS when a run is both:
 *     `***text***` garbles in deck-studio's `parseRuns` (its alternation needs a
 *     non-`*` character after the opening pair). Underline has no GFM form and
 *     is dropped.
 *   • Tables are GFM pipe tables with the first row as the header. A `|` inside
 *     a cell is escaped `\|` per GFM. Deck Studio's own `parseTableSrc` splits on
 *     bare `|` and does not honour that escape (deck-builder's `splitRow` does),
 *     so such a cell splits on re-import; the markdown stays GFM-correct because
 *     it is also a deliverable in its own right.
 *   • Images emit `![](media/<n>.<ext>)` on their own line, and the returned
 *     `media` list pairs each pptx-internal part path with that emitted name so a
 *     caller can write the files or register the assets. The read-model carries
 *     no alt text, so alt is empty.
 *   • Speaker notes ride as a trailing `<!-- notes: ... -->` comment (the Marp
 *     presenter-note convention). A literal `-->` inside a note would close the
 *     comment early, so it is reduced to `->`.
 *   • Footer, slide-number and date placeholders (`ftr`, `sldNum`, `dt`) are
 *     SKIPPED. They are furniture and the branded writers regenerate them.
 *
 * Pure, DOM-free, no new deps, and never throws on a sparse or hostile model:
 * every field is treated as optional and every count is capped.
 */

import { readingOrder } from './pptx-read.ts';
import type {
  PptxDeckRead,
  PptxPicNode,
  PptxReadNode,
  PptxReadPara,
  PptxReadSlide,
  PptxTableNode,
  PptxTextNode,
} from './pptx-read.ts';

/** One image the markdown references: where it came from, what it is called. */
export interface DeckMediaRef {
  /** The pptx-internal part path, e.g. "ppt/media/image1.png". */
  path: string;
  /** The name the markdown references, e.g. "media/1.png". */
  name: string;
}

export interface DeckMarkdown {
  markdown: string;
  media: DeckMediaRef[];
}

// ── caps (a hostile read-model is the same threat model as a hostile zip) ─────

const MAX_MEDIA = 2000;
const MAX_TABLE_COLS = 64;
const MAX_TABLE_ROWS = 500;
const MAX_LINE_CHARS = 20_000;
const MAX_LEVEL = 8;

const TITLE_PH = new Set(['title', 'ctrTitle']);
const FURNITURE_PH = new Set(['ftr', 'sldNum', 'dt']);

// ── text helpers ─────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** One line of markdown: no newlines, no runaway length. */
function flatten(s: string): string {
  const one = s.replace(/\r/g, '').replace(/\n/g, ' ');
  return one.length > MAX_LINE_CHARS ? one.slice(0, MAX_LINE_CHARS) : one;
}

/**
 * Escape the two characters that change parsing in BOTH GFM and deck-studio's
 * `parseRuns`: the escape character itself and `*`. A lone `_` or `~` is inert
 * in both (deck-studio needs them doubled, CommonMark bars intra-word `_`), so
 * escaping them would only show backslashes on the slide.
 */
function escapeInline(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\*/g, '\\*');
}

/** Wrap a run in emphasis without breaking GFM's no-space-inside rule. */
function emphasise(text: string, bold: boolean, italic: boolean): string {
  if (!bold && !italic) return text;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  const core = m ? m[2] ?? '' : text;
  if (!core) return text;
  const mark = bold ? '**' : '*';
  return `${m?.[1] ?? ''}${mark}${core}${mark}${m?.[3] ?? ''}`;
}

/** One pptx paragraph to one line of inline markdown. `plain` drops the
 *  emphasis marks (headings are already emphatic - `# **Title**` is noise). */
function paraToMd(para: PptxReadPara | undefined, plain = false): string {
  const runs = Array.isArray(para?.runs) ? para.runs : [];
  let out = '';
  for (const run of runs) {
    if (run == null || typeof run !== 'object') continue;
    const raw = flatten(str(run.text));
    if (!raw) continue;
    const escaped = escapeInline(raw);
    out += plain ? escaped : emphasise(escaped, run.bold === true, run.italic === true);
  }
  return out.trim();
}

function levelOf(para: PptxReadPara | undefined): number {
  const lvl = para?.lvl;
  if (typeof lvl !== 'number' || !Number.isFinite(lvl) || lvl <= 0) return 0;
  return Math.min(Math.floor(lvl), MAX_LEVEL);
}

// ── node classification ──────────────────────────────────────────────────────

function phType(node: PptxReadNode): string {
  const ph = (node as PptxTextNode).ph;
  return ph && typeof ph.type === 'string' ? ph.type : '';
}

function isFurniture(node: PptxReadNode): boolean {
  return FURNITURE_PH.has(phType(node));
}

function textOfNode(node: PptxTextNode, plain = false): string {
  const paras = Array.isArray(node.paras) ? node.paras : [];
  return paras.map((p) => paraToMd(p, plain)).filter(Boolean).join(' ').trim();
}

// ── block emitters ───────────────────────────────────────────────────────────

function bulletsOf(node: PptxTextNode): string {
  const paras = Array.isArray(node.paras) ? node.paras : [];
  const lines: string[] = [];
  for (const para of paras) {
    const text = paraToMd(para);
    if (!text) continue;
    lines.push(`${'  '.repeat(levelOf(para))}- ${text}`);
  }
  return lines.join('\n');
}

/** Escape a table cell: pipes would split it, newlines would end the row. */
function cellOf(v: unknown): string {
  return flatten(str(v)).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').trim();
}

function tableOf(node: PptxTableNode): string {
  const rows = (Array.isArray(node.rows) ? node.rows : []).filter(Array.isArray).slice(0, MAX_TABLE_ROWS);
  if (!rows.length) return '';
  let cols = 0;
  for (const row of rows) cols = Math.max(cols, row.length);
  cols = Math.min(Math.max(cols, 1), MAX_TABLE_COLS);
  const line = (cells: unknown[]): string => {
    const out: string[] = [];
    for (let i = 0; i < cols; i++) out.push(cellOf(cells[i]));
    return `| ${out.join(' | ')} |`;
  };
  const lines = [line(rows[0] as unknown[]), `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`];
  for (let r = 1; r < rows.length; r++) lines.push(line(rows[r] as unknown[]));
  return lines.join('\n');
}

function notesOf(slide: PptxReadSlide): string {
  const notes = flattenNotes(str(slide.notes));
  return notes ? `<!-- notes: ${notes} -->` : '';
}

/** Notes may be multi-line; only a literal `-->` has to go. */
function flattenNotes(notes: string): string {
  const clean = notes.replace(/\r/g, '').replace(/-->/g, '->').trim();
  return clean.length > MAX_LINE_CHARS ? clean.slice(0, MAX_LINE_CHARS) : clean;
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Serialise a deck read-model to markdown in Deck Studio's dialect, plus the
 * media manifest the markdown references.
 *
 * @param deck a `PptxDeckRead` from `readPptx`, whole or partial.
 * @returns `{ markdown, media }`. `markdown` is empty when nothing survived.
 */
export function deckToMarkdown(deck: PptxDeckRead): DeckMarkdown {
  const media: DeckMediaRef[] = [];
  const named = new Map<string, string>();
  const nameFor = (path: string): string => {
    const existing = named.get(path);
    if (existing) return existing;
    const ext = (/\.([A-Za-z0-9]{1,8})$/.exec(path)?.[1] ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const name = `media/${named.size + 1}.${ext}`;
    named.set(path, name);
    media.push({ path, name });
    return name;
  };

  const slides = Array.isArray(deck?.slides) ? deck.slides : [];
  const chunks: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (slide == null || typeof slide !== 'object') continue;
    const blocks: string[] = [];
    const nodes = readingOrder(Array.isArray(slide.nodes) ? slide.nodes : []).filter((n) => !isFurniture(n));

    // Title and subtitle come out of reading order: a heading has to be first.
    const titleNode = nodes.find((n) => n.type === 'text' && TITLE_PH.has(phType(n))) as PptxTextNode | undefined;
    const subNode = nodes.find((n) => n.type === 'text' && phType(n) === 'subTitle') as PptxTextNode | undefined;

    if (titleNode) {
      const title = textOfNode(titleNode, true);
      if (title) blocks.push(`${i === 0 ? '#' : '##'} ${title}`);
    }
    if (subNode) {
      const sub = textOfNode(subNode);
      if (sub) blocks.push(sub);
    }

    for (const node of nodes) {
      if (node === titleNode || node === subNode) continue;
      if (node.type === 'text') {
        const bullets = bulletsOf(node as PptxTextNode);
        if (bullets) blocks.push(bullets);
      } else if (node.type === 'table') {
        const table = tableOf(node as PptxTableNode);
        if (table) blocks.push(table);
      } else if (node.type === 'pic') {
        const path = str((node as PptxPicNode).media);
        if (path && media.length < MAX_MEDIA) blocks.push(`![](${nameFor(path)})`);
      }
    }

    const notes = notesOf(slide);
    if (notes) blocks.push(notes);

    const chunk = blocks.join('\n\n').trim();
    if (chunk) chunks.push(chunk);
  }

  const markdown = chunks.length ? `${chunks.join('\n\n---\n\n')}\n` : '';
  return { markdown, media };
}
