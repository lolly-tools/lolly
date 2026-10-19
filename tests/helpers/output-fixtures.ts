// SPDX-License-Identifier: MPL-2.0
/**
 * Export fixtures for the output facts and export report suites, and the
 * output-facts fuzz seeds. Each is built from the engine's own writers or from
 * a few hand-assembled container headers, so no binary file is checked in.
 */

import { PDFDocument, StandardFonts, cmyk, rgb } from 'pdf-lib';

import { packPng } from '../../engine/src/png.ts';

const enc = new TextEncoder();
export const bytesOf = (s: string): Uint8Array => enc.encode(s);
export const concat = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
const be32 = (n: number): Uint8Array => Uint8Array.of(n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255);
const be16 = (n: number): Uint8Array => Uint8Array.of(n >>> 8 & 255, n & 255);
const le32 = (n: number): Uint8Array => Uint8Array.of(n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255);
const le24 = (n: number): Uint8Array => Uint8Array.of(n & 255, n >>> 8 & 255, n >>> 16 & 255);
const le16 = (n: number): Uint8Array => Uint8Array.of(n & 255, n >>> 8 & 255);

export const rgbaPng = (opts: { dpi?: number; text?: boolean; cicp?: boolean } = {}): Uint8Array => packPng(new Uint8Array(4 * 3 * 4), {
  width: 4, height: 3, channels: 4,
  ...(opts.dpi ? { dpi: opts.dpi } : {}),
  ...(opts.text ? { text: [{ keyword: 'Title', text: 'Card' }] } : {}),
  ...(opts.cicp ? { cicp: { primaries: 9, transfer: 16, matrix: 0, fullRange: 1 } } : {}),
});
export const rgbPng = (): Uint8Array => packPng(new Uint8Array(4 * 3 * 3), { width: 4, height: 3, channels: 3 });

const C2PA_JUMBF_UUID = Uint8Array.of(0x63, 0x32, 0x70, 0x61, 0x00, 0x11, 0x00, 0x10, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71);
export function fakeStore(contentLen = 64): Uint8Array {
  const jumd = concat([be32(8 + 16), bytesOf('jumd'), C2PA_JUMBF_UUID]);
  return concat([be32(8 + jumd.length + contentLen), bytesOf('jumb'), jumd, new Uint8Array(contentLen).fill(0x58)]);
}

/** A header-only JPEG: SOI, JFIF APP0, SOF0 and EOI. The readers never decode scan data. */
export function jpeg(opts: { components?: 1 | 3 | 4; dpi?: number } = {}): Uint8Array {
  const n = opts.components ?? 3;
  const jfif = concat([Uint8Array.of(0xff, 0xe0), be16(16), bytesOf('JFIF\0'), Uint8Array.of(1, 1, opts.dpi ? 1 : 0), be16(opts.dpi ?? 1), be16(opts.dpi ?? 1), Uint8Array.of(0, 0)]);
  const comps = concat(Array.from({ length: n }, (_, i) => Uint8Array.of(i + 1, 0x11, 0)));
  const sof = concat([Uint8Array.of(0xff, 0xc0), be16(8 + 3 * n), Uint8Array.of(8), be16(2), be16(3), Uint8Array.of(n), comps]);
  return concat([Uint8Array.of(0xff, 0xd8), jfif, sof, Uint8Array.of(0xff, 0xd9)]);
}

/** A two-frame GIF89a: 5 x 4, a transparent first frame, 10 centiseconds a frame. */
export function gif(frames = 2): Uint8Array {
  const parts: Uint8Array[] = [bytesOf('GIF89a'), le16(5), le16(4), Uint8Array.of(0x80, 0, 0), new Uint8Array(6)];
  for (let i = 0; i < frames; i++) {
    parts.push(Uint8Array.of(0x21, 0xf9, 4, i === 0 ? 1 : 0), le16(10), Uint8Array.of(0, 0));
    parts.push(Uint8Array.of(0x2c), le16(0), le16(0), le16(5), le16(4), Uint8Array.of(0, 2, 2, 0x4c, 0x01, 0));
  }
  parts.push(Uint8Array.of(0x3b));
  return concat(parts);
}

/** An extended-format WebP header: VP8X with the alpha flag, 7 x 5 canvas. */
export function webp(): Uint8Array {
  const vp8x = concat([bytesOf('VP8X'), le32(10), Uint8Array.of(0x10, 0, 0, 0), le24(6), le24(4)]);
  return concat([bytesOf('RIFF'), le32(4 + vp8x.length), bytesOf('WEBP'), vp8x]);
}

const box = (type: string, ...parts: Uint8Array[]): Uint8Array => {
  const payload = concat(parts);
  return concat([be32(8 + payload.length), bytesOf(type), payload]);
};
const full = (version = 0): Uint8Array => Uint8Array.of(version, 0, 0, 0);

/** A metadata-only MP4: 640 x 360, 5 s, 150 samples, an nclx colour box with the given transfer. */
export function mp4(transfer = 1, durationMs = 5000): Uint8Array {
  const mvhd = box('mvhd', full(), be32(0), be32(0), be32(1000), be32(durationMs), new Uint8Array(80));
  const tkhd = box('tkhd', full(), new Uint8Array(72), be32(640 << 16), be32(360 << 16));
  const hdlr = box('hdlr', full(), be32(0), bytesOf('vide'), new Uint8Array(12), Uint8Array.of(0));
  const colr = box('colr', bytesOf('nclx'), be16(9), be16(transfer), be16(9), Uint8Array.of(0x80));
  const avc1 = box('avc1', new Uint8Array(78), colr);
  const stsd = box('stsd', full(), be32(1), avc1);
  const stsz = box('stsz', full(), be32(0), be32(150));
  const moov = box('moov', mvhd, box('trak', tkhd, box('mdia', hdlr, box('minf', box('stbl', stsd, stsz)))));
  return concat([box('ftyp', bytesOf('isom'), be32(0x200), bytesOf('isom')), moov, box('mdat', new Uint8Array(16))]);
}

const ebml = (id: number[], payload: Uint8Array): Uint8Array => {
  // Eight-byte size VINT keeps the builder simple; real muxers use the shortest form.
  const size = Uint8Array.of(0x01, 0, 0, 0, payload.length >>> 24 & 255, payload.length >>> 16 & 255, payload.length >>> 8 & 255, payload.length & 255);
  return concat([Uint8Array.of(...id), size, payload]);
};

/** A metadata-only WebM: 320 x 240, a 5 s Duration at the default timecode scale. */
export function webm(): Uint8Array {
  const duration = new Uint8Array(8);
  new DataView(duration.buffer).setFloat64(0, 5000);
  const header = ebml([0x1a, 0x45, 0xdf, 0xa3], ebml([0x42, 0x82], bytesOf('webm')));
  const info = ebml([0x15, 0x49, 0xa9, 0x66], concat([ebml([0x2a, 0xd7, 0xb1], Uint8Array.of(0x0f, 0x42, 0x40)), ebml([0x44, 0x89], duration)]));
  const video = ebml([0xe0], concat([ebml([0xb0], be16(320)), ebml([0xba], be16(240))]));
  const tracks = ebml([0x16, 0x54, 0xae, 0x6b], ebml([0xae], concat([ebml([0x83], Uint8Array.of(1)), video])));
  const segment = ebml([0x18, 0x53, 0x80, 0x67], concat([info, tracks]));
  return concat([header, segment]);
}

export async function pdf(opts: { objectStreams?: boolean; pages?: number; trim?: boolean; colour?: 'rgb' | 'cmyk'; text?: boolean; size?: [number, number] } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Report test');
  const font = opts.text ? await doc.embedFont(StandardFonts.Helvetica) : null;
  const [w, h] = opts.size ?? [595.28, 841.89];
  for (let i = 0; i < (opts.pages ?? 1); i++) {
    const page = doc.addPage([w, h]);
    if (opts.trim) page.setTrimBox(9, 9, w - 18, h - 18);
    page.drawRectangle({ x: 10, y: 10, width: 50, height: 50, color: opts.colour === 'cmyk' ? cmyk(0, 0, 0, 1) : rgb(1, 0, 0) });
    if (font) page.drawText('Hello', { x: 20, y: 100, size: 12, font, color: opts.colour === 'cmyk' ? cmyk(0, 0, 0, 1) : rgb(0, 0, 0) });
  }
  return doc.save({ useObjectStreams: opts.objectStreams ?? true });
}

export const encryptedPdf = (): Uint8Array => bytesOf([
  '%PDF-1.4',
  '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
  '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
  '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] >> endobj',
  '4 0 obj << /Filter /Standard /V 1 /R 2 >> endobj',
  'trailer << /Root 1 0 R /Encrypt 4 0 R /Size 5 >>',
  '%%EOF',
].join('\n'));


/** The boxes of a print geometry in points, as `computePrintGeometry` returns them. */
interface SheetBoxes {
  readonly page: { readonly w: number; readonly h: number };
  readonly boxes: { readonly media: Box; readonly bleed: Box; readonly trim: Box };
}
interface Box { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

/**
 * An SVG print sheet laid out the way shells/web/src/bridge/export.ts
 * `wrapArtworkSvgWithMarks` writes one: an outer root sized to the whole sheet in
 * points, the boxes recorded as data attributes, the artwork nested in the bleed
 * box and one crop mark. `boxes: 'media'` leaves out data-trim-box and data-bleed-box.
 */
export function printSheetSvg(geo: SheetBoxes, opts: { boxes?: 'all' | 'media' } = {}): Uint8Array {
  const n = (v: number): string => String(Math.round(v * 1000) / 1000);
  const P = (v: number): string => n((v * 96) / 72);
  const box = (b: Box): string => `${n(b.x)} ${n(b.y)} ${n(b.w)} ${n(b.h)}`;
  const { media, bleed, trim } = geo.boxes;
  const recorded = opts.boxes === 'media'
    ? `data-media-box="${box(media)}"`
    : `data-media-box="${box(media)}" data-bleed-box="${box(bleed)}" data-trim-box="${box(trim)}"`;
  return bytesOf([
    '<?xml version="1.0" standalone="no"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(geo.page.w)}pt" height="${n(geo.page.h)}pt" viewBox="0 0 ${P(geo.page.w)} ${P(geo.page.h)}" ${recorded}>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" x="${P(bleed.x)}" y="${P(bleed.y)}" width="${P(bleed.w)}" height="${P(bleed.h)}" preserveAspectRatio="none"><rect width="100" height="100" fill="#c00"/></svg>`,
    `<g class="print-marks"><line x1="0" y1="${P(trim.y)}" x2="${P(trim.x - 6)}" y2="${P(trim.y)}" stroke="#000" stroke-width="0.667"/></g>`,
    '</svg>',
  ].join(''));
}

/**
 * Inputs that made the first readers quadratic, each about `size` bytes: a PDF
 * that is one run of digits, object headers with no endstream or endobj, a run
 * of whitespace between two numbers, a page tree holding a run of digits and
 * unclosed box arrays, many tiny compressed streams, and SVG start tags that
 * never close.
 */
export function pathologicalOutputs(size: number, zlib: (b: Uint8Array) => Uint8Array): Record<string, Uint8Array> {
  const fill = (unit: string, n = size): string => unit.repeat(Math.ceil(n / unit.length)).slice(0, n);
  const tiny = zlib(bytesOf('0 0 0 rg'));
  const streams: Uint8Array[] = [bytesOf('%PDF-1.7\n')];
  for (let i = 1, total = 0; total < size; i++) {
    const head = bytesOf(`${i} 0 obj <</Filter/FlateDecode/Length ${tiny.length}>>stream\n`), tail = bytesOf('\nendstream endobj\n');
    streams.push(head, tiny, tail);
    total += head.length + tiny.length + tail.length;
  }
  return {
    'PDF of digits': bytesOf(`%PDF-1.7\n${'1'.repeat(size)}`),
    'PDF objects without endstream': bytesOf(`%PDF-1.7\n${fill('1 0 obj <<>> stream\n')}`),
    'PDF objects without endobj': bytesOf(`%PDF-1.7\n${fill('1 0 obj <</A 1>>\n')}`),
    'PDF objects with one far endobj': bytesOf(`%PDF-1.7\n${fill('1 0 obj <</A 1>>\n')}endobj`),
    'PDF whitespace between numbers': bytesOf(`%PDF-1.7\n1${' '.repeat(size)}1          x`),
    'PDF page tree of digit runs and unclosed boxes': bytesOf([
      '%PDF-1.7',
      '1 0 obj <</Type/Catalog/Pages 2 0 R>> endobj',
      '2 0 obj <</Type/Pages/Kids[3 0 R 4 0 R]/Count 2>> endobj',
      `3 0 obj <</Type/Pages/Kids[${'1'.repeat(60_000)}]>> endobj`,
      `4 0 obj <</Type/Page${'/MediaBox['.repeat(6_000)} >> endobj`,
      fill('% padding\n', Math.max(0, size - 120_200)),
    ].join('\n')),
    'PDF of many tiny compressed streams': concat(streams),
    'SVG start tags that never close': bytesOf(fill('<svg ')),
    'SVG image tags that never close': bytesOf(`<svg width="10" height="10">${fill('<image ')}`),
  };
}
