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

export const ALL_TARGETS: FuzzTarget[] = [
  c2paVerifyTarget, cborTarget, mediaSniffTarget, pdfMapTarget, x509Target,
  fileMetadataTarget, stripMetadataTarget, videoMetaTarget, dataImportTarget,
];
export const TARGETS_BY_NAME: Record<string, FuzzTarget> = Object.fromEntries(ALL_TARGETS.map((t) => [t.name, t]));
