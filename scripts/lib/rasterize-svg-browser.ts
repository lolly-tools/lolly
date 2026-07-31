#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * SVG → PNG rasteriser backed by our OWN render path (Playwright/Chromium), not resvg.
 *
 * Why this exists: the pre-rendered share/preview cards used to be rasterised with
 * @resvg/resvg-js — a SECOND, standalone SVG interpreter that re-parses the SVG on its
 * own and can therefore DRIFT from what the app (Chromium) actually paints: it shapes
 * text differently (its own metrics, no real HarfBuzz cascade), and it has mis-rendered
 * some brand illustrations (dropped gradient/class fills → a black-bodied Geeko) and
 * outright panicked on others (a Rust `unwrap` abort that took the whole build down).
 * Rasterising through the same browser engine the gallery, exports and preview pipeline
 * (scripts/build-previews.ts) already use means one render path — a card is byte-shaped
 * the way a user sees the tool, and can't diverge.
 *
 * Contract mirrors the old resvg call so callers degrade the same way: constructing the
 * rasteriser THROWS when Playwright (a devDependency) or every needed font is unavailable
 * (brand catalog faces, falling back per-weight to the platform Outfit variable face),
 * so a caller wraps it in try/catch and keeps its committed bytes rather than crashing
 * the build (exactly the resvg-missing behaviour). Launches ONE browser; reuse the
 * returned `rasterize` across many cards, then `close()`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';

export interface RasterizeOpts {
  /** Output width in px (the card SVG's own width; OG cards are 1200). */
  width: number;
  /** Output height in px (OG cards are 630). */
  height: number;
  /** Page background painted behind the SVG (matches the card's own field). */
  background?: string;
}

export interface SvgRasterizer {
  /** Rasterise one self-contained SVG string to PNG bytes at the given size. */
  rasterize(svg: string, opts: RasterizeOpts): Promise<Buffer>;
  /** Tear down the shared browser. Always call when done. */
  close(): Promise<void>;
}

// The card SVGs paint text in three SUSE weights; expose them as one @font-face family
// so `font-family="SUSE"` (with font-weight 400/500/700) shapes with the real face
// rather than a Chromium fallback. Read from the active profile's catalog VIEW — the
// same path resvg loaded from — so this is profile-consistent. A brand catalog with no
// fonts (lolly-start ships only a .gitkeep) falls back per-weight to the platform's
// neutral Outfit variable face — the same last resort the web shell's font-registry
// uses — so a fontless brand still renders cards instead of aborting the whole run.
const FONT_WEIGHTS: ReadonlyArray<readonly [number, string]> = [
  [400, 'Regular'],
  [500, 'Medium'],
  [700, 'Bold'],
];

const FALLBACK_FONT = 'shells/web/public/fonts/Outfit[wght].ttf';

/**
 * Build a rasteriser bound to the repo's SUSE fonts, launching one headless Chromium.
 * Throws if Playwright or any required font weight is missing (caller degrades).
 */
export async function createSvgRasterizer(repoRoot: string): Promise<SvgRasterizer> {
  // Playwright is a devDependency (already used by scripts/build-previews.ts). A missing
  // install throws a helpful message so the caller keeps its committed cards.
  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error(
      'playwright is not installed (devDependency). Run `npm install`, then ' +
        '`npx playwright install chromium` to fetch the browser.',
    );
  }

  // @font-face blocks with the brand faces inlined as data-URIs — resolved BEFORE the
  // browser launches so a truly unreadable font fails fast (caller degrades to committed
  // bytes). A weight the brand catalog doesn't ship resolves to the Outfit variable font
  // pinned to that weight (Chromium sets the wght axis from the face's font-weight), so
  // the family stays 'SUSE' and the card SVGs need no per-brand markup.
  let fallbackB64: string | null = null;
  const fontFaceCss = FONT_WEIGHTS.map(([weight, name]) => {
    const brandPath = resolve(repoRoot, `catalog/fonts/ttf/SUSE-${name}.ttf`);
    let b64: string;
    if (existsSync(brandPath)) {
      b64 = readFileSync(brandPath).toString('base64');
    } else {
      fallbackB64 ??= readFileSync(resolve(repoRoot, FALLBACK_FONT)).toString('base64');
      b64 = fallbackB64;
    }
    return (
      `@font-face{font-family:'SUSE';font-style:normal;font-weight:${weight};` +
      `src:url(data:font/ttf;base64,${b64}) format('truetype');}`
    );
  }).join('');

  // Rendering-intent pins matching packages/node-shell/src/browsers.ts (see the
  // comment there): committed output must not depend on the build host's display
  // profile or font hinting.
  const browser: Browser = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  // deviceScaleFactor 1: OG cards are authored at their exact output px (1200×630), the
  // same 1:1 basis resvg used — no retina upscaling of a fixed-size social image.
  const context: BrowserContext = await browser.newContext({ deviceScaleFactor: 1 });
  const page: Page = await context.newPage();

  return {
    async rasterize(svg: string, { width, height, background = '#ffffff' }: RasterizeOpts): Promise<Buffer> {
      const html =
        '<!doctype html><html><head><meta charset="utf-8"><style>' +
        fontFaceCss +
        `html,body{margin:0;padding:0;background:${background};}svg{display:block;}` +
        '</style></head><body>' +
        svg +
        '</body></html>';
      await page.setViewportSize({ width, height });
      await page.setContent(html, { waitUntil: 'load' });
      // Wait for the SUSE faces to load AND for an embedded <image> (the preview SVG,
      // passed as a data-URI) to decode + paint, so the screenshot never captures a
      // fallback face or a blank preview panel. Two rAFs guarantee a paint cycle.
      await page.evaluate(async () => {
        await (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready;
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      });
      return await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
    },
    async close(): Promise<void> {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}
