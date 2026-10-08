// SPDX-License-Identifier: MPL-2.0
import { requireWebGpu, webGpuLossSignal, WebGpuError } from './device.ts';

let tail: Promise<void> = Promise.resolve();
let admitted = 0;

/** Serialise this realm's error scopes and bound queued GPU operation state. */
export function runWebGpuOperation<T>(work: (device: GPUDevice) => Promise<T>): Promise<T> {
  if (admitted >= 8) return Promise.reject(new WebGpuError('WEBGPU_BUSY', 'The graphics queue is full. Try again after the current work finishes.'));
  admitted++;
  const result = tail.then(async () => {
    const device = await requireWebGpu();
    const signal = webGpuLossSignal(device);
    signal.throwIfAborted();
    return new Promise<T>((resolve, reject) => {
      const lost = () => reject(signal.reason);
      signal.addEventListener('abort', lost, { once: true });
      Promise.resolve().then(() => work(device)).then(resolve, reject).finally(() => signal.removeEventListener('abort', lost));
    });
  }).finally(() => { admitted--; });
  tail = result.then(() => {}, () => {});
  return result;
}
