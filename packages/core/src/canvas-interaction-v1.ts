// SPDX-License-Identifier: MPL-2.0
import type { CanvasOp } from './canvas-op-v1.ts';

export const CANVAS_INTERACTION_VERSION = 1;
export const CANVAS_CLAIM_TTL_MS = 10_000;
export const CANVAS_INTERACTION_OBJECT_LIMIT = 200;
/** The most content fields one transform claim may list. */
export const CANVAS_CLAIM_FIELD_LIMIT = 64;
/** Fields every transform claim covers with the geometry: the frame and group a move
 *  re-parents into, and the keyframe track a pose writes ('kf' in Design; 'keyframes'
 *  stays covered for older clients). A tool with another track field lists that field
 *  in `fields`. */
export const CANVAS_TRANSFORM_FIELDS: readonly string[] = ['frame', 'group', 'keyframes', 'kf'];

export interface CanvasClaimTarget {
  readonly kind: 'transform' | 'text';
  readonly collection: string;
  readonly ids: readonly string[];
  /** A box text field, or a whole-value story input shared by several frames. */
  readonly field?: string;
  readonly param?: string;
  /** Transform only, additive: the content fields the gesture also writes, covered like
   *  its geometry (the tool's keyframe track field, the lengths a Scale grows). A reader
   *  on an older version drops it and the claim covers geometry as before. */
  readonly fields?: readonly string[];
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
  /** 'scale' (additive) is a resize whose content scales with the box (Scale mode): a peer
   *  lays the artwork out at its committed size and scales it to the box, where a
   *  'resize' reflows it at the new size. A reader on an older version drops a 'scale'
   *  preview whole. */
  readonly kind: 'move' | 'resize' | 'rotate' | 'scale';
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
const keyList = (v: unknown, limit: number): v is string[] => Array.isArray(v) && v.length > 0 && v.length <= limit
  && v.every(interactionKey) && new Set(v).size === v.length;
export function readClaimTarget(v: unknown): CanvasClaimTarget | null {
  if (!object(v) || !['transform', 'text'].includes(String(v.kind)) || !interactionKey(v.collection)
      || !keyList(v.ids, CANVAS_INTERACTION_OBJECT_LIMIT)) return null;
  if (v.kind === 'text' && (v.param === undefined ? !interactionKey(v.field) : !interactionKey(v.param))) return null;
  if (v.kind === 'transform' && v.fields !== undefined && !keyList(v.fields, CANVAS_CLAIM_FIELD_LIMIT)) return null;
  return { kind: v.kind as CanvasClaimTarget['kind'], collection: v.collection, ids: [...v.ids],
    ...(v.kind === 'text' && interactionKey(v.field) ? { field: v.field } : {}),
    ...(v.kind === 'text' && interactionKey(v.param) ? { param: v.param } : {}),
    ...(v.kind === 'transform' && keyList(v.fields, CANVAS_CLAIM_FIELD_LIMIT) ? { fields: [...v.fields] } : {}) };
}
const transformCovers = (target: CanvasClaimTarget, field: string): boolean =>
  CANVAS_TRANSFORM_FIELDS.includes(field) || !!target.fields?.includes(field);
export function claimsOverlap(a: CanvasClaimTarget, b: CanvasClaimTarget): boolean {
  if (a.kind !== b.kind) {
    // A transform that lists a box's text field holds that field against a text claim on the box.
    const [move, text] = a.kind === 'transform' ? [a, b] : [b, a];
    return !text.param && !!text.field && move.collection === text.collection
      && transformCovers(move, text.field) && move.ids.some(id => text.ids.includes(id));
  }
  if (a.param || b.param) return !!a.param && a.param === b.param;
  return a.collection === b.collection && (a.kind === 'transform' || a.field === b.field)
    && a.ids.some(id => b.ids.includes(id));
}
export function claimCoversOp(target: CanvasClaimTarget, op: CanvasOp): boolean {
  if (op.k === 'param') return target.kind === 'text' && target.param === op.key;
  if (op.col !== target.collection || !target.ids.includes(op.id)) return false;
  return target.kind === 'transform' ? op.k === 'geom' || op.k === 'field' && transformCovers(target, op.field)
    : op.k === 'field' && op.field === target.field;
}
export function readCanvasPreview(v: unknown): CanvasPreview | null {
  if (!object(v) || !interactionKey(v.claimId) || !interactionKey(v.collection)
      || !['move', 'resize', 'rotate', 'scale'].includes(String(v.kind)) || !['active', 'committing'].includes(String(v.phase))
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
