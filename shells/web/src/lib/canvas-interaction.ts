// SPDX-License-Identifier: MPL-2.0
import type { CanvasClaim, CanvasClaimTarget, CanvasPreview } from '@lolly-tools/core/canvas-interaction-v1';

export interface CanvasClaimCapability {
  available(): boolean;
  owner?(): string | undefined;
  list(): readonly CanvasClaim[];
  acquire(target: CanvasClaimTarget): Promise<CanvasClaim>;
  renew(id: string): Promise<CanvasClaim>;
  release(id: string): void;
  subscribe(fn: (claims: readonly CanvasClaim[]) => void): () => void;
}
export interface CanvasInteractionLease {
  readonly id: string;
  preview(value: Omit<CanvasPreview, 'claimId' | 'collection'>): void;
  finish(committed: boolean): void;
}
export interface CanvasInteractionPort {
  acquire(target: CanvasClaimTarget, lost: () => void): Promise<CanvasInteractionLease>;
}
const ports = new WeakMap<object, CanvasInteractionPort>();
export const canvasInteractions = (runtime: object): CanvasInteractionPort | undefined => ports.get(runtime);
export function registerCanvasInteractions(runtime: object, port: CanvasInteractionPort): () => void {
  ports.set(runtime, port);
  return () => { if (ports.get(runtime) === port) ports.delete(runtime); };
}
