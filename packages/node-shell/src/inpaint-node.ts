// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from './repo-root.ts';
import { createInpaintKernel, type InpaintKernel } from './inpaint.ts';

let pending: Promise<InpaintKernel> | undefined;
/** Load the inpainting module once per process. */
export function loadInpaintKernel(): Promise<InpaintKernel> {
  pending ??= readFile(new URL('../wasm/inpaint/inpaint.wasm', import.meta.url))
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return readFile(join(repoRoot(), 'packages/node-shell/wasm/inpaint/inpaint.wasm'));
    })
    .then(bytes => createInpaintKernel(new Uint8Array(bytes)))
    .catch(error => { pending = undefined; throw error; });
  return pending;
}
