// SPDX-License-Identifier: MPL-2.0
/**
 * sync-records (plans/138 B2) - the records per-record sync carries, read from and
 * written back through the same bridge calls a backup uses (data-transfer.ts), so
 * every shell syncs the same records.
 *
 * One record per saved session, uploaded asset, own design system, and user
 * preference, plus the profile record and the active design-system choice. A
 * record travels as canonical JSON (keys sorted, so the same content has the same
 * bytes and hash on every device). An asset's bytes and its Content Credentials
 * travel as separate binary parts named by their SHA-256, so an image is stored
 * once however many records name it, and a rename or tag edit moves no image bytes.
 *
 * What never travels, as in a sync snapshot: revision history, the discarded edits
 * History keeps (`__discarded__:` slots), file history and asset versions, and
 * anything device-local (provider connections, sync settings, caches). History
 * stays on the device that made it (plan 277 P4).
 *
 * When both devices edited the same record (sync-merge.ts 'resolve'):
 *   - Sessions and uploaded assets: the copy saved later wins at its own id, and
 *     the other is kept too, under a new id (a conflict copy), on every
 *     device. A copy keeps the losing content unchanged, so its index entry points
 *     at the losing side's own object rather than adding another.
 *   - Design material (a design system's tokens, fonts and logos): the copy saved
 *     later wins, and the device that loses keeps its copy in that asset's local
 *     versions (the web bridge snapshots a replaced head on import). A loose copy
 *     outside the design system would be material nothing uses.
 *   - The profile record and design-system records: merged field by field
 *     against the base (mergeFields). Lists of folders, favourites, templates and
 *     Trash entries keep what either side added (lib/profile-merge.ts).
 *   - A preference or the active design system: the store's choice stays.
 */

import { PREF_KEYS, type exportBackup } from '../data-transfer.ts';
import { packBackupAsset, unpackBackupAsset } from './backup-asset-record.ts';
import { sessionSavedAt } from './backup-sessions.ts';
import { isDiscardedSlot, isHiddenSlot } from './batch-slots.ts';
import { mergeProfileRecords } from './profile-merge.ts';
import { sha256Hex } from './sync-keys.ts';
import { FROZEN_PREFIX } from '../bridge/version-assets-contract.ts';
import { designMaterialOf } from '../../../../engine/src/design-system.ts';

/** The host and storage a backup travels through; per-record sync uses the same. */
export type RecordDeps = Parameters<typeof exportBackup>[0];

export type RecordKind = 'session' | 'asset' | 'design-system' | 'profile' | 'pref' | 'active-design-system';

/** Kinds keyed by an id. The other two are single records. */
const KEYED: ReadonlyArray<RecordKind> = ['session', 'asset', 'design-system', 'pref'];

/** A record's key in the index: `<kind>/<id>`, or the bare kind for a single record. */
export function recordKey(kind: RecordKind, id = ''): string {
  return KEYED.includes(kind) ? `${kind}/${id}` : kind;
}

/** The kind and id a key names, or null for a key this build does not know. */
export function parseRecordKey(key: string): { kind: RecordKind; id: string } | null {
  if (key === 'profile' || key === 'active-design-system') return { kind: key, id: '' };
  const at = key.indexOf('/');
  const kind = key.slice(0, at) as RecordKind;
  return at > 0 && KEYED.includes(kind) && at < key.length - 1 ? { kind, id: key.slice(at + 1) } : null;
}

/** Records that are never removed from a device: an absent one is "not set yet". */
export function neverDeleted(kind: RecordKind): boolean {
  return kind === 'profile' || kind === 'active-design-system';
}

/** One binary part a record names: its size, and its bytes read when needed. */
export interface RecordPart {
  size: number;
  read(): Promise<Uint8Array>;
}

/** One of this device's records. */
export interface LocalRecord {
  key: string;
  kind: RecordKind;
  id: string;
  /** The content as it travels: JSON only, binary parts named `sha256:<digest>`. */
  value: Record<string, unknown>;
  /** Canonical JSON of `value`, the bytes stored for the record. */
  body: Uint8Array;
  /** SHA-256 of `body`. */
  hash: string;
  /** The binary parts `value` names, by digest. */
  parts: Map<string, RecordPart>;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !ArrayBuffer.isView(v);

/** JSON with every object's keys sorted, so equal content gives equal bytes. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (!isPlainObject(v)) return v;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) sorted[k] = v[k];
    return sorted;
  }) ?? 'null';
}

const sameValue = (a: unknown, b: unknown): boolean =>
  a === b || (a !== undefined && b !== undefined && canonicalJson(a) === canonicalJson(b));

/** Build a record from its travelling content. */
export async function makeRecord(kind: RecordKind, id: string, content: unknown, parts = new Map<string, RecordPart>()): Promise<LocalRecord> {
  const json = canonicalJson(content);
  const value = JSON.parse(json) as Record<string, unknown>;
  const body = new TextEncoder().encode(json);
  return { key: recordKey(kind, id), kind, id, value, body, hash: await sha256Hex(body), parts };
}

/** The same record under another id (a conflict copy): content, hash and parts unchanged. */
export function rekeyRecord(rec: LocalRecord, id: string): LocalRecord {
  return { ...rec, id, key: recordKey(rec.kind, id) };
}

type Registry = {
  list(): Promise<Array<{ id: string; source: { kind: string } } & Record<string, unknown>>>;
  activeId(): Promise<string>;
  put(record: unknown): Promise<void>;
  remove?(id: string): Promise<void>;
  setActive(id: string): Promise<void>;
};
const registryOf = (deps: RecordDeps): Registry | undefined => (deps.host as { designSystems?: Registry }).designSystems;

const PART_PREFIX = 'sha256:';
/** The digests of the binary parts a record's content names. */
export function partDigests(value: Record<string, unknown>): string[] {
  return [value._file, value._credentialFile]
    .filter((p): p is string => typeof p === 'string' && p.startsWith(PART_PREFIX))
    .map((p) => p.slice(PART_PREFIX.length));
}

const bytesOfEntry = (entry: Uint8Array | [Uint8Array, unknown] | undefined): Uint8Array | null =>
  entry ? (Array.isArray(entry) ? entry[0] : entry) : null;

/**
 * This device's records. With `only`, just the records whose keys it lists (the
 * check before an apply, and the hashes after one).
 */
export async function collectLocalRecords(deps: RecordDeps, only?: ReadonlySet<string>): Promise<Map<string, LocalRecord>> {
  const { host, storage } = deps;
  const out = new Map<string, LocalRecord>();
  const want = (kind: RecordKind, id = ''): boolean => !only || only.has(recordKey(kind, id));
  const add = (rec: LocalRecord): void => { out.set(rec.key, rec); };

  for (const row of await host.state.list()) {
    // Discarded edits stay with their history, on this device.
    if (isDiscardedSlot(row.slot) || !want('session', row.slot)) continue;
    const data = await host.state.load(row.slot);
    if (!data) continue;
    add(await makeRecord('session', row.slot, {
      toolId: row.toolId, toolVersion: row.toolVersion, label: row.label ?? null, thumb: row.thumb ?? null,
      updatedAt: row.updatedAt ?? null, ...(row.savedAt ? { savedAt: row.savedAt } : {}), data,
    }));
  }

  if (want('profile')) {
    const profile = await host.profile.get();
    if (profile && Object.keys(profile).length) add(await makeRecord('profile', '', profile));
  }

  const registry = registryOf(deps);
  if (registry) {
    try {
      const own = (await registry.list()).filter((r) => r.source.kind !== 'shipped');
      for (const { id, ...rest } of own) if (want('design-system', id)) add(await makeRecord('design-system', id, rest));
      if (own.length && want('active-design-system')) add(await makeRecord('active-design-system', '', { id: await registry.activeId() }));
    } catch { /* no registry on this host: the assets still carry the material */ }
  }

  for (const rec of await host.assets._exportUserAssets()) {
    const id = String(rec.id ?? '');
    if (!id || !want('asset', id)) continue;
    const { blob, credential, id: _id, ...meta } = rec;
    const value: Record<string, unknown> = { ...meta, _file: null, _mime: '' };
    const parts = new Map<string, RecordPart>();
    if (blob instanceof Blob) {
      const digest = await sha256Hex(new Uint8Array(await blob.arrayBuffer()));
      value._file = PART_PREFIX + digest;
      value._mime = blob.type;
      parts.set(digest, { size: blob.size, read: async () => new Uint8Array(await blob.arrayBuffer()) });
    }
    if (credential != null) {
      // The backup's own reader normalises older stores' Content Credentials.
      const entries: Parameters<typeof packBackupAsset>[2] = {};
      await packBackupAsset({ credential }, 'c', entries);
      const bytes = bytesOfEntry(entries['c.c2pa']);
      if (bytes) {
        const digest = await sha256Hex(bytes);
        value._credentialFile = PART_PREFIX + digest;
        parts.set(digest, { size: bytes.length, read: async () => bytes });
      }
    }
    add(await makeRecord('asset', id, value, parts));
  }

  for (const key of PREF_KEYS) {
    const v = storage.getItem(key);
    if (v != null && want('pref', key)) add(await makeRecord('pref', key, { value: v }));
  }
  return out;
}

const timeOf = (value: unknown): number | null => {
  const ms = typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(ms) ? ms : null;
};

/** Write one record on this device. `parts` holds the bytes its content names, by digest. */
export async function writeLocalRecord(
  deps: RecordDeps, kind: RecordKind, id: string, value: Record<string, unknown>, parts: ReadonlyMap<string, Uint8Array>,
): Promise<void> {
  const { host, storage } = deps;
  if (kind === 'session') {
    const updatedAt = typeof value.updatedAt === 'string' && timeOf(value.updatedAt) !== null ? value.updatedAt : null;
    const savedAt = typeof value.savedAt === 'string' && timeOf(value.savedAt) !== null ? value.savedAt : undefined;
    const thumb = typeof value.thumb === 'string' ? value.thumb : null;
    if (host.state.restore && updatedAt) await host.state.restore(id, value.data, thumb, updatedAt, savedAt);
    else await host.state.save(id, value.data, thumb);
  } else if (kind === 'asset') {
    const files: Record<string, Uint8Array> = {};
    for (const [digest, bytes] of parts) files[PART_PREFIX + digest] = bytes;
    const record = unpackBackupAsset(value, files, PART_PREFIX);
    await host.assets._importUserAsset({ ...record, id });
  } else if (kind === 'design-system') {
    const registry = registryOf(deps);
    if (!registry) throw new Error('This device keeps no design systems.');
    await registry.put({ ...value, id });
  } else if (kind === 'active-design-system') {
    if (typeof value.id === 'string') await registryOf(deps)?.setActive(value.id);
  } else if (kind === 'profile') {
    await host.profile.set(structuredClone(value));
  } else {
    storage.setItem(id, String(value.value ?? ''));
  }
}

/**
 * Remove one record from this device. False when this record is never removed
 * here: the profile, the active choice, discarded edits, the bytes a published
 * design-system version pins, or a host without the delete call.
 */
export async function removeLocalRecord(deps: RecordDeps, kind: RecordKind, id: string): Promise<boolean> {
  const { host, storage } = deps;
  if (kind === 'session') {
    if (isDiscardedSlot(id) || !host.state.delete) return false;
    await host.state.delete(id);
    return true;
  }
  if (kind === 'asset') {
    if (id.startsWith(FROZEN_PREFIX) || !host.assets._deleteUserAsset) return false;
    await host.assets._deleteUserAsset(id);
    return true;
  }
  if (kind === 'design-system') {
    const registry = registryOf(deps);
    if (!registry?.remove) return false;
    await registry.remove(id);
    return true;
  }
  if (kind === 'pref') {
    if (!storage.removeItem) return false;
    storage.removeItem(id);
    return true;
  }
  return false;
}

/** When the person last changed the record, in ms; null when the record does not say. */
export function recordTime(kind: RecordKind, value: Record<string, unknown>): number | null {
  if (kind === 'session') return timeOf(sessionSavedAt(value));
  if (kind === 'asset') return timeOf(isPlainObject(value.meta) ? value.meta.modifiedAt : undefined);
  return null;
}

/** A uuid-shaped id from hex, so a copy made again for the same loss gets the same id. */
function uuidFromHex(h: string): string {
  const variant = '89ab'[parseInt(h[16] ?? '0', 16) & 3];
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * The id a conflict copy of a session or an uploaded asset goes to, made from the
 * record key and the losing content, so a sync that runs again after a failure
 * reuses the same id. `attempt` picks another id when that one already holds something
 * else. Null when this record keeps no copy: hidden session slots (Trash,
 * templates, internal records), design material and pinned bytes.
 */
export async function conflictCopyId(
  kind: RecordKind, id: string, loser: { value: Record<string, unknown>; hash: string }, attempt = 0,
): Promise<string | null> {
  const mix = await sha256Hex(new TextEncoder().encode(`${recordKey(kind, id)}\n${loser.hash}${attempt ? `\n${attempt}` : ''}`));
  if (kind === 'session') {
    if (isHiddenSlot(id)) return null;
    const toolId = typeof loser.value.toolId === 'string' && loser.value.toolId ? loser.value.toolId : 'session';
    return `${toolId}:${uuidFromHex(mix)}`;
  }
  if (kind === 'asset') {
    if (id.startsWith(FROZEN_PREFIX) || designMaterialOf(id)) return null;
    const segs = id.split('/');
    const made = /^\d+/.exec(segs[2] ?? '')?.[0] ?? '0';
    return `user/${segs[1] || 'upload'}/${made}-${mix.slice(0, 12)}-copy`;
  }
  return null;
}

/**
 * A three-way merge of two JSON objects, field by field: a field changed on one
 * side only takes that side, and a field changed on both sides takes
 * `bothChanged(field)`. Without a base every differing field counts as changed on
 * both sides.
 */
export function mergeFields(
  base: Record<string, unknown> | null, here: Record<string, unknown>, store: Record<string, unknown>,
  bothChanged: (field: string) => unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of new Set([...Object.keys(here), ...Object.keys(store)])) {
    const h = here[field];
    const s = store[field];
    let v: unknown;
    if (sameValue(h, s)) v = s;
    else if (base && sameValue(h, base[field])) v = s;
    else if (base && sameValue(s, base[field])) v = h;
    else v = bothChanged(field);
    if (v !== undefined) out[field] = v;
  }
  return out;
}

/**
 * The profile record from two devices. A field changed on one side takes that
 * side. A field changed on both: the list fields keep what either side added
 * (lib/profile-merge.ts), and any other field takes the store's value. With no
 * base (a first sync), this device's own values stay, as "Bring it to this
 * device" always did.
 */
export function mergeProfileValues(
  base: Record<string, unknown> | null, here: Record<string, unknown>, store: Record<string, unknown>,
): Record<string, unknown> {
  const both = base ? mergeProfileRecords(store, here) : mergeProfileRecords(here, store);
  return mergeFields(base, here, store, (field) => both[field]);
}

const union = (first: unknown, second: unknown): unknown[] => {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const item of [...(Array.isArray(first) ? first : []), ...(Array.isArray(second) ? second : [])]) {
    const k = canonicalJson(item);
    if (!seen.has(k)) { seen.add(k); out.push(item); }
  }
  return out;
};

/**
 * A design-system record from two devices. A field changed on both sides: the
 * later use, the earlier creation, the tags and imported faces of both, and for
 * anything else the store's value (this device's with no base).
 */
export function mergeDesignSystemValues(
  base: Record<string, unknown> | null, here: Record<string, unknown>, store: Record<string, unknown>,
): Record<string, unknown> {
  const [first, second] = base ? [store, here] : [here, store];
  return mergeFields(base, here, store, (field) => {
    const a = first[field];
    const b = second[field];
    if (field === 'lastUsedAt' && typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
    if (field === 'createdAt' && typeof a === 'number' && typeof b === 'number') return Math.min(a, b);
    if ((field === 'tags' || field === 'importedFonts') && (Array.isArray(a) || Array.isArray(b))) return union(a, b);
    return a;
  });
}
