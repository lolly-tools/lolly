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

/** Visual slots retain incompatible visual assets so the picker can dim them.
 * Explicit text/data unions retain only their requested types and deduplicate ids. */
export async function queryPickerAssets(
  assets: HostV1['assets'], opts: PickerQuery, visualSlot: boolean,
): Promise<AssetRef[]> {
  const queryOpts = { ...opts, type: visualSlot || opts.type === 'image' ? undefined : opts.type };
  if (opts.types?.length) {
    const groups = await Promise.all(opts.types.map(type => assets.query({ ...queryOpts, type })));
    return [...new Map(groups.flat().map(ref => [ref.id, ref])).values()]
      .filter(ref => pickerAcceptsType(opts, ref.type));
  }
  const raw = await assets.query(queryOpts);
  return visualSlot || !opts.type ? raw.filter(ref => VISUAL_TYPES.has(ref.type)) : raw;
}
