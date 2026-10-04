// SPDX-License-Identifier: MPL-2.0
/**
 * The backdrop a raster export paints behind its root (plan 291 M3b, export-bg).
 *
 * `background: 'transparent'` asks for no backdrop: the document's own stage colour is
 * left out so the picture carries alpha. The raster path does that by overriding the
 * cloned root's CSS background. That is right when the root is the whole canvas, whose
 * background is the stage colour. It is wrong when the root is one artboard: a
 * `[data-pdf-page]` page carries its own fill (a frame's `bg`, gradient or picture), and
 * that fill is the slide's content. Design turns transparency on by default, so a
 * one-frame export (`?s=<frame>&format=png`, `lolly run <session.lolly> --export=png
 * --s=<frame>`, and the panel's per-slide fan-out) came out as a transparent PNG and a
 * black JPG while the same frame in a whole-deck export kept its colour.
 *
 * A page root therefore keeps its own paint, and the request still adds no colour behind
 * the page. Any other root behaves as before.
 */

/** The page marker every per-page export path selects on (bridge/export.ts, lib/export-target.ts). */
export const EXPORT_PAGE_ATTR = 'data-pdf-page';

/** True when the export root is one page (artboard) whose own fill is content. */
export function exportRootIsPage(node: unknown): boolean {
  const el = node as { hasAttribute?: (name: string) => boolean } | null | undefined;
  return typeof el?.hasAttribute === 'function' && el.hasAttribute(EXPORT_PAGE_ATTR);
}

/**
 * The dom-to-image backdrop fields for a raster export: `bgcolor` fills behind the root,
 * and `clearRoot` overrides the cloned root's own background with transparent.
 */
export function rasterBackdrop(background: string | null | undefined, rootIsPage: boolean): { bgcolor?: string; clearRoot: boolean } {
  if (background === 'transparent') return { clearRoot: !rootIsPage };
  if (background != null) return { bgcolor: background, clearRoot: false };
  return { clearRoot: false };
}

/** Writes `rasterBackdrop`'s answer for the export root onto dom-to-image options. */
export function applyRasterBackdrop(result: { bgcolor?: string; style: { background?: string } }, background: string | null | undefined, root: unknown): void {
  const backdrop = rasterBackdrop(background, exportRootIsPage(root));
  if (backdrop.clearRoot) result.style.background = 'transparent';
  if (backdrop.bgcolor != null) result.bgcolor = backdrop.bgcolor;
}
