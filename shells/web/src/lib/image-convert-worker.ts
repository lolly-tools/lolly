// SPDX-License-Identifier: MPL-2.0
import type { ImageConversionOptions } from '@lolly-tools/core/image-operation-v1';
/** One operation owns one worker. Abort actually terminates the decoder/encoder. */
export function convertImageInWorker(file: Blob, mime: string, options: ImageConversionOptions, signal?: AbortSignal): Promise<Blob> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./image-convert.worker.ts', import.meta.url), { type: 'module' });
    const finish = (error?: unknown, blob?: Blob): void => { clearTimeout(timer); signal?.removeEventListener('abort', abort); worker.terminate(); error ? reject(error) : resolve(blob!); };
    const abort = (): void => finish(signal?.reason ?? new DOMException('Conversion cancelled.', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('Image conversion exceeded its two-minute budget.')), 120_000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = event => finish(new Error(event.message));
    worker.onmessage = ({ data }: MessageEvent<{ blob?: Blob; error?: string }>) => data.error ? finish(new Error(data.error)) : data.blob ? finish(undefined, data.blob) : finish(new Error('No encoded image was returned.'));
    worker.postMessage({ file, mime, options });
  });
}
