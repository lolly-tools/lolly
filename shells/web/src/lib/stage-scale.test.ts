// SPDX-License-Identifier: MPL-2.0
/**
 * `--lolly-stage-scale` (lib/stage-scale.ts): written on the live canvas by the fit and
 * the stage zoom, taken away while an export runs, and read by no shell code at all.
 *
 * Run directly:
 *   node --test shells/web/src/lib/stage-scale.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { JSDOM } from 'jsdom';
import { STAGE_SCALE_PROP, holdStageScale, publishStageScale } from './stage-scale.ts';

const SRC = join(import.meta.dirname, '..');

test('the scale is written on the canvas, rounded, and only when it is a real scale', () => {
  const { window } = new JSDOM('<div id="tool-canvas"></div>');
  const canvas = window.document.getElementById('tool-canvas')!;
  publishStageScale(canvas, 0.28123456);
  assert.equal(canvas.style.getPropertyValue(STAGE_SCALE_PROP), '0.2812');
  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) publishStageScale(canvas, bad);
  assert.equal(canvas.style.getPropertyValue(STAGE_SCALE_PROP), '0.2812', 'nonsense never replaces a scale');
});

test('an export holds the scale off the canvas and puts the latest one back', () => {
  const { window } = new JSDOM('<div id="tool-canvas"></div>');
  const canvas = window.document.getElementById('tool-canvas')!;
  publishStageScale(canvas, 0.5);
  const release = holdStageScale(canvas);
  assert.equal(canvas.style.getPropertyValue(STAGE_SCALE_PROP), '', 'a render reads the tool fallback');
  publishStageScale(canvas, 0.75);
  assert.equal(canvas.style.getPropertyValue(STAGE_SCALE_PROP), '', 'a fit during the export waits');
  const inner = holdStageScale(canvas);
  release();
  assert.equal(canvas.style.getPropertyValue(STAGE_SCALE_PROP), '', 'holds nest');
  inner();
  inner();
  assert.equal(canvas.style.getPropertyValue(STAGE_SCALE_PROP), '0.75');
});

/** Every source file under shells/web/src, tests excluded. */
function sources(dir = SRC, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== 'locales' && name !== 'vendor') sources(path, out); continue; }
    if (/\.(ts|css|js)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(path);
  }
  return out;
}

test('the shell writes the scale in two places and never reads it', () => {
  const writers: string[] = [];
  for (const path of sources()) {
    const text = readFileSync(path, 'utf8');
    const rel = relative(SRC, path);
    if (rel === 'lib/stage-scale.ts') continue; // its own doc shows a tool how to read it
    assert.doesNotMatch(text, /var\(\s*--lolly-stage-scale/, `${rel} reads --lolly-stage-scale: it is a bridge for tools, the shell must not lay itself out by it`);
    if (/\bpublishStageScale\(/.test(text)) writers.push(rel);
  }
  assert.deepEqual(writers.sort(), ['views/tool-stage-nav.ts', 'views/tool/stage-layout.ts'],
    'only the fit and the stage zoom publish the scale, and both write the live #tool-canvas');
  const exporting = readFileSync(join(SRC, 'views/tool/exporting.ts'), 'utf8');
  assert.match(exporting, /holdStageScale\(canvasEl\)/, 'the export takes the scale off the canvas while it renders');
});
