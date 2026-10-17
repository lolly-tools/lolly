// SPDX-License-Identifier: MPL-2.0
/**
 * read-extract.ts - a file's words, tables and pictures as one list of blocks in
 * reading order, bounded by a page range and a character budget (plan 203, rank
 * 10). The Read and extract view and `lolly read --extract` both call
 * `readExtract`, and the result is a `ReadExtractV1`
 * (`@lolly-tools/core/read-extract-v1`).
 *
 * It reads a `ContentInventoryV1`, the one projection `lolly read`, `lolly_read`
 * and the fidelity check already share, so there is no second reader of the file.
 * Per page the blocks come in a fixed order: the text frames in the inventory's
 * reading order, then tables, charts, pictures and the speaker notes. Each block
 * records the source object it came from and its box on the page.
 *
 * Text the file states is kept apart from text read from pixels. A frame with
 * no `recognition` record is `authored`; one whose record gives a scan's own text
 * layer (`TEXT_LAYER_MODEL`) as its model, or a PDF's invisible text with no record,
 * is `text-layer`; any other record is `recognized`, and the block keeps the
 * recogniser's model and confidence. The words themselves are never rewritten.
 *
 * Bounds, for a caller with a context window to fill:
 *   - `pages` is a page expression (`3`, `1-4`, `2,5-7`, `9-`) or a list; a page
 *     outside the file is refused rather than skipped, so a typo is not read as
 *     an empty page;
 *   - `maxChars` caps the characters of block text returned. Blocks are taken
 *     whole while there is room. When the first block alone is longer than the
 *     budget, its start is returned, cut at a word boundary and marked `partial`,
 *     and the extract goes on from the next block. The extract then says it
 *     is not complete and gives the id of the first block left out as `next`,
 *     which the caller passes back as `from` with the same request to continue.
 *     Every call returns at least one block, so continuing always ends;
 *   - `minConfidence` leaves out recognised blocks the recogniser was less sure
 *     of, and says how many in a warning.
 *
 * Reading never runs what a file carries. `ooxmlActiveContent` reads an Office
 * package's part names for macros, controls and embedded objects, and
 * `activeContentWarnings` turns those counts (or a PDF's scripts, launch actions
 * and attachments, which a host counts) into warnings that say none of it ran.
 *
 * `extractPlainText` and `extractMarkdown` write an extract as text. Neither adds
 * words of its own to the source's: page headings and the origin notes are the
 * only additions, and a Markdown character in the source is escaped so the
 * reader sees what the file says.
 *
 * Pure and deterministic: no DOM, no filesystem, no clock.
 */

import {
  CONTENT_INVENTORY_VERSION,
  EXTRACT_BLOCK_KINDS,
  READ_EXTRACT_VERSION,
  TEXT_LAYER_MODEL,
  type ContentInventoryV1,
  type ExtractBlockKindV1,
  type ExtractBlockV1,
  type ExtractOriginV1,
  type ExtractPageReadV1,
  type ExtractPageV1,
  type ExtractRequestV1,
  type InventoryChartV1,
  type InventorySlideV1,
  type InventoryTextV1,
  type ReadExtractV1,
} from '@lolly-tools/core';

export interface ReadExtractOptsV1 {
  /** A page expression (`3`, `1-4`, `2,5-7`, `9-`) or a list of 1-based pages. Every page when absent or blank. */
  pages?: string | readonly number[];
  /** Characters of block text to return at most. No budget when absent. */
  maxChars?: number;
  /** The block kinds to return, every kind when absent. */
  kinds?: readonly ExtractBlockKindV1[];
  /** Leave out recognised blocks whose confidence is under this, 0 to 1. */
  minConfidence?: number;
  /** Continue from this block id, an earlier extract's `next`. */
  from?: string;
}

export type ReadExtractErrorCode = 'pages.invalid' | 'pages.outside' | 'budget.invalid' | 'kinds.invalid' | 'confidence.invalid' | 'from.invalid';

/** A request the extract cannot honour, with a stable code so a caller branches on `code`. */
export class ReadExtractError extends Error {
  readonly code: ReadExtractErrorCode;
  constructor(code: ReadExtractErrorCode, message: string) {
    super(message);
    this.name = 'ReadExtractError';
    this.code = code;
  }
}

/** The largest budget accepted: far past any context window, and still a safe integer. */
const MAX_BUDGET = 1_000_000_000;
const BLOCK_ID = /^p([1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

/**
 * The pages a selection asks for, ascending, each once. A blank or absent selection
 * asks for every page. A page past the last one, or a malformed token, is refused.
 */
export function parsePageSelection(selection: string | readonly number[] | undefined, pageCount: number): number[] {
  const count = Math.max(0, Math.floor(pageCount));
  const all = (): number[] => Array.from({ length: count }, (_, i) => i + 1);
  if (selection === undefined) return all();
  const picked = new Set<number>();
  const outside = (what: string): ReadExtractError => new ReadExtractError(
    'pages.outside',
    count === 0 ? `${what} is not in this file, which has no pages.` : `${what} is not in this file, which has ${count === 1 ? 'one page' : `${count} pages`}.`,
  );
  if (typeof selection !== 'string') {
    for (const n of selection) {
      if (!Number.isInteger(n) || n < 1) throw new ReadExtractError('pages.invalid', `${String(n)} is not a page number; pages count from 1.`);
      if (n > count) throw outside(`Page ${n}`);
      picked.add(n);
    }
    return [...picked].sort((a, b) => a - b);
  }
  const source = selection.trim();
  if (source === '') return all();
  for (const raw of source.split(',')) {
    const token = raw.trim();
    const single = /^(\d+)$/.exec(token);
    const range = /^(\d+)\s*-\s*(\d*)$/.exec(token);
    if (single) {
      const n = Number(single[1]);
      if (n < 1) throw new ReadExtractError('pages.invalid', 'Pages count from 1.');
      if (n > count) throw outside(`Page ${n}`);
      picked.add(n);
    } else if (range) {
      const a = Number(range[1]);
      const b = range[2] ? Number(range[2]) : count;
      if (a < 1 || b < 1) throw new ReadExtractError('pages.invalid', 'Pages count from 1.');
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      if (hi > count) throw outside(`Pages ${token}`);
      for (let n = lo; n <= hi; n++) picked.add(n);
    } else {
      throw new ReadExtractError('pages.invalid', `"${token}" is not a page or a range; write pages such as 1-3,7,10-.`);
    }
  }
  return [...picked].sort((a, b) => a - b);
}

/** Where a text frame's words came from. */
export function originOfText(frame: InventoryTextV1): ExtractOriginV1 {
  if (frame.recognition) return frame.recognition.model === TEXT_LAYER_MODEL ? 'text-layer' : 'recognized';
  return frame.hidden ? 'text-layer' : 'authored';
}

/** A chart as text: its type, then a line per series of its values against the categories. */
function chartText(chart: InventoryChartV1): string {
  const lines: string[] = [];
  if (chart.type) lines.push(`Chart: ${chart.type}`);
  if (chart.categories?.length) lines.push(chart.categories.join('\t'));
  for (const series of chart.series ?? []) {
    lines.push(`${series.name ? `${series.name}\t` : ''}${series.values.join('\t')}`);
  }
  return lines.join('\n');
}

/** Every block a slide holds, in page order, before any bound is applied. */
function slideBlocks(slide: InventorySlideV1, kinds: ReadonlySet<ExtractBlockKindV1>, files: ReadonlyMap<string, string>): ExtractBlockV1[] {
  const out: ExtractBlockV1[] = [];
  const push = (block: Omit<ExtractBlockV1, 'id' | 'page' | 'order'>): void => {
    const order = out.length;
    out.push({ id: `p${slide.number}.${order}`, page: slide.number, order, ...block });
  };
  if (kinds.has('text')) {
    for (const frame of slide.text) {
      const block: Omit<ExtractBlockV1, 'id' | 'page' | 'order'> = {
        kind: 'text', text: frame.plain, origin: originOfText(frame), role: frame.role, objectId: frame.objectId, box: { ...frame.box },
      };
      if (frame.recognition) block.recognition = { ...frame.recognition, ...(frame.recognition.languages ? { languages: [...frame.recognition.languages] } : {}) };
      push(block);
    }
  }
  if (kinds.has('table')) {
    for (const table of slide.tables) {
      push({ kind: 'table', text: table.rows.map((row) => row.join('\t')).join('\n'), objectId: table.objectId, rows: table.rows.map((row) => [...row]) });
    }
  }
  if (kinds.has('chart')) {
    for (const chart of slide.charts) {
      const data: NonNullable<ExtractBlockV1['chart']> = {};
      if (chart.type) data.type = chart.type;
      if (chart.categories) data.categories = [...chart.categories];
      if (chart.series) data.series = chart.series.map((s) => (s.name === undefined ? { values: [...s.values] } : { name: s.name, values: [...s.values] }));
      push({ kind: 'chart', text: chartText(chart), objectId: chart.objectId, chart: data });
    }
  }
  if (kinds.has('picture')) {
    for (const picture of slide.pictures) {
      const facts: NonNullable<ExtractBlockV1['picture']> = { ref: picture.ref, sha256: picture.sha256, mime: picture.mime, kind: picture.kind };
      if (picture.width) facts.width = picture.width;
      if (picture.height) facts.height = picture.height;
      const file = picture.file ?? files.get(picture.ref);
      if (file) facts.file = file;
      push({ kind: 'picture', text: picture.alt ?? '', objectId: picture.objectId, box: { ...picture.box }, picture: facts });
    }
  }
  if (kinds.has('notes') && slide.notes) push({ kind: 'notes', text: slide.notes.text, origin: 'authored' });
  return out;
}

/** How the words of a page that is one picture of its text were read. */
function pageRead(slide: InventorySlideV1): ExtractPageReadV1 {
  const origins = new Set(slide.text.map(originOfText));
  if (origins.has('recognized')) return 'recognized';
  if (origins.has('text-layer')) return 'text-layer';
  return 'not-read';
}

/** Cut text to at most `max` characters, at the last word boundary when there is one in reach. */
function cutAtWord(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const head = chars.slice(0, max).join('');
  const space = head.search(/\s\S*$/);
  return (space > 0 ? head.slice(0, space) : head).trimEnd();
}

/** Characters as a reader counts them: code points, so a surrogate pair is one. */
const lengthOf = (text: string): number => Array.from(text).length;

function checkKinds(kinds: readonly ExtractBlockKindV1[] | undefined): ExtractBlockKindV1[] {
  if (kinds === undefined) return [...EXTRACT_BLOCK_KINDS];
  const known = new Set<string>(EXTRACT_BLOCK_KINDS);
  for (const kind of kinds) {
    if (!known.has(kind)) throw new ReadExtractError('kinds.invalid', `"${String(kind)}" is not a block kind; use ${EXTRACT_BLOCK_KINDS.join(', ')}.`);
  }
  const asked = EXTRACT_BLOCK_KINDS.filter((kind) => kinds.includes(kind));
  if (asked.length === 0) throw new ReadExtractError('kinds.invalid', 'Ask for at least one block kind.');
  return asked;
}

/**
 * Project an inventory into a bounded extract. Pure: the same inventory and
 * options always give identical bytes. Throws `ReadExtractError` for a request it
 * cannot honour (a page outside the file, a budget under one character).
 */
export function readExtract(inventory: ContentInventoryV1, opts: ReadExtractOptsV1 = {}): ReadExtractV1 {
  const pageCount = inventory.slides.length;
  const pages = parsePageSelection(opts.pages, pageCount);
  const kinds = checkKinds(opts.kinds);
  const maxChars = opts.maxChars;
  if (maxChars !== undefined && (!Number.isInteger(maxChars) || maxChars < 1 || maxChars > MAX_BUDGET)) {
    throw new ReadExtractError('budget.invalid', `The budget is a whole number of characters from 1 to ${MAX_BUDGET}.`);
  }
  const minConfidence = opts.minConfidence;
  if (minConfidence !== undefined && !(Number.isFinite(minConfidence) && minConfidence >= 0 && minConfidence <= 1)) {
    throw new ReadExtractError('confidence.invalid', 'The confidence floor is a number from 0 to 1.');
  }
  let start: { page: number; order: number } | null = null;
  if (opts.from !== undefined) {
    const m = BLOCK_ID.exec(opts.from);
    if (!m) throw new ReadExtractError('from.invalid', `"${opts.from}" is not a block id; pass an extract's next value, such as p3.2.`);
    start = { page: Number(m[1]), order: Number(m[2]) };
    if (!pages.includes(start.page)) throw new ReadExtractError('from.invalid', `Block ${opts.from} is on page ${start.page}, which this request does not read.`);
  }

  const kindSet = new Set(kinds);
  const bySlide = new Map(inventory.slides.map((slide) => [slide.number, slide]));
  const files = new Map<string, string>();
  for (const m of inventory.media) if (m.file) files.set(m.ref, m.file);
  const warnings: Array<{ code: string; message: string }> = [];
  const blocks: ExtractBlockV1[] = [];
  const pageEntries: ExtractPageV1[] = [];
  let chars = 0;
  let next: string | undefined;
  let lowConfidence = 0;
  /** The id of a block the budget cut short; the block after it is where to continue. */
  let cut: string | undefined;

  for (const number of pages) {
    const slide = bySlide.get(number);
    const entry: ExtractPageV1 = { number, blocks: 0 };
    if (slide?.flattened) {
      entry.scanned = true;
      entry.read = pageRead(slide);
      if (entry.read === 'not-read') {
        warnings.push({ code: 'page-not-read', message: `Page ${number} is a picture of its text and its words were not read, so it holds no text here.` });
      }
    }
    pageEntries.push(entry);
    if (!slide || next !== undefined) continue;
    for (const block of slideBlocks(slide, kindSet, files)) {
      if (start && (number < start.page || (number === start.page && block.order < start.order))) continue;
      if (minConfidence !== undefined && block.origin === 'recognized' && (block.recognition?.confidence ?? 0) < minConfidence) {
        lowConfidence++;
        continue;
      }
      if (cut !== undefined) {
        next = block.id;
        break;
      }
      const size = lengthOf(block.text);
      if (maxChars !== undefined && chars + size > maxChars) {
        if (blocks.length === 0) {
          // Not even the first block fits: its head is returned, and the extract
          // continues after it, so a caller that keeps the same budget still ends.
          const head = cutAtWord(block.text, maxChars);
          blocks.push({ ...block, text: head, partial: true });
          chars += lengthOf(head);
          entry.blocks++;
          cut = block.id;
          continue;
        }
        next = block.id;
        break;
      }
      blocks.push(block);
      chars += size;
      entry.blocks++;
    }
  }

  if (lowConfidence > 0) {
    warnings.push({
      code: 'low-confidence-left-out',
      message: `${lowConfidence === 1 ? 'One recognised block was' : `${lowConfidence} recognised blocks were`} under the confidence floor and left out.`,
    });
  }
  if (cut !== undefined) {
    warnings.push({ code: 'block-cut-short', message: `Block ${cut} is longer than the ${maxChars} character budget, so only its start is here; a larger budget returns it whole.` });
  }
  if (next !== undefined) {
    warnings.push({ code: 'budget-reached', message: `The ${maxChars} character budget was reached; continue from block ${next}.` });
  }
  for (const w of inventory.warnings) warnings.push({ code: w.code, message: w.message });

  const request: ExtractRequestV1 = { pages, kinds };
  if (maxChars !== undefined) request.maxChars = maxChars;
  if (minConfidence !== undefined) request.minConfidence = minConfidence;
  if (opts.from !== undefined) request.from = opts.from;
  const source: ReadExtractV1['source'] = {
    name: inventory.source.name,
    sha256: inventory.source.sha256,
    bytes: inventory.source.bytes,
    kind: inventory.source.kind,
    pages: pageCount,
  };
  if (inventory.source.title) source.title = inventory.source.title;
  const out: ReadExtractV1 = {
    version: READ_EXTRACT_VERSION,
    inventory: CONTENT_INVENTORY_VERSION,
    source,
    request,
    pages: pageEntries,
    blocks,
    chars,
    complete: next === undefined && cut === undefined,
    warnings,
  };
  if (next !== undefined) out.next = next;
  return out;
}

/**
 * What a file carries that could act when opened elsewhere: macros, scripts and
 * launch actions, controls, and embedded files. Reading never runs or opens any
 * of these; the counts are there so the warnings can tell the person.
 */
export interface ActiveContentV1 {
  /** Macro project parts by name (an Office `vbaProject.bin`). */
  macros?: readonly string[];
  /** Scripts a PDF runs when opened or used. */
  scripts?: number;
  /** Actions that would open another program or file. */
  launches?: number;
  /** ActiveX or form controls in an Office package. */
  controls?: number;
  /** Embedded files and objects: a PDF's attachments, an Office package's OLE objects. */
  embedded?: number;
}

/** The active content an Office package holds, judged from its part paths alone: no part is opened. */
export function ooxmlActiveContent(partNames: Iterable<string>): ActiveContentV1 {
  const macros: string[] = [];
  let controls = 0;
  let embedded = 0;
  for (const name of partNames) {
    if (/(?:^|\/)vbaProject\.bin$/i.test(name)) macros.push(name);
    else if (/(?:^|\/)activeX\/activeX\d*\.(?:xml|bin)$/i.test(name)) controls++;
    else if (/(?:^|\/)embeddings\/[^/]+$/i.test(name)) embedded++;
  }
  const out: ActiveContentV1 = {};
  if (macros.length) out.macros = macros.sort();
  if (controls) out.controls = controls;
  if (embedded) out.embedded = embedded;
  return out;
}

const countOf = (n: number, one: string, many: string): string => (n === 1 ? `one ${one}` : `${n} ${many}`);

/** Warnings that say what a file carries and that none of it was run or opened. */
export function activeContentWarnings(content: ActiveContentV1): Array<{ code: string; message: string }> {
  const out: Array<{ code: string; message: string }> = [];
  if (content.macros?.length) {
    out.push({ code: 'macros-not-run', message: `The file carries macros (${content.macros.join(', ')}). They were not run; only the file's text and pictures were read.` });
  }
  const scripts = content.scripts ?? 0;
  const launches = content.launches ?? 0;
  if (scripts > 0 || launches > 0) {
    const what = [scripts > 0 ? countOf(scripts, 'script', 'scripts') : '', launches > 0 ? countOf(launches, 'launch action', 'launch actions') : ''].filter(Boolean).join(' and ');
    out.push({ code: 'scripts-not-run', message: `The file carries ${what}. None of them ran.` });
  }
  if ((content.controls ?? 0) > 0) {
    out.push({ code: 'controls-not-run', message: `The file carries ${countOf(content.controls!, 'control', 'controls')}. They were not run.` });
  }
  if ((content.embedded ?? 0) > 0) {
    out.push({ code: 'embedded-not-opened', message: `The file carries ${countOf(content.embedded!, 'embedded file', 'embedded files')}. They were not opened or read.` });
  }
  return out;
}

/** A confidence as a whole percentage, for the notes the text forms carry. */
const percent = (n: number): string => `${Math.round(n * 100)}%`;

/** The note a block carries in the text forms: where recognised or text-layer words came from, and a cut. */
function originNote(block: ExtractBlockV1): string | null {
  const notes: string[] = [];
  if (block.origin === 'recognized' && block.recognition) {
    notes.push(`recognised by ${block.recognition.model}, confidence ${percent(block.recognition.confidence)}`);
  } else if (block.origin === 'text-layer') {
    notes.push('from the scan text layer');
  }
  if (block.partial) notes.push('cut short by the budget');
  return notes.length ? notes.join('; ') : null;
}

/**
 * The extract as plain text: each page under a `Page N` line, blocks a blank
 * line apart, recognised blocks followed by a bracketed note naming the model and
 * its confidence.
 */
export function extractPlainText(extract: ReadExtractV1): string {
  const parts: string[] = [];
  for (const page of extract.pages) {
    const own = extract.blocks.filter((b) => b.page === page.number && b.text !== '');
    if (own.length === 0) continue;
    const body = own.map((block) => {
      const prefix = block.kind === 'notes' ? 'Notes:\n' : block.kind === 'picture' ? 'Picture: ' : '';
      const note = originNote(block);
      return `${prefix}${block.text}${note ? `\n[${note}]` : ''}`;
    });
    parts.push(`Page ${page.number}\n\n${body.join('\n\n')}`);
  }
  let text = parts.join('\n\n');
  if (!extract.complete && extract.next) text += `${text ? '\n\n' : ''}[Stopped at the budget; continue from block ${extract.next}.]`;
  return text ? `${text}\n` : '';
}

/** Escape the characters that would change what a Markdown reader shows. */
function escapeMarkdown(text: string): string {
  return text
    .replace(/([\\`*_{}[\]<>#|!])/g, '\\$1')
    .replace(/^(\s*)(\d+)\.(\s)/gm, '$1$2\\.$3')
    .replace(/^(\s*)([-+])(\s)/gm, '$1\\$2$3');
}

const cellOf = (cell: string): string => escapeMarkdown(cell).replace(/\r?\n/g, '<br>');

/**
 * The extract as Markdown: a level-two heading per page, a title frame as a
 * level-three heading, tables as pipe tables, pictures as image references to
 * the file the host wrote (or the picture hash), notes as a quote, and the origin
 * note in italics after a recognised block.
 */
export function extractMarkdown(extract: ReadExtractV1): string {
  const parts: string[] = [];
  const title = extract.source.title || extract.source.name;
  parts.push(`# ${escapeMarkdown(title)}`);
  for (const page of extract.pages) {
    const own = extract.blocks.filter((b) => b.page === page.number);
    if (own.length === 0) continue;
    parts.push(`## Page ${page.number}`);
    for (const block of own) {
      const note = originNote(block);
      if (block.kind === 'table' && block.rows && block.rows.length > 0) {
        const width = Math.max(...block.rows.map((r) => r.length));
        const pad = (row: string[]): string[] => [...row, ...Array.from({ length: width - row.length }, () => '')];
        const [head, ...rest] = block.rows.map(pad);
        parts.push([`| ${head!.map(cellOf).join(' | ')} |`, `|${' --- |'.repeat(width)}`, ...rest.map((row) => `| ${row.map(cellOf).join(' | ')} |`)].join('\n'));
      } else if (block.kind === 'picture' && block.picture) {
        parts.push(`![${escapeMarkdown(block.text)}](${block.picture.file ?? `sha256-${block.picture.sha256}`})`);
      } else if (block.kind === 'notes') {
        parts.push(`> **Notes**\n${block.text.split('\n').map((line) => `> ${escapeMarkdown(line)}`).join('\n')}`);
      } else if (block.text !== '') {
        const words = escapeMarkdown(block.text);
        parts.push(block.role === 'title' ? `### ${words.replace(/\n/g, ' ')}` : words.replace(/\n/g, '  \n'));
      }
      if (note) parts.push(`*(${note})*`);
    }
  }
  if (!extract.complete && extract.next) parts.push(`*Stopped at the budget; continue from block ${extract.next}.*`);
  return `${parts.join('\n\n')}\n`;
}
