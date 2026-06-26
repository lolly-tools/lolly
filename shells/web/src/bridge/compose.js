/**
 * Web implementation of the `compose` capability — render another tool to an
 * embeddable AssetRef (tool composition / "nested exports").
 *
 * Reuses the off-screen render recipe in pro/render-export.js (loadTool →
 * createRuntime → detached stage → runtime.export): the child is rendered exactly
 * like a batch row, but watermark/provenance are suppressed because the result is
 * an intermediate asset, not the deliverable. The Blob is wrapped in an object URL
 * and returned as an AssetRef, so the runtime can expose it via `{{asset <id>}}`
 * and every existing export seam (blob→data, SVG-inline-as-vector) handles it.
 *
 * Recursion guards (the engine has none): reject a cycle (the tool is already on
 * the stack) or a render deeper than MAX_COMPOSE_DEPTH. An LRU of rendered results
 * keyed by tool+inputs+format+size makes the per-keystroke preview re-render free
 * and bounds object-URL memory (oldest URL revoked on eviction).
 */

import { renderRowToBlob } from '../pro/render-export.js';

const MAX_COMPOSE_DEPTH = 3;
const CACHE_CAP = 40;

export function createComposeAPI(host) {
  // Module-scoped per-bridge cache: key → { assetRef, blobUrl }. Insertion order
  // is LRU order; a hit is re-inserted to mark it most-recently-used.
  const cache = new Map();

  async function render(spec) {
    const { toolId, inputs = {}, format, width, height, dpi, _stack = [] } = spec ?? {};
    if (typeof toolId !== 'string' || !toolId) throw new Error('compose: missing toolId');

    const path = [..._stack, toolId];
    if (_stack.includes(toolId)) throw new Error(`cycle ${path.join(' → ')}`);
    if (_stack.length >= MAX_COMPOSE_DEPTH) throw new Error(`max depth ${MAX_COMPOSE_DEPTH} (${path.join(' → ')})`);

    const key = cacheKey(toolId, inputs, format, width, height, dpi);
    const hit = cache.get(key);
    if (hit) { cache.delete(key); cache.set(key, hit); return hit.assetRef; } // LRU bump

    const { blob, format: fmt } = await renderRowToBlob(
      { toolId, values: inputs },
      host,
      { format, width, height, dpi, composeStack: path, watermark: false, embedMeta: false, thumbnail: true },
    );

    const url = URL.createObjectURL(blob);
    const assetRef = {
      source: 'remote',
      id: `compose:${toolId}`,
      type: fmt === 'svg' ? 'vector' : 'raster',
      format: fmt,
      url,
      meta: { compose: toolId },
    };

    cache.set(key, { assetRef, blobUrl: url });
    if (cache.size > CACHE_CAP) {
      const oldestKey = cache.keys().next().value;
      const old = cache.get(oldestKey);
      cache.delete(oldestKey);
      try { URL.revokeObjectURL(old.blobUrl); } catch { /* already gone */ }
    }
    return assetRef;
  }

  return {
    render,
    /** Revoke every cached object URL. Call on full teardown to avoid leaks. */
    _dispose() {
      for (const { blobUrl } of cache.values()) { try { URL.revokeObjectURL(blobUrl); } catch {} }
      cache.clear();
    },
  };
}

function cacheKey(toolId, inputs, format, width, height, dpi) {
  return `${toolId}|${stableStringify(inputs)}|${format ?? ''}|${width ?? ''}x${height ?? ''}@${dpi ?? ''}`;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort()
    .map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(',')}}`;
}
