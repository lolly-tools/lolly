// SPDX-License-Identifier: MPL-2.0
/** Buffer admission shared by the GPU executor and the Rust comparison adapter. */
import type { GradeLut } from '../../../engine/src/grade.ts';

export { LUT_GPU_RECIPE } from './pixel-kernel-recipe.ts';
export const PIXEL_KERNEL_MAX_PIXELS = 8 * 1024 * 1024;
export const PIXEL_KERNEL_MAX_LUT_SIZE = 129;
export const PIXEL_KERNEL_MAX_LUT_VALUE = 64;

export function admitLutJob(pixels: Uint8ClampedArray, lut: GradeLut, intensity: number): number {
  if (!(pixels instanceof Uint8ClampedArray) || pixels.length % 4 || pixels.length / 4 > PIXEL_KERNEL_MAX_PIXELS) {
    throw new Error('LUT grading requires a bounded RGBA8 frame.');
  }
  if (!Number.isFinite(intensity)) throw new Error('LUT intensity must be finite.');
  if (!lut || !['1d', '3d'].includes(lut.kind) || !Number.isInteger(lut.size) || lut.size < 2 || lut.size > PIXEL_KERNEL_MAX_LUT_SIZE) {
    throw new Error('The LUT grid is outside the supported range.');
  }
  const length = (lut.kind === '3d' ? lut.size ** 3 : lut.size) * 3;
  if (!(lut.data instanceof Float32Array) || lut.data.length !== length) throw new Error('The LUT buffer does not match its grid.');
  if (!Array.isArray(lut.domainMin) || !Array.isArray(lut.domainMax) || lut.domainMin.length !== 3 || lut.domainMax.length !== 3) {
    throw new Error('The LUT domain must contain three channels.');
  }
  for (let channel = 0; channel < 3; channel++) {
    const low = lut.domainMin[channel]!, high = lut.domainMax[channel]!;
    if (!Number.isFinite(low) || !Number.isFinite(high) || Math.abs(low) > 1e6 || Math.abs(high) > 1e6) {
      throw new Error('The LUT domain is outside the supported range.');
    }
    if (low !== high && Math.fround(high) === Math.fround(low)) throw new Error('The LUT domain is too narrow for WebGPU grading.');
  }
  for (const value of lut.data) {
    if (!Number.isFinite(value) || Math.abs(value) > PIXEL_KERNEL_MAX_LUT_VALUE) throw new Error('The LUT contains an unsupported sample.');
  }
  return Math.max(0, Math.min(1, intensity));
}
