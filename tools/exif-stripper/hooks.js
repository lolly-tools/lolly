/* global onInit, onInput, exportFile */
/**
 * EXIF & Metadata Stripper — runs entirely in the sandboxed hook context (no
 * DOM, no network). Reads the picked file's bytes (input.value.bytes), reports
 * what hidden metadata it carries, and produces a clean copy by *lossless byte
 * surgery* — it removes the metadata segments/chunks and copies the image data
 * through untouched, so pixels are never re-compressed.
 *
 * JPEG: drop APP1 (EXIF/XMP), APP2 (ICC), APP13 (IPTC/Photoshop) and COM
 *       comment segments; keep APP0 (JFIF) and all image segments.
 * PNG : drop tEXt / zTXt / iTXt / eXIf / tIME chunks; keep everything else.
 */

// ─── byte helpers ────────────────────────────────────────────────────────────

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

// ─── dispatch ────────────────────────────────────────────────────────────────

function stripBytes(bytes) {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return stripJpeg(bytes);
  if (isPng(bytes)) return stripPng(bytes);
  return bytes; // unrecognised — leave untouched rather than risk corruption
}

function analyze(bytes) {
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

// ─── lifecycle ───────────────────────────────────────────────────────────────

function patch({ model }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  const f = inputs.photo;
  const blank = { hasFile: false, findings: [], nothingFound: false, fileName: '', fileSize: '', kind: '', metaSummary: '', cleanSize: '' };
  if (!f || !f.bytes) return blank;
  let kind = 'file', findings = [];
  try { ({ kind, findings } = analyze(f.bytes)); } catch (e) { return { ...blank, hasFile: true, fileName: f.name, fileSize: fmtBytes(f.size), kind: 'file' }; }
  let cleanLen = f.bytes.length;
  try { cleanLen = stripBytes(f.bytes).length; } catch (e) { /* keep original size */ }
  const removed = f.bytes.length - cleanLen;
  return {
    hasFile: true,
    fileName: f.name,
    fileSize: fmtBytes(f.size),
    kind,
    findings,
    nothingFound: findings.length === 0,
    cleanSize: fmtBytes(cleanLen),
    metaSummary: findings.length
      ? `Found ${findings.length} metadata item${findings.length > 1 ? 's' : ''} — ${fmtBytes(removed)} will be removed.`
      : '',
  };
}

function onInit(ctx) { return patch(ctx); }
function onInput(ctx) { return patch(ctx); }

function exportFile({ model }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  const f = inputs.photo;
  if (!f || !f.bytes) throw new Error('Choose a photo first.');
  const cleaned = stripBytes(f.bytes);
  const dot = f.name.lastIndexOf('.');
  const filename = dot > 0 ? `${f.name.slice(0, dot)}-clean${f.name.slice(dot)}` : `${f.name}-clean`;
  return { bytes: cleaned, mime: f.mime, filename };
}
