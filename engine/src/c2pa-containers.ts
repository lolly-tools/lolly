// SPDX-License-Identifier: MPL-2.0
/**
 * C2PA container placement - the per-format byte-splicing side of the writer:
 * classic-xref PDF incremental update, the png/jpeg/gif/svg/tiff/webp embedders,
 * ISO BMFF (mp4) with its own c2pa.hash.bmff.v2 binding, and the WebM/Matroska
 * attachment path, plus embedC2pa/embedC2paInPdf - the public entry points that
 * dispatch to whichever placer a format needs. Split out of c2pa.ts so the
 * manifest/claim BUILDER (CBOR, JUMBF, COSE_Sign1, buildC2paManifest) is
 * reviewable on its own, separate from container-specific byte grammar.
 * This file imports buildC2paManifest/urnUuid/BMFF_HASH_LABEL (+ shared types)
 * from c2pa.ts; c2pa.ts re-exports embedC2pa/embedC2paInPdf/etc. back so every
 * existing import path is unchanged. ONE genuine runtime cycle: c2pa.ts's
 * buildC2paManifest needs bmffHashExclusions (exported here) for the BMFF
 * assertion's exclusion-set shape. Safe - see c2pa.ts's import-site comment.
 */

import {
  walkBoxes, box as bmffBox,
  EBML_ID, SEGMENT_ID, SEEKHEAD, CUES,
  readVint, writeVint, ebml, idAt, scanSegmentChildren, seekHeadEntrySplice, beUint,
} from './video-meta.ts';
import { generateSigner } from './x509.ts';
import { concatBytes, sha256, bytesToBin } from './bytes.ts';
import { locateOpusComment, parseOpusTags, buildOpusTags, buildOggPage, commentKey, OGG_C2PA_KEY } from './ogg.ts';
import { buildC2paManifest, urnUuid, BMFF_HASH_LABEL } from './c2pa.ts';
import type { Signer, Exclusion, EmbedOptions, PlaceResult } from './c2pa.ts';
// Runtime-light: gainmap-jpeg's only value imports are bytes.ts + jpeg-segments.ts
// (GainMapMeta is type-only), so this pulls no pixel machinery into the C2PA path.
import { repairMpfOffsets } from './gainmap-jpeg.ts';

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
// Cross-reference *streams* (PDF 1.5+) start with "N G obj" instead - those
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
  const entries = new Map<number, XrefEntry>(); // first seen wins - the chain walks newest → oldest
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
// for slightly-off offsets - some writers pad or shift by an EOL).
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

// "nnnnnnnnnn ggggg n\r\n" - exactly the 20-byte classic xref entry.
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
export async function embedC2paInPdf(pdfBytes: Uint8Array, { title, claimGenerator, generatorInfo, environment, author, authorship, rights, actions, ingredients, aiDisclosure, specVersion, dates = {}, signer }: EmbedOptions = {}): Promise<Uint8Array> {
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
    title, claimGenerator, generatorInfo, environment, author, authorship, rights, actions, ingredients, aiDisclosure, specVersion, dates, format: 'application/pdf',
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
// handlers (png_io/jpeg_io/gif_io/svg_io/tiff_io/riff_io) - the validator
// behind c2patool and verify.contentauthenticity.org - including each
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

// JPEG: APP11 (FF EB) JUMBF segments - CI "JP", En 0x0211, Z = u32BE 1-based;
// the manifest is chunked at 64000 bytes and continuation segments repeat the
// store's first 8 bytes (superbox LBox+TBox) after the Z field, exactly as
// jpeg_io.rs writes and its reader strips. Placed after the LAST APP0 (or
// right after SOI); the exclusion is one contiguous range over all segments.
//
// MPF-AWARE (plans/61-deeprichpixels.md section 6 B2, task E1). A gain-map / Ultra HDR
// JPEG is two JPEGs in one file, and the primary carries a CIPA DC-007 MPF
// index (APP2) recording the SIZE of the primary image and the OFFSET of the
// second. The APP11 block above always lands ahead of that APP2 - APP0 sorts
// before APP2, and with no APP0 the insertion point is offset 2 - so stamping
// grows the primary without the index noticing: MPEntry[0].size then
// under-reports by exactly the block length and the index is structurally
// invalid, in a file that still opens fine everywhere. (MPEntry[1].offset is
// measured from the MP Endian field, which moved by the same delta, so that one
// field survives on its own; the size does not.) `repairMpfOffsets` re-derives
// every entry from the finished bytes - it is a no-op returning the SAME array
// for any JPEG with no MPF index or no second image, so ordinary JPEGs are
// spliced byte-identically, and it never throws.
//
// This is safe for the two-pass layout in embedC2pa: the rewritten fields are a
// function of the file and the inserted block LENGTH only, which is the placer
// contract embedC2pa's post-placement digest check enforces.
const JPEG_CHUNK = 64000;
function placeJpeg(jpeg: Uint8Array, manifest: Uint8Array): PlaceResult {
  if (!(jpeg[0] === 0xff && jpeg[1] === 0xd8)) throw new Error('C2PA embed: not a JPEG');
  // Walk marker segments up to SOS (FF DA) - entropy data follows, nothing to
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
  const spliced = concatBytes([cleaned.subarray(0, pos), block, cleaned.subarray(pos)]);
  // Same length, same exclusion range: repairMpfOffsets patches a copy in place.
  const out = repairMpfOffsets(spliced);
  return { out, exclusions: [{ start: pos, length: block.length }] };
}

// GIF: one Application Extension (21 FF 0B "C2PA_GIF" 01 00 00) holding the
// manifest as ≤255-byte sub-blocks + 00 terminator, inserted right after the
// preamble (header + LSD + optional GCT) - c2pa-rs stops scanning at the first
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
  out[4] = 0x39; // '9' - extensions require GIF89a
  return { out, exclusions: [{ start: pre, length: block.length }] };
}

// SVG: the manifest is standard base64 (with padding, one unbroken run) as the
// text of <c2pa:manifest> inside a direct <metadata> child of the root <svg>,
// with xmlns:c2pa declared on the root. Only the base64 TEXT is excluded from
// the hard binding - the tags around it are hashed, and the hash is over raw
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
  // byteLength is REQUIRED here: `tiff` may be a subarray view of a larger
  // buffer, and a DataView without it would happily read past the logical end
  // of the file into unrelated bytes of the same ArrayBuffer instead of
  // throwing. Every offset below comes out of the file itself, so the view must
  // stop exactly where the file does.
  const dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);
  // The 8-byte classic header (magic, 42, first-IFD pointer) must be present
  // before any of it is read.
  if (tiff.length < 8) throw new Error('C2PA embed: truncated TIFF header');
  if (u16(2) !== 42) throw new Error('C2PA embed: BigTIFF is not supported');
  // Find the last IFD in the chain (cycle-guarded).
  const seen = new Set<number>();
  let ifd = u32(4);
  if (!ifd) throw new Error('C2PA embed: TIFF has no IFD');
  let lastIfd = ifd;
  let nextPtrAt = 4; // file offset of the pointer that will be patched
  while (ifd && !seen.has(ifd)) {
    seen.add(ifd);
    // Bounds-check the pointer BEFORE dereferencing it. `ifd` is attacker
    // controlled (it is read straight out of the file, both here and via
    // u32(next) at the foot of the loop), so without this a forged offset past
    // EOF escapes as a raw DataView RangeError rather than this module's own
    // malformed-input error.
    if (ifd + 2 > tiff.length) throw new Error('C2PA embed: malformed TIFF IFD');
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

// RIFF family (WebP, WAV): a top-level "C2PA" chunk appended as the LAST chunk
// (+0x00 pad when the manifest length is odd - the pad is HASHED, only
// header+data are excluded), with the RIFF size field at offset 4 updated. Any
// existing C2PA chunk is removed first. One placer serves both containers -
// the chunk grammar is identical, only the form fourcc at offset 8 differs.
function placeRiff(riff: Uint8Array, manifest: Uint8Array, form: string, label: string): PlaceResult {
  const fourcc = (o: number) => String.fromCharCode(riff[o]!, riff[o + 1]!, riff[o + 2]!, riff[o + 3]!);
  if (riff.length < 12 || fourcc(0) !== 'RIFF' || fourcc(8) !== form) throw new Error(`C2PA embed: not a ${label}`);
  const dv = new DataView(riff.buffer, riff.byteOffset);
  let drop: { start: number; end: number } | null = null;
  for (let i = 12; i + 8 <= riff.length; ) {
    const size = dv.getUint32(i + 4, true);
    const end = i + 8 + size + (size & 1);
    if (end > riff.length + 1) throw new Error(`C2PA embed: malformed ${label} chunk`);
    if (fourcc(i) === 'C2PA') drop = { start: i, end: Math.min(end, riff.length) };
    i = end;
  }
  const cleaned = drop ? concatBytes([riff.subarray(0, drop.start), riff.subarray(drop.end)]) : riff;
  const chunk = concatBytes([
    asciiBytes('C2PA'), u32le(manifest.length), manifest,
    manifest.length & 1 ? Uint8Array.of(0) : new Uint8Array(0),
  ]);
  const start = cleaned.length;
  const out = concatBytes([cleaned, chunk]);
  new DataView(out.buffer, out.byteOffset).setUint32(4, out.length - 8, true);
  return { out, exclusions: [{ start, length: manifest.length + 8 }] };
}

const placeWebp = (webp: Uint8Array, manifest: Uint8Array): PlaceResult => placeRiff(webp, manifest, 'WEBP', 'WebP');

// WAV: the same RIFF binding (the C2PA spec's RIFF-family mapping - the route
// for a generated narration clip's Article 50 mark to live IN the file, not
// just on the asset record; plans/41-tts-stt-programme.md section 2). The chunk lands
// after 'fmt '/'data' (appended last), decoders skip unknown chunks (the
// engine's own parseWav walks; verified against decodeAudioData manually), and
// re-stamp replaces. A file with no 'data' chunk is not audio - refuse rather
// than credential a container no player will read.
function placeWav(wav: Uint8Array, manifest: Uint8Array): PlaceResult {
  const fourcc = (o: number) => String.fromCharCode(wav[o]!, wav[o + 1]!, wav[o + 2]!, wav[o + 3]!);
  if (wav.length >= 12 && fourcc(0) === 'RIFF' && fourcc(8) === 'WAVE') {
    const dv = new DataView(wav.buffer, wav.byteOffset);
    let hasData = false;
    for (let i = 12; i + 8 <= wav.length; ) {
      if (fourcc(i) === 'data') hasData = true;
      const size = dv.getUint32(i + 4, true);
      i += 8 + size + (size & 1);
    }
    if (!hasData) throw new Error('C2PA embed: WAV has no data chunk');
  }
  return placeRiff(wav, manifest, 'WAVE', 'WAV');
}

// ─── Ogg (Opus) ────────────────────────────────────────────────────────────────
// Opus in Ogg (the .opus/.ogg files ffmpeg's libopus writes) has no C2PA-spec
// container binding - c2pa-rs can't read it - so this is Lolly's own home for the
// credential, the same "our verifier only" caveat as the WebM attachment path.
// The JUMBF store rides as a base64 `C2PA=` VorbisComment field in the OpusTags
// comment header (the lone packet on the second Ogg page). We rebuild that ONE
// page (a fresh segment table + a recomputed Ogg CRC) and exclude its whole byte
// range from the hard binding, so OpusHead + every audio page - the actual sound
// - hashes identically across the two-pass embed. Unknown comment fields are
// ignored by decoders, so the file still plays everywhere (incl. Safari's Web
// Audio, the reason these loops are Ogg/Opus rather than WebM in the first place).
// See engine/src/ogg.ts for the page grammar. Re-stamp strips any prior C2PA
// field first, so it replaces rather than accumulates.
function placeOgg(ogg: Uint8Array, manifest: Uint8Array): PlaceResult {
  const loc = locateOpusComment(ogg);
  if (!loc) throw new Error('C2PA embed: not an Ogg Opus stream (no OpusHead/OpusTags)');
  if (loc.pageCount !== 1) throw new Error('C2PA embed: multi-page Opus comment header not supported');
  const tags = parseOpusTags(loc.packet);
  if (!tags) throw new Error('C2PA embed: malformed OpusTags comment header');
  const kept = tags.comments.filter((c) => commentKey(c) !== OGG_C2PA_KEY);
  const field = concatBytes([te.encode(`${OGG_C2PA_KEY}=`), te.encode(btoa(bytesToBin(manifest)))]);
  const page = buildOggPage(loc.first22, buildOpusTags(tags.vendor, [...kept, field]));
  return {
    out: concatBytes([ogg.subarray(0, loc.commentStart), page, ogg.subarray(loc.commentEnd)]),
    exclusions: [{ start: loc.commentStart, length: page.length }],
  };
}

// ─── FLAC ────────────────────────────────────────────────────────────────────
// FLAC has no C2PA-spec container binding (c2pa-rs has no FLAC reader), so this
// is Lolly's own home for the credential - the same "our verifier only" caveat
// as the Ogg/WebM paths. The JUMBF store rides in a metadata APPLICATION block
// (type 2) whose 4-byte application id is 'C2PA', inserted right after the
// mandatory STREAMINFO block and before the audio frames. Decoders skip unknown
// APPLICATION blocks, so the file still plays everywhere.
//
// FLAC's last-metadata-block flag (top bit of each block's 1-byte header) must
// stay valid: STREAMINFO first, EXACTLY ONE block flagged last, frames untouched.
// Rather than patch flags in place, we parse the whole metadata chain, drop any
// prior Lolly credential, rebuild the list as [STREAMINFO, C2PA, ...rest], and
// re-derive every last-block flag from the new order (all cleared, set only on
// the final block). That is correct whether STREAMINFO was the only block (C2PA
// becomes last) or others follow (the last of those stays last), and makes
// re-stamp a clean replace. Read side: extractC2paFromFlac in c2pa-extract.ts.
export const FLAC_C2PA_APPID = 'C2PA';

function placeFlac(flac: Uint8Array, manifest: Uint8Array): PlaceResult {
  if (flac.length < 4 || flac[0] !== 0x66 || flac[1] !== 0x4c || flac[2] !== 0x61 || flac[3] !== 0x43) {
    throw new Error('C2PA embed: not a FLAC stream');
  }
  // Walk the metadata block chain, bounds-checked before every read (the file is
  // attacker-controlled). Each block: 1 header byte [last<<7 | type], a 3-byte
  // big-endian length, then the body. The first MUST be STREAMINFO (type 0).
  const appId = asciiBytes(FLAC_C2PA_APPID);
  const blocks: { type: number; body: Uint8Array }[] = [];
  let off = 4;
  let sawLast = false;
  while (off + 4 <= flac.length) {
    const header = flac[off]!;
    const last = (header & 0x80) !== 0;
    const type = header & 0x7f;
    const len = (flac[off + 1]! << 16) | (flac[off + 2]! << 8) | flac[off + 3]!;
    const bodyStart = off + 4;
    const bodyEnd = bodyStart + len;
    if (bodyEnd > flac.length) throw new Error('C2PA embed: malformed FLAC metadata block');
    if (blocks.length === 0 && type !== 0) throw new Error('C2PA embed: FLAC first metadata block is not STREAMINFO');
    // Drop a prior Lolly credential (our APPLICATION block) so re-stamp replaces.
    const isPriorC2pa = type === 2 && len >= 4 &&
      flac[bodyStart] === appId[0] && flac[bodyStart + 1] === appId[1] &&
      flac[bodyStart + 2] === appId[2] && flac[bodyStart + 3] === appId[3];
    if (!isPriorC2pa) blocks.push({ type, body: flac.subarray(bodyStart, bodyEnd) });
    off = bodyEnd;
    if (last) { sawLast = true; break; }
  }
  if (!sawLast || blocks.length === 0) throw new Error('C2PA embed: malformed FLAC metadata (no terminal block)');
  const frames = flac.subarray(off);
  const c2paBody = concatBytes([appId, manifest]);
  if (c2paBody.length > 0xffffff) throw new Error('C2PA embed: manifest too large for a FLAC APPLICATION block');
  // Rebuild: STREAMINFO, our credential, then the rest verbatim. The C2PA block
  // is always index 1, at a fixed offset (STREAMINFO's size is manifest-independent),
  // so only its LENGTH varies with the manifest - exactly the excluded range.
  const ordered = [blocks[0]!, { type: 2, body: c2paBody }, ...blocks.slice(1)];
  const out: Uint8Array[] = [asciiBytes('fLaC')];
  let pos = 4;
  let exclStart = 0;
  for (let i = 0; i < ordered.length; i++) {
    const b = ordered[i]!;
    const isLast = i === ordered.length - 1;
    const n = b.body.length;
    out.push(Uint8Array.of((isLast ? 0x80 : 0) | b.type, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff), b.body);
    if (i === 1) exclStart = pos;
    pos += 4 + n;
  }
  out.push(frames);
  return { out: concatBytes(out), exclusions: [{ start: exclStart, length: 4 + c2paBody.length }] };
}

// ─── MP4 (ISO BMFF) ───────────────────────────────────────────────────────────

interface Box {
  off: number;
  size: number;
  type: string;
}

// C2PA's BMFF usertype (extended box type) - d8fec3d6-1b0e-483c-9297-5828877ec481.
export const C2PA_BMFF_UUID = Uint8Array.of(
  0xd8, 0xfe, 0xc3, 0xd6, 0x1b, 0x0e, 0x48, 0x3c,
  0x92, 0x97, 0x58, 0x28, 0x87, 0x7e, 0xc4, 0x81,
);

// The c2pa-rs default exclusion set for flat (non-fragmented) BMFF: the C2PA
// uuid box itself (matched by usertype at offset 8 - other uuid boxes are
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
// moves, so moov's stco/co64 chunk offsets stay valid - and validators locate
// the box by usertype, not position (verified against c2patool).
function placeMp4(mp4: Uint8Array, manifest: Uint8Array): PlaceResult {
  const boxes = walkBoxes(mp4, 0, mp4.length);
  if (!boxes || !boxes.length) throw new Error('C2PA embed: malformed MP4 (truncated or 64-bit boxes)');
  if (boxes[0]!.type !== 'ftyp') throw new Error('C2PA embed: not an MP4 (no leading ftyp box)');
  // Re-stamp replaces a prior credential - but only a TRAILING one (our own
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
// so the store rides in the container's native side-channel - an Attachments
// element whose AttachedFile is `manifest.c2pa` / application/c2pa - under the
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
 * Finalised (known-size) Segments - what MediaRecorder blobs are - get the
 * attachment appended at the Segment's end (positions indexed by SeekHead/Cues
 * never move), the Segment size VINT patched at its existing width, and an
 * Attachments entry grown into the SeekHead's reserved Void when there is
 * room (best-effort - Lolly's verifier walks the children directly).
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
    // guard must look past the first Cluster too - a trailing Cues would go
    // just as stale - so keep scanning while sizes stay measurable.
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
      // walk ended at an unmeasurable (unknown-size or overrunning) element -
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
  // one). Everything indexed sits before it, so no position goes stale - and
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

// Walk ALL sibling elements in [start, end) - unlike scanSegmentChildren this
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
// known and in-bounds, stop silently otherwise (unknown-size Clusters - the
// streaming case - end measurable structure; nothing beyond them can be
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
// re-stamp - the prior stamp added it, and the replacement attachment lands at
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

// ─── MP3 (ID3v2 GEOB) ─────────────────────────────────────────────────────────
// Per the C2PA spec's MPEG-1/2 audio binding: the manifest store is the object
// data of a GEOB (General Encapsulated Object) frame in the leading ID3v2 tag,
// identified by its MIME type; the hard-binding exclusion is the ENTIRE ID3v2
// tag (start 0 through tag end), so retagging tools that rewrite other frames
// still invalidate nothing outside the credential's home. The read side
// (c2pa-extract extractC2paFromMp3) matches on the MIME alone, so the
// filename/description strings are naming, not protocol.
export const MP3_GEOB_MIME = 'application/x-c2pa-manifest-store';

// 28-bit syncsafe integer (ID3v2 tag + v2.4 frame sizes): 7 bits per byte.
const syncsafe = (n: number): Uint8Array =>
  Uint8Array.of((n >>> 21) & 0x7f, (n >>> 14) & 0x7f, (n >>> 7) & 0x7f, n & 0x7f);
const readSyncsafe = (b: Uint8Array, off: number): number =>
  ((b[off]! & 0x7f) << 21) | ((b[off + 1]! & 0x7f) << 14) | ((b[off + 2]! & 0x7f) << 7) | (b[off + 3]! & 0x7f);

// One GEOB frame carrying the store. Latin-1 text encoding (0x00) - every
// string here is ASCII. `v4` picks the frame-size encoding to match the tag
// version it lands in (v2.4 syncsafe, v2.3 plain 32-bit).
function mp3GeobFrame(manifest: Uint8Array, v4: boolean): Uint8Array {
  const nul = Uint8Array.of(0);
  const body = concatBytes([
    Uint8Array.of(0x00), asciiBytes(MP3_GEOB_MIME), nul, asciiBytes('c2pa'), nul, asciiBytes('c2pa'), nul, manifest,
  ]);
  if (v4 && body.length >= 1 << 28) throw new Error('C2PA embed: manifest too large for an ID3v2.4 frame');
  return concatBytes([asciiBytes('GEOB'), v4 ? syncsafe(body.length) : u32be(body.length), Uint8Array.of(0, 0), body]);
}

// Is this frame OUR GEOB? (id GEOB, Latin-1-positioned MIME matches.)
function isC2paGeob(bytes: Uint8Array, bodyStart: number, bodyEnd: number): boolean {
  const mime = asciiBytes(MP3_GEOB_MIME);
  if (bodyEnd - bodyStart < 1 + mime.length + 1) return false;
  for (let j = 0; j < mime.length; j++) if (bytes[bodyStart + 1 + j] !== mime[j]) return false;
  return bytes[bodyStart + 1 + mime.length] === 0;
}

// Walk the frames of a v2.3/v2.4 tag in [from, end): [{ start, end, keep }].
// Stops at padding (a zero byte where a frame id should be). Bounds-checked
// before every read - tags come out of attacker-controlled files.
function walkId3Frames(bytes: Uint8Array, from: number, end: number, v4: boolean): { start: number; end: number; c2pa: boolean }[] {
  const out: { start: number; end: number; c2pa: boolean }[] = [];
  let off = from;
  while (off + 10 <= end && bytes[off] !== 0) {
    const size = v4 ? readSyncsafe(bytes, off + 4) : ((bytes[off + 4]! << 24) | (bytes[off + 5]! << 16) | (bytes[off + 6]! << 8) | bytes[off + 7]!) >>> 0;
    const next = off + 10 + size;
    if (next > end || next <= off) throw new Error('C2PA embed: malformed ID3v2 frame');
    const isGeob = bytes[off] === 0x47 && bytes[off + 1] === 0x45 && bytes[off + 2] === 0x4f && bytes[off + 3] === 0x42;
    out.push({ start: off, end: next, c2pa: isGeob && isC2paGeob(bytes, off + 10, next) });
    off = next;
  }
  return out;
}

// MP3: rebuild ONE leading ID3v2 tag - the existing tag's frames (minus any
// prior C2PA GEOB - re-stamp replaces, never duplicates) with our GEOB
// prepended, or a fresh minimal ID3v2.4 tag when the file starts at a frame
// sync. The audio bytes are never touched, and everything outside the tag
// depends only on manifest LENGTH (the placer contract). Unsynchronised or
// extended-header tags are rare enough to refuse rather than mis-walk.
function placeMp3(mp3: Uint8Array, manifest: Uint8Array): PlaceResult {
  const hasTag = mp3.length >= 10 && mp3[0] === 0x49 && mp3[1] === 0x44 && mp3[2] === 0x33;
  if (!hasTag && !(mp3.length >= 4 && mp3[0] === 0xff && (mp3[1]! & 0xe0) === 0xe0)) {
    throw new Error('C2PA embed: not an MP3 (no ID3v2 tag or frame sync)');
  }
  let ver = 4;
  let audioStart = 0;
  let kept: Uint8Array = new Uint8Array(0);
  if (hasTag) {
    ver = mp3[3]!;
    if (ver !== 3 && ver !== 4) throw new Error(`C2PA embed: unsupported ID3v2.${ver} tag`);
    const flags = mp3[5]!;
    if (flags & 0x80) throw new Error('C2PA embed: unsynchronised ID3v2 tag');
    if (flags & 0x40) throw new Error('C2PA embed: ID3v2 extended header not supported');
    const size = readSyncsafe(mp3, 6);
    audioStart = 10 + size + ((flags & 0x10) ? 10 : 0);
    if (audioStart > mp3.length) throw new Error('C2PA embed: truncated ID3v2 tag');
    // Existing frames ride verbatim (their bytes are already valid for `ver`);
    // padding is dropped - the rebuilt tag is exactly as large as its frames.
    const frames = walkId3Frames(mp3, 10, 10 + size, ver === 4);
    kept = concatBytes(frames.filter((f) => !f.c2pa).map((f) => mp3.subarray(f.start, f.end)));
  }
  const geob = mp3GeobFrame(manifest, ver === 4);
  const content = concatBytes([geob, kept]);
  if (content.length >= 1 << 28) throw new Error('C2PA embed: ID3v2 tag too large');
  // Rebuilt header: same major version, revision 0, no flags (any footer is
  // dropped with the rest of the old envelope - the frames carry the meaning).
  const tag = concatBytes([asciiBytes('ID3'), Uint8Array.of(ver, 0, 0), syncsafe(content.length), content]);
  return {
    out: concatBytes([tag, mp3.subarray(audioStart)]),
    exclusions: [{ start: 0, length: tag.length }],
  };
}

// ─── C2PA 2.4 text bindings (section A.7 HTML documents, section A.9 structured text) ───────
//
// Two placers, both pure byte-splicing in placeSvg's spirit: find the carrier's
// home in the host's own bytes, splice, and report the exclusion range the hard
// binding must carve out. No DOM, no canonicalisation - section A.7.1.3 hashes "the byte
// representation of the document as stored", and section A.9.4 says files "shall be read
// in binary mode to preserve the exact byte representation of line terminators".
//
// Both satisfy the driver's two-pass contract MORE strongly than the binary
// containers do: every byte outside the exclusion is a function of the HOST alone
// (not even of the manifest's length), because the manifest only ever grows a
// region that is entirely inside the exclusion. embedC2pa's convergence loop
// therefore settles on the first probe.
//
// SPEC DELTAS to know when reading this:
//   * section A.7's exclusion is the WHOLE `<script>` element, `<script` through
//     `</script>` inclusive - wider than placeSvg's base64-text-only rule. Both
//     are legal for their own binding; neither is a canonicalisation.
//   * section A.9's block is a SINGLE COMMENT LINE (section A.9.3.1). The multi-line shape in
//     section A.9.3.2 is the FRONT MATTER form - and the spec contradicts itself about
//     when it is mandatory. section A.9.3 opens "For structured text formats that support
//     front matter, the C2PA Manifest block SHALL appear inside that front
//     matter"; section A.9.3.2 then downgrades the identical rule to "MAY use a
//     multi-line manifest block … claim generators SHOULD prefer the front matter
//     form when possible". Markdown (YAML front matter) is one of the two formats
//     section A.9.3.2 names, so for an md host that already HAS front matter this placer
//     takes the weaker reading and writes the single-line comment form at EOF.
//     Say it plainly: that is a KNOWN DEVIATION from section A.9.3's `shall`, taken
//     because section A.9.3.2 restates the same rule as a `should` and because one
//     exclusion formula for all four hosts is the thing that keeps writer and
//     reader byte-exact. Scheduled, not settled - see
//     plans/105-m345/findings-spec-conformance.md F4.
//   * section A.9.3.1 recommends placing the block at the start of the file, and REQUIRES
//     the end when line 1 is reserved by the host (a `#!` shebang, an `<?xml?>`
//     declaration). We place at the end ALWAYS: it is the one position that is
//     correct for every host, it never disturbs line 1 whatever that line is, and
//     it keeps one exclusion formula for all four formats. Spec-legal, because the
//     start-of-file preference is a "strongly recommended", not a "shall".
//
// AN UNRESOLVED CONFLICT INSIDE 2.4, to know before anyone reads an interop
// failure as our bug: section 15.12.1.1 tells a validator it "shall ensure that the data
// contained within the exclusion range containing the C2PA Manifest Store consists
// of ONLY the C2PA Manifest Store and any appropriate padding", on pain of
// `assertion.dataHash.mismatch` - but section A.7.1.3 REQUIRES the exclusion to cover
// "the entire element from the opening `<script` tag through the closing
// `</script>` tag, inclusive", and section A.9.4 requires it to cover a comment line. In
// both cases the excluded range is markup plus base64, never raw store bytes. 2.4
// added the text bindings without reconciling them with section 15.12.1.1, so a third
// party implementing that clause literally will reject every section A.7/section A.9 file -
// ours and everyone else's - and be right by one reading. Our existing SVG carrier
// has the identical shape and c2patool accepts it, which is the only empirical
// answer available so far.
//
// THE LOLLY HTML-FRAGMENT PROFILE (`html-fragment`) is ours, not the spec's, and
// is labelled as such wherever it surfaces. A masthead/figure artifact is markup +
// script with no `<head>` element, so section A.7's method - "a `script` element … placed
// in the `head` of the HTML document" - has nowhere to go. section A.9.2 excludes
// `text/html` from structured text only because section A.7 already covers HTML
// DOCUMENTS, and the same clause explicitly admits XML-based formats "with XML
// comment syntax". So a fragment carries the section A.9 armour block in an HTML comment.
// The manifest is real C2PA and the binding is a real `c2pa.hash.data`; only the
// carrier convention is Lolly's. The signal a reader can key on is exactly this
// pair: an asset whose claim format is `text/html` carrying a section A.9 armour block
// instead of a section A.7 element. Never report it as section A.7 conformance.

/** section A.9.3 fixed ASCII-armour delimiters (modelled on OpenPGP, RFC 4880 section 6.2). */
const ARMOR_BEGIN = '-----BEGIN C2PA MANIFEST-----';
const ARMOR_END = '-----END C2PA MANIFEST-----';
/** section A.9.3.1's embedded reference form, RFC 2397. */
const C2PA_DATA_URI = 'data:application/c2pa;base64,';
/** section A.7.1.1's carrier. Written with no surrounding whitespace so the excluded
 *  range is exactly the element and nothing else. */
const C2PA_SCRIPT_OPEN = '<script type="application/c2pa">';
const C2PA_SCRIPT_CLOSE = '</script>';

// ── section A.7: HTML documents ──────────────────────────────────────────────────────

/** ASCII-case-insensitive tag-name match at `at`, followed by a name delimiter.
 *  Deliberately identical to the reader's `tagNameAt` (c2pa-extract.ts) so writer
 *  and validator agree on what counts as a tag. Bounds-safe: charCodeAt past the
 *  end is NaN, which matches nothing. */
function htmlTagNameAt(bin: string, at: number, name: string): boolean {
  for (let k = 0; k < name.length; k++) {
    if ((bin.charCodeAt(at + k) | 0x20) !== name.charCodeAt(k)) return false;
  }
  const d = bin.charCodeAt(at + name.length);
  return d === 0x20 || d === 0x09 || d === 0x0a || d === 0x0d || d === 0x0c || d === 0x2f || d === 0x3e;
}

/**
 * One past the `>` that closes an open tag whose attributes start at `from`, or
 * -1 when it never closes. Quote-aware - unlike the reader, which documents its
 * plain `indexOf('>')` as a known limit. The asymmetry is deliberate: a wrong
 * answer costs the reader a failed binding, but costs the WRITER a splice into
 * the middle of an attribute value, which corrupts the host. Each call scans
 * forward once and every caller stops the walk on -1, so this stays linear.
 */
function htmlTagEnd(bin: string, from: number): number {
  let q = '';
  for (let i = from; i < bin.length; i++) {
    const ch = bin[i]!;
    if (q) { if (ch === q) q = ''; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === '>') return i + 1;
  }
  return -1;
}

/**
 * section 13.2.5 of the HTML spec's raw-text elements (plus `title`, which is escapable
 * raw text): everything between their tags is TEXT, so a `<head` written inside
 * one is not a tag and must not attract the splice. Skipped in the same walk and
 * for the same reason comments are.
 */
const HTML_RAW_TEXT = ['script', 'style', 'textarea', 'title'] as const;

interface HtmlAnchors {
  /** One past `<head …>`'s `>`, or -1. */ head: number;
  /** One past `<html …>`'s `>`, or -1. */ html: number;
  /** One past `<!doctype html …>`'s `>`, or -1. */ doctype: number;
  headSelfClosed: boolean;
  htmlSelfClosed: boolean;
}

/**
 * Where a manifest element could go: the first `<head>`, else the first `<html>`,
 * else the doctype - in ONE linear walk that skips comments and stops at `<body`.
 *
 * Comments and RAW-TEXT ELEMENTS are both skipped here (a `<!-- <html> -->` in a
 * licence header, or a `var t = "<head>"` inside a `<script>`, must not attract
 * the splice), which is the opposite of the stripper below. That asymmetry is the
 * point: strip whatever the VALIDATOR would count, insert where a PARSER would
 * put it. Splicing into raw text costs twice - the host's own script or style is
 * corrupted (our `</script>` closes THEIR element early), and the manifest lands
 * outside the `head` where section A.7.1.1 requires it and section A.7.1.4 looks for it.
 */
function htmlAnchors(bin: string): HtmlAnchors {
  const a: HtmlAnchors = { head: -1, html: -1, doctype: -1, headSelfClosed: false, htmlSelfClosed: false };
  for (let at = bin.indexOf('<'); at >= 0; at = bin.indexOf('<', at + 1)) {
    if (bin.charCodeAt(at + 1) === 0x21 /* ! */) {
      if (bin.startsWith('<!--', at)) {
        const close = bin.indexOf('-->', at + 4);
        // An unterminated comment swallows the rest of the file, exactly as a
        // parser reads it - there is nothing left to anchor to.
        if (close < 0) break;
        at = close + 2;
        continue;
      }
      if (a.doctype < 0 && /^doctype\s+html\b/i.test(bin.slice(at + 2, at + 16))) {
        const end = htmlTagEnd(bin, at + 2);
        if (end < 0) break;
        a.doctype = end;
        at = end - 1;
      }
      continue;
    }
    // A real `<body>` ends the head region: a `<head>` found after it is not one.
    if (htmlTagNameAt(bin, at + 1, 'body')) break;
    // Raw text: jump the whole element. An unterminated one swallows the rest of
    // the file exactly as a parser reads it, so there is nothing left to anchor to.
    const raw = HTML_RAW_TEXT.find((n) => htmlTagNameAt(bin, at + 1, n));
    if (raw) {
      const open = htmlTagEnd(bin, at + 1 + raw.length);
      if (open < 0) break;
      const close = findHtmlCloseTag(bin, raw, open);
      if (close < 0) break;
      at = close - 1;
      continue;
    }
    const isHead = htmlTagNameAt(bin, at + 1, 'head');
    if (!isHead && !htmlTagNameAt(bin, at + 1, 'html')) continue;
    const end = htmlTagEnd(bin, at + 1 + 4);
    if (end < 0) break;
    if (isHead) { a.head = end; a.headSelfClosed = bin[end - 2] === '/'; break; }
    if (a.html < 0) { a.html = end; a.htmlSelfClosed = bin[end - 2] === '/'; }
    at = end - 1;
  }
  return a;
}

const MAX_HTML_ATTRS = 64;
/** The reader's attribute grammar, verbatim (c2pa-extract.ts `htmlAttrs`): first
 *  occurrence wins, a Map so an attribute named `__proto__` is a key and not a
 *  prototype write, and the zero-length-match nudge that keeps `exec` advancing. */
function htmlAttrValues(src: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]*)))?/g;
  for (let m: RegExpExecArray | null; (m = re.exec(src)) !== null; ) {
    if (!m[0]) { re.lastIndex++; continue; }
    const key = m[1]!.toLowerCase();
    if (!attrs.has(key)) attrs.set(key, m[2] ?? m[3] ?? m[4] ?? '');
    if (attrs.size >= MAX_HTML_ATTRS) break;
  }
  return attrs;
}

/** One past the `>` of the first `</name…>` at or after `from`, or -1. */
function findHtmlCloseTag(bin: string, name: string, from: number): number {
  for (let at = bin.indexOf('</', from); at >= 0; at = bin.indexOf('</', at + 2)) {
    if (!htmlTagNameAt(bin, at + 2, name)) continue;
    const gt = bin.indexOf('>', at + 2 + name.length);
    return gt < 0 ? -1 : gt + 1;
  }
  return -1;
}

/**
 * Remove every C2PA association the host already carries - `<script
 * type="application/c2pa">` elements AND `<link rel="c2pa-manifest">` tags, since
 * section A.7.1 forbids a document from holding "both a script element and a link
 * element referencing a C2PA Manifest Store". Re-placing is therefore replace,
 * not append, and placing twice with the same manifest is byte-identical.
 *
 * NOT comment-aware, on purpose: the reader counts a carrier inside an HTML
 * comment as an association (its `scanHtmlTags` does not mask comments either),
 * so leaving one behind would produce a document the validator refuses with
 * manifest.html.multipleManifests. Stripping what the validator counts is the
 * only way to guarantee the file we hand back has exactly one association.
 *
 * Linear: the tag walk only moves forward, and the one scan that can run to EOF
 * (`htmlTagEnd` on a tag that never closes) ends the walk.
 */
function stripHtmlC2paCarriers(bin: string): string {
  let out = '';
  let copied = 0;
  for (let at = bin.indexOf('<'); at >= 0; at = bin.indexOf('<', at + 1)) {
    const isScript = htmlTagNameAt(bin, at + 1, 'script');
    if (!isScript && !htmlTagNameAt(bin, at + 1, 'link')) continue;
    const name = isScript ? 'script' : 'link';
    const end = htmlTagEnd(bin, at + 1 + name.length);
    if (end < 0) break;
    const attrs = htmlAttrValues(bin.slice(at + 1 + name.length, end - 1));
    let cutEnd = -1;
    if (isScript) {
      if ((attrs.get('type') ?? '').trim().toLowerCase() === 'application/c2pa') {
        cutEnd = findHtmlCloseTag(bin, 'script', end);
        // section A.7.1.4 reads this document as truncated; a writer that guessed where
        // the element ended would either destroy content or leave a second
        // association behind. Refuse, and say which.
        if (cutEnd < 0) throw new Error('C2PA embed: the HTML host has an unterminated <script type="application/c2pa"> element - it looks truncated');
      }
    } else if ((attrs.get('rel') ?? '').trim().toLowerCase().split(/\s+/).includes('c2pa-manifest')) {
      cutEnd = end;
    }
    if (cutEnd < 0) { at = end - 1; continue; }
    out += bin.slice(copied, at);
    copied = cutEnd;
    at = cutEnd - 1;
  }
  return copied ? out + bin.slice(copied) : bin;
}

/**
 * section A.7.1.1: the C2PA Manifest Store, base64 (RFC 4648 section 4), as the content of a
 * `<script type="application/c2pa">` in the document's `head`. section A.7.1.3: ONE
 * exclusion covering the entire element, `<script` through `</script>` inclusive.
 *
 * Insertion is immediately after the `<head …>` open tag, with no added
 * whitespace, so the excluded range is exactly the element. A document that only
 * IMPLIES a head (`<html>` or a bare doctype and no `<head>` tag) gets a real
 * `<head></head>` synthesised around the element, so the validator's section A.7.1.4
 * step 1 - "parse the head element" - finds it where the spec says to look.
 */
function placeHtml(html: Uint8Array, manifest: Uint8Array): PlaceResult {
  const bin = stripHtmlC2paCarriers(bytesToBin(html));
  const a = htmlAnchors(bin);
  let at = a.head;
  let before = '';
  let after = '';
  if (at < 0) {
    if (a.html >= 0 && a.htmlSelfClosed) throw new Error('C2PA embed: self-closing <html/> cannot hold a manifest');
    at = a.html >= 0 ? a.html : a.doctype;
    if (at < 0) throw new Error('C2PA embed: not an HTML document (no <head>, <html> or <!doctype html>)');
    before = '<head>';
    after = '</head>';
  } else if (a.headSelfClosed) {
    throw new Error('C2PA embed: self-closing <head/> cannot hold a manifest');
  }
  // base64: standard alphabet with padding, one unbroken run (as placeSvg). The
  // alphabet has no '-' and no '<', so neither the section A.9 delimiters nor a closing
  // tag can ever appear inside a payload.
  const element = C2PA_SCRIPT_OPEN + btoa(bytesToBin(manifest)) + C2PA_SCRIPT_CLOSE;
  return {
    out: binToBytes(bin.slice(0, at) + before + element + after + bin.slice(at)),
    exclusions: [{ start: at + before.length, length: element.length }],
  };
}

// ── section A.9: structured text ─────────────────────────────────────────────────────

/** The host's comment syntax around the single-line manifest block (section A.9.3.1). */
interface ArmorSyntax { prefix: string; suffix: string; label: string }

const ARMOR_SYNTAX: Record<'js' | 'css' | 'md' | 'html-fragment', ArmorSyntax> = {
  // JavaScript uses the PRESERVATION-HINT comment, not `//`. section A.9.3.1's example
  // table shows `//` for JavaScript, but the same clause's normative sentence is
  // "When host formats define comment conventions that signal toolchains to
  // preserve specific comments (e.g., comments beginning with /*! in JavaScript
  // AND CSS), claim generators should use them for the reference line." The
  // example is illustrative; the SHOULD is aimed at exactly this pair, and the
  // failure it exists to prevent is real - every minifier that honours `/*!`
  // drops `//`, so a signed .js would lose its credential the first time it went
  // through a build. CSS already complied, which left the file inconsistent with
  // itself. Safe because the base64 alphabet contains no `*` or `/`, so `*/`
  // cannot occur inside the payload (the CSS placer already relies on that).
  js: { prefix: '/*! ', suffix: ' */', label: 'JavaScript file' },
  css: { prefix: '/*! ', suffix: ' */', label: 'CSS file' },
  md: { prefix: '<!-- ', suffix: ' -->', label: 'Markdown file' },
  'html-fragment': { prefix: '<!-- ', suffix: ' -->', label: 'HTML fragment' },
};

/** Up to `cap` occurrences of `needle`. Capped because the only question section A.9.3
 *  asks is "zero, one, or more than one", and an uncapped scan of a hostile file
 *  full of delimiters is work for nothing. */
function armorIndices(bin: string, needle: string, cap: number): number[] {
  const out: number[] = [];
  for (let at = bin.indexOf(needle); at >= 0 && out.length < cap; at = bin.indexOf(needle, at + needle.length)) out.push(at);
  return out;
}

/** section A.9.3.1's two reference forms: a `data:` URI or a URL. Used only to tell a
 *  real manifest block apart from prose that quotes the delimiters. */
const isManifestReference = (ref: string): boolean =>
  /^data:/i.test(ref) || /^https?:\/\//i.test(ref) || ref.startsWith('/') || ref.startsWith('./') || ref.startsWith('../');

/** section A.9.3.1's own list of comment introducers (hash, slash-slash, slash-star,
 *  double-dash, semicolon, percent, HTML open) and their terminators (star-slash,
 *  HTML close), plus the slash-star-bang preservation hint the same clause
 *  recommends. Used ONLY to tell a line that IS a manifest block from
 *  a line of prose that happens to quote the delimiters - never to decide what to
 *  write. The empty alternative covers section A.9.3.2's front-matter form, where the
 *  delimiters sit on a bare line. */
const ARMOR_COMMENT_OPEN = /^[ \t]*(?:\/\/!?|\/\*!?|<!--|--|#|;|%|')?[ \t]*$/;
const ARMOR_COMMENT_CLOSE = /^[ \t]*(?:\*\/|-->)?[ \t]*$/;

/**
 * Remove the host's existing manifest block, so re-placing replaces (and is
 * idempotent) instead of producing the two blocks section A.9.3 forbids.
 *
 * Removes the block's whole LINE - the same span section A.9.4 calls the manifest block
 * - which for our own output restores the host byte-for-byte.
 *
 * DELETING HOST CONTENT IS NOT A TRADE A WRITER GETS TO MAKE, so this strips only
 * a line that is a manifest block *where section A.9.3.1 allows one to be*, and refuses
 * everything else rather than guessing:
 *
 *   - more than one delimiter of either kind, or an END before its BEGIN -
 *     section A.9.3 already makes that file unreadable, and picking one to keep would be
 *     a guess about which;
 *   - a pair that is NOT on the file's first or last line - section A.9.3.1 puts the
 *     block at the start of the file, or at the end when line 1 is reserved, and
 *     nowhere else, so a pair in the middle is prose (a spec digest, this repo's
 *     own plans and briefs);
 *   - a pair whose line carries anything but comment syntax around it - same
 *     reason, one level finer: a delimiter quoted inside a sentence or a `<pre>`
 *     is not a comment line;
 *   - a pair whose content is not a manifest reference at all.
 *
 * The narrowness is what makes this a true inverse of {@link placeArmor}: the
 * only lines it can remove are lines that placer could have written. Before this,
 * ANY well-formed pair around reference-shaped text was deleted wherever it sat -
 * so a document that merely DOCUMENTED the armour form (this wave's own brief
 * did) lost the line its author wrote, silently, under a valid signature, with
 * the deletion outside every exclusion where no reader could ever notice.
 */
function stripArmorBlock(bin: string, label: string): string {
  const begins = armorIndices(bin, ARMOR_BEGIN, 2);
  const ends = armorIndices(bin, ARMOR_END, 2);
  if (!begins.length && !ends.length) return bin;
  const begin = begins[0]!;
  const end = ends[0]!;
  if (begins.length !== 1 || ends.length !== 1 || end < begin + ARMOR_BEGIN.length) {
    throw new Error(`C2PA embed: this ${label} already carries more than one - or a malformed - C2PA manifest block (section A.9.3 allows at most one)`);
  }
  const refuse = (what: string): never => {
    throw new Error(`C2PA embed: this ${label} quotes the section A.9 armour delimiters ${what} - refusing to delete it, and a second block would make the file unreadable`);
  };
  const lineStart = bin.lastIndexOf('\n', begin) + 1;
  const nl = bin.indexOf('\n', end);
  const lineEnd = nl < 0 ? bin.length : nl + 1;
  // "At the end" the way section A.9.4 and the reader's own armorExclusion mean it: the
  // block's line is the last one that carries anything.
  if (lineStart !== 0 && bin.slice(lineEnd).trim()) refuse('in the middle of the file, where section A.9.3.1 never places a manifest block');
  if (!ARMOR_COMMENT_OPEN.test(bin.slice(lineStart, begin))
    || !ARMOR_COMMENT_CLOSE.test(bin.slice(end + ARMOR_END.length, lineEnd).replace(/\r?\n$/, ''))) {
    refuse('inside a line that is not a comment');
  }
  if (!isManifestReference(bin.slice(begin + ARMOR_BEGIN.length, end).trim())) {
    refuse('around something that is not a manifest reference');
  }
  return bin.slice(0, lineStart) + bin.slice(lineEnd);
}

/**
 * section A.9.3.1 single-line form at the end of the file, section A.9.4 hard binding:
 *
 *     <prefix> -----BEGIN C2PA MANIFEST----- data:application/c2pa;base64,… -----END C2PA MANIFEST----- <suffix>
 *
 * with ONE exclusion "from the byte offset of the newline character preceding the
 * manifest block" to end of file. That newline is guaranteed: when the host does
 * not already end with one, the placer adds it, and it is inside the exclusion
 * either way, so the host's own bytes are bound exactly as they arrived.
 *
 * section A.9.4 on line terminators: LF or CRLF only, and "a claim generator shall not
 * alter the line ending convention of the file content outside the manifest
 * block". Nothing here rewrites the host, and the terminator this placer
 * INTRODUCES follows the host - CRLF only when every newline in the host is
 * already CRLF, so a mixed file gets LF rather than a third convention. A host
 * with bare-CR line endings is refused: section A.9.4 says such files "shall be
 * converted to LF or CRLF before embedding", and converting them here would be
 * exactly the alteration the same clause forbids.
 */
function placeArmor(bytes: Uint8Array, manifest: Uint8Array, syntax: ArmorSyntax): PlaceResult {
  const bin = bytesToBin(bytes);
  if (/\r(?!\n)/.test(bin)) {
    throw new Error(`C2PA embed: this ${syntax.label} uses bare CR line endings, which section A.9.4 does not support - convert it to LF or CRLF first`);
  }
  const base = stripArmorBlock(bin, syntax.label);
  // An empty host would put the block at BOTH the start and the end of the file,
  // which is section A.9.4's "the file contains only the manifest block" case: exclusion
  // {0, whole file}, i.e. a hard binding whose hash covers no content at all and
  // therefore matches every other such file. Refuse rather than mint one.
  if (!base.trim()) {
    throw new Error(`C2PA embed: refusing to place a manifest block in an empty ${syntax.label} - the exclusion would cover the whole file and the hard binding would bind nothing`);
  }
  const eol = bin.includes('\r\n') && !/(^|[^\r])\n/.test(bin) ? '\r\n' : '\n';
  // Whether the terminator before the block is the HOST's or one this placer had
  // to add decides where the exclusion starts (below).
  const introduced = !base.endsWith('\n');
  const head = introduced ? base + eol : base;
  const block = `${syntax.prefix}${ARMOR_BEGIN} ${C2PA_DATA_URI}${btoa(bytesToBin(manifest))} ${ARMOR_END}${syntax.suffix}`;
  const out = head + block + eol;
  // section A.9.4: "start: byte offset of the newline character preceding the manifest
  // block". When that newline is the host's own, this is head.length - 1 - the LF
  // on a CRLF host, leaving the host's CR hashed, which is spec-literal and the
  // reading our reader returns as primary.
  //
  // When the placer INTRODUCED the terminator, the whole terminator is part of
  // what the writer added, so the exclusion starts at its FIRST byte. Otherwise a
  // CRLF host with no trailing newline gets a bare CR inside the hashed content -
  // a byte the host never had, in the one convention section A.9.4 declares unsupported,
  // and outside every exclusion where nothing downstream could see it. The reader
  // offers the CR reading as an equally-valid alternate (armorExclusion), so both
  // stay conformant.
  const start = head.length - (introduced ? eol.length : 1);
  return { out: binToBytes(out), exclusions: [{ start, length: out.length - start }] };
}

/**
 * Remove the armour line {@link placeArmor} wrote, or return the text UNCHANGED.
 * The inverse of that placer, exported because two places outside the engine have
 * to undo it: the docs bank's lint (which reads an artifact's source, not its
 * base64) and the docs build's presentation copy (an inlined artifact must not
 * carry a credential whose binding covers a file, not a DOM). Two hand-written
 * copies of this rule had already drifted apart, and each was looser than the
 * placer, so both cut host content the placer never added. This function is now
 * the one owner of the rule, next to the writer it inverts.
 *
 * Removes ONLY what this placer could have written: a single-line block, on the
 * file's last line, with comment syntax around it and a real manifest reference
 * between the delimiters. Anything else - prose quoting the delimiters, a block
 * spanning lines, a second pair - is left exactly where it is, for the caller to
 * refuse. Unlike {@link stripArmorBlock} (which is about to write a second block,
 * so ambiguity is fatal), this one never throws: its callers have their own
 * policy for text they cannot account for.
 *
 * NOT byte-exact in one case, by construction: when the placer had to INTRODUCE
 * the terminator before the block (a host that did not end in a newline), that
 * terminator is indistinguishable from the host's own afterwards, so
 * `strip(place(x))` is `x` plus one line ending. Bank artifacts are
 * newline-terminated text files, where the identity holds byte-for-byte.
 */
export function stripPlacedArmorLine(text: string): string {
  const begin = text.indexOf(ARMOR_BEGIN);
  if (begin < 0) return text;
  if (text.indexOf(ARMOR_BEGIN, begin + ARMOR_BEGIN.length) >= 0) return text;
  const end = text.indexOf(ARMOR_END, begin + ARMOR_BEGIN.length);
  if (end < 0 || text.indexOf(ARMOR_END, end + ARMOR_END.length) >= 0) return text;
  if (text.slice(begin, end).includes('\n')) return text;
  const lineStart = text.lastIndexOf('\n', begin) + 1;
  const nl = text.indexOf('\n', end);
  const lineEnd = nl < 0 ? text.length : nl + 1;
  if (text.slice(lineEnd).trim()) return text;
  if (!ARMOR_COMMENT_OPEN.test(text.slice(lineStart, begin))) return text;
  if (!ARMOR_COMMENT_CLOSE.test(text.slice(end + ARMOR_END.length, lineEnd).replace(/\r?\n$/, ''))) return text;
  if (!isManifestReference(text.slice(begin + ARMOR_BEGIN.length, end).trim())) return text;
  return text.slice(0, lineStart) + text.slice(lineEnd);
}

/** The Lolly HTML-fragment profile's registered ids, for the surfaces that have
 *  to name it honestly (it is Lolly's carrier convention, not section A.7 conformance -
 *  see the block comment above). */
export const C2PA_FRAGMENT_PROFILE = Object.freeze({ format: 'html-fragment', mime: 'text/html' });

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
  // AVIF is ISO BMFF too (a still or sequence of AV1 frames). It uses the SAME
  // c2pa.hash.bmff.v2 binding as MP4, via the format-agnostic placeMp4 (append the
  // C2PA box last, so nothing before it moves and the meta/iloc offsets into mdat
  // stay valid). This is the placement the C2PA spec defines for the credential,
  // so an AI/upscaled AVIF keeps its provenance instead of losing it on export.
  avif: { place: placeMp4, mime: 'image/avif', hash: 'bmff' },
  // M4A (AAC audio) is ISO BMFF too - same placeMp4 + bmff binding as MP4/AVIF. This
  // is how a synthetic/AI voice clip (the Voice Recorder, TTS, Audiogram) keeps a
  // verifiable credential instead of shipping unattributed.
  m4a: { place: placeMp4, mime: 'audio/mp4', hash: 'bmff' },
  webm: { place: placeWebm, mime: 'video/webm' },
  mp3: { place: placeMp3, mime: 'audio/mpeg' },
  wav: { place: placeWav, mime: 'audio/wav' },
  // Ogg Opus - the JUMBF store lives in the OpusTags comment header, byte-range
  // excluded (Lolly-only binding; c2pa-rs has no Ogg reader). 'opus' and 'ogg'
  // are the same container; both map to the export/asset format strings in use.
  ogg: { place: placeOgg, mime: 'audio/ogg' },
  opus: { place: placeOgg, mime: 'audio/ogg' },
  // C2PA 2.4 text bindings. `html` is the section A.7 inline form (a whole HTML
  // DOCUMENT); js/css/md are section A.9 structured text; `html-fragment` is the Lolly
  // profile - section A.9's armour in an HTML comment, for markup that has no `<head>`
  // for section A.7 to use. See the block comment above the placers.
  html: { place: placeHtml, mime: 'text/html' },
  js: { place: (b, m) => placeArmor(b, m, ARMOR_SYNTAX.js), mime: 'text/javascript' },
  css: { place: (b, m) => placeArmor(b, m, ARMOR_SYNTAX.css), mime: 'text/css' },
  md: { place: (b, m) => placeArmor(b, m, ARMOR_SYNTAX.md), mime: 'text/markdown' },
  'html-fragment': { place: (b, m) => placeArmor(b, m, ARMOR_SYNTAX['html-fragment']), mime: C2PA_FRAGMENT_PROFILE.mime },
  // FLAC - the JUMBF store rides in an APPLICATION metadata block (id 'C2PA'),
  // byte-range excluded (Lolly-only binding; c2pa-rs has no FLAC reader; see placeFlac).
  // Appended LAST on purpose: C2PA_FORMATS is an append-only slot contract (shells key
  // export slots off its order), so it joins the end rather than beside the audio group.
  flac: { place: placeFlac, mime: 'audio/flac' },
};

/** Formats embedC2pa can stamp (plus 'pdf'/'pdf-cmyk' via embedC2paInPdf). */
export const C2PA_FORMATS = Object.freeze(['pdf', 'pdf-cmyk', ...Object.keys(CONTAINERS)]);

/**
 * Re-attach an ALREADY-BUILT C2PA manifest store (verbatim JUMBF, as returned by
 * extractC2paStore) back into a container, WITHOUT rebuilding or re-signing it. Used to
 * make a captured Content Credential inspectable again after ingest re-encoded the file
 * and dropped the in-file manifest (the raw store is preserved separately). The store's
 * hard binding still references the ORIGINAL bytes, so a verifier will correctly report
 * the file as modified if `bytes` differ from what was signed - but the manifest's claims
 * (AI-generated flag, signer identity, action history) read intact. Returns the container
 * bytes with the store embedded. No signing, no hashing - a pure re-insertion.
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
 * - signer as documented on buildC2paManifest (external CA-issued credential;
 * the ephemeral self-signed one is generated when absent).
 */
export async function embedC2pa(bytes: Uint8Array, format: string, opts: EmbedOptions = {}): Promise<Uint8Array> {
  if (!(bytes instanceof Uint8Array)) throw new Error('C2PA embed: bytes must be a Uint8Array');
  const fmt = String(format || '').toLowerCase();
  if (fmt === 'pdf' || fmt === 'pdf-cmyk') return embedC2paInPdf(bytes, opts);
  const container = CONTAINERS[fmt];
  if (!container) throw new Error(`C2PA embed: no embedding for format '${format}'`);
  const isBmff = container.hash === 'bmff';

  const { title, claimGenerator, generatorInfo, environment, author, authorship, rights, actions, ingredients, aiDisclosure, specVersion, dates = {}, signer } = opts;
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
    title, claimGenerator, generatorInfo, environment, author, authorship, rights, actions, ingredients, aiDisclosure, specVersion, dates, format: container.mime,
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

  // Hash the placed output with the manifest's home OMITTED - by byte range
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
  // LENGTH - so the digest computed against the placeholder must still be the
  // digest of the final file. Verify rather than trust.
  const check = await digestOf(final.out);
  for (let i = 0; i < 32; i++) {
    if (check[i] !== digest[i]) throw new Error('C2PA embed: container placement is not content-independent');
  }
  return final.out;
}
