// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from './repo-root.ts';
import { createDxfKernel, type DxfKernel } from './dxf.ts';

let pending: Promise<DxfKernel> | undefined;
/** The shared reader. A crashed instance is replaced on the next call. */
export async function loadDxfKernel(): Promise<DxfKernel> {
  if (pending) {
    const kernel = await pending.catch(() => undefined);
    if (kernel && !kernel.dead) return kernel;
    pending = undefined;
  }
  pending ??= readFile(new URL('../wasm/dxf/dxf.wasm', import.meta.url))
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return readFile(join(repoRoot(), 'packages/node-shell/wasm/dxf/dxf.wasm'));
    })
    .then(bytes => createDxfKernel(new Uint8Array(bytes)))
    .catch(error => { pending = undefined; throw error; });
  return pending;
}
