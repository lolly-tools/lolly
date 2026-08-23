// SPDX-License-Identifier: MPL-2.0
/**
 * doc-md.ts - the two serialisers over `doc-model.ts`: GFM markdown, and the
 * HTML projection a rich-text editor ingests. Pure, DOM-free, no deps.
 *
 * One model in, two dialects out, so a document read by ANY reader (docx today,
 * more later) prints the same way. Every convention below is decided here once,
 * which is the point of the shared model.
 *
 * ── MARKDOWN CONVENTIONS (GFM) ───────────────────────────────────────────────
 *   • atx headings (`##`), clamped to 1..6.
 *   • `- ` unordered / `1. ` ordered, TWO spaces of indent per nesting level.
 *     Ordered items all print `1.` - a GFM renderer renumbers, and a literal
 *     count would be wrong the moment a caller reorders items.
 *   • Pipe tables, with a synthesised EMPTY header row when the model has none:
 *     GFM has no headerless table, so the alternative is losing the table.
 *   • A table with real row/col spans prints as an inline HTML `<table>` instead.
 *     GFM cannot express a span; GFM does permit inline HTML. This is the ONLY
 *     place markdown output contains a tag, and cell text is escaped first.
 *   • `[^id]` footnote references, `[^id]: text` definitions, `![alt](ref)` images.
 *   • Underline DROPS to plain text: GFM has no underline, and `<u>` would put a
 *     tag in every emphasised run.
 *
 * ── ESCAPE-FIRST DISCIPLINE (both dialects) ──────────────────────────────────
 * Text is escaped BEFORE any markup is wrapped around it, never after. That
 * ordering is the whole security model of the HTML projection (the discipline
 * `community/deck-builder/hooks.js` documents at `inlineMd`): a cell, a heading
 * or a link label carrying `<script>` or a quote character cannot emit a live
 * tag or break out of an attribute, because by the time a tag is added the user
 * text no longer contains a delimiter. Link and image URLs go through a scheme
 * allowlist on top, so a `javascript:` href from a hostile document is inert.
 */

import type { DocBlock, DocInline, DocListItem, DocTableCell } from './doc-model.ts';

/** Nesting cap for inline recursion; deeper runs are dropped, not followed. */
const MAX_INLINE_DEPTH = 32;
/** List levels beyond this are clamped, bounding both the indent and the HTML nesting. */
const MAX_LIST_LEVEL = 8;

// Characters illegal in XML 1.0 / meaningless in both dialects (the C0 controls
// except tab, LF and CR). A stray one from a binary document breaks downstream
// parsers, so it is dropped at this single chokepoint.
const stripControl = (s: string): string =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');

const inlineList = (v: DocInline[] | undefined): DocInline[] => (Array.isArray(v) ? v : []);

const clampHeading = (n: number): number =>
  Number.isFinite(n) ? Math.min(6, Math.max(1, Math.trunc(n))) : 1;

const clampListLevel = (n: number): number =>
  Number.isFinite(n) ? Math.min(MAX_LIST_LEVEL, Math.max(0, Math.trunc(n))) : 0;

// ─── URL allowlist ───────────────────────────────────────────────────────────

/**
 * A URL is emitted only when it names an allowed scheme (http/https/mailto) or
 * names no scheme at all (relative, fragment, query). Everything else -
 * `javascript:`, `vbscript:`, `file:` - yields '' and the caller renders plain
 * text. The probe strips control/whitespace first, so `java\tscript:` cannot
 * smuggle a scheme past the test.
 */
function safeUrl(raw: string): string {
  const s = stripControl(String(raw ?? '')).trim();
  if (!s) return '';
  const probe = s.replace(/&amp;/gi, '&').replace(/[\u0000-\u0020]+/g, '');
  if (/^(\/\/|\/|\.|#|\?)/.test(probe) || !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(probe)) return s;
  return /^(https?|mailto):/i.test(probe) ? s : '';
}

/** Image sources additionally allow a `data:image/…` URI: that is how a shell
 *  hands an extracted media part to an editor without a server round trip. */
function safeImageUrl(raw: string): string {
  const s = stripControl(String(raw ?? '')).trim();
  if (/^data:image\/[a-z0-9.+-]+[;,]/i.test(s)) return s;
  return safeUrl(s);
}

// ─── markdown ────────────────────────────────────────────────────────────────

// Punctuation that would start markup in running text. Backslash first so an
// escape we add is not re-escaped. Left OUT on purpose: `#`, `-`, `+`, `.` and
// digits, which only mean something at the START of a line and are handled by
// guardBlockStart - escaping them inline would litter ordinary prose.
const MD_SPECIAL = /[\\`*_[\]<>|~]/g;

const escapeMd = (s: string): string => stripControl(s).replace(MD_SPECIAL, '\\$&');

/** Neutralise a block-level marker that user text happens to begin with, so a
 *  paragraph reading "1. Introduction" stays a paragraph. */
const guardBlockStart = (s: string): string =>
  s.replace(/^([ \t]*)([#>+-]|\d+[.)])(?=\s|$)/, '$1\\$2');

/** A code span: content is literal, so the fence widens rather than escaping. */
function mdCode(text: string): string {
  const body = stripControl(text ?? '');
  let fence = '`';
  while (body.includes(fence)) fence += '`';
  const pad = body.startsWith('`') || body.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${body}${pad}${fence}`;
}

/** A markdown destination. Angle-bracket form when the URL carries whitespace or
 *  parens, which would otherwise close the destination early. */
function mdUrl(href: string, image: boolean): string {
  const safe = image ? safeImageUrl(href) : safeUrl(href);
  if (!safe) return '';
  return /[\s()<>]/.test(safe) ? `<${safe.replace(/[<>]/g, '')}>` : safe;
}

interface MdCtx {
  /** Inside a pipe-table cell a hard break must be a `<br>`; a newline would end the row. */
  inTable: boolean;
}

function mdInline(node: DocInline, ctx: MdCtx, depth: number): string {
  if (!node || typeof node !== 'object' || depth > MAX_INLINE_DEPTH) return '';
  switch (node.type) {
    case 'text':
      return escapeMd(String(node.text ?? ''));
    case 'code':
      return mdCode(String(node.text ?? ''));
    case 'br':
      // Backslash hard break outside a table: it survives trailing-space trimming,
      // which the two-space form does not.
      return ctx.inTable ? '<br>' : '\\\n';
    case 'footnoteRef':
      return `[^${mdFootnoteId(node.id)}]`;
    case 'strong': {
      const inner = mdInlines(node.inlines, ctx, depth + 1);
      return inner.trim() ? `**${inner}**` : inner;
    }
    case 'em': {
      const inner = mdInlines(node.inlines, ctx, depth + 1);
      return inner.trim() ? `*${inner}*` : inner;
    }
    case 'strike': {
      const inner = mdInlines(node.inlines, ctx, depth + 1);
      return inner.trim() ? `~~${inner}~~` : inner;
    }
    case 'underline':
      // No GFM spelling; the run survives as plain text.
      return mdInlines(node.inlines, ctx, depth + 1);
    case 'link': {
      const inner = mdInlines(node.inlines, ctx, depth + 1);
      const url = mdUrl(String(node.href ?? ''), false);
      return url ? `[${inner}](${url})` : inner;
    }
    default:
      return '';
  }
}

function mdInlines(nodes: DocInline[] | undefined, ctx: MdCtx, depth: number): string {
  let out = '';
  for (const n of inlineList(nodes)) out += mdInline(n, ctx, depth);
  return out;
}

/** Flatten to one line for the contexts that cannot hold a break (a heading, a
 *  list item, a footnote definition): the hard-break escape goes too. */
const oneLine = (s: string): string => s.replace(/\\\n/g, ' ').replace(/\n/g, ' ');

/** Footnote ids print verbatim, so keep them to label-safe characters. */
const mdFootnoteId = (id: string): string =>
  (stripControl(String(id ?? '')).replace(/[^A-Za-z0-9_-]/g, '') || '1').slice(0, 32);

function mdList(items: DocListItem[] | undefined, ordered: boolean): string {
  const lines: string[] = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || typeof item !== 'object') continue;
    const indent = '  '.repeat(clampListLevel(item.level));
    const text = oneLine(mdInlines(item.inlines, { inTable: false }, 0));
    lines.push(`${indent}${ordered ? '1. ' : '- '}${text}`);
  }
  return lines.join('\n');
}

/** True when any cell merges - a GFM pipe table cannot carry the span. */
function hasSpans(block: Extract<DocBlock, { type: 'table' }>): boolean {
  if (block.htmlSpans === true) return true;
  const cells = [...(block.header ?? []), ...(Array.isArray(block.rows) ? block.rows.flat() : [])];
  return cells.some((c) => c && ((c.colspan ?? 1) > 1 || (c.rowspan ?? 1) > 1));
}

function mdTable(block: Extract<DocBlock, { type: 'table' }>): string {
  // The escape hatch: spans go out as inline HTML rather than losing the merge.
  if (hasSpans(block)) return htmlTable(block);

  const rows = (Array.isArray(block.rows) ? block.rows : []).map((r) => (Array.isArray(r) ? r : []));
  const width = Math.max(
    block.header?.length ?? 0,
    ...rows.map((r) => r.length),
    1,
  );
  const cellText = (c: DocTableCell | undefined): string =>
    (c ? mdInlines(c.inlines, { inTable: true }, 0) : '').replace(/\n/g, ' ').trim();
  const line = (cells: DocTableCell[] | undefined): string => {
    const out: string[] = [];
    for (let i = 0; i < width; i++) out.push(cellText(cells?.[i]));
    return `| ${out.join(' | ')} |`;
  };
  // GFM requires a header row; a headerless table gets an empty one so the rows
  // stay a table instead of collapsing into paragraphs.
  const lines = [line(block.header), `|${' --- |'.repeat(width)}`];
  for (const r of rows) lines.push(line(r));
  return lines.join('\n');
}

function mdBlock(block: DocBlock): string {
  if (!block || typeof block !== 'object') return '';
  switch (block.type) {
    case 'heading':
      return `${'#'.repeat(clampHeading(block.level))} ${oneLine(mdInlines(block.inlines, { inTable: false }, 0))}`;
    case 'para':
      return guardBlockStart(mdInlines(block.inlines, { inTable: false }, 0));
    case 'quote':
      return mdInlines(block.inlines, { inTable: false }, 0)
        .split('\n')
        .map((l) => `> ${l.replace(/^\\/, '')}`)
        .join('\n');
    case 'list':
      return mdList(block.items, block.ordered === true);
    case 'table':
      return mdTable(block);
    case 'code': {
      const body = stripControl(String(block.text ?? ''));
      let fence = '```';
      while (body.includes(fence)) fence += '`';
      const lang = String(block.lang ?? '').replace(/[^A-Za-z0-9_+#-]/g, '');
      return `${fence}${lang}\n${body}\n${fence}`;
    }
    case 'image': {
      const url = mdUrl(String(block.ref ?? ''), true);
      const alt = escapeMd(String(block.alt ?? ''));
      return url ? `![${alt}](${url})` : alt;
    }
    case 'footnote':
      return `[^${mdFootnoteId(block.id)}]: ${oneLine(mdInlines(block.inlines, { inTable: false }, 0))}`;
    default:
      return '';
  }
}

/**
 * Serialise blocks to GFM markdown. Never throws: a malformed block yields ''
 * and the rest of the document still prints.
 *
 * @param blocks the document, in reading order.
 * @returns markdown with blocks separated by a blank line, no trailing newline.
 */
export function mdFromBlocks(blocks: DocBlock[]): string {
  const out: string[] = [];
  for (const b of Array.isArray(blocks) ? blocks : []) {
    const text = mdBlock(b);
    if (text.trim().length) out.push(text);
  }
  return out.join('\n\n');
}

// ─── HTML ────────────────────────────────────────────────────────────────────

/** Escape the five characters that can end an element or an attribute value.
 *  Applied to EVERY piece of user text before any tag is wrapped around it. */
const esc = (s: string): string =>
  stripControl(String(s ?? ''))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function htmlInline(node: DocInline, depth: number): string {
  if (!node || typeof node !== 'object' || depth > MAX_INLINE_DEPTH) return '';
  switch (node.type) {
    case 'text':
      return esc(node.text ?? '');
    case 'code':
      return `<code>${esc(node.text ?? '')}</code>`;
    case 'br':
      return '<br>';
    case 'footnoteRef': {
      const id = esc(mdFootnoteId(node.id));
      return `<sup><a href="#fn-${id}">${id}</a></sup>`;
    }
    case 'strong':
      return `<strong>${htmlInlines(node.inlines, depth + 1)}</strong>`;
    case 'em':
      return `<em>${htmlInlines(node.inlines, depth + 1)}</em>`;
    case 'underline':
      return `<u>${htmlInlines(node.inlines, depth + 1)}</u>`;
    case 'strike':
      return `<s>${htmlInlines(node.inlines, depth + 1)}</s>`;
    case 'link': {
      const inner = htmlInlines(node.inlines, depth + 1);
      const url = safeUrl(String(node.href ?? ''));
      return url ? `<a href="${esc(url)}">${inner}</a>` : inner;
    }
    default:
      return '';
  }
}

function htmlInlines(nodes: DocInline[] | undefined, depth: number): string {
  let out = '';
  for (const n of inlineList(nodes)) out += htmlInline(n, depth);
  return out;
}

/** Nested `<ul>`/`<ol>` from the flat level-tagged item list. Recursion is bounded
 *  by the level clamp, so a hostile level value cannot deepen the walk. */
function htmlList(items: DocListItem[] | undefined, ordered: boolean): string {
  const list = (Array.isArray(items) ? items : []).filter((i) => i && typeof i === 'object');
  const tag = ordered ? 'ol' : 'ul';
  let i = 0;
  const walk = (level: number): string => {
    const lis: string[] = [];
    while (i < list.length) {
      const item = list[i]!;
      const lvl = clampListLevel(item.level);
      if (lvl < level) break;
      if (lvl > level) {
        const child = walk(lvl);
        if (lis.length) lis[lis.length - 1] = `${lis[lis.length - 1]!.slice(0, -5)}${child}</li>`;
        else lis.push(`<li>${child}</li>`);
        continue;
      }
      i++;
      lis.push(`<li>${htmlInlines(item.inlines, 0)}</li>`);
    }
    return `<${tag}>${lis.join('')}</${tag}>`;
  };
  return walk(0);
}

/** Spans stay REAL here: an editor's table model holds colspan/rowspan, and this
 *  is also the inline-HTML table the markdown serialiser falls back to. */
function htmlTable(block: Extract<DocBlock, { type: 'table' }>): string {
  const cell = (c: DocTableCell | undefined, tag: 'td' | 'th'): string => {
    const colspan = Math.max(1, Math.trunc(c?.colspan ?? 1) || 1);
    const rowspan = Math.max(1, Math.trunc(c?.rowspan ?? 1) || 1);
    const attrs =
      (colspan > 1 ? ` colspan="${colspan}"` : '') + (rowspan > 1 ? ` rowspan="${rowspan}"` : '');
    return `<${tag}${attrs}>${htmlInlines(c?.inlines, 0)}</${tag}>`;
  };
  const head = block.header?.length
    ? `<thead><tr>${block.header.map((c) => cell(c, 'th')).join('')}</tr></thead>`
    : '';
  const body = (Array.isArray(block.rows) ? block.rows : [])
    .map((r) => `<tr>${(Array.isArray(r) ? r : []).map((c) => cell(c, 'td')).join('')}</tr>`)
    .join('');
  return `<table>${head}<tbody>${body}</tbody></table>`;
}

function htmlBlock(block: DocBlock): string {
  if (!block || typeof block !== 'object') return '';
  switch (block.type) {
    case 'heading': {
      const lvl = clampHeading(block.level);
      return `<h${lvl}>${htmlInlines(block.inlines, 0)}</h${lvl}>`;
    }
    case 'para': {
      const inner = htmlInlines(block.inlines, 0);
      return inner ? `<p>${inner}</p>` : '';
    }
    case 'quote':
      return `<blockquote><p>${htmlInlines(block.inlines, 0)}</p></blockquote>`;
    case 'list':
      return htmlList(block.items, block.ordered === true);
    case 'table':
      return htmlTable(block);
    case 'code': {
      const lang = String(block.lang ?? '').replace(/[^A-Za-z0-9_+#-]/g, '');
      const cls = lang ? ` class="language-${lang}"` : '';
      return `<pre><code${cls}>${esc(block.text ?? '')}</code></pre>`;
    }
    case 'image': {
      const url = safeImageUrl(String(block.ref ?? ''));
      const alt = esc(block.alt ?? '');
      return url ? `<img src="${esc(url)}" alt="${alt}">` : '';
    }
    case 'footnote': {
      const id = esc(mdFootnoteId(block.id));
      return `<p class="footnote" id="fn-${id}"><sup>${id}</sup> ${htmlInlines(block.inlines, 0)}</p>`;
    }
    default:
      return '';
  }
}

/**
 * Serialise blocks to the HTML projection an editor ingests (TipTap parses HTML,
 * so this is the doc-studio import path). Every piece of text is escaped before
 * any tag wraps it, and every URL passes a scheme allowlist. Never throws.
 *
 * @param blocks the document, in reading order.
 * @returns one HTML fragment, no wrapper element and no document shell.
 */
export function htmlFromBlocks(blocks: DocBlock[]): string {
  let out = '';
  for (const b of Array.isArray(blocks) ? blocks : []) out += htmlBlock(b);
  return out;
}
