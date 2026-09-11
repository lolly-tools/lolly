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

import { sfntKind, LOSSLESS_STRENGTH, C2PA_FORMATS, embedWavInfo, writeDocx, writeOdt, hdrBoostToPQ, pqBt2020IccProfile, iccProfileBytes, HDR_PQ_CICP, packTiff, CSS_DPI, encodeBmp, rgbToCmyk, cmykCondition, toPixels, parseDimension, toCssLength, gzip, emitEmf, emitWmf, emitEps, emitDxf, toPoints, computePrintGeometry, buildEncryptDictValues, preparePassword, encryptObjectBytes, exportActionSteps, embedC2pa, ENGINE_VERSION, buildExportMeta, SCREEN_SOURCE_TYPE, CAPTURE_SOURCE_TYPE, extractC2paStore, roundedRectPath, splitCssArgs, insetCorners, uniformRadius, parseCssMatrix, isAxisAlignedMat, isNonAffineTransform, parseClipShape, parseBoxShadow, gaussianShadowBands, parseTextShadow, videoProvenanceTags, embedMp4Meta, embedWebmMeta, crc32, buildEncryptedZip, hdrViewTransform, fromU8Srgb, pqToI420P10, pqEncodeFrame, packApng, packWebpAnim } from '@lolly/engine';
import type { HdrBoostOptions, Mat2D } from '@lolly/engine';
import { letterSpacingPx, featureSettingsToHb, canVectoriseText, textBaselineY, textStrokeAttrs, suseFontFile, SUSE_FONT_DIR } from './text-svg.ts';
import { resolveVectorFont } from './font-registry.ts';
import type { VectorFont } from './font-registry.ts';
import { bakeWebKitBoxShadows } from './webkit-shadow-bake.ts';
import { newNeutraliseGuard, neutraliseTransform } from './transform-neutralise.ts';
import { svgDomToIr, decomposeAffine, parseTransformList } from './svg-ir.ts';
import { placeBackground } from './bg-layout.ts';
import { unscopeStyleEls } from '../lib/scope-css.ts';
import { tRaw } from '../i18n.ts';
import { assembleAnimatedSvg } from '../lib/svg-anim-core.ts';
import { recTransition } from '../lib/transitions.ts';
import { suspendNodeRasters, drainNodeRasters } from '../lib/clip-thumbs.ts';
import { RASTER_DEFAULT_SCALE } from './export-scale.ts';
import { videoMimeCandidates, AUDIO_FRAME_HEADROOM, videoBitrate, videoFramePlan, bppForQuality, codecAdjustedBitrate, LIVE_BITS_PER_PIXEL } from './video-mime.ts';
import { bedDuckEnvelope, scheduleGainEvents } from './audio-envelope.ts';
import type { ExportAudioMixIn } from './audio-envelope.ts';
import { encodeMuxWebCodecs } from './video-encode-core.ts';
import type { EncodeAudio, EncodePick } from './video-encode-core.ts';
import { pickWebCodecsVideo, is10bitHdrCodec, pickWebCodecsAudio, HDR_VF_COLORSPACE } from './video-shared.ts';
import type { AudioPick } from './video-shared.ts';
import { supportsWorkerVideoEncode, encodeVideoInWorker } from './video-encode.ts';
import { canRecord } from './format-support.ts';
import type { AudioPcm, AudioFormat } from '../lib/audio-encode.ts';
import { buildAudioTags } from '../lib/audio-tags.ts';
import { createStaticChromeGuard, staticChromeVerdict, chromePaintsOverLive, countToolMutations, staticChromeFrameAction } from './frame-static.ts';
import type { Box, ChromeEl } from './frame-static.ts';
import { buildExportPack, renderLinuxPackage } from './export-linux-package.ts';
import { createDownload } from './download.ts';
import { packIco } from './ico-pack.ts';
import type { ExportMeta, IngredientCredential, HostV1, C2paSignOpts } from '@lolly-tools/core/host-v1';
import type { C2paActionInput } from '../../../../engine/src/c2pa.ts';
import type { LabelSlot, PrintGeometry } from '../../../../engine/src/print-marks.ts';
import type { CornerRadii, CornerPair } from '../../../../engine/src/css-box.ts';
import { n2, parseCssColorFull, resolveRadii, parseCssColor, objectPositionFractions, parseCssLen } from './export-css.ts';
import { renderPptx, sourceAuthorOf } from './export-pptx.ts';
import { domToRichDoc, domToDocBlocks } from './doc-blocks.ts';
import { insertWebpMeta, insertAvifExif, iccWanted, insertPngPhys, insertPngMeta, insertPngXmp, insertPngCicp, insertPngIcc, patchJpegDpi, insertJpegExif, insertJpegXmp, insertJpegIcc, setAvifCicp, injectSvgMeta, inflateBytes, deflateBytes, withGifComment } from './export-image-meta.ts';
import { pureRotationDeg, buildCmykPaletteMap, cmykKey, applyTextTransform, brandSwatchPalette, parseSvgColor, blendSvgWithWhite, drawSvgPathToPdf, svgLen, withPdfRotation, withPdfMatrix, pdfApplyClip, withPdfAlpha, pdfRoundedRect, pdfGradientSpec, fillPdfShading, withPdfRoundedClip, sampleGradientMidpoint, borderDashArray, withPdfClipRect, assignSpotResourceNames, substitutePdfRgb, OVERPRINT_GS_DEFS, paletteHitKey } from './export-pdf-vector.ts';
import type { PaletteHit, BrandPaletteEntry } from './export-pdf-vector.ts';
import { applyPdfX } from './export-pdfx.ts';
import { createPdfDoc } from './export-pdf-doc.ts';
import { isOwnProfile, resolveEmbeddedProfile } from '../lib/press-profile-embed.ts';
import type { EmbedResolution } from '../lib/press-profile-embed.ts';
import { _host, imprintCanvas, exportDims, getDomToImage, swapBlobUrls, fontMetricsPx, blobToDataUrl, MAX_RASTER_PX, makeRoundedFill, setExportHost } from './export-shared.ts';
import type { WebHost, ExportOpts, ExportDims, DtoRenderOpts, ImprintState, Rgba } from './export-shared.ts';
import { renderSvgFromHtml, stripCommentNodes, inlineBlobUrlsInEl, inlineSvgFromImg, imprintEmbedCanvas, isPaintSkipped, rotationPivot, rasterizePosedNodeToDataUrl, effectSpillCss, detectUnsupportedCss, rasterizeNodeToDataUrl, firstCssUrl, cssUrlToHref, bakeImageFilter, visualLines, mergeDeco, decoFlags, pseudoDescriptor } from './export-svg-walker.ts';
import type { Deco } from './export-svg-walker.ts';
import { buildLinearGradientEl, buildRadialGradientEl } from './export-gradients.ts';

export { videoSupport, cmykTiffSupport, tiffSupport } from './format-support.ts';
export { _host, __setDomToImageForTest, fontMetricsPx } from './export-shared.ts';
export type { ImprintState, ExportOpts } from './export-shared.ts';
export { buildLinearGradientEl, conicFanEl, buildRadialGradientEl } from './export-gradients.ts';
export { imprintEmbedCanvas, stripCommentNodes, parseBackdropBlurPx, detectUnsupportedCss, effectSpillCss, renderSvgFromHtml, decoFlags, mergeDeco, isReplaced, renderedChildren, hasOwnBox, visualLines, rasterizeNodeToDataUrl, rasterizePosedNodeToDataUrl, inlineSvgFromImg, inlineBlobUrlsInEl } from './export-svg-walker.ts';
export type { Deco } from './export-svg-walker.ts';

// Moved to export-pdf-vector.ts; re-exported because export-pptx.ts imports it from here.
// renderSvg/renderEmf/renderEps/renderDxf: the per-format entry points, exported
// only for the byte-exact golden suite (export-format-golden.test.ts).
export { pureRotationDeg, renderSvg, renderEmf, renderEps, renderDxf };

// ── Local types ─────────────────────────────────────────────────────────────
type Rgb = [number, number, number];
type LabelsRecord = Partial<Record<LabelSlot, string>>;

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
/** Surface one export-status line to the user through the registered sink (aria-live
 *  announce + the export card's [data-export-degraded] note), or nothing when no sink
 *  is registered (a direct caller). Lets a format module - e.g. the .penpot export's
 *  report - reach the person, not only host.log (plans/222 item B). */
export function _exportNotice(msg: string): void { if (msg) _exportNoticeSink?.(msg); }

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
  setExportHost(host);
  return {
    async render(node: Element, format: string, opts: ExportOpts = {}): Promise<Blob> {
      const unavailable = node.matches('[data-export-error]') ? node : node.querySelector('[data-export-error]');
      if (unavailable) throw new Error(unavailable.getAttribute('data-export-error') || 'The tool is not ready to export.');
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

    download: createDownload(anchorSave),

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
  // annotateTemplate leaves click-to-focus / paint markers on the LIVE <svg> (the web
  // keeps data-canvas-input live for click-to-focus, so the live node cannot be
  // stripped); they are inert noise in a standalone .svg file. Remove them from the
  // CLONE only. The .penpot export is a separate path (export-penpot.ts) that KEEPS
  // data-lolly-bind, so this never touches it (plans/222 item E).
  for (const attr of ['data-canvas-input', 'data-lolly-paint', 'data-lolly-bind']) {
    if (clone.hasAttribute?.(attr)) clone.removeAttribute(attr);
    clone.querySelectorAll(`[${attr}]`).forEach((el) => { el.removeAttribute(attr); });
  }
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


// Render the artwork to a PDF blob. Without geometry the page is the trim size
// and the design fills it (unchanged legacy behaviour, incl. the optional
// standard-tier lock). With geometry the page is the full sheet and the design is
// drawn (scaled) into the bleed box; page boxes + marks are added in a later pass.
async function renderArtworkPdf(node: Element, opts: ExportOpts, geo: PrintGeometry | null): Promise<Blob> {
  // Page size in points (1/72"). Physical units convert exactly; px maps via
  // the CSS 96-DPI convention, preserving existing pixel-based tools.
  const d = exportDims(node, opts);
  const trimW = toPoints(d.w);
  const trimH = toPoints(d.h);
  const pageW = geo ? geo.page.w : trimW;
  const pageH = geo ? geo.page.h : trimH;
  const art   = geo ? geo.artwork : { x: 0, y: 0, w: trimW, h: trimH };

  // orientation must be derived from the actual dimensions - a 'portrait' writer
  // swaps format[0] and format[1] when width > height, which would produce an
  // inverted page with all drawHtmlVectors coordinates wrong.
  const orientation = pageW >= pageH ? 'landscape' : 'portrait';

  // A non-empty opts.password locks the PDF on open with the standard security
  // handler (user = owner password; printing-only permissions). Only the plain
  // RGB path with NO print finishing encrypts - print marks/boxes are applied by
  // a later pdf-lib pass, which can't reopen an encrypted PDF, so the two are
  // mutually exclusive (the UI hides the password field when marks/bleed are on).
  // `undefined` is a no-op (the document ships unencrypted).
  const encryption = (opts.password && !geo)
    ? { userPassword: opts.password, ownerPassword: opts.password, userPermissions: ['print'] }
    : undefined;
  const pdf = await createPdfDoc({ format: [pageW, pageH], orientation, encryption });
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

  logPdfWarnings(pdf);
  return await pdf.output('blob') as Blob;
}

// Anything the writer could not do (an image that would not decode, a font file
// it could not embed) reaches the user through the host log, not silence.
function logPdfWarnings(pdf: { takeWarnings?: () => string[] }): void {
  for (const msg of pdf.takeWarnings?.() ?? []) _host?.log?.('warn', msg);
}

// Stamp the document-info dictionary (creator/author/title/…) onto a document.
// Shared by the single-page and multi-page paths.
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
// over already-finished PDF bytes. Unlike the standard-tier 40-bit RC4 `password`
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
      // Encryption and pdf-lib post-processing are mutually exclusive:
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
  // Lock on open with the standard security handler. An encrypted document and
  // the pdf-lib marks pass are mutually exclusive, so encrypt ONLY when there is
  // no geometry (mirrors renderArtworkPdf). undefined is a no-op (unencrypted).
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
  const pdf = await createPdfDoc({ format: [p0w, p0h], orientation: orientOf(p0w, p0h), encryption });
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
  logPdfWarnings(pdf);
  const blob = await pdf.output('blob') as Blob;
  if (opts.password && !hasGeo) {
    // Encryption and pdf-lib post-processing are mutually exclusive - a locked
    // multi-page document ships without the PDF/X-4 finishing pass.
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

// Re-save a rendered blob through one pdf-lib pass: print page boxes + marks (when
// print geometry is supplied) and the PDF/X-4 metadata set. Subsumes the old
// finishPrintPdf so the plain RGB path loads pdf-lib exactly once; the CMYK path
// has its own pdf-lib pass and calls applyPdfX inside it (see renderCmykPdf).
// Never fed an encrypted blob - pdf-lib can't reopen an RC4-locked document.
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
  // The SVG walker has no axial/radial shading here, and a url(#…) fill resolves to null
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
      // browser's measured getComputedTextLength (a length → maps like the x attrs); the
      // writer's width is the fallback. Baseline y is the writer's own (SVG y IS the baseline).
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
      // addImage can't embed SVG. Inline it and recurse, honouring the
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


// Rasterise a CSS linear- or radial-gradient fill to a PNG data URL at pxW×pxH. The PDF
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
// PNG for the PDF walker: PDF has no blur primitive, so a soft shadow is embedded as a
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


// Walks the live DOM tree and emits PDF vector objects:
//   • background-color → filled rect / roundedRect
//   • border-top → thin filled rect (used for divider lines)
//   • <svg> subtrees → drawSvgVectorsInRegion
//   • <img> → addImage (circular headshots pre-clipped to a canvas)
//   • block-level leaf text → pdf.text() with computed font/color/align
//
// Font: custom webfonts (e.g. SUSE) are approximated with Helvetica. Text is
// still selectable/searchable vector - only the typeface differs from screen.
// Transparency: PDF fills are opaque; semi-transparent CSS colors render at
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
const RASTER_DPI = 200;

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
    // in a PDF rotation about the transform-origin. Additive (no-op unrotated).
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

    // clip-path (circle/ellipse/inset/polygon) → a PDF clip so the node stays vector
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
    // Partial element opacity (0<o<1): there is no group-opacity primitive here, so apply it
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
    // (blurred) shadow has no PDF vector primitive, so it's a bounded shadow-ONLY raster
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
    // resolved in CSS px then scaled per axis. Uniform corners take the writer's fast
    // roundedRect; differing corners take a four-corner path.
    const { radii: radiiCss, uniform: uniformCss } = resolveRadii(style, rect.width, rect.height);
    const radii = scaleRadii(radiiCss);
    const uniform: CornerPair | null = uniformCss ? [uniformCss[0] * scaleX, uniformCss[1] * scaleY] : null;
    const hasRadius = uniform ? (uniform[0] > 0 || uniform[1] > 0) : true;
    const bgImg = style.backgroundImage;
    if (bgImg && (/^radial-gradient\(/.test(bgImg) || /^linear-gradient\(/.test(bgImg))) {
      // linear/radial gradient: rasterise the fill (faithful multi-stop + angle,
      // alpha-correct) and place it as the box background, clipped to the rounded box - 
      // A rasterised gradient is opaque. A solid background-color paints behind it
      // (CSS order) so a gradient with transparent stops sits on the right colour. If the
      // gradient can't be parsed/rasterised we fall back to the flat solid-midpoint so we
      // are never WORSE than before.
      const solid = parseCssColor(style.backgroundColor);
      if (solid) { pdf.setFillColor(solid[0], solid[1], solid[2]); pdfRoundedRect(pdf, x, y, w, h, radii, uniform, 'F'); }
      let placed = false;
      // 1) TRUE VECTOR - a PDF shading pattern, unless the gradient has transparent
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
    // alpha via GState (the graphics state is sticky, so withPdfAlpha resets it).
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
      // CSS border-box: the border sits inside w×h; PDF strokes centred, so inset by lw/2.
      const innerUniform: CornerPair | null = uniform ? [Math.max(0, uniform[0] - lw / 2), Math.max(0, uniform[1] - lw / 2)] : null;
      // dashed/dotted → a line-dash pattern (the dash state is sticky, so reset after). Round
      // caps for dotted give round dots. Guarded, so a writer without the setters still draws.
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
      // embedded as live text (variable off-weight / needs the subset chain) - so
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
      // on-screen and the SVG output), NOT a writer-side line breaker - which re-measures
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
    // Outline in convert-paths mode, or for a user font live text can't carry faithfully.
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

// Sets the text color, font size, and the font to draw pdf.text() with. The
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

// Embeds a SUSE weight+style variant into the document and returns the
// fontStyle key to use with pdf.setFont(suseFontName(mono), key).
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
// from a stored Google woff2) into the document and returns the font
// name to setFont with. The name is derived from the url so it's stable and
// unique per face across a PDF; registeredFonts embeds each at most once.
// Unlike SUSE (per-weight static files), a user font is a single variable file,
// so pdfUserFontEmbed only offers it up when the default-instance render is
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
// live text, returning its sfnt URL if so, else null (the caller outlines instead - 
// the outline path has the variable axis and per-subset fallback an embed lacks).
// Only decompressed USER faces (blob: URLs) are candidates; SUSE stays on its
// own per-weight-static path, and the platform face isn't embedded here.
// Embeddable requires a single face covering the whole run (an embed can't chain
// subsets) rendering at the requested weight: a static face always does; a
// variable face only when the request equals its default instance (an embedded
// file can't move the axis). axisDefaults is additive - without it, don't risk a variable
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
// Post-processes a rendered PDF to convert RGB colour operators to CMYK.
// The pipeline: render the artwork → load into pdf-lib → decompress each content
// stream → swap `rg`/`RG` operators → recompress → save.
//
// Raster images stay RGB (their pixel data is not touched).
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

    // Content streams are /FlateDecode; skip other filters (e.g. /DCTDecode for JPEG XObjects).
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
 * The line state is STICKY (the operator is written once and every later stroke inherits
 * it), which is why the caller must run the returned restore - the same discipline the
 * border path already follows. Every setter is feature-checked because a writer build
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
    // The writer understands the SVG cap/join keywords verbatim ('square' → projecting),
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

// Natural pixel dimensions of an image href (for cover/contain fitting). Null on failure.
async function imageDims(src: string): Promise<{ w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(await (await fetch(src)).blob());
    const d = { w: bmp.width, h: bmp.height };
    bmp.close?.();
    return d;
  } catch { return null; }
}

// Pick the addImage format from a data: URL's REAL MIME (the previous
// `.includes('image/png')` guess silently misclassified WebP/AVIF/GIF user images
// as PNG, so they were dropped). PNG and JPEG are the two encodings PDF itself
// carries, so they pass through; everything else (WebP/AVIF/GIF/BMP…) is
// rasterised to PNG via a canvas first, which is what the old WebP decoder did
// internally anyway. Non-data / unrecognised sources keep the old PNG fallback.
async function imageForPdf(src: string): Promise<{ src: string; fmt: string }> {
  const mime = (/^data:([^;,]+)/i.exec(src)?.[1] || '').toLowerCase();
  if (mime === 'image/png')  return { src, fmt: 'PNG' };
  if (mime === 'image/jpeg' || mime === 'image/jpg') return { src, fmt: 'JPEG' };
  if (mime.startsWith('image/')) {
    try { return { src: await rasterizeToPng(src), fmt: 'PNG' }; }
    catch { return { src, fmt: 'PNG' }; }
  }
  return { src, fmt: 'PNG' };
}

// Decode any image source the browser understands and re-encode it as a PNG data
// URL, so a format PDF can't carry natively can still be placed.
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
//
// THIS IS THE DOM → MARKDOWN DIRECTION, and the only one of the four converters in
// the repo that reads a rendered DOM and writes markdown:
//   • engine/src/doc-md.ts mdFromBlocks takes doc-model blocks, not a DOM, and under
//     different rules: it escapes markdown punctuation in running text and prints
//     every ordered item as "1.", where the walk below escapes nothing and counts.
//     One DOM through both paths gives two different files, so they are not a pair
//     waiting to be merged.
//   • engine/src/doc-md.ts htmlFromBlocks, engine/src/template.ts's {{markdown}}
//     helper and shells/web/src/lib/markdown.ts all run the other way (model or
//     text → HTML).
//   • bridge/doc-blocks.ts lowers this same DOM to doc-model blocks for the docx and
//     odt writers. Same input, different output model, still not this path.
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
