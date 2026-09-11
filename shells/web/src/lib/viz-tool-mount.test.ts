// SPDX-License-Identifier: MPL-2.0
/**
 * The payload half of the MilkDrop tool enhancer. Everything else in that module needs
 * WebGL2 and a real compositor (it is verified by rendering and reading the pixels back),
 * but the parse is where a malformed tool payload turns into a visualizer that sits
 * perfectly still - indistinguishable from a broken one - so it is pinned here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeWave, parseTrack, clipSeconds } from './viz-tool-mount.ts';

const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

test('decodeWave round-trips bytes, padding and all', () => {
  for (const n of [0, 1, 2, 3, 4, 255, 1024]) {
    const src = new Uint8Array(n).map((_, i) => (i * 37) & 255);
    assert.deepEqual([...decodeWave(b64(src))], [...src], `length ${n}`);
  }
});

test('decodeWave ignores whitespace an HTML attribute may have wrapped in', () => {
  const src = new Uint8Array([1, 2, 3, 4, 5, 6]);
  const wrapped = b64(src).replace(/(.)/g, '$1\n  ');
  assert.deepEqual([...decodeWave(wrapped)], [...src]);
});

test('parseTrack accepts a complete payload', () => {
  const track = parseTrack(
    JSON.stringify({ count: 3, samples: 4, fps: 25, poster: 2 }),
    b64(new Uint8Array(12).fill(128)),
  );
  assert.ok(track);
  assert.equal(track.count, 3);
  assert.equal(track.samples, 4);
  assert.equal(track.fps, 25);
  assert.equal(track.poster, 2);
  assert.equal(track.bytes.length, 12);
});

test('parseTrack rejects a payload shorter than its own header', () => {
  // Mounting anyway feeds butterchurn a window that runs off the end of the buffer,
  // which reads as silence rather than as an error.
  assert.equal(parseTrack(JSON.stringify({ count: 3, samples: 4 }), b64(new Uint8Array(11))), null);
});

test('parseTrack rejects meta that is missing, empty or not JSON', () => {
  const wave = b64(new Uint8Array(12));
  assert.equal(parseTrack('', wave), null);
  assert.equal(parseTrack('{}', wave), null);
  assert.equal(parseTrack('not json', wave), null);
  assert.equal(parseTrack(JSON.stringify({ count: 3, samples: 0 }), wave), null);
});

test('parseTrack clamps the poster into the track and defaults the fps', () => {
  const wave = b64(new Uint8Array(12));
  assert.equal(parseTrack(JSON.stringify({ count: 3, samples: 4, poster: 99 }), wave)?.poster, 2);
  assert.equal(parseTrack(JSON.stringify({ count: 3, samples: 4, poster: -5 }), wave)?.poster, 0);
  assert.equal(parseTrack(JSON.stringify({ count: 3, samples: 4, fps: 0 }), wave)?.fps, 30);
});

test('clipSeconds maps normalised clip time over the EXPORTED clip, not the whole track', () => {
  // A 2 s export of an 85 s bed: t = 1 is 2 s in, so the export runs at preview speed.
  assert.equal(clipSeconds(1, 2), 2);
  assert.equal(clipSeconds(0.5, 6), 3);
  assert.equal(clipSeconds(0, 6), 0);
  // A negative t (never sent, but cheap to refuse) cannot reach before the in-point.
  assert.equal(clipSeconds(-0.2, 6), 0);
});
