// SPDX-License-Identifier: MPL-2.0
/*
 * The visual-viewport inset branch - lib/viewport-insets.ts.
 *
 * Run directly:  node --test shells/web/src/lib/viewport-insets.test.ts
 *
 * The three cases it separates (pinch-zoom, a retracting URL bar, a soft
 * keyboard) cannot be produced in a desktop browser, so the numbers are pinned
 * here from measured device magnitudes instead: an iPhone-class 390x844 layout
 * viewport, a ~90px browser toolbar, a ~336px keyboard.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeViewportInsets, KEYBOARD_MIN_OCCLUSION } from './viewport-insets.ts';

/** An unzoomed phone with nothing occluding the bottom. */
const idle = {
  scale: 1,
  innerHeight: 844,
  clientWidth: 390,
  clientHeight: 844,
  vvWidth: 390,
  vvHeight: 844,
  offsetTop: 0,
  offsetLeft: 0,
};

test('idle: every inset is zero, so bottom:0 stays native', () => {
  assert.deepEqual(computeViewportInsets(idle), { top: 0, left: 0, right: 0, bottom: 0 });
});

test('pinch-zoom pins all four edges to the visible area', () => {
  // Zoomed 2x and panned: the visible area is half the layout viewport, offset
  // into it. This is the pre-existing behaviour the mobile sheet relies on, so
  // the expectations are the original formula's, spelled out.
  const insets = computeViewportInsets({
    ...idle, scale: 2, vvWidth: 195, vvHeight: 422, offsetTop: 100, offsetLeft: 40,
  });
  assert.deepEqual(insets, {
    top: 100,
    left: 40,
    right: 390 - 40 - 195,
    bottom: 844 - 100 - 422,
  });
});

test('pinch-zoom clamps a negative offset (some browsers overscroll)', () => {
  const insets = computeViewportInsets({
    ...idle, scale: 1.5, vvWidth: 260, vvHeight: 563, offsetTop: -12, offsetLeft: -8,
  });
  assert.equal(insets.top, 0);
  assert.equal(insets.left, 0);
});

test('a retracting URL bar is NOT lifted for', () => {
  // The toolbar shrinking the visual viewport must leave the insets at zero:
  // position:fixed already tracks the layout edges there, and an inset would
  // float the bottom bar above the (often hidden) controls and drift as you
  // scroll. 90px is a full iOS Safari top bar plus bottom toolbar.
  const insets = computeViewportInsets({ ...idle, vvHeight: 844 - 90 });
  assert.deepEqual(insets, { top: 0, left: 0, right: 0, bottom: 0 });
});

test('a soft keyboard lifts the bottom by exactly its occlusion', () => {
  const insets = computeViewportInsets({ ...idle, vvHeight: 844 - 336 });
  assert.deepEqual(insets, { top: 0, left: 0, right: 0, bottom: 336 });
});

test('a soft keyboard leaves top/left/right alone (it only eats the bottom)', () => {
  // iOS also pans the visual viewport to reveal the focused field, so offsetTop
  // is nonzero while the keyboard is up: the occlusion is what is left BELOW
  // the visible area, and the horizontal insets stay zero regardless.
  const insets = computeViewportInsets({ ...idle, vvHeight: 500, offsetTop: 44 });
  assert.deepEqual(insets, { top: 0, left: 0, right: 0, bottom: 844 - 500 - 44 });
});

test('the threshold is the boundary: below stays 0, at it lifts', () => {
  const at = computeViewportInsets({ ...idle, vvHeight: idle.innerHeight - KEYBOARD_MIN_OCCLUSION });
  assert.equal(at.bottom, KEYBOARD_MIN_OCCLUSION);
  const below = computeViewportInsets({ ...idle, vvHeight: idle.innerHeight - KEYBOARD_MIN_OCCLUSION + 1 });
  assert.equal(below.bottom, 0);
  // The threshold has to sit in the gap between the two real magnitudes: past
  // any browser toolbar, under any keyboard. Both bounds are the point.
  assert.ok(KEYBOARD_MIN_OCCLUSION > 100, 'above a URL bar + bottom toolbar');
  assert.ok(KEYBOARD_MIN_OCCLUSION < 250, 'below the shortest soft keyboard');
});

test('a browser that resizes the LAYOUT viewport for the keyboard needs no lift', () => {
  // Where the keyboard shrinks window.innerHeight too (Android Chrome's
  // interactive-widget=resizes-content behaviour), bottom:0 is already above
  // the keyboard - and double-lifting would push the bar into mid-screen.
  const insets = computeViewportInsets({ ...idle, innerHeight: 508, clientHeight: 508, vvHeight: 508 });
  assert.equal(insets.bottom, 0);
});

test('fractional viewport heights round to whole px', () => {
  // iOS reports fractional visualViewport heights; the value is written into a
  // CSS var every frame, so it is rounded to stop subpixel churn.
  const insets = computeViewportInsets({ ...idle, vvHeight: 508.5 });
  assert.equal(insets.bottom, 336, '844 - 508.5 = 335.5 rounds up');
});

test('the callers route through this module and the CSS consumes the var', () => {
  // Drift guard: the branch was inline in main.ts, and re-inlining it (or
  // spotlight computing its own lift from window.innerHeight) is the exact
  // regression this file exists to catch.
  const read = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
  for (const p of ['../main.ts', '../components/spotlight.ts']) {
    assert.match(read(p), /computeViewportInsets\(/, `${p} uses the shared branch`);
  }
  // And the surface the keyboard case exists for: the footer that carries the
  // search field is anchored to the var, not to the layout viewport's bottom.
  assert.match(
    read('../styles/parts/gallery.css'),
    /\.gallery-footer[\s\S]{0,400}?bottom: var\(--vv-bottom, 0px\)/,
    '.gallery-footer rides --vv-bottom',
  );
});
