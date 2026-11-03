// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDevice, explainProbe, inspectVideoFile } from './video-device-check.ts';
import type { ContainerProbe } from '../../../../engine/src/video-container-probe.ts';

const track = (over: Partial<ContainerProbe['video'][0]> = {}): ContainerProbe['video'][0] => ({
  family: 'prores', label: 'Apple ProRes 422 HQ', profile: '422 HQ', identifier: 'apch', webcodecs: 'apch',
  width: 1920, height: 1080, frameRate: 25, bitDepth: null, patentPool: true, ...over,
});
const probe = (over: Partial<ContainerProbe> = {}): ContainerProbe => ({
  container: 'mov', brand: 'qt', durationSeconds: 2, timecode: null, video: [track()], audio: [], ...over,
});

test('WebCodecs says yes: nothing to explain', async () => {
  const check = await checkDevice(probe(), { videoSupported: async () => true });
  assert.equal(check.video, true);
  assert.equal(explainProbe(probe(), check), null);
});

test('WebCodecs says no, the media element says probably: the device can play it', async () => {
  const check = await checkDevice(probe(), { videoSupported: async () => false, canPlayType: () => 'probably' });
  assert.equal(check.video, true);
});

test('neither can open ProRes: names the codec and the route, mentions the Mac', async () => {
  const p = probe();
  const check = await checkDevice(p, { videoSupported: async () => false, canPlayType: () => '' });
  const note = explainProbe(p, check) ?? '';
  assert.match(note, /Apple ProRes 422 HQ/);
  assert.match(note, /H\.264, HEVC or AV1/);
  assert.match(note, /desktop app on a Mac/);
  assert.match(note, /keeps the original/);
});

test('DNx does not point at a Mac', async () => {
  const p = probe({ video: [track({ family: 'dnx', label: 'Avid DNxHR HQ', identifier: 'AVdh', webcodecs: null })] });
  const note = explainProbe(p, await checkDevice(p, { canPlayType: () => '' })) ?? '';
  assert.match(note, /Avid DNxHR HQ/);
  assert.doesNotMatch(note, /Mac/);
});

test('an MXF is never playable here, whatever the codec', async () => {
  const p = probe({ container: 'mxf', video: [track({ family: 'dnx', label: 'Avid DNxHR HQ', webcodecs: null })] });
  const check = await checkDevice(p, { videoSupported: async () => true, canPlayType: () => 'probably' });
  assert.equal(check.video, false);
  assert.match(explainProbe(p, check) ?? '', /MXF file with Avid DNxHR HQ/);
});

test('a device that cannot be asked gives no verdict and no note', async () => {
  const p = probe();
  const check = await checkDevice(p, {});
  assert.equal(check.video, null);
  assert.equal(explainProbe(p, check), null);
});

test('audio the device cannot play is reported when the picture is fine', async () => {
  const p = probe({ video: [track({ family: 'h264', label: 'H.264 High', webcodecs: 'avc1.640028', identifier: 'avc1' })],
    audio: [{ codec: 'ac3', label: 'Dolby Digital (AC-3)', identifier: 'ac-3', webcodecs: 'ac-3', channels: 6, sampleRate: 48000, bitDepth: null, patentPool: true }] });
  const check = await checkDevice(p, { videoSupported: async () => true, audioSupported: async () => false, canPlayType: () => '' });
  assert.match(explainProbe(p, check) ?? '', /sound in this clip uses Dolby Digital \(AC-3\)/);
});

test('inspectVideoFile answers null for a file that is no video container', async () => {
  assert.equal(await inspectVideoFile(new Blob([new Uint8Array(64)])), null);
  assert.equal(await inspectVideoFile(new Blob(['not a movie at all, just text'])), null);
});

test('videoImportFacts falls back to the DOM readers for a file that is no video container', async () => {
  const { videoImportFacts } = await import('./video-device-check.ts');
  const facts = await videoImportFacts(new Blob(['plain text, not a movie']), {
    readVideoDimensions: async () => ({ width: 640, height: 360, duration: 2 }),
    probeMediaDurationMs: async () => undefined,
  });
  assert.deepEqual(facts, { videoProbe: undefined, width: 640, height: 360, durationMs: 2000 });
});
