// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from './repo-root.ts';
import { createCameraRawKernel, type CameraRawKernel } from './camera-raw.ts';

let pending: Promise<CameraRawKernel> | undefined;
/** The shared decoder. A crashed instance is replaced on the next call. */
export async function loadCameraRawKernel(): Promise<CameraRawKernel> {
  if (pending) {
    const kernel = await pending.catch(() => undefined);
    if (kernel && !kernel.dead) return kernel;
    pending = undefined;
  }
  pending ??= readFile(new URL('../wasm/camera-raw/camera-raw.wasm', import.meta.url))
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return readFile(join(repoRoot(), 'packages/node-shell/wasm/camera-raw/camera-raw.wasm'));
    })
    .then(bytes => createCameraRawKernel(new Uint8Array(bytes)))
    .catch(error => { pending = undefined; throw error; });
  return pending;
}
