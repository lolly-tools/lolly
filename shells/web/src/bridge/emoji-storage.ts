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
};

export async function userEmojiRefs(assets: EmojiStorage): Promise<AssetRef[]> {
  const records = await assets._exportUserAssets?.() ?? [];
  return records.filter(record => !!record.meta?.emoji).map(record => ({
    id: record.id, source: 'user', type: 'data', format: 'json', meta: record.meta,
    pin: { version: record.version ?? '1', format: 'json' },
  } as AssetRef));
}

/**
 * Write a record whose id comes from its own bytes, so finding it already there is
 * success. Two writers meet here on a first visit: a second tab opening a tool, or a
 * placed tool's panel opening while the view that placed it is still mounting. Both find
 * no record and both write, and the asset store refuses the slower one because the record
 * appeared after its read. That refusal stops a write made from a stale read. These two
 * writers hold the same bytes, so the record that appeared is the one this write wanted.
 */
export async function writeOnce(assets: EmojiStorage, record: EmojiAssetRecord): Promise<void> {
  if (await assets._getUserRecord?.(record.id)) return;
  try {
    await assets._uploadUserAsset!(record);
  } catch (error) {
    if (!await assets._getUserRecord?.(record.id)) throw error;
  }
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
  const { pin, ...labels } = info;
  await writeOnce(assets, { id, type: 'data', format: 'json', version: digest,
    blob: new Blob([bytes], { type: 'application/json' }), meta: {
      name: info.label, tags: ['emoji-pack'], license: info.license, attribution: info.attribution, size: bytes.length,
      emoji: { ...labels, id: pin.id, version: pin.pin.version, checksum: pin.checksum },
    } });
  return { source: 'user', id, type: 'data', format: 'json', pin: { version: digest, format: 'json' } } as AssetRef;
}
