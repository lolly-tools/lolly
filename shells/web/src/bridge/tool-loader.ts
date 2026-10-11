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
import { isToolInstalled, installedFetchFile, getInstalledTool } from '../lib/installed-tools.ts';
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
    const integrity = await getToolIntegrity();
    const { toolDirectoryPath } = integrity ? await import('../../../../engine/src/catalog-integrity.ts') : { toolDirectoryPath: () => '' };
    const prefix = integrity ? toolDirectoryPath(integrity.envelope, toolId) : `/tools/${toolId}`;
    const suffix = path.startsWith(toolId + '/') ? path.slice(toolId.length + 1) : path;
    let resp = await instanceFetch(instancePath(`${prefix}/${suffix}`));
    // Compatibility is exact-file only and still passes the signed digest verifier.
    if (resp.status === 404 && prefix !== `/tools/${toolId}`) resp = await instanceFetch(instancePath(`/tools/${path}`));
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
export async function getTool(toolId: string, artifactDigest?: string): Promise<LoadedTool> {
  const meta = await getInstalledTool(toolId, artifactDigest);
  if (artifactDigest && !meta) throw new Error('This saved tool revision is missing. Import its original .lolly file.');
  const cacheKey = `${toolId}@${artifactDigest || meta?.artifactDigest || ''}`;
  if (toolCache.has(cacheKey)) return toolCache.get(cacheKey)!;
  // A sideloaded tool (installed from a .lolly) loads from its device-local bucket with
  // NO signed-catalog integrity - the recipient's catalog has no authority over it; its
  // bytes were verified at import (see lib/installed-tools.ts). A catalog tool takes the
  // network path with the signed-catalog check as before.
  const promise = isToolInstalled(toolId).catch(() => false).then((installed) =>
    installed
      ? loadTool(toolId, installedFetchFile(toolId, artifactDigest || meta?.artifactDigest), {
          lang: currentLang(), trustClass: 'sideloaded-consented',
        })
      : getToolIntegrity().then(async (integrity) => {
          const tool = await loadTool(toolId, makeFetchFile(toolId), { lang: currentLang(), integrity: integrity ?? undefined });
          if (integrity?.envelope.toolDirs) {
            // Verify the fetched source first; resolving URLs does not alter signed bytes.
            const { resolveVerifiedToolReferences } = await import('../catalog/tool-references.ts');
            tool.template = resolveVerifiedToolReferences(tool.template, integrity.envelope, instancePath);
            if (tool.styles) tool.styles = resolveVerifiedToolReferences(tool.styles, integrity.envelope, instancePath);
            if (tool.hooksSource) tool.hooksSource = resolveVerifiedToolReferences(tool.hooksSource, integrity.envelope, instancePath);
            if (tool.presentationSource) tool.presentationSource = resolveVerifiedToolReferences(tool.presentationSource, integrity.envelope, instancePath);
          }
          return tool;
        }));
  toolCache.set(cacheKey, promise);
  try {
    const tool = await promise;
    tool.artifactDigest = meta?.artifactDigest;
    toolCache.set(cacheKey, tool);
    return tool;
  } catch (e) {
    toolCache.delete(cacheKey);
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
