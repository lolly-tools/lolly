// SPDX-License-Identifier: MPL-2.0
/**
 * Technical metadata for a catalog asset's detail modal.
 *
 * `extractAssetMetadata(ref)` returns an ordered list of display rows -
 * dimensions, DPI, colour depth, EXIF (photos), audio/video track props, page
 * count (PDF), viewBox (SVG/Lottie), and always File size + Format. It is
 * type-dispatched and degrades gracefully: it NEVER throws, and skips any field
 * it can't read rather than failing the whole panel.
 *
 * All the container parsers here are self-contained inline byte readers (no npm
 * dependency): PNG chunk walk (IHDR/pHYs/iCCP), JPEG segment scan (JFIF density,
 * EXIF APP1, ICC APP2), a small two-byte-order TIFF/IFD reader for EXIF, a
 * minimal ID3v2 reader, and a Lottie-JSON shape read. Audio/video decode props
 * come from the already-installed `mediabunny` (lazily imported, so it never
 * touches first paint), with an ID3 / AudioContext fallback for tags/duration.
 *
 * Reads are bounded: byte parsers only ever see the first ~256 KB (EXIF/JFIF/
 * pHYs/ID3v2 all live in the file head), and audio/video decode is refused above
 * a size cap rather than risk an OOM on a huge clip.
 */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { t } from '../i18n.ts';

/** One label:value row rendered under the modal's "Details" subheading. */
export interface MetaField {
  label: string;
  value: string;
}

// ── size caps ──────────────────────────────────────────────────────────────
const HEAD_BYTES = 256 * 1024;              // byte parsers never look past this
const RASTER_DECODE_CAP = 64 * 1024 * 1024; // skip createImageBitmap above this
const PDF_CAP = 32 * 1024 * 1024;           // skip the string scan above this
const AV_CAP = 150 * 1024 * 1024;           // refuse mediabunny/AudioContext above this
const AUDIOCTX_CAP = 40 * 1024 * 1024;      // decodeAudioData fallback ceiling

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function extractAssetMetadata(ref: AssetRef): Promise<MetaField[]> {
  const fields: MetaField[] = [];
  const push = (label: string, value: string | number | null | undefined): void => {
    if (value == null) return;
    const v = String(value).trim();
    if (v) fields.push({ label, value: v });
  };

  const fmt = String(ref.format ?? ref.type ?? '').toUpperCase();
  const lfmt = String(ref.format ?? '').toLowerCase();
  const type = ref.type;
  let size: number | null = metaBytes(ref);

  try {
    if (type === 'audio' || type === 'video') {
      if (size == null) size = await headSize(ref.url);
      if (size == null || size <= AV_CAP) {
        const blob = await fetchBlob(ref.url);
        if (blob) {
          if (size == null) size = blob.size;
          if (type === 'audio') await addAudioFields(blob, push, size, ref);
          else await addVideoFields(blob, push);
        }
      } else {
        // Too big to decode safely - still surface the authored duration if any.
        const d = metaDurationSec(ref);
        if (d) push(t('Duration'), formatDuration(d));
      }
    } else if (type === 'lottie') {
      await addLottieFields(ref, push);
      if (size == null) size = await headSize(ref.url);
    } else {
      // raster / vector / pdf / everything else: one bounded blob fetch.
      const blob = await fetchBlob(ref.url);
      if (blob) {
        if (size == null) size = blob.size;
        const head = await readHead(blob, HEAD_BYTES);
        if (type === 'raster') await addRasterFields(blob, head, push);
        else if (type === 'vector') addVectorFields(head, push);
        else if (lfmt === 'pdf' && blob.size <= PDF_CAP) await addPdfFields(blob, push);
      }
    }
  } catch {
    /* never throw - a partial (or empty) panel is fine */
  }

  // The import-moment snapshot (plans/144 Wave 5 O4), captured at ingest with
  // the source file's own facts. Read straight off the record - no byte work.
  try {
    const prov = (ref.meta as Record<string, unknown> | undefined)?.provenance as {
      originalFilename?: string;
      importedAt?: string;
      metaDigest?: Record<string, string>;
      credentialPresent?: boolean;
    } | undefined;
    if (prov) {
      push(t('Imported from'), prov.originalFilename);
      if (prov.importedAt) {
        const d = new Date(prov.importedAt);
        if (!Number.isNaN(d.getTime())) {
          push(t('Imported'), d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }));
        }
      }
      const md = prov.metaDigest ?? {};
      push(t('Artist / author'), md.author);
      push(t('Copyright'), md.copyright);
      push(t('Captured'), md.captureDate);
      push(t('Camera'), md.camera);
      push(t('Software'), md.software);
      push(t('Keywords'), md.keywords);
    }
  } catch { /* a malformed snapshot never breaks the panel */ }

  // Always, last: File size then Format.
  if (size != null && size > 0) push(t('File size'), formatBytes(size));
  push(t('Format'), fmt);
  return fields;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-type field builders
// ─────────────────────────────────────────────────────────────────────────────

type Push = (label: string, value: string | number | null | undefined) => void;

async function addRasterFields(blob: Blob, head: Uint8Array, push: Push): Promise<void> {
  const png = parsePngMeta(head);
  const jpg = png ? null : parseJpegMeta(head);

  // Pixel dimensions: prefer a cheap decode; fall back to the IHDR header.
  let dims: { w: number; h: number } | null = null;
  if (blob.size <= RASTER_DECODE_CAP) dims = await decodeDims(blob);
  if (!dims && png?.width && png?.height) dims = { w: png.width, h: png.height };
  if (dims) push(t('Dimensions'), `${dims.w} × ${dims.h}`);

  if (png?.bitDepth) push(t('Colour depth'), depthLabel(png));

  const dpi = png?.dpi ?? jpg?.dpi;
  if (dpi && dpi > 0) push(t('Resolution'), `${dpi} dpi`);
  else push(t('Resolution'), `72 dpi (${t('unspecified')})`);

  if (png?.hasIcc || jpg?.hasIcc) push(t('ICC profile'), t('Embedded'));

  if (jpg?.exif) addExifFields(jpg.exif, push);
}

function addVectorFields(head: Uint8Array, push: Push): void {
  const text = safeDecode(head);
  const m = parseSvgMeta(text);
  if (!m) return;
  if (m.viewBox) push(t('viewBox'), m.viewBox);
  let w = m.width;
  let h = m.height;
  if ((!w || !h) && m.viewBox) {
    const p = m.viewBox.split(/[\s,]+/).map(Number).filter(n => Number.isFinite(n));
    if (p.length === 4) { w = p[2]; h = p[3]; }
  }
  if (w && h) push(t('Dimensions'), `${trimNum(w)} × ${trimNum(h)}`);
}

async function addLottieFields(ref: AssetRef, push: Push): Promise<void> {
  // Mirror openDetails: a user Lottie's url IS the json; a library one carries it on meta.animationUrl.
  const src = ref.source === 'user'
    ? ref.url
    : (typeof ref.meta?.animationUrl === 'string' ? ref.meta.animationUrl : '');
  if (!src) return;
  let json: unknown;
  try { json = await (await fetch(src)).json(); } catch { return; }
  const m = lottieMetaFromJson(json);
  if (!m) return;
  if (m.width && m.height) push(t('Dimensions'), `${m.width} × ${m.height}`);
  if (m.durationSec) push(t('Duration'), formatDuration(m.durationSec));
  if (m.frames != null) push(t('Frames'), String(m.frames));
  if (m.fps) push(t('Frame rate'), `${trimNum(m.fps)} fps`);
}

async function addPdfFields(blob: Blob, push: Push): Promise<void> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text = latin1(bytes);
  const pages = countPdfPages(text);
  if (pages) push(t('Pages'), String(pages));
  const box = firstMediaBox(text);
  if (box) push(t('Dimensions'), `${trimNum(box.w)} × ${trimNum(box.h)} pt`);
}

async function addAudioFields(blob: Blob, push: Push, size: number | null, ref: AssetRef): Promise<void> {
  let gotCore = false;
  let duration = 0;
  try {
    const mb = await import('mediabunny');
    // Explicit container set, not ALL_FORMATS: the audio-bearing containers only,
    // matching sequence-providers' AUDIO_CONTAINERS. ALL_FORMATS silently drags
    // HLS/MPEG-TS demuxers into this lazy chunk and breaks the bundle-discipline
    // rule the other decode sites state and guard.
    const input = new mb.Input({
      formats: [mb.MP4, mb.QTFF, mb.WEBM, mb.MATROSKA, mb.OGG, mb.MP3, mb.WAVE, mb.ADTS, mb.FLAC],
      source: new mb.BlobSource(blob),
    });
    try {
      try { duration = await input.computeDuration(); } catch { /* keep 0 */ }
      if (Number.isFinite(duration) && duration > 0) { push(t('Duration'), formatDuration(duration)); gotCore = true; }

      let track: Awaited<ReturnType<typeof input.getPrimaryAudioTrack>> = null;
      try { track = await input.getPrimaryAudioTrack(); } catch { /* none */ }
      if (track) {
        try { const sr = await track.getSampleRate(); if (sr > 0) { push(t('Sample rate'), formatSampleRate(sr)); gotCore = true; } } catch { /* skip */ }
        try { const ch = await track.getNumberOfChannels(); if (ch > 0) { push(t('Channels'), channelLabel(ch)); gotCore = true; } } catch { /* skip */ }
        let br: number | null = null;
        try { br = await track.getBitrate(); } catch { /* skip */ }
        if ((br == null || br <= 0) && duration > 0 && size && size > 0) br = Math.round((size * 8) / duration);
        if (br && br > 0) push(t('Bitrate'), formatBitrate(br));
        try { const codec = await track.getCodec(); if (codec) push(t('Codec'), codecLabel(codec)); } catch { /* skip */ }
      }

      let mbTags: { title?: string; artist?: string; album?: string; year?: string; genre?: string } = {};
      try { mbTags = tagsToObj(await input.getMetadataTags()); } catch { /* none */ }
      // Supplement missing title/artist from a raw ID3v2 header for MP3s.
      if (!mbTags.title && /mp3|mpeg/i.test(String(ref.format))) {
        try {
          const id3 = parseId3v2(await readHead(blob, HEAD_BYTES));
          if (id3) mbTags = { ...id3, ...pruneEmpty(mbTags) };
        } catch { /* skip */ }
      }
      addTagFields(mbTags, push);
    } finally {
      try { input.dispose(); } catch { /* ignore */ }
    }
  } catch {
    /* mediabunny unavailable / import failed - fall through to the decode fallback */
  }

  // Last resort for duration/sampleRate/channels when the demuxer gave nothing.
  if (!gotCore && size != null && size <= AUDIOCTX_CAP) {
    try {
      const AC = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
      if (AC) {
        const ctx = new AC();
        try {
          const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
          if (buf.duration > 0) push(t('Duration'), formatDuration(buf.duration));
          if (buf.sampleRate > 0) push(t('Sample rate'), formatSampleRate(buf.sampleRate));
          if (buf.numberOfChannels > 0) push(t('Channels'), channelLabel(buf.numberOfChannels));
        } finally {
          try { await ctx.close(); } catch { /* ignore */ }
        }
      }
    } catch { /* skip */ }
  }
}

async function addVideoFields(blob: Blob, push: Push): Promise<void> {
  try {
    const mb = await import('mediabunny');
    // Explicit video container set, not ALL_FORMATS - matches sequence-providers'
    // VIDEO_CONTAINERS (see the audio-side note above; same bundle-discipline rule).
    const input = new mb.Input({
      formats: [mb.MP4, mb.QTFF, mb.WEBM, mb.MATROSKA],
      source: new mb.BlobSource(blob),
    });
    try {
      let track: Awaited<ReturnType<typeof input.getPrimaryVideoTrack>> = null;
      try { track = await input.getPrimaryVideoTrack(); } catch { /* none */ }
      if (track) {
        try {
          const w = await track.getDisplayWidth();
          const h = await track.getDisplayHeight();
          if (w && h) push(t('Dimensions'), `${w} × ${h}`);
        } catch { /* skip */ }
      }
      let duration = 0;
      try { duration = await input.computeDuration(); } catch { /* keep 0 */ }
      if (Number.isFinite(duration) && duration > 0) push(t('Duration'), formatDuration(duration));
      if (track) {
        try { const codec = await track.getCodec(); if (codec) push(t('Codec'), codecLabel(codec)); } catch { /* skip */ }
        try {
          const stats = await track.computePacketStats(60);
          const fps = stats?.averagePacketRate;
          if (fps && fps > 0) push(t('Frame rate'), `${formatFps(fps)} fps`);
        } catch { /* skip */ }
      }
    } finally {
      try { input.dispose(); } catch { /* ignore */ }
    }
  } catch {
    /* mediabunny unavailable - video props simply omitted */
  }
}

// EXIF display rows off a parsed TIFF block.
function addExifFields(exif: Uint8Array, push: Push): void {
  const tags = parseTiffTags(exif);
  if (!tags) return;
  const { ifd0, exif: sub, gps } = tags;

  const camera = [asStr(ifd0[0x010f]), asStr(ifd0[0x0110])].filter(Boolean).join(' ').trim();
  if (camera) push(t('Camera'), camera);

  const lens = asStr(sub[0xa434]);
  if (lens) push(t('Lens'), lens);

  const taken = asStr(sub[0x9003]) || asStr(ifd0[0x0132]);
  if (taken) push(t('Taken'), formatExifDate(taken));

  const exp = asNum(sub[0x829a]);
  if (exp && exp > 0) push(t('Exposure'), formatExposure(exp));

  const fnum = asNum(sub[0x829d]);
  if (fnum && fnum > 0) push(t('Aperture'), `ƒ/${trimNum(round1(fnum))}`);

  const iso = asNum(sub[0x8827]);
  if (iso && iso > 0) push(t('ISO'), String(Math.round(iso)));

  const focal = asNum(sub[0x920a]);
  if (focal && focal > 0) push(t('Focal length'), `${trimNum(round1(focal))} mm`);

  const orient = asNum(ifd0[0x0112]);
  if (orient && orient !== 1) { const o = orientationLabel(orient); if (o) push(t('Orientation'), o); }

  const loc = gpsCoords(gps);
  if (loc) push(t('Location'), loc);
}

function addTagFields(
  tags: { title?: string; artist?: string; album?: string; year?: string; genre?: string },
  push: Push,
): void {
  if (tags.title) push(t('Title'), tags.title);
  if (tags.artist) push(t('Artist'), tags.artist);
  if (tags.album) push(t('Album'), tags.album);
  if (tags.year) push(t('Year'), tags.year);
  if (tags.genre) push(t('Genre'), tags.genre);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure container parsers (exported for unit tests)
// ─────────────────────────────────────────────────────────────────────────────

export interface PngMeta {
  width?: number;
  height?: number;
  bitDepth?: number;
  colorType?: number;
  dpi?: number;
  hasIcc?: boolean;
}

/** Walk PNG chunks up to the first IDAT, reading IHDR, pHYs (DPI) and iCCP. */
export function parsePngMeta(bytes: Uint8Array): PngMeta | null {
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  const dv = view(bytes);
  const out: PngMeta = {};
  let off = 8;
  while (off + 8 <= bytes.length) {
    const len = dv.getUint32(off);
    const type = ascii(bytes, off + 4, 4);
    const dataOff = off + 8;
    if (type === 'IDAT' || type === 'IEND') break;
    if (type === 'IHDR' && dataOff + 13 <= bytes.length) {
      out.width = dv.getUint32(dataOff);
      out.height = dv.getUint32(dataOff + 4);
      out.bitDepth = dv.getUint8(dataOff + 8);
      out.colorType = dv.getUint8(dataOff + 9);
    } else if (type === 'pHYs' && dataOff + 9 <= bytes.length) {
      const ppuX = dv.getUint32(dataOff);
      const unit = dv.getUint8(dataOff + 8);
      if (unit === 1 && ppuX > 0) out.dpi = Math.round(ppuX * 0.0254);
    } else if (type === 'iCCP') {
      out.hasIcc = true;
    }
    const nextOff = dataOff + len + 4; // chunk data + CRC
    if (nextOff <= off) break;         // corrupt length guard
    off = nextOff;
  }
  return out;
}

export interface JpegMeta {
  dpi?: number;
  hasIcc?: boolean;
  exif?: Uint8Array; // the TIFF block after the "Exif\0\0" marker
}

/** Scan JPEG APPn segments for JFIF density, an EXIF APP1 block and an ICC APP2. */
export function parseJpegMeta(bytes: Uint8Array): JpegMeta | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const dv = view(bytes);
  const out: JpegMeta = {};
  let off = 2;
  while (off + 4 <= bytes.length) {
    if (bytes[off] !== 0xff) { off++; continue; }
    let marker = bytes[off + 1];
    while (marker === 0xff && off + 2 < bytes.length) { off++; marker = bytes[off + 1]; }
    if (marker === undefined || marker === 0xd9 /* EOI */ || marker === 0xda /* SOS */) break;
    if (marker >= 0xd0 && marker <= 0xd7) { off += 2; continue; } // standalone RSTn
    if (off + 4 > bytes.length) break;
    const segLen = dv.getUint16(off + 2);
    if (segLen < 2) break;
    const segOff = off + 4;
    const segEnd = off + 2 + segLen;
    if (marker === 0xe0 && ascii(bytes, segOff, 4) === 'JFIF' && segOff + 10 <= bytes.length) {
      const unit = dv.getUint8(segOff + 7);
      const xd = dv.getUint16(segOff + 8);
      if (xd > 0) {
        if (unit === 1) out.dpi = xd;
        else if (unit === 2) out.dpi = Math.round(xd * 2.54);
      }
    } else if (marker === 0xe1 && ascii(bytes, segOff, 4) === 'Exif' && bytes[segOff + 4] === 0 && bytes[segOff + 5] === 0) {
      out.exif = bytes.subarray(segOff + 6, Math.min(segEnd, bytes.length));
    } else if (marker === 0xe2 && ascii(bytes, segOff, 11) === 'ICC_PROFILE') {
      out.hasIcc = true;
    }
    if (segEnd <= off) break;
    off = segEnd;
  }
  return out;
}

export type TiffValue = number | string | number[];
export interface TiffTags {
  ifd0: Record<number, TiffValue>;
  exif: Record<number, TiffValue>;
  gps: Record<number, TiffValue>;
}

/** A minimal TIFF/IFD reader (both byte orders) for EXIF - IFD0 + Exif + GPS. */
export function parseTiffTags(bytes: Uint8Array): TiffTags | null {
  if (bytes.length < 8) return null;
  const b0 = bytes[0];
  const b1 = bytes[1];
  let le: boolean;
  if (b0 === 0x49 && b1 === 0x49) le = true;       // "II" little-endian
  else if (b0 === 0x4d && b1 === 0x4d) le = false; // "MM" big-endian
  else return null;
  const dv = view(bytes);
  if (dv.getUint16(2, le) !== 0x2a) return null;
  const ifd0Off = dv.getUint32(4, le);
  const ifd0 = readIfd(dv, bytes, ifd0Off, le);
  let exif: Record<number, TiffValue> = {};
  let gps: Record<number, TiffValue> = {};
  const exifPtr = ifd0[0x8769];
  if (typeof exifPtr === 'number') exif = readIfd(dv, bytes, exifPtr, le);
  const gpsPtr = ifd0[0x8825];
  if (typeof gpsPtr === 'number') gps = readIfd(dv, bytes, gpsPtr, le);
  return { ifd0, exif, gps };
}

const TIFF_TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8 };

function readIfd(dv: DataView, bytes: Uint8Array, off: number, le: boolean): Record<number, TiffValue> {
  const tags: Record<number, TiffValue> = {};
  if (off <= 0 || off + 2 > bytes.length) return tags;
  const count = dv.getUint16(off, le);
  let p = off + 2;
  for (let i = 0; i < count; i++) {
    if (p + 12 > bytes.length) break;
    const tag = dv.getUint16(p, le);
    const type = dv.getUint16(p + 2, le);
    const n = dv.getUint32(p + 4, le);
    const val = readTiffValue(dv, bytes, p + 8, type, n, le);
    if (val !== undefined) tags[tag] = val;
    p += 12;
  }
  return tags;
}

function readTiffValue(dv: DataView, bytes: Uint8Array, ptr: number, type: number, count: number, le: boolean): TiffValue | undefined {
  const size = TIFF_TYPE_SIZE[type];
  if (!size || count <= 0) return undefined;
  const byteLen = size * count;
  let dataOff = ptr;
  if (byteLen > 4) dataOff = dv.getUint32(ptr, le);
  if (dataOff < 0 || dataOff + byteLen > bytes.length) return undefined;
  if (type === 2) { // ASCII, NUL-terminated
    let s = '';
    for (let i = 0; i < count; i++) {
      const c = bytes[dataOff + i];
      if (c === undefined || c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }
  const readOne = (o: number): number => {
    switch (type) {
      case 1: case 7: return dv.getUint8(o);
      case 3: return dv.getUint16(o, le);
      case 4: return dv.getUint32(o, le);
      case 6: return dv.getInt8(o);
      case 8: return dv.getInt16(o, le);
      case 9: return dv.getInt32(o, le);
      case 5: { const d = dv.getUint32(o + 4, le); return d ? dv.getUint32(o, le) / d : 0; }
      case 10: { const d = dv.getInt32(o + 4, le); return d ? dv.getInt32(o, le) / d : 0; }
      default: return 0;
    }
  };
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(readOne(dataOff + i * size));
  return out.length === 1 ? (out[0] as number) : out;
}

export interface Id3Tags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
}

/** Minimal ID3v2 (2.2/2.3/2.4) text-frame reader - enough for the common tags. */
export function parseId3v2(bytes: Uint8Array): Id3Tags | null {
  if (bytes.length < 10 || ascii(bytes, 0, 3) !== 'ID3') return null;
  const major = bytes[3] ?? 0;
  const dv = view(bytes);
  const totalSize = synchsafe(bytes, 6);
  const end = Math.min(10 + totalSize, bytes.length);
  const idLen = major >= 3 ? 4 : 3;
  const hdrLen = major >= 3 ? 10 : 6;
  const frames: Record<string, string> = {};
  let off = 10;
  while (off + hdrLen <= end) {
    const id = ascii(bytes, off, idLen);
    if (!/^[A-Z0-9]+$/.test(id)) break; // padding / end of frames
    let frameSize: number;
    if (major === 4) frameSize = synchsafe(bytes, off + 4);
    else if (major === 3) frameSize = dv.getUint32(off + 4);
    else frameSize = ((bytes[off + 3] ?? 0) << 16) | ((bytes[off + 4] ?? 0) << 8) | (bytes[off + 5] ?? 0);
    const dataOff = off + hdrLen;
    if (frameSize <= 0 || dataOff + frameSize > end) break;
    if (id[0] === 'T') frames[id] = decodeId3Text(bytes.subarray(dataOff, dataOff + frameSize));
    off = dataOff + frameSize;
  }
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) { const v = frames[k]; if (v) return v; }
    return undefined;
  };
  const out: Id3Tags = {
    title: pick('TIT2', 'TT2'),
    artist: pick('TPE1', 'TP1'),
    album: pick('TALB', 'TAL'),
    year: pick('TDRC', 'TYER', 'TYE'),
    genre: pick('TCON', 'TCO'),
  };
  if (out.year) out.year = out.year.slice(0, 4);
  if (out.genre) out.genre = out.genre.replace(/^\((\d+)\)$/, '$1');
  return out;
}

function decodeId3Text(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const enc = bytes[0];
  const body = bytes.subarray(1);
  let label = 'latin1';
  if (enc === 1) label = 'utf-16';
  else if (enc === 2) label = 'utf-16be';
  else if (enc === 3) label = 'utf-8';
  let s = '';
  try { s = new TextDecoder(label).decode(body); }
  catch { s = ascii(body, 0, body.length); }
  return s.replace(/\x00+$/, '').trim();
}

export interface LottieMeta {
  width?: number;
  height?: number;
  frames?: number;
  durationSec?: number;
  fps?: number;
}

/** Read a Lottie JSON's dimensions and timeline (w/h/ip/op/fr). */
export function lottieMetaFromJson(json: unknown): LottieMeta | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Record<string, unknown>;
  const w = finite(j.w);
  const h = finite(j.h);
  const ip = finite(j.ip) ?? 0;
  const op = finite(j.op);
  const fr = finite(j.fr);
  const out: LottieMeta = {};
  if (w) out.width = w;
  if (h) out.height = h;
  if (op != null && op > ip) {
    out.frames = Math.max(0, Math.round(op - ip));
    if (fr && fr > 0) { out.durationSec = (op - ip) / fr; out.fps = fr; }
  }
  return out;
}

export interface SvgMeta {
  viewBox?: string;
  width?: number;
  height?: number;
}

/** Read viewBox / width / height off the opening <svg> tag. */
export function parseSvgMeta(text: string): SvgMeta | null {
  const tag = text.match(/<svg\b[^>]*>/i)?.[0];
  if (!tag) return null;
  const out: SvgMeta = {};
  const vb = tag.match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  if (vb) out.viewBox = vb.trim();
  const w = parseFloat(tag.match(/\bwidth\s*=\s*["']([\d.]+)/i)?.[1] ?? '');
  const h = parseFloat(tag.match(/\bheight\s*=\s*["']([\d.]+)/i)?.[1] ?? '');
  if (Number.isFinite(w) && w > 0) out.width = w;
  if (Number.isFinite(h) && h > 0) out.height = h;
  return out;
}

// PDF: count leaf page objects and read the first MediaBox (points).
function countPdfPages(text: string): number {
  const m = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return m ? m.length : 0;
}

function firstMediaBox(text: string): { w: number; h: number } | null {
  const m = text.match(/\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/);
  if (!m) return null;
  const x0 = Number(m[1]);
  const y0 = Number(m[2]);
  const x1 = Number(m[3]);
  const y1 = Number(m[4]);
  const w = Math.round(Math.abs(x1 - x0));
  const h = Math.round(Math.abs(y1 - y0));
  return w > 0 && h > 0 ? { w, h } : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

function view(b: Uint8Array): DataView {
  return new DataView(b.buffer, b.byteOffset, b.byteLength);
}

function ascii(bytes: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    const c = bytes[off + i];
    if (c === undefined) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function synchsafe(bytes: Uint8Array, off: number): number {
  const b0 = bytes[off] ?? 0;
  const b1 = bytes[off + 1] ?? 0;
  const b2 = bytes[off + 2] ?? 0;
  const b3 = bytes[off + 3] ?? 0;
  return ((b0 & 0x7f) << 21) | ((b1 & 0x7f) << 14) | ((b2 & 0x7f) << 7) | (b3 & 0x7f);
}

function finite(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function asStr(v: TiffValue | undefined): string {
  if (v == null) return '';
  return Array.isArray(v) ? '' : String(v).trim();
}

function asNum(v: TiffValue | undefined): number | undefined {
  if (typeof v === 'number') return v;
  if (Array.isArray(v) && typeof v[0] === 'number') return v[0];
  return undefined;
}

function pruneEmpty<T extends Record<string, string | undefined>>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k in o) { const v = o[k]; if (v) out[k] = v; }
  return out;
}

function tagsToObj(tags: { title?: string; artist?: string; album?: string; date?: Date; genre?: string } | null | undefined): Id3Tags {
  if (!tags) return {};
  const out: Id3Tags = {};
  if (tags.title) out.title = tags.title;
  if (tags.artist) out.artist = tags.artist;
  if (tags.album) out.album = tags.album;
  if (tags.genre) out.genre = tags.genre;
  if (tags.date instanceof Date && !Number.isNaN(tags.date.getTime())) out.year = String(tags.date.getFullYear());
  return out;
}

async function decodeDims(blob: Blob): Promise<{ w: number; h: number } | null> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(blob);
      const d = { w: bmp.width, h: bmp.height };
      bmp.close?.();
      if (d.w > 0 && d.h > 0) return d;
    }
  } catch { /* fall through */ }
  try {
    if (typeof Image === 'function' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(blob);
      const d = await new Promise<{ w: number; h: number } | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = url;
      });
      URL.revokeObjectURL(url);
      if (d && d.w > 0 && d.h > 0) return d;
    }
  } catch { /* skip */ }
  return null;
}

function metaBytes(ref: AssetRef): number | null {
  const n = Number(ref.meta?.bytes);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function metaDurationSec(ref: AssetRef): number | null {
  const n = Number(ref.meta?.durationMs);
  return Number.isFinite(n) && n > 0 ? n / 1000 : null;
}

async function headSize(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const len = Number(res.headers.get('Content-Length'));
    if (Number.isFinite(len) && len > 0) return len;
  } catch { /* HEAD not supported (blob:/data:) */ }
  return null;
}

async function fetchBlob(url: string): Promise<Blob | null> {
  try { return await (await fetch(url)).blob(); }
  catch { return null; }
}

async function readHead(blob: Blob, max: number): Promise<Uint8Array> {
  const slice = blob.size > max ? blob.slice(0, max) : blob;
  return new Uint8Array(await slice.arrayBuffer());
}

function safeDecode(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: false }).decode(bytes); }
  catch { return ascii(bytes, 0, bytes.length); }
}

function latin1(bytes: Uint8Array): string {
  try { return new TextDecoder('latin1').decode(bytes); }
  catch { return ascii(bytes, 0, bytes.length); }
}

// ── formatters ───────────────────────────────────────────────────────────────

function trimNum(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${trimNum(n / (1024 * 1024))} MB`;
  return `${trimNum(n / (1024 * 1024 * 1024))} GB`;
}

function formatDuration(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

function formatSampleRate(hz: number): string {
  return hz >= 1000 ? `${Number((hz / 1000).toFixed(3))} kHz` : `${Math.round(hz)} Hz`;
}

function formatBitrate(bps: number): string {
  return bps >= 1_000_000 ? `${Number((bps / 1_000_000).toFixed(2))} Mbps` : `${Math.round(bps / 1000)} kbps`;
}

function formatFps(fps: number): string {
  return Math.abs(fps - Math.round(fps)) < 0.05 ? String(Math.round(fps)) : fps.toFixed(2);
}

function channelLabel(n: number): string {
  if (n === 1) return t('Mono');
  if (n === 2) return t('Stereo');
  return `${n} ${t('channels')}`;
}

function depthLabel(png: PngMeta): string {
  const names: Record<number, string> = { 0: 'Grayscale', 2: 'RGB', 3: 'Indexed', 4: 'Grayscale+Alpha', 6: 'RGBA' };
  const name = png.colorType != null ? names[png.colorType] : undefined;
  return name ? `${png.bitDepth}-bit ${name}` : `${png.bitDepth}-bit`;
}

function codecLabel(codec: string): string {
  const map: Record<string, string> = { avc: 'H.264', hevc: 'H.265', vp8: 'VP8', vp9: 'VP9', av1: 'AV1', aac: 'AAC', opus: 'Opus', vorbis: 'Vorbis', flac: 'FLAC', mp3: 'MP3' };
  const key = codec.toLowerCase();
  return map[key] ?? codec.toUpperCase();
}

function orientationLabel(o: number): string {
  const map: Record<number, string> = {
    2: 'Mirror horizontal',
    3: 'Rotate 180°',
    4: 'Mirror vertical',
    5: 'Mirror + rotate 90° CCW',
    6: 'Rotate 90° CW',
    7: 'Mirror + rotate 90° CW',
    8: 'Rotate 90° CCW',
  };
  return map[o] ?? '';
}

function formatExifDate(s: string): string {
  // EXIF form "YYYY:MM:DD HH:MM:SS" -> "YYYY-MM-DD HH:MM".
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
  return s.trim();
}

function formatExposure(sec: number): string {
  if (sec >= 1) return `${trimNum(sec)} s`;
  return `1/${Math.round(1 / sec)} s`;
}

function gpsCoords(gps: Record<number, TiffValue>): string | null {
  const lat = gps[0x0002];
  const lon = gps[0x0004];
  if (!Array.isArray(lat) || !Array.isArray(lon) || lat.length < 3 || lon.length < 3) return null;
  const latRef = asStr(gps[0x0001]).toUpperCase();
  const lonRef = asStr(gps[0x0003]).toUpperCase();
  const dms = (a: number[]): number => (a[0] ?? 0) + (a[1] ?? 0) / 60 + (a[2] ?? 0) / 3600;
  const dLat = dms(lat) * (latRef === 'S' ? -1 : 1);
  const dLon = dms(lon) * (lonRef === 'W' ? -1 : 1);
  if (!Number.isFinite(dLat) || !Number.isFinite(dLon)) return null;
  return `${dLat.toFixed(5)}, ${dLon.toFixed(5)}`;
}
