// SPDX-License-Identifier: MPL-2.0
/**
 * SVG reader for Unpack (#/unpack).
 *
 * An SVG is a design container too - often the richest one, since everything in it
 * is already text: the colours it paints with, the words it sets, the rasters it
 * embeds as data: URIs, the @font-face files it carries, and its reusable symbols.
 * This module pulls each of those out as the same `PdfHandle` shape the PDF reader
 * returns, so the view runs the identical passes over either.
 *
 * Two rules run through it:
 *
 *  - NAMES, NEVER BYTES for anything linked. A `<image href="photo.png">` or an
 *    `@font-face` that names a family with no embedded source is COUNTED and named,
 *    never fetched - Unpack takes a file apart, it does not go and get the pieces
 *    that live elsewhere. Absence of bytes is also not a licence: a names-only font
 *    row states nothing about reuse.
 *
 *  - Every helper is PURE and takes a `Document` or an SVG string, so the node tests
 *    parse with jsdom and never need a browser. Only `openSvgFile` reaches for the
 *    DOM (DOMParser), and only to build the handle.
 *
 * Sanitisation trap (see the ingest path): DOMPurify strips `fr` off
 * `<radialGradient>` and removes `<use>` entirely, so extracted geometry is never
 * factored behind `<use>`; download bytes go out un-DOMPurify'd, and anything bound
 * for the catalogue is re-sanitised by storeUserUpload on the way in.
 */

import { extractSvgColors, sniffContainer } from '@lolly/engine';
import type { PageText, TextBlock } from '@lolly/engine';
import { readFontEmbedding } from '../lib/font-utils.ts';
import type { UnpackHandle } from './unpack-open.ts';
import type { PdfPageSvg, EmbeddedImage, EmbeddedImageScan, EmbeddedFont, ExtractedVector } from './pdf-import.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

// ── small pure decoders ─────────────────────────────────────────────────────────

/** Decode a base64 string to bytes (atob is a global in browsers and Node ≥16). */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Parse a `data:` URI into its media type and bytes, or null if it is not one. */
export function parseDataUri(uri: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]*)((?:;[^,]*)*),(.*)$/is.exec(uri.trim());
  if (!m) return null;
  const mime = (m[1] || '').toLowerCase();
  const isB64 = /;base64/i.test(m[2] || '');
  const data = m[3] ?? '';
  try {
    const bytes = isB64 ? base64ToBytes(data) : new TextEncoder().encode(decodeURIComponent(data));
    return { mime, bytes };
  } catch { return null; }
}

/**
 * Stored pixel dimensions from a raster's own header - PNG, GIF and JPEG, the
 * formats a design SVG actually embeds. Returns null when the bytes carry no size
 * we can read without a decoder, so the caller falls back to the `<image>` attrs.
 */
export function rasterSize(bytes: Uint8Array): { w: number; h: number } | null {
  const b = bytes;
  // PNG: 8-byte signature, then an IHDR chunk whose width/height are big-endian u32.
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  // GIF: "GIF8", then logical-screen width/height as little-endian u16.
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) {
    return { w: b[6]! | (b[7]! << 8), h: b[8]! | (b[9]! << 8) };
  }
  // JPEG: walk the marker segments to the first Start-Of-Frame (0xC0..0xCF, minus
  // the non-frame 0xC4/0xC8/0xCC), whose payload holds height then width (big-endian).
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { w: (b[i + 7]! << 8) | b[i + 8]!, h: (b[i + 5]! << 8) | b[i + 6]! };
      }
      const len = (b[i + 2]! << 8) | b[i + 3]!;
      if (len < 2) break;
      i += 2 + len;
    }
  }
  return null;
}

// ── element helpers ──────────────────────────────────────────────────────────────

function hrefOf(el: Element): string | null {
  return el.getAttribute('href')
    || el.getAttributeNS(XLINK_NS, 'href')
    || el.getAttribute('xlink:href');
}

function numAttr(el: Element, name: string): number {
  const v = parseFloat(el.getAttribute(name) || '');
  return Number.isFinite(v) ? v : 0;
}

// ── palette ──────────────────────────────────────────────────────────────────────

/** The distinct colours the SVG paints with - a thin pass-through to the engine's
 *  DOM-free extractor, which reads presentation attributes AND CSS declarations. */
export function svgPalette(svgText: string): string[] {
  return extractSvgColors(svgText);
}

// ── images ─────────────────────────────────────────────────────────────────────

/**
 * Every embedded raster. A data: `<image>` is decoded to bytes (dimensions from the
 * raster header, else the element's attributes); a linked (external or #-fragment)
 * href is COUNTED as skipped and never fetched.
 */
export function svgImages(doc: Document): EmbeddedImageScan {
  const images: EmbeddedImage[] = [];
  let skipped = 0;
  for (const el of Array.from(doc.querySelectorAll('image'))) {
    const href = hrefOf(el);
    if (!href) continue;
    const data = /^data:/i.test(href.trim()) ? parseDataUri(href) : null;
    if (data && /^image\//.test(data.mime)) {
      const size = rasterSize(data.bytes);
      images.push({
        bytes: data.bytes,
        mime: data.mime,
        width: size?.w || Math.round(numAttr(el, 'width')),
        height: size?.h || Math.round(numAttr(el, 'height')),
        colorSpace: null,
        page: 0,
      });
    } else {
      // Linked from elsewhere (http(s):, a file path, a #symbol) - named by its
      // presence, its bytes left where they live.
      skipped++;
    }
  }
  return { images, skipped, skippedFilters: [] };
}

// ── text ─────────────────────────────────────────────────────────────────────────

/**
 * Every `<text>` element's content, one block each, in document order - the honest
 * answer for an SVG. One whose text was outlined to `<path>` yields nothing, which
 * is the truth (same as a PDF whose text was converted to curves).
 */
export function svgTextContent(doc: Document): PageText {
  const blocks: TextBlock[] = [];
  for (const el of Array.from(doc.querySelectorAll('text'))) {
    const raw = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!raw) continue;
    const size = numAttr(el, 'font-size');
    const w = (el.getAttribute('font-weight') || '').trim();
    blocks.push({
      kind: 'paragraph',
      text: raw,
      size,
      bold: w === 'bold' || Number.parseInt(w, 10) >= 600,
      column: 0,
    });
  }
  const text = blocks.map((b) => b.text).join('\n\n');
  return { blocks, text, markdown: text, columns: 1, scanned: false, rotated: 0, order: 'geometric' };
}

// ── fonts ──────────────────────────────────────────────────────────────────────

const FONT_EXT: Record<string, EmbeddedFont['ext']> = {
  ttf: 'ttf', otf: 'otf', woff: 'woff', woff2: 'woff2',
};

/** Peel the family name out of a font-family declaration (first name, unquoted). */
function familyName(decl: string): string {
  const m = /font-family\s*:\s*([^;]+)/i.exec(decl);
  if (!m) return '';
  const first = (m[1] || '').split(',')[0] || '';
  return first.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * The @font-face rules in every `<style>` block.
 *
 * A `src: url(data:…)` face becomes downloadable bytes, its real format read from
 * the bytes themselves (not the possibly-lying `format()` hint) and its embedding
 * statement read from OS/2 where the bytes carry one. A family with no embedded
 * source becomes a names-only row: `installable: false`, embedding `unknown` - the
 * absence of a file is not a licence to go and find one.
 */
export function svgFonts(doc: Document): EmbeddedFont[] {
  const out: EmbeddedFont[] = [];
  const seen = new Set<string>();
  const css = Array.from(doc.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n');
  const faceRe = /@font-face\s*\{([^}]*)\}/gi;
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = faceRe.exec(css)) && guard++ < 500) {
    const body = m[1] || '';
    const family = familyName(body) || 'Embedded font';
    // The first data: source in the src list, if any.
    const srcData = /url\(\s*(['"]?)(data:[^)'"]+)\1\s*\)/i.exec(body);
    if (srcData) {
      const data = parseDataUri(srcData[2] || '');
      if (data) {
        const sniffed = sniffContainer(data.bytes);
        const ext = (sniffed && FONT_EXT[sniffed]) || FONT_EXT[(/\.(ttf|otf|woff2|woff)\b/i.exec(body)?.[1] || '').toLowerCase()] || 'ttf';
        let embedding = { permission: 'unknown', noSubsetting: false, bitmapOnly: false, fsType: null } as EmbeddedFont['embedding'];
        // OS/2 only reads from a bare sfnt; woff/woff2 are wrapped, so they stay 'unknown'.
        if (ext === 'ttf' || ext === 'otf') {
          try { embedding = readFontEmbedding(data.bytes.buffer.slice(data.bytes.byteOffset, data.bytes.byteOffset + data.bytes.byteLength) as ArrayBuffer); }
          catch { /* keep unknown */ }
        }
        const key = `data:${family}:${data.bytes.length}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name: family, family, ext, bytes: data.bytes, subset: false, installable: true, embedding });
        continue;
      }
    }
    // Names-only: the family is referenced, its file is not in here.
    const key = `name:${family.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: family, family, ext: 'ttf', bytes: new Uint8Array(0),
      subset: false, installable: false,
      embedding: { permission: 'unknown', noSubsetting: false, bitmapOnly: false, fsType: null },
    });
  }
  return out;
}

// ── vectors (reusable marks) ─────────────────────────────────────────────────────

const DRAWABLE = 'path,rect,circle,ellipse,polygon,polyline,line,text';

/**
 * Reusable marks as standalone SVGs - `<symbol>`s and nested `<svg>`s, the only
 * elements that carry their own frame (a `viewBox`, or width/height) so they can
 * be cropped to themselves WITHOUT a layout pass. A `<g>` has no viewBox and cannot
 * be framed by attribute math alone, so it is left for a later, layout-aware pass
 * rather than guessed at. The document's own top-level `<defs>` ride along so a
 * mark that paints with a shared gradient or clip still resolves.
 */
export function svgVectors(doc: Document): ExtractedVector[] {
  const out: ExtractedVector[] = [];
  const rootDefs = Array.from(doc.querySelectorAll('svg > defs')).map((d) => d.innerHTML).join('');
  const defs = rootDefs ? `<defs>${rootDefs}</defs>` : '';
  for (const el of Array.from(doc.querySelectorAll('symbol, svg svg'))) {
    const tag = el.tagName.toLowerCase();
    const vb = el.getAttribute('viewBox');
    let w = 0, h = 0, viewBox = vb || '';
    if (vb) {
      const p = vb.split(/[\s,]+/).map(Number);
      w = p[2] || 0; h = p[3] || 0;
    } else {
      w = numAttr(el, 'width'); h = numAttr(el, 'height');
      viewBox = `0 0 ${w} ${h}`;
    }
    if (!w || !h) continue;  // no frame without layout → skip rather than guess
    const inner = el.innerHTML;
    if (!inner.trim()) continue;
    // The shared defs ride along so a mark that paints with a common gradient or
    // clip still resolves when rendered - but the fill SWATCHES come from the
    // mark's OWN content, or every mark would advertise the whole document's
    // palette (a gradient the mark never references and all).
    const svg = `<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}" viewBox="${viewBox}" width="${w}" height="${h}">${defs}${inner}</svg>`;
    const shapes = el.querySelectorAll(DRAWABLE).length;
    if (!shapes) continue;
    out.push({
      svg,
      width: Math.round(w),
      height: Math.round(h),
      page: 0,
      fills: extractSvgColors(inner).slice(0, 12),
      shapes,
      reason: tag === 'symbol' ? 'a reusable symbol' : 'a nested drawing',
    });
  }
  return out;
}

// ── page render (browser only) ────────────────────────────────────────────────────

/** Root width/height for the preview: viewBox first (the true user space), else the
 *  width/height attributes, else a sane default. */
function rootSize(svg: Element): { w: number; h: number } {
  const vb = svg.getAttribute('viewBox');
  if (vb) { const p = vb.split(/[\s,]+/).map(Number); if (p[2] && p[3]) return { w: p[2], h: p[3] }; }
  const w = numAttr(svg, 'width'), h = numAttr(svg, 'height');
  return { w: w || 1080, h: h || 1080 };
}

/**
 * Light in-place sanitisation for the preview `<img>`: drop `<script>`/`<foreignObject>`,
 * strip on* handlers and any external href/src (data: and #fragment survive), but KEEP
 * `<style>` so class-driven fills still paint. The result is bound for an `<img>`,
 * which runs no scripts and loads no subresources; this is defence in depth on top of
 * that. The download and catalogue paths re-sanitise separately.
 */
function scrubForPreview(svg: SVGSVGElement): void {
  svg.querySelectorAll('script, foreignObject').forEach((n) => n.remove());
  const scrub = (el: Element): void => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) { el.removeAttribute(attr.name); continue; }
      if (name === 'href' || name === 'xlink:href' || name === 'src') {
        const v = String(attr.value || '').trim();
        if (!/^data:/i.test(v) && !v.startsWith('#')) el.removeAttribute(attr.name);
      }
    }
  };
  scrub(svg);
  svg.querySelectorAll('*').forEach(scrub);
  // Neutralise @import in <style>, the one external door an <img> would still honour.
  svg.querySelectorAll('style').forEach((s) => {
    if (s.textContent && /@import/i.test(s.textContent)) s.textContent = s.textContent.replace(/@import[^;]+;/gi, '');
  });
}

// ── the opener ────────────────────────────────────────────────────────────────────

/**
 * Open an SVG file as an Unpack handle. Parses once with DOMParser; the pure helpers
 * above do the actual extraction over that Document (or the raw text for the palette),
 * so the same passes run in the node tests against jsdom.
 */
export async function openSvgFile(file: File | Blob): Promise<UnpackHandle> {
  const svgText = await file.text();
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = doc.querySelector('svg');
  if (!root || doc.querySelector('parsererror')) {
    throw new Error('This file is not readable as SVG.');
  }

  let pageCache: PdfPageSvg | null = null;

  return {
    pageCount: 1,
    async pageToSvg(index: number): Promise<PdfPageSvg> {
      if (index !== 0) throw new Error(`No page ${index + 1} in an SVG.`);
      if (pageCache) return pageCache;
      const clone = root.cloneNode(true) as SVGSVGElement;
      scrubForPreview(clone);
      const { w, h } = rootSize(root);
      pageCache = {
        svg: new XMLSerializer().serializeToString(clone),
        width: w,
        height: h,
        elementCount: clone.querySelectorAll(DRAWABLE).length,
      };
      return pageCache;
    },
    pageToText(index: number): PageText {
      if (index !== 0) return { blocks: [], text: '', markdown: '', columns: 1, scanned: false, rotated: 0, order: 'geometric' };
      return svgTextContent(doc);
    },
    listPalette(): string[] {
      return svgPalette(svgText);
    },
    listImages(): Promise<EmbeddedImageScan> {
      return Promise.resolve(svgImages(doc));
    },
    listFonts(): EmbeddedFont[] {
      return svgFonts(doc);
    },
    listVectors(): Promise<ExtractedVector[]> {
      return Promise.resolve(svgVectors(doc));
    },
  };
}
