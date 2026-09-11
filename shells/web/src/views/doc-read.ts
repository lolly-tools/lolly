// SPDX-License-Identifier: MPL-2.0
/**
 * Best-effort text extraction for ANY readable asset - the one implementation
 * behind "Read the text in this…" on BOTH the verify view and the catalog
 * details modal, so the two surfaces make identical promises:
 *
 *  - PDF: the text LAYER first (digital - the byte-level artifact tier still
 *    applies). Pages that are pictures of text no longer end in a refusal:
 *    when the on-device OCR model is present, each scanned page is rasterised
 *    (pageToSvg → canvas) and read per page, folded back into reading order.
 *  - SVG: the vector's own <text> elements first (digital, better than any
 *    OCR); rasterise-and-OCR is the caller's fallback when a vector draws its
 *    words as paths or embedded images.
 *
 * Every result is honest about HOW it was read: `source` drives the
 * analyser's pixelSourced honesty (one OCR'd page makes the whole read
 * 'ocr' - conservative, because the byte tier did not see those pages), and
 * `notes` carries what could not be read and why, for the caller to SAY
 * rather than silently truncate. Nothing here renders UI; the callers own
 * their panels and always attach the synthetic-content risk assessment.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';

type OcrApi = NonNullable<HostV1['ocr']>;

/** What a document read could and could not do - for the caller's honest notes. */
export interface DocReadNotes {
  pageCount: number;
  /** Pages actually read (text layer + OCR), of the first `pageCap`. */
  pagesRead: number;
  /** Pages recovered with per-page OCR. */
  ocrPages: number;
  /** Scanned pages left unread (over the OCR cap, or no model). */
  scannedUnread: number;
  /** True when scanned pages exist but no OCR model is installed. */
  ocrUnavailable: boolean;
}

export interface DocReadResult {
  /** null = nothing readable (every page a picture and no OCR to read it). */
  text: string | null;
  source: 'digital' | 'ocr';
  notes: DocReadNotes;
}

/** Text-layer page cap (cheap) and per-page OCR cap (wasm inference is not). */
const PAGE_CAP = 30;
const OCR_PAGE_CAP = 12;

/** Rasterise a standalone SVG document to the RGBA frame host.ocr.run expects.
 *  White ground on purpose: pages and vectors can be transparent, and the
 *  detector needs contrast. Returns null when the SVG cannot decode. */
export async function svgToOcrFrame(
  svg: string,
  width?: number,
  height?: number,
): Promise<{ width: number; height: number; data: Uint8ClampedArray } | null> {
  let w = width ?? 0;
  let h = height ?? 0;
  if (!w || !h) {
    // A viewBox-only vector has no intrinsic size - read one out so <img> can decode.
    const vb = /viewBox\s*=\s*["']\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(svg);
    w = vb ? Number(vb[1]) : 1200;
    h = vb ? Number(vb[2]) : 1200;
  }
  const scale = Math.min(2, 1400 / Math.max(w, h, 1));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const src = w && h && !/(^|\s)width\s*=/.test(svg.slice(0, 500))
    ? svg.replace(/<svg/, `<svg width="${w}" height="${h}"`)
    : svg;
  const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('svg decode failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const cx = canvas.getContext('2d');
    if (!cx) return null;
    cx.fillStyle = '#fff';
    cx.fillRect(0, 0, cw, ch);
    cx.drawImage(img, 0, 0, cw, ch);
    return { width: cw, height: ch, data: cx.getImageData(0, 0, cw, ch).data };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The visible words of a vector, from its own <text> elements in document
 *  order - digital extraction, no pixels involved. Parsing only (DOMParser on
 *  a detached document executes nothing); empty string when the vector draws
 *  its words as paths or images, which is the caller's cue to fall back to
 *  rasterise-and-OCR. */
export function extractSvgText(src: string): string {
  try {
    const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return '';
    return [...doc.querySelectorAll('text')]
      .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  } catch {
    return '';
  }
}

/** The visible prose of an HTML document. Raw page markup detects as docKind
 *  'code' (an inline-CSS head), which gates every prose tell off - and a built
 *  page's head alone can outgrow verify's 64 KB raw-text cap before any prose
 *  appears, so a page's writing never reached the analyser at all. Parsing only
 *  (DOMParser on a detached document executes nothing, fetches nothing);
 *  script/style text dropped; capped to the same 64 KB the raw read uses.
 *  Empty string when nothing parses - the caller's cue to analyse the raw head. */
export function extractHtmlText(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    for (const el of doc.querySelectorAll('script, style')) el.remove();
    return (doc.documentElement?.textContent || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 64 * 1024);
  } catch {
    return '';
  }
}

/**
 * Read a PDF: text layer first, per-page OCR for its scanned pages where a
 * model is present. `text` is null when nothing was readable - the notes say why.
 * `onProgress` narrates the slow half ("Reading page 2 of 8…" is the caller's
 * copy - this reports raw counts).
 */
export async function extractDocumentText(
  file: Blob,
  ocr: OcrApi | null,
  onProgress?: (done: number, total: number) => void,
): Promise<DocReadResult> {
  const [{ openPdfFile }, { joinPageText }] = await Promise.all([
    import('./pdf-import.ts'),
    import('@lolly/engine'),
  ]);
  const handle = await openPdfFile(file);
  const toText = handle.pageToText;
  if (!toText) throw new Error('no text pass');
  const cap = Math.min(handle.pageCount, PAGE_CAP);
  const pages = Array.from({ length: cap }, (_, i) => toText(i));

  const scanned = pages.map((p, i) => (p.scanned ? i : -1)).filter((i) => i >= 0);
  const ocrRun = ocr ? scanned.slice(0, OCR_PAGE_CAP) : [];
  let ocrPages = 0;
  for (let k = 0; k < ocrRun.length; k++) {
    const i = ocrRun[k]!;
    onProgress?.(k + 1, ocrRun.length);
    try {
      const page = await handle.pageToSvg(i);
      if (page.elementCount === 0) continue;
      const frame = await svgToOcrFrame(page.svg, page.width, page.height);
      if (!frame) continue;
      const res = await ocr!.run(frame);
      const text = res.text.trim();
      if (!text) continue;
      // Fold the recovered text back into reading order: the page stops being
      // "scanned" for joinPageText, so no placeholder line survives for it.
      pages[i] = { ...pages[i]!, scanned: false, text, markdown: text };
      ocrPages++;
    } catch { /* one bad page must not kill the read - it keeps its honest placeholder */ }
  }

  // Only pages that actually READ join the analysed text - the honest notes
  // say what was left, so no placeholder boilerplate pollutes the analysis.
  const readable = pages.filter((p) => !p.scanned);
  const joined = joinPageText(readable).trim();
  const scannedUnread = scanned.length - ocrPages;
  return {
    text: joined ? joined : null,
    // One OCR'd page makes the WHOLE read 'ocr': the byte-level tier did not
    // see those pages, and claiming 'digital' would overstate what was checked.
    source: ocrPages > 0 ? 'ocr' : 'digital',
    notes: {
      pageCount: handle.pageCount,
      pagesRead: cap,
      ocrPages,
      scannedUnread,
      ocrUnavailable: scanned.length > 0 && !ocr,
    },
  };
}
