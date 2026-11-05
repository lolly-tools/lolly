// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from './repo-root.ts';
import { createInddKernel, type InddKernel } from './indd.ts';

let pending: Promise<InddKernel> | undefined;
/** The shared converter. A crashed instance is replaced on the next call. */
export async function loadInddKernel(): Promise<InddKernel> {
  if (pending) {
    const kernel = await pending.catch(() => undefined);
    if (kernel && !kernel.dead) return kernel;
    pending = undefined;
  }
  pending ??= readFile(new URL('../wasm/indd/indd.wasm', import.meta.url))
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return readFile(join(repoRoot(), 'packages/node-shell/wasm/indd/indd.wasm'));
    })
    .then(bytes => createInddKernel(new Uint8Array(bytes)))
    .catch(error => { pending = undefined; throw error; });
  return pending;
}
