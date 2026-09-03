#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Pose the landing's Cover Flow (docs/site/covers.json, plans/177 beat 2).
 *
 * Run as: node scripts/build-covers.ts [--url=http://localhost:5173] [--only=a,b]
 *                                       [--stills] [--videos] [--headed] [--list]
 *
 * One cover per pose below, and every pose is the SAME app wearing a different
 * design system: the run derives a brand a hue apart for each cover (the engine's
 * own deriveBrandTokens, complement scheme - primary plus its complementary
 * secondary), installs it through the shell's #/start chokepoint via the loopback
 * hook `window.__lollyInstallBrand` (shells/web/src/main.ts), switches the app to
 * the constructed *brand* theme, and captures the route. Left to right the fan
 * then walks the hue circle - red through violet - and lib/covers-flow.ts opens on
 * the cover nearest the reader's own brand hue (each cover's `hue` in covers.json
 * is the value posed here; keep the two in step).
 *
 * Stills are a 1200×900 CSS viewport at 2× shrunk to 1040×780 WebP (the card is
 * 520×390 CSS on the landing - 4:3, Andy 2026-09-03 - so 2× device pixels); loops
 * are a 1200×900 screen recording cut to ~6 s of VP9 WebM at the same size, with a
 * WebP poster from the same run. Output goes to docs/shots/covers/ (the docs submodule) - `covers.json`
 * is hand-edited to point at it; this script never touches the copy.
 *
 * Needs a running web shell (dev:web at :5173 by default) on the lolly-start
 * profile - poses install a user brand over the starter tokens, which a locked
 * brand pack would refuse. ffmpeg on PATH for the loops.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { deriveBrandTokens, hexToOklch, oklchToHex, parseOklch } from '../engine/src/brand-derive.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'docs/shots/covers');

/** The card's device-pixel size on the landing: 520×390 CSS at 2×. */
const OUT_W = 1040;
const OUT_H = 780;
/** Capture viewport - 4:3 like the card, at a desktop layout width. */
const VIEW_W = 1200;
const VIEW_H = 900;
const LOOP_SECONDS = 6;
/** OKLCH hue of the lolly-start primary - what `{shift:}` colours were authored against
 *  (the same constant `lib/covers-flow.ts` opens the fan on when there is no brand). */
const LOLLY_HUE = 157.2;

interface CoverPose {
  /** File stem under docs/shots/covers/. */
  slug: string;
  /** OKLCH hue (degrees) of the posed brand's primary - mirrored as `hue` in covers.json. */
  hue: number;
  /** Primary lightness override (yellows and limes read muddy at the default). */
  light?: number;
  /** App route to pose (hash + query, URL-mode inputs included). `{primary}`,
   *  `{primaryDark}` and `{primaryLight}` are replaced with the posed brand's
   *  ramp hexes (steps 5, 3 and 8, URL-encoded) for tools whose colour inputs
   *  don't read the brand on their own; `{shift:rrggbb}` is that literal colour
   *  rotated in OKLCH by the pose's distance from the lolly-start hue, so an
   *  accent authored against the default brand keeps its relationship to the
   *  posed one. Token references (`{color.semantic.muted}`) pass through and
   *  resolve against the posed brand inside the app. */
  route: string;
  /** Selector that must be present before the shot (after any `drive` clicks);
   *  tool routes default to the canvas. */
  wait?: string;
  /** Quiet time after the selector appears, ms (rendering, fonts, decode). */
  settleMs?: number;
  /** Record a loop of this many seconds instead of a still (a screen recording
   *  of the app, 30 fps VP9 - the tile shows the app in motion). */
  video?: number;
  /** Ask the TOOL to export instead of photographing the app: the pose opens the
   *  export panel on the format (`format=<f>&options` on the route, the card's
   *  pixel size as `width`/`height`), sets any video knobs and clicks Download,
   *  so the tile is the render itself. `exportVideo` makes `<slug>.mp4` at the
   *  tool's deterministic frame clock - 60 fps H.264, not a 30 fps recording of
   *  the app around it. `exportStill` makes the still: 'svg' ships `<slug>.svg`
   *  as the cover (crisp at every card size); 'png' becomes `<slug>.webp`, or
   *  the video's `<slug>-poster.webp` when both are set. A video with no still
   *  takes its poster from a frame of the file. */
  exportVideo?: { fps: number; seconds: number; quality?: 'smaller' | 'balanced' | 'best' };
  exportStill?: 'png' | 'svg';
  /** Capture-only CSS (hide a control that reads as noise at card size). */
  css?: string;
  /** Selectors to click, in order, once the route has loaded (open a panel the
   *  URL cannot) - each waits for its element, then a beat for the UI to settle. */
  drive?: string[];
  /** Photograph only this element instead of the viewport - for a cover that is
   *  the tool's OUTPUT rather than the app around it (pair with `?full`, which
   *  drops the chrome and lets the render fill the stage). */
  crop?: string;
}

/**
 * Sixteen poses, 22.5° apart, in hue order. The order here is the order in
 * covers.json; the two must agree or the fan's rainbow breaks.
 */
const POSES: CoverPose[] = [
  { slug: 'darkroom', hue: 0, route: '#/tool/darkroom?treatment=tint&treatShadow={primary}&treatmentAmount=75', settleMs: 5000 },
  // The render alone as the tool's SVG export (Andy, 2026-09-03): the Lolly logo
  // through the halftone with a colour-blend treatment in the pose's own primary
  // (Andy's recipe used a plum; the treatment colour is what carries the tile).
  { slug: 'filter', hue: 22.5,
    route: '#/tool/filter?effect=halftone&image=lolly%2Flogo%2Freverse&ht_gridSize=24&ht_dotScale=1.4&ht_smoothing=0&ht_invert=true&ht_brightness=14&ht_gamma=1.5&ht_fit=cover'
      + '&pz_steps=8&pz_quality=90&pz_smoothing=100&pz_resample=true&pz_brightness=5&pz_bgColor={primaryLight}&contrast=50&hue=38&saturation=106&lightness=1'
      + '&treatmentColor={primary}&blendMode=color&treatmentIntensity=100'
      // A solid ground (Andy, 2026-09-03: not transparent before export) in the pose's light tint.
      + '&ht_transparentBg=false&ht_bgColor={primaryLight}',
    settleMs: 5000, exportStill: 'svg' },
  // Any input in the URL counts as a link and skips the template chooser (views/tool.ts),
  // so a default-valued param opens the brand-swatch default the chooser would hide.
  // Flow mesh in the pose's ramp (Andy, 2026-09-03: mode=flow, five colours on a
  // 4×4 mesh) - the complement was tried as the fifth colour and took over the
  // tile, so it stays in one hue; the PNG export is the still, and the same scene
  // exports a 60 fps loop the card plays.
  { slug: 'gradient', hue: 45, light: 0.7,
    route: '#/tool/gradient?mode=flow&count=5&rows=4&cols=4&color1={primaryDark}&color2={primary}&color3={primaryLight}&color4=%7Bcolor.semantic.surface%7D&color5=%7Bcolor.ramp.primary.9%7D',
    // Grain at 60 fps is costly to encode (Best 4.5 MB, Balanced 3.3 MB for 6 s); Smaller keeps the tile light.
    settleMs: 3000, exportStill: 'png', exportVideo: { fps: 60, seconds: LOOP_SECONDS, quality: 'smaller' } },
  { slug: 'chart', hue: 67.5, light: 0.78, route: '#/tool/chart?chartType=bar', settleMs: 3500 },
  { slug: 'qr-code', hue: 90, light: 0.72, route: '#/tool/qr-code?url=https://lolly.tools&color={primaryDark}', settleMs: 3000 },
  // The render alone, exported by the tool at 60 fps (Andy, 2026-09-03): metaballs on
  // a ground of the tile's own primary (Andy, later: "the same as the colour the
  // carousel item is meant to be"), the first blob in that same colour so the shapes
  // dissolve into their background, the second in primary-3, plus one warm accent
  // shifted to the pose; scale stays at 300, the zoomed-in look.
  { slug: 'backdrop', hue: 112.5, light: 0.66,
    route: '#/tool/backdrop?color1={primary}&color2=%7Bcolor.ramp.primary.3%7D&color3={shift:f3a761}&background={primary}&scale=300',
    settleMs: 3000, exportVideo: { fps: 60, seconds: LOOP_SECONDS } },
  // The Colour Lab (#/lab): one colour reported in full, seeded with the posed primary.
  { slug: 'lab', hue: 135, route: '#/lab?c={primary}', settleMs: 5000 },
  // The design poster from the docs shot recipe (docs/make-something.md): the
  // canvas state rides in ?z=, so it reproduces forever.
  { slug: 'design', hue: 157.5, route: '#/tool/design?z=17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ', settleMs: 4000 },
  // Design's timeline (the Sequence cover): the feature-tour template - five timed
  // beats on a brand-primary ground. A Video-category template opens its own
  // timeline, so no drive click here (one would toggle it shut again).
  { slug: 'sequence', hue: 180, route: '#/tool/design?template=feature-tour', wait: '.tl-panel', settleMs: 4500 },
  // MilkDrop with flexi's bouncing balls, driven by a starter loop - the tool's own
  // 60 fps export (Andy, 2026-09-03): the visual full-bleed behind centred type,
  // brand influence at full, so the card plays the clip and none of the app. The
  // palette LEADS with `accent`, which defaults to the brand's secondary - the
  // complement, so the sky-blue tile came out red - hence accent = the primary.
  { slug: 'audiogram', hue: 202.5, route: '#/tool/audiogram?audio=lolly/loops/pixel-quest-save-point&style=milkdrop&vizLook=stock:flexi-bouncing-balls-double-mindblob-neon-mix&title=Save%20point&subtitle=Pixel%20Quest&layout=overlay-center&vizBrand=full&credit=false&captions=false&size=wide&accent={primary}&bg={primaryDark}', wait: '.lolly-viz-canvas', settleMs: 4000, exportVideo: { fps: 60, seconds: LOOP_SECONDS } },
  { slug: 'street-map', hue: 225, route: '#/tool/street-map?city=brisbane&theme=dark&roadColor={primaryLight}&waterColor={primary}&background={primaryDark}', settleMs: 7000 },
  { slug: '3d', hue: 247.5, route: '#/tool/3d', settleMs: 5000, video: LOOP_SECONDS },
  { slug: 'colours', hue: 270, route: '#/start?area=color', wait: '.start', settleMs: 3500 },
  // The render alone (Andy, 2026-09-03): the card's theme colours carry the cover, so
  // the app chrome around it is dropped and the export fills the frame.
  { slug: 'snippet', hue: 292.5, route: '#/tool/snippet?language=typescript&fileName=make-a-card.ts&code=%2F%2F%20Every%20input%20is%20a%20URL%20param%20-%20the%20CLI%20is%20URL%20mode%0Aconst%20card%20%3D%20new%20URL%28%27https%3A%2F%2Flolly.tools%2Ftool%2Fqr-code.svg%27%29%3B%0Acard.searchParams.set%28%27url%27%2C%20%27https%3A%2F%2Flolly.tools%27%29%3B%0Acard.searchParams.set%28%27color%27%2C%20brand.primary%29%3B%0A%0Aconst%20svg%20%3D%20await%20fetch%28card%29.then%28%28r%29%20%3D%3E%20r.text%28%29%29%3B&full', crop: '#tool-canvas', settleMs: 4000 },
  { slug: 'catalogue', hue: 315, route: '#/c?section=swatches,fonts', wait: '.catalog-view, .cat-view, [data-view="catalog"]', settleMs: 3500 },
  { slug: 'gallery', hue: 337.5, route: '#/', wait: '.gallery-view, .gallery', settleMs: 3500 },
];

interface Opts { url: string; only: string[]; stills: boolean; videos: boolean; headed: boolean; list: boolean }
function parseOpts(argv: string[]): Opts {
  const o: Opts = { url: 'http://localhost:5173', only: [], stills: true, videos: true, headed: false, list: false };
  let kinds = 0;
  for (const a of argv) {
    if (a.startsWith('--url=')) o.url = a.slice(6).replace(/\/$/, '');
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--stills') { o.stills = true; o.videos = false; kinds++; }
    else if (a === '--videos') { o.videos = true; o.stills = false; kinds++; }
    else if (a === '--headed') o.headed = true;
    else if (a === '--list') o.list = true;
    else throw new Error(`Unknown option ${a}`);
  }
  if (kinds > 1) throw new Error('--stills and --videos are exclusive');
  return o;
}

/** The brand a cover wears: a derived design system whose primary sits at `hue`. */
function brandFor(pose: CoverPose): Record<string, unknown> {
  const l = Math.round((pose.light ?? 0.6) * 100);
  return deriveBrandTokens({
    primary: `oklch(${l}% 0.16 ${pose.hue})`,
    scheme: 'complement',
    surface: 'light',
    name: `Cover ${pose.slug} (${pose.hue}°)`,
  }) as Record<string, unknown>;
}

/** A primary-ramp step of a derived doc as #rrggbb (the derive writes oklch()). */
function rampHex(doc: Record<string, unknown>, step: number): string {
  const base = doc.base as Record<string, unknown> | undefined;
  const color = base?.color as Record<string, unknown> | undefined;
  const ramp = color?.ramp as Record<string, unknown> | undefined;
  const primary = ramp?.primary as Record<string, { $value?: string }> | undefined;
  const value = primary?.[String(step)]?.$value;
  const parsed = value ? parseOklch(value) : null;
  if (!parsed) throw new Error(`derived doc has no color.ramp.primary.${step}`);
  return oklchToHex(parsed);
}

/** Fill the route's brand placeholders from the posed doc. */
function routeFor(pose: CoverPose, doc: Record<string, unknown>): string {
  const enc = (step: number): string => encodeURIComponent(rampHex(doc, step));
  return pose.route
    .replace(/\{primary\}/g, enc(5))
    .replace(/\{primaryDark\}/g, enc(3))
    .replace(/\{primaryLight\}/g, enc(8))
    .replace(/\{shift:([0-9a-f]{6})\}/gi, (_m, hex: string) => encodeURIComponent(shiftHue(`#${hex}`, pose.hue - LOLLY_HUE)));
}

/** A hex colour rotated by `deltaDeg` in OKLCH (lightness and chroma kept). */
function shiftHue(hex: string, deltaDeg: number): string {
  const c = hexToOklch(hex);
  if (!c) throw new Error(`shiftHue: not a hex colour: ${hex}`);
  return oklchToHex({ ...c, h: (((c.h + deltaDeg) % 360) + 360) % 360 });
}


/** Seeded before any app code runs: no first-run overlays, the brand theme, and
 *  (stills only) the docs pipeline's neutral-capture state - reduced motion and
 *  eager hydration, which is exactly what a loop must NOT have. */
const initScript = (neutral: boolean): string =>
  "try{localStorage.setItem('lolly-welcome-dismissed','1');" +
  "localStorage.setItem('lolly-tips-dismissed','1');" +
  "localStorage.setItem('lolly-privacy-ack','1');" +
  "localStorage.setItem('theme','brand');" +
  (neutral ? "localStorage.setItem('lolly-capture-neutral','1');" : '') +
  '}catch(_){}';

const HIDE_CSS = `
  * { cursor: none !important; }
  .tool-guide-steps, .privacy-notice, .welcome-dialog, .brand-tips, .job-toast, .toast, .helptip { display: none !important; }
`;

async function main(): Promise<void> {
  const opts = parseOpts(process.argv.slice(2));
  const poses = POSES.filter((p) => !opts.only.length || opts.only.includes(p.slug))
    .filter((p) => (p.video || p.exportVideo ? opts.videos : opts.stills) || (p.exportStill && opts.stills));
  if (opts.only.length) {
    const missing = opts.only.filter((s) => !POSES.some((p) => p.slug === s));
    if (missing.length) throw new Error(`--only names unknown poses: ${missing.join(', ')}`);
  }
  if (opts.list) {
    for (const p of POSES) console.log(`${String(p.hue).padStart(5)}°  ${p.slug.padEnd(12)} ${[p.exportStill, p.exportVideo && 'mp4', p.video && 'loop', !p.exportStill && !p.exportVideo && !p.video && 'still'].filter(Boolean).join('+').padEnd(7)}  ${p.route}`);
    return;
  }
  if (!poses.length) { console.log('Nothing to pose.'); return; }
  mkdirSync(OUT_DIR, { recursive: true });

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: !opts.headed, args: ['--ignore-gpu-blocklist'] });
  const failures: string[] = [];
  try {
    for (const pose of poses) {
      const t0 = Date.now();
      try {
        if (pose.exportStill && opts.stills) await poseExport(browser, opts.url, pose, pose.exportStill);
        if (pose.exportVideo && opts.videos) await poseExport(browser, opts.url, pose, 'mp4');
        else if (pose.video && opts.videos) await poseLoop(browser, opts.url, pose);
        if (!pose.exportStill && !pose.exportVideo && !pose.video) await poseStill(browser, opts.url, pose);
        console.log(`✓ ${pose.slug.padEnd(12)} ${String(pose.hue).padStart(5)}°  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      } catch (err) {
        failures.push(pose.slug);
        console.error(`✗ ${pose.slug}: ${(err as Error).message.split('\n')[0]}`);
      }
    }
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.error(`\n${failures.length} pose(s) failed: ${failures.join(', ')}`);
    process.exit(1);
  }
}

type Browser = Awaited<ReturnType<Awaited<typeof import('playwright')>['chromium']['launch']>>;
type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

/** Boot the app once on the gallery, install the pose's brand through the loopback
 *  hook, then load the route in a FRESH document so it boots wearing the brand. */
async function bootWithBrand(page: Page, base: string, pose: CoverPose): Promise<void> {
  await page.goto(`${base}/#/`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof (window as unknown as { __lollyInstallBrand?: unknown }).__lollyInstallBrand === 'function', null, { timeout: 90_000 });
  const doc = brandFor(pose);
  await page.evaluate(async (d) => {
    await (window as unknown as { __lollyInstallBrand: (doc: unknown, label: string) => Promise<void> }).__lollyInstallBrand(d, 'Cover pose');
  }, doc);
  await page.goto('about:blank');
  await page.goto(`${base}/${routeFor(pose, doc)}`, { waitUntil: 'load' });
  const landed = pose.route.startsWith('#/tool/') ? '#tool-content, #tool-canvas' : 'body';
  await page.waitForSelector(landed, { timeout: 90_000 });
  try {
    if (pose.drive?.length) {
      // A control can be in the DOM before its view has wired it (Design's top bar
      // mounts with the template seed still landing), so let the view settle first.
      await page.waitForTimeout(2500);
    }
    for (const sel of pose.drive ?? []) {
      await page.waitForSelector(sel, { timeout: 30_000 });
      await page.click(sel);
      await page.waitForTimeout(1200);
    }
    if (pose.wait) await page.waitForSelector(pose.wait, { timeout: 90_000 });
  } catch (err) {
    // Leave the evidence beside the outputs: a pose that never settled is a
    // debugging job, and the page as it stood is the first thing to look at.
    const dbg = resolve(tmpdir(), `lolly-cover-${pose.slug}-failed.png`);
    await page.screenshot({ path: dbg }).catch(() => {});
    throw new Error(`${(err as Error).message.split('\n')[0]} (page saved to ${dbg})`);
  }
  await page.addStyleTag({ content: HIDE_CSS + (pose.css ?? '') }).catch(() => {});
  await page.waitForTimeout(pose.settleMs ?? 3000);
  // The chrome's accent must be the posed brand, not the starter's ink - a
  // capture of the wrong brand is worse than no capture.
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim());
  if (!accent) throw new Error('posed brand did not reach the chrome (--brand-primary unset)');
}

async function poseStill(browser: Browser, base: string, pose: CoverPose): Promise<void> {
  const ctx = await browser.newContext({
    viewport: { width: VIEW_W, height: VIEW_H },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    forcedColors: 'none',
  });
  try {
    await ctx.addInitScript({ content: initScript(true) });
    const page = await ctx.newPage();
    await bootWithBrand(page, base, pose);
    const target = pose.crop ? await page.$(pose.crop) : null;
    if (pose.crop && !target) throw new Error(`crop selector ${pose.crop} matched nothing`);
    const png = target ? await target.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' });
    await sharp(png).resize(OUT_W, OUT_H, { fit: 'cover', kernel: 'lanczos3' }).webp({ quality: 84, effort: 6 })
      .toFile(resolve(OUT_DIR, `${pose.slug}.webp`));
  } finally {
    await ctx.close();
  }
}

async function poseLoop(browser: Browser, base: string, pose: CoverPose): Promise<void> {
  const seconds = pose.video ?? LOOP_SECONDS;
  const recDir = resolve(tmpdir(), `lolly-cover-${pose.slug}-${Date.now()}`);
  mkdirSync(recDir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: VIEW_W, height: VIEW_H },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    forcedColors: 'none',
    recordVideo: { dir: recDir, size: { width: VIEW_W, height: VIEW_H } },
  });
  let videoPath: string | null = null;
  const started = Date.now();
  let settledAt = 0;
  try {
    await ctx.addInitScript({ content: initScript(false) });
    const page = await ctx.newPage();
    await bootWithBrand(page, base, pose);
    settledAt = (Date.now() - started) / 1000;
    // Poster from the same run, a beat into the loop so it is a frame the loop
    // actually shows (the card holds it under reduced motion and before play).
    await page.waitForTimeout(1200);
    const png = await page.screenshot({ type: 'png' });
    await sharp(png).resize(OUT_W, OUT_H, { fit: 'cover', kernel: 'lanczos3' }).webp({ quality: 84, effort: 6 })
      .toFile(resolve(OUT_DIR, `${pose.slug}-poster.webp`));
    await page.waitForTimeout(seconds * 1000 + 800);
    const v = page.video();
    await ctx.close();
    videoPath = v ? await v.path() : null;
  } catch (err) {
    await ctx.close().catch(() => {});
    throw err;
  }
  if (!videoPath || !existsSync(videoPath)) throw new Error('no screen recording produced');
  const out = resolve(OUT_DIR, `${pose.slug}.webm`);
  if (existsSync(out)) unlinkSync(out);
  // Cut the boot and the poster pause off the front; VP9 at the card's size, silent.
  const r = spawnSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', (settledAt + 1.2).toFixed(2), '-t', String(seconds),
    '-i', videoPath,
    '-vf', `scale=${OUT_W}:${OUT_H}:flags=lanczos,fps=30`,
    '-an', '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1', '-pix_fmt', 'yuv420p',
    out,
  ], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg exited ${r.status ?? 'signal'} (is ffmpeg on PATH?)`);
  // The recording is a temp file; keep the tree clean.
  try { for (const f of readdirSync(recDir)) unlinkSync(resolve(recDir, f)); rmSync(recDir, { recursive: true, force: true }); } catch { /* best effort */ }
  const kb = Math.round(statSync(out).size / 1024);
  console.log(`   ${pose.slug}.webm ${kb} KB`);
}

/**
 * The tool exports its own file. The route gets `format=<f>&options` so the export
 * panel opens on that format at the card's pixel size; for a video the frame rate
 * and codec sit behind the panel's Pro settings disclosure, so they are set through
 * the DOM (value + input/change, what the panel listens for) rather than clicked
 * open. H.264 is pinned because the tile plays in every browser's <video>, and Auto
 * may pick AV1 or HEVC on this machine. Quality defaults to Balanced - Best made a
 * grainy 6 s clip 4.5 MB, more than a landing tile should cost. A video poster is a frame of the finished
 * file unless the pose exports a PNG still, which then IS the poster.
 */
async function poseExport(browser: Browser, base: string, pose: CoverPose, fmt: 'png' | 'svg' | 'mp4'): Promise<void> {
  const ev = fmt === 'mp4' ? pose.exportVideo : undefined;
  if (fmt === 'mp4' && !ev) throw new Error('poseExport mp4 needs exportVideo');
  const ctx = await browser.newContext({
    viewport: { width: VIEW_W, height: VIEW_H },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    forcedColors: 'none',
    acceptDownloads: true,
  });
  const stillName = pose.exportVideo ? `${pose.slug}-poster.webp` : `${pose.slug}.webp`;
  const out = resolve(OUT_DIR, fmt === 'mp4' ? `${pose.slug}.mp4` : fmt === 'svg' ? `${pose.slug}.svg` : stillName);
  const routed: CoverPose = { ...pose, route: `${pose.route}${pose.route.includes('?') ? '&' : '?'}format=${fmt}&options&width=${OUT_W}&height=${OUT_H}` };
  let bytes: Buffer | null = null;
  try {
    await ctx.addInitScript({ content: initScript(false) });
    const page = await ctx.newPage();
    await bootWithBrand(page, base, routed);
    if (ev) {
      await page.waitForSelector('[data-action="video-fps"]', { state: 'attached', timeout: 30_000 });
      await page.evaluate(({ fps, seconds, quality }) => {
        const set = (sel: string, value: string): void => {
          const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(sel);
          if (!el) throw new Error(`${sel} is not in the export panel`);
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        set('[data-action="video-fps"]', String(fps));
        set('[data-action="video-codec"]', 'avc1.640033');
        set('[data-action="video-quality"]', quality);
        set('[data-action="video-duration"]', String(seconds));
      }, { fps: ev.fps, seconds: ev.seconds, quality: ev.quality ?? 'balanced' });
    } else {
      await page.waitForSelector('[data-action="download"]', { state: 'attached', timeout: 30_000 });
    }
    // Playwright's click waits for the control to hold still; over a WebGL
    // visualiser at 60 fps that check can run out the clock, so fall back to a
    // DOM click, which the panel's listener treats the same.
    const clickDownload = async (): Promise<void> => {
      try {
        await page.click('[data-action="download"]', { timeout: 15_000 });
      } catch (err) {
        console.warn(`   ${pose.slug}: pointer click did not settle (${(err as Error).message.split('\n')[0]}); clicking through the DOM`);
        await page.evaluate(() => (document.querySelector<HTMLElement>('[data-action="download"]') as HTMLElement).click());
      }
    };
    const [download] = await Promise.all([
      // MilkDrop at the card's size takes over ten minutes for 360 frames headless.
      page.waitForEvent('download', { timeout: 1_800_000 }),
      clickDownload(),
    ]);
    if (fmt === 'png') {
      const tmp = resolve(tmpdir(), `lolly-cover-${pose.slug}-${Date.now()}.png`);
      await download.saveAs(tmp);
      bytes = readFileSync(tmp);
      unlinkSync(tmp);
    } else {
      if (existsSync(out)) unlinkSync(out);
      await download.saveAs(out);
    }
    await ctx.close();
  } catch (err) {
    await ctx.close().catch(() => {});
    throw err;
  }
  if (fmt === 'png') {
    if (!bytes) throw new Error('no PNG export received');
    await sharp(bytes).resize(OUT_W, OUT_H, { fit: 'cover', kernel: 'lanczos3' }).webp({ quality: 84, effort: 6 }).toFile(out);
    console.log(`   ${stillName} ${Math.round(statSync(out).size / 1024)} KB (from the PNG export)`);
    return;
  }
  if (fmt === 'svg') {
    const head = readFileSync(out, 'utf8').slice(0, 300);
    if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/.test(head)) throw new Error(`${out} is not an SVG document`);
    console.log(`   ${pose.slug}.svg ${Math.round(statSync(out).size / 1024)} KB`);
    return;
  }
  if (!ev) throw new Error('unreachable');
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,r_frame_rate', '-of', 'csv=p=0', out], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error(`ffprobe failed on ${out} (is ffmpeg on PATH?)`);
  const [codec = '', w = '', h = '', rate = ''] = probe.stdout.trim().split(',');
  const fpsOut = rate.includes('/') ? Number(rate.split('/')[0]) / Number(rate.split('/')[1]) : Number(rate);
  if (codec !== 'h264' || Number(w) !== OUT_W || Number(h) !== OUT_H || Math.round(fpsOut) !== ev.fps) {
    throw new Error(`export is ${codec} ${w}x${h} @ ${fpsOut} fps, wanted h264 ${OUT_W}x${OUT_H} @ ${ev.fps}`);
  }
  // The card plays muted, so an audio track (the audiogram's loop) is dead weight:
  // remux without it, video bytes untouched, and put the index up front so the
  // browser can start on the first bytes.
  const remuxed = `${out}.remux.mp4`;
  const remux = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', out, '-an', '-c:v', 'copy', '-movflags', '+faststart', remuxed], { stdio: 'inherit' });
  if (remux.status !== 0) throw new Error('ffmpeg could not remux the export');
  renameSync(remuxed, out);
  if (pose.exportStill !== 'png') {
    const frame = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', '1.2', '-i', out, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], { maxBuffer: 64 * 1024 * 1024 });
    if (frame.status !== 0 || !frame.stdout.length) throw new Error('could not read a poster frame from the export');
    await sharp(frame.stdout).resize(OUT_W, OUT_H, { fit: 'cover', kernel: 'lanczos3' }).webp({ quality: 84, effort: 6 })
      .toFile(resolve(OUT_DIR, `${pose.slug}-poster.webp`));
  }
  const kb = Math.round(statSync(out).size / 1024);
  console.log(`   ${pose.slug}.mp4 ${kb} KB  (${codec} ${w}x${h} @ ${Math.round(fpsOut)} fps)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
