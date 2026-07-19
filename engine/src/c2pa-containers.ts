// SPDX-License-Identifier: MPL-2.0
/**
 * C2PA container placement — the per-format byte-splicing side of the writer:
 * classic-xref PDF incremental update, the png/jpeg/gif/svg/tiff/webp embedders,
 * ISO BMFF (mp4) with its own c2pa.hash.bmff.v2 binding, and the WebM/Matroska
 * attachment path, plus embedC2pa/embedC2paInPdf — the public entry points that
 * dispatch to whichever placer a format needs. Split out of c2pa.ts so the
 * manifest/claim BUILDER (CBOR, JUMBF, COSE_Sign1, buildC2paManifest) is
 * reviewable on its own, separate from container-specific byte grammar.
 * This file imports buildC2paManifest/urnUuid/BMFF_HASH_LABEL (+ shared types)
 * from c2pa.ts; c2pa.ts re-exports embedC2pa/embedC2paInPdf/etc. back so every
 * existing import path is unchanged. ONE genuine runtime cycle: c2pa.ts's
 * buildC2paManifest needs bmffHashExclusions (exported here) for the BMFF
 * assertion's exclusion-set shape. Safe — see c2pa.ts's import-site comment.
 */

import {
  walkBoxes, box as bmffBox,
  EBML_ID, SEGMENT_ID, SEEKHEAD, CUES,
  readVint, writeVint, ebml, idAt, scanSegmentChildren, seekHeadEntrySplice, beUint,
} from './video-meta.ts';
import { generateSigner } from './x509.ts';
import { concatBytes, sha256, bytesToBin } from './bytes.ts';
import { buildC2paManifest, urnUuid, BMFF_HASH_LABEL } from './c2pa.ts';
import type { Signer, Exclusion, EmbedOptions, PlaceResult } from './c2pa.ts';

const te = new TextEncoder();

// ─── PDF incremental update ───────────────────────────────────────────────────

// The byte-transparent binary string ↔ bytes pair: bytesToBin is the shared
// one (bytes.ts); the inverse stays local.
function binToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

const PDF_WS = ' \t\r\n\f\0';
const PDF_DELIM = ' \t\r\n\f\0()<>[]{}/%';

function skipWs(s: string, i: number): number {
  while (i < s.length && PDF_WS.includes(s[i]!)) i++;
  return i;
}

function literalStringEnd(s: string, i: number): number {
  let p = 1;
  i++;
  while (i < s.length && p > 0) {
    if (s[i] === '\\') i += 2;
    else {
      if (s[i] === '(') p++;
      else if (s[i] === ')') p--;
      i++;
    }
  }
  if (p !== 0) throw new Error('C2PA embed: unterminated PDF string');
  return i;
}

// End (exclusive) of a composite value starting at i ('<<' or '['). Skips
// literal strings (escapes + nested parens), hex strings and comments.
function compositeEnd(s: string, i: number): number {
  let depth = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '(') i = literalStringEnd(s, i);
    else if (c === '<' && s[i + 1] === '<') { depth++; i += 2; }
    else if (c === '>' && s[i + 1] === '>') { depth--; i += 2; if (depth === 0) return i; }
    else if (c === '<') { const j = s.indexOf('>', i); if (j < 0) break; i = j + 1; }
    else if (c === '[') { depth++; i++; }
    else if (c === ']') { depth--; i++; if (depth === 0) return i; }
    else if (c === '%') { while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++; }
    else i++;
  }
  throw new Error('C2PA embed: unbalanced PDF value');
}

// End (exclusive) of any PDF value starting at i (whitespace already skipped).
function valueEnd(s: string, i: number): number {
  const c = s[i];
  if ((c === '<' && s[i + 1] === '<') || c === '[') return compositeEnd(s, i);
  if (c === '<') {
    const j = s.indexOf('>', i);
    if (j < 0) throw new Error('C2PA embed: unterminated hex string');
    return j + 1;
  }
  if (c === '(') return literalStringEnd(s, i);
  if (c === '/') {
    let j = i + 1;
    while (j < s.length && !PDF_DELIM.includes(s[j]!)) j++;
    return j;
  }
  const ref = /^\d+\s+\d+\s+R(?![A-Za-z0-9])/.exec(s.slice(i, i + 32));
  if (ref) return i + ref[0]!.length;
  const tok = /^[^\s()<>[\]{}/%]+/.exec(s.slice(i, i + 128));
  if (tok) return i + tok[0]!.length;
  throw new Error('C2PA embed: cannot parse PDF value');
}

interface DictEntry {
  key: string;
  valStart: number;
  valEnd: number;
}

// Top-level key/value spans of an inline dict source ('<<…>>', offsets into src).
function dictEntries(src: string): DictEntry[] {
  const entries: DictEntry[] = [];
  let i = skipWs(src, 2);
  while (i < src.length) {
    if (src[i] === '>' && src[i + 1] === '>') break;
    if (src[i] !== '/') throw new Error('C2PA embed: malformed PDF dictionary');
    let j = i + 1;
    while (j < src.length && !PDF_DELIM.includes(src[j]!)) j++;
    const key = src.slice(i + 1, j);
    const valStart = skipWs(src, j);
    const valEnd = valueEnd(src, valStart);
    entries.push({ key, valStart, valEnd });
    i = skipWs(src, valEnd);
  }
  return entries;
}

interface XrefEntry {
  num: number;
  offset: number;
  gen: number;
  type: string;
}

interface XrefSection {
  entries: XrefEntry[];
  trailer: string;
  prev: number | null;
}

// One classic xref section at `off`: entries + raw trailer dict + /Prev.
// Cross-reference *streams* (PDF 1.5+) start with "N G obj" instead — those
// get a distinct error the shell maps to "cannot attach".
function parseXrefSection(bin: string, off: number): XrefSection {
  let i = skipWs(bin, off);
  if (!bin.startsWith('xref', i)) {
    if (/^\d+\s+\d+\s+obj\b/.test(bin.slice(i, i + 32))) {
      throw new Error('C2PA embed: PDF uses a cross-reference stream (PDF 1.5+); cannot attach');
    }
    throw new Error('C2PA embed: startxref does not point at a cross-reference table');
  }
  i = skipWs(bin, i + 4);
  const entries: XrefEntry[] = [];
  while (!bin.startsWith('trailer', i)) {
    const head = /^(\d+)[ \t]+(\d+)/.exec(bin.slice(i, i + 40));
    if (!head) throw new Error('C2PA embed: malformed cross-reference subsection');
    const start = +head[1]!;
    const count = +head[2]!;
    i = skipWs(bin, i + head[0]!.length);
    for (let k = 0; k < count; k++) {
      const e = /^(\d{10}) (\d{5}) ([nf])/.exec(bin.slice(i, i + 20));
      if (!e) throw new Error('C2PA embed: malformed cross-reference entry');
      entries.push({ num: start + k, offset: +e[1]!, gen: +e[2]!, type: e[3]! });
      i = skipWs(bin, i + 18);
    }
  }
  i = skipWs(bin, i + 7);
  if (!(bin[i] === '<' && bin[i + 1] === '<')) throw new Error('C2PA embed: malformed trailer');
  const trailer = bin.slice(i, compositeEnd(bin, i));
  const prev = /\/Prev\s+(\d+)/.exec(trailer);
  return { entries, trailer, prev: prev ? +prev[1]! : null };
}

interface PdfRoot {
  num: number;
  gen: number;
}

interface PdfInfo {
  startxref: number;
  entries: Map<number, XrefEntry>;
  root: PdfRoot;
  maxNum: number;
  infoRaw: string | null;
  idRaw: string | null;
}

function parsePdf(bin: string): PdfInfo {
  if (!bin.startsWith('%PDF-')) throw new Error('C2PA embed: not a PDF');
  const sxAt = bin.lastIndexOf('startxref');
  const sx = sxAt < 0 ? null : /^startxref\s+(\d+)/.exec(bin.slice(sxAt, sxAt + 40));
  if (!sx) throw new Error('C2PA embed: missing startxref');
  const startxref = +sx[1]!;
  const entries = new Map<number, XrefEntry>(); // first seen wins — the chain walks newest → oldest
  const trailers: string[] = [];
  const seen = new Set<number>();
  for (let off: number | null = startxref; off != null && !seen.has(off); ) {
    seen.add(off);
    const sec = parseXrefSection(bin, off);
    for (const e of sec.entries) if (!entries.has(e.num)) entries.set(e.num, e);
    trailers.push(sec.trailer);
    off = sec.prev;
  }
  let root: PdfRoot | null = null;
  for (const t of trailers) {
    const m = /\/Root\s+(\d+)\s+(\d+)\s+R/.exec(t);
    if (m) { root = { num: +m[1]!, gen: +m[2]! }; break; }
  }
  if (!root) throw new Error('C2PA embed: trailer has no /Root');
  const sizeM = /\/Size\s+(\d+)/.exec(trailers[0]!);
  let maxNum = sizeM ? +sizeM[1]! - 1 : 0;
  for (const n of entries.keys()) if (n > maxNum) maxNum = n;
  const infoM = /\/Info\s+\d+\s+\d+\s+R/.exec(trailers[0]!);
  const idM = /\/ID\s*\[[^\]]*\]/.exec(trailers[0]!);
  return { startxref, entries, root, maxNum, infoRaw: infoM ? infoM[0] : null, idRaw: idM ? idM[0] : null };
}

// The Catalog dict source, via the xref entry for /Root (raw scan fallback
// for slightly-off offsets — some writers pad or shift by an EOL).
function catalogSource(bin: string, info: PdfInfo): string {
  const { num, gen } = info.root;
  const headRe = new RegExp(`^${num}\\s+${gen}\\s+obj\\b`);
  let at = -1;
  const entry = info.entries.get(num);
  if (entry && entry.type === 'n') {
    const i = skipWs(bin, entry.offset);
    if (headRe.test(bin.slice(i, i + 32))) at = i;
  }
  if (at < 0) {
    const re = new RegExp(`(?:^|[^0-9])(${num}\\s+${gen}\\s+obj)\\b`, 'g');
    for (let m; (m = re.exec(bin)); ) at = m.index + m[0]!.length - m[1]!.length; // last = newest revision
  }
  if (at < 0) throw new Error('C2PA embed: cannot locate the PDF Catalog object');
  const objM = /^\d+\s+\d+\s+obj/.exec(bin.slice(at, at + 32));
  const i = skipWs(bin, at + objM![0]!.length);
  if (!(bin[i] === '<' && bin[i + 1] === '<')) throw new Error('C2PA embed: Catalog object is not a dictionary');
  const src = bin.slice(i, compositeEnd(bin, i));
  if (!/\/Type\s*\/Catalog\b/.test(src)) throw new Error('C2PA embed: /Root object is not a /Catalog');
  return src;
}

// Clone the Catalog dict source with /AF + /Names→/EmbeddedFiles attached.
// Inline values are merged in place; an indirect /Names, indirect /AF or a
// pre-existing /EmbeddedFiles tree is out of scope → clear "cannot attach".
function catalogWithAttachment(src: string, fsRef: string): string {
  const efEntry = `/EmbeddedFiles << /Names [(manifest.c2pa) ${fsRef}] >>`;
  const entries = dictEntries(src);
  const find = (k: string) => entries.find((e) => e.key === k);
  const edits: { at: number; text: string }[] = [];
  const names = find('Names');
  if (names) {
    const val = src.slice(names.valStart, names.valEnd);
    if (!val.startsWith('<<')) throw new Error('C2PA embed: catalog /Names is an indirect object; cannot attach');
    if (dictEntries(val).some((e) => e.key === 'EmbeddedFiles')) {
      throw new Error('C2PA embed: PDF already has an /EmbeddedFiles name tree; cannot attach');
    }
    edits.push({ at: names.valEnd - 2, text: ` ${efEntry} ` });
  }
  const af = find('AF');
  if (af) {
    if (src[af.valStart] !== '[') throw new Error('C2PA embed: catalog /AF is not an inline array; cannot attach');
    edits.push({ at: af.valEnd - 1, text: ` ${fsRef}` });
  }
  let tailAdd = '';
  if (!af) tailAdd += ` /AF [${fsRef}]`;
  if (!names) tailAdd += ` /Names << ${efEntry} >>`;
  if (tailAdd) edits.push({ at: src.length - 2, text: tailAdd + ' ' });
  let out = src;
  for (const e of edits.sort((a, b) => b.at - a.at)) out = out.slice(0, e.at) + e.text + out.slice(e.at);
  return out;
}

// "nnnnnnnnnn ggggg n\r\n" — exactly the 20-byte classic xref entry.
const xrefEntryLine = (offset: number, gen: number): string => `${String(offset).padStart(10, '0')} ${String(gen).padStart(5, '0')} n\r\n`;

/**
 * Attach a C2PA manifest to a PDF as an incremental update: the original
 * bytes are kept as a byte-identical prefix (asserted), then an updated
 * Catalog (same object number + generation, /AF + /Names→/EmbeddedFiles), a
 * /Filespec with /AFRelationship /C2PA_Manifest, the manifest as an
 * /EmbeddedFile stream, a classic xref section and a trailer whose /Prev
 * points at the original startxref. Requires a classic cross-reference
 * table (jsPDF-style); cross-reference streams throw a clear Error the
 * shell treats as "cannot attach".
 */
export async function embedC2paInPdf(pdfBytes: Uint8Array, { title, claimGenerator, generatorInfo, environment, author, authorship, rights, actions, ingredients, dates = {}, signer }: EmbedOptions = {}): Promise<Uint8Array> {
  if (!(pdfBytes instanceof Uint8Array)) throw new Error('C2PA embed: pdfBytes must be a Uint8Array');
  const bin = bytesToBin(pdfBytes);
  const info = parsePdf(bin);
  const fsNum = info.maxNum + 1; // FileSpec dict
  const efNum = info.maxNum + 2; // EmbeddedFile stream
  const fsRef = `${fsNum} 0 R`;
  const catalog = catalogWithAttachment(catalogSource(bin, info), fsRef);

  const sep = bin.endsWith('\n') || bin.endsWith('\r') ? '' : '\n';
  const catObj = `${info.root.num} ${info.root.gen} obj\n${catalog}\nendobj\n`;
  const fsObj = `${fsNum} 0 obj\n<< /Type /Filespec /F (manifest.c2pa) /UF (manifest.c2pa) /AFRelationship /C2PA_Manifest /EF << /F ${efNum} 0 R >> >>\nendobj\n`;
  const afterStream = '\nendstream\nendobj\n';
  const trailerExtra = (info.infoRaw ? ' ' + info.infoRaw : '') + (info.idRaw ? ' ' + info.idRaw : '');

  // Full incremental-update layout for a manifest of exactly `manifestLen`
  // bytes. Only /Length's digit count and the startxref value vary with the
  // manifest length; xref entry offsets are fixed-width by format.
  const layoutFor = (manifestLen: number): { head: string; tail: string; manifestOffset: number } => {
    const catOff = pdfBytes.length + sep.length;
    const fsOff = catOff + catObj.length;
    const efOff = fsOff + fsObj.length;
    const head = sep + catObj + fsObj +
      `${efNum} 0 obj\n<< /Type /EmbeddedFile /Subtype /application#2Fc2pa /Length ${manifestLen} >>\nstream\n`;
    const manifestOffset = pdfBytes.length + head.length;
    const xrefOff = manifestOffset + manifestLen + afterStream.length;
    const tail = afterStream +
      'xref\n' +
      `${info.root.num} 1\n` + xrefEntryLine(catOff, info.root.gen) +
      `${fsNum} 2\n` + xrefEntryLine(fsOff, 0) + xrefEntryLine(efOff, 0) +
      `trailer\n<< /Size ${efNum + 1} /Root ${info.root.num} ${info.root.gen} R /Prev ${info.startxref}${trailerExtra} >>\n` +
      `startxref\n${xrefOff}\n%%EOF\n`;
    return { head, tail, manifestOffset };
  };

  // Signer, manifest label and instanceID are held constant across passes so
  // the manifest length is deterministic given input lengths. An external
  // signer's chain bytes are captured once so every pass signs the identical
  // protected header (byte-identical x5chain across builds).
  const sig: Signer = signer ?? (await generateSigner(dates));
  const internals = {
    signer: { ...sig, sign: sig.sign && sig.sign.bind(sig), chain: sig.chain ?? [sig.certDer!] },
    manifestLabel: urnUuid(),
    instanceId: urnUuid(),
  };
  const pad = new Uint8Array(8);
  const dummyHash = new Uint8Array(32);
  const build = (hash: Uint8Array, exclusions: Exclusion[], padBytes: Uint8Array): Promise<Uint8Array> => buildC2paManifest({
    title, claimGenerator, generatorInfo, environment, author, authorship, rights, actions, ingredients, dates, format: 'application/pdf',
    assetHash: { exclusions, hash, pad: padBytes },
    ...internals,
  });

  // Pass 1: freeze the layout. Manifest length depends on the layout only
  // through the CBOR widths of exclusion start/length, so iterate to a fixed
  // point (converges in one round unless a width boundary is crossed).
  let manifestLen = (await build(dummyHash, [{ start: pdfBytes.length + 512, length: 4096 }], pad)).length;
  let layout: { head: string; tail: string; manifestOffset: number } | null = null;
  let placeholder: Uint8Array | null = null;
  for (let round = 0; round < 8 && !placeholder; round++) {
    const l = layoutFor(manifestLen);
    const m = await build(dummyHash, [{ start: l.manifestOffset, length: manifestLen }], pad);
    if (m.length === manifestLen) { layout = l; placeholder = m; }
    else manifestLen = m.length;
  }
  if (!placeholder) throw new Error('C2PA embed: manifest layout did not converge');

  const out = concatBytes([pdfBytes, binToBytes(layout!.head), placeholder, binToBytes(layout!.tail)]);
  const exclusions = [{ start: layout!.manifestOffset, length: manifestLen }];
  // Hard binding: sha256 of the final file with the manifest bytes OMITTED
  // (C2PA exclusions skip the range from the hash input; nothing is zeroed).
  const digest = await sha256(concatBytes([
    out.subarray(0, layout!.manifestOffset),
    out.subarray(layout!.manifestOffset + manifestLen),
  ]));

  // Pass 2: same layout, real hash. Only fixed-width fields changed, so the
  // length must match; `pad` absorbs any residual drift as a safety net.
  let manifest = await build(digest, exclusions, pad);
  if (manifest.length !== manifestLen) {
    const padLen = pad.length + (manifestLen - manifest.length);
    if (padLen < 0 || padLen >= 24) throw new Error('C2PA embed: manifest length drifted beyond pad range');
    manifest = await build(digest, exclusions, new Uint8Array(padLen));
    if (manifest.length !== manifestLen) throw new Error('C2PA embed: manifest length is not deterministic');
  }
  out.set(manifest, layout!.manifestOffset);

  // The incremental-update contract: original bytes are a byte-identical prefix.
  for (let i = 0; i < pdfBytes.length; i++) {
    if (out[i] !== pdfBytes[i]) throw new Error('C2PA embed: original PDF bytes were modified');
  }
  return out;
}

// ─── container embedders (png/jpeg/gif/svg/tiff/webp) ────────────────────────
//
// Each placer is a pure function place(container, manifest) → { out, exclusions }
// that splices a manifest of ANY length into the container. The shared driver
// runs the same two-pass hard-binding dance as the PDF path: place a
// placeholder of the final byte length, hash the result with the exclusion
// ranges OMITTED, rebuild the manifest with the real digest, place again.
// That works because every placer's output outside its exclusion ranges
// depends only on the manifest LENGTH, never its content (asserted below by
// re-hashing the final output). The recipes byte-match c2pa-rs's asset
// handlers (png_io/jpeg_io/gif_io/svg_io/tiff_io/riff_io) — the validator
// behind c2patool and verify.contentauthenticity.org — including each
// format's exact exclusion ranges.

const asciiBytes = (s: string): Uint8Array => te.encode(s);

function u32be(n: number): Uint8Array {
  return Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
}
function u32le(n: number): Uint8Array {
  return Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
}
function u16be(n: number): Uint8Array {
  return Uint8Array.of((n >>> 8) & 0xff, n & 0xff);
}

// Standard PNG CRC-32 (reflected 0xEDB88320, init/xorout 0xFFFFFFFF).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(...parts: Uint8Array[]): number {
  let c = 0xffffffff;
  for (const p of parts) for (let i = 0; i < p.length; i++) c = CRC_TABLE[(c ^ p[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const PNG_SIG = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

// PNG: one `caBX` chunk immediately after IHDR; the exclusion covers the WHOLE
// chunk (length + type + data + CRC = len+12). Any pre-existing caBX is
// spliced out (two would make the file unreadable to c2pa-rs).
function placePng(png: Uint8Array, manifest: Uint8Array): PlaceResult {
  for (let i = 0; i < 8; i++) if (png[i] !== PNG_SIG[i]) throw new Error('C2PA embed: not a PNG');
  const dv = new DataView(png.buffer, png.byteOffset);
  let ihdrEnd = -1;
  const drop: { start: number; end: number }[] = []; // existing caBX ranges
  for (let i = 8; i + 8 <= png.length; ) {
    const len = dv.getUint32(i);
    const type = String.fromCharCode(png[i + 4]!, png[i + 5]!, png[i + 6]!, png[i + 7]!);
    const end = i + len + 12;
    if (end > png.length) throw new Error('C2PA embed: malformed PNG chunk');
    if (type === 'IHDR') ihdrEnd = end;
    if (type === 'caBX') drop.push({ start: i, end });
    if (type === 'IEND') break;
    i = end;
  }
  if (ihdrEnd < 0) throw new Error('C2PA embed: PNG has no IHDR');
  const chunk = concatBytes([u32be(manifest.length), asciiBytes('caBX'), manifest, u32be(crc32(asciiBytes('caBX'), manifest))]);
  const parts: Uint8Array[] = [];
  let insertAt = ihdrEnd;
  for (const d of drop) if (d.end <= ihdrEnd) insertAt -= d.end - d.start;
  let at = 0;
  for (const d of drop) { parts.push(png.subarray(at, d.start)); at = d.end; }
  parts.push(png.subarray(at));
  const cleaned = drop.length ? concatBytes(parts) : png;
  const out = concatBytes([cleaned.subarray(0, insertAt), chunk, cleaned.subarray(insertAt)]);
  return { out, exclusions: [{ start: insertAt, length: chunk.length }] };
}

// JPEG: APP11 (FF EB) JUMBF segments — CI "JP", En 0x0211, Z = u32BE 1-based;
// the manifest is chunked at 64000 bytes and continuation segments repeat the
// store's first 8 bytes (superbox LBox+TBox) after the Z field, exactly as
// jpeg_io.rs writes and its reader strips. Placed after the LAST APP0 (or
// right after SOI); the exclusion is one contiguous range over all segments.
const JPEG_CHUNK = 64000;
function placeJpeg(jpeg: Uint8Array, manifest: Uint8Array): PlaceResult {
  if (!(jpeg[0] === 0xff && jpeg[1] === 0xd8)) throw new Error('C2PA embed: not a JPEG');
  // Walk marker segments up to SOS (FF DA) — entropy data follows, nothing to
  // relocate past that point.
  let insertAt = 2;
  const drop: { start: number; end: number }[] = [];
  let dropEn = -1;
  for (let i = 2; i + 4 <= jpeg.length; ) {
    if (jpeg[i] !== 0xff) break;
    const marker = jpeg[i + 1]!;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; } // standalone
    const le = (jpeg[i + 2]! << 8) | jpeg[i + 3]!;
    const end = i + 2 + le;
    if (end > jpeg.length) throw new Error('C2PA embed: malformed JPEG segment');
    if (marker === 0xe0) insertAt = end; // after the LAST APP0
    if (marker === 0xeb && le >= 18) {
      const c = jpeg.subarray(i + 4, end); // contents after Le
      const en = (c[2]! << 8) | c[3]!;
      const isStart = c.length > 28 &&
        c[24] === 0x63 && c[25] === 0x32 && c[26] === 0x70 && c[27] === 0x61; // 'c2pa'
      if (isStart) { drop.push({ start: i, end }); dropEn = en; }
      else if (en === dropEn && drop.length) drop.push({ start: i, end });
    }
    if (marker === 0xda) break; // SOS
    i = end;
  }
  const segs: Uint8Array[] = [];
  const head8 = manifest.subarray(0, 8); // LBox+TBox duplicated on continuations
  let z = 1;
  for (let o = 0; o < manifest.length; o += JPEG_CHUNK, z++) {
    const chunk = manifest.subarray(o, Math.min(o + JPEG_CHUNK, manifest.length));
    const body = z === 1
      ? concatBytes([asciiBytes('JP'), Uint8Array.of(0x02, 0x11), u32be(z), chunk])
      : concatBytes([asciiBytes('JP'), Uint8Array.of(0x02, 0x11), u32be(z), head8, chunk]);
    segs.push(concatBytes([Uint8Array.of(0xff, 0xeb), u16be(body.length + 2), body]));
  }
  const block = concatBytes(segs);
  let shift = 0;
  for (const d of drop) if (d.end <= insertAt) shift += d.end - d.start;
  const parts: Uint8Array[] = [];
  let at = 0;
  for (const d of drop) { parts.push(jpeg.subarray(at, d.start)); at = d.end; }
  parts.push(jpeg.subarray(at));
  const cleaned = drop.length ? concatBytes(parts) : jpeg;
  const pos = insertAt - shift;
  const out = concatBytes([cleaned.subarray(0, pos), block, cleaned.subarray(pos)]);
  return { out, exclusions: [{ start: pos, length: block.length }] };
}

// GIF: one Application Extension (21 FF 0B "C2PA_GIF" 01 00 00) holding the
// manifest as ≤255-byte sub-blocks + 00 terminator, inserted right after the
// preamble (header + LSD + optional GCT) — c2pa-rs stops scanning at the first
// Image Descriptor. Inserting an extension forces the version byte to '9'.
function placeGif(gif: Uint8Array, manifest: Uint8Array): PlaceResult {
  const sig = String.fromCharCode(...gif.subarray(0, 6));
  if (sig !== 'GIF87a' && sig !== 'GIF89a') throw new Error('C2PA embed: not a GIF');
  const packed = gif[10]!;
  let pre = 13; // header(6) + LSD(7)
  if (packed & 0x80) pre += 3 * (1 << ((packed & 0x07) + 1)); // global color table
  // Drop an existing C2PA_GIF app extension (scan blocks up to first image).
  // Every gif[j] read is bounds-checked BEFORE use: an out-of-range read is
  // undefined and NaN-poisons j into an unbreakable infinite loop on a
  // truncated file (a hang escapes the caller's try/catch, unlike a throw).
  let drop: { start: number; end: number } | null = null;
  for (let i = pre; i < gif.length && !drop; ) {
    const b = gif[i];
    if (b === 0x2c || b === 0x3b) break; // image descriptor / trailer
    if (b !== 0x21) throw new Error('C2PA embed: malformed GIF block');
    const label = gif[i + 1];
    let j = i + 2;
    if (j >= gif.length) throw new Error('C2PA embed: truncated GIF block');
    if (label === 0xff || label === 0x01 || label === 0xf9) j += 1 + gif[j]!; // sized header block
    // walk data sub-blocks
    while (j < gif.length && gif[j] !== 0x00) j += 1 + gif[j]!;
    if (j >= gif.length) throw new Error('C2PA embed: truncated GIF sub-blocks');
    j += 1;
    if (label === 0xff && String.fromCharCode(...gif.subarray(i + 3, i + 11)) === 'C2PA_GIF'
        && gif[i + 11] === 0x01 && gif[i + 12] === 0x00 && gif[i + 13] === 0x00) {
      drop = { start: i, end: j };
    }
    i = j;
  }
  const sub: Uint8Array[] = [];
  for (let o = 0; o < manifest.length; o += 255) {
    const chunk = manifest.subarray(o, Math.min(o + 255, manifest.length));
    sub.push(Uint8Array.of(chunk.length), chunk);
  }
  const block = concatBytes([
    Uint8Array.of(0x21, 0xff, 0x0b), asciiBytes('C2PA_GIF'), Uint8Array.of(0x01, 0x00, 0x00),
    ...sub, Uint8Array.of(0x00),
  ]);
  const cleaned = drop ? concatBytes([gif.subarray(0, drop.start), gif.subarray(drop.end)]) : gif;
  const out = concatBytes([cleaned.subarray(0, pre), block, cleaned.subarray(pre)]);
  out[4] = 0x39; // '9' — extensions require GIF89a
  return { out, exclusions: [{ start: pre, length: block.length }] };
}

// SVG: the manifest is standard base64 (with padding, one unbroken run) as the
// text of <c2pa:manifest> inside a direct <metadata> child of the root <svg>,
// with xmlns:c2pa declared on the root. Only the base64 TEXT is excluded from
// the hard binding — the tags around it are hashed, and the hash is over raw
// bytes (no XML canonicalisation), so placement is byte-splicing, not DOM work.
// Scanning is byte-wise over ASCII structural characters (UTF-8 safe).
const C2PA_XMLNS = ' xmlns:c2pa="http://c2pa.org/manifest"';
function placeSvg(svg: Uint8Array, manifest: Uint8Array): PlaceResult {
  const bin = bytesToBin(svg);
  // Root <svg …> open tag (quote-aware scan for its closing '>').
  const open = /<svg(?=[\s>])/.exec(bin);
  if (!open) throw new Error('C2PA embed: not an SVG (no <svg> root)');
  let i = open.index + 4;
  let q: string | null = null;
  for (; i < bin.length; i++) {
    const ch = bin[i];
    if (q) { if (ch === q) q = null; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === '>') break;
  }
  if (i >= bin.length) throw new Error('C2PA embed: unterminated <svg> tag');
  if (bin[i - 1] === '/') throw new Error('C2PA embed: self-closing <svg/> cannot hold a manifest');
  const tagSrc = bin.slice(open.index, i);
  let doc = bin;
  let rootEnd = i + 1; // just past '>'
  if (!tagSrc.includes('xmlns:c2pa')) {
    doc = bin.slice(0, i) + C2PA_XMLNS + bin.slice(i);
    rootEnd += C2PA_XMLNS.length;
  }
  // Replace an existing manifest element's text, else reuse the first direct
  // <metadata>, else create one right after the root open tag.
  // base64 with standard alphabet + padding, single line
  const b64 = btoa(bytesToBin(manifest));
  const existing = /<c2pa:manifest[^>]*>/.exec(doc);
  let head: string, tail: string, b64Start: number;
  if (existing) {
    const close = doc.indexOf('</c2pa:manifest>', existing.index);
    if (close < 0) throw new Error('C2PA embed: unterminated c2pa:manifest element');
    head = doc.slice(0, existing.index + existing[0]!.length);
    tail = doc.slice(close);
    b64Start = head.length;
  } else {
    const meta = /<metadata(?=[\s>])[^>]*>/.exec(doc);
    if (meta && doc[meta.index + meta[0]!.length - 2] !== '/') {
      head = doc.slice(0, meta.index + meta[0]!.length) + '<c2pa:manifest>';
      tail = '</c2pa:manifest>' + doc.slice(meta.index + meta[0]!.length);
    } else {
      head = doc.slice(0, rootEnd) + '<metadata><c2pa:manifest>';
      tail = '</c2pa:manifest></metadata>' + doc.slice(rootEnd);
    }
    b64Start = head.length;
  }
  const out = binToBytes(head + b64 + tail);
  return { out, exclusions: [{ start: b64Start, length: b64.length }] };
}

// TIFF: manifest bytes verbatim as tag 0xCD41 (type UNDEFINED) in a dedicated
// single-entry IFD appended as the LAST IFD of the chain; the previous last
// IFD's next-IFD pointer is patched to it. Exclusions match c2pa-rs exactly:
// the value bytes AND the entry's 4-byte count field (so the manifest can be
// re-stamped without moving). Classic TIFF only, either endianness.
function placeTiff(tiff: Uint8Array, manifest: Uint8Array): PlaceResult {
  const le = tiff[0] === 0x49 && tiff[1] === 0x49;
  const be = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!le && !be) throw new Error('C2PA embed: not a TIFF');
  const dv = new DataView(tiff.buffer, tiff.byteOffset);
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);
  if (u16(2) !== 42) throw new Error('C2PA embed: BigTIFF is not supported');
  // Find the last IFD in the chain (cycle-guarded).
  const seen = new Set<number>();
  let ifd = u32(4);
  if (!ifd) throw new Error('C2PA embed: TIFF has no IFD');
  let lastIfd = ifd;
  let nextPtrAt = 4; // file offset of the pointer that will be patched
  while (ifd && !seen.has(ifd)) {
    seen.add(ifd);
    const count = u16(ifd);
    const next = ifd + 2 + count * 12;
    if (next + 4 > tiff.length) throw new Error('C2PA embed: malformed TIFF IFD');
    lastIfd = ifd;
    nextPtrAt = next;
    ifd = u32(next);
  }
  if (ifd) throw new Error('C2PA embed: cyclic TIFF IFD chain');
  void lastIfd;
  // Append: [pad to 4] [IFD: count=1 | tag entry | next=0] [manifest]
  const padLen = (4 - (tiff.length % 4)) % 4;
  const ifdOffset = tiff.length + padLen;
  const valueOffset = ifdOffset + 2 + 12 + 4;
  const num16 = (n: number) => { const b = new Uint8Array(2); new DataView(b.buffer)[le ? 'setUint16' : 'setUint16'](0, n, le); return b; };
  const num32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, le); return b; };
  const newIfd = concatBytes([
    num16(1),
    num16(0xcd41), num16(7), num32(manifest.length), num32(valueOffset),
    num32(0),
  ]);
  const out = concatBytes([tiff, new Uint8Array(padLen), newIfd, manifest]);
  // Patch the previous next-IFD pointer in place.
  new DataView(out.buffer, out.byteOffset).setUint32(nextPtrAt, ifdOffset, le);
  return {
    out,
    exclusions: [
      { start: ifdOffset + 2 + 2 + 2, length: 4 }, // the entry's count field
      { start: valueOffset, length: manifest.length },
    ],
  };
}

// WebP (RIFF): a top-level "C2PA" chunk appended as the LAST chunk (+0x00 pad
// when the manifest length is odd — the pad is HASHED, only header+data are
// excluded), with the RIFF size field at offset 4 updated. Any existing C2PA
// chunk is removed first.
function placeWebp(webp: Uint8Array, manifest: Uint8Array): PlaceResult {
  const fourcc = (o: number) => String.fromCharCode(webp[o]!, webp[o + 1]!, webp[o + 2]!, webp[o + 3]!);
  if (fourcc(0) !== 'RIFF' || fourcc(8) !== 'WEBP') throw new Error('C2PA embed: not a WebP');
  const dv = new DataView(webp.buffer, webp.byteOffset);
  let drop: { start: number; end: number } | null = null;
  for (let i = 12; i + 8 <= webp.length; ) {
    const size = dv.getUint32(i + 4, true);
    const end = i + 8 + size + (size & 1);
    if (end > webp.length + 1) throw new Error('C2PA embed: malformed WebP chunk');
    if (fourcc(i) === 'C2PA') drop = { start: i, end: Math.min(end, webp.length) };
    i = end;
  }
  const cleaned = drop ? concatBytes([webp.subarray(0, drop.start), webp.subarray(drop.end)]) : webp;
  const chunk = concatBytes([
    asciiBytes('C2PA'), u32le(manifest.length), manifest,
    manifest.length & 1 ? Uint8Array.of(0) : new Uint8Array(0),
  ]);
  const start = cleaned.length;
  const out = concatBytes([cleaned, chunk]);
  new DataView(out.buffer, out.byteOffset).setUint32(4, out.length - 8, true);
  return { out, exclusions: [{ start, length: manifest.length + 8 }] };
}

// ─── MP4 (ISO BMFF) ───────────────────────────────────────────────────────────

interface Box {
  off: number;
  size: number;
  type: string;
}

// C2PA's BMFF usertype (extended box type) — d8fec3d6-1b0e-483c-9297-5828877ec481.
export const C2PA_BMFF_UUID = Uint8Array.of(
  0xd8, 0xfe, 0xc3, 0xd6, 0x1b, 0x0e, 0x48, 0x3c,
  0x92, 0x97, 0x58, 0x28, 0x87, 0x7e, 0xc4, 0x81,
);

// The c2pa-rs default exclusion set for flat (non-fragmented) BMFF: the C2PA
// uuid box itself (matched by usertype at offset 8 — other uuid boxes are
// hashed), ftyp, and the padding/index boxes muxers rewrite freely.
export const bmffHashExclusions = () => [
  { xpath: '/uuid', data: [{ offset: 8, value: C2PA_BMFF_UUID }] },
  { xpath: '/ftyp' },
  { xpath: '/mfra' },
  { xpath: '/free' },
  { xpath: '/skip' },
];

const isC2paUuidBox = (bytes: Uint8Array, b: Box): boolean =>
  b.type === 'uuid' && b.size >= 24 && C2PA_BMFF_UUID.every((v, i) => bytes[b.off + 8 + i] === v);

const bmffExcluded = (bytes: Uint8Array, b: Box): boolean =>
  isC2paUuidBox(bytes, b) || b.type === 'ftyp' || b.type === 'mfra' || b.type === 'free' || b.type === 'skip';

const u64be = (n: number): Uint8Array => {
  const out = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) { out[i] = n % 256; n = Math.floor(n / 256); }
  return out;
};

/**
 * The c2pa.hash.bmff.v2 digest: walk the file's top-level boxes in order; each
 * box surviving the exclusions contributes its u64-BE file offset, then its
 * bytes (the offset markers are what distinguish v2+ from v1). Matches
 * c2pa-rs's bmff_to_jumbf_exclusions + hash_stream_by_alg, verified against
 * c2patool output byte-for-byte.
 */
async function bmffDigest(out: Uint8Array): Promise<Uint8Array> {
  const boxes = walkBoxes(out, 0, out.length);
  if (!boxes) throw new Error('C2PA embed: malformed MP4 (truncated or 64-bit boxes)');
  const spans: Uint8Array[] = [];
  for (const b of boxes) {
    if (bmffExcluded(out, b)) continue;
    spans.push(u64be(b.off), out.subarray(b.off, b.off + b.size));
  }
  return sha256(concatBytes(spans));
}

// The C2PA box: uuid + usertype, FullBox version/flags 0, purpose 'manifest'
// (nul-terminated), u64-BE offset to a merkle box (0 = none; flat hash), then
// the JUMBF store. Appended as the LAST top-level box: nothing before it
// moves, so moov's stco/co64 chunk offsets stay valid — and validators locate
// the box by usertype, not position (verified against c2patool).
function placeMp4(mp4: Uint8Array, manifest: Uint8Array): PlaceResult {
  const boxes = walkBoxes(mp4, 0, mp4.length);
  if (!boxes || !boxes.length) throw new Error('C2PA embed: malformed MP4 (truncated or 64-bit boxes)');
  if (boxes[0]!.type !== 'ftyp') throw new Error('C2PA embed: not an MP4 (no leading ftyp box)');
  // Re-stamp replaces a prior credential — but only a TRAILING one (our own
  // placement). Stripping a mid-file box (c2patool writes its after ftyp)
  // would shift mdat and stale every stco/co64 chunk offset, corrupting
  // playback while the credential still verifies. Refuse rather than corrupt.
  const priors = boxes.filter((b) => isC2paUuidBox(mp4, b));
  if (priors.length > 1 || (priors.length === 1 && priors[0] !== boxes[boxes.length - 1])) {
    throw new Error('C2PA embed: cannot replace an existing MP4 credential that is not the last box');
  }
  let cleaned = priors.length ? mp4.subarray(0, priors[0]!.off) : mp4;
  // Finalise a to-EOF last box (size field 0): the appended C2PA box would
  // otherwise be swallowed into its scope on re-parse. The resolved size is
  // manifest-independent, so the placer contract holds.
  const lastKept = priors.length ? boxes[boxes.length - 2] : boxes[boxes.length - 1];
  if (lastKept && ((mp4[lastKept.off]! | mp4[lastKept.off + 1]! | mp4[lastKept.off + 2]! | mp4[lastKept.off + 3]!) === 0)) {
    if (lastKept.size > 0xffffffff) throw new Error('C2PA embed: cannot finalise a to-EOF MP4 box over 4GB');
    cleaned = cleaned.slice();
    cleaned[lastKept.off] = lastKept.size >>> 24;
    cleaned[lastKept.off + 1] = (lastKept.size >>> 16) & 0xff;
    cleaned[lastKept.off + 2] = (lastKept.size >>> 8) & 0xff;
    cleaned[lastKept.off + 3] = lastKept.size & 0xff;
  }
  const c2paBox = bmffBox('uuid', C2PA_BMFF_UUID, new Uint8Array(4), asciiBytes('manifest\0'), new Uint8Array(8), manifest);
  const start = cleaned.length;
  return { out: concatBytes([cleaned, c2paBox]), exclusions: [{ start, length: c2paBox.length }] };
}

// ─── WebM (Matroska / EBML) ───────────────────────────────────────────────────

interface EbmlEl {
  off: number;
  id: number;
  idWidth: number;
  sizeWidth: number;
  size: number;
  unknown: boolean;
}

// Matroska has no standardised C2PA binding (c2patool: "type is unsupported"),
// so the store rides in the container's native side-channel — an Attachments
// element whose AttachedFile is `manifest.c2pa` / application/c2pa — under the
// ordinary byte-range data-hash binding. Lolly's verifier reads it back;
// nothing else will until the spec grows a Matroska mapping.
const ID_ATTACHMENTS  = Uint8Array.of(0x19, 0x41, 0xa4, 0x69);
const ID_ATTACHEDFILE = Uint8Array.of(0x61, 0xa7);
const ID_FILENAME     = Uint8Array.of(0x46, 0x6e);
const ID_FILEMIMETYPE = Uint8Array.of(0x46, 0x60);
const ID_FILEUID      = Uint8Array.of(0x46, 0xae);
const ID_FILEDATA     = Uint8Array.of(0x46, 0x5c);
const ATTACHMENTS_NUM = 0x1941a469; // readId()/scanSegmentChildren numeric form

export const C2PA_ATTACHMENT_MIME = 'application/c2pa';

const c2paAttachment = (manifest: Uint8Array): Uint8Array => ebml(ID_ATTACHMENTS, ebml(ID_ATTACHEDFILE, concatBytes([
  ebml(ID_FILENAME, asciiBytes('manifest.c2pa')),
  ebml(ID_FILEMIMETYPE, asciiBytes(C2PA_ATTACHMENT_MIME)),
  // FileUID must be non-zero; a fixed value keeps placement content-independent
  // (we never write more than one attachment, and re-stamps replace it).
  ebml(ID_FILEUID, beUint(1)),
  ebml(ID_FILEDATA, manifest),
])));

// Is this Attachments element (a scanSegmentChildren entry) a C2PA one? True
// when any AttachedFile inside declares the application/c2pa mime type. The
// scan end is clamped to the file: a crafted oversized size VINT must not
// turn this into a near-infinite loop (the bounds-before-read house rule).
function isC2paAttachments(bytes: Uint8Array, el: EbmlEl): boolean {
  if (el.id !== ATTACHMENTS_NUM || el.unknown) return false;
  const mime = asciiBytes(C2PA_ATTACHMENT_MIME);
  const end = Math.min(el.off + el.idWidth + el.sizeWidth + el.size, bytes.length);
  outer: for (let i = el.off; i + ID_FILEMIMETYPE.length <= end - mime.length; i++) {
    if (!idAt(bytes, i, ID_FILEMIMETYPE as unknown as number[])) continue;
    const size = readVint(bytes, i + ID_FILEMIMETYPE.length);
    if (!size || size.unknown || size.value !== mime.length) continue;
    const at = i + ID_FILEMIMETYPE.length + size.width;
    if (at + mime.length > end) continue;
    for (let j = 0; j < mime.length; j++) if (bytes[at + j] !== mime[j]) continue outer;
    return true;
  }
  return false;
}

/**
 * Place the manifest into a WebM/Matroska file.
 *
 * Finalised (known-size) Segments — what MediaRecorder blobs are — get the
 * attachment appended at the Segment's end (positions indexed by SeekHead/Cues
 * never move), the Segment size VINT patched at its existing width, and an
 * Attachments entry grown into the SeekHead's reserved Void when there is
 * room (best-effort — Lolly's verifier walks the children directly).
 * Streaming unknown-size Segments with no index get it inserted before the
 * first Cluster, where a linear walk can always reach it. A prior C2PA
 * attachment in either supported spot is replaced.
 */
function placeWebm(webm: Uint8Array, manifest: Uint8Array): PlaceResult {
  if (!idAt(webm, 0, EBML_ID)) throw new Error('C2PA embed: not a WebM/Matroska file');
  const headSize = readVint(webm, EBML_ID.length);
  if (!headSize || headSize.unknown) throw new Error('C2PA embed: malformed EBML header');
  const segOff = EBML_ID.length + headSize.width + headSize.value;
  if (!idAt(webm, segOff, SEGMENT_ID)) throw new Error('C2PA embed: no Matroska Segment');
  const segSize = readVint(webm, segOff + SEGMENT_ID.length);
  if (!segSize) throw new Error('C2PA embed: malformed Segment size');
  const attach = c2paAttachment(manifest);
  const payloadStart = segOff + SEGMENT_ID.length + segSize.width;

  if (segSize.unknown) {
    // Streaming shape (live MediaRecorder): nothing may index byte positions,
    // or inserting/removing would silently break seeks we cannot see. The
    // guard must look past the first Cluster too — a trailing Cues would go
    // just as stale — so keep scanning while sizes stay measurable.
    const scan = scanSegmentChildren(webm, payloadStart, webm.length);
    if (!scan) throw new Error('C2PA embed: malformed Matroska Segment');
    const restStart = scan.firstCluster && !scan.firstCluster.unknown
      ? scan.firstCluster.off + scan.firstCluster.idWidth + scan.firstCluster.sizeWidth + scan.firstCluster.size
      : -1;
    const restIds = restStart >= 0 ? scanIdsTolerant(webm, restStart, webm.length) : [];
    if ([...scan.elements.map((e) => e.id), ...restIds].some((id) => id === SEEKHEAD || id === CUES)) {
      throw new Error('C2PA embed: unsupported Matroska shape (unknown-size Segment with an index)');
    }
    if (scan.elements.some((e) => e.id === ATTACHMENTS_NUM && !isC2paAttachments(webm, e))) {
      throw new Error('C2PA embed: Matroska file already has attachments');
    }
    const lastEl = scan.elements[scan.elements.length - 1];
    if (!scan.firstCluster && lastEl) {
      // An EOF append must stay reachable by a child walk: refuse when the
      // walk ended at an unmeasurable (unknown-size or overrunning) element —
      // an attachment past it would be invisible to Lolly's own verifier.
      const lastEnd = lastEl.off + lastEl.idWidth + lastEl.sizeWidth + lastEl.size;
      if (lastEl.unknown || lastEnd > webm.length) {
        throw new Error('C2PA embed: unsupported Matroska shape (unmeasurable Segment tail)');
      }
    }
    const prior = scan.elements.find((e) => isC2paAttachments(webm, e));
    const dropStart = prior ? prior.off : -1;
    const dropEnd = prior ? prior.off + prior.idWidth + prior.sizeWidth + prior.size : -1;
    const at = scan.firstCluster ? scan.firstCluster.off : webm.length;
    if (prior && dropEnd > at) throw new Error('C2PA embed: cannot replace existing Matroska credential');
    const before = prior
      ? concatBytes([webm.subarray(0, dropStart), webm.subarray(dropEnd, at)])
      : webm.subarray(0, at);
    return {
      out: concatBytes([before, attach, webm.subarray(at)]),
      exclusions: [{ start: before.length, length: attach.length }],
    };
  }

  let segEnd = payloadStart + segSize.value;
  if (segEnd > webm.length) throw new Error('C2PA embed: truncated Matroska Segment');
  let bytes = webm;
  let payloadLen = segSize.value;

  // Re-stamp: strip a prior TRAILING C2PA attachment (the only place we write
  // one). Everything indexed sits before it, so no position goes stale — and
  // the replacement lands at the same offset, re-validating any existing
  // SeekHead entry. A C2PA attachment anywhere else is not ours to move, and
  // a foreign attachment (cover art) must not gain a sibling Attachments
  // element (the Matroska schema allows only one).
  const all = walkAllChildren(bytes, payloadStart, segEnd);
  if (all.some((e) => e.id === ATTACHMENTS_NUM && !isC2paAttachments(bytes, e))) {
    throw new Error('C2PA embed: Matroska file already has attachments');
  }
  const priors = all.filter((e) => isC2paAttachments(bytes, e));
  if (priors.length) {
    const last = priors[priors.length - 1]!;
    const lastEnd = last.off + last.idWidth + last.sizeWidth + last.size;
    if (priors.length > 1 || lastEnd !== segEnd) throw new Error('C2PA embed: cannot replace existing Matroska credential');
    payloadLen -= lastEnd - last.off;
    bytes = concatBytes([bytes.subarray(0, last.off), bytes.subarray(lastEnd)]);
    segEnd = last.off;
  }

  const patched = writeVint(payloadLen + attach.length, segSize.width);
  if (!patched) throw new Error('C2PA embed: Segment size does not fit its VINT width');

  // Best-effort SeekHead entry (same reserved-Void trick as the Tags embed) so
  // ffmpeg-style demuxers that stop at the first Cluster still find it. The
  // splice is size-neutral, so it never disturbs the exclusion offsets.
  const scan = scanSegmentChildren(bytes, payloadStart, segEnd);
  const hasEntry = scan && seekHeadHasEntry(bytes, scan, ID_ATTACHMENTS);
  const splice = scan && !hasEntry ? seekHeadEntrySplice(bytes, scan, ID_ATTACHMENTS, payloadLen) : null;
  const payload = splice
    ? concatBytes([bytes.subarray(payloadStart, splice.start), splice.bytes, bytes.subarray(splice.end, segEnd)])
    : bytes.subarray(payloadStart, segEnd);
  const out = concatBytes([
    bytes.subarray(0, segOff + SEGMENT_ID.length),
    patched,
    payload,
    attach,
    bytes.subarray(segEnd),
  ]);
  return { out, exclusions: [{ start: payloadStart + payloadLen, length: attach.length }] };
}

// Walk ALL sibling elements in [start, end) — unlike scanSegmentChildren this
// does not stop at the first Cluster (finalised files have known-size Clusters
// and trailing Cues/Tags/Attachments). Throws on malformed or unknown-size
// children: every read is bounds-checked before use.
function walkAllChildren(bytes: Uint8Array, start: number, end: number): EbmlEl[] {
  const out: EbmlEl[] = [];
  let off = start;
  while (off < end) {
    const id = readIdAt(bytes, off, end);
    const size = id && readVint(bytes, off + id.width);
    if (!id || !size || size.unknown) throw new Error('C2PA embed: malformed Matroska Segment');
    const next = off + id.width + size.width + size.value;
    if (next > end || next <= off) throw new Error('C2PA embed: malformed Matroska Segment');
    out.push({ off, id: id.value, idWidth: id.width, sizeWidth: size.width, size: size.value, unknown: false });
    off = next;
  }
  return out;
}

// Tolerant sibling walk for guards: collect element ids while sizes stay
// known and in-bounds, stop silently otherwise (unknown-size Clusters — the
// streaming case — end measurable structure; nothing beyond them can be
// checked, or shifted, reliably).
function scanIdsTolerant(bytes: Uint8Array, from: number, end: number): number[] {
  const ids: number[] = [];
  let off = from;
  while (off < end) {
    const id = readIdAt(bytes, off, end);
    const size = id && readVint(bytes, off + id.width);
    if (!id || !size || size.unknown) break;
    const next = off + id.width + size.width + size.value;
    if (next > end || next <= off) break;
    ids.push(id.value);
    off = next;
  }
  return ids;
}

// readId with an explicit bound (video-meta's readId checks bytes.length; here
// the walk must not read past its own window).
function readIdAt(bytes: Uint8Array, off: number, end: number): { width: number; value: number } | null {
  const first = bytes[off];
  if (first === undefined || first === 0) return null;
  let width = 1;
  while (width <= 4 && !(first & (0x80 >> (width - 1)))) width++;
  if (width > 4 || off + width > end) return null;
  let value = 0;
  for (let i = 0; i < width; i++) value = value * 256 + bytes[off + i]!;
  return { width, value };
}

// Does the SeekHead already carry an entry whose SeekID is `seekId`? (Set on a
// re-stamp — the prior stamp added it, and the replacement attachment lands at
// the same position, so the entry stays correct.)
function seekHeadHasEntry(bytes: Uint8Array, scan: { elements: EbmlEl[] }, seekId: Uint8Array): boolean {
  const sh = scan.elements.find((e) => e.id === SEEKHEAD && !e.unknown);
  if (!sh) return false;
  const start = sh.off + sh.idWidth + sh.sizeWidth;
  const end = start + sh.size;
  const needle = concatBytes([Uint8Array.of(0x53, 0xab), writeVint(seekId.length)!, seekId]); // SeekID element
  outer: for (let i = start; i + needle.length <= end; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

interface Container {
  place: (container: Uint8Array, manifest: Uint8Array) => PlaceResult;
  mime: string;
  hash?: string;
}

const CONTAINERS: Record<string, Container> = {
  png: { place: placePng, mime: 'image/png' },
  apng: { place: placePng, mime: 'image/png' },
  jpg: { place: placeJpeg, mime: 'image/jpeg' },
  jpeg: { place: placeJpeg, mime: 'image/jpeg' },
  gif: { place: placeGif, mime: 'image/gif' },
  svg: { place: placeSvg, mime: 'image/svg+xml' },
  tiff: { place: placeTiff, mime: 'image/tiff' },
  'cmyk-tiff': { place: placeTiff, mime: 'image/tiff' },
  webp: { place: placeWebp, mime: 'image/webp' },
  mp4: { place: placeMp4, mime: 'video/mp4', hash: 'bmff' },
  webm: { place: placeWebm, mime: 'video/webm' },
};

/** Formats embedC2pa can stamp (plus 'pdf'/'pdf-cmyk' via embedC2paInPdf). */
export const C2PA_FORMATS = Object.freeze(['pdf', 'pdf-cmyk', ...Object.keys(CONTAINERS)]);

/**
 * Re-attach an ALREADY-BUILT C2PA manifest store (verbatim JUMBF, as returned by
 * extractC2paStore) back into a container, WITHOUT rebuilding or re-signing it. Used to
 * make a captured Content Credential inspectable again after ingest re-encoded the file
 * and dropped the in-file manifest (the raw store is preserved separately). The store's
 * hard binding still references the ORIGINAL bytes, so a verifier will correctly report
 * the file as modified if `bytes` differ from what was signed — but the manifest's claims
 * (AI-generated flag, signer identity, action history) read intact. Returns the container
 * bytes with the store embedded. No signing, no hashing — a pure re-insertion.
 */
export function attachC2paStore(bytes: Uint8Array, format: string, store: Uint8Array): Uint8Array {
  if (!(bytes instanceof Uint8Array)) throw new Error('C2PA attach: bytes must be a Uint8Array');
  if (!(store instanceof Uint8Array)) throw new Error('C2PA attach: store must be a Uint8Array');
  const container = CONTAINERS[String(format || '').toLowerCase()];
  if (!container) throw new Error(`C2PA attach: no container for format '${format}'`);
  return container.place(bytes, store).out;
}

/**
 * Embed a signed C2PA manifest into any supported container. `format` is the
 * export format string ('png', 'jpg', 'svg', 'gif', 'tiff', 'cmyk-tiff',
 * 'webp', 'apng', 'mp4', 'webm', 'pdf', 'pdf-cmyk'); PDF routes to the
 * incremental-update embedder, everything else through the container placers
 * above. A container with hash: 'bmff' gets the box-walking c2pa.hash.bmff.v2
 * binding instead of byte-range exclusions. Options:
 * { title, claimGenerator, generatorInfo, environment, author, dates, signer }
 * — signer as documented on buildC2paManifest (external CA-issued credential;
 * the ephemeral self-signed one is generated when absent).
 */
export async function embedC2pa(bytes: Uint8Array, format: string, opts: EmbedOptions = {}): Promise<Uint8Array> {
  if (!(bytes instanceof Uint8Array)) throw new Error('C2PA embed: bytes must be a Uint8Array');
  const fmt = String(format || '').toLowerCase();
  if (fmt === 'pdf' || fmt === 'pdf-cmyk') return embedC2paInPdf(bytes, opts);
  const container = CONTAINERS[fmt];
  if (!container) throw new Error(`C2PA embed: no embedding for format '${format}'`);
  const isBmff = container.hash === 'bmff';

  const { title, claimGenerator, generatorInfo, environment, author, authorship, rights, actions, ingredients, dates = {}, signer } = opts;
  // As in embedC2paInPdf: signer + chain bytes frozen once per embed so every
  // pass across the two-pass layout signs identical protected-header bytes.
  const sig: Signer = signer ?? (await generateSigner(dates));
  const internals = {
    signer: { ...sig, sign: sig.sign && sig.sign.bind(sig), chain: sig.chain ?? [sig.certDer!] },
    manifestLabel: urnUuid(),
    instanceId: urnUuid(),
  };
  const pad = new Uint8Array(8);
  const dummyHash = new Uint8Array(32);
  const build = (hash: Uint8Array, exclusions: Exclusion[], padBytes: Uint8Array): Promise<Uint8Array> => buildC2paManifest({
    title, claimGenerator, generatorInfo, environment, author, authorship, rights, actions, ingredients, dates, format: container.mime,
    assetHash: isBmff ? { bmff: true, hash, pad: padBytes } : { exclusions, hash, pad: padBytes },
    ...internals,
  });

  // Pass 1: fixed point between manifest length and the exclusion offsets its
  // placement produces (offsets feed back into CBOR integer widths; the BMFF
  // assertion carries no offsets, so it converges immediately).
  let manifestLen = (await build(dummyHash, [{ start: bytes.length + 512, length: 4096 }], pad)).length;
  let layout: PlaceResult | null = null;
  let placeholder: Uint8Array | null = null;
  for (let round = 0; round < 8 && !layout; round++) {
    const probe = container.place(bytes, new Uint8Array(manifestLen));
    const m = await build(dummyHash, probe.exclusions, pad);
    if (m.length === manifestLen) { layout = probe; placeholder = m; }
    else manifestLen = m.length;
  }
  if (!layout) throw new Error('C2PA embed: manifest layout did not converge');

  // Hash the placed output with the manifest's home OMITTED — by byte range
  // for most containers, by the BMFF box walk for mp4.
  const digestOf = async (out: Uint8Array): Promise<Uint8Array> => {
    if (isBmff) return bmffDigest(out);
    const spans: Uint8Array[] = [];
    let at = 0;
    for (const e of [...layout!.exclusions].sort((a, b) => a.start - b.start)) {
      spans.push(out.subarray(at, e.start));
      at = e.start + e.length;
    }
    spans.push(out.subarray(at));
    return sha256(concatBytes(spans));
  };
  const staged = container.place(bytes, placeholder!);
  const digest = await digestOf(staged.out);

  // Pass 2: real digest, same length (pad absorbs residual CBOR drift).
  let manifest = await build(digest, layout.exclusions, pad);
  if (manifest.length !== manifestLen) {
    const padLen = pad.length + (manifestLen - manifest.length);
    if (padLen < 0 || padLen >= 24) throw new Error('C2PA embed: manifest length drifted beyond pad range');
    manifest = await build(digest, layout.exclusions, new Uint8Array(padLen));
    if (manifest.length !== manifestLen) throw new Error('C2PA embed: manifest length is not deterministic');
  }
  const final = container.place(bytes, manifest);
  // The placer contract: bytes outside the exclusions depend only on manifest
  // LENGTH — so the digest computed against the placeholder must still be the
  // digest of the final file. Verify rather than trust.
  const check = await digestOf(final.out);
  for (let i = 0; i < 32; i++) {
    if (check[i] !== digest[i]) throw new Error('C2PA embed: container placement is not content-independent');
  }
  return final.out;
}
