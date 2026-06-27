// SPDX-License-Identifier: MPL-2.0
/**
 * Portable user-data bundle — "take everything with you to another install".
 *
 * A long-term user accumulates real value on one offline device: their profile,
 * the sessions they've saved, the images they've uploaded, and their prefs. This
 * module packages all of it into a single `.zip` that can be carried (USB, AirDrop,
 * email-to-self, whatever) to a *second* offline install of the same app and loaded
 * back in. No server, no account — the file IS the transport.
 *
 * Storage-agnostic by design. Everything is read and written through the capability
 * bridge (`host.profile` / `host.state` / `host.assets`), so the SAME code produces
 * a byte-identical bundle on every shell even though the storage underneath differs
 * — the web PWA keeps saved sessions in IndexedDB, the Tauri shells keep them as
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
 * and the tool index — all re-synced for free on the target device. Asset *references*
 * inside sessions/profile are kept by id; the bridge re-resolves them on load (it
 * already must, since blob: URLs don't survive a page reload), so once the uploaded
 * images are restored the references light back up on their own.
 *
 * The envelope is built to outlive this version (full spec: docs/data-transfer.md):
 *   - Forward-compatible — a reader gates on `manifest.minReader`, not the writer's
 *     `formatVersion`, so a future bundle that merely *adds* a part (e.g. design
 *     tokens) still imports its known parts on an older app; the rest is skipped.
 *   - Integrity-checked — `manifest.integrity` carries an SHA-256 per part, verified
 *     on import so a transfer mangled in transit fails loudly, not halfway.
 *
 * The `host` and the key/value `storage` (localStorage) are injected so the whole
 * round-trip can be exercised headlessly in tests against an in-memory bridge.
 */

import { zip, unzip, zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

export const BACKUP_FORMAT = 'lolly-backup';

// (Un)zipping a backup can be tens of MB of images; on the UI thread the synchronous
// path froze the tab for seconds. fflate's async zip/unzip offload to a Web Worker,
// keeping the click responsive. But the worker only exists in a real browser — the
// headless round-trip test (and any no-Worker context) has no global Worker, where
// fflate's async would have nothing to offload to. So gate on Worker presence and
// fall back to the synchronous path there (byte-identical output, just blocking).
const HAS_WORKER = typeof Worker !== 'undefined';

function zipAsync(entries) {
  if (!HAS_WORKER) return Promise.resolve(zipSync(entries));
  return new Promise((resolve, reject) => {
    zip(entries, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

function unzipAsync(bytes) {
  if (!HAS_WORKER) return Promise.resolve(unzipSync(bytes));
  return new Promise((resolve, reject) => {
    unzip(bytes, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

// `formatVersion` is the layout this build *writes* — bump it on any change to the
// part set or their shapes. Readers, however, never gate on it directly: they gate
// on the bundle's `minReader` (below). That split is what makes the envelope
// forward-compatible — an additive bundle (one that merely adds a new optional part
// like a future `tokens.json`) keeps `minReader` low, so an older app still imports
// every part it recognises and simply skips the rest. Only a *breaking* change
// raises `minReader`. See docs/data-transfer.md for the full version policy.
export const BACKUP_FORMAT_VERSION = 1;

// The newest bundle this build knows how to read. A bundle is importable when its
// `minReader` is ≤ this number.
export const BACKUP_READER_VERSION = 1;

// localStorage keys that are genuinely the user's (vs. re-syncable caches like the
// catalog 'sbt-tool-index'). theme + sidebarWidth are prefs; ct-metrics is the
// local-only activity tally shown on the profile page. There is no bridge for these
// (they're synchronous UI state), and webview localStorage is the same on every shell.
const PREF_KEYS = ['theme', 'sidebarWidth', 'ct-metrics'];

// The parts this reader understands. Anything else in a bundle is a part from a
// newer (forward-compatible) writer — left untouched and counted as `skipped` so
// the round-trip is honest about what it didn't restore rather than silently
// dropping it. `assets/blobs/*` is the open-ended image payload.
const KNOWN_PARTS = new Set(['manifest.json', 'profile.json', 'sessions.json', 'assets.json', 'prefs.json']);
function isKnownPart(path) {
  return KNOWN_PARTS.has(path) || path.startsWith('assets/blobs/');
}

// Web Crypto — present in any secure browser context and in modern Node (so the
// headless round-trip test exercises integrity too). Absent ⇒ integrity is a no-op
// on both sides: we don't write the map, and we don't fail to verify one we can't.
const SUBTLE = globalThis.crypto?.subtle ?? null;

// Chunked so a multi-MB image blob doesn't blow the call stack via spread/apply.
function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function sha256(bytes) {
  const digest = await SUBTLE.digest('SHA-256', bytes);
  return 'sha256-' + bytesToBase64(new Uint8Array(digest));
}

// An fflate entry is either a Uint8Array or a [Uint8Array, opts] tuple (we pass the
// tuple form for already-compressed image bytes, to skip re-deflating). Normalise.
function entryBytes(v) {
  return v instanceof Uint8Array ? v : v[0];
}

// Map a stored asset format / MIME to a file extension for the in-zip blob name.
// Cosmetic only — import reconstructs the Blob from the recorded MIME, not the name.
function extFor(record) {
  const fmt = (record.format || '').toLowerCase();
  if (fmt) return fmt === 'jpeg' ? 'jpg' : fmt;
  const mime = record.blob?.type || '';
  return mime.split('/')[1]?.replace('+xml', '') || 'bin';
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
function nameToken(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 32);
}

// Per-day export counter persisted in the injected key/value store. It is a
// local download-naming convenience only — kept out of PREF_KEYS so it never
// travels in a bundle. Best-effort: any storage hiccup just yields 1.
function nextDailySequence(storage, date) {
  try {
    const prev = JSON.parse(storage?.getItem?.(EXPORT_SEQ_KEY) ?? 'null');
    const n = prev && prev.date === date ? (prev.n | 0) + 1 : 1;
    storage?.setItem?.(EXPORT_SEQ_KEY, JSON.stringify({ date, n }));
    return n;
  } catch {
    return 1;
  }
}

function backupFilename(profile, storage) {
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
export async function exportBackup({ host, storage }) {
  const entries = {};

  // Profile.
  const profile = await host.profile.get();
  const hasProfile = !!profile && Object.keys(profile).length > 0;
  if (hasProfile) entries['profile.json'] = strToU8(JSON.stringify(profile, null, 2));

  // Saved sessions — list (metadata + thumbnail) then load each one's full data.
  // host.state is the per-shell seam: IndexedDB on web, filesystem on Tauri.
  const sessionList = await host.state.list();
  const sessions = [];
  for (const entry of sessionList) {
    const data = await host.state.load(entry.slot);
    if (!data) continue;
    sessions.push({
      slot: entry.slot,
      toolId: entry.toolId,
      toolVersion: entry.toolVersion,
      label: entry.label ?? null,
      thumb: entry.thumb ?? null,
      updatedAt: entry.updatedAt ?? null,
      data,
    });
  }
  entries['sessions.json'] = strToU8(JSON.stringify(sessions, null, 2));

  // Uploaded images — full records incl. the Blob; split the binary into its own
  // file and keep the rest (id/type/format/dims/version/meta) as metadata.
  const userAssets = await host.assets._exportUserAssets();
  const assetMeta = [];
  for (let i = 0; i < userAssets.length; i++) {
    const { blob, ...rest } = userAssets[i];
    let path = null;
    let mime = '';
    if (blob) {
      path = `assets/blobs/${i}.${extFor(userAssets[i])}`;
      mime = blob.type || '';
      entries[path] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]; // already-compressed image bytes
    }
    assetMeta.push({ ...rest, _file: path, _mime: mime });
  }
  entries['assets.json'] = strToU8(JSON.stringify(assetMeta, null, 2));

  // Preferences / local metrics — only the user-owned keys.
  const prefs = {};
  for (const key of PREF_KEYS) {
    const v = storage.getItem(key);
    if (v != null) prefs[key] = v;
  }
  entries['prefs.json'] = strToU8(JSON.stringify(prefs, null, 2));

  const summary = {
    profile: hasProfile,
    sessions: sessions.length,
    userAssets: userAssets.length,
    prefs: Object.keys(prefs).length,
  };

  const manifest = {
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
  if (SUBTLE) {
    const integrity = {};
    for (const [path, value] of Object.entries(entries)) {
      integrity[path] = await sha256(entryBytes(value));
    }
    manifest.integrity = integrity;
  }

  entries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));

  const zipped = await zipAsync(entries); // off-thread in the browser; sync fallback elsewhere
  const blob = new Blob([zipped], { type: 'application/zip' });
  const filename = backupFilename(profile, storage);
  return { blob, filename, summary };
}

/**
 * Read a bundle produced by exportBackup and write it back through the bridge.
 *
 * Strategy is merge-overwrite: existing data is left in place, and any key that
 * collides (same profile, same session slot, same asset id) is replaced by the
 * imported copy. Nothing on the target device is wiped — safe to import onto an
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
export async function importBackup({ host, storage }, bytes) {
  let files;
  try {
    files = await unzipAsync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  } catch {
    throw new Error("That file isn't a valid backup — it couldn't be unzipped.");
  }

  const manifest = readJson(files, 'manifest.json');
  if (!manifest || manifest.format !== BACKUP_FORMAT) {
    throw new Error("That doesn't look like a Lolly data backup.");
  }

  // Forward-compatible gate: refuse only when the bundle explicitly demands a newer
  // reader than this build provides. Bundles that merely added optional parts keep
  // `minReader` low and import fine here — their unrecognised parts are skipped (and
  // counted below). Fall back to `formatVersion` for the conservative case of a
  // future bundle that bumped the layout without declaring `minReader`.
  const required = manifest.minReader ?? manifest.formatVersion ?? 1;
  if (required > BACKUP_READER_VERSION) {
    throw new Error('This backup needs a newer version of the app. Update first, then import.');
  }

  // Integrity — verify any part the manifest vouches for before writing anything.
  // Only runs when the bundle carries the map and Web Crypto is available; an older
  // bundle without it imports unchanged (can't-verify is not the same as corrupt).
  if (manifest.integrity && SUBTLE) {
    for (const [path, expected] of Object.entries(manifest.integrity)) {
      const bytes = files[path];
      if (!bytes) throw new Error(`This backup is incomplete — "${path}" is missing.`);
      if ((await sha256(bytes)) !== expected) {
        throw new Error(`This backup appears corrupted — "${path}" failed its integrity check.`);
      }
    }
  }

  const summary = { profile: false, sessions: 0, userAssets: 0, prefs: 0, skipped: 0 };

  // Profile.
  const profile = readJson(files, 'profile.json');
  if (profile && typeof profile === 'object') {
    await host.profile.set(profile);
    summary.profile = true;
  }

  // Sessions — save() re-derives toolId/version/label from data.__* and re-stamps
  // updatedAt (the bridge owns that), so an imported session lands as freshly saved.
  const sessions = readJson(files, 'sessions.json') ?? [];
  for (const s of sessions) {
    if (s && s.slot && s.data) { await host.state.save(s.slot, s.data, s.thumb ?? null); summary.sessions++; }
  }

  // Uploaded images — rebuild the Blob from its in-zip bytes + recorded MIME.
  const assetMeta = readJson(files, 'assets.json') ?? [];
  for (const meta of assetMeta) {
    if (!meta || !meta.id) continue;
    const { _file, _mime, ...rest } = meta;
    const raw = _file ? files[_file] : null;
    const record = { ...rest };
    if (raw) record.blob = new Blob([raw], { type: _mime || 'application/octet-stream' });
    await host.assets._importUserAsset(record);
    summary.userAssets++;
  }

  // Preferences / metrics.
  const prefs = readJson(files, 'prefs.json') ?? {};
  for (const key of PREF_KEYS) {
    if (prefs[key] != null) { storage.setItem(key, prefs[key]); summary.prefs++; }
  }

  // Parts from a newer, forward-compatible writer that this build doesn't know how
  // to restore. Reported (not hidden) so the UI can be honest: "imported X, skipped Y".
  summary.skipped = Object.keys(files).filter(p => !isKnownPart(p)).length;

  return summary;
}

function readJson(files, name) {
  const u8 = files[name];
  if (!u8) return null;
  try { return JSON.parse(strFromU8(u8)); } catch { return null; }
}
