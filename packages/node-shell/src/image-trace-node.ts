// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from './repo-root.ts';
import { createImageTraceKernel, type ImageTraceKernel } from './image-trace.ts';

let pending: Promise<ImageTraceKernel> | undefined;
/** Load the image trace module once per process. */
export function loadImageTraceKernel(): Promise<ImageTraceKernel> {
  pending ??= readFile(new URL('../wasm/image-trace/image-trace.wasm', import.meta.url))
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return readFile(join(repoRoot(), 'packages/node-shell/wasm/image-trace/image-trace.wasm'));
    })
    .then(bytes => createImageTraceKernel(new Uint8Array(bytes)))
    .catch(error => { pending = undefined; throw error; });
  return pending;
}
