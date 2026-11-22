// SPDX-License-Identifier: MPL-2.0
/**
 * A saved session's picture as the rest of the shell handles it (plan 373).
 *
 * A row from `host.state.list()` carries its picture by reference (`preview`) or,
 * for a record not moved yet, as a legacy data URL (`thumb`). Code that writes the
 * session again (a rename, a copy, a move to the Trash) hands `rowPicture(row)`
 * back to save or restore, which keeps the same stored picture without reading
 * the bytes. Code that writes a format which still carries a data URL (a `.lolly`, a
 * backup, device sync, beam) asks `rowPictureDataUrl`, which rebuilds the field
 * from the stored bytes in the form it always had.
 */
import type { SessionPreviewRef } from '../../../../engine/src/session-preview.ts';
import { heldObjectUrl } from './preview-urls.ts';

export interface RowWithPicture {
  slot?: string;
  preview?: SessionPreviewRef | null;
  thumb?: string | null;
}

/** What to hand save or restore so a rewritten session keeps its picture. */
export function rowPicture(row: RowWithPicture | null | undefined): SessionPreviewRef | string | null {
  return row?.preview ?? row?.thumb ?? null;
}

/** The slice of the state API this reads. */
export interface PictureState {
  pictureDataUrl?(ref: SessionPreviewRef | { slot: string }): Promise<string | null>;
}

/** A session's picture as a data URL, for a format that carries one, or null. */
export async function rowPictureDataUrl(state: PictureState, row: RowWithPicture | null | undefined): Promise<string | null> {
  if (!row) return null;
  if (row.thumb) return row.thumb;
  if (!state.pictureDataUrl) return null;
  if (row.preview) return state.pictureDataUrl(row.preview).catch(() => null);
  return null;
}

/**
 * A session's picture as a PNG data URL, for a receiver that reads PNG only (the
 * thumbnail in a `.lolly` file's manifest, which the Linux thumbnailer and Quick
 * Look read). A PNG is passed through byte for byte; any other picture is drawn into
 * a PNG in the browser (lib/preview-writer.ts `pngPicture`). Where no canvas can
 * draw the picture, the picture comes back in its own form rather than not at all:
 * the app's own importer reads any picture type, and the file keeps its picture.
 */
export async function rowPicturePng(state: PictureState, row: RowWithPicture | null | undefined): Promise<string | null> {
  const url = await rowPictureDataUrl(state, row);
  if (!url) return null;
  return (await asPng(url, row?.preview).catch(() => null)) ?? url;
}

/**
 * A session's picture as a raster data URL, for a receiver that takes raster
 * pictures only (Beam: PNG, JPEG, WebP, GIF or AVIF). A raster picture is passed
 * through; an SVG is drawn into a PNG in the browser. Null when no raster can be
 * made (the receiver would have dropped an SVG anyway).
 */
export async function rowPictureRaster(state: PictureState, row: RowWithPicture | null | undefined): Promise<string | null> {
  const url = await rowPictureDataUrl(state, row);
  if (!url) return null;
  if (!/^data:image\/svg\+xml[;,]/i.test(url)) return url;
  return asPng(url, row?.preview).catch(() => null);
}

async function asPng(url: string, ref?: SessionPreviewRef | null): Promise<string | null> {
  if (/^data:image\/png;base64,/i.test(url)) return url;
  const { decodePictureDataUrl } = await import('../../../../engine/src/session-preview.ts');
  const decoded = decodePictureDataUrl(url);
  if (!decoded) return null;
  const { pngPicture } = await import('./preview-writer.ts');
  const size = ref && ref.width > 0 && ref.height > 0 ? { width: ref.width, height: ref.height } : undefined;
  const png = await pngPicture(new Blob([decoded.bytes.slice().buffer as ArrayBuffer], { type: decoded.type }), size);
  if (!png) return null;
  const bytes = new Uint8Array(await png.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/png;base64,${btoa(binary)}`;
}

/**
 * A picture to embed inside another SVG (a folder's cover mosaic): a data URL or
 * nothing, since an SVG loaded in an `<img>` cannot fetch anything. A stored picture
 * qualifies only when its data URL is already at hand (an SVG a tile has read); a
 * raster's object URL cannot be used there.
 */
export function embeddablePictureSrc(p: { thumb?: string | null; preview?: SessionPreviewRef | null; url?: string | null } | null | undefined): string {
  const held = p?.preview ? heldObjectUrl(p.preview.key) : null;
  const src = p?.thumb || held || p?.url || '';
  return src.startsWith('data:') ? src : '';
}
