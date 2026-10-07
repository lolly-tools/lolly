// SPDX-License-Identifier: MPL-2.0
import { WebGpuError, webGpuLossSignal } from './device.ts';

export const LUT_MAX_PASSES = 8;
export const LUT_MAX_TABLE_BYTES = 32 * 1024 * 1024;
export const LUT_WORKSPACE_BUDGET = 128 * 1024 * 1024;

export interface LutWorkspace {
  capacity: number;
  stride: number;
  source: GPUBuffer;
  output: GPUBuffer;
  readback: GPUBuffer;
  parameters: GPUBuffer;
}

interface Entry {
  workspace: LutWorkspace;
  idle?: ReturnType<typeof setTimeout>;
  dispose(): void;
}

/** Serial GPU operations lease one bounded workspace per device, released after idle or loss. */
export function createLutWorkspaceCache(idleMs = 30_000) {
  const entries = new WeakMap<GPUDevice, Entry>();

  function acquire(device: GPUDevice, bytes: number, tableBytes: number, loss = webGpuLossSignal(device)): LutWorkspace {
    loss.throwIfAborted();
    const stride = Math.ceil(64 / device.limits.minUniformBufferOffsetAlignment) * device.limits.minUniformBufferOffsetAlignment;
    const parameterBytes = stride * LUT_MAX_PASSES;
    if (bytes * 3 + parameterBytes + tableBytes > LUT_WORKSPACE_BUDGET) {
      throw new WebGpuError('WEBGPU_LIMIT', 'This grading chain exceeds the graphics memory budget.');
    }
    let entry = entries.get(device);
    if (entry && (entry.workspace.capacity < bytes || entry.workspace.capacity * 3 + parameterBytes + tableBytes > LUT_WORKSPACE_BUDGET)) {
      entry.dispose(); entry = undefined;
    }
    if (entry) { clearTimeout(entry.idle); return entry.workspace; }
    const buffers: GPUBuffer[] = [];
    const buffer = (size: number, usage: GPUBufferUsageFlags, label: string): GPUBuffer => {
      const result = device.createBuffer({ size, usage, label }); buffers.push(result); return result;
    };
    try {
      const workspace: LutWorkspace = {
        capacity: bytes, stride,
        source: buffer(bytes, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC, 'LUT source'),
        output: buffer(bytes, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC, 'LUT output'),
        readback: buffer(bytes, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, 'LUT readback'),
        parameters: buffer(parameterBytes, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'LUT parameters'),
      };
      const created: Entry = { workspace, dispose: () => {
        clearTimeout(created.idle);
        loss.removeEventListener('abort', created.dispose);
        for (const resource of buffers) resource.destroy();
        if (entries.get(device) === created) entries.delete(device);
      } };
      entries.set(device, created);
      loss.addEventListener('abort', created.dispose, { once: true });
      return workspace;
    } catch (error) {
      for (const resource of buffers) resource.destroy();
      throw error;
    }
  }

  function release(device: GPUDevice, keep: boolean): void {
    const entry = entries.get(device);
    if (!entry) return;
    if (keep) entry.idle = setTimeout(entry.dispose, idleMs);
    else entry.dispose();
  }

  function stats(device: GPUDevice): { capacity: number; retainedBytes: number } {
    const workspace = entries.get(device)?.workspace;
    return workspace ? { capacity: workspace.capacity, retainedBytes: workspace.capacity * 3 + workspace.stride * LUT_MAX_PASSES }
      : { capacity: 0, retainedBytes: 0 };
  }
  return { acquire, release, stats };
}

export const lutWorkspaces = createLutWorkspaceCache();
