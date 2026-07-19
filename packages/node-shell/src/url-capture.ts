// SPDX-License-Identifier: MPL-2.0
/**
 * url-shot capture — shared by the CLI and the TUI (one implementation, no drift).
 *
 * Drive the scoped Chromium straight at the target URL and
 * produce the final bytes — bypassing the engine's DOM export path (which can't
 * rasterise). This is the one tool whose whole job is "screenshot a live page", so a
 * direct capture is both simpler and strictly more capable than the composite-into-an-
 * <img> dance the web/desktop shells use.
 *
 * Formats:
 *   • png / jpg   — a real screenshot of the viewport, honouring crop + scroll + recolor.
 *   • pdf         — a TRUE vector print of the page via Chromium's page.pdf() (selectable
 *                   text, crisp at any zoom), not a screenshot embedded as an image.
 *   • svg         — the high-DPI screenshot wrapped in a scalable <svg><image>. (Element-
 *                   level vectorisation of an arbitrary page isn't a browser primitive;
 *                   this is a faithful, resolution-independent container.)
 *
 * Extras beyond a plain shot: crop insets (left/right/top/bottom), a recolor pass
 * (filter presets + optional tint), custom CSS, scroll depth, and a settle delay.
 */
import { getBrowser, BrowserError } from './browsers.ts';

export interface CaptureParams {
  url: string;
  scrollDepth: number;   // 0..1 fraction of scrollable height (or px when > 1)
  waitMs: number;        // settle delay after load + scroll
  css: string;           // custom CSS injected before the shot
  cropLeft: number;      // crop insets as 0..0.9 fractions of the viewport
  cropRight: number;
  cropTop: number;
  cropBottom: number;
  recolor: string;       // none | invert | grayscale | sepia | hue | tint
  tintColor: string;     // colour for the 'tint' recolor
  hue: number;           // degrees for the 'hue' recolor
  zoom: number;          // browser zoom level (1 = 100%); magnifies before the shot
  /**
   * Optional page-init script run BEFORE the target page's own scripts, on every
   * navigation (Playwright addInitScript). The end-user url-shot tool never sets
   * this — it exists only so the docs-shots pipeline can seed localStorage (e.g.
   * dismiss the first-run welcome) so a gallery-route capture isn't occluded.
   */
  initScript?: string;
}

export interface CaptureDims { width: number; height: number; dpi: number }

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(0.9, Math.max(0, n)) : 0);

/** CSS for the recolor pass — a filter on <html>, plus a tint overlay when asked. */
function recolorCss(p: CaptureParams): string {
  switch (p.recolor) {
    case 'invert':    return 'html{filter:invert(1) hue-rotate(180deg)!important}';
    case 'grayscale': return 'html{filter:grayscale(1)!important}';
    case 'sepia':     return 'html{filter:sepia(0.9)!important}';
    case 'hue':       return `html{filter:hue-rotate(${Math.round(p.hue) || 0}deg)!important}`;
    case 'tint':      return `html{filter:grayscale(1) contrast(1.05)!important}`;
    default:          return '';
  }
}

/**
 * Capture `params.url` to `format` at `dims`. Returns the encoded bytes + mime.
 * Throws BrowserError with an actionable message when Chromium isn't installed.
 */
export async function captureUrl(
  params: CaptureParams, format: string, dims: CaptureDims,
): Promise<{ bytes: Uint8Array; mime: string }> {
  const fmt = format.toLowerCase() === 'jpeg' ? 'jpg' : format.toLowerCase();
  if (!params.url) throw new BrowserError('Enter a URL to capture.');
  if (!['png', 'jpg', 'pdf', 'svg', 'webp'].includes(fmt)) {
    throw new BrowserError(`url-shot can't produce "${format}" — use png, jpg, pdf, or svg.`);
  }
  if (fmt === 'webp') {
    throw new BrowserError('WebP capture needs the desktop app — in the terminal use png, jpg, pdf, or svg.');
  }

  const width = Math.max(1, Math.round(dims.width || 1280));
  const height = Math.max(1, Math.round(dims.height || 720));
  const dpr = dims.dpi && dims.dpi > 96 ? dims.dpi / 96 : 1;

  const browser = await getBrowser();
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    serviceWorkers: 'block',
  });
  try {
    // Runs before the page's own scripts (docs pipeline uses it to pre-dismiss
    // the first-run welcome); no-op for the end-user tool, which never sets it.
    if (params.initScript) await ctx.addInitScript({ content: params.initScript });
    const page = await ctx.newPage();
    await page.goto(params.url, { waitUntil: 'load', timeout: 45_000 }).catch((e: Error) => {
      throw new BrowserError(`Couldn't load ${params.url}: ${e.message}`);
    });

    // Webfonts race the load event — a shot taken before they resolve bakes the
    // fallback face into the pixels. Settle them explicitly (cheap after load).
    await page
      .evaluate(() => (document.fonts?.ready ?? Promise.resolve()).then(() => undefined))
      .catch(() => {});

    // Browser zoom → a `zoom` on <html> (like Ctrl/Cmd +): magnifies the page so
    // even a bitmap shot is enlarged and crisp, not upscaled. scrollHeight reflows
    // with it, so the crop/scroll math below stays consistent.
    const zoom = Number.isFinite(params.zoom) && params.zoom > 0 ? params.zoom : 1;
    const zoomCss = Math.abs(zoom - 1) > 1e-3 ? `html{zoom:${zoom}!important}` : '';

    // Recolor + zoom + custom CSS, injected before the shot (userstyle-style, additive).
    const styles = [recolorCss(params), zoomCss, params.css || ''].filter(Boolean).join('\n');
    if (styles) await page.addStyleTag({ content: styles }).catch(() => {});

    // A 'tint' recolor lays a multiply overlay of the chosen colour over the page.
    if (params.recolor === 'tint' && params.tintColor) {
      await page.evaluate((color: string) => {
        const o = document.createElement('div');
        o.style.cssText = `position:fixed;inset:0;background:${color};mix-blend-mode:multiply;pointer-events:none;z-index:2147483647`;
        document.documentElement.appendChild(o);
      }, params.tintColor).catch(() => {});
    }

    // Scroll before capturing (fraction of scrollable height, or px when > 1).
    if (params.scrollDepth > 0) {
      await page.evaluate((d: number) => {
        const max = Math.max(0, document.body.scrollHeight - window.innerHeight);
        window.scrollTo(0, d > 1 ? d : d * max);
      }, params.scrollDepth).catch(() => {});
    }
    if (params.waitMs > 0) await page.waitForTimeout(Math.min(15_000, params.waitMs));

    // ── Vector PDF: a real print of the page, not an embedded screenshot ──
    if (fmt === 'pdf') {
      const pdf = await page.pdf({
        width: `${width}px`, height: `${height}px`,
        printBackground: true, pageRanges: '1', margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      return { bytes: new Uint8Array(pdf), mime: 'application/pdf' };
    }

    // ── Raster (png/jpg) or svg-wrapped raster: viewport shot, cropped ──
    const l = clamp01(params.cropLeft), r = clamp01(params.cropRight);
    const t = clamp01(params.cropTop), b = clamp01(params.cropBottom);
    const clipW = Math.max(1, Math.round(width * (1 - l - r)));
    const clipH = Math.max(1, Math.round(height * (1 - t - b)));
    const clip = { x: Math.round(width * l), y: Math.round(height * t), width: clipW, height: clipH };

    const shotType = fmt === 'jpg' ? 'jpeg' : 'png';
    const png = await page.screenshot({
      type: shotType as 'png' | 'jpeg',
      ...(shotType === 'jpeg' ? { quality: 97 } : {}),
      clip,
    });

    if (fmt === 'svg') {
      // Wrap the shot in a scalable SVG container (resolution-independent; the content
      // itself is the captured raster). viewBox is the cropped CSS-pixel box.
      const b64 = Buffer.from(png).toString('base64');
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${clipW}" height="${clipH}" ` +
        `viewBox="0 0 ${clipW} ${clipH}">` +
        `<image width="${clipW}" height="${clipH}" href="data:image/png;base64,${b64}"/></svg>`;
      return { bytes: new TextEncoder().encode(svg), mime: 'image/svg+xml' };
    }

    return { bytes: new Uint8Array(png), mime: fmt === 'jpg' ? 'image/jpeg' : 'image/png' };
  } finally {
    await ctx.close();
  }
}

/** Pull url-shot's capture params out of the runtime's current input model. */
export function captureParamsFrom(model: Array<{ id: string; value: unknown }>): CaptureParams {
  const v = Object.fromEntries(model.map(i => [i.id, i.value]));
  const num = (x: unknown, d: number): number => (Number.isFinite(Number(x)) ? Number(x) : d);
  const str = (x: unknown, d = ''): string => (typeof x === 'string' ? x : d);
  return {
    url: str(v.url).trim(),
    scrollDepth: num(v.scrollDepth, 0),
    waitMs: Math.max(0, num(v.waitMs, 500)),
    css: str(v.css),
    cropLeft: num(v.cropLeft, 0),
    cropRight: num(v.cropRight, 0),
    cropTop: num(v.cropTop, 0),
    cropBottom: num(v.cropBottom, 0),
    recolor: str(v.recolor, 'none'),
    // Neutral ink fallback — url-shot's manifest default is {color.semantic.primary},
    // resolved upstream into the input model; this literal only covers a missing value.
    tintColor: str(v.tintColor, '#111111'),
    hue: num(v.hue, 0),
    zoom: num(v.zoom, 1),
  };
}
