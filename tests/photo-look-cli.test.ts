// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI bridge resolves the looks a design system's colourways make (engine
 * brand-treatments.ts): a catalog photo with `?treatment=colourway-<id>` gets that
 * colourway's gradient map in its SVG filter wrapper, an inline picture is baked into
 * raster bytes when the install has a canvas, an icon with `?theme=colourway-<id>` (or
 * its `--on-dark` pairing) bakes the colourway's colours, and an unknown look serves the
 * plain picture under the id it was asked for.
 *
 * Public: the lolly-demo profile and its colourways. The pixel bake of a gradient-map or
 * LUT look is covered by tests/photo-look.test.ts and the web bridge's own tests.
 *
 * Run with: node --test tests/photo-look-cli.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

process.env.LOLLY_PROFILE = 'lolly-demo';
const { createCliBridge } = await import('../shells/cli/src/bridge.ts');
const { isCanvasAvailable } = await import('../packages/node-shell/src/canvas.ts');
const { colourwayInks } = await import('../engine/src/brand-treatments.ts');

const PHOTO = 'lolly/demo/lorikeet-lollipop';
const ICON = 'lolly/icons/award';
const fakeDom = () => ({ window: {} as Window & typeof globalThis });
const DEMO = JSON.parse(readFileSync(new URL('../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8'));
const inks = new Map(colourwayInks(DEMO).map((c) => [c.id, c]));

/** The text of a data: URL or an object URL the bridge handed back. */
async function textOf(url: string): Promise<string> {
  return (await fetch(url)).text();
}

test('a catalog photo with a colourway wash gets that colourway\'s gradient map', async () => {
  const host = await createCliBridge({ dom: fakeDom() });
  const midnight = await host.assets.get(`${PHOTO}?treatment=colourway-midnight`);
  const morning = await host.assets.get(`${PHOTO}?treatment=colourway-morning`);
  assert.equal(midnight.id, `${PHOTO}?treatment=colourway-midnight`, 'the treated id is kept');
  assert.match(midnight.url, /^data:image\/svg\+xml/);
  assert.match(await textOf(midnight.url), /feComponentTransfer|feColorMatrix/, 'the wash is an SVG filter over the photo');
  assert.notEqual(midnight.url, morning.url, 'each colourway washes differently');
});

test('an inline picture with a colourway wash is baked, and an unknown look serves the plain picture', async () => {
  const host = await createCliBridge({ dom: fakeDom() });
  const plain = await host.assets.get(PHOTO);
  const inline = plain.url;
  const looked = await host.assets.get(`${inline}?treatment=colourway-spearmint`);
  assert.equal(looked.id, `${inline}?treatment=colourway-spearmint`);
  if (isCanvasAvailable()) assert.notEqual(looked.url, inline);
  const unknown = await host.assets.get(`${inline}?treatment=no-such-look`);
  assert.equal(unknown.url, inline);
  assert.equal(unknown.id, `${inline}?treatment=no-such-look`);
});

test('an icon takes a colourway\'s pairing, and its pairing for a dark ground', async () => {
  const host = await createCliBridge({ dom: fakeDom() });
  const morning = inks.get('colourway-morning')!;
  const light = await textOf((await host.assets.get(`${ICON}?theme=colourway-morning`)).url);
  assert.match(light, new RegExp(`fill="${morning.accent}"`), 'the accent');
  assert.match(light, new RegExp(`fill="${morning.base}"`), 'the base');
  const dark = await textOf((await host.assets.get(`${ICON}?theme=colourway-morning--on-dark`)).url);
  assert.match(dark, new RegExp(`fill="${morning.onDarkAccent}"`));
  assert.match(dark, new RegExp(`fill="${morning.onDarkBase}"`));
});
