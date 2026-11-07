// SPDX-License-Identifier: MPL-2.0
/**
 * What the PowerPoint and Word exports both read off a rendered page: the canvas cascade
 * a brand colour or face resolves through, the author of an imported source, and an
 * SVG picture drawn as a raster for the readers that cannot draw SVG.
 *
 * A leaf: it imports nothing from the export bridge, so export-pptx.ts and
 * export-docx.ts can both stand on it without a dependency cycle. Moved verbatim from
 * export-pptx.ts, except that the rasteriser takes its size cap and its canvas pass from
 * the caller.
 */
import type { DeckColorResolver } from './pptx-deck.ts';

/**
 * The brand-token lookup a deck colour resolves through (plan 179 A12).
 *
 * A Design artboard's fill is a token on any branded document - `var(--brand-surface,
 * #ffffff)` - and pptx-deck.ts understands literal colours only, so before this the
 * default deck exported with no slide background at all.
 *
 * Read the custom properties off THE NODE BEING EXPORTED, not off a global id. Custom
 * properties inherit, and `applyBrandVars` writes the active brand block onto whichever
 * element the caller handed it: `#tool-canvas` in the editor, but a bare
 * `.pro-export-canvas` on the offscreen stage that #/batch renders through (pro/render-
 * export.ts). A `#tool-canvas` lookup found nothing on that route and fell back to
 * `documentElement`, where brand-vars only ever writes `--brand-primary`/`--brand-warn` -
 * so every other `var(--brand-*)` resolved to '', `deckFill` answered undefined, and the
 * same document exported white from the batch route and branded from the editor. Closest
 * ancestor first so a node INSIDE the canvas still finds it; the node itself otherwise.
 * Memoised by name - one deck references the same handful of tokens on every slide.
 * Returns undefined (→ every var() falls back to its own literal) when there is no DOM,
 * which is how the node-side suites reach this module's pure half.
 */
export function canvasColorResolver(node?: Element): DeckColorResolver | undefined {
  const doc = typeof document === 'undefined' ? null : document;
  const win = typeof window === 'undefined' ? null : window;
  if (!doc || typeof win?.getComputedStyle !== 'function') return undefined;
  const root = node?.closest?.('#tool-canvas') ?? node
    ?? doc.querySelector?.('#tool-canvas') ?? doc.documentElement;
  if (!root) return undefined;
  const seen = new Map<string, string>();
  let cs: CSSStyleDeclaration | null = null;
  return (name: string): string => {
    const hit = seen.get(name);
    if (hit !== undefined) return hit;
    let val = '';
    try {
      cs ??= win.getComputedStyle(root);
      val = (cs.getPropertyValue(name) || '').trim();
    } catch { /* detached document - the var()'s own fallback stands */ }
    seen.set(name, val);
    return val;
  };
}


/**
 * The imported source document's author, when the stage declares one via the
 * `data-source-author` attribute (the deck/doc studios emit it from their
 * `sourceAuthor` input, set at import from the source file's own core props).
 * The shared core-props writer then carries BOTH authors when they differ
 * (plans/144 G6 follow-up).
 */
export function sourceAuthorOf(node: Element): string | undefined {
  const el = node.matches?.('[data-source-author]') ? node : node.querySelector?.('[data-source-author]');
  const v = el?.getAttribute?.('data-source-author')?.trim();
  return v || undefined;
}

/**
 * Draw SVG bytes into a canvas `w` x `h` (each side held to 2..`maxPx`) and encode it as
 * `mime`, or null where there is no DOM or the browser cannot draw the SVG. `decorate`
 * runs on the canvas before encoding; the PowerPoint export passes its imprint there,
 * and the Word export passes nothing, so its PNG holds the artwork and nothing else.
 */
export async function rasterizeSvgBytes(
  svgBytes: Uint8Array, w: number, h: number, mime: 'image/png' | 'image/jpeg', maxPx: number,
  decorate?: (canvas: HTMLCanvasElement) => void,
): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null;
  const url = URL.createObjectURL(new Blob([svgBytes as BlobPart], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('svg raster')); im.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.min(maxPx, Math.round(w)));
    canvas.height = Math.max(2, Math.min(maxPx, Math.round(h)));
    const cx = canvas.getContext('2d');
    if (!cx) return null;
    cx.drawImage(img, 0, 0, canvas.width, canvas.height);
    decorate?.(canvas);
    return dataUrlToBytes(mime === 'image/jpeg' ? canvas.toDataURL('image/jpeg', 0.92) : canvas.toDataURL('image/png'));
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
