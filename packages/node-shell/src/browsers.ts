// SPDX-License-Identifier: MPL-2.0
/**
 * Headless-Chromium launcher shared by the Node shells (CLI + TUI): the opt-in
 * "Tier B" for the formats only a real browser can make: HTML-layout raster, jpg/webp,
 * pdf, video, and live-URL capture.
 *
 * The browser is NOT bundled. `lolly install-browser` (or `pnpm run install:browser`
 * in shells/cli) downloads Chromium once via the `playwright-core` the shells already
 * depend on. A plain `pnpm install` pulls no browser. It is loaded lazily on first use
 * and killed on process exit, never at startup, so an `--export=svg` run stays
 * instant and dependency-light.
 *
 * Resolution order gives the user the least-work option first:
 *   1. LOLLY_BROWSER_PATH     - an explicit browser binary
 *   2. LOLLY_BROWSER_CHANNEL  - an installed channel, e.g. `chrome` (no download)
 *   3. PLAYWRIGHT_BROWSERS_PATH - an existing browsers dir the env points at
 *   4. the shells' own scoped install (.browsers at the repo root), else any Chromium a
 *      sibling package already downloaded (reused read-only, no second download).
 *   5. Playwright's own per-user cache (`npx playwright install` puts browsers there),
 *      reused read-only, so a machine that already has Chromium needs no second copy.
 * The scoped dir is package-neutral (not tied to another package's lifetime), so the
 * terminal shells' raster path keeps working on its own.
 */
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { repoRoot } from './repo-root.ts';
import { webGpuLaunchArgs } from './webgpu-launch.ts';

/** Where `lolly install-browser` puts Chromium - a package-neutral repo-root dir. */
export const INSTALL_BROWSERS_DIR = join(repoRoot(), '.browsers');
// A Chromium another repo package already downloaded. Reused read-only when the
// shells' own dir is empty, so a machine already set up for the MCP render tier needs
// no second download. Never installed into.
const SIBLING_BROWSERS_DIR = join(repoRoot(), 'services', 'mcp', '.browsers');

/** Playwright's default per-user browsers dir on this platform (it need not exist). */
export function playwrightUserCacheDir(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform, home = homedir()): string {
  if (platform === 'darwin') return join(home, 'Library', 'Caches', 'ms-playwright');
  if (platform === 'win32') return join(env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'ms-playwright');
  return join(env.XDG_CACHE_HOME || join(home, '.cache'), 'ms-playwright');
}

/** Raised for a caller-facing render problem (browser missing, navigation failed). */
export class BrowserError extends Error {}

/** The browsers dir Chromium is loaded from (env override › shell install › sibling reuse › user cache). */
export function resolveBrowsersDir(): string {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (existsSync(INSTALL_BROWSERS_DIR)) return INSTALL_BROWSERS_DIR;
  if (existsSync(SIBLING_BROWSERS_DIR)) return SIBLING_BROWSERS_DIR;
  const userCache = playwrightUserCacheDir();
  if (existsSync(userCache)) return userCache;
  return INSTALL_BROWSERS_DIR;
}

let browserPromise: Promise<import('playwright-core').Browser> | null = null;

/**
 * The flags getBrowser launches with (see the comment at its launch for the rendering
 * pins). The web shell requires a WebGPU adapter (plan 295): webGpuLaunchArgs names
 * SwiftShader for software graphics, and for `auto` on Linux, where a GPU-less host has
 * no other adapter (webgpu-launch.ts). Exported so a test can pin them without a browser.
 */
export function chromiumLaunchArgs(graphics: 'software' | 'auto' = 'software', platform: NodeJS.Platform = process.platform): string[] {
  return ['--no-sandbox', ...(graphics === 'software' ? ['--use-angle=swiftshader'] : []), '--enable-unsafe-swiftshader',
    ...webGpuLaunchArgs(graphics, platform), '--force-color-profile=srgb', '--font-render-hinting=none'];
}

/**
 * The complete options getBrowser passes to `chromium.launch`: an explicit channel
 * (LOLLY_BROWSER_CHANNEL, e.g. 'chrome') or binary (LOLLY_BROWSER_PATH) when one is set,
 * and always chromiumLaunchArgs. Exported so a test can check what a launch receives
 * without starting a browser.
 */
export function chromiumLaunchOptions(graphics: 'software' | 'auto' = 'software', env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): { channel?: string; executablePath?: string; args: string[] } {
  const channel = env.LOLLY_BROWSER_CHANNEL;
  const executablePath = env.LOLLY_BROWSER_PATH;
  return {
    ...(channel ? { channel } : {}),
    ...(executablePath ? { executablePath } : {}),
    args: chromiumLaunchArgs(graphics, platform),
  };
}

/**
 * Launch (or reuse) the scoped Chromium. An explicit channel/binary wins; otherwise
 * Chromium is loaded from the resolved browsers dir.
 */
export async function getBrowser({ graphics = 'software' }: { graphics?: 'software' | 'auto' } = {}): Promise<import('playwright-core').Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      if (!process.env.LOLLY_BROWSER_CHANNEL && !process.env.LOLLY_BROWSER_PATH) {
        process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolveBrowsersDir();
      }
      const { chromium } = await import('playwright-core');
      try {
        // The launch flags (chromiumLaunchArgs) and why each is there:
        // SwiftShader gives headless runs a software WebGL2 context (recent
        // Chromium disables it without the explicit opt-in). The docs pipeline's
        // ?neuro=viz capture needs one to render the MilkDrop visualizer at all.
        // The two rendering-intent flags pin what the user's export looks like
        // regardless of the machine doing the rendering. force-color-profile=srgb
        // takes the host display profile out of every canvas/raster path: a brand
        // #30ba78 exports as those bytes on any box. HDR is unaffected, because the
        // engine's PQ boost embeds its own BT.2020 profile downstream. Playwright
        // already passes this flag in its OWN default args, so here it is an
        // explicit pin, not a behaviour change. It keeps the intent if the
        // launcher ever sets ignoreDefaultArgs or moves off Playwright.
        // font-render-hinting=none removes the largest source of Linux/macOS
        // glyph-metric divergence (FreeType hint distortion) so server layouts
        // (MCP, lolly.work) don't reflow vs desktop. Antialiasing and subpixel
        // positioning still differ per-OS, so raster BYTES are not cross-OS
        // identical. Mirrored in services/mcp/src/render.ts, the byte-golden
        // test harnesses (export-format-golden / export-text-emission) and the
        // drawing fidelity harness (design-draw-fidelity).
        // Docs captures render a whole gallery, including 3D examples. They
        // can use the available GPU; software remains the default for exports.
        return await chromium.launch(chromiumLaunchOptions(graphics));
      } catch (err) {
        const msg = (err as Error).message || '';
        if (/executable doesn't exist|Executable doesn't exist|please run|not been downloaded/i.test(msg)) {
          throw new BrowserError(
            'Raster/PDF/video export needs a headless browser. Run `lolly install-browser` ' +
            '(or `pnpm run install:browser` in shells/cli - downloads Chromium once, ~150 MB), ' +
            'or set LOLLY_BROWSER_CHANNEL=chrome to use an already-installed Chrome/Edge with ' +
            'no download. (svg and data formats need no browser.)',
          );
        }
        throw err;
      }
    })().catch(err => { browserPromise = null; throw err; });
  }
  return browserPromise;
}

/** Whether a browser is reachable without a download (cheap check, no launch). */
export function browserInstalled(): boolean {
  if (process.env.LOLLY_BROWSER_CHANNEL || process.env.LOLLY_BROWSER_PATH) return true;
  return existsSync(resolveBrowsersDir());
}

export async function closeBrowser(): Promise<void> {
  const b = browserPromise;
  browserPromise = null;
  if (b) { try { (await b).close(); } catch { /* ignore */ } }
}
