// SPDX-License-Identifier: MPL-2.0
/** Bakes photo looks off the main thread (plan 291 W7), reusing the LUT device. */
import { bakePhotoLookInRealm } from './photo-look-raster.ts';
import { isWebGpuFailure, WebGpuError } from '../lib/webgpu/device.ts';
import type { PhotoLookWorkerRequest } from './photo-look-protocol.ts';

const scope = globalThis;
let active: { id: number; controller: AbortController } | null = null;
// The production bundler can share this chunk with the main-realm LUT import.
// Only the worker entry installs a message handler.
if (typeof document === 'undefined') scope.onmessage = async ({ data }: MessageEvent<PhotoLookWorkerRequest>) => {
  if (data.kind === 'cancel') {
    if (active?.id === data.id) active.controller.abort(new DOMException('Photo grading was cancelled.', 'AbortError'));
    return;
  }
  const controller = new AbortController();
  try {
    if (active) throw new WebGpuError('WEBGPU_BUSY', 'The photo worker is already processing an image.');
    active = { id: data.id, controller };
    const blob = await bakePhotoLookInRealm(data.request, controller.signal);
    controller.signal.throwIfAborted();
    scope.postMessage({ id: data.id, ok: true, blob }, { transfer: [] });
  } catch (error) {
    scope.postMessage({ id: data.id, ok: false, error: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Error', ...(isWebGpuFailure(error) ? { code: error.code } : {}) }, { transfer: [] });
  } finally {
    if (active?.controller === controller) active = null;
  }
};
