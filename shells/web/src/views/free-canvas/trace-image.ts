// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: Trace image - turn the selected image box into a group of vector paths.
 *
 * The panel asks for one of four presets, then the run is a background job (lib/jobs.ts):
 * the pixels are read in the page, tracing runs in a worker with a stage line and a cancel
 * button, and the paths are inserted just above the image. The result is pinned to the box's
 * own id, so a selection that moved on meanwhile does not matter, and nothing is inserted if
 * the box is gone. The engine side (engine/src/image-trace.ts) is pure; this file is the DOM
 * and canvas half.
 *
 * Every function takes the shared `fc: FcCtx` first (see context.ts).
 */
import { num } from '../free-canvas-math.ts';
import type { Box } from '../free-canvas-math.ts';
import { pathToBox } from '../vector-ops.ts';
import {
  IMAGE_TRACE_PRESETS, ImageTraceError, imageTraceToPaths, imageTraceView, imageTraceWorkSize,
  type ImageTracePreset,
} from '../../../../../engine/src/image-trace.ts';
import { startJob } from '../../lib/jobs.ts';
import { t } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { bindOp, type FcCtx } from './context.ts';

const PRESET_COPY: Record<ImageTracePreset, { name: string; hint: string }> = {
  logo: { name: 'Logo', hint: 'Flat colours with crisp edges.' },
  illustration: { name: 'Illustration', hint: 'Several colours, as filled shapes.' },
  'line-art': { name: 'Line art', hint: 'Dark lines on a light page, as black shapes.' },
  centreline: { name: 'Centreline', hint: 'Dark lines as single strokes.' },
};

interface ImageRef { id?: string; url?: string; meta?: { name?: string } }

/** The selected box when it is one image box with a picture; otherwise null. */
function selectedImage(fc: FcCtx): { box: Box; at: number; ref: ImageRef } | null {
  const imageField = fc.cfg.imageField;
  if (!imageField) return null;
  const boxes = fc.select.getBoxes();
  const idxs = fc.select.selIndices(boxes);
  if (idxs.length !== 1) return null;
  const at = idxs[0]!, box = boxes[at]!;
  const ref = box[imageField] as ImageRef | undefined;
  if (!ref || (!ref.id && !ref.url)) return null;
  return { box, at, ref };
}

export function canTraceImage(fc: FcCtx): boolean {
  return Boolean(fc.vectorCfg) && selectedImage(fc) !== null;
}

/** Ask which preset, then trace. */
export function askTraceImage(fc: FcCtx): void {
  if (!canTraceImage(fc)) return;
  const { stageEl } = fc;
  fc.toolbox.closePopover();
  fc.document.closeMorePanel();
  const p = document.createElement('div');
  p.className = 'fc-panel fc-num-panel fc-trace-panel';
  p.innerHTML =
    `<div class="fc-panel-head">${escapeText(t('Trace image'))}</div>` +
    `<p class="fc-num-hint">${escapeText(t('Turn this picture into shapes you can edit.'))}</p>` +
    '<div class="fc-trace-presets" role="radiogroup" aria-label="' + escapeText(t('Trace image')) + '">' +
    IMAGE_TRACE_PRESETS.map((id, i) =>
      `<label class="fc-trace-preset"><input type="radio" name="fc-trace-preset" value="${id}"${i === 1 ? ' checked' : ''}>` +
      `<b>${escapeText(t(PRESET_COPY[id].name))}</b><span>${escapeText(t(PRESET_COPY[id].hint))}</span></label>`).join('') +
    '</div>' +
    '<div class="fc-num-row fc-confirm-row">' +
    `<button type="button" class="btn btn--primary btn--sm" data-trace-go>${escapeText(t('Trace'))}</button>` +
    '</div>';
  p.addEventListener('pointerdown', (e) => e.stopPropagation());
  const go = (): void => {
    const preset = (p.querySelector<HTMLInputElement>('input[name="fc-trace-preset"]:checked')?.value ?? 'illustration') as ImageTracePreset;
    fc.document.closeMorePanel();
    void traceImageOnSelection(fc, preset);
  };
  p.querySelector<HTMLButtonElement>('[data-trace-go]')!.addEventListener('click', (e) => { e.stopPropagation(); go(); });
  p.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  stageEl.appendChild(p);
  fc.morePanel = p;
  const sr = stageEl.getBoundingClientRect();
  p.style.left = Math.max(6, Math.min(fc.lastMenuAt.x - sr.left, Math.max(6, sr.width - p.offsetWidth - 6))) + 'px';
  p.style.top = Math.max(6, Math.min(fc.lastMenuAt.y - sr.top, Math.max(6, sr.height - p.offsetHeight - 6))) + 'px';
  p.querySelector<HTMLInputElement>('input:checked')?.focus();
}

async function decodeImage(url: string): Promise<{ source: CanvasImageSource; width: number; height: number; close(): void }> {
  const blob = await (await fetch(url)).blob();
  try {
    const bmp = await createImageBitmap(blob);
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    // An SVG blob that createImageBitmap refuses still draws through an image element.
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.src = objectUrl;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(objectUrl) };
  }
}

/** Run one trace and insert the result above the selected image box. */
export async function traceImageOnSelection(fc: FcCtx, preset: ImageTracePreset): Promise<void> {
  const { cfg, vectorCfg } = fc;
  const sel = selectedImage(fc);
  if (!sel || !vectorCfg) return;
  const boxId = fc.select.idOf(sel.box, sel.at);
  const controller = new AbortController();
  let cancelWorker: (() => void) | undefined;
  const job = startJob({ title: t('Tracing image'), cancel: () => { controller.abort(); cancelWorker?.(); } });
  const TOTAL = 4;
  try {
    await job.started;
    if (job.cancelled) return;
    job.progress(1, TOTAL, t('Reading the image'));
    const url = sel.ref.url;
    if (!url) throw new ImageTraceError('failed', t('This image could not be read.'));
    const frame = { x: num(sel.box[cfg.xField], 0), y: num(sel.box[cfg.yField], 0), w: num(sel.box[cfg.wField], 0), h: num(sel.box[cfg.hField], 0) };
    const img = await decodeImage(url);
    let pixels: Uint8Array, width: number, height: number, placed: ReturnType<typeof imageTraceView>['placed'];
    try {
      const view = imageTraceView(frame, img.width, img.height, String(sel.box[cfg.fitField] ?? 'contain'), cfg.imgPosField ? String(sel.box[cfg.imgPosField] ?? 'center') : 'center');
      ({ width, height } = imageTraceWorkSize(view.crop.w, view.crop.h));
      placed = view.placed;
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new ImageTraceError('failed', t('This image could not be read.'));
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img.source, view.crop.x, view.crop.y, view.crop.w, view.crop.h, 0, 0, width, height);
      pixels = new Uint8Array(ctx.getImageData(0, 0, width, height).data.buffer);
    } finally { img.close(); }
    if (job.cancelled) return;
    const { traceImageOffThread, cancelImageTrace } = await import('../../bridge/image-trace.ts');
    cancelWorker = cancelImageTrace;
    job.progress(2, TOTAL, t('Starting the tracer'));
    const result = await traceImageOffThread(pixels, width, height, preset, controller.signal, (stage) => {
      if (stage === 'tracing') job.progress(3, TOTAL, t('Tracing'));
    });
    if (job.cancelled) return;
    job.progress(4, TOTAL, t('Adding shapes'));
    const traced = imageTraceToPaths(result, placed);
    if (!traced.length) throw new ImageTraceError('failed', t('No shapes were found. Try another preset.'));

    // The canvas may have changed while the worker ran: re-read it and find the box by id.
    const boxes = fc.select.getBoxes();
    const at = fc.select.indexOfId(boxes, boxId);
    if (at < 0) { job.finish(); return; }
    const src = boxes[at]!;
    const rot = num(src[cfg.rotationField], 0);
    const scx = num(src[cfg.xField], 0) + num(src[cfg.wField], 0) / 2;
    const scy = num(src[cfg.yField], 0) + num(src[cfg.hField], 0) / 2;
    const group = cfg.groupField ? fc.objects.freshGroupId(boxes) : '';
    const made: Box[] = [];
    for (const tp of traced) {
      const pb = pathToBox(tp.path, null, { cfg: vectorCfg, id: fc.select.freshId(boxes.concat(made)) });
      if (!pb) throw new ImageTraceError('limit', t('This trace makes too many points for the canvas. Try the logo or line art preset, or a simpler image.'));
      if (tp.paint.fill) { if (cfg.fillField) pb[cfg.fillField] = tp.paint.fill; pb[cfg.strokeField] = ''; pb[cfg.strokeWField] = 0; }
      else {
        if (cfg.fillField) pb[cfg.fillField] = 'transparent';
        pb[cfg.strokeField] = tp.paint.stroke; pb[cfg.strokeWField] = tp.paint.strokeW;
      }
      pb[cfg.fillRuleField] = 'nonzero';
      if (group && cfg.groupField) pb[cfg.groupField] = group;
      if (rot) {
        const cx = num(pb[cfg.xField], 0) + num(pb[cfg.wField], 0) / 2, cy = num(pb[cfg.yField], 0) + num(pb[cfg.hField], 0) / 2;
        const rad = (rot * Math.PI) / 180, vx = cx - scx, vy = cy - scy;
        pb[cfg.xField] = num(pb[cfg.xField], 0) + vx * Math.cos(rad) - vy * Math.sin(rad) - vx;
        pb[cfg.yField] = num(pb[cfg.yField], 0) + vx * Math.sin(rad) + vy * Math.cos(rad) - vy;
        pb[cfg.rotationField] = rot;
      }
      made.push(pb);
    }
    fc.selection = new Set(made.map((b) => String(b[cfg.idField])));
    fc.select.commit([...boxes.slice(0, at + 1), ...made, ...boxes.slice(at + 1)]);
    fc.stage.flash(made.length === 1 ? t('Traced into one shape, above the image.') : t('Traced into {n} shapes, above the image.', { n: made.length }));
    job.finish();
  } catch (err) {
    if (job.cancelled || controller.signal.aborted) return;
    job.fail(err);
    fc.stage.flash(err instanceof ImageTraceError ? err.message : t('The image could not be traced.'));
  } finally {
    job.settle();
  }
}

export function traceImageOps(fc: FcCtx) {
  return {
    canTraceImage: bindOp(fc, canTraceImage),
    askTraceImage: bindOp(fc, askTraceImage),
    traceImageOnSelection: bindOp(fc, traceImageOnSelection),
  };
}
