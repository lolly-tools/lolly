// SPDX-License-Identifier: MPL-2.0
/**
 * Atomic inline boxes in the HTML→SVG walker.
 *
 * The walker's block-child loop used to skip every child whose computed display was
 * `inline`, `inline-block` or `inline-flex`, leaving them to the inline text pass.
 * That pass emits TEXT and nothing else - no background, no border, no
 * background-image - so an `inline-block` pill lost its fill entirely, and a replaced
 * element (an `<input>`, which has no text nodes at all) emitted nothing whatsoever.
 * The inline `<svg>` special-case in the loop was the same bug found once and patched
 * narrowly.
 *
 * The rule now: everything except a non-replaced `display: inline` has a box, and
 * boxes are visitSvgNode's job. These tests pin both halves - the box appears, and
 * its text still appears exactly once (descending into an atomic inline from both
 * walks would double-paint it).
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
    loader: { '.css': 'empty' },
  });
  bundleCache = out.outputFiles[0]!.text;
  return bundleCache;
}

async function render(markup: string): Promise<string> {
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`<!doctype html><body style="margin:0">${markup}</body>`);
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

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('an inline-block keeps its background', { skip: SKIP }, async () => {
  const svg = await render(root(
    `<span style="display:inline-block;padding:4px 10px;background:rgb(12,34,56);border-radius:99px">Beta</span>`));
  assert.match(svg, /rgb\(12,34,56\)/, 'the pill fill must be painted');
  assert.equal(count(svg, />Beta</g), 1, 'its label must appear exactly once, not twice');
});

test('an inline-flex keeps its background', { skip: SKIP }, async () => {
  const svg = await render(root(
    `<span style="display:inline-flex;padding:4px;background:rgb(9,8,7)">x</span>`));
  assert.match(svg, /rgb\(9,8,7\)/);
  assert.equal(count(svg, />x</g), 1);
});

test('an inline-block border is painted', { skip: SKIP }, async () => {
  const svg = await render(root(
    `<span style="display:inline-block;padding:4px;border:2px solid rgb(200,10,10)">y</span>`));
  assert.match(svg, /rgb\(200,10,10\)/, 'the border must be painted');
});

test('a plain display:inline is still left to the text pass, and paints once',
  { skip: SKIP }, async () => {
    // The complement of the rule: a non-replaced inline has no box the block walk
    // should paint, and routing it through visitSvgNode would give it a border box
    // it does not have on screen.
    const svg = await render(root(`<p style="margin:0">a <em style="font-style:normal">b</em> c</p>`));
    assert.equal(count(svg, />b</g), 1, 'inline text must not double-paint');
  });

test('nested inline-blocks each paint their own box, once', { skip: SKIP }, async () => {
  const svg = await render(root(
    `<span style="display:inline-block;padding:6px;background:rgb(1,1,1)">
       <span style="display:inline-block;padding:2px;background:rgb(2,2,2)">deep</span>
     </span>`));
  assert.match(svg, /rgb\(1,1,1\)/); assert.match(svg, /rgb\(2,2,2\)/);
  assert.equal(count(svg, />deep</g), 1);
});

test('an inline <img> is emitted - replaced content defaults to display:inline',
  { skip: SKIP }, async () => {
    // A 1×1 red PNG. Before the routing fix an <img> with no display override was
    // skipped by the block loop and invisible to the text walk.
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const svg = await render(root(`<img src="${png}" style="width:40px;height:40px">`));
    assert.match(svg, /<image[^>]*width="40"/, 'expected the image box in the output');
  });
