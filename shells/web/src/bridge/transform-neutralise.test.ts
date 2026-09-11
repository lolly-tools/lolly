// SPDX-License-Identifier: MPL-2.0
/**
 * The two pure predicates behind the walkers' transform guard
 * (bridge/transform-neutralise.ts - plans/104 section 9 P3.1 failure 2).
 *
 * The guard's BEHAVIOUR needs a real cascade and a real animation timeline, so it is
 * pinned in `export-transform-animation.test.ts`, which drives the real walker in a
 * real Chromium. What is testable without any of that is the decision table: which
 * computed transforms send an element down a wrap-and-recurse branch, and which
 * animations are worth stopping. Both run on a bare `pnpm test`, so the guard keeps
 * some cover on a machine with no browser installed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapsInWalker, animatesTransform } from './transform-neutralise.ts';

test('wrapsInWalker mirrors the walker branches exactly', () => {
  // Nothing to neutralise.
  assert.equal(wrapsInWalker(''), false);
  assert.equal(wrapsInWalker(null), false);
  assert.equal(wrapsInWalker('none'), false);
  // Pure translate: the AABB path already carries it, so it is not a wrap.
  assert.equal(wrapsInWalker('matrix(1, 0, 0, 1, 30, 10)'), false);
  // Rotation, skew, and scale (scale wraps because computed LENGTHS in the subtree
  // are not scaled by the client rect - the walker's own reason).
  assert.equal(wrapsInWalker('matrix(0.866025, 0.5, -0.5, 0.866025, 0, 0)'), true);
  assert.equal(wrapsInWalker('matrix(1, 0, 0.4, 1, 0, 0)'), true);
  assert.equal(wrapsInWalker('matrix(1.2, 0, 0, 1.2, 0, 0)'), true);
  // Sub-threshold scale is not a wrap (the 1e-4 the branch uses).
  assert.equal(wrapsInWalker('matrix(1.00001, 0, 0, 1, 0, 0)'), false);
  // Real 3-D/perspective: parseCssMatrix refuses it and the AABB path owns it, so
  // there is nothing for the guard to do - it must NOT report a wrap.
  assert.equal(wrapsInWalker('matrix3d(1,0,0,0, 0,1,0,-0.002, 0,0,1,0, 0,0,0,1)'), false);
  assert.equal(wrapsInWalker('perspective(500px) rotateY(20deg)'), false);
});

test('animatesTransform picks out exactly the animations that defeat the neutralise', () => {
  // A CSSTransition names its property directly.
  assert.equal(animatesTransform({ transitionProperty: 'transform' }), true);
  assert.equal(animatesTransform({ transitionProperty: 'opacity' }), false);
  // A CSSAnimation / script animation is read off its keyframes.
  assert.equal(animatesTransform({ effect: { getKeyframes: () => [
    { offset: 0, easing: 'linear', composite: 'auto', transform: 'rotate(0deg)' },
    { offset: 1, easing: 'linear', composite: 'auto', transform: 'rotate(360deg)' },
  ] } }), true);
  assert.equal(animatesTransform({ effect: { getKeyframes: () => [
    { offset: 0, easing: 'linear', composite: 'auto', opacity: '0' },
  ] } }), false);
  // ⚑ Every keyframe object carries `offset`, and CSS also has an `offset`
  // SHORTHAND (motion path). Reading the keyframe's own bookkeeping key as a CSS
  // property would make this true for every animation on the page, and the walk
  // would cancel motion it has no business touching.
  assert.equal(animatesTransform({ effect: { getKeyframes: () => [{ offset: 0, easing: 'ease' }] } }), false);
  // ::before/::after animate their own box, not the element's transform.
  assert.equal(animatesTransform({ effect: {
    pseudoElement: '::before', getKeyframes: () => [{ offset: 0, transform: 'scale(2)' }],
  } }), false);
  // An effect that will not describe itself is left running rather than cancelled.
  assert.equal(animatesTransform({ effect: { getKeyframes: () => { throw new Error('no'); } } }), false);
  assert.equal(animatesTransform({}), false);
  assert.equal(animatesTransform({ effect: null }), false);
  // The independent transform properties do NOT fold into computed `transform`, so
  // an animation on one of them cannot be what outranks the inline neutralise - 
  // stopping it would take motion from the page for nothing.
  assert.equal(animatesTransform({ transitionProperty: 'rotate' }), false);
  assert.equal(animatesTransform({ effect: { getKeyframes: () => [{ offset: 0, scale: '1.4' }] } }), false);
});
