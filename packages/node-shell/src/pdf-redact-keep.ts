// SPDX-License-Identifier: MPL-2.0
/**
 * "Keep text" PDF redaction: remove what sits under each box, keep the rest of the page as real
 * text and vectors, and refuse to hand back a file Lolly cannot show is clean.
 *
 * Two halves, and the second never takes the first on trust:
 *
 *   1. The `pdf-a11y` WASM module (PdfCraft's redaction, operation 2) rewrites the PDF. It cuts
 *      the glyphs, images and vector content under each box, burns the box, and writes a
 *      complete new file.
 *   2. `checkKeepTextOutput` reads that new file again with Lolly's own interpreter and text
 *      code (`pdf-read.ts`, `pdf-text.ts`, `pdf-redaction.ts`) and looks under every box for
 *      glyphs, image pixels, vector paint and annotations. Anything it finds, or cannot judge,
 *      is a refusal. The module's own report is never consulted for the verdict.
 *
 * The verdict is fail closed. A page whose glyphs the interpreter cannot place (a font with no
 * widths that Lolly does not know), an image it cannot decode, an inline image, or a page past
 * the node ceiling is refused with the reason, and the person is told to use the default mode,
 * which flattens each page. A refusal never returns bytes.
 */
import type { PdfRedactOpts, PdfRedactResult } from '@lolly-tools/core/host-v1';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, type PDFRef, StandardFonts, decodePDFRawStream } from 'pdf-lib';
import { findHiddenText } from '../../../engine/src/pdf-redaction.ts';
import { extractPageText } from '../../../engine/src/pdf-text.ts';
import type { PdfNode } from '../../../engine/src/pdf-map.ts';
import {
  interpretPdfDocPage, loadPdfDocument, makePdfWalk, pdfFontWidths, type PdfImageDesc, type PdfInterpretedPage, type PdfWalk,
} from './pdf-read.ts';
import { PdfKeepTextError, type PdfA11yKernel, type PdfKeepTextBar, type PdfKeepTextSummary } from './pdf-a11y.ts';

/** What stops a result being returned. One per place that has to be looked at again. */
export interface KeepTextFinding {
  /** 1-based page. */
  page: number;
  kind: 'text' | 'image' | 'vector' | 'annotation' | 'unreadable';
  /** A sentence about the place and the kind, never the covered content. */
  detail: string;
}

/** How far into a box something may reach before it counts as under it, in points. */
const REACH = 0.3;
/** Page content the verifier will read, in characters. */
const MAX_CONTENT_CHARS = 64 * 1024 * 1024;
/** Sample points per axis when asking whether vector paint reaches a box. */
const GRID = 6;

type Rect = { x0: number; y0: number; x1: number; y1: number };

const rectOf = (n: { x: number; y: number; w: number; h: number }): Rect => ({ x0: n.x, y0: n.y, x1: n.x + n.w, y1: n.y + n.h });
const overlap = (a: Rect, b: Rect): Rect | null => {
  const x0 = Math.max(a.x0, b.x0), y0 = Math.max(a.y0, b.y0), x1 = Math.min(a.x1, b.x1), y1 = Math.min(a.y1, b.y1);
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null;
};
const reaches = (a: Rect, b: Rect, by: number): boolean => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > by && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > by;
const inflate = (r: Rect, by: number): Rect => ({ x0: r.x0 - by, y0: r.y0 - by, x1: r.x1 + by, y1: r.y1 + by });

// ─── standard font widths ─────────────────────────────────────────────────────

const STANDARD_NAMES = new Set<string>(Object.values(StandardFonts).filter(name => name !== StandardFonts.Symbol && name !== StandardFonts.ZapfDingbats));
let standardWidths: Promise<Map<string, Record<number, number>>> | undefined;

/**
 * Advance widths (per 1000 em) of the twelve standard text faces by WinAnsi code, taken from the
 * Adobe metrics pdf-lib ships. A PDF that uses one of these faces without a `/Widths` array
 * would otherwise leave the interpreter guessing every advance, and a guessed position cannot
 * prove that a glyph is clear of a box.
 */
function loadStandardWidths(): Promise<Map<string, Record<number, number>>> {
  standardWidths ??= (async () => {
    const out = new Map<string, Record<number, number>>();
    const doc = await PDFDocument.create();
    const decoder = new TextDecoder('windows-1252');
    for (const name of STANDARD_NAMES) {
      const font = await doc.embedFont(name as StandardFonts);
      const widths: Record<number, number> = {};
      for (let code = 32; code < 256; code++) {
        try { widths[code] = font.widthOfTextAtSize(decoder.decode(Uint8Array.of(code)), 1000); } catch { /* not in the face */ }
      }
      out.set(name, widths);
    }
    return out;
  })();
  return standardWidths;
}

const baseFontOf = (ctx: PDFDocument['context'], fontRef: unknown): string => {
  const font = ctx.lookup(fontRef as never);
  const dict = font instanceof PDFDict ? font : undefined;
  const base = dict?.get(PDFName.of('BaseFont'));
  return base instanceof PDFName ? base.asString().replace(/^\//, '').replace(/^[A-Z]{6}\+/, '') : '';
};

function walkFor(standard: Map<string, Record<number, number>>): (ctx: PDFDocument['context'], images: Map<string, PdfImageDesc>, warn: (msg: string) => void) => PdfWalk {
  return (ctx, images, warn) => makePdfWalk(ctx, images, warn, {
    fontMetrics: (c, ref) => {
      const own = pdfFontWidths(c, ref);
      if (own.widths && Object.keys(own.widths).length) return own;
      const known = standard.get(baseFontOf(c, ref));
      return known ? { ...own, widths: known } : own;
    },
  }, { bounded: true });
}

// ─── vector clips ─────────────────────────────────────────────────────────────

type Point = [number, number];

/** A path string of lines and curves as polygons, or null when it holds a command this does not read. */
function polygons(d: string): Point[][] | null {
  const tokens = d.match(/[MmLlHhVvCcQqZz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
  if (!tokens) return null;
  const out: Point[][] = [];
  let cur: Point[] = [], at: Point = [0, 0], start: Point = [0, 0], i = 0, cmd = '';
  const num = (): number => Number(tokens[i++]);
  const flush = (): void => { if (cur.length > 1) out.push(cur); cur = []; };
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (/[A-Za-z]/.test(t)) { cmd = t; i++; if (cmd === 'Z' || cmd === 'z') { at = start; flush(); } continue; }
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M': { const x = num(), y = num(); at = rel ? [at[0] + x, at[1] + y] : [x, y]; start = at; flush(); cur = [at]; cmd = rel ? 'l' : 'L'; break; }
      case 'L': { const x = num(), y = num(); at = rel ? [at[0] + x, at[1] + y] : [x, y]; cur.push(at); break; }
      case 'H': { const x = num(); at = [rel ? at[0] + x : x, at[1]]; cur.push(at); break; }
      case 'V': { const y = num(); at = [at[0], rel ? at[1] + y : y]; cur.push(at); break; }
      case 'C': {
        const p = [num(), num(), num(), num(), num(), num()].map((v, k) => (rel ? v + at[k % 2]! : v));
        for (let s = 1; s <= 8; s++) {
          const u = s / 8, v = 1 - u;
          cur.push([v ** 3 * at[0] + 3 * v * v * u * p[0]! + 3 * v * u * u * p[2]! + u ** 3 * p[4]!, v ** 3 * at[1] + 3 * v * v * u * p[1]! + 3 * v * u * u * p[3]! + u ** 3 * p[5]!]);
        }
        at = [p[4]!, p[5]!];
        break;
      }
      case 'Q': {
        const p = [num(), num(), num(), num()].map((v, k) => (rel ? v + at[k % 2]! : v));
        for (let s = 1; s <= 8; s++) {
          const u = s / 8, v = 1 - u;
          cur.push([v * v * at[0] + 2 * v * u * p[0]! + u * u * p[2]!, v * v * at[1] + 2 * v * u * p[1]! + u * u * p[3]!]);
        }
        at = [p[2]!, p[3]!];
        break;
      }
      default: return null;
    }
  }
  flush();
  return out;
}

/** Whether a point is inside a clip path: crossing count for even-odd, winding number otherwise. */
function insideClip(clip: { d: string; evenOdd?: boolean }, x: number, y: number): boolean | null {
  const rings = polygons(clip.d);
  if (!rings) return null;
  let crossings = 0, winding = 0;
  for (const ring of rings) {
    for (let k = 0; k < ring.length; k++) {
      const [ax, ay] = ring[k]!, [bx, by] = ring[(k + 1) % ring.length]!;
      if ((ay > y) === (by > y)) continue;
      const cutsRight = ((bx - ax) * (y - ay)) / (by - ay) + ax > x;
      if (cutsRight) { crossings++; winding += by > ay ? 1 : -1; }
    }
  }
  return clip.evenOdd ? crossings % 2 === 1 : winding !== 0;
}

// ─── image pixels ─────────────────────────────────────────────────────────────

/** Whether every pixel an image node shows under a box is cleared. null when the pixels cannot be read. */
function imageClearedUnder(desc: PdfImageDesc, node: PdfNode, bar: Rect): boolean | null {
  if (desc.smask || desc.hasMask) return false;
  const filters = desc.filter;
  if (filters.length > 1 || (filters.length === 1 && filters[0] !== 'FlateDecode')) return null;
  const { width: W, height: H } = desc;
  const bpc = desc.imageMask ? 1 : desc.bpc;
  if (!(W > 0 && H > 0) || ![1, 2, 4, 8, 16].includes(bpc) || W * H > 64 << 20) return null;
  if (Math.abs(node.rot) > 0.5 || !(node.w > 0 && node.h > 0)) return null;
  let data: Uint8Array;
  try { data = decodePDFRawStream(desc.stream).decode(); } catch { return null; }
  const comps = (desc.imageMask ? [1] : [1, 3, 4]).find(n => H * Math.ceil((W * n * bpc) / 8) === data.length);
  if (!comps) return null;
  const rowBytes = Math.ceil((W * comps * bpc) / 8);
  const bitsPerPixel = comps * bpc;
  const cleared = desc.imageMask && !desc.decodeInverted ? 1 : 0;
  const n = rectOf(node);
  const box = overlap(n, { x0: bar.x0 + 0.05, y0: bar.y0 + 0.05, x1: bar.x1 - 0.05, y1: bar.y1 - 0.05 });
  if (!box) return true;
  const sx = W / (n.x1 - n.x0), sy = H / (n.y1 - n.y0);
  const i0 = Math.max(0, Math.floor((box.x0 - n.x0) * sx)), i1 = Math.min(W - 1, Math.ceil((box.x1 - n.x0) * sx) - 1);
  const j0 = Math.max(0, Math.floor((box.y0 - n.y0) * sy)), j1 = Math.min(H - 1, Math.ceil((box.y1 - n.y0) * sy) - 1);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      for (let bit = i * bitsPerPixel; bit < (i + 1) * bitsPerPixel; bit++) {
        const value = (data[j * rowBytes + (bit >> 3)]! >> (7 - (bit & 7))) & 1;
        if (value !== cleared) return false;
      }
    }
  }
  return true;
}

// ─── the check ────────────────────────────────────────────────────────────────

function toRect(bar: PdfKeepTextBar): Rect { return { x0: bar.x, y0: bar.y, x1: bar.x + bar.w, y1: bar.y + bar.h }; }

/** Whether a vector node is one of the boxes Keep text burned in: same rectangle and fill, one per box. */
function takeBurnedBars(nodes: PdfNode[], bars: Rect[], fill: string): Set<PdfNode> {
  const taken = new Set<PdfNode>();
  for (const bar of bars) {
    for (let k = nodes.length - 1; k >= 0; k--) {
      const n = nodes[k]!;
      if (n.kind !== 'box' || taken.has(n) || (n.fill ?? '').toLowerCase() !== fill) continue;
      const r = rectOf(n);
      if (Math.abs(r.x0 - bar.x0) < 0.6 && Math.abs(r.y0 - bar.y0) < 0.6 && Math.abs(r.x1 - bar.x1) < 0.6 && Math.abs(r.y1 - bar.y1) < 0.6) { taken.add(n); break; }
    }
  }
  return taken;
}

const hexOf = (fill: [number, number, number]): string =>
  `#${fill.map(c => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')}`;

/** Annotation rectangles on a page in the page's top-left space. */
function annotationRects(doc: PDFDocument, index: number): Rect[] {
  const page = doc.getPage(index);
  const ctx = doc.context;
  const list = ctx.lookup(page.node.get(PDFName.of('Annots')));
  const mb = page.getMediaBox();
  const out: Rect[] = [];
  if (!(list instanceof PDFArray)) return out;
  for (let k = 0; k < list.size(); k++) {
    const annot = ctx.lookup(list.get(k));
    if (!(annot instanceof PDFDict)) continue;
    const rect = ctx.lookup(annot.get(PDFName.of('Rect')));
    if (!(rect instanceof PDFArray) || rect.size() !== 4) { out.push({ x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 }); continue; }
    const v = [0, 1, 2, 3].map(q => { const n = ctx.lookup(rect.get(q)); return n instanceof PDFNumber ? n.asNumber() : NaN; });
    if (!v.every(Number.isFinite)) { out.push({ x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 }); continue; }
    const xa = Math.min(v[0]!, v[2]!), xb = Math.max(v[0]!, v[2]!), ya = Math.min(v[1]!, v[3]!), yb = Math.max(v[1]!, v[3]!);
    out.push({ x0: xa - mb.x, y0: mb.y + mb.height - yb, x1: xb - mb.x, y1: mb.y + mb.height - ya });
  }
  return out;
}

/**
 * Read a Keep text result again and list what is still under a box. An empty list means nothing
 * was found and nothing was left unjudged. `fill` is the box colour that was asked for, so the
 * burned boxes are not mistaken for surviving paint.
 */
export async function checkKeepTextOutput(output: Uint8Array, bars: PdfKeepTextBar[], fill: [number, number, number]): Promise<KeepTextFinding[]> {
  const findings: KeepTextFinding[] = [];
  const add = (page: number, kind: KeepTextFinding['kind'], detail: string): void => { findings.push({ page, kind, detail }); };
  let doc: PDFDocument;
  try { doc = await loadPdfDocument(output); } catch { return [{ page: 0, kind: 'unreadable', detail: 'The result could not be opened again to check it.' }]; }
  let pageCount = 0;
  try { pageCount = doc.getPageCount(); } catch { /* handled below */ }
  if (!pageCount) return [{ page: 0, kind: 'unreadable', detail: 'The result has no readable pages to check.' }];

  const byPage = new Map<number, Rect[]>();
  for (const bar of bars) {
    if (!Number.isInteger(bar.page) || bar.page < 1 || bar.page > pageCount) { add(bar.page, 'unreadable', `A box names page ${bar.page}, which the result does not have.`); continue; }
    byPage.set(bar.page, [...(byPage.get(bar.page) ?? []), toRect(bar)]);
  }
  const walk = walkFor(await loadStandardWidths());
  const burned = hexOf(fill);

  for (const [pageNumber, rects] of byPage) {
    const index = pageNumber - 1;
    let normal: PdfInterpretedPage, glyphs: PdfInterpretedPage;
    try {
      normal = interpretPdfDocPage(doc, index, { walk, maxContentChars: MAX_CONTENT_CHARS });
      glyphs = interpretPdfDocPage(doc, index, { walk, maxContentChars: MAX_CONTENT_CHARS, glyphRuns: true });
    } catch {
      add(pageNumber, 'unreadable', `Page ${pageNumber} could not be read again to check it.`);
      continue;
    }
    if (normal.truncated || glyphs.truncated) { add(pageNumber, 'unreadable', `Page ${pageNumber} has more content than can be checked in full.`); continue; }
    if (normal.inlineImages > 0) { add(pageNumber, 'unreadable', `Page ${pageNumber} has pictures inside its content stream, which cannot be checked.`); continue; }

    // Text, one glyph at a time. A glyph is under a box when its box reaches into it; a glyph
    // whose advance was only guessed and sits within an em of a box cannot be placed well enough
    // to say.
    let textFlagged = false, unplaced = false;
    for (const node of glyphs.nodes) {
      if (node.kind !== 'text' || !node.text?.trim() || (textFlagged && unplaced)) continue;
      const size = node.fontSize || 10;
      const baseline = node.y + 0.8 * size;
      const measured = !!node.lineInk && node.lineInk.some(v => v > 0);
      const rotated = Math.abs(node.rot) > 0.5;
      // A glyph's node width runs on over any gap that follows it in the same text object, so
      // the measured ink end is the glyph's own right edge.
      const own = measured ? Math.max(...node.lineInk!) : node.w;
      const reach = rotated ? own + size : 0;
      const box: Rect = rotated
        ? { x0: node.x - reach, y0: baseline - reach, x1: node.x + reach, y1: baseline + reach }
        : { x0: node.x, y0: baseline - 0.75 * size, x1: node.x + own, y1: baseline + 0.2 * size };
      for (const bar of rects) {
        if (reaches(box, bar, REACH)) { if (!textFlagged) add(pageNumber, 'text', `Text is still under a box on page ${pageNumber}.`); textFlagged = true; break; }
        if (!measured && !rotated && reaches(inflate(box, size), bar, 0)) { if (!unplaced) add(pageNumber, 'unreadable', `Text in a font without width data sits next to a box on page ${pageNumber}, so its position cannot be confirmed.`); unplaced = true; break; }
      }
    }
    // Lolly's own passes over the same page: text hidden behind a cover, and whole lines of
    // extracted text inside a box.
    for (const hidden of findHiddenText(glyphs.nodes)) {
      if (rects.some(bar => overlap(inflate(hidden.rect.w > 0 ? { x0: hidden.rect.x, y0: hidden.rect.y, x1: hidden.rect.x + hidden.rect.w, y1: hidden.rect.y + hidden.rect.h } : bar, 0), bar))) {
        add(pageNumber, 'text', `Text is still behind a box on page ${pageNumber}.`);
        break;
      }
    }
    let lines: ReturnType<typeof extractPageText>['lines'];
    try { lines = extractPageText(normal.nodes, { width: normal.width, height: normal.height }).lines; } catch { add(pageNumber, 'unreadable', `The text on page ${pageNumber} could not be read again.`); continue; }
    for (const line of lines ?? []) {
      const box: Rect = { x0: line.x, y0: line.baseline - 0.75 * line.size, x1: line.right, y1: line.baseline + 0.2 * line.size };
      if (rects.some(bar => box.x0 >= bar.x0 - REACH && box.x1 <= bar.x1 + REACH && box.y0 >= bar.y0 - REACH && box.y1 <= bar.y1 + REACH)) {
        add(pageNumber, 'text', `A line of text is still inside a box on page ${pageNumber}.`);
        break;
      }
    }

    // Pictures: the pixels under a box must all be cleared.
    const burnedNodes = takeBurnedBars(normal.nodes, rects, burned);
    for (const node of normal.nodes) {
      if (node.kind !== 'image') continue;
      const where = rectOf(node);
      for (const bar of rects) {
        if (!overlap(where, bar)) continue;
        const desc = node._imageXObject ? normal.imageStreams.get(node._imageXObject) : undefined;
        const cleared = desc ? imageClearedUnder(desc, node, bar) : null;
        if (cleared === true) continue;
        add(pageNumber, cleared === null ? 'unreadable' : 'image', cleared === null ? `A picture under a box on page ${pageNumber} cannot be read to check it.` : `Part of a picture is still under a box on page ${pageNumber}.`);
        break;
      }
    }

    // Vector paint: any point of the box that a path still paints is a survivor.
    for (const node of normal.nodes) {
      if (node.kind !== 'box' || burnedNodes.has(node) || (node.opacity ?? 100) <= 0) continue;
      const where = inflate(rectOf(node), 0.25);
      let painted = false;
      for (const bar of rects) {
        const common = overlap(where, bar);
        if (!common) continue;
        for (let a = 0; a < GRID && !painted; a++) {
          for (let b = 0; b < GRID && !painted; b++) {
            const px = common.x0 + ((a + 0.5) / GRID) * (common.x1 - common.x0), py = common.y0 + ((b + 0.5) / GRID) * (common.y1 - common.y0);
            painted = (node._clips ?? []).every(clip => insideClip(clip, px, py) !== false);
          }
        }
        if (painted) break;
      }
      if (painted) { add(pageNumber, 'vector', `Drawing is still under a box on page ${pageNumber}.`); break; }
    }

    // Annotations: comments, links and form fields that overlap a box should have gone with the text.
    for (const rect of annotationRects(doc, index)) {
      if (rects.some(bar => overlap(rect, bar))) { add(pageNumber, 'annotation', `A comment, link or form field is still under a box on page ${pageNumber}.`); break; }
    }
  }
  return findings;
}

/** Colour from a six-digit hex, as three numbers from 0 to 1. */
export function inkToRgb(hex: string | undefined, fallback: [number, number, number]): [number, number, number] {
  const m = typeof hex === 'string' ? /^#?([0-9a-f]{6})$/i.exec(hex.trim()) : null;
  if (!m) return fallback;
  const n = parseInt(m[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** The default box colour, the same near-black the flattening path paints. */
export const KEEP_TEXT_INK: [number, number, number] = [0x14 / 255, 0x16 / 255, 0x1a / 255];

export const KEEP_TEXT_REFUSAL = 'Keep text could not confirm that everything under the boxes is gone, so nothing was saved. Turn Keep text off to flatten each page instead.';

function describe(findings: KeepTextFinding[]): string {
  const kinds = new Set(findings.map(f => f.kind));
  const pages = [...new Set(findings.map(f => f.page).filter(p => p > 0))].sort((a, b) => a - b);
  const where = pages.length ? ` on page${pages.length > 1 ? 's' : ''} ${pages.slice(0, 5).join(', ')}${pages.length > 5 ? ' and more' : ''}` : '';
  const what = kinds.has('text') || kinds.has('image') || kinds.has('vector') || kinds.has('annotation')
    ? 'something was still under a box'
    : 'something under a box could not be checked';
  return `${KEEP_TEXT_REFUSAL} (${what}${where}: ${findings[0]!.detail})`;
}

export interface KeepTextRun {
  bytes: Uint8Array;
  pages: number;
  summary: PdfKeepTextSummary;
}

/**
 * Run Keep text on a PDF: the module rewrites it, then Lolly checks the result before it hands the file back.
 * Throws `PdfKeepTextError` (code `refused`) when the check fails, and then returns no bytes.
 */
export async function redactKeepText(kernel: PdfA11yKernel, bytes: Uint8Array, opts: PdfRedactOpts): Promise<KeepTextRun> {
  const bars: PdfKeepTextBar[] = (Array.isArray(opts.bars) ? opts.bars : [])
    .map(b => ({ page: Math.floor(Number(b?.page)), x: Number(b?.x), y: Number(b?.y), w: Number(b?.w), h: Number(b?.h) }))
    .filter(b => Number.isInteger(b.page) && b.page >= 1 && [b.x, b.y, b.w, b.h].every(Number.isFinite) && b.w > 0 && b.h > 0);
  if (!bars.length) throw new PdfKeepTextError('bad-request', 'Draw or add at least one redaction bar first.');
  const fill = inkToRgb(opts.color, KEEP_TEXT_INK);
  const label = String(opts.label ?? '').trim();
  const run = kernel.redact(bytes, {
    bars, fill, sanitize: true,
    ...(label ? { label, labelColor: inkToRgb(opts.labelColor, [1, 1, 1]) } : {}),
  });
  const findings = await checkKeepTextOutput(run.bytes, bars, fill);
  if (findings.length) throw new PdfKeepTextError('refused', describe(findings));
  const doc = await loadPdfDocument(run.bytes);
  return { bytes: run.bytes, pages: doc.getPageCount(), summary: run.summary };
}

export type { PdfRedactResult, PDFRef };
