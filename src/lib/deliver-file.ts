// SPDX-License-Identifier: MPL-2.0
/**
 * Deliver a prepared file through the host and learn what happened (plans/236).
 *
 * `HostV1.export.download` resolves to void, and that contract is not this slice's
 * to change. What the web shell needs on top of it is one bit the bridge already
 * knows: whether the file went through a save dialog whose write CLOSED, or through
 * an anchor click that can prove nothing. The web export bridge records that as it
 * delivers (bridge/export-save-picker.ts), and this adapter reads it back after the
 * same call - so every caller still routes through `host.export.download`, which is
 * the verb the Tauri shells override with a real filesystem save.
 *
 * On those shells nothing is recorded, because their override never touches the
 * web module: a resolved download there means the native write already completed
 * (bridge-overrides/export.ts awaits `writeFile`), which is exactly the standard
 * "Saved" asks for. A dismissed native Save As throws AbortError, and that is a
 * cancellation, not a failure.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { saveFilePickerSupported, saveFileWithPicker, takeDeliveryOutcome } from '../bridge/export-save-picker.ts';
import type { DeliveryOutcome } from '../bridge/export-save-picker.ts';

export type DeliveryHost = Pick<HostV1, 'export'>;

/** A prepared file → an outcome the browser or shell could actually vouch for. */
export type Deliver = (blob: Blob, filename: string) => Promise<DeliveryOutcome>;

/**
 * The desktop shell's one-shot seam: arm it and the NEXT `host.export.download`
 * goes through the native Save As dialog (bridge-overrides/export.ts), which
 * writes the file before resolving and throws AbortError when dismissed. The same
 * object views/export-package-options.ts reads; duplicated here (a window read)
 * so lib/ does not import a view.
 */
interface NativeSaveAsSeam { requestSaveAs(): void; cancelSaveAs(): void }

function nativeSaveAsSeam(): NativeSaveAsSeam | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { __LOLLY_DESKTOP_EXPORT__?: NativeSaveAsSeam }).__LOLLY_DESKTOP_EXPORT__;
}

/**
 * The best available "choose where this file lands" path, or null when there is
 * none to offer. The browser picker first (it needs no host and confirms its own
 * write); otherwise the desktop shell's native dialog through the host. A surface
 * offers a Save control only when this is non-null, so it never renders a dialog
 * this environment cannot open.
 */
export function chooseLocationDeliver(host: DeliveryHost | null): Deliver | null {
  if (saveFilePickerSupported()) return (blob, filename) => saveFileWithPicker(blob, filename);
  const seam = nativeSaveAsSeam();
  if (seam && host) {
    return async (blob, filename) => {
      seam.requestSaveAs();
      try {
        return await deliverFile(host, blob, filename);
      } finally {
        seam.cancelSaveAs(); // one delivery only; never let the arm leak into a later plain download
      }
    };
  }
  return null;
}

export async function deliverFile(host: DeliveryHost, blob: Blob, filename: string): Promise<DeliveryOutcome> {
  takeDeliveryOutcome(); // never read a stale record from an earlier, unrelated delivery
  try {
    await host.export.download(blob, filename);
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return 'cancelled';
    throw err;
  }
  return takeDeliveryOutcome() ?? 'saved';
}
