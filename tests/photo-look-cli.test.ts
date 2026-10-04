// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI bridge bakes a photo look into raster bytes (plan 291 W7): a catalog
 * photo or an inline picture with `?treatment=<lookId>` resolves to a JPEG whose
 * pixels are the engine's look, the document's theme choice picks the look's
 * variant, and the legacy SVG-filter kinds keep their wrapper. Without a canvas in
 * the install, the plain picture is served under the treated id.
 *
 * Public: the lolly-start profile and its derived Tone look.
 *
 * Run with: node --test tests/photo-look-cli.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.LOLLY_PROFILE = 'lolly-start';
const { createCliBridge } = await import('../shells/cli/src/bridge.ts');
const { isCanvasAvailable, decodeToCanvas } = await import('../packages/node-shell/src/canvas.ts');
const { applyPhotoLook } = await import('../engine/src/photo-look.ts');

const PHOTO = 'lolly/demo/lorikeet-lollipop';
const fakeDom = () => ({ window: {} as Window & typeof globalThis });
const bytesOf = async (url: string): Promise<Uint8Array> => new Uint8Array(await (await fetch(url)).arrayBuffer());

async function pixels(bytes: Uint8Array): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const canvas = (await decodeToCanvas(bytes))!;
  const image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  return { data: image.data, width: canvas.width, height: canvas.height };
}

test('a catalog photo with a look resolves to baked pixels, per theme', async () => {
  const host = await createCliBridge({ dom: fakeDom() });
  const plain = await host.assets.get(PHOTO);
  const light = await host.assets.get(`${PHOTO}?treatment=tone`);
  const dark = await host.assets.get(`${PHOTO}?treatment=tone`, { tokenSelection: { '': 'dark' } });
  assert.equal(light.id, `${PHOTO}?treatment=tone`, 'the treated id is kept');
  if (!isCanvasAvailable()) {
    assert.equal(light.url, plain.url, 'with no canvas the plain picture is served');
    return;
  }
  assert.match(light.url, /^data:image\/jpeg;base64,/);
  assert.equal(light.format, 'jpg');
  assert.equal(light.meta?.treatment, 'tone');
  assert.equal(dark.meta?.lookTheme, 'dark');
  assert.notEqual(light.url, plain.url);
  assert.notEqual(light.url, dark.url, 'the dark variant bakes differently');
  // The baked bytes are the engine's look of the decoded photo, give or take JPEG.
  const source = await pixels(await bytesOf(plain.url));
  const looks = (await host.assets.get('lolly/palette/photo-treatments')).meta as { treatments: Array<Record<string, unknown>> };
  const tone = looks.treatments.find(t => t.id === 'tone')!;
  applyPhotoLook(source.data, source.width, source.height, tone as never);
  const baked = await pixels(await bytesOf(light.url));
  assert.equal(baked.width, source.width);
  let sum = 0;
  for (let i = 0; i < baked.data.length; i += 4) for (let c = 0; c < 3; c++) sum += Math.abs(baked.data[i + c]! - source.data[i + c]!);
  assert.ok(sum / (baked.data.length * 0.75) < 2, `baked pixels are the engine look (mean ${sum / (baked.data.length * 0.75)})`);
  // A second resolve is the same bake.
  assert.equal((await host.assets.get(`${PHOTO}?treatment=tone`)).url, light.url);
});

test('the legacy kinds keep their SVG filter wrapper', async () => {
  const host = await createCliBridge({ dom: fakeDom() });
  const grey = await host.assets.get(`${PHOTO}?treatment=greyscale`);
  assert.match(grey.url, /^data:image\/svg\+xml;base64,/);
});

test('an inline picture with a look is baked too, and an unknown look serves the plain picture', async () => {
  const host = await createCliBridge({ dom: fakeDom() });
  const plain = await host.assets.get(PHOTO);
  const inline = plain.url;
  const looked = await host.assets.get(`${inline}?treatment=tone`);
  assert.equal(looked.id, `${inline}?treatment=tone`);
  if (isCanvasAvailable()) assert.notEqual(looked.url, inline);
  const unknown = await host.assets.get(`${inline}?treatment=no-such-look`);
  assert.equal(unknown.url, inline);
  assert.equal(unknown.id, `${inline}?treatment=no-such-look`);
});
