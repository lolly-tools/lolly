// SPDX-License-Identifier: MPL-2.0
import { createDxfKernel, type DxfKernel } from '@lolly-tools/node-shell/dxf';

let pending: Promise<DxfKernel> | undefined;
/**
 * Fetch and start the DXF reader the first time a DXF file is imported. A crashed instance is
 * replaced on the next call. The reader runs on the main thread: the file is capped at 32 MB
 * and the module reads about that much in well under a second.
 */
export async function loadDxfKernel(): Promise<DxfKernel> {
  if (pending) {
    const kernel = await pending.catch(() => undefined);
    if (!kernel || kernel.dead) pending = undefined;
  }
  pending ??= (async () => {
    const response = await fetch(new URL('../../../../packages/node-shell/wasm/dxf/dxf.wasm', import.meta.url));
    if (!response.ok) throw new Error('The DXF reader could not be loaded.');
    return createDxfKernel(new Uint8Array(await response.arrayBuffer()));
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}
