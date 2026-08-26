#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Animated preview generator.
 *
 * Run as: node scripts/build-animated-previews.ts [--url=http://localhost:5173] [--only=id1,id2]
 *
 * Some tools ANIMATE (pose-geeko's Geeko idles; the digi-ad scenes play; flythrough flies).
 * A static SVG/PNG gallery tile freezes them mid-motion. This script gives such a tool a
 * short LOOPING clip instead, by driving the tool in a real browser and exporting through
 * the app's OWN export path (runtime.export), so the file is byte-faithful to a real user
 * export rather than a second capture pipeline that can drift from one.
 *
 * Two formats, chosen per job (`format`):
 *   • 'apng' (the default) - a valid `.png` the gallery <img> animates natively. Best for a
 *     small flat-colour idle loop. An APNG stores full PNG frames with no inter-frame
 *     delta, so its size scales with width × fps × duration and photographic content
 *     balloons; the ffmpeg palette pass below is what keeps a flat one honest.
 *   • 'webm' - a real video, for anything APNG cannot carry cheaply (photographic, 3-D,
 *     longer than about two seconds). VP8/VP9 has inter-frame prediction, which is exactly
 *     what a continuous camera move needs. Measured on flythrough, 2026-08-26: 3 s at
 *     480x270 is 92 KB as WebM.
 *
 * Neither is ever the tile's resting picture. The still SVG stays the `preview` and the clip
 * is the index's `anim`, played only on hover, on focus, or as the centered tile on touch
 * (shells/web/src/lib/preview-media.ts owns that one policy). So an animated preview costs
 * a user who never hovers exactly nothing.
 *
 * It writes COMMITTED authored overrides in the tool dir, which win over any build-generated
 * preview and (unlike catalog/previews/*, which `npm run previews` regenerates) are never
 * clobbered:
 *   • kind:'looks' → tools/<id>/look<i>.png|.webm  (one clip per manifest example - the
 *                    example carousel tile; build-preview-bundle.ts references it and
 *                    build-previews skips regenerating that look)
 *   • kind:'card'  → tools/<id>/card.png|.webm     (the single gallery card; an APNG card.png
 *                    and a card.webm both resolve to `anim` in build-catalog-index, which
 *                    sniffs the acTL chunk to tell an animated card.png from a still one)
 *
 * Files are kept deliberately SMALL - a gallery tile is tiny. Each job picks a modest size /
 * low fps / short loop; the console prints the resulting KB against the plans/155 WP-5.2
 * budget (250 KB a look, 300 KB an APNG card, 400 KB a WebM) and flags a job that exceeds it.
 * Prefer a card-only clip over animating every example unless the tool's whole point is the
 * moving mascot.
 *
 * Needs a running web shell - point --url at `npm run dev:web` (default localhost:5173). The
 * generator relies on the app's __lollyCaptureMotion hook (shells/web/src/views/tool.ts).
 *
 * WHICH TOOLS MAY HAVE A JOB HERE (Andy's rule, plans/155 WP-5)
 *
 * A tool earns an animated preview ONLY if its content genuinely animates: frames still
 * changing past 700 ms, and still changing at the END of the probe window. A settle-in or
 * entrance transition that finishes on a still frame is NOT animated content, and neither is
 * a tool that merely carries a moving decoration. Those get the static SVG like everything
 * else. A tile is a truthful sample of what the tool makes, so motion in one has to be part
 * of what it makes.
 *
 * That rule is mechanised, not judged by eye: `node scripts/probe-motion.ts` (npm run
 * previews:motion-probe) drives every tool, diffs its frames across that window and writes
 * catalog/previews/motion-report.json with a verdict of `still`, `settles` or `animates`.
 * Only `animates` is eligible.
 *
 * The probe PROPOSES and a human CURATES. An `animates` verdict is a candidate, never an
 * entry: a job appears in JOBS below only after somebody has looked at the tool and written
 * the reason next to it, the same doctrine as the raster allowlist in validate-catalog.ts.
 * Do not add a job by vibes, and do not add one for a tool the probe calls `settles` - if
 * you disagree with a verdict, re-run the probe and bring its numbers.
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import type { BrowserContext } from 'playwright';
// Engine-owned URL encoding - the SAME buildInputModel → serializeUrlState the app's
// seed-url.ts (and build-previews.ts) use, so a look's render URL seeds the identical
// inputs the live carousel would render from.
import { buildInputModel, serializeUrlState } from '../engine/src/index.ts';
import type { InputValue } from '../engine/src/inputs.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CANVAS_SEL = '#tool-canvas, #tool-content';

/** One render job - a tool's example looks, or its single card, as a small looping clip. */
interface Job {
  tool: string;
  kind: 'looks' | 'card';
  /** Container: 'apng' (default) for a flat idle loop, 'webm' where APNG's per-frame PNGs
   *  would balloon. See the header for which is which. */
  format?: MotionFormat;
  width: number;
  height: number;
  /** clip length in seconds (fewer seconds → smaller file). */
  duration: number;
  /** frames/sec (lower → smaller file; renderApng clamps to 2–30). */
  fps: number;
  /** settle seconds before capture starts (lets fonts/hooks land + animation warm up). */
  wait?: number;
  /** kind:'card' - the look to render (falls back to the tool defaults when absent). */
  values?: Record<string, unknown>;
  /** kind:'looks' - restrict to these example indices (default: all). */
  only?: number[];
  /** palette size for the ffmpeg quantise pass (default 128; 0 disables → raw RGBA APNG).
   *  APNG only - a WebM is already inter-frame coded and has no palette. */
  colors?: number;
}

type MotionFormat = 'apng' | 'webm';

/** Per-format facts: the export format name handed to runtime.export, the extension the
 *  committed override takes, and the data-URL MIME the capture hook hands back. */
const FORMATS: Record<MotionFormat, { ext: string; mime: string }> = {
  apng: { ext: 'png', mime: 'image/png' },
  webm: { ext: 'webm', mime: 'video/webm' },
};

/** plans/155 WP-5.2 byte budgets. Over-budget is reported, never silently written: a tile
 *  that costs more than the page it sits on is the thing this whole work package is fixing. */
const BUDGET_KB: Record<string, number> = { 'apng-card': 300, 'apng-looks': 250, 'webm-card': 400, 'webm-looks': 400 };

// The catalog's animated tiles. Prefer a single card clip (kind:'card') per tool to avoid a
// pile of big files; kind:'looks' is for a tool whose whole point is the moving mascot (the
// retired bag-video was the canon case).
//
// The 2026-08-26 motion probe proposed several candidates. Only ONE is a job so far, and
// deliberately: a candidate is not a job, each needs a person to look at the tool and write
// the reason, per the rule in this file's header. The rest of the probe's `animates` list is
// still awaiting that pass - do not bulk-import it.
const JOBS: Job[] = [
  // flythrough - the reference WebM (plans/155 WP-5.2/5.3).
  //
  // Why it earns motion: the probe measured 21.5% / 58.2% / 25.8% / 55.2% frame diffs, i.e.
  // still changing hard at the end of the window, and the change IS the product - the tool's
  // whole output is a camera move through a still image. A frozen frame of it is
  // indistinguishable from the input picture, which makes the static tile actively
  // misleading rather than merely quiet.
  //
  // Why WebM and not APNG: a photographic 3-D scene at 15 fps has no flat palette to share,
  // so every APNG frame is a full photographic PNG. Inter-frame prediction is the whole
  // saving here, and the measured file is 92 KB against the 400 KB budget.
  //
  // Why these numbers: `duration: 3` is set on BOTH the tool input and the export, so the
  // clip is exactly one of the tool's own loop periods and the seam is invisible (the
  // manifest default is a 6 s loop, which is over the 2-4 s budget). The template carries
  // data-capture-stream, so renderVideo records the canvas's own rAF loop at wall-clock
  // speed - a genuinely gapless take rather than a frame-by-frame reassembly. 480x270 keeps
  // the tool's 16:9 and is well inside the 720 px tile ceiling.
  { tool: 'flythrough', kind: 'card', format: 'webm', width: 480, height: 270, duration: 3, fps: 15, wait: 1, values: { duration: 3 } },

  // synth - curated 2026-08-26 (probe: 90.4% / 86.7% / 93.0% / 93.4%, still moving hard at
  // the end of the window). Why it earns motion: synth is a WebGL2 fluid solve advected on
  // the GPU every frame, so a static SVG tile is one arbitrary frame of a chaotic field -
  // the frozen ink says nothing about what the tool DOES, which is move. WebM, not APNG: a
  // photographic per-pixel dye field has no flat palette to share across frames, so every
  // APNG frame would be a full PNG; inter-frame prediction is the whole saving. The template
  // carries data-capture-stream (like flythrough), so renderVideo records the canvas's own
  // rAF loop at wall-clock speed - a gapless take. 480x270 keeps the 16:9 under the 720 px
  // ceiling; duration 3 on both the input and the export makes the clip one settled window.
  { tool: 'synth', kind: 'card', format: 'webm', width: 480, height: 270, duration: 3, fps: 15, wait: 1, values: { duration: 3 } },

  // audiogram - curated 2026-08-26 (probe: 4.9% / 9.9% / 5.9% / 2.9%, moving through the
  // window). Why it earns motion: the waveform is drawn into a canvas and scrubs across the
  // clip - the whole point of an audiogram is the bars reacting to the audio, which a still
  // frame cannot show. WebM (canvas photographic-ish, no flat palette for APNG). No
  // data-capture-stream here, so renderVideo reassembles frame-by-frame - fps is kept low
  // (12) to hold the file down. 480x480 keeps the square aspect under the tile ceiling;
  // duration 4 samples the scrub without carrying the full 8 s loop past the 2-4 s budget.
  { tool: 'audiogram', kind: 'card', format: 'webm', width: 480, height: 480, duration: 4, fps: 12, wait: 0, values: { duration: 4 } },
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

  // Rendering-intent pins matching packages/node-shell/src/browsers.ts (see the
  // comment there): committed output must not depend on the build host's display
  // profile or font hinting.
  const browser = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
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
    console.log(`  · ${job.tool}: no manifest - skipped`);
    return;
  }

  const ext = FORMATS[job.format ?? 'apng'].ext;

  if (job.kind === 'card') {
    const query = seedQuery(manifest, job.values ?? {});
    const bytes = await renderMotion(context, job.tool, query, job);
    if (bytes) await writeAndReport(join(ROOT, 'tools', job.tool, `card.${ext}`), bytes, job);
    else console.log(`  ✗ ${job.tool} card - capture failed`);
    return;
  }

  // looks
  const looks: Array<{ values?: Record<string, unknown> }> =
    (manifest as { examples?: unknown[]; featured?: { variants?: unknown[] } }).examples as never
    ?? (manifest as { featured?: { variants?: unknown[] } }).featured?.variants as never
    ?? [];
  if (!looks.length) { console.log(`  · ${job.tool}: no examples - skipped`); return; }
  for (let i = 0; i < looks.length; i++) {
    if (job.only && !job.only.includes(i)) continue;
    const values = looks[i]?.values;
    if (!values || typeof values !== 'object') continue;
    const query = seedQuery(manifest, values);
    const bytes = await renderMotion(context, job.tool, query, job);
    if (bytes) await writeAndReport(join(ROOT, 'tools', job.tool, `look${i}.${ext}`), bytes, job);
    else console.log(`  ✗ ${job.tool} look${i} - capture failed`);
  }
}

/** Only the look's OWN (dirty) inputs ride the URL - identical to seed-url.ts / build-previews. */
function seedQuery(manifest: Parameters<typeof buildInputModel>[0], values: Record<string, unknown>): string {
  try {
    return serializeUrlState(
      buildInputModel(manifest, { initial: values as Record<string, InputValue> }).filter((m) => m.isDirty),
    );
  } catch {
    return '';
  }
}

async function renderMotion(context: BrowserContext, toolId: string, query: string, job: Job): Promise<Buffer | null> {
  const format = job.format ?? 'apng';
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
    // The SAME hook the still generator's sibling uses, given the tool's own export format
    // name - so a WebM here goes through runtime.export → renderVideo, the exact path a user
    // clicking "webm" takes. `repeat: 0` is the APNG loop-forever count; a WebM loops from
    // the <video loop> attribute instead and ignores it.
    // A WebM is captured LONGER than the job asks for and trimmed back to the exact length
    // by fitVideo below - see WEBM_CAPTURE_MARGIN_S.
    const captureSeconds = format === 'webm' ? job.duration + WEBM_CAPTURE_MARGIN_S : job.duration;
    const dataUrl = await page.evaluate(
      async ({ fmt, width, height, duration, fps, wait }) => {
        const cap = (globalThis as {
          __lollyCaptureMotion?: (f: string, o: Record<string, number>) => Promise<string | null>;
        }).__lollyCaptureMotion;
        return cap ? await cap(fmt, { width, height, duration, fps, wait: wait ?? 0.4, repeat: 0 }) : null;
      },
      { fmt: format, width: job.width, height: job.height, duration: captureSeconds, fps: job.fps, wait: job.wait ?? 0.4 },
    );
    if (!dataUrl) return null;
    // A MediaRecorder blob's type carries codec parameters (video/webm;codecs=vp8), so the
    // MIME is matched as a PREFIX - an exact match silently dropped every recorded clip.
    const { mime } = FORMATS[format];
    const head = `data:${mime}`;
    const comma = dataUrl.indexOf(',');
    if (comma < 0 || !dataUrl.startsWith(head) || !dataUrl.slice(0, comma).endsWith(';base64')) {
      console.log(`    (${toolId}: expected a ${mime} data URL, got ${dataUrl.slice(0, 40)})`);
      return null;
    }
    const raw = Buffer.from(dataUrl.slice(comma + 1), 'base64');
    if (format === 'webm') return await fitVideo(raw, job);
    // The palette pass is an APNG-only trick (one shared palette across full-frame PNGs).
    if (job.colors === 0) return raw;
    return await optimizeApng(raw, job.colors ?? 128);
  } catch (e) {
    console.log(`    (${toolId}: ${(e as Error).message.split('\n')[0]})`);
    return null;
  } finally {
    page.close().catch(() => {});
  }
}

/**
 * Extra seconds recorded beyond a WebM job's `duration`, trimmed back off in `fitVideo`.
 *
 * MediaRecorder stops on a timer, and the clip it hands back is always a little SHORT of
 * that timer - measured 2026-08-26, a 3.0 s request came back 2.83 s. For a normal export
 * nobody notices; for a tile that loops forever, those missing 170 ms are a 6% jump on every
 * wrap. Recording past the mark and cutting to an exact length is the only way to get a clip
 * whose length is exactly one of the tool's own loop periods, which is what makes the seam
 * invisible.
 */
const WEBM_CAPTURE_MARGIN_S = 0.5;

const execFileP = promisify(execFile);
let ffmpegChecked = false;
let ffmpegOk = false;
async function hasFfmpeg(): Promise<boolean> {
  if (!ffmpegChecked) {
    ffmpegChecked = true;
    try { await execFileP('ffmpeg', ['-version']); ffmpegOk = true; }
    catch { ffmpegOk = false; console.log('  (ffmpeg not found - APNGs kept as full-RGBA; install ffmpeg to shrink ~75%)'); }
  }
  return ffmpegOk;
}

// Palette-quantise an APNG to ~`colors` colours with ffmpeg - keeps every frame + the loop
// count but shares ONE palette across frames, cutting ~75% (an APNG stores full PNG frames
// with no inter-frame delta, so full-RGBA frames dominate the file). Alpha becomes binary (a
// single transparent palette entry), so soft drop-shadows drop out - fine at gallery-tile
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

/**
 * Cut a recorded WebM to the job's exact length and down to the job's tile width.
 *
 * Both halves exist because the app's export path deliberately ignores the requested size on
 * this route: a tool marked `data-capture-stream` (flythrough is one) is recorded through
 * `canvas.captureStream()`, which is what buys the gapless real-time loop, and a stream
 * carries the canvas's OWN pixels - so a 1280x720 canvas hands back 1280x720 whatever the
 * job asked for. Measured 2026-08-26: 1280x720 was 58 KB, the same clip at 480x270 is 18 KB
 * and no gallery tile is ever more than a few hundred pixels wide. The trim is the loop-seam
 * fix described at WEBM_CAPTURE_MARGIN_S.
 *
 * Unlike optimizeApng (an optimisation, so it keeps whichever file is smaller) this is a
 * CORRECTNESS pass, so its output is kept whenever ffmpeg succeeds. With no ffmpeg the
 * original is written unchanged and says so - a slightly big, slightly seamy tile beats no
 * tile, and the KB line will show it.
 */
async function fitVideo(bytes: Buffer, job: Job): Promise<Buffer> {
  if (!(await hasFfmpeg())) return bytes;
  const stamp = `${process.pid}-${Math.round(performance.now())}`;
  const inF = join(tmpdir(), `lolly-webm-in-${stamp}.webm`);
  const outF = join(tmpdir(), `lolly-webm-out-${stamp}.webm`);
  try {
    await writeFile(inF, bytes);
    await execFileP('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', inF,
      '-t', String(job.duration),
      // Constant frame rate at exactly the job's fps. A canvas stream is captured at
      // whatever rate the tool actually renders (flythrough manages about 7 fps in headless
      // software GL, not the 15 asked for), and a variable-rate WebM's last block has no
      // duration - so the file ends on its last frame's timestamp and comes out SHORT of the
      // trim mark, which is the loop seam all over again. CFR pins the length; duplicated
      // frames cost almost nothing in an inter-frame codec.
      '-fps_mode', 'cfr', '-r', String(job.fps),
      // A tile preview has no sound and no surface to unmute it from, so the audio track is
      // dropped rather than shipped muted.
      '-an',
      // min(iw, width) never UPSCALES a canvas that was already small; -2 keeps the aspect
      // on an even number of lines, which VP9 requires.
      '-vf', `scale=w=min(iw\\,${job.width}):h=-2`,
      '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-row-mt', '1', '-deadline', 'good',
      outF,
    ]);
    const out = await readFile(outF);
    return out.length > 0 ? out : bytes;
  } catch (e) {
    console.log(`    (ffmpeg fit failed, keeping the raw recording: ${(e as Error).message.split('\n')[0]})`);
    return bytes;
  } finally {
    await rm(inF, { force: true }).catch(() => {});
    await rm(outF, { force: true }).catch(() => {});
  }
}

async function writeAndReport(file: string, bytes: Buffer, job: Job): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
  const kb = bytes.length / 1024;
  const budget = BUDGET_KB[`${job.format ?? 'apng'}-${job.kind}`] ?? 0;
  const over = budget && kb > budget;
  console.log(`  ${over ? '!' : '✓'} ${file.replace(ROOT + '/', '').padEnd(34)} ${kb.toFixed(0)} KB`
    + (over ? `  OVER the ${budget} KB budget - shrink the size, fps or duration, or drop the job` : ''));
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
