// SPDX-License-Identifier: MPL-2.0
/**
 * Image-metadata byte stampers and the metadata-carry core - DOM-free, shared
 * by the web export bridge and the Node shells.
 *
 * The stamper half moved here verbatim from
 * `shells/web/src/bridge/export-image-meta.ts` (which is now a thin re-export)
 * so one implementation serves the web export path AND the transform path
 * (`host.images` with `carryMetadata`). Pure bytes-in/bytes-out helpers that
 * splice DPI, provenance metadata and ICC colour profiles into PNG / JPEG /
 * SVG / GIF output. All best-effort: any parse hiccup returns the input bytes
 * untouched. No DOM and no module state.
 *
 * The carry half implements plans/144 Wave 1: `carryImageMetadata` reads the
 * descriptive metadata a source image carries (EXIF authorship, XMP, capture
 * date, optionally GPS) and rebuilds it into a re-encoded output container
 * (JPEG / PNG / WebP), reporting exactly what carried and what dropped - the
 * "honor at least" floor: degrade only by omission, and never silently.
 * Deliberate choices, recorded in plans/144-metadata-honor-programme.md A0:
 *   - REBUILD, never byte-copy, the EXIF: MakerNote blobs and serials do not
 *     tag along, and one writer serves every output container.
 *   - GPS carries only on explicit opt-in ({ gps: true }); the drop is
 *     reported, not silent. An XMP packet that itself contains GPS tags is
 *     dropped (reported) rather than surgically edited.
 *   - A C2PA credential is NEVER copied across a re-encode - its hard binding
 *     is to the source bytes, and a copied manifest would fail verify. The
 *     report says so; the original file still holds its own.
 */
import { crc32 } from './zip-crypto.ts';
import type { ExportMeta, MetaCarryReport } from '@lolly-tools/core/host-v1';
import { extractFileMetadata, extractXmpPacket } from './file-metadata.ts';
import type { FileMetadata } from './file-metadata.ts';
import { extractC2paStore } from './c2pa-verify.ts';
import { insertJpegSegments } from './jpeg-segments.ts';

// ── PNG physical-resolution metadata ────────────────────────────────────────
//
// dom-to-image PNGs carry no DPI, so they're assumed 96 - a 2480px-wide A4
// raster would print ~26 inches wide. insertPngPhys (below) injects a pHYs chunk
// recording the real DPI so print/layout software places the image at its
// intended physical size. All the byte-level stampers here take and return a
// Uint8Array (the caller reads/writes the Blob once) and are best-effort: any
// parse hiccup returns the input bytes untouched.

// JPEG carries DPI in the JFIF APP0 segment (right after SOI). Browsers emit one
// with no/72 density; patch the density-unit + X/Y density so placing apps size
// it physically. Best-effort: anything unexpected returns the bytes untouched.
export function patchJpegDpi(b: Uint8Array, dpi: number): Uint8Array {
  if (!(dpi > 0)) return b;
  try {
    // FFD8 (SOI) FFE0 (APP0) … "JFIF\0" at byte 6.
    if (b[0] !== 0xFF || b[1] !== 0xD8 || b[2] !== 0xFF || b[3] !== 0xE0) return b;
    if (!(b[6] === 0x4A && b[7] === 0x46 && b[8] === 0x49 && b[9] === 0x46 && b[10] === 0x00)) return b;
    const out = b.slice();
    const d = Math.min(0xFFFF, Math.round(dpi));
    out[13] = 1;                // density units: dots per inch
    out[14] = (d >> 8) & 0xFF;  // Xdensity
    out[15] = d & 0xFF;
    out[16] = (d >> 8) & 0xFF;  // Ydensity
    out[17] = d & 0xFF;
    return out;
  } catch {
    return b;
  }
}

export const readU32 = (b: Uint8Array, o: number): number => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
export function writeU32(b: Uint8Array, o: number, v: number): void { b[o] = (v >>> 24) & 255; b[o + 1] = (v >>> 16) & 255; b[o + 2] = (v >>> 8) & 255; b[o + 3] = v & 255; }

// CRC-32 comes from zip-crypto (table-driven, reflected poly 0xEDB88320,
// init/xorout 0xFFFFFFFF).

export function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  writeU32(chunk, 0, data.length);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(data, 8);
  writeU32(chunk, 8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

// Splice a pHYs chunk (pixels-per-metre, unit=metre) in right after IHDR.
export function insertPngPhys(png: Uint8Array, dpi: number): Uint8Array | null {
  const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (png[i] !== SIG[i]) return null;
  const ihdrLen = readU32(png, 8);
  const insertAt = 8 + 12 + ihdrLen; // sig + (len+type+data+crc) of IHDR
  const ppm = Math.round(dpi / 0.0254); // px per inch → px per metre
  const data = new Uint8Array(9);
  writeU32(data, 0, ppm);
  writeU32(data, 4, ppm);
  data[8] = 1; // unit specifier: metres
  const phys = pngChunk('pHYs', data);
  const out = new Uint8Array(png.length + phys.length);
  out.set(png.subarray(0, insertAt), 0);
  out.set(phys, insertAt);
  out.set(png.subarray(insertAt), insertAt + phys.length);
  return out;
}

// Overwrite an AVIF's `colr`/`nclx` box (ISOBMFF colour-information) so it signals
// Rec.2100 HDR - AVIF signals natively via nclx, no ICC needed. Canvas AVIF
// encoders write a colr box (usually sRGB). We rewrite ONLY the two HDR-defining
// fields - colour_primaries (u16 → 9, BT.2020) and transfer_characteristics
// (u16 → 16, PQ) - and DELIBERATELY preserve matrix_coefficients + the
// full_range flag: those describe how the AV1 bitstream's YCbCr maps back to RGB
// (the encoder's choice); changing them would make the decoder misread the pixels.
// The decoded RGB code values are our PQ pixels, now interpreted as BT.2020/PQ.
// Best-effort: only touches bytes that start with an `ftyp` box AND contain a
// `colr`+`nclx` marker (so a PNG fallback from a browser that can't encode AVIF,
// or any non-AVIF input, passes through untouched). No size change → offsets stay valid.
export function setAvifCicp(
  bytes: Uint8Array,
  cicp: { primaries: number; transfer: number },
): Uint8Array {
  // Require an ISOBMFF `ftyp` box (bytes 4..8) so we never scribble into other formats.
  if (bytes.length < 16 || String.fromCharCode(bytes[4]!, bytes[5]!, bytes[6]!, bytes[7]!) !== 'ftyp') return bytes;
  for (let i = 8; i + 11 < bytes.length; i++) { // i+11 (last transfer byte) must be in range
    if (bytes[i] === 0x63 && bytes[i + 1] === 0x6f && bytes[i + 2] === 0x6c && bytes[i + 3] === 0x72 && // 'colr'
        bytes[i + 4] === 0x6e && bytes[i + 5] === 0x63 && bytes[i + 6] === 0x6c && bytes[i + 7] === 0x78) { // 'nclx'
      const out = bytes.slice();
      const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
      dv.setUint16(i + 8, cicp.primaries);  // colour_primaries → BT.2020 (9)
      dv.setUint16(i + 10, cicp.transfer);  // transfer → PQ (16); matrix + range preserved
      return out;
    }
  }
  return bytes; // no colr/nclx (not an AVIF, or a fallback PNG) → leave unchanged
}

// Splice a cICP chunk (PNG 3rd ed.) after IHDR - the coding-independent code
// points that flag an HDR PNG (colour primaries, transfer, matrix=0, full-range).
// Colour-managed decoders key off this to render Rec.2100-PQ pixels as HDR.
export function insertPngCicp(
  png: Uint8Array,
  cicp: { primaries: number; transfer: number; matrix: number; fullRange: number },
): Uint8Array {
  const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (png[i] !== SIG[i]) return png;
  const insertAt = 8 + 12 + readU32(png, 8); // after IHDR
  const chunk = pngChunk('cICP', new Uint8Array([cicp.primaries, cicp.transfer, cicp.matrix, cicp.fullRange]));
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, insertAt), 0);
  out.set(chunk, insertAt);
  out.set(png.subarray(insertAt), insertAt + chunk.length);
  return out;
}

// ── Provenance metadata (authorship embedded per format) ─────────────────────
//
// A generic record assembled by the engine (engine/src/metadata.ts) is mapped
// here onto each format's native mechanism: PNG iTXt, JPEG EXIF (IFD0), PDF info
// dict (in renderPdf/renderCmykPdf), SVG <metadata>+<title>/<desc>, GIF comment,
// and the video containers via the engine's video-meta (MP4 udta/ilst,
// Matroska Tags - see withVideoMeta beside renderVideo).
// All best-effort: anything unexpected returns the input untouched.

const xmlEsc = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// PNG: one UTF-8 iTXt chunk per metadata field, spliced in after IHDR.
export function iTXtChunk(keyword: string, text: string): Uint8Array {
  const enc = new TextEncoder();
  const kw = enc.encode(keyword);
  const txt = enc.encode(text);
  const data = new Uint8Array(kw.length + 5 + txt.length);
  let o = 0;
  data.set(kw, o); o += kw.length;
  data[o++] = 0; // keyword terminator
  data[o++] = 0; // compression flag (uncompressed)
  data[o++] = 0; // compression method
  data[o++] = 0; // language tag (empty) terminator
  data[o++] = 0; // translated keyword (empty) terminator
  data.set(txt, o);
  return pngChunk('iTXt', data);
}

export function insertPngMeta(png: Uint8Array, meta: ExportMeta | null | undefined): Uint8Array {
  if (!meta) return png;
  try {
    const pairs = ([
      ['Software', meta.software], ['Author', meta.author],
      ['Source', meta.source], ['Description', meta.description], ['Comment', meta.contact],
      // 'Copyright' is a PNG-registered text keyword; 'License' is conventional.
      // User-asserted (bindToMeta) - empty on ordinary exports, filtered out below.
      ['Copyright', meta.copyright || ''], ['License', meta.license || ''],
    ] as [string, string][]).filter(([, v]) => v);
    if (!pairs.length) return png;
    return insertPngChunksAfterIhdr(png, pairs.map(([k, v]) => iTXtChunk(k, v))) ?? png;
  } catch {
    return png;
  }
}

/** Splice ready-made chunks in right after IHDR. Null when not a PNG. */
function insertPngChunksAfterIhdr(png: Uint8Array, chunks: Uint8Array[]): Uint8Array | null {
  const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (png[i] !== SIG[i]) return null;
  const at = 8 + 12 + readU32(png, 8); // after IHDR
  const extra = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(png.length + extra);
  out.set(png.subarray(0, at), 0);
  let o = at;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  out.set(png.subarray(at), o);
  return out;
}

// JPEG: a minimal little-endian EXIF TIFF (IFD0, ASCII tags) in an APP1 segment,
// inserted after the JFIF APP0. Tags: ImageDescription, Software, Artist, Copyright
// (ascending tag order, as TIFF requires).
export function buildExifTiff(fields: { tag: number; value: string }[]): Uint8Array | null {
  const enc = new TextEncoder();
  const entries = fields.map(f => {
    const s = enc.encode(f.value);
    const data = new Uint8Array(s.length + 1); data.set(s, 0); // NUL-terminated
    return { tag: f.tag, count: data.length, data };
  }).filter(e => e.count > 1);
  const n = entries.length;
  if (!n) return null;
  const dataStart = 8 + 2 + n * 12 + 4; // header + IFD(count + entries + next)
  const dataLen = entries.reduce((s, e) => s + (e.count > 4 ? e.count : 0), 0);
  const tiff = new Uint8Array(dataStart + dataLen);
  const dv = new DataView(tiff.buffer);
  tiff[0] = 0x49; tiff[1] = 0x49;            // "II" little-endian
  dv.setUint16(2, 0x002A, true);
  dv.setUint32(4, 8, true);                  // IFD0 offset
  dv.setUint16(8, n, true);
  let entryOff = 10, dataOff = dataStart;
  for (const e of entries) {
    dv.setUint16(entryOff, e.tag, true);
    dv.setUint16(entryOff + 2, 2, true);     // type ASCII
    dv.setUint32(entryOff + 4, e.count, true);
    if (e.count <= 4) tiff.set(e.data, entryOff + 8);
    else { dv.setUint32(entryOff + 8, dataOff, true); tiff.set(e.data, dataOff); dataOff += e.count; }
    entryOff += 12;
  }
  dv.setUint32(10 + n * 12, 0, true);        // next IFD = none
  return tiff;
}

export function insertJpegExif(b: Uint8Array, meta: ExportMeta | null | undefined): Uint8Array {
  if (!meta) return b;
  try {
    const desc = [meta.description, meta.contact].filter(Boolean).join(' · ');
    // The © notice + any licence in one broadly-read field (Finder, Lightroom, …).
    const rights = [meta.copyright, meta.license].filter(Boolean).join(' · ');
    const tiff = buildExifTiff([
      { tag: 0x010E, value: desc },          // ImageDescription
      { tag: 0x0131, value: meta.software }, // Software
      { tag: 0x013B, value: meta.author },   // Artist
      { tag: 0x8298, value: rights },        // Copyright (© notice + licence) - tag order ascending
    ].filter(f => f.value));
    if (!tiff) return b;
    const id = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
    const segLen = 2 + id.length + tiff.length;       // length field includes itself
    if (segLen > 0xFFFF) return b;
    const app1 = new Uint8Array(2 + segLen);
    app1[0] = 0xFF; app1[1] = 0xE1;
    app1[2] = (segLen >> 8) & 0xFF; app1[3] = segLen & 0xFF;
    app1.set(id, 4); app1.set(tiff, 4 + id.length);

    if (b[0] !== 0xFF || b[1] !== 0xD8) return b; // not JPEG
    let at = 2; // after SOI; skip an APP0 (JFIF) if present so order stays valid
    if (b[2] === 0xFF && b[3] === 0xE0) at = 4 + ((b[4]! << 8) | b[5]!);
    const out = new Uint8Array(b.length + app1.length);
    out.set(b.subarray(0, at), 0);
    out.set(app1, at);
    out.set(b.subarray(at), at + app1.length);
    return out;
  } catch {
    return b;
  }
}

// ── ICC colour profile embedding ─────────────────────────────────────────────
//
// Tags raster output with the colour space its pixels were rendered in (sRGB -
// what the browser canvas produces), so colour-managed software reproduces them
// faithfully instead of guessing. Profile bytes come from the engine (the single
// source of truth); the caller only splices them into each format's native slot:
// PNG iCCP chunk, JPEG APP2 segment. Best-effort: any hiccup returns the bytes.

// PNG: an iCCP chunk (profile name + compression method 0 + zlib-deflated
// profile) spliced in right after IHDR, before IDAT - where the spec requires it.
export async function insertPngIcc(png: Uint8Array, iccBytes: Uint8Array, profileName = 'sRGB'): Promise<Uint8Array> {
  try {
    const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) if (png[i] !== SIG[i]) return png;
    const name = new TextEncoder().encode(profileName); // 1–79 bytes, Latin-1
    const compressed = await deflateBytes(iccBytes);
    const data = new Uint8Array(name.length + 2 + compressed.length);
    data.set(name, 0);
    data[name.length] = 0;     // name terminator
    data[name.length + 1] = 0; // compression method: zlib/deflate
    data.set(compressed, name.length + 2);
    const chunk = pngChunk('iCCP', data);
    const at = 8 + 12 + readU32(png, 8); // after IHDR
    const out = new Uint8Array(png.length + chunk.length);
    out.set(png.subarray(0, at), 0);
    out.set(chunk, at);
    out.set(png.subarray(at), at + chunk.length);
    return out;
  } catch {
    return png;
  }
}

// JPEG: one or more APP2 "ICC_PROFILE\0" segments (the profile is split across
// 65 519-byte chunks when large), inserted after the leading APP0/APP1 segments.
export function insertJpegIcc(b: Uint8Array, iccBytes: Uint8Array): Uint8Array {
  try {
    if (b[0] !== 0xFF || b[1] !== 0xD8) return b; // not JPEG
    const id = [0x49, 0x43, 0x43, 0x5F, 0x50, 0x52, 0x4F, 0x46, 0x49, 0x4C, 0x45, 0x00]; // "ICC_PROFILE\0"
    const MAX = 0xFFFF - 2 - id.length - 2; // payload room per APP2 (after len + id + seq/count)
    const count = Math.ceil(iccBytes.length / MAX);
    if (count > 255) return b; // ICC caps at 255 chunks
    const segs: Uint8Array[] = [];
    for (let i = 0; i < count; i++) {
      const part = iccBytes.subarray(i * MAX, i * MAX + MAX);
      const segLen = 2 + id.length + 2 + part.length; // length field includes itself
      const app2 = new Uint8Array(2 + segLen);
      app2[0] = 0xFF; app2[1] = 0xE2;
      app2[2] = (segLen >> 8) & 0xFF; app2[3] = segLen & 0xFF;
      app2.set(id, 4);
      app2[4 + id.length] = i + 1;   // chunk sequence number (1-based)
      app2[5 + id.length] = count;   // total chunks
      app2.set(part, 6 + id.length);
      segs.push(app2);
    }
    // Insert after a leading APP0 (JFIF) and/or APP1 (EXIF) so marker order stays valid.
    let at = 2;
    while (b[at] === 0xFF && (b[at + 1] === 0xE0 || b[at + 1] === 0xE1)) {
      at += 2 + ((b[at + 2]! << 8) | b[at + 3]!);
    }
    const extra = segs.reduce((n, s) => n + s.length, 0);
    const out = new Uint8Array(b.length + extra);
    out.set(b.subarray(0, at), 0);
    let o = at;
    for (const s of segs) { out.set(s, o); o += s.length; }
    out.set(b.subarray(at), o);
    return out;
  } catch {
    return b;
  }
}

// SVG: <title>/<desc> + a Dublin-Core <metadata> block, injected right after the
// opening <svg> tag of the serialized markup (avoids DOM-namespace gymnastics).
export function svgMetaBlock(meta: ExportMeta): string {
  const lines: string[] = [];
  if (meta.tool) lines.push(`<title>${xmlEsc(meta.tool)}</title>`);
  const desc = [meta.description, meta.contact].filter(Boolean).join(' · ');
  if (desc) lines.push(`<desc>${xmlEsc(desc)}</desc>`);
  lines.push(
    '<metadata>',
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '<rdf:Description rdf:about="">',
  );
  if (meta.author) lines.push(`<dc:creator>${xmlEsc(meta.author)}</dc:creator>`);
  const rights = [meta.copyright, meta.license].filter(Boolean).join(' · ');
  if (rights) lines.push(`<dc:rights>${xmlEsc(rights)}</dc:rights>`);
  lines.push(`<dc:publisher>${xmlEsc(meta.software)}</dc:publisher>`);
  lines.push(`<dc:source>${xmlEsc(meta.source)}</dc:source>`, '</rdf:Description>', '</rdf:RDF>', '</metadata>');
  return lines.join('\n');
}

export function injectSvgMeta(xml: string, meta: ExportMeta | null | undefined): string {
  if (!meta) return xml;
  const m = xml.match(/<svg\b[^>]*?>/);
  if (!m) return xml;
  const at = m.index! + m[0]!.length;
  return xml.slice(0, at) + '\n' + svgMetaBlock(meta) + xml.slice(at);
}

// GIF: a Comment Extension (0x21 0xFE …) inserted right after the header + LSD +
// global colour table, before the first frame.
export function withGifComment(bytes: Uint8Array, text: string | undefined): Uint8Array {
  if (!text || bytes.length < 13) return bytes;
  const packed = bytes[10]!;
  const gctSize = (packed & 0x80) ? 3 * (1 << ((packed & 0x07) + 1)) : 0;
  const at = 13 + gctSize;
  const txt = new TextEncoder().encode(text);
  const subs: number[] = [];
  for (let i = 0; i < txt.length; i += 255) {
    const chunk = txt.subarray(i, i + 255);
    subs.push(chunk.length, ...chunk);
  }
  const ext = new Uint8Array(2 + subs.length + 1);
  ext[0] = 0x21; ext[1] = 0xFE; ext.set(subs, 2); ext[ext.length - 1] = 0x00;
  const out = new Uint8Array(bytes.length + ext.length);
  out.set(bytes.subarray(0, at), 0);
  out.set(ext, at);
  out.set(bytes.subarray(at), at + ext.length);
  return out;
}

// Decompresses a zlib/FlateDecode byte buffer using the Streams API (browser
// and Node 18+ both provide CompressionStream/DecompressionStream globals).
export async function inflateBytes(data: Uint8Array): Promise<Uint8Array> {
  return pipeThroughTransform(new DecompressionStream('deflate'), data);
}

// Compresses bytes to zlib/FlateDecode format using the Streams API.
export async function deflateBytes(data: Uint8Array): Promise<Uint8Array> {
  return pipeThroughTransform(new CompressionStream('deflate'), data);
}

async function pipeThroughTransform(transform: any, data: Uint8Array): Promise<Uint8Array> {
  const writer = transform.writable.getWriter();
  writer.write(data);
  writer.close();
  const reader = transform.readable.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const c of chunks) { out.set(c, i); i += c.length; }
  return out;
}

// ═══ Metadata carry (plans/144 Wave 1) ═══════════════════════════════════════

/**
 * The field mapping table - the single source of truth for what the carry
 * moves, exported for the claim tests (plans/144 O6) and the disclosure UI. `labels` are the
 * display labels `extractFileMetadata` assigns, first match wins; `exifTag` is
 * where the value is written on the EXIF side of the output.
 */
export const META_CARRY_FIELDS = [
  { key: 'description', exifTag: 0x010E, labels: ['Image description', 'Description', 'Title'] },
  { key: 'software', exifTag: 0x0131, labels: ['Software', 'Created with'] },
  { key: 'author', exifTag: 0x013B, labels: ['Artist', 'Author', 'Creator'] },
  { key: 'copyright', exifTag: 0x8298, labels: ['Copyright', 'Rights'] },
  { key: 'capture date', exifTag: 0x9003, labels: ['Taken', 'Creation Time'] },
] as const;

export interface CarrySource { bytes: Uint8Array; mime?: string }
export interface CarryOutput { bytes: Uint8Array; mime: string }
export interface CarryOpts {
  /** Carry the GPS fix too. Default false: location is personal data, so it
   *  moves only on explicit opt-in; the drop is reported either way. */
  gps?: boolean;
}

interface CarryFields { description?: string; software?: string; author?: string; copyright?: string; 'capture date'?: string }

function pickCarryFields(meta: FileMetadata): CarryFields {
  const out: CarryFields = {};
  for (const spec of META_CARRY_FIELDS) {
    for (const label of spec.labels) {
      const f = meta.fields.find((x) => x.label === label);
      if (f?.value) { out[spec.key] = f.value; break; }
    }
  }
  return out;
}

/** Decimal degrees → EXIF d/m/s rationals (num/den pairs, seconds ×10000). */
function toDmsRationals(v: number): number[] {
  const a = Math.abs(v);
  const d = Math.floor(a);
  const mFloat = (a - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60 * 10000);
  return [d, 1, m, 1, s, 10000];
}

/**
 * Build a little-endian EXIF TIFF from the carried fields: IFD0 ASCII tags,
 * an Exif sub-IFD for DateTimeOriginal, and a GPS IFD when a fix is kept.
 * Null when nothing would be written.
 */
export function buildCarryExifTiff(fields: CarryFields, gps?: { lat: number; lon: number }): Uint8Array | null {
  const enc = new TextEncoder();
  const ascii = (s: string): Uint8Array => {
    const raw = enc.encode(s);
    const data = new Uint8Array(raw.length + 1); data.set(raw, 0); // NUL-terminated
    return data;
  };
  const ifd0Ascii: { tag: number; data: Uint8Array }[] = [];
  if (fields.description) ifd0Ascii.push({ tag: 0x010E, data: ascii(fields.description) });
  if (fields.software) ifd0Ascii.push({ tag: 0x0131, data: ascii(fields.software) });
  if (fields.author) ifd0Ascii.push({ tag: 0x013B, data: ascii(fields.author) });
  if (fields.copyright) ifd0Ascii.push({ tag: 0x8298, data: ascii(fields.copyright) });
  const date = fields['capture date'] ? ascii(fields['capture date']) : null;
  if (!ifd0Ascii.length && !date && !gps) return null;

  // Layout: header(8) → IFD0 → IFD0 overflow data → Exif IFD (+data) → GPS IFD (+data).
  const n0 = ifd0Ascii.length + (date ? 1 : 0) + (gps ? 1 : 0);
  const ifd0Size = 2 + n0 * 12 + 4;
  const ifd0Data = ifd0Ascii.reduce((s, e) => s + (e.data.length > 4 ? e.data.length : 0), 0);
  const exifOff = date ? 8 + ifd0Size + ifd0Data : 0;
  const exifSize = date ? 2 + 12 + 4 : 0;
  const exifData = date && date.length > 4 ? date.length : 0;
  const gpsOff = gps ? 8 + ifd0Size + ifd0Data + exifSize + exifData : 0;
  const gpsSize = gps ? 2 + 4 * 12 + 4 : 0;
  const gpsData = gps ? 48 : 0; // two RATIONAL triples, 24 bytes each
  const total = 8 + ifd0Size + ifd0Data + exifSize + exifData + gpsSize + gpsData;

  const tiff = new Uint8Array(total);
  const dv = new DataView(tiff.buffer);
  tiff[0] = 0x49; tiff[1] = 0x49; // "II" little-endian
  dv.setUint16(2, 0x002A, true);
  dv.setUint32(4, 8, true);

  dv.setUint16(8, n0, true);
  let entry = 10;
  let dataOff = 8 + ifd0Size;
  const writeAscii = (tag: number, data: Uint8Array): void => {
    dv.setUint16(entry, tag, true);
    dv.setUint16(entry + 2, 2, true); // ASCII
    dv.setUint32(entry + 4, data.length, true);
    if (data.length <= 4) tiff.set(data, entry + 8);
    else { dv.setUint32(entry + 8, dataOff, true); tiff.set(data, dataOff); dataOff += data.length; }
    entry += 12;
  };
  // IFD0 tag order stays ascending: the ASCII set (0x010E…0x8298) precedes the
  // Exif pointer (0x8769) and the GPS pointer (0x8825).
  for (const e of ifd0Ascii) writeAscii(e.tag, e.data);
  if (date) {
    dv.setUint16(entry, 0x8769, true);
    dv.setUint16(entry + 2, 4, true); // LONG
    dv.setUint32(entry + 4, 1, true);
    dv.setUint32(entry + 8, exifOff, true);
    entry += 12;
  }
  if (gps) {
    dv.setUint16(entry, 0x8825, true);
    dv.setUint16(entry + 2, 4, true); // LONG
    dv.setUint32(entry + 4, 1, true);
    dv.setUint32(entry + 8, gpsOff, true);
    entry += 12;
  }
  dv.setUint32(entry, 0, true); // next IFD = none

  if (date) {
    dv.setUint16(exifOff, 1, true);
    dv.setUint16(exifOff + 2, 0x9003, true); // DateTimeOriginal
    dv.setUint16(exifOff + 4, 2, true);      // ASCII
    dv.setUint32(exifOff + 6, date.length, true);
    const valueAt = exifOff + 2 + 12;
    if (date.length <= 4) tiff.set(date, exifOff + 10);
    else { dv.setUint32(exifOff + 10, valueAt + 4, true); tiff.set(date, valueAt + 4); }
    dv.setUint32(valueAt, 0, true); // next IFD = none
  }

  if (gps) {
    dv.setUint16(gpsOff, 4, true);
    const dataAt = gpsOff + gpsSize;
    let e = gpsOff + 2;
    const writeGps = (tag: number, type: number, count: number, fill: (at: number) => void, inline?: Uint8Array): void => {
      dv.setUint16(e, tag, true);
      dv.setUint16(e + 2, type, true);
      dv.setUint32(e + 4, count, true);
      if (inline) tiff.set(inline, e + 8);
      else fill(e + 8);
      e += 12;
    };
    const rats = (at: number, values: number[]): void => {
      dv.setUint32(e + 8, at, true);
      for (let i = 0; i < values.length; i++) dv.setUint32(at + i * 4, values[i]!, true);
    };
    writeGps(0x0001, 2, 2, () => {}, Uint8Array.of(gps.lat >= 0 ? 0x4E : 0x53, 0)); // 'N'/'S'
    writeGps(0x0002, 5, 3, (/* offset entry */) => rats(dataAt, toDmsRationals(gps.lat)));
    writeGps(0x0003, 2, 2, () => {}, Uint8Array.of(gps.lon >= 0 ? 0x45 : 0x57, 0)); // 'E'/'W'
    writeGps(0x0004, 5, 3, () => rats(dataAt + 24, toDmsRationals(gps.lon)));
    dv.setUint32(e, 0, true); // next IFD = none
  }

  return tiff;
}

// ── Output-container writers ────────────────────────────────────────────────

const XMP_JPEG_ID = 'http://ns.adobe.com/xap/1.0/';

function jpegApp1(id: string, payload: Uint8Array): Uint8Array | null {
  const enc = new TextEncoder();
  const idBytes = enc.encode(id + '\0');
  const segLen = 2 + idBytes.length + payload.length;
  if (segLen > 0xFFFF) return null;
  const seg = new Uint8Array(2 + segLen);
  seg[0] = 0xFF; seg[1] = 0xE1;
  seg[2] = (segLen >> 8) & 0xFF; seg[3] = segLen & 0xFF;
  seg.set(idBytes, 4);
  seg.set(payload, 4 + idBytes.length);
  return seg;
}

function carryIntoJpeg(bytes: Uint8Array, tiff: Uint8Array | null, xmp: string | null): { bytes: Uint8Array; xmpDropped: boolean } | null {
  const segs: Uint8Array[] = [];
  if (tiff) {
    const seg = jpegApp1('Exif\0', tiff); // "Exif\0" + '\0' from jpegApp1 = "Exif\0\0"
    if (seg) segs.push(seg);
  }
  let xmpDropped = false;
  if (xmp) {
    const seg = jpegApp1(XMP_JPEG_ID, new TextEncoder().encode(xmp));
    if (seg) segs.push(seg);
    else xmpDropped = true; // over the 64 KB APP1 ceiling
  }
  if (!segs.length) return xmpDropped ? { bytes, xmpDropped } : null;
  const out = insertJpegSegments(bytes, segs, { replace: true });
  if (out === bytes) return null; // walker refused (not a JPEG / malformed)
  return { bytes: out, xmpDropped };
}

function carryIntoPng(bytes: Uint8Array, fields: CarryFields, tiff: Uint8Array | null, xmp: string | null): Uint8Array | null {
  const chunks: Uint8Array[] = [];
  if (tiff) chunks.push(pngChunk('eXIf', tiff));
  const textPairs: [string, string | undefined][] = [
    ['Description', fields.description], ['Author', fields.author],
    ['Copyright', fields.copyright], ['Software', fields.software],
    ['Creation Time', fields['capture date']],
  ];
  for (const [k, v] of textPairs) if (v) chunks.push(iTXtChunk(k, v));
  if (xmp) chunks.push(iTXtChunk('XML:com.adobe.xmp', xmp));
  if (!chunks.length) return null;
  return insertPngChunksAfterIhdr(bytes, chunks);
}

// WebP RIFF surgery. Chunk order per spec: VP8X first, then ICCP / ANIM /
// image data, with EXIF and XMP after the image data. A simple VP8/VP8L file
// has no VP8X; one is created (canvas size read from the bitstream header).
interface RiffChunk { fourcc: string; start: number; size: number }

function webpChunks(bytes: Uint8Array): RiffChunk[] | null {
  if (bytes.length < 12) return null;
  const cc = (o: number): string => String.fromCharCode(bytes[o]!, bytes[o + 1]!, bytes[o + 2]!, bytes[o + 3]!);
  if (cc(0) !== 'RIFF' || cc(8) !== 'WEBP') return null;
  const out: RiffChunk[] = [];
  let p = 12;
  while (p + 8 <= bytes.length) {
    const size = (bytes[p + 4]! | (bytes[p + 5]! << 8) | (bytes[p + 6]! << 16) | (bytes[p + 7]! * 0x1000000)) >>> 0;
    if (p + 8 + size > bytes.length) return null;
    out.push({ fourcc: cc(p), start: p, size });
    p += 8 + size + (size & 1);
  }
  return out;
}

/** Canvas width/height (+ alpha hint) from a VP8/VP8L bitstream header. */
function webpDimensions(bytes: Uint8Array, chunks: RiffChunk[]): { w: number; h: number; alpha: boolean } | null {
  const vp8l = chunks.find((c) => c.fourcc === 'VP8L');
  if (vp8l && vp8l.size >= 5 && bytes[vp8l.start + 8] === 0x2F) {
    const p = vp8l.start + 9;
    const bits = (bytes[p]! | (bytes[p + 1]! << 8) | (bytes[p + 2]! << 16) | (bytes[p + 3]! * 0x1000000)) >>> 0;
    return { w: (bits & 0x3FFF) + 1, h: ((bits >>> 14) & 0x3FFF) + 1, alpha: !!((bits >>> 28) & 1) };
  }
  const vp8 = chunks.find((c) => c.fourcc === 'VP8 ');
  if (vp8 && vp8.size >= 10) {
    const p = vp8.start + 8;
    // Keyframe: frame-tag bit 0 clear, then the 9D 01 2A start code.
    if ((bytes[p]! & 1) === 0 && bytes[p + 3] === 0x9D && bytes[p + 4] === 0x01 && bytes[p + 5] === 0x2A) {
      const w = (bytes[p + 6]! | (bytes[p + 7]! << 8)) & 0x3FFF;
      const h = (bytes[p + 8]! | (bytes[p + 9]! << 8)) & 0x3FFF;
      if (w && h) return { w, h, alpha: false };
    }
  }
  return null;
}

const riffChunk = (fourcc: string, payload: Uint8Array): Uint8Array => {
  const out = new Uint8Array(8 + payload.length + (payload.length & 1));
  for (let i = 0; i < 4; i++) out[i] = fourcc.charCodeAt(i);
  out[4] = payload.length & 0xFF; out[5] = (payload.length >>> 8) & 0xFF;
  out[6] = (payload.length >>> 16) & 0xFF; out[7] = (payload.length >>> 24) & 0xFF;
  out.set(payload, 8);
  return out;
};

const VP8X_ICC = 0x20, VP8X_ALPHA = 0x10, VP8X_EXIF = 0x08, VP8X_XMP = 0x04;

function carryIntoWebp(bytes: Uint8Array, tiff: Uint8Array | null, xmp: string | null): Uint8Array | null {
  if (!tiff && !xmp) return null;
  const chunks = webpChunks(bytes);
  if (!chunks) return null;
  if (chunks.some((c) => c.fourcc === 'ANIM' || c.fourcc === 'ANMF')) return null; // stills only

  let flags = 0, canvasW = 0, canvasH = 0;
  const vp8x = chunks.find((c) => c.fourcc === 'VP8X');
  if (vp8x && vp8x.size >= 10) {
    flags = bytes[vp8x.start + 8]!;
    const p = vp8x.start + 12;
    canvasW = (bytes[p]! | (bytes[p + 1]! << 8) | (bytes[p + 2]! << 16)) + 1;
    canvasH = (bytes[p + 3]! | (bytes[p + 4]! << 8) | (bytes[p + 5]! << 16)) + 1;
  } else {
    const dims = webpDimensions(bytes, chunks);
    if (!dims) return null; // no VP8X and an unreadable bitstream header
    canvasW = dims.w; canvasH = dims.h;
    if (dims.alpha || chunks.some((c) => c.fourcc === 'ALPH')) flags |= VP8X_ALPHA;
    if (chunks.some((c) => c.fourcc === 'ICCP')) flags |= VP8X_ICC;
  }
  if (tiff) flags |= VP8X_EXIF;
  if (xmp) flags |= VP8X_XMP;
  if (canvasW > 0x1000000 || canvasH > 0x1000000 || !canvasW || !canvasH) return null;

  const vp8xPayload = new Uint8Array(10);
  vp8xPayload[0] = flags;
  const w1 = canvasW - 1, h1 = canvasH - 1;
  vp8xPayload[4] = w1 & 0xFF; vp8xPayload[5] = (w1 >>> 8) & 0xFF; vp8xPayload[6] = (w1 >>> 16) & 0xFF;
  vp8xPayload[7] = h1 & 0xFF; vp8xPayload[8] = (h1 >>> 8) & 0xFF; vp8xPayload[9] = (h1 >>> 16) & 0xFF;

  const parts: Uint8Array[] = [riffChunk('VP8X', vp8xPayload)];
  for (const c of chunks) {
    if (c.fourcc === 'VP8X' || c.fourcc === 'EXIF' || c.fourcc === 'XMP ') continue; // replaced below
    parts.push(bytes.subarray(c.start, c.start + 8 + c.size + (c.size & 1)));
  }
  if (tiff) parts.push(riffChunk('EXIF', tiff));
  if (xmp) parts.push(riffChunk('XMP ', new TextEncoder().encode(xmp)));

  const body = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(12 + body);
  out[0] = 0x52; out[1] = 0x49; out[2] = 0x46; out[3] = 0x46; // RIFF
  const riffSize = body + 4; // + "WEBP"
  out[4] = riffSize & 0xFF; out[5] = (riffSize >>> 8) & 0xFF; out[6] = (riffSize >>> 16) & 0xFF; out[7] = (riffSize >>> 24) & 0xFF;
  out[8] = 0x57; out[9] = 0x45; out[10] = 0x42; out[11] = 0x50; // WEBP
  let o = 12;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/**
 * ExportMeta → an XMP packet with the photo industry's own namespaces
 * (plans/144 Wave 5 O2): xmp:CreatorTool, dc:creator/dc:rights,
 * xmpRights:UsageTerms for the licence, photoshop:Credit and a plus:Licensor
 * for the author. Null when no field would be written.
 */
export function buildExportXmp(meta: ExportMeta | null | undefined): string | null {
  if (!meta) return null;
  const rights = [meta.copyright].filter(Boolean).join(' · ');
  if (!meta.author && !rights && !meta.license && !meta.software) return null;
  const li = (s: string): string => `<rdf:li>${xmlEsc(s)}</rdf:li>`;
  const parts: string[] = [];
  if (meta.software) parts.push(`<xmp:CreatorTool>${xmlEsc(meta.software)}</xmp:CreatorTool>`);
  if (meta.author) parts.push(`<dc:creator><rdf:Seq>${li(meta.author)}</rdf:Seq></dc:creator>`);
  if (rights) parts.push(`<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${xmlEsc(rights)}</rdf:li></rdf:Alt></dc:rights>`);
  if (meta.license) parts.push(`<xmpRights:UsageTerms><rdf:Alt><rdf:li xml:lang="x-default">${xmlEsc(meta.license)}</rdf:li></rdf:Alt></xmpRights:UsageTerms>`);
  if (meta.author) {
    parts.push(`<photoshop:Credit>${xmlEsc(meta.author)}</photoshop:Credit>`);
    parts.push(`<plus:Licensor><rdf:Seq><rdf:li rdf:parseType="Resource"><plus:LicensorName>${xmlEsc(meta.author)}</plus:LicensorName></rdf:li></rdf:Seq></plus:Licensor>`);
  }
  return (
    '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/"' +
    ' xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"' +
    ' xmlns:plus="http://ns.useplus.org/ldf/xmp/1.0/">' +
    parts.join('') +
    '</rdf:Description></rdf:RDF></x:xmpmeta>'
  );
}

/** PNG: append the ExportMeta XMP packet as an iTXt `XML:com.adobe.xmp` chunk. */
export function insertPngXmp(png: Uint8Array, meta: ExportMeta | null | undefined): Uint8Array {
  try {
    const xmp = buildExportXmp(meta);
    if (!xmp) return png;
    return insertPngChunksAfterIhdr(png, [iTXtChunk('XML:com.adobe.xmp', xmp)]) ?? png;
  } catch {
    return png;
  }
}

/** JPEG: add the ExportMeta XMP packet as an APP1 segment at its canonical slot. */
export function insertJpegXmp(b: Uint8Array, meta: ExportMeta | null | undefined): Uint8Array {
  try {
    const xmp = buildExportXmp(meta);
    if (!xmp) return b;
    const seg = jpegApp1(XMP_JPEG_ID, new TextEncoder().encode(xmp));
    if (!seg) return b; // over the APP1 ceiling
    return insertJpegSegments(b, [seg], { replace: true });
  } catch {
    return b;
  }
}

/**
 * WebP: stamp an ExportMeta as an EXIF chunk (RIFF `EXIF` + the VP8X flag) -
 * the same fields insertJpegExif writes, in WebP's native slot (plans/144
 * Wave 2 G2 parity) - plus the XMP packet (Wave 5 O2) when the meta has
 * authorship to declare. Best-effort: non-WebP or animated input returns untouched.
 */
export function insertWebpMeta(b: Uint8Array, meta: ExportMeta | null | undefined): Uint8Array {
  if (!meta) return b;
  try {
    const desc = [meta.description, meta.contact].filter(Boolean).join(' · ');
    const rights = [meta.copyright, meta.license].filter(Boolean).join(' · ');
    const tiff = buildExifTiff([
      { tag: 0x010E, value: desc },          // ImageDescription
      { tag: 0x0131, value: meta.software }, // Software
      { tag: 0x013B, value: meta.author },   // Artist
      { tag: 0x8298, value: rights },        // Copyright
    ].filter(f => f.value));
    const xmp = buildExportXmp(meta);
    if (!tiff && !xmp) return b;
    return carryIntoWebp(b, tiff, xmp) ?? b;
  } catch {
    return b;
  }
}

// ── AVIF EXIF item insertion (plans/144, the recorded Wave 2 follow-up) ──────
//
// A HEIF-family still keeps EXIF as an ITEM: an `infe` entry in `iinf`, a
// location in `iloc`, and a `cdsc` reference to the primary image. Inserting
// one grows the `meta` box, which shifts every byte after it - so every
// file-absolute iloc offset past the old meta end is rewritten by the same
// delta. Writer-grade strictness, the inverse of file-metadata.ts's lenient
// reader: ANY structure this does not fully understand (64-bit box sizes, an
// iloc extent pointing inside meta, construction methods past idat, >4 GB
// extents, an existing Exif item) returns the input untouched. All or nothing.

interface AvifBox { type: string; start: number; payload: number; end: number }

/** Plain 8-byte-header box walk. Null on largesize/size-0 boxes - bail, never guess. */
function avifBoxes(bytes: Uint8Array, start: number, end: number): AvifBox[] | null {
  const out: AvifBox[] = [];
  let p = start;
  while (p + 8 <= end) {
    const size = ((bytes[p]! << 24) | (bytes[p + 1]! << 16) | (bytes[p + 2]! << 8) | bytes[p + 3]!) >>> 0;
    if (size < 8 || p + size > end) return null;
    out.push({
      type: String.fromCharCode(bytes[p + 4]!, bytes[p + 5]!, bytes[p + 6]!, bytes[p + 7]!),
      start: p, payload: p + 8, end: p + size,
    });
    p += size;
  }
  return p === end ? out : null;
}

const be16 = (v: number): number[] => [(v >> 8) & 0xff, v & 0xff];
const be32 = (v: number): number[] => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
const boxOf = (type: string, payload: number[]): number[] =>
  [...be32(8 + payload.length), type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3), ...payload];

interface IlocEntry { id: number; method: number; dataRef: number; extents: { offset: number; length: number }[] }

/** Parse an iloc box into entries with base offsets folded into the extents. */
function parseIloc(bytes: Uint8Array, iloc: AvifBox): { version: number; entries: IlocEntry[] } | null {
  const version = bytes[iloc.payload]!;
  if (version > 2) return null;
  let p = iloc.payload + 4;
  if (p + 2 > iloc.end) return null;
  const offsetSize = bytes[p]! >> 4, lengthSize = bytes[p]! & 0xf;
  const baseOffsetSize = bytes[p + 1]! >> 4;
  const indexSize = version >= 1 ? bytes[p + 1]! & 0xf : 0;
  for (const n of [offsetSize, lengthSize, baseOffsetSize, indexSize]) if (n !== 0 && n !== 4 && n !== 8) return null;
  p += 2;
  const readN = (at: number, n: number): number => {
    let out = 0;
    for (let i = 0; i < n; i++) out = out * 256 + bytes[at + i]!;
    return out;
  };
  const count = version === 2 ? readN(p, 4) : readN(p, 2);
  p += version === 2 ? 4 : 2;
  if (count > 4096) return null;
  const entries: IlocEntry[] = [];
  for (let i = 0; i < count; i++) {
    const idSize = version === 2 ? 4 : 2;
    if (p + idSize > iloc.end) return null;
    const id = readN(p, idSize);
    p += idSize;
    let method = 0;
    if (version >= 1) {
      if (p + 2 > iloc.end) return null;
      method = readN(p, 2) & 0xf;
      p += 2;
    }
    if (method > 1) return null; // construction from other items: out of scope
    if (p + 2 + baseOffsetSize + 2 > iloc.end) return null;
    const dataRef = readN(p, 2);
    p += 2;
    const base = readN(p, baseOffsetSize);
    p += baseOffsetSize;
    const extentCount = readN(p, 2);
    p += 2;
    if (extentCount > 64) return null;
    const extents: { offset: number; length: number }[] = [];
    for (let e = 0; e < extentCount; e++) {
      if (p + indexSize + offsetSize + lengthSize > iloc.end) return null;
      if (indexSize && readN(p, indexSize) !== 0) return null;
      p += indexSize;
      const offset = base + readN(p, offsetSize);
      p += offsetSize;
      const length = readN(p, lengthSize);
      p += lengthSize;
      if (offset > 0xffffffff || length > 0xffffffff) return null; // 4-byte re-emit below
      extents.push({ offset, length });
    }
    entries.push({ id, method, dataRef, extents });
  }
  return p === iloc.end ? { version, entries } : null;
}

/** Re-serialize an iloc: same version, normalized 4-byte offset/length fields. */
function emitIloc(version: number, entries: IlocEntry[]): number[] {
  const body: number[] = [version, 0, 0, 0, 0x44, 0x00]; // offset_size 4, length_size 4, base 0, index 0
  body.push(...(version === 2 ? be32(entries.length) : be16(entries.length)));
  for (const e of entries) {
    body.push(...(version === 2 ? be32(e.id) : be16(e.id)));
    if (version >= 1) body.push(...be16(e.method));
    body.push(...be16(e.dataRef));
    body.push(...be16(e.extents.length));
    for (const x of e.extents) body.push(...be32(x.offset), ...be32(x.length));
  }
  return boxOf('iloc', body);
}

/**
 * Stamp an ExportMeta into an AVIF as an EXIF item - the same fields
 * insertJpegExif writes, in HEIF's native slot. Best-effort with writer-grade
 * strictness: anything unusual returns the input untouched.
 */
export function insertAvifExif(bytes: Uint8Array, meta: ExportMeta | null | undefined): Uint8Array {
  if (!meta) return bytes;
  try {
    const desc = [meta.description, meta.contact].filter(Boolean).join(' · ');
    const rights = [meta.copyright, meta.license].filter(Boolean).join(' · ');
    const tiff = buildExifTiff([
      { tag: 0x010E, value: desc },
      { tag: 0x0131, value: meta.software },
      { tag: 0x013B, value: meta.author },
      { tag: 0x8298, value: rights },
    ].filter(f => f.value));
    if (!tiff) return bytes;

    if (bytes.length < 16 || String.fromCharCode(bytes[4]!, bytes[5]!, bytes[6]!, bytes[7]!) !== 'ftyp') return bytes;
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
    if (brand !== 'avif' && brand !== 'avis') return bytes;
    const top = avifBoxes(bytes, 0, bytes.length);
    const metaBox = top?.find((b) => b.type === 'meta');
    if (!top || !metaBox) return bytes;
    const inner = avifBoxes(bytes, metaBox.payload + 4, metaBox.end); // meta is a FullBox
    const iinf = inner?.find((b) => b.type === 'iinf');
    const iloc = inner?.find((b) => b.type === 'iloc');
    const pitm = inner?.find((b) => b.type === 'pitm');
    if (!inner || !iinf || !iloc || !pitm) return bytes;

    // Primary item id (pitm is a FullBox: u16 id at version 0, u32 at 1).
    const pitmV = bytes[pitm.payload]!;
    if (pitm.payload + 4 + (pitmV === 0 ? 2 : 4) > pitm.end) return bytes;
    const primaryId = pitmV === 0
      ? (bytes[pitm.payload + 4]! << 8) | bytes[pitm.payload + 5]!
      : readU32(bytes, pitm.payload + 4);

    // Existing item ids + an existing Exif item means nothing to do.
    const iinfV = bytes[iinf.payload]!;
    const infeListAt = iinf.payload + 4 + (iinfV === 0 ? 2 : 4);
    const infes = avifBoxes(bytes, infeListAt, iinf.end);
    if (!infes) return bytes;
    let maxId = primaryId;
    for (const infe of infes) {
      if (infe.type !== 'infe' || infe.end - infe.payload < 12) return bytes;
      const v = bytes[infe.payload]!;
      if (v !== 2) return bytes; // v3 (u32 ids) or older: out of scope, stay honest
      const id = (bytes[infe.payload + 4]! << 8) | bytes[infe.payload + 5]!;
      const type = String.fromCharCode(bytes[infe.payload + 8]!, bytes[infe.payload + 9]!, bytes[infe.payload + 10]!, bytes[infe.payload + 11]!);
      if (type === 'Exif') return bytes; // never duplicate a source's own item
      if (id > maxId) maxId = id;
    }
    const exifId = maxId + 1;
    if (exifId > 0xffff || primaryId > 0xffff) return bytes;

    const parsed = parseIloc(bytes, iloc);
    if (!parsed) return bytes;
    // A file-absolute extent inside the meta box itself cannot be re-based safely.
    for (const e of parsed.entries) {
      if (e.method === 0) {
        for (const x of e.extents) if (x.offset >= metaBox.start && x.offset < metaBox.end) return bytes;
      }
    }

    // New pieces. infe flags = 1 (hidden item), matching what HEIF writers emit.
    const newInfe = boxOf('infe', [2, 0, 0, 1, ...be16(exifId), 0, 0, 0x45, 0x78, 0x69, 0x66, 0]); // 'Exif' + NUL name
    const newIinf: number[] = (() => {
      const head = [...bytes.subarray(iinf.payload, infeListAt)];
      const countAt = 4; // after version/flags
      const count = iinfV === 0 ? (head[countAt]! << 8) | head[countAt + 1]! : readU32(Uint8Array.from(head), countAt);
      const bumped = count + 1;
      if (iinfV === 0) { head[countAt] = (bumped >> 8) & 0xff; head[countAt + 1] = bumped & 0xff; }
      else head.splice(countAt, 4, ...be32(bumped));
      return boxOf('iinf', [...head, ...bytes.subarray(infeListAt, iinf.end), ...newInfe]);
    })();
    const cdsc = boxOf('cdsc', [...be16(exifId), ...be16(1), ...be16(primaryId)]);
    const iref = inner.find((b) => b.type === 'iref');
    let newIref: number[];
    if (iref) {
      if (bytes[iref.payload]! !== 0) return bytes; // v1 iref uses u32 ids - out of scope
      newIref = boxOf('iref', [...bytes.subarray(iref.payload, iref.end), ...cdsc]);
    } else {
      newIref = boxOf('iref', [0, 0, 0, 0, ...cdsc]);
    }

    // Assemble the new meta box: original child order, iinf/iloc replaced in
    // place, iref replaced in place or appended after iinf. The iloc gets the
    // new entry now with a placeholder offset; the real offset needs the final
    // sizes, computed below, then patched in a second emit.
    const exifPayload = new Uint8Array(4 + 6 + tiff.length);
    exifPayload.set([0, 0, 0, 6, 0x45, 0x78, 0x69, 0x66, 0, 0], 0); // u32(6) + "Exif\0\0"
    exifPayload.set(tiff, 10);

    const buildMeta = (entries: IlocEntry[]): number[] => {
      const children: number[] = [];
      for (const child of inner) {
        if (child.type === 'iinf') {
          children.push(...newIinf);
          if (!iref) children.push(...newIref);
        } else if (child.type === 'iref' && iref) {
          children.push(...newIref);
        } else if (child.type === 'iloc') {
          children.push(...emitIloc(parsed.version, entries));
        } else {
          children.push(...bytes.subarray(child.start, child.end));
        }
      }
      return boxOf('meta', [...bytes.subarray(metaBox.payload, metaBox.payload + 4), ...children]);
    };

    // Two-pass sizing: sizes do not depend on offset VALUES (4-byte fields), so
    // pass 1's byte lengths are final; pass 2 fills the real offsets in.
    const draft = buildMeta([...parsed.entries, { id: exifId, method: 0, dataRef: 0, extents: [{ offset: 0, length: exifPayload.length }] }]);
    const delta = draft.length - (metaBox.end - metaBox.start);
    const exifFileOffset = bytes.length + delta + 8; // payload of the appended mdat
    const shifted: IlocEntry[] = parsed.entries.map((e) => ({
      ...e,
      extents: e.extents.map((x) => (e.method === 0 && x.offset >= metaBox.end ? { ...x, offset: x.offset + delta } : { ...x })),
    }));
    const finalMeta = buildMeta([...shifted, { id: exifId, method: 0, dataRef: 0, extents: [{ offset: exifFileOffset, length: exifPayload.length }] }]);
    if (finalMeta.length !== draft.length) return bytes;

    const mdat = boxOf('mdat', [...exifPayload]);
    const out = new Uint8Array(bytes.length + delta + mdat.length);
    out.set(bytes.subarray(0, metaBox.start), 0);
    out.set(finalMeta, metaBox.start);
    out.set(bytes.subarray(metaBox.end), metaBox.start + finalMeta.length);
    out.set(mdat, bytes.length + delta);
    return out;
  } catch {
    return bytes;
  }
}

/**
 * Carry a source image's descriptive metadata into a re-encoded output.
 * Returns the (possibly grown) output bytes plus a report of what carried and
 * what dropped - the report is never empty-handed about a drop. Best-effort:
 * any fault returns the output bytes untouched with whatever was reported.
 */
export function carryImageMetadata(
  src: CarrySource,
  out: CarryOutput,
  opts: CarryOpts = {},
): { bytes: Uint8Array; carried: MetaCarryReport } {
  const report: MetaCarryReport = { carried: [], dropped: [] };
  try {
    const meta = extractFileMetadata(src.bytes);
    const fields = pickCarryFields(meta);
    const gpsOn = opts.gps === true;

    // A credential's hard binding is to the source bytes; copying it across a
    // re-encode would fail verify. Report, never copy.
    if (extractC2paStore(src.bytes)) {
      report.dropped.push({ field: 'content credential', why: 'bound to the original bytes' });
    }
    if (meta.gps && !gpsOn) report.dropped.push({ field: 'location', why: 'off' });
    if (meta.fields.some((f) => f.group === 'capture' || f.group === 'device')) {
      report.dropped.push({ field: 'camera and capture details', why: 'not carried' });
    }

    let xmp = extractXmpPacket(src.bytes);
    if (xmp && !gpsOn && /GPS(Latitude|Longitude|Position|Coordinates)/i.test(xmp)) {
      xmp = null;
      report.dropped.push({ field: 'embedded metadata (XMP)', why: 'contains location (location off)' });
    }
    const gps = gpsOn ? meta.gps : undefined;
    const tiff = buildCarryExifTiff(fields, gps);
    if (!tiff && !xmp) return { bytes: out.bytes, carried: report };

    let result: Uint8Array | null = null;
    let xmpDropped = false;
    if (out.mime === 'image/jpeg') {
      const r = carryIntoJpeg(out.bytes, tiff, xmp);
      if (r) { result = r.bytes; xmpDropped = r.xmpDropped; }
    } else if (out.mime === 'image/png') {
      result = carryIntoPng(out.bytes, fields, tiff, xmp);
    } else if (out.mime === 'image/webp') {
      result = carryIntoWebp(out.bytes, tiff, xmp);
    } else {
      report.dropped.push({ field: 'metadata', why: `no carrier in ${out.mime}` });
      return { bytes: out.bytes, carried: report };
    }
    if (!result || result === out.bytes) {
      report.dropped.push({ field: 'metadata', why: 'could not be written to the output' });
      return { bytes: out.bytes, carried: report };
    }
    if (xmpDropped) report.dropped.push({ field: 'embedded metadata (XMP)', why: 'too large for the output format' });

    for (const spec of META_CARRY_FIELDS) if (fields[spec.key]) report.carried.push(spec.key);
    if (gps) report.carried.push('location');
    if (xmp && !xmpDropped) report.carried.push('embedded metadata (XMP)');
    return { bytes: result, carried: report };
  } catch {
    return { bytes: out.bytes, carried: report };
  }
}
