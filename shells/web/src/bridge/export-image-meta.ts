// SPDX-License-Identifier: MPL-2.0
/**
 * Thin re-export of the engine's image-metadata byte stampers.
 *
 * The DOM-free stampers that used to live here verbatim (stage 1 of the
 * export.ts split) graduated to `engine/src/image-meta.ts` (plans/144 Wave 1)
 * so the transform path (`host.images` metadata carry) and the CLI share one
 * implementation. Web call sites keep importing from this path unchanged.
 * Only `iccWanted` stays local - it reads the web shell's own ExportOpts.
 */
export {
  patchJpegDpi, readU32, writeU32, pngChunk, insertPngPhys, setAvifCicp, insertPngCicp,
  iTXtChunk, insertPngMeta, insertPngXmp, buildExifTiff, insertJpegExif, insertJpegXmp,
  insertWebpMeta, insertAvifExif, buildExportXmp, svgMetaBlock,
  injectSvgMeta, withGifComment, insertPngIcc, insertJpegIcc, inflateBytes, deflateBytes,
} from '../../../../engine/src/image-meta.ts';
import type { ExportOpts } from './export.ts';

// Embed when a profile is requested (default 'srgb') and this isn't a thumbnail.
export function iccWanted(opts: ExportOpts): boolean {
  return opts.colorProfile !== 'none' && !opts.thumbnail;
}
