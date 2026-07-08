// SPDX-License-Identifier: MPL-2.0
// ─── Embedded-metadata stripper ──────────────────────────────────────────────
//
// The "removal" side of hidden data: lossless byte-level surgery that drops
// EXIF/XMP/ICC/IPTC/comment/editor cruft while keeping the pixels (or paint
// commands) byte-for-byte identical. This intentionally mirrors the
// stripJpeg/stripPng/SVG-clean logic in the strip-data tool's hook: tools run
// sandboxed and cannot import the engine, so that copy stays there and this
// typed one serves the shells directly (see file-metadata.ts for the read-side
// counterpart, which documents the same duplication). PDF is deliberately NOT
// handled here — it needs a real PDF library (host.pdf.strip in the shells).
//
// Best-effort throughout: a format this module can't confidently parse is
// returned untouched rather than risk corrupting it.

export type StripFormat = 'jpeg' | 'png' | 'svg';

/** Formats this module (or the shell's host.pdf.strip) can produce a clean copy of. */
const STRIPPABLE = new Set(['JPEG', 'PNG', 'SVG', 'PDF']);

/** True when `format` (as reported by extractFileMetadata / a C2PA sniff, e.g. "JPEG", "PDF") can be cleaned — directly by stripMetadata() for jpeg/png/svg, or via host.pdf.strip() for pdf. */
export function isStrippableFormat(format: string | null | undefined): boolean {
  return !!format && STRIPPABLE.has(format.toUpperCase());
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ── JPEG: drop APP1 (EXIF/XMP), APP2 (ICC), APP13 (IPTC/Photoshop), COM ───────
// Keep APP0 (JFIF) and every image/scan segment untouched.

interface JpegSeg { marker: number; start: number; end?: number; sos?: boolean; }

function scanJpeg(bytes: Uint8Array): JpegSeg[] | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const segs: JpegSeg[] = [];
  let p = 2;
  while (p + 1 < bytes.length) {
    if (bytes[p] !== 0xff) break; // misaligned — bail, keep file intact
    let marker = bytes[p + 1]!;
    while (marker === 0xff && p + 2 < bytes.length) { p++; marker = bytes[p + 1]!; } // fill bytes
    if (marker === 0xd9) { segs.push({ marker, start: p, end: p + 2 }); break; } // EOI
    if (marker === 0xda) { segs.push({ marker, start: p, sos: true }); break; }  // SOS → entropy data
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { // standalone, no length
      segs.push({ marker, start: p, end: p + 2 }); p += 2; continue;
    }
    if (p + 4 > bytes.length) break;
    const len = (bytes[p + 2]! << 8) | bytes[p + 3]!;
    if (len < 2 || p + 2 + len > bytes.length) break;
    segs.push({ marker, start: p, end: p + 2 + len });
    p += 2 + len;
  }
  return segs;
}

function stripJpeg(bytes: Uint8Array): Uint8Array {
  const segs = scanJpeg(bytes);
  if (!segs) return bytes;
  const keep: Uint8Array[] = [bytes.subarray(0, 2)]; // SOI
  for (const s of segs) {
    if (s.sos) { keep.push(bytes.subarray(s.start)); continue; } // SOS + entropy data + EOI
    const isApp = s.marker >= 0xe0 && s.marker <= 0xef;
    const isCom = s.marker === 0xfe;
    if ((isApp && s.marker !== 0xe0) || isCom) continue; // drop metadata; keep APP0 (JFIF)
    keep.push(bytes.subarray(s.start, s.end));
  }
  return concatBytes(keep);
}

// ── PNG: drop tEXt / zTXt / iTXt / eXIf / tIME chunks, keep everything else ───

const PNG_STRIP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function stripPng(bytes: Uint8Array): Uint8Array {
  const keep: Uint8Array[] = [bytes.subarray(0, 8)]; // signature
  let p = 8;
  while (p + 8 <= bytes.length) {
    const len = ((bytes[p]! << 24) | (bytes[p + 1]! << 16) | (bytes[p + 2]! << 8) | bytes[p + 3]!) >>> 0;
    const type = String.fromCharCode(bytes[p + 4]!, bytes[p + 5]!, bytes[p + 6]!, bytes[p + 7]!);
    const end = p + 12 + len;
    if (end > bytes.length) break;
    if (!PNG_STRIP.has(type)) keep.push(bytes.subarray(p, end));
    p = end;
    if (type === 'IEND') break;
  }
  return concatBytes(keep);
}

// ── SVG: drop comments, <metadata>, editor-private namespaces/attrs, DOCTYPE,
// insignificant whitespace — every painting tag is emitted byte-for-byte ──────
// A small hand-rolled tokenizer (no DOM — this runs in browser/Tauri/CLI alike).

interface Tok {
  t: 'comment' | 'cdata' | 'doctype' | 'pi' | 'open' | 'self' | 'close' | 'text';
  raw: string;
  name?: string;
  attrs?: { name: string; value: string | null }[];
  isXmlDecl?: boolean;
}

function prefixOf(name: string): string {
  const c = name.indexOf(':');
  return c > 0 ? name.slice(0, c).toLowerCase() : '';
}

const DROP_EL_PREFIX = new Set(['sodipodi', 'inkscape', 'i', 'x']); // i:/x: = Adobe private
const DROP_EL_NAME = new Set(['metadata']);
const SPACE_SENSITIVE = new Set(['text', 'tspan', 'textpath', 'tref', 'style', 'title', 'desc', 'script']);
const DROP_XMLNS = new Set([
  'xmlns:inkscape', 'xmlns:sodipodi', 'xmlns:i', 'xmlns:x',
  'xmlns:dc', 'xmlns:cc', 'xmlns:rdf',
]);

function shouldDropElement(name: string): boolean {
  return DROP_EL_NAME.has(name.toLowerCase()) || DROP_EL_PREFIX.has(prefixOf(name));
}

function shouldDropAttr(name: string): boolean {
  if (name === 'xml:space') return false; // rendering-relevant — keep
  if (DROP_EL_PREFIX.has(prefixOf(name))) return true;
  if (DROP_XMLNS.has(name.toLowerCase())) return true;
  if (name === 'data-name') return true; // Illustrator layer names (privacy)
  return false;
}

function parseAttrs(s: string): { name: string; value: string | null }[] {
  const attrs: { name: string; value: string | null }[] = [];
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) && m[0]) {
    const value = m[2] != null ? m[2] : (m[3] != null ? m[3] : (m[4] != null ? m[4] : null));
    attrs.push({ name: m[1]!, value });
  }
  return attrs;
}

function parseTag(raw: string): Tok {
  const selfClose = raw.endsWith('/>');
  const inner = raw.slice(1, selfClose ? -2 : -1);
  if (inner[0] === '/') return { t: 'close', name: inner.slice(1).trim(), raw };
  const m = /^\s*([^\s/>]+)/.exec(inner);
  const name = m ? m[1]! : '';
  const attrs = m ? parseAttrs(inner.slice(m[0].length)) : [];
  return { t: selfClose ? 'self' : 'open', name, attrs, raw };
}

function tokenize(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    if (s[i] === '<') {
      if (s.startsWith('<!--', i)) {
        const end = s.indexOf('-->', i + 4);
        const close = end === -1 ? n : end + 3;
        toks.push({ t: 'comment', raw: s.slice(i, close) });
        i = close;
      } else if (s.startsWith('<![CDATA[', i)) {
        const end = s.indexOf(']]>', i + 9);
        const close = end === -1 ? n : end + 3;
        toks.push({ t: 'cdata', raw: s.slice(i, close) });
        i = close;
      } else if (s.startsWith('<!', i)) { // DOCTYPE / declaration
        const end = s.indexOf('>', i);
        const close = end === -1 ? n : end + 1;
        toks.push({ t: 'doctype', raw: s.slice(i, close) });
        i = close;
      } else if (s.startsWith('<?', i)) { // PI or xml declaration
        const end = s.indexOf('?>', i);
        const close = end === -1 ? n : end + 2;
        const raw = s.slice(i, close);
        toks.push({ t: 'pi', raw, isXmlDecl: /^<\?xml\s/i.test(raw) });
        i = close;
      } else { // element tag
        let j = i + 1, q = '';
        while (j < n) {
          const c = s[j]!;
          if (q) { if (c === q) q = ''; }
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

function rebuildTag(tk: Tok): string {
  const kept: string[] = [];
  for (const a of tk.attrs!) {
    if (shouldDropAttr(a.name)) continue;
    if (a.value == null) { kept.push(a.name); continue; }
    const quote = a.value.includes('"') ? "'" : '"';
    kept.push(`${a.name}=${quote}${a.value}${quote}`);
  }
  const body = tk.name + (kept.length ? ' ' + kept.join(' ') : '');
  return tk.t === 'self' ? `<${body}/>` : `<${body}>`;
}

function cleanSvgTokens(toks: Tok[]): string {
  const out: string[] = [];
  const stack: string[] = []; // names of currently-open kept elements
  let dropName: string | null = null, dropDepth = 0;

  for (const tk of toks) {
    if (dropDepth > 0) { // inside a dropped subtree — watch only its nesting
      if (tk.t === 'open' && tk.name === dropName) dropDepth++;
      else if (tk.t === 'close' && tk.name === dropName) dropDepth--;
      continue;
    }
    switch (tk.t) {
      case 'comment':
      case 'doctype':
        break; // drop
      case 'pi':
        if (tk.isXmlDecl) out.push(tk.raw); // keep the xml declaration, drop other PIs
        break;
      case 'cdata':
        out.push(tk.raw);
        break;
      case 'text': {
        const sensitive = stack.length > 0 && SPACE_SENSITIVE.has(stack[stack.length - 1]!);
        if (!sensitive && /^\s*$/.test(tk.raw)) break; // drop insignificant whitespace
        out.push(tk.raw);
        break;
      }
      case 'open':
      case 'self': {
        if (shouldDropElement(tk.name!)) {
          if (tk.t === 'open') { dropName = tk.name!; dropDepth = 1; }
          break;
        }
        const hasDroppable = tk.attrs!.some((a) => shouldDropAttr(a.name));
        out.push(hasDroppable ? rebuildTag(tk) : tk.raw);
        if (tk.t === 'open') stack.push(tk.name!.toLowerCase());
        break;
      }
      case 'close': {
        for (let k = stack.length - 1; k >= 0; k--) {
          if (stack[k] === tk.name!.toLowerCase()) { stack.length = k; break; }
        }
        out.push(tk.raw);
        break;
      }
    }
  }
  return out.join('');
}

function stripSvg(bytes: Uint8Array): Uint8Array {
  const text = new TextDecoder('utf-8').decode(bytes);
  return new TextEncoder().encode(cleanSvgTokens(tokenize(text)));
}

/**
 * Produce a lossless clean copy of `bytes` for a supported raster/vector format
 * — the image content (pixels or paint commands) is preserved byte-for-byte;
 * only metadata (EXIF/XMP/ICC/IPTC/comments/editor cruft) is removed. PDF is
 * not handled here — clean it via the shell's `host.pdf.strip()`.
 */
export function stripMetadata(bytes: Uint8Array, format: StripFormat): Uint8Array {
  try {
    if (format === 'jpeg') return stripJpeg(bytes);
    if (format === 'png') return stripPng(bytes);
    if (format === 'svg') return stripSvg(bytes);
  } catch { /* best-effort: fall through to returning the original bytes */ }
  return bytes;
}
