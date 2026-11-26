// SPDX-License-Identifier: MPL-2.0
/**
 * Word (.docx) export: the rendered document node to the engine's `writeDocx`.
 *
 * `doc-blocks.ts` reads the words, headings, lists, tables and pictures off the node.
 * This module adds the three things the block model does not carry, each read from the
 * same rendered page the PDF is drawn from:
 *
 * - the page: its size and margins, so an A4 document is an A4 document in Word. A
 *   physical export size (the size select sets one) wins; otherwise the laid-out page
 *   box at 96 px to the inch. `snapDocxPage` gives a standard paper size its exact twips;
 * - the styles: the face body text is set in, the design system's headings face, and
 *   the design system's text colour, written as document defaults and Heading styles,
 *   never per run;
 * - for an SVG picture, a PNG of the same artwork at print resolution, so a reader
 *   that cannot draw SVG still shows the picture. The PNG is drawn from the SVG's own
 *   bytes with no imprint, so nothing enters the file that the SVG does not already say.
 */
import { contrastRatio, isUnit, snapDocxPage, toPoints, writeDocx, type DocxMedia, type DocxPage, type DocxStyles } from '@lolly/engine';
import { domToRichDoc } from './doc-blocks.ts';
import { canvasColorResolver, rasterizeSvgBytes, sourceAuthorOf } from './office-shared.ts';
import { deckColor, firstFontFamily } from './pptx-deck.ts';
import type { ExportOpts } from './export-shared.ts';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** 1440 twips to the inch, 96 CSS px to the inch. */
const TWIPS_PER_PX = 15;
/** The resolution a picture's PNG is drawn at, over the size it shows at on the page. */
const PRINT_DPI = 300;
/** The PNG's longest side, whatever the picture's size. */
const MAX_FALLBACK_PX = 3000;
/** A text colour is named only when it reads on the white page Word gives a document. */
const MIN_TEXT_CONTRAST = 4.5;

/** The first laid-out page of a paged document, or null for a node with none. */
function firstPage(node: Element): HTMLElement | null {
  const el = node.matches?.('[data-pdf-page]') ? node : node.querySelector?.('[data-pdf-page]');
  return el && typeof (el as HTMLElement).offsetWidth === 'number' ? el as HTMLElement : null;
}

/**
 * The page the document is laid out on, in twips, or undefined to keep the writer's
 * own US Letter page (a node that is not a paged document).
 *
 * The margins are the text area's place on the page: Doc Studio's `.doc-body` sits
 * inside `.doc-page` at the page's own margins, so each margin is the gap between the
 * two boxes as a share of the page, which holds at any scale the export stage draws at.
 */
export function docxPageOf(node: Element, opts: Pick<ExportOpts, 'width' | 'height' | 'unit'> = {}): DocxPage | undefined {
  const page = firstPage(node);
  if (!page) return undefined;
  const pw = page.offsetWidth, ph = page.offsetHeight;
  if (!(pw > 0 && ph > 0)) return undefined;
  let w = pw * TWIPS_PER_PX, h = ph * TWIPS_PER_PX;
  const unit = String(opts.unit ?? '');
  const ow = Number(opts.width), oh = Number(opts.height);
  if (unit !== 'px' && isUnit(unit) && ow > 0 && oh > 0) {
    w = toPoints({ value: ow, unit }) * 20;
    h = toPoints({ value: oh, unit }) * 20;
  }
  const size = snapDocxPage(w, h);
  const body = page.querySelector('.doc-body');
  if (!body) return size;
  const pr = page.getBoundingClientRect(), br = body.getBoundingClientRect();
  if (!(pr.width > 0 && pr.height > 0)) return size;
  const kx = size.width / pr.width, ky = size.height / pr.height;
  const left = br.left - pr.left, top = br.top - pr.top;
  const right = pr.right - br.right, bottom = pr.bottom - br.bottom;
  if (![left, top, right, bottom].every((v) => Number.isFinite(v) && v >= 0)) return size;
  return {
    ...size,
    margin: {
      top: Math.round(top * ky), right: Math.round(right * kx),
      bottom: Math.round(bottom * ky), left: Math.round(left * kx),
    },
  };
}

/**
 * The document's faces and text colours, read off the canvas cascade the page was drawn
 * with. Body text takes the face the document's text is set in (the design system's
 * text face, or the mono face when the person chose that one). Headings take the design
 * system's headings face, or the body face where it declares none. Both take the
 * design system's text colour, when that colour reads on a white page.
 */
export function docxStylesOf(node: Element): DocxStyles | undefined {
  const resolve = canvasColorResolver(node);
  if (!resolve) return undefined;
  const textEl = node.matches?.('.doc') ? node : node.querySelector?.('.doc') ?? node;
  let bodyStack = '';
  try { bodyStack = getComputedStyle(textEl).fontFamily; } catch { /* detached: the brand face below */ }
  const bodyFont = firstFontFamily(bodyStack) ?? firstFontFamily(resolve('--font-brand'));
  const headingFont = firstFontFamily(resolve('--font-display')) ?? bodyFont;
  const ink = deckColor('var(--brand-text)', resolve);
  const hex = ink && (ink.alpha === undefined || ink.alpha >= 1) ? `#${ink.hex.toLowerCase()}` : undefined;
  const textColor = hex && contrastRatio(hex, '#ffffff') >= MIN_TEXT_CONTRAST ? hex : undefined;
  const styles: DocxStyles = {
    ...(bodyFont ? { bodyFont } : {}),
    ...(headingFont ? { headingFont } : {}),
    ...(textColor ? { textColor, headingColor: textColor } : {}),
  };
  return Object.keys(styles).length ? styles : undefined;
}

/** True for SVG bytes, by their first tag. */
function isSvgBytes(bytes: Uint8Array): boolean {
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart().toLowerCase();
  return head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'));
}

/** An SVG's own aspect ratio from its viewBox or width and height, or null. */
function svgAspect(bytes: Uint8Array): number | null {
  const head = new TextDecoder().decode(bytes.subarray(0, 4096));
  const tag = /<svg\b[^>]*>/i.exec(head)?.[0] ?? '';
  const vb = /viewBox\s*=\s*["']\s*[-\d.e]+[\s,]+[-\d.e]+[\s,]+([\d.e]+)[\s,]+([\d.e]+)/i.exec(tag);
  const w = Number(vb?.[1] ?? /\bwidth\s*=\s*["']([\d.]+)/i.exec(tag)?.[1]);
  const h = Number(vb?.[2] ?? /\bheight\s*=\s*["']([\d.]+)/i.exec(tag)?.[1]);
  return w > 0 && h > 0 ? w / h : null;
}

/**
 * Give every SVG picture a PNG of the same artwork, drawn at print resolution for the
 * size the picture shows at. A picture the browser cannot draw keeps its SVG alone, as
 * every picture did before.
 */
export async function withSvgFallbacks(media: DocxMedia[]): Promise<DocxMedia[]> {
  return Promise.all(media.map(async (m) => {
    if (!/\.svg$/i.test(m.name) || !isSvgBytes(m.bytes)) return m;
    const aspect = svgAspect(m.bytes);
    const shownW = m.width && m.width > 0 ? m.width : m.height && aspect ? m.height * aspect : 480;
    const shownH = m.height && m.height > 0 ? m.height : aspect ? shownW / aspect : 360;
    const scale = Math.min(PRINT_DPI / 96, MAX_FALLBACK_PX / Math.max(shownW, shownH));
    const png = await rasterizeSvgBytes(m.bytes, Math.round(shownW * scale), Math.round(shownH * scale), 'image/png', MAX_FALLBACK_PX);
    return png ? { ...m, width: m.width ?? Math.round(shownW), height: m.height ?? Math.round(shownH), fallback: png } : m;
  }));
}

/**
 * Editable Word document: headings, styled runs, links, lists, tables and pictures read
 * off the rendered node, not a rasterised page. The office MIME (not application/zip)
 * keeps the .docx extension. Still lossy against PDF by design (see doc-blocks.ts for
 * what the model cannot carry).
 */
export async function renderDocx(node: Element, opts: ExportOpts): Promise<Blob> {
  const { blocks, title, media } = await domToRichDoc(node);
  // Core props (plans/144 Wave 2 G3): the same fields the pptx path passes; the
  // document's own derived title wins over the tool name. An imported source's author
  // (data-source-author on the stage) rides along so the core-props writer can carry
  // both authors when they differ.
  const m = opts.meta;
  const srcAuthor = sourceAuthorOf(node);
  const page = docxPageOf(node, opts);
  const styles = docxStylesOf(node);
  return new Blob([writeDocx({
    title, blocks,
    media: await withSvgFallbacks(media),
    ...(page ? { page } : {}),
    ...(styles ? { styles } : {}),
    meta: m || srcAuthor
      ? { description: m?.description, source: m?.source, contact: m?.contact, author: m?.author, sourceAuthor: srcAuthor }
      : null,
    now: new Date().toISOString(),
  }) as BlobPart], { type: DOCX_MIME });
}
