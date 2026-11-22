// SPDX-License-Identifier: MPL-2.0
/**
 * The preview writer's raster rule (lib/preview-writer.ts `rasterPicture`) off the
 * page's main thread: decode with createImageBitmap, draw on an OffscreenCanvas,
 * encode, decode the result again and compare it with the source. The page posts a
 * render and waits; nothing here touches the document.
 */
import { rasterPicture } from './preview-writer.ts';
import type { PreviewEncodeReply, PreviewEncodeRequest } from './preview-encode-protocol.ts';

function reply(message: PreviewEncodeReply, transfer: Transferable[] = []): void {
  self.postMessage(message, { transfer });
}

// Only the worker entry answers, in case a bundler shares this chunk with the page.
if (typeof document === 'undefined') self.addEventListener('message', async (event: MessageEvent<PreviewEncodeRequest>) => {
  const { data } = event;
  try {
    const picture = await rasterPicture(data.source, data.facts);
    if ('close' in data.source && typeof data.source.close === 'function') data.source.close();
    if (!picture) { reply({ id: data.id, ok: true, picture: null }); return; }
    const bytes = picture.bytes.byteOffset === 0 && picture.bytes.byteLength === picture.bytes.buffer.byteLength ? picture.bytes : picture.bytes.slice();
    reply({ id: data.id, ok: true, picture: { ref: picture.ref, bytes, ...(picture.verdict ? { verdict: picture.verdict } : {}) } }, [bytes.buffer as ArrayBuffer]);
  } catch (error) {
    reply({ id: data.id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
