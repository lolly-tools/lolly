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
import { outlinePageText, type PageTextFonts, type PageTextResult, type PageTextRun } from './page-text.ts';
import { createNodeTextAPI } from './text.ts';
import { repoRoot } from './repo-root.ts';

export interface WalkWindow { x: number; y: number; width: number; height: number }

export interface VectorShot {
  svg: string;
  /** Output size in CSS px (the window). */
  width: number;
  height: number;
  /** Share of coarse cells that differ from the screenshot, in [0,1]. */
  distance: number;
  ms: number;
  warnings: string[];
  stats: {
    drawables: number; images: number; culled: number;
    /** Images read from the tab's cache, and images that stayed unreadable. */
    resolved: number; unresolved: number;
    /** Boxes filled from the screenshot, and boxes with nothing on screen. */
    regions: number; dropped: number;
    /** Text runs drawn as outlines, and runs kept as `<text>`. */
    outlined: number; textKept: number;
  };
}

interface WalkOut {
  svg: string; width: number; height: number; ms: number; warnings: string[]; unresolved: string[];
  stats: { drawables: number; images: number; culled: number; regions: number };
  text: { runs: PageTextRun[]; fonts: PageTextFonts };
}

/** How long a walk may take before the capture gives up and falls back. */
export const PAGE_WALK_BUDGET_MS = 60_000;

const xmlAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Capture the page as it is now, as vector. `win` is the region to keep in viewport
 * CSS px (default: the viewport); `scale` is the context's device scale, the size of
 * the screenshot pixels the region boxes are filled from.
 *
 * Throws when the walk fails or overruns PAGE_WALK_BUDGET_MS; the caller falls back.
 * The caller decides what `distance` is acceptable.
 */
export async function captureVectorShot(page: Page, opts: { window?: WalkWindow; scale?: number; publicOnly?: boolean } = {}): Promise<VectorShot> {
  const t0 = Date.now();
  const script = await pageWalkScript();
  // Stop CSS animations and transitions where they are, so the screenshot and the
  // walk read the same frame. Script-driven motion keeps running; the score catches that motion.
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Animation.enable').catch(() => {});
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 }).catch(() => {});
  } finally { await cdp.detach().catch(() => {}); }
  const shot = await page.screenshot({ type: 'png' });

  // evaluate, not addScriptTag: a <script> element is subject to the page's
  // Content-Security-Policy, a DevTools evaluation is not.
  await page.evaluate(script);
  const run = page.evaluate(
    (w) => (globalThis as unknown as { __lollyPageWalk: (o: unknown) => Promise<unknown> }).__lollyPageWalk(w ? { window: w } : {}),
    opts.window ?? null,
  ) as Promise<WalkOut>;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const out = await Promise.race([
    run,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`page walk took longer than ${PAGE_WALK_BUDGET_MS / 1000}s`)), PAGE_WALK_BUDGET_MS); }),
  ]).finally(() => clearTimeout(timer));

  const res = await tabResources(page, { cacheOnly: opts.publicOnly === true });
  let withImages: string, resolved: number, missing: string[], text: PageTextResult;
  try {
    ({ svg: withImages, resolved, missing } = await inlineImages(res, out.svg, out.unresolved));
    // Outline the text from the faces the page loaded (page-text.ts), shaped in Node.
    const shaper = createNodeTextAPI({ repoRoot: repoRoot() });
    text = await outlinePageText(withImages, out.text.runs, out.text.fonts, {
      fontBytes: async (url) => (await res.read(url))?.bytes ?? null,
      sheetText: async (url) => { const r = await res.read(url); return r ? Buffer.from(r.bytes).toString('utf8') : null; },
      fontUrl: async (sfnt) => `data:font/ttf;base64,${Buffer.from(sfnt).toString('base64')}`,
      toPath: (o) => shaper.toPath(o),
    });
  } finally { await res.close(); }
  const fin = await finishInScratch(page, script, text.svg, shot, opts.scale ?? 1);
  return {
    svg: fin.svg,
    width: out.width,
    height: out.height,
    distance: fin.distance ?? 1,
    ms: Date.now() - t0,
    warnings: [
      ...out.warnings,
      ...(missing.length ? [`${missing.length} image(s) could not be read from the page`] : []),
      ...(text.unreadable.length ? [`${text.unreadable.length} font file(s) could not be read; their text stays as text`] : []),
    ],
    stats: {
      ...out.stats, resolved, unresolved: missing.length, regions: fin.filled, dropped: fin.dropped,
      outlined: text.outlined, textKept: text.kept,
    },
  };
}

/** Fill the region boxes and score the result in a blank page of the same context:
 *  the captured page's own Content-Security-Policy may refuse data: images. */
async function finishInScratch(page: Page, script: string, svg: string, shot: Uint8Array, scale: number): Promise<{ svg: string; filled: number; dropped: number; distance?: number }> {
  const scratch = await page.context().newPage();
  try {
    await scratch.evaluate(script);
    return await scratch.evaluate(
      (o) => (globalThis as unknown as { __lollyFinishPageVector: (x: unknown) => Promise<{ svg: string; filled: number; dropped: number; distance?: number }> }).__lollyFinishPageVector(o),
      { svg, shot: Buffer.from(shot).toString('base64'), scale, score: true },
    );
  } finally {
    await scratch.close().catch(() => {});
  }
}

/**
 * Read resources the page already loaded from the tab's own cache (CDP
 * Page.getResourceContent). That cache has no CORS restriction, needs no second
 * request, and holds what the page actually showed. A URL the cache does not hold
 * is fetched through the context, which shares the page's cookies, unless
 * `cacheOnly`: a hosted capture (`publicOnly`) must not let a captured page name
 * an address for the server to request on its behalf. Close when done.
 */
async function tabResources(page: Page, { cacheOnly = false }: { cacheOnly?: boolean } = {}): Promise<{ read(url: string): Promise<{ bytes: Uint8Array; mime: string } | null>; close(): Promise<void> }> {
  const cdp = await page.context().newCDPSession(page);
  const where = new Map<string, { frameId: string; mimeType: string }>();
  let mainFrame = '';
  try {
    const { frameTree } = await cdp.send('Page.getResourceTree') as { frameTree: FrameTree };
    const walk = (t: FrameTree): void => {
      for (const r of t.resources ?? []) where.set(r.url, { frameId: t.frame.id, mimeType: r.mimeType });
      where.set(t.frame.url, where.get(t.frame.url) ?? { frameId: t.frame.id, mimeType: t.frame.mimeType ?? 'text/html' });
      for (const c of t.childFrames ?? []) walk(c);
    };
    walk(frameTree);
    mainFrame = frameTree.frame.id;
  } catch { /* the fetch fallback still answers */ }
  const cache = new Map<string, Promise<{ bytes: Uint8Array; mime: string } | null>>();
  const fetchOne = async (url: string): Promise<{ bytes: Uint8Array; mime: string } | null> => {
    if (url.startsWith('data:')) {
      const comma = url.indexOf(',');
      if (comma < 0) return null;
      const meta = url.slice(5, comma);
      const body = url.slice(comma + 1);
      return {
        bytes: /;base64$/i.test(meta) ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'utf8'),
        mime: meta.replace(/;base64$/i, '').split(';')[0] || 'application/octet-stream',
      };
    }
    const hit = where.get(url);
    if (mainFrame) {
      try {
        const r = await cdp.send('Page.getResourceContent', { frameId: hit?.frameId ?? mainFrame, url }) as { content: string; base64Encoded: boolean };
        const bytes = r.base64Encoded ? Buffer.from(r.content, 'base64') : Buffer.from(r.content, 'utf8');
        return { bytes, mime: hit?.mimeType || sniffMime(bytes) };
      } catch { /* not in the cache: fetch */ }
    }
    if (cacheOnly) return null;
    try {
      const resp = await page.context().request.get(url, { timeout: 15_000 });
      if (!resp.ok()) return null;
      const bytes = await resp.body();
      return { bytes, mime: (resp.headers()['content-type'] || '').split(';')[0]!.trim() || sniffMime(bytes) };
    } catch { return null; }
  };
  return {
    read(url) { let p = cache.get(url); if (!p) { p = fetchOne(url); cache.set(url, p); } return p; },
    close: () => cdp.detach().catch(() => {}),
  };
}

/** Swap each absolute image URL for a data URL of the bytes the tab holds. One
 *  that cannot be read keeps its URL and is reported. */
async function inlineImages(res: { read(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> }, svg: string, urls: string[]): Promise<{ svg: string; resolved: number; missing: string[] }> {
  let resolved = 0;
  const missing: string[] = [];
  for (const url of urls) {
    const r = await res.read(url);
    const mime = r ? (/^image\//.test(r.mime) ? r.mime : sniffMime(r.bytes)) : '';
    if (r && /^image\//.test(mime)) {
      svg = svg.split(`href="${xmlAttr(url)}"`).join(`href="data:${mime};base64,${Buffer.from(r.bytes).toString('base64')}"`);
      resolved++;
    } else {
      missing.push(url);
    }
  }
  return { svg, resolved, missing };
}

interface FrameTree {
  frame: { id: string; url: string; mimeType?: string };
  resources?: Array<{ url: string; mimeType: string }>;
  childFrames?: FrameTree[];
}

function sniffMime(bytes: Uint8Array): string {
  const head = Buffer.from(bytes.subarray(0, 48));
  if (head[0] === 0x89 && head[1] === 0x50) return 'image/png';
  if (head[0] === 0xff && head[1] === 0xd8) return 'image/jpeg';
  if (head.toString('latin1', 0, 4) === 'GIF8') return 'image/gif';
  if (head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (head.toString('latin1', 4, 12).includes('ftypavif')) return 'image/avif';
  if (/<svg|<\?xml/i.test(head.toString('utf8'))) return 'image/svg+xml';
  return 'application/octet-stream';
}
