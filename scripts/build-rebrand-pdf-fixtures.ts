#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Build the born-digital PDF fixture for the rebrand source adapter (plan 274
 * work package 2), plus the labels sidecar that states what a correct reading
 * of each authored object is.
 *
 * `editable.pdf` is three 16:9 pages (720 by 405 points, 960 by 540 reference
 * px) of the kind a deck exported to PDF produces:
 *
 *   - a white ground painted first;
 *   - a running header inside `/Artifact <</Type /Pagination /Subtype /Header>>`,
 *     a line of small grey text and a rule under it;
 *   - a title in Helvetica-Bold, two body lines at sixteen point, one of them
 *     with a coloured run set mid-block, and a note at eleven point;
 *   - a small vector mark (a circle drawn with curves and a triangle beside it)
 *     at the same place on every page;
 *   - a picture: pages 2 and 3 draw ONE image object, page 1 draws a second
 *     object holding the same bytes, so a reader that stores by content stores
 *     one picture;
 *   - a thin coloured bar across the foot of the page;
 *   - a footer inside `/Artifact <</Type /Pagination /Subtype /Footer>>`, and a
 *     page number outside it.
 *
 * Reproducible on purpose, the same way `scripts/build-rebrand-fixtures.ts`
 * writes `flattened.pdf`: a hand-written file with no creation date, a fixed
 * trailer /ID, uncompressed content streams and the one compressed payload (the
 * picture) through the in-repo `zlibCompress`, so no committed byte comes from a
 * versioned dependency. `tests/rebrand-source-pdf.test.ts` rebuilds both files
 * into a scratch directory and compares the bytes.
 *
 * Usage: node scripts/build-rebrand-pdf-fixtures.ts [--out=<dir>]
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFName, degrees, type PDFContext, type PDFObject, type PDFRef } from 'pdf-lib';

import { zlibCompress } from '../engine/src/deflate.ts';
import { REBRAND_CONTRACT_VERSION } from '../packages/core/src/rebrand-v1.ts';
import type {
  FixtureColorLabelV1,
  FixtureObjectLabelV1,
  FixtureSlideLabelV1,
  RebrandFixtureLabelsV1,
} from '../tests/helpers/rebrand-fixtures.ts';

// ─── fixed inputs ────────────────────────────────────────────────────────────

const PAGE_W = 720;
const PAGE_H = 405;
/** Reference px per point. */
const PX = 96 / 72;
const TITLES = ['Revenue growth', 'Market share', 'Next steps'];
const TITLE_HEX = '#1f4e79';
const ACCENT_HEX = '#d65a28';
const NOTE_HEX = '#555555';
const BAR_HEX = '#1f4e79';
const PICTURE = { w: 120, h: 68 };
/** Where each page draws its picture, in points from the bottom-left. */
const PICTURE_AT: Array<{ x: number; y: number; w: number; h: number }> = [
  { x: 500, y: 150, w: 160, h: 90 },
  { x: 440, y: 120, w: 240, h: 135 },
  { x: 440, y: 120, w: 240, h: 135 },
];
/** The vector mark's circle: centre and radius in points from the bottom-left. */
const MARK = { cx: 650, cy: 345, r: 14 };
/** The margin a vector object's SVG frame, and so its box, keeps around the mark (PDF_VECTOR_PAD). */
const VECTOR_PAD = 2;

// ─── a seeded picture ────────────────────────────────────────────────────────

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A photo-like RGB picture: a smooth gradient with grain. */
function pictureRgb(): Uint8Array {
  const { w, h } = PICTURE;
  const noise = rng(20260924);
  const out = new Uint8Array(w * h * 3);
  const clamp = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const v = y / (h - 1);
      const grain = (noise() - 0.5) * 24;
      const i = (y * w + x) * 3;
      out[i] = clamp(60 + 140 * u + 20 * v + grain);
      out[i + 1] = clamp(110 + 50 * v + 30 * (1 - u) + grain);
      out[i + 2] = clamp(160 - 60 * u + 50 * v + grain);
    }
  }
  return out;
}

// ─── content ─────────────────────────────────────────────────────────────────

const rgbOp = (hex: string, op: 'rg' | 'RG'): string => {
  const n = (k: number): string => (parseInt(hex.slice(1 + k * 2, 3 + k * 2), 16) / 255).toFixed(4);
  return `${n(0)} ${n(1)} ${n(2)} ${op}`;
};
const esc = (s: string): string => s.replace(/[\\()]/g, (c) => `\\${c}`);

/** A circle as four Bezier quarters, then a triangle to its right. */
function markPaths(): string {
  const { cx, cy, r } = MARK;
  const k = 0.5523 * r;
  const f = (n: number): string => n.toFixed(2);
  const circle = [
    `${f(cx + r)} ${f(cy)} m`,
    `${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)} c`,
    `${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} c`,
    `${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} c`,
    `${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} c h f`,
  ].join(' ');
  const tri = `${f(cx + r + 4)} ${f(cy - r)} m ${f(cx + r + 26)} ${f(cy - r)} l ${f(cx + r + 15)} ${f(cy + r)} l h f`;
  return `${rgbOp(TITLE_HEX, 'rg')} ${circle}\n${rgbOp(ACCENT_HEX, 'rg')} ${tri}`;
}

function pageContent(index: number, imageName: string): string {
  const pic = PICTURE_AT[index]!;
  return [
    // The ground.
    `1 1 1 rg 0 0 ${PAGE_W} ${PAGE_H} re f`,
    // The running header, text and rule, marked as a pagination artifact.
    '/Artifact <</Type /Pagination /Subtype /Header>> BDC',
    `BT /F1 9 Tf 0.4 0.4 0.4 rg 36 386 Td (${esc('ACME QUARTERLY REVIEW')}) Tj ET`,
    `0.6 0.6 0.6 RG 1 w 36 378 m ${PAGE_W - 36} 378 l S`,
    'EMC',
    // The title.
    `BT /F2 28 Tf ${rgbOp(TITLE_HEX, 'rg')} 36 330 Td (${esc(TITLES[index]!)}) Tj ET`,
    // Body at sixteen point; the second line changes colour mid-block.
    `BT /F1 16 Tf 0 0 0 rg 36 290 Td (${esc('Body line one at sixteen points')}) Tj ET`,
    `BT /F1 16 Tf 0 0 0 rg 36 266 Td (${esc('Second line holds ')}) Tj ${rgbOp(ACCENT_HEX, 'rg')} (${esc('a coloured run')}) Tj 0 0 0 rg (${esc(' inside it')}) Tj ET`,
    // A note at eleven point.
    `BT /F1 11 Tf ${rgbOp(NOTE_HEX, 'rg')} 36 240 Td (${esc('A smaller note at eleven points')}) Tj ET`,
    // The mark.
    markPaths(),
    // The picture.
    `q ${pic.w} 0 0 ${pic.h} ${pic.x} ${pic.y} cm /${imageName} Do Q`,
    // The bar.
    `${rgbOp(BAR_HEX, 'rg')} 36 34 ${PAGE_W - 72} 4 re f`,
    // The footer, marked, and the page number, not marked.
    '/Artifact <</Type /Pagination /Subtype /Footer>> BDC',
    `BT /F1 8 Tf 0.4 0.4 0.4 rg 36 18 Td (${esc('Confidential - ACME Corp')}) Tj ET`,
    'EMC',
    `BT /F1 10 Tf 0 0 0 rg 676 18 Td (${index + 1}) Tj ET`,
    '',
  ].join('\n');
}

// ─── a minimal pdf writer ────────────────────────────────────────────────────

function editablePdf(): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (bytes: Uint8Array): void => { chunks.push(bytes); length += bytes.length; };
  const text = (s: string): void => push(enc.encode(s));
  const beginObject = (n: number): void => { offsets[n] = length; text(`${n} 0 obj\n`); };
  const endObject = (): void => text('endobj\n');

  // 1 catalog, 2 pages, 3 and 4 fonts, 5 info, 6 the shared picture, 7 the same
  // bytes as a second object, then per page: page, content.
  const pageNo = (i: number): number => 8 + i * 2;
  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  beginObject(1);
  text('<< /Type /Catalog /Pages 2 0 R >>\n');
  endObject();

  beginObject(2);
  text(`<< /Type /Pages /Count ${TITLES.length} /Kids [${TITLES.map((_, i) => `${pageNo(i)} 0 R`).join(' ')}] >>\n`);
  endObject();

  beginObject(3);
  text('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\n');
  endObject();
  beginObject(4);
  text('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\n');
  endObject();

  beginObject(5);
  text('<< /Title (Editable rebrand fixture) /Producer (scripts/build-rebrand-pdf-fixtures.ts) >>\n');
  endObject();

  const deflated = zlibCompress(pictureRgb());
  for (const n of [6, 7]) {
    beginObject(n);
    text(
      `<< /Type /XObject /Subtype /Image /Width ${PICTURE.w} /Height ${PICTURE.h} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${deflated.length} >>\nstream\n`,
    );
    push(deflated);
    text('\nendstream\n');
    endObject();
  }

  TITLES.forEach((_, i) => {
    const page = pageNo(i);
    const imageName = i === 0 ? 'Im1' : 'Im0';
    const imageObject = i === 0 ? 7 : 6;
    beginObject(page);
    text(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /${imageName} ${imageObject} 0 R >> >> /Contents ${page + 1} 0 R >>\n`,
    );
    endObject();
    const stream = pageContent(i, imageName);
    beginObject(page + 1);
    text(`<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}endstream\n`);
    endObject();
  });

  const total = pageNo(TITLES.length - 1) + 1;
  const xref = length;
  text(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= total; n++) text(`${String(offsets[n] ?? 0).padStart(10, '0')} 00000 n \n`);
  text(
    `trailer\n<< /Size ${total + 1} /Root 1 0 R /Info 5 0 R ` +
    '/ID [<4c6f6c6c7952656272616e6450646630> <4c6f6c6c7952656272616e6450646630>] >>\n' +
    `startxref\n${xref}\n%%EOF\n`,
  );

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
}

// ─── labels ──────────────────────────────────────────────────────────────────

/** A box in points from the bottom-left, as reference px from the top-left. */
function boxPx(x: number, y: number, w: number, h: number): { x: number; y: number; w: number; h: number } {
  const r = (n: number): number => Math.round(n * PX * 100) / 100;
  return { x: r(x), y: r(PAGE_H - y - h), w: r(w), h: r(h) };
}

/**
 * The objects of one page in paint order, which is the order the adapter numbers
 * them in: `<page id>.<position>`. The ground is the slide's background colour,
 * not an object, so it has no label.
 */
function pageLabels(index: number): FixtureObjectLabelV1[] {
  const pageId = `page${index + 1}`;
  const pic = PICTURE_AT[index]!;
  const specs: Array<Omit<FixtureObjectLabelV1, 'id'>> = [
    {
      authored: 'header-text', origin: 'pdf-artifact', kind: 'text', class: 'recurring-text',
      fidelity: { state: 'editable' }, text: 'ACME QUARTERLY REVIEW',
      note: 'inside the Header artifact span, so the document itself says this is running furniture',
    },
    {
      authored: 'header-rule', origin: 'pdf-artifact', kind: 'vector', class: 'decoration',
      fidelity: { state: 'approximate', reason: 'reader-approximation' },
      note: 'a stroked path inside the same Header span: a non-text node the span has to reach too',
    },
    { authored: 'title', origin: 'slide', kind: 'text', class: 'title', fidelity: { state: 'editable' }, mustKeep: true, text: TITLES[index]! },
    { authored: 'body-1', origin: 'slide', kind: 'text', class: 'body', fidelity: { state: 'editable' }, mustKeep: true, text: 'Body line one at sixteen points' },
    {
      authored: 'body-2', origin: 'slide', kind: 'text', class: 'body', fidelity: { state: 'editable' }, mustKeep: true,
      text: 'Second line holds a coloured run inside it',
      note: `three runs in one line: black, ${ACCENT_HEX}, black; the colour changes inside one BT block`,
    },
    { authored: 'note', origin: 'slide', kind: 'text', class: 'body', fidelity: { state: 'editable' }, mustKeep: true, text: 'A smaller note at eleven points' },
    {
      authored: 'mark', origin: 'slide', kind: 'vector', class: 'logo-candidate',
      fidelity: { state: 'approximate', reason: 'reader-approximation' },
      boxPx: boxPx(MARK.cx - MARK.r - VECTOR_PAD, MARK.cy - MARK.r - VECTOR_PAD, MARK.r * 2 + 26 + VECTOR_PAD * 2, MARK.r * 2 + VECTOR_PAD * 2),
      note: 'a curved circle and a triangle, clustered into one mark; the same on every page. The box is the SVG frame: the mark with a 2 pt margin',
    },
    {
      authored: index === 0 ? 'picture-copy' : 'picture', origin: 'slide', kind: 'pic', class: 'photo',
      fidelity: { state: 'raster-preserved' }, mustKeep: true, boxPx: boxPx(pic.x, pic.y, pic.w, pic.h),
      note: index === 0
        ? 'a second image object holding the same bytes as the one pages 2 and 3 draw: one stored picture'
        : 'one image object drawn on pages 2 and 3',
    },
    { authored: 'bar', origin: 'slide', kind: 'shape', class: 'decoration', fidelity: { state: 'editable' }, boxPx: boxPx(36, 34, PAGE_W - 72, 4) },
    {
      authored: 'footer', origin: 'pdf-artifact', kind: 'text', class: 'footer', fidelity: { state: 'editable' }, mustKeep: true,
      text: 'Confidential - ACME Corp',
      note: 'inside the Footer artifact span; a confidentiality line a default plan must not remove',
    },
    { authored: 'page-number', origin: 'slide', kind: 'text', class: 'page-number', fidelity: { state: 'editable' }, text: String(index + 1) },
  ];
  return specs.map((spec, z) => ({ id: `${pageId}.${z}`, ...spec }));
}

function editableLabels(): RebrandFixtureLabelsV1 {
  const slides: FixtureSlideLabelV1[] = TITLES.map((_, i) => ({
    id: `page${i + 1}`,
    index: i,
    widthPx: PAGE_W * PX,
    heightPx: PAGE_H * PX,
    flattened: false,
    objects: pageLabels(i),
  }));
  const all = slides.flatMap((s) => s.objects);
  const colors: FixtureColorLabelV1[] = [
    { hex: TITLE_HEX, role: 'ink', objectIds: slides.map((s) => `${s.id}.2`), note: 'the title ink on every page' },
    { hex: ACCENT_HEX, role: 'ink', objectIds: slides.map((s) => `${s.id}.4`), note: 'the coloured run inside the second body line' },
    { hex: '#ffffff', role: 'bg', objectIds: [], slideId: 'page1', note: 'the ground every page paints first, read as the background' },
  ];
  return {
    fixture: 'editable.pdf',
    version: REBRAND_CONTRACT_VERSION,
    builder: 'scripts/build-rebrand-pdf-fixtures.ts',
    objectIdForm: '<page id>.<position in paint order>',
    slides,
    inherited: [],
    mustKeep: all.filter((o) => o.mustKeep).map((o) => o.id),
    colors,
  };
}

// ─── probe pages ─────────────────────────────────────────────────────────────

/** A PDF dictionary written as a plain object, the way pdf-lib's `context.obj` takes one (its dictionary form, as `stream` names it). */
export type ProbeDict = NonNullable<Parameters<PDFContext['stream']>[1]>;

/** One page of a probe PDF: a content stream and the few resources it names. */
export interface ProbePage {
  content: string;
  /** Points; 720 by 405 when absent. */
  width?: number;
  height?: number;
  /** Image XObjects: 8-bit DeviceRGB, `data` already encoded for `filter` (FlateDecode when absent). */
  images?: Record<string, { width: number; height: number; data: Uint8Array; filter?: string | null }>;
  /** Form XObjects by name, each a content stream over the page's own frame. */
  forms?: Record<string, string>;
  /** `/F1` is Helvetica; with `widths` it is a TrueType font stating these advances from `first`. */
  widths?: { first: number; widths: number[] };
  rotate?: number;
  cropBox?: [number, number, number, number];
  /** Structure elements for a tagged page, in document order, each owning marked-content ids. */
  tagged?: Array<{ type: string; mcids: number[] }>;
  /** /Pattern resources by name, each a dictionary (a tiling pattern's stream is not written). */
  patterns?: Record<string, ProbeDict>;
  /** /Shading resources by name, for the `sh` operator. */
  shadings?: Record<string, ProbeDict>;
  /**
   * More /Pattern and /Shading resources, built in the document's own context:
   * for a probe that needs an indirect object named from several places, or a
   * stream (a sampled function). Merged over `patterns` and `shadings`.
   */
  build?: (ctx: PDFContext) => { patterns?: Record<string, PDFObject>; shadings?: Record<string, PDFObject> };
}

/**
 * A small PDF built in memory through pdf-lib, for a test that probes one
 * behaviour of the reader. Never committed: the committed fixture above is
 * written by hand so that no byte of it comes from a versioned dependency.
 */
export async function buildProbePdf(pages: ProbePage[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const ctx = doc.context;
  const elements: PDFRef[] = [];
  for (const spec of pages) {
    const page = doc.addPage([spec.width ?? PAGE_W, spec.height ?? PAGE_H]);
    const font = spec.widths
      ? ctx.obj({
        Type: 'Font', Subtype: 'TrueType', BaseFont: 'Helvetica', Encoding: 'WinAnsiEncoding', FirstChar: spec.widths.first,
        LastChar: spec.widths.first + spec.widths.widths.length - 1, Widths: spec.widths.widths,
      })
      : ctx.obj({ Type: 'Font', Subtype: 'Type1', BaseFont: 'Helvetica', Encoding: 'WinAnsiEncoding' });
    const xobjects: Record<string, PDFRef> = {};
    for (const [name, img] of Object.entries(spec.images ?? {})) {
      const dict = { Type: 'XObject', Subtype: 'Image', Width: img.width, Height: img.height, ColorSpace: 'DeviceRGB', BitsPerComponent: 8 };
      xobjects[name] = ctx.register(ctx.stream(img.data, img.filter === null ? dict : { ...dict, Filter: img.filter ?? 'FlateDecode' }));
    }
    for (const [name, content] of Object.entries(spec.forms ?? {})) {
      xobjects[name] = ctx.register(ctx.stream(content, { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, spec.width ?? PAGE_W, spec.height ?? PAGE_H] }));
    }
    page.node.set(PDFName.of('Contents'), ctx.register(ctx.stream(spec.content)));
    const resources = ctx.obj({ Font: { F1: ctx.register(font) }, XObject: xobjects });
    const built = spec.build?.(ctx);
    const patterns = { ...spec.patterns, ...built?.patterns };
    const shadings = { ...spec.shadings, ...built?.shadings };
    if (Object.keys(patterns).length) resources.set(PDFName.of('Pattern'), ctx.obj(patterns));
    if (Object.keys(shadings).length) resources.set(PDFName.of('Shading'), ctx.obj(shadings));
    page.node.set(PDFName.of('Resources'), resources);
    if (spec.rotate) page.setRotation(degrees(spec.rotate));
    if (spec.cropBox) page.setCropBox(...spec.cropBox);
    for (const element of spec.tagged ?? []) {
      elements.push(ctx.register(ctx.obj({ Type: 'StructElem', S: element.type, Pg: page.ref, K: element.mcids })));
    }
  }
  if (elements.length) {
    doc.catalog.set(PDFName.of('StructTreeRoot'), ctx.register(ctx.obj({ Type: 'StructTreeRoot', K: elements })));
  }
  return doc.save({ useObjectStreams: false });
}

/** The paper colour of the partial scan's picture. */
export const PARTIAL_SCAN_PAPER = '#f4f1ea';
/** The partial scan's picture box, in points from the bottom-left: 600 by 340 of 720 by 405, 70 percent of the page. */
export const PARTIAL_SCAN_AT = { x: 60, y: 32, w: 600, h: 340 };

/**
 * A scanned page placed on a white page rather than filling it: the picture
 * covers 70 percent of the page (`PARTIAL_SCAN_AT`), on paper of its own colour
 * (`PARTIAL_SCAN_PAPER`), holding a dark title bar, three lines of body and a
 * coloured block, so region finding has something to cut. The pdf adapter reads
 * it as flattened (a scan at half the page or more), and the flattened rebuild
 * has to accept a picture that does not cover the slide. `pixels` is the picture
 * as RGB, so a test can hand the rebuild what the page shows.
 */
export function partialScanProbe(): { page: ProbePage; pixels: { width: number; height: number; rgb: Uint8Array } } {
  const width = 480;
  const height = 272;
  const rgb = new Uint8Array(width * height * 3);
  const paper = [0xf4, 0xf1, 0xea] as const;
  const fill = (x0: number, y0: number, w: number, h: number, c: readonly [number, number, number]): void => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) rgb.set(c, (y * width + x) * 3);
    }
  };
  fill(0, 0, width, height, paper);
  const ink = [0x22, 0x22, 0x22] as const;
  // A title: words of a heavy line, then three body lines of lighter words.
  for (const [x, w] of [[40, 70], [118, 96], [222, 54]] as const) fill(x, 40, w, 22, ink);
  for (let line = 0; line < 3; line++) {
    for (const [x, w] of [[40, 38], [84, 52], [142, 30], [178, 64], [248, 44]] as const) fill(x, 100 + line * 26, w, 10, ink);
  }
  fill(340, 110, 100, 90, [0x30, 0xba, 0x78]);
  return {
    page: {
      content: `1 1 1 rg 0 0 ${PAGE_W} ${PAGE_H} re f\nq ${PARTIAL_SCAN_AT.w} 0 0 ${PARTIAL_SCAN_AT.h} ${PARTIAL_SCAN_AT.x} ${PARTIAL_SCAN_AT.y} cm /Im0 Do Q`,
      images: { Im0: { width, height, data: zlibCompress(rgb) } },
    },
    pixels: { width, height, rgb },
  };
}

// ─── entry point ─────────────────────────────────────────────────────────────

const MAX_FIXTURE_BYTES = 400 * 1024;

export async function buildRebrandPdfFixtures(outDir: string): Promise<Array<{ name: string; bytes: number }>> {
  await mkdir(outDir, { recursive: true });
  const bytes = editablePdf();
  if (bytes.length > MAX_FIXTURE_BYTES) {
    throw new Error(`build-rebrand-pdf-fixtures: editable.pdf is ${bytes.length} bytes, over the ${MAX_FIXTURE_BYTES} byte limit`);
  }
  await writeFile(path.join(outDir, 'editable.pdf'), bytes);
  await writeFile(path.join(outDir, 'editable.labels.json'), `${JSON.stringify(editableLabels(), null, 2)}\n`);
  return [{ name: 'editable.pdf', bytes: bytes.length }];
}

const DEFAULT_OUT = fileURLToPath(new URL('../tests/fixtures/rebrand-pdf/', import.meta.url));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outArg = process.argv.slice(2).find((arg) => arg.startsWith('--out='));
  const outDir = outArg ? path.resolve(outArg.slice('--out='.length)) : DEFAULT_OUT;
  const written = await buildRebrandPdfFixtures(outDir);
  for (const fixture of written) console.log(`${fixture.name}: ${fixture.bytes} bytes`);
  console.log(`wrote ${written.length} fixture to ${outDir}`);
}
