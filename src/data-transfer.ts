// SPDX-License-Identifier: MPL-2.0
/**
 * Portable user-data bundle - "take everything with you to another install".
 *
 * A long-term user accumulates real value on one offline device: their profile,
 * the sessions they've saved, the images they've uploaded, and their prefs. This
 * module packages all of it into a single `.zip` that can be carried (USB, AirDrop,
 * email-to-self, whatever) to a *second* offline install of the same app and loaded
 * back in. No server, no account - the file IS the transport.
 *
 * Storage-agnostic by design. Everything is read and written through the capability
 * bridge (`host.profile` / `host.state` / `host.assets`), so the SAME code produces
 * a byte-identical bundle on every shell even though the storage underneath differs
 * - the web PWA keeps saved sessions in IndexedDB, the Tauri shells keep them as
 * files on disk, and the bridge hides which is which. The transport package is the
 * contract; each shell's bridge is the per-platform adapter behind it.
 *
 * What travels:
 *   - profile        → profile.json   (the 'me' record, via host.profile)
 *   - saved sessions → sessions.json  (via host.state; thumbnails are data-URLs → JSON)
 *   - uploaded images→ assets.json    (metadata) + assets/blobs/* (bytes, via host.assets)
 *   - prefs          → prefs.json     (theme, sidebar width, local activity metrics)
 *
 * What does NOT travel: the catalog caches (asset-meta / asset-blob / catalog-meta)
 * and the tool index - all re-synced for free on the target device. Asset *references*
 * inside sessions/profile are kept by id; the bridge re-resolves them on load (it
 * already must, since blob: URLs don't survive a page reload), so once the uploaded
 * images are restored the references light back up on their own.
 *
 * The envelope is built to outlive this version (full spec: docs/data-transfer.md):
 *   - Forward-compatible - a reader gates on `manifest.minReader`, not the writer's
 *     `formatVersion`, so a future bundle that merely *adds* a part (e.g. design
 *     tokens) still imports its known parts on an older app; the rest is skipped.
 *   - Integrity-checked - `manifest.integrity` carries an SHA-256 per part, verified
 *     on import so a transfer mangled in transit fails loudly, not halfway.
 *
 * The `host` and the key/value `storage` (localStorage) are injected so the whole
 * round-trip can be exercised headlessly in tests against an in-memory bridge.
 */

import { strToU8 } from 'fflate';
import { packBackupSessions, restoreBackupSessions, type BackupState, type BackupHistoryMode } from './lib/backup-sessions.ts';
import { zipAsync } from './lib/zip.ts';
import {
  BUNDLE_HEADER, README_NAME, buildIntegrity, readJson, unzipBundle, verifyIntegrity,
  type BundleEntry,
} from './lib/bundle.ts';

export const BACKUP_FORMAT = 'lolly-backup';

/** One uploaded-image record as the assets bridge exports it. */
interface BackupAssetRecord {
  [key: string]: unknown;
  format?: string;
  blob?: Blob;
}

/** The slice of the host bridge a backup travels through. */
interface BackupHost {
  fileHistory?: import('./lib/file-history-backup.ts').FileHistoryBackup;
  profile: {
    get(): Promise<Record<string, unknown>>;
    set(profile: object): Promise<unknown>;
  };
  state: BackupState;
  assets: {
    _exportUserAssets(): Promise<readonly BackupAssetRecord[]>;
    _importUserAsset(record: Record<string, unknown>): Promise<unknown>;
  };
  log?: (level: string, message: string, meta?: unknown) => void;
}

/** The injected key/value store (localStorage in the shells). */
interface BackupStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface BackupSummary {
  profile: boolean;
  sessions: number;
  userAssets: number;
  prefs: number;
  revisions?: number;
  recoveryDrafts?: number;
  assetVersions?: number;
  fileOperations?: number;
  fileBatches?: number;
}

interface ImportSummary extends BackupSummary {
  skipped: number;
  /** Uploaded images that failed to restore (e.g. device storage full). Distinct
   *  from `skipped` (parts a newer writer produced that this build can't read). */
  failedAssets: number;
  failedHistory?: number;
}

interface BackupManifest {
  format: string;
  formatVersion: number;
  minReader: number;
  app: string;
  exportedAt: string;
  counts: BackupSummary;
  integrity?: Record<string, string>;
}

// The zip envelope - entry shape, SHA-256 integrity, the README banner, the
// minReader gate - is the shared bundle format (lib/bundle.ts), identical to the
// brand pack's. Only the payload below differs.
//
// Zipping goes through lib/zip.ts: worker-offloaded in a real browser (a backup
// can be tens of MB of images - the synchronous path froze the tab for seconds),
// sync fallback in no-Worker contexts like the headless round-trip test.
//
// Restore bounds: declared-size caps checked BEFORE each entry inflates - a
// restore should never balloon a small hostile zip into gigabytes of memory.
// Real backups are images stored uncompressed, far under these; they're far
// LARGER than lib/zip.ts's default (brand-pack-sized) caps, hence explicit.
const MAX_RESTORE_ENTRY_BYTES = 512 * 1024 * 1024;
// Exported so a fetched-from-a-URL backup (components/instance-sheet.ts) can cap
// the COMPRESSED download itself at the same ceiling, before the per-entry/total
// checks on the inflated contents ever get a chance to run.
export const MAX_RESTORE_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;

// `formatVersion` is the layout this build *writes* - bump it on any change to the
// part set or their shapes. Readers, however, never gate on it directly: they gate
// on the bundle's `minReader` (below). That split is what makes the envelope
// forward-compatible - an additive bundle (one that merely adds a new optional part
// like a future `tokens.json`) keeps `minReader` low, so an older app still imports
// every part it recognises and simply skips the rest. Only a *breaking* change
// raises `minReader`. See docs/data-transfer.md for the full version policy.
export const BACKUP_FORMAT_VERSION = 3;

// The newest bundle this build knows how to read. A bundle is importable when its
// `minReader` is ≤ this number.
export const BACKUP_READER_VERSION = 1;

// localStorage keys that are genuinely the user's (vs. re-syncable caches like the
// catalog 'sbt-tool-index'). theme + sidebarWidth are prefs; ct-metrics is the
// local-only activity tally shown on the profile page. There is no bridge for these
// (they're synchronous UI state), and webview localStorage is the same on every shell.
const PREF_KEYS = ['theme', 'sidebarWidth', 'ct-metrics'];

// The parts this reader understands. Anything else in a bundle is a part from a
// newer (forward-compatible) writer - left untouched and counted as `skipped` so
// the round-trip is honest about what it didn't restore rather than silently
// dropping it. `assets/blobs/*` is the open-ended image payload.
const KNOWN_PARTS = new Set(['manifest.json', 'profile.json', 'sessions.json', 'assets.json', 'prefs.json', 'design-systems.json']);
function isKnownPart(path: string, historySupported: boolean, revisionsSupported: boolean): boolean {
  return KNOWN_PARTS.has(path) || path === README_NAME || path.startsWith('assets/blobs/')
    || historySupported && (path === 'file-history.json' || path.startsWith('file-history/'))
    || revisionsSupported && path === 'revision-history.json';
}

// The human-readable `lolly.txt` dropped into every backup zip: the branding header, a
// one-glance summary of what the bundle is + what's inside, how to load it, a legend of
// the machine files, and (if the profile has any) the owner's details - so someone who
// opens the zip without the app can understand it at a glance. Regenerated on each
// export; ignored on import.
function backupReadme(
  { summary, profile, filename }:
  { summary: BackupSummary; profile: Record<string, unknown>; filename: string },
): string {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

  const lines = [
    BUNDLE_HEADER,
    '-'.repeat(56),
    '',
    '',
    `[[ 💼 ${filename} ]]`,
    '',
    `Exported on ${date} at ${time} (local)`,
    '',
    "A portable backup of everything you've made in Lolly on one device.",
    'Open Lolly on another device, go to Profile → Storage → “Import data…”',
    'and choose this .zip to pick up exactly where you left off.',
    'Everything stayed on your devices - nothing was uploaded.',
    '',
    '',
    "[ What's inside ]",
    '',
    `👤 Profile           ${summary.profile ? 'included' : 'not included'}`,
    `🗂  Saved sessions    ${summary.sessions}`,
    `🖼  Images, fonts & brand   ${summary.userAssets}`,
    `⚙  Preferences        ${summary.prefs}`,
    `↶  Creation checkpoints  ${summary.revisions ?? 0}`,
    `↶  Protected drafts      ${summary.recoveryDrafts ?? 0}`,
    `↶  Saved asset versions  ${summary.assetVersions ?? 0}`,
    `✓  File operation records ${summary.fileOperations ?? 0} (completed copies included)`,
    `☷  File batch manifests  ${summary.fileBatches ?? 0} (all selected members)`,
    '',
    '',
    '[ The files in this zip ]',
    '',
    'manifest.json   what the app reads to restore this backup',
    'profile.json    your saved details + preferences',
    'sessions.json   your saved tool sessions (thumbnails included)',
    'assets.json     details of your uploaded images, brand tokens & fonts',
    'assets/blobs/   the image and font files themselves',
    'revision-history.json  creation checkpoints, previews and recovery drafts (when supported)',
    'Historical designs use the assets available on the destination device.',
    'file-history.json  saved versions and file-operation reports (when supported)',
    'file-history/   exact snapshot/result bytes and extracted Content Credentials',
    'Originals selected for conversion are NOT retained or included.',
    'Operations still running at export restore as interrupted, without restarting.',
    'prefs.json      theme + local settings',
    'lolly.txt       this summary (the app ignores it on import)',
  ];

  // Author block - same shape as the batch manifest, only when the profile has something.
  const name = [profile?.firstname, profile?.lastname].filter(Boolean).join(' ');
  const authorLine = [name, profile?.email, profile?.phone].filter(Boolean).join(' | ');
  if (authorLine) lines.push('', '', '[ Author Information ]', '', authorLine);

  return lines.join('\n') + '\n';
}

// Download-name helpers ------------------------------------------------------
// The exported zip is named for the person it belongs to, so a Downloads folder
// of backups stays legible: LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip. Name
// parts come from whatever the profile has (first and/or last, in that order)
// and are omitted when absent; <n> is a per-day, per-device sequence so repeat
// exports on the same day don't collide and stay in order.
const EXPORT_SEQ_KEY = 'lolly-export-seq';

// Reduce a profile name to a filename-safe token: keep Unicode letters/digits
// (so "Bilbo", "Bjørn", "李雷" all survive), drop spaces/punctuation, cap length.
function nameToken(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 32);
}

// Per-day export counter persisted in the injected key/value store. It is a
// local download-naming convenience only - kept out of PREF_KEYS so it never
// travels in a bundle. Best-effort: any storage hiccup just yields 1.
function nextDailySequence(storage: BackupStorage, date: string): number {
  try {
    const prev = JSON.parse(storage?.getItem?.(EXPORT_SEQ_KEY) ?? 'null');
    const n = prev && prev.date === date ? (prev.n | 0) + 1 : 1;
    storage?.setItem?.(EXPORT_SEQ_KEY, JSON.stringify({ date, n }));
    return n;
  } catch {
    return 1;
  }
}

function backupFilename(profile: Record<string, unknown>, storage: BackupStorage): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC, matches the manifest)
  const seq = nextDailySequence(storage, date);
  const parts = ['LollyTools', nameToken(profile?.firstname), nameToken(profile?.lastname), date, seq];
  return `${parts.filter(Boolean).join('-')}.zip`;
}

/**
 * Read everything the user owns (through the bridge) and pack it into one zip Blob.
 * @param {{ host: object, storage: Storage }} deps
 * @returns {Promise<{ blob: Blob, filename: string, summary: object }>}
 */
export async function exportBackup(
  { host, storage }: { host: BackupHost; storage: BackupStorage },
  options: BackupHistoryMode = {},
): Promise<{ blob: Blob; filename: string; summary: BackupSummary }> {
  const entries: Record<string, BundleEntry> = {};
  const sessionSummary = await packBackupSessions(host.state, entries, options);
  // Read/history-budget first: a large result library must fail before we copy
  // hundreds of unrelated asset blobs into the ZIP's in-memory entry map.
  const history = host.fileHistory ? await host.fileHistory.export() : null;
  if (history) {
    const { packFileHistory } = await import('./lib/file-history-backup.ts');
    await packFileHistory(history, entries);
  }

  // Profile.
  const profile = await host.profile.get();
  const hasProfile = !!profile && Object.keys(profile).length > 0;
  if (hasProfile) entries['profile.json'] = strToU8(JSON.stringify(profile, null, 2));

  // The design-system records (plans/186 section 3.9): the material itself
  // travels as user assets below; the records are what names it and says which
  // one was active. The shipped record is this build's and is not carried.
  try {
    const registry = (host as { designSystems?: { list(): Promise<Array<{ id: string; source: { kind: string } }>>; activeId(): Promise<string> } }).designSystems;
    if (registry) {
      const [records, activeId] = await Promise.all([registry.list(), registry.activeId()]);
      const own = records.filter(r => r.source.kind !== 'shipped');
      if (own.length) entries['design-systems.json'] = strToU8(JSON.stringify({ active: activeId, records: own }, null, 2));
    }
  } catch { /* no registry on this host - the assets still carry the material */ }

  // Uploaded images - full records incl. the Blob; split the binary into its own
  // file and keep the rest (id/type/format/dims/version/meta) as metadata.
  const userAssets = await host.assets._exportUserAssets();
  const assetMeta = [];
  const { packBackupAsset } = await import('./lib/backup-asset-record.ts');
  for (let i = 0; i < userAssets.length; i++) {
    assetMeta.push(await packBackupAsset(userAssets[i]!, `assets/blobs/${i}`, entries));
  }
  entries['assets.json'] = strToU8(JSON.stringify(assetMeta, null, 2));

  // Preferences / local metrics - only the user-owned keys.
  const prefs: Record<string, string> = {};
  for (const key of PREF_KEYS) {
    const v = storage.getItem(key);
    if (v != null) prefs[key] = v;
  }
  entries['prefs.json'] = strToU8(JSON.stringify(prefs, null, 2));

  const summary: BackupSummary = {
    profile: hasProfile,
    ...sessionSummary,
    userAssets: userAssets.length,
    prefs: Object.keys(prefs).length,
    ...(history ? { assetVersions: history.assetVersions.length, fileOperations: history.operations.length, ...(history.batches ? { fileBatches: history.batches.length } : {}) } : {}),
  };

  // Named before the manifest so the human-readable lolly.txt can show it (and the
  // per-day sequence is incremented exactly once).
  const filename = backupFilename(profile, storage);

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    minReader: BACKUP_READER_VERSION,
    app: 'lolly',
    exportedAt: new Date().toISOString(),
    counts: summary,
  };

  // Per-part integrity (SHA-256, SRI-style), computed over every part *except* the
  // manifest (which carries the map). A reader verifies these on import, so a bundle
  // truncated or mangled in transit (USB, email, AirDrop) fails with a clear message
  // instead of a confusing half-restore. Best-effort: omitted when Web Crypto isn't
  // available, and an older reader without integrity support ignores it harmlessly.
  const integrity = await buildIntegrity(entries);
  if (integrity) manifest.integrity = integrity;

  entries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));

  // Human-readable summary for anyone opening the zip. Added AFTER the integrity loop so
  // it's not integrity-protected (it's a README, regenerated each export, not payload),
  // and recognised as a known part on import so it never counts as `skipped`.
  entries[README_NAME] = strToU8(backupReadme({ summary, profile, filename }));

  const zipped = await zipAsync(entries); // off-thread in the browser; sync fallback elsewhere
  const blob = new Blob([zipped as BlobPart], { type: 'application/zip' });
  return { blob, filename, summary };
}

/**
 * Read a bundle produced by exportBackup and write it back through the bridge.
 *
 * Strategy is merge-overwrite: existing data is left in place, and any key that
 * collides (same profile, same session slot, same asset id) is replaced by the
 * imported copy. Nothing on the target device is wiped - safe to import onto an
 * install that's already in use.
 *
 * Before writing anything it (1) gates on the bundle's `minReader` so a genuinely
 * future format is refused cleanly, (2) verifies per-part integrity when present so
 * a corrupted transfer fails loudly, and (3) tolerates unrecognised parts from a
 * forward-compatible writer, reporting them as `skipped` rather than dropping them
 * silently.
 *
 * @param {{ host: object, storage: Storage }} deps
 * @param {ArrayBuffer|Uint8Array} bytes  the raw .zip contents
 * @returns {Promise<object>} summary of what was imported (incl. `skipped`)
 */
export async function importBackup(
  { host, storage }: { host: BackupHost; storage: BackupStorage },
  bytes: ArrayBuffer | Uint8Array,
  options: BackupHistoryMode = {},
): Promise<ImportSummary> {
  const files = await unzipBundle(bytes, {
    maxEntryBytes: MAX_RESTORE_ENTRY_BYTES,
    maxTotalBytes: MAX_RESTORE_TOTAL_BYTES,
    tooLarge: name => `That backup expands too large to restore (${name}).`,
    invalid: "That file isn't a valid backup - it couldn't be unzipped.",
  });

  const manifest = readJson(files, 'manifest.json');
  if (!manifest || manifest.format !== BACKUP_FORMAT) {
    throw new Error("That doesn't look like a Lolly data backup.");
  }

  // Forward-compatible gate: refuse only when the bundle explicitly demands a newer
  // reader than this build provides. Bundles that merely added optional parts keep
  // `minReader` low and import fine here - their unrecognised parts are skipped (and
  // counted below). Fall back to `formatVersion` for the conservative case of a
  // future bundle that bumped the layout without declaring `minReader`.
  const required = manifest.minReader ?? manifest.formatVersion ?? 1;
  if (required > BACKUP_READER_VERSION) {
    throw new Error('This backup needs a newer version of the app. Update first, then import.');
  }

  // Integrity - verify any part the manifest vouches for before writing anything.
  // Only runs when the bundle carries the map and Web Crypto is available; an older
  // bundle without it imports unchanged (can't-verify is not the same as corrupt).
  await verifyIntegrity(files, manifest.integrity, 'This backup');

  // Validate known binary parts before ANY writes, including backups from older
  // writers without an integrity map. A missing blob must never replace a head
  // with a metadata-only record and appear to be a successful recovery.
  const { unpackBackupAsset } = await import('./lib/backup-asset-record.ts');
  const assetMeta = readJson(files, 'assets.json') ?? [];
  if (!Array.isArray(assetMeta)) throw new Error('Invalid asset list in backup.');
  const assetRecords = assetMeta.map(meta => unpackBackupAsset(meta, files, 'assets/blobs/'));
  const history = host.fileHistory ? await (await import('./lib/file-history-backup.ts')).unpackFileHistory(files) : null;

  const sessionSummary = await restoreBackupSessions(host.state, files, options);
  const summary: ImportSummary = { profile: false, userAssets: 0, prefs: 0, skipped: 0, failedAssets: 0, ...sessionSummary };

  // Profile.
  const profile = readJson(files, 'profile.json');
  if (profile && typeof profile === 'object') {
    await host.profile.set(profile);
    summary.profile = true;
  }

  // Design-system records (plans/186 section 3.9), before the assets so a record's
  // namespace exists by the time its rows land. Merge by id, the shipped record
  // is never imported, and the bundle's active pointer is honoured only when
  // this device has no design system of its own yet (a backup restores a device,
  // it does not hijack one that is in use).
  const dsPart = readJson(files, 'design-systems.json');
  const registry = (host as { designSystems?: { list(): Promise<Array<{ id: string; source: { kind: string } }>>; put(r: unknown): Promise<void>; setActive(id: string): Promise<void>; get(id: string): Promise<unknown> } }).designSystems;
  if (registry && dsPart && typeof dsPart === 'object' && Array.isArray(dsPart.records)) {
    const before = await registry.list().catch(() => []);
    const hadOwn = before.some(r => r.source.kind !== 'shipped');
    for (const rec of dsPart.records) {
      if (!rec || typeof rec.id !== 'string' || rec.id === 'shipped') continue;
      try { await registry.put(rec); } catch { /* an invalid record is skipped */ }
    }
    if (!hadOwn && typeof dsPart.active === 'string' && dsPart.active !== 'shipped') {
      try { await registry.setActive(dsPart.active); } catch { /* the pointer stays */ }
    }
  }

  // Uploaded images - rebuild the Blob from its in-zip bytes + recorded MIME.
  for (const record of assetRecords) {
    if (!record.id) continue;
    // Restore each asset independently: a single oversized blob (a large verbatim
    // video/animation can trip IndexedDB's quota, which _importUserAsset does NOT
    // pre-check) must not abort the rest of the restore. Skip + count the casualty.
    try {
      await host.assets._importUserAsset(record);
      summary.userAssets++;
    } catch (e) {
      // Counted (not folded into `skipped`, which is reassigned below) so the UI can
      // honestly report that some images didn't make it - a user who then discards the
      // source backup would otherwise lose them silently.
      summary.failedAssets++;
      host.log?.('warn', 'Skipped restoring one image (storage full or unreadable)', { id: String(record.id), error: String(e) });
    }
  }

  if (history) {
    try { Object.assign(summary, await host.fileHistory!.restore(history)); }
    catch (error) {
      summary.failedHistory = history.assetVersions.length + history.operations.length + (history.batches?.length ?? 0);
      host.log?.('warn', 'File history could not be restored; keep the backup', { error: String(error) });
    }
  }

  // Preferences / metrics.
  const prefs = readJson(files, 'prefs.json') ?? {};
  for (const key of PREF_KEYS) {
    if (prefs[key] != null) { storage.setItem(key, prefs[key]); summary.prefs++; }
  }

  // Parts from a newer, forward-compatible writer that this build doesn't know how
  // to restore. Reported (not hidden) so the UI can be honest: "imported X, skipped Y".
  summary.skipped = Object.keys(files).filter(p => !isKnownPart(p, Boolean(host.fileHistory), options.mode !== 'sync' && Boolean(host.state.history))).length;

  return summary;
}
