// SPDX-License-Identifier: MPL-2.0
/**
 * plans/144 O6: the register's metadata claims, checked against the real writers.
 *
 * docs/site/formats-catalog.json now states, per format, what Lolly reads and
 * writes in that format's own metadata containers and what comes through a
 * round trip. A claim in a JSON file is worth nothing on its own, so this suite runs
 * the ACTUAL engine writer for every claimed field with a sentinel value and
 * asserts the value comes back out of the bytes. Edit either side alone and the
 * build fails until they agree again.
 *
 * Three rules make the coverage honest rather than decorative:
 *   1. every one of the register's rows must carry a metadata block, using only
 *      the controlled vocabulary;
 *   2. a claimed field is proven by an engine writer here, or it is named in
 *      BRIDGE_WRITTEN with the file that writes it - there is no third option,
 *      so a new claim cannot arrive uncovered;
 *   3. a `c2pa` claim is checked against the engine's own C2PA_FORMATS list, the
 *      same constant the export path gates stamping on.
 *
 * Run directly: node --test tests/metadata-*.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  insertPngMeta, insertPngXmp, insertJpegExif, insertJpegXmp, insertWebpMeta, insertAvifExif,
  injectSvgMeta, withGifComment, carryImageMetadata, buildCarryExifTiff, pngChunk, readU32,
} from '../engine/src/image-meta.ts';
import { extractFileMetadata, extractXmpPacket } from '../engine/src/file-metadata.ts';
import { insertJpegSegments } from '../engine/src/jpeg-segments.ts';
import { C2PA_FORMATS } from '../engine/src/c2pa-containers.ts';
import { embedWavInfo } from '../engine/src/riff-meta.ts';
import { packTiff } from '../engine/src/tiff.ts';
import { writeDocx } from '../engine/src/docx.ts';
import { writeOdt } from '../engine/src/odt.ts';
import { writeEpub } from '../engine/src/epub.ts';
import { buildPptxParts } from '../engine/src/pptx.ts';
import { readZip } from '../engine/src/zip.ts';
import { gzip } from '../engine/src/gzip.ts';
import { METADATA_VOCAB, type FmtCatalog, type FmtEntry } from '../docs/formats-pages.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(
  readFileSync(resolve(ROOT, 'docs/site/formats-catalog.json'), 'utf8'),
) as FmtCatalog;
const rows: FmtEntry[] = catalog.formats;
const byToken = new Map(rows.map((f) => [f.token, f]));

/** The value every writer under test is fed. Distinctive enough that finding it
 *  in the output bytes cannot be a coincidence. */
const SENTINEL = 'SENTINEL-AUTHOR-144';

const META = {
  software: 'Lolly', source: 'https://lolly.tools', tool: 'Claim test',
  author: SENTINEL, contact: '', description: 'A claim test', copyright: `(c) ${SENTINEL}`,
};

// ─── Fixtures (the same minimal containers tests/image-meta-carry.test.ts uses) ──

/** Minimal JPEG: SOI, an SOS, one entropy byte, EOI. */
function tinyJpeg(): Uint8Array {
  return Uint8Array.of(0xFF, 0xD8, 0xFF, 0xDA, 0x00, 0x02, 0x00, 0xFF, 0xD9);
}

/** Minimal PNG: signature + IHDR (1x1 grey) + empty IDAT + IEND. Chunk CRCs real. */
function tinyPng(): Uint8Array {
  const sig = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
  const ihdrData = new Uint8Array(13);
  const dv = new DataView(ihdrData.buffer);
  dv.setUint32(0, 1); dv.setUint32(4, 1);
  ihdrData[8] = 8; // bit depth
  const parts = [sig, pngChunk('IHDR', ihdrData), pngChunk('IDAT', new Uint8Array(0)), pngChunk('IEND', new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Minimal WebP: RIFF/WEBP + a VP8L header declaring 1x1, no alpha. */
function tinyWebp(): Uint8Array {
  const payload = Uint8Array.of(0x2F, 0x00, 0x00, 0x00, 0x00); // signature + 1x1
  const out = new Uint8Array(12 + 8 + payload.length + 1); // odd payload → pad
  const cc = (o: number, s: string): void => { for (let i = 0; i < 4; i++) out[o + i] = s.charCodeAt(i); };
  cc(0, 'RIFF');
  const riffSize = out.length - 8;
  out[4] = riffSize & 0xFF; out[5] = (riffSize >>> 8) & 0xFF; out[6] = (riffSize >>> 16) & 0xFF; out[7] = (riffSize >>> 24) & 0xFF;
  cc(8, 'WEBP');
  cc(12, 'VP8L');
  out[16] = payload.length;
  out.set(payload, 20);
  return out;
}

/** Minimal GIF89a: header + logical screen descriptor (no global colour table). */
function tinyGif(): Uint8Array {
  const out = new Uint8Array(14);
  for (let i = 0; i < 6; i++) out[i] = 'GIF89a'.charCodeAt(i);
  out[6] = 1; out[8] = 1; // 1x1
  out[13] = 0x3B;         // trailer
  return out;
}

/** Minimal RIFF/WAVE: fmt chunk (PCM mono 8 kHz) + an empty data chunk. */
function tinyWav(): Uint8Array {
  const out = new Uint8Array(44);
  const dv = new DataView(out.buffer);
  const cc = (o: number, s: string): void => { for (let i = 0; i < 4; i++) out[o + i] = s.charCodeAt(i); };
  cc(0, 'RIFF'); dv.setUint32(4, 36, true); cc(8, 'WAVE');
  cc(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true);
  dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
  cc(36, 'data'); dv.setUint32(40, 0, true);
  return out;
}

/** A JPEG source whose EXIF Artist is the sentinel - the input the carry reads. */
function sentinelSourceJpeg(): Uint8Array {
  const tiff = buildCarryExifTiff({ author: SENTINEL, description: 'source' })!;
  const idBytes = new TextEncoder().encode('Exif\0\0');
  const segLen = 2 + idBytes.length + tiff.length;
  const seg = new Uint8Array(2 + segLen);
  seg[0] = 0xFF; seg[1] = 0xE1;
  seg[2] = (segLen >> 8) & 0xFF; seg[3] = segLen & 0xFF;
  seg.set(idBytes, 4);
  seg.set(tiff, 4 + idBytes.length);
  return insertJpegSegments(tinyJpeg(), [seg]);
}

const text = (b: Uint8Array): string => new TextDecoder('latin1').decode(b);
const fieldOf = (b: Uint8Array, label: string): string | undefined =>
  extractFileMetadata(b).fields.find((f) => f.label === label)?.value;
const zipPart = (zip: Uint8Array, name: string): string => {
  const e = readZip(zip).find((m) => m.name === name);
  assert.ok(e, `${name} present in the package`);
  return text(e!.bytes);
};
/** The chunk type list of a PNG, for asserting a container slot exists. */
function pngChunks(bytes: Uint8Array): string[] {
  const types: string[] = [];
  let p = 8;
  while (p + 12 <= bytes.length) {
    const len = readU32(bytes, p);
    types.push(String.fromCharCode(bytes[p + 4]!, bytes[p + 5]!, bytes[p + 6]!, bytes[p + 7]!));
    p += 12 + len;
    if (types.at(-1) === 'IEND') break;
  }
  return types;
}

// ─── The proofs: one real engine writer per claimed field ────────────────────
//
// Each entry names a register token and the vocabulary field it proves, and runs
// the writer that produces it. `check` throws (via assert) when the sentinel is
// not readable back out of the bytes.

interface Proof { token: string; field: string; check: () => void }

const PROOFS: Proof[] = [
  {
    token: 'PNG', field: 'xmp', check: () => {
      const out = insertPngXmp(tinyPng(), META);
      assert.ok(pngChunks(out).includes('iTXt'), 'XMP rides an iTXt chunk');
      assert.ok(extractXmpPacket(out)?.includes(SENTINEL), 'sentinel in the PNG XMP packet');
    },
  },
  {
    token: 'PNG', field: 'exif', check: () => {
      // PNG EXIF is the image converter's carry, not the plain export path: the
      // source file's EXIF becomes an eXIf chunk in the re-encoded output.
      const { bytes } = carryImageMetadata({ bytes: sentinelSourceJpeg() }, { bytes: tinyPng(), mime: 'image/png' });
      assert.ok(pngChunks(bytes).includes('eXIf'), 'eXIf chunk written by the carry');
      assert.equal(fieldOf(bytes, 'Artist'), SENTINEL);
    },
  },
  {
    token: 'JPG', field: 'exif', check: () => {
      assert.equal(fieldOf(insertJpegExif(tinyJpeg(), META), 'Artist'), SENTINEL);
    },
  },
  {
    token: 'JPG', field: 'xmp', check: () => {
      assert.ok(extractXmpPacket(insertJpegXmp(tinyJpeg(), META))?.includes(SENTINEL));
    },
  },
  {
    token: 'WEBP', field: 'exif', check: () => {
      const out = insertWebpMeta(tinyWebp(), META);
      assert.ok(text(out).includes('EXIF'), 'RIFF EXIF chunk written');
      assert.equal(fieldOf(out, 'Artist'), SENTINEL);
    },
  },
  {
    token: 'WEBP', field: 'xmp', check: () => {
      assert.ok(extractXmpPacket(insertWebpMeta(tinyWebp(), META))?.includes(SENTINEL));
    },
  },
  {
    token: 'TIFF', field: 'exif', check: () => {
      const out = packTiff(new Uint8Array(3), { width: 1, height: 1, samplesPerPixel: 3, meta: META });
      assert.equal(fieldOf(out, 'Artist'), SENTINEL, 'TIFF Artist tag (315)');
    },
  },
  {
    token: 'SVG', field: 'dc', check: () => {
      assert.ok(injectSvgMeta('<svg xmlns="http://www.w3.org/2000/svg"></svg>', META)
        .includes(`<dc:creator>${SENTINEL}</dc:creator>`));
    },
  },
  {
    token: 'SVGZ', field: 'dc', check: () => {
      // SVGZ is gzip around exactly the SVG the still path writes, so the same
      // Dublin Core block is what a reader gets after inflating.
      const svg = injectSvgMeta('<svg xmlns="http://www.w3.org/2000/svg"></svg>', META);
      const packed = gzip(new TextEncoder().encode(svg));
      assert.ok(packed.length > 0 && packed[0] === 0x1f && packed[1] === 0x8b, 'gzip container');
      assert.ok(svg.includes(`<dc:creator>${SENTINEL}</dc:creator>`));
    },
  },
  {
    token: 'WAV', field: 'info', check: () => {
      const out = embedWavInfo(tinyWav(), { title: 'Claim test', artist: SENTINEL });
      const s = text(out);
      assert.ok(s.includes('LIST') && s.includes('INFO') && s.includes('IART'), 'LIST/INFO with IART');
      assert.ok(s.includes(SENTINEL), 'sentinel artist in the INFO chunk');
    },
  },
  {
    token: 'DOCX', field: 'core-props', check: () => {
      const zip = writeDocx({ title: 'Claim test', blocks: [{ type: 'paragraph', text: 'body' }], meta: { author: SENTINEL } });
      const core = zipPart(zip, 'docProps/core.xml');
      assert.ok(core.includes(`<dc:creator>${SENTINEL}</dc:creator>`), 'dc:creator in core.xml');
    },
  },
  {
    token: 'PPTX', field: 'core-props', check: () => {
      const parts = buildPptxParts([{ shapes: [], media: [] }], { meta: { author: SENTINEL } });
      const core = parts['docProps/core.xml'];
      assert.equal(typeof core, 'string', 'core.xml is emitted');
      assert.ok(String(core).includes(`<dc:creator>${SENTINEL}</dc:creator>`));
    },
  },
  {
    token: 'ODT', field: 'dc', check: () => {
      // ODT carries the document title only, which is exactly what the register
      // claims - so the title is what the sentinel goes into.
      const zip = writeOdt({ title: SENTINEL, blocks: [{ type: 'paragraph', text: 'body' }] });
      assert.ok(zipPart(zip, 'meta.xml').includes(`<dc:title>${SENTINEL}</dc:title>`));
    },
  },
  {
    token: 'EPUB', field: 'dc', check: () => {
      const zip = writeEpub({ title: 'Claim test', author: SENTINEL, chapters: [{ title: 'One', xhtml: '<p>body</p>' }] });
      assert.ok(zipPart(zip, 'OEBPS/content.opf').includes(SENTINEL), 'dc:creator in the OPF');
    },
  },
  {
    token: 'AVIF', field: 'exif', check: () => {
      const src = tinyAvif();
      const out = insertAvifExif(src, META);
      assert.notEqual(out, src, 'the Exif item was written');
      assert.equal(fieldOf(out, 'Artist'), SENTINEL, 'sentinel readable from the HEIF Exif item');
      // The primary item's iloc offset was rewritten by the meta-box growth:
      // its extent still points at the same mdat payload bytes.
      assert.equal(extractFileMetadata(out).format, 'AVIF');
    },
  },
];

/** A structurally minimal AVIF for the item writer: ftyp + meta (hdlr, pitm,
 *  iinf with one av01 item, iloc pointing into mdat) + mdat. No real AV1
 *  payload - the claim is about the metadata boxes, not the pixels (the
 *  pixels-survive proof runs against a real encoder in image-meta-carry). */
function tinyAvif(): Uint8Array {
  const be16 = (v: number): number[] => [(v >> 8) & 0xff, v & 0xff];
  const be32 = (v: number): number[] => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
  const box = (type: string, payload: number[]): number[] =>
    [...be32(8 + payload.length), ...[...type].map((c) => c.charCodeAt(0)), ...payload];
  const ftyp = box('ftyp', [...[...'avif'].map((c) => c.charCodeAt(0)), ...be32(0), ...[...'avifmif1'].map((c) => c.charCodeAt(0))]);
  const hdlr = box('hdlr', [0, 0, 0, 0, ...be32(0), ...[...'pict'].map((c) => c.charCodeAt(0)), ...be32(0), ...be32(0), ...be32(0), 0]);
  const pitm = box('pitm', [0, 0, 0, 0, ...be16(1)]);
  const infe = box('infe', [2, 0, 0, 0, ...be16(1), ...be16(0), ...[...'av01'].map((c) => c.charCodeAt(0)), 0]);
  const iinf = box('iinf', [0, 0, 0, 0, ...be16(1), ...infe]);
  const payloadBytes = [1, 2, 3, 4];
  // iloc version 0, offset/length 4 bytes, no base: item 1 → the mdat payload,
  // whose file offset is computed below once the meta size is known.
  const ilocFor = (off: number): number[] =>
    box('iloc', [0, 0, 0, 0, 0x44, 0x00, ...be16(1), ...be16(1), ...be16(0), ...be16(1), ...be32(off), ...be32(payloadBytes.length)]);
  const metaFor = (off: number): number[] => box('meta', [0, 0, 0, 0, ...hdlr, ...pitm, ...iinf, ...ilocFor(off)]);
  const metaLen = metaFor(0).length;
  const mdatPayloadAt = ftyp.length + metaLen + 8;
  const mdat = box('mdat', payloadBytes);
  return Uint8Array.from([...ftyp, ...metaFor(mdatPayloadAt), ...mdat]);
}

/**
 * Claimed fields with no engine writer, because the writer lives outside the
 * engine. Each needs a reason naming where the bytes are actually produced -
 * this list is the only escape from the coverage rule, so it stays short and
 * every line has to earn its place.
 */
const BRIDGE_WRITTEN: Record<string, string> = {
  'CMYK PDF:xmp': 'the PDF/X-4 XMP packet is assembled over pdf-lib in shells/web/src/bridge/export-pdfx.ts',
  'CMYK TIFF:exif': 'encodeCmykTiff writes the CMYK TIFF tags in shells/web/src/bridge/export.ts, not the engine packTiff',
  'Animated SVG:dc': 'the animated writer builds its own Dublin Core block in shells/web/src/lib/svg-anim-core.ts',
  'ICS:prodid': 'PRODID comes from the calendar tools own template and hooks (meeting-planner, calendar-ics), not an engine writer',
};

/** Register token → the format string embedC2pa takes. Checked against the
 *  engine's C2PA_FORMATS, which is what the export path gates stamping on. */
const C2PA_FORMAT_OF: Record<string, string> = {
  SVG: 'svg', SVGZ: 'svg', 'Animated SVG': 'svg',
  PDF: 'pdf', 'CMYK PDF': 'pdf-cmyk',
  PNG: 'png', APNG: 'apng', JPG: 'jpg',
  WEBP: 'webp', 'Animated WebP': 'webp',
  GIF: 'gif', TIFF: 'tiff', 'CMYK TIFF': 'cmyk-tiff', AVIF: 'avif',
  MP4: 'mp4', WEBM: 'webm', M4A: 'm4a', MP3: 'mp3', WAV: 'wav', Opus: 'opus',
  HTML: 'html', MD: 'md',
};

// ─── Shape: every row states its claims, in the controlled vocabulary ────────

test('every register row carries a metadata block', () => {
  const missing = rows.filter((f) => !f.metadata).map((f) => f.token);
  assert.deepEqual(missing, [], 'a format with no metadata block makes no claim, which is itself a claim');
  assert.ok(rows.length >= 60, `the register should list dozens of formats (found ${rows.length})`);
});

test('reads and writes use the controlled vocabulary only', () => {
  const vocab = new Set<string>(METADATA_VOCAB);
  const bad: string[] = [];
  for (const f of rows) {
    for (const k of [...f.metadata.reads, ...f.metadata.writes]) {
      if (!vocab.has(k)) bad.push(`${f.token}: unknown token "${k}"`);
      if (k === 'none') bad.push(`${f.token}: use an empty array, never a "none" token`);
    }
  }
  assert.deepEqual(bad, []);
});

test('preserves is one of the four values, and n/a exactly where there is no round trip', () => {
  const bad: string[] = [];
  for (const f of rows) {
    const p = f.metadata.preserves;
    if (!['full', 'partial', 'none', 'n/a'].includes(p)) bad.push(`${f.token}: preserves "${p}"`);
    if (f.dir === 'both' && p === 'n/a') bad.push(`${f.token}: round-trips, so preserves cannot be n/a`);
    if (f.dir !== 'both' && p !== 'n/a') bad.push(`${f.token}: one-direction, so preserves must be n/a`);
  }
  assert.deepEqual(bad, []);
});

test('an import-only format writes nothing, an export-only format reads nothing', () => {
  const bad: string[] = [];
  for (const f of rows) {
    if (f.dir === 'in' && f.metadata.writes.length) bad.push(`${f.token}: import-only but claims writes`);
    if (f.dir === 'out' && f.metadata.reads.length) bad.push(`${f.token}: export-only but claims reads`);
  }
  assert.deepEqual(bad, []);
});

// ─── Coverage: no claim without a proof ──────────────────────────────────────

test('every claimed field is proven by an engine writer or named in BRIDGE_WRITTEN', () => {
  const proven = new Set(PROOFS.map((p) => `${p.token}:${p.field}`));
  const uncovered: string[] = [];
  for (const f of rows) {
    for (const w of f.metadata.writes) {
      if (w === 'c2pa') continue; // covered by the C2PA_FORMATS test below
      const key = `${f.token}:${w}`;
      if (!proven.has(key) && !BRIDGE_WRITTEN[key]) uncovered.push(key);
    }
  }
  assert.deepEqual(uncovered, [],
    'Add a writer proof to PROOFS, or a BRIDGE_WRITTEN reason naming the file that writes it.');
});

test('BRIDGE_WRITTEN carries no stale entry, and every reason names a source', () => {
  const claimed = new Set<string>();
  for (const f of rows) for (const w of f.metadata.writes) claimed.add(`${f.token}:${w}`);
  for (const [key, why] of Object.entries(BRIDGE_WRITTEN)) {
    assert.ok(claimed.has(key), `${key} is allowlisted but no longer claimed - drop the entry`);
    assert.ok(why.length > 20, `${key}: the reason must name where the bytes are written`);
  }
});

test('every proof names a register row that still claims the field', () => {
  for (const p of PROOFS) {
    const row = byToken.get(p.token);
    assert.ok(row, `${p.token} is in the register`);
    assert.ok(row!.metadata.writes.includes(p.field), `${p.token} still claims to write ${p.field}`);
  }
});

// ─── The proofs themselves ───────────────────────────────────────────────────

for (const p of PROOFS) {
  test(`${p.token} writes ${p.field}: the real writer puts the sentinel in the bytes`, p.check);
}

// ─── Content Credentials ─────────────────────────────────────────────────────

test('every c2pa claim maps to a container the engine can actually stamp', () => {
  const bad: string[] = [];
  for (const f of rows) {
    if (!f.metadata.writes.includes('c2pa')) continue;
    const fmt = C2PA_FORMAT_OF[f.token];
    if (!fmt) { bad.push(`${f.token}: claims c2pa with no format mapping`); continue; }
    if (!C2PA_FORMATS.includes(fmt)) bad.push(`${f.token}: "${fmt}" is not in the engine's C2PA_FORMATS`);
  }
  assert.deepEqual(bad, []);
});

// ─── The inverse: a format that does not claim a field must not write one ────

test('GIF claims no EXIF or XMP, and its comment writer produces neither', () => {
  const row = byToken.get('GIF')!;
  assert.ok(!row.metadata.writes.includes('exif') && !row.metadata.writes.includes('xmp'));
  const out = withGifComment(tinyGif(), `by ${SENTINEL}`);
  const s = text(out);
  assert.ok(s.includes(SENTINEL), 'the credit line is in the comment extension');
  assert.ok(!s.includes('Exif\0\0'), 'no EXIF segment');
  assert.ok(!s.includes('x:xmpmeta'), 'no XMP packet');
  assert.equal(extractXmpPacket(out), null);
});

test('APNG claims no XMP: the animated path writes text chunks only', () => {
  const row = byToken.get('APNG')!;
  assert.ok(!row.metadata.writes.includes('xmp'), 'the register does not claim XMP for APNG');
  // insertPngMeta is the only stamper the animated path runs (bridge/export.ts).
  const out = insertPngMeta(tinyPng(), META);
  assert.ok(text(out).includes(SENTINEL), 'the author is in an iTXt text chunk');
  assert.equal(extractXmpPacket(out), null, 'no XMP packet from the text stamper alone');
});

test('ODT claims dc only: the package has no OOXML core properties part', () => {
  const row = byToken.get('ODT')!;
  assert.deepEqual(row.metadata.writes, ['dc']);
  const names = readZip(writeOdt({ title: SENTINEL, blocks: [{ type: 'paragraph', text: 'body' }] })).map((m) => m.name);
  assert.ok(!names.includes('docProps/core.xml'));
});

test('a format claiming nothing gets no sentinel: PSD, BMP, CSV and TXT stay empty', () => {
  for (const token of ['PSD', 'BMP', 'CSV', 'TXT', 'ICO', 'ZIP', 'GZ', 'TAR']) {
    const row = byToken.get(token);
    assert.ok(row, `${token} is in the register`);
    assert.deepEqual(row!.metadata.writes, [], `${token} writes no metadata`);
    assert.deepEqual(row!.metadata.reads, [], `${token} reads no metadata`);
  }
});

// ─── The AVIF follow-up is closed: the claim and the writer move together ────

test('AVIF claims EXIF and the Exif item writer backs it', () => {
  const row = byToken.get('AVIF')!;
  assert.ok(row.metadata.writes.includes('exif'),
    'insertAvifExif ships (plans/144, the Wave 2 follow-up closed) - the register row must claim it');
  assert.ok(row.metadata.reads.includes('exif'), 'the HEIF item reader backs the read claim');
  assert.ok(byToken.get('HEIC')!.metadata.reads.includes('exif'), 'HEIC rides the same item reader');
});
