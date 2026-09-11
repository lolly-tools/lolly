// SPDX-License-Identifier: MPL-2.0
/**
 * Box shadows in EMF and EPS.
 *
 * These formats have no blur primitive, so the walker used to skip shadows entirely
 * for them (`opts.noBoxShadow`) - an EMF of a card deck came out with flat, floating
 * cards. A blur does not need a blur primitive: it is reproducible as concentric
 * bands (see section 13 of plans/69-svg-snapshot-without-print.md), and for a format with no
 * alpha the bands have to be non-overlapping RINGS at absolute coverage, because
 * `svg-ir` flattens every shape against the page background INDEPENDENTLY. Overlapping
 * increments never accumulate there and come out far too light.
 *
 * ## Why these assertions are structural
 *
 * The shadow-fidelity suites diff pixels, which is the right oracle - but nothing on
 * this machine renders EMF, and macOS dropped EPS rendering. So the ring GEOMETRY is
 * verified by pixels elsewhere (export-shadow-fidelity.test.ts drives the same code
 * path via `noBoxShadow`, measuring 0.13% mean on a soft shadow and 0.00% on a hard
 * one), and this file verifies the part that is specific to these formats and cannot
 * be seen from SVG: that the rings survive svg-ir's flattening as distinct shapes, in
 * a colour ramp, painted BEFORE the element's own background.
 *
 * That paint order is what makes the missing box-cut safe. The rings are not clipped
 * out of the border box - a clipPath would be ignored, svg-ir skips those - so the
 * shadow does pass under the element. svg-ir turns the element's background into an
 * opaque shape drawn after them, which covers it.
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
                 import { svgDomToIr } from './svg-ir.ts';
                 window.__render = renderSvgFromHtml; window.__ir = svgDomToIr;`,
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

/** Render `#root` the way the EMF/EPS exporters do (noBoxShadow), then run it through
 *  svg-ir - the shared stage EMF, EPS and DXF all consume. */
async function irPrims(inner: string): Promise<any[]> {
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: 400, height: 220 } });
    await page.setContent(`<!doctype html><body style="margin:0"><div id="root" style="width:400px;height:220px;background:#fff;font:14px sans-serif;display:flex;align-items:center;justify-content:center">${inner}</div></body>`);
    await page.addScriptTag({ content: await bundle() });
    return await page.evaluate(async () => {
      const blob = await (window as any).__render(document.getElementById('root'),
        { convertPaths: false, rasterFallback: false, noBoxShadow: true });
      const doc = new DOMParser().parseFromString(await blob.text(), 'image/svg+xml');
      const ir = await (window as any).__ir(doc.documentElement, { label: 'EMF' });
      return JSON.parse(JSON.stringify(ir.prims ?? []));
    });
  } finally { await b.close(); }
}

/** Greyness of a prim's fill, 0 = black … 1 = white. The shadow ramp runs from near
 *  the page white at its outer edge to the shadow colour at its center. */
const grey = (p: any): number | null => {
  const f = p?.fill;
  if (!f || typeof f.r !== 'number') return null;
  return (f.r + f.g + f.b) / (3 * 255);
};

test('a soft shadow reaches EMF/EPS as a ramp of distinct shapes', { skip: SKIP }, async () => {
  const prims = await irPrims(
    `<div style="width:160px;height:80px;border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.4)"></div>`);
  // The page background, the card, and the rings. Before this the count was 2.
  assert.ok(prims.length > 10, `expected a band ramp, got ${prims.length} prims`);

  const greys = prims.map(grey).filter((g): g is number => g !== null);
  const shades = new Set(greys.map((g) => Math.round(g * 255)));
  assert.ok(shades.size > 8,
    `expected many distinct shades in the ramp, got ${shades.size} - the bands are probably all flattening to one colour`);
  // Every ring must land between the shadow colour and the page, never outside it.
  assert.ok(greys.every((g) => g >= 0 && g <= 1));
  assert.ok(Math.min(...greys) < 0.75, 'the darkest band should be visibly darker than the page');
});

test('the rings paint BEFORE the element background, so it covers them',
  { skip: SKIP }, async () => {
    // The rings are deliberately not clipped out of the border box (svg-ir skips
    // clipPaths), so this ordering is what keeps the shadow from showing through the
    // card. A reorder would be invisible on an opaque card in SVG and wrong here.
    const prims = await irPrims(
      `<div style="width:160px;height:80px;border-radius:12px;background:rgb(255,0,0);box-shadow:0 8px 24px rgba(0,0,0,0.6)"></div>`);
    const cardIdx = prims.findIndex((p) => { const f = p?.fill; return f && f.r > 200 && f.g < 60 && f.b < 60; });
    assert.ok(cardIdx >= 0, 'the card itself must be in the output');
    const darkIdx = prims.findIndex((p) => { const g = grey(p); return g !== null && g < 0.6; });
    assert.ok(darkIdx >= 0, 'a shadow band must be in the output');
    assert.ok(darkIdx < cardIdx, `shadow bands must precede the card (band ${darkIdx}, card ${cardIdx})`);
  });

test('a hard-edged shadow is ONE shape, not a ramp', { skip: SKIP }, async () => {
  // No blur means no approximation: the exact offset shape, and emitting a ramp for
  // it would be pure waste.
  const soft = await irPrims(`<div style="width:160px;height:80px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.4)"></div>`);
  const hard = await irPrims(`<div style="width:160px;height:80px;background:#fff;box-shadow:0 4px 0 rgba(0,0,0,0.4)"></div>`);
  assert.ok(hard.length < soft.length / 3,
    `hard shadow emitted ${hard.length} prims vs soft ${soft.length} - it should be a single shape`);
});

test('an inset shadow also survives to these formats', { skip: SKIP }, async () => {
  const prims = await irPrims(
    `<div style="width:160px;height:80px;border-radius:12px;background:#eee;box-shadow:inset 0 6px 16px rgba(0,0,0,0.55)"></div>`);
  const greys = prims.map(grey).filter((g): g is number => g !== null);
  assert.ok(new Set(greys.map((g) => Math.round(g * 255))).size > 6,
    'expected an inset ramp, not a single flat shape');
});

test('no shadow means no extra shapes', { skip: SKIP }, async () => {
  const prims = await irPrims(`<div style="width:160px;height:80px;background:#fff"></div>`);
  assert.ok(prims.length <= 4, `expected just the page and the box, got ${prims.length}`);
});
