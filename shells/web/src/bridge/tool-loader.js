/**
 * Shared tool loader for the web shell's render paths.
 *
 * Loading (and caching) a tool definition, plus the small format/exportability
 * helpers, live here — separate from pro/render-export.js — so the embed
 * interceptor (bridge/embed.js) and the off-screen renderer (pro/render-export.js)
 * can both reach them WITHOUT a circular import (render-export ↔ embed).
 */
import { loadTool } from '@lolly/engine';

// Loaded tools are cached so selecting the same template across many rows — the
// primary power-user workflow — loads each template only once.
const toolCache = new Map();

function makeFetchFile(toolId) {
  return async (path) => {
    const resp = await fetch(`/tools/${path}`);
    if (resp.status === 404) throw new Error('tool-not-found');
    const ct = resp.headers.get('content-type') ?? '';
    if (!resp.ok || (ct.includes('text/html') && !path.endsWith('.html'))) {
      throw new Error('tool-not-found');
    }
    return resp.text();
  };
}

/** Load (and cache) a tool definition. Used both to read inputs and to render. */
export async function getTool(toolId) {
  if (toolCache.has(toolId)) return toolCache.get(toolId);
  const promise = loadTool(toolId, makeFetchFile(toolId));
  toolCache.set(toolId, promise);
  try {
    const tool = await promise;
    toolCache.set(toolId, tool);
    return tool;
  } catch (e) {
    toolCache.delete(toolId);
    throw e;
  }
}

/**
 * Pick an export format the tool actually supports. `jpg` and `jpeg` are the same
 * format spelled two ways, so a request for one matches a declaration of the other
 * (rather than silently falling through to the first declared format).
 */
export function chooseFormat(manifest, preferred) {
  const formats = manifest.render?.formats ?? [];
  if (preferred) {
    if (formats.includes(preferred)) return preferred;
    const alt = preferred === 'jpg' ? 'jpeg' : preferred === 'jpeg' ? 'jpg' : null;
    if (alt && formats.includes(alt)) return alt;
  }
  return formats[0] ?? 'png';
}

/** Whether a tool can be exported at all (render-only tools opt out). */
export function isExportable(manifest) {
  return manifest.render?.export !== false && (manifest.render?.formats?.length ?? 0) > 0;
}
