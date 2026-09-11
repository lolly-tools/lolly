// SPDX-License-Identifier: MPL-2.0
import { consumeSaveAsNext } from './export-save-picker.ts';
import type { DeliveryOutcome } from './export-save-picker.ts';

type Download = (blob: Blob, filename: string) => Promise<void>;
type Deliver = (blob: Blob, filename: string) => Promise<DeliveryOutcome>;

// Associate outcomes with the bridge function, not a global last-result slot.
// Concurrent exports cannot steal each other's outcome. Native overrides replace
// the function and therefore continue through their own delivery implementation.
const deliveries = new WeakMap<Download, Deliver>();

export function createDownload(request: (blob: Blob, filename: string) => void): Download {
  const deliver: Deliver = async (blob, filename) => {
    const picked = await consumeSaveAsNext(blob, filename);
    if (picked !== null) return picked;
    request(blob, filename);
    return 'requested';
  };
  const download: Download = async (blob, filename) => { await deliver(blob, filename); };
  deliveries.set(download, deliver);
  return download;
}

export function deliveryFor(download: Download): Deliver | undefined {
  return deliveries.get(download);
}

/** Preserve delivery evidence through the bridge's lazy export facade. */
export function deferredDownload(load: () => Promise<Download>): Download {
  const deliver: Deliver = async (blob, filename) => {
    const implementation = await load();
    const known = deliveryFor(implementation);
    if (known) return known(blob, filename);
    await implementation(blob, filename);
    return 'requested';
  };
  const download: Download = async (blob, filename) => { await deliver(blob, filename); };
  deliveries.set(download, deliver);
  return download;
}
