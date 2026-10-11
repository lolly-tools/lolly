// SPDX-License-Identifier: MPL-2.0
/** Decoded-byte verification and strong-validator range resume for model files. */
export interface ModelFileIdentity { url: string; size: number; sha256: string; immutableUrl?: string; directorySha256?: string }
export interface ModelDownloadProgress { loaded: number; total: number | null }
export const MODEL_PARTIAL_CACHE = 'lolly-model-downloads';
export async function verifyModelBytes(bytes: ArrayBuffer, file: Pick<ModelFileIdentity, 'size' | 'sha256'>): Promise<boolean> {
  if (bytes.byteLength !== file.size || !/^[a-f0-9]{64}$/.test(file.sha256)) return false;
  if (!globalThis.crypto?.subtle) throw new Error('Model integrity needs WebCrypto.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('') === file.sha256;
}
const strongTag = (tag: string | null): tag is string => !!tag && /^"[^"\r\n]+"$/.test(tag);
export async function modelPartialCache(): Promise<Cache | undefined> {
  try { return typeof caches === 'undefined' ? undefined : await caches.open(MODEL_PARTIAL_CACHE); } catch { return undefined; }
}
/** Complete bytes are published only after their size and full sha256 match.
 * Interrupted identity transfers retain a prefix only with a strong ETag. */
export async function downloadVerifiedModel(file: ModelFileIdentity, fetchUrl: string, opts: {
  signal?: AbortSignal; onProgress?: (p: ModelDownloadProgress) => void; partialCache?: Cache;
  fetcher?: typeof fetch;
} = {}): Promise<{ bytes: ArrayBuffer; headers: Headers }> {
  const { signal, onProgress, partialCache } = opts;
  const fetcher = opts.fetcher ?? fetch;
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid model integrity metadata.');
  const partialKey = fetchUrl;
  let prefix = new Uint8Array(0), tag: string | undefined;
  const held = await partialCache?.match(partialKey);
  if (held && held.headers.get('x-lolly-model-sha256') === file.sha256 && strongTag(held.headers.get('etag'))) {
    const body = new Uint8Array(await held.arrayBuffer());
    if (body.length > 0 && body.length < file.size) { prefix = body; tag = held.headers.get('etag')!; }
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    signal?.throwIfAborted();
    const headers: Record<string, string> = {};
    if (prefix.length && tag) { headers.range = `bytes=${prefix.length}-`; headers['if-range'] = tag; }
    const response = await fetcher(fetchUrl, { headers, signal, cache: 'no-cache' });
    if (response.status === 416 && prefix.length) { prefix = new Uint8Array(0); tag = undefined; await partialCache?.delete(partialKey); continue; }
    if (!response.ok || (response.headers.get('content-type') ?? '').includes('text/html')) throw new Error(`Model download failed (${response.status}).`);
    if (response.status === 206) {
      const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') ?? '');
      if (!prefix.length || !range || Number(range[1]) !== prefix.length || Number(range[3]) !== file.size || Number(range[2]) !== file.size - 1 || response.headers.get('etag') !== tag || response.headers.has('content-encoding')) {
        await partialCache?.delete(partialKey); throw new Error('Invalid model range response.');
      }
    } else { prefix = new Uint8Array(0); tag = undefined; }
    const chunks: Uint8Array[] = prefix.length ? [prefix] : [];
    let loaded = prefix.length;
    const entityTag = response.headers.get('etag');
    const resumable = strongTag(entityTag) && !response.headers.has('content-encoding');
    const join = (): ArrayBuffer => {
      const result = new Uint8Array(loaded); let offset = 0;
      for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
      return result.buffer;
    };
    try {
      const reader = response.body?.getReader();
      if (reader) for (;;) {
        const item = await reader.read(); if (item.done) break;
        if (item.value?.length) { chunks.push(item.value); loaded += item.value.length; }
        if (loaded > file.size) { await reader.cancel(); throw new Error('Model exceeds its declared size.'); }
        onProgress?.({ loaded, total: file.size }); signal?.throwIfAborted();
      }
      else { const bytes = new Uint8Array(await response.arrayBuffer()); chunks.push(bytes); loaded += bytes.length; }
      const bytes = join();
      if (await verifyModelBytes(bytes, file)) { await partialCache?.delete(partialKey); signal?.throwIfAborted(); return { bytes, headers: response.headers }; }
      await partialCache?.delete(partialKey);
      if (prefix.length && attempt === 0) { prefix = new Uint8Array(0); tag = undefined; continue; }
      throw new Error('Model integrity verification failed.');
    } catch (error) {
      if (resumable && loaded > 0 && loaded < file.size) {
        await partialCache?.put(partialKey, new Response(join(), { headers: { etag: entityTag, 'x-lolly-model-sha256': file.sha256 } })).catch(() => {});
      } else await partialCache?.delete(partialKey).catch(() => {});
      throw error;
    }
  }
  throw new Error('Model resume could not be completed.');
}
