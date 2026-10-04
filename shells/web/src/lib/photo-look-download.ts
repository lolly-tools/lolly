// SPDX-License-Identifier: MPL-2.0
/**
 * The source the Assets view downloads and crops when a photo treatment is chosen
 * (views/assets/downloads.ts): a self-contained SVG at the photo's pixel size that the
 * caller rasterises to the chosen format.
 *
 * The legacy kinds (greyscale, duotone) keep their SVG filter, which is exact for them.
 * A look only pixels reproduce (`gradient-map`, `lut`, plan 291 W7) is baked into the
 * photo by the engine's applyPhotoLook, the same bake the assets bridge serves to the
 * canvas and every exporter, and the SVG embeds those pixels with no filter. Before this
 * the download went through the filter preview (Rec.709 luma, no contrast or lightness
 * grade, a LUT shown as the plain photo) while its credential said the look was applied.
 * A bake that cannot run throws, so no download claims a look it does not carry.
 */
import { wrapRasterWithTreatment, type PhotoTreatment } from '../../../../engine/src/photo-treatment.ts';
import { isRasterPhotoLook, resolvePhotoLook } from '../../../../engine/src/photo-look.ts';
import type { GradeLut } from '../../../../engine/src/grade.ts';
import type { PhotoLookBakeRequest } from '../bridge/photo-look-raster.ts';

export interface TreatedPhotoDeps {
  /** A blob as a `data:` URL (the SVG wrapper must be self-contained). */
  toDataUrl(blob: Blob): Promise<string>;
  /** The natural pixel size of an image URL. */
  measure(href: string): Promise<{ w: number; h: number }>;
  /** Read and parse the catalog .cube a `lut` look names; null when unavailable. */
  loadLut?(lutId: string): Promise<GradeLut | null>;
  /** The bake; defaults to the bridge's (a Worker where the browser has one). */
  bake?(req: PhotoLookBakeRequest): Promise<Blob>;
  /** The look's theme variant to bake; absent is the base look. */
  theme?: string;
}

export interface TreatedPhotoSource {
  svg: string;
  w: number;
  h: number;
  /** True when the look was baked into the pixels (a raster look). */
  baked: boolean;
}

/** The treated photo as an SVG source, baking a raster look into its pixels. */
export async function treatedPhotoSvg(blob: Blob, def: PhotoTreatment, deps: TreatedPhotoDeps): Promise<TreatedPhotoSource> {
  if (!isRasterPhotoLook(def)) {
    const href = await deps.toDataUrl(blob);
    const { w, h } = await deps.measure(href);
    return { svg: wrapRasterWithTreatment({ href, width: w, height: h, treatment: def }), w, h, baked: false };
  }
  const theme = deps.theme && deps.theme !== 'base' ? deps.theme : undefined;
  let lut: GradeLut | undefined;
  if (def.kind === 'lut') {
    const lutId = resolvePhotoLook(def, theme).lut;
    lut = (lutId && deps.loadLut ? await deps.loadLut(lutId) : null) ?? undefined;
    if (!lut) throw new Error(`The LUT of the '${def.label ?? def.id}' look is unavailable`);
  }
  const bake = deps.bake ?? (await import('../bridge/photo-look-bake.ts')).bakePhotoLookBlob;
  const baked = await bake({ blob, look: def, output: 'image/png', ...(theme ? { theme } : {}), ...(lut ? { lut } : {}) });
  const href = await deps.toDataUrl(baked);
  const { w, h } = await deps.measure(href);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<image width="${w}" height="${h}" preserveAspectRatio="none" href="${href}"/>`
    + '</svg>';
  return { svg, w, h, baked: true };
}
