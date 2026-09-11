// SPDX-License-Identifier: MPL-2.0
/**
 * PDF tile thumbs (plans/140 S6): upgrade the ▦ 'data' stub of a stored PDF -
 * an auto-saved render (lib/save-render.ts keeps the credentialed bytes
 * VERBATIM, so ingest-time conversion is off the table), or any other asset
 * that kept raw PDF bytes - to a first-page vector preview drawn by the same
 * interpreter a .pdf upload takes (views/pdf-import.ts).
 *
 * Same lifecycle as the audio/text thumb upgraders: on-screen gated (an
 * IntersectionObserver, so the interpreter chunk loads only when a PDF tile
 * actually scrolls in), one decode at a time, module-level cache so re-renders
 * repaint instantly. Text runs stay <text> (no outlining pass for a thumb);
 * an uncovered font falls back to the UA face, which reads fine at tile size.
 */

const svgUrlById = new Map<string, string>();
let chain: Promise<void> = Promise.resolve();

function paint(el: HTMLElement, url: string): void {
  el.textContent = '';
  el.style.backgroundImage = `url('${url}')`;
  el.style.backgroundSize = 'contain';
  el.style.backgroundRepeat = 'no-repeat';
  el.style.backgroundPosition = 'center';
}

export function mountPdfThumbs(
  rootEl: HTMLElement,
  refFor: (id: string) => { url?: string } | undefined,
  isCurrent: () => boolean,
): { destroy(): void } {
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const el = en.target as HTMLElement;
      io.unobserve(el);
      const id = el.dataset.pdfThumb;
      if (!id) continue;
      const cached = svgUrlById.get(id);
      if (cached) { paint(el, cached); continue; }
      // Serial: the interpreter holds a full page model per run, and a grid of
      // PDFs decoding in parallel would spike memory for thumbs nobody asked
      // for yet. Failures keep the calm stub - a thumb is never worth an error.
      chain = chain.then(async () => {
        if (!isCurrent() || !el.isConnected) return;
        try {
          const url = refFor(id)?.url;
          if (!url) return;
          const blob = await (await fetch(url)).blob();
          const { openPdfFile } = await import('../views/pdf-import.ts');
          const handle = await openPdfFile(new Blob([await blob.arrayBuffer()], { type: 'application/pdf' }));
          const page = await handle.pageToSvg(0, { warn: () => {} });
          if (!page?.svg || !page.elementCount) return;
          const svgUrl = URL.createObjectURL(new Blob([page.svg], { type: 'image/svg+xml' }));
          svgUrlById.set(id, svgUrl);
          if (el.isConnected && isCurrent()) paint(el, svgUrl);
        } catch { /* keep the stub */ }
      });
    }
  }, { rootMargin: '200px' });
  rootEl.querySelectorAll<HTMLElement>('[data-pdf-thumb]').forEach((el) => {
    const cached = svgUrlById.get(el.dataset.pdfThumb ?? '');
    if (cached) paint(el, cached);
    else io.observe(el);
  });
  return { destroy: () => io.disconnect() };
}
