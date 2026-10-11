// SPDX-License-Identifier: MPL-2.0
import manifest from '../../models-manifest.json' with { type: 'json' };
import { MODELS_BASE } from './models-base.ts';
import { downloadVerifiedModel, modelPartialCache, verifyModelBytes, type ModelFileIdentity } from './model-delivery.ts';

const files = manifest as Array<Partial<ModelFileIdentity> & { url: string; size: number }>;
/** The legacy URL is an identity/cache alias. Fetches use real hashed directories. */
export function modelFile(url: string): ModelFileIdentity | undefined {
  let path: string;
  try { path = url.startsWith('/') ? url : new URL(url).pathname; } catch { return undefined; }
  const file = files.find(f => f.url === path || f.immutableUrl === path);
  if (!file?.sha256 || !/^[a-f0-9]{64}$/.test(file.sha256) || !file.immutableUrl || !file.directorySha256 || !/^[a-f0-9]{64}$/.test(file.directorySha256)) return undefined;
  const family = /^\/models\/([a-z0-9-]+)\//.exec(file.url)?.[1];
  if (!family || file.immutableUrl !== file.url.replace(`/models/${family}/`, `/models/${family}@${file.directorySha256.slice(0, 16)}/`)) throw new Error('Invalid model directory mapping.');
  return file as ModelFileIdentity;
}
export function modelNetworkUrl(url: string): string {
  const target = modelFile(url)?.immutableUrl ?? url;
  return target.startsWith('/models/') ? MODELS_BASE + target : target;
}
export function modelCacheUrl(url: string): string {
  const target = modelFile(url)?.immutableUrl ?? url;
  return target.startsWith('/models/') ? MODELS_BASE + target : target;
}
export function legacyModelCacheUrl(url: string): string {
  const target = modelFile(url)?.url ?? url;
  return target.startsWith('/models/') ? MODELS_BASE + target : target;
}
/** Storage meters and installed-file rosters keep their conventional filenames. */
export const modelStoredFileName = (key: string): string => key.replace(/^\/models\/[a-z0-9-]+@[a-f0-9]{16}\//, '');
/** Old immutable versions remain stored, but are not installed for this release. */
export function currentModelStoredFileName(key: string): string | undefined {
  if (/^\/models\/[^/]+@/.test(key) && !modelFile(key)) return undefined;
  return modelStoredFileName(key);
}
/** Preserve transformers.js's conventional nested model ID and relative files. */
export function modelDirectoryId(id: string): string {
  const prefix = `/models/${id}/`;
  const mapped = files.find(file => file.url.startsWith(prefix) && modelFile(file.url));
  if (!mapped) return id;
  // The resolver refuses HTTP IDs when remote models are disabled. Its fetch
  // adapter maps this absolute local path to the configured delivery host.
  return mapped.immutableUrl!.slice(0, -(mapped.url.length - prefix.length) - 1);
}
/** Voice matrices share the same verified transport as model weights. */
export async function cachedModelResponse(url: string, bucket: string): Promise<Response> {
  const file = modelFile(url), key = modelCacheUrl(url);
  let cache: Cache | undefined;
  try {
    cache = await caches.open(bucket); const held = await cache.match(key);
    if (held && (!file || await verifyModelBytes(await held.clone().arrayBuffer(), file))) return held;
    if (held) await cache.delete(key);
    if (file) {
      const legacy = await cache.match(legacyModelCacheUrl(url));
      if (legacy && await verifyModelBytes(await legacy.clone().arrayBuffer(), file)) return legacy;
    }
  } catch { /* private browser modes may have no cache */ }
  if (!file) return fetch(url);
  const result = await downloadVerifiedModel(file, modelNetworkUrl(url), { partialCache: await modelPartialCache() });
  const headers = new Headers(result.headers); for (const name of ['content-encoding', 'content-range', 'transfer-encoding']) headers.delete(name);
  headers.set('content-length', String(result.bytes.byteLength));
  const response = new Response(result.bytes, { headers });
  await cache?.put(key, response.clone()).catch(() => {});
  return response;
}
/** Browser cache reads and network downloads verify bytes; new keys are immutable.
 * Legacy request keys may be reused only after matching this release's digest. */
export function configureTransformerDelivery(env: { fetch: (input: string | URL, init?: RequestInit) => Promise<Response>; useCustomCache: boolean; customCache: unknown; useBrowserCache: boolean }): void {
  const nativeFetch = env.fetch.bind(globalThis);
  env.fetch = async (input, init) => {
    const url = String(input);
    const file = modelFile(url);
    if (!file) return nativeFetch(input, init);
    const result = await downloadVerifiedModel(file, modelNetworkUrl(url), { signal: init?.signal ?? undefined, partialCache: await modelPartialCache(), fetcher: (input, init) => nativeFetch(input instanceof Request ? input.url : input, init) });
    const headers = new Headers(result.headers); for (const name of ['content-encoding', 'content-range', 'transfer-encoding']) headers.delete(name);
    headers.set('content-length', String(result.bytes.byteLength));
    return new Response(result.bytes, { headers });
  };
  env.useBrowserCache = false; env.useCustomCache = true;
  env.customCache = {
    async match(url: string): Promise<Response | undefined> {
      try {
        const cache = await caches.open('transformers-cache'), key = modelCacheUrl(url), held = await cache.match(key);
        const file = modelFile(url);
        if (!file) return url.includes('/ort-hf/') ? held : undefined;
        if (held && await verifyModelBytes(await held.clone().arrayBuffer(), file)) return held;
        if (held) await cache.delete(key);
        const legacy = await cache.match(legacyModelCacheUrl(url));
        return legacy && await verifyModelBytes(await legacy.clone().arrayBuffer(), file) ? legacy : undefined;
      } catch { return undefined; }
    },
    async put(url: string, response: Response): Promise<void> {
      const file = modelFile(url);
      if (file && !await verifyModelBytes(await response.clone().arrayBuffer(), file)) throw new Error('Model cache integrity verification failed.');
      try { await (await caches.open('transformers-cache')).put(modelCacheUrl(url), response); } catch { /* storage unavailable; verified network bytes still work */ }
    },
  };
}
