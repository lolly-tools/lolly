/* global onInit, onInput, exportFile */
/**
 * Strip Hidden Data — runs entirely in the sandboxed hook context (no DOM,
 * no network). Reads the picked file's bytes (input.value.bytes), reports the
 * hidden / non-rendering data it carries, and produces a clean copy.
 *
 * Three formats, one tool, all by lossless surgery — the image content is copied
 * through untouched, only metadata is removed:
 *   JPEG: drop APP1 (EXIF/XMP), APP2 (ICC), APP13 (IPTC/Photoshop) and COM
 *         comment segments; keep APP0 (JFIF) and all image segments.
 *   PNG : drop tEXt / zTXt / iTXt / eXIf / tIME chunks; keep everything else.
 *   SVG : drop comments, <metadata>, editor-private namespaces/attributes
 *         (Inkscape sodipodi/Adobe i:,x:), DOCTYPE/PI noise, insignificant
 *         whitespace; every painting tag is emitted byte-for-byte.
 *
 * No DOMParser / no canvas: the sandbox has no DOM, and we want identical
 * behaviour across web, Tauri and (jsdom-free) CLI shells. Everything is done
 * with hand-rolled byte/segment scanners and a small XML tokenizer.
 */

// ─── shared byte / text helpers ──────────────────────────────────────────────

function concatBytes(parts) {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function fmtBytes(n) {
  if (!(n > 0)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${i === 0 ? v : v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function matchAscii(bytes, off, str) {
  for (let i = 0; i < str.length; i++) {
    if (bytes[off + i] !== str.charCodeAt(i)) return false;
  }
  return true;
}

function decodeText(bytes) {
  // TextDecoder strips a leading UTF-8 BOM by default; encoding back drops it.
  return new TextDecoder('utf-8').decode(bytes);
}

function encodeText(str) {
  return new TextEncoder().encode(str);
}

// ─── EXIF / TIFF reader (shared by JPEG APP1 and PNG eXIf) ────────────────────
// Offsets inside a TIFF block are relative to the start of the TIFF header, so
// the DataView is anchored there. Best-effort: anything malformed → null.

function readTiff(bytes, base, len) {
  if (len < 8 || base + len > bytes.length) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset + base, len);
  const b0 = dv.getUint8(0), b1 = dv.getUint8(1);
  let le;
  if (b0 === 0x49 && b1 === 0x49) le = true;        // "II" little-endian
  else if (b0 === 0x4D && b1 === 0x4D) le = false;  // "MM" big-endian
  else return null;
  if (dv.getUint16(2, le) !== 42) return null;
  const out = { make: null, model: null, software: null, dateTime: null, artist: null, hasGps: false, gps: null };
  for (const e of readIfd(dv, dv.getUint32(4, le), le)) {
    switch (e.tag) {
      case 0x010F: out.make     = ascii(dv, e); break;
      case 0x0110: out.model    = ascii(dv, e); break;
      case 0x0131: out.software = ascii(dv, e); break;
      case 0x0132: out.dateTime = ascii(dv, e); break;
      case 0x013B: out.artist   = ascii(dv, e); break;
      case 0x8825: {                                // GPS IFD pointer (LONG offset)
        out.hasGps = true;
        out.gps = readGps(dv, dv.getUint32(e.valueOffset, le), le);
        break;
      }
    }
  }
  return out;
}

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function readIfd(dv, off, le) {
  const out = [];
  if (off <= 0 || off + 2 > dv.byteLength) return out;
  const n = dv.getUint16(off, le);
  let p = off + 2;
  for (let i = 0; i < n; i++) {
    if (p + 12 > dv.byteLength) break;
    const tag = dv.getUint16(p, le);
    const type = dv.getUint16(p + 2, le);
    const count = dv.getUint32(p + 4, le);
    const size = (TYPE_SIZE[type] || 1) * count;
    const valueOffset = size > 4 ? dv.getUint32(p + 8, le) : p + 8;
    out.push({ tag, type, count, size, valueOffset, le });
    p += 12;
  }
  return out;
}

function ascii(dv, e) {
  if (e.type !== 2) return null;
  let s = '';
  for (let i = 0; i < e.count; i++) {
    const off = e.valueOffset + i;
    if (off >= dv.byteLength) break;
    const c = dv.getUint8(off);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.trim() || null;
}

function readRationals(dv, e, want) {
  if (e.type !== 5) return null;
  const out = [];
  for (let i = 0; i < Math.min(e.count, want); i++) {
    const o = e.valueOffset + i * 8;
    if (o + 8 > dv.byteLength) return null;
    const num = dv.getUint32(o, e.le), den = dv.getUint32(o + 4, e.le);
    out.push(den ? num / den : 0);
  }
  return out.length === want ? out : null;
}

function readGps(dv, off, le) {
  let latRef = null, lonRef = null, lat = null, lon = null;
  for (const e of readIfd(dv, off, le)) {
    if (e.tag === 0x0001) latRef = ascii(dv, e);
    else if (e.tag === 0x0003) lonRef = ascii(dv, e);
    else if (e.tag === 0x0002) lat = readRationals(dv, e, 3);
    else if (e.tag === 0x0004) lon = readRationals(dv, e, 3);
  }
  if (!lat || !lon) return null;
  const dec = (dms, ref) => {
    const d = dms[0] + dms[1] / 60 + dms[2] / 3600;
    return (ref === 'S' || ref === 'W') ? -d : d;
  };
  return { lat: dec(lat, latRef), lon: dec(lon, lonRef) };
}

// ─── JPEG segment scan + strip ────────────────────────────────────────────────

function scanJpeg(bytes) {
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
  const segs = [];
  let p = 2;
  while (p + 1 < bytes.length) {
    if (bytes[p] !== 0xFF) break;                 // misaligned — bail, keep file intact
    let marker = bytes[p + 1];
    while (marker === 0xFF && p + 2 < bytes.length) { p++; marker = bytes[p + 1]; } // fill bytes
    if (marker === 0xD9) { segs.push({ marker, start: p, end: p + 2 }); break; } // EOI
    if (marker === 0xDA) { segs.push({ marker, start: p, sos: true }); break; }   // SOS → entropy data
    if ((marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) { // standalone, no length
      segs.push({ marker, start: p, end: p + 2 }); p += 2; continue;
    }
    if (p + 4 > bytes.length) break;
    const len = (bytes[p + 2] << 8) | bytes[p + 3];
    if (len < 2 || p + 2 + len > bytes.length) break;
    segs.push({ marker, start: p, end: p + 2 + len, dataStart: p + 4, dataLen: len - 2 });
    p += 2 + len;
  }
  return segs;
}

function stripJpeg(bytes) {
  const segs = scanJpeg(bytes);
  if (!segs) return bytes;
  const keep = [bytes.subarray(0, 2)];            // SOI
  for (const s of segs) {
    if (s.sos) { keep.push(bytes.subarray(s.start)); continue; } // SOS + entropy data + EOI
    const isApp = s.marker >= 0xE0 && s.marker <= 0xEF;
    const isCom = s.marker === 0xFE;
    if ((isApp && s.marker !== 0xE0) || isCom) continue; // drop metadata; keep APP0 (JFIF)
    keep.push(bytes.subarray(s.start, s.end));
  }
  return concatBytes(keep);
}

// ─── PNG chunk scan + strip ─────────────────────────────────────────────────

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const PNG_STRIP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function isPng(b) {
  for (let i = 0; i < 8; i++) if (b[i] !== PNG_SIG[i]) return false;
  return true;
}

function scanPng(bytes) {
  const chunks = [];
  let p = 8;
  while (p + 8 <= bytes.length) {
    const len = ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0;
    const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    const end = p + 12 + len;
    if (end > bytes.length) break;
    chunks.push({ type, start: p, end, dataStart: p + 8, dataLen: len });
    p = end;
    if (type === 'IEND') break;
  }
  return chunks;
}

function stripPng(bytes) {
  const chunks = scanPng(bytes);
  if (!chunks.length) return bytes;
  const keep = [bytes.subarray(0, 8)];
  for (const c of chunks) {
    if (PNG_STRIP.has(c.type)) continue;
    keep.push(bytes.subarray(c.start, c.end));
  }
  return concatBytes(keep);
}

// ─── raster analyse (JPEG / PNG) ──────────────────────────────────────────────

function analyzeRaster(bytes) {
  const findings = [];
  let kind = 'file';
  const gpsDetail = (gps) => gps ? `${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}` : 'present';

  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    kind = 'JPEG';
    let exif = null, xmp = false, icc = false, iptc = false, comment = false;
    for (const s of scanJpeg(bytes) || []) {
      if (s.dataStart == null) continue;
      if (s.marker === 0xE1) {
        if (matchAscii(bytes, s.dataStart, 'Exif\0\0')) exif = readTiff(bytes, s.dataStart + 6, s.dataLen - 6);
        else if (matchAscii(bytes, s.dataStart, 'http://ns.adobe.com/xap/')) xmp = true;
      } else if (s.marker === 0xE2 && matchAscii(bytes, s.dataStart, 'ICC_PROFILE\0')) icc = true;
      else if (s.marker === 0xED) iptc = true;
      else if (s.marker === 0xFE) comment = true;
    }
    if (exif) {
      if (exif.hasGps) findings.push({ label: 'GPS location', detail: gpsDetail(exif.gps), tone: 'warn' });
      if (exif.make || exif.model) findings.push({ label: 'Camera / device', detail: [exif.make, exif.model].filter(Boolean).join(' '), tone: 'warn' });
      if (exif.artist) findings.push({ label: 'Author', detail: exif.artist, tone: 'warn' });
      if (exif.dateTime) findings.push({ label: 'Date taken', detail: exif.dateTime, tone: '' });
      if (exif.software) findings.push({ label: 'Software', detail: exif.software, tone: '' });
      findings.push({ label: 'EXIF block', detail: 'camera & shooting data', tone: '' });
    }
    if (xmp) findings.push({ label: 'XMP metadata', detail: 'editing / rights data', tone: '' });
    if (icc) findings.push({ label: 'ICC colour profile', detail: 'embedded profile', tone: '' });
    if (iptc) findings.push({ label: 'IPTC / Photoshop', detail: 'caption / author data', tone: '' });
    if (comment) findings.push({ label: 'Comment', detail: 'embedded text', tone: '' });
  } else if (isPng(bytes)) {
    kind = 'PNG';
    let exif = null, texts = 0, time = false;
    for (const c of scanPng(bytes)) {
      if (c.type === 'eXIf') exif = readTiff(bytes, c.dataStart, c.dataLen);
      else if (c.type === 'tEXt' || c.type === 'zTXt' || c.type === 'iTXt') texts++;
      else if (c.type === 'tIME') time = true;
    }
    if (exif) {
      if (exif.hasGps) findings.push({ label: 'GPS location', detail: gpsDetail(exif.gps), tone: 'warn' });
      if (exif.make || exif.model) findings.push({ label: 'Camera / device', detail: [exif.make, exif.model].filter(Boolean).join(' '), tone: 'warn' });
      findings.push({ label: 'EXIF block', detail: 'embedded camera data', tone: '' });
    }
    if (texts) findings.push({ label: 'Text chunks', detail: `${texts} text/metadata chunk${texts > 1 ? 's' : ''}`, tone: '' });
    if (time) findings.push({ label: 'Timestamp', detail: 'last-modified time', tone: '' });
  }
  return { kind, findings };
}

// ─── SVG tokenizer + clean + analyse ──────────────────────────────────────────
// No DOM: a small, careful XML tokenizer (same spirit as the JPEG/PNG scanners).

function prefixOf(name) {
  const c = name.indexOf(':');
  return c > 0 ? name.slice(0, c).toLowerCase() : '';
}

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

function analyzeSvg(toks) {
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

// ─── format dispatch ───────────────────────────────────────────────────────────

function looksLikeSvg(text) {
  return /<svg[\s>]/i.test(text);
}

// "%PDF-" magic at the start of the file.
function isPdf(b) {
  return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2D;
}

// Append "-clean" before the extension: report.pdf → report-clean.pdf.
function cleanName(name) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)}-clean${name.slice(dot)}` : `${name}-clean`;
}

// Classify the file and surface the text decode for SVG (so it isn't decoded
// twice). Returns { kind: 'JPEG'|'PNG'|'SVG'|'PDF'|'file', text }.
function classify(bytes) {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return { kind: 'JPEG', text: null };
  if (isPng(bytes)) return { kind: 'PNG', text: null };
  if (isPdf(bytes)) return { kind: 'PDF', text: null };
  let text = null;
  try { text = decodeText(bytes); } catch (e) { /* not decodable text */ }
  if (text != null && looksLikeSvg(text)) return { kind: 'SVG', text };
  return { kind: 'file', text };
}

// Produce the cleaned bytes for a supported file; unsupported input passes through.
function cleanBytes(bytes, info) {
  const { kind, text } = info || classify(bytes);
  if (kind === 'JPEG') return stripJpeg(bytes);
  if (kind === 'PNG') return stripPng(bytes);
  if (kind === 'SVG') return encodeText(clean(tokenize(text)));
  return bytes; // unrecognised — leave untouched rather than risk corruption
}

// ─── lifecycle ───────────────────────────────────────────────────────────────

async function patch({ model, host }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  const f = inputs.source;
  const blank = {
    hasFile: false, supported: false, pdfUnavailable: false, findings: [], nothingFound: false,
    fileName: '', fileSize: '', kind: '', metaSummary: '', cleanSize: '',
    tailNote: '', cleanNote: '',
  };
  if (!f || !f.bytes) return blank;

  const base = { ...blank, hasFile: true, fileName: f.name, fileSize: fmtBytes(f.size) };
  const info = classify(f.bytes);
  if (info.kind === 'file') {
    return { ...base, kind: 'file' }; // supported:false → template shows guidance
  }

  // PDF can't be cleaned by in-hook byte surgery — it goes through host.pdf (a
  // real PDF library in the shell). Shells without that capability degrade to a
  // clear "not available here" rather than a wrong "already clean".
  if (info.kind === 'PDF') {
    if (!host || !host.pdf) {
      return { ...base, kind: 'PDF', supported: true, pdfUnavailable: true };
    }
    let findings = [];
    try { ({ findings } = await host.pdf.analyze(f.bytes)); } catch (e) { findings = []; }
    return {
      ...base,
      supported: true,
      kind: 'PDF',
      findings,
      nothingFound: findings.length === 0,
      cleanSize: '', // a re-save's size isn't meaningful to preview, so it's omitted
      tailNote: 'Your PDF is re-saved without its metadata — the pages are preserved; only the document info and any XMP packet are removed. (A re-save isn\'t byte-for-byte and invalidates any digital signature.)',
      cleanNote: 'You can still download a re-saved copy below.',
      metaSummary: findings.length
        ? `Found ${findings.length} item${findings.length > 1 ? 's' : ''} of hidden data — they'll be removed.`
        : '',
    };
  }

  let findings = [];
  try {
    findings = info.kind === 'SVG' ? analyzeSvg(tokenize(info.text)) : analyzeRaster(f.bytes).findings;
  } catch (e) { findings = []; }

  let cleanLen = f.bytes.length;
  try { cleanLen = cleanBytes(f.bytes, info).length; } catch (e) { /* keep original size */ }
  const removed = Math.max(0, f.bytes.length - cleanLen);

  const isVector = info.kind === 'SVG';
  const pct = f.bytes.length > 0 ? Math.round((removed / f.bytes.length) * 100) : 0;
  const sizeNote = removed > 0 ? `That's ${fmtBytes(removed)} smaller${pct >= 1 ? ` (−${pct}%)` : ''}. ` : '';
  const tailNote = isVector
    ? `${sizeNote}The artwork renders identically — only metadata, comments and editor cruft are removed.`
    : 'The clean copy keeps the image pixels byte-for-byte — only the metadata is removed, nothing is re-compressed.';

  return {
    ...base,
    supported: true,
    kind: info.kind,
    findings,
    nothingFound: findings.length === 0,
    cleanSize: fmtBytes(cleanLen),
    tailNote,
    cleanNote: isVector
      ? `${sizeNote}You can still download the re-saved copy below.`
      : 'You can still download a re-saved copy below.',
    metaSummary: findings.length
      ? `Found ${findings.length} item${findings.length > 1 ? 's' : ''} of hidden data${removed > 0 ? ` — ${fmtBytes(removed)} will be removed` : ''}.`
      : '',
  };
}

function onInit(ctx) { return patch(ctx); }
function onInput(ctx) { return patch(ctx); }

async function exportFile({ model, host }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  const f = inputs.source;
  if (!f || !f.bytes) throw new Error('Choose an image first.');

  // PDF is re-saved (metadata removed) via the shell's PDF capability.
  if (isPdf(f.bytes)) {
    if (!host || !host.pdf) throw new Error('PDF cleaning isn\'t available in this app.');
    const { bytes } = await host.pdf.strip(f.bytes);
    return { bytes, mime: 'application/pdf', filename: cleanName(f.name) };
  }

  // JPEG / PNG / SVG: lossless in-hook surgery (unrecognised input passes through).
  let bytes = f.bytes;
  try { bytes = cleanBytes(f.bytes); } catch (e) { bytes = f.bytes; }
  return { bytes, mime: f.mime || 'application/octet-stream', filename: cleanName(f.name) };
}
