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
 * The `host` and the key/value `storage` (localStorage) are injected so the whole
 * round-trip can be exercised headlessly in tests against an in-memory bridge.
 */

import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

export const BACKUP_FORMAT = 'lolly-backup';
export const BACKUP_FORMAT_VERSION = 1;

// localStorage keys that are genuinely the user's (vs. re-syncable caches like the
// catalog 'sbt-tool-index'). theme + sidebarWidth are prefs; ct-metrics is the
// local-only activity tally shown on the profile page. There is no bridge for these
// (they're synchronous UI state), and webview localStorage is the same on every shell.
const PREF_KEYS = ['theme', 'sidebarWidth', 'ct-metrics'];

// Map a stored asset format / MIME to a file extension for the in-zip blob name.
// Cosmetic only — import reconstructs the Blob from the recorded MIME, not the name.
function extFor(record) {
  const fmt = (record.format || '').toLowerCase();
  if (fmt) return fmt === 'jpeg' ? 'jpg' : fmt;
  const mime = record.blob?.type || '';
  return mime.split('/')[1]?.replace('+xml', '') || 'bin';
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
    app: 'lolly',
    exportedAt: new Date().toISOString(),
    counts: summary,
  };
  entries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));

  const zipped = zipSync(entries); // synchronous; fine for a click-time action
  const blob = new Blob([zipped], { type: 'application/zip' });
  const filename = `lolly-data-${new Date().toISOString().slice(0, 10)}.zip`;
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
 * @param {{ host: object, storage: Storage }} deps
 * @param {ArrayBuffer|Uint8Array} bytes  the raw .zip contents
 * @returns {Promise<object>} summary of what was imported
 */
export async function importBackup({ host, storage }, bytes) {
  let files;
  try {
    files = unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  } catch {
    throw new Error("That file isn't a valid backup — it couldn't be unzipped.");
  }

  const manifest = readJson(files, 'manifest.json');
  if (!manifest || manifest.format !== BACKUP_FORMAT) {
    throw new Error("That doesn't look like a Lolly data backup.");
  }
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error('This backup was made by a newer version of the app. Update first, then import.');
  }

  const summary = { profile: false, sessions: 0, userAssets: 0, prefs: 0 };

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

  return summary;
}

function readJson(files, name) {
  const u8 = files[name];
  if (!u8) return null;
  try { return JSON.parse(strFromU8(u8)); } catch { return null; }
}
