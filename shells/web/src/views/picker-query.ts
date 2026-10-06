// SPDX-License-Identifier: MPL-2.0
import type { AssetPickerOpts, AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { typeMatches } from '../bridge/assets.ts';
import { VISUAL_TYPES } from '../lib/asset-kinds.ts';

type PickerQuery = Omit<AssetPickerOpts, 'type'> & {
  type?: AssetPickerOpts['type'] | 'image';
};
export function pickerAcceptsType(opts: PickerQuery, assetType: string): boolean {
  return opts.types?.length
    ? opts.types.some(type => typeMatches(assetType, type, opts.motion === true))
    : typeMatches(assetType, opts.type, opts.motion === true);
}
export const isMogrtAsset = (ref: AssetRef): boolean => (ref.original?.format ?? ref.format) === 'mogrt';
export const pickerUsesMogrt = (opts: PickerQuery): boolean => opts.type === 'video' || opts.motion === true || opts.types?.includes('video') === true;
export function pickerAcceptsAsset(opts: PickerQuery, ref: AssetRef): boolean {
  return pickerAcceptsType(opts, ref.type) || (isMogrtAsset(ref) && pickerUsesMogrt(opts) && pickerAcceptsType(opts, 'video'));
}

/** Visual slots retain incompatible visual assets so the picker can dim them.
 * Explicit text/data unions retain only their requested types and deduplicate ids. */
export async function queryPickerAssets(
  assets: HostV1['assets'], opts: PickerQuery, visualSlot: boolean,
): Promise<AssetRef[]> {
  const queryOpts = { ...opts, type: visualSlot || opts.type === 'image' ? undefined : opts.type };
  if (opts.types?.length) {
    const types = pickerUsesMogrt(opts) && !opts.types.includes('data') ? [...opts.types, 'data'] as const : opts.types;
    const groups = await Promise.all(types.map(type => assets.query({ ...queryOpts, type })));
    return [...new Map(groups.flat().map(ref => [ref.id, ref])).values()]
      .filter(ref => pickerAcceptsAsset(opts, ref));
  }
  const raw = await assets.query(queryOpts);
  return visualSlot || !opts.type ? raw.filter(ref => VISUAL_TYPES.has(ref.type) || (isMogrtAsset(ref) && pickerUsesMogrt(opts) && pickerAcceptsType(opts, 'video'))) : raw;
}

/** The type pills an untyped pick offers (plans/134 P5) - the catalog's buckets. */
export const PICKER_TYPE_FILTERS: ReadonlyArray<{ key: import('./assets-filter.ts').TypeFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'image', label: 'Image' },
  { key: 'vector', label: 'Vector' },
  { key: 'motion', label: 'Motion' },
  { key: 'audio', label: 'Audio' },
  { key: 'text', label: 'Text' },
];
