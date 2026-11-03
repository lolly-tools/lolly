// SPDX-License-Identifier: MPL-2.0
/**
 * A scrolling strip that says it scrolls (lib/scroll-cue.ts): which ends hold more,
 * on either axis and in a right-to-left strip, and the cues it puts in the host.
 * jsdom does no layout, so the scroll sizes are set by hand.
 *
 * Run directly:  node --test shells/web/src/lib/scroll-cue.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="dock"><div id="rail" style="display:flex; flex-direction: column"></div></div></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

const { scrollEnds, watchScrollCue } = await import('./scroll-cue.ts');
const $ = (id: string): HTMLElement => document.getElementById(id)!;

function sizes(el: HTMLElement, s: { scrollHeight?: number; clientHeight?: number; scrollTop?: number; scrollWidth?: number; clientWidth?: number; scrollLeft?: number }): void {
  for (const [k, v] of Object.entries(s)) Object.defineProperty(el, k, { value: v, configurable: true, writable: true });
}

test('a strip that fits holds nothing more at either end', () => {
  const el = document.createElement('div');
  sizes(el, { scrollHeight: 300, clientHeight: 300, scrollTop: 0 });
  assert.deepEqual(scrollEnds(el, 'y'), { start: false, end: false });
});

test('upright: more below at the top, more both ways in the middle, more above at the foot', () => {
  const el = document.createElement('div');
  sizes(el, { scrollHeight: 600, clientHeight: 300, scrollTop: 0 });
  assert.deepEqual(scrollEnds(el, 'y'), { start: false, end: true });
  sizes(el, { scrollTop: 150 });
  assert.deepEqual(scrollEnds(el, 'y'), { start: true, end: true });
  sizes(el, { scrollTop: 300 });
  assert.deepEqual(scrollEnds(el, 'y'), { start: true, end: false });
});

test('sideways, including a right-to-left strip whose scrollLeft runs negative', () => {
  const el = document.createElement('div');
  sizes(el, { scrollWidth: 800, clientWidth: 400, scrollLeft: 0 });
  assert.deepEqual(scrollEnds(el, 'x'), { start: false, end: true });
  sizes(el, { scrollLeft: -400 });
  assert.deepEqual(scrollEnds(el, 'x'), { start: true, end: false });
});

test('the watcher marks the host, adds two decorative cues, and takes them away on stop', () => {
  const rail = $('rail');
  const dock = $('dock');
  sizes(rail, { scrollHeight: 600, clientHeight: 300, scrollTop: 0, scrollWidth: 60, clientWidth: 60, scrollLeft: 0 });
  const stop = watchScrollCue(rail, dock);
  assert.equal(dock.dataset.cueAxis, 'y', 'a column scrolls upright');
  assert.equal(dock.dataset.more, 'end');
  const cues = dock.querySelectorAll('.scroll-cue');
  assert.equal(cues.length, 2);
  for (const cue of cues) {
    assert.equal(cue.getAttribute('aria-hidden'), 'true');
    assert.ok(cue.querySelector('svg path'), 'a chevron, built as DOM');
  }
  stop();
  assert.equal(dock.querySelectorAll('.scroll-cue').length, 0);
  assert.equal(dock.hasAttribute('data-more'), false);
  assert.equal(dock.hasAttribute('data-cue-axis'), false);
});

test('a strip that fits leaves no data-more on the host', () => {
  const rail = $('rail');
  const dock = $('dock');
  sizes(rail, { scrollHeight: 300, clientHeight: 300, scrollTop: 0 });
  const stop = watchScrollCue(rail, dock);
  assert.equal(dock.hasAttribute('data-more'), false);
  stop();
});
