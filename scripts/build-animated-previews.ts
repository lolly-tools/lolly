#!/usr/bin/env node
/**
 * Animated preview generator.
 *
 * Run as: node scripts/build-animated-previews.ts [--url=http://localhost:5173] [--only=id1,id2]
 *
 * Some tools ANIMATE (bag-video's Geeko sways + blinks; the digi-ad scenes play; the
 * filters drift). A static SVG/PNG gallery tile freezes them mid-motion. This script gives
 * such a tool a LOOPING APNG instead — a valid `.png` that the gallery <img> animates
 * natively — by driving the tool in a real browser and exporting via the app's OWN apng
 * path (runtime.export → renderApng), so the file is byte-faithful to a real user export.
 *
 * It writes COMMITTED authored overrides in the tool dir, which win over any build-generated
 * preview and (unlike catalog/previews/*, which `npm run previews` regenerates) are never
 * clobbered:
 *   • kind:'looks' → tools/<id>/look<i>.png   (one APNG per manifest example — the example
 *                    carousel tile; build-preview-bundle.ts references it and build-previews
 *                    skips regenerating that look)
 *   • kind:'card'  → tools/<id>/card.png      (the single gallery card; build-catalog-index
 *                    already prefers a committed card.* over a generated preview)
 *
 * Files are kept deliberately SMALL — a gallery tile is tiny, and an APNG stores full PNG
 * frames (no inter-frame delta), so size scales with width × fps × duration. Each job below
 * picks a modest size / low fps / short loop; the console prints the resulting KB so a job
 * that balloons is obvious. Prefer a card-only APNG over animating every example unless the
 * tool's whole point is the motion (bag-video).
 *
 * Needs a running web shell — point --url at `npm run dev:web` (default localhost:5173). The
 * generator relies on the app's __lollyCaptureMotion hook (shells/web/src/views/tool.ts).
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import type { BrowserContext } from 'playwright';
// Engine-owned URL encoding — the SAME buildInputModel → serializeUrlState the app's
// seed-url.ts (and build-previews.ts) use, so a look's render URL seeds the identical
// inputs the live carousel would render from.
import { buildInputModel, serializeUrlState } from '../engine/src/index.ts';
import type { InputValue } from '../engine/src/inputs.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CANVAS_SEL = '#tool-canvas, #tool-content';

/** One render job — a tool's example looks, or its single card, as a small looping APNG. */
interface Job {
  tool: string;
  kind: 'looks' | 'card';
  width: number;
  height: number;
  /** clip length in seconds (fewer seconds → smaller file). */
  duration: number;
  /** frames/sec (lower → smaller file; renderApng clamps to 2–30). */
  fps: number;
  /** settle seconds before capture starts (lets fonts/hooks land + animation warm up). */
  wait?: number;
  /** kind:'card' — the look to render (falls back to the tool defaults when absent). */
  values?: Record<string, unknown>;
  /** kind:'looks' — restrict to these example indices (default: all). */
  only?: number[];
  /** palette size for the ffmpeg quantise pass (default 128; 0 disables → raw RGBA APNG). */
  colors?: number;
}

// The catalog's animated tiles. bag-video animates ALL four example looks (its whole point
// is the moving mascot); everything else should prefer a single card APNG (kind:'card') to
// avoid a pile of big files. Add Part-2 tools here as card jobs.
const JOBS: Job[] = [
  { tool: 'bag-video', kind: 'looks', width: 288, height: 288, duration: 2.2, fps: 10, wait: 0.5 },
];

interface Opts { url: string; only: string[] }

function parseOpts(argv: string[]): Opts {
  const o: Opts = { url: 'http://localhost:5173', only: [] };
  for (const a of argv) {
    if (a.startsWith('--url=')) o.url = a.slice(6).replace(/\/$/, '');
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
  }
  return o;
}

const opts = parseOpts(process.argv.slice(2));

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
});

async function main(): Promise<void> {
  let jobs = JOBS;
  if (opts.only.length) {
    const want = new Set(opts.only);
    jobs = jobs.filter((j) => want.has(j.tool));
  }
  if (!jobs.length) { console.log('No matching animated-preview jobs.'); return; }

  const { chromium } = await loadPlaywright();
  await waitForServer(opts.url);
  console.log(`Rendering animated previews against ${opts.url}\n`);

  const browser = await chromium.launch({ headless: true });
  // serviceWorkers:'block' so the PWA's SW can't serve a stale bundle mid-run.
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    for (const job of jobs) {
      await runJob(context, job);
    }
  } finally {
    await context.close();
    await browser.close();
  }
  console.log('\nDone.');
}

async function runJob(context: BrowserContext, job: Job): Promise<void> {
  let manifest: Parameters<typeof buildInputModel>[0];
  try {
    manifest = JSON.parse(await readFile(join(ROOT, 'tools', job.tool, 'tool.json'), 'utf8'));
  } catch {
    console.log(`  · ${job.tool}: no manifest — skipped`);
    return;
  }

  if (job.kind === 'card') {
    const query = seedQuery(manifest, job.values ?? {});
    const bytes = await renderApng(context, job.tool, query, job);
    if (bytes) await writeAndReport(join(ROOT, 'tools', job.tool, 'card.png'), bytes);
    else console.log(`  ✗ ${job.tool} card — capture failed`);
    return;
  }

  // looks
  const looks: Array<{ values?: Record<string, unknown> }> =
    (manifest as { examples?: unknown[]; featured?: { variants?: unknown[] } }).examples as never
    ?? (manifest as { featured?: { variants?: unknown[] } }).featured?.variants as never
    ?? [];
  if (!looks.length) { console.log(`  · ${job.tool}: no examples — skipped`); return; }
  for (let i = 0; i < looks.length; i++) {
    if (job.only && !job.only.includes(i)) continue;
    const values = looks[i]?.values;
    if (!values || typeof values !== 'object') continue;
    const query = seedQuery(manifest, values);
    const bytes = await renderApng(context, job.tool, query, job);
    if (bytes) await writeAndReport(join(ROOT, 'tools', job.tool, `look${i}.png`), bytes);
    else console.log(`  ✗ ${job.tool} look${i} — capture failed`);
  }
}

/** Only the look's OWN (dirty) inputs ride the URL — identical to seed-url.ts / build-previews. */
function seedQuery(manifest: Parameters<typeof buildInputModel>[0], values: Record<string, unknown>): string {
  try {
    return serializeUrlState(
      buildInputModel(manifest, { initial: values as Record<string, InputValue> }).filter((m) => m.isDirty),
    );
  } catch {
    return '';
  }
}

async function renderApng(context: BrowserContext, toolId: string, query: string, job: Job): Promise<Buffer | null> {
  const page = await context.newPage();
  try {
    await page.goto(`${opts.url}/#/tool/${toolId}${query ? `?${query}` : ''}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector(CANVAS_SEL, { timeout: 30000 });
    await page.waitForFunction(
      () => {
        const c = document.querySelector('#tool-canvas') || document.querySelector('#tool-content');
        return !!c && (c.children.length > 0 || c.textContent!.trim().length > 0);
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(1000); // fonts + onInit hooks land; the animation is running
    const dataUrl = await page.evaluate(
      async ({ width, height, duration, fps, wait }) => {
        const cap = (globalThis as {
          __lollyCaptureMotion?: (f: string, o: Record<string, number>) => Promise<string | null>;
        }).__lollyCaptureMotion;
        return cap ? await cap('apng', { width, height, duration, fps, wait: wait ?? 0.4, repeat: 0 }) : null;
      },
      { width: job.width, height: job.height, duration: job.duration, fps: job.fps, wait: job.wait ?? 0.4 },
    );
    if (!dataUrl) return null;
    const m = /^data:image\/png;base64,(.*)$/s.exec(dataUrl);
    if (!m) return null;
    const raw = Buffer.from(m[1]!, 'base64');
    return job.colors === 0 ? raw : await optimizeApng(raw, job.colors ?? 128);
  } catch (e) {
    console.log(`    (${toolId}: ${(e as Error).message.split('\n')[0]})`);
    return null;
  } finally {
    page.close().catch(() => {});
  }
}

const execFileP = promisify(execFile);
let ffmpegChecked = false;
let ffmpegOk = false;
async function hasFfmpeg(): Promise<boolean> {
  if (!ffmpegChecked) {
    ffmpegChecked = true;
    try { await execFileP('ffmpeg', ['-version']); ffmpegOk = true; }
    catch { ffmpegOk = false; console.log('  (ffmpeg not found — APNGs kept as full-RGBA; install ffmpeg to shrink ~75%)'); }
  }
  return ffmpegOk;
}

// Palette-quantise an APNG to ~`colors` colours with ffmpeg — keeps every frame + the loop
// count but shares ONE palette across frames, cutting ~75% (an APNG stores full PNG frames
// with no inter-frame delta, so full-RGBA frames dominate the file). Alpha becomes binary (a
// single transparent palette entry), so soft drop-shadows drop out — fine at gallery-tile
// size. No ffmpeg, or a result that isn't smaller → return the original RGBA APNG unchanged,
// so this only ever helps. Temp files (the apng muxer needs seekable output, not a pipe).
async function optimizeApng(bytes: Buffer, colors: number): Promise<Buffer> {
  if (!(await hasFfmpeg())) return bytes;
  const stamp = `${process.pid}-${Math.round(performance.now())}`;
  const inF = join(tmpdir(), `lolly-apng-in-${stamp}.png`);
  const outF = join(tmpdir(), `lolly-apng-out-${stamp}.png`);
  try {
    await writeFile(inF, bytes);
    await execFileP('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', inF,
      '-vf', `split[a][b];[a]palettegen=max_colors=${colors}:reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128`,
      '-plays', '0', '-f', 'apng', outF,
    ]);
    const out = await readFile(outF);
    return out.length > 0 && out.length < bytes.length ? out : bytes;
  } catch {
    return bytes;
  } finally {
    await rm(inF, { force: true }).catch(() => {});
    await rm(outF, { force: true }).catch(() => {});
  }
}

async function writeAndReport(file: string, bytes: Buffer): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
  const kb = (bytes.length / 1024).toFixed(0);
  console.log(`  ✓ ${file.replace(ROOT + '/', '').padEnd(34)} ${kb} KB`);
}

async function loadPlaywright(): Promise<typeof import('playwright')> {
  try {
    return await import('playwright');
  } catch {
    throw new Error('playwright is not installed. Run `npm install`, then `npx playwright install chromium`.');
  }
}

async function waitForServer(baseUrl: string, { tries = 30, delayMs = 1000 } = {}): Promise<void> {
  const { get } = await import('node:http');
  for (let i = 0; i < tries; i++) {
    const ok = await new Promise<boolean>((res) => {
      const req = get(baseUrl, (r) => { r.resume(); res((r.statusCode ?? 500) < 500); });
      req.on('error', () => res(false));
      req.setTimeout(2000, () => { req.destroy(); res(false); });
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r as () => void, delayMs));
  }
  throw new Error(`No web shell reachable at ${baseUrl}. Start one with \`npm run dev:web\` or pass --url=<server>.`);
}
