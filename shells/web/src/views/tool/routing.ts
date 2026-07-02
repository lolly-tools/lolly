// SPDX-License-Identifier: MPL-2.0
/**
 * Routing fallbacks for the tool view (finding 1): the file fetcher plus the
 * "can't mount this tool here" landing pages (404 / desktop-only / install the
 * extension). Extracted from tool.js unchanged.
 */
import type { ToolManifest, ToolFetchFile } from '@lolly/engine';
import { escape } from '../../utils.ts';
import { capabilityLabel, CAPTURE_EXTENSION_URL } from '../../capabilities.ts';

/**
 * Where a tool-directory-relative path is importable from in the web shell —
 * the resolver loadTool needs for module hooks (hooks.module). Same-origin, so
 * a native dynamic import of the returned URL resolves sibling imports too.
 */
export const resolveToolModuleUrl = (path: string): string => `/tools/${path}`;

export function makeFetchFile(toolId: string): ToolFetchFile {
  return async (path) => {
    const resp = await fetch(`/tools/${path}`);
    if (resp.status === 404) throw new Error('tool-not-found');
    // SPA servers return index.html for unknown paths with a 200. Detect that.
    const ct = resp.headers.get('content-type') ?? '';
    // SPA fallback check — but skip for .html files since template.html legitimately returns text/html.
    if (!resp.ok || (ct.includes('text/html') && !path.endsWith('.html'))) throw new Error('tool-not-found');
    return await resp.text();
  };
}

export function mount404(viewEl: HTMLElement, toolId: string): void {
  document.title = 'Not Found — Lolly';
  viewEl.innerHTML = `
    <div class="not-found">
      <div class="not-found-inner">
        <p class="not-found-code">404</p>
        <h1 class="not-found-title">Tool not found</h1>
        <p class="not-found-desc">There's no tool at <code>${escape(toolId)}</code>.</p>
        <a href="/" class="not-found-home">Browse all tools</a>
      </div>
    </div>
  `;
}

// Shown when a tool is opened in a shell that can't fulfil its capabilities
// (e.g. a 'capture' tool in the web PWA). Mirrors the 404 layout.
export function mountUnavailable(viewEl: HTMLElement, manifest: ToolManifest, unmet: readonly string[]): void {
  document.title = `${manifest.name} — Desktop only`;
  const why = unmet.map(capabilityLabel).join(', ');
  viewEl.innerHTML = `
    <div class="not-found">
      <div class="not-found-inner">
        <p class="not-found-code">Desktop</p>
        <h1 class="not-found-title">${escape(manifest.name)} needs the desktop app</h1>
        <p class="not-found-desc">This tool uses <strong>${escape(why)}</strong>, which the web app can’t provide — a browser can’t screenshot cross-origin pages. Open it in the Lolly desktop app.</p>
        <a href="/" class="not-found-home">Browse all tools</a>
      </div>
    </div>
  `;
}

// Shown on a Chromium browser for a capture tool when the extension isn't
// installed — the tool CAN run here once the free extension is added.
export function mountInstallPrompt(viewEl: HTMLElement, manifest: ToolManifest): void {
  document.title = `${manifest.name} — Add the extension`;
  viewEl.innerHTML = `
    <div class="not-found">
      <div class="not-found-inner">
        <p class="not-found-code">Add&#8209;on</p>
        <h1 class="not-found-title">Enable ${escape(manifest.name)} in your browser</h1>
        <p class="not-found-desc">Add the free Lolly screenshot extension and this tool captures pages right here — no desktop app needed. Install it, then reload this page.</p>
        <a href="${escape(CAPTURE_EXTENSION_URL)}" class="not-found-home" target="_blank" rel="noopener">Get the extension</a>
        <a href="#/" class="not-found-back">Back to all tools</a>
      </div>
    </div>
  `;
}
