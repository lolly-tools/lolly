// SPDX-License-Identifier: MPL-2.0
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { PDFLinkService } from 'pdfjs-dist/web/pdf_viewer.mjs';
import { viewerButton } from './asset-viewer-controls.ts';
import { t } from '../i18n.ts';

export async function mountPdfNavigation(rail: HTMLElement, pdf: PDFDocumentProxy, links: PDFLinkService, signal: AbortSignal): Promise<() => void> {
  const tabs = document.createElement('div'); tabs.className = 'asset-viewer-toolbar';
  const pages = document.createElement('div'), outline = document.createElement('div'); outline.hidden = true;
  const pageTab = viewerButton('Pages', () => { pages.hidden = false; outline.hidden = true; pageTab.setAttribute('aria-pressed', 'true'); outlineTab.setAttribute('aria-pressed', 'false'); }, tabs);
  const outlineTab = viewerButton('Outline', () => { pages.hidden = true; outline.hidden = false; pageTab.setAttribute('aria-pressed', 'false'); outlineTab.setAttribute('aria-pressed', 'true'); }, tabs);
  pageTab.setAttribute('aria-pressed', 'true'); outlineTab.setAttribute('aria-pressed', 'false'); rail.append(tabs, pages, outline);

  const labels = await pdf.getPageLabels(); signal.throwIfAborted();
  let chain = Promise.resolve(), render: RenderTask | undefined;
  const canvases = new Map<number, HTMLCanvasElement>();
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || signal.aborted) continue;
      const button = entry.target as HTMLButtonElement, page = Number(button.dataset.page);
      chain = chain.then(async () => {
        if (signal.aborted || canvases.has(page) || !button.isConnected) return;
        const model = await pdf.getPage(page); signal.throwIfAborted();
        const base = model.getViewport({ scale: 1 }); const viewport = model.getViewport({ scale: 90 / base.width });
        const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height); canvas.setAttribute('aria-hidden', 'true');
        render = model.render({ canvas, viewport }); await render.promise; render = undefined; signal.throwIfAborted();
        button.prepend(canvas); canvases.set(page, canvas);
        while (canvases.size > 32) { const old = canvases.keys().next().value!; const stale = canvases.get(old)!; stale.width = stale.height = 0; stale.remove(); canvases.delete(old); }
      }).catch(() => {});
    }
  }, { root: rail, rootMargin: '100px' });
  const cancel = () => { io.disconnect(); render?.cancel(); for (const c of canvases.values()) c.width = c.height = 0; canvases.clear(); };
  signal.addEventListener('abort', cancel, { once: true });
  for (let page = 1; page <= pdf.numPages; page++) {
    const b = viewerButton(labels?.[page - 1] ?? String(page), () => { links.page = page; }, pages);
    b.classList.add('asset-pdf-page-link'); b.dataset.page = String(page); b.setAttribute('aria-label', `${t('Page')} ${labels?.[page - 1] ?? page}`); io.observe(b);
  }
  const items = await pdf.getOutline(); signal.throwIfAborted();
  function branches(values: NonNullable<typeof items>, parent: HTMLElement, depth = 0): void {
    if (depth > 16) return;
    const list = document.createElement('ul'); list.className = 'asset-pdf-outline'; parent.append(list);
    for (const item of values.slice(0, 500)) {
      const row = document.createElement('li'); list.append(row);
      viewerButton(item.title, () => { if (!signal.aborted && item.dest) void links.goToDestination(item.dest); }, row);
      if (item.items.length) branches(item.items, row, depth + 1);
    }
  }
  if (items?.length) branches(items, outline);
  else { outlineTab.disabled = true; const p = document.createElement('p'); p.textContent = t('No document outline'); outline.append(p); }
  return () => { signal.removeEventListener('abort', cancel); cancel(); };
}
