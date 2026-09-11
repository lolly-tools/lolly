// SPDX-License-Identifier: MPL-2.0
/**
 * A click deck on a temporary timeline for one export - lib/deck-as-sequence.ts.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/deck-as-sequence.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
const doc = dom.window.document as Document;
const { stageDeckAsSequence, stagedDeckMs } = await import('./deck-as-sequence.ts');

function deck(pages: string[], rootAttrs = ''): HTMLElement {
  const wrap = doc.createElement('div');
  wrap.innerHTML = `<div class="lolly-frames"${rootAttrs}>${pages.map((a) => `<div class="lolly-frame-page" data-pdf-page ${a}></div>`).join('')}</div>`;
  return wrap;
}
const attrs = (el: Element): Record<string, string> => Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]));

test('deck-as-sequence: pages are placed in order, each for its own dwell or the fallback', () => {
  const c = deck(['data-frame-id="a"', 'data-frame-id="b" data-frame-dur="2000"', 'data-frame-id="c"']);
  const restore = stageDeckAsSequence(c, { dwellMs: 5000 });
  assert.ok(restore);
  const pages = [...c.querySelectorAll('[data-pdf-page]')];
  assert.deepEqual(pages.map((p) => p.getAttribute('data-t-start')), ['0', '5000', '7000']);
  assert.deepEqual(pages.map((p) => p.getAttribute('data-t-dur')), ['5000', '2000', '5000']);
  assert.deepEqual(pages.map((p) => p.getAttribute('data-t-lane')), ['seq', 'seq', 'seq']);
  const root = c.querySelector('.lolly-frames')!;
  assert.equal(root.hasAttribute('data-sequence'), true);
  assert.equal(root.getAttribute('data-seq-ms'), '12000');
  assert.equal(root.getAttribute('data-deck-staged'), '1', 'the compositor is told the pages were unplaced');
  assert.equal(stagedDeckMs(deck(['data-frame-id="a"', 'data-frame-id="b" data-frame-dur="2000"', 'data-frame-id="c"']), 5000), 12000);
});

test('deck-as-sequence: restore puts every attribute back exactly', () => {
  const c = deck(['data-frame-id="a"', 'data-frame-id="b" data-frame-dur="2000" data-t-lane="x"'], ' data-deck-transition="fade"');
  const before = [c.querySelector('.lolly-frames')!, ...c.querySelectorAll('[data-pdf-page]')].map(attrs);
  const restore = stageDeckAsSequence(c, { dwellMs: 3000 })!;
  assert.ok(restore);
  restore();
  const after = [c.querySelector('.lolly-frames')!, ...c.querySelectorAll('[data-pdf-page]')].map(attrs);
  assert.deepEqual(after, before);
});

test('deck-as-sequence: a timed document, or a single page, is left alone', () => {
  const timed = deck(['data-t-start="0" data-t-dur="3000"', 'data-t-start="3000" data-t-dur="3000"'], ' data-sequence data-seq-ms="6000"');
  assert.equal(stageDeckAsSequence(timed, { dwellMs: 5000 }), null);
  assert.equal(stageDeckAsSequence(deck(['data-frame-id="only"']), { dwellMs: 5000 }), null);
  assert.equal(stagedDeckMs(timed, 5000), 0);
});

test('deck-as-sequence: a nonsense fallback becomes five seconds, a tiny dwell is floored', () => {
  const c = deck(['', 'data-frame-dur="10"']);
  stageDeckAsSequence(c, { dwellMs: Number.NaN });
  const pages = [...c.querySelectorAll('[data-pdf-page]')];
  assert.deepEqual(pages.map((p) => p.getAttribute('data-t-dur')), ['5000', '100']);
});
