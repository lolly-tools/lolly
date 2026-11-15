// SPDX-License-Identifier: MPL-2.0
/**
 * The phone dock's seek bar (views/music-studio/seek-bar.ts): a tap goes to the start of
 * the nearest bar, Page Up and Page Down step a section (back from part way into one goes
 * to its own start first), and a screen reader hears the bar, the section and the time.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio/seek-bar.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { barAtFraction, sectionStep, seekBarHtml, seekValueText } from './seek-bar.ts';

test('a tap lands on the start of the bar nearest the finger', () => {
  const starts = [0, 2, 4, 6, 8];
  assert.equal(barAtFraction(starts, 10, 0), 0);
  assert.equal(barAtFraction(starts, 10, 0.29), 1, '2.9 s is nearest bar 2 at 2 s');
  assert.equal(barAtFraction(starts, 10, 0.31), 2, '3.1 s is nearest bar 3 at 4 s');
  assert.equal(barAtFraction(starts, 10, 1), 4, 'the end is the last bar');
  assert.equal(barAtFraction(starts, 10, 1.4), 4, 'past the end stays on the last bar');
  assert.equal(barAtFraction(starts, 10, -1), 0);
});

test('Page Up and Page Down step a section, and back from part way in goes to the section\'s start', () => {
  const sections = ['intro', 'intro', 'verse', 'verse', 'verse', 'drop', 'drop', 'rest'];
  assert.equal(sectionStep(sections, 0, 1), 2);
  assert.equal(sectionStep(sections, 3, 1), 5);
  assert.equal(sectionStep(sections, 3, -1), 2, 'part way into the verse: back to its start');
  assert.equal(sectionStep(sections, 2, -1), 0, 'at the verse\'s start: back to the intro');
  assert.equal(sectionStep(sections, 7, 1), 7, 'nothing after the last section');
  assert.equal(sectionStep(sections, 0, -1), 0);
});

test('the bar is a slider that says the bar, the section and the time', () => {
  const html = seekBarHtml();
  assert.match(html, /role="slider" tabindex="0" aria-label="Position in the track"/);
  assert.equal(seekValueText(21, 64, 'Chorus', 42.4, 114), 'Bar 22 of 64, Chorus, 0:42 of 1:54');
});

test('the sections ahead of the playhead are stronger on a dark dock, and still fainter than the part played', () => {
  const css = readFileSync(new URL('../../styles/parts/music-studio.css', import.meta.url), 'utf8');
  const light = Number(/\.ms-seek \{ --ms-seek-ahead: ([.\d]+);/.exec(css)?.[1]);
  const dark = Number(/:root\[data-theme="dark"\] \.ms-seek \{ --ms-seek-ahead: ([.\d]+); \}/.exec(css)?.[1]);
  assert.equal(light, 0.35, 'light stays as it was');
  assert.ok(dark > light && dark < 1, `dark ahead ${dark}: stronger than light, fainter than played`);
  assert.match(css, /\.ms-seek-map \{[^}]*opacity: var\(--ms-seek-ahead\);/);
  assert.match(css, /\.ms-seek-played \{ opacity: 1; \}/);
});
