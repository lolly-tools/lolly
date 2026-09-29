// SPDX-License-Identifier: MPL-2.0
import type { ExportOpts } from './export.ts';
import type { SequenceStage } from './sequence-plan.ts';
import { sequenceExportSize } from './sequence-preflight.ts';

interface DimensionHost {
  log?(level: string, message: string): void;
  notice?(message: string): void;
}

export function sequenceDimensions(
  stage: SequenceStage, stageEl: HTMLElement,
  format: string, opts: ExportOpts, host: DimensionHost | null,
): { nativeW: number; nativeH: number; outW: number; S: number; targetH: number } {
  const log = (level: string, message: string): void => host?.log?.(level, message);
  // A frames-as-scenes slideshow ("Design", plan 92) sizes to a SLIDE, not the stage:
  // the [data-sequence] element spans the whole side-by-side pasteboard of every frame,
  // so its offsetWidth is the strip, not one slide. Size the output to the first timed
  // frame's own box; combined with normalizeFrameScene (which re-anchors each slide's
  // draw rect to (0,0,nativeW,nativeH)) every slide then fills this slide-sized canvas
  // at the origin. Object-clip Video / Sequence Studio docs carry no frameScene layer,
  // so they keep the stageEl.offsetWidth path byte-for-byte.
  const frameScene0 = stage.layers.find((l) => l.frameScene && l.rect.w > 0 && l.rect.h > 0);
  const wantW = Number(opts.width);
  const wantH = Number(opts.height);
  // A single origin-aligned board contains independently timed children. Its
  // authored size survives URL resizing; the surrounding editor canvas does not.
  const pages = [...stageEl.querySelectorAll<HTMLElement>('[data-pdf-page]')];
  const board = !frameScene0 && pages.length === 1
    && pages[0]!.offsetLeft === 0 && pages[0]!.offsetTop === 0
    && stage.layers.every(layer => layer.el.closest('[data-pdf-page]') === pages[0])
    ? pages[0] : undefined;
  // Frames mode: the output frame is the CALLER'S requested size when given - the
  // export bar mirrors the artboard under the playhead (plans/141 WP-B/C) - falling
  // back to the first timed frame's own box. Every slide then contain-fits into it
  // via normalizeFrameScene: a different-sized artboard letterboxes, never stretches.
  const nativeW = frameScene0
    ? (Number.isFinite(wantW) && wantW > 0 ? Math.round(wantW) : frameScene0.rect.w)
    : Math.max(1, board?.offsetWidth || stageEl.offsetWidth || 1920);
  const nativeH = frameScene0
    ? (Number.isFinite(wantH) && wantH > 0 ? Math.round(wantH) : frameScene0.rect.h)
    : Math.max(1, board?.offsetHeight || stageEl.offsetHeight || 1080);
  // Even dimensions: H.264 chroma subsampling refuses an odd width or height. The
  // rounding happens BEFORE the scale is derived, so an odd requested width is
  // resampled to fit rather than losing its last pixel column of content.
  const desiredW = Number.isFinite(wantW) && wantW > 0 ? wantW : nativeW;
  const size = sequenceExportSize(desiredW, nativeH * desiredW / nativeW, stage.totalMs / 1000, opts.videoCodec ?? (format === 'webm' ? 'vp9' : 'avc'));
  const outW = size.width;
  const S = outW / nativeW;
  const targetH = size.height;
  if (size.reduced) {
    const message = `sequence: export size reduced to ${outW} by ${targetH} for this duration and codec`;
    log('warn', message); host?.notice?.(message);
  }
  if (Number.isFinite(wantH) && wantH > 0 && Math.abs(wantH - targetH) > 2) {
    log('warn', `sequence: exporting ${outW}x${targetH} - a sequence keeps the stage's aspect ratio, so the requested height (${Math.round(wantH)}) is derived from the width.`);
  }

  return { nativeW, nativeH, outW, S, targetH };
}
