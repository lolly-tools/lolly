// SPDX-License-Identifier: MPL-2.0
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

// Helper arguments arrive from logic-less templates, so every helper treats its
// inputs as unknown and narrows/coerces immediately (String(...) / typeof).

// Register helpers once at module load. Kept tiny on purpose.
Handlebars.registerHelper('default', (val: unknown, fallback: unknown) => val ?? fallback);
Handlebars.registerHelper('upper', (s: unknown) => (typeof s === 'string' ? s.toUpperCase() : s));
Handlebars.registerHelper('lower', (s: unknown) => (typeof s === 'string' ? s.toLowerCase() : s));
Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

// Data-format helpers (used by sibling text templates like template.ics / .vcf).
// icsStamp: a date / datetime-local value ("2026-06-20T14:30" or "2026-06-20")
// → the iCalendar basic form ("20260620T143000" / "20260620"). Returns '' for
// empty input. rfcText: escape a value for an iCalendar (RFC 5545) or vCard
// (RFC 6350) text field — backslash, semicolon, comma and newlines are escaped.
Handlebars.registerHelper('icsStamp', (value: unknown) => {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const digits = s.replace(/[-:]/g, '');
  const [d = '', t] = digits.split('T');
  if (t === undefined) return d;              // date only → YYYYMMDD
  return `${d}T${(t + '0000').slice(0, 6)}`;  // pad HHMM → HHMMSS
});
Handlebars.registerHelper('rfcText', (value: unknown) =>
  String(value ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'));
// csvCell: quote a CSV field per RFC 4180 only when it contains a comma, quote,
// or newline (doubling any embedded quotes). Used by sibling template.csv files.
Handlebars.registerHelper('csvCell', (value: unknown) => {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
});

// Directional markers an author can type at the very start of a field, and the
// arrow glyphs they map to. The marker is a single character plus a space:
//   "> " → "→ "   "< " → "← "   "^ " → "↑ "   "v " → "↓ "
// The arrow helper substitutes the glyph; the markdown helper (below) maps the
// same markers to per-direction <li> classes for bullet lists.
const ARROW_GLYPHS: Record<string, string> = { '>': '→', '<': '←', '^': '↑', 'v': '↓' };
const ARROW_CLASSES: Record<string, string> = { '>': 'md-arrow', '<': 'md-arrow-left', '^': 'md-arrow-up', 'v': 'md-arrow-down' };
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
Handlebars.registerHelper('arrow', (text: unknown) =>
  (text == null ? '' : String(text).replace(LEADING_ARROW, (_, m: string) => (ARROW_GLYPHS[m] ?? m) + ' ')));

// Limited markdown → HTML. Supports **bold**, *italic*, ~~strikethrough~~,
// "# "…"###### " headings (<h1>–<h6>), bullet lists (a block whose every line
// starts "- ", "* ", or a direction marker "> "/"< "/"^ "/"v "), numbered lists
// (every line "1. "/"2) "), paragraph breaks (blank line), and line breaks within
// a paragraph. Direction-marker items are tagged with a per-direction class
// (md-arrow / md-arrow-left / md-arrow-up / md-arrow-down) so tools can render
// them with the matching arrow marker — most authors reach for a keyboard marker
// rather than hunting for the glyph. Ordered-list numbers are baked as real
// <span class="md-index"> nodes (not native <ol> markers or a CSS counter, both
// of which the vector export path drops) with list-style:none so they can't
// double; a tool can style/position .md-index for a hanging indent. Returns a
// SafeString so double-brace usage ({{markdown field}}) renders without
// double-escaping.
const MD_ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const MD_BULLET = /^\s*([-*<>^v])\s+/;               // "- "/"* " or a direction marker
const MD_ORDERED = /^\s*\d+[.)]\s+/;                 // "1. "/"2) "
const MD_HEADING = /^\s*(#{1,6})\s+(\S.*)$/;         // "# "…"###### " + text
Handlebars.registerHelper('markdown', (text: unknown) => {
  if (text == null || text === '') return new Handlebars.SafeString('');
  // Fold the three HTML-escape passes (&, <, >) into a single scan — markdown runs
  // per block on every keystroke for color-block/dynamic-layout/quotes. Output is
  // identical to the sequential replaces (the engine doesn't re-scan replacements).
  const inline = (raw: string): string => raw
    .replace(/[&<>]/g, (c) => MD_ESCAPE[c] ?? c)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  // Render a run of consecutive non-heading lines: an unordered list (every line a
  // bullet / direction marker), an ordered list (every line "N."/"N)"), or a
  // paragraph (lines joined with <br>). The leading marker is stripped before
  // inlining so it can't read as italic or get HTML-escaped.
  const renderRun = (lines: string[]): string => {
    if (lines.every((l) => MD_BULLET.test(l))) {
      const items = lines.map((l) => {
        const arrowClass = ARROW_CLASSES[l.match(MD_BULLET)?.[1] ?? ''];
        const cls = arrowClass ? ` class="${arrowClass}"` : '';
        return `<li${cls}>${inline(l.replace(MD_BULLET, ''))}</li>`;
      }).join('');
      return `<ul>${items}</ul>`;
    }
    if (lines.every((l) => MD_ORDERED.test(l))) {
      const items = lines.map((l, i) =>
        `<li><span class="md-index">${i + 1}.</span> ${inline(l.replace(MD_ORDERED, ''))}</li>`).join('');
      return `<ol style="list-style:none">${items}</ol>`;
    }
    return `<p>${lines.map((l) => inline(l)).join('<br>')}</p>`;
  };
  const html = String(text)
    .split(/\n{2,}/)
    .filter((b) => b.trim())
    .map((block) => {
      const lines = block.split('\n').filter((l) => l.trim() !== '');
      // Headings are block-level: a "# "…"###### " line becomes <h1>–<h6> and breaks
      // the surrounding run, so a heading directly above body text (no blank line)
      // still renders as its own element rather than folding into the paragraph.
      const out: string[] = [];
      let run: string[] = [];
      const flushRun = () => { if (run.length) { out.push(renderRun(run)); run = []; } };
      for (const line of lines) {
        const h = line.match(MD_HEADING);
        if (h) {
          flushRun();
          const level = h[1]!.length;                // MD_HEADING always captures groups 1 & 2
          out.push(`<h${level}>${inline(h[2]!)}</h${level}>`);
        } else {
          run.push(line);
        }
      }
      flushRun();
      return out.join('');
    })
    .join('');
  return new Handlebars.SafeString(html);
});

// AssetRef helper: lets templates write {{asset logo}} to get the URL safely,
// or {{asset logo "width"}} to get the width property.
Handlebars.registerHelper('asset', function (ref: unknown, field: unknown) {
  if (!ref || typeof ref !== 'object') return '';
  if (typeof field === 'string') {
    const v: unknown = Reflect.get(ref, field);
    return v ?? '';
  }
  const url: unknown = Reflect.get(ref, 'url');
  return url ?? '';
});

// Media helper: {{media logo}} emits the element that PLAYS the asset —
//   • still raster / vector → <img> (byte-identical to <img src="{{asset logo}}">),
//   • lottie                → a <div data-lottie-src> marker the shell's enhancer fills,
//   • video                 → a muted looping <video> (autoplay, playsinline).
// So a template can drop in ANY asset kind without an if/else, and a plain <img>
// never silently breaks when the user picks a video. Playback is tunable via the
// options hash: {{media hero controls=true loop=false autoplay=false fit="cover"}}.
// Output is raw HTML (SafeString), so every interpolated value is escaped — the
// same discipline the `markdown` helper follows. Concrete <video>/lottie behaviour
// (autoplay policy, leak reaping, export frame capture) is the shell's job; this
// helper only builds the string, keeping the engine DOM-free.
function mediaBool(v: unknown, dflt: boolean): boolean {
  if (v === undefined || v === null || v === '') return dflt;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}
Handlebars.registerHelper('media', function (ref: unknown, options?: { hash?: Record<string, unknown> }) {
  const empty = new Handlebars.SafeString('');
  if (!ref || typeof ref !== 'object') return empty;
  const esc = Handlebars.escapeExpression;
  const get = (k: string): unknown => Reflect.get(ref, k);
  const url = get('url');
  if (typeof url !== 'string' || !url) return empty;
  const type = String(get('type') ?? '');
  const meta = (get('meta') && typeof get('meta') === 'object' ? get('meta') : {}) as Record<string, unknown>;
  const hash = options?.hash ?? {};
  const cls = hash.class != null ? ` class="${esc(String(hash.class))}"` : '';
  const style = hash.style != null ? ` style="${esc(String(hash.style))}"` : '';

  if (type === 'lottie' || /\.json($|\?|#)/i.test(url)) {
    const loop = mediaBool(hash.loop, true) ? '1' : '0';
    const autoplay = mediaBool(hash.autoplay, true) ? '1' : '0';
    const fit = hash.fit === 'cover' ? 'cover' : 'contain';
    return new Handlebars.SafeString(
      `<div${cls} data-lottie-src="${esc(url)}" data-lottie-loop="${loop}" data-lottie-autoplay="${autoplay}" data-lottie-fit="${fit}"${style}></div>`,
    );
  }
  if (type === 'video' || /\.(mp4|m4v|mov|webm)($|\?|#)/i.test(url)) {
    const poster = typeof meta.posterUrl === 'string' && meta.posterUrl ? ` poster="${esc(meta.posterUrl)}"` : '';
    // A stable key lets the shell's video-mount enhancer restore playback position
    // across the tool canvas's per-paint rebuilds (so the clip doesn't restart at 0).
    // Prefer an explicit key= option, else the asset id — both are per-instance stable.
    const keyRaw = hash.key != null ? String(hash.key) : (typeof get('id') === 'string' ? String(get('id')) : url);
    // muted + playsinline are mandatory for the browser to allow autoplay.
    const flags = [
      mediaBool(hash.autoplay, true) ? 'autoplay' : '',
      mediaBool(hash.loop, true) ? 'loop' : '',
      mediaBool(hash.muted, true) ? 'muted' : '',
      mediaBool(hash.controls, false) ? 'controls' : '',
      'playsinline',
    ].filter(Boolean).join(' ');
    return new Handlebars.SafeString(`<video${cls} src="${esc(url)}" data-video-key="${esc(keyRaw)}"${poster} ${flags}${style}></video>`);
  }
  const alt = esc(String(hash.alt ?? meta.name ?? ''));
  return new Handlebars.SafeString(`<img${cls} src="${esc(url)}" alt="${alt}"${style}>`);
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
export function annotateTemplate(source: string, inputIds: string[]): string {
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

  function annotateContent(text: string): string {
    text = text.replace(triple, (m, id: string) => `<!-- ci:${id} -->${m}<!-- /ci:${id} -->`);
    text = text.replace(double, (m, id: string) => `<!-- ci:${id} -->${m}<!-- /ci:${id} -->`);
    return text;
  }

  // Walk the source splitting into content and tag segments. Tags are passed
  // through unchanged; only content segments are annotated. Quote-aware scanning
  // handles > inside attribute values (e.g. alt="a > b") correctly.
  const result: string[] = [];
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
const compileCache = new Map<string, Handlebars.TemplateDelegate>();

/**
 * @param templateSource the Handlebars template text
 * @param values  { inputId: value, ... } — from modelToValues()
 * @param opts.raw  Disable HTML escaping of `{{x}}`. Used for non-HTML data
 *   templates (template.ics/.vcf/.csv), where `{{x}}` must emit the value
 *   verbatim (each format escapes via its own helper: rfcText/csvCell).
 * @returns hydrated output
 */
export function hydrate(
  templateSource: string,
  values: Record<string, unknown>,
  { raw = false }: { raw?: boolean } = {},
): string {
  const key = raw ? ' raw ' + templateSource : templateSource;
  let compiled = compileCache.get(key);
  if (compiled) {
    // Mark most-recently-used: delete + re-insert moves it to the end.
    compileCache.delete(key);
    compileCache.set(key, compiled);
  } else {
    compiled = Handlebars.compile(templateSource, { noEscape: raw });
    compileCache.set(key, compiled);
    if (compileCache.size > COMPILE_CACHE_MAX) {
      const oldest = compileCache.keys().next().value; // evict oldest
      if (oldest !== undefined) compileCache.delete(oldest);
    }
  }
  return compiled(values);
}
