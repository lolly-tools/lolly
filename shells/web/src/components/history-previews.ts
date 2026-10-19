// SPDX-License-Identifier: MPL-2.0
/** A picture History may draw. Checkpoint previews are stored as raster, but a saved
 *  creation keeps the thumbnail its tool made, which for an SVG tool (a QR code, a
 *  chart) is an SVG data URL. An <img> runs no script and loads nothing from an SVG,
 *  so it is drawn too. */
export const isPreviewDataUrl = (value: string | null | undefined): value is string =>
  !!value && /^data:image\/(?:(?:png|jpeg|webp);base64,|svg\+xml[;,])/.test(value);

/** Only visible history tiles decode images, at most `limit` at once (twelve for a
 * list; the History grid shows more pictures per screen and asks for more).
 * Detached pages and stale reads cannot retain or repopulate their thumbnails. */
export function createHistoryPreviews(root: HTMLElement, read: (id: string) => Promise<string | null>, { viewport = false, limit = 12 } = {}) {
  const rows = new Map<HTMLElement, { id: string; image: HTMLImageElement; visible: boolean; pending: boolean; attempted: boolean }>();
  let generation = 0;
  const fill = (): void => {
    let resident = [...rows.values()].filter(row => row.image.hasAttribute('src') || row.pending).length;
    for (const row of rows.values()) {
      if (!row.visible || row.pending || row.attempted || row.image.hasAttribute('src') || resident >= limit) continue;
      resident++; row.pending = true; row.attempted = true;
      const token = generation;
      void read(row.id).then(preview => {
        if (token !== generation || !row.visible || !row.image.isConnected) return;
        if (isPreviewDataUrl(preview)) { row.image.src = preview; row.image.hidden = false; }
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
  }, { root: viewport ? null : root, rootMargin: '80px' }) : undefined;
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
