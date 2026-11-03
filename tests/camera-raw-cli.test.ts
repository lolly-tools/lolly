// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { developRawPhoto, fitLongEdge, CAMERA_RAW_MIME } from '../shells/cli/src/camera-raw.ts';
import { imageMime } from '../shells/cli/src/block-files.ts';
import { buildDng } from './camera-raw-fixtures.ts';

const PNG = [0x89, 0x50, 0x4e, 0x47];
const grey = () => [0.3, 0.3, 0.3] as [number, number, number];

test('a raw photo is recognised by name and header and developed to a PNG for the tool', async () => {
  const dng = buildDng({ width: 32, height: 24, scene: grey });
  assert.equal(imageMime('holiday.dng', dng), CAMERA_RAW_MIME);
  assert.equal(imageMime('holiday.tif', dng), 'image/tiff', 'a TIFF without a raw extension stays a TIFF');
  const out = await developRawPhoto('holiday.dng', dng);
  assert.ok(out);
  assert.equal(out.name, 'holiday.png'); assert.equal(out.mime, 'image/png');
  assert.deepEqual([...out.bytes.subarray(0, 4)], PNG);
  const view = new DataView(out.bytes.buffer, out.bytes.byteOffset);
  assert.equal(view.getUint32(16), 32); assert.equal(view.getUint32(20), 24);
});

test('anything that is not raw is left for the ordinary handling', async () => {
  assert.equal(await developRawPhoto('photo.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), null);
  assert.equal(await developRawPhoto('notes.dng', new TextEncoder().encode('this is not a raw file at all')), null);
  // A raw name over a TIFF header that is not a raw file: the decoder says not-raw and the caller moves on.
  const plain = buildDng({ width: 8, height: 8, scene: grey, dng: false, make: 'Nobody' });
  assert.equal(await developRawPhoto('scan.dng', plain.subarray(0, 40)), null);
});

test('a damaged raw photo fails with a message that names the file and a way forward', async () => {
  const dng = buildDng({ width: 64, height: 64, scene: grey, declare: { width: 30000, height: 30000 }, noData: true });
  await assert.rejects(developRawPhoto('huge.dng', dng), (e: unknown) => e instanceof Error && /^huge\.dng: /.test(e.message) && /DNG|JPEG/.test(e.message));
});

test('a large picture is box-reduced to the library edge', () => {
  const w = 8000, h = 2000, rgba = new Uint8ClampedArray(w * h * 4).fill(200);
  const out = fitLongEdge(rgba, w, h);
  assert.equal(out.width, 3840); assert.equal(out.height, 960);
  assert.equal(out.rgba[0], 200); assert.equal(out.rgba[3], 255);
  assert.equal(fitLongEdge(rgba, w, h, 8000).rgba, rgba, 'a picture that fits is returned as is');
});
