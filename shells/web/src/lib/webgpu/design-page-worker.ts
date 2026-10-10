// SPDX-License-Identifier: MPL-2.0
/** Internal opt-in worker. It publishes one completed RGBA result and PNG, never partial output. */
import { prepareDesignRaster, type DesignRasterAdmission } from '../../../../../engine/src/design-draw-raster.ts';
import type { DesignDrawPage } from '../../../../../engine/src/design-draw.ts';
import { createRasterAPI } from '../../bridge/raster.ts';
import { renderDesignRaster } from './design-page.ts';
import { isWebGpuFailure, WebGpuError } from './device.ts';

export type DesignPageWorkerRequest = { kind: 'render'; id: number; page: DesignDrawPage; output?: { width: number; height: number; dpi?: number } } | { kind: 'cancel'; id: number };
export interface DesignPageWorkerDependencies {
  render: typeof renderDesignRaster;
  encode: ReturnType<typeof createRasterAPI>['encode'];
  post(message: unknown, transfer?: Transferable[]): void;
}

/** Cancellation keeps admission occupied until rendering/encoding and resource teardown finish. */
export function createDesignPageWorker(dependencies: DesignPageWorkerDependencies) {
  let active: { id: number; controller: AbortController } | null = null;
  return async (request: DesignPageWorkerRequest): Promise<void> => {
    if (!request || !Number.isSafeInteger(request.id) || request.id < 1) return;
    if (request.kind === 'cancel') { if (active?.id === request.id) active.controller.abort(new DOMException('Design raster cancelled.', 'AbortError')); return; }
    if (request.kind !== 'render') return;
    if (active) { dependencies.post({ id: request.id, ok: false, code: 'WEBGPU_BUSY', error: 'The Design raster worker is busy.' }); return; }
    const controller = new AbortController(); active = { id: request.id, controller };
    try {
      const admitted: DesignRasterAdmission = prepareDesignRaster(request.page, request.output);
      if (!admitted.ok) { dependencies.post({ id: request.id, ok: false, findings: admitted.findings }); return; }
      const result = await dependencies.render(admitted.evaluation, controller.signal);
      controller.signal.throwIfAborted();
      const png = await dependencies.encode(result, { format: 'png' });
      controller.signal.throwIfAborted();
      if (png.mime !== 'image/png' || png.width !== result.width || png.height !== result.height) throw new WebGpuError('WEBGPU_OPERATION_FAILED', 'The Design raster codec did not return the required PNG.');
      dependencies.post({ id: request.id, ok: true, ...result, png: png.bytes }, [result.data.buffer, png.bytes.buffer as ArrayBuffer]);
    } catch (error) {
      dependencies.post({ id: request.id, ok: false, error: error instanceof Error ? error.message : String(error), name: error instanceof Error ? error.name : 'Error',
        ...(isWebGpuFailure(error) ? { code: error.code } : {}) });
    } finally { if (active?.controller === controller) active = null; }
  };
}

if (typeof document === 'undefined' && typeof globalThis.postMessage === 'function') {
  const receive = createDesignPageWorker({ render: renderDesignRaster, encode: createRasterAPI().encode,
    post: (message, transfer = []) => globalThis.postMessage(message, { transfer }) });
  globalThis.onmessage = ({ data }: MessageEvent<DesignPageWorkerRequest>) => { void receive(data); };
}
