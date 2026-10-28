// SPDX-License-Identifier: MPL-2.0
/** The web lane's export check reads a real PNG header and refuses anything else. */
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import test from 'node:test';
import { pngSize } from '../scripts/web-lane-check.ts';

function png(width: number, height: number): Uint8Array {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    return Buffer.concat([length, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((width * 3 + 1) * height))), chunk('IEND', Buffer.alloc(0))]));
}

test('a PNG reports its size, and other bytes or an empty image do not', () => {
  assert.deepEqual(pngSize(png(600, 400)), { width: 600, height: 400 });
  assert.equal(pngSize(png(0, 400)), null);
  assert.equal(pngSize(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'.padEnd(64))), null);
  const wrongChunk = png(10, 10); wrongChunk.set(new TextEncoder().encode('IDAT'), 12);
  assert.equal(pngSize(wrongChunk), null);
  assert.equal(pngSize(new Uint8Array(8)), null);
});
