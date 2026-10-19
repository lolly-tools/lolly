// SPDX-License-Identifier: MPL-2.0
/**
 * foldBody: the shared fold motion for button-driven sections. jsdom has no Web
 * Animations API, so each test either relies on that (the end state applies at once)
 * or gives the body a recording `animate` that the test finishes by hand.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div class="card"><button>Head</button><div class="body">Body</div></div></body></html>');
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

const { foldBody } = await import('./disclosure-motion.ts');

interface FakeAnimation { keyframes: Keyframe[]; cancelled: boolean; finish: () => void; cancel: () => void; addEventListener: (type: string, fn: () => void) => void }

/** A body whose animate() records each call and lets the test finish each animation by hand. */
function recordingBody(): { body: HTMLElement; calls: FakeAnimation[] } {
  const body = document.querySelector<HTMLElement>('.body')!;
  const calls: FakeAnimation[] = [];
  (body as unknown as { animate: (k: Keyframe[]) => FakeAnimation }).animate = (keyframes: Keyframe[]) => {
    const listeners: Array<() => void> = [];
    const animation: FakeAnimation = {
      keyframes, cancelled: false,
      finish: () => { for (const fn of listeners) fn(); },
      cancel: () => { animation.cancelled = true; },
      addEventListener: (_type, fn) => { listeners.push(fn); },
    };
    calls.push(animation);
    return animation;
  };
  return { body, calls };
}

test('without the Web Animations API the end state applies at once', () => {
  const body = document.createElement('div');
  const seen: boolean[] = [];
  foldBody(body, true, open => seen.push(open));
  foldBody(body, false, open => seen.push(open));
  assert.deepEqual(seen, [true, false]);
});

test('opening shows the body first, then grows and fades it in', () => {
  const { body, calls } = recordingBody();
  const seen: boolean[] = [];
  foldBody(body, true, open => seen.push(open));
  assert.deepEqual(seen, [true], 'the open state is applied before the motion starts');
  assert.equal(calls.length, 2, 'one size motion and one fade');
  assert.equal(calls[0]!.keyframes[0]!.height, '0px', 'grows from nothing');
  assert.equal(calls[1]!.keyframes[0]!.opacity, 0);
  calls[0]!.finish();
  assert.ok(calls.every(call => call.cancelled), 'once done the motion is cleared and the body is back to a natural size');
});

test('closing keeps the body until the motion ends, then applies the closed state', () => {
  const { body, calls } = recordingBody();
  const seen: boolean[] = [];
  foldBody(body, false, open => seen.push(open));
  assert.deepEqual(seen, [], 'still shown while it folds');
  assert.equal(calls[0]!.keyframes[1]!.height, '0px', 'shrinks to nothing');
  calls[0]!.finish();
  assert.deepEqual(seen, [false]);
});

test('a second press part way through takes over from the first', () => {
  const { body, calls } = recordingBody();
  const seen: boolean[] = [];
  foldBody(body, false, open => seen.push(open));
  foldBody(body, true, open => seen.push(open));
  assert.ok(calls[0]!.cancelled && calls[1]!.cancelled, 'the closing motion stops');
  calls[0]!.finish();
  assert.deepEqual(seen, [true], 'the stopped close never hides the body');
});

test('Reduce motion applies the end state at once', () => {
  const { body, calls } = recordingBody();
  document.documentElement.dataset.a11yMotion = 'reduce';
  try {
    const seen: boolean[] = [];
    foldBody(body, false, open => seen.push(open));
    assert.deepEqual(seen, [false]);
    assert.equal(calls.length, 0, 'no motion runs');
  } finally {
    delete document.documentElement.dataset.a11yMotion;
  }
});
