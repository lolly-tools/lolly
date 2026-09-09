// SPDX-License-Identifier: MPL-2.0
/**
 * `filter: blur()` and `filter: drop-shadow()` reaching PDF export (plan 104 section 2, P1d).
 *
 * Until this landed they did not reach it at all, and did so SILENTLY: the PDF walker
 * has no `filter` branch, but `detectUnsupportedCss` declared any parseable filter
 * "supported" for every caller, so the raster escape hatch never fired and the effect
 * was simply absent from the file. No warning, no degraded version, nothing. That made
 * design's DOF blur and its `shadow: content` / `shadow: depth` silhouettes
 * PDF-invisible - the two effects plan 104's depth work is built out of.
 *
 * The oracle is the PDF's object structure, not pixels. "Did the effect survive into the
 * file at all" is exactly answerable by counting embedded image XObjects, and it is the
 * question that was wrong; how CLOSE the result is to the browser is already measured,
 * per-effect and against real pixels, by export-pdf-shadow-fidelity.test.ts.
 *
 * The SVG assertions are the other half. The fix is a capability SIGNAL - the SVG walker
 * declares `cssFilter` because it emits the chain, the PDF walker declines it because it
 * cannot - so the thing that could go wrong is the signal leaking and turning crisp SVG
 * filters into bitmaps. Every fixture is therefore checked in both sinks: raster in PDF,
 * still real `<filter>` primitives and NO `<image>` in SVG.
 *
 * Real Chromium, self-skipping when one isn't installed: `getComputedStyle` has to
 * resolve `filter` to its computed serialisation (jsdom returns '', and the nested
 * `rgba()` in that serialisation is exactly what the spill measurement used to trip
 * over), and the geometry has to be real layout. Same gated pattern as
 * export-backdrop-blur.test.ts (tests/README.md).
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
      contents: `import { renderPdf, renderSvgFromHtml, effectSpillCss } from ${JSON.stringify(EXPORT_MODULE)};
                 window.__pdf = renderPdf;
                 window.__svg = renderSvgFromHtml;
                 window.__spill = effectSpillCss;`,
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
 * The exact CSS design's `shadowCss`/`blurCss` emit, so this tests the shipping
 * declarations rather than a plausible-looking imitation:
 *   blur          → `filter: blur(Npx)`                       (blurCss)
 *   shadow:content→ `filter: drop-shadow(x y b <colour>)`     (shadowCss, manual tier)
 *   shadow:depth  → `filter: drop-shadow(0px dy db #00000055)`(shadowCss, derived from z)
 *                   z = 100 → dy = z·0.15 = 15, blur = 10 + z·0.2 = 30
 * and one box carrying BOTH, which is what a blurred box with a depth shadow computes to
 * (compute() merges them into a single `filter` declaration, blur first).
 *
 * Declared in ASCENDING spill order - 24, 42, 105, 120 CSS px - because the walker paints
 * in DOM order, which makes the emitted images' own /Width a per-box readout of the
 * padding each one was captured with. The mixed box's blur is deliberately large enough
 * to out-reach its own drop-shadow (40·3 = 120 > 30·3+15 = 105), so its number can only
 * come from measuring the blur half of a chain neither whole-value parser accepts.
 */
const BOXES: Record<string, string> = {
  blur:    'filter:blur(8px)',
  content: 'filter:drop-shadow(0px 6px 12px #00000055)',
  depth:   'filter:drop-shadow(0px 15px 30px #00000055)',
  mixed:   'filter:blur(40px) drop-shadow(0px 15px 30px #00000055)',
};

/** `filtered` off → the identical geometry with no `filter` at all: the premise control. */
function fixture(filtered: boolean): string {
  const cells = Object.entries(BOXES).map(([id, css]) =>
    `<div id="${id}" style="width:90px;height:60px;border-radius:10px;background:#4a90d9;${filtered ? css : ''}"></div>`);
  return `<div id="root" style="width:520px;height:120px;background:#fff;display:flex;gap:16px;align-items:center;justify-content:center">${cells.join('')}</div>`;
}

/** Render #root to PDF (latin1 text), to SVG, and read back the measured filter spill. */
async function renderBoth(filtered: boolean): Promise<{ pdf: string; svg: string; spill: Record<string, number> }> {
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: 640, height: 200 } });
    await page.setContent(`<!doctype html><body style="margin:0">${fixture(filtered)}</body>`);
    await page.addScriptTag({ content: await bundle() });
    const out = await page.evaluate(async (ids: string[]) => {
      const root = document.getElementById('root')!;
      const pdfBlob = await (window as any).__pdf(root, {});
      const buf = new Uint8Array(await pdfBlob.arrayBuffer());
      let pdf = ''; for (const byte of buf) pdf += String.fromCharCode(byte);
      // rasterFallback stays ON for SVG: the point of the SVG half is that the walker
      // keeps these vector even though the hatch is available to it.
      const svg = await (await (window as any).__svg(root, { convertPaths: false })).text();
      const spill: Record<string, number> = {};
      for (const id of ids) spill[id] = (window as any).__spill(getComputedStyle(document.getElementById(id)!));
      return { pdf, svg, spill };
    }, Object.keys(BOXES));
    return out;
  } finally { await b.close(); }
}

/**
 * The COLOUR image XObjects, in the order they were written.
 *
 * Scoped to /DeviceRGB on purpose: jsPDF writes a second, DeviceGray image object as the
 * /SMask alpha companion of every RGBA PNG, so a bare `/Subtype /Image` count reads
 * double. The dictionaries are uncompressed, so this is exact rather than a heuristic.
 */
function embeddedImages(pdf: string): { width: number; height: number }[] {
  const re = /\/Subtype\s*\/Image\s*\/Width\s+(\d+)\s*\/Height\s+(\d+)\s*\/ColorSpace\s*\/DeviceRGB/g;
  return [...pdf.matchAll(re)].map((m) => ({ width: Number(m[1]), height: Number(m[2]) }));
}
const count = (s: string, needle: string) => s.split(needle).length - 1;

test('blur, shadow:content and shadow:depth each reach the PDF as an embedded image',
  { skip: SKIP }, async () => {
    const on = await renderBoth(true);
    const off = await renderBoth(false);

    // The premise. Four plain rounded rects are pure vector, so ANY image object in the
    // filtered render is one the escape hatch put there - which is what makes the count
    // below essential rather than a description of what the walker already did.
    assert.equal(embeddedImages(off.pdf).length, 0,
      'premise: the same four boxes without a filter emit no image objects at all');

    // One per filtered box. Fewer means a filter was declared "supported" by
    // detectUnsupportedCss and then quietly dropped by a walker that cannot draw it.
    const imgs = embeddedImages(on.pdf);
    assert.equal(imgs.length, Object.keys(BOXES).length,
      `expected one embedded image per filtered box (${Object.keys(BOXES).join(', ')})`);

    // Identical boxes, so the ONLY thing that can vary their capture size is the spill
    // padding - and BOXES is declared in ascending spill order. Strictly increasing
    // widths is therefore a per-box readout that each capture was actually grown to hold
    // the effect that paints outside the box, rather than all four being sized to the
    // bare rect and shearing it off (which measured 2.1% mean / 32% worst-pixel).
    const widths = imgs.map((i) => i.width);
    for (let i = 1; i < widths.length; i++) {
      assert.ok(widths[i]! > widths[i - 1]!,
        `expected capture widths to grow with spill, got ${widths.join(' < ')}`);
    }
  });

test('the same filters stay VECTOR in SVG - the PDF cap must not leak across walkers',
  { skip: SKIP }, async () => {
    const on = await renderBoth(true);

    // blur(8px): CSS blur(N) is a Gaussian of stdDeviation N (unlike backdrop-filter's
    // and box-shadow's radius conventions, this one is 1:1 - css-filter.ts).
    assert.match(on.svg, /<feGaussianBlur[^>]*stdDeviation="8"/,
      'expected the layer blur as a real SVG filter primitive');
    // content + depth are drawn as geometry, which also survives EMF/EPS.
    assert.equal(count(on.svg, '<feDropShadow'), 2,
      'expected shadow:content and shadow:depth as <feDropShadow> primitives');
    // The mixed chain has always rasterised in SVG too (parseDropShadowFilter refuses a
    // chain containing blur, and parseCssFilter cannot tokenise the nested rgba()), so
    // exactly ONE <image> is expected - not zero, and emphatically not four.
    assert.equal(count(on.svg, '<image'), 1,
      'expected only the mixed blur+drop-shadow chain to rasterise in SVG');
  });

test('a mixed blur + drop-shadow chain is measured for spill, not silently written off',
  { skip: SKIP }, async () => {
    const { spill } = await renderBoth(true);

    // 3σ each, plus the drop-shadow's offset. These are the numbers the raster hatch
    // pads its capture by; a capture sized to the bare box shears the effect off, which
    // measured 2.1% mean / 32% worst-pixel against the browser.
    assert.equal(spill.blur, 24, 'blur(8px) reaches 3σ = 24px');
    assert.equal(spill.content, 42, 'drop-shadow blur 12px·3 + 6px offset = 42px');
    assert.equal(spill.depth, 105, 'drop-shadow blur 30px·3 + 15px offset = 105px');

    // The regression this pins. A mixed chain defeats BOTH parsers - parseDropShadowFilter
    // refuses a chain containing a non-drop-shadow function, and parseCssFilter's flat
    // tokeniser cannot see past the nested rgba() of the computed drop-shadow colour - so
    // the chain that spills FURTHEST used to measure exactly zero and get cropped at the
    // box edge. 120 is the blur half winning over the shadow half (40·3 vs 30·3+15): it
    // cannot be produced by either parser reading the whole value, only by per-function
    // measurement, so this number is what distinguishes the fix from a lucky salvage.
    assert.equal(spill.mixed, 120,
      'blur(40px)·3 = 120 out-reaches the same chain\'s drop-shadow (105), and neither is 0');
  });
