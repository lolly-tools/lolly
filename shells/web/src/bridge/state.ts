// SPDX-License-Identifier: MPL-2.0
/**
 * StateAPI - saved tool states.
 *
 * Stored per-slot in IndexedDB. The slot key is user-facing (they name their
 * saves); the toolId/version are recorded for forward compatibility - when a
 * tool bumps a major version, the runtime can decide whether to migrate or
 * warn the user.
 */

import { indexSavedWork } from './history-index.ts';
import { sessionEmojiStamp, sessionRightsDecisions, sessionVersionStamp, migrateSessionRecord } from '../../../../engine/src/session-record.ts';
import type { SessionEmojiStamp } from '../../../../engine/src/session-record.ts';
import type { RightsDecisionV1 } from '@lolly-tools/core/rights-v1';
import type { StateAPI, StateEntry } from '@lolly-tools/core/host-v1';
import type { RevisionHistoryAPI, RevisionStore } from './revision-history.ts';

/** The saved payload: input values plus the runtime's `__`-prefixed markers. */
export interface SavedStateData {
  __toolArtifact?: string;
  __designTool?: import('@lolly-tools/core/design-tool-v1').DesignToolDraftV1;
  __toolId?: string;
  __toolVersion?: string;
  __label?: string;
  __export_filename?: string;
  /** Every other key is a persisted input value (written from the live model). */
  [inputId: string]: unknown;
}

export interface StateRecord {
  slot: string;
  toolId: string | undefined;
  toolVersion: string | undefined;
  label: string | undefined;
  data: SavedStateData;
  thumb: string | null;
  updatedAt: string;
  /** First-save time, preserved across re-saves (save() rewrites updatedAt but
   *  carries this forward) - the "Date added" sort key. Optional: rows written
   *  before it existed have none; readers fall back to the slot's minted
   *  timestamp (`<toolId>:<Date.now()>`) and then updatedAt. */
  createdAt?: string;
  documentId?: string;
  openedAt?: string;
  historyKey?: string[];
  /** Record-layout version + the engine that wrote it (see engine/session-record.ts).
   *  Optional so records written before versioning still type-check on read. */
  formatVersion?: number;
  engineVersion?: string;
  /** Which design system the session was made with (plans/186 section 3.8) - the
   *  active record's id and label at save time. Optional: rows written before
   *  this existed, and devices with no registry, have none. */
  designSystem?: { id: string; label: string };
  /** When this work was last explicitly saved (plan 277 P7): what the newer-copy
   *  rule in lib/backup-sessions.ts compares. Unlike updatedAt it does not move for
   *  a recovery draft, an automatic checkpoint, a rename or a Trash move. Absent
   *  on records written before it existed; readers fall back to updatedAt. */
  savedAt?: string;
  /** Which emoji set and brand treatment the session's text was drawn with
   *  (plans/252), as the two reserved params verbatim. Optional: a session saved
   *  before this existed, or with no set chosen, carries none and reopens on the
   *  person's own preference. */
  emoji?: SessionEmojiStamp;
  /** The licence choices and recorded permissions a person made about this
   *  document's sources (plan 253). Optional: a session with nothing to decide,
   *  and every session saved before this existed, carries none. */
  rightsDecisions?: RightsDecisionV1[];
}

/**
 * The emoji stamp the next save writes. One mounted tool at a time, so one
 * holder, set by the tool view when the chosen set changes and cleared on
 * unmount. A registration rather than a database read (the design-system stamp's
 * shape) because this is DOCUMENT state: only the view that is editing the
 * document knows what it chose.
 */
let emojiStampSource: SessionEmojiStamp | null = null;

/** Record the set the current document is drawn with, or clear it with null. */
export function setSessionEmojiStamp(stamp: SessionEmojiStamp | null): void {
  emojiStampSource = stamp?.emoji ? { ...stamp, emojifx: stamp.emojifx ?? '' } : null;
}

/** The licence decisions the next save writes, registered the same way and for
 *  the same reason: only the view editing the document knows what was chosen. */
let rightsDecisionSource: RightsDecisionV1[] | null = null;

/** Record the decisions made about this document's sources, or clear them with null. */
export function setSessionRightsDecisions(decisions: readonly RightsDecisionV1[] | null): void {
  rightsDecisionSource = decisions?.length ? decisions.map((decision) => ({ ...decision })) : null;
}

/** Where migrateSessionRecord reports a record from a newer app build. */
function stateLog(level: 'warn' | 'info', message: string, meta?: Record<string, unknown>): void {
  (level === 'warn' ? console.warn : console.info)(`[lolly:state] ${message}`, meta ?? '');
}

/** The slice of the idb database this API touches (the 'state' object store). */
export interface StateDb {
  put(store: 'state', record: StateRecord): Promise<unknown>;
  get(store: 'state', slot: string): Promise<StateRecord | undefined>;
  /** The two reads the design-system stamp makes (plans/186); both optional on a
   *  narrow test stub, which then saves unstamped records as before. */
  get(store: 'profile' | 'design-systems', key: string): Promise<unknown>;
  getAll(store: 'state'): Promise<StateRecord[]>;
  delete(store: 'state', slot: string): Promise<void>;
}

/** The web shell's state surface: HostV1's StateAPI plus shell extensions. */
export interface WebStateAPI extends StateAPI {
  /** Device-local history. Absent for ephemeral guests and native drivers until
   * they implement an atomic revision transaction. Never inferred from shell type. */
  history?: RevisionHistoryAPI;
  save(slot: string, data: SavedStateData, thumb?: string | null): Promise<void>;
  /** A save that keeps the session's own save time instead of stamping now: a
   *  backup import writes restored work through this, so the newer-copy rule
   *  (lib/backup-sessions.ts) compares when the work was saved, not when it was
   *  imported. Optional; a shell without one falls back to save(). */
  restore?(slot: string, data: SavedStateData, thumb: string | null, updatedAt: string, savedAt?: string): Promise<void>;
  load(slot: string): Promise<SavedStateData | null>;
  list(): Promise<(StateEntry & { filename: string | null; thumb: string | null; createdAt?: string; openedAt?: string; savedAt?: string })[]>;
  /** Bytes used per slot (rough: the JSON-serialised record size). */
  sizes(): Promise<Record<string, number>>;
  /** Blob keys (id:format:version) referenced across all saved sessions -
   *  used by sync to avoid evicting on-demand blobs a session still needs. */
  _getAssetRefs(): Promise<Set<string>>;
  /** The emoji set a saved session was made with (plans/252), or null when it
   *  names none. Optional on the surface so a shell whose state lives elsewhere
   *  (the Tauri filesystem bridge) is not forced to grow one before it can. */
  emojiStamp?(slot: string): Promise<SessionEmojiStamp | null>;
  /** The licence decisions a saved session recorded (plan 253), or null when it
   *  recorded none. Optional on the surface for the same reason as the stamp above. */
  rightsDecisions?(slot: string): Promise<RightsDecisionV1[] | null>;
  /** Remove every saved session this bridge holds, for "Clear all my data"
   *  (plan 277 P2). The Tauri filesystem bridge implements it over its
   *  saved-state files; the web bridge needs none, because that clear empties
   *  every IndexedDB store the app owns. */
  _clearAll?(): Promise<void>;
}

/**
 * Which design system a session was made with (plans/186 section 3.8): the
 * active record's id and label, read straight off the same database so the
 * bridge needs no host. Absent on a device with no registry yet, and never a
 * reason for a save to fail.
 */
async function activeDesignSystemStamp(db: StateDb): Promise<{ designSystem?: { id: string; label: string } }> {
  try {
    const id = await db.get('profile', 'active-design-system');
    if (typeof id !== 'string' || !id) return {};
    const record = await db.get('design-systems', id) as { id?: string; label?: string } | undefined;
    if (!record || typeof record.label !== 'string') return {};
    return { designSystem: { id, label: record.label } };
  } catch { return {}; }
}

/** How a write sets the record's savedAt: 'now' for an explicit save, 'carry'
 *  for a write that is not one (a recovery draft, an automatic checkpoint),
 *  'auto' for save(), which counts as a save only when the work changed, and a
 *  given time for a restore. */
type SavedAtRule = 'now' | 'carry' | 'auto' | { time: string };

/** The work a save time is about: the document without its name, so a rename
 *  (which writes `__label`, and `__export_filename` for a single-tool session)
 *  is not new work. */
export function workOf(data: unknown): string {
  if (!data || typeof data !== 'object') return JSON.stringify(data ?? null);
  const { __label: _label, __export_filename: _filename, ...work } = data as Record<string, unknown>;
  return JSON.stringify(work);
}

export function createStateAPI(db: StateDb, revisions?: RevisionStore): WebStateAPI {
  const makeRecord = async (slot: string, data: SavedStateData, thumb: string | null, at?: string, saved: SavedAtRule = 'auto'): Promise<StateRecord> => {
    const prior = await db.get('state', slot).catch(() => undefined);
    const now = at ?? new Date().toISOString();
    const priorSaved = prior ? prior.savedAt ?? prior.updatedAt : undefined;
    const savedAt = typeof saved === 'object' ? saved.time
      : saved === 'now' ? now
        : saved === 'carry' ? priorSaved
          : prior && workOf(prior.data) === workOf(data) ? priorSaved : now;
    return { slot, toolId: data.__toolId, toolVersion: data.__toolVersion, label: data.__label,
      data, thumb, updatedAt: now, createdAt: prior?.createdAt ?? now, openedAt: prior?.openedAt,
      ...(savedAt ? { savedAt } : {}),
      ...sessionVersionStamp(), ...(await activeDesignSystemStamp(db)),
      // Carried from the prior record when nothing is mounted (a save from the
      // Projects view re-writes a session this tab never opened), so re-saving
      // never quietly strips the set the work was drawn with.
      ...(emojiStampSource ? { emoji: emojiStampSource } : prior?.emoji ? { emoji: prior.emoji } : {}),
      // Carried from the prior record for the same reason as the stamp above: a
      // re-save from a view that is not editing this document must not quietly
      // drop the licence choice someone made in it.
      ...(rightsDecisionSource ? { rightsDecisions: rightsDecisionSource }
        : prior?.rightsDecisions ? { rightsDecisions: prior.rightsDecisions } : {}) };
  };
  return {
    ...(revisions ? { history: {
      ...revisions,
      // A draft or an automatic checkpoint is not a save: the record keeps its save time.
      recovery: { ...revisions.recovery, save: async (slot, data, options) => revisions.recovery.write(await makeRecord(slot, data, null, undefined, 'carry'), options) },
      checkpoint: async (slot, data, options) => revisions.commit(await makeRecord(slot, data, null, undefined, options.reason === 'save' ? 'now' : 'carry'), options),
    } satisfies RevisionHistoryAPI } : {}),
    async save(slot, data, thumb = null) {
      const record = await makeRecord(slot, data, thumb);
      if (revisions) await revisions.replace(record);
      else await db.put('state', indexSavedWork(record));
    },

    async restore(slot, data, thumb, updatedAt, savedAt) {
      const at = Number.isFinite(Date.parse(updatedAt)) ? updatedAt : undefined;
      const saved = savedAt && Number.isFinite(Date.parse(savedAt)) ? savedAt : at;
      const record = await makeRecord(slot, data, thumb, at, saved ? { time: saved } : 'auto');
      if (revisions) await revisions.replace(record);
      else await db.put('state', indexSavedWork(record));
    },

    async load(slot) {
      const record = await db.get('state', slot);
      // Read the record's version stamps through the shared migrate-or-warn
      // branch (engine/session-record.ts) rather than reaching for `.data`
      // directly - records predating versioning migrate as v0 (a no-op today),
      // and a record written by a newer app is read as-is but reported.
      return migrateSessionRecord(record, stateLog) as SavedStateData | null;
    },

    async list() {
      const all = await db.getAll('state');
      return all.map(r => ({
        slot: r.slot,
        toolId: r.toolId!,
        toolVersion: r.toolVersion!,
        label: r.label,
        filename: r.data?.__export_filename || null,
        thumb: r.thumb ?? null,
        updatedAt: r.updatedAt,
        ...(r.createdAt ? { createdAt: r.createdAt } : {}),
        ...(r.savedAt ? { savedAt: r.savedAt } : {}),
        // When the web app last reopened this item in a tool (revision-history
        // open()). Absent for work never reopened, and on hosts that do not record
        // opens, so a caption reads "Last opened" only where one was recorded.
        ...(r.openedAt ? { openedAt: r.openedAt } : {}),
        ...(r.designSystem ? { designSystem: r.designSystem } : {}),
      }));
    },

    async emojiStamp(slot) {
      // Read off the RECORD, not the saved data: the stamp is bookkeeping about
      // the document, not one of its values, so it never rides in the model.
      const record = await db.get('state', slot).catch(() => undefined);
      return sessionEmojiStamp(record);
    },

    async rightsDecisions(slot) {
      // Off the RECORD, like the stamp above: a decision is bookkeeping about
      // the document's sources, not one of the document's values.
      const record = await db.get('state', slot).catch(() => undefined);
      return sessionRightsDecisions(record);
    },

    async delete(slot) {
      if (revisions) await revisions.delete(slot);
      else await db.delete('state', slot);
    },

    async sizes() {
      const all = await db.getAll('state');
      const result: Record<string, number> = {};
      for (const r of all) {
        result[r.slot] = new Blob([JSON.stringify(r)]).size;
      }
      return result;
    },

    // Returns the set of blob keys (id:format:version) referenced across all saved sessions.
    // Used by sync to avoid evicting on-demand blobs that a session still needs.
    async _getAssetRefs() {
      const { collectAssetRefs } = await import('./asset-ref-collector.ts');
      const all = await db.getAll('state');
      const refs = new Set<string>();
      for (const record of all) collectAssetRefs(record.data, refs);
      if (revisions) for (const ref of await revisions.assetRefs()) refs.add(ref);
      return refs;
    },
  };
}
