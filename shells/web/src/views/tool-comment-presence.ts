// SPDX-License-Identifier: MPL-2.0
import { createCollabCursors } from '../components/collab-overlay.ts';
import { collabDisplayName } from '../components/collab-pill.ts';
import type { CollabSession, CollabSessionState } from '../lib/collab-session.ts';
import { tRaw } from '../i18n.ts';

/** Discussion pointers and typing use ephemeral presence, never reply text or artwork. */
export type CommentPresenceSession = Pick<CollabSession, 'state' | 'subscribe' | 'updateSurface' | 'setFocus'> & {
  presence: Pick<CollabSession['presence'], 'roster'>;
};
export function mountCommentPresence(panel: HTMLElement, session: CommentPresenceSession, context: () => string) {
  const doc = panel.ownerDocument, abort = new (doc.defaultView?.AbortController ?? AbortController)();
  const layer = doc.createElement('div'); layer.className = 'collab-canvas-layer collab-comment-presence-layer';
  const typing = doc.createElement('p'); typing.className = 'collab-comment-typing'; typing.setAttribute('role', 'status');
  panel.append(typing, layer);
  const surfaceId = () => `comments:${context()}`;
  let engaged = false, disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
  const cursors = createCollabCursors({ stage: panel, layer, mapPoint: (id, point) => {
    const peer = session.presence.roster().find(p => p.id === id);
    if (panel.hidden || peer?.state.surface?.id !== surfaceId()) return null;
    const rect = panel.getBoundingClientRect();
    return { x: rect.left + point.x * rect.width, y: rect.top + point.y * rect.height };
  } });
  function paint(state: CollabSessionState): void {
    const peers = session.presence.roster(), current = surfaceId();
    cursors.setPeers(panel.hidden || state.connection === 'closed' ? [] : state.peers.map(p => ({
      id: p.clientId, name: collabDisplayName(p), color: p.color, away: p.away,
      cursor: peers.find(peer => peer.id === p.clientId && peer.state.surface?.id === current)?.state.cursor ?? null,
    })));
    const names = panel.hidden || state.connection === 'closed' ? [] : state.peers.filter(p => !p.away && peers.some(peer => peer.id === p.clientId && peer.state.surface?.id === current && peer.state.chat === 'typing')).map(collabDisplayName);
    const text = names.length ? tRaw('{names} typing…', { names: names.join(', ') }) : '';
    if (typing.textContent !== text) typing.textContent = text;
  }
  function clear(): void {
    if (timer) clearTimeout(timer); timer = undefined;
    if (engaged) { session.updateSurface({ cursor: undefined, chat: undefined }); session.setFocus(null); }
    engaged = false; paint(session.state());
  }
  panel.addEventListener('pointermove', event => {
    if (panel.hidden || disposed) return;
    const rect = panel.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    engaged = true;
    session.updateSurface({ surface: { id: surfaceId(), space: 'unit' }, location: tRaw('Comments'), selection: [],
      cursor: { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) } });
  }, { signal: abort.signal });
  panel.addEventListener('pointerleave', () => { if (engaged) session.updateSurface({ cursor: undefined }); }, { signal: abort.signal });
  panel.addEventListener('input', event => {
    if (!(event.target instanceof doc.defaultView!.HTMLTextAreaElement) || panel.hidden || disposed) return;
    engaged = true; session.setFocus(surfaceId());
    session.updateSurface({ surface: { id: surfaceId(), space: 'unit' }, location: tRaw('Comments'), selection: [], chat: 'typing' });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; session.updateSurface({ chat: undefined }); }, 3_000);
  }, { signal: abort.signal });
  panel.addEventListener('focusout', () => { if (!panel.contains(doc.activeElement)) clear(); }, { signal: abort.signal });
  panel.addEventListener('submit', () => {
    if (timer) clearTimeout(timer); timer = undefined;
    if (engaged) session.updateSurface({ chat: undefined });
  }, { signal: abort.signal });
  const observer = new doc.defaultView!.MutationObserver(() => { if (panel.hidden) clear(); else paint(session.state()); });
  observer.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  const off = session.subscribe(paint); paint(session.state());
  return { refresh() { paint(session.state()); cursors.reanchor(); }, dispose() {
    if (disposed) return; disposed = true; clear(); off(); observer.disconnect(); abort.abort(); cursors.dispose(); typing.remove(); layer.remove();
  } };
}
