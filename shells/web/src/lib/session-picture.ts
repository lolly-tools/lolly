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
