// SPDX-License-Identifier: MPL-2.0
// ─── Embedded-metadata reader ────────────────────────────────────────────────
//
// Reads the metadata a file *carries* - EXIF, GPS, XMP, PNG text chunks, SVG
// authoring data - straight from its bytes, with no DOM and no dependencies.
// This extracts the hidden data a file discloses about the device, person,
// place, and software that created it. The /verify view shows this to a
// viewer so they see exactly what they would be sharing.
//
// This intentionally mirrors the byte-parsers in the strip-data tool's hook:
// tools run sandboxed and cannot import the engine, so that copy stays there and
// this typed one serves the shells. Best-effort throughout - a malformed block
// yields fewer fields, never an exception.
//
// PDF is deliberately NOT handled here (it needs a parser the shells already
// expose via host.pdf.analyze); this covers the raster + vector formats, plus
// the XMP packet in MP4/QuickTime video (the AI-declaration carrier there).

import { aiKind } from './c2pa-verify.ts';
import { JPEG_APP_IDS, scanJpegSegments } from './jpeg-segments.ts';

export type MetaGroup =
  | 'location'
  | 'device'
  | 'capture'
  | 'software'
  | 'authorship'
  | 'timestamps'
  | 'description'
  /** What a container CARRIES and DOES - attachments, scripts, actions, form
   *  values, hidden layers. Populated for PDFs by the shell's structural scan;
   *  distinct from 'technical', which describes the encoding rather than the
   *  payload. */
  | 'structure'
  | 'technical';

export interface MetaField {
  /** Human label, e.g. "Camera", "Coordinates". */
  label: string;
  /** Formatted, human-readable value. */
  value: string;
  /** Which section it belongs to. */
  group: MetaGroup;
  /** Personally identifying (GPS, serials, author names) - flagged for the viewer. */
  sensitive?: boolean;
}

export interface FileMetadata {
  /** Detected container, e.g. "JPEG", "PNG", "TIFF", "WebP", "SVG", "GIF" - '' if unknown. */
  format: string;
  /** Everything found, in discovery order; the view groups + orders them. */
  fields: MetaField[];
  /** Decimal degrees when the file records a GPS fix. */
  gps?: { lat: number; lon: number };
  /** A ready map link for the fix (OpenStreetMap; opened only if the viewer clicks). */
  mapUrl?: string;
  /**
   * AI provenance declared in BARE metadata - the IPTC `DigitalSourceType` XMP
   * tag generators write alongside their invisible pixel watermarks (Gemini/
   * Imagen next to SynthID, Midjourney, Meta AI, …) even when no C2PA manifest
   * is present. `credit` carries the accompanying credit line when one exists
   * (e.g. "Made with Google AI"). A sidecar tag, trivially stripped: presence
   * is a genuine declaration, absence proves nothing.
   */
  ai?: { kind: 'generated' | 'composite'; sourceType: string; credit?: string };
  /**
   * Bytes that come AFTER the image container ends (past PNG IEND / JPEG EOI /
   * GIF trailer) - the most common "hidden payload in an image" pattern:
   * appended zips (polyglots), smuggled files, stego-loader
   * configs. Deterministic and always sized; `kind` is a best-effort sniff
   * of what the payload is, `offset` is the exact byte index it starts at
   * (so a caller can slice the original bytes to extract it). Note the
   * legitimate cases: motion photos (Samsung/Pixel) append an MP4 here, and a
   * multi-picture JPEG - an HDR gain-map file (ours included) or an MPO - keeps
   * its second image here and DECLARES it in an MPF index. Both are reported
   * with a `kind` that names them and without the `sensitive` flag; see
   * {@link readMpfIndex}.
   *
   * `declared` is set when the CONTAINER ITSELF accounts for the bytes (today:
   * an MPF index naming their offset and length). Read it through
   * {@link appendedIsExpected} rather than re-deriving "is this the legitimate
   * case" from `kind`, which is how the verify view's warning pip and this
   * module's `sensitive` flag drifted apart.
   */
  appended?: { bytes: number; kind: string; offset: number; declared?: boolean };
  /**
   * LSB steganalysis verdict - populated by pixel-capable SHELLS (the analysis
   * is pixel-domain, engine/src/steganalysis.ts; this byte reader can't decode
   * pixels). An amber heuristic, never proof.
   */
  lsb?: { suspicious: boolean; score: number };
  /**
   * Maker-pipeline fingerprint read from container internals (BMFF handler
   * strings + encoder tags). `signature: 'ai-download'` means the markers match
   * the packaging a vendor's AI products write on the files they deliver
   * (Gemini / Veo video, Gemini / NotebookLM audio) - a fingerprint OF the
   * pipeline, not a declaration BY it: other services sharing the vendor's
   * muxer can leave the same trace, so a viewer must see this as a signal,
   * never a verdict. `reencode` is the vendor's dated server-transcode variant
   * (the classic YouTube handler note), which says nothing about AI origin.
   * `markers` holds the literal matched strings so a view can show evidence.
   */
  producer?: MediaProducer;
}

export interface MediaProducer {
  vendor: string;
  signature: 'ai-download' | 'reencode';
  /** Human hint at which products package files this way, e.g. "Gemini or Veo". */
  hint: string;
  markers: string[];
}

// The order sections read top-to-bottom in a plain layout.
export const META_GROUP_ORDER: MetaGroup[] = [
  'location', 'device', 'capture', 'software', 'authorship', 'timestamps', 'description', 'structure', 'technical',
];

export const META_GROUP_LABEL: Record<MetaGroup, string> = {
  location: 'Location',
  device: 'Device',
  capture: 'Capture settings',
  software: 'Software',
  authorship: 'Authorship & rights',
  timestamps: 'Timestamps',
  description: 'Description & text',
  structure: 'Embedded content & behaviour',
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
  // ISO BMFF video (mp4/m4v/mov) - an ftyp box first; 'qt  ' brand is QuickTime.
  if (b.length >= 12 && matchAscii(b, 4, 'ftyp')) return matchAscii(b, 8, 'qt  ') ? 'QuickTime' : 'MP4';
  // SVG (and other XML) - decode a small prefix and look for the root element.
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
  // A hostile TIFF can declare the whole file as one ASCII tag - cap the value.
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

  // ExifSubIFD - the shooting data.
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

  // Credit line (photoshop:Credit) - where AI generators identify themselves in
  // prose ("Made with Google AI", "Imagined with AI").
  const credit = grab(/[\w-]+:Credit>\s*([\s\S]*?)<\/[\w-]+:Credit>/i)
    || grab(/[\w-]+:Credit\s*=\s*["']([^"']+)["']/i);
  if (credit && !out.fields.some((f) => f.label === 'Credit')) {
    out.fields.push({ label: 'Credit', value: credit, group: 'authorship' });
  }

  // IPTC DigitalSourceType (Iptc4xmpExt namespace, but prefixes vary) - the
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

// ── MPF: the second image a JPEG legitimately declares ────────────────────────
//
// A JPEG ends at its EOI, so a multi-picture file keeps its extra images in the
// bytes AFTER it - exactly where a smuggled payload would sit. The difference is
// that a real multi-picture file SAYS SO, in a CIPA DC-007 "MPF" APP2 index that
// records the byte offset and length of every image. Two shipping cases put a
// second JPEG there:
//
//   - an **HDR gain map** (ISO 21496-1 + Ultra HDR v1.1) - what Lolly's own
//     `hdr=1` JPEG export writes (plans/61-deeprichpixels.md section 4.2 / section 6 B2), and
//     what Apple, Adobe and Android 15 write. The primary is an ordinary SDR
//     JPEG; the second image is a greyscale map an HDR-aware decoder applies.
//   - a plain MPO (stereo pairs, Apple burst/depth companions).
//
// Reading the index lets the reveal name what is actually there, instead of
// showing "appended data - 41 KB" for our own export, which would look like an
// accusation. This follows the motion-photo precedent (`sniffAppended`'s
// `video (motion photo)`) exactly: disclosed, sized, offset given, just not
// flagged `sensitive`.
//
// This reader follows the same contract as the rest of this module: bounded,
// never throws, returns `null` for anything it cannot fully verify. Nothing
// the index claims is trusted until checked - an offset is believed only once
// it lands inside the buffer on an SOI marker.

/** One image an MPF index declares, in absolute file offsets. */
export interface MpfImageRef {
  /** Absolute byte offset of the image's SOI. 0 for the primary. */
  start: number;
  /** Declared byte length. */
  length: number;
}

export interface JpegMpfIndex {
  /** Every declared image, in index order; `images[0]` is the primary. At least two. */
  images: MpfImageRef[];
  /** First byte past the PRIMARY image's EOI - the real start of the trailer, independent of what the index claims. */
  trailerStart: number;
  /** True when the second image carries ISO 21496-1 or `hdrgm` gain-map metadata (or the primary's XMP declares a GainMap container item). */
  gainMap: boolean;
}

/** The ISO 21496-1 APP2 identifier (Skia's `kISOGainmapSig`). Kept as a local wire constant - see `engine/src/gainmap-jpeg.ts` for the writer that emits it. */
const ISO_GAINMAP_URN = 'urn:iso:std:iso:ts:21496:-1';
/** Adobe's gain-map XMP namespace, as it appears inside an `hdrgm` packet. */
const HDRGM_NS = 'hdr-gain-map';
/** Hard cap on declared images - a real MPF file has 2–3; this stops a hostile count from sizing an array. */
const MAX_MPF_IMAGES = 16;
/** Bytes of a sub-image's APPn payload decoded as text when sniffing for gain-map metadata. */
const MAX_GAINMAP_SNIFF = 8192;

/** True when the JPEG spanning `[start, end)` carries gain-map metadata in either vocabulary. */
function hasGainMapMetadata(bytes: Uint8Array, start: number, end: number): boolean {
  if (start < 0 || end > bytes.length || end - start < 4) return false;
  const sub = bytes.subarray(start, end);
  const scan = scanJpegSegments(sub);
  if (!scan) return false;
  for (const seg of scan.segments) {
    if (seg.marker !== 0xe1 && seg.marker !== 0xe2) continue;
    if (seg.appId === JPEG_APP_IDS.MPF || seg.appId === JPEG_APP_IDS.ICC) continue;
    if (seg.appId === ISO_GAINMAP_URN) return true; // ISO 21496-1, identified by the URN alone
    const body = sub.subarray(seg.start + 4, Math.min(seg.end, seg.start + 4 + MAX_GAINMAP_SNIFF));
    if (body.length && new TextDecoder('latin1').decode(body).includes(HDRGM_NS)) return true;
  }
  return false;
}

/** True when the PRIMARY image's XMP declares a GContainer `GainMap` item (Ultra HDR v1.1). */
function primaryDeclaresGainMap(bytes: Uint8Array, scan: ReturnType<typeof scanJpegSegments>): boolean {
  if (!scan) return false;
  for (const seg of scan.segments) {
    if (seg.marker !== 0xe1 || seg.appId !== JPEG_APP_IDS.XMP) continue;
    const body = bytes.subarray(seg.start + 4, Math.min(seg.end, seg.start + 4 + MAX_GAINMAP_SNIFF));
    const text = new TextDecoder('latin1').decode(body);
    if (text.includes(HDRGM_NS) && text.includes('GainMap')) return true;
  }
  return false;
}

/**
 * Read a JPEG's MPF (CIPA DC-007) multi-picture index, or `null` when the file
 * has none, has a malformed one, or declares fewer than two images.
 *
 * Every offset in an MP index is measured from the FIRST BYTE OF THE MP ENDIAN
 * FIELD (DC-007 section 5.2.3.3), not the file start and not the segment start; the
 * primary's own offset field is zero by definition. Both byte orders are
 * accepted on read (libultrahdr and our own writer emit `MM`; a reader of files
 * strangers send does not get to be picky).
 *
 * Returns only fully-verified structure: a second image is reported solely when
 * its declared range lies inside the buffer AND begins with an SOI marker.
 */
export function readMpfIndex(bytes: Uint8Array | null | undefined): JpegMpfIndex | null {
  try {
    if (!bytes) return null;
    const scan = scanJpegSegments(bytes);
    if (!scan || scan.eoi === null) return null;
    const trailerStart = scan.eoi + 2;
    const mpf = scan.segments.find((s) => s.marker === 0xe2 && s.appId === JPEG_APP_IDS.MPF);
    if (!mpf) return null;

    // marker(2) + length(2) + "MPF\0"(4) → the MP Endian field.
    const h = mpf.start + 8;
    if (h + 8 > mpf.end || h + 8 > bytes.length) return null;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const endian = dv.getUint16(h);
    if (endian !== 0x4d4d && endian !== 0x4949) return null;
    const le = endian === 0x4949;
    if (dv.getUint16(h + 2, le) !== 0x002a) return null; // TIFF magic
    const ifd = h + dv.getUint32(h + 4, le);
    if (ifd < h || ifd + 2 > mpf.end) return null;
    const count = dv.getUint16(ifd, le);
    if (count > 64 || ifd + 2 + count * 12 > mpf.end) return null;

    let declared = 0;
    let entriesAt = -1;
    for (let i = 0; i < count; i++) {
      const e = ifd + 2 + i * 12;
      const tag = dv.getUint16(e, le);
      if (tag === 0xb001) declared = dv.getUint32(e + 8, le);      // NumberOfImages
      else if (tag === 0xb002) entriesAt = h + dv.getUint32(e + 8, le); // MPEntry
    }
    if (declared < 2 || declared > MAX_MPF_IMAGES) return null;
    if (entriesAt < h || entriesAt + declared * 16 > mpf.end) return null;

    const images: MpfImageRef[] = [];
    for (let i = 0; i < declared; i++) {
      const at = entriesAt + i * 16;
      const length = dv.getUint32(at + 4, le);
      const off = dv.getUint32(at + 8, le);
      // DC-007: the primary's offset field is 0 and means the start of the file.
      const start = i === 0 && off === 0 ? 0 : h + off;
      images.push({ start, length });
    }

    const second = images[1]!;
    if (second.start <= 0 || second.length <= 0) return null;
    if (second.start + second.length > bytes.length) return null;
    if (bytes[second.start] !== 0xff || bytes[second.start + 1] !== 0xd8) return null; // must be a real JPEG

    const gainMap = hasGainMapMetadata(bytes, second.start, second.start + second.length)
      || primaryDeclaresGainMap(bytes, scan);
    return { images, trailerStart, gainMap };
  } catch {
    return null;
  }
}

// ── Appended payloads (bytes after the container ends) ───────────────────────────

// Best-effort sniff of what a trailing payload is. Neutral wording - a motion
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

/**
 * When the bytes at `off` are an image the file's own MPF index declares, name
 * it. `null` means "nothing in the file accounts for these bytes" - which is the
 * condition that earns the `sensitive` flag, not the mere presence of a trailer.
 */
function describeDeclaredImage(bytes: Uint8Array, off: number): { kind: string; gainMap: boolean } | null {
  const idx = readMpfIndex(bytes);
  if (!idx) return null;
  if (!idx.images.some((im, i) => i > 0 && im.start === off)) return null;
  return idx.gainMap
    ? { kind: 'HDR gain map (ISO 21496-1 / Ultra HDR)', gainMap: true }
    : { kind: 'second image (MPF multi-picture)', gainMap: false };
}

// Record a trailing payload of `len` bytes starting at `off`.
function noteAppended(bytes: Uint8Array, off: number, out: FileMetadata): void {
  const len = bytes.length - off;
  if (len <= 0) return;
  const declared = describeDeclaredImage(bytes, off);
  const kind = declared ? declared.kind : sniffAppended(bytes, off);
  out.appended = { bytes: len, kind, offset: off, declared: !!declared };
  if (declared?.gainMap) {
    out.fields.push({
      label: 'HDR gain map',
      value: 'a second image an HDR display applies to brighten this one; ordinary viewers show the SDR image unchanged',
      group: 'technical',
    });
  }
  out.fields.push({
    label: 'Appended data',
    value: declared
      ? `${kind} - ${fmtBytes(len)}, declared by the file's multi-picture (MPF) index`
      : `${kind} - ${fmtBytes(len)} after the image ends`,
    group: 'technical',
    sensitive: !appendedIsExpected(out.appended),
  });
}

/**
 * Is a trailing payload accounted for, rather than hidden? The single rule
 * behind both this module's `sensitive` flag and any UI that warns about
 * appended data - shells must call this instead of comparing `kind` strings.
 *
 * Two ways to qualify, with different strengths of evidence:
 *   - `declared` - the container states the payload's offset and length (an MPF
 *     multi-picture index: an HDR gain map, an MPO). Strong: verified structure.
 *   - the motion-photo MP4 append - a convention with no in-file declaration.
 *     Exempt on the sniff alone, because it is common and not harmful.
 *
 * Everything else (zips, executables, an undeclared second image) stays flagged.
 * Note what this is NOT: a safety verdict. It says the bytes are explained, not
 * that they are harmless - the /verify view still offers to view and extract
 * every appended payload, expected or not.
 */
export function appendedIsExpected(appended: FileMetadata['appended']): boolean {
  if (!appended) return false;
  return appended.declared === true || appended.kind === 'video (motion photo)';
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
    if (m === 0x01) { q += 2; continue; }                  // TEM - standalone
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
  // part 3) - PNG is where Midjourney/Google AI outputs carry their AI
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

// ── GIF ────────────────────────────────────────────────────────────────────────
// GIF carries little structured metadata worth surfacing (no EXIF/XMP-equivalent
// container), but its block structure is walkable enough to find the true end
// of the data stream - the trailer byte 0x3B - so the same appended-payload
// pattern caught after PNG IEND / JPEG EOI is caught here too. Best-effort and
// hostile-input-safe throughout: any block that runs past the end of the buffer,
// or an unrecognised block introducer, just stops (records nothing) rather than
// guessing or over-reading. Structure (GIF89a spec): 6-byte header + 7-byte
// Logical Screen Descriptor (+ an optional Global Color Table), then a sequence
// of Image Descriptor (0x2C) / Extension (0x21) blocks until the Trailer (0x3B).

// Walks a run of length-prefixed sub-blocks starting at `start` (a byte giving
// the next chunk's length, 0 = terminator) - the shape shared by every GIF
// extension body and by image data after its LZW-min-code-size byte. Returns
// the offset just past the terminating zero-length block, or null if the
// buffer runs out first.
function gifSubBlocksEnd(bytes: Uint8Array, start: number): number | null {
  let p = start;
  while (p < bytes.length) {
    const size = bytes[p]!;
    p += 1;
    if (size === 0) return p;
    p += size;
    if (p > bytes.length) return null;
  }
  return null;
}

// Hostile-input guard: a strictly-increasing offset already bounds this loop by
// the buffer length, but cap it anyway (matches MAX_FIELDS's belt-and-suspenders
// style elsewhere in this file) rather than relying solely on that invariant.
const MAX_GIF_BLOCKS = 1_000_000;

function readGif(bytes: Uint8Array, out: FileMetadata): void {
  if (bytes.length < 13) return; // 6-byte header + 7-byte logical screen descriptor
  const packed = bytes[10]!; // logical screen descriptor's packed byte
  let p = 13;
  if (packed & 0x80) p += 3 * (2 ** ((packed & 0x07) + 1)); // global color table
  if (p > bytes.length) return;

  for (let i = 0; i < MAX_GIF_BLOCKS && p < bytes.length; i++) {
    const introducer = bytes[p]!;
    if (introducer === 0x3b) { noteAppended(bytes, p + 1, out); return; } // trailer
    if (introducer === 0x2c) {
      // Image Descriptor: introducer(1) + left/top/width/height(8) + packed(1).
      if (p + 10 > bytes.length) return;
      const imgPacked = bytes[p + 9]!;
      let q = p + 10;
      if (imgPacked & 0x80) q += 3 * (2 ** ((imgPacked & 0x07) + 1)); // local color table
      if (q >= bytes.length) return; // needs at least the LZW-min-code-size byte
      const end = gifSubBlocksEnd(bytes, q + 1);
      if (end == null) return;
      p = end;
      continue;
    }
    if (introducer === 0x21) {
      // Extension: introducer(1) + label(1) + sub-blocks.
      if (p + 2 > bytes.length) return;
      const end = gifSubBlocksEnd(bytes, p + 2);
      if (end == null) return;
      p = end;
      continue;
    }
    return; // unrecognised block introducer - malformed; stop rather than guess
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
// Two layers of disclosure live in the container. The XMP packet (a top-level
// `uuid` box with a fixed UUID, XMP spec part 3) is where AI generators declare
// their output (IPTC DigitalSourceType) - the video-side analogue of the JPEG/
// PNG path above. And the moov tree itself carries what the muxer wrote:
// timestamps, codecs, iTunes-style `ilst` tags (encoder, title, artist),
// QuickTime `mdta` keys (an iPhone's GPS/make/model live there), Android's
// `©xyz` GPS string, and each track handler's description - which is where a
// pipeline names itself ("ISO Media file produced by Google Inc.").
const XMP_BOX_UUID = [0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71, 0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac];

interface BmffBox { type: string; payload: number; end: number; }

// Children of a byte range. Every size is checked BEFORE use (a crafted size
// must not walk out of bounds or spin the loop), and the child count is capped.
// The default cap suits nested boxes; the top-level walk passes a higher one
// because a long DASH stream is thousands of legitimate moof/mdat pairs and an
// XMP uuid box can trail them all.
function bmffChildren(bytes: Uint8Array, start: number, end: number, maxBoxes = 512): BmffBox[] {
  const out: BmffBox[] = [];
  let p = start;
  while (p + 8 <= end && out.length < maxBoxes) {
    let size = (((bytes[p]! << 24) | (bytes[p + 1]! << 16) | (bytes[p + 2]! << 8) | bytes[p + 3]!) >>> 0);
    const type = String.fromCharCode(bytes[p + 4]!, bytes[p + 5]!, bytes[p + 6]!, bytes[p + 7]!);
    let header = 8;
    if (size === 1) {
      // 64-bit largesize (routine for a big mdat) - read it and keep walking.
      if (p + 16 > end) break;
      size = (((bytes[p + 8]! << 24) | (bytes[p + 9]! << 16) | (bytes[p + 10]! << 8) | bytes[p + 11]!) >>> 0) * 0x1_0000_0000
        + (((bytes[p + 12]! << 24) | (bytes[p + 13]! << 16) | (bytes[p + 14]! << 8) | bytes[p + 15]!) >>> 0);
      header = 16;
    } else if (size === 0) {
      size = end - p; // "to end of enclosing range" (last box only)
    }
    if (size < header || size > end - p) break; // truncated / hostile
    out.push({ type, payload: p + header, end: p + size });
    p += size;
  }
  return out;
}

const u16 = (b: Uint8Array, p: number): number => (b[p]! << 8) | b[p + 1]!;
const u32 = (b: Uint8Array, p: number): number => (((b[p]! << 24) | (b[p + 1]! << 16) | (b[p + 2]! << 8) | b[p + 3]!) >>> 0);

function bmffString(bytes: Uint8Array, start: number, end: number): string {
  if (end <= start) return '';
  let s = new TextDecoder('utf-8').decode(bytes.subarray(start, Math.min(end, start + 4096)));
  // QuickTime writes Pascal-style handler names (leading length byte); ISO
  // writes NUL-terminated UTF-8. Normalise both to the printable text.
  s = s.replace(/\0[\s\S]*$/, '');
  if (s && s.charCodeAt(0) < 0x20) s = s.slice(1);
  return clip(s.trim());
}

// Seconds since 1904-01-01 (the BMFF epoch) → "YYYY-MM-DD HH:MM UTC", or null
// for the unset/garbage values muxers write (0, or anything before 1970).
const BMFF_EPOCH_TO_UNIX = 2082844800;
function bmffDate(secs: number): string | null {
  const unix = secs - BMFF_EPOCH_TO_UNIX;
  if (unix <= 0 || !Number.isFinite(unix)) return null;
  const d = new Date(unix * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function bmffDuration(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return `${seconds.toFixed(1).replace(/\.0$/, '')} s`;
  const whole = Math.round(seconds); // round once, then split - never "1 min 60 s"
  const h = Math.floor(whole / 3600), m = Math.floor((whole % 3600) / 60), s = whole % 60;
  return h ? `${h} h ${m} min ${s} s` : `${m} min ${s} s`;
}

const BMFF_CODEC_NAMES: Record<string, string> = {
  avc1: 'H.264', avc3: 'H.264', hvc1: 'HEVC (H.265)', hev1: 'HEVC (H.265)',
  av01: 'AV1', vp09: 'VP9', vp08: 'VP8', mp4v: 'MPEG-4 Visual',
  mp4a: 'AAC', Opus: 'Opus', alac: 'Apple Lossless', fLaC: 'FLAC',
  'ac-3': 'AC-3', 'ec-3': 'E-AC-3', twos: 'PCM', sowt: 'PCM', lpcm: 'PCM',
};

// The iTunes-style `ilst` tags worth a row. `©`-prefixed fourccs come out of
// String.fromCharCode as ©, so the keys read naturally here.
const ILST_TAGS: Record<string, { label: string; group: MetaGroup; sensitive?: boolean }> = {
  '©nam': { label: 'Title', group: 'description' },
  '©ART': { label: 'Artist', group: 'authorship', sensitive: true },
  aART: { label: 'Album artist', group: 'authorship', sensitive: true },
  '©alb': { label: 'Album', group: 'description' },
  '©day': { label: 'Date', group: 'timestamps' },
  '©cmt': { label: 'Comment', group: 'description' },
  '©gen': { label: 'Genre', group: 'description' },
  '©wrt': { label: 'Composer', group: 'authorship', sensitive: true },
  '©aut': { label: 'Author', group: 'authorship', sensitive: true },
  '©too': { label: 'Encoded with', group: 'software' },
  cprt: { label: 'Copyright', group: 'authorship' },
  desc: { label: 'Description', group: 'description' },
  ldes: { label: 'Description', group: 'description' },
};

// The QuickTime `mdta` keys worth a row (an iPhone movie's identifying set).
const MDTA_KEYS: Record<string, { label: string; group: MetaGroup; sensitive?: boolean }> = {
  'com.apple.quicktime.make': { label: 'Device make', group: 'device', sensitive: true },
  'com.apple.quicktime.model': { label: 'Device model', group: 'device', sensitive: true },
  'com.apple.quicktime.software': { label: 'Software', group: 'software' },
  'com.apple.quicktime.creationdate': { label: 'Created', group: 'timestamps' },
  'com.apple.quicktime.author': { label: 'Author', group: 'authorship', sensitive: true },
  'com.apple.quicktime.displayname': { label: 'Title', group: 'description' },
  'com.apple.quicktime.description': { label: 'Description', group: 'description' },
  'com.apple.quicktime.location.ISO6709': { label: 'Coordinates', group: 'location', sensitive: true },
};

// The text payload of an ilst entry's `data` atom (type 1 = UTF-8, 0 = implicit).
function ilstText(bytes: Uint8Array, entry: BmffBox): string | null {
  for (const d of bmffChildren(bytes, entry.payload, entry.end)) {
    if (d.type !== 'data' || d.end - d.payload < 8) continue;
    const kind = u32(bytes, d.payload) & 0xffffff;
    if (kind !== 1 && kind !== 0) continue;
    const text = bmffString(bytes, d.payload + 8, d.end);
    if (text) return text;
  }
  return null;
}

// "+37.4218-122.0840+5.2/" (ISO 6709, Android ©xyz + QuickTime location) → fix.
function parseIso6709(s: string): { lat: number; lon: number } | null {
  const m = /^([+-]\d{1,2}(?:\.\d+)?)([+-]\d{1,3}(?:\.\d+)?)/.exec(s.trim());
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

function bmffGps(out: FileMetadata, fix: { lat: number; lon: number }): void {
  if (out.gps) return; // an earlier (XMP) fix wins; never overwrite
  out.gps = fix;
  out.mapUrl = `https://www.openstreetmap.org/?mlat=${fix.lat.toFixed(6)}&mlon=${fix.lon.toFixed(6)}#map=15/${fix.lat.toFixed(5)}/${fix.lon.toFixed(5)}`;
  out.fields.push({ label: 'Coordinates', value: `${fix.lat.toFixed(6)}, ${fix.lon.toFixed(6)}`, group: 'location', sensitive: true });
}

// The pipeline fingerprints we can vouch for byte-for-byte. Google's AI
// products (Gemini video/audio, Veo, NotebookLM) deliver files whose only
// maker traces are the bare handler note and/or an `©too` of exactly
// "Google"; YouTube's server re-encode writes the same note WITH a
// "Created on:" date. Matching the dated variant first keeps a YouTube
// download from wearing the AI hint.
const GOOGLE_NOTE_DATED = /^ISO Media file produced by Google Inc\.?\s+Created on: /;
const GOOGLE_NOTE = /^ISO Media file produced by Google Inc\.?$/;

function detectProducer(handlerNotes: string[], encoder: string | null, hasVideo: boolean): MediaProducer | undefined {
  const dated = handlerNotes.find((n) => GOOGLE_NOTE_DATED.test(n));
  if (dated) return { vendor: 'Google', signature: 'reencode', hint: 'a YouTube-style server re-encode', markers: [dated] };
  const markers: string[] = [];
  const note = handlerNotes.find((n) => GOOGLE_NOTE.test(n));
  if (note) markers.push(note);
  if (encoder === 'Google') markers.push('encoder tag “Google”');
  if (!markers.length) return undefined;
  return {
    vendor: 'Google',
    signature: 'ai-download',
    hint: hasVideo ? 'Gemini or Veo' : 'Gemini or NotebookLM',
    markers,
  };
}

function readIlst(bytes: Uint8Array, ilst: BmffBox, out: FileMetadata): string | null {
  let encoder: string | null = null;
  for (const entry of bmffChildren(bytes, ilst.payload, ilst.end)) {
    const tag = ILST_TAGS[entry.type];
    if (!tag) continue;
    const text = ilstText(bytes, entry);
    if (!text) continue;
    if (entry.type === '©too') encoder = text;
    if (out.fields.length < MAX_FIELDS) {
      out.fields.push({ label: tag.label, value: text, group: tag.group, ...(tag.sensitive ? { sensitive: true } : {}) });
    }
  }
  return encoder;
}

// A `meta` box is a FullBox (4 bytes of version/flags before its children) -
// except QuickTime writes it as a plain box. Peek: a bare meta's first child
// parses cleanly as its leading `hdlr`; a FullBox's version/flags read as a
// garbage box instead, so fall through to the offset-4 walk.
function metaChildren(bytes: Uint8Array, meta: BmffBox): BmffBox[] {
  const bare = bmffChildren(bytes, meta.payload, meta.end);
  if (bare.length && bare[0]!.type === 'hdlr') return bare;
  return bmffChildren(bytes, meta.payload + 4, meta.end);
}

// QuickTime-style metadata: `keys` names each index, `ilst` children are keyed
// by u32 index instead of fourcc.
function readMdtaMeta(bytes: Uint8Array, kids: BmffBox[], out: FileMetadata): void {
  const keysBox = kids.find((b) => b.type === 'keys');
  const ilst = kids.find((b) => b.type === 'ilst');
  if (!keysBox || !ilst) return;
  const names: string[] = [];
  if (keysBox.end - keysBox.payload >= 8) {
    const count = Math.min(u32(bytes, keysBox.payload + 4), 256);
    let p = keysBox.payload + 8;
    while (names.length < count && p + 8 <= keysBox.end) {
      const size = u32(bytes, p);
      if (size < 8 || size > keysBox.end - p) break;
      names.push(bmffString(bytes, p + 8, p + size));
      p += size;
    }
  }
  for (const entry of bmffChildren(bytes, ilst.payload, ilst.end)) {
    // The entry "type" IS the big-endian index; recover it from the chars.
    const idx = (entry.type.charCodeAt(0) << 24) | (entry.type.charCodeAt(1) << 16) | (entry.type.charCodeAt(2) << 8) | entry.type.charCodeAt(3);
    const key = idx >= 1 && idx <= names.length ? names[idx - 1]! : '';
    const known = MDTA_KEYS[key];
    if (!known) continue;
    const text = ilstText(bytes, entry);
    if (!text) continue;
    if (key === 'com.apple.quicktime.location.ISO6709') {
      const fix = parseIso6709(text);
      if (fix) bmffGps(out, fix);
      continue;
    }
    if (out.fields.length < MAX_FIELDS) {
      out.fields.push({ label: known.label, value: text, group: known.group, ...(known.sensitive ? { sensitive: true } : {}) });
    }
  }
}

function readBmff(bytes: Uint8Array, out: FileMetadata): void {
  const top = bmffChildren(bytes, 0, bytes.length, 65536);
  const handlerNotes: string[] = [];
  const trackRows: MetaField[] = [];
  let encoder: string | null = null;
  let hasVideo = false;

  // ftyp brand + the XMP uuid box (the AI-declaration carrier).
  const ftyp = top.find((b) => b.type === 'ftyp');
  const brand = ftyp && ftyp.end - ftyp.payload >= 4 ? bmffString(bytes, ftyp.payload, ftyp.payload + 4) : '';
  for (const b of top) {
    if (b.type === 'uuid' && b.end - b.payload >= 16 && XMP_BOX_UUID.every((v, i) => bytes[b.payload + i] === v)) {
      const start = b.payload + 16;
      readXmp(new TextDecoder('utf-8').decode(bytes.subarray(start, Math.min(b.end, start + MAX_TEXT_SCAN))), out);
    }
  }
  const fragmented = brand === 'dash' || top.some((b) => b.type === 'moof');

  const moov = top.find((b) => b.type === 'moov');
  if (moov) {
    const kids = bmffChildren(bytes, moov.payload, moov.end);

    for (const trak of kids.filter((b) => b.type === 'trak')) {
      const mdia = bmffChildren(bytes, trak.payload, trak.end).find((b) => b.type === 'mdia');
      if (!mdia) continue;
      const mkids = bmffChildren(bytes, mdia.payload, mdia.end);
      const hdlr = mkids.find((b) => b.type === 'hdlr');
      let kind = '';
      if (hdlr && hdlr.end - hdlr.payload >= 12) {
        kind = String.fromCharCode(bytes[hdlr.payload + 8]!, bytes[hdlr.payload + 9]!, bytes[hdlr.payload + 10]!, bytes[hdlr.payload + 11]!);
        const note = hdlr.end - hdlr.payload > 24 ? bmffString(bytes, hdlr.payload + 24, hdlr.end) : '';
        if (note && !handlerNotes.includes(note)) handlerNotes.push(note);
      }
      const minf = mkids.find((b) => b.type === 'minf');
      const stbl = minf ? bmffChildren(bytes, minf.payload, minf.end).find((b) => b.type === 'stbl') : undefined;
      const stsd = stbl ? bmffChildren(bytes, stbl.payload, stbl.end).find((b) => b.type === 'stsd') : undefined;
      if (!stsd || stsd.end - stsd.payload < 8) continue;
      const entries = bmffChildren(bytes, stsd.payload + 8, stsd.end);
      if (!entries.length) continue;
      const e = entries[0]!;
      const codec = BMFF_CODEC_NAMES[e.type] ? `${BMFF_CODEC_NAMES[e.type]} (${e.type})` : e.type;
      if (kind === 'vide') {
        hasVideo = true;
        // VisualSampleEntry: width/height at payload offset 24/26.
        const w = e.end - e.payload >= 28 ? u16(bytes, e.payload + 24) : 0;
        const h = e.end - e.payload >= 28 ? u16(bytes, e.payload + 26) : 0;
        trackRows.push({ label: 'Video track', value: w && h ? `${codec} - ${w} × ${h} px` : codec, group: 'technical' });
      } else if (kind === 'soun') {
        // AudioSampleEntry: channels at payload offset 16, rate (16.16) at 24.
        const ch = e.end - e.payload >= 28 ? u16(bytes, e.payload + 16) : 0;
        const rate = e.end - e.payload >= 28 ? u32(bytes, e.payload + 24) >>> 16 : 0;
        const chs = ch === 1 ? 'mono' : ch === 2 ? 'stereo' : ch ? `${ch} channels` : '';
        const rateS = rate ? `${(rate / 1000).toFixed(1).replace(/\.0$/, '')} kHz` : '';
        trackRows.push({ label: 'Audio track', value: [codec, [rateS, chs].filter(Boolean).join(' ')].filter(Boolean).join(' - '), group: 'technical' });
      }
    }

    // moov-level meta (QuickTime mdta keys - iPhone GPS/make/model) and
    // udta (iTunes ilst tags, Android ©xyz GPS, QuickTime XMP_).
    const metas = kids.filter((b) => b.type === 'meta');
    const udta = kids.find((b) => b.type === 'udta');
    if (udta) {
      const ukids = bmffChildren(bytes, udta.payload, udta.end);
      for (const m of ukids.filter((b) => b.type === 'meta')) metas.push(m);
      const xyz = ukids.find((b) => b.type === '©xyz');
      if (xyz && xyz.end - xyz.payload > 4) {
        const fix = parseIso6709(bmffString(bytes, xyz.payload + 4, xyz.end));
        if (fix) bmffGps(out, fix);
      }
      const xmp = ukids.find((b) => b.type === 'XMP_');
      if (xmp) readXmp(new TextDecoder('utf-8').decode(bytes.subarray(xmp.payload, Math.min(xmp.end, xmp.payload + MAX_TEXT_SCAN))), out);
    }
    for (const meta of metas) {
      const mk = metaChildren(bytes, meta);
      const hdlr = mk.find((b) => b.type === 'hdlr');
      const handler = hdlr && hdlr.end - hdlr.payload >= 12
        ? String.fromCharCode(bytes[hdlr.payload + 8]!, bytes[hdlr.payload + 9]!, bytes[hdlr.payload + 10]!, bytes[hdlr.payload + 11]!)
        : '';
      if (handler === 'mdta') {
        readMdtaMeta(bytes, mk, out);
      } else {
        const ilst = mk.find((b) => b.type === 'ilst');
        if (ilst) encoder = readIlst(bytes, ilst, out) ?? encoder;
      }
    }

    // mvhd timestamps + duration.
    const mvhd = kids.find((b) => b.type === 'mvhd');
    if (mvhd && mvhd.end - mvhd.payload >= 20) {
      const v = bytes[mvhd.payload]!;
      const created = v === 1 ? u32(bytes, mvhd.payload + 4) * 0x1_0000_0000 + u32(bytes, mvhd.payload + 8) : u32(bytes, mvhd.payload + 4);
      const timescale = v === 1 ? u32(bytes, mvhd.payload + 20) : u32(bytes, mvhd.payload + 12);
      const duration = v === 1
        ? u32(bytes, mvhd.payload + 24) * 0x1_0000_0000 + u32(bytes, mvhd.payload + 28)
        : u32(bytes, mvhd.payload + 16);
      const when = bmffDate(created);
      if (when && out.fields.length < MAX_FIELDS) out.fields.push({ label: 'Created', value: when, group: 'timestamps' });
      const dur = timescale > 0 ? bmffDuration(duration / timescale) : null;
      if (dur && out.fields.length < MAX_FIELDS) out.fields.push({ label: 'Duration', value: dur, group: 'technical' });
    }
  }

  for (const note of handlerNotes) {
    if (out.fields.length < MAX_FIELDS) out.fields.push({ label: 'Handler description', value: note, group: 'software' });
  }
  for (const row of trackRows) {
    if (out.fields.length < MAX_FIELDS) out.fields.push(row);
  }
  if (brand && out.fields.length < MAX_FIELDS) {
    out.fields.push({ label: 'Container profile', value: fragmented ? `${brand} - fragmented (streaming delivery)` : brand, group: 'technical' });
  }

  const producer = detectProducer(handlerNotes, encoder, hasVideo);
  if (producer) out.producer = producer;
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
 * files return an empty `fields` list. PDF is not handled here - use host.pdf.analyze.
 */
export function extractFileMetadata(bytes: Uint8Array): FileMetadata {
  const out: FileMetadata = { format: '', fields: [] };
  try {
    out.format = sniff(bytes);
    switch (out.format) {
      case 'JPEG': readJpeg(bytes, out); break;
      case 'PNG': readPng(bytes, out); break;
      case 'GIF': readGif(bytes, out); break;
      case 'WebP': readWebp(bytes, out); break;
      case 'TIFF': readExif(bytes, 0, bytes.length, out); break;
      case 'SVG': readSvg(bytes, out); break;
      case 'MP4': case 'QuickTime': readBmff(bytes, out); break;
      // Other formats carry little structured metadata worth surfacing.
    }
  } catch { /* best-effort: return whatever was gathered before the fault */ }
  return out;
}
