// SPDX-License-Identifier: MPL-2.0
import { forensicRasterCards } from '../../../../engine/src/forensic.ts';
globalThis.onmessage = (
  event: MessageEvent<{ data: Uint8ClampedArray; width: number; height: number }>
): void => {
  try {
    postMessage({
      shapes: forensicRasterCards(event.data.data, event.data.width, event.data.height),
    });
  } catch (error) {
    postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
