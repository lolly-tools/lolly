// SPDX-License-Identifier: MPL-2.0
/**
 * The DOM-free half of reading a PDF page (plan 274 work package 2).
 *
 * The engine's `interpretPdfPage` (engine/src/pdf-map.ts) turns a content stream
 * plus already-resolved resources into positioned nodes in paint order. It does
 * not parse a PDF's object graph. This module is the walk that hands it those
 * resources, lifted out of `shells/web/src/views/pdf-import.ts` so a terminal,
 * the MCP server and the rebrand source adapter read a page the way the web
 * shell does:
 *
 *   - `loadPdfDocument` and `interpretPdfDocPage`: bytes to one page's nodes;
 *   - `extractPdfResources`: fonts (ToUnicode, Type3 procedures, advance widths),
 *     image and form XObjects, ExtGState alpha and soft-mask presence, and
 *     optional-content labels;
 *   - `decodePdfImage`: an image XObject to bytes a browser can show (JPEG passed
 *     through, 8-bit Flate RGB and Gray to PNG, the soft mask composited when the
 *     codec can decode);
 *   - `readPdfStructOrder`: a tagged document's own reading order;
 *   - `pdfVectorsOnPage`: vector marks clustered by `findVectorArtwork`;
 *   - `pdfTextLines`: text runs with position, font, size and colour, joined into
 *     lines, and `pdfLineRunTexts`: a line's runs with the word spaces the
 *     geometry implies, by the engine's `pdfWordBreak` rule;
 *   - `markPdfArtifactSpans`: which painted nodes sat inside a marked-content
 *     `/Artifact` span whose subtype is `Header` or `Footer`;
 *   - `markPdfInvisibleText`: which text was shown in an invisible render mode
 *     (a searchable scan's OCR layer), which the interpreter does not track;
 *   - `countPdfInlineImages`: the inline pictures the interpreter skips;
 *   - `pdfStreamBytes`: a stream decoded with a ceiling on its output, and
 *     `pdfLatin1`: bytes to a string one character a byte;
 *   - `pdfShadingOf` and `pdfPatternOf`: axial and radial shadings and tiling
 *     patterns for a host with no canvas;
 *   - `pdfPageScanned`: the engine's own "this page is a picture of text" test.
 *
 * Work is bounded for a file nobody has vetted: a bounded walk expands at most
 * `PDF_READ_RESOURCE_BUDGET` resource dictionaries and tells its diagnostic sink
 * when it refuses one; a content budget counts every stream the walk decodes as
 * text, forms and glyph procedures included; a picture's samples inflate no
 * further than its declared size needs; and a shading's functions are parsed
 * once each per walk, within a count and a sample-byte budget.
 *
 * What stays with a caller, injected rather than imported:
 *
 *   - The web shell's own shading, tiling-pattern and graphics-state soft-mask
 *     decoders live in `shells/web/src/lib/pdf-objects.ts`, inside a shell this
 *     package must not import from. `PdfResourceDecoders` is where a shell
 *     passes them. Without them the walk uses `pdfShadingOf` and `pdfPatternOf`
 *     from this file: axial (type 2) and radial (type 3) shadings become the
 *     same sampled colour ramp the web builds, with the same back-stop colour
 *     (the middle stop of the collapsed ramp); and a tiling pattern is handed
 *     to the interpreter to collapse, as the web does. A function-based shading
 *     (type 1) is painted in the colour at the middle of its domain: exact when
 *     the function is constant (`shading.type1.flat`), otherwise reported as
 *     `shading.type1.midpoint` and carried as a gradient the serializer paints
 *     flat, where the web draws a raster tile. What this file cannot evaluate
 *     stays unpainted and is reported (`shading.unsupported`): a PostScript
 *     calculator function (FunctionType 4), which Chromium's print path writes,
 *     a mesh shading (types 4 to 7), a shading in a colour space other than
 *     grey, RGB, CMYK or their ICC and calibrated forms (a Separation or DeviceN
 *     tint needs its tint transform), and a function over the walk's function
 *     budget (`PDF_READ_FUNCTION_BUDGET` function dictionaries and
 *     `PDF_READ_SAMPLE_BUDGET` sample bytes, each function memoised once per
 *     walk). A soft mask in force is recorded as present but opaque (`true`),
 *     which is the interpreter's last-resort rung and never an unmasked plate.
 *   - Pixel work. `PdfImageCodec` encodes RGBA to PNG and, when it can, decodes a
 *     picture back to RGBA for soft-mask compositing. The web shell passes a
 *     canvas codec; `NODE_PDF_IMAGE_CODEC` is a pure one (the engine's PNG packer
 *     plus a PNG reader for its own output) with no JPEG decoder, so a JPEG with
 *     a soft mask stays opaque there and the caller is told.
 *
 * Browser-safe: no `node:` imports, no `Buffer`. The web shell imports this file.
 */

import {
  PDFDocument, PDFName, PDFDict, PDFArray, PDFNumber, PDFRef, PDFRawStream, decodePDFRawStream,
} from 'pdf-lib';
import type { PDFContext, PDFObject } from 'pdf-lib';
import { unzlibSync, Unzlib } from 'fflate';
import {
  interpretPdfPage, parseToUnicode, toUnicodeDecoder, pdfWordBreak, PDF_MAP_MAX_PAGE_NODES, PDF_WORD_GAP_EM,
  type PdfNode, type PdfFontInfo, type PdfXObject, type PdfShading, type PdfPattern, type PdfSoftMaskDef,
  type PdfGradientStop,
} from '../../../engine/src/pdf-map.ts';
import { bytesToBin } from '../../../engine/src/bytes.ts';
import { unfilterPng } from '../../../engine/src/png-unfilter.ts';
import { packPng } from '../../../engine/src/png.ts';
import { findVectorArtwork } from '../../../engine/src/pdf-artwork.ts';
import { extractPageText, type TaggedElement } from '../../../engine/src/pdf-text.ts';
import { windowPdfSvg, type CullWindow } from '../../../engine/src/pdf-svg.ts';

// ─── types ───────────────────────────────────────────────────────────────────

/** A pdf-lib lookup key: a value `ctx.lookup(...)` accepts, or nothing. */
export type PdfRef = PDFObject | null | undefined;

/** A raster image XObject, resolved to bytes only when a caller asks. */
export interface PdfImageDesc {
  stream: PDFRawStream;
  filter: string[];
  width: number;
  height: number;
  colorSpace: string | null;
  bpc: number;
  predictor: number | null;
  /** Soft mask (/SMask): a grayscale alpha image composited over the base at
   *  decode time. How print engines encode blurred shadows and alpha rasters:
   *  without it the base decodes as an opaque plate. */
  smask?: PdfImageDesc;
}

/** The fully populated resource descriptor the engine interpreter takes. */
export interface PdfPageResources {
  fonts: Record<string, PdfFontInfo>;
  xobjects: Record<string, PdfXObject>;
  extgstates: Record<string, { ca?: number; CA?: number; smask?: PdfSoftMaskDef | boolean }>;
  ocgs: Record<string, string>;
  shadings: Record<string, PdfShading>;
  patterns: Record<string, PdfPattern>;
}

/**
 * The decoders a shell may add to the walk. Each is optional; the walk states
 * what it does without one (see the module header).
 */
export interface PdfResourceDecoders {
  /** Pre-decode an ExtGState /SMask dictionary. Return `true` when it cannot be decoded. */
  softMask?: (walk: PdfWalk, smRef: PdfRef, depth: number) => PdfSoftMaskDef | true;
  /** A /Shading resource (the `sh` operator). Defaults to `pdfShadingOf`. */
  shading?: (walk: PdfWalk, ref: PdfRef) => PdfShading | null;
  /** A /Pattern resource (a `scn` fill). Defaults to `pdfPatternOf`. */
  pattern?: (walk: PdfWalk, ref: PdfRef, depth: number) => PdfPattern | null;
  /** Advance widths by character code. Defaults to `pdfFontWidths`. */
  fontMetrics?: (ctx: PDFContext, fontRef: PdfRef) => Pick<PdfFontInfo, 'widths' | 'defaultWidth'>;
}

/** The state one page's resource walk threads through every level of its recursion. */
export interface PdfWalk {
  ctx: PDFContext;
  /** Raster XObjects met on this walk, keyed by the id the engine echoes back on each image node. */
  imageStreams: Map<string, PdfImageDesc>;
  /** The diagnostic sink: dotted codes, one per approximated or dropped paint. */
  warn: (msg: string) => void;
  decoders: PdfResourceDecoders;
  /** Recurse into a nested /Resources dictionary. */
  resources: (dict: PdfRef, depth: number) => PdfPageResources;
  /**
   * Cycle and fan-out bound. A depth cap alone does not bound a branching walk
   * (8 deep by 8 wide is 16.7 million calls), so a walk over a file nobody has
   * vetted carries this. Absent, only the depth cap applies, which is what the
   * web view has always done.
   */
  bound?: { stack: Set<PDFDict>; left: number; told?: Set<string> };
  /**
   * The page's decoded-content budget, when the caller set one. Every stream the
   * walk decodes as text (a form, a Type3 glyph procedure, a ToUnicode map) and
   * the page's own content count against it, and the decode that would pass it
   * throws `PdfPageTooLargeError`. A shell decoder that decodes streams of its
   * own (a soft-mask group) counts through `pdfWalkText` to join it.
   */
  content?: { used: number; limit: number };
}

/** Resources dictionaries one bounded page walk may expand. */
export const PDF_READ_RESOURCE_BUDGET = 4096;

/** Recursion depth for nested resources, matching every walk this replaces. */
const MAX_RESOURCE_DEPTH = 8;

// ─── pdf-lib object access ───────────────────────────────────────────────────
// The same semantics as shells/web/src/lib/pdf-objects.ts, which this package
// must not import. Kept private so the web copy stays the one the view exports.

function dictOf(ctx: PDFContext, o: PdfRef): PDFDict | null {
  const v = ctx.lookup(o as PDFObject | undefined);
  return v instanceof PDFRawStream ? v.dict : v instanceof PDFDict ? v : null;
}
function getKey(ctx: PDFContext, o: PdfRef, key: string): PDFObject | undefined {
  const d = dictOf(ctx, o);
  return d ? d.get(PDFName.of(key)) : undefined;
}
function numOf(ctx: PDFContext, o: PdfRef): number | null {
  const v = ctx.lookup(o as PDFObject | undefined);
  return v instanceof PDFNumber ? v.asNumber() : null;
}
function nameOf(ctx: PDFContext, o: PdfRef): string | null {
  const v = ctx.lookup(o as PDFObject | undefined);
  return v instanceof PDFName ? v.asString().replace(/^\//, '') : null;
}
function decodedText(ctx: PDFContext, o: PdfRef): string | null {
  const v = ctx.lookup(o as PDFObject | undefined);
  if (v instanceof PDFRawStream) {
    try { return pdfLatin1(decodePDFRawStream(v).decode()); } catch { return null; }
  }
  return null;
}

/**
 * Bytes as a string of one character a byte, each character's code the byte
 * (true Latin-1). A content stream is bytes: inside a string operand they are
 * glyph codes, not text. `new TextDecoder('latin1')` is not this, because the
 * Encoding Standard maps that label to windows-1252, which turns 27 of the bytes
 * 0x80 to 0x9F into other characters (0x92 into U+2019). The engine's tokenizer
 * maps those back, but a stream decoded here needs no mapping.
 */
export function pdfLatin1(bytes: Uint8Array): string {
  return bytesToBin(bytes);
}

/** Input taken per inflate step: deflate expands at most about 1032 to 1, so one step yields 16 MiB at most. */
const INFLATE_STEP = 16 * 1024;

/** Inflate a zlib stream until `cap` bytes are out. What inflated before damage is kept, as pdf-lib keeps it. */
function inflateCapped(input: Uint8Array, cap: number): Uint8Array | null {
  const parts: Uint8Array[] = [];
  let total = 0;
  const inflater = new Unzlib((chunk) => {
    if (total >= cap) return;
    const take = chunk.length > cap - total ? chunk.subarray(0, cap - total) : chunk;
    parts.push(take);
    total += take.length;
  });
  try {
    for (let at = 0; at < input.length && total < cap; at += INFLATE_STEP) {
      const end = Math.min(input.length, at + INFLATE_STEP);
      inflater.push(input.subarray(at, end), end >= input.length);
    }
  } catch {
    if (!total) return null;
  }
  if (parts.length === 1) return parts[0]!;
  const out = new Uint8Array(total);
  let off = 0;
  for (const part of parts) { out.set(part, off); off += part.length; }
  return out;
}

/**
 * A stream's decoded bytes, at most `cap` of them. A lone FlateDecode filter
 * (what content streams, forms and 8-bit pictures carry) inflates in steps and
 * stops at the cap, so a small stream that would inflate to gigabytes costs the
 * cap and one step. An unfiltered stream is its own bytes. Another filter chain
 * goes through pdf-lib whole, which the cap then only trims. Without a cap the
 * stream decodes through pdf-lib exactly as before. Null when it cannot be decoded.
 */
export function pdfStreamBytes(stream: PDFRawStream, cap = Number.POSITIVE_INFINITY): Uint8Array | null {
  const trim = (bytes: Uint8Array): Uint8Array => (bytes.length > cap ? bytes.subarray(0, cap) : bytes);
  if (!Number.isFinite(cap)) {
    try { return decodePDFRawStream(stream).decode(); } catch { return null; }
  }
  const filters = filterList(stream.dict.context, stream.dict.get(PDFName.of('Filter')));
  if (!filters.length) return trim(stream.getContents());
  if (filters.length === 1 && filters[0] === 'FlateDecode') return inflateCapped(stream.getContents(), Math.max(0, Math.floor(cap)));
  try { return trim(decodePDFRawStream(stream).decode()); } catch { return null; }
}

/**
 * A stream decoded as Latin-1 text, counted against the walk's content budget
 * when it has one. Throws `PdfPageTooLargeError` at the decode that would pass
 * the budget, having inflated no more than one character past it.
 */
export function pdfWalkText(walk: Pick<PdfWalk, 'ctx' | 'content'>, o: PdfRef): string | null {
  const budget = walk.content;
  if (!budget) return decodedText(walk.ctx, o);
  const v = walk.ctx.lookup(o as PDFObject | undefined);
  if (!(v instanceof PDFRawStream)) return null;
  const left = Math.max(0, budget.limit - budget.used);
  const bytes = pdfStreamBytes(v, left + 1);
  if (!bytes) return null;
  budget.used += bytes.length;
  if (budget.used > budget.limit) throw new PdfPageTooLargeError(budget.used, budget.limit, true);
  return pdfLatin1(bytes);
}
function dictEntries(ctx: PDFContext, o: PdfRef): Array<[string, PDFObject]> {
  const d = dictOf(ctx, o);
  return d ? [...d.entries()].map(([k, v]): [string, PDFObject] => [k.asString().replace(/^\//, ''), v]) : [];
}
function pdfString(ctx: PDFContext, o: PdfRef): string {
  const v = ctx.lookup(o as PDFObject | undefined);
  if (!v) return '';
  const s = v as { asString?: () => string; decodeText?: () => string };
  if (typeof s.asString === 'function' && !(v instanceof PDFName)) { try { return s.asString(); } catch { /* next */ } }
  if (typeof s.decodeText === 'function') { try { return s.decodeText(); } catch { /* none */ } }
  return '';
}

/** An image colour-space object to a device space NAME. ICCBased resolves by /N:
 *  Chromium writes every print raster as `[/ICCBased <N=3>]`. */
function colorSpaceName(ctx: PDFContext, o: PdfRef): string | null {
  const v = ctx.lookup(o as PDFObject | undefined);
  if (v instanceof PDFName) return v.asString().replace(/^\//, '');
  if (v instanceof PDFArray && v.size()) {
    const head = nameOf(ctx, v.get(0));
    if (head === 'ICCBased') {
      const n = numOf(ctx, dictOf(ctx, v.get(1))?.get(PDFName.of('N')));
      return n === 1 ? 'DeviceGray' : n === 4 ? 'DeviceCMYK' : 'DeviceRGB';
    }
    return head;
  }
  return null;
}

function filterList(ctx: PDFContext, o: PdfRef): string[] {
  const v = ctx.lookup(o as PDFObject | undefined);
  if (v instanceof PDFName) return [v.asString().replace(/^\//, '')];
  if (v instanceof PDFArray) return v.asArray().map((x) => nameOf(ctx, x)).filter(Boolean) as string[];
  return [];
}

function msg(err: unknown): string { return String((err && (err as Error).message) || err); }

/**
 * A page's content streams, decoded and joined in order. With a budget, each
 * stream counts against it as it is decoded (see `pdfWalkText`).
 */
export function pdfContentString(ctx: PDFContext, pageNode: PdfRef, content?: PdfWalk['content']): string {
  const c = ctx.lookup(getKey(ctx, pageNode, 'Contents'));
  const parts: string[] = [];
  const add = (ref: PdfRef): void => { const t = pdfWalkText({ ctx, content }, ref); if (t != null) parts.push(t); };
  if (c instanceof PDFArray) c.asArray().forEach(add); else add(getKey(ctx, pageNode, 'Contents'));
  return parts.join('\n');
}

// ─── loading ─────────────────────────────────────────────────────────────────

/** Load a document the way every reader in this repo does: encryption ignored, bad objects tolerated, nothing rewritten. */
export async function loadPdfDocument(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
}

// ─── resources ───────────────────────────────────────────────────────────────

/** Build the walk for one page. Pass `{ bounded: true }` for a file nobody has vetted. */
export function makePdfWalk(
  ctx: PDFContext,
  imageStreams: Map<string, PdfImageDesc>,
  warn: (msg: string) => void,
  decoders: PdfResourceDecoders = {},
  opts: { bounded?: boolean } = {},
): PdfWalk {
  const walk: PdfWalk = {
    ctx, imageStreams, warn, decoders,
    resources: (dict, depth) => extractPdfResources(walk, dict, depth),
  };
  if (opts.bounded) walk.bound = { stack: new Set(), left: PDF_READ_RESOURCE_BUDGET };
  return walk;
}

/** One /Resources dictionary, recursively for forms, Type3 procedures and masks. */
export function extractPdfResources(walk: PdfWalk, resDict: PdfRef, depth: number): PdfPageResources {
  const res: PdfPageResources = { fonts: {}, xobjects: {}, extgstates: {}, ocgs: {}, shadings: {}, patterns: {} };
  const dict = dictOf(walk.ctx, resDict);
  if (!dict || depth > MAX_RESOURCE_DEPTH) return res;
  const bound = walk.bound;
  if (!bound) return fillResources(walk, res, resDict, depth);
  // A form may point its /Resources back at the dictionary it came from. The stack
  // is popped on the way out, so two sibling forms sharing one dictionary both
  // resolve; only a dictionary reachable from itself is refused. Each refusal is
  // told to the diagnostic sink once per walk, because what that dictionary held
  // (fonts, pictures, forms) is missing from the page.
  const refuse = (code: string): PdfPageResources => {
    bound.told ??= new Set();
    if (!bound.told.has(code)) { bound.told.add(code); walk.warn(code); }
    return res;
  };
  if (bound.stack.has(dict)) return refuse('resources.cycle');
  if (bound.left-- <= 0) return refuse('resources.budget.exhausted');
  bound.stack.add(dict);
  try {
    return fillResources(walk, res, resDict, depth);
  } finally {
    bound.stack.delete(dict);
  }
}

function fillResources(walk: PdfWalk, res: PdfPageResources, resDict: PdfRef, depth: number): PdfPageResources {
  const ctx = walk.ctx;

  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'ExtGState'))) {
    const ca = numOf(ctx, getKey(ctx, ref, 'ca'));
    const CA = numOf(ctx, getKey(ctx, ref, 'CA'));
    const gs: { ca?: number; CA?: number; smask?: PdfSoftMaskDef | boolean } = {};
    res.extgstates[name] = gs;
    if (ca != null) gs.ca = ca;
    if (CA != null) gs.CA = CA;
    // Four states, and each matters: a decoded mask, `true` for a mask in force
    // that could not be decoded (never `false`, which would paint the shadow
    // plate), `false` for `/SMask /None`, and no key at all to leave the mask in
    // force alone.
    const sm = getKey(ctx, ref, 'SMask');
    if (sm) gs.smask = dictOf(ctx, sm) ? (walk.decoders.softMask?.(walk, sm, depth) ?? true) : false;
  }

  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'Font'))) {
    res.fonts[name] = buildFontInfo(walk, ref, depth);
  }

  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'XObject'))) {
    const subtype = nameOf(ctx, getKey(ctx, ref, 'Subtype'));
    if (subtype === 'Image') {
      // Minted per registration, not per resource name: the same name means
      // different streams in two nested forms.
      const key = `img${walk.imageStreams.size}`;
      walk.imageStreams.set(key, makeImageDesc(ctx, ref));
      res.xobjects[name] = { kind: 'image', imageKey: key };
    } else if (subtype === 'Form') {
      const mtx = ctx.lookup(getKey(ctx, ref, 'Matrix'));
      res.xobjects[name] = {
        kind: 'form',
        content: pdfWalkText(walk, ref) || '',
        matrix: mtx instanceof PDFArray ? mtx.asArray().map((v) => numOf(ctx, v) ?? 0) : undefined,
        resources: walk.resources(getKey(ctx, ref, 'Resources'), depth + 1),
      };
    }
  }

  // Optional-content groups: /Properties maps a marked-content name to an OCG whose
  // /Name is the (Illustrator layer) label.
  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'Properties'))) {
    const label = pdfString(ctx, getKey(ctx, ref, 'Name'));
    if (label) res.ocgs[name] = label;
  }

  // A shell's own decoders when it passed them, otherwise the canvas-free ones below.
  const shading = walk.decoders.shading ?? pdfShadingOf;
  const pattern = walk.decoders.pattern ?? pdfPatternOf;
  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'Shading'))) {
    const sh = shading(walk, ref);
    if (sh) res.shadings[name] = sh;
  }
  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'Pattern'))) {
    const pt = pattern(walk, ref, depth);
    if (pt) res.patterns[name] = pt;
  }
  return res;
}

/** Descriptor for one image XObject, with its /SMask one level down (a mask never carries a mask of its own). */
function makeImageDesc(ctx: PDFContext, ref: PdfRef, depth = 0): PdfImageDesc {
  const desc: PdfImageDesc = {
    stream: ctx.lookup(ref as PDFObject | undefined) as PDFRawStream,
    filter: filterList(ctx, getKey(ctx, ref, 'Filter')),
    width: numOf(ctx, getKey(ctx, ref, 'Width')) || 0,
    height: numOf(ctx, getKey(ctx, ref, 'Height')) || 0,
    colorSpace: colorSpaceName(ctx, getKey(ctx, ref, 'ColorSpace')),
    bpc: numOf(ctx, getKey(ctx, ref, 'BitsPerComponent')) || 8,
    predictor: numOf(ctx, getKey(ctx, dictOf(ctx, getKey(ctx, ref, 'DecodeParms')), 'Predictor')),
  };
  if (depth === 0) {
    const smaskRef = getKey(ctx, ref, 'SMask');
    if (smaskRef && ctx.lookup(smaskRef as PDFObject | undefined) instanceof PDFRawStream) {
      desc.smask = makeImageDesc(ctx, smaskRef, 1);
    }
  }
  return desc;
}

// ─── fonts ───────────────────────────────────────────────────────────────────

function buildFontInfo(walk: PdfWalk, fontRef: PdfRef, depth: number): PdfFontInfo {
  const ctx = walk.ctx;
  const subtype = nameOf(ctx, getKey(ctx, fontRef, 'Subtype')) || '';
  const twoByte = subtype === 'Type0';
  const rawBase = nameOf(ctx, getKey(ctx, fontRef, 'BaseFont')) || '';
  const base = rawBase.replace(/^[A-Z]{6}\+/, ''); // the subset prefix "ABCDEF+"
  const metrics = (walk.decoders.fontMetrics ?? pdfFontWidths)(ctx, fontRef);
  const info: PdfFontInfo = { twoByte, family: base, weight: pdfWeightFromName(base), ...metrics };

  // ToUnicode is the reliable path for embedded and subset fonts; the top-level one wins.
  const tuText = pdfWalkText(walk, getKey(ctx, fontRef, 'ToUnicode'));
  if (tuText) {
    try { info.decode = toUnicodeDecoder(parseToUnicode(tuText), twoByte); } catch { /* Latin-1 fallback */ }
  }

  // Type3 glyphs are content-stream drawing procedures, which the interpreter runs
  // into real vector paths. Chromium's printToPDF encodes app text this way.
  if (subtype === 'Type3') {
    const fmArr = ctx.lookup(getKey(ctx, fontRef, 'FontMatrix'));
    const fontMatrix = fmArr instanceof PDFArray ? fmArr.asArray().map((v) => numOf(ctx, v) ?? 0) : [0.001, 0, 0, 0.001, 0, 0];
    const charProcs: Record<string, string> = {};
    for (const [gname, gref] of dictEntries(ctx, getKey(ctx, fontRef, 'CharProcs'))) {
      const t = pdfWalkText(walk, gref);
      if (t != null) charProcs[gname] = t;
    }
    const encoding: Record<number, string> = {};
    const encDict = dictOf(ctx, getKey(ctx, fontRef, 'Encoding'));
    const diffs = encDict ? ctx.lookup(encDict.get(PDFName.of('Differences'))) : null;
    if (diffs instanceof PDFArray) {
      let code = 0;
      for (const item of diffs.asArray()) {
        const o = ctx.lookup(item);
        if (o instanceof PDFNumber) code = o.asNumber();
        else if (o instanceof PDFName) { encoding[code] = o.asString().replace(/^\//, ''); code++; }
      }
    }
    const widths: Record<number, number> = {};
    const firstChar = numOf(ctx, getKey(ctx, fontRef, 'FirstChar')) ?? 0;
    const wArr = ctx.lookup(getKey(ctx, fontRef, 'Widths'));
    if (wArr instanceof PDFArray) wArr.asArray().forEach((v, i) => { const w = numOf(ctx, v); if (w != null) widths[firstChar + i] = w; });
    info.type3 = { fontMatrix, charProcs, encoding, widths, resources: walk.resources(getKey(ctx, fontRef, 'Resources'), depth + 1) };
    info.twoByte = false;
  }
  return info;
}

/** A CSS weight guessed from a base font name. */
export function pdfWeightFromName(name: string): number {
  const s = String(name || '');
  if (/thin|hairline/i.test(s)) return 100;
  if (/extra[\s-]*light|ultra[\s-]*light/i.test(s)) return 200;
  if (/semi[\s-]*bold|demi/i.test(s)) return 600;
  if (/extra[\s-]*bold|ultra[\s-]*bold/i.test(s)) return 800;
  if (/black|heavy/i.test(s)) return 900;
  if (/bold/i.test(s)) return 700;
  if (/medium/i.test(s)) return 500;
  if (/light/i.test(s)) return 300;
  return 400;
}

/**
 * Advance widths by character code, independently of Unicode decoding: /W and
 * /DW for a Type0 font's descendant, /FirstChar and /Widths (plus the
 * descriptor's /MissingWidth) for a simple one. Same reading as the web shell's
 * lib/pdf-font-metrics.ts.
 */
export function pdfFontWidths(ctx: PDFContext, font: PdfRef): Pick<PdfFontInfo, 'widths' | 'defaultWidth'> {
  const widths: Record<number, number> = {};
  if (nameOf(ctx, getKey(ctx, font, 'Subtype')) === 'Type0') {
    const descendants = ctx.lookup(getKey(ctx, font, 'DescendantFonts'));
    const descendant = descendants instanceof PDFArray ? descendants.get(0) : undefined;
    const defaultWidth = numOf(ctx, getKey(ctx, descendant, 'DW')) ?? 1000;
    const entries = ctx.lookup(getKey(ctx, descendant, 'W'));
    if (entries instanceof PDFArray) {
      for (let i = 0; i < entries.size();) {
        const first = numOf(ctx, entries.get(i++));
        if (first == null || !Number.isInteger(first) || first < 0 || first > 65535 || i >= entries.size()) break;
        const next = ctx.lookup(entries.get(i++));
        if (next instanceof PDFArray) {
          for (let j = 0; j < next.size() && first + j <= 65535; j++) {
            const width = numOf(ctx, next.get(j));
            if (width != null && Number.isFinite(width)) widths[first + j] = width;
          }
        } else {
          const last = numOf(ctx, next);
          const width = i < entries.size() ? numOf(ctx, entries.get(i++)) : null;
          if (last == null || width == null || !Number.isFinite(width) || last < first || last > 65535) break;
          for (let code = first; code <= last; code++) widths[code] = width;
        }
      }
    }
    return { widths, defaultWidth };
  }
  const first = numOf(ctx, getKey(ctx, font, 'FirstChar')) ?? 0;
  const entries = ctx.lookup(getKey(ctx, font, 'Widths'));
  if (entries instanceof PDFArray) {
    for (let i = 0; i < entries.size() && first + i <= 255; i++) {
      const width = numOf(ctx, entries.get(i));
      if (width != null && Number.isFinite(width)) widths[first + i] = width;
    }
  }
  const missing = numOf(ctx, getKey(ctx, getKey(ctx, font, 'FontDescriptor'), 'MissingWidth'));
  return { ...(Object.keys(widths).length ? { widths } : {}), ...(missing == null ? {} : { defaultWidth: missing }) };
}

// ─── shadings and patterns without a canvas ──────────────────────────────────
// The canvas-free part of the web shell's shading decoders
// (shells/web/src/lib/pdf-objects.ts and lib/pdf-shading.ts), which this package
// must not import: the same function evaluation (FunctionType 0, 2 and 3), the
// same sixteen steps along a ramp collapsed to stops, and the same pattern
// reading. The web shell passes its own decoders and never reaches these.

/** A PDF function: inputs to colour components in 0..1, or null when it faulted, which must never read as black. */
type PdfColorFn = (...inputs: number[]) => number[] | null;

/** Nesting a stitching function may reach, the web's own cap. */
const MAX_FUNCTION_DEPTH = 8;
/**
 * Function dictionaries one walk may parse. Each is parsed once per depth it is
 * reached at, so a stitching function that names one child many times over, or
 * several shadings sharing one function, costs one parse; this cap bounds a file
 * built from distinct ones.
 */
export const PDF_READ_FUNCTION_BUDGET = 4096;
/** Declared sample bytes one sampled function (FunctionType 0) may have. */
const MAX_SAMPLE_BYTES = 1 << 20;
/** Sample bytes all the sampled functions of one walk may inflate together. */
export const PDF_READ_SAMPLE_BUDGET = 16 << 20;

/** What one walk has spent on functions: the parsed ones, by object and depth, and what is left. */
interface PdfFunctionWork {
  memo: Map<object, Array<PdfColorFn | null | undefined>>;
  nodesLeft: number;
  bytesLeft: number;
  told: Set<string>;
}
const FUNCTION_WORK = new WeakMap<PdfWalk, PdfFunctionWork>();

function functionWork(walk: PdfWalk): PdfFunctionWork {
  let work = FUNCTION_WORK.get(walk);
  if (!work) {
    work = { memo: new Map(), nodesLeft: PDF_READ_FUNCTION_BUDGET, bytesLeft: PDF_READ_SAMPLE_BUDGET, told: new Set() };
    FUNCTION_WORK.set(walk, work);
  }
  return work;
}

/** Tell the diagnostic sink once per walk. */
function tellOnce(walk: PdfWalk, work: PdfFunctionWork, code: string): void {
  if (work.told.has(code)) return;
  work.told.add(code);
  walk.warn(code);
}

/** The colour spaces a shading may be evaluated in here (ICCBased resolves to one of the device spaces). */
const SHADING_SPACES = new Set(['DeviceGray', 'DeviceRGB', 'DeviceCMYK', 'CalGray', 'CalRGB']);
/** Steps along a ramp: seventeen samples, the middle one at the domain's centre. */
const RAMP_STEPS = 16;

function numArray(ctx: PDFContext, o: PdfRef): number[] | null {
  const v = ctx.lookup(o as PDFObject | undefined);
  return v instanceof PDFArray ? v.asArray().map((x) => numOf(ctx, x) ?? 0) : null;
}

function boolArray(ctx: PDFContext, o: PdfRef): boolean[] {
  const v = ctx.lookup(o as PDFObject | undefined);
  // A PDFBool prints as "true" or "false".
  return v instanceof PDFArray ? v.asArray().map((x) => String(ctx.lookup(x)) === 'true') : [];
}

/** Components in a shading's colour space: 1 for grey, 4 for CMYK, 3 otherwise. */
function shadingComps(cs: string | null): number {
  return cs ? (/CMYK/i.test(cs) ? 4 : /Gray/i.test(cs) ? 1 : 3) : 3;
}

/** Colour components to `#rrggbb` by component count (CMYK converted naively), or null when a value is not a number. */
function componentsToHex(vals: number[] | null, comps: number): string | null {
  if (!vals?.length || vals.some((v) => typeof v !== 'number' || !Number.isFinite(v))) return null;
  const chan = (v: number): number => Math.round((v < 0 ? 0 : v > 1 ? 1 : v) * 255);
  let rgb: [number, number, number];
  if (comps === 1) { const g = chan(vals[0] ?? 0); rgb = [g, g, g]; }
  else if (comps === 4) {
    const c = vals[0] ?? 0, m = vals[1] ?? 0, y = vals[2] ?? 0, k = vals[3] ?? 0;
    rgb = [chan((1 - c) * (1 - k)), chan((1 - m) * (1 - k)), chan((1 - y) * (1 - k))];
  } else rgb = [chan(vals[0] ?? 0), chan(vals[1] ?? 0), chan(vals[2] ?? 0)];
  return `#${rgb.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** Evaluate a colour function to a hex, or null when it faulted or threw. */
function colourAt(fn: PdfColorFn, comps: number, ...inputs: number[]): string | null {
  try { return componentsToHex(fn(...inputs), comps); } catch { return null; }
}

/** A /Function entry: one function, or an array of single-output ones (one per component), as one evaluator. */
function pdfShadingFunction(walk: PdfWalk, o: PdfRef): PdfColorFn | null {
  const v = walk.ctx.lookup(o as PDFObject | undefined);
  if (v instanceof PDFArray) {
    const fns = v.asArray().map((f) => pdfFunction(walk, f, 0));
    if (!fns.length || fns.some((f) => !f)) return null;
    return (...inputs) => {
      const out: number[] = [];
      for (const f of fns) {
        const r = f!(...inputs);
        if (!r) return null;
        out.push(r[0] ?? 0);
      }
      return out;
    };
  }
  return pdfFunction(walk, o, 0);
}

/**
 * FunctionType 2 (exponential), 3 (stitching) and 0 (sampled, one input), as the
 * web decodes them. FunctionType 4 (a PostScript calculator) needs the web's
 * calculator and comes back null, so the shading is reported, not guessed.
 * Memoised per walk by the resolved object and depth, and counted against the
 * walk's function budget, so a file that names one function many times costs
 * one parse and a file of many distinct ones stops at the budget.
 */
function pdfFunction(walk: PdfWalk, o: PdfRef, depth: number): PdfColorFn | null {
  if (depth > MAX_FUNCTION_DEPTH) return null;
  const obj = walk.ctx.lookup(o as PDFObject | undefined);
  if (!obj) return null;
  const work = functionWork(walk);
  let byDepth = work.memo.get(obj);
  const known = byDepth?.[depth];
  if (known !== undefined) return known;
  if (!byDepth) { byDepth = []; work.memo.set(obj, byDepth); }
  // Null while it is being parsed, so a function that names itself reads as a fault.
  byDepth[depth] = null;
  if (work.nodesLeft <= 0) { tellOnce(walk, work, 'function.budget.exhausted'); return null; }
  work.nodesLeft--;
  const fn = parseFunction(walk, work, o, depth);
  byDepth[depth] = fn;
  return fn;
}

function parseFunction(walk: PdfWalk, work: PdfFunctionWork, o: PdfRef, depth: number): PdfColorFn | null {
  const ctx = walk.ctx;
  const d = dictOf(ctx, o);
  if (!d) return null;
  const type = numOf(ctx, d.get(PDFName.of('FunctionType')));
  const domain = numArray(ctx, d.get(PDFName.of('Domain'))) ?? [0, 1];
  const d0 = domain[0] ?? 0, d1 = domain[1] ?? 1;
  const clampT = (t: number): number => (t < d0 ? d0 : t > d1 ? d1 : t);

  if (type === 2) {
    const c0 = numArray(ctx, d.get(PDFName.of('C0'))) ?? [0];
    const c1 = numArray(ctx, d.get(PDFName.of('C1'))) ?? [1];
    const n = numOf(ctx, d.get(PDFName.of('N'))) ?? 1;
    return (t = d0) => { const p = clampT(t) ** n; return c0.map((c, j) => c + p * ((c1[j] ?? c) - c)); };
  }
  if (type === 3) {
    const subs = ctx.lookup(d.get(PDFName.of('Functions')));
    const fns = (subs instanceof PDFArray ? subs.asArray() : []).map((f) => pdfFunction(walk, f, depth + 1));
    if (!fns.length || fns.some((f) => !f)) return null;
    const bounds = numArray(ctx, d.get(PDFName.of('Bounds'))) ?? [];
    const encode = numArray(ctx, d.get(PDFName.of('Encode'))) ?? [];
    const k = fns.length;
    return (t = d0) => {
      const tt = clampT(t);
      let i = 0;
      while (i < bounds.length && i < k - 1 && tt >= (bounds[i] ?? Number.POSITIVE_INFINITY)) i++;
      const lo = i === 0 ? d0 : (bounds[i - 1] ?? d0);
      const hi = i >= k - 1 ? d1 : (bounds[i] ?? d1);
      const e0 = encode[2 * i] ?? 0, e1 = encode[2 * i + 1] ?? 1;
      return fns[i]!(hi > lo ? e0 + ((tt - lo) * (e1 - e0)) / (hi - lo) : e0);
    };
  }
  if (type === 0) return sampledFunction(walk, work, o, d0, d1);
  return null;
}

/**
 * FunctionType 0 with one input: samples packed big-endian at /BitsPerSample,
 * interpolated between the two nearest and decoded to the output range. A
 * function of two or more inputs is not evaluated here (a first row alone
 * would read a gradient in the second input as constant). The declared samples
 * may take at most `MAX_SAMPLE_BYTES`, and together with the walk's other
 * sampled functions at most `PDF_READ_SAMPLE_BUDGET`; the stream must be one
 * whose inflation stops at that size (unfiltered, or a lone FlateDecode).
 */
function sampledFunction(walk: PdfWalk, work: PdfFunctionWork, o: PdfRef, d0: number, d1: number): PdfColorFn | null {
  const ctx = walk.ctx;
  const stream = ctx.lookup(o as PDFObject | undefined);
  if (!(stream instanceof PDFRawStream)) return null;
  const d = stream.dict;
  const size = numArray(ctx, d.get(PDFName.of('Size'))) ?? [];
  const range = numArray(ctx, d.get(PDFName.of('Range'))) ?? [];
  const bps = numOf(ctx, d.get(PDFName.of('BitsPerSample'))) ?? 8;
  if (size.length > 1) { walk.warn(`function.sampled.inputs (${size.length})`); return null; }
  const n = Math.floor(size[0] ?? 0), m = Math.floor(range.length / 2);
  if (!Number.isFinite(n) || n < 1 || m < 1 || bps < 1 || bps > 32) return null;
  const need = Math.ceil((n * m * bps) / 8);
  if (need > MAX_SAMPLE_BYTES) { walk.warn(`function.sampled.too-large (${need} bytes declared)`); return null; }
  if (need > work.bytesLeft) { tellOnce(walk, work, 'function.samples.budget.exhausted'); return null; }
  const filters = filterList(ctx, d.get(PDFName.of('Filter')));
  if (filters.length > 1 || (filters.length === 1 && filters[0] !== 'FlateDecode')) {
    walk.warn(`function.sampled.filter (${filters.join(' ')})`);
    return null;
  }
  work.bytesLeft -= need;
  const encode = numArray(ctx, d.get(PDFName.of('Encode'))) ?? [0, n - 1];
  const decode = numArray(ctx, d.get(PDFName.of('Decode'))) ?? range;
  const bytes = pdfStreamBytes(stream, need);
  if (!bytes || bytes.length < need) return null;
  const maxVal = 2 ** bps - 1;
  const sampleAt = (idx: number, comp: number): number => {
    let bit = (idx * m + comp) * bps, v = 0;
    for (let b = 0; b < bps; b++, bit++) v = v * 2 + ((bytes[bit >> 3]! >> (7 - (bit & 7))) & 1);
    return v;
  };
  return (t = d0) => {
    const tt = t < d0 ? d0 : t > d1 ? d1 : t;
    const e0 = encode[0] ?? 0, e1 = encode[1] ?? n - 1;
    let e = d1 > d0 ? e0 + ((tt - d0) * (e1 - e0)) / (d1 - d0) : e0;
    e = e < 0 ? 0 : e > n - 1 ? n - 1 : e;
    const i0 = Math.floor(e), i1 = Math.min(n - 1, i0 + 1), frac = e - i0;
    const out: number[] = [];
    for (let c = 0; c < m; c++) {
      const s = sampleAt(i0, c) + (sampleAt(i1, c) - sampleAt(i0, c)) * frac;
      const dl = decode[2 * c] ?? 0, dh = decode[2 * c + 1] ?? 1;
      out.push(dl + (s / maxVal) * (dh - dl));
    }
    return out;
  };
}

/** Seventeen evenly spaced colours along a one-input function, or null when one faulted. */
function rampOf(fn: PdfColorFn, comps: number, t0: number, t1: number): string[] | null {
  const span = (t1 - t0) || 1;
  const out: string[] = [];
  for (let i = 0; i <= RAMP_STEPS; i++) {
    const hex = colourAt(fn, comps, t0 + (span * i) / RAMP_STEPS);
    if (!hex) return null;
    out.push(hex);
  }
  return out;
}

/** Ramp colours to stops, dropping an inner stop inside a run of one colour; the ends are always kept. */
function collapseStops(ramp: string[]): PdfGradientStop[] {
  const out: PdfGradientStop[] = [];
  for (let i = 0; i < ramp.length; i++) {
    const keep = i === 0 || i === ramp.length - 1 || ramp[i] !== ramp[i - 1] || ramp[i] !== ramp[i + 1];
    if (keep) out.push({ offset: i / (ramp.length - 1 || 1), color: ramp[i]! });
  }
  return out;
}

/**
 * A /Shading resource with no canvas. Axial (type 2) and radial (type 3)
 * shadings become a sampled ramp plus `flat`, the middle stop of the collapsed
 * ramp (the web's rule), as the back-stop for a paint the serializer declines.
 * A function-based shading (type 1) becomes the colour at the middle of its
 * domain: exact when the function is constant over its domain
 * (`shading.type1.flat`), otherwise an approximation (`shading.type1.midpoint`)
 * that each painted object states again. Mesh shadings (types 4 to 7), a colour
 * space outside `SHADING_SPACES` and a function this file cannot evaluate are
 * reported as `shading.unsupported` and return null.
 *
 * These codes reach the diagnostic sink when the resource is decoded, which is
 * every resource the page lists, painted or not. The interpreter reports each
 * paint on its own (`shading.unsupported` or `pattern.unsupported` with the
 * resource name), so a caller counting what a page lost counts those.
 */
export function pdfShadingOf(walk: PdfWalk, ref: PdfRef): PdfShading | null {
  return shadingRead(walk, ref)?.shading ?? null;
}

/** A shading read with no canvas, and whether its flat colour is exact (a constant function-based one). */
function shadingRead(walk: PdfWalk, ref: PdfRef): { shading: PdfShading; constant: boolean } | null {
  const ctx = walk.ctx;
  const d = dictOf(ctx, ref);
  if (!d) return null;
  const type = numOf(ctx, d.get(PDFName.of('ShadingType')));
  if (type !== 1 && type !== 2 && type !== 3) { walk.warn(`shading.unsupported (ShadingType ${type ?? '?'})`); return null; }
  // A missing /ColorSpace reads as RGB, as the web reads it.
  const space = colorSpaceName(ctx, d.get(PDFName.of('ColorSpace'))) ?? 'DeviceRGB';
  if (!SHADING_SPACES.has(space)) { walk.warn(`shading.unsupported (colour space ${space})`); return null; }
  const comps = shadingComps(space);
  if (type === 1) {
    const fn = pdfShadingFunction(walk, d.get(PDFName.of('Function')));
    if (!fn) { walk.warn('shading.unsupported (function-based, unparsable Function)'); return null; }
    const dom = numArray(ctx, d.get(PDFName.of('Domain'))) ?? [0, 1, 0, 1];
    const domain: [number, number, number, number] = [dom[0] ?? 0, dom[1] ?? 1, dom[2] ?? 0, dom[3] ?? 1];
    const flat = colourAt(fn, comps, (domain[0] + domain[1]) / 2, (domain[2] + domain[3]) / 2);
    if (!flat) { walk.warn('shading.unsupported (function-based, unevaluable)'); return null; }
    // Constant when a three by three grid over the domain agrees with the middle.
    let constant = true;
    for (let i = 0; i <= 2 && constant; i++) {
      for (let j = 0; j <= 2 && constant; j++) {
        const u = domain[0] + ((domain[1] - domain[0]) * i) / 2;
        const v = domain[2] + ((domain[3] - domain[2]) * j) / 2;
        constant = colourAt(fn, comps, u, v) === flat;
      }
    }
    walk.warn(constant ? 'shading.type1.flat' : 'shading.type1.midpoint');
    const mtx = numArray(ctx, d.get(PDFName.of('Matrix')));
    const shading: PdfShading = {
      type: 1, coords: [], stops: [], extend: [false, false], domain, flat,
      ...(mtx && mtx.length >= 6 ? { shadingMatrix: mtx } : {}),
    };
    return { shading, constant };
  }
  const coords = numArray(ctx, d.get(PDFName.of('Coords'))) ?? [];
  if ((type === 2 && coords.length < 4) || (type === 3 && coords.length < 6)) { walk.warn('shading.unsupported (bad Coords)'); return null; }
  const fn = pdfShadingFunction(walk, d.get(PDFName.of('Function')));
  if (!fn) { walk.warn('shading.unsupported (unparsable Function)'); return null; }
  const domain = numArray(ctx, d.get(PDFName.of('Domain'))) ?? [0, 1];
  const ramp = rampOf(fn, comps, domain[0] ?? 0, domain[1] ?? 1);
  if (!ramp) { walk.warn('shading.unsupported (degenerate ramp)'); return null; }
  const ext = boolArray(ctx, d.get(PDFName.of('Extend')));
  const stops = collapseStops(ramp);
  return {
    shading: {
      type: type === 2 ? 2 : 3, coords, stops,
      extend: [ext[0] ?? false, ext[1] ?? false],
      // The web's back-stop rule, so both hosts fill the same shape with the same colour.
      flat: stops[Math.floor(stops.length / 2)]!.color,
    },
    constant: false,
  };
}

/**
 * A /Pattern resource with no canvas. A shading pattern (PatternType 2) carries
 * its shading and flat colour; a constant function-based one only its colour,
 * which is exact, while a varying one keeps its shading so the painted object
 * is marked as an approximation. A tiling pattern (PatternType 1) is its
 * decoded tile and the tile's own resources, which the interpreter runs and
 * collapses as it does for the web.
 */
export function pdfPatternOf(walk: PdfWalk, ref: PdfRef, depth: number): PdfPattern | null {
  const ctx = walk.ctx;
  const d = dictOf(ctx, ref);
  if (!d) return null;
  const ptype = numOf(ctx, d.get(PDFName.of('PatternType')));
  const mtx = numArray(ctx, d.get(PDFName.of('Matrix')));
  const matrix = mtx ? { matrix: mtx } : {};
  if (ptype === 2) {
    const read = shadingRead(walk, d.get(PDFName.of('Shading')));
    if (!read) return null;
    const { shading, constant } = read;
    if (constant) return { ...matrix, ...(shading.flat ? { flat: shading.flat } : {}) };
    return { shading, ...matrix, ...(shading.flat ? { flat: shading.flat } : {}) };
  }
  if (ptype === 1) {
    const content = pdfWalkText(walk, ref);
    const bb = numArray(ctx, d.get(PDFName.of('BBox'))) ?? [];
    if (content == null || bb.length < 4) { walk.warn('pattern.unsupported (tiling, no stream or BBox)'); return null; }
    const bbox: [number, number, number, number] = [bb[0]!, bb[1]!, bb[2]!, bb[3]!];
    return {
      ...matrix,
      tiling: {
        content,
        resources: walk.resources(d.get(PDFName.of('Resources')), depth + 1),
        bbox,
        xStep: numOf(ctx, d.get(PDFName.of('XStep'))) || (bbox[2] - bbox[0]),
        yStep: numOf(ctx, d.get(PDFName.of('YStep'))) || (bbox[3] - bbox[1]),
        paintType: numOf(ctx, d.get(PDFName.of('PaintType'))) === 2 ? 2 : 1,
      },
    };
  }
  walk.warn(`pattern.unsupported (PatternType ${ptype ?? '?'})`);
  return null;
}

// ─── one page ────────────────────────────────────────────────────────────────

/** The subtypes of a marked `/Artifact` span this reader recognises. */
export type PdfArtifactKind = 'Header' | 'Footer';

export interface PdfInterpretedPage {
  /** Interpreted content in paint order, the array `findVectorArtwork` indexes into. */
  nodes: PdfNode[];
  /** MediaBox size in points. */
  width: number;
  height: number;
  /** Raster XObjects met on this page, keyed by the id each image node echoes back. */
  imageStreams: Map<string, PdfImageDesc>;
  /**
   * Parallel to `nodes` when `artifacts` was asked for: the artifact subtype a node
   * was painted inside, or undefined. Absent when it was not asked for.
   */
  artifacts?: Array<PdfArtifactKind | undefined>;
  /**
   * Parallel to `nodes` when `invisibleText` was asked for: true for a text node
   * shown in render mode 3 or 7, which puts no ink down (the OCR layer of a
   * searchable scan). Such a node also reads opacity 0.
   */
  invisible?: boolean[];
  /**
   * True when the interpreter filled its node ceiling (`PDF_MAP_MAX_PAGE_NODES`)
   * before a marker was stripped, so content after that point may be missing.
   * A page that paints exactly the ceiling reads true as well: the interpreter
   * stops without saying whether more followed.
   */
  truncated: boolean;
  /** Inline images (`BI` ... `EI`) in the page's own content, which the interpreter skips. */
  inlineImages: number;
  /** The page's own fonts by resource name, for measuring a run with its real advances. */
  fonts: Record<string, PdfFontInfo>;
}

export interface InterpretPdfPageOpts {
  /** Dotted diagnostic codes from the resource decoders and the interpreter. */
  diag?: (msg: string) => void;
  /** Build the resource walk. Defaults to a bounded walk with no shell decoders. */
  walk?: (ctx: PDFContext, imageStreams: Map<string, PdfImageDesc>, warn: (msg: string) => void) => PdfWalk;
  /** Report which nodes sat inside a marked `/Artifact` Header or Footer span. */
  artifacts?: boolean;
  /** Report which text nodes were shown in an invisible render mode (see `markPdfInvisibleText`). */
  invisibleText?: boolean;
  /**
   * Refuse a page whose decoded content passes this many characters: its own
   * streams, and every form, Type3 procedure and ToUnicode map the walk decodes.
   */
  maxContentChars?: number;
}

/** Thrown when a page's content is over the caller's budget, carrying the size so the caller can report it. */
export class PdfPageTooLargeError extends Error {
  readonly chars: number;
  /** True when decoding stopped at the budget, so `chars` is a lower bound. */
  readonly atLeast: boolean;
  constructor(chars: number, limit: number, atLeast = false) {
    super(atLeast
      ? `The page content is more than ${limit} characters, the limit.`
      : `The page content is ${chars} characters, over the ${limit} character limit.`);
    this.name = 'PdfPageTooLargeError';
    this.chars = chars;
    this.atLeast = atLeast;
  }
}

/** Decode and interpret ONE page (0-based) into nodes with unresolved image placeholders. */
export function interpretPdfDocPage(doc: PDFDocument, pageIndex: number, opts: InterpretPdfPageOpts = {}): PdfInterpretedPage {
  const diag = opts.diag ?? ((): void => {});
  const pdfPage = doc.getPage(pageIndex);
  const ctx = doc.context;
  const node = pdfPage.node;
  const mb = pdfPage.getMediaBox();

  const imageStreams = new Map<string, PdfImageDesc>();
  const walk = (opts.walk ?? ((c, images, warn) => makePdfWalk(c, images, warn, {}, { bounded: true })))(ctx, imageStreams, diag);
  if (opts.maxContentChars !== undefined) walk.content ??= { used: 0, limit: opts.maxContentChars };
  const resources = walk.resources(getKey(ctx, node, 'Resources'), 0);
  let content = pdfContentString(ctx, node, walk.content);

  const inlineImages = countPdfInlineImages(content);
  const invisible = opts.invisibleText ? markPdfInvisibleText(content) : null;
  if (invisible?.shows) content = invisible.content;
  let xobjects = resources.xobjects;
  const marked = opts.artifacts ? markPdfArtifactSpans(content) : null;
  if (marked?.spans.length) {
    content = marked.content;
    xobjects = { ...resources.xobjects, ...marked.markers };
  }

  const raw = interpretPdfPage({
    content,
    width: mb.width, height: mb.height,
    originX: mb.x || 0, originY: mb.y || 0,
    fonts: resources.fonts,
    xobjects,
    extgstates: resources.extgstates,
    ocgs: resources.ocgs,
    shadings: resources.shadings,
    patterns: resources.patterns,
    // The interpreter reports approximations and drops as (code, detail); the caller owns the wording.
    onWarn: (code, detail) => diag(detail ? `${code} (${detail})` : code),
  });
  // Measured before the marker nodes are stripped: a marker takes a place under the ceiling too.
  const truncated = raw.length >= PDF_MAP_MAX_PAGE_NODES;

  const hidden = new Set<PdfNode>();
  if (invisible?.shows) {
    for (const n of raw) {
      if (n.kind === 'text' && n.mcid === INVISIBLE_MCID) {
        delete n.mcid;
        n.opacity = 0;
        hidden.add(n);
      }
    }
  }

  const out: PdfInterpretedPage = { nodes: raw, width: mb.width, height: mb.height, imageStreams, truncated, inlineImages, fonts: resources.fonts };
  if (opts.artifacts) {
    const labelled = marked?.spans.length ? resolveArtifactMarkers(raw, marked.spans) : { nodes: raw, artifacts: raw.map(() => undefined) };
    out.nodes = labelled.nodes;
    out.artifacts = labelled.artifacts;
  }
  if (opts.invisibleText) out.invisible = out.nodes.map((n) => hidden.has(n));
  return out;
}

// ─── the content-stream scanner ──────────────────────────────────────────────

const PDF_WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const PDF_DELIM = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

type PdfOperand =
  | { t: 'name'; v: string }
  | { t: 'num'; v: number }
  | { t: 'dict'; start: number; end: number }
  | { t: 'other' };

interface PdfOp {
  word: string;
  /** Where the operator word starts. */
  start: number;
  /** Just past the operator (past `EI` for an inline image). */
  end: number;
  /** Where its first operand starts, or `start` when it has none. */
  operandsStart: number;
  operands: PdfOperand[];
}

/**
 * Walk a content stream's operators with their operands, skipping strings,
 * dictionaries and inline image data whole. The scanner the markers below share;
 * it reads the page's own stream only, never a form's.
 */
function walkPdfOps(src: string, visit: (op: PdfOp) => void): void {
  const n = src.length;
  const code = (k: number): number => src.charCodeAt(k);
  let operands: PdfOperand[] = [];
  let operandsStart = -1;
  let i = 0;

  const skipString = (): void => {
    let depth = 0;
    while (i < n) {
      const c = code(i);
      if (c === 0x5c) { i += 2; continue; }
      if (c === 0x28) depth++;
      else if (c === 0x29) { depth--; if (depth === 0) { i++; return; } }
      i++;
    }
  };
  /** From just past `<<` to just past its matching `>>`, strings and hex strings skipped whole. */
  const skipDict = (): void => {
    let depth = 1;
    while (i < n) {
      const c = code(i);
      if (c === 0x28) { skipString(); continue; }
      if (c === 0x3c && code(i + 1) === 0x3c) { depth++; i += 2; continue; }
      if (c === 0x3c) { while (i < n && code(i) !== 0x3e) i++; i++; continue; }
      if (c === 0x3e && code(i + 1) === 0x3e) { depth--; i += 2; if (depth <= 0) return; continue; }
      i++;
    }
  };
  const readRegular = (): string => {
    const start = i;
    while (i < n && !PDF_WS.has(code(i)) && !PDF_DELIM.has(code(i))) i++;
    return src.slice(start, i);
  };

  while (i < n) {
    const c = code(i);
    if (PDF_WS.has(c)) { i++; continue; }
    if (c === 0x25) { while (i < n && code(i) !== 0x0a && code(i) !== 0x0d) i++; continue; }
    if (operandsStart < 0) operandsStart = i;
    if (c === 0x28) { skipString(); operands.push({ t: 'other' }); continue; }
    if (c === 0x3c && code(i + 1) === 0x3c) {
      const start = i;
      i += 2;
      skipDict();
      operands.push({ t: 'dict', start, end: i });
      continue;
    }
    if (c === 0x3c) { while (i < n && code(i) !== 0x3e) i++; i++; operands.push({ t: 'other' }); continue; }
    if (c === 0x2f) { i++; operands.push({ t: 'name', v: readRegular() }); continue; }
    if (PDF_DELIM.has(c)) { i++; continue; }
    const opStart = i;
    const word = readRegular();
    if (!word) { i++; continue; }
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) { operands.push({ t: 'num', v: Number(word) }); continue; }
    if (word === 'BI') {
      // An inline image's payload is binary and not token-structured: skip to ID, then to EI.
      while (i < n) { if (src[i] === 'I' && src[i + 1] === 'D') { i += 2; break; } i++; }
      while (i < n) { if (src[i] === 'E' && src[i + 1] === 'I' && (i + 2 >= n || PDF_WS.has(code(i + 2)))) { i += 2; break; } i++; }
    }
    visit({ word, start: opStart, end: i, operandsStart, operands });
    operands = [];
    operandsStart = -1;
  }
}

/** Splice text into a stream at the given offsets, in offset order (stable for equal offsets). */
function spliceAt(src: string, inserts: Array<{ at: number; text: string }>): string {
  const sorted = inserts.map((ins, k) => ({ ...ins, k })).sort((a, b) => a.at - b.at || a.k - b.k);
  let out = '';
  let at = 0;
  for (const ins of sorted) {
    out += src.slice(at, ins.at) + ins.text;
    at = ins.at;
  }
  return out + src.slice(at);
}

/** Inline images (`BI` ... `EI`) in a content stream. The interpreter skips them without a word. */
export function countPdfInlineImages(src: string): number {
  let count = 0;
  walkPdfOps(src, (op) => { if (op.word === 'BI') count++; });
  return count;
}

// ─── invisible text ──────────────────────────────────────────────────────────

/** The synthetic marked-content id an invisible show is wrapped in. Above every artifact id. */
const INVISIBLE_MCID = 1_950_000_000;

/**
 * Wrap every text-showing operator (`Tj`, `TJ`, `'`, `"`) drawn in render mode 3
 * (invisible) or 7 (clip only) in a marked-content span with a synthetic `/MCID`,
 * so the text node the interpreter builds for it latches that id. The engine
 * interpreter does not track `Tr`, so this is how a searchable scan's OCR layer
 * is told apart from visible words. The mode is tracked through `q`/`Q`, which
 * save and restore it with the rest of the graphics state.
 *
 * Limits, stated: only the page's own stream is read (a form's text keeps its
 * mode unseen), and a text node the interpreter builds from a visible show and
 * an invisible one together takes the id of its first show.
 */
export function markPdfInvisibleText(src: string): { content: string; shows: number } {
  const inserts: Array<{ at: number; text: string }> = [];
  const saved: number[] = [];
  let mode = 0;
  let shows = 0;
  walkPdfOps(src, (op) => {
    switch (op.word) {
      case 'q': saved.push(mode); break;
      case 'Q': if (saved.length) mode = saved.pop()!; break;
      case 'Tr': {
        const last = op.operands[op.operands.length - 1];
        if (last?.t === 'num') mode = last.v;
        break;
      }
      case 'Tj': case 'TJ': case "'": case '"':
        if (mode === 3 || mode === 7) {
          shows++;
          inserts.push({ at: op.operandsStart, text: ` /LollyInvisible <</MCID ${INVISIBLE_MCID}>> BDC ` });
          inserts.push({ at: op.end, text: ' EMC ' });
        }
        break;
      default:
        break;
    }
  });
  return shows ? { content: spliceAt(src, inserts), shows } : { content: src, shows };
}

// ─── marked-content artifacts ────────────────────────────────────────────────

/**
 * Synthetic marked-content ids start here. A real MCID is a small index into a
 * page's structure; nothing a writer emits comes near this.
 */
const ARTIFACT_MCID_BASE = 1_900_000_000;
const ARTIFACT_MARKER_KEY = 'lolly-artifact-marker:';

export interface PdfArtifactMarking {
  /** The content stream with the markers inserted. Unchanged when no span was found. */
  content: string;
  /** One per marked span, in stream order. */
  spans: PdfArtifactKind[];
  /** Resource entries the inserted `Do` operators name. */
  markers: Record<string, PdfXObject>;
}

/**
 * Find every `/Artifact <<... /Subtype /Header|/Footer ...>> BDC ... EMC` span in
 * a page's own content stream and mark it for the interpreter, which has no
 * notion of an artifact:
 *
 *   - a synthetic `/MCID` is appended to the span's property list, so a text run
 *     shown inside it latches that id (the interpreter latches the innermost open
 *     marked-content id at the run's origin or first glyph, which also catches a
 *     span opened inside a `BT` block, where the text node is only pushed at `ET`);
 *   - a start and an end marker (`/Name Do` of a registered image key) are placed
 *     after `BDC` and before `EMC`, so every non-text node painted between them is
 *     found by its position in paint order.
 *
 * Limits, stated: a span declared inside a form XObject or a Type3 procedure is
 * not seen (only the page's own stream is read), and a property list given by
 * name (`/Artifact /P0 BDC`) is not resolved against /Properties.
 */
export function markPdfArtifactSpans(src: string): PdfArtifactMarking {
  const inserts: Array<{ at: number; text: string }> = [];
  const spans: PdfArtifactKind[] = [];
  const stack: Array<number | null> = [];

  walkPdfOps(src, (op) => {
    if (op.word === 'BDC') {
      const props = op.operands[op.operands.length - 1];
      const tag = op.operands[op.operands.length - 2];
      let kind: PdfArtifactKind | null = null;
      if (tag?.t === 'name' && tag.v === 'Artifact' && props?.t === 'dict') {
        const text = src.slice(props.start, props.end);
        const subtype = /\/Subtype\s*\/([A-Za-z]+)/.exec(text)?.[1];
        if (subtype === 'Header' || subtype === 'Footer') kind = subtype;
        if (kind) {
          const k = spans.length;
          spans.push(kind);
          // Before the closing `>>`, so the synthetic id is the last /MCID the interpreter reads.
          inserts.push({ at: props.end - 2, text: ` /MCID ${ARTIFACT_MCID_BASE + k} ` });
          inserts.push({ at: op.end, text: ` /${markerName('s', k)} Do ` });
          stack.push(k);
        }
      }
      if (!kind) stack.push(null);
    } else if (op.word === 'BMC') {
      stack.push(null);
    } else if (op.word === 'EMC') {
      const k = stack.pop();
      if (typeof k === 'number') inserts.push({ at: op.start, text: ` /${markerName('e', k)} Do ` });
    }
  });

  if (!spans.length) return { content: src, spans, markers: {} };
  const markers: Record<string, PdfXObject> = {};
  spans.forEach((_, k) => {
    markers[markerName('s', k)] = { kind: 'image', imageKey: `${ARTIFACT_MARKER_KEY}s${k}` };
    markers[markerName('e', k)] = { kind: 'image', imageKey: `${ARTIFACT_MARKER_KEY}e${k}` };
  });
  return { content: spliceAt(src, inserts), spans, markers };
}

function markerName(edge: 's' | 'e', k: number): string {
  return `LollyArtifact${edge === 's' ? 'Start' : 'End'}${k}`;
}

/** Strip the markers and synthetic ids back out, labelling each real node with its span's subtype. */
function resolveArtifactMarkers(
  nodes: PdfNode[],
  spans: PdfArtifactKind[],
): { nodes: PdfNode[]; artifacts: Array<PdfArtifactKind | undefined> } {
  const markerOf = (node: PdfNode): { edge: 's' | 'e'; k: number } | null => {
    const key = node._imageXObject;
    if (!key?.startsWith(ARTIFACT_MARKER_KEY)) return null;
    const rest = key.slice(ARTIFACT_MARKER_KEY.length);
    return { edge: rest[0] === 's' ? 's' : 'e', k: Number(rest.slice(1)) };
  };
  // A marker can be lost (an image under a soft mask that evaluates to nothing is
  // not painted). A span is trusted for non-text nodes only when both ends arrived.
  const seen = new Map<number, number>();
  for (const node of nodes) {
    const m = markerOf(node);
    if (m) seen.set(m.k, (seen.get(m.k) ?? 0) | (m.edge === 's' ? 1 : 2));
  }
  const out: PdfNode[] = [];
  const artifacts: Array<PdfArtifactKind | undefined> = [];
  const open: number[] = [];
  for (const node of nodes) {
    const m = markerOf(node);
    if (m) {
      if (seen.get(m.k) === 3) {
        if (m.edge === 's') open.push(m.k);
        else {
          const at = open.lastIndexOf(m.k);
          if (at >= 0) open.splice(at, 1);
        }
      }
      continue;
    }
    let kind: PdfArtifactKind | undefined;
    if (node.kind === 'text') {
      const mcid = node.mcid;
      if (typeof mcid === 'number' && mcid >= ARTIFACT_MCID_BASE) {
        kind = spans[mcid - ARTIFACT_MCID_BASE];
        delete node.mcid;
      }
    } else if (open.length) {
      kind = spans[open[open.length - 1] ?? -1];
    }
    out.push(node);
    artifacts.push(kind);
  }
  return { nodes: out, artifacts };
}

// ─── the structure tree ──────────────────────────────────────────────────────

/** Depth cap for the struct-tree walk: the tree is a graph and can cycle. */
const MAX_STRUCT_DEPTH = 64;

/**
 * Flatten a page's `/StructTreeRoot` into elements in DOCUMENT order (depth
 * first, `/K` arrays in order). Only elements whose `/Pg`, inherited from their
 * ancestors when absent, is this page are returned. [] for an untagged document,
 * which is the signal to stay geometric.
 */
export function readPdfStructOrder(doc: PDFDocument, pageIndex: number): TaggedElement[] {
  const ctx = doc.context;
  const out: TaggedElement[] = [];

  let pageRef: PDFRef | null = null;
  try { pageRef = doc.getPage(pageIndex).ref; } catch { return out; }
  const root = doc.catalog.get(PDFName.of('StructTreeRoot'));
  if (!root || !pageRef) return out;

  const seen = new Set<string>();

  /** The MCIDs a /K entry contributes, for an element already on this page. */
  const mcidsOf = (k: PdfRef, acc: number[], depth: number): void => {
    if (depth > MAX_STRUCT_DEPTH || acc.length > 4096) return;
    const v = ctx.lookup(k as PDFObject | undefined);
    if (v instanceof PDFNumber) { acc.push(v.asNumber()); return; }
    if (v instanceof PDFArray) { for (const e of v.asArray()) mcidsOf(e, acc, depth + 1); return; }
    const d = dictOf(ctx, v);
    if (!d) return;
    const type = nameOf(ctx, d.get(PDFName.of('Type')));
    if (type === 'MCR') {
      const num = numOf(ctx, d.get(PDFName.of('MCID')));
      if (num != null) acc.push(num);
      return;
    }
    // /OBJR points at an object (a form field, an annotation), not at content.
  };

  const walk = (node: PdfRef, inheritedPg: PDFRef | null, depth: number): void => {
    if (depth > MAX_STRUCT_DEPTH || out.length > 4096) return;
    const tag = node instanceof PDFRef ? node.tag : '';
    if (tag) {
      if (seen.has(tag)) return;
      seen.add(tag);
    }
    const d = dictOf(ctx, node);
    if (!d) return;

    const ownPg = d.get(PDFName.of('Pg'));
    const pg = ownPg instanceof PDFRef ? ownPg : inheritedPg;
    const kids = d.get(PDFName.of('K'));
    const structType = nameOf(ctx, d.get(PDFName.of('S'))) ?? '';

    if (structType && pg && pageRef && pg.tag === pageRef.tag) {
      const mcids: number[] = [];
      mcidsOf(kids, mcids, 0);
      if (mcids.length) out.push({ mcids, type: structType });
    }

    const arr = ctx.lookup(kids as PDFObject | undefined);
    if (arr instanceof PDFArray) {
      for (const kid of arr.asArray()) {
        // Bare mcids and MCRs were this element's own content, not children.
        const kv = ctx.lookup(kid);
        if (kv instanceof PDFNumber) continue;
        const kd = dictOf(ctx, kv);
        if (!kd || nameOf(ctx, kd.get(PDFName.of('Type'))) === 'MCR') continue;
        walk(kid, pg, depth + 1);
      }
    } else if (kids && !(ctx.lookup(kids as PDFObject | undefined) instanceof PDFNumber)) {
      const kd = dictOf(ctx, kids);
      if (kd && nameOf(ctx, kd.get(PDFName.of('Type'))) !== 'MCR') walk(kids, pg, depth + 1);
    }
  };

  try { walk(root, null, 0); } catch { return []; }
  return out;
}

// ─── image XObjects to bytes ─────────────────────────────────────────────────

/** RGBA pixels, 8 bits a channel, row-major, no premultiplication. */
export interface PdfPixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** The pixel work a shell owns. */
export interface PdfImageCodec {
  /** RGBA to PNG bytes, or null when this host cannot encode. */
  encodePng(pixels: PdfPixels): Promise<Uint8Array | null>;
  /** Displayable bytes back to RGBA, or null. Absent means this host decodes nothing. */
  decode?(bytes: Uint8Array, mime: string): Promise<PdfPixels | null>;
}

export interface PdfDecodedImage {
  bytes: Uint8Array;
  mime: string;
  ext: string;
}

/** Why an image came back opaque or not at all. A caller owns the wording shown to a person. */
export type PdfImageIssue =
  | { code: 'unsupported-encoding'; filter: string }
  | { code: 'smask-undecodable' }
  | { code: 'decode-failed'; message: string };

/** Plain English for an image issue, for a caller with no wording of its own. */
export function describePdfImageIssue(issue: PdfImageIssue): string {
  switch (issue.code) {
    case 'unsupported-encoding':
      return `Skipped an embedded image in an unsupported encoding (${issue.filter}).`;
    case 'smask-undecodable':
      return 'Kept an embedded image opaque (its soft mask was undecodable).';
    default:
      return `Could not import an embedded image (${issue.message}).`;
  }
}

/**
 * Decode a raster XObject to displayable bytes: DCTDecode passes through as the
 * JPEG it already is; 8-bit Flate RGB or Gray (no predictor, or a PNG predictor,
 * which is what a PNG embed writes) becomes a PNG through the codec. A soft mask
 * is composited when the codec can decode the base; otherwise the image stays
 * opaque and the caller hears `smask-undecodable`.
 */
export async function decodePdfImage(
  desc: PdfImageDesc,
  codec: PdfImageCodec,
  onIssue: (issue: PdfImageIssue) => void = () => {},
): Promise<PdfDecodedImage | null> {
  const last = desc.filter[desc.filter.length - 1];
  try {
    let base: PdfDecodedImage | null = null;
    if (last === 'DCTDecode') {
      base = { bytes: desc.stream.getContents(), mime: 'image/jpeg', ext: 'jpg' };
    } else {
      // TIFF predictor 2 (2..9) is refused, the rest decoded.
      const pred = desc.predictor ?? 1;
      if ((last === 'FlateDecode' || last == null) && desc.width > 0 && desc.height > 0 && desc.bpc === 8 && (pred <= 1 || pred >= 10)) {
        const png = await flateImageToPng(desc, codec);
        if (png) base = { bytes: png, mime: 'image/png', ext: 'png' };
      }
    }
    if (!base) {
      onIssue({ code: 'unsupported-encoding', filter: last || 'raw' });
      return null;
    }
    if (desc.smask) {
      const masked = await applySmask(base, desc.smask, codec);
      if (masked) return masked;
      onIssue({ code: 'smask-undecodable' });
    }
    return base;
  } catch (err) {
    onIssue({ code: 'decode-failed', message: msg(err) });
    return null;
  }
}

/** Merge a /SMask's grayscale plane into the base's alpha channel (nearest-neighbour when the planes differ in size). */
async function applySmask(base: { bytes: Uint8Array; mime: string }, smask: PdfImageDesc, codec: PdfImageCodec): Promise<PdfDecodedImage | null> {
  if (!codec.decode) return null;
  const img = await codec.decode(base.bytes, base.mime);
  if (!img) return null;

  let alpha: Uint8Array | Uint8ClampedArray | null = null;
  let aw = smask.width;
  let ah = smask.height;
  if (smask.filter[smask.filter.length - 1] === 'DCTDecode') {
    const m = await codec.decode(smask.stream.getContents(), 'image/jpeg');
    if (m) {
      const gray = new Uint8Array(m.width * m.height);
      for (let i = 0; i < gray.length; i++) gray[i] = m.data[i * 4]!;
      alpha = gray; aw = m.width; ah = m.height;
    }
  } else if (smask.bpc === 8) {
    alpha = pdfFlateSamples(smask, 1);
  }
  if (!alpha || aw < 1 || ah < 1) return null;

  const { width, height, data } = img;
  for (let y = 0; y < height; y++) {
    const sy = height === ah ? y : Math.min(ah - 1, Math.floor((y * ah) / height));
    for (let x = 0; x < width; x++) {
      const sx = width === aw ? x : Math.min(aw - 1, Math.floor((x * aw) / width));
      data[(y * width + x) * 4 + 3] = alpha[sy * aw + sx]!;
    }
  }
  const png = await codec.encodePng(img);
  return png ? { bytes: png, mime: 'image/png', ext: 'png' } : null;
}

/**
 * Inflate and de-predict a Flate image stream's samples (8 bits a component only).
 * pdf-lib's FlateStream inflates but never applies predictors, so a PNG-predicted
 * stream is still row-filtered and is reversed here; TIFF predictor 2 is refused.
 *
 * The inflate stops at the size the declared width, height and components need
 * (one filter byte a row more for a PNG predictor), so a stream that inflates far
 * past its own dimensions costs no more than they do.
 */
export function pdfFlateSamples(desc: PdfImageDesc, comps: number): Uint8Array | Uint8ClampedArray | null {
  if (desc.bpc !== 8 || desc.width < 1 || desc.height < 1) return null;
  const pred = desc.predictor ?? 1;
  const need = pred >= 10 ? desc.height * (1 + desc.width * comps) : desc.width * desc.height * comps;
  let samples: Uint8Array | Uint8ClampedArray | null;
  try { samples = pdfStreamBytes(desc.stream, need); } catch { return null; }
  if (!samples) return null;
  if (pred >= 10) {
    const un = unfilterPng(samples as Uint8Array, desc.width, desc.height, comps);
    if (!un) return null;
    samples = un;
  } else if (pred > 1) {
    return null;
  }
  return samples.length >= desc.width * desc.height * comps ? samples : null;
}

async function flateImageToPng(desc: PdfImageDesc, codec: PdfImageCodec): Promise<Uint8Array | null> {
  const cs = desc.colorSpace || '';
  const comps = /RGB/i.test(cs) ? 3 : /Gray/i.test(cs) ? 1 : 0;
  if (!comps) return null;
  const { width, height } = desc;
  const samples = pdfFlateSamples(desc, comps);
  if (!samples) return null;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, s = 0, d = 0; i < width * height; i++) {
    if (comps === 3) { rgba[d] = samples[s]!; rgba[d + 1] = samples[s + 1]!; rgba[d + 2] = samples[s + 2]!; s += 3; }
    else { const g = samples[s]!; rgba[d] = g; rgba[d + 1] = g; rgba[d + 2] = g; s += 1; }
    rgba[d + 3] = 255; d += 4;
  }
  return codec.encodePng({ data: rgba, width, height });
}

/**
 * A pure codec for a host with no canvas: the engine's deterministic PNG packer,
 * and a reader for 8-bit non-interlaced PNG (the packer's own output). It decodes
 * no JPEG, so a JPEG base with a soft mask stays opaque.
 */
export const NODE_PDF_IMAGE_CODEC: PdfImageCodec = {
  async encodePng(pixels: PdfPixels): Promise<Uint8Array | null> {
    return packPng(pixels.data, { width: pixels.width, height: pixels.height, channels: 4 });
  },
  async decode(bytes: Uint8Array, mime: string): Promise<PdfPixels | null> {
    return mime === 'image/png' ? readSimplePng(bytes) : null;
  },
};

/** Read an 8-bit, non-interlaced grey, RGB or RGBA PNG into RGBA, or null. */
function readSimplePng(bytes: Uint8Array): PdfPixels | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 33 || sig.some((b, k) => bytes[k] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat: Uint8Array[] = [];
  let at = 8;
  while (at + 8 <= bytes.length) {
    const len = view.getUint32(at);
    const type = String.fromCharCode(bytes[at + 4]!, bytes[at + 5]!, bytes[at + 6]!, bytes[at + 7]!);
    const body = bytes.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      const depth = body[8];
      colorType = body[9] ?? -1;
      if (depth !== 8 || body[12] !== 0) return null;
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    at += 12 + len;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!channels || width < 1 || height < 1) return null;
  const joined = new Uint8Array(idat.reduce((a, b) => a + b.length, 0));
  let off = 0;
  for (const part of idat) { joined.set(part, off); off += part.length; }
  let raw: Uint8Array;
  try { raw = unzlibSync(joined); } catch { return null; }
  const samples = unfilterPng(raw, width, height, channels);
  if (!samples) return null;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0, s = 0; p < width * height; p++, s += channels) {
    const d = p * 4;
    if (channels === 1) { data[d] = samples[s]!; data[d + 1] = samples[s]!; data[d + 2] = samples[s]!; data[d + 3] = 255; }
    else {
      data[d] = samples[s]!; data[d + 1] = samples[s + 1]!; data[d + 2] = samples[s + 2]!;
      data[d + 3] = channels === 4 ? samples[s + 3]! : 255;
    }
  }
  return { data, width, height };
}

// ─── vector artwork ──────────────────────────────────────────────────────────

/** Cap on extracted marks in one listing: a pathological page must not produce hundreds. */
export const PDF_MAX_VECTORS = 40;
/** Breathing room around a mark's bounding box, in points. */
export const PDF_VECTOR_PAD = 2;

/** One piece of vector artwork lifted out of a page, as standalone SVG. */
export interface ExtractedVector {
  /** Self-contained SVG, cropped to the mark and sized in points. */
  svg: string;
  width: number;
  height: number;
  /** 0-based page it was found on. */
  page: number;
  /** Distinct fill colours, most-used first: a palette preview. */
  fills: string[];
  /** How many shapes make up the mark. */
  shapes: number;
  /** Plain-language reason it was believed to be artwork. */
  reason: string;
}

/**
 * Each mark `findVectorArtwork` finds on one page, as its own SVG. `render`
 * draws the page culled to a window with a distinct `idPrefix` (def ids are
 * plain counters, and stored SVG assets are inlined on export where ids do not
 * scope); the crop is applied here, before anything normalises the root.
 */
export async function pdfVectorsOnPage(
  page: Pick<PdfInterpretedPage, 'nodes' | 'width' | 'height'>,
  pageIndex: number,
  idBase: number,
  render: (window: CullWindow, idPrefix: string) => Promise<string>,
): Promise<ExtractedVector[]> {
  const { nodes, width, height } = page;
  const marks = findVectorArtwork(nodes, { width, height });
  const out: ExtractedVector[] = [];

  for (let m = 0; m < marks.length && idBase + out.length < PDF_MAX_VECTORS; m++) {
    const mark = marks[m]!;
    const x = Math.max(0, mark.rect.x - PDF_VECTOR_PAD);
    const y = Math.max(0, mark.rect.y - PDF_VECTOR_PAD);
    const w = Math.min(width - x, mark.rect.w + PDF_VECTOR_PAD * 2);
    const h = Math.min(height - y, mark.rect.h + PDF_VECTOR_PAD * 2);
    if (!(w > 0) || !(h > 0)) continue;

    try {
      // Cull to the mark first (bytes and decode time), then window to the exact
      // rect: both come from ONE crop so they cannot disagree.
      const svg = windowPdfSvg(await render({ x, y, width: w, height: h }, `v${idBase + out.length}`), { x, y, width: w, height: h });
      out.push({
        svg, width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)),
        page: pageIndex, fills: mark.fills, shapes: mark.indices.length, reason: mark.reason,
      });
    } catch { /* a mark that will not serialise is dropped, not fatal */ }
  }
  return out;
}

// ─── text ────────────────────────────────────────────────────────────────────

/** One positioned run of text: a text node, or one line of a multi-line node. */
export interface PdfTextRun {
  text: string;
  /**
   * Box in the page's top-left, y-down point space. On a one-line node `w` is the
   * interpreter's width, the pen's advance with the font's widths when it has
   * them; on a line of a multi-line node it is the line's measured ink when the
   * node carries `lineInk`, otherwise an estimate from its length.
   */
  x: number;
  y: number;
  w: number;
  h: number;
  baseline: number;
  /**
   * Where the run's ink ends: `x` plus the node's `lineInk` for this line, the
   * end of the last visible glyph by the font's own advances, when `measured`;
   * otherwise estimated at 0.55 em a character, the interpreter's own guess.
   * Not `x + w`, which counts a trailing space the text trims.
   */
  right: number;
  /** True when `right` was measured with the font's advance widths. */
  measured?: true;
  /** Character spacing after each glyph, from the node, in points. */
  tracking?: number;
  /** The run ended in a space the producer showed as a glyph, which `text` trims (`PdfNode.spaceAfter`). */
  spaceAfter?: true;
  /** Font size in points. */
  size: number;
  /** The base font name with its subset prefix removed. */
  font: string;
  weight: number;
  bold: boolean;
  italic: boolean;
  /** The fill colour as the interpreter reported it (usually `#rrggbb`). */
  color: string;
  /** 0 to 100. */
  opacity: number;
  /** Clockwise degrees; 0 for upright text. */
  rot: number;
  /** Position of the source node in paint order. */
  nodeIndex: number;
  artifact?: PdfArtifactKind;
}

/** Runs sharing a baseline and a flow, left to right. */
export interface PdfTextLine {
  runs: PdfTextRun[];
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  artifact?: PdfArtifactKind;
  /** The lowest paint-order index among the runs, which is the line's z-order. */
  firstNode: number;
}

/** Baselines within this fraction of the smaller size are one line. */
const LINE_BASELINE_TOLERANCE = 0.4;
/** A horizontal gap wider than this many sizes starts a new line (a column gutter, a table cell). */
const LINE_GAP_SIZES = 2.5;
/** Text turned further than this reads as out of flow and keeps its own line. */
const UPRIGHT_DEG = 0.5;

function runsOfNode(node: PdfNode, nodeIndex: number, artifact: PdfArtifactKind | undefined): PdfTextRun[] {
  const raw = node.text ?? '';
  if (!raw.trim()) return [];
  const size = node.fontSize ?? 12;
  const lead = (node.lineHeight ?? 1.4) * size;
  const font = String(node.fontFamily ?? '');
  const weight = typeof node.fontWeight === 'number' ? node.fontWeight : Number(node.fontWeight) || pdfWeightFromName(font);
  const lines = raw.split('\n');
  const tracking = typeof node.tracking === 'number' && Number.isFinite(node.tracking) && node.tracking > 0 ? node.tracking : 0;
  const out: PdfTextRun[] = [];
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    // The ink edge the interpreter measured for this line (from the node's x,
    // whatever the line's own start), or 0 when it measured none.
    const inkW = Array.isArray(node.lineInk) ? node.lineInk[i] : undefined;
    const ink = typeof inkW === 'number' && Number.isFinite(inkW) && inkW > 0 ? inkW : 0;
    // One line keeps the node's own width; a line of a multi-line node has only
    // the node's widest line to go by, so it takes its own ink when measured and
    // otherwise an estimate from its length.
    const w = lines.length === 1 ? node.w : Math.min(node.w, ink || line.length * size * 0.55);
    const run: PdfTextRun = {
      text: line,
      x: node.x,
      y: node.y + i * lead,
      w: Math.max(1, w),
      h: lines.length === 1 ? node.h : lead,
      baseline: node.y + 0.8 * size + i * lead,
      right: node.x + (ink || line.length * size * 0.55),
      size,
      font,
      weight,
      bold: weight >= 600,
      italic: /italic|oblique/i.test(font),
      color: node.fg ?? '#000000',
      opacity: node.opacity ?? 100,
      rot: node.rot ?? 0,
      nodeIndex,
    };
    if (ink) run.measured = true;
    if (tracking) run.tracking = tracking;
    if (i === lines.length - 1 && node.spaceAfter) run.spaceAfter = true;
    if (artifact) run.artifact = artifact;
    out.push(run);
  });
  return out;
}

/**
 * Text runs joined into lines. Every run keeps its own font, size and colour; a
 * line is only a grouping, so a coloured word in a sentence stays a run of its own
 * colour inside the line. Two runs share a line when their baselines agree, they
 * sit in one flow (the next starts at or after where the line's ink ends, within
 * a word gap) and they carry the same artifact subtype. The ink edge is each
 * run's `right`, measured from the node's `lineInk` where the interpreter has
 * it, so a trimmed trailing space does not stretch the flow. Deterministic: runs
 * are taken in paint order and each joins the first open line it fits.
 */
export function pdfTextLines(nodes: PdfNode[], artifacts?: ReadonlyArray<PdfArtifactKind | undefined>): PdfTextLine[] {
  type Open = PdfTextLine & { right: number; ink: number; baseline: number; size: number };
  const lines: Open[] = [];
  nodes.forEach((node, index) => {
    if (node.kind !== 'text') return;
    for (const run of runsOfNode(node, index, artifacts?.[index])) {
      const upright = Math.abs(run.rot) <= UPRIGHT_DEG;
      const host = upright
        ? lines.find((line) =>
          Math.abs(line.rot) <= UPRIGHT_DEG
          && line.artifact === run.artifact
          && Math.abs(line.baseline - run.baseline) <= LINE_BASELINE_TOLERANCE * Math.min(line.size, run.size)
          && run.x >= line.ink - 0.5 * run.size
          && run.x - line.ink <= LINE_GAP_SIZES * Math.max(line.size, run.size))
        : undefined;
      if (host) {
        host.runs.push(run);
        const right = Math.max(host.right, run.x + run.w);
        const bottom = Math.max(host.y + host.h, run.y + run.h);
        host.y = Math.min(host.y, run.y);
        host.h = bottom - host.y;
        host.right = right;
        host.ink = Math.max(host.ink, run.right);
        host.w = right - host.x;
        host.size = Math.max(host.size, run.size);
        continue;
      }
      const line: Open = {
        runs: [run], x: run.x, y: run.y, w: run.w, h: run.h, rot: run.rot,
        firstNode: index, right: run.x + run.w, ink: run.right, baseline: run.baseline, size: run.size,
      };
      if (run.artifact) line.artifact = run.artifact;
      lines.push(line);
    }
  });
  return lines.map(({ right: _right, ink: _ink, baseline: _baseline, size: _size, ...line }) => {
    line.runs.sort((a, b) => a.x - b.x || a.nodeIndex - b.nodeIndex);
    return line;
  });
}

/**
 * The word gap, as a fraction of the size, that breaks after an estimated edge:
 * pdf-text's own `ESTIMATED_WORD_GAP_EM`, wider than `PDF_WORD_GAP_EM` because an
 * estimated edge can overshoot a real one.
 */
const ESTIMATED_WORD_GAP_EM = 0.2;

/**
 * A line's runs as text, in order, each with a leading space where a word break
 * falls before it. The rule is pdf-text's `joinFragments`, so the rebrand
 * adapter, Unpack and pdf-text read one line one way: a run that showed a
 * trailing space glyph (`spaceAfter`) is followed by a break when the next run
 * starts past its ink; otherwise the engine's `pdfWordBreak` judges the gap past
 * the previous run's ink, net of its character spacing when that edge was
 * measured, against `PDF_WORD_GAP_EM` (measured) or a wider threshold
 * (estimated). A PDF positions words rather than spelling the space between
 * them, so without this a line reads as one glued word.
 */
export function pdfLineRunTexts(line: Pick<PdfTextLine, 'runs'>): string[] {
  const out: string[] = [];
  let acc = '';
  let prev: PdfTextRun | null = null;
  for (const run of line.runs) {
    let text = run.text;
    if (prev && acc) {
      const measured = prev.measured === true;
      const gap = run.x - prev.right - (measured ? prev.tracking ?? 0 : 0);
      const size = Math.max(1, run.size);
      const spelled = prev.spaceAfter === true && gap > 0 && !/\s$/.test(acc) && !/^\s/.test(text);
      if (spelled || pdfWordBreak(acc, text, gap / size, measured ? PDF_WORD_GAP_EM : ESTIMATED_WORD_GAP_EM)) text = ` ${text}`;
    }
    out.push(text);
    acc += text;
    prev = run;
  }
  return out;
}

// ─── the scanned-page decision ───────────────────────────────────────────────

/**
 * The engine's own test (`extractPageText(...).scanned`): the page paints no text
 * but an image covers at least half of it. There is nothing to read without OCR.
 */
export function pdfPageScanned(nodes: PdfNode[], width: number, height: number): boolean {
  return extractPageText(nodes, { width, height }).scanned;
}
