// SPDX-License-Identifier: MPL-2.0
import { unzipSync } from 'fflate';

export const THREE_MF_UPLOAD_LIMIT = 128 * 1024 * 1024;
export const THREE_MF_RENDER_LIMIT = 256 * 1024 * 1024;

/** Read only requested ZIP members, bounding their declared size before inflation. */
export function threeMfEntries(bytes: Uint8Array, models: boolean): Record<string, Uint8Array> {
  let total = 0;
  let hasModel = false;
  const entries = unzipSync(bytes, {
    filter(entry) {
      if (/\.model$/i.test(entry.name)) hasModel = true;
      const wanted = models
        ? /\.model$|^_rels\/\.rels$/i.test(entry.name)
        : /^_rels\/\.rels$|(?:thumbnail|plate_1(?:_small)?)\.png$/i.test(entry.name);
      if (!wanted) return false;
      total += entry.originalSize;
      if (total > (models ? THREE_MF_RENDER_LIMIT : 8 * 1024 * 1024))
        throw new Error(
          models
            ? 'This 3MF is too large for an interactive preview. Its original file and plate thumbnail are still available.'
            : 'The 3MF thumbnail is too large.'
        );
      return true;
    },
  });
  const rels = entries['_rels/.rels'];
  if (!hasModel || !rels || !/3dmanufacturing\/.*3dmodel/.test(new TextDecoder().decode(rels)))
    throw new Error('Use a valid 3MF package with a model relationship.');
  return entries;
}

export function threeMfThumbnail(bytes: Uint8Array): Blob | null {
  const entries = threeMfEntries(bytes, false);
  const name =
    Object.keys(entries).find((n) => /thumbnail\.png$/i.test(n)) ??
    Object.keys(entries).find((n) => /plate_1\.png$/i.test(n)) ??
    Object.keys(entries).find((n) => /plate_1_small\.png$/i.test(n));
  const data = name && entries[name];
  return data ? new Blob([data.slice().buffer], { type: 'image/png' }) : null;
}
