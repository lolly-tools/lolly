// SPDX-License-Identifier: MPL-2.0
import type { ExportOpts } from './export-shared.ts';
import type { HdrBoostOptions } from '../../../../engine/src/hdr.ts';
import { DESIGN_STILL_RASTER_FORMATS } from '../../../../engine/src/design-export-route.ts';
/**
 * A still raster Design export carries the authored document too (plan 326), but an HDR
 * one keeps the writer it had before that snapshot existed: the 16-bit PNG or gain-map
 * JPEG in renderRaster, not the per-box deep plates. So the snapshot alone never moves a
 * raster onto the deep route; a tool's own float frame still does.
 */
export function wantsDeepExport(format:string,opts:ExportOpts):boolean {
  return !!opts.deepFrame || opts.sourceDocument?.toolId === 'design' && !DESIGN_STILL_RASTER_FORMATS.includes(format) && (opts.sourceDocument.values.editingRange === 'hdr' || !!opts.hdr) && !['mp4','webm','gif','apng','webp-anim','svg-anim','lottie','html'].includes(format);
}

export function hdrTune(opts: ExportOpts): Partial<HdrBoostOptions> {
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
