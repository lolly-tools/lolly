// SPDX-License-Identifier: MPL-2.0
/**
 * Generated share cards are byte-stable (scripts/lib/stamp-media.ts stampBitmapStable).
 *
 * The Imprint and the PNG encode are a pure function of the rendered pixels; the C2PA
 * credential is not (a new signing time, key and signature on every stamp). The OG
 * generators (scripts/build-tool-og.ts, build-view-og.ts) therefore keep the committed
 * card when a re-render gives the same picture, so identical input gives identical bytes
 * and the brand packs' history stops growing on every rebuild.
 *
 * Needs sharp (an optional devDependency); without sharp the raster cases skip.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG_ENCODE, stampBitmap, stampBitmapStable } from '../scripts/lib/stamp-media.ts';
import { stripProbeCredential } from '../scripts/lib/edge-probe-bytes.ts';

let sharp: typeof import('sharp').default | null = null;
try { sharp = (await import('sharp')).default; } catch { /* skipped below */ }
const skip = sharp ? false : 'sharp not available';

/** A 320x200 card-like PNG: a gradient with a block whose position varies by `seed`. */
async function card(seed: number): Promise<Uint8Array> {
  const width = 320, height = 200, data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, inBlock = x >= 40 + seed && x < 120 + seed && y >= 50 && y < 150;
    data[i] = inBlock ? 230 : x % 256; data[i + 1] = inBlock ? 40 : y % 256; data[i + 2] = 128; data[i + 3] = 255;
  }
  return new Uint8Array(await sharp!(data, { raw: { width, height, channels: 4 } }).png().toBuffer());
}
const chunkTypes = (png: Uint8Array): string[] => {
  const out: string[] = [], view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let at = 8; at + 8 <= png.length; at += view.getUint32(at) + 12) out.push(String.fromCharCode(...png.subarray(at + 4, at + 8)));
  return out;
};
const meta = { id: 'stable-card', name: 'Stable card' };

test('the stated PNG settings are sharp\'s own defaults, so stating them changed no committed card', { skip }, async () => {
  const width = 64, height = 48, data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i++) data[i] = (i * 7919) % 251;
  const raw = { raw: { width, height, channels: 4 as const } };
  assert.deepEqual(await sharp!(data, raw).png(PNG_ENCODE).toBuffer(), await sharp!(data, raw).png().toBuffer());
});

test('a stamp alone is not reproducible: the credential differs while everything else matches', { skip }, async () => {
  const png = await card(0);
  const [one, two] = [await stampBitmap(png, 'png', meta), await stampBitmap(png, 'png', meta)];
  assert.ok(chunkTypes(one).includes('caBX'), 'the card carries a C2PA chunk');
  assert.notDeepEqual(Buffer.from(one), Buffer.from(two));
  assert.deepEqual(Buffer.from(stripProbeCredential(one, 'png')), Buffer.from(stripProbeCredential(two, 'png')));
});

test('the same picture keeps the previous bytes, credential included', { skip }, async () => {
  const png = await card(0);
  const first = await stampBitmapStable(png, meta, null);
  assert.ok(chunkTypes(first).includes('caBX'));
  const again = await stampBitmapStable(png, meta, first);
  assert.equal(again, first, 'the previous buffer comes back as it is');
  // Repeated forced re-renders stay byte-identical.
  assert.deepEqual(Buffer.from(await stampBitmapStable(await card(0), meta, again)), Buffer.from(first));
});

test('another picture, an unstamped file or bytes that do not parse get a fresh credential', { skip }, async () => {
  const first = await stampBitmapStable(await card(0), meta, null);
  const moved = await stampBitmapStable(await card(3), meta, first);
  assert.notDeepEqual(Buffer.from(moved), Buffer.from(first));
  assert.ok(chunkTypes(moved).includes('caBX'));
  assert.notDeepEqual(Buffer.from(stripProbeCredential(moved, 'png')), Buffer.from(stripProbeCredential(first, 'png')));
  for (const previous of [new Uint8Array([1, 2, 3]), Buffer.from(stripProbeCredential(first, 'png')).subarray(0, 40)]) {
    const fresh = await stampBitmapStable(await card(0), meta, previous);
    assert.notEqual(fresh, previous);
    assert.deepEqual(Buffer.from(stripProbeCredential(fresh, 'png')), Buffer.from(stripProbeCredential(first, 'png')));
  }
});

test('both OG generators stamp through the stable path and write only a changed card', () => {
  for (const file of ['scripts/build-tool-og.ts', 'scripts/build-view-og.ts']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\bstampBitmap\(/, `${file} no longer stamps unconditionally`);
    assert.match(source, /const previous = existsSync\(cardPath\) \? readFileSync\(cardPath\) : null;/, file);
    assert.match(source, /await stampBitmapStable\(png, \{ id: [a-z]\.(?:id|slug), name: [a-z]\.(?:name|title) \}, previous\)/, file);
    assert.match(source, /if \(stamped !== previous\) \{ writeFileSync\(cardPath, stamped\); cards\+\+; \} else kept\+\+;/, file);
  }
});
