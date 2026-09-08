// SPDX-License-Identifier: MPL-2.0
/**
 * Tool view - actions/export subsystem.
 *
 * renderActions builds the export bar (format/size/print/provenance controls) and
 * wires the copy / preview / save / download actions, plus captureThumbnail and the
 * number-scrub behaviour and the format/print helper predicates. Split out of tool.ts
 * (which keeps mountTool + the mount-only helpers).
 *
 * This module never value-imports from ./tool.ts (that would create a runtime
 * cycle) - it only `import type`s the shell-side aliases it needs from there.
 */

import type {
  CostWorking,
  Count,
  Fact,
  PreflightInput,
  PreflightJob,
  PreflightManifest,
  PreflightSwatch,
  StageFacts,
} from '@lolly/engine';
import {
  C2PA_FORMATS,
  CMYK_CONDITIONS,
  composeSong,
  computeCost,
  cuesToSrt,
  cuesToVtt,
  DEFAULT_CMYK_CONDITION,
  deriveExportFilename,
  frameFilterApplies,
  generatedSongSpec,
  HDR_DEFAULTS,
  isNonAffineTransform,
  isRateCardError,
  LEXICON_VERSION,
  PRINT_MARK_FORMATS,
  parseRateCard,
  preflight,
  SEPARATING_FORMATS,
  selectFramePage,
  serializeUrlState,
  toCssPx,
  UNITS,
  VIDEO_CODEC_STRINGS,
  validateRateCard,
} from '@lolly/engine';
import type { MoneyContext } from '@lolly-tools/core';
import { inspectDesignV1 } from '@lolly-tools/core';
import type { Disposer } from '@lolly-tools/core/extension-v1';
import type { Profile } from '@lolly-tools/core/host-v1';
import type { InputValue } from '../../../../engine/src/inputs.js';
import type { ToolManifest } from '../../../../engine/src/loader.js';
import type { Unit } from '../../../../engine/src/units.js';
import { announce } from '../a11y.js';
import { CENTRE_LOW } from '../bridge/audio-envelope.ts';
import { _setExportNoticeSink } from '../bridge/export.ts';
import { RASTER_DEFAULT_SCALE, SUPERSAMPLED_EXPORT_FORMATS } from '../bridge/export-scale.ts';
import {
  audioSupport,
  cmykTiffSupport,
  durableSupport,
  liveCaptureSupport,
  proFormatSupport,
  tiffSupport,
  videoSupport,
} from '../bridge/format-support.js';
import { mountBodyPopover } from '../components/body-popover.ts';
import { helpTip, linkHelpDescriptions, wireHelpTips } from '../components/help-tip.js';
import { currentLang, t, tRaw } from '../i18n.ts';
import { openApprovalRequest } from '../lib/approval-request.ts';
import { isAudioFormat as isAudioFmt } from '../lib/audio-encode.js';
import {
  getAudioTake,
  onAudioTakeChange,
  saveTakeMp3,
  saveTakeNative,
  takeNativeExt,
} from '../lib/audio-take.ts';
import { formatCaptions } from '../lib/caption-format.ts';
import { stageDeckAsSequence, stagedDeckMs } from '../lib/deck-as-sequence.ts';
import { exportAffordance, getExportPolicy } from '../lib/export-policy.ts';
import { saveExportPrefs } from '../lib/export-prefs.ts';
import { mountSlot, onExtensionsChanged, slotHasResolved } from '../lib/extensions.ts';
import { icon } from '../lib/icons.ts';
import { livePalette } from '../lib/live-palette.ts';
import { isModuleFormat, modUrlToWavBlobUrl } from '../lib/mod-render.ts';
import { buildStepsDropped, restMsOf } from '../lib/motion-model.ts';
import { loopRank } from '../lib/neurospicy.ts';
import { pcmToWavBlob } from '../lib/pcm-wav.ts';
import { isVectorImageSrc, placedImageLabel } from '../lib/placed-image.ts';
import {
  embedRowLabel,
  isOwnProfile,
  listEligible,
  ownDigest,
} from '../lib/press-profile-embed.ts';
import { marksToCsv } from '../lib/print-marks-csv.ts';
import { getRateCardBlob, listCatalogRateCards, listRateCards } from '../lib/rate-cards.ts';
import { runTemplateScripts } from '../lib/render-lifecycle.ts';
import { sendTargetId, sendTargetsFor } from '../lib/send-target.ts';
import { stashedTranscript } from '../lib/stt-job.ts';
import { markSyncDirty } from '../lib/sync-service.ts';
import { convertLength, displayIn, roundIn, stepFor } from '../lib/unit-steps.ts';
import { renderSong, songUrlToWavBlobUrl } from '../lib/zzfxm-render.ts';
import { bumpMetric, recordFormat } from '../metrics.js';
import { navigateTo } from '../nav.js';
import { escape, safeHref } from '../utils.js';
import type { CostAuthoringContext } from './cost-panel.ts';
import { applyCostPanel, costPanelHtml, costView } from './cost-panel.ts';
import { mountedDesignFindingMessage } from './design-audit-copy.ts';
import { auditMountedDesign } from './design-mounted-audit.ts';
import { applyDepthFact, depthFact, formatOptionsHtml, isProFormat } from './export-depth.ts';
import {
  applyExportDimensionFields,
  convertExportDimensionFields,
  type ExportDimensionUpdate,
} from './export-dimension-fields.ts';
import { durableCardHtml, isDurableFmt, wireDurableConsent } from './export-durable-card.ts';
import { formatPanelHtml, formatTriggerHtml, wireFormatPicker } from './export-format-picker.ts';
import {
  mp4BeforeWebm,
  packageFormatChoice,
  packageOptionsHtml,
  saveAsBridge,
  saveAsButtonHtml,
} from './export-package-options.ts';
import type { PreflightRow } from './export-preflight.ts';
import {
  applyPreflight,
  isPreflightEnabled,
  preflightRowHtml,
  preflightView,
  wirePreflight,
} from './export-preflight.ts';
import { aspectWarning } from './export-size.js';
import { transcriptWordsOf, ttsWordsOf } from './timeline-captions.ts';
import { MAX_TIME_S } from './timeline-math.ts';
import { canExportLolly } from './export-share.ts';
import type { AutomaticHistory } from './automatic-history.ts';
import { mountActionHistory } from './tool-revision-history.ts';
import { snapshotSession } from './tool-session-snapshot.ts';

import type {
  ActionsApi,
  ActionsExperience,
  ExportDefaults,
  ExportExperience,
  ExportUnscaled,
  IdentityStatus,
  PanelEl,
  PrintMarks,
  RunExportOpts,
  ToolRuntime,
  WebToolHost,
} from './tool.ts';

import {
  addScrubBehavior,
  captureThumbnail,
  exportTargetNode,
  flatExportNode,
  THUMB_CAPTURE_TIMEOUT_MS,
} from './tool-action-helpers.ts';

export { captureThumbnail, exportTargetNode, flatExportNode } from './tool-action-helpers.ts';

// Content Credentials default: the shared policy in lib/c2pa-policy.ts (also
// applied by the offscreen batch/zip renderer, so zips sign like this button).
// The C2PA card only renders for C2PA-capable formats, so it's a no-op for
// graphic-less tools. Re-exported below for tool.ts.
import { c2paDefaultOn } from '../lib/c2pa-policy.ts';
import { jellyActive } from '../lib/jelly.ts';

/** Structural mirror of the engine MediaFrame (not re-exported from the engine index) - the
 *  RGBA frame host.media.renderFrameAt hands the tool's onFrame during a deterministic export. */
type MediaFrameLike = { width: number; height: number; data: Uint8ClampedArray; t: number };

/** One set of captions, serialised into the two formats a moving export can carry
 *  them in (plans/180 section 4): WebVTT for the embedded track and for the web,
 *  SubRip for the editors and platforms that only take `.srt`. Both are built from
 *  the SAME cues, so the file beside the video and the track inside it always say
 *  the same words at the same moments. */
interface CaptionText {
  vtt: string;
  srt: string;
}

// Human-readable labels and file extensions for format identifiers that differ
// from their raw string (e.g. "pdf-cmyk" → "Print PDF" / ".pdf").
const FMT_LABEL: Record<string, string> = {
  'pdf-cmyk': 'Print PDF',
  'cmyk-tiff': 'Print TIFF',
  tiff: 'TIFF',
  jpeg: 'JPG',
  webm: 'WebM',
  mp4: 'MP4',
  apng: 'aPNG',
  'webp-anim': 'Animated WebP',
  'svg-anim': 'Animated SVG',
  emf: 'EMF (old)',
  eps: 'EPS',
  'eps-cmyk': 'EPS (CMYK)',
  dxf: 'DXF (cut file)',
  pptx: 'PowerPoint',
  penpot: 'Penpot',
  docx: 'Word',
  odt: 'OpenDocument',
  ics: 'Calendar',
  vcf: 'vCard',
  ico: 'Icon',
  zip: 'ZIP',
  csv: 'CSV',
  json: 'JSON',
  // A SCORM course package (plans/180 M-D1) - a zip an LMS imports. The qualifier is
  // there because "SCORM" alone means nothing to anyone who has not been sent to one.
  scorm: 'SCORM (LMS)',
  // Palette exchange (color-palette): a design-tokens JSON, CSS/SCSS variable
  // blocks, a GIMP palette, and a binary Adobe swatch file. extFor falls back to
  // the format id for each (blob MIME isn't mp4/webm/zip), so no FMT_EXT entry.
  css: 'CSS',
  scss: 'SCSS',
  gpl: 'GIMP palette',
  ase: 'Adobe swatches',
  // Audio only. Opus ships in a WebM container, so the label says so rather than
  // leaving a download named .webm looking like a video.
  wav: 'WAV',
  mp3: 'MP3',
  m4a: 'M4A (AAC)',
  opus: 'Opus (WebM)',
  // Linux packages (plan 197 M6): an installable RPM of the render, and the no-root tarball.
  rpm: 'RPM',
  'tar.gz': 'Tarball',
};
// `penpot` is spelled out rather than left to extFor's fallback: the archive IS a
// zip, and only its `application/x-penpot` blob type keeps the MIME sniff below from
// renaming the download to .zip - which Penpot's own Import will not take.
// `scorm` IS a zip and wants the .zip extension (an LMS import takes one); the branch
// below names the file itself, so this entry only covers any other path that asks.
const FMT_EXT: Record<string, string> = {
  'pdf-cmyk': 'pdf',
  'cmyk-tiff': 'tiff',
  jpeg: 'jpg',
  'eps-cmyk': 'eps',
  'webp-anim': 'webp',
  'svg-anim': 'svg',
  penpot: 'penpot',
  scorm: 'zip',
  rpm: 'rpm',
  'tar.gz': 'tar.gz',
};
// Animated WebP is credentialed via the still-'webp' path (renderFormat maps
// webp-anim→webp before stamping), but the engine's C2PA_FORMATS lists only 'webp' -
// so treat webp-anim as stampable in the UI gating too, else the toggle/card would be
// hidden and opts.c2pa never set, silently dropping the default provenance.
const isC2paFmt = (f: string | undefined): boolean =>
  !!f && (C2PA_FORMATS.includes(f) || f === 'webp-anim');

// The durable in-pixel watermark embeds two ways: the standalone raster encoders
// (renderRaster/renderBitmap/renderTiff's opts.imprint branch), and - for the
// CONTAINER formats - imprintEmbedCanvas baking the mark into each Lolly-rendered
// raster as it's composited into a PDF page / PPTX slide (bridge/export.ts +
// export-pptx.ts). So the list covers both: still rasters AND pdf/pdf-cmyk/pptx.
// A pure-vector container marks nothing (no raster to carry it) - the C2PA claim
// is gated on whether a mark was actually applied, never on this list, so no
// over-claim (see export.ts stampC2pa). Mirrors the deep-link gate in views/tool.ts.
// Zip carries the flag through to its bundled raster + container members.
const isImprintFmt = (f: string | undefined): boolean =>
  !!f &&
  ['png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff', 'bmp', 'pdf', 'pdf-cmyk', 'pptx'].includes(f);
// HDR (Rec.2100 PQ) export. Raster: PNG (cICP) + JPEG (PQ ICC) + AVIF (native nclx
// colr) + TIFF (PQ ICC tag, archival). Video: mp4/webm carry a 10-bit PQ track with a
// colr/nclx (Colour on WebM) box (plan 154 WP-2). WebP is excluded on purpose - it has
// no working HDR decode path, so a PQ WebP would just look dark.
const isHdrFmt = (f: string | undefined): boolean =>
  !!f && ['png', 'jpg', 'jpeg', 'avif', 'tiff', 'mp4', 'webm'].includes(f);

// Print marks & bleed apply to the three print formats (pdf / pdf-cmyk / cmyk-tiff).
// Defaults when the user turns the card on; the CSV tokens (crop,reg,bleed,bars)
// match the engine's `marks` URL param (engine/src/url-mode.js parseMarks). Bleed is
// carried as a dimension string. The Color profile (press condition) card applies to
// the two CMYK formats.
const DEFAULT_PRINT_MARKS: PrintMarks = {
  crop: true,
  registration: true,
  bleed: true,
  colorBars: false,
  provenance: true,
};
// Both read the ENGINE's tables (engine/src/preflight.ts) rather than restating
// the literals. The card that OFFERS bleed and the check that reports it missing
// have to agree by construction: two copies is how "the panel hides the bleed card
// but the URL still carries bleed" happens. `isCmykFmt` is the two formats that
// build a process separation AND emit through the panel's Color profile card, i.e.
// the separating set minus eps-cmyk, which this panel does not offer settings for.
const isCmykFmt = (f: string | undefined): boolean =>
  SEPARATING_FORMATS.has(f ?? '') && f !== 'eps-cmyk';
const isPrintFmt = (f: string | undefined): boolean => PRINT_MARK_FORMATS.has(f ?? '');
// Print INTENT is narrower than print CAPABILITY. Every PRINT_MARK_FORMATS member
// can CARRY bleed and marks (that is what keeps the card on offer for pdf/svg/eps),
// but only the separating press formats (pdf-cmyk / cmyk-tiff / eps-cmyk) MEAN
// print by being picked - an everyday RGB PDF or SVG is a share/screen format
// first, so marks and bleed stay OFF for it until the user (or an explicit
// bleed/marks link/save, or a manifest declaring render.printMarks: true) asks.
// Physical units (mm/cm/in + dpi) are a size statement, not print intent, and
// never enable marks on their own.
const isPressFmt = (f: string | undefined): boolean => SEPARATING_FORMATS.has(f ?? '');
// The `marks` CSV codec lives in lib/print-marks-csv.ts - one encoder, one
// decoder, shared with the batch/folder render path (which previously had no way
// to read a stored CSV back and so dropped print marks entirely).

// Read the Print marks card from an export-panel element `el` (empty when off).
const printEnabled = (el: Element | null | undefined): boolean =>
  Boolean(el?.querySelector<HTMLInputElement>('[data-action="print-enable"]')?.checked);
function readBleed(el: Element | null | undefined): string {
  if (!printEnabled(el)) return '';
  const mm = parseFloat(
    el?.querySelector<HTMLInputElement>('[data-action="print-bleed"]')?.value ?? ''
  );
  return mm > 0 ? `${mm}mm` : '';
}
function readMarks(el: Element | null | undefined): string {
  if (!printEnabled(el)) return '';
  return marksToCsv({
    crop: el?.querySelector<HTMLInputElement>('[data-action="mark-crop"]')?.checked,
    registration: el?.querySelector<HTMLInputElement>('[data-action="mark-reg"]')?.checked,
    bleed: el?.querySelector<HTMLInputElement>('[data-action="mark-bleed"]')?.checked,
    colorBars: el?.querySelector<HTMLInputElement>('[data-action="mark-bars"]')?.checked,
    provenance: el?.querySelector<HTMLInputElement>('[data-action="mark-prov"]')?.checked,
  });
}

// Visual formats a ZIP export bundles (data/text and video are excluded). The
// shell passes these as opts.bundleFormats; the export bridge renders each and
// archives them (see renderZip).
const ZIP_BUNDLE = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'webp-anim',
  'avif',
  'svg',
  'svg-anim',
  'emf',
  'eps',
  'eps-cmyk',
  'dxf',
  'pdf',
  'pdf-cmyk',
  'cmyk-tiff',
  'tiff',
  'gif',
  'apng',
  'ico',
]);

// Which video containers this browser can actually produce (MediaRecorder OR the
// WebCodecs probe - see videoSupport). Read per call, NOT snapshotted at module
// load: the WebCodecs half resolves asynchronously just after boot, and a module-
// scope const would freeze the pre-probe answer forever.
// Print TIFF is desktop-only with working canvas readback (see cmykTiffSupport);
// hide it everywhere it can't be produced or cleanly downloaded.
const CMYK_TIFF_OK = cmykTiffSupport();
const TIFF_OK = tiffSupport();
const keepFormat = (f: string, deepExportOk = false): boolean =>
  f === 'webm'
    ? videoSupport().webm
    : f === 'mp4'
      ? videoSupport().mp4
      : // wav/mp3 are pure JS and always pass; m4a/opus need the platform's WebCodecs
        // AudioEncoder, so they are hidden where it cannot produce them.
        isAudioFmt(f)
        ? audioSupport()[f]
        : f === 'cmyk-tiff'
          ? CMYK_TIFF_OK
          : f === 'tiff'
            ? TIFF_OK
            : // The pro float formats (exr/hdr) reach the picker two ways: the generic Node
              // float rasteriser (proFormatSupport - false on the web), OR a tool that owns
              // them through an exportStill hook computed in float via host.codec (bitmap
              // studio). `deepExportOk` is that second, tool-specific producer - the runtime
              // routes exr/hdr to exportStill before the 8-bit DOM path (runtime.ts:752), so
              // where a tool can genuinely originate the float master the option is honest.
              isProFormat(f)
              ? proFormatSupport() || deepExportOk
              : true;

const fmtLabel = (f: string): string => f === 'lolly' ? '.lolly' : FMT_LABEL[f] ?? f.toUpperCase();

// Download extension follows the produced Blob - a deep-linked video request may
// fall back to the other container, so trust the Blob's MIME over the format id.
function extFor(fmt: string, blob: Blob | null | undefined): string {
  const t = blob?.type || '';
  // Audio first: an .m4a IS an MP4 container and Opus audio IS a WebM one, so the
  // MIME sniff below would rename both to their video extension.
  if (isAudioFmt(fmt)) return fmt === 'opus' ? 'webm' : fmt;
  // Packages: a .tar.gz blob is 'application/gzip', which contains "zip" - so it must
  // return before the zip sniff below or it would download as ".zip".
  if (fmt === 'rpm' || fmt === 'tar.gz') return FMT_EXT[fmt] ?? fmt;
  if (t.includes('mp4')) return 'mp4';
  if (t.includes('webm')) return 'webm';
  // A contact sheet (cuts > 1) of a still format comes back as a ZIP of N members,
  // so the requested format id says 'png' while the bytes are an archive. Same rule
  // as the video fallback above: the Blob wins, or the user downloads a sheet.png
  // that no image viewer can open.
  if (t.includes('zip')) return 'zip';
  return FMT_EXT[fmt] ?? fmt;
}

/** The profile slice offerDetailsAsk reads and writes. `set` is the web shell's
 *  own setter, not part of the tool-facing ProfileAPI - same shape and the same
 *  read-then-merge write views/personalize-nudge.ts uses for the flag. Optional
 *  because a host assembled without a profile store must simply not ask. */
type ProfileStore = { get(): Promise<Profile>; set?(profile: Profile): Promise<void> };

// fitCanvas and exportUnscaled are passed in so refreshCanvasPreview and the
// export actions can coordinate with the responsive-scaling logic in mountTool.
function renderActions(
  el: PanelEl | null,
  manifest: ToolManifest,
  runtime: ToolRuntime,
  canvasEl: HTMLElement | null,
  host: WebToolHost,
  fitCanvas: () => void,
  exportUnscaled: ExportUnscaled,
  exportDefaults: ExportDefaults = {},
  onUrlSync: ((key?: string) => void) | null = null,
  playShutter: () => void = () => {},
  fileIntoFolder: string | null = null,
  returnTo = '/',
  initialSlot: string | null = null,
  reachedViaLink = false,
  experience: ActionsExperience = {}
): ActionsApi | undefined {
  // The slot this editing session writes to. Seeded from a resumed `?slot=` session,
  // otherwise null until the first save mints one. Every subsequent save (the Save
  // button, the render-pill quick-Save, "Save & leave") reuses it so edits UPDATE the
  // same saved session in place instead of spawning a new one on each save. Without
  // this, re-saving after an edit orphaned a fresh copy in Uncategorised and left the
  // original folder card frozen at its first-save state.
  let activeSlot = initialSlot;
  let automaticHistory: AutomaticHistory | undefined;
  // Monotonic save counter - lets the background thumbnail patch in performSave
  // detect that a newer save superseded it (see the generation check there).
  let saveGen = 0;
  // The user now holds their artifact (a download, a clipboard copy, a library
  // save). tool.ts listens for this to stand down the unsaved-changes leave
  // guard: a session whose latest edits made it out is resolved, not unsaved.
  const exportCompleted = (): void => {
    el?.dispatchEvent(new CustomEvent('lolly:export-complete', { bubbles: true }));
  };
  // Does the on-screen canvas ARTBOARD follow the export width/height (so a dimension
  // change resizes it 1:1), or is it a scaled preview thumbnail that must be clamped to
  // the native render size? This mirrors EXACTLY the condition under which tool.ts hands
  // the free-canvas overlay a `setCanvasSize` (a resizable editor): render.layout:'editor',
  // NOT a carousel (render.pages - the page strip owns the size), and NOT a fixed canvas
  // (canvas.fixedCanvas - connector geometry stays native-locked). Keeping the two in lock-
  // step is what makes the export-bar and rail size paths agree. See refreshCanvasPreview.
  const canvasBlocksInput = manifest.inputs?.find(
    (i) => i.type === 'blocks' && (i as { canvas?: unknown }).canvas
  ) as { canvas?: { fixedCanvas?: boolean } } | undefined;
  const artboardFollowsDims =
    manifest.render.layout === 'editor' &&
    !manifest.render.pages &&
    !canvasBlocksInput?.canvas?.fixedCanvas;
  // Shareable-link button (wired by wireUpCopyUrl). A link glyph + label; the
  // label is swapped to "Copied!" on click, so it's wrapped in its own span to
  // keep the icon. Lives at the foot of the actions bar - after the render
  // (Download) button, so on mobile it stacks behind it.
  // Share glyph + label, shared by both control kinds so the row stays uniform.
  const SHARE_SVG = `<svg class="copy-url-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>`;
  const copyUrlBtn = jellyActive()
    ? `<jelly-button variant="platinum" data-action="copy-url" class="copy-url-btn" title="Copy a shareable link" label="Share">${SHARE_SVG}<span data-copy-url-label>Share</span></jelly-button>`
    : `<button type="button" data-action="copy-url" class="copy-url-btn btn" title="Copy a shareable link" aria-label="Share">${SHARE_SVG}<span data-copy-url-label>Share</span></button>`;

  // Save glyph - a tray with a down-arrow (matches the Feather "download" mark),
  // line-art to sit consistently beside the Copy and Share icons.
  const SAVE_SVG = `<svg class="save-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;

  // The Save action - one builder for both render sites (the default actions row
  // and the save-only bar for input-less tools). Jelly mode swaps in a neutral
  // <jelly-button>; the `save-btn` class stays for the icon-collapse @container
  // rules, which are class-keyed, and carries no box paint of its own.
  const saveBtnHtml = () =>
    jellyActive()
      ? `<jelly-button variant="platinum" data-action="save" data-sfx="save" class="save-btn" title="Save to your library">${SAVE_SVG}<span data-save-label>Save</span></jelly-button>`
      : `<button data-action="save" data-sfx="save" class="save-btn" title="Save to your library">${SAVE_SVG}<span data-save-label>Save</span></button>`;

  // The exact payload a save persists - live input values plus the `__` markers
  // (tool identity + export settings). Shared by performSave and the "Make
  // variants" action so a variant is byte-for-byte a normal saved session.
  const sessionSnapshot = () => snapshotSession(el, manifest, runtime, experience, readBleed, readMarks);

  // Shared, awaitable save routine - used by the Save button AND the
  // unsaved-changes dialog's "Save & leave". Returns true on success. Always
  // re-enables the button and surfaces failures: a save error used to leave the
  // button stuck on "Saving…" silently, which made "Save & leave" appear to do
  // nothing (and then click a now-disabled button - a no-op). The thumbnail is
  // best-effort (captureThumbnail swallows its own errors), so it never blocks a save.
  async function performSave(
    saveBtnEl?: HTMLElement | null,
    opts?: { folderId?: string | null }
  ): Promise<boolean> {
    // Either the native <button> or its jelly-mode <jelly-button> stand-in -
    // disabling goes through the ATTRIBUTE, which both honour (jelly-button
    // observes it and syncs its shadow button).
    const btn = (saveBtnEl ??
      el?.querySelector('[data-action="save"]')) as HTMLButtonElement | null;
    if (!btn || btn.dataset.saving) return false;
    const label = btn.querySelector<HTMLElement>('[data-save-label]') ?? btn;
    const idle = label.textContent;
    btn.dataset.saving = '1';
    btn.toggleAttribute('disabled', true);
    label.textContent = 'Saving…';
    try {
      // Reuse the session's slot after the first save (or when resuming an existing
      // session) so a re-save updates it in place; only mint a new slot the first time.
      const slot = activeSlot || `${manifest.id}:${Date.now()}`;
      const data = sessionSnapshot();
      // Durable FIRST. The thumbnail is best-effort decoration, but it used to be
      // AWAITED ahead of the write - so in a throttled tab (hidden or occluded:
      // rAF frozen, waitForQuiescence stalled) the put trailed the click by up to
      // THUMB_CAPTURE_TIMEOUT_MS, and a tab closed or navigated in that window
      // lost the save silently after its success UI had already played (audit 167
      // F-A3's root cause). Now the record is written in milliseconds; the
      // thumbnail patches it below, whenever it arrives.
      if (automaticHistory) await automaticHistory.save(slot, data);
      else await host.state.save(slot, data, null);
      markSyncDirty(); // device sync (plans/138): a saved session is a change to push (no-op if sync is off)
      // Background thumbnail patch. captureThumbnail swallows its own errors, and
      // the race caps a render that never quiesces. The generation check keeps a
      // slow capture from clobbering a NEWER re-save's data with this older data.
      const gen = ++saveGen;
      if (!automaticHistory) void Promise.race([
        captureThumbnail(manifest, canvasEl, runtime, exportUnscaled, data.__export_format),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), THUMB_CAPTURE_TIMEOUT_MS)),
      ])
        .then((thumb) =>
          thumb && gen === saveGen ? host.state.save(slot, data, thumb) : undefined
        )
        .catch(() => {
          /* the thumbnail is an extra - the session is already saved */
        });
      // Remember the slot so the next save updates THIS session rather than creating a
      // duplicate (see activeSlot above). Set before filing so a fresh first-save is
      // both filed into its folder AND pinned as the active slot for later edits.
      activeSlot = slot;
      // File the session into a folder. The Save dialog passes an EXPLICIT `opts.folderId`
      // (a chosen project, or null = leave at library root - "No project"); when it is
      // absent (the plain button / programmatic saves) fall back to the folder the Projects
      // "+ New tool" flow claimed at mount (fileIntoFolder). `moveItem(slot, null)` is a
      // no-op, so an explicit "root" choice simply doesn't file. One-shot, best-effort.
      const target = opts && 'folderId' in opts ? (opts.folderId ?? null) : fileIntoFolder;
      if (target) {
        try {
          const { createFolderStore } = await import('../folders.js');
          await createFolderStore(
            host as unknown as Parameters<typeof createFolderStore>[0]
          ).moveItem(slot, target, 'session');
        } catch (e) {
          /* filing is best-effort */
        }
      }
      fileIntoFolder = null;
      label.textContent = 'Saved';
      announce('Saved');
      exportCompleted();
      return true; // leave the button as-is; the caller navigates away
    } catch (e) {
      console.error('Save failed:', e);
      label.textContent = idle;
      btn.toggleAttribute('disabled', false);
      delete btn.dataset.saving;
      announce('Save failed');
      return false;
    }
  }

  // S2 (plans/140): Save no longer exits the tool. performSave leaves its button
  // disabled reading "Saved" for the old navigate-away flow, so hold that as the
  // confirmation, restore the button, and offer the library as a toast action
  // instead of a forced navigation.
  function settleSaveButton(btn: HTMLButtonElement): void {
    const label = btn.querySelector<HTMLElement>('[data-save-label]') ?? btn;
    setTimeout(() => {
      label.textContent = 'Save';
      btn.toggleAttribute('disabled', false);
      delete btn.dataset.saving;
    }, 1500);
    void import('../lib/undo-toast.ts').then(({ showUndoToast }) =>
      showUndoToast({
        message: t('Saved'),
        actionLabel: t('Open Projects'),
        undo: () => navigateTo('#/p'),
        duration: 6000,
      })
    );
  }

  // plans/142 W2 (Andy's call): the quick Save follows the Save dialog's lead -
  // an UNFILED session files into the last project a dialog save picked, so a
  // sitting's outputs stop scattering to the library root. A session already
  // filed somewhere keeps its folder (an explicit folderId on re-save MOVES it,
  // which no quick save may ever do), and a deliberate "No project" pick in the
  // dialog clears the memory, so that choice is followed too. Best-effort: any
  // failure saves exactly as before.
  async function quickSaveFolder(): Promise<string | null> {
    try {
      const { lastPickedFolder } = await import('../lib/save-dialog.ts');
      const remembered = lastPickedFolder();
      if (!remembered) return null;
      if (activeSlot) {
        const { createFolderStore } = await import('../folders.js');
        const store = createFolderStore(host as unknown as Parameters<typeof createFolderStore>[0]);
        if (store.folderOfRef(await store.list(), activeSlot)) return null;
      }
      return remembered;
    } catch {
      return null;
    }
  }

  if (manifest.render.export === false) {
    if (!el) return;
    const hasInputs = (manifest.inputs?.length ?? 0) > 0;
    // An explicit empty actions list opts out of the default Save+Share bar - for
    // on-device file utilities that provide their own download button and must
    // NOT persist the user's file bytes to storage (Save would write them to
    // IndexedDB, contradicting the "nothing is stored/uploaded" promise).
    const optedOut = Array.isArray(manifest.render.actions) && manifest.render.actions.length === 0;
    if (!hasInputs || optedOut) {
      el.innerHTML = '';
      return {};
    }
    el.innerHTML = `<div class="export-action-buttons">${saveBtnHtml()}${copyUrlBtn}</div>`;
    el.querySelector<HTMLButtonElement>('[data-action="save"]')!.addEventListener(
      'click',
      async function (this: HTMLButtonElement) {
        const qsFolder = await quickSaveFolder();
        if (await performSave(this, qsFolder ? { folderId: qsFolder } : undefined))
          settleSaveButton(this);
      }
    );
    return { save: performSave, getSlot: () => activeSlot };
  }

  const actions = manifest.render.actions ?? ['copy', 'download', 'save'];
  const exportOpts = runtime
    .getModel()
    .filter((i) => i.group === 'export' && i.control === 'checkbox');
  const isAnimatedFmt = (f: string | undefined): boolean =>
    f === 'webm' ||
    f === 'mp4' ||
    f === 'gif' ||
    f === 'apng' ||
    f === 'webp-anim' ||
    f === 'svg-anim';
  // True video containers only - gif/apng are animated but can't carry audio.
  const isVideoFmt = (f: string | undefined): boolean => f === 'webm' || f === 'mp4';
  // Mirrors VECTOR_FORMATS in engine/src/inputs.js - formats where text→path
  // outlining (the 'Convert paths' toggle) applies. Bitmap formats don't.
  const isVectorFmt = (f: string | undefined): boolean =>
    f === 'svg' || f === 'pdf' || f === 'pdf-cmyk';
  // Formats that carry an alpha channel, and so have something to be transparent
  // ABOUT. Gates the transparency mirror below: a JPEG, a PDF page or a video frame
  // has no alpha to keep, so offering the toggle there would promise nothing.
  const isAlphaFmt = (f: string | undefined): boolean =>
    !!f && ['png', 'webp', 'avif', 'svg', 'svgz', 'apng', 'webp-anim', 'svg-anim'].includes(f);
  // Show only the video containers this browser can produce (Safari→mp4, Firefox→webm,
  // recent Chrome→both); non-video formats always pass. See keepFormat / videoSupport.
  // A tool with a float-compose exportStill hook + host.codec can originate the pro
  // float formats (exr/hdr) on-device even without the Node float rasteriser - so the
  // Pro <optgroup> opens for it here (e.g. Bitmap Studio's EXR/Radiance masters).
  const toolDeepExport = !!manifest.hooks?.exportStill && !!host.codec;
  const capFormats = manifest.render.formats.filter((f) => keepFormat(f, toolDeepExport));
  // Org format policy (lib/export-policy.ts formatsFor): a cooperative narrowing
  // overlay, exactly like a choice input's allow list - intersected with the
  // capability-filtered set, applied only when at least one declared format
  // survives (a stale/foreign list never renders an empty select), and dormant
  // (undefined) with no control plane. The server enforces the same set on its
  // own render path; this is honest UI, not the boundary.
  const orgFormats = getExportPolicy()?.formatsFor(manifest.id);
  const orgAllow = orgFormats && new Set(orgFormats.map((f) => (f === 'jpeg' ? 'jpg' : f)));
  const orgNarrowed = orgAllow ? capFormats.filter((f) => orgAllow.has(f)) : capFormats;
  // WP-B Decision 1: MP4 leads WebM in the select where BOTH survive keepFormat - its
  // C2PA credential is standard bmff, WebM's is Lolly's own mapping. This lifts mp4 to
  // just before webm and moves nothing else, so initialFmt (which falls back to
  // formats[0]) defaults to mp4 wherever mp4 actually probed supported; a webm-only or
  // mp4-only tool is untouched. WebM stays for transparency (WP-G) and Firefox.
  const baseFormats = mp4BeforeWebm(orgNarrowed.length ? orgNarrowed : capFormats);
  const packageChoice = packageFormatChoice(baseFormats);
  const { innerFormat: pkgInner, enabled: canPackage } = packageChoice;
  const formats = experience.portable && canExportLolly(manifest.id)
    ? [...packageChoice.formats, 'lolly'] : packageChoice.formats;
  const hasAnimated = formats.some(isAnimatedFmt);
  // matchExportFormat: default the export to a dropped file's OWN format (a JPEG →
  // jpg) until the user picks one. Reads AssetRef.format off the flagged input.
  const matchFmtInput = (manifest.inputs || []).find(
    (i) => (i as { matchExportFormat?: boolean }).matchExportFormat
  );
  const assetExportFormat = (): string | null => {
    if (!matchFmtInput) return null;
    const v = runtime.getModel().find((m) => m.id === matchFmtInput.id)?.value as
      | { format?: string }
      | null
      | undefined;
    let f = v && typeof v === 'object' && v.format ? String(v.format).toLowerCase() : '';
    if (f === 'jpeg') f = 'jpg';
    return f && formats.includes(f) ? f : null;
  };
  // A ?format= link or a saved session (exportDefaults.format) is an explicit choice
  // and wins; otherwise follow the upload's format, falling back to the first format.
  const initialFmt =
    exportDefaults.format && formats.includes(exportDefaults.format)
      ? exportDefaults.format
      : assetExportFormat() || formats[0];
  const videoDefaults = (manifest.render.video ?? {}) as { wait?: number; duration?: number };
  // A link's ?wait= / ?seconds= (exportDefaults.video) seed the fields the way ?format= seeds the picker.
  const defaultWait = exportDefaults.video?.wait ?? videoDefaults.wait ?? 1;

  // ── Timed compositions (Sequence Studio) ───────────────────────────────────
  // A timed artboard carries [data-sequence] plus data-seq-ms="<derived length>",
  // restamped by the tool's hook on every paint (the same attribute the exporter's
  // sequence planner and the on-canvas clock read). For those tools the manifest's
  // render.video.duration is a constant that says nothing about the user's actual
  // timeline - so the export bar takes its duration FROM the timeline instead, and
  // keeps following it as clips are trimmed/added, until the user types their own
  // value (see durationUserSet below).
  const seqStageEl = (): HTMLElement | null =>
    !canvasEl
      ? null
      : canvasEl.matches?.('[data-sequence]')
        ? canvasEl
        : canvasEl.querySelector<HTMLElement>('[data-sequence]');
  /** The live timeline length in seconds, or null when this isn't a timed composition. */
  const seqDurationS = (): number | null => {
    const stage = seqStageEl();
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
  const clipDurationS = (): number | null => {
    const el = canvasEl?.matches?.('[data-clip-ms]')
      ? canvasEl
      : canvasEl?.querySelector<HTMLElement>('[data-clip-ms]');
    const ms = parseFloat(el?.getAttribute('data-clip-ms') ?? '');
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return Math.min(MAX_TIME_S, Math.max(0.1, Math.round(ms / 10) / 100));
  };
  /** The bed in-point in seconds a tool stamps on its stage as data-audio-start
   *  (0 when it doesn't, or the value is unusable) - see the export handler. */
  const stageAudioStart = (): number => {
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
  const animDurationS = (): number | null => {
    const a = (window as unknown as { __lollyAnim?: { active?: boolean; loopMs?: number } })
      .__lollyAnim;
    if (!a || a.active === false) return null;
    const ms = Number(a.loopMs);
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return Math.min(MAX_TIME_S, Math.max(0.1, Math.round(ms / 10) / 100));
  };
  const seqInitialDuration = seqDurationS();
  const animInitialDuration = seqInitialDuration != null ? null : animDurationS();
  const defaultDuration =
    exportDefaults.video?.seconds ??
    seqInitialDuration ??
    animInitialDuration ??
    videoDefaults.duration ??
    5;
  // A sequence (or a long animation loop) can legitimately run far past the 60s the
  // recording field allows for ordinary "record the animation for a while" tools, so
  // it takes the timeline's own ceiling (1 hour). Non-timed tools keep the 60s cap.
  const durationMax = seqInitialDuration != null || animInitialDuration != null ? MAX_TIME_S : 60;

  // Directional glyphs that live inside the dimension inputs: ↔ marks width,
  // ↕ marks height, so the two fields read as "wide × tall" without labels.
  const ICON_W = `<svg class="dim-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="7 8 3 12 7 16"/><polyline points="17 8 21 12 17 16"/><line x1="4" y1="12" x2="20" y2="12"/></svg>`;
  const ICON_H = `<svg class="dim-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="8 7 12 3 16 7"/><polyline points="8 17 12 21 16 17"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`;

  // ?c2pa= (parsed { on, days }) beats the tool's render.c2pa default; the days
  // value pre-selects the ephemeral-lifetime picker in the protection card.
  // Hoisted above autoFilename because the name suffix reads the same defaults.
  const c2paInitOn = exportDefaults.c2pa ? exportDefaults.c2pa.on : c2paDefaultOn(manifest);
  const c2paInitDays = [7, 30, 90, 365].includes(exportDefaults.c2pa?.days as number)
    ? exportDefaults.c2pa!.days
    : 30;

  // Will this export carry provenance? Reads the live protection checkboxes once
  // they exist; before the panel paints it falls back to the same defaults the
  // checkboxes initialise from. Gated per format, so a plain .txt never claims it.
  const provenanceOn = (): boolean => {
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
  const autoFilename = (): string => {
    const base =
      deriveExportFilename(
        manifest,
        Object.fromEntries(runtime.getModel().map((i) => [i.id, i.value]))
      ) || manifest.name;
    return provenanceOn() && !/-lolly$/i.test(base) ? `${base}-lolly` : base;
  };

  // Tier 1 - filename · format. The format selector is the highest-priority
  // control; the filename rides alongside it as the natural "name.format" pair.
  //
  // The float interchange formats (exr/hdr) are compositing containers, not peers
  // of png/jpg, so they sit in their own native <optgroup> - no custom CSS, no
  // extra space, native a11y. The group is built from what SURVIVED keepFormat, so
  // it exists only where those formats can actually be produced: on the web that is
  // a tool with a float-compose exportStill hook (see toolDeepExport above - Bitmap
  // Studio), and otherwise nowhere (a plain tool has no float master). The markup
  // then has no optgroup in it at all. See views/export-depth.ts.
  const formatOptions = formatOptionsHtml(formats, initialFmt, fmtLabel);
  // The native select is kept as the VALUE CARRIER only (hidden): the mode-driven
  // narrowing, matchExportFormat auto-pick and every 'change' listener still talk
  // to it. What the user sees is the grouped picker: the pill's trigger half plus
  // a floating dropdown anchored to this row (views/export-format-picker.ts) -
  // floating so the rows below never move when it opens.
  const filenameRow = `
      <div class="filename-extension">
        <input type="text" class="export-filename" data-action="filename"
              value="${escape(exportDefaults.filename ?? '')}" placeholder="${escape(autoFilename())}" spellcheck="false">
        ${
          formats.length > 1
            ? `
          <select data-action="format" aria-label="Export format" hidden aria-hidden="true" tabindex="-1">
            ${formatOptions}
          </select>
          ${formatTriggerHtml(initialFmt ?? formats[0] ?? '', fmtLabel)}
          ${formatPanelHtml(formats, initialFmt ?? formats[0] ?? '', fmtLabel, experience.current?.().recommendedFormats)}
        `
            : ''
        }
      </div>`;

  // Tier 2 - dimensions. The primary sizing control: full-width, prominent,
  // with the directional icon inside each field.
  const initUnit = exportDefaults.unit ?? 'px';
  const initDpi = exportDefaults.dpi ?? 300;
  const dimsRow =
    manifest.render.dims !== false
      ? `
      <div class="export-dims">
        <div class="dim-field">
          ${ICON_W}
          <input type="number" data-action="export-width" data-scrub aria-label="Width"
                 value="${exportDefaults.width ?? manifest.render.width}" min="1" max="100000" step="any">
        </div>
        <div class="dim-field">
          ${ICON_H}
          <input type="number" data-action="export-height" data-scrub aria-label="Height"
                 value="${exportDefaults.height ?? manifest.render.height}" min="1" max="100000" step="any">
        </div>
        ${
          manifest.render.units === false
            ? ''
            : `
        <select class="dim-unit" data-action="export-unit" aria-label="Units"
                title="Units for width & height. Physical units (mm/cm/in/pt) export at the right size for print - PDF as a true page, raster at the chosen DPI.">
          ${UNITS.map((u) => `<option value="${u}" ${u === initUnit ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
        <label class="dim-dpi" data-dpi-field style="display:${initUnit === 'px' ? 'none' : 'inline-flex'}"
               title="Raster resolution for physical units (ignored for vector formats).">
          <input type="number" data-action="export-dpi" value="${initDpi}" min="36" max="1200" step="1" aria-label="DPI">
          <span>DPI</span>
        </label>`
        }
      </div>`
      : '';

  // Editor-only aspect-ratio guard (manifest.render.aspectWarning). A hidden alert
  // beside the dimension controls, shown when the chosen page size falls outside the
  // tool's supported orientation band - see updateAspectWarning(). Never exported.
  const ICON_WARN = `<svg class="aspect-warn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  const aspectWarnRow =
    manifest.render.aspectWarning && manifest.render.dims !== false
      ? `<div class="export-aspect-warning" data-aspect-warning role="alert" hidden>${ICON_WARN}<span data-aspect-warning-text></span></div>`
      : '';

  // Export-fidelity guard. Some CSS the canvas can paint has no equivalent in the
  // chosen output format, and until now it simply vanished from the file with nothing
  // said. `backdrop-filter` (frosted glass) is the first case wired up: only SVG can
  // reconstruct it, so every other format exports the panel unfrosted. Same hidden
  // alert shape as the aspect guard, driven by updateFidelityWarning(). Never exported.
  const fidelityWarnRow = `<div class="export-aspect-warning" data-fidelity-warning role="alert" hidden>${ICON_WARN}<span data-fidelity-warning-text></span></div>`;

  // Tier 2.5 - colour profile (Print PDF only). The CMYK press condition embedded
  // in the PDF's OutputIntent. A self-contained card so this professional/print
  // setting reads as deliberate; revealed only when "Print PDF" (pdf-cmyk) is the
  // chosen format. Options come from the engine's CMYK_CONDITIONS registry.
  const ICON_DROP = `<svg class="cmyk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.7s6.5 7 6.5 11.8a6.5 6.5 0 0 1-13 0C5.5 9.7 12 2.7 12 2.7z"/></svg>`;
  const hasCmyk = formats.includes('pdf-cmyk') || formats.includes('cmyk-tiff');
  const initProfile =
    exportDefaults.profile && (CMYK_CONDITIONS as Record<string, unknown>)[exportDefaults.profile]
      ? exportDefaults.profile
      : DEFAULT_CMYK_CONDITION;
  const cmykOptions = Object.entries(CMYK_CONDITIONS)
    .map(
      ([key, c]) =>
        `<option value="${escape(key)}" ${key === initProfile ? 'selected' : ''}>${escape((c as { info?: string }).info)}</option>`
    )
    .join('');
  // The full explanation lives under the info icon (helpTip), not as a wall of body
  // text - same affordance as the C2PA / Imprint rows.
  const cmykTip = hasCmyk
    ? helpTip(
        "Names the CMYK press standard your printer targets: the Print PDF's output intent, the Print TIFF's metadata (the pixels stay untagged DeviceCMYK). An Embed row carries a profile from this device inside the PDF, which is what PDF/X-4 conformance needs; the file then claims it unless something else in the export can't (RGB artwork, the credit-text stamp, a strong password)."
      )
    : null;
  const cmykRow = hasCmyk
    ? `
      <div class="section-card export-cmyk" data-cmyk-only style="display:${isCmykFmt(initialFmt) ? 'flex' : 'none'}">
        <span class="cmyk-head help-tip-host">${ICON_DROP}<span>Color profile</span>${cmykTip!.button}${cmykTip!.pop}</span>
        <select class="field-select" data-action="cmyk-profile" aria-label="CMYK press profile">
          ${cmykOptions}
        </select>
      </div>`
    : '';

  // Tier 2.6 - PDF password (standard "PDF" only). A non-empty value locks the
  // exported PDF on open (jsPDF standard security handler, copy/modify restricted).
  // Revealed only when "PDF" is chosen - the print-PDF path (pdf-cmyk) re-saves
  // through pdf-lib, which can't write encrypted PDFs.
  //
  // URL-expressible by design: a `?password=` link can pre-set it for quick,
  // short-lived transactional use (event materials etc). That's clear-text in the
  // URL - an accepted trade-off for a basic lock, not for confidential material.
  // It is NOT persisted to the library at rest (see performSave); URL is the only
  // way it round-trips. The initial value below comes from the URL only.
  // Collapsed by default - a click-to-expand disclosure (mirrors the Print marks
  // card) so the field + caveat only surface when wanted, keeping the panel tight.
  // Pre-opened when a value arrives (e.g. ?password=) so it's visible. Collapse is
  // purely visual: the input remains the source of truth, so a typed value still
  // applies on export and survives collapse/expand.
  const ICON_LOCK = `<svg class="pdfpass-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  // The lock card serves both the PDF password tiers AND the ZIP bundle lock (the
  // engine's two-tier zip-crypto: standard ZipCrypto / strong AES-256). refreshLockTier
  // rewords the tier options + hint per format.
  const hasPdf = formats.includes('pdf');
  const hasZip = formats.includes('zip');
  const pdfPassInitOpen = Boolean(exportDefaults.password);
  const pdfPassRow =
    hasPdf || hasZip
      ? `
      <div class="section-card export-pdfpass${pdfPassInitOpen ? ' is-open' : ''}" data-pdf-only style="display:${initialFmt === 'pdf' || initialFmt === 'zip' ? 'flex' : 'none'}">
        <button type="button" class="pdfpass-head" data-action="pdfpass-toggle" aria-expanded="${pdfPassInitOpen}">${ICON_LOCK}<span>Password protect</span></button>
        <div class="pdfpass-body" data-pdfpass-body style="display:${pdfPassInitOpen ? 'flex' : 'none'}">
          <input type="password" data-action="pdf-password" autocomplete="new-password" spellcheck="false"
                 value="${escape(exportDefaults.password ?? '')}"
                 placeholder="Leave blank for no password" aria-label="Open password">
          <select class="pdfpass-tier field-select field-select--sm" data-action="pdf-lock-tier" aria-label="Encryption strength">
            <option value="standard">Standard lock - opens in any PDF app</option>
            <option value="strong">Strong · AES-256 - newer apps only ⓘ</option>
          </select>
          <p class="pdfpass-hint" data-pdfpass-hint>Requires this password to open the PDF. A basic 40-bit lock - it opens in any PDF app and travels in a share link, so treat it as a deterrent, not protection for confidential files.</p>
        </div>
      </div>`
      : '';

  const pkgRow = packageOptionsHtml(canPackage, initialFmt, manifest.id);

  // Tier 2.65 - Content Credentials, shown for every stampable container
  // (engine C2PA_FORMATS: pdf, png/apng, jpg, gif, svg, tiff, webp, mp4, webm).
  // Checking
  // it embeds a signed C2PA manifest into the finished bytes (the export
  // bridge stamps at the end of renderFormat - see stampC2pa in
  // bridge/export.js). For PDFs it is mutually exclusive with the
  // open-password: an encrypted document can't take the C2PA incremental
  // update (see refreshC2paUi). A tool pre-selects it via manifest render.c2pa.
  const ICON_CRED = `<svg class="c2pa-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 11.5 2 2 4-4"/></svg>`;
  // c2paInitOn / c2paInitDays are hoisted above autoFilename (the "-lolly" name
  // suffix reads the same defaults before the checkboxes exist).
  const c2paFormats = formats.filter(isC2paFmt);
  // The old always-visible explanation moves behind an info (?) tip so the card
  // reads as just "C2PA Credentials" + a toggle. The tip links to OUR on-device
  // /verify page (not the Adobe-run contentcredentials.org checker) so people can
  // confirm their own exports here.
  const c2paTip = c2paFormats.length
    ? helpTip(
        'Embeds a signed C2PA manifest recording that this file was made with Lolly - plus your name when profile details are on. ' +
          'Signed on-device, so viewers show it as an unverified credential unless you enrol a verified identity (Profile → Content Credentials).',
        { href: '#/verify', text: 'Check a file →' }
      )
    : null;
  const c2paRow = c2paFormats.length
    ? `
      <div class="section-card export-c2pa" data-c2pa-only style="display:${isC2paFmt(initialFmt) || initialFmt === 'zip' ? 'flex' : 'none'}">
        <label class="c2pa-enable field-toggle help-tip-host">
          <input type="checkbox" class="field-check" data-action="pdf-c2pa" ${c2paInitOn ? 'checked' : ''}>
          <span class="c2pa-head">${ICON_CRED}<span>C2PA Credentials</span></span>
          ${c2paTip!.button}
          ${c2paTip!.pop}
        </label>
        <p class="c2pa-hint" data-c2pa-webm style="display:${initialFmt === 'webm' ? 'block' : 'none'}">WebM credentials are Lolly's own mapping for now - external C2PA viewers can't read WebM.</p>
        <div class="c2pa-life" data-c2pa-life>
          <label class="c2pa-life-pick"><span class="c2pa-life-label">${escape(t('Verified for'))}</span>
            <select class="field-select field-select--sm field-select--auto" data-action="c2pa-days" aria-label="Credential lifetime">
              ${[7, 30, 90, 365].map((d) => `<option value="${d}"${d === c2paInitDays ? ' selected' : ''}>${d} days</option>`).join('')}
            </select>
          </label>
        </div>
      </div>`
    : '';

  // Tier 2.66 - the Lolly pixel imprint (engine pixel-watermark.ts): a durable,
  // imperceptible mark mixed into the exported pixels. It completes the provenance
  // story next to the C2PA card above - the credential is strippable, the pixel
  // mark survives re-encodes/screenshots, and /verify detects both. On by default,
  // like C2PA; `?imprint=0` unchecks it, and the toggle round-trips back into the
  // URL (see views/tool.ts syncUrl) - unchecking sets imprint=0, checking (the
  // default) drops the param entirely so a plain link stays clean.
  const imprintFmts = formats.filter(isImprintFmt);
  // A .pptx / .pdf is a CONTAINER: the Imprint can only ride raster images it
  // embeds, never the native vector slides/shapes or byte-faithful user uploads.
  // A deck of headings, boxes and a vector logo (or one whose only pictures are
  // your own photos) therefore carries no detectable Imprint even with it on - so
  // say so rather than let the toggle over-promise. It rides baked content:
  // rotated or CSS-filtered elements, effect layers, inline SVG art, rendered charts.
  const containerImprintFmt = imprintFmts.some(
    (f) => f === 'pptx' || f === 'pdf' || f === 'pdf-cmyk'
  );
  const imprintTip = imprintFmts.length
    ? helpTip(
        t(
          'Hides the Lolly Imprint - a durable, invisible watermark - in the image pixels. It survives re-encoding and screenshots, so any copy of the file can be recognised later.'
        ) +
          (containerImprintFmt
            ? ' ' +
              t(
                'It rides embedded raster images, not the vector shapes and text - a slide or page built only of headings, boxes and a vector logo has no pixels to carry it.'
              )
            : ''),
        { href: '#/verify', text: t('Check a file →') }
      )
    : null;
  const imprintRow = imprintFmts.length
    ? `
      <div class="section-card export-c2pa export-imprint" data-imprint-only style="display:${isImprintFmt(initialFmt) || initialFmt === 'zip' ? 'flex' : 'none'}">
        <label class="c2pa-enable field-toggle help-tip-host">
          <input type="checkbox" class="field-check" data-action="imprint" ${exportDefaults.imprint !== false ? 'checked' : ''}>
          <span class="c2pa-head">${icon('imprint', { className: 'c2pa-icon' })}<span>${t('Lolly Imprint')}</span></span>
          ${imprintTip!.button}
          ${imprintTip!.pop}
        </label>
      </div>`
    : '';

  // Tier 2.67 - the DURABLE credential (opt-in). The card, its help tip and the
  // model-route probe all live in views/export-durable-card.ts; this view keeps
  // only the live route flag, which refreshPrintUi reads for visibility.
  let durableRouteOk = durableSupport();
  const durableFmts = formats.filter(isDurableFmt);
  const durableRow = durableCardHtml({
    present: durableFmts.length > 0,
    visible: durableRouteOk && isDurableFmt(initialFmt),
    checked: !!exportDefaults.durable,
  });

  // HDR (Rec.2100 PQ) raster export - OPT-IN, off by default. Boosts the brand's
  // primary colours (the live palette) toward peak luminance so white text and
  // brand colours glow on HDR displays while darks stay dark; SDR viewers see a
  // normal image. Raster only (png/jpeg today). Round-trips into the URL as
  // ?hdr=1 (see views/tool.ts syncUrl + engine/src/hdr.ts).
  const hdrFmts = formats.filter(isHdrFmt);
  const hdrTip = hdrFmts.length
    ? helpTip(
        t(
          'HDR (Rec.2100 PQ) boosts your brand colours and white text toward peak brightness so they glow on HDR-capable screens - Safari/Preview on Apple devices, Chrome on an HDR display - while dark areas stay dark. IMPORTANT: only use it where the destination supports HDR. Many platforms (social media, messaging apps, some websites) re-encode uploads and strip the HDR signal, which can leave the image looking dark or washed out. On an ordinary SDR screen it still shows as a normal image.'
        )
      )
    : null;
  // Author dials - seeded from a tuned ?hdr= value, else the engine defaults. The
  // body reveals when the toggle is on (like the print card). All four map onto
  // hdrBoostToPQ knobs in the bridge (see export.ts hdrTune): White = peak nits,
  // Reach = how far down the tones the glow spreads, Dark lift = how much darks
  // brighten (0 keeps them dark), Focus = colour richness of the boost.
  const hdrTune = exportDefaults.hdrTune ?? HDR_DEFAULTS;
  const hdrSlider = (
    action: string,
    label: string,
    min: number,
    max: number,
    step: number,
    val: number
  ): string =>
    `<label class="hdr-slider"><span>${t(label)}</span><input type="range" class="field-range" data-action="${action}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
  const hdrRow = hdrFmts.length
    ? `
      <div class="section-card export-hdr" data-hdr-only style="display:${isHdrFmt(initialFmt) ? 'flex' : 'none'}">
        <label class="hdr-enable field-toggle help-tip-host">
          <input type="checkbox" class="field-check" data-action="hdr" ${exportDefaults.hdr ? 'checked' : ''}>
          <span class="hdr-head">${icon('sunburst', { className: 'hdr-icon' })}<span>${t('HDR (bright colours)')}</span></span>
          ${hdrTip!.button}
          ${hdrTip!.pop}
        </label>
        <div class="hdr-body" data-hdr-body style="display:${exportDefaults.hdr ? 'grid' : 'none'}">
          ${hdrSlider('hdr-peak', 'White', 400, 2000, 50, hdrTune.peakNits)}
          ${hdrSlider('hdr-reach', 'Reach', 0, 100, 5, hdrTune.reach)}
          ${hdrSlider('hdr-lift', 'Dark lift', 0, 100, 5, hdrTune.lift)}
          ${hdrSlider('hdr-focus', 'Focus', 0, 100, 5, hdrTune.richness)}
        </div>
      </div>`
    : '';

  // Tier 2.7 - print marks & bleed (pdf / pdf-cmyk / cmyk-tiff). An opt-in card
  // (master checkbox) so ordinary output stays trim-sized; turning it on reveals a
  // bleed field (default 3mm) + the mark toggles at print-standard defaults. Mark
  // size, gap and stroke weight are fixed in the engine (see print-marks.js).
  const ICON_CROP = `<svg class="print-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2v16h16"/><path d="M2 6h16v16"/></svg>`;
  // Print finishing applies to a single trim-sized artwork; tools that emit
  // per-page boxes (multi-page PDF) opt out via render.printMarks:false so the
  // card isn't shown promising marks the multi-page export path doesn't apply.
  const hasPrint = (hasPdf || hasCmyk) && manifest.render.printMarks !== false;
  // Marks & bleed default ON only where there is PRINT INTENT: picking a separating
  // press format (Print PDF / Print TIFF / CMYK EPS), a manifest that declares
  // render.printMarks: true, or an explicit bleed/marks preference from a link/save.
  // The RGB vector formats (pdf / svg / eps) still SHOW the card - they can carry
  // marks - but its master toggle starts OFF, so an everyday PDF or SVG export is
  // trim-sized and unmarked until the user asks. Physical units alone never count
  // as print intent (see isPressFmt above).
  const declaresPrintIntent = manifest.render.printMarks === true;
  const printIntentFmt = (f: string | undefined): boolean =>
    isPressFmt(f) || (declaresPrintIntent && isPrintFmt(f));
  const printInitOn =
    Boolean(exportDefaults.bleed || exportDefaults.marks) || printIntentFmt(initialFmt);
  const printInitMm = exportDefaults.bleed ? parseFloat(exportDefaults.bleed) || 3 : 3;
  // Colour bars default ON for the CMYK print formats (the press uses them as a
  // control strip), OFF for the RGB pdf. An explicit marks default (link/save) wins.
  // 'Stamp details' (provenance) is always pre-checked: the credit stamp is on by
  // default whenever the print-marks card is enabled, regardless of any remembered
  // marks state. The other marks still restore from saved/linked defaults.
  const pim = {
    ...DEFAULT_PRINT_MARKS,
    colorBars: isCmykFmt(initialFmt),
    ...(exportDefaults.marks || {}),
    provenance: true,
  };
  const printRow = hasPrint
    ? `
      <div class="section-card export-print" data-printmarks-only style="display:${isPrintFmt(initialFmt) ? 'flex' : 'none'}">
        <label class="print-enable field-toggle">
          <input type="checkbox" class="field-check" data-action="print-enable" ${printInitOn ? 'checked' : ''}>
          <span class="print-head">${ICON_CROP}<span>Print marks &amp; bleed</span></span>
        </label>
        <div class="print-body" data-print-body style="display:${printInitOn ? 'flex' : 'none'}">
          <label class="print-bleed">
            <span>Bleed</span>
            <input type="number" data-action="print-bleed" value="${printInitMm}" min="0" max="25" step="0.5" aria-label="Bleed in millimetres">
            <span>mm</span>
          </label>
          <div class="print-toggles">
            <label class="export-option"><input type="checkbox" class="field-check" data-action="mark-crop" ${pim.crop ? 'checked' : ''}> Crop</label>
            <label class="export-option"><input type="checkbox" class="field-check" data-action="mark-reg" ${pim.registration ? 'checked' : ''}> Registration</label>
            <label class="export-option"><input type="checkbox" class="field-check" data-action="mark-bleed" ${pim.bleed ? 'checked' : ''}> Bleed</label>
            <label class="export-option"><input type="checkbox" class="field-check" data-action="mark-bars" ${pim.colorBars ? 'checked' : ''}> Color bars</label>
            <label class="export-option"><input type="checkbox" class="field-check" data-action="mark-prov" ${pim.provenance ? 'checked' : ''}> Stamp details</label>
          </div>
          <p class="print-hint">Adds bleed and the chosen marks for a print shop; the artwork is scaled to fill the bleed. Registration marks print on all four plates in the Print PDF and Print TIFF. (An open-password can't be combined with marks.)</p>
        </div>
      </div>`
    : '';

  // Tier 2.8 - "Content protection": one collapsed disclosure folding the
  // provenance/protection cards (password, C2PA, Imprint) so the panel shows one
  // header instead of up to three separate boxes. Print marks & bleed are NOT in
  // here - they're print PRODUCTION geometry, not content protection, so printRow
  // stays its own top-level section (see the assembly below). Purely a wrapping
  // shell - none of the inner cards' own markup, classes, data-actions, defaults
  // or per-format [data-*-only] gating changes; this only adds one more OUTER
  // layer of visibility on top (see refreshPrintUi, which also owns hiding the
  // whole wrapper when NONE of the three apply to the selected format).
  const hasProtection = hasPdf || hasZip || c2paFormats.length > 0 || imprintFmts.length > 0;
  // Collapsed by default. Pre-opened only when an inner card carries an EXPLICIT
  // deep-linked setting - a URL-sourced password, a URL-sourced C2PA choice, or a
  // linked imprint/durable flag - so a share link still surfaces its setting without
  // an extra click. The mere default-on C2PA state (c2paInitOn) does NOT open it, so
  // the common case shows a single tidy collapsed header.
  const protectionOpen =
    pdfPassInitOpen ||
    Boolean(exportDefaults.c2pa) ||
    Boolean(exportDefaults.imprint) ||
    Boolean(exportDefaults.durable);
  // Matches the canonical per-format predicates the inner cards already use
  // (isC2paFmt/isImprintFmt, plus the password card's pdf/pdf-cmyk/zip set) -
  // never loosened, just OR'd together to decide the outer wrapper.
  const protectionVisibleInitial =
    initialFmt === 'pdf' ||
    initialFmt === 'pdf-cmyk' ||
    initialFmt === 'zip' ||
    isC2paFmt(initialFmt) ||
    isImprintFmt(initialFmt);
  const protectionRow = hasProtection
    ? `
      <div class="section-card export-protection${protectionOpen ? ' is-open' : ''}" data-protection-section style="display:${protectionVisibleInitial ? 'flex' : 'none'}">
        <button type="button" class="protection-head" data-action="protection-toggle" aria-expanded="${protectionOpen}">${icon('shield', { className: 'protection-icon' })}<span>${t('Content protection')}</span></button>
        <div class="protection-body" data-protection-body style="display:${protectionOpen ? 'flex' : 'none'}">
          ${pdfPassRow}${c2paRow}${imprintRow}${durableRow}
        </div>
      </div>`
    : '';

  // Tier 3 - ancillary settings. Everything optional (transparent bg, dithering)
  // lives in one wrapping chip cluster so the panel reads consistently no matter
  // which controls a given tool/format enables.
  //
  // Several of these inputs are injected by the engine WITH a help string
  // (inputs.ts synthesises 'Convert paths' and explains what turning it off keeps),
  // and the chip used to drop that text on the floor - the one control in the sheet
  // whose jargon had an answer written for it that nobody could read. Render it as
  // the same (i) affordance the sidebar and the cards above use. The LABEL still
  // comes from the engine, untouched.
  const optionChips = exportOpts
    .map((i) => {
      // 'Convert paths' only affects vector output, so its chip is gated to the
      // selected format (hidden for png/jpg/etc). Other export options are global.
      const vectorOnly = i.id === 'convertPaths';
      const hide = vectorOnly && !isVectorFmt(initialFmt);
      const tip = i.help ? helpTip(i.help) : null;
      return `
        <label class="export-option${tip ? ' help-tip-host' : ''}"${vectorOnly ? ' data-vector-only' : ''}${hide ? ' style="display:none"' : ''}>
          <input type="checkbox" class="field-check" data-input-id="${escape(i.id)}" ${i.value ? 'checked' : ''}>
          ${escape(i.label ?? i.id)}
          ${tip ? `${tip.button}${tip.pop}` : ''}
        </label>`;
    })
    .join('');

  // F22 (plans/163) - transparency, mirrored from the sidebar.
  //
  // The engine synthesises `transparentBg` as an ordinary SIDEBAR input, not an
  // export one (inputs.ts): the background is a creative choice people make next to
  // colour and theme. True - but the moment they go looking for it is when they are
  // exporting a PNG, and by then the sidebar is behind the sheet. So the same input
  // gets a second home here, as one more chip in the strip beside Convert paths.
  // One input id, two views of it, never two settings. Only shown for a format with
  // an alpha channel to keep; the label and the help text come from the engine's
  // spec, exactly like the chips above.
  // A tool may declare `transparentBg` itself instead of letting the engine synthesise
  // it (asset-export calls it "No background"); either way it is the same input id and
  // the same checkbox. The type test keeps the mirror honest if one is ever declared as
  // something other than a boolean.
  const transparentInput = runtime
    .getModel()
    .find((i) => i.id === 'transparentBg' && i.type === 'boolean');
  const transparentTip = transparentInput?.help ? helpTip(transparentInput.help) : null;
  const transparentChip = transparentInput
    ? `
        <label class="export-option${transparentTip ? ' help-tip-host' : ''}" data-alpha-only
               style="display:${isAlphaFmt(initialFmt) ? 'flex' : 'none'}">
          <input type="checkbox" class="field-check" data-action="transparent-bg" ${transparentInput.value ? 'checked' : ''}>
          ${escape(transparentInput.label ?? transparentInput.id)}
          ${transparentTip ? `${transparentTip.button}${transparentTip.pop}` : ''}
        </label>`
    : '';
  // Tier 2.1 - timing (animated formats only). How long the clip runs, and how long
  // to hold before recording starts, are size-like decisions: for a video the length
  // is the first thing anyone changes. So the row sits directly under the dimensions
  // rather than at the bottom of the optional chip strip, where it used to rank below
  // the audio card's ducking controls. The Dither toggle rides along because it is
  // the GIF-only quality dial for the same take. Nothing else moves: the data-actions,
  // the [data-anim-params] / [data-gif-only] / [data-video-only] hooks and the
  // per-format show/hide handlers are the same ones as before.
  const timingTip = hasAnimated
    ? helpTip(
        t(
          'Start after holds the canvas still for a moment before recording begins, so animations and fonts settle first. Duration is how long the finished clip runs.'
        )
      )
    : null;
  const liveTip =
    hasAnimated && liveCaptureSupport()
      ? helpTip(
          t(
            'Records the on-screen preview in real time through a screen share, so motion matches exactly what you see. Pick this tab in the share dialog and keep it visible for the whole take.'
          )
        )
      : null;
  const timingRow = hasAnimated
    ? `
        <div class="video-params" data-anim-params style="display:${isAnimatedFmt(initialFmt) ? 'flex' : 'none'}">
          <span class="vp-field help-tip-host"><span>${escape(t('Start after'))}</span>
            <input type="number" data-action="video-wait" value="${defaultWait}" min="0" max="30" step="0.5"
                   aria-label="${escape(t('Start recording after (seconds)'))}"><span>s</span>${timingTip!.button}${timingTip!.pop}</span>
          <span class="vp-field"><span>${escape(t('Duration'))}</span>
            <input type="number" data-action="video-duration" value="${defaultDuration}" min="1" max="${durationMax}" step="0.5"
                   aria-label="${escape(t('Recording duration (seconds)'))}"><span>s</span></span>
          <label class="gif-dither-toggle" data-gif-only
                 style="display:${initialFmt === 'gif' ? 'flex' : 'none'}">
            <input type="checkbox" class="field-check" data-action="gif-dither">
            Dither
          </label>
          ${
            liveTip
              ? `<label class="gif-dither-toggle help-tip-host" data-video-only data-live-capture
                 style="display:${isVideoFmt(initialFmt) ? 'flex' : 'none'}">
            <input type="checkbox" class="field-check" data-action="video-live">
            ${escape(t('Record live'))}
            ${liveTip.button}${liveTip.pop}
          </label>`
              : ''
          }
          ${runtime.hasFrameHook ? `<span class="vp-live-hint" style="flex-basis:100%;font-size:11px;opacity:.7;margin-top:2px">Records the live feed - start <strong>Go&nbsp;live</strong> on the canvas first.</span>` : ''}
        </div>`
    : '';
  // Audio track card - webm/mp4 only. An optional catalog music bed (type:
  // 'audio', suse/music/*) muxed into the recording; it plays for the clip
  // duration, looping when the clip outlasts the track. Options are filled
  // async from host.assets.query once per mount (see below) - the selection is
  // popup-local like wait/duration, never serialized into URLs or share links.
  const ICON_NOTE = `<svg class="audio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
  const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.79-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14z"/></svg>`;
  const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>`;
  const hasVideo = formats.some(isVideoFmt);
  // The "plays for the clip duration, loops as needed, WebM/MP4 only" note moves
  // behind the same inline (i) tip the sidebar's input helpers use, so the card
  // stays compact - heading + track picker, with the explanation on demand.
  const audioTip = hasVideo
    ? helpTip('Plays under the clip for its full duration, looping as needed. WebM and MP4 only.')
    : null;
  // A tool with its own audio slot (assetType 'audio', e.g. the audiogram) always
  // contributes that audio to the export (resolved live from the sidebar pick), and
  // the card becomes two rows: the tool's audio with a level slider, plus an
  // optional mix-in track whose CENTRE level (off/low/full) sets the bed's gain
  // while the tool audio plays - full at the top and tail (section 6.1). "Generate music"
  // composes a seeded ZzFXM tune on-device (engine composeSong → render worker →
  // transient WAV). Tools without an audio slot keep the single-bed card.
  const hasToolAudioInput = runtime
    .getModel()
    .some((i) => i.type === 'asset' && i.assetType === 'audio');
  const toolAudioTip =
    hasToolAudioInput && hasVideo
      ? helpTip(t('Always included when the tool has audio picked. WebM and MP4 only.'))
      : null;
  const mixTip =
    hasToolAudioInput && hasVideo
      ? helpTip(
          t(
            'Plays at full volume before and after this tool’s audio and eases to the centre volume underneath it.'
          )
        )
      : null;
  const bedPickHtml = `
        <div class="audio-pick">
          <select class="field-select" data-action="video-audio" aria-label="${hasToolAudioInput ? escape(t('Mix-in track')) : 'Audio track'}"
                  title="${hasToolAudioInput ? escape(t('Optional track mixed around this tool’s audio, looping if the clip is longer than the track.')) : 'Optional music bed muxed into the recording - plays for the clip duration, looping if the clip is longer than the track.'}">
            <option value="">None</option>
            <option value="__generate__">${escape(t('Generate music'))}</option>
          </select>
          <button type="button" class="audio-preview" data-action="audio-preview" title="Preview track" aria-label="Preview track" disabled>${ICON_PLAY}</button>
          <button type="button" class="audio-preview" data-action="audio-regen" hidden title="${escape(t('Regenerate music'))}" aria-label="${escape(t('Regenerate music'))}">${icon('refresh')}</button>
        </div>
        <div class="audio-fade" data-track-extras style="display:none">
          <label>Fade in <input type="number" data-action="audio-fadein" min="0" max="5" step="0.5" value="1"><span>s</span></label>
          <label>Fade out <input type="number" data-action="audio-fadeout" min="0" max="5" step="0.5" value="1.5"><span>s</span></label>
        </div>`;
  const audioRow = !hasVideo
    ? ''
    : hasToolAudioInput
      ? `
      <div class="export-audio" data-video-only style="display:${isVideoFmt(initialFmt) ? 'flex' : 'none'}">
        <span class="audio-head help-tip-host">${ICON_NOTE}<span>${escape(t('This tool’s audio'))}</span>${toolAudioTip!.button}${toolAudioTip!.pop}</span>
        <div class="audio-fade">
          <label>${escape(t('Level'))} <input type="number" data-action="audio-tool-level" min="0" max="100" step="5" value="100" aria-label="${escape(t('Tool audio level'))}"><span>%</span></label>
        </div>
        <span class="audio-head help-tip-host">${ICON_NOTE}<span>${escape(t('Mix in'))}</span>${mixTip!.button}${mixTip!.pop}</span>
        ${bedPickHtml}
        <div class="audio-fade" data-track-extras style="display:none">
          <label>${escape(t('Centre volume'))}
            <select class="field-select" data-action="audio-centre" aria-label="${escape(t('Centre volume'))}"
                    title="${escape(t('The mix-in track’s volume while this tool’s audio is playing. It always plays at full volume before and after.'))}">
              <option value="off">${escape(t('Off'))}</option>
              <option value="low" selected>${escape(t('Low'))}</option>
              <option value="full">${escape(t('Full'))}</option>
            </select>
          </label>
        </div>
      </div>`
      : `
      <div class="export-audio" data-video-only style="display:${isVideoFmt(initialFmt) ? 'flex' : 'none'}">
        <span class="audio-head help-tip-host">${ICON_NOTE}<span>Audio track</span>${audioTip!.button}${audioTip!.pop}</span>
        ${bedPickHtml}
        <div class="audio-fade" data-track-extras style="display:none">
          <label>Music level <input type="number" data-action="audio-volume" min="0" max="100" step="5" value="100"><span>%</span></label>
          <label title="When your clip has its own sound, the music dips to this level under it (100% = no ducking).">Duck to <input type="number" data-action="audio-duck" min="0" max="100" step="5" value="35"><span>%</span></label>
        </div>
      </div>`;
  // Normalize loudness (plans/101 section 2.5): a master target for the WHOLE
  // exported mix - clips and bed together - measured to BS.1770 and applied as
  // one gain before the always-on true-peak limiter. Off by default so existing
  // projects keep their levels; the labels state real platform targets in the
  // correct unit, which almost nobody shipping does.
  const loudnessRow = !hasVideo
    ? ''
    : `
      <div class="export-audio export-loudness" data-video-only style="display:${isVideoFmt(initialFmt) ? 'flex' : 'none'}">
        <label>${escape(t('Loudness'))}
          <select class="field-select" data-action="audio-normalize" aria-label="${escape(t('Loudness'))}"
                  title="${escape(t('Normalize the exported mix to a platform loudness target. Off keeps your levels as authored.'))}">
            <option value="off" selected>${escape(t('Off'))}</option>
            <option value="-14">${escape(t('Streaming'))} (−14 LUFS)</option>
            <option value="-16">${escape(t('Podcast'))} (−16 LUFS)</option>
            <option value="-23">${escape(t('Broadcast'))} (−23 LUFS)</option>
          </select>
        </label>
      </div>`;

  // Captions (plans/180 section 4) - the three layers a moving export can carry, in
  // order of how reliably they reach a viewer.
  //
  //   Burned in    - the caption boxes on the canvas. They are part of the picture, so
  //                  they are always there and cannot be switched off from here; the
  //                  row says so rather than pretending it is a choice.
  //   Embedded     - a soft, player-toggleable WebVTT track beside the audio. WebM
  //                  carries it safely; MP4 stores it as ISO 14496-30 `wvtt`, which
  //                  Safari and QuickTime read and several Windows players ignore. So
  //                  the box follows the container until the user touches it: on for
  //                  WebM, off for MP4, and the MP4 note explains why.
  //   Sidecar      - a .vtt and a .srt beside the film. A render is one Blob, so
  //                  asking for these turns the download into a small zip.
  //
  // Every option is off-by-default for MP4 and adds nothing to a document with no
  // caption boxes and no cached transcript, so an untouched export is unchanged.
  const captionsTip = hasVideo
    ? helpTip(
        t(
          'Captions drawn on the canvas are always part of the picture. An embedded track can be switched off by the viewer’s player; the sidecar files are the ones an editor or a video platform will accept.'
        )
      )
    : null;
  const captionsRow = !hasVideo
    ? ''
    : `
      <div class="export-audio export-captions" data-video-only style="display:${isVideoFmt(initialFmt) ? 'flex' : 'none'}">
        <span class="audio-head help-tip-host">${icon('transcript', { className: 'audio-icon' })}<span>${escape(t('Captions'))}</span>${captionsTip!.button}${captionsTip!.pop}</span>
        <div class="audio-fade">
          <label title="${escape(t('Caption boxes on the canvas are drawn into every frame.'))}">
            <input type="checkbox" class="field-check" checked disabled aria-label="${escape(t('Burned in'))}">
            ${escape(t('Burned in'))}
          </label>
          <label>
            <input type="checkbox" class="field-check" data-action="captions-embed" ${initialFmt === 'webm' ? 'checked' : ''}>
            ${escape(t('Embedded track'))}
          </label>
          <label>
            <input type="checkbox" class="field-check" data-action="captions-sidecar">
            ${escape(t('Sidecar .vtt + .srt'))}
          </label>
        </div>
        <p class="section-card__hint" data-captions-mp4-note style="display:${initialFmt === 'mp4' ? 'block' : 'none'}">${escape(t('Some players ignore captions inside MP4'))}</p>
      </div>`;

  // WP-B: video quality select (Smaller / Balanced / Best) plus a default-collapsed
  // "Pro settings" disclosure (explicit codec, frame rate, rate mode, encoder hint).
  // Video-only. The quality stop drives the bitrate authority; the pro knobs override
  // the auto ladder / encoder config. Every control is optional - an untouched export
  // takes Balanced + the auto ladder + the encoder defaults, byte-for-byte as before.
  const ICON_SLIDERS = icon('sliders', { size: 14 });
  const videoQualityRow = !hasVideo
    ? ''
    : `
      <div class="export-video-quality" data-video-only style="display:${isVideoFmt(initialFmt) ? 'flex' : 'none'}">
        <label class="vp-field vq-main"><span>${escape(t('Quality'))}</span>
          <select class="field-select field-select--sm" data-action="video-quality" aria-label="${escape(t('Video quality'))}">
            <option value="smaller">${escape(t('Smaller file'))}</option>
            <option value="balanced" selected>${escape(t('Balanced'))}</option>
            <option value="best">${escape(t('Best quality'))}</option>
          </select>
        </label>
        <div class="section-card export-pro-settings">
          <button type="button" class="prosettings-head" data-action="prosettings-toggle" aria-expanded="false">${ICON_SLIDERS}<span>${escape(t('Pro settings'))}</span></button>
          <div class="prosettings-body" data-prosettings-body style="display:none">
            <label class="vp-field"><span>${escape(t('Codec'))}</span>
              <select class="field-select field-select--sm" data-action="video-codec" aria-label="${escape(t('Video codec'))}">
                <option value="" selected>${escape(t('Auto (best available)'))}</option>
                <option value="av01.0.08M.08">AV1</option>
                <option value="avc1.640033">H.264</option>
                <option value="hvc1.1.6.L93.B0">HEVC</option>
                <option value="vp09.00.10.08">VP9</option>
              </select>
            </label>
            <label class="vp-field"><span>${escape(t('Frame rate'))}</span>
              <select class="field-select field-select--sm" data-action="video-fps" aria-label="${escape(t('Frame rate'))}">
                <option value="" selected>${escape(t('Auto'))}</option>
                <option value="24">24</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="50">50</option>
                <option value="60">60</option>
              </select>
            </label>
            <label class="vp-field"><span>${escape(t('Rate mode'))}</span>
              <select class="field-select field-select--sm" data-action="video-bitratemode" aria-label="${escape(t('Bitrate mode'))}">
                <option value="" selected>${escape(t('VBR (default)'))}</option>
                <option value="constant">${escape(t('CBR (constant)'))}</option>
              </select>
            </label>
            <label class="vp-field"><span>${escape(t('Encoder'))}</span>
              <select class="field-select field-select--sm" data-action="video-hwaccel" aria-label="${escape(t('Hardware acceleration'))}">
                <option value="" selected>${escape(t('Auto'))}</option>
                <option value="prefer-hardware">${escape(t('Prefer hardware'))}</option>
                <option value="prefer-software">${escape(t('Prefer software'))}</option>
              </select>
            </label>
          </div>
        </div>
      </div>`;

  // Full-page chip - HTML export only. Drops the fixed-size tool-canvas frame so
  // the saved page fills the whole browser window instead of a centred card.
  const hasHtml = formats.includes('html');
  const htmlChip = hasHtml
    ? `
        <label class="export-option" data-html-only style="display:${initialFmt === 'html' ? 'flex' : 'none'}"
               title="Drop the fixed-size canvas frame so the saved page fills the whole window.">
          <input type="checkbox" class="field-check" data-action="full-page" ${exportDefaults.nostage ? 'checked' : ''}>
          Full page
        </label>`
    : '';
  // Outline-fonts chip - EMF only. EMF keeps text LIVE by default (real GDI text
  // records, editable in Office / Google Drawings); this forces the old
  // text-as-paths output for when exact glyphs matter more than editability.
  const hasEmf = formats.includes('emf');
  const emfChip = hasEmf
    ? `
        <label class="export-option" data-emf-only style="display:${initialFmt === 'emf' ? 'flex' : 'none'}"
               title="${escape(t('Convert text to vector outlines so it looks identical everywhere. Off, text stays editable in Office and Google Slides but uses whatever fonts that device has.'))}">
          <input type="checkbox" class="field-check" data-action="emf-outline">
          ${t('Outline fonts')}
        </label>`
    : '';
  const settingsRow =
    transparentChip || optionChips || htmlChip || emfChip
      ? `<div class="export-settings">${transparentChip}${optionChips}${htmlChip}${emfChip}</div>`
      : '';

  // Cloud send destinations - the PROVIDER-AGNOSTIC send-target seam
  // (lib/send-target.ts): each built-in is dormant without its own config (e.g.
  // gdrive needs a Google OAuth client id), and a deployment's control plane can add
  // or replace kinds. The container renders per-format via renderSendTargets below.
  // Why this exists at all (the gdrive case): Drive re-types plain web uploads
  // server-side from its extension table (measured 2026-08-18), so an authenticated
  // upload is the one path that lands an EMF openable in - or converted straight
  // into - Google Drawings, the paste-into-Slides journey.
  //
  // The container is ALWAYS emitted, and hidden while it holds no cards. It used to be
  // conditional on sendTargetsFor() finding something at this instant, which was only
  // sound while the built-ins were registered during boot: they are loaded on demand
  // now (plans/155 Task 3.3, kicked off below), so at this line the registry is
  // legitimately empty on the first panel of the session and a conditional container
  // would decide "no Send section" for a tool that has one. Emitting it costs an empty
  // `hidden` div - the same shape as the ingredient note two rows up.
  const sendRow = '<div data-send-targets hidden></div>';

  // Tier 4 - actions. Copy · Save · Share share one equal-width row; Download is
  // the primary CTA, alone on its own full-width line at the very bottom.
  const CLIPBOARD_SVG = `<svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`;
  const copyBtn = actions.includes('copy')
    ? jellyActive()
      ? `<jelly-button variant="platinum" data-action="copy" class="copy-btn" title="Copy to clipboard" label="Copy">${CLIPBOARD_SVG}<span>Copy</span></jelly-button>`
      : `<button data-action="copy" class="copy-btn" title="Copy to clipboard">${CLIPBOARD_SVG}<span>Copy</span></button>`
    : '';
  const saveBtn = actions.includes('save') ? saveBtnHtml() : '';
  // Download is the primary CTA - jelly mode gives it the accent-fill squish.
  const initialExperience = experience.current?.() ?? {};
  const downloadLabel =
    initialExperience.downloadLabel ||
    `Download${formats.length === 1 ? ' ' + fmtLabel(formats[0]!) : ''}`;
  // Consult the generic export-policy seam (src/lib/export-policy.ts): dormant - or a
  // deployment that withholds nothing - resolves to 'download' and the CTA below is
  // byte-identical to today. When a control plane withholds download but permits an
  // approval request, the primary CTA becomes "Request approval" (Save still saves the
  // session locally); when it withholds both, the CTA is dropped for a small note - no
  // dead button. Gated on actions.includes('download') so a tool with no download
  // action is unaffected. The view holds no control-plane knowledge: it asks the seam
  // what it may offer, and routes "Request approval" through the generic opener.
  const affordance = actions.includes('download')
    ? exportAffordance(getExportPolicy())
    : 'download';
  // Same primary-CTA slot as Download, so it takes the same prominent jelly
  // recipe under the flag (the .download-btn-jelly class is a size/weight hook,
  // not download-specific); the delegated [data-action] handler is unchanged.
  const requestApprovalBtn = jellyActive()
    ? `<jelly-button data-action="request-approval" class="download-btn-jelly">${escape(t('Request approval'))}</jelly-button>`
    : `<button type="button" data-action="request-approval">${escape(t('Request approval'))}</button>`;
  const downloadBtn = !actions.includes('download')
    ? ''
    : affordance === 'request-approval'
      ? requestApprovalBtn
      : affordance === 'blocked'
        ? ''
        : // The native button's ↓ affordance is a ::before glyph; the bridge strips
          // pseudo-content off jelly hosts (it painted at the host corner, outside
          // the capsule), so the jelly label carries the arrow as plain text.
          jellyActive()
          ? `<jelly-button data-action="download" class="download-btn-jelly">↓ <span data-download-label>${escape(downloadLabel)}</span></jelly-button>`
          : `<button data-action="download"><span data-download-label>${escape(downloadLabel)}</span></button>`;
  // The Tauri desktop export override registers this one-shot seam, and a browser
  // with the File System Access API answers it the same way (saveAsBridge). Where
  // neither can, nothing renders: the fast Downloads action stays the single CTA,
  // and the secondary file-dialog path is a quiet addition beside it.
  const desktopExport = saveAsBridge();
  const saveAsBtn = saveAsButtonHtml(
    Boolean(desktopExport && downloadBtn && affordance === 'download')
  );
  const blockedNote =
    actions.includes('download') && affordance === 'blocked'
      ? `<p class="export-blocked-note" role="status" style="margin:.2rem 0 0;color:hsl(var(--muted-foreground));font-size:12px;text-align:center">${escape(t('Downloading is turned off for this tool on this instance.'))}</p>`
      : '';
  // Tier 3.5 - "Before you export". LAST of the cards, below every setting and
  // immediately above the buttons: it is not a setting, it is a statement ABOUT
  // the settings, so it must sit under all of them or it would contradict a
  // control the user has not reached yet. Hidden until the engine's rules have
  // something true to say; see views/export-preflight.ts + refreshPreflight().
  const isDesignTool = manifest.id === 'design';
  const notesHandoutRow =
    isDesignTool && formats.includes('pdf')
      ? `
      <div class="section-card export-notes-handout" data-notes-handout-only style="display:${initialFmt === 'pdf' && canvasEl?.querySelector('[data-pdf-page]') ? 'flex' : 'none'}">
        <label class="field-toggle">
          <input type="checkbox" class="field-check" data-action="pdf-notes-handout">
          <span class="notes-handout-head">${icon('transcript', { size: 18 })}<span>${escape(t('Speaker notes handout'))}</span></span>
        </label>
        <p class="print-hint">${escape(t('Makes a portrait PDF with each slide above its speaker notes. Long notes continue onto extra pages.'))}</p>
      </div>`
      : '';
  const preflightRow = preflightRowHtml({ force: isDesignTool });
  // Tier 3.6 - "Cost, worked out from your rate card". After preflight (it consumes
  // preflight's counts) and above the buttons. Chrome only: data-export-hide, never a
  // pixel of the export. Rendered only for a costable job with a card and canShowMoney.
  const costRow = costPanelHtml();
  const secondaryRow = `<div class="export-action-buttons">${copyBtn}${saveBtn}${copyUrlBtn}</div>`;
  const downloadRow = downloadBtn
    ? `<div class="export-action-buttons">${saveAsBtn}${downloadBtn}</div>`
    : blockedNote;

  // Audio-capture tools (render.capture:'audio'): the recording is the deliverable,
  // and the format list below only covers the share CARD - so the sheet leads with
  // a "Your recording" card fed by the latest take (lib/audio-take.ts, written by
  // views/record-control.ts). Before any take exists it says plainly what the
  // Download below saves, closing the "Export is not my recording" trap.
  const isAudioCaptureTool = manifest.render.capture === 'audio';
  const recordingRow = isAudioCaptureTool
    ? `
      <div class="section-card export-recording" data-recording-row>
        <span class="c2pa-head">${icon('mic', { className: 'c2pa-icon' })}<span>${escape(t('Your recording'))}</span></span>
        <div class="export-recording-body" data-recording-body></div>
      </div>`
    : '';

  // The panel host (#tool-actions) is present for every export-capable tool that
  // reaches here; guard the type for strict null-safety (never null in practice).
  if (!el) return;
  // Ingredient provenance note (plans/126 WP-B item 2): when this design's
  // chosen ASSET ingredients carry an AI declaration or AI-writing signals,
  // the export sheet says so in one hedged line each - the moment the file is
  // about to travel is the moment the maker deserves the reminder. UI note
  // only: nothing here changes what exports or what gets signed (the declared
  // flag already rides as a C2PA ingredient on its own path). Computed at
  // sheet-render time from top-level asset inputs; assets nested inside
  // `blocks` groups are not walked here.
  async function fillIngredientNote(): Promise<void> {
    const slot = el?.querySelector<HTMLElement>('[data-ingredient-note]');
    if (!slot) return;
    const ids = [
      ...new Set(
        runtime
          .getModel()
          .filter((i) => i.type === 'asset' && typeof i.value === 'string' && i.value)
          .map((i) => String(i.value))
      ),
    ];
    if (!ids.length) return;
    const declared: string[] = [];
    const flagged: string[] = [];
    for (const id of ids) {
      try {
        const ref = await host.assets.get(id);
        const meta = (ref.meta ?? {}) as {
          name?: unknown;
          aiGenerated?: unknown;
          aiSignals?: { v?: number; band?: string };
        };
        const name = String(meta.name ?? id);
        if (meta.aiGenerated === 'full' || meta.aiGenerated === 'partial') declared.push(name);
        else if (
          meta.aiSignals &&
          meta.aiSignals.v === LEXICON_VERSION &&
          (meta.aiSignals.band === 'notable' || meta.aiSignals.band === 'strong')
        )
          flagged.push(name);
      } catch {
        /* a missing asset has nothing to disclose */
      }
    }
    if (!declared.length && !flagged.length) return;
    slot.replaceChildren();
    if (declared.length) {
      const line = document.createElement('p');
      line.className = 'guide-fact';
      line.textContent = tRaw(
        "AI-declared ingredient in this design: {names}. The export's own credential declares this AI origin, signed and machine-readable.",
        { names: declared.join(', ') }
      );
      slot.appendChild(line);
    }
    if (flagged.length) {
      const line = document.createElement('p');
      line.className = 'guide-hint';
      line.textContent = tRaw(
        'An ingredient carries AI-writing signals: {names}. A signal, not proof - review it in the catalogue before this file travels.',
        { names: flagged.join(', ') }
      );
      slot.appendChild(line);
    }
    slot.hidden = false;
  }

  // The provenance ask, at the moment it means something (plans/137 WP-E). A file
  // has just been downloaded, so "should your details go into it?" is now a real
  // question about a real file rather than a cold prompt at boot - which is why
  // the gallery's personalize toast hands the ask over to here. One quiet line
  // under the buttons of the sheet the user is already looking at: never a dialog,
  // never over the shutter (that has reopened by now), never before the export.
  // It shows at most once per profile because it writes the SAME
  // personalizeNudgeDismissed flag the gallery toast reads, so whichever surface
  // asks first retires the other. Best-effort throughout - a profile store that
  // cannot be read or written costs nothing, the file has already reached the user.
  async function offerDetailsAsk(): Promise<boolean> {
    if (!el || el.querySelector('.export-details-ask')) return false;
    const store = host.profile as ProfileStore | undefined;
    if (!store?.get) return false;
    const current = await store.get();
    if (current.useDetails || current.personalizeNudgeDismissed) return false;
    const line = document.createElement('p');
    line.className = 'export-details-ask';
    line.textContent = t('Add your details to this file? They stay on this device.');
    const link = document.createElement('a');
    link.href = '#/profile?focus=use-details';
    link.textContent = t('Set up my details');
    line.append(' ', link);
    el.appendChild(line);
    await store.set?.({ ...current, personalizeNudgeDismissed: true });
    return true;
  }

  // The return ticket, taught once (audit 167 F-A11): every export carries its
  // full recipe, and Verify can resurrect the live session from the file alone -
  // the product's deepest retention hook, which nothing in the first-use journey
  // mentioned. One quiet line in the same slot as the details ask, on the first
  // download where that ask didn't run (the ask keeps priority - never two
  // teaching lines on one download). Device-local show-once flag: this is
  // chrome education like the tips strip, not tool or profile state.
  const REOPEN_NOTE_KEY = 'lolly-reopen-note-seen';
  function offerReopenNote(): void {
    if (!el || el.querySelector('.export-details-ask')) return;
    try {
      if (localStorage.getItem(REOPEN_NOTE_KEY)) return;
      localStorage.setItem(REOPEN_NOTE_KEY, '1');
    } catch {
      return;
    }
    const line = document.createElement('p');
    line.className = 'export-details-ask';
    line.textContent = t(
      'This file remembers how it was made - drop it on Lolly anytime to reopen it.'
    );
    const link = document.createElement('a');
    link.href = '#/verify';
    link.textContent = t('See for yourself');
    line.append(' ', link);
    el.appendChild(line);
  }

  // The action buttons are the sheet's PRIMARY content, so they come FIRST -
  // Copy / Save / Share and Download at the very top, before any setting - and
  // the dock sticks to the top edge so they stay in reach while the long sheets
  // (Print PDF, MP4) are scrolled.
  el.innerHTML = `
    <div class="export-actions-dock">
      <p class="export-outcome-summary" data-export-outcome${initialExperience.summary ? '' : ' hidden'}>${escape(initialExperience.summary ?? '')}</p>
      ${manifest.status === 'experimental' ? `<p class="export-experimental-note" role="note">${escape(t('This tool is experimental, so every export carries a watermark.'))}</p>` : ''}
      ${secondaryRow}
      ${downloadRow}
      ${actions.includes('download') ? `<p class="export-degraded-note" data-export-degraded role="status" hidden style="margin:.2rem 0 0;color:hsl(var(--muted-foreground));font-size:12px;text-align:center"></p>` : ''}
    </div>
    ${actions.includes('download') ? `${recordingRow}${filenameRow}${dimsRow}${timingRow}${aspectWarnRow}${fidelityWarnRow}${notesHandoutRow}${hdrRow}${cmykRow}${printRow}${pkgRow}${protectionRow}<div class="export-ingredient-note" data-ingredient-note hidden></div>${audioRow}${loudnessRow}${captionsRow}${settingsRow}${videoQualityRow}${sendRow}${preflightRow}${costRow}` : ''}
  `;
  void fillIngredientNote();

  // "Your recording" card (audio-capture tools): paints from the shared take
  // registry and repaints when a take arrives or is cleared. Save actions are
  // the same signed paths the stage's post-record bar uses.
  if (isAudioCaptureTool) {
    const recBody = el.querySelector<HTMLElement>('[data-recording-body]');
    const fmtSize = (n: number): string =>
      n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
    const paintRecording = (): void => {
      if (!recBody) return;
      const take = getAudioTake();
      if (!take) {
        recBody.innerHTML = `<p class="export-recording-hint">${escape(t('Nothing recorded yet. Record on the canvas first - Download saves the share card image, not audio.'))}</p>`;
        return;
      }
      recBody.innerHTML = `
        <div class="export-recording-actions">
          <button type="button" class="btn btn--primary" data-action="take-mp3">${escape(t('Save MP3'))}</button>
          <button type="button" class="btn" data-action="take-native">${escape(tRaw('Save .{ext}', { ext: takeNativeExt(take) }))}</button>
          <span class="export-recording-size">${fmtSize(take.blob.size)}</span>
        </div>`;
    };
    paintRecording();
    onAudioTakeChange(paintRecording);
    recBody?.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
      const take = getAudioTake();
      if (!btn || !take) return;
      if (btn.dataset.action === 'take-native') {
        void saveTakeNative(host, take);
        return;
      }
      if (btn.dataset.action === 'take-mp3') {
        const was = btn.textContent;
        btn.disabled = true;
        btn.textContent = t('Encoding…');
        try {
          await saveTakeMp3(host, take);
        } catch (err) {
          host.log('warn', 'export-sheet mp3 transcode failed - saving the native container', {
            error: String(err),
          });
          void saveTakeNative(host, take);
        } finally {
          btn.disabled = false;
          btn.textContent = was;
        }
      }
    });
  }

  exportOpts.forEach((i) => {
    el.querySelector<HTMLInputElement>(`[data-input-id="${escape(i.id)}"]`)?.addEventListener(
      'change',
      ({ target }) => runtime.setInput(i.id, (target as HTMLInputElement).checked)
    );
  });

  // The transparency mirror, wired BOTH ways against the one input it reflects.
  // Ticking the chip goes through runtime.setInput, so the canvas repaints under the
  // open sheet - seeing the background go is the whole point of putting it here. And
  // the sidebar still owns the same input, so follow the model back: subscribe fires
  // on every model change, and writing the same boolean onto a checkbox emits no
  // event, so there is no loop between the two views.
  const transparentEl = el.querySelector<HTMLInputElement>('[data-action="transparent-bg"]');
  if (transparentEl) {
    transparentEl.addEventListener('change', () =>
      runtime.setInput('transparentBg', transparentEl.checked)
    );
    runtime.subscribe(() => {
      transparentEl.checked = Boolean(
        runtime.getModel().find((i) => i.id === 'transparentBg')?.value
      );
    });
  }

  const animParamsEl = el.querySelector<HTMLElement>('[data-anim-params]');
  const ditherEl = el.querySelector<HTMLElement>('[data-gif-only]');
  const formatEl = el.querySelector<HTMLSelectElement>('[data-action="format"]');
  // The grouped-category UI over the hidden select (trigger + accordion panel).
  const formatPicker = wireFormatPicker(el, formatEl, fmtLabel, {
    recommended: initialExperience.recommendedFormats,
  });
  // The filename placeholder is derived from live input values plus the
  // provenance state, so it goes stale the moment either moves. Re-derive on
  // format/protection changes and every time the sheet opens (views/tool.ts
  // dispatches 'lolly:export-open' on the panel).
  const filenameInputEl = el.querySelector<HTMLInputElement>('[data-action="filename"]');
  const refreshFilenamePlaceholder = (): void => {
    if (filenameInputEl) filenameInputEl.placeholder = autoFilename();
  };
  formatEl?.addEventListener('change', refreshFilenamePlaceholder);
  el.querySelectorAll<HTMLInputElement>(
    '[data-action="pdf-c2pa"], [data-action="imprint"]'
  ).forEach((cb) => cb.addEventListener('change', refreshFilenamePlaceholder));
  el.addEventListener('lolly:export-open', refreshFilenamePlaceholder);
  const aspectWarnEl = el.querySelector<HTMLElement>('[data-aspect-warning]');
  const fidelityWarnEl = el.querySelector<HTMLElement>('[data-fidelity-warning]');
  const durationEl = el.querySelector<HTMLInputElement>('[data-action="video-duration"]');
  const liveLabelEl = el.querySelector<HTMLElement>('[data-live-capture]');
  // Seed the Pro-settings selects from a link's ?fps= / ?codec= / ?vq= (exportDefaults.video).
  // Only a value the select actually offers is applied; an odd fps (say 45) still reaches
  // the auto-export through tool.ts, it just cannot be shown here.
  {
    const v = exportDefaults.video;
    const seed = (sel: string, value: string | null | undefined): void => {
      if (value == null) return;
      const s = el.querySelector<HTMLSelectElement>(sel);
      if (s && [...s.options].some((o) => o.value === value)) s.value = value;
    };
    if (v) {
      seed('[data-action="video-fps"]', v.fps != null ? String(v.fps) : null);
      seed('[data-action="video-codec"]', v.codec ? VIDEO_CODEC_STRINGS[v.codec] : null);
      seed('[data-action="video-quality"]', v.quality ?? null);
    }
  }

  // ── Contact sheets: the "Frames" control (plans/fable-timeline-editing section 4.6) ─
  // A still export of a timed composition renders the frame at the playhead
  // (Andy's WYSIWYG rule). `cuts=N` instead samples N stills at equal MIDPOINT
  // intervals across the sequence - raster/SVG come back as a zip of N files, PDF
  // as N pages. Storyboards, thumbnail sheets, social carousels.
  //
  // The control exists ONLY while the artboard is a timed composition, and is
  // visible only for a still format - so no other tool, and no motion format, can
  // ever put `cuts` on the export opts. It's created/removed by syncFramesUi
  // (below) rather than baked into the panel HTML, because a canvas can BECOME a
  // sequence after mount (the MutationObserver path the Duration field already
  // uses) and a control that is merely hidden would still answer querySelector.
  const CUTS_MAX = 64; // a contact sheet is for human review; the engine clamps too
  const isStillFmt = (f: string | undefined): boolean =>
    !!f && ['png', 'jpg', 'jpeg', 'webp', 'svg', 'pdf'].includes(f);
  const hasStillFmt = formats.some(isStillFmt);
  const framesRowHtml = `
      <div class="export-dims export-frames" data-seq-still-only style="display:none">
        <label class="dim-dpi" title="${escape(t('Evenly spaced stills across the sequence. 1 exports the current playhead frame.'))}">
          <span>${escape(t('Frames'))}</span>
          <input type="number" data-action="export-cuts" value="1" min="1" max="${CUTS_MAX}" step="1"
                 aria-label="${escape(t('Frames to export'))}">
        </label>
      </div>`;
  /** Mount/unmount the Frames row for `isSeq`, then show it for still formats only. */
  function syncFramesUi(isSeq: boolean): void {
    if (!hasStillFmt || !actions.includes('download')) return;
    let row = el!.querySelector<HTMLElement>('[data-seq-still-only]');
    if (!isSeq) {
      row?.remove();
      return;
    }
    if (!row) {
      // Sits with the sizing controls: it is a "how much comes out" dial, like dims.
      const anchor =
        el!.querySelector<HTMLElement>('[data-aspect-warning]') ??
        el!.querySelector<HTMLElement>('.export-dims') ??
        el!.querySelector<HTMLElement>('.filename-extension');
      const frag = document.createElement('div');
      frag.innerHTML = framesRowHtml.trim();
      row = frag.firstElementChild as HTMLElement;
      if (anchor) anchor.after(row);
      else el!.prepend(row);
    }
    row.style.display = isStillFmt(formatEl?.value ?? initialFmt) ? 'flex' : 'none';
  }
  /** The Frames value as an integer in [1, CUTS_MAX]; nonsense (blank, 0, NaN) → 1. */
  function cutsValue(): number {
    const inp = el!.querySelector<HTMLInputElement>('[data-action="export-cuts"]');
    const n = Math.floor(Number(inp?.value));
    return Number.isFinite(n) && n >= 1 ? Math.min(CUTS_MAX, n) : 1;
  }

  // ── Sequence duration: follow the timeline, yield to the user ──────────────
  // ANDY'S RULE: the exported clip's duration matches the timeline's duration
  // always, UNLESS the user changes it here on export. This flag is the "unless":
  // it flips only on a real edit of the Duration field (a programmatic re-sync sets
  // .value directly and dispatches nothing, so it can never set it), and it rides
  // out to the export opts as `durationUserSet` - the tool hook keeps a deliberate
  // user value and overwrites everything else with the derived length.
  // A `seconds` carried by the link is the same deliberate instruction as a typed
  // value, so it starts the flag set and the derived-length re-sync never overrides it.
  let durationUserSet = exportDefaults.video?.seconds != null;
  durationEl?.addEventListener('input', () => {
    durationUserSet = true;
  });
  durationEl?.addEventListener('change', () => {
    durationUserSet = true;
  });

  // Re-seed the Duration field (and its ceiling) from the live timeline. Called at
  // mount and from the MutationObserver below, i.e. every time the artboard's
  // derived length changes. Adds nothing else to the panel: no control is hidden,
  // disabled or re-ordered for a sequence.
  function syncSequenceUi(): void {
    const isSeq = !!seqStageEl();
    const secs = seqDurationS();
    // An animated tool (window.__lollyAnim) seeds Duration from its loop when this
    // isn't a sequence; the sequence timeline wins if a tool were somehow both.
    const animSecs = isSeq ? null : animDurationS();
    // A bed's own length (data-clip-ms) seeds Duration too, but does not make the
    // tool a "timed composition": Record live stays offered, as it always was here.
    const clipSecs = isSeq || animSecs != null ? null : clipDurationS();
    const derived = secs ?? animSecs ?? clipSecs;
    const timed = isSeq || animSecs != null;
    if (durationEl) {
      // A timeline (or a long animation loop) may legitimately outrun the 60s
      // recording cap - take the 1-hour ceiling while it's timed, restore 60s if it
      // stops being one (every clip deleted, or the animation cleared).
      const max = timed || clipSecs != null ? String(MAX_TIME_S) : '60';
      if (durationEl.max !== max) durationEl.max = max;
      if (derived != null && !durationUserSet) {
        const next = String(derived);
        if (durationEl.value !== next) durationEl.value = next;
      }
    }
    // "Record live" is HIDDEN for a timed composition (Andy, 2026-07-27, after
    // testing it: "live record mode doesn't play or work but this method is fast").
    // Live capture screen-records the preview in real time, which for a sequence has
    // no advantage - the compositor renders the same thing deterministically at ~30x
    // realtime - and in practice the take did not animate. Rather than ship a control
    // that is slower AND wrong, it is suppressed here; the compositor is the only
    // motion path for a sequence. Suppression is a data flag, not a style write,
    // because the format-change handler re-shows every [data-video-only] control and
    // would otherwise undo it. Un-tick on the way out so a box ticked before the tool
    // became a sequence cannot leave opts.live set on a hidden control.
    if (liveLabelEl) {
      if (isSeq) liveLabelEl.dataset.suppressed = '1';
      else delete liveLabelEl.dataset.suppressed;
      if (isSeq) {
        liveLabelEl.style.display = 'none';
        const box = liveLabelEl.querySelector<HTMLInputElement>('[data-action="video-live"]');
        if (box?.checked) box.checked = false;
      }
    }
    syncFramesUi(isSeq);
  }
  // Observation mechanism: the export bar has no existing hook that fires AFTER the
  // canvas DOM is repainted - runtime.subscribe fires on model change, which is
  // before the template rehydrates and restamps data-seq-ms, so it would read the
  // previous length. A MutationObserver on the canvas is the event-driven read of
  // the thing that actually changed: `attributes` catches an in-place restamp,
  // `childList` catches the artboard being replaced wholesale by a re-render. It
  // lives as long as canvasEl does (same lifetime as the runtime.subscribe above);
  // there is no teardown seam here and none is needed - the node goes with the mount.
  if (canvasEl && (durationEl || liveLabelEl || hasStillFmt)) {
    new MutationObserver(() => syncSequenceUi()).observe(canvasEl, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-seq-ms', 'data-sequence', 'data-clip-ms'],
    });
  }
  syncSequenceUi();

  // Fill the colour-profile select with the profiles loaded on THIS device - the
  // only route to an embedded /DestOutputProfile, and therefore to a genuinely
  // PDF/X-4-conformant Print PDF (see lib/press-profile-embed.ts). The four
  // registry rows above keep their exact meaning: the condition's NAME, no bytes.
  // The size in each label is arithmetic off the stored asset, so it cannot rot
  // into a lie the way a written figure would.
  const cmykSel = el.querySelector<HTMLSelectElement>('[data-action="cmyk-profile"]');
  if (cmykSel) {
    const askedOwn = isOwnProfile(exportDefaults.profile);
    listEligible(host as never, 'CMYK')
      .then((rows) => {
        for (const e of rows) {
          const o = document.createElement('option');
          o.value = `own:${e.digest}`;
          o.textContent = embedRowLabel(e);
          cmykSel.append(o);
        }
        if (!askedOwn) return;
        // A link carries bare `own` (a digest is device-local): one eligible profile
        // resolves it, several or none does not - and guessing would let storage
        // order decide what a file DECLARES. Unresolved, the export embeds nothing
        // and declares nothing rather than falling back to a condition nobody chose,
        // so the row must SAY that instead of promising an embed: it stays selected
        // (the link still round-trips, and nothing is refused) but it is named after
        // the outcome, not the intention.
        const asked =
          ownDigest(exportDefaults.profile ?? '') ?? (rows.length === 1 ? rows[0]!.digest : null);
        if (asked && rows.some((r) => r.digest === asked)) {
          cmykSel.value = `own:${asked}`;
          return;
        }
        const o = document.createElement('option');
        o.value = 'own';
        o.textContent = rows.length
          ? 'Choose which profile to embed'
          : 'No profile on this device to embed';
        cmykSel.append(o);
        cmykSel.value = 'own';
      })
      .catch(() => {
        /* no profile store on this host - the registry rows stand alone */
      });
  }

  // Fill the audio-track select from the catalog (music beds, type: 'audio').
  // Once per mount - the popup DOM persists across open/close. Tolerates an
  // empty store (first visit before catalog sync finishes) and offline: the
  // select simply keeps its "None" option.
  const audioSel = el.querySelector<HTMLSelectElement>('[data-action="video-audio"]');
  if (audioSel) {
    host.assets
      .query({ type: 'audio' })
      .then((tracks) => {
        const tagsOf = (t: (typeof tracks)[number]): string[] =>
          (t.meta?.tags as string[] | undefined) ?? [];
        const isLoop = (t: (typeof tracks)[number]): boolean =>
          tagsOf(t).includes('neurospicy') || tagsOf(t).includes('loop');
        const byName = (a: (typeof tracks)[number], b: (typeof tracks)[number]): number =>
          String(a.meta?.name ?? a.id).localeCompare(String(b.meta?.name ?? b.id));
        const opt = (t: (typeof tracks)[number]): HTMLOptionElement => {
          const o = document.createElement('option');
          o.value = t.id;
          o.textContent = String(t.meta?.name ?? t.id.split('/').pop() ?? '');
          return o;
        };
        // Focus loops FIRST - any FEATURED_LOOPS up top via loopRank, the rest alphabetical
        // - then the licensed music beds below.
        const loops = tracks
          .filter(isLoop)
          .sort((a, b) => loopRank(a.id) - loopRank(b.id) || byName(a, b));
        if (loops.length) {
          const grp = document.createElement('optgroup');
          grp.label = 'Focus loops (Neurospicy)';
          loops.forEach((t) => grp.appendChild(opt(t)));
          audioSel.appendChild(grp);
        }
        const music = tracks.filter((t) => !isLoop(t)).sort(byName);
        if (music.length) {
          const grp2 = document.createElement('optgroup');
          grp2.label = 'Music beds';
          music.forEach((t) => grp2.appendChild(opt(t)));
          audioSel.appendChild(grp2);
        }
        // The user's own audio uploads (incl. Script-audio TTS clips) - the catalog
        // query lists library assets only, so the user store is appended explicitly.
        // Sequenced after the catalog groups so the order is stable.
        const listUser = (
          host.assets as unknown as {
            _listUserAssets?: () => Promise<
              { id: string; type: string; meta?: Record<string, unknown> }[]
            >;
          }
        )._listUserAssets;
        return listUser?.call(host.assets).then((all) => {
          const ups = all.filter((a) => a.type === 'audio');
          if (!ups.length) return;
          const grp3 = document.createElement('optgroup');
          grp3.label = t('Your uploads');
          for (const a of ups) {
            const o = document.createElement('option');
            o.value = a.id;
            o.textContent = String(a.meta?.name ?? a.id.split('/').pop() ?? '');
            grp3.appendChild(o);
          }
          audioSel.appendChild(grp3);
        });
      })
      .catch(() => {
        /* pre-sync/offline - leave "None" only */
      });
  }

  // The tool's own audio slot (assetType 'audio'), read LIVE from the model so the
  // popup always reflects the current sidebar pick. Returns the narrow ref shape
  // the bed paths need; null when the slot is empty or the tool has none.
  const toolAudioRef = (): { id?: string; url?: string; format?: string } | null => {
    const v = runtime.getModel().find((i) => i.type === 'asset' && i.assetType === 'audio')?.value;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const r = v as { id?: unknown; url?: unknown; format?: unknown };
    const ref = {
      id: typeof r.id === 'string' ? r.id : undefined,
      url: typeof r.url === 'string' ? r.url : undefined,
      format: typeof r.format === 'string' ? r.format : undefined,
    };
    return ref.id || ref.url ? ref : null;
  };
  // Resolve that slot to a fetchable { url, format }: the asset store when the ref
  // has an id (same on-demand fetch+cache the catalog beds use), else the ref's own
  // url (a transient upload). Null when nothing is resolvable - export stays silent.
  async function resolveToolAudio(): Promise<{ url: string; format?: string } | null> {
    const ref = toolAudioRef();
    if (!ref) return null;
    if (ref.id) {
      try {
        const r = await host.assets.get(ref.id);
        if (r?.url) return { url: r.url, format: r.format };
      } catch {
        /* not in the store (transient ref) - fall back to its own url */
      }
    }
    return ref.url ? { url: ref.url, format: ref.format } : null;
  }
  // (The old `__tool__` pseudo-entry is gone: a tool with its own audio slot now
  // always contributes that audio as the primary track of the two-row card, so
  // the select only ever names the optional mix-in bed.)

  // WP-F soft captions (plan 153). A cached transcript of the tool's own audio -
  // a TTS clip's own alignment, an earlier "Generate subtitles" run persisted on
  // the asset record, or this session's stash. Cached words ONLY: this never
  // triggers transcription, so an export never blocks on inference; no cached
  // transcript ⇒ undefined ⇒ nothing to embed and nothing to ship beside the file.
  // Mirrors the timing ladder in views/transcribe-control.ts and its
  // 'word'-granularity reasoning (the engine grouper only joins, never splits).
  // ponytail: cue times are source-relative; the caller only reads this when the
  // clip exports from its head (stageAudioStart 0), since a nonzero in-point would
  // desync the cues - map through cueSpansOnTimeline if a tool needs both.
  async function toolTranscriptText(): Promise<CaptionText | null> {
    const ref = toolAudioRef();
    if (!ref) return null;
    const assetId = ref.id ?? '';
    let words =
      assetId && host.assets?.get
        ? await host.assets.get(assetId).then(
            (r) => ttsWordsOf(r?.meta) ?? transcriptWordsOf(r?.meta),
            () => null
          )
        : null;
    if (!words) words = stashedTranscript(assetId, ref.url ?? '');
    if (!words?.length) return null;
    const transcript = { words, granularity: 'word' as const };
    const vtt = formatCaptions(transcript, 'vtt');
    return vtt ? { vtt, srt: formatCaptions(transcript, 'srt') } : null;
  }

  /**
   * The captions of a moving export, serialised once for both the embedded track
   * and the sidecar files (plans/180 section 4). Two rungs, most specific first:
   *
   *   1. the CAPTION BOXES on a timed composition. They are already burned into
   *      the picture, so their own timeline windows are the film's cue times - no
   *      offset to apply and no second pass over the audio;
   *   2. the tool audio's cached transcript (the WP-F ladder above), for a
   *      single-clip tool like the audiogram, which has no timeline to read.
   *
   * Null means there is genuinely nothing to caption - neither option adds a byte.
   */
  async function captionText(): Promise<CaptionText | null> {
    if (canvasEl?.querySelector?.('[data-sequence]')) {
      // The compositor module is large and only a timed composition ever gets here,
      // so it is loaded on demand rather than from the panel's own graph.
      const { stageCaptionCues } = await import('../bridge/sequence-render.ts');
      const p = videoParams();
      const cues = stageCaptionCues(
        canvasEl,
        p.durationUserSet ? { totalMs: p.duration * 1000 } : {}
      );
      if (cues.length) return { vtt: cuesToVtt(cues), srt: cuesToSrt(cues) };
    }
    return stageAudioStart() === 0 ? await toolTranscriptText() : null;
  }

  // "Generate music": a transient ZzFXM bed, seeded so the SAME tune deterministically
  // re-renders at any length (export re-renders at the clip's duration). Regenerate
  // rolls a new seed. The draw is the engine's `generatedSongSpec` - the same one a
  // `zzfxm:<seed>` asset id resolves through - so a seed rolled here names the same
  // tune in a share link and in the CLI.
  let genSeed = (Math.random() * 0x7fffffff) >>> 0;
  let genWavUrl: string | null = null; // cached preview WAV blob URL
  let genWavKey = ''; // "seed:targetSec" the cache was rendered for
  const genDur = (): number => Math.max(8, Math.min(90, videoParams().duration));
  async function generatedWavUrl(targetSec: number): Promise<string> {
    const key = `${genSeed}:${targetSec}`;
    if (genWavUrl && genWavKey === key) return genWavUrl;
    const pcm = await renderSong(composeSong(generatedSongSpec(genSeed, targetSec)));
    if (genWavUrl) URL.revokeObjectURL(genWavUrl);
    genWavUrl = URL.createObjectURL(pcmToWavBlob(pcm));
    genWavKey = key;
    return genWavUrl;
  }

  // Audio preview - a play/pause toggle that auditions the selected track before
  // export. A single detached <audio> element (never in the DOM, so it must be
  // paused explicitly on every teardown path - a removed media element keeps
  // playing). The track bytes are resolved lazily on first play via host.assets.get
  // (same on-demand fetch+cache the export uses), and reset whenever the choice
  // changes. Preview plays once at natural length; export still loops to the clip.
  const audioPreviewBtn = el.querySelector<HTMLButtonElement>('[data-action="audio-preview"]');
  let previewAudio: HTMLAudioElement | null = null; // lazily-created HTMLAudioElement
  let previewSrcId: string | null = null; // asset id currently loaded into previewAudio
  const setAudioPreviewPlaying = (playing: boolean): void => {
    if (!audioPreviewBtn) return;
    audioPreviewBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    audioPreviewBtn.classList.toggle('is-playing', playing);
    const label = playing ? 'Pause preview' : 'Preview track';
    audioPreviewBtn.title = label;
    audioPreviewBtn.setAttribute('aria-label', label);
  };
  const stopAudioPreview = (): void => {
    try {
      previewAudio?.pause();
    } catch {
      /* not started */
    }
  };
  const syncAudioPreviewEnabled = (): void => {
    if (audioPreviewBtn) audioPreviewBtn.disabled = !(audioSel && audioSel.value);
  };
  // Regenerate ("new tune") shows only while Generate music is the chosen bed.
  const audioRegenBtn = el.querySelector<HTMLButtonElement>('[data-action="audio-regen"]');
  const syncAudioRegenVisible = (): void => {
    if (audioRegenBtn) audioRegenBtn.hidden = audioSel?.value !== '__generate__';
  };
  // Fade / level / duck / centre-volume only mean anything once a track is
  // chosen - with "None" they are dead controls, so they stay hidden.
  const syncTrackExtras = (): void => {
    const on = !!audioSel?.value;
    el.querySelectorAll<HTMLElement>('[data-track-extras]').forEach((x) => {
      x.style.display = on ? '' : 'none';
    });
  };
  audioSel?.addEventListener('change', () => {
    stopAudioPreview();
    previewSrcId = null;
    syncAudioPreviewEnabled();
    syncAudioRegenVisible();
    syncTrackExtras();
  });
  syncTrackExtras();
  if (audioPreviewBtn) {
    audioPreviewBtn.addEventListener('click', async () => {
      const id = audioSel?.value;
      if (!id) return;
      // Key the loaded source so a regenerated tune reloads instead of replaying
      // the stale bytes; catalog/user ids key as themselves.
      const srcKey = id === '__generate__' ? `__generate__:${genSeed}:${genDur()}` : id;
      if (previewAudio && previewSrcId === srcKey && !previewAudio.paused) {
        stopAudioPreview();
        return;
      }
      try {
        if (!previewAudio) {
          previewAudio = new Audio();
          previewAudio.preload = 'auto';
          previewAudio.addEventListener('play', () => setAudioPreviewPlaying(true));
          previewAudio.addEventListener('pause', () => setAudioPreviewPlaying(false));
          previewAudio.addEventListener('ended', () => setAudioPreviewPlaying(false));
        }
        if (previewSrcId !== srcKey) {
          audioPreviewBtn.classList.add('is-loading');
          const url =
            id === '__generate__'
              ? await generatedWavUrl(genDur())
              : (await host.assets.get(id)).url;
          if (!url) throw new Error('no track to preview');
          previewAudio.src = url;
          previewSrcId = srcKey;
          audioPreviewBtn.classList.remove('is-loading');
        }
        await previewAudio.play();
      } catch {
        audioPreviewBtn.classList.remove('is-loading');
        setAudioPreviewPlaying(false);
      }
    });
    syncAudioPreviewEnabled();
  }
  if (audioRegenBtn) {
    audioRegenBtn.addEventListener('click', () => {
      genSeed = (Math.random() * 0x7fffffff) >>> 0;
      const wasPlaying = Boolean(previewAudio && !previewAudio.paused);
      stopAudioPreview();
      previewSrcId = null;
      // Mid-audition regenerate rolls straight into the new tune (still within the
      // user's click gesture, so autoplay policy allows it).
      if (wasPlaying) audioPreviewBtn?.click();
    });
    syncAudioRegenVisible();
  }

  // Colour bars track the format: ON for the CMYK print formats (pdf-cmyk /
  // cmyk-tiff), OFF for the RGB pdf, re-applied on every format switch - until the
  // user toggles them, or a shared link set marks explicitly, after which their
  // choice is left alone.
  let barsUserSet = Boolean(exportDefaults.marks);
  const syncBarsDefault = (fmt: string): void => {
    if (barsUserSet) return;
    const bars = el.querySelector<HTMLInputElement>('[data-action="mark-bars"]');
    if (bars) bars.checked = isCmykFmt(fmt);
  };

  // The Print marks card auto-opens only for a PRINT-INTENT format (a separating
  // press format, or any print-capable format when the manifest declares
  // render.printMarks: true) and closes for the rest - including the RGB vector
  // formats pdf/svg/eps, which keep the card VISIBLE but off - re-applied on every
  // switch, until the user toggles the master or a link/save set marks explicitly,
  // after which their choice is left alone.
  let marksUserSet = Boolean(exportDefaults.bleed || exportDefaults.marks);
  const syncPrintDefault = (fmt: string): void => {
    if (marksUserSet) return;
    const en = el.querySelector<HTMLInputElement>('[data-action="print-enable"]');
    if (en) en.checked = printIntentFmt(fmt); // refreshPrintUi (called next) reveals/hides the body
  };

  // The embedded-caption box follows the CONTAINER until the user has an opinion
  // (plans/180 section 4): WebM carries a WebVTT track that every WebM player reads,
  // MP4 stores it as `wvtt`, which several Windows players ignore - so MP4 is opt-in
  // and WebM is on. One touch of the checkbox ends the following for this panel, the
  // way marksUserSet ends the print-marks default.
  let captionsEmbedUserSet = false;
  el.querySelector<HTMLInputElement>('[data-action="captions-embed"]')?.addEventListener(
    'change',
    () => {
      captionsEmbedUserSet = true;
    }
  );
  const syncCaptionsUi = (fmt: string): void => {
    const embed = el.querySelector<HTMLInputElement>('[data-action="captions-embed"]');
    if (embed && !captionsEmbedUserSet) embed.checked = fmt === 'webm';
    const note = el.querySelector<HTMLElement>('[data-captions-mp4-note]');
    if (note) note.style.display = fmt === 'mp4' ? 'block' : 'none';
  };

  // Show/hide timing params and format-specific controls when the format selector changes.
  if (formatEl) {
    formatEl.addEventListener('change', () => {
      const fmt = formatEl.value;
      syncCaptionsUi(fmt);
      if (animParamsEl) animParamsEl.style.display = isAnimatedFmt(fmt) ? 'flex' : 'none';
      if (ditherEl) ditherEl.style.display = fmt === 'gif' ? 'flex' : 'none';
      el.querySelectorAll<HTMLElement>('[data-vector-only]').forEach((c) => {
        c.style.display = isVectorFmt(fmt) ? 'flex' : 'none';
      });
      el.querySelectorAll<HTMLElement>('[data-alpha-only]').forEach((c) => {
        c.style.display = isAlphaFmt(fmt) ? 'flex' : 'none';
      });
      // `data-suppressed` wins over the video-format test: syncSequenceUi sets it on
      // "Record live" for a timed composition, and without this check switching format
      // would hand the control straight back.
      el.querySelectorAll<HTMLElement>('[data-video-only]').forEach((c) => {
        c.style.display = isVideoFmt(fmt) && c.dataset.suppressed !== '1' ? 'flex' : 'none';
      });
      // Contact sheets are a STILL-format affordance; the same handler owns them, so
      // the Frames row can't survive a switch to a motion format. It only exists at
      // all while the artboard is a sequence (syncFramesUi), so this is a no-op
      // everywhere else - no data-suppressed flag needed, nothing to fight over.
      el.querySelectorAll<HTMLElement>('[data-seq-still-only]').forEach((c) => {
        c.style.display = isStillFmt(fmt) ? 'flex' : 'none';
      });
      if (!isVideoFmt(fmt)) stopAudioPreview(); // the audio card is hidden - don't keep a preview playing under it
      el.querySelectorAll<HTMLElement>('[data-html-only]').forEach((c) => {
        c.style.display = fmt === 'html' ? 'flex' : 'none';
      });
      el.querySelectorAll<HTMLElement>('[data-emf-only]').forEach((c) => {
        c.style.display = fmt === 'emf' ? 'flex' : 'none';
      });
      el.querySelectorAll<HTMLElement>('[data-rpm-only]').forEach((c) => {
        c.style.display = fmt === 'rpm' || fmt === 'tar.gz' ? 'flex' : 'none';
      });
      renderSendTargets(fmt);
      el.querySelectorAll<HTMLElement>('[data-cmyk-only]').forEach((c) => {
        c.style.display = isCmykFmt(fmt) ? 'flex' : 'none';
      });
      el.querySelectorAll<HTMLElement>('[data-printmarks-only]').forEach((c) => {
        c.style.display = isPrintFmt(fmt) ? 'flex' : 'none';
      });
      syncBarsDefault(fmt);
      syncPrintDefault(fmt); // open the marks card for a CMYK press format, close it otherwise
      updateFidelityWarning(); // only SVG/HTML keep a frosted panel
      refreshPrintUi(); // owns [data-pdf-only] (password) visibility - see below
      refreshDepthFact();
      refreshPreflight(); // the format is the single biggest input to every check
      onUrlSync?.('format');
      onUrlSync?.('marks'); // bars may have flipped with the format
    });
  }

  // matchExportFormat: keep the export format tracking the dropped file's own format
  // until the user picks one. A ?format= link / saved session locks it up-front; any
  // manual pick locks it too. Idempotent - the subscribe fires on every input change,
  // but only acts when a NEW upload's format differs from the current selection. The
  // subscription's lifetime is this mount's runtime.
  if (formatEl && matchFmtInput) {
    let formatLocked = !!exportDefaults.format;
    let autoSetting = false;
    formatEl.addEventListener('change', () => {
      if (!autoSetting) formatLocked = true;
    });
    runtime.subscribe(() => {
      if (formatLocked) return;
      const f = assetExportFormat();
      if (f && f !== formatEl.value) {
        autoSetting = true;
        formatEl.value = f;
        formatEl.dispatchEvent(new Event('change', { bubbles: true })); // runs the per-format UI refresh above
        autoSetting = false;
      }
    });
  }

  // The depth fact - what the chosen format WILL carry beyond an ordinary 8-bit
  // image, stated and not offered (plans/61-deeprichpixels.md section 10 item 3). Nothing is
  // rendered unless there is something true to say, so this runs wherever either
  // input to that truth changes: the format, and the HDR toggle. `?depth=` has no
  // panel control by design - it rides the link, so exportDefaults is its only
  // source. See views/export-depth.ts for the derivation.
  function refreshDepthFact(): void {
    const fmt = formatEl?.value ?? initialFmt;
    const hdr =
      el!.querySelector<HTMLInputElement>('[data-action="hdr"]')?.checked ?? exportDefaults.hdr;
    applyDepthFact(el, depthFact(fmt, { hdr: !!hdr, depth: exportDefaults.depth }));
  }

  // Print marks card: reveal its body when enabled, and hide the open-password
  // card while it's on (marks/bleed route through pdf-lib, which can't encrypt).
  function refreshPrintUi(): void {
    const on = el!.querySelector<HTMLInputElement>('[data-action="print-enable"]')?.checked;
    const fmt = formatEl?.value ?? initialFmt;
    const body = el!.querySelector<HTMLElement>('[data-print-body]');
    if (body) body.style.display = on ? 'flex' : 'none';
    // The lock card serves the RGB `pdf` AND the print `pdf-cmyk` (the strong AES tier
    // composes with CMYK/marks) AND the `zip` bundle (whole-zip encryption);
    // refreshLockTier() constrains/rewords which tiers apply in the current context.
    el!.querySelectorAll<HTMLElement>('[data-pdf-only]').forEach((c) => {
      c.style.display = fmt === 'pdf' || fmt === 'pdf-cmyk' || fmt === 'zip' ? 'flex' : 'none';
    });
    refreshLockTier();
    // Content Credentials follow the stampable-container set, independent of
    // the print card (marks + credential compose fine - the stamp runs last).
    // Shown for zip too: bundled members are stamped individually. The webm
    // caveat sentence only shows for webm (no external viewer reads it there).
    el!.querySelectorAll<HTMLElement>('[data-c2pa-only]').forEach((c) => {
      c.style.display = isC2paFmt(fmt) || fmt === 'zip' ? 'flex' : 'none';
    });
    el!.querySelectorAll<HTMLElement>('[data-imprint-only]').forEach((c) => {
      c.style.display = isImprintFmt(fmt) || fmt === 'zip' ? 'flex' : 'none';
    });
    el!.querySelectorAll<HTMLElement>('[data-durable-only]').forEach((c) => {
      // durableRouteOk is the probe's answer (see the card above): a shell with no
      // route to the encoder keeps the card hidden whatever the format is.
      c.style.display = durableRouteOk && isDurableFmt(fmt) ? 'flex' : 'none';
    });
    el!.querySelectorAll<HTMLElement>('[data-hdr-only]').forEach((c) => {
      c.style.display = isHdrFmt(fmt) ? 'flex' : 'none';
    });
    el!.querySelectorAll<HTMLElement>('[data-c2pa-webm]').forEach((c) => {
      c.style.display = fmt === 'webm' ? 'block' : 'none';
    });
    // The "Content protection" wrapper itself: hidden when none of its four inner
    // cards apply to the selected format (e.g. a text/data format like csv/json/ics),
    // so an always-collapsed, permanently-empty header never shows. Each inner card
    // keeps its own [data-*-only] gate above - this is one more OUTER layer only, it
    // never loosens them. Mirrors the exact per-card predicates this function already
    // applies (password: pdf/pdf-cmyk/zip; C2PA/imprint: their own fmt set; print: isPrintFmt).
    const protectionEl = el!.querySelector<HTMLElement>('[data-protection-section]');
    if (protectionEl) {
      // Print marks live in their own section now (data-printmarks-only), so the
      // protection wrapper's visibility does NOT include isPrintFmt.
      const anyValid =
        fmt === 'pdf' || fmt === 'pdf-cmyk' || fmt === 'zip' || isC2paFmt(fmt) || isImprintFmt(fmt);
      protectionEl.style.display = anyValid ? 'flex' : 'none';
    }
    refreshNotesHandoutUi();
  }

  /** Design-only layout switch: a handout needs artboards and the multi-page RGB PDF path. */
  function refreshNotesHandoutUi(): void {
    const row = el!.querySelector<HTMLElement>('[data-notes-handout-only]');
    if (!row) return;
    const fmt = formatEl?.value ?? initialFmt;
    const hasPages = !!canvasEl?.querySelector('[data-pdf-page]');
    row.style.display = fmt === 'pdf' && hasPages ? 'flex' : 'none';
    const input = row.querySelector<HTMLInputElement>('[data-action="pdf-notes-handout"]');
    if (input) {
      input.disabled = !hasPages;
      if (!hasPages) input.checked = false;
    }
  }
  // Whether the password field currently holds a value that came from ?password=
  // (a Standard-tier link lock). The Strong tier must NEVER reuse a URL-sourced
  // password - that would key "strong" encryption with a secret that already
  // travelled in a link - so we clear the field if the tier flips to strong while
  // this is set. Cleared as soon as the user types (they then own the value).
  let pwFromUrl = Boolean(exportDefaults.password);

  // Encryption-tier control for the password card. Standard = jsPDF's 40-bit RC4,
  // built into an unfinished document - so it works only on a plain RGB `pdf` with
  // no print finishing. Strong = AES-256 encrypt-last, which composes with CMYK /
  // marks / pdf-cmyk. When Standard can't apply we disable it and fall to Strong.
  const STD_LOCK_HINT =
    'Requires this password to open the PDF. A basic 40-bit lock - it opens in any PDF app and travels in a share link, so treat it as a deterrent, not protection for confidential files.';
  const STRONG_LOCK_HINT =
    'AES-256 encryption (PDF 2.0). The recipient must type this exact password to open - it is never included in a link and can’t be recovered if lost. It opens only in newer PDF apps (Acrobat / Preview from ~2018 on); older apps may report the file as damaged.';
  // ZIP variants - same two tiers, different reach: standard = PKWARE ZipCrypto
  // (opens anywhere incl. Windows Explorer, weak); strong = WinZip AES-256.
  const STD_ZIP_HINT =
    'Locks the ZIP with a password. Traditional Zip encryption - it opens in any unzip tool including Windows Explorer, and travels in a share link, so treat it as a deterrent, not protection for confidential files.';
  const STRONG_ZIP_HINT =
    'AES-256 ZIP encryption. The recipient must type this exact password - it is never included in a link and can’t be recovered if lost. It opens in 7-Zip, Keka, WinZip or macOS Archive Utility, but NOT Windows Explorer’s built-in extract.';
  function refreshLockTier(): void {
    const tierEl = el!.querySelector<HTMLSelectElement>('[data-action="pdf-lock-tier"]');
    if (!tierEl) return;
    const fmt = formatEl?.value ?? initialFmt;
    const isZip = fmt === 'zip';
    const marksOn =
      el!.querySelector<HTMLInputElement>('[data-action="print-enable"]')?.checked ?? false;
    // ZIP: both tiers always apply. PDF: RC4 "standard" needs a plain RGB pdf with no
    // finishing pass; print / CMYK / crop-marks force the strong (encrypt-last) tier.
    const standardOk = isZip || (fmt === 'pdf' && !marksOn);
    const stdOpt = tierEl.querySelector<HTMLOptionElement>('option[value="standard"]');
    const strongOpt = tierEl.querySelector<HTMLOptionElement>('option[value="strong"]');
    if (stdOpt) {
      stdOpt.disabled = !standardOk;
      stdOpt.textContent = isZip
        ? 'Standard lock - opens in any unzip tool'
        : 'Standard lock - opens in any PDF app';
    }
    if (strongOpt)
      strongOpt.textContent = isZip
        ? 'Strong · AES-256 - 7-Zip / Keka / macOS'
        : 'Strong · AES-256 - newer apps only ⓘ';
    if (!standardOk) tierEl.value = 'strong';
    // Never let a URL-prefilled password become a STRONG key: clear it the moment
    // the tier is strong (whether force-flipped here or picked by the user).
    if (tierEl.value === 'strong' && pwFromUrl) {
      const pwEl = el!.querySelector<HTMLInputElement>('[data-action="pdf-password"]');
      if (pwEl?.value) {
        pwEl.value = '';
        onUrlSync?.('password');
      }
      pwFromUrl = false;
    }
    const hintEl = el!.querySelector<HTMLElement>('[data-pdfpass-hint]');
    if (hintEl) {
      const strong = tierEl.value === 'strong';
      hintEl.textContent = isZip
        ? strong
          ? STRONG_ZIP_HINT
          : STD_ZIP_HINT
        : strong
          ? (standardOk ? '' : 'Print, CMYK and crop-marked PDFs use the strong lock. ') +
            STRONG_LOCK_HINT
          : STD_LOCK_HINT;
    }
  }
  // Each of these changes a setting preflight reports on (bleed, the mark set),
  // and none of them had a fidelity-warning equivalent to ride - so they take the
  // refresh explicitly, or the card would keep stating the previous bleed.
  el.querySelector<HTMLInputElement>('[data-action="print-enable"]')?.addEventListener(
    'change',
    () => {
      marksUserSet = true; // a manual toggle stops the per-format auto open/close
      refreshPrintUi();
      refreshPreflight();
      onUrlSync?.('bleed');
      onUrlSync?.('marks');
    }
  );
  el.querySelector<HTMLInputElement>('[data-action="print-bleed"]')?.addEventListener(
    'input',
    () => {
      refreshPreflight();
      onUrlSync?.('bleed');
    }
  );
  ['mark-crop', 'mark-reg', 'mark-bleed', 'mark-bars', 'mark-prov'].forEach((a) =>
    el.querySelector<HTMLInputElement>(`[data-action="${a}"]`)?.addEventListener('change', () => {
      if (a === 'mark-bars') barsUserSet = true; // stop auto-tracking once chosen
      refreshPreflight(); // the mark set changes the bleed/media boxes
      onUrlSync?.('marks');
    })
  );
  refreshPrintUi(); // initial state (e.g. card pre-opened from a shared link)
  refreshDepthFact(); // renders nothing unless a deep/gain-map path is already selected

  // Colour profile (CMYK press condition) - print-PDF only; persists via URL/save.
  el.querySelector<HTMLSelectElement>('[data-action="cmyk-profile"]')?.addEventListener(
    'change',
    () => {
      refreshPreflight();
      onUrlSync?.('profile');
    }
  );

  el.querySelector<HTMLInputElement>('[data-action="filename"]')?.addEventListener('input', () =>
    onUrlSync?.('filename')
  );

  // Full-page HTML export toggle ("no stage") - round-trips through the URL as ?nostage.
  el.querySelector<HTMLInputElement>('[data-action="full-page"]')?.addEventListener('change', () =>
    onUrlSync?.('nostage')
  );

  // Pixel-watermark toggle - round-trips through the URL as ?imprint=1 (see syncUrl).
  el.querySelector<HTMLInputElement>('[data-action="imprint"]')?.addEventListener('change', () =>
    onUrlSync?.('imprint')
  );
  el.querySelector<HTMLInputElement>('[data-action="durable"]')?.addEventListener('change', () => {
    refreshPreflight();
    onUrlSync?.('durable');
  });
  // Ask where the durable model can come from, then finish the card (the probe and
  // the consent line are export-durable-card.ts): a shell that started hidden
  // reveals the card once a route answers.
  wireDurableConsent(el, durableFmts.length > 0, (available) => {
    if (available && !durableRouteOk) {
      durableRouteOk = true;
      refreshPrintUi(); // owns [data-durable-only] visibility for the live format
    }
  });
  el.querySelector<HTMLInputElement>('[data-action="hdr"]')?.addEventListener('change', (e) => {
    // Reveal the dials when HDR is on, hide them when off (like the print card).
    const on = (e.target as HTMLInputElement).checked;
    const body = el.querySelector<HTMLElement>('[data-hdr-body]');
    if (body) body.style.display = on ? 'grid' : 'none';
    refreshDepthFact(); // HDR is what makes the PNG deep / the JPEG a gain map
    refreshPreflight(); // HDR on a format that cannot carry it is a warning
    onUrlSync?.('hdr');
  });
  for (const a of ['hdr-peak', 'hdr-reach', 'hdr-lift', 'hdr-focus']) {
    el.querySelector<HTMLInputElement>(`[data-action="${a}"]`)?.addEventListener('input', () =>
      onUrlSync?.('hdr')
    );
  }

  // PDF open-password - clear-text in the URL by design (see pdfPassRow). Syncs on
  // input so a crafted/edited link round-trips; syncUrl gates it to the pdf format.
  el.querySelector<HTMLInputElement>('[data-action="pdf-password"]')?.addEventListener(
    'input',
    () => {
      pwFromUrl = false;
      onUrlSync?.('password');
    }
  );

  // Password protect disclosure - the header toggles the body open/closed (purely
  // visual; the input value still drives export). Focus the field on expand.
  el.querySelector<HTMLButtonElement>('[data-action="pdfpass-toggle"]')?.addEventListener(
    'click',
    () => {
      const card = el!.querySelector('.export-pdfpass');
      const open = card?.classList.toggle('is-open') ?? false;
      const body = el!.querySelector<HTMLElement>('[data-pdfpass-body]');
      if (body) body.style.display = open ? 'flex' : 'none';
      el!
        .querySelector('[data-action="pdfpass-toggle"]')
        ?.setAttribute('aria-expanded', String(open));
      if (open) el!.querySelector<HTMLInputElement>('[data-action="pdf-password"]')?.focus();
    }
  );

  // WP-B "Pro settings" disclosure - same idiom as the password card: the header toggles
  // the body open/closed (purely visual; the selects drive export whether open or not).
  el.querySelector<HTMLButtonElement>('[data-action="prosettings-toggle"]')?.addEventListener(
    'click',
    () => {
      const card = el!.querySelector('.export-pro-settings');
      const open = card?.classList.toggle('is-open') ?? false;
      const body = el!.querySelector<HTMLElement>('[data-prosettings-body]');
      if (body) body.style.display = open ? 'flex' : 'none';
      el!
        .querySelector('[data-action="prosettings-toggle"]')
        ?.setAttribute('aria-expanded', String(open));
    }
  );

  // "Content protection" disclosure - the outer header toggles the whole group of
  // four provenance/protection cards open/closed. Purely visual, same idiom as the
  // password card's own toggle above: nothing inside changes state or export
  // behaviour, and each inner card's own disclosure (password, print marks) keeps
  // working independently once the group is open.
  el.querySelector<HTMLButtonElement>('[data-action="protection-toggle"]')?.addEventListener(
    'click',
    () => {
      const card = el!.querySelector('.export-protection');
      const open = card?.classList.toggle('is-open') ?? false;
      const body = el!.querySelector<HTMLElement>('[data-protection-body]');
      if (body) body.style.display = open ? 'flex' : 'none';
      el!
        .querySelector('[data-action="protection-toggle"]')
        ?.setAttribute('aria-expanded', String(open));
    }
  );

  // Encryption-tier switch: refresh the hint/constraints, re-evaluate the C2PA
  // exclusion, and re-sync the URL - the strong tier is deliberately never written
  // to a link, so switching to it drops any ?password= that was there.
  el.querySelector<HTMLSelectElement>('[data-action="pdf-lock-tier"]')?.addEventListener(
    'change',
    () => {
      refreshLockTier();
      refreshC2paUi('tier');
      onUrlSync?.('password');
    }
  );

  // Content Credentials ↔ open-password exclusion: an encrypted PDF can't take
  // the C2PA incremental update, so whichever is active disables the other
  // (mirrors the marks-vs-password exclusion in refreshPrintUi). Checking the
  // box clears a typed password; a typed password (or a ?password= link - the
  // initial call below) unchecks the box and wins over a tool's render.c2pa.
  const c2paEl = el.querySelector<HTMLInputElement>('[data-action="pdf-c2pa"]');
  const pdfPassEl = el.querySelector<HTMLInputElement>('[data-action="pdf-password"]');
  function refreshC2paUi(changed?: string): void {
    if (!c2paEl) return;
    // The exclusion is a PDF-only fact (only an encrypted PDF can't take the
    // credential); on any other format a lingering password in the hidden
    // card must not disable - let alone silently uncheck - the credential.
    const fmt = formatEl?.value ?? initialFmt;
    if (!pdfPassEl || (fmt !== 'pdf' && fmt !== 'pdf-cmyk')) {
      c2paEl.disabled = false;
      if (pdfPassEl) pdfPassEl.disabled = false;
      return;
    }
    if (changed === 'c2pa' && c2paEl.checked && pdfPassEl.value) {
      pdfPassEl.value = '';
      onUrlSync?.('password');
    }
    if (pdfPassEl.value) c2paEl.checked = false;
    c2paEl.disabled = Boolean(pdfPassEl.value);
    // The exclusion is one-directional on purpose: while a password is typed the
    // C2PA box is disabled (above), but the password field itself is NEVER disabled.
    // Disabling it here deadlocked the panel - C2PA is default-ON for a normal PDF,
    // so the field mounted disabled, and the only thing that clears C2PA (typing a
    // password) could never happen in a field you can't type into. The default-on
    // credential yields to the explicit action: typing a password unchecks C2PA.
    pdfPassEl.disabled = false;
  }
  c2paEl?.addEventListener('change', () => refreshC2paUi('c2pa'));
  pdfPassEl?.addEventListener('input', () => refreshC2paUi('password'));
  formatEl?.addEventListener('change', () => refreshC2paUi('format'));
  refreshC2paUi(); // initial state (?password= link vs a c2pa-default tool)

  // The C2PA card's explanation lives behind an info (?) tip - wire the same
  // delegated tap/Escape/outside-click behaviour the sidebar uses (attach-once;
  // the document dismiss listener is dropped in mountTool's cleanup). Hover
  // reveal is pure CSS.
  wireHelpTips(el);
  wirePreflight(el); // the "Before you export" control opens its details modal
  linkHelpDescriptions(el);

  // Credential lifetime: the 7/30/90/365 select only makes sense for the
  // ephemeral per-export cert. With an enrolled identity (host.identity) the
  // window was fixed at enrolment, so the picker is swapped for the identity
  // line - you can't sign with validity your certificate doesn't have.
  (async () => {
    const lifeEl = el!.querySelector<HTMLElement>('[data-c2pa-life]');
    if (!lifeEl) return;
    let s: IdentityStatus | null | undefined = null;
    try {
      s = await host.identity?.status();
    } catch {
      /* CA/bridge absent - keep the picker */
    }
    if (!s?.enrolled || s.expired) return;
    const until = s.notAfter ? new Date(s.notAfter).toLocaleDateString() : '';
    const renew = (s.daysLeft ?? Infinity) < 7 ? ' <a href="#/profile">Renew soon</a>' : '';
    lifeEl.innerHTML = `<p class="c2pa-life-signed">Signed as <strong>${escape(s.identity?.email ?? '')}</strong>${until ? ` · verified until ${escape(until)}` : ''}${renew}</p>`;
  })();

  // A px-only tool (render.units:false) has no unit selector, so an on-screen pixel
  // is an exported pixel - the token-cost readout can't drift from the real raster
  // resolution the way a physical unit + DPI would. Force px explicitly, not just by
  // the selector's absence, so the invariant holds regardless of DOM state.
  const dimUnit = (): string =>
    manifest.render.units === false
      ? 'px'
      : el!.querySelector<HTMLSelectElement>('[data-action="export-unit"]')?.value || 'px';
  const dimDpi = (): number => {
    const n = parseInt(
      el!.querySelector<HTMLInputElement>('[data-action="export-dpi"]')?.value ?? '',
      10
    );
    return n > 0 ? n : 300;
  };
  /** A stored px length as the bar shows it in the active unit - one rounding, shared by
   *  every reader, so "is this field still showing the stored size" is a string compare. */
  const dispDim = (px: number): string => String(displayIn(px, dimUnit()));
  // Whether the dimension fields still hold their manifest-derived defaults.
  // Seeded true only when a URL param or a restored session supplied the size;
  // flipped by an edit, a scrub, a size-select pick or a unit change. Preflight
  // reads it to tell "the user set this page size" from "this is the tool's own
  // canvas, pre-filled" - the CLI makes exactly the same distinction through
  // `declaredBy`, and without it the two surfaces disagreed on every ordinary tool.
  // `unit` counts as setting the size even on its own: `?unit=mm` with the fields
  // still at the manifest numbers is a REAL 1200 x 900 mm export (exportDims below
  // qualifies the field value with the active unit), so reading it as the tool's
  // pixel canvas would under-report by a factor of twelve.
  let sizeUserSet =
    exportDefaults.width != null ||
    exportDefaults.height != null ||
    (exportDefaults.unit != null && exportDefaults.unit !== 'px');
  // Ephemeral-credential lifetime pick; null when an enrolled identity replaced
  // the select (the cert window rules then) - export.js defaults absent to 30.
  const c2paDaysVal = (): number | null => {
    const n = Number(el!.querySelector<HTMLSelectElement>('[data-action="c2pa-days"]')?.value);
    return [7, 30, 90, 365].includes(n) ? n : null;
  };
  // Raw numeric values the user typed, in the active unit.
  function rawDims(): { w: number | undefined; h: number | undefined } {
    const w = parseFloat(
      el!.querySelector<HTMLInputElement>('[data-action="export-width"]')?.value ?? ''
    );
    const h = parseFloat(
      el!.querySelector<HTMLInputElement>('[data-action="export-height"]')?.value ?? ''
    );
    return { w: w > 0 ? w : undefined, h: h > 0 ? h : undefined };
  }

  // Export dimensions: values qualified with the active unit (+ DPI for physical
  // units) so the engine converts per format. Vector ignores DPI; raster uses it.
  function exportDims(): { width?: number | string; height?: number | string; dpi?: number } {
    if (manifest.render.dims === false) {
      return { width: manifest.render.width, height: manifest.render.height };
    }
    const { w, h } = rawDims();
    const u = dimUnit();
    const q = (v: number | undefined): string | number | undefined =>
      (v ?? 0) > 0 ? (u !== 'px' ? `${v}${u}` : v) : undefined;
    const out: { width?: number | string; height?: number | string; dpi?: number } = {
      width: q(w),
      height: q(h),
    };
    if (u !== 'px') out.dpi = dimDpi();
    return out;
  }

  // On-screen preview is CSS px: physical units shown at their 96-DPI px size.
  function previewPx(): { width: number | undefined; height: number | undefined } {
    const { w, h } = rawDims();
    const u = dimUnit();
    const toPx = (v: number | undefined): number | undefined =>
      (v ?? 0) > 0 ? (u === 'px' ? v : toCssPx({ value: v!, unit: u as Unit })) : undefined;
    return { width: toPx(w), height: toPx(h) };
  }

  // Editor-only aspect-ratio guard. Evaluate the current page size (in px, so the
  // unit drops out of the ratio) against the tool's declared band and show/hide the
  // warning beside the dimension fields. Driven from refreshCanvasPreview, so it
  // tracks both typed dimensions and a size-select change. Never touches the canvas.
  function updateAspectWarning(): void {
    if (!aspectWarnEl) return;
    const { width, height } = previewPx();
    const msg = aspectWarning(manifest, width as number, height as number);
    aspectWarnEl.querySelector<HTMLElement>('[data-aspect-warning-text]')!.textContent = msg ?? '';
    aspectWarnEl.hidden = !msg;
  }

  // Export-fidelity guard: does the canvas paint anything the chosen format cannot
  // carry? Today that is `backdrop-filter` (frosted glass). Only SVG can express it -
  // the walker rebuilds the backdrop by cloning, clipping and blurring what is behind
  // the panel. Every raster format goes through a DOM serialiser that puts the node in
  // a <foreignObject>, where the backdrop is by definition outside the subtree and the
  // blur is dropped; PDF rasterises the panel through that same path; EMF, EPS and DXF
  // discard every filter that is not a drop shadow. HTML is the live DOM, so it keeps it.
  //
  // Read from the LIVE canvas (computed styles), so a tool that never uses the effect
  // never sees the row, and a box that turns Backdrop blur on gets it immediately.
  const FROST_OK_FORMATS = new Set(['svg', 'html']);
  function canvasUsesBackdropFilter(): boolean {
    const root = canvasEl;
    if (!root) return false;
    const els: Element[] = [root, ...Array.from(root.querySelectorAll('*'))];
    for (const node of els) {
      // Editor-only chrome tagged [data-export-hide] is detached before any raster
      // render (detachExportHidden, bridge/export.ts), so a backdrop-filter on it is
      // never in the export and warning about it is a false alarm. Skip exactly the
      // subtree the exporter strips. Bitmap Studio's frosted HUD chips (the preset
      // badge, the Before/After pills, the hover histogram) are the reference case.
      if (node.closest('[data-export-hide]')) continue;
      const s = getComputedStyle(node) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
      const bf = s.backdropFilter || s.webkitBackdropFilter || '';
      if (bf && bf !== 'none') return true;
    }
    return false;
  }
  // The second fidelity guard, and the visible half of plans/104 section 12 Q2: a box under a
  // real 3-D pose (a tilted camera, or a per-box perspective tilt) cannot stay vector,
  // because neither SVG nor PDF has a perspective transform. The walkers keep every
  // untilted layer as geometry and embed a per-box raster for the tilted ones - house
  // style degrades visibly, nothing refuses - so this row is the "visibly" part. It says
  // what happened BEFORE the download rather than leaving the user to find a soft edge in
  // the file, which is the same contract the frosted-glass row above has.
  //
  // ⚑ RASTER FORMATS ARE NOT WARNED, and that is a measurement rather than an omission:
  // spike S2 put a per-element `matrix3d` through the same dom-to-image path 20 poses
  // deep and found no geometric error at all (flat-region diff 0.012–0.045/255, ink IoU
  // 0.985–0.993, text marginally sharper than the live compositor). A PNG of a tilted
  // scene is right, so there is nothing to say about it.
  const VECTOR_FORMATS = new Set(['svg', 'pdf', 'pdf-cmyk', 'emf', 'wmf', 'eps', 'dxf']);
  function canvasHasPerspectivePose(): boolean {
    const root = canvasEl;
    if (!root) return false;
    for (const node of [root, ...Array.from(root.querySelectorAll('*'))]) {
      // Same exemption as the backdrop scan: editor-only chrome is detached before any
      // render, so a pose on it is never in the export.
      if (node.closest('[data-export-hide]')) continue;
      if (isNonAffineTransform(getComputedStyle(node).transform)) return true;
    }
    return false;
  }
  function updateFidelityWarning(): void {
    if (!fidelityWarnEl) return;
    const fmt = formatEl?.value || initialFmt || formats[0] || '';
    // Both guards can fire at once (a frosted panel on a tilted stage), so the row
    // carries whichever sentences apply rather than the first one that matched.
    const parts: string[] = [];
    if (fmt && !FROST_OK_FORMATS.has(fmt) && canvasUsesBackdropFilter()) {
      parts.push(
        `This design uses a frosted glass effect. ${fmt.toUpperCase()} exports can’t keep the blur, so the panel exports without it.`
      );
    }
    if (fmt && VECTOR_FORMATS.has(fmt) && canvasHasPerspectivePose()) {
      parts.push(
        t('Tilted layers export as images inside this {fmt}. Everything else stays vector.', {
          fmt: fmt.toUpperCase(),
        })
      );
    }
    const msg = parts.join(' ');
    fidelityWarnEl.querySelector<HTMLElement>('[data-fidelity-warning-text]')!.textContent = msg;
    fidelityWarnEl.hidden = !msg;
  }
  // A sidebar edit can turn the effect on or off (Design's Backdrop blur field),
  // so re-check after every input change as well as on every format change. Cheap: one
  // computed-style pass over the canvas, and only while the export panel is mounted.
  // Registered HERE, below the definition - the format-change handler above is wired
  // earlier in the function and would hit the TDZ if it ran the check eagerly.
  runtime.subscribe(() => updateFidelityWarning());
  updateFidelityWarning();

  // Print marks & bleed export opts (pdf / pdf-cmyk / cmyk-tiff). Empty when the card is off,
  // so an ordinary PDF stays trim-sized with no marks.
  function printOpts(): RunExportOpts {
    if (!printEnabled(el)) return {};
    const mm = parseFloat(
      el!.querySelector<HTMLInputElement>('[data-action="print-bleed"]')?.value ?? ''
    );
    return {
      bleed: mm > 0 ? `${mm}mm` : undefined,
      cropMarks: el!.querySelector<HTMLInputElement>('[data-action="mark-crop"]')?.checked ?? false,
      registrationMarks:
        el!.querySelector<HTMLInputElement>('[data-action="mark-reg"]')?.checked ?? false,
      bleedMarks:
        el!.querySelector<HTMLInputElement>('[data-action="mark-bleed"]')?.checked ?? false,
      colorBars: el!.querySelector<HTMLInputElement>('[data-action="mark-bars"]')?.checked ?? false,
      provenance:
        el!.querySelector<HTMLInputElement>('[data-action="mark-prov"]')?.checked ?? false,
      barRadiusPt: brandBarRadiusPt(),
    };
  }

  // The brand/theme corner radius as PDF points, for rounding colour-bar cells to
  // match the brand `--radius`. Reads the live token (px or rem) off the tool canvas
  // - where the runtime brand block applies it - falling back to the document root,
  // and converts px→pt (72/96). 0 (or an unparseable/none value) keeps sharp cells.
  function brandBarRadiusPt(): number {
    const src =
      el?.closest('.tool-layout')?.querySelector('#tool-canvas') ?? document.documentElement;
    const raw = getComputedStyle(src).getPropertyValue('--radius').trim();
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const px = /rem\s*$/.test(raw) ? n * 16 : n; // rem→px (root 16px) or already px
    return px * 0.75; // px→pt
  }

  // ── Preflight: "Before you export" ────────────────────────────────────────
  //
  // The shell collects the FACTS from its own platform and the engine applies the
  // RULES - the same split print-marks.ts uses. Everything below reads the LIVE
  // panel (the same readers the export path uses: rawDims/dimUnit/dimDpi, the
  // print card, the CMYK select, cutsValue) so a finding can never be about
  // settings a render would not use. The engine receives a plain object and never
  // touches the DOM.
  //
  // THE GENERIC RULE PATH IS STATIC ONLY. Nothing there renders, rasterises or
  // exports: `preflight()` is pure and synchronous and runs on every input change.
  // Design's mounted audit below is the explicit exception; it is async and is
  // reached only from Export-open / settled-canvas events, never runtime.subscribe.
  //
  // The palette is the one genuinely async fact. It is resolved ONCE, off
  // host.tokens.colors() DIRECTLY - never livePalette, which silently substitutes
  // the neutral starter PALETTE when tokens throw OR answer with nothing, and
  // carries no provenance to tell the two apart. A throw and an empty list both
  // become `{ known:false, why:'not-resolved' }`, so the engine withholds the
  // plate ceiling instead of counting starter swatches as if they were the brand's.
  let palette: Fact<readonly PreflightSwatch[]> = { known: false, why: 'not-resolved' };
  void (async () => {
    try {
      const colors = await host.tokens?.colors?.();
      if (!Array.isArray(colors) || colors.length === 0) return; // stays 'not-resolved'
      palette = {
        known: true,
        value: colors.map((s) => ({
          path: s.path,
          name: s.name,
          spot: s.spot ?? null,
          cmyk: s.cmyk ?? undefined,
          hex: s.value,
        })),
      };
      refreshPreflight();
    } catch {
      /* stays 'not-resolved' - never a fabricated empty palette */
    }
  })();

  /** DOM truths, the only channel through which the stage reaches the engine. */
  function stageFacts(): Fact<StageFacts> {
    if (!canvasEl) return { known: false, why: 'needs-mount' };
    const durationS = seqDurationS();
    const boxes = canvasEl.querySelectorAll('[data-pdf-page]').length;
    // Measure placed raster images for the per-image effective-DPI check. Pure/sync
    // (getBoundingClientRect + naturalWidth) - stays on the refreshPreflight path,
    // never a render. Only images with real intrinsic pixels + a rendered box.
    const rect = canvasEl.getBoundingClientRect();
    const rasterImages = [...canvasEl.querySelectorAll('img')].flatMap((el) => {
      const nW = el.naturalWidth,
        nH = el.naturalHeight,
        b = el.getBoundingClientRect();
      if (!(nW > 0) || !(nH > 0) || !(b.width > 0) || !(b.height > 0)) return [];
      const src = el.currentSrc || el.src || '';
      // A placed SVG is VECTOR: it carries through PDF/SVG export as vector (or a
      // crisp render rasterised from the vector at output DPI - export.ts
      // drawHtmlVectors), so measuring its intrinsic naturalWidth as an
      // effective-DPI limit is meaningless and only ever a false "will look soft".
      // The field is rasterImages; a vector does not belong in it.
      if (isVectorImageSrc(src)) return [];
      const label = placedImageLabel(el.getAttribute('alt'), el.getAttribute('aria-label'), src);
      return [{ label, naturalW: nW, naturalH: nH, boxCssW: b.width, boxCssH: b.height }];
    });
    return {
      known: true,
      value: {
        isSequence: Boolean(seqStageEl()),
        durationMs: durationS === null ? null : Math.round(durationS * 1000),
        pageBoxes: boxes > 0 ? boxes : null,
        canvasCssW: rect.width > 0 ? rect.width : null,
        rasterImages,
      },
    };
  }

  // The manifest slice preflight reads, narrowed explicitly rather than passed
  // through: RenderSpec's `video` is a Record<string, unknown> bag, and the two
  // numbers preflight wants have to be proved to be numbers here.
  const vidNum = (k: string): number | undefined => {
    const v = (manifest.render.video as Record<string, unknown> | undefined)?.[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  };
  const preflightManifest: PreflightManifest = {
    id: manifest.id,
    status: manifest.status,
    render: {
      width: manifest.render.width,
      height: manifest.render.height,
      formats: manifest.render.formats,
      export: manifest.render.export,
      paginate: manifest.render.paginate,
      pages: manifest.render.pages,
      video: { wait: vidNum('wait'), duration: vidNum('duration') },
      aspectWarning: manifest.render.aspectWarning,
    },
    inputs: manifest.inputs,
  };

  // Design has renderer-neutral document checks plus mounted browser checks that
  // cannot honestly live in the engine's generic preflight rules. Keep their
  // lifetime tied to the Export surface: opening runs them, canvas paint refreshes
  // them, and closing cancels/clears them. A closed Export panel pays nothing.
  let designAuditRows: readonly PreflightRow[] = [];
  let designAuditOpen = false;
  let designAuditGeneration = 0;

  const designTone = (severity: 'error' | 'warn' | 'info'): PreflightRow['tone'] =>
    severity === 'error' ? 'error' : severity === 'warn' ? 'warn' : 'note';

  async function refreshDesignAudit(): Promise<void> {
    if (!isDesignTool || !designAuditOpen || !canvasEl) return;
    const generation = ++designAuditGeneration;
    const boxes = runtime.getModel().find((input) => input.id === 'boxes')?.value;
    const rect = canvasEl.getBoundingClientRect();
    const report = inspectDesignV1(boxes, {
      width: rect.width || manifest.render.width,
      height: rect.height || manifest.render.height,
    });
    const structuralRows: PreflightRow[] = report.findings.map((finding) => ({
      id: finding.id,
      tone: designTone(finding.severity),
      text: finding.message,
    }));
    designAuditRows = structuralRows;
    refreshPreflight();

    try {
      await document.fonts?.ready;
    } catch {
      /* mounted geometry still answers */
    }
    const mounted = await auditMountedDesign(canvasEl, report, {
      resolveFont: async (style, text) => {
        const { resolveVectorFont } = await import('../bridge/font-registry.ts');
        return Boolean(await resolveVectorFont(style, text));
      },
    });
    if (!designAuditOpen || generation !== designAuditGeneration) return;
    designAuditRows = [
      ...structuralRows,
      ...mounted.findings.map(
        (finding): PreflightRow => ({
          id: finding.id,
          tone: finding.id === 'design.text.contrast-review' ? 'gap' : designTone(finding.severity),
          text: mountedDesignFindingMessage(finding),
        })
      ),
    ];
    refreshPreflight();
  }

  const onDesignExportOpen = (): void => {
    designAuditOpen = true;
    refreshNotesHandoutUi();
    void refreshDesignAudit();
  };
  const onDesignExportClose = (): void => {
    designAuditOpen = false;
    designAuditGeneration++;
    designAuditRows = [];
    refreshPreflight();
  };
  const onDesignCanvasPaint = (): void => {
    refreshNotesHandoutUi();
    if (designAuditOpen) void refreshDesignAudit();
  };
  if (isDesignTool) {
    el.addEventListener('lolly:export-open', onDesignExportOpen);
    el.addEventListener('lolly:export-close', onDesignExportClose);
    canvasEl?.addEventListener('lolly-canvas-painted', onDesignCanvasPaint);
  }

  /** Assemble the job from the live panel, run the engine's rules, render the card. */
  function refreshPreflight(): void {
    if (!actions.includes('download')) return;
    const fmt = formatEl?.value || initialFmt || formats[0] || '';
    const unit = dimUnit() as Unit;
    const dpi = dimDpi();
    const { w, h } = rawDims();
    // A dims-less tool exports at the manifest's pixel canvas: that size came from
    // the manifest, so it is BARE PIXELS by construction and no unit was declared.
    const fixed = manifest.render.dims === false;
    // Both fields must hold a positive value before the ACTIVE UNIT may be applied
    // to them. `rawDims()` returns undefined for a blank or non-positive field, and
    // substituting `manifest.render.width` under a live `unit: 'mm'` manufactured a
    // PHYSICAL trim out of a bare pixel number nobody declared - a 1200 x 900 px
    // canvas reported as "Trim 1.08 m²", with `bound: 'exact'`, in the state a user
    // passes through every time they clear the width field to retype it. That is the
    // derivation plan section 4 forbids by name, and the real export path does not do it
    // either: it falls back to the MEASURED DOM box.
    //
    // So an incomplete pair reads as what it actually is - the manifest's pixel
    // canvas, `declaredBy: 'manifest'`, no unit declared. The engine then emits
    // `print.trim-not-physical` / `refuse.trim-when-unset` instead of an area.
    const typed = (w ?? 0) > 0 && (h ?? 0) > 0;
    // `declaredBy: 'url'` only when the size is genuinely the user's: a URL param,
    // a restored session, a size-select pick or an edit. Hard-coding it meant the
    // web could NEVER emit `refuse.trim-when-unset` while the CLI emitted it
    // routinely for the identical job, so the two surfaces disagreed on a pre-filled
    // tool where the user had set nothing at all.
    const fromUser = typed && sizeUserSet;
    const manifestSize = fixed || !fromUser;
    // …and when the manifest canvas is what renders, it is not always what COMES OUT.
    // With both size fields blank the export path passes no dimension at all, so
    // `rasterStyle` takes its not-requested branch and supersamples the node box by
    // RASTER_DEFAULT_SCALE: a 1200 x 900 tool exported to PNG is a 2400 x 1800 file.
    // Reporting the manifest numbers there stamped `bound: 'exact'` on a pixel count
    // four times too small. A fixed-dims tool (`dims === false`) is exempt: it passes
    // the manifest size explicitly, which IS a request, so no scale applies - and so
    // is every vector/PDF format, which never reaches `rasterStyle`.
    const supersampled =
      manifest.render.dims !== false &&
      !typed &&
      SUPERSAMPLED_EXPORT_FORMATS.has(fmt.toLowerCase());
    const canvasScale = supersampled ? RASTER_DEFAULT_SCALE : 1;
    const width = manifestSize
      ? { value: manifest.render.width * canvasScale, unit: 'px' as Unit }
      : { value: w!, unit };
    const height = manifestSize
      ? { value: manifest.render.height * canvasScale, unit: 'px' as Unit }
      : { value: h!, unit };
    // `unitDeclared` is true only when the SOURCE spelled a unit out - here, when
    // the panel offers the unit selector AND the value in the field is the one the
    // user put there. False makes the engine refuse to derive an area rather than
    // trust a fabricated unit.
    const unitDeclared = !manifestSize && manifest.render.units !== false;

    const on = printEnabled(el);
    const bleedMm = parseFloat(
      el!.querySelector<HTMLInputElement>('[data-action="print-bleed"]')?.value ?? ''
    );
    const marks = printOpts();
    const job: PreflightJob = {
      source: 'web',
      manifest: preflightManifest,
      // Post-onInit: this panel only exists after the tool has mounted, so a
      // paginate source table is the hydrated one and its row count is exact.
      model: runtime.getModel() as readonly PreflightInput[],
      modelPhase: 'post-init',
      settings: {
        format: fmt,
        size: { width, height, dpi, declaredBy: manifestSize ? 'manifest' : 'url', unitDeclared },
        // The panel is the whole truth about bleed/marks/press profile here - an
        // absent card means the export applies none, which is a KNOWN null, not an
        // unknown. (A batch-snapshot row, which carries none of them, is the case
        // that must report `{ known:false, why:'not-carried' }`.)
        bleed: { known: true, value: on && bleedMm > 0 ? { value: bleedMm, unit: 'mm' } : null },
        marks: {
          known: true,
          value: on
            ? {
                crop: marks.cropMarks,
                registration: marks.registrationMarks,
                bleed: marks.bleedMarks,
                colorBars: marks.colorBars,
                provenance: marks.provenance,
              }
            : null,
        },
        // The reserved `profile` param is the PRESS CONDITION, not a user profile.
        //
        // Reported ONLY when the setting is actually in force. The Color profile
        // card is rendered (and its select populated with DEFAULT_CMYK_CONDITION)
        // for any tool that OFFERS a CMYK format, and merely display:none'd for the
        // others - so reading `.value` unconditionally asserted "the user chose
        // fogra39" on the default SVG/PNG export of every such tool, and the card
        // read "1 to fix" out of the box. The engine rule is right; the collector
        // was inventing the setting.
        pressProfile: {
          known: true,
          value: isCmykFmt(fmt)
            ? el!.querySelector<HTMLSelectElement>('[data-action="cmyk-profile"]')?.value || null
            : null,
        },
        cuts: cutsValue(),
        password: Boolean(
          el!.querySelector<HTMLInputElement>('[data-action="pdf-password"]')?.value
        ),
        durable: el!.querySelector<HTMLInputElement>('[data-action="durable"]')?.checked ?? false,
        hdr: el!.querySelector<HTMLInputElement>('[data-action="hdr"]')?.checked ?? false,
      },
      palette,
      stage: stageFacts(),
    };

    // The fact row states the size the JOB carries, so it agrees with the findings
    // by construction: a manifest-sourced size shows as the pixel canvas it is.
    const sizeText = manifestSize
      ? `${manifest.render.width * canvasScale} × ${manifest.render.height * canvasScale} px`
      : unit === 'px'
        ? `${w} × ${h} px`
        : tRaw('{w} × {h} {unit} at {dpi} DPI', { w: String(w), h: String(h), unit, dpi });
    const report = preflight(job);
    applyPreflight(
      el,
      preflightView(isPreflightEnabled() ? report : null, {
        formatLabel: fmt ? fmtLabel(fmt) : '',
        sizeText,
        bleedText: on && bleedMm > 0 ? `${bleedMm} mm` : null,
        additionalRows: designAuditRows,
      })
    );
    // The cost pass consumes the SAME counts. Async (it reads stored cards), so it is
    // fired and forgotten off the latest counts; a stale in-flight pass is harmless
    // because each call re-reads the current selection and rewrites the card.
    lastCounts = report.counts;
    void refreshCost();
  }

  // ── Cost panel state. All device-local memory, never written to a URL by syncUrl.
  let lastCounts: readonly Count[] = [];
  // The explicit per-device reveal (section 5): a link opens on counts, and money is shown
  // only after the user asks for it here. Never persisted for a confidential card.
  let costRevealed = false;
  // Opt-in to expired rates this session (section 5). Never persisted.
  let costUseExpired = false;
  // The `cost-authoring` slot is mounted at most once, the first time an authoring
  // extension actually RESOLVES into it (not merely when the container exists).
  // DORMANT by default: with no authoring extension registered, mountSlot leaves
  // the slot container untouched (see lib/extensions.ts), so the panel stays
  // counts-only. Authoring is furniture a channel hydrates; the door is here
  // regardless.
  let costSlotMounted = false;
  // The aggregate disposer mountSlot returns - captured so the hydrated extension's
  // teardown (listeners/timers/subscriptions it installed in mount()) actually runs
  // when this panel is destroyed, via the `dispose` on the returned ActionsApi.
  let costSlotDispose: Disposer | undefined;

  // Hydrate the cost-authoring slot when - and only when - an extension actually
  // RESOLVES into it. Gating on slotHasResolved rather than mere element existence
  // is what makes ASYNC delivery work: a control-plane/community bundle evaluated
  // after first paint calls registerExtension, which fires onExtensionsChanged,
  // which re-runs this and hydrates the door. Latches once mounted.
  function tryMountCostSlot(): void {
    if (costSlotMounted) return;
    const slotEl = el?.querySelector<HTMLElement>('[data-cost-authoring]');
    if (!slotEl || !slotHasResolved('cost-authoring')) return;
    costSlotMounted = true;
    // `WebToolHost.assets` carries the `_*UserAsset` methods at runtime.
    const rcHost = host as unknown as Parameters<typeof listRateCards>[0];
    void mountSlot<CostAuthoringContext>('cost-authoring', slotEl, {
      host: rcHost,
      onChange: () => {
        void refreshCost();
      },
    }).then((d) => {
      costSlotDispose = d;
    });
  }
  // Re-attempt the mount whenever the registry changes (async bundle delivery).
  // Unsubscribed, and the hydrated extension torn down, in `disposeActions`.
  const costSlotUnsub = onExtensionsChanged(() => tryMountCostSlot());
  function disposeActions(): void {
    void automaticHistory?.flush();
    automaticHistory?.dispose();
    if (isDesignTool) {
      designAuditOpen = false;
      designAuditGeneration++;
      el?.removeEventListener('lolly:export-open', onDesignExportOpen);
      el?.removeEventListener('lolly:export-close', onDesignExportClose);
      canvasEl?.removeEventListener('lolly-canvas-painted', onDesignCanvasPaint);
    }
    costSlotUnsub();
    try {
      costSlotDispose?.();
    } catch (e) {
      console.error(e);
    }
    costSlotDispose = undefined;
  }

  // The QuantityKinds a rate card can actually price - used to decide whether the job
  // is "costable" at all, so the panel never appears on a plain logo PNG.
  const PRICEABLE_KINDS = new Set<Count['kind']>([
    'processPlates',
    'spotPlates',
    'finishPlates',
    'sheets',
    'area',
    'pages',
    'variantRows',
    'outputFiles',
  ]);

  async function refreshCost(): Promise<void> {
    const costable = lastCounts.some((c) => PRICEABLE_KINDS.has(c.kind));
    // The stored cards on THIS device. A link carries none - a card is never a URL
    // param - so possession is always a local fact. `WebToolHost.assets` carries the
    // `_*UserAsset` methods at runtime (same cast the rate-cards manager uses).
    // A user-dropped card wins; with none, a CATALOG-shipped card (the org's
    // distribution rail - brand pack, channel, control-plane provider) is
    // offered. Possession still means "synced to this device", and the
    // confidential/reveal semantics in money-policy hold unchanged.
    const rcHost = host as unknown as Parameters<typeof listRateCards>[0];
    // Give the extracted authoring furniture its door: hydrate the `cost-authoring`
    // slot the moment an extension resolves into it (empty registry → no-op, the
    // container is left untouched and the panel is byte-identical to counts-only).
    // A hydrated extension gets the store + an onChange that reprices. Also re-runs
    // on async bundle delivery via the onExtensionsChanged subscription above. (The
    // context type lives beside this consumer in cost-panel.ts; the furniture is
    // src/ext/cost-authoring.ts, off the default path.)
    tryMountCostSlot();
    const cards = await listRateCards(rcHost).catch(() => []);
    const selected =
      cards[0] ??
      (
        await listCatalogRateCards(
          host as unknown as Parameters<typeof listCatalogRateCards>[0]
        ).catch(() => [])
      )[0];
    // most-recently-added / first catalog card; a full picker is future work

    // Resolve + cost the selected card. The figure is still gated by `costView` →
    // `canShowMoney`, so a link-reached mount never RENDERS one until the reveal flips
    // (proven in cost-panel.test.ts).
    let working: CostWorking | null = null;
    if (selected) {
      const parsed = await resolveCard(selected);
      if (parsed) working = computeCost(parsed, lastCounts, {});
    }
    const money: MoneyContext = {
      hasCard: !!selected,
      selectionFromUrl: reachedViaLink,
      revealedThisSession: costRevealed,
      cardConfidential: selected?.confidential ?? false,
      expired: working?.expired ?? false,
      useExpiredAnyway: costUseExpired,
    };

    applyCostPanel(
      el,
      costView(working, {
        costable,
        money,
        issuerName: selected?.issuerName,
        issued: selected?.issued,
        validUntil: selected?.validUntil,
      })
    );
    wireCostActions();
  }

  /** Fetch + parse a card's bytes into a `RateCard` - the user-asset store for
   *  a dropped card, the catalog rail for a shipped one. Null on any failure. */
  async function resolveCard(entry: { digest: string; catalogUrl?: string }) {
    let blob: Blob | null = null;
    if (entry.catalogUrl) {
      blob = await fetch(entry.catalogUrl)
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => null);
    } else {
      const rcHost = host as unknown as Parameters<typeof getRateCardBlob>[0];
      blob = await getRateCardBlob(rcHost, entry.digest).catch(() => null);
    }
    if (!blob) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const card = parseRateCard(bytes, entry.digest, validateRateCard);
    return isRateCardError(card) ? null : card;
  }

  /** Attach the reveal / use-expired actions after each cost-body rewrite. The
   *  reveal is device-local memory only - it is never written to the URL, so a shared
   *  link can never carry the revealed state. */
  function wireCostActions(): void {
    el!.querySelector<HTMLButtonElement>('[data-cost-reveal]')?.addEventListener('click', () => {
      costRevealed = true;
      void refreshCost();
    });
    el!
      .querySelector<HTMLButtonElement>('[data-cost-use-expired]')
      ?.addEventListener('click', () => {
        costUseExpired = true;
        void refreshCost();
      });
  }

  // Same wiring as updateFidelityWarning, for the same reason: a sidebar edit can
  // change what preflight sees (a paginate source table gaining a row), so re-run
  // on every input change as well as on every format/size/print-setting change.
  // Cheap: one pure synchronous pass over a plain object.
  runtime.subscribe(() => refreshPreflight());
  refreshPreflight();

  function videoParams(): {
    wait: number;
    duration: number;
    fps: number | undefined;
    live: boolean;
    durationUserSet: boolean;
    videoQuality?: 'smaller' | 'balanced' | 'best';
    videoCodec?: string;
    bitrateMode?: 'variable' | 'constant';
    hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software';
  } {
    const wait =
      parseFloat(el!.querySelector<HTMLInputElement>('[data-action="video-wait"]')?.value ?? '') ??
      1;
    const duration =
      parseFloat(
        el!.querySelector<HTMLInputElement>('[data-action="video-duration"]')?.value ?? ''
      ) ?? 5;
    const fpsSel = el!.querySelector<HTMLSelectElement>('[data-action="video-fps"]')?.value ?? '';
    const qSel = el!.querySelector<HTMLSelectElement>('[data-action="video-quality"]')?.value ?? '';
    const codecSel =
      el!.querySelector<HTMLSelectElement>('[data-action="video-codec"]')?.value ?? '';
    const brmSel =
      el!.querySelector<HTMLSelectElement>('[data-action="video-bitratemode"]')?.value ?? '';
    const hwSel =
      el!.querySelector<HTMLSelectElement>('[data-action="video-hwaccel"]')?.value ?? '';
    const fpsNum = Number(fpsSel);
    return {
      wait: isFinite(wait) ? Math.max(0, wait) : 1,
      duration: isFinite(duration) ? Math.max(0.5, duration) : 5,
      // Frame-rate select (24/25/30/50/60), the WP-B replacement for the old webm-only
      // 60fps checkbox. 'Auto' (empty) leaves fps unset, so each format keeps its default.
      fps: fpsSel && Number.isFinite(fpsNum) ? fpsNum : undefined,
      // WP-B pro-settings: the quality stop drives the bitrate authority; the codec /
      // rate-mode / encoder knobs override the auto ladder + encoder config. Each is
      // undefined unless the user moved it off 'Auto', so a default export is unchanged.
      videoQuality:
        qSel === 'smaller' || qSel === 'best' ? qSel : qSel === 'balanced' ? 'balanced' : undefined,
      videoCodec: codecSel || undefined,
      bitrateMode: brmSel === 'constant' ? 'constant' : undefined,
      hardwareAcceleration:
        hwSel === 'prefer-hardware' || hwSel === 'prefer-software' ? hwSel : undefined,
      // "Record live" (webm/mp4): capture the on-screen preview via a screen share
      // instead of the offline render - see bridge/live-capture.ts. Popup-local.
      // Offered for timed compositions too - the compositor is the default, live
      // capture the low-power alternative the user may deliberately pick.
      live: el!.querySelector<HTMLInputElement>('[data-action="video-live"]')?.checked ?? false,
      // The cross-agent contract: true only when the user typed their own duration,
      // so a tool hook can safely overwrite an auto-derived one with the timeline's
      // length (`if (!ctx.opts.durationUserSet) ctx.opts.duration = derived`).
      durationUserSet,
    };
  }

  // ── Artboards are the size truth; the bar mirrors the ACTIVE artboard ────────
  // (plans/142 WP-B). free-canvas fires `fc-artboard` (bubbling from the canvas)
  // whenever the answer changes, carrying the selected artboard (falling back to
  // the primary one) and the artboard under the sequence playhead. The bar shows
  // the one the chosen format will export - still formats follow the selection,
  // animated formats follow the playhead (the video's output frame) - and editing
  // the bar resizes that artboard alone: a w/h edit never moves an origin, so
  // members stay put. A no-frames doc keeps the single-artboard behaviour (the
  // canvas follows the dims).
  const canvasCfg = (canvasBlocksInput as { canvas?: Record<string, unknown> } | undefined)?.canvas;
  const canvasInputId = (canvasBlocksInput as { id?: string } | undefined)?.id;
  const artFrameField = typeof canvasCfg?.frameField === 'string' ? canvasCfg.frameField : '';
  interface ArtInfo {
    id: string;
    w: number;
    h: number;
  }
  let artActive: { sel: ArtInfo | null; timed: ArtInfo | null } | null = null;
  const hasArtboards = (): boolean => !!(artActive && (artActive.sel || artActive.timed));
  const artTarget = (): ArtInfo | null => {
    if (!artActive) return null;
    const fmt = formatEl?.value ?? formats[0] ?? '';
    return isAnimatedFmt(fmt) && artActive.timed ? artActive.timed : artActive.sel;
  };
  // Mirror-write: show the target artboard's size in the bar's current unit WITHOUT
  // declaring a user size - no sizeUserSet, no URL churn, no canvas resize.
  function reflectArtboardDims(): void {
    const tgt = artTarget();
    if (!tgt) return;
    const wEl = el!.querySelector<HTMLInputElement>('[data-action="export-width"]');
    const hEl = el!.querySelector<HTMLInputElement>('[data-action="export-height"]');
    if (!wEl || !hEl) return;
    wEl.value = dispDim(tgt.w);
    hEl.value = dispDim(tgt.h);
    refreshPreflight();
  }
  canvasEl?.addEventListener('fc-artboard', (e) => {
    artActive = ((e as CustomEvent).detail as typeof artActive) ?? null;
    reflectArtboardDims();
  });
  formatEl?.addEventListener('change', () => {
    if (hasArtboards()) reflectArtboardDims();
  });

  // Preview the export aspect ratio on the canvas, then re-fit to the stage.
  function refreshCanvasPreview(): void {
    updateAspectWarning(); // first, so it reflects current fields even when dims are incomplete
    updateFidelityWarning();
    refreshPreflight(); // width / height / unit / DPI all flow through here
    const { width: w, height: h } = previewPx();
    if (!((w ?? 0) > 0 && (h ?? 0) > 0)) return;
    // When the artboard FOLLOWS the export size (see artboardFollowsDims) the canvas IS the
    // artboard, not a scaled thumbnail: box coordinates are absolute pixels in the artboard's
    // own space, so the layout box must equal the true (CSS-px) export size and fitCanvas's
    // transform does the on-screen fit. Clamping it to the native render size - right for a
    // preview thumbnail - would shrink the artboard under fixed box coords, so a bigger export
    // size pushed boxes off the frame and distorted the aspect ratio (thread B). The transform
    // fit already caps the on-screen size, so the clamp bought those editors nothing but
    // breakage. A fixed-canvas / carousel editor is NOT in this set: its canvas is owned
    // elsewhere (native-locked connector geometry, or the page strip) and keeps the clamp.
    // Framed docs: the artboards own their geometry (plans/142) - the canvas rect
    // is just the pasteboard, so a bar edit must not resize it.
    if (!hasArtboards()) {
      const previewScale = artboardFollowsDims
        ? 1
        : Math.min(1, manifest.render.width / w!, manifest.render.height / h!);
      canvasEl!.style.width = Math.round(w! * previewScale) + 'px';
      canvasEl!.style.height = Math.round(h! * previewScale) + 'px';
      fitCanvas();
    }
    // If the tool declares width/height inputs, sync dims so hooks can recompute layout.
    const model = runtime.getModel();
    const hasW = model.some((i) => i.id === 'width');
    const hasH = model.some((i) => i.id === 'height');
    if (hasW || hasH) {
      // Chain to avoid concurrent hook executions on the shared model. Use the UNWRAPPED
      // setter (runtime.setInputNoHistory, installed by mountTool) - NOT the history-
      // wrapped runtime.setInput - so this PROGRAMMATIC px sync, fired at mount and on
      // every unit/dimension change, never lands in the undo history or wipes the redo
      // chain. The user's own edits to a width/height field still go through the wrapped
      // setInput and stay undoable. baseSetInput is local to mountTool and out of scope
      // here; fall back to the wrapped setter if no wrapper was installed (e.g. a child
      // runtime) so this can never throw at boot.
      const setDims = runtime.setInputNoHistory || runtime.setInput;
      const p = hasW ? setDims('width', w!) : Promise.resolve();
      p.then(() => {
        if (hasH) setDims('height', h!);
      });
      // subscriber fires runTemplateScripts + syncUrl after each setInput
    } else {
      runTemplateScripts(canvasEl!);
      onUrlSync?.();
    }
  }
  // Deferred-preview tools (manifest.render.preview): a painted preview is only
  // valid for the geometry it was captured at, so any change to the export size,
  // unit or DPI must drop back to the placeholder + its "click to preview"
  // button - exactly as changing a sidebar input does. Re-emitting
  // rebuilds the canvas from the model through the one render path (which clears
  // the painted [data-capture] image). No-op for ordinary tools, whose live
  // canvas is the preview. Format/filename don't change captured pixels, so they
  // leave the preview intact.
  const invalidatePreview = manifest.render.preview ? () => runtime.refresh() : () => {};

  // Brief, editor-only outline pulse on the canvas while the export size is being
  // changed (scrub / scroll / type), so a resize reads as deliberate. Applied to
  // the OUTER wrapper - never the exported #tool-canvas - so it can't bleed into
  // output, and removed shortly after the last change; the CSS handles the fade.
  // Re-armed on every change, so a continuous drag holds it on, then it lapses.
  const canvasOuterEl = canvasEl?.closest('.tool-canvas-outer') ?? canvasEl?.parentElement ?? null;
  let dimPulseTimer: ReturnType<typeof setTimeout> | undefined;
  function pulseCanvasResize(): void {
    if (!canvasOuterEl) return;
    canvasOuterEl.classList.add('is-resizing');
    clearTimeout(dimPulseTimer);
    dimPulseTimer = setTimeout(() => canvasOuterEl.classList.remove('is-resizing'), 450);
  }

  // Label the floating scrub readout with the value + current unit (e.g. "1024 px",
  // "210 mm") so a drag reads clearly even with the cursor/finger over the field.
  // (dimUnit() is defined above with the other dimension helpers.)
  (
    [
      [el.querySelector<HTMLInputElement>('[data-action="export-width"]'), 'w'],
      [el.querySelector<HTMLInputElement>('[data-action="export-height"]'), 'h'],
    ] as [HTMLInputElement | null, string][]
  ).forEach(([inp, key]) => {
    if (!inp) return;
    const onDimChange = () => {
      sizeUserSet = true;
      onUrlSync?.(key);
      refreshCanvasPreview();
      invalidatePreview();
      pulseCanvasResize();
    };
    inp.addEventListener('input', onDimChange);
    addScrubBehavior(inp, onDimChange, {
      format: (v) => `${v} ${dimUnit()}`,
      step: () => stepFor(dimUnit()),
    });
  });

  // A committed bar edit resizes the ACTIVE artboard only (plans/142 WP-B replaced
  // the old resize-ALL-artboards confirm flow). Members stay put: a w/h edit never
  // moves the frame origin. No artboards → return, the single-artboard path applies.
  let artResizing = false;
  function resizeArtboardFromDims(): void {
    if (artResizing || !artFrameField || !canvasInputId || manifest.render.layout !== 'editor')
      return;
    const tgt = artTarget();
    if (!tgt) return; // no artboards → the single-artboard path applies
    const kindField = typeof canvasCfg?.kindField === 'string' ? canvasCfg.kindField : 'kind';
    const frameKind = typeof canvasCfg?.frameKind === 'string' ? canvasCfg.frameKind : 'frame';
    const idField = typeof canvasCfg?.idField === 'string' ? canvasCfg.idField : 'id';
    const wField = typeof canvasCfg?.wField === 'string' ? canvasCfg.wField : 'w';
    const hField = typeof canvasCfg?.hField === 'string' ? canvasCfg.hField : 'h';
    const unit = dimUnit();
    const wEl = el!.querySelector<HTMLInputElement>('[data-action="export-width"]');
    const hEl = el!.querySelector<HTMLInputElement>('[data-action="export-height"]');
    const w = parseFloat(wEl?.value ?? '');
    const h = parseFloat(hEl?.value ?? '');
    if (!(w > 0 && h > 0)) return;
    // Fractional px, kept to the bar's two decimals (plans/184 R12): a 793.7 px A4 board
    // stays A4. A field still showing the stored size as the bar rounds it keeps that
    // size to the decimal, so editing the height never re-rounds the width.
    const toPx = (v: number, cur: number, shown: string | undefined): number =>
      shown === dispDim(cur) ? cur : roundIn(convertLength(v, unit, 'px'), 'px');
    const pxW = toPx(w, tgt.w, wEl?.value);
    const pxH = toPx(h, tgt.h, hEl?.value);
    if (pxW < 1 || pxH < 1) return;
    if (tgt.w === pxW && tgt.h === pxH) return; // already this size
    const boxes =
      (runtime.getModel().find((i) => i.id === canvasInputId)?.value as
        | Array<Record<string, InputValue>>
        | undefined) ?? [];
    artResizing = true;
    try {
      const next = boxes.map((b) =>
        b && String(b[kindField]) === frameKind && String(b[idField]) === tgt.id
          ? { ...b, [wField]: pxW, [hField]: pxH }
          : b
      );
      runtime.setInput(canvasInputId, next as unknown as InputValue);
    } finally {
      artResizing = false;
    }
  }
  [
    el.querySelector<HTMLInputElement>('[data-action="export-width"]'),
    el.querySelector<HTMLInputElement>('[data-action="export-height"]'),
  ].forEach((inp) =>
    inp?.addEventListener('change', () => {
      resizeArtboardFromDims();
    })
  );

  // Apply a {width,height,unit} from a size-select option to the export-bar fields,
  // so choosing a size sets the actual exported page size. Refreshes the preview +
  // URL just like a manual edit. The user can still override the fields afterwards.
  // Narrow the export format bar to the formats `allowed` (an effect/mode select's
  // per-option list), intersected with the tool's capability-filtered union. Keeps
  // the current pick when it survives, else falls to the first surviving format and
  // fires the format `change` refresh so every per-format control follows. Never
  // empties the bar (an empty intersection falls back to the full set). Driven by
  // exportFormatDriver in tool.js; a no-op for a single-format tool (no <select>).
  /** Pick one of the formats on offer, as if the person had - the picker and the URL follow. */
  function setFormat(fmt: string): void {
    if (!formatEl) return;
    const offered = [...formatEl.options].map((o) => o.value);
    if (!offered.includes(fmt) || formatEl.value === fmt) return;
    formatEl.value = fmt;
    formatPicker?.refresh(offered, fmt);
    formatEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function setFormats(allowed: string[]): void {
    if (!formatEl) return;
    const allow = new Set(allowed.map((f) => (f === 'jpeg' ? 'jpg' : f)));
    let narrowed = formats.filter((f) => allow.has(f) || f === 'lolly' && canExportLolly(manifest.id));
    if (!narrowed.length) narrowed = formats; // never render an empty selector
    const cur = formatEl.value;
    const next = narrowed.includes(cur) ? cur : narrowed[0]!;
    formatEl.innerHTML = formatOptionsHtml(narrowed, next, fmtLabel);
    formatPicker?.refresh(narrowed, next);
    if (next !== cur) formatEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setExperience(next: ExportExperience): void {
    formatPicker?.setRecommended(next.recommendedFormats ?? []);
    const summary = el?.querySelector<HTMLElement>('[data-export-outcome]');
    if (summary) {
      summary.textContent = next.summary ?? '';
      summary.hidden = !next.summary;
    }
    const label = el?.querySelector<HTMLElement>('[data-download-label]');
    if (label && next.downloadLabel) label.textContent = next.downloadLabel;
  }

  function setDims(update: ExportDimensionUpdate = {}): void {
    if (manifest.render.dims === false) return;
    sizeUserSet = true; // a size-select pick is the user setting the page size
    curUnit = applyExportDimensionFields(el!, curUnit, update);
    refreshCanvasPreview();
    invalidatePreview();
    pulseCanvasResize();
    onUrlSync?.('unit');
    onUrlSync?.('w');
    onUrlSync?.('h');
    if ((update.dpi ?? 0) > 0) onUrlSync?.('dpi');
  }

  // Unit switch keeps the physical size: convert the typed values to the new
  // unit, toggle the DPI field, refresh the preview, and sync the URL.
  const unitSel = el.querySelector<HTMLSelectElement>('[data-action="export-unit"]');
  let curUnit = initUnit;
  unitSel?.addEventListener('change', () => {
    sizeUserSet = true; // choosing mm/in over px IS declaring a physical size
    const to = unitSel.value;
    convertExportDimensionFields(el!, curUnit, to);
    curUnit = to;
    // An artboard's stored px size is the source of truth: re-read it rather than
    // converting the rounded text, so switching units back and forth never drifts.
    if (hasArtboards()) reflectArtboardDims();
    // Design has one document unit, not an export-only preference. Keep the saved
    // document model and its size menu in step when the export panel is the place
    // a person changes units.
    if (manifest.id === 'design') {
      void runtime.setInput('documentUnit', to);
      canvasEl?.dispatchEvent(new CustomEvent('fc-document-unit', { detail: to }));
    }
    onUrlSync?.('unit');
    onUrlSync?.('w');
    onUrlSync?.('h');
    refreshCanvasPreview();
    invalidatePreview();
    pulseCanvasResize();
  });
  el.querySelector<HTMLInputElement>('[data-action="export-dpi"]')?.addEventListener(
    'input',
    (e) => {
      const dpi = Math.round(Number((e.target as HTMLInputElement).value));
      if (manifest.id === 'design' && dpi >= 36 && dpi <= 2400)
        void runtime.setInput('documentDpi', dpi);
      onUrlSync?.('dpi');
      invalidatePreview();
    }
  );

  el.querySelector<HTMLButtonElement>('[data-action="copy"]')?.addEventListener('click', () => {
    // performCopy drives the camera-shutter itself (fullscreen on mobile), per
    // path: the image path GATES the off-screen resize ("shake") behind the closed
    // shutter - like exports do - while keeping the clipboard write in the user
    // gesture by handing the shutter-delayed blob promise to ClipboardItem; the
    // text/html paths play it as parallel feedback (they have no such resize).
    performCopy()
      .then((res) => {
        bumpMetric('imagesCopied');
        // Honest feedback: on browsers without image-clipboard support the bridge
        // downloads the file instead, so don't claim it was copied.
        announce(
          res?.method === 'download'
            ? 'Clipboard image not supported here - downloaded instead'
            : 'Copied to clipboard'
        );
        exportCompleted();
      })
      .catch((err) => console.error('Copy failed:', err));
  });

  // Copies the current render to the clipboard. Shared by the Copy button and
  // the `?copy` URL action. `fmtOverride` honours `?format=<format>&copy`.
  async function performCopy(fmtOverride?: string): Promise<{ method: string } | void> {
    const fmt = fmtOverride || formatEl?.value || (formats.includes('png') ? 'png' : formats[0]!);
    if (fmt === 'lolly') { announce(t('Download the editable .lolly file from Share.')); return; }

    // Universal copy, by format:
    //   • txt / md   → plain text
    //   • html       → rich HTML (so an email signature pastes formatted into Gmail)
    //   • everything else (raster, SVG, PDF, …) → a PNG bitmap
    // so a paste always yields something useful whatever format is selected.
    const TEXT_FORMATS = new Set(['txt', 'md', 'markdown']);
    if (TEXT_FORMATS.has(fmt)) {
      playShutter(); // parallel capture feedback - writeText must stay in-gesture
      const blob = await exportUnscaled(() =>
        runtime.export(flatExportNode(canvasEl), fmt, exportDims())
      );
      await host.clipboard.writeText(await blob.text());
      return;
    }

    if (fmt === 'html') {
      playShutter(); // parallel capture feedback - no off-screen resize to hide here
      // Clone the canvas, then scrub everything email clients strip or ignore.
      const clone = canvasEl!.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll<HTMLElement>('[data-canvas-input]')
        .forEach((el) => el.removeAttribute('data-canvas-input'));
      clone.querySelectorAll('script').forEach((el) => el.remove());
      // <style> blocks - email clients (Gmail etc.) strip them; the template
      // already carries full inline styles so these are pure character waste.
      clone.querySelectorAll('style').forEach((el) => el.remove());
      // Annotation comment markers (<!-- ci:id -->) - invisible, ~30 chars each.
      const walker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
      const comments: Comment[] = [];
      let commentNode: Node | null;
      while ((commentNode = walker.nextNode())) comments.push(commentNode as Comment);
      comments.forEach((n) => n.parentNode?.removeChild(n));

      // Wrap the async blob-URL → data-URL conversion in a Promise so ClipboardItem
      // receives it while navigator.clipboard.write() is still in gesture context.
      const htmlBlobPromise = (async () => {
        // Email signatures display at ≤200px, so cap encoding there; html tools
        // needing larger images can raise this in their own beforeExport hook.
        await Promise.all(
          [...clone.querySelectorAll('img')].map(async (img) => {
            const src = img.getAttribute('src');
            if (!src?.startsWith('blob:')) return;
            try {
              const dataUrl = await new Promise<string>((res, rej) => {
                const bmp = new Image();
                bmp.onload = () => {
                  const MAX = 200;
                  const scale = Math.min(1, MAX / Math.max(bmp.naturalWidth, bmp.naturalHeight));
                  const w = Math.round(bmp.naturalWidth * scale);
                  const h = Math.round(bmp.naturalHeight * scale);
                  const c = document.createElement('canvas');
                  c.width = w;
                  c.height = h;
                  const ctx = c.getContext('2d')!;
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 0, w, h);
                  ctx.drawImage(bmp, 0, 0, w, h);
                  res(c.toDataURL('image/jpeg', 0.75));
                };
                bmp.onerror = rej;
                bmp.src = src;
              });
              img.src = dataUrl;
            } catch {
              /* leave as-is if conversion fails */
            }
          })
        );
        return new Blob([clone.innerHTML], { type: 'text/html' });
      })();

      if (navigator.clipboard?.write && window.ClipboardItem) {
        try {
          const textBlob = htmlBlobPromise.then((b) =>
            b.text().then((t) => {
              const d = document.createElement('div');
              d.innerHTML = t;
              return new Blob([d.textContent ?? ''], { type: 'text/plain' });
            })
          );
          await navigator.clipboard.write([
            new ClipboardItem({ 'text/html': htmlBlobPromise, 'text/plain': textBlob }),
          ]);
          return;
        } catch {
          /* fall through to the bridge path */
        }
      }
      await host.clipboard.writeHtml(await htmlBlobPromise.then((b) => b.text()));
      return;
    }

    // Image copy. { shutter: true } closes the camera-iris BEFORE the off-screen
    // resize so its brief "shake" is hidden - exactly like exports - then opens it.
    // The clipboard write still stays in the user gesture because we hand the
    // shutter-delayed blob *promise* straight to ClipboardItem rather than awaiting
    // it first (awaiting before write() loses the gesture and the browser silently
    // denies the write; deferring the blob inside the promise is the cross-browser
    // pattern that survives the ~shutter delay). One export feeds both paths.
    const blobPromise = exportUnscaled(
      () => runtime.export(flatExportNode(canvasEl), 'png', exportDims()),
      { shutter: true }
    );
    if (navigator.clipboard?.write && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
        return { method: 'clipboard' };
      } catch {
        /* fall through to the bridge path - blobPromise has already resolved */
      }
    }
    // Bridge path: image clipboard write unavailable (e.g. older Firefox) - this
    // returns { method: 'download' } when it falls back to saving the file instead.
    return host.clipboard.writeImage(await blobPromise);
  }

  // The "Request approval" CTA (present in place of Download only when the export
  // policy withheld download but permits a request - see `affordance` above). Routes
  // through the generic opener seam (src/lib/approval-request.ts), which a control
  // plane registers to open the approval dialog; the view stays control-plane-unaware.
  el.querySelector<HTMLButtonElement>('[data-action="request-approval"]')?.addEventListener(
    'click',
    () => {
      openApprovalRequest({ toolId: manifest.id, title: manifest.name });
    }
  );

  el.querySelector<HTMLButtonElement>('[data-action="save-as"]')?.addEventListener('click', () => {
    desktopExport?.requestSaveAs();
    el.querySelector<HTMLButtonElement>('[data-action="download"]')?.click();
  });

  el.querySelector<HTMLButtonElement>('[data-action="download"]')?.addEventListener(
    'click',
    async (e) => {
      // Native <button> or jelly-mode <jelly-button> - disable via the attribute,
      // which both honour (jelly syncs it onto its shadow button).
      const btn = e.currentTarget as HTMLButtonElement;
      const prev = btn.textContent;
      btn.toggleAttribute('disabled', true);
      btn.setAttribute('aria-busy', 'true');

      const fmt = formatEl?.value ?? formats[0]!;
      if (fmt === 'lolly') {
        // Portable delivery owns its packaging/options; never ask the render
        // engine to rasterise a .lolly document, including programmatic clicks.
        btn.toggleAttribute('disabled', false);
        btn.removeAttribute('aria-busy');
        el.querySelector<HTMLElement>('[data-lolly-download]')?.click();
        return;
      }
      // Carousel / paged tool: a STILL-image download becomes one image PER PAGE, zipped.
      // (PDF already fans out to a multi-page document via renderMultiPagePdf; animated /
      // html / zip formats keep their own paths.) Each [data-pdf-page] frame is exported
      // at its own measured size - width/height dims are stripped so a re-sized page still
      // exports at its true pixel size rather than the static render dimensions.
      // Gate on the carousel-specific render.pages - NOT render.paged, which also marks
      // multi-page-pdf / doc-studio, whose SVG export must stay a single whole-canvas file.
      // Also admit the Design frame primitive: an editor-layout tool whose
      // boxes input declares canvas.frameField emits one [data-pdf-page] per ARTBOARD (frame
      // box). A no-frames Design doc renders a single .artboard with zero [data-pdf-page], so
      // pageEls stays empty and it correctly falls through to a single flat export. Mirrors
      // tool.ts's frameCfg derivation (render.layout==='editor' && canvas.frameField).
      const framesCanvas =
        manifest.render.layout === 'editor'
          ? (
              manifest.inputs?.find(
                (i) => i.type === 'blocks' && (i as { canvas?: unknown }).canvas
              ) as { canvas?: { frameField?: string } } | undefined
            )?.canvas
          : undefined;
      const hasFrames = !!framesCanvas?.frameField;
      const pageEls =
        (manifest.render.pages || hasFrames) && canvasEl
          ? [...canvasEl.querySelectorAll<HTMLElement>('[data-pdf-page]')]
          : [];
      // The `?s=` STILL-EXPORT FILTER (plan 112 section 10): `?s=2&format=png` renders just
      // that one slide, which is what makes a Design deck's slides individually linkable
      // (and buys per-slide embeds/OG later). The address is resolved by the ENGINE
      // (frame-address.ts) against the ids these pages carry, so the CLI's own `s=` picks
      // the same page from the same string - one meaning, two transports, no shell logic to
      // drift. Absent ⇒ 'none' ⇒ the fan-out below is byte-identical to before this existed.
      // An address that names nothing is NOT collapsed to "the first page": the whole deck
      // exports and the mismatch is announced, so nobody mistakes slide 1 for slide 9.
      // `frameFilterApplies` is a no-op guard HERE (the fan-out branch below already
      // excludes every format it names) - it is called anyway so web and CLI ask the
      // engine the same question rather than each carrying their own format list.
      const framePick = frameFilterApplies(fmt)
        ? selectFramePage(
            pageEls.map((p) => p.getAttribute('data-frame-id')),
            exportDefaults.slide
          )
        : ({ kind: 'none' } as const);
      // A click deck exported as a moving picture (plans/184 R3). With no timeline of its
      // own the whole stage rendered for the export's duration - slide one, five seconds,
      // then nothing - and no "deck as video" action existed. For this export only, the
      // slides go onto a temporary timeline in order (each its own dwell, else the export's
      // duration) and the deck's slide transition becomes the junction between them; the
      // DOM is restored in `finally`, so the document itself never changes. A `?s=` pick
      // (one slide) keeps its single-frame render, and a document that already has a
      // timeline keeps its own timing.
      let unstageDeck: (() => void) | null = null;
      if (
        isAnimatedFmt(fmt) &&
        fmt !== 'svg-anim' &&
        pageEls.length >= 2 &&
        framePick.kind !== 'page' &&
        canvasEl &&
        !canvasEl.querySelector('[data-sequence]')
      ) {
        const dwellMs = Math.round(videoParams().duration * 1000);
        unstageDeck = stageDeckAsSequence(canvasEl, { dwellMs });
        if (unstageDeck) {
          host.log(
            'info',
            `export: ${pageEls.length} slides placed in order for this ${fmt} (${Math.round(stagedDeckMs(canvasEl, dwellMs) / 100) / 10}s) - each slide's own dwell, else the Duration field as the dwell. The document is unchanged.`
          );
        }
      }
      const isAnimated = isAnimatedFmt(fmt);
      const isGif = fmt === 'gif';

      let liveTake = false;
      if (isAnimated) {
        const { wait, duration, fps, live } = videoParams();
        const totalS = wait + duration;
        liveTake = live && isVideoFmt(fmt);
        btn.textContent = isGif
          ? `Encoding GIF… ${totalS}s`
          : liveTake
            ? `Recording live… ${duration}s` // no wait phase - capture starts once the stage is located
            : fps === 60
              ? `Rendering 60fps… ${totalS}s+`
              : `Recording… ${totalS}s`;
        // A build step is a CLICK, and a video has nobody to click it. Rather than invent
        // a pace for the fragments - which would put words on screen at a speed nobody
        // chose - every box is drawn and the count of unseen steps is said out loud, so
        // the author can reach for "Place in order" and time them deliberately
        // (plans/179 M4). English, like every other export log: host.log is console-only.
        const dropped = buildStepsDropped(canvasEl);
        if (dropped > 0) {
          host.log(
            'warn',
            `export: ${dropped} build step${dropped === 1 ? '' : 's'} cannot be clicked in a moving export, so every box is drawn from the start. Use "Place in order" in the timeline to give them times.`
          );
        }
      } else {
        // Slow non-animated exports (CMYK TIFF, high-DPI raster, PDF) previously froze
        // on a disabled button with no signal. Show progress and tell assistive tech.
        btn.textContent = 'Exporting…';
      }
      announce('Exporting…');

      // Surface the export-quality degradations the bridge would otherwise only
      // console.log (host.log is console-only): the frame rate was lowered to fit the
      // buffer, the clip was truncated, or a sped-up clip's audio was dropped. The
      // bridge calls this sink synchronously as it degrades; we announce each once
      // (a: aria-live) and paint them onto the card when the export settles (b). The
      // sink is registered only for THIS export and cleared in the finally below, so
      // a Save/Send that shares runtime.export never inherits a stale listener.
      const degradeNote = el!.querySelector<HTMLElement>('[data-export-degraded]');
      if (degradeNote) {
        degradeNote.hidden = true;
        degradeNote.textContent = '';
      }
      const degradedNotes: string[] = [];
      _setExportNoticeSink((msg) => {
        if (degradedNotes.includes(msg)) return; // per-clip mutes can repeat the same line
        degradedNotes.push(msg);
        announce(msg);
      });

      // Any zzfxm/tracker track is rendered to a transient WAV blob URL below (the
      // tool audio and a mix-in bed can each mint one); revoke them once the export
      // has consumed them (declared out here so the catch can free them too).
      const wavBlobUrls: string[] = [];
      const trackBlobUrl = (url: string): string => {
        wavBlobUrls.push(url);
        return url;
      };
      const revokeTrackUrls = (): void => {
        for (const u of wavBlobUrls.splice(0)) URL.revokeObjectURL(u);
      };
      try {
        // Resolve the chosen catalog audio track (if any) to a plain fetchable
        // URL before the recording starts - the export bridge stays catalog-
        // agnostic, and a missing/undownloadable track fails here in the UI
        // instead of mid-record. On-demand tier fetches + caches the bytes.
        let audioOpt: { audio?: NonNullable<RunExportOpts['audio']> } = {};
        // ZzFXM songs and tracker modules have no playable audio file - render them
        // to a transient WAV blob URL so the URL-driven muxer paths consume them
        // exactly like an encoded loop. (mod → libopenmpt, zzfxm → the synth.)
        const toWavIfNeeded = async (r: { url: string; format?: string }): Promise<string> =>
          r.format === 'zzfxm'
            ? trackBlobUrl(await songUrlToWavBlobUrl(r.url))
            : isModuleFormat(r.format)
              ? trackBlobUrl(await modUrlToWavBlobUrl(r.url))
              : r.url;
        if (isAudioFmt(fmt) && hasToolAudioInput) {
          // Audio-only export: the deliverable is the tool's OWN clip from the
          // in-point it draws from, and nothing else. No bed, no gain, no fade -
          // the tool applies no processing to the samples, and any envelope here
          // would defeat the untouched-source pass-through in lib/audio-encode.ts.
          const ref = await resolveToolAudio();
          if (ref)
            audioOpt = {
              audio: {
                id: toolAudioRef()?.id,
                url: await toWavIfNeeded(ref),
                volume: 1,
                start: stageAudioStart(),
              },
            };
        } else if (isVideoFmt(fmt)) {
          const audioId = el!.querySelector<HTMLSelectElement>(
            '[data-action="video-audio"]'
          )?.value;
          const numCtl = (a: string, dflt: number): number => {
            const v = el!.querySelector<HTMLInputElement>(`[data-action="${a}"]`)?.value;
            return v != null && v !== '' ? Number(v) || 0 : dflt;
          };
          // The popup's track choice ('' | __generate__ | asset id) → a fetchable URL.
          const resolveTrack = async (): Promise<{ url: string; id: string } | null> => {
            if (!audioId) return null;
            if (audioId === '__generate__') {
              // A fresh worker render at THIS clip's length - the seed keeps it the
              // same tune the user auditioned, just arranged to fit.
              const pcm = await renderSong(composeSong(generatedSongSpec(genSeed, genDur())));
              return {
                url: trackBlobUrl(URL.createObjectURL(pcmToWavBlob(pcm))),
                id: `zzfxm-generated-${genSeed}`,
              };
            }
            return { url: await toWavIfNeeded(await host.assets.get(audioId)), id: audioId };
          };
          const fadeIn = numCtl('audio-fadein', 0);
          const fadeOut = numCtl('audio-fadeout', 0);
          if (hasToolAudioInput) {
            // Two-row card (section 6.1): the tool's own audio is ALWAYS the primary track
            // (read live - an emptied slot exports silent), the popup's pick is the
            // optional mix-in bed whose centre level sets its gain under the voice.
            const ref = await resolveToolAudio();
            const toolUrl = ref ? await toWavIfNeeded(ref) : null;
            const bed = await resolveTrack();
            const level = Math.max(0, Math.min(100, numCtl('audio-tool-level', 100))) / 100;
            const centreSel =
              el!.querySelector<HTMLSelectElement>('[data-action="audio-centre"]')?.value ?? 'low';
            const centre = centreSel === 'off' ? 0 : centreSel === 'full' ? 1 : CENTRE_LOW;
            if (toolUrl) {
              // In-point: a tool whose visuals begin partway into its own clip (the
              // audiogram's "Start at") stamps that offset on its stage as
              // data-audio-start, the same read-the-stage contract as data-seq-ms -
              // so the soundtrack starts where the picture does instead of at 0:00.
              // A property of the tool's OWN clip, so it applies only here, never to
              // a mix-in or standalone bed that knows nothing about the in-point.
              audioOpt = {
                audio: {
                  id: toolAudioRef()?.id,
                  url: toolUrl,
                  volume: level,
                  start: stageAudioStart(),
                  ...(bed ? { mix: { id: bed.id, url: bed.url, centre, fadeIn, fadeOut } } : {}),
                },
              };
            } else if (bed) {
              // Empty tool slot: the mix-in track stands alone, today's single-bed shape.
              audioOpt = {
                audio: { id: bed.id, url: bed.url, fadeIn, fadeOut, volume: 1, duck: 1, start: 0 },
              };
            }
          } else if (audioId) {
            // Single-bed card - unchanged behaviour for tools without their own audio.
            const bed = await resolveTrack();
            const volume = Math.max(0, Math.min(100, numCtl('audio-volume', 100))) / 100;
            const duck = Math.max(0, Math.min(100, numCtl('audio-duck', 100))) / 100;
            if (bed)
              audioOpt = {
                audio: { id: bed.id, url: bed.url, fadeIn, fadeOut, volume, duck, start: 0 },
              };
          }
        }
        // Surface progress on the button for slow non-animated exports - the CMYK
        // TIFF pass and the SVG/PDF vector walk emit onProgress, which was being
        // discarded (the label sat on a static "Exporting…"). Throttle to integer
        // percent so a per-row callback can't thrash the DOM. Animated formats keep
        // their own time-based label (guarded by isAnimated).
        let lastExportPct = -1;
        // The shutter's status block wants the same numbers. exportUnscaled hands
        // its `report` sink to the function it wraps, so this is latched there (the
        // opts object is built before the wrap) and stays null for an export that
        // runs without a shutter, e.g. a live take.
        let reportToShutter: ((done: number, total: number) => void) | null = null;
        // Cancellation for this export (engine 1.141 ExportOpts.signal). Handed to the
        // shutter's status block as onCancel, which makes its one button a real Cancel:
        // the frame loops, the CMYK row pass, the vector walks and the sequence
        // compositor poll the signal and reject with an AbortError, which the catch below
        // reads as "cancelled", not "failed". A format with no yield point ignores it and
        // we discard its result.
        const exportAbort = new AbortController();
        const cancelExport = (): void => exportAbort.abort();
        // The live brand palette (host.tokens, cached) - not the tokenless PALETTE
        // fallback - so CMYK ink substitution always matches the active profile's
        // real brand (SUSE's measured inks, or whichever catalog is mounted).
        const brandPalette = await livePalette(host);
        // Read one HDR slider's value (falls back to its default if the slider isn't
        // rendered for this format/tool).
        const hdrDial = (action: string, def: number): number => {
          const v = Number(el!.querySelector<HTMLInputElement>(`[data-action="${action}"]`)?.value);
          return Number.isFinite(v) ? v : def;
        };
        // Captions for a moving export (plans/180 section 4). Serialised ONCE and used
        // by both options below, so the track inside the file and the files beside it
        // can never disagree. Read only when at least one option is on and only for a
        // video format, so every other export does no work and ships no extra bytes;
        // the burned-in caption boxes are unaffected either way.
        const wantEmbed =
          isVideoFmt(fmt) &&
          (el!.querySelector<HTMLInputElement>('[data-action="captions-embed"]')?.checked ?? false);
        const wantSidecar =
          isVideoFmt(fmt) &&
          (el!.querySelector<HTMLInputElement>('[data-action="captions-sidecar"]')?.checked ??
            false);
        const captions = wantEmbed || wantSidecar ? await captionText() : null;
        const softCaptionsVtt = wantEmbed && captions ? captions.vtt : undefined;
        const sidecarCaptions = wantSidecar && captions ? captions : null;
        // RunExportOpts plus the durationUserSet contract flag: it belongs to the
        // sequence path (the tool hook reads ctx.opts.durationUserSet), not to the
        // generic shell-wide export options, so it's carried as a local widening
        // rather than pushed into the shared interface. subtitlesVtt (WP-F) rides the
        // same local widening - the bridge ExportOpts declares it; RunExportOpts need not.
        const opts: RunExportOpts & {
          durationUserSet?: boolean;
          cuts?: number;
          subtitlesVtt?: string;
        } & typeof audioOpt = {
          ...exportDims(),
          signal: exportAbort.signal,
          onProgress: (done, total) => {
            // Live take: (done, total) is a seconds countdown from the recorder. The
            // button is the one status surface guaranteed OUTSIDE the capture - the
            // in-page pill is skipped when the stage leaves it no capture-safe spot.
            if (liveTake) {
              if (total > 0) btn.textContent = `Recording live… ${done}s`;
              return;
            }
            // The status block over the sealed shutter gets EVERY format's progress,
            // animated included: the button label below deliberately skips those, and
            // a multi-minute video encode is exactly the export the sealed screen had
            // nothing to say about.
            reportToShutter?.(done, total);
            if (isAnimated || total <= 0) return;
            const pct = Math.floor((done / total) * 100);
            if (pct === lastExportPct) return;
            lastExportPct = pct;
            btn.textContent = `Exporting… ${pct}%`;
          },
          ...(isAnimated ? videoParams() : {}),
          // A staged click deck (plans/184 R3): the Duration field is each slide's dwell,
          // not the video's total - the total is the slides added up, which the compositor
          // reads off the stamped data-seq-ms when the duration is NOT flagged user-set.
          // Flagged, it would truncate a two-slide deck to one slide's length.
          ...(unstageDeck ? { durationUserSet: false } : {}),
          // Contact sheet - `opts.cuts` is the pinned cross-agent name the export
          // bridge reads. Passed only when the Frames control is actually mounted
          // (a timed composition) AND the format is a still: every other export omits
          // it entirely, so the single-playhead-frame default path is untouched.
          ...(isStillFmt(fmt) && el!.querySelector('[data-seq-still-only]')
            ? { cuts: cutsValue() }
            : {}),
          ...audioOpt,
          ...(softCaptionsVtt ? { subtitlesVtt: softCaptionsVtt } : {}), // the embedded caption track (video only)
          ...(isGif
            ? {
                dither:
                  el!.querySelector<HTMLInputElement>('[data-action="gif-dither"]')?.checked ??
                  false,
              }
            : {}),
          ...(fmt === 'html'
            ? {
                fullPage:
                  el!.querySelector<HTMLInputElement>('[data-action="full-page"]')?.checked ??
                  false,
              }
            : {}),
          // EMF text mode: live GDI text records by default; the "Outline fonts"
          // chip forces the old text-as-paths output (same values as CLI --text).
          ...(fmt === 'emf' &&
          el!.querySelector<HTMLInputElement>('[data-action="emf-outline"]')?.checked
            ? { text: 'outline' as const }
            : {}),
          ...(isPrintFmt(fmt)
            ? {
                ...printOpts(),
                barStyle: SEPARATING_FORMATS.has(fmt)
                  ? ('cmyk-verify' as const)
                  : ('rgb-swatches' as const),
              }
            : {}),
          // The brand palette drives the colour bar for EVERY print format now, not just
          // CMYK: the CMYK paths ALSO do exact brand-swatch matching against it (see
          // buildCmykPaletteMap in bridge/export.ts), while the RGB paths (PDF/SVG/EPS)
          // use it only to paint the brand colours as RGB swatches (barStyle above).
          ...(isPrintFmt(fmt) ? { palette: brandPalette } : {}),
          ...(isCmykFmt(fmt)
            ? {
                colorProfile:
                  el!.querySelector<HTMLSelectElement>('[data-action="cmyk-profile"]')?.value ||
                  DEFAULT_CMYK_CONDITION,
              }
            : {}),
          ...(() => {
            const pw = el!.querySelector<HTMLInputElement>('[data-action="pdf-password"]')?.value;
            if (!pw) return {};
            const strong =
              el!.querySelector<HTMLSelectElement>('[data-action="pdf-lock-tier"]')?.value ===
              'strong';
            // Strong (AES-256, encrypt-last) composes with RGB pdf AND print pdf-cmyk;
            // the 40-bit standard lock is jsPDF-native and RGB-pdf only.
            if (strong && (fmt === 'pdf' || fmt === 'pdf-cmyk')) return { strongPassword: pw };
            if (fmt === 'pdf') return { password: pw };
            return {};
          })(),
          // Linux package (plan 197 M6): the panel's name/version/licence/install-path
          // become the RPM metadata; pkgInner is the render put inside the package.
          ...(fmt === 'rpm' || fmt === 'tar.gz'
            ? {
                pkg: {
                  name:
                    el!
                      .querySelector<HTMLInputElement>('[data-action="pkg-name"]')
                      ?.value?.trim() || manifest.id,
                  version:
                    el!
                      .querySelector<HTMLInputElement>('[data-action="pkg-version"]')
                      ?.value?.trim() || '1.0',
                  license:
                    el!
                      .querySelector<HTMLInputElement>('[data-action="pkg-license"]')
                      ?.value?.trim() || undefined,
                  dest:
                    el!
                      .querySelector<HTMLInputElement>('[data-action="pkg-dest"]')
                      ?.value?.trim() || undefined,
                  innerFormat: pkgInner || undefined,
                },
              }
            : {}),
          ...(isC2paFmt(fmt) &&
          el!.querySelector<HTMLInputElement>('[data-action="pdf-c2pa"]')?.checked
            ? { c2pa: true, ...(c2paDaysVal() ? { c2paDays: c2paDaysVal()! } : {}) }
            : {}),
          // Pixel watermark - the popup toggle (seeded by ?imprint=); the bridge
          // applies it only to raster formats, so it's harmless to pass through for
          // others / zip members. A tool with no raster format renders no toggle -
          // fall back to the link default.
          ...((el!.querySelector<HTMLInputElement>('[data-action="imprint"]')?.checked ??
          exportDefaults.imprint)
            ? { imprint: true }
            : {}),
          ...((el!.querySelector<HTMLInputElement>('[data-action="durable"]')?.checked ??
          exportDefaults.durable)
            ? { durable: true }
            : {}),
          // Normalize loudness: the select's target LKFS, absent when Off.
          ...((): { normalize?: number } => {
            const v = el!.querySelector<HTMLSelectElement>(
              '[data-action="audio-normalize"]'
            )?.value;
            const n = v && v !== 'off' ? Number(v) : Number.NaN;
            return Number.isFinite(n) ? { normalize: n } : {};
          })(),
          // HDR (Rec.2100 PQ) - opt-in; passes the live brand palette as the colours
          // to boost + the author's slider dials. The bridge applies it to raster
          // (png/jpeg/avif/tiff) and the 10-bit video containers (mp4/webm, plan 154 WP-2);
          // a harmless pass-through for any other format.
          ...((el!.querySelector<HTMLInputElement>('[data-action="hdr"]')?.checked ??
          exportDefaults.hdr)
            ? {
                hdr: true,
                palette: brandPalette,
                hdrPeakNits: hdrDial('hdr-peak', HDR_DEFAULTS.peakNits),
                hdrReach: hdrDial('hdr-reach', HDR_DEFAULTS.reach),
                hdrLift: hdrDial('hdr-lift', HDR_DEFAULTS.lift),
                hdrRichness: hdrDial('hdr-focus', HDR_DEFAULTS.richness),
              }
            : {}),
          // Requested bit depth from the link (?depth=8/16/float). There is no panel
          // control for it - a depth request rides the URL and passes straight
          // through; the export bridge is where depth-follows-provenance is applied.
          ...(exportDefaults.depth ? { depth: exportDefaults.depth } : {}),
          ...(fmt === 'zip'
            ? {
                ...printOpts(), // bundled pdf / pdf-cmyk get marks & bleed; rasters ignore them
                palette: brandPalette,
                colorProfile:
                  el!.querySelector<HTMLSelectElement>('[data-action="cmyk-profile"]')?.value ||
                  DEFAULT_CMYK_CONDITION,
                filename:
                  el!.querySelector<HTMLInputElement>('[data-action="filename"]')?.value.trim() ||
                  autoFilename(),
                bundleFormats: formats.filter((f) => ZIP_BUNDLE.has(f)),
                // Members re-enter renderFormat with these opts, so each stampable
                // bundled file gets its own credential; the zip container never does.
                ...(el!.querySelector<HTMLInputElement>('[data-action="pdf-c2pa"]')?.checked
                  ? { c2pa: true, ...(c2paDaysVal() ? { c2paDays: c2paDaysVal()! } : {}) }
                  : {}),
                // Whole-zip lock: standard = ZipCrypto, strong = AES-256 (renderZip strips
                // these off the per-member opts so members aren't double-locked).
                ...(() => {
                  const pw = el!.querySelector<HTMLInputElement>(
                    '[data-action="pdf-password"]'
                  )?.value;
                  if (!pw) return {};
                  return el!.querySelector<HTMLSelectElement>('[data-action="pdf-lock-tier"]')
                    ?.value === 'strong'
                    ? { strongPassword: pw }
                    : { password: pw };
                })(),
              }
            : {}),
        };
        const filename =
          el!.querySelector<HTMLInputElement>('[data-action="filename"]')?.value.trim() ||
          autoFilename();
        // The exact bytes handed to host.export.download - hashed into the export-
        // history record below so /verify can later match a file back to this device.
        let downloadedBlob: Blob | null = null;
        // A multi-page export downloads a ZIP bundle, not a single render. Flag it so the
        // 'renders' auto-save skips it: saving the zip under the per-page format tag would
        // write a corrupt asset (a .zip stored as if it were a png/svg/pdf).
        let downloadedIsZip = false;
        const framePages = framePick.kind === 'page' ? [pageEls[framePick.index]!] : pageEls;
        const notesHandout =
          fmt === 'pdf' &&
          isDesignTool &&
          framePages.length > 0 &&
          !!el!.querySelector<HTMLInputElement>('[data-action="pdf-notes-handout"]')?.checked;
        const outputBase = notesHandout ? `${filename}-speaker-notes` : filename;
        // A SCORM course package (plans/180 M-D1): not one render but a zip of them - every
        // artboard as a still, the narrated film with its caption sidecar, the fonts, the
        // manifest, the adapter and a launch page. bridge/export-scorm.ts owns the
        // packaging; this branch owns the two things only the live app can do, which is why
        // they go in as closures: photograph an artboard at its rest pose, and encode the
        // film. Placed BEFORE the still fan-out because it consumes the same pages for a
        // different purpose (a zip of loose images is not a course).
        if (notesHandout) {
          const [handoutModule, sequence] = await Promise.all([
            import('./design-notes-handout.ts'),
            import('../bridge/sequence-dom.ts'),
          ]);
          const { mountDesignNotesHandout, snapshotDesignHandoutSlide, waitForDesignNotesHandout } =
            handoutModule;
          const { applySequenceTime, restoreSequenceTime, beginAuthoredDom, OFF_CLASS } = sequence;
          const handoutOpts: RunExportOpts & { cuts?: number } = { ...opts };
          delete handoutOpts.width;
          delete handoutOpts.height;
          delete handoutOpts.cuts;
          delete handoutOpts.bundleFormats;
          downloadedBlob = await exportUnscaled(
            async (report) => {
              reportToShutter = report ?? null;
              const previewUrls: string[] = [];
              let handout: ReturnType<typeof mountDesignNotesHandout> | null = null;
              const seqRoot = canvasEl;
              const seqOff = seqRoot ? [...seqRoot.querySelectorAll<HTMLElement>('.seq-off')] : [];
              seqOff.forEach((node) => { node.classList.remove('seq-off'); });
              const releaseAuthored = seqRoot ? beginAuthoredDom(seqRoot) : null;
              const slides: ReturnType<typeof snapshotDesignHandoutSlide>[] = [];
              try {
                try {
                  for (let i = 0; i < framePages.length; i++) {
                    exportAbort.signal.throwIfAborted();
                    const page = framePages[i]!;
                    if (seqRoot) {
                      applySequenceTime(seqRoot, restMsOf(page));
                      for (const node of seqRoot.querySelectorAll<HTMLElement>(`.${OFF_CLASS}`)) {
                        node.classList.remove(OFF_CLASS);
                      }
                    }
                    const slide = snapshotDesignHandoutSlide(page, i);
                    // The PDF walker does not scale descendant text uniformly through an
                    // ancestor transform. Photograph the slide once at a bounded native
                    // resolution; the handout lays out its headings and notes separately.
                    if (typeof window.URL?.createObjectURL === 'function') {
                      const scale = Math.min(1, 1600 / slide.width, 1000 / slide.height);
                      const previewOpts: RunExportOpts = {
                        width: Math.max(1, Math.round(slide.width * scale)),
                        height: Math.max(1, Math.round(slide.height * scale)),
                        scale: 1,
                        quality: 0.88,
                        background: '#ffffff',
                        thumbnail: true,
                        embedMeta: false,
                        c2pa: false,
                        imprint: false,
                        durable: false,
                        signal: exportAbort.signal,
                      };
                      const preview = await runtime.export(page, 'jpg', previewOpts);
                      slide.previewSrc = window.URL.createObjectURL(preview);
                      previewUrls.push(slide.previewSrc);
                    }
                    slides.push(slide);
                  }
                } finally {
                  if (seqRoot) restoreSequenceTime(seqRoot);
                  releaseAuthored?.();
                  seqOff.forEach((node) => { node.classList.add('seq-off'); });
                }
                handout = mountDesignNotesHandout(slides, { title: filename });
                await waitForDesignNotesHandout(handout.root);
                return await runtime.export(handout.root, 'pdf', handoutOpts);
              } finally {
                handout?.dispose();
                previewUrls.forEach((url) => { window.URL.revokeObjectURL(url); });
              }
            },
            { shutter: true, detail: t('Speaker notes handout'), onCancel: cancelExport }
          );
          await host.export.download(downloadedBlob, `${outputBase}.pdf`);
        } else if (fmt === 'scorm') {
          const { buildScormPackage, collectScormFonts } = await import(
            '../bridge/export-scorm.ts'
          );
          const { narrationSlicesFromModel } = await import('../lib/narration.ts');
          const { applySequenceTime, restoreSequenceTime, beginAuthoredDom, OFF_CLASS } =
            await import('../bridge/sequence-dom.ts');
          // SVG where the deck is vector, PNG otherwise - the tool's own format list decides,
          // exactly as the docs-shot pipeline does.
          const stillFmt = formats.includes('svg') ? 'svg' : 'png';
          // Same stage discipline as the fan-out below: lift the playhead's `.seq-off`, hold
          // ONE set of authored styles across every page, and put both back afterwards. The
          // film renderer needs the stage handed back first, so the release is a closure that
          // can be called twice.
          const seqOff = canvasEl ? [...canvasEl.querySelectorAll<HTMLElement>('.seq-off')] : [];
          seqOff.forEach((o) => o.classList.remove('seq-off'));
          const seqRoot = canvasEl;
          const releaseAuthored = seqRoot ? beginAuthoredDom(seqRoot) : null;
          let stageHeld = true;
          const releaseStage = (): void => {
            if (!stageHeld) return;
            stageHeld = false;
            if (seqRoot) restoreSequenceTime(seqRoot);
            releaseAuthored?.();
            seqOff.forEach((o) => o.classList.add('seq-off'));
          };
          // A deck is NARRATED when a page holds an audio marker. A bed lives on the
          // pasteboard, outside every page, so it does not make a deck narrated by itself.
          const narrated = !!canvasEl?.querySelector('[data-pdf-page] [data-audio-src]');
          const filmFmt = formats.includes('mp4')
            ? 'mp4'
            : formats.includes('webm')
              ? 'webm'
              : null;
          const scormPages: HTMLElement[] = pageEls.length ? pageEls : canvasEl ? [canvasEl] : [];
          let pkg: Awaited<ReturnType<typeof buildScormPackage>>;
          try {
            pkg = await exportUnscaled(
              async (report) =>
                buildScormPackage({
                  title: filename,
                  lang: currentLang(),
                  // The engine has no i18n, so the launch page's own words arrive from here or
                  // the package ships English chrome under a non-English `<html lang>`.
                  // The three templated ones go through t() with NO params on purpose: the
                  // catalog string keeps its {n}/{total}/{title} for the launch page's own
                  // one-line substitution, which is the only place the numbers exist.
                  labels: {
                    previous: t('Previous'),
                    next: t('Next'),
                    slide: t('Slide {n}'),
                    slideOf: t('Slide {n} of {total}'),
                    captions: t('Captions'),
                    video: t('{title} video'),
                  },
                  // T4: the caption sidecar cut from each clip's OWN word timings, clamped to
                  // its slide. Without it the package's .vtt existed only when the burned-in
                  // caption boxes did, so deleting them (or narrating with captions off) sent
                  // an uncaptioned video into an LMS while the exact timings sat unused on
                  // every narration clip.
                  narration: narrationSlicesFromModel(runtime.getModel()),
                  signal: exportAbort.signal,
                  onProgress: (done, total) => {
                    report?.(done, total);
                  },
                  slides: scormPages.map((page) => ({
                    el: page,
                    notes: page.getAttribute('data-frame-notes') || undefined,
                    alt: page.getAttribute('data-frame-name') || undefined,
                  })),
                  fonts: await collectScormFonts(canvasEl),
                  renderStill: async (el) => {
                    // AT REST, not mid-entrance - the fan-out's rule, and for the same reason:
                    // a page whose boxes fade in over 400 ms photographs half-transparent.
                    if (seqRoot) {
                      applySequenceTime(seqRoot, restMsOf(el));
                      for (const o of seqRoot.querySelectorAll<HTMLElement>(`.${OFF_CLASS}`)) {
                        o.classList.remove(OFF_CLASS);
                      }
                    }
                    const node = el as HTMLElement;
                    const blob = await runtime.export(node, stillFmt, {
                      ...opts,
                      width: node.offsetWidth,
                      height: node.offsetHeight,
                    });
                    return {
                      bytes: new Uint8Array(await blob.arrayBuffer()),
                      ext: stillFmt === 'svg' ? 'svg' : 'png',
                    };
                  },
                  renderFilm:
                    narrated && filmFmt
                      ? async () => {
                          // The compositor poses the document itself, so hand the stage back before it
                          // runs rather than filming through this branch's still-life scaffolding.
                          releaseStage();
                          // `live` is dropped deliberately: "Record live" films the screen, and a
                          // course package wants the deterministic render at full quality.
                          const { live: _live, ...vp } = videoParams();
                          const blob = await runtime.export(exportTargetNode(canvasEl), filmFmt, {
                            ...opts,
                            ...vp,
                          });
                          return {
                            bytes: new Uint8Array(await blob.arrayBuffer()),
                            ext: filmFmt,
                            // The same cues the moving export ships (plans/180 section 4): the timed
                            // composition's own caption boxes, else the tool audio's cached word
                            // timings. Never a second pass over audio we synthesised.
                            captionsVtt: (await captionText())?.vtt,
                          };
                        }
                      : null,
                }),
              { shutter: true, detail: fmtLabel(fmt), onCancel: cancelExport }
            );
          } finally {
            releaseStage();
          }
          downloadedBlob = pkg.blob;
          // A course package is an archive, not a render: the 'renders' auto-save must not
          // store it under the format tag, exactly as the multi-page zip must not.
          downloadedIsZip = true;
          await host.export.download(pkg.blob, `${filename}-scorm.zip`);
        } else if (
          pageEls.length >= 1 &&
          !isAnimated &&
          fmt !== 'pdf' &&
          fmt !== 'zip' &&
          fmt !== 'html' &&
          fmt !== 'pptx' &&
          fmt !== 'penpot' &&
          fmt !== 'rpm' &&
          fmt !== 'tar.gz'
        ) {
          if (framePick.kind === 'unmatched') {
            const why = tRaw('No slide matches ?s={s}. Exporting every slide.', {
              s: framePick.address.raw,
            });
            console.warn(`[export] ${why}`);
            announce(why, { assertive: true });
          }
          // Export EACH page frame as its own still image, at that frame's own layout size
          // (offsetWidth/Height - transform-independent, and the true possibly-resized page
          // size, not the tool's static render dims). One page → a single file; several → a zip.
          if (framePages.length > 1) btn.textContent = `Exporting ${framePages.length} pages…`;
          const pageOpts: RunExportOpts & { durationUserSet?: boolean; cuts?: number } = {
            ...opts,
          };
          delete pageOpts.bundleFormats;
          // Per-artboard stills fan out one image per frame; a cuts=N contact sheet only
          // applies to a whole [data-sequence] stage (the .lolly-frames wrapper), so it is
          // inert on an individual [data-pdf-page]. Drop it so a framed timed doc's per-slide
          // export can never carry a stray cuts opt into the page-level render.
          delete pageOpts.cuts;
          // A timed slideshow (frames-as-scenes) gates off-playhead artboards with
          // `.seq-off` (display:none, timeline.css) so only the current slide shows live.
          // A per-artboard still export must lift that first, or every non-current frame
          // photographs BLANK. Strip it across the whole canvas for the export window and
          // restore in `finally` (mirrors sequence-render.ts's photograph-time strip; the
          // class name is the CSS contract - OFF_CLASS in bridge/sequence-dom.ts).
          const seqOff = canvasEl ? [...canvasEl.querySelectorAll<HTMLElement>('.seq-off')] : [];
          seqOff.forEach((o) => o.classList.remove('seq-off'));
          // Loaded here rather than at the top of the file: the timeline composer is a
          // large module and only a framed, timed document ever reaches this branch.
          const { applySequenceTime, restoreSequenceTime, beginAuthoredDom, OFF_CLASS } =
            await import('../bridge/sequence-dom.ts');
          // THE DOCUMENT IS THE ROOT, never a single page. The applier reads two of its
          // rules off the whole stage: a frames-as-scenes document opts OUT of depth and
          // tilt entirely, and what says so are the `[data-pdf-page]` elements themselves -
          // which are not descendants of any one page - while `data-seq-ms`, the length an
          // open-ended box is measured against, is stamped on the `.lolly-frames` root.
          // Handed one page, the composition answered both questions the other way from
          // the preview and the video compositor: it projected a lifted box through a
          // camera they refuse, at a perspective measured off the wrong element. One
          // session over the canvas, driven to each page's own rest moment, asks the same
          // questions they do - and it keeps ONE set of authored styles across the whole
          // fan-out, which is what `createSequenceTime` exists to do.
          const seqRoot = canvasEl;
          // The editor's own playhead stands down for the length of the export, so the
          // styles this session captures as authored are the author's and not the pose the
          // timeline happened to be holding. The same scope every other photographer opens.
          const releaseAuthored = seqRoot ? beginAuthoredDom(seqRoot) : null;
          let files: Array<{ name: string; blob: Blob }>;
          try {
            files = await exportUnscaled(
              async (report) => {
                const out: Array<{ name: string; blob: Blob }> = [];
                for (let i = 0; i < framePages.length; i++) {
                  const el = framePages[i]!;
                  // Pages are the honest unit of progress here - each one is a whole
                  // render, and only the last of them reports any sub-progress. It is
                  // also the cancel point: a still page render has no yield point of its
                  // own, so this is what stops a 40-page fan-out part way.
                  report?.(i, framePages.length);
                  exportAbort.signal.throwIfAborted();
                  // AT REST, not mid-entrance. Lifting `.seq-off` above only decides which
                  // artboards are on stage; it says nothing about WHEN each one is
                  // photographed, so a page whose boxes fade in over 400 ms came out as a
                  // page of half-transparent boxes. Compose the document at this page's own
                  // rest moment first - the moment every enter on it has finished, which
                  // restMsOf works out from the page's own timing attributes (plans/179 M4).
                  if (seqRoot) {
                    applySequenceTime(seqRoot, restMsOf(el));
                    // THE APPLIER DOES NOT DECIDE VISIBILITY ON THIS PATH. It hides every box
                    // whose half-open window does not contain that moment - including,
                    // inside the page it was just asked to pose, the two bullets that have
                    // already had their turn. A still of an artboard draws everything ON it:
                    // that is what the strip above decided for the pages, it is what a
                    // moving export says out loud through `buildStepsDropped` for the
                    // fragments, and it is what this export did before it learned about
                    // time. So the POSE is kept and the hiding is lifted again, every page,
                    // before the shot.
                    for (const o of seqRoot.querySelectorAll<HTMLElement>(`.${OFF_CLASS}`)) {
                      o.classList.remove(OFF_CLASS);
                    }
                  }
                  const pb = await runtime.export(el, fmt, {
                    ...pageOpts,
                    width: el.offsetWidth,
                    height: el.offsetHeight,
                  });
                  out.push({ name: `${filename}-${i + 1}.${extFor(fmt, pb)}`, blob: pb });
                }
                return out;
              },
              { shutter: true, detail: fmtLabel(fmt), onCancel: cancelExport }
            );
          } finally {
            // Reverse order of the two scopes above: hand the composition back first (it
            // also lifts every `.seq-off` it wrote), then the playhead, then put the
            // artboards that were genuinely off the playhead back off it.
            if (seqRoot) restoreSequenceTime(seqRoot);
            releaseAuthored?.();
            seqOff.forEach((o) => o.classList.add('seq-off'));
          }
          if (files.length === 1) {
            downloadedBlob = files[0]!.blob;
            await host.export.download(
              files[0]!.blob,
              `${filename}.${extFor(fmt, files[0]!.blob)}`
            );
          } else {
            const { buildZip } = await import('../pro/zip.ts');
            const zipBlob = await buildZip(files, { zipName: filename });
            downloadedBlob = zipBlob;
            downloadedIsZip = true;
            await host.export.download(zipBlob, `${filename}.zip`);
          }
        } else {
          // A LIVE take must keep the fit-to-stage scale. exportUnscaled blows the
          // canvas up to native size for the entire recording, so the user would watch
          // a clipped canvas while the capture crops to a viewport slice. Instead,
          // record the preview exactly as displayed: the recorder's sizing/bitrate
          // math already reads the on-screen rect times dpr. A live take also films
          // the SCREEN, so the shutter would appear in the take. Both reasons point
          // the same way, so the ternary below keeps live out of exportUnscaled
          // entirely.
          //
          // EVERY OTHER export gets the shutter, animated included (Andy, 2026-07-27).
          // This used to be `shutter: !isAnimated`, based on the idea that an animated
          // format "records the live canvas over seconds" - true only of a live take,
          // which never reaches this branch. Every other motion path composites
          // OFF-SCREEN: the sequence compositor rasterises static layers once and draws
          // into its own canvas, renderRecord/renderTopTail draw to theirs, renderVideo
          // replays onto an offscreen canvas, and a [data-capture-stream] tool captures
          // its own canvas's backing store, which an overlay cannot reach.
          // `.export-shutter` is also a SIBLING of #tool-canvas-outer, while every
          // capture targets #tool-canvas or below, so it is outside the captured
          // subtree either way. The shake is real for video too: exportUnscaled strips
          // the transform and resizes to full export dimensions, and a lottie layer
          // visibly steps frame-by-frame during a sequence render. The iris is built
          // to hold (see the CSS): it stays closed for the variable export time, while
          // the export popup keeps showing progress underneath it.
          const drvNode = exportTargetNode(canvasEl);
          // Deterministic animated-source render (Andy's "right side of the render line"): the
          // preview plays the effect live, but the final render walks the SOURCE frame-by-frame
          // through the same effect. Register the per-frame drive the export frame loop awaits
          // (createFrameSource → node.__lollyFrameDrive), and PAUSE the live repaint loop (not
          // stop - the source stays armed so renderFrameAt keeps working) so a real-time frame
          // can't clobber the exact frame being captured. renderFrameAt returns null for a
          // camera (not deterministically re-samplable), so this cleanly no-ops there. Only the
          // deterministic path (not the screen-share liveTake) needs it.
          const liveDrive = !liveTake && runtime.isLive() && !!drvNode;
          if (liveDrive) {
            const media = host.media as unknown as {
              renderFrameAt?: (tMs: number) => Promise<MediaFrameLike | null>;
            };
            (drvNode as unknown as { __lollyFrameDrive?: unknown }).__lollyFrameDrive = async (
              t: number,
              durMs: number
            ) => {
              const mf = media.renderFrameAt ? await media.renderFrameAt(t * durMs) : null;
              if (!mf) return; // camera / unseekable → leave the base
              const html = await runtime.applyFrameForExport(mf);
              if (html != null) drvNode!.innerHTML = html; // paint the exact frame before capture
            };
            runtime.pauseLive();
          }
          const blob = await (async (): Promise<Blob> => {
            try {
              return liveTake
                ? await runtime.export(drvNode, fmt, opts)
                : await exportUnscaled(
                    (report) => {
                      reportToShutter = report ?? null; // read by opts.onProgress above
                      return runtime.export(drvNode, fmt, opts);
                    },
                    { shutter: true, detail: fmtLabel(fmt), onCancel: cancelExport }
                  );
            } finally {
              if (liveDrive) {
                delete (drvNode as unknown as { __lollyFrameDrive?: unknown }).__lollyFrameDrive;
                runtime.resumeLive();
                runtime.refresh(); // restore the live preview
              }
            }
          })();
          // Sidecar captions (plans/180 section 4, layer 3). A render is ONE Blob and a
          // browser download is one file, so the only way to hand over the video and its
          // caption files together is a small zip - the same shape the multi-page fan-out
          // above already downloads. The video keeps its own bytes verbatim inside it,
          // credential included; the .vtt and the .srt are the cues the film was captioned
          // from. Off ⇒ the plain single file, unchanged.
          if (sidecarCaptions) {
            const { zipAsync } = await import('../lib/zip.ts');
            const enc = new TextEncoder();
            const zipped = await zipAsync({
              [`${filename}.${extFor(fmt, blob)}`]: new Uint8Array(await blob.arrayBuffer()),
              [`${filename}.vtt`]: enc.encode(sidecarCaptions.vtt),
              [`${filename}.srt`]: enc.encode(sidecarCaptions.srt),
            });
            const zipBlob = new Blob([zipped as BlobPart], { type: 'application/zip' });
            downloadedBlob = zipBlob;
            downloadedIsZip = true;
            await host.export.download(zipBlob, `${filename}.zip`);
          } else {
            downloadedBlob = blob;
            await host.export.download(blob, `${filename}.${extFor(fmt, blob)}`);
          }
        }
        revokeTrackUrls();
        bumpMetric('filesRendered');
        recordFormat(fmt); // local usage metric
        // L3 (plans/163) - remember the format and size this was exported at, so the
        // next fresh mount of this tool opens on them. Best-effort and non-blocking,
        // like the history record and the library copy below: the file has already
        // reached the user, and a lost write only costs the memory. No UI, no switch -
        // the tool's defaults just get better with use. Explicit values (a link's
        // params, a resumed session) still win on the way back in; see
        // lib/export-prefs.ts.
        {
          const { w: lastW, h: lastH } = rawDims();
          void saveExportPrefs(host, manifest.id, {
            format: fmt,
            width: lastW,
            height: lastH,
            unit: dimUnit(),
            dpi: dimDpi(),
          });
        }
        // Log the download to the export history (Dashboard "Latest exports"). Best-effort,
        // non-blocking: a thumbnail of what was exported + enough state to reopen it.
        void (async () => {
          try {
            const { recordExport, hashBlob } = await import('../lib/export-history.ts');
            const thumb = await captureThumbnail(
              manifest,
              canvasEl,
              runtime,
              exportUnscaled,
              fmt,
              false
            );
            // Hash the exact downloaded bytes so /verify can match a file back here.
            const contentHash = downloadedBlob ? await hashBlob(downloadedBlob) : undefined;
            await recordExport({
              toolId: manifest.id,
              label: manifest.name,
              filename: outputBase,
              format: fmt,
              thumb,
              query: serializeUrlState(runtime.getModel()),
              at: Date.now(),
              ...(contentHash ? { contentHash } : {}),
            });
          } catch {
            /* history is best-effort */
          }
        })();
        // Auto-save the SAME credentialed bytes into the personal library (the
        // 'renders' tag). Best-effort + non-blocking: the file has already reached
        // the user. Deduped by checksum and gated by the profile toggle inside the
        // helper; large/video renders confirm first (the download is never gated).
        void (async () => {
          try {
            if (!downloadedBlob || downloadedIsZip) return;
            const { saveRenderToLibrary } = await import('../lib/save-render.ts');
            const dimNum = (v: number | string | undefined): number | undefined => {
              const n = typeof v === 'string' ? Number(v) : v;
              return typeof n === 'number' && Number.isFinite(n) && n > 0
                ? Math.round(n)
                : undefined;
            };
            await saveRenderToLibrary(
              host as unknown as Parameters<typeof saveRenderToLibrary>[0],
              {
                blob: downloadedBlob,
                format: fmt,
                toolId: manifest.id,
                name: outputBase,
                width: notesHandout ? 794 : dimNum(opts.width),
                height: notesHandout ? 1123 : dimNum(opts.height),
              }
            );
          } catch {
            /* saving to the library is best-effort */
          }
        })();
        // Export home (plans/138 A1): if the user pinned a cloud as their export
        // home, this same file ALSO auto-sends there over the send-target driver.
        // Best-effort + non-blocking; the send runs as a light job so the global
        // toast carries its progress and the resulting link.
        void (async () => {
          try {
            if (!downloadedBlob) return;
            // autoSendToExportHome resolves the pinned cloud through the same
            // sendTargetsFor() registry the panel renders from, and finding nothing there
            // is indistinguishable from "not connected on this device" - it returns
            // silently. So wait for the panel's own on-demand driver load (memoised;
            // long resolved by the time anyone has exported) rather than reading a
            // registry that may not be filled yet.
            const [{ autoSendToExportHome }] = await Promise.all([
              import('../lib/export-home.ts'),
              sendTargetsReady,
            ]);
            await autoSendToExportHome(
              host as unknown as Parameters<typeof autoSendToExportHome>[0],
              {
                blob: downloadedBlob,
                format: downloadedIsZip ? 'zip' : fmt,
                name: outputBase,
              }
            );
          } catch {
            /* the export home is best-effort - the download already succeeded */
          }
        })();
      } catch (err) {
        revokeTrackUrls();
        // Cancelled, not broken: nothing was downloaded or saved, so say so quietly and
        // put the button back. The shutter was already restored by exportUnscaled's own
        // finally. 'AbortError' is the one shape every path arrives in - the sequence
        // compositor maps its SEQ_ABORTED onto it.
        if ((err as { name?: string })?.name === 'AbortError') {
          btn.removeAttribute('aria-busy');
          btn.textContent = prev;
          btn.toggleAttribute('disabled', false);
          announce(t('Export cancelled'));
          return;
        }
        console.error('Export failed:', err);
        btn.removeAttribute('aria-busy');
        // Surface WHY so users don't just retry the same doomed export.
        const raw = String((err as { message?: string })?.message || '');
        const why = /too large|maximum|exceeds|canvas size|dimensions/i.test(raw)
          ? 'Too large - reduce size or DPI'
          : /not supported|unsupported|no encoder|mime|codec/i.test(raw)
            ? `Can’t export ${fmt} in this browser`
            : raw && raw.length <= 48
              ? raw
              : 'Export failed - try again';
        btn.textContent = why;
        announce(why, { assertive: true });
        setTimeout(() => {
          btn.textContent = prev;
          btn.toggleAttribute('disabled', false);
        }, 3500);
        return;
      } finally {
        // Save As is armed before the shared render begins. If the render fails
        // before host.export.download consumes it, never let that one-shot choice
        // leak into a later ordinary Download.
        desktopExport?.cancelSaveAs();
        // The staged click deck goes back exactly (plans/184 R3) - before anything else
        // reads the canvas, and whether the export finished, failed or was cancelled.
        unstageDeck?.();
        unstageDeck = null;
        // Always release the module-global sink, whatever exit the export took.
        _setExportNoticeSink(null);
      }

      btn.removeAttribute('aria-busy');
      btn.textContent = prev;
      btn.toggleAttribute('disabled', false);
      announce('Export complete');
      // (b) A calm, visible line on the card for each degradation, honest not alarmed.
      if (degradeNote && degradedNotes.length) {
        degradeNote.textContent = degradedNotes.join(' ');
        degradeNote.hidden = false;
      }
      exportCompleted();
      void offerDetailsAsk()
        .then((shown) => {
          if (!shown) offerReopenNote();
        })
        .catch(() => {
          /* the ask is an extra, never a failure path */
        });
    }
  );

  el.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener(
    'click',
    async function (this: HTMLButtonElement) {
      const qsFolder = await quickSaveFolder();
      if (await performSave(this, qsFolder ? { folderId: qsFolder } : undefined))
        settleSaveButton(this);
    }
  );

  // Cloud send destinations (the send-target seam). The card list is rebuilt
  // per format; ONE delegated click handler on the container survives the
  // re-renders. A send renders the same bytes the Download button would for
  // the cheap cases - dims plus the Outline-fonts chip when the format is EMF
  // - and hands them to the provider; the status line becomes the provider's
  // viewable link on success.
  // Collapsed by default, exactly like Content protection - one tidy header for
  // a capability most exports never touch. The open state lives in the closure so
  // a format change (which rebuilds the card) doesn't slam it shut mid-use.
  let sendOpen = false;
  function renderSendTargets(fmt: string): void {
    const box = el!.querySelector<HTMLElement>('[data-send-targets]');
    if (!box) return;
    const offered = sendTargetsFor(fmt);
    // ONE row for every destination, not a card each. Each target used to render as
    // a full .section-card with its own icon head and a full-width button, which gave
    // "Send to Google Drive" the same weight as Content protection - and more weight
    // than Download - for someone who has never connected a cloud. The head names the
    // job once; a destination is a compact button beside its siblings. The kind, the
    // status span and the delegated click handling are unchanged. The button now shows
    // the provider NAME rather than the target's own actionLabel ("Send to Google
    // Drive"), which would repeat the head next to it.
    box.innerHTML = offered.length
      ? `
      <div class="section-card export-send${sendOpen ? ' is-open' : ''}">
        <button type="button" class="protection-head" data-action="send-toggle" aria-expanded="${sendOpen}">${icon('share', { className: 'c2pa-icon' })}<span>${escape(t('Send to'))}</span></button>
        <div class="export-send-row" data-send-body style="display:${sendOpen ? 'flex' : 'none'}">
          ${offered
            .map(
              (tg) => `
          <button type="button" data-send-kind="${escape(sendTargetId(tg))}"${tg.hint ? ` title="${escape(tg.hint)}"` : ''}>${icon('upload', { size: 14 })}<span>${escape(tg.label)}</span></button>
          <span class="send-status" data-send-status="${escape(sendTargetId(tg))}" role="status"></span>`
            )
            .join('')}
        </div>
      </div>`
      : '';
    // The container outlives its contents (it is emitted unconditionally so late
    // registration has somewhere to land), so it carries the empty state itself: no
    // destination for this format ⇒ nothing in the panel, exactly as when the row
    // wasn't rendered at all.
    box.hidden = !offered.length;
  }
  renderSendTargets(initialFmt ?? formats[0] ?? '');
  // …and load the built-in destinations, if this is the first export panel of the
  // session. They are no longer registered at boot (plans/155 Task 3.3 took ~59 KB of
  // OAuth/upload drivers off the boot graph for a capability most builds never use);
  // an export panel opening is the first moment anything consults them, so it is the
  // panel that fetches them. Memoised in lib/send-targets-builtin.ts, so every later
  // panel reuses one registration. The re-render is what makes the late arrival
  // invisible: the call above painted with whatever was registered at mount (nothing,
  // the first time), and this repaints against the real set - reading the CURRENT
  // format, since the user may have changed it while the drivers were in flight.
  // Kept as the shared promise: the export-home auto-send in the download handler
  // above awaits this same one rather than racing it (a download fired seconds after
  // mount would otherwise find an empty registry and silently skip the user's pinned
  // cloud). That is a read from a closure, so the declaration order is fine - the
  // handler cannot run before the panel is mounted.
  const sendTargetsReady = actions.includes('download')
    ? import('../lib/send-targets-builtin.ts')
        .then((m) => m.ensureBuiltinSendTargets())
        .then(() => renderSendTargets(formatEl?.value || initialFmt || formats[0] || ''))
        .catch((err: unknown) => {
          console.error('Send destinations unavailable:', err);
        })
    : Promise.resolve();
  el.querySelector<HTMLElement>('[data-send-targets]')?.addEventListener('click', async (ev) => {
    // The header toggle rides the same delegated listener (the card is rebuilt
    // per format; the container survives) - same idiom as protection-toggle.
    const head = (ev.target as HTMLElement).closest?.('[data-action="send-toggle"]');
    if (head) {
      sendOpen = el!.querySelector('.export-send')?.classList.toggle('is-open') ?? false;
      head.setAttribute('aria-expanded', String(sendOpen));
      const bodyEl = el!.querySelector<HTMLElement>('[data-send-body]');
      if (bodyEl) bodyEl.style.display = sendOpen ? 'flex' : 'none';
      return;
    }
    const btn = (ev.target as HTMLElement).closest?.(
      '[data-send-kind]'
    ) as HTMLButtonElement | null;
    if (!btn || btn.hasAttribute('disabled')) return;
    const targetId = btn.dataset.sendKind!;
    const fmt = formatEl?.value || initialFmt || formats[0] || '';
    const target = sendTargetsFor(fmt, 'export').find((tg) => sendTargetId(tg) === targetId);
    if (!target) return;
    const status = [...el!.querySelectorAll<HTMLElement>('[data-send-status]')].find(
      (candidate) => candidate.dataset.sendStatus === targetId
    );
    // Progress wording swaps the LABEL SPAN, not the button - the button also holds
    // the destination glyph, and writing textContent on it would delete that glyph
    // and never bring it back.
    const label = btn.querySelector<HTMLElement>('span') ?? btn;
    const prev = label.textContent;
    btn.toggleAttribute('disabled', true);
    btn.setAttribute('aria-busy', 'true');
    try {
      const name =
        el!.querySelector<HTMLInputElement>('[data-action="filename"]')?.value.trim() ||
        autoFilename();
      // Destination first, bytes second: a target with a `prepare` (Penpot's
      // project + file-name picker) asks BEFORE anything renders, so the
      // question arrives while this is still a choice rather than after a wait
      // nobody asked for. Cancelling sends nothing. The mime is unknown until
      // the render, so it goes empty here.
      let choice: Record<string, unknown> | undefined;
      if (target.prepare) {
        const picked = await target.prepare({ name, format: fmt, mime: '' }, { anchor: btn });
        if (!picked) {
          if (status) status.textContent = t('Cancelled');
          return;
        }
        choice = picked;
      }
      label.textContent = t('Rendering…');
      const opts = {
        ...exportDims(),
        ...(target.requiresCredential
          ? { c2pa: true, ...(c2paDaysVal() ? { c2paDays: c2paDaysVal()! } : {}) }
          : {}),
        ...(fmt === 'emf' &&
        el!.querySelector<HTMLInputElement>('[data-action="emf-outline"]')?.checked
          ? { text: 'outline' as const }
          : {}),
      };
      // Multi-page/animated sends keep the whole canvas (their walkers need every
      // [data-pdf-page]); flat single-image sends target the active artboard.
      const multiPage =
        fmt === 'pdf' ||
        fmt === 'pdf-cmyk' ||
        fmt === 'pptx' ||
        fmt === 'penpot' ||
        fmt === 'docx' ||
        fmt === 'odt' ||
        isAnimatedFmt(fmt);
      const sendNode = multiPage ? exportTargetNode(canvasEl) : flatExportNode(canvasEl);
      const blob = await exportUnscaled(() => runtime.export(sendNode, fmt, opts), {
        shutter: true,
      });
      label.textContent = t('Sending…');
      const out = await target.send({
        bytes: new Uint8Array(await blob.arrayBuffer()),
        name,
        format: fmt,
        mime: blob.type,
        choice,
      });
      if (status) {
        // The driver's url is REMOTE-SOURCED (an upload service's response), so it
        // must pass the scheme gate before it renders as a link - a bad one
        // degrades to the plain label.
        status.innerHTML =
          out.url && safeHref(out.url)
            ? // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref()-gated in the guard above
              `<a href="${escape(out.url)}" target="_blank" rel="noopener">${escape(out.label)}</a>`
            : escape(out.label);
      }
      bumpMetric('filesRendered');
      announce(`Sent to ${target.label}`);
    } catch (err) {
      console.error(`Send to ${targetId} failed:`, err);
      const msg = String((err as Error)?.message || '');
      if (status)
        status.textContent = msg && msg.length <= 120 ? msg : t('Send failed - try again');
      announce('Send failed', { assertive: true });
    } finally {
      btn.removeAttribute('aria-busy');
      label.textContent = prev;
      btn.toggleAttribute('disabled', false);
    }
  });

  // "Make variants" / multi-edit - the icon button NEXT TO THE TOOL NAME (markup
  // in tool.ts's sidebar header; it lives outside `el`, hence the document lookup).
  // Deliberately not an export option: it's a step BEFORE export. The click opens
  // a how-many dropdown (a 2–8 quick-pick - multi-edit's grid holds far more now,
  // but a dropdown of one tool's variants stays short; for a big fan-out use the
  // gallery's multi-select "Make copies"); picking a count
  // persists the CURRENT live state into that many fresh sessions (labelled A…H -
  // the same payload + slot shape performSave writes, so they're ordinary saved
  // sessions everywhere) and jumps straight into multi-edit with them side by
  // side. The active session's own slot is untouched: variants are copies, so
  // the experiments never overwrite the original.
  const multiBtn = document.getElementById('multi-edit-btn') as HTMLButtonElement | null;
  if (multiBtn) {
    const makeVariants = async (count: number): Promise<void> => {
      if (multiBtn.dataset.saving) return;
      multiBtn.dataset.saving = '1';
      multiBtn.disabled = true;
      multiBtn.setAttribute('aria-busy', 'true');
      try {
        const data = sessionSnapshot();
        // One thumbnail serves every copy - they start identical.
        const thumb = await captureThumbnail(
          manifest,
          canvasEl,
          runtime,
          exportUnscaled,
          data.__export_format
        );
        const stamp = Date.now();
        const slots: string[] = [];
        for (let i = 0; i < count; i++) {
          const slot = `${manifest.id}:${stamp + i}`; // ms offset keeps the minted slots unique
          await host.state.save(slot, { ...data, __label: String.fromCharCode(65 + i) }, thumb);
          slots.push(slot);
        }
        announce('Saved');
        // The shape mountMultiEdit parses (main.ts route 'multi': ?s=slot,slot…).
        navigateTo(`#/multi?s=${slots.map(encodeURIComponent).join(',')}`);
      } catch (err) {
        console.error('Make variants failed:', err);
        announce('Save failed');
      } finally {
        multiBtn.disabled = false;
        multiBtn.removeAttribute('aria-busy');
        delete multiBtn.dataset.saving;
      }
    };
    const menu = mountBodyPopover(
      multiBtn,
      (pop) => {
        pop.innerHTML = `
        <div class="multi-edit-menu-head">${t('How many copies?')}</div>
        <div class="multi-edit-menu-counts">${[2, 3, 4, 5, 6, 7, 8]
          .map(
            (n) =>
              `<button type="button" class="multi-edit-count" role="menuitem" data-count="${n}">${n}</button>`
          )
          .join('')}</div>`;
        pop.querySelectorAll<HTMLButtonElement>('[data-count]').forEach((b) =>
          b.addEventListener('click', () => {
            menu.close();
            void makeVariants(Number(b.dataset.count));
          })
        );
        return pop.querySelector<HTMLElement>('[data-count]');
      },
      {
        className: 'multi-edit-menu',
        ariaLabel: t('Make variants'),
        // Left-aligned under the trigger (the default is right-aligned - built for
        // the top-right chrome; this trigger sits in the LEFT sidebar).
        position(pop, anchor) {
          const r = anchor.getBoundingClientRect();
          pop.style.top = `${Math.round(r.bottom + 8)}px`;
          pop.style.left = `${Math.max(8, Math.round(r.left))}px`;
        },
      }
    );
    multiBtn.addEventListener('click', () => {
      menu.isOpen() ? menu.close(true) : menu.open();
    });
  }

  // Apply the initial (or restored) dimensions to the canvas preview immediately.
  refreshCanvasPreview();

  // Render to the live frame for PREVIEW only (deferred-preview tools - see
  // manifest.render.preview). We run the normal export pipeline purely for its
  // side effect: an expensive beforeExport hook (e.g. url-shot's page capture)
  // paints its result into the canvas DOM. We then discard the blob - no
  // download, no clipboard. The painted frame stays until the next input change
  // rebuilds the template (which correctly invalidates the stale preview).
  let previewing = false;
  async function preview(): Promise<void> {
    if (previewing) return;
    previewing = true;
    try {
      const fmt =
        (manifest.render.preview as { format?: string } | undefined)?.format ||
        manifest.render.formats[0]!;
      await exportUnscaled(() => runtime.export(exportTargetNode(canvasEl), fmt, exportDims()));
    } finally {
      previewing = false;
    }
  }

  // Expose actions the mount scope can trigger programmatically (e.g. `?copy`,
  // and the unsaved-changes dialog's "Save & leave"). stopAudioPreview lets the
  // popup-close + tool-teardown paths silence an in-progress audio audition.
  // `sessionState` is the SAME snapshot a save writes, read (never written) by the beam
  // for its `__export_*` markers - the one place they exist outside this panel's DOM.
  automaticHistory = mountActionHistory({
    enabled: experience.localHistory, host, toolId: manifest.id, el, canvas: canvasEl,
    getSlot: () => activeSlot, setSlot: slot => { activeSlot = slot; },
    takeFolder: () => { const folder = fileIntoFolder; fileIntoFolder = null; return folder; },
    snapshot: sessionSnapshot, initial: experience.historyBase,
  });
  return {
    copy: performCopy,
    preview,
    save: performSave,
    setDims,
    setFormat,
    setFormats,
    setExperience,
    stopAudioPreview,
    sessionState: sessionSnapshot,
    getSlot: () => activeSlot,
    history: automaticHistory,
    dispose: disposeActions,
  };
}

export {
  c2paDefaultOn,
  extFor,
  isCmykFmt,
  isPrintFmt,
  marksToCsv,
  printEnabled,
  readBleed,
  readMarks,
  renderActions,
};
