// SPDX-License-Identifier: MPL-2.0
// Design Import + asset upload - PDF / Adobe Illustrator (.ai) parser.
//
// The SHELL half of the PDF import path. An Illustrator .ai file saved with PDF
// compatibility (Illustrator's default) IS a PDF, so .ai and .pdf both land here.
// This module owns the byte work - it uses pdf-lib to load the document, decode a
// page's content stream(s), and pre-extract resources (fonts → byte→text
// decoders, XObjects → image markers / nested form streams, ExtGStates → alpha,
// optional-content groups → layer labels). It hands the decoded content + a plain
// resource descriptor to the PURE engine interpreter (engine/src/pdf-map.ts), which
// reconstructs editable DesignNodes. Nothing leaves the device - the whole parse is
// local. From those SAME interpreted nodes it serves two ingest surfaces:
//
//   parsePdfFile          → Design boxes (image/vector placeholders resolved
//                           into individually-stored user assets)
//   ingestPdfAsSvgAssets  → whole pages as standalone SVG user assets (the upload
//                           paths: catalog drop area, asset-picker upload), via the
//                           engine's pdfNodesToSvg with images inlined as data: URIs
//
// A multi-page document asks which page(s) with the pickPdfPages dialog - single-
// select for a canvas import, multi-select (or all) for asset uploads - so the two
// surfaces stay behaviourally identical.
//
// Fidelity: rectangles/ellipses/text/groups come back as editable boxes; arbitrary
// paths come back as crisp vector (SVG) image boxes; raster image XObjects are decoded
// where the browser can (JPEG directly; Flate RGB/Gray via canvas). Clipped paint
// remains in SVG assets. Unsupported content is reported for source review.

import { PDFName, PDFDict, PDFArray, PDFRef, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import type { PDFDocument, PDFContext, PDFObject } from 'pdf-lib';
import {
  finalizeBoxes, pdfNodesToSvg, cullPdfNodes, extractPageText,
  findHiddenText as engineFindHiddenText,
  type DesignMapOptions, type PageText, type HiddenTextFinding, type TaggedElement,
} from '@lolly/engine';
import type { CullWindow } from '../../../../engine/src/pdf-svg.ts';
import { bytesToBase64 } from '../lib/util/bytes.ts';
import type { PdfNode, PdfSoftMaskDef } from '../../../../engine/src/pdf-map.ts';
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { renderTilePixels, type TileSource } from '../lib/pdf-shading.ts';
import { readFontEmbedding, type FontEmbeddingInfo } from '../lib/font-utils.ts';
import {
  backdropLuminosity, buildPattern, buildShading, decodedText, dictOf, getKey,
  groupColorSpace, nameOf, numArray, softMaskId,
  type Ref, type ShadingCtx, type SoftMaskIdRegistry,
} from '../lib/pdf-objects.ts';
// The DOM-free page walk (resources, image decode, vectors, the struct tree) lives
// in node-shell so the terminal and the rebrand source adapter read pages the same
// way. Reached by relative path until the package exports a `./pdf-read` subpath.
import {
  loadPdfDocument, interpretPdfDocPage, makePdfWalk, decodePdfImage, readPdfStructOrder,
  pdfVectorsOnPage, PDF_MAX_VECTORS,
  type PdfImageCodec, type PdfImageDesc, type PdfImageIssue, type PdfPixels, type PdfWalk, type ExtractedVector,
} from '@lolly-tools/node-shell/pdf-read';
import { storeUserUpload } from './picker.ts';
import { trapFocus } from '../lib/focus-trap.ts';
import type { FocusTrap } from '../lib/focus-trap.ts';
import { NAV_EVENTS } from '../utils.ts';
import { pdfFontMetrics } from '../lib/pdf-font-metrics.ts';
import { pdfDesignNodes, type PdfDesignNotice } from '../lib/pdf-design-nodes.ts';
import { setDesignImportReport, type DesignImportFinding } from '../lib/design-import-report.ts';
import { setRulesSourcePages } from '../lib/design-tool-source.ts';

export type { ExtractedVector } from '@lolly-tools/node-shell/pdf-read';
import type { PdfResourceDecoders } from '@lolly-tools/node-shell/pdf-read';

// The interpreter's PdfNode plus the `image` field the shell fills in when it resolves a
// vector/raster placeholder to a stored asset (structurally the design-map DesignNode).
interface ImportNode extends PdfNode { image?: unknown; }

// A raster image XObject the shell will resolve to stored bytes (node-shell's descriptor).
type ImageDesc = PdfImageDesc;

// ── document loading + per-page interpretation (shared by both surfaces) ────────

async function loadDoc(file: File | Blob): Promise<PDFDocument> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return await loadPdfDocument(bytes);
  } catch (err) {
    throw new Error('Couldn’t read this PDF/.ai - it may be encrypted or damaged. (' + msg(err) + ')');
  }
}

interface InterpretedPage {
  nodes: ImportNode[];
  width: number;
  height: number;
  /** Raster XObjects found on this page, keyed by the id the engine echoes back. */
  imageStreams: Map<string, ImageDesc>;
  /** Function-based (ShadingType 1) shadings that need a raster tile, keyed by the
   *  opaque `tileKey` the engine echoes back on each gradient. Nothing is
   *  rasterised until a caller asks - a page that never paints one pays nothing. */
  tiles: Map<string, TileSource>;
}

/**
 * Decode + interpret ONE page (0-based) into DesignNodes with unresolved placeholders.
 *
 * `diag` is the DIAGNOSTIC sink - dotted codes from the resource decoders and the
 * engine interpreter, one per approximated or dropped paint. It is not the
 * caller's user-facing warn stream: a single app screenshot legitimately emits
 * ~80 `pattern.tiling.collapsed` lines, which is a report, not a notification. The
 * docs-shot audit reads it verbatim; parsePdfFile summarises it.
 *
 * The walk itself is node-shell's `interpretPdfDocPage`; this view adds the three
 * decoders that need its own modules (soft masks, shadings, patterns) and the
 * shading tiles only a canvas can rasterise.
 */
function interpretPage(doc: PDFDocument, pageIndex: number, diag: (msg: string) => void = () => {}): InterpretedPage {
  const tiles = new Map<string, TileSource>();
  const page = interpretPdfDocPage(doc, pageIndex, {
    diag,
    walk: (ctx, imageStreams, warn) => makeExtractCtx(ctx, imageStreams, tiles, warn),
  });
  return { nodes: page.nodes as ImportNode[], width: page.width, height: page.height, imageStreams: page.imageStreams, tiles };
}

/**
 * Parse a PDF / .ai file into a Design boxes array.
 *
 * Page choice for a multi-page document: an explicit `page` (0-based) wins; else with
 * `interactive` set the shared pickPdfPages dialog asks (single-select; cancelling
 * throws an 'Import cancelled.' error); else the first page imports with a warn - 
 * the pre-existing headless behaviour, kept for non-UI callers.
 */
export async function parsePdfFile(
  file: File | Blob,
  { host, warn = () => {}, page, interactive, map }: {
    host: HostV1; warn?: (msg: string) => void; page?: number; interactive?: boolean; map?: DesignMapOptions;
  } = {} as { host: HostV1; warn?: (msg: string) => void },
) {
  const doc = await loadDoc(file);
  const pageCount = doc.getPageCount();
  if (!pageCount) throw new Error('This PDF has no pages.');

  let pageIndex = Math.min(Math.max(Math.floor(page ?? 0), 0), pageCount - 1);
  if (pageCount > 1 && page == null) {
    if (interactive) {
      const picked = await pickPdfPages(makeHandle(doc), { mode: 'single', fileName: (file as File).name || '' });
      if (!picked?.length) throw new Error('Import cancelled.');
      pageIndex = picked[0]!;
    } else {
      warn(`Imported the first of ${pageCount} pages.`);
    }
  }

  const { boxes, width, height, findings } = await pageToBoxes(doc, pageIndex, host, warn, map, newImportCaches());
  setDesignImportReport(file, findings);
  return { boxes, width, height, background: '#ffffff' };
}

/**
 * What one import remembers across its pages: the stored ref for every vector
 * path (keyed by the SVG it became) and for every image XObject (keyed by the
 * pdf-lib stream object, which pdf-lib hands back by identity for one /XObject
 * ref). A deck puts the same logo and the same colour bar on every page; without
 * this a 28-page import decoded, soft-masked and stored the same picture 28 times.
 */
interface ImportCaches {
  vectors: Map<string, AssetRef>;
  images: Map<PDFRawStream, string>;
}
const newImportCaches = (): ImportCaches => ({ vectors: new Map(), images: new Map() });

/** One page of a document as an editable frame: its boxes in page coordinates. */
export interface PdfPageFrame {
  name: string;
  width: number;
  height: number;
  boxes: unknown[];
  /** This page's own ground where the source declares one (a slide's background). */
  background?: string;
}

/** Pages beyond this are skipped with a warning on a headless (no picker) import -
 *  the page picker's own ceiling, so both routes agree on what "all pages" means. */
export const MAX_PAGE_FRAMES = 60;

/**
 * SEVERAL pages of a PDF/.ai as editable frames - the artboards import. `pages`
 * names the 0-based indices to take; without it an interactive caller gets the
 * shared multi-page picker (every page pre-selected, cancelling throws
 * 'Import cancelled.') and a headless one takes every page up to
 * {@link MAX_PAGE_FRAMES}. Each page runs the SAME interpret → resolve → finalize
 * pass `parsePdfFile` runs on one, so an artboard is exactly what "replace the
 * board" would have imported for that page. A page that fails to interpret is
 * warned about and skipped rather than failing the whole document.
 */
export async function parsePdfPages(
  file: File | Blob,
  { host, warn = () => {}, pages, interactive, map }: {
    host: HostV1; warn?: (msg: string) => void; pages?: number[]; interactive?: boolean; map?: DesignMapOptions;
  },
): Promise<PdfPageFrame[]> {
  const doc = await loadDoc(file);
  const pageCount = doc.getPageCount();
  if (!pageCount) throw new Error('This PDF has no pages.');

  let picked: number[];
  if (Array.isArray(pages) && pages.length) {
    picked = pages.map((p) => Math.floor(p)).filter((p) => p >= 0 && p < pageCount);
  } else if (pageCount > 1 && interactive) {
    const chosen = await pickPdfPages(makeHandle(doc), { mode: 'multi', fileName: (file as File).name || '', intent: 'artboards' });
    if (!chosen?.length) throw new Error('Import cancelled.');
    picked = chosen;
  } else {
    picked = Array.from({ length: Math.min(pageCount, MAX_PAGE_FRAMES) }, (_, i) => i);
    if (pageCount > MAX_PAGE_FRAMES) warn(`This document has ${pageCount} pages - only the first ${MAX_PAGE_FRAMES} were imported.`);
  }

  const frames: PdfPageFrame[] = [];
  const importedPages: number[] = [];
  const findings: DesignImportFinding[] = [];
  setDesignImportReport(file, findings);
  const caches = newImportCaches();
  for (const p of picked) {
    if (picked.length > 1) warn(`Reading page ${p + 1} of ${pageCount}…`);
    try {
      const { boxes, width, height, findings: pageFindings } = await pageToBoxes(doc, p, host, warn, map, caches);
      findings.push(...pageFindings);
      importedPages.push(p);
      frames.push({ name: `Page ${p + 1}`, width, height, boxes });
    } catch (err) {
      warn(`Skipped page ${p + 1} (${msg(err)}).`);
      findings.push({page:p,kind:'review',message:`This page could not be imported: ${msg(err)}`});
    }
  }
  if (!frames.length) throw new Error('Couldn’t find any importable artwork in that document.');
  setRulesSourcePages(file, importedPages);
  return frames;
}

/**
 * One page → Design boxes: interpret the content stream, resolve every placeholder
 * (vector paths and image XObjects) to a stored asset, then finalize. Shared by the
 * single-page and the per-page (artboards) imports so the two cannot drift.
 */
async function pageToBoxes(
  doc: PDFDocument, pageIndex: number, host: HostV1, warn: (msg: string) => void, map: DesignMapOptions | undefined, caches: ImportCaches,
): Promise<{ boxes: unknown[]; width: number; height: number; findings: DesignImportFinding[] }> {
  // Diagnostics are collected, not forwarded: one line per approximated paint would
  // be dozens of toasts. Summarised below, and only for the genuinely lossy rungs -
  // a tiling pattern that collapsed to its inner paint lost nothing.
  const diagnostics: string[] = [];
  const { nodes, width, height, imageStreams, tiles } = interpretPage(doc, pageIndex, (m) => diagnostics.push(m));
  if (!nodes.length) throw new Error('Couldn’t find any importable artwork on that page.');
  const lossy = diagnostics.filter((m) => !/^(pattern\.tiling\.collapsed|shading\.type1\.(flat|axialised))\b/.test(m)).length;
  if (lossy) warn(`Approximated ${lossy} fill${lossy === 1 ? '' : 's'} that couldn’t be reproduced exactly.`);

  const images = new Map<string, string>();
  const notices: PdfDesignNotice[] = [];
  let tileBudget = TILE_BYTE_BUDGET;
  const drawable = await pdfDesignNodes(nodes, {
    width, height, notice: notice => notices.push(notice),
    image: async key => {
      if (images.has(key)) return images.get(key);
      const desc = imageStreams.get(key);
      let uri = desc ? caches.images.get(desc.stream) : undefined;
      if (!uri && desc) {
        const decoded = await imageBytes(desc, message => {warn(message);notices.push({kind:'review',message});});
        if (decoded) {uri = `data:${decoded.mime};base64,${bytesToBase64(decoded.bytes)}`;caches.images.set(desc.stream, uri);}
      }
      if (!uri && tiles.has(key)) {
        if (tileBudget <= 0) throw new Error('This page has too many complex fills. Simplify it in the source editor before importing.');
        uri = rasterizeTile(tiles.get(key)!, tileSize(Math.max(width, height))) || undefined;
        tileBudget -= uri?.length || 0;
      }
      if (uri) images.set(key, uri);
      return uri;
    },
    store: async svg => {
      const cached = caches.vectors.get(svg); if (cached) return cached;
      const ref = await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], new File([svg], 'pdf-artwork.svg', {type:'image/svg+xml'}), {batch:true});
      caches.vectors.set(svg, ref); return ref;
    },
  });
  const boxes = finalizeBoxes(drawable, {prefix:'p', ...map});
  for (const [i, box] of boxes.entries()) {
    const node = drawable[i]!;
    Object.assign(box, {name:node.name, x:node.x, y:node.y, w:node.w, h:node.h});
    if (node.kind === 'text') box.fontSize = Number(node.fontSize);
  }
  const fixed = notices.filter(n => n.kind === 'fixed').length;
  if (fixed) warn(`${fixed} clipped or styled objects were kept as images to preserve their appearance.`);
  for (const notice of notices.filter(n => n.kind === 'review')) warn(`${notice.object || 'Page'}: ${notice.message}`);
  const findings: DesignImportFinding[] = notices.map(n => ({...n,page:pageIndex}));
  if (lossy) findings.push({page:pageIndex,kind:'review',message:'Some colours or effects were approximated. Compare this page with the original before sharing.'});
  if (!boxes.length) throw new Error('Couldn’t find any importable artwork on that page.');
  return {boxes, width:Math.max(1, Math.round(width)), height:Math.max(1, Math.round(height)), findings};
}

// ── pdf-lib access helpers ─────────────────────────────────────────────────────
// The generic object walkers (dictOf/getKey/numOf/…) and the whole function →
// shading → pattern decoder live in lib/pdf-objects.ts: pure pdf-lib work with
// no DOM, so it can be unit-tested against real in-memory PDF dictionaries. The
// resource walk, fonts and image decode live in node-shell's pdf-read.ts. This
// module keeps only what needs the browser or this view's own modules.

function msg(err: unknown): string { return String((err && (err as Error).message) || err); }

// ── resource extraction ─────────────────────────────────────────────────────

/**
 * The walk for one page: node-shell's resource walk (fonts, XObjects, ExtGState
 * alpha, optional content) with this view's three decoders plugged in. The
 * shading and pattern decoders get a `ShadingCtx` whose `resources` recurses
 * through the same walk, so a tiling pattern's own fonts and images register in
 * the page's `imageStreams` exactly as before. `maskIds` is the soft-mask
 * identity registry: /G object → ordinal, and mask variant → engine-facing id.
 */
function makeExtractCtx(ctx: PDFContext, imageStreams: Map<string, ImageDesc>, tiles: Map<string, TileSource>, warn: (m: string) => void): PdfWalk {
  const maskIds: SoftMaskIdRegistry = { groups: new Map(), ids: new Map() };
  const sc: ShadingCtx = { ctx, tiles, warn, resources: (d: Ref, depth: number) => walk.resources(d, depth) };
  const walk = makePdfWalk(ctx, imageStreams, warn, {
    softMask: (ec, sm, depth) => buildSoftMask(ec, maskIds, sm, depth),
    shading: (_ec, ref) => buildShading(sc, ref),
    pattern: (_ec, ref, depth) => buildPattern(sc, ref, depth),
    fontMetrics: pdfFontMetrics,
  });
  return walk;
}

/**
 * Pre-decode an ExtGState /SMask into a `PdfSoftMaskDef` - PDF 32000-1 section 11.6.5.2.
 *
 * The whole point of this function is the shell/engine split: the mask group /G is a
 * form XObject, so all the shell has to do is decode its stream, pull its /Matrix and
 * /BBox, and extract its resources through the SAME recursive walker every other form
 * uses. That registers the mask's own image XObjects in `ec.imageStreams`, so a
 * blurred-shadow JPEG resolves through the existing DCTDecode pass-through (no decode,
 * no re-encode) with zero new byte code. The engine then runs the content stream with
 * its ordinary interpreter and emits an SVG `<mask>` - it never learns that a mask is
 * usually a raster.
 *
 * Returns `true` (never `false`) on any decode failure: `false` means "no mask", which
 * would make the interpreter paint the unmasked shadow ink as a hard grey plate.
 */
function buildSoftMask(ec: PdfWalk, maskIds: SoftMaskIdRegistry, smRef: Ref, depth: number): PdfSoftMaskDef | true {
  const ctx = ec.ctx;
  // A mask group's resources can name further masks. The resource walk's own depth cap
  // terminates that, but a full resource walk per level is expensive for something
  // the engine refuses past one level of nesting anyway - so stop early and cheaply.
  if (depth > 4) return true;
  try {
    const gRef = getKey(ctx, smRef, 'G');
    const g = ctx.lookup(gRef as PDFObject | undefined);
    if (!g) return true;
    const content = decodedText(ctx, gRef);
    if (content == null) return true;

    // Table 144's five keys are /Type, /S, /G, /BC and /TR - all five are read here or
    // are inert (/Type). The two that can silently change the mask's meaning are
    // resolved BEFORE the id is minted, because they are part of its identity.
    const subtype: 'Luminosity' | 'Alpha' = nameOf(ctx, getKey(ctx, smRef, 'S')) === 'Alpha' ? 'Alpha' : 'Luminosity';
    // /TR: a transfer function over the mask values. /Identity is the no-op; anything
    // else (incl. a function stream, where nameOf yields null) is unrepresentable in
    // an SVG <mask>, so the engine refuses the group rather than use a wrong curve.
    const tr = getKey(ctx, smRef, 'TR');
    const transfer = !!tr && nameOf(ctx, tr) !== 'Identity';
    // /BC: the backdrop colour the group is composited against, expressed in the
    // GROUP's colour space (section 11.6.5.2) and in force everywhere outside the /BBox.
    // Only a BLACK backdrop (luminosity 0, which is also the default when /BC is
    // absent) is expressible: any brighter backdrop reveals content out to infinity
    // and a userSpaceOnUse <mask> region cannot say that, so the engine refuses.
    //
    // The colour space is not optional context - it decides the sign. `[0 0 0 0]` is
    // BLACK in DeviceRGB but WHITE in DeviceCMYK, and reading the latter as black is
    // the unsafe failure: it hides live artwork outside a bbox instead of revealing
    // it. Illustrator/InDesign print PDFs are exactly where CMYK group spaces occur.
    // Unconvertible space (absent /CS, /Separation, /DeviceN, /Indexed…) → report a
    // white backdrop, i.e. refuse: dropping the mask can only leave content visible.
    //
    // Per Table 144 /BC "shall be consulted only if the subtype S is Luminosity"; an
    // /Alpha mask ignores it entirely rather than being refused because of it.
    let backdrop: number | undefined;
    if (subtype === 'Luminosity') {
      const bc = numArray(ctx, getKey(ctx, smRef, 'BC'));
      if (bc && bc.length) {
        const lum = backdropLuminosity(groupColorSpace(ctx, gRef), bc);
        if (lum == null) ec.warn('smask.bc.unconvertible');
        backdrop = lum ?? 1;
      }
    }

    // One id per DISTINCT mask, where "distinct" means the /G group AND every /SMask
    // key that changes how it is interpreted - keying on /G alone let two dicts sharing
    // one blur group collide.
    const def: PdfSoftMaskDef = {
      id: softMaskId(maskIds, g as object, subtype, transfer, backdrop),
      subtype,
      content,
      resources: ec.resources(getKey(ctx, gRef, 'Resources'), depth + 1),
    };
    const bbox = numArray(ctx, getKey(ctx, gRef, 'BBox'));
    if (bbox && bbox.length >= 4) def.bbox = bbox;
    const matrix = numArray(ctx, getKey(ctx, gRef, 'Matrix'));
    if (matrix && matrix.length >= 6) def.matrix = matrix;
    if (transfer) def.transfer = true;
    if (backdrop !== undefined) def.backdrop = backdrop;
    // DELIBERATE, recorded: the group's /Group /K (knockout) is not read. Knockout only
    // changes the result where objects INSIDE the mask group overlap with transparency,
    // and the interpreter's painter model already approximates that everywhere else;
    // refusing every knockout group would cost more fidelity than it buys. /Group /I
    // (isolated) needs no handling - section 11.6.5.2 composites a luminosity group against
    // /BC alone, which is isolated behaviour by definition.
    return def;
  } catch { return true; }
}

// ── image resolution ──────────────────────────────────────────────────────────

/** Decode displayable bytes into pixels via the browser's own decoders. */
async function decodeToImageData(bytes: Uint8Array, mime: string): Promise<ImageData | null> {
  try {
    const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }));
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d')!;
    g.drawImage(bmp, 0, 0);
    return g.getImageData(0, 0, bmp.width, bmp.height);
  } catch {
    return null;
  }
}

/** RGBA pixels to a PNG through a canvas. */
async function canvasPng(pixels: PdfPixels): Promise<Uint8Array | null> {
  const canvas = document.createElement('canvas');
  canvas.width = pixels.width; canvas.height = pixels.height;
  const img = pixels instanceof ImageData ? pixels : new ImageData(pixels.data as Uint8ClampedArray<ArrayBuffer>, pixels.width, pixels.height);
  canvas.getContext('2d')!.putImageData(img, 0, 0);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

/** The browser's codec for node-shell's image decode: canvas in, canvas out. */
const CANVAS_CODEC: PdfImageCodec = { encodePng: canvasPng, decode: decodeToImageData };

/**
 * This view's pixel work and resource decoders for another reader of the same page
 * walk: the Rebrand ingest reads a PDF deck with them (`sourceDeckFromPdf`), so its
 * pictures, soft masks, shadings and patterns come out as they do here. A function
 * based shading keeps its flat colour there, since no tile is rasterised for it.
 */
export function rebrandPdfReaders(): { codec: PdfImageCodec; decoders: PdfResourceDecoders } {
  const maskIds: SoftMaskIdRegistry = { groups: new Map(), ids: new Map() };
  const tiles = new Map<string, TileSource>();
  const shadingCtx = (walk: PdfWalk): ShadingCtx => ({ ctx: walk.ctx, tiles, warn: walk.warn, resources: (d: Ref, depth: number) => walk.resources(d, depth) });
  return {
    codec: CANVAS_CODEC,
    decoders: {
      softMask: (walk, sm, depth) => buildSoftMask(walk, maskIds, sm, depth),
      shading: (walk, ref) => buildShading(shadingCtx(walk), ref),
      pattern: (walk, ref, depth) => buildPattern(shadingCtx(walk), ref, depth),
      fontMetrics: pdfFontMetrics,
    },
  };
}

/** This view's wording for an image the decode could not carry faithfully. */
function imageIssueText(issue: PdfImageIssue): string {
  switch (issue.code) {
    case 'unsupported-encoding': return `Skipped an embedded image in an unsupported encoding (${issue.filter}).`;
    case 'smask-undecodable': return 'Kept an embedded image opaque (its soft mask was undecodable).';
    default: return `Couldn’t import an embedded image (${issue.message}).`;
  }
}

/** Decode a raster XObject to browser-displayable bytes (shared by the boxes path,
 *  which stores them as an asset, and the page-SVG path, which inlines a data: URI). */
function imageBytes(desc: ImageDesc, warn: (msg: string) => void): Promise<{ bytes: Uint8Array; mime: string; ext: string } | null> {
  return decodePdfImage(desc, CANVAS_CODEC, (issue) => warn(imageIssueText(issue)));
}

// ── whole pages as SVG (the asset-upload surface) ──────────────────────────────

/** One page rendered to a standalone SVG document (images inlined as data: URIs). */
export interface PdfPageSvg {
  svg: string;
  width: number;
  height: number;
  /** Drawable nodes the interpreter found - 0 means a blank/unimportable page.
   *  PRE-cull, deliberately: this is the "was the print blank?" signal. */
  elementCount: number;
  /** Crop-cull counters, present only when `cull` was given. */
  culled?: { total: number; dropped: number; unbounded: number };
}

export interface PdfPageSvgOpts {
  warn?: (msg: string) => void;
  /** Namespace for generated <defs> ids - see PdfSvgOptions.idPrefix. Callers
   *  emitting several SVGs bound for one canvas MUST vary this. */
  idPrefix?: string;
  /** Crop hint in the page's own (point) space: nodes that provably cannot paint
   *  inside it are dropped before raster decode / tile raster / text outlining. */
  cull?: CullWindow;
  /**
   * Override an image node's payload. Called once per drawable image node with
   * its geometry in the page's own (point) space and the decoded fallback data:
   * URI (null when the XObject couldn't be decoded); return a data: URI to
   * substitute, or null to keep the fallback. Lets a caller re-source rasters it
   * knows better than the PDF's re-encode - the docs-screenshot pipeline swaps
   * the app's ORIGINAL webp/canvas pixels back in (lib/pdf-vector-shot.ts).
   */
  resolveImage?: (rect: { x: number; y: number; w: number; h: number }, fallback: string | null) => string | null;
  /**
   * Outline a text run's glyphs to SVG path `d` strings, one per line (baseline
   * at y=0, pen at x=0). Return null to keep the font-dependent `<text>` (an
   * uncovered glyph, an unresolved font). Lets a caller that can shape text
   * (HarfBuzz) make the SVG self-contained - the docs-screenshot pipeline outlines
   * every run so a shot needs no fonts at render time (lib/pdf-vector-shot.ts).
   */
  outlineText?: (run: { text: string; fontFamily: string; fontWeight: string | number; fontSize: number }) => Promise<string[] | null>;
  /**
   * Rasterise irreducibly-2-D function-based shadings (an OKLCH hue wheel, a
   * conic gradient) into small `<pattern>` tiles. Default true.
   *
   * Set false when a raster in the middle of otherwise-vector output is worse than
   * an approximation - every tile shading then paints its area-weighted MEAN colour
   * instead, with zero extra branching. The Design boxes path never reaches
   * here at all (it consumes nodes directly), so this only governs the page-SVG
   * surfaces: asset upload and the docs-screenshot pipeline.
   */
  rasterFallback?: boolean;
  /**
   * Hoist byte-identical `<path>` elements into `<defs>` + `<use>` - see
   * PdfSvgOptions.dedupePaths for what it collapses and why the copies exist.
   *
   * Default false, and it must stay false for asset ingest: an ingested page is
   * stored as a user SVG asset that can be placed on a canvas and exported to
   * EMF/EPS/DXF, and `svg-ir.ts` skips `<use>` outright, so hoisted ink would
   * silently disappear from those formats. Only the docs-screenshot pipeline
   * (lib/pdf-vector-shot.ts) sets it, because a shot is terminal output.
   */
  dedupePaths?: boolean;
}

// ── embedded font programs ────────────────────────────────────────────────────

/** Which /FontFile* key holds the program, and what the bytes therefore are. */
const FONT_FILE_KEYS = [
  { key: 'FontFile', ext: 'pfb' as const },   // Type1
  { key: 'FontFile2', ext: 'ttf' as const },  // TrueType
  { key: 'FontFile3', ext: 'cff' as const },  // CFF - /Subtype refines this below
];

/**
 * Pull every embedded font program out of a document.
 *
 * Enumerating indirect objects (rather than crawling page resources) is
 * deliberate: a /FontDescriptor is reachable from pages, form XObjects,
 * annotation appearance streams, Type3 CharProcs resources and pattern
 * resources, and a resource crawl that misses one silently under-reports.
 *
 * Deduped by the font program's own object ref - the same face referenced from
 * forty pages is one font, and listing it forty times would be noise.
 */
function collectEmbeddedFonts(doc: PDFDocument): EmbeddedFont[] {
  const ctx = doc.context;
  const out: EmbeddedFont[] = [];
  const seen = new Set<string>();

  let entries: [unknown, PDFObject][] = [];
  try { entries = ctx.enumerateIndirectObjects() as unknown as [unknown, PDFObject][]; } catch { return out; }

  for (const [, obj] of entries) {
    const d = obj instanceof PDFDict ? obj : null;
    if (!d) continue;
    // A FontDescriptor is identifiable by /Type, but plenty of writers omit it - 
    // holding a /FontFile* key is the reliable signal.
    for (const { key, ext } of FONT_FILE_KEYS) {
      const ref = d.get(PDFName.of(key));
      if (!ref) continue;
      const tag = ref instanceof PDFRef ? ref.tag : '';
      if (tag && seen.has(tag)) continue;
      if (tag) seen.add(tag);

      let stream: PDFObject | undefined;
      try { stream = ctx.lookup(ref); } catch { continue; }
      if (!(stream instanceof PDFRawStream)) continue;

      let bytes: Uint8Array;
      try { bytes = decodePDFRawStream(stream).decode(); } catch { continue; }
      if (!bytes.length) continue;

      const name = nameOf(ctx, d.get(PDFName.of('FontName'))) || '(unnamed font)';
      // /FontFile3 covers three different things; its /Subtype says which, and
      // only /OpenType is a complete, installable file.
      const sub = nameOf(ctx, stream.dict.get(PDFName.of('Subtype'))) || '';
      const realExt = key === 'FontFile3' ? (sub === 'OpenType' ? 'otf' : 'cff') : ext;

      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const embedding = readFontEmbedding(buf);

      out.push({
        name,
        family: name.replace(/^[A-Z]{6}\+/, ''),
        ext: realExt,
        bytes,
        // The "ABCDEF+" prefix is the PDF spec's own subset marker (section 9.6.4).
        subset: /^[A-Z]{6}\+/.test(name),
        // A bare CFF or a Type1 PFB fragment is a font PROGRAM, not a font FILE:
        // no system will install it without being wrapped in an sfnt container.
        installable: realExt === 'ttf' || realExt === 'otf',
        embedding,
      });
    }
  }
  out.sort((a, b) => a.family.localeCompare(b.family));
  return out;
}

// ── vector artwork ────────────────────────────────────────────────────────────

/**
 * Extract each mark on one page as its own SVG: node-shell's `pdfVectorsOnPage`
 * over this page's nodes, drawn through pageToSvg + windowPdfSvg rather than a
 * bespoke serialiser, so a mark inherits every fidelity the page path already has
 * (gradients, clip paths, soft masks, inlined rasters and outlined text). The crop
 * is applied there and not later: storeUserUpload's normaliser strips the root
 * width/height, after which windowPdfSvg's regex no longer matches and it returns
 * the input unchanged, shipping the whole page with the mark lost in the middle.
 * Each mark gets its own `idPrefix`, because stored SVG assets are inlined as
 * nested `<svg>` on export, where ids do NOT scope.
 */
async function vectorsOnPage(
  handle: PdfHandle, doc: PDFDocument, pageIndex: number, idBase: number,
): Promise<ExtractedVector[]> {
  return pdfVectorsOnPage(interpretPage(doc, pageIndex), pageIndex, idBase,
    async (cull, idPrefix) => (await handle.pageToSvg(pageIndex, { cull, idPrefix })).svg);
}

// ── embedded rasters ──────────────────────────────────────────────────────────

/** One image XObject, decoded to bytes a browser can show and save. */
export interface EmbeddedImage {
  bytes: Uint8Array;
  mime: string;
  /** Stored pixel dimensions - NOT the size it is drawn at on the page. */
  width: number;
  height: number;
  colorSpace: string | null;
  /** 0-based page it was first reached from. */
  page: number;
  /** A meaningful name when the source has one (a PSD/XCF layer name); absent for
   *  a PDF raster, which has only its stored resolution to go by. */
  name?: string;
}

export interface EmbeddedImageScan {
  images: EmbeddedImage[];
  /** Image XObjects found but not decodable here (JPX, CCITT, JBIG2, …). */
  skipped: number;
  skippedFilters: string[];
}

/**
 * Every raster the document embeds, at its STORED resolution.
 *
 * Stored resolution, not display size, is the honest thing to hand back: a logo
 * placed at 20mm may be a 4000px original, and someone extracting assets wants
 * the original. Deduped by stream, so a header image repeated on every page is
 * one image.
 */
async function collectEmbeddedImages(doc: PDFDocument, max: number): Promise<EmbeddedImageScan> {
  const ctx = doc.context;
  const images: EmbeddedImage[] = [];
  const skippedFilters = new Set<string>();
  let skipped = 0;
  const seen = new Set<PDFRawStream>();
  const pageCount = doc.getPageCount();

  for (let p = 0; p < pageCount && images.length < max; p++) {
    const streams = new Map<string, ImageDesc>();
    try {
      const node = doc.getPage(p).node;
      makeExtractCtx(ctx, streams, new Map(), () => {}).resources(getKey(ctx, node, 'Resources'), 0);
    } catch { continue; }  // a malformed page's resources - keep scanning the rest
    for (const desc of streams.values()) {
      if (images.length >= max) break;
      if (seen.has(desc.stream)) continue;
      seen.add(desc.stream);
      const got = await imageBytes(desc, () => {});
      if (got) images.push({ bytes: got.bytes, mime: got.mime, width: desc.width, height: desc.height, colorSpace: desc.colorSpace, page: p });
      else { skipped++; skippedFilters.add(desc.filter[desc.filter.length - 1] || 'raw'); }
    }
  }
  return { images, skipped, skippedFilters: [...skippedFilters] };
}

// ── attachments ───────────────────────────────────────────────────────────────

/** A file riding inside the PDF - the payload half of the structural scan. */
export interface EmbeddedAttachment {
  name: string;
  bytes: Uint8Array;
  /** Best-effort media type from /Subtype, else sniffed from the extension. */
  mime: string;
}

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', svg: 'image/svg+xml', txt: 'text/plain', csv: 'text/csv',
  json: 'application/json', xml: 'application/xml', zip: 'application/zip',
};

/**
 * Pull out the files a document carries.
 *
 * `bridge/pdf-structure.ts` REPORTS these as a finding ("this PDF carries a
 * payload"); this hands over the actual bytes so a reader can look at what it
 * is. Same three places in the graph - the /EmbeddedFiles name tree, /AF
 * associated files, and /FileAttachment annotations - because a document that
 * hides something rarely puts it in the obvious one.
 */
function collectAttachments(doc: PDFDocument): EmbeddedAttachment[] {
  const ctx = doc.context;
  const out: EmbeddedAttachment[] = [];
  const seen = new Set<string>();

  const takeSpec = (spec: Ref, fallback = ''): void => {
    const d = dictOf(ctx, spec);
    if (!d) return;
    const name = strOfPdf(ctx, d.get(PDFName.of('UF'))) || strOfPdf(ctx, d.get(PDFName.of('F'))) || fallback;
    const ef = dictOf(ctx, d.get(PDFName.of('EF')));
    const ref = ef ? (ef.get(PDFName.of('UF')) ?? ef.get(PDFName.of('F'))) : undefined;
    if (!ref) return;                       // an external LINK, not a payload
    const tag = ref instanceof PDFRef ? ref.tag : '';
    if (tag && seen.has(tag)) return;
    if (tag) seen.add(tag);

    let stream: PDFObject | undefined;
    try { stream = ctx.lookup(ref); } catch { return; }
    if (!(stream instanceof PDFRawStream)) return;
    let bytes: Uint8Array;
    try { bytes = decodePDFRawStream(stream).decode(); } catch { return; }

    const declared = nameOf(ctx, stream.dict.get(PDFName.of('Subtype')))?.replace(/#2F/gi, '/') ?? '';
    const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
    out.push({
      name: name || '(unnamed attachment)',
      bytes,
      mime: declared.includes('/') ? declared : (EXT_MIME[ext] ?? 'application/octet-stream'),
    });
  };

  // 1. The /Names → /EmbeddedFiles tree (with /Kids interior nodes).
  const walk = (node: Ref, depth: number): void => {
    if (depth > 32) return;
    const d = dictOf(ctx, node);
    if (!d) return;
    const names = ctx.lookup(d.get(PDFName.of('Names')));
    if (names instanceof PDFArray) {
      const arr = names.asArray();
      for (let i = 0; i + 1 < arr.length; i += 2) takeSpec(arr[i + 1], strOfPdf(ctx, arr[i]) ?? '');
    }
    const kids = ctx.lookup(d.get(PDFName.of('Kids')));
    if (kids instanceof PDFArray) for (const k of kids.asArray()) walk(k, depth + 1);
  };
  walk(getKey(ctx, doc.catalog.get(PDFName.of('Names')), 'EmbeddedFiles'), 0);

  // 2. /AF associated files, on the catalog and on every page.
  const afRoots: Ref[] = [doc.catalog.get(PDFName.of('AF'))];
  try { for (const p of doc.getPages()) afRoots.push((p.node as unknown as PDFDict).get(PDFName.of('AF'))); } catch { /* malformed pages */ }
  for (const root of afRoots) {
    const arr = ctx.lookup(root as PDFObject | undefined);
    if (arr instanceof PDFArray) for (const spec of arr.asArray()) takeSpec(spec);
  }

  // 3. /FileAttachment annotations.
  try {
    for (const p of doc.getPages()) {
      const annots = ctx.lookup((p.node as unknown as PDFDict).get(PDFName.of('Annots')));
      if (!(annots instanceof PDFArray)) continue;
      for (const a of annots.asArray()) {
        if (nameOf(ctx, getKey(ctx, a, 'Subtype')) !== 'FileAttachment') continue;
        takeSpec(getKey(ctx, a, 'FS'));
      }
    }
  } catch { /* malformed annots */ }

  return out;
}

/** A PDF text string → its text. Named apart from the shading helpers' `nameOf`. */
function strOfPdf(ctx: PDFContext, o: Ref): string | null {
  const v = ctx.lookup(o as PDFObject | undefined);
  const s = v as unknown as { decodeText?: () => string };
  if (v && typeof s.decodeText === 'function') { try { return s.decodeText(); } catch { return null; } }
  return null;
}

/** An embedded font PROGRAM lifted out of a document, with its own caveats. */
export interface EmbeddedFont {
  /** /FontName, subset prefix and all - "ABCDEF+Inter-Regular". */
  name: string;
  /** The family with any "ABCDEF+" subset prefix removed. */
  family: string;
  /** File extension the bytes actually are. `cff`/`pfb` come only from PDFs (raw
   *  font programs); `woff`/`woff2` only from an SVG @font-face's embedded source. */
  ext: 'ttf' | 'otf' | 'cff' | 'pfb' | 'woff' | 'woff2';
  bytes: Uint8Array;
  /**
   * The document embeds only the glyphs it used. A subset font renders the
   * document it came from and little else - reusing it elsewhere silently drops
   * every character the original never printed, which is the single most
   * important thing to tell someone about to download it.
   */
  subset: boolean;
  /** Whether the bytes are a font a system can actually install. */
  installable: boolean;
  /** The font's own OS/2 fsType statement, when it has one. */
  embedding: FontEmbeddingInfo;
}

/** An opened document: page count + cached page→SVG / page→text converters. */
export interface PdfHandle {
  pageCount: number;
  pageToSvg(index: number, opts?: PdfPageSvgOpts): Promise<PdfPageSvg>;
  /**
   * Reconstruct a page's prose from the SAME interpreted nodes the SVG path
   * uses. No second parse and no OCR: for a born-digital PDF the glyphs and
   * their positions are already in the file, and `extractPageText` puts them
   * back into reading order. A page that is a scanned image comes back with
   * `scanned: true` and no text, which callers must surface as such.
   *
   * OPTIONAL, and callers must feature-detect it. A .pptx deck borrows this
   * interface to reuse the page picker (views/pptx-import.ts) but has no PDF
   * node graph behind it, so it simply does not offer the method - which is the
   * truthful answer, rather than a stub returning empty text that would read as
   * "this deck has no words in it".
   */
  pageToText?(index: number, warn?: (msg: string) => void): PageText;
  /**
   * Find text the page paints an opaque shape over - the failed-redaction check
   * (engine/src/pdf-redaction.ts). Runs on the same interpreted nodes as
   * everything else, so it is nearly free once a page has been read.
   *
   * `maxPages` bounds the walk for callers that must stay responsive on a large
   * document; the returned `scanned` count says how far it actually got, so a
   * caller can say "the first N pages" rather than implying the whole file was
   * checked. Optional for the same reason as `pageToText`.
   */
  findHiddenText?(opts?: { maxPages?: number; minCoverage?: number }): { findings: HiddenTextFinding[]; scanned: number };
  /**
   * Every font PROGRAM the document embeds, deduped.
   *
   * Walks the object graph rather than the page resources: a font can be reached
   * through any page, any nested form XObject, any annotation appearance stream,
   * and enumerating indirect objects finds all of them without a recursive
   * resource crawl that could still miss one.
   */
  listFonts?(): EmbeddedFont[];
  /** Every raster the document embeds, at its STORED resolution. */
  listImages?(opts?: { max?: number }): Promise<EmbeddedImageScan>;
  /**
   * Vector artwork (logos, icons, marks) as standalone SVG, cropped to itself.
   *
   * Most logos in a PDF are vector, not raster - a group of paths - so this is
   * the asset most worth recovering, and the only one that stays useful at any
   * size.
   */
  listVectors?(opts?: { maxPages?: number }): Promise<ExtractedVector[]>;
  /** Every file the document carries, with its bytes. */
  listAttachments?(): EmbeddedAttachment[];
  /**
   * The distinct colours the container paints with, as hex strings. Additive and
   * feature-detected: the PDF interpreter does not implement it (an SVG opener is
   * the first that does), so a caller must guard the call and treat its absence as
   * "no palette pass here", never as "this file has no colours".
   */
  listPalette?(): string[];
}

function makeHandle(doc: PDFDocument): PdfHandle {
  const cache = new Map<string, PdfPageSvg>();
  const textCache = new Map<number, PageText>();
  return {
    pageCount: doc.getPageCount(),
    pageToText(index: number, warn: (msg: string) => void = () => {}): PageText {
      const hit = textCache.get(index);
      if (hit) return hit;
      const { nodes, width, height } = interpretPage(doc, index, warn);
      // A tagged document states its reading order; [] means untagged, and
      // extractPageText falls back to geometry on its own.
      let tagged: TaggedElement[] = [];
      try { tagged = readPdfStructOrder(doc, index); }
      catch (err) { warn(`struct-tree walk failed (${(err as Error)?.message})`); }
      const out = extractPageText(nodes, { width, height, tagged });
      textCache.set(index, out);
      return out;
    },
    listFonts(): EmbeddedFont[] {
      return collectEmbeddedFonts(doc);
    },
    listImages({ max = 200 }: { max?: number } = {}): Promise<EmbeddedImageScan> {
      return collectEmbeddedImages(doc, max);
    },
    async listVectors({ maxPages }: { maxPages?: number } = {}): Promise<ExtractedVector[]> {
      const total = doc.getPageCount();
      const pages = Math.max(0, Math.min(total, maxPages ?? total));
      const out: ExtractedVector[] = [];
      // A deck repeats its logo on every page. Listed once: a repeat is the same
      // asset, and with PDF_MAX_VECTORS marks in the whole document, twenty-eight copies
      // of one logo would crowd out the diagram on page 15. The key is the mark's
      // own geometry + shape count + palette; the SVG text differs per mark (ids).
      const seen = new Set<string>();
      for (let p = 0; p < pages && out.length < PDF_MAX_VECTORS; p++) {
        try {
          for (const v of await vectorsOnPage(this as PdfHandle, doc, p, out.length)) {
            const key = `${v.width}x${v.height}|${v.shapes}|${v.fills.join(',')}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(v);
            if (out.length >= PDF_MAX_VECTORS) break;
          }
        } catch { /* one bad page must not cost the rest of the document */ }
      }
      return out;
    },
    listAttachments(): EmbeddedAttachment[] {
      return collectAttachments(doc);
    },
    findHiddenText({ maxPages, minCoverage }: { maxPages?: number; minCoverage?: number } = {}):
      { findings: HiddenTextFinding[]; scanned: number } {
      const total = doc.getPageCount();
      const scanned = Math.max(0, Math.min(total, maxPages ?? total));
      const findings: HiddenTextFinding[] = [];
      for (let i = 0; i < scanned; i++) {
        try {
          // Straight from the interpreter and NOT reordered - the check reads
          // "painted after" from array position, so a sorted list would be wrong.
          const { nodes } = interpretPage(doc, i);
          for (const f of engineFindHiddenText(nodes, { minCoverage })) findings.push({ ...f, page: i });
        } catch { /* one unreadable page must not cost the rest of the scan */ }
      }
      return { findings, scanned };
    },
    async pageToSvg(index: number, { warn = () => {}, resolveImage, outlineText, rasterFallback = true, cull, idPrefix, dedupePaths }: PdfPageSvgOpts = {}): Promise<PdfPageSvg> {
      const ckey = `${index}|${cull ? `${cull.x},${cull.y},${cull.width},${cull.height},${cull.pad ?? ''}` : ''}|${idPrefix ?? ''}|${dedupePaths ? 'd' : ''}`;
      const hit = cache.get(ckey);
      if (hit) return hit;
      const { nodes: allNodes, width, height, imageStreams, tiles } = interpretPage(doc, index, warn);
      const culled = cull ? cullPdfNodes(allNodes, cull) : null;
      const nodes = culled ? culled.nodes : allNodes;
      if (culled?.dropped) warn(`cull.dropped ${culled.dropped}/${culled.total} (unbounded kept: ${culled.unbounded})`);
      // A soft mask's own nodes are drawable too - a /Luminosity box-shadow mask IS a
      // blurred greyscale JPEG, and it needs inlining exactly like any page raster (a
      // 1-component DCTDecode stream, so `imageBytes` hands the JPEG straight through:
      // no decode, no canvas, no re-encode). The mask objects are SHARED between the
      // nodes they cover, so this over-enumerates and the `key in images` guard dedupes.
      const maskNodes = nodes.flatMap((n) => n._softMask?.nodes ?? []);
      // Inline every raster XObject the page actually uses, so the SVG is
      // self-contained (and survives storeUserUpload's DOMPurify pass, which
      // allows data:image/png|jpeg hrefs on <image>).
      const images: Record<string, string> = {};
      for (const n of [...nodes, ...maskNodes]) {
        const key = n._imageXObject;
        if (!key || key in images) continue;
        const desc = imageStreams.get(key);
        const got = desc ? await imageBytes(desc, warn) : null;
        if (got) images[key] = `data:${got.mime};base64,${bytesToBase64(got.bytes)}`;
      }
      // Function-based shadings that survived to rung 3 get a raster tile, resolved
      // through the SAME `images` record (and the same data:-URI check) as an image
      // XObject - one sanctioned seam, not two. Lazy and deduped by key: three
      // instances of one hue wheel cost one tile. Every tile a node doesn't get
      // simply paints that node's flat back-stop instead.
      if (rasterFallback && tiles.size) {
        const want = new Map<string, number>();
        // Mask nodes included: a CSS `mask-image: linear-gradient()` arrives as a
        // gradient INSIDE the mask group, and its tileKey must resolve or the mask
        // renders as its flat back-stop.
        for (const n of [...nodes, ...maskNodes]) {
          const k = n._gradient?.tileKey;
          if (!k || !tiles.has(k)) continue;
          want.set(k, Math.max(want.get(k) ?? 0, n.w, n.h));
        }
        let budget = TILE_BYTE_BUDGET;
        for (const [key, dim] of want) {
          if (budget <= 0) { warn('shading.type1.averaged (page tile budget exhausted)'); break; }
          const uri = rasterizeTile(tiles.get(key)!, tileSize(dim));
          if (!uri) { warn('shading.type1.averaged (no canvas / tile render failed)'); continue; }
          budget -= uri.length;
          images[key] = uri;
        }
      }
      // Per-NODE substitution: the same XObject can draw at several geometries,
      // so re-sourcing keys the override by node, leaving other uses untouched.
      // Page nodes ONLY - deliberately not mask nodes: the docs pipeline swaps the
      // app's original screen pixels back in by geometry, and a soft mask's raster has
      // no on-screen counterpart to swap (it is a blur kernel, not a picture).
      if (resolveImage) {
        let i = 0;
        for (const n of nodes) {
          const key = n._imageXObject;
          if (!key) continue;
          const fallback = images[key] ?? null;
          const sub = resolveImage({ x: n.x, y: n.y, w: n.w, h: n.h }, fallback);
          if (sub && sub !== fallback) {
            const nk = `${key}~${i++}`;
            images[nk] = sub;
            n._imageXObject = nk;
          }
        }
      }
      // Outline text runs to real <path>s (self-contained, no font at render
      // time). Un-rotated runs only; a null result keeps the <text> fallback.
      if (outlineText) {
        for (const n of nodes) {
          if (n.kind !== 'text' || !n.text || (n.rot && Math.abs(n.rot) > 0.5)) continue;
          const lines = await outlineText({ text: n.text, fontFamily: n.fontFamily ?? '', fontWeight: n.fontWeight ?? 400, fontSize: n.fontSize ?? 12 });
          if (lines && lines.length) n._outlinePath = lines;
        }
      }
      const out: PdfPageSvg = {
        svg: pdfNodesToSvg(nodes, { width, height, images, ...(idPrefix ? { idPrefix } : {}), ...(dedupePaths ? { dedupePaths } : {}) }),
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
        elementCount: allNodes.length,
        ...(culled ? { culled: { total: culled.total, dropped: culled.dropped, unbounded: culled.unbounded } } : {}),
      };
      cache.set(ckey, out);
      return out;
    },
  };
}

// Total data:-URI bytes one page may spend on shading tiles. A pathological PDF
// full of 2-D shadings must not be able to produce a 50 MB SVG; past the cap the
// remaining shadings paint their mean colour and the page says so.
const TILE_BYTE_BUDGET = 1_000_000;

/** Tile edge for a shading painted at `dim` points: the next power of two, clamped.
 *  Small on purpose - this is a smooth colour field, not detail. */
function tileSize(dim: number): number {
  const n = Math.max(1, Math.ceil(dim || 32));
  return Math.min(192, Math.max(32, 2 ** Math.ceil(Math.log2(n))));
}

/** Rasterise one function-based shading to a PNG data: URI. Returns null where
 *  there is no canvas at all (node/jsdom) - the node's flat back-stop paints. */
function rasterizeTile(src: TileSource, size: number): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const g = canvas.getContext('2d');
    if (!g) return null;
    const img = g.createImageData(size, size);
    img.data.set(renderTilePixels(src, size));
    g.putImageData(img, 0, 0);
    // toDataURL is synchronous on an HTMLCanvasElement - no convertToBlob dance.
    const uri = canvas.toDataURL('image/png');
    return /^data:image\//i.test(uri) ? uri : null;
  } catch { return null; }
}

/** Open a PDF/.ai for page-level conversion (shared by uploads and the page picker). */
export async function openPdfFile(file: File | Blob): Promise<PdfHandle> {
  return makeHandle(await loadDoc(file));
}

// ── raster inspection (the /verify Lolly-Imprint scan) ─────────────────────────

/** The result of decoding a PDF's embedded raster image XObjects for pixel-domain
 *  inspection. `skipped`/`skippedFilters` count the image XObjects present that
 *  this path can't yet turn into pixels - TIFF-predictor Flate (Predictor 2) and
 *  JPXDecode / CCITTFax / JBIG2 - so a caller can report the coverage gap honestly
 *  instead of reading "no hit" as "nothing there". A FlateDecode PNG-
 *  predictor rasters (/Predictor 15) ARE decoded now (via unfilterPng), so Lolly's
 *  own PDF PNG embeds are readable by the Lolly-Imprint scan. */
export interface PdfImageScan {
  /** Image XObjects decoded to browser-readable bytes, native stored resolution. */
  images: Array<{ bytes: Uint8Array; mime: string }>;
  /** How many image XObjects were found but NOT decodable to pixels by this path. */
  skipped: number;
  /** Distinct undecodable filter names seen (for the coverage log). */
  skippedFilters: string[];
}

/**
 * Enumerate + decode a PDF/.ai's raster image XObjects to browser-decodable bytes,
 * for pixel-domain inspection (the Lolly-Imprint check on /verify). Reuses the
 * exact decode `imageBytes` uses: DCTDecode (JPEG) pass-through and Flate
 * RGB/Gray (no predictor OR a PNG predictor, unfiltered via unfilterPng), at
 * each image's NATIVE stored resolution (NO resize, so the watermark's 8×8 grid
 * stays intact). Walks page and nested-form resources, dedupes image streams
 * shared across pages (a logo reused on every slide decodes once), caps the
 * count, and reports what it couldn't decode. Read-only: never touches
 * storeUserUpload. Never throws for a per-image fault: a bad XObject is
 * counted as skipped and the walk continues.
 */
export async function extractPdfImageBytes(
  file: File | Blob,
  { max = 32 }: { max?: number } = {},
): Promise<PdfImageScan> {
  const doc = await loadDoc(file);
  const ctx = doc.context;
  const images: Array<{ bytes: Uint8Array; mime: string }> = [];
  const skippedFilters = new Set<string>();
  let skipped = 0;
  const seen = new Set<PDFRawStream>();
  const pageCount = doc.getPageCount();
  for (let p = 0; p < pageCount && images.length < max; p++) {
    const imageStreams = new Map<string, ImageDesc>();
    try {
      const node = doc.getPage(p).node;
      makeExtractCtx(ctx, imageStreams, new Map(), () => {}).resources(getKey(ctx, node, 'Resources'), 0);
    } catch { continue; } // a malformed page's resources - skip it, keep scanning
    for (const desc of imageStreams.values()) {
      if (images.length >= max) break;
      if (seen.has(desc.stream)) continue;
      seen.add(desc.stream);
      const got = await imageBytes(desc, () => {});
      if (got) images.push({ bytes: got.bytes, mime: got.mime });
      else { skipped++; skippedFilters.add(desc.filter[desc.filter.length - 1] || 'raw'); }
    }
  }
  return { images, skipped, skippedFilters: [...skippedFilters] };
}

function xmlEsc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'));
}

// Previews (and selection) are capped so a 500-page manual can't queue hundreds of
// full-page conversions from one drop; the footer note says what was cut.
const MAX_PICK_PAGES = 60;

/**
 * The shared "which page(s)?" dialog for a multi-page PDF/.ai. Thumbnails are the
 * pages' actual SVG conversions, generated in the background (and cached on the
 * handle, so a later ingest of the picked pages costs nothing extra).
 *
 * mode 'single' (canvas import, picker upload): clicking a page resolves [index].
 * mode 'multi'  (catalog upload): pages toggle, everything starts selected - "all of
 * them" is the one-click default - and the Add button resolves the selection.
 * Cancel / Escape / backdrop resolve null.
 */
export type PickPagesIntent = 'library' | 'artboards' | 'scenes';

/** What the dialog says the pages will become, per intent - the sub line and the
 *  Add button. The library ingest is the default and reads exactly as it always did. */
const PICK_COPY: Record<PickPagesIntent, { sub: string; add: (n: number) => string }> = {
  library: {
    sub: 'Each selected page is added to your library as an SVG.',
    add: (n) => (n === 1 ? 'Add 1 page' : `Add ${n} pages`),
  },
  artboards: {
    sub: 'Each selected page becomes its own artboard, with its parts editable.',
    add: (n) => (n === 1 ? 'Import 1 page as an artboard' : `Import ${n} pages as artboards`),
  },
  scenes: {
    sub: 'Each selected page becomes a timed scene on the timeline.',
    add: (n) => (n === 1 ? 'Add 1 scene' : `Add ${n} scenes`),
  },
};

export function pickPdfPages(
  handle: PdfHandle,
  { mode, fileName = '', intent = 'library' }: { mode: 'single' | 'multi'; fileName?: string; intent?: PickPagesIntent },
): Promise<number[] | null> {
  return new Promise((resolve) => {
    const total = handle.pageCount;
    const shown = Math.min(total, MAX_PICK_PAGES);
    const usable = new Set<number>(Array.from({ length: shown }, (_, i) => i));
    const selected = new Set<number>(mode === 'multi' ? usable : []);
    const copy = PICK_COPY[intent] ?? PICK_COPY.library;

    let trap: FocusTrap | undefined;
    const overlay = document.createElement('div');
    overlay.className = 'pdfpick-overlay';
    overlay.innerHTML = `
      <div class="pdfpick-backdrop" aria-hidden="true"></div>
      <div class="pdfpick-panel" role="dialog" aria-modal="true" aria-label="${mode === 'single' ? 'Choose a page' : 'Choose pages'}">
        <header class="pdfpick-head">
          <span class="pdfpick-title">${mode === 'single' ? 'Choose a page' : 'Choose pages'}${fileName ? ` - ${xmlEsc(fileName)}` : ''}</span>
          <button type="button" class="pdfpick-close" aria-label="Close">&times;</button>
        </header>
        <p class="pdfpick-sub">${mode === 'single' ? 'Pick the page to import.' : copy.sub}</p>
        <div class="pdfpick-grid">
          ${Array.from({ length: shown }, (_, i) => `
            <button type="button" class="pdfpick-page${mode === 'multi' ? ' is-on' : ''}" data-page="${i}" aria-pressed="${mode === 'multi'}">
              <span class="pdfpick-thumb" aria-hidden="true"></span>
              <span class="pdfpick-cap">Page ${i + 1}</span>
            </button>`).join('')}
        </div>
        <footer class="pdfpick-actions">
          <span class="pdfpick-note">${total > shown ? `Showing the first ${shown} of ${total} pages.` : ''}</span>
          ${mode === 'multi' ? '<button type="button" class="pdfpick-btn pdfpick-all"></button>' : ''}
          <button type="button" class="pdfpick-btn pdfpick-cancel">Cancel</button>
          ${mode === 'multi' ? '<button type="button" class="pdfpick-btn pdfpick-btn--primary pdfpick-add"></button>' : ''}
        </footer>
      </div>`;
    document.body.appendChild(overlay);

    const opener = document.activeElement;
    const done = (val: number[] | null): void => {
      trap?.release();
      document.removeEventListener('keydown', onKey);
      NAV_EVENTS.forEach(ev => window.removeEventListener(ev, onNav));
      overlay.remove();
      if (opener instanceof HTMLElement) opener.focus();
      resolve(val);
    };
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); } };
    document.addEventListener('keydown', onKey);
    // A route change cancels the dialog exactly like Escape/backdrop (resolve null) - 
    // the body-mounted overlay must not outlive the view that spawned it, and the
    // trap's inert background must be released (NAV_EVENTS contract, utils.ts).
    const onNav = (): void => done(null);
    NAV_EVENTS.forEach(ev => window.addEventListener(ev, onNav));
    overlay.querySelector('.pdfpick-backdrop')?.addEventListener('click', () => done(null));
    overlay.querySelector('.pdfpick-close')?.addEventListener('click', () => done(null));
    overlay.querySelector('.pdfpick-cancel')?.addEventListener('click', () => done(null));

    const addBtn = overlay.querySelector<HTMLButtonElement>('.pdfpick-add');
    const allBtn = overlay.querySelector<HTMLButtonElement>('.pdfpick-all');
    const sync = (): void => {
      if (addBtn) {
        addBtn.disabled = selected.size === 0;
        addBtn.textContent = copy.add(selected.size);
      }
      if (allBtn) allBtn.textContent = (usable.size > 0 && selected.size === usable.size) ? 'Select none' : 'Select all';
    };
    const paint = (btn: HTMLButtonElement): void => {
      const i = Number(btn.dataset.page);
      btn.classList.toggle('is-on', selected.has(i));
      btn.setAttribute('aria-pressed', String(selected.has(i)));
    };

    overlay.querySelector('.pdfpick-grid')?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.pdfpick-page');
      if (!btn || btn.disabled) return;
      const i = Number(btn.dataset.page);
      if (mode === 'single') { done([i]); return; }
      if (selected.has(i)) selected.delete(i); else selected.add(i);
      paint(btn); sync();
    });
    allBtn?.addEventListener('click', () => {
      const all = selected.size < usable.size;
      selected.clear();
      if (all) for (const i of usable) selected.add(i);
      overlay.querySelectorAll<HTMLButtonElement>('.pdfpick-page').forEach(paint);
      sync();
    });
    addBtn?.addEventListener('click', () => done([...selected].sort((a, b) => a - b)));
    trap = trapFocus(overlay, {
      initialFocus: overlay.querySelector<HTMLElement>(mode === 'multi' ? '.pdfpick-add' : '.pdfpick-page'),
    });
    sync();

    // Thumbnails: convert sequentially in the background; the conversions are cached on
    // the handle so confirming costs nothing extra. A page that fails (or holds no
    // artwork) is disabled and dropped from the selection - it can't become an empty asset.
    void (async () => {
      for (let i = 0; i < shown; i++) {
        if (!overlay.isConnected) return;
        const btn = overlay.querySelector<HTMLButtonElement>(`.pdfpick-page[data-page="${i}"]`);
        const thumb = btn?.querySelector<HTMLElement>('.pdfpick-thumb');
        try {
          const pageSvg = await handle.pageToSvg(i);
          if (!overlay.isConnected) return;
          if (!pageSvg.elementCount) throw new Error('empty page');
          if (thumb) {
            const img = document.createElement('img');
            img.alt = '';
            img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(pageSvg.svg);
            thumb.replaceChildren(img);
          }
        } catch {
          usable.delete(i); selected.delete(i);
          if (btn) { btn.disabled = true; paint(btn); }
          if (thumb) thumb.textContent = 'No artwork';
          sync();
        }
      }
    })();
  });
}

/**
 * Upload-path entry: convert a PDF/.ai into stored SVG user assets.
 *
 * One page → converted directly. Multi-page → the pickPdfPages dialog asks which
 * (mode 'multi' offers all-of-them; 'single' picks one, for the asset-picker where a
 * single slot is being filled). Returns the stored refs - empty when cancelled or
 * nothing converted. Per-page failures warn and continue.
 */
export async function ingestPdfAsSvgAssets(
  host: HostV1,
  file: File | Blob,
  { mode = 'multi', warn = () => {}, intent = 'library' }: { mode?: 'single' | 'multi'; warn?: (msg: string) => void; intent?: PickPagesIntent } = {},
): Promise<AssetRef[]> {
  const name = (file as File).name || 'document.pdf';
  const handle = await openPdfFile(file);
  if (!handle.pageCount) throw new Error('This PDF has no pages.');

  let pages: number[];
  if (handle.pageCount === 1) {
    pages = [0];
  } else {
    const picked = await pickPdfPages(handle, { mode, fileName: name, intent });
    if (!picked?.length) return [];
    pages = picked;
  }

  const base = name.replace(/\.(pdf|ai)$/i, '').trim() || 'page';
  const refs: AssetRef[] = [];
  for (const p of pages) {
    try {
      const pageSvg = await handle.pageToSvg(p, { warn });
      if (!pageSvg.elementCount) { warn(`Page ${p + 1} has no importable artwork - skipped.`); continue; }
      const svgName = handle.pageCount === 1 ? `${base}.svg` : `${base} - page ${p + 1}.svg`;
      const svgFile = new File([pageSvg.svg], svgName, { type: 'image/svg+xml' });
      refs.push(await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], svgFile));
    } catch (err) {
      warn(`Couldn’t convert page ${p + 1} (${msg(err)}).`);
    }
  }
  if (!refs.length && handle.pageCount === 1) throw new Error('Couldn’t find any importable artwork in this PDF.');
  return refs;
}
