// SPDX-License-Identifier: MPL-2.0
/**
 * Shadow fidelity: does the walker's vector output actually LOOK like the bitmap?
 *
 * Every other walker suite asserts on structure - is the element there, is it clipped,
 * is the order right. Structure cannot catch a shadow that is present but too soft, or
 * one that darkens through a translucent panel it should have been clipped out of. So
 * this one renders the same markup twice in the same browser - a DOM screenshot, and
 * the walker's SVG rasterised at the same size - and diffs the pixels.
 *
 * ## Why thresholds and not exact equality
 *
 * Box shapes come out exact (0.00% on several rows below), but text does not: the
 * control row `plain text, no shadow at all` measures 0.01% mean / 20.4% worst-pixel
 * with NO shadow involved, purely from glyph antialiasing differing between an SVG
 * `<text>` element and DOM text. That row is in the table on purpose - it is the floor
 * every text row has to be read against, and without it a 4.7% worst-pixel on a
 * blurred text shadow looks like a defect rather than noise.
 *
 * ## What this caught
 *
 * All four of these were shipping, and none of them was visible to a structural test:
 *
 *   - outer shadows painted straight through a translucent background (6.2% mean),
 *     because CSS clips an outer shadow out of the border box and the walker did not
 *   - `text-shadow` not implemented at all
 *   - inset shadows dropped at parse time
 *   - `drop-shadow()` blurred at half the right amount, because it was assumed to
 *     share `box-shadow`'s radius convention. It does not: box-shadow's value is a
 *     radius of 2σ, drop-shadow's IS σ
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPORT_MODULE = fileURLToPath(new URL('./export.ts', import.meta.url));

async function chromiumOrSkip(): Promise<{ chromium: any } | string> {
  let chromium: any;
  try { ({ chromium } = await import('playwright')); }
  catch { return 'playwright not installed'; }
  try {
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}

const browser = await chromiumOrSkip();
const SKIP = typeof browser === 'string' ? browser : false;

let bundleCache: string | null = null;
async function bundle(): Promise<string> {
  if (bundleCache) return bundleCache;
  const { build } = await import('esbuild');
  const out = await build({
    stdin: {
      contents: `import { renderSvgFromHtml } from ${JSON.stringify(EXPORT_MODULE)};
                 window.__render = renderSvgFromHtml;`,
      resolveDir: HERE, loader: 'ts',
    },
    bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent',
    // export.ts reaches a CSS side-effect import through a lazy chain (the durable
    // probe in format-support.ts); esbuild has no output path here, so drop the sheets.
    loader: { ".css": "empty" },
  });
  bundleCache = out.outputFiles[0]!.text;
  return bundleCache;
}

const W = 300, H = 160;

/** Screenshot the DOM, render the walker's SVG, rasterise it at the same size, and
 *  return [mean error, worst single-pixel error], both 0..1. */
async function pixelDiff(inner: string): Promise<[number, number]> {
  const { chromium } = browser as { chromium: any };
  // srgb pin: this harness compares screenshot pixels against in-page canvas
  // data, so the host display profile must not tint the screenshot side.
  const b = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  try {
    const page = await b.newPage({ viewport: { width: W, height: H } });
    await page.setContent(`<!doctype html><body style="margin:0"><div id="root" style="width:${W}px;height:${H}px;background:#fff;font:600 22px/1.4 sans-serif;display:flex;align-items:center;justify-content:center">${inner}</div></body>`);
    const ref = (await page.locator('#root').screenshot()).toString('base64');
    await page.addScriptTag({ content: await bundle() });
    const svg = await page.evaluate(async () => {
      const blob = await (window as any).__render(document.getElementById('root'),
        { convertPaths: false, rasterFallback: false });
      return await blob.text();
    });
    return await page.evaluate(async ({ xml, refB64, w, h }: any) => {
      const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => {
        const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src;
      });
      const a = await load('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml))));
      const r = await load('data:image/png;base64,' + refB64);
      const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c.getContext('2d')!; };
      const x1 = mk(), x2 = mk();
      x1.drawImage(a, 0, 0, w, h); x2.drawImage(r, 0, 0, w, h);
      const d1 = x1.getImageData(0, 0, w, h).data, d2 = x2.getImageData(0, 0, w, h).data;
      let sum = 0, worst = 0;
      for (let i = 0; i < d1.length; i += 4) {
        const e = (Math.abs(d1[i]! - d2[i]!) + Math.abs(d1[i + 1]! - d2[i + 1]!) + Math.abs(d1[i + 2]! - d2[i + 2]!)) / 3;
        sum += e; if (e > worst) worst = e;
      }
      return [sum / (d1.length / 4) / 255, worst / 255];
    }, { xml: svg, refB64: ref, w: W, h: H });
  } finally { await b.close(); }
}

/** `maxMean` / `maxWorst` are the measured value with headroom, not aspirations - 
 *  each row's comment records what it actually measures. */
interface Row { name: string; markup: string; maxMean: number; maxWorst: number }

const box = (css: string) => `<div style="width:140px;height:70px;border-radius:10px;${css}"></div>`;

const ROWS: Row[] = [
  // ── outer box-shadow: exact, and the reason the rest of the file exists ──────
  { name: 'soft outer shadow', markup: box('background:#fff;box-shadow:0 6px 16px rgba(0,0,0,0.35)'),
    maxMean: 0.002, maxWorst: 0.05 },                       // measures 0.02% / 0.4%
  { name: 'hard outer shadow (no blur, pure geometry)', markup: box('background:#fff;box-shadow:0 4px 0 rgba(0,0,0,0.5)'),
    maxMean: 0.001, maxWorst: 0.02 },                       // measures 0.00% / 0.0%
  { name: 'shadow with spread', markup: box('background:#fff;box-shadow:0 0 10px 6px rgba(0,0,0,0.4)'),
    maxMean: 0.002, maxWorst: 0.05 },                       // measures 0.02% / 0.4%

  // CSS paints an outer shadow as if the border box were opaque and clips it away
  // inside that box. Painting it and covering it with the background only works when
  // the background IS opaque; over a frosted panel - which this app is full of - the
  // shadow used to show straight through, at 6.2% mean / 35.7% worst.
  { name: 'outer shadow under a TRANSLUCENT background', markup: box('background:rgba(255,255,255,0.35);box-shadow:0 6px 16px rgba(0,0,0,0.55)'),
    maxMean: 0.003, maxWorst: 0.05 },                       // measures 0.02% / 0.8%

  // Dropped at parse time until the parser learned to flag rather than skip.
  { name: 'inset shadow', markup: box('background:#eee;box-shadow:inset 0 4px 12px rgba(0,0,0,0.5)'),
    maxMean: 0.003, maxWorst: 0.05 },                       // measures 0.02% / 0.8%

  // ── drop-shadow: σ is the blur value itself, NOT half it ────────────────────
  { name: 'drop-shadow', markup: box('background:#4a90d9;filter:drop-shadow(0 6px 12px rgba(0,0,0,0.5))'),
    maxMean: 0.002, maxWorst: 0.03 },                       // measures 0.00% / 0.0%
  { name: 'drop-shadow, opaque colour', markup: box('background:#4a90d9;filter:drop-shadow(0 6px 12px #000)'),
    maxMean: 0.002, maxWorst: 0.03 },                       // measures 0.00% / 0.0%
  // A big blur on a small element: the old -50%/200% bounding-box filter region was a
  // fraction of the ELEMENT, so this one was clipped by its own filter.
  { name: 'drop-shadow, blur larger than the element', markup: `<div style="width:100px;height:50px;background:#4a90d9;filter:drop-shadow(0 0 24px rgba(0,0,0,0.9))"></div>`,
    maxMean: 0.002, maxWorst: 0.03 },                       // measures 0.00% / 0.0%

  // ── text-shadow ─────────────────────────────────────────────────────────────
  // THE CONTROL. No shadow at all: whatever this measures is glyph antialiasing
  // between an SVG <text> and DOM text, and it is the floor for the two rows below.
  { name: 'CONTROL: plain text, no shadow', markup: `<span style="color:#222">Plain</span>`,
    maxMean: 0.002, maxWorst: 0.30 },                       // measures 0.01% / 20.4%
  { name: 'text-shadow, blurred', markup: `<span style="color:#222;text-shadow:0 2px 4px rgba(0,0,0,0.6)">Shadowed</span>`,
    maxMean: 0.004, maxWorst: 0.30 },                       // measures 0.05% / 4.7%
  { name: 'text-shadow, hard offset', markup: `<span style="color:#fff;text-shadow:2px 2px 0 #d33">Shadowed</span>`,
    maxMean: 0.002, maxWorst: 0.30 },                       // measures 0.00% / 0.0%
  { name: 'text-shadow, large blur', markup: `<span style="color:#222;text-shadow:0 0 20px rgba(0,0,0,0.9)">Shadowed</span>`,
    maxMean: 0.006, maxWorst: 0.30 },                       // measures 0.15% / 2.7%
];

for (const row of ROWS) {
  test(`shadow fidelity: ${row.name}`, { skip: SKIP }, async () => {
    const [mean, worst] = await pixelDiff(row.markup);
    assert.ok(mean <= row.maxMean,
      `mean error ${(mean * 100).toFixed(2)}% exceeds ${(row.maxMean * 100).toFixed(2)}%`);
    assert.ok(worst <= row.maxWorst,
      `worst-pixel error ${(worst * 100).toFixed(1)}% exceeds ${(row.maxWorst * 100).toFixed(1)}%`);
  });
}
