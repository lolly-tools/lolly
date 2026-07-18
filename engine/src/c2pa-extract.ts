// SPDX-License-Identifier: MPL-2.0
/**
 * C2PA structural extraction — the read side's format-sniffing, CBOR decoding,
 * JUMBF-store walking, and per-container manifest extraction (pdf/png/jpeg/gif/
 * svg/tiff/webp/mp4/webm), plus the ingredient-preparation helpers built on top.
 * Split out of c2pa-verify.ts so the cryptographic verification core (COSE
 * signature checks, X.509/trust-chain walking, the hard-binding hash check) is
 * reviewable in isolation — nothing in this file does or checks any cryptography;
 * it only parses bytes into structure. c2pa-verify.ts imports all of this back.
 */

import { C2PA_BMFF_UUID, C2PA_ATTACHMENT_MIME } from './c2pa.ts';
import { EBML_ID, SEGMENT_ID, readId, readVint, idAt } from './video-meta.ts';
import { concatBytes, bytesToHex as hexOf, bytesToBin, base64ToBytes } from './bytes.ts';
// Type-only — no runtime cycle: c2pa-verify.ts imports VALUES from this file,
// this file imports only a TYPE back (erased at compile time).
import type { C2paHistoryStep } from './c2pa-verify.ts';

const td = new TextDecoder();
const te = new TextEncoder();

// ─── CBOR decoder ─────────────────────────────────────────────────────────────
// Full enough for the wild, not just our writer: definite AND indefinite
// lengths, half/single/double floats — foreign manifests (Adobe et al.) use
// them freely and a good-citizen validator must still read those claims.

const CBOR_BREAK = Symbol('cbor break');

// Hostile manifests must fail with a prompt throw, never a hang or a blown
// stack (the fuzz suite asserts both). Two guards below serve that:
//   - every multi-byte length head is bounds-checked BEFORE the read — an
//     out-of-range Uint8Array read is undefined, which NaN-poisons the offset
//     and turns the indefinite-chunk loop into an infinite one (the GIF lesson,
//     again);
//   - nesting is capped — real claims nest a handful of levels, and a 64 KB
//     file of 0x81 bytes must not recurse 64K frames deep.
// The DER reader (der-read.ts) enforces the same length-head invariant for
// the certificate walk.
const MAX_CBOR_DEPTH = 64;

function decodeItem(b: Uint8Array, i: number, depth = 0): [unknown, number] {
  if (i >= b.length) throw new Error('cbor: truncated');
  if (depth > MAX_CBOR_DEPTH) throw new Error('cbor: nesting too deep');
  const ib = b[i++]!;
  const major = ib >> 5;
  let n = ib & 0x1f;
  const indefinite = n === 31;
  const need = (k: number): void => { if (i + k > b.length) throw new Error('cbor: truncated length head'); };
  if (indefinite) {
    if (major < 2 || major === 6) throw new Error('cbor: reserved indefinite head');
    if (major === 7) return [CBOR_BREAK, i];
  } else if (n === 24) { need(1); n = b[i]!; i += 1; }
  else if (n === 25) { need(2); n = (b[i]! << 8) | b[i + 1]!; i += 2; }
  else if (n === 26) { need(4); n = b[i]! * 0x1000000 + ((b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!); i += 4; }
  else if (n === 27) { need(8); n = Number(new DataView(b.buffer, b.byteOffset + i, 8).getBigUint64(0)); i += 8; }
  else if (n > 27) throw new Error('cbor: reserved length head');
  switch (major) {
    case 0: return [n, i];
    case 1: return [-1 - n, i];
    case 2:
    case 3: {
      if (indefinite) {
        // Chunked string/bytes: definite-length chunks of the same major, then break.
        const parts: Uint8Array[] = [];
        for (;;) {
          const [v, j] = decodeItem(b, i, depth + 1);
          i = j;
          if (v === CBOR_BREAK) break;
          parts.push(major === 2 ? (v as Uint8Array) : te.encode(v as string));
        }
        const whole = concatBytes(parts);
        return [major === 2 ? whole : td.decode(whole), i];
      }
      if (i + n > b.length) throw new Error('cbor: truncated string');
      return [major === 2 ? b.slice(i, i + n) : td.decode(b.slice(i, i + n)), i + n];
    }
    case 4: {
      const a: unknown[] = [];
      for (let k = 0; indefinite || k < n; k++) {
        const [v, j] = decodeItem(b, i, depth + 1);
        i = j;
        if (v === CBOR_BREAK) break;
        a.push(v);
      }
      return [a, i];
    }
    case 5: {
      const m = new Map<unknown, unknown>();
      for (let k = 0; indefinite || k < n; k++) {
        const [key, j] = decodeItem(b, i, depth + 1);
        if (key === CBOR_BREAK) { i = j; break; }
        const [v, j2] = decodeItem(b, j, depth + 1);
        m.set(key, v);
        i = j2;
      }
      return [m, i];
    }
    case 6: { const [v, j] = decodeItem(b, i, depth + 1); return [{ tag: n, value: v }, j]; }
    default: {
      if (n === 20) return [false, i];
      if (n === 21) return [true, i];
      if (n === 22 || n === 23) return [null, i];
      const head = ib & 0x1f;
      if (head === 25) { // half float
        const h = (b[i - 2]! << 8) | b[i - 1]!; // n already consumed the 2 bytes
        const sign = h & 0x8000 ? -1 : 1;
        const exp = (h >> 10) & 0x1f;
        const frac = h & 0x3ff;
        const v = exp === 0 ? sign * frac * 2 ** -24
          : exp === 31 ? (frac ? NaN : sign * Infinity)
          : sign * (1 + frac / 1024) * 2 ** (exp - 15);
        return [v, i];
      }
      if (head === 26) return [new DataView(b.buffer, b.byteOffset + i - 4, 4).getFloat32(0), i];
      if (head === 27) return [new DataView(b.buffer, b.byteOffset + i - 8, 8).getFloat64(0), i];
      throw new Error('cbor: unsupported simple value');
    }
  }
}

/** Decode one CBOR item (maps → Map, tags → {tag, value}). Throws on junk. */
export function decodeCbor(bytes: Uint8Array): unknown {
  const [v, end] = decodeItem(bytes, 0);
  if (end !== bytes.length) throw new Error('cbor: trailing bytes after item');
  return v;
}

// ─── JUMBF walker ─────────────────────────────────────────────────────────────

interface JumbfBox { type: string; start: number; payloadStart: number; end: number; }
interface Superbox { uuid: string; label: string; children: JumbfBox[]; box: JumbfBox; }

function walkBoxes(bytes: Uint8Array, start: number, end: number): JumbfBox[] {
  const boxes: JumbfBox[] = [];
  let i = start;
  while (i < end) {
    if (i + 8 > end) throw new Error('jumbf: truncated box header');
    const len = new DataView(bytes.buffer, bytes.byteOffset).getUint32(i);
    const type = String.fromCharCode(bytes[i + 4]!, bytes[i + 5]!, bytes[i + 6]!, bytes[i + 7]!);
    if (len < 8 || i + len > end) throw new Error(`jumbf: box ${type} overruns its container`);
    boxes.push({ type, start: i, payloadStart: i + 8, end: i + len });
    i += len;
  }
  return boxes;
}

function parseSuperbox(bytes: Uint8Array, box: JumbfBox): Superbox {
  if (box.type !== 'jumb') throw new Error(`jumbf: expected superbox, got ${box.type}`);
  const kids = walkBoxes(bytes, box.payloadStart, box.end);
  const desc = kids[0];
  if (!kids.length || !desc || desc.type !== 'jumd') throw new Error('jumbf: superbox missing description box');
  const uuid = hexOf(bytes.slice(desc.payloadStart, desc.payloadStart + 16));
  const rest = bytes.slice(desc.payloadStart + 17, desc.end);
  const nul = rest.indexOf(0);
  return {
    uuid,
    label: nul >= 0 ? td.decode(rest.slice(0, nul)) : '',
    children: kids.slice(1),
    box,
  };
}

const contentOf = (bytes: Uint8Array, sub: Superbox): Uint8Array => bytes.slice(sub.children[0]!.payloadStart, sub.children[0]!.end);

interface C2paAssertion { label: string; content: Uint8Array; payload: Uint8Array; }
export interface C2paStoreParts {
  manifestLabel: string;
  assertions: C2paAssertion[];
  claimBytes: Uint8Array;
  signatureBytes: Uint8Array;
  claimVersion: 1 | 2;
}

/**
 * Parse a C2PA JUMBF store into its named parts. Throws with a specific
 * message when the structure isn't a store this verifier understands.
 */
export function parseC2paStore(store: Uint8Array): C2paStoreParts {
  const top = walkBoxes(store, 0, store.length);
  if (!top.length) throw new Error('empty manifest store');
  const s = parseSuperbox(store, top[0]!);
  if (s.label !== 'c2pa') throw new Error(`store label is '${s.label}', expected 'c2pa'`);
  if (!s.children.length) throw new Error('store has no manifest');
  // A store may hold several manifests (ingredients); the ACTIVE manifest is
  // the last superbox (C2PA 1.x §"active manifest").
  const manifest = parseSuperbox(store, s.children[s.children.length - 1]!);
  const parts: {
    manifestLabel: string;
    assertions: C2paAssertion[];
    claimBytes?: Uint8Array;
    signatureBytes?: Uint8Array;
    claimVersion: 1 | 2;
  } = { manifestLabel: manifest.label, assertions: [], claimVersion: 1 };
  for (const child of manifest.children) {
    const sub = parseSuperbox(store, child);
    if (sub.label === 'c2pa.assertions') {
      for (const a of sub.children) {
        const ab = parseSuperbox(store, a);
        parts.assertions.push({
          label: ab.label,
          content: contentOf(store, ab),
          // Hashed URIs cover the superbox payload — after the 8-byte header.
          payload: store.slice(ab.box.start + 8, ab.box.end),
        });
      }
    } else if (sub.label === 'c2pa.claim') {
      parts.claimBytes = contentOf(store, sub);
      parts.claimVersion = 1;
    } else if (sub.label === 'c2pa.claim.v2') {
      // C2PA 2.x active-manifest claim. Same JUMBF box UUID as v1 (c2cl) — the
      // label is the version discriminator. The claim map differs
      // (created_assertions/gathered_assertions instead of a single assertions
      // array, a required claim_generator_info map, no free-text
      // claim_generator string); those deltas are handled where the claim is
      // read in verifyC2pa.
      parts.claimBytes = contentOf(store, sub);
      parts.claimVersion = 2;
    } else if (sub.label === 'c2pa.signature') {
      parts.signatureBytes = contentOf(store, sub);
    }
  }
  if (!parts.claimBytes) throw new Error('manifest has no claim');
  if (!parts.signatureBytes) throw new Error('manifest has no claim signature');
  return parts as C2paStoreParts;
}

// ─── PDF manifest extraction ──────────────────────────────────────────────────

/**
 * Locate the C2PA manifest a PDF carries as an associated embedded file
 * (/AFRelationship /C2PA_Manifest → /EF stream). Returns
 * { manifest: Uint8Array, start: byte offset of the stream data } or null when
 * the PDF carries no credential. Throws when a credential is declared but the
 * stream can't be read (indirect /Length, /Filter compression).
 */
export function extractC2paFromPdf(pdfBytes: Uint8Array): { manifest: Uint8Array; start: number } | null {
  const bin = bytesToBin(pdfBytes);
  if (!bin.startsWith('%PDF-')) throw new Error('not a PDF file');

  // Newest incremental update wins: take the LAST C2PA filespec in the file.
  let fsAt = -1;
  for (let m: RegExpExecArray | null, re = /\/AFRelationship\s*\/C2PA_Manifest\b/g; (m = re.exec(bin)); ) fsAt = m.index;
  if (fsAt < 0) return null;

  // The enclosing filespec object: nearest "N G obj" head before the match.
  let objHead: RegExpExecArray | null = null;
  for (let m: RegExpExecArray | null, re = /(\d+)\s+(\d+)\s+obj\b/g; (m = re.exec(bin)) && m.index < fsAt; ) objHead = m;
  const dictEnd = bin.indexOf('endobj', fsAt);
  if (!objHead || dictEnd < 0) throw new Error('malformed C2PA filespec object');
  const dictSrc = bin.slice(objHead.index, dictEnd);
  const ef = /\/EF\s*<<([^>]*)>>/.exec(dictSrc);
  const fRef = ef && /\/(?:F|UF)\s+(\d+)\s+(\d+)\s+R/.exec(ef[1]!);
  if (!fRef) throw new Error('C2PA filespec has no readable /EF stream reference');

  // The embedded-file stream object (again: last occurrence = newest).
  let at = -1;
  for (let m: RegExpExecArray | null, re = new RegExp(`(?:^|[^0-9])(${fRef[1]!}\\s+${fRef[2]!}\\s+obj)\\b`, 'g'); (m = re.exec(bin)); ) {
    at = m.index + m[0].length - m[1]!.length;
  }
  if (at < 0) throw new Error('C2PA manifest stream object not found');
  const streamKw = bin.indexOf('stream', at);
  if (streamKw < 0) throw new Error('C2PA manifest object has no stream');
  const head = bin.slice(at, streamKw);
  if (/\/Filter\b/.test(head)) throw new Error('C2PA manifest stream is compressed; cannot read');
  if (/\/Length\s+\d+\s+\d+\s+R/.test(head)) throw new Error('C2PA manifest stream has an indirect /Length; cannot read');
  const lenM = /\/Length\s+(\d+)/.exec(head);
  if (!lenM) throw new Error('C2PA manifest stream has no /Length');
  let start = streamKw + 6;
  if (bin[start] === '\r') start++;
  if (bin[start] === '\n') start++;
  const length = +lenM[1]!;
  if (start + length > pdfBytes.length) throw new Error('C2PA manifest stream overruns the file');
  return { manifest: pdfBytes.slice(start, start + length), start };
}

// ─── other containers (read side, mirroring c2pa-rs asset handlers) ──────────

const ascii = (b: Uint8Array, o: number, n: number): string => String.fromCharCode(...b.subarray(o, o + n));

export type SniffFormat = 'pdf' | 'png' | 'jpeg' | 'gif' | 'svg' | 'tiff' | 'webp' | 'mp4' | 'webm' | 'mkv';

/** Sniff the container format from magic bytes ('pdf'|'png'|'jpeg'|'gif'|'svg'|'tiff'|'webp'|'mp4'|'webm'|'mkv'|null). */
export function sniffFormat(bytes: Uint8Array): SniffFormat | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (ascii(bytes, 0, 3) === 'GIF') return 'gif';
  if (ascii(bytes, 0, 4) === '%PDF') return 'pdf';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[3] === 0x2a)) return 'tiff';
  if (ascii(bytes, 4, 4) === 'ftyp') {
    // ISO BMFF. Image-sequence brands (avif/heic) are photos, not videos —
    // labelling them mp4 would misreport them, so they keep the honest
    // 'unrecognised format' answer until they get their own support.
    const brand = ascii(bytes, 8, 4);
    const image = ['avif', 'avis', 'heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'mif2', 'msf1'];
    return image.includes(brand) ? null : 'mp4';
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    // EBML — webm and mkv share the magic; the DocType string (in the small
    // EBML header, always near the front) tells them apart for the label.
    return bytesToBin(bytes.subarray(0, 64)).includes('matroska') ? 'mkv' : 'webm';
  }
  // SVG has no magic — look for an <svg root in the first 4KB of text.
  const headBin = bytesToBin(bytes.subarray(0, 4096));
  if (/<svg[\s>]/.test(headBin)) return 'svg';
  return null;
}

// Each extractor returns { manifest: Uint8Array } or null (no credential),
// and throws when the container is malformed / a declared credential is
// unreadable. Reading rules mirror c2pa-rs (which backs the Verify site).

function extractC2paFromPng(png: Uint8Array): { manifest: Uint8Array } | null {
  const dv = new DataView(png.buffer, png.byteOffset);
  const found: Uint8Array[] = [];
  for (let i = 8; i + 8 <= png.length; ) {
    const len = dv.getUint32(i);
    const type = ascii(png, i + 4, 4);
    const end = i + len + 12;
    if (end > png.length) throw new Error('malformed PNG chunk');
    if (type === 'caBX') found.push(png.slice(i + 8, i + 8 + len));
    if (type === 'IEND') break;
    i = end;
  }
  if (found.length > 1) throw new Error('PNG has more than one caBX chunk');
  return found.length ? { manifest: found[0]! } : null;
}

function extractC2paFromJpeg(jpeg: Uint8Array): { manifest: Uint8Array } | null {
  // C2PA stores its manifest as a JUMBF box inside APP11 (0xFFEB) segments. A box
  // larger than JPEG's ~64 KB segment limit is split across many APP11 segments
  // that share one box-instance number (En) and carry a 1-based sequence counter
  // (Z); c2pa-rs repeats the 8-byte JUMBF LBox/TBox header in EVERY segment. We
  // group the segments by box instance, order each group by Z, then reassemble
  // the group whose superbox UUID is the c2pa manifest store — keeping the first
  // chunk's LBox/TBox and appending each chunk's payload.
  //
  // The start segment MUST be identified by its position in the sequence (Z===1),
  // NOT by scanning for "c2pa" at the manifest-store UUID offset: an assertion URL
  // like `self#jumbf=/c2pa/...` lands the bytes "c2pa" at that same offset inside
  // a *continuation* chunk, which used to be misread as a second manifest store
  // and wrongly rejected as "more than one manifest store".
  const boxes = new Map<number, Array<{ z: number; body: Uint8Array }>>();
  for (let i = 2; i + 4 <= jpeg.length; ) {
    if (jpeg[i] !== 0xff) break;
    const marker = jpeg[i + 1];
    if (marker! >= 0xd0 && marker! <= 0xd9) { i += 2; continue; }
    const le = (jpeg[i + 2]! << 8) | jpeg[i + 3]!;
    const end = i + 2 + le;
    if (end > jpeg.length) throw new Error('malformed JPEG segment');
    // APP11 JUMBF payload: CI(2)="JP" · En(2) box instance · Z(4) 1-based seq ·
    // LBox(4)/TBox(4) JUMBF header · box data. Need at least that 16-byte prefix.
    if (marker === 0xeb && le > 18) {
      const c = jpeg.subarray(i + 4, end);
      if (c[0] === 0x4a && c[1] === 0x50) { // CI == "JP" (JUMBF); ignore other APP11
        const en = (c[2]! << 8) | c[3]!;
        const z = ((c[4]! << 24) | (c[5]! << 16) | (c[6]! << 8) | c[7]!) >>> 0;
        let group = boxes.get(en);
        if (!group) { group = []; boxes.set(en, group); }
        group.push({ z, body: c });
      }
    }
    if (marker === 0xda) break;
    i = end;
  }
  // Reassemble every JUMBF box instance whose first chunk is the c2pa manifest
  // store (its superbox `jumd` UUID begins with "c2pa" at offset 24).
  const stores: Uint8Array[] = [];
  for (const group of boxes.values()) {
    group.sort((a, b) => a.z - b.z);
    const first = group[0]!.body;
    if (!(first.length > 28 && ascii(first, 24, 4) === 'c2pa')) continue;
    // First chunk keeps the JUMBF LBox/TBox (strip CI/En/Z); every continuation
    // is raw box data (strip CI/En/Z + the repeated LBox/TBox).
    const parts = group.map((s, idx) => idx === 0 ? s.body.subarray(8) : s.body.subarray(16));
    const manifest = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) { manifest.set(p, o); o += p.length; }
    stores.push(manifest);
  }
  if (stores.length > 1) throw new Error('JPEG has more than one manifest store');
  return stores.length ? { manifest: stores[0]! } : null;
}

function extractC2paFromGif(gif: Uint8Array): { manifest: Uint8Array } | null {
  if (ascii(gif, 0, 3) !== 'GIF') throw new Error('not a GIF');
  const packed = gif[10]!;
  let i = 13;
  if (packed & 0x80) i += 3 * (1 << ((packed & 0x07) + 1));
  while (i < gif.length) {
    const b = gif[i];
    if (b === 0x2c || b === 0x3b) break; // c2pa-rs stops at the first image
    if (b !== 0x21) throw new Error('malformed GIF block');
    const label = gif[i + 1];
    let j = i + 2;
    // Every gif[j] read below must be in-bounds BEFORE use: an out-of-range
    // Uint8Array read is undefined, which NaN-poisons j and turns the walk
    // into an unbreakable infinite loop (a hang, unlike a throw, escapes the
    // caller's try/catch and freezes the tab — /valid takes arbitrary files).
    if (j >= gif.length) throw new Error('truncated GIF block');
    if (label === 0xff || label === 0x01 || label === 0xf9) j += 1 + gif[j]!;
    const isC2pa = label === 0xff && ascii(gif, i + 3, 8) === 'C2PA_GIF'
      && gif[i + 11] === 0x01 && gif[i + 12] === 0x00 && gif[i + 13] === 0x00;
    const parts: Uint8Array[] = [];
    while (j < gif.length && gif[j] !== 0x00) {
      const n = gif[j]!;
      if (j + 1 + n > gif.length) throw new Error('malformed GIF sub-blocks');
      if (isC2pa) parts.push(gif.subarray(j + 1, j + 1 + n));
      j += 1 + n;
    }
    if (j >= gif.length) throw new Error('truncated GIF sub-blocks');
    j += 1;
    if (isC2pa) {
      return { manifest: concatBytes(parts) };
    }
    i = j;
  }
  return null;
}

function extractC2paFromSvg(svg: Uint8Array): { manifest: Uint8Array } | null {
  const bin = bytesToBin(svg);
  const m = /<c2pa:manifest[^>]*>([^<]*)<\/c2pa:manifest>/.exec(bin);
  if (!m) return null;
  const b64 = m[1]!.trim();
  if (!b64) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw new Error('SVG manifest is not valid base64');
  return { manifest: base64ToBytes(b64) };
}

interface IfdEntry { tag: number; type: number; count: number; valueOffset: number; }
interface IfdParse { entries: IfdEntry[]; next: number; }

function extractC2paFromTiff(tiff: Uint8Array): { manifest: Uint8Array } | null {
  const le = tiff[0] === 0x49;
  const dv = new DataView(tiff.buffer, tiff.byteOffset);
  if (dv.getUint16(2, le) !== 42) throw new Error('BigTIFF is not supported');
  const readIfd = (off: number): IfdParse => {
    const count = dv.getUint16(off, le);
    if (off + 2 + count * 12 + 4 > tiff.length) throw new Error('malformed TIFF IFD');
    const entries: IfdEntry[] = [];
    for (let k = 0; k < count; k++) {
      const e = off + 2 + k * 12;
      entries.push({ tag: dv.getUint16(e, le), type: dv.getUint16(e + 2, le), count: dv.getUint32(e + 4, le), valueOffset: dv.getUint32(e + 8, le) });
    }
    return { entries, next: dv.getUint32(off + 2 + count * 12, le) };
  };
  const seen = new Set<number>();
  let off = dv.getUint32(4, le);
  let first: IfdParse | null = null;
  let last: IfdParse | null = null;
  while (off && !seen.has(off)) {
    seen.add(off);
    const ifd = readIfd(off);
    if (!first) first = ifd;
    last = ifd;
    off = ifd.next;
  }
  if (!last) return null;
  // Last IFD first, then the first-IFD fallback (legacy files) — as c2pa-rs.
  const entry = last.entries.find((e) => e.tag === 0xcd41) || first!.entries.find((e) => e.tag === 0xcd41);
  if (!entry) return null;
  if (entry.type !== 7) throw new Error('TIFF C2PA entry must be type UNDEFINED(7)');
  if (entry.valueOffset + entry.count > tiff.length) throw new Error('TIFF C2PA value overruns the file');
  return { manifest: tiff.slice(entry.valueOffset, entry.valueOffset + entry.count) };
}

function extractC2paFromWebp(webp: Uint8Array): { manifest: Uint8Array } | null {
  const dv = new DataView(webp.buffer, webp.byteOffset);
  for (let i = 12; i + 8 <= webp.length; ) {
    const size = dv.getUint32(i + 4, true);
    if (i + 8 + size > webp.length) throw new Error('malformed WebP chunk');
    if (ascii(webp, i, 4) === 'C2PA') return { manifest: webp.slice(i + 8, i + 8 + size) };
    i += 8 + size + (size & 1);
  }
  return null;
}

// ── MP4 / ISO BMFF ──
// Every offset is bounds-checked BEFORE the read (the GIF lesson above): a
// truncated size field NaN-poisons offset arithmetic into a hang, not a throw.

const u32At = (b: Uint8Array, o: number): number => (b[o]! << 24 | b[o + 1]! << 16 | b[o + 2]! << 8 | b[o + 3]!) >>> 0;

export interface BmffBox { off: number; size: number; hdr: number; type: string; }

/**
 * Walk the file's top-level BMFF boxes → [{ off, size, hdr, type }] (hdr =
 * header length; 16 when a 64-bit largesize is present). Unlike the writer
 * (which refuses 64-bit boxes it would have to rewrite), reading handles them:
 * foreign files may legitimately carry >4GB mdat boxes.
 */
export function bmffTopBoxes(bytes: Uint8Array): BmffBox[] {
  const out: BmffBox[] = [];
  let off = 0;
  while (off < bytes.length) {
    if (off + 8 > bytes.length) throw new Error('truncated MP4 box header');
    let size = u32At(bytes, off);
    let hdr = 8;
    if (size === 1) {
      if (off + 16 > bytes.length) throw new Error('truncated MP4 box header');
      size = u32At(bytes, off + 8) * 2 ** 32 + u32At(bytes, off + 12);
      hdr = 16;
      if (!Number.isSafeInteger(size)) throw new Error('malformed MP4 box size');
    } else if (size === 0) {
      size = bytes.length - off; // "to end of file" (last box only)
    }
    if (size < hdr || off + size > bytes.length) throw new Error('malformed MP4 box');
    out.push({ off, size, hdr, type: ascii(bytes, off + 4, 4) });
    off += size;
  }
  return out;
}

const isC2paBmffBox = (bytes: Uint8Array, b: BmffBox): boolean =>
  b.type === 'uuid' && b.size >= b.hdr + 16 && C2PA_BMFF_UUID.every((v, i) => bytes[b.off + b.hdr + i] === v);

function extractC2paFromMp4(mp4: Uint8Array): { manifest: Uint8Array } | null {
  const boxes = bmffTopBoxes(mp4);
  const found: Uint8Array[] = [];
  for (const b of boxes.filter((x) => isC2paBmffBox(mp4, x))) {
    // uuid payload: version/flags (4), nul-terminated purpose, then for
    // purpose 'manifest' a u64-BE merkle box offset, then the JUMBF store.
    const boxEnd = b.off + b.size;
    const p = b.off + b.hdr + 16 + 4;
    if (p > boxEnd) throw new Error('malformed C2PA box');
    let q = p;
    while (q < boxEnd && mp4[q] !== 0) q++;
    if (q >= boxEnd) throw new Error('malformed C2PA box purpose');
    if (ascii(mp4, p, q - p) !== 'manifest') continue; // e.g. a 'merkle' box — not the store
    q += 1 + 8; // nul + merkle offset (0 for flat files; a fragmented binding fails honestly at the hash check)
    if (q > boxEnd) throw new Error('malformed C2PA box');
    found.push(mp4.slice(q, boxEnd));
  }
  if (found.length > 1) throw new Error('MP4 has more than one C2PA manifest box');
  return found.length ? { manifest: found[0]! } : null;
}

// ── WebM / Matroska ──
// Lolly's own mapping (there is no standardised one): the manifest is a
// Matroska attachment with mime type application/c2pa — see placeWebm in
// c2pa.js. Element ids: Attachments / AttachedFile / FileMimeType / FileData.
const MKV_ATTACHMENTS = 0x1941a469;
const MKV_ATTACHEDFILE = 0x61a7;
const MKV_FILEMIMETYPE = 0x4660;
const MKV_FILEDATA = 0x465c;

interface EbmlChild { id: number; off: number; dataOff: number; dataEnd: number; }

// Walk sibling EBML elements in [start, end) → [{ id, off, dataOff, dataEnd }].
// Stops cleanly at an unknown-size child (streaming Clusters — nothing after
// them can be measured); throws on malformed structure.
function ebmlChildren(bytes: Uint8Array, start: number, end: number): EbmlChild[] {
  const out: EbmlChild[] = [];
  let off = start;
  while (off < end) {
    const id = readId(bytes, off);
    const size = id && readVint(bytes, off + id.width);
    if (!id || !size) throw new Error('malformed Matroska element');
    if (size.unknown) break;
    const dataOff = off + id.width + size.width;
    const dataEnd = dataOff + size.value;
    if (dataEnd > end || dataEnd <= off) throw new Error('malformed Matroska element');
    out.push({ id: id.value, off, dataOff, dataEnd });
    off = dataEnd;
  }
  return out;
}

function extractC2paFromWebm(webm: Uint8Array): { manifest: Uint8Array } | null {
  if (!idAt(webm, 0, EBML_ID)) throw new Error('not an EBML file');
  const headSize = readVint(webm, EBML_ID.length);
  if (!headSize || headSize.unknown) throw new Error('malformed EBML header');
  const segOff = EBML_ID.length + headSize.width + headSize.value;
  if (!idAt(webm, segOff, SEGMENT_ID)) throw new Error('no Matroska Segment');
  const segSize = readVint(webm, segOff + SEGMENT_ID.length);
  if (!segSize) throw new Error('malformed Matroska Segment');
  const start = segOff + SEGMENT_ID.length + segSize.width;
  const end = segSize.unknown ? webm.length : start + segSize.value;
  if (end > webm.length) throw new Error('truncated Matroska Segment');

  const found: Uint8Array[] = [];
  for (const el of ebmlChildren(webm, start, end)) {
    if (el.id !== MKV_ATTACHMENTS) continue;
    for (const file of ebmlChildren(webm, el.dataOff, el.dataEnd)) {
      if (file.id !== MKV_ATTACHEDFILE) continue;
      let mime: string | null = null;
      let data: Uint8Array | null = null;
      for (const f of ebmlChildren(webm, file.dataOff, file.dataEnd)) {
        if (f.id === MKV_FILEMIMETYPE) mime = ascii(webm, f.dataOff, f.dataEnd - f.dataOff);
        if (f.id === MKV_FILEDATA) data = webm.slice(f.dataOff, f.dataEnd);
      }
      if (mime !== C2PA_ATTACHMENT_MIME) continue;
      if (!data || !data.length) throw new Error('Matroska C2PA attachment has no data');
      found.push(data);
    }
  }
  if (found.length > 1) throw new Error('Matroska file has more than one C2PA attachment');
  return found.length ? { manifest: found[0]! } : null;
}

export const EXTRACTORS: Record<SniffFormat, (bytes: Uint8Array) => { manifest: Uint8Array } | null> = {
  pdf: extractC2paFromPdf,
  png: extractC2paFromPng,
  jpeg: extractC2paFromJpeg,
  gif: extractC2paFromGif,
  svg: extractC2paFromSvg,
  tiff: extractC2paFromTiff,
  webp: extractC2paFromWebp,
  mp4: extractC2paFromMp4,
  webm: extractC2paFromWebm,
  mkv: extractC2paFromWebm,
};


// IPTC DigitalSourceType slugs that denote AI/ML-generated pixels. A file is
// flagged AI-generated when any recorded action carries one of these — full-AI
// ("generated") outranks the mixed-in ("composite") case if both appear.
const AI_SOURCE_TYPES: Record<string, 'generated' | 'composite'> = {
  trainedAlgorithmicMedia: 'generated',
  compositeWithTrainedAlgorithmicMedia: 'composite',
};
// Exported so read-side callers (e.g. the web shell's catalog/picker badge) can map a
// captured ingredient's digitalSourceType to the AI kind without re-deriving the slug set.
export const aiKind = (sourceType: unknown): 'generated' | 'composite' | undefined =>
  AI_SOURCE_TYPES[(typeof sourceType === 'string' ? sourceType : '').split('/').pop() ?? ''];

// Walk EVERY manifest in the store (active + all ingredient/parent manifests)
// and flatten their recorded actions in store order (oldest parent → active).
// AI provenance and the "created" step routinely live in a PARENT manifest — a
// chain that ends in a watermark + re-encode whose active manifest never records
// "created" at all — so reading only the active manifest (parseC2paStore) misses
// both the AI origin and the interesting creation steps. Every parse is guarded:
// a manifest we can't read is skipped, never fatal (this is a display nicety).
export function collectActionChain(store: Uint8Array): C2paHistoryStep[] {
  const chain: C2paHistoryStep[] = [];
  let root: Superbox;
  try {
    const top = walkBoxes(store, 0, store.length);
    if (!top.length) return chain;
    root = parseSuperbox(store, top[0]!);
  } catch { return chain; }
  if (root.label !== 'c2pa') return chain;
  for (const manifestBox of root.children) {
    let manifest: Superbox;
    try { manifest = parseSuperbox(store, manifestBox); } catch { continue; }
    // Pre-pass: this manifest's generator identity, attached to every step it
    // records as the actor. v2 → claim_generator_info map's `name`; v1 → the
    // same array's first entry, else the free-text claim_generator string.
    let generator: unknown;
    for (const child of manifest.children) {
      let sub: Superbox;
      try { sub = parseSuperbox(store, child); } catch { continue; }
      if (sub.label !== 'c2pa.claim' && sub.label !== 'c2pa.claim.v2') continue;
      try {
        const claim = decodeCbor(contentOf(store, sub));
        if (claim instanceof Map) {
          const gi = claim.get('claim_generator_info');
          generator = gi instanceof Map ? gi.get('name')
            : (Array.isArray(gi) && gi[0] instanceof Map) ? gi[0].get('name')
              : claim.get('claim_generator');
        }
      } catch { /* opaque claim — no generator */ }
      break;
    }
    for (const child of manifest.children) {
      let sub: Superbox;
      try { sub = parseSuperbox(store, child); } catch { continue; }
      if (sub.label !== 'c2pa.assertions') continue;
      for (const a of sub.children) {
        let ab: Superbox;
        try { ab = parseSuperbox(store, a); } catch { continue; }
        if (ab.label !== 'c2pa.actions' && ab.label !== 'c2pa.actions.v2') continue;
        try {
          const decoded = (decodeCbor(contentOf(store, ab)) as Map<unknown, unknown>).get('actions');
          if (!Array.isArray(decoded)) continue;
          for (const act of decoded) {
            const sa = act.get?.('softwareAgent');
            chain.push({
              action: act.get?.('action'),
              when: act.get?.('when'),
              softwareAgent: sa instanceof Map ? sa.get('name') : sa,
              digitalSourceType: act.get?.('digitalSourceType'),
              description: act.get?.('description'),
              generator,
            });
          }
        } catch { /* opaque/absent actions — skip this assertion */ }
      }
    }
  }
  // Collapse duplicate steps the same event is recorded under in successive
  // manifests of a chain (same action + time + agent + source type).
  const seen = new Set<string>();
  return chain.filter((s) => {
    const key = JSON.stringify([s.action, s.when, s.softwareAgent, s.digitalSourceType, s.description]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Everything the writer (engine/src/c2pa.ts) needs to carry a credentialed
// ingredient's provenance into a NEW asset's manifest store, without importing
// the write side (which would cycle). `manifestBoxes` are the ingredient store's
// manifest superboxes verbatim (store order, active last) — copied wholesale so
// the ingredient's own signatures stay intact; `activeLabel` is the last box's
// label for the c2pa.ingredient reference; `digitalSourceType` is the strongest
// AI/ML source type found anywhere in the ingredient's chain (propagated onto
// the c2pa.opened action so the new asset never launders the AI origin away).
export interface C2paIngredientData {
  manifestBoxes: Uint8Array[];
  activeLabel: string;
  title?: string;
  format: string;
  digitalSourceType?: string;
}

/**
 * Pull just the raw C2PA manifest store (the JUMBF 'c2pa' superbox) out of a
 * credentialed file, with its sniffed container format. Returns null when the
 * file carries no readable C2PA. The store is SMALL (no pixels/EXIF) — ingest
 * keeps only this to preserve provenance without re-hoarding the metadata the
 * upload pipeline deliberately strips.
 */
export function extractC2paStore(bytes: Uint8Array): { store: Uint8Array; format: SniffFormat } | null {
  if (!(bytes instanceof Uint8Array)) return null;
  const format = sniffFormat(bytes);
  if (!format) return null;
  try {
    const ex = EXTRACTORS[format]?.(bytes);
    return ex ? { store: ex.manifest, format } : null;
  } catch { return null; }
}

/**
 * Read a credentialed file's manifest store and package what the writer needs to
 * preserve it as an ingredient. Returns null when the file carries no readable
 * C2PA (nothing to preserve). Purely read-side — the writer stays cycle-free.
 */
export function prepareC2paIngredient(bytes: Uint8Array): C2paIngredientData | null {
  const ex = extractC2paStore(bytes);
  return ex ? prepareC2paIngredientFromStore(ex.store, ex.format) : null;
}

/** As {@link prepareC2paIngredient}, but from an already-extracted manifest store
 *  (what ingest persists) plus the ingredient's original container format. */
export function prepareC2paIngredientFromStore(store: Uint8Array, format: string): C2paIngredientData | null {
  if (!(store instanceof Uint8Array)) return null;
  let root: Superbox;
  try {
    const top = walkBoxes(store, 0, store.length);
    if (!top.length) return null;
    root = parseSuperbox(store, top[0]!);
  } catch { return null; }
  if (root.label !== 'c2pa' || !root.children.length) return null;
  const manifestBoxes = root.children.map((b) => store.slice(b.start, b.end));
  let activeLabel = '';
  let title: string | undefined;
  try {
    const parts = parseC2paStore(store);
    activeLabel = parts.manifestLabel;
    const claim = decodeCbor(parts.claimBytes);
    if (claim instanceof Map) {
      const t = claim.get('dc:title');
      if (typeof t === 'string') title = t;
    }
  } catch { return null; }
  if (!activeLabel) return null;
  // Strongest AI/ML source type in the chain, generated ranking above composite.
  let digitalSourceType: string | undefined;
  for (const s of collectActionChain(store)) {
    const kind = aiKind(s.digitalSourceType);
    if (kind && (!digitalSourceType || kind === 'generated')) {
      digitalSourceType = s.digitalSourceType as string;
      if (kind === 'generated') break;
    }
  }
  return { manifestBoxes, activeLabel, title, format, digitalSourceType };
}
