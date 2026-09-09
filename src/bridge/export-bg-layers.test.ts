// SPDX-License-Identifier: MPL-2.0
/**
 * `background-image` is a LIST, and the HTML→SVG walker has to emit one paint
 * element per layer.
 *
 * The defect this pins: the gradient builders matched with `^linear-gradient\((.+)\)$`,
 * whose `.+` is greedy - so a computed `linear-gradient(a, b), linear-gradient(c, d)`
 * matched as ONE gradient and the two stop lists were concatenated into a single
 * element. Stop offsets restart at the layer boundary, SVG clamps `<stop offset>`
 * monotonically, and the result is not a near-miss: on `docs/shots/brand-colours.svg`
 * every flat swatch chip (a colour layer under a gloss layer) painted as a
 * dark-to-white fade. Nothing failed - the SVG was valid, just wrong.
 *
 * Asserted on the emitted markup, not pixels: layer COUNT and stop grouping are what
 * the CSS spec constrains here, and a pixel oracle would need fonts, a golden and a
 * tolerance to say something weaker. Same Chromium-gated pattern as
 * export-paint-order.test.ts - jsdom cannot resolve a computed multi-layer
 * `background-image`, so a fake computed style would only test the fake.
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
      resolveDir: HERE,
      loader: 'ts',
    },
    bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent',
    // export.ts reaches a CSS side-effect import through a lazy chain (the durable
    // probe in format-support.ts); esbuild has no output path here, so drop the sheets.
    loader: { ".css": "empty" },
  });
  bundleCache = out.outputFiles[0]!.text;
  return bundleCache;
}

async function renderFixture(markup: string): Promise<string> {
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: 400, height: 300 } });
    await page.setContent(`<!doctype html><body style="margin:0">${markup}</body>`);
    await page.addScriptTag({ content: await bundle() });
    return await page.evaluate(async () => {
      const blob = await (window as any).__render(document.getElementById('root'),
        { convertPaths: false, rasterFallback: false });
      return await blob.text();
    });
  } finally { await b.close(); }
}

/** Each `<linearGradient>` in document order, as its list of stop colours. */
function gradientStops(svg: string): string[][] {
  return [...svg.matchAll(/<linearGradient\b[^>]*>([\s\S]*?)<\/linearGradient>/g)]
    .map(m => [...m[1]!.matchAll(/stop-color="([^"]+)"/g)].map(s => s[1]!));
}
/** Each `<linearGradient>`'s stop offsets as numbers (percent or 0-1 → percent). */
function gradientOffsets(svg: string): number[][] {
  return [...svg.matchAll(/<linearGradient\b[^>]*>([\s\S]*?)<\/linearGradient>/g)]
    .map(m => [...m[1]!.matchAll(/offset="([^"]+)"/g)]
      .map(s => s[1]!.endsWith('%') ? parseFloat(s[1]!) : parseFloat(s[1]!) * 100));
}

// ── The measured case: a colour layer under a gloss layer ─────────────────────
// Shape lifted from the brand-editor swatch chip in docs/shots/brand-colours.svg.
test('two stacked linear-gradients emit TWO gradients, not one merged stop list',
  { skip: SKIP }, async () => {
    const markup = `<div id="root" style="width:80px;height:80px;background-image:` +
      `linear-gradient(rgb(9,20,38), rgba(78,94,116,0.35) 25%),` +
      `linear-gradient(rgb(252,252,252), rgb(252,252,252))"></div>`;
    const svg = await renderFixture(markup);
    const stops = gradientStops(svg);
    assert.equal(stops.length, 2, `expected one <linearGradient> per layer, got ${stops.length}`);
    // Bottom-first: CSS lists layers top-first and paints them in reverse.
    assert.deepEqual(stops[0], ['#fcfcfc', '#fcfcfc'], 'the LAST-listed layer paints first');
    assert.deepEqual(stops[1], ['#091426', '#4e5e74'], 'the FIRST-listed layer paints on top');
    // The defect's signature: offsets that go backwards inside one element.
    for (const offs of gradientOffsets(svg)) {
      assert.ok(offs.every((o, i) => i === 0 || o >= offs[i - 1]!),
        `stop offsets must not decrease inside one gradient - got ${offs.join(', ')}`);
    }
  });

// ── The single-layer path must be untouched ──────────────────────────────────
test('a single-layer gradient still emits exactly one gradient with its own stops',
  { skip: SKIP }, async () => {
    const markup = `<div id="root" style="width:80px;height:80px;` +
      `background-image:linear-gradient(90deg, rgb(255,0,0), rgb(0,0,255))"></div>`;
    const svg = await renderFixture(markup);
    assert.deepEqual(gradientStops(svg), [['#ff0000', '#0000ff']]);
  });

// ── Layer-indexed background-size ────────────────────────────────────────────
// `background-size`/`position`/`repeat` are per-layer lists too. Reading the whole
// list as one value fed `placeBackground` a string like "40px 40px, cover" - the top
// layer's geometry applied to every layer.
test('each layer takes its OWN background-size, not the first entry in the list',
  { skip: SKIP }, async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const markup = `<div id="root" style="width:200px;height:200px;` +
      `background-image:url(${png}),url(${png});` +
      `background-size:40px 40px,120px 120px;background-repeat:no-repeat"></div>`;
    const svg = await renderFixture(markup);
    const widths = [...svg.matchAll(/<image\b[^>]*\bwidth="([\d.]+)"/g)].map(m => Number(m[1]));
    assert.deepEqual(widths, [120, 40],
      'bottom layer at its own 120px, top layer at 40px (both, in paint order)');
  });
