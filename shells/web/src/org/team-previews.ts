// SPDX-License-Identifier: MPL-2.0
/** Render shared document and folder previews from current, authorized saved state. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { getSessionSource, readSourceSessions, type SessionSource } from '../lib/session-source.ts';
import { orgSession } from './index.ts';
import { icon } from '../lib/icons.ts';
import { tRaw } from '../i18n.ts';
import { sharedSessionThumb } from './team-thumb.ts';

export function hydrateSharedPreviews(container: HTMLElement, source: SessionSource, host: HostV1, mounted: () => boolean): () => void {
  const person = orgSession();
  let stopped = false, active = 0;
  const queue: HTMLElement[] = [];
  const current = () => !stopped && mounted() && container.isConnected && source === getSessionSource() && person === orgSession();
  async function thumbnail(id: string): Promise<string | undefined> {
    return current() ? sharedSessionThumb(source, host, id, person?.kind === 'member' ? person.user.sub : 'none', current) : undefined;
  }
  async function paint(tile: HTMLElement): Promise<void> {
    const projectId = tile.dataset.openTeamProject;
    if (projectId) {
      const got = await readSourceSessions(source, projectId);
      if (!got.ok || !current() || !tile.isConnected) return;
      const mosaic = document.createElement('span'); mosaic.className = 'folder-mosaic';
      for (const session of got.items.slice(0, 4)) {
        const thumb = await thumbnail(session.id);
        if (!current() || !tile.isConnected) return;
        const cell = document.createElement(thumb ? 'img' : 'span'); cell.className = 'folder-cell';
        if (cell instanceof HTMLImageElement && thumb) { cell.src = thumb; cell.alt = ''; }
        mosaic.append(cell);
      }
      if (mosaic.childElementCount) {
        tile.querySelector('.folder-cover-glyph')?.replaceWith(mosaic);
        const badge = document.createElement('span'); badge.className = 'team-folder-mark'; badge.innerHTML = icon('folderUsers'); badge.append(document.createTextNode(tRaw('Shared')));
        tile.querySelector('.folder-cover')?.append(badge);
      }
    } else {
      const id = tile.dataset.openTeamSession;
      if (!id) return;
      const thumb = await thumbnail(id);
      if (!thumb || !current() || !tile.isConnected) return;
      const image = document.createElement('img'); image.src = thumb; image.alt = ''; image.className = 'tile-cover';
      tile.querySelector('.tile-cover')?.replaceWith(image);
    }
  }
  function next(): void {
    if (!current()) { queue.length = 0; observer?.disconnect(); return; }
    while (active < 2 && queue.length) {
      const tile = queue.shift()!; ++active;
      void paint(tile).catch(() => { /* Keep the standard cover when a preview cannot render. */ }).finally(() => { --active; next(); });
    }
  }
  const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { observer?.unobserve(entry.target); queue.push(entry.target as HTMLElement); }
    next();
  }, { rootMargin: '160px' });
  for (const tile of container.querySelectorAll<HTMLElement>('[data-open-team-project], [data-open-team-session]')) {
    if (observer) observer.observe(tile); else queue.push(tile);
  }
  if (!observer) next();
  return () => { stopped = true; queue.length = 0; observer?.disconnect(); };
}
