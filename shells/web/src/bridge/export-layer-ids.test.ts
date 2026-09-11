// SPDX-License-Identifier: MPL-2.0
/**
 * The walker's layer-identity passthrough (`opts.layerIds` - plans/104 section 7),
 * pinned in both directions.
 *
 * The feature is one guarded block at the walker's g-creation site, and the
 * whole risk of it is the direction people forget: not "does the flag work" but
 * "is a normal export still the bytes it was". Every tool in every profile ships
 * through `renderSvgFromHtml`, so the OFF case is asserted as BYTE IDENTITY
 * against the same DOM rendered twice - the same protection `export-paint-order`
 * built for `stackingOrder`, for the same reason.
 *
 * A browser is the oracle because the walker reads `getBoundingClientRect` and
 * `getComputedStyle` off a live layout; jsdom has neither.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPORT_MODULE = fileURLToPath(new URL('./export.ts', import.meta.url));
const LAYERS_MODULE = fileURLToPath(new URL('../../../../engine/src/svg-layers.ts', import.meta.url));

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
                 import { enumerateSvgLayers } from ${JSON.stringify(LAYERS_MODULE)};
                 window.__render = renderSvgFromHtml;
                 window.__layers = enumerateSvgLayers;`,
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

/** Render `#root` once per option set, in ONE page, so the DOM is provably the same. */
async function renderBoth(markup: string, opts: Array<Record<string, unknown>>): Promise<string[]> {
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`<!doctype html><body style="margin:0">${markup}</body>`);
    await page.addScriptTag({ content: await bundle() });
    return await page.evaluate(async (list: Array<Record<string, unknown>>) => {
      const out: string[] = [];
      for (const o of list) {
        const blob = await (window as any).__render(document.getElementById('root'),
          { convertPaths: false, rasterFallback: false, ...o });
        out.push(await blob.text());
      }
      return out;
    }, opts);
  } finally { await b.close(); }
}

/** Three nested boxes, the middle two carrying the canvas's own ids. */
const ROOT = `
  <div id="root" style="width:400px;height:200px;background:#fff;position:relative">
    <div data-box-id="b1" style="position:absolute;left:10px;top:10px;width:120px;height:80px;background:#c33"></div>
    <div data-box-id="b2" style="position:absolute;left:200px;top:40px;width:120px;height:80px;background:#39c">
      <span style="font:12px sans-serif">inner</span>
    </div>
  </div>`;

test('OFF (the default): the emitted bytes are identical with and without the option present',
  { skip: SKIP }, async () => {
    const [plain, explicitOff] = await renderBoth(ROOT, [{}, { layerIds: false }]);
    assert.equal(plain, explicitOff, 'layerIds:false must be the same bytes as no option at all');
    assert.ok(!plain!.includes('data-box-id'), 'a normal export carries no identity at all');
  });

test('ON: each stamped element\'s own <g> carries its id, and nothing else changes',
  { skip: SKIP }, async () => {
    const [off, on] = await renderBoth(ROOT, [{}, { layerIds: true }]);
    assert.ok(on!.includes('data-box-id="b1"'), on!.slice(0, 400));
    assert.ok(on!.includes('data-box-id="b2"'));
    assert.equal((on!.match(/data-box-id="b1"/g) ?? []).length, 1, 'exactly one <g> per box, never a duplicate');
    // The ONLY difference is the attributes: strip them and the two agree byte for byte.
    assert.equal(on!.replace(/ data-box-id="[^"]*"/g, ''), off,
      'the passthrough adds an attribute and moves nothing else');
  });

test('ON: a rotated box still gets exactly one stamp (the walker re-enters itself there)',
  { skip: SKIP }, async () => {
    const markup = `
      <div id="root" style="width:400px;height:200px;background:#fff;position:relative">
        <div data-box-id="r1" style="position:absolute;left:40px;top:40px;width:100px;height:60px;
             background:#284;transform:rotate(20deg)"></div>
      </div>`;
    const [on] = await renderBoth(markup, [{ layerIds: true }]);
    assert.equal((on!.match(/data-box-id="r1"/g) ?? []).length, 1,
      'the rotation branch walks the element twice; only its own <g> may be stamped');
    assert.ok(/rotate\(/.test(on!), 'and the rotation is still emitted as a real SVG rotate');
  });

test('an element with no id contributes none - ids only where the canvas minted one',
  { skip: SKIP }, async () => {
    const markup = `
      <div id="root" style="width:200px;height:100px;background:#fff">
        <div style="width:50px;height:50px;background:#000"></div>
      </div>`;
    const [on] = await renderBoth(markup, [{ layerIds: true }]);
    assert.ok(!on!.includes('data-box-id'));
  });

test('the round trip closes: a stamped walker SVG lifts along the CANVAS\'s boundaries',
  { skip: SKIP }, async () => {
    // This is the whole point of the passthrough, asserted end to end: walk the
    // page with layerIds on, hand the bytes to the engine's enumerator, and get
    // layers back that name the boxes the editor knows about.
    const { chromium } = browser as { chromium: any };
    const b = await chromium.launch();
    try {
      const page = await b.newPage({ viewport: { width: 800, height: 600 } });
      await page.setContent(`<!doctype html><body style="margin:0">${ROOT}</body>`);
      await page.addScriptTag({ content: await bundle() });
      const ids: Array<string | undefined> = await page.evaluate(async () => {
        const blob = await (window as any).__render(document.getElementById('root'),
          { convertPaths: false, rasterFallback: false, layerIds: true });
        const svg = await blob.text();
        return (window as any).__layers(svg).layers.map((l: any) => l.boxId);
      });
      assert.ok(ids.includes('b1') || ids.includes('b2'),
        `a lifted layer should name a real box, got ${JSON.stringify(ids)}`);
    } finally { await b.close(); }
  });
