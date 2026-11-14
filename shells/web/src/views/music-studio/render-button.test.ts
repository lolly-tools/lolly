// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's Render button (views/music-studio/render-button.ts): one button
 * whose choices are render and play, or a download as M4A or WAV (Andy, 2026-11-14). The
 * button itself never plays or downloads: it opens the choices, and under the choices a
 * line says what every download records. Every download carries the record: there is no
 * switch to leave the record out.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio/render-button.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderButtonHtml, renderChoices, downloadRecordLine } from './render-button.ts';
import { TUNE_DECLARATION } from '../../../../../engine/src/tune-provenance.ts';

const html = renderButtonHtml();

test('Render is one button with one word', () => {
  assert.equal((html.match(/<button/g) ?? []).length, 1, 'a single button, no pill of halves');
  assert.match(html, /data-render[ >]/);
  assert.match(html, />Render<\/button>$/);
  assert.doesNotMatch(html, /data-render-play|data-download/, 'nothing on the button plays or writes a file by itself');
});

test('its choices are render and play, then the two downloads, each with a line saying what it does', () => {
  const fresh = renderChoices(false);
  assert.deepEqual(fresh.map(c => c.id), ['play', 'm4a', 'wav']);
  assert.equal(fresh[0]!.title, 'Render and play');
  assert.deepEqual(fresh.slice(1).map(c => c.title), ['Download M4A', 'Download WAV']);
  for (const c of fresh) assert.ok(c.note.length > 0, `${c.id} says what it does`);
  // Once the track is made, the first choice plays the render at once.
  assert.equal(renderChoices(true)[0]!.title, 'Play');
});

test('what a download records is a statement under the choices, word for word, with no switch', () => {
  assert.equal(downloadRecordLine(), `Downloads will carry Content Credentials that record: ${TUNE_DECLARATION}.`);
  const src = readFileSync(new URL('./render-button.ts', import.meta.url), 'utf8');
  assert.match(src, /foot: downloadRecordLine/, 'the line is the menu\'s foot, in view at the moment of choosing');
  assert.doesNotMatch(src, /type="checkbox"|data-cred[ >"]/, 'no switch: every download carries the record (Andy, 2026-11-14)');
});
