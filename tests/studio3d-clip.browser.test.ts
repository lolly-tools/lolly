// SPDX-License-Identifier: MPL-2.0
/**
 * Baked animation clips in 3D Studio, drawn in a real browser.
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test tests/studio3d-clip.browser.test.ts
 *   STUDIO_SHOTS=<directory> node --import ./tests/css-stub.mjs --test tests/studio3d-clip.browser.test.ts
 *
 * tests/studio3d-clip.test.ts holds the rules as arithmetic. This file draws frames through
 * the export clock, the call a video, GIF or APNG export makes for each frame, and reads
 * the pixels back. Three models are drawn: a node that slides, a morph target that lifts
 * and a skinned triangle whose bone slides (tests/helpers/studio3d-clip.ts). Each clip is
 * two seconds long and every sample is a frame of a five second clip.
 *
 * What is checked for each model:
 *   1. the frame at half a second differs from the frame at zero, so the clip is drawn;
 *   2. the frame at half a second comes back byte for byte after other frames were drawn
 *      in between, so a frame does not depend on the frame before;
 *   3. the frame at two seconds, where a two second clip starts again, is the frame at zero;
 *   4. with Play model animation off, every frame is the one still frame.
 * And for the skinned model with the animation off: the picture holds the model, which
 * a copy that kept its source's bones would draw away from the copy's own place.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Page } from 'playwright';
import { morphGlb, movingGlb, skinnedGlb } from './helpers/studio3d-clip.ts';
import { type StudioHarness, saveShot, startStudioHarness, studioSkip } from './helpers/studio3d-browser.ts';

const MODELS = { moving: movingGlb(), morph: morphGlb(), skinned: skinnedGlb() };
/** A five second clip: time 0.1 is half a second in, time 0.4 is two seconds in. */
const HALF_SECOND = 0.1;
const TWO_SECONDS = 0.4;

/** How many pixels of a frame are not fully clear. */
async function drawnPixels(page: Page, png: string): Promise<number> {
  return page.evaluate(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let drawn = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 8) drawn++;
    return drawn;
  }, png);
}

describe('3D Studio baked clips in a browser', { skip: studioSkip }, () => {
  let harness: StudioHarness;
  let page: Page;

  before(async () => {
    harness = await startStudioHarness({
      size: 256,
      routes: Object.fromEntries(Object.entries(MODELS).map(([name, bytes]) => [`/${name}.glb`, bytes])),
    });
    page = await harness.open();
  });
  after(async () => {
    await harness?.close();
  });

  const sample = (time: number) => page.evaluate((t) => window.studioTest!.sample(t), time);
  const values = (name: string, play: boolean) => ({
    source: 'model',
    modelAsset: { url: `/${name}.glb`, name: `${name}.glb` },
    outputMode: 'object',
    playClip: play,
  });

  for (const name of Object.keys(MODELS)) {
    it(`${name}: the clip is drawn, a frame is its time alone, and the clip repeats at its own length`, async () => {
      const frame = await harness.render(page, values(name, true));
      assert.equal(frame.state, 'ready', frame.info);
      assert.match(frame.info, /Model animation: playing/);
      const start = await sample(0);
      const half = await sample(HALF_SECOND);
      await saveShot(`clip-${name}-0.0s.png`, start);
      await saveShot(`clip-${name}-0.5s.png`, half);
      assert.ok((await drawnPixels(page, start)) > 50, 'the model is in the frame at the start');
      assert.ok((await drawnPixels(page, half)) > 50, 'and half a second in');
      assert.notEqual(half, start, 'half a second in, the model has moved');
      await sample(0.3);
      await sample(0.07);
      assert.equal(await sample(HALF_SECOND), half, 'the same frame after others were drawn');
      assert.equal(await sample(TWO_SECONDS), start, 'two seconds in, a two second clip starts again');
      assert.equal(await sample(0), start);
    });

    it(`${name}: with the animation off every frame is the one still`, async () => {
      const frame = await harness.render(page, values(name, false));
      assert.equal(frame.state, 'ready', frame.info);
      assert.match(frame.info, /holds one animation clip/);
      const start = await sample(0);
      await saveShot(`clip-${name}-off.png`, start);
      assert.ok((await drawnPixels(page, start)) > 50, 'the model is in the frame');
      assert.equal(await sample(HALF_SECOND), start);
      assert.equal(await sample(0.33), start);
    });
  }

  it('no page error was raised', () => {
    assert.deepEqual(harness.errors, []);
  });
});
