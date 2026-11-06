// SPDX-License-Identifier: MPL-2.0
/** Immutable user pack storage, shared by imports and document dependency capture. */
import type { AssetRef, AssetsAPI } from '@lolly-tools/core/host-v1';
import type { EmojiPackBundleV1, EmojiPackManifestV1, EmojiSetInfoV1 } from '@lolly-tools/core/emoji-v1';
import { sha256Hex } from '../../../../engine/src/bytes.ts';
import { redistribution } from '../lib/redistribution.ts';

export interface EmojiAssetRecord {
  id: string; type: AssetRef['type']; format: string; blob?: Blob; version?: string; meta?: Record<string, unknown>;
}
export type EmojiStorage = Pick<AssetsAPI, 'query' | 'get' | 'bytes'> & {
  _exportUserAssets?(): Promise<EmojiAssetRecord[]>;
  _uploadUserAsset?(record: EmojiAssetRecord): Promise<void>;
  _getUserRecord?(id: string): Promise<EmojiAssetRecord | null>;
  /** The device's catalog cache: answers from it, and fetches only an on-demand file it lacks. */
  _getBlob?(id: string, opts?: { format?: string; version?: string; fetchIfMissing?: boolean }): Promise<Blob | null>;
  /** Keep these catalog ids through the prune of files nothing saved refers to. */
  _holdCatalogAssets?(ids: readonly string[]): Promise<void>;
};

export async function userEmojiRefs(assets: EmojiStorage): Promise<AssetRef[]> {
  const records = await assets._exportUserAssets?.() ?? [];
  return records.filter(record => !!record.meta?.emoji).map(record => ({
    id: record.id, source: 'user', type: 'data', format: 'json', meta: record.meta,
    pin: { version: record.version ?? '1', format: 'json' },
  } as AssetRef));
}

export async function storeEmojiBundle(assets: EmojiStorage, bundle: EmojiPackBundleV1, info: EmojiSetInfoV1): Promise<AssetRef> {
  if (!assets._uploadUserAsset) throw new Error('This host cannot install emoji sets.');
  const bytes = new TextEncoder().encode(JSON.stringify(bundle));
  const digest = await sha256Hex(bytes);
  const id = `user/emoji/${digest}`;
  const manifest = JSON.parse(bundle.manifest) as EmojiPackManifestV1;
  const permission = redistribution({ license: manifest.source.license });
  if (!permission.travels) throw new Error(`This pack cannot be carried in a document: ${permission.reason}.`);
  for (const glyph of manifest.glyphs) {
    if (!redistribution({ license: glyph.source.license }).travels) throw new Error(`Source sharing permission is missing for ${glyph.label}.`);
  }
  if (!await assets._getUserRecord?.(id)) {
    const { pin, ...labels } = info;
    await assets._uploadUserAsset({ id, type: 'data', format: 'json', version: digest,
      blob: new Blob([bytes], { type: 'application/json' }), meta: {
        name: info.label, tags: ['emoji-pack'], license: info.license, attribution: info.attribution, size: bytes.length,
        emoji: { ...labels, id: pin.id, version: pin.pin.version, checksum: pin.checksum },
      } });
  }
  return { source: 'user', id, type: 'data', format: 'json', pin: { version: digest, format: 'json' } } as AssetRef;
}
