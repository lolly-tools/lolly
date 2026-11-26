// SPDX-License-Identifier: MPL-2.0
/**
 * Words no font can draw, in an EPS or WMF: a picture of the run by the browser's own
 * text renderer, the route a PDF takes (export-pdf-text-picture.ts). The vector walk
 * (svg-ir.ts) takes the picture's coverage and the writer paints the words through their
 * own shape in their ink, so the page under them shows through instead of a box.
 *
 * Only for a run that outlined with a missing glyph: a script with no fallback font, or a
 * Chinese, Japanese or Korean character outside the national sets (docs/fallback-fonts.md).
 */
import type { TextPictureRequest, TextPictureResult } from '@lolly-tools/node-shell/svg-ir';
import { textPicture } from './export-pdf-text-picture.ts';

let measurer: CanvasRenderingContext2D | null | undefined;

/** The run's advance and line metrics, as the browser lays it out. */
function measure(run: TextPictureRequest): { advance: number; ascent: number; descent: number } | null {
  if (measurer === undefined) {
    try { measurer = document.createElement('canvas').getContext('2d'); } catch { measurer = null; }
  }
  if (!measurer) return null;
  measurer.font = `${run.fontStyle === 'italic' ? 'italic ' : ''}${run.fontWeight} ${run.fontSize}px ${run.fontFamily}`;
  measurer.direction = run.direction;
  if ('letterSpacing' in measurer) measurer.letterSpacing = run.letterSpacing && run.letterSpacing !== 'normal' ? run.letterSpacing : '0px';
  const m = measurer.measureText(run.text);
  return { advance: m.width, ascent: m.fontBoundingBoxAscent ?? run.fontSize, descent: m.fontBoundingBoxDescent ?? run.fontSize * 0.3 };
}

/** A picture of `run` as coverage values, placed from the start of its advance on its baseline. */
export async function pictureTextRun(run: TextPictureRequest): Promise<TextPictureResult | null> {
  const metrics = measure(run);
  if (!metrics || !(metrics.advance > 0)) return null;
  const { advance, ascent, descent } = metrics;
  const pic = await textPicture({
    text: run.text, direction: run.direction, box: { w: advance, h: ascent + descent }, scale: run.scale, lang: run.lang ?? null,
    style: {
      'font-family': run.fontFamily, 'font-size': `${run.fontSize}px`, 'font-weight': run.fontWeight, 'font-style': run.fontStyle,
      'letter-spacing': run.letterSpacing ?? 'normal', color: '#000',
    },
  });
  if (!pic) return null;
  const img = new Image();
  img.src = pic.src;
  try { await img.decode(); } catch { return null; }
  const pxW = img.naturalWidth, pxH = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const g = canvas.getContext('2d');
  if (!g || !pxW || !pxH) return null;
  g.drawImage(img, 0, 0);
  const rgba = g.getImageData(0, 0, pxW, pxH).data;
  const alpha = new Uint8Array(pxW * pxH);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]!;
  return { alpha, pxW, pxH, left: -pic.pad, top: -ascent - pic.pad, width: pic.w + 2 * pic.pad, height: pic.h + 2 * pic.pad, advance };
}
