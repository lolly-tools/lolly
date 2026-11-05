// SPDX-License-Identifier: MPL-2.0
import { createInpaintKernel, type InpaintKernel } from '@lolly-tools/node-shell/inpaint';

let pending: Promise<InpaintKernel> | undefined;
/** Fetch and start the PatchMatch module the first time a large area is filled. */
export function loadInpaintKernel(): Promise<InpaintKernel> {
  pending ??= (async () => {
    const response = await fetch(new URL('../../../../packages/node-shell/wasm/inpaint/inpaint.wasm', import.meta.url));
    if (!response.ok) throw new Error('The large-area fill module could not be loaded.');
    return createInpaintKernel(new Uint8Array(await response.arrayBuffer()));
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}
