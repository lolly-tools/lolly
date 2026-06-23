/* global onInit, onInput, exportFile */
/**
 * SVG Cleaner — runs entirely in the sandboxed hook context (no DOM, no network).
 * Reads the picked file's bytes (input.value.bytes), decodes them as text, reports
 * what editor metadata / comments / author tags the SVG carries, and produces a
 * smaller, cleaner copy.
 *
 * Like the EXIF stripper, it is deliberately *conservative*: it only removes things
 * that provably never affect rendering — comments, <metadata> blocks, editor-private
 * namespaces/attributes (Inkscape sodipodi / Adobe i:,x:), legacy DOCTYPE/PI noise —
 * and collapses insignificant inter-tag whitespace OUTSIDE text-sensitive elements.
 * Every other tag is emitted byte-for-byte from the source, so the artwork is never
 * mangled. If the input doesn't parse as SVG it is handed back untouched.
 *
 * No DOMParser: the sandbox has no DOM, and we want identical behaviour across the
 * web, Tauri and (jsdom-free) CLI shells. So we use a small, careful XML tokenizer —
 * the same spirit as the EXIF stripper's hand-rolled JPEG/PNG segment scanners.
 */

// ─── byte / text helpers ─────────────────────────────────────────────────────

function fmtBytes(n) {
  if (!(n > 0)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${i === 0 ? v : v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function decodeText(bytes) {
  // TextDecoder strips a leading UTF-8 BOM by default; encoding back drops it.
  return new TextDecoder('utf-8').decode(bytes);
}

function encodeText(str) {
  return new TextEncoder().encode(str);
}

function prefixOf(name) {
  const c = name.indexOf(':');
  return c > 0 ? name.slice(0, c).toLowerCase() : '';
}

// ─── editor-cruft policy ─────────────────────────────────────────────────────
// Namespaces that are editor-private or pure metadata and never paint pixels.

const DROP_EL_PREFIX = new Set(['sodipodi', 'inkscape', 'i', 'x']); // i:/x: = Adobe private
const DROP_EL_NAME = new Set(['metadata']);
// Whitespace inside these is content — never collapse it.
const SPACE_SENSITIVE = new Set(['text', 'tspan', 'textpath', 'tref', 'style', 'title', 'desc', 'script']);
// Namespace declarations safe to drop — ONLY for prefixes we also strip wholesale
// (elements + attributes). We must not drop a decl while leaving attributes in that
// namespace behind (e.g. Affinity's serif:id, Adobe's a:*), so those stay.
const DROP_XMLNS = new Set([
  'xmlns:inkscape', 'xmlns:sodipodi', 'xmlns:i', 'xmlns:x', // dropped as element/attr prefixes
  'xmlns:dc', 'xmlns:cc', 'xmlns:rdf',                      // metadata-only — block is removed
]);

function shouldDropElement(name) {
  return DROP_EL_NAME.has(name.toLowerCase()) || DROP_EL_PREFIX.has(prefixOf(name));
}

function shouldDropAttr(name) {
  if (name === 'xml:space') return false;           // rendering-relevant — keep
  if (DROP_EL_PREFIX.has(prefixOf(name))) return true; // inkscape:*, sodipodi:*, i:*, x:*
  if (DROP_XMLNS.has(name.toLowerCase())) return true;
  if (name === 'data-name') return true;            // Illustrator layer names (privacy)
  return false;
}

// ─── XML tokenizer ───────────────────────────────────────────────────────────
// Splits the source into a flat token list. Tags are matched respecting quoted
// attribute values so a '>' inside an attribute can't terminate a tag early.

function parseAttrs(s) {
  const attrs = [];
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+)))?/g;
  let m;
  while ((m = re.exec(s)) && m[0]) {
    const value = m[2] != null ? m[2] : (m[3] != null ? m[3] : (m[4] != null ? m[4] : null));
    attrs.push({ name: m[1], value });
  }
  return attrs;
}

function parseTag(raw) {
  const selfClose = raw.endsWith('/>');
  const inner = raw.slice(1, selfClose ? -2 : -1);
  if (inner[0] === '/') return { t: 'close', name: inner.slice(1).trim(), raw };
  const m = /^\s*([^\s/>]+)/.exec(inner);
  const name = m ? m[1] : '';
  const attrs = m ? parseAttrs(inner.slice(m[0].length)) : [];
  return { t: selfClose ? 'self' : 'open', name, attrs, raw };
}

function tokenize(s) {
  const toks = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    if (s[i] === '<') {
      if (s.startsWith('<!--', i)) {
        const end = s.indexOf('-->', i + 4);
        const close = end === -1 ? n : end + 3;
        toks.push({ t: 'comment', raw: s.slice(i, close), text: s.slice(i + 4, end === -1 ? n : end) });
        i = close;
      } else if (s.startsWith('<![CDATA[', i)) {
        const end = s.indexOf(']]>', i + 9);
        const close = end === -1 ? n : end + 3;
        toks.push({ t: 'cdata', raw: s.slice(i, close) });
        i = close;
      } else if (s.startsWith('<!', i)) {              // DOCTYPE / declaration
        const end = s.indexOf('>', i);
        const close = end === -1 ? n : end + 1;
        toks.push({ t: 'doctype', raw: s.slice(i, close) });
        i = close;
      } else if (s.startsWith('<?', i)) {              // PI or xml declaration
        const end = s.indexOf('?>', i);
        const close = end === -1 ? n : end + 2;
        const raw = s.slice(i, close);
        toks.push({ t: 'pi', raw, isXmlDecl: /^<\?xml\s/i.test(raw) });
        i = close;
      } else {                                         // element tag
        let j = i + 1, q = 0;
        while (j < n) {
          const c = s[j];
          if (q) { if (c === q) q = 0; }
          else if (c === '"' || c === "'") q = c;
          else if (c === '>') break;
          j++;
        }
        const close = j < n ? j + 1 : n;
        toks.push(parseTag(s.slice(i, close)));
        i = close;
      }
    } else {
      const next = s.indexOf('<', i);
      const close = next === -1 ? n : next;
      toks.push({ t: 'text', raw: s.slice(i, close) });
      i = close;
    }
  }
  return toks;
}

// ─── clean (reconstruct without cruft) ───────────────────────────────────────

function rebuildTag(tk) {
  const kept = [];
  for (const a of tk.attrs) {
    if (shouldDropAttr(a.name)) continue;
    if (a.value == null) { kept.push(a.name); continue; }
    const quote = a.value.includes('"') ? "'" : '"';
    kept.push(`${a.name}=${quote}${a.value}${quote}`);
  }
  const body = tk.name + (kept.length ? ' ' + kept.join(' ') : '');
  return tk.t === 'self' ? `<${body}/>` : `<${body}>`;
}

function clean(toks) {
  const out = [];
  const stack = [];          // names of currently-open kept elements
  let dropName = null, dropDepth = 0;

  for (const tk of toks) {
    if (dropDepth > 0) {     // inside a dropped subtree — watch only its nesting
      if (tk.t === 'open' && tk.name === dropName) dropDepth++;
      else if (tk.t === 'close' && tk.name === dropName) dropDepth--;
      continue;
    }
    switch (tk.t) {
      case 'comment':
      case 'doctype':
        break;               // drop
      case 'pi':
        if (tk.isXmlDecl) out.push(tk.raw); // keep the xml declaration, drop other PIs
        break;
      case 'cdata':
        out.push(tk.raw);
        break;
      case 'text': {
        // In SVG, whitespace is only significant inside text-content elements;
        // xml:space="preserve" on a container (Illustrator stamps it on the root
        // <svg>) does not make geometry whitespace render. So sensitivity tracks
        // the nearest open element, not xml:space.
        const sensitive = stack.length && SPACE_SENSITIVE.has(stack[stack.length - 1]);
        if (!sensitive && /^\s*$/.test(tk.raw)) break; // drop insignificant whitespace
        out.push(tk.raw);
        break;
      }
      case 'open':
      case 'self': {
        if (shouldDropElement(tk.name)) {
          if (tk.t === 'open') { dropName = tk.name; dropDepth = 1; }
          break;
        }
        const hasDroppable = tk.attrs.some(a => shouldDropAttr(a.name));
        out.push(hasDroppable ? rebuildTag(tk) : tk.raw);
        if (tk.t === 'open') stack.push(tk.name.toLowerCase());
        break;
      }
      case 'close': {
        for (let k = stack.length - 1; k >= 0; k--) {
          if (stack[k] === tk.name.toLowerCase()) { stack.length = k; break; }
        }
        out.push(tk.raw);
        break;
      }
    }
  }
  return out.join('');
}

// ─── analyse (the "what's hidden" reveal) ────────────────────────────────────

function analyze(toks) {
  const findings = [];
  let editor = null, docName = null;
  let comments = 0, pathInComment = false, stylesheetPI = false, hasDoctype = false;
  let hasMetadata = false, metaParts = [];
  let metaDepth = 0;
  let titleText = '', inTitle = 0, descText = '', inDesc = 0;
  let editorElements = false, adobePrivate = false;
  let embeddedImgs = 0, embeddedBytes = 0;

  for (const tk of toks) {
    if (metaDepth > 0 && tk.raw) metaParts.push(tk.raw);

    if (tk.t === 'comment') {
      comments++;
      const g = /Generator:\s*([^\n]*)/i.exec(tk.text);
      if (g && !editor) {
        editor = g[1].replace(/-->\s*$/, '').replace(/,?\s*SVG (Export|Version).*$/i, '').trim();
      }
      if (/[A-Za-z]:\\|\/Users\/|\/home\/|\.ai\b|\.eps\b|\.psd\b|\.sketch\b/.test(tk.text)) pathInComment = true;
    } else if (tk.t === 'doctype') {
      hasDoctype = true;
    } else if (tk.t === 'pi' && !tk.isXmlDecl && /xml-stylesheet/i.test(tk.raw)) {
      stylesheetPI = true;
    } else if (tk.t === 'open' || tk.t === 'self') {
      const lname = tk.name.toLowerCase();
      const pre = prefixOf(tk.name);
      if (lname === 'metadata' && tk.t === 'open') { hasMetadata = true; metaDepth++; }
      else if (lname === 'metadata' && metaDepth > 0) metaDepth++;
      if (pre === 'sodipodi' || pre === 'inkscape') editorElements = true;
      if (pre === 'i' || pre === 'x') adobePrivate = true;
      if (lname === 'title' && tk.t === 'open') inTitle++;
      if (lname === 'desc' && tk.t === 'open') inDesc++;
      for (const a of tk.attrs) {
        if (a.name === 'inkscape:version' && !editor) editor = 'Inkscape ' + (a.value || '').split(' ')[0];
        if (a.name === 'sodipodi:docname' && a.value) docName = a.value;
        if (a.name === 'xmlns:sketch' && !editor) editor = 'Sketch';
        if (a.name === 'xmlns:figma' && !editor) editor = 'Figma';
        if ((a.name === 'href' || a.name === 'xlink:href') && a.value && /^data:image\//i.test(a.value)) {
          embeddedImgs++;
          const comma = a.value.indexOf(',');
          if (comma > -1) embeddedBytes += Math.floor((a.value.length - comma - 1) * 0.75);
        }
      }
    } else if (tk.t === 'close') {
      const lname = tk.name.toLowerCase();
      if (lname === 'metadata' && metaDepth > 0) metaDepth--;
      if (lname === 'title' && inTitle > 0) inTitle--;
      if (lname === 'desc' && inDesc > 0) inDesc--;
    } else if (tk.t === 'text') {
      if (inTitle > 0) titleText += tk.raw;
      if (inDesc > 0) descText += tk.raw;
    }
  }

  // Author / licence from the <metadata> block (RDF / Dublin Core).
  let author = null, licence = null;
  if (hasMetadata) {
    const meta = metaParts.join('');
    const cr = /<dc:(?:creator|rights)[^>]*>([\s\S]*?)<\/dc:(?:creator|rights)>/i.exec(meta);
    if (cr) { const t = cr[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); if (t) author = t; }
    const lic = /<cc:license[^>]*rdf:resource=["']([^"']+)["']/i.exec(meta)
      || /<dc:rights[^>]*>([\s\S]*?)<\/dc:rights>/i.exec(meta);
    if (lic) { const t = lic[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); if (t) licence = t; }
  }

  // Assemble findings, warn-toned for anything personally identifying.
  if (editor) findings.push({ label: 'Created with', detail: editor, tone: 'warn' });
  if (docName) findings.push({ label: 'Original filename', detail: docName, tone: 'warn' });
  if (author) findings.push({ label: 'Author', detail: author, tone: 'warn' });
  if (licence) findings.push({ label: 'Licence', detail: licence, tone: '' });
  if (pathInComment) findings.push({ label: 'File path in comment', detail: 'a local path is embedded', tone: 'warn' });
  if (hasMetadata && !author && !licence) findings.push({ label: 'Metadata block', detail: 'embedded RDF / Dublin Core', tone: '' });
  if (editorElements) findings.push({ label: 'Editor data', detail: 'Inkscape canvas, guides & settings', tone: '' });
  if (adobePrivate) findings.push({ label: 'Adobe private data', detail: 'Illustrator graphics format', tone: '' });
  if (comments) findings.push({ label: 'Comments', detail: `${comments} comment${comments > 1 ? 's' : ''}`, tone: '' });
  if (stylesheetPI) findings.push({ label: 'External stylesheet', detail: 'xml-stylesheet reference', tone: 'warn' });
  if (hasDoctype) findings.push({ label: 'Legacy DOCTYPE', detail: 'SVG 1.0 doctype', tone: '' });
  const titleTrim = titleText.replace(/\s+/g, ' ').trim();
  if (titleTrim) findings.push({ label: 'Title', detail: titleTrim, tone: '' });
  const descTrim = descText.replace(/\s+/g, ' ').trim();
  if (descTrim) findings.push({ label: 'Description', detail: descTrim, tone: '' });
  if (embeddedImgs) findings.push({ label: 'Embedded images', detail: `${embeddedImgs} image${embeddedImgs > 1 ? 's' : ''}${embeddedBytes ? `, ~${fmtBytes(embeddedBytes)}` : ''} — kept`, tone: '' });

  return findings;
}

// ─── pipeline ────────────────────────────────────────────────────────────────

function looksLikeSvg(text) {
  // Skip a leading BOM/whitespace/xml-decl/doctype/comment, then require <svg.
  return /<svg[\s>]/i.test(text);
}

function cleanText(text) {
  return clean(tokenize(text));
}

// ─── lifecycle ───────────────────────────────────────────────────────────────

function patch({ model }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  const f = inputs.svg;
  const blank = {
    hasFile: false, isSvg: false, findings: [], nothingFound: false,
    fileName: '', fileSize: '', kind: 'SVG', metaSummary: '', cleanSize: '', cleanResult: '',
  };
  if (!f || !f.bytes) return blank;

  const base = { ...blank, hasFile: true, fileName: f.name, fileSize: fmtBytes(f.size) };
  let text;
  try { text = decodeText(f.bytes); } catch (e) { return base; }
  if (!looksLikeSvg(text)) return base; // isSvg stays false → template shows guidance

  let findings = [];
  try { findings = analyze(tokenize(text)); } catch (e) { findings = []; }

  let cleanLen = f.bytes.length;
  try { cleanLen = encodeText(cleanText(text)).length; } catch (e) { /* keep original size */ }
  const removed = Math.max(0, f.bytes.length - cleanLen);
  const pct = f.bytes.length > 0 ? Math.round((removed / f.bytes.length) * 100) : 0;
  const cleanResult = removed > 0
    ? `That's ${fmtBytes(removed)} smaller${pct >= 1 ? ` (−${pct}%)` : ''}.`
    : 'The file is already as small as it gets.';

  return {
    ...base,
    isSvg: true,
    findings,
    nothingFound: findings.length === 0,
    cleanSize: fmtBytes(cleanLen),
    cleanResult,
    metaSummary: findings.length
      ? `Found ${findings.length} item${findings.length > 1 ? 's' : ''} of hidden or non-rendering data.`
      : '',
  };
}

function onInit(ctx) { return patch(ctx); }
function onInput(ctx) { return patch(ctx); }

function exportFile({ model }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  const f = inputs.svg;
  if (!f || !f.bytes) throw new Error('Choose an SVG first.');
  const text = decodeText(f.bytes);
  // Not SVG, or cleaning failed — hand the original bytes back untouched.
  let bytes = f.bytes;
  if (looksLikeSvg(text)) {
    try { bytes = encodeText(cleanText(text)); } catch (e) { bytes = f.bytes; }
  }
  const dot = f.name.lastIndexOf('.');
  const filename = dot > 0 ? `${f.name.slice(0, dot)}-clean${f.name.slice(dot)}` : `${f.name}-clean.svg`;
  return { bytes, mime: f.mime || 'image/svg+xml', filename };
}
