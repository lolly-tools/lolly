// SPDX-License-Identifier: MPL-2.0
/**
 * Lower a rendered document DOM node into the block model the engine's document
 * writers consume. The bridge only ever receives the RENDERED node (a tool's
 * ProseMirror JSON and its `mdSource` extra never cross to the host), so the model is
 * read back off the DOM - exactly as `mdBlockDom` does for Markdown export.
 *
 * doc-studio splits its content across `.doc-page > .doc-body`; walking every
 * `.doc-body`'s children in document order reconstructs the flow while dropping the
 * running header/footer chrome (`.doc-footer-*`), which lives outside `.doc-body`.
 *
 * ── TWO PROJECTIONS, ONE WALK ────────────────────────────────────────────────
 *   • {@link domToRichDoc} produces doc-model {@link DocBlock}s: headings, styled
 *     inline runs, links, lists (nested via `level`), tables (spans included),
 *     quotes, code and images with their bytes. This is what `writeDocx` takes.
 *   • {@link domToDocBlocks} flattens that same walk to the heading/paragraph pairs
 *     `writeOdt` accepts (its block type has no richer shape), so ODT output is
 *     unchanged except that a table now yields one paragraph per row instead of one
 *     paragraph of every cell run together.
 *
 * ── WHAT DOCX STILL DROPS ────────────────────────────────────────────────────
 * Colour, font, alignment and letter-spacing (not in the block model at all);
 * horizontal rules; an image nested inside a paragraph (pictures are block-level
 * here); a nested list of the opposite kind, which folds into its parent's
 * `ordered` flag because one `list` block carries one flag. An image is carried only
 * when its bytes can be read: a `data:` URL is decoded, a `blob:`/same-origin URL is
 * fetched, and anything cross-origin (or over the byte budget) is skipped, so the
 * document keeps its text rather than failing. An SVG image travels as an SVG part -
 * LibreOffice draws it, older Word builds may not.
 */

import type { DocBlock, DocInline, DocListItem, DocTableCell, DocxMedia } from '@lolly/engine';

/** One block of the flat heading/paragraph model `writeOdt` consumes. */
export interface FlatDocBlock {
  type: 'heading' | 'paragraph';
  /** Heading outline level 1-6; omitted for paragraphs. */
  level?: number;
  text: string;
}

/** Node types, spelled numerically: this module also runs under jsdom, where the
 *  `Node` constructor is not a global. */
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/** Wrapper nesting is bounded the way `docx.ts` bounds its inline tree, so a
 *  pathological DOM cannot blow the stack. */
const MAX_DEPTH = 16;

/** Per-image and whole-document budgets for the bytes an export carries. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_MEDIA_BYTES = 32 * 1024 * 1024;

const clean = (s: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();
const collapse = (s: string): string => s.replace(/\s+/g, ' ');
const tagOf = (el: Element): string => el.tagName.toLowerCase();

// ── inline runs ──────────────────────────────────────────────────────────────

const WRAPPERS: Record<string, 'strong' | 'em' | 'underline' | 'strike'> = {
  strong: 'strong', b: 'strong',
  em: 'em', i: 'em',
  u: 'underline',
  s: 'strike', strike: 'strike', del: 'strike',
};

function inlinesOfNodes(nodes: Node[], depth: number): DocInline[] {
  const out: DocInline[] = [];
  if (depth > MAX_DEPTH) return out;
  for (const node of nodes) {
    if (node.nodeType === TEXT_NODE) {
      const text = collapse(node.nodeValue ?? '');
      if (text) out.push({ type: 'text', text });
      continue;
    }
    if (node.nodeType !== ELEMENT_NODE) continue;
    const el = node as Element;
    const tag = tagOf(el);
    const wrap = WRAPPERS[tag];
    if (wrap) {
      const inner = inlinesOfInline(el, depth + 1);
      if (inner.length) out.push({ type: wrap, inlines: inner });
      continue;
    }
    switch (tag) {
      case 'code': {
        // A code SPAN is literal by contract, so its text is taken whole.
        const text = collapse(el.textContent ?? '');
        if (text) out.push({ type: 'code', text });
        break;
      }
      case 'a': {
        const inner = inlinesOfInline(el, depth + 1);
        if (!inner.length) break;
        const href = el.getAttribute('href') ?? '';
        if (href) out.push({ type: 'link', href, inlines: inner });
        else out.push(...inner);
        break;
      }
      case 'br':
        out.push({ type: 'br' });
        break;
      // Pictures are block-level in this model; script/style text is not content.
      case 'img': case 'picture': case 'figure': case 'svg': case 'script': case 'style':
        break;
      default:
        // span / div / anything else contributes its children (marks nest, so a
        // coloured <span> around a <strong> keeps the strong).
        out.push(...inlinesOfInline(el, depth + 1));
    }
  }
  return out;
}

const inlinesOfInline = (el: Element, depth: number): DocInline[] =>
  inlinesOfNodes(Array.from(el.childNodes), depth);

/** Plain text of an inline tree - what the flat projection and the `title` need. */
function inlineText(nodes: DocInline[], depth = 0): string {
  if (depth > MAX_DEPTH) return '';
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text' || n.type === 'code') out += n.text;
    else if (n.type === 'br') out += ' ';
    else if (n.type !== 'footnoteRef') out += inlineText(n.inlines, depth + 1);
  }
  return out;
}

const hasText = (nodes: DocInline[]): boolean => inlineText(nodes).trim().length > 0;

// ── images ───────────────────────────────────────────────────────────────────

/** One picture the walk found, before its bytes are resolved. */
interface PendingImage {
  src: string;
  name: string;
  width?: number;
  height?: number;
}

const DATA_EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/bmp': 'bmp', 'image/tiff': 'tif', 'image/svg+xml': 'svg',
};

/** The extension the emitted media name carries - `writeDocx` derives the part's
 *  content type from it. Unknown sources default to png, as the writer does. */
function extOfSrc(src: string): string {
  const data = /^data:([^;,]+)/.exec(src);
  if (data) return DATA_EXT[data[1]!.toLowerCase()] ?? 'png';
  const m = /\.([a-z0-9]{1,8})$/i.exec(src.split(/[?#]/)[0] ?? '');
  return m?.[1] ? m[1].toLowerCase() : 'png';
}

function dataUrlBytes(src: string): Uint8Array | null {
  const m = /^data:[^,]*?(;base64)?,([\s\S]*)$/.exec(src);
  if (!m) return null;
  const body = m[2] ?? '';
  if (!m[1]) return new TextEncoder().encode(decodeURIComponent(body));
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Resolve each picture's bytes. `data:` decodes in place; `blob:` and same-origin
 * URLs are fetched (an object URL is what the asset bridge hands a tool, so this is
 * the common case). A failure - cross-origin without CORS, a revoked blob, an
 * oversized file - drops that one image and keeps the document.
 */
async function resolveMedia(images: PendingImage[]): Promise<DocxMedia[]> {
  const out: DocxMedia[] = [];
  let total = 0;
  for (const img of images) {
    try {
      let bytes = dataUrlBytes(img.src);
      if (!bytes) {
        const res = await fetch(img.src);
        if (!res.ok) continue;
        bytes = new Uint8Array(await res.arrayBuffer());
      }
      if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || total + bytes.length > MAX_MEDIA_BYTES) continue;
      total += bytes.length;
      out.push({
        name: img.name,
        bytes,
        ...(img.width ? { width: img.width } : {}),
        ...(img.height ? { height: img.height } : {}),
      });
    } catch {
      // Unreadable source: the `image` block stays, and writeDocx skips a ref it
      // has no bytes for.
    }
  }
  return out;
}

// ── the block walk ───────────────────────────────────────────────────────────

interface WalkCtx {
  blocks: DocBlock[];
  /** src → emitted media name, so one picture used twice is one part. */
  refs: Map<string, string>;
  images: PendingImage[];
}

/** A child that makes its parent a CONTAINER (walk into it) rather than a paragraph. */
const BLOCK_TAGS = /^(p|h[1-6]|ul|ol|table|pre|blockquote|figure|hr)$/;
const hasBlockChildren = (el: Element): boolean =>
  Array.from(el.children).some((c) => BLOCK_TAGS.test(tagOf(c)) || c.classList.contains('doc-table'));

function imageBlock(img: Element, ctx: WalkCtx): void {
  const src = img.getAttribute('src') ?? '';
  if (!src) return;
  let name = ctx.refs.get(src);
  if (!name) {
    name = `image${ctx.refs.size + 1}.${extOfSrc(src)}`;
    ctx.refs.set(src, name);
    // The laid-out box is the size the author chose (doc-studio resizes by
    // percentage of the text column); an unlaid-out node reports 0 and the writer
    // falls back to the bytes' natural size.
    const box = (img as HTMLElement).getBoundingClientRect?.();
    ctx.images.push({
      src, name,
      ...(box && box.width >= 1 ? { width: Math.round(box.width) } : {}),
      ...(box && box.height >= 1 ? { height: Math.round(box.height) } : {}),
    });
  }
  ctx.blocks.push({ type: 'image', ref: name, alt: img.getAttribute('alt') ?? '' });
}

function listItems(list: Element, level: number, items: DocListItem[], depth: number): void {
  for (const li of Array.from(list.children)) {
    if (tagOf(li) !== 'li') continue;
    const own = Array.from(li.childNodes).filter(
      (n) => !(n.nodeType === ELEMENT_NODE && /^(ul|ol)$/.test(tagOf(n as Element))),
    );
    const inlines = inlinesOfNodes(own, depth + 1);
    if (hasText(inlines)) items.push({ level, inlines });
    if (depth >= MAX_DEPTH) continue;
    for (const kid of Array.from(li.children)) {
      if (/^(ul|ol)$/.test(tagOf(kid))) listItems(kid, level + 1, items, depth + 1);
    }
  }
}

function cellOf(el: Element, depth: number): DocTableCell {
  const span = (attr: string): number | undefined => {
    const n = Number(el.getAttribute(attr));
    return Number.isFinite(n) && n > 1 ? Math.trunc(n) : undefined;
  };
  const colspan = span('colspan');
  const rowspan = span('rowspan');
  return {
    inlines: inlinesOfInline(el, depth + 1),
    ...(colspan ? { colspan } : {}),
    ...(rowspan ? { rowspan } : {}),
  };
}

/** A real `<table>`: the first row is the header when it sits in a `<thead>` or is
 *  all `<th>`. Spans are carried through, and flagged so a markdown serialiser knows
 *  a pipe table cannot express the result. */
function tableBlock(table: Element, depth: number): DocBlock | null {
  const trs = Array.from(table.querySelectorAll(':scope > tr, :scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr'));
  const rows: DocTableCell[][] = [];
  let header: DocTableCell[] | undefined;
  let spans = false;
  for (const [i, tr] of trs.entries()) {
    const cells = Array.from(tr.querySelectorAll(':scope > th, :scope > td'));
    if (!cells.length) continue;
    const row = cells.map((c) => cellOf(c, depth));
    if (row.some((c) => c.colspan || c.rowspan)) spans = true;
    const isHead = tagOf(tr.parentElement ?? tr) === 'thead' || cells.every((c) => tagOf(c) === 'th');
    if (i === 0 && isHead && !header) header = row;
    else rows.push(row);
  }
  if (!header && !rows.length) return null;
  return { type: 'table', ...(header ? { header } : {}), rows, ...(spans ? { htmlSpans: true } : {}) };
}

/** doc-studio's table is a CSS grid of `.doc-cell` divs, not a `<table>`: the column
 *  count comes from its inline `grid-template-columns: repeat(N, …)` and the cells
 *  are in row-major order. `.doc-cell-head` on every cell of the first row makes it
 *  the header row. Grid cells never merge, so no spans exist here. */
function gridTableBlock(el: Element, depth: number): DocBlock | null {
  const cells = Array.from(el.querySelectorAll(':scope > .doc-cell'));
  if (!cells.length) return null;
  const cols = Math.max(1, Number(/repeat\((\d+)/.exec(el.getAttribute('style') ?? '')?.[1] ?? cells.length));
  const rows: DocTableCell[][] = [];
  for (let i = 0; i < cells.length; i += cols) {
    rows.push(cells.slice(i, i + cols).map((c) => ({ inlines: inlinesOfInline(c, depth + 1) })));
  }
  const first = cells.slice(0, cols);
  const header = first.length && first.every((c) => c.classList.contains('doc-cell-head')) ? rows.shift() : undefined;
  if (!header && !rows.length) return null;
  return { type: 'table', ...(header ? { header } : {}), rows };
}

function walkScope(scope: Element, ctx: WalkCtx, depth: number): void {
  if (depth > MAX_DEPTH) return;
  for (const el of Array.from(scope.children)) {
    const tag = tagOf(el);
    if (/^h[1-6]$/.test(tag)) {
      const inlines = inlinesOfInline(el, depth);
      if (hasText(inlines)) ctx.blocks.push({ type: 'heading', level: Number(tag[1]), inlines });
      continue;
    }
    switch (tag) {
      case 'p': {
        const inlines = inlinesOfInline(el, depth);
        if (hasText(inlines)) ctx.blocks.push({ type: 'para', inlines });
        break;
      }
      case 'ul': case 'ol': {
        const items: DocListItem[] = [];
        listItems(el, 0, items, depth);
        if (items.length) ctx.blocks.push({ type: 'list', ordered: tag === 'ol', items });
        break;
      }
      case 'blockquote': {
        const inlines = inlinesOfInline(el, depth);
        if (hasText(inlines)) ctx.blocks.push({ type: 'quote', inlines });
        break;
      }
      case 'pre': {
        // Code keeps its line breaks and its literal spacing, so no collapsing.
        const text = (el.querySelector(':scope > code') ?? el).textContent ?? '';
        const lang = /(?:^|\s)language-([\w+-]+)/.exec(el.className || el.querySelector(':scope > code')?.className || '')?.[1];
        if (text.trim()) ctx.blocks.push({ type: 'code', ...(lang ? { lang } : {}), text: text.replace(/\n+$/, '') });
        break;
      }
      case 'table': {
        const block = tableBlock(el, depth);
        if (block) ctx.blocks.push(block);
        break;
      }
      case 'figure': case 'picture': {
        const img = el.querySelector('img');
        if (img) imageBlock(img, ctx);
        break;
      }
      case 'img':
        imageBlock(el, ctx);
        break;
      case 'hr': case 'script': case 'style':
        break;
      default: {
        if (el.classList.contains('doc-table')) {
          const block = gridTableBlock(el, depth);
          if (block) ctx.blocks.push(block);
          break;
        }
        // A wrapper (a section, a column div) contributes its blocks; anything else
        // is one paragraph of its text, which is what the flat model always did.
        if (hasBlockChildren(el)) {
          walkScope(el, ctx, depth + 1);
          break;
        }
        const inlines = inlinesOfInline(el, depth);
        if (hasText(inlines)) ctx.blocks.push({ type: 'para', inlines });
      }
    }
  }
}

function walk(root: Element): WalkCtx {
  const ctx: WalkCtx = { blocks: [], refs: new Map(), images: [] };
  const bodies = root.querySelectorAll('.doc-body');
  for (const scope of bodies.length ? Array.from(bodies) : [root]) walkScope(scope, ctx, 0);
  return ctx;
}

const titleOf = (blocks: DocBlock[]): string | undefined => {
  const first = blocks.find((b): b is Extract<DocBlock, { type: 'heading' }> => b.type === 'heading');
  return first ? clean(inlineText(first.inlines)) || undefined : undefined;
};

// ── the two projections ──────────────────────────────────────────────────────

/**
 * The rich projection: doc-model blocks plus the bytes behind every `image` block,
 * ready for `writeDocx({ title, blocks, media })`. Async only because a picture's
 * bytes may need fetching (see resolveMedia).
 */
export async function domToRichDoc(
  root: Element,
): Promise<{ title?: string; blocks: DocBlock[]; media: DocxMedia[] }> {
  const ctx = walk(root);
  const title = titleOf(ctx.blocks);
  return { ...(title ? { title } : {}), blocks: ctx.blocks, media: await resolveMedia(ctx.images) };
}

/** Flatten one rich block to the paragraphs the flat model can hold. */
function flatten(block: DocBlock): FlatDocBlock[] {
  switch (block.type) {
    case 'heading':
      return [{ type: 'heading', level: block.level, text: clean(inlineText(block.inlines)) }];
    case 'para': case 'quote':
      return [{ type: 'paragraph', text: clean(inlineText(block.inlines)) }];
    case 'list':
      return block.items.map((i) => ({ type: 'paragraph' as const, text: clean(inlineText(i.inlines)) }));
    case 'code':
      return [{ type: 'paragraph', text: clean(block.text) }];
    case 'table': {
      const rows = block.header ? [block.header, ...block.rows] : block.rows;
      return rows.map((r) => ({
        type: 'paragraph' as const,
        text: clean(r.map((c) => inlineText(c.inlines)).join(' ')),
      }));
    }
    // An image and a footnote body carry no paragraph text.
    default:
      return [];
  }
}

/**
 * Extract ordered heading/paragraph blocks from a rendered document node, plus a
 * `title` seeded from the first heading (used by `writeOdt`'s `dc:title`). Empty
 * blocks are dropped. If the node has no `.doc-body` (a non-doc-studio document),
 * falls back to walking the node's own block-level children.
 */
export function domToDocBlocks(root: Element): { title?: string; blocks: FlatDocBlock[] } {
  const rich = walk(root).blocks;
  const kept = rich.flatMap(flatten).filter((b) => b.text.length > 0);
  const title = kept.find((b) => b.type === 'heading')?.text;
  return { title, blocks: kept };
}
