// SPDX-License-Identifier: MPL-2.0
import { resizedDimensions, encodeToTargetBytes, type ImageConversionOptions } from '@lolly-tools/core/image-operation-v1';
const workerScope = globalThis as unknown as { onmessage: ((event: MessageEvent<{ file: Blob; mime: string; options: ImageConversionOptions }>) => void) | null; postMessage(value: unknown): void };
workerScope.onmessage = async ({ data }) => {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(data.file);
    const size = resizedDimensions(bitmap.width, bitmap.height, data.options.maxEdge);
    const canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Background image encoding is unavailable.');
    ctx.imageSmoothingQuality = 'high';
    if (data.mime === 'image/jpeg') { ctx.fillStyle = data.options.background; ctx.fillRect(0, 0, size.width, size.height); }
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await encodeToTargetBytes(async quality => {
      const encoded = await canvas.convertToBlob({ type: data.mime, quality });
      if (encoded.type !== data.mime) throw new Error(`This browser can’t encode ${data.mime.replace('image/', '').toUpperCase()}.`);
      return encoded;
    }, data.options);
    workerScope.postMessage({ blob });
  } catch (error) { workerScope.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
  finally { bitmap?.close(); }
};
