// SPDX-License-Identifier: MPL-2.0
/**
 * Finding a review thread on the canvas: jump to its pin, walk the listed threads, copy a
 * thread link, and open the thread a link or notification asked for. Every surface method
 * used here is optional, so a host that lacks one simply does less.
 */
import type { CommentAnchor, CommentThread } from '@lolly-tools/core/canvas-review-v1';
import type { CanvasCommentsCapability } from '../lib/canvas-comments.ts';
import { collabSurface } from '../lib/collab-surface.ts';
import { REVIEW_TARGET_TTL_MS } from '../lib/review-target.ts';
import { tRaw } from '../i18n.ts';

type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number; rot: number };
const PINS_KEY = 'lolly.comments.pins';
const COORDINATE_LIMIT = 1e6;

/** The document-space point of an object pin, following the object's move, resize and rotation. */
export function objectPoint(anchor: { x: number; y: number }, object: Box): Point {
  const dx = (anchor.x - .5) * object.w, dy = (anchor.y - .5) * object.h, rad = object.rot * Math.PI / 180;
  return { x: object.x + object.w / 2 + dx * Math.cos(rad) - dy * Math.sin(rad), y: object.y + object.h / 2 + dx * Math.sin(rad) + dy * Math.cos(rad) };
}

/** Where an object pin was placed, kept with the anchor so a deleted object's thread still has a place. */
export function savedPoint(anchor: CommentAnchor): Point | undefined {
  if (anchor.kind !== 'object' || !('at' in anchor)) return undefined;
  const at: unknown = anchor.at;
  if (!at || typeof at !== 'object' || !('x' in at) || !('y' in at)) return undefined;
  const { x, y } = at;
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)
    && Math.abs(x) <= COORDINATE_LIMIT && Math.abs(y) <= COORDINATE_LIMIT ? { x, y } : undefined;
}

export type JumpResult = 'object' | 'point' | 'deleted' | 'unavailable';
/**
 * Bring a thread's place into view: its object when the object exists (selected and centred),
 * the saved point when the object was deleted, or the canvas point.
 */
export function jumpToAnchor(runtime: object, anchor: CommentAnchor): JumpResult {
  const surface = collabSurface(runtime);
  if (!surface) return 'unavailable';
  if (anchor.surface !== surface.id()) surface.focusSurface?.(anchor.surface);
  if (anchor.kind === 'object') {
    const object = anchor.collection === surface.collection ? surface.object?.(anchor.objectId) : null;
    if (object) {
      surface.reveal?.(anchor.objectId);
      surface.revealPoint?.(anchor.surface, objectPoint(anchor, object));
      return 'object';
    }
    const at = savedPoint(anchor);
    return at && surface.revealPoint?.(anchor.surface, at) ? 'deleted' : 'unavailable';
  }
  return surface.revealPoint?.(anchor.surface, { x: anchor.x, y: anchor.y }) ? 'point' : 'unavailable';
}

/** The thread after (or before) `selected` in `list`, wrapping at either end. */
export function stepThread(list: readonly CommentThread[], selected: string | undefined, direction: 1 | -1): CommentThread | undefined {
  if (!list.length) return undefined;
  const at = list.findIndex(thread => thread.id === selected);
  if (at < 0) return direction > 0 ? list[0] : list.at(-1);
  return list[(at + direction + list.length) % list.length];
}

/** Hide pins is a per-device choice; storage that is unavailable leaves pins shown. */
export function pinsHidden(win: Window | null): boolean {
  try { return win?.localStorage.getItem(PINS_KEY) === 'hidden'; } catch { return false; }
}
export function rememberPinsHidden(win: Window | null, hidden: boolean): void {
  try { if (hidden) win?.localStorage.setItem(PINS_KEY, 'hidden'); else win?.localStorage.removeItem(PINS_KEY); } catch { /* Device preferences are optional. */ }
}

export async function copyText(doc: Document, text: string): Promise<boolean> {
  const clipboard = doc.defaultView?.navigator.clipboard;
  if (!clipboard?.writeText) return false;
  try { await clipboard.writeText(text); return true; } catch { return false; }
}

export type TargetOutcome = 'opened' | 'missing' | 'off';
/**
 * The thread a link or notification asked for. It is taken after the first successful list;
 * while the live document is not connected it waits, for the same 120 seconds a review target
 * lasts, and `retry` tries again on connection.
 */
export function createTargetOpener(options: {
  capability: Pick<CanvasCommentsCapability, 'pendingTarget' | 'onTarget'>;
  live(): boolean;
  say(text: string): void;
  open(threadId: string): Promise<TargetOutcome>;
}) {
  let target: { id: string; until: number } | undefined, ready = false, running = false, disposed = false, announced = false;
  const hold = (id: string): void => { target = { id, until: Date.now() + REVIEW_TARGET_TTL_MS }; };
  async function run(): Promise<void> {
    if (target && target.until <= Date.now()) {
      target = undefined;
      if (announced) { announced = false; options.say(''); }
    }
    if (disposed || !ready || running || !target) return;
    if (!options.live()) { announced = true; options.say(tRaw('Comments open when the live document connects.')); return; }
    const id = target.id; target = undefined; running = true; announced = false;
    options.say(tRaw('Opening the thread…'));
    try {
      const outcome = await options.open(id);
      if (!disposed && outcome === 'missing') options.say(tRaw('This thread was deleted or is no longer available.'));
    } catch { /* The comments panel reports its own failures. */ }
    finally { running = false; }
    if (target) await run();
  }
  const off = options.capability.onTarget?.(id => { hold(id); void run(); });
  return {
    /** The first successful list takes any waiting target; later lists only retry. */
    ready(): void {
      if (!ready) { ready = true; const id = options.capability.pendingTarget?.(); if (id) hold(id); }
      void run();
    },
    retry(): void { void run(); },
    get waiting(): boolean { return !!target; },
    dispose(): void { disposed = true; off?.(); },
  };
}
