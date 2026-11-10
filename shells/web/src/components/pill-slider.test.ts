// SPDX-License-Identifier: MPL-2.0
/**
 * The pill slider (components/pill-slider.ts): the fill matches the value, the name is
 * escaped and becomes the input's accessible name, the value is written on both text
 * layers, and the caller's attributes land on the input that takes the events.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/components/pill-slider.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pillPercent, pillSliderHtml } from './pill-slider.ts';

test('the fill is the value\'s share of the range, held inside the pill', () => {
  assert.equal(pillPercent(1, 0, 2), 50);
  assert.equal(pillPercent(0.5, 0.5, 1.8), 0);
  assert.equal(pillPercent(9, 0, 2), 100, 'a value past the end fills the pill');
  assert.equal(pillPercent(-1, 0, 2), 0);
  assert.equal(pillPercent(3, 3, 3), 0, 'an empty range does not divide by zero');
});

test('the markup: one input that takes the events, named by the label, with the value on both text layers', () => {
  const html = pillSliderHtml({ label: 'Room & <b>hall</b>', min: 0, max: 2, step: 0.05, value: 1.5, attrs: 'data-slider="reverb"' });
  assert.equal((html.match(/<input /g) ?? []).length, 1);
  assert.match(html, /<input type="range" class="pill-slider-input" min="0" max="2" step="0.05" value="1.5" aria-label="Room &amp; &lt;b&gt;hall&lt;\/b&gt;" data-slider="reverb">/);
  assert.ok(!html.includes('<b>'), 'the label is escaped');
  assert.equal((html.match(/data-pill-value>1\.50</g) ?? []).length, 2, 'the value is written on the plain and the over-the-fill text');
  assert.match(html, /style="--pill-pct: 75\.00%"/);
  assert.equal((html.match(/aria-hidden="true"/g) ?? []).length, 3, 'the drawn fill and text are hidden from assistive technology');
});

test('a format writes the value as the caller wants', () => {
  const html = pillSliderHtml({ label: 'Drive', min: 0, max: 4, step: 0.1, value: 2, format: v => `${Math.round(v * 25)}%` });
  assert.equal((html.match(/data-pill-value>50%</g) ?? []).length, 2);
});
