// SPDX-License-Identifier: MPL-2.0
/**
 * Module-level declarations of tool-actions.ts that its feature modules use: the types,
 * constants and pure helpers that used to sit above renderActions(). Moved here verbatim so
 * no feature module has to import the orchestrator file. The export actions bar under a mounted tool.
 */
import { C2PA_FORMATS, PRINT_MARK_FORMATS, SEPARATING_FORMATS } from '@lolly/engine';
import type { Profile } from '@lolly-tools/core/host-v1';
import { audioSupport, cmykTiffSupport, proFormatSupport, tiffSupport, videoSupport } from '../../bridge/format-support.js';
import { isAudioFormat as isAudioFmt } from '../../lib/audio-encode.js';
import { marksToCsv } from '../../lib/print-marks-csv.ts';
import { isProFormat } from '../export-depth.ts';
import type { PrintMarks } from '../tool.ts';

/** Structural mirror of the engine MediaFrame (not re-exported from the engine index) - the
 *  RGBA frame host.media.renderFrameAt hands the tool's onFrame during a deterministic export. */
export type MediaFrameLike = { width: number; height: number; data: Uint8ClampedArray; t: number };

/** One set of captions, serialised into the two formats a moving export can carry
 *  them in (plans/180 section 4): WebVTT for the embedded track and for the web,
 *  SubRip for the editors and platforms that only take `.srt`. Both are built from
 *  the SAME cues, so the file beside the video and the track inside it always say
 *  the same words at the same moments. */
export interface CaptionText {
  vtt: string;
  srt: string;
}

// Human-readable labels and file extensions for format identifiers that differ
// from their raw string (e.g. "pdf-cmyk" → "Print PDF" / ".pdf").
export const FMT_LABEL: Record<string, string> = {
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
export const FMT_EXT: Record<string, string> = {
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
export const isC2paFmt = (f: string | undefined): boolean =>
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
export const isImprintFmt = (f: string | undefined): boolean =>
  !!f &&
  ['png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff', 'bmp', 'pdf', 'pdf-cmyk', 'pptx'].includes(f);
// HDR (Rec.2100 PQ) export. Raster: PNG (cICP) + JPEG (PQ ICC) + AVIF (native nclx
// colr) + TIFF (PQ ICC tag, archival). Video: mp4/webm carry a 10-bit PQ track with a
// colr/nclx (Colour on WebM) box (plan 154 WP-2). WebP is excluded on purpose - it has
// no working HDR decode path, so a PQ WebP would just look dark.
export const isHdrFmt = (f: string | undefined): boolean =>
  !!f && ['png', 'jpg', 'jpeg', 'avif', 'tiff', 'mp4', 'webm'].includes(f);

// Print marks & bleed apply to the three print formats (pdf / pdf-cmyk / cmyk-tiff).
// Defaults when the user turns the card on; the CSV tokens (crop,reg,bleed,bars)
// match the engine's `marks` URL param (engine/src/url-mode.js parseMarks). Bleed is
// carried as a dimension string. The Color profile (press condition) card applies to
// the two CMYK formats.
export const DEFAULT_PRINT_MARKS: PrintMarks = {
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
export const isCmykFmt = (f: string | undefined): boolean =>
  SEPARATING_FORMATS.has(f ?? '') && f !== 'eps-cmyk';
export const isPrintFmt = (f: string | undefined): boolean => PRINT_MARK_FORMATS.has(f ?? '');
// Print INTENT is narrower than print CAPABILITY. Every PRINT_MARK_FORMATS member
// can CARRY bleed and marks (that is what keeps the card on offer for pdf/svg/eps),
// but only the separating press formats (pdf-cmyk / cmyk-tiff / eps-cmyk) MEAN
// print by being picked - an everyday RGB PDF or SVG is a share/screen format
// first, so marks and bleed stay OFF for it until the user (or an explicit
// bleed/marks link/save, or a manifest declaring render.printMarks: true) asks.
// Physical units (mm/cm/in + dpi) are a size statement, not print intent, and
// never enable marks on their own.
export const isPressFmt = (f: string | undefined): boolean => SEPARATING_FORMATS.has(f ?? '');
// The `marks` CSV codec lives in lib/print-marks-csv.ts - one encoder, one
// decoder, shared with the batch/folder render path (which previously had no way
// to read a stored CSV back and so dropped print marks entirely).

// Read the Print marks card from an export-panel element `el` (empty when off).
export const printEnabled = (el: Element | null | undefined): boolean =>
  Boolean(el?.querySelector<HTMLInputElement>('[data-action="print-enable"]')?.checked);
export function readBleed(el: Element | null | undefined): string {
  if (!printEnabled(el)) return '';
  const mm = parseFloat(
    el?.querySelector<HTMLInputElement>('[data-action="print-bleed"]')?.value ?? ''
  );
  return mm > 0 ? `${mm}mm` : '';
}
export function readMarks(el: Element | null | undefined): string {
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
export const ZIP_BUNDLE = new Set([
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
export const CMYK_TIFF_OK = cmykTiffSupport();
export const TIFF_OK = tiffSupport();
export const keepFormat = (f: string, deepExportOk = false): boolean =>
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

export const fmtLabel = (f: string): string => f === 'lolly' ? '.lolly' : FMT_LABEL[f] ?? f.toUpperCase();

// Download extension follows the produced Blob - a deep-linked video request may
// fall back to the other container, so trust the Blob's MIME over the format id.
export function extFor(fmt: string, blob: Blob | null | undefined): string {
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
export type ProfileStore = { get(): Promise<Profile>; set?(profile: Profile): Promise<void> };
export interface ArtInfo {
  id: string;
  w: number;
  h: number;
}
