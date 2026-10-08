// SPDX-License-Identifier: MPL-2.0
/** Bounded LUT execution. The returned pixels are owned; source bytes change only at the caller's commit. */
import type { GradeLut } from '../../../../../engine/src/grade.ts';
import { admitLutJob, LUT_GPU_RECIPE } from '../../../../../packages/node-shell/src/pixel-kernel-contract.ts';
import { WebGpuError } from './device.ts';
import { runWebGpuOperation } from './operation.ts';
import { LUT_SHADER } from './lut-shader.ts';
import { lutWorkspaces, LUT_MAX_PASSES, LUT_MAX_TABLE_BYTES } from './workspace.ts';

export { LUT_GPU_RECIPE };
const pipelines = new WeakMap<GPUDevice, Promise<GPUComputePipeline>>();

function pipelineFor(device: GPUDevice): Promise<GPUComputePipeline> {
  let pending = pipelines.get(device);
  if (!pending) {
    pending = device.createComputePipelineAsync({
      label: LUT_GPU_RECIPE, layout: 'auto',
      compute: { module: device.createShaderModule({ label: LUT_GPU_RECIPE, code: LUT_SHADER }), entryPoint: 'main' },
    }).catch(error => { pipelines.delete(device); throw error; });
    pipelines.set(device, pending);
  }
  return pending;
}

function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export interface LutStep { lut: GradeLut; intensity?: number }

export function gradeLutWebGpu(pixels: Uint8ClampedArray, lut: GradeLut, intensity = 1, signal?: AbortSignal): Promise<Uint8ClampedArray<ArrayBuffer>> {
  return gradeLutChainWebGpu(pixels, [{ lut, intensity }], signal);
}

/** Each pass keeps RGBA8 quantisation. Only the final result crosses back to the CPU. */
export async function gradeLutChainWebGpu(pixels: Uint8ClampedArray, steps: readonly LutStep[], signal?: AbortSignal): Promise<Uint8ClampedArray<ArrayBuffer>> {
  signal?.throwIfAborted();
  if (!steps.length || steps.length > LUT_MAX_PASSES) throw new WebGpuError('WEBGPU_LIMIT', `A grading chain requires one to ${LUT_MAX_PASSES} LUT passes.`);
  const admitted = steps.map(step => ({ lut: step.lut, amount: admitLutJob(pixels, step.lut, step.intensity ?? 1) }));
  const passes = admitted.filter(step => step.amount > 0);
  const tableBytes = passes.reduce((sum, step) => sum + step.lut.data.byteLength, 0);
  if (tableBytes > LUT_MAX_TABLE_BYTES) throw new WebGpuError('WEBGPU_LIMIT', 'The grading chain exceeds the LUT sample memory budget.');
  signal?.throwIfAborted();
  return runWebGpuOperation(async device => {
    signal?.throwIfAborted();
    if (!pixels.length || !passes.length) return pixels.slice();
    const bytes = pixels.byteLength;
    const maxBuffer = Math.min(device.limits.maxBufferSize, device.limits.maxStorageBufferBindingSize);
    if (bytes > maxBuffer || passes.some(step => step.lut.data.byteLength > maxBuffer)) throw new WebGpuError('WEBGPU_LIMIT', 'This image or LUT exceeds the graphics device buffer limit.');
    const groups = Math.ceil(pixels.length / 4 / 64);
    const x = Math.min(groups, device.limits.maxComputeWorkgroupsPerDimension);
    const y = Math.ceil(groups / x);
    if (y > device.limits.maxComputeWorkgroupsPerDimension) throw new WebGpuError('WEBGPU_LIMIT', 'This image exceeds the graphics device dispatch limit.');
    const buffers: GPUBuffer[] = [];
    const buffer = (size: number, usage: GPUBufferUsageFlags, label: string): GPUBuffer => {
      const result = device.createBuffer({ size, usage, label }); buffers.push(result); return result;
    };
    device.pushErrorScope('out-of-memory');
    device.pushErrorScope('validation');
    let scopes = 2;
    let keep = false;
    try {
      const pipeline = await abortable(pipelineFor(device), signal);
      const workspace = lutWorkspaces.acquire(device, bytes, tableBytes);
      let input = workspace.source, output = workspace.output;
      device.queue.writeBuffer(input, 0, pixels.buffer, pixels.byteOffset, pixels.byteLength);
      const commands = device.createCommandEncoder({ label: LUT_GPU_RECIPE });
      for (const [index, { lut, amount }] of passes.entries()) {
        const table = buffer(lut.data.byteLength, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'LUT samples');
        const params = new ArrayBuffer(64);
        new Uint32Array(params).set([pixels.length / 4, lut.size, lut.kind === '1d' ? 0 : 1, x * 64]);
        const floats = new Float32Array(params);
        floats[4] = amount; floats.set(lut.domainMin, 8); floats.set(lut.domainMax, 12);
        device.queue.writeBuffer(table, 0, lut.data.buffer, lut.data.byteOffset, lut.data.byteLength);
        device.queue.writeBuffer(workspace.parameters, index * workspace.stride, params);
        const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
          { binding: 0, resource: { buffer: input, size: bytes } },
          { binding: 1, resource: { buffer: output, size: bytes } },
          { binding: 2, resource: { buffer: table } },
          { binding: 3, resource: { buffer: workspace.parameters, offset: index * workspace.stride, size: 64 } },
        ] });
        const pass = commands.beginComputePass();
        pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.dispatchWorkgroups(x, y); pass.end();
        [input, output] = [output, input];
      }
      const { readback } = workspace;
      commands.copyBufferToBuffer(input, 0, readback, 0, bytes);
      device.queue.submit([commands.finish()]);
      await abortable(readback.mapAsync(GPUMapMode.READ, 0, bytes), signal);
      signal?.throwIfAborted();
      const result = new Uint8ClampedArray(readback.getMappedRange(0, bytes).slice(0));
      readback.unmap();
      const validation = await device.popErrorScope(); scopes--;
      const memory = await device.popErrorScope(); scopes--;
      if (validation || memory) throw new WebGpuError('WEBGPU_OPERATION_FAILED', 'The graphics device could not complete LUT grading.', { cause: validation ?? memory });
      keep = true;
      return result;
    } finally {
      for (const resource of buffers) resource.destroy();
      lutWorkspaces.release(device, keep);
      while (scopes > 0) { scopes--; await device.popErrorScope().catch(() => null); }
    }
  });
}
