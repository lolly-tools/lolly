// SPDX-License-Identifier: MPL-2.0
/**
 * Fuzz targets: the engine's untrusted-input parsers, each with a small seed
 * corpus of VALID inputs (built from the engine's own writers / real container
 * layouts) and an async invoke() that feeds one mutated buffer through the
 * parser. invoke() MUST NOT swallow errors — the runner's try/catch classifies
 * them (a thrown validation Error is the desired behaviour; a hang or an
 * allocation blow-up is a finding).
 *
 * Entry points (verified against the modules + existing tests):
 *   - c2pa-verify   : verifyC2pa(bytes)                     — top-level verifier
 *   - cbor          : decodeCbor(bytes)                     — the claim decoder, hit directly
 *   - media-sniff   : sniffAnimatedRaster + sniffVideoContainer
 *   - pdf-map       : interpretPdfPage(page) + parseToUnicode(str)
 *   - x509          : parseCertificate(der)                 — the DER/X.509 cert parser
 *   - file-metadata : extractFileMetadata(bytes)            — the /verify metadata reveal
 *   - strip-metadata: stripMetadata(bytes, fmt)             — the clean-copy byte surgery
 *   - video-meta    : embedMp4Meta / embedWebmMeta          — container walkers (shared with the c2pa read side)
 *   - data-import   : parseDataRows(text)                   — CSV/JSON → blocks rows
 *   - pptx-read     : readPptx(parts, parseXml) + isPptx    — the .pptx part-map reader
 *   - pptx-patch    : rebrandPptxParts(parts, plan)         — the surgical .pptx rebrand
 *   - pptx-bridge   : createPptxAPI().inspect(bytes)        — the web bridge's capped unzip + inspect end-to-end
 */

import { embedC2paInPdf, embedC2pa, encodeCbor } from '../../engine/src/c2pa.ts';
import { generateSigner, generateCaRoot, issueLeafCert } from '../../engine/src/x509.ts';
import { verifyC2pa, parseCertificate, decodeCbor } from '../../engine/src/c2pa-verify.ts';
import { sniffAnimatedRaster, sniffVideoContainer } from '../../engine/src/media-sniff.ts';
import { interpretPdfPage, parseToUnicode } from '../../engine/src/pdf-map.ts';
import { extractFileMetadata } from '../../engine/src/file-metadata.ts';
import { stripMetadata, type StripFormat } from '../../engine/src/strip-metadata.ts';
import { embedMp4Meta, embedWebmMeta, videoProvenanceTags } from '../../engine/src/video-meta.ts';
import { parseDataRows } from '../../engine/src/data-import.ts';
import { packTiff } from '../../engine/src/tiff.ts';
import { isPptx, readPptx, type PptxParts } from '../../engine/src/pptx-read.ts';
import { rebrandPptxParts, type PartMap, type RebrandPlan } from '../../engine/src/pptx-patch.ts';
import { createPptxAPI, looksLikePptxFile } from '../../shells/web/src/bridge/pptx.ts';
import { zipSync } from 'fflate';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

export interface FuzzTarget {
  name: string;
  /** Build the valid seed corpus (async — some seeds come from the signer). */
  seeds(): Promise<Uint8Array[]>;
  /** Feed one buffer through the parser. Throwing is fine; hanging/alloc is not. */
  invoke(bytes: Uint8Array): Promise<void>;
}

const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const u32be = (n: number): Uint8Array => Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
const u32le = (n: number): Uint8Array => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);

// ── minimal real containers (mirroring tests/c2pa-formats.test.ts) ────────────

const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Uint8Array): number => { let c = 0xffffffff; for (const x of b) c = CRC_T[(c ^ x) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const pngChunk = (type: string, data: Uint8Array): Uint8Array => {
  const td = concat([bytesOf(type), data]);
  return concat([u32be(data.length), td, u32be(crc32(td))]);
};
function tinyPng(): Uint8Array {
  const ihdr = Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0);
  const idat = Uint8Array.of(0x78, 0x01, 0x01, 0x02, 0x00, 0xfd, 0xff, 0x00, 0x7b, 0x00, 0x7c, 0x00, 0xf8);
  return concat([Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', new Uint8Array(0))]);
}
function tinyJpeg(): Uint8Array {
  const app0 = concat([Uint8Array.of(0xff, 0xe0, 0x00, 0x10), bytesOf('JFIF\0'), Uint8Array.of(1, 1, 0, 0, 1, 0, 1, 0, 0)]);
  return concat([Uint8Array.of(0xff, 0xd8), app0, Uint8Array.of(0xff, 0xd9)]);
}
function tinyGif(frames = 1): Uint8Array {
  const out: number[] = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0x00, 0, 0];
  for (let i = 0; i < frames; i++) out.push(0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x00, 0x02, 0x01, 0x00, 0x00);
  out.push(0x3b);
  return Uint8Array.from(out);
}
const tinySvg = (): Uint8Array => bytesOf('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#30ba78"/></svg>');
function tinyWebp(): Uint8Array {
  const vp8 = concat([bytesOf('VP8 '), u32le(2), Uint8Array.of(0, 0)]);
  const body = concat([bytesOf('WEBP'), vp8]);
  return concat([bytesOf('RIFF'), u32le(body.length), body]);
}
function animWebp(): Uint8Array {
  const vp8x = concat([bytesOf('VP8X'), u32le(10), Uint8Array.of(0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0)]);
  const body = concat([bytesOf('WEBP'), vp8x]);
  return concat([bytesOf('RIFF'), u32le(body.length), body]);
}
const mp4box = (type: string, ...parts: Uint8Array[]): Uint8Array => { const p = concat(parts); return concat([u32be(8 + p.length), bytesOf(type), p]); };
const tinyMp4 = (): Uint8Array => concat([
  mp4box('ftyp', bytesOf('isom'), u32be(0), bytesOf('isom'), bytesOf('mp42')),
  mp4box('moov', mp4box('mvhd', new Uint8Array(100))),
  mp4box('mdat', new Uint8Array(16)),
]);
const ebVint = (n: number): Uint8Array => { const out = new Uint8Array(4); out[0] = 0x10 | ((n >>> 24) & 0x0f); out[1] = (n >>> 16) & 0xff; out[2] = (n >>> 8) & 0xff; out[3] = n & 0xff; return out; };
const eb = (id: number[], payload: Uint8Array): Uint8Array => concat([Uint8Array.from(id), ebVint(payload.length), payload]);
const tinyWebm = (): Uint8Array => concat([
  Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3, 0x84), eb([0x42, 0x86], Uint8Array.of(1)),
  Uint8Array.of(0x18, 0x53, 0x80, 0x67), ebVint(8), eb([0x16, 0x54, 0xae, 0x6b], new Uint8Array(2)),
]);

function buildTestPdf(): Uint8Array {
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  const push = (s: string): void => { offsets.push(out.length); out += s; };
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n');
  const xrefOff = out.length;
  out += 'xref\n0 4\n0000000000 65535 f \n';
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`;
  return bytesOf(out);
}

// ── the targets ───────────────────────────────────────────────────────────────

export const c2paVerifyTarget: FuzzTarget = {
  name: 'c2pa-verify',
  async seeds() {
    const pdf = buildTestPdf();
    const stampedPdf = await embedC2paInPdf(pdf, { title: 'Fuzz', claimGenerator: 'LollyFuzz/1.0' });
    const out: Uint8Array[] = [stampedPdf, pdf, tinyPng(), tinyJpeg(), tinyGif(2), tinySvg(), tinyWebp(), tinyMp4(), tinyWebm()];
    // Credentialed rasters/video across formats exercise every extractor.
    for (const [bytes, fmt] of [[tinyPng(), 'png'], [tinyJpeg(), 'jpg'], [tinyGif(1), 'gif'], [tinySvg(), 'svg'], [tinyMp4(), 'mp4'], [tinyWebm(), 'webm']] as const) {
      try { out.push(await embedC2pa(bytes, fmt, { title: 'Fuzz', claimGenerator: 'LollyFuzz/1.0' })); } catch { /* format may be unsupported in this build */ }
    }
    return out;
  },
  async invoke(bytes) { await verifyC2pa(bytes); },
};

export const mediaSniffTarget: FuzzTarget = {
  name: 'media-sniff',
  async seeds() {
    return [tinyPng(), tinyGif(2), tinyGif(1), tinyWebp(), animWebp(), tinyMp4(), tinyWebm(), tinyJpeg()];
  },
  async invoke(bytes) {
    sniffAnimatedRaster(bytes, { mime: 'image/png', name: 'x.png' });
    sniffAnimatedRaster(bytes, { mime: 'image/webp', name: 'x.webp' });
    sniffAnimatedRaster(bytes, {});
    sniffVideoContainer(bytes);
  },
};

const PDF_CONTENT_SEEDS: string[] = [
  '0.2 0.7 0.5 rg 40 200 120 60 re f',
  '0 0 0 rg 10 10 m 10 60 l 110 60 l 110 10 l h f',
  '0.866 0.5 -0.5 0.866 0 0 cm 0 0 100 40 re f',
  'BT /F1 12 Tf 40 700 Td (Hello world) Tj ET',
  'q 1 0 0 1 40 200 cm 0 0 60 60 re f Q',
  '/OC /MC0 BDC 0 0 0 rg 5 5 20 20 re f EMC',
  '[(Kern) -200 (ed) 300 (text)] TJ',
  '0.1 0.2 0.3 0.4 k 0 0 10 10 re B',
];
const TOUNICODE_SEED = 'begincmap\nbeginbfchar\n<0041> <0041>\n<0042> <0042>\nendbfchar\nbeginbfrange\n<0043> <0045> <0043>\n<0046> <0048> [<0046> <0047> <0048>]\nendbfrange\nendcmap';
// A wide-code (8 hex digit) variant so byte mutations can reach the range-span
// blow-up class the parser must clamp (a hostile CMap driving a giant loop).
const TOUNICODE_WIDE_SEED = 'begincmap\nbeginbfrange\n<00000010> <00000020> <0041>\n<00010000> <00010005> [<0041> <0042> <0043> <0044> <0045> <0046>]\nendbfrange\nendcmap';

export const pdfMapTarget: FuzzTarget = {
  name: 'pdf-map',
  async seeds() {
    return [...PDF_CONTENT_SEEDS.map(bytesOf), bytesOf(TOUNICODE_SEED), bytesOf(TOUNICODE_WIDE_SEED)];
  },
  async invoke(bytes) {
    // Byte-transparent latin1 view — the shell hands the interpreter a decoded
    // content string; binary bytes survive as char codes.
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
    interpretPdfPage({ content: s, width: 400, height: 300 });
    parseToUnicode(s);
  },
};

export const x509Target: FuzzTarget = {
  name: 'x509',
  async seeds() {
    const out: Uint8Array[] = [];
    const signer = await generateSigner();
    out.push(signer.certDer);
    const root = await generateCaRoot();
    out.push(root.certDer);
    // A real leaf, using the signer's SPKI (pulled back out is overkill — the
    // signer cert IS a full v3 cert, enough shape for the DER walker).
    const leaf = await issueLeafCert({ caCertDer: root.certDer, caPrivateKey: root.pkcs8Der, spkiDer: signer.certDer.slice(0), email: 'a@b.co' })
      .catch(() => null);
    if (leaf) out.push(leaf);
    return out;
  },
  async invoke(bytes) {
    // The read-side X.509 certificate parser (shared DER walker); this is the
    // parser that eats every x5chain cert out of an attacker-controlled file.
    parseCertificate(bytes);
  },
};

export const cborTarget: FuzzTarget = {
  name: 'cbor',
  async seeds() {
    // The writer's own encodings of realistic claim shapes — every major type,
    // nesting, and both string kinds — so mutation reaches the decoder's paths.
    return [
      encodeCbor({ 'dc:title': 'Fuzz', alg: 'sha256', assertions: [{ url: 'self#jumbf=c2pa.assertions/c2pa.hash.data', hash: new Uint8Array(32) }] }),
      encodeCbor([1, -5, 42, true, null, 'text', { nested: [{ deeper: 'x' }] }]),
      encodeCbor(new Map<unknown, unknown>([['actions', [{ action: 'c2pa.created' }]], [1, 2]])),
      encodeCbor('plain string'),
      encodeCbor(1234567890123),
      // Half/single/double floats the decoder must read (0xf9/0xfa/0xfb) — the
      // writer can't emit them, so hand-author the three heads.
      Uint8Array.from([0xf9, 0x3c, 0x00]),                                     // half 1.0
      Uint8Array.from([0xfa, 0x40, 0x49, 0x0f, 0xdb]),                          // single ~π
      Uint8Array.from([0xfb, 0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),  // double 1.0
    ];
  },
  async invoke(bytes) { decodeCbor(bytes); },
};

export const fileMetadataTarget: FuzzTarget = {
  name: 'file-metadata',
  async seeds() {
    const tiff = packTiff(new Uint8Array(3), { width: 1, height: 1, meta: { software: 'LollyFuzz', author: 'Fuzz' }, description: 'seed' });
    const pngWithText = concat([
      Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
      pngChunk('IHDR', Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0)),
      pngChunk('tEXt', bytesOf('Software\0LollyFuzz')),
      pngChunk('iTXt', bytesOf('Comment\0\0\0en\0\0hello')),
      pngChunk('IEND', new Uint8Array(0)),
    ]);
    return [tinyJpeg(), tinyPng(), pngWithText, tinyWebp(), tinySvg(), tiff, tinyGif(1)];
  },
  // Contract: never throws, never hangs — a malformed block yields fewer fields.
  async invoke(bytes) { extractFileMetadata(bytes); },
};

export const stripMetadataTarget: FuzzTarget = {
  name: 'strip-metadata',
  async seeds() {
    return [tinyJpeg(), tinyPng(), tinySvg()];
  },
  async invoke(bytes) {
    for (const fmt of ['jpeg', 'png', 'svg'] as StripFormat[]) stripMetadata(bytes, fmt);
  },
};

// A fast-start MP4 (moov before mdat) whose moov carries a real trak▸…▸stbl▸stco,
// so mutations reach the chunk-offset patcher — the loop that must clamp a forged
// entry count to what the box physically holds.
function faststartMp4(): Uint8Array {
  const stco = mp4box('stco', u32be(0) /* version/flags */, u32be(2) /* count */, u32be(64), u32be(128));
  const stbl = mp4box('stbl', stco);
  const minf = mp4box('minf', stbl);
  const mdia = mp4box('mdia', minf);
  const trak = mp4box('trak', mdia);
  return concat([
    mp4box('ftyp', bytesOf('isom'), u32be(0), bytesOf('isom'), bytesOf('mp42')),
    mp4box('moov', mp4box('mvhd', new Uint8Array(100)), trak),
    mp4box('mdat', new Uint8Array(64)),
  ]);
}

export const videoMetaTarget: FuzzTarget = {
  name: 'video-meta',
  async seeds() {
    return [tinyMp4(), faststartMp4(), tinyWebm()];
  },
  async invoke(bytes) {
    // Fixed date so the tag bytes are deterministic across runs.
    const tags = videoProvenanceTags({ tool: 'Fuzz', software: 'LollyFuzz' }, new Date(0));
    embedMp4Meta(bytes, tags);
    embedWebmMeta(bytes, tags);
  },
};

const DATA_IMPORT_FIELDS = [{ id: 'name' }, { id: 'value', type: 'number' }, { id: 'on', type: 'boolean' }];
const DATA_IMPORT_SEEDS = [
  'name,value,on\nalpha,1,yes\nbeta,2,no\n"quoted, cell",3,true',
  '[{"name":"a","value":1,"on":true},{"name":"b","value":2}]',
  '{"data":[["a",1],["b",2]]}',
];

export const dataImportTarget: FuzzTarget = {
  name: 'data-import',
  async seeds() {
    return DATA_IMPORT_SEEDS.map((s) => new TextEncoder().encode(s));
  },
  async invoke(bytes) {
    // The shell reads the file to text; junk bytes arrive as replacement chars.
    // "No usable rows" & friends are controlled throws — fine by the runner.
    parseDataRows(new TextDecoder('utf-8').decode(bytes), { fields: DATA_IMPORT_FIELDS });
  },
};

// ── pptx fixtures (mirroring tests/pptx-read.test.ts + tests/pptx-patch.test.ts;
//    each seed stays small — mutants past 64 KB escape the hang assertion) ─────

// jsdom stands in for the shell's native DOMParser — built ONCE at module scope
// (a JSDOM window is far too expensive to build per invoke).
const jsdomWin = new JSDOM('').window;
const jsdomParser = new jsdomWin.DOMParser();
const parseXml = (xml: string): Document => jsdomParser.parseFromString(xml, 'application/xml') as unknown as Document;

const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const READ_PRESENTATION = `${XML_DECL}<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">` +
  `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
  `<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>` +
  `<p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;

const READ_PRESENTATION_RELS = `${XML_DECL}<Relationships xmlns="${NS_PKG_REL}">` +
  `<Relationship Id="rId1" Type="${NS_R}/slideMaster" Target="slideMasters/slideMaster1.xml"/>` +
  `<Relationship Id="rId2" Type="${NS_R}/slide" Target="slides/slide1.xml"/>` +
  `<Relationship Id="rId3" Type="${NS_R}/theme" Target="theme/theme1.xml"/></Relationships>`;

const READ_THEME = `${XML_DECL}<a:theme xmlns:a="${NS_A}" name="FuzzTheme"><a:themeElements>` +
  `<a:clrScheme name="Fuzz">` +
  `<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>` +
  `<a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>` +
  `<a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2>` +
  `<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4>` +
  `<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6>` +
  `<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>` +
  `<a:fontScheme name="Fuzz">` +
  `<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>` +
  `<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>` +
  `<a:fmtScheme name="Fuzz"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst></a:fmtScheme>` +
  `</a:themeElements></a:theme>`;

// spTree carries a text box, a rect, a picture, a table, and a grouped ellipse —
// every node kind the reader emits, so mutation reaches every branch.
const READ_SLIDE = `${XML_DECL}<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>` +
  `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
  `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="TextBox 1"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
  `<p:spPr><a:xfrm rot="5400000"><a:off x="838200" y="365125"/><a:ext cx="2743200" cy="1143000"/></a:xfrm>` +
  `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
  `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1800" b="1">` +
  `<a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>Hello</a:t></a:r></a:p></p:txBody></p:sp>` +
  `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Rect 2"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
  `<p:spPr><a:xfrm><a:off x="4000000" y="2000000"/><a:ext cx="1000000" cy="500000"/></a:xfrm>` +
  `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>` +
  `<a:ln w="12700"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:ln></p:spPr>` +
  `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>` +
  `<p:pic><p:nvPicPr><p:cNvPr id="4" name="Pic 3"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>` +
  `<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
  `<p:spPr><a:xfrm><a:off x="100" y="200"/><a:ext cx="300" cy="400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>` +
  `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="5" name="Table 4"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
  `<p:xfrm><a:off x="500000" y="3000000"/><a:ext cx="2000000" cy="800000"/></p:xfrm>` +
  `<a:graphic><a:graphicData uri="${NS_A}/table"><a:tbl><a:tblPr firstRow="1"/>` +
  `<a:tblGrid><a:gridCol w="1000000"/><a:gridCol w="1000000"/></a:tblGrid>` +
  `<a:tr h="400000"><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="en-US"/><a:t>A1</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>` +
  `<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="en-US"/><a:t>B1</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>` +
  `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="6" name="Group 5"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
  `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/><a:chOff x="0" y="0"/><a:chExt cx="100" cy="100"/></a:xfrm></p:grpSpPr>` +
  `<p:sp><p:nvSpPr><p:cNvPr id="7" name="Oval"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
  `<p:spPr><a:xfrm><a:off x="10" y="20"/><a:ext cx="30" cy="40"/></a:xfrm>` +
  `<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></p:spPr></p:sp></p:grpSp>` +
  `</p:spTree></p:cSld></p:sld>`;

const READ_SLIDE_RELS = `${XML_DECL}<Relationships xmlns="${NS_PKG_REL}">` +
  `<Relationship Id="rId1" Type="${NS_R}/notesSlide" Target="../notesSlides/notesSlide1.xml"/>` +
  `<Relationship Id="rId2" Type="${NS_R}/image" Target="../media/image1.png"/></Relationships>`;

const READ_NOTES = `${XML_DECL}<p:notes xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>` +
  `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>` +
  `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>` +
  `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Speaker note</a:t></a:r></a:p></p:txBody></p:sp>` +
  `</p:spTree></p:cSld></p:notes>`;

const PPTX_READ_PARTS: PptxParts = {
  'ppt/presentation.xml': READ_PRESENTATION,
  'ppt/_rels/presentation.xml.rels': READ_PRESENTATION_RELS,
  'ppt/theme/theme1.xml': READ_THEME,
  'ppt/slides/slide1.xml': READ_SLIDE,
  'ppt/slides/_rels/slide1.xml.rels': READ_SLIDE_RELS,
  'ppt/notesSlides/notesSlide1.xml': READ_NOTES,
  'ppt/media/image1.png': Uint8Array.of(0x89, 0x50, 0x4e, 0x47),
};
const PPTX_READ_SLOTS = [
  'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels', 'ppt/theme/theme1.xml',
  'ppt/slides/slide1.xml', 'ppt/slides/_rels/slide1.xml.rels',
] as const;

export const pptxReadTarget: FuzzTarget = {
  name: 'pptx-read',
  async seeds() {
    const enc = new TextEncoder();
    return [READ_PRESENTATION, READ_PRESENTATION_RELS, READ_THEME, READ_SLIDE, READ_SLIDE_RELS, READ_NOTES].map((s) => enc.encode(s));
  },
  // Contract (file-metadata precedent): never throws — a hostile part degrades
  // to defaults/no nodes, so the only findings are hang/alloc/stack-overflow.
  async invoke(bytes) {
    for (const slot of PPTX_READ_SLOTS) readPptx({ ...PPTX_READ_PARTS, [slot]: bytes }, parseXml);
    isPptx({ 'ppt/presentation.xml': bytes });
  },
};

const PATCH_THEME = `${XML_DECL}<a:theme xmlns:a="${NS_A}" name="Office"><a:themeElements>` +
  `<a:clrScheme name="Office">` +
  `<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>` +
  `<a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>` +
  `<a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2>` +
  `<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4>` +
  `<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6>` +
  `<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>` +
  `<a:fontScheme name="Office">` +
  `<a:majorFont><a:latin typeface="Calibri Light" panose="020F0302020204030204"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>` +
  `<a:minorFont><a:latin typeface="Calibri" panose="020F0502020204030204"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>` +
  `<a:fmtScheme name="Office"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme>` +
  `</a:themeElements></a:theme>`;

const PATCH_SLIDE = `${XML_DECL}<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">` +
  `<p:cSld><p:spTree><p:sp><p:spPr>` +
  `<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>` +
  `<a:ln><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:ln>` +
  `</p:spPr><p:txBody><a:p><a:r><a:rPr lang="en-US"><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>Hi &amp; bye</a:t></a:r></a:p></p:txBody>` +
  `</p:sp></p:spTree></p:cSld></p:sld>`;

const PATCH_CHART = `${XML_DECL}<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="${NS_A}">` +
  `<c:chart><c:plotArea><c:ser><c:spPr><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></c:spPr></c:ser></c:plotArea></c:chart>` +
  `<c:txPr><a:p><a:pPr><a:defRPr><a:latin typeface="Arial"/></a:defRPr></a:pPr></a:p></c:txPr></c:chartSpace>`;

const PATCH_PRESENTATION = `${XML_DECL}<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" embedTrueTypeFonts="1">` +
  `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
  `<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>` +
  `<p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/>` +
  `<p:embeddedFontLst><p:embeddedFont><p:font typeface="MyBrandFont"/><p:regular r:id="rId5"/></p:embeddedFont></p:embeddedFontLst>` +
  `<p:defaultTextStyle><a:lvl1pPr><a:defRPr><a:latin typeface="Arial"/></a:defRPr></a:lvl1pPr></p:defaultTextStyle></p:presentation>`;

const PATCH_PRES_RELS = `${XML_DECL}<Relationships xmlns="${NS_PKG_REL}">` +
  `<Relationship Id="rId1" Type="${NS_R}/slideMaster" Target="slideMasters/slideMaster1.xml"/>` +
  `<Relationship Id="rId2" Type="${NS_R}/slide" Target="slides/slide1.xml"/>` +
  `<Relationship Id="rId5" Type="${NS_R}/font" Target="fonts/font1.fntdata"/></Relationships>`;

const PATCH_CONTENT_TYPES = `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Default Extension="fntdata" ContentType="application/x-fontdata"/>` +
  `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
  `<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`;

const PPTX_PATCH_PARTS: PartMap = {
  '[Content_Types].xml': PATCH_CONTENT_TYPES,
  'ppt/presentation.xml': PATCH_PRESENTATION,
  'ppt/_rels/presentation.xml.rels': PATCH_PRES_RELS,
  'ppt/theme/theme1.xml': PATCH_THEME,
  'ppt/slides/slide1.xml': PATCH_SLIDE,
  'ppt/charts/chart1.xml': PATCH_CHART,
  'ppt/fonts/font1.fntdata': Uint8Array.of(0x4c, 0x50, 0x00, 0x01),
  'ppt/media/image1.png': Uint8Array.of(0x89, 0x50, 0x4e, 0x47),
};
// Built once, fully deterministic (mirrors tests/pptx-patch.test.ts PLAN).
const PPTX_PATCH_PLAN: RebrandPlan = {
  theme: { dk1: '101010', accent1: '112233', majorFont: 'Poppins', minorFont: 'Inter' },
  colorMap: new Map([['FF0000', '00FF00'], ['5B9BD5', '999999'], ['4472C4', '112233']]),
  fontMap: new Map([['Arial', 'Helvetica'], ['Calibri', 'Roboto']]),
  dropEmbeddedFonts: true,
};
const PPTX_PATCH_SLOTS = [
  'ppt/theme/theme1.xml', 'ppt/slides/slide1.xml', 'ppt/presentation.xml',
  'ppt/_rels/presentation.xml.rels', '[Content_Types].xml', 'ppt/charts/chart1.xml',
] as const;

export const pptxPatchTarget: FuzzTarget = {
  name: 'pptx-patch',
  async seeds() {
    const enc = new TextEncoder();
    return [PATCH_THEME, PATCH_SLIDE, PATCH_CHART, PATCH_PRESENTATION, PATCH_PRES_RELS, PATCH_CONTENT_TYPES].map((s) => enc.encode(s));
  },
  // Contract (file-metadata precedent): never throws — an unmatched/hostile
  // pattern passes through verbatim, so the only findings are hang/alloc/stack.
  async invoke(bytes) {
    for (const slot of PPTX_PATCH_SLOTS) rebrandPptxParts({ ...PPTX_PATCH_PARTS, [slot]: bytes }, PPTX_PATCH_PLAN);
  },
};

// The web bridge's consumer surface over the same parsers: capped zip inflation
// (inflatePptx) + inspect end-to-end, on whole zipped decks rather than bare
// parts. inspect NEVER throws by contract — hostile bytes must resolve ok:false
// — so ANY throw is a finding, alongside the runner's hang/alloc classes (the
// zip-bomb caps). rebrand's inflatePptx throws are its committed-file contract,
// not exercised here. Built at module scope, reusing pptx-read's jsdom adapter.
const pptxBridgeApi = createPptxAPI({ parseXml });

function zipParts(parts: Record<string, string | Uint8Array>): Uint8Array {
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const [path, v] of Object.entries(parts)) files[path] = typeof v === 'string' ? enc.encode(v) : v;
  return zipSync(files);
}

export const pptxBridgeTarget: FuzzTarget = {
  name: 'pptx-bridge',
  async seeds() {
    // Two small VALID zipped decks from the existing fixture part maps (~1-2 KB
    // each zipped), so mutation reaches both the zip framing and the XML inside.
    return [zipParts(PPTX_READ_PARTS), zipParts(PPTX_PATCH_PARTS)];
  },
  async invoke(bytes) {
    looksLikePptxFile({ name: 'x.pptx' });
    await pptxBridgeApi.inspect(bytes);
  },
};

export const ALL_TARGETS: FuzzTarget[] = [
  c2paVerifyTarget, cborTarget, mediaSniffTarget, pdfMapTarget, x509Target,
  fileMetadataTarget, stripMetadataTarget, videoMetaTarget, dataImportTarget,
  pptxReadTarget, pptxPatchTarget, pptxBridgeTarget,
];
export const TARGETS_BY_NAME: Record<string, FuzzTarget> = Object.fromEntries(ALL_TARGETS.map((t) => [t.name, t]));
