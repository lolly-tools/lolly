#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Build the labelled Read and extract fixtures (plan 203, rank 10): three small
 * files in several languages and scripts, each with a sidecar that states, page
 * by page, the blocks a correct reading returns in reading order and where each
 * block's words come from.
 *
 *   multilingual.pptx  five slides in English, French, German, Spanish, Greek,
 *                      Russian, Japanese and Arabic, with a picture, speaker notes
 *                      and a table whose cells mix scripts;
 *   multilingual.pdf   a two-column English page (a reader must not interleave the
 *                      columns), a page of French, German and Spanish with their
 *                      accents, and a searchable scan: one page picture with its
 *                      words as an invisible text layer;
 *   scan.pdf           two scanned pages with no text layer, whose words only text
 *                      recognition can read. The labels list each drawn line with its
 *                      place and size, so a test can stand in for a recogniser.
 *
 * Every word was written for these files, the pictures are drawn by seeded code
 * and the scans use a five by seven bitmap face declared below, so the files are
 * redistributable under the repository's licence and no font, canvas or clock is
 * involved. The bytes are reproducible: stored zip entries at one fixed time,
 * a fixed `now` for the pptx writer, hand-written PDFs with no dates or ids, and
 * page pictures compressed by the in-repo `zlibCompress`.
 * `tests/read-extract-fixtures.test.ts` rebuilds every file in memory and compares
 * the bytes with the committed ones.
 *
 * Usage: node scripts/build-read-extract-fixtures.ts [--out=<dir>]
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { zipSync } from 'fflate';

import { zlibCompress } from '../engine/src/deflate.ts';
import { buildPptxParts, EMU_PER_PX, type PptxLayout, type PptxSlide } from '../engine/src/pptx.ts';
import { packPng } from '../engine/src/png.ts';

// ─── the label contract ──────────────────────────────────────────────────────

/** Where a block's words come from, in the values `ExtractOriginV1` uses. */
export type FixtureOriginV1 = 'authored' | 'text-layer' | 'recognized';

/** One line drawn into a scanned page picture: what a stand-in recogniser reads back. */
export interface FixtureDrawnLineV1 {
  text: string;
  /** Top left of the first glyph cell, in page picture px. */
  x: number;
  y: number;
  /** Pixels per glyph dot: a glyph is five dots wide and seven tall on a six dot advance. */
  scale: number;
  /** The ink colour as `#rrggbb`; a light ink is the faint line a recogniser is less sure of. */
  ink: string;
}

export interface FixtureBlockV1 {
  text: string;
  origin: FixtureOriginV1;
  /** The role a correct reading gives the frame, when the fixture pins one. */
  role?: 'title' | 'body';
}

export interface FixturePageV1 {
  page: number;
  /** BCP 47 tags of the languages on the page. */
  languages: string[];
  /** The text blocks a correct reading returns, in reading order. */
  blocks: FixtureBlockV1[];
  /** The page is one picture of its text. */
  scanned?: boolean;
  /** On a scanned page: how its words reach the extract. */
  read?: 'text-layer' | 'recognized';
  /** The speaker notes, as the inventory's `notes.text` holds them. */
  notes?: string;
  tables?: string[][][];
  /** Pictures on the page that are not the page itself. */
  pictures?: number;
  /** For a scanned page: the size of its picture and each line drawn into the picture. */
  picture?: { width: number; height: number };
  drawn?: FixtureDrawnLineV1[];
}

export interface ReadExtractFixtureLabelsV1 {
  fixture: string;
  version: 1;
  builder: 'scripts/build-read-extract-fixtures.ts';
  licence: 'MPL-2.0';
  about: string;
  pages: FixturePageV1[];
}

// ─── fixed inputs ────────────────────────────────────────────────────────────

/** Local-time text on purpose: the zip clock field is written from local getters. */
const ZIP_MTIME = '2026-01-01T00:00:00';
const NOW = '2026-01-01T00:00:00Z';
const DECK_W = 1280;
const DECK_H = 720;
const px = (v: number): number => Math.round(v * EMU_PER_PX);

type Parts = Record<string, string | Uint8Array>;

function zipParts(parts: Parts): Uint8Array {
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const name of Object.keys(parts).sort()) {
    const value = parts[name];
    if (value === undefined) continue;
    files[name] = typeof value === 'string' ? enc.encode(value) : value;
  }
  return zipSync(files, { level: 0, mtime: ZIP_MTIME });
}

/** A seeded 32-bit generator, so every picture is the same on every machine. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small photo-like picture: a sky gradient over seeded hills. */
function landscapePng(): Uint8Array {
  const w = 320, h = 180;
  const rand = rng(203);
  const ridge = Array.from({ length: w }, (_, x) => 110 + Math.round(18 * Math.sin(x / 37) + 10 * Math.sin(x / 11 + 1) + rand() * 3));
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const ground = y >= ridge[x]!;
      out[i] = ground ? 46 + (y % 7) : 120 + Math.round((y / h) * 90);
      out[i + 1] = ground ? 110 + (x % 5) : 170 + Math.round((y / h) * 60);
      out[i + 2] = ground ? 60 : 230;
      out[i + 3] = 255;
    }
  }
  return packPng(out, { width: w, height: h });
}

// ─── the bitmap face for the scans ───────────────────────────────────────────

/**
 * Five by seven capitals, the full stop and an E with an acute accent, whose
 * accent sits in two rows above the cell. A scan has to look like a printed page,
 * and a real font file would make the bytes depend on a shaper.
 */
const GLYPHS: Record<string, string[]> = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  'É': ['...#.', '..#..', '#####', '#....', '#....', '####.', '#....', '#....', '#####'],
};

function hexInk(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`build-read-extract-fixtures: ${hex} is not #rrggbb`);
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
}

/** Paint one line of capitals into an RGB buffer. A glyph taller than seven rows grows upward. */
function drawLine(buf: Uint8Array, w: number, h: number, line: FixtureDrawnLineV1): void {
  const ink = hexInk(line.ink);
  let cursor = line.x;
  for (const ch of line.text) {
    const glyph = GLYPHS[ch];
    if (!glyph) throw new Error(`build-read-extract-fixtures: no glyph for ${JSON.stringify(ch)}`);
    const top = line.y - (glyph.length - 7) * line.scale;
    for (let gy = 0; gy < glyph.length; gy++) {
      const row = glyph[gy] ?? '';
      for (let gx = 0; gx < row.length; gx++) {
        if (row[gx] !== '#') continue;
        for (let sy = 0; sy < line.scale; sy++) {
          for (let sx = 0; sx < line.scale; sx++) {
            const x = cursor + gx * line.scale + sx;
            const y = top + gy * line.scale + sy;
            if (x < 0 || x >= w || y < 0 || y >= h) throw new Error(`build-read-extract-fixtures: ${JSON.stringify(line.text)} runs off the ${w} by ${h} page`);
            const i = (y * w + x) * 3;
            buf[i] = ink[0]; buf[i + 1] = ink[1]; buf[i + 2] = ink[2];
          }
        }
      }
    }
    cursor += 6 * line.scale;
  }
}

/**
 * A page picture: off-white paper that darkens a little toward the foot, as a
 * scanner's lamp falls off, then the drawn lines. No per-pixel noise, so the page
 * compresses to a few kilobytes.
 */
function scanRgb(w: number, h: number, lines: FixtureDrawnLineV1[]): Uint8Array {
  const buf = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const v = 250 - Math.floor((y / h) * 8);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      buf[i] = v; buf[i + 1] = v; buf[i + 2] = v - 3;
    }
  }
  for (const line of lines) drawLine(buf, w, h, line);
  return buf;
}

// ─── a minimal PDF writer ────────────────────────────────────────────────────

/** One text line on a PDF page, in points from the top left. */
interface PdfTextLine {
  text: string;
  font: 'F1' | 'F2';
  size: number;
  x: number;
  /** Baseline, in points from the top of the page. */
  y: number;
  /** Render mode 3: the words are on the page but not painted, as in a scan's text layer. */
  invisible?: boolean;
}

interface PdfPage {
  widthPt: number;
  heightPt: number;
  lines: PdfTextLine[];
  /** A picture over the whole page, RGB. */
  image?: { width: number; height: number; rgb: Uint8Array };
}

/** WinAnsi bytes for a string the standard fonts can show, escaped for a literal string. */
function winAnsiLiteral(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += `\\${ch}`;
    else if (code >= 0x20 && code < 0x7f) out += ch;
    else if (code >= 0xa0 && code <= 0xff) out += `\\${code.toString(8).padStart(3, '0')}`;
    else throw new Error(`build-read-extract-fixtures: ${JSON.stringify(ch)} is not in WinAnsi; the standard fonts cannot show it`);
  }
  return `(${out})`;
}

/**
 * Pages of Helvetica text in WinAnsi, optionally over one page picture. Written by
 * hand because a library would stamp a creation date or an id into the bytes.
 */
function writePdf(pages: PdfPage[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (bytes: Uint8Array): void => { chunks.push(bytes); length += bytes.length; };
  const text = (s: string): void => push(enc.encode(s));
  const begin = (n: number): void => { offsets[n] = length; text(`${n} 0 obj\n`); };
  const end = (): void => text('endobj\n');

  // 1 catalog, 2 pages, 3 Helvetica, 4 Helvetica-Bold, then per page: page, content, image.
  const pageNo = pages.map((_, i) => 5 + i * 3);
  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  begin(1); text('<< /Type /Catalog /Pages 2 0 R >>\n'); end();
  begin(2); text(`<< /Type /Pages /Count ${pages.length} /Kids [${pageNo.map((n) => `${n} 0 R`).join(' ')}] >>\n`); end();
  begin(3); text('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\n'); end();
  begin(4); text('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\n'); end();

  pages.forEach((page, i) => {
    const n = pageNo[i]!;
    const xobject = page.image ? ` /XObject << /Im0 ${n + 2} 0 R >>` : '';
    begin(n);
    text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.widthPt} ${page.heightPt}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobject} >> /Contents ${n + 1} 0 R >>\n`);
    end();
    let stream = page.image ? `q ${page.widthPt} 0 0 ${page.heightPt} 0 0 cm /Im0 Do Q\n` : '';
    for (const line of page.lines) {
      const baseline = page.heightPt - line.y;
      stream += `BT /${line.font} ${line.size} Tf ${line.invisible ? '3 Tr ' : ''}${line.x} ${baseline} Td ${winAnsiLiteral(line.text)} Tj ET\n`;
    }
    begin(n + 1); text(`<< /Length ${stream.length} >>\nstream\n${stream}endstream\n`); end();
    if (page.image) {
      const deflated = zlibCompress(page.image.rgb);
      begin(n + 2);
      text(`<< /Type /XObject /Subtype /Image /Width ${page.image.width} /Height ${page.image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${deflated.length} >>\nstream\n`);
      push(deflated);
      text('\nendstream\n');
      end();
    } else {
      // Keep the numbering regular: an empty object where a page has no picture.
      begin(n + 2); text('null\n'); end();
    }
  });

  const total = 4 + pages.length * 3;
  const xref = length;
  text(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let k = 1; k <= total; k++) text(`${String(offsets[k] ?? 0).padStart(10, '0')} 00000 n \n`);
  text(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
}

// ─── multilingual.pptx ───────────────────────────────────────────────────────

const LAYOUT: PptxLayout = {
  name: 'Title and text',
  placeholders: [{ type: 'title', x: px(80), y: px(60), cx: px(1120), cy: px(100) }],
};

const TITLE = { x: 80, y: 60, w: 1120, h: 100 };
const BODY_A = { x: 80, y: 200, w: 1120, h: 60 };
const BODY_B = { x: 80, y: 290, w: 1120, h: 60 };

interface DeckSlideSpec {
  languages: string[];
  title: string;
  body: string[];
  notes?: string;
  picture?: boolean;
  table?: string[][];
}

const DECK: DeckSlideSpec[] = [
  {
    languages: ['en'],
    title: 'Reading a file in many languages',
    body: ['Every block keeps its page, its place and its source.', 'Recognised words are never mixed with written ones.'],
    notes: 'Open with the reading order.',
    picture: true,
  },
  {
    languages: ['fr'],
    title: 'Lecture et extraction',
    body: ['Évaluer la qualité de la reconnaissance, page après page.', 'Les accents comptent : é, è, à, ç, ô et ï.'],
  },
  {
    languages: ['de', 'es'],
    title: 'Größe und Übersicht',
    body: ['Straße, Fußgänger und Bäume.', 'Señales en español: año, niño y corazón.'],
  },
  {
    languages: ['el', 'ru'],
    title: 'Ανάγνωση κειμένου',
    body: ['Κάθε σελίδα διαβάζεται με τη σειρά.', 'Извлечение текста из файла.'],
    notes: 'Η σειρά ανάγνωσης μετράει.',
  },
  {
    languages: ['ja', 'ar'],
    title: '文字を読み取る',
    body: ['استخراج النص من الملف'],
    table: [['Language', 'Word'], ['Deutsch', 'Wörterbuch'], ['Ελληνικά', 'λεξικό'], ['日本語', '辞書']],
  },
];

function buildDeck(): { bytes: Uint8Array; labels: ReadExtractFixtureLabelsV1 } {
  const photo = landscapePng();
  const textShape = (box: typeof TITLE, value: string, sizePt: number, title = false): PptxSlide['shapes'][number] => ({
    kind: 'text', x: px(box.x), y: px(box.y), cx: px(box.w), cy: px(box.h),
    ...(title ? { ph: { type: 'title' as const } } : {}),
    paras: [{ runs: [{ text: value, sizePt }] }],
  });
  const slides: PptxSlide[] = DECK.map((spec) => {
    const shapes: PptxSlide['shapes'] = [textShape(TITLE, spec.title, 36, true)];
    spec.body.forEach((line, k) => { shapes.push(textShape(k === 0 ? BODY_A : BODY_B, line, 20)); });
    const media: PptxSlide['media'] = [];
    if (spec.picture) {
      media.push({ bytes: photo, ext: 'png' });
      shapes.push({ kind: 'pic', x: px(800), y: px(400), cx: px(320), cy: px(180), media: 0, name: 'landscape' });
    }
    if (spec.table) {
      const cols = [px(300), px(300)];
      shapes.push({
        kind: 'table', x: px(80), y: px(400), cx: px(600), cy: px(200), cols, firstRow: true,
        rows: spec.table.map((row) => ({ cells: row.map((cell) => ({ text: cell, sizePt: 16 })) })),
      });
    }
    return { shapes, media, layout: 0, ...(spec.notes ? { notes: spec.notes } : {}) };
  });
  const parts = buildPptxParts(slides, {
    emuW: px(DECK_W), emuH: px(DECK_H), now: NOW, layouts: [LAYOUT],
    meta: { title: 'Read and extract fixture: many languages' },
  });
  const labels: ReadExtractFixtureLabelsV1 = {
    fixture: 'multilingual.pptx',
    version: 1,
    builder: 'scripts/build-read-extract-fixtures.ts',
    licence: 'MPL-2.0',
    about: 'Five slides of authored text in eight languages and five scripts, with a picture, speaker notes and a table whose cells mix scripts.',
    pages: DECK.map((spec, i) => {
      const page: FixturePageV1 = {
        page: i + 1,
        languages: spec.languages,
        blocks: [
          { text: spec.title, origin: 'authored', role: 'title' },
          ...spec.body.map((line): FixtureBlockV1 => ({ text: line, origin: 'authored' })),
        ],
      };
      if (spec.notes) page.notes = spec.notes;
      if (spec.table) page.tables = [spec.table];
      page.pictures = spec.picture ? 1 : 0;
      return page;
    }),
  };
  return { bytes: zipParts(parts), labels };
}

// ─── multilingual.pdf ────────────────────────────────────────────────────────

const LETTER_W = 612;
const LETTER_H = 792;

const COLUMN_LEFT = [
  'The left column comes first.',
  'It holds five short lines,',
  'each one its own block,',
  'and a reader takes all five',
  'before it moves to the right.',
];
const COLUMN_RIGHT = [
  'The right column comes second.',
  'A reader that runs across',
  'the gutter mixes the two',
  'columns line by line, which',
  'this page is here to catch.',
];
const ACCENTS = [
  'Évaluer la qualité, page après page.',
  'Größe, Straße und Übersicht.',
  'Año, niño y corazón.',
  'Ça coûte très peu, dit-il.',
];
/** The scan page's drawn lines and their text layer. */
const SEARCHABLE_LINES: FixtureDrawnLineV1[] = [
  { text: 'A SEARCHABLE SCAN', x: 80, y: 120, scale: 6, ink: '#1a1a1a' },
  { text: 'ITS WORDS ARE AN INVISIBLE LAYER', x: 80, y: 260, scale: 3, ink: '#1a1a1a' },
];
const SCAN_PX_W = 816;
const SCAN_PX_H = 1056;

function buildPdf(): { bytes: Uint8Array; labels: ReadExtractFixtureLabelsV1 } {
  const columns: PdfTextLine[] = [
    { text: 'Reading order in two columns', font: 'F2', size: 22, x: 72, y: 96 },
    ...COLUMN_LEFT.map((line, k): PdfTextLine => ({ text: line, font: 'F1', size: 11, x: 72, y: 150 + k * 16 })),
    ...COLUMN_RIGHT.map((line, k): PdfTextLine => ({ text: line, font: 'F1', size: 11, x: 330, y: 150 + k * 16 })),
  ];
  const accents: PdfTextLine[] = [
    { text: 'Accents et Umlaute', font: 'F2', size: 22, x: 72, y: 96 },
    ...ACCENTS.map((line, k): PdfTextLine => ({ text: line, font: 'F1', size: 13, x: 72, y: 150 + k * 22 })),
  ];
  // The text layer lies over the painted words, scaled from picture px to points.
  const toPt = LETTER_W / SCAN_PX_W;
  const layer: PdfTextLine[] = SEARCHABLE_LINES.map((line) => ({
    text: line.text, font: 'F1', size: Math.round(7 * line.scale * toPt * 1.3), x: Math.round(line.x * toPt), y: Math.round((line.y + 7 * line.scale) * toPt), invisible: true,
  }));
  const bytes = writePdf([
    { widthPt: LETTER_W, heightPt: LETTER_H, lines: columns },
    { widthPt: LETTER_W, heightPt: LETTER_H, lines: accents },
    { widthPt: LETTER_W, heightPt: LETTER_H, lines: layer, image: { width: SCAN_PX_W, height: SCAN_PX_H, rgb: scanRgb(SCAN_PX_W, SCAN_PX_H, SEARCHABLE_LINES) } },
  ]);
  const labels: ReadExtractFixtureLabelsV1 = {
    fixture: 'multilingual.pdf',
    version: 1,
    builder: 'scripts/build-read-extract-fixtures.ts',
    licence: 'MPL-2.0',
    about: 'A two-column English page, a page of French, German and Spanish with their accents in WinAnsi Helvetica, and a searchable scan whose words are an invisible text layer over the page picture.',
    pages: [
      {
        page: 1,
        languages: ['en'],
        blocks: [
          { text: 'Reading order in two columns', origin: 'authored' },
          ...COLUMN_LEFT.map((line): FixtureBlockV1 => ({ text: line, origin: 'authored' })),
          ...COLUMN_RIGHT.map((line): FixtureBlockV1 => ({ text: line, origin: 'authored' })),
        ],
      },
      {
        page: 2,
        languages: ['fr', 'de', 'es'],
        blocks: [
          { text: 'Accents et Umlaute', origin: 'authored' },
          ...ACCENTS.map((line): FixtureBlockV1 => ({ text: line, origin: 'authored' })),
        ],
      },
      {
        page: 3,
        languages: ['en'],
        scanned: true,
        read: 'text-layer',
        blocks: [{ text: SEARCHABLE_LINES.map((l) => l.text).join('\n'), origin: 'text-layer' }],
        picture: { width: SCAN_PX_W, height: SCAN_PX_H },
        drawn: SEARCHABLE_LINES,
      },
    ],
  };
  return { bytes, labels };
}

// ─── scan.pdf ────────────────────────────────────────────────────────────────

const SCAN_PAGES: Array<{ languages: string[]; lines: FixtureDrawnLineV1[] }> = [
  {
    languages: ['en'],
    lines: [
      { text: 'READ THIS PAGE', x: 80, y: 110, scale: 7, ink: '#111111' },
      { text: 'THE SECOND LINE IS SMALLER', x: 80, y: 300, scale: 4, ink: '#111111' },
      { text: 'A THIRD AND FINAL LINE.', x: 80, y: 480, scale: 4, ink: '#111111' },
    ],
  },
  {
    languages: ['fr'],
    lines: [
      { text: 'LA QUALITÉ COMPTE', x: 80, y: 130, scale: 7, ink: '#111111' },
      { text: 'UNE LIGNE CLAIRE EST PLUS DURE', x: 80, y: 330, scale: 4, ink: '#b4b4b4' },
    ],
  },
];

function buildScan(): { bytes: Uint8Array; labels: ReadExtractFixtureLabelsV1 } {
  const pages = SCAN_PAGES.map((page): PdfPage => ({
    widthPt: LETTER_W, heightPt: LETTER_H, lines: [],
    image: { width: SCAN_PX_W, height: SCAN_PX_H, rgb: scanRgb(SCAN_PX_W, SCAN_PX_H, page.lines) },
  }));
  const labels: ReadExtractFixtureLabelsV1 = {
    fixture: 'scan.pdf',
    version: 1,
    builder: 'scripts/build-read-extract-fixtures.ts',
    licence: 'MPL-2.0',
    about: 'Two scanned pages with no text layer, in English and French: one picture per page, with a faint line on the second page that a recogniser should be less sure of.',
    pages: SCAN_PAGES.map((page, i) => ({
      page: i + 1,
      languages: page.languages,
      scanned: true,
      read: 'recognized',
      blocks: page.lines.map((line): FixtureBlockV1 => ({ text: line.text, origin: 'recognized' })),
      picture: { width: SCAN_PX_W, height: SCAN_PX_H },
      drawn: page.lines,
    })),
  };
  return { bytes: writePdf(pages), labels };
}

// ─── entry point ─────────────────────────────────────────────────────────────

/** Each fixture stays under this, so the set is cheap to clone and to read in a test. */
const MAX_FIXTURE_BYTES = 400 * 1024;

export interface BuiltFixtureV1 {
  name: string;
  bytes: Uint8Array;
  labels: ReadExtractFixtureLabelsV1;
  /** The sidecar file name: the fixture's own name followed by `.labels.json`. */
  labelsName: string;
  /** The sidecar as written. */
  labelsText: string;
}

/** Every fixture and its labels, in memory. */
export function buildReadExtractFixtures(): BuiltFixtureV1[] {
  const built = [
    { name: 'multilingual.pptx', ...buildDeck() },
    { name: 'multilingual.pdf', ...buildPdf() },
    { name: 'scan.pdf', ...buildScan() },
  ];
  return built.map((fixture) => {
    if (fixture.bytes.length > MAX_FIXTURE_BYTES) {
      throw new Error(`build-read-extract-fixtures: ${fixture.name} is ${fixture.bytes.length} bytes, over the ${MAX_FIXTURE_BYTES} byte limit`);
    }
    return {
      ...fixture,
      labelsName: `${fixture.name}.labels.json`,
      labelsText: `${JSON.stringify(fixture.labels, null, 2)}\n`,
    };
  });
}

export const READ_EXTRACT_FIXTURES_DIR = fileURLToPath(new URL('../tests/fixtures/read-extract/', import.meta.url));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => !arg.startsWith('--out='));
  if (unknown.length > 0) {
    console.error(`build-read-extract-fixtures: ${unknown.join(' ')} is not an option. Usage: node scripts/build-read-extract-fixtures.ts [--out=<dir>]`);
    process.exit(2);
  }
  const outArg = args.find((arg) => arg.startsWith('--out='));
  const outDir = outArg ? path.resolve(outArg.slice('--out='.length)) : READ_EXTRACT_FIXTURES_DIR;
  await mkdir(outDir, { recursive: true });
  for (const fixture of buildReadExtractFixtures()) {
    await writeFile(path.join(outDir, fixture.name), fixture.bytes);
    await writeFile(path.join(outDir, fixture.labelsName), fixture.labelsText);
    console.log(`${fixture.name}: ${fixture.bytes.length} bytes`);
  }
}
