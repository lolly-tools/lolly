// SPDX-License-Identifier: MPL-2.0
/**
 * Gradient-map, greyscale and duotone photo looks on the GPU (plan 295 phase 1).
 * The engine builds the look's tables (photoLookPixelPlan); this runs them over
 * RGBA8 and returns owned pixels, so the source changes only at the caller's commit.
 * A frame is processed in bounded chunks through the shared frame workspace, so one
 * bake holds at most three chunk buffers whatever the photo's size.
 */
import type { PhotoLookPixelPlan } from '../../../../../engine/src/photo-look.ts';
import { photoLookGpuRecipe } from '../../../../../packages/node-shell/src/pixel-kernel-recipe.ts';
import { WebGpuError } from './device.ts';
import { runWebGpuOperation } from './operation.ts';
import {
  PHOTO_LOOK_KIND_CODE, PHOTO_LOOK_SHADER, PHOTO_LOOK_TABLE_FLOATS, PHOTO_LOOK_TABLE_LINEAR,
  PHOTO_LOOK_TABLE_RAMP, PHOTO_LOOK_TABLE_TONE, PHOTO_LOOK_TABLE_UNIT,
} from './photo-look-shader.ts';
import { lutWorkspaces } from './workspace.ts';

/** The largest frame a look bake admits; chunking keeps GPU memory independent of the frame size. */
export const PHOTO_LOOK_GPU_MAX_PIXELS = 64 * 1024 * 1024;
/** Pixels per chunk: three 4 MiB frame buffers per bake, small enough for concurrent bakes. */
export const PHOTO_LOOK_GPU_CHUNK_PIXELS = 1024 * 1024;
const LABEL = 'photo-look-webgpu';
const pipelines = new WeakMap<GPUDevice, Promise<GPUComputePipeline>>();

function pipelineFor(device: GPUDevice): Promise<GPUComputePipeline> {
  let pending = pipelines.get(device);
  if (!pending) {
    pending = device.createComputePipelineAsync({
      label: LABEL, layout: 'auto',
      compute: { module: device.createShaderModule({ label: LABEL, code: PHOTO_LOOK_SHADER }), entryPoint: 'main' },
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

function unitTable(values: ArrayLike<number> | null | undefined, length: number, name: string): ArrayLike<number> {
  if (!values || values.length !== length) throw new Error(`The photo look ${name} table must hold ${length} values.`);
  for (let i = 0; i < length; i++) {
    const value = values[i]!;
    if (!(value >= 0 && value <= 1)) throw new Error(`The photo look ${name} table holds a value outside 0 to 1.`);
  }
  return values;
}

/** The look's tables in the shader's layout, refused before any GPU work when malformed. */
export function packPhotoLookPlan(plan: PhotoLookPixelPlan): { recipe: string; kind: number; steps: number; amount: number; tables: Float32Array<ArrayBuffer> } {
  const kind = plan && Object.hasOwn(PHOTO_LOOK_KIND_CODE, plan.kind) ? PHOTO_LOOK_KIND_CODE[plan.kind] : undefined;
  if (kind === undefined) throw new Error('The photo look kind has no GPU recipe.');
  if (!(plan.amount >= 0 && plan.amount <= 1)) throw new Error('The photo look amount must be between 0 and 1.');
  const tables = new Float32Array(PHOTO_LOOK_TABLE_FLOATS);
  tables.set(unitTable(plan.unit, 256, 'grade'), PHOTO_LOOK_TABLE_UNIT);
  tables.set(unitTable(plan.linear, 256, 'linear'), PHOTO_LOOK_TABLE_LINEAR);
  if (plan.kind === 'gradient-map') tables.set(unitTable(plan.tone, 768, 'tone'), PHOTO_LOOK_TABLE_TONE);
  let steps = 0;
  if (plan.kind === 'duotone') {
    const ramp = plan.ramp;
    if (!Array.isArray(ramp) || ramp.length < 2 || ramp.length > 3) throw new Error('A duotone look needs two or three colours.');
    tables.set(unitTable(ramp.flat(), ramp.length * 3, 'duotone'), PHOTO_LOOK_TABLE_RAMP);
    steps = ramp.length - 1;
  }
  return { recipe: photoLookGpuRecipe(plan.kind)!, kind, steps, amount: plan.amount, tables };
}

export interface PhotoLookGpuOptions {
  signal?: AbortSignal;
  /** A smaller chunk than the default, for tests of the chunk seams. */
  chunkPixels?: number;
}

export async function applyPhotoLookWebGpu(pixels: Uint8ClampedArray, plan: PhotoLookPixelPlan, options: PhotoLookGpuOptions = {}): Promise<Uint8ClampedArray<ArrayBuffer>> {
  const { signal } = options;
  signal?.throwIfAborted();
  if (!(pixels instanceof Uint8ClampedArray) || pixels.length % 4 || pixels.length / 4 > PHOTO_LOOK_GPU_MAX_PIXELS) {
    throw new Error('A photo look requires a bounded RGBA8 frame.');
  }
  const packed = packPhotoLookPlan(plan);
  const requested = options.chunkPixels ?? PHOTO_LOOK_GPU_CHUNK_PIXELS;
  if (!Number.isInteger(requested) || requested < 1 || requested > PHOTO_LOOK_GPU_CHUNK_PIXELS) throw new Error('The photo look chunk size is outside its bound.');
  return runWebGpuOperation(async device => {
    signal?.throwIfAborted();
    const count = pixels.length / 4;
    if (!count) return pixels.slice();
    const maxBuffer = Math.min(device.limits.maxBufferSize, device.limits.maxStorageBufferBindingSize);
    const chunk = Math.min(requested, count, Math.floor(maxBuffer / 4));
    const chunkBytes = chunk * 4;
    const tableBytes = packed.tables.byteLength;
    const buffers: GPUBuffer[] = [];
    device.pushErrorScope('out-of-memory');
    device.pushErrorScope('validation');
    let scopes = 2;
    let keep = false;
    try {
      const pipeline = await abortable(pipelineFor(device), signal);
      const workspace = lutWorkspaces.acquire(device, chunkBytes, tableBytes);
      const table = device.createBuffer({ size: tableBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, label: `${packed.recipe} tables` });
      buffers.push(table);
      device.queue.writeBuffer(table, 0, packed.tables);
      const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: workspace.source, size: chunkBytes } },
        { binding: 1, resource: { buffer: workspace.output, size: chunkBytes } },
        { binding: 2, resource: { buffer: table } },
        { binding: 3, resource: { buffer: workspace.parameters, offset: 0, size: 32 } },
      ] });
      const result = new Uint8ClampedArray(pixels.length);
      const params = new ArrayBuffer(32);
      const words = new Uint32Array(params), floats = new Float32Array(params);
      for (let start = 0; start < count; start += chunk) {
        signal?.throwIfAborted();
        const pixelsInChunk = Math.min(chunk, count - start), bytes = pixelsInChunk * 4;
        const groups = Math.ceil(pixelsInChunk / 64);
        const x = Math.min(groups, device.limits.maxComputeWorkgroupsPerDimension);
        const y = Math.ceil(groups / x);
        if (y > device.limits.maxComputeWorkgroupsPerDimension) throw new WebGpuError('WEBGPU_LIMIT', 'This image exceeds the graphics device dispatch limit.');
        words.set([pixelsInChunk, x * 64, packed.kind, packed.steps]);
        floats[4] = packed.amount;
        device.queue.writeBuffer(workspace.parameters, 0, params);
        device.queue.writeBuffer(workspace.source, 0, pixels.buffer, pixels.byteOffset + start * 4, bytes);
        const commands = device.createCommandEncoder({ label: packed.recipe });
        const pass = commands.beginComputePass();
        pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.dispatchWorkgroups(x, y); pass.end();
        commands.copyBufferToBuffer(workspace.output, 0, workspace.readback, 0, bytes);
        device.queue.submit([commands.finish()]);
        await abortable(workspace.readback.mapAsync(GPUMapMode.READ, 0, bytes), signal);
        signal?.throwIfAborted();
        result.set(new Uint8Array(workspace.readback.getMappedRange(0, bytes)), start * 4);
        workspace.readback.unmap();
      }
      const validation = await device.popErrorScope(); scopes--;
      const memory = await device.popErrorScope(); scopes--;
      if (validation || memory) throw new WebGpuError('WEBGPU_OPERATION_FAILED', 'The graphics device could not apply the photo look.', { cause: validation ?? memory });
      keep = true;
      return result;
    } finally {
      for (const resource of buffers) resource.destroy();
      lutWorkspaces.release(device, keep);
      while (scopes > 0) { scopes--; await device.popErrorScope().catch(() => null); }
    }
  });
}
