// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's visualiser (views/music-studio/viz-stage.ts): the band opens on
 * the spectrum analyser, Play leaves it there rather than switching to MilkDrop, the show
 * has no "off", and the band carries its settings, Expand and Full screen as labelled
 * buttons.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio/viz-stage.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { storedMode, vizStageHtml, type VizMode } from './viz-stage.ts';

const BAND: readonly VizMode[] = ['bars', 'scope', 'milkdrop', 'off'];
const SHOW: readonly VizMode[] = ['bars', 'scope', 'milkdrop'];

test('a stored mode reads back, and anything else falls back', () => {
  assert.equal(storedMode(null, BAND, 'bars'), 'bars', 'nothing stored: the analyser');
  assert.equal(storedMode('scope', BAND, 'bars'), 'scope');
  assert.equal(storedMode('full', BAND, 'bars'), 'bars', 'an old or unknown value');
  assert.equal(storedMode('off', SHOW, 'milkdrop'), 'milkdrop', 'the show has no off');
});

test('the band holds both canvases and its three labelled controls', () => {
  const html = vizStageHtml();
  assert.match(html, /<canvas class="ms-viz" data-viz aria-hidden="true">/);
  assert.match(html, /data-viz-rich aria-hidden="true" hidden/, 'MilkDrop\'s canvas waits until it is chosen');
  assert.match(html, /role="toolbar" aria-label="Visualiser"/);
  assert.match(html, /data-viz-menu aria-haspopup="dialog" aria-expanded="false" aria-label="Visualiser settings"/);
  assert.match(html, /data-viz-expand aria-pressed="false" aria-label="Expand the visualiser"/);
  assert.match(html, /data-viz-full aria-label="Full screen"/);
});

test('the band opens on the analyser and Play keeps it, with MilkDrop loaded only when shown', () => {
  const dir = new URL('./', import.meta.url);
  const feature = [readFileSync(new URL('../music-studio.ts', import.meta.url), 'utf8'),
    ...readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => readFileSync(new URL(f, dir), 'utf8'))].join('\n');
  const stage = readFileSync(new URL('./viz-stage.ts', import.meta.url), 'utf8');
  assert.match(stage, /storedMode\(read\(BAND_KEY\), BAND_MODES, 'bars'\)/, 'the analyser by default');
  assert.match(stage, /prefersReducedMotion\(\) \? 'bars' : 'milkdrop'/, 'the show opens on MilkDrop unless motion is reduced');
  assert.doesNotMatch(feature, /vizMode = 'milkdrop'/, 'nothing switches the band to MilkDrop behind the person\'s back');
  assert.match(stage, /import\('\.\.\/\.\.\/lib\/neurospicy-dock-host\.ts'\)/, 'MilkDrop is the Neurospicy player\'s, loaded on demand');
  assert.doesNotMatch(feature, /from '\.\.\/lib\/butterchurn-viz\.ts'|from '\.\.\/\.\.\/lib\/butterchurn-viz\.ts'/, 'no second butterchurn integration');
  assert.doesNotMatch(feature, /data-viz-mode/, 'the timeline header no longer carries a mode cycle');
});
