// SPDX-License-Identifier: MPL-2.0
/**
 * Nested-<svg> presentation fidelity in the HTML→SVG walker (plans/101).
 *
 * The inline-SVG passthrough clones verbatim, so anything the CASCADE supplied
 * - class rules, var() paints, inherited text style - used to vanish from the
 * standalone output: a class-filled status ring flattened to the SVG-default
 * black dot, a stroke="var(--series)" chart line didn't paint at all, and
 * un-familied <text> fell to the viewer's serif. The walker now bakes each SVG
 * descendant's COMPUTED presentation onto the clone as inline style. These
 * cases pin the bug class the way the shared canvas-op suite pins convergence:
 * the fixture is the lolly-work console's approval-step marker shape (ring +
 * glyph + numbered text), which is where the regression was first seen.
 *
 * Real Chromium via Playwright (self-skips without it): jsdom returns '' for
 * SVG presentation properties, so a jsdom version of these tests is vacuous - 
 * see export-stroke-paint.test.ts for the ruling.
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

async function render(markup: string, head = ''): Promise<string> {
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`<!doctype html><head>${head}</head><body style="margin:0">${markup}</body>`);
    await page.addScriptTag({ content: await bundle() });
    return await page.evaluate(async () => {
      const blob = await (window as any).__render(document.getElementById('root'),
        { convertPaths: false, rasterFallback: false });
      return await blob.text();
    });
  } finally { await b.close(); }
}

const root = (inner: string) =>
  `<div id="root" style="width:400px;height:120px;background:#fff;font:14px sans-serif">${inner}</div>`;

/** The inline style baked onto the first element matching `tagAttr` in `svg`. */
function bakedStyle(svg: string, tagAttr: RegExp): string {
  const m = svg.match(tagAttr);
  assert.ok(m, `no element matching ${tagAttr} in output`);
  const style = /style="([^"]*)"/.exec(m[0]!);
  return style?.[1] ?? '';
}

test('a class-styled status ring survives: computed fill/stroke baked inline, vars and classes collapsed', { skip: SKIP }, async () => {
  const out = await render(root(`
    <svg viewBox="0 0 26 26" width="26" height="26">
      <circle class="ring" cx="13" cy="13" r="11"></circle>
      <path class="glyph" d="M7.5 13.5l3.4 3.4L18.5 9.3" fill="none"></path>
    </svg>`),
    `<style>:root{--ok:#1e7a4d}
      .ring{fill:var(--ok);stroke:var(--ok);stroke-width:2}
      .glyph{stroke:#fff;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}</style>`);
  const ring = bakedStyle(out, /<circle[^>]*class="ring"[^>]*>/);
  assert.match(ring, /fill:\s*rgb\(30,\s*122,\s*77\)/, 'class+var fill collapsed to a literal');
  assert.match(ring, /stroke:\s*rgb\(30,\s*122,\s*77\)/);
  const glyph = bakedStyle(out, /<path[^>]*class="glyph"[^>]*>/);
  assert.match(glyph, /stroke:\s*rgb\(255,\s*255,\s*255\)/, 'the ✓ glyph keeps its white stroke');
  assert.match(glyph, /stroke-width:\s*2\.4/, 'non-default stroke width baked');
  assert.match(glyph, /stroke-linecap:\s*round/);
  assert.ok(!/var\(--ok\)/.test(ring + glyph), 'no unresolved var() reaches the standalone file');
});

test('a stroke="var(--series)" ATTRIBUTE paints standalone - the computed literal is baked over it', { skip: SKIP }, async () => {
  const out = await render(root(`
    <svg viewBox="0 0 100 40" width="100" height="40">
      <path d="M0 20 L100 20" fill="none" stroke="var(--series-1)" stroke-width="2"></path>
    </svg>`),
    `<style>:root{--series-1:#2a78d6}</style>`);
  const line = bakedStyle(out, /<path[^>]*d="M0 20[^>]*>/);
  assert.match(line, /stroke:\s*rgb\(42,\s*120,\s*214\)/, 'the chart line has a literal stroke');
});

test('nested-svg <text> carries its inherited font and fill - no more viewer-default serif', { skip: SKIP }, async () => {
  const out = await render(root(`
    <svg viewBox="0 0 60 30" width="60" height="30">
      <text class="num" x="10" y="20">42</text>
    </svg>`),
    `<style>.num{fill:#5b6670;font-family:Georgia,serif;font-size:12px;font-weight:700}</style>`);
  const num = bakedStyle(out, /<text[^>]*class="num"[^>]*>/);
  assert.match(num, /font-family:\s*Georgia/, 'class-set family baked onto the text node');
  assert.match(num, /font-size:\s*12px/);
  assert.match(num, /font-weight:\s*700/);
  assert.match(num, /fill:\s*rgb\(91,\s*102,\s*112\)/);
});

test('url(#…) paints survive verbatim - a gradient fill is referenced, never clobbered by a literal', { skip: SKIP }, async () => {
  const out = await render(root(`
    <svg viewBox="0 0 100 40" width="100" height="40">
      <defs><linearGradient id="lg"><stop class="s0" offset="0"></stop><stop offset="1" stop-color="#fff"></stop></linearGradient></defs>
      <rect class="grad" x="0" y="0" width="100" height="40"></rect>
    </svg>`),
    `<style>.grad{fill:url(#lg)}.s0{stop-color:#2a78d6}</style>`);
  const rect = bakedStyle(out, /<rect[^>]*class="grad"[^>]*>/);
  assert.match(rect, /fill:\s*url\((&quot;|")#lg(&quot;|")\)/, 'the reference is baked, defs travel in the clone');
  const stop = bakedStyle(out, /<stop[^>]*class="s0"[^>]*>/);
  assert.match(stop, /stop-color:\s*rgb\(42,\s*120,\s*214\)/, 'class-driven stop-color baked on the stop');
});
