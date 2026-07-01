// SPDX-License-Identifier: MPL-2.0
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

import { parseToolUrl, buildEmbedUrl, parseUrlState, expandQuery, RESERVED } from '@lolly/engine';
import { renderRowToBlob } from '../pro/render-export.js';
import { getTool } from './tool-loader.js';

const MAX_COMPOSE_DEPTH = 3;

// Child render formats that make sense as an image dropped into a picker slot.
// (Compose itself can also produce pdf, but a picker is choosing an *image*.)
const IMAGE_FORMATS = ['svg', 'png', 'jpg', 'webp'];
const normFmt = (f) => { const x = String(f || '').toLowerCase(); return x === 'jpeg' ? 'jpg' : x; };
// Comfortably above the manifest `composes` maxItems (24) so one tool's composes
// can never self-evict (and revoke a still-displayed blob) within a single render.
const CACHE_CAP = 64;

export function createComposeAPI(host) {
  // Module-scoped per-bridge cache: key → { assetRef, blobUrl }. Insertion order
  // is LRU order; a hit is re-inserted to mark it most-recently-used.
  const cache = new Map();

  async function render(spec) {
    const { toolId, inputs = {}, format, width, height, unit, dpi, _stack = [] } = spec ?? {};
    if (typeof toolId !== 'string' || !toolId) throw new Error('compose: missing toolId');

    const path = [..._stack, toolId];
    if (_stack.includes(toolId)) throw new Error(`cycle ${path.join(' → ')}`);
    if (_stack.length >= MAX_COMPOSE_DEPTH) throw new Error(`max depth ${MAX_COMPOSE_DEPTH} (${path.join(' → ')})`);

    const key = cacheKey(toolId, inputs, format, width, height, unit, dpi);
    const hit = cache.get(key);
    if (hit) { cache.delete(key); cache.set(key, hit); return hit.assetRef; } // LRU bump

    // Thread the ANCESTOR stack (_stack), not `path`: the child's own runtime
    // re-appends its id in resolveNestedRenders, so passing `path` (which already
    // ends with toolId) would double-count and trip the depth guard a level early.
    const { blob, format: fmt } = await renderRowToBlob(
      { toolId, values: inputs },
      host,
      { format, width, height, unit, dpi, composeStack: _stack, watermark: false, embedMeta: false, thumbnail: true },
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

  // Resolve a tool URL to the child's manifest + parsed state. Shared by
  // describeUrl (UI metadata) and renderUrl (the actual render). Returns null for
  // a non-tool URL or an id with no matching local tool.
  async function resolveSpec(url) {
    const parsed = parseToolUrl(url);
    if (!parsed) return null;
    let tool;
    try { tool = await getTool(parsed.toolId); } catch { return null; } // unknown id → 404 → null
    // A pasted link may carry packed state (`?z=…`); expand before parsing. Return the
    // EXPANDED query too — renderUrl mints the persistent embed id from it, not from the
    // still-packed parsed.query (whose only param would be the reserved `z`, which gets
    // stripped, yielding a stateless id that re-renders as defaults on reload).
    const query = await expandQuery(parsed.query);
    return { parsed, tool, query, state: parseUrlState(query, tool.manifest) };
  }

  // Describe a pasted tool URL for the picker UI (the "✦ Detected: <tool>" card):
  // the tool's name, the image formats it supports, and the size/format implied by
  // the link. No render — cheap enough to call as the user types. Null when the URL
  // isn't a renderable local tool, so the picker falls back to a plain search.
  async function describeUrl(url) {
    const r = await resolveSpec(url);
    if (!r) return null;
    const supported = (r.tool.manifest.render?.formats ?? []).map(normFmt);
    const formats = IMAGE_FORMATS.filter(f => supported.includes(f));
    const pick = formats.length ? formats : ['svg'];
    const def = (r.parsed.format && pick.includes(normFmt(r.parsed.format)))
      ? normFmt(r.parsed.format)
      : (pick.includes('svg') ? 'svg' : pick[0]);
    return {
      toolId: r.parsed.toolId,
      name: r.tool.manifest.name ?? r.parsed.toolId,
      formats: pick,
      format: def,
      width: r.state.width ?? null,
      height: r.state.height ?? null,
      unit: r.state.unit ?? null,
      dpi: r.state.dpi ?? null,
    };
  }

  // Render a pasted tool URL to a usable AssetRef whose `id` is the CANONICAL
  // embed URL — the portable identity that persists through URL mode + saved
  // sessions and is fed back here by the runtime to re-render on load. `opts`
  // (format/size, set by the picker) override what the link specifies.
  async function renderUrl(url, opts = {}) {
    const r = await resolveSpec(url);
    if (!r) return null;
    const { parsed, tool, state, query } = r;
    const supported = (tool.manifest.render?.formats ?? []).map(normFmt);

    const format = normFmt(opts.format) || normFmt(parsed.format)
      || (supported.includes('svg') ? 'svg' : (supported[0] || 'png'));
    // An SVG render with no explicit size keeps the tool's width="100%", which is
    // fine to DISPLAY (CSS sizes the <img>) but leaves the SVG with no intrinsic
    // pixel size — so a consuming tool that reads the image's pixels (canvas
    // getImageData) can't measure it. Fall back to the child's native render size
    // for SVG so the embedded image always carries real dimensions. (Rasters always
    // have a natural size, so they need no fallback.)
    const svgNative = format === 'svg' ? tool.manifest.render : null;
    const width = opts.width ?? state.width ?? svgNative?.width ?? undefined;
    const height = opts.height ?? state.height ?? svgNative?.height ?? undefined;
    const unit = opts.unit ?? state.unit ?? undefined;
    const dpi = opts.dpi ?? state.dpi ?? undefined;

    let ref;
    try {
      ref = await render({
        toolId: parsed.toolId, inputs: state.values,
        format, width, height, unit, dpi, _stack: opts._stack ?? [],
      });
    } catch (e) {
      host.log?.('warn', `renderUrl "${parsed.toolId}": ${e.message}`);
      return null;
    }
    if (!ref || typeof ref.url !== 'string') return null;

    // Canonical identity: keep the user's own child input params verbatim (already
    // compact/encoded), drop any export-control params, then fold in the effective
    // size. Built from the EXPANDED query (not parsed.query) so a pasted PACKED link's
    // state survives — otherwise the only param is the reserved `z`, which the delete
    // loop strips, leaving a stateless id that re-renders as defaults on reload. The
    // strict embed form re-parses everywhere (parseEmbedUrl is host-locked).
    const q = new URLSearchParams(query);
    for (const k of RESERVED) q.delete(k);
    if (width) q.set('w', String(width));
    if (height) q.set('h', String(height));
    if (unit && unit !== 'px') { q.set('unit', String(unit)); if (dpi) q.set('dpi', String(dpi)); }
    const id = buildEmbedUrl({ toolId: parsed.toolId, format, query: q.toString() });
    // No re-parseable identity (too long) → don't persist a dead slot; the picker
    // reports it couldn't render rather than committing an asset that breaks on load.
    if (!id) return null;

    // Hand back a SELF-CONTAINED data: URL: this ref is committed into the input
    // model and persisted, so it must not depend on the compose LRU's blob (revoked
    // on eviction). Also matches the CLI bridge, which returns a data: URL.
    const dataUrl = await blobUrlToDataUrl(ref.url).catch(() => ref.url);

    return {
      ...ref,
      url: dataUrl,
      id,
      meta: { ...(ref.meta || {}), tool: parsed.toolId, name: tool.manifest.name ?? parsed.toolId, toolUrl: id },
    };
  }

  // _describeUrl is web-only host-UI chrome (the picker's detected-tool card), not
  // part of the v1 ComposeAPI contract — underscore-prefixed like assets._* helpers.
  return { render, renderUrl, _describeUrl: describeUrl };
}

// Convert a blob: URL to a self-contained data: URL (see renderUrl). Falls back to
// the blob URL on read failure rather than losing the render.
async function blobUrlToDataUrl(blobUrl) {
  const resp = await fetch(blobUrl);
  const blob = await resp.blob();
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

function cacheKey(toolId, inputs, format, width, height, unit, dpi) {
  return `${toolId}|${stableStringify(inputs)}|${format ?? ''}|${width ?? ''}${unit ?? ''}x${height ?? ''}@${dpi ?? ''}`;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort()
    .map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(',')}}`;
}
