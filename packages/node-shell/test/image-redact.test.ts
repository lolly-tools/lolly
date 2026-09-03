// SPDX-License-Identifier: MPL-2.0
/**
 * Image redaction in Node (plan 183 WS4).
 *
 * Run directly:  node --test packages/node-shell/test/image-redact.test.ts
 *
 * The promise this path makes is narrow and total: the pixels under a bar are
 * gone, and the container that comes out carries NOTHING but pixels. So the
 * assertions read the OUTPUT BYTES back - decode them and sample inside the bar,
 * scan the JPEG marker segments for a metadata block that survived - rather than
 * trusting the draw calls that produced them.
 *
 * Fixtures are generated here, not checked in: a tiny two-colour image built on
 * the same canvas the transform uses, and a JPEG with a REAL APP1 Exif segment
 * spliced in by hand (so the metadata assertion does not depend on whichever
 * encoder happened to write the fixture).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { redactImage, grayscale601InPlace } from '../src/image-redact.ts';
import { createNodeRasterAPI, decodeToCanvas, nodeCanvas, sniffImageMime } from '../src/canvas.ts';

const W = 200, H = 120;
/** Left half red, right half green - so a bar can be checked against a colour it
 *  covered, and an untouched pixel against a colour it did not. */
async function fixture(mime: 'image/png' | 'image/jpeg'): Promise<Uint8Array> {
  const mod = await nodeCanvas();
  assert.ok(mod, '@napi-rs/canvas is a declared dependency of this package');
  const canvas = mod.createCanvas(W, H);
  const cx = canvas.getContext('2d');
  cx.fillStyle = '#dc1e1e';
  cx.fillRect(0, 0, W / 2, H);
  cx.fillStyle = '#1eb43c';
  cx.fillRect(W / 2, 0, W / 2, H);
  const buf = canvas.toBuffer(mime, mime === 'image/jpeg' ? 92 : undefined);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/** Splice a real APP1 "Exif\0\0" segment in after SOI, the way a camera does. */
function withExif(jpeg: Uint8Array, payload: string): Uint8Array {
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from(payload, 'latin1')]);
  const len = body.length + 2;
  const seg = Buffer.concat([Buffer.from([0xff, 0xe1, (len >> 8) & 0xff, len & 0xff]), body]);
  return new Uint8Array(Buffer.concat([Buffer.from(jpeg.subarray(0, 2)), seg, Buffer.from(jpeg.subarray(2))]));
}

/** Every APPn / COM marker before the scan - the metadata surface of a JPEG. */
function jpegMetadataMarkers(bytes: Uint8Array): number[] {
  const out: number[] = [];
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1]!;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
    if (marker === 0xda) break;                                   // start of scan
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe) out.push(marker);
    i += 2 + len;
  }
  return out;
}

async function pixels(bytes: Uint8Array): Promise<{ at(x: number, y: number): number[]; width: number; height: number }> {
  const canvas = await decodeToCanvas(bytes);
  assert.ok(canvas, 'the output should decode');
  const img = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  return {
    width: canvas.width,
    height: canvas.height,
    at: (x, y) => {
      const o = (y * canvas.width + x) * 4;
      return [img.data[o]!, img.data[o + 1]!, img.data[o + 2]!, img.data[o + 3]!];
    },
  };
}

const NEAR_BLACK = [0x14, 0x16, 0x1a];
const close = (got: number[], want: number[], tol: number): boolean =>
  Math.max(Math.abs(got[0]! - want[0]!), Math.abs(got[1]! - want[1]!), Math.abs(got[2]! - want[2]!)) <= tol;

test('redactImage: the bar is solid opaque ink and the rest of the picture is untouched', async () => {
  const src = await fixture('image/png');
  const res = await redactImage(src, { bars: [{ x: 20, y: 20, w: 60, h: 40 }] });

  assert.equal(res.mime, 'image/png');
  assert.equal(res.width, W);
  assert.equal(res.height, H);
  assert.equal(res.unplaced, 0);

  const px = await pixels(res.bytes);
  for (const [x, y] of [[25, 25], [50, 40], [75, 55]] as const) {
    const c = px.at(x, y);
    assert.equal(c[3], 255, `bar pixel ${x},${y} must be fully opaque`);
    assert.ok(close(c, NEAR_BLACK, 4), `bar pixel ${x},${y} is ${c.slice(0, 3)}, not the neutral ink`);
  }
  assert.ok(close(px.at(160, 90), [0x1e, 0xb4, 0x3c], 4), 'the green half outside the bar is unchanged');
  assert.ok(close(px.at(10, 100), [0xdc, 0x1e, 0x1e], 4), 'the red half outside the bar is unchanged');
});

test('redactImage: the output carries no EXIF, and the input did', async () => {
  const src = withExif(await fixture('image/jpeg'), 'Copyright=Secret Studio;Software=LeakyCam');
  assert.ok(jpegMetadataMarkers(src).includes(0xe1), 'the fixture must actually carry an APP1 segment');
  assert.ok(Buffer.from(src).includes('Secret Studio'));

  const res = await redactImage(src, { bars: [{ x: 20, y: 20, w: 60, h: 40 }] });

  assert.equal(res.mime, 'image/jpeg', 'a JPEG comes back a JPEG - the same-family re-encode IS the metadata kill');
  assert.equal(jpegMetadataMarkers(res.bytes).includes(0xe1), false, 'no APP1 survives');
  assert.equal(jpegMetadataMarkers(res.bytes).includes(0xfe), false, 'no JPEG comment survives');
  assert.equal(Buffer.from(res.bytes).includes('Secret Studio'), false);
  assert.equal(Buffer.from(res.bytes).includes('LeakyCam'), false);
  assert.equal(Buffer.from(res.bytes).includes(Buffer.from('Exif')), false);

  // …and the bar is still a bar. Lossy, so the tolerance is the codec's, not ours.
  const px = await pixels(res.bytes);
  assert.ok(close(px.at(50, 40), NEAR_BLACK, 20), `bar pixel is ${px.at(50, 40).slice(0, 3)}`);
});

test('redactImage: a bar entirely off the image is REPORTED, never dropped quietly', async () => {
  const src = await fixture('image/png');
  const res = await redactImage(src, {
    bars: [{ x: 20, y: 20, w: 60, h: 40 }, { x: 5000, y: 5000, w: 10, h: 10 }, { x: 0, y: 0, w: 0, h: 0 }],
  });
  // The caller's gate reads this: a region it asked to cover would otherwise ship
  // fully visible with nothing said about it.
  assert.equal(res.unplaced, 2);
  const px = await pixels(res.bytes);
  assert.ok(close(px.at(50, 40), NEAR_BLACK, 4), 'the placeable bar still burned');
});

test('redactImage: the scanned-page mode drains the SOURCE colour and keeps the mark\'s own', async () => {
  const src = await fixture('image/png');
  const res = await redactImage(src, {
    bars: [{ x: 20, y: 20, w: 60, h: 40 }], grayscale: true, color: '#0000ff',
  });
  const px = await pixels(res.bytes);
  const [r, g, b] = px.at(160, 90);
  assert.equal(r, g, 'the green half is grey now');
  assert.equal(g, b);
  const bar = px.at(50, 40);
  assert.ok(bar[2]! > 200 && bar[0]! < 60, `the bar keeps its own blue (got ${bar.slice(0, 3)})`);
});

test('redactImage: a translucent fill is refused back to the neutral ink, never painted', async () => {
  const src = await fixture('image/png');
  const res = await redactImage(src, { bars: [{ x: 20, y: 20, w: 60, h: 40 }], color: 'rgba(0,0,255,0.5)' });
  const px = await pixels(res.bytes);
  assert.ok(close(px.at(50, 40), NEAR_BLACK, 4), 'colour is security-neutral; alpha is not');
});

test('redactImage: format can be pinned, and a rounded mark still covers the whole rect', async () => {
  const src = await fixture('image/png');
  const res = await redactImage(src, {
    bars: [{ x: 20, y: 20, w: 60, h: 40 }], radius: 8, format: 'webp',
  });
  assert.equal(res.mime, 'image/webp');
  assert.equal(sniffImageMime(res.bytes), 'image/webp');
  const px = await pixels(res.bytes);
  // The painted box is INFLATED by the radius before its corners are rounded, so
  // every corner of the requested rect is still inside the opaque region.
  for (const [x, y] of [[20, 20], [79, 20], [20, 59], [79, 59]] as const) {
    assert.ok(close(px.at(x, y), NEAR_BLACK, 6), `corner ${x},${y} is ${px.at(x, y).slice(0, 3)}, not covered`);
  }
});

test('redactImage: a stamp is painted on top of the finished bar, not instead of it', async () => {
  const src = await fixture('image/png');
  const plain = await redactImage(src, { bars: [{ x: 10, y: 10, w: 160, h: 60 }] });
  const stamped = await redactImage(src, {
    bars: [{ x: 10, y: 10, w: 160, h: 60 }], label: 'REDACTED', labelColor: '#ffffff', labelMaxSize: 24,
  });
  const a = await pixels(plain.bytes), b = await pixels(stamped.bytes);
  // The bar's edge is solid ink in BOTH - the stamp adds paint, it never replaces
  // the mark. Compared across the whole bar rather than at one pixel, which can
  // legitimately fall in the gap between two letters.
  assert.ok(close(a.at(15, 15), NEAR_BLACK, 4));
  assert.ok(close(b.at(15, 15), NEAR_BLACK, 4));
  let lit = 0;
  for (let y = 12; y < 68; y++) {
    for (let x = 12; x < 168; x++) {
      if (!close(b.at(x, y), a.at(x, y), 8)) lit++;
    }
  }
  assert.ok(lit > 100, `the stamp should paint over the bar (only ${lit} pixels differ)`);
});

test('redactImage refuses bytes that are not an image', async () => {
  await assert.rejects(
    () => redactImage(new TextEncoder().encode('not a picture'), { bars: [] }),
    /could not be decoded as an image/i,
  );
});

test('grayscale601InPlace uses the redact tool\'s own weights and forces alpha opaque', () => {
  const px = new Uint8ClampedArray([255, 0, 0, 0, 0, 255, 0, 128]);
  grayscale601InPlace(px);
  assert.deepEqual([...px.slice(0, 4)], [76, 76, 76, 255]);
  assert.deepEqual([...px.slice(4, 8)], [150, 150, 150, 255]);
});

test('the canvas capability is absent, not throwing, when the package is not installed', async () => {
  const src = await fixture('image/png');
  const mod = Module as unknown as { _resolveFilename: (req: string, ...rest: unknown[]) => string };
  const real = mod._resolveFilename;
  mod._resolveFilename = function patched(req: string, ...rest: unknown[]): string {
    if (req === '@napi-rs/canvas') {
      throw Object.assign(new Error("Cannot find module '@napi-rs/canvas'"), { code: 'MODULE_NOT_FOUND' });
    }
    return real.call(this, req, ...rest);
  };
  try {
    // host.raster is simply not offered - the contract's own "this shell cannot".
    assert.equal(createNodeRasterAPI(), null);
    await assert.rejects(() => redactImage(src, { bars: [] }), /needs a canvas/i);
  } finally {
    mod._resolveFilename = real;
  }
  assert.notEqual(createNodeRasterAPI(), null);
});

test('host.raster reports the truth about this realm and round-trips pixels', async () => {
  const api = createNodeRasterAPI();
  assert.ok(api);
  assert.equal(api.canRaster(), true);
  const src = await fixture('image/png');
  const info = await api.measure(src);
  assert.equal(info.width, W);
  assert.equal(info.height, H);
  assert.equal(info.mime, 'image/png');
  const bmp = await api.decode(src);
  const out = await api.encode(bmp, { format: 'png' });
  assert.equal(out.mime, 'image/png');
  assert.equal(out.width, W);
  assert.equal(sniffImageMime(out.bytes), 'image/png');
});
