// SPDX-License-Identifier: MPL-2.0
/**
 * Filesystem-backed state implementation shared by BOTH Tauri shells.
 *
 * It replaces the web shell's IndexedDB state bridge (shells/web/src/bridge/state.ts)
 * at build time: each Tauri shell's `bridge-overrides/state.ts` is substituted for
 * that module by the resolveId plugin in its vite.config.js, and those two override
 * files are now thin platform seams that call `createFsStateAPI` here. The API
 * surface must stay in sync with the web bridge - tools, the engine, the gallery,
 * the profile page and catalog sync never see which implementation is running, so a
 * missing method (e.g. sizes) crashes boot. That sync used to be comment-only; the
 * return type below is now the web bridge's own `WebStateAPI`, imported type-only,
 * so a method added there and forgotten here fails `pnpm run typecheck` instead of
 * crashing at boot on a device. Type-only, so nothing from the web shell is pulled
 * into this module at runtime.
 *
 * Storage: <app data dir>/saved-state/<slot>.json, and each session's picture once,
 * by the hash of its bytes, at <app data dir>/saved-state/previews/<key>.<ext>
 * (plan 373). The record carries a short `preview` reference. A picture file is
 * written and read back before any record points at the file, so a record never
 * points at a file that is not there. Older desktop builds list only `*.json` names, so the
 * `previews` directory is invisible to them; a record they read with no `thumb`
 * shows the tool icon and opens as usual.
 *
 * WHY THIS FILE LIVES IN THE PARENT REPO, AND WHY IT TAKES AN `fs` ADAPTER
 * Desktop and mobile previously carried byte-identical copies of this logic, so a
 * bug fix had to be applied twice with nothing enforcing it. The two Tauri shells
 * are separate pnpm projects, so neither may import from the other; tauri-shared
 * is the composition root they both already reach into (each vite.config.js roots
 * the build at ../web and answers /tools/ and /catalog/ through the content
 * resolver), so shared code belongs here.
 *
 * The directory is named `bridge-overrides/` like the per-shell ones so that tooling
 * keyed on the `shells/<shell>/bridge-overrides` wildcard keeps covering this file:
 * the tracker and DNS-resolver greps in docs/verify-yourself.md, and the Biome
 * exclusion for the hand-written override modules. Anything that lists the two shells'
 * override dirs LITERALLY still needs this one added by hand - tests/no-trackers.test.ts
 * is the one that does.
 *
 * The parent repo cannot import `@tauri-apps/plugin-fs`, though: the Tauri shells
 * are NOT npm workspaces, so that package is installed only inside each shell's own
 * node_modules and a bare specifier from this directory would not resolve. Hence the
 * inversion - each shell imports the plugin itself and passes in a small bound `fs`
 * adapter. That adapter is also the per-platform seam the mobile fork was kept for:
 * mobile can swap in iCloud sync or Android scoped storage by changing its adapter
 * (or by overriding a method on the returned object) without forking this logic.
 *
 * The `fs` adapter takes paths relative to the app data dir:
 *   exists(path)              → Promise<boolean>
 *   mkdirRecursive(path)      → Promise<void>
 *   readTextFile(path)        → Promise<string>
 *   writeTextFile(path, text) → Promise<void>
 *   writeDocumentAtomic?(path, text) → Promise<void>   (crash-safe; see below)
 *   readDirNames(path)        → Promise<string[]>   (entry names, not entries)
 *   remove(path)              → Promise<void>
 *   readFile?(path)           → Promise<Uint8Array>  (picture files; optional)
 *   writeFile?(path, bytes)   → Promise<void>        (picture files; optional)
 *
 * Without readFile and writeFile a picture stays on the record as a data URL, the
 * way every record carried it before plan 373.
 */

import { stripAssetModifiers, sessionVersionStamp, migrateSessionRecord, encodeFsToken } from '@lolly/engine';
import { assetDependency } from '../../../engine/src/asset-version.ts';
import { textFontAssetIds } from '../../../engine/src/text-assets.ts';
import { sessionPreviewRef } from '../../../engine/src/session-record.ts';
import {
  decodePictureDataUrl, pictureDataUrl, previewContentKey, previewFileExt, previewRefFor, readPreviewRef,
  type SessionPreviewRef,
} from '../../../engine/src/session-preview.ts';
import type { SavedStateData, WebStateAPI } from '../../web/src/bridge/state.ts';
import type { PictureInput, PreparedPicture } from '../../web/src/bridge/preview-store.ts';

/**
 * The slice of a filesystem this module needs, paths relative to the app data dir.
 * Each Tauri shell binds it to `@tauri-apps/plugin-fs` against its own base dir - 
 * see the header for why the dependency is inverted.
 */
export interface StateFs {
  exists(path: string): Promise<boolean>;
  mkdirRecursive(path: string): Promise<void>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, text: string): Promise<void>;
  /**
   * Crash-safe write: the destination ends up whole with either its old or its
   * new content, even if the app dies mid-save. Shells bind it to the native
   * `write_document_atomic` command. Optional so tests and any adapter without
   * the command still work; the fallback is `writeDocument` below.
   */
  writeDocumentAtomic?(path: string, text: string): Promise<void>;
  /** Entry NAMES, not entry objects - all this module reads. */
  readDirNames(path: string): Promise<string[]>;
  remove(path: string): Promise<void>;
  /** Binary reads and writes for picture files. Optional: without them a picture
   *  stays on its record as a data URL. */
  readFile?(path: string): Promise<Uint8Array>;
  writeFile?(path: string, bytes: Uint8Array): Promise<void>;
}

/** One saved session as written to disk. Mirrors the web bridge's StateRecord;
 *  version fields are optional because records predating versioning lack them. */
interface FsStateRecord {
  slot: string;
  toolId: string | undefined;
  toolVersion: string | undefined;
  label: string | undefined;
  data: SavedStateData;
  /** A legacy data URL: records written before plan 373, and any picture this
   *  device could not write as a file. */
  thumb: string | null;
  /** The picture by reference, its bytes under saved-state/previews/. */
  preview?: SessionPreviewRef;
  updatedAt: string;
  /** First-save time, carried forward across re-saves (mirrors the web bridge) - 
   *  the "Date added" sort key. Optional: older files have none. */
  createdAt?: string;
  /** When this work was last explicitly saved (mirrors the web bridge): what the
   *  newer-copy import rule compares. A rename or a move keeps the time. Optional:
   *  older files have none, and readers fall back to updatedAt. */
  savedAt?: string;
  formatVersion?: number;
  engineVersion?: string;
}

/** A record as parsed back off disk: JSON.parse output, so every field is
 *  untrusted. Read defensively - a hand-edited or truncated file must not throw
 *  past the try/catch that wraps each read. */
type ParsedRecord = Partial<FsStateRecord>;

const STATE_DIR = 'saved-state';
const PREVIEW_DIR = `${STATE_DIR}/previews`;
/** Pictures let go of before a sweep of the picture files is due. */
const SWEEP_AFTER = 20;

const previewPath = (ref: Pick<SessionPreviewRef, 'key' | 'type'>): string => `${PREVIEW_DIR}/${ref.key}.${previewFileExt(ref.type)}`;

function isPrepared(value: unknown): value is PreparedPicture {
  return !!value && typeof value === 'object' && (value as PreparedPicture).bytes instanceof Uint8Array && !!readPreviewRef((value as PreparedPicture).ref);
}
// Written once the legacy-filename migration has completed cleanly (below), so it
// never re-walks the directory on subsequent launches. Not a `.json`, so the
// record readers skip it.
// MUST NOT begin with a dot. tauri-plugin-fs defaults require_literal_leading_dot
// to `cfg!(unix)` - true on macOS and Android, so this bites both shells - and the
// `$APPDATA/**` glob behind fs:scope-appdata-recursive therefore cannot match a
// dotfile: every access to one is rejected as "forbidden path". As `.slotname-v1`
// this rejection propagated out of ensureMigrated() and failed EVERY state call, so
// the shell could not boot.
const MIGRATION_MARKER = `${STATE_DIR}/slotname-v1.marker`;

// Collision-free, cross-platform-safe filename for an arbitrary slot name via
// the engine's reversible percent-encoding codec (encodeFsToken): "Q3 Report",
// "Q3/Report", "Q3+Report", "Q3_Report" and "Björn keynote" all map to DISTINCT
// files - each recoverable to its exact slot. This replaces the old
// `slot.replace(/[^\w.-]/g, '_')`, which collapsed all of those onto one file
// and silently destroyed data (P0-4), and desktop and mobile can no longer
// diverge on it: they share this module, which shares the one engine codec.
function slotFilename(slot: string): string {
  return `${encodeFsToken(slot)}.json`;
}

function slotPath(slot: string): string {
  return `${STATE_DIR}/${slotFilename(slot)}`;
}

/** The work a save time is about: the document without its name, so a rename
 *  is not new work (the web bridge's workOf, kept in step by hand because this
 *  module imports nothing from the web shell at runtime). */
function workOf(data: unknown): string {
  if (!data || typeof data !== 'object') return JSON.stringify(data ?? null);
  const { __label: _label, __export_filename: _filename, ...work } = data as Record<string, unknown>;
  return JSON.stringify(work);
}

const validTime = (value: unknown): string | undefined =>
  typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : undefined;

// Where migrateSessionRecord reports a record written by a newer app build.
function stateLog(level: 'warn' | 'info', message: string, meta?: Record<string, unknown>): void {
  (level === 'warn' ? console.warn : console.info)(`[lolly:state] ${message}`, meta ?? '');
}

/**
 * Write a document, slot or migration file. Goes through the adapter's atomic
 * write when it has one. The plain-write fallback is for adapters without the
 * command (unit tests, older builds): it can leave a truncated file if the app
 * dies mid-write, which is the failure the atomic path exists to prevent.
 */
function writeDocument(fs: StateFs, path: string, text: string): Promise<void> {
  return fs.writeDocumentAtomic ? fs.writeDocumentAtomic(path, text) : fs.writeTextFile(path, text);
}

/**
 * Build the state API over an `fs` adapter. One instance per shell; the migration
 * memo below is per instance, matching the old module-level `migrationPromise`.
 */
export function createFsStateAPI(fs: StateFs): WebStateAPI {
  async function ensureDir(): Promise<void> {
    const ok = await fs.exists(STATE_DIR);
    if (!ok) {
      await fs.mkdirRecursive(STATE_DIR);
    }
  }

  // One-time migration from the old lossy filename scheme to the collision-free
  // one. Old files were named by `slot.replace(/[^\w.-]/g, '_')`, so a session
  // named "Q3 Report" lives at `Q3_Report.json` but load() now looks for
  // `Q3%20Report.json` and would never find it. Walk saved-state/, read each
  // record's authoritative `raw.slot`, and rewrite it under the canonical name.
  // (Sessions already lost to a pre-fix collision can't be recovered - only one
  // file survived on disk - but the survivor keeps its true name.) Idempotent and
  // memoised: a clean pass drops a marker so later launches skip the walk.
  let migrationPromise: Promise<void> | null = null;
  function ensureMigrated(): Promise<void> {
    if (!migrationPromise) migrationPromise = migrateLegacyFilenames();
    return migrationPromise;
  }

  async function migrateLegacyFilenames(): Promise<void> {
    await ensureDir();
    // Defence in depth: a marker read must never fail boot. Every state call awaits
    // this, so a rejection here takes the whole shell down. The walk below is
    // idempotent, so treating an unreadable marker as "not migrated" costs at worst
    // a repeated walk per launch.
    try {
      if (await fs.exists(MIGRATION_MARKER)) return;
    } catch { /* fall through and re-walk */ }

    let names: string[];
    try {
      names = await fs.readDirNames(STATE_DIR);
    } catch {
      return;
    }

    let failures = 0;
    for (const name of names) {
      if (!name?.endsWith('.json')) continue;
      try {
        const text = await fs.readTextFile(`${STATE_DIR}/${name}`);
        const raw = JSON.parse(text) as ParsedRecord;
        const slot = raw?.slot;
        if (typeof slot !== 'string' || !slot) continue;
        const canonical = slotFilename(slot);
        if (canonical === name) continue; // already at its collision-free name

        // Move to the canonical name. If a canonical file already exists (a fresh
        // save under the new scheme), keep whichever is newer so migration never
        // resurrects a stale legacy copy over a real one. Two DIFFERENT slots can
        // no longer map to the same canonical name, so this only fires for a true
        // same-slot duplicate.
        if (await fs.exists(`${STATE_DIR}/${canonical}`)) {
          const targetText = await fs.readTextFile(`${STATE_DIR}/${canonical}`);
          const target = JSON.parse(targetText) as ParsedRecord;
          if ((raw.updatedAt ?? '') > (target?.updatedAt ?? '')) {
            await writeDocument(fs, `${STATE_DIR}/${canonical}`, text);
          }
        } else {
          await writeDocument(fs, `${STATE_DIR}/${canonical}`, text);
        }
        await fs.remove(`${STATE_DIR}/${name}`);
      } catch {
        failures++;
      }
    }

    // Only mark done on a fully clean pass; otherwise retry next launch (the walk
    // is idempotent - already-canonical files are skipped instantly).
    if (failures === 0) {
      try {
        await writeDocument(fs, MIGRATION_MARKER, '1');
      } catch { /* retry next launch */ }
    }
  }

  // Read every saved record once. Returns { raw, bytes } per file (bytes = the
  // on-disk JSON size, matching the web shell's Blob-size estimate). Reused by
  // list / sizes / _getAssetRefs so we walk the directory a single way.
  async function readAllRecords(): Promise<{ raw: ParsedRecord; bytes: number }[]> {
    return (await scanRecords()).records;
  }

  /** The same walk, saying whether every record was read. A record that would not
   *  parse still counts as read: any picture key in its text is collected in
   *  `keysInText`, so the picture sweep never takes a file such a record points at.
   *  A directory or file that could not be read leaves `complete` false. */
  async function scanRecords(): Promise<{ records: { raw: ParsedRecord; bytes: number }[]; complete: boolean; keysInText: Set<string> }> {
    await ensureMigrated();
    const keysInText = new Set<string>();
    let names: string[];
    try {
      names = await fs.readDirNames(STATE_DIR);
    } catch {
      return { records: [], complete: false, keysInText };
    }
    const out: { raw: ParsedRecord; bytes: number }[] = [];
    let complete = true;
    for (const name of names) {
      if (!name?.endsWith('.json')) continue;
      let text: string;
      try { text = await fs.readTextFile(`${STATE_DIR}/${name}`); } catch { complete = false; continue; }
      try {
        out.push({ raw: JSON.parse(text) as ParsedRecord, bytes: new Blob([text]).size });
      } catch {
        // Corrupt entries are skipped by every reader, but never treated as naming nothing.
        for (const key of text.match(/[0-9a-f]{32}/g) ?? []) keysInText.add(key);
      }
    }
    return { records: out, complete, keysInText };
  }

  /** One write at a time per session in this window: a save, a delete and the
   *  picture move never interleave their read and write of the same file. */
  const slotQueue = new Map<string, Promise<unknown>>();
  function withSlot<T>(slot: string, run: () => Promise<T>): Promise<T> {
    const prior = slotQueue.get(slot) ?? Promise.resolve();
    const next = prior.catch(() => {}).then(run);
    const settled = next.catch(() => {});
    slotQueue.set(slot, settled);
    void settled.then(() => { if (slotQueue.get(slot) === settled) slotQueue.delete(slot); });
    return next;
  }

  /** Write one record. `times` given (a restore) keeps the session's own update
   *  and save times; otherwise the update time is now, and the save time is now
   *  only when the work changed, so a rename keeps it (matching the web bridge). */
  /** Picture files this window wrote in the last ten minutes, with the time: the
   *  sweep leaves them, since their record may be a moment from being written. */
  const writtenHere = new Map<string, number>();
  const WRITTEN_GRACE_MS = 10 * 60_000;
  /** Picture writes in flight, by key: two saves of the same picture share one write
   *  rather than the second truncating a file the first has just verified. */
  const writing = new Map<string, Promise<boolean>>();

  /** Read a picture file back, or null when it is missing or its bytes do not hash
   *  to its name (a torn write never shows as a picture). */
  async function readPicture(ref: Pick<SessionPreviewRef, 'key' | 'type'>): Promise<Uint8Array | null> {
    if (!fs.readFile) return null;
    try {
      const bytes = await fs.readFile(previewPath(ref));
      return bytes.length && await previewContentKey(bytes) === ref.key ? bytes : null;
    } catch { return null; }
  }

  /** Write a picture file once, then read it back; true only when the file on disk
   *  holds exactly these bytes. Nothing points at it until this answers true. */
  function writePicture(picture: PreparedPicture): Promise<boolean> {
    if (!fs.writeFile || !fs.readFile) return Promise.resolve(false);
    const key = picture.ref.key;
    const inFlight = writing.get(key);
    if (inFlight) return inFlight;
    const write = (async () => {
      try {
        if (await readPicture(picture.ref)) { writtenHere.set(key, Date.now()); return true; }
        if (!await fs.exists(PREVIEW_DIR)) await fs.mkdirRecursive(PREVIEW_DIR);
        writtenHere.set(key, Date.now());
        await fs.writeFile!(previewPath(picture.ref), picture.bytes);
        return !!await readPicture(picture.ref);
      } catch { return false; }
    })();
    writing.set(key, write);
    void write.finally(() => writing.delete(key));
    return write;
  }

  /** A record's picture fields from what a caller handed in: a picture written as a
   *  file and referenced, a reference whose file is here, or a data URL kept as one
   *  (a received picture, or a device whose adapter cannot write files). */
  async function pictureFields(input: PictureInput): Promise<{ thumb: string | null; preview?: SessionPreviewRef } | null> {
    if (input == null) return null;
    if (typeof input === 'string') return decodePictureDataUrl(input) ? { thumb: input } : null;
    if (isPrepared(input)) {
      if (await writePicture(input)) return { thumb: null, preview: input.ref };
      return { thumb: pictureDataUrl(input.bytes, input.ref.type, input.form) };
    }
    const ref = readPreviewRef(input);
    return ref && await readPicture(ref) ? { thumb: null, preview: ref } : null;
  }

  async function writeRecord(slot: string, data: SavedStateData, picture: PictureInput, times?: { updatedAt: string; savedAt: string }): Promise<void> {
    await ensureMigrated();
    await withSlot(slot, () => writeRecordNow(slot, data, picture, times));
  }

  async function writeRecordNow(slot: string, data: SavedStateData, picture: PictureInput, times?: { updatedAt: string; savedAt: string }): Promise<void> {
    // Re-saves reuse the slot: carry the original creation time forward off the
    // existing file (matching the web bridge's IndexedDB read-before-write).
    let prior: ParsedRecord | undefined;
    try {
      const path = slotPath(slot);
      if (await fs.exists(path)) prior = JSON.parse(await fs.readTextFile(path)) as ParsedRecord;
    } catch { /* unreadable prior record - stamp fresh */ }
    const now = times?.updatedAt ?? new Date().toISOString();
    const priorSaved = prior ? validTime(prior.savedAt) ?? validTime(prior.updatedAt) : undefined;
    const sameWork = !!prior && workOf(prior.data) === workOf(data);
    const savedAt = times?.savedAt ?? (prior && priorSaved && sameWork ? priorSaved : now);
    // The picture given, else the prior record's when the work is unchanged (a rename),
    // else none until a capture attaches one (the web bridge's rule).
    const priorRef = prior ? sessionPreviewRef(prior) : null;
    const given = await pictureFields(picture);
    const carried = !given && sameWork && prior
      ? (priorRef ? { thumb: null, preview: priorRef } : typeof prior.thumb === 'string' ? { thumb: prior.thumb } : null)
      : null;
    const fields = given ?? carried ?? { thumb: null };
    const record: FsStateRecord = {
      slot,
      toolId: data.__toolId,
      toolVersion: data.__toolVersion,
      label: data.__label,
      data,
      thumb: fields.thumb,
      ...(fields.preview ? { preview: fields.preview } : {}),
      updatedAt: now,
      createdAt: prior?.createdAt ?? now,
      savedAt,
      ...sessionVersionStamp(),
    };
    await writeDocument(fs, slotPath(slot), JSON.stringify(record, null, 2));
    if (priorRef && priorRef.key !== fields.preview?.key) pictureLeft();
  }

  /** A record let go of a picture file (a new picture, or the session deleted).
   *  After a few of those a sweep is due, so a long-running app does not keep every
   *  picture a session ever had. */
  let leftSinceSweep = 0;
  let sweepTimer: ReturnType<typeof setTimeout> | null = null;
  function pictureLeft(): void {
    if (++leftSinceSweep < SWEEP_AFTER || sweepTimer) return;
    sweepTimer = setTimeout(() => {
      sweepTimer = null;
      leftSinceSweep = 0;
      void sweepPictures().catch(() => { /* the next one tries again */ });
    }, 60_000);
  }

  /**
   * Move this device's legacy data-URL pictures into picture files, one record at a
   * time, after a list has read them (the record's own bytes are in hand then). A
   * record is rewritten only when its file still holds the text that was read, and
   * every other field of it is kept as it was: the record gains `preview` and its
   * `thumb` becomes null, nothing else changes. The file is written and verified
   * first. Then picture files no record names are removed, except those this app
   * wrote since it started.
   */
  let moveStarted = false;
  function schedulePictureMove(raws: ParsedRecord[]): void {
    if (moveStarted || !fs.writeFile || !fs.readFile) return;
    moveStarted = true;
    const pending = raws.filter(raw => typeof raw.slot === 'string' && typeof raw.thumb === 'string' && raw.thumb && !sessionPreviewRef(raw));
    setTimeout(() => { void movePictures(pending).catch(() => { /* the next launch tries again */ }); }, 3000);
  }

  async function movePictures(pending: ParsedRecord[]): Promise<void> {
    for (const read of pending) {
      const decoded = decodePictureDataUrl(read.thumb);
      if (!decoded) continue;
      const ref = await previewRefFor(decoded.bytes, decoded.type, { route: 'legacy' });
      if (!ref || !await writePicture({ ref, bytes: decoded.bytes, form: decoded.form })) continue;
      const path = slotPath(read.slot!);
      await withSlot(read.slot!, async () => {
        try {
          // Read again inside the session's queue: a save, a restore or a delete that
          // written since the list read wins, and this record is left for next time.
          const text = await fs.readTextFile(path);
          const current = JSON.parse(text) as ParsedRecord & Record<string, unknown>;
          if (current.thumb !== read.thumb || current.updatedAt !== read.updatedAt || current.savedAt !== read.savedAt
            || sessionPreviewRef(current) || JSON.stringify(current.data) !== JSON.stringify(read.data)) return;
          await writeDocument(fs, path, JSON.stringify({ ...current, thumb: null, preview: ref }, null, 2));
        } catch { /* left as it was; read the old way */ }
      });
    }
    await sweepPictures();
  }

  /** Remove picture files no record points at. Only after a complete walk of the
   *  records: a record that could not be read might point at any of them. */
  async function sweepPictures(): Promise<void> {
    let files: string[];
    try { files = await fs.readDirNames(PREVIEW_DIR); } catch { return; }
    const { records, complete, keysInText } = await scanRecords();
    if (!complete) return;
    const named = new Set<string>(keysInText);
    for (const { raw } of records) { const ref = sessionPreviewRef(raw); if (ref) named.add(ref.key); }
    const now = Date.now();
    for (const [key, at] of writtenHere) if (now - at > WRITTEN_GRACE_MS) writtenHere.delete(key);
    for (const file of files) {
      const key = file.split('.')[0] ?? '';
      if (!/^[0-9a-f]{32}$/.test(key) || named.has(key) || writtenHere.has(key) || writing.has(key)) continue;
      try { await fs.remove(`${PREVIEW_DIR}/${file}`); } catch { /* kept */ }
    }
  }

  return {
    async save(slot, data, picture = null) {
      await writeRecord(slot, data, picture);
    },

    // A backup import or a Trash move writes through here, keeping the session's
    // own times, so the newer-copy rule compares when the work was saved.
    async restore(slot, data, picture, updatedAt, savedAt) {
      const at = validTime(updatedAt);
      const saved = validTime(savedAt) ?? at;
      await writeRecord(slot, data, picture, at && saved ? { updatedAt: at, savedAt: saved } : undefined);
    },

    async picture(ref) {
      let target: SessionPreviewRef | null = 'key' in ref ? readPreviewRef(ref) : null;
      if (!target && 'slot' in ref) {
        try { target = sessionPreviewRef(JSON.parse(await fs.readTextFile(slotPath(ref.slot))) as ParsedRecord); } catch { target = null; }
      }
      if (!target) return null;
      const bytes = await readPicture(target);
      return bytes ? new Blob([bytes.slice().buffer as ArrayBuffer], { type: target.type }) : null;
    },

    async pictureDataUrl(ref) {
      let target: SessionPreviewRef | null = 'key' in ref ? readPreviewRef(ref) : null;
      let legacy: string | null = null;
      if (!target && 'slot' in ref) {
        try {
          const raw = JSON.parse(await fs.readTextFile(slotPath(ref.slot))) as ParsedRecord;
          target = sessionPreviewRef(raw);
          legacy = typeof raw.thumb === 'string' ? raw.thumb : null;
        } catch { return null; }
      }
      if (!target) return legacy;
      const bytes = await readPicture(target);
      return bytes ? pictureDataUrl(bytes, target.type) : legacy;
    },

    async load(slot) {
      await ensureMigrated();
      const path = slotPath(slot);
      const ok = await fs.exists(path);
      if (!ok) return null;
      try {
        const raw = JSON.parse(await fs.readTextFile(path)) as ParsedRecord;
        // Read version stamps through the shared migrate-or-warn branch rather
        // than reaching for `raw.data` directly (records predating versioning
        // migrate as v0; a newer-app record is read as-is but reported).
        return migrateSessionRecord(raw, stateLog) as SavedStateData | null;
      } catch {
        return null;
      }
    },

    async list() {
      const records = await readAllRecords();
      schedulePictureMove(records.map(({ raw }) => raw));
      return records
        .map(({ raw }) => ({
          // A record that reached disk always carries these; the parsed type is
          // Partial because JSON.parse output is untrusted, so default rather
          // than assert. An empty slot is unreachable in practice and would only
          // ever surface as an unnamed row, never a crash.
          slot: raw.slot ?? '',
          toolId: raw.toolId ?? '',
          toolVersion: raw.toolVersion ?? '',
          label: raw.label,
          filename: raw.data?.__export_filename || null,
          // A reference when the record has one; the legacy data URL otherwise.
          thumb: sessionPreviewRef(raw) ? null : raw.thumb ?? null,
          ...(sessionPreviewRef(raw) ? { preview: sessionPreviewRef(raw)! } : {}),
          updatedAt: raw.updatedAt ?? '',
          ...(raw.createdAt ? { createdAt: raw.createdAt } : {}),
          ...(raw.savedAt ? { savedAt: raw.savedAt } : {}),
        }))
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    },

    async delete(slot) {
      await ensureMigrated();
      await withSlot(slot, async () => {
        const path = slotPath(slot);
        if (!await fs.exists(path)) return;
        let hadPicture = false;
        try { hadPicture = !!sessionPreviewRef(JSON.parse(await fs.readTextFile(path)) as ParsedRecord); } catch { /* removed all the same */ }
        await fs.remove(path);
        if (hadPicture) pictureLeft();
      });
    },

    // "Clear all my data" (plan 277 P2): every saved-state file goes, the Trash's
    // `__trash__:` records with them. The migration marker stays, so the next
    // launch does not re-walk an empty directory. A file that will not delete is
    // skipped rather than stopping the rest.
    async _clearAll() {
      await ensureMigrated();
      let names: string[];
      try { names = await fs.readDirNames(STATE_DIR); } catch { return; }
      for (const name of names) {
        if (!name?.endsWith('.json')) continue;
        try { await fs.remove(`${STATE_DIR}/${name}`); } catch { /* keep clearing the rest */ }
      }
      let pictures: string[] = [];
      try { pictures = await fs.readDirNames(PREVIEW_DIR); } catch { /* none */ }
      for (const name of pictures) {
        try { await fs.remove(`${PREVIEW_DIR}/${name}`); } catch { /* keep clearing the rest */ }
      }
    },

    async sizes() {
      const result: Record<string, number> = {};
      for (const { raw, bytes } of await readAllRecords()) {
        if (raw.slot) result[raw.slot] = bytes;
      }
      return result;
    },

    // Blob keys (id:format:version) referenced across all saved sessions, so
    // catalog sync won't evict on-demand blobs a session still needs.
    async _getAssetRefs() {
      const refs = new Set<string>();
      for (const { raw } of await readAllRecords()) collectAssetRefs(raw.data, refs);
      return refs;
    },
  };
}

/** One node of a saved-state tree that might be a library asset ref. Every field
 *  is optional because this walks arbitrary parsed JSON. */
interface MaybeAssetRef {
  source?: unknown;
  id?: unknown;
  format?: unknown;
  version?: unknown;
}

function collectAssetRefs(value: unknown, refs: Set<string>): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectAssetRefs(item, refs);
    return;
  }
  const node = value as MaybeAssetRef;
  for (const id of textFontAssetIds((value as Record<string, unknown>).textDocument)) {
    const dep = assetDependency({ id });
    if (dep.pin?.version != null && dep.pin.format) refs.add(`${dep.id}:${dep.pin.format}:${dep.pin.version}`);
  }
  if (node.source === 'library' && node.id && node.format && node.version != null) {
    // A modified ref (`<baseId>?theme=<t>` icon OR `<baseId>?treatment=<x>` photo)
    // is derived from the BASE blob - the key the cache holds and pruning must
    // protect. Match the web bridge exactly: strip BOTH modifiers, not just theme,
    // or a saved session's treated photo gets a key that never matches and is evicted.
    const baseId = stripAssetModifiers(String(node.id));
    refs.add(`${baseId}:${String(node.format)}:${String(node.version)}`);
    return;
  }
  for (const v of Object.values(value)) collectAssetRefs(v, refs);
}
