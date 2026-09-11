// SPDX-License-Identifier: MPL-2.0
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import { sha256Hex } from '@lolly/engine';
import { currentLang } from '../i18n.ts';
import { getToolIntegrity } from '../catalog/integrity.ts';
import { instanceFetch, instancePath } from './instance.ts';
import { INSTALLED_CACHE, isToolInstalled } from './installed-tools.ts';
import { looksLikeHtmlDocument, looksLikeHtmlDocumentBytes } from '../bridge/tool-file-guard.ts';
import { localAssetPaths } from './offline-pins.ts';
import type { LollyToolBundle, LollyToolTrust } from './lolly-pack.ts';
const TOOL_TEXT_FILE = /\.(html|css|js|json|ics|vcf|csv|md|txt|svg)$/i;

/**
 * Resolve a tool's files for embedding in a `.lolly` and stamp a precise trust class.
 * The file list is the loader-critical set (tool.json/template/styles/hooks/i18n/text
 * templates + icon) UNIONED with every `<toolId>/*` path the signed catalog lists (which
 * adds thumb + tool-local assets for a catalog tool). Each file is fetched, and - when the
 * catalog signed this tool - hashed against the signed digest: `signed-catalog` only when
 * every covered file matched with no tamper, else `custom`. Returns null when the two files
 * a tool cannot open without (tool.json + template.html) can't be fetched.
 */
export async function resolveToolBundle(
  toolId: string,
  manifest: ToolManifest
): Promise<LollyToolBundle | null> {
  const integ = await getToolIntegrity().catch(() => null);
  const signed = integ?.envelope?.files ?? null;

  const rels = new Set<string>(['tool.json', 'template.html', 'styles.css', 'icon.svg']);
  const hooks = manifest.hooks as { module?: boolean } | undefined;
  if (hooks && hooks.module !== true) rels.add('hooks.js');
  for (const ext of ['ics', 'vcf', 'csv', 'md'])
    if ((manifest.render?.formats ?? []).includes(ext)) rels.add(`template.${ext}`);
  const lang = currentLang();
  if (lang && lang !== 'en') rels.add(`i18n/${lang}.json`);
  if (signed)
    for (const key of Object.keys(signed))
      if (key.startsWith(`${toolId}/`)) rels.add(key.slice(toolId.length + 1));

  const fetchText = async (path: string): Promise<string> => {
    const response = await instanceFetch(instancePath(`/tools/${path}`));
    if (!response.ok) throw new Error('tool-not-found');
    const text = await response.text();
    // The SPA shell served for a missing file is told apart by CONTENT, never the
    // Content-Type header: Tauri labels unknown-extension text (.md/.ics/.vcf sibling
    // templates) `text/html`, which would drop them from the bundle (tool-file-guard.ts).
    if (!path.endsWith('.html') && looksLikeHtmlDocument(text)) throw new Error('tool-not-found');
    return text;
  };
  // Installed packs already own their complete file set. Carry those exact bytes,
  // including media/fonts that are not named in the receiving catalog envelope.
  if (await isToolInstalled(toolId).catch(() => false)) {
    const cache = await caches.open(INSTALLED_CACHE);
    const prefix = new URL(instancePath(`/tools/${toolId}/`), location.origin).href;
    const files: Record<string, Uint8Array> = {};
    for (const request of await cache.keys()) {
      if (!request.url.startsWith(prefix)) continue;
      const response = await cache.match(request);
      if (response) files[request.url.slice(prefix.length)] = new Uint8Array(await response.arrayBuffer());
    }
    if (!files['tool.json'] || !files['template.html']) return null;
    return { id: toolId, version: String(manifest.version ?? ''), trust: 'custom', files };
  }
  const files: Record<string, Uint8Array> = {};
  const requiredAssets = new Set<string>();
  let covered = 0; // carried files the signed catalog also lists
  let matched = 0; // …of those, how many hashed identically
  for (const rel of rels) {
    let bytes: Uint8Array | null = null;
    try {
      if (TOOL_TEXT_FILE.test(rel)) {
        bytes = new TextEncoder().encode(await fetchText(`${toolId}/${rel}`));
      } else {
        const resp = await instanceFetch(instancePath(`/tools/${toolId}/${rel}`));
        if (resp.ok) {
          const body = new Uint8Array(await resp.arrayBuffer());
          // Same content-based SPA-shell check as fetchText, on the bytes.
          if (rel.endsWith('.html') || !looksLikeHtmlDocumentBytes(body)) bytes = body;
        }
      }
    } catch {
      bytes = null;
    } // an optional file that isn't there
    if (!bytes) {
      if (requiredAssets.has(rel) || signed?.[`${toolId}/${rel}`] || (rel === 'hooks.js' && hooks)) return null;
      continue;
    }
    files[rel] = bytes;
    // Unsigned local builds have no signed file inventory. Reuse the offline
    // pin scanner to carry literal tool-local media/libraries recursively.
    if (TOOL_TEXT_FILE.test(rel)) for (const path of localAssetPaths(toolId, [new TextDecoder().decode(bytes)])) {
      const relative = path.slice(`/tools/${toolId}/`.length);
      if (!relative.endsWith('/') && !relative.split('/').includes('..')) { rels.add(relative); requiredAssets.add(relative); }
    }
    const digest = signed?.[`${toolId}/${rel}`];
    if (digest) {
      covered++;
      if ((await sha256Hex(bytes)) === digest) matched++;
    }
  }
  if (!files['tool.json'] || !files['template.html']) return null;

  const trust: LollyToolTrust =
    signed && Object.hasOwn(signed, `${toolId}/tool.json`) && covered > 0 && matched === covered
      ? 'signed-catalog'
      : 'custom';
  return {
    id: toolId,
    ...(manifest.version != null ? { version: String(manifest.version) } : {}),
    trust,
    files,
  };
}
