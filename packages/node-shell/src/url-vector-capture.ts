// SPDX-License-Identifier: MPL-2.0
/**
 * url-shot's vector capture over Playwright: walk the live page into SVG geometry
 * (the page-walk script), fill in the bytes the page could not hand over, and
 * check the result against a screenshot of the same moment before trusting the SVG.
 *
 * The CLI and TUI share this through `captureUrl`. The desktop shell and the Chrome
 * extension run the same script over their own CDP transports. The MCP server
 * carries the code (its bridge is the CLI's) but does not render url-shot: its
 * browser-free tier refuses an HTML template as SVG, and its browser tier drives
 * the web app, which has no page capture of its own.
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
    /** Generated content drawn through a stand-in, and pseudo-elements left as they were. */
    standIns: number; standInsRefused: number;
  };
}

interface WalkOut {
  svg: string; width: number; height: number; ms: number; warnings: string[]; unresolved: string[];
  stats: { drawables: number; images: number; culled: number; regions: number; standIns: number; standInsRefused: number };
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
export async function captureVectorShot(page: Page, opts: {
  window?: WalkWindow;
  scale?: number;
  /** A hosted capture: read the tab's cache, and ask the page's own network stack
   *  again only for a URL this accepts (url-capture.ts passes its public-address
   *  check). Never a request from this process. */
  publicUrl?: (url: string) => boolean;
  /** The body of a response the page received, kept by the caller from before the
   *  navigation (Chrome keeps no font bytes in the tab's resource cache). */
  received?: (url: string) => Promise<Uint8Array | null>;
} = {}): Promise<VectorShot> {
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

  const res = await tabResources(page, { ...(opts.publicUrl ? { pageOnly: opts.publicUrl } : {}), ...(opts.received ? { received: opts.received } : {}) });
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
 * request, and holds what the page actually showed, but Chrome keeps no font bytes
 * there. A URL the cache refuses is read from the response the page received
 * (`received`), then asked for again through the page's own network stack
 * (Network.loadNetworkResource: the page's cookies, its HTTP cache, a URL the page
 * declared, held to the page's connect-src), and only then fetched through the
 * context.
 *
 * `pageOnly` is the hosted capture: the page's network stack and nothing more, and
 * only for a URL the predicate accepts, so a captured page cannot name an address
 * for the server to request on its behalf. Close when done.
 */
async function tabResources(page: Page, { pageOnly, received }: { pageOnly?: (url: string) => boolean; received?: (url: string) => Promise<Uint8Array | null> } = {}): Promise<{ read(url: string): Promise<{ bytes: Uint8Array; mime: string } | null>; close(): Promise<void> }> {
  const cdp = await page.context().newCDPSession(page);
  const where = new Map<string, { frameId: string; mimeType: string }>();
  let mainFrame = '';
  try {
    // getResourceContent answers "Agent is not enabled" until the Page domain is on.
    await cdp.send('Page.enable');
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
      } catch { /* not in the cache */ }
      const body = received ? await received(url).catch(() => null) : null;
      if (body) return { bytes: body, mime: hit?.mimeType || sniffMime(body) };
      if (!pageOnly || pageOnly(url)) {
        const bytes = await loadThroughPage(cdp, hit?.frameId ?? mainFrame, url);
        if (bytes) return { bytes, mime: hit?.mimeType || sniffMime(bytes) };
      }
    }
    if (pageOnly) return null;
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

/** The ceiling on one resource read back through the page. */
const MAX_PAGE_RESOURCE_BYTES = 32 << 20;

/** One resource through the page's own network stack, read off the stream CDP
 *  hands back. Null on any failure, or past MAX_PAGE_RESOURCE_BYTES. */
async function loadThroughPage(cdp: { send(m: string, p?: unknown): Promise<unknown> }, frameId: string, url: string): Promise<Uint8Array | null> {
  try {
    await cdp.send('Network.enable').catch(() => {});
    // With credentials first, as a same-origin font loads. A cross-origin font loads
    // without them, and a font CDN's `Access-Control-Allow-Origin: *` refuses a
    // credentialed request, so the second try leaves them off.
    const load = async (includeCredentials: boolean) => {
      const { resource } = await cdp.send('Network.loadNetworkResource', {
        frameId, url, options: { disableCache: false, includeCredentials },
      }) as { resource: { success: boolean; stream?: string } };
      return resource.success && resource.stream ? resource : null;
    };
    const resource = (await load(true).catch(() => null)) ?? (await load(false).catch(() => null));
    if (!resource?.stream) return null;
    const parts: Buffer[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await cdp.send('IO.read', { handle: resource.stream, size: 1 << 20 }) as { data: string; base64Encoded?: boolean; eof: boolean };
        const b = Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8');
        parts.push(b);
        size += b.length;
        if (size > MAX_PAGE_RESOURCE_BYTES) return null;
        if (chunk.eof) break;
      }
    } finally {
      await cdp.send('IO.close', { handle: resource.stream }).catch(() => {});
    }
    return Buffer.concat(parts);
  } catch { return null; }
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
