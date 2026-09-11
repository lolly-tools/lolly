// SPDX-License-Identifier: MPL-2.0
/**
 * Form-control painting in the HTML→SVG walker.
 *
 * form-controls.test.ts already pins WHAT a control says, DOM-free. This suite covers
 * the half a browser is genuinely required for: that the text reaches the output at
 * the right place, that it is clipped to the field, and that the walker does not draw
 * a second widget on top of one CSS has already styled - which is every control in
 * this app, so a regression there would double-paint the entire sidebar.
 *
 * Real Chromium, self-skipping when one isn't installed (tests/README.md).
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

/** Render `#root`. convertPaths:false keeps text as <text> so the assertions can read
 *  it without HarfBuzz or a font; rasterFallback:false keeps the output pure vector. */
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
  `<div id="root" style="width:400px;height:200px;background:#fff;font:14px/1.4 sans-serif">${inner}</div>`;

test('an input\'s value reaches the output - the blank-field defect', { skip: SKIP }, async () => {
  const svg = await render(root(`<input value="https://lolly.tools" style="width:300px">`));
  assert.match(svg, />https:\/\/lolly\.tools</, 'expected the input value as text');
});

test('a select paints its chosen option, not its first', { skip: SKIP }, async () => {
  const svg = await render(root(
    `<select style="width:200px"><option>Low</option><option selected>Quartile</option></select>`));
  assert.match(svg, />Quartile</, 'expected the selected option');
  assert.doesNotMatch(svg, />Low</, 'the unselected option must not paint');
});

test('a placeholder stands in for an empty value, in the placeholder colour', { skip: SKIP }, async () => {
  const svg = await render(root(
    `<style>#i::placeholder{color:rgb(1,2,3)}</style><input id="i" placeholder="Enter a URL" style="width:300px">`));
  assert.match(svg, />Enter a URL</);
  assert.match(svg, /rgb\(1, ?2, ?3\)/, 'expected the ::placeholder colour, not the control colour');
});

test('a textarea keeps its lines', { skip: SKIP }, async () => {
  const svg = await render(root(`<textarea style="width:300px;height:80px">one\ntwo</textarea>`));
  assert.match(svg, />one</); assert.match(svg, />two</);
});

test('control text is clipped to the field, so an over-long value cannot escape it',
  { skip: SKIP }, async () => {
    // A 40-character value in a 60px box paints past the border on screen only
    // because the UA clips it. Without a clip the walker would draw the whole string
    // straight across the page.
    const svg = await render(root(`<input value="${'W'.repeat(40)}" style="width:60px">`));
    assert.match(svg, /<clipPath[^>]*id="fcctl-/, 'expected a content-box clip for the control');
    assert.match(svg, /clip-path="url\(#fcctl-/);
  });

test('a CSS-styled control is not given a second, UA-shaped widget', { skip: SKIP }, async () => {
  // Every control in this app sets appearance:none and draws its own tick from a
  // background-image. Painting an approximated platform checkbox over that would
  // double-paint the whole sidebar, so appearance:none must suppress it entirely.
  const styled = await render(root(
    `<input type="checkbox" checked style="appearance:none;width:16px;height:16px;background:#0a0">`));
  assert.doesNotMatch(styled, /stroke-linejoin="round"/, 'no UA tick over an appearance:none checkbox');

  // Premise: the native one DOES get drawn, so the assertion above is about
  // suppression rather than about the feature being absent.
  const native = await render(root(`<input type="checkbox" checked style="width:16px;height:16px">`));
  assert.match(native, /stroke-linejoin="round"/, 'premise: a native checked checkbox draws a tick');
});

test('a native range paints a track and a thumb positioned by its value',
  { skip: SKIP }, async () => {
    const at = async (value: string) => {
      const svg = await render(root(`<input type="range" min="0" max="10" value="${value}" style="width:200px;margin:0">`));
      const m = /<circle cx="([\d.]+)"/.exec(svg);
      assert.ok(m, `expected a thumb circle for value=${value}`);
      return Number.parseFloat(m[1]!);
    };
    const lo = await at('0'), mid = await at('5'), hi = await at('10');
    assert.ok(lo < mid && mid < hi, `thumb must advance with the value (got ${lo}, ${mid}, ${hi})`);
    // The thumb centre travels between its own radii, so it never hangs off the track.
    assert.ok(lo >= 0 && hi <= 200, `thumb stayed inside the track (got ${lo}..${hi})`);
  });

test('a password field paints bullets, not the password', { skip: SKIP }, async () => {
  const svg = await render(root(`<input type="password" value="hunter2" style="width:200px">`));
  assert.doesNotMatch(svg, /hunter2/, 'the password must never reach the exported file');
  assert.match(svg, /•/);
});

test('the mirror element used for layout does not survive the export', { skip: SKIP }, async () => {
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`<!doctype html><body style="margin:0">${root(`<input value="x" style="width:100px">`)}</body>`);
    await page.addScriptTag({ content: await bundle() });
    const bodyKids = await page.evaluate(async () => {
      const before = document.body.children.length;
      await (window as any).__render(document.getElementById('root'), { convertPaths: false, rasterFallback: false });
      return [before, document.body.children.length];
    });
    assert.deepEqual(bodyKids[0], bodyKids[1], 'the throwaway mirror must be removed - an export must not mutate the page');
  } finally { await b.close(); }
});
