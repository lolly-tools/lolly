// SPDX-License-Identifier: MPL-2.0
/** Compare real Work Avatar preview pixels with the raster export API. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import test, { before, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { build } from 'esbuild';
import { chromium, webkit } from 'playwright';
import sharp from 'sharp';
import { holdEncodeTier } from '../../../../tests/helpers/sequence-browser.ts';

// Full-suite software rendering can return empty WebKit captures under contention.
// Share the existing browser tier; keep every pixel and export assertion unchanged.
let releaseTier: (() => void) | undefined;
before(async () => { releaseTier = await holdEncodeTier(); });
after(() => releaseTier?.());

const HERE = dirname(fileURLToPath(import.meta.url));
const hook = vm.createContext({});
vm.runInContext(await readFile(new URL('../../../../community/work-avatar/hooks.js', import.meta.url), 'utf8'), hook);
const css = await readFile(new URL('../../../../community/work-avatar/styles.css', import.meta.url), 'utf8');
let bundleCache: string | undefined;
async function bundle(): Promise<string> {
  if (!bundleCache) {
    const out = await build({
      stdin: {
        contents: `import { createExportAPI } from './export.ts';
          window.exportAvatar = async (format, imprint) => {
            const blob = await createExportAPI({}).render(document.querySelector('#root'), format,
              { width: 1200, height: 1200, background: 'transparent', imprint });
            return Array.from(new Uint8Array(await blob.arrayBuffer()));
          };`,
        resolveDir: HERE, loader: 'ts',
      },
      bundle: true, write: false, format: 'iife', platform: 'browser',
      loader: { '.css': 'empty' }, logLevel: 'silent',
    });
    bundleCache = out.outputFiles[0]!.text;
  }
  return bundleCache;
}

async function pixels(bytes: Buffer) {
  return sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

// Compare area averages within the ring, away from its antialiased boundaries.
// A larger export samples the same fractional positions as the live preview.
function sample(frame: Awaited<ReturnType<typeof pixels>>, x: number, y: number): number[] {
  const { data, info } = frame;
  const cx = Math.floor(x * info.width), cy = Math.floor(y * info.height);
  const rgba = [0, 0, 0, 0];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const offset = ((cy + dy) * info.width + cx + dx) * 4;
    for (let c = 0; c < 4; c++) rgba[c]! += data[offset + c]! / 9;
  }
  return rgba;
}

for (const browserType of [chromium, webkit]) {
  test(`${browserType.name()}: SVG mask fades survive raster export`, {
    skip: existsSync(browserType.executablePath()) ? false : `Playwright ${browserType.name()} browser is not installed`,
    timeout: 120_000,
  }, async (t) => {
    const browser = await browserType.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });
      await page.setContent(`<style>body{margin:0}${css}</style><div id="root" class="wa-root" style="width:600px;height:600px"></div>`);
      await page.addScriptTag({ content: await bundle() });
      for (const variant of [
        { name: 'reported half ring', style: 'half', width: 40, rotate: 18, fade: 12, backdrop: true, sweep: 180, start: 270 },
        { name: 'transparent arc', style: 'arc', width: 20, rotate: -35, fade: 40, backdrop: false, sweep: 270, start: 315 },
        { name: 'zero fade', style: 'half', width: 40, rotate: 18, fade: 0, backdrop: true, sweep: 180, start: 270 },
        { name: 'full ring', style: 'full', width: 20, rotate: 0, fade: 12, backdrop: true, sweep: 360, start: 0 },
      ]) {
        await t.test(variant.name, async () => {
          const patch = await hook.compute({}, {
            ringStyle: variant.style, ringWidth: variant.width, ringRotate: variant.rotate,
            ringFade: variant.fade, ringGradient: true, ringSpread: 55,
            ringColor: '#ffa178', ringColor2: '#ff5828', text: '',
            photoBg: '#491a0b', transparentBg: true,
          });
          assert.equal(patch.waWarning, '');
          await page.locator('#root').evaluate((el, markup) => { el.innerHTML = markup; },
            (variant.backdrop ? `<div class="wa-photo" style="${patch.photoStyle}"></div>` : '') + patch.ringSvg);
          const preview = await pixels(await page.locator('#root').screenshot({ omitBackground: true }));
          const before = await page.locator('#root').innerHTML();
          const formats = variant.backdrop && variant.fade === 12 && variant.style === 'half'
            ? [{ format: 'png', imprint: false }, { format: 'jpeg', imprint: false }, { format: 'png', imprint: true }]
            : [{ format: 'png', imprint: false }];
          for (const mode of formats) {
            const bytes = await page.evaluate(async (m) => (window as any).exportAvatar(m.format, m.imprint), mode);
            const exported = await pixels(Buffer.from(bytes));
            assert.deepEqual([exported.info.width, exported.info.height], [1200, 1200]);
            // Offset from round fractions to avoid landing on the colour fan's
            // sector joints, whose antialiasing changes with export resolution.
            for (const t of [0.013, 0.033, 0.063, 0.103, 0.203, 0.503, 0.803, 0.903, 0.943, 0.973, 0.993]) {
              const angle = (variant.start + variant.rotate - variant.sweep * t) * Math.PI / 180;
              const radius = 0.485 * (1 - variant.width / 200);
              const x = 0.5 + radius * Math.sin(angle), y = 0.5 - radius * Math.cos(angle);
              const expected = sample(preview, x, y), actual = sample(exported, x, y);
              // Transparent near-tip RGB is unstable after un-premultiplication;
              // compare premultiplied channels plus alpha so invisible RGB is moot.
              for (let c = 0; c < 4; c++) {
                const a = c < 3 ? actual[c]! * actual[3]! / 255 : actual[c]!;
                const e = c < 3 ? expected[c]! * expected[3]! / 255 : expected[c]!;
                assert.ok(Math.abs(a - e) < 9,
                  `${mode.format} imprint=${mode.imprint}, arc=${t}, channel=${c}: preview ${e}, export ${a}; RGBA ${expected} / ${actual}`);
              }
            }
          }
          assert.equal(await page.locator('#root').innerHTML(), before, 'export preserves the live artwork');
        });
      }

      await t.test('external CSS images are still embedded', async () => {
        const png = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#23ab67' } }).png().toBuffer();
        let fetched = 0;
        await page.route('https://avatar.test/tile.png', (route) => {
          fetched++;
          return route.fulfill({ contentType: 'image/png', body: png, headers: { 'access-control-allow-origin': '*' } });
        });
        await page.locator('#root').evaluate(el => {
          el.innerHTML = '<div style="width:100%;height:100%;background-image:url(https://avatar.test/tile.png)"></div>';
        });
        const bytes = await page.evaluate(async () => (window as any).exportAvatar('png', false));
        const actual = sample(await pixels(Buffer.from(bytes)), 0.5, 0.5);
        assert.ok(fetched > 0);
        assert.deepEqual(actual.map(Math.round), [35, 171, 103, 255]);
      });
    } finally { await browser.close(); }
  });
}
