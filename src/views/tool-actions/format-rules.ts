// SPDX-License-Identifier: MPL-2.0
/**
 * actions bar: format predicates, durations, provenance default and the file name.
 *
 * Every function takes the shared `ta: ActionsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `ta.<module>.<fn>`. Extracted verbatim
 * from renderActions() by scripts/split-closure.ts.
 */
import { deriveExportFilename } from '@lolly/engine';
import { t } from '../../i18n.ts';
import { getExportPolicy } from '../../lib/export-policy.ts';
import { mp4BeforeWebm, packageFormatChoice } from '../export-package-options.ts';
import { MAX_TIME_S } from '../timeline-math.ts';
import { canExportLolly } from '../export-share.ts';
import { jellyActive } from '../../lib/jelly.ts';
import { isC2paFmt, isImprintFmt, isPressFmt, isPrintFmt, keepFormat } from './shared.ts';
import { bindOp, type ActionsCtx } from './context.ts';

export const isAnimatedFmt = (_ta: ActionsCtx, f: string | undefined): boolean =>
  f === 'webm' ||
  f === 'mp4' ||
  f === 'gif' ||
  f === 'apng' ||
  f === 'webp-anim' ||
  f === 'svg-anim';
// True video containers only - gif/apng are animated but can't carry audio.
export const isVideoFmt = (_ta: ActionsCtx, f: string | undefined): boolean => f === 'webm' || f === 'mp4';
// Mirrors VECTOR_FORMATS in engine/src/inputs.js - formats where text→path
// outlining (the 'Convert paths' toggle) applies. Bitmap formats don't.
export const isVectorFmt = (_ta: ActionsCtx, f: string | undefined): boolean =>
  f === 'svg' || f === 'pdf' || f === 'pdf-cmyk';
// Formats that carry an alpha channel, and so have something to be transparent
// ABOUT. Gates the transparency mirror below: a JPEG, a PDF page or a video frame
// has no alpha to keep, so offering the toggle there would promise nothing.
export const isAlphaFmt = (_ta: ActionsCtx, f: string | undefined): boolean =>
  !!f && ['png', 'webp', 'avif', 'svg', 'svgz', 'apng', 'webp-anim', 'svg-anim'].includes(f);
export const assetExportFormat = (ta: ActionsCtx): string | null => {
  const { formats, matchFmtInput, runtime } = ta;
  if (!matchFmtInput) return null;
  const v = runtime.getModel().find((m) => m.id === matchFmtInput.id)?.value as
    | { format?: string }
    | null
    | undefined;
  let f = v && typeof v === 'object' && v.format ? String(v.format).toLowerCase() : '';
  if (f === 'jpeg') f = 'jpg';
  return f && formats.includes(f) ? f : null;
};
// ── Timed compositions (Sequence Studio) ───────────────────────────────────
// A timed artboard carries [data-sequence] plus data-seq-ms="<derived length>",
// restamped by the tool's hook on every paint (the same attribute the exporter's
// sequence planner and the on-canvas clock read). For those tools the manifest's
// render.video.duration is a constant that says nothing about the user's actual
// timeline - so the export bar takes its duration FROM the timeline instead, and
// keeps following it as clips are trimmed/added, until the user types their own
// value (see durationUserSet below).
export const seqStageEl = (ta: ActionsCtx): HTMLElement | null =>
  { const { canvasEl } = ta; return !canvasEl
    ? null
    : canvasEl.matches?.('[data-sequence]')
      ? canvasEl
      : canvasEl.querySelector<HTMLElement>('[data-sequence]'); };
/** The live timeline length in seconds, or null when this isn't a timed composition. */
export const seqDurationS = (ta: ActionsCtx): number | null => {
  const { canvasEl } = ta;
  const stage = seqStageEl(ta);
  if (!stage) return null;
  const msEl = stage.matches?.('[data-seq-ms]')
    ? stage
    : (stage.querySelector<HTMLElement>('[data-seq-ms]') ??
      canvasEl?.querySelector<HTMLElement>('[data-seq-ms]') ??
      null);
  const ms = parseFloat(msEl?.getAttribute('data-seq-ms') ?? '');
  if (!Number.isFinite(ms) || ms <= 0) return null;
  // Centisecond precision: exact for whole-second timelines, and never rounds a
  // clip away. Clamped to the timeline's own ceiling (timeline-math MAX_TIME_S).
  return Math.min(MAX_TIME_S, Math.max(0.1, Math.round(ms / 10) / 100));
};
/** A tool whose material has its own length - an audio bed - stamps it on its stage
 *  as data-clip-ms, and the Duration field follows it the way it follows a timeline,
 *  so what the panel shows is what the export hook will run to. Before this the
 *  audiogram's hook lengthened the clip to the analysed audio at export time while
 *  the field still read the manifest's 8 s (Andy, 2026-09-03: the duration may
 *  grow, but it has to be seen and settable at export). */
export const clipDurationS = (ta: ActionsCtx): number | null => {
  const { canvasEl } = ta;
  const el = canvasEl?.matches?.('[data-clip-ms]')
    ? canvasEl
    : canvasEl?.querySelector<HTMLElement>('[data-clip-ms]');
  const ms = parseFloat(el?.getAttribute('data-clip-ms') ?? '');
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.min(MAX_TIME_S, Math.max(0.1, Math.round(ms / 10) / 100));
};
/** The bed in-point in seconds a tool stamps on its stage as data-audio-start
 *  (0 when it doesn't, or the value is unusable) - see the export handler. */
export const stageAudioStart = (ta: ActionsCtx): number => {
  const { canvasEl } = ta;
  const elS = canvasEl?.matches?.('[data-audio-start]')
    ? canvasEl
    : canvasEl?.querySelector<HTMLElement>('[data-audio-start]');
  const s = parseFloat(elS?.getAttribute('data-audio-start') ?? '');
  return Number.isFinite(s) && s > 0 ? s : 0;
};
// ── Keyframe animations (window.__lollyAnim) ───────────────────────────────
// A tool that animates a single stage (not a whole timeline) publishes its loop
// on window.__lollyAnim {active, loopMs}, e.g. D3 Chart Studio's "Animate by
// column" charts. The exported clip should default to exactly one loop, so the
// export bar seeds Duration from loopMs and keeps following it (until the user
// types their own value), the same rule sequences use. This is deliberately NOT
// a [data-sequence] stage: those route motion export through the compositor,
// whereas an animated tool renders its own frames via __lollyFrameRender.
export const animDurationS = (_ta: ActionsCtx): number | null => {
  const a = (window as unknown as { __lollyAnim?: { active?: boolean; loopMs?: number } })
    .__lollyAnim;
  if (!a || a.active === false) return null;
  const ms = Number(a.loopMs);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.min(MAX_TIME_S, Math.max(0.1, Math.round(ms / 10) / 100));
};
// Will this export carry provenance? Reads the live protection checkboxes once
// they exist; before the panel paints it falls back to the same defaults the
// checkboxes initialise from. Gated per format, so a plain .txt never claims it.
export const provenanceOn = (ta: ActionsCtx): boolean => {
  const { c2paInitOn, el, exportDefaults, formats, initialFmt } = ta;
  const fmt = el?.querySelector<HTMLSelectElement>('[data-action="format"]')?.value ?? initialFmt;
  const c2 = el?.querySelector<HTMLInputElement>('[data-action="pdf-c2pa"]');
  const im = el?.querySelector<HTMLInputElement>('[data-action="imprint"]');
  const c2On = c2 ? c2.checked : formats.some(isC2paFmt) && c2paInitOn;
  const imOn = im ? im.checked : formats.some(isImprintFmt) && exportDefaults.imprint !== false;
  return (
    (c2On && (isC2paFmt(fmt) || fmt === 'zip')) || (imOn && (isImprintFmt(fmt) || fmt === 'zip'))
  );
};
// Content-derived auto filename (plans/140 S1): render.filenameFrom names the
// input ids whose live values name the file ("ana-kovac", "suse-com-events").
// Read fresh at download time so the name follows the inputs; falls back to
// the tool name. An explicit value typed into the filename field always wins.
// A file that will carry provenance gets a "-lolly" suffix: the name itself
// tells a recipient there is a credential to check on #/verify.
export const autoFilename = (ta: ActionsCtx): string => {
  const { manifest, runtime } = ta;
  const base =
    deriveExportFilename(
      manifest,
      Object.fromEntries(runtime.getModel().map((i) => [i.id, i.value]))
    ) || manifest.name;
  return provenanceOn(ta) && !/-lolly$/i.test(base) ? `${base}-lolly` : base;
};
export const hdrSlider = (_ta: ActionsCtx, 
  action: string,
  label: string,
  min: number,
  max: number,
  step: number,
  val: number
): string =>
  `<label class="hdr-slider"><span>${t(label)}</span><input type="range" class="field-range" data-action="${action}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
export const printIntentFmt = (ta: ActionsCtx, f: string | undefined): boolean =>
  { const { declaresPrintIntent } = ta; return isPressFmt(f) || (declaresPrintIntent && isPrintFmt(f)); };
export function readCanvasBlocks(ta: ActionsCtx): void {
  const { manifest } = ta;
  // Does the on-screen canvas ARTBOARD follow the export width/height (so a dimension
  // change resizes it 1:1), or is it a scaled preview thumbnail that must be clamped to
  // the native render size? This mirrors EXACTLY the condition under which tool.ts hands
  // the free-canvas overlay a `setCanvasSize` (a resizable editor): render.layout:'editor',
  // NOT a carousel (render.pages - the page strip owns the size), and NOT a fixed canvas
  // (canvas.fixedCanvas - connector geometry stays native-locked). Keeping the two in lock-
  // step is what makes the export-bar and rail size paths agree. See refreshCanvasPreview.
  const canvasBlocksInput = manifest.inputs?.find(
    (i) => i.type === 'blocks' && (i as { canvas?: unknown }).canvas
  ) as { canvas?: { fixedCanvas?: boolean } } | undefined; ta.canvasBlocksInput = canvasBlocksInput;
  const artboardFollowsDims =
    manifest.render.layout === 'editor' &&
    !manifest.render.pages &&
    !canvasBlocksInput?.canvas?.fixedCanvas; ta.artboardFollowsDims = artboardFollowsDims;
  // Shareable-link button (wired by wireUpCopyUrl). A link glyph + label; the
  // label is swapped to "Copied!" on click, so it's wrapped in its own span to
  // keep the icon. Lives at the foot of the actions bar - after the render
  // (Download) button, so on mobile it stacks behind it.
  // Share glyph + label, shared by both control kinds so the row stays uniform.
  const SHARE_SVG = `<svg class="copy-url-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>`; ta.SHARE_SVG = SHARE_SVG;
  const copyUrlBtn = jellyActive()
    ? `<jelly-button variant="platinum" data-action="copy-url" class="copy-url-btn" title="Copy a shareable link" label="Share">${SHARE_SVG}<span data-copy-url-label>Share</span></jelly-button>`
    : `<button type="button" data-action="copy-url" class="copy-url-btn btn" title="Copy a shareable link" aria-label="Share">${SHARE_SVG}<span data-copy-url-label>Share</span></button>`; ta.copyUrlBtn = copyUrlBtn;

  // Save glyph - a tray with a down-arrow (matches the Feather "download" mark),
  // line-art to sit consistently beside the Copy and Share icons.
  const SAVE_SVG = `<svg class="save-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`; ta.SAVE_SVG = SAVE_SVG;
}

export function readDeepExport(ta: ActionsCtx): void {
  const { experience, host, manifest } = ta;
  // Show only the video containers this browser can produce (Safari→mp4, Firefox→webm,
  // recent Chrome→both); non-video formats always pass. See keepFormat / videoSupport.
  // A tool with a float-compose exportStill hook + host.codec can originate the pro
  // float formats (exr/hdr) on-device even without the Node float rasteriser - so the
  // Pro <optgroup> opens for it here (e.g. Bitmap Studio's EXR/Radiance masters).
  const toolDeepExport = !!manifest.hooks?.exportStill && !!host.codec; ta.toolDeepExport = toolDeepExport;
  const capFormats = manifest.render.formats.filter((f) => keepFormat(f, toolDeepExport)); ta.capFormats = capFormats;
  // Org format policy (lib/export-policy.ts formatsFor): a cooperative narrowing
  // overlay, exactly like a choice input's allow list - intersected with the
  // capability-filtered set, applied only when at least one declared format
  // survives (a stale/foreign list never renders an empty select), and dormant
  // (undefined) with no control plane. The server enforces the same set on its
  // own render path; this is honest UI, not the boundary.
  const orgFormats = getExportPolicy()?.formatsFor(manifest.id); ta.orgFormats = orgFormats as ActionsCtx['orgFormats'];
  const orgAllow = orgFormats && new Set(orgFormats.map((f) => (f === 'jpeg' ? 'jpg' : f))); ta.orgAllow = orgAllow;
  const orgNarrowed = orgAllow ? capFormats.filter((f) => orgAllow.has(f)) : capFormats; ta.orgNarrowed = orgNarrowed;
  // WP-B Decision 1: MP4 leads WebM in the select where BOTH survive keepFormat - its
  // C2PA credential is standard bmff, WebM's is Lolly's own mapping. This lifts mp4 to
  // just before webm and moves nothing else, so initialFmt (which falls back to
  // formats[0]) defaults to mp4 wherever mp4 actually probed supported; a webm-only or
  // mp4-only tool is untouched. WebM stays for transparency (WP-G) and Firefox.
  const baseFormats = mp4BeforeWebm(orgNarrowed.length ? orgNarrowed : capFormats); ta.baseFormats = baseFormats;
  const packageChoice = packageFormatChoice(baseFormats); ta.packageChoice = packageChoice;
  const { innerFormat: pkgInner, enabled: canPackage } = packageChoice; ta.pkgInner = pkgInner; ta.canPackage = canPackage;
  const formats = experience.portable && canExportLolly(manifest.id)
    ? [...packageChoice.formats, 'lolly'] : packageChoice.formats; ta.formats = formats;
  const hasAnimated = formats.some(ta.formatRules.isAnimatedFmt); ta.hasAnimated = hasAnimated;
  // matchExportFormat: default the export to a dropped file's OWN format (a JPEG →
  // jpg) until the user picks one. Reads AssetRef.format off the flagged input.
  const matchFmtInput = (manifest.inputs || []).find(
    (i) => (i as { matchExportFormat?: boolean }).matchExportFormat
  ); ta.matchFmtInput = matchFmtInput;
}

export function formatRulesOps(ta: ActionsCtx) {
  return {
    isAnimatedFmt: bindOp(ta, isAnimatedFmt),
    isVideoFmt: bindOp(ta, isVideoFmt),
    isVectorFmt: bindOp(ta, isVectorFmt),
    isAlphaFmt: bindOp(ta, isAlphaFmt),
    assetExportFormat: bindOp(ta, assetExportFormat),
    seqStageEl: bindOp(ta, seqStageEl),
    seqDurationS: bindOp(ta, seqDurationS),
    clipDurationS: bindOp(ta, clipDurationS),
    stageAudioStart: bindOp(ta, stageAudioStart),
    animDurationS: bindOp(ta, animDurationS),
    provenanceOn: bindOp(ta, provenanceOn),
    autoFilename: bindOp(ta, autoFilename),
    hdrSlider: bindOp(ta, hdrSlider),
    printIntentFmt: bindOp(ta, printIntentFmt),
    readCanvasBlocks: bindOp(ta, readCanvasBlocks),
    readDeepExport: bindOp(ta, readDeepExport),
  };
}
