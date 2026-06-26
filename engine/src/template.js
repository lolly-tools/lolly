/**
 * Template hydration.
 *
 * Tools write Handlebars-flavoured templates. The runtime hydrates them with
 * input values (and AssetRefs, which expose .url for direct use).
 *
 * WHY HANDLEBARS (and not EJS):
 *   - Logic-less. Templates can be authored by non-developers.
 *   - Safe by default. {{x}} escapes; {{{x}}} is opt-in raw.
 *   - No arbitrary JS in templates means no per-template XSS audit.
 *
 * Tools needing real logic use hooks.js — a sandboxed escape hatch where the
 * imperative surface is explicit and reviewable.
 */

import Handlebars from 'handlebars';

// Register helpers once at module load. Kept tiny on purpose.
Handlebars.registerHelper('default', (val, fallback) => val ?? fallback);
Handlebars.registerHelper('upper', s => (typeof s === 'string' ? s.toUpperCase() : s));
Handlebars.registerHelper('lower', s => (typeof s === 'string' ? s.toLowerCase() : s));
Handlebars.registerHelper('eq', (a, b) => a === b);

// Data-format helpers (used by sibling text templates like template.ics / .vcf).
// icsStamp: a date / datetime-local value ("2026-06-20T14:30" or "2026-06-20")
// → the iCalendar basic form ("20260620T143000" / "20260620"). Returns '' for
// empty input. rfcText: escape a value for an iCalendar (RFC 5545) or vCard
// (RFC 6350) text field — backslash, semicolon, comma and newlines are escaped.
Handlebars.registerHelper('icsStamp', value => {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const digits = s.replace(/[-:]/g, '');
  const [d, t] = digits.split('T');
  if (t === undefined) return d;              // date only → YYYYMMDD
  return `${d}T${(t + '0000').slice(0, 6)}`;  // pad HHMM → HHMMSS
});
Handlebars.registerHelper('rfcText', value =>
  String(value ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'));
// csvCell: quote a CSV field per RFC 4180 only when it contains a comma, quote,
// or newline (doubling any embedded quotes). Used by sibling template.csv files.
Handlebars.registerHelper('csvCell', value => {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
});

// Directional markers an author can type at the very start of a field, and the
// arrow glyphs they map to. The marker is a single character plus a space:
//   "> " → "→ "   "< " → "← "   "^ " → "↑ "   "v " → "↓ "
// The arrow helper substitutes the glyph; the markdown helper (below) maps the
// same markers to per-direction <li> classes for bullet lists.
const ARROW_GLYPHS = { '>': '→', '<': '←', '^': '↑', 'v': '↓' };
const ARROW_CLASSES = { '>': 'md-arrow', '<': 'md-arrow-left', '^': 'md-arrow-up', 'v': 'md-arrow-down' };
// Char class shared by both helpers — order keeps "^" out of the leading
// (negation) slot so it reads as a literal.
const LEADING_ARROW = /^\s*([<>^v])\s+/;

// arrow: swap a leading direction marker for its arrow glyph. The single-line
// counterpart to the markdown helper's arrow bullets — for fields like a button
// label where a full <ul> list would be wrong, but authors still reach for the
// keyboard marker rather than hunting for the glyph. Only a marker at the very
// start (after any leading space) and followed by a space is rewritten; a marker
// mid-text or without a trailing space is left alone. Returns a plain string so
// {{arrow x}} still HTML-escapes the label.
Handlebars.registerHelper('arrow', text =>
  (text == null ? '' : String(text).replace(LEADING_ARROW, (_, m) => ARROW_GLYPHS[m] + ' ')));

// Limited markdown → HTML. Supports **bold**, *italic*, ~~strikethrough~~, bullet
// lists (a block whose every line starts "- ", "* ", or a direction marker
// "> "/"< "/"^ "/"v "), paragraph breaks (blank line), and line breaks within a
// paragraph. Direction-marker items are tagged with a per-direction class
// (md-arrow / md-arrow-left / md-arrow-up / md-arrow-down) so tools can render
// them with the matching arrow marker — most authors reach for a keyboard marker
// rather than hunting for the glyph. Returns a SafeString so double-brace usage
// ({{markdown field}}) renders without double-escaping.
const MD_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
Handlebars.registerHelper('markdown', text => {
  if (text == null || text === '') return new Handlebars.SafeString('');
  // Fold the three HTML-escape passes (&, <, >) into a single scan — markdown runs
  // per block on every keystroke for color-block/dynamic-layout/quotes. Output is
  // identical to the sequential replaces (the engine doesn't re-scan replacements).
  const inline = raw => raw
    .replace(/[&<>]/g, c => MD_ESCAPE[c])
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  const html = String(text)
    .split(/\n{2,}/)
    .filter(b => b.trim())
    .map(block => {
      const lines = block.split('\n').filter(l => l.trim() !== '');
      // A block whose every line is a "- "/"* " bullet or a direction marker
      // ("> "/"< "/"^ "/"v ") → an unordered list. The leading marker is stripped
      // before inlining, so it can't read as italic or get HTML-escaped. Direction
      // markers get a per-direction class (md-arrow*) for the matching arrow.
      const BULLET = /^\s*([-*<>^v])\s+/;
      if (lines.length && lines.every(l => BULLET.test(l))) {
        const items = lines.map(l => {
          const arrowClass = ARROW_CLASSES[l.match(BULLET)[1]];
          const cls = arrowClass ? ` class="${arrowClass}"` : '';
          return `<li${cls}>${inline(l.replace(BULLET, ''))}</li>`;
        }).join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${inline(block).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
  return new Handlebars.SafeString(html);
});

// AssetRef helper: lets templates write {{asset logo}} to get the URL safely,
// or {{asset logo "width"}} to get the width property.
Handlebars.registerHelper('asset', function (ref, field) {
  if (!ref) return '';
  if (typeof field === 'string') return ref[field] ?? '';
  return ref.url ?? '';
});

/**
 * Pre-process a Handlebars template source so each input-ID reference is
 * wrapped in HTML comment markers: <!-- ci:id -->{{...id...}}<!-- /ci:id -->.
 *
 * The shell uses these markers after hydration to find which rendered DOM nodes
 * correspond to which input, then adds data-canvas-input attributes so clicking
 * an element can focus its sidebar control.
 *
 * Only expressions in HTML text content are annotated — expressions inside
 * attribute values (src="{{id}}", class="foo {{id}}") are left alone to avoid
 * injecting comment text into attribute values and breaking the DOM. Block
 * helpers ({{#…}}/{{/…}}), comments ({{!…}}), and partials ({{>…}}) are also
 * skipped regardless of position.
 */
export function annotateTemplate(source, inputIds) {
  if (!inputIds.length) return source;

  // One combined alternation over every input id (each captured so the matched id
  // can be read back), instead of a pair of per-id regexes scanned N times per
  // content segment. Each segment now takes a single triple-brace pass + a single
  // double-brace pass regardless of how many inputs the tool declares. An
  // expression referencing several ids is tagged for the first one it mentions
  // (positionally) — enough for the shell's click-to-focus mapping.
  const idAlt = inputIds.map(id => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  // Triple-brace first so {{{ isn't also caught by the double-brace pattern.
  const triple = new RegExp(`\\{\\{\\{[^}]*\\b(${idAlt})\\b[^}]*\\}\\}\\}`, 'g');
  // Double-brace — skip block/comment/partial/nested-brace openers, and don't
  // match {{ that is part of {{{ … }}} (lookbehind + lookahead).
  const double = new RegExp(`(?<!\\{)\\{\\{(?![{#/!>^])[^}]*\\b(${idAlt})\\b[^}]*\\}\\}(?!\\})`, 'g');

  function annotateContent(text) {
    text = text.replace(triple, (m, id) => `<!-- ci:${id} -->${m}<!-- /ci:${id} -->`);
    text = text.replace(double, (m, id) => `<!-- ci:${id} -->${m}<!-- /ci:${id} -->`);
    return text;
  }

  // Walk the source splitting into content and tag segments. Tags are passed
  // through unchanged; only content segments are annotated. Quote-aware scanning
  // handles > inside attribute values (e.g. alt="a > b") correctly.
  const result = [];
  let i = 0;
  let contentStart = 0;

  while (i < source.length) {
    if (source[i] !== '<') { i++; continue; }

    result.push(annotateContent(source.slice(contentStart, i)));
    const tagStart = i++;

    let quoteChar = '';
    while (i < source.length) {
      const ch = source[i++];
      if (quoteChar) {
        if (ch === quoteChar) quoteChar = '';
      } else if (ch === '"' || ch === "'") {
        quoteChar = ch;
      } else if (ch === '>') {
        break;
      }
    }

    const tag = source.slice(tagStart, i);
    result.push(tag); // tag verbatim
    contentStart = i;

    // <script>/<style> hold raw text (JS/CSS) that may itself contain < and >
    // (comparison operators, CSS comments). Emit their contents verbatim so a
    // stray angle bracket can't desync the tag scanner and suppress annotation
    // for the rest of the template. The closing tag is handled by the next pass.
    const raw = /^<(script|style)(?:\s|>)/i.exec(tag);
    if (raw && !tag.endsWith('/>')) {
      const close = new RegExp(`</${raw[1]}\\s*>`, 'i').exec(source.slice(i));
      if (close) {
        const rawEnd = i + close.index;
        result.push(source.slice(i, rawEnd)); // raw element body, unannotated
        i = rawEnd;
        contentStart = rawEnd;
      }
    }
  }

  result.push(annotateContent(source.slice(contentStart)));
  return result.join('');
}

// Bounded LRU of compiled templates. The key is the (multi-KB) template source,
// so an unbounded Map would pin every template+raw variant ever hydrated in
// memory for the session. A Map preserves insertion order, so the oldest live
// key is always first — re-inserting on hit marks it most-recent, and we evict
// from the front once over capacity.
const COMPILE_CACHE_MAX = 50;
const compileCache = new Map();

/**
 * @param {string} templateSource
 * @param {object} values  { inputId: value, ... } — from modelToValues()
 * @param {object} [opts]
 * @param {boolean} [opts.raw]  Disable HTML escaping of `{{x}}`. Used for
 *   non-HTML data templates (template.ics/.vcf/.csv), where `{{x}}` must emit
 *   the value verbatim (each format escapes via its own helper: rfcText/csvCell).
 * @returns {string} hydrated output
 */
export function hydrate(templateSource, values, { raw = false } = {}) {
  const key = raw ? ' raw ' + templateSource : templateSource;
  let compiled = compileCache.get(key);
  if (compiled) {
    // Mark most-recently-used: delete + re-insert moves it to the end.
    compileCache.delete(key);
    compileCache.set(key, compiled);
  } else {
    compiled = Handlebars.compile(templateSource, { noEscape: raw });
    compileCache.set(key, compiled);
    if (compileCache.size > COMPILE_CACHE_MAX) {
      compileCache.delete(compileCache.keys().next().value); // evict oldest
    }
  }
  return compiled(values);
}

export function clearTemplateCache() {
  compileCache.clear();
}
