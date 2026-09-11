// SPDX-License-Identifier: MPL-2.0
/**
 * PPTX upload import - slides as standalone SVG user assets.
 *
 * The .pptx sibling of pdf-import.ts's page path: the SAME handle shape
 * (PdfHandle/PdfPageSvg), the SAME pickPdfPages dialog, and the SAME
 * storeUserUpload destination, so a deck dropped on any upload surface behaves
 * exactly like a multi-page PDF - the user picks which slides become assets.
 *
 * The renderer (pptxSlideToSvg) is a PURE string builder over the engine's
 * pptx-read model - no DOM APIs - so the root test suite exercises it directly
 * in node. It is an APPROXIMATION by design: solid fills, outlined shapes,
 * per-paragraph text lines, table grids, and inlined png/jpeg media; charts,
 * SmartArt, and other media degrade to labeled placeholder rects. The stored
 * SVG must survive storeUserUpload's DOMPurify pass, which allows
 * data:image/png|jpeg hrefs on <image> - which is why ONLY inline png/jpeg
 * media is resolved and everything else placeholders.
 *
 * Module-scope imports here MUST stay node-safe (engine + the pptx bridge):
 * pdf-import.ts pulls pdf-lib in at module scope and picker.ts pulls CSS, so
 * both are imported lazily inside ingestPptxAsSvgAssets.
 */

import { EMU_PER_PX, finalizeBoxes, isPptx, readPptx } from '@lolly/engine';
import type { PageText, TextBlock } from '@lolly/engine';
import type { DesignMapOptions } from '../../../../engine/src/design-map.ts';
import { inflatePptx } from '../bridge/pptx.ts';
import { rasterSize } from './svg-unpack.ts';
import { parseFontMetadata, detectFontFormat, readFontEmbedding } from '../lib/font-utils.ts';
import type {
  PptxDeckRead, PptxParts, PptxReadColor, PptxReadPara, PptxReadSlide, PptxReadTheme,
  PptxPicNode, PptxShapeNode, PptxTableNode, PptxTextNode,
} from '../../../../engine/src/pptx-read.ts';
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
// Type-only - erased at runtime, so this does NOT load the pdf-lib chunk.
import type { PdfHandle, PdfPageSvg, PdfPageFrame, PickPagesIntent, EmbeddedImage, EmbeddedImageScan, EmbeddedFont } from './pdf-import.ts';

// ── rendering constants ────────────────────────────────────────────────────────

const PX_PER_PT = 96 / 72;
/** Run/paragraph size when the deck declares none (PowerPoint's usual body size). */
const DEFAULT_SIZE_PT = 18;
/** Paragraph advance: 1.25 × the paragraph's max size (PowerPoint's single-spacing feel). */
const LINE_HEIGHT = 1.25;
/** A media part bigger than this is not inlined - the pic degrades to a placeholder. */
const MAX_MEDIA_BYTES = 4 * 1024 * 1024;
const MAX_TABLE_ROWS = 20;
const MAX_TABLE_COLS = 12;
const TABLE_TEXT_PT = 11;
const PLACEHOLDER_FILL = '#e8e8e8';
const PLACEHOLDER_INK = '#8a8a8a';

// ── small helpers (mirror pdf-import.ts) ───────────────────────────────────────

function msg(err: unknown): string { return String((err && (err as Error).message) || err); }
function r(v: number): number { return Math.round((+v || 0) * 100) / 100; }
function px(emu: number): number { return emu / EMU_PER_PX; }

function xmlEsc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'));
}

/** `#RRGGBB` when the colour carries a hex (literal OR theme-resolved scheme), else null. */
function hexAttr(c: PptxReadColor | undefined): string | null {
  return c?.hex ? `#${c.hex}` : null;
}

// Base64 in chunks - String.fromCharCode(...bigArray) overflows the call stack.
function bytesToBase64(u8: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) bin += String.fromCharCode(...u8.subarray(i, i + CHUNK));
  return btoa(bin);
}

// ── the pure slide renderer ────────────────────────────────────────────────────

export interface PptxSlideRenderOpts {
  widthEmu: number;
  heightEmu: number;
  theme: PptxReadTheme;
  /** Resolve a media part path (e.g. "ppt/media/image1.png") to an inlineable
   *  data: URI - null when missing, oversized, or not png/jpeg. */
  getMedia: (path: string) => { dataUrl: string } | null;
}

interface RenderCtx {
  /** Text ink fallback: theme dk1, else black. */
  ink: string;
  /** Body typeface fallback: theme minorFont, else sans-serif. */
  bodyFont: string;
  getMedia: PptxSlideRenderOpts['getMedia'];
}

/**
 * Render ONE read-model slide to a standalone SVG document (the PdfPageSvg
 * shape, so pickPdfPages and the ingest loop take it unchanged). Pure string
 * building - no DOM. `elementCount` counts drawn content nodes (the background
 * rect excluded), so a blank slide reports 0 and gets skipped like a blank PDF
 * page.
 */
export function pptxSlideToSvg(slide: PptxReadSlide, opts: PptxSlideRenderOpts): PdfPageSvg {
  const width = Math.max(1, Math.round(px(opts.widthEmu)));
  const height = Math.max(1, Math.round(px(opts.heightEmu)));
  // The slide's own ground (engine 1.166: slide → layout → master), else the theme's lt1.
  const bg = hexAttr(slide.background?.color) ?? (opts.theme.colors.lt1 ? `#${opts.theme.colors.lt1}` : '#ffffff');
  const ctx: RenderCtx = {
    ink: opts.theme.colors.dk1 ? `#${opts.theme.colors.dk1}` : '#000000',
    bodyFont: opts.theme.minorFont || 'sans-serif',
    getMedia: opts.getMedia,
  };

  let elementCount = 0;
  const body: string[] = [];
  // A picture ground paints over the colour and under everything else.
  const bgMedia = slide.background?.media ? opts.getMedia(slide.background.media) : null;
  if (bgMedia) {
    body.push(`<image x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" href="${xmlEsc(bgMedia.dataUrl)}"/>`);
    elementCount++;
  }
  // Inherited furniture (the layout's and master's shapes) first, then the slide's own.
  for (const node of [...(slide.inherited ?? []), ...slide.nodes]) {
    const x = px(node.xEmu), y = px(node.yEmu);
    const w = Math.max(0, px(node.cxEmu)), h = Math.max(0, px(node.cyEmu));
    let markup = '';
    switch (node.type) {
      case 'shape': markup = renderShape(node, x, y, w, h); break;
      case 'text': markup = renderText(node, x, y, ctx); break;
      case 'pic': markup = renderPic(node, x, y, w, h, ctx); break;
      case 'table': markup = renderTable(node, x, y, w, h, ctx); break;
      default: markup = placeholder(x, y, w, h, 'Chart / SmartArt');
    }
    if (!markup) continue;
    elementCount++;
    body.push(node.rot
      ? `<g transform="rotate(${r(node.rot)} ${r(x + w / 2)} ${r(y + h / 2)})">${markup}</g>`
      : markup);
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${bg}"/>` +
    body.join('') +
    '</svg>';
  return { svg, width, height, elementCount };
}

function renderShape(node: PptxShapeNode, x: number, y: number, w: number, h: number): string {
  const fill = hexAttr(node.fill);
  const line = hexAttr(node.line);
  if (!fill && !line) return ''; // nothing visible - skip the node entirely
  const paint = ` fill="${fill ?? 'none'}"${line ? ` stroke="${line}" stroke-width="1.5"` : ''}`;
  if (node.geom === 'ellipse') {
    return `<ellipse cx="${r(x + w / 2)}" cy="${r(y + h / 2)}" rx="${r(w / 2)}" ry="${r(h / 2)}"${paint}/>`;
  }
  const rx = node.geom === 'roundRect' ? ` rx="${r(Math.min(w, h) * 0.15)}"` : '';
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}"${rx}${paint}/>`;
}

// Text is NOT clipped to its box in v1 - a per-node clipPath needs unique-id
// management across an SVG that may be re-inlined next to its siblings (see the
// SUSE illustration id-collision precedent), so overflow is accepted as part of
// the approximation.
function renderText(node: PptxTextNode, x: number, y: number, ctx: RenderCtx): string {
  const lines: string[] = [];
  let cursor = y;
  for (const para of node.paras) {
    const sizes = para.runs
      .map((run) => run.sizePt)
      .filter((n): n is number => typeof n === 'number' && n > 0);
    const maxPt = sizes.length ? Math.max(...sizes) : DEFAULT_SIZE_PT;
    const ascent = maxPt * PX_PER_PT; // em-box ascent approximation
    const baseline = cursor + ascent;
    cursor += ascent * LINE_HEIGHT; // an empty paragraph still advances (blank line)
    const spans = para.runs
      .filter((run) => run.text)
      .map((run) => {
        const attrs =
          ` font-family="${xmlEsc(run.font || ctx.bodyFont)}"` +
          ` font-size="${r((run.sizePt ?? DEFAULT_SIZE_PT) * PX_PER_PT)}"` +
          ` fill="${hexAttr(run.color) ?? ctx.ink}"` +
          (run.bold ? ' font-weight="bold"' : '') +
          (run.italic ? ' font-style="italic"' : '') +
          (run.underline ? ' text-decoration="underline"' : '');
        return `<tspan${attrs}>${xmlEsc(run.text)}</tspan>`;
      });
    if (spans.length) lines.push(`<text x="${r(x)}" y="${r(baseline)}">${spans.join('')}</text>`);
  }
  return lines.join('');
}

function renderPic(node: PptxPicNode, x: number, y: number, w: number, h: number, ctx: RenderCtx): string {
  const media = node.media ? ctx.getMedia(node.media) : null;
  if (media) {
    return `<image x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" preserveAspectRatio="none" href="${xmlEsc(media.dataUrl)}"/>`;
  }
  return placeholder(x, y, w, h, 'Image');
}

function renderTable(node: PptxTableNode, x: number, y: number, w: number, h: number, ctx: RenderCtx): string {
  const rows = node.rows.slice(0, MAX_TABLE_ROWS);
  const cols = Math.min(MAX_TABLE_COLS, Math.max(1, ...rows.map((row) => row.length)));
  const rowCount = Math.max(1, rows.length);
  const rowH = h / rowCount, colW = w / cols;
  const out: string[] = [
    `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="none" stroke="${ctx.ink}" stroke-width="1"/>`,
  ];
  for (let i = 1; i < rowCount; i++) {
    out.push(`<line x1="${r(x)}" y1="${r(y + rowH * i)}" x2="${r(x + w)}" y2="${r(y + rowH * i)}" stroke="${ctx.ink}" stroke-width="1"/>`);
  }
  for (let j = 1; j < cols; j++) {
    out.push(`<line x1="${r(x + colW * j)}" y1="${r(y)}" x2="${r(x + colW * j)}" y2="${r(y + h)}" stroke="${ctx.ink}" stroke-width="1"/>`);
  }
  const fontPx = r(TABLE_TEXT_PT * PX_PER_PT);
  rows.forEach((row, i) => {
    row.slice(0, cols).forEach((cell, j) => {
      if (!cell) return;
      out.push(
        `<text x="${r(x + colW * j + 4)}" y="${r(y + rowH * i + rowH / 2)}" dominant-baseline="middle"` +
        ` font-family="${xmlEsc(ctx.bodyFont)}" font-size="${fontPx}" fill="${ctx.ink}">${xmlEsc(cell)}</text>`,
      );
    });
  });
  return out.join('');
}

/** Light-grey labeled stand-in for content the renderer can't draw (charts,
 *  SmartArt, non-png/jpeg media) - the slide keeps its layout instead of a hole. */
function placeholder(x: number, y: number, w: number, h: number, label: string): string {
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${PLACEHOLDER_FILL}"/>` +
    `<text x="${r(x + w / 2)}" y="${r(y + h / 2)}" text-anchor="middle" dominant-baseline="middle"` +
    ` font-family="sans-serif" font-size="12" fill="${PLACEHOLDER_INK}">${xmlEsc(label)}</text>`;
}

// ── opening a deck (the PdfHandle shape) ───────────────────────────────────────

/** Open a .pptx for slide-level conversion - the same handle shape as openPdfFile,
 *  so pickPdfPages and the ingest loop work over either document kind. */
export async function openPptxFile(file: File | Blob, inflated?: PptxParts): Promise<PdfHandle> {
  // A caller that has already unzipped the package (design-import routes by the
  // zip's contents) hands the parts in, so a 12 MB deck is not inflated twice.
  const parts = inflated ?? await inflatePptx(new Uint8Array(await file.arrayBuffer()));
  if (!isPptx(parts)) throw new Error('Not a PowerPoint (.pptx) file.');
  // The parser is constructed here, not at module scope - node shells have no
  // DOMParser global (same rule as bridge/pptx.ts's createPptxAPI).
  const deck = readPptx(parts, (xml) => new DOMParser().parseFromString(xml, 'application/xml'));

  // Media parts inline as data: URIs so the stored SVG stays self-contained AND
  // survives storeUserUpload's DOMPurify pass (data:image/png|jpeg only).
  // Memoised per path - the same logo on every slide encodes once.
  const mediaCache = new Map<string, { dataUrl: string } | null>();
  const getMedia = (path: string): { dataUrl: string } | null => {
    const hit = mediaCache.get(path);
    if (hit !== undefined) return hit;
    let out: { dataUrl: string } | null = null;
    const ext = /\.(png|jpe?g)$/i.exec(path)?.[1]?.toLowerCase();
    const part = parts[path];
    if (ext && part instanceof Uint8Array && part.length > 0 && part.length <= MAX_MEDIA_BYTES) {
      out = { dataUrl: `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${bytesToBase64(part)}` };
    }
    mediaCache.set(path, out);
    return out;
  };

  const cache = new Map<number, PdfPageSvg>();
  return {
    pageCount: deck.slides.length,
    async pageToSvg(index: number): Promise<PdfPageSvg> {
      const hit = cache.get(index);
      if (hit) return hit;
      const slide = deck.slides[index];
      if (!slide) throw new Error(`No slide ${index + 1} in this deck.`);
      const out = pptxSlideToSvg(slide, {
        widthEmu: deck.widthEmu, heightEmu: deck.heightEmu, theme: deck.theme, getMedia,
      });
      cache.set(index, out);
      return out;
    },
    pageToText(index: number): PageText {
      return slideText(deck.slides[index]);
    },
    listPalette(): string[] {
      return deckPalette(deck);
    },
    listImages(): Promise<EmbeddedImageScan> {
      return Promise.resolve(deckImages(deck, parts));
    },
    listFonts(): EmbeddedFont[] {
      return deckFonts(deck, parts);
    },
  };
}

// ── Unpack extraction passes (over the same read model) ──────────────────────────

const emptyPptxPage = (): PageText =>
  ({ blocks: [], text: '', markdown: '', columns: 1, scanned: false, rotated: 0, order: 'geometric' });

/** A slide's on-canvas words, one block per paragraph then per table row, in the
 *  spTree order the reader walked (a fair reading order). */
export function slideText(slide: PptxReadSlide | undefined): PageText {
  if (!slide) return emptyPptxPage();
  const blocks: TextBlock[] = [];
  for (const n of slide.nodes) {
    if (n.type === 'text') {
      for (const p of n.paras) {
        const txt = p.runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
        if (!txt) continue;
        blocks.push({ kind: 'paragraph', text: txt, size: p.runs.find((r) => r.sizePt)?.sizePt || 0, bold: p.runs.some((r) => r.bold === true), column: 0 });
      }
    } else if (n.type === 'table') {
      for (const row of n.rows) {
        const txt = row.map((c) => c.replace(/\s+/g, ' ').trim()).filter(Boolean).join('  ·  ');
        if (txt) blocks.push({ kind: 'paragraph', text: txt, size: 0, bold: false, column: 0 });
      }
    }
  }
  if (!blocks.length) return emptyPptxPage();
  const text = blocks.map((b) => b.text).join('\n\n');
  return { blocks, text, markdown: text, columns: 1, scanned: false, rotated: 0, order: 'geometric' };
}

/** The deck's theme colours plus any literal-hex fills/lines/run colours it paints. */
export function deckPalette(deck: { slides: PptxReadSlide[]; theme: PptxReadTheme }): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (hex: string | null): void => {
    if (!hex) return;
    const lc = hex.toLowerCase();
    if (seen.has(lc)) return;
    seen.add(lc);
    out.push(lc);
  };
  for (const v of Object.values(deck.theme.colors || {})) if (/^[0-9a-f]{6}$/i.test(v)) push(`#${v}`);
  for (const slide of deck.slides) {
    for (const n of slide.nodes) {
      if (n.type === 'text') { push(hexAttr(n.fill)); for (const p of n.paras) for (const r of p.runs) push(hexAttr(r.color)); }
      else if (n.type === 'shape') { push(hexAttr(n.fill)); push(hexAttr(n.line)); }
    }
  }
  return out;
}

/** Raster media parts (png/jpeg/gif/bmp/webp/svg), deduped by part path. EMF/WMF
 *  vector metafiles are not rasters and are left out rather than reported as an
 *  image this cannot show. */
const RASTER_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  bmp: 'image/bmp', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff', svg: 'image/svg+xml',
};
export function deckImages(deck: { slides: PptxReadSlide[] }, parts: Record<string, Uint8Array | string>): EmbeddedImageScan {
  const images: EmbeddedImage[] = [];
  const seen = new Set<string>();
  deck.slides.forEach((slide, page) => {
    for (const n of slide.nodes) {
      if (n.type !== 'pic' || !n.media || seen.has(n.media)) continue;
      seen.add(n.media);
      const ext = /\.([a-z0-9]+)$/i.exec(n.media)?.[1]?.toLowerCase() || '';
      const mime = RASTER_MIME[ext];
      const bytes = parts[n.media];
      if (!mime || !(bytes instanceof Uint8Array) || !bytes.length) continue;
      const size = rasterSize(bytes);
      images.push({ bytes, mime, width: size?.w || 0, height: size?.h || 0, colorSpace: null, page });
    }
  });
  return { images, skipped: 0, skippedFilters: [] };
}

/** Fonts the deck names. An embedded `ppt/fonts/*.fntdata` whose bytes are a readable
 *  (un-obfuscated) font becomes a real downloadable face; every family the runs and
 *  theme reference otherwise comes back names-only. */
export function deckFonts(deck: { slides: PptxReadSlide[]; theme: PptxReadTheme }, parts: Record<string, Uint8Array | string>): EmbeddedFont[] {
  const byFamily = new Map<string, EmbeddedFont>();
  const add = (f: EmbeddedFont): void => {
    const key = f.family.toLowerCase();
    const cur = byFamily.get(key);
    // An embedded face (has bytes) always wins over a names-only reference.
    if (!cur || (cur.bytes.length === 0 && f.bytes.length > 0)) byFamily.set(key, f);
  };

  // Embedded fonts, if the export carries readable ones.
  for (const path of Object.keys(parts)) {
    if (!/^ppt\/fonts\/.+\.fntdata$/i.test(path)) continue;
    const bytes = parts[path];
    if (!(bytes instanceof Uint8Array) || !bytes.length) continue;
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const meta = parseFontMetadata(buf);
    const fmt = detectFontFormat(buf);
    if (!meta || fmt === 'unknown') continue;  // obfuscated / unreadable → leave to names-only
    add({
      name: meta.family, family: meta.family, ext: fmt, bytes,
      subset: false, installable: true,
      embedding: (() => { try { return readFontEmbedding(buf); } catch { return { permission: 'unknown', noSubsetting: false, bitmapOnly: false, fsType: null }; } })(),
    });
  }

  // Referenced families - theme majors/minors and any explicit run typeface.
  const names = new Set<string>();
  if (deck.theme.majorFont) names.add(deck.theme.majorFont);
  if (deck.theme.minorFont) names.add(deck.theme.minorFont);
  for (const slide of deck.slides) {
    for (const n of slide.nodes) if (n.type === 'text') for (const p of n.paras) for (const r of p.runs) if (r.font) names.add(r.font);
  }
  for (const fam of names) {
    const clean = fam.trim();
    if (!clean || clean.startsWith('+')) continue;  // '+mj-lt' style theme refs, not a family
    add({
      name: clean, family: clean, ext: 'ttf', bytes: new Uint8Array(0),
      subset: false, installable: false,
      embedding: { permission: 'unknown', noSubsetting: false, bitmapOnly: false, fsType: null },
    });
  }

  return [...byFamily.values()];
}

// ── content extraction (the #/convert output, from an upload surface) ──────────

/**
 * Download the deck's CONTENT as Markdown - a plain `.md`, or a zip of the markdown
 * plus its `media/` files when the deck carried images. Byte-identical to what
 * #/convert produces for the same file: both call the shared extractor.
 */
async function downloadDeckMarkdown(host: HostV1, file: File | Blob, name: string): Promise<void> {
  const { pptxToMarkdown, markdownDownload } = await import('../lib/office-text.ts');
  const content = await pptxToMarkdown(new Uint8Array(await file.arrayBuffer()));
  const base = name.replace(/\.pptx$/i, '').trim() || 'deck';
  await host.export.download(markdownDownload(content, 'deck.md'), `${base}.${content.media.length ? 'zip' : 'md'}`);
}

// ── upload-path entry (mirrors ingestPdfAsSvgAssets) ───────────────────────────

/**
 * Convert a .pptx into stored SVG user assets.
 *
 * One slide → converted directly. Multi-slide → the SAME pickPdfPages dialog asks
 * which (its copy says "page", generic enough with the deck's fileName in the
 * title; mode 'multi' offers all-of-them, 'single' picks one for a single slot).
 * Returns the stored refs - empty when cancelled or nothing converted. Per-slide
 * failures warn and continue.
 */
export async function ingestPptxAsSvgAssets(
  host: HostV1,
  file: File | Blob,
  { mode = 'multi', warn = () => {}, chooser = true, parts, intent = 'library' }: {
    mode?: 'single' | 'multi';
    warn?: (msg: string) => void;
    /** False when the CALLER already asked what to take from the deck (the drop
     *  router offers both routes in its own sheet), so no second dialog opens. */
    chooser?: boolean;
    /** The package already unzipped (see openPptxFile) - skips a second inflate. */
    parts?: PptxParts;
    /** What the picker says the slides will become (library / artboards / scenes). */
    intent?: PickPagesIntent;
  } = {},
): Promise<AssetRef[]> {
  const name = (file as File).name || 'deck.pptx';
  // A dropped deck can become two different things: its slides as pictures, or its
  // CONTENT as Markdown to re-flow into a branded tool (plans/139). Only the library
  // route asks - filling a single image slot has no use for a markdown download.
  // Dialog + i18n load lazily so this module's own scope stays node-importable.
  if (mode === 'multi' && chooser) {
    const [{ choiceDialog }, { t }] = await Promise.all([
      import('../components/confirm-dialog.ts'),
      import('../i18n.ts'),
    ]);
    const pick = await choiceDialog({
      title: t('Import a deck'),
      message: t('What should Lolly take from this deck?'),
      choices: [
        { id: 'slides', label: t('Add its slides to your library'), primary: true },
        { id: 'markdown', label: t('Extract content (Markdown)') },
      ],
    });
    if (!pick) return [];
    if (pick === 'markdown') { await downloadDeckMarkdown(host, file, name); return []; }
  }
  const handle = await openPptxFile(file, parts);
  if (!handle.pageCount) throw new Error('This deck has no slides.');

  let pages: number[];
  if (handle.pageCount === 1) {
    pages = [0];
  } else {
    // pickPdfPages is generic over the handle shape. Imported lazily: pdf-import
    // pulls pdf-lib in at MODULE scope, so a value import here would load the pdf
    // chunk for every deck (and break this module's node-side purity).
    const { pickPdfPages } = await import('./pdf-import.ts');
    const picked = await pickPdfPages(handle, { mode, fileName: name, intent });
    if (!picked?.length) return [];
    pages = picked;
  }

  // Lazy for the same reason - picker.ts is a DOM/CSS chunk.
  const { storeUserUpload } = await import('./picker.ts');
  const base = name.replace(/\.pptx$/i, '').trim() || 'slide';
  const refs: AssetRef[] = [];
  for (const p of pages) {
    try {
      const pageSvg = await handle.pageToSvg(p, { warn });
      if (!pageSvg.elementCount) { warn(`Slide ${p + 1} has no importable content - skipped.`); continue; }
      const svgName = handle.pageCount === 1 ? `${base}.svg` : `${base} - slide ${p + 1}.svg`;
      const svgFile = new File([pageSvg.svg], svgName, { type: 'image/svg+xml' });
      // storeUserUpload's param is a shell-internal PickerHost superset of HostV1;
      // the real host satisfies it at runtime (same object the picker uses).
      refs.push(await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], svgFile));
    } catch (err) {
      warn(`Couldn’t convert slide ${p + 1} (${msg(err)}).`);
    }
  }
  if (!refs.length && handle.pageCount === 1) throw new Error('Couldn’t find any importable content in this deck.');
  return refs;
}

// ── slides as EDITABLE boxes (Design import) ───────────────────────────────────
//
// The other thing a deck can become: not a picture of each slide but the slide's
// own parts as Design boxes - text you can retype, shapes you can recolour, the
// pictures as image boxes - one artboard per slide, or one slide replacing the board.
// The mapping is deliberately the SAME approximation `pptxSlideToSvg` draws (that is
// what the thumbnails in the slide picker show), expressed as the engine's
// DesignNodes and finalized through the same `finalizeBoxes` every other design
// import uses, so a slide's boxes are indistinguishable from a Figma frame's.

/** A stored ref for a media part, or null when it cannot be an image box. */
export type PptxMediaResolver = (path: string) => AssetRef | null;

export interface PptxNodeMapOpts {
  widthEmu: number;
  heightEmu: number;
  theme: PptxReadTheme;
  /** A media part path → an already-STORED asset ref (the caller owns the store). */
  resolveMedia: PptxMediaResolver;
}

/** A design node as this module builds it - the engine's DesignNode, loosely. */
export type PptxDesignNode = Record<string, unknown>;

/** Boxes a slide may map to before the tail is dropped - a text-heavy table alone
 *  can want hundreds, and Design is an editor, not a spreadsheet. */
export const MAX_SLIDE_NODES = 160;

/** Paragraph runs → the box's markdown-subset text: `**bold**`, `*italic*`, one
 *  line per paragraph (an empty paragraph keeps its blank line, as on the slide). */
export function pptxParasToText(paras: PptxReadPara[]): string {
  return paras.map((p) => p.runs.map((r) => {
    let m = r.text || '';
    if (!m.trim()) return m;
    if (r.bold) m = `**${m}**`;
    if (r.italic) m = `*${m}*`;
    return m;
  }).join('')).join('\n').replace(/\n+$/, '');
}

/**
 * ONE read-model slide → DesignNodes in slide px, paint order. Pure - no DOM, no
 * store: pictures come in through `resolveMedia`, so the test suite runs it on a
 * fixture and the importer runs it on a real deck with the refs it stored first.
 *
 *   text  → a text box: the paragraphs as markdown, size/face/ink/weight from the
 *           first sized run (the slide's own ink and body face when it says nothing),
 *           and the shape's fill (a coloured title bar) as the box's own background;
 *   shape → a box with the fill, the outline and the geometry (ellipse / rounded /
 *           rect - every other preset geometry is drawn as its bounding rect, the
 *           renderer's own approximation); an invisible shape is skipped;
 *   pic   → an image box stretched to its frame (`fit: fill`, what a placed picture
 *           is), or a labelled placeholder when the part could not be stored;
 *   table → an outlined box and one text box per cell, so every cell stays editable;
 *   other → a labelled placeholder (charts, SmartArt, OLE) - the slide keeps its
 *           layout instead of a hole, and the label says what was there.
 */
export function pptxSlideToNodes(slide: PptxReadSlide, opts: PptxNodeMapOpts): PptxDesignNode[] {
  const ink = opts.theme.colors.dk1 ? `#${opts.theme.colors.dk1}` : '#000000';
  const bodyFont = opts.theme.minorFont || '';
  const out: PptxDesignNode[] = [];
  const geo = (n: { xEmu: number; yEmu: number; cxEmu: number; cyEmu: number; rot?: number }) => ({
    x: r(px(n.xEmu)), y: r(px(n.yEmu)), w: r(Math.max(1, px(n.cxEmu))), h: r(Math.max(1, px(n.cyEmu))),
    ...(n.rot ? { rot: r(n.rot) } : {}),
  });
  // Light card + a small label naming the loss, so what did not survive is visible
  // on the slide rather than a hole in it.
  const placeholder = (g: ReturnType<typeof geo>, label: string): void => {
    out.push({ kind: 'box', ...g, fill: PLACEHOLDER_FILL, shape: 'rect' });
    const pad = Math.max(8, Math.round(Math.min(g.w, g.h) * 0.08));
    out.push({
      kind: 'text', x: g.x + pad, y: g.y + pad, w: Math.max(1, g.w - 2 * pad), h: Math.max(1, g.h - 2 * pad),
      ...(g.rot ? { rot: g.rot } : {}),
      text: label, fontSize: r(12 * PX_PER_PT), fg: PLACEHOLDER_INK, textAlign: 'center',
    });
  };

  // A picture ground: one image box under everything, cropped to the slide.
  const bgRef = slide.background?.media ? opts.resolveMedia(slide.background.media) : null;
  if (bgRef) {
    out.push({ kind: 'image', x: 0, y: 0, w: Math.max(1, Math.round(px(opts.widthEmu))), h: Math.max(1, Math.round(px(opts.heightEmu))), image: bgRef, fit: 'cover', fill: '' });
  }
  // Inherited furniture (engine 1.166) paints behind the slide's own nodes; the slide's
  // placeholders are the slots the furniture was designed around.
  for (const node of [...(slide.inherited ?? []), ...slide.nodes]) {
    if (out.length >= MAX_SLIDE_NODES) break;
    const g = geo(node);
    switch (node.type) {
      case 'text': {
        const runs = node.paras.flatMap((p) => p.runs).filter((run) => run.text && run.text.trim());
        const first = runs[0];
        const sized = runs.find((run) => typeof run.sizePt === 'number' && run.sizePt > 0);
        const pt = sized?.sizePt ?? DEFAULT_SIZE_PT;
        // A slide-number field arrives as its `‹#›` token; on a board the number itself
        // is what was on the page.
        const text = node.ph?.type === 'sldNum'
          ? pptxParasToText(node.paras).replace(/‹#›/g, String(slide.index + 1))
          : pptxParasToText(node.paras);
        const fill = hexAttr(node.fill);
        // Nothing to read AND nothing to see: skip. A filled but empty text shape is
        // still a shape (a colour bar drawn with the text tool), so it stays as a box.
        if (!text.trim() && !fill) break;
        out.push({
          kind: text.trim() ? 'text' : 'box', ...g,
          text,
          fontSize: r(pt * PX_PER_PT),
          fontFamily: first?.font || bodyFont,
          fontWeight: first?.bold ? 700 : 400,
          fg: hexAttr(first?.color) ?? ink,
          lineHeight: LINE_HEIGHT,
          ...(fill ? { fill } : { fill: '' }),
          shape: node.geom === 'ellipse' ? 'ellipse' : node.geom === 'roundRect' ? 'rounded' : 'rect',
        });
        break;
      }
      case 'shape': {
        const fill = hexAttr(node.fill);
        const line = hexAttr(node.line);
        if (!fill && !line) {
          // An EMPTY content placeholder (a template's title / body slot, no fill, no
          // outline, nothing typed) becomes an empty text box where the slot is - so a
          // template imported as artboards keeps its slots to type into. Furniture
          // slots (slide number, footer, date) and undecorated non-placeholder shapes
          // stay invisible, as they are on the slide.
          const kind = phKind(node.ph?.type);
          if (node.ph && (kind === 'title' || kind === 'body' || kind === 'subTitle')) {
            out.push({
              kind: 'text', ...g, text: '', fill: '',
              fontSize: r((kind === 'title' ? 28 : DEFAULT_SIZE_PT) * PX_PER_PT),
              fontFamily: kind === 'title' ? (opts.theme.majorFont || bodyFont) : bodyFont,
              fontWeight: kind === 'title' ? 700 : 400,
              fg: ink, lineHeight: LINE_HEIGHT,
            });
          }
          break;
        }
        out.push({
          kind: 'box', ...g,
          fill: fill ?? '',
          shape: node.geom === 'ellipse' ? 'ellipse' : node.geom === 'roundRect' ? 'rounded' : 'rect',
          ...(line ? { stroke: line, strokeW: r(Math.max(0.75, node.lineWidthPt ?? 1) * PX_PER_PT) } : {}),
        });
        break;
      }
      case 'pic': {
        const ref = node.media ? opts.resolveMedia(node.media) : null;
        if (ref) out.push({ kind: 'image', ...g, image: ref, fit: 'fill', fill: '' });
        else placeholder(g, 'Image');
        break;
      }
      case 'table': {
        const rows = node.rows.slice(0, MAX_TABLE_ROWS);
        if (!rows.length) break;
        const cols = Math.min(MAX_TABLE_COLS, Math.max(1, ...rows.map((row) => row.length)));
        const rowH = g.h / Math.max(1, rows.length), colW = g.w / cols;
        out.push({ kind: 'box', ...g, fill: '', shape: 'rect', stroke: ink, strokeW: 1 });
        rows.forEach((row, i) => {
          row.slice(0, cols).forEach((cell, j) => {
            if (!cell || out.length >= MAX_SLIDE_NODES) return;
            out.push({
              kind: 'text',
              x: r(g.x + colW * j + 4), y: r(g.y + rowH * i), w: r(Math.max(1, colW - 8)), h: r(Math.max(1, rowH)),
              text: cell, fontSize: r(TABLE_TEXT_PT * PX_PER_PT), fontFamily: bodyFont, fg: ink, fill: '',
            });
          });
        });
        break;
      }
      default:
        placeholder(g, 'Chart / SmartArt');
    }
  }
  // The slide's narration, last, so it never sits under a picture in paint order
  // (plans/180 section 5, the import side). It paints nothing anyway: the Design tool
  // treats a box whose asset is typed `audio` as a TIMELINE citizen, hides its marker
  // and keeps the box transparent, so the marker's geometry only decides where the
  // clip's handle sits on the board.
  //
  // The node's kind is `image`, not `audio`, and that is the engine's mapper talking:
  // `nodeToBox` knows three kinds (box / text / image), and audio-ness is a property of
  // the ASSET, which is exactly how a Design audio box is recognised today. The group is
  // deliberately NOT set to `narration:<frameId>`: frame ids do not exist yet at this
  // point, and that group is the Narrate flow's contract over clips it generated - an
  // imported clip is someone else's recording, and claiming otherwise would invite a
  // re-generate to replace it.
  //
  // Captions for it must come from Whisper under TRANSCRIPT_META_KEY, never `meta.tts`:
  // we did not synthesise this audio and hold no word timings for it. Two different
  // claims about origin, and the credential depends on keeping them apart.
  const audioRef = slide.audio?.part ? opts.resolveMedia(slide.audio.part) : null;
  if (audioRef && out.length < MAX_SLIDE_NODES) {
    const side = Math.max(1, Math.round(Math.min(px(opts.widthEmu), px(opts.heightEmu)) * 0.08));
    out.push({
      kind: 'image', image: audioRef, fill: '', fit: 'contain',
      x: side / 2, y: Math.max(0, Math.round(px(opts.heightEmu)) - side - side / 2), w: side, h: side,
    });
  }
  return out;
}

/** `title`/`ctrTitle` are one slot; an absent type is `body` (ECMA-376's untyped `ph`). */
function phKind(type: string | undefined): string {
  if (!type) return 'body';
  return type === 'ctrTitle' ? 'title' : type;
}

/** The slide size in px and the deck's ground (the theme's lt1, as the renderer paints it). */
export function pptxDeckPage(deck: PptxDeckRead): { width: number; height: number; background: string } {
  return {
    width: Math.max(1, Math.round(px(deck.widthEmu))),
    height: Math.max(1, Math.round(px(deck.heightEmu))),
    background: deck.theme.colors.lt1 ? `#${deck.theme.colors.lt1}` : '#ffffff',
  };
}

/** ONE slide's ground colour: its own (slide → layout → master, engine 1.166), else the deck's. */
export function pptxSlideBackground(slide: PptxReadSlide, deck: PptxDeckRead): string {
  return hexAttr(slide.background?.color) ?? pptxDeckPage(deck).background;
}

/**
 * Speaker notes are worth as much as the slide (plan 179 P2). `readPptx` has parsed a
 * slide's notesSlide into `slide.notes` since engine 1.x, and this module simply never
 * read the field - so importing a rehearsed deck silently threw the whole script away,
 * and a re-export could not put it back (P1). Verbatim text: a note is prose, never
 * markup, and the Design frame field it fills is a plain textarea.
 */
const MAX_NOTES_CHARS = 20_000;
export function pptxSlideNotes(slide: PptxReadSlide | undefined): string | undefined {
  const raw = typeof slide?.notes === 'string' ? slide.notes : '';
  // CRLF is normal in OOXML text; the frame field and the speaker view both want \n.
  const text = raw.replace(/\r\n?/g, '\n').trim();
  if (!text) return undefined;
  return text.length > MAX_NOTES_CHARS ? `${text.slice(0, MAX_NOTES_CHARS)}…` : text;
}

/** One imported slide as an artboard row: geometry + ground + its speaker notes. */
export type PptxPageFrame = PdfPageFrame & { notes?: string };

/**
 * The artboard row a slide becomes - pure, so the notes/name/ground rules are testable
 * without a zip, a host or a DOM. `index` is the slide's 0-based place in the DECK (the
 * frame keeps the slide's own number even when the picker skipped its neighbours).
 */
export function pptxSlideFrame(
  slide: PptxReadSlide, deck: PptxDeckRead, boxes: unknown[], index: number,
  page: { width: number; height: number },
): PptxPageFrame {
  const notes = pptxSlideNotes(slide);
  return {
    name: `Slide ${index + 1}`,
    width: page.width,
    height: page.height,
    boxes,
    background: pptxSlideBackground(slide, deck),
    ...(notes ? { notes } : {}),
  };
}

/** Media extension → MIME for the parts an image box can hold. Anything else (emf,
 *  wmf, tiff, video…) stays a placeholder rather than an unreadable asset. */
const MEDIA_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
};

/** Extension → MIME for a slide's NARRATION part (plans/180 section 5, the import side).
 *  Separate from MEDIA_MIME because these are the sounds an audio box can hold, not the
 *  pictures an image box can; the store types the ref `audio` from the MIME, which is
 *  what makes the Design tool treat the box as a timeline citizen rather than a picture. */
const AUDIO_MIME: Record<string, string> = {
  wav: 'audio/wav', wave: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4',
  mp4: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg',
  opus: 'audio/ogg', flac: 'audio/flac', wma: 'audio/x-ms-wma',
};

/**
 * A media resolver that STORES each part once through the picker's ingest funnel
 * (DOMPurify for an SVG part, metadata + checksum for a raster) and memoises the
 * ref - the same logo on forty slides is one asset. Async on the outside (the
 * store is), synchronous inside the mapper: `prime` stores every path the picked
 * slides reference BEFORE `pptxSlideToNodes` runs.
 */
async function primeMedia(
  host: HostV1, parts: PptxParts, slides: PptxReadSlide[], warn: (msg: string) => void,
): Promise<PptxMediaResolver> {
  const { storeUserUpload } = await import('./picker.ts');
  const refs = new Map<string, AssetRef | null>();
  const paths: string[] = [];
  for (const slide of slides) {
    if (slide.background?.media) paths.push(slide.background.media);
    for (const node of [...(slide.inherited ?? []), ...slide.nodes]) if (node.type === 'pic' && node.media) paths.push(node.media);
    // The slide's narration part, stored the same way a picture is (plans/180).
    if (slide.audio?.part) paths.push(slide.audio.part);
  }
  {
    for (const path of paths) {
      if (refs.has(path)) continue;
      const part = parts[path];
      const ext = (/\.([a-z0-9]+)$/i.exec(path)?.[1] ?? '').toLowerCase();
      const mime = MEDIA_MIME[ext] ?? AUDIO_MIME[ext];
      if (!(part instanceof Uint8Array) || !part.length || part.length > MAX_MEDIA_BYTES || !mime) { refs.set(path, null); continue; }
      try {
        const file = new File([part as BlobPart], path.split('/').pop() || `image.${ext}`, { type: mime });
        // `batch`: a deck re-imported, or two decks sharing a logo, must not ask per picture.
        refs.set(path, await storeUserUpload(host as Parameters<typeof storeUserUpload>[0], file, { batch: true }));
      } catch (err) {
        warn(`Couldn’t store an image from the deck (${msg(err)}).`);
        refs.set(path, null);
      }
    }
  }
  return (path) => refs.get(path) ?? null;
}

function readDeck(parts: PptxParts): PptxDeckRead {
  if (!isPptx(parts)) throw new Error('Not a PowerPoint (.pptx) file.');
  return readPptx(parts, (xml) => new DOMParser().parseFromString(xml, 'application/xml'));
}

/**
 * ONE slide of a deck as Design boxes replacing the board - the .pptx twin of
 * `parsePdfFile`. A multi-slide deck asks which slide through the shared page picker
 * when `interactive`, else takes the first with a warning; `page` (0-based) wins.
 */
export async function parsePptxFile(
  file: File | Blob,
  parts: PptxParts,
  { host, warn = () => {}, page, interactive, map }: {
    host: HostV1; warn?: (msg: string) => void; page?: number; interactive?: boolean; map?: DesignMapOptions;
  },
): Promise<{ boxes: unknown[]; width: number; height: number; background: string }> {
  const deck = readDeck(parts);
  const count = deck.slides.length;
  if (!count) throw new Error('This deck has no slides.');
  let index = Math.min(Math.max(Math.floor(page ?? 0), 0), count - 1);
  if (count > 1 && page == null) {
    if (interactive) {
      const [{ pickPdfPages }, handle] = await Promise.all([import('./pdf-import.ts'), openPptxFile(file, parts)]);
      const picked = await pickPdfPages(handle, { mode: 'single', fileName: (file as File).name || '' });
      if (!picked?.length) throw new Error('Import cancelled.');
      index = picked[0]!;
    } else {
      warn(`Imported the first of ${count} slides.`);
    }
  }
  const slide = deck.slides[index]!;
  const resolveMedia = await primeMedia(host, parts, [slide], warn);
  const { width, height } = pptxDeckPage(deck);
  const boxes = finalizeBoxes(pptxSlideToNodes(slide, { widthEmu: deck.widthEmu, heightEmu: deck.heightEmu, theme: deck.theme, resolveMedia }) as never, { prefix: 's', ...map });
  if (!boxes.length) throw new Error('Couldn’t find any importable content on that slide.');
  return { boxes, width, height, background: pptxSlideBackground(slide, deck) };
}

/**
 * SEVERAL slides as editable frames - the artboards import, `parsePdfPages`' twin.
 * `pages` (0-based) names the slides; without it an interactive caller gets the
 * shared picker with every slide pre-selected, a headless one takes them all (to
 * the picker's own ceiling). A slide that maps to nothing is warned about and
 * skipped; the frame keeps the slide's number as its name.
 */
export async function parsePptxPages(
  file: File | Blob,
  parts: PptxParts,
  { host, warn = () => {}, pages, interactive, map }: {
    host: HostV1; warn?: (msg: string) => void; pages?: number[]; interactive?: boolean; map?: DesignMapOptions;
  },
): Promise<{ frames: PptxPageFrame[]; background: string }> {
  const deck = readDeck(parts);
  const count = deck.slides.length;
  if (!count) throw new Error('This deck has no slides.');
  const { MAX_PAGE_FRAMES } = await import('./pdf-import.ts');
  let picked: number[];
  if (Array.isArray(pages) && pages.length) {
    picked = pages.map((p) => Math.floor(p)).filter((p) => p >= 0 && p < count);
  } else if (count > 1 && interactive) {
    const [{ pickPdfPages }, handle] = await Promise.all([import('./pdf-import.ts'), openPptxFile(file, parts)]);
    const chosen = await pickPdfPages(handle, { mode: 'multi', fileName: (file as File).name || '', intent: 'artboards' });
    if (!chosen?.length) throw new Error('Import cancelled.');
    picked = chosen;
  } else {
    picked = Array.from({ length: Math.min(count, MAX_PAGE_FRAMES) }, (_, i) => i);
    if (count > MAX_PAGE_FRAMES) warn(`This deck has ${count} slides - only the first ${MAX_PAGE_FRAMES} were imported.`);
  }
  const slides = picked.map((i) => deck.slides[i]!).filter(Boolean);
  const resolveMedia = await primeMedia(host, parts, slides, warn);
  const { width, height, background } = pptxDeckPage(deck);
  const frames: PptxPageFrame[] = [];
  for (const i of picked) {
    const slide = deck.slides[i];
    if (!slide) continue;
    const boxes = finalizeBoxes(pptxSlideToNodes(slide, { widthEmu: deck.widthEmu, heightEmu: deck.heightEmu, theme: deck.theme, resolveMedia }) as never, { prefix: 's', ...map });
    if (!boxes.length) { warn(`Slide ${i + 1} has no importable content - skipped.`); continue; }
    frames.push(pptxSlideFrame(slide, deck, boxes, i, { width, height }));
  }
  if (!frames.length) throw new Error('Couldn’t find any importable content in this deck.');
  return { frames, background };
}
