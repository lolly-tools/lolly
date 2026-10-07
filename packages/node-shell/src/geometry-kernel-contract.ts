// SPDX-License-Identifier: MPL-2.0
/** Portable geometry pilot admission and raw ABI contract. */
export const GEOMETRY_MAX_CURVES = 16_000;
export const GEOMETRY_MAX_QUERIES = 64;
export const GEOMETRY_MAX_WORK = 262_144;
export const GEOMETRY_MAX_NEAR_CURVES = 8_000;
export const GEOMETRY_MAX_NEAR_PAIRS = 65_536;
export const GEOMETRY_MAX_POLYNOMIALS = 4_096;
export const GEOMETRY_MAX_COEFFICIENT = 1e100;

export class GeometryKernelError extends Error {
  readonly code: 'invalid-argument' | 'limit' | 'internal';
  constructor(code: GeometryKernelError['code'], message: string) {
    super(message);
    this.name = 'GeometryKernelError';
    this.code = code;
  }
}

export type GeometryExports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  geom_alloc(bytes: number): number;
  geom_free(pointer: number): void;
  geom_path_create(pointer: number): number;
  geom_ray_path_create(pointer: number): number;
  geom_ray_cast(handle: number, query: number, bundle: number, output: number): number;
  geom_path_free(handle: number): void;
  geom_nearest_batch(handle: number, queries: number, output: number): number;
  geom_near_pairs(handle: number, weld: number, output: number): number;
  geom_cubic_roots_batch(input: number, output: number): number;
  geom_offset_error(query: number, fitted: number, output: number): number;
  geom_buffer_bytes(): number;
  geom_path_count(): number;
  geom_curve_count(): number;
};
