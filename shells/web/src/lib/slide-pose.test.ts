// SPDX-License-Identifier: MPL-2.0
/**
 * lib/slide-pose.ts - the one answer to "when is each box on this slide" that the presenter
 * and the video compositor both read (plans/184 R1).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/slide-pose.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
const doc = dom.window.document as Document;
const { poseSlideBoxes, PENDING_MS } = await import('./slide-pose.ts');

function page(boxes: string[]): HTMLElement {
  const p = doc.createElement('div');
  p.className = 'lolly-frame-page';
  p.innerHTML = boxes.map((a, i) => `<div class="lolly-box" data-box-id="b${i}" ${a}></div>`).join('');
  return p;
}
const box = (p: HTMLElement, i: number): HTMLElement => p.querySelector<HTMLElement>(`[data-box-id="b${i}"]`)!;
const attrs = (el: Element): Record<string, string> => Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]));

test('slide-pose: the three appear modes, for the podium (clicks parked)', () => {
  const p = page([
    'data-pr-enter="fade" data-pr-enter-ms="300"',          // with the slide, animated
    '',                                                       // with the slide, nothing to animate
    'data-build="1" data-pr-enter="rise"',                    // a click
    'data-t-start="5600" data-t-dur="900"',                   // at a time (document ms)
  ]);
  const pose = poseSlideBoxes(p, { reduced: false, clicks: 'park', pageStartMs: 0, authoredPageStartMs: 5000, pageDurMs: null });
  assert.equal(pose.posed, 3, 'the plain box is not on the clock');
  const b0 = box(p, 0);
  assert.equal(b0.getAttribute('data-t-start'), '0');
  assert.equal(b0.getAttribute('data-t-enter'), 'fade', 'the presenter-only Enter became the applier’s own');
  assert.equal(b0.getAttribute('data-t-enter-ms'), '300');
  assert.equal(b0.hasAttribute('data-t-dur'), false, 'open-ended: no length, no exit');
  assert.equal(box(p, 1).hasAttribute('data-t-start'), false);
  assert.equal(box(p, 2).getAttribute('data-t-start'), String(PENDING_MS), 'parked until its click');
  assert.equal(box(p, 3).getAttribute('data-t-start'), '600', 'rebased off the page’s authored start');
  assert.equal(box(p, 3).getAttribute('data-t-dur'), '900', 'its own length kept');
});

test('slide-pose: the film shows clicks from the start, on the page’s timeline start', () => {
  const p = page(['data-build="2" data-pr-enter="rise"', 'data-t-start="1200"']);
  const pose = poseSlideBoxes(p, { reduced: false, clicks: 'show', pageStartMs: 5000, authoredPageStartMs: 0, pageDurMs: 4000 });
  assert.equal(pose.posed, 2);
  assert.equal(box(p, 0).getAttribute('data-t-start'), '5000', 'a click box enters with the slide');
  assert.equal(box(p, 0).getAttribute('data-t-enter'), 'rise');
  assert.equal(box(p, 1).getAttribute('data-t-start'), '6200', 'a timed box of a staged click deck moves with its page');
});

test('slide-pose: a box with an Exit ends where the slide ends, when the slide has a length', () => {
  const p = page(['data-pr-exit="fade" data-pr-exit-ms="500"', 'data-t-start="1000" data-pr-exit="fade"', 'data-pr-exit="none"']);
  poseSlideBoxes(p, { reduced: false, clicks: 'show', pageStartMs: 2000, authoredPageStartMs: 0, pageDurMs: 3000 });
  assert.equal(box(p, 0).getAttribute('data-t-dur'), '3000', 'with the slide: the whole slide');
  assert.equal(box(p, 1).getAttribute('data-t-start'), '3000');
  assert.equal(box(p, 1).getAttribute('data-t-dur'), '2000', 'timed with no length of its own: to the slide’s end');
  assert.equal(box(p, 2).hasAttribute('data-t-start'), true, 'an Exit of none still put it on the clock');
  assert.equal(box(p, 2).hasAttribute('data-t-dur'), false, 'but gave it no end');
  // No length known: nothing ends; the podium plays exits on the way out instead.
  const q = page(['data-pr-exit="fade"']);
  poseSlideBoxes(q, { reduced: false, clicks: 'park', pageStartMs: 0, authoredPageStartMs: 0, pageDurMs: null });
  assert.equal(box(q, 0).hasAttribute('data-t-dur'), false);
});

test('slide-pose: reduced motion strips the moving parts and keeps the timing', () => {
  const p = page(['data-pr-enter="fade" data-t-hold="wobble" data-t-split="word"', 'data-build="1" data-pr-enter="rise"']);
  const pose = poseSlideBoxes(p, { reduced: true, clicks: 'park', pageStartMs: 0, authoredPageStartMs: 0, pageDurMs: null });
  assert.equal(box(p, 0).hasAttribute('data-t-enter'), false);
  assert.equal(box(p, 0).hasAttribute('data-t-hold'), false);
  assert.equal(box(p, 0).hasAttribute('data-t-split'), false);
  assert.equal(box(p, 0).hasAttribute('data-t-start'), false, 'nothing left to animate, so not on the clock');
  assert.equal(box(p, 1).getAttribute('data-t-start'), String(PENDING_MS), 'the fragment is still a fragment');
  assert.equal(pose.posed, 1);
});

test('slide-pose: restore puts every attribute back exactly', () => {
  const p = page([
    'data-pr-enter="fade" data-pr-enter-ms="300"',
    'data-build="1" data-pr-enter="rise" data-t-dur="4"',
    'data-t-start="5600" data-t-dur="900" data-t-exit="fade"',
    'data-t-kf="0:1"',
  ]);
  const before = [...p.children].map(attrs);
  const pose = poseSlideBoxes(p, { reduced: true, clicks: 'show', pageStartMs: 7000, authoredPageStartMs: 5000, pageDurMs: 3000 });
  assert.ok(pose.posed > 0);
  pose.restore();
  assert.deepEqual([...p.children].map(attrs), before);
});
