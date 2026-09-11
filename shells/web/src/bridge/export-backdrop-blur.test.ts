// SPDX-License-Identifier: MPL-2.0
/**
 * `backdrop-filter: blur()` in the HTML→SVG walker, under `ExportOpts.backdropBlur`.
 *
 * SVG has no primitive that reads what is painted behind an element, and the raster
 * escape hatch cannot substitute for one: dom-to-image serialises the node into a
 * `<foreignObject>`, and the backdrop is by definition OUTSIDE that subtree, so a
 * frosted panel rasterised on its own comes back transparent. That is why this is
 * reconstructed instead - the content already emitted behind the element is cloned,
 * clipped to the element's shape, and blurred.
 *
 * The oracle is the emitted SVG's structure, not pixels: the question "did the
 * backdrop get duplicated, clipped and blurred" is exactly answerable, whereas a
 * pixel diff of a blur needs fonts, goldens and a tolerance and would still pass on
 * a panel that merely looks hazy for the wrong reason.
 *
 * Real Chromium, self-skipping when one isn't installed - `getComputedStyle` has to
 * resolve `backdrop-filter` (jsdom returns '') and the geometry has to be real
 * layout, so a hand-fed computed style would only test the fake. Same gated pattern
 * as export-paint-order.test.ts (tests/README.md).
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

/**
 * Render `#root` and return the SVG text.
 *
 * rasterFallback:false throughout: it keeps the output pure vector, and it makes the
 * flag-off premise unambiguous - with no hatch to fire, an unhandled backdrop-filter
 * leaves NO blur in the output at all, so the flag-on assertions can't pass by
 * accident.
 */
async function render(markup: string, backdropBlur: boolean, rasterFallback = false): Promise<string> {
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`<!doctype html><body style="margin:0">${markup}</body>`);
    await page.addScriptTag({ content: await bundle() });
    return await page.evaluate(async (o: { bb: boolean; rf: boolean }) => {
      const blob = await (window as any).__render(document.getElementById('root'),
        { convertPaths: false, rasterFallback: o.rf, backdropBlur: o.bb || undefined });
      return await blob.text();
    }, { bb: backdropBlur, rf: rasterFallback });
  } finally { await b.close(); }
}

const count = (s: string, needle: string) => s.split(needle).length - 1;

/** A red backdrop stripe with a frosted panel over it. `panel` adds panel CSS. */
const fixture = (panel = '') => `<div id="root" style="position:relative;width:300px;height:200px;background:#fff">
  <div style="position:absolute;left:0;top:60px;width:300px;height:40px;background:rgb(220,38,38)"></div>
  <div style="position:absolute;left:50px;top:40px;width:200px;height:80px;border-radius:12px;
              backdrop-filter:blur(6px);background:rgba(255,255,255,0.3);${panel}"></div>
</div>`;

test('a blurred backdrop is reconstructed: content behind is cloned, clipped and blurred',
  { skip: SKIP }, async () => {
    const svg = await render(fixture(), true);

    // The blur itself. CSS blur(6px) is a Gaussian of stdDeviation 6/2 = 3
    // (Filter Effects section ; the two are defined a factor of two apart, and getting this
    // wrong is the difference between a frosted panel and a smeared one).
    assert.match(svg, /<feGaussianBlur[^>]*stdDeviation="3"/,
      'expected a feGaussianBlur at half the CSS blur radius');

    // The duplication: the stripe behind the panel must now appear TWICE - once as
    // itself, once inside the blurred copy. One occurrence means the backdrop was
    // never cloned and the filter is blurring nothing.
    assert.equal(count(svg, 'rgb(220,38,38)') + count(svg, 'rgb(220, 38, 38)'), 2,
      'expected the backdrop stripe to appear twice (original + blurred clone)');

    // The clip: without it the blurred copy of the whole page paints over everything.
    assert.match(svg, /<clipPath[^>]*id="fcbdclip-/, 'expected a clipPath for the panel shape');
    assert.match(svg, /clip-path="url\(#fcbdclip-/, 'expected the blurred copy to be clipped to it');

    // Premise: none of this is present without the flag, so the assertions above are
    // essential rather than describing what the walker already did.
    const off = await render(fixture(), false);
    assert.doesNotMatch(off, /feGaussianBlur/, 'premise: flag off leaves no blur in the output');
    assert.equal(count(off, 'rgb(220,38,38)') + count(off, 'rgb(220, 38, 38)'), 1,
      'premise: flag off emits the backdrop exactly once');
  });

test('the filter region is scoped to the element box, not the duplicated backdrop',
  { skip: SKIP }, async () => {
    // objectBoundingBox units would size the filter to the bbox of the whole cloned
    // backdrop - near page-sized - making the blur cost scale with the page rather
    // than the panel.
    const svg = await render(fixture(), true);
    const m = /<filter id="fcbd-\d+"([^>]*)>/.exec(svg);
    assert.ok(m, 'expected a backdrop filter element');
    assert.match(m![1]!, /filterUnits="userSpaceOnUse"/, 'expected a user-space filter region');
    // 200×80 panel padded by blur*2+4 = 16 on each side.
    assert.match(m![1]!, /width="232"/, 'expected the region to be the panel box plus blur padding');
    assert.match(m![1]!, /height="112"/, 'expected the region to be the panel box plus blur padding');
  });

test('a rotated frosted panel is left alone rather than double-transformed',
  { skip: SKIP }, async () => {
    // The clone is in root user space. Under a rotation wrapper it would be rotated a
    // second time, putting the "backdrop" somewhere the backdrop never was - visibly
    // worse than not reconstructing it. Such panels fall through to the raster hatch.
    const svg = await render(fixture('transform:rotate(12deg)'), true);
    assert.doesNotMatch(svg, /feGaussianBlur/,
      'expected no backdrop reconstruction under a transform');
  });

test('a backdrop-filter that is more than a plain blur is not faked',
  { skip: SKIP }, async () => {
    // saturate/brightness operate on the backdrop in ways the clone-and-blur trick
    // cannot reproduce. Emitting a blur alone would be a silent wrong answer, so the
    // element stays with the escape hatch.
    const svg = await render(fixture().replace('blur(6px)', 'blur(6px) saturate(180%)'), true);
    assert.doesNotMatch(svg, /feGaussianBlur/,
      'expected a filter chain to be left to the raster hatch');
  });

// ── the caps must report the OUTCOME, not the request ───────────────────────
//
// The raster-fallback caps used to pass `backdropBlur: opts.backdropBlur === true`,
// i.e. "the caller ASKED for reconstruction", regardless of whether the clone was
// actually appended. A rotated or over-cap panel therefore skipped the clone AND told
// detectUnsupportedCss the property was supported, so it never reached the raster
// hatch either - the frost vanished with nothing emitted and nothing said. These run
// with rasterFallback ON, which the tests above deliberately keep off, so the oracle
// is "did the hatch fire" rather than "is there no blur".

test('a rotated frosted panel reaches the raster hatch instead of silently dropping the frost',
  { skip: SKIP }, async () => {
    const svg = await render(fixture('transform:rotate(12deg)'), true, true);
    assert.doesNotMatch(svg, /feGaussianBlur/, 'premise: no reconstruction under a transform');
    assert.match(svg, /<image[^>]+href="data:image\/(png|jpeg)/,
      'expected the panel to be rasterised rather than emitted frostless');
  });

test('a chained backdrop-filter reaches the raster hatch too',
  { skip: SKIP }, async () => {
    const svg = await render(fixture().replace('blur(6px)', 'blur(6px) saturate(180%)'), true, true);
    assert.doesNotMatch(svg, /feGaussianBlur/, 'premise: a chain is never faked');
    assert.match(svg, /<image[^>]+href="data:image\/(png|jpeg)/,
      'expected the chained panel to be rasterised');
  });

test('a reconstructed panel does NOT rasterise - the caps stay honest in both directions',
  { skip: SKIP }, async () => {
    // The mirror of the two above: when the clone really was appended, the element
    // must stay vector. Without this, "always report unsupported" would pass them.
    const svg = await render(fixture(), true, true);
    assert.match(svg, /<feGaussianBlur[^>]*stdDeviation="3"/, 'the reconstruction ran');
    assert.doesNotMatch(svg, /<image[^>]+href="data:image\/(png|jpeg)/,
      'a successfully reconstructed panel is not also rasterised');
  });
