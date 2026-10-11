// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import { createLayoutKernel } from './layout-kernel.ts';

export async function loadLayoutKernel() {
  const bytes = await readFile(
    new URL('../wasm/layout-kernel/layout-kernel.wasm', import.meta.url)
  );
  return createLayoutKernel(new Uint8Array(bytes));
}
