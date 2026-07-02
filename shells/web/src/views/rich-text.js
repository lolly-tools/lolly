// rich-text.js — the tiny per-character rich-text model behind Layout Studio's
// WYSIWYG inline text editing (free-canvas.js).
//
// The contenteditable shows the RENDERED rich text (what hooks.js richText emits:
// <strong>/<em> runs, literal \n line breaks under white-space:pre-wrap, and "•  "
// bullet prefixes as plain characters). Every formatting operation round-trips
// through this model: parse the DOM into a flat array of {ch, b, i} characters,
// mutate flags over a [start, end) character range, and re-render to HTML. On
// commit the same model serialises back to the tool's stored markdown-subset
// source (**bold**, *italic*, "- " bullets) — the storage format, the URL
// encoding, and the engine render path are unchanged; only the editing UX is.
//
// Literal * and _ typed by the user are backslash-escaped in the serialised
// source (and hooks.js inlineMd unescapes them), so WYSIWYG text can never
// accidentally italicise "5 * 3 * 2".
//
// DOM-agnostic on purpose: charsFromDom only touches nodeType/nodeName/
// childNodes/nodeValue, so node:test can feed it plain object trees (see
// rich-text.test.js) — no jsdom needed.

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE']);

/** Parse a contenteditable's DOM into the flat char model. */
export function charsFromDom(root) {
  const out = [];
  const walk = (node, b, i) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const text = String(child.nodeValue || '').replace(/\u00a0/g, ' ');
        for (const ch of text) out.push({ ch, b, i });
        continue;
      }
      if (child.nodeType !== 1) continue;
      const tag = String(child.nodeName).toUpperCase();
      if (tag === 'BR') { out.push({ ch: '\n', b, i }); continue; }
      // A block element starts on its own line (contenteditable Enter is
      // intercepted into literal \n, but pasted/legacy markup may carry these).
      if (BLOCK_TAGS.has(tag) && out.length && out[out.length - 1].ch !== '\n') out.push({ ch: '\n', b, i });
      walk(child, b || tag === 'B' || tag === 'STRONG', i || tag === 'I' || tag === 'EM');
    }
  };
  walk(root, false, false);
  return out;
}

const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Render the char model to the HTML shown in the editable (and by the tool). */
export function htmlFromChars(chars) {
  let html = '';
  let run = '';
  let cur = null;
  const flush = () => {
    if (cur == null || run === '') { run = ''; return; }
    let piece = escHtml(run);
    if (cur.i) piece = '<em>' + piece + '</em>';
    if (cur.b) piece = '<strong>' + piece + '</strong>';
    html += piece;
    run = '';
  };
  for (const c of chars) {
    if (!cur || c.b !== cur.b || c.i !== cur.i) { flush(); cur = { b: c.b, i: c.i }; }
    run += c.ch;
  }
  flush();
  return html;
}

// One rendered line back to markdown-subset source. Runs never span lines, so
// **/*/ markers stay per-line (matching how hooks.js inlineMd parses them).
function lineToMarkdown(line) {
  let src = '';
  let text = line.map((c) => c.ch).join('');
  let start = 0;
  const m = text.match(/^(\s*)•\s+/);
  if (m) { src += m[1] + '- '; start = m[0].length; }
  let run = '';
  let cur = null;
  const flush = () => {
    if (cur == null || run === '') { run = ''; return; }
    // Formatting on whitespace is invisible — keep leading/trailing whitespace
    // outside the markers so the source stays clean for the render-side regexes.
    const [, lead, core, tail] = run.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const esc = core.replace(/([*_])/g, '\\$1');
    src += lead;
    if (!core) { run = ''; return; }
    if (cur.b && cur.i) src += '***' + esc + '***';
    else if (cur.b) src += '**' + esc + '**';
    else if (cur.i) src += '*' + esc + '*';
    else src += esc;
    src += tail;
    run = '';
  };
  for (let k = start; k < line.length; k++) {
    const c = line[k];
    if (!cur || c.b !== cur.b || c.i !== cur.i) { flush(); cur = { b: c.b, i: c.i }; }
    run += c.ch;
  }
  flush();
  return src;
}

function splitLines(chars) {
  const lines = [[]];
  for (const c of chars) {
    if (c.ch === '\n') lines.push([]);
    else lines[lines.length - 1].push(c);
  }
  return lines;
}

/** Serialise the char model to the stored markdown-subset source text. */
export function markdownFromChars(chars) {
  // Browsers leave one trailing newline in a contenteditable; drop exactly one
  // (same normalisation the previous plaintext editor applied via innerText).
  const trimmed = chars.length && chars[chars.length - 1].ch === '\n' ? chars.slice(0, -1) : chars;
  return splitLines(trimmed).map(lineToMarkdown).join('\n');
}

/** True when every non-newline char in [a, b) carries the flag. */
export function rangeHasFlag(chars, a, b, flag) {
  let seen = false;
  for (let k = Math.max(0, a); k < Math.min(chars.length, b); k++) {
    if (chars[k].ch === '\n') continue;
    seen = true;
    if (!chars[k][flag]) return false;
  }
  return seen;
}

/** Return a copy with the flag set/cleared over [a, b) (newlines untouched). */
export function setFlag(chars, a, b, flag, on) {
  return chars.map((c, k) => {
    if (k < a || k >= b || c.ch === '\n') return c;
    return { ...c, [flag]: on };
  });
}

/** Expand a collapsed caret offset to the word around it ([a, a] if none). */
export function wordRangeAt(chars, at) {
  const isWord = (c) => c && c.ch !== '\n' && /\S/.test(c.ch);
  let a = Math.max(0, Math.min(at, chars.length));
  let b = a;
  while (a > 0 && isWord(chars[a - 1])) a--;
  while (b < chars.length && isWord(chars[b])) b++;
  return [a, b];
}

/** True when every non-blank line starts with a "• " bullet prefix. */
export function allBulleted(chars) {
  const lines = splitLines(chars).filter((l) => l.some((c) => /\S/.test(c.ch)));
  if (!lines.length) return false;
  return lines.every((l) => /^\s*•\s/.test(l.map((c) => c.ch).join('')));
}

/** Toggle "•  " bullet prefixes on every non-blank line (whole-box list). */
export function toggleBullets(chars) {
  const on = !allBulleted(chars);
  const lines = splitLines(chars);
  const out = [];
  lines.forEach((line, li) => {
    if (li > 0) out.push({ ch: '\n', b: false, i: false });
    const text = line.map((c) => c.ch).join('');
    if (!text.trim()) { out.push(...line); return; }
    if (on) {
      if (/^\s*•\s/.test(text)) { out.push(...line); return; }
      const indent = (text.match(/^\s*/) || [''])[0].length;
      out.push(...line.slice(0, indent));
      for (const ch of '•  ') out.push({ ch, b: false, i: false });
      out.push(...line.slice(indent));
    } else {
      const m = text.match(/^(\s*)•\s+/);
      if (m) out.push(...line.slice(0, m[1].length), ...line.slice(m[0].length));
      else out.push(...line);
    }
  });
  return out;
}
