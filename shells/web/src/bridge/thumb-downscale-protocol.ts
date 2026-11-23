// SPDX-License-Identifier: MPL-2.0
/** Messages between the page and the thumbnail picture worker (bridge/thumb-downscale.worker.ts). */

export interface ThumbDownscaleRequest {
  id: number;
  /** A JPEG, PNG or WebP picture as its encoded bytes. */
  blob: Blob;
  width: number;
  height: number;
}

export type ThumbDownscaleReply =
  | { id: number; ok: true; dataUrl: string }
  | { id: number; ok: false; error: string };
