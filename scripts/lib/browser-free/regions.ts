// SPDX-License-Identifier: MPL-2.0
/**
 * Geometry only: the boxes of the elements in the SVG resvg was handed, laid out at the
 * output size and placement in Chromium and read with getBoundingClientRect. No pixels
 * from this step are compared. Used by `scripts/tool-browser-free.ts`.
 */
import { writeFileSync } from 'node:fs';
import { placeSvg, type SvgPlacement } from '../../../packages/node-shell/src/resvg-admission.ts';

export interface Region {
  tag: string;
  /** The words of an outlined or live text run, or null for a shape. */
  text: string | null;
  x: number; y: number; w: number; h: number;
  stroked: boolean;
  /** `linearGradient` or `radialGradient` when the fill is one. */
  grad: string | null;
  rotated: boolean;
  /** One id per parent element, so small marks cluster per parent. */
  parent: number;
}

/** Runs in the page: every drawn leaf element's box. */
function inPage(): Region[] {
  const SKIP = new Set(['defs', 'clipPath', 'mask', 'pattern', 'symbol', 'marker', 'filter', 'linearGradient', 'radialGradient', 'title', 'desc', 'metadata', 'style', 'script', 'foreignObject']);
  const LEAF = new Set(['rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline', 'line', 'image', 'use', 'text']);
  const items: Region[] = [];
  const ids = new Map<Element, number>();
  const walk = (el: Element): void => {
    for (const child of Array.from(el.children)) {
      const tag = child.localName;
      if (SKIP.has(tag)) continue;
      const cs = getComputedStyle(child);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (!LEAF.has(tag)) { walk(child); continue; }
      const r = child.getBoundingClientRect();
      if (r.width <= 0 && r.height <= 0) continue;
      const ref = /url\(["']?#([^"')]+)/.exec(cs.fill || '');
      const g = ref ? document.getElementById(ref[1]!) : null;
      const m = (child as SVGGraphicsElement).getCTM ? (child as SVGGraphicsElement).getCTM() : null;
      if (!ids.has(el)) ids.set(el, ids.size);
      const tagged = child.getAttribute('data-measure-text');
      items.push({
        tag, text: tag === 'text' || tagged !== null ? (tagged ?? child.textContent ?? '').slice(0, 40) : null,
        x: r.x, y: r.y, w: r.width, h: r.height,
        stroked: !!cs.stroke && cs.stroke !== 'none' && Number.parseFloat(cs.strokeWidth) > 0,
        grad: g ? g.localName : null,
        rotated: !!m && (Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6),
        parent: ids.get(el)!,
      });
    }
  };
  walk(document.documentElement);
  return items;
}

/** The regions of one SVG at `width` x `height` with the route's placement. */
export async function layoutRegions(page: import('playwright-core').Page, svg: string, width: number, height: number, placement: SvgPlacement, scratch: string): Promise<Region[]> {
  writeFileSync(scratch, placeSvg(svg, width, height, placement));
  await page.setViewportSize({ width: Math.min(width, 4000), height: Math.min(height, 4000) });
  await page.goto(`file://${scratch}`, { waitUntil: 'load', timeout: 120_000 });
  return page.evaluate(inPage);
}
