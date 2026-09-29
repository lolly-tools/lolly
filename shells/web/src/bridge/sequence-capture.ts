// SPDX-License-Identifier: MPL-2.0
/** Still-frame sinks for the same compositor that writes movies. */
import type { AnyCanvas, AnyCtx } from './sequence-render.worker.ts';
import type { ExportOpts } from './export.ts';
import type { CutsDeps } from './sequence-cuts.ts';

export interface SequenceCapture {
  timesMs: number[];
  frame(canvas: AnyCanvas, ctx: AnyCtx, index: number): Promise<void>;
  finish(): Promise<Blob>;
}
export async function captureSequenceStills(node: Element, format: string, opts: ExportOpts, timesMs: number[], deps: CutsDeps, cutMemberName: (base: string, format: string, i: number, n: number) => string): Promise<Blob> {
  if (!['png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(format)) throw new Error('Animated-source samples and temporal motion blur require PNG, JPG, WebP or PDF.');
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none';
  document.body.append(holder);
  const pages: HTMLCanvasElement[] = [], members: { name: string; bytes: Uint8Array }[] = [];
  let single: Blob | undefined;
  const memberOpts = { ...opts, cuts: 1, sampleTimes: undefined, motionBlur: undefined, sequenceRange: undefined, onProgress: undefined };
  try {
    const { renderSequence } = await import('./sequence-render.ts');
    return await renderSequence(node, 'apng', opts, null, {
      timesMs,
      async frame(source, _ctx, i) {
        opts.signal?.throwIfAborted();
        if (format === 'pdf' && source.width * source.height * timesMs.length > 64 * 1024 * 1024) throw new Error('Sample pages exceed 256 MiB. Reduce the dimensions or sample count.');
        const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
        canvas.style.cssText = `width:${source.width}px;height:${source.height}px;display:block`;
        canvas.getContext('2d')!.drawImage(source, 0, 0); holder.append(canvas);
        if (format === 'pdf') pages.push(canvas);
        else {
          const blob = await deps.renderStill(canvas, format, memberOpts);
          if (timesMs.length === 1) single = blob;
          else members.push({ name: cutMemberName(opts.filename || 'export', format, i, timesMs.length), bytes: new Uint8Array(await blob.arrayBuffer()) });
          canvas.remove(); canvas.width = canvas.height = 0;
        }
      },
      async finish() {
        if (format === 'pdf') return deps.renderPdfPages(pages, memberOpts, () => opts.signal?.throwIfAborted());
        return single ?? deps.packZip(members, opts);
      },
    });
  } finally { for (const canvas of holder.querySelectorAll('canvas')) canvas.width = canvas.height = 0; holder.remove(); }
}
