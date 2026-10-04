// SPDX-License-Identifier: MPL-2.0
import { collabSurface, registerCollabViewport, revealCollabViewport, surfacePresence } from '../lib/collab-surface.ts';
import type { CollabSession } from '../lib/collab-session.ts';
import type { StageNav } from './tool-stage-nav.ts';

/** A single jump reads fresh presence; it never establishes a follow subscription. */
type PeerSession = Pick<CollabSession, 'state'> & { presence: Pick<CollabSession['presence'], 'roster'> };
export function jumpToPeer(runtime: object, session: PeerSession, id: string, comments?: { locate(context?: string): Promise<void> }): void {
  if (session.state().connection !== 'live') return;
  const peer = session.presence.roster().find(peer => peer.id === id && !peer.away);
  if (!peer || peer.id === session.state().self.clientId) return;
  const state = peer.state;
  if (state.surface?.id.startsWith('comments:')) {
    void comments?.locate(state.surface.id.slice('comments:'.length));
    return;
  }
  const surface = collabSurface(runtime);
  if (!surface) return;
  if (surface.revealPeer) { if (!surface.revealPeer(state)) return; }
  else {
    if (state.surface?.id !== surface.id()) return;
    const selected = state.selection?.find(id => surface.object?.(id));
    if (selected) surface.reveal?.(selected);
  }
  void comments?.locate();
  if (state.viewport) revealCollabViewport(runtime, state.viewport);
}

/** Presence stores the native coordinate at the viewport's top-left. */
export function mountPeerViewport(runtime: object, stage: HTMLElement, canvas: HTMLElement, nav: Pick<StageNav, 'zoomTo' | 'actual' | 'viewState' | 'applyView'>): () => void {
  return registerCollabViewport(runtime, view => {
    if (![view.x, view.y, view.zoom].every(Number.isFinite) || view.zoom <= 0 || view.zoom > 1000 || Math.abs(view.x) > 1e7 || Math.abs(view.y) > 1e7) return;
    nav.zoomTo(view.zoom);
    const camera = nav.viewState(), zoom = nav.actual();
    const sr = stage.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
    nav.applyView({ ...camera, x: camera.x + sr.left - cr.left - view.x * zoom, y: camera.y + sr.top - cr.top - view.y * zoom });
  });
}

/** A presenter shares the displayed slide; exiting restores the editing view. */
export function mountPresentationPresence(runtime: object, canvas: HTMLElement, session: Pick<CollabSession, 'updateSurface'>): () => void {
  const reveal = (event: Event): void => {
    const id: unknown = (event as CustomEvent<unknown>).detail, surface = collabSurface(runtime);
    if (typeof id === 'string' && surface?.object?.(id))
      session.updateSurface({ surface: { id, space: 'unit' }, location: id, selection: [id], viewport: undefined, cursor: undefined, chat: undefined });
    else if ((id === undefined || id === null) && surface) session.updateSurface({ ...surfacePresence(surface), cursor: undefined, chat: undefined });
  };
  canvas.addEventListener('collab-present-view', reveal);
  const active = canvas.ownerDocument.querySelector<HTMLElement>('.pr-stage .pr-active[data-frame-id]')?.dataset.frameId;
  if (active) reveal(new canvas.ownerDocument.defaultView!.CustomEvent('collab-present-view', { detail: active }));
  return () => canvas.removeEventListener('collab-present-view', reveal);
}
