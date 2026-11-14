// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's render pill (views/music-studio/render-pill.ts): it reads as
 * "Render (play / download)", and the pill's Download opens the download's panel rather
 * than downloading, so the line saying what a download records is in view beside the
 * button that writes the file. Every download carries the record: there is no switch to
 * leave the record out.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio/render-pill.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPillHtml } from './render-pill.ts';
import { TUNE_DECLARATION } from '../../../../../engine/src/tune-provenance.ts';
import { escape as escapeHtml } from '../../utils.ts';

const html = renderPillHtml();
const pill = html.slice(0, html.indexOf('data-render-options'));
const panel = html.slice(html.indexOf('data-render-options'));

test('the pill reads Render, then Play, then Download', () => {
  assert.match(pill, /role="group" aria-label="Render"/);
  const play = pill.indexOf('data-render-play');
  const download = pill.indexOf('data-download-open');
  assert.ok(play > 0 && download > play, 'Play before Download, both inside the pill');
  assert.match(pill, /aria-label="Render and play"/);
});

test('the pill\'s Download opens the panel and never downloads on its own', () => {
  assert.match(pill, /data-download-open aria-haspopup="dialog" aria-expanded="false"/);
  assert.doesNotMatch(pill, /data-download[ >]/, 'the pill has no button that writes the file');
});

test('what a download records is in the panel with the button that downloads, as a statement', () => {
  assert.doesNotMatch(panel, /type="checkbox"|data-cred[ >]/, 'no switch: every download carries the record (Andy, 2026-11-14)');
  assert.match(panel, /data-cred-note/);
  assert.ok(panel.includes(`Downloads will carry Content Credentials that record: ${escapeHtml(TUNE_DECLARATION)}.`), 'the declaration, word for word');
  assert.ok(panel.indexOf('data-cred-note') < panel.indexOf('data-download>'), 'the note comes before the button');
  assert.match(panel, /data-format="m4a"[^>]*aria-pressed="true"/, 'M4A chosen until the person picks WAV');
});
