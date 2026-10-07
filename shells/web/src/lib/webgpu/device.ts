/// <reference types="@webgpu/types" />
// SPDX-License-Identifier: MPL-2.0
/** The creative shell requires a usable compute device. Acquisition never selects a fallback. */

export type WebGpuErrorCode = 'WEBGPU_REQUIRED' | 'WEBGPU_UNAVAILABLE' | 'WEBGPU_DEVICE_LOST' | 'WEBGPU_LIMIT' | 'WEBGPU_OPERATION_FAILED' | 'WEBGPU_BUSY';

export class WebGpuError extends Error {
  readonly code: WebGpuErrorCode;
  constructor(code: WebGpuErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WebGpuError';
    this.code = code;
  }
}

export function isWebGpuFailure(error: unknown): error is Error & { code: WebGpuErrorCode } {
  return error instanceof Error && 'code' in error && typeof error.code === 'string' && error.code.startsWith('WEBGPU_');
}

const REQUIRED_MESSAGE = 'Lolly requires WebGPU. Use an up-to-date browser or app with graphics acceleration enabled.';
const ACQUISITION_BUDGET_MS = 8000;
const lossSignals = new WeakMap<GPUDevice, AbortSignal>();

export interface WebGpuProvider {
  requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
}

export function createWebGpuDeviceService(readGpu: () => WebGpuProvider | undefined, budgetMs = ACQUISITION_BUDGET_MS) {
  let pending: Promise<GPUDevice> | null = null;
  let current: GPUDevice | null = null;
  let lost: WebGpuError | null = null;
  let generation = 0;

  function reset(): void {
    generation++;
    const previous = current;
    current = null;
    pending = null;
    lost = null;
    previous?.destroy();
  }

  function get(): Promise<GPUDevice> {
    if (lost) return Promise.reject(lost);
    if (current) return Promise.resolve(current);
    if (pending) return pending;
    const attempt = generation;
    let expired = false;
    let timer: ReturnType<typeof setTimeout>;
    const acquisition = (async () => {
      const gpu = readGpu();
      if (!gpu) throw new WebGpuError('WEBGPU_REQUIRED', REQUIRED_MESSAGE);
      const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new WebGpuError('WEBGPU_UNAVAILABLE', REQUIRED_MESSAGE);
      const device = await adapter.requestDevice({ label: 'Lolly compute' });
      if (expired || attempt !== generation) {
        device.destroy();
        throw new WebGpuError('WEBGPU_UNAVAILABLE', 'WebGPU initialisation expired. Reload Lolly to try again.');
      }
      if (device.limits.maxStorageBuffersPerShaderStage < 3 || device.limits.maxComputeInvocationsPerWorkgroup < 64
        || device.limits.maxComputeWorkgroupSizeX < 64 || device.limits.maxStorageBufferBindingSize < 1024 * 1024) {
        device.destroy();
        throw new WebGpuError('WEBGPU_LIMIT', 'This graphics device does not provide the WebGPU limits Lolly requires.');
      }
      current = device;
      const lossController = new AbortController();
      lossSignals.set(device, lossController.signal);
      void device.lost.then(() => {
        const failure = new WebGpuError('WEBGPU_DEVICE_LOST', 'The graphics device was lost. Reload Lolly to reconnect.');
        lossController.abort(failure);
        if (current !== device || generation !== attempt) return;
        current = null;
        pending = null;
        lost = failure;
      });
      return device;
    })();
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        reject(new WebGpuError('WEBGPU_UNAVAILABLE', 'WebGPU initialisation timed out. Reload Lolly to try again.'));
      }, budgetMs);
    });
    const result = Promise.race([acquisition, deadline]).catch(error => {
      if (isWebGpuFailure(error)) throw error;
      throw new WebGpuError('WEBGPU_UNAVAILABLE', REQUIRED_MESSAGE, { cause: error });
    }).finally(() => {
      clearTimeout(timer);
      if (pending === result) pending = null;
    });
    pending = result;
    return result;
  }
  return { get, reset };
}

const devices = createWebGpuDeviceService(() => globalThis.navigator?.gpu);
export const requireWebGpu = devices.get;
export const resetWebGpuDevice = devices.reset;

export function webGpuLossSignal(device: GPUDevice): AbortSignal {
  const signal = lossSignals.get(device);
  if (!signal) throw new WebGpuError('WEBGPU_UNAVAILABLE', 'This graphics device is not owned by Lolly.');
  return signal;
}
