// SPDX-License-Identifier: MPL-2.0
import { createPsdKernel, type PsdKernel } from '@lolly-tools/node-shell/adobe-psd';
import { readPsd, PsdUnsupportedError, type PsdReadOptions } from '../../../../engine/src/psd.ts';

let pending: Promise<PsdKernel> | undefined;
export function loadPsdKernel(): Promise<PsdKernel> {
  pending ??= (async () => {
    const response = await fetch(new URL('../../../../packages/node-shell/wasm/adobe-psd/adobe-psd.wasm', import.meta.url));
    if (!response.ok) throw new Error('The portable Photoshop reader could not be loaded.');
    return createPsdKernel(new Uint8Array(await response.arrayBuffer()));
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}
export async function readPsdPortable(bytes: Uint8Array, options: PsdReadOptions = {}) {
  try { return readPsd(bytes, options); }
  catch (error) {
    if (!(error instanceof PsdUnsupportedError) || !['depth', 'color-mode'].includes(error.code)) throw error;
    return (await loadPsdKernel()).read(bytes, options);
  }
}
