// SPDX-License-Identifier: MPL-2.0
/**
 * The TUI's half of the Design PNG route with no browser (plan 371, M3a): a document
 * whose one frame the browser tier would write is drawn here, with its route in the
 * credential; a document of several frames, with none named, stays with the browser tier.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTool, createRuntime, verifyC2pa } from '@lolly/engine';
import { createCliBridge } from '../../cli/src/bridge.ts';
import { toolFetchFile } from './catalog.ts';
import { exportToFile } from './engine-render.ts';

const frame = (id: string, x: number) => ({ id, kind: 'frame', x, y: 0, w: 640, h: 400, bg: '#f4f1ea', order: x });
const rows = [frame('cover', 0), { id: 'chip', kind: 'box', x: 40, y: 200, w: 200, h: 80, bg: '#1c7ed6', shape: 'rounded', radius: 16, frame: 'cover' }];

test('a one-frame Design document exports its PNG with no browser, and a document of several frames does not', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-tui-design-still-'));
  const dom = new JSDOM('<!doctype html><div id="canvas"></div>');
  const saved = { ...process.env };
  Object.assign(process.env, { LOLLY_STATE_DIR: join(dir, 'state'), LOLLY_WEB_DIST: join(dir, 'no-web-build'), LOLLY_RENDERER: 'chromium' });
  delete process.env.LOLLY_WEB_BASE; delete process.env.LOLLY_DESIGN_RASTER; delete process.env.LOLLY_EXPORT_ROUTE;
  try {
    const host = await createCliBridge({ dom });
    const tool = await loadTool('design', toolFetchFile());
    const one = await createRuntime(tool, host, { boxes: rows as never });
    const out = join(dir, 'one.png');
    await exportToFile(one, dom, tool.manifest, 'png', out, { c2paDays: 30 });
    const png = new Uint8Array(await readFile(out));
    const view = new DataView(png.buffer, png.byteOffset);
    assert.deepEqual([view.getUint32(16), view.getUint32(20)], [640, 400], 'the frame at its own size');
    const credential = await verifyC2pa(png);
    assert.equal(credential.environment?.route, 'operations');
    assert.match(String(credential.environment?.renderer), /^design-draw-v\d+\+resvg-js-/);
    one.destroy();

    const two = await createRuntime(tool, host, { boxes: [...rows, frame('second', 700)] as never });
    const none = join(dir, 'two.png');
    await assert.rejects(() => exportToFile(two, dom, tool.manifest, 'png', none, {}), /web shell|browser/i, 'no renderer can take a whole deck here');
    assert.equal(existsSync(none), false);
    two.destroy();
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    dom.window.close();
    await rm(dir, { recursive: true, force: true });
  }
});
