// SPDX-License-Identifier: MPL-2.0
/** Messages between the page and the preview encode worker (lib/preview-encode.worker.ts). */
import type { SessionPreviewRef } from '../../../../engine/src/session-preview.ts';
import type { PictureVerdict } from '../bridge/preview-store.ts';
import type { WriterFacts } from './preview-writer.ts';

export interface PreviewEncodeRequest {
  id: number;
  /** A raster render as encoded bytes, or pixels already decoded (an ImageBitmap,
   *  transferred). Never an SVG: an SVG cannot be decoded in a worker. */
  source: Blob | ImageBitmap;
  facts: WriterFacts;
}

export type PreviewEncodeReply =
  | { id: number; ok: true; picture: { ref: SessionPreviewRef; bytes: Uint8Array; verdict?: PictureVerdict } | null }
  | { id: number; ok: false; error: string };
