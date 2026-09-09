// SPDX-License-Identifier: MPL-2.0
/**
 * The leaf both halves of the export bridge stand on: the ExportOpts contract, the
 * host handle the bridge was created with, the export dimension maths, the lazy
 * dom-to-image loader, and the small canvas helpers. Nothing here renders a
 * format - export.ts (the format renderers) and export-svg-walker.ts (the DOM ->
 * SVG walker) both import from this file, and it imports from neither, which is
 * what keeps the walker out of the export.ts dependency cycle.
 */
import { parseDimension, isPhysical, CSS_DPI, embedWatermark, roundedRectPath } from '@lolly/engine';
import type { ExportAudio } from './audio-envelope.ts';
import type { HostV1, ExportMeta, IngredientCredential } from '@lolly-tools/core/host-v1';
import type { Dimension } from '../../../../engine/src/units.ts';
import type { CornerRadii, CornerPair } from '../../../../engine/src/css-box.ts';
import type { BrandPaletteEntry } from './export-pdf-vector.ts';

export type Rgba = [number, number, number, number];

// The web shell's host is a superset of the engine's HostV1 - it also carries an
// `identity` bridge (bridge/identity.js) used for Content Credentials signing.
interface WebIdentityAPI { signer(): Promise<unknown>; }
export type WebHost = HostV1 & { identity?: WebIdentityAPI };


// Per-export imprint state passed through the vector/container export path,
// instead of a plain `imprint` boolean. renderFormat creates one instance per
// format render. It reaches imprintEmbedCanvas by reference at every raster
// point, across the export.ts / export-pptx.ts boundary. `want` mirrors
// opts.imprint on a Lolly-rendered raster. `applied` is set true only inside
// imprintEmbedCanvas, the first time a mark is actually embedded (want is
// true and the raster clears the size floor). stampC2pa reads `applied` so a
// container export (pdf) claims an imprint only when one was actually
// written. A pure-vector page (a QR PDF) marks no raster, so it must not
// claim one. `undefined` or want:false at a call site means never mark (user
// assets, opted-out exports).
export interface ImprintState { want: boolean; applied: boolean }

// The union of options this host's export path understands. A superset of the
// engine's ExportOpts - the extra fields (print marks, video timing, c2pa, …)
// are web-shell extensions the engine passes through untouched.
export interface ExportOpts {
  scale?: number;
  quality?: number;
  background?: string;
  watermark?: boolean;
  filename?: string;
  /** Linux-package options (plan 197 M6): when the format is 'rpm' or 'tar.gz',
   *  the render is wrapped into a package. `dest` is the absolute install dir
   *  (rpm, e.g. /usr/share/backgrounds/acme) or the home-relative dir (tar.gz);
   *  `innerFormat` is what to render INSIDE the package (svg/png/…). */
  pkg?: { name?: string; version?: string; release?: string; license?: string; summary?: string; dest?: string; innerFormat?: string };
  width?: number | string;
  height?: number | string;
  dpi?: number;
  unit?: string;
  meta?: ExportMeta;
  ingredients?: IngredientCredential[];  // preserved source-asset credentials → C2PA
  c2paInputs?: Record<string, string>;   // scalar-input digest → tools.lolly.export assertion (runtime-supplied)
  c2paCapture?: { camera?: boolean; microphone?: boolean; screen?: boolean }; // sensor/screen origin → created step = digitalCapture/screenCapture (runtime-supplied)
  c2paTextAdded?: { sample?: string };   // text over an opened asset → a c2pa.edited "Added text" step (runtime-supplied)
  c2paAiUpscale?: { model: string; version: string }; // AI-upscaled essence → created = compositeWithTrainedAlgorithmicMedia + a model-naming edit step (runtime-supplied)
  c2paAiIngredients?: Array<{ name: string; kind: 'full' | 'partial' }>; // placed assets the user declared AI-made (runtime-supplied) → composite created step + c2pa.placed + a section 18.28 ai-disclosure
  colorProfile?: string;
  thumbnail?: boolean;
  audio?: ExportAudio;
  /** Normalize the whole exported mix to a target integrated loudness, LKFS
   *  (plans/101 section 2.5: -14 streaming / -16 podcast / -23 broadcast).
   *  Undefined = off, today's levels untouched. Applied as one master gain
   *  BEFORE the always-on true-peak limiter, which then catches any peak the
   *  lift pushes toward the ceiling. */
  normalize?: number;
  c2pa?: boolean;
  c2paDays?: number | string;
  /** Generator-metadata toggle (URL `meta`, default-on). false ⇒ strip the source
   *  attribution field from formats with no C2PA container (EPS/DXF/EMF/EXR/Radiance). */
  metadata?: boolean;
  /** Embed the Lolly pixel watermark into raster exports (png/jpg/webp/avif/tiff).
   *  On by default, like C2PA; explicit opt-out via `imprint=0` in the URL. A
   *  durable, imperceptible mark that survives what strips the C2PA credential - 
   *  see engine/pixel-watermark. */
  imprint?: boolean;
  /** Embed a DURABLE Content Credential - a TrustMark-format neural watermark
   *  carrying Lolly's identifier - into raster exports, so a metadata strip can't
   *  erase the "made with Lolly" link and a TrustMark-aware tool can recover it.
   *  Opt-in (heavy neural encode + a fetched ~tens-of-MB model), unlike the
   *  default-on pure-JS `imprint`. A no-op when the encoder model isn't on-device
   *  (scripts/convert-trustmark-encoder-onnx.py). Raster-only (png/jpg/webp/avif/
   *  tiff) - see lib/trustmark-embed.ts and plans/28-durable-content-credentials.md. */
  durable?: boolean;
  /** Reserved id carried by the durable mark (0 until the CAI id scheme ships). */
  durableId?: number;
  /** OPT-IN HDR raster export (the `hdr` URL param). When set, an HDR-capable
   *  raster (png/jpeg/avif/tiff) is encoded in Rec.2100 PQ with the brand's primary
   *  colours (opts.palette) boosted toward peak luminance - white text and brand
   *  colours glow on HDR displays, darks stay dark. Off by default; SDR otherwise.
   *  See engine/src/hdr.ts + pqBt2020IccProfile. */
  hdr?: boolean;
  /** HDR author dials (from the export-panel sliders / tuned `hdr=` value). All
   *  optional - omitted ⇒ engine defaults. `hdrPeakNits`: white ceiling (nits).
   *  `hdrReach`/`hdrLift`/`hdrRichness`: 0–100 (glow reach / dark lift / colour focus). */
  hdrPeakNits?: number;
  hdrReach?: number;
  hdrLift?: number;
  hdrRichness?: number;
  /** REQUESTED bits per channel for the output (the `depth` URL param): 8, 16,
   *  'float', or 'auto'/absent = "the deepest the provenance chain supports".
   *  A request, NEVER a promise - depth follows provenance, so a consumer emits
   *  deep bits only where the pipeline actually produced them (a 16-bit container
   *  over an 8-bit canvas render is padding). First shipped consumer: the 16-bit
   *  HDR PNG path (export-hdr-png.ts, via deepHdrPng below), which honours a
   *  depth=8 opt-out and earns its bits from the float view transform.
   *  See plans/61-deeprichpixels.md section 10. */
  depth?: 8 | 16 | 'float' | 'auto';
  /** INTERNAL, per-format-render mutable sink (created in renderFormat, never
   *  URL-serialized). Carries the imprint request down to imprintEmbedCanvas and
   *  records whether a container raster was actually marked, so stampC2pa can
   *  claim an imprint truthfully for pdf. See ImprintState. */
  _imprintSink?: ImprintState;
  /** Internal: accumulates ingredients gathered during dispatch - componentOf entries
   *  from bitmaps the SVG/PDF walker inlines (whose canvas re-encode strips their C2PA),
   *  and the sequence render's componentOf clip/bed credentials (sequence-ingredients.ts) -
   *  so an embedded asset's origin still rides the export's manifest. Created only
   *  under c2pa; deduped against opts.ingredients by activeLabel after dispatch. */
  _ingredientSink?: IngredientCredential[];
  palette?: BrandPaletteEntry[];
  bleed?: number | string;
  cropMarks?: boolean;
  registrationMarks?: boolean;
  bleedMarks?: boolean;
  colorBars?: boolean;
  provenance?: boolean;
  /** Colour-bar style: 'rgb-swatches' (brand colours as single RGB cells) for RGB
   *  output - RGB PDF / SVG / EPS; 'cmyk-verify' (the RGB+CMYK press pairs) for the
   *  CMYK formats. Omitted ⇒ the engine default 'cmyk-verify'. */
  barStyle?: 'cmyk-verify' | 'rgb-swatches';
  /** Corner radius (pt) for colour-bar cells, from the brand `--radius`. */
  barRadiusPt?: number;
  dataText?: string;
  dataMime?: string;
  icoSizes?: number[];
  bundleFormats?: string[];
  /** CONTACT SHEET frame count for a STILL export of a timed composition (the
   *  `cuts` URL param; engine url-mode parses and clamps it). 1 or absent - the
   *  overwhelmingly common case - is the frame at the playhead, byte-identical to
   *  no param at all. N > 1 renders N stills at midpoint times across the
   *  sequence: png/jpg/webp/svg come back as one ZIP of `<filename>-01.<ext>`
   *  members, pdf as ONE document of N pages. Ignored by every non-still format
   *  and by any node that is not a [data-sequence] stage. See bridge/
   *  sequence-cuts.ts and plans/51-fable-timeline-editing.md section 4.6. */
  cuts?: number;
  onProgress?: (done: number, total: number) => void;
  /** Cancellation (engine 1.141, ExportOpts.signal). Polled wherever this file
   *  already yields - the frame loops, the CMYK row pass, the SVG/PDF vector walks
   *  and their page boundary, the two real-time compositors' rAF ticks - and the
   *  export then rejects with the signal's AbortError. A format with no yield point
   *  ignores it, so the caller's only guarantee there is that it discards the
   *  result. */
  signal?: AbortSignal;
  fps?: number;
  /** WP-B video quality stop (export card) → a bits-per-pixel target; 'balanced' is
   *  the default and equals the historical rate. Distinct from `quality` (JPEG/WebP). */
  videoQuality?: 'smaller' | 'balanced' | 'best';
  /** WP-B explicit video codec (pro-settings): a WebCodecs codec string, honoured only
   *  where it probes supported in the chosen container; absent ⇒ the auto ladder. */
  videoCodec?: string;
  /** WP-B pro-settings, passed to the VideoEncoder config: CBR vs VBR + the HW hint. */
  bitrateMode?: 'variable' | 'constant';
  hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software';
  repeat?: number;
  dither?: boolean;
  convertPaths?: boolean;
  /** EMF text mode (same name/values as the CLI's --text flag). EMF defaults to
   *  'live' - real GDI font + string records, editable in Office and Google
   *  Drawings, with per-run outline fallback for anything GDI text can't express.
   *  'outline' forces the old always-text-as-paths behaviour (the export panel's
   *  "Outline fonts" chip). Other formats ignore it: SVG has convertPaths, and
   *  WMF/EPS/DXF stay always-outlined. */
  text?: 'outline' | 'live';
  /** Vector export escape-hatch: when a node uses CSS the SVG/PDF walker can't express,
   *  embed it as a raster instead of dropping it. On by default; set false to A/B the
   *  pure-vector output (used by the byte-identical regression test). */
  rasterFallback?: boolean;
  /** Page-snapshot mode for the raster escape hatch. Capture only the
   *  offending element's own paint layer as an <image>, and keep walking its
   *  children as vector, instead of baking the whole subtree into one PNG.
   *
   *  Default (absent/false) is the old subtree behaviour, which every tool
   *  export relies on. See the note at the hatch for why splitting paint from
   *  children is not always safe when the two composite together. Turned on
   *  by main.ts's `__lollyWalkerShot` loopback hook, where the input is a
   *  whole page. There, one unsupported property on a container would
   *  otherwise reduce the entire capture to a screenshot. */
  elementScopedRaster?: boolean;
  /** Reconstruct `backdrop-filter: blur()` by duplicating, clipping, and
   *  blurring the content behind the element, instead of sending it to the
   *  raster hatch (which cannot see a backdrop at all). Snapshot mode only:
   *  it duplicates geometry, so the cost is worth it only when the goal is
   *  fidelity to a live page. */
  backdropBlur?: boolean;
  /** Page snapshots: paint in CSS stacking-context order (CSS 2.1 Appendix E
   *  section E.2) instead of DOM order. Negative-z children paint behind their
   *  parent's in-flow content. Positioned descendants paint above
   *  non-positioned ones. Each layer is z-sorted. Each hoist stops at the
   *  next stacking-context creator (see the table in bridge/stacking-order.ts).
   *
   *  Default (absent/false) is DOM order, the behaviour every tool export has
   *  always had. OFF does not just happen to match the old output: when
   *  `PaintCtx.frame === null`, every deferral branch is unreachable, so each
   *  of the three placement sites reduces to the same
   *  `parentG.appendChild(unit)` call as before, and the emitted bytes cannot
   *  differ. That short-circuit, plus the byte-identity golden test in
   *  export-paint-order.test.ts, is the only thing protecting the shipping
   *  SVG/PDF/EMF/EPS export path for every tool in every profile.
   *
   *  Turned on by main.ts's `__lollyWalkerShot` loopback hook, where the
   *  input is a whole page. On Lolly's own gallery, 99 elements have a
   *  non-auto z-index, 22 of them negative, and DOM order paints them all
   *  wrong. */
  stackingOrder?: boolean;
  /** Stamp `data-box-id` onto the per-element `<g>` in the SVG walker's output,
   *  wherever the walked element already carries one (plans/104 section 7 - the "Lift
   *  layers" identity passthrough). Off by default and byte-identical when off:
   *  the one guarded block at the g-creation site is the whole feature, so a
   *  normal tool export cannot differ. On, a Lolly screenshot lifts along the
   *  boundaries the CANVAS knows about (nav/hero/cards) rather than along
   *  whatever the markup happened to group, because `enumerateSvgLayers` reports
   *  the stamped id back as `layer.boxId`.
   *
   *  IDs only, never names: `data-box-id` is a generated index minted by the
   *  canvas, so this does not undo the ingest-time strip of `data-name` /
   *  `inkscape:label`. See engine/src/svg-layers.ts. */
  layerIds?: boolean;
  noBoxShadow?: boolean;
  /** Resolution ceiling for INLINED raster assets (`<img>` bitmaps), in DPI, decoupled
   *  from `dpi` (which sets the vector/own-paint resolution). Opt-in: when set, an
   *  embedded bitmap is downscaled to its display box at this DPI with a 1x floor - 
   *  so `rasterDpi: 96` embeds each photo at exactly its rendered box, replacing the
   *  full-resolution source. Left unset, embedded rasters keep the dpi-derived >=2x cap.
   *  Lets a walker SVG stay crisp-vector while its heavy continuous-tone assets shrink
   *  to what a reader can actually see (e.g. a Verify shot of a 0.8 MB storm photo). */
  rasterDpi?: number;
  password?: string;
  /** Strong tier: AES-256 (R6) applied as a final encrypt-last pass over the
   *  finished PDF bytes. Composes with PDF/X + CMYK + marks (unlike `password`,
   *  the jsPDF-native 40-bit RC4 lock). Never serialized to a URL. */
  strongPassword?: string;
  fullPage?: boolean;
  wait?: number;
  duration?: number;
  /** True when the user actually EDITED the export bar's duration field for this
   *  export - set by the shell, never inferred. It is what lets a derived length
   *  (a sequence's timeline) stay the default while a direct intervention still
   *  wins: the sequence tool's beforeExport only overwrites `duration` when this is
   *  unset, and the compositor re-lengths the stage when it is (sequence-plan
   *  applyDurationOverride). Popup-local, like wait/duration. */
  durationUserSet?: boolean;
  /** Record the ON-SCREEN preview through a screen share instead of the offline
   *  frame-by-frame render, so frame pacing matches what the user watched. Opt-in
   *  via the export panel's "Record live" toggle; webm/mp4 only. Popup-local like
   *  wait/duration - never serialized into URLs or share links. */
  live?: boolean;
  /** WP-F soft subtitles (plan 153 accessibility, default-on). A WebVTT captions file to
   *  embed as a SOFT, player-toggleable caption track in an mp4/webm export, IN ADDITION
   *  to any burned-in captions. Carried ONLY by the WebCodecs mux path (renderVideo);
   *  the MediaRecorder record/live/top-tail paths and the WebCodecs→MediaRecorder
   *  fallback cannot embed a soft track and drop it with a warning. Absent/empty ⇒ no
   *  subtitle track and the container is byte-for-byte identical to today. */
  subtitlesVtt?: string;
}

export interface ExportDims {
  node: { w: number; h: number };
  w: Dimension;
  h: Dimension;
  dpi: number;
  physical: boolean;
}

export interface DtoRenderOpts {
  width: number;
  height: number;
  style: {
    transform: string;
    transformOrigin: string;
    width: string;
    height: string;
    background?: string;
    // Neutralised when rasterising a positioned child in isolation (renderRecord):
    // an object's own left/top/margin would otherwise offset it out of its bitmap.
    left?: string;
    top?: string;
    margin?: string;
  };
  bgcolor?: string;
}

// dom-to-image-more ships no types. This is the slice of its surface the export path
// uses; typing it catches option-key typos at the inline-literal call sites and locks
// the three method names. toJpeg additionally takes a `quality`.
type DtoOpts = DtoRenderOpts & { quality?: number };
interface DomToImage {
  toPng(node: Node, opts?: DtoOpts): Promise<string>;
  toJpeg(node: Node, opts?: DtoOpts): Promise<string>;
  toCanvas(node: Node, opts?: DtoOpts): Promise<HTMLCanvasElement>;
}

let domToImageMore: DomToImage | null = null;

// The host is captured once at bridge construction so the SVG text vectoriser can
// reach host.text.toPath without threading it through every render function. The
// reference is stable; host.text is attached just after createExportAPI runs (see
// bridge/index.js ordering), so read it lazily at render time, not here.
export let _host: WebHost | null = null;

/**
 * Resolve the requested output size for an export.
 *
 * opts.width / opts.height may be numbers (CSS px) or unit strings ("210mm",
 * "8.5in", "595pt", "800px"); absent falls back to the node's on-screen size.
 * Physical units need a resolution for raster output - opts.dpi wins, else 300
 * (print) when any physical unit is in play, else 96 (CSS). Vector formats
 * (PDF/SVG) ignore the DPI; they convert exactly.
 */
export function exportDims(node: Element, opts: ExportOpts): ExportDims {
  // Background history previews keep the editor zoom in place. Their source
  // box must use layout pixels, or a zoomed-out artboard becomes a cropped tile.
  const r = opts.thumbnail && node instanceof HTMLElement ? { width: node.offsetWidth, height: node.offsetHeight } : node.getBoundingClientRect();
  const node_ = { w: r.width || 1, h: r.height || 1 };
  const w = parseDimension(opts.width) ?? { value: node_.w, unit: 'px' as const };
  const h = parseDimension(opts.height) ?? { value: node_.h, unit: 'px' as const };
  const physical = isPhysical(w) || isPhysical(h);
  const dpi = ((opts.dpi as number) > 0) ? (opts.dpi as number) : (physical ? 300 : CSS_DPI);
  return { node: node_, w, h, dpi, physical };
}

export async function getDomToImage(): Promise<DomToImage> {
  if (!domToImageMore) {
    const mod: any = await import('dom-to-image-more');
    domToImageMore = mod.default ?? mod;
  }
  return domToImageMore!;
}

// Test-only seam: inject a fake dom-to-image-more so a headless test can assert the
// frame source's direct-canvas short-circuit (and its throw fall-through) WITHOUT
// bundling the real library. Mirrors the `HOOK_BUDGET_MS`-style test hooks elsewhere;
// never called by shipping code.
export function __setDomToImageForTest(d: unknown): void { domToImageMore = (d as DomToImage | null) ?? null; }

// Embed the Lolly pixel watermark into a canvas in place (straight sRGB RGBA;
// canvas 2D getImageData is un-premultiplied). No-op contract lives in the
// engine - flat/tiny buffers return unchanged. See engine/src/pixel-watermark.ts.
// `strength` lets a LOSSLESS format (png/tiff) embed the gentler LOSSLESS_STRENGTH
// - it faces no quantization, so a subtler mark still reads back with wide margin;
// lossy formats omit it and keep the JPEG-calibrated DEFAULT_STRENGTH.
export function imprintCanvas(canvas: HTMLCanvasElement, strength?: number): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width < 8 || canvas.height < 8) return;
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const marked = embedWatermark(id.data, { width: canvas.width, height: canvas.height, ...(strength !== undefined ? { strength } : {}) });
  id.data.set(marked);
  ctx.putImageData(id, 0, 0);
}

// Font ascent/descent in px for a computed style, via a reused canvas 2D context.
// fontBoundingBox* are font-level (sample text doesn't matter); the actualBounding
// and ratio fallbacks cover the rare engine without the fontBoundingBox metrics.
let _measureCtx: CanvasRenderingContext2D | null = null;
export function fontMetricsPx(style: CSSStyleDeclaration, fontSizePx: number): { ascent: number; descent: number } {
  if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
  _measureCtx!.font =
    `${style.fontStyle || 'normal'} ${style.fontWeight || 400} ${fontSizePx}px ${style.fontFamily || 'sans-serif'}`;
  const m = _measureCtx!.measureText('Mg');
  const ascent  = m.fontBoundingBoxAscent  ?? m.actualBoundingBoxAscent  ?? fontSizePx * 0.8;
  const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? fontSizePx * 0.2;
  return { ascent, descent };
}

export function makeSvgRect(NS: string, x: number, y: number, w: number, h: number, rx: number, fill: string, ry: number = rx): Element {
  const r = document.createElementNS(NS, 'rect');
  r.setAttribute('x',      String(x));
  r.setAttribute('y',      String(y));
  r.setAttribute('width',  String(w));
  r.setAttribute('height', String(h));
  // rx/ry are already CSS-clamped by resolveRadii/css-box (rx≤w/2, ry≤h/2), so the SVG
  // renderer won't re-clamp them per-axis into an ellipse. Emit both axes.
  if (rx > 0 || ry > 0) { r.setAttribute('rx', String(rx)); r.setAttribute('ry', String(ry)); }
  r.setAttribute('fill', fill);
  return r;
}

export const MAX_RASTER_PX = 2000;




// SVG fill element for a (possibly four-corner) rounded rect: a fast <rect rx ry>
// when corners are uniform, else a <path>. `fillOpacity` < 1 emits fill-opacity
// (which svg-ir flattens over the background for EMF/EPS).
export function makeRoundedFill(NS: string, x: number, y: number, w: number, h: number, radii: CornerRadii, uniform: CornerPair | null, fill: string, fillOpacity = 1): Element {
  let el: Element;
  if (uniform) {
    el = makeSvgRect(NS, x, y, w, h, uniform[0], fill, uniform[1]);
  } else {
    el = document.createElementNS(NS, 'path');
    el.setAttribute('d', roundedRectPath(x, y, w, h, radii));
    el.setAttribute('fill', fill);
  }
  if (fillOpacity < 1) el.setAttribute('fill-opacity', String(fillOpacity));
  return el;
}

// Replaces blob: URLs in-place on the live node and returns a function that
// restores the originals. Used for raster exports so dom-to-image-more receives
// the fully styled live node rather than a detached clone.
export async function swapBlobUrls(node: Element): Promise<() => void> {
  const swaps: { el: Element; attr: string; url: string }[] = [];
  await Promise.all([...node.querySelectorAll('image, img')].map(async el => {
    for (const attr of ['href', 'src']) {
      const url = el.getAttribute(attr);
      if (url?.startsWith('blob:')) {
        try {
          el.setAttribute(attr, await blobToDataUrl(url));
          swaps.push({ el, attr, url });
        } catch { /* leave as-is */ }
      }
    }
  }));
  return () => { for (const { el, attr, url } of swaps) el.setAttribute(attr, url); };
}

export async function blobToDataUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** export.ts hands the host over once, at createExportAPI(); everything else reads `_host`. */
export function setExportHost(host: WebHost): void { _host = host; }
