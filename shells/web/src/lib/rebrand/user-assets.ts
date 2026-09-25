// SPDX-License-Identifier: MPL-2.0
/**
 * The user asset store as the renovation journey uses it (plan 274 section 3.5): the
 * provenance hint on every asset it stores, the id and provenance a verbatim write
 * carries, the release rule, and the one project store per host.
 *
 * A leaf: `deps.ts` and `ingest.ts` both import it and neither imports the other at
 * module scope. `deps.ts` re-exports every name here, so callers keep one import path.
 *
 * The picker's `storeUserUpload` lives in views/, which lib/ never imports. The view
 * hands it in through `setRebrandPictureUpload` when it mounts; until then a host
 * with its own user asset store writes verbatim, and one without refuses.
 */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { PickerHost } from '../../views/picker.ts';
import type { DesignSystemHost } from './design-system.ts';
import {
  createWebProjectStore,
  isRebrandSlot,
  type ProjectStoreHost,
  type WebRenovationProjectStore,
} from './project-store.ts';

// ─── the picker upload, handed in by the view ────────────────────────────────

/** The picker's upload as this journey calls it: one store among many, never a modal. */
export type RebrandPictureUploadV1 = (
  host: PickerHost,
  file: File,
  opts: { batch: true; sourceHint: string },
) => Promise<AssetRef>;

let pictureUpload: RebrandPictureUploadV1 | null = null;

/** Set by the view at mount: the picker's `storeUserUpload`. Null clears it. */
export function setRebrandPictureUpload(upload: RebrandPictureUploadV1 | null): void {
  pictureUpload = upload;
}

/** The picker upload the view handed in, or null before the view has mounted. */
export function rebrandPictureUpload(): RebrandPictureUploadV1 | null {
  return pictureUpload;
}

// ─── the user asset store ────────────────────────────────────────────────────

/** Written on every asset this journey stores, so a release can tell its own bytes. */
export const REBRAND_SOURCE_HINT = 'rebrand';

/** One user-asset record as the upload write takes it. */
export interface UserAssetWriteV1 {
  id: string;
  type: AssetRef['type'];
  format: string;
  blob: Blob;
  version?: string;
  meta?: Record<string, unknown>;
}

/** The internal user-asset methods the web bridge carries beside `HostV1['assets']`. */
export interface UserAssetStoreV1 {
  _uploadUserAsset(record: UserAssetWriteV1): Promise<void>;
  _deleteUserAsset(id: string): Promise<unknown>;
  _getUserRecord?(id: string): Promise<unknown>;
  _getBlob?(id: string): Promise<Blob | null>;
}

/** The user asset store off a host, or null when the host has none (a test stub, the CLI). */
export function userAssetStoreOf(host: { assets?: unknown }): UserAssetStoreV1 | null {
  const assets = host.assets as Partial<UserAssetStoreV1> | null | undefined;
  if (!assets || typeof assets._uploadUserAsset !== 'function' || typeof assets._deleteUserAsset !== 'function') return null;
  const record = assets._getUserRecord;
  const blob = assets._getBlob;
  return {
    _uploadUserAsset: assets._uploadUserAsset.bind(assets),
    _deleteUserAsset: assets._deleteUserAsset.bind(assets),
    ...(typeof record === 'function' ? { _getUserRecord: record.bind(assets) } : {}),
    ...(typeof blob === 'function' ? { _getBlob: blob.bind(assets) } : {}),
  };
}

/**
 * Whether a host carries what the picker's `storeUserUpload` reaches for beyond
 * `HostV1`: the internal user-asset methods and the profile it reads the privacy
 * preference from. The web bridge does; a test stub or a terminal shell does not.
 */
export function isPickerHost(host: unknown): host is PickerHost {
  const h = host as { assets?: Record<string, unknown>; profile?: { get?: unknown }; state?: { list?: unknown } } | null;
  const assets = h?.assets;
  return Boolean(assets)
    && typeof assets?._uploadUserAsset === 'function'
    && typeof assets?._deleteUserAsset === 'function'
    && typeof assets?._listUserAssets === 'function'
    && typeof assets?.get === 'function'
    && typeof h?.profile?.get === 'function'
    && typeof h?.state?.list === 'function';
}

/** What the store needs from a host: storage, plus the asset and token APIs when present. */
export type RebrandStoreHost = ProjectStoreHost & DesignSystemHost;

/** The picker's id spelling for a file name, so a minted id can be recognised again. */
export function uploadSlug(name: string): string {
  return name.replace(/[^a-z0-9.-]/gi, '_');
}

/** A user-asset id for bytes this journey writes itself, in the picker's own form. */
export function mintUploadId(name: string, at: number): string {
  return `user/upload/${at}-${uploadSlug(name)}`;
}

/** The import provenance a picker upload carries, for bytes this journey writes itself. */
export function provenanceFor(name: string): Record<string, unknown> {
  return { originalFilename: name, importedAt: new Date().toISOString(), sourceHint: REBRAND_SOURCE_HINT };
}

/**
 * Write the source deck verbatim as a `data` user asset, through the quota-checked
 * upload write the picker ends in. The picker's `storeUserUpload` sorts a file it does
 * not recognise onto the raster path, where a deck is stored as a broken image, raises
 * the "Very large image" dialog past 40 MB even under `batch: true`, and fails when the
 * strip-metadata preference asks for a re-encode.
 */
async function writeSourceBytes(store: UserAssetStoreV1, file: File): Promise<AssetRef> {
  const name = file.name || 'deck.pptx';
  const id = mintUploadId(name, Date.now());
  const format = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? 'pptx';
  await store._uploadUserAsset({
    id,
    type: 'data',
    format,
    blob: file,
    version: '1.0.0',
    meta: { name, provenance: provenanceFor(name) },
  });
  return { source: 'user', id, type: 'data', format, url: '' };
}

/** Does a stored session outside this journey name the asset? */
async function namedBySession(host: ProjectStoreHost, ref: string): Promise<boolean> {
  for (const row of await host.state.list()) {
    if (!row?.slot || isRebrandSlot(row.slot)) continue;
    const value = await host.state.load(row.slot).catch(() => null);
    if (value && JSON.stringify(value).includes(ref)) return true;
  }
  return false;
}

/** The import provenance hint on a stored record, when it states one. */
function hintOf(record: unknown): unknown {
  const meta = (record as { meta?: unknown } | null)?.meta;
  const provenance = (meta as { provenance?: unknown } | null | undefined)?.provenance;
  return (provenance as { sourceHint?: unknown } | null | undefined)?.sourceHint;
}

/**
 * Whether bytes a project names are held by something outside the renovation store.
 * Only bytes this journey stored (its provenance hint) are ever candidates for release:
 * a picture that matched an upload the person made earlier is theirs, so it reads as
 * held. A question this host cannot answer reads as held too.
 */
function referencedElsewhereFor(host: ProjectStoreHost, assets: UserAssetStoreV1 | null) {
  return async (ref: string): Promise<boolean> => {
    if (!assets?._getUserRecord) return true;
    const record = await assets._getUserRecord(ref);
    if (!record) return false;
    if (hintOf(record) !== REBRAND_SOURCE_HINT) return true;
    return namedBySession(host, ref);
  };
}

const stores = new WeakMap<object, WebRenovationProjectStore>();

/**
 * The renovation project store for a host, one per host, so the ingest, the controller
 * and the reopen list all go through the same write chain.
 */
export function rebrandStoreFor(host: RebrandStoreHost): WebRenovationProjectStore {
  const known = stores.get(host);
  if (known) return known;
  const assets = userAssetStoreOf(host);
  const store = createWebProjectStore(host, {
    now: () => new Date().toISOString(),
    async storeUpload(file) {
      if (assets) return writeSourceBytes(assets, file);
      const upload = rebrandPictureUpload();
      if (!isPickerHost(host) || !upload) throw new Error('This shell has no user asset store for the deck.');
      return upload(host, file, { batch: true, sourceHint: REBRAND_SOURCE_HINT });
    },
    referencedElsewhere: referencedElsewhereFor(host, assets),
    ...(assets ? { deleteAsset: async (ref: string): Promise<void> => { await assets._deleteUserAsset(ref); } } : {}),
  });
  stores.set(host, store);
  return store;
}
