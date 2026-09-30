// SPDX-License-Identifier: MPL-2.0
/**
 * Merge an incoming profile record into this device's record, for Import data…
 * and Sync's "Bring it to this device" (plans/277 P7, decided 2026-09-27:
 * "favourites and folders should not be replaced, only new ones added; same for
 * templates").
 *
 * Both routes used to replace the whole record, so the folders, favourites and
 * templates made on this device vanished and sessions filed only here fell back to
 * the top level of Projects. Now this device keeps everything it has, and the
 * incoming copy only adds to it:
 *
 *   - folders: every folder here stays, with its contents. An incoming folder whose
 *     id is not here is added. A folder on both sides keeps this device's copy
 *     (name, parent, colour, tags) and gains the incoming members it lacks. A ref
 *     belongs to one folder (folders.ts), so an incoming member already filed
 *     anywhere here stays where it is.
 *   - the favourite lists (tools, catalog assets, Projects refs): union, with this
 *     device's entries first, in their order.
 *   - templates (tool templates and saved studios, Projects templates) and user
 *     tools: an incoming record whose id is not here is added; every record here
 *     stays as it is.
 *   - Trash: union by the key the Trash drops entries by (a session's slot, a
 *     folder's root id, an upload's asset id, a font family's first face), so an
 *     item restorable on either side stays restorable. An incoming entry is
 *     refused when its folder is live here or its trash slot is claimed here.
 *   - every other field (name, contact details, preferences, hidden tools and
 *     templates, feature flags, language and the rest): this device's value stays.
 *     A field that is empty here (absent, null, '', [] or {}) takes the incoming
 *     value whole. A hidden list is read together with the marker that says the
 *     person has edited it, so a list emptied on purpose here stays empty.
 *
 * Pure and idempotent: neither argument is mutated (the web bridge hands out its
 * cached record, which views mutate in place), no clock is read, and merging the
 * same incoming record a second time changes nothing.
 *
 * Device sync's ordinary apply does not come here: keeping devices in step means
 * the synced copy's record wins (data-transfer.ts, `profile: 'replace'`).
 */

import type { Folder, FolderItem, TrashEntry } from '../folders.ts';

type ProfileRecord = Record<string, unknown>;

/** Lists of plain ids merged as a union. */
export const UNION_LISTS = ['favourites', 'favouriteAssets', 'favouriteProjects'] as const;

/** Lists of records with an `id`, merged by adding the incoming ids not here. */
export const RECORD_LISTS = ['userTemplates', 'projectTemplates', 'userTools'] as const;

/** A hidden list and the marker that says the person has edited it (so its
 *  shipped defaults no longer apply). The pair moves together. */
const SEEDED_PAIRS: ReadonlyArray<readonly [list: string, marker: string]> = [
  ['hiddenTools', 'hiddenToolsSeeded'],
  ['hiddenTemplates', 'hiddenTemplatesSeeded'],
  ['hiddenAssets', 'catalogDefaultsSeeded'],
  ['trustedSites', 'trustedSitesSeeded'],
];

const HANDLED = new Set<string>([
  'folders', 'trash', ...UNION_LISTS, ...RECORD_LISTS, ...SEEDED_PAIRS.flat(),
]);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Empty for the "fill only what is empty here" rule. */
export function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (isPlainObject(v)) return Object.keys(v).length === 0;
  return false;
}

const listOf = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** A deep copy of a JSON-shaped value, so the result shares nothing with the
 *  incoming record (a later edit here must never write through into the bundle). */
const copy = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)) as T);

function mergeUnion(here: unknown, incoming: unknown): unknown {
  const mine = listOf<unknown>(here);
  const seen = new Set(mine);
  const added = listOf<unknown>(incoming).filter(x => {
    if (typeof x !== 'string' || seen.has(x)) return false;
    seen.add(x);
    return true;
  });
  if (!added.length) return here;
  return [...mine, ...added];
}

function mergeById(here: unknown, incoming: unknown): unknown {
  const mine = listOf<{ id?: unknown }>(here);
  const ids = new Set(mine.map(r => r?.id));
  const added = listOf<{ id?: unknown }>(incoming).filter(r => {
    if (!isPlainObject(r) || typeof r.id !== 'string' || ids.has(r.id)) return false;
    ids.add(r.id);
    return true;
  });
  if (!added.length) return here;
  return [...mine, ...added.map(copy)];
}

/** The key the Trash drops an entry by (folders.ts trashEntryKey): a session's
 *  trash slot, a folder's root id, an upload's asset id, a font family's first
 *  face id. An entry of a kind this build does not know is compared whole, so it
 *  still travels rather than being dropped. */
const trashKey = (e: unknown): string | null => {
  if (!isPlainObject(e) || typeof e.kind !== 'string') return null;
  const firstFace = Array.isArray(e.assetIds) ? e.assetIds[0] : undefined;
  const key = e.kind === 'session' ? e.slot : e.kind === 'folder' ? e.rootId : e.kind === 'asset' ? e.id
    : e.kind === 'font' ? (firstFace ?? e.family) : undefined;
  return typeof key === 'string' ? `${e.kind}:${key}` : `whole:${JSON.stringify(e)}`;
};

/** The trash slots an entry's records live at: a session's own, a folder's members'. */
function trashSlotsOf(e: unknown): string[] {
  if (!isPlainObject(e)) return [];
  if (e.kind === 'session') return typeof e.slot === 'string' ? [e.slot] : [];
  if (e.kind !== 'folder') return [];
  return listOf<{ slot?: unknown }>(e.sessions).map(m => (isPlainObject(m) ? m.slot : undefined)).filter((x): x is string => typeof x === 'string');
}

/**
 * Union by key, and refuse an incoming entry that would act on something it does
 * not own (plan 277 review B5): a folder entry whose folder is live here (it was
 * restored since that copy was made), and any entry whose trash slot an entry here
 * already claims (trash slots are reused, so purging the incoming entry would
 * delete the newer item). A refused entry's records stay where they are.
 */
function mergeTrash(here: unknown, incoming: unknown, liveFolders: ReadonlySet<string>): unknown {
  const mine = listOf<TrashEntry>(here);
  const keys = new Set(mine.map(trashKey));
  const claimed = new Set(mine.flatMap(trashSlotsOf));
  const added = listOf<TrashEntry>(incoming).filter(e => {
    const key = trashKey(e);
    if (key === null || keys.has(key)) return false;
    if (isPlainObject(e) && e.kind === 'folder' && typeof e.rootId === 'string' && liveFolders.has(e.rootId)) return false;
    const slots = trashSlotsOf(e);
    if (slots.some(slot => claimed.has(slot))) return false;
    keys.add(key);
    for (const slot of slots) claimed.add(slot);
    return true;
  });
  if (!added.length) return here;
  return [...mine, ...added.map(copy)];
}

const laterOf = (a: unknown, b: unknown): unknown =>
  typeof a === 'string' && typeof b === 'string' ? (b > a ? b : a) : (a ?? b);

function mergeFolders(here: unknown, incoming: unknown): unknown {
  const mine = listOf<Folder>(here);
  const theirs = listOf<Folder>(incoming).filter(f => isPlainObject(f) && typeof f.id === 'string');
  if (!theirs.length) return here;

  const filed = new Set<string>();
  for (const f of mine) {
    if (!isPlainObject(f)) continue;
    for (const it of listOf<FolderItem>(f.items)) if (isPlainObject(it) && typeof it.ref === 'string') filed.add(it.ref);
  }
  const takeNew = (items: unknown): FolderItem[] => listOf<FolderItem>(items).filter(it => {
    if (!isPlainObject(it) || typeof it.ref !== 'string' || filed.has(it.ref)) return false;
    filed.add(it.ref);
    return true;
  }).map(it => ({ ...it }));

  const index = new Map<string, number>();
  mine.forEach((f, i) => { if (isPlainObject(f) && typeof f.id === 'string' && !index.has(f.id)) index.set(f.id, i); });
  const out: Folder[] = [...mine];
  let changed = false;
  for (const inc of theirs) {
    const at = index.get(inc.id);
    if (at === undefined) {
      out.push({ ...copy(inc), items: takeNew(inc.items) });
      index.set(inc.id, out.length - 1);
      changed = true;
      continue;
    }
    const extra = takeNew(inc.items);
    if (!extra.length) continue;
    const cur = out[at]!;
    out[at] = { ...cur, items: [...listOf<FolderItem>(cur.items), ...extra], updatedAt: laterOf(cur.updatedAt, inc.updatedAt) as string };
    changed = true;
  }
  return changed ? out : here;
}

/**
 * The profile record this device should hold after taking in `incoming`, by the
 * rules in the header. `here` is never mutated; the result may share this device's
 * own unchanged values with it, and never shares anything with `incoming`.
 */
export function mergeProfileRecords(here: ProfileRecord | null | undefined, incoming: ProfileRecord | null | undefined): ProfileRecord {
  const mine: ProfileRecord = isPlainObject(here) ? here : {};
  const theirs: ProfileRecord = isPlainObject(incoming) ? incoming : {};
  const out: ProfileRecord = { ...mine };
  const put = (key: string, value: unknown): void => {
    if (value === undefined) return;
    out[key] = value;
  };

  put('folders', 'folders' in theirs ? mergeFolders(mine.folders, theirs.folders) : undefined);
  const liveFolders = new Set(listOf<{ id?: unknown }>(out.folders).map(f => (isPlainObject(f) ? f.id : undefined)).filter((id): id is string => typeof id === 'string'));
  put('trash', 'trash' in theirs ? mergeTrash(mine.trash, theirs.trash, liveFolders) : undefined);
  for (const key of UNION_LISTS) if (key in theirs) put(key, mergeUnion(mine[key], theirs[key]));
  for (const key of RECORD_LISTS) if (key in theirs) put(key, mergeById(mine[key], theirs[key]));

  for (const [list, marker] of SEEDED_PAIRS) {
    if (mine[marker] === true || !isEmptyValue(mine[list])) continue;
    if (!isEmptyValue(theirs[list])) put(list, copy(theirs[list]));
    if (isEmptyValue(mine[marker]) && !isEmptyValue(theirs[marker])) put(marker, copy(theirs[marker]));
  }

  for (const [key, value] of Object.entries(theirs)) {
    if (HANDLED.has(key)) continue;
    if (isEmptyValue(mine[key]) && !isEmptyValue(value)) out[key] = copy(value);
  }
  return out;
}
