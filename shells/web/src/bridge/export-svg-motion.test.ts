// SPDX-License-Identifier: MPL-2.0
/**
 * The grammar a tool's `data-svg-motion` must match, and what it writes. The walk itself
 * needs a browser: tests/quote-card.browser.test.ts runs it.
 *
 * Run with: node --test shells/web/src/bridge/export-svg-motion.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectKeyframes, holdEntrancesFinished, MOTION_REST_CSS, parseSvgMotion, svgMotionStyle } from './export-svg-motion.ts';

test('a motion is one exact form, because the value lands in a style attribute', () => {
  assert.deepEqual(parseSvgMotion('qc-rise 400ms cubic-bezier(0.05,0.7,0.1,1) 80ms'), { name: 'qc-rise', durMs: 400, easing: 'cubic-bezier(0.05,0.7,0.1,1)', delayMs: 80 });
  assert.deepEqual(parseSvgMotion('qc-fade 700ms linear 0ms'), { name: 'qc-fade', durMs: 700, easing: 'linear', delayMs: 0 });
  for (const bad of [
    null, undefined, '', 'qc-rise', 'qc-rise 400ms', 'qc-rise 400 linear 0ms', 'qc-rise 400s linear 0ms',
    'qc-rise 400ms linear 0ms; background: url(x)', 'qc-rise 400ms url(x) 0ms', 'QC 400ms linear 0ms',
    'qc-rise 400ms linear 0ms both', 'qc-rise 400ms cubic-bezier(1,2,3) 0ms', '"x" 400ms linear 0ms',
  ]) assert.equal(parseSvgMotion(bad), null, String(bad));
});

test('a group fills both ways, keeps the type size its ems need and turns about itself', () => {
  const css = svgMotionStyle({ name: 'qc-rise', durMs: 400, easing: 'linear', delayMs: 80 }, 216.2412);
  assert.equal(css, 'font-size:216.24px;transform-box:fill-box;transform-origin:center;animation:qc-rise 400ms linear 80ms both');
  assert.doesNotMatch(svgMotionStyle({ name: 'a', durMs: 1, easing: 'linear', delayMs: 0 }, Number.NaN), /font-size/);
});

test('an image shows the finished picture, because nothing in it can seek', () => {
  assert.match(MOTION_REST_CSS, /@media \(scripting: none\)/);
  assert.match(MOTION_REST_CSS, /animation: none !important/);
});

test('only the keyframes the file uses travel with it, first definition wins', () => {
  const KEYFRAMES_RULE = 7;
  (globalThis as { CSSRule?: unknown }).CSSRule ??= { KEYFRAMES_RULE };
  const rule = (name: string, cssText: string) => ({ type: KEYFRAMES_RULE, name, cssText });
  const sheets = [
    { get cssRules(): never { throw new Error('cross origin'); } },
    { cssRules: [{ type: 1, cssText: '.x{}' }, rule('a', '@keyframes a{}'), rule('other', '@keyframes other{}')] },
    { cssRules: [rule('a', '@keyframes a{late}'), rule('b', '@keyframes b{}')] },
  ] as unknown as CSSStyleSheet[];
  assert.equal(collectKeyframes(sheets, ['b', 'a', 'missing']), '@keyframes b{}\n@keyframes a{}');
});

function piece(times: Array<[number, string]>, clip = '3000') {
  const animations = times.map(([currentTime, playState]) => ({
    currentTime, playState,
    pause() { this.playState = 'paused'; },
    play() { this.playState = 'running'; },
  }));
  const svg = { getAttribute: () => clip, getAnimations: () => animations };
  return { animations, node: { querySelectorAll: () => [svg] } as unknown as Element };
}

test('a still draws an entrance finished unless the person chose the moment', () => {
  const copy = piece([[12, 'running'], [12, 'running']]);
  const undoCopy = holdEntrancesFinished(copy.node);
  assert.deepEqual(copy.animations.map(a => [a.currentTime, a.playState]), [[3000, 'paused'], [3000, 'paused']], 'a fresh copy nothing is holding');
  undoCopy();
  assert.deepEqual(copy.animations.map(a => [a.currentTime, a.playState]), [[12, 'running'], [12, 'running']], 'and back');

  const parked = piece([[0, 'paused']]);
  holdEntrancesFinished(parked.node);
  assert.equal(parked.animations[0]!.currentTime, 3000, 'a timeline parked at the first instant');

  const chosen = piece([[1500, 'paused']]);
  holdEntrancesFinished(chosen.node);
  assert.equal(chosen.animations[0]!.currentTime, 1500, 'a playhead the person moved keeps its frame');

  const unsaid = piece([[0, 'paused']], '');
  holdEntrancesFinished(unsaid.node);
  assert.equal(unsaid.animations[0]!.currentTime, 0, 'a picture that does not say it plays once is left alone');
});
