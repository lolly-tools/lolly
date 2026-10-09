// SPDX-License-Identifier: MPL-2.0
/** Opt-in P3f renderer. Normal export and preview routing do not import this module. */
import { designRasterIdentity, readDesignRasterEvaluation, DESIGN_RASTER_RECIPE, type DesignRasterEvaluation } from '../../../../../engine/src/design-draw-raster.ts';
import { WebGpuError, webGpuLossSignal } from './device.ts';
import { runWebGpuOperation } from './operation.ts';
import { DESIGN_PAGE_SHADER, DESIGN_PAGE_READBACK_SHADER } from './design-page-shader.ts';

const MAX_JOB_BYTES = 128 * 1024 * 1024;
interface Pipelines { render: GPURenderPipeline; readback: GPUComputePipeline }
export interface DesignRasterServices {
  run<T>(work: (device: GPUDevice) => Promise<T>): Promise<T>;
  loss(device: GPUDevice): AbortSignal;
}
export interface DesignRasterResult {
  width: number; height: number; data: Uint8ClampedArray<ArrayBuffer>; identity: string;
  allocation: { peakBytes: number; created: number; destroyed: number; liveBytes: number };
}

/** Cancellation/loss may reject a wait, but owned job resources always finish cleanup first. */
async function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void work.catch(() => {}); signal.throwIfAborted(); }
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function parameters(e: DesignRasterEvaluation): Float32Array<ArrayBuffer> {
  const data = new Float32Array(e.ops.length * 16);
  e.ops.forEach((p, index) => {
    const at = index * 16, angle = p.pose[0] * Math.PI / 180;
    data.set(p.box, at); data.set(p.color, at + 4);
    data.set([p.radius, p.shape === 'ellipse' ? 1 : 0, Math.cos(angle), Math.sin(angle), p.pose[1] ? -1 : 1, p.pose[2] ? -1 : 1, 0, 0], at + 8);
  });
  return data;
}

function limits(e: DesignRasterEvaluation, device: GPUDevice): { bytes: number; x: number; y: number; peakBytes: number } {
  const bytes = e.pixelWidth * e.pixelHeight * 4, groups = Math.ceil(bytes / 4 / 64);
  const x = Math.min(groups, device.limits.maxComputeWorkgroupsPerDimension), y = Math.ceil(groups / x);
  const peakBytes = bytes * 3 + e.ops.length * 64 + 32;
  if (peakBytes > MAX_JOB_BYTES || bytes > Math.min(device.limits.maxBufferSize, device.limits.maxStorageBufferBindingSize)
    || e.ops.length * 64 > device.limits.maxStorageBufferBindingSize || y > device.limits.maxComputeWorkgroupsPerDimension
    || e.pixelWidth > device.limits.maxTextureDimension2D || e.pixelHeight > device.limits.maxTextureDimension2D) {
    throw new WebGpuError('WEBGPU_LIMIT', 'The Design page exceeds the raster resource budget or graphics device limits.');
  }
  return { bytes, x, y, peakBytes };
}

async function compile(device: GPUDevice): Promise<Pipelines> {
  const render = await device.createRenderPipelineAsync({ label: DESIGN_RASTER_RECIPE, layout: 'auto',
    vertex: { module: device.createShaderModule({ code: DESIGN_PAGE_SHADER }), entryPoint: 'vertex' },
    fragment: { module: device.createShaderModule({ code: DESIGN_PAGE_SHADER }), entryPoint: 'fragment', targets: [{ format: 'rgba8unorm', blend: {
      color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    } }] }, primitive: { topology: 'triangle-list' } });
  const readback = await device.createComputePipelineAsync({ label: `${DESIGN_RASTER_RECIPE}:rgba`, layout: 'auto',
    compute: { module: device.createShaderModule({ code: DESIGN_PAGE_READBACK_SHADER }), entryPoint: 'main' } });
  return { render, readback };
}

async function draw(device: GPUDevice, p: Pipelines, e: DesignRasterEvaluation, signal: AbortSignal): Promise<Omit<DesignRasterResult, 'identity'>> {
  const budget = limits(e, device), owned: Array<GPUBuffer | GPUTexture> = [];
  const allocation = { peakBytes: budget.peakBytes, created: 0, destroyed: 0, liveBytes: 0 };
  const buffer = (size: number, usage: GPUBufferUsageFlags, label: string) => {
    const resource = device.createBuffer({ size, usage, label }); owned.push(resource); allocation.created++; allocation.liveBytes += size; return resource;
  };
  device.pushErrorScope('out-of-memory'); device.pushErrorScope('validation');
  let scopes = 2;
  try {
    signal.throwIfAborted();
    const texture = device.createTexture({ label: 'Design raster target', size: [e.pixelWidth, e.pixelHeight], format: 'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    owned.push(texture); allocation.created++; allocation.liveBytes += budget.bytes;
    const ops = buffer(e.ops.length * 64, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'Design raster operations');
    const geometry = buffer(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'Design raster dimensions');
    const convert = buffer(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'Design raster readback dimensions');
    const pixels = buffer(budget.bytes, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC, 'Design raster pixels');
    const readback = buffer(budget.bytes, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, 'Design raster readback');
    device.queue.writeBuffer(ops, 0, parameters(e));
    device.queue.writeBuffer(geometry, 0, new Float32Array([e.width, e.height, e.pixelWidth, e.pixelHeight]));
    device.queue.writeBuffer(convert, 0, new Uint32Array([e.pixelWidth, e.pixelHeight, budget.x * 64, 0]));
    const renderGroup = device.createBindGroup({ layout: p.render.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: ops } }, { binding: 1, resource: { buffer: geometry } },
    ] });
    const convertGroup = device.createBindGroup({ layout: p.readback.getBindGroupLayout(0), entries: [
      { binding: 0, resource: texture.createView() }, { binding: 1, resource: { buffer: pixels } }, { binding: 2, resource: { buffer: convert } },
    ] });
    const encoder = device.createCommandEncoder({ label: DESIGN_RASTER_RECIPE });
    const render = encoder.beginRenderPass({ colorAttachments: [{ view: texture.createView(), clearValue: [0, 0, 0, 0], loadOp: 'clear', storeOp: 'store' }] });
    render.setPipeline(p.render); render.setBindGroup(0, renderGroup);
    // Each draw completes before the next paint; opacity is not applied to an overlapping instanced batch.
    e.ops.forEach((_, index) => { render.draw(6, 1, 0, index); }); render.end();
    const compute = encoder.beginComputePass(); compute.setPipeline(p.readback); compute.setBindGroup(0, convertGroup); compute.dispatchWorkgroups(budget.x, budget.y); compute.end();
    encoder.copyBufferToBuffer(pixels, 0, readback, 0, budget.bytes); device.queue.submit([encoder.finish()]);
    await abortable(readback.mapAsync(GPUMapMode.READ, 0, budget.bytes), signal); signal.throwIfAborted();
    const data = new Uint8ClampedArray(readback.getMappedRange(0, budget.bytes).slice(0)); readback.unmap();
    scopes--; const validation = await abortable(device.popErrorScope(), signal);
    scopes--; const memory = await abortable(device.popErrorScope(), signal);
    if (validation || memory) throw new WebGpuError('WEBGPU_OPERATION_FAILED', 'The graphics device could not rasterize the Design page.', { cause: validation ?? memory });
    return { width: e.pixelWidth, height: e.pixelHeight, data, allocation };
  } finally {
    for (const resource of owned) { resource.destroy(); allocation.destroyed++; }
    allocation.liveBytes = 0;
    while (scopes > 0) { scopes--; await abortable(device.popErrorScope(), signal).catch(() => null); }
  }
}

/** Injected services are an explicit unit-test seam; the normal singleton uses the product device service. */
export function createDesignRasterRenderer(services: DesignRasterServices = { run: runWebGpuOperation, loss: webGpuLossSignal }) {
  const pipelines = new WeakMap<GPUDevice, Promise<Pipelines>>();
  return async (input: DesignRasterEvaluation, signal?: AbortSignal): Promise<DesignRasterResult> => {
    const e = readDesignRasterEvaluation(input);
    if (!e) throw new WebGpuError('WEBGPU_OPERATION_FAILED', 'The frozen Design raster evaluation is invalid.');
    signal?.throwIfAborted();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(designRasterIdentity(e)));
    signal?.throwIfAborted();
    const identity = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    let cleaned: Promise<void> | undefined;
    try {
      const result = await services.run(async device => {
        let done!: () => void; cleaned = new Promise<void>(resolve => { done = resolve; });
        const loss = services.loss(device), combined = signal ? AbortSignal.any([loss, signal]) : loss;
        try {
          combined.throwIfAborted(); limits(e, device);
          let p = pipelines.get(device);
          if (!p) { p = compile(device).catch(error => { pipelines.delete(device); throw error; }); pipelines.set(device, p); }
          return await draw(device, await abortable(p, combined), e, combined);
        } finally { done(); }
      });
      signal?.throwIfAborted();
      return { ...result, identity };
    } finally { await cleaned; }
  };
}

export const renderDesignRaster = createDesignRasterRenderer();
