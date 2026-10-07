// SPDX-License-Identifier: MPL-2.0
/**
 * Browse presence v1 (plan 299 M0, section 6): what one person in a shared
 * project tells the others while they look around its folders.
 *
 * Each viewer lays a folder out differently (grid, card or list, window width,
 * sort and filter), so a screen coordinate means nothing to anyone else. A
 * pointer is therefore sent relative to an item: a fraction inside its tile,
 * a gap between two items, or a named area. A receiver draws it only when that
 * item is in its own layout.
 *
 * Presence is ephemeral. It is never stored, never sent to telemetry and never
 * used to work out who viewed what.
 */

export const BROWSE_PRESENCE_VERSION = 1;
export const BROWSE_SELECTION_LIMIT = 50;
export const BROWSE_DRAG_LIMIT = 50;
export const BROWSE_ACTIVITY_MAX = 120;

export type BrowseItemKind = 'session' | 'file' | 'folder';
export type BrowseArea = 'header' | 'empty' | 'sidebar';

export type BrowsePointer =
  /** A point inside an item's tile, as fractions of its box. */
  | { readonly itemId: string; readonly fx: number; readonly fy: number }
  /** In the gap beside an item; `null` means the end of the list. */
  | { readonly between: string | null; readonly side: 'before' | 'after' }
  | { readonly area: BrowseArea };

export interface BrowseOpen {
  readonly kind: BrowseItemKind;
  readonly id: string;
  readonly mode: 'view' | 'edit';
}

export interface BrowsePresence {
  readonly v: typeof BROWSE_PRESENCE_VERSION;
  readonly projectId: string;
  /** The folder on screen; `null` is the project's top level. */
  readonly folderId: string | null;
  readonly open?: BrowseOpen;
  readonly pointer?: BrowsePointer;
  readonly selection?: readonly string[];
  readonly drag?: { readonly itemIds: readonly string[]; readonly overFolderId?: string };
  /** The person this one is following, by user id. */
  readonly following?: string;
  /** Present when the sender is an agent acting for `sponsorId`. */
  readonly agent?: { readonly sponsorId: string; readonly activity?: string };
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const idOf = (v: unknown): string | undefined => (typeof v === 'string' && ID.test(v) ? v : undefined);
const unit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

function text(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  let out = '';
  for (const ch of v) {
    const code = ch.codePointAt(0)!;
    if (code < 32 || (code >= 127 && code <= 159)) continue;
    if (out.length + ch.length > max) break;
    out += ch;
  }
  out = out.trim();
  return out || undefined;
}

function ids(v: unknown, limit: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const raw of v.slice(0, limit * 2)) {
    const id = idOf(raw);
    if (id && !out.includes(id)) out.push(id);
    if (out.length === limit) break;
  }
  return out;
}

export function readBrowsePointer(v: unknown): BrowsePointer | undefined {
  if (!object(v)) return undefined;
  if ('itemId' in v) {
    const itemId = idOf(v.itemId);
    return itemId && unit(v.fx) && unit(v.fy) ? { itemId, fx: v.fx, fy: v.fy } : undefined;
  }
  if ('between' in v) {
    const between = v.between === null ? null : idOf(v.between);
    if (between === undefined || (v.side !== 'before' && v.side !== 'after')) return undefined;
    return { between, side: v.side };
  }
  if (v.area === 'header' || v.area === 'empty' || v.area === 'sidebar') return { area: v.area };
  return undefined;
}

/** A browse presence with only known, bounded fields, or null when the frame
 *  has no readable project id. An invalid optional field is dropped, never fatal. */
export function readBrowsePresence(v: unknown): BrowsePresence | null {
  if (!object(v)) return null;
  const projectId = idOf(v.projectId);
  if (!projectId) return null;
  const folderId = v.folderId === null || v.folderId === undefined ? null : idOf(v.folderId) ?? null;
  const out: { -readonly [K in keyof BrowsePresence]: BrowsePresence[K] } = { v: BROWSE_PRESENCE_VERSION, projectId, folderId };

  if (object(v.open)) {
    const id = idOf(v.open.id);
    const kind = v.open.kind;
    if (id && (kind === 'session' || kind === 'file' || kind === 'folder')) {
      out.open = { kind, id, mode: v.open.mode === 'edit' ? 'edit' : 'view' };
    }
  }
  const pointer = readBrowsePointer(v.pointer);
  if (pointer) out.pointer = pointer;
  const selection = ids(v.selection, BROWSE_SELECTION_LIMIT);
  if (selection.length) out.selection = selection;
  if (object(v.drag)) {
    const itemIds = ids(v.drag.itemIds, BROWSE_DRAG_LIMIT);
    const over = idOf(v.drag.overFolderId);
    if (itemIds.length) out.drag = { itemIds, ...(over ? { overFolderId: over } : {}) };
  }
  const following = idOf(v.following);
  if (following) out.following = following;
  if (object(v.agent)) {
    const sponsorId = idOf(v.agent.sponsorId);
    const activity = text(v.agent.activity, BROWSE_ACTIVITY_MAX);
    if (sponsorId) out.agent = { sponsorId, ...(activity ? { activity } : {}) };
  }
  return out;
}

/** Whether a receiver can draw `pointer` in its own layout, which shows the
 *  items in `visible`. Areas always resolve; an item or gap needs its item. */
export function pointerVisible(pointer: BrowsePointer, visible: ReadonlySet<string>): boolean {
  if ('area' in pointer) return true;
  if ('itemId' in pointer) return visible.has(pointer.itemId);
  return pointer.between === null || visible.has(pointer.between);
}
