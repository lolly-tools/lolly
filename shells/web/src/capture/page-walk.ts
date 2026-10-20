// SPDX-License-Identifier: MPL-2.0
/**
 * The page walk: the export walker (`renderSvgFromHtml`) run INSIDE a captured
 * third-party page, so url-shot's vector capture comes from the live layout as
 * geometry instead of from a print.
 *
 * Why not the print path: Chromium's PDF backend rasterises every CSS `filter`,
 * a blurred box-shadow or text-shadow, `mask-image`, `backdrop-filter` and the
 * blend modes PDF has no operator for, and a print re-lays the page out (print
 * media, `vh` measured against the paper, shrink-to-fit). Modern pages use those
 * effects everywhere, so a printed capture of github.com came out as one bitmap
 * covering the whole frame. The walker emits the same effects as SVG filters,
 * masks and blend modes over real shapes, from the layout the person sees.
 *
 * This file is the entry of a standalone script (see
 * `packages/node-shell/src/page-walk-bundle.ts`), injected into the page by the
 * shell doing the capture and called as `globalThis.__lollyPageWalk(opts)`. It
 * imports nothing that touches the app: no font registry (the build replaces it
 * with `page-walk-fonts.ts`), no catalog, no storage.
 *
 * What it does not do, and leaves to the shell:
 *   - Bytes it cannot read. A cross-origin image without CORS cannot be fetched
 *     from the page, so its `href` stays the absolute URL. The shell swaps those
 *     for data URLs from the tab's own resource cache (CDP
 *     `Page.getResourceContent`), which has no CORS restriction.
 *   - Fonts. Text stays `<text>` with the page's font stack; outlining it needs
 *     the font files and a shaper, which belong to the host.
 */
import { renderSvgFromHtml } from '../bridge/export-svg-walker.ts';
import { setExportHost } from '../bridge/export-shared.ts';
import type { WebHost } from '../bridge/export-shared.ts';

export interface PageWalkOpts {
  /** The region to keep, in CSS px of the VIEWPORT (0,0 is the visible top-left).
   *  Defaults to the whole viewport. */
  window?: { x: number; y: number; width: number; height: number };
  /** Extra CSS px kept around the window when culling, so a blur or shadow whose
   *  shape sits just outside still paints its spill inside. */
  cullMargin?: number;
  /** Drop drawables outside the window (default true). Off only for diagnosis. */
  cull?: boolean;
}

export interface PageWalkResult {
  svg: string;
  /** Output size in CSS px (the window). */
  width: number;
  height: number;
  ms: number;
  warnings: string[];
  /** Absolute URLs the walk could not inline (cross-origin, no CORS). */
  unresolved: string[];
  stats: { drawables: number; images: number; culled: number };
}

const NS = 'http://www.w3.org/2000/svg';
const DRAWABLE = 'path,rect,circle,ellipse,line,polyline,polygon,text,image,use,svg,foreignObject';
const DEFINITION = 'defs,clipPath,mask,pattern,symbol,filter,marker,linearGradient,radialGradient,style';

/** The colour the browser paints behind everything: the root's background, or
 *  body's when the root has none (CSS 2.1 section 14.2), else white. */
function canvasBackground(): string {
  const clear = (c: string): boolean => !c || c === 'transparent' || /^rgba\([^)]*,\s*0\)$/.test(c);
  const html = getComputedStyle(document.documentElement).backgroundColor;
  if (!clear(html)) return html;
  const body = document.body ? getComputedStyle(document.body).backgroundColor : '';
  return clear(body) ? '#ffffff' : body;
}

/**
 * Drop every drawable that cannot paint inside the window, then frame the root.
 * Measured on a mounted copy inside a closed shadow root, so the page's own CSS
 * cannot restyle the SVG while it is measured.
 */
function windowSvg(svgText: string, win: { x: number; y: number; width: number; height: number }, margin: number): { svg: string; culled: number } {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = doc.documentElement as unknown as SVGSVGElement;
  if (root.querySelector('parsererror')) throw new Error('The page walk produced SVG that does not parse.');
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
  const shadow = host.attachShadow({ mode: 'closed' });
  const live = document.importNode(root, true) as unknown as SVGSVGElement;
  shadow.appendChild(live);
  document.documentElement.appendChild(host);
  let culled = 0;
  try {
    const box = live.getBoundingClientRect();
    const vb = (live.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    const sx = vb.length === 4 && vb[2]! > 0 && box.width > 0 ? vb[2]! / box.width : 1;
    const sy = vb.length === 4 && vb[3]! > 0 && box.height > 0 ? vb[3]! / box.height : 1;
    const x0 = win.x - margin, y0 = win.y - margin, x1 = win.x + win.width + margin, y1 = win.y + win.height + margin;
    const outside = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 || r.height > 0)) return false;   // unmeasurable: keep
      const ex0 = (r.left - box.left) * sx + (vb[0] ?? 0), ey0 = (r.top - box.top) * sy + (vb[1] ?? 0);
      const ex1 = ex0 + r.width * sx, ey1 = ey0 + r.height * sy;
      return ex1 < x0 || ey1 < y0 || ex0 > x1 || ey0 > y1;
    };
    const visit = (parent: Element): void => {
      for (const el of Array.from(parent.children)) {
        if (el.matches(DEFINITION)) continue;
        if (el.tagName === 'g' || el.tagName === 'a') {
          if (outside(el)) { el.remove(); culled++; continue; }
          visit(el);
        } else if (el.matches(DRAWABLE) && outside(el)) { el.remove(); culled++; }
      }
    };
    visit(live);
  } finally {
    host.remove();
  }
  // Re-serialise the culled live copy, framed to the window.
  live.setAttribute('viewBox', `${win.x} ${win.y} ${win.width} ${win.height}`);
  live.setAttribute('width', String(win.width));
  live.setAttribute('height', String(win.height));
  return { svg: new XMLSerializer().serializeToString(live), culled };
}

export async function pageWalk(opts: PageWalkOpts = {}): Promise<PageWalkResult> {
  const t0 = performance.now();
  const warnings: string[] = [];
  // The walker reports through the export host's log. Nothing else on the host is
  // read here: `text` is absent, so text stays <text> and no font is fetched.
  setExportHost({ log: (level: string, msg: string) => { if (level !== 'info') warnings.push(String(msg)); } } as unknown as WebHost);

  const root = document.documentElement;
  const rootRect = root.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const w0 = opts.window ?? { x: 0, y: 0, width: vw, height: vh };
  // Viewport coords → the walker's space, whose origin is the root's border-box corner.
  const win = { x: w0.x - rootRect.left, y: w0.y - rootRect.top, width: w0.width, height: w0.height };

  const blob = await renderSvgFromHtml(root, {
    format: 'svg',
    convertPaths: false,
    // A page snapshot degrades locally: one unsupported effect rasterises that
    // element's own paint, never the page around that element.
    elementScopedRaster: true,
    // CSS paint order (Appendix E), not DOM order: pages lean on z-index.
    stackingOrder: true,
    backdropBlur: true,
  } as Parameters<typeof renderSvgFromHtml>[1]);
  let svg = await blob.text();

  // Paint the canvas colour first: the walker paints element backgrounds only, so
  // a page that sets its colour on the root (or body, propagated) would otherwise
  // come out transparent.
  const bg = canvasBackground();
  svg = svg.replace(/(<svg\b[^>]*>)/, `$1<rect x="${win.x}" y="${win.y}" width="${win.width}" height="${win.height}" fill="${bg}"/>`);

  const framed = windowSvg(svg, win, opts.cull === false ? Infinity : (opts.cullMargin ?? 64));
  const out = new DOMParser().parseFromString(framed.svg, 'image/svg+xml').documentElement;
  const unresolved = new Set<string>();
  for (const im of Array.from(out.getElementsByTagNameNS(NS, 'image'))) {
    const href = im.getAttribute('href') || im.getAttribute('xlink:href') || '';
    if (/^https?:/i.test(href)) unresolved.add(href);
  }
  return {
    svg: framed.svg,
    width: win.width,
    height: win.height,
    ms: Math.round(performance.now() - t0),
    warnings,
    unresolved: [...unresolved],
    stats: {
      drawables: out.querySelectorAll(DRAWABLE).length,
      images: out.getElementsByTagNameNS(NS, 'image').length,
      culled: framed.culled,
    },
  };
}

(globalThis as unknown as { __lollyPageWalk?: typeof pageWalk }).__lollyPageWalk = pageWalk;
