// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import { createGeometryKernel } from './geometry-kernel.ts';

export async function loadGeometryKernel() {
  const bytes = await readFile(
    new URL('../wasm/geometry-kernel/geometry-kernel.wasm', import.meta.url)
  );
  return createGeometryKernel(new Uint8Array(bytes));
}
