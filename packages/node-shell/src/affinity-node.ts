// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from './repo-root.ts';
import { createAffinityKernel, type AffinityKernel } from './affinity.ts';

let pending: Promise<AffinityKernel> | undefined;
/** The shared Affinity reader. A crashed instance is replaced on the next call. */
export async function loadAffinityKernel(): Promise<AffinityKernel> {
  if (pending) {
    const kernel = await pending.catch(() => undefined);
    if (kernel && !kernel.dead) return kernel;
    pending = undefined;
  }
  pending ??= readFile(new URL('../wasm/affinity/affinity.wasm', import.meta.url))
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return readFile(join(repoRoot(), 'packages/node-shell/wasm/affinity/affinity.wasm'));
    })
    .then(bytes => createAffinityKernel(new Uint8Array(bytes)))
    .catch(error => { pending = undefined; throw error; });
  return pending;
}
