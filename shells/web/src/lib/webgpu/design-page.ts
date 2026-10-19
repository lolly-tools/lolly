// SPDX-License-Identifier: MPL-2.0
/** Opt-in P3f renderer. Normal export and preview routing do not import this module. */
import { designRasterIdentity, readDesignRasterEvaluation, DESIGN_RASTER_RECIPE, type DesignRasterEvaluation } from '../../../../../engine/src/design-draw-raster.ts';
import { WebGpuError, webGpuLossSignal } from './device.ts';
import { runWebGpuOperation } from './operation.ts';
import {
  DESIGN_FILL_BOTH_CLIPPED_SHADER, DESIGN_FILL_CLIPPED_SHADER, DESIGN_FILL_ROW_CLIPPED_SHADER, DESIGN_FILL_SHADER,
  DESIGN_GRADIENT_BOTH_CLIPPED_SHADER, DESIGN_GRADIENT_CLIPPED_SHADER, DESIGN_GRADIENT_ROW_CLIPPED_SHADER, DESIGN_GRADIENT_SHADER,
  DESIGN_PAGE_BOTH_CLIPPED_SHADER, DESIGN_PAGE_CLIPPED_SHADER, DESIGN_PAGE_ROW_CLIPPED_SHADER, DESIGN_PAGE_SHADER, DESIGN_PAGE_READBACK_SHADER,
  DESIGN_ROW_CLIP_BYTES,
} from './design-page-shader.ts';

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

type Outline = Pick<DesignRasterEvaluation['ops'][number], 'box' | 'color' | 'shape' | 'radius' | 'pose'>;

/** One primitive's 16 floats: box, colour, shape and turn, mirror and contour segments. */
function pack(data: Float32Array, at: number, p: Outline, e: DesignRasterEvaluation): void {
  const angle = p.pose[0] * Math.PI / 180;
  data.set(p.box, at); data.set(p.color, at + 4);
  // An inscribed circular contour has maximum error r * (1 - cos(pi / (4n))).
  // The largest output radius bounds that error after rotation or unequal scaling.
  const radius = (p.shape === 'ellipse' ? Math.max(p.box[2], p.box[3]) / 2 : p.radius)
    * Math.max(e.pixelWidth / e.width, e.pixelHeight / e.height);
  const segments = radius > 1 / 16 ? Math.max(4, Math.ceil(Math.PI / 4 / Math.acos(1 - 1 / (16 * radius)))) : 4;
  data.set([p.radius, p.shape === 'ellipse' ? 1 : 0, Math.cos(angle), Math.sin(angle), p.pose[1] ? -1 : 1, p.pose[2] ? -1 : 1, segments, Math.cos(Math.PI / (4 * segments))], at + 8);
}

function parameters(e: DesignRasterEvaluation): Float32Array<ArrayBuffer> {
  const data = new Float32Array(e.ops.length * 16);
  e.ops.forEach((p, index) => { pack(data, index * 16, p, e); });
  return data;
}

/** The frame's clip as an unturned primitive outline. */
function clipParameters(e: DesignRasterEvaluation): Float32Array<ArrayBuffer> {
  const data = new Float32Array(16);
  if (e.clip) pack(data, 0, { box: e.clip.box, color: [0, 0, 0, 0], shape: e.clip.shape, radius: e.clip.radius, pose: [0, false, false] }, e);
  return data;
}

/** The passes beyond the primitive one, and their versions inside the frame's clip, a row's clip or both. */
type Variant = Exclude<`${DesignRasterEvaluation['paint'][number][0]}${'' | '-clip'}${'' | '-row'}`, 'primitive'>;
const VARIANT_SHADERS: Record<Variant, string> = {
  fill: DESIGN_FILL_SHADER, gradient: DESIGN_GRADIENT_SHADER, 'primitive-clip': DESIGN_PAGE_CLIPPED_SHADER,
  'fill-clip': DESIGN_FILL_CLIPPED_SHADER, 'gradient-clip': DESIGN_GRADIENT_CLIPPED_SHADER,
  'primitive-row': DESIGN_PAGE_ROW_CLIPPED_SHADER, 'fill-row': DESIGN_FILL_ROW_CLIPPED_SHADER, 'gradient-row': DESIGN_GRADIENT_ROW_CLIPPED_SHADER,
  'primitive-clip-row': DESIGN_PAGE_BOTH_CLIPPED_SHADER, 'fill-clip-row': DESIGN_FILL_BOTH_CLIPPED_SHADER, 'gradient-clip-row': DESIGN_GRADIENT_BOTH_CLIPPED_SHADER,
};
/**
 * Which pass draws each paint step, and the row clip it is drawn inside (-1 for none): steps
 * from the frame clip's `from` on are drawn inside the frame's clip, and a row clip's steps inside its polygon.
 */
function stepVariants(e: DesignRasterEvaluation): Array<{ variant: Variant | 'primitive'; row: number }> {
  let r = 0;
  return e.paint.map(([kind], i) => {
    while (r < e.rowClips.length && e.rowClips[r]!.to <= i) r++;
    const row = r < e.rowClips.length && e.rowClips[r]!.from <= i ? r : -1;
    return { variant: `${kind}${e.clip && i >= e.clip.from ? '-clip' : ''}${row >= 0 ? '-row' : ''}` as Variant | 'primitive', row };
  });
}

/** Bytes between row clips in their uniform buffer, each starting where the device lets a binding start. */
const rowClipStride = (device: GPUDevice) => { const align = device.limits.minUniformBufferOffsetAlignment || 256; return Math.ceil(DESIGN_ROW_CLIP_BYTES / align) * align; };

/** Row clip uniforms, `stride` bytes apart: bounds, point count and points, in output pixels. */
function rowClipParameters(e: DesignRasterEvaluation, stride: number): ArrayBuffer {
  const sx = e.pixelWidth / e.width, sy = e.pixelHeight / e.height;
  const data = new ArrayBuffer(e.rowClips.length * stride), floats = new Float32Array(data), words = new Uint32Array(data);
  e.rowClips.forEach((c, index) => {
    const at = index * stride / 4;
    floats.set([c.bounds[0] * sx, c.bounds[1] * sy, c.bounds[2] * sx, c.bounds[3] * sy], at);
    words[at + 4] = c.points.length / 2;
    for (let i = 0; i < c.points.length; i += 2) { floats[at + 8 + i] = c.points[i]! * sx; floats[at + 9 + i] = c.points[i + 1]! * sy; }
  });
  return data;
}

/** Fill descriptors (bounds, colour, edge range and rule, 48 bytes each) and edges in output pixels. */
function fillParameters(e: DesignRasterEvaluation): { fills: ArrayBuffer; edges: Float32Array<ArrayBuffer> } {
  const sx = e.pixelWidth / e.width, sy = e.pixelHeight / e.height;
  const fills = new ArrayBuffer(e.fills.length * 48), floats = new Float32Array(fills), words = new Uint32Array(fills);
  const edges = new Float32Array(e.fills.reduce((n, f) => n + f.edges.length, 0));
  let at = 0;
  e.fills.forEach((f, index) => {
    floats.set(f.bounds, index * 12); floats.set(f.color, index * 12 + 4);
    words.set([at / 4, f.edges.length / 4, f.evenOdd ? 1 : 0, 0], index * 12 + 8);
    for (let i = 0; i < f.edges.length; i += 2) { edges[at + i] = f.edges[i]! * sx; edges[at + i + 1] = f.edges[i + 1]! * sy; }
    at += f.edges.length;
  });
  return { fills, edges };
}

/** Gradient descriptors (geometry, tile, then primitive, kind, first stop and stop count; 48 bytes each) and their stops as offset and colour pairs. */
function gradientParameters(e: DesignRasterEvaluation): { gradients: ArrayBuffer; stops: Float32Array<ArrayBuffer> } {
  const gradients = new ArrayBuffer(e.gradients.length * 48), floats = new Float32Array(gradients), words = new Uint32Array(gradients);
  const stops = new Float32Array(e.gradients.reduce((n, g) => n + g.stops.length / 5 * 8, 0));
  let at = 0;
  e.gradients.forEach((g, index) => {
    floats.set(g.geometry, index * 12); floats.set(g.tile, index * 12 + 4);
    words.set([g.primitive, g.kind === 'linear' ? 0 : 1, at / 4, g.stops.length / 5], index * 12 + 8);
    for (let i = 0; i < g.stops.length; i += 5) { stops.set([g.stops[i]!, 0, 0, 0, g.stops[i + 1]!, g.stops[i + 2]!, g.stops[i + 3]!, g.stops[i + 4]!], at); at += 8; }
  });
  return { gradients, stops };
}

function limits(e: DesignRasterEvaluation, device: GPUDevice): { bytes: number; x: number; y: number; peakBytes: number; fillBytes: number; edgeBytes: number; gradientBytes: number; stopBytes: number; rowClipBytes: number } {
  const bytes = e.pixelWidth * e.pixelHeight * 4, groups = Math.ceil(bytes / 4 / 64);
  const x = Math.min(groups, device.limits.maxComputeWorkgroupsPerDimension), y = Math.ceil(groups / x);
  const fillBytes = e.fills.length * 48, edgeBytes = e.fills.reduce((n, f) => n + f.edges.length, 0) * 4;
  const gradientBytes = e.gradients.length * 48, stopBytes = e.gradients.reduce((n, g) => n + g.stops.length / 5, 0) * 32;
  const rowClipBytes = e.rowClips.length * rowClipStride(device);
  const peakBytes = bytes * 3 + e.ops.length * 64 + 32 + (e.fills.length ? fillBytes + edgeBytes + 16 : 0) + gradientBytes + stopBytes + (e.clip ? 64 : 0) + rowClipBytes;
  if (peakBytes > MAX_JOB_BYTES || bytes > Math.min(device.limits.maxBufferSize, device.limits.maxStorageBufferBindingSize)
    || e.ops.length * 64 > device.limits.maxStorageBufferBindingSize || edgeBytes > device.limits.maxStorageBufferBindingSize
    || fillBytes > device.limits.maxStorageBufferBindingSize || stopBytes > device.limits.maxStorageBufferBindingSize || y > device.limits.maxComputeWorkgroupsPerDimension
    || rowClipBytes > device.limits.maxBufferSize
    || e.pixelWidth > device.limits.maxTextureDimension2D || e.pixelHeight > device.limits.maxTextureDimension2D) {
    throw new WebGpuError('WEBGPU_LIMIT', 'The Design page exceeds the raster resource budget or graphics device limits.');
  }
  return { bytes, x, y, peakBytes, fillBytes, edgeBytes, gradientBytes, stopBytes, rowClipBytes };
}

/** A fill, gradient or clipped pipeline, compiled only for a page whose paint steps need that pipeline. */
async function compileVariant(device: GPUDevice, variant: Variant): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ code: VARIANT_SHADERS[variant] });
  return device.createRenderPipelineAsync({ label: `${DESIGN_RASTER_RECIPE}:${variant}`, layout: 'auto',
    vertex: { module, entryPoint: 'vertex' },
    fragment: { module, entryPoint: 'fragment', targets: [{ format: 'rgba8unorm', blend: {
      color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    } }] }, primitive: { topology: 'triangle-list' } });
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

async function draw(device: GPUDevice, p: Pipelines, e: DesignRasterEvaluation, signal: AbortSignal, passes: ReadonlyMap<Variant, GPURenderPipeline>): Promise<Omit<DesignRasterResult, 'identity'>> {
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
    // Bind groups by pass and row clip: `primitive#-1` is the plain primitive pass.
    const bound = new Map<string, GPUBindGroup>([['primitive#-1', renderGroup]]);
    const pass = (variant: Variant) => {
      const pipeline = passes.get(variant);
      if (!pipeline) throw new WebGpuError('WEBGPU_OPERATION_FAILED', `The Design raster ${variant} pipeline is missing.`);
      return pipeline;
    };
    let fillBuffers: GPUBuffer[] = [], gradientBuffers: GPUBuffer[] = [], clipBuffer: GPUBuffer | undefined, rowClipBuffer: GPUBuffer | undefined;
    if (e.fills.length) {
      const packed = fillParameters(e);
      fillBuffers = [buffer(budget.fillBytes, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'Design raster fills'),
        buffer(budget.edgeBytes, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'Design raster fill edges')];
      device.queue.writeBuffer(fillBuffers[0]!, 0, packed.fills); device.queue.writeBuffer(fillBuffers[1]!, 0, packed.edges);
    }
    if (e.gradients.length) {
      const packed = gradientParameters(e);
      gradientBuffers = [buffer(budget.gradientBytes, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'Design raster gradients'),
        buffer(budget.stopBytes, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'Design raster gradient stops')];
      device.queue.writeBuffer(gradientBuffers[0]!, 0, packed.gradients); device.queue.writeBuffer(gradientBuffers[1]!, 0, packed.stops);
    }
    if (e.clip) {
      clipBuffer = buffer(64, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'Design raster frame clip');
      device.queue.writeBuffer(clipBuffer, 0, clipParameters(e));
    }
    const stride = rowClipStride(device);
    if (e.rowClips.length) {
      rowClipBuffer = buffer(budget.rowClipBytes, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'Design raster row clips');
      device.queue.writeBuffer(rowClipBuffer, 0, rowClipParameters(e, stride));
    }
    const steps = stepVariants(e);
    const keyOf = (step: (typeof steps)[number]) => `${step.variant}#${step.row}`;
    for (const step of steps) {
      const { variant, row } = step, key = keyOf(step);
      if (variant === 'primitive' || bound.has(key)) continue;
      const kind = variant.split('-')[0];
      const resources: GPUBufferBinding[] = (kind === 'fill' ? [...fillBuffers, geometry] : kind === 'gradient' ? [ops, geometry, ...gradientBuffers] : [ops, geometry]).map(b => ({ buffer: b }));
      if (variant.includes('-clip')) resources.push({ buffer: clipBuffer! });
      if (row >= 0) resources.push({ buffer: rowClipBuffer!, offset: row * stride, size: DESIGN_ROW_CLIP_BYTES });
      bound.set(key, device.createBindGroup({ layout: pass(variant).getBindGroupLayout(0), entries: resources.map((resource, binding) => ({ binding, resource })) }));
    }
    const convertGroup = device.createBindGroup({ layout: p.readback.getBindGroupLayout(0), entries: [
      { binding: 0, resource: texture.createView() }, { binding: 1, resource: { buffer: pixels } }, { binding: 2, resource: { buffer: convert } },
    ] });
    const encoder = device.createCommandEncoder({ label: DESIGN_RASTER_RECIPE });
    const render = encoder.beginRenderPass({ colorAttachments: [{ view: texture.createView(), clearValue: [0, 0, 0, 0], loadOp: 'clear', storeOp: 'store' }] });
    // Each draw completes before the next paint, in the evaluation's paint order; opacity is
    // not applied to an overlapping instanced batch.
    let current: string | undefined;
    e.paint.forEach(([, index], i) => {
      const step = steps[i]!, key = keyOf(step);
      if (key !== current) {
        current = key;
        render.setPipeline(step.variant === 'primitive' ? p.render : pass(step.variant)); render.setBindGroup(0, bound.get(key)!);
      }
      render.draw(6, 1, 0, index);
    });
    render.end();
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
  const variants = new WeakMap<GPUDevice, Map<Variant, Promise<GPURenderPipeline>>>();
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
          let cache = variants.get(device);
          if (!cache) { cache = new Map(); variants.set(device, cache); }
          const passes = new Map<Variant, GPURenderPipeline>();
          for (const variant of new Set(stepVariants(e).map(step => step.variant))) {
            if (variant === 'primitive') continue;
            let compiled = cache.get(variant);
            if (!compiled) { const owner = cache; compiled = compileVariant(device, variant).catch(error => { owner.delete(variant); throw error; }); cache.set(variant, compiled); }
            passes.set(variant, await abortable(compiled, combined));
          }
          return await draw(device, await abortable(p, combined), e, combined, passes);
        } finally { done(); }
      });
      signal?.throwIfAborted();
      return { ...result, identity };
    } finally { await cleaned; }
  };
}

export const renderDesignRaster = createDesignRasterRenderer();
