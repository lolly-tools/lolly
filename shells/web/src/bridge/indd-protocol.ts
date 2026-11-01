// SPDX-License-Identifier: MPL-2.0
import type { InddErrorCode } from '@lolly-tools/node-shell/indd';

/** One conversion. `bytes` and the reply's `idml` are transferred, never copied. */
export interface InddWorkerRequest { id: number; bytes: Uint8Array; name: string }
export type InddWorkerReply =
  | { id: number; ok: true; idml: Uint8Array; warnings: string[] }
  | { id: number; ok: false; code: InddErrorCode; error: string };
