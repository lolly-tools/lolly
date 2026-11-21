// SPDX-License-Identifier: MPL-2.0
/**
 * A small in-memory IndexedDB with the idb API surface the history modules use
 * (object stores with the app's key paths and indexes, key ranges, cursors, a
 * transaction that rolls back on abort). Lets a node test drive the real state
 * bridge and revision store instead of stand-ins. Test code only; nothing in the
 * app imports this module, and importing it installs a global IDBKeyRange.
 */
type Key = string | number | Key[];
const rank = (key: Key): number => (Array.isArray(key) ? 3 : typeof key === 'string' ? 2 : 1);
function compare(a: Key, b: Key): number {
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = compare(a[i]!, b[i]!); if (c) return c; }
    return a.length - b.length;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}
class KeyRange {
  readonly lower?: Key; readonly upper?: Key; readonly lowerOpen: boolean; readonly upperOpen: boolean;
  constructor(lower?: Key, upper?: Key, lowerOpen = false, upperOpen = false) {
    this.lower = lower; this.upper = upper; this.lowerOpen = lowerOpen; this.upperOpen = upperOpen;
  }
  static bound(lower: Key, upper: Key, lowerOpen = false, upperOpen = false): KeyRange { return new KeyRange(lower, upper, lowerOpen, upperOpen); }
  static upperBound(upper: Key, open = false): KeyRange { return new KeyRange(undefined, upper, false, open); }
  static lowerBound(lower: Key, open = false): KeyRange { return new KeyRange(lower, undefined, open, false); }
  static only(key: Key): KeyRange { return new KeyRange(key, key); }
  includes(key: Key): boolean {
    if (this.lower !== undefined) { const c = compare(key, this.lower); if (c < 0 || (c === 0 && this.lowerOpen)) return false; }
    if (this.upper !== undefined) { const c = compare(key, this.upper); if (c > 0 || (c === 0 && this.upperOpen)) return false; }
    return true;
  }
}
(globalThis as Record<string, unknown>).IDBKeyRange = KeyRange;

const SCHEMA: Record<string, { keyPath?: string | string[]; indexes?: Record<string, string | string[]> }> = {
  state: { keyPath: 'slot', indexes: { toolId: 'toolId', updatedAt: 'updatedAt', history: 'historyKey' } },
  'revision-documents': { keyPath: 'slot' },
  revisions: { keyPath: 'id', indexes: { documentId: 'documentId', documentTime: ['documentId', 'at', 'id'], documentReason: ['documentId', 'reason', 'at', 'id'], time: ['at', 'id'], toolTime: ['toolId', 'at', 'id'] } },
  'revision-payloads': {}, 'revision-previews': {}, 'revision-usage': {},
  'revision-recovery': { keyPath: 'id', indexes: { slot: 'slot', slotTime: ['slot', 'at', 'id'], time: ['at', 'id'] } },
  'revision-recovery-payloads': {},
  exports: { keyPath: 'id', indexes: { history: 'historyKey' } },
  'file-operations': { keyPath: 'id' }, 'file-batches': { keyPath: 'id' }, 'file-operation-blobs': {},
  profile: {}, 'design-systems': { keyPath: 'id' },
  'asset-meta': { keyPath: 'id' }, 'asset-blob': {}, 'user-assets': { keyPath: 'id' },
  'asset-observations': { keyPath: 'key', indexes: { id: 'id' } }, 'user-asset-versions': { keyPath: ['assetId', 'version'] },
  // Plan 373: the one preview store and the lean list of sessions (version 27).
  'preview-blobs': { keyPath: 'key' }, 'preview-index': { keyPath: 'id', indexes: { content: 'content' } }, 'state-list': { keyPath: 'slot' },
};
/** The stores a database at version 26 (before plan 373) does not have. */
export const PREVIEW_STORE_NAMES = ['preview-blobs', 'preview-index', 'state-list'];
type Row = { key: Key; value: unknown };
export type Stores = Map<string, Map<string, Row>>;
const pathKey = (value: unknown, path: string | string[]): Key | undefined => {
  const one = (p: string): Key | undefined => (value as Record<string, Key | undefined>)[p];
  if (!Array.isArray(path)) return one(path);
  const parts = path.map(one);
  return parts.some(part => part === undefined) ? undefined : (parts as Key[]);
};
/** A fresh empty database. Cast `db` to IDBPDatabase where a module asks for one.
 *  `{ without }` leaves stores out, as a database an older version made would. */
export function memoryDb(options: { without?: readonly string[] } = {}) {
  const stores: Stores = new Map(Object.keys(SCHEMA).filter(name => !options.without?.includes(name)).map(name => [name, new Map()]));
  const nameList = (list: readonly string[]) => ({ contains: (name: string) => list.includes(name), length: list.length, [Symbol.iterator]: () => list[Symbol.iterator]() });
  const matches = (key: Key, query?: Key | KeyRange | null): boolean =>
    query == null || (query instanceof KeyRange ? query.includes(key) : compare(key, query) === 0);
  const cursorOver = (rows: Array<{ key: Key; primaryKey: Key; value: unknown }>, index = 0): unknown => {
    const row = rows[index];
    if (!row) return null;
    return { key: row.key, primaryKey: row.primaryKey, value: structuredClone(row.value), continue: async () => cursorOver(rows, index + 1) };
  };
  const store = (name: string) => {
    const map = stores.get(name);
    if (!map) throw new Error(`no store ${name}`);
    const def = SCHEMA[name]!;
    const sorted = (): Row[] => [...map.values()].sort((a, b) => compare(a.key, b.key));
    const write = (value: unknown, key?: Key, add = false): Key => {
      const k = def.keyPath ? pathKey(value, def.keyPath) : key;
      if (k === undefined) throw new Error(`no key for ${name}`);
      if (add && map.has(JSON.stringify(k))) throw new Error(`ConstraintError ${name}`);
      map.set(JSON.stringify(k), { key: k, value: structuredClone(value) });
      return k;
    };
    const index = (indexName: string) => {
      const path = def.indexes?.[indexName];
      if (!path) throw new Error(`no index ${name}.${indexName}`);
      const rows = (query?: Key | KeyRange | null) => sorted()
        .map(row => ({ key: pathKey(row.value, path), primaryKey: row.key, value: row.value }))
        .filter((row): row is { key: Key; primaryKey: Key; value: unknown } => row.key !== undefined && matches(row.key, query))
        .sort((a, b) => compare(a.key, b.key) || compare(a.primaryKey, b.primaryKey));
      return {
        count: async (query?: Key | KeyRange | null) => rows(query).length,
        getAllKeys: async (query?: Key | KeyRange | null) => rows(query).map(row => row.primaryKey),
        getAll: async (query?: Key | KeyRange | null) => rows(query).map(row => structuredClone(row.value)),
        openCursor: async (query?: Key | KeyRange | null, direction = 'next') => { const r = rows(query); return cursorOver(direction === 'prev' ? r.reverse() : r); },
        openKeyCursor: async (query?: Key | KeyRange | null, direction = 'next') => { const r = rows(query); return cursorOver(direction === 'prev' ? r.reverse() : r); },
      };
    };
    return {
      indexNames: { contains: (indexName: string) => !!def.indexes?.[indexName] },
      get: async (key: Key) => { const row = map.get(JSON.stringify(key)); return row ? structuredClone(row.value) : undefined; },
      count: async (query?: Key | KeyRange | null) => sorted().filter(row => matches(row.key, query)).length,
      getAll: async (query?: Key | KeyRange | null, count?: number) => sorted().filter(row => matches(row.key, query)).slice(0, count ?? Infinity).map(row => structuredClone(row.value)),
      getAllKeys: async (query?: Key | KeyRange | null, count?: number) => sorted().filter(row => matches(row.key, query)).slice(0, count ?? Infinity).map(row => row.key),
      clear: async () => { map.clear(); },
      put: async (value: unknown, key?: Key) => write(value, key),
      add: async (value: unknown, key?: Key) => write(value, key, true),
      delete: async (key: Key) => { map.delete(JSON.stringify(key)); },
      openCursor: async (query?: Key | KeyRange | null, direction = 'next') => {
        const r = sorted().filter(row => matches(row.key, query)).map(row => ({ key: row.key, primaryKey: row.key, value: row.value }));
        return cursorOver(direction === 'prev' ? r.reverse() : r);
      },
      index,
    };
  };
  // The transaction hands back its database (idb's `tx.db`), set once `db` exists.
  let self: unknown = null;
  const db = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    transaction(names: string | string[]) {
      const list = Array.isArray(names) ? names : [names];
      for (const name of list) if (!stores.has(name)) throw new Error(`NotFoundError: no store ${name}`);
      const saved = new Map(list.map(name => [name, new Map(stores.get(name))]));
      let settle!: (ok: boolean) => void;
      const done = new Promise<void>((resolve, reject) => { settle = ok => (ok ? resolve() : reject(new Error('AbortError'))); });
      let finished = false;
      setTimeout(() => { if (!finished) { finished = true; settle(true); } });
      return {
        done,
        get db() { return self; },
        objectStoreNames: nameList(list),
        store: store(list[0]!),
        objectStore(name: string) { if (!list.includes(name)) throw new Error(`${name} is not in this transaction`); return store(name); },
        abort() { for (const [name, map] of saved) stores.set(name, map); if (!finished) { finished = true; settle(false); } },
      };
    },
    get: (name: string, key: Key) => (stores.has(name) ? store(name).get(key) : Promise.resolve(undefined)),
    getAll: (name: string, query?: Key | KeyRange, count?: number) => store(name).getAll(query, count),
    getAllKeys: (name: string, query?: Key | KeyRange, count?: number) => store(name).getAllKeys(query, count),
    count: (name: string, query?: Key | KeyRange) => store(name).count(query),
    clear: (name: string) => store(name).clear(),
    put: (name: string, value: unknown, key?: Key) => store(name).put(value, key),
    add: (name: string, value: unknown, key?: Key) => store(name).add(value, key),
    delete: (name: string, key: Key) => store(name).delete(key),
  };
  self = db;
  return { db, stores };
}
