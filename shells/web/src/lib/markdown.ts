// SPDX-License-Identifier: MPL-2.0
// markdown.ts - a small, dependency-free Markdown → HTML converter for the web shell,
// plus helpers for the "paste markdown" features in Doc Studio and Multi-Page PDF.
//
// WHY HAND-ROLLED: the repo ships no markdown library by design (engine stays
// handlebars+ajv only; the web shell avoids the weight). This covers the CommonMark +
// GFM subset the two rich tools can actually represent - headings, bold/italic/strike,
// inline + fenced code, ordered/unordered/NESTED lists, GFM tables, blockquotes,
// horizontal rules, links and images. Output HTML is fed to TipTap's schema parser
// (Doc Studio) after DOMPurify, so this converter is not a trust boundary - it only
// needs to be structurally faithful, not sanitising.
//
// NOT A DUPLICATE OF THE ENGINE MARKDOWN MODULES. Four converters live in this repo
// and each one runs a different direction:
//   • this file: markdown TEXT → HTML string (plus looksLikeMarkdown and
//     splitMarkdownIntoBlocks, which take markdown in and hand markdown back).
//   • engine/src/doc-md.ts: doc-model BLOCKS → markdown, and blocks → HTML. Its
//     input is a model, never text, so it cannot stand in for this path.
//   • engine/src/template.ts's {{markdown}} helper: a narrower text → HTML dialect
//     for tool templates. No tables, no fences, a leading `>` is an arrow bullet and
//     ordered items carry <span class="md-index">, so its output is not this output.
//   • shells/web/src/bridge/export.ts renderMarkdown: a rendered DOM → markdown.
// Nothing above parses markdown into the doc-model. If a path needs that, write the
// parser once rather than folding two directions into one module.

import { escapeHtml } from './util/escape.ts';

const esc = escapeHtml;

// ── inline ────────────────────────────────────────────────────────────────────
// Order matters: protect code spans first (their content is literal), then images,
// links, then emphasis. Code placeholders use a control char that can't appear in input.
const CODE_MARK = '\u0000';

export function inlineMd(src: string): string {
  const codes: string[] = [];
  // Strip any literal NUL from the input so it can't collide with the code-span
  // sentinel (which is NUL) and leak/duplicate placeholders.
  // 1. Pull out `code spans` (and ``spans with ` inside``) as literals.
  let s = src.replace(/\u0000/g, '').replace(/(`+)([^]*?)\1/g, (_m, _ticks, code: string) => {
    codes.push(`<code>${esc(code.replace(/^ | $/g, ''))}</code>`);
    return CODE_MARK + (codes.length - 1) + CODE_MARK;
  });
  // 2. Escape the rest.
  s = esc(s);
  // 3. Images ![alt](url "title") then links [text](url). Images first (leading !).
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, alt: string, url: string) =>
    `<img src="${encodeURI(url)}" alt="${alt}">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, text: string, url: string) =>
    `<a href="${encodeURI(url)}">${text}</a>`);
  // 4. Emphasis. Bold before italic; support ** __ for bold, * _ for italic, ~~ strike.
  s = s.replace(/\*\*([^]+?)\*\*/g, '<strong>$1</strong>')
       .replace(/__([^]+?)__/g, '<strong>$1</strong>')
       .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')
       .replace(/(^|[^_\w])_(?!\s)([^_]+?)_(?![_\w])/g, '$1<em>$2</em>')
       .replace(/~~([^]+?)~~/g, '<del>$1</del>');
  // 5. Restore code spans.
  s = s.replace(new RegExp(CODE_MARK + '(\\d+)' + CODE_MARK, 'g'), (_m, i: string) => codes[+i]!);
  return s;
}

// ── block-level ────────────────────────────────────────────────────────────────
const RE_HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RE_HR = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const RE_FENCE = /^(\s*)(`{3,}|~{3,})(.*)$/;
const RE_ULI = /^(\s*)[-*+]\s+(.*)$/;
const RE_OLI = /^(\s*)(\d+)[.)]\s+(.*)$/;
const RE_QUOTE = /^ {0,3}>\s?(.*)$/;
const RE_TABLE_SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/;

const indentOf = (s: string): number => (s.match(/^\s*/)?.[0].replace(/\t/g, '  ').length ?? 0);

/** Split a GFM table row `| a | b |` into trimmed cells. */
function tableCells(row: string): string[] {
  let r = row.trim();
  if (r.startsWith('|')) r = r.slice(1);
  if (r.endsWith('|')) r = r.slice(0, -1);
  // Split on unescaped pipes.
  return r.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
}

/** Convert a Markdown string to an HTML fragment. */
export function mdToHtml(md: string): string {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  const flushList = (start: number, baseIndent: number): number => {
    // Build one list (ul/ol) at `baseIndent`; recurse for deeper-indented items.
    const ulm = lines[start]!.match(RE_ULI);
    const ordered = !ulm;
    const items: string[] = [];
    let j = start;
    while (j < lines.length) {
      const line = lines[j]!;
      if (!line.trim()) { // blank: peek - continue list only if next line is a deeper/same item
        const next = lines[j + 1] ?? '';
        if (!RE_ULI.test(next) && !RE_OLI.test(next)) break;
        j++; continue;
      }
      const m = line.match(RE_ULI) || line.match(RE_OLI);
      if (!m) break;
      const ind = indentOf(line);
      if (ind < baseIndent) break;
      if (ind > baseIndent) { // nested list belongs to the previous item
        const [nested, consumed] = [flushListHtml(j, ind), 0]; void consumed;
        const nestedEnd = listEnd(j, ind);
        if (items.length) items[items.length - 1] += nested;
        else items.push(nested);
        j = nestedEnd;
        continue;
      }
      // same-level item
      const isOrdered = !!line.match(RE_OLI);
      if (isOrdered !== ordered) break; // a different marker type → new list
      const content = (line.match(RE_ULI)?.[2] ?? line.match(RE_OLI)?.[3] ?? '');
      items.push(inlineMd(content));
      j++;
    }
    out.push(`<${ordered ? 'ol' : 'ul'}>` + items.map((it) => `<li>${it}</li>`).join('') + `</${ordered ? 'ol' : 'ul'}>`);
    return j;
  };

  // Helpers so nested lists can be built as strings without touching `out`.
  const listEnd = (start: number, baseIndent: number): number => {
    let j = start;
    while (j < lines.length) {
      const line = lines[j]!;
      if (!line.trim()) { const next = lines[j + 1] ?? ''; if (!RE_ULI.test(next) && !RE_OLI.test(next)) break; j++; continue; }
      const m = line.match(RE_ULI) || line.match(RE_OLI);
      if (!m || indentOf(line) < baseIndent) break;
      j++;
    }
    return j;
  };
  const flushListHtml = (start: number, baseIndent: number): string => {
    const ordered = !lines[start]!.match(RE_ULI);
    const items: string[] = [];
    let j = start;
    while (j < lines.length) {
      const line = lines[j]!;
      if (!line.trim()) { const next = lines[j + 1] ?? ''; if (!RE_ULI.test(next) && !RE_OLI.test(next)) break; j++; continue; }
      const m = line.match(RE_ULI) || line.match(RE_OLI);
      if (!m) break;
      const ind = indentOf(line);
      if (ind < baseIndent) break;
      if (ind > baseIndent) { const nested = flushListHtml(j, ind); if (items.length) items[items.length - 1] += nested; j = listEnd(j, ind); continue; }
      // A nested run mixing bullet + ordered markers stays in one list (the first
      // item's type) - content is preserved; matching each other's type at the same
      // nested indent is a known niche limitation (top-level lists DO split correctly).
      const content = (line.match(RE_ULI)?.[2] ?? line.match(RE_OLI)?.[3] ?? '');
      items.push(inlineMd(content));
      j++;
    }
    return `<${ordered ? 'ol' : 'ul'}>` + items.map((it) => `<li>${it}</li>`).join('') + `</${ordered ? 'ol' : 'ul'}>`;
  };

  // A GFM table starts at `idx` when it has pipes, a separator row next, and the
  // two have matching column counts. Used by BOTH table detection and the paragraph
  // exclusion below - they MUST agree, or a line that is neither advances nothing
  // (infinite loop).
  const isTableStart = (idx: number): boolean => {
    const l = lines[idx] ?? '', s = lines[idx + 1] ?? '';
    return l.includes('|') && RE_TABLE_SEP.test(s) && tableCells(l).length === tableCells(s).length;
  };

  while (i < lines.length) {
    const line = lines[i]!;

    if (!line.trim()) { i++; continue; }

    // Fenced code. The close must be a fence of the SAME char and AT LEAST the
    // opening length, so a ``` line inside a ```` block doesn't close it early.
    const fence = line.match(RE_FENCE);
    if (fence) {
      const marker = fence[2]!;
      const closeRe = new RegExp('^\\s*\\' + marker[0]! + '{' + marker.length + ',}\\s*$');
      const body: string[] = [];
      i++;
      while (i < lines.length && !closeRe.test(lines[i]!)) { body.push(lines[i]!); i++; }
      i++; // closing fence
      out.push(`<pre><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }

    // Heading
    const h = line.match(RE_HEADING);
    if (h) { const lvl = h[1]!.length; out.push(`<h${lvl}>${inlineMd(h[2]!)}</h${lvl}>`); i++; continue; }

    // Horizontal rule
    if (RE_HR.test(line)) { out.push('<hr>'); i++; continue; }

    // GFM table (the count guard rejects a prose line whose incidental pipe precedes
    // an alignment row).
    if (isTableStart(i)) {
      const header = tableCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.includes('|') && lines[i]!.trim()) { rows.push(tableCells(lines[i]!)); i++; }
      const th = header.map((c) => `<th>${inlineMd(c)}</th>`).join('');
      const trs = rows.map((r) => '<tr>' + header.map((_, ci) => `<td>${inlineMd(r[ci] ?? '')}</td>`).join('') + '</tr>').join('');
      out.push(`<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`);
      continue;
    }

    // Blockquote (collect consecutive > lines, recurse)
    if (RE_QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && RE_QUOTE.test(lines[i]!)) { inner.push(lines[i]!.match(RE_QUOTE)![1]!); i++; }
      out.push(`<blockquote>${mdToHtml(inner.join('\n'))}</blockquote>`);
      continue;
    }

    // List
    if (RE_ULI.test(line) || RE_OLI.test(line)) { i = flushList(i, indentOf(line)); continue; }

    // Paragraph: gather until a blank line or a block start
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() &&
      !RE_HEADING.test(lines[i]!) && !RE_HR.test(lines[i]!) && !RE_FENCE.test(lines[i]!) &&
      !RE_QUOTE.test(lines[i]!) && !RE_ULI.test(lines[i]!) && !RE_OLI.test(lines[i]!) &&
      !isTableStart(i)) {
      para.push(lines[i]!); i++;
    }
    out.push(`<p>${inlineMd(para.join('\n').trim()).replace(/\n/g, '<br>')}</p>`);
  }

  return out.join('\n');
}

// ── detection ───────────────────────────────────────────────────────────────────
/** Heuristic: does this plain-text look like Markdown worth converting on paste? */
export function looksLikeMarkdown(text: string): boolean {
  const t = String(text);
  if (!t.trim()) return false;
  return (
    /(^|\n) {0,3}#{1,6}\s/.test(t) ||        // heading
    /(^|\n) {0,3}[-*+]\s+\S/.test(t) ||      // bullet
    /(^|\n) {0,3}\d+[.)]\s+\S/.test(t) ||    // ordered
    /(^|\n) {0,3}>\s/.test(t) ||             // quote
    /(^|\n)\s*```/.test(t) ||                // fence
    /(^|\n) {0,3}([-*_])(\s*\1){2,}\s*$/m.test(t) || // hr
    /\|.*\|/.test(t) && /(^|\n)\s*\|?\s*:?-{2,}/.test(t) || // table
    /!?\[[^\]]*\]\([^)]+\)/.test(t) ||       // link / image
    /\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`/.test(t) // inline emphasis / code
  );
}

// ── split into per-heading blocks (Multi-Page PDF) ────────────────────────────────
export interface MdBlock { heading: string; body: string }

/**
 * Split a Markdown document into blocks segmented by top-level (# / ##) headings - 
 * each heading becomes a block heading, the prose beneath it the block body (still
 * Markdown, rendered by the tool's {{markdown}} helper). Content before the first
 * heading becomes a heading-less lead block. Long heading-less runs are further split
 * on blank lines so no single block is too tall to fit one page cell.
 */
export function splitMarkdownIntoBlocks(md: string, maxCharsPerBlock = 900): MdBlock[] {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  let heading = '';
  let body: string[] = [];
  const push = (): void => {
    const text = body.join('\n').trim();
    if (heading || text) {
      // Split an over-long heading-less/long body on blank lines into page-sized chunks.
      if (text.length > maxCharsPerBlock) {
        const paras = text.split(/\n{2,}/);
        let chunk = '';
        let first = true;
        for (const p of paras) {
          if (chunk && (chunk.length + p.length) > maxCharsPerBlock) {
            blocks.push({ heading: first ? heading : '', body: chunk.trim() }); first = false; chunk = '';
          }
          chunk += (chunk ? '\n\n' : '') + p;
        }
        if (chunk.trim() || first) blocks.push({ heading: first ? heading : '', body: chunk.trim() });
      } else {
        blocks.push({ heading, body: text });
      }
    }
    heading = ''; body = [];
  };
  let inFence = false, fenceCh = '';
  for (const line of lines) {
    // Track fenced code so a '#'/'##' comment line INSIDE a fence isn't mistaken
    // for a heading (would shred a pasted code block across page blocks).
    const fm = line.match(/^\s*(`{3,}|~{3,})/);
    if (fm) {
      if (!inFence) { inFence = true; fenceCh = fm[1]![0]!; }
      else if (line.trim()[0] === fenceCh) inFence = false;
      body.push(line); continue;
    }
    if (inFence) { body.push(line); continue; }
    const h = line.match(/^(#{1,2})\s+(.*?)\s*#*\s*$/); // split on # / ## only (## stays inside body via deeper levels)
    if (h) { push(); heading = h[2]!.trim(); continue; }
    body.push(line);
  }
  push();
  return blocks.filter((b) => b.heading || b.body);
}
