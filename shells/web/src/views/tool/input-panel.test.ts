// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGestureState } from './input-panel.ts';

test('a fresh gesture state is idle', () => {
  const g = createGestureState();
  assert.equal(g.sliderDragging, false);
  assert.equal(g.blockDrag, null);
});

test('two panel instances have independent slider-drag flags', () => {
  const sidebar = createGestureState();
  const embed = createGestureState();

  // Start a slider drag in the sidebar panel.
  sidebar.sliderDragging = true;

  // The embed panel must be unaffected (finding 6: no shared module state).
  assert.equal(sidebar.sliderDragging, true);
  assert.equal(embed.sliderDragging, false);
});

test('two panel instances have independent block-drag gestures', () => {
  const sidebar = createGestureState();
  const embed = createGestureState();

  sidebar.blockDrag = { inputId: 'blocks', from: 2, intent: 'before', over: 1 };

  assert.deepEqual(sidebar.blockDrag, { inputId: 'blocks', from: 2, intent: 'before', over: 1 });
  assert.equal(embed.blockDrag, null);

  // Ending the sidebar gesture leaves the embed panel's (still null) state alone.
  sidebar.blockDrag = null;
  assert.equal(embed.blockDrag, null);
});
