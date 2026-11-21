// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly tui --allow-browser-free` (plan 371), the TUI half of the CLI's flag: refusal
 * stays the default, the flag draws a picture whose every refusal only may differ, with
 * a warning and the acceptance in the credential, and a picture that would be wrong is
 * still refused (resvg-admission.ts `REFUSAL_EFFECT`).
 *
 * Run with: node --test shells/tui/src/allow-browser-free.test.ts
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const root = await mkdtemp(join(tmpdir(), 'lolly-tui-allow-browser-free-'));
after(() => rm(root, { recursive: true, force: true }));
process.env.LOLLY_STATE_DIR = join(root, 'state');
// No browser tier: a refused PNG fails with its reason and the way forward.
process.env.LOLLY_WEB_DIST = join(root, 'no-web');
process.env.LOLLY_RENDERER = 'chromium';
delete process.env.LOLLY_WEB_BASE;

const SKIP = existsSync(join(REPO, 'community', 'color-palette', 'tool.json')) ? false : 'community pack not mounted';

test('the TUI refuses by default, and with the flag draws, warns and records the acceptance', { skip: SKIP }, async () => {
  const { createTuiBridge } = await import('./bridge.ts');
  const { mountTool, exportToFile } = await import('./engine-render.ts');
  const { verifyC2pa } = await import('../../../engine/src/c2pa-verify.ts');
  const { BROWSER_FREE_ACCEPTED } = await import('@lolly-tools/node-shell/export-route');
  const { host, dom } = await createTuiBridge({});
  const { runtime, manifest } = await mountTool('color-palette', host, '', {});

  const refusedPath = join(root, 'refused.png');
  await assert.rejects(exportToFile(runtime, dom, manifest, 'png', refusedPath, { width: 600, height: 600, allowBrowserFree: false }),
    /has not been measured.*To go on, install a browser render tier .* or pass --allow-browser-free to accept a browser-free render that may differ/s);
  assert.equal(existsSync(refusedPath), false, 'nothing written by default');

  const notes: string[] = [];
  const out = join(root, 'accepted.png');
  await exportToFile(runtime, dom, manifest, 'png', out, { width: 600, height: 600, allowBrowserFree: true, c2paDays: 7, onNote: (n) => notes.push(n) });
  assert.match(notes.join('\n'), /this PNG was drawn without a browser because --allow-browser-free was given, and it may differ from the app's/);
  const report = await verifyC2pa(new Uint8Array(readFileSync(out))) as { environment?: Record<string, unknown> };
  assert.equal(report.environment?.accepted, BROWSER_FREE_ACCEPTED);
});

test('the flag does not take a picture that would be wrong: hook pixels from a canvas', { skip: SKIP }, async (t) => {
  const { isCanvasAvailable } = await import('@lolly-tools/node-shell/canvas');
  if (!isCanvasAvailable()) { t.skip('@napi-rs/canvas is not installed here'); return; }
  const { createTuiBridge } = await import('./bridge.ts');
  const { mountTool, exportToFile } = await import('./engine-render.ts');
  const { host, dom } = await createTuiBridge({});
  const logo = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect x="100" y="60" width="200" height="80" fill="#222222"/></svg>').toString('base64');
  const logos = [0, 1, 2].map(() => ({ logo: { source: 'remote', id: logo, _unresolved: true } }));
  const { runtime, manifest } = await mountTool('logo-wall', host, '', { logos, transparentBg: true });
  const out = join(root, 'wall.png');
  await assert.rejects(exportToFile(runtime, dom, manifest, 'png', out, { width: 1080, height: 1080, allowBrowserFree: true }),
    /computed part of the picture with a 2D canvas.*would be wrong, not just different/s);
  assert.equal(existsSync(out), false);
});
