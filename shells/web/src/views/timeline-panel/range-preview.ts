// SPDX-License-Identifier: MPL-2.0
import { motionReviewTimes, parseSampleTimes } from '../../../../../engine/src/sequence-samples.ts';
import { parseSequenceStage } from '../../bridge/sequence-plan.ts';
import { t } from '../../i18n.ts';
import { mountModal, type ModalHandle } from '../../components/modal.ts';
import type { TpCtx } from './context.ts';

/** A rendered preview uses the export executor, including its audio mix. */
export function rangePreviewOps(tp: TpCtx) {
  let modal: ModalHandle<void> | null = null;
  let abort: AbortController | null = null;
  let url = '';
  let shuttleFrame = 0;
  let rate = 0;
  const stopShuttle = (): void => {
    cancelAnimationFrame(shuttleFrame); shuttleFrame = 0; rate = 0;
  };
  const close = (): void => {
    abort?.abort(); abort = null;
    modal?.el.querySelector('video')?.pause();
    if (url) { URL.revokeObjectURL(url); url = ''; }
    modal = null;
  };
  return {
    async open(review = false): Promise<void> {
      if (modal || tp.disposed) return;
      stopShuttle(); tp.clock.pause(); tp.playback.syncPlayBtn();
      const controller = new AbortController(); abort = controller;
      const view = mountModal('', { className: 'modal tl-mix-preview', ariaLabel: review ? t('Review frames') : t('Preview mix'), onClose: close });
      modal = view;
      const title = document.createElement('h2'); title.textContent = review ? t('Review frames') : t('Preview mix');
      const status = document.createElement('p'); status.textContent = t('Rendering'); status.setAttribute('role', 'status');
      const done = document.createElement('button'); done.type = 'button'; done.className = 'btn'; done.textContent = t('Close'); done.addEventListener('click', () => view.close());
      view.el.append(title, status, done);
      try {
        const { renderSequence } = await import('../../bridge/sequence-render.ts');
        if (controller.signal.aborted) return;
        const size = tp.opts.frameSize?.();
        const width = Math.min(960, size?.w ?? 960);
        if (review) {
          const stage = parseSequenceStage(tp.canvasEl);
          if (!stage) throw new Error('A review needs a timed composition.');
          const input = document.createElement('input'); input.className = 'field-input'; input.setAttribute('aria-label', t('Review sample times in seconds'));
          const boundaries = [...new Set(stage.layers.flatMap(layer => [layer.startMs / 1000, (layer.startMs + layer.durMs) / 1000]))].filter(at => at >= 0 && at < stage.totalMs / 1000);
          try { input.value = motionReviewTimes(stage.totalMs / 1000, Number(tp.opts.projectTime?.rate()) || 30, boundaries).join(','); }
          catch { input.value = '0'; status.textContent = t('Choose up to 64 samples for this timeline'); }
          const render = document.createElement('button'); render.className = 'btn'; render.textContent = t('Render samples');
          const gallery = document.createElement('div'); gallery.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
          view.el.insertBefore(input, done); view.el.insertBefore(render, done); view.el.insertBefore(gallery, done);
          const urls: string[] = []; controller.signal.addEventListener('abort', () => urls.forEach(value => { URL.revokeObjectURL(value); }), { once: true });
          render.addEventListener('click', async () => {
            render.disabled = true; gallery.textContent = ''; urls.splice(0).forEach(value => { URL.revokeObjectURL(value); });
            try {
              const times = parseSampleTimes(input.value)!;
              if (times.some(at => at * 1000 >= stage.totalMs)) throw new Error('Samples must be before the timeline end.');
              await renderSequence(tp.canvasEl, 'apng', { width: Math.min(480, width), signal: controller.signal }, null, {
                timesMs: times.map(at => at * 1000),
                async frame(canvas, _context, i) {
                  const blob = 'convertToBlob' in canvas ? await canvas.convertToBlob({ type: 'image/png' }) : await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Frame capture failed.')), 'image/png'));
                  const url = URL.createObjectURL(blob); urls.push(url);
                  const figure = document.createElement('figure'), image = document.createElement('img'), caption = document.createElement('figcaption');
                  image.src = url; image.alt = `${times[i]}s`; image.style.width = '180px'; caption.textContent = `${times[i]}s`; figure.append(image, caption); gallery.append(figure);
                },
                async finish() { return new Blob(); },
              });
              status.textContent = t('Review the sampled frames');
            } catch (error) { status.textContent = (error as Error).message; }
            finally { render.disabled = false; }
          });
          status.textContent = t('Choose samples around transitions and reading holds');
          return;
        }
        const blob = await renderSequence(tp.canvasEl, 'mp4', { width, signal: controller.signal,
          onProgress: (n, total) => { status.textContent = `${t('Rendering')} ${Math.round(n / Math.max(1, total) * 100)}%`; } }, { log: tp.host.log });
        if (controller.signal.aborted || tp.disposed) return;
        url = URL.createObjectURL(blob);
        const video = document.createElement('video'); video.controls = true; video.playsInline = true; video.src = url;
        status.replaceWith(video);
        const inspect = document.createElement('button'); inspect.className = 'btn'; inspect.textContent = t('Check rendered file'); view.el.append(inspect);
        inspect.addEventListener('click', async () => {
          inspect.disabled = true;
          try {
            const { inspectMotionBlob } = await import('../../bridge/motion-inspect.ts');
            const report = await inspectMotionBlob(blob, {}, controller.signal);
            if (controller.signal.aborted) return;
            const results = document.createElement('ul');
            for (const check of report.checks) { const row = document.createElement('li'); row.textContent = `${check.id}: ${check.status}${check.measured !== undefined ? ` (${JSON.stringify(check.measured)})` : ''}${check.reason ? `. ${check.reason}` : ''}`; results.append(row); }
            inspect.replaceWith(results);
          } catch (error) { if (!controller.signal.aborted) { inspect.textContent = (error as Error).message; inspect.disabled = false; } }
        });
        await video.play().catch(() => { /* controls remain available */ });
      } catch (error) {
        if (!controller.signal.aborted) { status.textContent = t('Could not render preview'); tp.host.log?.('warn', String(error)); }
      }
    },
    shuttle(direction: number): void {
      const next = Math.sign(rate) === direction ? Math.min(4, Math.abs(rate) * 2) : 1;
      stopShuttle(); tp.clock.pause(); rate = direction * next;
      let previous = performance.now();
      const tick = (now: number): void => {
        if (tp.disposed || !tp.open || !rate || tp.clock.playing()) { stopShuttle(); return; }
        const at = tp.clock.t() + (now - previous) * rate; previous = now;
        const end = tp.clock.duration();
        tp.clock.seek(Math.max(0, Math.min(end, at)), { scrubbing: true });
        if (at <= 0 || at >= end) { stopShuttle(); return; }
        shuttleFrame = requestAnimationFrame(tick);
      };
      shuttleFrame = requestAnimationFrame(tick);
    },
    stopShuttle,
    destroy(): void { stopShuttle(); modal?.close(); close(); },
  };
}
