// SPDX-License-Identifier: MPL-2.0
/**
 * trim-offer.ts - the reusable "trim to content" offer (plan 97 section 7.3, gap 4).
 *
 * One offer, four surfaces: the Logos room, the shared upload dropzone, the
 * asset picker's upload flow, and the catalogue details panel. A padded logo
 * dropped straight into a tool gets the same before/after card as one dropped
 * into the studio, so the affordance is a property of "a user file becomes an
 * asset", not of one room.
 *
 * ORDERING (the gotcha plan 97 section 4 records as gap 4): the trim runs BEFORE
 * `storeUserUpload`. That path's `normalizeSvg` strips the root width/height and
 * preserves the authored box, after which a viewBox rewrite has nothing left to
 * bite on and silently no-ops. So a caller ingests `onResolve`'s file, never the
 * file it started with.
 *
 * TWO HALVES.
 *   PURE - the routing decision (`trimKindOf`), the artboard read
 *   (`svgArtboardBox`), the pad maths (`padTrimBox`) and the "is this worth
 *   asking about" gate (`trimSavings`/`isMeaningfulTrim`). No DOM, unit-tested
 *   in trim-offer.test.ts.
 *   BROWSER - `prepareTrim` (decode + crop + re-encode) and `mountTrimOffer`
 *   (the card). Both need canvas/Image and are deliberately browser-only.
 *
 * PAD SEMANTICS. The stepper adds breathing room back around the artwork and is
 * clamped per side to the ORIGINAL artboard, so a trim can never grow a file
 * past the box it arrived in (and a raster crop can never ask for pixels the
 * bitmap does not have). Padding never eats into the content box either: a mark
 * that overflows its own viewBox keeps every unit of overflow. Each change
 * re-derives from the ORIGINAL bytes - pads do not compound.
 *
 * PERMANENCE. Trimming is permanent for the stored asset (plan 97 section 14.4): the
 * original margins are not kept, and the card says so rather than letting the
 * default-on trim quietly take them.
 *
 * THREE ANSWERS, not two (plan 97 section 11, Esc-to-close parity). "Trim" and "Keep
 * original margins" both CHOOSE A FILE and are reported through `onResolve`.
 * Escape and the card's own ✕ are a DISMISSAL: the user is backing out of the
 * whole thing, and that is `onCancel`, a separate channel because on three of
 * the four surfaces the card stands in front of an upload that has not happened
 * yet. Resolving with the original there would mean a dismissal silently stored
 * the file, which is the opposite of what backing out means. `onCancel` is
 * required for exactly that reason: the answer differs per surface, and a
 * default would quietly make dismissal mean "commit" wherever a caller forgot.
 */

import { svgContentBounds, trimSvgToContent, rasterContentBounds } from './trim-bounds.ts';
import type { Box } from './trim-bounds.ts';
import { escape } from '../../utils.ts';
import { icon } from '../icons.ts';
import '../../styles/parts/dropzone.css';

/** How the file is trimmed: a viewBox rewrite, or a bitmap crop. */
export type TrimKind = 'svg' | 'raster';

/** The consuming file's `t` (i18n.ts), injected so this module stays mountable
 *  from any surface without reaching for the runtime itself. */
export type TFn = (source: string, params?: Record<string, string | number>) => string;

export interface TrimProposal {
  kind: TrimKind;
  /** The bytes as they arrived. The opt-out resolves with exactly this file. */
  originalFile: File;
  /** The trimmed bytes at the pad currently in force (SVG text, or a PNG). */
  trimmedFile: File;
  /** The artboard as authored: the root viewBox, or the bitmap's pixel box. */
  originalBox: Box;
  /** Content bounds plus the pad in force, clamped to `originalBox`. */
  trimmedBox: Box;
  /** Percent of the artboard AREA the trim removes, 0-100, one decimal. */
  savings: number;
  /** The pad this proposal was derived at, in artboard units (px for raster). */
  pad: number;
  /** Re-derive at another pad, always from the ORIGINAL bytes. Never null: once
   *  an offer stands, moving the stepper adjusts it rather than withdrawing it
   *  (a pad that fills the artboard is a 0% trim, which the card shows plainly). */
  retrim(pad: number): Promise<TrimProposal>;
}

// ── Pure half ────────────────────────────────────────────────────────────────

/** Stepper ceiling (plan 97 section 7.3: a small padding stepper, default 0). */
export const TRIM_PAD_MAX = 32;

/** Below this much area removed the margins are rounding, not margins: offering
 *  a trim would cost a decision and buy nothing. 1% of a 1000px square is a 5px
 *  border, which is the smallest margin worth a card. */
export const MIN_TRIM_SAVINGS = 1;

const RASTER_MIME_RE = /^image\/(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i;
const RASTER_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i;
const SVG_MIME_RE = /^image\/svg(\+xml)?$/i;
const SVG_EXT_RE = /\.svgz?$/i;

/** Byte-for-byte to chars, so a magic-number window can be matched as text
 *  without a TextDecoder's encoding opinions (and identically under node). */
function latin1(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return s;
}

/** The container format, read from the bytes alone, or null when the window
 *  shows nothing recognisable (too short, or simply not an image). */
function magicKind(head: Uint8Array): TrimKind | null {
  if (head.length >= 4 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'raster';
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'raster';
  const s = latin1(head);
  if (s.startsWith('GIF87a') || s.startsWith('GIF89a')) return 'raster';
  if (s.startsWith('RIFF') && s.slice(8, 12) === 'WEBP') return 'raster';
  if (head.length >= 14 && s.startsWith('BM')) return 'raster';
  // ISO-BMFF family: AVIF/HEIC carry `ftyp` as the first box type.
  if (s.slice(4, 8) === 'ftyp') return 'raster';
  // Text formats: skip a UTF-8 BOM and leading whitespace before judging.
  const text = s.replace(/^ï»¿/, '').replace(/^\s+/, '');
  if (/^<svg[\s>]/i.test(text) || /^<!doctype\s+svg/i.test(text)) return 'svg';
  // An XML prolog alone proves nothing - it fronts every XML dialect - so it
  // only counts when the root tag is already inside the same window.
  if (/^<\?xml/i.test(text) && /<svg[\s>]/i.test(text)) return 'svg';
  return null;
}

/**
 * Which trim path a file takes, or null for "not ours" (a PDF, a font, an
 * unrecognised blob). Magic bytes outrank the declared MIME type, which outranks
 * the file name: a PNG saved as `logo.svg` is a PNG, and an OS that hands over a
 * blank MIME type must not cost the user the offer.
 */
export function trimKindOf(file: { type?: string; name?: string }, head?: Uint8Array): TrimKind | null {
  if (head && head.length) {
    const magic = magicKind(head);
    if (magic) return magic;
  }
  const type = file.type ?? '';
  if (SVG_MIME_RE.test(type)) return 'svg';
  if (RASTER_MIME_RE.test(type)) return 'raster';
  const name = file.name ?? '';
  if (SVG_EXT_RE.test(name)) return 'svg';
  if (RASTER_EXT_RE.test(name)) return 'raster';
  return null;
}

function attrNum(tag: string, attr: string): number | null {
  const m = new RegExp(`\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag);
  const raw = (m?.[2] ?? m?.[3] ?? '').trim();
  if (!raw || raw.endsWith('%')) return null; // a percentage sizes against a parent we do not have
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * The artboard as authored - the box the trim is measured against. Same rule as
 * trim-bounds' own root read (viewBox, else width/height as `0 0 w h`, else
 * nothing), restated here because that one is private to the bounds module and
 * this module must not reach into it.
 *
 * Null means there is no authored box at all, and with nothing to compare the
 * content bounds to there is no honest "before" to show: the offer stands down.
 */
export function svgArtboardBox(svgText: string): Box | null {
  const m = /<svg\b[^>]*>/i.exec(svgText);
  if (!m) return null;
  const tag = m[0];
  const vb = /viewBox\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
  if (vb) {
    const parts = (vb[2] ?? vb[3] ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite) && parts[2]! > 0 && parts[3]! > 0) {
      return { x: parts[0]!, y: parts[1]!, width: parts[2]!, height: parts[3]! };
    }
  }
  const w = attrNum(tag, 'width');
  const h = attrNum(tag, 'height');
  if (w !== null && h !== null && w > 0 && h > 0) return { x: 0, y: 0, width: w, height: h };
  return null;
}

/**
 * The content box grown by `pad` on every side, clamped OUTWARD to the artboard
 * and INWARD to the content: padding may not push past the box the file arrived
 * in, and may not clip artwork that overflows that box. Per side, not uniform - 
 * a wordmark that fills its artboard's width but not its height must still be
 * able to keep vertical breathing room.
 */
export function padTrimBox(content: Box, artboard: Box, pad: number): Box {
  const p = Math.max(0, Math.min(TRIM_PAD_MAX, Number.isFinite(pad) ? pad : 0));
  const cx1 = content.x + content.width;
  const cy1 = content.y + content.height;
  const ax1 = artboard.x + artboard.width;
  const ay1 = artboard.y + artboard.height;
  const x0 = Math.min(content.x, Math.max(artboard.x, content.x - p));
  const y0 = Math.min(content.y, Math.max(artboard.y, content.y - p));
  const x1 = Math.max(cx1, Math.min(ax1, cx1 + p));
  const y1 = Math.max(cy1, Math.min(ay1, cy1 + p));
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
}

/** Percent of the artboard's area the trim removes (0-100, one decimal). A box
 *  that is not smaller than the artboard removes nothing, never a negative. */
export function trimSavings(artboard: Box, trimmed: Box): number {
  const before = artboard.width * artboard.height;
  if (!(before > 0)) return 0;
  const after = Math.max(0, trimmed.width) * Math.max(0, trimmed.height);
  const pct = ((before - after) / before) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}

/** Worth asking the user about: a real box, inside a real artboard, removing at
 *  least MIN_TRIM_SAVINGS of the area. An already-tight file answers false, and
 *  its upload proceeds with no card at all. */
export function isMeaningfulTrim(artboard: Box, trimmed: Box): boolean {
  if (!(artboard.width > 0 && artboard.height > 0)) return false;
  if (!(trimmed.width > 0 && trimmed.height > 0)) return false;
  return trimSavings(artboard, trimmed) >= MIN_TRIM_SAVINGS;
}

// ── Browser half: preparing a proposal ───────────────────────────────────────

/** Alpha at or below this is invisible dither (0.8% opacity) and must not hold
 *  the content box open - a single stray anti-aliased pixel would defeat the
 *  whole trim. */
const ALPHA_MIN = 2;

/** A decode over this many pixels holds >150 MB of ImageData for the readback
 *  alone. Past it the offer stands down rather than risking the tab. */
const MAX_DECODE_PIXELS = 40_000_000;

function fmtNum(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/** Point an already-trimmed SVG's root viewBox at `box`. trimSvgToContent only
 *  takes a uniform pad, and this module's pad is clamped per side (see
 *  padTrimBox), so the padded box is written here instead of asking for it
 *  there. Safe by construction: the input is that function's own output, whose
 *  root always carries a double-quoted viewBox. */
function retargetViewBox(svgText: string, box: Box): string {
  const vb = `${fmtNum(box.x)} ${fmtNum(box.y)} ${fmtNum(box.width)} ${fmtNum(box.height)}`;
  return svgText.replace(/(<svg\b[^>]*?)viewBox\s*=\s*("[^"]*"|'[^']*')/i, `$1viewBox="${vb}"`);
}

function deriveSvgProposal(file: File, text: string, artboard: Box, content: Box, pad: number): TrimProposal {
  const box = padTrimBox(content, artboard, pad);
  const tight = trimSvgToContent(text, { pad: 0 });
  // tight === null means the authored box already IS the content box; there is
  // nothing to rewrite, so the "trimmed" file is the original.
  const svgText = tight ? retargetViewBox(tight.svg, box) : text;
  const trimmedFile = tight
    ? new File([svgText], file.name, { type: 'image/svg+xml', lastModified: file.lastModified })
    : file;
  return {
    kind: 'svg',
    originalFile: file,
    trimmedFile,
    originalBox: artboard,
    trimmedBox: tight ? box : artboard,
    savings: trimSavings(artboard, tight ? box : artboard),
    pad,
    retrim: (next: number) => Promise.resolve(deriveSvgProposal(file, text, artboard, content, next)),
  };
}

async function prepareSvgTrim(file: File): Promise<TrimProposal | null> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return null;
  }
  const artboard = svgArtboardBox(text);
  const content = svgContentBounds(text);
  if (!artboard || !content) return null;
  const proposal = deriveSvgProposal(file, text, artboard, content, 0);
  return isMeaningfulTrim(artboard, proposal.trimmedBox) ? proposal : null;
}

interface DecodedRaster { canvas: HTMLCanvasElement; data: Uint8ClampedArray; width: number; height: number }

async function decodeRaster(file: File): Promise<DecodedRaster | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    if (!width || !height || width * height > MAX_DECODE_PIXELS) {
      bitmap.close?.();
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      bitmap.close?.();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    return { canvas, data: ctx.getImageData(0, 0, width, height).data, width, height };
  } catch {
    return null; // undecodable in this engine - no offer, the upload just proceeds
  }
}

/** Whole pixels only: a crop rect is a rect of samples, and rounding it here
 *  keeps the encoded PNG's size exactly the box the card reported. */
function pixelBox(box: Box, width: number, height: number): Box {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const w = Math.min(width - x, Math.max(1, Math.round(box.width)));
  const h = Math.min(height - y, Math.max(1, Math.round(box.height)));
  return { x, y, width: w, height: h };
}

function withExt(name: string, ext: string): string {
  return new RegExp(`\\.${ext}$`, 'i').test(name) ? name : `${name.replace(/\.[a-z0-9]+$/i, '')}.${ext}`;
}

async function encodeCrop(src: HTMLCanvasElement, box: Box, file: File): Promise<File | null> {
  const out = document.createElement('canvas');
  out.width = box.width;
  out.height = box.height;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(src, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
  // A JPEG source has no alpha to lose (only flat white/black margins get it
  // here), so it stays JPEG - re-encoding a photo as PNG would balloon it.
  // Everything else encodes PNG, which keeps alpha for the transparent case.
  const jpeg = file.type === 'image/jpeg';
  const type = jpeg ? 'image/jpeg' : 'image/png';
  const blob = await new Promise<Blob | null>((resolve) => { out.toBlob(resolve, type, jpeg ? 0.92 : undefined); });
  if (!blob) return null;
  return new File([blob], withExt(file.name, jpeg ? 'jpg' : 'png'), { type, lastModified: file.lastModified });
}

/** The decoded canvas stays in the closure so a pad change re-crops the ORIGINAL
 *  pixels instead of re-decoding the file (and instead of cropping a crop, which
 *  would compound). It is released when the proposal is dropped. */
async function deriveRasterProposal(file: File, decoded: DecodedRaster, content: Box, pad: number): Promise<TrimProposal> {
  const artboard: Box = { x: 0, y: 0, width: decoded.width, height: decoded.height };
  const box = pixelBox(padTrimBox(content, artboard, pad), decoded.width, decoded.height);
  const cropped = await encodeCrop(decoded.canvas, box, file);
  return {
    kind: 'raster',
    originalFile: file,
    trimmedFile: cropped ?? file,
    originalBox: artboard,
    trimmedBox: cropped ? box : artboard,
    savings: trimSavings(artboard, cropped ? box : artboard),
    pad,
    retrim: (next: number) => deriveRasterProposal(file, decoded, content, next),
  };
}

async function prepareRasterTrim(file: File): Promise<TrimProposal | null> {
  const decoded = await decodeRaster(file);
  if (!decoded) return null;
  // Content = opaque pixels that also differ from a flat white/black border
  // (rasterContentBounds) - so a logo matted onto white trims like its
  // transparent twin, not "already tight" (Andy, 2026-08-20).
  const content = rasterContentBounds(decoded.data, decoded.width, decoded.height, { alphaMin: ALPHA_MIN });
  // No content at all means a fully transparent (or fully flat) file: there is no box to trim to.
  if (!content) return null;
  const artboard: Box = { x: 0, y: 0, width: decoded.width, height: decoded.height };
  if (!isMeaningfulTrim(artboard, padTrimBox(content, artboard, 0))) return null;
  const proposal = await deriveRasterProposal(file, decoded, content, 0);
  return isMeaningfulTrim(artboard, proposal.trimmedBox) ? proposal : null;
}

/**
 * Measure a file and, when a trim would actually buy something, return the
 * proposal the card is built from. Null covers every "say nothing" case: not an
 * image we trim, undecodable, no content bounds, or already tight.
 */
export async function prepareTrim(file: File): Promise<TrimProposal | null> {
  let head = new Uint8Array(0);
  try {
    head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  } catch {
    head = new Uint8Array(0);
  }
  const kind = trimKindOf(file, head);
  if (kind === 'svg') return prepareSvgTrim(file);
  if (kind === 'raster') return prepareRasterTrim(file);
  return null;
}

// ── Browser half: the offer card ─────────────────────────────────────────────

export interface TrimOfferOpts {
  /** Starting pad (0-32, default 0). */
  pad?: number;
  /** The consuming file's t() from i18n.ts. */
  t: TFn;
  /** The decision: the file to ingest, and whether it is the trimmed one. */
  onResolve: (file: File, trimmed: boolean) => void;
  /**
   * The dismissal: Escape, or the card's own ✕. No file was chosen. A surface
   * that is INGESTING must write nothing and leave the user where they were; a
   * surface re-offering a stored asset simply closes the card. Required - see
   * the module header for why there is no default.
   */
  onCancel: () => void;
}

let padFieldSeq = 0;

const dims = (box: Box): string => `${Math.round(box.width)} × ${Math.round(box.height)}`;

/**
 * Render the offer into `el` and wire it. Trim is the default action and takes
 * focus; "Keep original margins" is the opt-out; Escape and the ✕ back out
 * altogether through `onCancel`.
 *
 * Returns a teardown: it drops the listeners, revokes the preview object URLs
 * and empties the mount. Exactly one of `onResolve`/`onCancel` fires, once.
 */
export function mountTrimOffer(el: HTMLElement, proposal: TrimProposal, opts: TrimOfferOpts): () => void {
  const t = opts.t;
  const unit = proposal.kind === 'raster' ? 'px' : t('units');
  const seqId = ++padFieldSeq;
  const padId = `trimo-pad-${seqId}`;
  // The stepper's whole effect is these two readouts, so the field POINTS at
  // them (aria-describedby) and the savings line is a live region: without both,
  // ArrowUp on the pad field changes the card and announces only "1".
  const savingsId = `trimo-savings-${seqId}`;
  const afterDimsId = `trimo-after-dims-${seqId}`;
  let current = proposal;
  let resolved = false;
  let seq = 0;
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const urls = new Set<string>();
  const objectUrl = (file: File): string => {
    const u = URL.createObjectURL(file);
    urls.add(u);
    return u;
  };
  const dropUrl = (u: string): void => {
    if (!urls.delete(u)) return;
    URL.revokeObjectURL(u);
  };

  const wantPad = Math.round(opts.pad ?? proposal.pad);
  const startPad = Number.isFinite(wantPad) ? Math.max(0, Math.min(TRIM_PAD_MAX, wantPad)) : 0;

  const savingsText = (p: TrimProposal): string => (p.savings > 0
    ? t('Removes {pct}% of the area', { pct: p.savings })
    : t('No margin to remove'));

  // The one raw-HTML sink in this module (primitive-guards R10). Every
  // interpolated value below is a t() literal, an icon() constant, a NUMBER, or
  // escape()d: the blob URL, the field ids, the readouts and the aria-labels.
  // The two readouts are written HERE at their opening values rather than left
  // empty for paint(): the savings line is a live region, and a region that is
  // filled in after insertion announces itself the moment the card appears.
  el.innerHTML = `
    <section class="trimo" role="group" aria-label="${escape(t('Trim to content'))}">
      <div class="trimo-head">
        <span class="trimo-glyph" aria-hidden="true">${icon('crop', { size: 16 })}</span>
        <span class="trimo-title">${t('Trim to content')}</span>
        <span class="trimo-savings" id="${escape(savingsId)}" role="status" aria-live="polite" data-trimo-savings>${escape(savingsText(proposal))}</span>
        <button type="button" class="trimo-x" data-trimo-act="cancel" aria-label="${escape(t('Cancel'))}" title="${escape(t('Cancel'))}">&#x2715;</button>
      </div>
      <div class="trimo-figs">
        <figure class="trimo-fig">
          <span class="trimo-shot"><img src="${escape(objectUrl(proposal.originalFile))}" alt=""></span>
          <figcaption>${t('As uploaded')} <span class="trimo-dims">${escape(dims(proposal.originalBox))}</span></figcaption>
        </figure>
        <figure class="trimo-fig">
          <span class="trimo-shot"><img data-trimo-after alt=""></span>
          <figcaption>${t('Trimmed')} <span class="trimo-dims" id="${escape(afterDimsId)}" data-trimo-after-dims>${escape(dims(proposal.trimmedBox))}</span></figcaption>
        </figure>
      </div>
      <div class="trimo-pad">
        <label class="field-label" for="${escape(padId)}">${t('Padding')}</label>
        <input class="field-input field-input--sm trimo-pad-input" id="${escape(padId)}" type="number"
               min="0" max="${TRIM_PAD_MAX}" step="1" value="${startPad}" inputmode="numeric"
               aria-describedby="${escape(savingsId)} ${escape(afterDimsId)}">
        <span class="trimo-unit">${escape(unit)}</span>
      </div>
      <p class="trimo-note">${t('Trimming is permanent for the stored asset. The original margins are not kept.')}</p>
      <div class="trimo-actions">
        <button type="button" class="btn btn--primary" data-trimo-act="trim">${t('Trim')}</button>
        <button type="button" class="btn btn--ghost" data-trimo-act="keep">${t('Keep original margins')}</button>
      </div>
    </section>`;

  const afterImg = el.querySelector<HTMLImageElement>('[data-trimo-after]');
  const afterDims = el.querySelector<HTMLElement>('[data-trimo-after-dims]');
  const savingsEl = el.querySelector<HTMLElement>('[data-trimo-savings]');
  const padInput = el.querySelector<HTMLInputElement>('.trimo-pad-input');

  /** Only on a real change: the savings line is a live region, and rewriting it
   *  with the text it already holds would announce the same sentence again. */
  const setText = (node: HTMLElement | null, next: string): void => {
    if (node && node.textContent !== next) node.textContent = next;
  };

  function paint(): void {
    if (afterImg) {
      const previous = afterImg.getAttribute('src');
      afterImg.src = objectUrl(current.trimmedFile);
      if (previous) dropUrl(previous);
    }
    setText(afterDims, dims(current.trimmedBox));
    setText(savingsEl, savingsText(current));
  }

  function apply(pad: number): void {
    const want = ++seq;
    void current.retrim(pad).then((next) => {
      if (resolved || want !== seq) return;
      current = next;
      paint();
    });
  }

  function resolve(file: File, trimmed: boolean): void {
    if (resolved) return;
    resolved = true;
    opts.onResolve(file, trimmed);
  }

  /** Backing out. NOT an answer: nothing is chosen and nothing is stored. */
  function cancel(): void {
    if (resolved) return;
    resolved = true;
    opts.onCancel();
  }

  const ac = new AbortController();
  const { signal } = ac;

  el.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-trimo-act]')?.dataset.trimoAct;
    if (act === 'trim') resolve(current.trimmedFile, true);
    else if (act === 'keep') resolve(proposal.originalFile, false);
    else if (act === 'cancel') cancel();
  }, { signal });

  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    cancel(); // a dismissal backs out; it does not pick the file for the user
  }, { signal });

  if (padInput) {
    // Debounced: typing "12" passes through 1 on the way, and each step is a
    // fresh derive from the original bytes.
    padInput.addEventListener('input', () => {
      const raw = Math.round(Number(padInput.value));
      const pad = Math.max(0, Math.min(TRIM_PAD_MAX, Number.isFinite(raw) ? raw : 0));
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => apply(pad), 120);
    }, { signal });
  }

  paint();
  if (startPad !== current.pad) apply(startPad);
  el.querySelector<HTMLButtonElement>('[data-trimo-act="trim"]')?.focus();

  return () => {
    ac.abort();
    if (debounce) clearTimeout(debounce);
    seq++; // abandon any in-flight retrim
    for (const u of [...urls]) dropUrl(u);
    el.innerHTML = '';
  };
}
