// SPDX-License-Identifier: MPL-2.0
import type { CanvasOp } from './canvas-op-v1.ts';

export const CANVAS_INTERACTION_VERSION = 1;
export const CANVAS_CLAIM_TTL_MS = 10_000;
export const CANVAS_INTERACTION_OBJECT_LIMIT = 200;

export interface CanvasClaimTarget {
  readonly kind: 'transform' | 'text';
  readonly collection: string;
  readonly ids: readonly string[];
  /** A box text field, or a whole-value story input shared by several frames. */
  readonly field?: string;
  readonly param?: string;
}
export interface CanvasClaim {
  readonly id: string;
  readonly owner: string;
  readonly name: string;
  readonly target: CanvasClaimTarget;
  readonly expiresAt: number;
}
export interface CanvasPreview {
  readonly claimId: string;
  readonly kind: 'move' | 'resize' | 'rotate';
  readonly collection: string;
  readonly phase: 'active' | 'committing';
  /** Document coordinates, independent of each participant's camera. */
  readonly objects: readonly { readonly id: string; readonly x: number; readonly y: number;
    readonly w: number; readonly h: number; readonly rot: number }[];
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const unsafe = new Set(['__proto__', 'constructor', 'prototype']);
// biome-ignore lint/suspicious/noControlCharactersInRegex: claim identifiers must reject control characters
const controls = /[\x00-\x1f\x7f-\x9f]/;
export const interactionKey = (v: unknown): v is string => typeof v === 'string' && v.length > 0
  && v.length <= 256 && !unsafe.has(v) && !controls.test(v);
export function readClaimTarget(v: unknown): CanvasClaimTarget | null {
  if (!object(v) || !['transform', 'text'].includes(String(v.kind)) || !interactionKey(v.collection)
      || !Array.isArray(v.ids) || !v.ids.length || v.ids.length > CANVAS_INTERACTION_OBJECT_LIMIT
      || !v.ids.every(interactionKey) || new Set(v.ids).size !== v.ids.length) return null;
  if (v.kind === 'text' && (v.param === undefined ? !interactionKey(v.field) : !interactionKey(v.param))) return null;
  return { kind: v.kind as CanvasClaimTarget['kind'], collection: v.collection, ids: [...v.ids],
    ...(v.kind === 'text' && interactionKey(v.field) ? { field: v.field } : {}),
    ...(v.kind === 'text' && interactionKey(v.param) ? { param: v.param } : {}) };
}
export function claimsOverlap(a: CanvasClaimTarget, b: CanvasClaimTarget): boolean {
  if (a.kind !== b.kind) return false;
  if (a.param || b.param) return !!a.param && a.param === b.param;
  return a.collection === b.collection && (a.kind === 'transform' || a.field === b.field)
    && a.ids.some(id => b.ids.includes(id));
}
export function claimCoversOp(target: CanvasClaimTarget, op: CanvasOp): boolean {
  if (op.k === 'param') return target.kind === 'text' && target.param === op.key;
  if (op.col !== target.collection || !target.ids.includes(op.id)) return false;
  return target.kind === 'transform' ? op.k === 'geom' || op.k === 'field' && ['frame', 'group', 'keyframes'].includes(op.field)
    : op.k === 'field' && op.field === target.field;
}
export function readCanvasPreview(v: unknown): CanvasPreview | null {
  if (!object(v) || !interactionKey(v.claimId) || !interactionKey(v.collection)
      || !['move', 'resize', 'rotate'].includes(String(v.kind)) || !['active', 'committing'].includes(String(v.phase))
      || !Array.isArray(v.objects) || !v.objects.length || v.objects.length > CANVAS_INTERACTION_OBJECT_LIMIT) return null;
  const objects: CanvasPreview['objects'][number][] = [];
  for (const row of v.objects) {
    if (!object(row) || !interactionKey(row.id)) return null;
    for (const key of ['x', 'y', 'w', 'h', 'rot']) {
      if (typeof row[key] !== 'number' || !Number.isFinite(row[key]) || Math.abs(row[key] as number) > 1e6) return null;
    }
    if ((row.w as number) <= 0 || (row.h as number) <= 0) return null;
    objects.push({ id: row.id, x: row.x as number, y: row.y as number, w: row.w as number, h: row.h as number, rot: row.rot as number });
  }
  if (new Set(objects.map(row => row.id)).size !== objects.length) return null;
  return { claimId: v.claimId, collection: v.collection, kind: v.kind as CanvasPreview['kind'],
    phase: v.phase as CanvasPreview['phase'], objects };
}
