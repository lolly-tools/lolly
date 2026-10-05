// SPDX-License-Identifier: MPL-2.0
/**
 * AssetsAPI - global catalog + user uploads, presented as one surface.
 *
 * Resolution order for host.assets.get(id):
 *   1. user-assets store (if id starts with 'user/')
 *   2. asset-blob store (cached library asset)
 *   3. on-demand fetch from catalog URL (if 'on-demand' tier and net OK)
 *   4. throw if unavailable
 *
 * Tier behaviour:
 *   - core      → bundled with shell, always present
 *   - catalog   → synced at boot via catalog/sync.js
 *   - on-demand → fetched lazily, then cached
 */

import { parseThemedAssetId, parseTreatedAssetId, stripAssetModifiers, parseFileAssetId } from '../../../../engine/src/asset-modifiers.ts';
import type { GradeLut } from '../../../../engine/src/grade.ts';
// c2pa-verify is LAZY on purpose. It is the entry to the whole provenance
// cluster (c2pa + c2pa-extract + c2pa-containers + c2pa-verdict + c2pa-trust +
// video-meta, ~65 KB gz), and this module is on the boot path, so a static
// import here puts all of it in front of first paint. Nothing at boot reads
// a credential: the two callers below (asset ingest and the user-asset
// listing) are both already async and both skip the load entirely when no
// record actually carries a credential. Memoised, so the second caller is
// free. See scripts/check-bundle-budget.ts.
type C2paVerifyModule = typeof import('../../../../engine/src/c2pa-verify.ts');
let C2PA_VERIFY_MODULE: Promise<C2paVerifyModule> | null = null;
function loadC2paVerify(): Promise<C2paVerifyModule> {
  C2PA_VERIFY_MODULE ??= import('../../../../engine/src/c2pa-verify.ts');
  return C2PA_VERIFY_MODULE;
}
import { instanceFetch } from '../lib/instance.ts';
// The `zzfxm:` procedural-audio id: an ENGINE-owned asset-id scheme, exactly
// like tool-url.ts's, because every shell that resolves an asset has to
// recognise it.
import { isZzfxmRef, parseZzfxmRef, formatZzfxmRef } from '../../../../engine/src/zzfxm-ref.ts';
// Tokens discovery must skip a published design-system VERSION (plans/97 section 6a).
// The engine leaf, like the imports above: the web bridge, the MCP server and
// the CLI all apply this one predicate instead of each writing the rule out.
import { pickHeadAssetId } from '../../../../engine/src/design-version.ts';
// Where copy-on-write parks bytes a published version pins. Imported (not
// re-spelled) so the listing filter below and the preserver that writes them can
// never disagree about which rows are machine-owned.
import { FROZEN_PREFIX } from './version-assets.ts';
// Version history is a write-time / restore-time concern, never first paint:
// loaded on demand so its IDB transaction code stays off the boot path
// (scripts/check-bundle-budget.ts).
const assetHistory = () => import('./asset-history.ts');
import type { AssetRef, AssetQuery } from '@lolly-tools/core/host-v1';
import type { IconTheme } from '../../../../engine/src/icon-theme.ts';
import type { PhotoTreatment } from '../../../../engine/src/photo-treatment.ts';

/** One resolvable file for a catalog asset (an entry in AssetMetaRecord.formats). */
interface AssetFormat {
  format: string;
  url: string;
  checksum?: string;
  width?: number;
  height?: number;
  /** Byte length, stamped into the index by scripts/build-catalog-index.ts. The
   *  only size anything can read BEFORE the file is fetched. */
  size?: number;
  /** Playback length in ms for a video/audio/lottie entry (asset.schema.json). */
  durationMs?: number;
}

/** A catalog asset's stored metadata (the 'asset-meta' IDB store). */
export interface AssetMetaRecord {
  id: string;
  type: AssetRef['type'];
  name?: string;
  provider?: string;
  description?: string;
  tags?: string[];
  version?: string;
  tier?: string;
  deprecated?: boolean;
  /** Generative-AI provenance disclosure (authored on the catalog entry): 'full' =
   *  wholly AI-generated, 'partial' = contains AI-generated elements. Rides the index
   *  entry through _syncFromIndex and surfaces on AssetRef.meta.aiGenerated. */
  aiGenerated?: 'full' | 'partial';
  /** Tokens assets only: this brand is authoritative and not user-overridable
   *  (see bridge/tokens.ts). Rides the index entry through _syncFromIndex. */
  brandLock?: boolean;
  /** An instance may explicitly choose its catalogue's tokens head. */
  defaultTokens?: boolean;
  /** The date this asset's primary file was first added to its brand pack
   *  (YYYY-MM-DD), stamped into the index by scripts/checksum-assets.ts from the
   *  committed date map. Rides the index entry through _syncFromIndex and surfaces
   *  on AssetRef.meta.added for the catalog details modal. Uploads have no such
   *  field - they carry their own millisecond stamp (see assetAddedAt). */
  added?: string;
  /** SPDX-ish licence id for a catalog asset (e.g. 'cc-by-4.0', 'cc0-1.0'). Rides the
   *  index entry through _syncFromIndex; surfaces on AssetRef.meta.license. */
  license?: string;
  /** Human-readable credit for a licensed asset that requires attribution (a CC-BY
   *  work, e.g. the SUSE7 LUT). Rides through; surfaces on AssetRef.meta.attribution. */
  attribution?: string;
  /** The structured rights record (plan 253, CreativeWorkRecordV1) when the catalog
   *  entry carries one: creators, source, revision and every rights statement about
   *  the work, beside the two legacy display strings above rather than instead of
   *  them. Rides the index entry through _syncFromIndex; surfaces on
   *  AssetRef.meta.rights. Absent means not recorded, never permission. */
  rights?: unknown;
  checksum?: string;
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;
  formats: AssetFormat[];
}

/** File choices load with an actual file selection, rather than at app boot. */
async function fileMeta(meta: AssetMetaRecord, file: string | null): Promise<AssetMetaRecord> {
  return file ? (await import('./asset-file-meta.ts')).selectedFileMeta(meta, file) : meta;
}

/** A user-uploaded asset (the 'user-assets' IDB store) - already resolved to one blob/format. */
export interface UserAssetRecord {
  id: string;
  type: AssetRef['type'];
  format: string;
  blob?: Blob;
  version?: string;
  checksum?: string;
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;
  // Preserved Content Credentials captured at ingest - the raw C2PA manifest
  // store only (no pixels/EXIF), so a placed credentialed image can carry its
  // provenance into an export without re-hoarding the metadata upload strips.
  credential?: Uint8Array;
  credentialFormat?: string;
  // Generative-AI disclosure, DERIVED from `credential` at upload time (the
  // file's C2PA chain declared AI/ML-generated pixels: Claude, OpenAI,
  // Gemini, etc.). Cached here so the catalog/picker badge doesn't re-parse
  // on every render. Absent means not yet computed (older uploads);
  // `_listUserAssets` recomputes those from `credential` on the fly.
  aiGenerated?: 'full' | 'partial';
  /** When the person moved this upload to the Trash from the web app (plan
   *  277 P3), else absent. The record keeps its id and bytes, so a saved
   *  design that uses the picture still draws, while every list leaves the
   *  upload out. The matching entry lives in profile.trash (lib/trash.ts). */
  trashedAt?: string;
}

/** A trashed upload as the Trash lists it (lib/trash.ts). */
export interface TrashedUserAssetRow {
  id: string;
  type: AssetRef['type'];
  name: string;
  /** A font face's family, so the Trash can group faces into one entry. */
  family?: string;
  trashedAt: string;
  bytes: number;
}

/** Copy a record without its Trash mark: a duplicate, an imported version or a
 *  restored version is live work, never born in the Trash. */
function withoutTrashMark<T extends { trashedAt?: string }>(rec: T): T {
  if (!('trashedAt' in rec)) return rec;
  const { trashedAt: _drop, ...rest } = rec;
  return rest as T;
}

/** The record shape toAssetRef consumes - a user record or a catalog record resolved
 *  to one concrete blob/format (plus an optional cacheKey override for themed bakes). */
interface AssetRefSource {
  id: string;
  type: AssetRef['type'];
  format: string;
  version?: string;
  blob?: Blob;
  checksum?: string;
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;
  cacheKey?: string;
}

/** One readwrite transaction over a single store. */
interface AssetsTx {
  store: {
    put(value: AssetMetaRecord): Promise<unknown>;
    delete(key: string): Promise<unknown>;
  };
  done: Promise<void>;
}

/** The slice of the idb database this API touches (the asset-* + user-assets stores). */
export interface AssetsDb {
  get(store: 'profile', key: string): Promise<unknown>;
  get(store: 'user-assets', id: string): Promise<UserAssetRecord | undefined>;
  get(store: 'asset-meta', id: string): Promise<AssetMetaRecord | undefined>;
  get(store: 'asset-blob', key: string): Promise<Blob | undefined>;
  getAll(store: 'user-assets'): Promise<UserAssetRecord[]>;
  getAll(store: 'asset-meta'): Promise<AssetMetaRecord[]>;
  getAll(store: 'asset-blob'): Promise<Blob[]>;
  getAllKeys(store: 'user-assets' | 'asset-meta' | 'asset-blob'): Promise<string[]>;
  put(store: 'profile', value: unknown, key: string): Promise<unknown>;
  put(store: 'user-assets', record: UserAssetRecord): Promise<unknown>;
  put(store: 'asset-blob', blob: Blob, key: string): Promise<unknown>;
  delete(store: 'user-assets' | 'asset-blob', id: string): Promise<void>;
  transaction(store: 'asset-meta' | 'asset-blob', mode: 'readwrite'): AssetsTx;
}

const OBJECT_URL_CACHE = new Map<string, string>(); // key → blob URL, kept alive while bridge is.
// The format of a baked photo look's bytes (jpg or png), by its OBJECT_URL_CACHE key, so a
// cache hit reports the format the url really holds.
const OBJECT_URL_FORMAT = new Map<string, string>();

// Library-asset credential lookups (host.assets.credential) - the extracted
// C2PA store per id, or null once an asset is known clean. Manifest stores are
// small (no pixels); nulls dominate, so the map stays tiny.
const CREDENTIAL_CACHE = new Map<string, { store: Uint8Array; format: string } | null>();
// Skip credential-scanning anything enormous - same cap as upload ingest.
// Exported because it is a POLICY, not a local detail: whatever other caller that
// fetches a whole asset just to look for a manifest (the sequence export's
// ingredient gather) has to stop at the same size, or a timeline of four
// half-gigabyte clips pays a cost this cap exists to refuse.
export const MAX_CREDENTIAL_SCAN_BYTES = 64 * 1024 * 1024;

// Parsed theme list from the catalog's icon-themes palette asset (a palette-type
// asset tagged "icon-themes"). Cached per session; reset when the catalog syncs.
let ICON_THEMES_CACHE: Promise<IconTheme[]> | null = null;

// Parsed treatment list from the catalog's photo-treatments palette asset (a
// palette-type asset tagged "photo-treatments"). Cached like ICON_THEMES_CACHE.
let PHOTO_TREATMENTS_CACHE: Promise<PhotoTreatment[]> | null = null;

/**
 * There is no hard cap on how many device images a user may keep. The
 * library is theirs to fill, and assertQuotaRoom() (below) is the real
 * backstop, refusing a write only when device storage is genuinely tight.
 *
 * Instead, as the library grows past these friendly milestones the UI
 * nudges once (see lib/asset-milestone.ts) to explain that device images
 * stay on this device: they don't travel inside share links, so an image
 * only reaches someone else when it's rendered into a file, and images
 * everyone should always have belong in the catalog. The nudge is
 * informational, never blocking.
 */
export const USER_ASSET_MILESTONES = [20, 100, 500] as const;

// Refuse a write that would push storage past this fraction of the quota,
// rather than letting IndexedDB throw a QuotaExceededError mid-write.
const QUOTA_SAFETY_FRACTION = 0.9;

// Monotonic disambiguator for duplicate ids: several copies minted inside one
// synchronous burst (a bulk "Duplicate" over a multi-selection) share the
// same Date.now(), so a per-mint counter is what keeps their ids unique, and,
// padded, correctly ordered so newer copies still sort first in
// _listUserAssets.
let duplicateSeq = 0;

/**
 * A fresh, collision-free id for a copy of `srcId`. Keeps the source's "kind"
 * segment (upload / recording / …) so the copy reads like what it was cloned
 * from, and leads with the wall clock + a padded counter so copies sort
 * newest-first (id descending, as _listUserAssets orders) without ever clashing.
 */
/**
 * Keys a catalog entry's free-form `meta` blob may never answer. `name`, `tags`
 * and the rights keys are validated top-level fields of the entry, and the blob
 * beside them is validated no further than "is an object", so a blob that
 * carried its own `license` could state a licence nothing checked and disagree
 * with the same asset's resolved ref. Every one of these is written from the
 * entry's own field, after this.
 */
const RESERVED_META_KEYS: ReadonlySet<string> = new Set(['name', 'tags', 'license', 'attribution', 'rights', 'brandLock']);

export function withoutReservedMeta(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!RESERVED_META_KEYS.has(key)) out[key] = entry;
  }
  return out;
}

function mintDuplicateId(srcId: string): string {
  const kind = srcId.split('/')[1] || 'upload';
  const seq = String(duplicateSeq++).padStart(4, '0');
  return `user/${kind}/${Date.now()}-${seq}-copy`;
}

/**
 * "<name> copy", or "<name> copy 2", "...3" when earlier copies already
 * carry that name, Finder-style. A trailing " copy"/" copy N" is stripped
 * from the source first, so duplicating a duplicate reads "photo copy 2",
 * never "photo copy copy".
 */
function nextCopyName(srcName: string, taken: Set<string>): string {
  const base = srcName.replace(/ copy( \d+)?$/i, '').trim() || srcName.trim() || 'image';
  let name = `${base} copy`;
  for (let n = 2; taken.has(name); n++) name = `${base} copy ${n}`;
  return name;
}

/**
 * The recency key for a user asset. Every id is `user/<kind>/<ms>-...`, so
 * the `<ms>` third segment is when it was made. Sorting the WHOLE id string
 * instead orders by <kind> first (matte < upload < upscaled, alphabetically),
 * which sinks a brand-new cutout below every older upload and upscale, so
 * "newest" never reaches the top. Parsing the ms out fixes that. Falls back
 * to 0 for whatever id whose third segment isn't leading-numeric, so a
 * non-timestamped kind stays put (ordered by the id tiebreak) instead of
 * jumping to the front.
 */
function userIdTime(id: string): number {
  const n = parseInt(id.split('/')[2] ?? '', 10);
  return Number.isFinite(n) ? n : 0;
}

/** Options the shell wires in at bridge-assembly time (bridge/index.ts). */
export interface AssetsApiOptions {
  /**
   * Runs BEFORE anything replaces or removes the bytes stored at a
   * user-asset id. Its job is to preserve bytes a published design-system
   * version pins (plans/97 section 6a copy-on-write); see bridge/version-assets.ts.
   *
   * A THROW REFUSES the write: losing a version's bytes is not an
   * acceptable success, and a version that silently changed what it renders
   * would make "published is permanent" a lie. Called from the four methods
   * that destroy bytes at an existing id and nowhere else, so no caller can
   * forget it.
   *
   * `reclaiming` marks the DELETE case, where the preserved copy is a move
   * instead of a second copy: the bytes it writes are the bytes about to be
   * released, so it must not be quota-checked. Without that, a device near
   * its quota refuses the delete that would have freed the space, and the
   * user is locked out of their own storage with no way forward (see
   * _deleteUserAsset).
   */
  preservePinned?: (id: string, opts?: { reclaiming?: boolean }) => Promise<void>;
}

export function createAssetsAPI(db: AssetsDb, opts: AssetsApiOptions = {}) {
  // In-flight fetch-and-cache work, keyed by blob key. Two callers wanting the
  // same asset format at the same moment share ONE network request: on a cold
  // load the tokens bridge reads brand.json while catalog/sync.ts's core prefetch
  // is walking the same tier, and each checking "is it cached yet?" before the
  // other had written anything downloaded the file twice (measured by
  // scripts/check-first-load.ts, 2026-09-12). Cleared when the work settles, so a failed fetch is retried
  // rather than a rejected promise being replayed for the life of the page.
  const inFlight = new Map<string, Promise<Blob>>();
  const fetchAndCacheOnce = (meta: AssetMetaRecord, format: AssetFormat, blobKey: string): Promise<Blob> => {
    const pending = inFlight.get(blobKey);
    if (pending) return pending;
    const started = fetchAndCache(meta, format, blobKey, db)
      .finally(() => { if (inFlight.get(blobKey) === started) inFlight.delete(blobKey); });
    inFlight.set(blobKey, started);
    return started;
  };

  // Photo looks (plan 291 W7): a `?treatment=<lookId>` whose look only a pixel bake
  // reproduces (gradient-map, lut), or any look on an upload or an inline picture,
  // is baked into raster bytes here, once per (picture, look, theme): concurrent
  // resolves of one bake share it, and a finished bake is an object URL keyed by
  // photoLookCacheKey. A bake that fails serves the plain picture under the
  // treated id, the same contract as an unknown treatment.
  const lookBakes = new Map<string, Promise<Blob>>();
  const lutReads = new Map<string, Promise<GradeLut | null>>();
  const lutFor = (lutId: string | undefined): Promise<GradeLut | null> => {
    if (!lutId) return Promise.resolve(null);
    let pending = lutReads.get(lutId);
    if (!pending) {
      pending = (async () => {
        const blob = await api._getBlob(lutId, { format: 'cube', fetchIfMissing: true }) ?? await api._getBlob(lutId, { fetchIfMissing: true });
        if (!blob) return null;
        const { parseLutText } = await import('../../../../engine/src/grade.ts');
        return parseLutText(await blob.text(), lutId);
      })().catch(() => null);
      lutReads.set(lutId, pending);
    }
    return pending;
  };
  const bakeLook = (cacheKey: string, blob: Blob, look: PhotoTreatment, themeKey: string): Promise<Blob> => {
    let pending = lookBakes.get(cacheKey);
    if (!pending) {
      pending = (async () => {
        const { resolvePhotoLook } = await import('../../../../engine/src/photo-look.ts');
        const lut = look.kind === 'lut' ? await lutFor(resolvePhotoLook(look, themeKey).lut) : null;
        if (look.kind === 'lut' && !lut) throw new Error(`the LUT of photo look ${look.id} is unavailable`);
        const { bakePhotoLookBlob } = await import('./photo-look-bake.ts');
        return bakePhotoLookBlob({ blob, look, ...(themeKey !== 'base' ? { theme: themeKey } : {}), ...(lut ? { lut } : {}) });
      })().finally(() => { lookBakes.delete(cacheKey); });
      lookBakes.set(cacheKey, pending);
    }
    return pending;
  };
  const bakedFormat = (blob: Blob): string => (blob.type === 'image/png' ? 'png' : 'jpg');
  /** A short stable key for an inline picture, so a data: URL is never a map key. */
  const inlineKey = (dataUrl: string): string => {
    let h = 0x811c9dc5;
    for (let i = 0; i < dataUrl.length; i += 1) h = Math.imul(h ^ dataUrl.charCodeAt(i), 0x01000193) >>> 0;
    return `inline/${h.toString(16).padStart(8, '0')}-${dataUrl.length}`;
  };

  /** An upload (`user/...`) or an inline picture (`data:`) with a photo look. */
  const lookedPicture = async (id: string, baseId: string, treatment: string, opts: { version?: string; tokenSelection?: Readonly<Record<string, string>> }): Promise<AssetRef> => {
    const def = (await api._photoTreatments()).find(t => t.id === treatment);
    if (baseId.startsWith('user/')) {
      const rec = await (await assetHistory()).readUserAssetVersion(db, baseId, opts.version);
      if (!rec) throw new Error(`User asset not found: ${baseId}`);
      const plainKey = `user:${baseId}:${rec.format}:${rec.version ?? 'x'}`;
      if (!def || healLegacyType(rec) !== 'raster' || !rec.blob) return toAssetRef({ ...rec, id, cacheKey: plainKey }, 'user');
      const { photoLookThemeKey, photoLookCacheKey } = await import('../../../../engine/src/photo-look.ts');
      const themeKey = photoLookThemeKey(def, opts.tokenSelection);
      const cacheKey = photoLookCacheKey(baseId, rec.version ?? 'x', def, themeKey);
      const meta = { ...rec.meta, treatment, baseId, ...(themeKey !== 'base' ? { lookTheme: themeKey } : {}) };
      if (OBJECT_URL_CACHE.has(cacheKey)) return toAssetRef({ ...rec, id, cacheKey, meta, format: OBJECT_URL_FORMAT.get(cacheKey) ?? rec.format }, 'user');
      try {
        const baked = await bakeLook(cacheKey, rec.blob, def, themeKey);
        OBJECT_URL_FORMAT.set(cacheKey, bakedFormat(baked));
        return await toAssetRef({ ...rec, id, blob: baked, format: bakedFormat(baked), cacheKey, meta }, 'user');
      } catch (error) {
        console.warn(`[assets] photo look ${treatment} was not applied to ${baseId}:`, error);
        return toAssetRef({ ...rec, id, cacheKey: plainKey }, 'user');
      }
    }
    const ref = await (await import('./url-asset.ts')).resolveUrlAsset(baseId);
    if (!def || ref.type !== 'raster') return { ...ref, id };
    const { photoLookThemeKey, photoLookCacheKey } = await import('../../../../engine/src/photo-look.ts');
      const themeKey = photoLookThemeKey(def, opts.tokenSelection);
    const cacheKey = photoLookCacheKey(inlineKey(baseId), 'x', def, themeKey);
    const meta = { ...ref.meta, treatment, ...(themeKey !== 'base' ? { lookTheme: themeKey } : {}) };
    const cached = OBJECT_URL_CACHE.get(cacheKey);
    if (cached) return { ...ref, id, url: cached, format: OBJECT_URL_FORMAT.get(cacheKey) ?? ref.format, meta };
    try {
      const baked = await bakeLook(cacheKey, await (await fetch(ref.url)).blob(), def, themeKey);
      const url = URL.createObjectURL(baked);
      OBJECT_URL_CACHE.set(cacheKey, url);
      OBJECT_URL_FORMAT.set(cacheKey, bakedFormat(baked));
      return { ...ref, id, url, format: bakedFormat(baked), meta };
    } catch (error) {
      console.warn('[assets] photo look was not applied to an inline picture:', error);
      return { ...ref, id };
    }
  };

  const api = {
    async resolveProvider(ref: { provider: string; scope: string; path: string }): Promise<AssetRef | null> {
      if (ref.provider === 'catalog' || ref.provider === 'library') {
        try { return await api.get([ref.scope, ref.path].filter(Boolean).join('/')); } catch { return null; }
      }
      if (ref.provider === 'image' && ref.scope === 'brand') {
        const slot = ref.path || 'logo';
        const matches = await api.query({ tags: [slot] });
        const picked = matches[0] ?? (slot === 'logo' ? (await api.query({ tags: ['logo'] }))[0] : undefined);
        if (!picked) return null;
        try { return await api.get(picked.id); } catch { return null; }
      }
      return null;
    },
    async get(id: string, opts: { format?: string; version?: string; tokenSelection?: Readonly<Record<string, string>> } = {}): Promise<AssetRef> {
      // A PROCEDURAL asset: `zzfxm:<seed>[:<style>]` names a song that is
      // synthesised on demand, not a file anything stores. There are no bytes
      // to look up, so the ref resolves to ITSELF (`url === id`), and the
      // seed travels intact through the engine's `resolveAssetRefs`, the one
      // resolution path every consumer shares. Without this the engine's
      // `resolveOne` falls through to a catalog lookup, throws "Asset not in
      // catalog", nulls the field before hooks run, and the bed silently
      // vanishes from both the timeline and the export. See
      // engine/src/zzfxm-ref.ts.
      if (isZzfxmRef(id)) {
        const ref = parseZzfxmRef(id);
        if (!ref) throw new Error(`Malformed procedural audio ref: ${id}`);
        const canonical = formatZzfxmRef(ref);
        return {
          source: 'library', id: canonical, type: 'audio', format: 'zzfxm', url: canonical,
          meta: { name: 'Generated music', generated: true, seed: ref.seed, ...(ref.style ? { style: ref.style } : {}) },
        };
      }
      // A photo look on an upload or an inline picture (plan 291 W7). Parsed BEFORE the
      // user branch, which would look the whole treated id up, miss, and drop the picture.
      const looked = parseTreatedAssetId(id);
      if (looked.treatment && (looked.baseId.startsWith('user/') || /^data:/i.test(looked.baseId))) {
        return lookedPicture(id, looked.baseId, looked.treatment, opts);
      }
      if (id.startsWith('user/')) {
        const userAsset = await (await assetHistory()).readUserAssetVersion(db, id, opts.version);
        if (!userAsset) throw new Error(`User asset not found: ${id}`);
        return toAssetRef(userAsset, 'user');
      }

      // A DIRECT URL as the asset id - `data:` inline bytes, or an http(s) file
      // (Andy, 2026-08-28: asset inputs accept URLs, not only files - the door
      // agents and URL-mode links arrive through, e.g. `/t/frame?image=<url>`).
      // Lolly share links never reach here: the runtime's resolveOne routes
      // them to compose first, so this is a plain fetch of plain bytes. What
      // actually SUCCEEDS is platform policy, not this code: the web shell's
      // CSP admits 'self' + data: (+ its connect-src allowlist) and refuses
      // arbitrary origins by posture; Tauri and the CLI admit more. A blocked
      // or failed fetch throws, and resolveOne already drops the asset with a
      // logged warning instead of breaking the mount.
      if (/^data:/i.test(id) || /^https?:\/\//i.test(id)) {
        return await (await import('./url-asset.ts')).resolveUrlAsset(id);
      }

      // A presentation modifier can ride in the id, chosen at pick time and
      // baked into a derived copy at resolve. The base asset is always
      // resolved normally first (blob cache keyed by base id):
      //   `<baseId>?theme=<themeId>` - a themable two-colour icon pairing
      //   `<baseId>?treatment=<id>` - a raster photo colour treatment
      // An id carries at most one, so baseId comes from whichever matched.
      const { baseId: themedBase, theme } = parseThemedAssetId(id);
      const { baseId: treatedBase, treatment } = parseTreatedAssetId(id);
      const baseId = theme ? themedBase : treatedBase;
      const parsedFile = parseFileAssetId(baseId);
      const storedMeta = await db.get('asset-meta', parsedFile.baseId);
      if (!storedMeta) throw new Error(`Asset not in catalog: ${id}`);
      const currentMeta = await fileMeta(storedMeta, parsedFile.file);
      const historical = opts.version !== undefined && opts.version !== currentMeta.version;
      const meta = historical ? { ...currentMeta, version: opts.version!, checksum: undefined } : currentMeta;

      const format = pickFormat(meta, opts.format);
      if (opts.format && format.format !== opts.format) throw new Error(`Asset format unavailable: ${id} (${opts.format})`);
      const version = opts.version ?? meta.version;
      const blobKey = `${baseId}:${format.format}:${version}`;
      // durationMs is authored on the FORMAT entry (beside width/height) but
      // read from ref.meta, so it has to be lifted here. Otherwise a catalog
      // clip's authored length is invisible to the picker badge and the
      // timeline. Same "finite and positive or absent" rule the upload path
      // applies; never a 0 placeholder.
      const durationMs = typeof format.durationMs === 'number' && Number.isFinite(format.durationMs) && format.durationMs > 0
        ? format.durationMs : undefined;
      const refMeta = {
        ...withoutReservedMeta(meta.meta),
        name: meta.name,
        tags: meta.tags,
        ...(meta.provider ? { provider: meta.provider } : {}),
        ...(meta.description ? { description: meta.description } : {}),
        ...(meta.aiGenerated ? { aiGenerated: meta.aiGenerated } : {}),
        // Licensing signals ride onto the resolved ref so downstream (e.g.
        // the `.lolly` share file, plans/114) can tell a freely-shareable
        // catalog asset from proprietary/brand-locked content that must not
        // travel by default.
        //
        // All three ride, not just the licence (plan 253). A resolved ref used
        // to carry `license` alone, so a work whose licence asks for a credit
        // arrived at the export and pack paths with the credit already gone -
        // the one field those paths need to deliver it.
        ...(meta.brandLock ? { brandLock: true } : {}),
        ...((meta as { license?: string }).license ? { license: (meta as { license?: string }).license } : {}),
        ...((meta as { attribution?: string }).attribution ? { attribution: (meta as { attribution?: string }).attribution } : {}),
        ...((meta as { rights?: unknown }).rights ? { rights: (meta as { rights?: unknown }).rights } : {}),
        ...(durationMs != null ? { durationMs } : {}),
      };

      const loadBlob = async (): Promise<Blob> => {
        let blob = await db.get('asset-blob', blobKey);
        if (!blob) {
          if (historical) throw new Error(`Asset version unavailable: ${id} (${version})`);
          if (meta.tier === 'on-demand') {
            blob = await fetchAndCacheOnce(meta, format, blobKey);
          } else {
            throw new Error(`Asset not cached: ${id} (tier: ${meta.tier})`);
          }
        }
        return blob;
      };

      if (theme) {
        const def = (await api._iconThemes()).find(t => t.id === theme);
        if (def) {
          // Cache key carries the pairing's colours, so palette edits re-bake,
          // and a resolve whose bake is already minted skips the blob entirely.
          const cacheKey = `library:${blobKey}:t:${theme}:${def.c1},${def.c2}`;
          const common = { ...meta, id, format: format.format, cacheKey, meta: { ...refMeta, theme, baseId } };
          if (OBJECT_URL_CACHE.has(cacheKey)) return toAssetRef(common, 'library');
          const { applyIconTheme } = await import('../../../../engine/src/icon-theme.ts');
          const baked = applyIconTheme(await (await loadBlob()).text(), def);
          if (baked) {
            return toAssetRef({ ...common, blob: new Blob([baked], { type: 'image/svg+xml' }) }, 'library');
          }
        }
        // Unknown theme or a non-themable file: serve the plain bytes but
        // KEEP the requested id. A theme that's temporarily unresolvable
        // must not be stripped from state the next save persists (and the
        // CLI bridge behaves the same way). Shares the base asset's object URL.
        return toAssetRef({
          ...meta, id, blob: await loadBlob(), format: format.format,
          cacheKey: `library:${blobKey}`, meta: refMeta,
        }, 'library');
      }

      if (treatment && meta.type === 'raster') {
        const { isRasterPhotoLook, photoLookThemeKey, photoLookCacheKey, resolvePhotoLook } = await import('../../../../engine/src/photo-look.ts');
        const { wrapRasterWithTreatment } = await import('../../../../engine/src/photo-treatment.ts');
        let def = (await api._photoTreatments()).find(t => t.id === treatment);
        let themeSuffix = '';
        if (def && (isRasterPhotoLook(def) || def.themes)) {
          // A theme variant picks the definition (plan 291 W7); a look only pixels reproduce bakes here.
          const themeKey = photoLookThemeKey(def, opts.tokenSelection);
          if (isRasterPhotoLook(def)) {
            const cacheKey = photoLookCacheKey(`${baseId}:${format.format}`, version ?? 'x', def, themeKey);
            const lookMeta = { ...refMeta, treatment, baseId, ...(themeKey !== 'base' ? { lookTheme: themeKey } : {}) };
            if (OBJECT_URL_CACHE.has(cacheKey)) return toAssetRef({ ...meta, id, format: OBJECT_URL_FORMAT.get(cacheKey) ?? format.format, cacheKey, meta: lookMeta }, 'library');
            try {
              const baked = await bakeLook(cacheKey, await loadBlob(), def, themeKey);
              OBJECT_URL_FORMAT.set(cacheKey, bakedFormat(baked));
              return await toAssetRef({ ...meta, id, blob: baked, format: bakedFormat(baked), cacheKey, meta: lookMeta }, 'library');
            } catch (error) {
              console.warn(`[assets] photo look ${treatment} was not applied to ${baseId}:`, error);
              def = undefined;
            }
          } else {
            def = resolvePhotoLook(def, themeKey);
            if (themeKey !== 'base') themeSuffix = `:${themeKey}`;
          }
        }
        // The wrapper is a fixed-size SVG, so it needs the photo's pixel
        // dimensions. The primary (jpg) format entry frequently omits them,
        // so fall back to whatever sibling format that carries a pair (e.g. the
        // thumb): all share the source aspect, which is all the viewBox
        // needs. Without this fallback the bake silently no-ops and the
        // plain (untreated) photo is served, so a picked treatment wouldn't
        // survive into the tool render.
        const dimSrc = (format.width && format.height) ? format : meta.formats.find(f => f.width && f.height);
        const w = dimSrc?.width, h = dimSrc?.height;
        if (def && w && h) {
          // The derived ref keeps the BASE format (jpg), not svg: it's
          // still the jpg blob that backs it, and pruning protects
          // `<baseId>:jpg:<version>`, the key the derived object URL
          // depends on.
          const cacheKey = `library:${blobKey}:pt:${treatment}${themeSuffix}`;
          const common = { ...meta, id, format: format.format, cacheKey, meta: { ...refMeta, treatment, baseId } };
          if (format.format === 'jxl') {
            const original = await toAssetRef({ ...meta, blob: await loadBlob(), format: 'jxl', cacheKey: `library:${blobKey}` }, 'library');
            const href = await blobToDataUri(await (await fetch(original.url)).blob());
            const svg = wrapRasterWithTreatment({ href, width: w, height: h, treatment: def });
            const display = await toAssetRef({ ...common, format: 'svg', blob: new Blob([svg], { type: 'image/svg+xml' }) }, 'library');
            return { ...display, format: 'jxl', original: original.original };
          }
          if (OBJECT_URL_CACHE.has(cacheKey)) return toAssetRef(common, 'library');
          const href = await blobToDataUri(await loadBlob());
          const svg = wrapRasterWithTreatment({ href, width: w, height: h, treatment: def });
          return toAssetRef({ ...common, blob: new Blob([svg], { type: 'image/svg+xml' }) }, 'library');
        }
        // Unknown/invalid treatment or missing dimensions: plain bytes, keep the
        // id (same reasoning as the theme fallback above).
        return toAssetRef({
          ...meta, id, blob: await loadBlob(), format: format.format,
          cacheKey: `library:${blobKey}`, meta: refMeta,
        }, 'library');
      }

      return toAssetRef({ ...meta, blob: await loadBlob(), format: format.format, meta: refMeta }, 'library');
    },

    /**
     * Internal: colour pairings for themable icons, from the catalog's
     * palette asset tagged "icon-themes". [] when the catalog has none.
     * First entry is the default pairing (matches the fills baked into icons).
     * Caches the in-flight promise so concurrent cold-cache resolves share one
     * metadata scan; a transient failure is NOT cached (next call retries).
     */
    async _iconThemes(): Promise<IconTheme[]> {
      ICON_THEMES_CACHE ??= (async (): Promise<IconTheme[]> => {
        const all = await db.getAll('asset-meta');
        const pal = all.find(m => m.type === 'palette' && m.tags?.includes('icon-themes'));
        if (!pal) {
          // Distinguish "synced catalog has no themes" (cacheable) from
          // "metadata hasn't synced yet" (retry once it has).
          if (!all.length) throw new Error('asset metadata not synced yet');
          return [];
        }
        const blob = await api._getBlob(pal.id);
        const { parseIconThemesDoc } = await import('../../../../engine/src/icon-theme.ts');
        return parseIconThemesDoc(JSON.parse(await blob!.text()));
      })().catch(() => {
        ICON_THEMES_CACHE = null; // unavailable ≠ broken: icons stay default, retry later
        return [];
      });
      return ICON_THEMES_CACHE;
    },

    /**
     * Internal: colour treatments for raster photos, from the catalog's palette
     * asset tagged "photo-treatments". [] when the catalog has none. Same caching
     * discipline as _iconThemes(); "None" is not listed here (it's the plain
     * photo with no id suffix - the picker prepends it).
     */
    async _photoTreatments(): Promise<PhotoTreatment[]> {
      PHOTO_TREATMENTS_CACHE ??= (async (): Promise<PhotoTreatment[]> => {
        const all = await db.getAll('asset-meta');
        const pal = all.find(m => m.type === 'palette' && m.tags?.includes('photo-treatments'));
        if (!pal) {
          if (!all.length) throw new Error('asset metadata not synced yet');
          return [];
        }
        const blob = await api._getBlob(pal.id);
        const { parsePhotoTreatmentsDoc } = await import('../../../../engine/src/photo-treatment.ts');
        return parsePhotoTreatmentsDoc(JSON.parse(await blob!.text()));
      })().catch(() => {
        PHOTO_TREATMENTS_CACHE = null; // unavailable ≠ broken: photos stay untreated, retry later
        return [];
      });
      return PHOTO_TREATMENTS_CACHE;
    },

    async query(filter: AssetQuery = {}): Promise<AssetRef[]> {
      const all = await db.getAll('asset-meta');
      const filtered = all.filter(m => matchesFilter(m, filter));
      // Don't pre-resolve blob URLs: that forces every cached blob into
      // memory. Every format carries a static catalog URL (same-origin for
      // core/catalog, CDN for on-demand), so the picker can show a thumbnail
      // directly without a cached blob first. Only flag a placeholder when
      // there's genuinely no URL to resolve (an unresolved/on-demand tier
      // with no static formats[0].url).
      return Promise.all(filtered.map(async (m): Promise<AssetRef> => {
        // Pick the format the picker should point at: for video the actual
        // clip (a <video> plays it), for everything else formats[0], never a
        // companion still.
        const primary = m.formats.length ? pickFormat(m) : undefined;
        // A still poster (a non-animation companion format) for the types
        // that need one: a lottie thumbnails from it (an <img> can't show
        // the json); a video can use it as its <video poster>. Excludes the
        // animation/clip formats.
        const still = m.formats.find(f => f.format === 'thumb')?.url
          ?? m.formats.find(f => /^(svg|png|webp|jpe?g|gif|avif)$/i.test(f.format))?.url ?? '';
        const lottiePoster = m.type === 'lottie' ? still : '';
        const videoPoster = m.type === 'video' ? still : '';
        // A 3-D model (GLB) or a LUT (.cube colour grade) tiles from a rendered still:
        // the companion PNG/WebP (the mesh / lookup table stays `primary`/`url` so the
        // tool that consumes it still fetches the real file, not the picture of it).
        const filePoster = (m.type === 'model' || m.type === 'lut')
          ? (m.formats.find(f => /^(png|webp|jpe?g)$/i.test(f.format))?.url ?? '')
          : '';
        if (primary?.format === 'jxl') return api.get(m.id);
        const directUrl = lottiePoster || (primary?.url ?? '');
        // Catalog animated rasters (gif/apng/animated-webp) are authored
        // type:'raster' and tagged "animated" so the picker badges the
        // motion (user uploads carry the same flag from ingest). Same-MIME
        // still/animated can't be told apart otherwise.
        const animated = m.type === 'raster' && (m.tags?.includes('animated') ?? false);
        const posterUrl = lottiePoster || videoPoster || filePoster;
        // The small WebP derivative (scripts/build-thumbnails.ts), if this
        // raster has one. Surfaced so a grid/list view can show the ~30 KB
        // thumb instead of the full-res original while a details/zoom view
        // still resolves `url` (the original) for quality.
        const thumbUrl = m.formats.find(f => f.format === 'thumb')?.url ?? '';
        // The playable animation (JSON) for a lottie: `directUrl`/`url`
        // point at the still poster so an <img> thumbnail works, so surface
        // the json separately for a looping motion preview
        // (catalog/picker). Video needs none: its directUrl is the clip.
        const animationUrl = m.type === 'lottie' ? (m.formats.find(f => f.format === 'json')?.url ?? '') : '';
        return {
          source: 'library',
          id: m.id,
          type: m.type,
          format: primary?.format ?? 'svg',
          url: directUrl,
          version: m.version,
          meta: {
            // The entry's own `meta` block (schemas/asset.schema.json): the
            // type-specific facts a shell needs BEFORE it downloads the bytes,
            // such as an emoji pack's pin and glyph count. It rides first so the
            // computed keys below always win a name collision, and the keys that
            // decide identity or rights are stripped out of it first - the schema
            // states outright that this blob is "not validated beyond being an
            // object", so an entry could otherwise answer a question about its
            // own licence that nothing checked, and answer it differently here
            // than on the resolved-ref path below.
            ...withoutReservedMeta(m.meta),
            name: m.name, tags: m.tags, _placeholder: !directUrl,
            ...(m.provider ? { provider: m.provider } : {}),
            ...(m.description ? { description: m.description } : {}),
            // The primary format's byte length, straight off the index. A shell
            // that must refuse a file BEFORE downloading it (an emoji pack has a
            // 32 MiB ceiling) has nothing else to read: `bytes()` materialises
            // the whole thing before anyone can check its size.
            ...(typeof primary?.size === 'number' ? { size: primary.size } : {}),
            ...(posterUrl ? { posterUrl } : {}),
            ...(animated ? { animated: true } : {}),
            ...(thumbUrl ? { thumbUrl } : {}),
            ...(animationUrl ? { animationUrl } : {}),
            ...(m.aiGenerated ? { aiGenerated: m.aiGenerated } : {}),
            ...(m.added ? { added: m.added } : {}),
            ...(m.license ? { license: m.license } : {}),
            ...(m.attribution ? { attribution: m.attribution } : {}),
            ...(m.rights ? { rights: m.rights } : {}),
          },
        };
      }));
    },

    /**
     * Internal: called only by the picker UI to stash an uploaded blob.
     * Tools cannot call this directly: it's prefixed with _ to mark it as
     * non-public, and not declared in the v1 bridge contract.
     *
     * No count cap (see USER_ASSET_MILESTONES). assertQuotaRoom() is the
     * only guard, at the bridge boundary so it can't be bypassed by a
     * different caller, and it refuses a write only when device storage is
     * genuinely tight.
     *
     * `skipQuota` is for the ONE write that is not a net addition: the
     * copy-on-write preservation of bytes that are being released in the
     * same breath (a delete). Nothing outside bridge/version-assets.ts
     * passes it, and it is not on the record, so a caller cannot set it by
     * accident.
     */
    async _uploadUserAsset(record: UserAssetRecord, upOpts: { skipQuota?: boolean; expectedVersion?: string | null } = {}): Promise<void> {
      // Before assertQuotaRoom on purpose: the preserved copy has to exist
      // before the incoming write can fail on quota, or a tight device
      // would drop a published version's bytes on the floor while refusing
      // the replacement.
      await opts.preservePinned?.(record.id);
      if (!upOpts.skipQuota) await assertQuotaRoom(record.blob?.size ?? 0);
      // The AI-kind memo is keyed by id and valid only while the bytes under that id don't
      // change. This write may REPLACE the bytes at an existing id (Replace reuses an id), so a
      // stale verdict from the previous image must not survive onto the new bytes - drop it and
      // let the flag recompute from the new record's own credential below.
      AI_KIND_MEMO.delete(record.id);
      // Capture the incoming bytes' Content Credentials, unless the caller already
      // did. `credential(id)` reads `rec.credential` and nothing else - there is no
      // byte-scan behind it, because an upload's stored pixels were re-encoded and
      // no longer carry the store - so a record written without that field has no
      // provenance at all the moment anything asks. Two writers did exactly that: a
      // video job's output, which is stamped INTO the bytes it then uploads, and the
      // audio/MIDI/Lottie uploads the picker's own extraction skips (a credentialed
      // voice or music file, synthetic-audio disclosure included). This is the bridge
      // boundary, the one place every writer passes, so it is where the capture
      // belongs. A caller that already extracted wins: the picker can fall back to
      // the ORIGINAL file's manifest when a re-encode dropped it, and these bytes
      // cannot show that. The cost is one extra read of an upload the picker already
      // scanned and found clean - bounded by the same cap the rest of the shell
      // refuses to scan past, and cheap against losing a credential. Never fatal.
      await captureUserAssetCredentials(record);
      // Content-modification stamp (plans/132 WP-A): every write through this
      // path is a content change (ingest, replace, trim, duplicate), so the
      // catalog can sort/show "Modified". _importUserAsset (backup restore)
      // deliberately does NOT stamp - a restore preserves history.
      record.meta = { ...record.meta, modifiedAt: Date.now() };
      await (await assetHistory()).writeVersionedUserAsset(db, record, upOpts.expectedVersion);
    },

    /**
     * Internal: duplicate one user upload, a byte-identical copy under a
     * fresh id and a "... copy" name. Everything else rides along unchanged
     * (the same blob, format, dimensions, preserved Content Credential and
     * AI flag), so the copy verifies exactly like its source. The write goes
     * through _uploadUserAsset, so a duplicate is quota-checked like whatever
     * other addition: a copy is real bytes on the device, not a free alias.
     * Returns the new id, or null if the source is already gone.
     */
    async _duplicateUserAsset(id: string): Promise<string | null> {
      const src = await db.get('user-assets', id);
      if (!src) return null;
      const taken = new Set((await db.getAll('user-assets')).map(r => String(r.meta?.name ?? '')));
      const srcName = String(src.meta?.name ?? id.split('/').pop() ?? 'image');
      const record: UserAssetRecord = {
        ...withoutTrashMark(src),
        id: mintDuplicateId(id),
        meta: { ...src.meta, name: nextCopyName(srcName, taken) },
      };
      await api._uploadUserAsset(record);
      return record.id;
    },

    /** Internal: one stored user-asset record (type/format/meta/version/blob) by
     *  id, or null. The copy-on-write preserver needs the RECORD, not just the
     *  blob, to write a faithful frozen copy of what it is about to lose. */
    async _getUserRecord(id: string, version?: string): Promise<UserAssetRecord | null> {
      return (await (await assetHistory()).readUserAssetVersion(db, id, version)) as UserAssetRecord | null;
    },

    async _listUserAssetVersions(id: string) {
      return (await import('./asset-cache-maintenance.ts')).listNamedUserAssetVersions(db, id);
    },
    async _restoreUserAssetVersion(id: string, version: string): Promise<void> {
      const snapshot = await (await assetHistory()).readUserAssetVersion(db, id, version);
      if (!snapshot?.blob) throw new Error('Saved version not found.');
      // A restore creates a new head and snapshots the replaced head. It never
      // moves or overwrites the immutable version selected by the designer.
      await api._uploadUserAsset({ ...withoutTrashMark(snapshot as UserAssetRecord), version: crypto.randomUUID() });
      evictObjectUrlsByPrefix(`user:${id}:`);
    },
    async _removeUserAssetVersion(id: string, version: string): Promise<void> { await (await assetHistory()).removeUserAssetVersions(db, id, version); },

    /** Internal: list the user's saved images, newest first, as resolved AssetRefs.
     *  Frozen rows (bytes a published design-system version pins, preserved by
     *  copy-on-write) are machine-owned and hidden: the user never chose them
     *  and cannot meaningfully act on them. They still COUNT toward
     *  _userAssetsSize for storage honesty, and the Versions panel reports
     *  their total separately. */
    async _listUserAssets(): Promise<AssetRef[]> {
      // Trashed uploads (plan 277 P3) are hidden like frozen rows: the Trash
      // lists them through _listTrashedUserAssets, and their bytes still count.
      const all = (await db.getAll('user-assets')).filter(r => !String(r.id).startsWith(FROZEN_PREFIX) && !r.trashedAt);
      // Only older records (pre-dating the persisted flag) need the provenance
      // reader; when none do, the whole c2pa cluster is never fetched.
      const needsRead = all.some(r => r.aiGenerated === undefined && r.credential && r.credentialFormat);
      const c2pa = needsRead ? await loadC2paVerify() : null;
      return Promise.all(all
        // Newest first by real creation time (the id's <ms>), with the id as a stable
        // tiebreak so same-ms duplicates keep their padded-counter order (newer first).
        .sort((a, b) => (userIdTime(String(b.id)) - userIdTime(String(a.id)))
          || String(b.id).localeCompare(String(a.id)))
        .map(async rec => {
          const ref = await toAssetRef(rec, 'user');
          // Surface the AI flag on the ref (persisted on the record for new uploads;
          // recomputed from `credential` for older ones that predate this).
          const ai = detectAiGenerated(rec, c2pa);
          if (ai) ref.meta = { ...(ref.meta ?? {}), aiGenerated: ai };
          return ref;
        }));
    },

    /**
     * Internal: full user-asset records *including the raw Blob*, for the data
     * backup/export. Unlike _listUserAssets (which returns AssetRefs without the
     * bytes), this hands back exactly what's stored so a bundle can round-trip it.
     */
    async _exportUserAssets(): Promise<UserAssetRecord[]> {
      return db.getAll('user-assets');
    },

    /**
     * Internal: write a user-asset record straight back in from a backup import.
     * Deliberately bypasses the personal-library cap and quota check - a restore
     * should faithfully reproduce the library the user exported, not be rejected
     * for being "too big" on arrival.
     */
    async _importUserAsset(record: UserAssetRecord): Promise<void> {
      // A restore rewrites ids on faith, so it can land on top of bytes a
      // published version pins exactly like an upload can.
      await opts.preservePinned?.(record.id);
      await (await assetHistory()).writeVersionedUserAsset(db, record, undefined, 'import');
    },

    /** Internal: how many images are in the user's personal library. */
    async _userAssetsCount(): Promise<number> {
      return (await db.getAllKeys('user-assets')).length;
    },

    /**
     * Internal: every catalog asset's BASE id (the 'asset-meta' keys). Used
     * by the folder reconciler (folders.ts prune) so a catalog asset
     * REFERENCED into a project folder (a pointer, not a user-owned copy)
     * isn't mistaken for a dangling image ref and pruned away. Cheap: a
     * key-only read, no blobs.
     */
    async _listCatalogAssetIds(): Promise<string[]> {
      return (await db.getAllKeys('asset-meta')).map(String);
    },

    /** Internal: total bytes the user's images occupy (for the storage UI). */
    async _userAssetsSize(): Promise<number> {
      const all = await db.getAll('user-assets');
      return all.reduce((sum, r) => sum + (r?.blob?.size ?? 0), 0);
    },

    /** Internal: bytes of design material per design system (plans/186 section
     *  3.9), keyed by system id - the tokens head, its versions, fonts and logos.
     *  Personal uploads and shared frozen bytes belong to no system and are not
     *  counted here; the storage UI shows them in their own rows. */
    async _designMaterialSizes(): Promise<Record<string, number>> {
      return (await import('./asset-cache-maintenance.ts')).designMaterialSizes(db);
    },

    /**
     * Internal: move one upload to the Trash, or back out of it (plan 277
     * P3). Only a mark on the record: the id, bytes, versions and cached
     * object URL stay, so a saved design that uses the picture keeps drawing
     * and a restore is exact. A read-modify-write like _renameUserAsset, so
     * no quota check and no pin preservation (no bytes change). Returns false
     * when the record is gone. Web-app deletes only; every other caller
     * keeps using _deleteUserAsset, which deletes at once.
     *
     * `expect` makes it a compare-and-set (review B3): the write happens only
     * while the record's mark is exactly that (`null` = not in the Trash), so a
     * restore from a stale Trash row never unmarks an upload trashed again
     * since, and a Trash move never re-dates one already there.
     */
    async _setUserAssetTrashed(id: string, trashedAt: string | null, setOpts: { expect?: string | null } = {}): Promise<boolean> {
      return (await import('./asset-cache-maintenance.ts')).setUserAssetTrashed(db, id, trashedAt, setOpts);
    },

    /** Internal: the uploads now in the Trash, for the Trash view and its sweep. */
    async _listTrashedUserAssets(): Promise<TrashedUserAssetRow[]> {
      return (await import('./asset-cache-maintenance.ts')).listTrashedUserAssets(db);
    },

    /** Internal: delete one user image and revoke its cached object URL. */
    async _deleteUserAsset(id: string): Promise<void> {
      await api._deleteUserAssetWhere(id);
    },

    /**
     * Internal: the Trash's permanent delete (Delete forever, Empty Trash, the
     * 30-day purge; review B3). Deletes only while the upload is still in the
     * Trash under the same mark, checked before the pin pass and again inside
     * the delete transaction, so a stale Trash row can never delete an upload
     * that was restored (or trashed again) in the meantime. False when the
     * record is gone or no longer carries that mark; nothing is touched then.
     */
    async _deleteTrashedUserAsset(id: string, trashedAt: string): Promise<boolean> {
      const rec = await db.get('user-assets', id).catch(() => undefined);
      if (!rec || rec.trashedAt !== trashedAt) return false;
      return api._deleteUserAssetWhere(id, trashedAt);
    },

    /** Internal: the one delete path behind both methods above. With
     *  `onlyIfTrashedAt` the transaction deletes only a record still carrying
     *  that Trash mark, and answers false otherwise. */
    async _deleteUserAssetWhere(id: string, onlyIfTrashedAt?: string): Promise<boolean> {
      // Deleting is the most complete way to destroy pinned bytes, so it
      // gets the same preservation pass as a replacement, but marked
      // `reclaiming`, because here the preserved copy REPLACES the bytes it
      // saves instead of joining them. Quota-checking it would let a full
      // device refuse the one action that frees space, which is a dead end
      // with no way out.
      await opts.preservePinned?.(id, { reclaiming: true });
      // Read the record first: the deletion event below carries its type so
      // listeners can react without re-querying a store the record just left.
      const rec = await db.get('user-assets', id).catch(() => undefined) as { type?: string } | undefined;
      if (!(await (await assetHistory()).deleteUserAsset(db, id, onlyIfTrashedAt))) return false;
      // toAssetRef keys user URLs as `user:<id>:<format>:<version>` - evict whatever.
      evictObjectUrlsByPrefix(`user:${id}:`);
      // The AI-kind memo is keyed by id; the bytes are gone, so its verdict must not linger to
      // be re-applied should this id ever be reused.
      AI_KIND_MEMO.delete(id);
      // EVERY user-asset delete funnels through here (catalog, picker,
      // folder overlay, projects). Announce it so cross-cutting reactions
      // (e.g. the Neurospicy player dropping a deleted audio track, wired in
      // main.ts) can't be skipped by whichever surface did the deleting.
      if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('lolly:user-asset-deleted', { detail: { id, type: rec?.type } }));
      }
      return true;
    },

    /**
     * Internal: rename one user image, a read-modify-write of only
     * `meta.name`. Deliberately does NOT route through _uploadUserAsset:
     * that would re-run assertQuotaRoom against the (unchanged) blob size
     * and could spuriously trip STORAGE_FULL near quota. The id and
     * `version` are untouched, so the cached object URL stays valid (no
     * eviction) and _listUserAssets order is preserved. No-op if the asset
     * is gone.
     */
    async _renameUserAsset(id: string, name: string): Promise<void> {
      return (await import('./asset-cache-maintenance.ts')).renameUserAsset(db, id, name);
    },

    /**
     * Internal: replace one user asset's `meta` wholesale (callers merge:
     * `{ ...rec.meta, ... }`), optionally stamping the record-level
     * `aiGenerated` flag alongside it - the user's own declare-AI-origins
     * choice, an annotation like the meta it travels with. A read-modify-write
     * like _renameUserAsset, and deliberately NOT routed through
     * _uploadUserAsset for the same reasons doubled: assertQuotaRoom would be
     * re-run against bytes this write doesn't add (a meta note is not new
     * storage worth metering, and near quota it could spuriously trip
     * STORAGE_FULL), and preservePinned would freeze a duplicate of a
     * version-pinned asset whose stored blob this write never touches. The id,
     * blob, credential and `version` all stay put, so cached object URLs
     * survive and _listUserAssets order is preserved. No-op if the asset is
     * gone.
     */
    async _updateUserAssetMeta(id: string, meta: Record<string, unknown>, patch: { aiGenerated?: 'full' | 'partial' | null } = {}): Promise<void> {
      return (await import('./asset-cache-maintenance.ts')).updateUserAssetMeta(db, id, meta, patch, key => { AI_KIND_MEMO.delete(key); });
    },

    /**
     * Internal: replace one user asset's stored bytes with a
     * provenance-stamped copy of THEMSELVES: the lazy heal for TTS clips
     * saved before Lolly embedded Content Credentials into audio files
     * (lib/tts-provenance.ts). The narrow case of _replaceUserAssetBytes
     * below, which is where the pin preservation, the delta-only quota check
     * and the `version` bump are explained; kept as its own name because the
     * heal has one job and reads better saying so.
     */
    async _restampUserAsset(id: string, patch: { blob: Blob; credential: Uint8Array; credentialFormat: string }): Promise<void> {
      // A heal is not an edit, so it keeps the clip's modifiedAt: a copy healed
      // here must not beat a take regenerated in another browser.
      await api._replaceUserAssetBytes(id, patch, { keepModifiedAt: true });
    },

    /**
     * Internal: replace one user asset's stored bytes at the SAME id - the
     * general form of _restampUserAsset (which is now this, with only a
     * credential to change). The regenerate path for a speech clip writes
     * through here: new audio, a fresh Content Credential over it, and the
     * `meta` keys the new take changed (plans/181 section 5.2). The id never
     * moves, so no box in whatever document is re-pointed and every `#/a?asset=`
     * link keeps resolving.
     *
     * Like _restampUserAsset before it: preservePinned FIRST, because the
     * previous bytes are what a published version checksummed; quota on the
     * byte DELTA only (re-running assertQuotaRoom on the full size could
     * spuriously trip STORAGE_FULL near quota for a write that adds almost
     * nothing); and `version` bumped so toAssetRef mints a fresh object URL
     * instead of serving the old bytes out of OBJECT_URL_CACHE.
     *
     * `meta` MERGES into the stored meta, so a caller passes only what
     * changed. A patch with no `credential` DROPS the stored one: it was
     * signed over bytes that no longer exist, and a credential that does not
     * bind its file is worse than none. No-op if the asset is gone.
     */
    async _replaceUserAssetBytes(
      id: string,
      patch: { blob: Blob; credential?: Uint8Array; credentialFormat?: string; meta?: Record<string, unknown> },
      replaceOpts: { keepModifiedAt?: boolean } = {},
    ): Promise<void> {
      const { replaceUserAssetBytes } = await import('./asset-cache-maintenance.ts');
      return replaceUserAssetBytes(db, id, patch, replaceOpts, QUOTA_SAFETY_FRACTION, { preserve: opts.preservePinned, clearMemo: key => { AI_KIND_MEMO.delete(key); }, evictPrefix: evictObjectUrlsByPrefix });
    },

    /**
     * Internal: called by catalog/sync.js at boot to populate asset metadata.
     * Not part of the public HostV1 bridge contract.
     */
    async _syncFromIndex(assets: AssetMetaRecord[], source?: { origin: string; tokensHead?: string | null }): Promise<void> {
      const { syncAssetIndex } = await import('./asset-cache-maintenance.ts');
      await syncAssetIndex(db, assets, source, key => { inFlight.delete(key); evictObjectUrlsByPrefix(`library:${key}`); });
      ICON_THEMES_CACHE = null;       // the icon-themes palette may have changed
      PHOTO_TREATMENTS_CACHE = null;  // …as may the photo-treatments palette
    },

    /**
     * Internal: cache a pre-fetched asset blob, keyed by id:format:version.
     * Called by prefetchAsset in catalog/sync.js.
     */
    async _cacheBlob(key: string, blob: Blob): Promise<void> {
      await db.put('asset-blob', blob, key);
    },

    async _hasBlob(key: string): Promise<boolean> {
      return (await db.get('asset-blob', key)) !== undefined;
    },

    /**
     * Internal: make sure ONE format's bytes are on device, sharing whatever fetch
     * already in flight for them. The single fetch-and-cache path: catalog/sync.ts's
     * core prefetch walks the index and calls this per format, and _getBlob's
     * `fetchIfMissing` reaches the same work for a reader that needs the bytes now.
     * Both used to fetch independently, which downloaded a file twice whenever the
     * two overlapped (see the inFlight note above).
     *
     * Resolves null when the bytes are already cached - nothing was fetched. Throws
     * AssetChecksumError on tampered bytes, and whatever the transport threw on an
     * unreachable file; the caller decides which of those is worth saying out loud.
     */
    async _ensureBlob(meta: AssetMetaRecord, format: AssetFormat): Promise<Blob | null> {
      const blobKey = `${meta.id}:${format.format}:${meta.version}`;
      if ((await db.get('asset-blob', blobKey)) !== undefined) return null;
      return await fetchAndCacheOnce(meta, format, blobKey);
    },

    /**
     * Internal: the raw cached Blob for an asset, without minting an object URL.
     * Used by callers that just want the bytes (e.g. tokens.loadDoc reading a
     * JSON document) so they don't pin an unused URL in OBJECT_URL_CACHE.
     * Resolves on-demand tiers the same way get() does. Returns null if absent.
     *
     * `fetchIfMissing` extends that fetch-and-cache fallback to whatever tier - for a
     * caller that needs the bytes NOW and would otherwise fetch the file itself.
     * Opt-in rather than the default: a core-tier asset is normally already on
     * device (catalog/sync.ts prefetches the whole tier on idle), and a caller that
     * is happy to wait for that must keep answering null rather than pulling bytes
     * onto the first-paint path. The one caller is bridge/tokens.ts, whose read
     * happens BEFORE that idle prefetch on a cold load: without this it fetched
     * brand.json itself, cached nothing, and the prefetch then downloaded the same
     * file a second time (measured by scripts/check-first-load.ts, 2026-09-12).
     * Going through fetchAndCache means those bytes are checksum-verified and
     * stored under the same id:format:version key the prefetch checks, so the
     * second download is skipped instead of deduplicated after the fact.
     */
    async _getBlob(
      id: string,
      opts: { format?: string; version?: string; fetchIfMissing?: boolean } = {},
    ): Promise<Blob | null> {
      // `user/...` ids live in the user-assets store as one already-resolved
      // blob (no format/version keying). Mirror get()'s resolution order so
      // callers like the tokens bridge can read a user-installed document by id.
      if (id.startsWith('user/')) {
        return (await (await assetHistory()).readUserAssetVersion(db, id, opts.version))?.blob ?? null;
      }
      const parsedFile = parseFileAssetId(id);
      const storedMeta = await db.get('asset-meta', parsedFile.baseId);
      if (!storedMeta) return null;
      let meta: AssetMetaRecord;
      try { meta = await fileMeta(storedMeta, parsedFile.file); } catch { return null; }
      const format = pickFormat(meta, opts.format);
      if (opts.format && format.format !== opts.format) return null;
      const version = opts.version ?? meta.version;
      const blobKey = `${id}:${format.format}:${version}`;
      let blob = await db.get('asset-blob', blobKey);
      if (!blob && version === meta.version && (meta.tier === 'on-demand' || opts.fetchIfMissing)) {
        blob = await fetchAndCacheOnce(meta, format, blobKey);
      }
      return blob ?? null;
    },

    /**
     * Internal: the HEAD asset of a given type, or null. The USER'S OWN
     * store first, then the synced catalog metadata. Lets a sibling bridge
     * discover a well-known singleton document (e.g. the brand `tokens`
     * asset), offline-safe once boot sync has run, instead of hardcoding a
     * brand-specific id.
     *
     * "Head" rather than "first" because of design-system versions (plans/97
     * section 6a): a published version is a sibling asset one segment DEEPER than
     * the system it belongs to (`user/tokens/brand/jupiter`), and it must
     * never be picked as the design system. pickHeadAssetId (the engine
     * predicate the MCP server and the CLI apply too) drops whatever id that is a
     * proper descendant of another id of the same type, and is otherwise
     * order-preserving: with zero or one asset of a type it returns exactly
     * what a bare `.find(...)` did.
     * User-first is deliberate: an installed `user/tokens/brand` beats the
     * shipped brand (and the flip of the returned id is exactly how the
     * shell detects "branded"; see bridge/tokens.ts installUserTokens). A
     * user record holds one already-resolved blob and no catalog URLs, so
     * it's shaped as a metadata record with empty `formats`; readers get the
     * bytes via _getBlob, which resolves `user/...` ids from the user store.
     * The catalog scan keeps the MCP server's rule; getAll returns id order
     * rather than index order, which only differs if a catalog ships more
     * than one asset of a singleton type.
     *
     * `queryOpts.catalogOnly` skips the user store, for reading a property
     * that is a fact about the SHIPPED brand a user asset must not be able
     * to shadow (the `brandLock` flag on the catalog tokens asset; see
     * bridge/tokens.ts).
     */
    async _findMetaByType(type: AssetRef['type'], queryOpts: { catalogOnly?: boolean } = {}): Promise<AssetMetaRecord | null> {
      if (!queryOpts.catalogOnly) {
        const users = await db.getAll('user-assets');
        const userHeadId = pickHeadAssetId(users.filter(r => r.type === type).map(r => r.id));
        const u = userHeadId ? users.find(r => r.id === userHeadId) : undefined;
        if (u) {
          const name = u.meta?.name;
          return {
            id: u.id,
            type: u.type,
            ...(typeof name === 'string' ? { name } : {}),
            version: u.version,
            checksum: u.checksum,
            width: u.width,
            height: u.height,
            meta: u.meta,
            formats: [],
          };
        }
      }
      const all = await db.getAll('asset-meta');
      if (type === 'tokens') {
        const source = await db.get('profile', 'catalog-source') as { tokensHead?: string | null } | undefined;
        if (source && 'tokensHead' in source) return all.find(m => m.type === type && m.id === source.tokensHead) ?? null;
      }
      if (type === 'tokens' && all.some(m => m.type === type && typeof m.defaultTokens === 'boolean')) {
        return all.find(m => m.type === type && m.defaultTokens === true) ?? null;
      }
      const headId = pickHeadAssetId(all.filter(m => m.type === type).map(m => m.id));
      return (headId ? all.find(m => m.id === headId) : undefined) ?? null;
    },

    async _blobCacheSize(): Promise<number> {
      const blobs = await db.getAll('asset-blob');
      return blobs.reduce((sum, b) => sum + (b?.size ?? 0), 0);
    },

    /**
     * Internal: called by syncAssets after writing new metadata.
     *
     * Keeps a blob only if it passes both tests:
     *   1. Its version is current (matches the catalog index).
     *   2. It is either core-tier (always prefetched) OR referenced by a saved session.
     *
     * This prevents on-demand blobs from accumulating when a user browses the
     * asset picker without saving a session.
     *
     * Also prunes metadata for assets no longer in the catalog.
     * Returns { blobs, meta } counts of records deleted.
     */
    async _pruneStale(currentAssets: AssetMetaRecord[], sessionBlobKeys: Set<string> = new Set(), keepIds: Set<string> = new Set()): Promise<{ blobs: number; meta: number }> {
      const { pruneAssetCache } = await import('./asset-cache-maintenance.ts');
      return pruneAssetCache(db, currentAssets, sessionBlobKeys, keepIds, { evict: evictObjectUrl, evictPrefix: evictObjectUrlsByPrefix });
    },

    // v1.183: the bytes behind a ref - blob:, data: and same-origin urls all
    // answer to the page's fetch; a foreign origin is refused so this is never
    // a way around host.net's allowlist.
    async bytes(target: AssetRef | string): Promise<Uint8Array> {
      return (await import('./asset-cache-maintenance.ts')).assetBytes(target);
    },

    async isAvailable(id: string): Promise<boolean> {
      if (id.startsWith('user/')) {
        return Boolean(await db.get('user-assets', id));
      }
      const baseId = stripAssetModifiers(id);
      const meta = await db.get('asset-meta', baseId);
      if (!meta) return false;
      if (meta.tier === 'on-demand') return navigator.onLine;
      // For core/catalog, check if at least one format is cached.
      const cached = await Promise.all(
        meta.formats.map(f => db.get('asset-blob', `${baseId}:${f.format}:${meta.version}`)),
      );
      return cached.some(Boolean);
    },

    // The Content Credentials a placed asset carries, if whatever: the raw C2PA
    // manifest store plus its original container format. The runtime uses
    // this to preserve a placed credentialed asset's provenance as an export
    // ingredient. User uploads serve the store captured at ingest (their
    // stored pixels were re-encoded, so the bytes no longer carry it);
    // library/catalog assets are read from their own bytes on demand
    // (v1.31), cached per id, since the bytes are immutable for a given
    // version.
    async credential(id: string): Promise<{ store: Uint8Array; format: string } | null> {
      const { assetCredential } = await import('./asset-cache-maintenance.ts');
      return assetCredential(db, id, key => api.get(key), CREDENTIAL_CACHE, MAX_CREDENTIAL_SCAN_BYTES);
    },
  };
  return api;
}

/**
 * The asset id a resolved media URL came from, or null if nothing here minted it.
 *
 * THE ONE REVERSE DIRECTION THIS BRIDGE CAN ANSWER, and it exists because a
 * rendered document keeps no ids: a design's `<video src>` and `[data-audio-src]`
 * carry a URL and nothing else, so an export walking the DOM has no way back to the
 * record a clip came from. `toAssetRef` is the single place a stored blob becomes a
 * URL, and it keys the cache by `<source>:<id>:<format>:<version>` (plus a bake
 * suffix for themed/treated library derivatives) - so the id is already written
 * down, just the wrong way round for this caller.
 *
 * Why it matters beyond convenience: `credential()` above is the ONLY place a user
 * upload's Content Credentials still live. Ingest re-encodes the pixels, so the
 * C2PA store was moved beside the record; scanning the bytes that URL serves finds
 * nothing. Without an id there is no credential to preserve.
 *
 * A linear scan on purpose. The cache holds the URLs one session has resolved -
 * tens, not thousands - and the callers are export paths that are about to spend
 * seconds encoding video. A second map maintained in parallel would have to be
 * evicted in lockstep with this one, and a stale entry there would mean claiming
 * the wrong asset's provenance.
 */
export function assetIdForUrl(url: string): string | null {
  if (!url) return null;
  for (const [key, cached] of OBJECT_URL_CACHE) {
    if (cached !== url) continue;
    // Ids are path-like (`user/…`, `suse/logo/primary`) and never carry a colon,
    // so the second segment is the whole id whatever bake suffix follows it.
    const parts = key.split(':');
    if ((parts[0] === 'user' || parts[0] === 'library') && parts[1]) return parts[1];
  }
  return null;
}

/** Revoke + drop a single object-URL cache entry, if present. */
function evictObjectUrl(cacheKey: string): void {
  const url = OBJECT_URL_CACHE.get(cacheKey);
  if (url) {
    URL.revokeObjectURL(url);
    OBJECT_URL_CACHE.delete(cacheKey);
  }
  OBJECT_URL_FORMAT.delete(cacheKey);
}

/** Revoke + drop every object-URL cache entry whose key starts with `prefix`. */
function evictObjectUrlsByPrefix(prefix: string): void {
  for (const [key, url] of OBJECT_URL_CACHE) {
    if (key.startsWith(prefix)) {
      URL.revokeObjectURL(url);
      OBJECT_URL_CACHE.delete(key);
      OBJECT_URL_FORMAT.delete(key);
    }
  }
}

/**
 * Best-effort quota guard. Throws STORAGE_FULL if writing `incomingBytes`
 * would push usage past the safety fraction of the quota. If the platform
 * can't estimate (older browsers, private mode), the write is allowed; the
 * IDB layer remains the hard backstop.
 */
/** Byte-only preparation shared by uploads and atomic brand adoption. */
export async function captureUserAssetCredentials(record: UserAssetRecord): Promise<void> {
  if (!record.credential && record.blob && record.blob.size <= MAX_CREDENTIAL_SCAN_BYTES) {
    try {
      const { extractC2paStore } = await loadC2paVerify();
      const ex = extractC2paStore(new Uint8Array(await record.blob.arrayBuffer()));
      if (ex) { record.credential = ex.store; record.credentialFormat = ex.format; }
    } catch { /* preserve the original bytes when credentials cannot be read */ }
  }
  if (record.aiGenerated === undefined && record.credential && record.credentialFormat) {
    const kind = detectAiGenerated(record, await loadC2paVerify());
    if (kind) record.aiGenerated = kind;
  }
}

export async function assertQuotaRoom(incomingBytes: number): Promise<void> {
  return (await import('./asset-cache-maintenance.ts')).checkQuotaRoom(incomingBytes, QUOTA_SAFETY_FRACTION);
}

function pickFormat(meta: AssetMetaRecord, requested?: string): AssetFormat {
  if (!meta.formats.length) throw new Error(`Asset has no files: ${meta.id}`);
  if (requested) {
    const exact = meta.formats.find(f => f.format === requested);
    if (exact) return exact;
  }
  // Sensible default per type.
  if (meta.type === 'vector') return meta.formats.find(f => f.format === 'svg') ?? meta.formats[0]!;
  if (meta.type === 'raster') return meta.formats.find(f => /^(png|webp|jpe?g|gif|avif|heic|heif|tiff?|jxl)$/i.test(f.format)) ?? meta.formats[0]!;
  // A lottie entry carries the animation (json) plus a static poster variant;
  // tools always want the animation regardless of listing order.
  if (meta.type === 'lottie') return meta.formats.find(f => f.format === 'json') ?? meta.formats[0]!;
  // A video entry may ship a still poster alongside the clip; always resolve to the
  // clip (a <video> needs the real container), regardless of listing order.
  if (meta.type === 'video') return meta.formats.find(f => /^(mp4|webm|mov)$/i.test(f.format)) ?? meta.formats[0]!;
  return meta.formats[0]!;
}

/** Formats the video sniffer used to misfile as movies (they share MP4's
 *  ftyp container). The sniff is fixed at ingest (engine media-sniff.ts), but
 *  records stored before the fix carry type:'video' forever - heal them at
 *  the ONE place a stored record becomes an AssetRef, so old AVIF/HEIC
 *  uploads get their raster affordances back without a re-upload. */
const LEGACY_IMAGE_AS_VIDEO = new Set(['avif', 'heic', 'heif']);
const healLegacyType = (record: AssetRefSource): AssetRef['type'] =>
  record.type === 'video' && LEGACY_IMAGE_AS_VIDEO.has((record.format ?? '').toLowerCase())
    ? 'raster'
    : record.type;

async function toAssetRef(record: AssetRefSource, source: 'user' | 'library'): Promise<AssetRef> {
  // record.cacheKey overrides the default key - themed icon refs key on the
  // base blob + pairing colours (see get()) so identical bakes share one URL.
  const cacheKey = record.cacheKey ?? `${source}:${record.id}:${record.format}:${record.version ?? 'x'}`;
  let url = OBJECT_URL_CACHE.get(cacheKey);
  if (!url && record.blob) {
    url = URL.createObjectURL(record.blob);
    OBJECT_URL_CACHE.set(cacheKey, url);
  }
  const type = healLegacyType(record);
  const ref: AssetRef = {
    source,
    id: record.id,
    type,
    format: record.format,
    url: url ?? '',
    version: record.version,
    checksum: record.checksum,
    width: record.width,
    height: record.height,
    meta: record.meta,
  };
  if (record.type === 'raster' && ['tiff','hdr','exr'].includes(record.format ?? '') && record.blob) return (await import('./deep-asset.ts')).deepAssetRef(ref,record.blob,OBJECT_URL_CACHE,`${cacheKey}:deep-sdr-v1`);
  if (record.format === 'jxl' && record.blob) {
    return (await import('./jxl.ts')).jxlAssetRef(ref, record.blob, OBJECT_URL_CACHE, `${cacheKey}:jxl-srgb-v1`);
  }
  return ref;
}

// Generative-AI provenance derived from a user upload's captured C2PA
// credential store. The file's manifest chain (walked whole, since AI origin
// often lives in a parent/ingredient manifest) may declare AI/ML-generated
// pixels via an IPTC digitalSourceType; that's what drives the GEN AI badge
// on uploaded assets (Claude, OpenAI, Gemini, etc.). Memoised by asset id (a
// credential never changes for a given upload) so the catalog/picker don't
// re-parse.
const AI_KIND_MEMO = new Map<string, 'full' | 'partial' | undefined>();
// `c2pa` is the lazily-loaded reader (null when the caller determined no
// record needs one), passed in instead of imported so this module stays off
// the boot path; a record that already carries the persisted flag never
// touches it.
function detectAiGenerated(
  rec: UserAssetRecord,
  c2pa: C2paVerifyModule | null,
): 'full' | 'partial' | undefined {
  if (rec.aiGenerated) return rec.aiGenerated;             // already computed + persisted
  if (AI_KIND_MEMO.has(rec.id)) return AI_KIND_MEMO.get(rec.id);
  // No reader → answer "unknown" WITHOUT memoising, so a later call that does have
  // the reader still gets a real answer for this record.
  if (!c2pa) return undefined;
  let kind: 'full' | 'partial' | undefined;
  if (rec.credential && rec.credentialFormat) {
    try {
      const dst = c2pa.prepareC2paIngredientFromStore(rec.credential, rec.credentialFormat)?.digitalSourceType;
      const k = c2pa.aiKind(dst);
      kind = k === 'generated' ? 'full' : k === 'composite' ? 'partial' : undefined;
    } catch { kind = undefined; }
  }
  AI_KIND_MEMO.set(rec.id, kind);
  return kind;
}

// An `image` slot accepts whatever still image - raster OR vector (SVG). It's the
// superset an image input wants (not `whatever`, which would also surface video/lottie).
// `motion` widens an `image` slot to also admit video: a frame-hook tool (its
// input carries motion:true) consumes catalog VIDEO the same way it consumes the
// user's own video uploads - without this the catalog rail hid every catalog
// video while the uploads rail showed them (plans/162).
export function typeMatches(assetType: string, want: string | undefined, motion = false): boolean {
  if (!want) return true;
  if (want === 'image') return assetType === 'raster' || assetType === 'vector' || (motion && assetType === 'video');
  return assetType === want;
}

function matchesFilter(meta: AssetMetaRecord, filter: AssetQuery): boolean {
  if (filter.type && !typeMatches(meta.type, filter.type, filter.motion)) return false;
  if (filter.namespace && !meta.id.startsWith(filter.namespace + '/') && meta.id !== filter.namespace) return false;
  if (filter.tags?.length) {
    const tags = new Set(meta.tags ?? []);
    if (!filter.tags.every(t => tags.has(t))) return false;
  }
  if (!filter.includeDeprecated && meta.deprecated) return false;
  return true;
}

async function fetchAndCache(meta: AssetMetaRecord, format: AssetFormat, blobKey: string, db: AssetsDb): Promise<Blob> {
  // format.url comes from the synced asset-meta record - already absolutized to
  // the instance base when one is set (catalog/sync.ts absolutizeAssetUrls), so
  // only the CORS routing (instanceFetch) is needed here.
  const resp = await instanceFetch(format.url);
  if (!resp.ok) throw new Error(`Failed to fetch asset: ${resp.status}`);
  const blob = await resp.blob();
  await verifyAssetChecksum(blob, format);
  // Downloaded catalog bytes remain usable when the browser refuses its cache
  // (for example, WebKit cannot persist a Blob). User uploads still require a save.
  try {
    const parsed = parseFileAssetId(meta.id), stored = await db.get('asset-meta', parsed.baseId);
    const current = stored && await fileMeta(stored, parsed.file);
    if (current && current.version === meta.version && JSON.stringify(current.formats) === JSON.stringify(meta.formats)) await db.put('asset-blob', blob, blobKey);
  }
  catch (error) { console.warn('Asset cache write failed; using verified downloaded bytes', meta.id, error); }
  return blob;
}

/**
 * A blob's bytes as a `data:<mime>;base64,…` URI. Used to inline a photo into a
 * treatment's SVG wrapper - an SVG used as an image may not fetch external
 * resources, so the raster has to travel inside it.
 */
async function blobToDataUri(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(bin)}`;
}

/**
 * SRI SHA-256 (`sha256-<base64>`) for a blob's bytes, byte-for-byte matching the
 * build-time format from scripts/checksum-assets.ts - there it's
 * createHash('sha256').digest('base64'); Node's base64 alphabet + `=` padding is
 * identical to btoa over the raw digest, so the strings compare equal.
 */
async function sriForBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(digest);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return `sha256-${btoa(bin)}`;
}

/** Tampered or corrupt bytes, as distinct from an unreachable file. Its own class
 *  so a caller can tell the two apart without matching on a message: catalog/sync.ts's
 *  prefetch warns about this one and stays quiet about a fetch that simply failed,
 *  which on an offline boot is every asset in the tier. */
export class AssetChecksumError extends Error {}

/**
 * Verify freshly-fetched bytes against the catalog checksum, throwing on a real
 * mismatch (tampered/corrupt download). No-ops when the format carries no
 * checksum or the runtime lacks crypto.subtle (non-secure context) - integrity
 * is a guard, not a hard gate that should brick loading on edge runtimes. The
 * deployed catalog's checksums are kept current by validate-catalog.js (CI), so
 * this never false-positives on a correctly-published asset.
 */
export async function verifyAssetChecksum(blob: Blob, format: AssetFormat | undefined): Promise<void> {
  if (!format?.checksum || !globalThis.crypto?.subtle) return;
  const actual = await sriForBlob(blob);
  if (actual !== format.checksum) {
    throw new AssetChecksumError(
      `Asset checksum mismatch for ${format.url}: expected ${format.checksum}, got ${actual}`,
    );
  }
}
