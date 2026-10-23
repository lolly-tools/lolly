// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DESIGN_FIXTURES, countRows, designLargeFixture, fixtureMedia, lottieClip, marqueeBand, mixFor } from '../scripts/lib/design-large-fixture.ts';
import type { FixtureMediaRef, FixtureRow } from '../scripts/lib/design-large-fixture.ts';
import { decodeAuthoredPath } from '../engine/src/geom/authored-url.ts';

const manifest = JSON.parse(readFileSync(new URL('../community/design/tool.json', import.meta.url), 'utf8')) as { inputs: Array<{ id: string; fields?: Array<{ id: string; options?: Array<{ value: string }> }> }> };
const boxFields = manifest.inputs.find(input => input.id === 'boxes')!.fields!;
const declared = new Set(boxFields.map(field => field.id));
const kinds = new Set(boxFields.find(field => field.id === 'kind')!.options!.map(option => option.value));

test('a fixture is the same rows for the same name and seed, and different rows for another seed', () => {
  for (const name of DESIGN_FIXTURES) {
    assert.equal(JSON.stringify(designLargeFixture(name)), JSON.stringify(designLargeFixture(name)), name);
  }
  assert.notEqual(JSON.stringify(designLargeFixture('D1', { seed: 7 }).boxes), JSON.stringify(designLargeFixture('D1').boxes));
});

test('each fixture has the size and mix the review specifies', () => {
  const expect = {
    D1: { objects: 2000, text: 1100, shape: 500, image: 200, path: 100, connector: 50, group: 50 },
    'D1-motion': { objects: 2016, image: 200, video: 8, lottie: 8 },
    D2: { objects: 5000 },
    D3: { objects: 20000, text: 11000, group: 500 },
    W1: { rows: 1900 },
  } as const;
  for (const [name, wanted] of Object.entries(expect)) {
    const counts = designLargeFixture(name as keyof typeof expect).counts;
    for (const [key, value] of Object.entries(wanted)) assert.equal(counts[key], value, `${name} ${key}`);
    assert.equal(counts.frame, 50, `${name} artboards`);
  }
  assert.deepEqual(mixFor(2000), { text: 1100, shape: 500, image: 200, path: 100, connector: 50, group: 50 });
  assert.equal(Object.values(mixFor(1850)).reduce((sum, n) => sum + n, 0), 1850);
  const shapes = designLargeFixture('D1').boxes.filter(row => row.kind === 'box');
  assert.equal(shapes.filter(row => row.shadow === 'box').length, 50, '10% of shapes cast a shadow');
  assert.equal(shapes.filter(row => row.blur).length, 25, '5% carry a layer blur');
  assert.equal(shapes.filter(row => row.blend === 'multiply').length, 25, '5% carry a blend mode');
  const texts = designLargeFixture('D1').boxes.filter(row => row.kind === 'text');
  assert.equal(texts.filter(row => String(row.text).includes('\n')).length, 330, '30% of text is multi-line');
  assert.ok(texts.every(row => Number(row.fontSize) >= 12 && Number(row.fontSize) <= 96));
});

test('rows are well formed Design layers: declared fields, unique ids, inside their artboard', () => {
  for (const name of DESIGN_FIXTURES) {
    const { boxes, artboards, pages } = designLargeFixture(name);
    const byId = new Map<string, FixtureRow>();
    for (const row of boxes) {
      assert.ok(!byId.has(row.id), `${name}: duplicate id ${row.id}`);
      byId.set(row.id, row);
      assert.ok(kinds.has(row.kind), `${name}: unknown kind ${row.kind}`);
      for (const key of Object.keys(row)) assert.ok(declared.has(key), `${name}: ${row.id} carries undeclared field ${key}`);
    }
    const boards = new Map(artboards.map(board => [board.id, board]));
    for (const row of boxes) {
      if (row.kind === 'frame') continue;
      const parent = row.group ? byId.get(String(row.group)) : row;
      assert.ok(parent, `${name}: ${row.id} names a missing group`);
      const board = boards.get(String(parent.frame));
      assert.ok(board, `${name}: ${row.id} sits on no artboard`);
      if (row.kind === 'path' && row.bindStart) {
        assert.equal(byId.get(String(row.bindStart))?.frame, row.frame, `${name}: ${row.id} binds within its artboard`);
        assert.equal(byId.get(String(row.bindEnd))?.frame, row.frame);
        continue;
      }
      const x = Number(row.x), y = Number(row.y), w = Number(row.w), h = Number(row.h);
      assert.ok(x >= board.x && y >= board.y && x + w <= board.x + board.w + 0.5 && y + h <= board.y + board.h + 0.5, `${name}: ${row.id} leaves its artboard`);
      if (row.kind === 'path') assert.ok(decodeAuthoredPath(String(row.path)), `${name}: ${row.id} path decodes`);
    }
    if (name === 'D1-pages') {
      assert.equal(pages.length, 10);
      const frames = boxes.filter(row => row.kind === 'frame');
      for (const page of pages) assert.equal(frames.filter(row => row.pageId === page.id).length, 5, page.id);
    } else assert.deepEqual(pages, []);
  }
});

test('media is named by upload id and filled from the refs the harness supplies', () => {
  const specs = fixtureMedia('D1-motion');
  assert.equal(specs.filter(spec => spec.type === 'raster').length, 20);
  assert.ok(specs.every(spec => spec.id.startsWith('user/media/bench-')));
  const media: Record<string, FixtureMediaRef> = Object.fromEntries(specs.map(spec => [spec.id,
    { source: 'user', id: spec.id, type: spec.type, format: spec.format, url: `blob:bench/${spec.id}` } satisfies FixtureMediaRef]));
  const filled = designLargeFixture('D1-motion', { media });
  const refs = filled.boxes.flatMap(row => typeof row.image === 'object' ? [row.image] : []);
  assert.equal(refs.length, 216);
  assert.ok(refs.every(ref => ref.url === `blob:bench/${ref.id}`));
  assert.equal(new Set(refs.filter(ref => ref.type === 'raster').map(ref => ref.id)).size, 20);
  assert.ok(designLargeFixture('D1').boxes.every(row => typeof row.image !== 'object' || row.image.url === ''));
  assert.deepEqual(countRows(filled.boxes), filled.counts);
  const clip = lottieClip(3001) as { op: number; layers: unknown[] };
  assert.equal(clip.op, 60); assert.equal(clip.layers.length, 1);
  assert.deepEqual(lottieClip(3001), clip);
});

test('the marquee band starts on the pasteboard and touches about the requested count', () => {
  for (const name of ['D1', 'D1-pages', 'D2', 'W1'] as const) {
    const fixture = designLargeFixture(name), band = marqueeBand(fixture, 50);
    const firstPage = fixture.artboards.filter(board => board.pageId === fixture.artboards[0]!.pageId);
    assert.ok(firstPage.every(board => band.y1 > board.y + board.h), `${name}: starts below the first page's artboards`);
    assert.ok(band.touched >= 45 && band.touched <= 65, `${name}: touched ${band.touched}`);
  }
});
