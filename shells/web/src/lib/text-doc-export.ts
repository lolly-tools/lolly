// SPDX-License-Identifier: MPL-2.0
/**
 * text-doc-export.ts - download a text/markdown catalog asset as a formatted
 * document: standalone HTML, RTF, DOCX, ODT (raw text needs no converter).
 *
 * One tiny markdown block parser feeds all four emitters, so every format
 * renders the same structure and none can drift from the others. Hand-rolled
 * on purpose: the repo ships no markdown library (see the header of
 * lib/markdown.ts for the house stance) - this covers the same modest subset
 * where it applies, but produces typed blocks/runs instead of HTML, because
 * RTF and the two XML packages need structure, not markup.
 *
 * Dependency-free except zipAsync (the shell's one fflate wrapper) for the
 * DOCX/ODT containers. This module builds STRINGS and bytes only - it never
 * touches the DOM, so the HTML it emits is safe by construction: every piece
 * of user text is escaped and link schemes are vetted at parse time.
 */
import { zipAsync } from './zip.ts';

// ── block + run model ─────────────────────────────────────────────────────────

export interface MdRun { text: string; bold?: boolean; italic?: boolean; code?: boolean; strike?: boolean; href?: string }

export type MdBlock =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; runs: MdRun[] }
  | { kind: 'para'; runs: MdRun[] }
  | { kind: 'bullet'; level: number; runs: MdRun[] }
  | { kind: 'ordered'; level: number; runs: MdRun[] }
  | { kind: 'code'; text: string }
  | { kind: 'quote'; runs: MdRun[] }
  | { kind: 'rule' };

type ListBlock = Extract<MdBlock, { kind: 'bullet' | 'ordered' }>;

// ── inline parsing ────────────────────────────────────────────────────────────

/** Only these schemes survive onto a run's href; anything else (including a
 *  scheme-less/relative url) drops the href and keeps the link text. */
const SAFE_HREF = /^(?:https?|mailto):/i;

const RE_CODE_SPAN = /(`+)([^]*?)\1/;
const RE_LINK = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/;
const RE_BOLD_STAR = /\*\*([^]+?)\*\*/;
const RE_BOLD_UNDER = /__([^]+?)__/;
const RE_STRIKE = /~~([^]+?)~~/;
// The leading (^|[^*]) / (^|[^_\w]) guards mirror lib/markdown.ts: a * inside a
// bold marker and an _ inside snake_case never open an italic span. The match
// index is adjusted past that guard character below.
const RE_ITAL_STAR = /(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/;
const RE_ITAL_UNDER = /(^|[^_\w])_(?!\s)([^_]+?)_(?![_\w])/;

interface InlineFlags { bold?: boolean; italic?: boolean; strike?: boolean; href?: string }

interface InlineHit { index: number; length: number; type: 'code' | 'bold' | 'italic' | 'strike' | 'link'; content: string; url?: string }

/** Earliest inline token in `src`. Ties go to the earlier consider() call, so
 *  the order here is the precedence: code spans are literal and beat all
 *  emphasis, bold beats italic (`**` would otherwise open an italic). */
function firstMatch(src: string): InlineHit | null {
  let best: InlineHit | null = null;
  const consider = (hit: InlineHit): void => {
    if (best === null || hit.index < best.index) best = hit;
  };
  const code = RE_CODE_SPAN.exec(src);
  if (code) consider({ index: code.index, length: code[0].length, type: 'code', content: code[2]!.replace(/^ | $/g, '') });
  const bs = RE_BOLD_STAR.exec(src);
  if (bs) consider({ index: bs.index, length: bs[0].length, type: 'bold', content: bs[1]! });
  const bu = RE_BOLD_UNDER.exec(src);
  if (bu) consider({ index: bu.index, length: bu[0].length, type: 'bold', content: bu[1]! });
  const st = RE_STRIKE.exec(src);
  if (st) consider({ index: st.index, length: st[0].length, type: 'strike', content: st[1]! });
  const ln = RE_LINK.exec(src);
  if (ln) consider({ index: ln.index, length: ln[0].length, type: 'link', content: ln[1]!, url: ln[2]! });
  const is = RE_ITAL_STAR.exec(src);
  if (is) consider({ index: is.index + is[1]!.length, length: is[0].length - is[1]!.length, type: 'italic', content: is[2]! });
  const iu = RE_ITAL_UNDER.exec(src);
  if (iu) consider({ index: iu.index + iu[1]!.length, length: iu[0].length - iu[1]!.length, type: 'italic', content: iu[2]! });
  return best;
}

/** Build an MdRun with only the flags that are actually set, so run objects
 *  stay comparable with plain property equality (see mergeRuns). */
function makeRun(text: string, f: InlineFlags, code = false): MdRun {
  const r: MdRun = { text };
  if (f.bold) r.bold = true;
  if (f.italic) r.italic = true;
  if (code) r.code = true;
  if (f.strike) r.strike = true;
  if (f.href !== undefined) r.href = f.href;
  return r;
}

/** Recursive descent over the inline tokens; nested emphasis inherits the
 *  accumulated flags. Code span content is literal and never re-parsed. */
function parseInline(src: string, flags: InlineFlags): MdRun[] {
  const runs: MdRun[] = [];
  let rest = src;
  while (rest.length) {
    const hit = firstMatch(rest);
    if (!hit) { runs.push(makeRun(rest, flags)); break; }
    if (hit.index > 0) runs.push(makeRun(rest.slice(0, hit.index), flags));
    if (hit.type === 'code') runs.push(makeRun(hit.content, flags, true));
    else if (hit.type === 'bold') runs.push(...parseInline(hit.content, { ...flags, bold: true }));
    else if (hit.type === 'italic') runs.push(...parseInline(hit.content, { ...flags, italic: true }));
    else if (hit.type === 'strike') runs.push(...parseInline(hit.content, { ...flags, strike: true }));
    else {
      const href = hit.url !== undefined && SAFE_HREF.test(hit.url) ? hit.url : undefined;
      runs.push(...parseInline(hit.content, href !== undefined ? { ...flags, href } : flags));
    }
    rest = rest.slice(hit.index + hit.length);
  }
  return runs;
}

/** Merge adjacent runs with identical formatting and drop empties, so emitters
 *  see one run per styled span rather than parser fragments. */
function mergeRuns(runs: MdRun[]): MdRun[] {
  const out: MdRun[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const prev = out[out.length - 1];
    if (prev && prev.bold === r.bold && prev.italic === r.italic && prev.code === r.code && prev.strike === r.strike && prev.href === r.href) {
      prev.text += r.text;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

const inline = (src: string): MdRun[] => mergeRuns(parseInline(src, {}));

// ── block parsing ─────────────────────────────────────────────────────────────

const RE_HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
// Checked BEFORE the bullet pattern: "* * *" is a rule, not a list item.
const RE_HR = /^\s*([-*])(?:\s*\1){2,}\s*$/;
const RE_FENCE = /^\s*`{3,}/;
const RE_FENCE_CLOSE = /^\s*`{3,}\s*$/;
const RE_BULLET = /^(\s*)[-*+]\s+(.*)$/;
const RE_ORDERED = /^(\s*)\d+[.)]\s+(.*)$/;
const RE_QUOTE = /^\s*>\s?(.*)$/;

/** Leading-whitespace width with tabs counted as two spaces (the list nesting
 *  unit), matching lib/markdown.ts's indentOf. */
const indentOf = (s: string): number => (/^[\t ]*/.exec(s)?.[0] ?? '').replace(/\t/g, '  ').length;

/**
 * Parse markdown-ish text into the flat block list every emitter consumes.
 * Each list ITEM is its own block; nesting depth (2 spaces per level, 0-based)
 * rides on the block. Plain prose with no markdown shape comes out as para
 * blocks, which is exactly what a .txt asset should do.
 */
export function parseMdBlocks(text: string): MdBlock[] {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) { i++; continue; }

    // Fenced code: verbatim, no inline parsing, fence language ignored. The
    // close is any backtick-only line (an unclosed fence runs to EOF).
    if (RE_FENCE.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !RE_FENCE_CLOSE.test(lines[i]!)) { body.push(lines[i]!); i++; }
      i++; // past the closing fence
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }

    const h = line.match(RE_HEADING);
    if (h) {
      blocks.push({ kind: 'heading', level: h[1]!.length as 1 | 2 | 3 | 4 | 5 | 6, runs: inline(h[2]!) });
      i++; continue;
    }

    if (RE_HR.test(line)) { blocks.push({ kind: 'rule' }); i++; continue; }

    const ul = line.match(RE_BULLET);
    const ol = ul ? null : line.match(RE_ORDERED);
    if (ul || ol) {
      const level = Math.floor(indentOf(line) / 2);
      if (ul) blocks.push({ kind: 'bullet', level, runs: inline(ul[2]!) });
      else blocks.push({ kind: 'ordered', level, runs: inline(ol![2]!) });
      i++; continue;
    }

    // Blockquote: consecutive > lines are one quote, joined with a space (the
    // same joining rule as paragraphs - nested structure inside quotes is out
    // of this converter's modest scope).
    if (RE_QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && RE_QUOTE.test(lines[i]!)) { inner.push(lines[i]!.match(RE_QUOTE)![1]!); i++; }
      blocks.push({ kind: 'quote', runs: inline(inner.join(' ').trim()) });
      continue;
    }

    // Paragraph: consecutive non-blank lines join with a space, stopping at
    // any block opener so a heading straight after prose still parses.
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() &&
      !RE_HEADING.test(lines[i]!) && !RE_HR.test(lines[i]!) && !RE_FENCE.test(lines[i]!) &&
      !RE_BULLET.test(lines[i]!) && !RE_ORDERED.test(lines[i]!) && !RE_QUOTE.test(lines[i]!)) {
      para.push(lines[i]!.trim()); i++;
    }
    blocks.push({ kind: 'para', runs: inline(para.join(' ')) });
  }
  return blocks;
}

// ── shared emitter helpers ────────────────────────────────────────────────────

/**
 * Ordered-item numbers, computed once so RTF/DOCX/ODT number identically:
 * nums[i] is the 1-based number for an ordered block, 0 otherwise. A counter
 * restarts when its contiguous run at that level breaks - any non-list block
 * clears everything, a bullet clears its level and deeper, and returning to a
 * shallower ordered level clears the deeper counters.
 */
function orderedNumbers(blocks: MdBlock[]): number[] {
  const nums: number[] = [];
  const counters = new Map<number, number>();
  blocks.forEach((b, i) => {
    if (b.kind === 'ordered') {
      for (const lvl of [...counters.keys()]) if (lvl > b.level) counters.delete(lvl);
      const n = (counters.get(b.level) ?? 0) + 1;
      counters.set(b.level, n);
      nums[i] = n;
    } else if (b.kind === 'bullet') {
      for (const lvl of [...counters.keys()]) if (lvl >= b.level) counters.delete(lvl);
      nums[i] = 0;
    } else {
      counters.clear();
      nums[i] = 0;
    }
  });
  return nums;
}

const HTML_ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escHtml = (s: string): string => s.replace(/[&<>"]/g, (c) => HTML_ESC[c]!);

const XML_ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const escXml = (s: string): string => s.replace(/[&<>"']/g, (c) => XML_ESC[c]!);

const enc = new TextEncoder();

/**
 * Fixed zip timestamp so DOCX/ODT archives are byte-identical run to run:
 * fflate stamps Date.now() into each entry's DOS date when mtime is absent,
 * and REJECTS dates before the 1980 DOS epoch (new Date(0) throws err 10), so
 * this is the documented equivalent - a constant in-range date. Constructed
 * from local components because fflate reads local getters for the DOS fields.
 */
const ZIP_MTIME = new Date(2000, 0, 1, 0, 0, 0);

const zipText = (s: string): [Uint8Array, { mtime: Date }] => [enc.encode(s), { mtime: ZIP_MTIME }];

// ── HTML ──────────────────────────────────────────────────────────────────────

const SANS_FALLBACK = 'system-ui,-apple-system,"Segoe UI",sans-serif';
const MONO_FALLBACK = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

/**
 * A caller-supplied font stack, made safe to sit inside a style block: only
 * family-name characters survive (letters, digits, spaces, commas, hyphens,
 * quotes). The brand faces are PREFERENCED, never embedded - a reader with the
 * font gets the brand look, everyone else falls to the system stack.
 */
function cssFontStack(stack: string | undefined, fallback: string): string {
  const clean = (stack ?? '').replace(/[^\w\s,'"-]/g, '').trim().replace(/,\s*$/, '');
  return clean ? `${clean},${fallback}` : fallback;
}

export interface StandaloneHtmlOpts {
  /** Body font stack to preference ahead of the system fallback (e.g. the active brand's --font-brand value). */
  fontStack?: string;
  /** Monospace stack for code, ahead of the mono fallback (e.g. --font-mono). */
  monoStack?: string;
}

const pageCss = (opts: StandaloneHtmlOpts): string => [
  `body{font-family:${cssFontStack(opts.fontStack, SANS_FALLBACK)};max-width:42rem;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#1a1a1a;background:#fff}`,
  `code,pre{font-family:${cssFontStack(opts.monoStack, MONO_FALLBACK)};background:#f4f4f4}`,
  'code{padding:.1em .3em;border-radius:3px}',
  'pre{padding:.75rem 1rem;border-radius:6px;overflow-x:auto}',
  'pre code{padding:0;background:none}',
  'blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:1rem;color:#555}',
  'hr{border:none;border-top:1px solid #ccc;margin:2rem 0}',
  'a{color:#0b57d0}',
].join('');

function runsToHtml(runs: MdRun[]): string {
  return runs.map((r) => {
    let t = escHtml(r.text);
    if (r.code) t = `<code>${t}</code>`;
    if (r.strike) t = `<del>${t}</del>`;
    if (r.italic) t = `<em>${t}</em>`;
    if (r.bold) t = `<strong>${t}</strong>`;
    // Schemes were vetted at parse time; the attribute is still escaped.
    if (r.href !== undefined) t = `<a href="${escHtml(r.href)}">${t}</a>`;
    return t;
  }).join('');
}

/** Contiguous list blocks into real nested ul/ol markup. A child list opens
 *  inside the parent's still-open li; frames close on the way back out. */
function listHtml(items: ListBlock[]): string {
  let html = '';
  const stack: Array<{ kind: 'bullet' | 'ordered'; level: number; liOpen: boolean }> = [];
  const close = (): void => {
    const top = stack.pop()!;
    if (top.liOpen) html += '</li>';
    html += top.kind === 'bullet' ? '</ul>' : '</ol>';
  };
  for (const it of items) {
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      if (top.level > it.level || (top.level === it.level && top.kind !== it.kind)) close();
      else break;
    }
    const top = stack[stack.length - 1];
    if (!top || top.level < it.level) {
      html += it.kind === 'bullet' ? '<ul>' : '<ol>';
      stack.push({ kind: it.kind, level: it.level, liOpen: false });
    }
    const frame = stack[stack.length - 1]!;
    if (frame.liOpen) html += '</li>';
    html += `<li>${runsToHtml(it.runs)}`;
    frame.liOpen = true;
  }
  while (stack.length) close();
  return html;
}

function bodyHtml(blocks: MdBlock[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i]!;
    if (b.kind === 'bullet' || b.kind === 'ordered') {
      const group: ListBlock[] = [];
      while (i < blocks.length) {
        const nb = blocks[i]!;
        if (nb.kind !== 'bullet' && nb.kind !== 'ordered') break;
        group.push(nb); i++;
      }
      out.push(listHtml(group));
      continue;
    }
    if (b.kind === 'heading') out.push(`<h${b.level}>${runsToHtml(b.runs)}</h${b.level}>`);
    else if (b.kind === 'para') out.push(`<p>${runsToHtml(b.runs)}</p>`);
    else if (b.kind === 'code') out.push(`<pre><code>${escHtml(b.text)}</code></pre>`);
    else if (b.kind === 'quote') out.push(`<blockquote><p>${runsToHtml(b.runs)}</p></blockquote>`);
    else out.push('<hr>');
    i++;
  }
  return out.join('\n');
}

/** A complete standalone page - this file gets opened OUTSIDE the app, so every
 *  piece of user text (title included) is escaped and hrefs are scheme-vetted. */
export function mdToStandaloneHtml(text: string, title: string, opts: StandaloneHtmlOpts = {}): string {
  const body = bodyHtml(parseMdBlocks(text));
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title><style>${pageCss(opts)}</style></head><body>\n${body}\n</body></html>`;
}

// ── RTF ───────────────────────────────────────────────────────────────────────

/** Heading sizes h1-h6 in RTF half-points. */
const RTF_HEAD_FS = [48, 40, 34, 30, 28, 26] as const;

/** Escape \ { } and encode any char above 0x7F as \uN? (signed 16-bit code
 *  unit with a '?' ANSI fallback; surrogate pairs emit as two \uN? words). */
function rtfEscape(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    const c = s.charCodeAt(i);
    if (ch === '\\' || ch === '{' || ch === '}') out += `\\${ch}`;
    else if (c > 0x7f) out += `\\u${c >= 0x8000 ? c - 0x10000 : c}?`;
    else out += ch;
  }
  return out;
}

/**
 * Runs as RTF toggles (\b..\b0 etc). Headings pass strip.bold and quotes
 * strip.italic: the block already sets that property at paragraph level, and a
 * run's closing toggle would switch it off for the rest of the line.
 * Links render as text followed by the URL in parentheses - RTF HYPERLINK
 * fields need field groups several readers mangle, and the plain form matches
 * the DOCX/ODT emitters so all three read the same.
 */
function rtfRuns(runs: MdRun[], strip: { bold?: boolean; italic?: boolean } = {}): string {
  return runs.map((r) => {
    let t = rtfEscape(r.text);
    if (r.href !== undefined) t += ` (${rtfEscape(r.href)})`;
    if (r.code) t = `\\f1 ${t}\\f0 `;
    if (r.strike) t = `\\strike ${t}\\strike0 `;
    if (r.italic && !strip.italic) t = `\\i ${t}\\i0 `;
    if (r.bold && !strip.bold) t = `\\b ${t}\\b0 `;
    return t;
  }).join('');
}

/**
 * Blocks as RTF. Each paragraph is wrapped in a { } group so its character
 * formatting (a heading's \b\fsN, a quote's \i) cannot leak forward - \pard
 * resets paragraph properties only, never character state. Ordered items get
 * a literal "N." number: full RTF list tables (\listtable + overrides) are out
 * of scope for a download converter, and the literal reads identically.
 */
export function mdToRtf(text: string): string {
  const blocks = parseMdBlocks(text);
  const nums = orderedNumbers(blocks);
  const out: string[] = [];
  blocks.forEach((b, i) => {
    switch (b.kind) {
      case 'heading':
        out.push(`{\\pard\\b\\fs${RTF_HEAD_FS[b.level - 1]!} ${rtfRuns(b.runs, { bold: true })}\\par}`);
        break;
      case 'para':
        out.push(`{\\pard\\fs24 ${rtfRuns(b.runs)}\\par}`);
        break;
      case 'bullet':
        out.push(`{\\pard\\li${360 * (b.level + 1)}\\fs24 \\'95\\tab ${rtfRuns(b.runs)}\\par}`);
        break;
      case 'ordered':
        out.push(`{\\pard\\li${360 * (b.level + 1)}\\fs24 ${nums[i]!}. ${rtfRuns(b.runs)}\\par}`);
        break;
      case 'code':
        for (const line of b.text.split('\n')) out.push(`{\\pard\\f1\\fs20 ${rtfEscape(line)}\\par}`);
        break;
      case 'quote':
        out.push(`{\\pard\\li360\\i\\fs24 ${rtfRuns(b.runs, { italic: true })}\\par}`);
        break;
      case 'rule':
        out.push(`{\\pard\\qc\\fs24 \\'97\\'97\\'97\\par}`);
        break;
    }
  });
  return `{\\rtf1\\ansi\\deff0\\uc1{\\fonttbl{\\f0\\fswiss Helvetica;}{\\f1\\fmodern Courier New;}}\n${out.join('\n')}\n}`;
}

// ── DOCX ──────────────────────────────────────────────────────────────────────

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Heading sizes h1-h6 in OOXML half-points. */
const DOCX_HEAD_SZ = [48, 40, 32, 28, 26, 24] as const;

const DOCX_CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/>'
  + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
  + '</Types>';

const DOCX_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
  + '</Relationships>';

interface DocxRunOpts { sz?: number; bold?: boolean; italic?: boolean; mono?: boolean }

/** One w:r. Every literal w:t carries xml:space="preserve" - trailing spaces
 *  on prefix runs ("2. ", a bold span before plain text) are content here.
 *  rPr children follow the schema order: rFonts, b, i, strike, sz. */
function docxRun(text: string, r: Partial<MdRun>, o: DocxRunOpts = {}): string {
  const props: string[] = [];
  if (r.code || o.mono) props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
  if (r.bold || o.bold) props.push('<w:b/>');
  if (r.italic || o.italic) props.push('<w:i/>');
  if (r.strike) props.push('<w:strike/>');
  if (o.sz !== undefined) props.push(`<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>`);
  const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${escXml(text)}</w:t></w:r>`;
}

function docxRuns(runs: MdRun[], o: DocxRunOpts = {}): string {
  // Links render as text then " (url)" - a real w:hyperlink needs one
  // document.xml.rels relationship per link, and this package deliberately
  // ships no per-part rels beyond the root; the plain form matches RTF/ODT.
  return runs.map((r) => docxRun(r.href !== undefined ? `${r.text} (${r.href})` : r.text, r, o)).join('');
}

/**
 * STRICT-minimal OOXML: three parts, no styles.xml. Formatting is inline run
 * properties only - a styles part would add indirection every reader resolves
 * back to the same inline result, and keeping the package flat keeps it
 * deterministic and diffable. The title parameter is accepted for signature
 * parity with the HTML emitter and unused: a document title lives in
 * docProps/core.xml, which wants dcterms dates that would break the
 * byte-identical-output rule, so that part is deliberately omitted.
 */
export async function mdToDocxBlob(text: string, title: string): Promise<Blob> {
  void title;
  const blocks = parseMdBlocks(text);
  const nums = orderedNumbers(blocks);
  const ps: string[] = [];
  blocks.forEach((b, i) => {
    switch (b.kind) {
      case 'heading':
        ps.push(`<w:p>${docxRuns(b.runs, { bold: true, sz: DOCX_HEAD_SZ[b.level - 1]! })}</w:p>`);
        break;
      case 'para':
        ps.push(`<w:p>${docxRuns(b.runs)}</w:p>`);
        break;
      case 'bullet':
        ps.push(`<w:p><w:pPr><w:ind w:left="${360 * (b.level + 1)}"/></w:pPr>${docxRun('• ', {})}${docxRuns(b.runs)}</w:p>`);
        break;
      case 'ordered':
        ps.push(`<w:p><w:pPr><w:ind w:left="${360 * (b.level + 1)}"/></w:pPr>${docxRun(`${nums[i]!}. `, {})}${docxRuns(b.runs)}</w:p>`);
        break;
      case 'code':
        for (const line of b.text.split('\n')) ps.push(`<w:p>${docxRun(line, {}, { mono: true })}</w:p>`);
        break;
      case 'quote':
        ps.push(`<w:p><w:pPr><w:ind w:left="360"/></w:pPr>${docxRuns(b.runs, { italic: true })}</w:p>`);
        break;
      case 'rule':
        ps.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${docxRun('---', {})}</w:p>`);
        break;
    }
  });
  const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
    + ps.join('')
    + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>'
    + '</w:body></w:document>';
  const bytes = await zipAsync({
    '[Content_Types].xml': zipText(DOCX_CONTENT_TYPES),
    '_rels/.rels': zipText(DOCX_RELS),
    'word/document.xml': zipText(doc),
  });
  return new Blob([bytes], { type: DOCX_MIME });
}

// ── ODT ───────────────────────────────────────────────────────────────────────

const ODT_MIME = 'application/vnd.oasis.opendocument.text';

/** Heading sizes h1-h6 in points. */
const ODT_HEAD_PT = [24, 20, 17, 15, 14, 13] as const;

const ODT_MANIFEST = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">'
  + `<manifest:file-entry manifest:full-path="/" manifest:media-type="${ODT_MIME}"/>`
  + '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>'
  + '<manifest:file-entry manifest:full-path="mimetype" manifest:media-type="text/plain"/>'
  + '</manifest:manifest>';

/** Nest a span per set flag; combinations become nested spans. Links render as
 *  text then " (url)", matching the RTF and DOCX emitters. */
function odtSpans(runs: MdRun[]): string {
  return runs.map((r) => {
    let t = escXml(r.href !== undefined ? `${r.text} (${r.href})` : r.text);
    if (r.code) t = `<text:span text:style-name="TC">${t}</text:span>`;
    if (r.strike) t = `<text:span text:style-name="TS">${t}</text:span>`;
    if (r.italic) t = `<text:span text:style-name="TI">${t}</text:span>`;
    if (r.bold) t = `<text:span text:style-name="TB">${t}</text:span>`;
    return t;
  }).join('');
}

/** ODF collapses runs of spaces, so code lines keep their indentation via
 *  text:s elements (leading spaces entirely, interior runs past the first). */
function odtCodeText(line: string): string {
  return escXml(line)
    .replace(/ {2,}/g, (m) => ` <text:s text:c="${m.length - 1}"/>`)
    .replace(/^ /, '<text:s/>');
}

/**
 * Minimal ODF package. THE MIMETYPE RULE: the 'mimetype' entry must be the
 * FIRST entry in the archive and STORED uncompressed, because ODF consumers
 * sniff the type by reading the first local file header's data at a fixed
 * offset - zipAsync preserves insertion order, so it is inserted first here
 * with { level: 0 }. Same title stance as the DOCX emitter: a title lives in
 * meta.xml with its dc:date fields, omitted to keep output deterministic.
 */
export async function mdToOdtBlob(text: string, title: string): Promise<Blob> {
  void title;
  const blocks = parseMdBlocks(text);
  const nums = orderedNumbers(blocks);

  // Automatic styles: one paragraph style per list level actually used.
  const levels = [...new Set(
    blocks.filter((b): b is ListBlock => b.kind === 'bullet' || b.kind === 'ordered').map((b) => b.level),
  )].sort((a, b) => a - b);
  const styles: string[] = [
    '<style:style style:name="TB" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>',
    '<style:style style:name="TI" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>',
    '<style:style style:name="TS" style:family="text"><style:text-properties style:text-line-through-style="solid"/></style:style>',
    '<style:style style:name="TC" style:family="text"><style:text-properties fo:font-family="Consolas"/></style:style>',
    '<style:style style:name="PC" style:family="paragraph"><style:text-properties fo:font-family="Consolas"/></style:style>',
    '<style:style style:name="QT" style:family="paragraph"><style:paragraph-properties fo:margin-left="0.25in"/><style:text-properties fo:font-style="italic"/></style:style>',
    '<style:style style:name="RC" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/></style:style>',
  ];
  for (let h = 1; h <= 6; h++) {
    styles.push(`<style:style style:name="H${h}" style:family="paragraph"><style:text-properties fo:font-weight="bold" fo:font-size="${ODT_HEAD_PT[h - 1]!}pt"/></style:style>`);
  }
  for (const lvl of levels) {
    styles.push(`<style:style style:name="L${lvl}" style:family="paragraph"><style:paragraph-properties fo:margin-left="${(lvl + 1) * 0.25}in"/></style:style>`);
  }

  const body: string[] = [];
  blocks.forEach((b, i) => {
    switch (b.kind) {
      case 'heading':
        body.push(`<text:h text:style-name="H${b.level}" text:outline-level="${b.level}">${odtSpans(b.runs)}</text:h>`);
        break;
      case 'para':
        body.push(`<text:p>${odtSpans(b.runs)}</text:p>`);
        break;
      case 'bullet':
        body.push(`<text:p text:style-name="L${b.level}">• ${odtSpans(b.runs)}</text:p>`);
        break;
      case 'ordered':
        body.push(`<text:p text:style-name="L${b.level}">${nums[i]!}. ${odtSpans(b.runs)}</text:p>`);
        break;
      case 'code':
        for (const line of b.text.split('\n')) body.push(`<text:p text:style-name="PC">${odtCodeText(line)}</text:p>`);
        break;
      case 'quote':
        body.push(`<text:p text:style-name="QT">${odtSpans(b.runs)}</text:p>`);
        break;
      case 'rule':
        body.push('<text:p text:style-name="RC">---</text:p>');
        break;
    }
  });

  const content = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<office:document-content'
    + ' xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"'
    + ' xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"'
    + ' xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"'
    + ' xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"'
    + ' office:version="1.2">'
    + `<office:automatic-styles>${styles.join('')}</office:automatic-styles>`
    + `<office:body><office:text>${body.join('')}</office:text></office:body>`
    + '</office:document-content>';

  const bytes = await zipAsync({
    // Entry order matters: mimetype first and stored, per the rule above.
    'mimetype': [enc.encode(ODT_MIME), { level: 0, mtime: ZIP_MTIME }],
    'META-INF/manifest.xml': zipText(ODT_MANIFEST),
    'content.xml': zipText(content),
  });
  return new Blob([bytes], { type: ODT_MIME });
}
