// SPDX-License-Identifier: MPL-2.0
/**
 * Storage for the Rondocode editor frame.
 *
 * The frame has an opaque origin, so the browser gives it no IndexedDB, and any
 * read of `localStorage` or `sessionStorage` throws. Upstream keeps its project
 * library in IndexedDB and a dozen small settings in localStorage, so both are
 * replaced here:
 *
 *   - `MemoryStorage` stands in for the two Storage objects. localStorage starts
 *     from the settings the utility saved last time and reports each change to
 *     the parent page; sessionStorage lives as long as the frame.
 *   - `FrameDb` is the project library: the parent sends a snapshot at boot,
 *     reads are answered from memory, and every write is applied here and sent
 *     to the parent, which keeps the library in Lolly's saved state.
 *
 * Nothing here trusts the parent's snapshot to be well formed: records that are
 * not plain objects with a string id are dropped on the way in.
 */

/** The library stores the parent keeps. Samples are PCM, megabytes each, and stay in the frame. */
export const SAVED_STORES = ['projects', 'versions', 'snippets'] as const;
export type SavedStore = (typeof SAVED_STORES)[number];
export type StoreName = SavedStore | 'samples';

/** A library record as upstream stores it: a plain object keyed by `id`. */
export interface StoreRecord {
  id: string;
  [field: string]: unknown;
}

/** The saved part of the library, as the parent sends it at boot. */
export type LibrarySnapshot = Partial<Record<SavedStore, unknown[]>>;

/** One change to the saved library, in the form the frame reports. */
export type StoreOp =
  | { op: 'put'; store: SavedStore; value: StoreRecord }
  | { op: 'del'; store: SavedStore; id: string };

const isRecord = (v: unknown): v is StoreRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as { id?: unknown }).id === 'string';

const isSaved = (s: string): s is SavedStore => (SAVED_STORES as readonly string[]).includes(s);

/**
 * The library backend upstream's ProjectStore runs on (its `Db` interface:
 * all, get, put, del). Values are copied on the way in and out, as IndexedDB's
 * structured clone copies them, so the store's own rules behave the same.
 */
export class FrameDb {
  private readonly stores: Record<StoreName, Map<string, StoreRecord>> = {
    projects: new Map(),
    versions: new Map(),
    snippets: new Map(),
    samples: new Map(),
  };

  private readonly report: (op: StoreOp) => void;

  constructor(snapshot: LibrarySnapshot | null, report: (op: StoreOp) => void) {
    this.report = report;
    for (const name of SAVED_STORES) {
      const rows = snapshot?.[name];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) if (isRecord(row)) this.stores[name].set(row.id, structuredClone(row));
    }
  }

  async all<T>(store: StoreName): Promise<T[]> {
    return [...this.stores[store].values()].map((v) => structuredClone(v)) as T[];
  }

  async get<T>(store: StoreName, id: string): Promise<T | undefined> {
    const v = this.stores[store].get(id);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }

  async put(store: StoreName, value: StoreRecord): Promise<void> {
    const copy = structuredClone(value);
    this.stores[store].set(copy.id, copy);
    if (isSaved(store)) this.report({ op: 'put', store, value: structuredClone(copy) });
  }

  async del(store: StoreName, id: string): Promise<void> {
    this.stores[store].delete(id);
    if (isSaved(store)) this.report({ op: 'del', store, id });
  }
}

/**
 * A Storage that lives in memory. `onChange` hears every write (null for a
 * removal), so localStorage can be saved by the parent page.
 */
export class MemoryStorage {
  private readonly map = new Map<string, string>();
  private readonly onChange: ((key: string, value: string | null) => void) | undefined;

  constructor(seed: Record<string, string> = {}, onChange?: (key: string, value: string | null) => void) {
    this.onChange = onChange;
    for (const [k, v] of Object.entries(seed)) if (typeof v === 'string') this.map.set(k, v);
  }

  get length(): number {
    return this.map.size;
  }

  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }

  getItem(key: string): string | null {
    return this.map.get(String(key)) ?? null;
  }

  setItem(key: string, value: string): void {
    const k = String(key);
    const v = String(value);
    if (this.map.get(k) === v) return;
    this.map.set(k, v);
    this.onChange?.(k, v);
  }

  removeItem(key: string): void {
    const k = String(key);
    if (!this.map.has(k)) return;
    this.map.delete(k);
    this.onChange?.(k, null);
  }

  clear(): void {
    for (const k of [...this.map.keys()]) this.removeItem(k);
  }

  /** Every entry, for a test or a save. */
  entries(): Record<string, string> {
    return Object.fromEntries(this.map);
  }
}

/**
 * Put the two memory Storages where the app looks for localStorage and
 * sessionStorage. The browser's own properties throw in an opaque-origin frame,
 * and they are configurable on the window, so a plain redefinition replaces them.
 */
export function installStorage(local: MemoryStorage, session: MemoryStorage, target: object = globalThis): void {
  for (const [name, store] of [['localStorage', local], ['sessionStorage', session]] as const) {
    try {
      Object.defineProperty(target, name, { value: store, configurable: true, enumerable: true, writable: false });
    } catch {
      // A host that refuses the redefinition keeps its own Storage; upstream
      // guards every storage read, so the app still runs, without settings.
    }
  }
}
