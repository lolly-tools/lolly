// SPDX-License-Identifier: MPL-2.0
/**
 * Where an absolutely positioned ::before/::after marker LANDS.
 *
 * A pseudo-element has no `getBoundingClientRect()`, so `pseudoDescriptor` has to
 * reconstruct its box: containing block's padding edge + the pseudo's own left/top.
 * Both halves of that were wrong, and both shipped to every user's SVG *and* PDF
 * export (the two walkers share the one descriptor):
 *
 *  1. The containing-block walk tested `position !== 'static'` only. CSS Position 3
 *     section 3 also promotes an element with `transform` / `filter` / `backdrop-filter` /
 *     `perspective` / `contain: paint` / `content-visibility`. The app's glass chrome
 *     (`.btn--glass` → `backdrop-filter: blur(4px)`) is exactly that: the profile
 *     pill is `position: static` but IS the containing block, so the browser anchors
 *     its avatar dot to the pill while the walker anchored it to the whole top-right
 *     cluster - 103px left, sitting on the settings button (docs/shots/use-utilities.svg).
 *  2. The pseudo's own `transform` was ignored, so the universal
 *     `top: 50%; translateY(-50%)` centring idiom came out half the marker's height low.
 *
 * Measured against the BROWSER's own answer, not a hardcoded number: a probe span
 * with the pseudo's exact offsets is inserted, measured, removed, and the walker's
 * output must agree with where the browser put it. A test that asserts a literal
 * would pass just as happily on a wrong-but-stable geometry.
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
 * Render `markup`'s `#root`, and separately measure where the browser paints the
 * `.pill::before` marker (via an identically offset probe element, which IS
 * measurable). Coordinates are returned relative to `#root`.
 */
async function renderAndProbe(markup: string): Promise<{ svg: string; probe: { x: number; y: number } }> {
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: 800, height: 300 } });
    await page.setContent(`<!doctype html><body style="margin:0">${markup}</body>`);
    await page.addScriptTag({ content: await bundle() });
    return await page.evaluate(async () => {
      const root = document.getElementById('root')!;
      const pill = document.querySelector('.pill')!;
      const before = getComputedStyle(pill, '::before');
      const probe = document.createElement('i');
      probe.style.cssText = `position:absolute;left:${before.left};top:${before.top};` +
        `width:${before.width};height:${before.height};transform:${before.transform};` +
        `transform-origin:${before.transformOrigin}`;
      pill.appendChild(probe);
      const pr = probe.getBoundingClientRect();
      probe.remove();
      const rr = root.getBoundingClientRect();
      const blob = await (window as any).__render(root, { convertPaths: false, rasterFallback: false });
      return { svg: await blob.text(), probe: { x: pr.left - rr.left, y: pr.top - rr.top } };
    });
  } finally { await b.close(); }
}

/** The emitted marker: the rect carrying the marker's unique fill. */
function markerRect(svg: string): { x: number; y: number } {
  const m = /<rect\b[^>]*\bfill="rgb\(220,20,60\)"[^>]*>/.exec(svg)
    || /<rect\b[^>]*\bfill="rgb\(220, 20, 60\)"[^>]*>/.exec(svg);
  assert.ok(m, 'the ::before marker was not emitted at all');
  const at = (a: string) => Number(new RegExp(`\\b${a}="([-\\d.]+)"`).exec(m![0])?.[1]);
  return { x: at('x'), y: at('y') };
}

const near = (a: number, b: number, what: string) =>
  assert.ok(Math.abs(a - b) < 1, `${what}: walker ${a} vs browser ${b}`);

// ── (1) a static, backdrop-filtered pill inside a positioned cluster ──────────
// The shipping shape: `.gallery-topright` (positioned) > `.profile-link` (static,
// backdrop-filter) > `::before` avatar dot.
test('a backdrop-filtered STATIC ancestor is the containing block, not the positioned one',
  { skip: SKIP }, async () => {
    const markup = `<div id="root" style="width:600px;height:120px;position:relative">
      <div class="cluster" style="position:absolute;left:100px;top:10px;display:flex;gap:10px">
        <div style="width:40px;height:40px;background:#eee"></div>
        <div class="pill" style="position:static;backdrop-filter:blur(4px);width:90px;height:40px;
             background:rgba(240,240,240,.5)"></div>
      </div>
      <style>.pill::before{content:"";position:absolute;left:7px;top:50%;
        width:28px;height:28px;border-radius:50%;background:rgb(220,20,60)}</style>
    </div>`;
    const { svg, probe } = await renderAndProbe(markup);
    const got = markerRect(svg);
    near(got.x, probe.x, 'marker x');
    near(got.y, probe.y, 'marker y');
    // Premise: the two candidate anchors really are far apart, so agreeing is meaningful.
    assert.ok(probe.x > 140, `premise: the dot should sit inside the pill (got x=${probe.x})`);
  });

// ── (2) the pseudo's own transform ───────────────────────────────────────────
test('a pseudo\'s own translate is applied (top:50% + translateY(-50%) centres it)',
  { skip: SKIP }, async () => {
    const markup = `<div id="root" style="width:600px;height:120px;position:relative">
      <div class="pill" style="position:relative;left:40px;top:20px;width:90px;height:40px;background:#eee"></div>
      <style>.pill::before{content:"";position:absolute;left:7px;top:50%;transform:translateY(-50%);
        width:28px;height:28px;border-radius:50%;background:rgb(220,20,60)}</style>
    </div>`;
    const { svg, probe } = await renderAndProbe(markup);
    const got = markerRect(svg);
    near(got.x, probe.x, 'marker x');
    near(got.y, probe.y, 'marker y');
  });

// ── (3) rotate/scale on a pseudo takes the matrix branch ─────────────────────
test('a rotated pseudo emits a transform about its own origin', { skip: SKIP }, async () => {
  const markup = `<div id="root" style="width:600px;height:120px;position:relative">
    <div class="pill" style="position:relative;left:40px;top:20px;width:90px;height:40px;background:#eee"></div>
    <style>.pill::before{content:"";position:absolute;left:10px;top:6px;transform:rotate(45deg);
      width:28px;height:28px;background:rgb(220,20,60)}</style>
  </div>`;
  const { svg } = await renderAndProbe(markup);
  const m = /<g transform="matrix\(([-\d.,]+)\)"[^>]*>\s*<rect\b[^>]*fill="rgb\(220,\s?20,\s?60\)"/.exec(svg);
  assert.ok(m, 'expected the marker wrapped in a <g transform="matrix(…)">');
  const [a, b2, c, d] = m[1]!.split(',').map(Number);
  const r = Math.SQRT1_2;
  for (const [got, want, name] of [[a, r, 'a'], [b2, r, 'b'], [c, -r, 'c'], [d, r, 'd']] as const)
    assert.ok(Math.abs(got! - want) < 1e-3, `matrix ${name}: ${got} ≠ ${want}`);
});
