// SPDX-License-Identifier: MPL-2.0
/** Only visible history tiles decode images; the timeline holds at most twelve.
 * Detached pages and stale reads cannot retain or repopulate their thumbnails. */
export function createHistoryPreviews(root: HTMLElement, read: (id: string) => Promise<string | null>) {
  const rows = new Map<HTMLElement, { id: string; image: HTMLImageElement; visible: boolean; pending: boolean; attempted: boolean }>();
  let generation = 0;
  const fill = (): void => {
    let resident = [...rows.values()].filter(row => row.image.hasAttribute('src') || row.pending).length;
    for (const row of rows.values()) {
      if (!row.visible || row.pending || row.attempted || row.image.hasAttribute('src') || resident >= 12) continue;
      resident++; row.pending = true; row.attempted = true;
      const token = generation;
      void read(row.id).then(preview => {
        if (token !== generation || !row.visible || !row.image.isConnected) return;
        if (preview && /^data:image\/(png|jpeg|webp);base64,/.test(preview)) { row.image.src = preview; row.image.hidden = false; }
      }).catch(() => {}).finally(() => { row.pending = false; if (token === generation) fill(); });
    }
  };
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const row = rows.get(entry.target as HTMLElement); if (!row) continue;
      row.visible = entry.isIntersecting;
      if (!row.visible) { row.image.removeAttribute('src'); row.image.hidden = true; row.attempted = false; }
    }
    fill();
  }, { root, rootMargin: '80px' }) : undefined;
  const clear = (): void => {
    generation++; observer?.disconnect();
    for (const row of rows.values()) { row.image.removeAttribute('src'); row.image.hidden = true; }
    rows.clear();
  };
  return {
    add(id: string, article: HTMLElement, image: HTMLImageElement) {
      rows.set(article, { id, image, visible: !observer, pending: false, attempted: false });
      if (observer) observer.observe(article); else queueMicrotask(fill);
    },
    refresh() { for (const row of rows.values()) if (!row.pending) row.attempted = false; fill(); }, clear, dispose: clear,
  };
}
