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
 *    band across its middle.
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

  const out = join(root, 'tall.png');
  await exportToFile(runtime, dom, manifest, 'png', out, { width: 1080, height: 1920 });
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [1080, 1920]);
  let lower = 0;
  for (let y = Math.round(info.height * 0.75); y < info.height; y++) {
    for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3]! > 0) lower++;
  }
  assert.ok(lower > 1000, `logos drawn in the lowest quarter (${lower} px)`);
});
