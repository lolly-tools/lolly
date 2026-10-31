// SPDX-License-Identifier: MPL-2.0
/**
 * The browser-free PNG takes the requested width and height into its SVG export
 * only when the drawing's ROOT `<svg>` has a viewBox, on the CLI, the TUI and the
 * MCP server alike (packages/node-shell/src/raster.ts `drawnRootSvg`).
 *
 * Run with: node --test tests/png-root-svg-size.test.ts
 *
 * The three shells used to look for ANY `<svg viewBox>` under the drawing. A Design
 * frame is HTML, and each shape or connector in it is an inline `<svg viewBox>`, so a
 * frame holding one shape was stretched to the requested shape while the same frame
 * holding only text was letterboxed. The PNG of a frame must not depend on what
 * kind of box it holds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { drawnRootSvg, svgExportSize } from '../packages/node-shell/src/raster.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';

const ROOT = repoRoot();

test('the root is the node, or its one drawable child when that is an <svg>', () => {
  const { document } = new JSDOM('<!DOCTYPE html><body></body>').window;
  const node = (html: string): Element => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div as unknown as Element;
  };
  const tool = node('<style>x{}</style><svg viewBox="0 0 10 10"></svg><div data-export-hide>warning</div>');
  assert.equal(drawnRootSvg(tool)?.tagName.toLowerCase(), 'svg', 'a template whose root is an <svg>');
  assert.deepEqual(svgExportSize(tool, { width: 600, height: 900 }), { width: 600, height: 900 });
  assert.deepEqual(svgExportSize(tool, { width: 210, height: 297, unit: 'mm' }), { width: '210mm', height: '297mm' });
  assert.deepEqual(svgExportSize(tool, { width: 600 }), {}, 'one side keeps the scaling');

  const frame = node('<div class="lolly-box"><svg class="lolly-box-path" viewBox="0 0 200 80" preserveAspectRatio="none"><path d="M0 0H200V80Z"/></svg></div>');
  assert.equal(drawnRootSvg(frame), null, 'a shape inside an HTML frame is not the root');
  assert.deepEqual(svgExportSize(frame, { width: 400, height: 800 }), {});
  const own = frame.querySelector('svg')!;
  assert.equal(drawnRootSvg(own), own, 'a node that is an <svg> is its own root');
  assert.deepEqual(svgExportSize(node('<svg width="10" height="10"></svg>'), { width: 400, height: 800 }), {}, 'no viewBox, no size');
});

const frameWith = (box: Record<string, unknown>) => [
  { id: 'cover', kind: 'frame', x: 0, y: 0, w: 640, h: 400, bg: '#f4f1ea', order: 0 },
  { ...box, frame: 'cover' },
];

/** The PNG's alpha at its top-left corner: 0 when letterboxed, 255 when the frame was stretched to the corner. */
async function cornerAlpha(boxes: unknown[], dir: string, name: string): Promise<{ alpha: number; size: [number, number] }> {
  const out = join(dir, `${name}.png`);
  const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'design', `--boxes=${JSON.stringify(boxes)}`, '--s=cover',
    '--width=400', '--height=800', '--transparentBg=1', `--output=${out}`, '--no-provenance'], {
    cwd: ROOT, encoding: 'utf8',
    env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: dir, LOLLY_WEB_DIST: join(dir, 'no-web-build'), NO_COLOR: '1' },
  });
  assert.equal(run.status, 0, run.stderr);
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { alpha: data[3]!, size: [info.width, info.height] };
}

test('a Design frame\'s PNG is letterboxed whether it holds a shape or only text', async (t) => {
  try { await import('sharp'); } catch { t.skip('sharp unavailable on this platform'); return; }
  const dir = await mkdtemp(join(tmpdir(), 'lolly-root-svg-'));
  try {
    const shape = await cornerAlpha(frameWith({ id: 'p', kind: 'path', x: 40, y: 200, w: 200, h: 80, bg: '#1c7ed6', path: 'M0,0L200,0L200,80Z' }), dir, 'shape');
    const text = await cornerAlpha(frameWith({ id: 't', kind: 'text', x: 40, y: 40, w: 560, h: 120, text: 'Words only', fontSize: 40 }), dir, 'text');
    assert.deepEqual(shape.size, [400, 800]);
    assert.deepEqual(text.size, [400, 800]);
    assert.equal(text.alpha, 0, 'the text-only frame is letterboxed');
    assert.equal(shape.alpha, text.alpha, 'the frame with a shape is drawn the same way');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
