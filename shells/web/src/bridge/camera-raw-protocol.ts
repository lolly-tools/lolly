// SPDX-License-Identifier: MPL-2.0
import type { CameraRawErrorCode, CameraRawMeta, CameraRawQuality } from '@lolly-tools/node-shell/camera-raw';

/** What to produce: the developed display picture, the 16-bit linear picture, or the capture facts only. */
export type CameraRawJob = 'open' | 'linear' | 'probe';

/** One job. `bytes` and the reply's pixel buffer are transferred, never copied. */
export interface CameraRawWorkerRequest { id: number; bytes: Uint8Array; job: CameraRawJob; quality: CameraRawQuality }
export type CameraRawWorkerReply =
  | { id: number; ok: true; width: number; height: number; meta: CameraRawMeta; pixels: ArrayBuffer | null }
  | { id: number; ok: false; code: CameraRawErrorCode; error: string };

/** The picture a job returned. `rgba8` is sRGB display data, `linear16` is linear ProPhoto RGB. */
export interface CameraRawResult {
  width: number;
  height: number;
  meta: CameraRawMeta;
  rgba8?: Uint8ClampedArray<ArrayBuffer>;
  linear16?: Uint16Array<ArrayBuffer>;
}
