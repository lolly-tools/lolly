// SPDX-License-Identifier: MPL-2.0
/**
 * C2PA (Content Credentials) verifier — pure, DOM-free.
 *
 * The read-side counterpart to c2pa.js: sniffs the container (PDF, PNG/APNG,
 * JPEG, GIF, SVG, TIFF, WebP, MP4/ISO-BMFF, WebM/Matroska), extracts the
 * embedded manifest the way c2pa-rs reads each format, walks the JUMBF store,
 * and re-checks everything a validator checks — the claim's hashed-URI
 * assertion references, the COSE claim signature (WebCrypto ES256/384/512
 * against the x5chain leaf), the certificate validity window, and the hard
 * binding: c2pa.hash.data (sha256 of the file with the exclusion ranges
 * OMITTED) or, for BMFF assets, c2pa.hash.bmff.v2/v3 (sha256 over the
 * surviving top-level boxes, each prefixed with its u64-BE file offset).
 * Entirely on-device: nothing is uploaded, mirroring the trust posture of the
 * writer (self-signed ephemeral keys — a credential is evidence of integrity,
 * not identity).
 *
 * Check codes deliberately reuse the C2PA validation-status vocabulary
 * (`claimSignature.validated`, `assertion.hashedURI.match`,
 * `assertion.dataHash.match`, `signingCredential.untrusted`, …) so a report
 * here reads the same as one from c2patool / verify.contentauthenticity.org.
 * `signingCredential.untrusted` is reported whenever no caller-pinned trust
 * anchor vouches for the chain (the default: there is no trust list and the
 * ephemeral signer is anonymous by design); it is excluded from the `state`
 * verdict, which reflects integrity only. With `opts.trustAnchors` (the same
 * pinning `c2patool --trust_anchors` does), a chain that verifies to a root
 * upgrades the row to `signingCredential.trusted` and surfaces the identity.
 *
 * The report also answers the question users actually ask: was this genuinely
 * made with Lolly? `madeWithLolly` is true when the credential is INTACT and
 * records Lolly as the generator; the `tools.lolly.export` assertion's export
 * context (tool, surface, browser engine, OS) is surfaced as `environment`.
 * That is an integrity statement, not an identity proof — any writer could
 * claim the name, which the view copy is honest about.
 *
 * Like c2pa.js / emf.js / eps.js this is a format authority: no DOM, no
 * Handlebars — fully node:test-able (globalThis.crypto only).
 */

import { encodeCbor, LOLLY_EXPORT_ASSERTION, C2PA_BMFF_UUID, C2PA_ATTACHMENT_MIME } from './c2pa.ts';
import { EBML_ID, SEGMENT_ID, readId, readVint, idAt } from './video-meta.ts';

const td = new TextDecoder();
const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;

// ─── bytes ────────────────────────────────────────────────────────────────────

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// TS 5.7+ widens Uint8Array to Uint8Array<ArrayBufferLike>; WebCrypto wants an
// ArrayBuffer-backed BufferSource. Every buffer here is ArrayBuffer-backed, so
// this is a type-only widening, erased at runtime.
const asBufferSource = (b: Uint8Array): BufferSource => b as unknown as BufferSource;

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle.digest('SHA-256', asBufferSource(bytes)));
}

const hexOf = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

// Byte-transparent binary string (TextDecoder('latin1') remaps 0x80–0x9f).
function bytesToBin(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
  }
  return s;
}

// ─── CBOR decoder ─────────────────────────────────────────────────────────────
// Full enough for the wild, not just our writer: definite AND indefinite
// lengths, half/single/double floats — foreign manifests (Adobe et al.) use
// them freely and a good-citizen validator must still read those claims.

const CBOR_BREAK = Symbol('cbor break');

function decodeItem(b: Uint8Array, i: number): [unknown, number] {
  if (i >= b.length) throw new Error('cbor: truncated');
  const ib = b[i++]!;
  const major = ib >> 5;
  let n = ib & 0x1f;
  const indefinite = n === 31;
  if (indefinite) {
    if (major < 2 || major === 6) throw new Error('cbor: reserved indefinite head');
    if (major === 7) return [CBOR_BREAK, i];
  } else if (n === 24) { n = b[i]!; i += 1; }
  else if (n === 25) { n = (b[i]! << 8) | b[i + 1]!; i += 2; }
  else if (n === 26) { n = b[i]! * 0x1000000 + ((b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!); i += 4; }
  else if (n === 27) { n = Number(new DataView(b.buffer, b.byteOffset + i, 8).getBigUint64(0)); i += 8; }
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
          const [v, j] = decodeItem(b, i);
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
        const [v, j] = decodeItem(b, i);
        i = j;
        if (v === CBOR_BREAK) break;
        a.push(v);
      }
      return [a, i];
    }
    case 5: {
      const m = new Map<unknown, unknown>();
      for (let k = 0; indefinite || k < n; k++) {
        const [key, j] = decodeItem(b, i);
        if (key === CBOR_BREAK) { i = j; break; }
        const [v, j2] = decodeItem(b, j);
        m.set(key, v);
        i = j2;
      }
      return [m, i];
    }
    case 6: { const [v, j] = decodeItem(b, i); return [{ tag: n, value: v }, j]; }
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
interface C2paStoreParts {
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

type SniffFormat = 'pdf' | 'png' | 'jpeg' | 'gif' | 'svg' | 'tiff' | 'webp' | 'mp4' | 'webm' | 'mkv';

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
      const manifest = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let o = 0;
      for (const p of parts) { manifest.set(p, o); o += p.length; }
      return { manifest };
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
  const s = atob(b64);
  const manifest = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) manifest[i] = s.charCodeAt(i);
  return { manifest };
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

interface BmffBox { off: number; size: number; hdr: number; type: string; }

/**
 * Walk the file's top-level BMFF boxes → [{ off, size, hdr, type }] (hdr =
 * header length; 16 when a 64-bit largesize is present). Unlike the writer
 * (which refuses 64-bit boxes it would have to rewrite), reading handles them:
 * foreign files may legitimately carry >4GB mdat boxes.
 */
function bmffTopBoxes(bytes: Uint8Array): BmffBox[] {
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

const EXTRACTORS: Record<SniffFormat, (bytes: Uint8Array) => { manifest: Uint8Array } | null> = {
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

// ─── DER / X.509 (read side) ──────────────────────────────────────────────────

interface DerTlv { tag: number; start: number; contentStart: number; end: number; }

function derTlv(b: Uint8Array, i: number): DerTlv {
  if (i + 2 > b.length) throw new Error('der: truncated');
  const tag = b[i]!;
  let len = b[i + 1]!;
  let j = i + 2;
  if (len & 0x80) {
    const k = len & 0x7f;
    len = 0;
    for (let x = 0; x < k; x++) len = len * 256 + b[j++]!;
  }
  if (j + len > b.length) throw new Error('der: length overruns buffer');
  return { tag, start: i, contentStart: j, end: j + len };
}

function derChildren(b: Uint8Array, tlv: DerTlv): DerTlv[] {
  const kids: DerTlv[] = [];
  let i = tlv.contentStart;
  while (i < tlv.end) {
    const c = derTlv(b, i);
    kids.push(c);
    i = c.end;
  }
  return kids;
}

function decodeOid(b: Uint8Array, tlv: DerTlv): string {
  const bytes = b.slice(tlv.contentStart, tlv.end);
  const parts = [Math.floor(bytes[0]! / 40), bytes[0]! % 40];
  let v = 0;
  for (let i = 1; i < bytes.length; i++) {
    v = v * 128 + (bytes[i]! & 0x7f);
    if (!(bytes[i]! & 0x80)) { parts.push(v); v = 0; }
  }
  return parts.join('.');
}

// UTCTime (YYMMDD…Z, RFC 5280 sliding window) or GeneralizedTime (YYYYMMDD…Z).
function decodeTime(b: Uint8Array, tlv: DerTlv): Date {
  const s = td.decode(b.slice(tlv.contentStart, tlv.end));
  const four = tlv.tag === 0x18;
  const yy = four ? +s.slice(0, 4) : (+s.slice(0, 2) < 50 ? 2000 + +s.slice(0, 2) : 1900 + +s.slice(0, 2));
  const o = four ? 2 : 0;
  return new Date(Date.UTC(yy, +s.slice(2 + o, 4 + o) - 1, +s.slice(4 + o, 6 + o), +s.slice(6 + o, 8 + o), +s.slice(8 + o, 10 + o), +s.slice(10 + o, 12 + o)));
}

interface DName { commonName?: string; organization?: string; }

// Name → { commonName, organization } (first CN / O attribute found).
function decodeName(cert: Uint8Array, nameTlv: DerTlv): DName {
  const out: DName = {};
  for (const rdn of derChildren(cert, nameTlv)) {           // SET
    for (const atv of derChildren(cert, rdn)) {             // SEQUENCE { oid, value }
      const [oidTlv, valTlv] = derChildren(cert, atv);
      if (!oidTlv || !valTlv || oidTlv.tag !== 0x06) continue;
      const oid = decodeOid(cert, oidTlv);
      const val = td.decode(cert.slice(valTlv.contentStart, valTlv.end));
      if (oid === '2.5.4.3' && out.commonName == null) out.commonName = val;
      if (oid === '2.5.4.10' && out.organization == null) out.organization = val;
    }
  }
  return out;
}

// [3] extensions walk: SAN rfc822Name emails + basicConstraints cA. Every
// read goes through derTlv (bounds-checked BEFORE use — the GIF lesson) and a
// hostile/malformed extension block degrades to the defaults, never throws:
// certificates come straight out of attacker-controlled files.
function decodeExtensions(cert: Uint8Array, kids: DerTlv[], shift: number): { sanEmails: string[]; isCa: boolean } {
  const out: { sanEmails: string[]; isCa: boolean } = { sanEmails: [], isCa: false };
  try {
    const wrap = kids.slice(shift + 6).find((k) => k.tag === 0xa3);
    if (!wrap) return out;
    const [seq] = derChildren(cert, wrap); // Extensions ::= SEQUENCE OF Extension
    if (!seq || seq.tag !== 0x30) return out;
    for (const ext of derChildren(cert, seq)) {
      if (ext.tag !== 0x30) continue;
      const parts = derChildren(cert, ext); // { extnID OID, critical BOOLEAN?, extnValue OCTET STRING }
      const value = parts[parts.length - 1];
      if (!parts[0] || parts[0].tag !== 0x06 || !value || value.tag !== 0x04) continue;
      const oid = decodeOid(cert, parts[0]);
      if (oid === '2.5.29.17') { // subjectAltName: GeneralNames SEQUENCE
        const names = derTlv(cert, value.contentStart);
        if (names.tag !== 0x30 || names.end > value.end) continue;
        for (const gn of derChildren(cert, names)) {
          if (gn.tag === 0x81) out.sanEmails.push(td.decode(cert.slice(gn.contentStart, gn.end))); // rfc822Name (IA5String)
        }
      } else if (oid === '2.5.29.19') { // basicConstraints: SEQUENCE { cA BOOLEAN DEFAULT FALSE, … }
        const bc = derTlv(cert, value.contentStart);
        if (bc.tag !== 0x30 || bc.end > value.end) continue;
        const [ca] = derChildren(cert, bc);
        out.isCa = !!ca && ca.tag === 0x01 && ca.end > ca.contentStart && cert[ca.contentStart] !== 0;
      }
    }
  } catch { /* a malformed extension block never breaks certificate display */ }
  return out;
}

interface ParsedCertificate {
  subject: DName;
  issuer: DName;
  notBefore: Date;
  notAfter: Date;
  selfSigned: boolean;
  spki: Uint8Array;
  tbsBytes: Uint8Array;
  signatureRaw: Uint8Array | null;
  sigAlg: CertSigAlg | null;
  issuerBytes: Uint8Array;
  subjectBytes: Uint8Array;
  sanEmails: string[];
  isCa: boolean;
}

// How an ISSUER signed a child's tbsCertificate. Real C2PA hierarchies span
// ECDSA (Google, the camera makers), RSA PKCS#1 v1.5 (Adobe, Microsoft,
// DigiCert, SSL.com roots), RSA-PSS, and Ed25519 (Trufo). The digest is fixed
// by the OID for ECDSA/RSA; RSA-PSS carries it in the AlgorithmIdentifier
// parameters. Read from the CHILD cert (it names the algorithm the parent used).
type CertSigAlg =
  | { scheme: 'ecdsa'; hash: string }
  | { scheme: 'rsa'; hash: string }
  | { scheme: 'rsa-pss'; hash: string; saltLength: number }
  | { scheme: 'ed25519' };

// signatureAlgorithm OID (hex of the OID content) → fixed-digest schemes.
const SIG_ALGS: Record<string, { scheme: 'ecdsa' | 'rsa'; hash: string }> = {
  '2a8648ce3d040302': { scheme: 'ecdsa', hash: 'SHA-256' }, // ecdsa-with-SHA256
  '2a8648ce3d040303': { scheme: 'ecdsa', hash: 'SHA-384' }, // ecdsa-with-SHA384
  '2a8648ce3d040304': { scheme: 'ecdsa', hash: 'SHA-512' }, // ecdsa-with-SHA512
  '2a864886f70d01010b': { scheme: 'rsa', hash: 'SHA-256' }, // sha256WithRSAEncryption
  '2a864886f70d01010c': { scheme: 'rsa', hash: 'SHA-384' }, // sha384WithRSAEncryption
  '2a864886f70d01010d': { scheme: 'rsa', hash: 'SHA-512' }, // sha512WithRSAEncryption
};
const SIG_OID_RSA_PSS = '2a864886f70d01010a'; // id-RSASSA-PSS
const SIG_OID_ED25519 = '2b6570';             // id-Ed25519
const HASH_OIDS: Record<string, string> = {
  '608648016503040201': 'SHA-256', '608648016503040202': 'SHA-384',
  '608648016503040203': 'SHA-512', '2b0e03021a': 'SHA-1',
};
const HASH_LEN: Record<string, number> = { 'SHA-1': 20, 'SHA-256': 32, 'SHA-384': 48, 'SHA-512': 64 };

// Parse a signatureAlgorithm AlgorithmIdentifier into a verify recipe, or null
// for anything unrecognised (→ the chain step is a quiet no-match, never a
// crash, never a false trust).
function parseCertSigAlg(cert: Uint8Array, algId: DerTlv): CertSigAlg | null {
  try {
    const kids = derChildren(cert, algId);
    const oidTlv = kids[0];
    if (!oidTlv || oidTlv.tag !== 0x06) return null;
    const oid = hexOf(cert.slice(oidTlv.contentStart, oidTlv.end));
    const fixed = SIG_ALGS[oid];
    if (fixed) return { ...fixed };
    if (oid === SIG_OID_ED25519) return { scheme: 'ed25519' };
    if (oid === SIG_OID_RSA_PSS) {
      // RSASSA-PSS-params ::= SEQUENCE { [0] hashAlgorithm, [1] maskGen,
      // [2] saltLength INTEGER DEFAULT 20, [3] trailerField }. Absent [0]/[2]
      // fall back to the ASN.1 defaults (SHA-1, 20).
      let hash = 'SHA-1';
      let saltLength = 20;
      const params = kids[1];
      if (params && params.tag === 0x30) {
        for (const field of derChildren(cert, params)) {
          if (field.tag === 0xa0) {
            const h = derChildren(cert, field)[0];
            if (h && h.tag === 0x06) hash = HASH_OIDS[hexOf(cert.slice(h.contentStart, h.end))] || hash;
          } else if (field.tag === 0xa2) {
            const s = derChildren(cert, field)[0];
            if (s && s.tag === 0x02) { let n = 0; for (const b of cert.slice(s.contentStart, s.end)) n = n * 256 + b; saltLength = n; }
          }
        }
      }
      return { scheme: 'rsa-pss', hash, saltLength };
    }
    return null;
  } catch { return null; }
}

/** Pull display facts + the SPKI out of a DER certificate. */
export function parseCertificate(cert: Uint8Array): ParsedCertificate {
  const top = derTlv(cert, 0);
  // Certificate: tbsCertificate, signatureAlgorithm, signatureValue BIT STRING.
  const topKids = derChildren(cert, top);
  const tbs = topKids[0]!;
  const sigAlgTlv = topKids[1];
  const sigTlv = topKids[2];
  const kids = derChildren(cert, tbs);
  // tbsCertificate: optional [0] version, serial, sigAlg, issuer, validity, subject, SPKI, …
  const shift = kids[0]!.tag === 0xa0 ? 1 : 0;
  const issuerTlv = kids[shift + 2]!;
  const validity = derChildren(cert, kids[shift + 3]!);
  const subjectTlv = kids[shift + 4]!;
  const spkiTlv = kids[shift + 5]!;
  const issuerBytes = cert.slice(issuerTlv.start, issuerTlv.end);
  const subjectBytes = cert.slice(subjectTlv.start, subjectTlv.end);
  const ext = decodeExtensions(cert, kids, shift);
  return {
    subject: decodeName(cert, subjectTlv),
    issuer: decodeName(cert, issuerTlv),
    notBefore: decodeTime(cert, validity[0]!),
    notAfter: decodeTime(cert, validity[1]!),
    selfSigned: hexOf(issuerBytes) === hexOf(subjectBytes),
    spki: cert.slice(spkiTlv.start, spkiTlv.end),
    // Additive (1.11.0) — the chain-verification raw material. signatureRaw is
    // the signatureValue BIT STRING content minus its unused-bits byte: for
    // ECDSA that is still a DER ECDSA-Sig-Value (ecdsaDerToRaw converts).
    tbsBytes: cert.slice(tbs.start, tbs.end),
    signatureRaw: sigTlv && sigTlv.tag === 0x03 && sigTlv.end > sigTlv.contentStart + 1
      ? cert.slice(sigTlv.contentStart + 1, sigTlv.end)
      : null,
    sigAlg: sigAlgTlv ? parseCertSigAlg(cert, sigAlgTlv) : null,
    issuerBytes,
    subjectBytes,
    sanEmails: ext.sanEmails,
    isCa: ext.isCa,
  };
}

// ─── trust-anchor chain verification ──────────────────────────────────────────

// DER ECDSA-Sig-Value (SEQUENCE { INTEGER r, INTEGER s }) → the fixed-width
// raw r||s WebCrypto verifies — the inverse of x509.js ecdsaRawToDer: strip
// each INTEGER's leading 0x00 pads, left-pad back to the curve width.
function ecdsaDerToRaw(derSig: Uint8Array, size = 32): Uint8Array {
  const [r, s] = derChildren(derSig, derTlv(derSig, 0));
  if (!r || !s || r.tag !== 0x02 || s.tag !== 0x02) throw new Error('der: not an ECDSA-Sig-Value');
  const out = new Uint8Array(size * 2);
  let at = 0;
  for (const int of [r, s]) {
    let i = int.contentStart;
    while (i < int.end && derSig[i] === 0) i++;
    const v = derSig.subarray(i, int.end);
    if (v.length > size) throw new Error('der: ECDSA integer wider than the curve');
    out.set(v, at + size - v.length);
    at += size;
  }
  return out;
}

// EC named-curve OIDs → WebCrypto params. C2PA signing hierarchies mix curves
// (a Google chain is a P-256 leaf under a P-384 intermediate under a P-384
// root), and an ECDSA CA signs with the SHA paired to its curve, so the verify
// hash and the r||s integer width are read from the SIGNER's curve, not fixed.
const EC_CURVES: Record<string, { curve: string; hash: string; size: number }> = {
  '2a8648ce3d030107': { curve: 'P-256', hash: 'SHA-256', size: 32 }, // prime256v1
  '2b81040022': { curve: 'P-384', hash: 'SHA-384', size: 48 },       // secp384r1
  '2b81040023': { curve: 'P-521', hash: 'SHA-512', size: 66 },       // secp521r1
};

// Read the named curve out of an EC SubjectPublicKeyInfo (SEQUENCE {
// AlgorithmIdentifier { ecPublicKey, curveOID }, BIT STRING }). A non-EC key
// (RSA root) or an unknown curve returns null → the step is a quiet no-match,
// so an RSA-rooted signer stays honestly untrusted rather than crashing.
function ecParamsOf(spki: Uint8Array): { curve: string; hash: string; size: number } | null {
  try {
    const algId = derChildren(spki, derTlv(spki, 0))[0]!;
    const curveOid = derChildren(spki, algId)[1];
    if (!curveOid || curveOid.tag !== 0x06) return null;
    return EC_CURVES[hexOf(spki.slice(curveOid.contentStart, curveOid.end))] ?? null;
  } catch { return null; }
}

// One issuer→subject step: the child's issuer Name must byte-match the signer's
// subject AND the signature over the child's tbsCertificate must verify against
// the signer's SPKI, under the algorithm the CHILD's signatureAlgorithm names.
// Covers every scheme real C2PA CAs sign certificates with — ECDSA P-256/384/521
// (Google, camera makers), RSA PKCS#1 v1.5 (Adobe, Microsoft, DigiCert, SSL.com),
// RSA-PSS, and Ed25519 (Trufo). An unrecognised algorithm, a key that can't be
// imported for it, or any thrown error is a quiet no-match: a signer we cannot
// cryptographically verify stays honestly UNTRUSTED — never a false trust.
export async function signedBy(child: ParsedCertificate, signer: ParsedCertificate): Promise<boolean> {
  if (!child.signatureRaw || !child.sigAlg || hexOf(child.issuerBytes) !== hexOf(signer.subjectBytes)) return false;
  const sa = child.sigAlg;
  try {
    if (sa.scheme === 'ecdsa') {
      const ec = ecParamsOf(signer.spki);
      if (!ec) return false;
      const key = await subtle.importKey('spki', asBufferSource(signer.spki), { name: 'ECDSA', namedCurve: ec.curve }, false, ['verify']);
      return await subtle.verify({ name: 'ECDSA', hash: sa.hash }, key, asBufferSource(ecdsaDerToRaw(child.signatureRaw, ec.size)), asBufferSource(child.tbsBytes));
    }
    if (sa.scheme === 'rsa') {
      const key = await subtle.importKey('spki', asBufferSource(normalizeRsaSpki(signer.spki)), { name: 'RSASSA-PKCS1-v1_5', hash: sa.hash }, false, ['verify']);
      return await subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, asBufferSource(child.signatureRaw), asBufferSource(child.tbsBytes));
    }
    if (sa.scheme === 'rsa-pss') {
      const key = await subtle.importKey('spki', asBufferSource(normalizeRsaSpki(signer.spki)), { name: 'RSA-PSS', hash: sa.hash }, false, ['verify']);
      return await subtle.verify({ name: 'RSA-PSS', saltLength: sa.saltLength }, key, asBufferSource(child.signatureRaw), asBufferSource(child.tbsBytes));
    }
    // Ed25519 — the raw 64-byte signature verifies directly; not universal in
    // WebCrypto, so a missing implementation throws → quiet no-match.
    const key = await subtle.importKey('spki', asBufferSource(signer.spki), { name: 'Ed25519' }, false, ['verify']);
    return await subtle.verify({ name: 'Ed25519' }, key, asBufferSource(child.signatureRaw), asBufferSource(child.tbsBytes));
  } catch { return false; }
}

// Does the x5chain reach a pinned root? Walks leaf → intermediates (the rest of
// the embedded x5chain) → a caller-pinned anchor, verifying each issuer→subject
// signature and requiring every intermediate to be basicConstraints CA:TRUE (or
// any issued leaf could vouch for a forged identity). Real Adobe / Microsoft /
// OpenAI chains carry more than one intermediate, so the walk is not depth-1.
// Guards: intermediates are consumed at most once (no A→B→A loops); the anchor
// is only ever the PINNED cert, never a root the chain ships for itself.
//
// DoS bound: the walk re-scans not-yet-used intermediates each hop, so an
// attacker x5chain of N same-subject CA certs would cost O(N²) serial WebCrypto
// verifications (minutes of pinned CPU) — verifyC2pa must never hang. So only
// the first MAX_CHAIN_INTERMEDIATES are ever parsed/considered; real C2PA chains
// are ≤ ~4–6 deep, far under the cap, while a hostile chain is bounded to a
// trivial O(cap²). Hostile chains must never crash: every parse/import/verify
// failure is a quiet no-match. → the anchor, or null.
const MAX_CHAIN_INTERMEDIATES = 8;
async function chainsToAnchor(leaf: ParsedCertificate, chainDers: unknown[], trustAnchors: Uint8Array[]): Promise<ParsedCertificate | null> {
  const anchors: ParsedCertificate[] = [];
  for (const der of trustAnchors) { try { anchors.push(parseCertificate(der)); } catch { /* skip malformed anchor */ } }
  const intermediates: ParsedCertificate[] = [];
  // Slice BEFORE parsing so a giant x5chain can't even force N cert parses.
  for (const der of chainDers.slice(1, 1 + MAX_CHAIN_INTERMEDIATES)) {
    if (der instanceof Uint8Array) { try { const c = parseCertificate(der); if (c.isCa) intermediates.push(c); } catch { /* skip */ } }
  }
  let current = leaf;
  const used = new Set<ParsedCertificate>();
  // At most (intermediates + 1) hops: each iteration either reaches an anchor or
  // climbs one fresh intermediate; if neither, the chain is broken.
  for (let hop = 0; hop <= intermediates.length; hop++) {
    for (const anchor of anchors) {
      try { if (await signedBy(current, anchor)) return anchor; } catch { /* not this anchor */ }
    }
    let next: ParsedCertificate | null = null;
    for (const mid of intermediates) {
      if (used.has(mid) || hexOf(mid.subjectBytes) !== hexOf(current.issuerBytes)) continue;
      try { if (await signedBy(current, mid)) { next = mid; break; } } catch { /* try next intermediate */ }
    }
    if (!next) break;
    used.add(next);
    current = next;
  }
  return null;
}

// ─── verification ─────────────────────────────────────────────────────────────

type CoseAlg =
  | { kind: 'ecdsa'; curve: string; hash: string; name: string }
  | { kind: 'rsa-pss'; hash: string; saltLength: number; name: string }
  | { kind: 'ed25519'; name: string };

// COSE alg id → WebCrypto parameters. ECDSA covers our own writer; RSA-PSS
// and Ed25519 cover the certs real-world (Adobe et al.) manifests ship with.
const COSE_ALGS: Record<string, CoseAlg> = {
  '-7': { kind: 'ecdsa', curve: 'P-256', hash: 'SHA-256', name: 'ES256' },
  '-35': { kind: 'ecdsa', curve: 'P-384', hash: 'SHA-384', name: 'ES384' },
  '-36': { kind: 'ecdsa', curve: 'P-521', hash: 'SHA-512', name: 'ES512' },
  '-37': { kind: 'rsa-pss', hash: 'SHA-256', saltLength: 32, name: 'PS256' },
  '-38': { kind: 'rsa-pss', hash: 'SHA-384', saltLength: 48, name: 'PS384' },
  '-39': { kind: 'rsa-pss', hash: 'SHA-512', saltLength: 64, name: 'PS512' },
  '-8': { kind: 'ed25519', name: 'Ed25519' },
};

// id-RSASSA-PSS AlgorithmIdentifier OID (1.2.840.113549.1.1.10). WebCrypto
// only imports RSA SPKIs declared as plain rsaEncryption, so a PSS-declared
// SPKI (what C2PA test/production certs actually carry) is re-wrapped: same
// key BIT STRING, rsaEncryption + NULL params AlgorithmIdentifier.
const OID_RSASSA_PSS = Uint8Array.of(0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0a);
const ALGID_RSA_ENCRYPTION = Uint8Array.of(0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00);

function derWrap(tag: number, body: Uint8Array): Uint8Array {
  let head: Uint8Array;
  if (body.length < 0x80) head = Uint8Array.of(tag, body.length);
  else if (body.length < 0x100) head = Uint8Array.of(tag, 0x81, body.length);
  else head = Uint8Array.of(tag, 0x82, body.length >>> 8, body.length & 0xff);
  return concatBytes([head, body]);
}

function normalizeRsaSpki(spki: Uint8Array): Uint8Array {
  const top = derTlv(spki, 0);
  const [algTlv, keyTlv] = derChildren(spki, top);
  const oid = derTlv(spki, algTlv!.contentStart);
  const oidBytes = spki.slice(oid.start, oid.end);
  if (oidBytes.length !== OID_RSASSA_PSS.length || !oidBytes.every((b, i) => b === OID_RSASSA_PSS[i])) return spki;
  return derWrap(0x30, concatBytes([ALGID_RSA_ENCRYPTION, spki.slice(keyTlv!.start, keyTlv!.end)]));
}

async function verifyCoseSignature(alg: CoseAlg, spki: Uint8Array, sigRaw: Uint8Array, sigStructure: Uint8Array): Promise<boolean> {
  if (alg.kind === 'ecdsa') {
    const key = await subtle.importKey('spki', asBufferSource(spki), { name: 'ECDSA', namedCurve: alg.curve }, false, ['verify']);
    return subtle.verify({ name: 'ECDSA', hash: alg.hash }, key, asBufferSource(sigRaw), asBufferSource(sigStructure));
  }
  if (alg.kind === 'rsa-pss') {
    const key = await subtle.importKey('spki', asBufferSource(normalizeRsaSpki(spki)), { name: 'RSA-PSS', hash: alg.hash }, false, ['verify']);
    return subtle.verify({ name: 'RSA-PSS', saltLength: alg.saltLength }, key, asBufferSource(sigRaw), asBufferSource(sigStructure));
  }
  // Ed25519 — not yet universal in WebCrypto; the caller reports a clear
  // "cannot verify on this device" when importKey/verify throws.
  const key = await subtle.importKey('spki', asBufferSource(spki), { name: 'Ed25519' }, false, ['verify']);
  return subtle.verify({ name: 'Ed25519' }, key, asBufferSource(sigRaw), asBufferSource(sigStructure));
}

const HASHED_URI_PREFIX = 'self#jumbf=c2pa.assertions/';

interface C2paCheck { code: string; ok: boolean; explanation: string; }
interface C2paSignerIdentity { email: string | null; issuer: string | undefined; }
interface C2paSigner {
  commonName: string | undefined;
  organization: string | undefined;
  notBefore: string;
  notAfter: string;
  selfSigned: boolean;
  alg: string;
  identity?: C2paSignerIdentity;
}
interface C2paClaim {
  title: unknown;
  format: unknown;
  claimGenerator: unknown;
  generatorInfo: Record<string, string | number | boolean> | null;
  instanceId: unknown;
  manifestLabel: string;
  actions: Array<{ action: unknown; when: unknown; softwareAgent: unknown; digitalSourceType?: unknown; description?: unknown }>;
}
// A file's provenance flagged as AI/ML-generated: `generated` = pixels produced
// wholly by a trained model, `composite` = a human work with AI-generated parts
// mixed in. `sourceType` is the raw IPTC DigitalSourceType URI it was read from.
interface C2paAiOrigin {
  kind: 'generated' | 'composite';
  sourceType: string;
}
// One recorded provenance step — a C2PA action from any manifest in the chain.
// `generator` is the claim_generator(_info) of the manifest that RECORDED this
// step — the "who did it" the view renders as a software pill (softwareAgent, a
// per-action field many writers omit, takes precedence when present).
interface C2paHistoryStep { action: unknown; when: unknown; softwareAgent: unknown; digitalSourceType?: unknown; description?: unknown; generator?: unknown; }
interface C2paReport {
  found: boolean;
  state: 'valid' | 'invalid' | 'none';
  trusted: boolean;
  madeWithLolly: boolean;
  delivered: boolean;
  format: SniffFormat | null;
  checks: C2paCheck[];
  reason?: string;
  claim?: C2paClaim;
  // Scalar export-context keys (tool/surface/engine/os/date/dimensions…) plus an
  // optional nested `inputs` digest (id → short string) — the scalar inputs the
  // asset was rendered from, recorded by the writer's tools.lolly.export assertion.
  environment?: (Record<string, string | number | boolean> & { inputs?: Record<string, string> }) | null;
  author?: { name: string; email?: string };
  signer?: C2paSigner;
  aiGenerated?: C2paAiOrigin;
  // The full provenance chain — every manifest's actions (parent/ingredient →
  // active), flattened in store order with adjacent duplicates collapsed.
  history?: C2paHistoryStep[];
}

// IPTC DigitalSourceType slugs that denote AI/ML-generated pixels. A file is
// flagged AI-generated when any recorded action carries one of these — full-AI
// ("generated") outranks the mixed-in ("composite") case if both appear.
const AI_SOURCE_TYPES: Record<string, 'generated' | 'composite'> = {
  trainedAlgorithmicMedia: 'generated',
  compositeWithTrainedAlgorithmicMedia: 'composite',
};
const aiKind = (sourceType: unknown): 'generated' | 'composite' | undefined =>
  AI_SOURCE_TYPES[(typeof sourceType === 'string' ? sourceType : '').split('/').pop() ?? ''];

// Walk EVERY manifest in the store (active + all ingredient/parent manifests)
// and flatten their recorded actions in store order (oldest parent → active).
// AI provenance and the "created" step routinely live in a PARENT manifest — a
// chain that ends in a watermark + re-encode whose active manifest never records
// "created" at all — so reading only the active manifest (parseC2paStore) misses
// both the AI origin and the interesting creation steps. Every parse is guarded:
// a manifest we can't read is skipped, never fatal (this is a display nicety).
function collectActionChain(store: Uint8Array): C2paHistoryStep[] {
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

/**
 * Verify a file's Content Credentials entirely on-device. Sniffs the
 * container (pdf/png/jpeg/gif/svg/tiff/webp) from magic bytes.
 *
 * opts.trustAnchors — Uint8Array[] of pinned root-certificate DER. When given,
 * the claim signature's full x5chain is checked against each anchor
 * (issuer-name bytes + ECDSA P-256/SHA-256 over the tbsCertificate, directly
 * or through one CA:TRUE intermediate). Zero-options behaviour is unchanged.
 *
 * → {
 *     found, state: 'valid'|'invalid'|'none', trusted, reason?,
 *     format:  sniffed container ('png', 'pdf', …) or null,
 *     madeWithLolly: boolean — credential INTACT and records Lolly as generator,
 *     aiGenerated?: { kind: 'generated'|'composite', sourceType } — set when an
 *                action declares AI/ML-generated pixels (IPTC DigitalSourceType),
 *     history?: the full provenance chain — every manifest's actions flattened,
 *     claim?:  { title, format, claimGenerator, generatorInfo, instanceId, manifestLabel, actions },
 *     environment?: the `tools.lolly.export` assertion's export context,
 *     signer?: { commonName, organization, notBefore, notAfter, selfSigned, alg,
 *                identity? — { email, issuer } once the chain reaches a pinned anchor },
 *     checks:  [{ code, ok, explanation }],
 *   }
 *
 * `state` reflects integrity only: every check except the signingCredential
 * trust row must pass. `trusted` is the identity verdict: true only when the
 * chain reaches a pinned anchor AND the leaf is inside its validity window —
 * anchored-but-expired surfaces `signer.identity` but keeps trusted:false
 * (no timestamp authority yet, so the signing time cannot be proven). With no
 * anchors there is no trust list — a valid report means "this file is exactly
 * what the embedded credential signed", never "a known identity made this";
 * `madeWithLolly` is likewise an integrity-plus-claims statement, not an
 * identity proof.
 */
export async function verifyC2pa(bytes: Uint8Array, { trustAnchors }: { trustAnchors?: Uint8Array[] } = {}): Promise<C2paReport> {
  if (!(bytes instanceof Uint8Array)) throw new Error('verifyC2pa: bytes must be a Uint8Array');
  const checks: C2paCheck[] = [];
  const fail = (code: string, explanation: string): void => { checks.push({ code, ok: false, explanation }); };
  const pass = (code: string, explanation: string): void => { checks.push({ code, ok: true, explanation }); };
  const format = sniffFormat(bytes);
  const report: C2paReport = { found: false, state: 'none', trusted: false, madeWithLolly: false, delivered: false, format, checks };
  const pdfBytes = bytes; // the hard binding hashes the whole file, any container

  if (!format) {
    report.reason = 'unrecognised file format — Content Credentials are checked in pdf, png, jpg, gif, svg, tiff, webp, mp4 and webm files';
    return report;
  }

  let extracted: { manifest: Uint8Array } | null;
  try {
    extracted = EXTRACTORS[format]!(bytes);
  } catch (err) {
    const msg = (err as Error).message;
    report.reason = msg;
    if (/not a PDF/.test(msg)) return report;
    report.found = true;
    report.state = 'invalid';
    fail('credential.unreadable', msg);
    return report;
  }
  if (!extracted) {
    report.reason = 'no Content Credentials found';
    return report;
  }
  report.found = true;

  let parts: C2paStoreParts;
  let claim: Map<unknown, unknown>;
  try {
    parts = parseC2paStore(extracted.manifest);
    const decodedClaim = decodeCbor(parts.claimBytes);
    if (!(decodedClaim instanceof Map)) throw new Error('claim is not a CBOR map');
    claim = decodedClaim;
  } catch (err) {
    report.state = 'invalid';
    report.reason = `credential is malformed: ${(err as Error).message}`;
    fail('credential.unreadable', (err as Error).message);
    return report;
  }

  // v1 uses the 'c2pa.actions' assertion; v2 uses 'c2pa.actions.v2'. The action
  // maps share the same shape for the fields read here (action/when), except
  // softwareAgent is a bare string in v1 and a generator-info map in v2.
  const actionsAssertion = parts.assertions.find((a) => a.label === 'c2pa.actions' || a.label === 'c2pa.actions.v2');
  let actions: Array<{ action: unknown; when: unknown; softwareAgent: unknown; digitalSourceType?: unknown; description?: unknown }> = [];
  try {
    const decoded = actionsAssertion && (decodeCbor(actionsAssertion.content) as Map<unknown, unknown>).get('actions');
    if (Array.isArray(decoded)) {
      actions = decoded.map((a) => {
        const sa = a.get?.('softwareAgent');
        return {
          action: a.get?.('action'),
          when: a.get?.('when'),
          // v2 softwareAgent is a { name, version } map; surface its name.
          softwareAgent: sa instanceof Map ? sa.get('name') : sa,
          // IPTC provenance kind of this step (digitalCapture / digitalCreation /
          // trainedAlgorithmicMedia …) — the signal behind the AI-generated flag.
          digitalSourceType: a.get?.('digitalSourceType'),
          description: a.get?.('description'),
        };
      });
    }
  } catch { /* absent/opaque actions are a display nicety, not a check */ }

  const mapToObj = (m: unknown): Record<string, string | number | boolean> | null => {
    if (!(m instanceof Map)) return null;
    const o: Record<string, string | number | boolean> = {};
    for (const [k, v] of m) if (typeof k === 'string' && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) o[k] = v;
    return o;
  };
  // claim_generator_info is an array of generator maps in v1 (optional, read
  // its first entry) and a single generator map in v2 (required — the
  // free-text claim_generator string is gone in v2, so this is the sole
  // generator identity).
  const genInfo = claim.get('claim_generator_info');
  report.claim = {
    title: claim.get('dc:title'),
    format: claim.get('dc:format'),
    claimGenerator: claim.get('claim_generator'),
    generatorInfo: mapToObj(Array.isArray(genInfo) ? genInfo[0] : genInfo),
    instanceId: claim.get('instanceID'),
    manifestLabel: parts.manifestLabel,
    actions,
  };

  // The whole provenance chain across every manifest (the active manifest's own
  // `actions` above is just its last link) — used for the edit-history timeline
  // and to flag AI origin wherever in the chain it was declared.
  const chain = collectActionChain(extracted.manifest);
  if (chain.length) report.history = chain;

  // AI-generated provenance: scan the chain's digitalSourceType for the IPTC
  // "trained algorithmic media" codes. A single full-AI step wins over any number
  // of composite ones (a wholly-generated origin is the louder truth).
  for (const s of chain) {
    const kind = aiKind(s.digitalSourceType);
    if (kind && (!report.aiGenerated || kind === 'generated')) {
      report.aiGenerated = { kind, sourceType: s.digitalSourceType as string };
      if (kind === 'generated') break;
    }
  }

  // Export context recorded by the writer (tool, surface, browser engine, OS…)
  // — a custom assertion; its integrity is covered by the hashed-URI check.
  const exportAssertion = parts.assertions.find((a) => a.label === LOLLY_EXPORT_ASSERTION);
  if (exportAssertion) {
    try {
      const decoded = decodeCbor(exportAssertion.content);
      const env = mapToObj(decoded) as (Record<string, string | number | boolean> & { inputs?: Record<string, string> }) | null;
      if (env) {
        // The scalar keys come through mapToObj; the nested `inputs` map (the
        // scalar-input digest) is a CBOR Map it drops, so lift it separately —
        // string→string only, so a crafted assertion can't inject other shapes.
        const rawInputs = decoded instanceof Map ? decoded.get('inputs') : undefined;
        if (rawInputs instanceof Map) {
          const inputs: Record<string, string> = {};
          for (const [k, v] of rawInputs) if (typeof k === 'string' && typeof v === 'string') inputs[k] = v;
          if (Object.keys(inputs).length) env.inputs = inputs;
        }
        report.environment = env;
      }
    } catch { /* display nicety only */ }
  }

  // Authorship. v2 records it in the CAWG metadata assertion (`cawg.metadata`,
  // JSON-LD Dublin Core dc:creator — the strict `c2pa.metadata` assertion
  // forbids creator fields); v1 used the schema.org CreativeWork assertion.
  // Prefer the metadata assertion, fall back to CreativeWork. Integrity of both
  // is covered by the hashed-URI check above/below.
  const metaAssertion = parts.assertions.find((a) => a.label === 'cawg.metadata' || a.label === 'c2pa.metadata');
  if (metaAssertion) {
    try {
      const creator = JSON.parse(td.decode(metaAssertion.content))?.['dc:creator'];
      const name = Array.isArray(creator) ? creator[0] : creator;
      if (name) report.author = { name: String(name) };
    } catch { /* display nicety only */ }
  }
  const creativeWork = parts.assertions.find((a) => a.label === 'stds.schema-org.CreativeWork');
  if (!report.author && creativeWork) {
    try {
      const person = JSON.parse(td.decode(creativeWork.content))?.author?.[0];
      if (person?.name) report.author = { name: String(person.name), ...(person.email ? { email: String(person.email) } : {}) };
    } catch { /* display nicety only */ }
  }

  // 1. Hashed-URI references: each assertion the claim lists must hash to the
  //    superbox payload actually present in the store. A crafted claim can put
  //    ANYTHING in this array (non-map entries, refs without a hash) — each
  //    malformation is a failed check, never an escaped exception.
  // v1 lists every assertion reference in one `assertions` array. v2 splits
  // them into `created_assertions` (required — the hard binding + actions.v2,
  // authored by this claim generator) and optional `gathered_assertions`
  // (carried in from ingredients). Both are hashed-URI references, verified
  // identically, so the loop treats them as one flat list. Wiring BOTH here is
  // load-bearing: a v2 claim whose references were never read would leave every
  // assertion unverified behind only the hard binding.
  const refs = parts.claimVersion === 2
    ? [
        ...(Array.isArray(claim.get('created_assertions')) ? (claim.get('created_assertions') as unknown[]) : []),
        ...(Array.isArray(claim.get('gathered_assertions')) ? (claim.get('gathered_assertions') as unknown[]) : []),
      ]
    : claim.get('assertions');
  for (const ref of Array.isArray(refs) ? refs : []) {
    const url = ref instanceof Map ? ref.get('url') : null;
    const hash = ref instanceof Map ? ref.get('hash') : null;
    if (typeof url !== 'string' || !(hash instanceof Uint8Array)) {
      fail('assertion.hashedURI.mismatch', 'malformed assertion reference in the claim');
      continue;
    }
    const label = url.startsWith(HASHED_URI_PREFIX) ? url.slice(HASHED_URI_PREFIX.length) : null;
    const assertion = label && parts.assertions.find((a) => a.label === label);
    if (!assertion) {
      fail('assertion.missing', `claim references ${url} but the store has no such assertion`);
      continue;
    }
    if (hexOf(await sha256(assertion.payload)) === hexOf(hash)) {
      pass('assertion.hashedURI.match', `hashed uri matched: ${url}`);
    } else {
      fail('assertion.hashedURI.mismatch', `hash does not match assertion data: ${url}`);
    }
  }

  // 2. COSE claim signature (detached payload = the claim bytes).
  let signerAlg: string | null = null;
  // Carried out of this block to the identity verdict below: the trust decision
  // must see the claim-signature result and the anchor match together, AFTER
  // the hard binding has been checked. A leaf certificate is PUBLIC (it rides
  // in every credentialed file the signer publishes), so chaining it to the
  // pinned root proves only that the CA once bound that key to that email — NOT
  // that this key signed THIS content. Only `claimSigValid === true` proves the
  // latter, so trust/identity are gated on it, never on the chain alone.
  let claimSigValid: boolean | null = null;   // true only if the COSE signature verified
  let anchorMatch: ParsedCertificate | null = null;     // the pinned anchor the chain reached, or null
  let leafInsideValidity = false;
  let leafSanEmail: string | null = null;
  try {
    const cose = decodeCbor(parts.signatureBytes) as { tag?: unknown; value?: unknown } | null;
    if (cose?.tag !== 18) throw new Error('claim signature is not COSE_Sign1_Tagged');
    const [protBytes, unprotected, , sigRaw] = cose!.value as unknown[];
    const prot = decodeCbor(protBytes as Uint8Array) as Map<unknown, unknown>;
    const alg = COSE_ALGS[String(prot.get(1))];
    // Header 33 is the registered x5chain label; early C2PA files used the
    // text label "x5chain", in either the protected or unprotected bucket.
    const unprot = unprotected as Map<unknown, unknown> | null | undefined;
    const chain = prot.get(33) ?? prot.get('x5chain') ?? unprot?.get(33) ?? unprot?.get('x5chain');
    const chainDers: unknown[] = Array.isArray(chain) ? chain : [chain];
    const certDer = chainDers[0];
    if (!(certDer instanceof Uint8Array)) throw new Error('no x5chain certificate in signature headers');

    const cert = parseCertificate(certDer);
    signerAlg = alg?.name || `COSE alg ${String(prot.get(1))}`;
    report.signer = {
      commonName: cert.subject.commonName,
      organization: cert.subject.organization,
      notBefore: cert.notBefore.toISOString(),
      notAfter: cert.notAfter.toISOString(),
      selfSigned: cert.selfSigned,
      alg: signerAlg,
    };

    if (!alg) {
      fail('claimSignature.mismatch', `unsupported signing algorithm (${signerAlg}) — cannot verify on-device`);
    } else {
      const sigStructure = encodeCbor(['Signature1', protBytes, new Uint8Array(0), parts.claimBytes]);
      try {
        claimSigValid = await verifyCoseSignature(alg, cert.spki, sigRaw as Uint8Array, sigStructure);
      } catch {
        fail('claimSignature.mismatch', `${alg.name} signatures cannot be verified on this device`);
        claimSigValid = null;
      }
      if (claimSigValid === true) pass('claimSignature.validated', 'claim signature valid');
      else if (claimSigValid === false) fail('claimSignature.mismatch', 'claim signature is not valid');
    }

    const now = Date.now();
    leafInsideValidity = now >= cert.notBefore.getTime() && now <= cert.notAfter.getTime();
    if (leafInsideValidity) {
      pass('claimSignature.insideValidity', 'signing certificate within its validity window');
    } else {
      fail('signingCredential.expired', 'signing certificate expired (or not yet valid)');
    }

    // Does the chain reach a caller-pinned anchor? Record it — but the identity
    // and trusted verdict are NOT decided here: they also require the claim
    // signature to have verified and the hard binding (checked below) to match.
    // See the identity verdict after section 3.
    leafSanEmail = cert.sanEmails[0] ?? null;
    if (Array.isArray(trustAnchors) && trustAnchors.length) {
      anchorMatch = await chainsToAnchor(cert, chainDers, trustAnchors);
    }
  } catch (err) {
    fail('claimSignature.mismatch', `claim signature could not be verified: ${(err as Error).message}`);
  }

  // 3. Hard binding: sha256 of the file with the exclusion ranges omitted —
  //    or, for BMFF assets, the box-walking c2pa.hash.bmff.v2/v3 binding.
  const hashData = parts.assertions.find((a) => a.label === 'c2pa.hash.data');
  const bmffHash = parts.assertions.find((a) => /^c2pa\.hash\.bmff(\.v\d+)?$/.test(a.label));
  if (!hashData && bmffHash) {
    try {
      const hd = decodeCbor(bmffHash.content) as Map<unknown, unknown>;
      if ((hd.get('alg') || 'sha256') !== 'sha256') throw new Error(`unsupported hash alg ${String(hd.get('alg'))}`);
      if (hd.get('merkle')) throw new Error('fragmented (Merkle) BMFF bindings are not supported on this device');
      // v1 hashes the surviving boxes' bytes; v2/v3 prefix each with its
      // u64-BE file offset (verified against c2patool output). A future v4+
      // may hash differently — reporting honest "unchecked" beats a false
      // tamper accusation.
      const version = bmffHash.label === 'c2pa.hash.bmff' ? 1 : Number(bmffHash.label.slice('c2pa.hash.bmff.v'.length));
      if (version > 3) throw new Error(`BMFF hash version v${version} is newer than this device's verifier`);
      const exclusions = ((hd.get('exclusions') || []) as Array<Map<unknown, unknown>>).map((e) => ({
        xpath: e.get('xpath') as unknown,
        data: e.get('data') as unknown,
        length: e.get('length') as unknown,
        subset: e.get('subset') as unknown,
        version: e.get('version') as unknown,
        flags: e.get('flags') as unknown,
      }));
      for (const e of exclusions) {
        if (typeof e.xpath !== 'string' || !/^\/[a-zA-Z0-9 ]{4}$/.test(e.xpath) || e.subset != null || e.version != null || e.flags != null) {
          throw new Error('this BMFF exclusion form is not supported on this device');
        }
      }
      const excluded = (b: BmffBox): boolean => exclusions.some((e) =>
        e.xpath === `/${b.type}`
        && (e.length == null || e.length === b.size)
        && ((e.data || []) as Array<Map<unknown, unknown>>).every((d) => {
          const off = b.off + (d.get('offset') as number);
          const value = d.get('value');
          return value instanceof Uint8Array && off + value.length <= b.off + b.size
            && value.every((v, i) => bytes[off + i] === v);
        }));
      const spans: Uint8Array[] = [];
      for (const b of bmffTopBoxes(bytes)) {
        if (excluded(b)) continue;
        if (version >= 2) {
          const marker = new Uint8Array(8);
          for (let i = 7, n = b.off; i >= 0; i--) { marker[i] = n % 256; n = Math.floor(n / 256); }
          spans.push(marker);
        }
        spans.push(bytes.subarray(b.off, b.off + b.size));
      }
      if (hexOf(await sha256(concatBytes(spans))) === hexOf(hd.get('hash') as Uint8Array)) {
        pass('assertion.bmffHash.match', 'BMFF hash valid');
      } else {
        fail('assertion.bmffHash.mismatch', 'the file bytes do not match the credential — the file changed after signing');
      }
    } catch (err) {
      fail('assertion.bmffHash.mismatch', `hard binding could not be checked: ${(err as Error).message}`);
    }
  } else if (!hashData) {
    fail('assertion.dataHash.mismatch', 'no hard binding (c2pa.hash.data or c2pa.hash.bmff) in the manifest');
  } else {
    try {
      const hd = decodeCbor(hashData.content) as Map<unknown, unknown>;
      if ((hd.get('alg') || 'sha256') !== 'sha256') throw new Error(`unsupported hash alg ${String(hd.get('alg'))}`);
      const exclusions = ((hd.get('exclusions') || []) as Array<Map<unknown, unknown>>)
        .map((e) => ({ start: e.get('start') as number, length: e.get('length') as number }))
        .sort((a, b) => a.start - b.start);
      const spans: Uint8Array[] = [];
      let at = 0;
      for (const e of exclusions) {
        if (!(Number.isInteger(e.start) && Number.isInteger(e.length)) || e.start < at || e.start + e.length > pdfBytes.length) {
          throw new Error('exclusion ranges are out of order or out of range');
        }
        spans.push(pdfBytes.subarray(at, e.start));
        at = e.start + e.length;
      }
      spans.push(pdfBytes.subarray(at));
      if (hexOf(await sha256(concatBytes(spans))) === hexOf(hd.get('hash') as Uint8Array)) {
        pass('assertion.dataHash.match', 'data hash valid');
      } else {
        fail('assertion.dataHash.mismatch', 'the file bytes do not match the credential — the file changed after signing');
      }
    } catch (err) {
      fail('assertion.dataHash.mismatch', `hard binding could not be checked: ${(err as Error).message}`);
    }
  }

  // Verified identity is granted ONLY when all three hold together:
  //   (a) the leaf chains to a caller-pinned anchor (anchorMatch),
  //   (b) the COSE claim signature verified under that leaf's key
  //       (claimSigValid === true) — so this identity signed THIS claim, not
  //       merely that the CA once issued the (public) leaf, and
  //   (c) the credential is otherwise intact: every check passed except, at
  //       most, the cert's own validity window. An expired-but-authentic
  //       signature still proves WHO (identity surfaced) though not WHEN
  //       (trusted stays false); any OTHER failure — a bad claim signature, a
  //       hard-binding/hash mismatch (tampered bytes), a missing assertion —
  //       means this is not this identity's signed content, so no identity and
  //       no trust, even when the file carries a victim's public leaf cert.
  // This closes the public-leaf replay: an attacker can copy a victim's leaf
  // but cannot produce a claim signature that verifies under the victim's
  // (non-extractable) key, so claimSigValid is false and nothing is granted.
  if (anchorMatch && claimSigValid === true) {
    const otherFailure = checks.some((c) => !c.ok && c.code !== 'signingCredential.expired');
    if (!otherFailure) {
      report.signer!.identity = {
        email: leafSanEmail,
        issuer: anchorMatch.subject.commonName || anchorMatch.subject.organization,
      };
      report.trusted = leafInsideValidity;
    }
  }

  // Identity verdict row. Default: there is no trust list and on-device
  // credentials are ephemeral by design — reported with the standard code,
  // excluded from the state verdict. A chain verified to a caller-pinned
  // anchor (identity is only ever set on that path) upgrades the row.
  if (report.signer?.identity) {
    const who = report.signer.identity.email || report.signer.commonName;
    pass('signingCredential.trusted', report.trusted
      ? `signing certificate chains to a pinned CA root — verified identity: ${who}`
      : `signing certificate chains to a pinned CA root — verified identity: ${who} (certificate has since expired; signing time cannot be proven — no timestamp authority yet)`);
  } else {
    fail('signingCredential.untrusted', 'signing certificate untrusted — an ephemeral on-device key, not a CA-issued identity');
  }

  report.state = checks.every((c) => c.ok || c.code === 'signingCredential.untrusted') ? 'valid' : 'invalid';
  // "Genuinely made with Lolly" = the credential is intact (signature + hashes
  // + binding all verify), it records a Lolly CREATION (a c2pa.created action —
  // not merely a delivery), AND it names Lolly as the generator. Requiring the
  // created action keeps the claim honest: a delivered/distributed asset can
  // name Lolly without ever reading as authored by it.
  const acts = report.claim!.actions || [];
  const created = acts.some((a) => a.action === 'c2pa.created');
  const names = [report.claim!.claimGenerator, report.claim!.generatorInfo?.name].filter(Boolean).join(' ');
  report.madeWithLolly = report.state === 'valid' && created && /\blolly\b/i.test(names);
  // "Delivered" = an intact credential over an EXISTING asset the signer
  // distributed but did not create (a c2pa.published action, no creation).
  // Drives the "Delivered by Lolly" / authentic-official-asset verdict.
  report.delivered = report.state === 'valid' && !created && acts.some((a) => a.action === 'c2pa.published');
  return report;
}

/** @deprecated alias — verifyC2pa sniffs PDFs (and every other container). */
export const verifyC2paPdf = verifyC2pa;
