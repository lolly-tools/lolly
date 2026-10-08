// SPDX-License-Identifier: MPL-2.0
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';
import { repoRoot } from './repo-root.ts';
import { createPsdKernel, type PsdKernel } from './adobe-psd.ts';
import { readPsd, PsdUnsupportedError, type PsdReadOptions } from '../../../engine/src/psd.ts';

let pending: Promise<PsdKernel> | undefined;
export function loadPsdKernel(): Promise<PsdKernel> {
  pending ??= readFile(new URL('../wasm/adobe-psd/adobe-psd.wasm', import.meta.url))
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return readFile(join(repoRoot(), 'packages/node-shell/wasm/adobe-psd/adobe-psd.wasm'));
    })
    .then(bytes => createPsdKernel(new Uint8Array(bytes)))
    .catch(error => { pending = undefined; throw error; });
  return pending;
}
export async function readPsdPortable(bytes: Uint8Array, options: PsdReadOptions = {}) {
  try { return readPsd(bytes, { inflate: (b, maxOut) => new Uint8Array(inflateSync(b, { maxOutputLength: maxOut })), ...options }); }
  catch (error) {
    if (!(error instanceof PsdUnsupportedError) || !['depth', 'color-mode'].includes(error.code)) throw error;
    return (await loadPsdKernel()).read(bytes, options);
  }
}
