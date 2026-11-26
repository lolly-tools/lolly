// SPDX-License-Identifier: MPL-2.0
/**
 * How a vector page holds an export root whose box is not the page's shape.
 *
 * The PNG draws the root at its own layout, scaled by the page's width over the root's
 * width from the top-left corner, and the page crops whatever does not fit (rasterStyle in
 * export-raster-style.ts). The SVG and PDF walkers scaled each axis on its own instead. The
 * SVG came out squashed; the PDF moved every box by the height's scale while its text and
 * pictures kept the width's, so the layout came out shorter than the page. Redact is the
 * case that showed it: its workspace pins the live canvas to the stage's height while its
 * export size stays 760 x 620. Both walkers now hold such a root the way the PNG does.
 *
 * A canvas the export panel sized has its page's shape to within a rounded pixel on each
 * side, under 1% on any side of 100 px or more. Those keep the scale per axis they always
 * had, and their bytes. So does a print export with bleed, which stretches the artwork to
 * the bleed box on purpose (coverRasterStyle in export-raster-style.ts is its raster twin).
 */

/** How far the root's shape may stray from the page's before the page fits it by width. */
export const PAGE_SHAPE_TOLERANCE = 0.01;

/** Whether a root of `rootW` x `rootH` and a page of `pageW` x `pageH` have different shapes. */
export function shapesDisagree(rootW: number, rootH: number, pageW: number, pageH: number): boolean {
  if (!(rootW > 0 && rootH > 0 && pageW > 0 && pageH > 0)) return false;
  return Math.abs((pageW * rootH) / (rootW * pageH) - 1) > PAGE_SHAPE_TOLERANCE;
}

/**
 * The region of a page, in the page's units, that a root is drawn into. The whole page
 * when the shapes agree; otherwise the page's width and the root's height at that width,
 * from the top-left, which runs past the page's foot or stops short of it as the PNG does.
 */
export function pageFitRegion(root: Element, pageW: number, pageH: number): { x: number; y: number; w: number; h: number } {
  const r = root.getBoundingClientRect();
  const h = shapesDisagree(r.width, r.height, pageW, pageH) ? r.height * (pageW / r.width) : pageH;
  return { x: 0, y: 0, w: pageW, h };
}
