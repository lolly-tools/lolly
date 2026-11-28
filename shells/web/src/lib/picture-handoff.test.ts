// SPDX-License-Identifier: MPL-2.0
/** A picture passes between picture tools, read from the shipped manifests (lib/picture-handoff.ts). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { ToolManifest } from '@lolly/engine';
import { carriedFraming, pictureDestinations, type IndexedTool } from './picture-handoff.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const manifest = (id: string): ToolManifest => JSON.parse(readFileSync(join(ROOT, 'community', id, 'tool.json'), 'utf8'));
const darkroom = manifest('darkroom');
const filter = manifest('filter');
const design = manifest('design');
const index = [darkroom, filter, design] as unknown as IndexedTool[];
const photo = { id: 'lolly/demo/sample-photo', type: 'raster', format: 'jpg', url: '/x.jpg' } as unknown as AssetRef;
const vector = { id: 'lolly/logo/primary', type: 'vector', format: 'svg', url: '/x.svg' } as unknown as AssetRef;

test('Darkroom offers its picture to Filter, and Filter to Darkroom', () => {
  assert.deepEqual(pictureDestinations(darkroom, 'image', photo, index), [{ id: 'filter', name: 'Filter' }]);
  assert.deepEqual(pictureDestinations(filter, 'image', photo, index), [{ id: 'darkroom', name: 'Darkroom' }]);
});

test('only the picture a tool makes a rendition of is offered, and only when one is set', () => {
  assert.deepEqual(pictureDestinations(filter, 'ltHeadshot', photo, index), []);
  assert.deepEqual(pictureDestinations(filter, 'image', null, index), []);
  assert.deepEqual(pictureDestinations(design, 'image', photo, index), [], 'Design is not a rendition of one picture');
});

test('a destination has to accept the kind of picture, be listed and not be retired', () => {
  assert.deepEqual(pictureDestinations(filter, 'image', vector, index), [], 'Darkroom opens rasters only');
  const retired = index.map((tool) => (tool.id === 'filter' ? { ...tool, deprecated: true } : tool));
  assert.deepEqual(pictureDestinations(darkroom, 'image', photo, retired), []);
  const unlisted = index.map((tool) => (tool.id === 'filter' ? { ...tool, listed: false } : tool));
  assert.deepEqual(pictureDestinations(darkroom, 'image', photo, unlisted), []);
});

test('the framing travels from Darkroom into both of Filter\'s framed effects', () => {
  const placed = { zoom: 180, x: 40, y: 60, rotate: 5, tiltV: 0, tiltH: 0 };
  const carried = carriedFraming(darkroom, { image: photo, imageFraming: placed, imageFit: 'contain' } as never, 'image', filter, 'image');
  assert.equal((carried.du_imageFraming as unknown as { zoom: number }).zoom, 180);
  assert.equal((carried.px_imageFraming as unknown as { x: number }).x, 40);
});

test('from Filter the framing in use travels: the active effect\'s, or none', () => {
  const placed = { zoom: 150, x: 30, y: 70 };
  const duotone = carriedFraming(filter, { effect: 'duotone', du_imageFraming: placed, px_imageFraming: { zoom: 300 } } as never, 'image', darkroom, 'image');
  assert.equal((duotone.imageFraming as unknown as { zoom: number }).zoom, 150);
  const halftone = carriedFraming(filter, { effect: 'halftone', du_imageFraming: placed } as never, 'image', darkroom, 'image');
  assert.deepEqual(halftone, {}, 'halftone has no framing of its own to pass on');
});

test('a fit travels only where the receiver offers the same choice', () => {
  const carried = carriedFraming(darkroom, { imageFit: 'contain' } as never, 'image', darkroom, 'image');
  assert.equal(carried.imageFit, 'contain');
  assert.equal(carriedFraming(darkroom, { imageFit: 'stretch' } as never, 'image', darkroom, 'image').imageFit, undefined);
});
