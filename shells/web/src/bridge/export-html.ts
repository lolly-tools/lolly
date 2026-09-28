// SPDX-License-Identifier: MPL-2.0
import type { ExportOpts, WebHost } from './export-shared.ts';
import { renderPlayerHtml } from './export-player.ts';
import { renderPortableHtml } from './export-portable.ts';

/** Choose a declared player, a portable presentation, or the existing still HTML writer. */
export async function renderHtml(node: Element, opts: ExportOpts, host: WebHost | null): Promise<Blob> {
  const player = await renderPlayerHtml(node, opts, host);
  if (player) return player;
  if (opts.portableDocument) return renderPortableHtml(node, opts.portableDocument);
  return renderStaticHtml(node, opts);
}

// Standalone HTML document with the tool's template CSS and baked-in content.
// The fitting script is stripped - the computed font-size is already on the element.
//
// opts.fullPage drops the fixed-size tool-canvas frame: the canvas div is the
// shell's preview box, so we promote its content straight into the document body
// and let it fill the whole page (no centring, no neutral backdrop). The default
// keeps the canvas as a centred, fixed-size card on a grey backdrop.
function renderStaticHtml(node: Element, opts: ExportOpts = {}): Blob {
  const styles = [...node.querySelectorAll('style')].map(s => s.textContent).join('\n');
  const clone = node.cloneNode(true) as Element;
  clone.querySelectorAll('style, script').forEach(el => { el.remove(); });
  // Full-page: give html/body a definite full-viewport height so a promoted root
  // that sizes itself to height:100% (e.g. bag-video's .scene) resolves against the
  // viewport instead of collapsing to zero (which rendered a blank white page);
  // min-height keeps taller, flowing content able to extend the page.
  const modeCss = opts.fullPage
    ? `html, body { height: 100%; }\nbody { min-height: 100dvh; }`
    : `body { display: flex; align-items: center; justify-content: center; min-height: 100dvh; background: #555; padding: 16px; }`;
  const content = opts.fullPage ? clone.innerHTML : clone.outerHTML;
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; }
${modeCss}
${styles}
</style>
</head>
<body>
${content}
</body>
</html>`;
  return new Blob([doc], { type: 'text/html' });
}
