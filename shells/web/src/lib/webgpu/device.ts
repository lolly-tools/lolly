/// <reference types="@webgpu/types" />
// SPDX-License-Identifier: MPL-2.0
/** The creative shell requires a usable compute device. Acquisition never selects a fallback. */

export type WebGpuErrorCode = 'WEBGPU_REQUIRED' | 'WEBGPU_INSECURE_CONTEXT' | 'WEBGPU_UNAVAILABLE' | 'WEBGPU_DEVICE_LOST' | 'WEBGPU_LIMIT' | 'WEBGPU_OPERATION_FAILED' | 'WEBGPU_BUSY';

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
/** Browsers withhold WebGPU from any page that is not a secure context, so a
 *  self-hosted copy served over plain HTTP never sees the API at all. */
const INSECURE_MESSAGE = 'Lolly requires WebGPU, and browsers only offer WebGPU on secure (HTTPS) pages. This instance is served over plain HTTP. Ask whoever runs it to serve it over HTTPS.';
const ACQUISITION_BUDGET_MS = 8000;
/**
 * An automated browser (the CLI, MCP and test renderers) draws on software graphics,
 * whose first device can take far longer to start than a person's hardware: measured
 * up to 9 s for the adapter alone on a loaded machine. Only those browsers wait longer.
 */
const AUTOMATION_BUDGET_MS = 30000;
const lossSignals = new WeakMap<GPUDevice, AbortSignal>();

export interface WebGpuProvider {
  requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
}

export interface WebGpuEnvironment {
  /** False on a page served over plain HTTP. Defaults to the realm's `isSecureContext`. */
  secureContext?(): boolean;
}

/**
 * The unsupported-environment card's words for a failure, or null to show the
 * failure's own (English) message. `t` is the shell's translator, passed in so this
 * module stays free of the i18n catalogue: the photo-look worker imports it too.
 */
export function webGpuFailureText(error: Error & { code: WebGpuErrorCode }, t: (source: string) => string): string | null {
  if (error.code === 'WEBGPU_INSECURE_CONTEXT') {
    return t('Lolly requires WebGPU, and browsers only offer WebGPU on secure (HTTPS) pages. This instance is served over plain HTTP. Ask whoever runs it to serve it over HTTPS.');
  }
  return null;
}

function meetsLimits(limits: GPUSupportedLimits): boolean {
  return limits.maxStorageBuffersPerShaderStage >= 3 && limits.maxComputeInvocationsPerWorkgroup >= 64
    && limits.maxComputeWorkgroupSizeX >= 64 && limits.maxStorageBufferBindingSize >= 1024 * 1024;
}

export function createWebGpuDeviceService(readGpu: () => WebGpuProvider | undefined, budgetMs = ACQUISITION_BUDGET_MS, environment: WebGpuEnvironment = {}) {
  const secure = environment.secureContext ?? (() => globalThis.isSecureContext !== false);
  let pending: Promise<GPUDevice> | null = null;
  let current: GPUDevice | null = null;
  let lost: WebGpuError | null = null;
  let generation = 0;
  let checked: Promise<void> | null = null;

  /** One adapter and one device within the deadline, refused below the required
   *  limits. `stale` reports that the caller has moved on, and a device that answers
   *  after the deadline or after that is destroyed rather than leaked. */
  function acquire(adapterOptions: GPURequestAdapterOptions, label: string, stale: () => boolean): Promise<GPUDevice> {
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const acquisition = (async () => {
      if (!secure()) throw new WebGpuError('WEBGPU_INSECURE_CONTEXT', INSECURE_MESSAGE);
      const gpu = readGpu();
      if (!gpu) throw new WebGpuError('WEBGPU_REQUIRED', REQUIRED_MESSAGE);
      const adapter = await gpu.requestAdapter(adapterOptions);
      if (!adapter) throw new WebGpuError('WEBGPU_UNAVAILABLE', REQUIRED_MESSAGE);
      const device = await adapter.requestDevice({ label });
      if (expired || stale()) {
        device.destroy();
        throw new WebGpuError('WEBGPU_UNAVAILABLE', 'WebGPU initialisation expired. Reload Lolly to try again.');
      }
      if (!meetsLimits(device.limits)) {
        device.destroy();
        throw new WebGpuError('WEBGPU_LIMIT', 'This graphics device does not provide the WebGPU limits Lolly requires.');
      }
      return device;
    })();
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        reject(new WebGpuError('WEBGPU_UNAVAILABLE', 'WebGPU initialisation timed out. Reload Lolly to try again.'));
      }, budgetMs);
    });
    return Promise.race([acquisition, deadline]).catch(error => {
      if (isWebGpuFailure(error)) throw error;
      throw new WebGpuError('WEBGPU_UNAVAILABLE', REQUIRED_MESSAGE, { cause: error });
    }).finally(() => clearTimeout(timer));
  }

  function reset(): void {
    generation++;
    const previous = current;
    current = null;
    pending = null;
    lost = null;
    previous?.destroy();
  }

  /** The device GPU operations run on: high performance, kept until it is lost or reset. */
  function get(): Promise<GPUDevice> {
    if (lost) return Promise.reject(lost);
    if (current) return Promise.resolve(current);
    if (pending) return pending;
    const attempt = generation;
    const result = acquire({ powerPreference: 'high-performance' }, 'Lolly compute', () => attempt !== generation).then(device => {
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
    }).finally(() => {
      if (pending === result) pending = null;
    });
    pending = result;
    return result;
  }

  /**
   * The startup requirement check (plan 295, section 2), once per service: an adapter
   * at the browser's default power preference and a device that meets the limits, then
   * released. It proves the requirement without holding a device for the tab's
   * lifetime, and without waking a discrete GPU on a machine that has two. A GPU
   * operation acquires its own high-performance device through get() when it first runs.
   */
  function check(): Promise<void> {
    checked ??= acquire({}, 'Lolly startup check', () => false).then(device => { device.destroy(); });
    return checked;
  }

  return { get, reset, check };
}

const devices = createWebGpuDeviceService(() => globalThis.navigator?.gpu, globalThis.navigator?.webdriver ? AUTOMATION_BUDGET_MS : ACQUISITION_BUDGET_MS);
export const requireWebGpu = devices.get;
export const resetWebGpuDevice = devices.reset;

let startupCheck: Promise<void> | null = null;

/** Start the startup check and return its promise without waiting. boot() calls this
 *  first, so the check runs alongside the rest of boot and the gallery paints at once. */
export function startWebGpuCheck(): Promise<void> {
  startupCheck ??= devices.check();
  return startupCheck;
}

/**
 * What a surface that runs a tool or a GPU operation waits for: boot's startup check,
 * rejecting with its WebGpuError. Where no shell booted (unit tests, a worker) there is
 * no check to wait for and this resolves at once.
 */
export function webGpuChecked(): Promise<void> {
  return startupCheck ?? Promise.resolve();
}

export function webGpuLossSignal(device: GPUDevice): AbortSignal {
  const signal = lossSignals.get(device);
  if (!signal) throw new WebGpuError('WEBGPU_UNAVAILABLE', 'This graphics device is not owned by Lolly.');
  return signal;
}
