// SPDX-License-Identifier: MPL-2.0
import type { AgentChange, AgentChangeTarget } from '@lolly-tools/core/agent-presence-v1';
import type { CollabSessionState } from '../lib/collab-session.ts';
import type { AgentRoster } from '../lib/agent-collaborators.ts';
import { surfaceMapping } from '../lib/collab-surface-geometry.ts';
import { mountOverlayLayer, observeAnchorTransforms, type OverlayLayer } from './collab-overlay.ts';
import { tRaw } from '../i18n.ts';
import { announce } from '../a11y.ts';
import { collabLabelColor } from '../lib/collab-label-color.ts';

export const AGENT_CHANGE_MS = 4000;
const STYLE_ID = 'agent-change-styles';
const CSS = `
.agent-change { position:absolute; box-sizing:border-box; pointer-events:none; border:2px solid var(--collab-color); box-shadow:0 0 0 1px hsl(var(--card)),inset 0 0 0 1px hsl(var(--card)); }
.agent-change[data-kind="removed"] { border-style:dashed; }
.agent-change-label { position:absolute; inset-block-end:100%; inset-inline-start:-2px; padding:calc(2px * var(--a11y-fs)) calc(6px * var(--a11y-fs)); max-width:32ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; background:var(--collab-color); color:var(--collab-ink); border-radius:999px; font-size:calc(11px * var(--a11y-fs)); line-height:1.5; box-shadow:0 0 0 1px hsl(var(--card)); }
`;

interface Decoration { change: AgentChange; target: AgentChangeTarget; node: HTMLElement }
export interface AgentChanges { reanchor(): void; dispose(): void }

/** Temporary change outlines are chrome, outside the document and its exports. */
export function mountAgentChanges(stage: HTMLElement, canvas: HTMLElement, source: AgentRoster, sharedLayer?: OverlayLayer | null): AgentChanges {
  const doc = stage.ownerDocument;
  if (!doc.getElementById(STYLE_ID)) { const style = doc.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; doc.head.appendChild(style); }
  const layer = sharedLayer === undefined ? mountOverlayLayer(canvas, stage) : sharedLayer;
  const seen = new Map<string, string>();
  const decorations = new Map<string, Decoration[]>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let disposed = false;
  const clear = (id: string): void => { clearTimeout(timers.get(id)); timers.delete(id); for (const entry of decorations.get(id) ?? []) entry.node.remove(); decorations.delete(id); };
  const reanchor = (): void => {
    if (!layer || disposed) return;
    const mapping = surfaceMapping(canvas), origin = layer.el.getBoundingClientRect();
    for (const entries of decorations.values()) for (const { node, target, change } of entries) {
      node.hidden = !mapping;
      if (!mapping) continue;
      const corners = [[target.x, target.y], [target.x + target.w, target.y], [target.x, target.y + target.h], [target.x + target.w, target.y + target.h]].map(([x, y]) => mapping.toClient({ x: x! / change.width, y: y! / change.height }));
      const left = Math.min(...corners.map(point => point.x)), top = Math.min(...corners.map(point => point.y));
      node.style.transform = `translate(${left - origin.left}px, ${top - origin.top}px)`;
      node.style.width = `${Math.max(2, Math.max(...corners.map(point => point.x)) - left)}px`;
      node.style.height = `${Math.max(2, Math.max(...corners.map(point => point.y)) - top)}px`;
    }
  };
  const paint = (state: CollabSessionState): void => {
    const present = new Set(state.peers.filter(peer => peer.kind === 'agent' && !peer.away).map(peer => peer.clientId));
    for (const id of seen.keys()) if (!present.has(id)) { clear(id); seen.delete(id); }
    for (const peer of state.peers) {
      const change = peer.agentChange;
      if (peer.kind !== 'agent' || peer.away || !change || seen.get(peer.clientId) === change.id) continue;
      seen.set(peer.clientId, change.id); clear(peer.clientId);
      if (!layer) continue;
      const entries = change.targets.map(target => {
        const node = doc.createElement('div'); node.className = 'agent-change'; node.dataset.kind = target.kind; node.dataset.layerId = target.id; node.dataset.agentId = peer.clientId;
        const color = collabLabelColor(peer.color);
        node.style.setProperty('--collab-color', color.fill); node.style.setProperty('--collab-ink', color.ink);
        const label = doc.createElement('span'); label.className = 'agent-change-label'; label.textContent = tRaw('{name}: {note}', { name: peer.name, note: change.label });
        node.appendChild(label); layer.el.appendChild(node); return { change, target, node };
      });
      decorations.set(peer.clientId, entries);
      timers.set(peer.clientId, setTimeout(() => clear(peer.clientId), AGENT_CHANGE_MS));
      if (entries.length) announce(tRaw('{name}: {note}', { name: peer.name, note: change.label }));
    }
    reanchor();
  };
  paint(source.state());
  const off = source.subscribe(paint);
  const unobserve = observeAnchorTransforms(canvas, stage, reanchor);
  doc.addEventListener('scroll', reanchor, true); doc.defaultView?.addEventListener('resize', reanchor);
  return {
    reanchor,
    dispose() { if (disposed) return; disposed = true; off(); unobserve(); doc.removeEventListener('scroll', reanchor, true); doc.defaultView?.removeEventListener('resize', reanchor); for (const id of [...decorations.keys()]) clear(id); seen.clear(); if (sharedLayer === undefined) layer?.unmount(); },
  };
}
