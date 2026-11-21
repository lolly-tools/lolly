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
import { existsSync } from 'node:fs';
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

/** The PNG the CLI draws for a tool at 1000 x 1000, browser-free: no web shell, served or built, and no desktop app. */
function cliPng(toolId: string, dir: string): { status: number | null; stderr: string; out: string } {
  const out = join(dir, `${toolId}.png`);
  const env: Record<string, string | undefined> = { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: dir, LOLLY_WEB_DIST: join(dir, 'no-web-build'), LOLLY_RENDERER: 'chromium', NO_COLOR: '1' };
  delete env.LOLLY_WEB_BASE;
  const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', toolId, '--width=1000', '--height=1000', `--output=${out}`, '--no-provenance'], {
    cwd: ROOT, encoding: 'utf8', env,
  });
  return { status: run.status, stderr: run.stderr, out };
}

test('a tool that wraps its root <svg> in a <div> draws a sized PNG, or says why it needs the browser', async (t) => {
  try { await import('sharp'); } catch { t.skip('sharp unavailable on this platform'); return; }
  const sharp = (await import('sharp')).default;
  const dir = await mkdtemp(join(tmpdir(), 'lolly-root-svg-wrapped-'));
  try {
    const run = cliPng('signature', dir);
    assert.equal(run.status, 0, `signature: ${run.stderr}`);
    assert.doesNotMatch(run.stderr, /browser render tier/i, 'signature drew with no browser');
    const meta = await sharp(run.out).metadata();
    assert.deepEqual([meta.width, meta.height], [1000, 1000], 'signature is 1000 x 1000');
    // Measured outside the fidelity bands, or a paged document: the browser-free route
    // refuses them (resvg-admission.ts), and with no browser tier nothing is written.
    for (const [toolId, why] of [['color-palette', /has not been measured/], ['contrast-check', /has not been measured/], ['print-sheet', /a paged document/]] as const) {
      const refused = cliPng(toolId, dir);
      assert.equal(refused.status, 3, `${toolId}: ${refused.stderr}`);
      assert.match(refused.stderr, why, toolId);
      assert.equal(existsSync(refused.out), false, `${toolId} wrote no file`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const frameWith = (box: Record<string, unknown>) => [
  { id: 'cover', kind: 'frame', x: 0, y: 0, w: 640, h: 400, bg: '#f4f1ea', order: 0 },
  { ...box, frame: 'cover' },
];

/**
 * A Design frame's browser-free PNG at `width` x `height` (plan 371, M3a): its size and
 * the alpha at its top-left corner, or the line that sent it to the browser tier.
 */
async function framePng(boxes: unknown[], dir: string, name: string, width: number, height: number): Promise<{ alpha?: number; size?: [number, number]; handedOn?: string }> {
  const out = join(dir, `${name}.png`);
  const env: Record<string, string | undefined> = { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: dir, LOLLY_WEB_DIST: join(dir, 'no-web-build'), LOLLY_RENDERER: 'chromium', NO_COLOR: '1' };
  delete env.LOLLY_WEB_BASE; delete env.LOLLY_DESIGN_RASTER;
  const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'design', `--boxes=${JSON.stringify(boxes)}`, '--s=cover',
    `--width=${width}`, `--height=${height}`, '--transparentBg=1', `--output=${out}`, '--no-provenance'], { cwd: ROOT, encoding: 'utf8', env });
  const handedOn = /handed to the browser render tier because ([^\n]+)/.exec(run.stderr)?.[1];
  if (handedOn) return { handedOn };
  assert.equal(run.status, 0, run.stderr);
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { alpha: data[3]!, size: [info.width, info.height] };
}

// The frame used to be drawn by resvg at any requested size and letterboxed into it, a
// picture the browser tier never draws: that tier scales the page to the width, sets the
// page at the top and crops or leaves the rest empty. The browser-free route now draws a size of
// the page's own proportions and hands any other to the browser tier, the same for both.
test('a Design frame\'s PNG is drawn the same whether it holds a shape or only text', async (t) => {
  try { await import('sharp'); } catch { t.skip('sharp unavailable on this platform'); return; }
  const dir = await mkdtemp(join(tmpdir(), 'lolly-root-svg-'));
  try {
    const shapeRows = frameWith({ id: 'p', kind: 'path', x: 40, y: 200, w: 200, h: 80, bg: '#1c7ed6', path: 'M0,0L200,0L200,80Z' });
    const textRows = frameWith({ id: 't', kind: 'text', x: 40, y: 40, w: 560, h: 120, text: 'Words only', fontSize: 40 });
    const shape = await framePng(shapeRows, dir, 'shape', 1280, 800);
    const text = await framePng(textRows, dir, 'text', 1280, 800);
    assert.deepEqual(shape.size, [1280, 800]);
    assert.deepEqual(text.size, [1280, 800]);
    assert.equal(text.alpha, 255, 'the page fills the requested size; nothing is letterboxed');
    assert.equal(shape.alpha, text.alpha, 'the frame with a shape is drawn the same way');
    const tallShape = await framePng(shapeRows, dir, 'tall-shape', 400, 800);
    const tallText = await framePng(textRows, dir, 'tall-text', 400, 800);
    assert.match(tallText.handedOn ?? '', /changes the page's proportions/);
    assert.equal(tallShape.handedOn, tallText.handedOn, 'a size of other proportions goes to the browser tier for both');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
