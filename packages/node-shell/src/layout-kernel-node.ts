// SPDX-License-Identifier: MPL-2.0
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLayoutKernel } from './layout-kernel.ts';

export async function loadLayoutKernel() {
  const adjacent = fileURLToPath(new URL('../wasm/layout-kernel/layout-kernel.wasm', import.meta.url));
  if (existsSync(adjacent)) return createLayoutKernel(new Uint8Array(await readFile(adjacent)));
  // Bundled functions retain the package's WASM files under their content root.
  for (let dir = dirname(adjacent); ; dir = dirname(dir)) {
    const candidate = join(dir, 'packages/node-shell/wasm/layout-kernel/layout-kernel.wasm');
    if (existsSync(candidate)) return createLayoutKernel(new Uint8Array(await readFile(candidate)));
    if (dirname(dir) === dir) break;
  }
  throw new Error('The layout kernel is not installed.');
}
