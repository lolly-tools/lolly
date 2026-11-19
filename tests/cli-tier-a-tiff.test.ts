// SPDX-License-Identifier: MPL-2.0
// A TIFF from an SVG-native tool with no browser (plans/371, M1.3): the web shell's
// TIFF recipe over resvg pixels, written by the engine's own TIFF writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { eligibleForResvgTiff, rasterizeTierATiff } from '../packages/node-shell/src/raster.ts';

const run = promisify(execFile);
const entry = fileURLToPath(new URL('../shells/cli/bin/lolly.ts', import.meta.url));
// A web shell that is not there: a TIFF that reached the browser tier would fail.
const env = { ...process.env, LOLLY_PROFILE: 'lolly-demo', LOLLY_WEB_DIST: '/nonexistent/lolly-web-dist' };
delete (env as Record<string, string | undefined>).LOLLY_WEB_BASE;

/** The fields of a little-endian baseline TIFF's first directory this test reads. */
function readTiff(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(String.fromCharCode(bytes[0]!, bytes[1]!), 'II', 'little-endian TIFF');
  assert.equal(view.getUint16(2, true), 42);
  const ifd = view.getUint32(4, true);
  const tags = new Map<number, { type: number; count: number; value: number }>();
  for (let i = 0, n = view.getUint16(ifd, true); i < n; i++) {
    const at = ifd + 2 + i * 12;
    const type = view.getUint16(at + 2, true);
    tags.set(view.getUint16(at, true), {
      type, count: view.getUint32(at + 4, true),
      value: type === 3 ? view.getUint16(at + 8, true) : view.getUint32(at + 8, true),
    });
  }
  const rational = (tag: number): number => {
    const offset = tags.get(tag)!.value;
    return view.getUint32(offset, true) / view.getUint32(offset + 4, true);
  };
  const strip = tags.get(273)!.value;
  return {
    width: tags.get(256)!.value, height: tags.get(257)!.value,
    samples: tags.get(277)!.value, photometric: tags.get(262)!.value, compression: tags.get(259)!.value,
    dpi: rational(282),
    pixel: (x: number, y: number) => Array.from(bytes.subarray(strip + (y * tags.get(256)!.value + x) * 3, strip + (y * tags.get(256)!.value + x) * 3 + 3)),
  };
}

test('a plain tiff is the only request this path takes', () => {
  assert.equal(eligibleForResvgTiff('tiff', {}), true);
  assert.equal(eligibleForResvgTiff('TIFF', {}), true);
  assert.equal(eligibleForResvgTiff('cmyk-tiff', {}), false);
  assert.equal(eligibleForResvgTiff('png', {}), false);
  assert.equal(eligibleForResvgTiff('tiff', { durable: true }), false);
  assert.equal(eligibleForResvgTiff('tiff', { bleed: '3mm' }), false);
  assert.equal(eligibleForResvgTiff('tiff', { marks: 'crop' }), false);
  assert.equal(eligibleForResvgTiff('tiff', { hdr: { boost: 50 } }), false);
});

test('transparency is flattened onto white and opaque pixels keep their colour', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="2" viewBox="0 0 4 2">'
    + '<rect x="0" y="0" width="2" height="2" fill="#ff0000"/>'
    + '<rect x="2" y="0" width="1" height="2" fill="#0000ff" fill-opacity="0.5"/></svg>';
  const { bytes, imprinted } = await rasterizeTierATiff(svg, { width: 4, height: 2 }, {}, { software: 'Lolly', description: 'Flatten check' });
  assert.equal(imprinted, false, 'no Imprint was asked for');
  const tiff = readTiff(bytes);
  assert.deepEqual([tiff.width, tiff.height, tiff.samples, tiff.photometric, tiff.compression], [4, 2, 3, 2, 1]);
  assert.equal(tiff.dpi, 96, 'a pixel export states the CSS resolution');
  assert.deepEqual(tiff.pixel(0, 0), [255, 0, 0], 'opaque red');
  const half = tiff.pixel(2, 0);
  assert.ok(Math.abs(half[0]! - 128) <= 1 && Math.abs(half[1]! - 128) <= 1 && half[2] === 255, `half blue over white, got ${half}`);
  assert.deepEqual(tiff.pixel(3, 0), [255, 255, 255], 'nothing drawn is white');
  assert.ok(Buffer.from(bytes).includes('Flatten check'), 'the description is written');
});

test('a physical size carries its resolution', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><rect width="10" height="10" fill="#000"/></svg>';
  const { bytes } = await rasterizeTierATiff(svg, { width: 1, height: 1, unit: 'in', dpi: 150 }, {});
  const tiff = readTiff(bytes);
  assert.deepEqual([tiff.width, tiff.height, tiff.dpi], [150, 150, 150]);
});

test('qr-code writes a tiff with a valid credential and no web shell built', async () => {
  const { stdout } = await run(process.execPath, [entry, 'run', 'qr-code', '--url=https://example.com', '--export=tiff'], { env, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  const tiff = readTiff(new Uint8Array(stdout));
  assert.ok(tiff.width > 0 && tiff.width === tiff.height, 'a square code');
  assert.equal(tiff.samples, 3);
  // The credential the CLI stamps as its last byte operation is in the file.
  assert.ok(stdout.includes('c2pa'), 'a C2PA manifest is embedded');
});
