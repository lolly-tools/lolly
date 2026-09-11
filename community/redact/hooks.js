/* global onInit, onInput, exportFile */
/**
 * Redact - runs entirely in the sandboxed hook context (no imports, no network).
 *
 * Redaction here is a destructive re-generation of the file, never a drawing
 * operation: the sensitive bytes must not exist in the output, and the output is
 * a newly constructed container. Concretely:
 *
 *   JPEG/PNG/WebP: decode → composite onto opaque white → burn 100%-opaque black
 *                  bars → re-encode through a canvas. Metadata, embedded
 *                  thumbnails, extra frames/pictures and trailing bytes are gone
 *                  BY CONSTRUCTION - the re-encode is the metadata kill.
 *   SVG (default): rasterised through the same canvas path → PNG out.
 *   SVG (vector) : opt-in string surgery - metadata/comments/scripts/foreignObject/
 *                  editor cruft deleted, THEN every element a bar touches deleted
 *                  outright, then bars appended as opaque rects. The geometry the
 *                  sandbox cannot compute is measured in the browser instead: the
 *                  page renders as INLINE SVG, the template script reads real
 *                  painted bounds off the live DOM and commits the addresses of
 *                  the nodes to delete alongside the bars.
 *   PDF          : rasterise-and-rebuild via host.pdf.redact (feature-detected;
 *                  shells without it degrade to a clear "not available here").
 *                  Pages preview as per-page INLINE SVGs via host.pdf.pages, so
 *                  bars are drawn directly in PDF point space (viewBox = points,
 *                  origin top-left) and play straight over the PDF at export.
 *
 * Why inline and not an <img src="blob:…">: an SVG inside an <img> is a closed
 * document. Nothing outside can walk it, so getBBox / getBoundingClientRect are
 * unreachable and no node bounds exist at all. Inline, the same markup is part
 * of the live DOM and every glyph run, path and image reports its true painted
 * box. That is the enabling change for snap-to-cover, the partial-coverage
 * warning and vector deletion. Raster sources stay <img> - flat pixels have no
 * nodes to measure, and the copy says so.
 *
 * The differentiator is honesty: the tool reports, live, what the current marks
 * do and do NOT remove - and exportFile re-scans its own output (residual
 * metadata, trailing bytes, bar-region uniformity) and THROWS on any failure,
 * so nothing downloads that the tool cannot vouch for. Absence of a finding is
 * never presented as evidence of absence.
 *
 * Analysis is hand-rolled byte scanning (same spirit as strip-data): no DOM, no
 * DOMParser, identical behaviour across web, Tauri and CLI shells. Only the
 * export path needs a real browser canvas, and it says so plainly when headless.
 * The input buffer (f.bytes) is never mutated - every output is a new buffer.
 */

// ─── shared byte / text helpers ──────────────────────────────────────────────

function inputsFrom(model) {
  const o = {};
  model.forEach((i) => { o[i.id] = i.value; });
  return o;
}

function fmtBytes(n) {
  if (!(n > 0)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${i === 0 ? v : v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function matchAscii(bytes, off, str) {
  if (off < 0 || off + str.length > bytes.length) return false;
  for (let i = 0; i < str.length; i++) {
    if (bytes[off + i] !== str.charCodeAt(i)) return false;
  }
  return true;
}

// Naive forward search for an ASCII needle in a byte buffer. Fine at 50 MB for
// the short needles we use ("jumb", "%%EOF", "/C2PA").
function indexOfAscii(bytes, str, from) {
  const first = str.charCodeAt(0);
  const last = bytes.length - str.length;
  for (let i = Math.max(0, from || 0); i <= last; i++) {
    if (bytes[i] !== first) continue;
    if (matchAscii(bytes, i, str)) return i;
  }
  return -1;
}

function countAscii(bytes, str) {
  let n = 0, p = 0;
  for (;;) {
    p = indexOfAscii(bytes, str, p);
    if (p === -1) return n;
    n++;
    p += str.length;
  }
}

function decodeText(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

function encodeText(str) {
  return new TextEncoder().encode(str);
}

// ─── format classification (magic bytes - the accept list is only a UX hint) ─

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

function isPngMagic(b) {
  for (let i = 0; i < 8; i++) if (b[i] !== PNG_SIG[i]) return false;
  return true;
}

function isJpegMagic(b) {
  return b.length > 2 && b[0] === 0xFF && b[1] === 0xD8;
}

function isWebpMagic(b) {
  return b.length > 12 && matchAscii(b, 0, 'RIFF') && matchAscii(b, 8, 'WEBP');
}

// "%PDF-" within the first 1 KB - real readers tolerate a small leading offset.
function isPdfMagic(b) {
  if (!b || b.length < 5) return false;
  const limit = Math.min(b.length - 5, 1024);
  for (let i = 0; i <= limit; i++) {
    if (matchAscii(b, i, '%PDF-')) return true;
  }
  return false;
}

function looksLikeSvg(text) {
  return /<svg[\s>]/i.test(text);
}

// Returns { kind: 'JPEG'|'PNG'|'WebP'|'SVG'|'PDF'|'file', text } - text only for SVG.
function classify(bytes) {
  if (isJpegMagic(bytes)) return { kind: 'JPEG', text: null };
  if (isPngMagic(bytes)) return { kind: 'PNG', text: null };
  if (isWebpMagic(bytes)) return { kind: 'WebP', text: null };
  if (isPdfMagic(bytes)) return { kind: 'PDF', text: null };
  let text = null;
  try { text = decodeText(bytes); } catch (e) { /* not decodable text */ }
  if (text != null && looksLikeSvg(text)) return { kind: 'SVG', text };
  return { kind: 'file', text: null };
}

// ─── EXIF / TIFF reader (JPEG APP1 and PNG eXIf) ─────────────────────────────
// Offsets inside a TIFF block are relative to the TIFF header, so the DataView
// is anchored there. Best-effort: anything malformed → null.

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function readIfd(dv, off, le) {
  const out = { entries: [], next: 0 };
  if (off <= 0 || off + 2 > dv.byteLength) return out;
  const n = dv.getUint16(off, le);
  let p = off + 2;
  for (let i = 0; i < n; i++) {
    if (p + 12 > dv.byteLength) return out;
    const tag = dv.getUint16(p, le);
    const type = dv.getUint16(p + 2, le);
    const count = dv.getUint32(p + 4, le);
    const size = (TYPE_SIZE[type] || 1) * count;
    const valueOffset = size > 4 ? dv.getUint32(p + 8, le) : p + 8;
    out.entries.push({ tag, type, count, size, valueOffset, le });
    p += 12;
  }
  if (p + 4 <= dv.byteLength) out.next = dv.getUint32(p, le);
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
  for (const e of readIfd(dv, off, le).entries) {
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

function readTiff(bytes, base, len) {
  if (len < 8 || base < 0 || base + len > bytes.length) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset + base, len);
  const b0 = dv.getUint8(0), b1 = dv.getUint8(1);
  let le;
  if (b0 === 0x49 && b1 === 0x49) le = true;        // "II" little-endian
  else if (b0 === 0x4D && b1 === 0x4D) le = false;  // "MM" big-endian
  else return null;
  if (dv.getUint16(2, le) !== 42) return null;
  const out = {
    make: null, model: null, software: null, dateTime: null, dateTimeOriginal: null,
    artist: null, serial: null, hasGps: false, gps: null, hasThumbnail: false,
  };
  const ifd0 = readIfd(dv, dv.getUint32(4, le), le);
  let exifOff = 0;
  for (const e of ifd0.entries) {
    switch (e.tag) {
      case 0x010F: out.make     = ascii(dv, e); break;
      case 0x0110: out.model    = ascii(dv, e); break;
      case 0x0131: out.software = ascii(dv, e); break;
      case 0x0132: out.dateTime = ascii(dv, e); break;
      case 0x013B: out.artist   = ascii(dv, e); break;
      case 0x8769: exifOff = dv.getUint32(e.valueOffset, le); break; // Exif sub-IFD
      case 0x8825: {                                                // GPS IFD
        out.hasGps = true;
        out.gps = readGps(dv, dv.getUint32(e.valueOffset, le), le);
        break;
      }
    }
  }
  // A non-zero next-IFD pointer after IFD0 is IFD1 - the embedded thumbnail.
  if (ifd0.next > 0 && ifd0.next < dv.byteLength) {
    out.hasThumbnail = readIfd(dv, ifd0.next, le).entries.length > 0;
  }
  if (exifOff > 0) {
    for (const e of readIfd(dv, exifOff, le).entries) {
      if (e.tag === 0x9003) out.dateTimeOriginal = ascii(dv, e);
      else if (e.tag === 0xA431) out.serial = ascii(dv, e); // BodySerialNumber
    }
  }
  return out;
}

// ─── JPEG scanner ────────────────────────────────────────────────────────────

function scanJpeg(bytes) {
  if (!isJpegMagic(bytes)) return null;
  const segs = [];
  let p = 2;
  while (p + 1 < bytes.length) {
    if (bytes[p] !== 0xFF) break;                 // misaligned - bail
    let marker = bytes[p + 1];
    while (marker === 0xFF && p + 2 < bytes.length) { p++; marker = bytes[p + 1]; }
    if (marker === 0xD9) { segs.push({ marker, start: p, end: p + 2 }); break; }
    if (marker === 0xDA) { segs.push({ marker, start: p, sos: true }); break; }
    if ((marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
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

// Offset just past the EOI (FFD9) that ends the image, walking the entropy
// stream (and any further scans in a progressive JPEG). -1 when not found.
function jpegEndOffset(bytes) {
  const segs = scanJpeg(bytes);
  if (!segs) return -1;
  const sos = segs.find((s) => s.sos);
  if (!sos) {
    const eoi = segs.find((s) => s.marker === 0xD9);
    return eoi ? eoi.end : -1;
  }
  // Skip the SOS header, then scan entropy-coded data for a real marker.
  if (sos.start + 4 > bytes.length) return -1;
  const sosLen = (bytes[sos.start + 2] << 8) | bytes[sos.start + 3];
  let p = sos.start + 2 + sosLen;
  while (p + 1 < bytes.length) {
    if (bytes[p] !== 0xFF) { p++; continue; }
    const m = bytes[p + 1];
    if (m === 0x00 || (m >= 0xD0 && m <= 0xD7) || m === 0xFF) { p += 2; continue; } // stuffed / RST / fill
    if (m === 0xD9) return p + 2;                                  // EOI - done
    if (m === 0xDA) { p += 2; continue; }                          // next scan
    if (p + 4 > bytes.length) return -1;
    const len = (bytes[p + 2] << 8) | bytes[p + 3];                // table segment between scans
    if (len < 2 || p + 2 + len > bytes.length) return -1;
    p += 2 + len;
  }
  return -1;
}

function jpegDims(bytes) {
  for (const s of scanJpeg(bytes) || []) {
    const m = s.marker;
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC && s.dataStart != null && s.dataLen >= 5) {
      const d = s.dataStart;
      return { w: (bytes[d + 3] << 8) | bytes[d + 4], h: (bytes[d + 1] << 8) | bytes[d + 2] };
    }
  }
  return null;
}

// ─── PNG scanner ─────────────────────────────────────────────────────────────

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

function pngDims(bytes) {
  const c = scanPng(bytes)[0];
  if (!c || c.type !== 'IHDR' || c.dataLen < 8) return null;
  const d = c.dataStart;
  return {
    w: ((bytes[d] << 24) | (bytes[d + 1] << 16) | (bytes[d + 2] << 8) | bytes[d + 3]) >>> 0,
    h: ((bytes[d + 4] << 24) | (bytes[d + 5] << 16) | (bytes[d + 6] << 8) | bytes[d + 7]) >>> 0,
  };
}

// ─── WebP scanner ────────────────────────────────────────────────────────────

function scanWebp(bytes) {
  if (!isWebpMagic(bytes)) return null;
  const riffSize = (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) >>> 0;
  const chunks = [];
  let p = 12;
  const end = Math.min(bytes.length, 8 + riffSize);
  while (p + 8 <= end) {
    const fourcc = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);
    const len = (bytes[p + 4] | (bytes[p + 5] << 8) | (bytes[p + 6] << 16) | (bytes[p + 7] << 24)) >>> 0;
    const dataStart = p + 8;
    if (dataStart + len > bytes.length) break;
    chunks.push({ fourcc, start: p, dataStart, dataLen: len });
    p = dataStart + len + (len & 1); // chunks are padded to even length
  }
  return { riffSize, chunks };
}

function webpDims(bytes, scan) {
  const s = scan || scanWebp(bytes);
  if (!s) return null;
  for (const c of s.chunks) {
    const d = c.dataStart;
    if (c.fourcc === 'VP8X' && c.dataLen >= 10) {
      return {
        w: 1 + (bytes[d + 4] | (bytes[d + 5] << 8) | (bytes[d + 6] << 16)),
        h: 1 + (bytes[d + 7] | (bytes[d + 8] << 8) | (bytes[d + 9] << 16)),
      };
    }
    if (c.fourcc === 'VP8L' && c.dataLen >= 5 && bytes[d] === 0x2F) {
      const b = (bytes[d + 1] | (bytes[d + 2] << 8) | (bytes[d + 3] << 16) | (bytes[d + 4] << 24)) >>> 0;
      return { w: 1 + (b & 0x3FFF), h: 1 + ((b >> 14) & 0x3FFF) };
    }
    if (c.fourcc === 'VP8 ' && c.dataLen >= 10 && bytes[d + 3] === 0x9D && bytes[d + 4] === 0x01 && bytes[d + 5] === 0x2A) {
      return {
        w: (bytes[d + 6] | (bytes[d + 7] << 8)) & 0x3FFF,
        h: (bytes[d + 8] | (bytes[d + 9] << 8)) & 0x3FFF,
      };
    }
  }
  return null;
}

// ─── trailing bytes past the format terminator (the aCropalypse class) ──────

function trailingBytes(bytes, kind) {
  if (kind === 'PNG') {
    // No IEND, or a truncated chunk that stopped the scan early: everything
    // past the last whole chunk is unaccounted for - exactly the damaged
    // sources most likely to carry appended data, so count it rather than
    // failing open with 0.
    const chunks = scanPng(bytes);
    const last = chunks.length ? chunks[chunks.length - 1] : null;
    return last ? Math.max(0, bytes.length - last.end) : Math.max(0, bytes.length - 8);
  }
  if (kind === 'JPEG') {
    const end = jpegEndOffset(bytes);
    return end > 0 ? Math.max(0, bytes.length - end) : 0;
  }
  if (kind === 'WebP') {
    const s = scanWebp(bytes);
    if (!s || !(s.riffSize > 0)) return 0;
    const end = 8 + s.riffSize + (s.riffSize & 1);
    return Math.max(0, bytes.length - end);
  }
  return 0;
}

// ─── C2PA container presence (byte-scan only, never parsed) ──────────────────

function hasC2paBytes(bytes, kind) {
  if (kind === 'JPEG') {
    for (const s of scanJpeg(bytes) || []) {
      if (s.marker === 0xEB && s.dataStart != null) return true; // APP11 JUMBF
    }
  }
  if (kind === 'PNG') {
    for (const c of scanPng(bytes)) {
      if (c.type === 'caBX') return true;
      if (c.type === 'iTXt' && matchAscii(bytes, c.dataStart, 'c2pa')) return true;
    }
  }
  if (kind === 'WebP') {
    const s = scanWebp(bytes);
    for (const c of (s ? s.chunks : [])) {
      if (c.fourcc === 'C2PA' || c.fourcc === 'JUMB') return true;
    }
  }
  if (kind === 'PDF') {
    if (indexOfAscii(bytes, '/C2PA', 0) !== -1) return true;
  }
  // Generic fallback: a JUMBF superbox with a c2pa label anywhere in the file.
  return indexOfAscii(bytes, 'jumb', 0) !== -1 && indexOfAscii(bytes, 'c2pa', 0) !== -1;
}

// ─── SVG tokenizer (strip-data lineage - no DOMParser in the sandbox) ────────

function prefixOf(name) {
  const c = name.indexOf(':');
  return c > 0 ? name.slice(0, c).toLowerCase() : '';
}

const DROP_EL_PREFIX = new Set(['sodipodi', 'inkscape', 'i', 'x']); // i:/x: = Adobe private
// Vector redaction removes every never-paints, metadata-or-code element outright.
// title/desc are human-readable annotations, not artwork - they go too.
const DROP_EL_NAME = new Set(['metadata', 'script', 'foreignobject', 'title', 'desc']);
const SPACE_SENSITIVE = new Set(['text', 'tspan', 'textpath', 'tref', 'style', 'title', 'desc', 'script']);
const DROP_XMLNS = new Set([
  'xmlns:inkscape', 'xmlns:sodipodi', 'xmlns:i', 'xmlns:x',
  'xmlns:dc', 'xmlns:cc', 'xmlns:rdf',
]);

function shouldDropElement(name) {
  return DROP_EL_NAME.has(name.toLowerCase()) || DROP_EL_PREFIX.has(prefixOf(name));
}

function shouldDropAttr(name) {
  if (name === 'xml:space') return false;
  const lower = name.toLowerCase();
  if (DROP_EL_PREFIX.has(prefixOf(name))) return true;
  if (DROP_XMLNS.has(lower)) return true;
  if (lower.slice(0, 5) === 'data-') return true;   // data-* carries app payloads
  if (/^on[a-z]/.test(lower)) return true;          // event handlers are code
  return false;
}

// A data: href is an embedded payload (a data-URI JPEG carries its own EXIF);
// an http(s) href phones out when viewed. Neither may survive vector export.
// Internal '#id' references and relative paths are left alone.
function isRemoteOrDataHref(a) {
  const lower = a.name.toLowerCase();
  if (lower !== 'href' && lower !== 'xlink:href') return false;
  return !!a.value && /^\s*(?:data:|https?:)/i.test(a.value);
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
        toks.push({ t: 'cdata', raw: s.slice(i, close), text: s.slice(i + 9, end === -1 ? n : end) });
        i = close;
      } else if (s.startsWith('<!', i)) {
        const end = s.indexOf('>', i);
        const close = end === -1 ? n : end + 1;
        toks.push({ t: 'doctype', raw: s.slice(i, close) });
        i = close;
      } else if (s.startsWith('<?', i)) {
        const end = s.indexOf('?>', i);
        const close = end === -1 ? n : end + 2;
        const raw = s.slice(i, close);
        toks.push({ t: 'pi', raw, isXmlDecl: /^<\?xml\s/i.test(raw) });
        i = close;
      } else {
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

// The browser resolves an SVG's intrinsic size from its width/height whenever
// those carry an ABSOLUTE CSS length - '210mm' is 793.7 natural pixels in an
// <img>, not 210 and not the viewBox. The drawing surface measures bars against
// exactly that natural size, so this table has to agree with the browser or
// every bar in vector mode lands in the wrong place. em/rem resolve against the
// 16px initial font size, which is what an SVG loaded as an image gets.
// Percentages and font-metric units (ex, ch) and viewport units have no
// resolvable value here, so they return NaN and the caller falls back to the
// viewBox, which is what the browser does too.
const CSS_PX_PER_UNIT = {
  '': 1, px: 1, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6,
  pt: 96 / 72, pc: 16, em: 16, rem: 16,
};

function pxLength(v) {
  const m = /^\s*\+?(\d*\.?\d+)([a-z]*)\s*$/i.exec(v == null ? '' : String(v));
  if (!m) return NaN;
  const unit = m[2].toLowerCase();
  // hasOwnProperty, not a truthiness test: '10constructor' must not resolve
  // through the prototype chain.
  if (!Object.prototype.hasOwnProperty.call(CSS_PX_PER_UNIT, unit)) return NaN;
  return parseFloat(m[1]) * CSS_PX_PER_UNIT[unit];
}

function svgDims(text) {
  for (const tk of tokenize(text)) {
    if ((tk.t === 'open' || tk.t === 'self') && tk.name.toLowerCase() === 'svg') {
      let w = null, h = null, vb = null;
      for (const a of tk.attrs) {
        const lower = a.name.toLowerCase();
        if (lower === 'width') w = pxLength(a.value);
        else if (lower === 'height') h = pxLength(a.value);
        else if (lower === 'viewbox' && a.value) {
          const p = a.value.trim().split(/[\s,]+/).map(Number);
          if (p.length === 4 && isFinite(p[2]) && isFinite(p[3])) vb = { x: p[0], y: p[1], w: p[2], h: p[3] };
        }
      }
      const hasWh = isFinite(w) && isFinite(h) && w > 0 && h > 0;
      return {
        w: hasWh ? w : (vb ? vb.w : null),
        h: hasWh ? h : (vb ? vb.h : null),
        viewBox: vb,
        attrWh: hasWh,
      };
    }
  }
  return { w: null, h: null, viewBox: null, attrWh: false };
}

// ─── inline-SVG preparation (the enabling change for node geometry) ─────────
// A page has to be part of the live DOM before anything can read a node's
// painted bounds, so both the PDF page previews and an SVG source are INLINED
// into the template rather than handed to an <img>. Two consequences this pass
// has to handle, because an inline fragment shares the app's document:
//
//   1. Code. <script>, <foreignObject> and on* handlers would execute in the
//      app's origin. They are deleted here, before the markup is ever inlined.
//      (Vector EXPORT deletes the same classes again from the original text -
//      this pass only prepares the preview and never feeds the export.)
//   2. Styles. A <style> inside inline SVG is document-wide in HTML, so a file
//      carrying `.cls-1 { fill: #fff }` would repaint the app. Every rule is
//      rescoped under the root's own attribute selector instead of dropped, so
//      the preview still looks like the file the user is redacting.
//
// TRUST: the markup passed through here is either OUR OWN renderer's output
// (host.pdf.pages → engine pdf-svg) or the user's own file, opened on their own
// device and never fetched from anywhere. It is not third-party markup arriving
// over a network. That is why sanitising the executable subset plus scoping the
// styles is proportionate, and why the template can use a raw {{{ }}} slot for
// it. It is still an untrusted-INPUT surface (a hostile SVG someone was sent is
// exactly the threat this tool exists for), so the code classes go regardless.

// Every element gets data-rdn="<token index>", its address in tokenize(text).
// Both this pass and the export's deletion pass tokenize the SAME original
// string, so the index is stable by construction - no id minting, no matching.
const INLINE_DROP_EL = new Set(['script', 'foreignobject']);

// A URL that an inline fragment may keep. Only two forms cannot reach the
// network from inside the app: a same-document fragment (#grad) and a data:
// URI the file already carries. EVERYTHING else is dropped, including relative
// paths - an inline <image href="logo.png"> resolves against the APP's origin,
// so it is both a broken paint and a request the user never asked for.
//
// This is the difference an inline preview makes. Rounds 1-3 rendered the
// source inside <img>, where SVG-as-image blocks every external resource load
// for us; round 4 inlines it into the live document, so the block has to be
// ours. A hostile file arriving through a communication channel - the exact
// threat this tool exists for - must not phone home merely because it was
// opened here, and the empty state promises the file is never uploaded.
function safeInlineUrl(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return false;
  if (s.charAt(0) === '#') return true;
  return /^data:/i.test(s);
}

// Every url(...) in a scoped rule that could leave the device, neutralised.
// `none` is valid in every property that takes a url() here (fill, stroke,
// filter, mask, clip-path, background, @font-face src), so the rule stays
// parseable and simply paints nothing instead of fetching.
function stripRemoteCssUrls(css) {
  return String(css).replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\)/gi, (m, dq, sq, bare) => {
    const v = dq != null ? dq : (sq != null ? sq : (bare || ''));
    return safeInlineUrl(v) ? m : 'none';
  });
}

// @import is dropped outright; every remaining url() is checked, because a
// preview that fetches is a preview that reports the file was opened.
function scopeCssRules(rawCss, prefix, depth) {
  // Dropped BEFORE parsing: an @import has no braces, so it would otherwise be
  // read as part of the next rule's selector and survive into the preview,
  // where it would fetch from inside the app.
  const css = stripRemoteCssUrls(rawCss.replace(/@import[^;]*;/gi, ''));
  let out = '';
  let i = 0;
  const n = css.length;
  while (i < n) {
    const brace = css.indexOf('{', i);
    if (brace === -1) { out += css.slice(i); break; }
    const head = css.slice(i, brace);
    // Match the block, tolerating nesting.
    let depthB = 0, j = brace;
    for (; j < n; j++) {
      if (css[j] === '{') depthB++;
      else if (css[j] === '}') { depthB--; if (depthB === 0) break; }
    }
    const body = css.slice(brace + 1, j === n ? n : j);
    const sel = head.trim();
    if (sel.charAt(0) === '@') {
      const nested = /^@(?:media|supports|layer|container)\b/i.test(sel);
      out += head + '{' + (nested && depth < 3 ? scopeCssRules(body, prefix, depth + 1) : body) + '}';
    } else if (sel) {
      const scoped = sel.split(',').map((s) => {
        const t = s.trim();
        return t ? prefix + ' ' + t : '';
      }).filter(Boolean).join(',');
      out += scoped + '{' + body + '}';
    }
    i = (j === n ? n : j + 1);
  }
  return out;
}

// Attributes that name a resource the browser fetches as soon as the element is
// in the document.
const INLINE_URL_ATTR = new Set(['href', 'xlink:href', 'src', 'xlink:src']);

function inlineAttrsFor(tk, isRoot, opts) {
  const kept = [];
  for (const a of tk.attrs) {
    const lower = a.name.toLowerCase();
    if (/^on[a-z]/.test(lower)) continue;                       // handlers are code
    // javascript: is code; http(s):, protocol-relative and plain relative paths
    // are all requests from the app's own origin the moment this is inlined.
    if (INLINE_URL_ATTR.has(lower) && !safeInlineUrl(a.value)) continue;
    if (isRoot && (lower === 'width' || lower === 'height')) continue; // replaced below
    if (lower === 'data-rdn') continue;                         // never trust an incoming address
    if (a.value == null) { kept.push(a.name); continue; }
    // fill="url(https://…)", style="mask:url(//…)": same fetch, different spelling.
    if (a.value.indexOf('url(') !== -1 || a.value.indexOf('URL(') !== -1) {
      const cleaned = stripRemoteCssUrls(a.value);
      const q = cleaned.indexOf('"') !== -1 ? "'" : '"';
      kept.push(`${a.name}=${q}${cleaned}${q}`);
      continue;
    }
    const quote = a.value.indexOf('"') !== -1 ? "'" : '"';
    kept.push(`${a.name}=${quote}${a.value}${quote}`);
  }
  if (isRoot) {
    // The root is sized in CSS pixels at the SAME natural size the bars are
    // measured against, with the viewBox left alone. An inline <svg> then
    // letterboxes its viewBox inside that box exactly the way an <img> does,
    // so one uniform client↔bar-space mapping covers pointer maths and node
    // bounds alike, and it agrees with the export's own mapping.
    kept.push(`width="${opts.natW}"`, `height="${opts.natH}"`);
    kept.push(`class="${opts.className || 'rd-img'}"`, 'data-rdsvg=""', 'aria-hidden="true"');
  }
  return kept.length ? ' ' + kept.join(' ') : '';
}

// Returns inline-ready markup, or '' when the text has no <svg> root at all.
function prepareInlineSvg(text, opts) {
  const toks = tokenize(text);
  const out = [];
  let rootSeen = false;
  let dropName = null, dropDepth = 0;
  let styleDepth = 0;
  const scope = 'svg[data-rdsvg]';

  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i];
    if (dropDepth > 0) {
      if (tk.t === 'open' && tk.name === dropName) dropDepth++;
      else if (tk.t === 'close' && tk.name === dropName) dropDepth--;
      continue;
    }
    switch (tk.t) {
      case 'comment':
      case 'doctype':
      case 'pi':
        break; // an inline fragment carries no prologue, and comments are noise
      case 'cdata':
        out.push(styleDepth > 0 ? scopeCssRules(tk.text || '', scope, 0) : tk.raw);
        break;
      case 'text':
        out.push(styleDepth > 0 ? scopeCssRules(tk.raw, scope, 0) : tk.raw);
        break;
      case 'open':
      case 'self': {
        const lname = tk.name.toLowerCase();
        if (INLINE_DROP_EL.has(lname)) {
          if (tk.t === 'open') { dropName = tk.name; dropDepth = 1; }
          break;
        }
        const isRoot = !rootSeen && lname === 'svg';
        if (isRoot) rootSeen = true;
        const addr = (!isRoot && opts.annotate !== false) ? ` data-rdn="${i}"` : '';
        const body = tk.name + inlineAttrsFor(tk, isRoot, opts) + addr;
        out.push(tk.t === 'self' ? `<${body}/>` : `<${body}>`);
        if (tk.t === 'open' && lname === 'style') styleDepth++;
        break;
      }
      case 'close':
        if (tk.name.toLowerCase() === 'style' && styleDepth > 0) styleDepth--;
        out.push(tk.raw);
        break;
    }
  }
  return rootSeen ? out.join('') : '';
}

// ─── SVG deep analysis (redact adds code/embed findings to strip-data's set) ─

function analyzeSvg(text) {
  const findings = [];
  let editor = null, docName = null;
  let comments = 0, pathInComment = false, hasMetadata = false;
  let metaDepth = 0, metaParts = [];
  let scripts = 0, foreign = 0, handlers = 0, dataAttrs = 0;
  let embeddedImgs = 0, embeddedBytes = 0, dataFonts = 0, externalRefs = 0;
  let editorElements = false, adobePrivate = false;
  let styleDepth = 0, styleText = '';

  for (const tk of tokenize(text)) {
    if (metaDepth > 0 && tk.raw) metaParts.push(tk.raw);
    if (tk.t === 'comment') {
      comments++;
      const g = /Generator:\s*([^\n]*)/i.exec(tk.text);
      if (g && !editor) editor = g[1].replace(/-->\s*$/, '').replace(/,?\s*SVG (Export|Version).*$/i, '').trim();
      if (/[A-Za-z]:\\|\/Users\/|\/home\/|\.ai\b|\.eps\b|\.psd\b|\.sketch\b/.test(tk.text)) pathInComment = true;
    } else if (tk.t === 'open' || tk.t === 'self') {
      const lname = tk.name.toLowerCase();
      const pre = prefixOf(tk.name);
      if (lname === 'metadata') { hasMetadata = true; if (tk.t === 'open') metaDepth++; }
      if (lname === 'script') scripts++;
      if (lname === 'foreignobject') foreign++;
      if (lname === 'style' && tk.t === 'open') styleDepth++;
      if (pre === 'sodipodi' || pre === 'inkscape') editorElements = true;
      if (pre === 'i' || pre === 'x') adobePrivate = true;
      for (const a of tk.attrs) {
        const lower = a.name.toLowerCase();
        if (a.name === 'inkscape:version' && !editor) editor = 'Inkscape ' + (a.value || '').split(' ')[0];
        if (a.name === 'sodipodi:docname' && a.value) docName = a.value;
        if (/^on[a-z]/.test(lower)) handlers++;
        if (lower.slice(0, 5) === 'data-') dataAttrs++;
        if ((lower === 'href' || lower === 'xlink:href') && a.value) {
          if (/^data:image\//i.test(a.value)) {
            embeddedImgs++;
            const comma = a.value.indexOf(',');
            if (comma > -1) embeddedBytes += Math.floor((a.value.length - comma - 1) * 0.75);
          } else if (/^https?:/i.test(a.value)) externalRefs++;
        }
      }
    } else if (tk.t === 'close') {
      const lname = tk.name.toLowerCase();
      if (lname === 'metadata' && metaDepth > 0) metaDepth--;
      if (lname === 'style' && styleDepth > 0) styleDepth--;
    } else if (tk.t === 'text' || tk.t === 'cdata') {
      if (styleDepth > 0) styleText += tk.t === 'cdata' ? (tk.text || '') : tk.raw;
    }
  }

  const fontRe = /@font-face[^{}]*\{[^}]*\}/gi;
  let fm;
  while ((fm = fontRe.exec(styleText))) {
    if (/data:/i.test(fm[0])) dataFonts++;
  }

  let author = null;
  if (hasMetadata) {
    const meta = metaParts.join('');
    const cr = /<dc:(?:creator|rights)[^>]*>([\s\S]*?)<\/dc:(?:creator|rights)>/i.exec(meta);
    if (cr) { const t = cr[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); if (t) author = t; }
  }

  if (editor) findings.push({ label: 'Created with', detail: editor, tone: 'warn' });
  if (docName) findings.push({ label: 'Original filename', detail: docName, tone: 'warn' });
  if (author) findings.push({ label: 'Author', detail: author, tone: 'warn' });
  if (pathInComment) findings.push({ label: 'File path in comment', detail: 'a local path is embedded', tone: 'warn' });
  if (hasMetadata && !author) findings.push({ label: 'Metadata block', detail: 'embedded RDF or Dublin Core data', tone: '' });
  if (scripts) findings.push({ label: 'Scripts', detail: `${scripts} script element${scripts > 1 ? 's' : ''}, removed in both export modes`, tone: 'warn' });
  if (foreign) findings.push({ label: 'Foreign content', detail: `${foreign} foreignObject element${foreign > 1 ? 's' : ''} carrying non-SVG markup`, tone: 'warn' });
  if (handlers) findings.push({ label: 'Event handlers', detail: `${handlers} on* attribute${handlers > 1 ? 's' : ''}, code that runs when viewed`, tone: 'warn' });
  if (editorElements) findings.push({ label: 'Editor data', detail: 'Inkscape canvas, guides and settings', tone: '' });
  if (adobePrivate) findings.push({ label: 'Adobe private data', detail: 'Illustrator graphics format', tone: '' });
  if (dataAttrs) findings.push({ label: 'Data attributes', detail: `${dataAttrs} data-* attribute${dataAttrs > 1 ? 's' : ''} from an authoring app`, tone: '' });
  if (comments) findings.push({ label: 'Comments', detail: `${comments} comment${comments > 1 ? 's' : ''}`, tone: '' });
  if (embeddedImgs) findings.push({ label: 'Embedded images', detail: `${embeddedImgs} data-URI image${embeddedImgs > 1 ? 's' : ''}${embeddedBytes ? `, ~${fmtBytes(embeddedBytes)}` : ''}, each can carry its own EXIF`, tone: 'warn' });
  if (dataFonts) findings.push({ label: 'Embedded fonts', detail: `${dataFonts} data-URI @font-face block${dataFonts > 1 ? 's' : ''}, subset fonts reveal which glyphs the document used`, tone: '' });
  if (externalRefs) findings.push({ label: 'External references', detail: `${externalRefs} http(s) href${externalRefs > 1 ? 's' : ''}, viewing can phone out`, tone: 'warn' });
  return findings;
}

// ─── SVG vector-mode surgery ─────────────────────────────────────────────────
// REMOVE, never hide: metadata, comments, scripts, foreignObject, editor
// namespaces, data-* attributes, event handlers, @font-face data-URI blocks -
// AND every element whose painted bounds touched a bar, addressed by the token
// index the browser read off the inline preview (`dropSet`). Then unreferenced
// defs entries, then the opaque bars are appended in root viewBox coordinates.
//
// Deletion policy is over-inclusive on purpose: a node that TOUCHES a bar goes
// entirely. Half a word is a leak, and partial glyph surgery would be a worse
// lie than deleting the whole run. `removed` collects the text and payload
// hrefs that went, and the export gate greps the serialised output for every
// one of them, so "deleted" is a checked claim rather than an intention.

function rebuildTag(tk) {
  const kept = [];
  for (const a of tk.attrs) {
    if (shouldDropAttr(a.name) || isRemoteOrDataHref(a)) continue;
    if (a.value == null) { kept.push(a.name); continue; }
    const quote = a.value.includes('"') ? "'" : '"';
    kept.push(`${a.name}=${quote}${a.value}${quote}`);
  }
  const body = tk.name + (kept.length ? ' ' + kept.join(' ') : '');
  return tk.t === 'self' ? `<${body}/>` : `<${body}>`;
}

function stripFontFaceDataUris(css) {
  return css.replace(/@font-face[^{}]*\{[^}]*\}/gi, (rule) => (/data:/i.test(rule) ? '' : rule));
}

function cleanSvgTokens(toks, removed, dropSet) {
  const out = [];
  const stack = [];
  let dropName = null, dropDepth = 0;
  let styleDepth = 0;
  let rootSeen = false;

  for (let ti = 0; ti < toks.length; ti++) {
    const tk = toks[ti];
    if (dropDepth > 0) {
      // Inside a deleted subtree: collect its text so the gate can grep for it.
      if (tk.t === 'text' || tk.t === 'cdata') removed.push(tk.t === 'cdata' ? (tk.text || '') : tk.raw);
      if (tk.t === 'open' && tk.name === dropName) dropDepth++;
      else if (tk.t === 'close' && tk.name === dropName) dropDepth--;
      continue;
    }
    switch (tk.t) {
      case 'comment':
        removed.push(tk.text || '');
        break;
      case 'doctype':
        break;
      case 'pi':
        if (tk.isXmlDecl) out.push(tk.raw);
        break;
      case 'cdata':
        if (styleDepth > 0) {
          const kept = stripFontFaceDataUris(tk.text || '');
          out.push(`<![CDATA[${kept}]]>`);
        } else {
          out.push(tk.raw);
        }
        break;
      case 'text': {
        if (styleDepth > 0) { out.push(stripFontFaceDataUris(tk.raw)); break; }
        const sensitive = stack.length && SPACE_SENSITIVE.has(stack[stack.length - 1]);
        if (!sensitive && /^\s*$/.test(tk.raw)) break;
        out.push(tk.raw);
        break;
      }
      case 'open':
      case 'self': {
        const isRoot = !rootSeen && tk.name.toLowerCase() === 'svg';
        if (isRoot) rootSeen = true;
        if (shouldDropElement(tk.name)) {
          if (tk.t === 'open') { dropName = tk.name; dropDepth = 1; }
          break;
        }
        // Touched by a bar: the whole element goes. Its text is collected by
        // the dropDepth branch above; its payload hrefs are collected here so
        // the gate can grep for those too. The root <svg> is never a target -
        // deleting it would delete the document.
        if (dropSet && dropSet.has(ti) && !isRoot) {
          for (const a of tk.attrs) if (isRemoteOrDataHref(a)) removed.push(a.value);
          if (tk.t === 'open') { dropName = tk.name; dropDepth = 1; }
          break;
        }
        // An <image> whose href is a data: URI or an external URL is a payload
        // of its own - the whole element goes, and the href joins the grep
        // list so the gate proves it is gone.
        if (tk.name.toLowerCase() === 'image' && tk.attrs.some(isRemoteOrDataHref)) {
          for (const a of tk.attrs) if (isRemoteOrDataHref(a)) removed.push(a.value);
          if (tk.t === 'open') { dropName = tk.name; dropDepth = 1; }
          break;
        }
        // Dropped ATTRIBUTE values are editor housekeeping (data-name="Layer 2"
        // pairs with a kept id="Layer_2"), not secret content - they stay out
        // of the grep list; residualSvg proves the attribute classes are gone.
        // External and data: hrefs on other elements (an <a>, a remote <use>)
        // are stripped and DO join the grep list.
        const hasDroppable = tk.attrs.some((a) => shouldDropAttr(a.name) || isRemoteOrDataHref(a));
        if (hasDroppable) {
          for (const a of tk.attrs) if (isRemoteOrDataHref(a)) removed.push(a.value);
          out.push(rebuildTag(tk));
        } else {
          out.push(tk.raw);
        }
        if (tk.t === 'open') {
          stack.push(tk.name.toLowerCase());
          if (tk.name.toLowerCase() === 'style') styleDepth++;
        }
        break;
      }
      case 'close': {
        for (let k = stack.length - 1; k >= 0; k--) {
          if (stack[k] === tk.name.toLowerCase()) { stack.length = k; break; }
        }
        if (tk.name.toLowerCase() === 'style' && styleDepth > 0) styleDepth--;
        out.push(tk.raw);
        break;
      }
    }
  }
  return out.join('');
}

// Elements that paint NOTHING where they sit - they only ever render through a
// reference (<use href>, fill="url(#…)", mask=, filter=, marker-end=). A
// <symbol> full of text is the standard sprite idiom and is routinely declared
// at the top level rather than inside <defs>, so scoping the sweep below to
// <defs> children left a deleted <use>'s master, and its text, in the output
// with the export gate none the wiser. Dropping an unreferenced one of these
// cannot change the artwork, wherever it sits, because nothing was drawing it.
const NONRENDERING_EL = new Set([
  'symbol', 'marker', 'mask', 'clippath', 'pattern', 'filter',
  'lineargradient', 'radialgradient', 'meshgradient', 'solidcolor',
]);

// Second pass: drop definitions nothing references any more - <defs> children by
// id, and non-rendering containers anywhere in the tree. A removed consumer must
// not leave its master behind. An unreferenced id on a PAINTING element outside
// defs is left alone: it still renders, so deleting it would change the artwork.
//
// Run to a fixed point (bounded): a dropped <symbol> can be the last reference
// to the gradient it used, and that gradient is then unreferenced in turn.
function dropUnreferencedDefs(svgText) {
  let text = svgText;
  for (let pass = 0; pass < 4; pass++) {
    const next = dropUnreferencedOnce(text);
    if (next === text) break;
    text = next;
  }
  return text;
}

function dropUnreferencedOnce(svgText) {
  const referenced = new Set();
  let m;
  const urlRe = /url\(\s*["']?#([^)"'\s]+)/g;
  while ((m = urlRe.exec(svgText))) referenced.add(m[1]);
  const hrefRe = /(?:xlink:)?href\s*=\s*["']#([^"']+)["']/g;
  while ((m = hrefRe.exec(svgText))) referenced.add(m[1]);

  const out = [];
  const toks = tokenize(svgText);
  let defsDepth = 0, dropName = null, dropDepth = 0;
  for (const tk of toks) {
    if (dropDepth > 0) {
      if (tk.t === 'open' && tk.name === dropName) dropDepth++;
      else if (tk.t === 'close' && tk.name === dropName) dropDepth--;
      continue;
    }
    if (tk.t === 'open' || tk.t === 'self') {
      const lname = tk.name.toLowerCase();
      const idAttr = tk.attrs.find((a) => a.name.toLowerCase() === 'id');
      const unreferenced = !idAttr || !idAttr.value || !referenced.has(idAttr.value);
      if (unreferenced && (NONRENDERING_EL.has(lname) || (defsDepth === 1 && lname !== 'defs' && idAttr && idAttr.value))) {
        if (tk.t === 'open') { dropName = tk.name; dropDepth = 1; }
        continue;
      }
      if (lname === 'defs' && tk.t === 'open') defsDepth++;
    } else if (tk.t === 'close' && tk.name.toLowerCase() === 'defs' && defsDepth > 0) {
      defsDepth--;
    }
    out.push(tk.raw);
  }
  return out.join('');
}

function xmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  ));
}

const num2 = (n) => String(Math.round(n * 100) / 100);

// The painted shape as SVG path data - the SAME shape the canvas paths trace,
// so an SVG export and a PNG export of the same marks cover the same area.
function shapePathD(s) {
  const [tl, tr, br, bl] = s.radii;
  if (!tl && !tr && !br && !bl) {
    return `M${num2(s.x0)},${num2(s.y0)}H${num2(s.x1)}V${num2(s.y1)}H${num2(s.x0)}Z`;
  }
  const d = [`M${num2(s.x0 + tl)},${num2(s.y0)}`, `H${num2(s.x1 - tr)}`];
  if (tr) d.push(`A${num2(tr)},${num2(tr)} 0 0 1 ${num2(s.x1)},${num2(s.y0 + tr)}`);
  d.push(`V${num2(s.y1 - br)}`);
  if (br) d.push(`A${num2(br)},${num2(br)} 0 0 1 ${num2(s.x1 - br)},${num2(s.y1)}`);
  d.push(`H${num2(s.x0 + bl)}`);
  if (bl) d.push(`A${num2(bl)},${num2(bl)} 0 0 1 ${num2(s.x0)},${num2(s.y1 - bl)}`);
  d.push(`V${num2(s.y0 + tl)}`);
  if (tl) d.push(`A${num2(tl)},${num2(tl)} 0 0 1 ${num2(s.x0 + tl)},${num2(s.y0)}`);
  d.push('Z');
  return d.join('');
}

// `shapes` are already in the root's viewBox coordinates. Every fill is fully
// opaque: the mark's colour is a brand choice, its opacity never is.
function svgWithBars(svgText, shapes, mark, scale) {
  if (!shapes.length) return svgText;
  // Tolerate whitespace in the close tag ('</svg >'); a document whose bars
  // cannot be inserted must fail loudly, never ship without them.
  let close = -1, m;
  const closeRe = /<\/svg\s*>/gi;
  while ((m = closeRe.exec(svgText))) close = m.index;
  if (close === -1) {
    throw new Error('Verification failed: the redaction bars could not be placed in this SVG. Nothing was downloaded.');
  }
  const ink = normaliseInk(mark && mark.ink) || NEUTRAL_INK;
  const labelInk = normaliseInk(mark && mark.labelInk) || '#ffffff';
  const label = mark && mark.label ? String(mark.label) : '';
  const parts = [];
  for (const s of shapes) {
    // Square corners stay a <rect>: same painted area, simpler output, and a
    // reader of the file can see at a glance that the mark is a plain box.
    const square = !s.radii[0] && !s.radii[1] && !s.radii[2] && !s.radii[3];
    parts.push(square
      ? `<rect x="${num2(s.x0)}" y="${num2(s.y0)}" width="${num2(s.x1 - s.x0)}" height="${num2(s.y1 - s.y0)}" fill="${ink}" fill-opacity="1"/>`
      : `<path d="${shapePathD(s)}" fill="${ink}" fill-opacity="1"/>`);
    // Painted ON TOP of a shape that is already fully opaque, so it can reveal
    // nothing: what was under it is gone from the file, not hidden by it.
    const lay = label ? stampFit(s, label, 14 / (scale || 1)) : null;
    if (lay) {
      parts.push(
        `<text x="${num2(lay.cx)}" y="${num2(lay.cy)}" fill="${labelInk}" font-family="sans-serif"`
        + ` font-size="${num2(lay.size)}" font-weight="600" text-anchor="middle"`
        + ` dominant-baseline="central">${xmlEscape(label)}</text>`
      );
    }
  }
  return `${svgText.slice(0, close)}<g>${parts.join('')}</g>${svgText.slice(close)}`;
}

// ─── bars: parsing, snapping, quantising, coverage ───────────────────────────

// Bars arrive as blocks rows (page/x/y/w/h). Values can be strings from URL
// mode, so coerce; a bar with no area is ignored.
function parseBars(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const row of v) {
    if (!row || typeof row !== 'object') continue;
    const page = Math.max(1, Math.round(Number(row.page)) || 1);
    const x = Number(row.x), y = Number(row.y), w = Number(row.w), h = Number(row.h);
    if (!isFinite(x) || !isFinite(y) || !(w > 0) || !(h > 0)) continue;
    out.push({ page, x, y, w, h, n: row.n == null ? '' : String(row.n) });
  }
  return out;
}

// The per-bar `n` field is the browser's answer to "which elements does this
// bar touch", written by the template script at commit time. Three states, and
// the difference between the last two is the whole honesty of vector mode:
//
//   ''        never measured - a bar typed into the sidebar, restored from a
//             URL, or driven headlessly. Vector export REFUSES rather than
//             quietly covering what it cannot delete.
//   'm'       measured on the page preview, nothing under it.
//   'm:3,17'  measured, and these token addresses are to be deleted.
//
// Returns null for "never measured", otherwise an array of indices.
function parseNodeMarks(v) {
  const s = v == null ? '' : String(v).trim();
  if (s.charAt(0) !== 'm') return null;
  const rest = s.slice(1).replace(/^:/, '');
  if (!rest) return [];
  const out = [];
  for (const part of rest.split(',')) {
    const nn = Number(part);
    if (isFinite(nn) && nn >= 0) out.push(Math.round(nn));
  }
  return out;
}

function formatNodeMarks(list) {
  const arr = Array.isArray(list) ? list.filter((n) => isFinite(n) && n >= 0) : [];
  return arr.length ? 'm:' + arr.map((n) => Math.round(n)).join(',') : 'm';
}

// Every row, coerced but NOT area-filtered - the canvas round-trip. The canvas
// script commits the whole array back on each draw/delete, so a half-typed
// sidebar row (w and h still 0) must survive that round-trip instead of
// vanishing under the user's cursor. parseBars stays the geometry filter for
// coverage, burning and export; this is only for data-bars.
function barRows(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  const num = (x) => { const n = Number(x); return isFinite(n) ? n : 0; };
  for (const row of v) {
    if (!row || typeof row !== 'object') continue;
    out.push({
      page: Math.max(1, Math.round(Number(row.page)) || 1),
      x: num(row.x), y: num(row.y), w: num(row.w), h: num(row.h),
      n: row.n == null ? '' : String(row.n),
    });
  }
  return out;
}

const INFLATE_PX = 2;      // chroma-subsampling edge bleed margin, each side
// The raster resolution the PDF rebuild renders at. Named here because the
// canvas needs it too: the stamp's minimum size is decided in DEVICE pixels on
// that side of the bridge, so a preview that asked the question in points would
// hide a label the downloaded page carries.
const REDACT_DPI = 200;
const QUANT_GRID = 24;     // widths round UP to this grid when quantise is on
const QUANT_GRID_PT = 18;  // the same 24 CSS px in PDF points (24 * 72 / 96)

// Widen a horizontal span so its width lands on a coarse grid, keeping it
// centred on the original. This is the whole glyph-position mitigation the
// sidebar toggle and the limits panel both promise (Bland/Iyer/Levchenko,
// PoPETs 2023), so EVERY export path routes through it: raster and SVG via
// effectiveRect, PDF via the point-space pass in exportFile. A toggle that
// meant different things per format would be worse than no toggle.
function quantiseSpan(x0, x1, grid) {
  const w = x1 - x0;
  const qw = Math.ceil(w / grid) * grid;
  const extra = qw - w;
  return { x0: x0 - Math.floor(extra / 2), x1: x1 + Math.ceil(extra / 2) };
}

// Bars in PDF point space, made EFFECTIVE before they cross the bridge: integer
// snap, the 2-unit inflation, then the optional width quantise - the same order,
// on the same numbers, as effectiveRect and the canvas mirror's effBox.
//
// The order and the units both matter. The rebuild inflates by 2 DEVICE pixels
// (0.72pt at 200 dpi) and has no width grid at all, so quantising the raw span
// here and leaving the inflation to the far side painted a bar several points
// narrower than the one the preview drew - area the user watched go black
// shipped readable. Doing the whole effective rect here in points means the
// preview and the burn describe one rectangle; the bridge's own inflation then
// only ever adds a little more.
function quantiseBarsPt(bars, quantise) {
  return bars.map((b) => {
    let x0 = Math.floor(b.x) - INFLATE_PX;
    let x1 = Math.ceil(b.x + b.w) + INFLATE_PX;
    if (quantise !== false) {
      const q = quantiseSpan(x0, x1, QUANT_GRID_PT);
      x0 = q.x0;
      x1 = q.x1;
    }
    const y0 = Math.floor(b.y) - INFLATE_PX;
    const y1 = Math.ceil(b.y + b.h) + INFLATE_PX;
    const x = Math.max(0, x0);
    const y = Math.max(0, y0);
    return { page: b.page, x, y, w: Math.max(1, x1 - x), h: Math.max(1, y1 - y) };
  });
}

// The one shared geometry: integer-snapped, inflated, optionally width-
// quantised, clamped to the frame. Preview coverage, the canvas burn and the
// output verification all use exactly this rect, so what the meter reports is
// what gets painted and what gets checked.
function effectiveRect(bar, W, H, quantise) {
  let x0 = Math.floor(bar.x) - INFLATE_PX;
  let y0 = Math.floor(bar.y) - INFLATE_PX;
  let x1 = Math.ceil(bar.x + bar.w) + INFLATE_PX;
  let y1 = Math.ceil(bar.y + bar.h) + INFLATE_PX;
  if (quantise) {
    const q = quantiseSpan(x0, x1, QUANT_GRID);
    x0 = q.x0;
    x1 = q.x1;
  }
  x0 = Math.max(0, x0); y0 = Math.max(0, y0);
  x1 = Math.min(W, x1); y1 = Math.min(H, y1);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x0, y0, x1, y1 };
}

function rectsFor(bars, W, H, quantise, page) {
  const out = [];
  for (const b of bars) {
    if ((b.page || 1) !== (page || 1)) continue;
    const r = effectiveRect(b, W, H, quantise);
    if (r) out.push(r);
  }
  return out;
}

// ─── node geometry: snap-to-cover and partial coverage (pure) ───────────────
// The sandbox cannot compute glyph geometry; the browser can. So the TEMPLATE
// measures (real painted bounds off the inline SVG) and this file owns the
// MATHS. Everything below is pure and node-testable, and template.html carries
// a delimited mirror of these same functions (@geom-mirror) that
// tests/redact.test.ts evaluates and compares case by case, so the two copies
// cannot drift silently.
//
// Boxes are {x, y, w, h} in the frame's own bar space: PDF points for a page,
// natural CSS pixels for an SVG. Raster frames have no nodes at all, so neither
// behaviour can fire there and the copy says so.

// Do two boxes share any area at all, shared edges included? This is the
// disjointness test the exact rectangle subtraction needs (subtractBox), and
// nothing else: it is deliberately NOT the test for "did the user aim at this
// node", because on body text line boxes and word runs abut, and a predicate
// that counts a shared edge makes every neighbour of a neighbour reachable.
function rectTouches(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

// A real, positive-area overlap of at least `eps` on BOTH axes - the test for
// "this bar is actually over that node". Abutting boxes (a line box whose
// bottom edge is the next line box's top edge, two word runs separated by a
// hairline) share an edge and nothing else, and the old shared-edge-counts
// predicate is what let a bar chain along a whole paragraph one neighbour at a
// time. The epsilon also absorbs the sub-unit slop in measured glyph bounds, so
// a bar that grazes the descender of the line above by a fifth of a point is
// not treated as aimed at it.
const OVERLAP_EPS = 0.25;

function rectOverlaps(a, b, eps) {
  const e = eps == null ? OVERLAP_EPS : eps;
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return ox > e && oy > e;
}

function unionBox(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x, y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

// The effective painted box for a bar, as {x,y,w,h} - effectiveRect's geometry
// (integer snap, 2px inflation, optional width quantise, clamp to the frame)
// expressed in the same shape the node maths use. Falls back to the raw box
// when the bar clamps away entirely, so a probe is never empty.
function effBox(bar, W, H, quantise) {
  const r = effectiveRect(bar, W, H, quantise);
  if (!r) return { x: bar.x, y: bar.y, w: bar.w, h: bar.h };
  return { x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 };
}

// A node this big is the PAGE, not a thing on it: a scanned page's single image
// XObject, an Illustrator artboard rect, a full-bleed background. Snapping to it
// would union a bar with the whole page and ship the document as one solid
// rectangle; reporting it as partly covered would nag forever, since no bar can
// ever finish it; deleting it in vector mode would take the artwork's own
// backdrop out. So it is excluded from the node set entirely, and a bar over it
// covers exactly what the user drew - the same honest deal a raster source gets.
const BACKDROP_SPAN = 0.85;

function isBackdropNode(nb, W, H) {
  if (!nb || !(W > 0) || !(H > 0)) return false;
  return nb.w >= W * BACKDROP_SPAN && nb.h >= H * BACKDROP_SPAN;
}

function usableNode(nb) {
  return Boolean(nb) && isFinite(nb.x) && isFinite(nb.y) && nb.w >= 0 && nb.h >= 0;
}

// Grow a drawn bar to the union of the nodes the USER'S OWN rectangle is over,
// and stop there. Two properties, and they are in tension:
//
//   1. A bar that half-covers a glyph is a leak, so a node the user aimed at
//      has to end up fully inside the bar. That is why growth exists at all -
//      Andy drew strike-through-height bars that clipped the ascenders.
//   2. A bar has to stay the size of the thing the user pointed at. Growth used
//      to run to a FIXED POINT over the grown box, and on body text that is a
//      flood fill: the bar reaches a word, grows, now overlaps the next word and
//      the line above, grows again, and swallows the paragraph. Measured on a
//      real six-page PDF, a 20x20pt bar became 455x286pt - 325x the area - and
//      two different requested widths at the same point produced byte-identical
//      output, because the request was discarded the moment text was touched.
//      Word-level redaction was impossible, and headlessly nobody saw it happen.
//
// One pass resolves the tension. The nodes are chosen ONCE, from the box the
// user drew (painted, so inflation and quantise count), and the bar becomes the
// union of exactly those. Property 1 holds by construction: a union contains
// every box it was built from. Property 2 holds because nothing the grown box
// newly reaches can enlarge it further - the chain is cut at the first link.
//
// `hit` is a different question from growth and is answered against the FINAL
// painted box: it is the set vector export DELETES, and anything the bar paints
// over must be deleted or it stays extractable under an opaque rectangle. So
// growth is bounded by intent, deletion is bounded by paint, and hit is a
// superset of the grown-from set. A neighbour merely clipped by the final box is
// therefore removed in vector mode and reported by the partial-coverage warning
// - see partialNodes for why that is the honest rule rather than noise.
//
// `effOf` maps a raw box to the box that actually gets painted (inflation and
// width quantisation). Omit it and the raw box is probed.
//
// Quantise ordering is a consequence, not a separate step: this returns the raw
// grown bar and the export quantises THAT, so snap always happens first and the
// grid only ever widens the already-snapped span.
function snapBarToNodes(bar, nodes, effOf) {
  const raw = { x: bar.x, y: bar.y, w: bar.w, h: bar.h };
  const probe = effOf ? effOf(raw) : raw;
  let box = raw;
  for (let i = 0; i < nodes.length; i++) {
    const nb = nodes[i];
    if (!usableNode(nb)) continue;
    if (!rectOverlaps(probe, nb)) continue;
    box = unionBox(box, nb);
  }
  const final = effOf ? effOf(box) : box;
  const hit = [];
  for (let i = 0; i < nodes.length; i++) {
    const nb = nodes[i];
    if (!usableNode(nb)) continue;
    if (rectOverlaps(final, nb)) hit.push(i);
  }
  return { x: box.x, y: box.y, w: box.w, h: box.h, hit };
}

// r minus c, as up to four boxes. Exact - no sampling grid, so a one-unit
// sliver of an uncovered glyph cannot fall between samples.
function subtractBox(r, c) {
  if (!rectTouches(r, c)) return [r];
  const out = [];
  const top = Math.max(r.y, Math.min(r.y + r.h, c.y));
  const bottom = Math.min(r.y + r.h, Math.max(r.y, c.y + c.h));
  if (top > r.y) out.push({ x: r.x, y: r.y, w: r.w, h: top - r.y });
  if (bottom < r.y + r.h) out.push({ x: r.x, y: bottom, w: r.w, h: r.y + r.h - bottom });
  const midH = bottom - top;
  if (midH > 0) {
    const left = Math.max(r.x, Math.min(r.x + r.w, c.x));
    const right = Math.min(r.x + r.w, Math.max(r.x, c.x + c.w));
    if (left > r.x) out.push({ x: r.x, y: top, w: left - r.x, h: midH });
    if (right < r.x + r.w) out.push({ x: right, y: top, w: r.x + r.w - right, h: midH });
  }
  return out;
}

// Slivers under this many frame units are antialiasing, not readable content.
const COVER_EPS = 0.75;

function uncoveredParts(node, covers, eps) {
  const e = eps == null ? COVER_EPS : eps;
  let parts = [{ x: node.x, y: node.y, w: node.w, h: node.h }];
  for (const c of covers) {
    const next = [];
    for (const p of parts) for (const q of subtractBox(p, c)) next.push(q);
    parts = next.filter((p) => p.w > e && p.h > e);
    if (!parts.length) break;
  }
  return parts;
}

// Nodes the painted bars are OVER but do not finish. Impossible to detect on a
// raster source (no nodes exist). Coverage is tested against the UNION of every
// painted bar, so two bars that jointly finish a word are not reported.
//
// THE RULE, and it is a choice worth stating. Since growth is bounded to one
// pass, two different things can leave a node partly covered:
//
//   (a) a bar that is over a node it does not contain - a bar typed into the
//       sidebar, shrunk after it was drawn, restored from a URL, or applied to
//       a different file. Nobody grew it, and half a word is readable.
//   (b) a neighbour merely clipped by the growth (or by the 2-unit inflation
//       and the quantise grid) of a bar aimed at something else.
//
// They are geometrically indistinguishable at render time: a bar remembers its
// current rectangle, not the rectangle it was drawn as, so "did the user aim at
// this" cannot be recovered here. The alternative rule - report only nodes the
// ORIGINAL rect was over and the final bar fails to contain - is vacuous, since
// a correct single-pass grow makes that set empty by construction, and a warning
// that can never fire is worse than none.
//
// So both are reported, because to a reader of the output they are the same
// thing: a piece of text is half blacked out and the rest of it is legible. (b)
// is not a leak of INTENDED content, but it is not noise either - in vector mode
// the clipped neighbour is deleted outright, which is content the user did not
// ask to lose. Either way the answer is the same: nudge the bar. The copy in
// template.html says exactly what is computed - items partly covered - and
// claims nothing about intent.
function partialNodes(nodes, covers, eps) {
  const out = [];
  if (!covers.length) return out;
  for (let i = 0; i < nodes.length; i++) {
    const nb = nodes[i];
    if (!nb || !(nb.w > 0) || !(nb.h > 0)) continue;
    if (!covers.some((c) => rectOverlaps(c, nb))) continue;
    const parts = uncoveredParts(nb, covers, eps);
    if (parts.length) out.push({ index: i, parts });
  }
  return out;
}

// Union coverage of the repainted pixels, computed on a 100x100 occupancy grid
// so overlapping bars aren't double-counted. Accurate to about 1%.
function coveragePercent(rects, W, H) {
  if (!rects.length || !(W > 0) || !(H > 0)) return 0;
  const G = 100;
  const grid = new Uint8Array(G * G);
  for (const r of rects) {
    const cx0 = Math.max(0, Math.floor(r.x0 / W * G));
    const cy0 = Math.max(0, Math.floor(r.y0 / H * G));
    const cx1 = Math.min(G, Math.ceil(r.x1 / W * G));
    const cy1 = Math.min(G, Math.ceil(r.y1 / H * G));
    for (let cy = cy0; cy < cy1; cy++) {
      for (let cx = cx0; cx < cx1; cx++) grid[cy * G + cx] = 1;
    }
  }
  let n = 0;
  for (let i = 0; i < grid.length; i++) n += grid[i];
  return Math.min(100, Math.round(n / (G * G) * 100));
}

// ─── the mark itself: ink, corner radius, stamp ─────────────────────────────
// A redaction is an act of authorship, and its look is a trust surface: an
// anonymous black smear reads as a cover-up, a consistent branded mark reads as
// an accountable edit by a known entity. None of that is a security property -
// ANY 100% opaque fill destroys the pixels beneath it equally, and the research
// is explicit that colour is not a hiding criterion. Translucency IS a security
// property, so nothing here can produce a fill below full opacity.
//
// Three styles, not a style editor:
//   solid    square, neutral near-black
//   branded  the loaded brand's own dark tone, corners slightly rounded
//   stamped  branded, plus a short label painted ON TOP of the opaque bar
//
// The label is safe precisely because it sits on pixels that are already gone.
// It is the user's own text, their profile name, or the word REDACTED - never
// anything derived from what was covered.

const NEUTRAL_INK = '#14161a'; // deliberate ink, not a hole punched in the page
const STAMP_FALLBACK = 'REDACTED';
const STAMP_MAX = 24;

// One uniform radius in FRAME units (PDF points on a page, pixels on an image),
// not a fraction of each bar: a per-bar radius would make the inflation below
// grow with the bar, and the whole point is that the extra area is small and
// predictable.
//
// It does have to scale with the FILE, though. 3 units is a slight softening on
// a 612pt page and an invisible sub-pixel on a 3024px phone photo, where the
// Branded and Stamped presets then looked identical to Solid - the user picks a
// rounded mark, is told the corners round, and gets a square bar. So the radius
// is a small fraction of the frame's short side, floored at the old constant and
// capped so it stays a softening rather than a lozenge.
const MARK_RADIUS = 3;
const MARK_RADIUS_MAX = 14;
const MARK_RADIUS_FRAC = 0.006;

const MARK_STYLES = { solid: 1, branded: 1, stamped: 1 };

function markStyleOf(v) {
  const s = v == null ? '' : String(v);
  return Object.prototype.hasOwnProperty.call(MARK_STYLES, s) ? s : 'branded';
}

// A caller-supplied colour as a canonical '#rrggbb', or null. Mirrors
// normaliseInk in the web shell's pdf-redact-core.ts, and refuses for the same
// reason: alpha below full opacity leaves covered ink faintly recoverable, and
// an unreadable canvas fillStyle is a silent no-op that would leave the previous
// fill (white) painting bars that redact nothing.
function normaliseInk(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  const short = /^#([0-9a-f]{3})([0-9a-f])?$/.exec(s);
  if (short) {
    if (short[2] && short[2] !== 'f') return null;
    return '#' + short[1].split('').map((c) => c + c).join('');
  }
  const long = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (long) {
    if (long[2] && long[2] !== 'ff') return null;
    return '#' + long[1];
  }
  return null;
}

// Readable stamp colour for a given ink. sRGB relative luminance, WCAG weights.
function inkContrast(hex) {
  const h = normaliseInk(hex) || NEUTRAL_INK;
  const ch = (i) => {
    const v = parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2);
  return L > 0.4 ? NEUTRAL_INK : '#ffffff';
}

// `W`/`H` are the frame the mark is painted in, in its own units. Omit them (the
// PDF path, whose page space is points and whose pages are all roughly a sheet
// of paper) and the base radius stands.
function markRadiusFor(style, W, H) {
  if (style === 'solid') return 0;
  const short = Math.min(Number(W) || 0, Number(H) || 0);
  if (!(short > 0)) return MARK_RADIUS;
  return Math.max(MARK_RADIUS, Math.min(MARK_RADIUS_MAX, Math.round(short * MARK_RADIUS_FRAC)));
}

// THE ROUNDED-CORNER RULE. A rounded rectangle does not cover the corners of the
// box it is inscribed in, so rounding a bar in place would uncover four slivers
// of exactly what the user marked. So the painted box is INFLATED by the radius
// on every side first: each corner arc's centre then lands precisely on a corner
// of the requested rect, every point of that rect is within `radius` of such a
// centre and inside the enclosing box, and containment follows by construction -
// no sampling, no epsilon. A corner whose sides had to clamp to the frame edge is
// painted SQUARE, because the clamp drags the arc centre inward and it would cut
// back into the rect, which is the one failure this whole shape exists to avoid.
//
// `rect` is an effectiveRect ({x0,y0,x1,y1}); the result is the same shape plus
// four radii, clockwise from the top-left.
function paintedShape(rect, radius, W, H) {
  const rad = Math.max(0, Math.floor(Number(radius) || 0));
  if (!rad) return { x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1, radii: [0, 0, 0, 0] };
  const wantX0 = rect.x0 - rad, wantY0 = rect.y0 - rad;
  const wantX1 = rect.x1 + rad, wantY1 = rect.y1 + rad;
  const x0 = Math.max(0, wantX0), y0 = Math.max(0, wantY0);
  const x1 = Math.min(W, wantX1), y1 = Math.min(H, wantY1);
  const cL = x0 > wantX0, cT = y0 > wantY0, cR = x1 < wantX1, cB = y1 < wantY1;
  // A smaller radius only ever paints MORE, so capping can never break
  // containment; it only stops opposite corners meeting on a hairline bar.
  const cap = Math.max(0, Math.min(rad, Math.floor(Math.min(x1 - x0, y1 - y0) / 2)));
  return {
    x0, y0, x1, y1,
    radii: [
      cL || cT ? 0 : cap,
      cR || cT ? 0 : cap,
      cR || cB ? 0 : cap,
      cL || cB ? 0 : cap,
    ],
  };
}

// Where a stamp sits on a finished bar: centred, at a size the bar can hold.
// Null when the bar is too small - a stamp is decoration on an already-opaque
// mark, so it is dropped rather than squeezed. 0.62em per character is wide
// enough for the sans a canvas or a viewer falls back to.
function stampFit(shape, text, maxSize) {
  const t = String(text || '').trim();
  if (!t) return null;
  const w = shape.x1 - shape.x0, h = shape.y1 - shape.y0;
  const size = Math.floor(Math.min(maxSize, h * 0.5));
  if (size < 7) return null;
  if (t.length * size * 0.62 > w * 0.86) return null;
  return { size, cx: shape.x0 + w / 2, cy: shape.y0 + h / 2 };
}

// ─── brand tone + author name (read through the host, cached per mount) ──────
// A community tool inherits the loaded brand rather than carrying one. The
// brand's own dark text tone is the redaction ink; with no brand loaded (or a
// token that cannot be painted honestly) the neutral near-black stands in, so
// the tool looks the same in a bare shell as it always did.

const INK_TOKENS = ['color.semantic.text', 'color.semantic.primary'];
const INK_BUDGET_MS = 500;

let _inkJob = null;

function inkJobFor(host) {
  if (_inkJob) return _inkJob;
  const job = { promise: null, value: null, done: false };
  job.promise = Promise.resolve()
    .then(() => (host && host.tokens && typeof host.tokens.colors === 'function') ? host.tokens.colors() : [])
    .then((list) => {
      // ColorSwatch.value is always a hex string, so no colour parsing (and no
      // canvas) is needed here - which is what keeps this sandbox-pure and
      // identical headless.
      const arr = Array.isArray(list) ? list : [];
      for (const path of INK_TOKENS) {
        for (const sw of arr) {
          if (!sw || sw.path !== path) continue;
          const hex = normaliseInk(sw.value);
          if (hex) { job.value = hex; return; }
        }
      }
    })
    .catch(() => { /* no tokens here: the neutral ink stands in */ })
    .then(() => { job.done = true; });
  _inkJob = job;
  return job;
}

// `wait` false uses the short budget (a live paint must not stall); export
// awaits properly, so preview and output agree on the same resolved value.
async function resolveInk(host, style, wait) {
  if (style === 'solid') return NEUTRAL_INK;
  const job = inkJobFor(host);
  if (!job.done) {
    if (wait) { try { await job.promise; } catch (e) { /* handled in the job */ } }
    else await withBudget(job.promise, INK_BUDGET_MS);
  }
  return job.value || NEUTRAL_INK;
}

let _profJob = null;

function profileJobFor(host) {
  if (_profJob) return _profJob;
  const job = { promise: null, name: '', useDetails: false, done: false };
  job.promise = Promise.resolve()
    .then(() => (host && host.profile && typeof host.profile.get === 'function') ? host.profile.get() : null)
    .then((p) => {
      const o = p && typeof p === 'object' ? p : {};
      job.name = [o.firstname, o.lastname].map((s) => (s == null ? '' : String(s).trim()))
        .filter(Boolean).join(' ');
      job.useDetails = o.useDetails === true;
    })
    .catch(() => { /* no profile: the stamp falls back to REDACTED */ })
    .then(() => { job.done = true; });
  _profJob = job;
  return job;
}

async function resolveProfile(host, wait) {
  const job = profileJobFor(host);
  if (!job.done) {
    if (wait) { try { await job.promise; } catch (e) { /* handled in the job */ } }
    else await withBudget(job.promise, INK_BUDGET_MS);
  }
  return { name: job.name, useDetails: job.useDetails };
}

// The stamp's text: what the user typed, else their profile name, else the word.
// Never anything read out of the document.
function stampTextFor(typed, profileName) {
  const t = String(typed == null ? '' : typed).trim().slice(0, STAMP_MAX);
  if (t) return t;
  const n = String(profileName || '').trim().slice(0, STAMP_MAX);
  return n || STAMP_FALLBACK;
}

// Everything the paint paths need, resolved once. `wait` is true on the export
// path so the burned mark is never the fallback just because tokens were slow.
//
// The two lookups run CONCURRENTLY, and that is load-bearing on the live paint:
// each carries its own INK_BUDGET_MS, and awaiting them one after the other sums
// the budgets. The PDF branch of patch() then spends up to PAGES_BUDGET_MS on
// top, and the whole pass has to fit the runtime's 2000ms onInput box - an
// overrun DISCARDS the patch, so the drop would simply look dead.
async function resolveMark(host, inputs, wait) {
  const style = markStyleOf(inputs.style);
  const [ink, prof] = await Promise.all([
    resolveInk(host, style, wait),
    resolveProfile(host, wait),
  ]);
  return {
    style,
    ink,
    radius: markRadiusFor(style),
    label: style === 'stamped' ? stampTextFor(inputs.stampLabel, prof.name) : '',
    labelInk: inkContrast(ink),
    authorName: prof.name,
    useDetails: prof.useDetails,
  };
}

// ─── preset bar heights (the canvas rail's Line / Heading / Block buttons) ───
// Fractions of the frame height, so a preset reads the same on an A4 page and a
// phone screenshot. The template script multiplies the fraction by the frame's
// own coordinate space (PDF points or natural pixels) - the constants live HERE,
// once, and ship to the canvas as JSON so the script never re-declares them.

const PRESET_FRACS = { line: 0.02, heading: 0.038, block: 0.14 };
const PRESET_MIN = 6; // floor in frame units, so a tiny image still gets a visible bar

function presetBarHeight(preset, frameH) {
  if (!Object.prototype.hasOwnProperty.call(PRESET_FRACS, preset)) return null;
  if (!(frameH > 0)) return null;
  return Math.max(PRESET_MIN, Math.round(frameH * PRESET_FRACS[preset]));
}

// ─── advisories (transient toasts, not prose walls) ─────────────────────────
// Guidance arrives as the user edits, one short sentence at a time. Each key
// fires at most once per file (the seen set); at most one toast per patch. The
// picker is pure - it never mutates `seen`, the caller marks a key seen only
// when it actually emits the toast.

const THIN_BAR_PT = 8;   // a bar under this height in PDF points can hint at what it hides
const THIN_BAR_PX = 11;  // the same threshold for pixel-space frames (8pt at 96 dpi)

function thinBarLimit(isPdf) {
  return isPdf ? THIN_BAR_PT : THIN_BAR_PX;
}

function joinPages(list) {
  return list.join(', ').replace(/, ([^,]*)$/, ' and $1');
}

// state: { pagesFailed: number[], pagesTruncated, barsEdited, barCount,
//          isImage, vectorMode, hasThinBar }. Returns { key, text } or null.
//
// The first-bar advisory is the ONLY guidance that arrives at the moment of the
// edit, so it must not overstate what the current export mode does. Vector SVG
// export now DELETES every element a bar touches (cleanSvgTokens takes the node
// addresses the browser measured), so "destroyed" is true there too - but the
// output is still SVG, a readable text format, and that residue is stated
// rather than left for the user to discover.
function advisoryFor(state, seen) {
  const cands = [];
  const failed = Array.isArray(state.pagesFailed) ? state.pagesFailed : [];
  if (failed.length) {
    const list = joinPages(failed);
    cands.push({
      key: 'pages-failed',
      text: failed.length > 1
        ? `Pages ${list} could not be rendered, so their previews are missing. The export refuses to ship a page that fails to render.`
        : `Page ${list} could not be rendered, so its preview is missing. The export refuses to ship a page that fails to render.`,
    });
  }
  if (state.pagesTruncated) {
    cands.push({ key: 'pages-truncated', text: 'Not every page could be previewed. Only pages with a preview can be marked here.' });
  }
  if (state.barsEdited && state.barCount > 0) {
    cands.push({
      key: 'first-bar',
      text: state.vectorMode
        ? 'Every element a bar touches is deleted from the file, then painted over. The output is still SVG, a readable text format.'
        : 'Covered content is destroyed when the file is rebuilt, not hidden.',
    });
    if (state.isImage) {
      cands.push({ key: 'image-mark', text: 'Whole-image watermarks survive partial cover. This tool removes what you mark, it does not launder provenance.' });
    }
    if (state.hasThinBar) {
      cands.push({ key: 'thin-bar', text: 'A very thin bar can hint at what it hides.' });
    }
  }
  for (const c of cands) {
    if (!seen.has(c.key)) return c;
  }
  return null;
}

// Seen keys per file identity - a new file starts a clean advisory slate.
let _advice = { key: '', seen: new Set() };

function adviceSeenFor(fileKey) {
  if (_advice.key !== fileKey) _advice = { key: fileKey, seen: new Set() };
  return _advice.seen;
}

// ─── raster analysis ─────────────────────────────────────────────────────────

function gpsDetail(gps) {
  return gps ? `${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}` : 'present';
}

function exifFindings(exif, findings) {
  if (!exif) return;
  if (exif.hasGps) findings.push({ label: 'GPS location', detail: gpsDetail(exif.gps), tone: 'warn' });
  if (exif.make || exif.model) findings.push({ label: 'Camera / device', detail: [exif.make, exif.model].filter(Boolean).join(' '), tone: 'warn' });
  if (exif.serial) findings.push({ label: 'Camera serial number', detail: exif.serial, tone: 'warn' });
  if (exif.artist) findings.push({ label: 'Author', detail: exif.artist, tone: 'warn' });
  if (exif.dateTimeOriginal || exif.dateTime) findings.push({ label: 'Date taken', detail: exif.dateTimeOriginal || exif.dateTime, tone: '' });
  if (exif.software) findings.push({ label: 'Software', detail: exif.software, tone: '' });
  if (exif.hasThumbnail) findings.push({ label: 'Embedded thumbnail', detail: 'a small preview inside the EXIF block, it may show the un-cropped original', tone: 'warn' });
}

function trailingFinding(bytes, kind, findings) {
  const extra = trailingBytes(bytes, kind);
  if (extra > 0) {
    findings.push({
      label: 'Data after end of image',
      detail: `${fmtBytes(extra)} past the ${kind} terminator, it may include an earlier un-cropped or un-redacted version`,
      tone: 'warn',
    });
  }
}

function c2paFinding(bytes, kind, findings) {
  if (hasC2paBytes(bytes, kind)) {
    findings.push({
      label: 'Content Credentials (C2PA)',
      detail: 'the manifest can carry a pixel-accurate thumbnail of the un-redacted original',
      tone: 'warn',
    });
  }
}

function analyzeJpeg(bytes) {
  const findings = [];
  let exif = null, xmp = false, icc = false, iptc = false, comment = false, mpf = false;
  for (const s of scanJpeg(bytes) || []) {
    if (s.dataStart == null) continue;
    if (s.marker === 0xE1) {
      if (matchAscii(bytes, s.dataStart, 'Exif\0\0')) exif = readTiff(bytes, s.dataStart + 6, s.dataLen - 6);
      else if (matchAscii(bytes, s.dataStart, 'http://ns.adobe.com/xap/')) xmp = true;
    } else if (s.marker === 0xE2) {
      if (matchAscii(bytes, s.dataStart, 'ICC_PROFILE\0')) icc = true;
      else if (matchAscii(bytes, s.dataStart, 'MPF\0')) mpf = true;
    } else if (s.marker === 0xED) iptc = true;
    else if (s.marker === 0xFE) comment = true;
  }
  exifFindings(exif, findings);
  if (exif) findings.push({ label: 'EXIF block', detail: 'camera and shooting data', tone: '' });
  if (xmp) findings.push({ label: 'XMP metadata', detail: 'editing and rights data', tone: '' });
  if (icc) findings.push({ label: 'ICC colour profile', detail: 'embedded profile', tone: '' });
  if (iptc) findings.push({ label: 'IPTC / Photoshop', detail: 'caption and author data (8BIM)', tone: '' });
  if (comment) findings.push({ label: 'Comment', detail: 'embedded text', tone: '' });
  if (mpf) findings.push({ label: 'Extra pictures (MPF)', detail: 'later pictures may show unredacted content, the export keeps the visible image only', tone: 'warn' });
  c2paFinding(bytes, 'JPEG', findings);
  trailingFinding(bytes, 'JPEG', findings);
  return findings;
}

function analyzePng(bytes) {
  const findings = [];
  let exif = null, texts = 0, time = false, icc = false, animated = false;
  for (const c of scanPng(bytes)) {
    if (c.type === 'eXIf') exif = readTiff(bytes, c.dataStart, c.dataLen);
    else if (c.type === 'tEXt' || c.type === 'zTXt' || c.type === 'iTXt') texts++;
    else if (c.type === 'tIME') time = true;
    else if (c.type === 'iCCP') icc = true;
    else if (c.type === 'acTL') animated = true;
  }
  exifFindings(exif, findings);
  if (exif) findings.push({ label: 'EXIF block', detail: 'embedded camera data', tone: '' });
  if (texts) findings.push({ label: 'Text chunks', detail: `${texts} text/metadata chunk${texts > 1 ? 's' : ''}`, tone: '' });
  if (icc) findings.push({ label: 'ICC colour profile', detail: 'embedded profile', tone: '' });
  if (time) findings.push({ label: 'Timestamp', detail: 'last-modified time', tone: '' });
  if (animated) findings.push({ label: 'Animated PNG', detail: 'later frames may show unredacted content, the export keeps the visible frame only', tone: 'warn' });
  c2paFinding(bytes, 'PNG', findings);
  trailingFinding(bytes, 'PNG', findings);
  return findings;
}

function analyzeWebp(bytes) {
  const findings = [];
  const scan = scanWebp(bytes);
  let exif = null, xmp = false, icc = false, animated = false;
  for (const c of (scan ? scan.chunks : [])) {
    if (c.fourcc === 'EXIF') exif = readTiff(bytes, c.dataStart, c.dataLen) || readTiff(bytes, c.dataStart + 6, c.dataLen - 6);
    else if (c.fourcc === 'XMP ') xmp = true;
    else if (c.fourcc === 'ICCP') icc = true;
    else if (c.fourcc === 'ANIM' || c.fourcc === 'ANMF') animated = true;
    else if (c.fourcc === 'VP8X' && c.dataLen >= 1 && (bytes[c.dataStart] & 0x02)) animated = true;
  }
  exifFindings(exif, findings);
  if (exif) findings.push({ label: 'EXIF block', detail: 'embedded camera data', tone: '' });
  if (xmp) findings.push({ label: 'XMP metadata', detail: 'editing and rights data', tone: '' });
  if (icc) findings.push({ label: 'ICC colour profile', detail: 'embedded profile', tone: '' });
  if (animated) findings.push({ label: 'Animated WebP', detail: 'later frames may show unredacted content, the export keeps the visible frame only', tone: 'warn' });
  c2paFinding(bytes, 'WebP', findings);
  trailingFinding(bytes, 'WebP', findings);
  return findings;
}

// ─── PDF analysis (structure via host.pdf.analyze, byte scans in-sandbox) ────

// One in-flight (or settled) analyze job keyed on file identity, so re-renders
// during a slow analyze share a single run (compress-pdf's _job pattern).
let _pdfJob = { key: '', promise: null, result: null, error: false };
// Both waits happen inside ONE onInput pass, whose runtime budget is 2000ms
// (HOOK_BUDGET_MS - an overrun DISCARDS the whole patch, so the drop would look
// dead). They run concurrently in patch(), so the wall-time worst case is
// max(PAGES, PREVIEW) plus the synchronous byte scans - keep that under ~1.5s.
const PREVIEW_BUDGET_MS = 1200;
const PAGES_BUDGET_MS = 1400;

// ─── PDF page previews (host.pdf.pages, feature-detected) ────────────────────
// One render job per file identity. The job object carries its own settled
// state (result/error) so a later re-render can read it synchronously - the
// template poll re-commits the bars array until the job settles, and the
// settled result must be pick-up-able without another await race.
//
// Pages are INLINED, not handed to an <img src="blob:…">. An SVG inside an
// <img> is a closed document, so no node inside it can be measured and neither
// snap-to-cover nor the partial-coverage warning could exist. Inlining also
// retires the whole object-URL lifecycle that used to live here (create, track,
// revoke on a delay): there is nothing to revoke, and a replaced file simply
// drops the markup with the rest of the extras. prepareInlineSvg runs ONCE per
// job, not per paint.

let _pagesJob = { key: '', promise: null, result: null, error: null };

// Called whenever the loaded file is no longer a PDF (replaced with an image,
// cleared, unsupported), so a stale job never answers for the new file.
function resetPagesJob() {
  if (_pagesJob.key || _pagesJob.promise) {
    _pagesJob = { key: '', promise: null, result: null, error: null };
  }
}

function pdfPagesJobFor(host, f, key) {
  if (_pagesJob.key === key && _pagesJob.promise) return _pagesJob;
  const job = { key, promise: null, result: null, error: null };
  job.promise = Promise.resolve()
    .then(() => host.pdf.pages(f.bytes))
    .then((res) => {
      const pages = res && Array.isArray(res.pages) ? res.pages : [];
      job.result = {
        pages: pages.map((p) => ({
          svg: prepareInlineSvg(p.svg, { className: 'rd-img', natW: p.widthPt, natH: p.heightPt }),
          page: p.page,
          w: p.widthPt,
          h: p.heightPt,
        })),
        truncated: Boolean(res && res.truncated),
        // 1-based pages the shell could not render (v1.85 additive field) -
        // surfaced as a note so a missing page never passes silently.
        failed: res && Array.isArray(res.failed) ? res.failed.filter((n) => isFinite(n)) : [],
      };
    })
    .catch((e) => {
      job.error = (e && e.message) ? e.message : 'Page rendering failed.';
    });
  _pagesJob = job;
  return job;
}

// Analyze job: same settled-state shape as the pages job. A rejection is a
// terminal error state, NOT a reset - resetting retried the failing analyze on
// every onInput (including every poll tick) while the UI claimed "still
// reading" forever. The error sticks per file identity and the template says
// plainly that the structural checks did not run.
function pdfJobFor(host, f, key) {
  if (_pdfJob.key === key && _pdfJob.promise) return _pdfJob;
  const job = { key, promise: null, result: null, error: false };
  job.promise = Promise.resolve()
    .then(() => host.pdf.analyze(f.bytes))
    .then((res) => { job.result = res || { findings: [] }; })
    .catch(() => { job.error = true; });
  _pdfJob = job;
  return job;
}

function withBudget(promise, ms) {
  return new Promise((resolve) => {
    let settled = false;
    const t = setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, ms);
    promise.then(
      (v) => { if (!settled) { settled = true; clearTimeout(t); resolve(v); } },
      () => { if (!settled) { settled = true; clearTimeout(t); resolve(null); } }
    );
  });
}

function pdfByteFindings(bytes) {
  const findings = [];
  const eofs = countAscii(bytes, '%%EOF');
  if (eofs > 1) {
    findings.push({
      label: 'Earlier document versions',
      detail: `${eofs} end-of-file markers, incremental saves can keep earlier content recoverable`,
      tone: 'warn',
    });
  }
  c2paFinding(bytes, 'PDF', findings);
  return findings;
}

// ─── personal-data classifiers (shared) ──────────────────────────────────────
// === lolly:shared pii - generated from community/_shared/pii.js; edit there and run npm run sync:shared ===
// Plain regular expressions over ONE line of text. Everything here is a GUESS
// offered to a person, never a decision: the caller shows what was found and
// the person confirms it. Nothing in this region acts on its own.
//
// Matchers run in order and CLAIM the characters they match, so a later, looser
// pattern cannot re-read a span a stricter one already explained. Two entries
// claim without reporting: a URL and a version string are digit runs that would
// otherwise read as a phone number.
//
// `maybe: true` marks a pattern loose enough to be wrong on ordinary text (a
// capitalised word pair, a five-digit number). The caller has to present those
// as questions rather than findings.
//
// Deliberately NOT here: a national identity number, a passport number or a
// medical code. Their formats differ per country and a wrong guess about one of
// those is a worse failure than missing it, so they stay a manual mark.

function piiDigits(s) {
  return String(s).replace(/[^0-9]/g, '');
}

// The check digit every payment card carries. Cheap, and it turns "a long run
// of digits" into something specific enough to name: an order number, a serial
// or a phone number written without spaces almost never passes.
function luhnOk(digits) {
  if (digits.length < 13 || digits.length > 19) return false;
  var sum = 0;
  var alt = false;
  for (var i = digits.length - 1; i >= 0; i--) {
    var d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// Words that start a capitalised pair without a person being anywhere near it.
// Short on purpose: the name matcher is already flagged `maybe`, so the list
// only has to catch the pairs common enough to be noise on every document.
var PII_STOP = {
  january: 1, february: 1, march: 1, april: 1, may: 1, june: 1, july: 1,
  august: 1, september: 1, october: 1, november: 1, december: 1,
  monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1,
  sunday: 1, the: 1, this: 1, that: 1, dear: 1, from: 1, sent: 1, page: 1,
  total: 1, invoice: 1, receipt: 1, account: 1, date: 1, name: 1, address: 1,
  phone: 1, email: 1, subject: 1, note: 1, notes: 1, terms: 1, please: 1,
  thank: 1, thanks: 1, best: 1, kind: 1, yours: 1, new: 1, united: 1,
  north: 1, south: 1, east: 1, west: 1, all: 1, rights: 1, reserved: 1,
  copyright: 1, content: 1, credentials: 1, general: 1, public: 1, private: 1,
};

var PII_MONTH = '(?:January|February|March|April|September|October|November|December|'
  + 'Jan|Feb|Mar|Apr|May|June|Jun|July|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\\.?';

function piiNameOk(m) {
  var parts = String(m).split(/\s+/);
  for (var i = 0; i < parts.length; i++) {
    var w = parts[i].replace(/[^A-Za-z]/g, '').toLowerCase();
    if (w && Object.prototype.hasOwnProperty.call(PII_STOP, w)) return false;
  }
  return true;
}

function piiPhoneOk(m) {
  var d = piiDigits(m);
  return d.length >= 7 && d.length <= 15;
}

var PII_MATCHERS = [
  // Claim-only, kind '': a URL and a version string are digit runs with
  // separators, which is exactly what the phone matchers look for.
  { kind: '', re: /\bhttps?:\/\/\S+/g },
  {
    kind: '', re: /\bv?\d+\.\d+(?:\.\d+)+/g,
    // 12.03.1980 is a version string by shape and a date of birth in most of
    // Europe. Three dotted numbers whose last part is a 2-to-4 digit year are
    // left unclaimed so the date matcher below reports them; a real version
    // (v1.77.0, 1.149.0, 10.15.7.2024) does not fit that shape and is claimed.
    test: function (m) { return !/^\d{1,4}\.\d{1,2}\.\d{2,4}$/.test(m); },
  },

  { kind: 'email', label: 'Email address', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },

  {
    kind: 'iban', label: 'Bank account (IBAN)',
    re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,3})?\b/g,
    test: function (m) { var n = m.replace(/\s/g, '').length; return n >= 15 && n <= 34; },
  },
  {
    kind: 'card', label: 'Card number',
    re: /\b\d[\d\s-]{11,21}\d\b/g,
    test: function (m) { return luhnOk(piiDigits(m)); },
  },

  // Dates before phones: 12.03.1980 is seven digits with separators.
  { kind: 'date', label: 'Date', maybe: true, re: /\b\d{1,4}[/.-]\d{1,2}[/.-]\d{2,4}\b/g },
  {
    kind: 'date', label: 'Date', maybe: true,
    re: new RegExp('\\b\\d{1,2}(?:st|nd|rd|th)?\\s+' + PII_MONTH + '\\s+(?:19|20)\\d{2}\\b', 'g'),
  },
  {
    kind: 'date', label: 'Date', maybe: true,
    re: new RegExp('\\b' + PII_MONTH + '\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+(?:19|20)\\d{2}\\b', 'g'),
  },

  {
    kind: 'phone', label: 'Phone number',
    re: /\+\d[\d\s().-]{5,18}\d/g,
    test: piiPhoneOk,
  },
  {
    kind: 'phone', label: 'Phone number', maybe: true,
    re: /\(?\b0?\d[\d\s().-]{5,18}\d\b/g,
    test: piiPhoneOk,
  },

  {
    kind: 'address', label: 'Street address',
    re: /\b\d{1,5}[A-Za-z]?\s+(?:[A-Z][A-Za-z.'-]+\s+){1,4}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd|Highway|Hwy|Way|Close|Court|Ct|Place|Pl|Terrace|Parade|Crescent|Square|Sq|Strasse|Straße)\b\.?/g,
  },
  { kind: 'postcode', label: 'Postcode', re: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g },
  { kind: 'postcode', label: 'Postcode', maybe: true, re: /\b\d{5}(?:-\d{4})?\b/g },

  {
    kind: 'name', label: 'Name', maybe: true,
    re: /\b[A-Z][a-z]{1,15}\s+(?:[A-Z][a-z]?\.?\s+)?[A-Z][a-z]{1,15}\b/g,
    test: piiNameOk,
  },
];

// Every classified span in `text`, in reading order:
// [{ kind, label, text, maybe, start, end }]. Claim-only matches report
// nothing; a span already claimed is skipped rather than re-read.
function piiFindings(text) {
  var s = String(text == null ? '' : text);
  if (!s) return [];
  var claimed = [];
  var out = [];
  function free(a, b) {
    for (var c = 0; c < claimed.length; c++) {
      if (a < claimed[c][1] && claimed[c][0] < b) return false;
    }
    return true;
  }
  for (var i = 0; i < PII_MATCHERS.length; i++) {
    var spec = PII_MATCHERS[i];
    var re = spec.re;
    re.lastIndex = 0;
    var m;
    while ((m = re.exec(s))) {
      var hit = m[0];
      if (!hit) { re.lastIndex++; continue; }
      var a = m.index;
      var b = a + hit.length;
      if (!free(a, b)) continue;
      if (spec.test && !spec.test(hit)) continue;
      claimed.push([a, b]);
      if (!spec.kind) continue;
      out.push({
        kind: spec.kind, label: spec.label, text: hit,
        maybe: spec.maybe === true, start: a, end: b,
      });
    }
  }
  out.sort(function (x, y) { return x.start - y.start; });
  return out;
}
// === /lolly:shared pii ===

// ─── OCR suggestions ─────────────────────────────────────────────────────────
//
// THE M7 PATTERN (plans/147), written out here because redact is the first tool
// to use it and annotate and url-shot are meant to copy it verbatim:
//
//   1. The hook feature-detects `host.ocr`. Absent (the CLI, any shell without
//      the WASM reader) means the affordance is simply not published, so the
//      headless render path is byte-identical to what it was before.
//   2. A canvas control asks for a run by writing a nonce into a data-only
//      input. The hook never starts a read on its own: reading is the user's
//      request, and on a first run it may need a staged model. The nonce
//      outlives the file that produced it (it is an input value, and it goes
//      into a shared link), so a request is BOUND to the file it was made on -
//      see ocrRequestOwns. Copy that part too; without it the second picture
//      someone drops gets read without them asking.
//   3. The read happens in a JOB keyed to the file plus that nonce, exactly
//      like the PDF page previews above - the patch publishes `pending` and the
//      canvas polls, rather than the hook awaiting past its 2000ms box.
//   4. The result is turned into PROPOSED regions in `extras`. A proposal is
//      never applied: the canvas draws each one as an outline the person
//      accepts or dismisses, and accepting writes an ordinary bar through the
//      ordinary commit path, so undo, URL mode and save all behave as usual.
//
// Two limits, stated rather than hidden. A hook cannot reach the shell's
// job queue (lib/jobs.ts), so a long read shows a busy state on the canvas
// instead of riding the global job toast; cancel is a real AbortSignal, which
// is what makes that acceptable. And the reader produces LINE boxes, not word
// boxes, so a proposed region is the whole line a match sits on - over-
// inclusive, which is the safe direction for a redaction and the same direction
// the vector deletion policy already errs in.
//
// Reading text embeds nothing and signs nothing: `host.ocr` produces no pixels,
// no asset and no provenance.

// Longest edge handed to the reader. Text on a document scan is legible well
// below the sensor's own resolution, and a 6000px photo is mostly a memory
// bill; boxes are scaled back to source pixels, which is the space bars live in
// for a raster frame.
const OCR_MAX_EDGE = 2000;
// Long enough to pick up a warm, already-staged read inside the same pass on a
// small image, short enough to leave the 2000ms onInput box alone when it is
// not. Anything slower publishes `ocrPending` and the canvas polls.
const OCR_BUDGET_MS = 400;

let _ocrJob = { key: '', promise: null, result: null, error: '', abort: null };

function cancelOcrJob() {
  if (_ocrJob.abort) { try { _ocrJob.abort.abort(); } catch (e) { /* already settled */ } }
  _ocrJob = { key: '', promise: null, result: null, error: '', abort: null };
}

// Line boxes from a read, mapped into the frame's own pixel space and paired
// with what made each line interesting. Pure, so the mapping is testable
// without a reader: `scale` undoes the working-size downscale, W/H clamp to the
// source frame.
//
// ONE region per line, not one per match: every match on a line shares that
// line's box, so a second proposal for the same rectangle would only be a
// second thing to click. The kinds are collected instead.
function suggestionsFrom(res, scale, W, H) {
  const lines = res && Array.isArray(res.lines) ? res.lines : [];
  const k = isFinite(scale) && scale > 0 ? scale : 1;
  const out = [];
  for (const ln of lines) {
    if (!ln || !ln.box) continue;
    const hits = piiFindings(ln.text);
    if (!hits.length) continue;
    const x = Math.max(0, ln.box.x * k);
    const y = Math.max(0, ln.box.y * k);
    const w = Math.min(W - x, ln.box.w * k);
    const h = Math.min(H - y, ln.box.h * k);
    if (!(w > 0) || !(h > 0)) continue;
    const kinds = [];
    const texts = [];
    let maybe = true;
    for (const hit of hits) {
      if (kinds.indexOf(hit.kind) === -1) kinds.push(hit.kind);
      if (texts.indexOf(hit.text) === -1) texts.push(hit.text);
      if (!hit.maybe) maybe = false;
    }
    // The chip names ONE of the hits, and it has to be the one that earns the
    // confidence the chip shows. `maybe` is false as soon as any hit is
    // definite, so heading the region with whatever came first in reading order
    // stated a guess as a fact: "Jane Doe jane@x.com" read as a flat "Name"
    // when the email is the definite half. Head with the first definite hit
    // where there is one, otherwise with the first guess.
    const lead = hits.find((hit) => !hit.maybe) || hits[0];
    out.push({
      page: 1,
      x: Math.round(x), y: Math.round(y),
      w: Math.round(w), h: Math.round(h),
      kind: lead.kind,
      kinds,
      label: lead.label,
      maybe,
      text: texts.join(', '),
      confidence: Math.round((Number(ln.confidence) || 0) * 100) / 100,
    });
  }
  return out;
}

// Decode, downscale to a working size the device will accept, read, classify.
// Rejects with a sentence the canvas can show as-is.
async function readSuggestions(host, f, kind, signal) {
  if (!host || !host.ocr || typeof host.ocr.run !== 'function') {
    throw new Error('Reading the text in a picture is not available in this app.');
  }
  if (!canRaster()) throw new Error(HEADLESS_MSG);
  const img = await decodeImage(f.bytes, OUT_MIME[kind] || f.mime || 'image/png');
  const W = img.width || img.naturalWidth;
  const H = img.height || img.naturalHeight;
  if (!(W > 0) || !(H > 0)) throw new Error('That file could not be decoded as an image.');

  let maxEdge = OCR_MAX_EDGE;
  if (typeof host.ocr.canRun === 'function') {
    const fit = await host.ocr.canRun({ width: W, height: H });
    if (fit && fit.ok === false) {
      if (fit.suggestedMaxEdge > 0) maxEdge = Math.min(maxEdge, fit.suggestedMaxEdge);
      else throw new Error(fit.message || 'This picture is too large for this device to read.');
    }
  }
  const k = Math.min(1, maxEdge / Math.max(W, H));
  const rw = Math.max(1, Math.round(W * k));
  const rh = Math.max(1, Math.round(H * k));
  const canvas = document.createElement('canvas');
  canvas.width = rw;
  canvas.height = rh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(HEADLESS_MSG);
  ctx.drawImage(img, 0, 0, rw, rh);
  const frame = { width: rw, height: rh, data: ctx.getImageData(0, 0, rw, rh).data };
  const res = await host.ocr.run(frame, { signal });
  return suggestionsFrom(res, rw > 0 ? W / rw : 1, W, H);
}

// Which file a request nonce was made on. A fresh nonce claims whatever file is
// loaded when it first arrives; the same nonce seen later against a DIFFERENT
// file is a leftover, not a request. Returns true when this request owns this
// file, and is the one place that decides a read may start.
let _ocrReq = { req: '', file: '' };

function ocrRequestOwns(req, fileKey) {
  if (_ocrReq.req !== req) _ocrReq = { req, file: fileKey };
  return _ocrReq.file === fileKey;
}

// One job per (file, request nonce), settled state readable synchronously - the
// same shape the analyze and pages jobs use, for the same reason: the canvas
// poll has to be able to pick up a finished run without another await race.
function ocrJobFor(host, f, key, kind) {
  if (_ocrJob.key === key && _ocrJob.promise) return _ocrJob;
  cancelOcrJob();
  const job = { key, promise: null, result: null, error: '', abort: null };
  if (typeof AbortController === 'function') job.abort = new AbortController();
  job.promise = Promise.resolve()
    .then(() => readSuggestions(host, f, kind, job.abort ? job.abort.signal : undefined))
    .then((list) => { job.result = list; })
    .catch((e) => { job.error = (e && e.message) ? String(e.message) : 'The text in this picture could not be read.'; });
  _ocrJob = job;
  return job;
}

// ─── lifecycle: analysis + live mark feedback ────────────────────────────────

async function patch(ctx) {
  const { model, host } = ctx;
  // The input id that triggered this pass ('' for onInit) - bar advisories only
  // fire on a real bars edit, never on hydration of a URL-restored session.
  const trigger = ctx.id || '';
  const inputs = inputsFrom(model);
  const f = inputs.source;
  // The mark: brand ink, corner radius, stamp text. Budgeted here (this pass has
  // 2000ms and the PDF branch already spends most of it) and awaited properly on
  // the export path, so the preview and the burned output agree.
  const mark = await resolveMark(host, inputs, false);
  // NOTE: exactly ONE key returned here matches a declared input id, and it is
  // deliberate: `fileKind` carries the sniffed format back into the model so the
  // format-only toggles (svgVector, resign) can hide themselves via showIf for a
  // file they do not apply to. showIf can only compare input VALUES, and the
  // file's type is not one - so the hook has to publish it. Every other key here
  // must NOT match an input id (source, bars, quantise, grayscale, svgVector,
  // resign, style, stampLabel, ocr), or it would silently overwrite what the
  // user set - `ocr` especially, since that one is a request the canvas made
  // and this pass is the answer to it.
  const blank = {
    fileKind: '',
    hasFile: false, supported: false, pdfUnavailable: false, pdfRedactUnavailable: false,
    fileName: '', fileSize: '', kind: '',
    isRaster: false, isSvg: false, isPdfKind: false, vectorMode: false,
    previewUrl: '', barsJson: '[]',
    // Inline SVG source preview (empty → the raster <img> path is used instead).
    inlineSvg: '', hasInlineSvg: false, svgW: 0, svgH: 0,
    // Geometry constants the canvas mirror needs, from ONE source of truth.
    geomJson: JSON.stringify({ inflate: INFLATE_PX, gridPx: QUANT_GRID, gridPt: QUANT_GRID_PT, quantise: true, radius: 0, dpi: REDACT_DPI }),
    // How the mark looks, for the canvas - one JSON blob so the drawing surface
    // paints exactly the shape and colour the export burns.
    markJson: JSON.stringify({ ink: NEUTRAL_INK, labelInk: '#ffffff', label: '', radius: 0, style: 'solid' }),
    barInk: NEUTRAL_INK, markStyle: 'solid', stampText: '',
    authorName: '', authorKnown: false,
    pageCount: 0, hasManyPages: false,
    findings: [], foundSummary: '', nothingFound: false, analysisPending: false, analysisFailed: false,
    barCount: 0, barPlural: false, hasBars: false, staleBars: 0, staleNote: '',
    coveragePct: 0, hasCoverage: false,
    coverageText: '', coverageHigh: false,
    pageBars: [], hasPageBars: false, resignUnavailable: false,
    pdfPages: [], hasPdfPages: false, pagesPending: false, pagesError: '', pagesTruncated: false,
    toastKey: '', toastText: '',
    // OCR suggestions (M7). `ocrAvailable` publishes the canvas affordance and
    // is false wherever the reader is (a shell without host.ocr, a PDF, an
    // SVG), so those paths render exactly as they did before. NOTE the naming:
    // the request channel is the `ocr` INPUT, and nothing here may be called
    // `ocr` or the patch would overwrite the request it is answering.
    ocrAvailable: false, ocrPending: false, ocrError: '', ocrRead: false,
    suggestions: [], suggestJson: '[]', suggestCount: 0, suggestPlural: false, hasSuggestions: false,
    // Can this frame's elements be measured at all? Snap-to-cover, the partial
    // -coverage warning and vector deletion all need real painted bounds, which
    // exist only on an INLINE page or SVG. A raster source has none, and neither
    // does an SVG that fell back to the <img> preview - so the stage hint must
    // not promise a bar "can never clip a word in half" for either of them.
    canMeasure: false,
    // The drawing surface still owes the bars work - page previews are rendering,
    // or a bar arrived unmeasured (a share link, the sidebar editor, `lolly
    // redact --bars=`) and the re-snap pass has not committed yet. Automation
    // drives this tool by clicking [data-export-file] as soon as it is enabled,
    // which for a headless caller landed before snap-to-cover had run at all.
    exportWait: false,
    presetsJson: JSON.stringify(PRESET_FRACS),
    downloadLabel: 'Download redacted copy',
  };
  if (!f || !f.bytes) { resetPagesJob(); return blank; }

  const base = { ...blank, hasFile: true, fileName: f.name, fileSize: fmtBytes(f.size) };
  const info = classify(f.bytes);
  base.kind = info.kind;
  base.fileKind = info.kind;
  base.markStyle = mark.style;
  base.barInk = mark.ink;
  base.stampText = mark.label;
  base.authorName = mark.authorName;
  // Named on the credential only when the profile's "Use my details" is on -
  // the tool says which of the two is true rather than implying a name it
  // cannot actually record.
  base.authorKnown = Boolean(mark.authorName) && mark.useDetails;
  base.markJson = JSON.stringify({
    ink: mark.ink, labelInk: mark.labelInk, label: mark.label,
    radius: mark.radius, style: mark.style,
  });
  if (info.kind !== 'PDF') resetPagesJob(); // a non-PDF replacing a PDF drops the page markup
  if (info.kind === 'file') return base; // supported stays false → guidance

  const bars = parseBars(inputs.bars);
  const quantise = inputs.quantise !== false;
  base.geomJson = JSON.stringify({
    inflate: INFLATE_PX, gridPx: QUANT_GRID, gridPt: QUANT_GRID_PT, quantise,
    radius: mark.radius, dpi: REDACT_DPI,
  });
  base.barCount = bars.length;
  base.barPlural = bars.length > 1;
  base.hasBars = bars.length > 0;
  // The canvas gets EVERY row (coerced, not filtered): its commits echo the
  // whole array back, so an incomplete sidebar row must round-trip intact.
  base.barsJson = JSON.stringify(barRows(inputs.bars));

  if (info.kind === 'PDF') {
    base.isPdfKind = true;
    if (!host || !host.pdf || typeof host.pdf.analyze !== 'function') {
      return { ...base, supported: true, pdfUnavailable: true };
    }
    base.supported = true;
    base.pdfRedactUnavailable = typeof host.pdf.redact !== 'function';
    base.resignUnavailable = Boolean(inputs.resign)
      && !(host.c2pa && typeof host.c2pa.sign === 'function');

    const fileKey = `${f.url || ''}|${f.name}|${f.size}`;
    let failedPages = [];

    // Start the analyze wait FIRST so its budget timer runs concurrently with
    // the pages wait below. Awaiting them sequentially summed the budgets
    // (1800 + 1200 = 3000ms on a slow scanned PDF), which blew the runtime's
    // 2000ms onInput box - the patch was discarded and the drop looked dead.
    const analyzeJob = pdfJobFor(host, f, fileKey);
    const analyzeWait = (analyzeJob.result || analyzeJob.error)
      ? null
      : withBudget(analyzeJob.promise, PREVIEW_BUDGET_MS);

    // Page previews: render every page to a self-contained SVG in the shell
    // (host.pdf.pages), budgeted so a slow render never blocks the paint. The
    // template polls (re-committing the bars array) until the job settles.
    if (typeof host.pdf.pages === 'function') {
      const job = pdfPagesJobFor(host, f, fileKey);
      if (!job.result && !job.error) await withBudget(job.promise, PAGES_BUDGET_MS);
      if (job.result) {
        base.pdfPages = job.result.pages;
        base.hasPdfPages = job.result.pages.length > 0;
        base.pageCount = job.result.pages.length;
        // Two or more pages means the stack really scrolls, which is what the
        // page indicator in the rail exists for.
        base.hasManyPages = job.result.pages.length > 1;
        base.pagesTruncated = job.result.truncated;
        failedPages = job.result.failed || [];
      } else if (job.error) {
        base.pagesError = 'The page previews could not be rendered. The analysis below still applies.';
      } else {
        base.pagesPending = true;
      }
    }

    // Elements can be measured on a page preview, so the stage hint may promise
    // snap-to-cover; and until every bar HAS been measured the surface is not
    // ready to export (see exportWait below).
    base.canMeasure = base.hasPdfPages;
    base.exportWait = base.pagesPending
      || (base.hasPdfPages && bars.some((b) => parseNodeMarks(b.n) === null));

    let findings = pdfByteFindings(f.bytes);
    if (analyzeWait) await analyzeWait;
    const res = analyzeJob.result;
    if (res && Array.isArray(res.findings)) findings = findings.concat(res.findings);
    else if (analyzeJob.error) base.analysisFailed = true;
    else if (!res) base.analysisPending = true;
    base.findings = findings;
    base.nothingFound = !base.analysisPending && !base.analysisFailed && findings.length === 0;
    base.foundSummary = findings.length
      ? `Found ${findings.length} item${findings.length > 1 ? 's' : ''} of hidden or non-visible data.`
      : '';

    // Per-page bar counts (bars are in PDF points, page origin top-left) -
    // shown when page previews are unavailable so sidebar-set bars still get
    // live feedback. Text hit-testing would mean re-implementing PDF text
    // extraction in the sandbox, which is out of scope on purpose.
    const perPage = new Map();
    for (const b of bars) perPage.set(b.page, (perPage.get(b.page) || 0) + 1);
    base.pageBars = [...perPage.keys()].sort((a, b) => a - b)
      .map((p) => ({ page: p, count: perPage.get(p), plural: perPage.get(p) > 1 }));
    base.hasPageBars = base.pageBars.length > 0;
    base.downloadLabel = 'Download redacted PDF';

    // One advisory toast at most, each key once per file. Bar advisories only
    // on a real bars edit; page advisories on whichever pass first sees them.
    const seen = adviceSeenFor(fileKey);
    const adv = advisoryFor({
      pagesFailed: failedPages,
      pagesTruncated: base.pagesTruncated,
      barsEdited: trigger === 'bars',
      barCount: bars.length,
      isImage: false,
      vectorMode: false,
      hasThinBar: bars.some((b) => b.h < thinBarLimit(true)),
    }, seen);
    if (adv) {
      seen.add(adv.key);
      // The DOM dedupe marker needs file identity too, so a NEW file's first
      // toast is never suppressed by the previous file's dismissal record.
      base.toastKey = `${adv.key}@${f.name}:${f.size}`;
      base.toastText = adv.text;
    }
    return base;
  }

  base.supported = true;
  base.previewUrl = f.url || '';
  base.isSvg = info.kind === 'SVG';
  base.isRaster = !base.isSvg;

  // An SVG source renders INLINE so its nodes can be measured (snap-to-cover,
  // the partial-coverage warning and vector deletion all need real bounds).
  // Sized at the natural pixel size the bars are measured in, so the client↔bar
  // mapping matches the export's. A file with no usable size, or markup with no
  // <svg> root the tokenizer can find, falls back to the <img> preview and the
  // node behaviours simply do not fire.
  if (base.isSvg) {
    try {
      const d = svgDims(info.text);
      if (d.w > 0 && d.h > 0) {
        const markup = prepareInlineSvg(info.text, { className: 'rd-img', natW: d.w, natH: d.h });
        if (markup) {
          base.inlineSvg = markup;
          base.hasInlineSvg = true;
          base.svgW = d.w;
          base.svgH = d.h;
        }
      }
    } catch (e) { base.inlineSvg = ''; base.hasInlineSvg = false; }
  }

  // A single-frame file has exactly one page. Bars on any other page are left
  // over from a PDF the user replaced (`bars` is its own input and survives a
  // source swap), and there is no surface here on which to draw or delete them.
  // Reporting them in the count while the export burns only page 1 was the lie;
  // the counts now describe page 1 and the leftovers are stated plainly.
  const pageBarsOne = bars.filter((b) => (b.page || 1) === 1);
  const staleBars = bars.length - pageBarsOne.length;
  if (staleBars > 0) {
    base.staleBars = staleBars;
    base.staleNote = `${staleBars} mark${staleBars > 1 ? 's are' : ' is'} set on a page of the document you replaced. This file has one page, so ${staleBars > 1 ? 'they are' : 'it is'} ignored here and dropped from the export.`;
  }
  base.barCount = pageBarsOne.length;
  base.barPlural = pageBarsOne.length > 1;
  base.hasBars = pageBarsOne.length > 0;
  // Only an INLINE SVG has measurable elements. Flat pixels have none, and
  // neither does an SVG whose root declares no usable size, which falls back to
  // the <img> preview - the hint has to tell each of those the truth.
  base.canMeasure = base.hasInlineSvg;
  base.exportWait = base.canMeasure && pageBarsOne.some((b) => parseNodeMarks(b.n) === null);
  // Vector mode is only real for an SVG - the svgVector toggle can be left on
  // from an earlier file, and the raster copy must not flip on a JPEG.
  base.vectorMode = base.isSvg && Boolean(inputs.svgVector);

  const rasterKey = `${f.url || ''}|${f.name}|${f.size}`;

  // OCR suggestions, raster frames only. An SVG's text is already readable as
  // text (analyzeSvg reports it) and vector mode deletes ELEMENTS by address,
  // so a box derived from pixels would be the wrong unit there; a PDF page
  // previews as an interpreted SVG and has no pixels here at all.
  base.ocrAvailable = base.isRaster
    && Boolean(host && host.ocr && typeof host.ocr.run === 'function')
    && (typeof host.ocr.isAvailable !== 'function' || host.ocr.isAvailable() === true)
    && canRaster();
  if (base.ocrAvailable) {
    const req = String(inputs.ocr == null ? '' : inputs.ocr).trim();
    if (req === 'off' || !req) {
      // 'off' is the canvas cancel: abort a read in flight and forget it. No
      // request at all means a fresh mount or a file with nothing asked of it.
      if (req === 'off') cancelOcrJob();
    } else if (!ocrRequestOwns(req, rasterKey)) {
      // The nonce lives on an input, so it survives the file that produced it:
      // load a second picture and the same request would still be sitting there,
      // and the tool would read that one without anyone asking. A request
      // belongs to the file it was made on. The Suggest button is still right
      // there for the new picture, which is the point - a read can want a model
      // download, and that is never something to start on someone's behalf.
      cancelOcrJob();
    } else {
      const job = ocrJobFor(host, f, `${rasterKey}|${req}`, info.kind);
      // A warm, staged read of a small picture can finish inside this pass; a
      // first run (or a big scan) cannot, and the canvas polls for it rather
      // than this hook overrunning its 2000ms box.
      if (!job.result && !job.error) await withBudget(job.promise, OCR_BUDGET_MS);
      if (job.result) {
        base.ocrRead = true;
        base.suggestions = job.result;
        base.suggestJson = JSON.stringify(job.result);
        base.suggestCount = job.result.length;
        base.suggestPlural = job.result.length > 1;
        base.hasSuggestions = job.result.length > 0;
      } else if (job.error) {
        base.ocrError = job.error;
      } else {
        base.ocrPending = true;
      }
    }
  } else {
    cancelOcrJob();
  }

  let findings = [];
  try {
    if (info.kind === 'JPEG') findings = analyzeJpeg(f.bytes);
    else if (info.kind === 'PNG') findings = analyzePng(f.bytes);
    else if (info.kind === 'WebP') findings = analyzeWebp(f.bytes);
    else if (info.kind === 'SVG') findings = analyzeSvg(info.text);
  } catch (e) { findings = []; }
  base.findings = findings;
  base.nothingFound = findings.length === 0;
  base.foundSummary = findings.length
    ? `Found ${findings.length} item${findings.length > 1 ? 's' : ''} of hidden or non-visible data. All of it goes when the file is rebuilt.`
    : '';

  // Coverage: % of pixels the effective bar rects repaint. Dimensions come
  // from the file header, so this stays sandbox-pure. (For a rotated JPEG the
  // header dims are pre-orientation, so treat the number as approximate.)
  let dims = null;
  try {
    if (info.kind === 'JPEG') dims = jpegDims(f.bytes);
    else if (info.kind === 'PNG') dims = pngDims(f.bytes);
    else if (info.kind === 'WebP') dims = webpDims(f.bytes);
    else if (info.kind === 'SVG') { const d = svgDims(info.text); dims = d.w && d.h ? { w: d.w, h: d.h } : null; }
  } catch (e) { dims = null; }

  // The corner radius scales with the frame, so re-publish both blobs once the
  // frame is known: on a phone photo the base 3 units is a sub-pixel and the
  // Branded preset would be indistinguishable from Solid, on the preview and in
  // the exported file alike.
  if (dims && dims.w > 0 && dims.h > 0) {
    const radius = markRadiusFor(mark.style, dims.w, dims.h);
    base.markJson = JSON.stringify({
      ink: mark.ink, labelInk: mark.labelInk, label: mark.label, radius, style: mark.style,
    });
    base.geomJson = JSON.stringify({
      inflate: INFLATE_PX, gridPx: QUANT_GRID, gridPt: QUANT_GRID_PT, quantise, radius, dpi: REDACT_DPI,
    });
  }

  if (dims && pageBarsOne.length) {
    const rects = rectsFor(pageBarsOne, dims.w, dims.h, quantise, 1);
    const pct = coveragePercent(rects, dims.w, dims.h);
    const n = pageBarsOne.length;
    base.coveragePct = pct;
    base.hasCoverage = true;
    // Honest verb per mode: the raster path destroys pixels, vector mode
    // deletes the elements a bar touches and paints over the area.
    base.coverageText = base.vectorMode
      ? `${n} mark${n > 1 ? 's' : ''} will delete what ${n > 1 ? 'they touch' : 'it touches'} and cover about ${pct}% of the frame.`
      : `${n} mark${n > 1 ? 's' : ''} will repaint about ${pct}% of the pixels.`;
    base.coverageHigh = pct >= 97;
  }

  base.downloadLabel = base.isSvg
    ? (inputs.svgVector ? 'Download redacted SVG' : 'Download redacted PNG')
    : `Download redacted ${info.kind}`;

  const seen = adviceSeenFor(rasterKey);
  const adv = advisoryFor({
    pagesFailed: [],
    pagesTruncated: false,
    barsEdited: trigger === 'bars',
    barCount: pageBarsOne.length,
    isImage: true,
    vectorMode: base.vectorMode,
    hasThinBar: pageBarsOne.some((b) => b.h < thinBarLimit(false)),
  }, seen);
  if (adv) {
    seen.add(adv.key);
    base.toastKey = `${adv.key}@${f.name}:${f.size}`;
    base.toastText = adv.text;
  }
  return base;
}

function onInit(ctx) { return patch(ctx); }
function onInput(ctx) { return patch(ctx); }

// ─── export helpers (raster capability via host.raster - engine v1.105) ─────
// canRaster was an unmarked, independently-drifted copy of _shared/raster.js's
// (const vs var); it now routes through host.raster AND is brought under the
// lolly:shared drift guard, so a future edit to the canonical can't silently
// re-drift it (plans/86 section 6.1). decodeImage below keeps its own bytes+SVG decode
// for now - its OffscreenCanvas migration (and moving off unguarded `document`)
// is M2, not M1.
// === lolly:shared canRaster - generated from community/_shared/raster.js; edit there and run npm run sync:shared ===
function canRaster() {
  return !!(host.raster && host.raster.canRaster());
}
// === /lolly:shared canRaster ===

const HEADLESS_MSG = 'Redacting this file needs a browser canvas. Open this tool in the Lolly web app.';

function loadImageFromBytes(bytes, mime) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
      reject(new Error(HEADLESS_MSG));
      return;
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be decoded as an image.')); };
    im.src = url;
  });
}

// Decode with EXIF orientation applied, so bars drawn on the (oriented) preview
// land on the same pixels here. createImageBitmap first, <img> fallback -
// browsers orient both by default.
async function decodeImage(bytes, mime) {
  if (typeof createImageBitmap === 'function') {
    const blob = new Blob([bytes], { type: mime });
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
    catch (e) { try { return await createImageBitmap(blob); } catch (e2) { /* fall through */ } }
  }
  return loadImageFromBytes(bytes, mime);
}

function encodeCanvas(canvas, mime, quality) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: mime, quality });
  }
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') { reject(new Error(HEADLESS_MSG)); return; }
    canvas.toBlob((b) => { b ? resolve(b) : reject(new Error('The browser could not encode the redacted image.')); }, mime, quality);
  });
}

// Trace and fill the painted shape. Hand-traced rather than ctx.roundRect: the
// per-corner radii are load-bearing (a clamped corner must stay square) and
// roundRect is not present on every context this can run in.
function fillShape(ctx, s, color) {
  ctx.fillStyle = color;
  const [tl, tr, br, bl] = s.radii;
  if (!tl && !tr && !br && !bl) { ctx.fillRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0); return; }
  ctx.beginPath();
  ctx.moveTo(s.x0 + tl, s.y0);
  ctx.lineTo(s.x1 - tr, s.y0);
  if (tr) ctx.arcTo(s.x1, s.y0, s.x1, s.y0 + tr, tr);
  ctx.lineTo(s.x1, s.y1 - br);
  if (br) ctx.arcTo(s.x1, s.y1, s.x1 - br, s.y1, br);
  ctx.lineTo(s.x0 + bl, s.y1);
  if (bl) ctx.arcTo(s.x0, s.y1, s.x0, s.y1 - bl, bl);
  ctx.lineTo(s.x0, s.y0 + tl);
  if (tl) ctx.arcTo(s.x0, s.y0, s.x0 + tl, s.y0, tl);
  ctx.closePath();
  ctx.fill();
}

// Composite onto opaque white (kills alpha-hidden content), optional grayscale
// pass, then the marks at 100% opacity in the resolved ink. Returns the canvas.
// Grayscale runs BEFORE the marks: the scanned-page mode is about the source's
// colour (the yellow channel tracking dots live in), and the mark is ours.
function drawRedacted(img, W, H, rects, grayscale, mark) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(HEADLESS_MSG);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  if (grayscale) {
    const id = ctx.getImageData(0, 0, W, H);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = y; d[i + 1] = y; d[i + 2] = y;
      d[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
  }
  const ink = normaliseInk(mark && mark.ink) || NEUTRAL_INK;
  const labelInk = normaliseInk(mark && mark.labelInk) || '#ffffff';
  const label = mark && mark.label ? String(mark.label) : '';
  const radius = mark ? mark.radius : 0;
  ctx.globalAlpha = 1;
  for (const r of rects) {
    const s = paintedShape(r, radius, W, H);
    fillShape(ctx, s, ink);
    const lay = label ? stampFit(s, label, 14) : null;
    if (lay) {
      ctx.fillStyle = labelInk;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${lay.size}px SUSE, system-ui, sans-serif`;
      ctx.fillText(label, lay.cx, lay.cy);
    }
  }
  return canvas;
}

// ─── the verification gate ───────────────────────────────────────────────────
// Every check re-reads the OUTPUT bytes with the same scanners the analysis
// uses. A failure throws a sentence and nothing downloads.

// An encoder-added ICC profile is tolerated: some browsers (Safari) stamp the
// display profile into canvas output, and the source's own profile never
// crosses the canvas - so it is not source data. Everything else fails the gate.
function residualRasterMetadata(bytes, kind) {
  if (kind === 'JPEG') {
    for (const s of scanJpeg(bytes) || []) {
      if (s.sos) break;
      if (s.marker === 0xFE) return 'a JPEG comment';
      if (s.marker === 0xE2 && s.dataStart != null && matchAscii(bytes, s.dataStart, 'ICC_PROFILE\0')) continue;
      if (s.marker >= 0xE1 && s.marker <= 0xEF) return `a JPEG APP${s.marker - 0xE0} metadata segment`;
    }
    return null;
  }
  if (kind === 'PNG') {
    const bad = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME', 'acTL', 'caBX']);
    for (const c of scanPng(bytes)) {
      if (bad.has(c.type)) return `a PNG ${c.type} chunk`;
    }
    return null;
  }
  if (kind === 'WebP') {
    const bad = new Set(['EXIF', 'XMP ', 'ANIM', 'ANMF', 'C2PA', 'JUMB']);
    const s = scanWebp(bytes);
    for (const c of (s ? s.chunks : [])) {
      if (bad.has(c.fourcc)) return `a WebP ${c.fourcc.trim()} chunk`;
    }
    return null;
  }
  return null;
}

function inkRgb(hex) {
  const h = normaliseInk(hex) || NEUTRAL_INK;
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

// Re-decode the output and sample points inside every bar rect: each sampled
// pixel must be the ink that was supposed to be painted there. This checks the
// EFFECTIVE rect, never the inflated shape, because the effective rect is the
// part containment guarantees is solid - a corner of the inflated box is
// legitimately outside a rounded mark.
//
// It compares against the RESOLVED ink rather than asserting near-black, which
// is the check that keeps a branded fill honest: a colour that failed to reach
// the canvas (an unreadable fillStyle is a silent no-op) fails here instead of
// shipping. Stamped bars skip samples that land under the label, which is
// painted on top of the already-solid fill.
//
// JPEG and lossy WebP ring slightly at edges even inside an inflated bar, so
// lossy formats get a small tolerance; PNG must be near-exact. `checked: false`
// is only possible when no 2D context exists at all - the caller fails the
// export in that case rather than shipping unchecked bars under the "verified
// before download" promise.
async function verifyBarsPainted(outBytes, mime, kind, rects, mark) {
  if (!canRaster()) return { checked: false };
  const img = await decodeImage(outBytes, mime);
  const W = img.width || img.naturalWidth;
  const H = img.height || img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { checked: false };
  ctx.drawImage(img, 0, 0);
  const tol = kind === 'PNG' ? 4 : 20;
  const want = inkRgb(mark && mark.ink);
  const label = mark && mark.label ? String(mark.label) : '';
  const radius = mark ? mark.radius : 0;
  for (const r of rects) {
    // The label's own box, so its pixels are never mistaken for a failed fill.
    const lay = label ? stampFit(paintedShape(r, radius, W, H), label, 14) : null;
    const halfW = lay ? (label.length * lay.size * 0.62) / 2 + 2 : 0;
    const halfH = lay ? lay.size / 2 + 2 : 0;
    // Sample a 3x3 grid inset from the rect edges (the inflation absorbs any
    // codec ringing at the boundary).
    const inset = 3;
    const x0 = Math.min(r.x1 - 1, r.x0 + inset), x1 = Math.max(x0, r.x1 - 1 - inset);
    const y0 = Math.min(r.y1 - 1, r.y0 + inset), y1 = Math.max(y0, r.y1 - 1 - inset);
    for (let sy = 0; sy < 3; sy++) {
      for (let sx = 0; sx < 3; sx++) {
        const px = Math.round(x0 + (x1 - x0) * sx / 2);
        const py = Math.round(y0 + (y1 - y0) * sy / 2);
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        if (lay && Math.abs(px - lay.cx) <= halfW && Math.abs(py - lay.cy) <= halfH) continue;
        const d = ctx.getImageData(px, py, 1, 1).data;
        if (Math.abs(d[0] - want[0]) > tol || Math.abs(d[1] - want[1]) > tol || Math.abs(d[2] - want[2]) > tol) {
          throw new Error('Verification failed: a bar region is not the solid fill it should be in the output. Nothing was downloaded.');
        }
      }
    }
  }
  return { checked: true };
}

function verifyRasterOutput(outBytes, kind) {
  const residual = residualRasterMetadata(outBytes, kind);
  if (residual) {
    throw new Error(`Verification failed: the output still carries ${residual}. Nothing was downloaded.`);
  }
  if (trailingBytes(outBytes, kind) > 0) {
    throw new Error('Verification failed: the output has bytes after the end of the image. Nothing was downloaded.');
  }
}

// Vector-mode gate: no removed string may survive into the output. Tokens are
// trimmed, deduplicated and capped; short fragments (under 4 chars) are noise.
// Returns the surviving token, or null when nothing was found - the caller
// decides which sentence that failure deserves, because a stamp label the user
// typed could in principle repeat a deleted word, and "change the stamp text" is
// a very different instruction from "this file could not be redacted".
function verifySvgRemoved(outText, removed) {
  const seen = new Set();
  let checked = 0;
  for (const raw of removed) {
    for (const token of String(raw).split(/\s+/)) {
      const t = token.trim();
      if (t.length < 4 || seen.has(t)) continue;
      seen.add(t);
      if (outText.includes(t)) return t;
      if (++checked >= 4000) return null;
    }
  }
  return null;
}

function residualSvg(outText) {
  for (const tk of tokenize(outText)) {
    if (tk.t === 'comment') return 'an XML comment';
    if (tk.t === 'doctype') return 'a DOCTYPE declaration';
    if (tk.t === 'open' || tk.t === 'self') {
      if (shouldDropElement(tk.name)) return `a <${tk.name}> element`;
      for (const a of tk.attrs) {
        if (shouldDropAttr(a.name)) return `a ${a.name} attribute`;
        if (isRemoteOrDataHref(a)) return 'an embedded or external href';
      }
    }
  }
  return null;
}

// ─── filenames / mime ────────────────────────────────────────────────────────

const OUT_MIME = { JPEG: 'image/jpeg', PNG: 'image/png', WebP: 'image/webp' };
const OUT_EXT = { JPEG: '.jpg', PNG: '.png', WebP: '.webp' };

function redactedName(name, ext) {
  const base = String(name || 'file');
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return `${stem}-redacted${ext}`;
}

// ─── exportFile: rebuild, verify, only then hand bytes back ──────────────────

async function exportFile({ model, host }) {
  const inputs = inputsFrom(model);
  const f = inputs.source;
  if (!f || !f.bytes) throw new Error('Choose a file first.');

  const info = classify(f.bytes);
  if (info.kind === 'file') throw new Error('That file is not a supported image, SVG or PDF.');

  const bars = parseBars(inputs.bars);
  const quantise = inputs.quantise !== false;
  const grayscale = Boolean(inputs.grayscale);
  // Resolved once, waited for properly (this hook's budget is 10s): the burned
  // mark must never fall back to the neutral ink just because the brand tokens
  // were slow, or the export would not match the preview the user approved.
  const mark = await resolveMark(host, inputs, true);

  // ── PDF: rasterise-and-rebuild in the shell ──
  if (info.kind === 'PDF') {
    // The bars check comes FIRST, and the order is load bearing on a headless
    // host. "not available in this app" is the sentence the CLI/MCP read as
    // "escalate to the browser tier" (needsBrowserTier), so raising it before
    // noticing there are no bars sent a no-op run all the way into a real
    // Chromium, which then timed out waiting for an export button that the tool
    // was never going to offer - and reported that timeout instead of the one
    // sentence that explains the problem. Missing bars is not a capability gap.
    if (!bars.length) throw new Error('Draw or add at least one redaction bar first.');
    if (!host || !host.pdf || typeof host.pdf.redact !== 'function') {
      throw new Error('PDF redaction is not available in this app.');
    }
    // Bars for a PDF are stored in PDF point space (page origin top-left), so
    // they survive any DPI choice; the shell converts per page. The whole
    // EFFECTIVE rect is computed HERE, in points, before the bars cross the
    // bridge: the rebuild only snaps and inflates by two device pixels and has
    // no width grid at all, so a raw hand-off both dropped the mitigation the
    // sidebar claimed was on and painted a narrower bar than the preview drew.
    // The bridge's PdfRedactBar is {page,x,y,w,h}: the per-bar node addresses
    // are a drawing-surface concern (the PDF path rasterises and rebuilds, it
    // deletes nothing by address), so they stay on this side of the bridge.
    const sent = quantiseBarsPt(bars, quantise);
    // color/radius/label/labelColor are the v1.90 additive fields; an older
    // shell simply ignores them and burns its own neutral bars, which is why
    // they are passed unconditionally rather than feature-detected.
    const res = await host.pdf.redact(f.bytes, {
      bars: sent, dpi: REDACT_DPI, grayscale,
      color: mark.ink,
      radius: mark.radius,
      label: mark.label,
      labelColor: mark.labelInk,
    });
    if (!res || !res.bytes) throw new Error('PDF redaction returned no output. Nothing was downloaded.');
    // A bar aimed at a page the document does not have is silently skipped by
    // the rebuild - refuse instead of shipping that region fully visible.
    const over = bars.filter((b) => b.page > res.pages);
    if (over.length) {
      throw new Error(`Verification failed: a bar targets page ${over[0].page} but the PDF has only ${res.pages} page${res.pages > 1 ? 's' : ''}. Nothing was downloaded.`);
    }
    // A warning means a page could not be rendered and would ship blank - that
    // is silent content loss, so fail closed rather than downloading it.
    if (Array.isArray(res.warnings) && res.warnings.length) {
      throw new Error(`Verification failed: ${res.warnings.join(' ')} Nothing was downloaded.`);
    }
    let out = res.bytes;

    // The gate runs on the UNSIGNED rebuild - a fresh Content Credential
    // legitimately appends an incremental update with its own %%EOF and /C2PA
    // reference afterwards. Checks: exactly one end-of-file marker, nothing
    // but whitespace after it, no Content Credential carried over, and our own
    // output re-opened by the same analyzer the source went through.
    const eofs = countAscii(out, '%%EOF');
    if (eofs !== 1) {
      throw new Error(`Verification failed: the rebuilt PDF has ${eofs} end-of-file markers instead of one. Nothing was downloaded.`);
    }
    for (let i = indexOfAscii(out, '%%EOF', 0) + 5; i < out.length; i++) {
      const c = out[i];
      if (c !== 0x0A && c !== 0x0D && c !== 0x20 && c !== 0x09) {
        throw new Error('Verification failed: the rebuilt PDF has bytes after its end-of-file marker. Nothing was downloaded.');
      }
    }
    if (indexOfAscii(out, '/C2PA', 0) !== -1) {
      throw new Error('Verification failed: the rebuilt PDF still references a Content Credential. Nothing was downloaded.');
    }
    if (typeof host.pdf.analyze === 'function') {
      const recheck = await host.pdf.analyze(out);
      // The analyzer's inventory reports the page count for EVERY valid PDF -
      // 'Pages' is document structure, not leaked content, so it never fails
      // the gate. Every other label (Info fields, XMP, attachments, scripts,
      // annotations, layers, signatures) cannot exist in an image-only rebuild
      // and stays a hard failure.
      const leaks = (recheck && Array.isArray(recheck.findings) ? recheck.findings : [])
        .filter((r) => r && r.label !== 'Pages');
      if (leaks.length) {
        throw new Error(`Verification failed: the rebuilt PDF still carries ${leaks[0].label}. Nothing was downloaded.`);
      }
    }

    if (inputs.resign && host.c2pa && typeof host.c2pa.sign === 'function') {
      // Opt-in: re-sign the redacted derivative - a fresh manifest with no
      // ingredients, so no thumbnail of the original travels along. The
      // contract is sign(bytes, format, opts) → stamped bytes, and it throws
      // on failure, which correctly fails this opt-in export visibly.
      out = await host.c2pa.sign(out, 'pdf', { description: 'Covered content removed and the file rebuilt' });
    }
    return { bytes: out, mime: 'application/pdf', filename: redactedName(f.name, '.pdf') };
  }

  // ── SVG vector mode: string surgery over browser-measured node addresses ──
  if (info.kind === 'SVG' && inputs.svgVector) {
    // Every bar must carry the browser's answer to "what do you touch". A bar
    // that was never measured (typed into the sidebar, restored from a URL,
    // driven headlessly) cannot name the nodes to delete, and covering what we
    // promised to delete would be the one dishonest export in the tool.
    const svgBars = bars.filter((b) => (b.page || 1) === 1);
    const drop = new Set();
    for (const b of svgBars) {
      const marks = parseNodeMarks(b.n);
      if (marks === null) {
        // The wording is load bearing: the CLI classifies a failure as
        // browser-tier work by reading it (needsBrowserTier in
        // shells/cli/src/run.ts), and measuring is exactly what a browser can
        // do and this host cannot. Saying so escalates `lolly redact
        // --svgVector` into the real web shell, where the template measures the
        // bars and the export succeeds, instead of failing the run outright.
        throw new Error('Vector export deletes the elements a bar touches, so every mark first has to be measured against the page - which needs a browser canvas. Draw the mark on the preview, or turn vector mode off to export a PNG instead.');
      }
      for (const idx of marks) drop.add(idx);
    }
    const removed = [];
    let out = cleanSvgTokens(tokenize(info.text), removed, drop);
    out = dropUnreferencedDefs(out);

    // Map bars (drawn in the preview's natural pixel space) into root viewBox
    // coordinates. Only a unitless/px width+height pair counts as the natural
    // size (svgDims rejects %, mm, em - the browser resolves those against the
    // viewBox, and so do we). When the attribute aspect differs from the
    // viewBox the browser letterboxes (preserveAspectRatio xMidYMid meet), so
    // one uniform scale plus a centring offset maps bars, never separate sx/sy.
    const d = svgDims(info.text);
    const vb = d.viewBox || { x: 0, y: 0, w: d.w || 0, h: d.h || 0 };
    if (!(vb.w > 0) || !(vb.h > 0)) {
      throw new Error('This SVG has no usable size. Turn off vector mode to export it as a PNG instead.');
    }
    const natW = d.attrWh ? d.w : vb.w;
    const natH = d.attrWh ? d.h : vb.h;
    const s = Math.min(natW / vb.w, natH / vb.h);
    const ox = (natW - vb.w * s) / 2;
    const oy = (natH - vb.h * s) / 2;
    const pageOneBars = svgBars;
    const rects = rectsFor(bars, natW, natH, quantise, 1)
      .map((r) => ({ x0: (r.x0 - ox) / s, y0: (r.y0 - oy) / s, x1: (r.x1 - ox) / s, y1: (r.y1 - oy) / s }));
    // Hard gate: every drawn bar must actually map to a painted rect. A bar
    // that clamps away would ship the covered region fully visible.
    if (rects.length < pageOneBars.length) {
      throw new Error(`Verification failed: ${pageOneBars.length - rects.length} of ${pageOneBars.length} bar${pageOneBars.length > 1 ? 's' : ''} could not be placed on this SVG. Nothing was downloaded.`);
    }
    // The mark is built in the SAME viewBox coordinates as the rects: the
    // painted shape (inflate by radius, round, clamp) is computed here so what
    // the preview drew and what lands in the file are one shape, not two.
    // Radius from the frame the preview measured in (the natural pixel size),
    // then into viewBox units - one number, same as the canvas drew.
    const vecRadius = markRadiusFor(mark.style, natW, natH);
    const shapes = rects.map((r) => {
      const shape = paintedShape(r, vecRadius / s, vb.w, vb.h);
      return {
        x0: vb.x + shape.x0, y0: vb.y + shape.y0,
        x1: vb.x + shape.x1, y1: vb.y + shape.y1,
        radii: shape.radii,
      };
    });
    const beforeMarks = out;
    out = svgWithBars(out, shapes, mark, s);

    // The gate: grep the serialised output for anything that was deleted, and
    // re-run the residual scan for the node/attribute classes we remove.
    const survivor = verifySvgRemoved(out, removed);
    if (survivor) {
      // The only user-supplied text this export appends is the stamp label, so
      // when the document itself is clean, the label is the offender - and
      // "change the stamp text" is a far more useful sentence than a failure
      // that reads as if the file could not be redacted at all.
      const inDoc = verifySvgRemoved(beforeMarks, removed);
      throw new Error(inDoc
        ? 'Verification failed: removed content is still present in the SVG output. Nothing was downloaded.'
        : 'Verification failed: the stamp text repeats content this export deleted, so it would put it back. Change the stamp text. Nothing was downloaded.');
    }
    const residual = residualSvg(out);
    if (residual) {
      throw new Error(`Verification failed: the SVG output still carries ${residual}. Nothing was downloaded.`);
    }
    return { bytes: encodeText(out), mime: 'image/svg+xml', filename: redactedName(f.name, '.svg') };
  }

  // ── Raster (and default SVG→PNG): canvas rebuild ──
  if (!canRaster()) throw new Error(HEADLESS_MSG);

  const isSvg = info.kind === 'SVG';
  const srcMime = isSvg ? 'image/svg+xml' : (OUT_MIME[info.kind] || f.mime || 'application/octet-stream');
  const img = isSvg
    ? await loadImageFromBytes(f.bytes, 'image/svg+xml') // createImageBitmap(SVG) is patchy; <img> is the reliable path
    : await decodeImage(f.bytes, srcMime);
  let W = img.width || img.naturalWidth;
  let H = img.height || img.naturalHeight;
  if (isSvg && (!W || !H)) {
    const d = svgDims(info.text);
    W = Math.round(d.w || 0);
    H = Math.round(d.h || 0);
  }
  if (!(W > 0) || !(H > 0)) throw new Error('That file could not be decoded as an image.');

  // A single-frame file has one page. Bars left on other pages by a replaced
  // PDF are dropped (the UI says so before the click); bars ON page one must
  // ALL place, or the covered region would ship fully visible - the same hard
  // gate the SVG vector path runs.
  const pageOneBars = bars.filter((b) => (b.page || 1) === 1);
  const rects = rectsFor(pageOneBars, W, H, quantise, 1);
  if (rects.length < pageOneBars.length) {
    const missed = pageOneBars.length - rects.length;
    throw new Error(`Verification failed: ${missed} of ${pageOneBars.length} bar${pageOneBars.length > 1 ? 's' : ''} ${missed > 1 ? 'fall' : 'falls'} outside this image and could not be painted. Nothing was downloaded.`);
  }
  // Corner radius scaled to this frame, exactly as the preview scaled it.
  const frameMark = { ...mark, radius: markRadiusFor(mark.style, W, H) };
  const canvas = drawRedacted(img, W, H, rects, grayscale, frameMark);

  // Same-family re-encode is the metadata kill: jpeg→jpeg, png→png, webp→webp
  // (quality 1 asks the encoder for its lossless/best mode). SVG rasterises to
  // PNG. If the browser cannot encode the family it falls back to PNG rather
  // than failing the whole export.
  let outKind = isSvg ? 'PNG' : info.kind;
  let mime = OUT_MIME[outKind];
  const quality = outKind === 'JPEG' ? 0.92 : (outKind === 'WebP' ? 1 : undefined);
  let blob = await encodeCanvas(canvas, mime, quality);
  if (blob.type && blob.type !== mime) {
    outKind = 'PNG';
    mime = OUT_MIME.PNG;
    blob = await encodeCanvas(canvas, mime, undefined);
  }
  const out = new Uint8Array(await blob.arrayBuffer());

  // The gate - rescan the OUTPUT: no metadata, nothing past the terminator,
  // and every bar region re-decoded and sampled as solid fill.
  verifyRasterOutput(out, outKind);
  const barCheck = await verifyBarsPainted(out, mime, outKind, rects, frameMark);
  if (rects.length && !barCheck.checked) {
    throw new Error('Verification failed: the bar regions could not be re-checked in this browser. Nothing was downloaded.');
  }

  return { bytes: out, mime, filename: redactedName(f.name, OUT_EXT[outKind]) };
}
