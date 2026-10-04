// SPDX-License-Identifier: MPL-2.0
import type { PresenceState } from './collab-presence.ts';

export interface CollabSurface {
  id(): string;
  element(): HTMLElement | null;
  selection(): string[];
  viewport?(): { x: number; y: number; zoom: number };
  readonly collection?: string;
  object?(id: string): { element: HTMLElement | null; x: number; y: number; w: number; h: number; rot: number } | null;
  fromClient?(point: { x: number; y: number }): { x: number; y: number };
  reveal?(id: string): void;
  toClient?(point: { x: number; y: number }): { x: number; y: number };
  subscribe(fn: () => void): () => void;
}
const surfaces = new WeakMap<object, CollabSurface>();
export function registerCollabSurface(runtime: object, surface: CollabSurface): () => void {
  surfaces.set(runtime, surface);
  return () => { if (surfaces.get(runtime) === surface) surfaces.delete(runtime); };
}
export const collabSurface = (runtime: object): CollabSurface | undefined => surfaces.get(runtime);

export function surfacePresence(surface: CollabSurface): Partial<PresenceState> {
  return { ...(surface.viewport ? { viewport: surface.viewport() } : {}), surface: { id: surface.id(), space: 'unit' }, location: surface.id(), selection: surface.selection().slice(0, 200) };
}
