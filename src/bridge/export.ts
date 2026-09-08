// SPDX-License-Identifier: MPL-2.0
/**
 * ExportAPI - converts a rendered DOM node to a file format.
 *
 * The host owns the renderer choice. Tools call host.export.render(node, fmt)
 * and get back a Blob. This file is where format support is added/swapped - 
 * one place, not 50.
 *
 * Watermarking: applied when the tool is 'experimental' OR opts.watermark is true.
 * A single localised "DRAFT" overlay div is added to the LIVE node before capture, so
 * every format (raster, SVG walker, PDF) sees the identical mark.
 */

import {
  parseDimension, isPhysical, toPixels, toPoints, toCssPx, toCssLength, CSS_DPI,
  iccProfileBytes, rgbToCmyk, cmykCondition, computePrintGeometry, emitEmf, emitWmf, emitEps, emitDxf, packApng, packWebpAnim,
  parseCssLength, cornerRadii, uniformRadius, insetCorners, roundedRectPath, parseBoxShadow, parseTextShadow, gaussianShadowBands, gaussianShadowRings,
  parseCssMatrix, isNonAffineTransform, matAboutPivot, isAxisAlignedMat, matToSvg, type Mat2D,
  parseClipShape, parseRadialGradient, parseConicGradient, parseDropShadowFilter, type ConicGradient,
  splitCssArgs, parseGradientAngle, parseGradientStop, expandGradientStops,
  parseColor, interpolateColor, colorToSrgb8,
  embedC2pa, exportActionSteps, C2PA_FORMATS, CAPTURE_SOURCE_TYPE, SCREEN_SOURCE_TYPE, extractC2paStore, prepareC2paIngredientFromStore, packTiff, encodeBmp, gzip, sfntKind, ENGINE_VERSION,
  buildExportMeta,
  embedWatermark, canCarryWatermark, LOSSLESS_STRENGTH,
  videoProvenanceTags, embedMp4Meta, embedWebmMeta,
  buildEncryptDictValues, encryptObjectBytes, preparePassword,
  buildEncryptedZip, crc32,
  buildPptxParts, EMU_PER_PX,
  writeDocx, writeOdt, embedWavInfo,
  hdrBoostToPQ, pqBt2020IccProfile, HDR_PQ_CICP,
  fromU8Srgb, hdrViewTransform, pqEncodeFrame, pqToI420P10,
} from '@lolly/engine';
import type { HdrBoostOptions } from '@lolly/engine';
import {
  suseFontFile, SUSE_FONT_DIR,
  canVectoriseText, textBaselineY,
  featureSettingsToHb, letterSpacingPx,
  textStrokeAttrs,
} from './text-svg.ts';
import { resolveVectorFont } from './font-registry.ts';
import { namespaceInlinedSvgIds } from './svg-inline-ids.ts';
import { bakeWebKitBoxShadows } from './webkit-shadow-bake.ts';
// The walkers' transform neutralise + re-entry guard (plans/104 section 9 P3.1).
import { neutraliseTransform, newNeutraliseGuard } from './transform-neutralise.ts';
import type { VectorFont } from './font-registry.ts';
import { svgDomToIr, parseTransformList, decomposeAffine } from './svg-ir.ts';
import { placeBackground } from './bg-layout.ts';
import { parseCssFilter, isDropShadowOnly, type FilterPrimitive } from './css-filter.ts';
import { describeControl, controlText, isWidgetControl, rangeFraction, type ControlDesc } from './form-controls.ts';
import { stackingRole, sortUnits, orderModifiedChildren, isFlexOrGridContainer } from './stacking-order.ts';
import type { StackingRole } from './stacking-order.ts';
import { unscopeStyleEls } from '../lib/scope-css.ts';
import { tRaw } from '../i18n.ts';
import { parseSvgRoot, namespaceSvgRefs, type VectorTwinCanvas } from '../lib/vector-paint.ts';
import { assembleAnimatedSvg } from '../lib/svg-anim-core.ts';
import { recTransition } from '../lib/transitions.ts';
import { suspendNodeRasters, drainNodeRasters } from '../lib/clip-thumbs.ts';
import { RASTER_DEFAULT_SCALE } from './export-scale.ts';
import { videoMimeCandidates, videoBitrate, bppForQuality, codecAdjustedBitrate, LIVE_BITS_PER_PIXEL, videoFramePlan, AUDIO_FRAME_HEADROOM } from './video-mime.ts';
import { bedDuckEnvelope, scheduleGainEvents } from './audio-envelope.ts';
import type { ExportAudio, ExportAudioMixIn } from './audio-envelope.ts';
import { encodeMuxWebCodecs, type EncodeAudio, type EncodePick } from './video-encode-core.ts';
import { pickWebCodecsVideo, pickWebCodecsAudio, is10bitHdrCodec, HDR_VF_COLORSPACE, type AudioPick } from './video-shared.ts';
import { supportsWorkerVideoEncode, encodeVideoInWorker } from './video-encode.ts';
// Capability probes live in format-support.ts so the tool view can import them
// without pulling this rasteriser onto the tool-open path. Re-exported here for
// dynamic callers (e.g. bridge/compose.ts does `await import('./export.ts')`).
import { canRecord } from './format-support.ts';
import type { AudioFormat, AudioPcm } from '../lib/audio-encode.ts';
import { buildAudioTags } from '../lib/audio-tags.ts';
import { chromePaintsOverLive, countToolMutations, createStaticChromeGuard, staticChromeFrameAction, staticChromeVerdict, type Box, type ChromeEl } from './frame-static.ts';
import { buildExportPack, renderLinuxPackage } from './export-linux-package.ts';
import { consumeSaveAsNext } from './export-save-picker.ts';
import { packIco } from './ico-pack.ts';
export { videoSupport, cmykTiffSupport, tiffSupport } from './format-support.ts';
import type { ClipShape } from '../../../../engine/src/css-paint.ts';
import type { PptxSlide, PptxShape, PptxFill, PptxMedia } from '../../../../engine/src/pptx.ts';
import type { HostV1, ExportMeta, IngredientCredential, C2paSignOpts } from '@lolly-tools/core/host-v1';
import type { C2paActionInput } from '../../../../engine/src/c2pa.ts';
import type { PrintGeometry, LabelSlot } from '../../../../engine/src/print-marks.ts';
import type { Dimension } from '../../../../engine/src/units.ts';
import type { CornerRadii, CornerPair } from '../../../../engine/src/css-box.ts';
import { n2, parseCssColor, parseCssColorFull, rgbaCss, parseCssLen, resolveRadii, objectPositionFractions } from "./export-css.ts";
import { renderPptx, sourceAuthorOf } from "./export-pptx.ts";
import { domToDocBlocks, domToRichDoc } from "./doc-blocks.ts";
// Stage-1 split: DOM-free byte-stampers and vector-PDF helpers extracted
// verbatim to sibling modules, imported back so no call site changes.
import {
  patchJpegDpi, insertPngPhys, insertPngMeta, insertPngXmp, insertJpegExif, insertJpegXmp,
  insertWebpMeta, insertAvifExif, iccWanted,
  insertPngIcc, insertJpegIcc, insertPngCicp, setAvifCicp, injectSvgMeta, withGifComment,
  inflateBytes, deflateBytes,
} from './export-image-meta.ts';
import {
  pureRotationDeg, sampleGradientMidpoint, brandSwatchPalette, blendSvgWithWhite,
  pdfGradientSpec, fillPdfShading,
  pdfRoundedRect, withPdfAlpha, withPdfClipRect, withPdfRoundedClip, pdfApplyClip,
  withPdfRotation, withPdfMatrix, drawSvgPathToPdf, applyTextTransform, borderDashArray,
  buildCmykPaletteMap, assignSpotResourceNames, cmykKey, paletteHitKey, substitutePdfRgb, OVERPRINT_GS_DEFS,
  svgLen, preserveAspectRatioAlign, parseSvgColor,
} from './export-pdf-vector.ts';
import type { BrandPaletteEntry, PaletteHit } from './export-pdf-vector.ts';
// The PDF/X-4 metadata pass + its claim gate (moved out of this file verbatim).
import { applyPdfX } from './export-pdfx.ts';
// The user's own CMYK profile → the bytes a PDF/X-4 DestOutputProfile embeds.
import { isOwnProfile, resolveEmbeddedProfile } from '../lib/press-profile-embed.ts';
import type { EmbedResolution } from '../lib/press-profile-embed.ts';
// Moved to export-pdf-vector.ts; re-exported because export-pptx.ts imports it from here.
// renderSvg/renderEmf/renderEps/renderDxf: the per-format entry points, exported
// only for the byte-exact golden suite (export-format-golden.test.ts).
export { pureRotationDeg, renderSvg, renderEmf, renderEps, renderDxf };

// ── Local types ─────────────────────────────────────────────────────────────
type Rgb = [number, number, number];
type Rgba = [number, number, number, number];
type LabelsRecord = Partial<Record<LabelSlot, string>>;

// The web shell's host is a superset of the engine's HostV1 - it also carries an
// `identity` bridge (bridge/identity.js) used for Content Credentials signing.
interface WebIdentityAPI { signer(): Promise<unknown>; }
type WebHost = HostV1 & { identity?: WebIdentityAPI };


// The union of options this host's export path understands. A superset of the
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
  /** WP-F soft subtitles (plan 153 accessibility, default-on). A WebVTT transcript to
   *  embed as a SOFT, player-toggleable caption track in an mp4/webm export, IN ADDITION
   *  to any burned-in captions. Carried ONLY by the WebCodecs mux path (renderVideo);
   *  the MediaRecorder record/live/top-tail paths and the WebCodecs→MediaRecorder
   *  fallback cannot embed a soft track and drop it with a warning. Absent/empty ⇒ no
   *  subtitle track and the container is byte-for-byte identical to today. */
  subtitlesVtt?: string;
}

interface ExportDims {
  node: { w: number; h: number };
  w: Dimension;
  h: Dimension;
  dpi: number;
  physical: boolean;
}

interface DtoRenderOpts {
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

// User-visible EXPORT QUALITY notices (not errors): the frame rate was lowered to
// fit the buffer, the clip was truncated, or a sped-up clip's audio was dropped.
// host.log() is console-only, so these degradations were invisible to the person
// exporting - and ClipPlan.truncated's contract explicitly requires surfacing them
// "somewhere a person will see it, not only through host.log". This shell-internal
// sink is the seam: tool-actions registers it around a download and paints each
// message onto the export card (plus an aria-live announce). Module-global like
// `_host` - the download button is disabled for the duration of one export, so a
// single sink is never shared between two concurrent runs. NOT part of HostV1 and
// never serialized; a null sink (nobody listening) simply drops the notice.
export let _exportNoticeSink: ((msg: string) => void) | null = null;
export function _setExportNoticeSink(fn: ((msg: string) => void) | null): void { _exportNoticeSink = fn; }

/**
 * Resolve the requested output size for an export.
 *
 * opts.width / opts.height may be numbers (CSS px) or unit strings ("210mm",
 * "8.5in", "595pt", "800px"); absent falls back to the node's on-screen size.
 * Physical units need a resolution for raster output - opts.dpi wins, else 300
 * (print) when any physical unit is in play, else 96 (CSS). Vector formats
 * (PDF/SVG) ignore the DPI; they convert exactly.
 */
function exportDims(node: Element, opts: ExportOpts): ExportDims {
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

async function getDomToImage(): Promise<DomToImage> {
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

/**
 * The one place a Blob becomes a browser download: a transient object-URL anchor.
 *
 * It lives HERE, in bridge/, on purpose. A raw `<a download>` is dropped outright
 * by a WebView with no download handler (wry cancels it), so on the Tauri shells
 * this whole verb is REPLACED by a native filesystem save (bridge-overrides/
 * export.ts). Any module outside bridge/ that clicks its own anchor bypasses that
 * override and silently no-ops on mobile - the exact defect plan 216 item 1 fixes.
 * So the rule is: nothing outside bridge/ assigns `.download` on a created anchor;
 * it calls host.export.download (overridable) and, only when no host exists yet,
 * this shared fallback. tests/no-raw-anchor-download guard enforces it.
 */
export function anchorSave(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  anchorSaveUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Click a download anchor at an ALREADY-RESOLVED url (a same-origin path or a
 * data: URI the caller owns) - the sibling of anchorSave for callers that hold a
 * url, not a Blob. Same bridge/-only rule: it exists so a fallback that must
 * anchor a raw url doesn't grow a second `<a download>` outside bridge/. Does not
 * revoke `url` - it is not this helper's to own.
 */
export function anchorSaveUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function createExportAPI(host: WebHost) {
  _host = host;
  return {
    async render(node: Element, format: string, opts: ExportOpts = {}): Promise<Blob> {
      // Wait for the brand webfont before ANY format reads the live node's layout.
      // render() rasterises (renderRaster/renderBitmap) or walks (renderSvg/pdf) the
      // LIVE node, so an export fired before the font has loaded would capture the
      // fallback-font reflow: wider metrics, so a heading that fits on the card in the
      // brand face wraps in the export and its second line sits on the subtitle
      // (audiogram, plans/147). This lives in the web shell's shared export entry, not
      // the engine (fonts are a browser API the DOM-free engine cannot see), so EVERY
      // tool and EVERY format inherits it. `document.fonts.ready` is already-resolved
      // (a no-op) once the faces are in, so it costs nothing on the common path.
      try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* no FontFaceSet on this host */ }
      const watermark = Boolean(opts.watermark);

      // Watermark with a live overlay on the original node, not a detached clone.
      // A detached clone loses getComputedStyle context: CSS variables do not
      // resolve, animations do not run, and getBoundingClientRect returns zero.
      const removeWatermark = watermark ? addWatermarkOverlay(node as HTMLElement) : null;
      // Pull any editor-only chrome out of the tree for the duration of the capture.
      const restoreHidden = detachExportHidden(node);
      // The timeline panel photographs its own clip boxes with the same dom-to-image
      // instance. Its options, url cache, and sandbox iframe are module-global and
      // get cleared by whichever call finishes first. detachExportHidden removes the
      // panel from the tree, which stops it from *scheduling* more shots, but a shot
      // already in flight can still corrupt this one, and the panel is not the only
      // thing that rasters.
      // Freeze every <video> to a still of its current frame. The DOM serialiser
      // cannot paint live video, so a video box would otherwise export blank. One
      // swap on the live node here covers every format, including each ZIP
      // sub-format (they re-dispatch the same, already-swapped node).
      //
      // ONE exception: a [data-sequence] stage exported to a MOTION format. There
      // the sequence compositor decodes every clip itself, frame by frame, off the
      // timeline. A frozen still would export a stuck picture instead of moving
      // footage. Stills KEEP the freeze on purpose: a still export of a sequence is
      // the frame at the playhead, with each video exactly where the preview had
      // it (the phase-2 WYSIWYG contract).
      const restoreMotion = (SEQUENCE_MOTION_FORMATS.has(format) && isSequenceStage(node))
        ? (): void => {}
        : snapshotMotion(node);

      // The timeline panel photographs its own clip boxes with the same dom-to-image
      // instance. Its options, url cache, and sandbox iframe are module-global and
      // get cleared by whichever call finishes first. detachExportHidden removes the
      // panel from the tree, which stops it from *scheduling* more shots, but a shot
      // already in flight can still corrupt this one, and the panel is not the only
      // thing that rasters. State that here explicitly instead of relying on that
      // side effect.
      //
      // Acquired HERE, right before the try, not a line earlier. The counter is
      // only decremented by the `finally` below. Anything that throws between the
      // two lines (snapshotMotion walks the tree) would suspend frame thumbnails
      // for the rest of the session, with nothing logged and nothing to reset it.
      const resumeThumbRasters = suspendNodeRasters();
      try {
        // Suspending stops the NEXT shot. It cannot cancel the one already inside
        // the library, which cannot be cancelled. Wait for it, with a bound, or
        // its teardown clears the sandbox iframe and url cache from under THIS render.
        await drainNodeRasters();
        return await renderFormat(node, format, opts);
      } finally {
        restoreMotion();
        resumeThumbRasters();
        restoreHidden();
        removeWatermark?.();
      }
    },

    async download(blob: Blob, filename: string): Promise<void> {
      // Armed by the export panel's Save As button (requestSaveAsNext), and only
      // ever for one delivery. Falls through to the anchor path when the dialog
      // could not open, so a refused picker still saves the file.
      if (await consumeSaveAsNext(blob, filename)) return;
      anchorSave(blob, filename);
    },

    // Transform-path delivery: a blob the tool produced itself (a transformed
    // user file from the exportFile hook). On the web this is just a download - 
    // but it's deliberately a distinct verb from render(): no watermark and no
    // provenance metadata are ever applied, because the bytes are the user's own
    // content. (Tauri/CLI route this to a real save target.)
    async file(blob: Blob, opts: ExportOpts = {}): Promise<void> {
      let out = blob;
      // export.file's one legal container change: fonts. When a transform's bytes are an
      // sfnt/WOFF and the requested name asks for a DIFFERENT font container, convert it
      // (TTF/OTF <-> WOFF, glyph outlines untouched) so the download matches the name - 
      // the font-convert tool's path. Never re-encodes anything else.
      const name = opts.filename || 'file';
      const de = name.match(/\.(ttf|otf|woff)$/i)?.[1]?.toLowerCase();
      if (de) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (sfntKind(bytes)) {
          const { convertFontContainer } = await import('@lolly/engine');
          out = new Blob([convertFontContainer(bytes, de) as BlobPart], { type: `font/${de}` });
        }
      }
      await this.download(out, name);
    },

    // Will Web Share actually accept a file of this type? Chromium enforces a fixed
    // type/extension safelist - a private application/vnd.lolly+zip / .lolly is NOT on
    // it, so this returns false on Chromium (and canShare must be PRESENT, not just
    // navigator.share, or old engines that shipped share() without file support slip
    // through). The "Send to…" button is gated on this so it never claims a share it
    // can't do. Cheap enough to call per render.
    canShare(opts: { mime?: string; filename?: string } = {}): boolean {
      if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
        return false;
      }
      try {
        const probe = new File([new Blob()], opts.filename || 'file', { type: opts.mime || 'application/octet-stream' });
        return navigator.canShare({ files: [probe] });
      } catch { return false; }
    },

    // Hand finished bytes to the OS share sheet (Web Share API). Delegates the capability
    // decision to canShare() above (so a type Web Share won't accept returns false → the
    // caller falls back to download, never a silent no-op). Returns true when the sheet
    // took it - a user-cancel counts, so we don't then ALSO dump a download on them.
    // Never watermarks - a share is a share. Tauri shells override this with native ACTION_SEND.
    async share(blob: Blob, opts: { filename?: string; mime?: string; title?: string } = {}): Promise<boolean> {
      if (!this.canShare({ mime: opts.mime || blob.type, filename: opts.filename })) return false;
      const file = new File([blob], opts.filename || 'file', {
        type: opts.mime || blob.type || 'application/octet-stream',
      });
      try {
        await navigator.share({ files: [file], title: opts.title });
        return true;
      } catch (err) {
        // AbortError = the user opened the sheet and dismissed it - that is "handled",
        // don't fall back to a download. Any other error = the share failed → fall back.
        return (err as Error)?.name === 'AbortError';
      }
    },

    // Apply Lolly's durable RASTER marks to finished image bytes - the transform-
    // path counterpart to render()'s automatic marking, for a tool that stamps an
    // existing file (Embed, Imprint & Track). Embeds the pixel Imprint always, plus
    // the imperceptible neural durable mark when asked, then re-encodes to the same
    // raster format. Non-raster / undecodable / too-small → returned unchanged.
    // Never throws - losing the file to a watermark hiccup is worse than no mark.
    async imprint(bytes: Uint8Array, format: string, opts: { durable?: boolean } = {}): Promise<Uint8Array> {
      return imprintRasterBytes(bytes, format, opts);
    },

    // Seal files a tool holds into a Linux package and RETURN the bytes (.rpm or
    // .tar.gz) - plan 197 M5. The packaging itself lives in export-linux-package.ts,
    // beside the render-then-wrap path the 'rpm'/'tar.gz' export formats take.
    async pack(spec: import('@lolly-tools/core').ExportPackSpec): Promise<Uint8Array> {
      return buildExportPack(spec);
    },
  };
}

// The formats the pixel Imprint / durable mark can ride (canvas-encodable rasters).
const IMPRINTABLE_RASTER = new Set(['png', 'jpg', 'jpeg', 'webp']);

/**
 * Decode raster bytes → canvas, embed the pixel Imprint (+ optional durable neural
 * mark), re-encode to the same format. Raster-only and best-effort: anything the
 * browser can't decode, a non-raster format, or a sub-8px image returns the input
 * bytes unchanged. Backs host.export.imprint.
 */
async function imprintRasterBytes(bytes: Uint8Array, format: string, opts: { durable?: boolean }): Promise<Uint8Array> {
  const f = String(format || '').toLowerCase();
  if (!IMPRINTABLE_RASTER.has(f)) return bytes;
  try {
    const mime = f === 'png' ? 'image/png' : f === 'webp' ? 'image/webp' : 'image/jpeg';
    const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }));
    if (bmp.width < 8 || bmp.height < 8) { bmp.close?.(); return bytes; }
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width; canvas.height = bmp.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) { bmp.close?.(); return bytes; }
    ctx.drawImage(bmp, 0, 0);
    bmp.close?.();
    // Pixel Imprint - lossless-strength for png (no quantization to fight).
    imprintCanvas(canvas, f === 'png' ? LOSSLESS_STRENGTH : undefined);
    // Optional imperceptible neural durable mark (best-effort; never fatal).
    if (opts.durable) {
      try {
        const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { embedLollyDurable } = await import('../lib/trustmark-embed.ts');
        const marked = await embedLollyDurable(id.data, canvas.width, canvas.height, {});
        if (marked) { id.data.set(marked); ctx.putImageData(id, 0, 0); }
      } catch { /* durable pass failed - keep the pixel Imprint */ }
    }
    const outBlob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), mime, f === 'jpeg' || f === 'jpg' ? 0.92 : undefined));
    if (!outBlob) return bytes;
    return new Uint8Array(await outBlob.arrayBuffer());
  } catch { return bytes; }
}

// Dispatch one format → Blob. Split out from the watermark wrapper above so the
// ZIP bundler can reuse it per sub-format without re-applying the overlay (the
// outer render() already watermarked the live node once).
//
// Content Credentials are stamped HERE, after the per-format renderer returns - 
// the last byte operation on every supported container (the credential hashes
// the finished bytes; for video that means after the provenance-tags embed in
// withVideoMeta). Keying on the format STRING (not blob.type) keeps apng
// distinct from png, and running inside renderFormat means zip members get
// stamped individually while the zip container itself never is (not in the
// set). Preview/thumbnail/compose renders never set opts.c2pa, so they skip.
// Video is the one exception to string keying: MediaRecorder may legitimately
// fall back to the other container (a requested mp4 can come out as webm bytes
// on Firefox), so the stamp keys on the container the recorder actually chose.
const C2PA_STAMPABLE = new Set<string>(C2PA_FORMATS);

async function renderFormat(node: Element, format: string, opts: ExportOpts = {}): Promise<Blob> {
  // Fresh imprint sink per format render (so each zip member - which re-enters
  // here - starts with applied=false; a marked earlier member can't make a later
  // pure-vector one over-claim). Created BEFORE dispatch so the container render
  // path can flip `applied`, and read by stampC2pa AFTER. `want` gates whether any
  // Lolly-rendered raster gets marked at all.
  opts._imprintSink = { want: !!opts.imprint, applied: false };
  // Collect componentOf ingredients from walker-inlined bitmaps ONLY when we will
  // stamp - a preview/thumbnail render never pays to decode + C2PA-scan embedded
  // images. Populated by the SVG/PDF walker (before its canvas re-encode), read below.
  if (opts.c2pa) opts._ingredientSink ??= [];
  const blob = await renderFormatDispatch(node, format, opts);
  const key = format === 'webm' || format === 'mp4'
    ? (blob.type.includes('mp4') ? 'mp4' : 'webm')
    : format === 'webp-anim' ? 'webp'          // animated WebP stamps like a still WebP (placeWebp appends a C2PA RIFF chunk)
    : format === 'svg-anim' ? 'svg'            // an animated SVG is a real SVG doc - stamps via the svg placer (<c2pa:manifest> in <metadata>)
    : format === 'opus' ? 'webm'               // Opus ships in a WebM container - stamps via placeWebm's attachment (Lolly's verifier reads it; c2patool can't, same as WebM)
    : format;
  if (opts.c2pa && C2PA_STAMPABLE.has(key)) {
    // The output size is only knowable here (node + opts); pass it to the stamp so
    // the credential can record "where/how big" alongside the input digest.
    let dimensions: string | undefined;
    try { dimensions = describeDimensions(exportDims(node, opts)); } catch { /* size is a nicety */ }
    // Merge walker-collected bitmap ingredients into the stamp, deduped against any the
    // runtime already supplied for declared asset inputs (so a bitmap that WAS a
    // declared asset is not double-listed).
    if (opts._ingredientSink?.length) {
      const have = new Set((opts.ingredients ?? []).map((i) => i.activeLabel));
      opts.ingredients = [...(opts.ingredients ?? []), ...opts._ingredientSink.filter((i) => !have.has(i.activeLabel))];
    }
    return stampC2pa(blob, key, opts, dimensions);
  }
  return blob;
}

// A top-&-tail recorder's render target carries [data-toptail] (on the node or a
// descendant), routing webm/mp4 export through the real-time card+footage compositor.
function isTopTailStage(node: Element): boolean {
  return Boolean((node as HTMLElement).matches?.('[data-toptail]') || node.querySelector?.('[data-toptail]'));
}

// The Record tool's editor strip carries [data-record-stage] (on the node or a
// descendant): an intro card + live-camera clip + outro card, each object animated
// in with its own transition. Routes webm/mp4 through renderRecord.
function isRecordStage(node: Element): boolean {
  return Boolean((node as HTMLElement).matches?.('[data-record-stage]') || node.querySelector?.('[data-record-stage]'));
}

// A timed composition's artboard carries [data-sequence] (on the node or a
// descendant) - the all-or-nothing marker a tool stamps when anything on it has a
// start/duration. Motion export then goes through the deterministic sequence
// compositor (bridge/sequence-render.ts), which reads the timeline off the DOM and
// decodes each clip frame-accurately instead of filming the preview in real time.
function isSequenceStage(node: Element): boolean {
  return Boolean((node as HTMLElement).matches?.('[data-sequence]') || node.querySelector?.('[data-sequence]'));
}

// The formats a sequence stage renders through the compositor. Everything else is
// a STILL: the frame at the playhead, exactly as the preview shows it.
const SEQUENCE_MOTION_FORMATS = new Set(['webm', 'mp4', 'gif', 'apng', 'webp-anim']);

// Lazy so mediabunny + the compositor stay out of the initial bundle (the muxer
// precedent) - they load the first time a timed composition is exported.
async function renderSequenceStage(node: Element, format: 'mp4' | 'webm' | 'gif' | 'apng' | 'webp-anim', opts: ExportOpts): Promise<Blob> {
  const { renderSequence } = await import('./sequence-render.ts');
  // Wrap the host so the compositor's user-visible quality notices (a sped-up
  // clip's audio dropped) reach the SAME export-card sink the WebCodecs video
  // path uses; log + assets pass straight through. The mix is main-thread only,
  // so `notice` fires without a worker hop.
  const h = _host;
  const seqHost = h ? {
    log: (l: string, m: string) => { h.log?.(l as 'debug' | 'info' | 'warn' | 'error', m); },
    notice: (m: string) => { _exportNoticeSink?.(m); },
    assets: h.assets,
  } : null;
  return renderSequence(node, format, opts, seqHost);
}

// ── audio-only export (wav / mp3 / m4a / opus) ───────────────────────────────
// For this path the picture is not the deliverable: the file IS the sound. Where that
// sound comes from is TOOL-SPECIFIC, and this dispatch never guesses. Two ways
// in, checked in this order:
//
//  1. The render target (or a descendant marked [data-audio-source]) exposes
//     `lollyAudioSource()` - a function returning the planar PCM the tool has
//     already mixed, `{ channels: Float32Array[], sampleRate }`. This is the
//     path for a mix no URL can name (Sequence Studio: every clip's own sound
//     plus the bed). A property, not an attribute, because Float32Arrays do not
//     fit in one.
//  2. Otherwise `opts.audio` - the export bar's selection - with `opts.duration`.
//     That pair means THE TRIMMED EXCERPT: [start, start + duration) of the
//     source, the Audiogram's "Start at" plus its clip length, not the whole
//     file.
//
// lib/audio-encode.ts owns the encoders and the pass-through rule (an untrimmed,
// unmixed source already in the requested format comes back as its original
// bytes rather than a lossy re-encode). Lazy so lamejs and the muxers stay out
// of the tool-open path.
interface AudioSourceEl extends Element { lollyAudioSource?: () => AudioPcm | null | Promise<AudioPcm | null> }
function stageAudioSource(node: Element): AudioSourceEl | null {
  const self = node as AudioSourceEl;
  if (typeof self.lollyAudioSource === 'function') return self;
  const el = node.querySelector?.('[data-audio-source]') as AudioSourceEl | null;
  return el && typeof el.lollyAudioSource === 'function' ? el : null;
}

async function renderAudioOnly(node: Element, format: AudioFormat, opts: ExportOpts): Promise<Blob> {
  const { renderAudioExport } = await import('../lib/audio-encode.ts');
  const src = stageAudioSource(node);
  let pcm = src ? await src.lollyAudioSource!() : null;
  // A sequence stage is rebuilt by the tool's hooks on every render, so it cannot
  // carry a `lollyAudioSource` property across renders. Mix it here instead,
  // through the SAME mixer the mp4/webm path uses, so the exported sound is the
  // exported video's sound.
  if (!pcm && isSequenceStage(node)) {
    const { sequenceAudioPcm } = await import('./sequence-render.ts');
    pcm = await sequenceAudioPcm(node, opts, _host ?? null);
  }
  // Container metadata tags for the mediabunny-Output formats (aac/ogg/flac now;
  // m4a/opus pending the shared muxer exposing setMetadataTags). WAV is tagged
  // separately below (embedWavInfo, RIFF INFO), so encodeWav ignores these. Date is
  // deliberately omitted (parity with WAV's fieldset + a deterministic, clock-free
  // tags path); buildAudioTags accepts an injected date for any byte-compared caller.
  const tags = opts.meta ? buildAudioTags(opts.meta) : undefined;
  const blob = await renderAudioExport(format, {
    pcm,
    audio: opts.audio ?? null,
    ...(opts.duration != null ? { duration: opts.duration } : {}),
    ...(tags && Object.keys(tags).length ? { tags } : {}),
    log: (l, m) => { _host?.log?.(l, m); },
  });
  // WAV LIST/INFO parity (plans/144 Wave 2 G4): the same ExportMeta fields the
  // raster stampers embed, in RIFF's native slot. The other audio containers
  // get theirs elsewhere (mp4 udta via withVideoMeta on the video paths).
  if (format === 'wav' && opts.meta) {
    const m = opts.meta;
    const tagged = embedWavInfo(new Uint8Array(await blob.arrayBuffer()), {
      title: m.tool,
      artist: m.author,
      comment: [m.description, m.contact].filter(Boolean).join(' · '),
      copyright: [m.copyright, m.license].filter(Boolean).join(' · '),
      software: m.software,
    });
    return new Blob([tagged as BlobPart], { type: blob.type });
  }
  return blob;
}

// The STILL sibling of the compositor: `cuts=N` (N > 1) on a still format over a
// [data-sequence] stage → N stills at midpoint times, zipped (raster/svg) or paged
// (pdf). Lazy for the same reason as above, and because the overwhelmingly common
// still export never comes near it. Every renderer stays here; sequence-cuts.ts
// owns only the loop, the sampling and the naming.
async function renderSequenceCutSheet(node: Element, format: string, opts: ExportOpts): Promise<Blob> {
  const { renderSequenceCuts } = await import('./sequence-cuts.ts');
  return renderSequenceCuts(node, format, opts, {
    renderStill: (n, f, o) => renderFormat(n, f, o),
    async renderPdfPages(pages, o, prepare) {
      let blob = await renderMultiPagePdf(pages, o, prepare);
      // The tail of renderPdf: the strong tier is an encrypt-last pass over the
      // finished bytes, and a paged contact sheet is finished bytes.
      if (o.strongPassword) blob = await encryptPdfStrong(blob, o.strongPassword);
      return blob;
    },
    packZip: (members, o) => packZip(members, o),
    log: (l, m) => { _host?.log?.(l as 'debug' | 'info' | 'warn' | 'error', m); },
  });
}

async function renderFormatDispatch(node: Element, format: string, opts: ExportOpts = {}): Promise<Blob> {
  // Contact sheet FIRST, ahead of every still renderer: `cuts=N` changes what the
  // output IS (an archive, or a paged document), not how one still is drawn. The
  // guard is exact - N > 1, a still format, a timed stage - so `cuts=1` and every
  // non-sequence export fall straight through to the switch untouched.
  if (opts.cuts != null && opts.cuts !== 1 && isSequenceStage(node)) {
    const { wantsCuts } = await import('./sequence-cuts.ts');
    if (wantsCuts(format, opts.cuts, true)) return await renderSequenceCutSheet(node, format, opts);
  }
  switch (format) {
    case 'png':
      return await renderRaster(node, 'png', opts);
    case 'jpg':
    case 'jpeg':
      return await renderRaster(node, 'jpeg', opts);
    case 'webp': {
      const blob = await renderBitmap(node, 'image/webp', opts);
      // WebP metadata parity (plans/144 Wave 2 G2): the same ExportMeta fields
      // PNG/JPEG carry, as a RIFF EXIF chunk + the VP8X flag. The stamper
      // no-ops when the encoder fell back to PNG (blob type says so).
      if (!opts.meta || !blob.type.includes('webp')) return blob;
      const stamped = insertWebpMeta(new Uint8Array(await blob.arrayBuffer()), opts.meta);
      return new Blob([stamped as BlobPart], { type: blob.type });
    }
    case 'avif': {
      // Same imprint-then-encode path as webp (renderBitmap perturbs the canvas
      // pixels before the browser's AV1 encode). Survival is UNVERIFIED here -
      // the watermark was calibrated against 8×8-block JPEG DCT quantization
      // (see engine/pixel-watermark.ts); AV1's block-transform + loop-filter
      // pipeline is different enough that it needs its own round-trip
      // calibration (like the sharp JPEG suite) before this can be trusted.
      const blob = await renderBitmap(node, 'image/avif', opts);
      // AVIF metadata parity (plans/144, closes the Wave 2 follow-up): the same
      // ExportMeta fields, as a HEIF EXIF item. No-ops on a PNG-fallback blob.
      if (!opts.meta || !blob.type.includes('avif')) return blob;
      const stamped = insertAvifExif(new Uint8Array(await blob.arrayBuffer()), opts.meta);
      return new Blob([stamped as BlobPart], { type: blob.type });
    }
    case 'cmyk-tiff':
      return await renderCmykTiff(node, opts);
    case 'tiff':
      return await renderTiff(node, opts);
    case 'bmp':
      return await renderBmp(node, opts);
    case 'svg':
      return await renderSvg(node, opts);
    case 'svgz':
      return await renderSvgz(node, opts);
    case 'svg-anim':
      return await renderSvgAnim(node, opts);
    case 'emf':
      return await renderEmf(node, opts);
    case 'wmf':
      return await renderWmf(node, opts);
    case 'dxf':
      return await renderDxf(node, opts);
    case 'eps':
      return await renderEps(node, opts, false);
    case 'eps-cmyk':
      return await renderEps(node, opts, true);
    case 'pdf':
      return await renderPdf(node, opts);
    case 'pdf-cmyk':
      return await renderCmykPdf(node, opts);
    case 'html':
      return renderStaticHtml(node, opts);
    case 'md':
      // A tool with a template.md gives model-derived markdown (opts.dataText, set by
      // the engine); otherwise serialise the rendered DOM (renderMarkdown) as before.
      return opts.dataText != null
        ? new Blob([opts.dataText], { type: opts.dataMime ?? 'text/markdown' })
        : renderMarkdown(node);
    case 'txt':
      return renderPlainText(node);
    case 'json':
    case 'csv':
    case 'ics':
    case 'vcf':
    case 'srt':
    case 'vtt':
    case 'css':
    case 'scss':
    case 'gpl':
      // Engine already hydrated the payload (runtime.export → buildDataPayload);
      // the host just wraps it with the right MIME. (`ase` is binary and never
      // reaches here - the tool's exportStill hook returns its bytes upstream in
      // runtime.export, short-circuiting before host.export.render.)
      return new Blob([opts.dataText ?? ''], { type: opts.dataMime ?? 'text/plain' });
    case 'ico':
      return await renderIco(node, opts);
    case 'zip':
      return await renderZip(node, opts);
    case 'pptx':
      return await renderPptx(node, opts);
    // A Penpot design file (plans/178). Dynamically imported, unlike its pptx
    // neighbour: the writer + both producers are only ever reached by a `penpot`
    // export, so they stay off the main export chunk.
    case 'penpot':
      return await (await import('./export-penpot.ts')).renderPenpot(node, opts);
    case 'docx': {
      // Editable Word document - headings, styled runs, links, lists, tables and
      // pictures read off the rendered node, NOT a rasterised page. The office MIME
      // (not application/zip) keeps the .docx extension in extFor. Still lossy vs PDF
      // by design (see doc-blocks.ts for what the model cannot carry).
      const { blocks, title, media } = await domToRichDoc(node);
      // Core props (plans/144 Wave 2 G3): same fields the pptx path passes; the
      // document's own derived title wins over the tool name. An imported
      // source's author (data-source-author on the stage) rides along so the
      // core-props writer can carry both authors when they differ.
      const m = opts.meta;
      const srcAuthor = sourceAuthorOf(node);
      return new Blob([writeDocx({
        title, blocks, media,
        meta: m || srcAuthor
          ? { description: m?.description, source: m?.source, contact: m?.contact, author: m?.author, sourceAuthor: srcAuthor }
          : null,
        now: new Date().toISOString(),
      }) as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    }
    case 'odt': {
      const { blocks, title } = domToDocBlocks(node);
      return new Blob([writeOdt({ title, blocks }) as BlobPart], {
        type: 'application/vnd.oasis.opendocument.text',
      });
    }
    // A [data-sequence] stage is checked FIRST for every motion format - a timed
    // composition is the most specific thing a render target can be. `opts.live`
    // still wins for webm/mp4, exactly as it does over the record/top-tail sniffs:
    // "Record live" means film the screen, not re-render the timeline. The compositor
    // is the better output (deterministic, faster than realtime, full quality) and
    // stays the DEFAULT, but a real-time take is the cheap route on a low-power
    // device, so it remains a deliberate opt-in - and renderLive drives the playhead
    // itself for a sequence stage (see driveSequenceTime there), because nothing
    // else moves it and the take would otherwise be one held frame.
    case 'webm':
      if (!opts.live && isSequenceStage(node)) return await renderSequenceStage(node, 'webm', opts);
      return await (opts.live ? renderLive(node, opts, 'webm')
        : isRecordStage(node) ? renderRecord(node, opts, 'webm')
        : isTopTailStage(node) ? renderTopTail(node, opts, 'webm') : renderVideo(node, opts, 'webm'));
    case 'mp4':
      if (!opts.live && isSequenceStage(node)) return await renderSequenceStage(node, 'mp4', opts);
      return await (opts.live ? renderLive(node, opts, 'mp4')
        : isRecordStage(node) ? renderRecord(node, opts, 'mp4')
        : isTopTailStage(node) ? renderTopTail(node, opts, 'mp4') : renderVideo(node, opts, 'mp4'));
    case 'gif':
      if (isSequenceStage(node)) return await renderSequenceStage(node, 'gif', opts);
      return await renderGif(node, opts);
    case 'apng':
      if (isSequenceStage(node)) return await renderSequenceStage(node, 'apng', opts);
      return await renderApng(node, opts);
    case 'webp-anim':
      if (isSequenceStage(node)) return await renderSequenceStage(node, 'webp-anim', opts);
      return await renderWebpAnim(node, opts);
    // Audio-only: the sound alone, no picture. See renderAudioOnly for where the
    // audio comes from and what each format does to it.
    case 'wav':
    case 'mp3':
    case 'm4a':
    case 'aac':
    case 'opus':
    case 'ogg':
    case 'flac':
      return await renderAudioOnly(node, format, opts);
    // Linux packages (plan 197 M6): render the artefact to an inner format, then
    // seal it into an installable .rpm (or a no-root .tar.gz) at the chosen path.
    case 'rpm':
    case 'tar.gz':
      return await renderLinuxPackage(node, format, opts, (target, inner) => renderFormat(target, inner, opts));
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

// Embed the Lolly pixel watermark into a canvas in place (straight sRGB RGBA;
// canvas 2D getImageData is un-premultiplied). No-op contract lives in the
// engine - flat/tiny buffers return unchanged. See engine/src/pixel-watermark.ts.
// `strength` lets a LOSSLESS format (png/tiff) embed the gentler LOSSLESS_STRENGTH
// - it faces no quantization, so a subtler mark still reads back with wide margin;
// lossy formats omit it and keep the JPEG-calibrated DEFAULT_STRENGTH.
function imprintCanvas(canvas: HTMLCanvasElement, strength?: number): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width < 8 || canvas.height < 8) return;
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const marked = embedWatermark(id.data, { width: canvas.width, height: canvas.height, ...(strength !== undefined ? { strength } : {}) });
  id.data.set(marked);
  ctx.putImageData(id, 0, 0);
}

// Brand primary hexes to boost, pulled from the live palette threaded in opts.
// Engine stays brand-agnostic - it never derives these. (White is added by
// hdrBoostToPQ itself so white text glows even when the palette omits it.)
function hdrTargets(opts: ExportOpts): string[] {
  const out: string[] = [];
  for (const p of (opts.palette ?? []) as Array<{ hex?: string }>) {
    if (p.hex && /^#?[0-9a-fA-F]{3,8}$/.test(p.hex)) out.push(p.hex);
  }
  return out;
}

// HDR-transform a canvas in place: engine hdrBoostToPQ rewrites the pixels to
// Rec.2100-PQ code values, boosting brand-colour matches toward peak luminance.
// Pairs with the pqBt2020IccProfile ICC (jpeg) / cICP chunk (png) stamped after.
function hdrCanvas(canvas: HTMLCanvasElement, opts: ExportOpts): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width < 1 || canvas.height < 1) return;
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  hdrBoostToPQ(id.data, { targets: hdrTargets(opts), ...hdrTune(opts) });
  ctx.putImageData(id, 0, 0);
}

// WP-2 Phase 2 gate. True when this runtime can construct a tight-packed 10-bit
// I420P10 VideoFrame - the deep HDR video source. The probe builds the EXACT layout
// pqToI420P10 emits (Y ++ U ++ V, ⌈w/2⌉×⌈h/2⌉ chroma, one LE Uint16 per sample), so
// a runtime that rejects that packing falls back to the Phase-1 8-bit-sourced RGBA
// path instead of throwing mid-encode. Memoised - the answer is fixed per session.
let _i420p10Support: boolean | undefined;
function supportsI420P10Frame(): boolean {
  if (_i420p10Support !== undefined) return _i420p10Support;
  if (typeof VideoFrame === 'undefined') return (_i420p10Support = false);
  try {
    // 2×2 → Y(4) + U(1) + V(1) = 6 samples.
    const f = new VideoFrame(new Uint16Array(6), {
      format: 'I420P10' as VideoPixelFormat, codedWidth: 2, codedHeight: 2, timestamp: 0,
    });
    f.close();
    return (_i420p10Support = true);
  } catch {
    return (_i420p10Support = false);
  }
}

// Deep (16-bit) HDR PNG: canvas pixels -> engine float view transform -> full-
// precision PQ -> 16-bit IDAT with cICP/pHYs/iTXt/iCCP, all in the engine's own
// writer. Returns the finished file bytes, or null when the deep path can't run
// (no 2D context, an oversized/unencodable buffer) so renderRaster falls back to
// the legacy 8-bit PQ + chunk-splice path rather than failing the export.
// See bridge/export-hdr-png.ts for why this is real precision and not padding.
async function deepHdrPng(canvas: HTMLCanvasElement, opts: ExportOpts, d: { dpi: number }): Promise<Uint8Array | null> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width < 1 || canvas.height < 1) return null;
  try {
    const { encodeHdrPng16 } = await import('./export-hdr-png.ts');
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return await encodeHdrPng16(id.data, {
      width: canvas.width, height: canvas.height,
      hdr: { targets: hdrTargets(opts), ...hdrTune(opts) },
      dpi: d.dpi,
      meta: opts.meta,
      icc: pqBt2020IccProfile(),
      imprint: !!opts.imprint,
      imprintStrength: LOSSLESS_STRENGTH, // PNG is lossless - the gentler mark
      ...(opts.depth !== undefined ? { depth: opts.depth } : {}),
      ...(opts.durable
        ? {
          durable: async (rgba: Uint8ClampedArray, w: number, h: number) => {
            const { embedLollyDurable } = await import('../lib/trustmark-embed.ts');
            return await embedLollyDurable(rgba, w, h, { reservedId: opts.durableId });
          },
        }
        : {}),
      log: (level, msg) => _host?.log?.(level, msg),
    });
  } catch (err) {
    _host?.log?.('warn', `png: 16-bit HDR encode unavailable (${(err as any)?.message || err}) - falling back to the 8-bit PQ path`);
    return null;
  }
}

// HDR JPEG as an ISO 21496-1 / Ultra HDR gain-map file: the canvas stays an
// ordinary SDR image and the HDR rides along as an appended gain-map image plus
// MPF + dual (XMP + ISO) metadata. Replaces the legacy "PQ-encode the pixels and
// tag Rec.2100" JPEG, which produced a file that only looked right in decoders
// that honoured the profile and washed out everywhere else; a gain-map JPEG's
// fallback is the SDR base itself, byte for byte.
//
// Deliberately reads the canvas WITHOUT mutating it (the marks and the map are
// computed on a copy inside the seam), so any failure here falls through to the
// unchanged legacy path below rather than leaving half-transformed pixels.
// See bridge/export-gainmap-jpeg.ts. Returns null on any failure.
async function gainMapJpeg(canvas: HTMLCanvasElement, opts: ExportOpts, d: { dpi: number }): Promise<Uint8Array | null> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width < 1 || canvas.height < 1) return null;
  try {
    const { encodeGainMapJpeg } = await import('./export-gainmap-jpeg.ts');
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const quality = opts.quality ?? JPEG_QUALITY;
    const res = await encodeGainMapJpeg(id.data, {
      width: canvas.width, height: canvas.height,
      hdr: { targets: hdrTargets(opts), ...hdrTune(opts) },
      dpi: d.dpi,
      meta: opts.meta,
      // The base image is a genuine SDR JPEG now, so it carries the render's own
      // profile (sRGB) rather than the Rec.2100-PQ one the legacy path stamped.
      icc: iccWanted(opts) ? iccProfileBytes(opts.colorProfile) : null,
      imprint: !!opts.imprint, // JPEG keeps the quantization-calibrated default strength
      encodeJpeg: async (rgba, w, h, kind) => {
        const scratch = document.createElement('canvas');
        scratch.width = w; scratch.height = h;
        const sx = scratch.getContext('2d');
        if (!sx) throw new Error('no 2D context for the gain-map scratch canvas');
        // Copy into a plainly-owned buffer: ImageData will not take a possibly
        // shared-backed view, and putImageData copies anyway.
        sx.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
        // The map is a data plane, not a picture: encode it at full quality so
        // subsampling/ringing can't smear the boost across edges.
        const blob = await canvasToBlob(scratch, 'image/jpeg', kind === 'map' ? 1 : quality);
        return new Uint8Array(await blob.arrayBuffer());
      },
      ...(opts.depth !== undefined ? { depth: opts.depth } : {}),
      ...(opts.durable
        ? {
          durable: async (rgba: Uint8ClampedArray, w: number, h: number) => {
            const { embedLollyDurable } = await import('../lib/trustmark-embed.ts');
            return await embedLollyDurable(rgba, w, h, { reservedId: opts.durableId });
          },
        }
        : {}),
      log: (level, msg) => _host?.log?.(level, msg),
    });
    return res.bytes;
  } catch (err) {
    _host?.log?.('warn', `jpeg: gain-map HDR encode unavailable (${(err as any)?.message || err}) - falling back to the 8-bit PQ path`);
    return null;
  }
}

// Map the author's 0–100 dials (export-panel sliders / tuned `hdr=` value) onto
// the engine's hdrBoostToPQ knobs. `reach` slides the OKLab-lightness knee (higher
// = the glow reaches further down into mid/dark tones); `lift` is the dark-colour
// boost floor; `richness` is the re-saturation. Any dial left undefined falls
// through to the engine default (so a plain `hdr=1` looks exactly as before).
function hdrTune(opts: ExportOpts): Partial<HdrBoostOptions> {
  const t: Partial<HdrBoostOptions> = {};
  if (opts.hdrPeakNits != null) t.peakNits = opts.hdrPeakNits;
  if (opts.hdrReach != null) {
    const r = Math.min(1, Math.max(0, opts.hdrReach / 100));
    const center = 0.65 - 0.45 * r;               // r=0 → 0.65 (brights only); r=1 → 0.20 (almost all)
    t.kneeLo = Math.max(0, center - 0.12);
    t.kneeHi = Math.min(1, center + 0.12);
  }
  if (opts.hdrLift != null) t.boostFloor = Math.min(1, Math.max(0, opts.hdrLift / 100));
  if (opts.hdrRichness != null) t.richness = Math.min(1, Math.max(0, opts.hdrRichness / 100));
  return t;
}

// Imprint a LOLLY-RENDERED raster that's about to be baked into a container (a
// PDF page, a PPTX slide, an SVG <image>). Two extra gates over the standalone
// raster encoders: (1) `imprint.want` - the caller only threads a want-set sink
// for opts.imprint AND a Lolly-own render, never a passed-through user image
// (those call sites omit the sink → undefined); and (2) canCarryWatermark - an
// embed chokepoint sees many small decorative rasters (gradient chips, icons), so
// anything below the ~240px detection floor is skipped as wasted work. NEVER call
// this on a user's own embedded photo/logo bytes.
//
// SINGLE writer of ImprintState.applied: the flag flips true here, and only here,
// the moment a mark is genuinely embedded - so stampC2pa can never claim an
// imprint a render didn't actually apply (a pure-vector page keeps applied=false).
export function imprintEmbedCanvas(canvas: HTMLCanvasElement, imprint: ImprintState | undefined): void {
  if (imprint?.want && canCarryWatermark(canvas.width, canvas.height)) {
    imprintCanvas(canvas);
    imprint.applied = true;
  }
}

// Neural DURABLE embed for a standalone raster canvas - the async, opt-in
// counterpart to the sync imprintCanvas. Lazy-imports the encoder runner so ORT
// + the ~tens-of-MB model stay out of the boot budget. Best-effort: a no-op
// (pixels untouched) when opts.durable is off, or the encoder model isn't
// installed / the encode faults. Container chokepoints (PDF/PPTX raster) stay
// imprint-only for now - folding an async neural pass into the SYNC
// imprintEmbedCanvas is future work (see plans/28-durable-content-credentials.md).
async function durableEmbedCanvas(canvas: HTMLCanvasElement, opts: ExportOpts): Promise<void> {
  if (!opts.durable) return;
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const { embedLollyDurable } = await import('../lib/trustmark-embed.ts');
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const marked = await embedLollyDurable(id.data, canvas.width, canvas.height, { reservedId: opts.durableId });
    if (marked) { id.data.set(marked); ctx.putImageData(id, 0, 0); }
  } catch { /* best-effort; never break an export over the durable pass */ }
}

// Default JPEG encode quality. The browser default (0.92) leaves visible ringing
// around text and hard edges; 0.97 clears it for a modest size increase.
const JPEG_QUALITY = 0.97;

async function renderRaster(node: Element, format: string, opts: ExportOpts): Promise<Blob> {
  const lib = await getDomToImage();
  const d = exportDims(node, opts);
  const dtoOpts = rasterStyle(d, opts);
  // Mutate blob: URLs to data URLs on the live node so dom-to-image-more can
  // serialise them inside the SVG foreignObject. Restore immediately after so
  // the canvas stays clean. The live node MUST be passed (not a clone) so that
  // dom-to-image reads computed styles from elements that are in the document.
  const restore = await swapBlobUrls(node);
  // WebKit's dom-to-image capture paints an offset box-shadow as a CENTRED halo
  // (measured IoU 0.715), untransformed elements included - so Safari raster
  // exports of offset shadows were simply wrong. drop-shadow() captures
  // correctly there, so the offsets are baked into filters for the capture's
  // duration, on WebKit only, and restored with everything else below.
  const restoreShadows = bakeWebKitBoxShadows(node);
  // Deterministic base frame (t=0) for a frame-clock tool, so a still of an
  // animating canvas captures the configured pose, not a random rAF moment.
  const fc = beginFrameClock(node); renderFrameAt(fc, 0);
  try {
    // HDR (opt-in, ?hdr=): PQ-encode the pixels + tag the container Rec.2100-PQ.
    // Needs canvas pixels, so it forces the canvas path (like imprint/durable).
    const hdrOn = !!opts.hdr && (format === 'png' || format === 'jpeg');
    let blob: Blob;
    if (opts.imprint || opts.durable || hdrOn) {
      // Pixel-watermark path: rasterise to a canvas so we can perturb the pixels
      // before encoding, then encode with the same quality the dataURL path uses.
      // Also the durable-embed path, which likewise needs canvas pixels.
      const raw = await lib.toCanvas(node, dtoOpts);
      const canvas = normalizeCanvas(raw, dtoOpts.width, dtoOpts.height);
      // HDR PNG goes DEEP: the same `hdr=` request routes through the engine's
      // float view transform and its own 16-bit PNG writer instead of the 8-bit
      // canvas transform + chunk splice (plans/61-deeprichpixels.md section 10 item 2 - 
      // 8-bit PQ is the banding defect). Metadata, pixel marks and C2PA
      // compatibility all carry over; see bridge/export-hdr-png.ts. Returns null
      // if anything goes wrong, and the legacy 8-bit path below still runs.
      if (hdrOn && format === 'png') {
        const deep = await deepHdrPng(canvas, opts, d);
        if (deep) return new Blob([deep as BlobPart], { type: 'image/png' });
      }
      // HDR JPEG goes GAIN MAP: the same `hdr=` request now writes an ISO
      // 21496-1 / Ultra HDR gain-map JPEG - a real SDR base image with the HDR
      // appended as a gain map (plans/61-deeprichpixels.md section 4.2, section 6 B2). That is the
      // only HDR still output that renders as HDR in Chromium/Safari/Android and
      // degrades to a perfect ordinary JPEG everywhere else, which is what the
      // legacy PQ-tagged JPEG below never did. `depth=8` opts out to that legacy
      // path (unlike HDR PNG, an 8-bit answer here is coherent). Marks, DPI,
      // EXIF and the sRGB profile are applied inside the seam; the canvas is left
      // untouched, so any failure falls through with nothing lost.
      if (hdrOn && format === 'jpeg' && opts.depth !== 8) {
        const gm = await gainMapJpeg(canvas, opts, d);
        if (gm) return new Blob([gm as BlobPart], { type: 'image/jpeg' });
      }
      // HDR first: the PQ transform is the base encoding, so any provenance mark
      // below arrives in the final (PQ) pixel space and embed/detect stay consistent.
      if (hdrOn) hdrCanvas(canvas, opts);
      // png is lossless → the gentler LOSSLESS_STRENGTH; jpeg keeps the
      // quantization-calibrated DEFAULT_STRENGTH (undefined ⇒ engine default).
      if (opts.imprint) imprintCanvas(canvas, format === 'png' ? LOSSLESS_STRENGTH : undefined);
      await durableEmbedCanvas(canvas, opts);
      blob = await canvasToBlob(canvas, format === 'jpeg' ? 'image/jpeg' : 'image/png', format === 'jpeg' ? (opts.quality ?? JPEG_QUALITY) : undefined);
    } else {
      const dataUrl = await (format === 'jpeg'
        ? lib.toJpeg(node, { quality: opts.quality ?? JPEG_QUALITY, ...dtoOpts })
        : lib.toPng(node, dtoOpts));
      const res = await fetch(dataUrl);
      blob = await res.blob();
    }
    // Stamp the DPI (physical size) + provenance metadata + colour profile in a
    // SINGLE parse/serialise cycle: read the encoded bytes once, splice every
    // chunk/segment in order, rebuild the Blob once. (Each stamp was previously
    // its own arrayBuffer()→Blob round-trip - three full multi-MB copies for a
    // high-DPI PNG.) Insertion order is preserved, so the output is byte-identical.
    // HDR overrides the colour profile with Rec.2100 PQ (its cicp tag is the HDR
    // signal); PNG also gets a cICP chunk.
    const icc = hdrOn ? pqBt2020IccProfile() : (iccWanted(opts) ? iccProfileBytes(opts.colorProfile) : null);
    if (format === 'png' && (d.dpi > 0 || opts.meta || icc || hdrOn)) {
      let bytes = new Uint8Array(await blob.arrayBuffer());
      if (d.dpi > 0) bytes = (insertPngPhys(bytes, d.dpi) || bytes) as Uint8Array<ArrayBuffer>;
      bytes = insertPngMeta(bytes, opts.meta) as Uint8Array<ArrayBuffer>;
      bytes = insertPngXmp(bytes, opts.meta) as Uint8Array<ArrayBuffer>;
      if (hdrOn) bytes = insertPngCicp(bytes, HDR_PQ_CICP) as Uint8Array<ArrayBuffer>;
      if (icc) bytes = await insertPngIcc(bytes, icc, hdrOn ? 'Rec2100 PQ' : 'sRGB') as Uint8Array<ArrayBuffer>;
      blob = new Blob([bytes], { type: 'image/png' });
    } else if (format === 'jpeg' && (d.dpi > 0 || opts.meta || icc)) {
      let bytes = new Uint8Array(await blob.arrayBuffer());
      bytes = patchJpegDpi(bytes, d.dpi) as Uint8Array<ArrayBuffer>;
      bytes = insertJpegExif(bytes, opts.meta) as Uint8Array<ArrayBuffer>;
      bytes = insertJpegXmp(bytes, opts.meta) as Uint8Array<ArrayBuffer>;
      if (icc) bytes = insertJpegIcc(bytes, icc) as Uint8Array<ArrayBuffer>;
      blob = new Blob([bytes], { type: 'image/jpeg' });
    }
    return blob;
  } finally {
    restoreShadows();
    restore();
    endFrameClock(fc);
  }
}

// Promisified canvas.toBlob - quality is passed through only for lossy encoders.
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error(`Encoding failed for ${mimeType}`)),
      mimeType,
      quality,
    );
  });
}

async function renderBitmap(node: Element, mimeType: string, opts: ExportOpts): Promise<Blob> {
  const lib = await getDomToImage();
  const d = exportDims(node, opts);
  const dtoOpts = rasterStyle(d, opts);
  const restore = await swapBlobUrls(node);
  const fc = beginFrameClock(node); renderFrameAt(fc, 0);
  let raw: HTMLCanvasElement;
  try {
    raw = await lib.toCanvas(node, dtoOpts);
  } finally {
    restore();
    endFrameClock(fc);
  }
  const canvas = normalizeCanvas(raw, dtoOpts.width, dtoOpts.height);
  // HDR (AVIF only here - AVIF signals HDR natively via its nclx colr box; WebP
  // has no working HDR decode path, so it's not offered). PQ-transform first, then
  // rewrite the encoded AVIF's colr box to Rec.2100 PQ.
  const hdrOn = !!opts.hdr && mimeType === 'image/avif';
  if (hdrOn) hdrCanvas(canvas, opts);
  if (opts.imprint) imprintCanvas(canvas);
  await durableEmbedCanvas(canvas, opts);
  const blob = await canvasToBlob(canvas, mimeType, opts.quality ?? 0.9);
  if (hdrOn) {
    // canvasToBlob may fall back to PNG where the browser can't encode AVIF;
    // setAvifCicp no-ops on non-AVIF bytes, so this is safe either way.
    const bytes = setAvifCicp(new Uint8Array(await blob.arrayBuffer()), HDR_PQ_CICP);
    return new Blob([bytes as BlobPart], { type: blob.type || mimeType });
  }
  return blob;
}

// ── RGB TIFF export (archival / lossless raster) ────────────────────────────
//
// A plain, uncompressed RGB TIFF at the requested DPI - the RGB sibling of the
// print DeviceCMYK TIFF, for archival and editor round-trips where a lossless,
// broadly-readable raster is wanted (browsers can't encode TIFF, so like the CMYK
// path the bytes are assembled by hand - here via the engine's packTiff). No print
// geometry / marks: this is a straight raster, not a press-ready separation. Any
// transparency is flattened onto white, since baseline TIFF carries no alpha here.
async function renderTiff(node: Element, opts: ExportOpts): Promise<Blob> {
  const lib = await getDomToImage();
  const d = exportDims(node, opts);
  const dtoOpts = rasterStyle(d, opts);
  const restore = await swapBlobUrls(node);
  let canvas: HTMLCanvasElement;
  try {
    const raw = await lib.toCanvas(node, dtoOpts);
    canvas = normalizeCanvas(raw, dtoOpts.width, dtoOpts.height);
  } finally {
    restore();
  }
  // Imprint before reading pixels back out, so the mark is in the bytes packTiff
  // serialises. Uncompressed TIFF is lossless - unlike JPEG/AVIF this is a
  // straight round-trip of exactly what embedWatermark wrote, no re-encode to
  // survive.
  const hdrOn = !!opts.hdr;
  // HDR first (like renderRaster) so any mark lands in the final PQ pixel space.
  if (hdrOn) hdrCanvas(canvas, opts);
  if (opts.imprint) imprintCanvas(canvas, LOSSLESS_STRENGTH); // uncompressed TIFF is lossless
  await durableEmbedCanvas(canvas, opts);
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const rgba = ctx.getImageData(0, 0, W, H).data;       // sRGB, straight (un-premultiplied)
  // Flatten transparency onto white normally; onto BLACK for HDR - in PQ, white is
  // 10 000 nits, so a transparent edge flattened to white would blaze; black is 0 nits.
  const rgb = flattenRgb(rgba, hdrOn ? 0 : 255);
  const tiff = packTiff(rgb, {
    width: W, height: H, samplesPerPixel: 3, photometric: 2,
    dpi: d.dpi || CSS_DPI, meta: opts.meta, description: opts.meta?.description,
    // Rec.2100-PQ profile → HDR TIFF (its cicp tag signals the encoding).
    ...(hdrOn ? { icc: pqBt2020IccProfile() } : {}),
  });
  return new Blob([tiff as BlobPart], { type: 'image/tiff' });
}

// BMP is the raster escape hatch - the uncompressed Windows Bitmap a legacy
// Windows / embedded / clipboard consumer accepts when it can't read a PNG. Same
// dom-to-image → imprint → getImageData path as renderTiff, but encodeBmp takes the
// straight RGBA directly and auto-picks 24-bit BGR (opaque) or 32-bit BGRA (any
// translucency), so alpha is preserved rather than flattened. Uncompressed BI_RGB is
// lossless, so the Imprint is a straight round-trip of what embedWatermark wrote (the
// gentle LOSSLESS_STRENGTH, as with TIFF). BMP has no wide-gamut profile and no
// metadata box, so HDR is not offered and C2PA cannot ride it - the in-pixel Imprint
// is the only provenance the format holds.
async function renderBmp(node: Element, opts: ExportOpts): Promise<Blob> {
  const lib = await getDomToImage();
  const d = exportDims(node, opts);
  const dtoOpts = rasterStyle(d, opts);
  const restore = await swapBlobUrls(node);
  let canvas: HTMLCanvasElement;
  try {
    const raw = await lib.toCanvas(node, dtoOpts);
    canvas = normalizeCanvas(raw, dtoOpts.width, dtoOpts.height);
  } finally {
    restore();
  }
  if (opts.imprint) imprintCanvas(canvas, LOSSLESS_STRENGTH);
  await durableEmbedCanvas(canvas, opts);
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const rgba = ctx.getImageData(0, 0, W, H).data;       // sRGB, straight (un-premultiplied)
  const bmp = encodeBmp(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), W, H);
  return new Blob([bmp as BlobPart], { type: 'image/bmp' });
}

// Straight (un-premultiplied) RGBA → packed RGB, compositing any transparency onto
// a solid sheet of `bg` (baseline TIFF has no alpha channel in this profile).
function flattenRgb(rgba: Uint8ClampedArray, bg = 255): Uint8Array {
  const px = rgba.length / 4;
  const out = new Uint8Array(px * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    const a = rgba[i + 3]!;
    if (a === 255) {
      out[j] = rgba[i]!; out[j + 1] = rgba[i + 1]!; out[j + 2] = rgba[i + 2]!;
    } else {
      const t = a / 255, u = bg * (1 - t);
      out[j]     = (rgba[i]!     * t + u + 0.5) | 0;
      out[j + 1] = (rgba[i + 1]! * t + u + 0.5) | 0;
      out[j + 2] = (rgba[i + 2]! * t + u + 0.5) | 0;
    }
  }
  return out;
}

// ── DeviceCMYK TIFF export (print-ready) ────────────────────────────────────
//
// A print-grade CMYK TIFF, written by hand (no browser TIFF encoder exists; this
// is the same hand-rolled-binary approach used for PNG chunks / EXIF / ICC). The
// canvas is rasterised like the other raster formats, its sRGB pixels converted
// per-pixel to *device* CMYK via the engine's rgbToCmyk, except where a pixel's
// exact colour matches a brand-palette entry (buildCmykPaletteMap, shared with the
// CMYK PDF path) - then the swatch's locked CMYK (or, for a spot-locked swatch,
// its CMYK equivalent) is used instead of the naive conversion. A single flat
// raster has no per-plate channel for a named ink, so a spot lock only ever
// contributes its CMYK equivalent here - true Separation output is a PDF-only
// capability (see renderCmykPdf); this is a deliberate scope limit, not a bug.
// That reasoning holds for a Pantone and is WRONG for a declared FINISH (a foil,
// a spot varnish, a die): there is no CMYK equivalent of a varnish, so an
// "equivalent" here would be a fabricated colour. buildCmykPaletteMap therefore
// hands this path FINISH_MASK_CMYK (100% K) for any finish swatch, and this
// format cannot carry a finish at all - the region is written as a black mask,
// not as a printable finish.
// Stored uncompressed in a single strip.
//
// Print finishing mirrors the Print PDF, on the same engine geometry
// (computePrintGeometry): when bleed/marks are requested the design is stretched to
// COVER the bleed box on an enlarged white sheet, and the crop / bleed / registration
// marks + colour bar are rasterised straight into the CMYK buffer AFTER the
// conversion - so the line marks land on every plate (C=M=Y=K=255, the raster
// analogue of the PDF's 1 1 1 1 registration ink) instead of being remapped by the
// naive per-pixel pass. The bar itself stays the generic process/overprint/tint
// control strip (unlike the PDF path, the verification pairing isn't rebuilt here).
//
// Deliberately untagged DeviceCMYK: there is NO embedded output profile (a real
// profile over the naive conversion would mislabel the file). The chosen press
// condition is recorded only as provenance in ImageDescription - naming the intended
// viewing condition without claiming colour management. A colour-managed variant
// (real ICC separation + embedded press profile) is a separate, heavier project - 
// see cmykTiffSupport, which keeps the format off environments where it can't be
// produced or delivered.
async function renderCmykTiff(node: Element, opts: ExportOpts): Promise<Blob> {
  const lib = await getDomToImage();
  const d = exportDims(node, opts);
  const paletteMap = buildCmykPaletteMap(opts.palette ?? []);
  // Print finishing geometry - same engine source of truth as the PDF path. Still
  // pass no palette here: the verification bar's brand pairing is rebuilt from the
  // PDF path's `usedKeys` (an exact-substitution audit trail this per-pixel pass
  // doesn't produce), so it stays the generic process/overprint/tint control strip.
  const geo = printGeometry(node, opts, []);
  const ptPx  = (v: number) => Math.round(v * d.dpi / 72);        // points → device px (offset)
  const ptDim = (v: number) => Math.max(1, ptPx(v));              // points → device px (size)

  const restore = await swapBlobUrls(node);
  let artCanvas: HTMLCanvasElement;
  try {
    // With geometry the design is stretched to COVER the bleed box (mirrors the
    // PDF's scale-to-bleed); without it, the plain trim-size raster as before.
    const dtoOpts = geo
      ? coverRasterStyle(d, opts, ptDim(geo.artwork.w), ptDim(geo.artwork.h))
      : rasterStyle(d, opts);
    const raw = await lib.toCanvas(node, dtoOpts);
    artCanvas = normalizeCanvas(raw, dtoOpts.width, dtoOpts.height);
  } finally {
    restore();
  }

  // Compose the artwork onto the full white sheet (print stock) when there's a margin.
  let canvas = artCanvas;
  if (geo) {
    const sheet = document.createElement('canvas');
    sheet.width  = ptDim(geo.page.w);
    sheet.height = ptDim(geo.page.h);
    const sctx = sheet.getContext('2d', { willReadFrequently: true })!;
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(0, 0, sheet.width, sheet.height);
    sctx.drawImage(artCanvas, ptPx(geo.artwork.x), ptPx(geo.artwork.y), ptDim(geo.artwork.w), ptDim(geo.artwork.h));
    canvas = sheet;
  }

  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const rgba = ctx.getImageData(0, 0, W, H).data;   // sRGB, straight (un-premultiplied)
  const cmyk = await rgbaToDeviceCmyk(rgba, W, H, paletteMap, opts.onProgress, opts.signal);

  // Marks drawn AFTER conversion → registration/crop/bleed land on every plate;
  // provenance credit text is composited as K-only ink (see drawPrintMarksCmyk).
  if (geo) drawPrintMarksCmyk(cmyk, W, H, geo, d.dpi, provenanceLabels(opts.meta));

  const tiff = encodeCmykTiff(cmyk, W, H, d.dpi, opts.meta, await pressConditionLabel(opts.colorProfile));
  return new Blob([tiff as BlobPart], { type: 'image/tiff' });
}

// RGBA (0–255, sRGB) → packed CMYK bytes (0=no ink … 255=full ink), one tight
// numeric pass over the typed array. Transparency is flattened onto white (CMYK
// has no alpha channel and print stock is white). ~tens of ms for 1080², but a
// large print-DPI sheet runs long on the main thread, so the pass yields to the
// event loop every YIELD_ROWS scanlines (keeping the tab responsive) and reports
// row progress through opts.onProgress. paletteMap (built once by the caller from
// opts.palette, same as the CMYK PDF path) is consulted per pixel for an exact
// brand-swatch match before falling back to the naive conversion - an empty map
// (the common case, no locks configured) skips the lookup entirely so the hot
// loop's arithmetic is otherwise unchanged.
const YIELD_ROWS = 256;
async function rgbaToDeviceCmyk(
  rgba: Uint8ClampedArray, W: number, H: number,
  paletteMap: Map<string, PaletteHit>,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const out = new Uint8Array(W * H * 4);
  const hasPalette = paletteMap.size > 0;
  for (let row = 0; row < H; row++) {
    const base = row * W * 4;
    for (let i = base, end = base + W * 4; i < end; i += 4) {
      const a = rgba[i + 3]!;
      let r = rgba[i]!, g = rgba[i + 1]!, b = rgba[i + 2]!;
      if (a < 255) {                                 // composite over white
        const t = a / 255, u = 255 * (1 - t);
        r = r * t + u; g = g * t + u; b = b * t + u;
      }
      const rf = r / 255, gf = g / 255, bf = b / 255;
      const hit = hasPalette ? paletteMap.get(cmykKey(rf, gf, bf)) : undefined;
      const [c, m, y, k] = hit ? hit.cmyk : rgbToCmyk(rf, gf, bf);
      out[i]     = (c * 255 + 0.5) | 0;
      out[i + 1] = (m * 255 + 0.5) | 0;
      out[i + 2] = (y * 255 + 0.5) | 0;
      out[i + 3] = (k * 255 + 0.5) | 0;
    }
    if ((row + 1) % YIELD_ROWS === 0 && row + 1 < H) {
      onProgress?.(row + 1, H);
      signal?.throwIfAborted();      // the yield point is also the cancel point
      await new Promise<void>((r) => setTimeout(r));         // unblock the UI thread
    }
  }
  onProgress?.(H, H);
  return out;
}

interface TiffEntry { tag: number; type: number; count: number; n?: number; data?: Uint8Array; offset?: number; }

// Assemble a baseline little-endian CMYK TIFF: 8-byte header → IFD → out-of-line
// values → one uncompressed strip. Entries are gathered, then sorted by tag (a
// TIFF requirement) with ≤4-byte values inlined and larger ones placed after the
// IFD. Mirrors buildExifTiff, scaled up to a full image + provenance + DPI.
function encodeCmykTiff(
  cmyk: Uint8Array, W: number, H: number, dpi: number,
  meta: ExportMeta | null | undefined, condition: string | null,
): Uint8Array {
  const enc = new TextEncoder();
  const SHORT = 3, LONG = 4, RATIONAL = 5, ASCII = 2;
  const TYPE_SIZE: Record<number, number> = { 2: 1, 3: 2, 4: 4, 5: 8 };
  const entries: TiffEntry[] = [];
  const num   = (tag: number, type: number, n: number) => entries.push({ tag, type, count: 1, n });
  const asciiTag = (tag: number, s: unknown) => { if (s) { const a = enc.encode(String(s)); const d = new Uint8Array(a.length + 1); d.set(a, 0); entries.push({ tag, type: ASCII, count: d.length, data: d }); } };

  const bps = new Uint8Array(8); { const dv = new DataView(bps.buffer); for (let i = 0; i < 4; i++) dv.setUint16(i * 2, 8, true); }
  const rational = (n2: number, den: number) => { const d = new Uint8Array(8); const dv = new DataView(d.buffer); dv.setUint32(0, n2, true); dv.setUint32(4, den, true); return d; };
  const res = Math.max(1, Math.round(dpi || 72));

  num(256, LONG, W);                                  // ImageWidth
  num(257, LONG, H);                                  // ImageLength
  entries.push({ tag: 258, type: SHORT, count: 4, data: bps }); // BitsPerSample [8,8,8,8]
  num(259, SHORT, 1);                                 // Compression: none
  num(262, SHORT, 5);                                 // PhotometricInterpretation: Separated (CMYK)
  asciiTag(270, [meta?.description, condition].filter(Boolean).join(' · ')); // ImageDescription (+ press condition)
  num(273, LONG, 0);                                  // StripOffsets - patched after layout
  num(277, SHORT, 4);                                 // SamplesPerPixel
  num(278, LONG, H);                                  // RowsPerStrip (single strip)
  num(279, LONG, W * H * 4);                          // StripByteCounts
  entries.push({ tag: 282, type: RATIONAL, count: 1, data: rational(res, 1) }); // XResolution
  entries.push({ tag: 283, type: RATIONAL, count: 1, data: rational(res, 1) }); // YResolution
  num(296, SHORT, 2);                                 // ResolutionUnit: inch
  asciiTag(305, meta?.software);                      // Software
  asciiTag(315, meta?.author);                        // Artist
  num(332, SHORT, 1);                                 // InkSet: CMYK

  entries.sort((a, b) => a.tag - b.tag);

  const N = entries.length;
  const ifdStart = 8;
  let ext = ifdStart + 2 + N * 12 + 4;                // out-of-line region start
  for (const e of entries) {
    const bytes = e.data ? e.data.length : e.count * TYPE_SIZE[e.type]!;
    if (bytes > 4) { e.offset = ext; ext += bytes + (bytes & 1); } // keep word alignment
  }
  const stripOffset = ext + (ext & 1);
  entries.find(e => e.tag === 273)!.n = stripOffset;   // patch StripOffsets

  const out = new Uint8Array(stripOffset + W * H * 4);
  const dv = new DataView(out.buffer);
  out[0] = 0x49; out[1] = 0x49;                       // "II" little-endian
  dv.setUint16(2, 42, true);
  dv.setUint32(4, ifdStart, true);
  dv.setUint16(ifdStart, N, true);
  let o = ifdStart + 2;
  for (const e of entries) {
    dv.setUint16(o, e.tag, true);
    dv.setUint16(o + 2, e.type, true);
    dv.setUint32(o + 4, e.count, true);
    const bytes = e.data ? e.data.length : e.count * TYPE_SIZE[e.type]!;
    if (bytes > 4) { dv.setUint32(o + 8, e.offset!, true); out.set(e.data!, e.offset!); }
    else if (e.data) out.set(e.data, o + 8);          // small inline value (e.g. short ASCII)
    else if (e.type === SHORT) dv.setUint16(o + 8, e.n!, true);
    else dv.setUint32(o + 8, e.n!, true);
    o += 12;
  }
  dv.setUint32(o, 0, true);                           // next IFD: none
  out.set(cmyk, stripOffset);
  return out;
}

// Rasterise the print marks (crop / bleed / registration / colour bar) straight
// into the DeviceCMYK byte buffer, AFTER the RGB→CMYK conversion - so the line
// marks land on all four plates (C=M=Y=K=255, the raster analogue of the PDF's
// 1 1 1 1 registration ink) instead of being remapped by the naive per-pixel pass.
// Engine geometry is points, top-left origin; convert to device pixels at dpi. All
// crop/bleed/registration lines are axis-aligned (each a filled hairline bar); the
// registration target is a stroked ring; colour-bar cells are filled rectangles in
// their own DeviceCMYK value. `labels` (optional) maps each engine label slot → its
// provenance string; those are shaped by the browser and composited as K-only ink.
function drawPrintMarksCmyk(
  cmyk: Uint8Array, W: number, H: number, geo: PrintGeometry, dpi: number,
  labels: LabelsRecord | null,
): void {
  const pt = (v: number) => v * dpi / 72;
  const REG: [number, number, number, number] = [255, 255, 255, 255]; // all plates (registration black)
  const stroke = Math.max(1, Math.round(pt(geo.strokeWeight)));

  const put = (x: number, y: number, ink: number[]) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    cmyk[o] = ink[0]!; cmyk[o + 1] = ink[1]!; cmyk[o + 2] = ink[2]!; cmyk[o + 3] = ink[3]!;
  };
  const fill = (x0: number, y0: number, w: number, h: number, ink: number[]) => {
    const xs = Math.round(x0), ys = Math.round(y0);
    const xe = Math.round(x0 + w), ye = Math.round(y0 + h);
    for (let y = ys; y < ye; y++) for (let x = xs; x < xe; x++) put(x, y, ink);
  };

  for (const ln of geo.primitives.lines) {
    const x1 = pt(ln.x1), y1 = pt(ln.y1), x2 = pt(ln.x2), y2 = pt(ln.y2);
    if (Math.abs(x1 - x2) < 0.5) fill(x1 - stroke / 2, Math.min(y1, y2), stroke, Math.abs(y2 - y1), REG); // vertical
    else fill(Math.min(x1, x2), y1 - stroke / 2, Math.abs(x2 - x1), stroke, REG);                          // horizontal
  }

  for (const c of geo.primitives.circles) {
    const cx = pt(c.cx), cy = pt(c.cy), r = pt(c.r), half = stroke / 2;
    const x0 = Math.floor(cx - r - half), x1 = Math.ceil(cx + r + half);
    const y0 = Math.floor(cy - r - half), y1 = Math.ceil(cy + r + half);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r) <= half) put(x, y, REG);
    }
  }

  for (const b of geo.primitives.bars) {
    const ink = b.cmyk.map(v => Math.round(v * 255));
    fill(pt(b.x), pt(b.y), pt(b.w), pt(b.h), ink);
  }

  // Provenance credit text - only the anchors the caller supplied a string for.
  // The browser shapes the glyphs on an offscreen canvas (Helvetica, mirroring the
  // PDF path), then each covered pixel is composited as 70% K ink - the raster
  // analogue of the PDF's cmyk(0,0,0,0.7) - so the credits sit on the black plate
  // only, not as registration. Engine coords are points, top-left origin (same as
  // the canvas) so there's no y-flip; rotation is CCW-positive, hence the negation.
  const slots = (geo.primitives.labels ?? []).filter(l => labels?.[l.slot]);
  if (slots.length) {
    // Stamp the credits onto a canvas no bigger than the labels' union bounding
    // box, not the full W×H sheet - the old path allocated an image-sized canvas
    // and ran a second whole-image getImageData + per-pixel loop just to composite
    // a few glyphs. The bbox is padded generously (ascent/descent + side overhang,
    // rotation-aware) so no covered pixel is ever clipped → byte-identical output.
    const measure = document.createElement('canvas').getContext('2d')!;
    measure.textBaseline = 'alphabetic';
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const l of slots) {
      const size = pt(l.size);
      measure.font = `${size}px Helvetica, Arial, sans-serif`;
      const tw = measure.measureText(labels![l.slot]!).width;
      const baseX = (l.align === 'right') ? -tw : 0;     // fillText anchor offset
      const lx0 = baseX - size * 0.3, lx1 = baseX + tw + size * 0.3;
      const ly0 = -size * 1.3,        ly1 = size * 0.5;  // generous ascent/descent
      const theta = l.rotation ? -l.rotation * Math.PI / 180 : 0;
      const cos = Math.cos(theta), sin = Math.sin(theta);
      const ax = pt(l.x), ay = pt(l.y);
      for (const [lx, ly] of [[lx0, ly0], [lx1, ly0], [lx1, ly1], [lx0, ly1]] as [number, number][]) {
        const gx = ax + lx * cos - ly * sin;
        const gy = ay + lx * sin + ly * cos;
        if (gx < minX) minX = gx; if (gx > maxX) maxX = gx;
        if (gy < minY) minY = gy; if (gy > maxY) maxY = gy;
      }
    }
    const bx0 = Math.max(0, Math.floor(minX)), by0 = Math.max(0, Math.floor(minY));
    const bx1 = Math.min(W, Math.ceil(maxX)),  by1 = Math.min(H, Math.ceil(maxY));
    const bw = bx1 - bx0, bh = by1 - by0;
    if (bw > 0 && bh > 0) {
      const tcanvas = document.createElement('canvas');
      tcanvas.width = bw; tcanvas.height = bh;
      const tctx = tcanvas.getContext('2d', { willReadFrequently: true })!;
      tctx.fillStyle = '#000';
      tctx.textBaseline = 'alphabetic';
      tctx.translate(-bx0, -by0);                        // draw in absolute device px
      for (const l of slots) {
        tctx.save();
        tctx.translate(pt(l.x), pt(l.y));
        if (l.rotation) tctx.rotate(-l.rotation * Math.PI / 180);
        tctx.textAlign = l.align === 'right' ? 'right' : 'left';
        tctx.font = `${pt(l.size)}px Helvetica, Arial, sans-serif`;
        tctx.fillText(labels![l.slot]!, 0, 0);
        tctx.restore();
      }
      const tpx = tctx.getImageData(0, 0, bw, bh).data;
      for (let ry = 0; ry < bh; ry++) {
        let p = ry * bw * 4 + 3;                         // alpha byte, region row ry
        let o = ((by0 + ry) * W + bx0) * 4;              // matching sheet pixel
        for (let rx = 0; rx < bw; rx++, p += 4, o += 4) {
          const t = (tpx[p]! / 255) * 0.7;                // glyph coverage → 70% K ink
          if (!t) continue;
          cmyk[o]     = (cmyk[o]!     * (1 - t) + 0.5) | 0;
          cmyk[o + 1] = (cmyk[o + 1]! * (1 - t) + 0.5) | 0;
          cmyk[o + 2] = (cmyk[o + 2]! * (1 - t) + 0.5) | 0;
          cmyk[o + 3] = (cmyk[o + 3]! * (1 - t) + 255 * t + 0.5) | 0;
        }
      }
    }
  }
}

// The human-readable press condition recorded as TIFF provenance (ImageDescription).
// Mirrors the PDF OutputIntent's purpose - naming the condition the DeviceCMYK values
// target - but as metadata only: the pixels stay untagged (no embedded profile), so
// the file is never mislabelled. 'none' opts out; anything else resolves via the
// engine registry (unknown / 'srgb' fall back to the default condition).
//
// 'own' (the user's own profile, the PDF's embed route) must NOT reach
// cmykCondition: it would silently fall back to the DEFAULT condition and write
// "Coated FOGRA39" into a TIFF made for a different press. A TIFF cannot embed a
// profile, so the label is the profile's own description - and when that profile
// cannot be resolved, no label at all rather than a wrong one.
async function pressConditionLabel(profile: string | undefined): Promise<string | null> {
  if (profile === 'none') return null;
  if (isOwnProfile(profile)) {
    const embed = await embeddedProfile(profile);
    return embed ? (embed.pairedCondition ? embed.info : embed.desc) : null;
  }
  return cmykCondition(profile).info;
}

// Can this environment both PRODUCE and DELIVER a DeviceCMYK TIFF? Memoised.
// dom-to-image options: render the node at its native CSS size then scale it up
// (via CSS transform) to the target output resolution. The target is the
// requested dimension converted to pixels at the chosen DPI; if none was
// requested we fall back to the canvas at its default 2× scale.
function rasterStyle(d: ExportDims, opts: ExportOpts): DtoRenderOpts {
  const requested = (opts.width != null && opts.width !== '') || (opts.height != null && opts.height !== '');
  // The default factor is stated in bridge/export-scale.ts, because preflight has to
  // report the pixel count this line will produce and a second literal is how the
  // two drift apart.
  const scale = opts.scale ?? RASTER_DEFAULT_SCALE;
  const targetW = requested ? toPixels(d.w, d.dpi) : Math.round(d.node.w * scale);
  const targetH = requested ? toPixels(d.h, d.dpi) : Math.round(d.node.h * scale);
  const renderScale = targetW / d.node.w;
  const result: DtoRenderOpts = {
    width: targetW,
    height: targetH,
    style: {
      transform: `scale(${renderScale})`,
      transformOrigin: 'top left',
      width: `${d.node.w}px`,
      height: `${d.node.h}px`,
    },
  };
  if (opts.background === 'transparent') {
    result.style.background = 'transparent';
  } else if (opts.background != null) {
    result.bgcolor = opts.background;
  }
  return result;
}

// dom-to-image options that stretch the node to exactly cover a target pixel box
// (the bleed box) - non-uniform scale, matching the PDF's scale-to-bleed. Used by
// the print-finished CMYK TIFF; any transparency is flattened onto the white sheet
// by the CMYK pass, so the background is immaterial here.
function coverRasterStyle(d: ExportDims, opts: ExportOpts, targetW: number, targetH: number): DtoRenderOpts {
  const result: DtoRenderOpts = {
    width: targetW,
    height: targetH,
    style: {
      transform: `scale(${targetW / d.node.w}, ${targetH / d.node.h})`,
      transformOrigin: 'top left',
      width: `${d.node.w}px`,
      height: `${d.node.h}px`,
    },
  };
  if (opts.background === 'transparent') result.style.background = 'transparent';
  else if (opts.background != null) result.bgcolor = opts.background;
  return result;
}


// Remove comment nodes from a subtree. A tool's template.html comments serialise
// verbatim into its SVG export as pure dead weight - e.g. filter-duotone's ~674 KB
// commented-out declarative fallback <image>. Comments never render, so strip them
// from every clone we serialise to SVG. Works on detached nodes (the export clones).
export function stripCommentNodes(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  for (const c of comments) c.parentNode?.removeChild(c);
}

async function renderSvg(node: Element, opts: ExportOpts = {}): Promise<Blob> {
  // SVG is the one export format that can express a frosted panel: the walker
  // reconstructs `backdrop-filter: blur()` by cloning, clipping and blurring the
  // content already emitted behind the element. On by default here (an explicit
  // opts.backdropBlur still wins) so a tool's frosted glass survives an SVG export
  // instead of silently flattening.
  //
  // Caveat, not fixed in v1: tool exports run with `stackingOrder` off, so "the
  // content emitted so far IS what is behind" holds only where DOM order equals
  // paint order. Design boxes are unrotated siblings in paint order and
  // satisfy it; arbitrary tool CSS (negative z-index, reordering) may not.
  // EMF/EPS/DXF deliberately stay off it - svg-ir drops every non-drop-shadow
  // filter, so the reconstruction would degrade there to a SHARP backdrop clone,
  // which is worse than the raster hatch.
  // Print geometry (bleed + marks + colour bar), when requested. Null → every branch
  // below produces its EXACT current output (byte-identical). Non-null → the artwork
  // is wrapped in a media-sized outer <svg> with the marks (wrapArtworkSvgWithMarks).
  const geo = printGeometry(node, opts);
  if (!isSvgRooted(node)) {
    const inner = await renderSvgFromHtml(node, { backdropBlur: true, ...opts });
    if (!geo) return inner;
    const artworkEl = new DOMParser().parseFromString(await inner.text(), 'image/svg+xml').documentElement;
    return wrapArtworkSvgWithMarks(artworkEl, geo, opts);
  }
  const svg = node.tagName?.toLowerCase() === 'svg' ? node : node.querySelector('svg');
  const clone = svg!.cloneNode(true) as Element;
  stripCommentNodes(clone);
  // The clone leaves the canvas, so any rule scopeTemplateStyles pinned under the
  // canvas selector has to be released or it matches nothing in the standalone file.
  unscopeStyleEls(clone);
  // The clone is otherwise a VERBATIM copy of the tool's live <svg>, keeping its
  // <text> runs as live text - a violation of the "vector output always outlines
  // text" rule, and a real bug on guest brands: community SVG tools (chart-creator,
  // d3) style text via an internal `font-family: var(--font-brand, 'SUSE', …)` rule,
  // so a standalone file (where --font-brand is undefined) renders in the SUSE
  // fallback, selectable, in the wrong font. Outline the runs into <path> shaped in
  // the run's computed (brand-resolved) font before serialising.
  await outlineSvgTextRuns(svg!, clone, opts.convertPaths !== false);
  // Apply the requested size in its native unit (e.g. "210mm") - SVG is
  // resolution-independent. Ensure a viewBox so the original coordinates scale
  // into the new physical size.
  const d = exportDims(node, opts);
  if (parseDimension(opts.width) || parseDimension(opts.height)) {
    if (!clone.getAttribute('viewBox')) {
      const ow = svg!.getBoundingClientRect();
      clone.setAttribute('viewBox', `0 0 ${ow.width || d.node.w} ${ow.height || d.node.h}`);
    }
    clone.setAttribute('width', toCssLength(d.w));
    clone.setAttribute('height', toCssLength(d.h));
  }
  await inlineBlobUrlsInEl(clone);
  if (!geo) {
    const xml = injectSvgMeta(new XMLSerializer().serializeToString(clone), opts.meta);
    return new Blob(['<?xml version="1.0" standalone="no"?>\n' + xml], { type: 'image/svg+xml' });
  }
  // The nested artwork needs a viewBox for the scale into the bleed box. Only touched
  // on the geometry path, so the plain-SVG output above stays byte-identical.
  if (!clone.getAttribute('viewBox')) {
    const ow = svg!.getBoundingClientRect();
    const vbw = ow.width || d.node.w, vbh = ow.height || d.node.h;
    if (vbw > 0 && vbh > 0) clone.setAttribute('viewBox', `0 0 ${vbw} ${vbh}`);
  }
  return wrapArtworkSvgWithMarks(clone, geo, opts);
}

// Wrap an artwork <svg> in a media-sized outer <svg> and append the print marks:
// crop/bleed/registration lines + rings, the brand colour bar, and provenance text - 
// all from the same computePrintGeometry the PDF path uses. Points → CSS px (96/72)
// so the coordinates match the artwork's CSS-px space; SVG is top-left origin like
// the engine points, so there is no y-flip. The trim/bleed/media boxes are also
// carried as documentary data-*-box attributes (no renderer honours them; the marks
// themselves are the trim/bleed declaration on SVG).
async function wrapArtworkSvgWithMarks(artworkEl: Element, geo: PrintGeometry, opts: ExportOpts): Promise<Blob> {
  const NS = 'http://www.w3.org/2000/svg';
  const PT2CSS = CSS_DPI / 72;   // 96/72
  const num = (v: number): string => { const r = Math.round(v * 1000) / 1000; return String(Object.is(r, -0) ? 0 : r); };
  const P = (v: number): string => num(v * PT2CSS);
  const rgbStr = (t: readonly number[]): string => `rgb(${Math.round((t[0] ?? 0) * 255)},${Math.round((t[1] ?? 0) * 255)},${Math.round((t[2] ?? 0) * 255)})`;
  const boxAttr = (b: { x: number; y: number; w: number; h: number }): string => `${num(b.x)} ${num(b.y)} ${num(b.w)} ${num(b.h)}`;

  if (!artworkEl.getAttribute('viewBox')) {
    const w = parseFloat(artworkEl.getAttribute('width') || '') || 0;
    const h = parseFloat(artworkEl.getAttribute('height') || '') || 0;
    if (w > 0 && h > 0) artworkEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  // Nest the artwork into the bleed box (fill it - scale-to-cover, matching the PDF).
  const bleed = geo.boxes.bleed;
  artworkEl.setAttribute('x', P(bleed.x));
  artworkEl.setAttribute('y', P(bleed.y));
  artworkEl.setAttribute('width', P(bleed.w));
  artworkEl.setAttribute('height', P(bleed.h));
  artworkEl.setAttribute('preserveAspectRatio', 'none');

  const outer = document.createElementNS(NS, 'svg');
  outer.setAttribute('xmlns', NS);
  outer.setAttribute('width', `${num(geo.page.w)}pt`);
  outer.setAttribute('height', `${num(geo.page.h)}pt`);
  outer.setAttribute('viewBox', `0 0 ${P(geo.page.w)} ${P(geo.page.h)}`);
  outer.setAttribute('data-media-box', boxAttr(geo.boxes.media));
  outer.setAttribute('data-bleed-box', boxAttr(geo.boxes.bleed));
  outer.setAttribute('data-trim-box', boxAttr(geo.boxes.trim));
  outer.appendChild(artworkEl);

  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'print-marks');
  const sw = P(geo.strokeWeight);
  for (const ln of geo.primitives.lines) {
    const el = document.createElementNS(NS, 'line');
    el.setAttribute('x1', P(ln.x1)); el.setAttribute('y1', P(ln.y1));
    el.setAttribute('x2', P(ln.x2)); el.setAttribute('y2', P(ln.y2));
    el.setAttribute('stroke', '#000'); el.setAttribute('stroke-width', sw);
    g.appendChild(el);
  }
  for (const c of geo.primitives.circles) {
    const el = document.createElementNS(NS, 'circle');
    el.setAttribute('cx', P(c.cx)); el.setAttribute('cy', P(c.cy)); el.setAttribute('r', P(c.r));
    el.setAttribute('fill', 'none'); el.setAttribute('stroke', '#000'); el.setAttribute('stroke-width', sw);
    g.appendChild(el);
  }
  for (const b of geo.primitives.bars) {
    const el = document.createElementNS(NS, 'rect');
    el.setAttribute('x', P(b.x)); el.setAttribute('y', P(b.y));
    el.setAttribute('width', P(b.w)); el.setAttribute('height', P(b.h));
    const r = Math.min(b.r ?? 0, b.w / 2, b.h / 2);
    if (r > 0) el.setAttribute('rx', P(r));
    el.setAttribute('fill', rgbStr(b.rgb));   // SVG output is RGB
    g.appendChild(el);
  }
  const labels = provenanceLabels(opts.meta);
  for (const l of geo.primitives.labels) {
    const str = labels?.[l.slot];
    if (!str) continue;
    const el = document.createElementNS(NS, 'text');
    el.setAttribute('x', P(l.x)); el.setAttribute('y', P(l.y));
    el.setAttribute('font-size', P(l.size));
    el.setAttribute('fill', '#595959');
    el.setAttribute('font-family', 'Helvetica,Arial,sans-serif');
    if (l.align === 'right') el.setAttribute('text-anchor', 'end');
    // Engine rotation 90 = read-up; SVG positive rotate is clockwise, so negate.
    if (l.rotation) el.setAttribute('transform', `rotate(-90 ${P(l.x)} ${P(l.y)})`);
    el.textContent = str;
    g.appendChild(el);
  }
  outer.appendChild(g);

  const xml = injectSvgMeta(new XMLSerializer().serializeToString(outer), opts.meta);
  return new Blob(['<?xml version="1.0" standalone="no"?>\n' + xml], { type: 'image/svg+xml' });
}

// Convert the <text> runs of a tool's own <svg> (the renderSvg fast-path clone) into
// outlined <path>s, so an exported SVG renders identically without the authoring
// machine's fonts - the same guarantee the HTML path (emitInlineTextSvg) already gives.
//
// Styles are read from the LIVE element (`liveSvg`, still connected during render): its
// computed `font-family` resolves the brand var - `var(--font-brand, 'SUSE', …)` becomes
// the actual brand stack (the platform SUSE face, or a user's Google font) - which resolveVectorFont then
// maps to a fetchable sfnt. The clone is a deep copy, so its <text> list is 1:1 with the
// live one in document order; we shape each run and swap the clone's node for a <path>.
//
// Runs we can't faithfully outline - a run with <tspan> children, an unresolvable/icon
// font, or one with a .notdef glyph - keep their <text>, but get the resolved family
// baked as an INLINE style (which beats the tool's internal <style> rule; a presentation
// attribute would not) so they never fall through to the 'SUSE' var fallback. When
// `outline` is false (the "Convert paths" toggle off) every run is left as editable text
// with only the family baked, honouring the user's request.
async function outlineSvgTextRuns(liveSvg: Element, clone: Element, outline: boolean): Promise<void> {
  const liveTexts = liveSvg.querySelectorAll('text');
  const cloneTexts = clone.querySelectorAll('text');
  // A deep clone keeps a 1:1, same-order <text> list; a mismatch means something
  // rewrote the tree between clone and now - leave it rather than mis-map runs.
  if (!liveTexts.length || liveTexts.length !== cloneTexts.length) return;
  const textApi = _host?.text;
  const NS = 'http://www.w3.org/2000/svg';
  const num = (v: string | null): number => { const n = parseFloat(v ?? ''); return Number.isFinite(n) ? n : 0; };
  const rel = (v: string | null, em: number): number => {
    const s = (v ?? '').trim(); if (!s) return 0;
    return s.endsWith('em') ? (parseFloat(s) || 0) * em : (parseFloat(s) || 0);
  };

  for (let i = 0; i < liveTexts.length; i++) {
    const live = liveTexts[i] as SVGTextElement;
    const cl = cloneTexts[i] as SVGElement;
    const cs = window.getComputedStyle(live);
    if (cs.display === 'none') continue;                         // hidden - leave as-is
    const raw = applyTextTransform((live.textContent ?? '').replace(/\s+/g, ' ').trim(), cs.textTransform);
    if (!raw) continue;

    // Bake the brand-resolved family inline so a KEPT <text> can't inherit the SUSE
    // var fallback. No-op cost on a run we go on to replace with a <path>.
    const bakeFamily = () => { cl.style.fontFamily = cs.fontFamily; };

    const simple = [...live.childNodes].every(n => n.nodeType === 3);   // no <tspan>
    if (!outline || !simple || !textApi) { bakeFamily(); continue; }

    const fontSizePx = parseFloat(cs.fontSize) || 16;
    const styleSlice = { fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle };
    let vf: VectorFont | null = null;
    try { vf = await resolveVectorFont(styleSlice, raw); } catch { vf = null; }
    if (!vf?.url) { bakeFamily(); continue; }

    const letterSpacing = letterSpacingPx(cs.letterSpacing);
    const features = featureSettingsToHb(cs.fontFeatureSettings);
    let d = '', adv = 0, notdef = 0;
    try {
      const r = await textApi.toPath({ text: raw, fontUrl: vf.url, fontSize: fontSizePx, features: features as string[], letterSpacing, variations: vf.variations, fallbackFonts: vf.fallbacks });
      d = r.d; adv = r.advanceWidth || 0; notdef = r.notdef ?? 0;
    } catch (e) {
      _host?.log?.('warn', `svg: SVG-text outline failed, keeping <text> - ${(e as Error).message}`);
    }
    if (!d || notdef) { bakeFamily(); continue; }

    // toPath places the baseline at y=0 with the pen starting at x=0. SVG's own `y`
    // IS the baseline for the default (auto/alphabetic) dominant-baseline; the other
    // values shift it by font metrics. `x` (+ dx) with text-anchor and the shaped
    // advance width give the left edge.
    const x = num(live.getAttribute('x')) + rel(live.getAttribute('dx'), fontSizePx);
    let y = num(live.getAttribute('y')) + rel(live.getAttribute('dy'), fontSizePx);
    const db = live.getAttribute('dominant-baseline') || cs.dominantBaseline || 'auto';
    if (db === 'middle' || db === 'central') {
      const { ascent, descent } = fontMetricsPx(cs, fontSizePx); y += (ascent - descent) / 2;
    } else if (db === 'hanging' || db === 'text-before-edge') {
      y += fontMetricsPx(cs, fontSizePx).ascent;
    } else if (db === 'text-after-edge' || db === 'ideographic') {
      y -= fontMetricsPx(cs, fontSizePx).descent;
    }
    if (adv <= 0) { try { adv = live.getComputedTextLength(); } catch { adv = 0; } }
    const anchor = live.getAttribute('text-anchor') || cs.textAnchor || 'start';
    const xAdj = anchor === 'middle' ? x - adv / 2 : anchor === 'end' ? x - adv : x;

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    const own = live.getAttribute('transform');
    path.setAttribute('transform', `${own ? own + ' ' : ''}translate(${n2(xAdj)},${n2(y)})`);
    path.setAttribute('fill', cs.fill || live.getAttribute('fill') || '#000');
    if (cs.fillOpacity && parseFloat(cs.fillOpacity) < 1) path.setAttribute('fill-opacity', cs.fillOpacity);
    if (cs.opacity && parseFloat(cs.opacity) < 1) path.setAttribute('opacity', cs.opacity);
    // Preserve text stroke/outline in vector export
    const stroke = cs.stroke || live.getAttribute('stroke');
    if (stroke) {
      path.setAttribute('stroke', stroke);
      const strokeWidth = cs.strokeWidth || live.getAttribute('stroke-width');
      if (strokeWidth) path.setAttribute('stroke-width', strokeWidth);
      const strokeOpacity = cs.strokeOpacity || live.getAttribute('stroke-opacity');
      if (strokeOpacity) path.setAttribute('stroke-opacity', strokeOpacity);
    }
    cl.replaceWith(path);
  }
}

// ── EMF (Enhanced Metafile) - vector, always text-as-paths ──────────────────
//
// EMF is a third sink on the SVG vector pipeline (alongside SVG and PDF): obtain
// an SVG whose text is already outlined - the tool's own <svg>, or an outlined
// SVG synthesised from an HTML layout via renderSvgFromHtml - walk it into the
// engine IR (svgDomToIr), and serialize to bytes (emitEmf). Device RGB only;
// gradients/images/alpha are flattened to solids upstream. See
// plans/63-emf-support.md. The text-as-paths guarantee is enforced in svgDomToIr,
// which throws on any run it can't vectorise rather than dropping it.
// SVGZ is literally gzip(SVG): the same renderSvg output (text-as-paths, frosted
// panels, provenance <metadata> all identical), compressed ~60-70% smaller. Every
// vector editor and any Content-Encoding-aware consumer reads it back transparently,
// and the engine's gunzip recovers byte-identical SVG on import.
async function renderSvgz(node: Element, opts: ExportOpts = {}): Promise<Blob> {
  const svgBlob = await renderSvg(node, opts);
  const bytes = new Uint8Array(await svgBlob.arrayBuffer());
  return new Blob([gzip(bytes) as BlobPart], { type: 'image/svg+xml' });
}

async function renderEmf(node: Element, opts: ExportOpts = {}): Promise<Blob> {
  // Live text records are the default (editable in Office / Google Drawings);
  // opts.text === 'outline' (the "Outline fonts" chip) forces text-as-paths.
  const outline = opts.text === 'outline';
  let svgEl: Element | null = node.tagName?.toLowerCase() === 'svg' ? node : (node.querySelector?.('svg') ?? null);
  if (!svgEl) {
    // HTML-layout tool with no inline <svg>: synthesise an SVG first - outlined,
    // or with positioned <text> runs that the live walk below keeps as records.
    const svgBlob = await renderSvgFromHtml(node, { ...opts, convertPaths: outline, noBoxShadow: true });
    const xml = await svgBlob.text();
    svgEl = new DOMParser().parseFromString(xml, 'image/svg+xml').documentElement;
  }
  const ir = await svgDomToIr(svgEl, {
    host: _host,
    getComputedStyle: (el: Element) => window.getComputedStyle(el),
    background: opts.background,
    textMode: outline ? 'outline' : 'live',
  });
  const bytes = emitEmf(ir, { width: opts.width, height: opts.height, unit: opts.unit, dpi: opts.dpi, attribution: opts.metadata !== false });
  // application/x-msmetafile, not the RFC 7903 image/emf: Google Drive only
  // routes a metafile into Google Drawings (and from there Slides) under the
  // legacy type - image/emf uploads sit in Drive as an unopenable blob.
  return new Blob([bytes as BlobPart], { type: 'application/x-msmetafile' });
}

// WMF is the 16-bit ancestor of EMF - a sixth sink on the exact same outlined-SVG →
// engine IR (svgDomToIr) vector pipeline, wired identically to renderEmf. The safest
// vector paste for legacy Office / clip-art pipelines. `attribution` is accepted for
// call-site symmetry but is inert: WMF has no comment record to carry a source URL.
async function renderWmf(node: Element, opts: ExportOpts = {}): Promise<Blob> {
  let svgEl: Element | null = node.tagName?.toLowerCase() === 'svg' ? node : (node.querySelector?.('svg') ?? null);
  if (!svgEl) {
    const svgBlob = await renderSvgFromHtml(node, { ...opts, convertPaths: true, noBoxShadow: true });
    const xml = await svgBlob.text();
    svgEl = new DOMParser().parseFromString(xml, 'image/svg+xml').documentElement;
  }
  const ir = await svgDomToIr(svgEl, {
    host: _host,
    getComputedStyle: (el: Element) => window.getComputedStyle(el),
    background: opts.background,
    label: 'WMF',
  });
  const bytes = emitWmf(ir, { width: opts.width, height: opts.height, unit: opts.unit, dpi: opts.dpi, attribution: opts.metadata !== false });
  // Same legacy metafile type as EMF (see renderEmf) - Google Drive's Drawings
  // import matches application/x-msmetafile for WMF too.
  return new Blob([bytes as BlobPart], { type: 'application/x-msmetafile' });
}

// EPS is a fourth sink on the SVG vector pipeline (alongside SVG, PDF, and EMF):
// same outlined-SVG → engine IR (svgDomToIr) walk, then serialised to PostScript
// text by emitEps. Device RGB (cmyk=false) or DeviceCMYK (cmyk=true): an exact
// brand-palette match (buildCmykPaletteMap, shared with the CMYK PDF/TIFF paths)
// substitutes its locked CMYK - a spot lock's CMYK equivalent, same as the CMYK
// TIFF path, since a true PostScript /Separation colourspace is out of scope for
// this pass (see renderCmykPdf for the PDF path, which does emit one) - else the
// naive conversion. As with the TIFF path, a declared FINISH has no CMYK
// equivalent to substitute: buildCmykPaletteMap gives it FINISH_MASK_CMYK
// (100% K), so emitEps writes a black mask, and this format cannot carry a
// finish at all. No embedded output intent; gradients/images/alpha are
// flattened to solids upstream and text is outlined upstream, so the emitter
// ships no fonts.
async function renderEps(node: Element, opts: ExportOpts = {}, cmyk = false): Promise<Blob> {
  let svgEl: Element | null = node.tagName?.toLowerCase() === 'svg' ? node : (node.querySelector?.('svg') ?? null);
  if (!svgEl) {
    const svgBlob = await renderSvgFromHtml(node, { ...opts, convertPaths: true, noBoxShadow: true });
    const xml = await svgBlob.text();
    svgEl = new DOMParser().parseFromString(xml, 'image/svg+xml').documentElement;
  }
  const ir = await svgDomToIr(svgEl, {
    host: _host,
    getComputedStyle: (el: Element) => window.getComputedStyle(el),
    background: opts.background,
    label: 'EPS',
  });
  // Print geometry (bleed + marks + colour bar), when requested - same source as the
  // PDF path. Null when neither is set, so a plain EPS export is byte-identical.
  const geo = printGeometry(node, opts);
  const text = emitEps(ir, {
    width: opts.width, height: opts.height, unit: opts.unit, dpi: opts.dpi, cmyk,
    meta: opts.meta as { title?: string } | undefined,
    attribution: opts.metadata !== false,
    ...(cmyk ? { cmykPalette: buildCmykPaletteMap(opts.palette ?? []) } : {}),
    ...(geo ? { geometry: geo, markSpace: cmyk ? 'cmyk' as const : 'rgb' as const } : {}),
  });
  return new Blob([text], { type: 'application/postscript' });
}

// DXF is a fifth sink on the SVG vector pipeline (alongside SVG, PDF, EMF, EPS):
// the same outlined-SVG → engine IR (svgDomToIr) walk, then serialised to an ASCII
// DXF R12 document by emitDxf - POLYLINE entities (béziers flattened) in millimetres
// for CAD / laser-cut / vinyl / CNC. Text is outlined upstream; gradients/alpha are
// flattened to solids upstream (colour lands as a nearest AutoCAD Color Index). DXF
// has no raster form, so any escape-hatch image prim is dropped - we surface that as
// a log warning rather than silently losing the effect.
async function renderDxf(node: Element, opts: ExportOpts = {}): Promise<Blob> {
  let svgEl: Element | null = node.tagName?.toLowerCase() === 'svg' ? node : (node.querySelector?.('svg') ?? null);
  if (!svgEl) {
    const svgBlob = await renderSvgFromHtml(node, { ...opts, convertPaths: true, noBoxShadow: true });
    const xml = await svgBlob.text();
    svgEl = new DOMParser().parseFromString(xml, 'image/svg+xml').documentElement;
  }
  const ir = await svgDomToIr(svgEl, {
    host: _host,
    getComputedStyle: (el: Element) => window.getComputedStyle(el),
    background: opts.background,
    label: 'DXF',
  });
  const { text, droppedImages } = emitDxf(ir, { width: opts.width, height: opts.height, unit: opts.unit, dpi: opts.dpi, attribution: opts.metadata !== false });
  if (droppedImages > 0) {
    _host?.log?.('warn', `dxf: dropped ${droppedImages} rasterised region${droppedImages > 1 ? 's' : ''} (DXF is line-art only - use SVG/PDF to keep photographic or filtered content).`);
  }
  return new Blob([text], { type: 'image/vnd.dxf' });
}

// ── SVG from HTML DOM ─────────────────────────────────────────────────────
//
// Decomposes the live DOM into SVG primitives. Mirrors drawHtmlVectors (the
// PDF DOM walker) in structure; changes to one should be reflected in the other.
//
// Tools whose canvas IS an SVG element (lockup, qr-code) use the fast-path
// clone in renderSvg above. This path handles all HTML-DOM tools.

function isSvgRooted(node: Element): boolean {
  if (node.tagName?.toLowerCase() === 'svg') return true;
  for (const child of node.children) {
    const t = child.tagName.toLowerCase();
    if (t === 'style' || t === 'script') continue;
    return t === 'svg';
  }
  return false;
}


// Returns a short reason string when `el` uses CSS the vector walkers can't faithfully
// reproduce (they'd SILENTLY DROP it), so the caller rasterises the node's subtree and
// embeds it as an image instead. Returns null for everything the walkers DO handle - 
// that null-by-default is what keeps normal vector output byte-identical to before.
// `vectorCaps` lets a caller declare features IT can emit natively: the SVG walker
// carries mix-blend-mode as a style and emits circle/ellipse/inset clips as <clipPath>
// shapes, so it keeps those vector rather than rasterising (PDF/EMF/EPS still raster).
/** `backdrop-filter: blur(6px)` → 6. Null for anything that is not a single blur():
 *  a chain like `blur(4px) saturate(1.3)` genuinely has no SVG equivalent, because
 *  the extra functions operate on the backdrop we can only approximate. */
export function parseBackdropBlurPx(bf: string): number | null {
  const m = /^\s*blur\(\s*([\d.]+)px\s*\)\s*$/i.exec(bf || '');
  const v = m ? parseFloat(m[1]!) : NaN;
  return Number.isFinite(v) && v >= 0 ? v : null;
}

export function detectUnsupportedCss(el: Element, s: CSSStyleDeclaration, vectorCaps?: { blend?: boolean; clipBasicShapes?: boolean; dropShadow?: boolean; cssFilter?: boolean; backdropBlur?: boolean; conic?: boolean }): string | null {
  const tag = el.tagName.toLowerCase();
  // <img> filters are already baked (bakeImageFilter); <svg> subtrees have their own
  // faithful/raster paths. Never rasterise those here.
  if (tag === 'img' || tag === 'svg') return null;

  // filter: TWO vector routes, and BOTH are caller-declared, because only one walker
  // can drive them. drop-shadow(s) become real geometry (vectorCaps.dropShadow →
  // <feDropShadow>), and every other CSS filter function is spec-defined AS an SVG
  // filter, so the chain can be emitted verbatim (vectorCaps.cssFilter). A chain
  // containing something with no SVG equivalent - a url() reference, an unknown
  // function - rasterises for everyone.
  //
  // `cssFilter` is a cap and not a bare `parseCssFilter(...)` test because "this value
  // is expressible as an SVG filter" is NOT the same claim as "the caller will emit
  // one". It was written as the bare test, so `filter: blur(6px)` was declared
  // supported for EVERY caller while only the SVG walker fulfilled it: the PDF walker
  // has no filter branch at all, so DOF blur and the design `shadow: content` /
  // `shadow: depth` silhouettes were dropped from PDF in silence - no raster, no
  // warning, no shadow. (Coloured drop-shadows escaped by accident: their computed
  // value nests an rgba(), which parseCssFilter's flat tokeniser refuses, so they fell
  // through to the hatch. A parser limitation is not a policy.) Declaring it makes the
  // PDF walker take the per-element raster escape hatch instead - plan 104 section 2, P1d.
  if (s.filter && s.filter !== 'none'
      && !(vectorCaps?.dropShadow && parseDropShadowFilter(s.filter))
      && !(vectorCaps?.cssFilter && parseCssFilter(s.filter))) return `filter:${s.filter}`;
  const bf = s.backdropFilter || (s as { webkitBackdropFilter?: string }).webkitBackdropFilter;
  // A blur-only backdrop-filter IS expressible: duplicate the content already painted
  // behind the element, clip that duplicate to the element's own shape, and blur it.
  // The caller declares support via vectorCaps.backdropBlur - anything richer than a
  // single blur() (saturate, brightness, a filter chain) still has no vector form.
  if (bf && bf !== 'none' && !(vectorCaps?.backdropBlur && parseBackdropBlurPx(bf) !== null)) return `backdrop-filter:${bf}`;
  // mix-blend-mode: SVG can carry it natively; only raster where the walker can't.
  if (s.mixBlendMode && s.mixBlendMode !== 'normal' && !vectorCaps?.blend) return `mix-blend-mode:${s.mixBlendMode}`;

  const mask = s.maskImage || (s as { webkitMaskImage?: string }).webkitMaskImage
    || (s.mask && s.mask !== 'none' && s.mask !== 'match-source' ? s.mask : '');
  if (mask && mask !== 'none') return `mask:${mask}`;

  // clip-path: polygon() is always kept vector; circle()/ellipse()/inset() are kept only
  // where the caller emits them as a <clipPath> (vectorCaps.clipBasicShapes); url()/path()
  // are never vectorisable → rasterise. (border-radius circles on <img> handled elsewhere.)
  const cp = s.clipPath || (s as { webkitClipPath?: string }).webkitClipPath;
  if (cp && cp !== 'none') {
    const isPolygon = cp.indexOf('polygon(') === 0;
    const isBasicShape = isPolygon || /^(circle|ellipse|inset)\(/i.test(cp);
    if (!isPolygon && !(isBasicShape && vectorCaps?.clipBasicShapes)) return `clip-path:${cp}`;
  }

  // background-image: linear/radial gradients emit true SVG/PDF gradients; a SINGLE
  // non-tiling url() emits a real <image> (vector-first - keeps the box's text vector).
  // Only cases with no single-<image> equivalent rasterise: conic-gradient, a TILING
  // background (repeat at intrinsic/auto size), or MULTIPLE layered url() images.
  const bi = s.backgroundImage;
  if (bi && bi !== 'none') {
    // PER LAYER, because `background-image` is a list and every parser below takes ONE
    // gradient. The transparency checker is the case that proves it: authored as
    // `background: <repeating-conic-gradient> 50% / 14px 14px, <colour>`, it computes to
    // `repeating-conic-gradient(…), none` - the colour layer contributes a `none` - and
    // handing that whole string to parseConicGradient fails, so the checker was declared
    // unvectorisable and the entire node was rasterised. That is how a 1080×676 PNG of a
    // faint checkerboard ended up inside docs/shots/use-chart-output.svg.
    const layers = splitCssArgs(bi).map((l) => l.trim()).filter((l) => l && l !== 'none');
    // A conic gradient is drawn as a wedge fan when we can parse it - but ONLY by the
    // SVG walker. The PDF walker has no conic branch (its gradient path handles linear
    // and radial), and sampleGradientMidpoint returns null for a conic, so exempting it
    // there dropped the sweep entirely: a box with a transparent flat fill lost its
    // paint. So the exemption is scoped to the caller that can honour it.
    for (const layer of layers) {
      if (layer.includes('conic-gradient')
        && !(vectorCaps?.conic && parseConicGradient(layer, 100, 100))) return 'conic-gradient';
    }
    if (bi.includes('url(')) {
      const multiple = (bi.match(/url\(/g) || []).length > 1;
      const rep = (s.backgroundRepeat || 'repeat').toLowerCase();
      const size = (s.backgroundSize || 'auto').toLowerCase();
      void size; void rep;
      // A tiling background is emitted as an SVG <pattern> now, so only MULTIPLE
      // layered url() images still have no single-element equivalent.
      if (multiple) return 'background-image:url()';
    }
  }

  // NB: skew / 3-D transforms are deliberately NOT rasterised here. dom-to-image
  // captures the node with a plain scale (its own transform is overwritten), so the
  // skew/3-D wouldn't be reproduced anyway - rasterising would only turn crisp vector
  // text into a bitmap for no gain. Leave those to the (axis-aligned) vector walk;
  // pure rotation is already reproduced upstream (SVG rotate / withPdfRotation).
  return null;
}

// CSS basic-shape / gradient / drop-shadow value parsing lives DOM-free in the engine
// (parseClipShape / parseRadialGradient / parseDropShadowFilter - engine/src/css-paint.ts),
// so the SVG and PDF walkers share one parser. This file keeps only the DOM assembly:
// turning that geometry into SVG elements (svgClipShapeEl / build*El) or jsPDF ops.

// Build the SVG shape element for a ClipShape, offset into root coords by (ox, oy).
function svgClipShapeEl(NS: string, shape: ClipShape, ox: number, oy: number): Element {
  if (shape.kind === 'circle') {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', String(n2(ox + shape.cx))); c.setAttribute('cy', String(n2(oy + shape.cy)));
    c.setAttribute('r', String(n2(shape.r)));
    return c;
  }
  if (shape.kind === 'ellipse') {
    const e = document.createElementNS(NS, 'ellipse');
    e.setAttribute('cx', String(n2(ox + shape.cx))); e.setAttribute('cy', String(n2(oy + shape.cy)));
    e.setAttribute('rx', String(n2(shape.rx))); e.setAttribute('ry', String(n2(shape.ry)));
    return e;
  }
  if (shape.kind === 'inset') {
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', String(n2(ox + shape.x))); rect.setAttribute('y', String(n2(oy + shape.y)));
    rect.setAttribute('width', String(n2(shape.w))); rect.setAttribute('height', String(n2(shape.h)));
    if (shape.r > 0) { rect.setAttribute('rx', String(n2(shape.r))); rect.setAttribute('ry', String(n2(shape.r))); }
    return rect;
  }
  // `empty` never reaches here - callers return before drawing (a zero-area clip
  // paints nothing). Emitting a degenerate rect would be a silent 1px artefact,
  // so be explicit rather than letting it fall through to the polygon branch.
  if (shape.kind === 'empty') {
    const none = document.createElementNS(NS, 'rect');
    none.setAttribute('width', '0'); none.setAttribute('height', '0');
    return none;
  }
  const poly = document.createElementNS(NS, 'polygon');
  poly.setAttribute('points', shape.points.map((p: [number, number]) => `${n2(ox + p[0])},${n2(oy + p[1])}`).join(' '));
  return poly;
}

// The rotation pivot (transform-origin) of `el` in the walker's root-relative
// coordinate space, measured from the element's UNROTATED border box. Call while
// the element's rotation is neutralised so `unrotRect` is the axis-aligned box.
function rotationPivot(
  style: CSSStyleDeclaration,
  unrotRect: { left: number; top: number },
  rootRect: { left: number; top: number },
): { x: number; y: number } {
  const o = (style.transformOrigin || '50% 50%').split(' ').map(parseFloat);
  return {
    x: (unrotRect.left - rootRect.left) + (o[0] || 0),
    y: (unrotRect.top - rootRect.top) + (o[1] || 0),
  };
}

// The first url(...) in a CSS value (e.g. background-image), unquoted; null if none.
function firstCssUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  // The quote character is the TERMINATOR, so a quote of the other kind inside the
  // URL survives. The old pattern was `(["']?)([^)"']+)\1`, whose character class
  // banned BOTH quote marks from the body - which silently dropped every inline
  // SVG data-URI, since those are full of `xmlns='…'`. That is how the select
  // chevron (--field-chevron, styles/parts/fields.css:42 - one declaration, on
  // every <select> in the app) vanished from SVG and PDF exports: firstCssUrl
  // returned null, so the background branch never ran and nothing was emitted.
  // Three alternatives, in CSS's own order: "double", 'single', or bare.
  const m = String(value).match(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]([^)]*[^)\s])?))\s*\)/);
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? '').trim() || null;
}

// A CSS url() → a self-contained href: a data: URI stays as-is; blob:/http/relative are
// fetched and inlined as a data: URI (so the SVG renders in secure static mode). Null on fail.
async function cssUrlToHref(url: string): Promise<string | null> {
  try { return url.startsWith('data:') ? url : await blobToDataUrl(url); }
  catch { return null; }
}

// preserveAspectRatio for a background-image sized via `background-size` + positioned via
// `background-position`: cover→slice, contain→meet, two explicit lengths (e.g. 100% 100%)→
// none (stretch), else cover-like (the common decorative default). Alignment from position.
/** One parsed CSS filter function as its SVG element. The maths is all in
 *  css-filter.ts; this is assembly only. */
function filterPrimitiveEl(NS: string, p: FilterPrimitive): Element {
  if (p.kind === 'blur') {
    const e = document.createElementNS(NS, 'feGaussianBlur');
    e.setAttribute('stdDeviation', String(Math.round(p.stdDeviation * 1000) / 1000));
    return e;
  }
  if (p.kind === 'colorMatrix') {
    const e = document.createElementNS(NS, 'feColorMatrix');
    e.setAttribute('type', 'matrix');
    e.setAttribute('values', p.values.map((n) => Math.round(n * 10000) / 10000).join(' '));
    return e;
  }
  if (p.kind === 'hueRotate') {
    const e = document.createElementNS(NS, 'feColorMatrix');
    e.setAttribute('type', 'hueRotate');
    e.setAttribute('values', String(Math.round(p.deg * 1000) / 1000));
    return e;
  }
  const e = document.createElementNS(NS, 'feComponentTransfer');
  const chan = (name: string) => {
    const f = document.createElementNS(NS, name);
    if (p.mode === 'linear') {
      f.setAttribute('type', 'linear');
      f.setAttribute('slope', String(Math.round((p.slope ?? 1) * 10000) / 10000));
      f.setAttribute('intercept', String(Math.round((p.intercept ?? 0) * 10000) / 10000));
    } else if (p.mode === 'invert') {
      // invert(a) is the spec's table [a, 1-a] per channel.
      f.setAttribute('type', 'table');
      f.setAttribute('tableValues', `${p.amount ?? 1} ${1 - (p.amount ?? 1)}`);
    } else {
      f.setAttribute('type', 'linear');
      f.setAttribute('slope', String(p.amount ?? 1));
      f.setAttribute('intercept', '0');
    }
    return f;
  };
  if (p.mode === 'alpha') { e.appendChild(chan('feFuncA')); return e; }
  for (const c of ['feFuncR', 'feFuncG', 'feFuncB']) e.appendChild(chan(c));
  return e;
}

/** One top-level CSS filter function, allowing ONE level of nesting in its argument - 
 *  a colour function (`rgba(…)`) is the only thing that ever appears inside one. */
const FILTER_FN_RE = /[a-z-]+\((?:[^()]|\([^()]*\))*\)/gi;

/**
 * How far past its own box an element's `filter` paints, in CSS px.
 *
 * Only the filter: box-shadow is drawn separately by both walkers, and a transform is
 * neutralised before capture. A blur reaches ~3σ, and drop-shadow's σ IS its blur
 * value (unlike box-shadow's, which is half it - see buildDropShadowFilterEl).
 *
 * Measured PER TOP-LEVEL FUNCTION, not by handing the whole value to one parser, because
 * a MIXED chain defeats both of them: parseDropShadowFilter refuses any chain containing
 * a non-drop-shadow function, and parseCssFilter's flat tokeniser cannot see past the
 * nested rgba() of a coloured drop-shadow. `filter: blur(10px) drop-shadow(rgba(0,0,0,
 * 0.33) 0px 15px 30px)` - exactly what design emits for a blurred box carrying a
 * depth shadow - therefore measured ZERO spill, so the raster hatch cropped the effect
 * off at the box edge for the one case that spills furthest. Each function is still
 * measured by the engine parsers; only the splitting is done here.
 */
export function effectSpillCss(style: CSSStyleDeclaration): number {
  const f = style.filter;
  if (!f || f === 'none') return 0;
  let reach = 0;
  for (const [fn] of f.matchAll(FILTER_FN_RE)) {
    for (const sh of parseDropShadowFilter(fn) ?? []) {
      reach = Math.max(reach, sh.blur * 3 + Math.max(Math.abs(sh.dx), Math.abs(sh.dy)));
    }
    for (const p of parseCssFilter(fn) ?? []) {
      if (p.kind === 'blur') reach = Math.max(reach, p.stdDeviation * 3);
    }
  }
  return Math.min(200, reach);   // bounded: a pathological blur must not explode the capture
}

/** A computed length off a style, as a number. Missing/`auto` reads as 0. */
function num2(style: CSSStyleDeclaration, key: string): number {
  return Number.parseFloat((style as unknown as Record<string, string>)[key] || '') || 0;
}

/**
 * Place an object-fit image EXACTLY, where `preserveAspectRatio` cannot.
 *
 * SVG's preserveAspectRatio names only nine alignments - min/mid/max per axis -
 * so it can express object-position 0%, 50% and 100% and nothing in between. That
 * was invisible while every tool centred its photos; it became a real defect the
 * moment framing gave users a continuous pan (plans/148), because an image panned
 * to 32% exported at 50% and the preview and the file disagreed.
 *
 * Returns the fitted rectangle to write as explicit x/y/width/height (with
 * preserveAspectRatio="none" - the aspect is already baked into the numbers), or
 * null when the alignment IS exactly expressible, in which case the caller keeps
 * the preserveAspectRatio form and its output is byte-identical to before.
 * The PDF walker has always placed images this way (see its object-fit branch);
 * this brings the SVG walker onto the same footing.
 */
function exactFittedRect(
  style: CSSStyleDeclaration,
  natW: number, natH: number,
  x: number, y: number, w: number, h: number,
): { x: number; y: number; w: number; h: number } | null {
  const fit = style.objectFit;
  if (fit !== 'cover' && fit !== 'contain') return null;
  if (!(natW > 0) || !(natH > 0)) return null;
  const [px, py] = objectPositionFractions(style.objectPosition);
  const expressible = (f: number): boolean => f === 0 || f === 0.5 || f === 1;
  if (expressible(px) && expressible(py)) return null;
  const s = fit === 'cover' ? Math.max(w / natW, h / natH) : Math.min(w / natW, h / natH);
  const fw = natW * s, fh = natH * s;
  return { x: x + (w - fw) * px, y: y + (h - fh) * py, w: fw, h: fh };
}

/**
 * An image's natural size, for resolving `background-size: auto`.
 *
 * Memoised by href because the same chevron data-URI is the background of every
 * select on the page, and each miss is a decode. A failure resolves to null rather
 * than rejecting: CSS then treats the image as area-sized, which is exactly the
 * behaviour this replaced, so an undiscoverable image degrades to the old output
 * instead of vanishing.
 */
const intrinsicCache = new Map<string, Promise<{ w: number; h: number } | null>>();
function intrinsicSize(href: string): Promise<{ w: number; h: number } | null> {
  let p = intrinsicCache.get(href);
  if (!p) {
    p = new Promise<{ w: number; h: number } | null>((resolve) => {
      const im = new Image();
      const done = (v: { w: number; h: number } | null) => resolve(v);
      im.onload = () => done(im.naturalWidth > 0 ? { w: im.naturalWidth, h: im.naturalHeight } : null);
      im.onerror = () => done(null);
      im.src = href;
      // A never-settling decode must not hang an export.
      setTimeout(() => done(null), 3000);
    });
    intrinsicCache.set(href, p);
  }
  return p;
}

// ── Vector twins for <canvas> ────────────────────────────────────────────────
// A canvas is pixels by construction, so the walker rasterises it. But some of
// those canvases are painting something that HAS a vector form - the sequence
// editor's clip bars are rectangles, waveform bars and tiled thumbnails, drawn
// to a canvas only because that is the cheap way to repaint a timeline at 60fps.
// A painter that knows its own vector form advertises it by hanging a
// `__lollyVectorTwin` producer off the canvas element (see lib/vector-paint.ts).
//
// The contract is presence-keyed and deliberately invisible: no ExportOpts field,
// no attribute, no flag. A canvas WITHOUT the property must serialise
// byte-identically to how it always has - that is the safety guarantee for every
// tool export in every profile, and it is pinned by a golden in
// export-paint-order.test.ts.
//
// Re-entrancy: a producer may build its markup by calling the walker itself (the
// timeline's node-thumbnail twin does). Only the OUTERMOST walk may use twins - 
// otherwise a producer that renders a subtree containing its own canvas recurses.
// `twinDepth` is module-scope rather than per-call because the re-entrant call is
// a *separate* renderSvgFromHtml invocation, so a per-call local could not see it.
let twinDepth = 0;
const TWIN_TIMEOUT_MS = 2000;

/**
 * Resolve a canvas's vector twin into an element ready for insertion, or null.
 *
 * Null is the designed fall-through: every rejection (no property, nested walk,
 * timeout, throw, unparseable markup) leaves the caller to run the unmodified
 * toDataURL block, so the worst case is exactly today's output.
 */
async function vectorTwinEl(el: HTMLCanvasElement, mintPrefix: () => string): Promise<Element | null> {
  const produce = (el as VectorTwinCanvas).__lollyVectorTwin;
  if (typeof produce !== 'function' || twinDepth !== 0) return null;
  twinDepth++;
  try {
    // A producer that never settles must not hang an export; the race abandons the
    // wait (the producer itself keeps running, as with the runtime's hook budget).
    //
    // The guard is released when the PRODUCER settles, not when the race resolves.
    // Decrementing on the timeout branch would drop `twinDepth` back to 0 while an
    // abandoned producer is still running, so its own nested renderSvgFromHtml would
    // then see an unguarded walker and recurse - and the timeline producer's
    // `withBorrowedVisibility` lease strips `.seq-off` from LIVE stage boxes, so an
    // unguarded abandoned producer is a visible artefact on screen, not just wasted work.
    let settled = false;
    const running = Promise.resolve(produce()).finally(() => {
      settled = true;
      twinDepth--;
    });
    const markup = await Promise.race([
      running.catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TWIN_TIMEOUT_MS)),
    ]);
    if (!settled) return null;                       // timed out; the producer owns the decrement
    if (typeof markup !== 'string') return null;
    const parsed = parseSvgRoot(markup);
    if (!parsed) return null;
    const root = document.importNode(parsed, true) as Element;
    // Same normalisation the inline-<svg> passthrough applies (see the `tag === 'svg'`
    // branch): comments out, scoped-style attribute selectors undone, blob: URLs
    // inlined so the emitted file stands alone.
    stripCommentNodes(root);
    unscopeStyleEls(root);
    await inlineBlobUrlsInEl(root);
    // Ids are only unique within the twin that minted them - see namespaceSvgRefs.
    // The prefix is minted HERE, not at the call site: `uid` is the document's id
    // counter, and burning one on a twin that turns out to be null would shift every
    // later id in the file relative to the same document exported without twins.
    namespaceSvgRefs(root, mintPrefix());
    return root;
  } catch (e) {
    _host?.log?.('warn', `svg: <canvas> vector twin failed, falling back to raster - ${(e as Error).message}`);
    return null;
  }
}

// Exported for bridge/export-paint-order.test.ts, which drives the REAL walker in
// a REAL Chromium: jsdom cannot be the oracle for paint order, because the whole
// thing hinges on getComputedStyle resolving z-index, isolation and display
// blockification. Not part of the bridge's public surface otherwise.
export async function renderSvgFromHtml(node: Element, opts: ExportOpts): Promise<Blob> {
  const NS = 'http://www.w3.org/2000/svg';
  // Text → vector <path> by default (self-contained, font-independent SVG). The
  // 'Convert paths' export toggle (opts.convertPaths) turns this off, falling back
  // to <text> elements everywhere for selectable, editable output.
  const vectorText = opts.convertPaths !== false;
  const { width: nodeW, height: nodeH } = node.getBoundingClientRect();
  const d = exportDims(node, opts);
  // viewBox lives in CSS px (physical units at 96dpi); the width/height carry
  // the real unit so the SVG renders at the correct physical size.
  const vbW = toCssPx(d.w);
  const vbH = toCssPx(d.h);
  const scaleX  = vbW / nodeW;
  const scaleY  = vbH / nodeH;

  const svgEl = document.createElementNS(NS, 'svg');
  svgEl.setAttribute('xmlns',   NS);
  svgEl.setAttribute('width',   toCssLength(d.w));
  svgEl.setAttribute('height',  toCssLength(d.h));
  svgEl.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);

  const defs     = document.createElementNS(NS, 'defs');
  svgEl.appendChild(defs);

  const rootRect = node.getBoundingClientRect();
  let uid = 0;
  // Per-walk state for the transform neutralise branches below (see
  // bridge/transform-neutralise.ts): which elements are mid-neutralise, and the one
  // warning line a walk may spend saying a transform could not be stilled.
  const neutralise = newNeutraliseGuard();
  const warnTransform = (m: string): void => { _host?.log?.('warn', `svg: ${m}`); };
  // How many elements went out as a posed raster instead of vector (plans/104 section 12 Q2).
  // Counted rather than logged per element: a lifted stack under a tilted camera is
  // every layer, and one line naming the total is the honest report. It is also what
  // the amber notice in the export panel is telling the user in advance.
  let tiltedRasters = 0;

  // Cooperative yielding: the SVG-IR walk + host.text.toPath (HarfBuzz) shaping
  // runs fully synchronously and janks the UI for the whole export on a complex
  // document. Mirror the CMYK pixel pass - every YIELD_NODES elements, report
  // progress and hand the event loop a turn. Purely additive: emitted geometry
  // and node order are untouched, so the serialised SVG bytes are identical.
  const totalNodes = ((node as any).querySelectorAll?.('*').length ?? 0) + 1;
  let nodesWalked = 0;
  const YIELD_NODES = 200;

  const rootG = document.createElementNS(NS, 'g');
  if (Math.abs(scaleX - 1) > 1e-4 || Math.abs(scaleY - 1) > 1e-4) {
    rootG.setAttribute('transform', `scale(${scaleX.toFixed(6)},${scaleY.toFixed(6)})`);
  }
  svgEl.appendChild(rootG);

  // Emit a vector <clipPath> for a circle()/ellipse()/inset()/polygon() clip-path onto
  // `g` (shape parsed box-local, then offset to root coords). Returns true if emitted;
  // false for url()/path()/unparseable → the caller rasterises. Geometry parsing is the
  // shared parseClipShape so the SVG and PDF walkers agree on the shape.
  const emitClip = (cp: string, x: number, y: number, w: number, h: number, g: Element): 'ok' | 'empty' | 'unsupported' => {
    const shape = parseClipShape(cp, w, h);
    if (!shape) return 'unsupported';
    // A zero-area clip is fully understood and renders nothing. Report it so the
    // caller can SKIP the element instead of handing it to the raster hatch.
    if (shape.kind === 'empty') return 'empty';
    const cid = `fcclip-${++uid}`;
    const clip = document.createElementNS(NS, 'clipPath');
    clip.setAttribute('id', cid);
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    clip.appendChild(svgClipShapeEl(NS, shape, x, y));
    defs.appendChild(clip);
    g.setAttribute('clip-path', `url(#${cid})`);
    return 'ok';
  };

  // ── Stacking-context paint order (opts.stackingOrder) ────────────────────────
  //
  // The walk stays a single DOM-order pass; correctness comes from DEFERRED
  // APPEND. A child whose Appendix E section E.2 layer is 2, 6 or 7 is built exactly as
  // before but left DETACHED, parked in its stacking context's frame, and
  // appended when that context finishes. Layers 3 and 4 append immediately, as
  // they always have.
  //
  // Two facts about this walker are what make that free, and both were verified
  // against the code before the design was chosen:
  //
  //  1. EVERYTHING IS EMITTED IN ROOT COORDINATES (`x = rect.left - rootRect.left`
  //     throughout, `clipPathUnits="userSpaceOnUse"` on every clip). A <g> can be
  //     re-parented anywhere with NO geometry fix-up. There is no need to rebuild
  //     the tree into per-layer bucket groups.
  //  2. EVERY APPEARANCE-CHANGING WRAPPER THE WALKER EMITS IS ITSELF A STACKING-
  //     CONTEXT CREATOR - opacity, clip-path, mix-blend-mode, filter, rotate,
  //     matrix. So a hoist terminates at each of them by construction, and the
  //     ONLY wrapper a deferred unit can be lifted out of is the overflow-clip
  //     group, which is a single re-appliable `clip-path` attribute (ctx.clips).
  //
  // `appendChild` on an already-parented node MOVES it, so no bucket groups are
  // created and the emitted node count is unchanged apart from hoist clip
  // wrappers. Cost: one pointer per deferred element (~300 on the gallery
  // fixture, against a 2.2 MB output) and no second pass or second tree, so the
  // 200-node cooperative yield is untouched.
  //
  // Given away deliberately: the emitted tree is no longer monotonic during the
  // walk, so streaming serialisation is impossible and a mid-walk throw leaves
  // orphaned detached subtrees. Neither matters today (one serialise at the end;
  // the walk already throws on failure), but both are now foreclosed.

  /** One deferred paint unit: the <g> (possibly wrapped in re-applied clips) and
   *  the used z-index it sorts by. */
  interface PaintUnit { z: number; g: Element }
  /** One stacking context, alive while its element's subtree is being walked. */
  interface ScFrame {
    /** Where deferred units land - the context element's contentG. */
    content: Element;
    /** Last own-paint node when contentG === g, else null. See the finalisation
     *  block for why layer 2 cannot just insert at firstChild. */
    anchor: ChildNode | null;
    neg: PaintUnit[];   // section E.2 step 3 - negative z, most negative first
    z0: PaintUnit[];    // section E.2 step 8 - positioned, z-index auto|0, TREE order
    pos: PaintUnit[];   // section E.2 step 9 - positive z, least positive first
  }
  /** What a child inherits. `frame === null` ⇒ the flag is off ⇒ every append is
   *  the append this walker has always done. */
  interface PaintCtx {
    frame: ScFrame | null;
    /** Ids of overflow clipPaths emitted between `frame`'s element and here - a
     *  hoisted unit must carry them or it escapes a clip it has today. */
    clips: string[];
    /** Intersection of every ancestor overflow box, in root coordinates. A node
     *  that misses it entirely paints nothing on screen, so it is not emitted - 
     *  the cheapest form of clip reduction, since it removes the node AND the
     *  clip work that would have hidden it. Null means unbounded. */
    clipBox?: Rect | null;
    /** Union of the boxes actually painted beneath the nearest clip candidate.
     *  Filled during the walk so the decision "is this clip doing any work?" can
     *  be made from measurements rather than guessed up front. */
    bounds?: Bounds | null;
  }

  /** A box in root coordinates. */
  interface Rect { x: number; y: number; w: number; h: number }
  /** A mutable union accumulator. Empty until something expands it. */
  interface Bounds { minX: number; minY: number; maxX: number; maxY: number; any: boolean }
  const newBounds = (): Bounds => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, any: false });
  const expand = (b: Bounds | null | undefined, x: number, y: number, w: number, h: number): void => {
    if (!b) return;
    b.minX = Math.min(b.minX, x); b.minY = Math.min(b.minY, y);
    b.maxX = Math.max(b.maxX, x + w); b.maxY = Math.max(b.maxY, y + h);
    b.any = true;
  };
  const intersectRect = (a: Rect | null | undefined, b: Rect): Rect => {
    if (!a) return b;
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    return { x, y, w: Math.min(a.x + a.w, b.x + b.w) - x, h: Math.min(a.y + a.h, b.y + b.h) - y };
  };

  const stackingOrder = opts.stackingOrder === true;
  /** What every element classifies as when the flag is off: in-flow, no context.
   *  Shared constant so the OFF path allocates nothing per node. */
  const DOM_ORDER_ROLE: StackingRole = { createsContext: false, reason: '', layer: 3, z: 0, order: 0 };
  /** Top layer (`<dialog open>` shown modally, an open popover). Guarded because
   *  `:popover-open` throws in engines that don't know the selector.
   *
   *  KNOWN LIMITATION: this only makes a top-layer box a stacking CONTEXT so its
   *  internals order correctly. It does NOT lift it above the rest of the
   *  document (HTML section top layer) and `::backdrop` is not modelled at all
   *  (pseudoDescriptor sees only ::before/::after). On the measured fixtures
   *  that is the single largest remaining paint-order defect - ~36 points of
   *  local-gallery's loss, against ~2 points for everything this flag fixes - 
   *  and it is a separate milestone. */
  const topLayer = (el: Element): boolean => {
    try { return typeof el.matches === 'function' && el.matches(':modal, :popover-open'); }
    catch { return false; }
  };

  /** Append `unit` where CSS says it paints. Returns a handle so a caller that
   *  later abandons the element (the zero-area clip-path early return) can undo
   *  the deferral; null when the unit went straight into `parentG`. */
  const place = (
    unit: Element, role: StackingRole, ctx: PaintCtx, parentG: Element, direct?: boolean,
  ): { list: PaintUnit[]; entry: PaintUnit } | null => {
    // `direct` is the transform re-entry (see its call sites); `!ctx.frame` is
    // the flag being off; layers 3/4 are in-flow content, which paints exactly
    // where DOM order puts it. All three are byte-for-byte the old behaviour.
    if (direct || !ctx.frame || role.layer === 3 || role.layer === 4) { parentG.appendChild(unit); return null; }
    // Re-apply every overflow clip crossed by the hoist, outermost first. The
    // <clipPath> already lives in <defs> with a stable id in ROOT coordinates,
    // so this costs one attribute and no geometry.
    //
    // KNOWN LIMITATION (CSS 2.1 section 11.1.1): an absolutely-positioned box is NOT
    // clipped by a non-positioned ancestor's `overflow`, and `fixed` escapes
    // almost all clips. We re-apply every crossed clip anyway. Deliberate: that
    // is exactly what the walker does today, and getting the containing-block
    // chain wrong UNCLIPS content, which is a far worse failure than
    // mis-ordering. Revisit only with a fixture that demonstrates the escape.
    let top: Element = unit;
    for (let i = ctx.clips.length - 1; i >= 0; i--) {
      const wrap = document.createElementNS(NS, 'g');
      wrap.setAttribute('clip-path', `url(#${ctx.clips[i]})`);
      wrap.appendChild(top);
      top = wrap;
    }
    const list = role.layer === 2 ? ctx.frame.neg : role.layer === 6 ? ctx.frame.z0 : ctx.frame.pos;
    const entry: PaintUnit = { z: role.z, g: top };
    list.push(entry);
    return { list, entry };
  };

  /**
   * Paint a form control's contents: the text it displays, or the geometry of a
   * widget the UA draws.
   *
   * Text is NOT laid out here. A throwaway mirror is positioned over the control's
   * content box, given its font and alignment, and walked with the same
   * emitInlineTextSvg every other block goes through - so wrapping, direction,
   * vertical centring and line boxes come from the browser. Reimplementing them
   * would be a second, worse CSS. The mirror lives for one await and is removed in a
   * finally, including when the text pass throws.
   */
  async function emitControlPaint(el: Element, tag: string, style: CSSStyleDeclaration, contentG: Element): Promise<void> {
    const d = describeControl(el);
    if (!d) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;

    const num = (k: string) => Number.parseFloat((style as unknown as Record<string, string>)[k] || '') || 0;
    const insetL = num('borderLeftWidth') + num('paddingLeft');
    const insetT = num('borderTopWidth') + num('paddingTop');
    const insetR = num('borderRightWidth') + num('paddingRight');
    const insetB = num('borderBottomWidth') + num('paddingBottom');
    const cw = Math.max(0, r.width - insetL - insetR);
    const ch = Math.max(0, r.height - insetT - insetB);
    if (cw <= 0 || ch <= 0) return;
    const cx = r.left + insetL, cy = r.top + insetT;

    if (isWidgetControl(d)) { emitWidgetControl(el, d, style, contentG, r); return; }

    const ct = controlText(d);
    if (!ct) return;

    // Clip to the content box. This is the section 7 "only when necessary" case: an
    // over-long option label or an unscrolled textarea genuinely does not paint
    // past the field on screen, and there is no geometry trick that crops text.
    const clipId = `fcctl-${++uid}`;
    const clip = document.createElementNS(NS, 'clipPath');
    clip.setAttribute('id', clipId);
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    const cr = document.createElementNS(NS, 'rect');
    cr.setAttribute('x', String(n2(cx - rootRect.left))); cr.setAttribute('y', String(n2(cy - rootRect.top)));
    cr.setAttribute('width', String(n2(cw))); cr.setAttribute('height', String(n2(ch)));
    clip.appendChild(cr);
    defs.appendChild(clip);
    const cg = document.createElementNS(NS, 'g');
    cg.setAttribute('clip-path', `url(#${clipId})`);
    contentG.appendChild(cg);

    const mirror = document.createElement('div');
    const ms = mirror.style;
    ms.position = 'fixed';
    ms.left = `${cx}px`; ms.top = `${cy}px`;
    ms.width = `${cw}px`; ms.height = `${ch}px`;
    ms.margin = '0'; ms.padding = '0'; ms.border = '0';
    ms.pointerEvents = 'none';
    // Behind everything and non-interactive: the mirror exists for one layout pass,
    // but an export can be triggered from a visible page and must not flash.
    ms.zIndex = '-2147483648'; ms.opacity = '0';
    for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant',
                     'fontFeatureSettings', 'letterSpacing', 'wordSpacing', 'textTransform',
                     'textAlign', 'direction', 'lineHeight', 'fontStretch'] as const) {
      (ms as unknown as Record<string, string>)[k] = (style as unknown as Record<string, string>)[k] || '';
    }
    // The ::placeholder colour is a real computed style in Chromium; falling back to
    // the control's own colour is wrong-but-visible rather than invisible.
    const phColor = ct.placeholder ? (window.getComputedStyle(el, '::placeholder').color || '') : '';
    ms.color = phColor || style.color;
    ms.overflow = 'hidden';
    const inner = document.createElement('span');
    inner.style.display = 'block';
    if (ct.multiline) {
      inner.style.whiteSpace = 'pre-wrap';
      inner.style.wordBreak = (style as unknown as Record<string, string>).wordBreak || 'normal';
      // Reproduce the scrolled position: a textarea scrolled halfway shows its
      // middle, and drawing from the top would show text that isn't on screen.
      inner.style.marginTop = `${-(el as HTMLElement).scrollTop}px`;
    } else {
      // Single-line inputs and selects centre their text in the content box.
      ms.display = 'flex'; ms.alignItems = 'center';
      inner.style.whiteSpace = 'pre';
      inner.style.marginLeft = `${-(el as HTMLElement).scrollLeft}px`;
      inner.style.flex = '1 1 auto';
    }
    inner.textContent = ct.text;
    mirror.appendChild(inner);
    document.body.appendChild(mirror);
    try {
      await emitInlineTextSvg(NS, inner, window.getComputedStyle(inner), rootRect, cg, vectorText);
    } finally { mirror.remove(); }
    if (!cg.childNodes.length) cg.remove();
  }

  /**
   * Checkbox, radio and range.
   *
   * Only for UA-drawn widgets (`appearance` still native). When a stylesheet has set
   * `appearance: none` - which every control in this app does - the tick, dot and
   * track are ordinary CSS the walker already paints, and drawing a second widget on
   * top would be the wrong answer twice.
   */
  function emitWidgetControl(el: Element, d: ControlDesc, style: CSSStyleDeclaration, contentG: Element, r: DOMRect): void {
    const appearance = (style as unknown as Record<string, string>).appearance
      || (style as unknown as Record<string, string>).webkitAppearance || 'auto';
    if (appearance === 'none') return;
    const type = (d.type || '').toLowerCase();
    const x = r.left - rootRect.left, y = r.top - rootRect.top, w = r.width, h = r.height;
    const accent = parseCssColorFull(style.accentColor === 'auto' ? '' : style.accentColor) ?? [26, 115, 232, 1] as Rgba;
    const acc = `rgb(${accent[0]},${accent[1]},${accent[2]})`;
    const add = (e: Element) => contentG.appendChild(e);
    const rect = (rx: number, ry: number, rw: number, rh: number, fill: string, rad: number, stroke?: string) => {
      const q = document.createElementNS(NS, 'rect');
      q.setAttribute('x', String(n2(rx))); q.setAttribute('y', String(n2(ry)));
      q.setAttribute('width', String(n2(rw))); q.setAttribute('height', String(n2(rh)));
      if (rad) { q.setAttribute('rx', String(n2(rad))); q.setAttribute('ry', String(n2(rad))); }
      q.setAttribute('fill', fill);
      if (stroke) { q.setAttribute('stroke', stroke); q.setAttribute('stroke-width', '1'); }
      return q;
    };

    if (type === 'checkbox' || type === 'radio') {
      // An approximation of the platform widget, not a copy of it: the real one is
      // drawn by the compositor with no CSS to read. Blank was the alternative, and a
      // recognisable checkbox is closer to what the reader saw than an empty square.
      const round = type === 'radio' ? Math.min(w, h) / 2 : Math.min(2, Math.min(w, h) / 4);
      add(rect(x, y, w, h, d.checked ? acc : '#fff', round, d.checked ? undefined : '#767676'));
      if (d.checked && type === 'checkbox') {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', `M${n2(x + w * 0.22)} ${n2(y + h * 0.52)}L${n2(x + w * 0.42)} ${n2(y + h * 0.72)}L${n2(x + w * 0.78)} ${n2(y + h * 0.3)}`);
        p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#fff');
        p.setAttribute('stroke-width', String(n2(Math.max(1.5, Math.min(w, h) * 0.14))));
        p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
        add(p);
      } else if (d.checked) {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', String(n2(x + w / 2))); c.setAttribute('cy', String(n2(y + h / 2)));
        c.setAttribute('r', String(n2(Math.min(w, h) * 0.22)));
        c.setAttribute('fill', '#fff');
        add(c);
      }
      return;
    }

    if (type === 'range') {
      const frac = rangeFraction(d);
      const th = Math.max(3, Math.min(4, h * 0.25));
      const ty = y + (h - th) / 2;
      add(rect(x, ty, w, th, '#c4c4c4', th / 2));
      if (frac > 0) add(rect(x, ty, w * frac, th, acc, th / 2));
      const rr = Math.min(h, 14) / 2;
      const c = document.createElementNS(NS, 'circle');
      // The thumb's centre travels between its own radii, not the full track.
      c.setAttribute('cx', String(n2(x + rr + (w - 2 * rr) * frac)));
      c.setAttribute('cy', String(n2(y + h / 2)));
      c.setAttribute('r', String(n2(rr)));
      c.setAttribute('fill', acc);
      add(c);
    }
  }

  async function visitSvgNode(
    el: any, parentG: Element, ctx: PaintCtx,
    o?: { forceContext?: boolean; placeDirect?: boolean },
  ): Promise<void> {
    if (el.nodeType !== 1) return;
    if (++nodesWalked % YIELD_NODES === 0) {
      opts.onProgress?.(Math.min(nodesWalked, totalNodes), totalNodes);
      opts.signal?.throwIfAborted();      // the yield is what lets a cancel be seen at all
      await new Promise<void>((r) => setTimeout(r));         // unblock the UI thread
    }
    const tag = el.tagName.toLowerCase();
    if (tag === 'style' || tag === 'script') return;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    // A closed <details> still LAYS OUT its content - Chrome skips it at paint time
    // via ::details-content, which computed style does not expose (display, visibility
    // and content-visibility all read "visible" on the hidden subtree, and it reports a
    // real getBoundingClientRect). So the walker drew it: the export preflight card on
    // /info/authoring-tools rendered its collapsed Format/Size rows straight through
    // the buttons below it. `content-visibility: hidden` set by an author is the same
    // class of skip, and is caught here too.
    if (isPaintSkipped(el, style)) return;
    const opacity = parseFloat(style.opacity ?? '1');
    if (opacity === 0) return;

    // `display: contents` generates NO box of its own (CSS Display 3 section 3.1: the element
    // is replaced by its contents for layout). getBoundingClientRect() is therefore
    // 0x0, and the `rect.width < 0.5` guard below would drop the element AND its whole
    // subtree - content the reader plainly sees.
    //
    // The gallery is exactly this shape: `.gallery-topbar` is a display:contents
    // wrapper whose children are the fixed nav clusters, so every vector shot of the
    // gallery came back with NO top navigation. `hasOwnBox()` already returns true for
    // contents on the strength of "visitSvgNode recurses, so it is included rather than
    // dropped" - this is the line that made that comment untrue.
    //
    // Paint nothing for the box that does not exist, and let the children paint into
    // this element's parent group with its context, which is where CSS puts them.
    // Own-box children only: a contents wrapper's inline TEXT already belongs to the
    // parent's inline walk, which descends through wrappers and stops at own-box
    // elements - so nothing is lost and nothing double-paints.
    if (style.display === 'contents') {
      for (const child of renderedChildren(el)) {
        if (hasOwnBox(child)) await visitSvgNode(child, parentG, ctx);
      }
      return;
    }

    // Where does CSS say this element's paint unit goes? One pure table lookup
    // off the style we already fetched (bridge/stacking-order.ts). The parent's
    // display is only needed for the flex/grid-item rule, so it is fetched ONLY
    // when a non-auto z-index makes that rule reachable - 70 of 992 elements on
    // the gallery fixture, rather than a second getComputedStyle per node.
    const role: StackingRole = stackingOrder
      ? stackingRole(
          style as unknown as Parameters<typeof stackingRole>[0],
          (style.zIndex && style.zIndex !== 'auto' && el.parentElement)
            ? window.getComputedStyle(el.parentElement).display : '',
          topLayer(el),
        )
      : DOM_ORDER_ROLE;
    // The root of the walk is always a stacking context (Appendix E: the root
    // element establishes one), and so is a transform re-entry - see below.
    const createsCtx = stackingOrder && (role.createsContext || el === node || o?.forceContext === true);

    // CSS rotate(): neutralise it, walk the axis-aligned subtree, then wrap the
    // whole thing in an SVG rotation about the transform-origin (faithful in SVG,
    // unlike the AABB fallback). Additive - no-op for every unrotated element.
    const rotDeg = pureRotationDeg(style.transform);
    if (rotDeg) {
      // Neutralise through the guarded helper, never by hand: a RUNNING transform
      // animation/transition outranks any inline declaration, and the un-neutralised
      // re-entry that follows is what turned one gallery tile into 2 136 nested
      // groups (plans/104 section 9 P3.1 - see bridge/transform-neutralise.ts). `null` means
      // the transform survived and nothing was touched, so this element falls through
      // to the AABB path below, whose rect already carries the rotation.
      const restore = neutraliseTransform(el, neutralise, warnTransform);
      if (restore) {
        try {
          const unrot = el.getBoundingClientRect();   // reading forces the reflow
          const pivot = rotationPivot(style, unrot, rootRect);
          const gRot = document.createElementNS(NS, 'g');
          gRot.setAttribute('transform', `rotate(${rotDeg.toFixed(4)} ${pivot.x.toFixed(3)} ${pivot.y.toFixed(3)})`);
          // gRot is the paint unit for this element (the rotation wraps everything
          // it emits), so IT is what gets deferred.
          place(gRot, role, ctx, parentG);
          // forceContext + placeDirect exist ONLY for this re-entry, and they are
          // both about the same piece of hidden state: `el.style.transform` has just
          // been set to 'none', so the recursive call's getComputedStyle reports
          // `transform: none`.
          //   • forceContext - without it the element stops looking like a stacking
          //     context (CSS Transforms 1 section 3) on the way in, and its descendants
          //     would hoist straight out of a rotation that is about to be applied.
          //   • placeDirect - without it `g` would be deferred a SECOND time into
          //     the same frame, leaving gRot empty and painting the element twice
          //     over at the wrong depth.
          // Delete either one and the failure is silent. They are essential.
          await visitSvgNode(el, gRot, { frame: ctx.frame, clips: ctx.clips }, { forceContext: true, placeDirect: true });
        } finally { restore(); }
        return;
      }
    }

    // General 2-D transform (rotate+scale, skew, arbitrary matrix) that isn't a pure
    // rotation: neutralise it, walk the untransformed subtree, then wrap in an SVG
    // matrix() about the transform-origin. 3-D/perspective returns null from
    // parseCssMatrix and falls through to the AABB path below.
    //
    // A pure SCALE takes this branch too, even though it is axis-aligned and
    // getBoundingClientRect already carries it. That was the reasoning before, and it
    // is only half true: a client rect is scaled, but a COMPUTED LENGTH is not. Walk a
    // scaled subtree on the AABB path and every box lands correctly while every length
    // read from getComputedStyle - font-size first, but equally border-radius, border
    // width, shadow offset and blur - is left 1/s too big. Measured on the Design
    // docs shot: a 1080px artboard displayed at 868 (`matrix(0.8037…)`) exported its
    // headline 1/0.8037 = 24.4% oversize, overflowing the card it fits on screen.
    // Neutralising instead makes the subtree self-consistent - every length and every
    // rect in the same unscaled space - and the scale goes on once, at the top.
    // Pure TRANSLATE stays on the AABB path: it moves boxes without distorting lengths.
    const mtx = pureRotationDeg(style.transform) === 0 ? parseCssMatrix(style.transform) : null;
    const scaled = Boolean(mtx && isAxisAlignedMat(mtx)
      && (Math.abs(mtx.a - 1) > 1e-4 || Math.abs(mtx.d - 1) > 1e-4));
    if (mtx && (!isAxisAlignedMat(mtx) || scaled)) {
      // Same guarded neutralise as the rotation branch - read its comment.
      const restore = neutraliseTransform(el, neutralise, warnTransform);
      if (restore) {
        try {
          const unrot = el.getBoundingClientRect();
          const pivot = rotationPivot(style, unrot, rootRect);
          const gM = document.createElementNS(NS, 'g');
          gM.setAttribute('transform', matToSvg(matAboutPivot(mtx, pivot.x, pivot.y)));
          place(gM, role, ctx, parentG);
          // Same forceContext/placeDirect contract as the rotation branch above - 
          // see the comment there before touching either flag.
          await visitSvgNode(el, gM, { frame: ctx.frame, clips: ctx.clips }, { forceContext: true, placeDirect: true });
        } finally { restore(); }
        return;
      }
    }

    // ── A real 3-D pose: per-element raster, never the AABB (plans/104 section 12 Q2) ──
    //
    // SVG has no perspective transform, so `parseCssMatrix` refuses a `matrix3d` that
    // carries a perspective row and BOTH branches above decline. Falling through from
    // there to the AABB path is not a lossy approximation, it is a different picture:
    // `neutraliseTransform` writes `transform: none` and the subtree comes out
    // axis-aligned, stretched to fill the projected bounding box - a tilted card
    // exported as a `<rect>`, with no notice (measured: two cards under `rx −45`,
    // 495 B of SVG, zero `matrix3d`, zero `<image>`, two upright rects).
    //
    // section 12 Q2 is the decision, and spike S2 cleared it unreserved: keep every untilted
    // layer vector and embed a per-box captured raster for the tilted ones, with the
    // amber notice (`tool-actions.ts`'s fidelity row). On Chromium the capture is
    // indistinguishable from the preview - flat-region diff 0.012–0.045/255, ink IoU
    // 0.985–0.993 across 20 poses to 85°, and text comes out marginally SHARPER than
    // the live compositor's filtered layer. `rasterizePosedNodeToDataUrl` is the
    // wrapper-shaped capture S2 said this needs; `effectSpillCss` is the padding it
    // said is not optional (up to 42 px for a drop-shadow on a tilted box).
    //
    // Children are NOT walked afterwards: the image IS the subtree's picture, and
    // emitting the descendants again would paint them a second time, untilted.
    if (opts.rasterFallback !== false && isNonAffineTransform(style.transform)) {
      const pxScale = scaleX * Math.max(1, d.dpi / CSS_DPI);
      const posedShot = await rasterizePosedNodeToDataUrl(
        el as HTMLElement, pxScale, opts._imprintSink, effectSpillCss(style),
      );
      if (posedShot) {
        tiltedRasters++;
        const gT = document.createElementNS(NS, 'g');
        place(gT, role, ctx, parentG);
        const img = document.createElementNS(NS, 'image');
        img.setAttribute('href', posedShot.dataUrl);
        img.setAttribute('x', String(n2(posedShot.x - rootRect.left)));
        img.setAttribute('y', String(n2(posedShot.y - rootRect.top)));
        img.setAttribute('width', String(n2(posedShot.w)));
        img.setAttribute('height', String(n2(posedShot.h)));
        img.setAttribute('preserveAspectRatio', 'none');
        gT.appendChild(img);
        return;
      }
      // Capture refused (a corner behind the eye, dom-to-image failed). Say so, then
      // fall through - an AABB rectangle is wrong, but it is what this walker did
      // before section 12 Q2 and it is better than a hole.
      _host?.log?.('warn', `svg: tilted <${tag}> could not be captured; falling back to its bounding box`);
    }

    const rect = el.getBoundingClientRect();
    if (rect.width < 0.5 || rect.height < 0.5) return;

    const x = rect.left - rootRect.left;
    const y = rect.top  - rootRect.top;
    const w = rect.width;
    const h = rect.height;

    // Entirely outside every ancestor's overflow box: it paints nothing on screen, so
    // it is not emitted. Cheapest possible clip reduction - it removes the node and
    // its whole subtree rather than emitting them and then hiding them. The rows
    // scrolled out of a long list are the case that pays.
    // ...except when its containing block escapes that box. CSS 2.1 section 11.1.1: an
    // absolutely-positioned element is NOT clipped by a non-positioned ancestor's
    // overflow, and `fixed` escapes almost every clip - such a node is genuinely
    // visible outside the box, and dropping it would delete content the reader saw.
    // Erring toward keeping is the same call the hoist path makes a few lines up:
    // an over-clipped node is a bug, an un-clipped node is a smaller one.
    const escapesClip = style.position === 'absolute' || style.position === 'fixed';
    const cb = escapesClip ? null : ctx.clipBox;
    if (cb && (cb.w <= 0 || cb.h <= 0 || x + w <= cb.x || y + h <= cb.y || x >= cb.x + cb.w || y >= cb.y + cb.h)) return;
    // Report the box up so the nearest clip candidate can tell whether its clip does
    // any work. Done before any early return below, so a node that ends up rastered
    // or skipped still counts toward its ancestor's decision.
    expand(ctx.bounds, x, y, w, h);

    const g = document.createElementNS(NS, 'g');
    // ── Layer identity passthrough (opts.layerIds - plans/104 section 7) ────────────
    //
    // The walker emits one <g> per element in ROOT coordinates and has always
    // stamped ZERO identity on it, so a Lolly screenshot imported back in was one
    // undifferentiated scene. This is the one point that changes: where the walked
    // element already carries `data-box-id` (design's own boxes,
    // template.html), the group carries it out, and `enumerateSvgLayers` reports it
    // as `layer.boxId` - so a lift lands on real UI boundaries instead of on
    // whatever the markup happened to group.
    //
    // What travels is an ID, never a NAME: `data-box-id` is a generated index the
    // canvas mints (freshId), so the ingest-time PII strip that removes
    // `data-name`/`inkscape:label` is not undone by an export.
    //
    // OPT-IN, and the default path must stay byte-identical: with the flag absent
    // this block cannot run, so no attribute is added, no serialisation order
    // moves, and every shipping tool export is the same bytes it was. Pinned by
    // `export-layer-ids.test.ts`, which renders the same DOM both ways.
    if (opts.layerIds) {
      const boxId = el.getAttribute('data-box-id');
      if (boxId) g.setAttribute('data-box-id', boxId);
    }
    if (opacity < 0.999) g.setAttribute('opacity', opacity.toFixed(4));
    const placement = place(g, role, ctx, parentG, o?.placeDirect);

    // clip-path → vector <clipPath> so the node stays vector instead of rasterising.
    // circle()/ellipse()/inset()/polygon() all route through the shared parseClipShape
    // (element-local px → offset to root coords). clipHandled is false only for a shape
    // we couldn't vectorise (url()/path(), or a failed basic shape) - the escape-hatch
    // below then rasterises it. A polygon with <3 points still counts as handled (never
    // rasters - matches prior behaviour). The PDF walker mirrors this exactly.
    let clipHandled = true;
    const cp = style.clipPath || (style as any).webkitClipPath;
    if (cp && cp !== 'none') {
      const clipRes = emitClip(cp, x, y, w, h, g);
      // Zero area: the browser paints nothing here, so neither do we. Drop the
      // group we just appended and stop - no clip, no children, no raster.
      // UNPLACE: in stacking mode `g` was never attached to the DOM, it was
      // parked in a frame array, so `.remove()` alone would leave an empty (or
      // clip-wrapped) group to be appended at finalisation. Splice by IDENTITY
      // rather than popping the tail - no child has been walked yet so it IS the
      // last entry, but relying on that would rot the moment anything is added
      // between the two points. The arrays are tiny.
      if (clipRes === 'empty') {
        if (placement) {
          const i = placement.list.indexOf(placement.entry);
          if (i >= 0) placement.list.splice(i, 1);
        } else { g.remove(); }
        return;
      }
      clipHandled = clipRes === 'ok' || cp.trim().indexOf('polygon(') === 0;
    }

    // mix-blend-mode: SVG carries it natively, so blend the vector content on `g`
    // rather than rasterising it (SVG output only; PDF/EMF/EPS still raster it).
    if (style.mixBlendMode && style.mixBlendMode !== 'normal') {
      g.setAttribute('style', `mix-blend-mode:${style.mixBlendMode}`);
    }

    // filter: drop-shadow(…) → keep vector via a chain of <feDropShadow> on `g`
    // (SVG only; other filter functions can't be reproduced and fall to the raster
    // escape-hatch below, which is why the dropShadow cap is gated on this parse).
    // <img>/<svg> filters are baked into the bitmap / handled by their own paths.
    const dropShadows = (tag !== 'img' && tag !== 'svg') ? parseDropShadowFilter(style.filter) : null;
    if (dropShadows) {
      const fId = `fcds-${++uid}`;
      defs.appendChild(buildDropShadowFilterEl(NS, dropShadows, fId, { x, y, w, h }));
      g.setAttribute('filter', `url(#${fId})`);
    }

    // ── Border radius (CSS corner-overlap clamped → pill, not ellipse) ───────
    const { radii, uniform } = resolveRadii(style, w, h);
    const hasRadius = uniform ? (uniform[0] > 0 || uniform[1] > 0) : true;

    // ── Box shadow ────────────────────────────────────────────────────────────
    // Each outer shadow is the box's own shape, offset + grown by spread, filled
    // with the shadow colour and Gaussian-blurred, painted BEHIND the background.
    // EMF/EPS/DXF (opts.noBoxShadow) have no blur primitive, and used to get no shadow
    // at all rather than an ugly hard-edged offset shape. They can have one: a blur is
    // reproducible as concentric bands (section 13), and for a format with no alpha the bands
    // have to be non-overlapping RINGS at absolute coverage - svg-ir flattens every
    // shape against the page background independently, so overlapping increments never
    // accumulate and come out far too light.
    if (opts.noBoxShadow && tag !== 'img' && tag !== 'svg') {
      for (const sh of parseBoxShadow(style.boxShadow).reverse()) {
        if (sh.inset) continue;
        const col = parseCssColorFull(sh.color);
        if (!col) continue;
        const fillCol = `rgb(${col[0]},${col[1]},${col[2]})`;
        const shapeAt = (t: number) => {
          const sw = Math.max(0, w + 2 * (sh.spread + t)), shh = Math.max(0, h + 2 * (sh.spread + t));
          if (sw <= 0 || shh <= 0) return '';
          return roundedRectPath(x + sh.x - sh.spread - t, y + sh.y - sh.spread - t, sw, shh,
            insetCorners(radii, -(sh.spread + t)));
        };
        const rings = gaussianShadowRings(sh.blur, col[3]);
        if (!rings.length) {
          // Hard shadow: one shape, exact, no approximation involved.
          const d = shapeAt(0);
          if (!d) continue;
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', d);
          p.setAttribute('fill', fillCol);
          if (col[3] < 1) p.setAttribute('fill-opacity', String(col[3]));
          g.appendChild(p);
          continue;
        }
        // NOT clipped out of the border box, unlike the compositing path. A clipPath
        // is no use here (svg-ir skips those, so EMF/EPS would ignore it), and cutting
        // the box out of the innermost ring by hand measured WORSE - the shadow is
        // offset, so an un-offset hole leaves a gap along its own top edge. It costs
        // nothing in the target formats: svg-ir flattens the element's background to
        // an opaque shape painted after these, which covers the area completely. Only
        // a fully transparent background would reveal it, and then there is no box to
        // cast the shadow in the first place.
        for (const ring of rings) {
          const outer = shapeAt(ring.outer);
          if (!outer) continue;
          const inner = ring.inner === null ? '' : shapeAt(ring.inner);
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', outer + inner);
          if (inner) p.setAttribute('fill-rule', 'evenodd');
          p.setAttribute('fill', fillCol);
          p.setAttribute('fill-opacity', String(Math.round(ring.alpha * 1000) / 1000));
          g.appendChild(p);
        }
      }
    }

    // Painted back-to-front so the first-listed shadow ends up on top, matching CSS.
    if (!opts.noBoxShadow && tag !== 'img' && tag !== 'svg') {
      for (const sh of parseBoxShadow(style.boxShadow).reverse()) {
        if (sh.inset) continue;   // drawn after the background, below - CSS paints it inside
        const col = parseCssColorFull(sh.color);
        if (!col) continue;
        const sw = Math.max(0, w + 2 * sh.spread);
        const sh2 = Math.max(0, h + 2 * sh.spread);
        if (sw <= 0 || sh2 <= 0) continue;
        const sRadii = insetCorners(radii, -sh.spread);   // negative inset = outset
        const fill = col[3] < 1
          ? `rgba(${col[0]},${col[1]},${col[2]},${col[3]})`
          : `rgb(${col[0]},${col[1]},${col[2]})`;
        // CSS paints an outer shadow "as if the border box were opaque" and clips it
        // away INSIDE that box (Backgrounds section 7.1.1). Painting the whole shape and
        // covering it with the background only works when the background is opaque - 
        // over a translucent panel the shadow shows straight through, which measured
        // 6.2% mean / 36% worst-pixel error against the bitmap on this app's frosted
        // surfaces.
        //
        // With no blur the hole is pure geometry: one evenodd path, shadow shape minus
        // border box, and no clip at all (so it survives EMF/EPS too). With a blur the
        // order matters - CSS blurs and THEN clips - and no amount of geometry
        // reproduces that, so this is the section 7 case where a clip is genuinely the
        // mechanism rather than a shortcut.
        // The hole is a HAIR smaller than the border box. Two antialiased edges meeting
        // exactly leaves a seam of background showing between the shadow and the box - 
        // it measured up to 13% on a single pixel line, on the very fixtures that were
        // previously exact. Half a pixel of overlap tucks the shadow under the box's
        // own edge and costs nothing anywhere else.
        //
        // …but only when it MATTERS. An opaque background hides the shadow beneath it
        // by simply painting over it, exactly as before, and that path measured exact.
        // Cutting a hole there instead leaves two independently antialiased edges
        // meeting along the border - a seam worth up to 13% on a single pixel line.
        // So the hole is cut only when the background cannot do the hiding.
        const bgAlpha = parseCssColorFull(style.backgroundColor)?.[3] ?? 0;
        const needsHole = bgAlpha < 0.999;
        let shape: Element;
        if (!needsHole) {
          shape = makeRoundedFill(NS, x + sh.x - sh.spread, y + sh.y - sh.spread,
            sw, sh2, sRadii, uniformRadius(sRadii), fill);
        } else if (sh.blur <= 0) {
          const ring = document.createElementNS(NS, 'path');
          ring.setAttribute('d',
            roundedRectPath(x + sh.x - sh.spread, y + sh.y - sh.spread, sw, sh2, sRadii) +
            roundedRectPath(x, y, w, h, radii));
          ring.setAttribute('fill-rule', 'evenodd');
          ring.setAttribute('fill', fill);
          shape = ring;
        } else {
          shape = makeRoundedFill(NS, x + sh.x - sh.spread, y + sh.y - sh.spread,
            sw, sh2, sRadii, uniformRadius(sRadii), fill);
          const holeId = `fcshclip-${++uid}`;
          const hole = document.createElementNS(NS, 'clipPath');
          hole.setAttribute('id', holeId);
          hole.setAttribute('clipPathUnits', 'userSpaceOnUse');
          const cut = document.createElementNS(NS, 'path');
          const cpad = sh.blur * 3 + Math.abs(sh.x) + Math.abs(sh.y) + Math.abs(sh.spread) + 8;
          cut.setAttribute('d',
            `M${n2(x - cpad)} ${n2(y - cpad)}H${n2(x + w + cpad)}V${n2(y + h + cpad)}H${n2(x - cpad)}Z` +
            roundedRectPath(x, y, w, h, radii));
          cut.setAttribute('clip-rule', 'evenodd');
          hole.appendChild(cut);
          defs.appendChild(hole);
          shape.setAttribute('clip-path', `url(#${holeId})`);
        }
        if (sh.blur > 0) {
          const fId = `shadow-${++uid}`;
          const filt = document.createElementNS(NS, 'filter');
          filt.setAttribute('id', fId);
          // userSpaceOnUse region padded for the blur so it isn't clipped.
          const pad = sh.blur * 1.5 + Math.abs(sh.spread) + 8;
          filt.setAttribute('filterUnits', 'userSpaceOnUse');
          filt.setAttribute('x',      String(x + sh.x - sh.spread - pad));
          filt.setAttribute('y',      String(y + sh.y - sh.spread - pad));
          filt.setAttribute('width',  String(sw + 2 * pad));
          filt.setAttribute('height', String(sh2 + 2 * pad));
          const fe = document.createElementNS(NS, 'feGaussianBlur');
          fe.setAttribute('in', 'SourceGraphic');
          fe.setAttribute('stdDeviation', String(sh.blur / 2));
          filt.appendChild(fe);
          defs.appendChild(filt);
          shape.setAttribute('filter', `url(#${fId})`);
        }
        g.appendChild(shape);
      }
    }

    // ── Rasterise escape-hatch: node uses CSS the walker can't express ──────────
    // Embed the node as an <image> instead of silently dropping the effect. Placed
    // AFTER the box-shadow block so an outset shadow still paints behind the raster,
    // and BEFORE background/children so the raster replaces them (dom-to-image already
    // captured the whole subtree). Returns on success. The element's own opacity is
    // neutralised for the capture (like the rotation branch neutralises transform) so
    // it isn't applied twice - once baked into the PNG and again via g's opacity.
    // Falls through to the vector walk if raster fails.
    // Set when the escape hatch below captured this element's own paint as an
    // <image>; the vector background/border emission then stands down so the two
    // don't double-paint.
    let ownPaintRastered = false;
    // ── CSS filter ───────────────────────────────────────────────────────────
    // Every CSS shorthand filter is spec-defined as an equivalent SVG filter, so the
    // chain is emitted rather than dropped (49 filtered elements on the gallery
    // fixture used to lose theirs silently). drop-shadow is excluded - the walker
    // draws those as geometry, which survives EMF/EPS where a filter would not.
    if (!opts.noBoxShadow) {
      const fv = style.filter || '';
      if (fv && fv !== 'none' && !isDropShadowOnly(fv)) {
        const prims = parseCssFilter(fv);
        if (prims && prims.length) {
          const fId = `fcflt-${++uid}`;
          const filt = document.createElementNS(NS, 'filter');
          filt.setAttribute('id', fId);
          // Room for a blur to spread past the box, and sRGB to match CSS, which
          // applies these in sRGB rather than SVG's linearRGB default.
          const spread = prims.reduce((n, p) => p.kind === 'blur' ? Math.max(n, p.stdDeviation) : n, 0);
          const pad = spread * 3 + 8;
          filt.setAttribute('filterUnits', 'userSpaceOnUse');
          filt.setAttribute('x', String(n2(x - pad))); filt.setAttribute('y', String(n2(y - pad)));
          filt.setAttribute('width', String(n2(w + 2 * pad))); filt.setAttribute('height', String(n2(h + 2 * pad)));
          filt.setAttribute('color-interpolation-filters', 'sRGB');
          for (const pr of prims) filt.appendChild(filterPrimitiveEl(NS, pr));
          defs.appendChild(filt);
          g.setAttribute('filter', `url(#${fId})`);
        }
      }
    }

    // ── backdrop-filter: blur() ─────────────────────────────────────────────
    // SVG has no primitive that reads what is painted behind an element, so the
    // backdrop has to be reconstructed: take the content already emitted (at this
    // point in the walk, `rootG` IS everything behind this element), clip that copy
    // to this element's own shape, and blur it. The copy goes in first, so the
    // element's background, border and children then paint over it exactly as they
    // do on screen.
    //
    // Snapshot mode only. It duplicates geometry, which is the wrong trade for a
    // tool export, and `rasterizeNodeToDataUrl` cannot do it at all - dom-to-image
    // serialises the node into a <foreignObject>, and the backdrop is by definition
    // outside that subtree, which is why the raster hatch always got this wrong.
    const bfRaw = opts.backdropBlur === true
      ? (style.backdropFilter || (style as { webkitBackdropFilter?: string }).webkitBackdropFilter || '')
      : '';
    const bfPx = bfRaw ? parseBackdropBlurPx(bfRaw) : null;
    // The clone is expressed in root user space, so it can only be dropped into `g`
    // when nothing between `g` and the root carries a transform - otherwise the
    // rotation wrapper above would apply that transform a second time. Rotated
    // frosted panels fall through to the raster hatch, as before.
    let bfTransformed = false;
    for (let a: Element | null = g; a && a !== rootG; a = a.parentElement) {
      if (a.hasAttribute('transform')) { bfTransformed = true; break; }
    }
    // Did the reconstruction ACTUALLY run? The raster-fallback caps below must report
    // the OUTCOME, not the request: a rotated or over-cap panel skips the clone, and
    // declaring "backdrop blur is supported" there dropped the frost silently instead
    // of sending the panel to the raster hatch the comments promised it would reach.
    let bfHandled = false;
    if (bfPx !== null && bfPx > 0 && !bfTransformed && rootG.firstChild) {
      // Bound the duplication: a page-sized backdrop under many blurred pills would
      // copy the whole document once per pill. Past the cap, fall through and let the
      // raster hatch have it rather than emit tens of megabytes.
      //
      // Count DESCENDANTS, not children. The root walk runs with `frame: null`, so
      // place() appends straight to rootG and it holds exactly one child - the body
      // <g> - for the entire walk. Measuring childNodes therefore always read 1, the
      // cap never fired, and each blurred element deep-cloned the whole accumulated
      // tree it was supposed to protect against.
      const backdropNodes = rootG.getElementsByTagName('*').length;
      if (backdropNodes <= BACKDROP_MAX_NODES) {
        const bId = `fcbd-${++uid}`;
        const filt = document.createElementNS(NS, 'filter');
        filt.setAttribute('id', bId);
        // Room for the blur to spread, and clamp to sRGB so the result matches CSS,
        // which composites backdrop filters in sRGB rather than linearRGB.
        // userSpaceOnUse over the element box padded by the blur radius. The default
        // objectBoundingBox region would be relative to the whole duplicated
        // backdrop's bbox - near page-sized - making the filter far more expensive
        // than the area that actually shows through the clip.
        const bpad = bfPx * 2 + 4;
        filt.setAttribute('filterUnits', 'userSpaceOnUse');
        filt.setAttribute('x',      String(n2(x - bpad)));
        filt.setAttribute('y',      String(n2(y - bpad)));
        filt.setAttribute('width',  String(n2(w + 2 * bpad)));
        filt.setAttribute('height', String(n2(h + 2 * bpad)));
        filt.setAttribute('color-interpolation-filters', 'sRGB');
        const fe = document.createElementNS(NS, 'feGaussianBlur');
        // CSS blur(Npx) is a Gaussian with stdDeviation N/2 (Filter Effects section .
        fe.setAttribute('stdDeviation', String(n2(bfPx / 2)));
        filt.appendChild(fe);
        defs.appendChild(filt);

        const cId = `fcbdclip-${++uid}`;
        const cp = document.createElementNS(NS, 'clipPath');
        cp.setAttribute('id', cId);
        cp.setAttribute('clipPathUnits', 'userSpaceOnUse');
        cp.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, '#fff'));
        defs.appendChild(cp);

        const bd = document.createElementNS(NS, 'g');
        bd.setAttribute('clip-path', `url(#${cId})`);
        bd.setAttribute('filter', `url(#${bId})`);
        // Deep clones, not <use>: svg-ir (EMF/EPS/DXF) skips <use> outright, so a
        // referenced backdrop would silently vanish from those formats.
        for (const child of Array.from(rootG.childNodes)) bd.appendChild(child.cloneNode(true));
        g.appendChild(bd);
        bfHandled = true;
      } else {
        _host?.log?.('warn', `svg: backdrop-filter blur skipped on <${tag}> - ${backdropNodes} nodes behind it; the panel rasterises instead`);
      }
    } else if (bfRaw && bfRaw !== 'none') {
      // Rotated panel, an empty root, or a filter chain we refuse to fake. Say so at
      // warn level: this is a fidelity loss the user can act on, not a debug note.
      _host?.log?.('warn', `svg: backdrop-filter not reconstructed on <${tag}> (${bfTransformed ? 'rotated' : bfPx === null ? 'not a plain blur()' : 'nothing behind it'}); the panel rasterises instead`);
    }

    // `cssFilter: true` - this walker emitted the whole chain as a <filter> a few
    // blocks up, so a parseable filter stays vector here. It is stated rather than
    // inferred so the PDF walker, which has no filter branch, can decline it and
    // rasterise instead (see detectUnsupportedCss). KNOWN GAP, unchanged by that
    // split: under `opts.noBoxShadow` (EMF/EPS/DXF) the chain is NOT emitted, so
    // those three still lose a non-drop-shadow filter silently. Turning the cap off
    // for them would rasterise instead - an improvement for EMF/EPS, but DXF is
    // line-art only and drops raster regions outright, so it is a separate decision
    // with its own measurements, not a rider on this one.
    const rasterReason = opts.rasterFallback !== false ? detectUnsupportedCss(el, style, { blend: true, clipBasicShapes: clipHandled, dropShadow: Boolean(dropShadows), cssFilter: true, backdropBlur: bfHandled, conic: true }) : null;
    if (rasterReason) {
      const pxScale = scaleX * Math.max(1, d.dpi / CSS_DPI);
      const pxW = Math.max(2, Math.min(MAX_RASTER_PX, Math.round(w * pxScale)));
      const pxH = Math.max(2, Math.min(MAX_RASTER_PX, Math.round(h * pxScale)));
      const prevOpacity = el.style.opacity;
      el.style.opacity = '1';   // g already carries the element opacity; don't bake it in twice
      let dataUrl: string | null = null;
      // Lolly-composited subtree baked into an SVG <image> - same chokepoint as the
      // PDF escape hatch, so it honours opts.imprint too (inert until SVG is imprint-
      // enabled upstream, since the mark is size-floored and opt-in either way).
      // Element-scoped mode (page snapshots): capture only this element's own paint
      // and carry on walking its children as vector. Subtree mode (the default, and
      // what every tool export has always done) bakes the whole subtree into the PNG.
      //
      // Why it matters: the hatch fires on the ELEMENT, so one `conic-gradient` or
      // `backdrop-filter` on a top-level container used to convert an entire page to
      // a screenshot - measured 100% raster coverage on two fixtures. Scoping it turns
      // that cliff into local degradation: the offending box's paint becomes an
      // <image>, everything inside it stays text and geometry.
      //
      // Left OFF for tool exports on purpose. Splitting an element's paint from its
      // children changes compositing where the two interact (a child with
      // `mix-blend-mode` blending against its parent's background is the case), and
      // renderSvgFromHtml is the shipping SVG/PDF/EMF/EPS path for every tool in
      // every profile. Snapshot-specific behaviour stays behind the flag.
      const scoped = opts.elementScopedRaster === true;
      try { dataUrl = await rasterizeNodeToDataUrl(el as HTMLElement, pxW, pxH, undefined, opts._imprintSink, scoped); }
      finally { el.style.opacity = prevOpacity; }
      if (dataUrl) {
        _host?.log?.('info', `svg: rasterised <${tag}> ${scoped ? 'own paint' : 'subtree'} (unsupported ${rasterReason})`);
        const img = document.createElementNS(NS, 'image');
        img.setAttribute('href', dataUrl);
        img.setAttribute('x', String(n2(x)));  img.setAttribute('y', String(n2(y)));
        img.setAttribute('width', String(n2(w))); img.setAttribute('height', String(n2(h)));
        img.setAttribute('preserveAspectRatio', 'none');   // sized exactly to the box
        g.appendChild(img);
        if (!scoped) return;
        // Scoped: the raster IS this element's background/border/effect layer, so skip
        // re-emitting those in vector below (they would double-paint over the image)
        // and fall through to the children walk.
        ownPaintRastered = true;
      }
      // dataUrl == null → fall through to the normal (lossy) vector emission.
    }

    // ── Background ──────────────────────────────────────────────────────────
    // CSS paint order (bottom→top): background-color, then the background-image layer.
    // A gradient emits a true SVG gradient (alpha stops preserved); a url() image emits a
    // real <image> (vector-first - the box's text/children stay crisp, instead of
    // rasterising the whole node), sized/positioned per background-size/position and clipped
    // to the rounded box. Only when we CAN'T vectorise (conic, repeat, unresolvable) does the
    // escape-hatch above rasterise.
    const bgImgAll = ownPaintRastered ? 'none' : style.backgroundImage;
    const bgRgb = ownPaintRastered ? null : parseCssColorFull(style.backgroundColor);
    if (bgRgb) g.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, rgbaCss(bgRgb)));
    // `background-image` is a LIST: CSS lists layers top-first and paints them
    // bottom-first, and each layer carries its own size/position/repeat (those lists
    // cycle when shorter than the image list). Until 2026-07-31 the whole list was
    // handed to the gradient parsers as ONE value, and `^linear-gradient\((.+)\)$` is
    // greedy - so two stacked gradients matched as one and their stop lists were
    // concatenated. Offsets restart mid-list, SVG clamps stops monotonically, and a
    // flat swatch chip painted as a dark-to-white fade (docs/shots/brand-colours.svg).
    // One gradient/image element per layer, emitted bottom-first.
    const bgLayers = (bgImgAll && bgImgAll !== 'none' ? splitCssArgs(bgImgAll) : [])
      .map((value, idx) => ({ value: value.trim(), idx }))
      .filter((l) => l.value && l.value !== 'none');
    const layerProp = (list: string | null | undefined, i: number, fallback: string) => {
      const parts = splitCssArgs(list || '').filter((p) => p !== '');
      return parts.length ? parts[i % parts.length]! : fallback;
    };
    for (const { value: bgImg, idx: layerIdx } of bgLayers.slice().reverse()) {
      const bgSize     = layerProp(style.backgroundSize,     layerIdx, 'auto');
      const bgPosition = layerProp(style.backgroundPosition, layerIdx, '0% 0%');
      const bgRepeat   = layerProp(style.backgroundRepeat,   layerIdx, 'repeat');
      const gid = ++uid;
      // The positioning area (the padding box) and its origin. Hoisted out of the
      // url() branch below because the CONIC branch needs it too - see the tile
      // handling there.
      const area = {
        w: Math.max(0, w - num2(style, 'borderLeftWidth') - num2(style, 'borderRightWidth')),
        h: Math.max(0, h - num2(style, 'borderTopWidth') - num2(style, 'borderBottomWidth')),
      };
      const ax = x + num2(style, 'borderLeftWidth'), ay = y + num2(style, 'borderTopWidth');

      // TILED gradient layers. A gradient is sized by `background-size` like any other
      // background image, and the editor stage's transparency checkerboard is exactly
      // that: two 45deg linear-gradient layers at `24px 24px`, offset `0 0, 12px 12px`.
      // Drawing a tiled gradient across the whole element box is silently wrong pixels,
      // so before this the only honest answer left was the raster escape hatch - which
      // is how a 1080x676 PNG of a faint checkerboard ended up inside a docs shot.
      // The tile becomes a real <pattern>, exactly as the conic and url() branches do.
      const gradPl = placeBackground(bgSize, bgPosition, bgRepeat, area, null);
      const gradTiles = Boolean(gradPl && gradPl.w > 0.5 && gradPl.h > 0.5
        && (gradPl.repeatX || gradPl.repeatY)
        && (gradPl.w < area.w - 0.5 || gradPl.h < area.h - 0.5));
      // Built in the TILE's own coordinate space when tiling - a pattern's content
      // coordinates are the tile, not the element.
      const gradEl = gradTiles
        ? (buildLinearGradientEl(NS, bgImg, 0, 0, gradPl.w, gradPl.h, gid)
          || buildRadialGradientEl(NS, bgImg, 0, 0, gradPl.w, gradPl.h, gid))
        : (buildLinearGradientEl(NS, bgImg, x, y, w, h, gid)
          || buildRadialGradientEl(NS, bgImg, x, y, w, h, gid));
      // A conic gradient is sized by `background-size` like any other background
      // image, so resolve the placement BEFORE parsing: a tiled conic (the
      // transparency checkerboard is `repeating-conic-gradient(...) 50% / 2em 2em`)
      // must be parsed at ONE TILE, not at the element box. Parsing at the box and
      // fanning across it - which is what this did until 2026-07-30 - turns a 32px
      // checkerboard into a single element-sized four-quadrant sweep: not a raster,
      // but silently wrong pixels, which is worse.
      // `intrinsic` is null: a gradient has no intrinsic size, so `auto` resolves to
      // the area and the untiled case behaves exactly as before.
      const conicPl = gradEl ? null
        : placeBackground(bgSize, bgPosition, bgRepeat, area, null);
      const conicTiles = Boolean(conicPl && conicPl.w > 0 && conicPl.h > 0
        && (conicPl.repeatX || conicPl.repeatY)
        && (conicPl.w < area.w - 0.5 || conicPl.h < area.h - 0.5));
      const conic = gradEl ? null
        : parseConicGradient(bgImg, conicTiles ? conicPl!.w : w, conicTiles ? conicPl!.h : h);
      if (gradEl && gradTiles) {
        // One tile of the gradient inside a <pattern>, phased by background-position
        // (modulo the tile on each repeating axis, so the phase matches what the
        // browser paints - `12px 12px` on a 24px tile is not 0).
        const pid = `fcgradpat-${++uid}`;
        const pat = document.createElementNS(NS, 'pattern');
        pat.setAttribute('id', pid);
        pat.setAttribute('patternUnits', 'userSpaceOnUse');
        pat.setAttribute('x', String(n2(ax + (gradPl.repeatX ? gradPl.x % gradPl.w : gradPl.x))));
        pat.setAttribute('y', String(n2(ay + (gradPl.repeatY ? gradPl.y % gradPl.h : gradPl.y))));
        pat.setAttribute('width', String(n2(gradPl.repeatX ? gradPl.w : Math.max(gradPl.w, area.w))));
        pat.setAttribute('height', String(n2(gradPl.repeatY ? gradPl.h : Math.max(gradPl.h, area.h))));
        const cell = document.createElementNS(NS, 'rect');
        cell.setAttribute('x', '0'); cell.setAttribute('y', '0');
        cell.setAttribute('width', String(n2(gradPl.w))); cell.setAttribute('height', String(n2(gradPl.h)));
        cell.setAttribute('fill', `url(#svggrad-${gid})`);
        defs.appendChild(gradEl);
        pat.appendChild(cell);
        defs.appendChild(pat);
        g.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, `url(#${pid})`));
      } else if (gradEl) {
        defs.appendChild(gradEl);
        g.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, `url(#svggrad-${gid})`));
      } else if (conic && conicTiles && conicPl) {
        // A TILED conic: emit one tile's fan inside a real <pattern>, mirroring the
        // url() tiling branch below. Chromium cannot keep this vector through
        // printToPDF at all (PDF has no conic/angular shading type - measured), so
        // the walker is the only path that renders a checkerboard crisply.
        const tile = conicFanEl(NS, conic, 0, 0, conicPl.w, conicPl.h, gid);
        if (tile) {
          const pid = `fcconicpat-${++uid}`;
          const pat = document.createElementNS(NS, 'pattern');
          pat.setAttribute('id', pid);
          pat.setAttribute('patternUnits', 'userSpaceOnUse');
          // Modulo the offset onto the repeating axes so the phase matches what the
          // browser painted (background-position: 50% on a 2em tile is not 0).
          pat.setAttribute('x', String(n2(ax + (conicPl.repeatX ? conicPl.x % conicPl.w : conicPl.x))));
          pat.setAttribute('y', String(n2(ay + (conicPl.repeatY ? conicPl.y % conicPl.h : conicPl.y))));
          pat.setAttribute('width', String(n2(conicPl.repeatX ? conicPl.w : Math.max(conicPl.w, area.w))));
          pat.setAttribute('height', String(n2(conicPl.repeatY ? conicPl.h : Math.max(conicPl.h, area.h))));
          pat.appendChild(tile);
          defs.appendChild(pat);
          g.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, `url(#${pid})`));
        }
      } else if (conic) {
        // SVG has no conic primitive, so the sweep is drawn as a fan of wedges. It is
        // the last thing on these pages that forced a raster: on the qr fixture a
        // single conic page background became a 1168×900 PNG that swamped every
        // vector node behind it.
        const fan = conicFanEl(NS, conic, x, y, w, h, gid);
        if (fan) {
          const cid = `fcconic-${++uid}`;
          const clip = document.createElementNS(NS, 'clipPath');
          clip.setAttribute('id', cid);
          clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
          clip.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, '#fff'));
          defs.appendChild(clip);
          fan.setAttribute('clip-path', `url(#${cid})`);
          g.appendChild(fan);
        }
      } else {
        const bgUrl = firstCssUrl(bgImg);
        const href = bgUrl ? await cssUrlToHref(bgUrl) : null;
        if (href) {
          // Place the image per background-size/position/repeat instead of stretching
          // it across the border box. The old behaviour was right only for a `cover`
          // hero: a 14px right-centred select chevron came out smeared across the
          // whole field, and this app's field primitive puts one on every select and
          // every checkbox.
          const pl = placeBackground(bgSize, bgPosition, bgRepeat, area, await intrinsicSize(href));

          const cid = `fcbgclip-${++uid}`;
          const clip = document.createElementNS(NS, 'clipPath');
          clip.setAttribute('id', cid);
          clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
          clip.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, '#fff'));
          defs.appendChild(clip);

          if (pl.w > 0 && pl.h > 0 && (pl.repeatX || pl.repeatY)) {
            // A tiling background becomes a real <pattern> rather than a screenshot.
            // The tile step is the painted size on the repeating axis and the whole
            // area on the axis that doesn't repeat, so repeat-x doesn't become a grid.
            const pid = `fcbgpat-${++uid}`;
            const pat = document.createElementNS(NS, 'pattern');
            pat.setAttribute('id', pid);
            pat.setAttribute('patternUnits', 'userSpaceOnUse');
            pat.setAttribute('x', String(n2(ax + (pl.repeatX ? pl.x % pl.w : pl.x))));
            pat.setAttribute('y', String(n2(ay + (pl.repeatY ? pl.y % pl.h : pl.y))));
            pat.setAttribute('width', String(n2(pl.repeatX ? pl.w : Math.max(pl.w, area.w))));
            pat.setAttribute('height', String(n2(pl.repeatY ? pl.h : Math.max(pl.h, area.h))));
            const pim = document.createElementNS(NS, 'image');
            pim.setAttribute('href', href);
            pim.setAttribute('x', '0'); pim.setAttribute('y', '0');
            pim.setAttribute('width', String(n2(pl.w))); pim.setAttribute('height', String(n2(pl.h)));
            pim.setAttribute('preserveAspectRatio', 'none');
            pat.appendChild(pim);
            defs.appendChild(pat);
            const fillRect = makeRoundedFill(NS, x, y, w, h, radii, uniform, `url(#${pid})`);
            g.appendChild(fillRect);
          } else if (pl.w > 0 && pl.h > 0) {
            const im = document.createElementNS(NS, 'image');
            im.setAttribute('href', href);
            im.setAttribute('x', String(n2(ax + pl.x))); im.setAttribute('y', String(n2(ay + pl.y)));
            im.setAttribute('width', String(n2(pl.w))); im.setAttribute('height', String(n2(pl.h)));
            // The size is already resolved, so the image must fill it exactly - 
            // letting preserveAspectRatio re-fit it would undo the arithmetic.
            im.setAttribute('preserveAspectRatio', 'none');
            im.setAttribute('clip-path', `url(#${cid})`);
            g.appendChild(im);
          }
        }
      }
    }

    // ── Inset box-shadow ──────────────────────────────────────────────────────
    // CSS paints an inset shadow over the background and under the border/content,
    // so it goes here rather than with the outer shadows. The geometry is exactly the
    // region between the border box and an offset, spread-shrunken copy of it: one
    // path with two subpaths and `fill-rule: evenodd`, blurred, and clipped to the
    // box so the blur cannot bleed outside. No stroke-width guessing, and the same
    // element count a stroked approximation would need.
    // Blur-less formats: the same ring treatment, mirrored. An inset shadow is the
    // blur of the region OUTSIDE the offset, shrunken inner shape, so each ring is the
    // annulus between two shrunken copies of it, and the innermost reaches the box.
    if (opts.noBoxShadow && !ownPaintRastered && tag !== 'img' && tag !== 'svg') {
      for (const sh of parseBoxShadow(style.boxShadow).reverse()) {
        if (!sh.inset) continue;
        const col = parseCssColorFull(sh.color);
        if (!col) continue;
        const shrunk = (t: number) => {
          const iw = w - 2 * (sh.spread + t), ih = h - 2 * (sh.spread + t);
          if (iw <= 0 || ih <= 0) return '';
          return roundedRectPath(x + sh.x + sh.spread + t, y + sh.y + sh.spread + t, iw, ih,
            insetCorners(radii, sh.spread + t));
        };
        const boxPath = roundedRectPath(x, y, w, h, radii);
        const rings = gaussianShadowRings(sh.blur, col[3]);
        const steps: { outerD: string; innerD: string; alpha: number }[] = rings.length
          ? rings.map((r) => ({
              outerD: r.inner === null ? boxPath : shrunk(r.inner),
              innerD: shrunk(r.outer),
              alpha: r.alpha,
            }))
          : [{ outerD: boxPath, innerD: shrunk(0), alpha: col[3] }];
        // Clip to the box: the offset copies reach past it, and an inset shadow that
        // escapes its own element is the one failure worse than not drawing it.
        const cid = `fcinsetring-${++uid}`;
        const clip = document.createElementNS(NS, 'clipPath');
        clip.setAttribute('id', cid);
        clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
        clip.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, '#fff'));
        defs.appendChild(clip);
        const ringG = document.createElementNS(NS, 'g');
        ringG.setAttribute('clip-path', `url(#${cid})`);
        for (const st of steps) {
          if (!st.outerD) continue;
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', st.outerD + st.innerD);
          if (st.innerD) p.setAttribute('fill-rule', 'evenodd');
          p.setAttribute('fill', `rgb(${col[0]},${col[1]},${col[2]})`);
          p.setAttribute('fill-opacity', String(Math.round(st.alpha * 1000) / 1000));
          ringG.appendChild(p);
        }
        if (ringG.childNodes.length) g.appendChild(ringG);
      }
    }

    if (!opts.noBoxShadow && !ownPaintRastered && tag !== 'img' && tag !== 'svg') {
      for (const sh of parseBoxShadow(style.boxShadow).reverse()) {
        if (!sh.inset) continue;
        const col = parseCssColorFull(sh.color);
        if (!col) continue;
        const iw = Math.max(0, w - 2 * sh.spread), ih = Math.max(0, h - 2 * sh.spread);
        const iRadii = insetCorners(radii, sh.spread);
        // The outer subpath has to reach past the blur on every side, or the ring's
        // own outer edge blurs into view inside the box.
        const pad = sh.blur * 3 + Math.abs(sh.x) + Math.abs(sh.y) + Math.abs(sh.spread) + 8;
        const ring = document.createElementNS(NS, 'path');
        ring.setAttribute('d',
          `M${n2(x - pad)} ${n2(y - pad)}H${n2(x + w + pad)}V${n2(y + h + pad)}H${n2(x - pad)}Z` +
          roundedRectPath(x + sh.x + sh.spread, y + sh.y + sh.spread, iw, ih, iRadii));
        ring.setAttribute('fill-rule', 'evenodd');
        ring.setAttribute('fill', `rgb(${col[0]},${col[1]},${col[2]})`);
        if (col[3] < 1) ring.setAttribute('fill-opacity', String(col[3]));
        if (sh.blur > 0) {
          const fId = `fcinset-${++uid}`;
          const filt = document.createElementNS(NS, 'filter');
          filt.setAttribute('id', fId);
          filt.setAttribute('filterUnits', 'userSpaceOnUse');
          filt.setAttribute('x', String(n2(x - pad))); filt.setAttribute('y', String(n2(y - pad)));
          filt.setAttribute('width', String(n2(w + 2 * pad))); filt.setAttribute('height', String(n2(h + 2 * pad)));
          filt.setAttribute('color-interpolation-filters', 'sRGB');
          const fe = document.createElementNS(NS, 'feGaussianBlur');
          fe.setAttribute('stdDeviation', String(n2(sh.blur / 2)));   // CSS blur radius → σ
          filt.appendChild(fe);
          defs.appendChild(filt);
          ring.setAttribute('filter', `url(#${fId})`);
        }
        const cid = `fcinsetclip-${++uid}`;
        const clip = document.createElementNS(NS, 'clipPath');
        clip.setAttribute('id', cid);
        clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
        clip.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, '#fff'));
        defs.appendChild(clip);
        ring.setAttribute('clip-path', `url(#${cid})`);
        g.appendChild(ring);
      }
    }

    // ── Borders ─────────────────────────────────────────────────────────────
    // Mirror the PDF walker: a uniform border becomes one stroked rect/path (radius
    // honoured); a divider (border-top only) or mixed border fills per edge.
    // Colours keep their alpha (stroke-opacity / fill-opacity) - svg-ir flattens
    // it over the background for EMF/EPS - so hairline rgba() borders don't go opaque.
    const bSide = (wKey: string, cKey: string): { bw: number; rgb: Rgba | null } => {
      if (ownPaintRastered) return { bw: 0, rgb: null };   // already in the raster
      const bw = parseFloat((style as any)[wKey]) || 0;
      return { bw, rgb: bw > 0 ? parseCssColorFull((style as any)[cKey]) : null };
    };
    const bT = bSide('borderTopWidth',    'borderTopColor');
    const bR = bSide('borderRightWidth',  'borderRightColor');
    const bB = bSide('borderBottomWidth', 'borderBottomColor');
    const bL = bSide('borderLeftWidth',   'borderLeftColor');
    const eqRgb = (a: Rgba | null, b: Rgba | null) => a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
    const rgbStr = (c: Rgba) => `rgb(${c[0]},${c[1]},${c[2]})`;
    const uniformBorder = bT.rgb && bT.bw === bR.bw && bT.bw === bB.bw && bT.bw === bL.bw
      && eqRgb(bT.rgb, bR.rgb) && eqRgb(bT.rgb, bB.rgb) && eqRgb(bT.rgb, bL.rgb);
    if (uniformBorder) {
      const lw = bT.bw;
      // Centred stroke: inset the box by lw/2 and the radius by lw/2 (border-box
      // radius minus half the border). Uniform corners → <rect>; else a <path>.
      const r = uniform
        ? makeSvgRect(NS, x + lw / 2, y + lw / 2, Math.max(0, w - lw), Math.max(0, h - lw),
            Math.max(0, uniform[0] - lw / 2), 'none', Math.max(0, uniform[1] - lw / 2))
        : (() => {
            const p = document.createElementNS(NS, 'path');
            p.setAttribute('d', roundedRectPath(x + lw / 2, y + lw / 2,
              Math.max(0, w - lw), Math.max(0, h - lw), insetCorners(radii, lw / 2)));
            p.setAttribute('fill', 'none');
            return p;
          })();
      r.setAttribute('stroke', rgbStr(bT.rgb!));
      r.setAttribute('stroke-width', String(lw));
      if (bT.rgb![3] < 1) r.setAttribute('stroke-opacity', String(bT.rgb![3]));
      const dash = borderDashArray(style.borderTopStyle, lw);
      if (dash) {
        r.setAttribute('stroke-dasharray', dash.dash.join(' '));
        if (dash.round) r.setAttribute('stroke-linecap', 'round');
      }
      g.appendChild(r);
    } else {
      const edge = (rect: { rgb: Rgba; el: Element }) => { if (rect.rgb[3] < 1) rect.el.setAttribute('fill-opacity', String(rect.rgb[3])); g.appendChild(rect.el); };
      if (bT.rgb) edge({ rgb: bT.rgb, el: makeSvgRect(NS, x, y, w, bT.bw, 0, rgbStr(bT.rgb)) });
      if (bB.rgb) edge({ rgb: bB.rgb, el: makeSvgRect(NS, x, y + h - bB.bw, w, bB.bw, 0, rgbStr(bB.rgb)) });
      if (bL.rgb) edge({ rgb: bL.rgb, el: makeSvgRect(NS, x, y, bL.bw, h, 0, rgbStr(bL.rgb)) });
      if (bR.rgb) edge({ rgb: bR.rgb, el: makeSvgRect(NS, x + w - bR.bw, y, bR.bw, h, 0, rgbStr(bR.rgb)) });
    }

    // ── Inline SVG passthrough ──────────────────────────────────────────────
    if (tag === 'svg') {
      const clone = el.cloneNode(true) as Element;
      stripCommentNodes(clone);
      unscopeStyleEls(clone);
      // plans/101 (found via lolly-work's shot corpus): a nested <svg>'s
      // presentation is mostly CASCADE-driven on screen - class rules, var()s,
      // inherited text style - and the verbatim clone keeps only attributes
      // plus its inner <style>. Standalone, classes match stylesheets that
      // aren't there and var()s are undefined, so class-driven fills/strokes
      // vanish (a green ✓ ring flattens to a black dot) and var() strokes
      // don't paint at all. Bake each SVG descendant's COMPUTED presentation
      // onto the clone as INLINE style - inline beats the surviving un-scoped
      // <style> rules whose vars are undefined standalone; a presentation
      // attribute would not (the same ruling outlineSvgTextRuns records).
      // Guards: values equal to the SVG initial are skipped (an element whose
      // paint arrives via attributes keeps them - the clone carries those);
      // url(#…) paints are written verbatim, their defs travel inside the
      // clone; only SVG-namespace elements are touched (foreignObject HTML
      // has its own walk); <stop> takes its stop-* pair instead. Trades
      // accepted and pinned in export-nested-svg.test.ts: inheritance is
      // flattened to per-node literals (visually identical, structurally
      // denormalised), and inline style outranks SMIL/CSS animation on the
      // same property - a shot is a static capture anyway. The deep clone is
      // a same-order copy, so the two element lists pair 1:1 (the invariant
      // outlineSvgTextRuns leans on); topology mismatch skips the bake rather
      // than mispairing. The PDF walker needs no mirror - it already resolves
      // paints per node from the live DOM (computedPaint); this converges the
      // two walkers.
      {
        const SVGNS = 'http://www.w3.org/2000/svg';
        const PAINT = [
          ['fill', 'rgb(0, 0, 0)'], ['fill-opacity', '1'], ['fill-rule', 'nonzero'],
          ['stroke', 'none'], ['stroke-opacity', '1'], ['stroke-width', '1px'],
          ['stroke-linecap', 'butt'], ['stroke-linejoin', 'miter'],
          ['stroke-dasharray', 'none'], ['stroke-dashoffset', '0px'],
          ['stroke-miterlimit', '4'], ['opacity', '1'],
          ['paint-order', 'normal'], ['vector-effect', 'none'],
        ] as const;
        const TEXT = [
          ['font-family', ''], ['font-size', ''], ['font-weight', '400'],
          ['font-style', 'normal'], ['letter-spacing', 'normal'],
          ['text-anchor', 'start'], ['dominant-baseline', 'auto'],
        ] as const;
        const STOP = [['stop-color', 'rgb(0, 0, 0)'], ['stop-opacity', '1']] as const;
        const TEXT_TAGS = new Set(['text', 'tspan', 'textPath']);
        const srcEls = el.querySelectorAll('*');
        const cloneEls = clone.querySelectorAll('*');
        if (srcEls.length === cloneEls.length) {
          for (let i = 0; i < srcEls.length; i++) {
            const s = srcEls[i]!;
            const c = cloneEls[i]!;
            if (s.namespaceURI !== SVGNS || !(c instanceof SVGElement)) continue;
            const cs = getComputedStyle(s);
            const bake = (props: readonly (readonly [string, string])[]): void => {
              for (const [p, initial] of props) {
                const v = cs.getPropertyValue(p);
                if (v && v !== initial) c.style.setProperty(p, v);
              }
            };
            if (s.localName === 'stop') { bake(STOP); continue; }
            bake(PAINT);
            if (TEXT_TAGS.has(s.localName)) bake(TEXT);
          }
        }
      }
      // `currentColor` inside the svg resolves against the inherited CSS `color`
      // on screen, but the emitted file is a STANDALONE svg with no HTML
      // ancestors, so there it falls back to the initial value - black. The
      // gallery's ghost icons (`stroke="currentColor"` under a blue-`color`
      // span) are exactly that: blue on screen, black ink in the walked shot.
      // Stamp the live computed color onto the clone root as a presentation
      // attribute - it is (0,0,0) specificity, so an inner node's own
      // color rule still wins wherever its CSS survives the clone; the PDF
      // walker needs no mirror because it resolves paints per node from the
      // live DOM via computedPaint (see the note above the `path` branch).
      if (style.color) clone.setAttribute('color', style.color);
      clone.setAttribute('x',      String(x));
      clone.setAttribute('y',      String(y));
      clone.setAttribute('width',  String(w));
      clone.setAttribute('height', String(h));
      await inlineBlobUrlsInEl(clone);
      g.appendChild(clone);
      return;
    }

    // ── Image (SVG source → inline vector; bitmap → raster <image>) ───────────
    if (tag === 'img') {
      const src = el.src || el.getAttribute('src') || '';
      if (src && w > 0 && h > 0) {
        // SVG sources stay VECTOR - inline them as a nested <svg>, fitted "meet"
        // (object-fit: contain), instead of a raster <image>. SVG-ness is sniffed
        // from the bytes (asset URLs are blob: with no extension/MIME hint). Mirrors
        // the PDF walker; real bitmaps fall through to the <image> path below.
        let inlineSvg: any = null;
        try { inlineSvg = await inlineSvgFromImg(src); } catch { inlineSvg = null; }
        if (inlineSvg) {
          await inlineBlobUrlsInEl(inlineSvg);
          // Nested-<svg> scaling needs a viewBox; synthesise one from width/height
          // if the source omitted it, so the mark still fits its box.
          if (!inlineSvg.getAttribute('viewBox')) {
            const iw = parseFloat(inlineSvg.getAttribute('width'));
            const ih = parseFloat(inlineSvg.getAttribute('height'));
            if (iw > 0 && ih > 0) inlineSvg.setAttribute('viewBox', `0 0 ${iw} ${ih}`);
          }
          inlineSvg.setAttribute('x',      String(x));
          inlineSvg.setAttribute('y',      String(y));
          inlineSvg.setAttribute('width',  String(w));
          inlineSvg.setAttribute('height', String(h));
          if (!inlineSvg.getAttribute('preserveAspectRatio')) {
            // object-fit → meet (contain) / slice (cover); object-position → alignment.
            // Default (contain, centred) resolves to the prior 'xMidYMid meet'.
            // A framing pan falls between the nine alignments preserveAspectRatio can
            // name, so those get explicit geometry off the viewBox aspect instead.
            const vb = (inlineSvg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
            const exact = vb.length === 4 && vb[2]! > 0 && vb[3]! > 0
              ? exactFittedRect(style, vb[2]!, vb[3]!, x, y, w, h) : null;
            if (exact) {
              inlineSvg.setAttribute('x',      String(exact.x));
              inlineSvg.setAttribute('y',      String(exact.y));
              inlineSvg.setAttribute('width',  String(exact.w));
              inlineSvg.setAttribute('height', String(exact.h));
              inlineSvg.setAttribute('preserveAspectRatio', 'none');
              if (style.objectFit === 'cover') {
                const clipId = `svgfit-${++uid}`;
                const cp = document.createElementNS(NS, 'clipPath');
                cp.setAttribute('id', clipId);
                const r = document.createElementNS(NS, 'rect');
                r.setAttribute('x', String(x)); r.setAttribute('y', String(y));
                r.setAttribute('width', String(w)); r.setAttribute('height', String(h));
                cp.appendChild(r);
                defs.appendChild(cp);
                inlineSvg.setAttribute('clip-path', `url(#${clipId})`);
              }
            } else {
              const meetSlice = style.objectFit === 'cover' ? 'slice' : 'meet';
              inlineSvg.setAttribute('preserveAspectRatio', `${preserveAspectRatioAlign(style.objectPosition)} ${meetSlice}`);
            }
          }
          g.appendChild(inlineSvg);
          return;
        }
        try {
          // Inline EVERY scheme, not just data:/blob:. An http/relative src was
          // previously written straight into `<image href="/catalog/…">`, and an SVG
          // consumed as `<img src="shot.svg">` - which is how /info serves every docs
          // screenshot, and how any exported SVG is normally viewed - runs in secure
          // static mode with NO network access, so that image renders BLANK and the
          // file is not self-contained. The sibling CSS-url branch already fetches
          // and inlines http (cssUrlToHref, :1651), so this was the `<img>` branch
          // being inconsistent with it rather than a deliberate exemption.
          // Falls back to the raw src on failure (cross-origin without CORS, 404),
          // which is exactly the old behaviour - never worse than before.
          const dataUrl0 = src.startsWith('data:') ? src
            : await blobToDataUrl(src).catch(() => src);
          // Preserve an embedded bitmap's provenance BEFORE downscaleRasterForBox's
          // canvas re-encode strips it (canvas.toDataURL emits a metadata-free PNG):
          // read the source's Content Credentials and carry them forward as a
          // componentOf ingredient on the EXPORT's own manifest, so a genAI origin (or
          // any credential) stays on the record even though the embedded pixels can no
          // longer hold it. Verify walks ingredient manifests, so the flag surfaces.
          // Only credentialed bitmaps add one; gated on _ingredientSink (c2pa only).
          if (opts._ingredientSink && dataUrl0.startsWith('data:')) {
            try {
              const b = Uint8Array.from(atob(dataUrl0.slice(dataUrl0.indexOf(',') + 1)), (c) => c.charCodeAt(0));
              const store = extractC2paStore(b);
              const ing = store && prepareC2paIngredientFromStore(store.store, store.format);
              if (ing && !opts._ingredientSink.some((p) => p.activeLabel === ing.activeLabel)) {
                opts._ingredientSink.push({ ...ing, relationship: 'componentOf' });
              }
            } catch { /* not a decodable/credentialed bitmap */ }
          }
          // CSS filter() (e.g. grayscale/contrast presets) is baked into the bitmap
          // via the browser so the vector image matches screen/PNG instead of
          // exporting full-colour. No-op + graceful fallback when filter is none.
          const dataUrlF = await bakeImageFilter(el, dataUrl0, style.filter);
          // Cap the inlined resolution to what this box (w x h CSS px) can show. Normally
          // dpi-aware off the export dpi (>=2x the box, so a print export keeps resolution);
          // when `opts.rasterDpi` is set the asset instead embeds at that DPI with a 1x
          // floor, so a walker SVG can shed a heavy photo's unseen pixels (ExportOpts.rasterDpi).
          const rOptIn = (opts.rasterDpi as number) > 0;
          const rDpi = rOptIn ? (opts.rasterDpi as number) : d.dpi;
          const dataUrl = await downscaleRasterForBox(el, dataUrlF, Math.max(w, h), rDpi, rOptIn ? 1 : 2, rOptIn ? 'auto' : 'png');
          const rMin = Math.min(
            parseCssLen(style.borderTopLeftRadius,     w),
            parseCssLen(style.borderTopRightRadius,    w),
            parseCssLen(style.borderBottomLeftRadius,  w),
            parseCssLen(style.borderBottomRightRadius, w),
          );
          const isCircle = rMin >= Math.min(w, h) * 0.45;
          const img = document.createElementNS(NS, 'image');
          img.setAttribute('href',   dataUrl);
          img.setAttribute('x',      String(x));
          img.setAttribute('y',      String(y));
          img.setAttribute('width',  String(w));
          img.setAttribute('height', String(h));
          if (isCircle) {
            const clipId = `imgclip-${++uid}`;
            const cp = document.createElementNS(NS, 'clipPath');
            cp.setAttribute('id', clipId);
            const circle = document.createElementNS(NS, 'circle');
            circle.setAttribute('cx', String(x + w / 2));
            circle.setAttribute('cy', String(y + h / 2));
            circle.setAttribute('r',  String(Math.min(w, h) / 2));
            cp.appendChild(circle);
            defs.appendChild(cp);
            img.setAttribute('clip-path',           `url(#${clipId})`);
            img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
          } else if (style.objectFit === 'cover' || style.objectFit === 'contain') {
            // A framing pan (plans/148) produces an object-position percentage that
            // preserveAspectRatio cannot name; place those explicitly instead.
            const exact = exactFittedRect(style, el.naturalWidth || 0, el.naturalHeight || 0, x, y, w, h);
            if (exact) {
              img.setAttribute('x',      String(exact.x));
              img.setAttribute('y',      String(exact.y));
              img.setAttribute('width',  String(exact.w));
              img.setAttribute('height', String(exact.h));
              img.setAttribute('preserveAspectRatio', 'none');   // aspect is in the numbers
              if (style.objectFit === 'cover') {
                // `slice` used to do the cropping; explicit geometry overflows the box,
                // so the crop has to be a real clip.
                const clipId = `imgfit-${++uid}`;
                const cp = document.createElementNS(NS, 'clipPath');
                cp.setAttribute('id', clipId);
                const r = document.createElementNS(NS, 'rect');
                r.setAttribute('x', String(x)); r.setAttribute('y', String(y));
                r.setAttribute('width', String(w)); r.setAttribute('height', String(h));
                cp.appendChild(r);
                defs.appendChild(cp);
                img.setAttribute('clip-path', `url(#${clipId})`);
              }
            } else if (style.objectFit === 'cover') {
              // Fill the box, cropping the overflow - `slice` clips to the image's own
              // x/y/width/height viewport, so no extra clipPath is needed (matches the
              // on-screen hero/masthead). object-position picks WHICH edge is cropped.
              img.setAttribute('preserveAspectRatio', `${preserveAspectRatioAlign(style.objectPosition)} slice`);
            } else {
              // meet-fit the whole image; object-position anchors it within the box.
              // Centre resolves to 'xMidYMid meet' = the SVG default (unchanged).
              img.setAttribute('preserveAspectRatio', `${preserveAspectRatioAlign(style.objectPosition)} meet`);
            }
          }
          g.appendChild(img);
        } catch { /* skip unloadable images */ }
      }
      return;
    }

    // ── overflow:hidden → clip the CONTENT to the box (rounded or square) ──────
    // CSS crops an overflow:hidden box's descendants to the box (its corner curve when
    // rounded); the walker draws each box's own bg but doesn't clip descendants, so a
    // child that spills - a differently-filled titlebar past a rounded edge, or an
    // over-sized image/child past a square edge - would show outside the box. Route
    // children/text/pseudo through a <clipPath> sub-group (rounded fill, or a plain rect
    // when there's no radius); the box-shadow/background/border stay in `g` (unclipped) so
    // an outset shadow still extends past the box. A ROUNDED overflow box always clips (its
    // children must follow the corner curve); a SQUARE one clips only when a descendant
    // ACTUALLY spills (scroll > client) - most overflow:hidden boxes (flex/grid layout) clip
    // nothing visible, and a clip group on every one would bloat the SVG for no change.
    const clipsOverflow = (style.overflowX && style.overflowX !== 'visible') || (style.overflowY && style.overflowY !== 'visible');
    const spillsBox = (el.scrollWidth || 0) > (el.clientWidth || 0) + 1 || (el.scrollHeight || 0) > (el.clientHeight || 0) + 1;
    // ── Overflow clip (decided AFTER the walk - see finaliseOverflowClip) ─────
    // A clip is friction for whoever opens the file next: a designer has to release
    // it before they can edit anything inside. So the group is created optimistically
    // and the clip attribute is only attached at the end, once the descendants have
    // been measured and we know it is doing work. Across the five local fixtures the
    // walker emitted 325 clip defs and 4373 references to them, every one a single
    // shape - most of them around content that never came near the edge.
    let contentG: Element = g;
    let ovClipId: string | null = null;
    let ovBounds: Bounds | null = null;
    const clipCandidate = Boolean(clipsOverflow) && (hasRadius || spillsBox);
    if (clipCandidate) {
      ovClipId = `fcovclip-${++uid}`;
      contentG = document.createElementNS(NS, 'g');
      g.appendChild(contentG);
      ovBounds = newBounds();
    }

    /**
     * Attach the overflow clip, or prove it unnecessary and leave it off.
     *
     * Kept when content genuinely leaves the box (`spillsBox` - the browser's own
     * scrollWidth/scrollHeight verdict, which also catches a text line running past
     * the edge), or when the box is rounded and something painted inside comes close
     * enough to an edge to touch a corner arc.
     *
     * Dropped otherwise, which also means dropping the `clip-path` references that
     * hoisted descendants took with them - a dangling url(#…) would clip them to
     * nothing.
     */
    const finaliseOverflowClip = (): void => {
      if (!ovClipId) return;
      const maxR = hasRadius
        ? Math.max(radii.topLeft[0], radii.topLeft[1], radii.topRight[0], radii.topRight[1],
                   radii.bottomRight[0], radii.bottomRight[1], radii.bottomLeft[0], radii.bottomLeft[1])
        : 0;
      const b = ovBounds;
      const touchesEdge = !b || !b.any ? false
        : b.minX < x + maxR || b.minY < y + maxR || b.maxX > x + w - maxR || b.maxY > y + h - maxR;
      if (spillsBox || (hasRadius && touchesEdge)) {
        const clip = document.createElementNS(NS, 'clipPath');
        clip.setAttribute('id', ovClipId);
        clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
        clip.appendChild(makeRoundedFill(NS, x, y, w, h, radii, uniform, '#fff'));   // 0 radii → a plain rect
        defs.appendChild(clip);
        contentG.setAttribute('clip-path', `url(#${ovClipId})`);
        return;
      }
      // Not needed. Strip the references a hoisted descendant carried, then fold the
      // wrapper away so the output has neither the clip nor an extra empty group.
      for (const ref of Array.from(rootG.querySelectorAll(`[clip-path="url(#${ovClipId})"]`))) {
        ref.removeAttribute('clip-path');
      }
      if (contentG !== g && contentG.parentNode === g) {
        while (contentG.firstChild) g.insertBefore(contentG.firstChild, contentG);
        contentG.remove();
      }
    };

    // ── The stacking context this element's descendants live in ───────────────
    // `parentG` is the in-flow pointer and `ctx.frame` is the stacking pointer.
    // Splitting them is what makes Appendix E section E.2 step 8's parenthetical fall
    // out for free: an element that is POSITIONED but does NOT create a context
    // (`position: relative; z-index: auto`) is deferred into layer 6, its
    // in-flow children append into its own contentG and travel with it, and a
    // `z-index: 5` grandchild defers past it to the ANCESTOR frame's layer 7 - 
    // which is exactly what CSS paints, and exactly what a naive
    // "positioned ⇒ treat as a context" implementation gets wrong.
    let ownFrame: ScFrame | null = null;
    // The box descendants are confined to. Rounded corners are ignored here on
    // purpose: this is only ever used to REJECT a node that misses the box entirely,
    // and the outer rectangle is the conservative bound for that.
    const childClipBox = clipCandidate ? intersectRect(cb, { x, y, w, h }) : cb;
    let childCtx: PaintCtx = { frame: ctx.frame, clips: ctx.clips, clipBox: childClipBox, bounds: ovBounds ?? ctx.bounds };
    if (stackingOrder) {
      if (createsCtx) {
        ownFrame = {
          content: contentG,
          // When there is no overflow clip, contentG IS g - so a layer-2 unit
          // inserted at firstChild would land BEHIND this element's own
          // box-shadow/background/border, which section E.2 step 3 puts first. Anchor
          // on the last own-paint node instead. With a clip group, contentG is
          // empty and firstChild is already the right place (anchor null).
          anchor: contentG === g ? g.lastChild : null,
          neg: [], z0: [], pos: [],
        };
        childCtx = { frame: ownFrame, clips: [], clipBox: childClipBox, bounds: ovBounds ?? ctx.bounds };
      } else {
        // Not a context: descendants belong to the SAME frame, but a hoist out
        // of here now crosses this element's overflow clip and must carry it.
        childCtx = { frame: ctx.frame, clips: ovClipId ? ctx.clips.concat(ovClipId) : ctx.clips,
                     clipBox: childClipBox, bounds: ovBounds ?? ctx.bounds };
      }
    }

    // ── Recurse block-level children ────────────────────────────────────────
    // Inline children are left to emitInlineTextSvg below, which walks the inline
    // flow and emits TEXT. That is right for a <span>, and silently wrong for an
    // inline <svg>: the inline walk has no passthrough branch, so the SVG is
    // dropped entirely and nothing warns. An <svg> is replaced content, not text - 
    // it has a box of its own at any display value - so route it here regardless.
    // (App icons survived only because the CSS sets them display:block. A bare
    // <svg> defaults to display:inline, which is exactly what a TOOL's own canvas
    // is: the QR code was missing from every page snapshot for this reason. Tool
    // EXPORTS were unaffected - an SVG-rooted canvas takes the renderSvg fast path
    // and never enters this walker.)
    //
    // A flex/grid container paints its items in ORDER-MODIFIED document order
    // (CSS Flexbox section 5.4, CSS Grid section 6), not raw document order. Pure reorder: the
    // visit PREDICATE is untouched, and it doesn't need to change, because
    // `position: absolute|fixed` blockifies computed display (CSS Display 3
    // section 2.7) - so every layer-2/6/7 child already fails the inlineFlow test and
    // is already visited today.
    // The own-paint boundary: everything in contentG up to here is this element's
    // own background/border/shadow. A negative-z pseudo has to land just past it -
    // under the children and text appended below - so svgPseudoContent's negInsert
    // (DOM-order mode) inserts there, advancing the cursor to keep encounter order.
    let negCursor: ChildNode | null = contentG.lastChild;
    const kids: Element[] = stackingOrder && isFlexOrGridContainer(style.display)
      ? orderModifiedChildren(renderedChildren(el),
          (c) => Number.parseInt(window.getComputedStyle(c).order || '0', 10) || 0)
      : renderedChildren(el);
    // A child WITHOUT a box of its own is a plain-inline wrapper (<span>, an
    // unstyled <a>): its text belongs to emitInlineTextSvg below - but an own-box
    // DESCENDANT inside it (an <img>, an inline <svg>, an <input>) belonged to
    // NOBODY: this loop skipped the wrapper, and the inline text walk returns at
    // own-box children on the assumption this loop visited them. A preview <img>
    // inside an unstyled inline <a> therefore vanished from the shot, silently - 
    // the nested form of the bare-<svg> bug above. Descend through inline
    // wrappers and visit their own-box descendants; drawing them can only add,
    // because the previous behaviour was nothing. (Their TEXT is untouched: the
    // inline walk descends the same wrappers for text nodes, and still returns
    // at every own-box element, so nothing double-paints.)
    const visitThroughInline = async (wrapper: Element): Promise<void> => {
      for (const c of renderedChildren(wrapper)) {
        if (hasOwnBox(c)) await visitSvgNode(c, contentG, childCtx);
        else await visitThroughInline(c);
      }
    };
    for (const child of kids) {
      if (hasOwnBox(child)) await visitSvgNode(child, contentG, childCtx);
      else await visitThroughInline(child);
    }
    // Shadow text: a host's own text pass below reads el.childNodes, which for a
    // shadow host is the LIGHT tree - the part that only renders where a <slot> puts
    // it. Text authored inside the shadow root has to be walked from the root itself.
    const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (sr) await emitInlineTextSvg(NS, sr, style, rootRect, contentG, vectorText);

    // ── Inline text ─────────────────────────────────────────────────────────
    await emitInlineTextSvg(NS, el, style, rootRect, contentG, vectorText);

    // ── <canvas> ─────────────────────────────────────────────────────────────
    // The pixels are the content; there is no vector form to recover. Snapshot the
    // backing store the same way snapshotMotion does, so chart/filter/D3 tools and
    // any real page draw something instead of an empty box. A cross-origin-tainted
    // canvas throws on toDataURL - that is unrecoverable, so it degrades to blank
    // with a warning rather than failing the export.
    if (tag === 'canvas') {
      // …unless the painter published a vector twin. The property is read
      // SYNCHRONOUSLY here so a canvas without one never awaits anything - that is
      // what keeps the untwinned path byte-identical AND allocation-free.
      const twin = typeof (el as VectorTwinCanvas).__lollyVectorTwin === 'function'
        ? await vectorTwinEl(el as HTMLCanvasElement, () => `tw${++uid}-`)
        : null;
      if (twin) {
        // Placed on the element box with the raster branch's exact geometry and
        // stretch semantics, so swapping raster for vector cannot move a pixel.
        twin.setAttribute('x', String(n2(x))); twin.setAttribute('y', String(n2(y)));
        twin.setAttribute('width', String(n2(w))); twin.setAttribute('height', String(n2(h)));
        twin.setAttribute('preserveAspectRatio', 'none');
        // `currentColor` in a standalone svg falls back to black - mirror the live
        // computed colour as the inline-<svg> passthrough above does.
        if (style.color) twin.setAttribute('color', style.color);
        contentG.appendChild(twin);
      } else try {
        const url = (el as HTMLCanvasElement).toDataURL('image/png');
        if (url && url.length > 'data:image/png;base64,'.length + 8) {
          const im = document.createElementNS(NS, 'image');
          im.setAttribute('href', url);
          im.setAttribute('x', String(n2(x))); im.setAttribute('y', String(n2(y)));
          im.setAttribute('width', String(n2(w))); im.setAttribute('height', String(n2(h)));
          im.setAttribute('preserveAspectRatio', 'none');
          contentG.appendChild(im);
        }
      } catch (e) {
        _host?.log?.('warn', `svg: <canvas> could not be read (tainted?) - ${(e as Error).message}`);
      }
    }

    // ── Form controls ────────────────────────────────────────────────────────
    // A control's value is not a text node, so the pass above sees nothing and the
    // box comes out empty - the blank URL field and blank Error-correction select on
    // every tool-page snapshot. What it shows is decided in form-controls.ts; the
    // LAYOUT is deliberately not reimplemented here. Instead the text is mirrored
    // into a throwaway element positioned over the control's content box and walked
    // with the same emitInlineTextSvg, so alignment, wrapping, direction, ellipsis
    // and vertical centring come from the browser rather than from a second, worse
    // implementation of CSS. The mirror is removed in a finally.
    await emitControlPaint(el, tag, style, contentG);

    // ── CSS generated content (::before/::after markers) ──────────────────────
    // pseudoDescriptor only models the ABSOLUTELY POSITIONED marker idiom, so
    // every pseudo it emits is by construction a positioned descendant - i.e.
    // section E.2 layer 6/7 (or 2 for a negative-z scrim), never in-flow content. In
    // stacking mode each one therefore gets its own <g> and is placed like any
    // other positioned child, which stops a marker from hiding under a later
    // sibling's background.
    await svgPseudoContent(NS, contentG, rootRect, el, vectorText,
      stackingOrder && childCtx.frame
        ? (z: number) => {
            const pg = document.createElementNS(NS, 'g');
            place(pg, { createsContext: false, reason: '', layer: z < 0 ? 2 : z > 0 ? 7 : 6, z, order: 0 },
              childCtx, contentG);
            return pg;
          }
        : undefined,
      (pg) => {
        contentG.insertBefore(pg, negCursor ? negCursor.nextSibling : contentG.firstChild);
        negCursor = pg;
      });

    // ── Finalise this stacking context (CSS 2.1 Appendix E section E.2) ──────────────
    // Everything deferred by descendants is appended here, in spec order. This
    // runs AFTER emitInlineTextSvg and svgPseudoContent, so layers 6 and 7 land
    // after layer-5 inline content automatically - a positioned child declared
    // before its parent's text still paints on top of it, which is what CSS does
    // and what DOM order got backwards.
    if (ownFrame) {
      const f = ownFrame;
      // Step 3: negative-z contexts paint AFTER this element's own
      // background/border and BEFORE all in-flow content. `first` is re-read
      // here (not captured earlier) so it reflects the children/text/pseudo that
      // have since been appended. insertBefore against a FIXED anchor preserves
      // insertion sequence - [a], [a,b], [a,b,c] - so the sorted array goes in
      // ascending, most-negative first, with no reverse.
      const first = f.anchor ? f.anchor.nextSibling : f.content.firstChild;
      for (const u of sortUnits(f.neg)) f.content.insertBefore(u.g, first);
      for (const u of f.z0)             f.content.appendChild(u.g);   // step 8 - tree order, NOT z-sorted
      for (const u of sortUnits(f.pos)) f.content.appendChild(u.g);   // step 9
    }

    // Last, because it needs both the measured descendant bounds and the hoisted
    // units to be in place before it can decide - and, if it decides against, strip
    // the references those hoists carried.
    finaliseOverflowClip();
  }

  // KNOWN LIMITATION: the PDF walker (`drawHtmlVectors`) has the identical
  // DOM-order defect and is deliberately untouched, so SVG/EMF/EPS/DXF get
  // stacking order under the flag and PDF does not. That is a new divergence in
  // two walkers whose own comments ask that they stay mirrored; it is recorded
  // at both sites rather than silently accepted.
  // The root call passes NO frame on purpose: `node` itself is the root stacking
  // context (`el === node` forces it), and its own <g> must land in rootG
  // directly. Handing it a frame nobody finalises would silently drop the whole
  // page if the export root ever happened to be positioned.
  await visitSvgNode(node, rootG, { frame: null, clips: [] });
  // ONE line for the whole walk (plans/104 section 12 Q2): what did not stay vector, and why.
  // The user was told in advance by the export panel's amber row; this is the record in
  // the log, and it is what a CLI or a headless caller has instead of that row.
  if (tiltedRasters) {
    _host?.log?.('info',
      `svg: ${tiltedRasters} tilted element${tiltedRasters === 1 ? '' : 's'} embedded as images `
      + '(SVG has no perspective transform; every untilted layer stayed vector)');
  }
  const xml = injectSvgMeta(new XMLSerializer().serializeToString(svgEl), opts.meta);

  // Parse-check before returning. This walker can emit XML that does not parse,
  // and it does it SILENTLY: the inline-<svg> passthrough clones live DOM and
  // re-serialises it, so one malformed attribute in authored markup (a `<path d="…`
  // that never closes - lib/icons.ts shipped exactly that) becomes an attribute
  // whose value contains `</svg><span class=`, and XMLSerializer faithfully writes
  // it out. The result was a 1.1 MB file, no thrown error, no warning, and it would
  // have been committed as a screenshot baseline.
  //
  // Print-derived output cannot fail this way - it consumes painted output, never
  // authored markup - so this gate is what buys the direct walker the same "fails
  // loudly or not at all" property. DOMParser puts <parsererror> in the result
  // rather than throwing, hence the explicit check.
  try {
    const probe = new DOMParser().parseFromString(xml, 'image/svg+xml');
    const err = probe.getElementsByTagName('parsererror')[0];
    if (err) {
      const detail = (err.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      throw new Error(`renderSvgFromHtml produced XML that does not parse: ${detail}`);
    }
  } catch (e) {
    // Rethrow as a plain, actionable error. Never return the bad bytes: a caller
    // that writes them to disk (the docs screenshot pipeline) has no other way to
    // notice, and a half-valid SVG renders as a blank box in every viewer.
    throw e instanceof Error ? e : new Error(String(e));
  }

  return new Blob(['<?xml version="1.0" standalone="no"?>\n' + xml], { type: 'image/svg+xml' });
}

// Underline / line-through carried by a computed style. text-decoration-line is NOT
// inherited, so a nested <strong>/<span> under a decorated ancestor computes 'none' - 
// the walkers therefore OR these flags down the tree rather than reading them only off
// the text node's immediate parent. (Neither vector walker reads text-decoration
// otherwise, so without this underline/strike render on screen but vanish in export.)
export interface Deco { u: boolean; s: boolean }
export function decoFlags(style: CSSStyleDeclaration): Deco {
  const td = String(style.textDecorationLine || style.textDecoration || '');
  return { u: /underline/.test(td), s: /line-through/.test(td) };
}
export function mergeDeco(a: Deco, b: Deco): Deco { return { u: a.u || b.u, s: a.s || b.s }; }

// Walks text nodes and inline elements, emitting one node per text line.
//
// By default each line becomes a true vector <path> (host.text.toPath, HarfBuzz
// shaped) so the SVG is self-contained and renders identically without the font
// installed - no bitmap, no <foreignObject>. Runs we can't vectorise faithfully
// (non-SUSE font, no host.text, letter-spacing) fall back to a positioned <text>
// element. Line positions come from Range.getBoundingClientRect, same strategy as
// renderInlineContent for PDF.
let shadowUid = 0;

async function emitInlineTextSvg(
  NS: string, blockEl: any, blockStyle: CSSStyleDeclaration,
  rootRect: { left: number; top: number }, parentG: Element, vectorText: boolean,
): Promise<void> {
  const textApi = vectorText ? _host?.text : null;
  // Filters need a <defs>. This function is called from both walkers and does not
  // own the document, so the sink is found from the tree it is writing into - the
  // root <svg>'s existing <defs>, or one created on demand.
  const ownerSvg = parentG.ownerDocument?.documentElement?.tagName === 'svg'
    ? parentG.ownerDocument.documentElement : parentG.closest?.('svg');
  const shadowDefs: Element = (ownerSvg?.querySelector?.('defs') as Element | null)
    ?? (() => {
      const d = document.createElementNS(NS, 'defs');
      (ownerSvg ?? parentG).insertBefore(d, (ownerSvg ?? parentG).firstChild);
      return d;
    })();

  async function walk(node: any, nodeStyle: CSSStyleDeclaration, deco: Deco): Promise<void> {
    if (node.nodeType === 3) {
      const text = node.textContent;
      if (!text || !text.trim()) return;
      const col = parseCssColorFull(nodeStyle.color);
      const fillAttr  = col ? `rgb(${col[0]},${col[1]},${col[2]})` : null;
      const alphaAttr = col && col[3] < 1 ? String(col[3]) : null;
      // Text stroke: CSS -webkit-text-stroke on HTML text, or SVG stroke inside inline
      // SVG, plus paint-order/linejoin so an outer stroke exports as painted.
      const strokeAttrs = textStrokeAttrs(nodeStyle, parseCssColorFull);
      const fontSizePx = parseFloat(nodeStyle.fontSize) || 16;
      // SUSE statics, a user's Google font (decompressed on demand) or the
      // platform face - whichever the family stack resolves to first.
      const vf = textApi ? await resolveVectorFont(nodeStyle, text) : null;
      const fontUrl = vf?.url ?? null;
      const vectorise = canVectoriseText(nodeStyle, fontUrl, Boolean(textApi));
      // Tracking + OpenType feature toggles are baked into the shaped path so the
      // outline matches the on-screen (and raster) run exactly.
      const letterSpacing = letterSpacingPx(nodeStyle.letterSpacing);
      const features = featureSettingsToHb(nodeStyle.fontFeatureSettings);

      // text-shadow, back-to-front (CSS paints the FIRST-listed shadow on top, so the
      // list is drawn in reverse). Each shadow is a DUPLICATE of the run's own
      // geometry - the outlined <path>, or the <text> fallback - recoloured, shifted
      // and blurred, rather than a filter on the original.
      //
      // Duplicates rather than a filter because a filter is all-or-nothing outside
      // SVG: svg-ir skips <filter> entirely, so an EMF/EPS/DXF export would lose the
      // shadow completely. A duplicated path survives those formats, and when the
      // blur is zero - the hard offset idiom - it is exact everywhere with no filter
      // at all.
      const textShadows = parseTextShadow(nodeStyle.textShadow).reverse();
      const appendWithShadows = (el: Element): void => {
        for (const sh of textShadows) {
          const col = parseCssColorFull(sh.color);
          if (!col) continue;
          const copy = el.cloneNode(true) as Element;
          copy.setAttribute('fill', `rgb(${col[0]},${col[1]},${col[2]})`);
          copy.setAttribute('fill-opacity', String(col[3]));
          // A stroke belongs to the text, not to its shadow: CSS shadows the rendered
          // glyph shape, and carrying the original's stroke colour through would draw
          // an outline in the wrong colour on top of the blur.
          copy.removeAttribute('stroke');
          copy.removeAttribute('stroke-width');
          copy.removeAttribute('stroke-opacity');
          // The offset goes on a wrapper so it composes with whatever transform the
          // original already carries (the outlined path is placed by translate()).
          const wrap = document.createElementNS(NS, 'g');
          wrap.setAttribute('transform', `translate(${n2(sh.x)},${n2(sh.y)})`);
          if (sh.blur > 0) {
            const fId = `fctxsh-${++shadowUid}`;
            const filt = document.createElementNS(NS, 'filter');
            filt.setAttribute('id', fId);
            filt.setAttribute('x', '-50%'); filt.setAttribute('y', '-50%');
            filt.setAttribute('width', '200%'); filt.setAttribute('height', '200%');
            // sRGB, because CSS composites shadows in sRGB and SVG's filter default
            // is linearRGB - the same blur looks materially lighter without this.
            filt.setAttribute('color-interpolation-filters', 'sRGB');
            const fe = document.createElementNS(NS, 'feGaussianBlur');
            fe.setAttribute('stdDeviation', String(n2(sh.blur / 2)));   // CSS blur radius → σ
            filt.appendChild(fe);
            shadowDefs.appendChild(filt);
            wrap.setAttribute('filter', `url(#${fId})`);
          }
          wrap.appendChild(copy);
          parentG.appendChild(wrap);
        }
        parentG.appendChild(el);
      };

      // Emit one run, positioned at its own line box `r`. Used per visual line.
      const placeLine = async (lineText: string, r: DOMRect) => {
        lineText = applyTextTransform(lineText, nodeStyle.textTransform);
        const x = r.left - rootRect.left;
        const top = r.top - rootRect.top;
        if (vectorise) {
          try {
            // `notdef` > 0 means this face has no glyph for something in the run - 
            // outlining would draw tofu, so keep the <text> fallback instead.
            const { d, notdef } = await textApi!.toPath({ text: lineText, fontUrl: fontUrl!, fontSize: fontSizePx, features: features as string[], letterSpacing, variations: vf!.variations, fallbackFonts: vf!.fallbacks });
            if (d && !notdef) {
              const { ascent, descent } = fontMetricsPx(nodeStyle, fontSizePx);
              const by = textBaselineY(top, r.height, ascent, descent);
              const p = document.createElementNS(NS, 'path');
              p.setAttribute('d', d);
              p.setAttribute('transform', `translate(${n2(x)},${n2(by)})`);
              if (fillAttr)  p.setAttribute('fill', fillAttr);
              if (alphaAttr) p.setAttribute('fill-opacity', alphaAttr);
              for (const [k, v] of strokeAttrs) p.setAttribute(k, v);
              appendWithShadows(p);
              return;
            }
          } catch (e) {
            _host?.log?.('warn', `svg: text-to-path failed, using <text> - ${(e as Error).message}`);
          }
        }
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x',                 String(n2(x)));
        t.setAttribute('y',                 String(n2(top)));
        t.setAttribute('dominant-baseline', 'text-before-edge');
        t.setAttribute('font-size',         nodeStyle.fontSize);
        t.setAttribute('font-weight',       nodeStyle.fontWeight);
        t.setAttribute('font-style',        nodeStyle.fontStyle);
        t.setAttribute('font-family',       nodeStyle.fontFamily);
        if (nodeStyle.letterSpacing && nodeStyle.letterSpacing !== 'normal') {
          t.setAttribute('letter-spacing', nodeStyle.letterSpacing);
        }
        if (fillAttr)  t.setAttribute('fill',         fillAttr);
        if (alphaAttr) t.setAttribute('fill-opacity', alphaAttr);
        for (const [k, v] of strokeAttrs) t.setAttribute(k, v);
        t.textContent = lineText;
        appendWithShadows(t);
      };

      // Draw underline / strikethrough as filled rects spanning the line box, in the
      // run's own colour - text-decoration is otherwise dropped by the vector walk.
      const drawDeco = (r: DOMRect) => {
        if (!fillAttr || (!deco.u && !deco.s)) return;
        const x = r.left - rootRect.left;
        const top = r.top - rootRect.top;
        const { ascent, descent } = fontMetricsPx(nodeStyle, fontSizePx);
        const by = textBaselineY(top, r.height, ascent, descent);
        const thick = Math.max(0.75, fontSizePx * 0.06);
        const bar = (yc: number) => {
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('x', String(n2(x)));
          rect.setAttribute('y', String(n2(yc - thick / 2)));
          rect.setAttribute('width', String(n2(r.width)));
          rect.setAttribute('height', String(n2(thick)));
          rect.setAttribute('fill', fillAttr);
          if (alphaAttr) rect.setAttribute('fill-opacity', alphaAttr);
          parentG.appendChild(rect);
        };
        if (deco.u) bar(by + fontSizePx * 0.11);   // just below the baseline
        if (deco.s) bar(by - fontSizePx * 0.28);   // through the x-height
      };

      // Split on explicit newlines first, then on soft wraps within each segment
      // (CSS-wrapped text has no '\n'). Each visual line is shaped and placed on
      // its own baseline; without this a wrapped run collapses onto one line.
      const segs = text.split('\n');
      let offset = 0;
      for (const seg of segs) {
        if (seg.trim().length > 0) {
          for (const line of visualLines(node, offset, offset + seg.length)) {
            if (line.rect.width > 0.5 && line.rect.height > 0.5) {
              await placeLine(line.text, line.rect);
              drawDeco(line.rect);
            }
          }
        }
        offset += seg.length + 1; // +1 for the '\n'
      }

    } else if (node.nodeType === 1) {
      if (node.tagName.toLowerCase() === 'br') return;
      const s = window.getComputedStyle(node);
      if (s.display === 'none') return;
      // Non-replaced `display: inline` only. Anything with a box of its own - 
      // inline-block, inline-flex, an <input>, an inline <svg> - is visited by
      // visitSvgNode, which paints its background, border and text as a unit.
      // Descending into it here as well would draw its text a second time.
      if (s.display !== 'inline' || isReplaced(node)) return;
      const cd = mergeDeco(deco, decoFlags(s));
      for (const child of node.childNodes) await walk(child, s, cd);
    }
  }
  for (const child of blockEl.childNodes) await walk(child, blockStyle, decoFlags(blockStyle));
}

/** Elements whose box is drawn by the UA rather than by their children: replaced
 *  content and form controls. They default to `display: inline` but are atomic - 
 *  the inline text walk has nothing to find inside them. */
const REPLACED = new Set(['img', 'svg', 'canvas', 'video', 'audio', 'iframe', 'object', 'embed',
                          'input', 'select', 'textarea', 'progress', 'meter']);
export function isReplaced(el: Element): boolean {
  return REPLACED.has(el.tagName.toLowerCase());
}

/**
 * Does this child have a box the block walk must paint?
 *
 * Everything except a non-replaced `display: inline`, whose background and text are
 * the inline walk's job. This predicate is the whole reason an inline-block's
 * background used to vanish: the loop tested for "inline flow" and skipped
 * inline-block and inline-flex along with inline, leaving them to a text pass that
 * paints no boxes at all - and leaving a replaced control, which has no text nodes,
 * emitting nothing whatsoever.
 *
 * `display: contents` has no box of its own but its CHILDREN do, and visitSvgNode
 * recurses, so it is included rather than dropped.
 */
/**
 * The children this element actually RENDERS - the flat tree, not the DOM tree.
 *
 * A shadow host renders its shadow root's children, not its own; its light children
 * appear only where a <slot> places them. Walking `el.children` therefore missed the
 * entire shadow tree (39–51 rendered elements per page in this app, which is
 * jelly-ui) while walking both would paint slotted content twice.
 */
export function renderedChildren(el: Element): Element[] {
  const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
  if (sr) return Array.from(sr.children) as Element[];
  if (el.tagName.toLowerCase() === 'slot') {
    // flatten:true resolves a slot forwarded into another slot.
    return (el as HTMLSlotElement).assignedElements?.({ flatten: true }) ?? [];
  }
  return Array.from(el.children) as Element[];
}

export function hasOwnBox(child: Element): boolean {
  const cd = window.getComputedStyle(child).display;
  return cd !== 'inline' || isReplaced(child);
}


// Split a text node's [start,end) offset range into visual lines, so CSS soft
// wrapping (which inserts no '\n') is honoured. We walk characters and start a
// new line whenever a glyph's top jumps; each line's edge whitespace is trimmed
// so its rect.left aligns with the first rendered glyph (collapsed leading spaces
// would otherwise shift the shaped run). Returns [{ text, rect }] per line.
export function visualLines(node: Node, start: number, end: number): { text: string; rect: DOMRect }[] {
  const probe = document.createRange();
  const breaks = [start];
  let prevTop: number | null = null;
  for (let i = start; i < end; i++) {
    probe.setStart(node, i);
    probe.setEnd(node, i + 1);
    const rects = probe.getClientRects();
    if (!rects.length) continue; // collapsed whitespace contributes no box
    const top = rects[rects.length - 1]!.top;
    if (prevTop === null) prevTop = top;
    else if (Math.abs(top - prevTop) > 0.5) { breaks.push(i); prevTop = top; }
  }
  breaks.push(end);

  const full = node.textContent as string;
  const out: { text: string; rect: DOMRect }[] = [];
  for (let k = 0; k + 1 < breaks.length; k++) {
    let s = breaks[k]!, e = breaks[k + 1]!;
    const slice = full.slice(s, e);
    s += slice.length - slice.replace(/^\s+/, '').length; // drop leading ws
    e -= slice.length - slice.replace(/\s+$/, '').length; // drop trailing ws
    if (e <= s) continue;
    probe.setStart(node, s);
    probe.setEnd(node, e);
    out.push({ text: full.slice(s, e), rect: probe.getBoundingClientRect() });
  }
  return out;
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

interface PseudoDescriptor {
  text: string; bg: Rgba | null; radii: CornerRadii; uniform: CornerPair | null;
  w: number; h: number; ps: CSSStyleDeclaration; x: number; y: number;
  /** The pseudo's own transform, LINEAR part only (rotate/scale/skew), about its
   *  transform-origin in root space. Null for none / pure translate / 3-D - the
   *  translate component is already folded into x/y, so a caller that ignores this
   *  still lands the common `translate(-50%,-50%)` centring idiom correctly. */
  mat: Mat2D | null;
}

/**
 * Does this element establish the containing block for an ABSOLUTELY positioned
 * descendant? `position !== static` is only the first clause of CSS Position 3 section 3.
 *
 * Missing the rest is not academic. `.profile-link` (the top-right profile pill) is
 * `position: static` with `backdrop-filter: blur(4px)` from the shared `.btn--glass`
 * alias - which makes it a containing block - so the browser anchors its `::before`
 * avatar dot to the PILL, while a position-only walk anchored it to the whole
 * `.gallery-topright` cluster 103px to the left. The dot came out sitting on top of
 * the settings button in every SVG and PDF export (docs/shots/use-utilities.svg).
 * Glass/blur chrome is used throughout this app, so the position-only rule is wrong
 * wherever a pseudo marker sits inside it.
 */
function establishesAbsContainingBlock(cs: CSSStyleDeclaration): boolean {
  if (cs.position !== 'static') return true;
  const s = cs as unknown as Record<string, string | undefined>;
  if (cs.transform && cs.transform !== 'none') return true;
  // The individual transform properties are equally sufficient (Transforms 2 section 3).
  for (const k of ['translate', 'rotate', 'scale']) {
    const v = s[k];
    if (v && v !== 'none') return true;
  }
  if (cs.perspective && cs.perspective !== 'none') return true;
  if (cs.filter && cs.filter !== 'none') return true;
  const backdrop = s.backdropFilter ?? s.webkitBackdropFilter;
  if (backdrop && backdrop !== 'none') return true;
  // `will-change` on any of the above is sufficient on its own - the point of the
  // property is that the browser promotes the element BEFORE the value changes.
  if (/\b(transform|perspective|filter|backdrop-filter|contain|translate|rotate|scale)\b/.test(cs.willChange || '')) return true;
  if (/\b(paint|layout|strict|content)\b/.test(cs.contain || '')) return true;
  const cv = s.contentVisibility;
  if (cv === 'auto' || cv === 'hidden') return true;
  return false;
}

/**
 * Does the browser skip painting this element even though its computed style says it
 * is visible? Two cases, both of which lay out normally and both of which the walker
 * would otherwise draw:
 *
 *   - a subtree inside a CLOSED <details> (excluding its own <summary>, which paints)
 *   - `content-visibility: hidden`, whose subtree is laid out but never painted
 *
 * checkVisibility() knows about both, but its `checkOpacity`/`checkVisibilityCSS`
 * options overlap gates the walk already applies more precisely (an opacity-0 element
 * is dropped a line above, and the walker's own opacity handling is richer), so the
 * DOM answer is used only as a cross-check on the two cases above.
 */
function isPaintSkipped(el: Element, style: CSSStyleDeclaration): boolean {
  if (style.contentVisibility === 'hidden') return true;
  const details = el.closest('details:not([open])');
  // closest() matches the element itself: the <details> box is painted (it is the
  // card), only its non-summary CONTENTS are skipped.
  if (!details || details === el) return false;
  // The summary is the part a closed <details> DOES paint - as is anything inside it.
  const summary = details.querySelector(':scope > summary');
  return !(summary && summary.contains(el));
}

// Resolve a CSS generated-content pseudo-element (::before/::after) into a drawable
// descriptor, or null if it has nothing visible. The DOM walkers only see real
// nodes, so list markers / arrows authored as ::before content (e.g. dynamic-layout's
// bullet dots and → arrows) are otherwise dropped from SVG/PDF. Scoped to the
// absolutely-positioned marker idiom - a pseudo has no getBoundingClientRect, so its
// box is computed from its containing block (nearest positioned ancestor) padding box
// + the pseudo's own left/top/size. The padding box's origin is the padding EDGE - 
// just inside the border, NOT inside the padding (CSS 2.1 section 10.1) - so the offset adds
// border widths only. Inline/static generated content isn't modelled.
function pseudoDescriptor(el: Element, name: string): PseudoDescriptor | null {
  const ps = window.getComputedStyle(el, name);
  const content = ps.content;
  if (!content || content === 'none' || content === 'normal') return null;
  if (ps.position !== 'absolute') return null;
  // The same visibility gate the element walk applies (see visit(), ~L2135). A pseudo
  // the browser does not paint must not be emitted. Two shipping idioms hide a pseudo
  // with opacity alone and were being drawn anyway: `.plat-swatch-chip::after` (the
  // word "Copied" over a 55%-black scrim, revealed for 900ms by a click handler) and
  // `[data-tip]::after` (the tooltip bubble). Without this, every colour chip in a
  // capture came back darkened and captioned, and every tooltip host grew a ghost
  // pill - in SVG *and* PDF, since both call this one descriptor.
  if (ps.display === 'none' || ps.visibility === 'hidden') return null;
  if (!(parseFloat(ps.opacity || '1') > 0)) return null;
  const w = parseFloat(ps.width)  || 0;
  const h = parseFloat(ps.height) || 0;
  const bg = parseCssColorFull(ps.backgroundColor);
  // getComputedStyle returns the resolved string with real chars (e.g. '"→"'),
  // already quoted; unwrap it. counter()/attr() values won't match and are skipped.
  const m = content.match(/^["'](.*)["']$/s);
  const text = applyTextTransform(m ? m[1]! : '', ps.textTransform);
  if (!text.trim() && !(bg && w > 0.5 && h > 0.5)) return null;

  let cb: Element | null = el;
  while (cb && !establishesAbsContainingBlock(window.getComputedStyle(cb))) cb = cb.parentElement;
  cb = cb || el;
  const cbRect = cb.getBoundingClientRect();
  const cbStyle = window.getComputedStyle(cb);
  const ox = cbRect.left + (parseFloat(cbStyle.borderLeftWidth) || 0);
  const oy = cbRect.top  + (parseFloat(cbStyle.borderTopWidth)  || 0);
  const left = parseFloat(ps.left);
  const top  = parseFloat(ps.top);
  const { radii, uniform } = resolveRadii(ps, w, h);
  // The pseudo's OWN transform. `translate(-50%, -50%)` on an absolutely positioned
  // marker is the standard centring idiom (and is what `.profile-link::before` uses),
  // so ignoring it drops the marker half its own size down and right of where the
  // browser paints it - the mispositioned ghost tooltips noted above were this.
  // The translate lands in x/y for every caller; only a rotate/scale/skew needs the
  // matrix branch, which the SVG emitter wraps in a <g>.
  const mat = parseCssMatrix(ps.transform);
  const x = ox + (isFinite(left) ? left : 0) + (mat ? mat.e : 0);
  const y = oy + (isFinite(top)  ? top  : 0) + (mat ? mat.f : 0);
  const linear = mat && !(Math.abs(mat.a - 1) < 1e-6 && Math.abs(mat.b) < 1e-6
    && Math.abs(mat.c) < 1e-6 && Math.abs(mat.d - 1) < 1e-6)
    ? { a: mat.a, b: mat.b, c: mat.c, d: mat.d, e: 0, f: 0 }
    : null;
  return { text, bg, radii, uniform, w, h, ps, x, y, mat: linear };
}

// Emit any ::before/::after markers of `el` into the SVG group `parentG`.
//
// `defer` (page-snapshot stacking-order mode only) supplies a <g> for one pseudo
// given its used z-index, having already placed that <g> in the right Appendix E
// layer of the enclosing stacking context. Absent ⇒ everything appends to
// parentG exactly as before, which is what every tool export does - EXCEPT a
// pseudo with a NEGATIVE z-index, which CSS paints under the element's in-flow
// content: `negInsert` places its <g> at the element's own-paint boundary, so a
// full-bleed `::before { z-index: -1 }` wash lands under the text it sits
// behind on screen instead of over it (jump's cinema scenes shipped with every
// label buried under its scene wash this way).
async function svgPseudoContent(
  NS: string, parentG: Element, rootRect: { left: number; top: number }, el: Element, vectorText: boolean,
  defer?: (z: number) => Element, negInsert?: (pg: Element) => void,
): Promise<void> {
  for (const name of ['::before', '::after']) {
    const ds = pseudoDescriptor(el, name);
    if (!ds) continue;
    const x = ds.x - rootRect.left;
    const y = ds.y - rootRect.top;
    // pseudoDescriptor already guarantees `position: absolute`, so the pseudo is
    // a positioned descendant; only its z-index decides which layer.
    const zRaw = (ds.ps.zIndex || 'auto').trim();
    const z = zRaw === 'auto' ? 0 : (Number.parseInt(zRaw, 10) || 0);
    let parentG_: Element;
    if (defer) {
      parentG_ = defer(z);
    } else if (z < 0 && negInsert) {
      parentG_ = document.createElementNS(NS, 'g');
      negInsert(parentG_);
    } else {
      parentG_ = parentG;
    }
    // A rotate/scale/skew on the pseudo itself: one <g> about its transform-origin,
    // holding the fill and the text. (The translate component is already in x/y.)
    if (ds.mat) {
      // A COMPUTED transform-origin is always resolved to px, so parseFloat is the
      // whole parse - same read rotationPivot() does for real elements.
      const o = String(ds.ps.transformOrigin || '').split(' ').map(parseFloat);
      const pivotX = x + (Number.isFinite(o[0]!) ? o[0]! : ds.w / 2);
      const pivotY = y + (Number.isFinite(o[1]!) ? o[1]! : ds.h / 2);
      const tg = document.createElementNS(NS, 'g');
      tg.setAttribute('transform', matToSvg(matAboutPivot(ds.mat, pivotX, pivotY)));
      parentG_.appendChild(tg);
      parentG_ = tg;
    }
    if (ds.bg && ds.w > 0.5 && ds.h > 0.5) {
      const f = ds.bg[3] < 1
        ? `rgba(${ds.bg[0]},${ds.bg[1]},${ds.bg[2]},${ds.bg[3]})`
        : `rgb(${ds.bg[0]},${ds.bg[1]},${ds.bg[2]})`;
      parentG_.appendChild(makeRoundedFill(NS, x, y, ds.w, ds.h, ds.radii, ds.uniform, f));
    }
    if (!ds.text.trim()) continue;
    const fontSizePx = parseFloat(ds.ps.fontSize) || 16;
    const vf = vectorText && _host?.text ? await resolveVectorFont(ds.ps, ds.text) : null;
    const fontUrl = vf?.url ?? null;
    const col = parseCssColorFull(ds.ps.color);
    const fillAttr  = col ? `rgb(${col[0]},${col[1]},${col[2]})` : null;
    const alphaAttr = col && col[3] < 1 ? String(col[3]) : null;
    const lineH = parseFloat(ds.ps.lineHeight) || fontSizePx * 1.2;
    const strokeAttrs = textStrokeAttrs(ds.ps, parseCssColorFull);
    let placed = false;
    if (vectorText && canVectoriseText(ds.ps, fontUrl, Boolean(_host?.text))) {
      try {
        const { d, notdef } = await _host!.text!.toPath({ text: ds.text, fontUrl: fontUrl!, fontSize: fontSizePx, variations: vf!.variations, fallbackFonts: vf!.fallbacks });
        if (d && !notdef) {
          const { ascent, descent } = fontMetricsPx(ds.ps, fontSizePx);
          const by = textBaselineY(y, lineH, ascent, descent);
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', d);
          p.setAttribute('transform', `translate(${n2(x)},${n2(by)})`);
          if (fillAttr)  p.setAttribute('fill', fillAttr);
          if (alphaAttr) p.setAttribute('fill-opacity', alphaAttr);
          for (const [k, v] of strokeAttrs) p.setAttribute(k, v);
          parentG_.appendChild(p);
          placed = true;
        }
      } catch (e) { _host?.log?.('warn', `svg: pseudo text-to-path failed - ${(e as Error).message}`); }
    }
    if (!placed) {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x',                 String(n2(x)));
      t.setAttribute('y',                 String(n2(y)));
      t.setAttribute('dominant-baseline', 'text-before-edge');
      t.setAttribute('font-size',         ds.ps.fontSize);
      t.setAttribute('font-weight',       ds.ps.fontWeight);
      t.setAttribute('font-style',        ds.ps.fontStyle);
      t.setAttribute('font-family',       ds.ps.fontFamily);
      if (fillAttr)  t.setAttribute('fill',         fillAttr);
      if (alphaAttr) t.setAttribute('fill-opacity', alphaAttr);
      for (const [k, v] of strokeAttrs) t.setAttribute(k, v);
      t.textContent = ds.text;
      parentG_.appendChild(t);
    }
  }
}

function makeSvgRect(NS: string, x: number, y: number, w: number, h: number, rx: number, fill: string, ry: number = rx): Element {
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

// Builds a <linearGradient> SVG element from a CSS linear-gradient() value.
// Uses gradientUnits="userSpaceOnUse" so coordinates match the canvas space.
// Returns null if the value is not a parseable linear gradient.
export function buildLinearGradientEl(NS: string, bgImage: string, elX: number, elY: number, elW: number, elH: number, uid: number): Element | null {
  // ONE layer only. `.+` is greedy, so a two-layer `linear-gradient(…), linear-gradient(…)`
  // otherwise matches as a single gradient and both stop lists are concatenated into one
  // element - offsets restart mid-list and SVG clamps them, so the second layer's colours
  // smear over the first. Callers split the layer list and emit one element per layer.
  if (splitCssArgs(bgImage).length > 1) return null;
  const m = bgImage.match(/^linear-gradient\((.+)\)$/s);
  if (!m) return null;
  const parts = splitCssArgs(m[1]!);
  if (parts.length < 2) return null;

  let angleRad = Math.PI; // default: to bottom
  let stopsStart = 0;
  const first = parts[0]!.trim();
  if (/^to\s|deg$|turn$|rad$|grad$/.test(first)) {
    angleRad  = parseGradientAngle(first);
    stopsStart = 1;
  }

  const stops = parts.slice(stopsStart);
  if (stops.length < 2) return null;

  // Gradient line through the element centre; length guarantees full coverage
  // at any angle via: |w·sin(A)| + |h·cos(A)| / 2.
  const sinA = Math.sin(angleRad);
  const cosA = Math.cos(angleRad);
  const cx   = elX + elW / 2;
  const cy   = elY + elH / 2;
  const len  = (Math.abs(elW * sinA) + Math.abs(elH * cosA)) / 2;

  const grad = document.createElementNS(NS, 'linearGradient');
  grad.setAttribute('id',            `svggrad-${uid}`);
  grad.setAttribute('gradientUnits', 'userSpaceOnUse');
  grad.setAttribute('x1', String(cx - sinA * len));
  grad.setAttribute('y1', String(cy + cosA * len));
  grad.setAttribute('x2', String(cx + sinA * len));
  grad.setAttribute('y2', String(cy - cosA * len));

  const n = stops.length;
  const parsedStops = expandGradientStops(
    stops.map((raw: string, i: number) => parseGradientStop(raw.trim(), i, n)).filter((st) => st.colorStr));
  parsedStops.forEach(({ colorStr, opacity, offset }) => {
    const s = document.createElementNS(NS, 'stop');
    // An absolute CSS stop position is a distance ALONG THE GRADIENT LINE, whose
    // full length is 2*len. <stop offset> takes a number 0-1 or a percentage, so a
    // raw "25px" is INVALID SVG: resvg discards it outright (measured - both stops
    // of a two-stop strip collapse to the last colour), and the rendering drifts
    // badly from the browser's (mean channel error up to 133 on a 3-stop gradient,
    // 99.8% of pixels wrong; 0.02 once converted). parseRadialGradient's stop loop
    // has always divided by rx for exactly this reason - this is the linear analogue.
    s.setAttribute('offset', offset.endsWith('px') && len > 0
      ? `${n2(parseFloat(offset) / (2 * len) * 100)}%`
      : offset);
    s.setAttribute('stop-color', colorStr!);
    if (opacity < 1) s.setAttribute('stop-opacity', String(opacity));
    grad.appendChild(s);
  });

  return grad.childNodes.length >= 2 ? grad : null;
}

// Builds a <radialGradient> SVG element from a CSS radial-gradient() value. Geometry
// (centre + rx/ry in box px) + stops come from the engine's parseRadialGradient; here we
// only assemble the SVG. An ellipse (rx≠ry) is emitted as a circle of radius rx with a
// y-scale gradientTransform about the centre. gradientUnits="userSpaceOnUse" so coords
// match the canvas. Returns null if the value isn't a parseable radial gradient.
/**
 * A conic gradient as a fan of wedges.
 *
 * Each wedge is a solid-filled pie slice between two angles, its colour sampled from
 * the stop list at the wedge's midpoint. Enough wedges and the banding is below the
 * threshold anyone can see; the count scales with the box so a small dial doesn't pay
 * for a page background's smoothness.
 *
 * The radius reaches the FARTHEST corner from the centre - a conic gradient covers
 * the whole box even when its centre is off to one side, and using half the diagonal
 * would leave an unpainted crescent.
 *
 * CSS measures the angle clockwise from 12 o'clock; SVG's coordinate zero is at 3
 * o'clock. The −90° here is that difference, and dropping it rotates every gradient
 * on the page by a quarter turn.
 */
export function conicFanEl(NS: string, cg: ConicGradient, x: number, y: number, w: number, h: number, gid: number): Element | null {
  const cx = x + cg.cx, cy = y + cg.cy;
  const R = Math.max(
    Math.hypot(cg.cx, cg.cy), Math.hypot(w - cg.cx, cg.cy),
    Math.hypot(cg.cx, h - cg.cy), Math.hypot(w - cg.cx, h - cg.cy),
  );
  if (!(R > 0) || !Number.isFinite(R)) return null;

  // Stops as fractions of the sweep, in order, with any unpositioned ones already
  // spread evenly by parseGradientStop.
  const raw = cg.stops
    .map((st) => ({
      col: st.colorStr!, op: st.opacity,
      at: parseFloat(st.offset) / (st.offset.endsWith('%') ? 100 : 360),
      // Parsed once per stop, not once per sampled wedge (this fan is up to 360 of them).
      // parseGradientStop returns an OPAQUE colorStr with the alpha split into
      // `opacity` - re-parsing the hex alone read `transparent` as opaque black,
      // which painted the checkerboard idiom's clear wedges solid. Restore it.
      cc: (() => { const c = parseColor(st.colorStr!); return c ? { ...c, alpha: st.opacity } : null; })(),
    }))
    .filter((st) => Number.isFinite(st.at));
  if (raw.length < 2) return null;
  // CSS gradient stop fixup: an offset smaller than the one before it is CLAMPED up
  // to it, which is how a hard-edged stop is written (`red 0 25%, blue 0 50%`).
  // Sorting instead would silently reorder those into a smooth ramp - and the
  // checkerboard behind every tool canvas is exactly that idiom.
  const stops = raw.map((st, i, all) => ({ ...st, at: i ? Math.max(st.at, all[i - 1]!.at) : st.at }));
  for (let i = 1; i < stops.length; i++) stops[i]!.at = Math.max(stops[i]!.at, stops[i - 1]!.at);

  // A repeating gradient's stop list is ONE period that tiles around the circle.
  const first = stops[0]!.at, last = stops[stops.length - 1]!.at;
  const period = cg.repeating && last > first ? last - first : 0;

  const sample = (tRaw: number): { col: string; op: number } => {
    const t = period ? first + (((tRaw - first) % period) + period) % period : tRaw;
    if (t <= stops[0]!.at) return stops[0]!;
    const last = stops[stops.length - 1]!;
    if (t >= last.at) return last;
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1]!, b = stops[i]!;
      if (t <= b.at) {
        const span = b.at - a.at;
        const f = span > 0 ? (t - a.at) / span : 0;
        if (!a.cc || !b.cc) return f < 0.5 ? a : b;
        // sRGB interpolation, PREMULTIPLIED - matching what the browser paints for
        // the same conic (CSS Color 4 section 12.3). Lerping the channels raw instead drags
        // a `red → transparent` sweep through dark red at 50% instead of holding red
        // and fading it, so the exported fan disagreed with the screen. The engine
        // owns the maths (one interpolator for every format).
        const mixed = interpolateColor(a.cc, b.cc, f, { space: 'srgb' });
        const [r, g, bl, al] = colorToSrgb8(mixed);
        // Alpha rides on fill-opacity below, so the fill itself is the opaque colour.
        return { col: `rgb(${r},${g},${bl})`, op: al };
      }
    }
    return last;
  };

  const g = document.createElementNS(NS, 'g');
  const base = cg.fromRad - Math.PI / 2;
  /** One wedge from sweep fraction `t0` to `t1`, in the gradient's own angular space. */
  const wedge = (t0: number, t1: number, col: string, op: number): void => {
    const a0 = base + t0 * 2 * Math.PI;
    // Overlap into the next wedge by a hair: exact shared edges leave a visible seam of
    // background colour where two antialiased edges meet.
    const a1 = base + t1 * 2 * Math.PI + 0.004;
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d',
      `M${n2(cx)} ${n2(cy)}L${n2(cx + R * Math.cos(a0))} ${n2(cy + R * Math.sin(a0))}` +
      `A${n2(R)} ${n2(R)} 0 ${t1 - t0 > 0.5 ? 1 : 0} 1 ${n2(cx + R * Math.cos(a1))} ${n2(cy + R * Math.sin(a1))}Z`);
    p.setAttribute('fill', col);
    if (op < 1) p.setAttribute('fill-opacity', String(Math.round(op * 1000) / 1000));
    p.setAttribute('shape-rendering', 'crispEdges');
    g.appendChild(p);
  };

  // ── hard-stop fast path: EXACT sectors, not sampled wedges ──────────────────
  // A conic built entirely of constant-colour bands (`A 0 25%, B 0 50%` - the
  // checkerboard idiom) has a precise vector form: one path per band, boundaries on the
  // stop angles. Sampling it as a uniform fan instead puts wedge edges WHERE THE COLOUR
  // DOES NOT CHANGE, and each of those edges carries the 0.004rad overlap above - which
  // is why a 14px checker tile came out with faint diagonal hairlines across every
  // square. Exact sectors also collapse ~48 paths to 2.
  const bands: { from: number; to: number; col: string; op: number }[] = [];
  let hardStopped = stops.length >= 2;
  for (let i = 1; i < stops.length && hardStopped; i++) {
    const a = stops[i - 1]!, b = stops[i]!;
    if (a.col === b.col && Math.abs(a.op - b.op) < 1e-6) {
      if (b.at - a.at > 1e-9) bands.push({ from: a.at, to: b.at, col: a.col, op: a.op });
    } else if (b.at - a.at > 1e-9) {
      hardStopped = false;                    // a genuine ramp between two colours
    }
  }
  if (hardStopped && bands.length) {
    // A repeating gradient's bands tile around the circle; a non-repeating one paints
    // its first and last colours out to the ends of the sweep (CSS Images 3 section 5.4).
    const emit = (from: number, to: number, col: string, op: number): void => {
      const lo = Math.max(0, from), hi = Math.min(1, to);
      if (hi - lo > 1e-9 && op > 0) wedge(lo, hi, col, op);   // a clear band paints nothing
    };
    if (period > 0) {
      for (let k = 0; first + k * period < 1 + period; k++) {
        for (const b of bands) emit(b.from + k * period, b.to + k * period, b.col, b.op);
      }
    } else {
      const head = stops[0]!, tail = stops[stops.length - 1]!;
      emit(0, first, head.col, head.op);
      for (const b of bands) emit(b.from, b.to, b.col, b.op);
      emit(last, 1, tail.col, tail.op);
    }
    void gid;
    return g.childNodes.length ? g : null;
  }

  // One wedge per ~1.5° at page scale, fewer for a small dial. Capped so a huge
  // element cannot emit thousands of paths.
  const n = Math.max(48, Math.min(360, Math.round(R / 2)));
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const { col, op } = sample((t0 + t1) / 2);
    wedge(t0, t1, col, op);
  }
  void gid;
  return g;
}

export function buildRadialGradientEl(NS: string, bgImage: string, elX: number, elY: number, elW: number, elH: number, uid: number): Element | null {
  if (splitCssArgs(bgImage).length > 1) return null;   // one LAYER per element - see buildLinearGradientEl
  const g = parseRadialGradient(bgImage, elW, elH);
  if (!g) return null;
  const { rx, ry } = g;
  const CX = elX + g.cx, CY = elY + g.cy;
  const grad = document.createElementNS(NS, 'radialGradient');
  grad.setAttribute('id',            `svggrad-${uid}`);
  grad.setAttribute('gradientUnits', 'userSpaceOnUse');
  grad.setAttribute('cx', String(n2(CX)));
  grad.setAttribute('cy', String(n2(CY)));
  grad.setAttribute('r',  String(n2(rx)));
  if (Math.abs(rx - ry) > 0.01) {
    const sy = ry / rx;                            // scale y about CY: leaves cx/cy fixed
    grad.setAttribute('gradientTransform', `matrix(1,0,0,${n2(sy)},0,${n2(CY * (1 - sy))})`);
  }
  for (const { colorStr, opacity, offset } of g.stops) {
    const s = document.createElementNS(NS, 'stop');
    // A px stop offset is a distance along the radius → fraction of rx (SVG stops take
    // 0–1 / %); percentages pass through unchanged.
    s.setAttribute('offset', offset.endsWith('px') ? `${n2(parseFloat(offset) / rx * 100)}%` : offset);
    s.setAttribute('stop-color', colorStr!);
    if (opacity < 1) s.setAttribute('stop-opacity', String(opacity));
    grad.appendChild(s);
  }
  return grad.childNodes.length >= 2 ? grad : null;
}




// Build an SVG <filter> of chained <feDropShadow> primitives for the given shadows
// (parsed DOM-free by the engine's parseDropShadowFilter). A generous filter region
// (-50%…200%) keeps large offsets/blurs from being clipped.
/**
 * `filter: drop-shadow(…)` as an SVG filter.
 *
 * The blur value is used as the standard deviation DIRECTLY, which is the one thing
 * here that looks like a bug and is not. `box-shadow: … 12px` and
 * `drop-shadow(… 12px)` do NOT produce the same blur: box-shadow's value is a radius
 * of 2σ, drop-shadow's IS σ. Measured against Chromium at blur 4, 6, 12, 24 and 40,
 * σ = blur is exact (0.000% pixel error) and σ = blur/2 - which this used to emit,
 * on the reasonable-sounding grounds that it "matches box-shadow" - is off by up to
 * 2.3% mean and 12.5% on a single pixel.
 */
function buildDropShadowFilterEl(NS: string, shadows: { dx: number; dy: number; blur: number; color: string }[], id: string,
                                 box?: { x: number; y: number; w: number; h: number }): Element {
  const filt = document.createElementNS(NS, 'filter');
  filt.setAttribute('id', id);
  // A region sized from the actual blur and offsets. The old -50%/200% bounding-box
  // form is a fraction of the ELEMENT, so a big blur on a small element was clipped
  // by its own filter region.
  const reach = shadows.reduce((n, sh) => Math.max(n, sh.blur * 3 + Math.abs(sh.dx) + Math.abs(sh.dy)), 0) + 8;
  if (box) {
    filt.setAttribute('filterUnits', 'userSpaceOnUse');
    filt.setAttribute('x', String(n2(box.x - reach))); filt.setAttribute('y', String(n2(box.y - reach)));
    filt.setAttribute('width', String(n2(box.w + 2 * reach))); filt.setAttribute('height', String(n2(box.h + 2 * reach)));
  } else {
    filt.setAttribute('x', '-50%'); filt.setAttribute('y', '-50%');
    filt.setAttribute('width', '200%'); filt.setAttribute('height', '200%');
  }
  // CSS composites filters in sRGB; SVG's default is linearRGB.
  filt.setAttribute('color-interpolation-filters', 'sRGB');
  for (const sh of shadows) {
    const fe = document.createElementNS(NS, 'feDropShadow');
    fe.setAttribute('dx', String(n2(sh.dx)));
    fe.setAttribute('dy', String(n2(sh.dy)));
    fe.setAttribute('stdDeviation', String(n2(sh.blur)));   // NOT blur/2 - see above
    const col = parseCssColorFull(sh.color);
    if (col) { fe.setAttribute('flood-color', `rgb(${col[0]},${col[1]},${col[2]})`); fe.setAttribute('flood-opacity', String(col[3])); }
    else fe.setAttribute('flood-color', sh.color);
    filt.appendChild(fe);
  }
  return filt;
}

// Resolve the print-marks geometry for a trim box already in points - the size-only
// core, shared by the single-page path (below) and the per-page multi-page path
// (renderMultiPagePdf). Null when no bleed and no marks are requested (the legacy
// "page == trim, art fills it" path). The null gate reads ONLY opts, so geo-ness is
// uniform across every page of a given export - only the numeric values scale.
function printGeometryForSize(trimWpt: number, trimHpt: number, opts: ExportOpts, paletteSource: BrandPaletteEntry[] | undefined): PrintGeometry | null {
  const bleedDim = parseDimension(opts.bleed);
  const bleedPt = bleedDim ? toPoints(bleedDim) : 0;
  const marks = {
    crop:         Boolean(opts.cropMarks),
    registration: Boolean(opts.registrationMarks),
    bleed:        Boolean(opts.bleedMarks),
    colorBars:    Boolean(opts.colorBars),
    provenance:   Boolean(opts.provenance),
  };
  const anyMark = marks.crop || marks.registration || marks.bleed || marks.colorBars || marks.provenance;
  if (bleedPt <= 0 && !anyMark) return null;
  // Brand swatches drive the colour bar (RGB swatches for RGB output, RGB-beside-CMYK
  // pairs for CMYK). The plain RGB PDF with no palette gets the generic process bar.
  const palette = marks.colorBars ? brandSwatchPalette(paletteSource) : [];
  return computePrintGeometry({ trimWpt, trimHpt, bleedPt, marks, palette, barStyle: opts.barStyle, barRadiusPt: opts.barRadiusPt });
}

// The whole-export geometry (the node's own box). One marks-building path only - 
// see engine/src/print-marks.ts for the geometry, the single source of truth.
function printGeometry(node: Element, opts: ExportOpts, paletteSource: BrandPaletteEntry[] | undefined = opts.palette): PrintGeometry | null {
  const d = exportDims(node, opts);
  return printGeometryForSize(toPoints(d.w), toPoints(d.h), opts, paletteSource);
}


// Render the artwork to a jsPDF blob. Without geometry the page is the trim size
// and the design fills it (unchanged legacy behaviour, incl. optional jsPDF
// encryption). With geometry the page is the full sheet and the design is drawn
// (scaled) into the bleed box; page boxes + marks are added later in pdf-lib.
async function renderArtworkPdf(node: Element, opts: ExportOpts, geo: PrintGeometry | null): Promise<Blob> {
  const mod: any = await import('jspdf');
  const jsPDF = mod.jsPDF ?? mod.default?.jsPDF ?? mod.default;

  // Page size in points (1/72"). Physical units convert exactly; px maps via
  // the CSS 96-DPI convention, preserving existing pixel-based tools.
  const d = exportDims(node, opts);
  const trimW = toPoints(d.w);
  const trimH = toPoints(d.h);
  const pageW = geo ? geo.page.w : trimW;
  const pageH = geo ? geo.page.h : trimH;
  const art   = geo ? geo.artwork : { x: 0, y: 0, w: trimW, h: trimH };

  // orientation must be derived from the actual dimensions - jsPDF's default
  // 'portrait' mode swaps format[0] and format[1] when width > height, which
  // would produce an inverted page with all drawHtmlVectors coordinates wrong.
  const orientation = pageW >= pageH ? 'landscape' : 'portrait';

  // A non-empty opts.password locks the PDF on open via jsPDF's standard security
  // handler (user = owner password; printing-only permissions). Only the plain
  // RGB path with NO print finishing encrypts - print marks/boxes are applied in
  // pdf-lib, which can't write encrypted PDFs, so the two are mutually exclusive
  // (the UI hides the password field when marks/bleed are on). `undefined` is a
  // no-op (jsPDF treats it as unencrypted).
  const encryption = (opts.password && !geo)
    ? { userPassword: opts.password, ownerPassword: opts.password, userPermissions: ['print'] }
    : undefined;
  const pdf = new jsPDF({ unit: 'pt', format: [pageW, pageH], orientation, encryption });
  applyPdfMeta(pdf, opts.meta);

  // SVG-rooted canvas (the node IS an <svg>, or its only meaningful child is) →
  // walk the SVG element directly as vectors. This avoids drawHtmlVectors, which
  // skips SVG elements that have `display:inline` (the HTML default), resulting
  // in a blank page for tools like the QR code generator whose template is just
  // a bare <svg> with no explicit display:block.
  const svgRoot = node.tagName?.toLowerCase() === 'svg' ? node
    : isSvgRooted(node) ? node.querySelector('svg') : null;
  if (svgRoot) {
    await drawSvgVectorsInRegion(pdf, svgRoot, art.x, art.y, art.w, art.h, new Set(), opts._imprintSink, opts.convertPaths !== false);
  } else {
    await drawHtmlVectors(pdf, node, art.x, art.y, art.w, art.h, opts.convertPaths !== false, opts.onProgress, opts.rasterFallback !== false, opts._imprintSink, opts.signal);
  }

  return pdf.output('blob');
}

// Stamp the document-info dictionary (creator/author/title/…) onto a jsPDF
// instance. Shared by the single-page and multi-page paths.
function applyPdfMeta(pdf: any, m: ExportMeta | null | undefined): void {
  const creator = m?.software || 'Lolly';
  pdf.setProperties({
    creator,                               // the producing app always
    author: m?.author || creator,          // the user if known, else the app
    title: m?.tool || undefined,
    subject: m?.description || undefined,
    keywords: m ? [m.software, m.source, m.contact].filter(Boolean).join(', ') : undefined,
  });
}

// Strong tier - AES-256 (R6 / ISO 32000-2) applied as a FINAL encrypt-last pass
// over already-finished PDF bytes. Unlike the jsPDF-native 40-bit RC4 `password`
// (which must be built into an unfinished document), this reopens the finished
// bytes with pdf-lib and encrypts every string/stream, so it composes with the
// PDF/X-4 / CMYK / print-marks finishing passes. The engine owns the crypto
// (buildEncryptDictValues / encryptObjectBytes - DOM-free, byte-vector-tested);
// this function owns the pdf-lib object walk + /Encrypt dict assembly. R6 uses one
// file key for every object (no per-object derivation) and a fresh IV per object.
export async function encryptPdfStrong(blob: Blob, password: string): Promise<Blob> {
  const { PDFDocument, PDFString, PDFHexString, PDFRawStream, PDFStream, PDFDict, PDFArray } =
    await import('pdf-lib') as any;
  // updateMetadata:false - the finished bytes already carry Lolly's /Producer +
  // dates (from applyPdfX / renderCmykPdf); pdf-lib would otherwise overwrite them
  // with "pdf-lib …" + the load time, which we'd then encrypt into the file (and it
  // would disagree with the still-Lolly XMP). Same guard finishPdfX uses.
  const doc = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()), { updateMetadata: false });
  const ctx = doc.context;

  const rnd = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n));
  const hexU = (b: Uint8Array): string => {
    let s = '';
    for (const x of b) s += x.toString(16).padStart(2, '0');
    return s.toUpperCase();
  };

  // Permissions: grant everything (P = -4). The open-password IS the protection;
  // per-permission restrictions are unenforceable anyway once the opener holds the
  // (owner) password, and Lolly uses the same value for user and owner.
  const P = -4;
  const fileKey = rnd(32);
  const vals = await buildEncryptDictValues({
    userPw: preparePassword(password),
    ownerPw: preparePassword(password),
    fileKey,
    salts: { uvs: rnd(8), uks: rnd(8), ovs: rnd(8), oks: rnd(8) },
    permsRandom: rnd(4),
    P,
    encryptMetadata: true,
  });

  // Public /ID (never encrypted).
  const idArr = PDFArray.withContext(ctx);
  idArr.push(PDFHexString.of(hexU(rnd(16))));
  idArr.push(PDFHexString.of(hexU(rnd(16))));

  // The /Encrypt dict - its own strings (U/O/UE/OE/Perms) are stored raw, so it is
  // registered AFTER the encryption walk (below), never encrypted. /Length is 256
  // (BITS) at top level but 32 (BYTES) inside the crypt filter - the classic trap.
  const encDict = ctx.obj({
    Filter: 'Standard', V: 5, R: 6, Length: 256, P,
    U: PDFHexString.of(hexU(vals.U)),
    O: PDFHexString.of(hexU(vals.O)),
    UE: PDFHexString.of(hexU(vals.UE)),
    OE: PDFHexString.of(hexU(vals.OE)),
    Perms: PDFHexString.of(hexU(vals.Perms)),
    CF: { StdCF: { CFM: 'AESV3', AuthEvent: 'DocOpen', Length: 32 } },
    StmF: 'StdCF', StrF: 'StdCF', EncryptMetadata: true,
  });

  // Encrypt every string (→ PDFHexString, which serialises verbatim - PDFString
  // does not escape binary) and every stream body. Same file key, fresh IV each.
  const encStr = async (o: any): Promise<any> =>
    PDFHexString.of(hexU(await encryptObjectBytes(fileKey, rnd(16), o.asBytes())));
  const walk = async (c: any): Promise<void> => {
    if (c instanceof PDFDict) {
      for (const [k, v] of c.entries()) {
        if (v instanceof PDFString || v instanceof PDFHexString) c.set(k, await encStr(v));
        else if (v instanceof PDFDict || v instanceof PDFArray) await walk(v);
      }
    } else if (c instanceof PDFArray) {
      for (let i = 0; i < c.size(); i++) {
        const v = c.get(i);
        if (v instanceof PDFString || v instanceof PDFHexString) c.set(i, await encStr(v));
        else if (v instanceof PDFDict || v instanceof PDFArray) await walk(v);
      }
    }
  };
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (obj instanceof PDFStream) {
      const ct = await encryptObjectBytes(fileKey, rnd(16), new Uint8Array(obj.getContents()));
      await walk(obj.dict);
      ctx.assign(ref, PDFRawStream.of(obj.dict, ct));
    } else if (obj instanceof PDFDict || obj instanceof PDFArray) {
      await walk(obj);
    } else if (obj instanceof PDFString || obj instanceof PDFHexString) {
      ctx.assign(ref, await encStr(obj));
    }
  }

  const encRef = ctx.register(encDict); // after the walk → the dict itself stays clear
  ctx.trailerInfo.Encrypt = encRef;
  ctx.trailerInfo.ID = idArr;
  // Classic xref table (no object/xref streams): the encryption rule stays uniform
  // (every indirect object encrypted, nothing stream-shaped to exempt).
  const out = await doc.save({ useObjectStreams: false });
  return new Blob([out], { type: 'application/pdf' });
}

// Exported for the shadow-fidelity harness (export-pdf-shadow-fidelity.test.ts),
// which needs real PDF bytes to rasterise and diff - a recording mock cannot answer
// "does this LOOK like the browser". Not part of the bridge surface; callers go
// through createExportAPI.
export async function renderPdf(node: Element, opts: ExportOpts): Promise<Blob> {
  // Multi-page: a tool can flag page boxes with [data-pdf-page]; each becomes its
  // own PDF page sized to that element's own CSS box. This is independent of the
  // print-geometry (marks/bleed) path, which stays single-page. Falls through to
  // the legacy single-page renderer when no page boxes are present.
  const pageEls = node.querySelectorAll ? [...node.querySelectorAll('[data-pdf-page]')] : [];
  let blob: Blob;
  if (pageEls.length > 0) {
    blob = await renderMultiPagePdf(pageEls, opts);
  } else {
    const geo = printGeometry(node, opts);
    const artBlob = await renderArtworkPdf(node, opts, geo);
    if (opts.password && !geo) {
      // jsPDF encryption and pdf-lib post-processing are mutually exclusive:
      // the locked blob (only produced when there's no print geometry) ships
      // as-is, without the PDF/X-4 finishing pass.
      _host?.log?.('info', 'pdf: password-locked export - skipping PDF/X finishing (pdf-lib cannot rewrite an encrypted document)');
      blob = artBlob;
    } else {
      // RGB PDF: marks are black; page boxes declare trim/bleed for the RIP;
      // one pdf-lib pass adds the marks (when geo) and the PDF/X-4 metadata.
      blob = await finishPdfX(artBlob, opts, {
        intentKind: 'srgb', geo, space: 'rgb',
        labels: geo ? provenanceLabels(opts.meta) : null,
      });
    }
  }
  // Strong tier: AES-256 encrypt-last over the finished bytes (composes with the
  // PDF/X finishing above and the multi-page path). Mutually exclusive with the RC4
  // `password` tier and with C2PA (enforced in the UI + stampC2pa). Encryption is
  // the last byte op EXCEPT C2PA, which is skipped whenever a password is set.
  if (opts.strongPassword) blob = await encryptPdfStrong(blob, opts.strongPassword);
  // Content Credentials are applied by renderFormat AFTER this returns - the
  // stamp must remain the LAST byte operation on the finished blob.
  return blob;
}

// A human-readable size line for the export environment: physical exports read
// "210 × 297 mm @ 300 DPI"; pixel exports read "1080 × 1080 px". Values are the
// resolved output size (parseDimension → node fallback), rounded for legibility.
function describeDimensions(d: ExportDims): string {
  const n = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, ''));
  if (d.physical && d.w.unit === d.h.unit) return `${n(d.w.value)} × ${n(d.h.value)} ${d.w.unit} @ ${d.dpi} DPI`;
  const w = d.physical ? toPixels(d.w, d.dpi) : Math.round(d.w.value);
  const h = d.physical ? toPixels(d.h, d.dpi) : Math.round(d.h.value);
  return `${w} × ${h} px`;
}

// Export environment for the `tools.lolly.export` assertion: the "where / when /
// how big / from what" record. Browser ENGINE family + major version and OS
// family (deliberately far short of a fingerprint), the export date, the output
// size, and the runtime-supplied scalar-input digest - enough that an inspected
// asset tells its own story without leaking a device fingerprint.
function c2paEnvironment(format: string, opts: ExportOpts, dimensions?: string): Record<string, unknown> {
  const ua = navigator.userAgent || '';
  let engine = 'unknown';
  let m: RegExpExecArray | null;
  if ((m = /Firefox\/(\d+)/.exec(ua))) engine = `Gecko ${m[1]}`;
  else if ((m = /Chrome\/(\d+)/.exec(ua))) engine = `Chromium ${m[1]}`;
  else if ((m = /Version\/(\d+).*Safari/.exec(ua))) engine = `WebKit ${m[1]}`;
  const os = /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Mac/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux|CrOS/.test(ua) ? 'Linux' : 'unknown';
  const inputs = opts.c2paInputs && Object.keys(opts.c2paInputs).length ? opts.c2paInputs : undefined;
  return {
    ...(opts.meta?.tool ? { tool: opts.meta.tool } : {}),
    // The manifest id + version beside the display name: the name is what a
    // person reads, the id is what /verify reopens (names collide across brands
    // and locales) and the version is what a rebuild has to fetch.
    ...(opts.meta?.toolId ? { toolId: opts.meta.toolId } : {}),
    ...(opts.meta?.toolVersion ? { toolVersion: opts.meta.toolVersion } : {}),
    format: String(format),
    surface: 'web',
    engine,
    os,
    date: new Date().toISOString(),
    ...(dimensions ? { dimensions } : {}),
    ...(inputs ? { inputs } : {}),
  };
}

// Profile authorship for the CreativeWork assertion. opts.meta.author/contact
// are already opt-in gated by buildExportMeta (Profile → "Use my details");
// the email is fished out of the joined contact string.
function c2paAuthor(meta: ExportMeta | null | undefined): { name: string; email?: string } | undefined {
  const name = meta?.author;
  if (!name) return undefined;
  const email = String(meta?.contact || '').split('·').map((s) => s.trim()).find((s) => s.includes('@'));
  return { name, ...(email ? { email } : {}) };
}

// User-asserted IP → the signed manifest's dc:rights (engine c2pa.ts). Combines the
// © notice + any licence into one line. Empty on ordinary exports - only tools that
// declare bindToMeta copyright/license (claim) populate meta.copyright/
// meta.license, so a normal render never asserts rights it can't stand behind.
function c2paRights(meta: ExportMeta | null | undefined): string | undefined {
  const r = [meta?.copyright, meta?.license].filter(Boolean).join(' · ');
  return r || undefined;
}

// Content Credentials (opts.c2pa) - a signed C2PA manifest embedded into the
// finished bytes of any supported container (pdf, png/apng, jpg, gif, svg,
// tiff, webp). Signed with the enrolled identity's device key + Lolly-CA cert
// when one is valid (host.identity - see docs/content-credentials-identity.md),
// else an ephemeral on-device key whose validity window is the user's
// opts.c2paDays pick (7/30/90/365, default 30) - viewers report that path as
// unverified. An encrypted PDF can't take the update, so a password wins; any
// other cannot-attach case ('C2PA embed: …') logs and ships the un-stamped
// file - a credential failure must never fail the export.
async function stampC2pa(blob: Blob, format: string, opts: ExportOpts, dimensions?: string): Promise<Blob> {
  if ((opts.password || opts.strongPassword) && (format === 'pdf' || format === 'pdf-cmyk')) {
    _host?.log?.('info', 'pdf: password-locked export - skipping Content Credentials (an encrypted document cannot take the C2PA update)');
    return blob;
  }
  try {
    // Ephemeral cert window = the user's lifetime pick (clamped; default 30
    // days). Ignored when an enrolled signer is present - its CA-issued cert
    // carries its own window, fixed at enrolment.
    const days = [7, 30, 90, 365].includes(Number(opts.c2paDays)) ? Number(opts.c2paDays) : 30;
    // Honest action history from what THIS export actually did - the pipeline
    // signals are all on opts/format, so nothing extra needs threading out of
    // the per-format renderers. Each genuine transformation gets its own,
    // individually-described step (task: "as granular as possible") rather than
    // a handful of lumped-together flags.
    const marks: string[] = [];
    if (opts.bleed) marks.push(`${opts.bleed}${typeof opts.bleed === 'number' ? 'px' : ''} bleed`);
    if (opts.cropMarks) marks.push('crop marks');
    if (opts.registrationMarks) marks.push('registration marks');
    if (opts.bleedMarks) marks.push('bleed marks');
    if (opts.colorBars) marks.push('a colour bar');
    // The durable in-pixel watermark runs two ways: unconditionally for the
    // canvas-based raster encoders (renderRaster/renderBitmap/renderTiff's
    // opts.imprint branch - imprintCapable formats always carry it), and - for
    // a CONTAINER format (pdf) - only when a Lolly-rendered raster was actually
    // composited in and marked (imprintEmbedCanvas flipped _imprintSink.applied).
    // A pure-vector page (e.g. a QR PDF) marks nothing, so it must NOT claim: gate
    // the container case on the applied flag, never on the format alone.
    const imprintCapable = format === 'png' || format === 'jpg' || format === 'jpeg' || format === 'webp' || format === 'avif' || format === 'tiff';
    const actions = exportActionSteps(format, {
      cmyk: /cmyk/i.test(format),
      paletteColors: opts.palette?.length,
      marks,
      watermarked: !!opts.watermark,
      imprint: !!opts.imprint && (imprintCapable || !!opts._imprintSink?.applied),
      audio: !!opts.audio?.url,
      // Honest origin: the runtime flags a sensor capture (live camera / mic take).
      ...(opts.c2paCapture ? { capture: opts.c2paCapture } : {}),
      // The runtime only sets c2paTextAdded when text sits over an opened asset,
      // so passing it through here keeps the "text is a real edit" gate intact.
      ...(opts.c2paTextAdded ? { textAdded: true, textSample: opts.c2paTextAdded.sample } : {}),
      // The runtime sets c2paAiUpscale when the render's essence is an on-device
      // AI-upscaled asset - created → compositeWithTrainedAlgorithmicMedia + a step
      // naming the model. Honest AI disclosure, surfaced on /verify automatically.
      ...(opts.c2paAiUpscale ? { aiUpscale: opts.c2paAiUpscale } : {}),
      // The runtime sets c2paAiIngredients from the user's own AI-origins
      // assertions on placed assets - the fresh credential declares the
      // composite and names each declared piece (plans/126 WP-B3).
      ...(opts.c2paAiIngredients?.length ? { aiIngredients: opts.c2paAiIngredients } : {}),
    });
    return await signAndEmbedC2pa(blob, format, {
      title: opts.meta?.tool,
      software: opts.meta?.software,
      environment: c2paEnvironment(format, opts, dimensions),
      author: c2paAuthor(opts.meta),
      rights: c2paRights(opts.meta),
      actions,
      ingredients: opts.ingredients,
      // section 18.28.3: the machine-readable AI-transparency assertion travels WITH
      // the composite created action. Generic model type by design - the user
      // asserted THAT a model made the ingredient, never which one, and a
      // disclosure must not invent what nobody observed.
      ...(opts.c2paAiIngredients?.length ? { aiDisclosure: {} } : {}),
      days,
    });
  } catch (err) {
    _host?.log?.('warn', `${format}: Content Credentials not attached - ${(err as any)?.message || err}`);
    return blob;
  }
}

// The shared signing core behind stampC2pa and stampDerivedC2pa: enrolled
// signer when available (else the engine's ephemeral self-signed default with
// a bounded validity window), one embedC2pa call, Blob back out. Throws on
// failure - callers decide whether a missing credential may fail the export
// (they don't: both wrap in try/catch and ship the un-stamped bytes).
// `host` defaults to the module-level _host, which is only wired once
// createExportAPI has run - callers that can reach this module before any
// export (the catalog's download path) pass their host explicitly.
async function signAndEmbedC2pa(blob: Blob, format: string, o: {
  title?: string;
  software?: string;
  environment: Record<string, unknown>;
  author?: { name: string; email?: string; url?: string };
  rights?: string;
  actions: C2paActionInput[];
  ingredients?: IngredientCredential[];
  aiDisclosure?: Record<string, never>;
  days?: number;
}, host: WebHost | null = _host): Promise<Blob> {
  // Enrolled-identity signer (device key + CA cert, see bridge/identity.js) - 
  // null when not enrolled or the cert is out of validity, in which case the
  // engine's ephemeral self-signed default applies unchanged.
  let signer: any = null;
  try { signer = await host?.identity?.signer(); } catch { /* fall back to ephemeral */ }
  const days = o.days ?? 30;
  const stamped = await embedC2pa(new Uint8Array(await blob.arrayBuffer()), format, {
    title: o.title,
    claimGenerator: `${o.software || 'Lolly'} lolly.tools`,
    generatorInfo: { name: o.software || 'Lolly', version: ENGINE_VERSION },
    environment: o.environment,
    author: o.author,
    ...(o.rights ? { rights: o.rights } : {}),
    actions: o.actions,
    ...(o.ingredients?.length ? { ingredients: o.ingredients } : {}),
    ...(o.aiDisclosure ? { aiDisclosure: o.aiDisclosure } : {}),
    dates: signer ? {} : { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + days * 86_400_000) },
    ...(signer ? { signer } : {}),
  });
  return new Blob([stamped as BlobPart], { type: blob.type || 'application/octet-stream' });
}

/**
 * Content Credentials for a DERIVED asset - a catalog/library file the user
 * modified on the way out (icon recolour, photo colour treatment, crop,
 * re-encode) rather than a tool render. The caller supplies the honest action
 * history (engine C2paActionInput steps; when `ingredients` carry the source's
 * own credential the engine prepends a c2pa.opened step per ingredient, so the
 * list should NOT claim c2pa.created) and a transform-detail map recorded
 * under the tools.lolly.export assertion's `inputs`. Authorship follows the
 * profile's "Use my details" opt-in, exactly like tool exports. Never throws - 
 * an un-stampable format or a signing failure logs and returns the original
 * bytes, because a credential failure must never fail a download.
 *
 * Takes the host explicitly: this module is dynamically imported by the
 * catalog's download path, which runs before any export has wired the
 * module-level _host via createExportAPI.
 */
export async function stampDerivedC2pa(host: HostV1, blob: Blob, format: string, o: {
  /** dc:title for the manifest - usually the asset's display name. */
  title?: string;
  /** Where this happened, for the export assertion's `tool` (default 'Catalog'). */
  tool?: string;
  /** Honest transform steps (c2pa.color_adjustments / c2pa.cropped / c2pa.converted / …). */
  actions: C2paActionInput[];
  /** The source asset's own preserved credential(s), carried as ingredient manifests. */
  ingredients?: IngredientCredential[];
  /** Transform detail (source id, treatment, crop box, …) → tools.lolly.export `inputs`. */
  inputs?: Record<string, string>;
  /** Output size, e.g. '1024×768'. */
  dimensions?: string;
}): Promise<Blob> {
  try {
    // Platform + opted-in personal attribution, same gate as tool exports
    // (Profile → "Use my details"); buildExportMeta fetches the profile itself.
    const meta = await buildExportMeta(host, { name: o.tool ?? 'Catalog' });
    return await signAndEmbedC2pa(blob, format, {
      title: o.title || meta.tool,
      software: meta.software,
      environment: c2paEnvironment(format, { meta, c2paInputs: o.inputs } as ExportOpts, o.dimensions),
      author: c2paAuthor(meta),
      rights: c2paRights(meta),
      actions: o.actions,
      ingredients: o.ingredients,
    }, host as WebHost);
  } catch (err) {
    host.log?.('warn', `${format}: Content Credentials not attached - ${(err as any)?.message || err}`);
    return blob;
  }
}

/**
 * The `host.c2pa.sign` contract (engine v1.85, widened v1.104). Signs a FRESH
 * manifest into finished bytes and returns them. Two honest modes, chosen by
 * `o` (see C2paSignOpts):
 *
 *  • `'redacted'` (default when no author/rights/ingredients given) - a derivative
 *    with content removed. NO ingredients (an ingredient box can carry a thumbnail
 *    of the un-redacted original), so it signs as a new work: c2pa.created + a
 *    c2pa.redacted step + the closing render/encode. The original redact path.
 *
 *  • `'imported'` (default when author/rights/ingredients ARE given) - the any-media
 *    authorship path. The essence was authored elsewhere and is preserved byte-for-
 *    byte; Lolly only splices in a manifest asserting the artist's author/©/licence.
 *    So it must NOT claim c2pa.created or a render/convert step. When `o.ingredients`
 *    carry manifests already inside the file (a document-level PDF manifest, a signed
 *    raster element, a signed video track) the engine prepends a c2pa.opened per
 *    ingredient and the claim reads as an edit of prior work - the nested credential
 *    survives and is referenced, never orphaned. Explicit author/rights override the
 *    profile; absent, they fall back to the opted-in profile identity.
 *
 * Unlike stampDerivedC2pa this THROWS on an unstampable format or a signing
 * failure - the signature is an explicit user opt-in, so silently shipping
 * unsigned bytes would misreport what the user asked for.
 */
export async function signFreshC2pa(host: HostV1, bytes: Uint8Array, format: string, o: C2paSignOpts = {}): Promise<Uint8Array> {
  const imported = o.action === 'imported'
    || (o.action == null && (o.author != null || o.rights != null || (o.ingredients?.length ?? 0) > 0));
  const meta = await buildExportMeta(host, { name: imported ? 'Embed, Imprint & Track' : 'Redact' });

  // Explicit artist-asserted credentials win over the profile identity; when the
  // caller passes neither, the opted-in profile still supplies author/rights.
  const author = o.author != null
    ? (typeof o.author === 'string' ? (o.author.trim() ? { name: o.author.trim() } : undefined) : o.author)
    : c2paAuthor(meta);
  const rights = o.rights != null ? (o.rights.trim() || undefined) : c2paRights(meta);

  let actions: C2paActionInput[];
  if (imported) {
    // The essence is preserved, not rendered - no c2pa.created and no convert step.
    // The engine prepends a c2pa.opened per preserved ingredient (o.ingredients),
    // so here we only describe the metadata/authorship edit (and the imprint, if the
    // caller stamped one into the raster before signing).
    actions = [{ action: 'c2pa.metadata', description: o.description || 'Author, copyright and licence embedded' }];
    if (o.imprinted) actions.push({ action: 'c2pa.edited', description: 'Embedded a durable Lolly pixel watermark' });
  } else {
    actions = exportActionSteps(format, {});
    // The redaction sits between creation and the closing render/encode step.
    actions.splice(1, 0, { action: 'c2pa.redacted', description: o.description || 'Covered content removed and the file rebuilt' });
  }

  const stamped = await signAndEmbedC2pa(new Blob([bytes as BlobPart]), format, {
    title: o.title || meta.tool,
    software: meta.software,
    environment: c2paEnvironment(format, { meta } as ExportOpts),
    author,
    rights,
    actions,
    ...(o.ingredients?.length ? { ingredients: o.ingredients } : {}),
  }, host as WebHost);
  return new Uint8Array(await stamped.arrayBuffer());
}

/**
 * The containers a live capture can be signed into. Every one of these is in the
 * engine's `C2PA_FORMATS` (asserted by bridge/capture-clip-c2pa.test.ts), so a
 * capture path never has to guess whether the credential will land: png for a
 * screenshot, mp4/webm for footage, and the four audio containers a voice/screen take
 * can arrive in - m4a (ISO BMFF, the `audio/mp4` AAC MediaRecorder writes), webm
 * (Matroska-wrapped Opus), ogg (Ogg Opus, what Firefox writes), plus mp3 and wav for
 * an on-device transcode of the take.
 */
export const CAPTURE_FORMATS = ['png', 'mp4', 'webm', 'm4a', 'mp3', 'wav', 'ogg'] as const;
export type CaptureFormat = (typeof CAPTURE_FORMATS)[number];

/**
 * The C2PA container key for whatever a MediaRecorder actually handed back. The
 * recorder names its output by MIME and the credential is placed by CONTAINER, and
 * the two do not line up one-to-one: `audio/mp4` is an M4A (the engine's `m4a` placer
 * writes `audio/mp4` into the manifest, `mp4` would claim `video/mp4`), `audio/ogg` is
 * Ogg Opus (the OpusTags comment header), and `audio/webm;codecs=opus` is Matroska - 
 * NOT the Ogg one, despite the codec name. Null means the engine has no embedder for
 * it, which is the caller's cue to save unsigned rather than to lie about the bytes.
 */
export function captureContainer(mimeType: string): CaptureFormat | null {
  const t = String(mimeType || '').toLowerCase();
  const audio = t.startsWith('audio/');
  if (t.includes('webm') || t.includes('matroska')) return 'webm';       // before opus: audio/webm;codecs=opus is Matroska
  if (t.includes('mp4') || t.includes('m4a') || t.includes('aac')) return audio ? 'm4a' : 'mp4';
  if (audio && (t.includes('ogg') || t.includes('opus'))) return 'ogg';  // video/ogg has no placer - falls through to null
  if (audio && (t.includes('mpeg') || t.includes('mp3'))) return 'mp3';
  if (audio && t.includes('wav')) return 'wav';
  if (t.includes('png')) return 'png';
  return null;
}

/**
 * Content Credentials for a freshly CAPTURED clip - a recorder tool's live camera
 * or microphone take (added engine v1.35), or a screenshot / screen recording
 * (v1.54). Signs the raw bytes so the file self-asserts (the created step is IPTC
 * `digitalCapture` for a sensor, `screenCapture` for a display - never the wrong one
 * of the two; on-device Lolly either way) and, placed into a composition, chains as a
 * credentialed ingredient. Returns the stamped blob PLUS the extracted manifest
 * store, because a `user/` asset's credential lookup reads the STORED store, not the
 * file's bytes - the caller persists it on the asset record (mirroring the
 * upload-ingest path). `format` is a `CaptureFormat` - every container the engine can
 * embed into, AUDIO INCLUDED: an audio take is credentialed exactly like a video one
 * (this used to be typed mp4/webm/png only, which is why voice takes were the one
 * capture shipping unsigned - a signature artifact, never a capability gap).
 * Never throws - a stamping failure returns the original blob + a null credential,
 * so a take is never lost to a provenance hiccup.
 */
export async function stampCaptureClip(host: HostV1, blob: Blob, format: CaptureFormat, o: {
  camera?: boolean;
  microphone?: boolean;
  /** A display was captured, not a sensor - swaps the created step to IPTC screenCapture. */
  screen?: boolean;
  dimensions?: string;
  /** The take was re-encoded on device on the way out (the voice recorder's "Save MP3"),
   *  so the created step is followed by an honest c2pa.converted naming the container. */
  transcoded?: boolean;
}): Promise<{ blob: Blob; credential: { store: Uint8Array; format: string } | null }> {
  // Screen first: a narrated screen recording is a screen capture WITH a mic track, not
  // a microphone recording - claiming the latter would say the file is a record of the
  // room. The mic is still named, since it did capture the room's sound.
  const description = o.screen ? (o.microphone ? 'Captured from the screen with microphone narration' : 'Captured from the screen')
    : o.camera && o.microphone ? 'Recorded live from the camera and microphone'
    : o.camera ? 'Captured live from the camera'
    : 'Recorded live from the microphone';
  try {
    // A fresh recording has no ingredients → it honestly claims c2pa.created.
    const stamped = await stampDerivedC2pa(host, blob, format, {
      tool: o.screen ? 'Screen capture' : 'Recording',
      actions: [
        {
          action: 'c2pa.created',
          digitalSourceType: o.screen ? SCREEN_SOURCE_TYPE : CAPTURE_SOURCE_TYPE,
          description,
        },
        // Same wording exportActionSteps uses to close a render ("Encoded to WEBM"),
        // because it is the same claim: these bytes are a re-encode of the essence,
        // not the recorder's own output.
        ...(o.transcoded ? [{ action: 'c2pa.converted', description: `Encoded to ${format.toUpperCase()}` }] : []),
      ],
      dimensions: o.dimensions,
    });
    const ex = extractC2paStore(new Uint8Array(await stamped.arrayBuffer()));
    return { blob: stamped, credential: ex ? { store: ex.store, format: ex.format } : null };
  } catch (err) {
    host.log?.('warn', `capture clip: Content Credentials not attached - ${(err as any)?.message || err}`);
    return { blob, credential: null };
  }
}

// Render a sequence of [data-pdf-page] DOM nodes into one multi-page PDF. Each
// page is sized to its own CSS box (layout px → PDF points at the CSS 96-DPI
// convention), so a tool that lays out fixed-size page boxes - the height
// matching the export page height - gets one true PDF page per box. Each box is
// drawn at (0,0) in its own page via drawHtmlVectors, whose coordinate origin is
// the node it's handed, so a page is rendered correctly regardless of where it
// sits in the scrolled/stacked document. A password locks the document on open - 
// this path can always encrypt (no print geometry), at the cost of the pdf-lib
// PDF/X finishing pass. Print marks/bleed are not applied here; a tool that
// emits page boxes opts out of the print-finishing card (render.printMarks:false).
// `prepare(i)` is called immediately before page `i` is measured and drawn, which
// is the seam a contact sheet needs: there the SAME node is the page every time and
// what changes between pages is the sequence playhead (bridge/sequence-cuts.ts).
// Absent for the [data-pdf-page] case, where the pages are already distinct nodes.
async function renderMultiPagePdf(pageEls: Element[], opts: ExportOpts, prepare?: (i: number) => void): Promise<Blob> {
  const mod: any = await import('jspdf');
  const jsPDF = mod.jsPDF ?? mod.default?.jsPDF ?? mod.default;
  const convert = opts.convertPaths !== false;

  // Page size in points from the element's own box. getBoundingClientRect matches
  // the reference drawHtmlVectors uses internally (so the px→pt scale is uniform);
  // the live CSS transform is removed by the shell before export (exportUnscaled).
  const sizeOf = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { w: toPoints({ value: r.width || 1, unit: 'px' as const }), h: toPoints({ value: r.height || 1, unit: 'px' as const }) };
  };
  const orientOf = (w: number, h: number) => (w >= h ? 'landscape' : 'portrait');

  // Per-page print geometry. The null gate in printGeometryForSize reads only opts,
  // so geo-ness is UNIFORM across pages - hasGeo decides encryption + finishing up
  // front, and only the numeric box/mark values scale with each page's own size.
  const bleedPtCheck = (() => { const b = parseDimension(opts.bleed); return b ? toPoints(b) : 0; })();
  const hasGeo = bleedPtCheck > 0 || Boolean(opts.cropMarks) || Boolean(opts.registrationMarks) || Boolean(opts.bleedMarks) || Boolean(opts.colorBars) || Boolean(opts.provenance);
  // Lock on open via jsPDF's standard security handler. jsPDF RC4 and the pdf-lib
  // marks pass are mutually exclusive, so encrypt ONLY when there is no geometry
  // (mirrors renderArtworkPdf). undefined is a no-op (unencrypted).
  const encryption = (opts.password && !hasGeo)
    ? { userPassword: opts.password, ownerPassword: opts.password, userPermissions: ['print'] }
    : undefined;
  const geos: (PrintGeometry | null)[] = [];
  prepare?.(0);
  const first = sizeOf(pageEls[0]!);
  const g0 = printGeometryForSize(first.w, first.h, opts, opts.palette);
  geos.push(g0);
  const p0w = g0 ? g0.page.w : first.w;
  const p0h = g0 ? g0.page.h : first.h;
  const pdf = new jsPDF({ unit: 'pt', format: [p0w, p0h], orientation: orientOf(p0w, p0h), encryption });
  applyPdfMeta(pdf, opts.meta);

  for (let i = 0; i < pageEls.length; i++) {
    opts.signal?.throwIfAborted();      // a long deck stops at the page boundary
    const el = pageEls[i]!;
    if (i > 0) prepare?.(i);
    const size = i === 0 ? first : sizeOf(el);
    const g = i === 0 ? g0 : printGeometryForSize(size.w, size.h, opts, opts.palette);
    if (i > 0) geos.push(g);
    const pageW = g ? g.page.w : size.w;
    const pageH = g ? g.page.h : size.h;
    if (i > 0) pdf.addPage([pageW, pageH], orientOf(pageW, pageH));
    // The artwork (trim-size element) is drawn into the bleed box, so it scales up to
    // cover the bleed - exactly the single-page renderArtworkPdf behaviour, per page.
    const art = g ? g.artwork : { x: 0, y: 0, w: size.w, h: size.h };
    // An SVG-rooted page walks as vectors (mirrors renderArtworkPdf); otherwise the
    // HTML page walks via drawHtmlVectors. Common case here is HTML page boxes.
    const svgRoot = el.tagName?.toLowerCase() === 'svg' ? el
      : isSvgRooted(el) ? el.querySelector('svg') : null;
    if (svgRoot) await drawSvgVectorsInRegion(pdf, svgRoot, art.x, art.y, art.w, art.h, new Set(), opts._imprintSink, opts.convertPaths !== false);
    else await drawHtmlVectors(pdf, el, art.x, art.y, art.w, art.h, convert, opts.onProgress, opts.rasterFallback !== false, opts._imprintSink, opts.signal);
  }
  const blob = pdf.output('blob');
  if (opts.password && !hasGeo) {
    // jsPDF encryption and pdf-lib post-processing are mutually exclusive - a
    // locked multi-page document ships without the PDF/X-4 finishing pass.
    _host?.log?.('info', 'pdf: password-locked export - skipping PDF/X finishing (pdf-lib cannot rewrite an encrypted document)');
    return blob;
  }
  // Per-page marks + boxes ride the pdf-lib finishing pass (each page's own geo).
  return await finishPdfX(blob, opts, hasGeo
    ? { intentKind: 'srgb', geos, space: 'rgb', labels: provenanceLabels(opts.meta) }
    : { intentKind: 'srgb' });
}

// The PDF/X pass logs a withheld conformance claim through the live host, and
// takes the logger as an argument so export-pdfx.ts stays free of this module.
const pdfxLog = (level: 'debug' | 'info' | 'warn' | 'error', msg: string): void => {
  _host?.log?.(level, msg);
};

// The user's own profile for this export, or null. Only ever consulted for an
// `own` / `own:<digest>` selection - every registry-name condition resolves to
// null and produces exactly the file it produced before. A miss (profile deleted,
// unreadable, or not an eligible output profile) is also null, and the pass then
// writes no intent rather than declaring a condition nobody chose.
async function embeddedProfile(colorProfile: string | undefined): Promise<EmbedResolution | null> {
  if (!isOwnProfile(colorProfile) || !_host) return null;
  return resolveEmbeddedProfile(_host as never, colorProfile, 'CMYK').catch(() => null);
}

// Re-save a jsPDF blob through one pdf-lib pass: print page boxes + marks (when
// print geometry is supplied) and the PDF/X-4 metadata set. Subsumes the old
// finishPrintPdf so the plain RGB path loads pdf-lib exactly once; the CMYK path
// has its own pdf-lib pass and calls applyPdfX inside it (see renderCmykPdf).
// Never fed an encrypted blob - pdf-lib can't reopen jsPDF's RC4 output.
async function finishPdfX(
  blobOrBytes: Blob | Uint8Array, opts: ExportOpts,
  { intentKind = 'srgb', geo = null, geos = null, space = 'rgb', labels = null }:
    { intentKind?: string | null; geo?: PrintGeometry | null; geos?: (PrintGeometry | null)[] | null; space?: string; labels?: LabelsRecord | null } = {},
): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib') as any;
  const bytes = blobOrBytes instanceof Uint8Array
    ? blobOrBytes
    : new Uint8Array(await blobOrBytes.arrayBuffer());
  // updateMetadata:false - pdf-lib would otherwise stamp itself as Producer on
  // load; applyPdfX writes the document's real dates/producer below.
  const pdfDoc = await PDFDocument.load(bytes, { updateMetadata: false });
  // Marks + boxes per page. The single-page caller passes one `geo` (page 0); the
  // multi-page caller passes `geos` (one per page, any entry may be null). Each
  // setPageBoxes/drawPrintMarks reads its own geo, so the loop is per-page-safe.
  const perPage = geos ?? (geo ? [geo] : null);
  if (perPage) {
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const g = perPage[i];
      if (!g) continue;
      setPageBoxes(pages[i], g);
      await drawPrintMarks(pages[i], g, { space, labels });
    }
  }
  await applyPdfX(pdfDoc, opts, intentKind, { log: pdfxLog });
  // The C2PA embedder only parses a classic xref table; pdf-lib's default save
  // (object streams) writes a cross-reference stream it refuses. Only flipped
  // when credentials are requested, so ordinary PDFs keep the compact form.
  const out = await pdfDoc.save(opts.c2pa ? { useObjectStreams: false } : undefined);
  return new Blob([out], { type: 'application/pdf' });
}

// Compose the proof-margin credit strings from the export's provenance metadata.
// topLeft: export timestamp; topRight: platform attribution; bottomLeftUp: tool
// + author. Anything missing is dropped, so the line stays clean when the user
// isn't opted into personal details. Keyed by the engine's label slots (see
// print-marks.js).
function provenanceLabels(meta: ExportMeta | null | undefined): LabelsRecord | null {
  if (!meta) return null;
  const topLeft  = formatStamp(new Date());
  const topRight = meta.source ? `Made with ${meta.source}` : '';
  const credit = [meta.tool, meta.author && `by ${meta.author}`].filter(Boolean).join(' ');
  return { topLeft, topRight, bottomLeftUp: meta.tool ? credit : '' };
}

// Local export timestamp as "YYYY-MM-DD HH:MM".
function formatStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Declare the print page boxes so a RIP / print shop knows the cut (trim) and
// bleed extents: Media ⊇ Bleed ⊇ Trim (= Art); CropBox = Media. The engine's
// geometry is top-left origin; PDF boxes are bottom-left, so flip y.
function setPageBoxes(page: any, geo: PrintGeometry): void {
  const H = geo.page.h;
  const box = (b: { x: number; y: number; w: number; h: number }): [number, number, number, number] => [b.x, H - (b.y + b.h), b.w, b.h]; // → [x, y(bottom-left), w, h]
  page.setMediaBox(...box(geo.boxes.media));
  page.setCropBox(...box(geo.boxes.media));
  page.setBleedBox(...box(geo.boxes.bleed));
  page.setTrimBox(...box(geo.boxes.trim));
  page.setArtBox(...box(geo.boxes.trim));
}

// Draw the crop / bleed / registration marks, colour bar and provenance labels
// in the page margin. Line marks use registration colour (DeviceCMYK 1,1,1,1 on
// the CMYK path so they print on every plate; black on the RGB path). Colour-bar
// cells follow their own `ink`: brand pairs force 'rgb' (the unconverted
// reference swatch) and 'cmyk' (the substitution) regardless of page space, so
// the two sit side by side for comparison; the generic bar's 'page' cells follow
// the page space. `labels` (optional) maps each engine label slot → its string.
// Engine coords are top-left; flip y.
async function drawPrintMarks(page: any, geo: PrintGeometry, { space = 'rgb', labels }: { space?: string; labels?: LabelsRecord | null } = {}): Promise<void> {
  const { rgb, cmyk, degrees, StandardFonts } = await import('pdf-lib') as any;
  const H = geo.page.h;
  const fy = (y: number) => H - y;
  const markColor = space === 'cmyk' ? cmyk(1, 1, 1, 1) : rgb(0, 0, 0);
  const w = geo.strokeWeight;
  for (const ln of geo.primitives.lines) {
    page.drawLine({ start: { x: ln.x1, y: fy(ln.y1) }, end: { x: ln.x2, y: fy(ln.y2) }, thickness: w, color: markColor });
  }
  for (const c of geo.primitives.circles) {
    // borderColor without `color` strokes a ring (no fill) - see pdf-lib drawEllipse.
    page.drawCircle({ x: c.cx, y: fy(c.cy), size: c.r, borderWidth: w, borderColor: markColor });
  }
  for (const b of geo.primitives.bars) {
    const ink = b.ink === 'page' || !b.ink ? space : b.ink;
    const fill = ink === 'cmyk' ? cmyk(...b.cmyk) : rgb(...b.rgb);
    const r = Math.max(0, Math.min(b.r ?? 0, b.w / 2, b.h / 2));
    if (r > 0) {
      // Rounded cell (brand --radius). pdf-lib drawSvgPath draws the path y-DOWN from
      // its origin, so anchor at the cell's TOP edge (fy(b.y)). Any surprise falls
      // back to a square rect rather than dropping the cell.
      try {
        const rad: CornerRadii = { topLeft: [r, r], topRight: [r, r], bottomRight: [r, r], bottomLeft: [r, r] };
        page.drawSvgPath(roundedRectPath(0, 0, b.w, b.h, rad), { x: b.x, y: fy(b.y), color: fill, borderWidth: 0 });
        continue;
      } catch { /* fall through to a square cell */ }
    }
    page.drawRectangle({ x: b.x, y: fy(b.y + b.h), width: b.w, height: b.h, color: fill });
  }
  // Provenance text - only the engine's anchors that the caller supplied a string
  // for. Helvetica (a standard-14 font: referenced, not embedded) keeps it light.
  const slots = (geo.primitives.labels ?? []).filter(l => labels?.[l.slot]);
  if (slots.length) {
    const font = await page.doc.embedFont(StandardFonts.Helvetica);
    const textColor = space === 'cmyk' ? cmyk(0, 0, 0, 0.7) : rgb(0.35, 0.35, 0.35);
    for (const l of slots) {
      const text = labels![l.slot]!;
      // Right-aligned horizontal text shifts left by its measured width; rotated
      // text (read-up) starts at its anchor and climbs, so no shift needed.
      const shift = (l.rotation === 0 && l.align === 'right') ? font.widthOfTextAtSize(text, l.size) : 0;
      page.drawText(text, {
        x: l.x - shift, y: fy(l.y), size: l.size, font, color: textColor, rotate: degrees(l.rotation),
      });
    }
  }
}

// Renders an SVG element into a rectangular region of the PDF page.
// ox/oy are the PDF-space top-left offsets (pt); regionW/regionH are the
// target dimensions (pt). Used both by the full-page SVG canvas path and by
// drawHtmlVectors when it encounters an inline <svg> element.
async function drawSvgVectorsInRegion(pdf: any, svgEl: Element, ox: number, oy: number, regionW: number, regionH: number, registeredFonts: Set<unknown> | null = null, imprint?: ImprintState, convertPaths = true): Promise<void> {
  const vb = (svgEl as SVGSVGElement).viewBox?.baseVal;
  const vbW = (vb && vb.width  > 0) ? vb.width  : svgEl.getBoundingClientRect().width;
  const vbH = (vb && vb.height > 0) ? vb.height : svgEl.getBoundingClientRect().height;
  const vbX = (vb && vb.width  > 0) ? vb.x : 0;
  const vbY = (vb && vb.height > 0) ? vb.y : 0;
  let sx = regionW / vbW;
  let sy = regionH / vbH;
  // Honour the SVG's preserveAspectRatio when its viewBox aspect differs from the
  // target region. Tools like Diagram Builder size the viewBox to the diagram's own
  // bounds (not the fixed export page), so the browser - and the SVG export - letterbox
  // the artwork via the default "xMidYMid meet". Without this the walker filled the page
  // with a NON-uniform scale (sx≠sy), stretching the diagram vs. the on-screen preview.
  // 'none' keeps the legacy stretch-to-fill; meet/slice + x/y alignment follow the SVG
  // spec, matching the <image> branch's own meet handling below. The centering offset is
  // folded into ox/oy so every mapper (PX/PY/LW/LH, the rotation pivot, rAvg) tracks it.
  const par = ((svgEl.getAttribute('preserveAspectRatio') || '').trim() || 'xMidYMid meet');
  if (!/^none/i.test(par)) {
    const align = par.split(/\s+/)[0] || 'xMidYMid';
    const s = /\bslice\b/i.test(par) ? Math.max(sx, sy) : Math.min(sx, sy);
    ox += (regionW - vbW * s) * (align.includes('xMax') ? 1 : align.includes('xMid') ? 0.5 : 0);
    oy += (regionH - vbH * s) * (align.includes('YMax') ? 1 : align.includes('YMid') ? 0.5 : 0);
    sx = sy = s;
  }

  // Gradient / filter / pattern SVGs can't be reproduced by the vector walk below:
  // jsPDF compat mode has no axial/radial shading, and a url(#…) fill resolves to null
  // → the shape simply VANISHES. Rasterise the whole subtree to an alpha-preserved PNG
  // and drop it into the SAME PAR-fitted box the vectors would occupy. drawHtmlVectors
  // already does this for an inline <svg>; centralising it here means EVERY entry point - 
  // a Lolly tool embedded as an <img>, artwork / multi-page PDFs, a nested <image> - 
  // keeps its shading instead of only the inline case. Solid-fill SVGs (qr, brand-lockup)
  // match nothing here and stay crisp vector. (bag-video's gradient Geeko is the canon case.)
  if (svgEl.querySelector?.('linearGradient, radialGradient, filter, pattern')) {
    try {
      const fitW = vbW * sx, fitH = vbH * sy;
      const dpr = 150 / 72;                                    // output-region px at ~150dpi, bounded
      const pxW = Math.max(2, Math.min(2000, Math.round(fitW * dpr)));
      const pxH = Math.max(2, Math.min(2000, Math.round(fitH * dpr)));
      const png = await rasterizeSvgElement(svgEl, pxW, pxH, false, imprint);
      pdf.addImage(png, 'PNG', ox, oy, fitW, fitH);
      return;
    } catch { /* fall through to the vector walk (better a solid silhouette than nothing) */ }
  }

  let nodesWalked = 0;
  const YIELD_NODES = 200;
  // <use> expansion depth - bounds a <use> chain (or a self/mutually referential one)
  // so a malformed SVG can't recurse without end. 8 is far beyond any real nesting.
  let useDepth = 0;
  const MAX_USE_DEPTH = 8;
  async function visit(el: any, tx: number, ty: number, sX: number, sY: number): Promise<void> {
    if (!el.tagName) return;
    // Cooperative yield, matching the sibling HTML walker: a big SVG (Diagram Builder,
    // imported artwork) otherwise runs getComputedStyle + drawSvgPathToPdf per path
    // synchronously and freezes the tab. Draws stay in document order (painter's algo
    // preserved), so output is byte-identical.
    if (++nodesWalked % YIELD_NODES === 0) await new Promise<void>((r) => setTimeout(r));
    const tag = el.tagName.toLowerCase().replace(/^svg:/, '');

    if (tag === 'defs' || tag === 'clippath' || tag === 'lineargradient' ||
        tag === 'radialgradient' || tag === 'symbol') return;

    // Compose this element's OWN transform (translate/scale/rotate) onto the inherited
    // CTM - applied to CONTAINERS and LEAF drawables alike. brand-lockup lays its whole
    // lockup out as sibling <path transform="translate()/scale()"> with no wrapping <g>,
    // so unless a leaf's own transform is honoured here every glyph run and the chameleon
    // collapse onto the origin at native scale when the lockup is embedded as an image and
    // the parent (e.g. Design) exports PDF. Mirrors the EMF/EPS/DXF walker's
    // applyElementTransform (svg-ir.ts), which already maps per-leaf transforms.
    const tx0 = tx, ty0 = ty, sX0 = sX, sY0 = sY;
    let rotDeg = 0;
    {
      const t = el.getAttribute('transform') ?? '';
      if (t) {
        // The whole transform LIST (any order or multiplicity, matrix(), rotate(θ cx cy)),
        // through the same parser the EMF/EPS/DXF walker uses, then split into the
        // translate/scale/rotate this sink consumes. The local translate is taken in the
        // PARENT's scale, the scales multiply, and the rotation pivots on the local origin
        // after the translate, which is what a T·R·S decomposition yields. Skew is not
        // representable here and is dropped (decomposeAffine).
        const d = decomposeAffine(parseTransformList(t));
        tx = tx0 + sX0 * d.tx; ty = ty0 + sY0 * d.ty;
        sX = sX0 * d.sx; sY = sY0 * d.sy;
        rotDeg = d.rotDeg;
      }
    }

    // Map an SVG user-space coord (inside this element's own + inherited transform)
    // into PDF points: apply the accumulated translate+scale, shift by the viewBox
    // origin, then scale into the target region. LW/LH scale a length.
    const gAvg = (sX + sY) / 2, rAvg = (sx + sy) / 2;
    const PX = (v: number) => ox + ((tx + sX * v) - vbX) * sx;
    const PY = (v: number) => oy + ((ty + sY * v) - vbY) * sy;
    const LW = (v: number) => v * sX * sx;
    const LH = (v: number) => v * sY * sy;
    // Stroke width / font scaling: group scale × region scale - EXCEPT for
    // vector-effect:non-scaling-stroke (e.g. street-map roads), whose stroke keeps
    // its user-unit width through the group transform, so region scale only.
    const strokeMul = (e: any) =>
      ((e.getAttribute('vector-effect') || resolveStyleProp(e, 'vector-effect')) === 'non-scaling-stroke' ? 1 : gAvg) * rAvg;

    // Resolve fill + stroke (with opacity) for a basic shape, mirroring the
    // <path> branch - so a stroked <rect>/<circle> keeps its border in PDF.
    // (Previously rect/circle were fill-only: a card whose fill matches the page,
    // distinguished only by its border, exported as an invisible box. The EMF/EPS
    // walker in svg-ir.js already routes rect/circle through its path logic, so
    // this brings the PDF sink to parity.) Returns null when nothing is paintable.
    const shapePaint = (e: any): { fillRgb: Rgb | null; strokeRgb: Rgb | null; lw: number } | null => {
      let fillRgb = resolveColor(e);                 // own-attr → inline style → computed
      const strokeStr = strokeOf(e);                 // same three-way resolution
      let strokeRgb = (strokeStr && strokeStr !== 'none') ? parseSvgColor(strokeStr) : null;
      const elemOp = parseFloat(e.getAttribute('opacity') ?? '1');
      const fillOp = elemOp * parseFloat(e.getAttribute('fill-opacity') ?? '1');
      const strkOp = elemOp * parseFloat(e.getAttribute('stroke-opacity') ?? '1');
      if (fillOp < 0.01) fillRgb = null;
      if (strkOp < 0.01) strokeRgb = null;
      if (!fillRgb && !strokeRgb) return null;
      if (fillRgb   && fillOp < 0.999) fillRgb   = blendSvgWithWhite(fillRgb,   fillOp);
      if (strokeRgb && strkOp < 0.999) strokeRgb = blendSvgWithWhite(strokeRgb, strkOp);
      const lw = Math.max(0.1, strokeWidthOf(e) * strokeMul(e));
      return { fillRgb, strokeRgb, lw };
    };

    // Paint + draw any shape expressed as an SVG `d` - shared by <path> and the shapes
    // that reduce to a path (<polygon>/<polyline>/<ellipse>). Resolves fill/stroke with
    // currentColor + computed-style fallback, per-element + fill/stroke opacity, and
    // fill-rule exactly as the <path> branch always has, so the added shapes match it.
    const drawShapeD = (e: any, d: string): void => {
      if (!d.trim()) return;
      let fillStr = e.getAttribute('fill') ?? resolveStyleProp(e, 'fill');
      if (!fillStr || fillStr === 'currentColor') fillStr = computedPaint(e, 'fill') || 'black';
      const strokeStr = strokeOf(e);
      const elemOp  = parseFloat(e.getAttribute('opacity') ?? '1');
      const fillOp  = elemOp * parseFloat(e.getAttribute('fill-opacity')   ?? '1');
      const strkOp  = elemOp * parseFloat(e.getAttribute('stroke-opacity') ?? '1');
      let fillRgb   = (fillStr   && fillStr   !== 'none') ? parseSvgColor(fillStr)   : null;
      let strokeRgb = (strokeStr && strokeStr !== 'none') ? parseSvgColor(strokeStr) : null;
      if (fillOp   < 0.01) fillRgb   = null;
      if (strkOp   < 0.01) strokeRgb = null;
      if (!fillRgb && !strokeRgb) return;
      if (fillRgb   && fillOp   < 0.999) fillRgb   = blendSvgWithWhite(fillRgb,   fillOp);
      if (strokeRgb && strkOp   < 0.999) strokeRgb = blendSvgWithWhite(strokeRgb, strkOp);
      if (fillRgb)   pdf.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
      let restoreStroke: (() => void) | null = null;
      if (strokeRgb) {
        pdf.setDrawColor(strokeRgb[0], strokeRgb[1], strokeRgb[2]);
        const lw = strokeWidthOf(e) * strokeMul(e);
        pdf.setLineWidth(Math.max(0.1, lw));
        restoreStroke = applySvgStrokeDecoration(pdf, e, strokeMul(e));
      }
      drawSvgPathToPdf(pdf, d, PX, PY);
      const fillRule = e.getAttribute('fill-rule') ?? 'nonzero';
      if (fillRgb && strokeRgb) pdf.fillStroke();
      else if (fillRgb) { fillRule === 'evenodd' ? pdf.fillEvenOdd() : pdf.fill(); }
      else pdf.stroke();
      restoreStroke?.();
    };

    // Render this element - leaf geometry, or a container's children - under any own
    // rotation. Translate/scale are already folded into tx/ty/sX/sY above; a rotate()
    // (d3.zoom groups, pose-geeko's articulated limbs) is applied about its pivot via
    // the PDF matrix, wrapping the whole subtree. Skew/matrix() are not handled.
    const drawSelf = async (): Promise<void> => {
    if (tag === 'g') {
      for (const child of el.children) await visit(child, tx, ty, sX, sY);
      return;
    }

    if (tag === 'rect') {
      const x = PX(svgLen(el.getAttribute('x'), vbW));
      const y = PY(svgLen(el.getAttribute('y'), vbH));
      const w = LW(svgLen(el.getAttribute('width'), vbW));
      const h = LH(svgLen(el.getAttribute('height'), vbH));
      if (w <= 0 || h <= 0) return;
      const paint = shapePaint(el);
      if (!paint) return;
      const rx = LW(parseFloat(el.getAttribute('rx') || el.getAttribute('ry') || '0'));
      const ry = LH(parseFloat(el.getAttribute('ry') || el.getAttribute('rx') || '0'));
      if (paint.fillRgb)   pdf.setFillColor(paint.fillRgb[0], paint.fillRgb[1], paint.fillRgb[2]);
      if (paint.strokeRgb) { pdf.setDrawColor(paint.strokeRgb[0], paint.strokeRgb[1], paint.strokeRgb[2]); pdf.setLineWidth(paint.lw); }
      const style = (paint.fillRgb && paint.strokeRgb) ? 'FD' : (paint.fillRgb ? 'F' : 'S');
      (rx > 0 || ry > 0)
        ? pdf.roundedRect(x, y, w, h, rx, ry, style)
        : pdf.rect(x, y, w, h, style);
      return;
    }

    if (tag === 'circle') {
      const cx = PX(svgLen(el.getAttribute('cx'), vbW));
      const cy = PY(svgLen(el.getAttribute('cy'), vbH));
      const r  = LW(svgLen(el.getAttribute('r'), vbW));
      if (r <= 0) return;
      const paint = shapePaint(el);
      if (!paint) return;
      if (paint.fillRgb)   pdf.setFillColor(paint.fillRgb[0], paint.fillRgb[1], paint.fillRgb[2]);
      if (paint.strokeRgb) { pdf.setDrawColor(paint.strokeRgb[0], paint.strokeRgb[1], paint.strokeRgb[2]); pdf.setLineWidth(paint.lw); }
      const style = (paint.fillRgb && paint.strokeRgb) ? 'FD' : (paint.fillRgb ? 'F' : 'S');
      pdf.circle(cx, cy, r, style);
      return;
    }

    if (tag === 'line') {
      const strokeStr = el.getAttribute('stroke') ?? '';
      if (strokeStr === 'none') return;
      let rgb = strokeStr ? parseSvgColor(strokeStr) : null;
      // Fall back to the COMPUTED stroke when set via CSS (or a named colour that
      // slipped through) so <line stroke="red">/CSS-styled lines aren't dropped.
      if (!rgb) rgb = parseSvgColor(computedPaint(el, 'stroke'));
      if (!rgb) return;
      const opacity = parseFloat(el.getAttribute('opacity') ?? el.getAttribute('stroke-opacity') ?? '1');
      if (opacity < 0.01) return;
      if (opacity < 0.999) rgb = blendSvgWithWhite(rgb, opacity);
      const lx1 = PX(svgLen(el.getAttribute('x1'), vbW));
      const ly1 = PY(svgLen(el.getAttribute('y1'), vbH));
      const lx2 = PX(svgLen(el.getAttribute('x2'), vbW));
      const ly2 = PY(svgLen(el.getAttribute('y2'), vbH));
      const lw  = strokeWidthOf(el) * strokeMul(el);
      pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
      pdf.setLineWidth(Math.max(0.1, lw));
      pdf.line(lx1, ly1, lx2, ly2, 'S');
      return;
    }

    if (tag === 'text') {
      // Draw ONE run (the <text> itself, or one <tspan>) at (userX,userY) in the element's
      // own style, then return its advance in USER units. Font props: attribute first, else
      // the COMPUTED style - tools that set the typeface/size/weight via CSS (chart-creator/d3
      // → SUSE) otherwise fell back to Helvetica at the default size. Advance uses the
      // browser's measured getComputedTextLength (a length → maps like the x attrs); jsPDF's
      // width is the fallback. Baseline y matches jsPDF's default (SVG y IS the baseline).
      const drawRun = async (styleEl: any, runText: string, userX: number, userY: number, anchor: string): Promise<number> => {
        const t = (runText ?? '').trim();
        if (!t) return 0;
        const cs = (typeof window !== 'undefined' && styleEl.isConnected) ? window.getComputedStyle(styleEl) : null;
        let fillStr = styleEl.getAttribute('fill');
        if (!fillStr || fillStr === 'currentColor') fillStr = computedPaint(styleEl, 'fill') || '#000000';
        let rgb = parseSvgColor(fillStr) ?? parseSvgColor(computedPaint(styleEl, 'fill'));
        const op = parseFloat(styleEl.getAttribute('opacity') ?? styleEl.getAttribute('fill-opacity') ?? '1');
        const fsUser = parseFloat(styleEl.getAttribute('font-size') ?? cs?.fontSize ?? '16');
        const fs = fsUser * gAvg * rAvg;
        const fw = parseInt(styleEl.getAttribute('font-weight') ?? cs?.fontWeight ?? '400') || 400;
        const fst = styleEl.getAttribute('font-style') ?? cs?.fontStyle ?? '';
        const italic = fst === 'italic' || fst === 'oblique';
        // COMPUTED family first: it is what actually painted the glyphs on screen,
        // including a tool stylesheet's var(--font-brand)/var(--font-mono) rule
        // (the brand-faces contract). The attribute is the detached-node fallback -
        // and for a connected node with no CSS rule the computed value IS the
        // attribute's cascade result, so nothing regresses.
        const familyRaw = (cs?.fontFamily || styleEl.getAttribute('font-family') || '');
        const family = familyRaw.toLowerCase();

        // 'Convert paths' outlines SVG text like every other run: resolve the run's
        // face (brand statics, user fonts, the generic-to-brand mapping), shape via
        // host.text, and draw filled glyph contours through the SAME PX/PY mapping
        // as the x/y attributes. Before this branch existed the toggle was inert
        // here - SVG-rooted tools' PDFs embedded what substring-matched 'suse' and
        // silently fell back to base-14 fonts for everything else.
        if (convertPaths && _host?.text) {
          try {
            const vf = await resolveVectorFont(
              { fontFamily: familyRaw, fontWeight: String(fw), fontStyle: italic ? 'italic' : 'normal' },
              t);
            if (vf) {
              const shaped = await _host.text.toPath({ text: t, fontUrl: vf.url, fontSize: fsUser, variations: vf.variations, fallbackFonts: vf.fallbacks });
              if (shaped?.d && !shaped.notdef) {
                const advUser = shaped.advanceWidth || 0;
                const xAdj = anchor === 'middle' ? userX - advUser / 2 : anchor === 'end' ? userX - advUser : userX;
                if (rgb && op >= 0.01) {
                  let fillRgb = rgb;
                  if (op < 0.999) fillRgb = blendSvgWithWhite(fillRgb, op);
                  pdf.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
                  drawSvgPathToPdf(pdf, shaped.d, (gx: number) => PX(xAdj + gx), (gy: number) => PY(userY + gy));
                  pdf.fill();
                }
                return advUser;
              }
            }
          } catch (e) {
            _host?.log?.('warn', `pdf: svg text outline failed for "${t.slice(0, 24)}" - ${(e as Error).message}`);
          }
        }
        pdf.setFontSize(Math.max(1, fs));
        let fontSet = false;
        if (family.includes('suse') && registeredFonts) {
          const mono = family.includes('mono');
          const suseStyle = await embedSuseFont(pdf, registeredFonts, fw, italic, mono);
          if (suseStyle) { pdf.setFont(suseFontName(mono), suseStyle); fontSet = true; }
        }
        if (!fontSet) pdf.setFont('helvetica', fw >= 600 ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal'));
        // Draw only when visible + paintable, but ALWAYS measure so following inline runs flow.
        if (rgb && op >= 0.01) {
          if (op < 0.999) rgb = blendSvgWithWhite(rgb, op);
          pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
          const align = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left';
          pdf.text(t, PX(userX), PY(userY), { align });
        }
        let wUser = 0;
        try { wUser = typeof styleEl.getComputedTextLength === 'function' ? styleEl.getComputedTextLength() : 0; } catch { wUser = 0; }
        if (!wUser) { const wpt = pdf.getTextWidth(t); wUser = (gAvg * rAvg) ? wpt / (gAvg * rAvg) : 0; }
        return wUser;
      };

      const nodes = el.childNodes ? [...el.childNodes] : [];
      const hasTspan = nodes.some((n: any) => n.nodeType === 1 && n.tagName?.toLowerCase() === 'tspan');
      // Plain <text> (no tspans): one run at the text's own x/y - unchanged behaviour.
      if (!hasTspan) {
        await drawRun(el, el.textContent ?? '', svgLen(el.getAttribute('x'), vbW), svgLen(el.getAttribute('y'), vbH), el.getAttribute('text-anchor') ?? 'start');
        return;
      }
      // Multi-run: a <tspan> may RESET the pen (x/y) or OFFSET it (dx/dy) and carry its own
      // fill/font; a bare text node flows at the pen in the <text>'s style. Positions resolve
      // from attributes (same user space as PX/PY) so multi-line / positioned tspan text lays
      // out like the browser instead of collapsing every line onto the parent's baseline.
      let penX = svgLen(el.getAttribute('x'), vbW);
      let penY = svgLen(el.getAttribute('y'), vbH);
      const textAnchor = el.getAttribute('text-anchor') ?? 'start';
      for (const n of nodes) {
        if (n.nodeType === 3) {                                   // bare text node - flows inline
          if ((n.textContent ?? '').trim()) penX += await drawRun(el, n.textContent, penX, penY, 'start');
        } else if (n.nodeType === 1 && (n as any).tagName?.toLowerCase() === 'tspan') {
          const ts: any = n;
          const emPx = parseFloat((ts.isConnected ? window.getComputedStyle(ts).fontSize : '') || ts.getAttribute('font-size') || '16') || 16;
          const relLen = (v: string | null): number => { if (!v) return 0; const s = v.trim(); return s.endsWith('em') ? parseFloat(s) * emPx : (parseFloat(s) || 0); };
          if (ts.hasAttribute('x')) penX = svgLen(ts.getAttribute('x'), vbW);
          if (ts.hasAttribute('y')) penY = svgLen(ts.getAttribute('y'), vbH);
          penX += relLen(ts.getAttribute('dx'));
          penY += relLen(ts.getAttribute('dy'));
          penX += await drawRun(ts, ts.textContent, penX, penY, ts.getAttribute('text-anchor') ?? textAnchor);
        }
      }
      return;
    }

    // Fill/stroke fall back to the COMPUTED paint (not a literal black), so a path that
    // inherits its colour from an ancestor group (e.g. logo-wall's one-ink <g fill="ink">)
    // or uses currentColor resolves correctly in PDF instead of rendering black - 
    // getComputedStyle resolves SVG inheritance on the live DOM. (See drawShapeD.)
    if (tag === 'path') { drawShapeD(el, el.getAttribute('d') ?? ''); return; }

    // <ellipse> / <polygon> / <polyline> reduce to a `d` and paint through the same path
    // pipeline. Previously they fell through to the generic child-recurse and were
    // silently DROPPED from PDF output - real geometry loss for filter-voronoi (all
    // polygons), org-chart / diagram-builder connectors, multi-page-pdf, etc. The
    // EMF/EPS/DXF walker (svg-ir.ts) has always drawn them via the same reduction.
    if (tag === 'ellipse') {
      const ecx = svgLen(el.getAttribute('cx'), vbW), ecy = svgLen(el.getAttribute('cy'), vbH);
      const erx = svgLen(el.getAttribute('rx'), vbW), ery = svgLen(el.getAttribute('ry'), vbH);
      if (erx <= 0 || ery <= 0) return;
      drawShapeD(el, `M${ecx - erx},${ecy} A${erx},${ery} 0 1 0 ${ecx + erx},${ecy} A${erx},${ery} 0 1 0 ${ecx - erx},${ecy} Z`);
      return;
    }

    if (tag === 'polygon' || tag === 'polyline') {
      const pts = (el.getAttribute('points') || '').match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
      if (!pts || pts.length < 4) return;
      let d = `M${pts[0]},${pts[1]}`;
      for (let i = 2; i + 1 < pts.length; i += 2) d += ` L${pts[i]},${pts[i + 1]}`;
      drawShapeD(el, d + (tag === 'polygon' ? ' Z' : ''));
      return;
    }

    if (tag === 'image') {
      const href = el.getAttribute('href') || el.getAttribute('xlink:href') || '';
      if (!href) return;
      const x = PX(svgLen(el.getAttribute('x'), vbW));
      const y = PY(svgLen(el.getAttribute('y'), vbH));
      const w = LW(svgLen(el.getAttribute('width'), vbW));
      const h = LH(svgLen(el.getAttribute('height'), vbH));
      if (w <= 0 || h <= 0) return;

      // An <image> pointing at an SVG (e.g. the brand logo) must stay VECTOR - 
      // jsPDF.addImage can't embed SVG. Inline it and recurse, honouring the
      // <image>'s preserveAspectRatio (meet → fit the whole mark, centred).
      // SVG-ness is detected from the bytes (asset URLs are blob: with no hint).
      {
        let inner: any = null;
        try {
          inner = await inlineSvgFromImg(href);
          if (inner) {
            inner.setAttribute('style', `position:absolute;left:-99999px;top:0;width:${Math.max(1, Math.round(w))}px;height:${Math.max(1, Math.round(h))}px`);
            document.body.appendChild(inner);
            const ivb  = inner.viewBox?.baseVal;
            const ivbW = (ivb && ivb.width  > 0) ? ivb.width  : w;
            const ivbH = (ivb && ivb.height > 0) ? ivb.height : h;
            const par  = (el.getAttribute('preserveAspectRatio') || 'xMidYMid meet').trim();
            let fx = x, fy = y, fw = w, fh = h;
            if (!/^none/i.test(par)) {                 // meet: preserve aspect, centre
              const s = Math.min(w / ivbW, h / ivbH);
              fw = ivbW * s; fh = ivbH * s;
              fx = x + (w - fw) / 2; fy = y + (h - fh) / 2;
            }
            // A nested <image href> is a REFERENCED asset (a user logo/photo), not
            // Lolly-rendered content - never imprint it (KEY PRINCIPLE). Its own
            // gradient/filter rasterisation fallback stays unmarked (imprint omitted).
            await drawSvgVectorsInRegion(pdf, inner, fx, fy, fw, fh, registeredFonts, undefined, convertPaths);
          }
        } catch { /* fall through to raster */ }
        finally { inner?.remove(); }
        if (inner) return;
      }

      try {
        const dataUrl = href.startsWith('data:') ? href : await blobToDataUrl(href);
        const { src: imgSrc, fmt } = await imageForPdf(dataUrl);
        pdf.addImage(imgSrc, fmt, x, y, w, h);
      } catch { /* skip unresolvable images */ }
      return;
    }

    // <use href="#id"> renders a deep clone of the referenced element at the use's
    // position. Equivalent to a <g transform="[use transform] translate(x,y)"> wrapping
    // the target: the use's own transform is already folded into tx/ty/sX/sY above, so
    // here we add the x/y translate and walk the target. Previously <use> fell through to
    // the child-recurse and, having no light-DOM children, drew NOTHING. The referenced
    // subtree renders WITHOUT its definition-site ancestors (SVG spec), so visiting the
    // target directly (bypassing the skipped <defs>/<symbol>) is correct.
    if (tag === 'use') {
      const href = (el.getAttribute('href') || el.getAttribute('xlink:href') || '').trim();
      if (!href.startsWith('#') || useDepth >= MAX_USE_DEPTH) return;
      let target: Element | null = null;
      try { target = svgEl.querySelector('#' + CSS.escape(href.slice(1))); } catch { target = null; }
      if (!target || target === el) return;
      const utx = tx + sX * svgLen(el.getAttribute('x'), vbW);
      const uty = ty + sY * svgLen(el.getAttribute('y'), vbH);
      const ttag = target.tagName?.toLowerCase().replace(/^svg:/, '');
      useDepth++;
      try {
        // A <symbol>/<svg> target contributes its CHILDREN (the element itself is a skipped
        // container); any other element (path/g/shape) is walked directly.
        if (ttag === 'symbol' || ttag === 'svg') { for (const c of target.children) await visit(c, utx, uty, sX, sY); }
        else await visit(target, utx, uty, sX, sY);
      } finally { useDepth--; }
      return;
    }

    for (const child of el.children) await visit(child, tx, ty, sX, sY);
    };

    if (rotDeg) {
      // Rotate pivot mapped to PDF pt through this element's composed diagonal
      // transform. A reflection (negative determinant, e.g. a scale(-1) mirror
      // ancestor) reverses rotation handedness, so negate to match the SVG.
      const rotPx = ox + (tx - vbX) * sx;
      const rotPy = oy + (ty - vbY) * sy;
      const deg = (sX * sY * sx * sy) < 0 ? -rotDeg : rotDeg;
      await withPdfRotation(pdf, deg, rotPx, rotPy, drawSelf);
    } else {
      await drawSelf();
    }
  }

  await visit(svgEl, 0, 0, 1, 1);
}

// Reads a CSS property from an element's style attribute (not computed style).
// Used to extract fill/stroke when they are set via style="" rather than as attributes.
function resolveStyleProp(el: any, prop: string): string | null {
  const styleAttr = el.getAttribute('style') ?? '';
  const m = styleAttr.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)'));
  return m ? m[1]!.trim() : null;
}


// Rasterise a CSS linear- or radial-gradient fill to a PNG data URL at pxW×pxH. jsPDF's
// compat-mode API has no vector shading (patterns need advancedAPI, which flips the
// coordinate system), so the PDF walker embeds this bounded bitmap as the box background - 
// faithful multi-stop + angle and alpha-correct (unlike the old flat-midpoint solid),
// reusing the SAME build{Linear,Radial}GradientEl the SVG walker emits so both paths agree.
// `w`/`h` are the box size in CSS px. Returns null when the value isn't a parseable
// linear/radial gradient (the caller falls back to the midpoint solid).
async function gradientPng(bgImg: string, w: number, h: number, pxW: number, pxH: number, imprint?: ImprintState): Promise<string | null> {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('xmlns', NS);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const defs = document.createElementNS(NS, 'defs');
  svg.appendChild(defs);
  // Same layer rule as the SVG walker: `background-image` is a list, listed top-first
  // and painted bottom-first, and each layer is its own gradient element.
  let id = 0;
  for (const layer of splitCssArgs(bgImg).map((l) => l.trim()).filter((l) => l && l !== 'none').reverse()) {
    const gid = ++id;
    const grad = buildLinearGradientEl(NS, layer, 0, 0, w, h, gid)
      || buildRadialGradientEl(NS, layer, 0, 0, w, h, gid);
    if (!grad) continue;
    defs.appendChild(grad);
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', '0'); rect.setAttribute('y', '0');
    rect.setAttribute('width', String(w)); rect.setAttribute('height', String(h));
    rect.setAttribute('fill', `url(#svggrad-${gid})`);
    svg.appendChild(rect);
  }
  if (!defs.childNodes.length) return null;
  return rasterizeSvgElement(svg, pxW, pxH, false, imprint);
}

// Rasterise ONE outer box-shadow (shape only - never the element's content/text) to a
// PNG for the PDF walker: jsPDF has no blur primitive, so a soft shadow is embedded as a
// bounded shadow-only bitmap behind the box, mirroring the SVG walker's feGaussianBlur
// shape (makeRoundedFill + the identical stdDeviation = blur/2). Returns the PNG plus the
// shadow's region in element-local CSS px (the caller scales to pt + places it behind the
// box). `wCss`/`hCss` are the box size in CSS px; `radiiCss` the CSS-px corner radii.
/**
 * An INSET shadow as a shadow-only bitmap covering exactly the element's box.
 *
 * Same geometry the SVG walker emits (which measures 0.02% against the browser): the
 * region between the border box and an offset, spread-shrunken copy of it, as one
 * evenodd path, blurred and clipped to the box. PDF has no blur operator, so unlike
 * SVG this has to be baked - but baking a shadow is a far smaller compromise than
 * baking the element, and it is the mechanism the soft OUTER shadow already uses here.
 */
/**
 * A blurred text shadow as a shadow-only bitmap covering the line box plus `pad`.
 *
 * `d` is the shaped glyph outline in CSS px with its origin on the text baseline, so
 * the SVG places it at (pad + offset, pad + baseline-within-line + offset).
 */
async function rasterizeTextShadow(
  glyphs: { d: string } | { text: string; style: CSSStyleDeclaration },
  sh: { x: number; y: number; blur: number }, col: Rgba,
  lineW: number, lineH: number, baselineInLine: number, pad: number,
  dprX: number, dprY: number, imprint?: ImprintState,
): Promise<string | null> {
  const rw = lineW + 2 * pad, rh = lineH + 2 * pad;
  if (rw <= 0 || rh <= 0) return null;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('xmlns', NS);
  svg.setAttribute('viewBox', `0 0 ${n2(rw)} ${n2(rh)}`);
  const defs = document.createElementNS(NS, 'defs');
  const filt = document.createElementNS(NS, 'filter');
  filt.setAttribute('id', 'ts');
  filt.setAttribute('x', '-50%'); filt.setAttribute('y', '-50%');
  filt.setAttribute('width', '200%'); filt.setAttribute('height', '200%');
  filt.setAttribute('color-interpolation-filters', 'sRGB');
  const fe = document.createElementNS(NS, 'feGaussianBlur');
  fe.setAttribute('stdDeviation', String(sh.blur / 2));   // CSS blur radius → σ
  filt.appendChild(fe);
  defs.appendChild(filt);
  svg.appendChild(defs);
  // Outlined glyphs when the caller has them; otherwise an SVG <text> in the run's
  // own font. The raster happens in the browser, so the page's fonts resolve - this
  // is the same shape the run itself takes when text-to-path is unavailable.
  let p: Element;
  if ('d' in glyphs) {
    p = document.createElementNS(NS, 'path');
    p.setAttribute('d', glyphs.d);
    p.setAttribute('transform', `translate(${n2(pad + sh.x)},${n2(pad + baselineInLine + sh.y)})`);
  } else {
    p = document.createElementNS(NS, 'text');
    p.setAttribute('x', String(n2(pad + sh.x)));
    p.setAttribute('y', String(n2(pad + baselineInLine + sh.y)));
    p.setAttribute('dominant-baseline', 'alphabetic');
    p.setAttribute('font-family', glyphs.style.fontFamily);
    p.setAttribute('font-size', glyphs.style.fontSize);
    p.setAttribute('font-weight', glyphs.style.fontWeight);
    p.setAttribute('font-style', glyphs.style.fontStyle);
    if (glyphs.style.letterSpacing && glyphs.style.letterSpacing !== 'normal') {
      p.setAttribute('letter-spacing', glyphs.style.letterSpacing);
    }
    p.textContent = glyphs.text;
  }
  p.setAttribute('fill', `rgb(${col[0]},${col[1]},${col[2]})`);
  if (col[3] < 1) p.setAttribute('fill-opacity', String(col[3]));
  p.setAttribute('filter', 'url(#ts)');
  svg.appendChild(p);
  const pxW = Math.max(2, Math.min(MAX_RASTER_PX, Math.round(rw * dprX)));
  const pxH = Math.max(2, Math.min(MAX_RASTER_PX, Math.round(rh * dprY)));
  return await rasterizeSvgElement(svg, pxW, pxH, false, imprint);
}

async function rasterizeInsetShadow(
  sh: { x: number; y: number; blur: number; spread: number; color: string },
  wCss: number, hCss: number, radiiCss: CornerRadii, dprX: number, dprY: number, imprint?: ImprintState,
): Promise<string | null> {
  const col = parseCssColorFull(sh.color);
  if (!col || wCss <= 0 || hCss <= 0) return null;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('xmlns', NS);
  svg.setAttribute('viewBox', `0 0 ${n2(wCss)} ${n2(hCss)}`);
  const defs = document.createElementNS(NS, 'defs');

  const iw = Math.max(0, wCss - 2 * sh.spread), ih = Math.max(0, hCss - 2 * sh.spread);
  const pad = sh.blur * 3 + Math.abs(sh.x) + Math.abs(sh.y) + Math.abs(sh.spread) + 8;
  const ring = document.createElementNS(NS, 'path');
  ring.setAttribute('d',
    `M${n2(-pad)} ${n2(-pad)}H${n2(wCss + pad)}V${n2(hCss + pad)}H${n2(-pad)}Z` +
    roundedRectPath(sh.x + sh.spread, sh.y + sh.spread, iw, ih, insetCorners(radiiCss, sh.spread)));
  ring.setAttribute('fill-rule', 'evenodd');
  ring.setAttribute('fill', `rgb(${col[0]},${col[1]},${col[2]})`);
  if (col[3] < 1) ring.setAttribute('fill-opacity', String(col[3]));

  if (sh.blur > 0) {
    const filt = document.createElementNS(NS, 'filter');
    filt.setAttribute('id', 'ish');
    filt.setAttribute('filterUnits', 'userSpaceOnUse');
    filt.setAttribute('x', String(n2(-pad))); filt.setAttribute('y', String(n2(-pad)));
    filt.setAttribute('width', String(n2(wCss + 2 * pad))); filt.setAttribute('height', String(n2(hCss + 2 * pad)));
    filt.setAttribute('color-interpolation-filters', 'sRGB');
    const fe = document.createElementNS(NS, 'feGaussianBlur');
    fe.setAttribute('stdDeviation', String(sh.blur / 2));   // CSS blur radius → σ
    filt.appendChild(fe);
    defs.appendChild(filt);
    ring.setAttribute('filter', 'url(#ish)');
  }
  const clip = document.createElementNS(NS, 'clipPath');
  clip.setAttribute('id', 'ic');
  clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
  clip.appendChild(makeRoundedFill(NS, 0, 0, wCss, hCss, radiiCss, uniformRadius(radiiCss), '#fff'));
  defs.appendChild(clip);
  ring.setAttribute('clip-path', 'url(#ic)');
  svg.appendChild(defs);
  svg.appendChild(ring);

  const pxW = Math.max(2, Math.min(MAX_RASTER_PX, Math.round(wCss * dprX)));
  const pxH = Math.max(2, Math.min(MAX_RASTER_PX, Math.round(hCss * dprY)));
  return await rasterizeSvgElement(svg, pxW, pxH, false, imprint);
}

async function rasterizeBoxShadow(
  sh: { x: number; y: number; blur: number; spread: number; color: string },
  wCss: number, hCss: number, radiiCss: CornerRadii, dprX: number, dprY: number, imprint?: ImprintState,
): Promise<{ png: string; rx: number; ry: number; rw: number; rh: number } | null> {
  const col = parseCssColorFull(sh.color);
  if (!col) return null;
  const sw = Math.max(0, wCss + 2 * sh.spread);
  const shh = Math.max(0, hCss + 2 * sh.spread);
  if (sw <= 0 || shh <= 0) return null;
  const pad = sh.blur * 1.5 + Math.abs(sh.spread) + 8;    // matches the SVG walker's blur pad
  const shapeX = sh.x - sh.spread, shapeY = sh.y - sh.spread;   // element-local CSS px
  const rx = shapeX - pad, ry = shapeY - pad, rw = sw + 2 * pad, rh = shh + 2 * pad;
  const sRadii = insetCorners(radiiCss, -sh.spread);             // negative inset = outset
  const fill = col[3] < 1 ? `rgba(${col[0]},${col[1]},${col[2]},${col[3]})` : `rgb(${col[0]},${col[1]},${col[2]})`;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('xmlns', NS);
  svg.setAttribute('viewBox', `${n2(rx)} ${n2(ry)} ${n2(rw)} ${n2(rh)}`);
  const shape = makeRoundedFill(NS, shapeX, shapeY, sw, shh, sRadii, uniformRadius(sRadii), fill);
  if (sh.blur > 0) {
    const defs = document.createElementNS(NS, 'defs');
    const filt = document.createElementNS(NS, 'filter');
    filt.setAttribute('id', 'sh');
    filt.setAttribute('filterUnits', 'userSpaceOnUse');
    filt.setAttribute('x', String(n2(rx))); filt.setAttribute('y', String(n2(ry)));
    filt.setAttribute('width', String(n2(rw))); filt.setAttribute('height', String(n2(rh)));
    filt.setAttribute('color-interpolation-filters', 'sRGB');   // CSS composites in sRGB
    const fe = document.createElementNS(NS, 'feGaussianBlur');
    fe.setAttribute('in', 'SourceGraphic');
    fe.setAttribute('stdDeviation', String(sh.blur / 2));
    filt.appendChild(fe);
    defs.appendChild(filt);
    svg.appendChild(defs);
    shape.setAttribute('filter', 'url(#sh)');
  }
  svg.appendChild(shape);
  // Per-axis density (points→px) so the bitmap hits RASTER_DPI in the placed PT region,
  // not RASTER_DPI/scale - the region is placed at rw*scaleX × rh*scaleY pt.
  const pxW = Math.max(2, Math.min(MAX_RASTER_PX, Math.round(rw * dprX)));
  const pxH = Math.max(2, Math.min(MAX_RASTER_PX, Math.round(rh * dprY)));
  const png = await rasterizeSvgElement(svg, pxW, pxH, false, imprint);
  return { png, rx, ry, rw, rh };
}


// Walks the live DOM tree and emits jsPDF vector objects:
//   • background-color → filled rect / roundedRect
//   • border-top → thin filled rect (used for divider lines)
//   • <svg> subtrees → drawSvgVectorsInRegion
//   • <img> → addImage (circular headshots pre-clipped to a canvas)
//   • block-level leaf text → pdf.text() with computed font/color/align
//
// Font: custom webfonts (e.g. SUSE) are approximated with Helvetica. Text is
// still selectable/searchable vector - only the typeface differs from screen.
// Transparency: jsPDF fills are opaque; semi-transparent CSS colors render at
// full opacity (acceptable approximation for brand colours).
// Rasterise a live <svg> subtree (inner <style> + gradients intact) to a PNG
// data URL, alpha preserved. The PDF walker uses this for gradient / filter
// illustrations the vector path can't reproduce faithfully (no shading; CSS-class
// fills). `flipX` mirrors horizontally to honour a scaleX(-1) CSS transform.
// Neutralise DOCUMENT-LAYOUT style on a root SVG that is about to be serialised and
// loaded standalone as an <img> for rasterisation. A caller (the <img>→SVG branch)
// positions the live element off-screen - style="position:absolute;left:-99999px;…;
// width:Npx;height:Mpx" - so its computed fills resolve for the vector walk. That style
// must NOT ride into the raster: as a standalone image, left:-99999px shifts the WHOLE
// artwork off the raster (→ a blank PNG, which is how bag-video's gradient Geeko vanished
// from every PDF export), and a style width/height overrides the sizing attributes the
// rasteriser sets. Only LAYOUT props are stripped; colour / custom-properties
// (currentColor, var() fills) survive so the artwork keeps its paint.
const RASTER_STRIP_STYLE_PROPS = ['position', 'left', 'top', 'right', 'bottom', 'inset',
  'margin', 'margin-left', 'margin-top', 'margin-right', 'margin-bottom',
  'transform', 'width', 'height'] as const;
export function stripRasterLayoutStyle(el: Element): void {
  const s = (el as unknown as HTMLElement).style;
  if (s) for (const p of RASTER_STRIP_STYLE_PROPS) s.removeProperty(p);
}

async function rasterizeSvgElement(svgEl: Element, pxW: number, pxH: number, flipX = false, imprint?: ImprintState): Promise<string> {
  const clone = svgEl.cloneNode(true) as Element;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  stripRasterLayoutStyle(clone);
  clone.setAttribute('width',  String(pxW));
  clone.setAttribute('height', String(pxH));
  await inlineBlobUrlsInEl(clone);
  const xml = new XMLSerializer().serializeToString(clone);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('svg rasterise failed'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width  = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d')!;
  if (flipX) { ctx.translate(pxW, 0); ctx.scale(-1, 1); }
  ctx.drawImage(img, 0, 0, pxW, pxH);
  // Lolly-rendered gradient/filter/pattern subtree → carry the pixel imprint into
  // the PDF/PPTX raster it becomes (opts.imprint gated, size-floored).
  imprintEmbedCanvas(canvas, imprint);
  return canvas.toDataURL('image/png');
}

const MAX_RASTER_PX = 2000;   // per-side cap for the vector escape-hatch (matches the inline-SVG raster)
// How much already-painted content a single `backdrop-filter: blur()` may duplicate.
// The backdrop is reconstructed by copying what sits behind the element, so a blurred
// bar late in a busy page copies most of that page. Past this, the element falls back
// to the raster hatch - a wrong-but-bounded answer beats an unbounded correct one.
const BACKDROP_MAX_NODES = 400;
const RASTER_DPI = 200;       // resolution for the PDF escape-hatch (points × RASTER_DPI/72)

// Rasterise ONE live element's subtree to a PNG data URL at pxW×pxH device px - the
// vector escape-hatch: dom-to-image serialises the node's computed style into a
// detached <foreignObject> and the browser paints it, so filters / masks / blend /
// conic-gradient / clip-path render FAITHFULLY instead of being dropped by the walker.
// The node is captured into its own box at (0,0) (left/top/margin neutralised, scaled
// to fill). Returns null on failure so the caller falls through to the (lossy) vector
// walk - never worse than before. Nothing mounts on-screen, so the position:fixed
// containing-block gotcha (the offscreen-stage flash) does not apply here.
export async function rasterizeNodeToDataUrl(el: HTMLElement, pxW: number, pxH: number, bg?: string, imprint?: ImprintState, ownPaintOnly?: boolean, padPx = 0): Promise<string | null> {
  const r = el.getBoundingClientRect();
  const cssW = r.width, cssH = r.height;
  if (cssW < 0.5 || cssH < 0.5 || pxW < 2 || pxH < 2) return null;
  // `padPx`: extra output pixels on every side, with the content shifted into the
  // middle. A CSS effect can paint OUTSIDE the element's box - a drop-shadow is the
  // common one - and a capture sized to the box crops it, which is how a drop-shadow
  // came out sheared off in PDF export. The caller places the padded image at the
  // correspondingly enlarged rect.
  const pad = Math.max(0, Math.round(padPx));
  const lib = await getDomToImage();
  const restore = await swapBlobUrls(el);
  try {
    const canvas = await lib.toCanvas(el, {
      width: pxW + 2 * pad, height: pxH + 2 * pad,
      // `ownPaintOnly`: capture the element's OWN paint layer - background, border,
      // effect - and none of its descendants, so the caller can keep walking those
      // as vector. dom-to-image-more applies `filter` to every node it clones EXCEPT
      // the root, so excluding everything yields exactly the root's own paint. The
      // explicit width/height in `style` below keeps the box from collapsing when the
      // element sized to its (now absent) content.
      ...(ownPaintOnly ? { filter: (n: Node) => n === el } : {}),
      style: {
        // translate first (unscaled output px), then scale - so the element lands
        // `pad` pixels in from the top-left of the larger canvas.
        transform: `translate(${pad}px, ${pad}px) scale(${pxW / cssW}, ${pxH / cssH})`,
        transformOrigin: 'top left',
        width: `${cssW}px`, height: `${cssH}px`,
        left: '0', top: '0', margin: '0',
        ...(bg ? { background: bg } : {}),
      },
    });
    // Lolly-composited DOM subtree → carry the imprint into the PDF/PPTX/SVG raster
    // it becomes. (A user <img> descendant baked into this composite is perturbed
    // too - Lolly-composed content, PSNR-bounded; the one caveat, see task notes.)
    imprintEmbedCanvas(canvas, imprint);
    return canvas.toDataURL('image/png');
  } catch (e) {
    _host?.log?.('warn', `vector export: node rasterise fallback failed - ${(e as Error).message}`);
    return null;
  } finally {
    restore();
  }
}

/**
 * plans/104 section 12 Q2 - capture ONE element that carries a real 3-D pose, with the pose
 * intact, for a vector export to embed as a per-box `<image>`.
 *
 * Separate from {@link rasterizeNodeToDataUrl} because that function CANNOT do this,
 * and spike S2 measured how badly: it overwrites the clone root's `transform` with its
 * own fit translate/scale and resizes the root to `getBoundingClientRect()` - which on
 * a tilted element IS the projected AABB - so a 45°-pitched card comes back untilted
 * and stretched to fill that box (mean 35/255, IoU 0.88, "trapezoid → rectangle"). S2's
 * rule was "capture a WRAPPER whose posed box is the child, never the tilted element as
 * the capture root".
 *
 * This is that rule without touching the live DOM. There is no wrapper to insert (and
 * inserting one would move a node on a live artboard mid-export, restarting animations
 * and resetting media): instead the clone root keeps its OWN layout size - so nothing
 * re-lays-out - and the fit transform is composed IN FRONT of the element's own pose,
 * pre-anchored about its `transform-origin`:
 *
 *   translate(pad − s·aabb.x, pad − s·aabb.y) · scale(s) · [T(o)·M·T(−o)]
 *
 * with `transform-origin: 0 0` on the clone so the composition is read left to right in
 * the box's own space. `T(o)·M·T(−o)` is computed here with `DOMMatrix` (which performs
 * the perspective divide the same way the compositor does) and emitted as one
 * `matrix3d`, which S2 measured to be byte-identical to the equivalent transform list.
 *
 * ⚑ THE FIT TRANSFORM LANDS AFTER THE DIVIDE, which is the one thing about this that
 * looks wrong and is not. CSS composes the whole list into ONE 4×4 and divides once at
 * the end, so the instinct is that `translate(tx)` gets divided by `w` too. It does not:
 * the translate's first row is `(1, 0, 0, tx)`, so it contributes `tx·w`, and `(s·x_M +
 * tx·w_M) / w_M = s·(x_M/w_M) + tx` exactly. A uniform scale is likewise exact (it never
 * touches `w`). Both hold only while the fit sits LEFT of the pose in the list, which is
 * why the order here is not cosmetic. Measured on a `rx −45` still: per-row ink-centre
 * drift 0.00 px across both embeds, where a divided translate would shear each row by
 * `tx·(1/w−1)`.
 *
 * The returned `rect` is where the caller must place the image - the posed AABB grown
 * by the effect spill, in the element's own client coordinates. `getBoundingClientRect`
 * is exact against an analytic projection in both engines (S2 section 3a), so the placement
 * needs no second implementation of the projection.
 *
 * Null on any failure, so the caller can fall through to what it did before.
 */
export async function rasterizePosedNodeToDataUrl(
  el: HTMLElement, scale: number, imprint?: ImprintState, padCss = 0,
): Promise<{ dataUrl: string; x: number; y: number; w: number; h: number } | null> {
  const aabb = el.getBoundingClientRect();
  // The element's own LAYOUT box, which a transform never changes - so the clone can
  // keep it and skip the re-layout that is the whole defect in the escape hatch.
  const cssW = el.offsetWidth || aabb.width;
  const cssH = el.offsetHeight || aabb.height;
  if (!(cssW > 0.5 && cssH > 0.5) || !(aabb.width > 0.5 && aabb.height > 0.5)) return null;
  const style = window.getComputedStyle(el);
  const posed = posedLocalMatrix(style, cssW, cssH);
  if (!posed) return null;
  const pad = Math.max(0, Math.round(padCss * scale));
  const s = Math.max(0.05, scale);
  // Output size from the POSED extent, not the layout box: a tilted card's picture is
  // its trapezoid's bounding box, and at 85° that is a sliver three times as wide as
  // the card is tall.
  const outW = Math.min(MAX_RASTER_PX, Math.max(2, Math.round(posed.w * s)));
  const outH = Math.min(MAX_RASTER_PX, Math.max(2, Math.round(posed.h * s)));
  const lib = await getDomToImage();
  const restore = await swapBlobUrls(el);
  try {
    const canvas = await lib.toCanvas(el, {
      width: outW + 2 * pad, height: outH + 2 * pad,
      style: {
        transform: `translate(${(pad - posed.x * s).toFixed(3)}px, ${(pad - posed.y * s).toFixed(3)}px) `
          + `scale(${(outW / posed.w).toFixed(6)}, ${(outH / posed.h).toFixed(6)}) ${posed.css}`,
        transformOrigin: 'top left',
        width: `${cssW}px`, height: `${cssH}px`,
        left: '0', top: '0', margin: '0',
      },
    });
    imprintEmbedCanvas(canvas, imprint);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      // The placement rect in the element's own client space: the posed AABB, grown by
      // the same padding the capture carries, so the image lands where the browser
      // painted the pose. `aabb` and `posed` are the same rectangle in two coordinate
      // systems (client vs the box's own), which is why only the pad is added here.
      x: aabb.left - padCss, y: aabb.top - padCss,
      w: aabb.width + 2 * padCss, h: aabb.height + 2 * padCss,
    };
  } catch (e) {
    _host?.log?.('warn', `vector export: posed node rasterise failed - ${(e as Error).message}`);
    return null;
  } finally {
    restore();
  }
}

/**
 * An element's own transform re-anchored about its `transform-origin`, plus the AABB
 * that pose gives its layout box - the two numbers {@link rasterizePosedNodeToDataUrl}
 * needs, and nothing about the DOM beyond the computed style it is handed.
 *
 * `DOMMatrix` is the projector on purpose: it is the same 4×4 the compositor builds
 * from the same string, including the `w` divide, so the AABB agrees with
 * `getBoundingClientRect()` rather than approximating it.
 */
function posedLocalMatrix(
  style: CSSStyleDeclaration, cssW: number, cssH: number,
): { css: string; x: number; y: number; w: number; h: number } | null {
  const raw = (style.transform || '').trim();
  if (!raw || raw === 'none') return null;
  try {
    const [ox, oy] = transformOriginPx(style, cssW, cssH);
    const M = new DOMMatrix(raw);
    const local = new DOMMatrix().translate(ox, oy).multiply(M).translate(-ox, -oy);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of [[0, 0], [cssW, 0], [0, cssH], [cssW, cssH]] as const) {
      const p = local.transformPoint(new DOMPoint(px, py, 0, 1));
      // A corner behind the eye divides by a non-positive w. There is no picture to
      // capture through that pose, so refuse rather than emit a mirrored ghost - the
      // engine's own alphaGuard has already faded such a layer to nothing anyway.
      if (!(p.w > 1e-6)) return null;
      const x = p.x / p.w, y = p.y / p.w;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const w = maxX - minX, h = maxY - minY;
    if (!(w > 0.5 && h > 0.5) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
    return { css: local.toString(), x: minX, y: minY, w, h };
  } catch {
    return null;
  }
}

/** `transform-origin` in px against a `cssW × cssH` box. Percentages resolved. */
function transformOriginPx(style: CSSStyleDeclaration, cssW: number, cssH: number): [number, number] {
  const parts = (style.transformOrigin || '50% 50%').trim().split(/\s+/);
  const one = (v: string | undefined, extent: number, fallback: number): number => {
    if (!v) return fallback;
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return fallback;
    return v.endsWith('%') ? (n / 100) * extent : n;
  };
  return [one(parts[0], cssW, cssW / 2), one(parts[1], cssH, cssH / 2)];
}

// Draws the live DOM as PDF vectors into the rectangular region (ox, oy, regionW,
// regionH) in page points (top-left origin). Callers pass the full page for an
// ordinary export, or the bleed box for a print export (so the design bleeds).
//
// KNOWN LIMITATION - paint order. This walker paints in DOM order and has no
// z-index handling, exactly as the SVG walker did before `ExportOpts.
// stackingOrder`. That flag was added on the SVG side only (page snapshots go
// out as SVG), so SVG/EMF/EPS/DXF can paint in CSS 2.1 Appendix E section E.2 order and
// PDF cannot. A deliberate, recorded divergence in two walkers whose comments
// otherwise ask that they stay mirrored: PDF has no deferred-append equivalent
// here, because it emits drawing operators straight into a content stream rather
// than building a re-parentable node tree, so the same fix is a different (and
// larger) piece of work. Nothing regresses - PDF keeps the order it always had.
async function drawHtmlVectors(pdf: any, node: Element, ox: number, oy: number, regionW: number, regionH: number, convertPaths = true, onProgress?: (done: number, total: number) => void, rasterFallback = true, imprint?: ImprintState, signal?: AbortSignal): Promise<void> {
  const rect0 = node.getBoundingClientRect();
  const scaleX = regionW / rect0.width;
  const scaleY = regionH / rect0.height;
  // CSS px → PDF pt - accounts for the CSS transform scale applied to the
  // canvas node. node.clientWidth is the layout width before the transform.
  const cssToPt = regionW / (node.clientWidth || rect0.width);
  // Virtual origin: shifting the reference top-left by the region offset bakes it
  // into every (rect − rootRect)·scale below, so the artwork lands at (ox, oy)
  // without touching the inline-text / pseudo-content helpers downstream.
  const rootRect = {
    left: rect0.left - ox / scaleX, top: rect0.top - oy / scaleY,
    width: rect0.width, height: rect0.height, right: rect0.right, bottom: rect0.bottom,
  };
  // Tracks which font variants have been registered in this PDF instance.
  const registeredFonts = new Set();

  // Cooperative yielding: the vector walk + host.text.toPath (HarfBuzz) shaping
  // below runs fully synchronously and janks the UI for the whole export on a
  // complex document. Mirror the CMYK pixel pass - every YIELD_NODES elements,
  // report progress and hand the event loop a turn. Purely additive: geometry
  // and draw order are untouched, so the emitted PDF bytes are identical.
  const totalNodes = ((node as any).querySelectorAll?.('*').length ?? 0) + 1;
  let nodesWalked = 0;
  const YIELD_NODES = 200;
  // The SVG walker's transform guard, mirrored (bridge/transform-neutralise.ts).
  const neutralise = newNeutraliseGuard();
  const warnTransform = (m: string): void => { _host?.log?.('warn', `pdf: ${m}`); };
  /** Elements embedded as a posed raster instead of vector - see the branch below. */
  let tiltedRasters = 0;

  async function visit(el: any): Promise<void> {
    if (el.nodeType !== 1) return;
    if (++nodesWalked % YIELD_NODES === 0) {
      onProgress?.(Math.min(nodesWalked, totalNodes), totalNodes);
      signal?.throwIfAborted();      // the yield is what lets a cancel be seen at all
      await new Promise<void>((r) => setTimeout(r));         // unblock the UI thread
    }
    const tag = el.tagName.toLowerCase();
    if (tag === 'style' || tag === 'script') return;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    // A closed <details> still LAYS OUT its content - Chrome skips it at paint time
    // via ::details-content, which computed style does not expose (display, visibility
    // and content-visibility all read "visible" on the hidden subtree, and it reports a
    // real getBoundingClientRect). So the walker drew it: the export preflight card on
    // /info/authoring-tools rendered its collapsed Format/Size rows straight through
    // the buttons below it. `content-visibility: hidden` set by an author is the same
    // class of skip, and is caught here too.
    if (isPaintSkipped(el, style)) return;
    const elOpacity = parseFloat(style.opacity ?? '1');
    if (elOpacity === 0) return;

    // CSS rotate(): neutralise it, walk the axis-aligned subtree, and wrap the draw
    // in a jsPDF rotation about the transform-origin. Additive (no-op unrotated).
    const rotDeg = pureRotationDeg(style.transform);
    if (rotDeg) {
      // Guarded neutralise, exactly as the SVG walker does it - a running transform
      // animation outranks the inline style, and the re-entry that follows recurses
      // per attempt (plans/104 section 9 P3.1; bridge/transform-neutralise.ts). `null` = the
      // transform survived, so fall through to the AABB path with its rect as-is.
      const restore = neutraliseTransform(el, neutralise, warnTransform);
      if (restore) {
        try {
          const unrot = el.getBoundingClientRect();     // reading forces the reflow
          const pivot = rotationPivot(style, unrot, rootRect);
          await withPdfRotation(pdf, rotDeg, pivot.x * scaleX, pivot.y * scaleY, () => visit(el));
        } finally { restore(); }
        return;
      }
    }

    // General 2-D transform (rotate+scale / skew / matrix) that isn't a pure rotation:
    // mirror the SVG walker - neutralise, walk the untransformed subtree, wrap the draw
    // in the full CTM about the transform-origin. Pure translate/scale → AABB path below;
    // a real 3-D/perspective pose takes the posed-raster branch straight after this one.
    const mtx = pureRotationDeg(style.transform) === 0 ? parseCssMatrix(style.transform) : null;
    if (mtx && !isAxisAlignedMat(mtx)) {
      // Same guarded neutralise as the rotation branch above.
      const restore = neutraliseTransform(el, neutralise, warnTransform);
      if (restore) {
        try {
          const unrot = el.getBoundingClientRect();
          const pivot = rotationPivot(style, unrot, rootRect);
          // Child geometry is drawn in anisotropically-scaled pt space (S = diag(scaleX,scaleY)),
          // so the CTM that reproduces the CSS matrix M there is S·M·S⁻¹, NOT M: the off-diagonals
          // pick up the aspect ratio (rotate/skew shear differently once x and y are scaled
          // unequally). The SVG walker gets this for free from its single outer scale(scaleX,scaleY)
          // group; the PDF walker bakes scale per-axis into every coord, so conjugate here. e,f are
          // the S-scaled translation. (Uniform scale → ar=1 → unchanged, matching withPdfRotation.)
          const ar = (scaleX && scaleY) ? scaleX / scaleY : 1;
          const mPt: Mat2D = { a: mtx.a, b: mtx.b / ar, c: mtx.c * ar, d: mtx.d, e: mtx.e * scaleX, f: mtx.f * scaleY };
          await withPdfMatrix(pdf, mPt, pivot.x * scaleX, pivot.y * scaleY, () => visit(el));
        } finally { restore(); }
        return;
      }
    }

    // A real 3-D pose: per-element raster, never the AABB (plans/104 section 12 Q2). The SVG
    // walker's branch carries the full reasoning and the S2 numbers; this is the mirror,
    // and it has to exist here too because PDF inherits the same `parseCssMatrix`
    // refusal and therefore the same wrong picture (a tilted card as an upright
    // rectangle stretched to its projected bounding box).
    if (rasterFallback && isNonAffineTransform(style.transform)) {
      const posedShot = await rasterizePosedNodeToDataUrl(
        el as HTMLElement, (RASTER_DPI / 72) * Math.max(scaleX, scaleY), imprint, effectSpillCss(style),
      );
      if (posedShot) {
        tiltedRasters++;
        pdf.addImage(posedShot.dataUrl, 'PNG',
          (posedShot.x - rootRect.left) * scaleX, (posedShot.y - rootRect.top) * scaleY,
          posedShot.w * scaleX, posedShot.h * scaleY);
        return;
      }
      _host?.log?.('warn', `pdf: tilted <${tag}> could not be captured; falling back to its bounding box`);
    }

    const rect = el.getBoundingClientRect();
    if (rect.width < 0.5 || rect.height < 0.5) return;

    const x = (rect.left - rootRect.left) * scaleX;
    const y = (rect.top  - rootRect.top)  * scaleY;
    const w = rect.width  * scaleX;
    const h = rect.height * scaleY;

    // clip-path (circle/ellipse/inset/polygon) → jsPDF clip so the node stays vector
    // (mirrors the SVG walker). Geometry is parsed in CSS px, scaled to pt when applied.
    // The clip wraps the WHOLE element paint (bg/border/content), so it goes around
    // paintEl inside a graphics-state save/restore - restored on every early-return path
    // (raster hatch / svg / img). Unparseable shapes leave clipShape null → paintEl's
    // escape-hatch rasterises them (clipBasicShapes:false).
    const cpVal = style.clipPath || (style as any).webkitClipPath;
    const clipShapeRaw = (cpVal && cpVal !== 'none') ? parseClipShape(cpVal, rect.width, rect.height) : null;
    // A zero-area clip paints nothing - return before any draw, matching the SVG walker.
    if (clipShapeRaw && clipShapeRaw.kind === 'empty') return;
    const clipShape = clipShapeRaw;
    // Partial element opacity (0<o<1): jsPDF has no group-opacity primitive, so apply it
    // as a GState alpha on the element's own draws. Correct for a LEAF (text/solid box - 
    // no descendants to composite); non-leaves keep the current opaque behaviour rather
    // than mis-composite overlapping descendants (a per-op alpha ≠ CSS group opacity).
    const alpha = (elOpacity < 1 && el.children.length === 0 && typeof pdf.GState === 'function' && typeof pdf.setGState === 'function') ? elOpacity : 1;
    if (!clipShape && alpha === 1) { await paintEl(el, tag, style, rect, x, y, w, h, false); return; }
    pdf.saveGraphicsState();
    try {
      if (alpha < 1) pdf.setGState(new pdf.GState({ opacity: alpha, 'stroke-opacity': alpha }));
      if (clipShape) pdfApplyClip(pdf, clipShape, x, y, scaleX, scaleY);
      await paintEl(el, tag, style, rect, x, y, w, h, !!clipShape);
    } finally { pdf.restoreGraphicsState(); }
  }

  // Paint one element's background, borders, SVG/image content, and (unless it returns
  // early) its block children + inline text + pseudo content. Split out of visit() so a
  // clip-path can wrap the whole paint with a guaranteed graphics-state restore.
  // `clipBasicShapes` = the element's clip-path was vectorised, so a basic-shape clip
  // isn't re-rasterised by the escape-hatch below.
  async function paintEl(el: any, tag: string, style: CSSStyleDeclaration, rect: DOMRect, x: number, y: number, w: number, h: number, clipBasicShapes: boolean): Promise<void> {
    // CSS-px CornerRadii → pt (per axis). Shared by the box-shadow, background and border.
    const scaleRadii = (r: CornerRadii): CornerRadii => ({
      topLeft:     [r.topLeft[0]     * scaleX, r.topLeft[1]     * scaleY],
      topRight:    [r.topRight[0]    * scaleX, r.topRight[1]    * scaleY],
      bottomRight: [r.bottomRight[0] * scaleX, r.bottomRight[1] * scaleY],
      bottomLeft:  [r.bottomLeft[0]  * scaleX, r.bottomLeft[1]  * scaleY],
    });

    // ── Box shadow (painted behind everything, mirrors the SVG walker) ──────────
    // A HARD shadow (blur 0) is a plain offset shape → true vector rounded rect. A SOFT
    // (blurred) shadow has no jsPDF vector primitive, so it's a bounded shadow-ONLY raster
    // (never the element's content/text). PDF-only path - EMF/EPS go through the SVG walker
    // with noBoxShadow, so no gate is needed here.
    if (tag !== 'img' && tag !== 'svg' && style.boxShadow && style.boxShadow !== 'none') {
      const { radii: shRadiiCss } = resolveRadii(style, rect.width, rect.height);
      // KNOWN DIVERGENCE: outer shadows only. The SVG walker draws inset shadows too
      // (a clipped evenodd ring); the PDF walker has no clip+filter equivalent wired
      // up here yet, and drawing an inset shadow as an outer one would be worse than
      // omitting it.
      for (const sh of parseBoxShadow(style.boxShadow).reverse()) {
        if (sh.inset) continue;
        if (sh.blur <= 0) {
          // hard shadow → vector: offset+spread-grown rounded rect in the shadow colour
          const col = parseCssColorFull(sh.color);
          const sw = Math.max(0, rect.width + 2 * sh.spread), shh = Math.max(0, rect.height + 2 * sh.spread);
          if (!col || sw <= 0 || shh <= 0) continue;
          const sRadii = scaleRadii(insetCorners(shRadiiCss, -sh.spread));
          const sx = x + (sh.x - sh.spread) * scaleX, sy = y + (sh.y - sh.spread) * scaleY;
          pdf.setFillColor(col[0], col[1], col[2]);
          withPdfAlpha(pdf, col[3], () => pdfRoundedRect(pdf, sx, sy, sw * scaleX, shh * scaleY, sRadii, uniformRadius(sRadii), 'F'));
        } else {
          // soft shadow → concentric bands, outermost first. PDF has no blur operator,
          // but the blur of an edge IS the Gaussian CDF, so painting the shape at a
          // series of outsets with the right alpha increments reproduces it in pure
          // vector - no embedded bitmap, editable, resolution-independent. Bands come
          // from the engine (gaussianShadowBands) so PDF and any other blur-less
          // renderer share one derivation.
          const col = parseCssColorFull(sh.color);
          const bands = col ? gaussianShadowBands(sh.blur, col[3]) : [];
          if (col && bands.length) {
            pdf.setFillColor(col[0], col[1], col[2]);
            for (const band of bands) {
              const t = sh.spread + band.outset;
              const bw = rect.width + 2 * t, bh = rect.height + 2 * t;
              if (bw <= 0 || bh <= 0) continue;
              const bRadii = scaleRadii(insetCorners(shRadiiCss, -t));   // negative inset = outset
              const bx = x + (sh.x - t) * scaleX, by = y + (sh.y - t) * scaleY;
              withPdfAlpha(pdf, band.alpha, () =>
                pdfRoundedRect(pdf, bx, by, bw * scaleX, bh * scaleY, bRadii, uniformRadius(bRadii), 'F'));
            }
          } else {
            // No parseable colour → the old bounded shadow-only raster.
            try {
              const dens = RASTER_DPI / 72;
              const res = await rasterizeBoxShadow(sh, rect.width, rect.height, shRadiiCss, dens * scaleX, dens * scaleY, imprint);
              if (res) pdf.addImage(res.png, 'PNG', x + res.rx * scaleX, y + res.ry * scaleY, res.rw * scaleX, res.rh * scaleY);
            } catch { /* skip a shadow that won't rasterise */ }
          }
        }
      }
    }

    // ── Rasterise escape-hatch (mirrors visitSvgNode) ───────────────────────────
    // Node uses CSS the walker can't express → embed it as an image at its rect
    // instead of dropping the effect. Returns on success so children/bg/text aren't
    // re-drawn. w,h are in points; RASTER_DPI sets the embedded bitmap resolution.
    //
    // NO `cssFilter` CAP, AND NO `dropShadow` CAP - deliberate, and the whole of plan
    // 104's P1d work item. This walker has no `filter` branch: `filter: blur()` and
    // `filter: drop-shadow()` have nothing to emit into a content stream, so every
    // filtered box comes here. Declining the caps is what routes them here rather than
    // letting detectUnsupportedCss call them "supported" on the SVG walker's behalf and
    // drop them in silence, which is what happened until now (DOF blur and the
    // design `shadow: content` / `shadow: depth` silhouettes simply were not in
    // the PDF).
    //
    // WHY RASTER AND NOT A NATIVE BRANCH. The box-shadow block above proves a blur CAN
    // be vectorised when the blurred thing is a KNOWN SHAPE: gaussianShadowBands paints
    // the box's own rounded rect at a fan of outsets, because the blur of an edge is the
    // Gaussian CDF. Neither of these is a known shape. `filter: drop-shadow()` follows
    // the element's ALPHA SILHOUETTE - the transparent-PNG/icon cutout is the entire
    // reason `shadow: content` exists - so a band fan of its bounding box would be a
    // confidently wrong picture, worse than a bitmap. And `filter: blur()` blurs the
    // element's own painted content, for which PDF has no operator at all. So the honest
    // lane is the escape hatch: the effect is VISIBLE and correct, paid for in a bitmap
    // for that one box. House style degrades visibly; it never refuses.
    const rasterReason = rasterFallback ? detectUnsupportedCss(el, style, { clipBasicShapes }) : null;
    if (rasterReason) {
      const dpr = RASTER_DPI / 72;
      const pxW = Math.max(2, Math.min(MAX_RASTER_PX, Math.round(w * dpr)));
      const pxH = Math.max(2, Math.min(MAX_RASTER_PX, Math.round(h * dpr)));
      // How far this element's effects paint OUTSIDE its box. A `filter` is the case
      // that matters: capturing a drop-shadowed element at exactly its rect shears
      // the shadow off, which measured 2.1% mean / 32% worst-pixel against the
      // browser - the single largest shadow error left in PDF output.
      //
      // Units are the trap here: `pxW` is derived from `w`, which is POINTS, while the
      // spill is CSS px. The pad has to be converted to points first and only then to
      // capture pixels, or the padded image is placed at a rect that does not match the
      // padding inside it - which measured WORSE than not padding at all.
      const spillCss = effectSpillCss(style);
      const padPt = spillCss * scaleX;
      const padPx = Math.round(padPt * dpr);
      // The box-shadow is neutralised for the capture, because it has ALREADY been
      // painted, as vector bands, a few blocks up. Without this the padded capture is
      // the one place the two owners overlap: the pad exists to hold a filter's spill,
      // and a box-shadow spills into exactly that ring, so it came out painted twice and
      // twice as dark (measured 0.93% mean on a blurred box over a soft shadow, against
      // 0.45% with the shadow left to the bands alone). Same neutralise-then-restore
      // shape as the rotation branch's `transform` and the SVG hatch's `opacity`.
      // The cost is that the bands are not themselves blurred by a layer blur, which is
      // the smaller of the two errors and keeps the shadow editable vector.
      const shadowed = Boolean(style.boxShadow && style.boxShadow !== 'none');
      const prevShadow = shadowed ? el.style.boxShadow : '';
      if (shadowed) el.style.boxShadow = 'none';
      let png: string | null;
      try { png = await rasterizeNodeToDataUrl(el as HTMLElement, pxW, pxH, undefined, imprint, false, padPx); }
      finally { if (shadowed) el.style.boxShadow = prevShadow; }
      if (png) {
        _host?.log?.('info', `pdf: rasterised <${tag}> (unsupported ${rasterReason})`);
        pdf.addImage(png, 'PNG', x - padPt, y - padPt, w + 2 * padPt, h + 2 * padPt);
        return;
      }
      // png == null → fall through to the vector walk.
    }

    // ── Background fill ───────────────────────────────────────────────────────
    // CSS corner-overlap clamped (→ pill, not ellipse) via the shared engine math,
    // resolved in CSS px then scaled per axis. Uniform corners take jsPDF's fast
    // roundedRect; differing corners take a four-corner path.
    const { radii: radiiCss, uniform: uniformCss } = resolveRadii(style, rect.width, rect.height);
    const radii = scaleRadii(radiiCss);
    const uniform: CornerPair | null = uniformCss ? [uniformCss[0] * scaleX, uniformCss[1] * scaleY] : null;
    const hasRadius = uniform ? (uniform[0] > 0 || uniform[1] > 0) : true;
    const bgImg = style.backgroundImage;
    if (bgImg && (/^radial-gradient\(/.test(bgImg) || /^linear-gradient\(/.test(bgImg))) {
      // linear/radial gradient: rasterise the fill (faithful multi-stop + angle,
      // alpha-correct) and place it as the box background, clipped to the rounded box - 
      // jsPDF compat mode has no vector shading. A solid background-color paints behind it
      // (CSS order) so a gradient with transparent stops sits on the right colour. If the
      // gradient can't be parsed/rasterised we fall back to the flat solid-midpoint so we
      // are never WORSE than before.
      const solid = parseCssColor(style.backgroundColor);
      if (solid) { pdf.setFillColor(solid[0], solid[1], solid[2]); pdfRoundedRect(pdf, x, y, w, h, radii, uniform, 'F'); }
      let placed = false;
      // 1) TRUE VECTOR - a jsPDF ShadingPattern, unless the gradient has transparent
      //    stops (PDF shading carries no per-stop alpha → would lose them).
      const spec = pdfGradientSpec(bgImg, x, y, w, h, cssToPt);
      if (spec && !spec.hasAlpha) {
        placed = fillPdfShading(pdf, spec, (doc) =>
          drawSvgPathToPdf(doc, roundedRectPath(x, y, w, h, radii), (v) => v, (v) => v));
      }
      // 2) FAITHFUL RASTER - alpha stops, an unparseable value, or no shading API.
      if (!placed) {
        try {
          const dpr = RASTER_DPI / 72;
          const pxW = Math.max(2, Math.min(MAX_RASTER_PX, Math.round(w * dpr)));
          const pxH = Math.max(2, Math.min(MAX_RASTER_PX, Math.round(h * dpr)));
          const png = await gradientPng(bgImg, rect.width, rect.height, pxW, pxH, imprint);
          if (png) {
            if (hasRadius) await withPdfRoundedClip(pdf, x, y, w, h, radii, uniform, () => pdf.addImage(png, 'PNG', x, y, w, h));
            else pdf.addImage(png, 'PNG', x, y, w, h);
            placed = true;
          }
        } catch { /* fall through to the midpoint solid */ }
      }
      // 3) LAST RESORT - a flat midpoint solid (only if nothing painted yet).
      if (!placed && !solid) {
        const mid = sampleGradientMidpoint(bgImg);
        if (mid) { pdf.setFillColor(mid[0], mid[1], mid[2]); pdfRoundedRect(pdf, x, y, w, h, radii, uniform, 'F'); }
      }
    } else {
      // Solid background-color first (bottom layer).
      const solid = parseCssColor(style.backgroundColor);
      if (solid) { pdf.setFillColor(solid[0], solid[1], solid[2]); pdfRoundedRect(pdf, x, y, w, h, radii, uniform, 'F'); }
      // background-image: url() → a real embedded image (vector-first for the box: its
      // text/children stay vector instead of the whole node being rasterised). cover/contain
      // fitted from the image's natural size, clipped to the box.
      const bgUrl = (bgImg && bgImg !== 'none') ? firstCssUrl(bgImg) : null;
      if (bgUrl) {
        try {
          const href = await cssUrlToHref(bgUrl);
          if (href) {
            const { src, fmt } = await imageForPdf(href);
            const dims = await imageDims(src);
            // Place it the way the SVG walker does (placeBackground honours
            // background-size, -position AND -repeat) rather than via the old cover-fitting
            // helper, which understood only cover/contain/two-length and DEFAULTED
            // TO COVER (removed in the same commit - this was its last caller). That default was harmless while firstCssUrl silently dropped
            // every inline-SVG data-URI; now that those resolve, an auto-sized
            // 14px chevron on a 176x29 box would be drawn at 176x176 - a giant
            // smeared caret where there used to be nothing at all.
            const pl = dims ? placeBackground(
              style.backgroundSize, style.backgroundPosition, style.backgroundRepeat,
              { w, h }, { w: dims.w, h: dims.h },
            ) : null;
            const draw = pl && pl.w > 0 && pl.h > 0
              ? () => {
                  // Tile across whichever axes repeat, bounded by the box. A
                  // no-repeat background places exactly once.
                  const stepX = pl.repeatX ? pl.w : Infinity;
                  const stepY = pl.repeatY ? pl.h : Infinity;
                  const x0 = pl.repeatX ? pl.x % pl.w - pl.w : pl.x;
                  const y0 = pl.repeatY ? pl.y % pl.h - pl.h : pl.y;
                  for (let ty = y0; ty < h; ty += stepY) {
                    for (let tx = x0; tx < w; tx += stepX) {
                      if (tx + pl.w > 0 && ty + pl.h > 0) pdf.addImage(src, fmt, x + tx, y + ty, pl.w, pl.h);
                      if (!Number.isFinite(stepX)) break;
                    }
                    if (!Number.isFinite(stepY)) break;
                  }
                }
              : () => pdf.addImage(src, fmt, x, y, w, h);
            // Clip when the placement can spill: a rounded box, a tiling run, or a
            // single tile larger than its area.
            const spills = Boolean(pl && (pl.repeatX || pl.repeatY
              || pl.x < -0.5 || pl.y < -0.5 || pl.x + pl.w > w + 0.5 || pl.y + pl.h > h + 0.5));
            if (hasRadius || spills) await withPdfRoundedClip(pdf, x, y, w, h, radii, uniform, draw);
            else draw();
          }
        } catch { /* skip the bg image - the box's own content still renders vector */ }
      } else if (bgImg && bgImg !== 'none' && !solid) {
        // a non-url, non-gradient bg (e.g. a lone unresolved value) → the old midpoint solid
        const mid = sampleGradientMidpoint(bgImg);
        if (mid) { pdf.setFillColor(mid[0], mid[1], mid[2]); pdfRoundedRect(pdf, x, y, w, h, radii, uniform, 'F'); }
      }
    }

    // ── Inset box-shadow ──────────────────────────────────────────────────────
    // CSS paints an inset shadow over the background and under the border, so it goes
    // between the two. Baked to a shadow-only bitmap covering exactly the box: PDF has
    // no blur operator, and baking the shadow is a far smaller compromise than baking
    // the element - the same trade the soft outer shadow already makes here.
    for (const sh of parseBoxShadow(style.boxShadow).reverse()) {
      if (!sh.inset) continue;
      const icol = parseCssColorFull(sh.color);
      // Same band derivation as the outer shadow, mirrored: an inset shadow is the
      // blur of the region OUTSIDE the offset, shrunken inner shape, so each band is
      // a RING - everything except that shape shrunk by the band's outset - filled
      // even-odd and clipped to the box.
      const ibands = icol ? gaussianShadowBands(sh.blur, icol[3]) : [];
      if (icol && (ibands.length || sh.blur <= 0)) {
        const iw = Math.max(0, rect.width - 2 * sh.spread);
        const ih = Math.max(0, rect.height - 2 * sh.spread);
        const iRadiiCss = insetCorners(radiiCss, sh.spread);
        const steps = ibands.length ? ibands : [{ outset: 0, alpha: icol[3] }];
        await withPdfRoundedClip(pdf, x, y, w, h, radii, uniform, () => {
          pdf.setFillColor(icol[0], icol[1], icol[2]);
          for (const band of steps) {
            const t = band.outset;
            const bw = iw - 2 * t, bh = ih - 2 * t;
            // Past the point where the inner shape collapses, the ring is the whole
            // box - the shadow has closed over the middle.
            const inner = bw > 0 && bh > 0
              ? roundedRectPath(sh.x + sh.spread + t, sh.y + sh.spread + t, bw, bh, insetCorners(iRadiiCss, t))
              : '';
            const outer = `M0 0H${n2(rect.width)}V${n2(rect.height)}H0Z`;
            withPdfAlpha(pdf, band.alpha, () => {
              drawSvgPathToPdf(pdf, outer + inner,
                (sx: number) => x + sx * scaleX, (sy: number) => y + sy * scaleY);
              pdf.fillEvenOdd();
            });
          }
        });
      } else {
        try {
          const dens = RASTER_DPI / 72;
          const png = await rasterizeInsetShadow(sh, rect.width, rect.height, radiiCss,
            dens * scaleX, dens * scaleY, imprint);
          if (png) pdf.addImage(png, 'PNG', x, y, w, h);
        } catch { /* skip a shadow that won't rasterise */ }
      }
    }

    // ── Borders ───────────────────────────────────────────────────────────────
    // A uniform border is stroked as one rect/path (so a radius is honoured); a
    // divider (border-top only) or mixed border fills per edge. Colours keep their
    // alpha via GState (jsPDF GState is sticky, so withPdfAlpha resets it).
    const bSide = (wKey: string, cKey: string): { bw: number; rgb: Rgba | null } => {
      const bw = parseFloat((style as any)[wKey]) || 0;
      return { bw, rgb: bw > 0 ? parseCssColorFull((style as any)[cKey]) : null };
    };
    const bT = bSide('borderTopWidth',    'borderTopColor');
    const bR = bSide('borderRightWidth',  'borderRightColor');
    const bB = bSide('borderBottomWidth', 'borderBottomColor');
    const bL = bSide('borderLeftWidth',   'borderLeftColor');
    const eqRgb = (a: Rgba | null, b: Rgba | null) => a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
    const uniformBorder = bT.rgb && bT.bw === bR.bw && bT.bw === bB.bw && bT.bw === bL.bw
      && eqRgb(bT.rgb, bR.rgb) && eqRgb(bT.rgb, bB.rgb) && eqRgb(bT.rgb, bL.rgb);
    if (uniformBorder) {
      const lw = bT.bw * scaleY;
      pdf.setDrawColor(bT.rgb![0], bT.rgb![1], bT.rgb![2]);
      pdf.setLineWidth(lw);
      // CSS border-box: the border sits inside w×h; jsPDF strokes centred, so inset by lw/2.
      const innerUniform: CornerPair | null = uniform ? [Math.max(0, uniform[0] - lw / 2), Math.max(0, uniform[1] - lw / 2)] : null;
      // dashed/dotted → a line-dash pattern (jsPDF dash is sticky, so reset after). Round
      // caps for dotted give round dots. Guarded - older jsPDF lacks the setters.
      const dash = borderDashArray(style.borderTopStyle, lw);
      if (dash && typeof pdf.setLineDashPattern === 'function') {
        pdf.setLineDashPattern(dash.dash, 0);
        if (dash.round && typeof pdf.setLineCap === 'function') pdf.setLineCap('round');
      }
      withPdfAlpha(pdf, bT.rgb![3], () =>
        pdfRoundedRect(pdf, x + lw / 2, y + lw / 2, w - lw, h - lw,
          insetCorners(radii, lw / 2), innerUniform, 'S'));
      if (dash && typeof pdf.setLineDashPattern === 'function') {
        pdf.setLineDashPattern([], 0);
        if (dash.round && typeof pdf.setLineCap === 'function') pdf.setLineCap('butt');
      }
    } else {
      const edge = (rgb: Rgba, dx: number, dy: number, ew: number, eh: number) => withPdfAlpha(pdf, rgb[3], () => {
        pdf.setFillColor(rgb[0], rgb[1], rgb[2]); pdf.rect(dx, dy, ew, eh, 'F');
      });
      if (bT.rgb) edge(bT.rgb, x, y, w, bT.bw * scaleY);
      if (bB.rgb) edge(bB.rgb, x, y + h - bB.bw * scaleY, w, bB.bw * scaleY);
      if (bL.rgb) edge(bL.rgb, x, y, bL.bw * scaleX, h);
      if (bR.rgb) edge(bR.rgb, x + w - bR.bw * scaleX, y, bR.bw * scaleX, h);
    }

    // ── SVG subtree → vector region (or raster for gradient illustrations) ─────
    if (tag === 'svg') {
      // Gradient / filter illustrations (e.g. the bag-video Geeko) can't be
      // reproduced by the vector walker: drawSvgVectorsInRegion has no axial /
      // radial shading and reads fills only from attributes or inline style, so
      // url(#gradient) fills disappear and CSS-class fills (declared in an inner
      // <style>) fall back to black - a solid silhouette. The SVG export keeps
      // these vector by cloning the node verbatim; for PDF we rasterise just this
      // subtree to a PNG (alpha preserved) so it keeps its shading, and reserve
      // the crisp vector walk for solid-fill SVGs (qr, lockup, …).
      if (el.querySelector('linearGradient, radialGradient, filter, pattern')) {
        try {
          // Resolution from the OUTPUT region (points → px at ~150dpi), not the
          // on-screen box - so it's independent of the preview zoom and bounded.
          const dpr = 150 / 72;
          const pxW = Math.max(2, Math.min(2000, Math.round(w * dpr)));
          const pxH = Math.max(2, Math.min(2000, Math.round(h * dpr)));
          // Honour a scaleX(-1) flip (computed transform's matrix a-component < 0).
          const tm = String(style.transform || '').match(/matrix\(\s*(-?[\d.]+)/);
          const flipX = tm ? parseFloat(tm[1]!) < 0 : el.classList.contains('flip');
          const png = await rasterizeSvgElement(el, pxW, pxH, flipX, imprint);
          pdf.addImage(png, 'PNG', x, y, w, h);
          return;
        } catch { /* fall through to the vector walk */ }
      }
      await drawSvgVectorsInRegion(pdf, el, x, y, w, h, registeredFonts, imprint, convertPaths);
      return;
    }

    // ── Image (raster, or inlined SVG → vectors) ──────────────────────────────
    if (tag === 'img') {
      const src = el.src || el.getAttribute('src') || '';
      if (!src || w <= 0 || h <= 0) return;

      // SVG images (e.g. the corner brand logo) must stay VECTOR - rasterising
      // them breaks true CMYK output and looks soft. Inline the SVG and draw it
      // through the same vector path as an inline <svg>, honouring object-fit:
      // "cover" slice-fits (fills the box, clipping the overflow - e.g. an SVG
      // hero/masthead), everything else "meet"-fits (whole mark, centred = contain).
      // SVG-ness is detected from the bytes (asset URLs are blob: with no hint).
      {
        let svgEl: any = null;
        try {
          svgEl = await inlineSvgFromImg(src);
          if (svgEl) {
            // Off-screen so viewBox.baseVal + any computed fills resolve.
            svgEl.setAttribute('style', `position:absolute;left:-99999px;top:0;width:${Math.round(rect.width)}px;height:${Math.round(rect.height)}px`);
            document.body.appendChild(svgEl);
            const vb = svgEl.viewBox?.baseVal;
            const vbW = (vb && vb.width  > 0) ? vb.width  : rect.width;
            const vbH = (vb && vb.height > 0) ? vb.height : rect.height;
            const cover = style.objectFit === 'cover';
            const s = cover ? Math.max(w / vbW, h / vbH) : Math.min(w / vbW, h / vbH);
            const fw = vbW * s, fh = vbH * s;
            const [px, py] = objectPositionFractions(style.objectPosition);
            const dx = x + (w - fw) * px, dy = y + (h - fh) * py;
            // This SVG came from a user <img src> (a logo/photo asset), not from
            // Lolly's own render - never imprint it (KEY PRINCIPLE). imprint omitted,
            // so its gradient-rasterisation fallback keeps the user's pixels intact.
            if (cover) {
              await withPdfClipRect(pdf, x, y, w, h, () => drawSvgVectorsInRegion(pdf, svgEl, dx, dy, fw, fh, registeredFonts, undefined, convertPaths));
            } else {
              await drawSvgVectorsInRegion(pdf, svgEl, dx, dy, fw, fh, registeredFonts, undefined, convertPaths);
            }
          }
        } catch { /* fall through to the raster path */ }
        finally { svgEl?.remove(); }
        if (svgEl) return;
      }
        try {
          // Inline EVERY scheme, not just data:/blob:. An http/relative src was
          // previously written straight into `<image href="/catalog/…">`, and an SVG
          // consumed as `<img src="shot.svg">` - which is how /info serves every docs
          // screenshot, and how any exported SVG is normally viewed - runs in secure
          // static mode with NO network access, so that image renders BLANK and the
          // file is not self-contained. The sibling CSS-url branch already fetches
          // and inlines http (cssUrlToHref, :1651), so this was the `<img>` branch
          // being inconsistent with it rather than a deliberate exemption.
          // Falls back to the raw src on failure (cross-origin without CORS, 404),
          // which is exactly the old behaviour - never worse than before.
          const dataUrl0 = src.startsWith('data:') ? src
            : await blobToDataUrl(src).catch(() => src);
          // Bake any CSS filter() into the bitmap (browser canvas) so PDF matches
          // screen/PNG; no-op + graceful fallback when filter is none.
          const dataUrl = await bakeImageFilter(el, dataUrl0, style.filter);

          // Clip circular images (headshots with border-radius: 50%)
          const rTL = parseCssLen(style.borderTopLeftRadius,     rect.width);
          const rTR = parseCssLen(style.borderTopRightRadius,    rect.width);
          const rBL = parseCssLen(style.borderBottomLeftRadius,  rect.width);
          const rBR = parseCssLen(style.borderBottomRightRadius, rect.width);
          const minR  = Math.min(rTL, rTR, rBL, rBR);
          const halfMin = Math.min(rect.width, rect.height) * 0.45;
          const isCircle = minR >= halfMin;

          // circularClipImage prefers the live (unfiltered) <img>; when a filter was
          // baked, clip the filtered data URL instead so the treatment survives.
          const imgUrl = isCircle
            ? await circularClipImage(style.filter && style.filter !== 'none' ? null : el, dataUrl).catch(() => dataUrl)
            : dataUrl;
          const { src: imgSrc, fmt } = await imageForPdf(imgUrl);
          // Honour object-fit against the image's natural aspect (matches screen/PNG):
          //   contain → meet-fit the whole image into the box, centred (logo-wall tiles);
          //   cover   → fill the box, scaling up by the LARGER ratio and clipping the
          //             overflow (hero/masthead images - see multi-page-pdf);
          //   else    → stretch to the box (the prior default).
          // objectPosition fractions place the fitted image; the same `(box-fit)*frac`
          // offset works for both: it's a positive inset for contain, a negative one
          // (the cropped overflow) for cover.
          const nw = el.naturalWidth || 0, nh = el.naturalHeight || 0;
          const fit = style.objectFit;
          if (!isCircle && (fit === 'contain' || fit === 'cover') && nw > 0 && nh > 0) {
            const r = w / nw, R = h / nh;
            const s = fit === 'cover' ? Math.max(r, R) : Math.min(r, R);
            const fw = nw * s, fh = nh * s;
            const [px, py] = objectPositionFractions(style.objectPosition);
            const dx = x + (w - fw) * px, dy = y + (h - fh) * py;
            if (fit === 'cover') {
              await withPdfClipRect(pdf, x, y, w, h, () => pdf.addImage(imgSrc, fmt, dx, dy, fw, fh));
            } else {
              pdf.addImage(imgSrc, fmt, dx, dy, fw, fh);
            }
          } else {
            pdf.addImage(imgSrc, fmt, x, y, w, h);
          }
        } catch { /* skip unloadable images */ }
      return;
    }

    // ── Content: block children, inline text, pseudo markers ───────────────────
    // Inline children (<strong>, <em>, <span> …) are intentionally skipped in the child
    // loop - their content is rendered by renderInlineContent, where each fragment gets
    // its own computed style (preserving bold, color, etc.).
    //
    // overflow:hidden → clip the CONTENT to the box (mirrors the SVG walker): CSS crops an
    // overflow box's descendants to the box (its corner curve when rounded), so a child that
    // spills - a differently-filled child past a rounded edge, or an over-sized child past a
    // square edge - would otherwise show outside it. Only the content is clipped; bg/border
    // painted above stay, so the box's own edge is intact. A ROUNDED overflow box always
    // clips; a SQUARE one clips only when a descendant ACTUALLY spills (scroll > client), so a
    // clip isn't added to every layout overflow:hidden box (withPdfRoundedClip → a plain rect
    // when there's no radius).
    const clipsOverflow = (style.overflowX && style.overflowX !== 'visible') || (style.overflowY && style.overflowY !== 'visible');
    const spillsBox = (el.scrollWidth || 0) > (el.clientWidth || 0) + 1 || (el.scrollHeight || 0) > (el.clientHeight || 0) + 1;
    const drawContent = async (): Promise<void> => {
      for (const child of el.children) {
        const cd = window.getComputedStyle(child).display;
        // Same carve-out as the SVG walker: inline children are left to the inline-text
        // pass, which emits TEXT and has no <svg> branch - so an inline <svg> was
        // dropped from PDF output entirely, silently. An <svg> is replaced content with
        // a box of its own at any display value. A bare <svg> defaults to display:inline,
        // which is what a tool's own canvas is, so this is the same missing-QR-code bug
        // on the PDF side. Drawing it can only add: the previous behaviour was nothing.
        if ((cd === 'inline' || cd === 'inline-block' || cd === 'inline-flex')
            && child.tagName.toLowerCase() !== 'svg') continue;
        await visit(child);
      }
      await renderInlineContent(pdf, el, style, rootRect, scaleX, scaleY, cssToPt, registeredFonts, convertPaths, imprint);
      await pdfPseudoContent(pdf, el, rootRect, scaleX, scaleY, cssToPt, registeredFonts, convertPaths);
    };
    if (clipsOverflow && (hasRadius || spillsBox)) await withPdfRoundedClip(pdf, x, y, w, h, radii, uniform, drawContent);
    else await drawContent();
  }

  await visit(node);
  if (tiltedRasters) {
    _host?.log?.('info',
      `pdf: ${tiltedRasters} tilted element${tiltedRasters === 1 ? '' : 's'} embedded as images `
      + '(PDF has no perspective transform; every untilted layer stayed vector)');
  }
}

// Walks text nodes and inline elements within blockEl, rendering each fragment
// at its own getBoundingClientRect position with its own computed style.
// This preserves inline formatting (<strong> bold, <em> italic, color spans, etc.)
// that would be lost by reading the block's innerText as a flat string.
//
// Block-level children are skipped - the main visit() loop already handles them.
// <br> is skipped - the line break is implicit in the text nodes' y positions.
async function renderInlineContent(
  pdf: any, blockEl: any, blockStyle: CSSStyleDeclaration,
  rootRect: { left: number; top: number }, scaleX: number, scaleY: number, cssToPt: number,
  registeredFonts: Set<unknown>, convertPaths = true, imprint?: ImprintState,
): Promise<void> {
  async function walk(node: any, nodeStyle: CSSStyleDeclaration, deco: Deco): Promise<void> {
    if (node.nodeType === 3) {
      const text = node.textContent;
      if (!text || !text.trim()) return;

      const fontSizePx = parseFloat(nodeStyle.fontSize) || 16;
      // Resolve the run's real font (SUSE / a user Google font / platform) in
      // BOTH modes - live text needs it to choose embed-vs-outline too.
      const vf = _host?.text ? await resolveVectorFont(nodeStyle, text) : null;
      const fontUrl = vf?.url ?? null;
      const embedUrl = await pdfUserFontEmbed(vf);
      const isUserFont = Boolean(vf?.url.startsWith('blob:'));
      // Outline when converting paths, OR when a user font can't be faithfully
      // embedded in jsPDF (variable off-weight / needs the subset chain) - so
      // weight and coverage never silently break in live-text mode either.
      // A faithfully-embeddable user run stays live (pdf.text below).
      const outline = canVectoriseText(nodeStyle, fontUrl, Boolean(_host?.text))
        && (convertPaths || (isUserFont && !embedUrl));
      // Set the font for the pdf.text path (live text, and the notdef fallback):
      // the embeddable user font when we have one, else SUSE/Helvetica.
      await applyPdfTextStyle(pdf, nodeStyle, cssToPt, registeredFonts, embedUrl);
      const letterSpacing = letterSpacingPx(nodeStyle.letterSpacing);
      const features = featureSettingsToHb(nodeStyle.fontFeatureSettings);
      const textRgb = parseCssColor(nodeStyle.color) || ([0, 0, 0] as Rgb);
      const { ascent, descent } = fontMetricsPx(nodeStyle, fontSizePx);

      // Use the browser's actual line breaks + per-line positions (exact match to
      // on-screen and the SVG output), NOT jsPDF's splitTextToSize - which re-measures
      // with the embedded font's metrics and can wrap a word a character or two early
      // when they differ slightly from the browser's. 'Convert paths' ON outlines each
      // line via host.text.toPath; OFF (or any shape failure) draws embedded pdf.text
      // at the same position, so output is never worse than before.
      const segs = text.split('\n');
      let offset = 0;
      for (const seg of segs) {
        if (seg.trim().length > 0) {
          for (const line of visualLines(node, offset, offset + seg.length)) {
            const r = line.rect;
            if (r.width < 0.5 || r.height < 0.5) continue;
            const x = (r.left - rootRect.left) * scaleX;
            // Baseline within the line box = half-leading + ascent (the SAME textBaselineY
            // the SVG walker uses), so a run with line-height > 1 sits centred instead of
            // riding the top of its line box. (Was `top + ascent`, i.e. half-leading = 0.)
            const baselinePt = textBaselineY(r.top - rootRect.top, r.height, ascent, descent) * scaleY;
            const shown = applyTextTransform(line.text, nodeStyle.textTransform);

            // Shape once and reuse: the shadows and the run itself are the same
            // glyphs, and HarfBuzz shaping is the expensive part of this loop.
            let shapedD: string | null | undefined;
            const textPathFor = async (t: string): Promise<string | null> => {
              if (shapedD !== undefined) return shapedD;
              try {
                const res = await _host!.text!.toPath({ text: t, fontUrl: fontUrl!, fontSize: fontSizePx, features: features as string[], letterSpacing, variations: vf!.variations, fallbackFonts: vf!.fallbacks });
                shapedD = res.d && !res.notdef ? res.d : null;
              } catch { shapedD = null; }
              return shapedD;
            };

            // ── text-shadow, back-to-front (CSS paints the first-listed on top) ──
            // A hard offset is exact vector: the same run again, shifted, in the
            // shadow colour. A blurred one has no PDF operator, so the outlined path
            // is baked to a shadow-only bitmap - the same compromise the box shadows
            // make here, and far smaller than baking the text itself.
            const tShadows = parseTextShadow(nodeStyle.textShadow).reverse();
            for (const tsh of tShadows) {
              const scol = parseCssColorFull(tsh.color);
              if (!scol) continue;
              try {
                if (tsh.blur > 0) {
                  const d0 = outline ? await textPathFor(shown) : null;
                  const pad = tsh.blur * 3 + Math.abs(tsh.x) + Math.abs(tsh.y) + 8;
                  const png = await rasterizeTextShadow(
                    d0 ? { d: d0 } : { text: shown, style: nodeStyle },
                    tsh, scol, r.width, r.height,
                    textBaselineY(0, r.height, ascent, descent), pad,
                    (RASTER_DPI / 72) * scaleX, (RASTER_DPI / 72) * scaleY, imprint);
                  if (png) {
                    pdf.addImage(png, 'PNG', x - pad * scaleX,
                      (r.top - rootRect.top - pad) * scaleY,
                      (r.width + 2 * pad) * scaleX, (r.height + 2 * pad) * scaleY);
                  }
                  continue;
                }
                // Hard offset.
                const d0 = outline ? await textPathFor(shown) : null;
                if (d0) {
                  pdf.setFillColor(scol[0], scol[1], scol[2]);
                  withPdfAlpha(pdf, scol[3], () => {
                    drawSvgPathToPdf(pdf, d0,
                      (sx: number) => x + (sx + tsh.x) * cssToPt,
                      (sy: number) => baselinePt + (sy + tsh.y) * cssToPt);
                    pdf.fill();
                  });
                } else {
                  const prev = pdf.getTextColor?.();
                  pdf.setTextColor(scol[0], scol[1], scol[2]);
                  withPdfAlpha(pdf, scol[3], () => {
                    pdf.text(shown, x + tsh.x * cssToPt, baselinePt + tsh.y * cssToPt, { baseline: 'alphabetic' });
                  });
                  if (prev) pdf.setTextColor(prev);
                }
              } catch { /* a shadow that won't draw must not take the text with it */ }
            }

            let drawn = false;
            if (outline) {
              try {
                // A glyph the face lacks (notdef) would print as tofu - fall through
                // to pdf.text, which at least renders through an embedded/base font.
                const { d, notdef } = await _host!.text!.toPath({ text: shown, fontUrl: fontUrl!, fontSize: fontSizePx, features: features as string[], letterSpacing, variations: vf!.variations, fallbackFonts: vf!.fallbacks });
                if (d && !notdef) {
                  const mapX = (sx: number) => x + sx * cssToPt;
                  const mapY = (sy: number) => baselinePt + sy * cssToPt;
                  // -webkit-text-stroke / SVG stroke on the outlined run: a centred stroke,
                  // width CSS px -> pt. `paint-order: stroke` wants the stroke UNDER the fill,
                  // which PDF's B operator (fill then stroke) cannot express, so the path is
                  // issued twice in that one case. ponytail: stroke-opacity is not applied
                  // here (fill and stroke would need separate alpha states); add withPdfAlpha
                  // around the stroke pass if a translucent text stroke shows up in a fixture.
                  const ts = textStrokeAttrs(nodeStyle, parseCssColorFull);
                  const tsCol = ts.length ? parseCssColorFull(ts[0]![1]) : null;
                  const under = ts.some(([k, v]) => k === 'paint-order' && v.indexOf('stroke') === 0);
                  const lj = ts.find(([k]) => k === 'stroke-linejoin')?.[1];
                  pdf.setFillColor(textRgb[0], textRgb[1], textRgb[2]);
                  if (tsCol) {
                    pdf.setDrawColor(tsCol[0], tsCol[1], tsCol[2]);
                    pdf.setLineWidth(Math.max(0.1, parseFloat(ts.find(([k]) => k === 'stroke-width')?.[1] ?? '1') * cssToPt));
                    if (lj) pdf.setLineJoin(lj);
                  }
                  if (tsCol && under) { drawSvgPathToPdf(pdf, d, mapX, mapY); pdf.stroke(); }
                  drawSvgPathToPdf(pdf, d, mapX, mapY);
                  if (tsCol && !under) pdf.fillStroke(); else pdf.fill();
                  if (lj) pdf.setLineJoin('miter');
                  drawn = true;
                }
              } catch (e) {
                _host?.log?.('warn', `pdf: text-to-path failed, using embedded text - ${(e as Error).message}`);
              }
            }
            if (!drawn) pdf.text(shown, x, baselinePt, { baseline: 'alphabetic' });

            // Underline / strikethrough bars in the run's colour (text-decoration is
            // otherwise dropped by the vector walk). Positioned relative to the baseline;
            // width uses scaleX (matching x), vertical offsets use cssToPt.
            if (deco.u || deco.s) {
              const baseline = baselinePt;
              const thick = Math.max(0.5, fontSizePx * 0.06) * cssToPt;
              const widthPt = r.width * scaleX;
              pdf.setFillColor(textRgb[0], textRgb[1], textRgb[2]);
              if (deco.u) pdf.rect(x, baseline + fontSizePx * 0.11 * cssToPt - thick / 2, widthPt, thick, 'F');
              if (deco.s) pdf.rect(x, baseline - fontSizePx * 0.28 * cssToPt - thick / 2, widthPt, thick, 'F');
            }
          }
        }
        offset += seg.length + 1; // +1 for the '\n'
      }

    } else if (node.nodeType === 1) {
      if (node.tagName.toLowerCase() === 'br') return;
      const s = window.getComputedStyle(node);
      if (s.display === 'none') return;
      // Only descend into inline-level elements; block children are visited by
      // the main visit() loop.
      if (s.display !== 'inline' && s.display !== 'inline-block' && s.display !== 'inline-flex') return;
      const cd = mergeDeco(deco, decoFlags(s));
      for (const child of node.childNodes) await walk(child, s, cd);
    }
  }

  for (const child of blockEl.childNodes) await walk(child, blockStyle, decoFlags(blockStyle));
}

// Emit any ::before/::after markers of `el` into the PDF (mirrors svgPseudoContent).
async function pdfPseudoContent(pdf: any, el: Element, rootRect: { left: number; top: number }, scaleX: number, scaleY: number, cssToPt: number, registeredFonts: Set<unknown>, convertPaths: boolean): Promise<void> {
  for (const name of ['::before', '::after']) {
    const ds = pseudoDescriptor(el, name);
    if (!ds) continue;
    const x = (ds.x - rootRect.left) * scaleX;
    const y = (ds.y - rootRect.top)  * scaleY;
    if (ds.bg && ds.w > 0.5 && ds.h > 0.5) {
      const w = ds.w * scaleX, h = ds.h * scaleY;
      const radii: CornerRadii = {
        topLeft:     [ds.radii.topLeft[0]     * scaleX, ds.radii.topLeft[1]     * scaleY],
        topRight:    [ds.radii.topRight[0]    * scaleX, ds.radii.topRight[1]    * scaleY],
        bottomRight: [ds.radii.bottomRight[0] * scaleX, ds.radii.bottomRight[1] * scaleY],
        bottomLeft:  [ds.radii.bottomLeft[0]  * scaleX, ds.radii.bottomLeft[1]  * scaleY],
      };
      const uniform: CornerPair | null = ds.uniform ? [ds.uniform[0] * scaleX, ds.uniform[1] * scaleY] : null;
      pdf.setFillColor(ds.bg[0], ds.bg[1], ds.bg[2]);
      pdfRoundedRect(pdf, x, y, w, h, radii, uniform, 'F');
    }
    if (!ds.text.trim()) continue;
    const fontSizePx = parseFloat(ds.ps.fontSize) || 16;
    const vf = _host?.text ? await resolveVectorFont(ds.ps, ds.text) : null;
    const fontUrl = vf?.url ?? null;
    const embedUrl = await pdfUserFontEmbed(vf);
    const isUserFont = Boolean(vf?.url.startsWith('blob:'));
    const textRgb = parseCssColor(ds.ps.color) || ([0, 0, 0] as Rgb);
    // Baseline within the marker's line box (half-leading + ascent), matching the SVG
    // pseudo path's textBaselineY - so a bullet/arrow lines up with the main text (which
    // is now also centred), not riding the top of its box.
    const lineHPx = parseFloat(ds.ps.lineHeight) || fontSizePx * 1.2;
    const { ascent: pAsc, descent: pDesc } = fontMetricsPx(ds.ps, fontSizePx);
    const baselinePt = textBaselineY(ds.y - rootRect.top, lineHPx, pAsc, pDesc) * scaleY;
    let drawn = false;
    // Outline in convert-paths mode, or for a user font jsPDF can't embed faithfully.
    if (canVectoriseText(ds.ps, fontUrl, Boolean(_host?.text)) && (convertPaths || (isUserFont && !embedUrl))) {
      try {
        const { d, notdef } = await _host!.text!.toPath({ text: ds.text, fontUrl: fontUrl!, fontSize: fontSizePx, variations: vf!.variations, fallbackFonts: vf!.fallbacks });
        if (d && !notdef) {
          pdf.setFillColor(textRgb[0], textRgb[1], textRgb[2]);
          drawSvgPathToPdf(pdf, d, (sx: number) => x + sx * cssToPt, (sy: number) => baselinePt + sy * cssToPt);
          pdf.fill();
          drawn = true;
        }
      } catch (e) { _host?.log?.('warn', `pdf: pseudo text-to-path failed - ${(e as Error).message}`); }
    }
    if (!drawn) {
      await applyPdfTextStyle(pdf, ds.ps, cssToPt, registeredFonts, embedUrl);
      pdf.text(ds.text, x, baselinePt, { baseline: 'alphabetic' });
    }
  }
}

// Sets jsPDF text color, font size, and the font to draw pdf.text() with. The
// font is chosen in order: a faithfully-embeddable user font (its sfnt URL,
// pre-decided by pdfUserFontEmbed) → the SUSE static for the weight/style →
// Helvetica. Embeds whichever it picks into the PDF (once) as a side effect.
async function applyPdfTextStyle(pdf: any, style: CSSStyleDeclaration, cssToPt: number, registeredFonts: Set<unknown>, userEmbedUrl: string | null = null): Promise<void> {
  const textRgb = parseCssColor(style.color) || ([0, 0, 0] as Rgb);
  pdf.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
  const pdfSize = parseFloat(style.fontSize) * cssToPt;
  pdf.setFontSize(pdfSize);
  const weight = parseInt(style.fontWeight) || 400;
  const italic  = style.fontStyle === 'italic' || style.fontStyle === 'oblique';
  const family  = (style.fontFamily || '').toLowerCase();
  if (userEmbedUrl) {
    const name = await embedUserFont(pdf, registeredFonts, userEmbedUrl);
    if (name) { pdf.setFont(name, 'normal'); return; }
  }
  if (family.includes('suse')) {
    const mono = family.includes('mono');
    const suseStyle = await embedSuseFont(pdf, registeredFonts, weight, italic, mono);
    if (suseStyle) { pdf.setFont(suseFontName(mono), suseStyle); return; }
  }
  const fallback = weight >= 600 ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal');
  pdf.setFont('helvetica', fallback);
}




// SVG fill element for a (possibly four-corner) rounded rect: a fast <rect rx ry>
// when corners are uniform, else a <path>. `fillOpacity` < 1 emits fill-opacity
// (which svg-ir flattens over the background for EMF/EPS).
function makeRoundedFill(NS: string, x: number, y: number, w: number, h: number, radii: CornerRadii, uniform: CornerPair | null, fill: string, fillOpacity = 1): Element {
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

// Bake a CSS filter() into a raster image via the browser's OWN canvas filter, so
// vector exports (which embed photos as bitmaps anyway) match the on-screen / PNG
// result instead of dropping the treatment. Used for tools that expose an image
// filter (e.g. dynamic-layout's mono/punch/warm/cool/fade). Returns a filtered PNG
// data URL, or the original on any failure (filter:none, headless/no-canvas,
// tainted cross-origin canvas) - so it can never make output worse.
async function bakeImageFilter(imgEl: any, dataUrl: string, filterStr: string | null | undefined): Promise<string> {
  if (!filterStr || filterStr === 'none') return dataUrl;
  try {
    let img: any = (imgEl && imgEl.naturalWidth > 0) ? imgEl : null;
    if (!img) {
      img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
      });
    }
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!(w > 0 && h > 0)) return dataUrl;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx || !('filter' in ctx)) return dataUrl;   // jsdom / old browsers
    ctx.filter = filterStr;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } catch { return dataUrl; }
}


// Downscale an over-provisioned raster to a resolution its DISPLAY BOX can actually
// show, so an inlined <image> carries no pixels the reader will never see.
//
// The case that forced this: a gallery preview committed as a 3200x1800 PNG appears in
// a 341px tile, so the walker was inlining 5.76M pixels for a box that resolves at ~700.
// One such tile was 4.6 MB of a 6.6 MB shot; the gradient and street-map example
// previews are all 1800-3200px. Faithfully inlining the source is correct but wildly
// wasteful for a thumbnail.
//
// The cap is DPI-AWARE, which is the whole reason it is safe on the tool-export path and
// not only for docs: `boxLongCss` is the box in CSS px, and `dpi/CSS_DPI` is how many
// device pixels each CSS px is worth at the export resolution. A screen/SVG export
// (dpi 96-192) caps at ~2x the box; a 300-dpi print export keeps ~3x, so a photo placed
// small on a print page is not softened. Never UPSCALES, and returns the input unchanged
// (byte-identical to before this existed) whenever the source is already within 15% of
// the cap, so the common case pays one Image decode and nothing else.
// `floor` is the minimum device-px-per-CSS-px the cap allows (default 2: never soften a
// tool export below 2x its box). The docs walker opts down to 1 via `rasterDpi`, so a
// continuous-tone asset can be embedded at exactly its rendered box - see ExportOpts.rasterDpi.
// `embed` picks the re-encode format for the downscaled bytes:
//   'png'  (default) - lossless. Tool exports and UI previews, where a lossy pass on a
//          flat gradient/logo would show, and the source may carry alpha.
//   'auto' - opt-in (rasterDpi walker path): a FULLY-OPAQUE asset (a photo) re-encodes as
//          lossy WebP, ~5-10x smaller than PNG with no visible loss at box resolution;
//          anything with even one transparent pixel (icons, logos, cutouts) stays PNG so
//          its edges and transparency are preserved. WebP falls back to PNG where the
//          encoder is absent. Provenance is untouched either way: a vector export declares
//          its embedded assets through the C2PA ingredient chain (opts.ingredients), never
//          through the pixel bytes, so re-encoding a genAI photo here does not drop its
//          AI/credential detection from the exported file.
async function downscaleRasterForBox(imgEl: any, dataUrl: string, boxLongCss: number, dpi: number, floor = 2, embed: 'png' | 'auto' = 'png'): Promise<string> {
  if (!(boxLongCss > 0) || dataUrl.startsWith('data:image/svg')) return dataUrl;
  try {
    let img: any = (imgEl && imgEl.naturalWidth > 0) ? imgEl : null;
    if (!img) {
      img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
      });
    }
    const nw = img.naturalWidth, nh = img.naturalHeight;
    if (!(nw > 0 && nh > 0)) return dataUrl;
    const factor = Math.max(floor, (dpi > 0 ? dpi : CSS_DPI) / CSS_DPI);
    const capLong = Math.max(256, Math.ceil(boxLongCss * factor));
    const srcLong = Math.max(nw, nh);
    if (srcLong <= capLong * 1.15) return dataUrl;         // already sane - leave it be
    const scale = capLong / srcLong;
    const dw = Math.max(1, Math.round(nw * scale)), dh = Math.max(1, Math.round(nh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = dw; canvas.height = dh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;                              // jsdom - keep the source
    ctx.imageSmoothingEnabled = true;
    (ctx as { imageSmoothingQuality?: string }).imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, dw, dh);
    if (embed === 'auto' && isCanvasOpaque(ctx, dw, dh)) {
      const webp = canvas.toDataURL('image/webp', 0.85);
      if (webp.startsWith('data:image/webp')) return webp; // else the encoder no-op'd → PNG
    }
    return canvas.toDataURL('image/png');
  } catch { return dataUrl; }
}

// True when every pixel is fully opaque - the signal to prefer lossy WebP over PNG for an
// inlined asset. A tainted canvas throws on read; treat that as "not provably opaque" so it
// falls back to PNG rather than risking a wrong lossy encode. Scans alpha only (every 4th
// byte); the boxes this runs on are small (a downscaled photo, tens of thousands of pixels).
function isCanvasOpaque(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) return false;
    return true;
  } catch { return false; }
}

// Clips an image to a circle via an offscreen canvas. Used for headshots that
// carry border-radius: 50%. Returns a PNG data URL.
async function circularClipImage(imgEl: any, dataUrl: string): Promise<string> {
  const img: any = (imgEl && imgEl.naturalWidth > 0) ? imgEl : await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const size = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, 0, 0, size, size);
  return canvas.toDataURL('image/png');
}

// Fetch + parse an image source into a live <svg> element IFF it is SVG, so it
// can be drawn as true PDF vectors (jsPDF.addImage rejects SVG). Detection is by
// CONTENT, not URL - asset URLs are blob: with no extension or MIME hint, so we
// fetch the bytes and sniff for "<svg". Known raster MIME types are skipped fast.
// Handles blob:, http(s) and data: sources; returns null for non-SVG/unfetchable.
// Exported for the sequence editor's still vector twin (views/timeline-panel.ts),
// which resolves a data: SVG source through exactly this path so the twin and the
// walker agree on what counts as vector - reached by dynamic import, so the panel
// keeps its no-static-edge-to-export.ts property.
export async function inlineSvgFromImg(src: string): Promise<Element | null> {
  if (!src) return null;
  let text: string | null = null;
  if (/^data:/i.test(src)) {
    if (!/^data:(image\/svg|text\/|application\/(xml|svg))/i.test(src)) return null;
    const comma  = src.indexOf(',');
    const header = src.slice(0, comma);
    const body   = src.slice(comma + 1);
    text = /;base64/i.test(header) ? atob(body) : decodeURIComponent(body);
  } else {
    let blob: Blob;
    try {
      const resp = await fetch(src);
      if (!resp.ok) return null;
      blob = await resp.blob();
    } catch { return null; }
    // Skip obvious rasters without reading them; sniff svg/xml/unknown types.
    if (/^image\/(png|jpe?g|webp|gif|avif|bmp|x-icon|vnd)/i.test(blob.type || '')) return null;
    try { text = await blob.text(); } catch { return null; }
  }
  if (!text || !/<svg[\s>]/i.test(text)) return null;
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
  if (!(svg && svg.tagName && svg.tagName.toLowerCase() === 'svg')) return null;
  // Inlined files carry their own generated ids - namespace them or same-named
  // ids across several inlined files bind every reference to the FIRST one
  // (four covers all clipped by cover 1's `fcovclip-1`; see svg-inline-ids.ts).
  namespaceInlinedSvgIds(svg, src);
  return svg;
}

// ── SUSE font embedding ───────────────────────────────────────────────────────

// Module-level cache: font URL → base64 string. Survives across export calls
// within a session so the TTF files are fetched at most once.
const _fontBase64Cache = new Map<string, string>();

async function loadFontBase64(url: string): Promise<string> {
  if (_fontBase64Cache.has(url)) return _fontBase64Cache.get(url)!;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Font fetch failed: ${url}`);
  const buf = await resp.arrayBuffer();
  // FileReader is the safest way to base64-encode arbitrary binary in a browser.
  // btoa(String.fromCharCode(...uint8)) blows the stack on large font files.
  const b64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]!);
    reader.onerror = reject;
    reader.readAsDataURL(new Blob([buf]));
  });
  _fontBase64Cache.set(url, b64);
  return b64;
}

// Embeds a SUSE weight+style variant into the jsPDF instance and returns the
// jsPDF fontStyle key to use with pdf.setFont(suseFontName(mono), key).
// registeredFonts is a per-PDF-instance Set that avoids re-registering.
// Font-file naming is shared with the SVG path emitter (text-svg.js) so the two
// export paths never resolve the same weight to different files.
const suseFontName = (mono: boolean) => (mono ? 'SUSEMono' : 'SUSE');
async function embedSuseFont(pdf: any, registeredFonts: Set<unknown>, weight: number, italic: boolean, mono = false): Promise<string | null> {
  const style = (mono ? 'm' : '') + (italic ? `wi${weight}` : `w${weight}`);
  if (!registeredFonts.has(style)) {
    const file = suseFontFile(weight, italic, mono);
    const url  = SUSE_FONT_DIR + file;
    try {
      const b64 = await loadFontBase64(url);
      pdf.addFileToVFS(file, b64);
      pdf.addFont(file, suseFontName(mono), style);
      registeredFonts.add(style);
    } catch {
      return null; // fetch failed; caller falls back to helvetica
    }
  }
  return style;
}

// Embeds a decompressed USER font (a blob: sfnt URL minted by the font registry
// from a stored Google woff2) into the jsPDF instance and returns the jsPDF font
// name to setFont with. The name is derived from the url so it's stable and
// unique per face across a PDF; registeredFonts embeds each at most once.
// Unlike SUSE (per-weight static files), a user font is a single variable file,
// so pdfUserFontEmbed only offers it up when jsPDF's default-instance render is
// actually faithful - see there.
async function embedUserFont(pdf: any, registeredFonts: Set<unknown>, url: string): Promise<string | null> {
  const name = `uf_${url}`;
  if (!registeredFonts.has(name)) {
    try {
      const b64 = await loadFontBase64(url); // blob: URLs are fetchable
      const file = `${name}.ttf`;
      pdf.addFileToVFS(file, b64);
      pdf.addFont(file, name, 'normal'); // slant is baked into the embedded file
      registeredFonts.add(name);
    } catch {
      return null;
    }
  }
  return name;
}

// Decide whether a resolved run font can be FAITHFULLY embedded as live text in
// jsPDF, returning its sfnt URL if so, else null (the caller outlines instead - 
// the outline path has the variable axis and per-subset fallback jsPDF lacks).
// Only decompressed USER faces (blob: URLs) are candidates; SUSE stays on its
// own per-weight-static path, and the platform face isn't embedded here.
// Embeddable requires a single face covering the whole run (jsPDF can't chain
// subsets) rendering at the requested weight: a static face always does; a
// variable face only when the request equals its default instance (jsPDF can't
// move the axis). axisDefaults is additive - without it, don't risk a variable
// face.
async function pdfUserFontEmbed(vf: VectorFont | null): Promise<string | null> {
  if (!vf || !vf.url.startsWith('blob:') || vf.fallbacks?.length) return null;
  if (!vf.variations?.length) return vf.url; // static face → its own weight
  const wanted = Number(/wght=(\d+(?:\.\d+)?)/.exec(vf.variations[0] ?? '')?.[1]);
  if (!Number.isFinite(wanted)) return vf.url;
  const defs = await _host?.text?.axisDefaults?.(vf.url).catch(() => null);
  const def = defs?.wght;
  return def != null && Math.abs(def - wanted) < 1 ? vf.url : null;
}

// ── CMYK PDF export ───────────────────────────────────────────────────────────
//
// Post-processes a jsPDF-rendered PDF to convert RGB colour operators to CMYK.
// The pipeline: render with jsPDF → load into pdf-lib → decompress each content
// stream → swap `rg`/`RG` operators → recompress → save.
//
// Raster images embedded by jsPDF remain RGB (their pixel data is not touched).
// Fills, strokes, and text colours become DeviceCMYK.
//
// If opts.palette is provided (array of { hex, cmyk: [C,M,Y,K] } entries with
// values 0–100), brand colours are looked up before generic conversion, giving
// exact ink values for registered swatches.

async function renderCmykPdf(node: Element, opts: ExportOpts): Promise<Blob> {
  // Artwork only (no marks/boxes here) - print finishing is applied below, after
  // the RGB→CMYK conversion, so the marks stay DeviceCMYK (incl. registration).
  const geo = printGeometry(node, opts);
  const rgbBlob = await renderArtworkPdf(node, opts, geo);
  const rgbBytes = new Uint8Array(await rgbBlob.arrayBuffer());

  const { PDFDocument, PDFName, PDFNumber, PDFDict } = await import('pdf-lib') as any;
  const pdfDoc = await PDFDocument.load(rgbBytes);
  const m = opts.meta;
  const creator = m?.software || 'Lolly';
  pdfDoc.setCreator(creator);
  pdfDoc.setProducer(creator);
  pdfDoc.setAuthor(m?.author || creator); // the user if known, else the app
  // Hoisted out of the `if (m)` block: the finish note below appends to this
  // same keyword list, and it must be in scope whether or not there is meta.
  const kw = [m?.software, m?.source, m?.contact].filter(Boolean) as string[];
  if (m) {
    if (m.tool) pdfDoc.setTitle(m.tool);
    if (m.description) pdfDoc.setSubject(m.description);
    if (kw.length) pdfDoc.setKeywords(kw);
  }
  const paletteMap = buildCmykPaletteMap(opts.palette ?? []);
  const spotResourceNames = assignSpotResourceNames(paletteMap);
  const usedKeys = new Set<string>();   // brand palette keys actually hit during substitution
  const usedSpots = new Set<string>();  // spot names actually referenced by a content stream
  const usedGs = new Set<string>();     // overprint/knockout ExtGStates actually emitted

  for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
    if (!(obj.contents instanceof Uint8Array)) continue;

    const dict = obj.dict;
    if (!dict?.get) continue;

    // Image XObjects contain pixel data, not PDF operators - skip them.
    const sub = dict.get(PDFName.of('Subtype'));
    if (sub && String(sub).includes('Image')) continue;

    // jsPDF uses /FlateDecode; skip other filters (e.g. /DCTDecode for JPEG XObjects).
    const filter = dict.get(PDFName.of('Filter'));
    if (filter && !String(filter).includes('FlateDecode')) continue;

    let raw: Uint8Array;
    try {
      raw = filter ? await inflateBytes(obj.contents) : obj.contents;
    } catch { continue; }

    const text = new TextDecoder('latin1').decode(raw);
    if (!/\brg\b|\bRG\b/.test(text)) continue;

    const modified = substitutePdfRgb(text, paletteMap, spotResourceNames, usedKeys, usedSpots, usedGs);
    if (modified === text) continue;

    const modBytes = Uint8Array.from(modified, c => c.charCodeAt(0));
    const recompressed = await deflateBytes(modBytes);

    // PDFRawStream.contents is readonly in TypeScript but a plain own property
    // at runtime - assign directly.
    obj.contents = recompressed;
    dict.set(PDFName.of('Length'), PDFNumber.of(recompressed.length));
    if (!filter) dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
  }

  // Materialise a /Separation colourspace for every spot a content stream actually
  // referenced above: one Type-2 exponential tint-transform function per spot (a
  // linear ramp from "no ink" at tint 0 to the spot's CMYK equivalent at tint 1 - 
  // the standard "spot ink with a process alternate" construction) plus the
  // colourspace array itself, both registered as fresh indirect objects the same
  // way applyPdfX/setPdfxOutputIntent registers the OutputIntent's ICC stream
  // below - then wired into the single artwork page's /Resources/ColorSpace dict
  // under the name substitutePdfRgb already wrote into the content stream
  // ("/CSn cs"/"/CSn CS"). Deferred until after the enumeration loop so no new
  // indirect object is registered while pdfDoc.context.enumerateIndirectObjects()
  // is being walked.
  if (usedSpots.size) {
    const page = pdfDoc.getPage(0);
    const resources = page.node.Resources() || pdfDoc.context.obj({});
    page.node.set(PDFName.of('Resources'), resources);
    const csDict = resources.lookupMaybe(PDFName.of('ColorSpace'), PDFDict) || pdfDoc.context.obj({});
    resources.set(PDFName.of('ColorSpace'), csDict);
    for (const hit of paletteMap.values()) {
      const spot = hit.spot;
      if (!spot || !usedSpots.has(spot.name)) continue;
      const resourceName = spotResourceNames.get(spot.name)!;
      if (csDict.get(PDFName.of(resourceName))) continue; // already wired (dup palette entries)
      // C1 is the alternate this separation FLATTENS to. For a declared finish
      // (spot.finish) buildCmykPaletteMap has already made spot.cmyk the
      // FINISH_MASK_CMYK 100%-K mask rather than the swatch's colour build, so a
      // RIP that drops the plate paints an unmistakable black mask instead of a
      // plausible gold/varnish colour. A RIP that honours the plate never reads
      // it. The finish plate now OVERPRINTS (substitutePdfRgb selects GSfo/GSso for
      // it), so it sits ON the process artwork rather than cutting a hole in it.
      const fn = pdfDoc.context.obj({ FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: spot.cmyk, N: 1 });
      const csArr = pdfDoc.context.obj(['Separation', spot.name, 'DeviceCMYK', pdfDoc.context.register(fn)]);
      csDict.set(PDFName.of(resourceName), pdfDoc.context.register(csArr));
    }
    // The finish declaration must travel WITH the file: a printer who never
    // opens Lolly reads the Info dict, not our export panel. Written here rather
    // than at the earlier setKeywords() because the exact used-spot set is only
    // known after the substitution pass.
    const finishNote = [...paletteMap.values()]
      .map(h => h.spot)
      .filter(s => s?.finish && usedSpots.has(s.name))
      .map(s => `${s!.name} (${s!.finish})`);
    if (finishNote.length) {
      const msg = `Finish plates emitted as overprinting named /Separation plates (100% K process fallback): ${[...new Set(finishNote)].join('; ')}`;
      pdfDoc.setKeywords([...kw, msg]);
      pdfxLog('info', `pdf: ${msg}`);
    }
  }

  // Overprint / knockout graphics states referenced by the substituted content: wire
  // the /ExtGState dicts substitutePdfRgb named into page-0 /Resources, mirroring the
  // /Separation ColorSpace wiring above. OPM 1 lives inside each overprint dict.
  // PDF/X-4 permits overprint and OP/op/OPM, so applyPdfX below needs no change; the
  // pdf-lib mark drawing wraps every op in q/Q, so registration/bars keep the default
  // (knockout) state and never inherit content-stream overprint.
  if (usedGs.size) {
    const page = pdfDoc.getPage(0);
    const resources = page.node.Resources() || pdfDoc.context.obj({});
    page.node.set(PDFName.of('Resources'), resources);
    const gsDict = resources.lookupMaybe(PDFName.of('ExtGState'), PDFDict) || pdfDoc.context.obj({});
    resources.set(PDFName.of('ExtGState'), gsDict);
    for (const name of usedGs) {
      if (gsDict.get(PDFName.of(name))) continue;   // already wired
      const def = OVERPRINT_GS_DEFS[name];
      if (!def) continue;
      gsDict.set(PDFName.of(name), pdfDoc.context.register(pdfDoc.context.obj({ Type: 'ExtGState', ...def })));
    }
  }

  // Print finishing in DeviceCMYK, drawn after the colour swap so registration
  // marks land on every plate (1 1 1 1) and aren't re-mapped by the RGB→CMYK pass.
  // The verification bar shows pairs for only the brand inks that actually
  // substituted in this artwork - rebuild the marks geometry from that used set
  // now that the substitution pass has run (page size is palette-independent).
  if (geo) {
    const page = pdfDoc.getPage(0);
    setPageBoxes(page, geo);
    const usedPalette = (opts.palette ?? []).filter(p => usedKeys.has(paletteHitKey(p) as string));
    const marksGeo = printGeometry(node, opts, usedPalette) ?? geo;
    await drawPrintMarks(page, marksGeo, { space: 'cmyk', labels: provenanceLabels(opts.meta) });
  }

  // PDF/X-4 finishing runs AFTER the colour substitution so the claim gate sees
  // the final image set. The press-condition intent declares what the DeviceCMYK
  // values mean to a RIP; 'none' (user opted out of a condition) writes the
  // metadata without an intent or conformance claim, and anything non-CMYK
  // ('srgb'/absent) falls back to the default condition - mirroring the old
  // addCmykOutputIntent guard. 'own' is the embed route: the DestOutputProfile
  // bytes come from a profile on THIS device, and the intent's identity is read
  // off that profile rather than off the picker (press-profile-embed.ts).
  const intentKind = opts.colorProfile === 'none' ? null
    : isOwnProfile(opts.colorProfile) ? 'own'
    : (opts.colorProfile && opts.colorProfile !== 'srgb' ? opts.colorProfile : 'fogra39');
  await applyPdfX(pdfDoc, opts, intentKind, {
    embed: await embeddedProfile(opts.colorProfile),
    log: pdfxLog,
  });

  // The C2PA embedder only parses a classic xref table - same flag finishPdfX
  // threads for the RGB path when a credential is requested.
  const out = await pdfDoc.save(opts.c2pa ? { useObjectStreams: false } : undefined);
  const cmykBlob = new Blob([out], { type: 'application/pdf' });
  // Strong tier: AES-256 encrypt-last, AFTER the CMYK substitution + marks +
  // output-intent are baked in (pdf-lib can't reopen an encrypted doc, so this
  // must be the final step). The PDF/X-4 conformance claim was already dropped in
  // applyPdfX above. Print PDFs had no password support before this.
  return opts.strongPassword ? encryptPdfStrong(cmykBlob, opts.strongPassword) : cmykBlob;
}





// The computed fill/stroke of a live-DOM SVG element - resolves SVG inheritance
// (an ancestor group's paint) and currentColor. Empty for a detached element, so
// callers keep their own literal fallback.
function computedPaint(el: Element, prop: string): string {
  try {
    // getPropertyValue takes the CSS property NAME, so hyphenated props ('stroke-width')
    // are read here exactly like single-word ones ('fill'/'stroke') - no `as any` index,
    // and none of the camelCase IDL spelling this would need via the property accessor.
    return (typeof window !== 'undefined' && el.isConnected) ? (window.getComputedStyle(el).getPropertyValue(prop) || '') : '';
  } catch { return ''; }
}



/**
 * Resolve an element's stroke paint the way the browser does - the counterpart to
 * resolveColor() below, which has always done this for fill.
 *
 * A presentation attribute and an inline style are only two of the three ways a stroke
 * arrives. Illustrator/Figma SVGs - which is every SUSE catalog illustration - carry
 * theirs in a CSS CLASS instead: `.cls-7{stroke:#003e37;stroke-width:4px}`, with no
 * stroke attribute on any node. Neither of the first two reads can see that, so without
 * the computed fallback every such stroke resolved to 'none' and the artwork exported to
 * PDF as flat fills with EVERY outline missing - while fill came through, because
 * resolveColor already fell back to getComputedStyle. That asymmetry was the bug.
 *
 * Returns 'none' (the SVG initial value for stroke) when nothing paints, where the fill
 * side defaults to black. Detached nodes yield '' from computedPaint → 'none'.
 */
export function strokeOf(el: Element): string {
  const s = el.getAttribute('stroke') ?? resolveStyleProp(el, 'stroke') ?? '';
  return (!s || s === 'currentColor') ? (computedPaint(el, 'stroke') || 'none') : s;
}

/**
 * Stroke width under the same three-way resolution, in SVG user units. A class-declared
 * `stroke-width:4px` is invisible to getAttribute, so this otherwise fell back to 1 and
 * hairlined artwork whose real width was 4. Non-finite/negative input → 1 (the SVG initial
 * value); getComputedStyle reports a resolved px length ("4px"), which parseFloat takes.
 */
export function strokeWidthOf(el: Element): number {
  const raw = el.getAttribute('stroke-width') ?? resolveStyleProp(el, 'stroke-width') ??
              computedPaint(el, 'stroke-width');
  const v = parseFloat(raw || '');
  return Number.isFinite(v) && v >= 0 ? v : 1;
}

/**
 * Carry an SVG shape's stroke DECORATION - dash array, cap, join, miter limit - into the
 * PDF graphics state, and hand back the undo. Without this the PDF walker reproduced only a
 * stroke's colour and width, so a dashed or flat-capped outline exported as a plain round
 * solid one: a control whose effect vanished on export, which is worse than not offering it.
 *
 * jsPDF's line state is STICKY (it writes the operator once and every later stroke inherits
 * it), which is why the caller must run the returned restore - the same discipline the
 * border path already follows. Every setter is feature-checked because older jsPDF builds
 * ship only some of them.
 *
 * Lengths are multiplied by `mul`, the same user-unit → pt factor applied to stroke-width,
 * so a dash keeps its proportion to the line. `stroke-dasharray` is read as numbers only:
 * a non-finite or negative entry, or an all-zero pattern (which PDF rejects), drops the
 * dash rather than emitting an invalid pattern.
 */
export function applySvgStrokeDecoration(pdf: any, el: Element, mul: number): (() => void) | null {
  const undo: Array<() => void> = [];
  const raw = el.getAttribute('stroke-dasharray') ?? resolveStyleProp(el, 'stroke-dasharray') ?? '';
  if (raw && raw !== 'none' && typeof pdf.setLineDashPattern === 'function') {
    const nums = raw.trim().split(/[\s,]+/).map((s) => parseFloat(s) * mul);
    if (nums.length && nums.every((n) => Number.isFinite(n) && n >= 0) && nums.some((n) => n > 0)) {
      pdf.setLineDashPattern(nums, 0);
      undo.push(() => pdf.setLineDashPattern([], 0));
    }
  }
  const cap = el.getAttribute('stroke-linecap') ?? resolveStyleProp(el, 'stroke-linecap') ?? '';
  if ((cap === 'round' || cap === 'square') && typeof pdf.setLineCap === 'function') {
    // jsPDF's CapJoinStyles understands the SVG keywords verbatim ('square' → projecting),
    // and THROWS on anything it does not, which is why only the two are let through.
    pdf.setLineCap(cap);
    undo.push(() => pdf.setLineCap('butt'));
  }
  const join = el.getAttribute('stroke-linejoin') ?? resolveStyleProp(el, 'stroke-linejoin') ?? '';
  if ((join === 'round' || join === 'bevel') && typeof pdf.setLineJoin === 'function') {
    pdf.setLineJoin(join);
    undo.push(() => pdf.setLineJoin('miter'));
  }
  // A miter join is PDF's default, but its default LIMIT is 10 against SVG's 4 - so a
  // shape that says 4 has to say it here too, or a spike PDF keeps is one the browser and
  // the SVG export both bevelled away.
  const ml = parseFloat(el.getAttribute('stroke-miterlimit') ?? resolveStyleProp(el, 'stroke-miterlimit') ?? '');
  if (Number.isFinite(ml) && ml >= 1 && typeof pdf.setLineMiterLimit === 'function') {
    pdf.setLineMiterLimit(ml);
    undo.push(() => pdf.setLineMiterLimit(10));
  }
  return undo.length ? () => { for (const fn of undo) fn(); } : null;
}

function resolveColor(el: any): Rgb | null {
  const attr = el.getAttribute('fill');
  if (attr && attr !== 'currentColor') return parseSvgColor(attr);
  const styleAttr = el.getAttribute('style') ?? '';
  const styleMatch = styleAttr.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/);
  if (styleMatch) return parseSvgColor(styleMatch[1].trim());
  const computed = typeof window !== 'undefined' ? window.getComputedStyle(el).fill : null;
  return computed ? parseSvgColor(computed) : null;
}


// Ensures a canvas is exactly w×h logical pixels. dom-to-image-more may return
// a physical-pixel canvas (canvas.width = w * devicePixelRatio) on HiDPI screens,
// which causes toBlob and getImageData to encode/read only a zoomed-in crop.
// Drawing through an intermediate canvas normalises to the requested dimensions.
function normalizeCanvas(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  if (src.width === w && src.height === h) return src;
  const out = document.createElement('canvas');
  out.width  = w;
  out.height = h;
  out.getContext('2d')!.drawImage(src, 0, 0, w, h);
  return out;
}

// Replaces blob: URLs in-place on the live node and returns a function that
// restores the originals. Used for raster exports so dom-to-image-more receives
// the fully styled live node rather than a detached clone.
async function swapBlobUrls(node: Element): Promise<() => void> {
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
  return () => swaps.forEach(({ el, attr, url }) => el.setAttribute(attr, url));
}

// Snapshot every <video> under `node` to a still <img> of its CURRENT frame, in
// place, returning a closure that restores the originals. dom-to-image-more
// serialises the DOM into an SVG <foreignObject>, which does NOT carry decoded video
// pixels - so without this a video box exports BLANK. We use an <img> (PNG data URL)
// rather than a <canvas> deliberately: an <img> is handled by EVERY export path - 
// the raster serialiser inlines it, and the true-vector walkers (svg/pdf/emf/eps)
// already know how to place an <img> but NOT a <canvas> - so a video-still now
// behaves exactly like an ordinary still image everywhere. Runs on the LIVE node
// (computed styles + geometry intact); the <img> copies the video's class + inline
// style + key computed replaced-element props so the existing object-fit /
// border-radius handling frames it identically. Per-element try/catch: a not-yet-
// decoded frame (readyState < 2) or a cross-origin (canvas-tainting) video is skipped,
// never thrown - a still-blank video is no worse than today. Synchronous + jsdom-safe
// (videoWidth is 0 there → a clean no-op). gif/apng/animated-webp inside an <img>
// already export as a still, so only <video> needs this.
function snapshotMotion(node: Element): () => void {
  if (!node.querySelectorAll) return () => {};
  const swaps: { video: HTMLElement; still: HTMLElement; prevDisplay: string }[] = [];
  for (const el of [...node.querySelectorAll('video')]) {
    const video = el as HTMLVideoElement;
    try {
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h || video.readyState < 2) continue;   // no decoded frame yet
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(video, 0, 0, w, h);                 // SecurityError if the video is cross-origin tainted
      const still = document.createElement('img');
      still.src = canvas.toDataURL('image/png');        // also throws SecurityError if tainted - caught below
      // Marked so a renderer that decodes the video ITSELF can hide the freeze
      // instead of baking it in. The sequence compositor needs exactly that on the
      // ZIP path, where the guard above keys on the outer 'zip' format and the
      // frozen still therefore already exists by the time mp4/webm re-dispatches.
      still.setAttribute('data-motion-still', '1');
      // Reproduce the on-screen framing: the class + inline style carry sizing
      // (e.g. .lolly-box-img width/height + object-fit), and the computed
      // replaced-element props cover a tool that set them elsewhere.
      still.className = video.className;
      const styleAttr = video.getAttribute('style');
      if (styleAttr) still.setAttribute('style', styleAttr);
      const cs = getComputedStyle(video);
      still.style.objectFit = cs.objectFit;
      still.style.objectPosition = cs.objectPosition;
      still.style.borderRadius = cs.borderRadius;
      video.parentNode?.insertBefore(still, video);
      const prevDisplay = video.style.display;
      video.style.display = 'none';                     // keep only the still in the serialised tree
      swaps.push({ video, still, prevDisplay });
    } catch { /* tainted or undecodable - leave the video as-is rather than throw */ }
  }
  return () => {
    for (const { video, still, prevDisplay } of swaps) {
      still.remove();
      video.style.display = prevDisplay;
    }
  };
}

// Replaces blob: URLs in-place on a detached clone. Used by renderSvg which
// owns its clone and just needs self-contained data URLs in the saved file.
export async function inlineBlobUrlsInEl(el: Element): Promise<void> {
  const candidates = el.querySelectorAll('image, img');
  await Promise.all([...candidates].map(async img => {
    for (const attr of ['href', 'src']) {
      const url = img.getAttribute(attr);
      if (url?.startsWith('blob:')) {
        try {
          img.setAttribute(attr, await blobToDataUrl(url));
        } catch { /* leave as-is; export will degrade gracefully */ }
      }
    }
  }));
}

async function blobToDataUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Natural pixel dimensions of an image href (for cover/contain fitting). Null on failure.
async function imageDims(src: string): Promise<{ w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(await (await fetch(src)).blob());
    const d = { w: bmp.width, h: bmp.height };
    bmp.close?.();
    return d;
  } catch { return null; }
}

// Pick the jsPDF.addImage format from a data: URL's REAL MIME (the previous
// `.includes('image/png')` guess silently misclassified WebP/AVIF/GIF user images
// as PNG, so jsPDF dropped them). PNG/JPEG/WebP are passed through as the formats
// jsPDF accepts; anything else jsPDF can't embed (AVIF/GIF/BMP…) is rasterised to
// PNG via a canvas first. Non-data / unrecognised sources keep the old PNG fallback.
async function imageForPdf(src: string): Promise<{ src: string; fmt: string }> {
  const mime = (/^data:([^;,]+)/i.exec(src)?.[1] || '').toLowerCase();
  if (mime === 'image/png')  return { src, fmt: 'PNG' };
  if (mime === 'image/jpeg' || mime === 'image/jpg') return { src, fmt: 'JPEG' };
  if (mime === 'image/webp') return { src, fmt: 'WEBP' };
  if (mime.startsWith('image/')) {
    try { return { src: await rasterizeToPng(src), fmt: 'PNG' }; }
    catch { return { src, fmt: 'PNG' }; }
  }
  return { src, fmt: 'PNG' };
}

// Decode any image source the browser understands and re-encode it as a PNG data
// URL, so a format jsPDF can't embed natively can still be placed.
async function rasterizeToPng(src: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width  = img.naturalWidth  || img.width;
  canvas.height = img.naturalHeight || img.height;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

// Best recorder mime, preferring the requested container ('webm' | 'mp4') but
// falling back to the other so a deep-link/CLI request still produces a video.
// With { audio: true } only audio-capable mimetypes are considered - returns
// null when none is supported, so the caller can fall back to a silent
// recording rather than a NotSupportedError mid-record.
// Returns null when no container is recordable.
export function videoMimeType(preferred?: string, { audio = false }: { audio?: boolean } = {}): string | null {
  if (!canRecord()) return null;
  return videoMimeCandidates(preferred as string, { audio }).find(t => MediaRecorder.isTypeSupported?.(t)) ?? null;
}

interface LoopedAudio { track: MediaStreamTrack; start(): void; stop(): void; }

// Decodes an audio file (a catalog music bed - opts.audio.url, typically a
// blob: URL the view resolved via host.assets.get) into a loopable Web Audio
// source whose MediaStream track can be muxed into the recorded stream.
// loop=true makes the bed cover any clip length: recording stop truncates a
// longer track, shorter tracks repeat with no seam. start() is deferred so the
// caller can align audio time-zero with recorder.start() - Phase 1 frame
// capture is slower than real time and must not consume the track.
/**
 * A gain envelope for a music bed, in seconds, timed against clipSec.
 *   volume - overall bed level (0..1, default 1)
 *   fadeIn/fadeOut - linear ramps from/to silence at the ends
 *   duck - a window over which the bed dips to volume·duck.level, then restores,
 *          so foreground audio (an uploaded clip's own sound) stays intelligible.
 *   start - in-point into the SOURCE (not the clip): playback begins there, and a
 *          looping bed repeats from there. Independent of the envelope, which is
 *          always timed from t0 against clipSec.
 */
interface AudioFade {
  fadeIn?: number;
  fadeOut?: number;
  clipSec?: number;
  volume?: number;
  duck?: { level: number; startSec: number; endSec: number };
  start?: number;
  /** Loop the source to cover the clip (default true). A tool's own narration
   *  mixed over a bed plays ONCE - its end is what brings the bed back up. */
  loop?: boolean;
}

/**
 * Clamp a requested bed in-point into a decoded source. A start at or past the end
 * of the track can't be honoured: with loop off it records pure silence, with loop on
 * the spec snaps playback back to loopStart - either way the user gets an unexplained
 * result, so it degrades to 0:00 with a warning.
 */
export function bedStartOffset(start: number | undefined, duration: number): number {
  if (typeof start !== 'number' || !Number.isFinite(start) || start <= 0) return 0;
  if (!(duration > 0) || start >= duration) {
    _host?.log?.('warn', `Audio starts at ${start}s but the track is only ${duration.toFixed(2)}s long; playing it from 0:00.`);
    return 0;
  }
  return start;
}

// Connect a looping music buffer into `dest` within `ctx`, through a GainNode that
// applies an optional volume/fade/duck envelope. start() schedules the ramps at
// ctx.currentTime (so it must be called when playback actually begins); stop() halts
// the source. Shared by createLoopedAudio (the renderVideo music bed) and the
// top-&-tail compositor, which mixes it with the footage's own audio in one context.
export function connectMusic(
  ctx: BaseAudioContext,   // AudioContext (live path) OR OfflineAudioContext (WebCodecs bed render)
  buffer: AudioBuffer,
  dest: AudioNode,
  fade: AudioFade = {},
): { start(): void; stop(): void } {
  const src  = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop   = fade.loop !== false;
  // In-point: start playback `offset` into the source, and move the loop window with
  // it - loopStart defaults to 0, so a wrap would otherwise throw the in-point away
  // and play the head of the track the visuals deliberately skipped. loopEnd must be
  // set explicitly too; it only means "end of buffer" while untouched.
  const offset = bedStartOffset(fade.start, buffer.duration);
  if (offset > 0) { src.loopStart = offset; src.loopEnd = buffer.duration; }
  const gain = ctx.createGain();
  src.connect(gain).connect(dest);
  let started = false;
  return {
    start() {
      if (started) return;
      started = true;
      const t0 = ctx.currentTime;
      const g = gain.gain;
      const vol     = Math.max(0, Math.min(1, fade.volume ?? 1));
      const fadeIn  = Math.max(0, fade.fadeIn  ?? 0);
      const fadeOut = Math.max(0, fade.fadeOut ?? 0);
      const clip    = fade.clipSec ?? 0;
      // Fade in to full volume.
      if (fadeIn > 0) { g.setValueAtTime(0, t0); g.linearRampToValueAtTime(vol, t0 + fadeIn); }
      else g.setValueAtTime(vol, t0);
      // Duck under foreground audio: dip to vol·level across the body window, restore
      // for the outro. Guarded so it never schedules out-of-order automation events.
      const d = fade.duck;
      if (d && d.level < 1 && d.endSec - d.startSec > 0.6) {
        const RAMP = 0.25;
        const downStart = t0 + Math.max(fadeIn, d.startSec);
        const downEnd   = downStart + RAMP;
        const upStart   = t0 + d.endSec - RAMP;
        const upEnd     = t0 + d.endSec;
        if (upStart > downEnd) {
          g.setValueAtTime(vol, downStart);
          g.linearRampToValueAtTime(vol * d.level, downEnd);
          g.setValueAtTime(vol * d.level, upStart);
          g.linearRampToValueAtTime(vol, upEnd);
        }
      }
      // Fade out to silence at the end.
      if (fadeOut > 0 && clip > fadeIn) {
        const fs = Math.max(t0 + fadeIn, t0 + clip - fadeOut);
        g.setValueAtTime(vol, fs);
        g.linearRampToValueAtTime(0, t0 + clip);
      }
      src.start(0, offset);
    },
    stop() { try { src.stop(); } catch { /* never started */ } },
  };
}

/**
 * The extent of the primary track in CLIP time: it starts with the picture at 0
 * and ends at its natural length (minus the in-point), capped by the clip. This
 * is the window the mix-in bed ducks under - full bed before/after it (top and
 * tail), the centre level through it.
 */
function primarySpan(buffer: AudioBuffer, fade: AudioFade): { from: number; to: number } {
  const offset = bedStartOffset(fade.start, buffer.duration);
  const natural = Math.max(0, buffer.duration - offset);
  const clip = fade.clipSec ?? 0;
  return { from: 0, to: clip > 0 ? Math.min(clip, natural) : natural };
}

/**
 * Connect the mix-in bed (opts.audio.mix) into the graph: a looping source whose
 * gain envelope plays FULL where the primary is silent and glides to the centre
 * level under it (~0.8 s ramps, never steps - bedDuckEnvelope owns the math).
 * start() schedules at ctx.currentTime, same contract as connectMusic.
 */
function connectDuckedBed(
  ctx: BaseAudioContext, buffer: AudioBuffer, dest: AudioNode,
  mix: ExportAudioMixIn, clipSec: number, primary: { from: number; to: number },
): { start(): void; stop(): void } {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const gain = ctx.createGain();
  src.connect(gain).connect(dest);
  let started = false;
  return {
    start() {
      if (started) return;
      started = true;
      const events = bedDuckEnvelope({
        clipSec, volume: mix.volume, centre: mix.centre,
        fadeIn: mix.fadeIn, fadeOut: mix.fadeOut,
        spans: primary.to > primary.from ? [primary] : [],
      });
      scheduleGainEvents(gain.gain, events, ctx.currentTime);
      src.start(0);
    },
    stop() { try { src.stop(); } catch { /* never started */ } },
  };
}

async function createLoopedAudio(url: string, fade: AudioFade = {}, mix?: ExportAudioMixIn): Promise<LoopedAudio> {
  const AC = globalThis.AudioContext ?? (globalThis as any).webkitAudioContext;
  if (!AC) throw new Error('Web Audio is not supported in this browser');
  const bytes = await (await fetch(url)).arrayBuffer();
  const ctx = new AC();
  let buffer: AudioBuffer;
  try {
    buffer = await ctx.decodeAudioData(bytes);
  } catch (err) {
    ctx.close().catch(() => {});
    throw err instanceof Error ? err : new Error('audio decode failed');
  }
  // The mix-in bed is best-effort: a bed that won't decode degrades to the
  // primary track alone with a warning, never a silent or failed export.
  let bedBuffer: AudioBuffer | null = null;
  if (mix?.url) {
    try {
      bedBuffer = await ctx.decodeAudioData(await (await fetch(mix.url)).arrayBuffer());
    } catch (err) {
      _host?.log?.('warn', `Mix-in track unavailable (${(err as any)?.message ?? err}); exporting without it.`);
    }
  }
  const dest  = ctx.createMediaStreamDestination();
  // With a bed underneath, the primary (a tool's own narration) plays once - 
  // looping it would hold the bed at the centre level forever and the full-gain
  // tail would never come.
  const music = connectMusic(ctx, buffer, dest, bedBuffer ? { ...fade, loop: false } : fade);
  const bed = bedBuffer && mix
    ? connectDuckedBed(ctx, bedBuffer, dest, mix, fade.clipSec ?? 0, primarySpan(buffer, fade))
    : null;
  return {
    track: dest.stream.getAudioTracks()[0]!,
    start() {
      // The context was created inside the export click's gesture, but resume
      // defensively - a suspended context feeds silence into the recording.
      ctx.resume?.().catch(() => {});
      music.start();
      bed?.start();
    },
    stop() {
      music.stop();
      bed?.stop();
      ctx.close().catch(() => {});
    },
  };
}

// Render the music-bed timeline (the SAME connectMusic fade/loop envelope used by
// the live MediaRecorder path) to a finished PCM AudioBuffer, entirely offline and
// faster than real time - this feeds the WebCodecs AudioEncoder so audio exports
// can take the fast path too. Returns null when OfflineAudioContext is unavailable
// or the clip is empty; throws on decode failure so renderVideo can fall back to the
// live MediaRecorder mux (which decoded the bed successfully earlier).
async function renderMusicBed(url: string, clipSec: number, sampleRate: number, fade: AudioFade, mix?: ExportAudioMixIn): Promise<AudioBuffer | null> {
  const OAC = globalThis.OfflineAudioContext ?? (globalThis as any).webkitOfflineAudioContext;
  if (!OAC || !(clipSec > 0)) return null;
  const CHANNELS = 2;                                   // deterministic stereo out
  const octx: OfflineAudioContext = new OAC(CHANNELS, Math.max(1, Math.ceil(clipSec * sampleRate)), sampleRate);
  const bytes = await (await fetch(url)).arrayBuffer(); // blob: URL from host.assets.get - no network
  let buffer: AudioBuffer;
  try {
    buffer = await octx.decodeAudioData(bytes);         // resamples the bed to `sampleRate`
  } catch (err) {
    throw err instanceof Error ? err : new Error('audio decode failed');
  }
  // The mix-in bed rides the same offline render - best-effort, like the live path.
  let bedBuffer: AudioBuffer | null = null;
  if (mix?.url) {
    try {
      bedBuffer = await octx.decodeAudioData(await (await fetch(mix.url)).arrayBuffer());
    } catch (err) {
      _host?.log?.('warn', `Mix-in track unavailable (${(err as any)?.message ?? err}); exporting without it.`);
    }
  }
  // schedules the envelope(s) at t=0; the primary plays once when a bed ducks under it
  connectMusic(octx, buffer, octx.destination, bedBuffer ? { ...fade, loop: false } : fade).start();
  if (bedBuffer && mix) connectDuckedBed(octx, bedBuffer, octx.destination, mix, clipSec, primarySpan(buffer, fade)).start();
  return await octx.startRendering();                   // AudioBuffer, exactly clip-length, 2ch
}

// Resolve opts.audio into a started-on-demand looped track, or null when audio
// wasn't requested / can't be delivered (decode failure, no audio-capable
// recorder mime) - in which case the export degrades to a silent video with a
// warning through the log channel rather than failing a multi-second capture.
async function prepareExportAudio(opts: ExportOpts, preferred: string, clipSec?: number, deferSilentWarn = false): Promise<{ audio: LoopedAudio | null; mimeType: string | null }> {
  if (!opts.audio?.url) return { audio: null, mimeType: videoMimeType(preferred) };
  let audio: LoopedAudio | null = null;
  try {
    audio = await createLoopedAudio(opts.audio.url, { fadeIn: opts.audio.fadeIn, fadeOut: opts.audio.fadeOut, clipSec, volume: opts.audio.volume, start: opts.audio.start }, opts.audio.mix);
  } catch (err) {
    _host?.log?.('warn', `Audio track unavailable (${(err as any)?.message ?? err}); exporting silent video.`);
  }
  if (audio) {
    const mimeType = videoMimeType(preferred, { audio: true });
    if (mimeType) return { audio, mimeType };
    audio.stop();
    audio = null;
    // renderVideo passes deferSilentWarn when the WebCodecs AudioEncoder may still
    // deliver the bed - warning "silent" here would be wrong when it does; that
    // caller warns itself once the WebCodecs audio pick has actually come up empty.
    if (!deferSilentWarn) _host?.log?.('warn', 'This browser cannot record an audio track into the chosen container; exporting silent video.');
  }
  return { audio: null, mimeType: videoMimeType(preferred) };
}

// Container MIME for the output Blob, derived from the chosen recorder mime.
function videoContainer(mime: string | null): string {
  return mime && mime.includes('mp4') ? 'video/mp4' : 'video/webm';
}

// Stamp the provenance record (opts.meta - same content as the GIF comment and
// PNG iTXt) into a finished recording: MP4 udta/ilst or Matroska Tags, via the
// engine's byte-writers. MediaRecorder can't write metadata during capture, so
// this post-processes the blob. Failure is non-fatal - a playable file without
// provenance beats a corrupted one with it.
async function withVideoMeta(blob: Blob, container: string, meta: ExportMeta | null | undefined): Promise<Blob> {
  if (!meta) return blob;
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const tags = videoProvenanceTags(meta, new Date());
    const out = container === 'video/mp4' ? embedMp4Meta(bytes, tags) : embedWebmMeta(bytes, tags);
    if (out === bytes) _host?.log?.('warn', 'Provenance metadata not embedded (unrecognised container structure).');
    return new Blob([out as BlobPart], { type: container });
  } catch (err) {
    _host?.log?.('warn', `Provenance metadata not embedded (${(err as any)?.message ?? err}).`);
    return blob;
  }
}

const NO_VIDEO_MSG = 'Video recording is not supported in this browser. Use GIF instead, or try Chrome or Firefox for WebM.';

// WP-F soft subtitles. A soft (player-toggleable) webvtt track can ONLY ride the
// WebCodecs mux path (mediabunny writes the container, so it can declare the extra
// track). MediaRecorder writes the container itself and cannot add one, so the
// record/live/top-tail tools AND the WebCodecs→MediaRecorder fallback drop the
// caption track - never silently: this warning fires wherever that happens.
const SOFT_SUBTITLES_DROPPED_MSG = 'Soft caption track not embedded: this export used the MediaRecorder path, which cannot carry a subtitle track. Captions burned into the frames are unaffected.';
/** Can this browser embed a SOFT subtitle track into a video export? Only the WebCodecs
 *  mux path can; the MediaRecorder paths cannot. renderVideo is already the non-live,
 *  non-record offline path, so here this reduces to "WebCodecs is available". */
function canCarrySoftSubtitles(): boolean {
  return typeof VideoEncoder !== 'undefined';
}

// A FrameSource turns a live DOM node into a sequence of rendered frames that
// share ONE capture timeline. Motion encoders (webm/mp4 via renderVideo, gif via
// renderGif - and future apng / image-sequence / spritesheet / favicon) consume it
// instead of each re-implementing the capture loop.
//
// Capture semantics match the original per-encoder loops: blob: URLs are swapped
// to data URLs once up front (so dom-to-image can inline them), CSS animations get
// `opts.wait` seconds to settle before the first frame, then each frame() renders
// the CURRENT animation state via dom-to-image toCanvas(). Sequential frame() calls
// advance the animation in real time (the await between them is the spacing), so
// every frame is a distinct moment - no duplicate or skipped frames.
//
//   width / height - target pixel size (defaults to the node's box)
//   frame() - Promise<HTMLCanvasElement> for the current moment
//   dispose() - restore the blob:-URL swap; call once capture is done
// ── Deterministic export-frame clock (opt-in) ────────────────────────────────
// A canvas-animation tool can register `window.__lollyFrameRender(t)` to render a
// deterministic frame at normalized loop time t∈[0,1). The snapshot export paths
// drive it: they raise `window.__lollyFrameDriven` (so the tool's own rAF loop
// bails - dom-to-image's toCanvas is async, and a stray repaint would otherwise
// clobber the frame), paint the exact phase, then capture. Presence-keyed, so a
// tool that never registers the hook is byte-for-byte unchanged. Scoped to these
// snapshot paths ONLY - never the real-time captureStream path (which returns
// before createFrameSource), so the two mechanisms can't both fire per export.
// Per-NODE channel (not a window global): the hook lives ON the tool's canvas, so
// it can't leak across SPA tool navigation - a detached canvas from a previous tool
// is never inside the node being exported, so an unrelated tool never enters this path.
// The second argument is the exported clip's real length in seconds. It is ADDITIVE:
// a tool that declares `(t)` ignores it and behaves exactly as before. A tool that
// maps t onto its own timeline (the audiogram's caption cues) must prefer it over
// any span of its own, because the export's length is decided here - after a frame
// plan the tool never sees - and a tool-side guess is what let captions drift.
type FrameClockCanvas = HTMLCanvasElement & { __lollyFrameRender?: (t: number, clipSec?: number) => void; __lollyFrameDriven?: boolean };
function frameClockCanvas(node: Element): FrameClockCanvas | null {
  const self = node as FrameClockCanvas;
  if (typeof self.__lollyFrameRender === 'function') return self;
  for (const c of Array.from(node.querySelectorAll?.('canvas') ?? [])) {
    if (typeof (c as FrameClockCanvas).__lollyFrameRender === 'function') return c as FrameClockCanvas;
  }
  return null;
}
function beginFrameClock(node: Element): FrameClockCanvas | null {
  const c = frameClockCanvas(node);
  if (c) c.__lollyFrameDriven = true;   // freeze the tool's own rAF for the capture
  return c;
}
function renderFrameAt(c: FrameClockCanvas | null, t: number, clipSec?: number): void {
  if (!c || typeof c.__lollyFrameRender !== 'function') return;
  try { c.__lollyFrameRender(t, clipSec); } catch (e) { _host?.log?.('warn', `__lollyFrameRender threw: ${(e as Error)?.message ?? e}`); }
}
function endFrameClock(c: FrameClockCanvas | null): void {
  if (c) c.__lollyFrameDriven = false;
}

// ── CSS animation/transition scrubbing (no tool opt-in required) ────────────
// A plain template that animates via CSS `animation`/`transition` (no canvas,
// no __lollyFrameRender) previously had its frames paced by whatever real time
// elapsed between toCanvas() calls - capture jitter (DOM serialize + image
// decode isn't constant-time) meant the exported motion could subtly drift
// from the authored timing. getAnimations() exposes every CSSAnimation/
// CSSTransition affecting the node, so each can be paused and scrubbed to the
// exact elapsed ms for the frame being captured - the same exact-phase
// guarantee __lollyFrameRender gives canvas tools, without requiring one.
// No-op (returns false) for tools with no CSS animations, and for JS/rAF-driven
// motion that never produces a Web Animations API Animation object - those
// still need the explicit clock hook.
function scrubAnimations(node: Element, ms: number, pausedByUs?: Set<Animation>): boolean {
  const anims = node.getAnimations?.({ subtree: true }) ?? [];
  if (anims.length === 0) return false;
  for (const a of anims) {
    // Record only the animations THIS scrub paused, so dispose can resume
    // exactly those - never one the page had paused before the export began.
    if (a.playState !== 'paused') { a.pause(); pausedByUs?.add(a); }
    a.currentTime = ms;
  }
  return true;
}

// ── Node-driven capture override (opt-in, Tier-B video prototype) ───────────
// A Node/Playwright caller (packages/node-shell/src/webshell-render.ts,
// renderVideoViaScreenshot) can expose window.__lollyCaptureScreenshot before
// navigating here. When present, frame() calls it instead of dom-to-image: Node
// takes a REAL Chromium screenshot of the live node, clipped to its own box - 
// genuine paint, no clone/serialize/reinterpret step - and hands the PNG bytes
// back as base64, which are then scaled to the export's target pixel size on a
// canvas exactly like dom-to-image's own output. Everything else (the
// deterministic clock, scrubAnimations, the WebCodecs encode, C2PA/watermark
// stamping) is the exact same pipeline.
//
// Deliberately does NOT force the live node to the target width/height/scale
// the way dtoOpts styles a dom-to-image CLONE - an earlier version did, and it
// leaked layout: forcing #tool-canvas's box away from its real flex-driven size
// let neighbouring chrome (the sidebar) bleed into the shot. A screenshot is
// captured at the node's own on-screen size and upscaled if needed; call
// page.setViewportSize/deviceScaleFactor Node-side for a sharper native size
// instead of fighting the live layout from here.
declare global { interface Window { __lollyCaptureScreenshot?: () => Promise<string | null> } }

async function captureViaExternalScreenshot(
  targetW: number, targetH: number, capture: () => Promise<string | null>,
): Promise<HTMLCanvasElement> {
  const b64 = await capture();
  if (!b64) throw new Error('external screenshot capture returned nothing');
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('external screenshot frame failed to decode'));
    img.src = `data:image/png;base64,${b64}`;
  });
  const canvas = document.createElement('canvas');
  canvas.width = targetW; canvas.height = targetH;
  canvas.getContext('2d')!.drawImage(img, 0, 0, targetW, targetH);
  return canvas;
}

// ── Static-chrome fast path (see ./frame-static.ts for the decision rules) ───
// Every <canvas> that actually paints pixels. A tool's clock anchor is NOT one:
// slides/deck-builder (`.sl-clock`) and all six filter-* tools (`[data-ov-clock]`)
// carry `__lollyFrameRender` on a 0×0 aria-hidden canvas that draws nothing, and
// audiogram's `style=milkdrop` leaves the fallback `#ag-wave` in the DOM at
// display:none next to the mounted viz canvas - so both the backing-store size
// and the computed visibility have to be checked, not just presence.
function visibleCanvases(node: Element): HTMLCanvasElement[] {
  const all: HTMLCanvasElement[] = [];
  if (node instanceof HTMLCanvasElement) all.push(node);
  for (const c of Array.from(node.querySelectorAll?.('canvas') ?? [])) all.push(c as HTMLCanvasElement);
  return all.filter(c => {
    if (!(c.width > 0 && c.height > 0)) return false;   // inert clock anchor - drawImage would throw on it anyway
    const s = window.getComputedStyle(c);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = c.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  });
}

// Everything under the node that is neither a live canvas nor an ancestor of one,
// tagged with whether it contributes pixels at all. url-shot's `.shot-refresh` /
// `.shot-compose` buttons sit right over the canvas at opacity:0 until hover, so
// treating "has a box" as "paints" would reject the best-case tool.
function chromeElements(node: Element, live: HTMLCanvasElement[]): { liveBoxes: Box[]; chrome: ChromeEl[] } {
  const related = new Set<Element>();
  for (const c of live) for (let e: Element | null = c; e; e = e.parentElement) { related.add(e); if (e === node) break; }
  const liveBoxes = live.map(c => c.getBoundingClientRect() as Box);
  const chrome: ChromeEl[] = [];
  for (const el of Array.from(node.querySelectorAll('*'))) {
    if (related.has(el)) { chrome.push({ box: el.getBoundingClientRect(), paints: false, relatedToLive: true }); continue; }
    const s = window.getComputedStyle(el);
    const paints = s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0;
    chrome.push({ box: el.getBoundingClientRect(), paints, relatedToLive: false });
  }
  return { liveBoxes, chrome };
}

// visibility:hidden, not display:none - layout must be preserved so the chrome
// rasterises at exactly the geometry the live canvases will be blitted into.
// !important because it has to beat the tool's own stylesheet.
function hideLiveCanvases(live: HTMLCanvasElement[]): () => void {
  const prev = live.map(c => ({ c, v: c.style.getPropertyValue('visibility'), p: c.style.getPropertyPriority('visibility') }));
  for (const c of live) c.style.setProperty('visibility', 'hidden', 'important');
  return () => {
    for (const { c, v, p } of prev) {
      if (v) c.style.setProperty('visibility', v, p);
      else c.style.removeProperty('visibility');
    }
  };
}

// Exported for the co-located frame-source test (direct-canvas short-circuit +
// hang-safe fall-through). Shipping callers reach it through the render functions below.
export async function createFrameSource(node: Element, opts: ExportOpts & { frameBg?: string } = {}): Promise<{ width: number; height: number; frame(t?: number, clipSec?: number): Promise<HTMLCanvasElement>; dispose(): void }> {
  const lib = await getDomToImage();
  const { width: nodeW, height: nodeH } = node.getBoundingClientRect();
  // CSS animations the per-frame scrub pauses, resumed in dispose() - without
  // this the live canvas stayed frozen after every motion export (E12 review).
  const scrubbedAnims = new Set<Animation>();
  // Round to EVEN: H.264 (yuv420p) rejects odd dimensions, so an odd export size (e.g. a
  // 555px stage) makes the MP4 encoder fail and the shell silently falls back to WebM.
  // Even dims are safe for every frame-source consumer (mp4/webm/gif/apng/ico); the ≤1px
  // trim is imperceptible. Min 2 so a tiny node can't round to zero.
  const evenFloor = (n: number): number => Math.max(2, Math.floor(n / 2) * 2);
  const targetW = evenFloor(((opts.width  as number) > 0) ? (opts.width  as number) : nodeW);
  const targetH = evenFloor(((opts.height as number) > 0) ? (opts.height as number) : nodeH);
  // An opaque backdrop for a container that carries no alpha (video). Left undefined
  // for the alpha paths (gif/apng/webp-anim, favicons), so their transparency is kept.
  // Only renderVideo (webm/mp4) passes it; without it a transparentBg tool's frames
  // capture transparent and the encoder flattens them to black.
  const frameBg = opts.frameBg;
  const dtoOpts = {
    width:  targetW,
    height: targetH,
    ...(frameBg ? { bgcolor: frameBg } : {}),
    style: {
      transform:       `scale(${targetW / nodeW})`,
      transformOrigin: 'top left',
      width:  `${nodeW}px`,
      height: `${nodeH}px`,
    },
  };
  const restore = await swapBlobUrls(node);
  const waitMs = (opts.wait ?? 1) * 1000;
  const durationMs = (opts.duration ?? 5) * 1000;   // same default every caller uses to derive frameCount
  let settled = false;
  // Raise the driven flag now (before the first capture) so a frame-clock tool's
  // rAF loop stops advancing on its own; frame(t) then paints the exact phase.
  const frameClock = beginFrameClock(node);

  // ── Static-chrome fast path ────────────────────────────────────────────────
  // Watch from construction, not from the probe: for a tool with NO export clock
  // the only available evidence that its chrome is static is that nothing mutated
  // across the settle wait and a whole real capture, and that is exactly the
  // window this observer covers. Canvas pixel writes raise no records, so "zero
  // records" is positive proof the only per-frame change is canvas pixels.
  //
  // It also stays connected AFTER a yes. For a clockless tool the probe's window is
  // one settle wait plus one capture, so a slow setInterval that retouches the DOM
  // between samples would be missed and frozen into the cached layer for the whole
  // clip. Draining per frame turns the sample into continuous evidence.
  const watcher = typeof MutationObserver === 'function' ? new MutationObserver(() => { /* records read via takeRecords */ }) : null;
  watcher?.observe(node, { subtree: true, childList: true, attributes: true, characterData: true });
  type FastPath = { chrome: HTMLCanvasElement; live: HTMLCanvasElement[]; own: Set<Element>; out: HTMLCanvasElement; nodeW: number; nodeH: number };
  let framesTaken = 0;
  let decided = false;          // the probe runs at most once; a "no" is never retried
  let fast: FastPath | null = null;
  const guard = createStaticChromeGuard();

  // The one-off chrome shot. visibility:hidden keeps the canvases' LAYOUT intact, so
  // the blit lands exactly where dom-to-image would have drawn them, and their pixels
  // don't get baked into the cached layer underneath the live ones.
  //
  // It does NOT skip dom-to-image's canvas handling: `makeNodeCopy` calls
  // `original.toDataURL()` for every canvas whatever its computed style, so this shot
  // still pays that ~30.8 ms - once, instead of on all 240 frames. That is also why a
  // tainted canvas still throws here rather than silently degrading.
  //
  // Restores on EVERY exit including a throw: a tool left with a hidden canvas after a
  // failed export is a black preview.
  const rasterChrome = async (live: HTMLCanvasElement[]): Promise<HTMLCanvasElement> => {
    const unhide = hideLiveCanvases(live);
    try { return normalizeCanvas(await lib.toCanvas(node, dtoOpts), targetW, targetH); }
    finally { unhide(); }
  };

  const probeStaticChrome = async (): Promise<FastPath | null> => {
    const live = visibleCanvases(node);
    // Drive the clock to two DIFFERENT phases before reading the records: if any
    // chrome is a function of frame time, this is what makes it move where the
    // observer can see it. filter-*'s `[data-ov-clock]` rewrites an SVG overlay
    // from its hook and slides/deck-builder seek CSS keyframes - both are caught
    // here rather than silently frozen into the cached layer.
    if (frameClock) { renderFrameAt(frameClock, 0.37); renderFrameAt(frameClock, 0.71); }
    const geom = live.length ? chromeElements(node, live) : null;
    const verdict = staticChromeVerdict({
      externalScreenshot: !!window.__lollyCaptureScreenshot,
      liveCanvases: live.length,
      // No MutationObserver (a non-browser host) means no proof, so no fast path.
      mutationRecords: watcher ? watcher.takeRecords().length : 1,
      animations: node.getAnimations?.({ subtree: true })?.length ?? 0,
      chromeOverlaps: geom ? chromePaintsOverLive(geom.liveBoxes, geom.chrome) : true,
    });
    if (!verdict.ok) {
      _host?.log?.('info', `frame capture: full rasterise per frame (${verdict.reason})`);
      return null;
    }
    const rect = node.getBoundingClientRect();
    const out = document.createElement('canvas');
    out.width = targetW; out.height = targetH;
    return { chrome: await rasterChrome(live), live, own: new Set<Element>(live), out, nodeW: rect.width, nodeH: rect.height };
  };

  // At 4K the chrome raster plus the composite is tens of MB of backing store, and a
  // mid-export stand-down drops the path with the whole encode still to run.
  const releaseFast = (f: FastPath): void => {
    f.chrome.width = f.chrome.height = 0;
    f.out.width = f.out.height = 0;
  };

  const composeFrame = async (f: FastPath): Promise<HTMLCanvasElement> => {
    const rect = node.getBoundingClientRect();
    // Re-measuring each canvas's box every frame is free; re-rasterising the
    // chrome is the ~31.9 ms this path exists to avoid. So the cached layer is
    // only redone when the NODE's own box changed, which is the one case where
    // the chrome behind the canvases can genuinely have reflowed.
    if (Math.abs(rect.width - f.nodeW) > 0.5 || Math.abs(rect.height - f.nodeH) > 0.5) {
      f.chrome = await rasterChrome(f.live);
      f.nodeW = rect.width; f.nodeH = rect.height;
    }
    // Node space → target space is the single UNIFORM factor dtoOpts already applies
    // to dom-to-image's clone: rasterStyle sets `transform: scale(targetW / node.w)`
    // and never scales height independently. Deriving a separate `sy = targetH/nodeH`
    // looks more correct and is not - the two layers then disagree vertically the
    // moment the target aspect differs from the node's (ask for 1920 wide on a square
    // 1280x1280 stage and the blitted canvas stretches away from the chrome behind
    // it). Taken at construction, so both layers are built from one number.
    const s = targetW / nodeW;
    const ctx = f.out.getContext('2d')!;
    ctx.clearRect(0, 0, targetW, targetH);
    // Same opaque backdrop the dom-to-image path applies via bgcolor: the cached chrome
    // can be transparent where the tool omits a bg rect, so fill before compositing it.
    if (frameBg) { ctx.fillStyle = frameBg; ctx.fillRect(0, 0, targetW, targetH); }
    ctx.drawImage(f.chrome, 0, 0);
    for (const c of f.live) {
      const r = c.getBoundingClientRect();
      if (!(c.width > 0 && c.height > 0) || r.width <= 0 || r.height <= 0) continue;   // drawImage throws on a 0-sized source
      ctx.drawImage(c, (r.x - rect.x) * s, (r.y - rect.y) * s, r.width * s, r.height * s);
    }
    return f.out;
  };

  return {
    width: targetW,
    height: targetH,
    async frame(t = 0, clipSec?: number): Promise<HTMLCanvasElement> {
      if (frameClock) renderFrameAt(frameClock, t, clipSec);   // deterministic phase - no settle wait needed
      else if (!settled) { await new Promise<void>(r => setTimeout(r, waitMs)); settled = true; }
      // Frame-accurate anim-source drive: a live/onFrame tool (e.g. filter) registers
      // __lollyFrameDrive to re-run its effect over the SOURCE frame at time t - the
      // deterministic render the live preview showed. Awaited so the base is updated before
      // capture. Fail-safe: an error just leaves the previous (frozen) base in place.
      const drive = (node as unknown as { __lollyFrameDrive?: (t: number, durationMs: number) => Promise<void> | void }).__lollyFrameDrive;
      if (typeof drive === 'function') {
        try { await drive(t, durationMs); }
        catch (e) { _host?.log?.('warn', `__lollyFrameDrive threw: ${(e as Error)?.message ?? e}`); }
      }
      // Scrub any CSS animation/transition to the exact frame time regardless of
      // frameClock - a clocked canvas can still share the DOM with CSS-animated
      // chrome around it. No-op when the node has none.
      scrubAnimations(node, t * durationMs, scrubbedAnims);
      if (window.__lollyCaptureScreenshot)
        return captureViaExternalScreenshot(targetW, targetH, window.__lollyCaptureScreenshot);
      // ── Direct-canvas capture (opt-in, per-node) ──────────────────────────────
      // A raster tool that already holds the FINISHED frame on a working <canvas>
      // (the filter tool's glitch shimmer) can register node.__lollyFrameCanvas(t,
      // durationMs) to hand that canvas back directly - bypassing __lollyFrameDrive,
      // the static-chrome probe, AND dom-to-image. It removes the per-frame cost this
      // path exists to avoid: baking the frame to a ~1.7MB PNG and having dom-to-image
      // re-decode that nested-base64 <svg><image> every frame (slow, and the source of
      // an intermittent decode HANG). Treated as SYNCHRONOUS - a canvas render returning
      // an HTMLCanvasElement, no new await - and fully guarded: ANY throw (or a nullish
      // return) falls straight through to the dom-to-image path below, so a broken hook
      // can never wedge the loop or drop the export. Normalised to the target pixel size
      // exactly like dom-to-image's own output, so the two paths frame identically.
      const frameCanvas = (node as unknown as { __lollyFrameCanvas?: (t: number, durationMs: number) => HTMLCanvasElement | null }).__lollyFrameCanvas;
      if (typeof frameCanvas === 'function') {
        try {
          const cv = frameCanvas(t, durationMs);
          if (cv) return normalizeCanvas(cv, targetW, targetH);
          _host?.log?.('warn', 'frame capture: __lollyFrameCanvas returned nothing; falling back to full rasterise');
        } catch (e) {
          _host?.log?.('warn', `frame capture: __lollyFrameCanvas threw, falling back to full rasterise: ${(e as Error)?.message ?? e}`);
        }
      }
      framesTaken++;
      // Probe on the SECOND frame, never the first: renderIco takes exactly one
      // frame per size, where caching a chrome layer is pure overhead, and by the
      // second call the observer has watched a whole real capture go by.
      if (!decided && framesTaken > 1) {
        decided = true;
        try { fast = await probeStaticChrome(); }
        catch (e) {
          fast = null;
          _host?.log?.('warn', `static-chrome probe failed, keeping full rasterise: ${(e as Error)?.message ?? e}`);
        }
        // The probe drove the clock to its own phases to shake out time-dependent
        // chrome, so the real one has to be repainted - and that is true WHATEVER the
        // verdict. Gating this on `fast` meant every clocked tool that DECLINED the
        // fast path (slides and deck-builder on their CSS animations, the filter-*
        // tools on their overlay hook's mutations) captured frame 1 at the probe's
        // 0.71 phase instead of its own: a visible time-jump one frame into the clip,
        // on exactly the tools the fast path never touches.
        if (frameClock) renderFrameAt(frameClock, t);
        // Nothing reads records once the fast path is out of the picture, and an
        // observer nobody drains queues every record of a 240-frame export.
        if (!fast) watcher?.disconnect();
      }
      if (fast) {
        // The cached chrome is only usable while nothing but canvas pixels has
        // changed since it was taken. rasterChrome's own visibility swap shows up
        // here as attribute records on those same canvases, so it is filtered out - 
        // otherwise the path would invalidate itself on its first composited frame.
        const mutated = watcher ? countToolMutations(watcher.takeRecords(), fast.own) : 0;
        const action = staticChromeFrameAction(guard, mutated);
        if (action === 'stand-down') {
          _host?.log?.('info', `frame capture: standing down to full rasterise per frame (chrome mutated ${guard.invalidations}x mid-export)`);
          releaseFast(fast);
          fast = null;
          watcher?.disconnect();
        } else if (action === 'refresh') {
          fast.chrome = await rasterChrome(fast.live);
          // Re-baseline the box in the same breath: a mutation that also reflowed the
          // node would otherwise make composeFrame rasterise the chrome a second time
          // for this one frame.
          const r = node.getBoundingClientRect();
          fast.nodeW = r.width; fast.nodeH = r.height;
        }
      }
      return fast ? composeFrame(fast) : lib.toCanvas(node, dtoOpts);
    },
    dispose() {
      endFrameClock(frameClock);
      watcher?.disconnect();
      if (fast) { releaseFast(fast); fast = null; }
      // Resume exactly the animations the scrub paused - an element that left
      // the DOM mid-export throws on play(), which changes nothing.
      for (const a of scrubbedAnims) { try { a.play(); } catch { /* gone */ } }
      scrubbedAnims.clear();
      restore();
    },
  };
}

// ── Favicon / ICO ─────────────────────────────────────────────────────────────
// Renders the node into a multi-resolution .ico (16/32/48 px PNG entries). Best
// suited to square marks/logos; non-square content is scaled to the box.
const ICO_SIZES = [16, 32, 48];
async function renderIco(node: Element, opts: ExportOpts): Promise<Blob> {
  const sizes = opts.icoSizes ?? ICO_SIZES;
  const entries: { size: number; bytes: Uint8Array }[] = [];
  for (const size of sizes) {
    // wait:0 - favicons are static, so there's no animation to settle.
    const src = await createFrameSource(node, { width: size, height: size, wait: 0 });
    let canvas: HTMLCanvasElement;
    try { canvas = await src.frame(); } finally { src.dispose(); }
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob(b => b ? res(b) : rej(new Error('ICO frame encode failed')), 'image/png'));
    entries.push({ size, bytes: new Uint8Array(await blob.arrayBuffer()) });
  }
  return packIco(entries);
}

// ── ZIP bundle ────────────────────────────────────────────────────────────────
// Bundles several of the tool's render formats into one archive. The shell passes
// opts.bundleFormats (visual formats only - data/video are excluded). Each entry
// renders through renderFormat on the already-watermarked node, then is zipped.
// Per-member archive filename (base + correct extension). A print PDF is renamed so
// it doesn't clobber an RGB pdf in the same bundle; the animated SVG likewise sits
// beside a still svg. Extensions that differ from the format token are mapped.
const ZIP_MEMBER_EXT: Record<string, string> = { jpeg: 'jpg', 'eps-cmyk': 'eps', 'cmyk-tiff': 'tiff', 'webp-anim': 'webp' };
function zipMemberName(base: string, f: string): string {
  if (f === 'pdf-cmyk') return `${base}-print.pdf`;
  if (f === 'svg-anim') return `${base}-animated.svg`;
  return `${base}.${ZIP_MEMBER_EXT[f] ?? f}`;
}

async function renderZip(node: Element, opts: ExportOpts): Promise<Blob> {
  const base = (opts.filename || 'export').replace(/\.[a-z0-9]+$/i, '') || 'export';
  const password = opts.strongPassword || opts.password;
  // Defense-in-depth, matching the folder/batch path (pro/zip.ts): when the whole zip
  // is locked, any PDF member is ALSO individually AES-256 (R6) locked with the same
  // password - so a PDF stays locked even after the zip is unpacked. Always the strong
  // tier for the inner PDF (RC4 needs a plain unfinished doc; AES composes with any).
  // Non-PDF members carry no lock of their own - only the container protects them.
  const memberOpts: ExportOpts = password
    ? { ...opts, password: undefined, strongPassword: password }
    : { ...opts, password: undefined, strongPassword: undefined };
  const members: Array<{ name: string; bytes: Uint8Array }> = [];
  for (const f of (opts.bundleFormats ?? []).filter(x => x !== 'zip')) {
    const blob = await renderFormat(node, f, memberOpts);
    members.push({ name: zipMemberName(base, f), bytes: new Uint8Array(await blob.arrayBuffer()) });
  }
  return packZip(members, opts);
}

// Pack already-rendered members into the archive. Split out of renderZip so the
// contact sheet (bridge/sequence-cuts.ts) gets the identical container - including
// both password tiers - without a second zip implementation.
async function packZip(members: Array<{ name: string; bytes: Uint8Array }>, opts: ExportOpts): Promise<Blob> {
  const password = opts.strongPassword || opts.password;

  // Encrypted bundle: standard = PKWARE ZipCrypto (opens anywhere, incl. Windows
  // Explorer; weak); strong = WinZip AES-256 (7-Zip / Keka / macOS; strong). Mirrors
  // the two-tier PDF lock. The shell compresses each member with fflate + hands the
  // engine bytes + CRC; buildEncryptedZip does the crypto + framing.
  if (password) {
    const { deflateSync } = await import('fflate');
    const entries = members.map(({ name, bytes }) => {
      const deflated = deflateSync(bytes);
      // Store (method 0) when deflate doesn't help (already-compressed png/jpg/webp).
      const stored = deflated.length >= bytes.length;
      return {
        name,
        compressed: stored ? bytes : deflated,
        method: (stored ? 0 : 8) as 0 | 8,
        crc32: crc32(bytes),
        uncompressedSize: bytes.length,
      };
    });
    const out = await buildEncryptedZip(entries, { tier: opts.strongPassword ? 'strong' : 'standard', password });
    return new Blob([out as BlobPart], { type: 'application/zip' });
  }

  const { zipSync } = await import('fflate');
  const files: Record<string, Uint8Array> = {};
  for (const { name, bytes } of members) files[name] = bytes;
  return new Blob([zipSync(files)], { type: 'application/zip' });
}

// ── PPTX (PowerPoint) ─────────────────────────────────────────────────────────
// Purpose: transport a page's treated IMAGES and VECTORS into PowerPoint as separate,
// extractable objects at full fidelity - layout is secondary. So instead of one flat
// picture per slide, the DOM is decomposed:
//   • an <svg> → a real embedded SVG picture (asvg:svgBlip + a PNG fallback), so the
//     recipient can pull the crisp vector out (PowerPoint even "Convert to Shape"s it);
//   • an <img> → a high-res PNG at (up to) its native resolution, with any CSS
//     treatment baked in - the actual treated photo, extractable;
//   • a url() background → the fetched asset bytes as a picture;
//   • text → a native, editable text box (font size / colour / weight / align);
//   • solid/gradient backgrounds + borders → rect shapes (light layout context);
//   • anything the walkers can't express (filter/mask/blend/clip/conic) → that subtree
//     rasterised to a PNG picture (baked, but faithful).
// A paged tool ([data-pdf-page]) fans out to one slide per page; a single-canvas tool
// is one slide. The engine (buildPptxParts) frames the OOXML from the shapes + media.

// Renders the DOM node into a video using captureStream() + MediaRecorder.
//
// Two-phase approach to guarantee stable frame rate regardless of render speed:
//   Phase 1 - render: each frame is captured sequentially via toCanvas() and
//     stored as an ImageBitmap (GPU memory). Takes longer than real-time on
//     slow machines but ensures every frame is visually unique.
//   Phase 2 - replay: pre-rendered frames are painted to an offscreen canvas
//     at exactly the target fps while MediaRecorder encodes the stream.
//
// opts.wait - seconds to let CSS animations settle before recording starts (default 1)
// opts.duration - length of the recorded clip in seconds (default 5)
//
// Hard ceiling on buffered frames (Phase 1 holds one ImageBitmap each). A normal
// clip is well under this; it exists to bound memory when duration/fps are pushed
// past the UI limits via the URL, which would otherwise OOM a mobile WebView.
// Scaled off navigator.deviceMemory where it's reported (Chromium only - the API
// caps at 8): an 8GB-class device keeps the historical 600, a 2GB mobile WebView
// gets a tighter ceiling instead of the same flat number as desktop. Floored at
// 200 so the default 5s clip (150 frames at 30fps) always completes.
// `hasAudio` raises the ceiling: an audio-driven clip (a narration audiogram) is
// worthless cut short - losing two thirds of the words is a worse failure than a
// slow export - so it gets AUDIO_FRAME_HEADROOM times the leash. The memory signal
// still scales it, so a 2 GB WebView keeps a smaller number than a desktop.
function maxVideoFrames(hasAudio = false): number {
  const gb = (navigator as { deviceMemory?: number }).deviceMemory;
  const base = !gb ? 600 : Math.max(200, Math.round((Math.min(8, gb) / 8) * 600));
  return hasAudio ? base * AUDIO_FRAME_HEADROOM : base;
}

// ── Encode quality: explicit bitrate + deterministic frame delivery ──────────
// Bitrate math lives in video-mime.ts (DOM-free, shared with recorder.ts) - the
// default 0.1 bits/pixel is tuned for these offline graphic renders. Audio bed
// rides at a fixed 128 kbps.
const AUDIO_BITRATE = 128_000;
function recorderOpts(mimeType: string, width: number, height: number, fps: number, hasAudio: boolean): MediaRecorderOptions {
  const o: MediaRecorderOptions = { mimeType, videoBitsPerSecond: videoBitrate(width, height, fps) };
  if (hasAudio) o.audioBitsPerSecond = AUDIO_BITRATE;
  return o;
}

// A canvas capture stream we drive BY HAND: captureStream(0) emits a frame only when
// we call requestFrame(), so exactly the frames we paint get encoded - frame-accurate,
// with no setTimeout drift, no background-tab throttle, and no auto-sampler picking up
// half-painted or duplicated states. `deliver()` hands the current canvas contents to
// the encoder. Where requestFrame() isn't available the stream falls back to the fps
// auto-sampler and deliver() becomes a no-op, preserving the old behaviour.
function manualCaptureStream(canvas: HTMLCanvasElement, fps: number): { stream: MediaStream; deliver: () => void } {
  const s = canvas.captureStream(0);
  const track = s.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  if (typeof track?.requestFrame === 'function') return { stream: s, deliver: () => track.requestFrame() };
  s.getTracks().forEach(t => t.stop());
  return { stream: canvas.captureStream(fps), deliver: () => {} };
}

// ── WebCodecs encode path (offline, faster-than-real-time) ───────────────────
// A deterministic alternative to the MediaRecorder capture: pre-rendered frames are
// handed straight to a VideoEncoder with exact timestamps and an honoured bitrate, then
// muxed in memory. The muxers (mp4-muxer / webm-muxer) are pure-JS, make no network
// calls, and are lazy-imported so they never touch the initial bundle (loaded - and
// service-worker-cached for offline - only when a video is first exported). Versus
// MediaRecorder this gives frame-accurate output, real H.264 High profile for mp4, and
// encodes as fast as the CPU allows instead of in real time (a big win for long/large
// clips, and it can't stall in a backgrounded tab). pickWebCodecsVideo returns null when
// WebCodecs - or a codec for the requested size - isn't available, so renderVideo falls
// back to the MediaRecorder path.
// `pickWebCodecsVideo` / `pickWebCodecsAudio` moved to bridge/video-shared.ts
// (imported at the top) - the shared avc→vp9→vp8 ladder + per-container audio pick
// this file used to own and two others copied. The export audio bed is 48 kHz
// stereo at AUDIO_BITRATE (the shared defaults), so its call passes only the
// container.

interface WebCodecsAudioTrack extends AudioPick { buffer: AudioBuffer; }

// An offline-rendered audio bed (AudioBuffer) → the transferable planar form the DOM-free
// encode core takes. numberOfChannels stays the track's declared count; the core clamps
// to the buffer's actual channel count when a plane is missing.
function audioTrackToPlanar(a: WebCodecsAudioTrack): EncodeAudio {
  const channels = Array.from({ length: a.buffer.numberOfChannels }, (_, i) => a.buffer.getChannelData(i));
  return { channels, sampleRate: a.sampleRate, numberOfChannels: a.numberOfChannels, codec: a.codec, muxCodec: a.muxCodec, bitrate: a.bitrate };
}

// Encode + mux the buffered frames on the MAIN thread (the DOM-free core), then wrap the
// bytes in a Blob and embed provenance. The Worker path (renderVideo) calls the same core
// off-thread and wraps identically.
async function encodeVideoWithWebCodecs(
  frames: Array<ImageBitmap | { data: BufferSource }>,
  pick: EncodePick,
  o: { width: number; height: number; fps: number; bitrate: number; meta?: ExportMeta | null; audio?: WebCodecsAudioTrack | null; bitrateMode?: 'variable' | 'constant'; hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software'; colorSpace?: VideoColorSpaceInit; frameFormat?: 'RGBA' | 'I420P10'; subtitlesVtt?: string },
): Promise<Blob> {
  const { buffer, type } = await encodeMuxWebCodecs(frames, pick, {
    width: o.width, height: o.height, fps: o.fps, bitrate: o.bitrate,
    audio: o.audio ? audioTrackToPlanar(o.audio) : null,
    bitrateMode: o.bitrateMode, hardwareAcceleration: o.hardwareAcceleration,
    colorSpace: o.colorSpace, frameFormat: o.frameFormat, subtitlesVtt: o.subtitlesVtt,
  });
  return withVideoMeta(new Blob([buffer], { type }), type, o.meta ?? null);
}

async function renderVideo(node: Element, opts: ExportOpts, preferred: string): Promise<Blob> {
  // Audio (opts.audio = { id?, url }) is resolved up front so a bad track fails
  // fast - before the slow Phase 1 capture - and degrades to silent + warning.
  // Pass the clip length so any fade-out lands at the end of the replay.
  const { audio, mimeType } = await prepareExportAudio(opts, preferred, opts.duration ?? 5, typeof AudioEncoder !== 'undefined');
  // Fail fast when NOTHING can encode - no recorder mime and no WebCodecs.
  // Without this, Phase 1 would capture (and bitmap) every frame only for the
  // Phase 2 guard below to throw the same error minutes of work later.
  if (!mimeType && typeof VideoEncoder === 'undefined') { audio?.stop(); throw new Error(NO_VIDEO_MSG); }
  // WP-F: a soft webvtt track to embed (default-on when a transcript exists). Only the
  // WebCodecs mux path below can carry it; every MediaRecorder route warns (keyed off
  // `wantSoftSubs`) and drops it. `softSubs` is the value actually threaded into the
  // WebCodecs encode - null unless this browser can carry it.
  const wantSoftSubs = typeof opts.subtitlesVtt === 'string' && opts.subtitlesVtt.length > 0;
  const softSubs = wantSoftSubs && canCarrySoftSubtitles() ? opts.subtitlesVtt! : null;
  // A missing recorder mime is NOT fatal here: the WebCodecs encode below needs no
  // MediaRecorder at all (e.g. a browser with VideoEncoder AVC but no MediaRecorder
  // mp4). It only rules out the MediaRecorder paths - the opt-in stream capture and
  // the Phase 2 replay - so NO_VIDEO_MSG moves to the guard before Phase 2, thrown
  // only once the WebCodecs pick has ALSO come up empty.

  // A tool with a continuously-animating <canvas> can OPT IN to real-time stream
  // capture by marking it `data-capture-stream` - the canvas's own rAF loop is
  // recorded at wall-clock speed, so a self-looping animation (e.g. the 3d tool's
  // turntable: one revolution per `duration`s) yields a genuine gapless loop, and
  // it's faster than the frame-by-frame path. Opt-in so tools that composite DOM
  // overlays on top of a canvas keep the compositing (frame-by-frame) path.
  const streamCanvas = (node as Element).querySelector?.('canvas[data-capture-stream]') as HTMLCanvasElement | null;
  const captureEl = (typeof (node as any).captureStream === 'function')
    ? (node as HTMLCanvasElement)
    : (streamCanvas && typeof streamCanvas.captureStream === 'function' ? streamCanvas : null);
  // Stream capture is inherently MediaRecorder; without a mime it falls through to
  // the frame-by-frame path (losing the gapless loop, keeping the export).
  if (captureEl && mimeType) {
    if (wantSoftSubs) _host?.log?.('warn', SOFT_SUBTITLES_DROPPED_MSG);   // MediaRecorder stream capture can't carry it
    const waitMs     = (opts.wait     ?? 1) * 1000;
    const durationMs = (opts.duration ?? 5) * 1000;
    const canvasFps  = opts.fps ?? 30;
    await new Promise<void>(r => setTimeout(r, waitMs));
    return recordStream(captureEl.captureStream(canvasFps), { durationMs, mimeType, audio, meta: opts.meta, width: captureEl.width, height: captureEl.height, fps: canvasFps });
  }

  const reqFps     = opts.fps ?? 24;
  const durationMs = (opts.duration ?? 5) * 1000;

  // Phase 1 buffers every frame as an ImageBitmap before replay, so the frame count
  // is the memory ceiling. It is resolved by videoFramePlan (video-mime.ts) rather
  // than clamped in place: clamping in place normalised the frames against the
  // SHORTENED count while the tool still mapped that fraction onto its full analysed
  // span, so a 90 s narration exported as a 25 s video with its captions running 3x
  // fast against a bed that stopped a third of the way in. The plan keeps length,
  // frame rate and frame count in one place, raises the ceiling when there is audio
  // to stay in step with, and lowers the frame rate before it ever drops the tail.
  const plan       = videoFramePlan(durationMs / 1000, reqFps, maxVideoFrames(!!opts.audio?.url));
  const fps        = plan.fps;
  const frameMs    = 1000 / fps;
  const frameCount = plan.frameCount;
  if (fps !== reqFps) {
    _host?.log?.('warn', `Video frame rate lowered to ${fps}fps to keep the whole ${(durationMs / 1000).toFixed(1)}s clip inside the frame buffer.`);
    // ...and say so where a person will actually see it (host.log is console-only).
    _exportNoticeSink?.(`Exported at ${fps} fps (lowered from ${reqFps} to fit this length).`);
  }
  if (plan.truncated) {
    const msg = `Video truncated to ${plan.clipSec.toFixed(1)}s of the requested ${(durationMs / 1000).toFixed(1)}s. The export is the start of the clip and stays in step with its audio.`;
    _host?.log?.('warn', msg);
    _exportNoticeSink?.(msg);   // ClipPlan.truncated's contract: surface it visibly.
  }

  // Phase 1: render all frames sequentially through the shared FrameSource.
  // Animation advances in real time between frames, so each captures a unique
  // state - recording takes longer than real-time but never duplicates/skips.
  // A video container carries no alpha, so a transparent backdrop encodes as black -
  // the reason a transparentBg tool's mp4/webm came out black while its gif (an alpha
  // format) did not. Composite every frame onto an opaque backdrop: the caller's
  // background if it's a real colour, else white. transparentBg stays the tool default;
  // it just means "transparent where the container supports it" - a tool that paints its
  // own opaque background still wins, since that colour sits on top of this fill.
  const videoBg = (typeof opts.background === 'string' && opts.background !== 'transparent')
    ? opts.background : '#ffffff';
  const source  = await (async () => {
    try { return await createFrameSource(node, { ...opts, frameBg: videoBg }); }
    catch (err) { audio?.stop(); throw err; }
  })();
  const targetW = source.width, targetH = source.height;

  // Codec pick BEFORE Phase 1 (plan 154 WP-2): HDR captures frames as PQ RGBA buffers,
  // so hdrActive must be known before the loop runs. DEVICE-INDEPENDENT - hdrDesired is
  // the explicit opts.hdr toggle ONLY, never displaySupportsHdr(): the display governs
  // preview, never the encoded bytes, so a credentialed HDR clip is byte-reproducible
  // across machines (exactly like the stills HDR path). hdrActive additionally requires
  // the codec ladder to have landed a real 10-bit HDR codec, so a browser that cannot
  // encode one silently gets today's SDR bytes.
  const baseBitrate = videoBitrate(targetW, targetH, fps, bppForQuality(opts.videoQuality ?? 'balanced'));
  const hdrDesired = opts.hdr === true;
  const pick = await pickWebCodecsVideo(preferred, targetW, targetH, fps, baseBitrate, opts.videoCodec, hdrDesired);
  const hdrActive = hdrDesired && !!pick && is10bitHdrCodec(pick.codec);
  // WP-2 Phase 2: prefer a TRUE 10-bit I420P10 source over Phase 1's 8-bit-sourced
  // PQ RGBA when the runtime can build an I420P10 VideoFrame. Same brand boost + PQ
  // math, but 10-bit through the encode, so the shadows the PQ transfer packs codes
  // into stop banding. Falls back to Phase 1 (RGBA) where I420P10 isn't constructible.
  const deep10 = hdrActive && supportsI420P10Frame();

  const frames: Array<ImageBitmap | { data: BufferSource }> = [];
  try {
    for (let i = 0; i < frameCount; i++) {
      // `plan.clipSec` travels with the normalised t so a clocked tool can resolve
      // absolute seconds instead of guessing the span from its own metadata - the
      // guess is what let the caption clock disagree with the muxed audio.
      const cv = await source.frame(i / frameCount, plan.clipSec);
      if (deep10) {
        // Phase 2 (true 10-bit): 8-bit sRGB canvas -> linear DeepFrame -> brand-
        // boosted rec2020-linear view -> full-precision PQ -> I420P10 YUV. Same boost
        // knobs as Phase 1 (hdrViewTransform is the float dual of hdrBoostToPQ); the
        // gain stays 10-bit through the encode. pqEncodeFrame's 203-nit anchor matches
        // the view transform's SDR-white reference, so the tonescale is consistent.
        const c = cv.getContext('2d', { willReadFrequently: true });
        const id = c!.getImageData(0, 0, cv.width, cv.height);
        const view = hdrViewTransform(fromU8Srgb(id.data, cv.width, cv.height), { targets: hdrTargets(opts), ...hdrTune(opts) });
        frames.push({ data: pqToI420P10(pqEncodeFrame(view)).data as BufferSource });
      } else if (hdrActive) {
        // Phase 1 fallback: PQ-transform the frame in place (engine hdrBoostToPQ via the
        // shared stills helper - same targets/tune), 8-bit-sourced PQ into an RGBA buffer.
        hdrCanvas(cv, opts);
        const c = cv.getContext('2d', { willReadFrequently: true });
        frames.push({ data: c!.getImageData(0, 0, cv.width, cv.height).data });
      } else {
        frames.push(await createImageBitmap(cv));
      }
      // Progress for a slow N-frame render (no-op when no listener is wired).
      opts.onProgress?.(i + 1, frameCount);
      // Cancel leaves by the same door a capture failure does: the catch stops the
      // audio track, the finally disposes the frame source.
      opts.signal?.throwIfAborted();
    }
  } catch (err) {
    audio?.stop();
    throw err;
  } finally {
    source.dispose();
  }

  // Fast path: encode the buffered frames (and, for an audio export, an offline-
  // rendered music bed) straight through WebCodecs. Deterministic, honours the
  // bitrate, real H.264 High / AAC (mp4) or VP9 / Opus (webm), faster than real time.
  // Audio takes this path ONLY when BOTH VideoEncoder and AudioEncoder support the
  // chosen codecs; otherwise it falls through to the MediaRecorder path below, which
  // muxes the live audio track in real time. Any failure falls through cleanly (the
  // frames + the live `audio` track stay valid for Phase 2).
  {
    const clipSec = frames.length / fps;         // bed length == the ACTUAL (maybe capped) video length
    // `pick`/`baseBitrate`/`hdrActive` were resolved before Phase 1 (HDR capture format
    // depends on the pick). Trim the base bitrate to the chosen codec's efficiency
    // (AV1/HEVC reach the same quality at fewer bytes).
    const bitrate = pick ? codecAdjustedBitrate(baseBitrate, pick.codec) : baseBitrate;
    const wantAudio = !!opts.audio?.url;
    const audioPick = pick && wantAudio ? await pickWebCodecsAudio(pick.container) : null;
    // The "silent video" warning for a dropped live track was deferred to here
    // (prepareExportAudio, deferSilentWarn) so it only fires when the WebCodecs
    // audio pick ALSO came up empty and no live track survives for Phase 2 - 
    // i.e. the export really will be silent. AudioEncoder-less browsers were
    // already warned in prepareExportAudio, hence the typeof gate.
    if (wantAudio && !audioPick && !audio && typeof AudioEncoder !== 'undefined') {
      _host?.log?.('warn', 'This browser cannot encode an audio track into the chosen container; exporting silent video.');
    }
    // hdrActive frames are RGBA buffers only the WebCodecs core can consume (Phase 2's
    // drawImage cannot), so an HDR export MUST enter this block even when audio can't be
    // encoded - it then ships silent HDR rather than crashing on the RGBA frames below.
    if (pick && (!wantAudio || audioPick || !mimeType || hdrActive)) {
      // Resolve the offline music bed once; a failure here (bedOk=false) falls through to
      // the MediaRecorder Phase 2, which muxes the live audio track instead.
      let track: WebCodecsAudioTrack | null = null;
      let bedOk = true;
      try {
        if (wantAudio && audioPick) {
          const bed = await renderMusicBed(opts.audio!.url, clipSec, audioPick.sampleRate, {
            fadeIn: opts.audio!.fadeIn, fadeOut: opts.audio!.fadeOut, clipSec, volume: opts.audio!.volume, start: opts.audio!.start,
          }, opts.audio!.mix);                    // matches prepareExportAudio's envelope + mix-in bed
          if (bed) track = { ...audioPick, buffer: bed };
        }
      } catch { bedOk = false; }
      if (!bedOk && (!mimeType || hdrActive)) {
        // No usable Phase 2 fallback here - either there's no MediaRecorder mime, or this
        // is HDR (whose frames are RGBA buffers Phase 2 cannot drawImage). Encode silent
        // in-thread rather than fail the export or crash on the RGBA frames.
        bedOk = true; track = null;
        _host?.log?.('warn', 'Audio bed unavailable; exporting silent video.');
      }

      // Off-thread encode (opt-in, probe-gated): hand the buffered frames + a COPY of the
      // bed PCM to a Worker so the encode/mux runs off the main thread. Transfer is one-way,
      // so this is COMMITTED - no Phase 2 fallback (the up-front support probe makes a mid-
      // encode failure unlikely; a failure surfaces as a clear error and the user re-exports).
      // Worker path is OFF for HDR: it transfers ImageBitmaps and does not thread a
      // colorSpace, so HDR always takes the in-thread core below (frames are RGBA buffers).
      // WP-F: a soft subtitle track (subtitlesVtt) DOES ride the worker boundary - it's a
      // plain string, structured-clone-safe, so no transfer wiring, and the worker runs the
      // same DOM-free core that muxes it in-thread.
      if (bedOk && !hdrActive && supportsWorkerVideoEncode()) {
        try {
          const workerAudio: EncodeAudio | null = track ? {
            channels: Array.from({ length: track.buffer.numberOfChannels }, (_, i) => new Float32Array(track!.buffer.getChannelData(i))),
            sampleRate: track.sampleRate, numberOfChannels: track.numberOfChannels, codec: track.codec, muxCodec: track.muxCodec, bitrate: track.bitrate,
          } : null;
          _host?.log?.('info', `video: WebCodecs (worker) ${pick.container}/${pick.codec}${track ? '+' + audioPick!.codec : ''} ${targetW}×${targetH}@${fps}`);
          const enc = await encodeVideoInWorker(frames as ImageBitmap[], pick, { width: targetW, height: targetH, fps, bitrate, audio: workerAudio, ...(softSubs ? { subtitlesVtt: softSubs } : {}) });
          const blob = await withVideoMeta(new Blob([enc.buffer], { type: enc.type }), enc.type, opts.meta ?? null);
          audio?.stop();                            // the worker consumed + closed the frames
          return blob;
        } catch (err) {
          audio?.stop();
          throw err instanceof Error ? err : new Error('worker video encode failed');
        }
      }

      // In-thread encode: on failure the frames + live `audio` track stay valid for Phase 2.
      if (bedOk) {
        try {
          _host?.log?.('info', `video: WebCodecs ${pick.container}/${pick.codec}${hdrActive ? (deep10 ? ' HDR/10-bit' : ' HDR') : ''}${track ? '+' + audioPick!.codec : ''} ${targetW}×${targetH}@${fps} ${Math.round(bitrate / 1000)}kbps`);
          const blob = await encodeVideoWithWebCodecs(frames, pick, {
            width: targetW, height: targetH, fps, bitrate, meta: opts.meta, audio: track,
            bitrateMode: opts.bitrateMode, hardwareAcceleration: opts.hardwareAcceleration,
            ...(hdrActive ? { colorSpace: HDR_VF_COLORSPACE, frameFormat: (deep10 ? 'I420P10' : 'RGBA') as 'I420P10' | 'RGBA' } : {}),
            ...(softSubs ? { subtitlesVtt: softSubs } : {}),   // WP-F soft caption track
          });
          frames.forEach(b => { if (b instanceof ImageBitmap) b.close(); });
          audio?.stop();                            // discard the now-unused live MediaRecorder audio track
          return blob;
        } catch (err) {
          // HDR has no SDR fallback: the frames are RGBA buffers Phase 2 cannot draw, and
          // MediaRecorder cannot encode HDR anyway. Surface the failure instead.
          if (hdrActive) {
            frames.forEach(b => { if (b instanceof ImageBitmap) b.close(); });
            audio?.stop();
            throw err instanceof Error ? err : new Error('HDR video encode failed');
          }
          _host?.log?.('warn', `WebCodecs encode failed (${(err as { message?: string })?.message ?? err}); falling back to MediaRecorder.`);
          // frames stay open; the live `audio` track stays live for Phase 2 below.
        }
      }
    }
  }

  // Phase 2 needs a MediaRecorder mime. Reaching here without one means the
  // WebCodecs attempt above also came up empty - nothing can encode.
  if (!mimeType) {
    frames.forEach(b => { if (b instanceof ImageBitmap) b.close(); });
    audio?.stop();
    throw new Error(NO_VIDEO_MSG);
  }
  // WP-F: reaching Phase 2 with a transcript in hand means the WebCodecs mux path did
  // not carry it (no pick, unencodable audio container, or a mid-encode fallback). The
  // MediaRecorder replay below cannot embed a soft track - say so, never silently.
  if (wantSoftSubs) _host?.log?.('warn', SOFT_SUBTITLES_DROPPED_MSG);

  // Phase 2: replay pre-rendered frames at target fps into captureStream.
  // drawImage(bitmap) is near-instant so the replay timing is stable. The
  // audio bed joins the stream here (not in Phase 1): replay is real-time, so
  // starting the looped source at recorder.start() keeps it in sync and its
  // loop naturally covers the actual replay length - including a clip
  // truncated by maxVideoFrames(), where frames.length is the timeline.
  const offscreen = document.createElement('canvas');
  offscreen.width  = targetW;
  offscreen.height = targetH;
  const ctx    = offscreen.getContext('2d')!;
  // Drive frame delivery by hand so the replay is frame-accurate and stays locked to
  // wall-clock (and thus to the audio bed) - see manualCaptureStream.
  const { stream, deliver } = manualCaptureStream(offscreen, fps);
  if (audio) stream.addTrack(audio.track);

  const recorder = new MediaRecorder(stream, recorderOpts(mimeType, targetW, targetH, fps, !!audio));
  const chunks: Blob[]   = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onerror = e => { audio?.stop(); reject((e as any).error ?? new Error('MediaRecorder error')); };
    recorder.onstop  = () => {
      audio?.stop();
      stream.getTracks().forEach(t => t.stop());
      frames.forEach(b => { if (b instanceof ImageBitmap) b.close(); });
      const container = videoContainer(mimeType);
      resolve(withVideoMeta(new Blob(chunks, { type: container }), container, opts.meta));
    };

    recorder.start();
    audio?.start();

    // Replay: hand each pre-rendered frame to the encoder exactly once - captureStream(0)
    // + requestFrame() means the frame we paint IS the frame that's encoded (no fps
    // auto-sampler duplicating or dropping frames against the paint clock). Paced by
    // setTimeout, NOT rAF: rAF pauses entirely in a backgrounded/headless tab, which
    // would stall the export mid-record; setTimeout keeps advancing (throttled at worst)
    // so the clip always completes, and in the foreground it runs at ~real-time so the
    // audio bed stays in sync.
    let fi = 0;
    function pump() {
      if (fi >= frames.length) { setTimeout(() => { try { recorder.stop(); } catch { /* already stopping */ } }, Math.max(frameMs, 40)); return; }
      ctx.drawImage(frames[fi++] as ImageBitmap, 0, 0);   // Phase 2 only runs for SDR - every frame is an ImageBitmap
      deliver();
      setTimeout(pump, frameMs);
    }
    pump();
  });
}

// ── Live capture ("Record live") ─────────────────────────────────────────────
// Records the on-screen preview through a screen share so the clip's frame pacing
// matches what the user actually watched - the opt-in alternative to the offline
// paths above. Chromium self-tab shares crop to the element exactly (CropTarget);
// other browsers/surfaces run live-capture.ts's stage-flash calibration and a
// per-frame canvas crop. One MediaRecorder encode at the live bitrate tier (real
// motion, one take, no re-render). The module is lazy-imported so it loads only
// when the option is actually used. wait/fps don't apply: capture starts when the
// stage is located and frames arrive at the compositor's own cadence.
//
// A SEQUENCE STAGE gets a playhead driven for it. Live capture films whatever the
// DOM is doing, and a timed composition does nothing on its own - the preview's
// playhead only moves while the timeline panel drives it - so a live take of a
// sequence used to be one frozen frame for the whole clip. `driveSequenceTime`
// (bridge/sequence-dom.ts, the same applier the preview clock uses, never a second
// copy of the maths) advances t from 0 across the capture window and restores every
// authored style afterwards. It starts on `onRecordStart`, so the composition does
// not play through the screen-share picker before the recorder is rolling.
async function renderLive(node: Element, opts: ExportOpts, preferred: string): Promise<Blob> {
  const durationS = opts.duration ?? 5;
  const { audio, mimeType } = await prepareExportAudio(opts, preferred, durationS);
  if (!mimeType) { audio?.stop(); throw new Error(NO_VIDEO_MSG); }
  const { captureLiveClip } = await import('./live-capture.ts');
  // Bitrate from the stage's device-pixel size - the ceiling either crop tier can
  // deliver. 60fps in the math (compositor rate); the clamp bounds a huge canvas.
  const { width, height } = node.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  // Lazy, like live-capture itself: the applier pulls in the plan module's clamps
  // and the transition maths, which the initial bundle has no use for.
  const playhead = isSequenceStage(node)
    ? (await import('./sequence-dom.ts')).driveSequenceTime(node as HTMLElement, { durationMs: durationS * 1000 })
    : null;
  try {
    const blob = await captureLiveClip(node, {
      durationMs: durationS * 1000,
      mimeType,
      videoBitsPerSecond: videoBitrate(Math.round(width * dpr), Math.round(height * dpr), 60, LIVE_BITS_PER_PIXEL),
      audioTrack: audio?.track ?? null,
      onRecordStart: () => { audio?.start(); playhead?.start(); },
      // Countdown for chrome OUTSIDE the capture (the export button) - the in-page
      // pill is skipped whenever it has no capture-safe spot next to the stage.
      onProgress: opts.onProgress,
      onWarn: msg => _host?.log?.('warn', msg),
    });
    // MediaRecorder may fall back to the other container (mp4 request → webm bytes
    // on Firefox) - derive the label from what it actually produced, like renderVideo.
    const container = videoContainer(blob.type || mimeType);
    return await withVideoMeta(new Blob([blob], { type: container }), container, opts.meta);
  } finally {
    // Restores every class/inline style the playhead wrote, even if the capture threw
    // or the user cancelled the share - the live canvas must be left as it was found.
    playhead?.stop();
    audio?.stop();
  }
}

// ── Top & Tail video compositor ────────────────────────────────────────────────
// The export path for the top-tail-recorder tool: an intro "top" card → the
// recorded footage → an outro "tail" card, composited onto ONE canvas in REAL TIME
// (unlike renderVideo's sequential DOM capture, which would drift against a live
// <video>). The footage is drawn object-fit:cover into the chosen frame, so any
// camera aspect ratio fills a portrait OR landscape output consistently - the cards
// define the frame, the footage fits into it. The footage's own audio is mixed with
// an optional faded music bed into a single track. Detected via [data-toptail]; if
// no footage has been recorded yet it degrades to the plain DOM-timeline capture.
function ttNum(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

async function renderTopTail(node: Element, opts: ExportOpts, preferred: string): Promise<Blob> {
  const stage = ((node as HTMLElement).matches?.('[data-toptail]')
    ? node
    : node.querySelector('[data-toptail]')) as HTMLElement | null;
  const bodyVideo = stage?.querySelector('[data-tt="body"]') as HTMLVideoElement | null;
  const src = bodyVideo && (bodyVideo.currentSrc || bodyVideo.getAttribute('src'));
  // No recorded footage yet → fall back to the plain DOM-timeline capture (the cards
  // alone still make a valid clip), so an export never hard-fails pre-recording.
  if (!stage || !bodyVideo || !src) return renderVideo(node, opts, preferred);

  const mimeType = videoMimeType(preferred, { audio: true }) ?? videoMimeType(preferred);
  if (!mimeType) throw new Error(NO_VIDEO_MSG);

  const introEl = stage.querySelector('[data-tt="intro"]') as HTMLElement | null;
  const outroEl = stage.querySelector('[data-tt="outro"]') as HTMLElement | null;
  const lowerEl = stage.querySelector('[data-tt="lower"]') as HTMLElement | null;
  const introMs = ttNum(stage.dataset.introMs, 1600);
  const outroMs = ttNum(stage.dataset.outroMs, 1800);
  const lowerMs = ttNum(stage.dataset.lowerMs, 2600); // lower-third visible window at head & tail of body
  const fps = 30;
  const frameMs = 1000 / fps;
  const EDGE_FADE = 260; // ms of fade-from/to-black at the very ends

  const box = stage.getBoundingClientRect();
  const nodeW = box.width || 1080, nodeH = box.height || 1080;
  const targetW = Math.round(((opts.width  as number) > 0) ? (opts.width  as number) : nodeW);
  const targetH = Math.round(((opts.height as number) > 0) ? (opts.height as number) : nodeH);

  // Rasterise the card layers once at target size. Intro/outro are full-frame;
  // the lower-third keeps transparency (drawn as an overlay).
  const lib = await getDomToImage();
  const raster = async (el: HTMLElement | null): Promise<HTMLCanvasElement | null> => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const w = r.width || nodeW, h = r.height || nodeH;
    try {
      return await lib.toCanvas(el, {
        width: targetW, height: targetH,
        style: { transform: `scale(${targetW / w})`, transformOrigin: 'top left', width: `${w}px`, height: `${h}px` },
      });
    } catch { return null; }
  };
  const restore = await swapBlobUrls(stage);
  let introCanvas: HTMLCanvasElement | null = null;
  let outroCanvas: HTMLCanvasElement | null = null;
  let lowerCanvas: HTMLCanvasElement | null = null;
  try {
    introCanvas = await raster(introEl);
    outroCanvas = await raster(outroEl);
    lowerCanvas = await raster(lowerEl);
  } finally { restore(); }

  // A dedicated, UN-muted playback of the footage so its audio flows into the mix
  // (the on-canvas preview stays muted for autoplay).
  const play = document.createElement('video');
  play.src = src; play.muted = false; play.playsInline = true; play.preload = 'auto';
  await new Promise<void>((res) => {
    if (play.readyState >= 1) return res();
    play.onloadedmetadata = () => res();
    play.onerror = () => res();
  });
  // MediaRecorder WebM reports duration=Infinity until it's seeked to the end - force
  // it to resolve so the body phase gets the real clip length.
  if (!Number.isFinite(play.duration) || play.duration === 0) {
    await new Promise<void>((res) => {
      const to = setTimeout(res, 1500);
      play.ontimeupdate = () => {
        if (Number.isFinite(play.duration)) { clearTimeout(to); play.ontimeupdate = null; play.currentTime = 0; res(); }
      };
      try { play.currentTime = 1e7; } catch { clearTimeout(to); res(); }
    });
  }
  const TT_MAX_BODY_MS = 120000; // safety ceiling (2 min) on the composited body length
  const durSec = Number.isFinite(play.duration) && play.duration > 0 ? play.duration : 8;
  const bodyMs = Math.min(durSec * 1000, TT_MAX_BODY_MS);
  const totalMs = introMs + bodyMs + outroMs;

  // Whether the footage carries its own audio - the music only ducks when there's
  // something to duck under (a camera video-only recording is silent → no duck; an
  // uploaded talking clip → duck). Best-effort across engines (the forced end-seek
  // above has already decoded some audio, so webkitAudioDecodedByteCount is set).
  const av = play as HTMLVideoElement & { mozHasAudio?: boolean; webkitAudioDecodedByteCount?: number; audioTracks?: { length: number } };
  const footageHasAudio = Boolean(av.mozHasAudio)
    || (av.audioTracks?.length ?? 0) > 0
    || (av.webkitAudioDecodedByteCount ?? 0) > 0;

  // Audio graph: mix the footage's own audio + the (faded) music bed into ONE track
  // (MediaRecorder only reliably muxes a single audio track).
  const AC = globalThis.AudioContext ?? (globalThis as any).webkitAudioContext;
  const actx: AudioContext | null = AC ? new AC() : null;
  const dest = actx ? actx.createMediaStreamDestination() : null;
  let music: { start(): void; stop(): void } | null = null;
  if (actx && dest) {
    try {
      const bodySrc = actx.createMediaElementSource(play);
      const bodyGain = actx.createGain();
      bodyGain.gain.value = 1;
      bodySrc.connect(bodyGain).connect(dest);
    } catch { /* element already tapped / unsupported - footage plays silent */ }
    if (opts.audio?.url) {
      try {
        const bytes = await (await fetch(opts.audio.url)).arrayBuffer();
        const buffer = await actx.decodeAudioData(bytes);
        const fade: AudioFade = {
          fadeIn:  opts.audio.fadeIn  ?? 1,
          fadeOut: opts.audio.fadeOut ?? 1.4,
          clipSec: totalMs / 1000,
          volume:  opts.audio.volume,
          start:   opts.audio.start,
          duck: footageHasAudio && (opts.audio.duck ?? 1) < 1
            ? { level: opts.audio.duck ?? 1, startSec: introMs / 1000, endSec: (introMs + bodyMs) / 1000 }
            : undefined,
        };
        // A mix-in bed (a tool with its own audio, section 6.1) rides the same graph:
        // the primary plays once and the bed's envelope ducks under its extent.
        let bedBuffer: AudioBuffer | null = null;
        if (opts.audio.mix?.url) {
          try {
            bedBuffer = await actx.decodeAudioData(await (await fetch(opts.audio.mix.url)).arrayBuffer());
          } catch (err) {
            _host?.log?.('warn', `Mix-in track unavailable (${(err as { message?: string })?.message ?? err}); exporting without it.`);
          }
        }
        const primary = connectMusic(actx, buffer, dest, bedBuffer ? { ...fade, loop: false } : fade);
        const bed = bedBuffer && opts.audio.mix
          ? connectDuckedBed(actx, bedBuffer, dest, opts.audio.mix, totalMs / 1000, primarySpan(buffer, fade))
          : null;
        music = { start() { primary.start(); bed?.start(); }, stop() { primary.stop(); bed?.stop(); } };
      } catch (err) {
        _host?.log?.('warn', `Music bed unavailable (${(err as { message?: string })?.message ?? err}).`);
      }
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW; canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  const { stream, deliver } = manualCaptureStream(canvas, fps);
  const mixTrack = dest?.stream.getAudioTracks()[0];
  if (mixTrack) stream.addTrack(mixTrack);

  const container = videoContainer(mimeType);
  const recorder = new MediaRecorder(stream, recorderOpts(mimeType, targetW, targetH, fps, !!mixTrack));
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  const fillBlack = () => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, targetW, targetH); };
  const drawFull = (c: HTMLCanvasElement | null) => { if (c) ctx.drawImage(c, 0, 0, targetW, targetH); else fillBlack(); };
  // Clip fit (data-clip-fit): 'cover' fills the frame (crop); 'contain' fits the whole
  // clip with letterbox bars. Default cover - matches the recorded-camera behaviour.
  const fitContain = stage.dataset.clipFit === 'contain';
  const drawCover = (v: HTMLVideoElement) => {
    const vw = v.videoWidth || targetW, vh = v.videoHeight || targetH;
    const scale = fitContain ? Math.min(targetW / vw, targetH / vh) : Math.max(targetW / vw, targetH / vh);
    const dw = vw * scale, dh = vh * scale;
    if (fitContain) fillBlack();   // letterbox bars behind a contained clip
    ctx.drawImage(v, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh);
  };

  return new Promise<Blob>((resolve, reject) => {
    const cleanup = () => {
      try { stream.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
      try { play.pause(); } catch { /* ignore */ }
      music?.stop();
      actx?.close().catch(() => {});
    };
    recorder.onerror = e => { cleanup(); reject((e as { error?: Error }).error ?? new Error('MediaRecorder error')); };
    recorder.onstop = () => { cleanup(); resolve(withVideoMeta(new Blob(chunks, { type: container }), container, opts.meta)); };

    let startT = 0;
    let bodyStarted = false;
    let lastFrame = -Infinity;
    const frame = (now: number): void => {
      if (!startT) startT = now;
      const el = now - startT;
      // Cancel: the rAF tick is this compositor's yield point, so a cancelled clip
      // stops being encoded instead of running to its full length unwatched. Reject
      // before stopping the recorder, so onstop's resolve finds a settled promise.
      if (opts.signal?.aborted) {
        cleanup();
        reject(opts.signal.reason);
        try { recorder.stop(); } catch { /* already stopping */ }
        return;
      }
      if (el >= totalMs) { try { recorder.stop(); } catch { /* already stopping */ } return; }

      // Composite + hand off one frame per fps tick (wall-clock paced): the live
      // footage is sampled at exactly fps and each painted frame is encoded once.
      if (now - lastFrame >= frameMs) {
        lastFrame = now;
        if (el < introMs) {
          drawFull(introCanvas);
        } else if (el < introMs + bodyMs) {
          if (!bodyStarted) {
            bodyStarted = true;
            try { play.currentTime = 0; } catch { /* ignore */ }
            play.play().catch(() => {});
          }
          if (play.readyState >= 2 && !play.ended) drawCover(play); else fillBlack();
          // Lower-third overlay: slides/fades in over the head and again near the tail.
          const bEl = el - introMs;
          const nearTail = bodyMs - bEl;
          if (lowerCanvas && (bEl < lowerMs || nearTail < lowerMs)) {
            const phase = bEl < lowerMs ? bEl : nearTail;      // 0..lowerMs
            const a = Math.min(1, phase / 350);                // ease in over 350ms
            ctx.globalAlpha = a;
            ctx.drawImage(lowerCanvas, 0, Math.round((1 - a) * 24), targetW, targetH);
            ctx.globalAlpha = 1;
          }
        } else {
          drawFull(outroCanvas);
        }

        // Global fade from/to black at the very ends of the whole clip.
        if (el < EDGE_FADE) { ctx.globalAlpha = 1 - el / EDGE_FADE; fillBlack(); ctx.globalAlpha = 1; }
        else if (totalMs - el < EDGE_FADE) { ctx.globalAlpha = 1 - (totalMs - el) / EDGE_FADE; fillBlack(); ctx.globalAlpha = 1; }

        deliver();
      }

      requestAnimationFrame(frame);
    };

    recorder.start();
    music?.start(); // music plays under the whole clip (intro→body→outro), fading per envelope
    requestAnimationFrame(frame);
  });
}

// ── Record tool compositor ──────────────────────────────────────────────────
// The export path for the `record` tool: a fully-editable INTRO card → the recorded
// camera CLIP → a fully-editable OUTRO card, composited onto ONE canvas in real time.
// Unlike renderTopTail (which fades each card as a single unit), every object animates
// in with its OWN transition (fade / pop / slide / rise / zoom / tilt / …), staggered
// by a per-object delay - and objects on the middle (camera) frame ride over the
// footage as overlays (lower-third, logo bug), entering at the head and leaving at the
// tail. Detected via [data-record-stage].

// The transition vocabulary + its maths live in ../lib/transitions.ts so the timeline
// editing chrome can offer exactly the kinds this compositor implements.

// `ease` is the authored GEOMETRY curve for this object's transition - a preset name
// or a CSS cubic-bezier, '' when unauthored, which is the byte-identical old path.
// Read off the DOM like `transition` itself, so this compositor stays a reader of the
// stage the tool hook stamped rather than a second interpreter of the input model.
interface RecObject { bmp: HTMLCanvasElement | null; x: number; y: number; w: number; h: number; rot: number; transition: string; ease: string; delay: number }

async function renderRecord(node: Element, opts: ExportOpts, preferred: string): Promise<Blob> {
  const stage = ((node as HTMLElement).matches?.('[data-record-stage]')
    ? node
    : node.querySelector('[data-record-stage]')) as HTMLElement | null;
  if (!stage) return renderVideo(node, opts, preferred);

  const introEl = stage.querySelector('[data-record-frame="intro"]') as HTMLElement | null;
  const bodyEl  = stage.querySelector('[data-record-frame="body"]')  as HTMLElement | null;
  const outroEl = stage.querySelector('[data-record-frame="outro"]') as HTMLElement | null;
  if (!introEl || !bodyEl || !outroEl) return renderVideo(node, opts, preferred);

  const mimeType = videoMimeType(preferred, { audio: true }) ?? videoMimeType(preferred);
  if (!mimeType) throw new Error(NO_VIDEO_MSG);

  const introMs = ttNum(stage.dataset.introMs, 2200);
  const outroMs = ttNum(stage.dataset.outroMs, 2400);
  const enterMs = Math.max(120, ttNum(stage.dataset.enterMs, 650));
  const fps = 30;
  const frameMs = 1000 / fps;
  const EDGE_FADE = 260; // ms fade-from/to-black at the very ends

  // Output size: the FRAME's native (layout) size - transform-independent, so pan/zoom
  // in the editor never affects it - optionally scaled up by an explicit export width.
  const frameNativeW = introEl.offsetWidth || 1080;
  const frameNativeH = introEl.offsetHeight || 1920;
  const targetW = Math.round(((opts.width as number) > 0) ? (opts.width as number) : frameNativeW);
  const S = targetW / frameNativeW;
  const targetH = Math.round(frameNativeH * S);

  const introBg = introEl.style.background || getComputedStyle(introEl).backgroundColor || '#0c322c';
  const outroBg = outroEl.style.background || getComputedStyle(outroEl).backgroundColor || '#0c322c';

  // The recorded take (or a dropped clip) lives in the middle frame as [data-record-clip].
  const bodyVideo = bodyEl.querySelector('[data-record-clip]') as HTMLVideoElement | null;
  const clipSrc = bodyVideo && (bodyVideo.currentSrc || bodyVideo.getAttribute('src')) || '';

  // Rasterise each object ONCE, unrotated, at target scale - rotation + transition are
  // applied per frame at composite time. Blob: image URLs are swapped to data: first so
  // dom-to-image can serialise them, then restored.
  const lib = await getDomToImage();
  const rasterBox = async (el: HTMLElement): Promise<HTMLCanvasElement | null> => {
    const bw = Math.max(1, parseFloat(el.style.width) || 1);
    const bh = Math.max(1, parseFloat(el.style.height) || 1);
    try {
      return await lib.toCanvas(el, {
        width: Math.max(1, Math.round(bw * S)), height: Math.max(1, Math.round(bh * S)),
        style: { transform: `scale(${S})`, transformOrigin: 'top left', width: `${bw}px`, height: `${bh}px`, left: '0', top: '0', margin: '0' },
      });
    } catch { return null; }
  };
  const collect = async (frameEl: HTMLElement): Promise<RecObject[]> => {
    const els = [...frameEl.querySelectorAll<HTMLElement>('.lolly-box')];
    const out: RecObject[] = [];
    for (const el of els) {
      const x = (parseFloat(el.style.left) || 0) * S;
      const y = (parseFloat(el.style.top) || 0) * S;
      const w = (parseFloat(el.style.width) || 1) * S;
      const h = (parseFloat(el.style.height) || 1) * S;
      const rot = ((): number => { const m = /rotate\(([-\d.]+)deg\)/.exec(el.style.transform || ''); return m ? parseFloat(m[1]!) : 0; })();
      out.push({
        bmp: await rasterBox(el), x, y, w, h, rot,
        transition: el.dataset.transition || 'fade',
        ease: el.dataset.transitionEase || '',
        delay: Math.max(0, ttNum(el.dataset.delay, 0)),
      });
    }
    return out;
  };
  const restore = await swapBlobUrls(stage);
  let introObjs: RecObject[] = [], bodyObjs: RecObject[] = [], outroObjs: RecObject[] = [];
  try {
    introObjs = await collect(introEl);
    bodyObjs  = await collect(bodyEl);
    outroObjs = await collect(outroEl);
  } finally { restore(); }

  // A dedicated, UN-muted playback of the footage so its audio flows into the mix.
  const play = clipSrc ? document.createElement('video') : null;
  if (play) {
    play.src = clipSrc; play.muted = false; play.playsInline = true; play.preload = 'auto';
    await new Promise<void>((res) => {
      if (play.readyState >= 1) return res();
      play.onloadedmetadata = () => res();
      play.onerror = () => res();
    });
    if (!Number.isFinite(play.duration) || play.duration === 0) {
      await new Promise<void>((res) => {
        const to = setTimeout(res, 1500);
        play.ontimeupdate = () => {
          if (Number.isFinite(play.duration)) { clearTimeout(to); play.ontimeupdate = null; play.currentTime = 0; res(); }
        };
        try { play.currentTime = 1e7; } catch { clearTimeout(to); res(); }
      });
    }
  }
  const TT_MAX_BODY_MS = 120000;
  let durSec = play && Number.isFinite(play.duration) && play.duration > 0 ? play.duration : 0;
  // A clip was recorded but its duration never resolved (a MediaRecorder WebM/MP4 blob
  // can report duration=Infinity/0 across engines). Rather than DROP the body entirely
  // (which would export just the bookends), keep the footage on screen. Prefer the
  // MEASURED take length the recorder stamped on the element (data-clip-ms) - otherwise a
  // long take would be silently truncated to the blind 6s guess - falling back to 6s only
  // when that hint is absent (a dropped-in clip, or the manual Export button).
  if (play && durSec === 0) {
    const hintMs = Number(bodyVideo?.dataset.clipMs);
    const hinted = Number.isFinite(hintMs) && hintMs > 0;
    durSec = hinted ? hintMs / 1000 : 6;
    _host?.log?.('warn', `record: clip duration unresolved - using ${hinted ? `the measured ${Math.round(hintMs)}ms take` : 'a 6s fallback'} for the body.`);
  }
  const bodyMs = Math.min(durSec * 1000, TT_MAX_BODY_MS);
  const totalMs = introMs + bodyMs + outroMs;

  // Prime playback under the caller's user-activation. autoProcessRecording runs this
  // right after the Stop click, but the deferred body-phase play() only fires after a
  // multi-second decode/compositor await that can outlast the activation - a blocked
  // play() would then freeze the footage on frame 0. Playing once now blesses the element
  // so that later play() resumes without a fresh gesture. We keep it UNMUTED (muted is the
  // property the autoplay policy checks, so a muted prime wouldn't grant unmuted resume on
  // stricter engines) but at volume 0 - no audible blip - and restore volume BEFORE
  // captureStream taps the audio below. Best-effort: if autoplay is refused the loop still
  // retries per frame.
  if (play) {
    try { play.volume = 0; await play.play(); play.pause(); play.currentTime = 0; } catch { /* autoplay blocked */ }
    play.volume = 1;
  }

  // Footage audio via the clip element's OWN capture stream - NO WebAudio graph, so no
  // suspended-context / manual-frame-video mux fragility (a resumed AudioContext dest
  // track combined with a requestFrame() video track was producing 0-byte MP4s).
  // captureStream() is non-destructive (unlike createMediaElementSource), silent while
  // `play` is paused (intro/outro) and audible during the body. Fully NON-FATAL: if it's
  // unavailable the video still records, just silently.
  let clipAudioTrack: MediaStreamTrack | null = null;
  if (play) {
    try {
      const el = play as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };
      const capture = el.captureStream ?? el.mozCaptureStream;
      clipAudioTrack = capture ? (capture.call(play).getAudioTracks()[0] ?? null) : null;
    } catch { clipAudioTrack = null; }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW; canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  const { stream, deliver } = manualCaptureStream(canvas, fps);
  if (clipAudioTrack) { try { stream.addTrack(clipAudioTrack); } catch { /* ignore */ } }

  const container = videoContainer(mimeType);
  const recorder = new MediaRecorder(stream, recorderOpts(mimeType, targetW, targetH, fps, !!clipAudioTrack));
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  const fill = (color: string) => { ctx.fillStyle = color; ctx.fillRect(0, 0, targetW, targetH); };
  // Clip fit (data-clip-fit): 'cover' fills the frame (crop); 'contain' fits the whole
  // clip. Default cover. The body phase already fills '#000' before drawCover, so a
  // contained clip letterboxes onto that without any extra fill here.
  const fitContain = stage.dataset.clipFit === 'contain';
  const drawCover = (v: HTMLVideoElement) => {
    const vw = v.videoWidth || targetW, vh = v.videoHeight || targetH;
    const scale = fitContain ? Math.min(targetW / vw, targetH / vh) : Math.max(targetW / vw, targetH / vh);
    const dw = vw * scale, dh = vh * scale;
    ctx.drawImage(v, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh);
  };
  const drawObject = (o: RecObject, p: number): void => {
    if (!o.bmp) return;
    const tr = recTransition(o.transition, p, o.w, o.h, o.ease);
    if (tr.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, tr.alpha));
    ctx.translate(o.x + o.w / 2 + tr.dx, o.y + o.h / 2 + tr.dy);
    if (o.rot || tr.rot) ctx.rotate((o.rot + tr.rot) * Math.PI / 180);
    if (tr.sc !== 1) ctx.scale(tr.sc, tr.sc);
    ctx.drawImage(o.bmp, -o.w / 2, -o.h / 2, o.w, o.h);
    ctx.restore();
  };
  // Intro/outro objects: enter (staggered by delay) then hold for the rest of the phase.
  const drawEntering = (objs: RecObject[], phaseMs: number) => {
    for (const o of objs) drawObject(o, Math.min(1, Math.max(0, (phaseMs - o.delay) / enterMs)));
  };
  // Body overlays: enter at the head, hold, exit near the tail (symmetric - leaves the
  // same way it arrived) so lower-thirds/logo bugs come and go over the footage.
  const drawOverlays = (objs: RecObject[], bodyLocal: number) => {
    const tailStart = bodyMs - enterMs;
    for (const o of objs) {
      const headP = Math.min(1, Math.max(0, (bodyLocal - o.delay) / enterMs));
      const exitP = bodyLocal > tailStart ? Math.min(1, Math.max(0, (bodyLocal - tailStart) / enterMs)) : 0;
      drawObject(o, Math.min(headP, 1 - exitP));
    }
  };

  _host?.log?.('info', `record: compositing intro=${introMs} body=${Math.round(bodyMs)} outro=${outroMs} total=${Math.round(totalMs)} clip=${clipSrc ? 'yes' : 'no'} audio=${clipAudioTrack ? 'yes' : 'no'} objs=${introObjs.length}/${bodyObjs.length}/${outroObjs.length} size=${targetW}x${targetH}`);

  return new Promise<Blob>((resolve, reject) => {
    const cleanup = () => {
      try { stream.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
      try { play?.pause(); } catch { /* ignore */ }
      try { clipAudioTrack?.stop(); } catch { /* ignore */ }
    };
    recorder.onerror = e => { cleanup(); reject((e as { error?: Error }).error ?? new Error('MediaRecorder error')); };
    recorder.onstop = () => {
      cleanup();
      const bytes = chunks.reduce((n, c) => n + c.size, 0);
      _host?.log?.(bytes > 0 ? 'info' : 'warn', `record: encoded ${chunks.length} chunk(s), ${bytes} bytes`);
      resolve(withVideoMeta(new Blob(chunks, { type: container }), container, opts.meta));
    };

    let startT = 0;
    let bodyStarted = false;
    let lastFrame = -Infinity;
    const frame = (now: number): void => {
      if (!startT) startT = now;
      const el = now - startT;
      // Cancel: the rAF tick is this compositor's yield point (see renderTopTail).
      if (opts.signal?.aborted) {
        cleanup();
        reject(opts.signal.reason);
        try { recorder.stop(); } catch { /* already stopping */ }
        return;
      }
      if (el >= totalMs) { try { recorder.stop(); } catch { /* already stopping */ } return; }

      // Composite + hand off one frame per fps tick (wall-clock paced): live footage
      // is sampled at exactly fps and each painted frame is encoded once.
      if (now - lastFrame >= frameMs) {
        lastFrame = now;
        if (el < introMs) {
          fill(introBg);
          drawEntering(introObjs, el);
        } else if (el < introMs + bodyMs) {
          fill('#000');
          if (play && play.readyState >= 2 && !play.ended) {
            if (!bodyStarted) { bodyStarted = true; try { play.currentTime = 0; } catch { /* ignore */ } play.play().catch(() => {}); }
            drawCover(play);
          } else if (play && !bodyStarted) {
            bodyStarted = true; try { play.currentTime = 0; } catch { /* ignore */ } play.play().catch(() => {});
          }
          drawOverlays(bodyObjs, el - introMs);
        } else {
          fill(outroBg);
          drawEntering(outroObjs, el - introMs - bodyMs);
        }

        // Global fade from/to black at the very ends.
        if (el < EDGE_FADE) { ctx.globalAlpha = 1 - el / EDGE_FADE; fill('#000'); ctx.globalAlpha = 1; }
        else if (totalMs - el < EDGE_FADE) { ctx.globalAlpha = 1 - (totalMs - el) / EDGE_FADE; fill('#000'); ctx.globalAlpha = 1; }

        deliver();
      }

      requestAnimationFrame(frame);
    };

    recorder.start();
    requestAnimationFrame(frame);
  });
}

function recordStream(stream: MediaStream, { durationMs = 5000, mimeType = videoMimeType(), audio = null, meta = null, width = 1080, height = 1080, fps = 30 }: { durationMs?: number; mimeType?: string | null; audio?: LoopedAudio | null; meta?: ExportMeta | null; width?: number; height?: number; fps?: number } = {}): Promise<Blob> {
  if (!mimeType) { audio?.stop(); throw new Error(NO_VIDEO_MSG); }
  if (audio) stream.addTrack(audio.track);
  const recorder = new MediaRecorder(stream, recorderOpts(mimeType, width, height, fps, !!audio));
  const chunks: Blob[]   = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onerror = e => { audio?.stop(); reject((e as any).error ?? new Error('MediaRecorder error')); };
    recorder.onstop  = () => {
      audio?.stop();
      const container = videoContainer(mimeType);
      resolve(withVideoMeta(new Blob(chunks, { type: container }), container, meta));
    };
    recorder.start();
    audio?.start();
    setTimeout(() => recorder.stop(), durationMs);
  });
}

// Renders the DOM node as an animated GIF.
//
// Each frame is rendered sequentially via toCanvas() so every GIF frame
// captures a unique animation state - no duplicate or stale frames.
// Recording takes longer than real-time on slow machines, but the output
// plays back at the intended speed because timing is in the GIF delay metadata.
//
// opts.wait - seconds before capture starts (default 1)
// opts.duration - clip length in seconds (default 5)
// opts.dither - Floyd-Steinberg dithering (default false)
async function renderGif(node: Element, opts: ExportOpts): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc') as any;

  const fps           = 15;
  const frameInterval = Math.round(1000 / fps); // 67ms → rounds to 70ms in GIF centiseconds
  const durationMs    = (opts.duration ?? 5) * 1000;
  let   frameCount    = Math.max(1, Math.round(durationMs / frameInterval));
  const dither        = Boolean(opts.dither);

  // Same memory ceiling as renderVideo: duration is URL-bypassable and the GIF
  // encoder buffers every written frame, so clamp to bound memory + warn through
  // the log channel. Generous for normal clips; beyond it the clip is truncated.
  const cap = maxVideoFrames();
  if (frameCount > cap) {
    _host?.log?.('warn', `GIF capped at ${cap} frames (requested ${frameCount}); lower the duration for a longer clip.`);
    frameCount = cap;
  }

  // Shared FrameSource: same sequential, real-time capture as the video path.
  const source  = await createFrameSource(node, opts);
  const targetW = source.width, targetH = source.height;

  const offscreen = document.createElement('canvas');
  offscreen.width  = targetW;
  offscreen.height = targetH;
  const offCtx = offscreen.getContext('2d')!;

  try {
    const gif = GIFEncoder();
    let palette: [number, number, number][] | null = null;

    // Dither scratch buffers are allocated ONCE and reused for every frame: the
    // global palette is fixed after frame 0, so the per-frame ~14MB error buffer
    // and the 64KB nearest-colour cache (previously re-allocated and re-cleared each
    // frame) can persist for the whole clip. The cache stays valid because the
    // palette never changes; output is byte-identical to per-frame allocation.
    const ditherState = dither ? createDitherState(targetW, targetH) : null;

    const repeat = opts.repeat != null ? opts.repeat : 0;
    for (let i = 0; i < frameCount; i++) {
      const canvas = await source.frame(i / frameCount, durationMs / 1000);   // clip length too, so a frame-clock tool paces its own material (see viz-tool-mount)
      offCtx.clearRect(0, 0, targetW, targetH);
      offCtx.drawImage(canvas, 0, 0, targetW, targetH);
      const pixels = offCtx.getImageData(0, 0, targetW, targetH).data;

      if (dither) {
        // Dithering already hides banding, and its reused error/nearest-colour buffers
        // require a STABLE palette - so this path keeps one global palette, built from
        // frame 0 and reused for the whole clip.
        if (i === 0) palette = quantize(pixels, 256);
        const indexed = ditherFloydSteinberg(pixels, targetW, targetH, palette!, ditherState!);
        gif.writeFrame(indexed, targetW, targetH, i === 0 ? { palette, delay: frameInterval, repeat } : { delay: frameInterval });
      } else {
        // No dithering: give EACH frame its own optimal 256-colour table (a local
        // palette) rather than forcing every frame through frame 0's colours. A clip
        // whose palette evolves - fades, colour shifts, live footage - no longer bands
        // back to the first frame. Costs one quantize per frame and a little more size.
        const framePalette = quantize(pixels, 256);
        const indexed = applyPalette(pixels, framePalette);
        gif.writeFrame(indexed, targetW, targetH, i === 0 ? { palette: framePalette, delay: frameInterval, repeat } : { palette: framePalette, delay: frameInterval });
      }
      // Progress for a slow N-frame render (no-op when no listener is wired).
      opts.onProgress?.(i + 1, frameCount);
      opts.signal?.throwIfAborted();      // the finally still disposes the frame source
    }

    gif.finish();
    let bytes = gif.bytesView();
    if (opts.meta) {
      const credit = [opts.meta.description, opts.meta.contact, opts.meta.source].filter(Boolean).join(' · ');
      bytes = withGifComment(bytes, credit);
    }
    return new Blob([bytes], { type: 'image/gif' });
  } finally {
    source.dispose();
  }
}

// Renders the DOM node as an Animated PNG.
//
// Same capture loop as renderGif (shared FrameSource, sequential real-time
// frames, timing lives in the fcTL delay metadata), but each frame stays a
// full-fidelity PNG - no palette quantisation - and the engine's packApng
// splices the encoded frames into one APNG at the chunk level.
//
// opts.wait - seconds before capture starts (default 1)
// opts.duration - clip length in seconds (default 5)
// opts.repeat - loop count: -1 = play once, 0/absent = forever (GIF semantics)
async function renderApng(node: Element, opts: ExportOpts): Promise<Blob> {
  // 15 fps by default; a caller can lower it (opts.fps) to shrink an APNG preview - 
  // fewer frames, smaller file - at the cost of smoothness. Clamped to a sane range.
  const fps           = Math.min(30, Math.max(2, Math.round(opts.fps ?? 15)));
  const frameInterval = Math.round(1000 / fps);
  const durationMs    = (opts.duration ?? 5) * 1000;
  let   frameCount    = Math.max(1, Math.round(durationMs / frameInterval));

  // Same memory ceiling as renderVideo: duration is URL-bypassable and every
  // frame is buffered as an encoded PNG in frames[], so clamp to bound memory +
  // warn through the log channel. Generous for normal clips; beyond it truncated.
  const cap = maxVideoFrames();
  if (frameCount > cap) {
    _host?.log?.('warn', `APNG capped at ${cap} frames (requested ${frameCount}); lower the duration for a longer clip.`);
    frameCount = cap;
  }

  // Shared FrameSource: same sequential, real-time capture as the video path.
  const source  = await createFrameSource(node, opts);
  const targetW = source.width, targetH = source.height;

  // toCanvas() may return a DPR-scaled canvas; normalise every frame to the
  // target size so all encoded PNGs share identical IHDR geometry (packApng
  // rejects mismatched frames).
  const offscreen = document.createElement('canvas');
  offscreen.width  = targetW;
  offscreen.height = targetH;
  const offCtx = offscreen.getContext('2d')!;

  const frames: Uint8Array[] = [];
  try {
    for (let i = 0; i < frameCount; i++) {
      const canvas = await source.frame(i / frameCount, durationMs / 1000);   // clip length too, so a frame-clock tool paces its own material (see viz-tool-mount)
      offCtx.clearRect(0, 0, targetW, targetH);
      offCtx.drawImage(canvas, 0, 0, targetW, targetH);
      const blob = await new Promise<Blob>((res, rej) =>
        offscreen.toBlob(b => b ? res(b) : rej(new Error('APNG frame encode failed')), 'image/png'));
      frames.push(new Uint8Array(await blob.arrayBuffer()));
      // Progress for a slow N-frame render (no-op when no listener is wired).
      opts.onProgress?.(i + 1, frameCount);
      opts.signal?.throwIfAborted();      // the finally still disposes the frame source
    }
  } finally {
    source.dispose();
  }

  // GIF repeat → APNG num_plays: -1 (play once) → 1; 0/absent stays 0 (infinite).
  let bytes = packApng(frames, {
    delayMs: frameInterval,
    loops: opts.repeat === -1 ? 1 : (opts.repeat ?? 0),
  });

  // Stamp DPI + provenance + colour profile exactly as the static PNG path does - 
  // all three helpers splice right after IHDR, which the APNG spec allows (acTL
  // only has to precede the first IDAT, not follow IHDR directly).
  const d = exportDims(node, opts);
  const icc = iccWanted(opts) ? iccProfileBytes(opts.colorProfile) : null;
  if (d.dpi > 0) bytes = insertPngPhys(bytes, d.dpi) || bytes;
  bytes = insertPngMeta(bytes, opts.meta);
  if (icc) bytes = await insertPngIcc(bytes, icc);
  return new Blob([bytes as BlobPart], { type: 'image/png' });
}

// Renders the DOM node as an Animated WebP.
//
// Same capture loop as renderGif/renderApng (shared FrameSource, sequential
// real-time frames, timing in the ANMF duration field), but each frame is a
// still WebP from the browser's native canvas.toBlob('image/webp') encoder, and
// the engine's packWebpAnim muxes the extracted VP8/VP8L(+ALPH) bitstreams into
// one animated RIFF/WEBP - full colour + alpha, smaller than GIF or APNG, and no
// new dependency (the browser compresses, the engine assembles the container).
//
// opts.wait - seconds before capture starts (default 1)
// opts.duration - clip length in seconds (default 5)
// opts.fps - frames/sec (default 15, clamped 2..30, matches renderApng)
// opts.quality - per-frame WebP quality 0..1 (default 0.9, matches renderBitmap)
// opts.repeat - loop count: -1 = play once, 0/absent = forever (GIF semantics)
async function renderWebpAnim(node: Element, opts: ExportOpts): Promise<Blob> {
  const fps           = Math.min(30, Math.max(2, Math.round(opts.fps ?? 15)));
  const frameInterval = Math.round(1000 / fps);
  const durationMs    = (opts.duration ?? 5) * 1000;
  let   frameCount    = Math.max(1, Math.round(durationMs / frameInterval));

  const cap = maxVideoFrames();
  if (frameCount > cap) {
    _host?.log?.('warn', `Animated WebP capped at ${cap} frames (requested ${frameCount}); lower the duration for a longer clip.`);
    frameCount = cap;
  }

  const source  = await createFrameSource(node, opts);
  const targetW = source.width, targetH = source.height;

  // Normalise every frame to the target size so all encoded WebPs share geometry.
  const offscreen = document.createElement('canvas');
  offscreen.width  = targetW;
  offscreen.height = targetH;
  const offCtx = offscreen.getContext('2d')!;
  const quality = opts.quality ?? 0.9;

  const frames: Uint8Array[] = [];
  try {
    for (let i = 0; i < frameCount; i++) {
      const canvas = await source.frame(i / frameCount, durationMs / 1000);   // clip length too, so a frame-clock tool paces its own material (see viz-tool-mount)
      offCtx.clearRect(0, 0, targetW, targetH);
      offCtx.drawImage(canvas, 0, 0, targetW, targetH);
      const blob = await new Promise<Blob>((res, rej) =>
        offscreen.toBlob(b => b ? res(b) : rej(new Error('WebP frame encode failed')), 'image/webp', quality));
      // A browser without WebP canvas encoding silently yields image/png here.
      if (!/webp/.test(blob.type)) throw new Error('This browser cannot encode WebP; export as GIF or APNG instead.');
      frames.push(new Uint8Array(await blob.arrayBuffer()));
      opts.onProgress?.(i + 1, frameCount);
      opts.signal?.throwIfAborted();      // the finally still disposes the frame source
    }
  } finally {
    source.dispose();
  }

  // GIF repeat → WebP loop_count: -1 (play once) → 1; 0/absent stays 0 (infinite).
  const bytes = packWebpAnim(frames, {
    width: targetW, height: targetH,
    delayMs: frameInterval,
    loops: opts.repeat === -1 ? 1 : (opts.repeat ?? 0),
  });
  return new Blob([bytes as BlobPart], { type: 'image/webp' });
}

// Each animated-SVG frame is a FULL vector snapshot (heavier than a raster frame and
// stacked verbatim in the file), so default to a lower rate and cap well below the
// raster ceiling - a flipbook is meant to stay scalable and self-contained, not to
// rival a 30fps video.
const MAX_SVG_ANIM_FRAMES = 150;

// Renders the DOM node as a self-contained animated SVG (a vector "flipbook").
//
// Unlike gif/apng/webp-anim (which sample the canvas to RASTER frames), this samples
// each moment to a VECTOR snapshot via renderSvgFromHtml - text stays outlined, so the
// result scales to any size with no codec and no external runtime. The snapshots are
// stacked as <g> layers and an embedded step-end @keyframes cross-cuts exactly one
// visible per slice (svg-anim-core assembleAnimatedSvg). Capture semantics match the
// raster animated path: settle once, then walk sequentially - the real-time animation
// advances between the (slow) walks, so every frame is a distinct moment; playback
// timing lives in the flipbook CSS, not in when we happened to capture.
//
// opts.fps - frames/sec (default 10, clamped 2..24; lower than raster on purpose)
// opts.duration - clip length in seconds (default 5)
// opts.repeat - loop count: -1 = play once, 0/absent = forever (GIF semantics)
async function renderSvgAnim(node: Element, opts: ExportOpts): Promise<Blob> {
  const fps           = Math.min(24, Math.max(2, Math.round(opts.fps ?? 10)));
  const frameInterval = Math.round(1000 / fps);
  const durationMs    = (opts.duration ?? 5) * 1000;
  let   frameCount    = Math.max(1, Math.round(durationMs / frameInterval));

  if (frameCount > MAX_SVG_ANIM_FRAMES) {
    _host?.log?.('warn', `Animated SVG capped at ${MAX_SVG_ANIM_FRAMES} frames (requested ${frameCount}); lower the duration or frame rate.`);
    frameCount = MAX_SVG_ANIM_FRAMES;
  }

  // Let CSS animations settle once before the first snapshot (mirrors createFrameSource).
  await new Promise<void>(r => setTimeout(r, (opts.wait ?? 1) * 1000));

  // Per-frame snapshot opts: keep the caller's convert-paths choice (vector text by
  // default) but never let the still-SVG metadata be injected per frame - provenance
  // is added ONCE at assembly.
  const frameOpts: ExportOpts = { ...opts, meta: undefined, onProgress: undefined };
  const ser = new XMLSerializer();
  const frames: string[] = [];
  let widthAttr = '', heightAttr = '', viewBox = '';

  for (let i = 0; i < frameCount; i++) {
    const xml = await (await renderSvgFromHtml(node, frameOpts)).text();
    const svg = new DOMParser().parseFromString(xml, 'image/svg+xml').documentElement;
    if (i === 0) {
      widthAttr  = svg.getAttribute('width')  || '';
      heightAttr = svg.getAttribute('height') || '';
      viewBox    = svg.getAttribute('viewBox') || `0 0 ${widthAttr} ${heightAttr}`;
    }
    let inner = '';
    for (const child of Array.from(svg.childNodes)) inner += ser.serializeToString(child);
    frames.push(inner);
    opts.onProgress?.(i + 1, frameCount);
    opts.signal?.throwIfAborted();      // no encoder or frame source to unwind here
  }

  const svg = assembleAnimatedSvg({
    frames, widthAttr, heightAttr, viewBox,
    frameMs: frameInterval,
    loops: opts.repeat === -1 ? 1 : (opts.repeat ?? 0),
    meta: opts.meta ? { description: opts.meta.description, source: opts.meta.source, contact: opts.meta.contact } : null,
  });
  return new Blob([svg], { type: 'image/svg+xml' });
}

interface DitherState { out: Uint8Array; buf: Float32Array; cache: Int16Array; }

// Allocates the reusable scratch buffers for the Floyd-Steinberg path. Hoisted out
// of ditherFloydSteinberg so an animated GIF can keep ONE set of buffers across all
// frames: the error buffer is re-seeded from each frame's pixels, and the nearest
// -colour cache is carried over (the palette is fixed after frame 0, so cached
// lookups stay correct). `out` is fully overwritten every frame, so no reset needed.
function createDitherState(width: number, height: number): DitherState {
  const n = width * height;
  return {
    out:   new Uint8Array(n),
    buf:   new Float32Array(n * 3),       // diffused error, may exceed [0,255]
    cache: new Int16Array(32768).fill(-1), // 15-bit (5 bits/channel) nearest cache
  };
}

// Floyd-Steinberg ordered dithering.
// Quantizes pixels to the given palette while propagating quantisation error
// to neighbouring pixels to reduce colour banding. Returns a Uint8Array of
// palette indices, matching the layout expected by gifenc's writeFrame().
//
// Cache note: nearest-palette lookups are memoised by a 15-bit colour key
// (5 bits per channel). This trades a tiny amount of precision for a large
// speed improvement - especially effective for flat-colour brand graphics.
//
// `state` (from createDitherState) lets a multi-frame caller reuse the buffers
// across frames; absent, a fresh set is allocated for this single call.
function ditherFloydSteinberg(data: Uint8ClampedArray, width: number, height: number, palette: [number, number, number][], state?: DitherState | null): Uint8Array {
  const n   = width * height;
  const st  = state ?? createDitherState(width, height);
  const out = st.out;

  // Float RGB buffer - accumulates diffused error beyond [0,255]. Re-seeded from
  // this frame's pixels (so a reused buffer carries no error from the prior frame).
  const buf = st.buf;
  for (let i = 0; i < n; i++) {
    buf[i * 3]     = data[i * 4]!;
    buf[i * 3 + 1] = data[i * 4 + 1]!;
    buf[i * 3 + 2] = data[i * 4 + 2]!;
  }

  // Nearest-palette memoisation keyed on a 5-bit-per-channel approximation.
  // Persisted across frames via `state` - valid because the palette is fixed.
  const cache = st.cache;
  function nearest(r: number, g: number, b: number): number {
    const key = (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10);
    if (cache[key]! >= 0) return cache[key]!;
    let best = 0, bestD = Infinity;
    for (let c = 0; c < palette.length; c++) {
      const pc = palette[c]!;
      const d  = (r - pc[0]) ** 2 + (g - pc[1]) ** 2 + (b - pc[2]) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    return (cache[key] = best);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const p = i * 3;

      const r = Math.round(Math.max(0, Math.min(255, buf[p]!)));
      const g = Math.round(Math.max(0, Math.min(255, buf[p + 1]!)));
      const b = Math.round(Math.max(0, Math.min(255, buf[p + 2]!)));

      const idx    = nearest(r, g, b);
      out[i]       = idx;

      const pc = palette[idx]!;
      const er = r - pc[0];
      const eg = g - pc[1];
      const eb = b - pc[2];

      // Diffuse error: right=7/16, bottom-left=3/16, bottom=5/16, bottom-right=1/16
      if (x + 1 < width) {
        const q = p + 3;
        buf[q] = buf[q]! + er * 0.4375; buf[q+1] = buf[q+1]! + eg * 0.4375; buf[q+2] = buf[q+2]! + eb * 0.4375;
      }
      if (y + 1 < height) {
        if (x > 0) {
          const q = p + width * 3 - 3;
          buf[q] = buf[q]! + er * 0.1875; buf[q+1] = buf[q+1]! + eg * 0.1875; buf[q+2] = buf[q+2]! + eb * 0.1875;
        }
        const q0 = p + width * 3;
        buf[q0] = buf[q0]! + er * 0.3125; buf[q0+1] = buf[q0+1]! + eg * 0.3125; buf[q0+2] = buf[q0+2]! + eb * 0.3125;
        if (x + 1 < width) {
          const q1 = p + width * 3 + 3;
          buf[q1] = buf[q1]! + er * 0.0625; buf[q1+1] = buf[q1+1]! + eg * 0.0625; buf[q1+2] = buf[q1+2]! + eb * 0.0625;
        }
      }
    }
  }

  return out;
}

// Injects a watermark stamp directly on the live node and returns a cleanup fn.
// Using a live overlay (not a detached clone) keeps getComputedStyle working,
// which is required by dom-to-image-more and captureStream-based video capture.
function addWatermarkOverlay(node: HTMLElement): () => void {
  const stamp = document.createElement('div');
  // One localised word so a local team reads what it's looking at. English source
  // doubles as the i18n key; tRaw because this is a textContent (not HTML) sink.
  stamp.textContent = tRaw('DRAFT');
  // EXPLICIT px size, not inset:0. dom-to-image clones the node into a foreignObject
  // and re-lays-it-out; an absolute child sized only by inset:0 collapses to 0×0 in
  // that clone (visible live, absent in the raster). A concrete width/height from the
  // live node can't collapse, so the mark reaches every format.
  const rect = node.getBoundingClientRect();
  const w = node.offsetWidth || rect.width;
  const h = node.offsetHeight || rect.height;
  // Big centred word, sized to the node and NEVER wrapping. W/7 lets "DRAFT" (~0.4W)
  // and longer localisations (e.g. ENTWURF ~0.6W) both sit inside the frame; a rare
  // very long word overflows rather than wraps - acceptable for a destructive mark.
  const fontSize = Math.max(14, w / 7);
  Object.assign(stamp.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${w}px`,
    height: `${h}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    background: 'none',
    color: 'rgba(118, 118, 118, 0.5)',
    font: `bold ${fontSize}px monospace`,
    pointerEvents: 'none',
    zIndex: '9999',
  });
  const prevPosition = node.style.position;
  if (!node.style.position) node.style.position = 'relative';
  node.appendChild(stamp);
  return () => {
    stamp.remove();
    node.style.position = prevPosition;
  };
}

// Editor-only chrome (size previews, guides, safe-area overlays) opts out of EVERY
// export by tagging itself [data-export-hide]. We detach those nodes for the
// duration of the render and put them back exactly where they were - so no export
// path (raster, SVG, PDF, …) can pick them up regardless of how it reads the DOM,
// and the live editor is untouched afterwards. Mirrors the watermark overlay's
// add/remove-in-finally discipline above.
//
// ⚑ ONE EXEMPTION: `[data-cam]` - the plans/104 section 5.4 CAMERA MARKER. It wears
// `data-export-hide` for the same reason everything else here does (nothing may draw
// it), but it is not chrome: it is the MODEL element both evaluators key their camera
// branch off. `layerKind` (sequence-plan) and `readTiming` (sequence-dom) ask the LIVE
// tree for `[data-cam]` INSIDE the render - the compositor when it parses the stage,
// and `renderSequenceCuts` when its session poses each cut - so detaching it deletes
// the camera out from under them mid-export. Measured before this exemption existed,
// on a 4 s push-in over four layers at z 0/80/160/240: through `renderSequence`
// directly every layer parallaxed (40.2 / 47.1 / 55.7 / 66.4 px, matching the engine
// to 0.4 px); through THIS funnel - the one every real export takes - all four moved
// 0.0 px and the file fell from 230,632 B to 35,691 B, because a still picture
// compresses to nothing. The contact sheet showed the second half of the same wound:
// with no `[data-cam]` to find, the camera BOX stopped being `kind: 'camera'` and was
// posed as an ordinary lifted layer, its dolly track read as depth.
// Leaving it attached costs nothing: every walker skips `display: none` (both
// design copies ship `.lolly-box-cam { display: none }` in styles.css), the
// marker has no fill and no children, and the plates loop skips `camera` layers by
// kind. Keyed on the ATTRIBUTE, not the class, because the attribute is what the
// hooks promise and what both evaluators match on.
function detachExportHidden(node: Element): () => void {
  if (!node?.querySelectorAll) return () => {};
  const marked = [...node.querySelectorAll('[data-export-hide]:not([data-cam])')]
    // Keep only the outermost when nested, so each re-insertion parent still exists.
    .filter(el => !el.parentElement?.closest('[data-export-hide]:not([data-cam])'));
  const slots = marked.map(el => ({ el, parent: el.parentNode, next: el.nextSibling }));
  slots.forEach(({ el }) => el.remove());
  // Restore in REVERSE document order: a marked node's saved `next` may be ANOTHER
  // marked node (an editor stage's .fc-overlay / .fc-toolbar-dock / .tl-panel are
  // adjacent siblings), and every one of them is detached before any is put back - 
  // forward order then throws insertBefore's NotFoundError. Going backwards puts
  // the reference sibling in first. The parentNode re-check covers the other way
  // the anchor rots: the live tool re-rendering during the awaits inside a render.
  return () => {
    for (let i = slots.length - 1; i >= 0; i--) {
      const { el, parent, next } = slots[i]!;
      if (!parent) continue;
      const ref = next && next.parentNode === parent ? next : null;
      (parent as any).insertBefore(el, ref);
    }
  };
}

// ── Text-based export formats ─────────────────────────────────────────────────

// Standalone HTML document with the tool's template CSS and baked-in content.
// The fitting script is stripped - the computed font-size is already on the element.
//
// opts.fullPage drops the fixed-size tool-canvas frame: the canvas div is the
// shell's preview box, so we promote its content straight into the document body
// and let it fill the whole page (no centring, no neutral backdrop). The default
// keeps the canvas as a centred, fixed-size card on a grey backdrop.
function renderStaticHtml(node: Element, opts: ExportOpts = {}): Blob {
  const styles = [...node.querySelectorAll('style')].map(s => s.textContent).join('\n');
  const clone = node.cloneNode(true) as Element;
  clone.querySelectorAll('style, script').forEach(el => el.remove());
  // Full-page: give html/body a definite full-viewport height so a promoted root
  // that sizes itself to height:100% (e.g. bag-video's .scene) resolves against the
  // viewport instead of collapsing to zero (which rendered a blank white page);
  // min-height keeps taller, flowing content able to extend the page.
  const modeCss = opts.fullPage
    ? `html, body { height: 100%; }\nbody { min-height: 100dvh; }`
    : `body { display: flex; align-items: center; justify-content: center; min-height: 100dvh; background: #555; padding: 16px; }`;
  const content = opts.fullPage ? clone.innerHTML : clone.outerHTML;
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; }
${modeCss}
${styles}
</style>
</head>
<body>
${content}
</body>
</html>`;
  return new Blob([doc], { type: 'text/html' });
}

interface DomHandlers {
  text: (t: string) => string;
  br?: () => string;
  element?: (tag: string, inner: string, node: Element) => string;
}

// Recursive DOM walker shared by markdown and plain-text exports.
// Skips aria-hidden elements, <style>, <script>, and <img>.
function walkDom(node: Node, handlers: DomHandlers): string {
  if (node.nodeType === 3) return handlers.text(node.textContent as string);
  if (node.nodeType !== 1) return '';
  const elNode = node as Element;
  if (elNode.getAttribute('aria-hidden') === 'true') return '';
  const tag = elNode.tagName.toLowerCase();
  if (tag === 'style' || tag === 'script' || tag === 'img') return '';
  if (tag === 'br') return handlers.br?.() ?? '\n';
  const inner = [...node.childNodes].map(n => walkDom(n, handlers)).join('');
  return handlers.element?.(tag, inner, elNode) ?? inner;
}

// ── HTML DOM → Markdown ───────────────────────────────────────────────────────
// A structural serializer (headings, nested lists, GFM tables, code, blockquote,
// hr, links, emphasis) so ANY text tool that declares the `md` format gets a
// faithful markdown export from its rendered DOM - no per-tool serializer needed.
// (Tools wanting model-derived, CLI-working output ship a template.md instead.)
const mdSkip = (el: Element): boolean =>
  el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('data-export-hide');
function mdFenceFor(code: string): string {
  let longest = 0, run = 0;
  for (const ch of code) { if (ch === '`') { if (++run > longest) longest = run; } else run = 0; }
  return '`'.repeat(Math.max(3, longest + 1));
}
/** Inline serialization: text + emphasis + code + links. */
function mdInlineDom(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? '';
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  if (mdSkip(el)) return '';
  const tag = el.tagName.toLowerCase();
  if (tag === 'br') return '  \n';
  if (tag === 'style' || tag === 'script' || tag === 'img') return '';
  const inner = [...el.childNodes].map(mdInlineDom).join('');
  switch (tag) {
    case 'strong': case 'b': return inner.trim() ? `**${inner}**` : '';
    case 'em': case 'i': return inner.trim() ? `*${inner}*` : '';
    case 'del': case 's': return inner.trim() ? `~~${inner}~~` : '';
    case 'code': return inner ? '`' + inner + '`' : '';
    case 'a': { const h = el.getAttribute('href'); return h && /^(https?:|mailto:|#|\/)/i.test(h) ? `[${inner}](${h})` : inner; }
    default: return inner;
  }
}
function mdListDom(el: Element, ordered: boolean, depth: number): string {
  const indent = '  '.repeat(depth);
  let out = '', n = 0;
  for (const li of [...el.children]) {
    if (li.tagName.toLowerCase() !== 'li' || mdSkip(li)) continue;
    n++;
    let lead = '', nested = '';
    for (const c of [...li.childNodes]) {
      const ct = c.nodeType === 1 ? (c as Element).tagName.toLowerCase() : '';
      if (ct === 'ul' || ct === 'ol') nested += mdListDom(c as Element, ct === 'ol', depth + 1);
      else lead += mdInlineDom(c);
    }
    out += indent + (ordered ? `${n}. ` : '- ') + lead.trim() + '\n' + nested;
  }
  return out;
}
function mdTableDom(el: Element): string {
  const rows = [...el.querySelectorAll('tr')];
  if (!rows.length) return '';
  const cellsOf = (tr: Element): string[] => [...tr.children]
    .filter(c => /^(td|th)$/.test(c.tagName.toLowerCase()))
    .map(c => mdInlineDom(c).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim());
  const grid = rows.map(cellsOf);
  const cols = Math.max(...grid.map(r => r.length));
  let out = '';
  grid.forEach((r, ri) => {
    while (r.length < cols) r.push('');
    out += '| ' + r.join(' | ') + ' |\n';
    if (ri === 0) out += '| ' + Array(cols).fill('---').join(' | ') + ' |\n';
  });
  return out + '\n';
}
const MD_BLOCK_TAGS = /^(h[1-6]|p|ul|ol|table|blockquote|pre|hr|div|section|article|header|footer|main|figure|figcaption|li)$/;
function mdBlockDom(node: Node, depth = 0): string {
  if (node.nodeType === 3) { const t = (node.textContent ?? '').replace(/\s+/g, ' '); return t.trim() ? t.trim() + '\n\n' : ''; }
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  if (mdSkip(el)) return '';
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'style': case 'script': case 'img': case 'br': return '';
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
      const t = mdInlineDom(el).trim(); return t ? '#'.repeat(+tag[1]!) + ' ' + t + '\n\n' : '';
    }
    case 'p': { const t = mdInlineDom(el).trim(); return t ? t + '\n\n' : ''; }
    case 'blockquote': {
      const inner = [...el.childNodes].map(c => mdBlockDom(c)).join('').trim();
      return inner ? inner.split('\n').map(l => l ? '> ' + l : '>').join('\n') + '\n\n' : '';
    }
    case 'pre': { const code = el.textContent ?? ''; const f = mdFenceFor(code); return f + '\n' + code.replace(/\n+$/, '') + '\n' + f + '\n\n'; }
    case 'hr': return '---\n\n';
    case 'ul': return mdListDom(el, false, depth) + (depth === 0 ? '\n' : '');
    case 'ol': return mdListDom(el, true, depth) + (depth === 0 ? '\n' : '');
    case 'table': return mdTableDom(el);
    default: {
      // A container: recurse if it holds block children, else treat it as one paragraph.
      const hasBlockChild = [...el.children].some(c => MD_BLOCK_TAGS.test(c.tagName.toLowerCase()));
      if (!hasBlockChild) { const t = mdInlineDom(el).trim(); return t ? t + '\n\n' : ''; }
      return [...el.childNodes].map(c => mdBlockDom(c, depth)).join('');
    }
  }
}
function renderMarkdown(node: Element): Blob {
  const md = mdBlockDom(node).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return new Blob([md + '\n'], { type: 'text/markdown' });
}

function renderPlainText(node: Element): Blob {
  const handlers: DomHandlers = {
    text: t => t,
    br: () => '\n',
    element(tag, inner) {
      const s = inner.trim();
      switch (tag) {
        case 'p':  return s ? s + '\n\n' : '';
        case 'h1': case 'h2': case 'h3': return s ? s + '\n\n' : '';
        case 'blockquote': return s ? s + '\n\n' : '';
        default:   return inner;
      }
    },
  };
  const text = walkDom(node, handlers).replace(/\n{3,}/g, '\n\n').trim();
  return new Blob([text + '\n'], { type: 'text/plain' });
}
