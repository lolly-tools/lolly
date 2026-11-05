// SPDX-License-Identifier: MPL-2.0
import type { AffinityErrorCode, AffinityInspection } from '@lolly-tools/node-shell/affinity';
import type { AffinityModel } from '../../../../engine/src/design-map-affinity.ts';

/** One read. `bytes` and the reply's `payload` are transferred, never copied. */
export interface AffinityWorkerRequest { id: number; bytes: Uint8Array; name: string }
/** Stage 1 always; stage 2 (`model` and its `payload`) when the document model could be read. */
export interface AffinityRead {
  inspection: AffinityInspection;
  model?: AffinityModel;
  payload?: Uint8Array;
  /** Why stage 2 failed, when it did and stage 1 still worked. */
  modelError?: string;
}
export type AffinityWorkerReply =
  | ({ id: number; ok: true } & AffinityRead)
  | { id: number; ok: false; code: AffinityErrorCode; error: string };
