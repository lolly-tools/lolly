// SPDX-License-Identifier: MPL-2.0
/**
 * The journal of a design-system edit that has not finished saving.
 *
 * Brand Studio saves the whole document after each edit, one save at a time, and under
 * load a save takes a few hundred milliseconds. A reload or a closed tab in that window
 * used to lose the edit: the queued save never ran. So each edit is also written, at
 * once, to a small journal entry on this device: the newest document, the hash of the
 * stored document it was edited from (its base) and when. The entry goes when the newest
 * edit is saved.
 *
 * On the next load, before the studio shows the stored document:
 * - an entry whose base is still the stored document is replayed (shown, then saved the
 *   normal way, and cleared);
 * - an entry whose base no longer matches (another tab saved, a sync arrived, the system
 *   was replaced) is never written over the stored document: the person chooses between
 *   the two, and both stay until they do;
 * - an entry whose document is already what is stored is dropped quietly.
 *
 * Entries live in `host.state` under a hidden slot per design system and tab
 * (`__dsjournal__:<system>:<tab>`), so two systems or two tabs never share one. They are
 * hidden from every session list and never travel by sync or in a backup: they belong to
 * this device's open tabs. An open tab holds a Web Lock named for its tab, so a tab that
 * is still editing keeps its entry to itself. Entries older than seven days, or for a
 * system no longer on this device, are dropped. A locked or managed design system, one
 * the person cannot edit, is never journalled.
 */
import { JOURNAL_SLOT_PREFIX } from '../batch-slots.ts';

/** How long an entry nobody came back for is kept. */
export const JOURNAL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** The sessionStorage key that keeps a tab's journal id across its own reloads. */
export const JOURNAL_TAB_KEY = 'lolly-ds-journal-tab';
/** Web Lock names: one per open tab that is journalling. */
export const JOURNAL_LOCK_PREFIX = 'lolly-ds-journal:';

type Doc = Record<string, unknown>;

export interface JournalEntry {
  v: 1;
  /** The design system the save writes to. */
  system: string;
  /** The tab that made the edit. */
  tab: string;
  /** Hash of the stored document the edit was made from (`docHash`). */
  base: string;
  /** When the entry was written (ms since the epoch). */
  at: number;
  /** The newest edited document. */
  doc: Doc;
}

/** The slice of `host.state` the journal uses. HostV1's StateAPI has this shape. */
export interface JournalStore {
  save(slot: string, data: object): Promise<void>;
  load(slot: string): Promise<unknown>;
  delete(slot: string): Promise<void>;
  list(): Promise<ReadonlyArray<{ slot: string }>>;
}

const isDoc = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The hidden slot for one system and tab. */
export const journalSlot = (system: string, tab: string): string => `${JOURNAL_SLOT_PREFIX}${system}:${tab}`;

/** JSON with every object's keys sorted, so equal documents read equal whatever their key order. */
export function stableJson(value: unknown): string {
  const norm = JSON.parse(JSON.stringify(value ?? null)) as unknown;
  const walk = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(walk).join(',')}]`;
    if (isDoc(v)) return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${walk(v[k])}`).join(',')}}`;
    return JSON.stringify(v);
  };
  return walk(norm);
}

/** FNV-1a over UTF-16 units, for a context without SubtleCrypto. Change detection only. */
function fnv(text: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return `fnv:${h1.toString(16)}${h2.toString(16)}`;
}

/** A hash of a stored document, `none` when there is none. Equal documents hash equal. */
export async function docHash(doc: unknown): Promise<string> {
  if (!isDoc(doc)) return 'none';
  const text = stableJson(doc);
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (!subtle) return fnv(text);
  const bytes = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return `sha256:${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}

/** One stored entry, or null when the slot holds something else. */
export function parseEntry(data: unknown): JournalEntry | null {
  if (!isDoc(data) || data.v !== 1) return null;
  const { system, tab, base, at, doc } = data;
  if (typeof system !== 'string' || typeof tab !== 'string' || typeof base !== 'string' || typeof at !== 'number' || !isDoc(doc)) return null;
  return { v: 1, system, tab, base, at, doc };
}

/** Every entry on this device, newest first; `system` narrows them to one design system. */
export async function readEntries(store: JournalStore, system?: string): Promise<Array<{ slot: string; entry: JournalEntry }>> {
  const out: Array<{ slot: string; entry: JournalEntry }> = [];
  for (const row of await store.list()) {
    if (!row.slot.startsWith(JOURNAL_SLOT_PREFIX)) continue;
    const entry = parseEntry(await store.load(row.slot).catch(() => null));
    if (!entry) { await store.delete(row.slot).catch(() => {}); continue; }
    if (system === undefined || entry.system === system) out.push({ slot: row.slot, entry });
  }
  return out.sort((a, b) => b.entry.at - a.entry.at);
}

/**
 * Drop the entries nobody will come back for: older than the age limit, or for a design
 * system no longer on this device. Returns how many went.
 */
export async function sweepJournal(store: JournalStore, opts: { systems: ReadonlyArray<string>; now?: number; maxAgeMs?: number }): Promise<number> {
  const now = opts.now ?? Date.now();
  const limit = opts.maxAgeMs ?? JOURNAL_MAX_AGE_MS;
  const present = new Set(opts.systems);
  let dropped = 0;
  for (const { slot, entry } of await readEntries(store)) {
    if (now - entry.at > limit || !present.has(entry.system)) {
      await store.delete(slot).catch(() => {});
      dropped++;
    }
  }
  return dropped;
}

export interface RecoveryPlan {
  /** Replay this entry: its base is still the stored document. */
  replay: { slot: string; entry: JournalEntry } | null;
  /** Ask about these: the stored document changed since their base. Newest first. */
  choices: Array<{ slot: string; entry: JournalEntry }>;
}

export interface RecoveryInput {
  /** The document the studio is about to show, as stored. */
  storedDoc: unknown;
  /** Tabs still open and journalling: their entries are theirs, not ours to recover. */
  liveTabs: ReadonlySet<string>;
  /** This page's tab ids (the one it had before a reload, and its own). Always ours. */
  ownTabs: ReadonlySet<string>;
  /** A locked or managed system, which nothing is recovered into. */
  locked: boolean;
  /** What a save of `doc` over `stored` writes (the logo groups come from the stored
   *  head). Defaults to the document unchanged. */
  effective?: (doc: Doc, stored: unknown) => unknown;
}

/**
 * Decide, for one design system's entries, what a load does: replay the newest entry
 * whose base is the stored document, offer the rest as choices, and drop (from `store`)
 * any whose document is already the stored one.
 */
export async function planRecovery(
  store: JournalStore,
  entries: ReadonlyArray<{ slot: string; entry: JournalEntry }>,
  input: RecoveryInput,
): Promise<RecoveryPlan> {
  const plan: RecoveryPlan = { replay: null, choices: [] };
  if (input.locked) return plan;
  const storedHash = await docHash(input.storedDoc);
  const storedJson = isDoc(input.storedDoc) ? stableJson(input.storedDoc) : null;
  const effective = input.effective ?? ((doc: Doc) => doc);
  for (const item of entries) {
    const { entry } = item;
    if (input.liveTabs.has(entry.tab) && !input.ownTabs.has(entry.tab)) continue;
    // Already saved: the stored document is exactly what this entry would write.
    if (storedJson !== null && stableJson(effective(entry.doc, input.storedDoc)) === storedJson) {
      await store.delete(item.slot).catch(() => {});
      continue;
    }
    if (!plan.replay && entry.base === storedHash) plan.replay = item;
    else plan.choices.push(item);
  }
  return plan;
}

/** A fresh tab id, kept for this tab's later reloads. */
export function mintJournalTab(storage: Pick<Storage, 'setItem'> | null): string {
  const tab = globalThis.crypto?.randomUUID?.() ?? `t${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  try { storage?.setItem(JOURNAL_TAB_KEY, tab); } catch { /* a private window: one id per load */ }
  return tab;
}

/** The tab id this page journals under, and the one it had before a reload. */
export function journalTabIds(storage: Pick<Storage, 'getItem' | 'setItem'> | null, heldLocks: ReadonlySet<string>): { tab: string; previous: string | null } {
  let previous: string | null = null;
  try { previous = storage?.getItem(JOURNAL_TAB_KEY) ?? null; } catch { previous = null; }
  // A duplicated tab copies sessionStorage: when another open tab already holds this id,
  // this page takes a new one so the two never share an entry.
  const tab = previous && !heldLocks.has(previous) ? previous : mintJournalTab(storage);
  return { tab, previous };
}

/** The tab ids whose Web Lock is held right now (open tabs that are journalling). */
export async function heldJournalTabs(locks: LockManager | undefined = globalThis.navigator?.locks): Promise<Set<string>> {
  const held = new Set<string>();
  if (!locks?.query) return held;
  try {
    const snapshot = await locks.query();
    for (const lock of snapshot.held ?? []) {
      if (lock.name?.startsWith(JOURNAL_LOCK_PREFIX)) held.add(lock.name.slice(JOURNAL_LOCK_PREFIX.length));
    }
  } catch { /* no lock manager: every other tab counts as closed */ }
  return held;
}

export interface EditJournal {
  /** The stored document's hash that the next edits start from. */
  setBase(base: string): void;
  /**
   * The newest unsaved document, written at once. The journal keeps the reference and
   * copies the document only when it writes, so an edit pays no copy of its own.
   */
  record(doc: Doc): void;
  /** The newest edit is saved: drop this tab's entry. */
  clear(): void;
  /** Write again if the newest edit is not in the journal yet (the page is hiding). */
  flush(): void;
  /** Settles when every queued write and clear has finished (for tests and teardown). */
  idle(): Promise<void>;
  dispose(): void;
}

export interface EditJournalOptions {
  system: string;
  tab: string;
  base: string;
  /** A locked or managed system: the journal writes nothing. */
  locked?: boolean;
  /** Listens for pagehide and visibilitychange. Absent in tests. */
  win?: Window;
  /** Holds this tab's Web Lock while the journal runs. Absent where there is none. */
  locks?: LockManager;
  now?: () => number;
}

/**
 * Keep one tab's entry for one design system up to date. Writes and clears run one at a
 * time and the newest wins: a write queued behind another replaces it, and a clear drops
 * any write still waiting.
 */
export function startEditJournal(store: JournalStore, opts: EditJournalOptions): EditJournal {
  const slot = journalSlot(opts.system, opts.tab);
  const now = opts.now ?? Date.now;
  let base = opts.base;
  // The newest unsaved document (a live reference), and how many edits have been
  // recorded and written: equal counts mean the journal holds the newest edit.
  let latest: Doc | null = null;
  let recorded = 0;
  let written = 0;
  let pending: 'write' | 'clear' | null = null;
  let running: Promise<void> | null = null;
  let disposed = false;

  const pump = (): Promise<void> => {
    if (running) return running;
    running = (async () => {
      while (pending) {
        const op = pending;
        pending = null;
        try {
          if (op === 'clear') { await store.delete(slot); continue; }
          if (!latest) continue;
          const seq = recorded;
          const entry: JournalEntry = { v: 1, system: opts.system, tab: opts.tab, base, at: now(), doc: structuredClone(latest) };
          await store.save(slot, entry);
          written = seq;
        } catch { /* best-effort: the save itself is still on its way */ }
      }
    })().finally(() => { running = null; });
    return running;
  };
  const queue = (op: 'write' | 'clear'): void => {
    if (opts.locked || disposed) return;
    pending = op;
    void pump();
  };

  let release: (() => void) | null = null;
  if (!opts.locked && opts.locks?.request) {
    void opts.locks.request(JOURNAL_LOCK_PREFIX + opts.tab, () => new Promise<void>((resolve) => { release = resolve; })).catch(() => {});
  }
  const onHide = (): void => { journal.flush(); };
  const onVisibility = (): void => { if (opts.win?.document.visibilityState === 'hidden') journal.flush(); };
  opts.win?.addEventListener('pagehide', onHide);
  opts.win?.document.addEventListener('visibilitychange', onVisibility);

  const journal: EditJournal = {
    setBase(next) {
      base = next;
      // A newer edit is still unsaved: keep its entry, now against the new base.
      if (latest) queue('write');
    },
    record(doc) {
      latest = doc;
      recorded++;
      queue('write');
    },
    clear() {
      latest = null;
      written = recorded;
      queue('clear');
    },
    flush() {
      if (latest && written !== recorded && pending !== 'write') queue('write');
    },
    async idle() {
      while (running) await running;
    },
    dispose() {
      disposed = true;
      opts.win?.removeEventListener('pagehide', onHide);
      opts.win?.document.removeEventListener('visibilitychange', onVisibility);
      release?.();
      release = null;
    },
  };
  return journal;
}
