// SPDX-License-Identifier: MPL-2.0
/** Decode imported faces and pictures without registering or displaying them. */
import type { VersionedUserAsset } from '../../bridge/asset-history-types.ts';

async function bounded<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('A design-system file took too long to decode.')), 10000); })]); }
  finally { clearTimeout(timer); }
}

export async function validateAdoptionFile(row: VersionedUserAsset): Promise<void> {
  if (!row.blob || row.blob.size > 64 * 1024 * 1024) throw new Error('A design-system file is missing or too large.');
  if (row.type === 'font') {
    if (typeof FontFace === 'undefined') throw new Error('This shell cannot validate the imported font.');
    const family = String(row.meta?.family || row.meta?.name || '').trim();
    if (!family) throw new Error('An imported font has no family name. Add the font separately to identify it.');
    try {
      const face = new FontFace(family, await row.blob.arrayBuffer(), {
        weight: String(row.meta?.weight || '400'), style: String(row.meta?.style || 'normal'),
      });
      await bounded(face.load());
    } catch { throw new Error(`The font “${family}” could not be read. Export a fresh font file and try again. Your design-system settings have not changed.`); }
  } else if (row.type === 'vector' || row.type === 'raster') {
    if (typeof Image === 'undefined') throw new Error('This shell cannot validate the imported picture.');
    const image = new Image();
    const url = URL.createObjectURL(row.blob);
    try {
      image.src = url;
      await bounded(image.decode());
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('An imported picture has no usable dimensions.');
    } catch { throw new Error(`The picture “${String(row.meta?.name || row.id)}” could not be read. Replace it and try again. Your design-system settings have not changed.`); }
    finally { image.removeAttribute('src'); URL.revokeObjectURL(url); }
  }
}
