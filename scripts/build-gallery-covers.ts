#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Bake each tool's gallery cover, so a first visit paints without rendering anything.
 *
 * Run it against a web shell already serving the profile you are baking:
 *
 *   LOLLY_PROFILE=lolly-demo node scripts/build-gallery-covers.ts --url=http://localhost:5173
 *
 * It opens the real gallery on a clean profile, once per theme, waits for the live covers,
 * and saves each tool's first cover under catalog/previews/covers/ with
 * catalog/previews/covers.json. Vector stays vector when the file is small; a heavy cover is
 * saved as WebP at twice card size. lib/gallery-covers.ts uses a file only when the visitor's
 * context hash, tool version and cover all match, so a stale bake only costs a live render.
 * Re-run after changing a cover, a tool version or a design system.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { catalogFile } from '../packages/node-shell/src/content-roots.ts';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const base = (arg('url') ?? '').replace(/\/$/, '');
if (!base) throw new Error('Pass --url=<the web shell serving this profile>');
const THEMES = ['light', 'dark'] as const;
/** A vector cover this small costs less than its raster twin and stays sharp. */
const MAX_SVG_BYTES = 180_000;
const CARD_WIDTH = 656;
const WAIT_MS = Number(arg('wait') ?? 240_000);

const out = catalogFile('previews/covers');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

interface Saved { templateId?: string; file: string }
const manifest: { v: 1; contexts: Record<string, string>; covers: Record<string, { version: string; [theme: string]: Saved | string }> } = { v: 1, contexts: {}, covers: {} };
const index = await (await fetch(`${base}/catalog/tools/index.json`)).json() as { tools: Array<{ id: string; version: string }> };
const versions = new Map(index.tools.map((t) => [t.id, t.version]));

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: webGpuLaunchArgs('auto') });
for (const theme of THEMES) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: theme, serviceWorkers: 'block' });
  await context.addInitScript(() => { (globalThis as unknown as { __lollyBakeCovers: boolean }).__lollyBakeCovers = true; });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'load', timeout: 180_000 });
  await page.waitForSelector('.gtile', { timeout: 120_000 });
  for (const name of ['Skip for now', 'Got it']) {
    const b = page.getByText(name, { exact: true }).first();
    if (await b.count()) await b.click({ timeout: 3000 }).catch(() => {});
  }
  await page.addStyleTag({ content: '.gtile,.gtile *{content-visibility:visible!important}' });
  // Walk the page so the queue reaches every card, then wait for it to go quiet.
  const height = await page.evaluate(() => document.scrollingElement!.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(1200);
  }
  const started = Date.now();
  let last = -1, quiet = 0;
  while (Date.now() - started < WAIT_MS && quiet < 6) {
    await page.waitForTimeout(3000);
    const ready = await page.evaluate(() => document.querySelectorAll('.gtile .gcar-slide--ex:first-of-type img.gcar-img[src]').length);
    quiet = ready === last ? quiet + 1 : 0;
    last = ready;
  }
  const hash = await page.evaluate(() => (globalThis as unknown as { __lollyCoverContext?: string }).__lollyCoverContext);
  if (!hash) throw new Error('The gallery never reported its context hash');
  manifest.contexts[hash] = theme;
  const covers = await page.evaluate(async (cardWidth) => {
    const rows: Array<{ id: string; href: string; src: string; webp: string | null }> = [];
    for (const tile of document.querySelectorAll<HTMLElement>('.gtile[data-tool-id]')) {
      const slide = tile.querySelector<HTMLElement>('.gcar-slide--ex');
      const img = slide?.querySelector<HTMLImageElement>('img.gcar-img[src]');
      if (!slide || !img || !img.naturalWidth || !img.src.startsWith('data:')) continue;
      let webp: string | null = null;
      try {
        const scale = Math.min(1, cardWidth / img.naturalWidth, (cardWidth * 0.75) / img.naturalHeight) || 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        webp = canvas.toDataURL('image/webp', 0.84);
      } catch { webp = null; }
      rows.push({ id: tile.dataset.toolId!, href: slide.querySelector('a')?.getAttribute('href') ?? '', src: img.src, webp });
    }
    return rows;
  }, CARD_WIDTH);
  let bytes = 0, saved = 0;
  for (const cover of covers) {
    const version = versions.get(cover.id);
    if (!version) continue;
    const comma = cover.src.indexOf(',');
    const head = cover.src.slice(0, comma);
    const body = cover.src.slice(comma + 1);
    const svg = head.startsWith('data:image/svg+xml')
      ? (head.endsWith(';base64') ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body)))
      : null;
    const useSvg = (svg?.length ?? Infinity) <= MAX_SVG_BYTES;
    const data = useSvg ? svg! : cover.webp ? Buffer.from(cover.webp.split(',')[1]!, 'base64') : null;
    if (!data) continue;
    const name = `${cover.id}.${theme}.${useSvg ? 'svg' : 'webp'}`;
    writeFileSync(join(out, name), data);
    bytes += data.length; saved += 1;
    const templateId = /[?&]template=([^&]+)/.exec(cover.href)?.[1];
    manifest.covers[cover.id] ??= { version };
    manifest.covers[cover.id]![theme] = { ...(templateId ? { templateId: decodeURIComponent(templateId) } : {}), file: `/catalog/previews/covers/${name}` };
  }
  console.log(`${theme}: ${saved} covers, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  await context.close();
}
await browser.close();
writeFileSync(catalogFile('previews/covers.json'), `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`Wrote ${Object.keys(manifest.covers).length} tools to ${catalogFile('previews/covers.json')}`);
