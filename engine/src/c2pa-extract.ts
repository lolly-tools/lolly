// SPDX-License-Identifier: MPL-2.0
/**
 * C2PA structural extraction - the read side's format-sniffing, CBOR decoding,
 * JUMBF-store walking, and per-container manifest extraction (pdf/png/jpeg/gif/
 * svg/tiff/webp/mp4/webm/mp3/wav, plus the C2PA 2.4 TEXT bindings: html/code/text
 * - see the "text bindings" section near the bottom), plus the
 * ingredient-preparation helpers built on top.
 * Split out of c2pa-verify.ts so the cryptographic verification core (COSE
 * signature checks, X.509/trust-chain walking, the hard-binding hash check) is
 * reviewable in isolation - nothing in this file does or checks any cryptography;
 * it only parses bytes into structure. c2pa-verify.ts imports all of this back.
 */

import { C2PA_BMFF_UUID, C2PA_ATTACHMENT_MIME } from './c2pa.ts';
import { EBML_ID, SEGMENT_ID, readId, readVint, idAt } from './video-meta.ts';
import { concatBytes, bytesToHex as hexOf, bytesToBin, base64ToBytes } from './bytes.ts';
import { locateOpusComment, parseOpusTags, commentKey, commentValue, OGG_C2PA_KEY } from './ogg.ts';
// Type-only - no runtime cycle: c2pa-verify.ts imports VALUES from this file,
// this file imports only a TYPE back (erased at compile time).
import type { C2paHistoryStep } from './c2pa-verify.ts';

const td = new TextDecoder();
const te = new TextEncoder();

// ─── CBOR decoder ─────────────────────────────────────────────────────────────
// Full enough for the wild, not just our writer: definite AND indefinite
// lengths, half/single/double floats - foreign manifests (Adobe et al.) use
// them freely and a good-citizen validator must still read those claims.

const CBOR_BREAK = Symbol('cbor break');

// Hostile manifests must fail with a prompt throw, never a hang or a blown
// stack (the fuzz suite asserts both). Two guards below serve that:
//   - every multi-byte length head is bounds-checked BEFORE the read - an
//     out-of-range Uint8Array read is undefined, which NaN-poisons the offset
//     and turns the indefinite-chunk loop into an infinite one (the GIF lesson,
//     again);
//   - nesting is capped - real claims nest a handful of levels, and a 64 KB
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
  // the last superbox (C2PA 1.x section "active manifest").
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
          // Hashed URIs cover the superbox payload - after the 8-byte header.
          payload: store.slice(ab.box.start + 8, ab.box.end),
        });
      }
    } else if (sub.label === 'c2pa.claim') {
      parts.claimBytes = contentOf(store, sub);
      parts.claimVersion = 1;
    } else if (sub.label === 'c2pa.claim.v2') {
      // C2PA 2.x active-manifest claim. Same JUMBF box UUID as v1 (c2cl) - the
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

// ─── text-binding constants (C2PA 2.4 section A.7/section A.8/section A.9) ────────────────────────
// Declared here because sniffFormat needs them; the readers that use them live
// in the "text bindings" section below.

/** Head window every text sniff reads. Also the historic <svg scan window. */
const SNIFF_HEAD_BYTES = 4096;
/** Tail window, for the spec's end-of-file placements (section A.8.4.1, section A.9.3.1). */
const SNIFF_TAIL_BYTES = 64 * 1024;
/** A whole-file sniff pass is only ever run on an input this small. */
const MAX_FULL_SCAN_BYTES = 4 * 1024 * 1024;
/** Extraction refuses to decode a text asset larger than this. /verify is a
 *  public drop target; a 500 MB "text file" must cost a cheap refusal, not a
 *  half-gigabyte JS string. */
const MAX_TEXT_BYTES = 16 * 1024 * 1024;

/** section A.7 root markers. `<html` needs a delimiter after it so `<htmlish>` misses. */
const HTML_MARKER = /<!doctype\s+html\b|<html(?=[\s/>])/i;

/** section A.9 fixed ASCII-armour delimiters (modelled on OpenPGP, RFC 4880 section 6.2). */
const ARMOR_BEGIN = '-----BEGIN C2PA MANIFEST-----';
const ARMOR_END = '-----END C2PA MANIFEST-----';

/**
 * A section A.7 carrier MARKER - is there a `<script type="application/c2pa">` or a
 * `<link rel="c2pa-manifest">` anywhere in the windows we looked at? Only ever
 * asked to break a tie against a COMPLETE section A.9 block, so a false positive costs
 * nothing worse than the pre-existing "prefer html" answer.
 *
 * The attribute window is bounded (`{0,300}`) rather than `[^>]*`: an unbounded
 * negated class over a `>`-free tail is the quadratic shape that hangs a tab.
 * `application/c2pa` alone would be useless here - every section A.9 `data:` reference
 * contains that exact string, which is precisely the file this test has to tell
 * apart from an HTML document.
 */
const HTML_C2PA_SCRIPT = /<script[^>]{0,300}type\s*=\s*["']?\s*application\/c2pa/i;
const HTML_C2PA_LINK = /<link[^>]{0,300}rel\s*=\s*["']?[^"'>]{0,80}c2pa-manifest/i;
const hasHtmlC2paCarrier = (...windows: string[]): boolean =>
  windows.some((w) => HTML_C2PA_SCRIPT.test(w) || HTML_C2PA_LINK.test(w));

/**
 * Blank out COMMENT and processing-instruction spans in the sniff head window,
 * preserving every offset (each masked byte becomes a space).
 *
 * "First marker wins" is a claim about which ROOT ELEMENT the document has, and
 * a comment is text, not markup. An SVG whose licence header says "see the
 * <html> version" is still an SVG - before this mask it sniffed as 'html', its
 * `<c2pa:manifest>` was never looked for, and a good credential read as ABSENT
 * (the worst direction a verifier can be wrong in). The mirror case - an HTML
 * page whose head comment mentions `<svg` - is fixed by the same pass.
 *
 * Bounded by the ≤4 KB window, and each iteration consumes at least one span.
 */
function maskMarkupNoise(head: string): string {
  if (!head.includes('<!--') && !head.includes('<?')) return head;
  let out = '';
  let at = 0;
  while (at < head.length) {
    const c = head.indexOf('<!--', at);
    const p = head.indexOf('<?', at);
    const next = c < 0 ? p : p < 0 ? c : Math.min(c, p);
    if (next < 0) { out += head.slice(at); break; }
    out += head.slice(at, next);
    const comment = next === c;
    const close = head.indexOf(comment ? '-->' : '?>', next + (comment ? 4 : 2));
    // An unterminated COMMENT masks to the end of the window, which is what a
    // parser does with it. An unterminated `<?` masks nothing: `<?` is not
    // always a PI (a template or a stray comparison can produce it), and
    // swallowing the rest of the window on that guess would hide a real root
    // element - the exact failure this whole mask exists to prevent.
    if (!comment && close < 0) { out += head.slice(next, next + 2); at = next + 2; continue; }
    const end = close < 0 ? head.length : close + (comment ? 3 : 2);
    out += ' '.repeat(end - next);
    at = end;
  }
  return out;
}

/**
 * section A.8, as RAW BYTES: the exact 7-byte prefix every wrapper starts with.
 *
 * A wrapper is U+FEFF followed by the variation selector encoding the magic's
 * first byte 0x43 - which is >15, so it is U+E0100 + (0x43 - 16) = U+E0133.
 * UTF-8: U+FEFF = EF BB BF, U+E0133 = F3 A0 84 B3. Matching bytes (not decoded
 * text) means the sniffer never allocates a string of the file just to look, and
 * costs nothing on a binary upload. NFC cannot create or destroy this sequence -
 * U+FEFF and the variation selectors are all ccc=0 and have no decompositions -
 * so the pre-normalization bytes carry the same signal as the normalized text.
 */
const TEXT_WRAPPER_SIGNATURE = String.fromCharCode(0xef, 0xbb, 0xbf, 0xf3, 0xa0, 0x84, 0xb3);

export type SniffFormat = 'pdf' | 'png' | 'jpeg' | 'gif' | 'svg' | 'tiff' | 'webp' | 'avif' | 'mp4' | 'webm' | 'mkv' | 'mp3' | 'wav' | 'ogg' | 'flac'
  // C2PA 2.4 text bindings - see the "text bindings" section near the bottom of
  // this file. 'html' keys on the DOCUMENT (section A.7 covers whole HTML documents);
  // 'code' and 'text' key on finding the CARRIER itself (the section A.9 armour block /
  // the section A.8 wrapper), never on guessing the host language - there is no magic
  // that distinguishes JavaScript from prose, and claiming one would mislabel
  // every unrecognised upload.
  | 'html' | 'text' | 'code';

/** Sniff the container format from magic bytes ('pdf'|'png'|'jpeg'|'gif'|'svg'|'tiff'|'webp'|'mp4'|'webm'|'mkv'|'mp3'|'wav'|'ogg'|'html'|'code'|'text'|null). */
export function sniffFormat(bytes: Uint8Array): SniffFormat | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (ascii(bytes, 0, 3) === 'GIF') return 'gif';
  // Ogg - only Opus is claimed (its C2PA field lives in the OpusTags comment
  // header). OpusHead is the first packet on the BOS page (body at offset 28 for
  // the usual one-segment page); a short scan of the header region finds it.
  if (ascii(bytes, 0, 4) === 'OggS') return bytesToBin(bytes.subarray(0, 64)).includes('OpusHead') ? 'ogg' : null;
  // MP3: a leading ID3v2 tag is the reliable signature (the credential's home).
  // A bare frame-sync start is NOT sniffed - 0xFF 0xEx is too weak a magic to
  // claim against every other unrecognised format, and a tagless MP3 cannot be
  // carrying an ID3-resident credential anyway.
  if (ascii(bytes, 0, 3) === 'ID3') return 'mp3';
  if (ascii(bytes, 0, 4) === '%PDF') return 'pdf';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') return 'wav';
  // FLAC - the 'fLaC' marker, then metadata blocks (first is STREAMINFO). The
  // credential rides in an APPLICATION block; write side placeFlac, read side below.
  if (ascii(bytes, 0, 4) === 'fLaC') return 'flac';
  if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[3] === 0x2a)) return 'tiff';
  if (ascii(bytes, 4, 4) === 'ftyp') {
    // ISO BMFF. AVIF is a still image but a genuine BMFF container, and it carries
    // C2PA over the same c2pa.hash.bmff binding as MP4 - so it gets its own 'avif'
    // format (major brand 'avif'/'avis'; the common encoders write it there). HEIC and
    // the other image-sequence brands are photos we don't stamp yet, so they keep the
    // honest 'unrecognised format' answer until they get their own support.
    const brand = ascii(bytes, 8, 4);
    if (brand === 'avif' || brand === 'avis') return 'avif';
    const image = ['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'mif2', 'msf1'];
    return image.includes(brand) ? null : 'mp4';
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    // EBML - webm and mkv share the magic; the DocType string (in the small
    // EBML header, always near the front) tells them apart for the label.
    return bytesToBin(bytes.subarray(0, 64)).includes('matroska') ? 'mkv' : 'webm';
  }
  // ── text carriers: no magic bytes anywhere, so ORDER is the whole contract ──
  // SVG has no magic - look for an <svg root in the first 4KB of text.
  const headBin = bytesToBin(bytes.subarray(0, SNIFF_HEAD_BYTES));
  // C2PA 2.4 section A.7: an HTML document. Checked BEFORE the loose <svg scan, because
  // a page with an inline <svg> in its first 4 KB used to mis-sniff as 'svg' (and
  // one whose <svg> came later sniffed as nothing at all) - the SVG reader then
  // looked for a <c2pa:manifest> element that an HTML document never carries.
  //
  // "First marker wins" rather than "html always wins": an SVG may legitimately
  // carry <html> inside a <foreignObject>, and that file is still an SVG. The
  // root element is whichever of the two appears first - measured over MARKUP,
  // with comments and PIs masked out, so a mention in a header comment cannot
  // take the file away from its real root.
  const headMarkup = maskMarkupNoise(headBin);
  const htmlAt = headMarkup.search(HTML_MARKER);
  const svgAt = headMarkup.search(/<svg[\s>]/);
  // section A.9 (armour block) and section A.8 (variation-selector wrapper) are found by their
  // OWN carrier bytes. Both specs place the carrier at the start or the end of
  // the file, so two bounded windows answer the spec-compliant case without
  // reading the middle of a large upload.
  const tailBin = bytes.length > SNIFF_HEAD_BYTES
    ? bytesToBin(bytes.subarray(Math.max(0, bytes.length - SNIFF_TAIL_BYTES)))
    : '';
  const inWindows = (needle: string): boolean => headBin.includes(needle) || tailBin.includes(needle);
  const armorBegin = inWindows(ARMOR_BEGIN);
  const armorEnd = inWindows(ARMOR_END);
  // A MARKER is a guess about the host language; a complete BEGIN…END pair is a
  // carrier that was actually found. So a signed .js whose body happens to hold
  // an HTML template string stays 'code' - before this, whether it verified
  // depended on where in the file the word `<html` fell relative to a 4 KB
  // window, which is a non-deterministic-looking failure for its author. An HTML
  // DOCUMENT that carries its own section A.7 element still wins (section A.9.2 excludes
  // text/html from the structured-text method), and so does one whose section A.7
  // marker we can see; a document with an armour block and no section A.7 element is
  // read as the armour block, which is also plan 105 section 5's fragment profile.
  if (armorBegin && armorEnd && !hasHtmlC2paCarrier(headBin, tailBin)) return 'code';
  if (htmlAt >= 0 && (svgAt < 0 || htmlAt < svgAt)) return 'html';
  if (svgAt >= 0) return 'svg';
  if (armorBegin && armorEnd) return 'code';
  // A DECODED wrapper outranks a lone delimiter. Either delimiter alone is still
  // enough to sniff 'code' - a half-present block is a
  // manifest.structuredText.noManifest report (section A.9.5), which we can only make
  // after admitting the file is structured text - but that report is a
  // no-credential answer, and letting it out-rank a section A.8 wrapper meant any
  // signed text that merely QUOTED the delimiter (a support article, this
  // repo's own plans) had its credential erased rather than checked.
  if (inWindows(TEXT_WRAPPER_SIGNATURE)) return 'text';
  if (armorBegin || armorEnd) return 'code';
  // Mid-file placement is off-spec for both bindings, but a validator that
  // refuses to look would just be wrong about real pastes. ONE bounded whole-file
  // pass, gated on the input being small AND textual (a NUL in the first 4 KB is
  // the cheap "this is a binary blob" test), so an unrecognised BINARY upload
  // never pays for it. When the two windows already overlap they covered the
  // whole file and there is nothing left to scan.
  //
  // KNOWN GAP, deliberate: this pass stops at MAX_FULL_SCAN_BYTES (4 MiB) while
  // the readers accept up to MAX_TEXT_BYTES (16 MiB), so a carrier stranded in
  // the middle of a 4–16 MiB file is never found by sniffing. The caps answer
  // different questions - "what may an unrecognised upload cost us" vs "what
  // will we decode once we know what it is" - and closing the gap would put a
  // 16 MiB latin1 pass on every unrecognised drop.
  if (bytes.length > SNIFF_HEAD_BYTES + SNIFF_TAIL_BYTES
      && bytes.length <= MAX_FULL_SCAN_BYTES
      && !bytes.subarray(0, SNIFF_HEAD_BYTES).includes(0)) {
    const bin = bytesToBin(bytes);
    const begin = bin.includes(ARMOR_BEGIN);
    const end = bin.includes(ARMOR_END);
    if (begin && end) return 'code';
    if (bin.includes(TEXT_WRAPPER_SIGNATURE)) return 'text';
    if (begin || end) return 'code';
  }
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
  // the group whose superbox UUID is the c2pa manifest store - keeping the first
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
    // caller's try/catch and freezes the tab - /valid takes arbitrary files).
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
  // Last IFD first, then the first-IFD fallback (legacy files) - as c2pa-rs.
  const entry = last.entries.find((e) => e.tag === 0xcd41) || first!.entries.find((e) => e.tag === 0xcd41);
  if (!entry) return null;
  if (entry.type !== 7) throw new Error('TIFF C2PA entry must be type UNDEFINED(7)');
  if (entry.valueOffset + entry.count > tiff.length) throw new Error('TIFF C2PA value overruns the file');
  return { manifest: tiff.slice(entry.valueOffset, entry.valueOffset + entry.count) };
}

// RIFF family - WebP and WAV share the identical chunk grammar, so one walk
// reads the top-level C2PA chunk out of either (write side placeRiff).
function extractC2paFromRiff(riff: Uint8Array): { manifest: Uint8Array } | null {
  const dv = new DataView(riff.buffer, riff.byteOffset);
  for (let i = 12; i + 8 <= riff.length; ) {
    const size = dv.getUint32(i + 4, true);
    if (i + 8 + size > riff.length) throw new Error('malformed RIFF chunk');
    if (ascii(riff, i, 4) === 'C2PA') return { manifest: riff.slice(i + 8, i + 8 + size) };
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
    if (ascii(mp4, p, q - p) !== 'manifest') continue; // e.g. a 'merkle' box - not the store
    q += 1 + 8; // nul + merkle offset (0 for flat files; a fragmented binding fails honestly at the hash check)
    if (q > boxEnd) throw new Error('malformed C2PA box');
    found.push(mp4.slice(q, boxEnd));
  }
  if (found.length > 1) throw new Error('MP4 has more than one C2PA manifest box');
  return found.length ? { manifest: found[0]! } : null;
}

// ── WebM / Matroska ──
// Lolly's own mapping (there is no standardised one): the manifest is a
// Matroska attachment with mime type application/c2pa - see placeWebm in
// c2pa.js. Element ids: Attachments / AttachedFile / FileMimeType / FileData.
const MKV_ATTACHMENTS = 0x1941a469;
const MKV_ATTACHEDFILE = 0x61a7;
const MKV_FILEMIMETYPE = 0x4660;
const MKV_FILEDATA = 0x465c;

interface EbmlChild { id: number; off: number; dataOff: number; dataEnd: number; }

// Walk sibling EBML elements in [start, end) → [{ id, off, dataOff, dataEnd }].
// Stops cleanly at an unknown-size child (streaming Clusters - nothing after
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

// MP3: the manifest store is the object data of a GEOB frame in the leading
// ID3v2 tag, identified by MIME 'application/x-c2pa-manifest-store' (the C2PA
// MPEG-1/2 audio binding - write side in c2pa-containers placeMp3). Matched on
// the MIME alone; the GEOB's filename/description strings are naming, not
// protocol. v2.3 (plain frame sizes) and v2.4 (syncsafe) both read; an
// unsynchronised or extended-header tag throws (a declared credential we
// cannot safely walk to), a file with no leading tag simply carries none.
function extractC2paFromMp3(mp3: Uint8Array): { manifest: Uint8Array } | null {
  if (!(mp3.length >= 10 && ascii(mp3, 0, 3) === 'ID3')) return null;
  const ver = mp3[3]!;
  if (ver !== 3 && ver !== 4) return null;
  const flags = mp3[5]!;
  if (flags & 0x80) throw new Error('unsynchronised ID3v2 tag');
  if (flags & 0x40) throw new Error('ID3v2 extended header not supported');
  const readSyncsafe = (off: number): number =>
    ((mp3[off]! & 0x7f) << 21) | ((mp3[off + 1]! & 0x7f) << 14) | ((mp3[off + 2]! & 0x7f) << 7) | (mp3[off + 3]! & 0x7f);
  const end = Math.min(10 + readSyncsafe(6), mp3.length);
  const mime = 'application/x-c2pa-manifest-store';
  const found: Uint8Array[] = [];
  let off = 10;
  while (off + 10 <= end && mp3[off] !== 0) {
    const size = ver === 4 ? readSyncsafe(off + 4)
      : ((mp3[off + 4]! << 24) | (mp3[off + 5]! << 16) | (mp3[off + 6]! << 8) | mp3[off + 7]!) >>> 0;
    const next = off + 10 + size;
    if (next > end || next <= off) throw new Error('malformed ID3v2 frame');
    if (ascii(mp3, off, 4) === 'GEOB' && size > 1 + mime.length + 1 && ascii(mp3, off + 11, mime.length) === mime && mp3[off + 11 + mime.length] === 0) {
      // Body: encoding byte, MIME (Latin-1, NUL), filename + description in the
      // declared encoding (UTF-16 variants terminate with a double NUL), object.
      const enc = mp3[off + 10]!;
      const wide = enc === 1 || enc === 2;
      let at = off + 11 + mime.length + 1;
      for (let s = 0; s < 2; s++) {
        while (at < next && !(mp3[at] === 0 && (!wide || mp3[at + 1] === 0))) at += wide ? 2 : 1;
        at += wide ? 2 : 1;
      }
      if (at >= next) throw new Error('malformed C2PA GEOB frame');
      found.push(mp3.slice(at, next));
    }
    off = next;
  }
  if (found.length > 1) throw new Error('MP3 file has more than one C2PA credential');
  return found.length ? { manifest: found[0]! } : null;
}

// Ogg Opus: the store is the base64 value of a `C2PA=` VorbisComment field in the
// OpusTags comment header (write side in c2pa-containers placeOgg; the binding
// grammar in ogg.ts). No comment field ⇒ the file carries no credential.
function extractC2paFromOgg(ogg: Uint8Array): { manifest: Uint8Array } | null {
  const loc = locateOpusComment(ogg);
  if (!loc) return null;
  const tags = parseOpusTags(loc.packet);
  if (!tags) return null;
  const field = tags.comments.find((c) => commentKey(c) === OGG_C2PA_KEY);
  if (!field) return null;
  const b64 = bytesToBin(commentValue(field)).replace(/\s+/g, '');
  if (!b64) return null;
  try { return { manifest: base64ToBytes(b64) }; } catch { return null; }
}

// FLAC - the Lolly credential rides in an APPLICATION metadata block (type 2)
// whose 4-byte application id is 'C2PA' (write side placeFlac; Lolly-only binding,
// no c2pa-rs FLAC reader). Walk the metadata block chain - 1-byte header
// [last<<7 | type], 3-byte big-endian length, body - bounds-checked before every
// read, and hand back the block body past the application id.
function extractC2paFromFlac(flac: Uint8Array): { manifest: Uint8Array } | null {
  let off = 4; // past the 'fLaC' marker
  while (off + 4 <= flac.length) {
    const header = flac[off]!;
    const last = (header & 0x80) !== 0;
    const type = header & 0x7f;
    const len = (flac[off + 1]! << 16) | (flac[off + 2]! << 8) | flac[off + 3]!;
    const bodyStart = off + 4;
    const bodyEnd = bodyStart + len;
    if (bodyEnd > flac.length) throw new Error('malformed FLAC metadata block');
    if (type === 2 && len >= 4 && ascii(flac, bodyStart, 4) === 'C2PA') {
      return { manifest: flac.slice(bodyStart + 4, bodyEnd) };
    }
    off = bodyEnd;
    if (last) break;
  }
  return null;
}

// ─── text bindings (C2PA 2.4 section A.7 HTML / section A.8 unstructured / section A.9 structured) ──
//
// READ ONLY. There is no writer/placer for any of these - `C2PA_FORMATS` and
// c2pa-containers.ts are untouched, so nothing in Lolly can EMIT a text binding
// yet. Reading is deliberately broader than writing (the house posture: read
// broad, embed narrow), and these three are the first bindings in the spec with
// no reference implementation anywhere - c2pa-rs 0.90 has none of them - so
// every rule below is quoted from the 2.4 text rather than matched against
// another tool's bytes.
//
// Three things make these different from every binary container above:
//
//   1. THE ENGINE NEVER FETCHES. section A.7's `<link>` form and section A.9's URL form point
//      at a manifest that lives somewhere else. Extraction hands back the URL in
//      `externalUrl` and stops; whether it is resolved, and under whose network
//      policy, is the shell's decision.
//   2. A carrier can be PRESENT AND UNUSABLE in ways a container cannot - two
//      manifests in one document, half an armour block, a wrapper whose magic
//      matched but whose body is truncated. The spec names those states, so the
//      readers report them (`status`) instead of flattening everything to null.
//   3. section A.8 offsets live in NFC-NORMALIZED UTF-8, not in the file's own bytes.
//      Normalizing can shorten the text ahead of the wrapper (a decomposed é is
//      three bytes, a composed one is two), so every offset this file reports for
//      a text wrapper is measured in the normalized encoding - see `readTextVs`.
//
// Bounds discipline (the GIF-hang and 2^42-VINT lessons): every scan here is
// windowed or capped, every loop bound is derived from the input length rather
// than from a length field the input chose, and the one allocation sized by an
// attacker-controlled field (section A.8 manifestLength) is bounds-checked against the
// remaining text BEFORE it is made.

/** An absolute byte range a hard binding excludes from its hash. */
export interface C2paExclusion { start: number; length: number; }

/**
 * One section A.8 `C2PATextManifestWrapper` found in a text asset.
 *
 * ALL FOUR OFFSETS ARE BYTE OFFSETS IN THE NFC-NORMALIZED UTF-8 ENCODING of the
 * text (section A.8.7.3), not offsets into the bytes that were passed in.
 *
 *   start         the U+FEFF prefix (section A.8.4.1)
 *   selectorStart the first variation selector - always `start + 3`, since
 *                 U+FEFF is three UTF-8 bytes; reported so a caller never has to
 *                 know that
 *   end           one past the last selector THIS wrapper consumes
 *   runEnd        one past the last selector of the contiguous run `end` sits in
 *                 (`runEnd > end` means the run carries trailing selectors that
 *                 are not part of the wrapper)
 *
 * SPEC AMBIGUITY, deliberately surfaced rather than resolved here: section A.8.6.1 says
 * the exclusions "shall correspond to the location of the C2PATextManifestWrapper
 * in the text", but section A.8.4.1 calls U+FEFF a PREFIX to the wrapper rather than a
 * field of it, and section A.8.2.2's struct starts at the magic. So it is not stated
 * whether an exclusion should start at `start` or at `selectorStart`. Both are
 * reported; the hash-validation side picks and pins the choice.
 */
export interface C2paTextWrapper {
  start: number;
  selectorStart: number;
  end: number;
  runEnd: number;
  /** section A.8.2.3 `version`. Only 1 is defined; anything else is a corrupt wrapper. */
  version: number;
  /** The JUMBF store, or null when the wrapper is corrupt/unsupported. */
  store: Uint8Array | null;
  /** Set when the wrapper is present but unusable (see C2PA_TEXT_STATUS). */
  status?: string;
  /** Human-readable specifics - section 15.12.1.3.2 asks validators to say what broke. */
  reason?: string;
}

/** Everything the section A.8 hash pipeline (section 15.12.1.3.1) needs from extraction. */
export interface C2paTextCarrier {
  /** The whole asset, decoded as UTF-8 and NFC-normalized - the string whose
   *  UTF-8 encoding the exclusions and the hash are both defined over. */
  nfc: string;
  /** EVERY wrapper found, in document order - valid, corrupt and unsupported
   *  alike. section A.8.4.1 makes wrapper SELECTION a job for the assertion's
   *  exclusions, so extraction must not pick for the validator. */
  wrappers: C2paTextWrapper[];
  /** The walk stopped at MAX_TEXT_WRAPPERS, so `wrappers` is INCOMPLETE. Without
   *  this the validator would refuse an exclusion naming wrapper 33 with "does
   *  not correspond to a C2PATextManifestWrapper" - a false statement about the
   *  asset: it does correspond, we stopped looking. */
  truncated?: boolean;
}

/**
 * The widened extraction result the text bindings need and the binary containers
 * fit inside. `store` is the legacy answer (`null` when the carrier only
 * REFERENCES a manifest, or carries none at all).
 */
export interface ExtractedC2pa {
  store: Uint8Array | null;
  /** section A.7.1.2 / section A.9.3 external reference. The engine never resolves it. */
  externalUrl?: string;
  /** What the spec says this carrier's `c2pa.hash.data` exclusions SHOULD be
   *  (section A.7.1.3, section A.9.4, section A.8.6.1) - an advisory cross-check against what the
   *  assertion actually declares, never a substitute for reading the assertion. */
  exclusions?: C2paExclusion[];
  /** Other exclusion sets that are equally conformant readings of the SAME
   *  carrier - section A.9.4's end-of-file newline is one byte ambiguous on a CRLF file
   *  and on a file with a trailing blank line (see armorExclusion). A producer
   *  on the other reading must get a hash result, not a non-conformance
   *  refusal. Absent when the spec's rule is unambiguous for this carrier. */
  exclusionAlternates?: C2paExclusion[][];
  /** A validation status code - see C2PA_TEXT_STATUS. */
  status?: string;
  /** Human-readable specifics for the status. */
  detail?: string;
  /** section A.8 only: the normalized text and every wrapper in it. */
  text?: C2paTextCarrier;
}

/** {@link ExtractedC2pa} plus the format it was read as. */
export interface C2paExtraction extends ExtractedC2pa { format: SniffFormat; }

/**
 * Status codes the text-binding readers emit.
 *
 * The first six are the spec's own vocabulary, verbatim (section A.7.1.4, section A.8.7.1,
 * section A.9.3/section A.9.5, section 15.12.1.3.3) - same posture as C2PA_CHECK in c2pa-verdict.ts,
 * which deliberately reuses the C2PA validation-status strings so a Lolly report
 * and a c2patool report say the same words. The rest are Lolly extensions for
 * states the spec names no code for; they are `lolly.`-namespaced so they can
 * never be mistaken for the standard set.
 */
export const C2PA_TEXT_STATUS = Object.freeze({
  /** section A.7.1.4 - more than one C2PA association in one HTML document. */
  htmlMultipleManifests: 'manifest.html.multipleManifests',
  /** section A.9.3 - more than one armour block in one file. */
  structuredTextMultipleReferences: 'manifest.structuredText.multipleReferences',
  /** section A.9.5 - no delimiters, or only one of the pair. */
  structuredTextNoManifest: 'manifest.structuredText.noManifest',
  /** section A.9.5 - a block whose reference is empty or whitespace-only. */
  structuredTextEmptyReference: 'manifest.structuredText.emptyReference',
  /** section A.8.7.1 / section 15.12.1.3.2 - magic matched, the rest of the wrapper did not. */
  textCorruptedWrapper: 'manifest.text.corruptedWrapper',
  /** section A.8.7.1 - more than one valid wrapper. NOT fatal at extraction time:
   *  section A.8.4.1 hands wrapper selection to the assertion's exclusions. */
  textMultipleWrappers: 'manifest.text.multipleWrappers',
  /** Matches C2PA_CHECK.credentialUnreadable (c2pa-verdict.ts) - spelled out
   *  rather than imported, so this module keeps its leaf-import discipline and
   *  never drags the x509/trust graph onto a boot chunk. */
  credentialUnreadable: 'credential.unreadable',
  /** A reference we will not even report: a non-http(s) scheme, or the
   *  protocol-relative `//host/path` form. Relative references ARE reported -
   *  resolving them is the shell's job, not the engine's. */
  unsupportedReference: 'lolly.manifest.unsupportedReference',
  /** A base64 payload that is not base64. */
  malformedBase64: 'lolly.manifest.malformedBase64',
  /** `<script type="application/c2pa">` with no closing tag - a truncated paste. */
  htmlUnterminatedScript: 'lolly.html.unterminatedScript',
  /** Bigger than the text readers will decode. */
  tooLarge: 'lolly.text.tooLarge',
} as const);

/** A reader's result. `fatal` is the message the EXTRACTORS wrapper throws - the
 *  existing per-format contract ("a credential IS declared but cannot be read"
 *  throws; "no credential" returns null), kept intact for the new formats. */
interface TextRead extends ExtractedC2pa { fatal?: string }

const tooLarge = (what: string, n: number): TextRead => ({
  store: null,
  status: C2PA_TEXT_STATUS.tooLarge,
  detail: `${what} is ${n} bytes; the text readers cap at ${MAX_TEXT_BYTES}`,
});

const BASE64_ONLY = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * A manifest reference we are willing to REPORT. Reporting is not fetching: the
 * engine performs no network I/O ever, and the shell resolves (or refuses) this
 * under its own policy, which is the layer that has a base URL and a network
 * posture. section A.7.1.2 and section A.9.3.1 constrain nothing about the URI form, and the
 * external form is the one both sections say is PREFERRED.
 *
 * Accepted: http(s) absolute, and any RELATIVE reference - `/info/m.c2pa`,
 * `m.c2pa`, `./m.c2pa`, `../m.c2pa`. The same-directory sidecar is the least
 * risky reference that exists and the natural output of "write the page, write
 * the manifest beside it"; refusing it (while waving through any cross-origin
 * `https://` host) was a filter that broke the spec's preferred form without
 * delivering the safety it claimed. Worse, a refused reference is reported with
 * no URL at all, so the shell cannot even DISPLAY what the file points at.
 *
 * Refused: any non-http(s) scheme (`javascript:`, `file:`, `data:` outside the
 * section A.9 inline form), and the protocol-relative `//host/path` form - the one
 * shape that reads as relative and resolves cross-origin.
 */
function safeExternalUrl(raw: string): string | undefined {
  const url = raw.trim();
  // Whitespace and control characters never appear in a URI reference, and
  // stripping them silently is how a "safe" string stops matching the bytes.
  if (!url || url.length > 2048 || /[\u0000-\u0020\u007f]/.test(url)) return undefined;
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(url);
  if (scheme) return /^https?$/i.test(scheme[1]!) ? url : undefined;
  if (url.startsWith('//')) return undefined;
  return url;
}

/** Every index of `needle` in `hay`, stopping at `cap` (so a file made of a
 *  million delimiters costs `cap` steps, not a million). */
function indicesOf(hay: string, needle: string, cap: number): number[] {
  const out: number[] = [];
  for (let at = hay.indexOf(needle); at >= 0 && out.length < cap; at = hay.indexOf(needle, at + needle.length)) {
    out.push(at);
  }
  return out;
}

// ── section A.7: HTML documents ──────────────────────────────────────────────────────
//
// section A.7.1.4 says to treat the file "as a series of bytes (vs. text)" - so this is
// a byte scan with regexes over the latin1 binary string, NOT a DOM parse. The
// known limit of that (and of the spec's own framing) is an attribute value
// containing `>`, which ends the tag early; a DOM parser would disagree, and the
// hard binding would then fail rather than silently accept the wrong bytes.

/** How many C2PA ASSOCIATIONS are collected. section A.7.1 allows one; anything past
 *  the second only has to be counted as "more than one", and capping the
 *  MATCHES (rather than the tags scanned) is what keeps a filler-tag prefix
 *  from pushing a real second association out of view. */
const MAX_HTML_REFS = 8;
const MAX_HTML_ATTRS = 64;

interface HtmlTag { start: number; afterOpen: number; attrs: Map<string, string>; }

const SPACE = new Set([0x20, 0x09, 0x0a, 0x0d, 0x0c]);

/** Case-insensitive ASCII tag-name match at `at`, followed by a name delimiter. */
function tagNameAt(bin: string, at: number, name: string): boolean {
  for (let k = 0; k < name.length; k++) {
    const c = bin.charCodeAt(at + k);
    if ((c | 0x20) !== name.charCodeAt(k)) return false;
  }
  const d = bin.charCodeAt(at + name.length);
  return SPACE.has(d) || d === 0x2f /* / */ || d === 0x3e /* > */;
}

function htmlAttrs(src: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]*)))?/g;
  for (let m: RegExpExecArray | null; (m = re.exec(src)) !== null; ) {
    // A zero-length match would never advance lastIndex - nudge it by hand
    // rather than trust the pattern to always consume (the hang class again).
    if (!m[0]) { re.lastIndex++; continue; }
    const key = m[1]!.toLowerCase();
    // First wins, matching how a browser resolves a duplicated attribute. A Map
    // (not an object) so an attribute literally named `__proto__` is a key, not
    // a prototype write.
    if (!attrs.has(key)) attrs.set(key, m[2] ?? m[3] ?? m[4] ?? '');
    if (attrs.size >= MAX_HTML_ATTRS) break;
  }
  return attrs;
}

/**
 * Every `<name …>` open tag, LINEARLY.
 *
 * The regex this replaces (`<name(?=[\s/>])([^>]*)>`) is linear only when a `>`
 * exists later in the string. In a `>`-free tail - which is exactly what a
 * truncated paste looks like - every start position scanned to EOF and
 * backtracked to EOF, so the scan was O(n²): 1 MiB of `'<script '` took 76
 * seconds, synchronously, with nothing to catch. The tag CAP did not help,
 * because in that shape there are zero matches to count.
 *
 * Here the `>` search pointer only ever moves FORWARD across the document, so
 * the total `>`-scanning work is O(n) no matter how the tokens are arranged;
 * the outer walk is one `indexOf('<')` chain, also O(n). `emit` returns false to
 * stop the walk once the caller has collected everything it can use.
 */
function scanHtmlTags(bin: string, name: string, emit: (tag: HtmlTag) => boolean): void {
  let gt = -1;
  for (let at = bin.indexOf('<'); at >= 0; at = bin.indexOf('<', at + 1)) {
    if (!tagNameAt(bin, at + 1, name)) continue;
    const after = at + 1 + name.length;
    if (gt < after) {
      gt = bin.indexOf('>', after);
      // No `>` anywhere ahead: no tag can close, so no later start can match
      // either. Stopping here is what makes the whole scan linear.
      if (gt < 0) return;
    }
    if (!emit({ start: at, afterOpen: gt + 1, attrs: htmlAttrs(bin.slice(after, gt)) })) return;
    // A `<` INSIDE the tag we just emitted is an attribute character, not a
    // second tag - which is how a browser reads `<script <script type=…>` too
    // (one element, `<script` as a bare attribute name). Without this skip,
    // prefixing a `<script ` before a conformant element would manufacture a
    // second "association" and refuse the document.
    at = gt;
  }
}

/** The first `</name…>` at or after `from`, found the same linear way. */
function findCloseTag(bin: string, name: string, from: number): { start: number; end: number } | null {
  for (let at = bin.indexOf('</', from); at >= 0; at = bin.indexOf('</', at + 2)) {
    if (!tagNameAt(bin, at + 2, name)) continue;
    const gt = bin.indexOf('>', at + 2 + name.length);
    if (gt < 0) return null;
    return { start: at, end: gt + 1 };
  }
  return null;
}

interface HtmlManifestRef {
  kind: 'inline' | 'link';
  /** Element range: `<script` through `</script>` inclusive (section A.7.1.3), or the
   *  `<link>` tag itself (which is excluded from nothing - see below). */
  start: number;
  end: number;
  base64?: string;
  href?: string;
  inHead: boolean;
  unterminated?: boolean;
}

/** Where the `<head>` ends, for the "was it where the spec says" note. */
function headRegionEnd(bin: string): number {
  const close = bin.search(/<\/head\s*>/i);
  if (close >= 0) return close;
  const body = bin.search(/<body(?=[\s/>])/i);
  return body >= 0 ? body : bin.length;
}

function readHtml(bytes: Uint8Array): TextRead {
  if (bytes.length > MAX_TEXT_BYTES) return tooLarge('HTML document', bytes.length);
  const bin = bytesToBin(bytes);
  const headEnd = headRegionEnd(bin);
  const refs: HtmlManifestRef[] = [];

  scanHtmlTags(bin, 'script', (tag) => {
    if ((tag.attrs.get('type') ?? '').trim().toLowerCase() !== C2PA_ATTACHMENT_MIME) return true;
    const close = findCloseTag(bin, 'script', tag.afterOpen);
    refs.push(close
      ? { kind: 'inline', start: tag.start, end: close.end, base64: bin.slice(tag.afterOpen, close.start), inHead: tag.start < headEnd }
      : { kind: 'inline', start: tag.start, end: bin.length, inHead: tag.start < headEnd, unterminated: true });
    return refs.length < MAX_HTML_REFS;
  });
  scanHtmlTags(bin, 'link', (tag) => {
    // section A.7.1.2: "the validator shall match on the rel attribute alone". `rel` is
    // a space-separated token list, so match the TOKEN, not the whole value.
    const rel = (tag.attrs.get('rel') ?? '').trim().toLowerCase();
    if (!rel.split(/\s+/).includes('c2pa-manifest')) return true;
    refs.push({ kind: 'link', start: tag.start, end: tag.afterOpen, href: tag.attrs.get('href') ?? '', inHead: tag.start < headEnd });
    return refs.length < MAX_HTML_REFS;
  });
  refs.sort((a, b) => a.start - b.start);

  if (!refs.length) return { store: null };
  // section A.7.1.4 step 1, verbatim: "Treating the file as a series of bytes (vs.
  // text), the validator shall PARSE THE HEAD ELEMENT, searching for a script
  // element with type="application/c2pa" or a link element with
  // rel="c2pa-manifest"." So the "at most one association" rule (section A.7.1) is
  // counted over the HEAD, and only over the head.
  //
  // Counting body matches too was a denial-of-verification lever: a second
  // `<link rel="c2pa-manifest">` inside an HTML COMMENT - or in a UGC block, or
  // an unescaped snippet - turned a document a spec validator accepts into a
  // refused one, on a page whose head holds exactly one conformant element.
  // Out-of-head finds are still REPORTED (a silent "no credential" would be the
  // more misleading answer, and the hard binding still has to match), just never
  // allowed to outvote the head.
  const head = refs.filter((r) => r.inHead);
  const chosen = head.length ? head : refs;
  if (chosen.length > 1) {
    return {
      store: null,
      status: C2PA_TEXT_STATUS.htmlMultipleManifests,
      fatal: `HTML document declares ${chosen.length}${chosen.length === MAX_HTML_REFS ? '+' : ''} C2PA manifest associations${head.length ? ' in <head>' : ''}; section A.7.1 allows at most one`,
    };
  }
  const ref = chosen[0]!;
  // Deliberately liberal: the spec's producer rule is "in the head", and its
  // validator step says to parse the head - but a manifest found elsewhere is
  // reported rather than hidden, since the hard binding still has to match and a
  // silent "no credential" would be the more misleading answer.
  // Spread, never assigned: an own `detail: undefined` key is not the same shape
  // as no key at all, and this result is deep-compared by its consumers.
  const note = ref.inHead ? {} : { detail: 'the C2PA element is outside <head> (section A.7.1.1 places it in the head)' };

  if (ref.kind === 'link') {
    const url = safeExternalUrl(ref.href ?? '');
    if (!url) {
      // Still `exclusions: []` - the link form's binding covers the whole
      // document whether or not we are willing to report its href, and a caller
      // that cannot tell "no exclusion" from "not computed" would guess.
      return {
        store: null,
        exclusions: [],
        status: C2PA_TEXT_STATUS.unsupportedReference,
        detail: `<link rel="c2pa-manifest"> href is not an http(s) URL or a relative reference`,
      };
    }
    // section A.7.1.3: the link form has NO exclusion - the hash covers the whole
    // document. An empty array says that positively; `undefined` would only mean
    // "not computed".
    return { store: null, externalUrl: url, exclusions: [], ...note };
  }
  if (ref.unterminated) {
    return {
      store: null,
      status: C2PA_TEXT_STATUS.htmlUnterminatedScript,
      fatal: '<script type="application/c2pa"> has no closing tag - the document looks truncated',
    };
  }
  // section A.7.1.3: ONE exclusion covering the entire element, `<script` through
  // `</script>` inclusive. Wider than our SVG rule (base64 text only) - both are
  // legal for their own binding, and neither is a canonicalisation.
  const exclusions: C2paExclusion[] = [{ start: ref.start, length: ref.end - ref.start }];
  // section A.7.1.1 requires stripping LEADING AND TRAILING whitespace before decoding.
  // Interior whitespace is stripped too: a real store is kilobytes of base64 and
  // every emitter wraps it, and refusing a line-wrapped payload would fail
  // documents the spec plainly intends to work.
  const b64 = (ref.base64 ?? '').replace(/\s+/g, '');
  if (!b64) return { store: null, exclusions, ...note };  // empty element = absent, as SVG
  if (!BASE64_ONLY.test(b64)) {
    return { store: null, exclusions, status: C2PA_TEXT_STATUS.malformedBase64, fatal: 'HTML inline C2PA manifest is not valid base64' };
  }
  try {
    return { store: base64ToBytes(b64), exclusions, ...note };
  } catch {
    return { store: null, exclusions, status: C2PA_TEXT_STATUS.malformedBase64, fatal: 'HTML inline C2PA manifest is not valid base64' };
  }
}

// ── section A.9: structured text (source, config, markup) ────────────────────────────

/**
 * section A.9.4's exclusion: the whole manifest BLOCK.
 *
 * For the single-line comment form the block is the one comment line, host
 * comment prefix and suffix included; for the front-matter form it is the BEGIN
 * line through the END line inclusive, with the host format's own `---` fences
 * NOT part of it. Both are "from the start of BEGIN's line to the end of END's
 * line", so one formula covers both. Then section A.9.4's three placement cases:
 *
 *   at the start of the file → { 0, block incl. its trailing terminator }
 *   at the end of the file   → { offset of the newline BEFORE the block, to EOF }
 *   the whole file           → { 0, file length }
 *
 * Spec-literal on a CRLF file: the end-of-file case starts at the LF, which
 * leaves the preceding CR inside the hashed content. That is what section A.9.4 says.
 * A block in the MIDDLE of a file has no rule at all (section A.9.3.1 places it at the
 * start or the end); the block's own range is returned as the best available
 * answer, and the mismatch will surface as a failed binding rather than a
 * silently-wrong hash.
 *
 * That middle case is also where a FRONT-MATTER block at the top of a file lands
 * - section A.9.4's "at the beginning of the file → start: 0" and its own note that the
 * `---` fences are not part of the exclusion cannot both hold when the fences
 * come first. The note is the more specific rule, so it wins: the exclusion is
 * the block, and the fences stay in the hash.
 *
 * ALTERNATES. section A.9.4's end-of-file rule ("the newline character preceding the
 * block") is one byte ambiguous in two ways a producer cannot be blamed for, and
 * since Lolly is the first section A.9 implementation in the wild its reading would
 * otherwise become de-facto normative by accident:
 *
 *   CRLF - "the newline" reads as the LF alone or as the CRLF pair; the second
 *          reading starts one byte earlier.
 *   a trailing blank line - the block is at the end for a human, in the middle
 *          for `lineEnd >= bin.length`, so the two rules give {12, 89} vs
 *          {13, 88} on the same file.
 *
 * Both readings remove ONLY the block and its own terminator, so neither is
 * looser than the other. The primary is returned first (it is what our own
 * writer will emit); the alternates are offered so a conformant producer on the
 * other reading gets a hash result rather than a non-conformance refusal.
 */
function armorExclusion(bin: string, begin: number, end: number): { primary: C2paExclusion; alternates: C2paExclusion[] } {
  const lineStart = bin.lastIndexOf('\n', begin) + 1;
  const nl = bin.indexOf('\n', end);
  const lineEnd = nl < 0 ? bin.length : nl + 1;
  const alternates: C2paExclusion[] = [];
  // Everything after the block is whitespace → a human calls this "at the end".
  const tailIsBlank = lineEnd >= bin.length || !bin.slice(lineEnd).trim();
  if (lineStart === 0 && lineEnd >= bin.length) return { primary: { start: 0, length: bin.length }, alternates };
  if (lineStart === 0) return { primary: { start: 0, length: lineEnd }, alternates };
  const fromNewline = (at: number): C2paExclusion => ({ start: at, length: bin.length - at });
  if (lineEnd >= bin.length) {
    // CRLF: the pair reading starts at the CR, one byte earlier.
    if (bin.charCodeAt(lineStart - 2) === 0x0d) alternates.push(fromNewline(lineStart - 2));
    return { primary: fromNewline(lineStart - 1), alternates };
  }
  const primary = { start: lineStart, length: lineEnd - lineStart };
  if (tailIsBlank) {
    alternates.push(fromNewline(lineStart - 1));
    if (bin.charCodeAt(lineStart - 2) === 0x0d) alternates.push(fromNewline(lineStart - 2));
  }
  return { primary, alternates };
}

/**
 * section A.9.3.1's inline form: `data:application/c2pa;base64,…` → the base64 payload,
 * or null when this reference is not a C2PA data: URI at all.
 *
 * Parsed by hand rather than by a regex, because RFC 2397 (which section A.9.3.1 cites)
 * permits `;parameter=value` between the media type and `;base64` - and the
 * regex that tolerates that has nested quantifiers, which is a ReDoS on a public
 * drop target. Refusing a legal `;charset=utf-8` form was also inconsistent with
 * a read path that is deliberately liberal everywhere else (interior whitespace
 * in the base64, either casing of `data:`), and reported it as "neither a data:
 * URI nor a URL", which is untrue of the input.
 */
function c2paDataUriPayload(ref: string): string | null {
  if (!/^data:/i.test(ref)) return null;
  const comma = ref.indexOf(',');
  if (comma < 0) return null;
  const params = ref.slice(5, comma).split(';');
  if ((params[0] ?? '').trim().toLowerCase() !== C2PA_ATTACHMENT_MIME) return null;
  // RFC 2397: base64 is the LAST parameter when present. Anything between is a
  // media-type parameter we do not need to understand to read the payload.
  if ((params[params.length - 1] ?? '').trim().toLowerCase() !== 'base64') return null;
  return ref.slice(comma + 1);
}

function readArmor(bytes: Uint8Array): TextRead {
  if (bytes.length > MAX_TEXT_BYTES) return tooLarge('structured text file', bytes.length);
  const bin = bytesToBin(bytes);
  // Cap at 4: all we need to know is "0, 1, or more than 1".
  const begins = indicesOf(bin, ARMOR_BEGIN, 4);
  const ends = indicesOf(bin, ARMOR_END, 4);
  // section A.9.3: "There shall be at most one manifest block per file."
  if (begins.length > 1 || ends.length > 1) {
    return {
      store: null,
      status: C2PA_TEXT_STATUS.structuredTextMultipleReferences,
      fatal: `file carries ${Math.max(begins.length, ends.length)} C2PA manifest blocks; section A.9.3 allows at most one`,
    };
  }
  const begin = begins[0];
  const end = ends[0];
  // section A.9.5: delimiters absent, or only one of the pair (or END before BEGIN) →
  // no manifest block. NOT fatal: prose that quotes the delimiter - this file's
  // own plan does - must not read as a damaged credential.
  if (begin === undefined || end === undefined || end < begin + ARMOR_BEGIN.length) {
    return {
      store: null,
      status: C2PA_TEXT_STATUS.structuredTextNoManifest,
      detail: 'the section A.9 armour delimiters are not both present, in order',
    };
  }
  const { primary, alternates } = armorExclusion(bin, begin, end);
  const exclusions: C2paExclusion[] = [primary];
  const alt = alternates.length ? { exclusionAlternates: alternates.map((e) => [e]) } : {};
  const ref = bin.slice(begin + ARMOR_BEGIN.length, end).trim();
  if (!ref) {
    return { store: null, exclusions, ...alt, status: C2PA_TEXT_STATUS.structuredTextEmptyReference, detail: 'the manifest block is empty' };
  }
  const b64 = c2paDataUriPayload(ref);
  if (b64 !== null) {
    const packed = b64.replace(/\s+/g, '');
    if (!packed || !BASE64_ONLY.test(packed)) {
      return { store: null, exclusions, ...alt, status: C2PA_TEXT_STATUS.malformedBase64, fatal: 'C2PA manifest block data: URI is not valid base64' };
    }
    try {
      return { store: base64ToBytes(packed), exclusions, ...alt };
    } catch {
      return { store: null, exclusions, ...alt, status: C2PA_TEXT_STATUS.malformedBase64, fatal: 'C2PA manifest block data: URI is not valid base64' };
    }
  }
  const url = safeExternalUrl(ref);
  if (!url) {
    return {
      store: null,
      exclusions,
      ...alt,
      status: C2PA_TEXT_STATUS.unsupportedReference,
      detail: 'the manifest reference is neither a data:application/c2pa URI nor an http(s) URL or relative reference',
    };
  }
  // Unlike section A.7's link form, the URL form here STILL has an exclusion: the
  // armour block is bytes in the file, so it must come out before hashing.
  return { store: null, externalUrl: url, exclusions, ...alt };
}

// ── section A.8: unstructured text (variation-selector wrapper) ──────────────────────

const BOM_CP = 0xfeff;
const VS_LOW_START = 0xfe00;
const VS_LOW_END = 0xfe0f;
const VS_HIGH_START = 0xe0100;
const VS_HIGH_END = 0xe01ef;
/** section A.8.2.2 `magic = 0x4332504154585400` - "C2PATXT\0". */
const WRAPPER_MAGIC = [0x43, 0x32, 0x50, 0x41, 0x54, 0x58, 0x54, 0x00];
/** magic(8) + version(1) + manifestLength(4). */
const WRAPPER_HEADER_BYTES = 13;
/** section A.8.4.1 expects one; a hostile paste can hold many. Collect a bounded few -
 *  enough to report `multipleWrappers` honestly, not enough to be a workload. */
const MAX_TEXT_WRAPPERS = 32;

/** section A.8.3.2, verbatim: U+FE00–FE0F → 0–15, U+E0100–E01EF → 16–255, else invalid. */
const variationSelectorToByte = (cp: number): number =>
  cp >= VS_LOW_START && cp <= VS_LOW_END ? cp - VS_LOW_START
    : cp >= VS_HIGH_START && cp <= VS_HIGH_END ? cp - VS_HIGH_START + 16
      : -1;

/** Bytes one code point occupies once encoded as UTF-8. */
const utf8Len = (cp: number): number => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);

/** Walk to the end of a contiguous variation-selector run → its code-unit index
 *  and its NFC-UTF-8 byte offset. */
function runEndFrom(nfc: string, unit: number, byteOff: number): { unit: number; off: number } {
  let i = unit;
  let off = byteOff;
  while (i < nfc.length) {
    const cp = nfc.codePointAt(i)!;
    if (variationSelectorToByte(cp) < 0) break;
    off += utf8Len(cp);
    i += cp > 0xffff ? 2 : 1;
  }
  return { unit: i, off };
}

/**
 * section A.8.4.2 steps 3–4 at one U+FEFF: decode the following selector run.
 * Returns null when this is not a wrapper at all (no U+FEFF here, or the first
 * eight selectors are not the magic) - that check bails after EIGHT selectors,
 * so a megabyte of ordinary variation selectors costs eight steps, not a
 * megabyte. Returns a wrapper with a `status` when the magic matched but the
 * body did not (section 15.12.1.3.2 "invalid version, algorithm, or manifest length").
 */
function decodeWrapperAt(nfc: string, unit: number, byteOff: number): C2paTextWrapper | null {
  const selectorStart = byteOff + utf8Len(BOM_CP);
  let i = unit + 1;              // U+FEFF is one code unit
  let off = selectorStart;
  /** Next selector byte, or -1 at the end of the run / the end of the text. */
  const nextByte = (): number => {
    if (i >= nfc.length) return -1;
    const cp = nfc.codePointAt(i)!;
    const b = variationSelectorToByte(cp);
    if (b < 0) return -1;
    off += utf8Len(cp);
    i += cp > 0xffff ? 2 : 1;
    return b;
  };
  for (const want of WRAPPER_MAGIC) if (nextByte() !== want) return null;
  const at = (status: string, reason: string, version = 0): C2paTextWrapper => {
    const run = runEndFrom(nfc, i, off);
    return { start: byteOff, selectorStart, end: off, runEnd: run.off, version, store: null, status, reason };
  };
  const version = nextByte();
  if (version < 0) return at(C2PA_TEXT_STATUS.textCorruptedWrapper, 'the wrapper ends immediately after its magic number');
  const len: number[] = [];
  for (let k = 0; k < 4; k++) {
    const b = nextByte();
    if (b < 0) break;
    len.push(b);
  }
  if (len.length < 4) {
    return at(C2PA_TEXT_STATUS.textCorruptedWrapper, `the wrapper ends inside manifestLength (${len.length} of 4 bytes)`, version);
  }
  const manifestLength = ((len[0]! << 24) | (len[1]! << 16) | (len[2]! << 8) | len[3]!) >>> 0;
  // section A.8.2.3 defines version 1 only. section 15.12.1.3.2 puts an invalid version under
  // corruptedWrapper; `reason` carries the honest "we don't support this yet"
  // wording so a report never has to guess which of the two it is.
  if (version !== 1) {
    return at(C2PA_TEXT_STATUS.textCorruptedWrapper, `wrapper version ${version} is not supported (section A.8.2.3 defines version 1)`, version);
  }
  // BOUND BEFORE ALLOCATING. manifestLength is four bytes the input chose, up to
  // 4 GiB - sizing an array from it directly is the whole hazard. Every encoded
  // byte costs at least one UTF-16 code unit, so the code units left in the text
  // are an EXACT upper bound on the payload that can possibly be here: derived
  // from the input's length, never from its own length field.
  if (manifestLength > nfc.length - i) {
    return at(C2PA_TEXT_STATUS.textCorruptedWrapper, `the wrapper declares ${manifestLength} manifest bytes, more than the remaining text can hold`, version);
  }
  // …and bound it against THIS WRAPPER'S OWN selector run, not just the rest of
  // the file. The whole-text bound is re-evaluated per wrapper, so 32 headers
  // (≈45 bytes each) at the front of a 15 MiB paste each declared "almost the
  // whole file" and bought 32 × filesize: 508 MiB of ArrayBuffer in 13 ms, on a
  // public drop target, from the one line the header comment singles out. The
  // run ends at the first non-selector, so a header followed immediately by
  // ordinary text now allocates nothing; runs are disjoint (a decoded wrapper
  // skips its whole run), so total allocation across a read is ≤ the input.
  const payloadRun = runEndFrom(nfc, i, off);
  if (manifestLength > payloadRun.unit - i) {
    return { start: byteOff, selectorStart, end: off, runEnd: payloadRun.off, version, store: null,
      status: C2PA_TEXT_STATUS.textCorruptedWrapper,
      reason: `the wrapper declares ${manifestLength} manifest bytes but its selector run carries at most ${payloadRun.unit - i}` };
  }
  const store = new Uint8Array(manifestLength);
  for (let k = 0; k < manifestLength; k++) {
    const b = nextByte();
    if (b < 0) return at(C2PA_TEXT_STATUS.textCorruptedWrapper, `the wrapper is truncated at manifest byte ${k} of ${manifestLength}`, version);
    store[k] = b;
  }
  const run = runEndFrom(nfc, i, off);
  return { start: byteOff, selectorStart, end: off, runEnd: run.off, version, store };
}

function readTextVs(bytes: Uint8Array): TextRead {
  if (bytes.length > MAX_TEXT_BYTES) return tooLarge('text asset', bytes.length);
  // ignoreBOM: a leading U+FEFF is DATA here, not an encoding hint. The default
  // decoder eats it, which would shift every byte offset by three AND hide a
  // wrapper placed at offset 0.
  const raw = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
  // section A.8.7.2/section A.8.7.3: normalize FIRST, then measure. NFC can shorten the text
  // ahead of a wrapper (decomposed é = 3 bytes → composed é = 2), so offsets
  // taken from the raw bytes would be wrong by exactly that much.
  const nfc = raw.normalize('NFC');
  const wrappers: C2paTextWrapper[] = [];
  let i = 0;
  let off = 0;
  while (i < nfc.length && wrappers.length < MAX_TEXT_WRAPPERS) {
    const cp = nfc.codePointAt(i)!;
    const width = cp > 0xffff ? 2 : 1;
    if (cp === BOM_CP) {
      const wrapper = decodeWrapperAt(nfc, i, off);
      if (wrapper) {
        wrappers.push(wrapper);
        // Skip the whole run - nothing inside a selector run can start another
        // wrapper, and re-entering it is how an O(n²) walk gets built.
        const run = runEndFrom(nfc, i + width, off + utf8Len(cp));
        i = run.unit;
        off = run.off;
        continue;
      }
    }
    off += utf8Len(cp);
    i += width;
  }
  // The cap is bounds discipline and stays; what changes is that hitting it is
  // now SAID. An incomplete wrapper list makes the validator's "this exclusion
  // does not correspond to a C2PATextManifestWrapper" refusal a false statement
  // about the asset - it does correspond, we stopped looking - so the flag
  // travels with the carrier and the refusal can stay honest.
  const text: C2paTextCarrier = { nfc, wrappers, ...(wrappers.length >= MAX_TEXT_WRAPPERS && i < nfc.length ? { truncated: true } : {}) };
  if (!wrappers.length) return { store: null, text };
  const valid = wrappers.filter((w) => w.store);
  if (!valid.length) {
    const first = wrappers[0]!;
    return { store: null, text, status: first.status, fatal: `C2PA text wrapper found but unreadable: ${first.reason ?? 'malformed'}` };
  }
  const chosen = valid[0]!;
  return {
    store: chosen.store,
    text,
    // The U+FEFF-inclusive range - see C2paTextWrapper for why this is a choice
    // and not a reading. `selectorStart` is on the wrapper for the other one.
    exclusions: [{ start: chosen.start, length: chosen.end - chosen.start }],
    // section A.8.4.1 hands wrapper SELECTION to the assertion's exclusions, and
    // section 15.12.1.3.1 only fails on multipleWrappers when more than one wrapper
    // MATCHES those exclusions - which extraction cannot know. So this is a
    // notice for the validator, not a refusal here.
    ...(valid.length > 1
      ? { status: C2PA_TEXT_STATUS.textMultipleWrappers, detail: `${valid.length} valid wrappers; section 15.12.1.3.1 selects by the assertion's exclusions` }
      : {}),
  };
}

// ── dispatch ─────────────────────────────────────────────────────────────────

const TEXT_READERS: Readonly<Record<'html' | 'code' | 'text', (bytes: Uint8Array) => TextRead>> = Object.freeze({
  html: readHtml,
  code: readArmor,
  text: readTextVs,
});

/** Keeps the legacy EXTRACTORS contract for the three new formats: `{ manifest }`,
 *  or null for "no credential here", or a throw for "a credential is declared
 *  and cannot be read". Callers that want the reason (and the external URL, the
 *  exclusions, the wrapper list) use extractC2paDetailed. */
const asExtractor = (read: (bytes: Uint8Array) => TextRead) => (bytes: Uint8Array): { manifest: Uint8Array } | null => {
  const r = read(bytes);
  if (r.fatal) throw new Error(r.fatal);
  return r.store ? { manifest: r.store } : null;
};

/**
 * Extraction with everything the text bindings need that `{ manifest }` cannot
 * carry: the external URL a reference-only carrier points at, the exclusions the
 * spec says the hard binding should declare, every section A.8 wrapper with its
 * NFC-normalized byte range, and a status code when the carrier is present but
 * unusable.
 *
 * NEVER THROWS and never fetches. Returns null only when the bytes are not a
 * format this reader knows; a known format with no credential is
 * `{ store: null, format }`, which is a different and useful answer.
 *
 * `format` is optional - omit it to sniff. Binary containers pass straight
 * through to EXTRACTORS, so this is a superset of `extractC2paStore`, not a
 * second code path.
 */
export function extractC2paDetailed(bytes: Uint8Array, format?: SniffFormat | null): C2paExtraction | null {
  if (!(bytes instanceof Uint8Array)) return null;
  const fmt = format ?? sniffFormat(bytes);
  if (!fmt) return null;
  // OWN KEYS ONLY. This is the first extraction entry point whose `format` comes
  // from the CALLER rather than from sniffFormat - which is exactly the shape a
  // paste/`?src=` surface will hand it (a MIME type, a URL param, a filename
  // extension). Both maps are object literals, so a bare `MAP[fmt]` lookup
  // resolves Object.prototype members: `constructor`/`toString` returned
  // `store: undefined` (neither a store nor null - a typed-null hazard for every
  // downstream `if (r.store)`), and `valueOf`/`hasOwnProperty`/`__proto__` THREW
  // out of a function documented NEVER THROWS. The house's own
  // enum-whitelist-prototype-keys lesson, one line late.
  if (!Object.hasOwn(TEXT_READERS, fmt) && !Object.hasOwn(EXTRACTORS, fmt)) return null;
  if (Object.hasOwn(TEXT_READERS, fmt)) {
    const { fatal, ...rest } = TEXT_READERS[fmt as 'html' | 'code' | 'text'](bytes);
    return { ...rest, ...(fatal && !rest.detail ? { detail: fatal } : {}), format: fmt };
  }
  try {
    const ex = EXTRACTORS[fmt](bytes) ?? null;
    return { store: ex ? ex.manifest : null, format: fmt };
  } catch (err) {
    return { store: null, format: fmt, status: C2PA_TEXT_STATUS.credentialUnreadable, detail: (err as Error).message };
  }
}

export const EXTRACTORS: Record<SniffFormat, (bytes: Uint8Array) => { manifest: Uint8Array } | null> = {
  pdf: extractC2paFromPdf,
  png: extractC2paFromPng,
  jpeg: extractC2paFromJpeg,
  gif: extractC2paFromGif,
  svg: extractC2paFromSvg,
  tiff: extractC2paFromTiff,
  webp: extractC2paFromRiff,
  mp4: extractC2paFromMp4,
  avif: extractC2paFromMp4, // same BMFF box walk - the C2PA uuid box is top-level
  webm: extractC2paFromWebm,
  mkv: extractC2paFromWebm,
  mp3: extractC2paFromMp3,
  wav: extractC2paFromRiff,
  ogg: extractC2paFromOgg,
  flac: extractC2paFromFlac,
  // C2PA 2.4 text bindings. `html` and `code` return null for the REFERENCE
  // forms (section A.7.1.2 `<link>`, section A.9.3 URL) - nothing is embedded, so there is no
  // store to hand back; extractC2paDetailed carries the URL instead.
  html: asExtractor(readHtml),
  code: asExtractor(readArmor),
  text: asExtractor(readTextVs),
};


// IPTC DigitalSourceType slugs that denote AI/ML-generated pixels. A file is
// flagged AI-generated when any recorded action carries one of these - full-AI
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
// AI provenance and the "created" step routinely live in a PARENT manifest - a
// chain that ends in a watermark + re-encode whose active manifest never records
// "created" at all - so reading only the active manifest (parseC2paStore) misses
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
      } catch { /* opaque claim - no generator */ }
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
              // Raw CBOR parameters - surfaced for readers that recover a step's
              // machine-readable context (e.g. a TTS clip's recorded script).
              // Deliberately NOT part of the dedupe key below: Maps stringify
              // opaquely, and a parameters-only difference on an otherwise
              // identical step is a re-record of the same event.
              parameters: act.get?.('parameters'),
              generator,
            });
          }
        } catch { /* opaque/absent actions - skip this assertion */ }
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
// manifest superboxes verbatim (store order, active last) - copied wholesale so
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
 * file carries no readable C2PA. The store is SMALL (no pixels/EXIF) - ingest
 * keeps only this to preserve provenance without re-hoarding the metadata the
 * upload pipeline deliberately strips.
 *
 * Fail-closed by design: every throw becomes null. Two consequences worth
 * knowing now that the text bindings are readable - a reference-only carrier
 * (section A.7's `<link>`, section A.9's URL form) has no embedded store, so it is null here
 * too; and `format` can now be 'html'/'code'/'text', which NO container in
 * c2pa-containers.ts can place back (they are read-only in M1), so a `format`
 * from this function must not be handed to `attachC2paStore` unguarded.
 * Callers that need the reason, the external URL, or the section A.8 wrapper ranges
 * use {@link extractC2paDetailed}.
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
 * C2PA (nothing to preserve). Purely read-side - the writer stays cycle-free.
 */
export function prepareC2paIngredient(bytes: Uint8Array): C2paIngredientData | null {
  const ex = extractC2paStore(bytes);
  return ex ? prepareC2paIngredientFromStore(ex.store, ex.format) : null;
}

/**
 * Read EVERY C2PA manifest a file already carries and package each as an
 * ingredient - so a tool that stamps a fresh authorship claim onto an existing
 * file can PRESERVE what is already inside it (relationship `parentOf`) instead
 * of orphaning it. Collects:
 *   1. the container's own document-level credential (all supported formats), and
 *   2. element-level credentials nested inside a container - today, the signed
 *      rasters an SVG embeds via `<image href="data:image/…;base64,…">` (an
 *      artist's vector that places already-credentialed photos). Each embedded
 *      raster's own C2PA travels forward as its own ingredient.
 * Deduplicated by active-manifest label. Purely read-side and NEVER throws - a
 * file with nothing signed returns `[]`. (PDF image-XObject and MP4 per-track
 * element manifests are a future extension; the container-level manifest of a
 * signed PDF/MP4 is already preserved by step 1.)
 */
export function collectIngredients(bytes: Uint8Array): C2paIngredientData[] {
  const out: C2paIngredientData[] = [];
  const seen = new Set<string>();
  const push = (ing: C2paIngredientData | null): void => {
    if (ing && ing.activeLabel && !seen.has(ing.activeLabel)) { seen.add(ing.activeLabel); out.push(ing); }
  };
  if (!(bytes instanceof Uint8Array)) return out;
  // 1. The container's own manifest.
  push(prepareC2paIngredient(bytes));
  // 2. Nested rasters an SVG embeds as data URIs - each may carry its own C2PA.
  if (sniffFormat(bytes) === 'svg') {
    for (const raster of svgEmbeddedRasters(bytes)) push(prepareC2paIngredient(raster));
  }
  return out;
}

/** Decode the base64 data-URI rasters an SVG embeds via `<image href|xlink:href>`.
 *  Best-effort: a malformed/oversized entry is skipped, never fatal. */
function svgEmbeddedRasters(bytes: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  let text: string;
  try { text = bytesToBin(bytes); } catch { return out; }
  // href or xlink:href pointing at a base64 image data URI. Non-greedy, tolerant
  // of single/double quotes and whitespace after the comma.
  const re = /(?:xlink:)?href\s*=\s*(['"])\s*data:image\/[a-z0-9.+-]+;base64,\s*([A-Za-z0-9+/=\s]+?)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    try {
      const raster = base64ToBytes(m[2]!.replace(/\s+/g, ''));
      if (raster.length) out.push(raster);
    } catch { /* malformed data URI - skip */ }
  }
  return out;
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
