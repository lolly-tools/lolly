// SPDX-License-Identifier: MPL-2.0
import type { WebGpuErrorCode } from '../lib/webgpu/device.ts';
import type { PhotoLookBakeRequest } from './photo-look-raster.ts';

export type PhotoLookWorkerRequest =
  | { kind: 'bake'; id: number; request: PhotoLookBakeRequest }
  | { kind: 'cancel'; id: number };

export type PhotoLookWorkerReply =
  | { id: number; ok: true; blob: Blob }
  | { id: number; ok: false; error: string; name: string; code?: WebGpuErrorCode };
