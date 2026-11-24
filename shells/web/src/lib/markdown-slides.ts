// SPDX-License-Identifier: MPL-2.0
/**
 * A Markdown deck as a Design compose spec.
 *
 * The dialect is the one Markdown Slides reads and `deckToMarkdown` writes
 * (engine/src/deck-md.ts), so a deck that went through either comes back as slides:
 *
 *   - slides are separated by a line holding only `---`; with none, each `#` or `##`
 *     heading starts a slide. A leading `---` block is front matter and is left out;
 *   - the first heading of a slide is its title, a second heading its subtitle;
 *   - a paragraph before a list or a table is the subtitle, other paragraphs are body;
 *   - `-`, `*`, `+` and `1.` lines are list items, two spaces of indent per level;
 *   - a pipe table is a table, its first row the header;
 *   - `> ` lines are a quotation, and a paragraph after them says who said so;
 *   - `![alt](address)` is a picture, taken when the address is a web or data address;
 *   - `<!-- notes: ... -->` is the slide's speaker notes.
 *
 * Each slide is given a layout of the design system's slide master by what the slide
 * holds, and its words go into that layout's own placeholders. Design text reads the
 * same `**bold**`, `*italic*` and list lines as Markdown, so the body travels as
 * written. Nothing is positioned here: `composeDesignSlides` lays the slides out.
 *
 * Pure: no DOM, no clock, no network.
 */
import type { ComposeSlideV1, ComposeSlotValueV1, DesignComposeSpecV1, SlideMasterV1 } from '@lolly-tools/core';

export interface MarkdownSlideV1 {
  title: string;
  subtitle: string;
  /** Body lines in Design's text subset: paragraphs and list items. */
  body: string[];
  /** Table rows of cells, the header first; null when the slide has no table. */
  table: string[][] | null;
  quote: string[];
  images: Array<{ alt: string; src: string }>;
  notes: string;
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST = /^(\s*)(?:[-*+]|(\d+)[.)])\s+(.*)$/;
const IMAGE = /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
const NOTES = /<!--\s*notes?:\s*([\s\S]*?)-->/gi;
const RULE = /^\s*-{3,}\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** Inline Markdown that Design text has no form for, reduced to its words. */
function inline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function cells(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split(/(?<!\\)\|/).map((cell) => inline(cell.replace(/\\\|/g, '|')));
}

/** The deck's slide chunks, front matter and empty chunks left out. */
function chunksOf(markdown: string): string[] {
  let lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  if (RULE.test(lines[0] ?? '')) {
    const end = lines.findIndex((line, i) => i > 0 && RULE.test(line));
    if (end > 0) lines = lines.slice(end + 1);
  }
  const out: string[][] = [[]];
  let fenced = false;
  const ruled = lines.some((line) => RULE.test(line));
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const starts = !fenced && (ruled ? RULE.test(line) : /^#{1,2}\s/.test(line));
    if (starts) {
      out.push(ruled ? [] : [line]);
      continue;
    }
    out[out.length - 1]!.push(line);
  }
  return out.map((chunk) => chunk.join('\n')).filter((chunk) => chunk.trim() !== '');
}

function slideOf(chunk: string): MarkdownSlideV1 {
  const slide: MarkdownSlideV1 = { title: '', subtitle: '', body: [], table: null, quote: [], images: [], notes: '' };
  const notes: string[] = [];
  let text = chunk.replace(NOTES, (_all, note: string) => { notes.push(note.trim()); return ''; });
  slide.notes = notes.join('\n\n');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(IMAGE, (_all, alt: string, src: string) => { slide.images.push({ alt: alt.trim(), src }); return ''; });

  const paragraphs: string[] = [];
  let para: string[] = [];
  let seenBlock = false;   // a list or a table has started: later paragraphs are body
  const early: string[] = [];
  const flush = (): void => {
    if (!para.length) return;
    const joined = inline(para.join(' '));
    para = [];
    if (!joined) return;
    if (slide.quote.length && !seenBlock) { paragraphs.push(joined); return; }
    (seenBlock ? paragraphs : early).push(joined);
  };
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flush(); continue; }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      const words = inline(heading[2] ?? '');
      if (!slide.title) slide.title = words;
      else if (!slide.subtitle) slide.subtitle = words;
      else slide.body.push(`**${words}**`);
      continue;
    }
    if (/^\s*>/.test(line)) {
      flush();
      const words = inline(line.replace(/^\s*>\s?/, ''));
      if (words) slide.quote.push(words);
      continue;
    }
    if (/^\s*\|/.test(line) && line.includes('|', line.indexOf('|') + 1)) {
      flush();
      seenBlock = true;
      if (TABLE_RULE.test(line)) continue;
      slide.table = [...(slide.table ?? []), cells(line)];
      continue;
    }
    const item = LIST.exec(line);
    if (item) {
      flush();
      seenBlock = true;
      const level = Math.floor((item[1] ?? '').replace(/\t/g, '  ').length / 2);
      const marker = item[2] ? `${item[2]}. ` : '- ';
      slide.body.push(`${'  '.repeat(level)}${marker}${inline(item[3] ?? '')}`);
      continue;
    }
    para.push(line.trim());
  }
  flush();

  // A paragraph ahead of a list or a table is the subtitle. With neither, the first
  // paragraph is the subtitle only when no words follow, as on a title slide.
  if (early.length && !slide.subtitle && (seenBlock || early.length === 1) && !slide.quote.length) {
    slide.subtitle = early.shift()!;
  }
  slide.body = [...early, ...slide.body, ...paragraphs];
  return slide;
}

/** The deck's slides, in order. A deck with no words gives none. */
export function parseMarkdownDeck(markdown: string): MarkdownSlideV1[] {
  return chunksOf(String(markdown ?? '')).map(slideOf)
    .filter((s) => s.title || s.subtitle || s.body.length || s.table || s.quote.length || s.images.length);
}

const usable = (src: string): boolean => /^(https?:|data:image\/)/i.test(src);

/** The table as a `$table` set out in the layout's data box, as the compose suggester writes one. */
function tableValue(id: string, rows: string[][], box: { w: number; h: number }, size: { width: number; height: number }): ComposeSlotValueV1 {
  const w = Math.round(box.w * size.width);
  const h = Math.round(box.h * size.height);
  const cols = Math.max(1, ...rows.map((row) => row.length));
  const gap = Math.round(0.01 * size.width);
  const colW = Math.floor(w / cols);
  const pitch = Math.max(1, Math.min(Math.floor(h / Math.max(1, rows.length)), Math.round(0.11 * size.height)));
  const cellH = Math.max(1, pitch - gap);
  const esc = (cell: string): string => cell.replace(/([*_])/g, '\\$1');
  const [head = [], ...body] = rows;
  return {
    $table: {
      x: 0, y: 0, pitch,
      columns: Array.from({ length: cols }, (_, c) => ({ id: `${id}.table-r{r}-c${c}`, kind: 'text', x: c * colW, y: 0, w: Math.max(1, colW - gap), h: cellH, $style: 'body' })),
      rows: [
        Array.from({ length: cols }, (_, c) => ({ text: esc(head[c] ?? ''), $style: 'label' })),
        ...body.map((row) => Array.from({ length: cols }, (_, c) => esc(row[c] ?? ''))),
      ],
    },
  };
}

export interface MarkdownSpecV1 {
  spec: DesignComposeSpecV1;
  /** What could not come across, in words for the person: a picture left out, for one. */
  notes: string[];
}

/**
 * The compose spec for a Markdown deck on one slide master. `ids` gives each slide's
 * artboard id, so the caller keeps them clear of what is on the canvas already.
 */
export function markdownComposeSpec(
  markdown: string,
  master: SlideMasterV1,
  size: { width: number; height: number },
  ids: (index: number) => string = (i) => `s${String(i + 1).padStart(2, '0')}`,
): MarkdownSpecV1 {
  const has = (id: string): boolean => master.archetypes.some((a) => a.id === id);
  const pick = (...want: string[]): string => want.find(has) ?? (has('content') ? 'content' : master.archetypes[0]?.id ?? 'content');
  const roles = (id: string): Set<string> => new Set((master.archetypes.find((a) => a.id === id)?.placeholders ?? []).map((p) => String(p.role)));
  const notes: string[] = [];
  let leftOut = 0;
  let moved = 0;

  const slides: ComposeSlideV1[] = parseMarkdownDeck(markdown).map((s, index) => {
    const picture = s.images.find((img) => usable(img.src));
    leftOut += s.images.length - (picture ? 1 : 0);
    const body = s.body.join('\n');
    let archetype: string;
    if (s.quote.length && !s.table) archetype = pick('quote');
    else if (s.table) archetype = pick('table');
    else if (picture && body) archetype = pick('image-and-text', 'split', 'visual');
    else if (picture) archetype = s.title ? pick('visual', 'image-caption') : pick('full-image-plain', 'image-caption', 'visual');
    else if (!body) archetype = index === 0 ? pick('title', 'title-only') : pick('section', 'main-point', 'title-only');
    else if (s.subtitle) archetype = pick('title-subtitle-body', 'content');
    else archetype = pick('content');

    const slot = roles(archetype);
    // Words the layout has no placeholder for (a line beside a table): kept in the
    // speaker notes, and the person is told, so nothing is dropped in silence.
    let orphan = '';
    const slots: Record<string, ComposeSlotValueV1> = {};
    const put = (role: string, value: ComposeSlotValueV1): boolean => {
      if (!slot.has(role) || value === '' || value === null) return false;
      slots[role] = value;
      return true;
    };
    put('title', s.title);
    if (archetype === pick('quote') && s.quote.length) {
      put('quote', s.quote.join('\n'));
      put('attribution', [s.subtitle, ...s.body].filter(Boolean).join(' '));
    } else {
      // A subtitle the layout has no place for leads the body, so no words are lost.
      const subtitled = put('subtitle', s.subtitle);
      const lead = subtitled || !s.subtitle ? [] : [s.subtitle];
      const words = [...lead, ...s.quote.map((q) => `*${q}*`), ...(body ? [body] : [])].join('\n');
      if (!put('body', words) && words && !put('caption', words) && !put('subtitle', words)) orphan = words;
    }
    if (s.table) {
      const data = master.archetypes.find((a) => a.id === archetype)?.placeholders.find((p) => p.role === 'data');
      const id = ids(index);
      if (data) slots.data = tableValue(id, s.table, data.box, size);
      else put('body', s.table.map((row) => row.join('   ')).join('\n'));
    }
    if (picture) put('visual', { image: picture.src }) || put('data', { image: picture.src });
    if (orphan) moved += 1;
    const spoken = [s.notes, orphan].filter(Boolean).join('\n\n');
    return { archetype, id: ids(index), ...(s.title ? { name: s.title.slice(0, 80) } : {}), slots, notes: spoken || null };
  });

  if (leftOut === 1) notes.push('One picture was left out. A picture comes across when its address is a web address, one to a slide.');
  else if (leftOut > 1) notes.push(`${leftOut} pictures were left out. A picture comes across when its address is a web address, one to a slide.`);
  if (moved === 1) notes.push('On one slide, words the layout had no place for are in its speaker notes.');
  else if (moved > 1) notes.push(`On ${moved} slides, words the layout had no place for are in the speaker notes.`);
  return { spec: { size, slides }, notes };
}
