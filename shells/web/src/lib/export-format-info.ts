// SPDX-License-Identifier: MPL-2.0
import { audioSupport, cmykTiffSupport, proFormatSupport, tiffSupport, videoSupport } from '../bridge/format-support.ts';
import { isAudioFormat as isAudioFmt } from './audio-encode.ts';

/** The float interchange formats. Mirrors DEEP_FORMATS in packages/node-shell/src/raster.ts. */
export const PRO_FORMATS: readonly string[] = ['exr', 'hdr'];

export const isProFormat = (f: string | undefined): boolean => !!f && PRO_FORMATS.includes(f);

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
  lottie: 'dotLottie',
  idml: 'InDesign IDML (static subset)',
  'premiere-xml': 'Premiere XML + media',
  jxl: 'JPEG XL',
  'jxl-lossless': 'JPEG XL lossless',
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
