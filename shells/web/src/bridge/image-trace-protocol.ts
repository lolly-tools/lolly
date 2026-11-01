// SPDX-License-Identifier: MPL-2.0
import type { ImageTracePreset } from '../../../../engine/src/image-trace.ts';

/** One trace. `rgba` is transferred, never copied. */
export interface ImageTraceWorkerRequest { id: number; rgba: Uint8Array; width: number; height: number; preset: ImageTracePreset }
export type ImageTraceWorkerReply =
  | { id: number; stage: 'tracing' }
  | { id: number; ok: true; json: Uint8Array }
  | { id: number; ok: false; code: 'invalid' | 'limit' | 'failed'; error: string };
