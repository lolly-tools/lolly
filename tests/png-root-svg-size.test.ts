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
 *
 * The root is the one the CLI's SVG export writes: the node, or the `<svg>` at the
 * end of a chain of single drawable children. Colour Palette, Contrast Check, Print
 * Sheet and Signature wrap their root `<svg viewBox>` in a `<div>`, and keep the
 * sized export they always had.
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

test('the root is the node, or the <svg> at the end of a chain of single drawable children', () => {
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

  // A Design frame as the CLI hydrates one: each box holds its shape's <svg> and a text layer.
  const frame = node('<div class="lolly-frame-page" data-frame-id="cover"><div class="lolly-box" data-box-id="p">'
    + '<svg class="lolly-box-path" width="200" height="80" viewBox="0 0 200 80" preserveAspectRatio="none"><path d="M0 0H200V80Z"/></svg>'
    + '<div class="lolly-box-text"></div></div></div>');
  assert.equal(drawnRootSvg(frame), null, 'a shape inside an HTML frame is not the root');
  assert.deepEqual(svgExportSize(frame, { width: 400, height: 800 }), {});
  const own = frame.querySelector('svg')!;
  assert.equal(drawnRootSvg(own), own, 'a node that is an <svg> is its own root');
  assert.deepEqual(svgExportSize(node('<svg width="10" height="10"></svg>'), { width: 400, height: 800 }), {}, 'no viewBox, no size');

  // A template that wraps its root <svg> in a <div>, as Colour Palette and Signature do.
  const wrapped = node('<div class="palette"><svg class="palette-svg" viewBox="0 0 1200 630"><rect width="1200" height="630"/></svg></div>');
  assert.equal(drawnRootSvg(wrapped), wrapped.querySelector('svg'), 'a wrapper with one drawable child leads to its <svg>');
  assert.deepEqual(svgExportSize(wrapped, { width: 1000, height: 1000 }), { width: 1000, height: 1000 });
  const deep = node('<div><section><figure><svg viewBox="0 0 10 10"></svg></figure></section></div>');
  assert.equal(drawnRootSvg(deep)?.tagName.toLowerCase(), 'svg', 'several wrappers deep');
  const tooDeep = node('<div>'.repeat(9) + '<svg viewBox="0 0 10 10"></svg>' + '</div>'.repeat(9));
  assert.equal(drawnRootSvg(tooDeep), null, 'past eight wrappers is a layout');
  assert.equal(drawnRootSvg(node('<div><svg viewBox="0 0 10 10"></svg><p>caption</p></div>')), null, 'an <svg> beside text is part of a layout');
});

test('the CLI\'s SVG export finds its root with the same rule', async () => {
  const { readFile } = await import('node:fs/promises');
  const bridge = await readFile(join(ROOT, 'shells', 'cli', 'src', 'bridge.ts'), 'utf8');
  assert.match(bridge, /import \{ drawnRootSvg \} from '@lolly-tools\/node-shell\/raster';/);
  assert.match(bridge, /const rootSvgOf = drawnRootSvg;/);
  assert.doesNotMatch(bridge, /function rootSvgOf\(/, 'no second copy of the rule');
});

/** The PNG the CLI draws for a tool at 1000 x 1000, browser-free. */
function cliPng(toolId: string, dir: string): { status: number | null; stderr: string; out: string } {
  const out = join(dir, `${toolId}.png`);
  const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', toolId, '--width=1000', '--height=1000', `--output=${out}`, '--no-provenance'], {
    cwd: ROOT, encoding: 'utf8',
    env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: dir, LOLLY_WEB_DIST: join(dir, 'no-web-build'), NO_COLOR: '1' },
  });
  return { status: run.status, stderr: run.stderr, out };
}

test('the tools that wrap their root <svg> in a <div> still draw a sized PNG', async (t) => {
  try { await import('sharp'); } catch { t.skip('sharp unavailable on this platform'); return; }
  const sharp = (await import('sharp')).default;
  const dir = await mkdtemp(join(tmpdir(), 'lolly-root-svg-wrapped-'));
  try {
    for (const toolId of ['color-palette', 'contrast-check', 'print-sheet', 'signature']) {
      const run = cliPng(toolId, dir);
      assert.equal(run.status, 0, `${toolId}: ${run.stderr}`);
      assert.doesNotMatch(run.stderr, /browser render tier/i, `${toolId} drew with no browser`);
      const meta = await sharp(run.out).metadata();
      assert.deepEqual([meta.width, meta.height], [1000, 1000], `${toolId} is 1000 x 1000`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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
