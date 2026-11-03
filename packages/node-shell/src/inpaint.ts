// SPDX-License-Identifier: MPL-2.0
/**
 * Shared WASM transport for PatchMatch inpainting, used by the browser worker and Node.
 *
 * The engine never loads this module. The shell calls it for large removals and keeps the
 * engine's own Telea fill (`inpaintTelea`) for small marks, so the engine stays wasm-free.
 */

/** The module refuses larger images; the check here avoids building the request first. */
export const INPAINT_MAX_PIXELS = 16 * 1024 * 1024;
/** A painted area of at least this many pixels (about 90 by 90) counts as large. */
export const INPAINT_LARGE_MASK_PIXELS = 8192;
const HEADER = 16;
const OP_FILL = 1;
const MAX_PATCH_RADIUS = 8;

export class InpaintKernelError extends Error {
  constructor(message: string) { super(message); this.name = 'InpaintKernelError'; }
}

interface InpaintExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  inpaint_alloc(length: number): number;
  inpaint_free(pointer: number): void;
  inpaint_run(pointer: number, length: number, operation: number): number;
  inpaint_result_ptr(): number;
  inpaint_result_len(): number;
  inpaint_release_result(): void;
}
function isApi(e: WebAssembly.Exports): e is InpaintExports {
  return e.memory instanceof WebAssembly.Memory
    && ['inpaint_alloc', 'inpaint_free', 'inpaint_run', 'inpaint_result_ptr', 'inpaint_result_len', 'inpaint_release_result'].every(k => typeof e[k] === 'function');
}

export interface InpaintKernel {
  /**
   * Fill the masked pixels of a straight-alpha RGBA image. `mask` has one byte per pixel and
   * any non-zero byte is filled. Returns a new buffer; pixels outside the mask are unchanged.
   * Throws {@link InpaintKernelError} when the module refuses the request.
   */
  fill(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, mask: Uint8Array, opts?: { patchRadius?: number }): Uint8ClampedArray;
}

/** Which fill suits a painted area: Telea for small marks, PatchMatch for large regions. */
export function chooseRemovalFill(maskPixels: number): 'telea' | 'patchmatch' {
  return maskPixels >= INPAINT_LARGE_MASK_PIXELS ? 'patchmatch' : 'telea';
}

/** Count the filled pixels in a mask. */
export function countMask(mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) n++;
  return n;
}

export async function createInpaintKernel(wasm: Uint8Array): Promise<InpaintKernel> {
  const { instance } = await WebAssembly.instantiate(wasm as Uint8Array<ArrayBuffer>, {});
  if (!isApi(instance.exports)) throw new InpaintKernelError('The inpainting module ABI is incompatible.');
  const api = instance.exports;

  function fill(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, mask: Uint8Array, opts: { patchRadius?: number } = {}): Uint8ClampedArray {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new InpaintKernelError('The image size is not valid.');
    const pixels = width * height;
    if (pixels > INPAINT_MAX_PIXELS) throw new InpaintKernelError('The image is too large to fill (over 16 megapixels).');
    if (rgba.length !== pixels * 4 || mask.length !== pixels) throw new InpaintKernelError('The pixel and mask sizes do not match the image.');
    const radius = opts.patchRadius ?? 0;
    if (!Number.isInteger(radius) || radius < 0 || radius > MAX_PATCH_RADIUS) throw new InpaintKernelError('The patch radius is out of range.');
    const length = HEADER + pixels * 5;
    const pointer = api.inpaint_alloc(length);
    if (!pointer) throw new InpaintKernelError('The inpainting module refused the request allocation.');
    try {
      const view = new Uint8Array(api.memory.buffer, pointer, length);
      const head = new DataView(api.memory.buffer, pointer, HEADER);
      head.setUint32(0, width, true); head.setUint32(4, height, true); head.setUint32(8, radius, true); head.setUint32(12, 0, true);
      view.set(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), HEADER);
      view.set(mask, HEADER + pixels * 4);
      const status = api.inpaint_run(pointer, length, OP_FILL);
      const outLength = api.inpaint_result_len(), at = api.inpaint_result_ptr();
      if (at + outLength > api.memory.buffer.byteLength) throw new InpaintKernelError('The inpainting module returned an oversized response.');
      const out = new Uint8Array(api.memory.buffer, at, outLength).slice();
      api.inpaint_release_result();
      if (status !== 0) throw new InpaintKernelError(new TextDecoder().decode(out));
      if (out.length !== pixels * 4) throw new InpaintKernelError('The inpainting module returned the wrong size.');
      return new Uint8ClampedArray(out.buffer);
    } finally { api.inpaint_free(pointer); }
  }
  return { fill };
}
