// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { evaluateKf, parseKf } from '../../../../engine/src/keyframes.ts';
import { sceneAudioTiming } from './scene-audio.ts';
import { parseSequenceStage, volumeKeysOf } from './sequence-plan.ts';
import { clipGainValueAt } from './audio-envelope.ts';
import { createSequenceTime } from './sequence-dom.ts';
import { boxShadowPad } from './sequence-paint-pad.ts';

test('scene sound intersects the page without restarting its source or volume automation', () => {
  const clip = { startMs: 1000, durMs: 5000, clipInMs: 500, speed: 2, kf: parseKf('t0_v0*t2000_v1') };
  const clipped = sceneAudioTiming(clip, 2000, 4000);
  assert.equal(clipped.startMs, 2000); assert.equal(clipped.durMs, 2000);
  assert.equal(clipped.clipInMs, 2500);
  assert.deepEqual(clipped.kf.map(key => [key.t, key.v.v]), [[0, .5], [1000, 1]]);
  assert.equal(evaluateKf(clipped.kf, 0).v, .5);
  for (const easing of ['ei', 'eh', 'e0.2,0,0.8,1']) {
    const kf = parseKf(`t0_${easing}_v0*t2000_v1*t4000_v0.3`);
    const trimmed = sceneAudioTiming({ ...clip, kf }, 2000, 6000);
    for (const time of [0, 200, 800, 1000, 1700, 2500]) {
      const original = clipGainValueAt({ spanSec: 5, volumeKeys: volumeKeysOf(kf)!, tSec: (time + 1000) / 1000 });
      const result = clipGainValueAt({ spanSec: 4, volumeKeys: volumeKeysOf(trimmed.kf)!, tSec: time / 1000 });
      assert.ok(Math.abs(result - original) < 1e-12);
    }
  }
  assert.equal(sceneAudioTiming(clip, 7000, 8000).durMs, 0);
});
test('scene audio is bounded identically in preview and export; unframed sound spans the film', () => {
  const doc = new JSDOM(`<div data-sequence data-seq-ms="6000" style="width:1400px;height:360px">
    <div data-pdf-page data-t-start="2000" data-t-dur="2000" style="width:640px;height:360px">
      <div class="lolly-box" data-t-start="1000" data-t-dur="5000" data-clip-in="500" data-t-speed="2" data-t-kf="t0_v0*t2000_v1"><div data-audio-src="voice.wav"></div></div>
    </div><div class="lolly-box" data-t-start="0" data-t-dur="6000"><div data-audio-src="bed.wav"></div></div></div>`).window.document;
  const root = doc.querySelector<HTMLElement>('[data-sequence]')!;
  const plan = parseSequenceStage(root)!;
  const [voice, bed] = plan.layers.filter(layer => layer.kind === 'audio');
  assert.equal(voice!.startMs, 2000); assert.equal(voice!.durMs, 2000); assert.equal(voice!.clipInMs, 2500);
  assert.equal(bed!.startMs, 0); assert.equal(bed!.durMs, 6000);
  let heard: any;
  const clock = createSequenceTime(root, { media(el, timing, sourceMs, active) { if (el.querySelector('[data-audio-src="voice.wav"]')) heard = { timing, sourceMs, active }; } });
  clock.apply(2500);
  assert.equal(heard.active, true); assert.equal(heard.timing.start, voice!.startMs);
  assert.equal(heard.timing.dur, voice!.durMs); assert.equal(heard.timing.clipIn, voice!.clipInMs);
  assert.deepEqual(heard.timing.kf, voice!.kf);
  clock.apply(4100); assert.equal(heard.active, false);
  clock.restore(); assert.equal(root.querySelector('.lolly-box')!.getAttribute('data-t-start'), '1000');
});
test('staged untimed decks offset their local narration onto each scene', () => {
  const doc = new JSDOM('<div data-sequence data-seq-ms="6000" data-deck-staged="1"><div data-pdf-page data-t-start="3000" data-t-dur="3000"><div class="lolly-box" data-t-start="500" data-t-dur="5000"><div data-audio-src="voice.wav"></div></div></div></div>').window.document;
  const sound = parseSequenceStage(doc.querySelector('div')!)!.layers.find(layer => layer.kind === 'audio')!;
  assert.equal(sound.startMs, 3500); assert.equal(sound.durMs, 2500);
});
test('movie plates include authored box shadows outside the layer bounds', () => {
  assert.equal(boxShadowPad('0px 22px 55px 0px #36304a1c'), 105);
  assert.equal(boxShadowPad('inset 0 0 20px #000'), 0);
  assert.equal(boxShadowPad('none'), 0);
});
