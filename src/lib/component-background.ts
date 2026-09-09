// SPDX-License-Identifier: MPL-2.0
/** Component capture shares the real exporter's CSS paint lowering. */
import { splitCssArgs, parseConicGradient } from '../../../../engine/src/css-paint.ts';
import { svgToPenpotDoc } from '../../../../engine/src/penpot-file.ts';
import type { PenpotIrShape } from '../../../../engine/src/penpot-file.ts';
import { buildLinearGradientEl, buildRadialGradientEl, conicFanEl } from '../bridge/export-gradients.ts';

export function componentBackground(image: string, box: { x: number; y: number; w: number; h: number }, radius: number | [number, number, number, number]): PenpotIrShape[] | null {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('width', String(box.x + box.w));
  svg.setAttribute('height', String(box.y + box.h));
  const defs = document.createElementNS(ns, 'defs');
  svg.append(defs);
  // CSS lists the topmost paint first. SVG and Penpot paint bottom to top.
  const layers = splitCssArgs(image).reverse();
  for (const [i, layer] of layers.entries()) {
    const gradient = buildLinearGradientEl(ns, layer, box.x, box.y, box.w, box.h, i)
      || buildRadialGradientEl(ns, layer, box.x, box.y, box.w, box.h, i);
    if (gradient) {
      defs.append(gradient);
      const rect = document.createElementNS(ns, 'rect');
      for (const [key, value] of Object.entries({ x: box.x, y: box.y, width: box.w, height: box.h })) rect.setAttribute(key, String(value));
      rect.setAttribute('fill', `url(#svggrad-${i})`);
      svg.append(rect);
    } else {
      const conic = parseConicGradient(layer, box.w, box.h);
      const fan = conic && conicFanEl(ns, conic, box.x, box.y, box.w, box.h, i);
      if (!fan) return null;
      svg.append(fan);
    }
  }
  const result = svgToPenpotDoc(new XMLSerializer().serializeToString(svg), { name: 'CSS background' });
  const board = result?.doc.pages[0]?.shapes[0];
  if (!board || !('children' in board) || result?.pending.length) return null;
  return [{ type: 'group', name: 'Background paints', ...box, masked: true, children: [
    { type: 'rect', name: 'Background boundary', ...box, radius, fills: [{ color: '#ffffff' }] },
    ...board.children,
  ] }];
}
