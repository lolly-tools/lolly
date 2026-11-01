// SPDX-License-Identifier: MPL-2.0
import { createInddKernel, type InddKernel } from '@lolly-tools/node-shell/indd';

let pending: Promise<InddKernel> | undefined;
/** The shared INDD converter. The WASM file is fetched on first use only. A crashed instance is replaced on the next call. */
export async function loadInddKernel(): Promise<InddKernel> {
  if (pending) {
    const kernel = await pending.catch(() => undefined);
    if (kernel && !kernel.dead) return kernel;
    pending = undefined;
  }
  pending ??= (async () => {
    const response = await fetch(new URL('../../../../packages/node-shell/wasm/indd/indd.wasm', import.meta.url));
    if (!response.ok) throw new Error('The InDesign converter could not be loaded.');
    return createInddKernel(new Uint8Array(await response.arrayBuffer()));
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}
