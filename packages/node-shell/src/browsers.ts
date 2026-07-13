// SPDX-License-Identifier: MPL-2.0
/**
 * Headless-Chromium launcher shared by the Node shells (CLI + TUI) — the opt-in
 * "Tier B" for the formats only a real browser can make: HTML-layout raster, jpg/webp,
 * pdf, video, and live-URL capture.
 *
 * The browser is NOT bundled: `lolly install-browser` (or `npm run install:browser`
 * in shells/cli) downloads Chromium once via the `playwright-core` the shells already
 * depend on — a plain `npm install` pulls no browser. It is loaded lazily on first use
 * and killed on process exit — never at startup — so an `--export=svg` run stays
 * instant and dependency-light.
 *
 * Resolution order gives the user the least-work option first:
 *   1. LOLLY_BROWSER_PATH     — an explicit browser binary
 *   2. LOLLY_BROWSER_CHANNEL  — an installed channel, e.g. `chrome` (no download)
 *   3. PLAYWRIGHT_BROWSERS_PATH — an existing browsers dir the env points at
 *   4. the shells' own scoped install (.browsers at the repo root), else any Chromium a
 *      sibling package already downloaded (reused read-only — no second download).
 * The scoped dir is package-neutral (not tied to another package's lifetime), so the
 * terminal shells' raster path keeps working on its own.
 */
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { repoRoot } from './repo-root.ts';

/** Where `lolly install-browser` puts Chromium — a package-neutral repo-root dir. */
export const INSTALL_BROWSERS_DIR = join(repoRoot(), '.browsers');
// A Chromium another repo package already downloaded — reused read-only when the
// shells' own dir is empty, so a machine already set up for the MCP render tier needs
// no second download. Never installed into.
const SIBLING_BROWSERS_DIR = join(repoRoot(), 'services', 'mcp', '.browsers');

/** Raised for a caller-facing render problem (browser missing, navigation failed). */
export class BrowserError extends Error {}

/** The browsers dir Chromium is loaded from (env override › shell install › sibling reuse). */
export function resolveBrowsersDir(): string {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (existsSync(INSTALL_BROWSERS_DIR)) return INSTALL_BROWSERS_DIR;
  if (existsSync(SIBLING_BROWSERS_DIR)) return SIBLING_BROWSERS_DIR;
  return INSTALL_BROWSERS_DIR;
}

let browserPromise: Promise<import('playwright-core').Browser> | null = null;

/**
 * Launch (or reuse) the scoped Chromium. An explicit channel/binary wins; otherwise
 * Chromium is loaded from the resolved browsers dir.
 */
export async function getBrowser(): Promise<import('playwright-core').Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const channel = process.env.LOLLY_BROWSER_CHANNEL;   // e.g. 'chrome'
      const executablePath = process.env.LOLLY_BROWSER_PATH;
      if (!channel && !executablePath) {
        process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolveBrowsersDir();
      }
      const { chromium } = await import('playwright-core');
      try {
        return await chromium.launch({
          ...(channel ? { channel } : {}),
          ...(executablePath ? { executablePath } : {}),
          args: ['--no-sandbox'],
        });
      } catch (err) {
        const msg = (err as Error).message || '';
        if (/executable doesn't exist|Executable doesn't exist|please run|not been downloaded/i.test(msg)) {
          throw new BrowserError(
            'Raster/PDF/video export needs a headless browser. Run `lolly install-browser` ' +
            '(or `npm run install:browser` in shells/cli — downloads Chromium once, ~150 MB), ' +
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

/** Whether a browser is reachable without a download (cheap check — no launch). */
export function browserInstalled(): boolean {
  if (process.env.LOLLY_BROWSER_CHANNEL || process.env.LOLLY_BROWSER_PATH) return true;
  return existsSync(resolveBrowsersDir());
}

export async function closeBrowser(): Promise<void> {
  const b = browserPromise;
  browserPromise = null;
  if (b) { try { (await b).close(); } catch { /* ignore */ } }
}
