// SPDX-License-Identifier: MPL-2.0
/**
 * PowerPoint (.pptx) export - DOM page(s) -> OOXML slides. Extracted verbatim from
 * bridge/export.ts. Self-contained apart from a small set of shared render helpers
 * it imports back from export.ts (pureRotationDeg / detectUnsupportedCss /
 * inlineBlobUrlsInEl / rasterizeNodeToDataUrl / stripCommentNodes + the ExportOpts
 * type). That back-edge is a deliberate, lazy circular import: export.ts imports
 * renderPptx for its dispatch, and every symbol here is referenced only at export
 * time, never at module init, so resolution order is safe. (To remove the cycle
 * later, lift those shared helpers into a common render-util module.)
 */
import { buildPptxParts, EMU_PER_PX, parseGradientAngle, parseGradientStop, splitCssArgs, svgToNativePptx } from "@lolly/engine";
import type { PptxSlide, PptxShape, PptxFill, PptxMedia, PptxLayout, PptxAudio } from "../../../../engine/src/pptx.ts";
import { parseCssColorFull, objectPositionFractions } from "./export-css.ts";
import { asStr, deckAnim, deckAudioExt, deckBox, deckFill, deckNarrationMark, deckNotes, deckPlaceholder, deckSrcRect, deckSlideTransitions, deckSyncShape, deckTheme, emuOf, parseDeckModel, type DeckBox, type DeckColorResolver, type DeckNotes, type DeckNoteSink } from "./pptx-deck.ts";
import { narrationDwellMs } from "../lib/motion-model.ts";
import { pureRotationDeg, detectUnsupportedCss, inlineBlobUrlsInEl, rasterizeNodeToDataUrl, imprintEmbedCanvas, stripCommentNodes, _host, type ExportOpts, type ImprintState } from "./export.ts";

type Rgba = [number, number, number, number];

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const MAX_PPTX_PX = 3000;      // per-side cap for any rasterised slide picture
const PPTX_RASTER_SCALE = 2;   // default resolution multiple over an element's CSS box
const MAX_PPTX_SHAPES = 1200;  // safety bound on objects emitted for one slide

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const hex2 = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
const rgbaHex = (c: Rgba): string => `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;

function pptxSolidFill(colorStr: string | null | undefined): PptxFill | null {
  const c = parseCssColorFull(colorStr);
  return c && c[3] > 0.01 ? { solid: rgbaHex(c), alpha: c[3] < 1 ? c[3] : undefined } : null;
}
// A CSS linear-gradient background → a PptxFill (reuses the engine gradient parsers).
function pptxGradientFill(bgImage: string | null | undefined): PptxFill | null {
  if (!bgImage || !/linear-gradient\(/i.test(bgImage)) return null;
  const m = /linear-gradient\(([\s\S]*)\)\s*$/i.exec(bgImage.trim());
  if (!m) return null;
  const args = splitCssArgs(m[1]!);
  if (!args.length) return null;
  let angle = 180, start = 0;
  if (/(^|\s)to\s|deg|turn|rad|grad/i.test(args[0]!)) { angle = parseGradientAngle(args[0]!) * 180 / Math.PI; start = 1; }
  const stopArgs = args.slice(start);
  const grad: Array<{ pos: number; color: string; alpha?: number }> = [];
  stopArgs.forEach((raw, i) => {
    const s = parseGradientStop(raw, i, stopArgs.length);
    const c = s.colorStr ? parseCssColorFull(s.colorStr) : null;
    if (!c) return;
    const pos = s.offset.endsWith('%') ? parseFloat(s.offset) / 100 : (stopArgs.length > 1 ? i / (stopArgs.length - 1) : 0);
    // The stop's alpha lives on `opacity`, not inside `colorStr` - parseGradientStop
    // returns an OPAQUE colour precisely so an SVG consumer cannot apply the alpha
    // twice. Reading only c[3] therefore dropped per-stop transparency from PPTX
    // fills; take the lower of the two so either carrier works.
    const alpha = Math.min(c[3], Number.isFinite(s.opacity) ? s.opacity : 1);
    grad.push({ pos, color: rgbaHex(c), alpha: alpha < 1 ? alpha : undefined });
  });
  return grad.length >= 2 ? { grad, angle } : null;
}
// Sniff a fetched background asset's kind from magic bytes / URL.
function sniffImgExt(buf: Uint8Array, url: string): 'png' | 'jpeg' | 'svg' | null {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg';
  const head = new TextDecoder().decode(buf.subarray(0, 256)).trim();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'svg';
  return /\.svg(\?|#|$)/i.test(url) ? 'svg' : null;
}
// Rasterise SVG bytes to a PNG (the fallback blip a PowerPoint svgBlip requires).
// `imprint` (the per-export ImprintState sink) is threaded ONLY for the tool's own
// inline <svg> art (svgPic) - never for a fetched background / user-logo SVG, whose
// PNG fallback must stay byte-faithful (those callers pass undefined).
async function svgBytesToPng(svgBytes: Uint8Array, w: number, h: number, imprint?: ImprintState): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null;
  const url = URL.createObjectURL(new Blob([svgBytes as BlobPart], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('svg raster')); im.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.min(MAX_PPTX_PX, Math.round(w)));
    canvas.height = Math.max(2, Math.min(MAX_PPTX_PX, Math.round(h)));
    const cx = canvas.getContext('2d');
    if (!cx) return null;
    cx.drawImage(img, 0, 0, canvas.width, canvas.height);
    imprintEmbedCanvas(canvas, imprint);   // Lolly-rendered inline art only (opt-in, size-floored)
    return dataUrlToBytes(canvas.toDataURL('image/png'));
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

// Inline tags whose text folds into the PARENT's text box as styled RUNS (instead of
// becoming their own overlapping box). Anything else is block-level → its own object.
const PPTX_INLINE_TAGS = new Set(['span', 'b', 'strong', 'i', 'em', 'a', 'u', 's', 'strike',
  'small', 'sub', 'sup', 'mark', 'code', 'abbr', 'cite', 'q', 'time', 'label', 'wbr', 'bdi', 'bdo', 'font']);

// True when el's content is only text + inline elements (no block/asset descendants) - 
// i.e. one flowing text block that should become a single text box, not many.
function pptxIsInlineTextTree(el: Element): boolean {
  for (const nd of Array.from(el.childNodes)) {
    if (nd.nodeType !== 1) continue;
    const t = (nd as Element).tagName.toLowerCase();
    if (t === 'br') continue;
    if (!PPTX_INLINE_TAGS.has(t) || !pptxIsInlineTextTree(nd as Element)) return false;
  }
  return true;
}

type PptxRunDraft = { text: string; sizePt: number; color?: string; bold?: boolean; italic?: boolean; font?: string };
function pptxRunStyle(text: string, cs: CSSStyleDeclaration): PptxRunDraft {
  const cc = parseCssColorFull(cs.color);
  return {
    text,
    sizePt: (parseFloat(cs.fontSize) || 16) * 0.75,
    color: cc ? rgbaHex(cc) : undefined,
    bold: cs.fontWeight === 'bold' || (parseInt(cs.fontWeight, 10) || 400) >= 600,
    italic: cs.fontStyle === 'italic',
    font: (cs.fontFamily || '').split(',')[0]?.replace(/["']/g, '').trim() || undefined,
  };
}

// Flatten an inline text tree into styled runs - each text node carries its OWN parent's
// computed font style, so <b>/<i>/coloured spans keep their formatting in one text box.
function pptxCollectRuns(el: Element): PptxRunDraft[] {
  const runs: PptxRunDraft[] = [];
  const walk = (node: Element): void => {
    for (const nd of Array.from(node.childNodes)) {
      if (nd.nodeType === 3) {
        const raw = (nd.textContent || '').replace(/\s+/g, ' ');
        if (raw) runs.push(pptxRunStyle(raw, window.getComputedStyle(node)));
      } else if (nd.nodeType === 1) {
        if ((nd as Element).tagName.toLowerCase() === 'br') runs.push({ text: ' ', sizePt: 12 });
        else walk(nd as Element);
      }
    }
  };
  walk(el);
  while (runs.length && !runs[0]!.text.trim()) runs.shift();
  while (runs.length && !runs[runs.length - 1]!.text.trim()) runs.pop();
  return runs;
}

// Intrinsic aspect (w,h) of an SVG from its viewBox (or width/height attrs), for
// fitting it into a box without distortion.
function pptxSvgAspect(bytes: Uint8Array): [number, number] | null {
  const head = new TextDecoder().decode(bytes.subarray(0, 1024));
  const vb = /viewBox\s*=\s*["']\s*[\d.eE+-]+\s+[\d.eE+-]+\s+([\d.eE+-]+)\s+([\d.eE+-]+)/.exec(head);
  if (vb) return [parseFloat(vb[1]!), parseFloat(vb[2]!)];
  const w = /\bwidth\s*=\s*["']?([\d.]+)/.exec(head), h = /\bheight\s*=\s*["']?([\d.]+)/.exec(head);
  return w && h ? [parseFloat(w[1]!), parseFloat(h[1]!)] : null;
}
// object-position → the 0..1 fraction of the leftover space to put before the image.
const pptxObjFractions = (posStr: string | undefined): [number, number] => objectPositionFractions(posStr);
// The same, resolved to whole EMU for a shape offset.
function pptxObjOffset(posStr: string | undefined, freeX: number, freeY: number): { ox: number; oy: number } {
  const [fx, fy] = pptxObjFractions(posStr);
  return { ox: Math.round(freeX * fx), oy: Math.round(freeY * fy) };
}
// Fit an intrinsic aspect into a box per object-fit:contain (+ object-position); other
// fit modes keep the full box (stretch), which is what a plain blipFill does.
function pptxFitInto(box: { x: number; y: number; cx: number; cy: number }, aw: number, ah: number, style: CSSStyleDeclaration): { x: number; y: number; cx: number; cy: number } {
  if ((style.objectFit || 'fill') !== 'contain' || !(aw > 0 && ah > 0)) return box;
  const imgA = aw / ah, boxA = box.cx / Math.max(1, box.cy);
  let cx = box.cx, cy = box.cy;
  if (imgA > boxA) cy = Math.round(box.cx / imgA); else cx = Math.round(box.cy * imgA);
  const { ox, oy } = pptxObjOffset(style.objectPosition, box.cx - cx, box.cy - cy);
  return { x: box.x + ox, y: box.y + oy, cx, cy };
}
// object-fit:cover - the box stays full; the SOURCE is cropped (srcRect) so the visible
// aspect matches without distorting. Returns per-edge crop fractions, or null when no
// crop is needed. object-position places the crop window.
function pptxCoverSrcRect(boxCx: number, boxCy: number, aw: number, ah: number, style: CSSStyleDeclaration): { l: number; t: number; r: number; b: number } | null {
  if ((style.objectFit || 'fill') !== 'cover' || !(aw > 0 && ah > 0 && boxCx > 0 && boxCy > 0)) return null;
  const imgA = aw / ah, boxA = boxCx / boxCy;
  if (Math.abs(imgA - boxA) < 1e-3) return null;
  // FRACTIONS, not the EMU-rounded offsets: pptxObjOffset rounds, and rounding a
  // 0..1 fraction collapses every position to an edge - a plain centred cover image
  // (0.5 → 1) used to crop entirely from the left, and a framing pan (plans/148)
  // never survived at all.
  const [fx, fy] = pptxObjFractions(style.objectPosition);
  if (imgA > boxA) {                                   // image wider → crop left/right
    const crop = 1 - boxA / imgA;
    return { l: crop * fx, t: 0, r: crop * (1 - fx), b: 0 };
  }
  const crop = 1 - imgA / boxA;                        // image taller → crop top/bottom
  return { l: 0, t: crop * fy, r: 0, b: crop * (1 - fy) };
}

// Per-side CSS borders → thin rect shapes. A uniform 4-side border returns one outline
// (via `line`); otherwise each visible side becomes its own edge rect - so a heading's
// `border-bottom` accent rule survives (the earlier top-side-only check missed it).
type PptxEdgeRect = { x: number; y: number; cx: number; cy: number; fill: PptxFill };
function pptxBorderRects(style: CSSStyleDeclaration, box: { x: number; y: number; cx: number; cy: number }, E: number): { outline?: { color: string; w: number }; edges: PptxEdgeRect[] } {
  const side = (w: string, s: string, c: string) => {
    const width = parseFloat(w) || 0;
    if (width <= 0 || s === 'none' || s === 'hidden') return null;
    const col = parseCssColorFull(c);
    return col && col[3] > 0.01 ? { w: width, color: rgbaHex(col), alpha: col[3] < 1 ? col[3] : undefined } : null;
  };
  const t = side(style.borderTopWidth, style.borderTopStyle, style.borderTopColor);
  const r = side(style.borderRightWidth, style.borderRightStyle, style.borderRightColor);
  const b = side(style.borderBottomWidth, style.borderBottomStyle, style.borderBottomColor);
  const l = side(style.borderLeftWidth, style.borderLeftStyle, style.borderLeftColor);
  type Side = ReturnType<typeof side>;
  const same = (a: Side, z: Side): boolean => (!a && !z) || (!!a && !!z && a.w === z.w && a.color === z.color);
  if (t && same(t, r) && same(t, b) && same(t, l)) return { outline: { color: t.color, w: Math.round(t.w * E) }, edges: [] };
  const edges: PptxEdgeRect[] = [];
  const fillOf = (s: NonNullable<Side>): PptxFill => ({ solid: s.color, alpha: s.alpha });
  const px = (w: number) => Math.max(1, Math.round(w * E));
  if (t) edges.push({ x: box.x, y: box.y, cx: box.cx, cy: px(t.w), fill: fillOf(t) });
  if (b) edges.push({ x: box.x, y: box.y + box.cy - px(b.w), cx: box.cx, cy: px(b.w), fill: fillOf(b) });
  if (l) edges.push({ x: box.x, y: box.y, cx: px(l.w), cy: box.cy, fill: fillOf(l) });
  if (r) edges.push({ x: box.x + box.cx - px(r.w), y: box.y, cx: px(r.w), cy: box.cy, fill: fillOf(r) });
  return { edges };
}

import { bakeTextStyles } from './bake-text-styles.ts';
export { bakeTextStyles };

// Walk one page element into PPTX shapes + media (see the section comment above).
async function pptxSlideFromPage(pageEl: Element, opts: ExportOpts): Promise<PptxSlide> {
  const shapes: PptxShape[] = [];
  const media: PptxMedia[] = [];
  const rootRect = pageEl.getBoundingClientRect();
  const E = EMU_PER_PX;
  const addMedia = (bytes: Uint8Array, ext: PptxMedia['ext']): number => (media.push({ bytes, ext }), media.length - 1);
  const boxOf = (r: DOMRect) => ({ x: Math.round((r.left - rootRect.left) * E), y: Math.round((r.top - rootRect.top) * E), cx: Math.round(r.width * E), cy: Math.round(r.height * E) });
  const full = () => shapes.length >= MAX_PPTX_SHAPES;

  // NATIVE-vector fast path: lower a FLAT stroke/fill SVG (the user's own line-art)
  // into real, editable PowerPoint custGeom shapes at `box`, killing the round-trip
  // (EMF → Google Drawings → Slides → PPTX) users otherwise do to keep art vector.
  // Since engine 1.128 plain <text> runs come along as native text boxes - live,
  // editable, correctly-named text in PowerPoint AND Google Slides (which matches
  // the run's font name against the Google Fonts catalogue, so a brand face that
  // lives there - SUSE does - renders as the real font instead of a serif
  // substitute). Returns true when it emitted native shapes; false → the caller
  // keeps its existing raster (svgBlip pic) path, so a gradient/filter/opacity/
  // blend SVG - or text the lowering can't carry faithfully - never regresses.
  function tryNativeSvg(svgText: string, box: { x: number; y: number; cx: number; cy: number }): boolean {
    const native = svgToNativePptx(svgText, box.cx, box.cy);
    if (!native || (!native.paths.length && !native.texts.length)) return false;
    for (const s of native.paths) { if (full()) break; shapes.push({ ...s, x: box.x, y: box.y }); }
    // Text boxes carry their own geometry inside the element box; offset to it.
    for (const t of native.texts) { if (full()) break; shapes.push({ ...t, x: box.x + t.x, y: box.y + t.y }); }
    return true;
  }

  async function rasterPic(el: HTMLElement, r: DOMRect, name?: string, hiRes = false): Promise<void> {
    let scale = PPTX_RASTER_SCALE;
    if (hiRes) {
      const nat = (el as HTMLImageElement).naturalWidth || 0;
      if (nat > r.width) scale = Math.max(scale, Math.min(nat / r.width, MAX_PPTX_PX / Math.max(1, r.width)));
    }
    const pxW = Math.max(2, Math.min(MAX_PPTX_PX, Math.round(r.width * scale)));
    const pxH = Math.max(2, Math.min(MAX_PPTX_PX, Math.round(r.height * scale)));
    // rasterPic always bakes a LIVE DOM subtree (rotated el / canvas / video /
    // CSS-fallback / treated <img>) - Lolly-rendered content, so it carries the
    // imprint (opts.imprint gated + size-floored inside rasterizeNodeToDataUrl).
    const dataUrl = await rasterizeNodeToDataUrl(el, pxW, pxH, undefined, opts._imprintSink);
    if (dataUrl) shapes.push({ kind: 'pic', ...boxOf(r), media: addMedia(dataUrlToBytes(dataUrl), 'png'), name });
  }

  async function svgPic(el: Element, r: DOMRect): Promise<void> {
    const clone = el.cloneNode(true) as Element;
    stripCommentNodes(clone);
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // Computed text styling must survive serialisation for BOTH paths below (see
    // bakeTextStyles): the native lowering reads attributes, and the svgBlip part
    // renders without the tool's stylesheet.
    bakeTextStyles(el, clone);
    // With the computed styling baked as attributes, embedded <style> blocks are
    // spent (the community brand-font pattern puts one in <defs>, and its mere
    // presence is a hard bail in the lowering - it can't know the rules are
    // benign). <script> never belongs in an export either way.
    clone.querySelectorAll('style, script').forEach(n => n.remove());
    // NATIVE first: a flat SVG becomes editable custGeom shapes + text boxes (no
    // blob-url inline needed - the lowering bails on <image>/anything raster).
    // Rich SVG → raster below.
    if (tryNativeSvg(new XMLSerializer().serializeToString(clone), boxOf(r))) return;
    await inlineBlobUrlsInEl(clone);
    const svgBytes = new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + new XMLSerializer().serializeToString(clone));
    // svgPic handles a literal <svg> DOM node - the tool's OWN inline art (icons /
    // illustrations / charts), so its PNG fallback carries the imprint. The raw SVG
    // bytes (addMedia below) stay untouched - vector, outside pixel-watermark's domain.
    const png = await svgBytesToPng(svgBytes, r.width * 2, r.height * 2, opts._imprintSink);
    if (!png) { await rasterPic(el as HTMLElement, r, 'vector'); return; }  // no fallback raster → bake
    const pngIdx = addMedia(png, 'png');
    const svgIdx = addMedia(svgBytes, 'svg');
    shapes.push({ kind: 'pic', ...boxOf(r), media: pngIdx, svg: svgIdx, name: 'vector' });
  }

  async function bgImagePic(el: Element, style: CSSStyleDeclaration, r: DOMRect): Promise<void> {
    const m = /url\((["']?)([^"')]+)\1\)/.exec(style.backgroundImage);
    if (!m) return;
    try {
      const buf = new Uint8Array(await (await fetch(m[2]!)).arrayBuffer());
      const ext = sniffImgExt(buf, m[2]!);
      if (ext === 'png' || ext === 'jpeg') { shapes.push({ kind: 'pic', ...boxOf(r), media: addMedia(buf, ext), name: 'background' }); return; }
      if (ext === 'svg') {
        // NATIVE first (flat art fills the element box); else the raster svgBlip.
        if (tryNativeSvg(new TextDecoder().decode(buf), boxOf(r))) return;
        const png = await svgBytesToPng(buf, r.width * 2, r.height * 2);
        if (png) shapes.push({ kind: 'pic', ...boxOf(r), media: addMedia(png, 'png'), svg: addMedia(buf, 'svg'), name: 'background' });
      }
    } catch { /* asset unreachable - skip */ }
  }

  // An <img>. A SVG-sourced logo (the common case in Lolly - assets arrive as
  // <img src="blob:…svg">) is embedded as a REAL vector (svgBlip) so it extracts crisp;
  // an untreated raster embeds its ORIGINAL bytes (native res, no re-encode); a treated
  // image (CSS filter / blend) is rasterised so the treatment is baked in.
  async function imgPic(el: Element, style: CSSStyleDeclaration, r: DOMRect): Promise<void> {
    const src = (el as HTMLImageElement).currentSrc || el.getAttribute('src') || '';
    const treated = (style.filter && style.filter !== 'none') || (style.mixBlendMode && style.mixBlendMode !== 'normal');
    if (src && !treated) {
      try {
        const buf = new Uint8Array(await (await fetch(src)).arrayBuffer());
        const ext = sniffImgExt(buf, src);
        if (ext === 'svg') {
          // Keep it a real vector; place it contain-fitted (logos use object-fit:contain).
          const asp = pptxSvgAspect(buf);
          const placed = asp ? pptxFitInto(boxOf(r), asp[0], asp[1], style) : boxOf(r);
          // NATIVE first: a flat logo lowers to editable custGeom at the fitted box.
          if (tryNativeSvg(new TextDecoder().decode(buf), placed)) return;
          const png = await svgBytesToPng(buf, (placed.cx / E) * 2, (placed.cy / E) * 2);
          if (png) { shapes.push({ kind: 'pic', ...placed, media: addMedia(png, 'png'), svg: addMedia(buf, 'svg'), name: 'vector' }); return; }
        } else if (ext === 'png' || ext === 'jpeg') {
          const im = el as HTMLImageElement;
          const nw = im.naturalWidth || 0, nh = im.naturalHeight || 0;
          const box = boxOf(r);
          // cover → keep the full box but crop the source (srcRect); contain → letterbox;
          // fill/default → stretch to the box (a plain blipFill).
          const srcRect = pptxCoverSrcRect(box.cx, box.cy, nw, nh, style) ?? undefined;
          const placed = srcRect ? box : pptxFitInto(box, nw, nh, style);
          shapes.push({ kind: 'pic', ...placed, media: addMedia(buf, ext), name: 'image', srcRect }); return;
        }
      } catch { /* fall through to rasterise */ }
    }
    await rasterPic(el as HTMLElement, r, 'image', true);
  }

  async function visit(el: Element): Promise<void> {
    if (full() || el.nodeType !== 1) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'style' || tag === 'script') return;
    // Speaker notes travel as slide.notes (read below), never as a shape. The
    // display:none guard underneath already drops them, but that leans on the
    // tool's CSS surviving - this makes it structural.
    if (el.hasAttribute('data-slide-notes')) return;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 0.5 || rect.height < 0.5) return;

    // A rotated element: bake it to a picture (rotation preserved) rather than
    // reconstructing the transform per shape kind. Rare in these tools; layout secondary.
    if (pureRotationDeg(style.transform)) { await rasterPic(el as HTMLElement, rect, 'rotated'); return; }
    if (tag === 'svg') { await svgPic(el, rect); return; }
    if (tag === 'img') { await imgPic(el, style, rect); return; }
    if (tag === 'canvas' || tag === 'video') { await rasterPic(el as HTMLElement, rect, tag); return; }

    // Effects the shape/text walkers can't express → bake the subtree to a picture.
    // (background-image:url() is handled specially below - it's an extractable asset.)
    // NO vectorCaps at all, including the `cssFilter` one the SVG walker declares: a
    // .pptx shape carries no CSS filter, so a blurred or drop-shadowed box bakes to a
    // picture here rather than shipping as a flat shape with the effect quietly gone.
    // (It used to ship flat - detectUnsupportedCss declared any parseable filter
    // supported for every caller. Same silent drop the PDF walker had; plan 104 P1d.)
    // The picture is captured at the element's own rect with no spill padding, so an
    // effect that paints outside the box is clipped at its edge - visible degradation,
    // which is the point, and better than the effect not being there at all.
    const reason = detectUnsupportedCss(el, style);
    if (reason && reason !== 'background-image:url()') { await rasterPic(el as HTMLElement, rect, reason); return; }

    // Background / border / radius → rect shape(s) (layout context). A uniform border
    // becomes the rect's outline; per-side borders (e.g. a heading's accent
    // border-bottom rule) each become their own thin edge rect.
    const box = boxOf(rect);
    const fill = pptxGradientFill(style.backgroundImage) ?? pptxSolidFill(style.backgroundColor) ?? undefined;
    const borders = pptxBorderRects(style, box, E);
    // PPTX roundRect carries ONE corner radius, so an asymmetric box (deck-builder shape
    // boxes now allow a per-corner [TL,TR,BR,BL] radius) can only approximate. Take the
    // LARGEST of the four corners rather than the top-left alone: top-left-only silently
    // dropped ALL rounding whenever that corner was 0 (e.g. [0,96,96,0] → a square), which
    // is more wrong than keeping a rounded look. Uniform radii are unaffected.
    const radiusPx = Math.max(
      parseFloat(style.borderTopLeftRadius) || 0,
      parseFloat(style.borderTopRightRadius) || 0,
      parseFloat(style.borderBottomRightRadius) || 0,
      parseFloat(style.borderBottomLeftRadius) || 0,
    );
    if (fill || borders.outline || radiusPx > 0) {
      shapes.push({ kind: 'rect', ...box, fill, line: borders.outline, radius: radiusPx > 0 ? Math.round(radiusPx * E) : undefined });
    }
    for (const e of borders.edges) shapes.push({ kind: 'rect', x: e.x, y: e.y, cx: e.cx, cy: e.cy, fill: e.fill });
    if (/url\(/.test(style.backgroundImage)) await bgImagePic(el, style, rect);

    // A pure text block (only text + inline formatting) → ONE editable text box whose
    // runs carry per-fragment styling, so <b>/<i>/coloured spans stay in the same box
    // instead of each becoming a separate, overlapping shape.
    if (pptxIsInlineTextTree(el) && (el.textContent || '').trim()) {
      const runs = pptxCollectRuns(el);
      if (runs.length) {
        const align: 'l' | 'ctr' | 'r' | 'just' =
          style.textAlign === 'center' ? 'ctr' : style.textAlign === 'right' ? 'r' : style.textAlign === 'justify' ? 'just' : 'l';
        shapes.push({ kind: 'text', ...boxOf(rect), anchor: 't', paras: [{ align, runs }] });
      }
      return;   // inline children are consumed as runs - don't recurse into them
    }

    // Otherwise recurse block children (each stacks above this element's background).
    for (const child of Array.from(el.children)) { if (full()) break; await visit(child); }
  }

  await visit(pageEl);
  if (full()) _host?.log?.('warn', `pptx: slide hit the ${MAX_PPTX_SHAPES}-object cap; some elements were dropped.`);
  return { shapes, media };
}

/**
 * The imported source document's author, when the stage declares one via the
 * `data-source-author` attribute (the deck/doc studios emit it from their
 * `sourceAuthor` input, set at import from the source file's own core props).
 * The shared core-props writer then carries BOTH authors when they differ
 * (plans/144 G6 follow-up).
 */
export function sourceAuthorOf(node: Element): string | undefined {
  const el = node.matches?.('[data-source-author]') ? node : node.querySelector?.('[data-source-author]');
  const v = el?.getAttribute?.('data-source-author')?.trim();
  return v || undefined;
}

/* ── per-slide narration (plans/180 M-C) ─────────────────────────────────────── */

/** Ceiling on one narration clip's bytes. A minute of 24 kHz mono WAV is about 3 MB, so
 *  this is generous for speech and still refuses a whole film dropped on a slide. */
const MAX_NARRATION_BYTES = 64 * 1024 * 1024;

/** Does the document ask its slides to advance by themselves? The Design tool stamps
 *  `data-auto-advance` on the render root for exactly this, and it is EXPLICIT (plan 179
 *  T3): every frame carries a dwell, and whether that dwell drives the deck is one
 *  document-level flag. Without it a narrated .pptx still plays its audio - it just waits
 *  for the presenter's click, which is what a click-advanced deck asked for. */
function deckAutoAdvances(node: Element | null | undefined): boolean {
  if (!node) return false;
  return !!(node.matches?.('[data-auto-advance]') || node.querySelector?.('[data-auto-advance]'));
}

/** The frame's own dwell in ms, as `data-frame-dur` stamps it, or 0. */
function pageDwellMs(page: Element | null | undefined): number {
  const v = Number(page?.getAttribute?.('data-frame-dur'));
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
}

/**
 * One slide's narration clip, ready for the engine's audio part family.
 *
 * The bytes are fetched and passed through UNTOUCHED (plans/180 section 7): a narration
 * WAV carries a C2PA manifest in its RIFF chunks saying the voice is synthetic, and any
 * re-encode on the way into the package would quietly strip that claim. So there is no
 * transcode here, not even a container change - a clip whose container the writer cannot
 * declare is dropped instead.
 *
 * `advanceAfterMs` is the slide's own dwell, which the narration dwell solver has already
 * sized to hold the clip (T1); a frame with no stamped dwell falls back to deriving one
 * from the clip's length, so the deck never moves on mid-sentence.
 */
async function slideNarration(page: Element | null | undefined, index: number, autoAdvance: boolean): Promise<PptxAudio | null> {
  const marks = page?.querySelectorAll ? [...page.querySelectorAll('[data-audio-src]')] : [];
  const mark = deckNarrationMark(marks);
  if (!mark) return null;
  try {
    const res = await fetch(mark.src);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.byteLength > MAX_NARRATION_BYTES) return null;
    const ext = deckAudioExt(bytes, mark.src);
    if (!ext) {
      _host?.log?.('warn', 'pptx: a slide’s narration is in a container PowerPoint cannot embed; the slide is silent.');
      return null;
    }
    const durationMs = mark.durationMs;
    const dwell = pageDwellMs(page) || narrationDwellMs({ narrationMs: durationMs });
    return {
      bytes, ext, durationMs, autoplay: true,
      ...(autoAdvance && dwell > 0 ? { advanceAfterMs: dwell } : {}),
      name: `narration-${index + 1}.${ext}`,
    };
  } catch { return null; /* clip unreachable - the slide keeps its picture and its notes */ }
}

/**
 * The narration clip for every slide, index-aligned with the deck's own slides.
 *
 * The rendered `[data-pdf-page]` elements and the authored deck slides come from the SAME
 * frame list in the SAME order (Design's `frameGroupsFor` and `deckModelFor` both sort by
 * `order` then `x`), which is what makes matching by index sound. When the two counts
 * disagree that correspondence is not something to guess at, so no slide gets audio.
 */
async function narrationForSlides(node: Element | undefined, slideCount: number): Promise<Array<PptxAudio | null>> {
  const pages = node?.querySelectorAll ? [...node.querySelectorAll('[data-pdf-page]')] : [];
  if (!pages.length || pages.length !== slideCount) return [];
  const autoAdvance = deckAutoAdvances(node);
  const out: Array<PptxAudio | null> = [];
  for (let i = 0; i < pages.length; i++) out.push(await slideNarration(pages[i]!, i, autoAdvance));
  return out;
}

function pptxMeta(opts: ExportOpts, sourceAuthor?: string): PptxBuildOptsMeta {
  if (!opts.meta && !sourceAuthor) return null;
  const m = opts.meta;
  return {
    title: m?.tool, description: m?.description, source: m?.source, contact: m?.contact,
    author: m?.author, sourceAuthor,
  };
}
type PptxBuildOptsMeta = { title?: string; description?: string; source?: string; contact?: string; author?: string; sourceAuthor?: string } | null;

async function zipPptxParts(parts: Record<string, string | Uint8Array>): Promise<Blob> {
  // Dynamic import keeps fflate out of this chunk (as the direct fflate import
  // here did before the shell's zip paths were unified onto lib/zip.ts).
  const { zipAsync } = await import('../lib/zip.ts');
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(parts)) {
    files[path] = typeof content === 'string' ? enc.encode(content) : content;
  }
  return new Blob([(await zipAsync(files)) as BlobPart], { type: PPTX_MIME });
}

// ─── authored deck model (tool-driven NATIVE pptx) ───────────────────────────
// A tool may emit its OWN deck as inline JSON - <script type="application/json"
// data-pptx-deck>{…}</script> - instead of relying on the DOM walk above. That is how a
// tool gets NATIVE tables + precise editable text/theme into PowerPoint. The PURE lowering
// (css→hex, px→EMU, native tables, defensive coercion of the untrusted tool JSON) lives in
// ./pptx-deck.ts (node-tested); this file keeps only the async image fetch + orchestration.
// A malformed/absent model falls back to the DOM walk. See engine PptxSlide/PptxShape.
const PPTX_DECK_SEL = '[data-pptx-deck]';
const MAX_DECK_SLIDES = 500;         // upper bound on an authored deck
const MAX_DECK_ELEMENTS = MAX_PPTX_SHAPES; // elements processed per slide (bounds the fetch storm)
const MAX_DECK_IMG_BYTES = 32 * 1024 * 1024; // 32 MB per embedded image (`src` is tool-controlled)

// An image element - the sole async lowering (it fetches bytes). SVG rides in as a real
// vector (svgBlip + PNG fallback); raster embeds its original bytes; an unreachable/oversized
// asset drops the element but keeps the deck.
async function deckImageShape(el: Record<string, unknown>, box: DeckBox, addMedia: (b: Uint8Array, e: PptxMedia['ext']) => number, animNotes?: DeckNoteSink): Promise<PptxShape | null> {
  const src = asStr(el?.src); if (!src) return null;
  // Native animation rides pictures exactly as it rides the sync shapes (plans/175 WP-E).
  const anim = deckAnim(el?.anim, animNotes);
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_DECK_IMG_BYTES) return null;
    const ext = sniffImgExt(buf, src);
    if (ext === 'png' || ext === 'jpeg') return { kind: 'pic', ...box, media: addMedia(buf, ext), srcRect: deckSrcRect(el?.srcRect), ...(anim ? { anim } : {}) };
    if (ext === 'svg') {
      const png = await svgBytesToPng(buf, (box.cx / EMU_PER_PX) * 2, (box.cy / EMU_PER_PX) * 2);
      if (png) return { kind: 'pic', ...box, media: addMedia(png, 'png'), svg: addMedia(buf, 'svg'), ...(anim ? { anim } : {}) };
    }
  } catch { /* asset unreachable - drop the element, keep the deck */ }
  return null;
}

async function deckElementToShape(el: Record<string, unknown>, addMedia: (b: Uint8Array, e: PptxMedia['ext']) => number, animNotes?: DeckNoteSink, resolve?: DeckColorResolver): Promise<PptxShape | null> {
  if (!el || typeof el !== 'object') return null;
  if (el.t === 'image') return await deckImageShape(el, deckBox(el), addMedia, animNotes);
  return deckSyncShape(el, animNotes, resolve); // rect / text / table (pure)
}

/**
 * The brand-token lookup a deck colour resolves through (plan 179 A12).
 *
 * A Design artboard's fill is a token on any branded document - `var(--brand-surface,
 * #ffffff)` - and pptx-deck.ts understands literal colours only, so before this the
 * default deck exported with no slide background at all.
 *
 * Read the custom properties off THE NODE BEING EXPORTED, not off a global id. Custom
 * properties inherit, and `applyBrandVars` writes the active brand block onto whichever
 * element the caller handed it: `#tool-canvas` in the editor, but a bare
 * `.pro-export-canvas` on the offscreen stage that #/batch renders through (pro/render-
 * export.ts). A `#tool-canvas` lookup found nothing on that route and fell back to
 * `documentElement`, where brand-vars only ever writes `--brand-primary`/`--brand-warn` -
 * so every other `var(--brand-*)` resolved to '', `deckFill` answered undefined, and the
 * same document exported white from the batch route and branded from the editor. Closest
 * ancestor first so a node INSIDE the canvas still finds it; the node itself otherwise.
 * Memoised by name - one deck references the same handful of tokens on every slide.
 * Returns undefined (→ every var() falls back to its own literal) when there is no DOM,
 * which is how the node-side suites reach this module's pure half.
 */
function canvasColorResolver(node?: Element): DeckColorResolver | undefined {
  const doc = typeof document === 'undefined' ? null : document;
  const win = typeof window === 'undefined' ? null : window;
  if (!doc || typeof win?.getComputedStyle !== 'function') return undefined;
  const root = node?.closest?.('#tool-canvas') ?? node
    ?? doc.querySelector?.('#tool-canvas') ?? doc.documentElement;
  if (!root) return undefined;
  const seen = new Map<string, string>();
  let cs: CSSStyleDeclaration | null = null;
  return (name: string): string => {
    const hit = seen.get(name);
    if (hit !== undefined) return hit;
    let val = '';
    try {
      cs ??= win.getComputedStyle(root);
      val = (cs.getPropertyValue(name) || '').trim();
    } catch { /* detached document - the var()'s own fallback stands */ }
    seen.set(name, val);
    return val;
  };
}

// Read + validate a tool-authored deck model off the export node, or null to DOM-walk.
function readDeckModel(node: Element): Record<string, unknown> | null {
  const el = node.querySelector?.(PPTX_DECK_SEL) ?? (node.matches?.(PPTX_DECK_SEL) ? node : null);
  return parseDeckModel(el?.textContent);
}

const MAX_DECK_LAYOUTS = 64;          // upper bound on a gallery (SUSE's template has 26)
const MAX_LAYOUT_PLACEHOLDERS = 16;   // placeholders per layout

// Lower an authored layout gallery (untrusted tool JSON → engine PptxLayout[]). Same
// element vocabulary as slides, so a layout's vector logo rides the same async image
// fetch (svgBlip + PNG fallback). Returns undefined when there is no gallery.
async function deckLayoutsFrom(raw: unknown, resolve?: DeckColorResolver): Promise<PptxLayout[] | undefined> {
  const arr = Array.isArray(raw) ? raw.slice(0, MAX_DECK_LAYOUTS) : [];
  if (!arr.length) return undefined;
  const layouts: PptxLayout[] = [];
  for (const L of arr as Array<Record<string, unknown>>) {
    const media: PptxMedia[] = [];
    const addMedia = (bytes: Uint8Array, ext: PptxMedia['ext']): number => (media.push({ bytes, ext }), media.length - 1);
    const shapes: PptxShape[] = [];
    const els = (Array.isArray(L?.elements) ? L.elements : []).slice(0, MAX_DECK_ELEMENTS);
    for (const el of els) {
      if (shapes.length >= MAX_PPTX_SHAPES) break;
      const shape = await deckElementToShape(el, addMedia, undefined, resolve);
      if (shape) shapes.push(shape);
    }
    const placeholders = (Array.isArray(L?.placeholders) ? L.placeholders : []).slice(0, MAX_LAYOUT_PLACEHOLDERS)
      .map((p: unknown) => deckPlaceholder(p, resolve)).filter((p): p is NonNullable<ReturnType<typeof deckPlaceholder>> => p != null);
    layouts.push({ name: asStr(L?.name) ?? 'Layout', bg: deckFill(L?.bg, resolve), shapes, media, placeholders });
  }
  return layouts;
}

async function renderPptxFromDeck(deck: Record<string, unknown>, opts: ExportOpts, sourceAuthor?: string, node?: Element): Promise<Blob> {
  const size = deck.size as { w?: unknown; h?: unknown } | undefined;
  const emuW = Math.max(1, emuOf(size?.w, 1280));
  const emuH = Math.max(1, emuOf(size?.h, 720));
  // Brand tokens in the deck's colours resolve against the EXPORTED node's cascade (A12).
  const resolve = canvasColorResolver(node);
  const layouts = await deckLayoutsFrom(deck.layouts, resolve);
  const slidesIn = (deck.slides as Array<Record<string, unknown>>).slice(0, MAX_DECK_SLIDES);
  const slides: PptxSlide[] = [];
  // Animation degrade notes (plans/175 WP-E), deduped across the whole deck and
  // logged ONCE - a substitution is worth one line, not one per slide it recurs on.
  // Two lists, two levels: `mapped` is "it moves, differently" (info), `dropped` is
  // "PowerPoint has no form for this, so it sits still" (warn, plans/179 M4).
  const animNotes: DeckNotes = { mapped: [], dropped: [] };
  const transitions = deckSlideTransitions(slidesIn, animNotes);
  // Per-slide narration (plans/180 M-C). The deck model carries no audio - a narration
  // clip is a timeline citizen, not an artboard one - so it is read off the RENDERED
  // pages, index-aligned with these slides.
  const narration = await narrationForSlides(node, slidesIn.length);
  for (const s of slidesIn) {
    const shapes: PptxShape[] = [];
    const media: PptxMedia[] = [];
    const addMedia = (bytes: Uint8Array, ext: PptxMedia['ext']): number => (media.push({ bytes, ext }), media.length - 1);
    const bg = deckFill(s?.bg, resolve);
    if (bg) shapes.push({ kind: 'rect', x: 0, y: 0, cx: emuW, cy: emuH, fill: bg });
    // Bound by elements PROCESSED (not shapes produced): a slide of 100k {t:'image'}
    // elements would otherwise fire 100k fetches even though each returns null.
    const els = (Array.isArray(s?.elements) ? s.elements : []).slice(0, MAX_DECK_ELEMENTS);
    for (const el of els) {
      if (shapes.length >= MAX_PPTX_SHAPES) { _host?.log?.('warn', `pptx: slide hit the ${MAX_PPTX_SHAPES}-object cap; some elements were dropped.`); break; }
      const shape = await deckElementToShape(el, addMedia, animNotes, resolve);
      if (shape) shapes.push(shape);
    }
    const slide: PptxSlide = { shapes, media };
    const notes = deckNotes(s?.notes);
    if (notes) slide.notes = notes;
    // Gallery binding: which layout this slide builds on (the engine clamps the index).
    if (layouts && typeof s?.layout === 'number' && Number.isFinite(s.layout)) slide.layout = s.layout;
    // How the deck ARRIVES on this slide - which is what the slide BEFORE it authored
    // (deckSlideTransitions owns that index shift, and is node-tested on it).
    const tr = transitions[slides.length];
    if (tr) slide.transition = tr;
    const clip = narration[slides.length];
    if (clip) slide.audio = clip;
    slides.push(slide);
    opts.onProgress?.(slides.length, slidesIn.length);
  }
  if (animNotes.mapped.length) {
    _host?.log?.('info', `pptx: animation mapped to PowerPoint's own presets - ${animNotes.mapped.join('; ')}.`);
  }
  // The warn line is the honest half: these are the differences a reader would notice.
  if (animNotes.dropped.length) {
    _host?.log?.('warn', `pptx: some motion has no PowerPoint form and was left out - ${animNotes.dropped.join('; ')}.`);
  }
  const parts = buildPptxParts(slides, { emuW, emuH, theme: deckTheme(deck.theme, resolve), layouts, meta: pptxMeta(opts, sourceAuthor), now: new Date().toISOString() });
  return zipPptxParts(parts);
}

export async function renderPptx(node: Element, opts: ExportOpts): Promise<Blob> {
  const srcAuthor = sourceAuthorOf(node);
  // Fast path: a tool that authored its own native deck model (tables, precise text,
  // brand theme) drives the OOXML directly; the DOM walk below is the general fallback.
  const deck = readDeckModel(node);
  if (deck) return renderPptxFromDeck(deck, opts, srcAuthor, node);

  const pages = node.querySelectorAll ? [...node.querySelectorAll('[data-pdf-page]')] : [];
  const pageEls: Element[] = pages.length ? pages : [node];

  // A PPTX deck has ONE slide size; take it from page 0 (uniform in the common case).
  const r0 = pageEls[0]!.getBoundingClientRect();
  const emuW = Math.max(1, Math.round((r0.width || 1) * EMU_PER_PX));
  const emuH = Math.max(1, Math.round((r0.height || 1) * EMU_PER_PX));

  // A walker tool may still attach a branded layout gallery WITHOUT authoring a full
  // deck model: <script type="application/json" data-pptx-layouts>{ ref?, theme?,
  // layouts:[…] }</script> plus a data-pptx-layout="i" binding per page. `ref` is the
  // px space the gallery was authored in - the tool can't know what size the export
  // stage renders at, so its geometry is rescaled into page-0's real box here. The
  // node may also carry the brand `theme` (the walker path had none before).
  let layouts: PptxLayout[] | undefined;
  let walkTheme: ReturnType<typeof deckTheme>;
  const layoutsEl = node.querySelector?.('[data-pptx-layouts]');
  if (layoutsEl?.textContent?.trim()) {
    try {
      const raw = JSON.parse(layoutsEl.textContent) as Record<string, unknown> | unknown[];
      const arr = Array.isArray(raw) ? raw : (raw as Record<string, unknown>)?.layouts;
      const ref = Array.isArray(raw) ? undefined : (raw as { ref?: { w?: number; h?: number } }).ref;
      if (ref && typeof ref.w === 'number' && ref.w > 0 && typeof ref.h === 'number' && ref.h > 0) {
        scaleDeckLayouts(arr, (r0.width || ref.w) / ref.w, (r0.height || ref.h) / ref.h);
      }
      const resolve = canvasColorResolver(node);   // token-valued gallery colours (A12)
      layouts = await deckLayoutsFrom(arr, resolve);
      if (!Array.isArray(raw)) walkTheme = deckTheme(raw?.theme, resolve);
    } catch { /* malformed gallery - export without one */ }
  }

  const slides: PptxSlide[] = [];
  // Narration rides the DOM-walk path too: a tool that emits `[data-audio-src]` markers
  // inside its pages gets embedded per-slide audio without authoring a deck model.
  const walkAutoAdvance = deckAutoAdvances(node);
  for (const el of pageEls) {
    const slide = await pptxSlideFromPage(el, opts);
    const clip = await slideNarration(el, slides.length, walkAutoAdvance);
    if (clip) slide.audio = clip;
    if (layouts) {
      const li = parseInt(el.getAttribute?.('data-pptx-layout') ?? '', 10);
      if (Number.isFinite(li)) slide.layout = li; // engine clamps
    }
    // Speaker notes: a display:none [data-slide-notes] node inside the page (the
    // convention any tool can emit). Hidden from the shape walk above and from
    // every rasteriser, but readable here - and it is NOT [data-export-hide], so
    // detachExportHidden can't have pulled it out from under us.
    const note = (el.querySelector?.('[data-slide-notes]')?.textContent ?? '').trim();
    if (note) slide.notes = note;
    slides.push(slide);
    opts.onProgress?.(slides.length, pageEls.length);
  }

  const parts = buildPptxParts(slides, { emuW, emuH, layouts, theme: walkTheme, meta: pptxMeta(opts, srcAuthor), now: new Date().toISOString() });
  return zipPptxParts(parts);
}

// Rescale an authored layout gallery (untrusted JSON, px in its `ref` space) into the
// rendered page space, in place: geometry by axis, font points by the vertical factor.
function scaleDeckLayouts(layouts: unknown, sx: number, sy: number): void {
  if (!Array.isArray(layouts) || (sx === 1 && sy === 1)) return;
  for (const L of layouts as Array<Record<string, unknown>>) {
    for (const list of [L?.elements, L?.placeholders]) {
      if (!Array.isArray(list)) continue;
      for (const el of list as Array<Record<string, unknown>>) {
        if (!el || typeof el !== 'object') continue;
        if (typeof el.x === 'number') el.x *= sx;
        if (typeof el.w === 'number') el.w *= sx;
        if (typeof el.y === 'number') el.y *= sy;
        if (typeof el.h === 'number') el.h *= sy;
        const st = el.style as Record<string, unknown> | undefined;
        if (st && typeof st.sizePt === 'number') st.sizePt *= sy;
        if (Array.isArray(el.paras)) {
          for (const p of el.paras as Array<Record<string, unknown>>) {
            if (!Array.isArray(p?.runs)) continue;
            for (const r of p.runs as Array<Record<string, unknown>>) if (typeof r?.sizePt === 'number') r.sizePt *= sy;
          }
        }
      }
    }
  }
}
