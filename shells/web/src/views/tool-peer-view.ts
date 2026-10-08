// SPDX-License-Identifier: MPL-2.0
/**
 * views/tool-peer-view - a person's view as presence: a peer's viewport applied to this
 * stage, and the slide a presenter shows. Loaded with every tool (views/tool/stage-layout.ts),
 * so following, which only a live document needs, lives in views/tool-follow.ts.
 */
import { collabSurface, registerCollabViewport, surfacePresence } from '../lib/collab-surface.ts';
import type { CollabSession } from '../lib/collab-session.ts';
import type { PresenceState } from '../lib/collab-presence.ts';
import type { StageNav } from './tool-stage-nav.ts';

type ViewNav = Pick<StageNav, 'viewState' | 'applyView'>;
/** The stage camera of each mounted tool, so following can save and restore the person's own view. */
export const navs = new WeakMap<object, ViewNav>();

/** Presence stores the native coordinate at the viewport's top-left. */
export function mountPeerViewport(runtime: object, stage: HTMLElement, canvas: HTMLElement, nav: Pick<StageNav, 'zoomTo' | 'actual' | 'viewState' | 'applyView'>): () => void {
  const off = registerCollabViewport(runtime, view => {
    if (![view.x, view.y, view.zoom].every(Number.isFinite) || view.zoom <= 0 || view.zoom > 1000 || Math.abs(view.x) > 1e7 || Math.abs(view.y) > 1e7) return;
    nav.zoomTo(view.zoom);
    const camera = nav.viewState(), zoom = nav.actual();
    const sr = stage.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
    nav.applyView({ ...camera, x: camera.x + sr.left - cr.left - view.x * zoom, y: camera.y + sr.top - cr.top - view.y * zoom });
  });
  navs.set(runtime, nav);
  return () => { off(); if (navs.get(runtime) === nav) navs.delete(runtime); };
}

/** The presence patch that marks this person as presenting; `undefined` clears the flag. */
type PresentingPatch = Partial<PresenceState> & { presenting?: true };
/** A presenter shares the displayed slide and says they are presenting; exiting restores the editing view. */
export function mountPresentationPresence(runtime: object, canvas: HTMLElement, session: Pick<CollabSession, 'updateSurface'>): () => void {
  const reveal = (event: Event): void => {
    const id: unknown = (event as CustomEvent<unknown>).detail, surface = collabSurface(runtime);
    if (typeof id === 'string' && surface?.object?.(id)) {
      const patch: PresentingPatch = { surface: { id, space: 'unit' }, location: id, selection: [id], viewport: undefined, cursor: undefined, chat: undefined, presenting: true };
      session.updateSurface(patch);
    } else if ((id === undefined || id === null) && surface) {
      const patch: PresentingPatch = { ...surfacePresence(surface), cursor: undefined, chat: undefined, presenting: undefined };
      session.updateSurface(patch);
    }
  };
  canvas.addEventListener('collab-present-view', reveal);
  const active = canvas.ownerDocument.querySelector<HTMLElement>('.pr-stage .pr-active[data-frame-id]')?.dataset.frameId;
  if (active) reveal(new canvas.ownerDocument.defaultView!.CustomEvent('collab-present-view', { detail: active }));
  return () => canvas.removeEventListener('collab-present-view', reveal);
}
