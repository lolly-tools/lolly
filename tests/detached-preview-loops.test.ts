// SPDX-License-Identifier: MPL-2.0
/**
 * A tool's animation loop stops, and releases its renderer, once its canvas leaves the
 * document.
 *
 * Run with:
 *   node --test tests/detached-preview-loops.test.ts
 *
 * A gallery look, a batch row and a compose child are one-shot renders: the shell
 * mounts the template on an offscreen stage, exports it and removes the stage. No one
 * calls the disposer a template registered; only the NEXT paint of the same tool does.
 * The 3D, Booth, Flythrough and 3-D chart loops checked an epoch that moves only on
 * that next paint, so each look they rendered kept drawing on a detached canvas for
 * the rest of the session. A cold gallery rendering a hundred looks then starved its
 * own preview queue and never settled. Synth (tests/synth.test.ts) and Timezone
 * already had this guard.
 *
 * jsdom cannot run these loops to their first frame (they need a GPU renderer and a
 * loaded model or picture), so this asserts the guard in the source, as the synth
 * test does: inside the loop, ahead of any drawing, a detached canvas runs the same
 * disposer the next paint would.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(resolve(root, rel), 'utf8');

/** The body of `function <name>(...) {` up to its matching closing brace. */
function body(source: string, name: string): string {
  const head = new RegExp(`function ${name}\\s*\\([^)]*\\)\\s*\\{`).exec(source);
  assert.ok(head, `function ${name} exists`);
  let depth = 0;
  for (let i = head.index + head[0].length - 1; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(head.index, i + 1);
  }
  throw new Error(`function ${name} is not closed`);
}

const LOOPS = [
  { file: 'community/3d/template.html', loop: 'loop', handle: 'window.__lolly3d = { dispose: disposeAll }' },
  { file: 'community/booth-studio/template.html', loop: 'loop', handle: 'home.__lollyBooth = { dispose: disposeAll }' },
  { file: 'community/flythrough/template.html', loop: 'loop', handle: 'home.__lollyFly = { dispose: disposeAll }' },
];

// A template tile is drawn while its tool is open, so two copies of one template are on
// the page at once. Booth and Flythrough kept one renderer handle on `window` and found
// their canvas by a page-wide id: the tile's copy disposed the open tool's renderer, then
// drew on the open tool's canvas, whose context was lost, and the tool opened blank.
const PER_COPY = [
  { file: 'community/booth-studio/template.html', name: 'Booth', ids: ['booth-canvas', 'booth-proxy', 'booth-state'] },
  { file: 'community/flythrough/template.html', name: 'Fly', ids: ['fly-canvas', 'fly-state'] },
];

for (const { file, name, ids } of PER_COPY) {
  test(`${file}: each copy on the page keeps its own renderer`, () => {
    const source = read(file);
    assert.ok(
      source.includes('var home = (document.currentScript && document.currentScript.parentNode) || document.body;'),
      'the script works inside the element its paint was written into',
    );
    for (const id of ids) {
      assert.ok(source.includes(`home.querySelector('#${id}')`), `#${id} is found inside that element`);
      assert.ok(!source.includes(`document.getElementById('${id}')`), `#${id} is not looked up page-wide`);
    }
    assert.doesNotMatch(source, new RegExp(`window\\.__lolly${name}(Epoch)?\\b`), 'no renderer handle or epoch is shared through window');
    assert.ok(source.includes(`home.__lolly${name}Epoch = (home.__lolly${name}Epoch || 0) + 1;`), 'the epoch counts paints of this copy only');
  });
}

for (const { file, loop, handle } of LOOPS) {
  test(`${file}: the live loop disposes when its canvas is detached`, () => {
    const source = read(file);
    const fn = body(source, loop);
    const guard = fn.indexOf('if (!canvas.isConnected) { disposeAll(); return; }');
    assert.ok(guard > 0, 'the loop checks canvas.isConnected and disposes');
    const draw = fn.search(/renderFrame\(|requestAnimationFrame\(/);
    assert.ok(draw > guard, 'before it draws or schedules another frame');
    assert.ok(source.includes(handle), 'the disposer the loop calls is the one the next paint calls');
    const dispose = body(source, 'disposeAll');
    assert.match(dispose, /if \(disposed\) return;/, 'disposing twice is harmless');
    assert.match(dispose, /cancelAnimationFrame\(raf\)/);
    assert.match(dispose, /renderer\.dispose\(\)/, 'the renderer, and the GPU device or GL context it holds, go too');
  });
}

test('flythrough: the frame callback checks again, since it runs a frame after the loop', () => {
  const fn = body(read('community/flythrough/template.html'), 'loop');
  const callback = fn.slice(fn.indexOf('requestAnimationFrame(function (ts) {'));
  assert.ok(callback.includes('if (!canvas.isConnected) { disposeAll(); return; }'));
});

test('chart-three: the motion tick disposes when its canvas is detached', () => {
  const source = read('community/chart/lib/chart-three.js');
  const tick = body(source, 'tick');
  const guard = tick.indexOf('if (!canvas.isConnected) { api.dispose(); return; }');
  assert.ok(guard > 0, 'the tick checks canvas.isConnected and disposes');
  assert.ok(tick.indexOf('renderAt(') > guard, 'before it renders');
  assert.match(source, /var api = \{[\s\S]*?dispose:function\(\)\{[\s\S]*?\};\s*return api;/,
    'the tick calls the same dispose() the chart template calls');
});

test('timezone: a one-shot render is a still picture', () => {
  // Not a leak, but the same one-shot render: spinning kept the DOM changing, so the
  // render never settled and the look froze on whatever frame the spin reached.
  const src = read('community/timezone/src/renderer.ts');
  assert.match(src, /playing = wantsMotion && !reduced && !root\.closest\('\[data-lolly-offscreen\]'\);/);
  // The bundle is what ships; it must carry the same rule.
  assert.ok(read('community/timezone/lib/renderer.min.js').includes('!i.closest("[data-lolly-offscreen]")'),
    'lib/renderer.min.js carries the offscreen still');
  // The stage marks itself, so the rule has something to read.
  assert.match(read('shells/web/src/pro/render-export.ts'), /canvas\.dataset\.lollyOffscreen = ''/);
});
