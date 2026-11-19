// SPDX-License-Identifier: MPL-2.0
/**
 * The terminal app draws with the CLI's canvas, and exports Logo Wall at another
 * shape the way the CLI does.
 *
 *  - createTuiBridge installs @napi-rs/canvas behind its jsdom (where it is
 *    installed), so Logo Wall's Balance sizes and Trim margins run here instead of
 *    being skipped with a "needs pixel access" warning;
 *  - a PNG export at 1080 x 1920 is drawn from an SVG laid out for that shape, so
 *    the logos reach the lower part of the picture rather than sitting in a 16:9
 *    band across its middle, once the logos are not measured with the canvas (a
 *    wall that is gets the browser tier, plan 371);
 *  - the canvas size (engine 1.293) follows the link's size at mount and the
 *    Export panel's size after, so the terminal preview is the wall the export
 *    writes.
 *
 * Run with: node --test shells/tui/src/logo-wall-canvas.test.ts
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const root = await mkdtemp(join(tmpdir(), 'lolly-tui-logo-wall-'));
after(() => rm(root, { recursive: true, force: true }));
process.env.LOLLY_STATE_DIR = join(root, 'state');
// No browser tier here, so a PNG the browser-free route refuses fails with its reason
// instead of reaching for a web shell build on whichever machine runs this.
process.env.LOLLY_WEB_DIST = join(root, 'no-web');
delete process.env.LOLLY_WEB_BASE;

const { isCanvasAvailable } = await import('@lolly-tools/node-shell/canvas');
const SKIP = !isCanvasAvailable() ? '@napi-rs/canvas is not installed here'
  : !existsSync(join(REPO, 'community', 'logo-wall', 'tool.json')) ? 'community pack not mounted' : false;

const logo = (w: number): string => 'data:image/svg+xml;base64,' + Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect x="${200 - w / 2}" y="60" width="${w}" height="80" fill="#222222"/></svg>`,
).toString('base64');

test('the TUI balances, trims and fills an export of another shape', { skip: SKIP }, async () => {
  const { createTuiBridge } = await import('./bridge.ts');
  const { mountTool, exportToFile } = await import('./engine-render.ts');
  const { host, dom, logs } = await createTuiBridge({});

  const canvas = dom.window.document.createElement('canvas');
  assert.ok(canvas.getContext('2d'), 'a 2D canvas behind the jsdom');

  const logos = [320, 60, 200, 120, 260].map((w) => ({ logo: { source: 'remote', id: logo(w), _unresolved: true } }));
  const { runtime, manifest } = await mountTool('logo-wall', host, '', { logos, transparentBg: true });
  assert.doesNotMatch(logs.join('\n'), /needs pixel access/);

  // Balancing and trimming read the logos' pixels through that canvas, which the browser
  // draws natively, so the browser-free PNG refuses this wall (resvg-admission.ts).
  await assert.rejects(exportToFile(runtime, dom, manifest, 'png', join(root, 'measured.png'), { width: 1080, height: 1920 }),
    /computed part of the picture with a 2D canvas/);
  // A BMP comes from the same pixels: refused the same way, and handed to the web-shell tier.
  await assert.rejects(exportToFile(runtime, dom, manifest, 'bmp', join(root, 'measured.bmp'), { width: 1080, height: 1920 }),
    /computed part of the picture with a 2D canvas.*The browser render tier, which draws it, could not run/);

  // With both off, the wall is drawn here, laid out for the export's shape. A fresh
  // session: pixel work is counted per document, for as long as the document lives.
  const fresh = await createTuiBridge({});
  const plain = await mountTool('logo-wall', fresh.host, '', { logos, transparentBg: true, balance: false, trim: false });
  const out = join(root, 'tall.png');
  await exportToFile(plain.runtime, fresh.dom, plain.manifest, 'png', out, { width: 1080, height: 1920 });
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [1080, 1920]);
  let lower = 0;
  for (let y = Math.round(info.height * 0.75); y < info.height; y++) {
    for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3]! > 0) lower++;
  }
  assert.ok(lower > 1000, `logos drawn in the lowest quarter (${lower} px)`);
});

test('the preview follows the link\'s size and the Export panel\'s', { skip: SKIP }, async () => {
  const { createTuiBridge } = await import('./bridge.ts');
  const { mountTool, renderSvg, setCanvasSizeFrom } = await import('./engine-render.ts');
  const { host, dom } = await createTuiBridge({});
  const logos = [320, 60, 200].map((w) => ({ logo: { source: 'remote', id: logo(w), _unresolved: true } }));
  const viewBox = (svg: string | null) => /viewBox="([^"]+)"/.exec(svg ?? '')?.[1];

  const linked = await mountTool('logo-wall', host, 'w=1080&h=1920', { logos, transparentBg: true });
  assert.equal(viewBox(await renderSvg(linked.runtime, dom)), '0 0 720 1280', 'a tall link opens tall');

  const { runtime } = await mountTool('logo-wall', host, '', { logos, transparentBg: true });
  assert.equal(viewBox(await renderSvg(runtime, dom)), '0 0 1280 720');
  assert.equal(await setCanvasSizeFrom(runtime, { width: 210, height: 297, unit: 'mm' }), true);
  const [, , w, h] = viewBox(await renderSvg(runtime, dom))!.split(' ').map(Number);
  assert.ok(Math.abs(w! / h! - 210 / 297) < 1e-3, 'the preview is an A4 page');
  assert.equal(await setCanvasSizeFrom(runtime, { width: 210, height: 297, unit: 'mm' }), false, 'the same size is a no-op');
  await setCanvasSizeFrom(runtime, {});
  assert.equal(viewBox(await renderSvg(runtime, dom)), '0 0 1280 720', 'blank fields are the tool\'s own size');
});
