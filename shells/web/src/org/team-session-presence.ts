// SPDX-License-Identifier: MPL-2.0
/** Refresh only session badges; selection, menus and preview images keep their state. */
import { instanceFetch, instancePath } from '../lib/instance.ts';
import { renderCollabBadge, type CollabTilePeer } from '../lib/collab-tile-state.ts';

export function mountTeamSessionPresence(grid: HTMLElement, projectId: string, current: () => boolean): () => void {
  const controller = new AbortController();
  let busy = false, generation = 0, stopped = false;
  const paint = (sessions: Array<{ sessionId: string; peers: CollabTilePeer[] }>) => {
    const bySession = new Map(sessions.map(row => [row.sessionId, row.peers]));
    for (const tile of grid.querySelectorAll<HTMLElement>('.folder-tile[data-kind="team-session"]')) {
      renderCollabBadge(tile, bySession.get(tile.dataset.ref || tile.dataset.slot || '') ?? []);
    }
  };
  const live = () => !stopped && !controller.signal.aborted && current() && grid.isConnected && document.visibilityState === 'visible';
  const refresh = async () => {
    if (busy || !live()) return;
    busy = true;
    const requested = generation;
    const wanted = () => live() && requested === generation;
    try {
      const response = await instanceFetch(instancePath(`/api/v1/projects/${encodeURIComponent(projectId)}/presence`), { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) });
      if (!wanted()) return;
      if (!response.ok) { paint([]); stopped = [401, 403, 404].includes(response.status); return; }
      const data = await response.json() as { sessions?: Array<{ sessionId: string; peers: CollabTilePeer[] }> };
      if (wanted()) paint(Array.isArray(data.sessions) ? data.sessions : []);
    } catch { if (wanted()) paint([]); }
    finally { busy = false; }
  };
  const visibility = () => { ++generation; paint([]); if (document.visibilityState === 'visible') void refresh(); };
  document.addEventListener('visibilitychange', visibility);
  const timer = window.setInterval(() => void refresh(), 10_000);
  void refresh();
  return () => { controller.abort(); document.removeEventListener('visibilitychange', visibility); window.clearInterval(timer); paint([]); };
}
