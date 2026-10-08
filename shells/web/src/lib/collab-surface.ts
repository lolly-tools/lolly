// SPDX-License-Identifier: MPL-2.0
import type { PresenceState } from './collab-presence.ts';

export interface CollabSurface {
  id(): string;
  element(): HTMLElement | null;
  selection(): string[];
  viewport?(): { x: number; y: number; zoom: number };
  readonly collection?: string;
  object?(id: string): { element: HTMLElement | null; x: number; y: number; w: number; h: number; rot: number } | null;
  /** One model/DOM projection and camera snapshot for a complete overlay paint. */
  snapshot?(): Pick<CollabSurface, 'object' | 'toClient'>;
  fromClient?(point: { x: number; y: number }): { x: number; y: number };
  reveal?(id: string): void;
  /** Bring the surface `id` (an artboard, slide or page) into view; false when this host has no such surface. */
  focusSurface?(id: string): boolean;
  /** Centre a document-space point of surface `surfaceId`, instantly under reduced motion; false when it cannot. */
  revealPoint?(surfaceId: string, point: { x: number; y: number }): boolean;
  revealPeer?(state: PresenceState): boolean;
  toClient?(point: { x: number; y: number }): { x: number; y: number };
  subscribe(fn: () => void): () => void;
}
const surfaces = new WeakMap<object, CollabSurface>();
export function registerCollabSurface(runtime: object, surface: CollabSurface): () => void {
  surfaces.set(runtime, surface);
  return () => { if (surfaces.get(runtime) === surface) surfaces.delete(runtime); };
}
export const collabSurface = (runtime: object): CollabSurface | undefined => surfaces.get(runtime);

type PeerViewport = NonNullable<PresenceState['viewport']>;
const viewports = new WeakMap<object, (view: PeerViewport) => void>();
export function registerCollabViewport(runtime: object, reveal: (view: PeerViewport) => void): () => void {
  viewports.set(runtime, reveal);
  return () => { if (viewports.get(runtime) === reveal) viewports.delete(runtime); };
}
export function revealCollabViewport(runtime: object, view: PeerViewport): void { viewports.get(runtime)?.(view); }

export function surfacePresence(surface: CollabSurface): Partial<PresenceState> {
  return { ...(surface.viewport ? { viewport: surface.viewport() } : {}), surface: { id: surface.id(), space: 'unit' }, location: surface.id(), selection: surface.selection().slice(0, 200) };
}
