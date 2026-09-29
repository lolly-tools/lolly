// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { parseSequenceStage } from './sequence-plan.ts';
import { sequenceDimensions } from './sequence-dimensions.ts';

function dimensions(body: string, width = 320, height = 320) {
  const dom = new JSDOM(`<div data-sequence data-seq-ms="1000">${body}</div>`);
  try {
    const el = dom.window.document.querySelector<HTMLElement>('[data-sequence]')!;
    // jsdom has no layout; supply the measured sizes from the browser regression.
    for (const node of [el, ...el.querySelectorAll<HTMLElement>('[data-pdf-page]')]) {
      Object.defineProperty(node, 'offsetWidth', { value: parseFloat(node.style.width) || width });
      Object.defineProperty(node, 'offsetHeight', { value: parseFloat(node.style.height) || height });
      Object.defineProperty(node, 'offsetLeft', { value: parseFloat(node.style.left) || 0 });
      Object.defineProperty(node, 'offsetTop', { value: parseFloat(node.style.top) || 0 });
    }
    return sequenceDimensions(parseSequenceStage(el)!, el, 'webm', { width, height }, null);
  } finally { dom.window.close(); }
}

test('a single untimed artboard retains its authored coordinate space when scaled', () => {
  assert.deepEqual(dimensions('<div data-pdf-page style="width:1080px;height:1080px"><div class="lolly-box" data-t-start="0" data-t-dur="1000"></div></div>'), {
    nativeW: 1080, nativeH: 1080, outW: 320, S: 320 / 1080, targetH: 320,
  });
});

test('a landscape artboard keeps its aspect ratio when only the output width changes', () => {
  const result = dimensions('<div data-pdf-page style="width:1920px;height:1080px"><div class="lolly-box" data-t-start="0" data-t-dur="1000"></div></div>', 480, 270);
  assert.deepEqual(result, { nativeW: 1920, nativeH: 1080, outW: 480, S: 0.25, targetH: 270 });
});

test('timed frame scenes retain their requested output viewport', () => {
  const result = dimensions('<div data-pdf-page data-t-start="0" data-t-dur="1000" style="width:1080px;height:1080px"></div>', 640, 360);
  assert.deepEqual(result, { nativeW: 640, nativeH: 360, outW: 640, S: 1, targetH: 360 });
});

test('frameless, displaced-board, multiple-board and pasteboard compositions keep their existing canvas space', () => {
  const layer = '<div class="lolly-box" data-t-start="0" data-t-dur="1000"></div>';
  for (const html of [layer, `<div data-pdf-page style="left:200px;width:1080px;height:1080px">${layer}</div>`, `<div data-pdf-page>${layer}</div>${layer}`, `<div data-pdf-page>${layer}</div><div data-pdf-page>${layer}</div>`]) {
    assert.deepEqual(dimensions(html), { nativeW: 320, nativeH: 320, outW: 320, S: 1, targetH: 320 });
  }
});
