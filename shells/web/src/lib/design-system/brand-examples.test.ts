// SPDX-License-Identifier: MPL-2.0
// The Usage & rules examples recolour the Design templates from the design
// system. Every text box has to read on the frame it sits on, in every mode of
// both shipped systems: the Title slide used to paint on-primary text on a
// surface frame, which is the same colour in both systems, so it rendered blank.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brandExample, readableInk, textContrastCheck, EXAMPLE_TEXT } from './brand-examples.ts';
import { usageSystem } from './usage-model.ts';
import { contrastRatio } from '../../../../../engine/src/brand-derive.ts';

const here = new URL('.', import.meta.url);
const read = (rel: string): unknown => JSON.parse(readFileSync(new URL(rel, here), 'utf8'));

// The template seed is fetched from /tools/design/templates/<id>.json; answer
// that from the community tool's own files.
globalThis.fetch = (async (input: string | URL) => {
  const url = String(input);
  const hit = /\/tools\/design\/templates\/([\w-]+)\.json$/.exec(url);
  if (!hit) return { ok: false, json: async () => null } as unknown as Response;
  const json = read(`../../../../../community/design/templates/${hit[1]}.json`);
  return { ok: true, json: async () => json } as unknown as Response;
}) as typeof fetch;

const DOCS = {
  'Lolly Demo': read('../../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json'),
  'Lolly Starter': read('../../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json'),
};
const HEX = /^#[0-9a-f]{6}$/i;

for (const [name, doc] of Object.entries(DOCS)) {
  for (const mode of ['', 'light', 'dark']) {
    for (const id of ['brand-poster', 'brand-slide-title', 'brand-slide-content'] as const) {
      test(`${name} ${mode || 'default'} ${id}: every text box reads on its frame`, async () => {
        const example = await brandExample(id, doc, usageSystem(doc, 'Test'), mode, EXAMPLE_TEXT);
        const boxes = (example.values.boxes ?? []) as Array<Record<string, unknown>>;
        const frame = boxes.find(box => box.kind === 'frame')!;
        assert.ok(frame, 'the example has a frame');
        assert.match(String(frame.bg), HEX, 'the frame is a plain colour, not a var()');
        const texts = boxes.filter(box => box.kind === 'text');
        assert.ok(texts.length >= 2);
        for (const box of texts) {
          assert.match(String(box.fg), HEX, `${String(box.id)} carries a plain colour`);
          const ratio = contrastRatio(String(box.fg), String(frame.bg));
          assert.ok(ratio >= 4.5, `${String(box.id)} reads at ${ratio.toFixed(2)}:1 on ${String(frame.bg)}`);
        }
        assert.equal(textContrastCheck(boxes).state, 'pass');
      });
    }
  }
}

test('a dark surface with no other colours gets white text on the Title slide', async () => {
  const doc = { color: { semantic: { surface: { $type: 'color', $value: '#101010' } } } };
  const example = await brandExample('brand-slide-title', doc, usageSystem(doc, 'Test'), '', EXAMPLE_TEXT);
  const boxes = (example.values.boxes ?? []) as Array<Record<string, unknown>>;
  const texts = boxes.filter(box => box.kind === 'text');
  assert.equal(texts.length, 2);
  for (const box of texts) assert.equal(box.fg, '#ffffff');
});

test('readableInk takes the first candidate that reads, else black or white', () => {
  assert.equal(readableInk('#ffffff', ['#f9f7ef', '#033633']), '#033633');
  assert.equal(readableInk('#ffffff', ['#f9f7ef']), '#000000');
  assert.equal(readableInk('#101010', []), '#ffffff');
  assert.equal(readableInk('#ffffff', [null, undefined, '', '#033633']), '#033633');
});

test('textContrastCheck names a failing ratio and leaves an unreadable colour out of the count', () => {
  const frame = { id: 'f', kind: 'frame', bg: '#ffffff' };
  const fail = textContrastCheck([frame, { id: 't', kind: 'text', frame: 'f', fg: '#f9f7ef', text: 'Pale heading' }]);
  assert.equal(fail.state, 'fail');
  assert.match(fail.detail, /Pale heading/);
  assert.match(fail.detail, /reads at 1\.0\d:1 on #ffffff/);

  const mixed = textContrastCheck([frame, { id: 'a', kind: 'text', frame: 'f', fg: '#033633' }, { id: 'b', kind: 'text', frame: 'f', fg: 'var(--x)' }]);
  assert.equal(mixed.state, 'pass');
  assert.match(mixed.detail, /1 text boxes measured/);
  assert.match(mixed.detail, /1 boxes carry a colour Lolly cannot read/);

  assert.equal(textContrastCheck([frame]).state, 'unknown');
});

test('the chart example fills a 16:9 frame', async () => {
  const doc = DOCS['Lolly Demo'];
  const example = await brandExample('brand-chart', doc, usageSystem(doc, 'Test'), '', EXAMPLE_TEXT);
  assert.equal(example.height, 720);
  assert.equal(example.values.height, 720);
  assert.equal(example.width, 1280);
});
