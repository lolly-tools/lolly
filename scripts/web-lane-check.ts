// SPDX-License-Identifier: MPL-2.0
/**
 * The web lane's one real-browser check (fast-lanes.yml, scripts/deploy-lane.ts).
 *
 *   node scripts/web-lane-check.ts <base url of a served production build> [report directory]
 *
 * It boots the built shell in Chromium with software WebGPU (packages/node-shell/src/webgpu-launch.ts),
 * waits for the gallery to show tool cards, opens the QR code tool from its card, and exports one PNG
 * through the shell's own export path, the same `export=1` route the CLI's browser tier drives. It fails
 * on a WebGPU refusal, an uncaught page error, a missing card or canvas, or a download that is not a
 * PNG with a real size. The report directory receives a JSON summary and, on failure, a screenshot.
 *
 * This is not the browser suite. ci.yml's four browser partitions still run on every main push; this
 * check only shows that the build boots, renders and exports before a fast lane ships the build.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { waitForExport } from '../packages/node-shell/src/export-wait.ts';
import { waitForShellStartup } from '../packages/node-shell/src/shell-startup.ts';
import { SOFTWARE_WEBGPU_ARGS } from '../packages/node-shell/src/webgpu-launch.ts';

const TOOL = 'qr-code';
const MIN_CARDS = 10;

/** Width and height of a PNG, or null when the bytes are not one. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 33 || signature.some((value, index) => bytes[index] !== value)) return null;
  if (String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16), height = view.getUint32(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

async function step<T>(report: Record<string, unknown>, name: string, work: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const value = await work();
  report[name] = { ms: Date.now() - started };
  console.log(`${name}: ${Date.now() - started} ms`);
  return value;
}

export async function check(base: string, out: string): Promise<void> {
  const origin = new URL(base).origin;
  mkdirSync(out, { recursive: true });
  const report: Record<string, unknown> = { base: origin, toolId: TOOL };
  const pageErrors: string[] = [];
  const browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL || undefined, args: [...SOFTWARE_WEBGPU_ARGS] });
  let page: Page | undefined;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', acceptDownloads: true });
    await context.addInitScript(() => {
      for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    });
    page = await context.newPage();
    const opened = page;
    opened.on('pageerror', error => { pageErrors.push(error.message); });

    const cards = await step(report, 'gallery', async () => {
      // The gallery is shown still while the WebGPU startup check settles, as the CLI's browser tier does.
      await opened.emulateMedia({ reducedMotion: 'reduce' });
      await opened.goto(`${origin}/#/tools`, { waitUntil: 'load', timeout: 60_000 });
      const startup = await waitForShellStartup(opened);
      if (startup !== 'ready') throw new Error('The shell reported WebGPU as unavailable');
      await opened.locator('#view.gallery-view .gtile[data-tool-id]').first().waitFor({ timeout: 60_000 });
      return opened.locator('#view.gallery-view .gtile[data-tool-id]').count();
    });
    if (cards < MIN_CARDS) throw new Error(`The gallery shows ${cards} tool cards; expected at least ${MIN_CARDS}`);
    report.cards = cards;

    await step(report, 'tool', async () => {
      await opened.emulateMedia({ reducedMotion: null });
      await opened.locator(`#view.gallery-view .gtile[data-tool-id="${TOOL}"] a.gtile-name`).click({ timeout: 30_000 });
      await opened.waitForFunction(id => location.hash.startsWith(`#/tool/${id}`), TOOL, { timeout: 30_000 });
      await waitForShellStartup(opened);
      await opened.locator('#tool-canvas svg, #tool-canvas canvas, #tool-canvas img').first().waitFor({ timeout: 60_000 });
    });

    const exported = await step(report, 'export', async () => {
      const waiting = await waitForExport(opened, 'png');
      try {
        const query = new URLSearchParams({ url: 'https://lolly.tools', format: 'png', export: '1' });
        await opened.goto(`${origin}/#/tool/${TOOL}?${query}`, { waitUntil: 'commit', timeout: 30_000 });
        const download = await waiting.result;
        const file = await download.path();
        if (!file) throw new Error('The export produced no file');
        return { name: download.suggestedFilename(), bytes: new Uint8Array(readFileSync(file)) };
      } finally { waiting.dispose(); }
    });
    const size = pngSize(exported.bytes);
    if (!size || exported.bytes.length < 500) throw new Error(`${exported.name} is not a PNG with content (${exported.bytes.length} bytes)`);
    report.export = { ...(report.export as object), file: exported.name, bytes: exported.bytes.length, ...size };
    if (pageErrors.length) throw new Error(`Uncaught page errors:\n  ${pageErrors.slice(0, 10).join('\n  ')}`);
    report.result = 'PASSED';
  } catch (error) {
    report.result = 'FAILED';
    report.error = error instanceof Error ? error.message : String(error);
    report.pageErrors = pageErrors;
    if (page) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: false }).catch(() => {});
    throw error;
  } finally {
    writeFileSync(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await browser.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [base, out = 'artifacts/web-lane-check'] = process.argv.slice(2);
  if (!base) {
    console.error('Usage: web-lane-check.ts <base url> [report directory]');
    process.exitCode = 2;
  } else {
    try {
      await check(base, out);
      console.log('Web lane browser check passed');
    } catch (error) {
      console.error(`Web lane browser check failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
}
