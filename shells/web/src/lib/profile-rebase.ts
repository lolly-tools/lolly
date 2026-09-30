// SPDX-License-Identifier: MPL-2.0
/**
 * Apply one profile write onto the stored record when another writer changed
 * the record after this writer read it (plan 277 review R3, B4).
 *
 * The profile is one record, and every view writes the whole of it: it reads the
 * record, changes a field, and writes the record back. A tab that read the
 * record before another tab changed it used to write its old copy back whole,
 * which silently undid the other tab's change: a Trash entry vanished (and was
 * rebuilt without its folder, label override or font roles), a folder move
 * reverted, a favourite disappeared.
 *
 * The bridge (bridge/profile.ts) keeps a copy of the record each writer started
 * from (the base). When the stored record has moved on since the base, the write
 * goes through `rebaseProfileWrite`, which compares three copies of each field:
 *
 *   - the writer left the field as it was in the base: the stored value stays,
 *     so the other writer's change is kept;
 *   - only the writer changed it: the writer's value is written;
 *   - both changed it: the lists and maps below combine the two changes, entry
 *     by entry. Any other field takes the writer's value, as every write did
 *     before this.
 *
 * Lists are compared entry by entry against the base, so an entry the other
 * writer removed on purpose (a Trash item restored or deleted forever, a folder
 * deleted) stays removed even when the stale writer still holds that entry. A
 * removal always wins over an edit of the same entry. An entry that cannot be
 * told apart by its key (an unknown Trash kind from another build, a missing
 * delete time, an id that repeats) is matched by its whole value, so one odd
 * entry never makes the whole list fall back to the writer's copy.
 *
 * After the fields are combined, each folder item is left in one folder only,
 * and an item either side moved to the Trash since the base is filed where that
 * side left it (in no folder), so a restore puts it back where it was.
 *
 * Pure: no argument is mutated, no clock is read. The result may share values
 * with `current` and `next`.
 */

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

/** A field of `o` only when `o` holds it itself, never one it inherits
 *  (`toString`, `constructor`), so a map key with such a name compares right. */
const own = (o: Rec, key: string): unknown => (Object.hasOwn(o, key) ? o[key] : undefined);

/** Set a field as the object's own, including a key named `__proto__` that an
 *  imported record can carry, which plain assignment would treat as the prototype. */
function setOwn(o: Rec, key: string, value: unknown): void {
  if (key === '__proto__') Object.defineProperty(o, key, { value, enumerable: true, writable: true, configurable: true });
  else o[key] = value;
}

const listOf = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);

/**
 * Deep equality for the JSON-shaped values a profile holds. Key order does not
 * matter, an undefined field counts as absent, NaN equals NaN and two dates with
 * the same time are equal. Any other object is equal only to itself.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b);
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameValue(a[i], b[i])) return false;
    return true;
  }
  if (isRec(a) && isRec(b)) {
    const keys = Object.keys(a).filter(k => a[k] !== undefined);
    if (keys.length !== Object.keys(b).filter(k => b[k] !== undefined).length) return false;
    for (const k of keys) if (!sameValue(a[k], own(b, k))) return false;
    return true;
  }
  return false;
}

/** Lists of plain ids (tool ids, asset ids, Projects refs), combined as sets.
 *  Keep in step with UNION_LISTS and the hidden lists in profile-merge.ts
 *  (profile-rebase.test.ts checks this). */
export const ID_LIST_FIELDS: readonly string[] = [
  'favourites', 'favouriteAssets', 'favouriteProjects', 'hiddenTools', 'hiddenTemplates', 'hiddenAssets',
  'trustedSites',
];

/** Lists of records that carry an `id`. When both sides changed one record, the
 *  writer's copy of it is kept. Keep in step with RECORD_LISTS in profile-merge.ts. */
export const RECORD_LIST_FIELDS: readonly string[] = ['userTemplates', 'projectTemplates', 'userTools'];

/** Maps whose entries are separate settings (a flag, a per-asset override), combined entry by entry. */
export const MAP_FIELDS: readonly string[] = [
  'featureFlags', 'custom', 'assetCategories', 'audioCovers', 'templateStart', 'a11y', 'appearance', 'nearby',
];

type KeyOf = (v: unknown) => string | null;
type Conflict = (base: unknown, current: unknown, next: unknown) => unknown;

const byValue: KeyOf = v => (typeof v === 'string' ? v : null);
const byId: KeyOf = v => (isRec(v) && typeof v.id === 'string' ? v.id : null);
const byRef: KeyOf = v => (isRec(v) && typeof v.ref === 'string' ? v.ref : null);

/** One Trash event: its kind, the key the Trash drops it by (folders.ts
 *  trashEntryKey) and its delete time, the identity lib/trash.ts uses. */
const byTrashEvent: KeyOf = v => {
  if (!isRec(v) || typeof v.kind !== 'string' || typeof v.deletedAt !== 'string') return null;
  const face = Array.isArray(v.assetIds) ? v.assetIds[0] : undefined;
  const key = v.kind === 'session' ? v.slot : v.kind === 'folder' ? v.rootId : v.kind === 'asset' ? v.id
    : v.kind === 'font' ? `font:${typeof face === 'string' ? face : String(v.family)}` : undefined;
  return typeof key === 'string' ? `${v.kind}|${key}|${v.deletedAt}` : null;
};

const takeWriter: Conflict = (_base, _current, next) => next;

/** One value, three ways: the stored value when the writer left it alone, the
 *  writer's when only the writer changed it, `conflict` when both did. */
function pick(base: unknown, current: unknown, next: unknown, conflict: Conflict): unknown {
  if (sameValue(next, base)) return current;
  if (sameValue(current, base) || sameValue(current, next)) return next;
  return conflict(base, current, next);
}

/** A record, field by field. A field set to undefined is left out. */
function mergeRecord(base: unknown, current: unknown, next: unknown, conflict: (key: string) => Conflict): unknown {
  if (!isRec(current) || !isRec(next)) return next;
  const b: Rec = isRec(base) ? base : {};
  const out: Rec = {};
  for (const key of new Set([...Object.keys(current), ...Object.keys(next)])) {
    const value = pick(own(b, key), own(current, key), own(next, key), conflict(key));
    if (value !== undefined) setOwn(out, key, value);
  }
  return out;
}

/** The whole value as text, for an entry with no key of its own. */
function wholeValue(v: unknown): string {
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
}

/** Each entry with a key that is unique in its list: its own key when it has
 *  one, else its whole value; a key that repeats is numbered by occurrence. */
function keyed(list: readonly unknown[], keyOf: KeyOf): Map<string, unknown> {
  const seen = new Map<string, number>();
  const out = new Map<string, unknown>();
  for (const item of list) {
    const own_ = keyOf(item);
    const key = own_ === null ? `v:${wholeValue(item)}` : `k:${own_}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    out.set(n ? `${key}#${n}` : key, item);
  }
  return out;
}

/**
 * A list both sides changed, entry by entry. The stored order is kept; an entry
 * the writer added goes after the entry it follows in the writer's list (first
 * when it follows none). An entry the writer removed is dropped; an entry the
 * other writer removed stays removed.
 */
function mergeList(base: unknown, current: unknown, next: unknown, keyOf: KeyOf, conflict: Conflict): unknown {
  if (!Array.isArray(current) || !Array.isArray(next)) return next;
  const b = keyed(listOf(base), keyOf);
  const c = keyed(current, keyOf);
  const n = keyed(next, keyOf);
  const out: unknown[] = [];
  const keys: string[] = [];
  for (const [key, item] of c) {
    if (n.has(key)) {
      out.push(pick(b.get(key), item, n.get(key), conflict));
      keys.push(key);
    } else if (!b.has(key)) {
      // Added by the other writer since the base.
      out.push(item);
      keys.push(key);
    }
  }
  let after = -1;
  for (const [key, item] of n) {
    const at = keys.indexOf(key);
    if (at >= 0) { after = at; continue; }
    if (b.has(key)) continue;
    out.splice(after + 1, 0, item);
    keys.splice(after + 1, 0, key);
    after++;
  }
  return out;
}

/** A folder record both sides changed: field by field, its items by ref (a ref
 *  belongs to one folder, folders.ts). */
const mergeFolder: Conflict = (base, current, next) =>
  mergeRecord(base, current, next, key => (key === 'items' ? (b, c, n) => mergeList(b, c, n, byRef, takeWriter) : takeWriter));

/** How a top-level field that both sides changed is combined. */
function fieldConflict(key: string): Conflict {
  if (key === 'trash') return (b, c, n) => mergeList(b, c, n, byTrashEvent, takeWriter);
  if (key === 'folders') return (b, c, n) => mergeList(b, c, n, byId, mergeFolder);
  if (ID_LIST_FIELDS.includes(key)) return (b, c, n) => mergeList(b, c, n, byValue, takeWriter);
  if (RECORD_LIST_FIELDS.includes(key)) return (b, c, n) => mergeList(b, c, n, byId, takeWriter);
  if (MAP_FIELDS.includes(key)) return (b, c, n) => mergeRecord(b, c, n, () => takeWriter);
  return takeWriter;
}

/** Which folder holds each ref (the first, should a ref be filed twice). */
function placements(folders: unknown): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of listOf(folders)) {
    if (!isRec(f) || typeof f.id !== 'string') continue;
    for (const item of listOf(f.items)) {
      const ref = byRef(item);
      if (ref !== null && !out.has(ref)) out.set(ref, f.id);
    }
  }
  return out;
}

/** The refs one side moved to the Trash since the base: a session's original
 *  slot, a folder's member slots, an upload's id. */
function trashedSince(base: unknown, side: unknown): Set<string> {
  const before = new Set(listOf(base).map(byTrashEvent));
  const out = new Set<string>();
  for (const e of listOf(side)) {
    const id = byTrashEvent(e);
    if (id === null || before.has(id) || !isRec(e)) continue;
    if (e.kind === 'session' && typeof e.originalSlot === 'string') out.add(e.originalSlot);
    else if (e.kind === 'asset' && typeof e.id === 'string') out.add(e.id);
    else if (e.kind === 'folder') {
      for (const m of listOf(e.sessions)) if (isRec(m) && typeof m.originalSlot === 'string') out.add(m.originalSlot);
    }
  }
  return out;
}

/**
 * Leave each folder item in one folder only, and file an item that either side
 * moved to the Trash since the base where that side left the item. Otherwise
 * the writer's placement wins when the writer moved the item, and the stored
 * placement when it did not.
 */
function settleFolders(base: Rec, current: Rec, next: Rec, out: Rec): void {
  const folders = own(out, 'folders');
  if (!Array.isArray(folders)) return;
  const inBase = placements(own(base, 'folders'));
  const inCurrent = placements(own(current, 'folders'));
  const inNext = placements(own(next, 'folders'));
  const byWriter = trashedSince(own(base, 'trash'), own(next, 'trash'));
  const byOther = trashedSince(own(base, 'trash'), own(current, 'trash'));
  const wanted = (ref: string): string | null => {
    if (byWriter.has(ref)) return inNext.get(ref) ?? null;
    if (byOther.has(ref)) return inCurrent.get(ref) ?? null;
    const moved = (inNext.get(ref) ?? null) !== (inBase.get(ref) ?? null);
    return (moved ? inNext.get(ref) : inCurrent.get(ref)) ?? null;
  };
  const holders = new Map<string, string[]>();
  for (const f of folders) {
    if (!isRec(f) || typeof f.id !== 'string') continue;
    for (const item of listOf(f.items)) {
      const ref = byRef(item);
      if (ref !== null) holders.set(ref, [...(holders.get(ref) ?? []), f.id]);
    }
  }
  const drop = new Map<string, Set<string>>();
  for (const [ref, ids] of holders) {
    const trashed = byWriter.has(ref) || byOther.has(ref);
    if (ids.length < 2 && !trashed) continue;
    const target = wanted(ref);
    const stored = inCurrent.get(ref);
    const keep = target !== null && ids.includes(target) ? target
      : trashed ? null
        : stored !== undefined && ids.includes(stored) ? stored : ids[0];
    for (const id of ids) if (id !== keep) drop.set(id, (drop.get(id) ?? new Set<string>()).add(ref));
  }
  if (!drop.size) return;
  out.folders = folders.map(f => {
    const refs = isRec(f) && typeof f.id === 'string' ? drop.get(f.id) : undefined;
    if (!refs || !isRec(f)) return f;
    return { ...f, items: listOf(f.items).filter(item => { const ref = byRef(item); return ref === null || !refs.has(ref); }) };
  });
}

/**
 * The record to store for a write of `next`, which was made from `base`, when the
 * stored record is now `current`. Every change the writer made since `base` is
 * applied; every change another writer made since `base` and this writer did not
 * touch is kept. See the header for how a field both changed is combined.
 */
export function rebaseProfileWrite<T extends object>(base: T, current: T, next: T): T {
  const merged = mergeRecord(base, current, next, fieldConflict);
  if (!isRec(merged) || !isRec(base) || !isRec(current) || !isRec(next)) return next;
  settleFolders(base, current, next, merged);
  return merged as T;
}
