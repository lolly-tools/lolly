// SPDX-License-Identifier: MPL-2.0
/**
 * url-shot's vector capture over Playwright: walk the live page into SVG geometry
 * (the page-walk script), fill in the bytes the page could not hand over, and
 * check the result against a screenshot of the same moment before trusting the SVG.
 *
 * The CLI, TUI and MCP server share this through `captureUrl`. The desktop shell
 * and the Chrome extension run the same script over their own CDP transports.
 */
import type { Page } from 'playwright-core';
import { pageWalkScript } from './page-walk-bundle.ts';

export interface WalkWindow { x: number; y: number; width: number; height: number }

export interface PageVectorResult {
  svg: string;
  width: number;
  height: number;
  ms: number;
  warnings: string[];
  stats: { drawables: number; images: number; culled: number; resolved: number; unresolved: number };
}

interface WalkOut {
  svg: string; width: number; height: number; ms: number; warnings: string[]; unresolved: string[];
  stats: { drawables: number; images: number; culled: number };
}

/** How long a walk may take before the capture gives up and falls back. */
export const PAGE_WALK_BUDGET_MS = 60_000;

const xmlAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Walk the page as it is now. `win` is in viewport CSS px (default: the viewport).
 * Throws when the walk fails or overruns PAGE_WALK_BUDGET_MS; the caller falls back.
 */
export async function walkPageToSvg(page: Page, win?: WalkWindow): Promise<PageVectorResult> {
  const script = await pageWalkScript();
  // evaluate, not addScriptTag: a <script> element is subject to the page's
  // Content-Security-Policy, a DevTools evaluation is not.
  await page.evaluate(script);
  const run = page.evaluate(
    (w) => (globalThis as unknown as { __lollyPageWalk: (o: unknown) => Promise<unknown> }).__lollyPageWalk(w ? { window: w } : {}),
    win ?? null,
  ) as Promise<WalkOut>;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const out = await Promise.race([
    run,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`page walk took longer than ${PAGE_WALK_BUDGET_MS / 1000}s`)), PAGE_WALK_BUDGET_MS); }),
  ]).finally(() => clearTimeout(timer));

  const { svg, resolved, missing } = await resolveFromTabCache(page, out.svg, out.unresolved);
  return {
    svg,
    width: out.width,
    height: out.height,
    ms: out.ms,
    warnings: missing.length ? [...out.warnings, `${missing.length} image(s) could not be read from the page`] : out.warnings,
    stats: { ...out.stats, resolved, unresolved: missing.length },
  };
}

/**
 * Swap absolute image URLs for data URLs from the bytes the tab already loaded
 * (CDP Page.getResourceContent). That cache has no CORS restriction, needs no second
 * request, and is what the page actually showed. A URL the cache does not hold is
 * fetched through the context, which shares the page's cookies; one that still
 * fails keeps its URL and is reported.
 */
async function resolveFromTabCache(page: Page, svg: string, urls: string[]): Promise<{ svg: string; resolved: number; missing: string[] }> {
  if (!urls.length) return { svg, resolved: 0, missing: [] };
  const cdp = await page.context().newCDPSession(page);
  const where = new Map<string, { frameId: string; mimeType: string }>();
  try {
    const { frameTree } = await cdp.send('Page.getResourceTree') as { frameTree: FrameTree };
    const walk = (t: FrameTree): void => {
      for (const r of t.resources ?? []) where.set(r.url, { frameId: t.frame.id, mimeType: r.mimeType });
      where.set(t.frame.url, where.get(t.frame.url) ?? { frameId: t.frame.id, mimeType: t.frame.mimeType ?? 'text/html' });
      for (const c of t.childFrames ?? []) walk(c);
    };
    walk(frameTree);
    const mainFrame = frameTree.frame.id;
    let resolved = 0;
    const missing: string[] = [];
    for (const url of urls) {
      let data: string | null = null;
      const hit = where.get(url);
      try {
        const r = await cdp.send('Page.getResourceContent', { frameId: hit?.frameId ?? mainFrame, url }) as { content: string; base64Encoded: boolean };
        const mime = hit?.mimeType || sniffMime(r.content, r.base64Encoded);
        data = `data:${mime};base64,${r.base64Encoded ? r.content : Buffer.from(r.content, 'utf8').toString('base64')}`;
      } catch {
        try {
          const resp = await page.context().request.get(url, { timeout: 15_000 });
          if (resp.ok()) {
            const body = await resp.body();
            const mime = (resp.headers()['content-type'] || '').split(';')[0]!.trim() || sniffMime(body.toString('base64'), true);
            data = `data:${mime};base64,${body.toString('base64')}`;
          }
        } catch { /* reported below */ }
      }
      if (data && /^data:image\//.test(data)) {
        svg = svg.split(`href="${xmlAttr(url)}"`).join(`href="${data}"`);
        resolved++;
      } else {
        missing.push(url);
      }
    }
    return { svg, resolved, missing };
  } finally {
    await cdp.detach().catch(() => {});
  }
}

interface FrameTree {
  frame: { id: string; url: string; mimeType?: string };
  resources?: Array<{ url: string; mimeType: string }>;
  childFrames?: FrameTree[];
}

function sniffMime(content: string, base64: boolean): string {
  const head = base64 ? Buffer.from(content.slice(0, 64), 'base64') : Buffer.from(content.slice(0, 48), 'utf8');
  if (head[0] === 0x89 && head[1] === 0x50) return 'image/png';
  if (head[0] === 0xff && head[1] === 0xd8) return 'image/jpeg';
  if (head.toString('latin1', 0, 4) === 'GIF8') return 'image/gif';
  if (head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (head.toString('latin1', 4, 12).includes('ftypavif')) return 'image/avif';
  if (/<svg|<\?xml/i.test(head.toString('utf8'))) return 'image/svg+xml';
  return 'application/octet-stream';
}

/**
 * How far a vector capture is from a screenshot of the same moment, in [0,1]:
 * the share of cells that differ once both images are reduced to a coarse grid.
 *
 * Coarse on purpose. Text in the SVG stays `<text>` and renders in whatever face
 * the viewer has, so glyph shapes differ from the screenshot by design; a fine
 * per-pixel score would read that as failure on every text-heavy page. Averaging
 * over cells keeps what the check is for - a missing panel, a wrong backdrop, a
 * layer painted over the content - and lets glyph-level differences wash out.
 */
export async function vectorShotDistance(page: Page, svg: string, shotPng: Uint8Array, width: number, height: number): Promise<number> {
  const scratch = await page.context().newPage();
  try {
    await scratch.setViewportSize({ width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) });
    return await scratch.evaluate(async ({ svg, png, w, h }) => {
      const load = (src: string): Promise<HTMLImageElement> => new Promise((ok, fail) => {
        const im = new Image();
        im.onload = () => ok(im);
        im.onerror = () => fail(new Error('image did not decode'));
        im.src = src;
      });
      const toBlobUrl = (bytes: string, type: string): string => URL.createObjectURL(new Blob([bytes], { type }));
      const pngBytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
      const [a, b] = await Promise.all([
        load(URL.createObjectURL(new Blob([pngBytes], { type: 'image/png' }))),
        load(toBlobUrl(svg, 'image/svg+xml')),
      ]);
      const CELL = 8;
      const cw = Math.max(1, Math.round(w / CELL)), ch = Math.max(1, Math.round(h / CELL));
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
      const A = cells(a), B = cells(b);
      let bad = 0;
      for (let i = 0; i < A.length; i += 4) {
        const d = Math.abs(A[i]! - B[i]!) + Math.abs(A[i + 1]! - B[i + 1]!) + Math.abs(A[i + 2]! - B[i + 2]!);
        if (d > 60) bad++;
      }
      return bad / (cw * ch);
    }, { svg, png: Buffer.from(shotPng).toString('base64'), w: width, h: height });
  } finally {
    await scratch.close().catch(() => {});
  }
}
