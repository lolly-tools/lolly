// SPDX-License-Identifier: MPL-2.0
/**
 * A thumbnail render's smaller picture copies, made off the page's main thread
 * (bridge/thumb-downscale.ts): decode at the smaller size with createImageBitmap,
 * draw on an OffscreenCanvas, encode as the main-thread path does and answer with a
 * data URL. Nothing here touches the document.
 */
import type { ThumbDownscaleReply, ThumbDownscaleRequest } from './thumb-downscale-protocol.ts';

/** The same rule as thumbOutputType in bridge/thumb-downscale.ts (a worker entry keeps
 *  its imports to the protocol, so the page module is not loaded here). */
const outputType = (type: string): string => (type === 'image/jpeg' ? 'image/jpeg' : 'image/png');

/** Present in every dedicated worker, though missing from the page's type library. */
declare const FileReaderSync: { new(): { readAsDataURL(blob: Blob): string } };

function reply(message: ThumbDownscaleReply): void {
  self.postMessage(message);
}

// Only the worker entry answers, in case a bundler shares this chunk with the page.
if (typeof document === 'undefined') self.addEventListener('message', async (event: MessageEvent<ThumbDownscaleRequest>) => {
  const { id, blob, width, height } = event.data;
  try {
    const bitmap = await createImageBitmap(blob, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close();
    const encoded = await canvas.convertToBlob({ type: outputType(blob.type), quality: 0.9 });
    reply({ id, ok: true, dataUrl: new FileReaderSync().readAsDataURL(encoded) });
  } catch (error) {
    reply({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
