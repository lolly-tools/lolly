// SPDX-License-Identifier: MPL-2.0
/**
 * A thumbnail render's smaller picture copies are now made in a worker
 * (bridge/thumb-downscale.worker.ts) where they used to be made on the main thread.
 * This suite makes the same copies both ways in a real Chromium, from a JPEG, a PNG
 * with transparency and a WebP, at two sizes each, and checks that the worker gives
 * the same pixels as the main-thread path did (and, where the encoder is the same,
 * the same bytes).
 *
 * Self-skips by name where Playwright's Chromium is not installed (`pnpm exec
 * playwright install chromium`); a green run without it means "not exercised".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { BrowserType } from 'playwright';

async function chromiumOrSkip(): Promise<{ chromium: BrowserType } | string> {
  let chromium: BrowserType;
  try { ({ chromium } = await import('playwright')); }
  catch { return 'playwright not installed'; }
  try {
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}
const browserOrReason = await chromiumOrSkip();

interface Compared { name: string; width: number; height: number; sameBytes: boolean; samePixels: boolean; differing: number }

test('the worker makes the same thumbnail pixels as the main thread did',
  { skip: typeof browserOrReason === 'string' ? browserOrReason : false }, async () => {
  const { chromium } = browserOrReason as { chromium: BrowserType };
  const { build } = await import('esbuild');
  const bundle = async (entry: string, globalName?: string): Promise<string> => (await build({
    entryPoints: [fileURLToPath(new URL(entry, import.meta.url))],
    bundle: true, write: false, format: 'iife', platform: 'browser', ...(globalName ? { globalName } : {}),
  })).outputFiles[0]!.text;
  const pageCode = await bundle('./thumb-downscale.ts', 'thumbProbe');
  const workerCode = await bundle('./thumb-downscale.worker.ts');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('https://thumb.test/**', route => (new URL(route.request().url()).pathname === '/worker.js'
      ? route.fulfill({ contentType: 'text/javascript', body: workerCode })
      : route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>thumbs</title>' })));
    await page.goto('https://thumb.test/');
    await page.addScriptTag({ content: pageCode });
    const { compared, stats } = await page.evaluate(async () => {
      const { createThumbDownscaler, downscaleOnMainThread } = (globalThis as unknown as { thumbProbe: typeof import('./thumb-downscale.ts') }).thumbProbe;
      // A photo-like source: a gradient with fixed pseudo-random grain, optionally
      // with an alpha ramp, encoded in the given format.
      const source = async (width: number, height: number, type: string, alpha: boolean): Promise<Blob> => {
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#13294b'); gradient.addColorStop(0.5, '#f2c14e'); gradient.addColorStop(1, '#2a9d8f');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        const image = ctx.getImageData(0, 0, width, height);
        let seed = 7;
        for (let i = 0; i < image.data.length; i += 4) {
          seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
          const grain = (seed >>> 24) - 128;
          image.data[i] = image.data[i]! + grain / 4;
          image.data[i + 1] = image.data[i + 1]! + grain / 5;
          image.data[i + 2] = image.data[i + 2]! + grain / 6;
          if (alpha) image.data[i + 3] = Math.round(((i / 4) % width) * 255 / width);
        }
        ctx.putImageData(image, 0, 0);
        return new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), type, 0.92));
      };
      const pixels = async (url: string): Promise<Uint8ClampedArray> => {
        const bitmap = await createImageBitmap(await (await fetch(url)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      };
      const downscaler = createThumbDownscaler({
        createWorker: () => new Worker('/worker.js'),
        workerCapable: () => true,
        inRealm: downscaleOnMainThread,
        yieldToPage: () => new Promise<void>(resolve => { setTimeout(resolve, 0); }),
      });
      const sources: Array<[string, Blob, Array<[number, number]>]> = [
        ['photo.jpg', await source(1600, 1067, 'image/jpeg', false), [[240, 160], [97, 65]]],
        ['alpha.png', await source(1200, 900, 'image/png', true), [[240, 180], [97, 73]]],
        ['art.webp', await source(900, 1400, 'image/webp', false), [[154, 240], [62, 97]]],
      ];
      const out: Compared[] = [];
      for (const [name, blob, sizes] of sources) {
        for (const [width, height] of sizes) {
          const main = await downscaleOnMainThread(blob, width, height);
          const worker = await downscaler.downscale(blob, width, height);
          const a = await pixels(main), b = await pixels(worker);
          let differing = a.length === b.length ? 0 : -1;
          if (differing === 0) for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differing++;
          out.push({ name, width, height, sameBytes: main === worker, samePixels: differing === 0, differing });
        }
      }
      return { compared: out, stats: { ...downscaler.stats } };
    });
    assert.deepEqual(stats, { worker: 6, inRealm: 0 }, 'every copy was made in the worker');
    for (const c of compared as Compared[]) {
      assert.equal(c.samePixels, true, `${c.name} at ${c.width}x${c.height}: ${c.differing} channel values differ`);
    }
    // The same encoder on the same pixels writes the same file; reported, not required.
    const bytes = (compared as Compared[]).filter(c => c.sameBytes).length;
    console.log(`thumb-downscale: ${compared.length} copies, same pixels in all, same bytes in ${bytes}`);
  } finally { await browser.close(); }
});
