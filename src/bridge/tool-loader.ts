// SPDX-License-Identifier: MPL-2.0
/**
 * Shared tool loader for the web shell's render paths.
 *
 * Loading (and caching) a tool definition, plus the small format/exportability
 * helpers, live here - separate from pro/render-export.js - so the embed
 * interceptor (bridge/embed.js) and the off-screen renderer (pro/render-export.js)
 * can both reach them WITHOUT a circular import (render-export ↔ embed).
 */
import { loadTool } from '@lolly/engine';
import type { LoadedTool, ToolManifest } from '../../../../engine/src/loader.ts';
import { currentLang } from '../i18n.ts';
import { instanceFetch, instancePath } from '../lib/instance.ts';
import { getToolIntegrity } from '../catalog/integrity.ts';
import { isToolInstalled, installedFetchFile } from '../lib/installed-tools.ts';
import { looksLikeHtmlDocument } from './tool-file-guard.ts';

// Loaded tools are cached so selecting the same template across many rows - the
// primary power-user workflow - loads each template only once.
const toolCache = new Map<string, Promise<LoadedTool> | LoadedTool>();

/**
 * The ONE catalog-tool fetchFile. The tool view (views/tool.ts) imports this rather
 * than keeping its own: a second, byte-identical copy lived there and drifted - it kept
 * the header-based SPA-shell check after this one was fixed, so chart/timezone still
 * would not open in the iOS app (2026-09-09). One implementation, one place to be right.
 */
export function makeFetchFile(toolId: string): (path: string) => Promise<string> {
  return async (path: string) => {
    const resp = await instanceFetch(instancePath(`/tools/${path}`));
    if (!resp.ok) throw new Error('tool-not-found');
    const text = await resp.text();
    // A missing file comes back as the SPA shell (a 200), not a 404. That is told
    // apart by CONTENT - see tool-file-guard.ts for why the Content-Type header is
    // not the signal: Tauri labels every unknown-extension text file `text/html`.
    if (!path.endsWith('.html') && looksLikeHtmlDocument(text)) throw new Error('tool-not-found');
    return text;
  };
}

/** Load (and cache) a tool definition. Used both to read inputs and to render.
 *  Translates the manifest's name/description/input labels via its i18n/<lang>.json
 *  sidecar when one exists (engine/src/loader.ts's applyManifestI18n) - the active
 *  language never changes mid-session (switchLang reloads the page), so the cache
 *  doesn't need lang in its key. */
export async function getTool(toolId: string): Promise<LoadedTool> {
  if (toolCache.has(toolId)) return toolCache.get(toolId)!;
  // A sideloaded tool (installed from a .lolly) loads from its device-local bucket with
  // NO signed-catalog integrity - the recipient's catalog has no authority over it; its
  // bytes were verified at import (see lib/installed-tools.ts). A catalog tool takes the
  // network path with the signed-catalog check as before.
  const promise = isToolInstalled(toolId).catch(() => false).then((installed) =>
    installed
      ? loadTool(toolId, installedFetchFile(toolId), {
          lang: currentLang(), trustClass: 'sideloaded-consented',
        })
      : getToolIntegrity().then((integrity) =>
          loadTool(toolId, makeFetchFile(toolId), { lang: currentLang(), integrity: integrity ?? undefined })));
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
export function chooseFormat(manifest: ToolManifest, preferred?: string | null): string {
  const formats = manifest.render?.formats ?? [];
  if (preferred) {
    if (formats.includes(preferred)) return preferred;
    const alt = preferred === 'jpg' ? 'jpeg' : preferred === 'jpeg' ? 'jpg' : null;
    if (alt && formats.includes(alt)) return alt;
  }
  return formats[0] ?? 'png';
}

/** Whether a tool can be exported at all (render-only tools opt out). */
export function isExportable(manifest: ToolManifest): boolean {
  return manifest.render?.export !== false && (manifest.render?.formats?.length ?? 0) > 0;
}
