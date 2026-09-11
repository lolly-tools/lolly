// SPDX-License-Identifier: MPL-2.0
/**
 * The raster export path's default supersampling factor - ONE statement of it.
 *
 * `rasterStyle` (bridge/export.ts) renders a node at its native CSS size and
 * scales it up to the target resolution. When the caller requested NO dimension
 * the target is not the node box: it is the node box times this factor, so a
 * 600 x 600 tool with nothing typed in the size fields exports a 1200 x 1200 PNG.
 *
 * It lives in its own module, rather than beside `rasterStyle`, because the
 * PREFLIGHT collectors need it too - `pro/preflight-rows.ts` reports the pixel
 * count a batch row will actually produce, and importing `bridge/export.ts` for a
 * number would drag the whole DOM-bound export bridge into a headless pre-pass.
 * A second literal `2` is how preflight ends up stamping `bound: 'exact'` on a
 * count that is four times too small (`plans/65-preflight-and-cost.md` section 6).
 */
export const RASTER_DEFAULT_SCALE = 2;

/**
 * The formats whose still raster is produced through `rasterStyle`, and therefore the
 * only ones {@link RASTER_DEFAULT_SCALE} applies to.
 *
 * Deliberately NOT the engine's `RASTER_FORMATS`, which answers a different question
 * ("does this format have pixels at all"): `gif`/`apng` are in that set and are
 * captured by `createFrameSource`, whose target is the node box at 1x, so doubling
 * them would be the same invented number in the other direction.
 *
 * `cmyk-tiff` is excluded because it is CONDITIONAL - `renderCmykTiff` uses
 * `coverRasterStyle` (sized from the print geometry) whenever a bleed or any mark is
 * set, and only falls back to `rasterStyle` when neither is. A caller that knows the
 * print settings adds it for itself; a caller that does not must not assume.
 */
export const SUPERSAMPLED_EXPORT_FORMATS: ReadonlySet<string> =
  new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff']);
