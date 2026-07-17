// ─── Embedded-metadata reader ────────────────────────────────────────────────
//
// Reads the metadata a file *carries* — EXIF, GPS, XMP, PNG text chunks, SVG
// authoring data — straight from its bytes, with no DOM and no dependencies.
// This is the "reveal" side of hidden data: what a file quietly discloses about
// the device, person, place, and software behind it. The /verify view surfaces
// it so a viewer sees exactly what they'd be sharing.
//
// This intentionally mirrors the byte-parsers in the strip-data tool's hook:
// tools run sandboxed and cannot import the engine, so that copy stays there and
// this typed one serves the shells. Best-effort throughout — a malformed block
// yields fewer fields, never an exception.
//
// PDF is deliberately NOT handled here (it needs a parser the shells already
// expose via host.pdf.analyze); this covers the raster + vector formats, plus
// the XMP packet in MP4/QuickTime video (the AI-declaration carrier there).

import { aiKind } from './c2pa-verify.ts';

export type MetaGroup =
  | 'location'
  | 'device'
  | 'capture'
  | 'software'
  | 'authorship'
  | 'timestamps'
  | 'description'
  | 'technical';

export interface MetaField {
  /** Human label, e.g. "Camera", "Coordinates". */
  label: string;
  /** Formatted, human-readable value. */
  value: string;
  /** Which section it belongs to. */
  group: MetaGroup;
  /** Personally identifying (GPS, serials, author names) — flagged for the viewer. */
  sensitive?: boolean;
}

export interface FileMetadata {
  /** Detected container, e.g. "JPEG", "PNG", "TIFF", "WebP", "SVG", "GIF" — '' if unknown. */
  format: string;
  /** Everything found, in discovery order; the view groups + orders them. */
  fields: MetaField[];
  /** Decimal degrees when the file records a GPS fix. */
  gps?: { lat: number; lon: number };
  /** A ready map link for the fix (OpenStreetMap; opened only if the viewer clicks). */
  mapUrl?: string;
  /**
   * AI provenance declared in BARE metadata — the IPTC `DigitalSourceType` XMP
   * tag generators write alongside their invisible pixel watermarks (Gemini/
   * Imagen next to SynthID, Midjourney, Meta AI, …) even when no C2PA manifest
   * is present. `credit` carries the accompanying credit line when one exists
   * (e.g. "Made with Google AI"). A sidecar tag, trivially stripped: presence
   * is a genuine declaration, absence proves nothing.
   */
  ai?: { kind: 'generated' | 'composite'; sourceType: string; credit?: string };
  /**
   * Bytes riding AFTER the image container ends (past PNG IEND / JPEG EOI) —
   * the most common "hidden payload in an image" pattern in the wild: appended
   * zips (polyglots), smuggled files, stego-loader configs. Deterministic and
   * always sized; `kind` is a best-effort sniff of what the payload is. Note
   * the legitimate case: motion photos (Samsung/Pixel) append an MP4 here.
   */
  appended?: { bytes: number; kind: string };
  /**
   * LSB steganalysis verdict — populated by pixel-capable SHELLS (the analysis
   * is pixel-domain, engine/src/steganalysis.ts; this byte reader can't decode
   * pixels). An amber heuristic, never proof.
   */
  lsb?: { suspicious: boolean; score: number };
}

// The order sections read top-to-bottom in a clinical layout.
export const META_GROUP_ORDER: MetaGroup[] = [
  'location', 'device', 'capture', 'software', 'authorship', 'timestamps', 'description', 'technical',
];

export const META_GROUP_LABEL: Record<MetaGroup, string> = {
  location: 'Location',
  device: 'Device',
  capture: 'Capture settings',
  software: 'Software',
  authorship: 'Authorship & rights',
  timestamps: 'Timestamps',
  description: 'Description & text',
  technical: 'Technical',
};

// ── Format sniff ──────────────────────────────────────────────────────────────

function sniff(b: Uint8Array): string {
  if (b.length < 4) return '';
  if (b[0] === 0xff && b[1] === 0xd8) return 'JPEG';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'PNG';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'GIF';
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
      (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)) return 'TIFF';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b.length >= 12 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'WebP';
  // ISO BMFF video (mp4/m4v/mov) — an ftyp box first; 'qt  ' brand is QuickTime.
  if (b.length >= 12 && matchAscii(b, 4, 'ftyp')) return matchAscii(b, 8, 'qt  ') ? 'QuickTime' : 'MP4';
  // SVG (and other XML) — decode a small prefix and look for the root element.
  const head = new TextDecoder('utf-8').decode(b.subarray(0, Math.min(b.length, 512)));
  if (/<svg[\s>]/i.test(head) || (/^\s*<\?xml/i.test(head) && /<svg[\s>]/i.test(new TextDecoder().decode(b.subarray(0, Math.min(b.length, 4096)))))) return 'SVG';
  return '';
}

// ── Little byte helpers ─────────────────────────────────────────────────────────

function matchAscii(b: Uint8Array, off: number, str: string): boolean {
  for (let i = 0; i < str.length; i++) if (b[off + i] !== str.charCodeAt(i)) return false;
  return true;
}

// Bounds for hostile input: this reader feeds a DOM view, so both the NUMBER of
// fields (a PNG can carry a million tiny tEXt chunks) and each field's LENGTH
// (a TIFF ASCII tag can declare the whole file as its value) are capped. Well
// above anything a real camera/editor writes; purely a display-layer defence.
const MAX_FIELDS = 64;
const MAX_VALUE_CHARS = 2048;
// XMP packets and SVG sources are scanned as text; cap the scan so a
// gigabyte-scale input can't balloon into string work (best-effort reader).
const MAX_TEXT_SCAN = 16 * 1024 * 1024;

function clip(s: string): string {
  return s.length > MAX_VALUE_CHARS ? s.slice(0, MAX_VALUE_CHARS) + '…' : s;
}

// ── EXIF / TIFF ─────────────────────────────────────────────────────────────────
// Offsets inside a TIFF block are relative to the TIFF header, so the DataView is
// anchored there. Tag numbers per EXIF 2.3.

interface IfdEntry { tag: number; type: number; count: number; size: number; valueOffset: number; le: boolean; }

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function readIfd(dv: DataView, off: number, le: boolean): IfdEntry[] {
  const out: IfdEntry[] = [];
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

function asciiVal(dv: DataView, e: IfdEntry): string | null {
  if (e.type !== 2) return null;
  let s = '';
  // A hostile TIFF can declare the whole file as one ASCII tag — cap the value.
  const max = Math.min(e.count, MAX_VALUE_CHARS);
  for (let i = 0; i < max; i++) {
    const off = e.valueOffset + i;
    if (off >= dv.byteLength) break;
    const c = dv.getUint8(off);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.trim() || null;
}

function scalar(dv: DataView, e: IfdEntry): number | null {
  try {
    if (e.type === 3) return dv.getUint16(e.valueOffset, e.le);
    if (e.type === 4) return dv.getUint32(e.valueOffset, e.le);
    if (e.type === 5) {
      if (e.valueOffset + 8 > dv.byteLength) return null;
      const num = dv.getUint32(e.valueOffset, e.le), den = dv.getUint32(e.valueOffset + 4, e.le);
      return den ? num / den : 0;
    }
  } catch { /* out of range */ }
  return null;
}

function rationals(dv: DataView, e: IfdEntry, want: number): number[] | null {
  if (e.type !== 5) return null;
  const out: number[] = [];
  for (let i = 0; i < Math.min(e.count, want); i++) {
    const o = e.valueOffset + i * 8;
    if (o + 8 > dv.byteLength) return null;
    const num = dv.getUint32(o, e.le), den = dv.getUint32(o + 4, e.le);
    out.push(den ? num / den : 0);
  }
  return out.length === want ? out : null;
}

const ORIENTATION: Record<number, string> = {
  1: 'Normal', 2: 'Mirrored horizontally', 3: 'Rotated 180°', 4: 'Mirrored vertically',
  5: 'Mirrored + rotated 270° CW', 6: 'Rotated 90° CW', 7: 'Mirrored + rotated 90° CW', 8: 'Rotated 270° CW',
};

function round(n: number, dp = 1): string {
  return (Math.round(n * 10 ** dp) / 10 ** dp).toString();
}

function readGps(dv: DataView, off: number, le: boolean): { lat: number; lon: number; alt?: number } | null {
  let latRef: string | null = null, lonRef: string | null = null;
  let lat: number[] | null = null, lon: number[] | null = null;
  let alt: number | null = null, altRef = 0;
  for (const e of readIfd(dv, off, le)) {
    if (e.tag === 0x0001) latRef = asciiVal(dv, e);
    else if (e.tag === 0x0003) lonRef = asciiVal(dv, e);
    else if (e.tag === 0x0002) lat = rationals(dv, e, 3);
    else if (e.tag === 0x0004) lon = rationals(dv, e, 3);
    else if (e.tag === 0x0005) altRef = dv.getUint8(e.valueOffset);
    else if (e.tag === 0x0006) { const a = rationals(dv, e, 1); if (a) alt = a[0]!; }
  }
  if (!lat || !lon) return null;
  const dec = (dms: number[], ref: string | null): number => {
    const d = dms[0]! + dms[1]! / 60 + dms[2]! / 3600;
    return (ref === 'S' || ref === 'W') ? -d : d;
  };
  const r: { lat: number; lon: number; alt?: number } = { lat: dec(lat, latRef), lon: dec(lon, lonRef) };
  if (alt != null) r.alt = altRef === 1 ? -alt : alt;
  return r;
}

// Walk a TIFF/EXIF block (IFD0 → ExifSubIFD → GPS IFD) into fields.
function readExif(bytes: Uint8Array, base: number, len: number, out: FileMetadata): void {
  if (len < 8 || base < 0 || base + len > bytes.length) return;
  let dv: DataView;
  try { dv = new DataView(bytes.buffer, bytes.byteOffset + base, len); } catch { return; }
  const b0 = dv.getUint8(0), b1 = dv.getUint8(1);
  let le: boolean;
  if (b0 === 0x49 && b1 === 0x49) le = true;
  else if (b0 === 0x4d && b1 === 0x4d) le = false;
  else return;
  if (dv.getUint16(2, le) !== 42) return;

  const push = (label: string, value: string | null | undefined, group: MetaGroup, sensitive = false): void => {
    if (value == null || value === '') return;
    out.fields.push({ label, value, group, sensitive });
  };

  const ifd0 = readIfd(dv, dv.getUint32(4, le), le);
  const byTag = new Map<number, IfdEntry>();
  for (const e of ifd0) byTag.set(e.tag, e);

  const make = byTag.has(0x010f) ? asciiVal(dv, byTag.get(0x010f)!) : null;
  const model = byTag.has(0x0110) ? asciiVal(dv, byTag.get(0x0110)!) : null;
  push('Camera', [make, model].filter(Boolean).join(' ') || null, 'device', true);
  push('Software', byTag.has(0x0131) ? asciiVal(dv, byTag.get(0x0131)!) : null, 'software');
  push('Artist', byTag.has(0x013b) ? asciiVal(dv, byTag.get(0x013b)!) : null, 'authorship', true);
  push('Copyright', byTag.has(0x8298) ? asciiVal(dv, byTag.get(0x8298)!) : null, 'authorship');
  push('Image description', byTag.has(0x010e) ? asciiVal(dv, byTag.get(0x010e)!) : null, 'description');
  push('Modified', byTag.has(0x0132) ? asciiVal(dv, byTag.get(0x0132)!) : null, 'timestamps');
  if (byTag.has(0x0112)) {
    const o = scalar(dv, byTag.get(0x0112)!);
    if (o != null && ORIENTATION[o]) push('Orientation', ORIENTATION[o]!, 'technical');
  }

  // ExifSubIFD — the shooting data.
  const exifPtr = byTag.get(0x8769);
  if (exifPtr) {
    const sub = new Map<number, IfdEntry>();
    for (const e of readIfd(dv, scalar(dv, exifPtr) ?? 0, le)) sub.set(e.tag, e);
    const et = sub.has(0x829a) ? scalar(dv, sub.get(0x829a)!) : null;
    if (et != null && et > 0) push('Exposure', et < 1 ? `1/${Math.round(1 / et)} s` : `${round(et)} s`, 'capture');
    const fn = sub.has(0x829d) ? scalar(dv, sub.get(0x829d)!) : null;
    if (fn != null && fn > 0) push('Aperture', `f/${round(fn)}`, 'capture');
    const iso = sub.has(0x8827) ? scalar(dv, sub.get(0x8827)!) : null;
    if (iso != null && iso > 0) push('ISO', `ISO ${iso}`, 'capture');
    const fl = sub.has(0x920a) ? scalar(dv, sub.get(0x920a)!) : null;
    if (fl != null && fl > 0) push('Focal length', `${round(fl)} mm`, 'capture');
    push('Taken', sub.has(0x9003) ? asciiVal(dv, sub.get(0x9003)!) : null, 'timestamps');
    push('Lens', [
      sub.has(0xa433) ? asciiVal(dv, sub.get(0xa433)!) : null,
      sub.has(0xa434) ? asciiVal(dv, sub.get(0xa434)!) : null,
    ].filter(Boolean).join(' ') || null, 'device');
    push('Camera serial', sub.has(0xa431) ? asciiVal(dv, sub.get(0xa431)!) : null, 'device', true);
    const px = sub.has(0xa002) ? scalar(dv, sub.get(0xa002)!) : null;
    const py = sub.has(0xa003) ? scalar(dv, sub.get(0xa003)!) : null;
    if (px && py) push('Dimensions', `${px} × ${py} px`, 'technical');
  }

  // GPS.
  const gpsPtr = byTag.get(0x8825);
  if (gpsPtr) {
    const g = readGps(dv, scalar(dv, gpsPtr) ?? 0, le);
    if (g) {
      out.gps = { lat: g.lat, lon: g.lon };
      out.mapUrl = `https://www.openstreetmap.org/?mlat=${g.lat.toFixed(6)}&mlon=${g.lon.toFixed(6)}#map=15/${g.lat.toFixed(5)}/${g.lon.toFixed(5)}`;
      push('Coordinates', `${g.lat.toFixed(6)}, ${g.lon.toFixed(6)}`, 'location', true);
      if (g.alt != null) push('Altitude', `${round(g.alt)} m`, 'location', true);
    }
  }
}

// ── XMP (best-effort regex over the packet; no XML DOM) ──────────────────────────

function readXmp(text: string, out: FileMetadata): void {
  const grab = (re: RegExp): string | null => {
    const m = re.exec(text);
    if (!m) return null;
    const t = clip((m[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    return t || null;
  };
  const tool = grab(/xmp:CreatorTool>\s*([\s\S]*?)<\/xmp:CreatorTool>/i)
    || grab(/xmp:CreatorTool=["']([^"']+)["']/i);
  if (tool && !out.fields.some((f) => f.group === 'software' && f.value === tool)) {
    out.fields.push({ label: 'Created with', value: tool, group: 'software' });
  }
  const creator = grab(/<dc:creator>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i)
    || grab(/<dc:creator>([\s\S]*?)<\/dc:creator>/i);
  if (creator) out.fields.push({ label: 'Creator', value: creator, group: 'authorship', sensitive: true });
  const rights = grab(/<dc:rights>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i)
    || grab(/<dc:rights>([\s\S]*?)<\/dc:rights>/i);
  if (rights) out.fields.push({ label: 'Rights', value: rights, group: 'authorship' });

  // Credit line (photoshop:Credit) — where AI generators identify themselves in
  // prose ("Made with Google AI", "Imagined with AI").
  const credit = grab(/[\w-]+:Credit>\s*([\s\S]*?)<\/[\w-]+:Credit>/i)
    || grab(/[\w-]+:Credit\s*=\s*["']([^"']+)["']/i);
  if (credit && !out.fields.some((f) => f.label === 'Credit')) {
    out.fields.push({ label: 'Credit', value: credit, group: 'authorship' });
  }

  // IPTC DigitalSourceType (Iptc4xmpExt namespace, but prefixes vary) — the
  // standard machine-readable "how these pixels came to be" declaration, and
  // the sidecar AI flag written by Gemini/Imagen, Midjourney, Meta AI, …
  const dst = grab(/[\w-]+:DigitalSourceType\s*>\s*([^<\s]+?)\s*</i)
    || grab(/[\w-]+:DigitalSourceType\s*=\s*["']([^"']+)["']/i);
  if (dst) {
    const slug = dst.split('/').pop() ?? dst;
    if (!out.fields.some((f) => f.label === 'Digital source type')) {
      out.fields.push({ label: 'Digital source type', value: slug, group: 'software' });
    }
    // Full-AI ("generated") outranks the mixed-in ("composite") case, matching
    // the C2PA-side precedence in c2pa-verify.ts.
    const kind = aiKind(dst);
    if (kind && (!out.ai || (kind === 'generated' && out.ai.kind === 'composite'))) {
      out.ai = { kind, sourceType: dst, credit: credit ?? out.ai?.credit };
    }
  }
  if (out.ai && !out.ai.credit && credit) out.ai.credit = credit;
}

// ── Appended payloads (bytes after the container ends) ───────────────────────────

// Best-effort sniff of what a trailing payload is. Neutral wording — a motion
// photo's appended MP4 is legitimate and common; a zip/executable is the
// smuggling pattern worth flagging loudly.
function sniffAppended(b: Uint8Array, off: number): string {
  const at = (o: number, s: string): boolean => matchAscii(b, off + o, s);
  if (at(0, 'PK\x03\x04') || at(0, 'PK\x05\x06')) return 'zip archive';
  if (b[off] === 0x1f && b[off + 1] === 0x8b) return 'gzip data';
  if (at(0, 'Rar!')) return 'RAR archive';
  if (at(0, '%PDF')) return 'PDF document';
  if (at(4, 'ftyp')) return 'video (motion photo)';
  if (b[off] === 0xff && b[off + 1] === 0xd8) return 'JPEG image';
  if (b[off] === 0x89 && at(1, 'PNG')) return 'PNG image';
  if (at(0, 'GIF8')) return 'GIF image';
  if (at(0, 'MZ')) return 'Windows executable';
  if (b[off] === 0x7f && at(1, 'ELF')) return 'ELF executable';
  let printable = 0;
  const scan = Math.min(256, b.length - off);
  for (let i = 0; i < scan; i++) {
    const c = b[off + i]!;
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127)) printable++;
  }
  return scan > 0 && printable / scan > 0.9 ? 'text' : 'binary data';
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// Record a trailing payload of `len` bytes starting at `off`.
function noteAppended(bytes: Uint8Array, off: number, out: FileMetadata): void {
  const len = bytes.length - off;
  if (len <= 0) return;
  const kind = sniffAppended(bytes, off);
  out.appended = { bytes: len, kind };
  out.fields.push({
    label: 'Appended data',
    value: `${kind} — ${fmtBytes(len)} after the image ends`,
    group: 'technical',
    sensitive: kind !== 'video (motion photo)',
  });
}

// Find the true end of a JPEG's entropy-coded data: from the first SOS scan,
// FF D9 cannot legitimately appear INSIDE scan data (FF bytes are stuffed as
// FF 00; only RST markers FF D0–D7 are allowed), so the first real EOI marker
// ends the image. Marker segments BETWEEN progressive scans are skipped via
// their length fields (a Huffman table may legally contain the bytes FF D9).
// Returns the offset just past EOI, or null when the structure runs out.
function jpegEnd(bytes: Uint8Array, scanStart: number): number | null {
  let q = scanStart;
  while (q + 1 < bytes.length) {
    if (bytes[q] !== 0xff) { q++; continue; }
    const m = bytes[q + 1]!;
    if (m === 0xff) { q++; continue; }                    // fill byte
    if (m === 0x00 || (m >= 0xd0 && m <= 0xd7)) { q += 2; continue; } // stuffed / RST
    if (m === 0xd9) return q + 2;                          // EOI
    if (m === 0x01) { q += 2; continue; }                  // TEM — standalone
    if (q + 4 > bytes.length) return null;
    const len = ((bytes[q + 2]! << 8) | bytes[q + 3]!);    // next scan's header segment
    if (len < 2) return null;
    q += 2 + len;
  }
  return null;
}

// ── JPEG ─────────────────────────────────────────────────────────────────────────

function readJpeg(bytes: Uint8Array, out: FileMetadata): void {
  let p = 2;
  let xmp = '';
  while (p + 4 <= bytes.length && out.fields.length < MAX_FIELDS) {
    if (bytes[p] !== 0xff) break;
    let marker = bytes[p + 1]!;
    while (marker === 0xff && p + 2 < bytes.length) { p++; marker = bytes[p + 1]!; }
    if (marker === 0xda || marker === 0xd9) {
      // Metadata segments end here. Locate the true end-of-image so bytes
      // smuggled AFTER the EOI marker get surfaced as an appended payload.
      const end = marker === 0xd9 ? p + 2
        : p + 4 <= bytes.length ? jpegEnd(bytes, p + 2 + ((bytes[p + 2]! << 8) | bytes[p + 3]!)) : null;
      if (end != null) noteAppended(bytes, end, out);
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { p += 2; continue; }
    const len = (bytes[p + 2]! << 8) | bytes[p + 3]!;
    if (len < 2 || p + 2 + len > bytes.length) break;
    const dataStart = p + 4, dataLen = len - 2;
    if (marker === 0xe1) {
      if (matchAscii(bytes, dataStart, 'Exif\0\0')) readExif(bytes, dataStart + 6, dataLen - 6, out);
      else if (matchAscii(bytes, dataStart, 'http://ns.adobe.com/xap/') && xmp.length < MAX_TEXT_SCAN) {
        xmp += new TextDecoder('utf-8').decode(bytes.subarray(dataStart, dataStart + dataLen));
      }
    } else if (marker === 0xe2 && matchAscii(bytes, dataStart, 'ICC_PROFILE\0')) {
      if (!out.fields.some((f) => f.label === 'ICC colour profile')) {
        out.fields.push({ label: 'ICC colour profile', value: 'embedded profile', group: 'technical' });
      }
    } else if (marker === 0xed) {
      out.fields.push({ label: 'IPTC / Photoshop', value: 'caption & author data', group: 'authorship' });
    } else if (marker === 0xfe) {
      const c = clip(new TextDecoder('utf-8').decode(bytes.subarray(dataStart, dataStart + dataLen)).trim());
      if (c) out.fields.push({ label: 'Comment', value: c, group: 'description' });
    }
    p += 2 + len;
  }
  if (xmp) readXmp(xmp, out);
}

// ── PNG ────────────────────────────────────────────────────────────────────────

const PNG_KEYWORD_GROUP: Record<string, { group: MetaGroup; sensitive?: boolean }> = {
  Software: { group: 'software' },
  Author: { group: 'authorship', sensitive: true },
  Artist: { group: 'authorship', sensitive: true },
  Copyright: { group: 'authorship' },
  Title: { group: 'description' },
  Description: { group: 'description' },
  Comment: { group: 'description' },
  Source: { group: 'software' },
  'Creation Time': { group: 'timestamps' },
};

function pngText(bytes: Uint8Array, start: number, len: number, kind: 'tEXt' | 'iTXt', out: FileMetadata): void {
  // keyword \0 [flags/lang for iTXt] text
  let nul = start;
  const end = start + len;
  while (nul < end && bytes[nul] !== 0) nul++;
  if (nul >= end) return;
  const keyword = new TextDecoder('latin1').decode(bytes.subarray(start, nul));
  let textStart = nul + 1;
  if (kind === 'iTXt') {
    // compressionFlag(1) compressionMethod(1) langTag \0 translatedKeyword \0 text
    const compressed = bytes[textStart] === 1;
    textStart += 2;
    let z = textStart; while (z < end && bytes[z] !== 0) z++; textStart = z + 1; // langTag
    z = textStart; while (z < end && bytes[z] !== 0) z++; textStart = z + 1;      // translatedKeyword
    if (compressed) { out.fields.push({ label: keyword || 'Text', value: 'compressed text chunk', group: 'description' }); return; }
  }
  if (textStart >= end) return;
  // An XMP packet rides in an iTXt chunk under this reserved keyword (XMP spec
  // part 3) — PNG is where Midjourney/Google AI outputs carry their AI
  // declaration. Parse it as XMP instead of dumping the raw packet as prose.
  if (keyword === 'XML:com.adobe.xmp') {
    const packetEnd = Math.min(end, textStart + MAX_TEXT_SCAN);
    readXmp(new TextDecoder('utf-8').decode(bytes.subarray(textStart, packetEnd)), out);
    return;
  }
  const value = clip(new TextDecoder(kind === 'iTXt' ? 'utf-8' : 'latin1').decode(bytes.subarray(textStart, Math.min(end, textStart + MAX_VALUE_CHARS * 4))).trim());
  if (!value) return;
  const m = PNG_KEYWORD_GROUP[keyword] ?? { group: 'description' as MetaGroup };
  out.fields.push({ label: keyword || 'Text', value, group: m.group, sensitive: m.sensitive });
}

function readPng(bytes: Uint8Array, out: FileMetadata): void {
  let p = 8;
  while (p + 8 <= bytes.length && out.fields.length < MAX_FIELDS) {
    const len = ((bytes[p]! << 24) | (bytes[p + 1]! << 16) | (bytes[p + 2]! << 8) | bytes[p + 3]!) >>> 0;
    const type = String.fromCharCode(bytes[p + 4]!, bytes[p + 5]!, bytes[p + 6]!, bytes[p + 7]!);
    const dataStart = p + 8;
    const end = dataStart + len;
    if (end + 4 > bytes.length && type !== 'IEND') break;
    if (type === 'eXIf') readExif(bytes, dataStart, len, out);
    else if (type === 'tEXt') pngText(bytes, dataStart, len, 'tEXt', out);
    else if (type === 'iTXt') pngText(bytes, dataStart, len, 'iTXt', out);
    else if (type === 'zTXt') out.fields.push({ label: 'Compressed text', value: 'zTXt chunk', group: 'description' });
    else if (type === 'tIME') out.fields.push({ label: 'Last modified', value: 'embedded timestamp', group: 'timestamps' });
    p = end + 4;
    if (type === 'IEND') { noteAppended(bytes, p, out); break; }
  }
}

// ── WebP (RIFF) ──────────────────────────────────────────────────────────────────

function readWebp(bytes: Uint8Array, out: FileMetadata): void {
  let p = 12; // past "RIFF"<size>"WEBP"
  while (p + 8 <= bytes.length && out.fields.length < MAX_FIELDS) {
    const fourcc = String.fromCharCode(bytes[p]!, bytes[p + 1]!, bytes[p + 2]!, bytes[p + 3]!);
    const size = (bytes[p + 4]! | (bytes[p + 5]! << 8) | (bytes[p + 6]! << 16) | (bytes[p + 7]! * 0x1000000)) >>> 0;
    const dataStart = p + 8;
    if (dataStart + size > bytes.length) break;
    if (fourcc === 'EXIF') {
      const off = matchAscii(bytes, dataStart, 'Exif\0\0') ? dataStart + 6 : dataStart;
      readExif(bytes, off, dataStart + size - off, out);
    } else if (fourcc === 'XMP ') {
      readXmp(new TextDecoder('utf-8').decode(bytes.subarray(dataStart, dataStart + size)), out);
    }
    p = dataStart + size + (size & 1); // chunks are padded to even length
  }
}

// ── MP4 / QuickTime (ISO BMFF) ───────────────────────────────────────────────────
// Videos carry their XMP packet in a top-level `uuid` box with a fixed UUID
// (XMP spec part 3, MPEG-4). That packet is where AI generators declare their
// output (IPTC DigitalSourceType) — the video-side analogue of the JPEG/PNG
// path above. Only top-level boxes are walked; media payloads are skipped.
const XMP_BOX_UUID = [0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71, 0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac];

function readBmff(bytes: Uint8Array, out: FileMetadata): void {
  let p = 0;
  while (p + 8 <= bytes.length && out.fields.length < MAX_FIELDS) {
    let size = (((bytes[p]! << 24) | (bytes[p + 1]! << 16) | (bytes[p + 2]! << 8) | bytes[p + 3]!) >>> 0);
    const type = String.fromCharCode(bytes[p + 4]!, bytes[p + 5]!, bytes[p + 6]!, bytes[p + 7]!);
    let header = 8;
    if (size === 1) {
      // 64-bit largesize (routine for a big mdat) — read it and keep walking.
      if (p + 16 > bytes.length) return;
      size = (((bytes[p + 8]! << 24) | (bytes[p + 9]! << 16) | (bytes[p + 10]! << 8) | bytes[p + 11]!) >>> 0) * 0x1_0000_0000
        + (((bytes[p + 12]! << 24) | (bytes[p + 13]! << 16) | (bytes[p + 14]! << 8) | bytes[p + 15]!) >>> 0);
      header = 16;
    } else if (size === 0) {
      size = bytes.length - p; // "to end of file" (last box only)
    }
    if (size < header || size > bytes.length - p) return; // truncated / hostile
    if (type === 'uuid' && size >= header + 16
        && XMP_BOX_UUID.every((v, i) => bytes[p + header + i] === v)) {
      const start = p + header + 16;
      const end = Math.min(p + size, start + MAX_TEXT_SCAN);
      readXmp(new TextDecoder('utf-8').decode(bytes.subarray(start, end)), out);
    }
    p += size;
  }
}

// ── SVG (text; targeted extraction) ───────────────────────────────────────────────

function readSvg(bytes: Uint8Array, out: FileMetadata): void {
  // Best-effort by design: scan at most the leading window so a gigabyte-scale
  // "SVG" can't balloon into string/regex work. Real authoring metadata sits at
  // the top of the file.
  const text = new TextDecoder('utf-8').decode(bytes.length > MAX_TEXT_SCAN ? bytes.subarray(0, MAX_TEXT_SCAN) : bytes);
  const clean = (s: string | undefined): string | null => s ? clip(s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) || null : null;

  let editor: string | null = null;
  const gen = /<!--[^>]*Generator:\s*([^\n]*?)(?:-->|SVG (?:Export|Version))/i.exec(text);
  if (gen) editor = clean(gen[1])?.replace(/[,;]\s*$/, '') ?? null;
  const ink = /inkscape:version=["']([^"']+)["']/i.exec(text);
  if (!editor && ink) editor = `Inkscape ${(ink[1] || '').split(' ')[0]}`;
  if (!editor && /xmlns:sketch=/i.test(text)) editor = 'Sketch';
  if (!editor && /xmlns:figma=/i.test(text)) editor = 'Figma';
  if (editor) out.fields.push({ label: 'Created with', value: editor, group: 'software', sensitive: true });

  const doc = /sodipodi:docname=["']([^"']+)["']/i.exec(text);
  if (doc) out.fields.push({ label: 'Original filename', value: doc[1]!, group: 'description', sensitive: true });

  const title = clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(text)?.[1]);
  if (title) out.fields.push({ label: 'Title', value: title, group: 'description' });
  const desc = clean(/<desc[^>]*>([\s\S]*?)<\/desc>/i.exec(text)?.[1]);
  if (desc) out.fields.push({ label: 'Description', value: desc, group: 'description' });

  readXmp(text, out); // dc:creator / dc:rights / CreatorTool inside <metadata>

  if (/[A-Za-z]:\\|\/Users\/|\/home\//.test(text)) {
    out.fields.push({ label: 'Local file path', value: 'a path is embedded in a comment', group: 'description', sensitive: true });
  }
  const imgs = (text.match(/(?:href|xlink:href)\s*=\s*["']data:image\//gi) || []).length;
  if (imgs) out.fields.push({ label: 'Embedded images', value: `${imgs} image${imgs > 1 ? 's' : ''}`, group: 'technical' });
}

// ── Entry point ───────────────────────────────────────────────────────────────────

/**
 * Read embedded metadata from a file's bytes. Never throws; unknown or metadata-free
 * files return an empty `fields` list. PDF is not handled here — use host.pdf.analyze.
 */
export function extractFileMetadata(bytes: Uint8Array): FileMetadata {
  const out: FileMetadata = { format: '', fields: [] };
  try {
    out.format = sniff(bytes);
    switch (out.format) {
      case 'JPEG': readJpeg(bytes, out); break;
      case 'PNG': readPng(bytes, out); break;
      case 'WebP': readWebp(bytes, out); break;
      case 'TIFF': readExif(bytes, 0, bytes.length, out); break;
      case 'SVG': readSvg(bytes, out); break;
      case 'MP4': case 'QuickTime': readBmff(bytes, out); break;
      // GIF and others carry little structured metadata worth surfacing.
    }
  } catch { /* best-effort: return whatever was gathered before the fault */ }
  return out;
}
