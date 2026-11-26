// SPDX-License-Identifier: MPL-2.0
/** The level and coaching HUD the shell draws over a capture stage (lib/audio-coaching.ts). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { AudioLevel } from '@lolly-tools/core/host-v1';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://lolly.tools/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
});
const { mountCoachHud } = await import('./audio-coaching.ts');

const quiet: AudioLevel = { rms: 0.03, peak: 0.06, dbfs: -30, clipping: false, t: 0 };

test('the target level decides what counts as too quiet', () => {
  const hud = mountCoachHud(document.body);
  const row = document.querySelector<HTMLElement>('.crc-audio')!;
  hud.updateAudio(quiet, { target: 'normal', phase: 'record' });
  assert.equal(row.dataset.tone, 'low');
  assert.notEqual(row.querySelector('.crc-warn')!.textContent, '');
  hud.updateAudio(quiet, { target: 'soft', phase: 'record' });
  assert.equal(row.dataset.tone, 'ok', 'a close, soft voice is in range at this level');
  assert.equal(row.querySelector('.crc-warn')!.textContent, '');
  hud.destroy();
});

test('with coaching tips off the level bar stays and the warning goes', () => {
  const hud = mountCoachHud(document.body);
  const row = document.querySelector<HTMLElement>('.crc-audio')!;
  hud.updateAudio(quiet, { target: 'normal', phase: 'record', tips: false });
  assert.equal(row.dataset.tone, 'low', 'the bar still shows the level is low');
  assert.equal(row.querySelector<HTMLElement>('.crc-fill')!.style.width, '6%');
  assert.equal(row.querySelector('.crc-db')!.textContent, '-30 dB');
  assert.equal(row.querySelector('.crc-warn')!.textContent, '');
  assert.equal(row.classList.contains('has-warn'), false);
  hud.destroy();
});
