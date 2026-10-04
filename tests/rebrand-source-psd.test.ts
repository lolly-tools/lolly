// SPDX-License-Identifier: MPL-2.0
/**
 * A Photoshop document as a Rebrand source (plans/289 D2): `sourceDeckFromPsd`
 * reads it as one slide, and the node pipeline plans and compiles it like a deck.
 * The files are psd-tools' Photoshop-saved fixtures (tests/fixtures/psd, MIT).
 *
 * Run with: node --test tests/rebrand-source-psd.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import { unzlibSync } from 'fflate';
import type { SourceDeckV1 } from '../packages/core/src/rebrand-v1.ts';
import { compileDeck, planDeck, planSourceProblems, readDeck, sourceDeckFromPsd } from '../packages/node-shell/src/rebrand/index.ts';
import { STARTER_DESIGN_SYSTEM, parsePipelineXml } from './helpers/rebrand-pipeline.ts';

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/psd/${name}`, import.meta.url)));

const validateDeck = (() => {
  const validate = new Ajv({ allErrors: true, strict: false }).compile(JSON.parse(readFileSync(new URL('../schemas/rebrand-source-v1.schema.json', import.meta.url), 'utf8')));
  return (deck: SourceDeckV1): void => {
    const doc: unknown = deck;
    if (!validate(doc)) assert.fail(`${deck.source.name} failed the source schema: ${(validate.errors ?? []).slice(0, 6).map(e => `${e.instancePath} ${e.message}`).join('; ')}`);
  };
})();

async function deckOf(name: string): Promise<{ deck: SourceDeckV1; stored: string[] }> {
  const stored: string[] = [];
  const deck = await sourceDeckFromPsd(fixture(name), {
    hash: `sha256:${'0'.repeat(64)}`, instanceId: 'psd-test', name, bytes: 1,
    reader: { name: 'psd-read', version: 'test' }, inflate: (d) => unzlibSync(d),
    sink: async (_bytes, mime, hint) => { stored.push(mime); return `user/media/${hint.slice(0, 16)}`; },
  });
  validateDeck(deck);
  return { deck, stored };
}

test('a type layer is a text object with its paragraphs, size in points and face', async () => {
  const { deck, stored } = await deckOf('text.psd');
  assert.equal(deck.source.kind, 'psd');
  assert.equal(deck.slides.length, 1);
  const slide = deck.slides[0]!;
  assert.deepEqual([slide.width, slide.height, slide.origin.kind], [400, 400, 'psd']);
  const text = slide.objects.find(o => o.kind === 'text')!;
  assert.deepEqual(text.text!.paras.map(p => p.runs.map(r => r.text).join('')), ['Line 1', 'Line 2', 'Line 3 and text']);
  assert.deepEqual([text.text!.paras[0]!.runs[0]!.sizePt, text.text!.paras[0]!.runs[0]!.font], [9.75, 'Arial'], '13 px is 9.75 pt');
  assert.deepEqual(slide.readingOrder, [text.id]);
  assert.deepEqual(deck.fonts, [{ family: 'Arial', provenance: 'literal', runs: 3 }]);
  assert.equal(slide.objects.find(o => o.kind === 'pic')!.fidelity.state, 'raster-preserved', 'the background layer is its own pixels');
  assert.deepEqual(stored, ['image/png'], 'one picture stored, once');
});

test('shapes keep their geometry; what Rebrand cannot draw stays a picture, and the slide says why', async () => {
  const { deck } = await deckOf('stroke.psd');
  const slide = deck.slides[0]!;
  const byName = (name: string) => slide.objects.find(o => o.alt === name)!;
  assert.deepEqual([byName('Rectangle 1').kind, byName('Rectangle 1').geom], ['shape', 'rect']);
  assert.deepEqual([byName('Ellipse 1').geom, byName('Ellipse 1').fill], ['ellipse', { hex: '#b3d465' }]);
  assert.equal(byName('Rounded Rectangle 1').kind, 'pic');
  assert.equal(byName('Rounded Rectangle 1').fidelity.state, 'approximate');
  const dropped = slide.warnings.filter(w => w.code === 'feature-dropped');
  assert.equal(dropped.length, 3);
  assert.ok(dropped.every(w => w.objectIds?.length === 1));
});

test('combined outlines are one custom shape whose vector item draws the union', async () => {
  const { deck } = await deckOf('path-operations_combine.psd');
  const [shape] = deck.slides[0]!.objects;
  assert.deepEqual([shape!.kind, shape!.geom], ['shape', 'custom']);
  const item = shape!.vectorItems!.items[0];
  assert.ok(item && item.kind === 'path');
  assert.equal((item.d.match(/M/g) ?? []).length, 1, 'one outline: the stroke runs round the outside only');
  assert.deepEqual(item.fill, { hex: '#009944' });
  assert.equal(item.stroke?.color.hex, '#000000');
});

test('a bottom colour layer is the background; visible adjustments are said, hidden ones are not', async () => {
  const fill = await deckOf('layers-minimal_solid-color-fill.psd');
  assert.deepEqual(fill.deck.slides[0]!.background, { color: { hex: '#ff0000' } });
  assert.equal(fill.deck.slides[0]!.objects.length, 0);
  const adjusted = await deckOf('fill_adjustments.psd');
  const messages = adjusted.deck.slides[0]!.warnings.map(w => w.message);
  assert.ok(messages.some(m => /^Levels 1: Levels adjustment layer was not applied/.test(m)));
  assert.ok(!messages.some(m => /^Invert 1:/.test(m)), 'Invert is hidden in this file, so Photoshop did not apply it either');
});

test('the pipeline reads a Photoshop document by its bytes, plans every object once and compiles', async () => {
  const bytes = fixture('stroke.psd');
  const read = await readDeck({ bytes, name: 'poster.psd', parseXml: parsePipelineXml, instanceId: 'psd-pipeline' });
  assert.equal(read.source.source.kind, 'psd');
  validateDeck(read.source);
  const planned = await planDeck({ bytes, name: 'poster.psd', parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM, instanceId: 'psd-pipeline' });
  assert.match(planned.plan.algorithms.reader, /^psd-read\//, 'the plan names the Photoshop reader');
  assert.deepEqual(planSourceProblems(planned.plan, planned.source), []);
  const { compiled, report } = await compileDeck({ source: planned.source, census: planned.census, plan: planned.plan, system: planned.system });
  assert.equal(compiled.source.hash, planned.source.source.hash);
  assert.equal(report.entries.filter(e => e.disposition).length, planned.source.slides[0]!.objects.length, 'one disposition per object');
});
