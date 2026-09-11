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
// where the browser can (JPEG directly; Flate RGB/Gray via canvas) and otherwise degrade
// to a neutral box rather than being dropped.

import {
  PDFDocument, PDFName, PDFDict, PDFArray, PDFNumber, PDFRef, PDFRawStream, decodePDFRawStream,
} from 'pdf-lib';
import type { PDFContext, PDFObject } from 'pdf-lib';
import {
  interpretPdfPage, parseToUnicode, toUnicodeDecoder, finalizeBoxes, safeColor, pdfNodesToSvg,
  unfilterPng, isShadowPlate, cullPdfNodes, extractPageText,
  findHiddenText as engineFindHiddenText, findVectorArtwork, windowPdfSvg,
  type DesignMapOptions, type PageText, type HiddenTextFinding, type TaggedElement, 
} from '@lolly/engine';
import type { CullWindow } from '../../../../engine/src/pdf-svg.ts';
import type { PdfNode, PdfFontInfo, PdfXObject, PdfShading, PdfPattern, PdfSoftMaskDef } from '../../../../engine/src/pdf-map.ts';
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { renderTilePixels, type TileSource } from '../lib/pdf-shading.ts';
import { readFontEmbedding, type FontEmbeddingInfo } from '../lib/font-utils.ts';
import {
  backdropLuminosity, buildPattern, buildShading, colorSpaceName, decodedText, dictOf, getKey,
  groupColorSpace, nameOf, numArray, numOf, softMaskId,
  type Ref, type ShadingCtx, type SoftMaskIdRegistry,
} from '../lib/pdf-objects.ts';
import { storeUserUpload } from './picker.ts';
import { trapFocus } from '../lib/focus-trap.ts';
import type { FocusTrap } from '../lib/focus-trap.ts';
import { NAV_EVENTS } from '../utils.ts';

// The interpreter's PdfNode plus the `image` field the shell fills in when it resolves a
// vector/raster placeholder to a stored asset (structurally the design-map DesignNode).
interface ImportNode extends PdfNode { image?: unknown; }

// Fully-populated resource descriptor handed to the engine interpreter.
interface Resources {
  fonts: Record<string, PdfFontInfo>;
  xobjects: Record<string, PdfXObject>;
  extgstates: Record<string, { ca?: number; CA?: number; smask?: PdfSoftMaskDef | boolean }>;
  ocgs: Record<string, string>;
  shadings: Record<string, PdfShading>;
  patterns: Record<string, PdfPattern>;
}

// A raster image XObject the shell will resolve to stored bytes.
interface ImageDesc {
  stream: PDFRawStream;
  filter: string[];
  width: number;
  height: number;
  colorSpace: string | null;
  bpc: number;
  predictor: number | null;
  /** Soft mask (/SMask) - a grayscale alpha image composited over the base at
   *  decode time. How print engines encode blurred shadows and any alpha raster:
   *  without it the base decodes as an opaque plate. */
  smask?: ImageDesc;
}

// ── document loading + per-page interpretation (shared by both surfaces) ────────

async function loadDoc(file: File | Blob): Promise<PDFDocument> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
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
 * engine interpreter, one per approximated or dropped paint. It is deliberately not
 * the caller's user-facing warn stream: a single app screenshot legitimately emits
 * ~80 `pattern.tiling.collapsed` lines, which is a report, not a notification. The
 * docs-shot audit reads it verbatim; parsePdfFile summarises it.
 */
function interpretPage(doc: PDFDocument, pageIndex: number, diag: (msg: string) => void = () => {}): InterpretedPage {
  const pdfPage = doc.getPage(pageIndex);
  const ctx = doc.context;
  const node = pdfPage.node;
  const mb = pdfPage.getMediaBox();

  // Extract resources (recursively for forms). `imageStreams` collects raster XObjects
  // keyed by a unique id the engine echoes back on each image node; `tiles` does the
  // same for function-based shadings.
  const imageStreams = new Map<string, ImageDesc>();
  const tiles = new Map<string, TileSource>();
  const ec = makeExtractCtx(ctx, imageStreams, tiles, diag);
  const resources = extractResources(ec, getKey(ctx, node, 'Resources'), 0);
  const content = contentString(ctx, node);

  const nodes = interpretPdfPage({
    content,
    width: mb.width, height: mb.height,
    originX: mb.x || 0, originY: mb.y || 0,
    fonts: resources.fonts,
    xobjects: resources.xobjects,
    extgstates: resources.extgstates,
    ocgs: resources.ocgs,
    shadings: resources.shadings,
    patterns: resources.patterns,
    // The interpreter reports approximations/drops as (code, detail); the shell owns
    // the wording. Without this the whole pattern-and-shading failure mode was
    // invisible - a blank page with an empty warnings list.
    onWarn: (code, detail) => diag(detail ? `${code} (${detail})` : code),
  }) as ImportNode[];

  return { nodes, width: mb.width, height: mb.height, imageStreams, tiles };
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

  const { boxes, width, height } = await pageToBoxes(doc, pageIndex, host, warn, map, newImportCaches());
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
  vectors: Map<string, unknown>;
  images: Map<unknown, unknown>;
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
  const caches = newImportCaches();
  for (const p of picked) {
    if (picked.length > 1) warn(`Reading page ${p + 1} of ${pageCount}…`);
    try {
      const { boxes, width, height } = await pageToBoxes(doc, p, host, warn, map, caches);
      frames.push({ name: `Page ${p + 1}`, width, height, boxes });
    } catch (err) {
      warn(`Skipped page ${p + 1} (${msg(err)}).`);
    }
  }
  if (!frames.length) throw new Error('Couldn’t find any importable artwork in that document.');
  return frames;
}

/**
 * One page → Design boxes: interpret the content stream, resolve every placeholder
 * (vector paths and image XObjects) to a stored asset, then finalize. Shared by the
 * single-page and the per-page (artboards) imports so the two cannot drift.
 */
async function pageToBoxes(
  doc: PDFDocument, pageIndex: number, host: HostV1, warn: (msg: string) => void, map: DesignMapOptions | undefined, caches: ImportCaches,
): Promise<{ boxes: unknown[]; width: number; height: number }> {
  // Diagnostics are collected, not forwarded: one line per approximated paint would
  // be dozens of toasts. Summarised below, and only for the genuinely lossy rungs -
  // a tiling pattern that collapsed to its inner paint lost nothing.
  const diagnostics: string[] = [];
  const { nodes, width, height, imageStreams } = interpretPage(doc, pageIndex, (m) => diagnostics.push(m));
  if (!nodes.length) throw new Error('Couldn’t find any importable artwork on that page.');
  const lossy = diagnostics.filter((m) => !/^(pattern\.tiling\.collapsed|shading\.type1\.(flat|axialised))\b/.test(m)).length;
  if (lossy) warn(`Approximated ${lossy} fill${lossy === 1 ? '' : 's'} that couldn’t be reproduced exactly.`);

  // Resolve placeholders → stored assets. Clip stacks and soft masks are serializer
  // concerns (pageToSvg honours both); free-canvas boxes can express neither, so they
  // are dropped here. A masked translucent achromatic plate is a print engine's
  // box-shadow: not editable content at all, so it goes rather than importing as a
  // grey rectangle. (This is exactly what the engine's paint-time placeholder
  // heuristic used to do for EVERY surface - now scoped to the one surface that
  // genuinely cannot render a mask.)
  const drawable = nodes.filter((n) => !isShadowPlate(n));
  const vecCache = caches.vectors;
  for (const n of drawable) {
    delete n._clips;
    delete n._softMask;
    try {
      if (n._vectorPath) {
        const ref = await storeVector(host, n, vecCache);
        if (ref) { n.image = ref; } else { n.kind = 'box'; n.fill = firstColor(n._vectorFill); }
        clearVector(n);
      } else if (n._imageXObject) {
        const desc = imageStreams.get(n._imageXObject);
        // One decode + one store per XObject for the whole import, however many
        // pages place it. `null` is remembered too: an undecodable image stays
        // undecodable on page 27.
        const key = desc?.stream ?? null;
        let ref: unknown = null;
        if (desc) {
          if (key && caches.images.has(key)) ref = caches.images.get(key) ?? null;
          else { ref = await resolveImage(host, desc, warn); if (key) caches.images.set(key, ref); }
        }
        if (ref) { n.image = ref; } else { n.kind = 'box'; n.fill = ''; }
        delete n._imageXObject;
      }
    } catch (err) {
      warn(`Skipped an element that couldn’t be imported (${msg(err)}).`);
      n.kind = 'box'; clearVector(n); delete n._imageXObject;
    }
  }

  const boxes = finalizeBoxes(drawable, { prefix: 'p', ...map });
  if (!boxes.length) throw new Error('Couldn’t find any importable artwork on that page.');
  return { boxes, width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

// ── pdf-lib access helpers ─────────────────────────────────────────────────────
// The generic object walkers (dictOf/getKey/numOf/…) and the whole function →
// shading → pattern decoder now live in lib/pdf-objects.ts: pure pdf-lib work with
// no DOM, so it can be unit-tested against real in-memory PDF dictionaries. This
// module keeps only what needs the browser.

function msg(err: unknown): string { return String((err && (err as Error).message) || err); }

function dictEntries(ctx: PDFContext, o: Ref): [string, PDFObject][] {
  const d = dictOf(ctx, o);
  return d ? [...d.entries()].map(([k, v]): [string, PDFObject] => [k.asString().replace(/^\//, ''), v]) : [];
}
function contentString(ctx: PDFContext, pageNode: Ref): string {
  const c = ctx.lookup(getKey(ctx, pageNode, 'Contents'));
  const parts: string[] = [];
  const add = (ref: Ref) => { const t = decodedText(ctx, ref); if (t != null) parts.push(t); };
  if (c instanceof PDFArray) c.asArray().forEach(add); else add(getKey(ctx, pageNode, 'Contents'));
  return parts.join('\n');
}

// ── resource extraction ─────────────────────────────────────────────────────

/** The shared state one page's resource walk threads through every helper: the
 *  pdf-lib context, the "resolve this later" registries, and the warn sink. Bundled
 *  because all of them now reach every level of the recursion - a tiling pattern's
 *  resources can hold fonts, images, shadings and further patterns.
 *  `resources` closes the loop for lib/pdf-objects.ts, which must not import this
 *  DOM-touching module back. */
interface ExtractCtx extends ShadingCtx {
  imageStreams: Map<string, ImageDesc>;
  /** Soft-mask identity: /G object → ordinal, and mask variant → engine-facing id.
   *  See `softMaskId` - the group alone is NOT the unit of identity. */
  maskIds: SoftMaskIdRegistry;
}

/** Build the context for one page's walk. */
function makeExtractCtx(ctx: PDFContext, imageStreams: Map<string, ImageDesc>, tiles: Map<string, TileSource>, warn: (m: string) => void): ExtractCtx {
  const ec: ExtractCtx = {
    ctx, imageStreams, tiles, warn, maskIds: { groups: new Map(), ids: new Map() },
    resources: (d: Ref, depth: number) => extractResources(ec, d, depth),
  };
  return ec;
}

function extractResources(ec: ExtractCtx, resDict: Ref, depth: number): Resources {
  const ctx = ec.ctx;
  const res: Resources = { fonts: {}, xobjects: {}, extgstates: {}, ocgs: {}, shadings: {}, patterns: {} };
  if (!dictOf(ctx, resDict) || depth > 8) return res;

  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'ExtGState'))) {
    const ca = numOf(ctx, getKey(ctx, ref, 'ca')), CA = numOf(ctx, getKey(ctx, ref, 'CA'));
    res.extgstates[name] = {};
    if (ca != null) res.extgstates[name]!.ca = ca;
    if (CA != null) res.extgstates[name]!.CA = CA;
    // A soft mask on the graphics state (/SMask << /S /Luminosity /G <group> >>) is
    // how Chromium prints a BOX-SHADOW: it fills the element's box with a flat
    // translucent paint and lets the mask supply the blur, the offset and the rounded
    // shape. The mask group /G is a form XObject - a content stream plus resources - 
    // so we PRE-DECODE it into exactly the shape the engine's interpreter can `run()`
    // and the engine emits a real SVG `<mask>`. `/None` (the explicit "no mask"
    // value) is a name, not a dict, so dictOf() rejects it and we record `false`.
    //
    // FOUR-state, and every distinction matters: an ExtGState only changes the
    // parameters it actually lists, so an ExtGState with no /SMask key must leave
    // whatever mask is in force ALONE. Only `/SMask /None` clears it.
    //   dict, decoded  -> PdfSoftMaskDef (a mask comes into force, evaluable)
    //   dict, undecodable -> true  (in force but opaque to us - the engine's
    //                              last-resort rung; NEVER `false`, which would
    //                              silently paint the shadow plate)
    //   /None          -> false     (an explicit clear)
    //   absent         -> undefined (leave the current mask as it is)
    const sm = getKey(ctx, ref, 'SMask');
    if (sm) res.extgstates[name]!.smask = dictOf(ctx, sm) ? buildSoftMask(ec, sm, depth) : false;
  }

  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'Font'))) {
    res.fonts[name] = buildFontInfo(ec, ref, depth);
  }

  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'XObject'))) {
    const subtype = nameOf(ctx, getKey(ctx, ref, 'Subtype'));
    if (subtype === 'Image') {
      const key = `img${ec.imageStreams.size}`;
      ec.imageStreams.set(key, makeImageDesc(ctx, ref));
      res.xobjects[name] = { kind: 'image', imageKey: key };
    } else if (subtype === 'Form') {
      const mtx = ctx.lookup(getKey(ctx, ref, 'Matrix'));
      res.xobjects[name] = {
        kind: 'form',
        content: decodedText(ctx, ref) || '',
        matrix: mtx instanceof PDFArray ? mtx.asArray().map((v) => numOf(ctx, v) ?? 0) : undefined,
        resources: extractResources(ec, getKey(ctx, ref, 'Resources'), depth + 1),
      };
    }
  }

  // Optional-content groups: /Properties maps a marked-content name → an OCG dict whose
  // /Name is the (Illustrator layer) label.
  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'Properties'))) {
    const label = pdfString(ctx, getKey(ctx, ref, 'Name'));
    if (label) res.ocgs[name] = label;
  }

  // Shadings (the `sh` operator) and Patterns (PatternType 2 shading patterns and
  // PatternType 1 tiling patterns, used as a `scn` fill). Chromium emits CSS
  // gradients as shading patterns and out-of-sRGB colours as a tiling pattern
  // wrapping a function-based shading; decoding both to a pre-sampled ramp / flat
  // colour / raster tile lets the engine paint something real instead of dropping
  // the fill entirely.
  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'Shading'))) {
    const sh = buildShading(ec, ref);
    if (sh) res.shadings[name] = sh;
  }
  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'Pattern'))) {
    const pt = buildPattern(ec, ref, depth);
    if (pt) res.patterns[name] = pt;
  }
  return res;
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
function buildSoftMask(ec: ExtractCtx, smRef: Ref, depth: number): PdfSoftMaskDef | true {
  const ctx = ec.ctx;
  // A mask group's resources can name further masks. extractResources' own depth cap
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
      id: softMaskId(ec.maskIds, g as object, subtype, transfer, backdrop),
      subtype,
      content,
      resources: extractResources(ec, getKey(ctx, gRef, 'Resources'), depth + 1),
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

/** Descriptor for one image XObject, including its /SMask (one level - an SMask
 *  never carries an SMask of its own). */
function makeImageDesc(ctx: PDFContext, ref: Ref, depth = 0): ImageDesc {
  const desc: ImageDesc = {
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

function filterList(ctx: PDFContext, o: Ref): string[] {
  o = ctx.lookup(o as PDFObject | undefined);
  if (o instanceof PDFName) return [o.asString().replace(/^\//, '')];
  if (o instanceof PDFArray) return o.asArray().map((v) => nameOf(ctx, v)).filter(Boolean) as string[];
  return [];
}

function pdfString(ctx: PDFContext, o: Ref): string {
  o = ctx.lookup(o as PDFObject | undefined);
  if (!o) return '';
  const s = o as { asString?: () => string; decodeText?: () => string };
  if (typeof s.asString === 'function' && !(o instanceof PDFName)) { try { return s.asString(); } catch { /* */ } }
  if (typeof s.decodeText === 'function') { try { return s.decodeText(); } catch { /* */ } }
  return '';
}

// ── fonts ─────────────────────────────────────────────────────────────────────

function buildFontInfo(ec: ExtractCtx, fontRef: Ref, depth: number): PdfFontInfo {
  const ctx = ec.ctx;
  const subtype = nameOf(ctx, getKey(ctx, fontRef, 'Subtype')) || '';
  const twoByte = subtype === 'Type0';
  const rawBase = nameOf(ctx, getKey(ctx, fontRef, 'BaseFont')) || '';
  const base = rawBase.replace(/^[A-Z]{6}\+/, ''); // strip subset prefix "ABCDEF+"
  const info: PdfFontInfo = { twoByte, family: base, weight: weightFromName(base) };

  // ToUnicode is the reliable path for embedded / subset fonts. For a Type0 font the
  // ToUnicode may live on the font or (rarely) its descendant - the top-level one wins.
  const tuText = decodedText(ctx, getKey(ctx, fontRef, 'ToUnicode'));
  if (tuText) {
    try { info.decode = toUnicodeDecoder(parseToUnicode(tuText), twoByte); } catch { /* Latin-1 fallback */ }
  }

  // Type3 glyphs are content-stream drawing procedures - the interpreter executes
  // them into real vector paths (engine pdf-map drawType3). This is how Chromium's
  // printToPDF encodes app text, so it's the path every docs screenshot takes.
  if (subtype === 'Type3') {
    const fmArr = ctx.lookup(getKey(ctx, fontRef, 'FontMatrix'));
    const fontMatrix = fmArr instanceof PDFArray ? fmArr.asArray().map((v) => numOf(ctx, v) ?? 0) : [0.001, 0, 0, 0.001, 0, 0];
    const charProcs: Record<string, string> = {};
    for (const [gname, gref] of dictEntries(ctx, getKey(ctx, fontRef, 'CharProcs'))) {
      const t = decodedText(ctx, gref);
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
    info.type3 = { fontMatrix, charProcs, encoding, widths, resources: extractResources(ec, getKey(ctx, fontRef, 'Resources'), depth + 1) };
    info.twoByte = false;
  }
  return info;
}

function weightFromName(name: string): number {
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

// ── image resolution ──────────────────────────────────────────────────────────

/** Decode a raster XObject to browser-displayable bytes (shared by the boxes path,
 *  which stores them as an asset, and the page-SVG path, which inlines a data: URI). */
async function imageBytes(desc: ImageDesc, warn: (msg: string) => void): Promise<{ bytes: Uint8Array; mime: string; ext: string } | null> {
  const last = desc.filter[desc.filter.length - 1];
  try {
    let base: { bytes: Uint8Array; mime: string; ext: string } | null = null;
    if (last === 'DCTDecode') {
      // Raw stream bytes ARE the JPEG the browser can decode directly.
      base = { bytes: desc.stream.getContents(), mime: 'image/jpeg', ext: 'jpg' };
    } else {
      // Flate RGB/Gray at 8bpc. Accept no predictor / TIFF-none (<=1) AND PNG
      // predictors (>=10) - the latter is what jsPDF's addImage(png,'PNG') writes
      // (/Predictor 15), so this is how /verify can read Lolly's OWN PDF PNG embeds.
      // TIFF predictor 2 (2..9) stays skipped (flateImageToPng would return null).
      const pred = (desc.predictor as number) ?? 1;
      if ((last === 'FlateDecode' || last == null) && desc.width > 0 && desc.height > 0 && desc.bpc === 8 && (pred <= 1 || pred >= 10)) {
        const png = await flateImageToPng(desc);
        if (png) base = { bytes: png, mime: 'image/png', ext: 'png' };
      }
    }
    if (!base) {
      warn(`Skipped an embedded image in an unsupported encoding (${last || 'raw'}).`);
      return null;
    }
    // A soft mask carries the image's alpha as a separate grayscale plane - how
    // print engines encode blurred shadows and any transparent raster. Composite
    // it, or the base renders as an opaque plate.
    if (desc.smask) {
      const masked = await applySmask(base, desc.smask);
      if (masked) return masked;
      warn('Kept an embedded image opaque (its soft mask was undecodable).');
    }
    return base;
  } catch (err) {
    warn(`Couldn’t import an embedded image (${msg(err)}).`);
    return null;
  }
}

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

/** Merge a /SMask's grayscale plane into the base image's alpha channel (nearest-
 *  neighbour scaled when the planes' dimensions differ). Returns a PNG. */
async function applySmask(base: { bytes: Uint8Array; mime: string }, smask: ImageDesc): Promise<{ bytes: Uint8Array; mime: string; ext: string } | null> {
  const img = await decodeToImageData(base.bytes, base.mime);
  if (!img) return null;

  // The alpha plane: Flate gray samples directly, or a JPEG-coded mask's luma.
  let alpha: Uint8Array | Uint8ClampedArray | null = null;
  let aw = smask.width, ah = smask.height;
  if (smask.filter[smask.filter.length - 1] === 'DCTDecode') {
    const m = await decodeToImageData(smask.stream.getContents(), 'image/jpeg');
    if (m) {
      const gray = new Uint8Array(m.width * m.height);
      for (let i = 0; i < gray.length; i++) gray[i] = m.data[i * 4]!;
      alpha = gray; aw = m.width; ah = m.height;
    }
  } else if (smask.bpc === 8) {
    alpha = flateSamples(smask, 1);
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
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d')!.putImageData(img, 0, 0);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), mime: 'image/png', ext: 'png' } : null;
}

async function resolveImage(host: HostV1, desc: ImageDesc, warn: (msg: string) => void): Promise<unknown> {
  const got = await imageBytes(desc, warn);
  return got ? storeBytes(host, got.bytes, got.mime, got.ext) : null;
}

/** Inflate + de-predictor a Flate image stream's raw samples (8bpc only).
 *  PNG predictor (/Predictor >= 10): pdf-lib's FlateStream only inflates - it
 *  never applies predictors - so the samples are still PNG-row-filtered (a 1-byte
 *  filter tag + width*comps bytes per row); reverse them to get real pixels.
 *  TIFF predictor 2 (2..9) isn't handled. Shared by the color path and /SMask
 *  alpha planes (comps=1). */
function flateSamples(desc: ImageDesc, comps: number): Uint8Array | Uint8ClampedArray | null {
  if (desc.bpc !== 8 || desc.width < 1 || desc.height < 1) return null;
  let samples: Uint8Array | Uint8ClampedArray;
  try { samples = decodePDFRawStream(desc.stream).decode(); } catch { return null; }
  const pred = (desc.predictor as number) ?? 1;
  if (pred >= 10) {
    const un = unfilterPng(samples, desc.width, desc.height, comps);
    if (!un) return null;
    samples = un;
  } else if (pred > 1) {
    return null;
  }
  return samples.length >= desc.width * desc.height * comps ? samples : null;
}

// Decode a Flate RGB/Gray image's raw samples into a PNG via a canvas.
async function flateImageToPng(desc: ImageDesc): Promise<Uint8Array | null> {
  const cs = desc.colorSpace || '';
  const comps = /RGB/i.test(cs) ? 3 : (/Gray/i.test(cs) ? 1 : 0);
  if (!comps) return null;
  const { width, height } = desc;
  const samples = flateSamples(desc, comps);
  if (!samples) return null;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, s = 0, d = 0; i < width * height; i++) {
    if (comps === 3) { rgba[d] = samples[s]!; rgba[d + 1] = samples[s + 1]!; rgba[d + 2] = samples[s + 2]!; s += 3; }
    else { const g = samples[s]!; rgba[d] = g; rgba[d + 1] = g; rgba[d + 2] = g; s += 1; }
    rgba[d + 3] = 255; d += 4;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d')!.putImageData(new ImageData(rgba, width, height), 0, 0);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

async function storeBytes(host: HostV1, bytes: Uint8Array, type: string, ext: string): Promise<unknown> {
  const file = new File([bytes as BlobPart], `pdf-${Date.now()}-${Math.round(bytes.length)}.${ext}`, { type });
  // storeUserUpload's param is a shell-internal PickerHost superset of HostV1; the real
  // host satisfies it at runtime (same object the picker uses). `batch`: a picture the
  // library already holds byte-for-byte is that asset - an import never asks, and
  // never raises the library's milestone notice mid-run.
  return storeUserUpload(host as Parameters<typeof storeUserUpload>[0], file, { batch: true });
}

// ── vector path resolution ──────────────────────────────────────────────────

async function storeVector(host: HostV1, n: ImportNode, cache: Map<string, unknown>): Promise<unknown> {
  const vb = n._vectorViewBox || { x: 0, y: 0, w: Math.round(n.w), h: Math.round(n.h) };
  const d = String(n._vectorPath || '').replace(/"/g, '');
  if (!d) return null;
  const fill = colorAttr(n._vectorFill, 'none');
  const st = n._vectorStroke;
  const strokeAttr = (st && st.color)
    ? ` stroke="${colorAttr(st.color, '#000000')}" stroke-width="${Math.max(0.3, +st.width || 1)}" fill-rule="nonzero"` : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r(vb.x)} ${r(vb.y)} ${r(vb.w)} ${r(vb.h)}" ` +
    `width="${Math.max(1, Math.round(vb.w))}" height="${Math.max(1, Math.round(vb.h))}">` +
    `<path d="${d}" fill="${fill}"${strokeAttr}/></svg>`;
  if (cache.has(svg)) return cache.get(svg);
  const file = new File([svg], `pdf-vec-${cache.size}.svg`, { type: 'image/svg+xml' });
  const ref = await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], file, { batch: true });
  cache.set(svg, ref);
  return ref;
}

function colorAttr(v: unknown, dflt: string): string {
  const s = String(v == null ? '' : v).trim();
  if (s.toLowerCase() === 'none') return 'none';
  return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : dflt;
}
function firstColor(v: unknown): string { const s = safeColor(v, ''); return (s && s.toLowerCase() !== 'none') ? s : ''; }
function clearVector(n: ImportNode): void { delete n._vectorPath; delete n._vectorFill; delete n._vectorStroke; delete n._vectorViewBox; }
function r(v: number): number { return Math.round((+v || 0) * 100) / 100; }

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

/** Cap on extracted marks - a pathological page must not produce hundreds. */
const MAX_VECTORS = 40;
/** Breathing room around a mark's bounding box, in points. */
const VECTOR_PAD = 2;

/** One piece of vector artwork lifted out of a page, as standalone SVG. */
export interface ExtractedVector {
  /** Self-contained SVG, cropped to the mark and sized in points. */
  svg: string;
  width: number;
  height: number;
  /** 0-based page it was found on. */
  page: number;
  /** Distinct fill colours, most-used first - a palette preview. */
  fills: string[];
  /** How many shapes make up the mark. */
  shapes: number;
  /** Plain-language reason it was believed to be artwork. */
  reason: string;
}

/**
 * Extract each mark on one page as its own SVG.
 *
 * Built on pageToSvg + windowPdfSvg rather than a bespoke serialiser, so a mark
 * inherits every fidelity the page path already has - gradients, clip paths,
 * soft masks, inlined rasters and outlined text. The crop is applied HERE and
 * not later: storeUserUpload's normaliser strips the root width/height, after
 * which windowPdfSvg's regex no longer matches and it silently returns the input
 * unchanged, shipping the whole page with the mark lost in the middle of it.
 *
 * Each mark gets its own `idPrefix`. Def ids are otherwise plain counters
 * (`pgrad0`, `pclip0`, `pmask0`), and stored SVG assets get inlined as nested
 * `<svg>` on export - where ids do NOT scope - so two marks from one page would
 * quietly cross-reference each other's gradients and masks.
 */
async function vectorsOnPage(
  handle: PdfHandle, doc: PDFDocument, pageIndex: number, idBase: number,
): Promise<ExtractedVector[]> {
  const { nodes, width, height } = interpretPage(doc, pageIndex);
  const marks = findVectorArtwork(nodes, { width, height });
  const out: ExtractedVector[] = [];

  for (let m = 0; m < marks.length && idBase + out.length < MAX_VECTORS; m++) {
    const mark = marks[m]!;
    const x = Math.max(0, mark.rect.x - VECTOR_PAD);
    const y = Math.max(0, mark.rect.y - VECTOR_PAD);
    const w = Math.min(width - x, mark.rect.w + VECTOR_PAD * 2);
    const h = Math.min(height - y, mark.rect.h + VECTOR_PAD * 2);
    if (!(w > 0) || !(h > 0)) continue;

    try {
      // Cull to the mark first (bytes + decode time), then window to the exact
      // rect - both derived from ONE crop so they cannot disagree.
      const page = await handle.pageToSvg(pageIndex, {
        cull: { x, y, width: w, height: h },
        idPrefix: `v${idBase + out.length}`,
      });
      const svg = windowPdfSvg(page.svg, { x, y, width: w, height: h });
      out.push({
        svg, width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)),
        page: pageIndex, fills: mark.fills, shapes: mark.indices.length, reason: mark.reason,
      });
    } catch { /* a mark that will not serialise is dropped, not fatal */ }
  }
  return out;
}

// ── the structure tree (tagged reading order) ─────────────────────────────────

/** Depth cap for the struct-tree walk - the tree is a graph and can cycle. */
const MAX_STRUCT_DEPTH = 64;

/**
 * Flatten a page's `/StructTreeRoot` into elements in DOCUMENT order.
 *
 * A tagged PDF states its own reading order, which is the thing geometry can
 * only ever guess at: which paragraph follows which, where a block ends, and
 * what is a heading. The tree is walked depth-first because that IS document
 * order - `/K` arrays are ordered, and the order of the walk is the order the
 * author intended the content to be read.
 *
 * Only elements belonging to `pageRef` are returned: one structure tree spans
 * the whole document, and an element's `/Pg` (inherited from its ancestors when
 * absent) says which page its content sits on.
 *
 * Returns [] for an untagged document, which is the signal to stay geometric.
 */
function readStructOrder(doc: PDFDocument, pageIndex: number): TaggedElement[] {
  const ctx = doc.context;
  const out: TaggedElement[] = [];

  let pageRef: PDFRef | null = null;
  try { pageRef = doc.getPage(pageIndex).ref; } catch { return out; }
  const root = doc.catalog.get(PDFName.of('StructTreeRoot'));
  if (!root || !pageRef) return out;

  const seen = new Set<string>();

  /** Collect the MCIDs a /K entry contributes, for an element already on our page. */
  const mcidsOf = (k: Ref, acc: number[], depth: number): void => {
    if (depth > MAX_STRUCT_DEPTH || acc.length > 4096) return;
    const v = ctx.lookup(k as PDFObject | undefined);
    // A bare integer in /K IS a marked-content id.
    if (v instanceof PDFNumber) { acc.push(v.asNumber()); return; }
    if (v instanceof PDFArray) { for (const e of v.asArray()) mcidsOf(e, acc, depth + 1); return; }
    const d = dictOf(ctx, v);
    if (!d) return;
    const type = nameOf(ctx, d.get(PDFName.of('Type')));
    // /MCR - an explicit marked-content reference.
    if (type === 'MCR') {
      const n = numOf(ctx, d.get(PDFName.of('MCID')));
      if (n != null) acc.push(n);
      return;
    }
    // /OBJR points at an object (a form field, an annotation), not at content.
    if (type === 'OBJR') return;
  };

  const walk = (node: Ref, inheritedPg: PDFRef | null, depth: number): void => {
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

    // This element's own content, if it sits on the page we are reading.
    if (structType && pg && pageRef && pg.tag === pageRef.tag) {
      const mcids: number[] = [];
      mcidsOf(kids, mcids, 0);
      if (mcids.length) out.push({ mcids, type: structType });
    }

    // Then descend, in array order - depth-first IS document order.
    const arr = ctx.lookup(kids as PDFObject | undefined);
    if (arr instanceof PDFArray) {
      for (const kid of arr.asArray()) {
        // Skip bare mcids/MCRs here: they were this element's own content, not
        // children to recurse into.
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
      extractResources(makeExtractCtx(ctx, streams, new Map(), () => {}), getKey(ctx, node, 'Resources'), 0);
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
      try { tagged = readStructOrder(doc, index); }
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
      // asset, and with MAX_VECTORS marks in the whole document, twenty-eight copies
      // of one logo would crowd out the diagram on page 15. The key is the mark's
      // own geometry + shape count + palette; the SVG text differs per mark (ids).
      const seen = new Set<string>();
      for (let p = 0; p < pages && out.length < MAX_VECTORS; p++) {
        try {
          for (const v of await vectorsOnPage(this as PdfHandle, doc, p, out.length)) {
            const key = `${v.width}x${v.height}|${v.shapes}|${v.fills.join(',')}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(v);
            if (out.length >= MAX_VECTORS) break;
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
 *  instead of reading "no hit" as "nothing there". jsPDF's own FlateDecode PNG-
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
      extractResources(makeExtractCtx(ctx, imageStreams, new Map(), () => {}), getKey(ctx, node, 'Resources'), 0);
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

// Base64 in chunks - String.fromCharCode(...bigArray) overflows the call stack.
function bytesToBase64(u8: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) bin += String.fromCharCode(...u8.subarray(i, i + CHUNK));
  return btoa(bin);
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
