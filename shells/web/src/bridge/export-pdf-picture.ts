// SPDX-License-Identifier: MPL-2.0
/**
 * Pictures the PDF walker places: the encodings a PDF carries, the natural size an
 * image is fitted by, and the pixels of a `<canvas>`.
 *
 * `imageDims`, `imageForPdf` and `rasterizeToPng` moved here from export.ts unchanged, to
 * keep that hotspot from growing when the canvas branch arrived.
 */
import { _host } from './export-shared.ts';

// Natural pixel dimensions of an image href (for cover/contain fitting). Null on failure.
export async function imageDims(src: string): Promise<{ w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(await (await fetch(src)).blob());
    const d = { w: bmp.width, h: bmp.height };
    bmp.close?.();
    return d;
  } catch { return null; }
}

// Pick the addImage format from a data: URL's REAL MIME (the previous
// `.includes('image/png')` guess silently misclassified WebP/AVIF/GIF user images
// as PNG, so they were dropped). PNG and JPEG are the two encodings PDF itself
// carries, so they pass through; everything else (WebP/AVIF/GIF/BMP…) is
// rasterised to PNG via a canvas first, which is what the old WebP decoder did
// internally anyway. Non-data / unrecognised sources keep the old PNG fallback.
export async function imageForPdf(src: string): Promise<{ src: string; fmt: string }> {
  const mime = (/^data:([^;,]+)/i.exec(src)?.[1] || '').toLowerCase();
  if (mime === 'image/png')  return { src, fmt: 'PNG' };
  if (mime === 'image/jpeg' || mime === 'image/jpg') return { src, fmt: 'JPEG' };
  if (mime.startsWith('image/')) {
    try { return { src: await rasterizeToPng(src), fmt: 'PNG' }; }
    catch { return { src, fmt: 'PNG' }; }
  }
  return { src, fmt: 'PNG' };
}

// Decode any image source the browser understands and re-encode it as a PNG data
// URL, so a format PDF can't carry natively can still be placed.
async function rasterizeToPng(src: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width  = img.naturalWidth  || img.width;
  canvas.height = img.naturalHeight || img.height;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * The pixels of a `<canvas>` as a PNG data URL, for the walker to place on the element's
 * box, or null when there is nothing to place.
 *
 * The SVG walker has always drawn a canvas this way; the PDF walker had no canvas branch,
 * so a canvas printed as an empty box. Timezone draws its WebGL globe into a 2-D canvas,
 * and its PDFs had no map. Like the SVG walker, the pixels are the content and there is no
 * vector form to recover.
 *
 * Two differences from the SVG walker, both so that a canvas the page shows nothing in
 * puts nothing in the file: a canvas whose every pixel is transparent (nothing drawn yet,
 * or a WebGL buffer read back after the browser presented it) is left out, and a canvas
 * another origin's pixels have tainted is left out with a warning, as there.
 */
export function canvasPicture(canvas: HTMLCanvasElement): string | null {
  const w = canvas.width, h = canvas.height;
  if (!(w > 0 && h > 0)) return null;
  try {
    const probe = document.createElement('canvas');
    probe.width = w;
    probe.height = h;
    const g = probe.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(canvas, 0, 0);
    const px = g.getImageData(0, 0, w, h).data;
    let painted = false;
    for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) { painted = true; break; }
    return painted ? canvas.toDataURL('image/png') : null;
  } catch (e) {
    _host?.log?.('warn', `pdf: <canvas> could not be read (tainted?) - ${(e as Error).message}`);
    return null;
  }
}
