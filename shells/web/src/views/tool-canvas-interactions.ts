// SPDX-License-Identifier: MPL-2.0
import { registerCanvasInteractions, type CanvasInteractionLease } from '../lib/canvas-interaction.ts';
import { collabSurface } from '../lib/collab-surface.ts';
import type { CollabSession, CollabSessionHandle } from '../lib/collab-session.ts';
import type { CanvasClaim, CanvasPreview } from '@lolly-tools/core/canvas-interaction-v1';
import { clonePreviewContent, sizePreviewContent } from './collab-preview-content.ts';

interface OwnedInteraction {
  claim: CanvasClaim; lost: () => void; generation: number; renew: ReturnType<typeof setInterval>;
  fallback?: ReturnType<typeof setTimeout>; committing: boolean; sawPending: boolean; preview?: CanvasPreview;
}

/** Ghosts and labels live outside artwork. Neither received previews nor claims mutate the model. */
export function mountCanvasInteractions(runtime: object, handle: CollabSessionHandle, session: CollabSession, layer: HTMLElement) {
  const capability = handle.claims;
  if (!capability?.available()) return null;
  const root = layer.ownerDocument.createElement('div');
  root.className = 'collab-canvas-interactions'; root.setAttribute('aria-hidden', 'true');
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none'; layer.append(root);
  let disposed = false, pending = 0, previewId: string | undefined;
  const active = new Map<string, OwnedInteraction>();
  const nodes = new Map<string, { node: HTMLElement; source?: string }>();
  function stop(id: string, lost = false): void {
    const entry = active.get(id); if (!entry) return;
    active.delete(id); clearInterval(entry.renew); clearTimeout(entry.fallback);
    if (previewId === id) { previewId = undefined; session.updateSurface({ preview: undefined }); }
    capability!.release(id);
    if (lost) entry.lost();
  }
  const unregister = registerCanvasInteractions(runtime, {
    async acquire(target, lost) {
      const reusable = [...active.values()].find(entry => entry.committing
        && entry.claim.target.kind === target.kind && entry.claim.target.collection === target.collection
        && entry.claim.target.field === target.field && entry.claim.target.param === target.param
        && entry.claim.target.ids.length === target.ids.length && target.ids.every(id => entry.claim.target.ids.includes(id)));
      const claim = reusable?.claim ?? await capability.acquire(target);
      if (disposed || session.state().role === 'observer' || session.state().connection !== 'live') {
        capability.release(claim.id); throw new Error('Work disconnected');
      }
      const entry: OwnedInteraction = reusable ?? { claim, lost, generation: 0, committing: false, sawPending: false,
        renew: setInterval(() => { void capability.renew(claim.id).catch(() => stop(claim.id, true)); }, 3_000) };
      clearTimeout(entry.fallback); entry.fallback = undefined; entry.lost = lost; entry.committing = false; entry.sawPending = false;
      active.set(claim.id, entry);
      const generation = ++entry.generation;
      const lease: CanvasInteractionLease = {
        id: claim.id,
        preview(value) {
          if (active.get(claim.id) !== entry || entry.generation !== generation) return;
          entry.preview = { ...value, claimId: claim.id, collection: target.collection };
          previewId = claim.id; session.updateSurface({ preview: entry.preview });
        },
        finish(committed) {
          if (active.get(claim.id) !== entry || entry.generation !== generation) return;
          if (!committed) { stop(claim.id); return; }
          entry.committing = true; entry.sawPending ||= pending > 0;
          if (entry.preview) { entry.preview = { ...entry.preview, phase: 'committing' }; session.updateSurface({ preview: entry.preview }); }
          // A no-op has no receipt. Changed inputs can finish asynchronous hooks
          // before entering the outbox; keep their lease during that interval.
          entry.fallback ??= setTimeout(() => { if (pending === 0) stop(claim.id); }, 5_000);
          if (entry.sawPending && pending === 0) stop(claim.id);
        },
      };
      return lease;
    },
  });
  const offClaims = capability.subscribe(claims => {
    for (const id of active.keys()) if (!claims.some(claim => claim.id === id)) stop(id, true);
    paint();
  });
  const offSave = handle.saveIn?.subscribe(state => {
    pending = state.pending;
    for (const [id, entry] of active) {
      entry.sawPending ||= pending > 0;
      if (entry.committing && entry.sawPending && pending === 0) stop(id);
    }
  });
  function paint(): void {
    if (disposed) return;
    const surface = collabSurface(runtime), rect = layer.getBoundingClientRect(), used = new Set<string>();
    if (!surface?.object || !surface.toClient) { for (const value of nodes.values()) value.node.remove(); nodes.clear(); return; }
    const claims = capability!.list();
    const readObject = surface.object.bind(surface), toClient = surface.toClient.bind(surface);
    const objects = new Map<string, ReturnType<typeof readObject>>();
    function object(id: string) {
      if (!objects.has(id)) objects.set(id, readObject(id));
      return objects.get(id) ?? null;
    }
    const placements: Array<{ key: string; id: string; name: string; color: string; ghost: boolean;
      geometry: { w: number; h: number; rot: number }; left: number; top: number; width: number; height: number;
      source?: string; clone?: HTMLElement }> = [];
    // Camera metrics and scoped clone styles are read before any mounted write.
    function place(key: string, id: string, geometry: { x: number; y: number; w: number; h: number; rot: number }, name: string, color: string, ghost = false) {
      const artwork = object(id); if (!artwork) return;
      used.add(key);
      const entry = nodes.get(key), source = ghost ? artwork.element?.outerHTML : undefined;
      const clone = source !== undefined && artwork.element && entry?.source !== source ? clonePreviewContent(artwork.element) : undefined;
      const point = toClient({ x: geometry.x, y: geometry.y });
      const extent = toClient({ x: geometry.x + geometry.w, y: geometry.y + geometry.h });
      placements.push({ key, id, geometry, name, color, ghost, source, clone,
        left: point.x - rect.left, top: point.y - rect.top, width: Math.abs(extent.x - point.x), height: Math.abs(extent.y - point.y) });
    }
    for (const peer of session.presence.roster()) {
      const state = peer.state; if (peer.away) continue;
      const color = /^#[0-9a-f]{6}$/i.test(state.color) ? state.color : '#6554c0';
      const preview = state.preview, claim = preview && claims.find(claim => claim.id === preview.claimId);
      if (preview && claim && claim.owner !== capability!.owner?.() && preview.collection === surface.collection) {
        const matches = preview.phase === 'committing' && preview.objects.every(row => {
          const current = object(row.id); return current && (['x', 'y', 'w', 'h', 'rot'] as const).every(key => Math.abs(current[key] - row[key]) < 0.1);
        });
        if (!matches) for (const row of preview.objects) place(`preview:${preview.claimId}:${row.id}`, row.id, row, claim.name, color, true);
      }
      if (state.location !== surface.id()) continue;
      for (const id of state.selection ?? []) {
        const current = object(id); if (current) place(`selection:${peer.id}:${id}`, id, current, state.name, color);
      }
    }
    for (const claim of claims) if (claim.owner !== capability!.owner?.() && claim.target.kind === 'text' && claim.target.collection === surface.collection) {
      for (const id of claim.target.ids) { const current = object(id); if (current) place(`text:${claim.id}:${id}`, id, current, `${claim.name} · editing text`, '#6554c0'); }
    }
    for (const { key, id, geometry, name, color, ghost, source, clone, left, top, width, height } of placements) {
      let entry = nodes.get(key);
      if (!entry) {
        const node = root.ownerDocument.createElement('div');
        node.className = ghost ? 'collab-preview-ghost' : 'collab-selection-outline';
        node.setAttribute('data-collab-object', id);
        node.style.cssText = 'position:absolute;pointer-events:none;box-sizing:border-box;transform-origin:center;transition:inset 50ms linear,width 50ms linear,height 50ms linear,transform 50ms linear';
        if (layer.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) node.style.transition = 'none';
        const label = root.ownerDocument.createElement('span'); label.className = 'collab-object-label';
        label.style.cssText = 'position:absolute;inset-inline-start:0;bottom:100%;font:12px system-ui;padding:2px 4px;white-space:nowrap;color:white';
        node.append(label); root.append(node); entry = { node }; nodes.set(key, entry);
      }
      if (clone) {
        entry.source = source;
        entry.node.querySelector('.collab-preview-content')?.remove();
        entry.node.prepend(clone);
      }
      const content = entry.node.querySelector<HTMLElement>('.collab-preview-content');
      if (content) sizePreviewContent(content, geometry.w, geometry.h, width, height);
      Object.assign(entry.node.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`,
        transform: `rotate(${geometry.rot}deg)`, outline: `2px ${ghost ? 'dashed' : 'solid'} ${color}`, opacity: ghost ? '0.65' : '1' });
      const label = entry.node.querySelector<HTMLElement>('.collab-object-label')!;
      label.textContent = name; label.style.backgroundColor = color;
    }
    for (const [key, entry] of nodes) if (!used.has(key)) { entry.node.remove(); nodes.delete(key); }
  }
  const offSession = session.subscribe(state => {
    if (state.connection !== 'live' || state.role === 'observer') for (const id of active.keys()) stop(id, true);
    paint();
  });
  return {
    geometry(id: string) {
      for (const entry of active.values()) { const row = entry.preview?.objects.find(row => row.id === id); if (row) return row; }
      const surface = collabSurface(runtime), claims = capability!.list();
      for (const peer of session.presence.roster()) {
        const preview = peer.state.preview;
        if (peer.away || !preview || preview.collection !== surface?.collection || !claims.some(claim => claim.id === preview.claimId)) continue;
        const row = preview.objects.find(row => row.id === id); if (row) return row;
      }
      return undefined;
    },
    reanchor: paint,
    teardown() {
      if (disposed) return; disposed = true; unregister();
      for (const id of active.keys()) stop(id, true);
      offClaims(); offSave?.(); offSession(); root.remove(); nodes.clear();
    },
  };
}
