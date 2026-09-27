// SPDX-License-Identifier: MPL-2.0
/**
 * The Trash: one model for every delete the person makes in the web app
 * (plans/133 WP-4, widened by plan 277 P3, decided 2026-09-27: "projects and
 * user uploads can have a trash functionality if invoked via the web UI, in all
 * other instances delete means delete").
 *
 * The entries live in the profile record (`profile.trash`, see folders.ts), so
 * they ride backups and sync with the rest of the person's organisation. Three
 * kinds:
 *
 *   - a saved session: its state record MOVES to a `__trash__:` slot, together
 *     with its version history (the revision store's own move), so every session
 *     list skips it and nothing about it is lost;
 *   - a folder: its subtree of folder records is lifted into the entry and each
 *     member session moves to a `__trash__:` slot;
 *   - one of the person's uploads: the record keeps its id and bytes and is only
 *     marked `trashedAt` by the assets bridge, so a saved design that uses the
 *     picture still draws while every list leaves the upload out;
 *   - one of the person's font families: every face is marked the same way, its
 *     faces leave the document, and the entry keeps the roles the family served
 *     so a restore sets them back (the hooks for that are in user-fonts.ts).
 *
 * Restore puts each back where it was, folder membership included. Delete
 * forever, Empty Trash and the 30-day sweep do the real deletion, which is the
 * moment a session's history goes too.
 *
 * Who calls this: only web UI delete doors (Projects, Settings → Storage, the
 * gallery's saved-sessions list, Assets, My images, the asset picker, the batch
 * view, the brand editor's Fonts tab). The CLI, TUI, MCP, the tool-facing
 * host.state API and sync applies keep calling host.state.delete /
 * _deleteUserAsset (and user-fonts.ts removeUserFont), which delete at once.
 * That is the rule, so do not route them here.
 *
 * DOM-free, so the gallery can load this module lazily and a node test can
 * drive the model.
 */
import { createFolderStore, trashEntryKey, TRASH_RETENTION_MS } from '../folders.ts';
import type { Folder, FolderHost, FolderItem, TrashEntry, TrashedAsset, TrashedFolder, TrashedFont, TrashedSession } from '../folders.ts';
import { TRASH_SLOT_PREFIX, isTrashedSlot } from './batch-slots.ts';
import { hasMethods, isRecord } from './util/guards.ts';

/** A trashed upload as the assets bridge lists it (bridge/assets.ts). */
export interface TrashedUserAssetRow { id: string; type?: string; name: string; family?: string; trashedAt: string; bytes: number }

/** A font role, as user-fonts.ts calls them (the design system's font.* tokens). */
export type TrashFontRole = TrashedFont['roles'][number];

/**
 * What a font entry needs beyond marking its faces, supplied by user-fonts.ts so
 * this module stays DOM-free: reload the faces into the document (or unload
 * them) after the marks change, and put the family's roles back in its design
 * system. A test hands in fakes; the web app gets the real ones lazily.
 */
export interface FontTrashHooks {
  refresh(): Promise<void>;
  /** Set the roles back where they were, if that design system still exists,
   *  and only where a role still holds what the delete left there (`released`),
   *  so a choice made since is kept. Returns the roles actually set. */
  restoreRoles(family: string, roles: readonly TrashFontRole[], designSystemId: string | null, released?: TrashedFont['released']): Promise<TrashFontRole[]>;
}

/** What a restore did: everything back, some of it (`missing` items could not
 *  be found where the Trash left them), or nothing because the item is no
 *  longer in the Trash (restored or deleted from another tab or an Undo). */
export interface TrashRestoreResult { status: 'restored' | 'partial' | 'gone'; missing: number }

/** Every move to the Trash stamps its own time into the trash slot,
 *  `__trash__:@<ms, base 36>:<original slot>` (plan 277 review B4, B5). The item
 *  then carries when it was deleted, so an entry rebuilt after another tab's
 *  stale profile write gets the real date, and two deletions of the same slot
 *  never share a trash slot. Slots written before this carry no stamp. */
export function stampedTrashSlot(originalSlot: string, at: number): string {
  return `${TRASH_SLOT_PREFIX}@${Math.max(0, Math.floor(at)).toString(36)}:${originalSlot}`;
}

/** A trash slot's original slot and, when stamped, its delete time (ms). */
export function trashSlotInfo(slot: string): { at: number | null; originalSlot: string } | null {
  if (!isTrashedSlot(slot)) return null;
  const rest = slot.slice(TRASH_SLOT_PREFIX.length);
  const m = /^@([0-9a-z]+):(.+)$/.exec(rest);
  if (!m) return { at: null, originalSlot: rest };
  const at = parseInt(m[1]!, 36);
  return { at: Number.isSafeInteger(at) ? at : null, originalSlot: m[2]! };
}

/** One Trash event: its key plus its delete time. Two entries share a key when
 *  the same upload or font was deleted, restored and deleted again. */
const identOf = (e: TrashEntry): string => `${e.kind}|${trashEntryKey(e)}|${e.deletedAt}`;

/** Tell the open Trash views (this tab and others) that the Trash changed. */
function notifyTrashChanged(): void {
  try { (globalThis as { dispatchEvent?: (e: Event) => boolean }).dispatchEvent?.(new Event('lolly:trash-changed')); } catch { /* no event target */ }
  try {
    if (typeof BroadcastChannel !== 'undefined') { const channel = new BroadcastChannel('lolly-trash'); channel.postMessage('changed'); channel.close(); }
  } catch { /* no channel */ }
}

/** One state row as the Trash reads it (host.state.list()). */
interface TrashStateRow { slot: string; toolId?: string; label?: string | null; filename?: string | null; thumb?: string | null; updatedAt?: string; savedAt?: string }

/** The slice of the host bridge the Trash touches. */
export interface TrashHost {
  profile: FolderHost['profile'] & {
    /** Drop this tab's cached profile record (bridge/profile.ts). */
    bust?(): void;
  };
  state: {
    list(): Promise<ReadonlyArray<TrashStateRow>>;
    load(slot: string): Promise<unknown>;
    save(slot: string, data: never, thumb?: string | null): Promise<unknown>;
    /** Write a record keeping its own update and save times (the web and Tauri
     *  bridges): a Trash move is not an edit. */
    restore?(slot: string, data: never, thumb: string | null, updatedAt: string, savedAt?: string): Promise<unknown>;
    delete(slot: string): Promise<unknown>;
    sizes?(): Promise<Record<string, number>>;
    /** The web bridge's revision store: moves a record AND its history in one
     *  transaction. Hosts without history fall back to load, save, delete. */
    history?: { move(from: string, to: string): Promise<void> };
  };
  assets: FolderHost['assets'] & {
    _deleteUserAsset(id: string): Promise<unknown>;
    /** `expect` makes the write a compare-and-set on the current mark. */
    _setUserAssetTrashed?(id: string, trashedAt: string | null, opts?: { expect?: string | null }): Promise<boolean>;
    _listTrashedUserAssets?(): Promise<TrashedUserAssetRow[]>;
    /** Deletes only while the record still carries this Trash mark. */
    _deleteTrashedUserAsset?(id: string, trashedAt: string): Promise<boolean>;
  };
  log?(level: 'error' | 'warn' | 'info' | 'debug', message: string, meta?: Record<string, unknown>): void;
}

/** Does `host` carry every member the Trash calls? */
function isTrashHost<H extends object>(host: H): host is H & TrashHost {
  const h: unknown = host;
  return isRecord(h) && hasMethods(h.profile, ['get', 'set'])
    && hasMethods(h.state, ['list', 'load', 'save', 'delete'])
    && hasMethods(h.assets, ['_listUserAssets', '_deleteUserAsset']);
}

/**
 * `host` as a TrashHost, checked rather than asserted. Every web view is handed
 * the one web bridge but declares it through a narrower slice of its own (HostV1
 * plus what that view reads), so a door that opens the Trash checks here that
 * the members are there. Throws for a host without them, which no web door has.
 */
export function trashHostOf<H extends object>(host: H): H & TrashHost {
  if (!isTrashHost(host)) throw new Error('trash: this host cannot hold a Trash (no profile write, saved-item store or upload delete)');
  return host;
}

/** A purge that could not happen, with the reason in the person's words. */
export class TrashPurgeError extends Error {
  readonly entry: TrashEntry;
  constructor(message: string, entry: TrashEntry) { super(message); this.name = 'TrashPurgeError'; this.entry = entry; }
}

/** The name an entry shows in the Trash and in its toast. */
export const trashEntryName = (e: TrashEntry): string => (e.kind === 'folder' ? e.name : e.label);

/** An asset ref for trashAssets: the id plus what the row shows. */
export interface TrashAssetInput { id: string; name?: string; type?: string }

/** The overlay lists the Assets view keeps per asset, by base id. A purge
 *  removes a gone upload from each (a trashed one keeps them for its restore). */
interface OverlayProfile { favouriteAssets?: unknown; hiddenAssets?: unknown; assetCategories?: unknown }

/** How long a fresh session entry may point at a slot its record has not reached yet. */
const ENTRY_GRACE_MS = 60_000;

const nowIso = (): string => new Date().toISOString();
const isoAt = (ms: number): string => new Date(ms).toISOString();
const baseId = (id: string): string => id.split('?')[0]!.split('#')[0]!;

export function createTrash(host: TrashHost, opts: { fonts?: FontTrashHooks } = {}) {
  // Every Trash read-modify-write starts from the stored profile, not this tab's
  // cached copy (review B4): a Trash write never puts back what another tab
  // changed since this tab last read the record.
  const fresh: TrashHost = {
    ...host,
    profile: {
      get: async () => { host.profile.bust?.(); return host.profile.get(); },
      set: (p) => host.profile.set(p),
    },
  };
  const store = createFolderStore(fresh);
  // The font hooks live in user-fonts.ts, which touches the document and the
  // tokens bridge; loaded only when a font entry is restored or deleted.
  const fontHooks = async (): Promise<FontTrashHooks> => {
    if (opts.fonts) return opts.fonts;
    const fonts = await import('../user-fonts.ts');
    return fonts.fontTrashHooks(fonts.userFontsHostOf(host));
  };

  const exists = async (slot: string): Promise<boolean> => !!(await host.state.load(slot).catch(() => null));

  /** Move one session record between slots, history included. False when the
   *  source is gone (the revision store's move returns quietly then, so this
   *  checks first, review S8), the destination is taken, or the record did not
   *  arrive. The same move Projects used from views/tool-revision-history.ts,
   *  kept here so every door shares one move. */
  async function moveRecord(from: string, to: string): Promise<boolean> {
    try {
      if (!(await exists(from))) return false;
      if (host.state.history) {
        await host.state.history.move(from, to);
      } else {
        const data = await host.state.load(from);
        if (!data) return false;
        // A move keeps the record's own times (the review's timing fix): without
        // a revision store (the Tauri apps) `restore` writes them as they were.
        const row = (await host.state.list().catch(() => [] as ReadonlyArray<TrashStateRow>)).find(r => r.slot === from);
        const thumb = row?.thumb ?? null;
        if (host.state.restore && row?.updatedAt) await host.state.restore(to, data as never, thumb, row.updatedAt, row.savedAt);
        else await host.state.save(to, data as never, thumb);
        await host.state.delete(from);
      }
      return await exists(to);
    } catch (error) {
      host.log?.('warn', 'trash: session move failed', { from, to, error: String(error) });
      return false;
    }
  }

  /** A stamped trash slot for `slot` that nothing holds yet. */
  function trashSlotFor(slot: string, at: number, taken: ReadonlySet<string>): { slot: string; at: number } {
    let t = at;
    while (taken.has(stampedTrashSlot(slot, t))) t++;
    return { slot: stampedTrashSlot(slot, t), at: t };
  }

  /**
   * Does `entry` own the record at trash slot `slot`, so that deleting or moving
   * it acts on this entry's item and nothing else (review B3, B5)? The record
   * must be there; a stamped slot must carry this entry's own delete time; and no
   * later entry may claim the same slot (a slot from before stamping can be
   * shared by an entry an import brought back and a newer one).
   */
  async function ownsSlot(entry: TrashEntry, slot: string, current?: readonly TrashEntry[]): Promise<boolean> {
    if (!(await exists(slot))) return false;
    const info = trashSlotInfo(slot);
    if (!info) return false;
    if (info.at !== null && info.at !== Date.parse(entry.deletedAt)) return false;
    const others = current ?? await store.trashList();
    const claims = (e: TrashEntry): boolean =>
      (e.kind === 'session' && e.slot === slot) || (e.kind === 'folder' && e.sessions.some(m => m.slot === slot));
    return !others.some(e => identOf(e) !== identOf(entry) && claims(e) && e.deletedAt > entry.deletedAt);
  }

  /**
   * The profile's entries, reconciled with what storage actually holds, plus the
   * entries this pass created. One profile write, and only on change.
   *
   *   - a `__trash__:` record no entry owns becomes a session entry dated by its
   *     own stamp, or now for an unstamped slot: never its last save (review B4);
   *   - a session entry whose trash slot is gone, or that a later entry owns, is
   *     dropped; a folder entry keeps only the members it owns, and one whose
   *     folder is live again with none of its members left is dropped (an entry
   *     an import brought back for a folder restored since, review B5);
   *   - an upload marked trashed with no entry gains one (a backup or sync can
   *     bring the mark without the entry), and an upload entry whose record is
   *     gone or no longer carries that mark is dropped; font entries alike.
   *
   * `sessions: false` skips the session and folder half, which reads every saved
   * record: a count on the Assets view does not need it, and the dialog does the
   * full pass when it opens.
   */
  async function reconcile(opts: { sessions?: boolean } = {}): Promise<{ entries: TrashEntry[]; added: Set<string> }> {
    const entries = await store.trashList();
    const withSessions = opts.sessions !== false;
    const [rows, assets, folders] = await Promise.all([
      withSessions ? host.state.list().catch(() => null) : Promise.resolve(null),
      host.assets._listTrashedUserAssets?.().catch(() => null) ?? Promise.resolve(null),
      withSessions ? store.list().catch(() => [] as Folder[]) : Promise.resolve([] as Folder[]),
    ]);
    const drop = new Set<string>();
    const add: TrashEntry[] = [];
    const replace = new Map<string, TrashEntry>();
    if (rows) {
      const slots = new Set(rows.map(r => r.slot));
      const liveFolders = new Set(folders.map(f => f.id));
      // Who owns each trash slot: the latest-dated claim.
      const owner = new Map<string, string>();
      const byIdent = new Map(entries.map(e => [identOf(e), e]));
      const claim = (slot: string, e: TrashEntry): void => {
        const cur = owner.get(slot);
        if (!cur || byIdent.get(cur)!.deletedAt < e.deletedAt) owner.set(slot, identOf(e));
      };
      for (const e of entries) {
        if (e.kind === 'session') claim(e.slot, e);
        else if (e.kind === 'folder') for (const m of e.sessions) claim(m.slot, e);
      }
      for (const e of entries) {
        if (e.kind === 'session') {
          // An entry is written just before its record moves, so a pass in another
          // tab can land in between: a missing slot counts only after a minute.
          const missing = !slots.has(e.slot) && Date.now() - Date.parse(e.deletedAt) > ENTRY_GRACE_MS;
          if (missing || owner.get(e.slot) !== identOf(e)) drop.add(identOf(e));
        } else if (e.kind === 'folder') {
          const owned = e.sessions.filter(m => owner.get(m.slot) === identOf(e));
          if (liveFolders.has(e.rootId) && !owned.some(m => slots.has(m.slot))) drop.add(identOf(e));
          else if (owned.length !== e.sessions.length) replace.set(identOf(e), { ...e, sessions: owned });
        }
      }
      for (const r of rows) {
        const info = trashSlotInfo(r.slot);
        if (!info) continue;
        const holder = owner.get(r.slot);
        if (holder && !drop.has(holder)) continue;
        add.push({
          kind: 'session', slot: r.slot, originalSlot: info.originalSlot,
          label: r.label || r.filename || r.toolId || info.originalSlot, parentId: null,
          deletedAt: info.at !== null ? isoAt(info.at) : nowIso(),
        });
      }
    }
    if (assets) {
      const markOf = new Map(assets.map(a => [a.id, a.trashedAt]));
      const known = new Set<string>();
      for (const e of entries) {
        if (e.kind === 'asset') {
          if (markOf.get(e.id) === e.deletedAt) known.add(e.id);
          else drop.add(identOf(e));
        } else if (e.kind === 'font') {
          // A face re-added meanwhile (the same Google family installed again
          // writes the same ids) is live, so it leaves the entry; an entry with
          // no marked face left is gone.
          const still = e.assetIds.filter(id => markOf.get(id) === e.deletedAt);
          for (const id of still) known.add(id);
          if (!still.length) drop.add(identOf(e));
          else if (still.length !== e.assetIds.length) replace.set(identOf(e), { ...e, assetIds: still });
        }
      }
      const orphanFonts = new Map<string, TrashedUserAssetRow[]>();
      for (const a of assets) {
        if (known.has(a.id)) continue;
        if (a.type === 'font') {
          const key = `${a.family || a.name}|${a.trashedAt}`;
          orphanFonts.set(key, [...(orphanFonts.get(key) ?? []), a]);
          continue;
        }
        add.push({ kind: 'asset', id: a.id, label: a.name, ...(a.type ? { assetType: a.type } : {}), parentId: null, deletedAt: a.trashedAt });
      }
      // Faces marked with no entry (a backup or sync brought the marks without
      // the profile's entry): one entry per family and delete time, no roles.
      for (const faces of orphanFonts.values()) {
        const family = faces[0]!.family || faces[0]!.name;
        add.push({ kind: 'font', family, label: family, assetIds: faces.map(f => f.id), roles: [], designSystemId: null, deletedAt: faces[0]!.trashedAt });
      }
    }
    const added = new Set(add.map(identOf));
    if (!drop.size && !add.length && !replace.size) return { entries, added };
    const profile = await fresh.profile.get();
    const next = [...add, ...(profile.trash ?? [])
      .filter(e => !drop.has(identOf(e)))
      .map(e => replace.get(identOf(e)) ?? e)];
    await host.profile.set({ ...profile, trash: next });
    notifyTrashChanged();
    return { entries: next, added };
  }

  /** The reconciled entries (see reconcile). */
  async function list(opts: { sessions?: boolean } = {}): Promise<TrashEntry[]> {
    return (await reconcile(opts)).entries;
  }

  /** Move saved sessions to the Trash. `labelOf` gives a row the name the calling
   *  view shows; otherwise the label, file name or tool id is used. Slots already
   *  in the Trash are skipped. Returns the entries made, for the Undo toast. */
  async function trashSessions(slots: readonly string[], labelOf?: (slot: string) => string | undefined): Promise<TrashedSession[]> {
    const [folders, rows] = await Promise.all([store.list(), host.state.list().catch(() => [] as ReadonlyArray<TrashStateRow>)]);
    const bySlot = new Map(rows.map(r => [r.slot, r]));
    const taken = new Set(rows.map(r => r.slot));
    const made: TrashedSession[] = [];
    for (const slot of slots) {
      if (!slot || isTrashedSlot(slot)) continue;
      const row = bySlot.get(slot);
      // A slot that is not stored has nothing to move, so it gets no entry.
      if (!row) continue;
      const parentId = store.folderOfRef(folders, slot);
      const label = labelOf?.(slot) || row?.label || row?.filename || row?.toolId || slot;
      const target = trashSlotFor(slot, Date.now(), taken);
      const entry: TrashedSession = { kind: 'session', slot: target.slot, originalSlot: slot, label, parentId, deletedAt: isoAt(target.at) };
      // The entry is written before the record moves (review S9), so no other
      // tab finds the record without one; and the slot carries the time anyway.
      await store.trashAdd(entry);
      if (!(await moveRecord(slot, target.slot))) { await store.trashDropEntry(entry); continue; }
      taken.add(target.slot);
      if (parentId) await store.moveItem(slot, null, 'session');
      made.push(entry);
    }
    if (made.length) notifyTrashChanged();
    return made;
  }

  /** Move a folder, its sub-folders and their sessions to the Trash as one entry.
   *  Images inside are references and stay in Assets. Null when the folder is gone. */
  async function trashFolder(id: string): Promise<TrashedFolder | null> {
    const folders = await store.list();
    const folder = folders.find(f => f.id === id);
    if (!folder) return null;
    const tree = await store.detachSubtree(id);
    if (!tree) return null;
    const taken = new Set((await host.state.list().catch(() => [] as ReadonlyArray<TrashStateRow>)).map(r => r.slot));
    const at = Date.now();
    // Every member is stamped with the folder entry's own time, so ownsSlot can
    // tell this entry's records from any other entry's.
    const planned = tree.flatMap((f: Folder) => f.items.filter(i => i.type === 'session').map(i => i.ref))
      .filter(ref => !taken.has(stampedTrashSlot(ref, at)))
      .map(ref => ({ originalSlot: ref, slot: stampedTrashSlot(ref, at) }));
    const entry: TrashedFolder = { kind: 'folder', tree, rootId: id, name: folder.name, sessions: planned, deletedAt: isoAt(at) };
    await store.trashAdd(entry);
    const moved: Array<{ originalSlot: string; slot: string }> = [];
    for (const m of planned) if (await moveRecord(m.originalSlot, m.slot)) moved.push(m);
    const final: TrashedFolder = { ...entry, sessions: moved };
    if (moved.length !== planned.length) await store.trashReplaceEntry(entry, final);
    notifyTrashChanged();
    return final;
  }

  /** Move uploads to the Trash. Throws when the host cannot mark an upload
   *  (every web host can), so a caller never mistakes that for a delete. */
  async function trashAssets(refs: readonly TrashAssetInput[]): Promise<TrashedAsset[]> {
    const mark = host.assets._setUserAssetTrashed;
    if (!mark) throw new Error('This host has no Trash for uploads.');
    const folders = await store.list();
    const made: TrashedAsset[] = [];
    for (const ref of refs) {
      const deletedAt = nowIso();
      // Only a live upload is marked: one already in the Trash keeps its date.
      if (!(await mark.call(host.assets, ref.id, deletedAt, { expect: null }))) continue;
      const parentId = store.folderOfRef(folders, ref.id);
      if (parentId) await store.moveItem(ref.id, null, 'image');
      const entry: TrashedAsset = {
        kind: 'asset', id: ref.id, label: ref.name || ref.id.split('/').pop() || ref.id,
        ...(ref.type ? { assetType: ref.type } : {}), parentId, deletedAt,
      };
      await store.trashAdd(entry);
      made.push(entry);
    }
    if (made.length) notifyTrashChanged();
    return made;
  }

  /** Move a font family to the Trash: every face is marked, and the entry keeps
   *  the roles it served, the design system they were in, and what the delete
   *  leaves in each role. The caller (user-fonts.ts trashUserFont) unloads the
   *  faces and releases the roles. */
  async function trashFont(input: {
    family: string; assetIds: readonly string[]; roles: readonly TrashFontRole[]; designSystemId: string | null;
    released?: TrashedFont['released'];
  }): Promise<TrashedFont | null> {
    const mark = host.assets._setUserAssetTrashed;
    if (!mark) throw new Error('This host has no Trash for fonts.');
    const deletedAt = nowIso();
    const marked: string[] = [];
    for (const id of input.assetIds) if (await mark.call(host.assets, id, deletedAt, { expect: null })) marked.push(id);
    if (!marked.length) return null;
    const entry: TrashedFont = {
      kind: 'font', family: input.family, label: input.family, assetIds: marked,
      roles: [...input.roles], designSystemId: input.designSystemId,
      ...(input.released ? { released: { ...input.released } } : {}), deletedAt,
    };
    await store.trashAdd(entry);
    notifyTrashChanged();
    return entry;
  }

  /**
   * Put an entry back where it was: record, slot, history and folder membership.
   * Acts only on what the entry still owns: an item restored or deleted in the
   * meantime (another tab, an Undo) answers `gone` and nothing moves (review
   * B3, S8); a folder whose members could not all come back answers `partial`
   * (review S4).
   */
  async function restore(entry: TrashEntry): Promise<TrashRestoreResult> {
    const live = async (id: string | null): Promise<boolean> => !!id && (await store.list()).some(f => f.id === id);
    const gone = async (): Promise<TrashRestoreResult> => { await store.trashDropEntry(entry); notifyTrashChanged(); return { status: 'gone', missing: 0 }; };
    let missing = 0;
    if (entry.kind === 'session') {
      if (!(await ownsSlot(entry, entry.slot))) return gone();
      let slot = entry.originalSlot;
      if (!(await moveRecord(entry.slot, slot))) {
        // The original slot was taken meanwhile: restore beside that slot rather than lose the work.
        slot = `${entry.originalSlot}:${Date.now().toString(36)}`;
        if (!(await moveRecord(entry.slot, slot))) throw new Error('This item could not be restored.');
      }
      if (await live(entry.parentId)) await store.moveItem(slot, entry.parentId, 'session');
    } else if (entry.kind === 'folder') {
      const current = await store.trashList();
      const renamed = new Map<string, string>();
      const lost = new Set<string>();
      for (const m of entry.sessions) {
        if (!(await ownsSlot(entry, m.slot, current))) { lost.add(m.originalSlot); continue; }
        if (await moveRecord(m.slot, m.originalSlot)) continue;
        const beside = `${m.originalSlot}:${Date.now().toString(36)}`;
        if (await moveRecord(m.slot, beside)) renamed.set(m.originalSlot, beside);
        else lost.add(m.originalSlot);
      }
      missing = lost.size;
      const remap = (items: readonly FolderItem[]): FolderItem[] => items
        .filter(i => !(i.type === 'session' && lost.has(i.ref)))
        .map(i => (i.type === 'session' && renamed.has(i.ref) ? { ...i, ref: renamed.get(i.ref)! } : i));
      await store.restoreSubtree(entry.tree.map(f => ({ ...f, items: remap(f.items) })));
    } else if (entry.kind === 'asset') {
      // Unmark only while it still carries this entry's mark.
      if (!(await host.assets._setUserAssetTrashed?.(entry.id, null, { expect: entry.deletedAt }))) return gone();
      if (await live(entry.parentId)) await store.moveItem(entry.id, entry.parentId, 'image');
    } else {
      // A font: its faces back in the library and the document, then its roles
      // back in its design system when that system is still here.
      let back = 0;
      for (const id of entry.assetIds) if (await host.assets._setUserAssetTrashed?.(id, null, { expect: entry.deletedAt })) back++;
      if (!back) return gone();
      missing = entry.assetIds.length - back;
      const hooks = await fontHooks();
      await hooks.refresh().catch(error => host.log?.('warn', 'trash: font refresh failed', { error: String(error) }));
      if (entry.roles.length) {
        await hooks.restoreRoles(entry.family, entry.roles, entry.designSystemId, entry.released)
          .catch(error => host.log?.('warn', 'trash: font roles not restored', { family: entry.family, error: String(error) }));
      }
    }
    await store.trashDropEntry(entry);
    notifyTrashChanged();
    return { status: missing ? 'partial' : 'restored', missing };
  }

  /** Remove a gone upload from the Assets view's per-asset lists, one write. */
  async function pruneAssetOverlays(ids: readonly string[]): Promise<void> {
    const bases = new Set(ids.map(baseId));
    const profile = await fresh.profile.get() as OverlayProfile & Record<string, unknown>;
    let changed = false;
    const next: Record<string, unknown> = { ...profile };
    for (const key of ['favouriteAssets', 'hiddenAssets'] as const) {
      const list = profile[key];
      if (!Array.isArray(list)) continue;
      const kept = list.filter(v => !bases.has(String(v)));
      if (kept.length !== list.length) { next[key] = kept; changed = true; }
    }
    const cats = profile.assetCategories;
    if (cats && typeof cats === 'object' && [...bases].some(b => b in (cats as Record<string, unknown>))) {
      const copy = { ...(cats as Record<string, unknown>) };
      for (const b of bases) delete copy[b];
      next.assetCategories = copy;
      changed = true;
    }
    if (changed) await host.profile.set(next as Parameters<FolderHost['profile']['set']>[0]);
  }

  /** Delete one upload or face for good, but only while it still carries this
   *  Trash mark. False (and nothing deleted) when it does not. */
  async function deleteMarked(id: string, trashedAt: string): Promise<boolean> {
    if (host.assets._deleteTrashedUserAsset) return host.assets._deleteTrashedUserAsset(id, trashedAt);
    const rows = await host.assets._listTrashedUserAssets?.().catch(() => null);
    if (!rows?.some(r => r.id === id && r.trashedAt === trashedAt)) return false;
    await host.assets._deleteUserAsset(id);
    return true;
  }

  /**
   * Delete an entry's data for good (Delete forever, Empty Trash, the sweep).
   * Every item is re-read and confirmed still in the Trash under this entry
   * immediately before it goes (review B3, B5): an item restored meanwhile, or a
   * trash slot another entry owns, is left alone, and the stale entry is dropped
   * (`gone`). A session's history goes with its record. An upload or face a saved
   * creation still uses is refused by the bridge; it stays in the Trash and a
   * TrashPurgeError says why.
   */
  async function purge(entry: TrashEntry): Promise<'purged' | 'gone'> {
    let deleted = 0;
    if (entry.kind === 'session') {
      if (await ownsSlot(entry, entry.slot)) { await host.state.delete(entry.slot); deleted++; }
    } else if (entry.kind === 'folder') {
      const current = await store.trashList();
      for (const m of entry.sessions) {
        if (await ownsSlot(entry, m.slot, current)) { await host.state.delete(m.slot); deleted++; }
      }
      // A folder entry with no member left is still a real deletion of its folder records.
      if (!deleted && current.some(e => identOf(e) === identOf(entry)) && !(await store.list()).some(f => f.id === entry.rootId)) deleted = 1;
    } else if (entry.kind === 'asset') {
      try { if (await deleteMarked(entry.id, entry.deletedAt)) deleted++; }
      catch (error) {
        host.log?.('warn', 'trash: upload purge refused', { id: entry.id, error: String(error) });
        throw new TrashPurgeError(String((error as Error)?.message ?? error), entry);
      }
      if (deleted) {
        await pruneAssetOverlays([entry.id]).catch(() => { /* overlays are best-effort */ });
        // The measured waveform is keyed by asset id, and no other path deletes the waveform.
        await import('./audio-peaks.ts').then(m => m.deletePeaks(entry.id)).catch(() => { /* no peaks store */ });
      }
    } else {
      // A font: every face still marked by this entry goes. A face a saved
      // design pins (its text keeps the exact font version) is refused by the
      // bridge; those stay in the entry.
      const kept: string[] = [];
      let reason = '';
      for (const id of entry.assetIds) {
        try { if (await deleteMarked(id, entry.deletedAt)) deleted++; }
        catch (error) { kept.push(id); reason ||= String((error as Error)?.message ?? error); }
      }
      if (deleted) await fontHooks().then(h => h.refresh()).catch(() => { /* the faces were unloaded when trashed */ });
      if (kept.length) {
        const shrunk: TrashedFont = { ...entry, assetIds: kept };
        await store.trashReplaceEntry(entry, shrunk);
        notifyTrashChanged();
        throw new TrashPurgeError(reason, shrunk);
      }
    }
    await store.trashDropEntry(entry);
    notifyTrashChanged();
    return deleted ? 'purged' : 'gone';
  }

  /** Delete every entry for good. Entries a purge refuses stay, and are counted;
   *  an entry whose item had already left the Trash is only dropped. */
  async function empty(): Promise<{ purged: number; kept: number }> {
    let purged = 0, kept = 0;
    for (const entry of await list()) {
      try { if ((await purge(entry)) === 'purged') purged++; } catch { kept++; }
    }
    return { purged, kept };
  }

  /** Age out entries past the 30-day retention, silently. Never an entry the
   *  same pass just rebuilt (review B4): it waits for a later visit. Returns how
   *  many went. */
  async function sweep(now = Date.now()): Promise<number> {
    const cutoff = now - TRASH_RETENTION_MS;
    const { entries, added } = await reconcile();
    let gone = 0;
    for (const entry of entries) {
      if (added.has(identOf(entry)) || +new Date(entry.deletedAt) >= cutoff) continue;
      try { if ((await purge(entry)) === 'purged') gone++; } catch { /* stays until whatever uses it is gone */ }
    }
    return gone;
  }

  /** Bytes the Trash holds: trashed session records plus trashed uploads. */
  async function bytes(entries?: readonly TrashEntry[]): Promise<number> {
    const list_ = entries ?? await list();
    const sizes = await host.state.sizes?.().catch(() => ({} as Record<string, number>)) ?? {};
    const assets = await host.assets._listTrashedUserAssets?.().catch(() => [] as TrashedUserAssetRow[]) ?? [];
    const assetBytes = new Map(assets.map(a => [a.id, a.bytes]));
    let n = 0;
    for (const e of list_) {
      if (e.kind === 'session') n += sizes[e.slot] ?? 0;
      else if (e.kind === 'folder') for (const m of e.sessions) n += sizes[m.slot] ?? 0;
      else if (e.kind === 'asset') n += assetBytes.get(e.id) ?? 0;
      else for (const id of e.assetIds) n += assetBytes.get(id) ?? 0;
    }
    return n;
  }

  return { store, list, trashSessions, trashFolder, trashAssets, trashFont, restore, purge, empty, sweep, bytes };
}

export type Trash = ReturnType<typeof createTrash>;

/** True when two entries are the same Trash event (key and delete time). */
export const sameTrashEntry = (a: TrashEntry, b: TrashEntry): boolean => identOf(a) === identOf(b);
