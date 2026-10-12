// SPDX-License-Identifier: MPL-2.0
/** PDF pages with collective Design effects use the browser's complete composite. */
export function hasVisibleDesignGroupComposite(root: Element): boolean {
  const groups = [...root.querySelectorAll('[data-design-group]')];
  if (root.matches('[data-design-group]')) groups.unshift(root);
  return groups.some(group => {
    const style = window.getComputedStyle(group);
    if (Number(style.opacity || 1) >= 1 && (!style.mixBlendMode || style.mixBlendMode === 'normal')) return false;
    for (let node: Element | null = group; node; node = node.parentElement) {
      const state = node === group ? style : window.getComputedStyle(node);
      if (state.display === 'none' || state.visibility === 'hidden' || Number(state.opacity || 1) === 0) return false;
      if (node === root) break;
    }
    return true;
  });
}

export async function paintDesignGroupPage(
  pdf: { addImage(...args: unknown[]): void }, root: Element,
  region: { x: number; y: number; w: number; h: number },
  options: { rasterFallback: boolean; dpi: number; maxPixels: number },
  capture: (node: HTMLElement, width: number, height: number) => Promise<string | null>,
): Promise<boolean> {
  if (!hasVisibleDesignGroupComposite(root)) return false;
  if (!options.rasterFallback) throw new Error('This PDF page needs raster capture to preserve group opacity and blending. Enable raster fallback or export SVG.');
  const width = Math.max(2, Math.min(options.maxPixels, Math.round(region.w * options.dpi / 72)));
  const height = Math.max(2, Math.min(options.maxPixels, Math.round(region.h * options.dpi / 72)));
  const image = await capture(root as HTMLElement, width, height);
  if (!image) throw new Error('This PDF page could not capture its group opacity and blending. Retry or export SVG.');
  pdf.addImage(image, 'PNG', region.x, region.y, region.w, region.h);
  return true;
}
