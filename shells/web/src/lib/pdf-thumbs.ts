// SPDX-License-Identifier: MPL-2.0
/** Local PDF thumbnails have a bounded revision cache; remote originals stay unopened. */
import { previewIsActive, subscribePreviewActivity } from './preview-activity.ts';
import { readAssetViewerBytes } from './asset-viewer-source.ts';
interface ThumbRef { url?: string; version?: string; meta?: Record<string, unknown> }
const cache = new Map<string, { url: string; size: number }>();
let total = 0, chain: Promise<void> = Promise.resolve();
function paint(el: HTMLElement, url: string): void { el.textContent = ''; el.style.backgroundImage = `url('${url}')`; el.style.backgroundSize = 'contain'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = 'center'; }
const keyFor = (id: string, ref: ThumbRef) => JSON.stringify([id, ref.version ?? '', ref.url]);
export function mountPdfThumbs(root: HTMLElement, refFor: (id: string) => ThumbRef | undefined, isCurrent: () => boolean): { destroy(): void } {
  const lifetime = new AbortController(); let controller = new AbortController();
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || previewIsActive()) continue; const el = entry.target as HTMLElement; io.unobserve(el);
      const id = el.dataset.pdfThumb, ref = id ? refFor(id) : undefined;
      if (!id || !ref?.url || ref.meta?.provider || /\/catalog\/(ext|instance)\//.test(ref.url)) continue;
      const key = keyFor(id, ref), cached = cache.get(key);
      if (cached) { cache.delete(key); cache.set(key, cached); paint(el, cached.url); continue; }
      const job = controller;
      chain = chain.then(async () => {
        if (job.signal.aborted || !isCurrent() || !el.isConnected) return;
        try {
          const bytes = await readAssetViewerBytes(ref.url!, job.signal, 16 * 1024 * 1024);
          const { openPdfFile } = await import('../views/pdf-import.ts'); job.signal.throwIfAborted();
          const handle = await openPdfFile(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
          const page = await handle.pageToSvg(0, { warn: () => {} }); job.signal.throwIfAborted();
          if (!page?.svg || !page.elementCount || !isCurrent() || !el.isConnected) return;
          const blob = new Blob([page.svg], { type: 'image/svg+xml' }); if (blob.size > 2 * 1024 * 1024) return;
          while (cache.size && (cache.size >= 24 || total + blob.size > 12 * 1024 * 1024)) { const oldest = cache.keys().next().value!; const item = cache.get(oldest)!; total -= item.size; URL.revokeObjectURL(item.url); cache.delete(oldest); }
          const url = URL.createObjectURL(blob); cache.set(key, { url, size: blob.size }); total += blob.size; paint(el, url);
        } catch { /* The document tile remains usable without a thumbnail. */ }
      });
    }
  }, { rootMargin: '100px' });
  root.querySelectorAll<HTMLElement>('[data-pdf-thumb]').forEach(el => { io.observe(el); });
  const unsubscribe = subscribePreviewActivity(busy => { if (busy) controller.abort(); else if (!lifetime.signal.aborted) { controller = new AbortController(); root.querySelectorAll<HTMLElement>('[data-pdf-thumb]').forEach(el => { io.observe(el); }); } });
  return { destroy() { lifetime.abort(); controller.abort(); io.disconnect(); unsubscribe(); } };
}
