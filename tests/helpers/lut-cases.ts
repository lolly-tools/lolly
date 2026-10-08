// SPDX-License-Identifier: MPL-2.0
import type { GradeLut } from '../../engine/src/grade.ts';

export interface LutCase { name: string; pixels: Uint8ClampedArray; lut: GradeLut; intensity: number }

export function lutTable(kind: GradeLut['kind'] = '3d', size = 5): GradeLut {
  const data = new Float32Array((kind === '3d' ? size ** 3 : size) * 3);
  if (kind === '1d') {
    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);
      data.set([t * t * 1.2 - 0.1, 1.1 - t * 1.2, t * 0.7 + 0.1], i * 3);
    }
  } else {
    for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
      const x = r / (size - 1), y = g / (size - 1), z = b / (size - 1);
      data.set([x * x * 0.8 + y * z * 0.3 - 0.05, y * y * 0.9 + x * z * 0.2, z * z * 0.7 + x * y * 0.3 + 0.02], ((b * size + g) * size + r) * 3);
    }
  }
  return { kind, size, data, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: 'Conformance' };
}

export function lutPixels(count = 4096): Uint8ClampedArray {
  const data = new Uint8ClampedArray(count * 4);
  let state = 295;
  for (let i = 0; i < data.length; i++) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; data[i] = state >>> 24; }
  const tetrahedra = [220, 140, 40, 0, 220, 40, 140, 128, 140, 40, 220, 255, 40, 140, 220, 32, 40, 220, 140, 64, 140, 220, 40, 200, 0, 0, 0, 0, 255, 255, 255, 255];
  data.set(tetrahedra.slice(0, data.length));
  return data;
}

export function lutCases(count = 4096): LutCase[] {
  const pixels = lutPixels(count);
  const identity = lutTable('3d', 2);
  for (let b = 0; b < 2; b++) for (let g = 0; g < 2; g++) for (let r = 0; r < 2; r++) identity.data.set([r, g, b], ((b * 2 + g) * 2 + r) * 3);
  const constant = lutTable('1d', 2); constant.data.fill(0.5);
  const offsetLut = lutTable();
  const parent = new Float32Array(offsetLut.data.length + 8); parent.set(offsetLut.data, 4); offsetLut.data = parent.subarray(4, parent.length - 4);
  const pixelParent = new Uint8ClampedArray(pixels.length + 12); pixelParent.set(pixels, 8);
  return [
    { name: '3D all tetrahedra', pixels, lut: lutTable(), intensity: 1 },
    { name: 'two-point cube', pixels, lut: lutTable('3d', 2), intensity: 1 },
    { name: '17-point cube', pixels, lut: lutTable('3d', 17), intensity: 1 },
    { name: '1D interpolation', pixels, lut: lutTable('1d', 7), intensity: 1 },
    { name: 'non-unit domain', pixels, lut: { ...lutTable(), domainMin: [0.12, 0.18, 0.25], domainMax: [0.9, 0.75, 0.7] }, intensity: 1 },
    { name: 'collapsed domain', pixels, lut: { ...lutTable('1d'), domainMin: [0.2, 0.3, 0.4], domainMax: [0.2, 0.3, 0.4] }, intensity: 0.375 },
    { name: 'fractional intensity', pixels, lut: lutTable(), intensity: 0.375 },
    { name: 'zero intensity', pixels, lut: lutTable(), intensity: 0 },
    { name: 'negative intensity', pixels, lut: lutTable(), intensity: -1 },
    { name: 'high intensity', pixels, lut: lutTable(), intensity: 2 },
    { name: 'identity', pixels, lut: identity, intensity: 1 },
    { name: 'constant ties', pixels, lut: constant, intensity: 1 },
    { name: 'offset views', pixels: pixelParent.subarray(8, pixelParent.length - 4), lut: offsetLut, intensity: 0.6 },
    { name: 'empty frame', pixels: new Uint8ClampedArray(), lut: lutTable(), intensity: 1 },
  ];
}
