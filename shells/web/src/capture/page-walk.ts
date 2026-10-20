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
 *   - Fonts. The walk lays text out as it always does, but a stand-in shaper
 *     records each run and returns a measured box: outlining needs the font
 *     files and HarfBuzz, and WebAssembly is exactly what a strict page CSP
 *     refuses. The shell outlines the runs from the faces the page loaded
 *     (packages/node-shell/src/page-text.ts), and a run it cannot outline keeps
 *     a `<text>` element.
 */
import { renderSvgFromHtml } from '../bridge/export-svg-walker.ts';
import { setExportHost } from '../bridge/export-shared.ts';
import type { WebHost } from '../bridge/export-shared.ts';
import { FONT_KEY, type FontKey } from './page-walk-fonts.ts';

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
  stats: { drawables: number; images: number; culled: number; regions: number };
  /** The text runs, each a path tagged `data-lolly-text="<id>"`, and the faces the
   *  page loaded, for the shell to outline the runs from. */
  text: { runs: TextRun[]; fonts: PageFonts };
}

/** One line of text the walker would have outlined, with what the walker asked the shaper for. */
export interface TextRun extends FontKey {
  id: number;
  text: string;
  fontSize: number;
  letterSpacing: number;
  features: string[];
}

/** The page's faces: what `document.fonts` loaded, where readable `@font-face`
 *  rules point, and the stylesheets the page would not let the walk read. */
export interface PageFonts {
  loaded: Array<{ family: string; weight: string; style: string; unicodeRange: string }>;
  rules: Array<{ family: string; weight: string; style: string; unicodeRange: string; urls: string[] }>;
  sheets: string[];
}

const NS = 'http://www.w3.org/2000/svg';
/** The href prefix of a region placeholder: `lolly-region:x,y,width,height`, viewport CSS px. */
export const REGION = 'lolly-region:';
const n4 = (v: number): number => Math.round(v * 1e4) / 1e4;
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
  const runs: TextRun[] = [];
  // The walker reports through the export host's log, and shapes text through its
  // `text` - here the stand-in that records the run (see deferredShaper).
  setExportHost({
    log: (level: string, msg: string) => { if (level !== 'info') warnings.push(String(msg)); },
    text: deferredShaper(runs),
  } as unknown as WebHost);

  const root = document.documentElement;
  const rootRect = root.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const w0 = opts.window ?? { x: 0, y: 0, width: vw, height: vh };
  // Viewport coords → the walker's space, whose origin is the root's border-box corner.
  const win = { x: w0.x - rootRect.left, y: w0.y - rootRect.top, width: w0.width, height: w0.height };

  const blob = await renderSvgFromHtml(root, {
    format: 'svg',
    // Outlined, through the stand-in shaper: the walk places every line, the shell
    // draws the glyphs.
    convertPaths: true,
    // A page snapshot degrades locally: one unsupported effect rasterises that
    // element's own paint, never the page around that element.
    elementScopedRaster: true,
    // CSS paint order (Appendix E), not DOM order: pages lean on z-index.
    stackingOrder: true,
    backdropBlur: true,
    // What the walker cannot express or cannot read becomes a box the host fills
    // from its screenshot (see finishPageVector).
    regionImage: (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width >= 1 && r.height >= 1 ? `${REGION}${n4(r.left)},${n4(r.top)},${n4(r.width)},${n4(r.height)}` : null;
    },
  } as Parameters<typeof renderSvgFromHtml>[1]);
  let svg = await blob.text();

  // Paint the canvas colour first: the walker paints element backgrounds only, so
  // a page that sets its colour on the root (or body, propagated) would otherwise
  // come out transparent.
  const bg = canvasBackground();
  svg = svg.replace(/(<svg\b[^>]*>)/, `$1<rect x="${win.x}" y="${win.y}" width="${win.width}" height="${win.height}" fill="${bg}"/>`);

  const framed = windowSvg(svg, win, opts.cull === false ? Infinity : (opts.cullMargin ?? 64));
  const out = new DOMParser().parseFromString(framed.svg, 'image/svg+xml').documentElement;
  // Name each run's path, so the shell can find it after culling and re-serialising.
  for (const p of Array.from(out.getElementsByTagNameNS(NS, 'path'))) {
    const m = RUN_TAG.exec(p.getAttribute('d') || '');
    if (m) p.setAttribute('data-lolly-text', String(Number(m[1])));
  }
  const tagged = new XMLSerializer().serializeToString(out);
  const unresolved = new Set<string>();
  let regions = 0;
  for (const im of Array.from(out.getElementsByTagNameNS(NS, 'image'))) {
    const href = im.getAttribute('href') || im.getAttribute('xlink:href') || '';
    if (/^https?:/i.test(href)) unresolved.add(href);
    else if (href.startsWith(REGION)) regions++;
  }
  return {
    svg: tagged,
    width: win.width,
    height: win.height,
    ms: Math.round(performance.now() - t0),
    warnings,
    unresolved: [...unresolved],
    stats: {
      drawables: out.querySelectorAll(DRAWABLE).length,
      images: out.getElementsByTagNameNS(NS, 'image').length,
      culled: framed.culled,
      regions,
    },
    text: { runs, fonts: pageFonts() },
  };
}

// A run's stand-in path is its measured box, then a moveto that carries the run id
// in its sixth decimal: inside the box, so culling measures the box alone.
const RUN_TAG = /ZM0 0\.(\d{6})$/;

/**
 * The text shaper the walk runs with: it records the run and answers with the box
 * the run occupies, measured with the page's own font. The walker positions the box
 * by its baseline exactly as it would a real outline, so the shell only has to
 * swap the path data.
 */
function deferredShaper(runs: TextRun[]): { toPath(o: { text: string; fontUrl: string; fontSize: number; letterSpacing?: number; features?: string[] }): Promise<{ d: string; notdef: number; advanceWidth: number; bbox: null }> } {
  const ctx = document.createElement('canvas').getContext('2d')!;
  return {
    async toPath(o) {
      const key = keyOf(o.fontUrl);
      const id = runs.length;
      const letterSpacing = Number.isFinite(o.letterSpacing) ? o.letterSpacing! : 0;
      runs.push({ id, text: o.text, fontSize: o.fontSize, letterSpacing, features: o.features ?? [], ...key });
      ctx.font = `${key.style} ${key.weight} ${o.fontSize}px ${key.family || 'sans-serif'}`;
      const m = ctx.measureText(o.text);
      const w = n4(m.width + letterSpacing * [...o.text].length);
      const asc = n4(m.fontBoundingBoxAscent ?? o.fontSize * 0.8);
      const desc = n4(m.fontBoundingBoxDescent ?? o.fontSize * 0.2);
      return { d: `M0 ${-asc}H${w}V${desc}H0ZM0 0.${String(id).padStart(6, '0')}`, notdef: 0, advanceWidth: w, bbox: null };
    },
  };
}

function keyOf(fontUrl: string): FontKey {
  try { return JSON.parse(decodeURIComponent(fontUrl.slice(FONT_KEY.length))) as FontKey; }
  catch { return { family: '', weight: '400', style: 'normal', stretch: 'normal' }; }
}

const unquote = (s: string): string => s.trim().replace(/^["']|["']$/g, '');
/** `U+0-10FFFF` is how a FontFace says "everything"; a rule says it by omission. */
const rangeOf = (r: string): string => (/^u\+0+-10ffff$/i.test(r.trim()) ? '' : r.trim());

/** The faces the page loaded, and every `@font-face` the walk can read. */
function pageFonts(): PageFonts {
  const loaded: PageFonts['loaded'] = [];
  for (const f of document.fonts as unknown as Iterable<FontFace>) {
    if (f.status === 'loaded') loaded.push({ family: unquote(f.family), weight: f.weight, style: f.style, unicodeRange: rangeOf(f.unicodeRange) });
  }
  const rules: PageFonts['rules'] = [];
  const sheets: string[] = [];
  const readRules = (list: CSSRuleList, base: string): void => {
    for (const r of Array.from(list)) {
      if (r instanceof CSSFontFaceRule) {
        const urls: string[] = [];
        for (const u of r.style.getPropertyValue('src').matchAll(/url\(\s*(["']?)([^)"']+)\1\s*\)/g)) {
          try { urls.push(new URL(u[2]!.trim(), base).href); } catch { /* skipped */ }
        }
        if (urls.length) {
          rules.push({
            family: unquote(r.style.getPropertyValue('font-family')),
            weight: r.style.getPropertyValue('font-weight') || '400',
            style: r.style.getPropertyValue('font-style') || 'normal',
            unicodeRange: rangeOf(r.style.getPropertyValue('unicode-range')),
            urls,
          });
        }
      } else if (r instanceof CSSImportRule) {
        if (r.styleSheet) readSheet(r.styleSheet);
      } else if ('cssRules' in r) {
        readRules((r as CSSGroupingRule).cssRules, base);
      }
    }
  };
  const readSheet = (sheet: CSSStyleSheet): void => {
    let list: CSSRuleList;
    try { list = sheet.cssRules; } catch { if (sheet.href) sheets.push(sheet.href); return; }
    readRules(list, sheet.href || location.href);
  };
  for (const s of Array.from(document.styleSheets)) readSheet(s);
  for (const s of document.adoptedStyleSheets ?? []) readSheet(s);
  return { loaded, rules, sheets };
}

export interface FinishOpts {
  svg: string;
  /** A PNG screenshot of the viewport at the moment of the walk, base64. */
  shot: string;
  /** Screenshot pixels per CSS px (the capture's device scale). */
  scale: number;
  /** Also score the finished SVG against the screenshot (see vectorDistance). */
  score?: boolean;
}

export interface FinishResult {
  svg: string;
  /** Regions filled from the screenshot, and regions dropped (nothing on screen). */
  filled: number;
  dropped: number;
  /** Share of coarse cells that differ from the screenshot, when asked for. */
  distance?: number;
}

/**
 * Fill the page walk's region placeholders from the screenshot, then optionally
 * score the result. Runs wherever there is a DOM and a canvas the host controls:
 * the CLI's blank scratch page, or the Lolly app itself on desktop and web. Never
 * in the captured page, whose Content-Security-Policy may refuse data: images.
 */
export async function finishPageVector(o: FinishOpts): Promise<FinishResult> {
  const shot = await loadImage(`data:image/png;base64,${o.shot}`);
  const sw = shot.naturalWidth / o.scale, sh = shot.naturalHeight / o.scale;
  const doc = new DOMParser().parseFromString(o.svg, 'image/svg+xml');
  let filled = 0, dropped = 0;
  for (const im of Array.from(doc.getElementsByTagNameNS(NS, 'image'))) {
    const href = im.getAttribute('href') || '';
    if (!href.startsWith(REGION)) continue;
    const [rx, ry, rw, rh] = href.slice(REGION.length).split(',').map(Number) as [number, number, number, number];
    // Clamp to what the screenshot holds, and move the image box by the same amount.
    const x0 = Math.max(0, rx), y0 = Math.max(0, ry);
    const x1 = Math.min(sw, rx + rw), y1 = Math.min(sh, ry + rh);
    if (!(x1 - x0 >= 0.5 && y1 - y0 >= 0.5)) { im.remove(); dropped++; continue; }
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((x1 - x0) * o.scale));
    c.height = Math.max(1, Math.round((y1 - y0) * o.scale));
    c.getContext('2d')!.drawImage(shot, x0 * o.scale, y0 * o.scale, (x1 - x0) * o.scale, (y1 - y0) * o.scale, 0, 0, c.width, c.height);
    const ix = Number(im.getAttribute('x')) || 0, iy = Number(im.getAttribute('y')) || 0;
    im.setAttribute('x', String(n4(ix + (x0 - rx)))); im.setAttribute('y', String(n4(iy + (y0 - ry))));
    im.setAttribute('width', String(n4(x1 - x0))); im.setAttribute('height', String(n4(y1 - y0)));
    im.setAttribute('href', c.toDataURL('image/png'));
    filled++;
  }
  const svg = new XMLSerializer().serializeToString(doc);
  return { svg, filled, dropped, ...(o.score ? { distance: await vectorDistance(svg, shot) } : {}) };
}

/**
 * How far a vector capture is from the screenshot of the same moment, in [0,1]:
 * the share of 8-px cells whose mean colour differs once both are reduced.
 *
 * Coarse on purpose. Text a host could not outline stays `<text>` in whatever face
 * the viewer has, so glyph shapes differ from the screenshot by design and a fine
 * per-pixel score would fail every text-heavy page. Averaged cells keep what the
 * check is for - a missing panel, a wrong backdrop, a layer over the content.
 */
export async function vectorDistance(svg: string, shot: HTMLImageElement): Promise<number> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const pic = await loadImage(url);
    const CELL = 8;
    const vbw = shot.naturalWidth, vbh = shot.naturalHeight;
    const cw = Math.max(1, Math.round(vbw / CELL)), ch = Math.max(1, Math.round(vbh / CELL));
    const cells = (im: HTMLImageElement): Uint8ClampedArray => {
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const x = c.getContext('2d')!;
      x.imageSmoothingEnabled = true;
      x.imageSmoothingQuality = 'high';
      x.fillStyle = '#fff';
      x.fillRect(0, 0, cw, ch);
      x.drawImage(im, 0, 0, cw, ch);
      return x.getImageData(0, 0, cw, ch).data;
    };
    const A = cells(shot), B = cells(pic);
    let bad = 0;
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.abs(A[i]! - B[i]!) + Math.abs(A[i + 1]! - B[i + 1]!) + Math.abs(A[i + 2]! - B[i + 2]!);
      if (d > 60) bad++;
    }
    return bad / (cw * ch);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => fail(new Error('An image in the capture did not decode.'));
    im.src = src;
  });
}

const g = globalThis as unknown as { __lollyPageWalk?: typeof pageWalk; __lollyFinishPageVector?: typeof finishPageVector };
g.__lollyPageWalk = pageWalk;
g.__lollyFinishPageVector = finishPageVector;
