// SPDX-License-Identifier: MPL-2.0
// Design Import - DOM parser (Figma SVG / any SVG / Penpot .penpot|.zip → Design boxes).
//
// This is the SHELL half of the import feature: it lives in the web shell
// because it needs the browser DOM (DOMParser + a live-mounted <svg> for
// getBBox/getCTM) and the shell's user-asset store. It is dynamic-imported
// by free-canvas.js. All the PURE, DOM-free geometry/colour/text mapping
// lives in engine/src/design-map.js and is shared via the '@lolly/engine'
// barrel (same specifier every other view uses, e.g. tool.js).
//
// Strategy for geometry (the essential trick): arbitrary SVG transform
// stacks cannot be reliably parsed by hand, so instead the sanitized SVG is
// mounted offscreen and the browser resolves every transform for us. For
// each visual leaf we read:
//   * el.getBBox()  → the element's LOCAL, unrotated bounding box (in its own user space)
//   * el.getCTM()   → the matrix from that local space to the ROOT svg user space (= our
//                     canvas coordinates, because we size the mount to the viewBox)
// design-map.boxGeomFromBBox(bbox, ctm) then folds those into a top-left
// x/y/w/h + rotation. The mount MUST be visible-in-layout
// (visibility:hidden, NOT display:none): display:none zeroes
// getBBox()/getCTM() and every element would collapse to 0x0.
//
// Security: imported SVG is untrusted. sanitizeSvg() strips <script>,
// <foreignObject>, every on* handler and javascript: hrefs BEFORE the
// markup is ever parsed into a live document, and any SVG we
// flatten-and-store is sanitized a SECOND time by storeUserUpload
// (DOMPurify on ingest). Scripts never run and never reach disk.

import { storeUserUpload } from './picker.ts';
import {
  boxGeomFromBBox,
  finalizeBoxes,
  safeColor,
  parsePenpotContent,
  collectPenpotFontUsage,
  penpotShapeToNode,
  penpotGroupToSvg,
  penpotGradientSvgDef,
  penpotDashArray,
  penpotBackgroundBlurPx,
  collectPenpotExportMarks,
  collectPenpotComponents,
  penpotComponentSlots,
  penpotFlowOrder,
  figmaNodesToNodes,
  figmaNodesToScenes,
  isPptx,
  readingOrder,
  type DesignFrameScene,
  type DesignMapOptions,
  type PageText,
  type TextBlock,
} from '@lolly/engine';
import { rasterSize } from './svg-unpack.ts';
import type { UnpackHandle } from './unpack-open.ts';
import type { PdfPageSvg, EmbeddedFont, EmbeddedImage, EmbeddedImageScan, ExtractedVector } from './pdf-import.ts';
import { strFromU8 } from 'fflate';
import { unzipAsync } from '../lib/zip.ts';
// Figma .fig decode: a canvas.fig is a Kiwi binary (self-describing schema + data).
// The schema chunk is raw-DEFLATE (native DecompressionStream); the data chunk is zstd
// (fzstd - pure JS, by the fflate author). kiwi-schema is Evan Wallace's official decoder.
import { decodeBinarySchema, compileSchema } from 'kiwi-schema';
import { Decompress as ZstdDecompress } from 'fzstd';
import type { HostV1, AssetRef } from '@lolly-tools/core/host-v1';
import { alignBoxIds, penpotComponentThumb, type DesignTemplate, type DesignTemplateSlot } from '../lib/design-templates.ts';
import { installGoogleFont } from '../user-fonts.ts';
import type { UserFontsHost } from '../user-fonts.ts';
import { bustFontRegistry } from '../bridge/font-registry.ts';

// A 2-D affine matrix (a,b,c,d,e,f), as read from getCTM / rebuilt for flatten transforms.
interface Matrix { a: number; b: number; c: number; d: number; e: number; f: number; }
// Inherited paint accumulated down the <g> tree.
interface Inherited { fill: string | null; opacity: number; }
// The result shape every parse branch returns (feeds Design).
interface DesignImportResult {
  boxes: unknown[]; width: number; height: number; background: string;
  /** The map the boxes were finalized with, font vocabulary and all (Penpot
   *  binfile only). Additive: a caller that wants a SECOND pass over the same
   *  file (the components-as-templates pass) hands this back so the deck's
   *  families are already known and no font is fetched or warned about twice. */
  map?: DesignMapOptions;
}
// Options for svgToNodes (Penpot pages set penpot + zipFiles).
interface SvgToNodesOpts {
  host: HostV1 | undefined;
  warn: (msg: string) => void;
  penpot?: boolean;
  zipFiles?: Record<string, Uint8Array> | null;
}
// Per-element context threaded through elementToNode / flattenToImage.
interface ElementCtx {
  host: HostV1 | undefined;
  warn: (msg: string) => void;
  inherited: Inherited;
  imageCache: Map<string, AssetRef>;
  penpot: boolean;
  zipFiles: Record<string, Uint8Array> | null;
  defsHtml: () => string;
}

// Hard ceiling so a pathological file can't lock the tab building tens of thousands
// of boxes. Anything past this is dropped with a warning.
const MAX_ELEMENTS = 2000;

// Byte bounds for the import pipeline. The picked file is read whole into
// memory and several branches make further copies (text decode, unzip,
// zstd), so every stage is capped: the input itself, each zip entry's
// DECLARED inflated size and their sum (the classic zip bomb hides behind a
// tiny compressed payload), and the two .fig decompressors, which are
// streamed so a lying header is stopped at the cap instead of trusted. All
// sit far above any real design export.
const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 128 * 1024 * 1024;
const MAX_ZIP_TOTAL_BYTES = 512 * 1024 * 1024;
const MAX_FIG_SCHEMA_BYTES = 64 * 1024 * 1024;
const MAX_FIG_DATA_BYTES = 256 * 1024 * 1024;

// Elements that are never drawn on their own (definitions / metadata / containers).
// <g> is intentionally NOT here: it's a container we recurse into, not a leaf.
const SKIP_TAGS = new Set([
  'defs', 'clippath', 'mask', 'symbol', 'style', 'script',
  'title', 'desc', 'metadata', 'filter', 'lineargradient',
  'radialgradient', 'pattern', 'marker',
]);

// Penpot writes its extra data as `penpot:*` attributes. DOMParser keeps the literal
// qualified name, but namespace handling varies, so we look it up defensively.
const PENPOT_NS_CANDIDATES = [
  'http://penpot.app/svg',
  'https://penpot.app/svg',
  'http://penpot.app/xmlns',
];

/**
 * Parse a design file into a Design boxes array.
 * @param {File|Blob} file
 * @param {{ host: object, log?: (msg: string) => void, interactive?: boolean, map?: object }} ctx - 
 *   `interactive` lets a multi-page PDF/.ai ask which page via the shared page-picker
 *   dialog (cancelling throws 'Import cancelled.'); without it the first page imports
 *   with a warn, the headless-safe default. `map` is the engine's DesignMapOptions - 
 *   the target tool's font vocabulary + seed colours (see free-canvas openImportPanel);
 *   omitted, the engine's neutral (lolly-start) defaults apply.
 * @returns {Promise<{ boxes: object[], width: number, height: number, background: string }>}
 */
export async function parseDesignFile(
  file: File | Blob,
  { host, log, interactive, map }: {
    host?: HostV1; log?: (msg: string) => void; interactive?: boolean; map?: DesignMapOptions;
  } = {},
): Promise<DesignImportResult> {
  const warn: (msg: string) => void = typeof log === 'function' ? log : () => {};
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error(`This file is too large to import (over ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB).`);
  }
  const buf = new Uint8Array(await file.arrayBuffer());

  // Layered bitmaps (Photoshop PSD/PSB, GIMP XCF): each layer becomes an image box
  // at its exact document offset. The parse + per-layer asset storage live in
  // psd-import.ts (its own lazy chunk, like the PDF path below).
  if ((buf.length >= 4 && buf[0] === 0x38 && buf[1] === 0x42 && buf[2] === 0x50 && buf[3] === 0x53)
    || (buf.length >= 9 && String.fromCharCode(...buf.subarray(0, 9)) === 'gimp xcf ')) {
    const { parseLayeredAsDesign } = await import('./psd-import.ts');
    return await parseLayeredAsDesign(file, {
      host: host as unknown as Parameters<typeof parseLayeredAsDesign>[1]['host'],
      warn,
    }) as unknown as DesignImportResult;
  }

  // PDF / Adobe Illustrator: a modern .ai saved with PDF compatibility (the default) IS a
  // PDF, so both route to the PDF interpreter. The heavy pdf-lib parser is its own lazy chunk.
  if (isPdf(buf)) {
    const { parsePdfFile } = await import('./pdf-import.ts');
    return parsePdfFile(file, { host: host as HostV1, warn, interactive, map });
  }

  // Raw InDesign .indd is a proprietary binary database with no open parser - guide the
  // user to InDesign's open interchange format (IDML) instead of failing opaquely.
  if (isIndd(buf, file && (file as File).name)) {
    throw new Error('A raw .indd file can’t be read directly. In InDesign choose File → Export → InDesign Markup (.idml) and import the .idml.');
  }

  // Sniff: Penpot exports, Figma .fig and InDesign .idml are all ZIPs (magic "PK\x03\x04").
  // Unzip once and route by contents.
  const isZip = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  if (isZip) {
    const files = await unzipAsync(buf, {
      maxEntryBytes: MAX_ZIP_ENTRY_BYTES,
      maxTotalBytes: MAX_ZIP_TOTAL_BYTES,
      tooLarge: name => `This archive expands too large to import (${name}).`,
    });
    // A PowerPoint deck is a zip too. One slide replaces the board (the picker asks
    // which); its parts arrive as editable boxes through pptx-import's mapper.
    if (isPptx(files)) {
      const { parsePptxFile } = await import('./pptx-import.ts');
      return parsePptxFile(file, files, { host: host as HostV1, warn, interactive, map });
    }
    if (isIdml(files)) {
      const { parseIdmlZip } = await import('./idml-import.ts');
      return parseIdmlZip(files, { host, warn, map });
    }
    if (files['canvas.fig']) return parseFig(files, { host, warn, map });
    return parsePenpotZip(files, { host, warn, interactive, map });
  }

  // Otherwise treat the bytes as SVG text.
  const svgText = new TextDecoder('utf-8').decode(buf);
  const svgEl = sanitizeSvg(svgText);
  if (!svgEl) throw new Error('This file isn’t a readable SVG. Export your design as SVG and try again.');

  const { nodes, width, height } = await svgToNodes(svgEl, { host, warn });
  return { boxes: finalizeBoxes(nodes, map), width, height, background: '#ffffff' };
}

// ---------------------------------------------------------------------------
// Pages → artboards (the deck import)
// ---------------------------------------------------------------------------

/** One page / slide / board / frame of a design file as an editable frame. */
export interface DesignImportFrame {
  name: string;
  width: number;
  height: number;
  boxes: unknown[];
  /** This page's own ground where the source declares one (a slide's background). */
  background?: string;
  /** The slide's speaker notes where the source carried them (.pptx) - plans/179 P2. */
  notes?: string;
  /** A prototype-flow entrance (Penpot), on `parseDesignScenes`' terms. */
  enter?: string;
  enterMs?: number;
}
export interface DesignArtboardsResult {
  frames: DesignImportFrame[];
  /** The page ground the source paints under every frame (a deck's theme colour). */
  background: string;
  map?: DesignMapOptions;
}

/**
 * Parse a design file into per-page EDITABLE frames - every page of a PDF, every
 * slide of a deck, every board of a Penpot file, every frame of a .fig - so the
 * caller can lay them out as artboards (Andy, 2026-09-02: "decide if they want
 * artboards for slides or frames for animation"). The boxes of each frame are in
 * that frame's own coordinates, exactly what `parseDesignFile` would have returned
 * for that page alone; `parseDesignScenes` is the same walk with a bake at the end.
 *
 * Same contract as parseDesignFile: `interactive` opens the shared page picker
 * (every page pre-selected) for a multi-page PDF or deck and installs a Penpot
 * file's fonts; headless callers take every page. Per-page failures warn and skip.
 */
export async function parseDesignArtboards(
  file: File | Blob,
  { host, log, interactive, map }: {
    host?: HostV1; log?: (msg: string) => void; interactive?: boolean; map?: DesignMapOptions;
  } = {},
): Promise<DesignArtboardsResult> {
  const warn: (msg: string) => void = typeof log === 'function' ? log : () => {};
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error(`This file is too large to import (over ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB).`);
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const one = (res: DesignImportResult, name: string): DesignArtboardsResult => ({
    frames: [{ name, width: res.width, height: res.height, boxes: res.boxes }],
    background: res.background || '#ffffff',
    ...(res.map ? { map: res.map } : {}),
  });

  if ((buf.length >= 4 && buf[0] === 0x38 && buf[1] === 0x42 && buf[2] === 0x50 && buf[3] === 0x53)
    || (buf.length >= 9 && String.fromCharCode(...buf.subarray(0, 9)) === 'gimp xcf ')) {
    const { parseLayeredAsDesign } = await import('./psd-import.ts');
    const res = await parseLayeredAsDesign(file, {
      host: host as unknown as Parameters<typeof parseLayeredAsDesign>[1]['host'],
      warn,
    }) as unknown as DesignImportResult;
    return one(res, baseName((file as File).name, 'Layers'));
  }

  if (isPdf(buf)) {
    const { parsePdfPages } = await import('./pdf-import.ts');
    const frames = await parsePdfPages(file, { host: host as HostV1, warn, interactive, map });
    return { frames, background: '#ffffff' };
  }

  if (isIndd(buf, file && (file as File).name)) {
    throw new Error('A raw .indd file can’t be read directly. In InDesign choose File → Export → InDesign Markup (.idml) and import the .idml.');
  }

  const isZip = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  if (isZip) {
    const files = await unzipAsync(buf, {
      maxEntryBytes: MAX_ZIP_ENTRY_BYTES,
      maxTotalBytes: MAX_ZIP_TOTAL_BYTES,
      tooLarge: name => `This archive expands too large to import (${name}).`,
    });
    if (isPptx(files)) {
      const { parsePptxPages } = await import('./pptx-import.ts');
      const { frames, background } = await parsePptxPages(file, files, { host: host as HostV1, warn, interactive, map });
      return { frames, background };
    }
    if (isIdml(files)) {
      // The IDML reader imports the first spread (and says so); one artboard.
      const { parseIdmlZip } = await import('./idml-import.ts');
      return one(await parseIdmlZip(files, { host, warn, map }), 'Spread 1');
    }
    if (files['canvas.fig']) return { frames: await collectFigFrames(files, { host, warn, map }), background: '#ffffff' };
    return collectPenpotZipFrames(files, { host, warn, interactive, map });
  }

  const svgText = new TextDecoder('utf-8').decode(buf);
  const svgEl = sanitizeSvg(svgText);
  if (!svgEl) throw new Error('This file isn’t a readable SVG. Export your design as SVG and try again.');
  const { nodes, width, height } = await svgToNodes(svgEl, { host, warn });
  return { frames: [{ name: baseName((file as File).name, 'design'), width, height, boxes: finalizeBoxes(nodes, map) }], background: '#ffffff' };
}

/**
 * How many pages a design file would come in as - or null when knowing costs the
 * whole parse (a Penpot / Figma / IDML bundle). Cheap by construction: a PDF's page
 * count comes off its page tree, a deck's off its slide part names, and a single
 * SVG or layered bitmap is one page. Used by the drop door to decide whether a
 * "pages as artboards / as scenes / just one" question is worth asking.
 */
export async function countDesignPages(file: File | Blob): Promise<number | null> {
  if (file.size > MAX_IMPORT_BYTES) return null;
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  if (isPdf(head)) {
    try {
      const { openPdfFile } = await import('./pdf-import.ts');
      return (await openPdfFile(file)).pageCount;
    } catch { return null; }
  }
  const isZip = head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  if (!isZip) return 1;
  try {
    const files = await unzipAsync(new Uint8Array(await file.arrayBuffer()), {
      maxEntryBytes: MAX_ZIP_ENTRY_BYTES,
      maxTotalBytes: MAX_ZIP_TOTAL_BYTES,
      tooLarge: name => `This archive expands too large to import (${name}).`,
    });
    if (isPptx(files)) return Object.keys(files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p)).length || null;
  } catch { return null; }
  return null;
}

// ---------------------------------------------------------------------------
// Format sniffing
// ---------------------------------------------------------------------------

// A PDF (and a PDF-compatible .ai) begins with "%PDF-" within the first bytes - the spec
// permits a little leading junk, so scan a small window.
function isPdf(buf: Uint8Array): boolean {
  const limit = Math.min(buf.length - 4, 1024);
  for (let i = 0; i <= limit; i++) {
    if (buf[i] === 0x25 && buf[i + 1] === 0x50 && buf[i + 2] === 0x44 && buf[i + 3] === 0x46) return true; // %PDF
  }
  return false;
}

// InDesign .indd documents open with a fixed 16-byte master-page GUID. Match that (or the
// filename as a fallback) so we can point the user at IDML instead of choking on binary.
const INDD_MAGIC = [0x06, 0x06, 0xed, 0xf5, 0xd8, 0x1d, 0x46, 0xe5, 0xbd, 0x31, 0xef, 0xe7, 0xfe, 0x74, 0xb7, 0x1d];
function isIndd(buf: Uint8Array, name?: unknown): boolean {
  if (buf.length >= 16 && INDD_MAGIC.every((b, i) => buf[i] === b)) return true;
  return typeof name === 'string' && /\.indd$/i.test(name.trim());
}

// An IDML package is a ZIP with a root `designmap.xml` (and a `mimetype` naming the format).
function isIdml(files: Record<string, Uint8Array>): boolean {
  if (files['designmap.xml']) return true;
  const mt = files['mimetype'];
  if (mt) { try { return /indesign-idml|idml/i.test(strFromU8(mt)); } catch { /* */ } }
  return false;
}

// ---------------------------------------------------------------------------
// Sanitisation
// ---------------------------------------------------------------------------

/**
 * Parse untrusted SVG text into a live (but inert) <svg> element, stripping anything
 * executable or navigable. Returns the root <svg> element (belonging to a detached
 * document) or null if the text isn't parseable SVG.
 */
function sanitizeSvg(svgText: string): SVGSVGElement | null {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  } catch {
    return null;
  }
  // A parse error surfaces as a <parsererror> element in the result.
  if (!doc || doc.querySelector('parsererror')) {
    // Some browsers still yield a usable root alongside a soft parsererror; only bail
    // if there's no <svg> at all.
    if (!doc || !doc.querySelector('svg')) return null;
  }
  const svg = doc.querySelector('svg');
  if (!svg) return null;

  // 1) Drop executable / escape-hatch elements entirely. <style> can pull external
  //    resources via @import / url(...), so it goes too - we only read geometry + paint.
  svg.querySelectorAll('script, foreignObject, style').forEach((n) => n.remove());

  // 2) Walk every element: strip on* handlers, and any href/src that is not
  //    a data: URI or a local #fragment. This is the essential PRIVACY
  //    guard: the imported SVG is untrusted and gets mounted live (to
  //    measure it), so an external <image href="https://tracker/..."> /
  //    xlink:href would otherwise fire a network beacon on import. Only
  //    embedded (data:) and internal (#id) refs survive; external images
  //    simply don't import (matching the on-device,
  //    nothing-leaves-the-device stance).
  const all = svg.querySelectorAll('*');
  const scrub = (el: Element) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) { el.removeAttribute(attr.name); continue; }
      if (name === 'href' || name === 'xlink:href' || name === 'src') {
        const v = String(attr.value || '').trim();
        const safe = /^data:/i.test(v) || v.startsWith('#');
        if (!safe) el.removeAttribute(attr.name);
      }
    }
  };
  scrub(svg);
  all.forEach(scrub);

  return svg;
}

// ---------------------------------------------------------------------------
// SVG → DesignNode[]
// ---------------------------------------------------------------------------

/**
 * Mount a sanitized <svg> offscreen, walk its visual leaves, and produce DesignNodes.
 * @param {SVGSVGElement} svgEl  root svg (from sanitizeSvg or a Penpot page)
 * @param {{ host, warn, penpot?: boolean, zipFiles?: object }} opts
 */
async function svgToNodes(
  svgEl: SVGSVGElement,
  { host, warn, penpot = false, zipFiles = null }: SvgToNodesOpts,
): Promise<{ nodes: any[]; width: number; height: number }> {
  // Determine the canvas size from the viewBox (preferred - it's the true user space
  // that getCTM maps into) or fall back to width/height attributes.
  const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
  let canvasW = vb && vb.width ? vb.width : parseFloat(svgEl.getAttribute('width') as string) || 0;
  let canvasH = vb && vb.height ? vb.height : parseFloat(svgEl.getAttribute('height') as string) || 0;
  if (!canvasW || !canvasH) { canvasW = canvasW || 1080; canvasH = canvasH || 1080; }

  // Import the node so it belongs to the main document, then size + hide it. It must
  // participate in layout (visibility:hidden) for getBBox/getCTM to return real numbers.
  const mount = document.importNode(svgEl, true);
  mount.setAttribute('width', String(canvasW));
  mount.setAttribute('height', String(canvasH));
  mount.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;';
  document.body.appendChild(mount);

  const nodes: any[] = [];
  const imageCache = new Map<string, AssetRef>(); // href → AssetRef (dedupe identical images)
  // Serialize the root <defs> once, not per flattened element (they all embed the same
  // block) - avoids O(n·|defs|) re-serialization on a defs-heavy file.
  let defsCache: string | undefined;
  const defsHtml = () => (defsCache !== undefined ? defsCache : (defsCache = rootDefsHtml(mount)));
  let count = 0;      // leaf boxes emitted
  let visited = 0;    // ALL elements walked (incl. containers) - bounds a container-only DoS
  let truncated = false;

  try {
    // Depth-first, document order = paint order (back-to-front).
    const walk = async (el: Element, inherited: Inherited) => {
      // Cap BOTH leaves and total nodes: a file made of tens of thousands of nested
      // empty <g>/<svg> containers emits no leaves but would still recurse unbounded.
      if (count >= MAX_ELEMENTS || ++visited > MAX_ELEMENTS * 8) { truncated = true; return; }
      const tag = (el.tagName || '').toLowerCase();
      if (SKIP_TAGS.has(tag)) return;

      // Accumulate inherited fill + opacity from ancestor <g>s.
      const fillAttr = el.getAttribute('fill');
      const opAttr = el.getAttribute('opacity');
      const nextInherited: Inherited = {
        fill: fillAttr != null ? fillAttr : inherited.fill,
        opacity: inherited.opacity * (opAttr != null && opAttr !== '' ? clamp01(parseFloat(opAttr)) : 1),
      };

      if (tag === 'g' || tag === 'svg' || tag === 'a') {
        // Container: recurse; it draws nothing itself.
        for (const child of Array.from(el.children)) {
          await walk(child, nextInherited);
        }
        return;
      }

      count += 1;
      try {
        const node = await elementToNode(el, tag, {
          host, warn, inherited: nextInherited, imageCache,
          penpot, zipFiles, defsHtml,
        });
        if (node) nodes.push(node);
      } catch (err) {
        warn(`Skipped a <${tag}> that couldn’t be imported: ${String((err as Error) && (err as Error).message || err)}`);
      }
    };

    await walk(mount, { fill: null, opacity: 1 });
  } finally {
    mount.remove();
  }

  if (truncated) warn(`This design has a lot of elements - only the first ${MAX_ELEMENTS} were imported.`);

  return { nodes, width: Math.round(canvasW), height: Math.round(canvasH) };
}

/**
 * Map a single visual leaf element to a DesignNode (or null to skip).
 */
async function elementToNode(el: Element, tag: string, ctx: ElementCtx): Promise<any> {
  const { host, warn, inherited, imageCache, penpot, zipFiles } = ctx;

  // Geometry: local bbox → world box via the CTM. getBBox throws for a few edge cases
  // (empty text, unrenderable defs) - the caller's try/catch handles it.
  const bbox = (el as SVGGraphicsElement).getBBox();
  const ctm = (el as SVGGraphicsElement).getCTM();
  const m: Matrix = ctm ? { a: ctm.a, b: ctm.b, c: ctm.c, d: ctm.d, e: ctm.e, f: ctm.f }
                : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const geom = boxGeomFromBBox({ x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }, m);

  // Resolved element opacity (own opacity × ancestor opacity), 0..100.
  const ownOp = attrNum(el, 'opacity');
  const opacity = clamp01((ownOp == null ? 1 : ownOp) * inherited.opacity) * 100;

  // Resolve the paint. 'none'/'currentColor' → '' (no fill); gradient/pattern → flatten.
  const rawFill = firstDefined(styleProp(el, 'fill'), el.getAttribute('fill'), inherited.fill);
  const fillIsUrl = typeof rawFill === 'string' && /^url\(/i.test(rawFill.trim());

  const base = {
    x: geom.x, y: geom.y, w: geom.w, h: geom.h, rot: geom.rot,
    opacity,
  };

  // --- Penpot per-element overrides (read before we branch on kind) ---
  let penpotContent: any = null;
  if (penpot) {
    const pr = penpotAttr(el, 'rotation');
    if (pr != null && pr !== '') base.rot = parseFloat(pr) || base.rot;
    const pOp = penpotAttr(el, 'fill-opacity');
    if (pOp != null && pOp !== '') base.opacity = clamp01(parseFloat(pOp)) * 100;
    const pc = penpotAttr(el, 'content');
    if (pc) { try { penpotContent = parsePenpotContent(JSON.parse(pc)); } catch { /* ignore bad json */ } }
  }

  // ---- <image> → image box ----
  if (tag === 'image') {
    const href = el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || el.getAttribute('xlink:href');
    const ref = href ? await storeImage(host, href, imageCache, warn) : null;
    if (ref) {
      // Store the WHOLE AssetRef (with its object URL) - see design-map.nodeToBox: setInput
      // does not re-resolve, so an id-only ref would render as a broken image.
      return { kind: 'image', ...base, image: ref, fit: 'cover' };
    }
    // Couldn't store - degrade to a plain placeholder box rather than dropping it.
    return { kind: 'box', ...base, fill: '' };
  }

  // ---- Penpot fill-image-id → embedded raster in the zip ----
  if (penpot) {
    const imgId = penpotAttr(el, 'fill-image-id');
    if (imgId && zipFiles) {
      const ref = await storeZipImage(host, zipFiles, imgId, imageCache, warn);
      if (ref) return { kind: 'image', ...base, image: ref, fit: 'cover' };
    }
  }

  // ---- <text> / tspan → text box ----
  if (tag === 'text') {
    const info = penpotContent || readTextContent(el);
    const penFill = penpot ? penpotAttr(el, 'fill-color') : null;
    return {
      kind: 'text',
      ...base,
      text: info.text || '',
      fg: safeColor(info.fg || penFill || styleProp(el, 'fill') || el.getAttribute('fill') || inherited.fill || '#000000', '#000000'),
      fontSize: info.fontSize || attrNum(el, 'font-size') || parseFloat(styleProp(el, 'font-size')) || 16,
      fontWeight: info.fontWeight || el.getAttribute('font-weight') || styleProp(el, 'font-weight') || '400',
      fontFamily: info.fontFamily || el.getAttribute('font-family') || styleProp(el, 'font-family') || '',
      textAlign: info.textAlign || anchorToAlign(styleProp(el, 'text-anchor') || el.getAttribute('text-anchor')),
      lineHeight: info.lineHeight || 1.2,
    };
  }

  // ---- Vector fills we can't model cleanly → flatten to an embedded image ----
  // <path> (arbitrary geometry) and any gradient/pattern/image url(#…) fill lose
  // fidelity as a plain rectangle, so we rasterise/embed them as an SVG snippet.
  if (tag === 'path' || tag === 'polygon' || tag === 'polyline' || tag === 'line' || fillIsUrl) {
    const ref = await flattenToImage(el, m, ctx);
    if (ref) {
      // The flattened SVG already bakes in the element's transform, so the image box
      // is an axis-aligned world rect with no extra rotation.
      const wb = worldBBox(bbox, m);
      return { kind: 'image', x: wb.x, y: wb.y, w: wb.w, h: wb.h, rot: 0, opacity: base.opacity, image: ref, fit: 'fill' };
    }
    // Flatten failed → approximate as a solid box using the element's fill.
    return { kind: 'box', ...base, fill: colorOrEmpty(rawFill) };
  }

  // ---- Simple shapes → box ----
  const penFill = penpot ? penpotAttr(el, 'fill-color') : null;
  const node: any = { kind: 'box', ...base, fill: colorOrEmpty(penFill || rawFill) };

  if (tag === 'circle' || tag === 'ellipse') {
    node.shape = 'ellipse';
  } else if (tag === 'rect') {
    const rx = attrNum(el, 'rx') || attrNum(el, 'ry') || 0;
    const pr1 = penpot ? penpotAttr(el, 'r1') : null;
    const radius = (pr1 != null && pr1 !== '') ? parseFloat(pr1) : rx;
    if (radius > 0) { node.shape = 'rounded'; node.radius = radius; }
  }
  return node;
}

// ---------------------------------------------------------------------------
// Flatten-to-image fallback
// ---------------------------------------------------------------------------

/**
 * Render one element (with its gradients/clipPaths) into a standalone SVG whose viewBox
 * is the element's WORLD bounding box, store it as a user asset, and return the AssetRef.
 * The element's own transform is stripped and re-applied via a wrapping <g matrix(CTM)>
 * so it lands at the same world coordinates as the viewBox.
 */
async function flattenToImage(el: Element, m: Matrix, ctx: ElementCtx): Promise<AssetRef | null> {
  const { host, warn, imageCache, defsHtml } = ctx;
  try {
    const bbox = (el as SVGGraphicsElement).getBBox();
    const wb = worldBBox(bbox, m);
    if (wb.w < 1 || wb.h < 1) return null;

    const clone = el.cloneNode(true) as SVGElement;
    clone.removeAttribute('transform'); // its transform is re-expressed by the wrapping <g>
    // The image box re-applies the element's own opacity (base.opacity), so strip it from
    // the embedded snippet to avoid squaring it. fill-opacity is paint (not in base) - keep.
    clone.removeAttribute('opacity');
    if (clone.style) clone.style.removeProperty('opacity');

    const defs = defsHtml ? defsHtml() : '';
    const matrix = `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `viewBox="${wb.x} ${wb.y} ${wb.w} ${wb.h}" width="${wb.w}" height="${wb.h}">` +
      (defs ? `<defs>${defs}</defs>` : '') +
      `<g transform="${matrix}">${new XMLSerializer().serializeToString(clone)}</g>` +
      `</svg>`;

    // Dedupe identical snippets (e.g. a repeated icon) by their serialized bytes.
    const key = 'flat:' + svg;
    if (imageCache.has(key)) return imageCache.get(key)!;

    const fileName = `import-${Date.now()}-${imageCache.size}.svg`;
    const file = new File([svg], fileName, { type: 'image/svg+xml' });
    // storeUserUpload re-sanitizes the SVG (DOMPurify) on ingest - second line of defence.
    const ref = await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], file);
    imageCache.set(key, ref);
    return ref;
  } catch (err) {
    warn(`Couldn’t embed a vector element (${String((err as Error) && (err as Error).message || err)}); using a flat colour instead.`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Image storage
// ---------------------------------------------------------------------------

/**
 * Store an <image> href (data: URI or external URL) as a user asset, deduped by href.
 * Returns the AssetRef or null on failure (caller degrades gracefully).
 */
async function storeImage(host: HostV1 | undefined, href: string, imageCache: Map<string, AssetRef>, warn: (msg: string) => void): Promise<AssetRef | null> {
  if (imageCache.has(href)) return imageCache.get(href)!;
  // Defence-in-depth: only embedded (data:) images are imported. sanitizeSvg already
  // strips external hrefs before the mount, but never fetch an off-device URL from an
  // untrusted design file (privacy / SSRF).
  if (!/^data:/i.test(String(href).trim())) {
    warn('Skipped an external image - only images embedded in the design are imported.');
    return null;
  }
  try {
    const resp = await fetch(href);
    const blob = await resp.blob();
    const type = blob.type || 'image/png';
    const ext = extFromType(type);
    const file = new File([blob], `import-${Date.now()}-${imageCache.size}.${ext}`, { type });
    const ref = await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], file);
    imageCache.set(href, ref);
    return ref;
  } catch (err) {
    warn(`Couldn’t import an image (${String((err as Error) && (err as Error).message || err)}).`);
    return null;
  }
}

/**
 * Store a Penpot embedded image (looked up in the zip by its asset id).
 */
async function storeZipImage(host: HostV1 | undefined, zipFiles: Record<string, Uint8Array>, imgId: string, imageCache: Map<string, AssetRef>, warn: (msg: string) => void): Promise<AssetRef | null> {
  const cacheKey = 'zip:' + imgId;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey)!;
  try {
    // Penpot stores media under a path containing the asset id.
    const path = Object.keys(zipFiles).find((p) => p.includes(imgId) && /\.(png|jpe?g|webp|gif|svg)$/i.test(p));
    if (!path) return null;
    const bytes = zipFiles[path]!;
    const ext = (path.split('.').pop() || 'png').toLowerCase();
    const type = typeFromExt(ext);
    const file = new File([bytes as BlobPart], `penpot-${imgId}.${ext}`, { type });
    const ref = await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], file);
    imageCache.set(cacheKey, ref);
    return ref;
  } catch (err) {
    warn(`Couldn’t import a Penpot image (${String((err as Error) && (err as Error).message || err)}).`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Penpot ZIP
// ---------------------------------------------------------------------------

async function parsePenpotZip(files: Record<string, Uint8Array>, { host, warn, interactive, map }: { host: HostV1 | undefined; warn: (msg: string) => void; interactive?: boolean; map?: DesignMapOptions }): Promise<DesignImportResult> {
  // The current Penpot `.penpot` export (binfile-v3) is a ZIP of per-shape JSON - no
  // page SVGs. Detect it by its manifest and shape-file layout and parse the JSON.
  const manifest = files['manifest.json'] ? safeJsonParse(strFromU8(files['manifest.json'])) : null;
  const isExportFiles = manifest && typeof manifest.type === 'string' && /export-files/.test(manifest.type);
  const hasShapeJson = Object.keys(files).some((p) => /\/pages\/[^/]+\/[^/]+\.json$/i.test(p));
  if (isExportFiles && hasShapeJson) {
    return parsePenpotBinfile(files, manifest, { host, warn, interactive, map });
  }

  // Legacy path: the standard SVG export (a ZIP of page SVGs with penpot: metadata),
  // or a plain SVG zipped up. Overlay every page onto one canvas.
  const svgPaths = Object.keys(files).filter((p) => /\.svg$/i.test(p) && !/[/\\]$/.test(p));
  if (svgPaths.length) {
    const allNodes: any[] = [];
    let width = 0, height = 0;
    for (const path of svgPaths.sort()) {
      let svgText: string;
      try { svgText = strFromU8(files[path]!); }
      catch { warn(`Skipped a Penpot page that wasn’t text (${path}).`); continue; }
      const svgEl = sanitizeSvg(svgText);
      if (!svgEl) { warn(`Skipped an unreadable Penpot page (${path}).`); continue; }
      const { nodes, width: w, height: h } = await svgToNodes(svgEl, { host, warn, penpot: true, zipFiles: files });
      allNodes.push(...nodes);
      width = Math.max(width, w); height = Math.max(height, h);
    }
    if (!allNodes.length) throw new Error('This Penpot file didn’t contain any importable pages.');
    return { boxes: finalizeBoxes(allNodes, map), width: width || 1080, height: height || 1080, background: '#ffffff' };
  }

  throw new Error('Could not read this Penpot file. In Penpot use “Export as .penpot” (or export the board as SVG) and import that.');
}

// Parse a Penpot binfile-v3 export (ZIP of per-shape JSON). Geometry is authoritative
// data (selrect + rotation), so the pure engine mapper (penpotShapeToNode) does the
// shape→box work; here we only walk the file structure, order shapes, load embedded
// media, and frame the result.
async function parsePenpotBinfile(files: Record<string, Uint8Array>, manifest: any, { host, warn, interactive, map }: { host: HostV1 | undefined; warn: (msg: string) => void; interactive?: boolean; map?: DesignMapOptions }): Promise<DesignImportResult> {
  const fileId = Array.isArray(manifest.files) && manifest.files[0] ? manifest.files[0].id : null;
  if (!fileId) throw new Error('This Penpot file has no importable file.');

  // Group shape JSONs by page: files/<fid>/pages/<pid>/<shapeid>.json
  const pageDir = `files/${fileId}/pages/`;
  const pageShapes = new Map<string, string[]>();
  for (const path of Object.keys(files)) {
    if (!path.startsWith(pageDir)) continue;
    const m = path.slice(pageDir.length).match(/^([^/]+)\/([^/]+)\.json$/i);
    if (m) { if (!pageShapes.has(m[1]!)) pageShapes.set(m[1]!, []); pageShapes.get(m[1]!)!.push(path); }
  }
  if (!pageShapes.size) throw new Error('This Penpot file has no pages to import.');

  // Make the deck's own font families resolvable BEFORE any box mapping, so
  // finalizeBoxes passes them through instead of bucketing.
  map = await ensurePenpotDeckFonts(files, pageDir, { host, warn, interactive, map });

  // Import the first page (by declared index).
  const pageIndex = (pid: string) => {
    const meta = files[`${pageDir}${pid}.json`] ? safeJsonParse(strFromU8(files[`${pageDir}${pid}.json`]!)) : null;
    return meta && Number.isFinite(meta.index) ? meta.index : 0;
  };
  const pageIds = [...pageShapes.keys()].sort((a, b) => pageIndex(a) - pageIndex(b));
  const pageId = pageIds[0]!;
  if (pageIds.length > 1) warn(`Imported the first of ${pageIds.length} pages.`);

  const shapesById: Record<string, any> = {};
  for (const path of pageShapes.get(pageId)!) {
    const shape = safeJsonParse(strFromU8(files[path]!));
    if (shape && shape.id) shapesById[shape.id] = shape;
  }

  const imageCache = new Map<string, AssetRef>();
  const nodes = await penpotItemsToNodes(orderPenpotShapes(shapesById), { host, files, fileId, imageCache, warn });
  if (!nodes.length) throw new Error('This Penpot file has no importable shapes on its first page.');

  const { width, height } = shiftToOrigin(nodes);
  return { boxes: finalizeBoxes(nodes, map), width, height, background: '#ffffff', map };
}

function safeJsonParse(text: string): any {
  try { return JSON.parse(text); } catch { return null; }
}

// Make a Penpot deck's own font families resolvable before any box mapping.
// Walks every page-shape JSON under pageDir, tallies the fonts its text shapes
// use (engine collectPenpotFontUsage - the gfont- provider knowledge lives HERE,
// not in the engine), and for each family not already known: a Google-sourced
// family (`gfont-` fontId) is fetched once and kept on-device (interactive
// sessions only - the established add-a-font pattern, never as the primary), and
// a bundled/custom family warns and stays bucketed to the brand default (no
// fetch: the css2 probe ladder is doomed and slow for non-Google ids). Returns
// the map with fonts.knownFamilies extended, for EVERY subsequent finalizeBoxes.
async function ensurePenpotDeckFonts(
  files: Record<string, Uint8Array>, pageDir: string,
  { host, warn, interactive, map }: {
    host: HostV1 | undefined; warn: (msg: string) => void; interactive?: boolean; map?: DesignMapOptions;
  },
): Promise<DesignMapOptions> {
  const usage = new Map<string, { google: boolean; weights: Set<number> }>();
  for (const path of Object.keys(files)) {
    if (!path.startsWith(pageDir) || !/\.json$/i.test(path)) continue;
    const shape = safeJsonParse(strFromU8(files[path]!));
    if (!shape || String(shape.type || '') !== 'text' || !shape.content) continue;
    for (const u of collectPenpotFontUsage(shape.content)) {
      if (!u.fontFamily) continue;
      let e = usage.get(u.fontFamily);
      if (!e) { e = { google: false, weights: new Set() }; usage.set(u.fontFamily, e); }
      if (u.fontId.startsWith('gfont-')) e.google = true;
      e.weights.add(u.fontWeight);
    }
  }
  const knownFamilies = [...(map?.fonts?.knownFamilies ?? [])];
  const isKnown = (family: string): boolean =>
    knownFamilies.some((k) => k.toLowerCase() === family.toLowerCase());
  let installed = false;
  for (const [family, info] of usage) {
    if (isKnown(family)) continue;
    if (info.google && interactive && host) {
      try {
        const fam = await installGoogleFont(host as unknown as UserFontsHost, family, { neverPrimary: true });
        knownFamilies.push(fam.family);
        installed = true;
        warn(`Added “${fam.family}” from Google Fonts to your kit (used by this file).`);
      } catch {
        warn(`Couldn’t fetch “${family}”. Substituted the brand font.`);
      }
    } else if (!info.google) {
      warn(`This file uses “${family}”, which isn’t included in the export. Substituted the brand font.`);
    }
  }
  // installGoogleFont doesn't bust the vector-export font registry itself (only
  // removeUserFont does) - bust once after the batch so a later export
  // re-resolves the freshly installed faces.
  if (installed) bustFontRegistry();
  return { ...map, fonts: { ...map?.fonts, knownFamilies } };
}

// A group subtree flattened to one SVG asset by penpotGroupToSvg - the walks emit
// this marker instead of the group's shapes, and penpotItemsToNodes stores + places it.
interface PenpotVectorGroupItem { __vectorGroupSvg: string; shape: any; }

// Mark a whole subtree consumed so a flattened group's shapes never double-paint
// (and the orphan sweep can't revisit them).
function markPenpotSubtreeSeen(shapesById: Record<string, any>, id: string, seen: Set<string>): void {
  if (seen.has(id)) return;
  seen.add(id);
  const s = shapesById[id];
  for (const k of (s && Array.isArray(s.shapes) ? s.shapes : [])) markPenpotSubtreeSeen(shapesById, String(k), seen);
}

// Try to flatten a `group` subtree into one vector-group marker; null → walk per-shape.
// A `bool`'s `content` already carries the resolved boolean outline, so its operand
// children are consumed (marked seen), never painted separately.
function penpotFlattenStep(shapesById: Record<string, any>, s: any, seen: Set<string>): PenpotVectorGroupItem | null {
  if (String(s.type || '') !== 'group') return null;
  const svg = penpotGroupToSvg(s, (cid: string) => shapesById[cid]);
  if (!svg) return null;
  for (const k of (Array.isArray(s.shapes) ? s.shapes : [])) markPenpotSubtreeSeen(shapesById, String(k), seen);
  return { __vectorGroupSvg: svg, shape: s };
}

// DFS from the root frame following each container's `shapes` array (paint order,
// back-to-front); append any unreachable orphans in map order. penpotShapeToNode drops
// the root frame itself, so it just seeds the order. A `hidden` shape hides its whole
// subtree in Penpot - importing it visible was a fidelity bug, so it prunes here.
// (`hideInViewer` is NOT pruned on this path: it's visible in Penpot's editor, and
// this import feeds an editor.) All-vector groups collapse to one flatten marker.
function orderPenpotShapes(shapesById: Record<string, any>): any[] {
  const out: any[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    const s = shapesById[id];
    if (!s || seen.has(id) || s.hidden === true) return;
    seen.add(id);
    const flat = penpotFlattenStep(shapesById, s, seen);
    if (flat) { out.push(flat); return; }
    out.push(s);
    if (String(s.type || '') === 'bool' && typeof s.content === 'string' && s.content) {
      for (const k of (Array.isArray(s.shapes) ? s.shapes : [])) markPenpotSubtreeSeen(shapesById, String(k), seen);
      return;
    }
    const kids = Array.isArray(s.shapes) ? s.shapes : [];
    for (const k of kids) visit(k);
  };
  visit('00000000-0000-0000-0000-000000000000');
  for (const id of Object.keys(shapesById)) visit(id);
  return out;
}

// Store one flattened vector-group SVG, deduped by its serialized markup (identical
// component instances at identical page positions collapse to one stored asset).
async function storePenpotVectorSvg(host: HostV1 | undefined, svg: string, cache: Map<string, AssetRef>, warn: (msg: string) => void): Promise<AssetRef | null> {
  const key = 'ppvec:' + svg;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const file = new File([svg], `penpot-vector-${cache.size}.svg`, { type: 'image/svg+xml' });
    const ref = await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], file);
    cache.set(key, ref);
    return ref;
  } catch (err) {
    warn(`Couldn’t import a Penpot vector group (${String((err as Error) && (err as Error).message || err)}).`);
    return null;
  }
}

// Resolve an ordered walk (shapes + vector-group markers) to DesignNodes - the ONE
// Penpot item→node path, shared by the single-page import and the scenes walk so the
// two can't drift. Handles image fills (_fillImageId), per-shape vector bakes
// (_vectorPath, mirroring the Figma resolveFigMedia call), and flattened groups.
async function penpotItemsToNodes(
  items: any[],
  { host, files, fileId, imageCache, warn, srcIds }: {
    host: HostV1 | undefined; files: Record<string, Uint8Array>; fileId: string;
    imageCache: Map<string, AssetRef>; warn: (msg: string) => void;
    /** Optional out-param: the source shape id of every node pushed, in step with
     *  the returned array. Items that produce no node contribute nothing, so the
     *  two stay aligned - that is what lets the template pass map a component's
     *  slots back to the boxes they end up as (see parseDesignTemplates). */
    srcIds?: string[];
  },
): Promise<any[]> {
  const nodes: any[] = [];
  let warnedBgBlur = false;
  // One copy for both drop sites, so the batch can only ever say this once.
  const BG_BLUR_WARN = 'Background blur on text and grouped art isn’t supported yet. Those shapes imported without it.';
  let warnedDash = false;
  for (const item of items) {
    // A rectangle/ellipse imports its stroke as a CSS border, and CSS has no way to say
    // "8px dash, 3px gap" - only the dashed keyword. Path boxes keep the exact numbers
    // (they stroke a real SVG path), so the warning names where the loss happens.
    if (!warnedDash && item && !/^(path|bool|group)$/.test(String(item.type || ''))
      && Array.isArray(item.strokes)
      && item.strokes.some((s: any) => s && String(s.strokeStyle || '') === 'dashed'
        && ((s.strokeDash != null && Number.isFinite(+s.strokeDash))
          || (s.strokeGap != null && Number.isFinite(+s.strokeGap))))) {
      warnedDash = true;
      warn('Custom dash patterns are approximated on rectangle borders.');
    }
    if (item && (item as PenpotVectorGroupItem).__vectorGroupSvg) {
      const { __vectorGroupSvg: svg, shape: g } = item as PenpotVectorGroupItem;
      // A flattened group is one baked SVG asset, so a background blur on the group
      // itself has nowhere to land (the per-shape route keeps it; this one can't).
      if (penpotBackgroundBlurPx(g) > 0 && !warnedBgBlur) {
        warnedBgBlur = true;
        warn(BG_BLUR_WARN);
      }
      const ref = await storePenpotVectorSvg(host, svg, imageCache, warn);
      if (!ref) continue; // storage failed → the group is dropped (children were consumed)
      const sel = (g.selrect && typeof g.selrect === 'object') ? g.selrect : g;
      const op = Number.isFinite(+g.opacity) ? Math.min(1, Math.max(0, +g.opacity)) : 1;
      nodes.push({
        // fill:'' - the flattened SVG is transparent outside its art; no seed backing.
        kind: 'image', image: ref, fit: 'fill', fill: '',
        x: Number(sel.x) || 0, y: Number(sel.y) || 0,
        w: Number(sel.width) || 1, h: Number(sel.height) || 1,
        rot: Number(g.rotation) || 0,
        opacity: Math.round(op * 100),
        // ROOT-group layer blur rides the image box (like root opacity); leaf blurs
        // are already baked inside the flattened SVG as feGaussianBlur defs.
        ...(g.blur?.type === 'layer-blur' && g.blur.hidden !== true && Number(g.blur.value) > 0
          ? { blur: Number(g.blur.value) } : {}),
      });
      srcIds?.push(String(g.id ?? ''));
      continue;
    }
    let node: any = null;
    try { node = penpotShapeToNode(item); } catch { node = null; }
    if (!node) continue;
    // Background blur survives on the kinds whose painted region IS the box rect
    // (plain boxes and image fills), where it becomes the `bgBlur` field. Text shapes
    // (Penpot masks the blur to the glyphs) and baked vector art drop it - warn once
    // per import batch so the loss is never silent.
    if (!(node.bgBlur > 0) && penpotBackgroundBlurPx(item) > 0 && !warnedBgBlur) {
      warnedBgBlur = true;
      warn(BG_BLUR_WARN);
    }
    if (node._fillImageId) {
      const ref = await loadPenpotMedia(host, files, fileId, node._fillImageId, imageCache, warn, node._fillFlip);
      if (ref) node.image = ref; else node.kind = 'box';
      delete node._fillImageId;
      delete node._fillFlip;
    } else if (node._vectorPath) {
      const ref = await storeFigVector(host, node._vectorPath, node._vectorFill, node._vectorStroke, node._vectorSize, imageCache, warn, node._vectorGradient);
      if (ref) node.image = ref;
      else { node.kind = 'box'; node.fill = (node._vectorFill && node._vectorFill !== 'none') ? node._vectorFill : ''; }
      delete node._vectorPath; delete node._vectorFill; delete node._vectorStroke; delete node._vectorSize; delete node._vectorGradient;
    }
    nodes.push(node);
    srcIds?.push(String(item?.id ?? ''));
  }
  return nodes;
}

// Resolve a Penpot image fill to bytes and store it: fillImage.id → the media meta json
// (→ mediaId + mtype) → the binary blob under objects/. `flip` ('x'|'y'|'xy', the
// mapper's _fillFlip marker) mirrors the PIXELS before storage - boxes have no mirror
// field, so a flipped fill must bake its flip into the stored asset. Returns a full
// AssetRef or null.
async function loadPenpotMedia(host: HostV1 | undefined, files: Record<string, Uint8Array>, fileId: string, fillImageId: string, cache: Map<string, AssetRef>, warn: (msg: string) => void, flip?: string): Promise<AssetRef | null> {
  const key = 'ppmedia:' + fillImageId + (flip ? `:${flip}` : '');
  if (cache.has(key)) return cache.get(key)!;
  try {
    let mediaId = fillImageId, mtype = 'image/png';
    const metaPath = `files/${fileId}/media/${fillImageId}.json`;
    if (files[metaPath]) {
      const meta = safeJsonParse(strFromU8(files[metaPath]!));
      if (meta) { mediaId = meta.mediaId || meta.id || mediaId; mtype = meta.mtype || mtype; }
    }
    const objPath = Object.keys(files).find((p) => p.startsWith(`objects/${mediaId}.`) && !/\.json$/i.test(p));
    if (!objPath) { warn('Couldn’t find an embedded Penpot image.'); return null; }
    const ext = (objPath.split('.').pop() || 'png').toLowerCase();
    let file = new File([files[objPath]! as BlobPart], `penpot-${mediaId}.${ext}`, { type: mtype });
    if (flip) {
      try {
        const bmp = await createImageBitmap(file);
        const canvas = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = canvas.getContext('2d')!;
        ctx.translate(flip.includes('x') ? bmp.width : 0, flip.includes('y') ? bmp.height : 0);
        ctx.scale(flip.includes('x') ? -1 : 1, flip.includes('y') ? -1 : 1);
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        file = new File([blob], `penpot-${mediaId}-flip${flip}.png`, { type: 'image/png' });
      } catch {
        // Undecodable bytes (or no 2d context): keep the unmirrored original.
        warn('Couldn’t mirror a flipped Penpot image, so it was imported unmirrored.');
      }
    }
    const ref = await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], file);
    cache.set(key, ref);
    return ref;
  } catch (err) {
    warn(`Couldn’t import a Penpot image (${String((err as Error) && (err as Error).message || err)}).`);
    return null;
  }
}

// Translate all nodes so the union of their rects starts at (0,0); return the canvas
// size. (Penpot shape coords are absolute page coords - a board rarely sits at origin.)
function shiftToOrigin(nodes: any[]): { width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
  }
  if (!isFinite(minX)) return { width: 1080, height: 1080 };
  for (const n of nodes) { n.x -= minX; n.y -= minY; }
  return { width: Math.max(1, Math.round(maxX - minX)), height: Math.max(1, Math.round(maxY - minY)) };
}

// ---------------------------------------------------------------------------
// Figma .fig (Kiwi binary)
// ---------------------------------------------------------------------------

// A .fig is a ZIP { canvas.fig, images/<hash>, thumbnail.png, meta.json }. canvas.fig is:
//   "fig-kiwi"(8) | version u32le(4) | schemaLen u32le | schema(deflate-raw) | dataLen u32le | data(zstd)
// The Kiwi schema is embedded (self-describing) so it decodes any file version - but Figma
// calls the format an unstable internal detail, so this may break on future format changes.
async function parseFig(files: Record<string, Uint8Array>, { host, warn, map }: { host: HostV1 | undefined; warn: (msg: string) => void; map?: DesignMapOptions }): Promise<DesignImportResult> {
  const canvasFig = files['canvas.fig'];
  if (!canvasFig || !canvasFig.length) throw new Error('This .fig has no canvas data.');
  let doc: any;
  try { doc = await decodeCanvasFig(canvasFig); }
  catch (err) {
    throw new Error('Couldn’t read this .fig - Figma may have changed its file format. Try exporting the frame as SVG instead. (' + String((err as Error) && (err as Error).message || err) + ')');
  }
  const nodeChanges = doc && doc.nodeChanges;
  if (!Array.isArray(nodeChanges) || !nodeChanges.length) throw new Error('This .fig contained no nodes.');

  const nodes = figmaNodesToNodes(nodeChanges, doc.blobs);
  if (!nodes.length) throw new Error('This .fig has no visible shapes on its first page.');

  // Resolve image fills (images/<hash>) and reconstructed vector paths into asset refs.
  await resolveFigMedia(host, files, nodes, new Map<string, AssetRef>(), warn);

  const { width, height } = shiftToOrigin(nodes);
  return { boxes: finalizeBoxes(nodes, { prefix: 'f', ...map }), width, height, background: '#ffffff' };
}

// Resolve a node list's private media placeholders (_imageHash from image fills,
// _vectorPath from reconstructed VECTOR outlines) into stored user-asset refs.
// Shared by the single-canvas import (parseFig) and the per-frame scenes walk;
// `imageCache` dedupes identical media across every caller-scoped batch.
async function resolveFigMedia(host: HostV1 | undefined, files: Record<string, Uint8Array>, nodes: any[], imageCache: Map<string, AssetRef>, warn: (msg: string) => void): Promise<void> {
  for (const n of nodes) {
    if (n._vectorPath) {
      const ref = await storeFigVector(host, n._vectorPath, n._vectorFill, n._vectorStroke, n._vectorSize, imageCache, warn);
      if (ref) n.image = ref; else { n.kind = 'box'; n.fill = (n._vectorFill && n._vectorFill !== 'none') ? n._vectorFill : ''; }
      delete n._vectorPath; delete n._vectorFill; delete n._vectorStroke; delete n._vectorSize;
    } else if (n._imageHash) {
      const ref = await loadFigImage(host, files, n._imageHash, imageCache, warn);
      if (ref) n.image = ref; else n.kind = 'box';
      delete n._imageHash;
    }
  }
}

async function decodeCanvasFig(bytes: Uint8Array): Promise<any> {
  const magic = new TextDecoder('latin1').decode(bytes.slice(0, 8));
  if (magic !== 'fig-kiwi') throw new Error('not a fig-kiwi file');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = 12; // "fig-kiwi"(8) + version u32(4)
  if (off + 4 > bytes.length) throw new Error('truncated fig-kiwi header');
  const schemaLen = dv.getUint32(off, true); off += 4;
  if (off + schemaLen + 4 > bytes.length) throw new Error('fig-kiwi schema overruns the file');
  const schemaComp = bytes.subarray(off, off + schemaLen); off += schemaLen;
  const dataLen = dv.getUint32(off, true); off += 4;
  if (off + dataLen > bytes.length) throw new Error('fig-kiwi data overruns the file');
  const dataComp = bytes.subarray(off, off + dataLen);

  const schema = await inflateRawBytes(schemaComp, MAX_FIG_SCHEMA_BYTES); // raw DEFLATE (native)
  const data = zstdCapped(dataComp, MAX_FIG_DATA_BYTES);                  // zstd (fzstd)
  const compiled = compileSchema(decodeBinarySchema(schema));
  return compiled.decodeMessage(data);              // Figma's root type is "Message"
}

// Raw DEFLATE via the browser's native DecompressionStream (same primitive - and
// same chunked output cap - url-pack uses: the bomb is stopped at ~cap instead of
// its full expansion being allocated first).
async function inflateRawBytes(bytes: Uint8Array, cap: number): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter();
  w.write(bytes as Uint8Array<ArrayBuffer>).catch(() => {});
  w.close().catch(() => {});
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > cap) throw new Error('fig-kiwi schema expands too large');
      chunks.push(value);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

// Streamed zstd with an output cap - fzstd's one-shot decompress() trusts the
// frame's declared content size, which a hostile file controls.
function zstdCapped(bytes: Uint8Array, cap: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const d = new ZstdDecompress((chunk) => {
    total += chunk.length;
    if (total > cap) throw new Error('fig-kiwi data expands too large');
    chunks.push(chunk);
  });
  d.push(bytes, true);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

// Store a Figma image blob (images/<hash>, extension-less - sniff the type) as a user asset.
async function loadFigImage(host: HostV1 | undefined, files: Record<string, Uint8Array>, hash: string | null, cache: Map<string, AssetRef>, warn: (msg: string) => void): Promise<AssetRef | null> {
  if (!hash) return null;
  if (cache.has(hash)) return cache.get(hash)!;
  try {
    const path = Object.keys(files).find((p) => p === 'images/' + hash || p.startsWith('images/' + hash));
    if (!path || !files[path] || !files[path]!.length) return null;
    const bytes = files[path]!;
    const mime = sniffImageMime(bytes);
    const ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const file = new File([bytes as BlobPart], `fig-${String(hash).slice(0, 12)}.${ext}`, { type: mime });
    const ref = await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], file);
    cache.set(hash, ref);
    return ref;
  } catch (err) {
    warn(`Couldn’t import a Figma image (${String((err as Error) && (err as Error).message || err)}).`);
    return null;
  }
}

// Rasterise a reconstructed vector path into a standalone SVG image asset, placed at
// the node's rect. The viewBox honours an optional `size.x/y` origin - Figma vectors
// are shape-local (0 0), Penpot path coords are absolute page space (selrect origin).
// A Penpot `fillColorGradient` bakes as a native SVG gradient def (never the Lolly
// grad-spec route); stroke alignment is approximated as centre (SVG has no inner/outer).
// storeUserUpload re-sanitises the SVG.
async function storeFigVector(host: HostV1 | undefined, d: any, fill: any, stroke: any, size: any, cache: Map<string, AssetRef>, warn: (msg: string) => void, gradient?: any): Promise<AssetRef | null> {
  try {
    const w = Math.max(1, Math.round((size && size.w) || 1));
    const h = Math.max(1, Math.round((size && size.h) || 1));
    const ox = (size && Number.isFinite(+size.x)) ? +size.x : 0;
    const oy = (size && Number.isFinite(+size.y)) ? +size.y : 0;
    const hex = (v: string, dflt: string): string => (/^#[0-9a-fA-F]{3,8}$/.test(v || '') ? v : dflt);
    const gradDef = gradient ? penpotGradientSvgDef(gradient, 'pg0', 1) : '';
    const fillAttr = gradDef ? 'url(#pg0)' : (fill === 'none') ? 'none' : hex(fill, '#000000');
    const strokeOp = (stroke && stroke.opacity != null && +stroke.opacity < 1) ? ` stroke-opacity="${+stroke.opacity}"` : '';
    // Dash decoration (Penpot only; Figma callers pass no `style` and are unchanged).
    // penpotDashArray is the engine's single copy of Penpot's calculate-dasharray, so a
    // path leaf baked here and a leaf baked by penpotGroupToSvg agree exactly. Both
    // values are numbers the helper rounds, so nothing user-typed reaches the attribute.
    const strokeW = Math.max(0.1, +stroke?.width || 1);
    const dashArr = stroke && stroke.style
      ? penpotDashArray(String(stroke.style), strokeW, stroke.dash, stroke.gap) : '';
    const capRaw = String((stroke && (stroke.capStart ?? stroke.capEnd)) ?? '');
    const cap = (capRaw === 'butt' || capRaw === 'round' || capRaw === 'square')
      ? capRaw : (stroke && stroke.style === 'dotted' ? 'round' : '');
    const strokeAttr = (stroke && stroke.color)
      ? ` stroke="${hex(stroke.color, '#000000')}" stroke-width="${strokeW}"${strokeOp}`
        + (dashArr ? ` stroke-dasharray="${dashArr}"` : '')
        + (cap ? ` stroke-linecap="${cap}"` : '') : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ox} ${oy} ${w} ${h}" width="${w}" height="${h}">` +
      (gradDef ? `<defs>${gradDef}</defs>` : '') +
      `<path d="${String(d).replace(/"/g, '')}" fill="${fillAttr}"${strokeAttr}/></svg>`;
    if (cache.has('figvec:' + svg)) return cache.get('figvec:' + svg)!;
    const file = new File([svg], `fig-vector-${cache.size}.svg`, { type: 'image/svg+xml' });
    const ref = await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], file);
    cache.set('figvec:' + svg, ref);
    return ref;
  } catch (err) {
    warn(`Couldn’t import a Figma vector (${String((err as Error) && (err as Error).message || err)}).`);
    return null;
  }
}

function sniffImageMime(b: Uint8Array): string {
  if (!b || b.length < 4) return 'image/png';
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  return 'image/png';
}

// ---------------------------------------------------------------------------
// Unpack reader (.fig → PdfHandle)
// ---------------------------------------------------------------------------
// The mushiest format: the Kiwi schema is reverse-engineered and Figma calls it an
// unstable internal detail, so anything a node does not cleanly map to is COUNTED
// and skipped, never guessed.

const FIG_XML_ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const figEsc = (s: string): string => String(s).replace(/[&<>"]/g, (c) => FIG_XML_ESC[c]!);

function figB64(u8: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) bin += String.fromCharCode(...u8.subarray(i, i + CHUNK));
  return btoa(bin);
}

function figNamesOnlyFont(family: string): EmbeddedFont {
  return {
    name: family, family, ext: 'ttf', bytes: new Uint8Array(0),
    subset: false, installable: false,
    embedding: { permission: 'unknown', noSubsetting: false, bitmapOnly: false, fsType: null },
  };
}

/** A reconstructed vector node as a standalone SVG string (the storeFigVector body,
 *  minus the catalogue store - Unpack hands back bytes, not an asset ref). */
function figVectorSvg(d: any, fill: any, stroke: any, size: any, gradient?: any): string {
  const w = Math.max(1, Math.round((size && size.w) || 1));
  const h = Math.max(1, Math.round((size && size.h) || 1));
  const ox = (size && Number.isFinite(+size.x)) ? +size.x : 0;
  const oy = (size && Number.isFinite(+size.y)) ? +size.y : 0;
  const hex = (v: string, dflt: string): string => (/^#[0-9a-fA-F]{3,8}$/.test(v || '') ? v : dflt);
  const gradDef = gradient ? penpotGradientSvgDef(gradient, 'pg0', 1) : '';
  const fillAttr = gradDef ? 'url(#pg0)' : (fill === 'none') ? 'none' : hex(fill, '#000000');
  const strokeW = Math.max(0.1, +stroke?.width || 1);
  const strokeAttr = (stroke && stroke.color) ? ` stroke="${hex(stroke.color, '#000000')}" stroke-width="${strokeW}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ox} ${oy} ${w} ${h}" width="${w}" height="${h}">`
    + (gradDef ? `<defs>${gradDef}</defs>` : '')
    + `<path d="${String(d).replace(/"/g, '')}" fill="${fillAttr}"${strokeAttr}/></svg>`;
}

/** Push a node's paint colours (box fill, text ink, vector fill/stroke) into `out`. */
function figNodeColors(n: any, seen: Set<string>, out: string[]): void {
  const add = (v: unknown): void => {
    const hex = safeColor(String(v ?? ''), '');
    if (!hex) return;
    const key = hex.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(hex);
  };
  add(n.fill); add(n.fg); add(n._vectorFill);
  if (n._vectorStroke && n._vectorStroke.color) add(n._vectorStroke.color);
}

/** A plain preview SVG of the decoded page - rects for boxes/vectors, text, and
 *  embedded rasters. Not faithful; enough to recognise the frame beside its prose. */
function figNodesToSvg(nodes: any[], files: Record<string, Uint8Array>, width: number, height: number): string {
  const parts: string[] = [];
  for (const n of nodes) {
    const x = Number(n.x) || 0, y = Number(n.y) || 0, w = Math.max(0, Number(n.w) || 0), h = Math.max(0, Number(n.h) || 0);
    const cx = x + w / 2, cy = y + h / 2;
    const rot = n.rot ? ` transform="rotate(${n.rot} ${cx} ${cy})"` : '';
    if (n._imageHash) {
      const path = Object.keys(files).find((p) => p === 'images/' + n._imageHash || p.startsWith('images/' + n._imageHash));
      const bytes = path ? files[path] : null;
      if (bytes && bytes.length) {
        parts.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:${sniffImageMime(bytes)};base64,${figB64(bytes)}"${rot}/>`);
        continue;
      }
    }
    if (n.kind === 'text') {
      const fs = n.fontSize || 16;
      const lines = String(n.text || '').split('\n');
      const tspans = lines.map((ln, li) => `<tspan x="${x}" dy="${li === 0 ? fs : fs * 1.25}">${figEsc(ln)}</tspan>`).join('');
      parts.push(`<text x="${x}" y="${y}" font-size="${fs}" fill="${/^#[0-9a-f]{3,8}$/i.test(n.fg || '') ? n.fg : '#0c322c'}"${rot}>${tspans}</text>`);
      continue;
    }
    const fill = /^#[0-9a-f]{3,8}$/i.test(n.fill || '') ? n.fill : (/^#[0-9a-f]{3,8}$/i.test(n._vectorFill || '') ? n._vectorFill : 'none');
    const stroke = fill === 'none' ? ' stroke="#d5dbd9" stroke-width="1"' : '';
    if (w > 0 && h > 0) parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${stroke}${rot}/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#ffffff"/>${parts.join('')}</svg>`;
}

const figEmptyPage = (): PageText =>
  ({ blocks: [], text: '', markdown: '', columns: 1, scanned: false, rotated: 0, order: 'geometric' });

/**
 * Open a Figma .fig for Unpack. Decodes the Kiwi binary once (the same
 * path parseFig uses), then reads the decoded nodes: text runs, the
 * colours they paint with, the fonts they name (names-only, a .fig
 * references fonts but never embeds the files), the embedded rasters
 * (`images/<hash>` in the zip), and the reconstructed vector outlines as
 * standalone SVGs.
 */
export async function openFigFile(files: Record<string, Uint8Array>): Promise<UnpackHandle> {
  const canvasFig = files['canvas.fig'];
  if (!canvasFig || !canvasFig.length) throw new Error('This .fig has no canvas data.');
  let doc: any;
  try { doc = await decodeCanvasFig(canvasFig); }
  catch { throw new Error('Could not read this .fig - Figma may have changed its file format. Export the frame as SVG and open that.'); }
  const nodeChanges = doc && doc.nodeChanges;
  if (!Array.isArray(nodeChanges) || !nodeChanges.length) throw new Error('This .fig contained no nodes.');

  const nodes: any[] = figmaNodesToNodes(nodeChanges, doc.blobs);
  const { width, height } = shiftToOrigin(nodes);

  const palette: string[] = [];
  const seenColor = new Set<string>();
  const fonts: string[] = [];
  const seenFont = new Set<string>();
  for (const n of nodes) {
    figNodeColors(n, seenColor, palette);
    if (n.kind === 'text' && n.fontFamily) {
      const fam = String(n.fontFamily).trim();
      if (fam && !seenFont.has(fam.toLowerCase())) { seenFont.add(fam.toLowerCase()); fonts.push(fam); }
    }
  }

  return {
    pageCount: 1,
    async pageToSvg(index: number): Promise<PdfPageSvg> {
      if (index !== 0) throw new Error(`No page ${index + 1} in a .fig.`);
      return { svg: figNodesToSvg(nodes, files, width, height), width, height, elementCount: nodes.length };
    },
    pageToText(index: number): PageText {
      if (index !== 0) return figEmptyPage();
      const blocks: TextBlock[] = [];
      for (const n of nodes) {
        if (n.kind !== 'text') continue;
        const txt = String(n.text || '').trim();
        if (!txt) continue;
        blocks.push({ kind: 'paragraph', text: txt, size: n.fontSize || 0, bold: (Number(n.fontWeight) || 400) >= 600, column: 0 });
      }
      if (!blocks.length) return figEmptyPage();
      const text = blocks.map((b) => b.text).join('\n\n');
      return { blocks, text, markdown: text, columns: 1, scanned: false, rotated: 0, order: 'geometric' };
    },
    listPalette(): string[] {
      return palette;
    },
    listFonts(): EmbeddedFont[] {
      return fonts.map(figNamesOnlyFont);
    },
    listImages(): Promise<EmbeddedImageScan> {
      const images: EmbeddedImage[] = [];
      const seen = new Set<string>();
      for (const n of nodes) {
        const hash = n._imageHash;
        if (!hash || seen.has(hash)) continue;
        seen.add(hash);
        const path = Object.keys(files).find((p) => p === 'images/' + hash || p.startsWith('images/' + hash));
        const bytes = path ? files[path] : null;
        if (!bytes || !bytes.length) continue;
        const mime = sniffImageMime(bytes);
        const size = rasterSize(bytes);
        images.push({ bytes, mime, width: size?.w || 0, height: size?.h || 0, colorSpace: null, page: 0 });
      }
      return Promise.resolve({ images, skipped: 0, skippedFilters: [] });
    },
    listVectors(): Promise<ExtractedVector[]> {
      const out: ExtractedVector[] = [];
      for (const n of nodes) {
        if (!n._vectorPath) continue;
        const svg = figVectorSvg(n._vectorPath, n._vectorFill, n._vectorStroke, n._vectorSize, n._vectorGradient);
        const w = Math.max(1, Math.round((n._vectorSize && n._vectorSize.w) || n.w || 1));
        const h = Math.max(1, Math.round((n._vectorSize && n._vectorSize.h) || n.h || 1));
        const localSeen = new Set<string>();
        const fills: string[] = [];
        figNodeColors(n, localSeen, fills);
        out.push({ svg, width: w, height: h, page: 0, fills: fills.slice(0, 12), shapes: 1, reason: 'a Figma vector' });
      }
      return Promise.resolve(out);
    },
  };
}


// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// World axis-aligned bbox: transform the four local-bbox corners by the CTM and take
// the min/max. Used to size the flatten viewBox + place flattened image boxes.
function worldBBox(bbox: { x: number; y: number; width: number; height: number }, m: Matrix): { x: number; y: number; w: number; h: number } {
  const pts = [
    [bbox.x, bbox.y],
    [bbox.x + bbox.width, bbox.y],
    [bbox.x, bbox.y + bbox.height],
    [bbox.x + bbox.width, bbox.y + bbox.height],
  ].map(([px, py]) => ({ x: m.a * px! + m.c * py! + m.e, y: m.b * px! + m.d * py! + m.f }));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

// Concatenate <text>/<tspan> content, one line per <tspan> (or the whole text if none).
function readTextContent(el: Element) {
  const tspans = el.querySelectorAll('tspan');
  let text: string;
  if (tspans.length) {
    text = Array.from(tspans).map((t) => t.textContent || '').join('\n');
  } else {
    text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  }
  return {
    text,
    fg: styleProp(el, 'fill') || el.getAttribute('fill') || '',
    fontSize: attrNum(el, 'font-size') || parseFloat(styleProp(el, 'font-size')) || 0,
    fontWeight: el.getAttribute('font-weight') || styleProp(el, 'font-weight') || '',
    fontFamily: el.getAttribute('font-family') || styleProp(el, 'font-family') || '',
    textAlign: anchorToAlign(styleProp(el, 'text-anchor') || el.getAttribute('text-anchor')),
    lineHeight: 0,
  };
}

// Serialize the root <defs> of the mounted svg so flattened snippets can resolve
// gradients / clipPaths / patterns referenced by url(#…).
function rootDefsHtml(mount: SVGSVGElement): string {
  try {
    return Array.from(mount.querySelectorAll(':scope > defs'))
      .map((d) => d.innerHTML)
      .join('');
  } catch {
    return '';
  }
}

// SVG text-anchor → box textAlign.
function anchorToAlign(a: unknown): string {
  const s = String(a || '').toLowerCase();
  if (s === 'middle') return 'center';
  if (s === 'end') return 'right';
  return 'left';
}

// Read a Penpot `penpot:<name>` attribute robustly across namespace handling.
function penpotAttr(el: Element, name: string): string | null {
  const direct = el.getAttribute('penpot:' + name);
  if (direct != null) return direct;
  for (const ns of PENPOT_NS_CANDIDATES) {
    const v = el.getAttributeNS(ns, name);
    if (v != null && v !== '') return v;
  }
  // Last resort: scan attributes for a matching prefixed/local name.
  for (const attr of Array.from(el.attributes)) {
    if (attr.name === 'penpot:' + name || (attr.localName === name && (attr.prefix === 'penpot'))) {
      return attr.value;
    }
  }
  return null;
}

// Read a CSS property off the element's inline style="" (cheap; no computed styles).
function styleProp(el: Element, prop: string): string {
  try {
    const st = (el as unknown as ElementCSSInlineStyle).style;
    const v = st && st.getPropertyValue(prop);
    return v ? v.trim() : '';
  } catch {
    return '';
  }
}

function attrNum(el: Element, name: string): number | null {
  const v = el.getAttribute(name);
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// A fill that's paintable as a solid colour, else '' (none/currentColor/url(#…)).
function colorOrEmpty(v: unknown): string {
  const s = String(v == null ? '' : v).trim();
  if (!s || s.toLowerCase() === 'none' || s.toLowerCase() === 'currentcolor' || /^url\(/i.test(s)) return '';
  return safeColor(s, '');
}

function firstDefined(...vals: unknown[]): unknown {
  for (const v of vals) if (v != null && v !== '') return v;
  return undefined;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function extFromType(type: string): string {
  const t = String(type || '').toLowerCase();
  if (t.includes('svg')) return 'svg';
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('webp')) return 'webp';
  if (t.includes('gif')) return 'gif';
  return 'png';
}

function typeFromExt(ext: string): string {
  const e = String(ext || '').toLowerCase();
  if (e === 'svg') return 'image/svg+xml';
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'webp') return 'image/webp';
  if (e === 'gif') return 'image/gif';
  return 'image/png';
}

// ---------------------------------------------------------------------------
// Frame → scene import (sequence editors)
// ---------------------------------------------------------------------------
//
// The sequence editor's counterpart to parseDesignFile: instead of merging one
// page into a single boxes array, every frame/board/page of the file becomes one
// stored SVG *asset*, ready to drop onto the timeline as a timed scene. Formats
// that already ARE per-page vector artwork (PDF/.ai pages, plain SVG, legacy
// Penpot page SVGs) go straight to the asset store; formats that parse into
// boxes (Penpot binfile-v3 boards, Figma .fig frames, IDML) are baked through an
// offscreen Design render (host.compose.render → SVG), so a baked frame
// is pixel-identical to importing that frame into Design and exporting it.

/** One imported frame, ready to place as a timeline scene. */
export interface DesignSceneAsset {
  name: string;
  asset: AssetRef;
  /**
   * The entrance this scene was navigated to with, when the source file carried a
   * prototype flow (Penpot only today) - a value from the shared transition
   * vocabulary (`lib/transitions.ts`). Additive and optional: files without
   * interactions omit both fields and every existing caller is unaffected.
   */
  enter?: string;
  enterMs?: number;
}
export interface DesignScenesResult { scenes: DesignSceneAsset[]; }

// Frames beyond this are skipped with a warning - same ceiling as the PDF page
// picker (MAX_PICK_PAGES), far above any real storyboard.
const MAX_SCENES = 60;

// Marked shapes beyond this are skipped with a warning - the export-marks ingest's
// counterpart to MAX_SCENES (a mark can carry several entries; the cap counts shapes).
const MAX_EXPORT_MARKS = 60;

/**
 * Parse a design file into per-frame scene assets.
 * @param {File|Blob} file
 * @param {{ host, log?, interactive?, map? }} ctx - same contract as parseDesignFile;
 *   `interactive` drives the multi-page PDF picker (all pages pre-selected),
 *   `map` carries the target tool's font/seed vocabulary into the frame bakes.
 * @returns {Promise<DesignScenesResult>} scenes in document order; empty when the
 *   user cancelled a picker. Per-frame failures warn and continue.
 */
export async function parseDesignScenes(
  file: File | Blob,
  { host, log, interactive, map }: {
    host?: HostV1; log?: (msg: string) => void; interactive?: boolean; map?: DesignMapOptions;
  } = {},
): Promise<DesignScenesResult> {
  const warn: (msg: string) => void = typeof log === 'function' ? log : () => {};
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error(`This file is too large to import (over ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB).`);
  }
  const buf = new Uint8Array(await file.arrayBuffer());

  // PDF / .ai: the multi-page SVG ingest already does exactly this - one stored
  // vector asset per picked page (all pre-selected in 'multi' mode).
  if (isPdf(buf)) {
    const { ingestPdfAsSvgAssets } = await import('./pdf-import.ts');
    const refs = await ingestPdfAsSvgAssets(host as HostV1, file, { mode: interactive ? 'multi' : 'single', warn, intent: 'scenes' });
    return { scenes: refs.map((asset, i) => ({ name: sceneName(asset, i), asset })) };
  }

  if (isIndd(buf, file && (file as File).name)) {
    throw new Error('A raw .indd file can’t be read directly. In InDesign choose File → Export → InDesign Markup (.idml) and import the .idml.');
  }

  const isZip = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  if (isZip) {
    const files = await unzipAsync(buf, {
      maxEntryBytes: MAX_ZIP_ENTRY_BYTES,
      maxTotalBytes: MAX_ZIP_TOTAL_BYTES,
      tooLarge: name => `This archive expands too large to import (${name}).`,
    });
    if (isPptx(files)) {
      // A deck: the slide→SVG ingest already does exactly this, one stored vector
      // asset per picked slide. No chooser - the caller has already chosen scenes.
      const { ingestPptxAsSvgAssets } = await import('./pptx-import.ts');
      const refs = await ingestPptxAsSvgAssets(host as HostV1, file, { mode: interactive ? 'multi' : 'single', warn, chooser: false, parts: files, intent: 'scenes' });
      return { scenes: refs.map((asset, i) => ({ name: sceneName(asset, i), asset })) };
    }
    if (isIdml(files)) {
      // IDML: parse the first spread into boxes and bake it as a single scene.
      const { parseIdmlZip } = await import('./idml-import.ts');
      const res = await parseIdmlZip(files, { host, warn, map });
      const asset = await bakeSceneAsset(host, warn, 'Spread 1', res.boxes, res.width, res.height);
      return { scenes: asset ? [{ name: 'Spread 1', asset }] : [] };
    }
    if (files['canvas.fig']) return parseFigScenes(files, { host, warn, map });
    return parsePenpotZipScenes(files, { host, warn, interactive, map });
  }

  // Plain SVG (incl. a Figma frame exported as SVG): one scene, stored as-is
  // after sanitisation - full vector fidelity, no box mapping needed.
  const svgText = new TextDecoder('utf-8').decode(buf);
  const svgEl = sanitizeSvg(svgText);
  if (!svgEl) throw new Error('This file isn’t a readable SVG. Export your design as SVG and try again.');
  const name = baseName((file as File).name, 'design');
  const asset = await storeSvgAsset(host, svgEl, name, warn);
  return { scenes: asset ? [{ name, asset }] : [] };
}

// Display name for a stored ref: its own name, else "<i+1>".
function sceneName(asset: AssetRef, i: number): string {
  const n = asset && asset.meta && typeof asset.meta.name === 'string' ? asset.meta.name : '';
  return n.replace(/\.svg$/i, '') || `Page ${i + 1}`;
}

function baseName(name: unknown, fallback: string): string {
  const s = String(name || '').replace(/\.[a-z0-9]+$/i, '').trim();
  return s || fallback;
}

// Serialize a sanitized <svg> and persist it as a user vector asset. Sanitisation
// already stripped scripts + external hrefs; storeUserUpload runs DOMPurify again
// on ingest, so the stored bytes pass the same gate as any user upload.
async function storeSvgAsset(host: HostV1 | undefined, svgEl: SVGSVGElement, name: string, warn: (msg: string) => void): Promise<AssetRef | null> {
  try {
    const text = new XMLSerializer().serializeToString(svgEl);
    const svgFile = new File([text], `${name}.svg`, { type: 'image/svg+xml' });
    return await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], svgFile);
  } catch (err) {
    warn(`Couldn’t store “${name}” (${String((err as Error) && (err as Error).message || err)}).`);
    return null;
  }
}

// Settle for a bake whose boxes carry no image/lottie/video ref: enough for layout
// + fonts to quiesce, without the decode headroom the default reserves.
const FAST_SETTLE_MS = 50;

// True when any box carries an image ref (finalizeBoxes writes the whole AssetRef,
// or a bare id string, into `image` - and that one field is where a lottie or video
// ref lands too). Only such a frame needs the full decode settle.
function boxesHaveMedia(boxes: unknown[]): boolean {
  return boxes.some((b) => {
    const img = b && typeof b === 'object' ? (b as { image?: unknown }).image : null;
    if (!img) return false;
    return typeof img === 'object' ? (img as { id?: unknown }).id != null && (img as { id?: unknown }).id !== '' : String(img) !== '';
  });
}

// Bake one frame's boxes into a stored SVG asset via an offscreen Design
// render. compose.render suppresses watermark/provenance (the result is an
// intermediate), and the SVG goes through the full HTML→SVG walker - text as
// paths, image embeds - so the baked frame needs no fonts at playback. The
// transparent background lets the frame's own bg box (or the sequence canvas)
// show through. Returns null (with a warn) when Design isn't available
// in this build or the render fails; the caller skips that frame.
async function bakeSceneAsset(host: HostV1 | undefined, warn: (msg: string) => void, name: string, boxes: unknown[], width: number, height: number): Promise<AssetRef | null> {
  try {
    const compose = host && host.compose;
    if (!compose || typeof compose.render !== 'function') throw new Error('tool composition isn’t available here');
    const rendered = await compose.render({
      toolId: 'design',
      inputs: { boxes, background: 'transparent' },
      format: 'svg',
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
      // One-shot: the bytes are copied into a stored asset immediately and the
      // render is never requested again, so it must not evict the live compose
      // cache. Ownership of rendered.url therefore sits HERE (revoked below).
      transient: true,
      // The full settle only buys time for media to decode; a boxes-only frame
      // has nothing to wait for, and an import bakes 30+ of them back to back.
      settleMs: boxesHaveMedia(boxes) ? undefined : FAST_SETTLE_MS,
    });
    try {
      const blob = await (await fetch(rendered.url)).blob();
      const svgFile = new File([blob], `${name}.svg`, { type: 'image/svg+xml' });
      return await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], svgFile);
    } finally {
      try { URL.revokeObjectURL(rendered.url); } catch { /* not a blob URL */ }
    }
  } catch (err) {
    warn(`Couldn’t render “${name}” (${String((err as Error) && (err as Error).message || err)}).`);
    return null;
  }
}

// Render one frame's boxes to an SVG Blob via the same offscreen Design
// render bakeSceneAsset uses, WITHOUT storing it - the raster bake rasterises this
// intermediate itself (rendering vector once, then drawing at each scale, keeps a
// png@4 crisp: re-rendering the tool at 4x page size would scale the CANVAS, not
// the content, because design boxes are absolute px).
async function renderBoxesSvgBlob(host: HostV1 | undefined, name: string, boxes: unknown[], width: number, height: number): Promise<Blob> {
  const compose = host && host.compose;
  if (!compose || typeof compose.render !== 'function') throw new Error('tool composition isn’t available here');
  const rendered = await compose.render({
    toolId: 'design',
    inputs: { boxes, background: 'transparent' },
    format: 'svg',
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    transient: true,
    settleMs: boxesHaveMedia(boxes) ? undefined : FAST_SETTLE_MS,
  });
  try {
    return await (await fetch(rendered.url)).blob();
  } finally {
    try { URL.revokeObjectURL(rendered.url); } catch { /* not a blob URL */ }
  }
}

// Rasterise a baked SVG blob at the export mark's pixel size. A jpeg has no alpha,
// so it flattens onto white (Penpot's own jpeg export does the same).
async function rasterizeSvgBlob(svgBlob: Blob, outW: number, outH: number, format: 'png' | 'jpeg'): Promise<Blob> {
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('the baked SVG didn’t decode'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const cx = canvas.getContext('2d');
    if (!cx) throw new Error('no 2d canvas here');
    if (format === 'jpeg') { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, outW, outH); }
    cx.drawImage(img, 0, 0, outW, outH);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, format === 'jpeg' ? 'image/jpeg' : 'image/png', format === 'jpeg' ? 0.92 : undefined));
    if (!blob) throw new Error('raster encode failed');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Bake one export mark's boxes to a stored raster asset at round(w*scale) x
// round(h*scale) - bakeSceneAsset's raster sibling. Scale rides the file name as
// '@{scale}x' (omitted at 1x) so a png@2 and a png@4 of the same shape stay distinct.
async function bakeRasterAsset(
  host: HostV1 | undefined, warn: (msg: string) => void, name: string,
  svgBlob: Blob, width: number, height: number, format: 'png' | 'jpeg', scale: number,
): Promise<AssetRef | null> {
  try {
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));
    const blob = await rasterizeSvgBlob(svgBlob, outW, outH, format);
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const scaleTag = scale !== 1 ? `@${scale}x` : '';
    const file = new File([blob], `${name}${scaleTag}.${ext}`, { type: blob.type || (format === 'jpeg' ? 'image/jpeg' : 'image/png') });
    return await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], file);
  } catch (err) {
    warn(`Couldn’t render “${name}” (${String((err as Error) && (err as Error).message || err)}).`);
    return null;
  }
}

// Bake a list of {name, width, height, boxes} frames, with progress + the scene cap.
async function bakeFrames(
  host: HostV1 | undefined, warn: (msg: string) => void,
  frames: Array<{ name: string; width: number; height: number; boxes: unknown[]; enter?: string; enterMs?: number }>,
): Promise<DesignSceneAsset[]> {
  if (frames.length > MAX_SCENES) {
    warn(`This file has ${frames.length} frames - only the first ${MAX_SCENES} were imported.`);
    frames = frames.slice(0, MAX_SCENES);
  }
  const scenes: DesignSceneAsset[] = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    if (frames.length > 1) warn(`Rendering “${f.name}” (${i + 1}/${frames.length})…`);
    const asset = await bakeSceneAsset(host, warn, f.name, f.boxes, f.width, f.height);
    // enter/enterMs only ride along when the source carried a prototype flow, so a
    // file with no interactions produces exactly the object shape it always did.
    if (asset) scenes.push({ name: f.name, asset, ...(f.enter ? { enter: f.enter } : {}), ...(f.enterMs !== undefined ? { enterMs: f.enterMs } : {}) });
  }
  return scenes;
}

// Figma .fig → per-frame scenes: engine walk splits top-level frames, then each
// frame's media resolves and bakes independently (one shared image cache).
async function collectFigFrames(files: Record<string, Uint8Array>, { host, warn, map }: { host: HostV1 | undefined; warn: (msg: string) => void; map?: DesignMapOptions }): Promise<DesignImportFrame[]> {
  const canvasFig = files['canvas.fig'];
  if (!canvasFig || !canvasFig.length) throw new Error('This .fig has no canvas data.');
  let doc: any;
  try { doc = await decodeCanvasFig(canvasFig); }
  catch (err) {
    throw new Error('Couldn’t read this .fig - Figma may have changed its file format. Try exporting the frames as SVG instead. (' + String((err as Error) && (err as Error).message || err) + ')');
  }
  const sceneDefs: DesignFrameScene[] = figmaNodesToScenes(doc && doc.nodeChanges, doc && doc.blobs);
  if (!sceneDefs.length) throw new Error('This .fig has no importable frames.');

  const imageCache = new Map<string, AssetRef>();
  const frames: DesignImportFrame[] = [];
  for (const sc of sceneDefs) {
    await resolveFigMedia(host, files, sc.nodes as any[], imageCache, warn);
    const boxes = finalizeBoxes(sc.nodes as any[], { prefix: 'f', ...map });
    if (boxes.length) frames.push({ name: sc.name, width: sc.width, height: sc.height, boxes });
  }
  return frames;
}
async function parseFigScenes(files: Record<string, Uint8Array>, ctx: { host: HostV1 | undefined; warn: (msg: string) => void; map?: DesignMapOptions }): Promise<DesignScenesResult> {
  return { scenes: await bakeFrames(ctx.host, ctx.warn, await collectFigFrames(files, ctx)) };
}

// Penpot ZIP → per-board scenes. Binfile-v3 walks every page's top-level boards;
// the legacy SVG export stores each page's SVG directly (it is already the frame).
async function parsePenpotZipScenes(files: Record<string, Uint8Array>, { host, warn, interactive, map }: { host: HostV1 | undefined; warn: (msg: string) => void; interactive?: boolean; map?: DesignMapOptions }): Promise<DesignScenesResult> {
  const manifest = files['manifest.json'] ? safeJsonParse(strFromU8(files['manifest.json'])) : null;
  const isExportFiles = manifest && typeof manifest.type === 'string' && /export-files/.test(manifest.type);
  const hasShapeJson = Object.keys(files).some((p) => /\/pages\/[^/]+\/[^/]+\.json$/i.test(p));
  if (isExportFiles && hasShapeJson) {
    return parsePenpotBinfileScenes(files, manifest, { host, warn, interactive, map });
  }

  const svgPaths = Object.keys(files).filter((p) => /\.svg$/i.test(p) && !/[/\\]$/.test(p));
  if (svgPaths.length) {
    const scenes: DesignSceneAsset[] = [];
    for (const path of svgPaths.sort().slice(0, MAX_SCENES)) {
      let svgText: string;
      try { svgText = strFromU8(files[path]!); }
      catch { warn(`Skipped a Penpot page that wasn’t text (${path}).`); continue; }
      const svgEl = sanitizeSvg(svgText);
      if (!svgEl) { warn(`Skipped an unreadable Penpot page (${path}).`); continue; }
      const name = baseName(path.split('/').pop(), `Page ${scenes.length + 1}`);
      // Legacy page SVGs can reference sibling zip images; those refs were stripped
      // by sanitisation, so pages WITH images go through the box walk + bake to keep
      // them, and image-free pages store directly (cheaper, perfect fidelity).
      const hasZipImage = /<image[\s>]/i.test(svgText) && !/href\s*=\s*"data:/i.test(svgText);
      if (hasZipImage) {
        const { nodes, width, height } = await svgToNodes(svgEl, { host, warn, penpot: true, zipFiles: files });
        const boxes = finalizeBoxes(nodes, map);
        if (!boxes.length) continue;
        const asset = await bakeSceneAsset(host, warn, name, boxes, width, height);
        if (asset) scenes.push({ name, asset });
      } else {
        const asset = await storeSvgAsset(host, svgEl, name, warn);
        if (asset) scenes.push({ name, asset });
      }
    }
    if (svgPaths.length > MAX_SCENES) warn(`This file has ${svgPaths.length} pages - only the first ${MAX_SCENES} were imported.`);
    if (!scenes.length) throw new Error('This Penpot file didn’t contain any importable pages.');
    return { scenes };
  }

  throw new Error('Could not read this Penpot file. In Penpot use “Export as .penpot” (or export the board as SVG) and import that.');
}

// Penpot ZIP → per-board editable frames (the artboards import). Binfile-v3 walks
// every page's boards exactly as the scenes walk does, minus the bake; the legacy
// SVG export parses each page SVG into boxes the way a single-SVG import does.
async function collectPenpotZipFrames(files: Record<string, Uint8Array>, { host, warn, interactive, map }: { host: HostV1 | undefined; warn: (msg: string) => void; interactive?: boolean; map?: DesignMapOptions }): Promise<DesignArtboardsResult> {
  const manifest = files['manifest.json'] ? safeJsonParse(strFromU8(files['manifest.json'])) : null;
  const isExportFiles = manifest && typeof manifest.type === 'string' && /export-files/.test(manifest.type);
  const hasShapeJson = Object.keys(files).some((p) => /\/pages\/[^/]+\/[^/]+\.json$/i.test(p));
  if (isExportFiles && hasShapeJson) {
    return { frames: await collectPenpotBinfileFrames(files, manifest, { host, warn, interactive, map }), background: '#ffffff' };
  }
  const svgPaths = Object.keys(files).filter((p) => /\.svg$/i.test(p) && !/[/\\]$/.test(p));
  if (!svgPaths.length) throw new Error('Could not read this Penpot file. In Penpot use “Export as .penpot” (or export the board as SVG) and import that.');
  const frames: DesignImportFrame[] = [];
  for (const path of svgPaths.sort().slice(0, MAX_SCENES)) {
    let svgText: string;
    try { svgText = strFromU8(files[path]!); }
    catch { warn(`Skipped a Penpot page that wasn’t text (${path}).`); continue; }
    const svgEl = sanitizeSvg(svgText);
    if (!svgEl) { warn(`Skipped an unreadable Penpot page (${path}).`); continue; }
    const name = baseName(path.split('/').pop(), `Page ${frames.length + 1}`);
    const { nodes, width, height } = await svgToNodes(svgEl, { host, warn, penpot: true, zipFiles: files });
    const boxes = finalizeBoxes(nodes, map);
    if (boxes.length) frames.push({ name, width, height, boxes });
  }
  if (svgPaths.length > MAX_SCENES) warn(`This file has ${svgPaths.length} pages - only the first ${MAX_SCENES} were imported.`);
  if (!frames.length) throw new Error('This Penpot file didn’t contain any importable pages.');
  return { frames, background: '#ffffff' };
}

// Penpot binfile-v3 → scenes: every page's top-level boards (type 'frame') become
// one scene each, cropped to the board; loose top-level shapes collect into one
// extra scene per page. Same shape→node mapping + media loading as the single-page
// import (parsePenpotBinfile), so the two paths can't drift visually.
async function collectPenpotBinfileFrames(files: Record<string, Uint8Array>, manifest: any, { host, warn, interactive, map }: { host: HostV1 | undefined; warn: (msg: string) => void; interactive?: boolean; map?: DesignMapOptions }): Promise<DesignImportFrame[]> {
  const fileId = Array.isArray(manifest.files) && manifest.files[0] ? manifest.files[0].id : null;
  if (!fileId) throw new Error('This Penpot file has no importable file.');

  const pageDir = `files/${fileId}/pages/`;
  const pageShapes = new Map<string, string[]>();
  for (const path of Object.keys(files)) {
    if (!path.startsWith(pageDir)) continue;
    const m = path.slice(pageDir.length).match(/^([^/]+)\/([^/]+)\.json$/i);
    if (m) { if (!pageShapes.has(m[1]!)) pageShapes.set(m[1]!, []); pageShapes.get(m[1]!)!.push(path); }
  }
  if (!pageShapes.size) throw new Error('This Penpot file has no pages to import.');

  // Fonts first: the deck's families must be known (and any Google faces
  // installed) before the first finalizeBoxes maps a text box.
  map = await ensurePenpotDeckFonts(files, pageDir, { host, warn, interactive, map });

  const pageMeta = (pid: string): any => (files[`${pageDir}${pid}.json`] ? safeJsonParse(strFromU8(files[`${pageDir}${pid}.json`]!)) : null);
  const pageIds = [...pageShapes.keys()].sort((a, b) => {
    const ia = pageMeta(a), ib = pageMeta(b);
    return (ia && Number.isFinite(ia.index) ? ia.index : 0) - (ib && Number.isFinite(ib.index) ? ib.index : 0);
  });

  const ROOT = '00000000-0000-0000-0000-000000000000';
  const imageCache = new Map<string, AssetRef>();
  const frames: DesignImportFrame[] = [];

  // Map an ordered walk (shapes + flatten markers) to nodes - the shared resolver,
  // so this path and the single-page import can't drift.
  const shapesToNodes = (items: any[]): Promise<any[]> =>
    penpotItemsToNodes(items, { host, files, fileId, imageCache, warn });

  for (let p = 0; p < pageIds.length; p++) {
    const pid = pageIds[p]!;
    const shapesById: Record<string, any> = {};
    for (const path of pageShapes.get(pid)!) {
      const shape = safeJsonParse(strFromU8(files[path]!));
      if (shape && shape.id) shapesById[shape.id] = shape;
    }
    const meta = pageMeta(pid);
    const pageName = (meta && typeof meta.name === 'string' && meta.name) || `Page ${p + 1}`;

    // DFS one top-level subtree in paint order (container `shapes` arrays).
    // A hidden shape hides its whole subtree - same as Figma's visible:false.
    // `hideInViewer` deliberately does NOT prune here: on a nested board it means
    // "don't show as its own slide in Penpot's viewer" - the content still paints
    // inside its parent. It only filters which TOP-LEVEL boards become scenes.
    // An all-vector group collapses to ONE flatten marker (icons/illustrations bake
    // as a single SVG asset instead of hundreds of selrect boxes); a bool's content
    // already carries its resolved outline, so its operand children are consumed.
    const subtree = (id: string, seen: Set<string>): any[] => {
      const s = shapesById[id];
      if (!s || seen.has(id) || s.hidden === true) return [];
      seen.add(id);
      const flat = penpotFlattenStep(shapesById, s, seen);
      if (flat) return [flat];
      const out = [s];
      if (String(s.type || '') === 'bool' && typeof s.content === 'string' && s.content) {
        for (const k of (Array.isArray(s.shapes) ? s.shapes : [])) markPenpotSubtreeSeen(shapesById, String(k), seen);
        return out;
      }
      for (const k of (Array.isArray(s.shapes) ? s.shapes : [])) out.push(...subtree(k, seen));
      return out;
    };

    const root = shapesById[ROOT];
    const topIds: string[] = root && Array.isArray(root.shapes) ? root.shapes : Object.keys(shapesById).filter((id) => id !== ROOT);
    const seen = new Set<string>([ROOT]);
    const loose: any[] = [];
    const boards: Array<{ shape: any; at: { x: number; y: number; w: number; h: number } }> = [];
    for (const id of topIds) {
      const s = shapesById[id];
      if (!s || s.hidden === true || s.hideInViewer === true) continue;
      // A component MASTER board (componentRoot + mainInstance) is a definition,
      // not deck content - Penpot files keep them on a "Main components" page and
      // every slide already carries its own instance copies. Skip them wholesale.
      if (s.componentRoot === true && s.mainInstance === true) continue;
      if (String(s.type || '') === 'frame') {
        const sel = (s.selrect && typeof s.selrect === 'object') ? s.selrect : s;
        boards.push({ shape: s, at: {
          x: Number(sel.x) || 0, y: Number(sel.y) || 0,
          w: Number(sel.width) || 0, h: Number(sel.height) || 0,
        } });
      } else {
        loose.push(...subtree(id, seen));
      }
    }
    // Boards play in READING order (rows top-to-bottom, left-to-right): root
    // `shapes` order is Z/creation order, which plays a deck backwards.
    const spatial = readingOrder(boards, (b) => b.at);
    // …unless the file authored a prototype flow, in which case the flow IS the
    // running order and each edge's animation becomes the destination scene's
    // entrance. With no interactions `hasFlow` is false and `flow.ordered` is the
    // reading order copied, so a zero-interaction file is byte-identical to before.
    const flow = penpotFlowOrder(spatial.map((b) => String(b.shape.id)), shapesById, meta);
    const byId = new Map(spatial.map((b) => [String(b.shape.id), b]));
    const ordered = flow.hasFlow
      ? flow.ordered.map((id) => byId.get(id)).filter((b): b is (typeof spatial)[number] => Boolean(b))
      : spatial;
    for (const { shape: s, at } of ordered) {
      const nodes = await shapesToNodes(subtree(s.id, seen));
      if (!nodes.length) continue;
      for (const n of nodes) { n.x -= at.x; n.y -= at.y; }
      const boxes = finalizeBoxes(nodes, map);
      if (!boxes.length) continue;
      const tr = flow.transitions[String(s.id)];
      frames.push({
        name: (typeof s.name === 'string' && s.name) || `Board ${frames.length + 1}`,
        width: Math.max(1, Math.round(at.w)) || 1080,
        height: Math.max(1, Math.round(at.h)) || 1080,
        boxes,
        ...(tr ? { enter: tr.enter, ...(tr.enterMs !== undefined ? { enterMs: tr.enterMs } : {}) } : {}),
      });
    }
    // Loose shapes only make a scene when the page has NO boards - next to
    // boards they're scratch content and a union-bounds scene of it is noise.
    if (loose.length && !boards.length) {
      const nodes = await shapesToNodes(loose);
      if (nodes.length) {
        const { width, height } = shiftToOrigin(nodes);
        const boxes = finalizeBoxes(nodes, map);
        if (boxes.length) frames.push({ name: pageName, width, height, boxes });
      }
    }
  }
  if (!frames.length) throw new Error('This Penpot file has no importable boards.');
  return frames;
}
async function parsePenpotBinfileScenes(files: Record<string, Uint8Array>, manifest: any, ctx: { host: HostV1 | undefined; warn: (msg: string) => void; interactive?: boolean; map?: DesignMapOptions }): Promise<DesignScenesResult> {
  return { scenes: await bakeFrames(ctx.host, ctx.warn, await collectPenpotBinfileFrames(files, manifest, ctx)) };
}

// ---------------------------------------------------------------------------
// Penpot export marks → library assets
// ---------------------------------------------------------------------------
//
// The drop router's "marked exports" route: every shape the designer marked
// for export in Penpot (the `exports` array on a shape) becomes stored
// library assets at the marked formats and scales. The engine collects and
// normalizes the marks (collectPenpotExportMarks: master/hidden subtrees
// pruned, entries deduped); this side reuses the scenes machinery: the same
// subtree walk with pure-vector group flattening, the same
// penpotItemsToNodes media resolution with one shared imageCache, and the
// same offscreen Design bake. A group that flattens pure and is marked svg
// stores its flattened SVG directly (full fidelity, no bake); rasters
// render the vector intermediate once and draw it at each marked scale.

// The scenes walk's subtree step, shared verbatim: paint-order DFS with hidden
// pruning, pure-vector group collapse and bool operand consumption.
function penpotMarkSubtree(shapesById: Record<string, any>, id: string, seen: Set<string>): any[] {
  const s = shapesById[id];
  if (!s || seen.has(id) || s.hidden === true) return [];
  seen.add(id);
  const flat = penpotFlattenStep(shapesById, s, seen);
  if (flat) return [flat];
  const out = [s];
  if (String(s.type || '') === 'bool' && typeof s.content === 'string' && s.content) {
    for (const k of (Array.isArray(s.shapes) ? s.shapes : [])) markPenpotSubtreeSeen(shapesById, String(k), seen);
    return out;
  }
  for (const k of (Array.isArray(s.shapes) ? s.shapes : [])) out.push(...penpotMarkSubtree(shapesById, String(k), seen));
  return out;
}

/**
 * Ingest a .penpot file's export-marked shapes as stored library assets.
 * @param {File|Blob} file a Penpot binfile-v3 export (.penpot / .zip).
 * @param {{ host, warn?, interactive? }} ctx - same contract as the other ingests;
 *   per-mark failures warn and continue.
 * @returns {Promise<AssetRef[]>} one ref per baked export entry.
 */
export async function ingestPenpotExportsAsAssets(
  host: HostV1 | undefined,
  file: File | Blob,
  { warn: log, interactive = true }: { warn?: (msg: string) => void; interactive?: boolean } = {},
): Promise<AssetRef[]> {
  const warn: (msg: string) => void = typeof log === 'function' ? log : () => {};
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error(`This file is too large to import (over ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB).`);
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const isZip = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  if (!isZip) throw new Error('Only a .penpot export carries export marks. In Penpot use Export as .penpot and try again.');
  const files = await unzipAsync(buf, {
    maxEntryBytes: MAX_ZIP_ENTRY_BYTES,
    maxTotalBytes: MAX_ZIP_TOTAL_BYTES,
    tooLarge: name => `This archive expands too large to import (${name}).`,
  });

  // The parsePenpotZip gate: only the binfile-v3 layout carries per-shape exports.
  const manifest = files['manifest.json'] ? safeJsonParse(strFromU8(files['manifest.json'])) : null;
  const isExportFiles = manifest && typeof manifest.type === 'string' && /export-files/.test(manifest.type);
  const hasShapeJson = Object.keys(files).some((p) => /\/pages\/[^/]+\/[^/]+\.json$/i.test(p));
  if (!isExportFiles || !hasShapeJson) {
    throw new Error('Only a .penpot export carries export marks. In Penpot use Export as .penpot and try again.');
  }
  const fileId = Array.isArray(manifest.files) && manifest.files[0] ? manifest.files[0].id : null;
  if (!fileId) throw new Error('This Penpot file has no importable file.');

  const pageDir = `files/${fileId}/pages/`;
  const pageShapes = new Map<string, string[]>();
  for (const path of Object.keys(files)) {
    if (!path.startsWith(pageDir)) continue;
    const m = path.slice(pageDir.length).match(/^([^/]+)\/([^/]+)\.json$/i);
    if (m) { if (!pageShapes.has(m[1]!)) pageShapes.set(m[1]!, []); pageShapes.get(m[1]!)!.push(path); }
  }
  if (!pageShapes.size) throw new Error('This Penpot file has no pages to import.');

  // Fonts first: an svg-marked frame with text bakes through Design, so
  // the deck's families must be resolvable before the first finalizeBoxes.
  const map = await ensurePenpotDeckFonts(files, pageDir, { host, warn, interactive });

  const pageMeta = (pid: string): any => (files[`${pageDir}${pid}.json`] ? safeJsonParse(strFromU8(files[`${pageDir}${pid}.json`]!)) : null);
  const pageIds = [...pageShapes.keys()].sort((a, b) => {
    const ia = pageMeta(a), ib = pageMeta(b);
    return (ia && Number.isFinite(ia.index) ? ia.index : 0) - (ib && Number.isFinite(ib.index) ? ib.index : 0);
  });

  const imageCache = new Map<string, AssetRef>();
  const nameCounts = new Map<string, number>();
  const warnedTypes = new Set<string>();
  const out: AssetRef[] = [];
  let marksSeen = 0;
  let capped = false;
  let anyMark = false;

  for (const pid of pageIds) {
    const shapesById: Record<string, any> = {};
    for (const path of pageShapes.get(pid)!) {
      const shape = safeJsonParse(strFromU8(files[path]!));
      if (shape && shape.id) shapesById[shape.id] = shape;
    }
    const marks = collectPenpotExportMarks(shapesById);
    if (marks.length) anyMark = true;

    for (const mark of marks) {
      // The engine normalizer drops unknown export types SILENTLY - scan the RAW
      // array here so a skipped format is said out loud (once per format).
      const raw = Array.isArray((mark.shape as any).exports) ? (mark.shape as any).exports : [];
      for (const e of raw) {
        const t = e && typeof e === 'object' ? String((e as any).type ?? '') : '';
        if (t && t !== 'png' && t !== 'jpeg' && t !== 'svg' && !warnedTypes.has(t)) {
          warnedTypes.add(t);
          warn(`Skipped a ${t} export mark. Lolly can bake png, jpeg and svg exports.`);
        }
      }
      if (!mark.entries.length) continue;
      if (++marksSeen > MAX_EXPORT_MARKS) { capped = true; break; }

      const sh: any = mark.shape;
      const sel = (sh.selrect && typeof sh.selrect === 'object') ? sh.selrect : sh;
      const at = {
        x: Number(sel.x) || 0, y: Number(sel.y) || 0,
        w: Number(sel.width) || 0, h: Number(sel.height) || 0,
      };
      const base = (typeof sh.name === 'string' && sh.name.trim()) || 'Export';
      const n = (nameCounts.get(base) ?? 0) + 1;
      nameCounts.set(base, n);
      const name = n > 1 ? `${base} ${n}` : base;
      if (!(at.w > 0) || !(at.h > 0)) { warn(`Skipped “${name}”. It has no size.`); continue; }

      try {
        // Pure-vector rule: a group whose whole subtree bakes to one standalone
        // SVG keeps that SVG verbatim for its svg entries (no Design pass).
        const pureSvg = String(sh.type || '') === 'group'
          ? penpotGroupToSvg(sh, (cid: string) => shapesById[cid]) : '';

        let boxes: unknown[] | null = null;
        const markBoxes = async (): Promise<unknown[]> => {
          if (boxes) return boxes;
          const seen = new Set<string>();
          const items = penpotMarkSubtree(shapesById, String(sh.id), seen);
          const nodes = await penpotItemsToNodes(items, { host, files, fileId, imageCache, warn });
          for (const nd of nodes) { nd.x -= at.x; nd.y -= at.y; }
          boxes = finalizeBoxes(nodes, map);
          return boxes;
        };
        let svgBlob: Blob | null = null;
        const markSvgBlob = async (): Promise<Blob> =>
          svgBlob ?? (svgBlob = await renderBoxesSvgBlob(host, name, await markBoxes(), at.w, at.h));

        for (const entry of mark.entries) {
          const entryName = `${name}${entry.suffix || ''}`;
          if (entry.type === 'svg') {
            if (pureSvg) {
              const key = 'ppexport:' + pureSvg;
              const hit = imageCache.get(key);
              if (hit) { out.push(hit); continue; }
              const svgFile = new File([pureSvg], `${entryName}.svg`, { type: 'image/svg+xml' });
              const ref = await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], svgFile);
              imageCache.set(key, ref);
              out.push(ref);
            } else {
              const b = await markBoxes();
              if (!b.length) { warn(`Skipped “${entryName}”. Nothing on it could be imported.`); continue; }
              const ref = await bakeSceneAsset(host, warn, entryName, b, at.w, at.h);
              if (ref) out.push(ref);
            }
          } else {
            const b = await markBoxes();
            if (!b.length) { warn(`Skipped “${entryName}”. Nothing on it could be imported.`); continue; }
            const ref = await bakeRasterAsset(host, warn, entryName, await markSvgBlob(), at.w, at.h, entry.type, entry.scale);
            if (ref) out.push(ref);
          }
        }
      } catch (err) {
        warn(`Couldn’t export “${name}” (${String((err as Error) && (err as Error).message || err)}).`);
      }
    }
    if (capped) break;
  }

  if (capped) warn(`This file has more than ${MAX_EXPORT_MARKS} export marks. Only the first ${MAX_EXPORT_MARKS} were baked.`);
  if (!anyMark) throw new Error('This Penpot file has no export marks. Mark shapes for export in Penpot and try again.');
  return out;
}

// ---------------------------------------------------------------------------
// Penpot components → Design templates
// ---------------------------------------------------------------------------
//
// The third Penpot route (plan: penpot-design-system.md section 2). A design
// system's component MASTERS are exactly the reusable layouts a
// non-designer wants, so each one becomes a saved session with its text
// runs and image fills marked as fill-in-the-blank slots.
//
// This is an ADDITIONAL pass, never a change to the board/scene walks:
// masters stay excluded there (a master board is a definition, not deck
// content), and this pass reads nothing else. It reuses the SAME resolvers
// (the scenes subtree walk, penpotMarkSubtree, penpotItemsToNodes,
// finalizeBoxes and shiftToOrigin), so a template can never drift from what
// importing that same artwork onto the canvas produces.
//
// Two structures the plan predates, both established by phase 1.1 and
// honoured here: masters NEST (TEXT 9's master sits inside PERSON INTRO's,
// so template subtrees legitimately overlap and nothing may assume they
// are disjoint), and a variant SET is one logical component whose default
// variant is the one mapped. Both are the engine collector's business
// (collectPenpotComponents); this side just walks what it returns.

/** Templates beyond this are skipped with a warning (see MAX_SCENES). */
const MAX_TEMPLATES = 60;

export interface DesignTemplatesResult {
  templates: DesignTemplate[];
  /** Instance roots pointing at libraries this export does not carry. */
  externalInstances: number;
}

/**
 * Parse a design file's component definitions into reusable templates.
 * @param {File|Blob} file a Penpot binfile-v3 export (.penpot / .zip).
 * @param {{ host, log?, interactive?, map? }} ctx - same contract as parseDesignFile;
 *   pass back `parseDesignFile`'s returned `map` so the deck's fonts are resolved
 *   once for both passes.
 * @returns {Promise<DesignTemplatesResult>} one entry per component, in the
 *   collector's order (path, then name). A file with no components returns an
 *   empty list rather than throwing: this runs AFTER a successful board import,
 *   and a missing design system must not turn that into an error.
 */
export async function parseDesignTemplates(
  file: File | Blob,
  { host, log, interactive, map }: {
    host?: HostV1; log?: (msg: string) => void; interactive?: boolean; map?: DesignMapOptions;
  } = {},
): Promise<DesignTemplatesResult> {
  const warn: (msg: string) => void = typeof log === 'function' ? log : () => {};
  const empty: DesignTemplatesResult = { templates: [], externalInstances: 0 };
  if (file.size > MAX_IMPORT_BYTES) return empty;
  const buf = new Uint8Array(await file.arrayBuffer());
  const isZip = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  if (!isZip) return empty;
  const files = await unzipAsync(buf, {
    maxEntryBytes: MAX_ZIP_ENTRY_BYTES,
    maxTotalBytes: MAX_ZIP_TOTAL_BYTES,
    tooLarge: name => `This archive expands too large to import (${name}).`,
  });
  const manifest = files['manifest.json'] ? safeJsonParse(strFromU8(files['manifest.json'])) : null;
  const isExportFiles = manifest && typeof manifest.type === 'string' && /export-files/.test(manifest.type);
  const hasShapeJson = Object.keys(files).some((p) => /\/pages\/[^/]+\/[^/]+\.json$/i.test(p));
  if (!isExportFiles || !hasShapeJson) return empty;
  return parsePenpotBinfileTemplates(files, manifest, { host, warn, interactive, map });
}

/**
 * Does this archive define components at all? Answered from the zip's entry
 * names, inflating only the tiny component records (the `pick` filter keeps a
 * 30 MB deck's media compressed), so the import panel can offer the templates
 * checkbox the moment a file is chosen instead of after the whole import.
 */
export async function countPenpotComponents(file: File | Blob): Promise<number> {
  if (file.size > MAX_IMPORT_BYTES) return 0;
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const isZip = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
    if (!isZip) return 0;
    const COMPONENT_RE = /^files\/[^/]+\/components\/[^/]+\.json$/i;
    const files = await unzipAsync(buf, {
      maxEntryBytes: MAX_ZIP_ENTRY_BYTES,
      maxTotalBytes: MAX_ZIP_TOTAL_BYTES,
      tooLarge: name => `This archive expands too large to import (${name}).`,
      pick: (name) => COMPONENT_RE.test(name),
    });
    // Records, not logical components: a variant set collapses to one template,
    // so this is an upper bound used only to decide whether to offer the option.
    return Object.keys(files).filter((p) => COMPONENT_RE.test(p)).length;
  } catch {
    return 0;   // unreadable archive: the board import reports that itself
  }
}

async function parsePenpotBinfileTemplates(
  files: Record<string, Uint8Array>, manifest: any,
  { host, warn, interactive, map }: {
    host: HostV1 | undefined; warn: (msg: string) => void; interactive?: boolean; map?: DesignMapOptions;
  },
): Promise<DesignTemplatesResult> {
  const empty: DesignTemplatesResult = { templates: [], externalInstances: 0 };
  const fileId = Array.isArray(manifest.files) && manifest.files[0] ? manifest.files[0].id : null;
  if (!fileId) return empty;

  const pageDir = `files/${fileId}/pages/`;
  const pageShapes = new Map<string, string[]>();
  for (const path of Object.keys(files)) {
    if (!path.startsWith(pageDir)) continue;
    const m = path.slice(pageDir.length).match(/^([^/]+)\/([^/]+)\.json$/i);
    if (m) { if (!pageShapes.has(m[1]!)) pageShapes.set(m[1]!, []); pageShapes.get(m[1]!)!.push(path); }
  }
  if (!pageShapes.size) return empty;

  const componentDir = `files/${fileId}/components/`;
  const records: any[] = [];
  for (const path of Object.keys(files)) {
    if (!path.startsWith(componentDir) || !/\.json$/i.test(path)) continue;
    const rec = safeJsonParse(strFromU8(files[path]!));
    if (rec) records.push(rec);
  }

  // Every page's shapes: a master can live on any page (Penpot's convention is a
  // "Main components" page, but the collector resolves by id, not by page name).
  const pages = new Map<string, Record<string, any>>();
  for (const [pid, paths] of pageShapes) {
    const shapesById: Record<string, any> = {};
    for (const path of paths) {
      const shape = safeJsonParse(strFromU8(files[path]!));
      if (shape && shape.id) shapesById[shape.id] = shape;
    }
    pages.set(pid, shapesById);
  }

  const collected = collectPenpotComponents(records, pages, { fileId });
  // One aggregated line for libraries this export does not carry (plan section 2.3):
  // the instances themselves still import fine on the board path, they are full
  // copies, so nothing regressed - there is simply no master to template.
  if (collected.externals.instances > 0) {
    const n = collected.externals.components.length;
    warn(n === 1
      ? '1 component comes from an external shared library and was not saved as a template. Export that library as .penpot and import it too.'
      : `${n} components come from external shared libraries and were not saved as templates. Export those libraries as .penpot and import them too.`);
  }
  if (collected.warnings.length) {
    warn(collected.warnings.length === 1
      ? 'Skipped 1 component whose master artwork is missing from the export.'
      : `Skipped ${collected.warnings.length} components whose master artwork is missing from the export.`);
  }
  if (!collected.components.length) return { ...empty, externalInstances: collected.externals.instances };

  // Fonts before any box mapping, exactly like the other two walks. Handed the
  // caller's map, an already-ensured deck resolves every family and this is a
  // no-op (no refetch, no repeated warning).
  map = await ensurePenpotDeckFonts(files, pageDir, { host, warn, interactive, map });

  // Local instance roots by the component record they copy. Penpot writes a
  // component preview for a frame it has rendered, which for a deck is usually
  // the PLACED copies rather than the master sitting on the components page (in
  // the UXDays keynote all 8 previews belong to instances), so an instance's
  // preview is the fallback for a master that has none - it depicts the same
  // component. `componentFile` must match: foreign instances reuse local
  // componentIds (the phase 1.1 trap), and a library's preview is not this
  // component's picture.
  const instancesByComponent = new Map<string, Array<{ pageId: string; frameId: string }>>();
  for (const [pid, shapesById] of pages) {
    for (const shape of Object.values(shapesById)) {
      const cid = shape && typeof shape === 'object' ? String(shape.componentId ?? '') : '';
      if (!cid || shape.mainInstance === true || String(shape.componentFile ?? '') !== fileId) continue;
      if (!instancesByComponent.has(cid)) instancesByComponent.set(cid, []);
      instancesByComponent.get(cid)!.push({ pageId: pid, frameId: String(shape.id) });
    }
  }

  const imageCache = new Map<string, AssetRef>();
  const templates: DesignTemplate[] = [];
  const capped = collected.components.length > MAX_TEMPLATES;
  for (const comp of collected.components.slice(0, MAX_TEMPLATES)) {
    const shapesById = pages.get(comp.pageId);
    if (!shapesById || !shapesById[comp.rootShapeId]) continue;
    try {
      // The scenes walk's subtree step, verbatim: paint-order DFS, hidden
      // subtrees pruned, pure-vector groups collapsed to one baked SVG.
      const items = penpotMarkSubtree(shapesById, comp.rootShapeId, new Set<string>());
      const srcIds: string[] = [];
      const nodes = await penpotItemsToNodes(items, { host, files, fileId, imageCache, warn, srcIds });
      if (!nodes.length) continue;
      const { width, height } = shiftToOrigin(nodes);
      const boxes = finalizeBoxes(nodes, map);
      if (!boxes.length) continue;

      // Slots → boxes. The engine reads the slots off the master subtree (text
      // shapes and image fills); alignBoxIds says which box each mapped node
      // became. A slot whose shape produced no box of its own (it was baked into
      // a flattened vector group, or dropped as degenerate) is left out rather
      // than pointed at something else.
      const boxIdByShape = new Map<string, string>();
      const ids = alignBoxIds(nodes, boxes);
      for (let i = 0; i < srcIds.length; i++) {
        const boxId = ids[i];
        if (srcIds[i] && boxId) boxIdByShape.set(srcIds[i]!, boxId);
      }
      const slots: DesignTemplateSlot[] = [];
      for (const s of penpotComponentSlots(shapesById[comp.rootShapeId], (id) => shapesById[id])) {
        const boxId = boxIdByShape.get(s.shapeId);
        if (!boxId) continue;
        slots.push({ boxId, kind: s.kind, label: s.label, ...(s.text ? { text: s.text } : {}) });
      }

      // Penpot's own component preview, when the export carried one: untrusted
      // bytes, sniffed and size-capped, used as an image source only. The
      // master's own preview first, then any local instance of any of its
      // variants (see instancesByComponent above).
      let thumb = penpotComponentThumb(files, fileId, comp.pageId, comp.rootShapeId);
      for (const v of comp.variants) {
        if (thumb) break;
        for (const inst of instancesByComponent.get(v.id) ?? []) {
          thumb = penpotComponentThumb(files, fileId, inst.pageId, inst.frameId);
          if (thumb) break;
        }
      }
      templates.push({
        name: comp.name || 'Component',
        path: comp.path || '',
        boxes,
        width,
        height,
        slots,
        ...(thumb ? { thumb } : {}),
      });
    } catch (err) {
      warn(`Couldn’t save “${comp.name}” as a template (${String((err as Error) && (err as Error).message || err)}).`);
    }
  }
  if (capped) warn(`This file defines more than ${MAX_TEMPLATES} components. Only the first ${MAX_TEMPLATES} were saved as templates.`);
  return { templates, externalInstances: collected.externals.instances };
}
