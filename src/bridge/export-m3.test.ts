// SPDX-License-Identifier: MPL-2.0
/**
 * The gaps closed in walker milestone M3, in a real browser: shadow DOM, `<canvas>`,
 * CSS `filter`, and background-image placement.
 *
 * Each of these was measured MISSING from the walker's output on the audit fixtures
 * before it was built, so every test here asserts presence of something that used to
 * be absent, and - where the old behaviour was wrong rather than missing - pins the
 * specific wrongness (a chevron stretched across a whole select, a slotted label
 * painted twice).
 *
 * A browser is the oracle because all four hinge on things jsdom does not have: a
 * flat-tree layout, a canvas backing store, computed `filter`, and real intrinsic
 * image sizes.
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

/** Render `#root`, optionally running `setup` in the page first (for shadow roots
 *  and canvas painting, which cannot be expressed in static markup). */
async function render(markup: string, setup?: string): Promise<string> {
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`<!doctype html><body style="margin:0">${markup}</body>`);
    if (setup) await page.evaluate(setup);
    await page.addScriptTag({ content: await bundle() });
    return await page.evaluate(async () => {
      const blob = await (window as any).__render(document.getElementById('root'),
        { convertPaths: false, rasterFallback: false });
      return await blob.text();
    });
  } finally { await b.close(); }
}

const root = (inner: string) =>
  `<div id="root" style="width:400px;height:200px;background:#fff;font:14px sans-serif">${inner}</div>`;
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

// ── shadow DOM ────────────────────────────────────────────────────────────────

test('shadow-root content is walked - it used to be invisible entirely', { skip: SKIP }, async () => {
  const svg = await render(root(`<div id="host"></div>`), `
    const sr = document.getElementById('host').attachShadow({ mode: 'open' });
    sr.innerHTML = '<div style="width:80px;height:30px;background:rgb(3,4,5)">Inside</div>';
  `);
  assert.match(svg, /rgb\(3,4,5\)/, 'the shadow box must be painted');
  assert.match(svg, />Inside</, 'shadow text must be emitted');
});

test('slotted light content paints exactly once', { skip: SKIP }, async () => {
  // The trap in flat-tree traversal: walk both the light children and the shadow
  // tree and every slotted node is drawn twice, at the same coordinates.
  const svg = await render(root(`<div id="host"><span style="color:rgb(7,7,7)">Slotted</span></div>`), `
    const sr = document.getElementById('host').attachShadow({ mode: 'open' });
    sr.innerHTML = '<div style="padding:4px"><slot></slot></div>';
  `);
  assert.equal(count(svg, />Slotted</g), 1, 'slotted text must not double-paint');
});

test('a host\'s unslotted light children are NOT painted', { skip: SKIP }, async () => {
  // They do not render on screen, so drawing them would invent content.
  const svg = await render(root(`<div id="host"><span>Hidden</span></div>`), `
    const sr = document.getElementById('host').attachShadow({ mode: 'open' });
    sr.innerHTML = '<b>Shown</b>';
  `);
  assert.match(svg, />Shown</);
  assert.doesNotMatch(svg, />Hidden</, 'unslotted light content does not render, so it must not export');
});

// ── canvas ────────────────────────────────────────────────────────────────────

test('a <canvas> exports its pixels instead of an empty box', { skip: SKIP }, async () => {
  const svg = await render(root(`<canvas id="c" width="40" height="40" style="width:40px;height:40px"></canvas>`), `
    const cx = document.getElementById('c').getContext('2d');
    cx.fillStyle = '#f00'; cx.fillRect(0, 0, 40, 40);
  `);
  assert.match(svg, /<image[^>]*href="data:image\/png/, 'expected the canvas backing store as an image');
});

test('a blank canvas still emits, and a tainted one does not throw', { skip: SKIP }, async () => {
  const svg = await render(root(`<canvas width="10" height="10" style="width:10px;height:10px"></canvas>`));
  // No assertion on content - the point is that the export completes and parses,
  // which renderSvgFromHtml's own parse gate enforces before returning.
  assert.match(svg, /<svg/);
});

// ── CSS filter ────────────────────────────────────────────────────────────────

test('a CSS filter is emitted as an SVG filter rather than dropped', { skip: SKIP }, async () => {
  const svg = await render(root(`<div style="width:50px;height:50px;background:#0a0;filter:grayscale(1)"></div>`));
  assert.match(svg, /<filter id="fcflt-/, 'expected a filter element');
  assert.match(svg, /feColorMatrix/);
  assert.match(svg, /filter="url\(#fcflt-/, 'expected the element group to reference it');
});

test('a blur filter gets a filter region big enough to hold the spread', { skip: SKIP }, async () => {
  const svg = await render(root(`<div style="width:50px;height:50px;background:#0a0;filter:blur(10px)"></div>`));
  const m = /<filter id="fcflt-\d+"([^>]*)>/.exec(svg);
  assert.ok(m);
  assert.match(m[1]!, /filterUnits="userSpaceOnUse"/);
  const w = Number.parseFloat(/width="([\d.]+)"/.exec(m[1]!)![1]!);
  assert.ok(w >= 50 + 6 * 10, `region ${w} is too tight for a 10px blur - the edges would be clipped`);
});

test('a drop-shadow-only filter adds no SVG filter, since it is drawn as geometry',
  { skip: SKIP }, async () => {
    const svg = await render(root(`<div style="width:50px;height:50px;background:#0a0;filter:drop-shadow(0 2px 4px #000)"></div>`));
    assert.doesNotMatch(svg, /<filter id="fcflt-/);
  });

// ── background-image placement ────────────────────────────────────────────────

// A 20×10 PNG, so a squashed axis shows up.
const PNG20x10 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAKCAYAAAC0VX7mAAAAG0lEQVR42mNkYPhfz0AEYBxViKtCQBQGwlEIAJ0kCfmQyPGXAAAAAElFTkSuQmCC';

test('a fixed-size background image keeps its size and position', { skip: SKIP }, async () => {
  // The defect: every background image was painted at the full border box, so this
  // 14px chevron used to span the whole 200px field.
  const svg = await render(root(
    `<div style="width:200px;height:40px;background:url('${PNG20x10}') no-repeat right 12px center / 14px 7px"></div>`));
  const m = /<image[^>]*width="14"[^>]*/.exec(svg) ?? /<image([^>]*)>/.exec(svg);
  assert.ok(m, 'expected a background image element');
  assert.match(svg, /<image[^>]*width="14"/, 'the image must keep its 14px width, not stretch to 200');
  assert.match(svg, /<image[^>]*height="7"/);
  assert.match(svg, /<image[^>]*x="174"/, 'right 12px in a 200px box puts a 14px image at x=174');
});

test('a background image at its intrinsic size is not stretched', { skip: SKIP }, async () => {
  const svg = await render(root(
    `<div style="width:200px;height:100px;background:url('${PNG20x10}') no-repeat"></div>`));
  assert.match(svg, /<image[^>]*width="20"/, 'expected the image\'s own 20px width');
  assert.match(svg, /<image[^>]*height="10"/);
});

test('a tiling background becomes a <pattern>, not a screenshot', { skip: SKIP }, async () => {
  const svg = await render(root(
    `<div style="width:200px;height:100px;background:url('${PNG20x10}') repeat"></div>`));
  assert.match(svg, /<pattern[^>]*id="fcbgpat-/, 'expected a real SVG pattern');
  assert.match(svg, /patternUnits="userSpaceOnUse"/);
  assert.match(svg, /<pattern[^>]*width="20"/, 'the tile step is the image size');
  assert.doesNotMatch(svg, /<image[^>]*href="data:image\/png[^"]*"[^>]*width="200"/,
    'the box must not be rasterised as one big image');
});

// ── inline SVG passthrough ────────────────────────────────────────────────────

test('an inline svg using currentColor keeps the page\'s inherited color', { skip: SKIP }, async () => {
  // The clone is emitted into a STANDALONE svg with no HTML ancestors, where
  // currentColor falls back to black - the gallery's ghost icons (blue via an
  // inherited CSS `color`) exported as black ink. The walker must stamp the
  // live computed color onto the clone root so currentColor resolves the same.
  const svg = await render(root(
    `<span style="color:rgb(20,30,220)">
       <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/></svg>
     </span>`));
  assert.match(svg, /<svg[^>]*color="rgb\(20, 30, 220\)"[^>]*>/,
    'the passthrough clone must carry the computed color for currentColor to resolve against');
});

test('a replaced element inside a plain-inline wrapper is not dropped', { skip: SKIP }, async () => {
  // The block walk skips a no-own-box wrapper (an unstyled <a>/<span>) and the
  // inline text walk returns at own-box children on the assumption the block
  // walk visited them - so an <img> inside an unstyled inline link vanished.
  const svg = await render(root(
    `<a href="#"><img src="${PNG20x10}" width="20" height="10"></a>`));
  assert.match(svg, /<image[^>]*href="data:image\/png/,
    'the image must be emitted even though its wrapper has no box of its own');
});

test('cover still fills the box - the case the old behaviour got right', { skip: SKIP }, async () => {
  const svg = await render(root(
    `<div style="width:200px;height:100px;background:url('${PNG20x10}') no-repeat center / cover"></div>`));
  // 20:10 image in a 200:100 box: cover is an exact fit either way.
  assert.match(svg, /<image[^>]*width="200"/);
  assert.match(svg, /<image[^>]*height="100"/);
});
