// SPDX-License-Identifier: MPL-2.0
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { CollabStream } from './collab-session.ts';

/** Optional project-file boundary. An ordinary canvas never creates one. */
export interface CanvasAssetsCapability {
  prepare(ref: unknown): Promise<AssetRef>;
  resolve(ref: AssetRef): Promise<AssetRef>;
  readonly status: CollabStream<{ pending: number; message: string }>;
  holdEdit?(): () => void;
  failed(retry: () => void): void;
  retry?(): void;
  close(): void;
}
